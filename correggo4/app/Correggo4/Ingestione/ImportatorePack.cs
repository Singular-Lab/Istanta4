using System.Text.Json;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Ingestione;

/// <summary>
/// Da .pack a database, seguendo la sequenza di CorreggoWebPublisher
/// (Service1.cs:324-429 per la parte volantino, Worker.cs:1494-2150 per il resto).
/// </summary>
public sealed class ImportatorePack
{
    private const short StatoVolantinoAperto = 1;
    private const short PubblicazioneInProcesso = 2;
    private const short PubblicazioneCompletata = 3;
    private const short PubblicazioneNessuna = 0;
    private const short TipoElementoBox = 1;
    private const short TipoElementoCampo = 2;

    private readonly Correggo4Context ctx;
    private readonly EstrattorePagine estrattore;
    private readonly ILogger<ImportatorePack> log;

    public ImportatorePack(Correggo4Context ctx, EstrattorePagine estrattore, ILogger<ImportatorePack> log)
    {
        this.ctx = ctx;
        this.estrattore = estrattore;
        this.log = log;
    }

    // PostgreSQL timestamptz via Npgsql pretende DateTime in UTC: le date che
    // arrivano dal JSON sono Unspecified e vanno normalizzate, altrimenti
    // l'insert esplode.
    private static DateTime Utc(DateTime d) =>
        d.Kind == DateTimeKind.Utc ? d : DateTime.SpecifyKind(d, DateTimeKind.Utc);

    public async Task<EsitoImportazione> ImportaAsync(ContenutoPack pack)
    {
        var esito = new EsitoImportazione();
        var promo = pack.Pacchetto.promo!;

        string titolo = (promo.titolo ?? "").Replace("/", "_");
        string classificazione = promo.classificatore ?? "";
        esito.Titolo = titolo;
        esito.Classificazione = classificazione;

        if (string.IsNullOrWhiteSpace(titolo))
        {
            esito.Errore = "Il pacchetto non ha un titolo";
            return esito;
        }

        // --- volantino: cercato per la coppia (classificazione, titolo) ---
        var vol = await ctx.Volantinis
            .FirstOrDefaultAsync(v => v.Classificazione == classificazione && v.Titolo == titolo);

        if (vol == null)
        {
            vol = new Volantini
            {
                Titolo = titolo,
                Classificazione = classificazione,
                Margini = "0,0,0,0",            // costante dell'originale (Service1.cs:355)
                Status = StatoVolantinoAperto,
                TotPubblicazioni = 0,
                CodaPubblicazione = 0,
                ProgressPubblicazione = 0,
                StatoPubblicazione = PubblicazioneInProcesso,
                DataValiditaInizio = Utc(promo.dataInizio),
                DataValiditaFine = Utc(promo.dataFine),
                DataScadenza = Utc(promo.dataScadenza)
            };
            ctx.Volantinis.Add(vol);
            esito.VolantinoCreato = true;
        }
        else
        {
            vol.StatoPubblicazione = PubblicazioneInProcesso;
            vol.ProgressPubblicazione = 0;
            vol.DataValiditaInizio = Utc(promo.dataInizio);
            vol.DataValiditaFine = Utc(promo.dataFine);
            vol.DataScadenza = Utc(promo.dataScadenza);
        }

        // I tre identificativi che nell'originale stavano concatenati con '$'
        // dentro `descrizione` e si cercavano con LIKE. Qui sono colonne.
        if (Guid.TryParse(promo.guidIdPromo, out var idPromo)) vol.IdPromoFp = idPromo;
        else if (!string.IsNullOrWhiteSpace(promo.guidIdPromo))
            esito.Avvisi.Add($"guidIdPromo non e' un UUID valido: '{promo.guidIdPromo}'");

        if (Guid.TryParse(promo.guidIdKitRuntime, out var idKit)) vol.GuidKitRuntime = idKit;
        else if (!string.IsNullOrWhiteSpace(promo.guidIdKitRuntime))
            esito.Avvisi.Add($"guidIdKitRuntime non e' un UUID valido: '{promo.guidIdKitRuntime}'");

        vol.IdLavorazioneIstanta = promo.idLavorazioneIstanta;

        await ctx.SaveChangesAsync();
        esito.IdVolantino = vol.Id;

        // --- versione: chiudo la precedente, apro la nuova ---
        short ultima = await ctx.VolantiniVersionis
            .Where(v => v.IdVol == vol.Id)
            .MaxAsync(v => (short?)v.Versione) ?? 0;

        foreach (var aperta in await ctx.VolantiniVersionis
                     .Where(v => v.IdVol == vol.Id && v.DataChiusura == null).ToListAsync())
        {
            aperta.DataChiusura = DateTime.UtcNow;
        }

        var versione = new VolantiniVersioni
        {
            IdVol = vol.Id,
            Versione = (short)(ultima + 1),
            DataPubblicazione = DateTime.UtcNow
        };
        ctx.VolantiniVersionis.Add(versione);

        vol.Contatore = 0;   // "Il contatore riparte da 0" (Worker.cs:327)
        await ctx.SaveChangesAsync();
        esito.Versione = versione.Versione;

        // --- pagine: prima le immagini, poi le righe ---
        var paginePack = (pack.Pacchetto.pagine ?? new List<CorreggoPagina>())
            .OrderBy(p => p.numero).ToList();

        List<PaginaEstratta> estratte;
        try
        {
            estratte = estrattore.Estrai(pack.Pdf, classificazione, titolo, versione.Versione,
                                         paginePack.Select(p => p.numero).ToList());
        }
        catch (Exception ex)
        {
            vol.StatoPubblicazione = PubblicazioneNessuna;
            await ctx.SaveChangesAsync();
            esito.Errore = "Estrazione delle pagine dal PDF fallita: " + ex.Message;
            return esito;
        }

        if (estratte.Count != paginePack.Count)
            esito.Avvisi.Add($"Il PDF ha {estratte.Count} pagine ma il pacchetto ne dichiara {paginePack.Count}");

        var pagineInserite = new Dictionary<byte, VolantiniPagine>();

        foreach (var pagPack in paginePack)
        {
            var immagine = estratte.FirstOrDefault(e => e.Numero == pagPack.numero);
            decimal[] b = pagPack.bounds ?? new decimal[] { 0, 0, 0, 0 };

            // bounds = [top, left, bottom, right] (confermato da Worker.cs:1635)
            decimal larghezza = b.Length == 4 ? b[3] - b[1] : 0;
            decimal altezza = b.Length == 4 ? b[2] - b[0] : 0;

            var pagina = new VolantiniPagine
            {
                IdVol = vol.Id,
                IdVersione = versione.Id,
                Numero = pagPack.numero,
                Versione = versione.Versione,
                Sinistra = b.Length == 4 ? b[1] : 0,
                Alto = b.Length == 4 ? b[0] : 0,
                Larghezza = larghezza,
                Altezza = altezza,
                Path = $"pag{pagPack.numero}_v{versione.Versione}",
                PathFisico = $"{classificazione}/{titolo}/pag{pagPack.numero}_v{versione.Versione}",
                DataVersione = DateTime.UtcNow
            };

            // L'originale qui divide per pag_w_vivo che nel percorso .pack vale
            // sempre 0 (bug noto, Worker.cs:1630-1646). Qui ci si guarda.
            if (immagine != null && larghezza > 0 && altezza > 0)
            {
                pagina.RapportoX = decimal.Round(immagine.LarghezzaPx / larghezza, 2);
                pagina.RapportoY = decimal.Round(immagine.AltezzaPx / altezza, 2);
            }

            ctx.VolantiniPagines.Add(pagina);
            pagineInserite[pagPack.numero] = pagina;
        }

        await ctx.SaveChangesAsync();
        esito.Pagine = pagineInserite.Count;

        // --- referenze (box) e loro campi ---
        var referenze = pack.Pacchetto.lista ?? new List<CorreggoSchemaCampiDellaRef>();

        foreach (var rif in referenze)
        {
            if (!pagineInserite.TryGetValue(rif.pag, out var pagina))
            {
                esito.Avvisi.Add($"Referenza su pagina {rif.pag}, che il pacchetto non contiene: saltata");
                continue;
            }

            string dnaGrezzo = "";
            string dnaGruppo = "";
            if (!string.IsNullOrWhiteSpace(rif.itemRefStringfied))
            {
                try
                {
                    var campi = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(rif.itemRefStringfied!);
                    if (campi != null)
                    {
                        // Chiavi cablate nell'originale (Worker.cs:1691-1692), che vi
                        // accede senza ContainsKey: una chiave mancante gli lancia.
                        if (campi.TryGetValue("Referenza.Codice", out var c)) dnaGrezzo = c.ToString();
                        if (campi.TryGetValue("Scatto.CodiceGruppo", out var g)) dnaGruppo = g.ToString();
                    }
                }
                catch (JsonException ex)
                {
                    esito.Avvisi.Add($"itemRefStringfied illeggibile per un box di pagina {rif.pag}: {ex.Message}");
                }
            }

            var azioni = rif.azioni ?? new List<CorreggoAzioneSullaRef>();
            string descrizione = azioni.FirstOrDefault(a => a.labelIndd == "descrizione")?.compiledValue ?? "";

            var dna = InterpreteDna.Interpreta(dnaGrezzo, dnaGruppo, descrizione);
            decimal[] rb = rif.bounds ?? new decimal[] { 0, 0, 0, 0 };

            var box = new VolantiniPagineElementi
            {
                IdPagina = pagina.Id,
                Tipo = TipoElementoBox,
                LabelInd = InterpreteDna.EtichettaDaCodice(dna.Codice),
                Basecode = dna.Codice,
                Dna = JsonSerializer.Serialize(new { codice = dna.Codice, gruppo = dna.Gruppo, descrizione = dna.Descrizione }),
                Contenuto = JsonSerializer.Serialize(rif),
                ZIndex = 0,
                PosizioneX = rb.Length == 4 ? rb[1] : 0,
                PosizioneY = rb.Length == 4 ? rb[0] : 0,
                Larghezza = rb.Length == 4 ? rb[3] - rb[1] : 0,
                Altezza = rb.Length == 4 ? rb[2] - rb[0] : 0
            };
            ctx.VolantiniPagineElementis.Add(box);
            await ctx.SaveChangesAsync();
            esito.Box++;

            // Campi figli: tutte le azioni tranne "base", una sola volta per label.
            var giaViste = new HashSet<string>();
            foreach (var azione in azioni)
            {
                string label = azione.labelIndd ?? "";
                if (label == "" || label == "base" || !giaViste.Add(label)) continue;

                decimal[] ab = azione.bounds ?? new decimal[] { 0, 0, 0, 0 };
                ctx.VolantiniPagineElementis.Add(new VolantiniPagineElementi
                {
                    IdPagina = pagina.Id,
                    IdParent = box.Id,
                    Tipo = TipoElementoCampo,
                    LabelInd = label,
                    // "Serve per rintracciarlo univocamente sulle propagazioni" (Worker.cs:1821)
                    Basecode = box.Basecode + "_" + label,
                    Contenuto = azione.compiledValue ?? "",
                    ZIndex = 0,
                    PosizioneX = ab.Length == 4 ? ab[1] : 0,
                    PosizioneY = ab.Length == 4 ? ab[0] : 0,
                    Larghezza = ab.Length == 4 ? ab[3] - ab[1] : 0,
                    Altezza = ab.Length == 4 ? ab[2] - ab[0] : 0
                });
                esito.Campi++;
            }

            await ctx.SaveChangesAsync();

            if (referenze.Count > 0)
            {
                vol.ProgressPubblicazione = (short)(10 + 90 * esito.Box / referenze.Count);
            }
        }

        vol.TotPubblicazioni = (short)(vol.TotPubblicazioni + 1);
        vol.Status = StatoVolantinoAperto;
        vol.ProgressPubblicazione = 0;
        vol.StatoPubblicazione = PubblicazioneCompletata;
        vol.UltimaPubblicazione = DateTime.UtcNow;   // l'originale se ne dimentica
        vol.DataPubblicazione ??= DateTime.UtcNow;
        await ctx.SaveChangesAsync();

        esito.Esito = true;
        log.LogInformation("Importato {Titolo} v{Ver}: {Pag} pagine, {Box} box, {Campi} campi",
                           titolo, versione.Versione, esito.Pagine, esito.Box, esito.Campi);
        return esito;
    }
}
