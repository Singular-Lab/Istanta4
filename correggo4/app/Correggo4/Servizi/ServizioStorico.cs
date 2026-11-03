using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models.Vista;
using ImageMagick;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// CONSULTA TUTTI I VOLANTINI (j213): lo "STORICO PUBBLICAZIONI" dell'originale (ftp.aspx?page=storico,
/// ftp.aspx.cs refreshListaStorico 194; report.html + Service.cs getReport 6969, getReportGlobale,
/// getReportOkVisto). Decisioni dell'11/9: tutti i ruoli, una riga per versione dalla piu' recente con filtro
/// e 50 righe per pagina; da ogni riga sola lettura, PDF, zip di piu' PDF, report delle correzioni.
///
/// Il PDF: Correggo4 lo salva all'arrivo dal j213 (EstrattorePagine); per le versioni arrivate prima si
/// ricompone dalle immagini delle pagine (150 DPI, come sono state estratte) e si tiene da parte.
/// </summary>
public sealed partial class ServizioStorico
{
    public const int RighePerPagina = 50;   // DataPager PageSize="50" (ftp.aspx)

    private readonly Correggo4Context ctx;
    private readonly EstrattorePagine estrattore;
    private readonly ServizioCorrezioni correzioni;
    private readonly ILogger<ServizioStorico> log;

    public ServizioStorico(Correggo4Context ctx, EstrattorePagine estrattore, ServizioCorrezioni correzioni, ILogger<ServizioStorico> log)
    {
        this.ctx = ctx; this.estrattore = estrattore; this.correzioni = correzioni; this.log = log;
    }

    // ------------------------------------------------------------------ elenco

    public async Task<StoricoPubblicazioni> ElencoAsync(string? cerca, int pagina)
    {
        var q = from vv in ctx.VolantiniVersionis.AsNoTracking()
                join v in ctx.Volantinis.AsNoTracking() on vv.IdVol equals v.Id
                where vv.Versione > 0 && v.Status == 1   // niente versioni revocate ne' volantini di prova nascosti
                select new { vv.IdVol, vv.Versione, vv.DataPubblicazione, v.Titolo, v.Classificazione };
        string filtro = (cerca ?? "").Trim();
        if (filtro != "")
        {
            string like = "%" + filtro.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            q = q.Where(x => EF.Functions.ILike(x.Titolo, like) || EF.Functions.ILike(x.Classificazione, like));
        }
        int totale = await q.CountAsync();
        int pagine = Math.Max(1, (int)Math.Ceiling(totale / (double)RighePerPagina));
        pagina = Math.Clamp(pagina, 1, pagine);
        var righe = await q.OrderByDescending(x => x.DataPubblicazione)
                           .Skip((pagina - 1) * RighePerPagina).Take(RighePerPagina).ToListAsync();

        var idVols = righe.Select(r => r.IdVol).Distinct().ToList();
        var ultime = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => idVols.Contains(p.IdVol) && p.Versione > 0)
            .GroupBy(p => p.IdVol).Select(g => new { IdVol = g.Key, Ultima = g.Max(p => p.Versione) })
            .ToDictionaryAsync(x => x.IdVol, x => x.Ultima);

        return new StoricoPubblicazioni
        {
            Cerca = filtro,
            Pagina = pagina,
            Pagine = pagine,
            Totale = totale,
            Voci = righe.Select(r => new VoceStorico
            {
                IdVolantino = r.IdVol,
                Titolo = r.Titolo,
                Classificazione = r.Classificazione,
                Versione = r.Versione,
                Pubblicata = FinestreCategory.Locale(r.DataPubblicazione),
                Ultima = ultime.TryGetValue(r.IdVol, out var u) && u == r.Versione
            }).ToList()
        };
    }

    // ------------------------------------------------------------------ PDF

    public async Task<(byte[]? Dati, string Nome, string? Errore)> PdfAsync(int idVol, short versione)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVol);
        if (vol == null || versione <= 0) return (null, "", "Volantino non trovato.");
        string cartella = estrattore.CartellaDi(vol.Classificazione, vol.Titolo);
        string nome = EstrattorePagine.NomePdf(vol.Titolo, versione);

        string originale = Path.Combine(cartella, nome);
        if (File.Exists(originale)) return (await File.ReadAllBytesAsync(originale), nome, null);

        string ricomposto = Path.Combine(cartella, Path.GetFileNameWithoutExtension(nome) + "_ricomposto.pdf");
        if (File.Exists(ricomposto)) return (await File.ReadAllBytesAsync(ricomposto), nome, null);

        var numeri = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVol && p.Versione == versione).OrderBy(p => p.Numero).Select(p => p.Numero).ToListAsync();
        var jpg = numeri.Select(n => Path.Combine(cartella, $"pag{n}_v{versione}.jpg")).Where(File.Exists).ToList();
        if (jpg.Count == 0) return (null, "", "Di questa versione non ci sono né il PDF né le pagine.");

        try
        {
            using var raccolta = new MagickImageCollection();
            foreach (string f in jpg)
            {
                var img = new MagickImage(f);
                img.Density = new Density(150, 150);   // la risoluzione di estrazione: la pagina torna alla sua misura
                raccolta.Add(img);
            }
            using var ms = new MemoryStream();
            raccolta.Write(ms, MagickFormat.Pdf);
            byte[] dati = ms.ToArray();
            try { await File.WriteAllBytesAsync(ricomposto, dati); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { log.LogWarning(ex, "PDF ricomposto non salvato"); }
            return (dati, nome, null);
        }
        catch (MagickException ex)
        {
            log.LogWarning(ex, "PDF di {Titolo} v{Ver} non ricomposto", vol.Titolo, versione);
            return (null, "", "Non è stato possibile ricomporre il PDF dalle pagine.");
        }
    }

    public async Task<(byte[]? Dati, string? Errore)> ZipAsync(IEnumerable<string> voci)
    {
        var scelte = voci.Select(v => v.Split(':')).Where(p => p.Length == 2
                            && int.TryParse(p[0], out _) && short.TryParse(p[1], out _))
                         .Select(p => (Id: int.Parse(p[0]), Ver: short.Parse(p[1]))).Distinct().Take(200).ToList();
        if (scelte.Count == 0) return (null, "Spunta almeno un volantino da scaricare.");
        using var ms = new MemoryStream();
        var nomi = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (id, ver) in scelte)
            {
                var (dati, nome, _) = await PdfAsync(id, ver);
                if (dati == null) continue;
                string n = nome; int k = 2;
                while (!nomi.Add(n)) n = Path.GetFileNameWithoutExtension(nome) + $"_{k++}.pdf";
                var voce = zip.CreateEntry(n, CompressionLevel.Fastest);
                await using var s = voce.Open();
                await s.WriteAsync(dati);
            }
        }
        return nomi.Count == 0 ? (null, "Nessuno dei volantini scelti ha un PDF disponibile.") : (ms.ToArray(), null);
    }

    // ------------------------------------------------------------------ report

    /// <summary>
    /// Report delle correzioni di una versione. Con idBox (j214) e' lo "Storico correzioni sulla referenza"
    /// dell'originale (getReportRef, reports.abilitaReport(id_ref)): tutte le versioni del volantino, solo le
    /// correzioni sui prodotti con lo stesso basecode di quel box, senza OK visto.
    /// </summary>
    public async Task<ReportCorrezioni?> ReportAsync(ServizioCorrezioni.Utente u, int idVol, short versione, bool tutte, bool okVisto,
                                                     long? idBox = null)
    {
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVol);
        if (vol == null) return null;
        var versioni = await ctx.VolantiniPagines.AsNoTracking().Where(p => p.IdVol == idVol && p.Versione > 0)
            .Select(p => p.Versione).Distinct().OrderByDescending(x => x).ToListAsync();
        if (versioni.Count == 0) return null;
        if (!versioni.Contains(versione)) versione = versioni[0];

        string? basecode = null;
        string etichettaProdotto = "";
        if (idBox != null)
        {
            var box = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                             join p in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals p.Id
                             where e.Id == idBox && e.IdParent == null && p.IdVol == idVol
                             select new { e.Basecode, p.Versione }).FirstOrDefaultAsync();
            if (box == null) return null;
            basecode = box.Basecode ?? "";
            etichettaProdotto = (await EtichetteAsync(idVol, box.Versione)).TryGetValue(idBox.Value, out var ep) ? ep.Etichetta : basecode;
            tutte = true;
            okVisto = false;
        }

        var report = new ReportCorrezioni
        {
            IdVolantino = idVol, Titolo = vol.Titolo, Classificazione = vol.Classificazione,
            Versione = versione, Versioni = versioni, Tutte = tutte, OkVisto = okVisto,
            Prodotto = idBox != null, IdBox = idBox, EtichettaProdotto = etichettaProdotto
        };

        foreach (short ver in tutte ? versioni.OrderBy(x => x).ToList() : new List<short> { versione })
        {
            var stato = await correzioni.CaricaAsync(idVol, u, ver);
            bool ultima = ver == versioni[0];
            var etichette = await EtichetteAsync(idVol, ver);
            var numeri = await ctx.VolantiniPagines.AsNoTracking().Where(p => p.IdVol == idVol && p.Versione == ver)
                                  .ToDictionaryAsync(p => p.Id, p => p.Numero);
            string Etichetta(long? id) => id != null && etichette.TryGetValue(id.Value, out var e) ? e.Etichetta : "Nessun prodotto";
            // Senza basecode (prodotto senza codice) vale solo lo stesso box.
            bool Tiene(long? id) => basecode == null
                || (id != null && (basecode == "" ? id == idBox
                                   : etichette.TryGetValue(id.Value, out var e) && e.Basecode == basecode));

            if (okVisto)
            {
                foreach (var o in stato.Ok)
                    report.Voci.Add(new VoceReport
                    {
                        Pagina = numeri.TryGetValue(o.IdPagina, out short np) ? np : (short)0, Versione = ver, Etichetta = Etichetta(o.IdBox), IdBox = o.IdBox, Tipo = "ok",
                        Dettagli = Data(o.Data) + " – " + o.Autore, Testo = "OK visto", Esito = "ok"
                    });
                continue;
            }

            foreach (var n in stato.Note.Where(n => Tiene(n.IdBox)))
                report.Voci.Add(new VoceReport
                {
                    Pagina = n.Pagina, Versione = ver, Etichetta = Etichetta(n.IdBox), IdBox = n.IdBox, Tipo = "nota",
                    Dettagli = Data(n.DataModifica ?? n.DataInserimento) + " – " + Autore(n.Autore, n.TipoAutore),
                    Testo = n.Testo,
                    Blocchi = new() { new BloccoReport { Titolo = "Nota:", Righe = { n.Testo } } },
                    Esito = EsitoNotaTimbro(n.Stato, ultima),
                    Chiusura = n.Stato == ServizioCorrezioni.StatoAccettata ? $"Accettata il {Data(n.DataCorrezione)} da {n.Correttore}" : ""
                });
            foreach (var t in stato.Timbri.Where(t => Tiene(t.IdBox)))
                report.Voci.Add(new VoceReport
                {
                    Pagina = t.Pagina, Versione = ver, Etichetta = Etichetta(t.IdBox), IdBox = t.IdBox, Tipo = "timbro",
                    Dettagli = Data(t.DataInserimento) + " – " + Autore(t.Autore, t.TipoAutore),
                    Testo = t.Nome, Simbolo = t.Simbolo,
                    // I20-1189: «Timbro:» e il simbolo; il nome resta nel suggerimento
                    Blocchi = new()
                    {
                        new BloccoReport
                        {
                            Titolo = "Timbro:", NomeSimbolo = t.Nome,
                            Simbolo = t.Simbolo + (t.Stato == ServizioCorrezioni.StatoAccettata ? "_ok" : "")
                        }
                    },
                    Esito = EsitoNotaTimbro(t.Stato, ultima),
                    Chiusura = t.Stato == ServizioCorrezioni.StatoAccettata ? $"Accettato il {Data(t.DataCorrezione)} da {t.Correttore}" : ""
                });
            foreach (var e in stato.Edit.Where(e => Tiene(e.IdBox)))
            {
                string riassunto = RiassuntoEdit(e);
                report.Voci.Add(new VoceReport
                {
                    Pagina = e.Pagina, Versione = ver, Etichetta = Etichetta(e.IdBox), IdBox = e.IdBox, Tipo = "edit",
                    Dettagli = Data(e.Data) + " – " + Autore(e.Autore, e.TipoAutore),
                    Testo = (e.Parte == ServizioCorrezioni.ParteOfferta ? "Edit avanzato, prezzi e azioni" : "Edit avanzato, descrizione, foto e loghi")
                            + (riassunto == "" ? "" : ": " + riassunto),
                    // Foto e loghi come miniature, come reports.js (thumbnailFico?width=50 + Primario/Secondario/...).
                    Foto = e.Foto.Where(f => f.GuidId != "").Select(f => new FotoReport { GuidId = f.GuidId, Testo = TestoFoto(f) }).ToList(),
                    Blocchi = BlocchiEdit(e),
                    Esito = e.Stato == ServizioCorrezioni.EaCorretto ? "accettata" : (ultima ? "attesa" : "irrisolta"),
                    Chiusura = e.Stato == ServizioCorrezioni.EaCorretto ? "Confermata dall'Agenzia" : ""
                });
            }
        }
        report.Voci = report.Voci.OrderBy(v => v.Versione).ThenBy(v => v.Pagina).ToList();
        return report;
    }

    /// <summary>
    /// Basecode dei prodotti con correzioni in un'altra versione del volantino (j214), per l'icona dello storico
    /// sui box (getPageRefsStorico: has_storico = contatore > 0, e il contatore passa da una versione all'altra,
    /// Worker.cs 1141). Le correzioni della versione aperta le aggiunge l'editor, cosi' l'icona segue le modifiche.
    /// </summary>
    public async Task<List<string>> BasecodeStoricoAsync(int idVol, short versione)
    {
        var pagine = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVol && p.Versione > 0 && p.Versione != versione).Select(p => p.Id).ToListAsync();
        if (pagine.Count == 0) return new();

        var ids = new List<long?>();
        ids.AddRange(await ctx.VolantiniPagineNotes.AsNoTracking()
            .Where(n => pagine.Contains(n.IdPagina) && n.Stato != ServizioCorrezioni.StatoEliminata && n.Stato != ServizioCorrezioni.StatoArchiviato)
            .Select(n => (long?)n.IdElemento).Distinct().ToListAsync());
        ids.AddRange(await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
            .Where(c => pagine.Contains(c.IdPagina) && c.Simbolo != "penna"
                        && c.Stato != ServizioCorrezioni.StatoEliminata && c.Stato != ServizioCorrezioni.StatoArchiviato)
            .Select(c => (long?)c.IdElemento).Distinct().ToListAsync());
        ids.AddRange(await (from v in ctx.VolantiniPagineElementiVersionis.AsNoTracking()
                            join e in ctx.VolantiniPagineElementis.AsNoTracking() on v.IdElemento equals e.Id
                            where pagine.Contains(e.IdPagina)
                                  && (v.Stato == ServizioCorrezioni.EaRegistrato || v.Stato == ServizioCorrezioni.EaCorretto)
                            select (long?)e.Id).Distinct().ToListAsync());
        var idElementi = ids.Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
        if (idElementi.Count == 0) return new();

        // Le correzioni di Edit avanzato stanno anche sui figli (descrizione, immagine): vale il basecode del box.
        var elementi = await ctx.VolantiniPagineElementis.AsNoTracking().Where(e => idElementi.Contains(e.Id))
            .Select(e => new { e.Id, IdParent = (long?)e.IdParent, e.Basecode }).ToListAsync();
        var idRadici = elementi.Where(x => x.IdParent != null).Select(x => x.IdParent!.Value).Distinct().ToList();
        var radici = idRadici.Count == 0 ? new List<string>()
            : await ctx.VolantiniPagineElementis.AsNoTracking().Where(e => idRadici.Contains(e.Id)).Select(e => e.Basecode).ToListAsync();

        return elementi.Where(x => x.IdParent == null).Select(x => x.Basecode).Concat(radici)
                       .Where(bc => !string.IsNullOrWhiteSpace(bc)).Distinct().OrderBy(bc => bc).ToList();
    }

    private static string EsitoNotaTimbro(short stato, bool ultima) =>
        stato == ServizioCorrezioni.StatoAccettata ? "accettata" : (ultima ? "attesa" : "irrisolta");

    private static string Autore(string nome, string tipo) => tipo == "" ? nome : $"{nome} ({tipo})";

    private static string Data(DateTime? d) =>
        d == null ? "" : FinestreCategory.Locale(d.Value).ToString("dd/MM/yyyy HH:mm");

    /// <summary>I20-1189: gli stessi nomi della scheda dell'Edit avanzato (ETICHETTE_EA in Dettaglio.cshtml).</summary>
    private static readonly Dictionary<string, string> NomiCampi = new()
    {
        ["prezzo_promo"] = "Prezzo Promo", ["prezzo_promo_kgl"] = "Prezzo al Kg/Lt", ["prezzo_continuo"] = "Prezzo Continuo",
        ["azione_pubblico"] = "Sconto", ["txt_sconto"] = "Sconto", ["tipo_offerta"] = "Tipo offerta",
        ["nome_evento"] = "Evento", ["note"] = "Note"
    };

    /// <summary>
    /// I20-1189: il nome leggibile di un campo. Quelli che la scheda non nomina si scrivono comunque in
    /// chiaro («n_pezzi_soci» diventa «N pezzi soci»), non piu' col nome tecnico.
    /// </summary>
    private static string NomeCampo(string chiave)
    {
        if (NomiCampi.TryGetValue(chiave, out var n)) return n;
        string chiaro = chiave.Replace('_', ' ').Replace('.', ' ').Trim();
        return chiaro.Length == 0 ? chiave : char.ToUpperInvariant(chiaro[0]) + chiaro[1..];
    }

    private static string StatoFoto(int stato) => stato switch
    {
        1 => "primaria", 2 => "secondaria", 3 => "non selezionata", _ => ""
    };

    /// <summary>
    /// I20-1189: l'Edit avanzato a pezzi, ognuno con la sua intestazione (richiesta dell'operatore del 03/11):
    /// prezzi cambiati, azioni, descrizione, foto (anche solo P/S), loghi inseriti e rimossi.
    /// </summary>
    public static List<BloccoReport> BlocchiEdit(EditVista e)
    {
        var blocchi = new List<BloccoReport>();
        var prezzi = e.Campi.Where(c => c.Key != "descrizione")
                            .Select(c => $"{NomeCampo(c.Key)}: {(c.Value == "" ? "vuoto" : c.Value)}").ToList();
        if (prezzi.Count > 0) blocchi.Add(new BloccoReport { Titolo = "Prezzo cambiato in:", Righe = prezzi });
        foreach (var a in e.Azioni)
            blocchi.Add(new BloccoReport
            {
                Titolo = "Azione:",
                Righe = { a.Titolo + (a.Campi.Count > 0 ? " (" + string.Join(", ", a.Campi.Select(c =>
                    $"{NomeCampo(c.Key)}: {(c.Value == "" ? "vuoto" : c.Value)}")) + ")" : "") }
            });
        if (e.Campi.TryGetValue("descrizione", out var descr))
            blocchi.Add(new BloccoReport { Titolo = "Descrizione modificata in:", Righe = { LettoreDescrizione.InChiaro(descr) } });

        var foto = e.Foto.Where(f => f.Stato is >= 1 and <= 3).ToList();
        if (foto.Count > 0)
        {
            var b = new BloccoReport { Titolo = "Foto cambiata in:" };
            foreach (var f in foto)
            {
                string testo = $"{f.Codice} – {StatoFoto(f.Stato)}";
                if (f.GuidId != "") b.Foto.Add(new FotoReport { GuidId = f.GuidId, Testo = testo });
                else b.Righe.Add(testo + " (senza foto)");
            }
            blocchi.Add(b);
        }
        foreach (var (stato, titolo) in new[] { (4, "Logo inserito:"), (5, "Logo rimosso:") })
        {
            var loghi = e.Foto.Where(f => f.Stato == stato).ToList();
            if (loghi.Count == 0) continue;
            var b = new BloccoReport { Titolo = titolo };
            foreach (var l in loghi)
            {
                if (l.GuidId != "") b.Foto.Add(new FotoReport { GuidId = l.GuidId, Testo = l.Codice });
                else b.Righe.Add(l.Codice);
            }
            blocchi.Add(b);
        }
        return blocchi;
    }

    /// <summary>Campi e azioni in una riga; foto e loghi vanno a parte, come miniature (j214).</summary>
    private static string RiassuntoEdit(EditVista e)
    {
        var pezzi = new List<string>();
        foreach (var (k, v) in e.Campi)
            pezzi.Add(k == "descrizione" ? "descrizione «" + LettoreDescrizione.InChiaro(v) + "»"
                                         : $"{(NomiCampi.TryGetValue(k, out var n) ? n : k)} {v}");
        foreach (var a in e.Azioni)
            pezzi.Add(a.Titolo + (a.Campi.Count > 0 ? " (" + string.Join(", ", a.Campi.Select(c =>
                $"{(NomiCampi.TryGetValue(c.Key, out var n) ? n : c.Key)}: {(c.Value == "" ? "vuoto" : c.Value)}")) + ")" : ""));
        foreach (var f in e.Foto.Where(f => f.GuidId == ""))
            pezzi.Add(TestoFoto(f));
        return string.Join("; ", pezzi);
    }

    private static string TestoFoto(FotoEditVista f) => f.Stato switch
    {
        1 => $"{f.Codice} – foto primaria",
        2 => $"{f.Codice} – foto secondaria",
        3 => $"{f.Codice} – foto non selezionata",
        4 => $"logo {f.Codice} – aggiunto",
        5 => $"logo {f.Codice} – tolto",
        _ => f.Codice
    };

    /// <summary>Etichetta "basecode – descrizione" (Helper.getLabelByReport) e basecode dei box di una versione.</summary>
    private async Task<Dictionary<long, (string Etichetta, string Basecode)>> EtichetteAsync(int idVol, short versione)
    {
        var box = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                         join p in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals p.Id
                         where p.IdVol == idVol && p.Versione == versione && e.IdParent == null
                         select new { e.Id, e.Basecode, e.Dna }).ToListAsync();
        var mappa = new Dictionary<long, (string, string)>();
        foreach (var b in box)
        {
            string descr = "";
            if (!string.IsNullOrWhiteSpace(b.Dna))
            {
                try
                {
                    using var d = JsonDocument.Parse(b.Dna);
                    if (d.RootElement.TryGetProperty("descrizione", out var de) && de.ValueKind == JsonValueKind.String)
                        descr = LettoreDescrizione.InChiaro(de.GetString());
                }
                catch (JsonException) { }
            }
            string bc = b.Basecode ?? "";
            mappa[b.Id] = (descr == "" ? bc : $"{bc} – {descr}", bc);
        }
        return mappa;
    }
}
