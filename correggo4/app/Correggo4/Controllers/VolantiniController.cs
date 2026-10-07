using System.Security.Claims;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Controllers;

// DEPRECATO (11/9/2026) - era il modello della vecchia home a tabella, sostituita dall'hub
// correzioni (HubVolantini, vedi Index qui sotto). Non la usa piu' nessuna vista compilata: il
// solo riferimento rimasto e' Views/Volantini/Index.cshtml.pre-hub, la copia della vecchia
// vista tenuta per il rollback, che non viene compilata per via dell'estensione.
// Da sapere se la si riattiva: la vecchia query contava in Pagine le pagine di TUTTE le
// versioni (32 righe su 6 volantini con 10 versioni), non quelle dell'ultima, e in Note
// tutte le note senza guardare lo stato. Per rimetterla basta ripristinare la vista
// .pre-hub e il corpo di Index dal file VolantiniController.cs.prima-j177.
public class RigaVolantino
{
    public int Id { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public DateTime ValiditaInizio { get; set; }
    public DateTime ValiditaFine { get; set; }
    public DateTime Scadenza { get; set; }
    public short Versione { get; set; }
    public int Pagine { get; set; }
    public int Box { get; set; }
    public int Note { get; set; }
}

[Authorize]
public class VolantiniController : Controller
{
    private readonly Correggo4Context ctx;
    private readonly IConfiguration config;
    private readonly ServizioCorrezioni correzioni;

    public VolantiniController(Correggo4Context ctx, IConfiguration config, ServizioCorrezioni correzioni)
    {
        this.ctx = ctx;
        this.config = config;
        this.correzioni = correzioni;
    }

    private short IdUtente =>
        short.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out short id) ? id : (short)0;

    /// <summary>
    /// Home: hub delle correzioni. Le promo sono le classificazioni; per ciascuna i PDF
    /// caricati (volantini) alla loro ultima versione, con correzioni aperte, commenti e blocco.
    /// </summary>
    public async Task<IActionResult> Index(bool scadute = false)
    {
        DateTime adesso = DateTime.UtcNow;
        DateTime oggi = adesso.Date;

        // Status 1 = volantino in esercizio (lo scrive ImportatorePack). Con status 0 si tolgono
        // dalla home i volantini di prova senza cancellarli: l'11/9 lo sono diventati "nazionale"
        // (id 2, pack sintetico del collaudo del 4/9) e "Speciale Freschi Settembre" (id 4, 5, 7,
        // prove di ingestione con lavorazione finta 4711). Rimettendo status = 1 ricompaiono.
        var vols = await ctx.Volantinis.AsNoTracking()
            .Where(v => v.Status == 1)
            .Select(v => new
            {
                v.Id, v.Titolo, v.Classificazione,
                v.DataValiditaInizio, v.DataValiditaFine, v.DataScadenza,
                v.DataPubblicazione, v.UltimaPubblicazione,
                v.IdAutoreBlocco, v.DataScadenzaBlocco
            })
            .ToListAsync();

        // Finestra dei Category (j209, come ftp.aspx.cs:102-160): un Category vede solo le promo con la
        // finestra impostata e aperta adesso. Marketing e Agenzia vedono tutto.
        var utenteHome = await correzioni.UtenteAsync(IdUtente);
        if (utenteHome?.TipoFico == ServizioCorrezioni.TipoFicoCategory)
        {
            var aperte = await FinestreCategory.ApertePerCategoryAsync(ctx, adesso);
            vols = vols.Where(v => aperte.Contains(v.Classificazione)).ToList();
        }

        // j237: `minVersion` della policy di correzione, come l'originale nella lista delle promo
        // (ftp.aspx.cs:139-142): chi ha una policy con minVersion vede solo i volantini che hanno
        // almeno una versione da quel numero in su. Senza policy non cambia niente.
        if (utenteHome != null)
        {
            var sotto = await correzioni.VolantiniSottoMinVersionAsync(
                utenteHome.Id, vols.Select(v => v.Id).ToList());
            if (sotto.Count > 0) vols = vols.Where(v => !sotto.Contains(v.Id)).ToList();
        }

        // L'ultima versione si legge dalle pagine, come fa Dettaglio: e' quella che l'editor apre.
        var pagine = await ctx.VolantiniPagines.AsNoTracking()
            .Select(p => new { p.Id, p.IdVol, p.Versione, p.Numero })
            .ToListAsync();

        // Stato 0 = nota appena inserita e non ancora lavorata (AggiungiNota scrive Stato = 0).
        // Gli altri valori non sono ancora portati: per ora "aperta" vuol dire Stato == 0.
        var note = await ctx.VolantiniPagineNotes.AsNoTracking()
            .Select(n => new { n.Id, n.IdPagina, n.Stato })
            .ToListAsync();

        // Anche i timbri sono correzioni: aperti finche' l'Agenzia non li accetta (stato 0).
        var timbriAperti = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
            .Where(c => c.Stato == ServizioCorrezioni.StatoNonVerificata && c.Simbolo != "penna")
            .GroupBy(c => c.IdPagina)
            .Select(g => new { IdPagina = g.Key, Quanti = g.Count() })
            .ToDictionaryAsync(x => x.IdPagina, x => x.Quanti);

        // E le correzioni di Edit avanzato non ancora confermate (j200): una per box e parte, contata
        // sulla riga "capo" (il box radice per l'offerta, l'elemento descrizione per la descrizione).
        // Dal j206 la parte descrizione comprende anche l'immagine: si conta una volta per box e parte.
        var righeEdit = await (from ver in ctx.VolantiniPagineElementiVersionis.AsNoTracking()
                               join elv in ctx.VolantiniPagineElementis.AsNoTracking() on ver.IdElemento equals elv.Id
                               where ver.Stato == ServizioCorrezioni.EaRegistrato
                               select new { elv.IdPagina, elv.Id, elv.IdParent, elv.LabelInd }).ToListAsync();
        var editAperte = righeEdit
            .Select(x => new
            {
                x.IdPagina,
                Radice = x.IdParent ?? x.Id,
                Descr = x.IdParent != null && (x.LabelInd == "descrizione" || x.LabelInd == "immagine")
            })
            .Distinct()
            .GroupBy(x => x.IdPagina)
            .ToDictionary(g => g.Key, g => g.Count());

        var messaggiPerNota = await ctx.VolantiniCorrezzioniMessaggisticas.AsNoTracking()
            .Where(m => m.IdNota != null)
            .GroupBy(m => m.IdNota!.Value)
            .Select(g => new { IdNota = g.Key, Quanti = g.Count() })
            .ToDictionaryAsync(x => x.IdNota, x => x.Quanti);

        var pdfs = new List<(string Classificazione, DateTime Scadenza, DateTime Inizio, DateTime Fine,
                              DateTime? Aggiornata, PdfHub Pdf)>();

        foreach (var v in vols)
        {
            var sue = pagine.Where(p => p.IdVol == v.Id).ToList();
            short versione = sue.Count > 0 ? sue.Max(p => p.Versione) : (short)0;
            var correnti = sue.Where(p => p.Versione == versione).OrderBy(p => p.Numero).ToList();
            var idCorrenti = correnti.Select(p => p.Id).ToHashSet();
            var noteCorrenti = note.Where(n => idCorrenti.Contains(n.IdPagina)).ToList();

            var (canale, area) = CanaleArea(v.Titolo, v.Classificazione);
            bool bloccato = v.IdAutoreBlocco != null && v.DataScadenzaBlocco > adesso;

            var pdf = new PdfHub
            {
                Id = v.Id,
                Titolo = v.Titolo,
                Canale = canale,
                Area = area,
                Versione = versione,
                Pagine = correnti.Count,
                Aperte = noteCorrenti.Count(n => n.Stato == 0)
                         + idCorrenti.Sum(idp => timbriAperti.TryGetValue(idp, out int q) ? q : 0)
                         + idCorrenti.Sum(idp => editAperte.TryGetValue(idp, out int q) ? q : 0),
                Commenti = noteCorrenti.Sum(n => messaggiPerNota.TryGetValue(n.Id, out int q) ? q : 0),
                // L'approvazione non e' ancora portata in Correggo4: nessun volantino risulta
                // approvato finche' non esiste il dato. La vista sa gia' disegnare lo stato.
                Stato = bloccato ? "bloccato" : "lavorazione",
                BloccoMinuti = bloccato
                    ? (int)Math.Ceiling((v.DataScadenzaBlocco!.Value - adesso).TotalMinutes)
                    : null,
                Miniatura = correnti.Count == 0 ? "" :
                    Indirizzi.Con(HttpContext, "/volantini/" + Uri.EscapeDataString(v.Classificazione) + "/" +
                    Uri.EscapeDataString(v.Titolo) + $"/thumbs/pag{correnti[0].Numero}_{versione}.jpg")
            };

            pdfs.Add((v.Classificazione, v.DataScadenza, v.DataValiditaInizio, v.DataValiditaFine,
                      v.UltimaPubblicazione ?? v.DataPubblicazione, pdf));
        }

        // Una promo e' attiva finche' e' valida: almeno un suo PDF ha la fine validita' da oggi in
        // poi. Le promo che devono ancora cominciare restano visibili (si correggono prima).
        // Non si usa data_scadenza: nei dati veri cade PRIMA dell'inizio validita' (AP142026 - Demo:
        // validita' 01/11-31/12, scadenza 31/10), quindi e' un'altra scadenza, non la fine della promo.
        var gruppi = pdfs.GroupBy(x => x.Classificazione).ToList();
        var attive = gruppi.Where(g => g.Any(x => x.Fine >= oggi)).ToList();

        var modello = new HubVolantini
        {
            NomeUtente = User.Identity?.Name ?? "",
            PuoCorreggere = User.IsInRole(Ruoli.Gdo),
            NotificheNonLette = await ctx.Notifiches.CountAsync(n => n.IdUtente == IdUtente && n.DataLettura == null),
            // j243: stato iniziale dell'interruttore delle email. Nessuna riga = attive.
            EmailNotifiche = await ctx.Impostazioni.AsNoTracking()
                .Where(x => x.IdUtente == IdUtente).Select(x => (bool?)x.EmailNotifiche)
                .FirstOrDefaultAsync() ?? true,
            LogoCliente = config["Cliente:LogoUrl"] ?? "",
            MostraScadute = scadute,
            PromoScadute = gruppi.Count - attive.Count,
            Promo = (scadute ? gruppi : attive)
                .Select(g => new PromoHub
                {
                    Classificazione = g.Key,
                    ValiditaInizio = g.Min(x => x.Inizio),
                    ValiditaFine = g.Max(x => x.Fine),
                    Aggiornata = g.Max(x => x.Aggiornata),
                    Volantini = g.Select(x => x.Pdf).OrderBy(p => p.Titolo).ToList()
                })
                .OrderByDescending(p => p.Aggiornata)
                .ToList()
        };

        return View(modello);
    }

    /// <summary>
    /// Canale e area dal titolo, convenzione "&lt;promo&gt;_&lt;canale&gt;_&lt;area&gt;":
    /// "AP142026 - Demo_FAM-FI_TOS" -> ("FAM-FI", "TOS"). Un solo pezzo dopo la promo e'
    /// il canale. Un titolo che non comincia con "&lt;promo&gt;_" (es. "SCFI_14_09_26" nella
    /// promo "Speciale Freschi Settembre") non dice nulla: canale e area restano vuoti.
    /// </summary>
    internal static (string Canale, string Area) CanaleArea(string titolo, string classificazione)
    {
        string prefisso = classificazione + "_";
        if (!titolo.StartsWith(prefisso, StringComparison.Ordinal) || titolo.Length == prefisso.Length)
            return ("", "");

        var parti = titolo[prefisso.Length..].Split('_', StringSplitOptions.RemoveEmptyEntries);
        return parti.Length switch
        {
            0 => ("", ""),
            1 => (parti[0], ""),
            _ => (string.Join("_", parti[..^1]), parti[^1])
        };
    }

    /// <summary>
    /// LA LETTURA AFFIANCATA (j322): tutto il volantino a coppie di pagine, in una finestra nuova.
    ///
    /// Michele, 01/10: «fallo funzionare». E' il libro nella testa del pannello delle pagine, che
    /// fino a ieri era solo un'immagine senza niente attaccato.
    ///
    /// Nel Correggo vecchio era una pagina a parte (LetturaAffiancata.aspx), aperta con
    /// target="_blank": la copertina da sola a destra, poi 2|3, 4|5, una riga nera fra una coppia
    /// e l'altra, le immagini grandi larghe meta' finestra. Niente strumenti e niente correzioni:
    /// si guarda e basta. Qui uguale.
    ///
    /// DUE DIFFERENZE, volute:
    ///   1. il vecchio PERDEVA L'ULTIMA PAGINA quando le pagine erano in numero pari (il suo ciclo
    ///      si fermava a «i &lt; Count»): con 4 pagine mostrava copertina, 2 e 3. Qui si arriva in
    ///      fondo davvero.
    ///   2. il vecchio non controllava niente: qui vale la stessa regola del Dettaglio, cioe' un
    ///      Category fuori dalla sua finestra non entra. E' la stessa immagine del volantino, non
    ///      c'e' motivo di darla da una porta di servizio.
    /// </summary>
    public async Task<IActionResult> Affiancata(int id)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (vol == null) return NotFound();

        var utenteAff = await correzioni.UtenteAsync(IdUtente);
        if (utenteAff?.TipoFico == ServizioCorrezioni.TipoFicoCategory
            && !FinestreCategory.Aperta(await FinestreCategory.LeggiAsync(ctx, vol.Classificazione), DateTime.UtcNow))
        {
            TempData["Avviso"] = $"La promo {vol.Classificazione} non è aperta ai Category in questo momento.";
            return RedirectToAction(nameof(Index));
        }

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == id)
                            .MaxAsync(p => (short?)p.Versione) ?? 0;
        var numeri = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == id && p.Versione == versione)
            .OrderBy(p => p.Numero)
            .Select(p => p.Numero)
            .ToListAsync();

        // la stessa radice che usa il Dettaglio per le immagini delle pagine
        string radice = Indirizzi.Con(HttpContext, "/volantini/" + Uri.EscapeDataString(vol.Classificazione)
                        + "/" + Uri.EscapeDataString(vol.Titolo) + "/");
        PaginaAffiancata Pagina(short n) =>
            new() { Numero = n, Url = radice + $"pag{n}_v{versione}.jpg" };

        var vista = new VistaAffiancata
        {
            IdVolantino = id,
            Titolo = vol.Titolo,
            Promo = vol.Classificazione,
            Versione = versione
        };

        if (numeri.Count > 0)
        {
            // la copertina sta da sola a destra: e' cosi' che si apre un volantino
            vista.Coppie.Add(new CoppiaAffiancata { Sinistra = null, Destra = Pagina(numeri[0]) });
            for (int i = 1; i < numeri.Count; i += 2)
            {
                vista.Coppie.Add(new CoppiaAffiancata
                {
                    Sinistra = Pagina(numeri[i]),
                    Destra = i + 1 < numeri.Count ? Pagina(numeri[i + 1]) : null
                });
            }
        }

        return View(vista);
    }

    public async Task<IActionResult> Dettaglio(int id, [FromServices] ServizioStorico servizioStorico, short? v = null)
    {
        // ?v= arriva da "Consulta tutti i volantini" (j213): sola lettura, anche per i Category fuori finestra
        // (lo storico dell'originale non guardava la policy).
        bool storico = v != null;
        var vol = await ctx.Volantinis.FirstOrDefaultAsync(v => v.Id == id);
        if (vol == null) return NotFound();

        // Category fuori finestra: non entra (Main.aspx.cs:165-201 lo rimandava alla lista).
        var utenteEditor = await correzioni.UtenteAsync(IdUtente);
        if (!storico && utenteEditor?.TipoFico == ServizioCorrezioni.TipoFicoCategory
            && !FinestreCategory.Aperta(await FinestreCategory.LeggiAsync(ctx, vol.Classificazione), DateTime.UtcNow))
        {
            TempData["Avviso"] = $"La promo {vol.Classificazione} non è aperta ai Category in questo momento.";
            return RedirectToAction(nameof(Index));
        }

        short ultimaVersione = await ctx.VolantiniPagines.Where(p => p.IdVol == id)
                            .MaxAsync(p => (short?)p.Versione) ?? 0;
        short versione = v is > 0 && await ctx.VolantiniPagines.AnyAsync(p => p.IdVol == id && p.Versione == v)
                         ? v.Value : ultimaVersione;

        var modello = new VolantinoInCorrezione
        {
            Id = vol.Id,
            Titolo = vol.Titolo,
            Classificazione = vol.Classificazione,
            Versione = versione,
            SolaLettura = storico,
            UltimaVersione = ultimaVersione,
            ValiditaInizio = vol.DataValiditaInizio,
            ValiditaFine = vol.DataValiditaFine,
            Scadenza = vol.DataScadenza,
            // Miniature lette dal server (FotoController): prima Olimpo:ThumbUrl non era configurato
            // e le foto della scheda non si vedevano.
            UrlFoto = config["Olimpo:ThumbUrl"] is { Length: > 0 } thumb ? thumb : Indirizzi.Con(HttpContext, "/Foto/Miniatura")
        };

        var pagine = await ctx.VolantiniPagines
            .Where(p => p.IdVol == id && p.Versione == versione)
            .OrderBy(p => p.Numero).ToListAsync();

        var idPagine = pagine.Select(p => p.Id).ToList();

        var elementi = await ctx.VolantiniPagineElementis
            .Where(e => idPagine.Contains(e.IdPagina))
            .OrderBy(e => e.Id).ToListAsync();

        // Le note eliminate (stato 2) e archiviate (5) non si mostrano piu'.
        var note = await (from n in ctx.VolantiniPagineNotes
                          where idPagine.Contains(n.IdPagina)
                                && n.Stato != ServizioCorrezioni.StatoEliminata
                                && n.Stato != ServizioCorrezioni.StatoArchiviato
                          join u in ctx.Utentis on n.IdAutore equals u.Id into aut
                          from u in aut.DefaultIfEmpty()
                          select new
                          {
                              n.Id, n.IdElemento, n.Descrizione, n.Stato, n.DataInserimento,
                              n.Posx, n.Posy,
                              Autore = u != null ? u.Nome + " " + u.Cognome : "—"
                          }).ToListAsync();

        string radice = Indirizzi.Con(HttpContext, "/volantini/" + Uri.EscapeDataString(vol.Classificazione)
                        + "/" + Uri.EscapeDataString(vol.Titolo) + "/");

        foreach (var p in pagine)
        {
            var pc = new PaginaCorrezione
            {
                Id = p.Id,
                Numero = p.Numero,
                Larghezza = p.Larghezza,
                Altezza = p.Altezza,
                UrlImmagine = radice + $"pag{p.Numero}_v{versione}.jpg",
                UrlMiniatura = radice + $"thumbs/pag{p.Numero}_{versione}.jpg"
            };

            foreach (var e in elementi.Where(x => x.IdPagina == p.Id && x.IdParent == null))
            {
                var box = new BoxReferenza
                {
                    Id = e.Id,
                    Basecode = e.Basecode,
                    X = e.PosizioneX,
                    Y = e.PosizioneY,
                    Larghezza = e.Larghezza,
                    Altezza = e.Altezza
                };

                if (!string.IsNullOrWhiteSpace(e.Dna))
                {
                    try
                    {
                        using var d = JsonDocument.Parse(e.Dna);
                        if (d.RootElement.TryGetProperty("gruppo", out var g)) box.Gruppo = g.GetString();
                        if (d.RootElement.TryGetProperty("descrizione", out var de))
                            box.Descrizione = LettoreDescrizione.Leggi(de.GetString());
                    }
                    catch (JsonException) { }
                }

                // Campi figli: prezzo_promo, txt_sconto, prezzo_continuo, descrizione, immagine
                foreach (var f in elementi.Where(x => x.IdParent == e.Id))
                {
                    box.Figli[f.LabelInd] = new[] { (double)f.PosizioneX, (double)f.PosizioneY,
                                                    (double)f.Larghezza, (double)f.Altezza };
                    if (f.LabelInd == "descrizione") box.DescrizioneGrezza = f.Contenuto;
                    if (f.LabelInd == "immagine")
                    {
                        box.GuidFoto = f.Contenuto;
                        continue;
                    }
                    if (f.LabelInd == "descrizione")
                    {
                        if (box.Descrizione.Count == 0)
                            box.Descrizione = LettoreDescrizione.Leggi(f.Contenuto);
                        continue;
                    }
                    box.Campi.Add(new CampoReferenza { Etichetta = f.LabelInd, Valore = f.Contenuto });
                }

                // Lo schema completo della referenza, come e' arrivato nel pack.
                if (!string.IsNullOrWhiteSpace(e.Contenuto))
                {
                    try
                    {
                        using var d = JsonDocument.Parse(e.Contenuto);
                        if (d.RootElement.TryGetProperty("boxName", out var bn))
                            box.NomeBox = bn.GetString() ?? "";

                        if (d.RootElement.TryGetProperty("itemRefStringfied", out var irs))
                        {
                            string? interno = irs.GetString();
                            if (!string.IsNullOrWhiteSpace(interno))
                            {
                                using var d2 = JsonDocument.Parse(interno);
                                foreach (var prop in d2.RootElement.EnumerateObject())
                                    box.Tracciato.Add(new CampoReferenza
                                    {
                                        Etichetta = prop.Name,
                                        Valore = prop.Value.ToString()
                                    });
                            }
                        }

                        if (d.RootElement.TryGetProperty("azioni", out var az) &&
                            az.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var a in az.EnumerateArray())
                                if (a.TryGetProperty("titolo", out var t))
                                {
                                    string? titolo = t.GetString();
                                    if (!string.IsNullOrWhiteSpace(titolo) && !box.Azioni.Contains(titolo))
                                        box.Azioni.Add(titolo);
                                }
                        }
                    }
                    catch (JsonException) { }
                }

                // Edit avanzato (j200): cosa si puo' correggere su questo prodotto.
                box.Schema = SchemaReferenza.Leggi(e.Contenuto)?.Azioni ?? new();

                if (string.IsNullOrWhiteSpace(box.NomeBox)) box.NomeBox = e.LabelInd;

                foreach (var n in note.Where(n => n.IdElemento == e.Id).OrderBy(n => n.Id))
                    box.Note.Add(new NotaSuBox
                    {
                        Id = n.Id, Descrizione = n.Descrizione, Autore = n.Autore,
                        Data = n.DataInserimento, Stato = n.Stato,
                        Posx = n.Posx, Posy = n.Posy
                    });

                pc.Box.Add(box);
            }

            modello.Pagine.Add(pc);
        }

        // Note, timbri e OK visto come li usa l'editor (disegnati lato client, aggiornati via
        // /Correzioni/... senza ricaricare la pagina).
        var utente = await correzioni.UtenteAsync(IdUtente);
        if (utente != null)
        {
            modello.Correzioni = await correzioni.CaricaAsync(id, utente, versione);
            modello.Correzioni.BasecodeStorico = await servizioStorico.BasecodeStoricoAsync(id, versione);
            if (storico)
            {
                modello.Correzioni.SolaLettura = true;
                modello.Correzioni.PuoScrivere = false;
                modello.Correzioni.PuoAccettare = false;
            }
        }

        return View(modello);
    }

    // DEPRECATO (11/9/2026) - era il form "Note" della modale dell'editor, con ricarica della pagina.
    // Dal 11/9 l'editor salva le note con POST /Correzioni/Nota (CorrezioniController ->
    // ServizioCorrezioni), che applica le regole vere. Nessuna vista lo chiama piu'.
    // Da sapere se lo si riattiva: qui NON si controllano blocco, scadenza, versione superata,
    // appartenenza del box alla pagina ne' il tipo dell'utente; la nota nasce con tipo 1 e
    // data_modifica nulla, quindi e' accettabile subito (niente 5 minuti). Chiunque abbia ruolo GDO
    // e un token antiforgery valido puo' ancora usarlo.
    [HttpPost]
    [Authorize(Roles = Ruoli.Gdo)]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AggiungiNota(int idVolantino, long idElemento,
                                                  string descrizione, double posx, double posy,
                                                  short pagina = 0)
    {
        if (string.IsNullOrWhiteSpace(descrizione))
            return LocalRedirect(Url.Content($"~/Volantini/Dettaglio/{idVolantino}?pag={pagina}"));

        var elemento = await ctx.VolantiniPagineElementis.FirstOrDefaultAsync(e => e.Id == idElemento);
        if (elemento == null) return NotFound();

        ctx.VolantiniPagineNotes.Add(new VolantiniPagineNote
        {
            IdPagina = elemento.IdPagina,
            IdElemento = elemento.Id,
            Tipo = 1,
            Descrizione = descrizione.Trim(),
            Posx = posx,
            Posy = posy,
            Stato = 0,
            IdAutore = IdUtente,
            DataInserimento = DateTime.UtcNow
        });

        await ctx.SaveChangesAsync();
        return LocalRedirect(Url.Content($"~/Volantini/Dettaglio/{idVolantino}?pag={pagina}&box={idElemento}"));
    }
}
