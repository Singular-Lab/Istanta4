using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// "Gestisci promo" dell'Agenzia (j209). Dal pannello GESTISCI PROMO di Home.aspx dell'originale, tolto il
/// caricamento dei volantini (in Correggo4 arrivano da fidelity/InDesign):
///  - finestra dei Category per la promo (Service.cs setFinestraTemporale 660-744);
///  - date del volantino, con "estendi a tutta la promo" (Home.aspx.cs b_pubb_edit_Click 523-667): vale
///    l'ultima modifica, un reinvio da fidelity le sovrascrive;
///  - blocco e sblocco di un volantino o della promo, un'ora (Service.cs bloccaVolantino 8075, bloccaPromo 8036);
///  - revoca dell'ultima versione (Service.cs revocaVol 54), con l'elenco delle correzioni che si archiviano.
/// Blocco, date e revoca avvisano gli altri utenti con una riga in notifiche, come l'originale.
/// </summary>
public sealed class ServizioPromo
{
    public const int MinutiBlocco = 60;   // Service.cs:8075, data_scadenza_blocco = now + 1 ora

    private readonly Correggo4Context ctx;
    private readonly ServizioCorrezioni correzioni;
    private readonly EstrattorePagine estrattore;

    public ServizioPromo(Correggo4Context ctx, ServizioCorrezioni correzioni, EstrattorePagine estrattore)
    {
        this.ctx = ctx;
        this.correzioni = correzioni;
        this.estrattore = estrattore;
    }

    // ------------------------------------------------------------------ lettura

    public async Task<GestionePromo> CaricaAsync(string? promo)
    {
        var adesso = DateTime.UtcNow;
        var vols = await ctx.Volantinis.AsNoTracking().Where(v => v.Status == 1).ToListAsync();
        var modello = new GestionePromo
        {
            Promo = vols.GroupBy(v => v.Classificazione)
                        .OrderByDescending(g => g.Max(v => v.DataValiditaInizio))
                        .Select(g => g.Key).ToList()
        };
        if (string.IsNullOrWhiteSpace(promo) || !modello.Promo.Contains(promo))
            return modello;

        modello.Scelta = promo;
        var f = await FinestreCategory.LeggiAsync(ctx, promo);
        if (f != null)
        {
            modello.FinestraInizio = FinestreCategory.Locale(f.DataInizio);
            modello.FinestraFine = FinestreCategory.Locale(f.DataFine);
            modello.FinestraStato = FinestreCategory.Aperta(f, adesso) ? "aperta"
                                  : adesso < f.DataInizio ? "da_aprire" : "chiusa";
        }

        var suoi = vols.Where(v => v.Classificazione == promo).OrderBy(v => v.Titolo).ToList();
        var idVols = suoi.Select(v => v.Id).ToList();
        var versioni = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => idVols.Contains(p.IdVol) && p.Versione > 0)
            .GroupBy(p => p.IdVol)
            .Select(g => new { IdVol = g.Key, Ultima = g.Max(p => p.Versione), Quante = g.Select(p => p.Versione).Distinct().Count() })
            .ToDictionaryAsync(x => x.IdVol);
        var nomi = await ctx.Utentis.AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Nome + " " + u.Cognome);

        foreach (var v in suoi)
        {
            bool bloccato = ServizioCorrezioni.Bloccato(v, adesso);
            versioni.TryGetValue(v.Id, out var ver);
            modello.Volantini.Add(new VolantinoGestito
            {
                Id = v.Id,
                Titolo = v.Titolo,
                Versione = ver?.Ultima ?? 0,
                Revocabile = ver != null && ver.Quante > 1,
                ValiditaInizio = FinestreCategory.Locale(v.DataValiditaInizio).Date,
                ValiditaFine = FinestreCategory.Locale(v.DataValiditaFine).Date,
                Scadenza = FinestreCategory.Locale(v.DataScadenza).Date,
                Bloccato = bloccato,
                BloccoMinuti = bloccato ? (int)Math.Ceiling((v.DataScadenzaBlocco!.Value - adesso).TotalMinutes) : null,
                BloccatoDa = bloccato && v.IdAutoreBlocco != null && nomi.TryGetValue(v.IdAutoreBlocco.Value, out var n) ? n : ""
            });
        }
        return modello;
    }

    // ------------------------------------------------------------------ finestra

    public async Task<string?> SalvaFinestraAsync(ServizioCorrezioni.Utente u, string? promo, DateTime? inizio, DateTime? fine)
    {
        if (!u.Accetta) return "Solo l'Agenzia gestisce le promo.";
        if (string.IsNullOrWhiteSpace(promo) || !await ctx.Volantinis.AnyAsync(v => v.Classificazione == promo))
            return "Promo non trovata.";
        if (inizio == null || fine == null) return "Indica inizio e fine della finestra.";
        var i = FinestreCategory.Utc(inizio.Value);
        var f = FinestreCategory.Utc(fine.Value);
        if (f <= i) return "La fine della finestra deve venire dopo l'inizio.";   // Service.cs:690

        var riga = await ctx.VolantiniFinestreCategories.FirstOrDefaultAsync(x => x.Classificazione == promo);
        if (riga == null)
        {
            riga = new VolantiniFinestreCategory { Classificazione = promo };
            ctx.VolantiniFinestreCategories.Add(riga);
        }
        riga.DataInizio = i;
        riga.DataFine = f;
        riga.IdAutore = u.Id;
        riga.DataModifica = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        return null;
    }

    // ------------------------------------------------------------------ date

    public async Task<string?> SalvaDateAsync(ServizioCorrezioni.Utente u, int idVol, DateTime? inizio, DateTime? fine,
                                             DateTime? scadenza, bool estendi)
    {
        if (!u.Accetta) return "Solo l'Agenzia gestisce le promo.";
        var vol = await ctx.Volantinis.FirstOrDefaultAsync(v => v.Id == idVol);
        if (vol == null) return "Volantino non trovato.";
        if (inizio == null || fine == null || scadenza == null) return "Indica tutte e tre le date.";
        if (fine.Value.Date < inizio.Value.Date) return "La fine validità non può venire prima dell'inizio.";

        // Inizio alle 00:00, fine e invio previsto alle 23:59 (Home.aspx.cs:470-480), ora italiana.
        var dInizio = FinestreCategory.Utc(inizio.Value.Date);
        var dFine = FinestreCategory.Utc(fine.Value.Date.AddDays(1).AddSeconds(-1));
        var dScadenza = FinestreCategory.Utc(scadenza.Value.Date.AddDays(1).AddSeconds(-1));

        var coinvolti = estendi
            ? await ctx.Volantinis.Where(v => v.Classificazione == vol.Classificazione && v.Status == 1).ToListAsync()
            : new List<Volantini> { vol };
        var cambiati = new List<int>();
        foreach (var v in coinvolti)
        {
            if (v.DataValiditaInizio == dInizio && v.DataValiditaFine == dFine && v.DataScadenza == dScadenza) continue;
            v.DataValiditaInizio = dInizio;
            v.DataValiditaFine = dFine;
            v.DataScadenza = dScadenza;
            cambiati.Add(v.Id);
        }
        if (cambiati.Count == 0) return "Le date sono già queste: niente da salvare.";
        await NotificaAsync(u, cambiati, "date");
        await ctx.SaveChangesAsync();
        return null;
    }

    // ------------------------------------------------------------------ blocco

    public async Task<string?> BloccoAsync(ServizioCorrezioni.Utente u, int? idVol, string? promo, bool blocca)
    {
        if (!u.Accetta) return "Solo l'Agenzia gestisce le promo.";
        List<Volantini> vols;
        if (idVol != null)
            vols = await ctx.Volantinis.Where(v => v.Id == idVol).ToListAsync();
        else if (!string.IsNullOrWhiteSpace(promo))
            vols = await ctx.Volantinis.Where(v => v.Classificazione == promo && v.Status == 1).ToListAsync();
        else
            vols = new();
        if (vols.Count == 0) return "Volantino o promo non trovati.";

        var adesso = DateTime.UtcNow;
        foreach (var v in vols)
        {
            if (blocca)
            {
                v.IdAutoreBlocco = u.Id;
                v.DataRegistrazioneBlocco = adesso;
                v.DataScadenzaBlocco = adesso.AddMinutes(MinutiBlocco);
            }
            else
            {
                v.IdAutoreBlocco = null;
                v.DataScadenzaBlocco = null;
            }
        }
        await NotificaAsync(u, vols.Select(v => v.Id).ToList(), blocca ? "blocco" : "sblocco");
        await ctx.SaveChangesAsync();
        return null;
    }

    // ------------------------------------------------------------------ revoca

    public async Task<(RevocaVersione? Anteprima, string? Errore)> AnteprimaRevocaAsync(ServizioCorrezioni.Utente u, int idVol)
    {
        if (!u.Accetta) return (null, "Solo l'Agenzia gestisce le promo.");
        var vol = await ctx.Volantinis.AsNoTracking().FirstOrDefaultAsync(v => v.Id == idVol);
        if (vol == null) return (null, "Volantino non trovato.");
        var versioni = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVol && p.Versione > 0).Select(p => p.Versione).Distinct().OrderByDescending(x => x).ToListAsync();
        if (versioni.Count < 2) return (null, "Questo volantino ha una sola versione: non c'è una versione precedente a cui tornare.");

        // Le correzioni che l'editor mostra oggi sono proprio quelle dell'ultima versione.
        var stato = await correzioni.CaricaAsync(idVol, u);
        return (new RevocaVersione
        {
            IdVolantino = vol.Id,
            Titolo = vol.Titolo,
            Classificazione = vol.Classificazione,
            Versione = versioni[0],
            Precedente = versioni[1],
            Correzioni = stato
        }, null);
    }

    public async Task<string?> RevocaAsync(ServizioCorrezioni.Utente u, int idVol, short versione)
    {
        var (ant, errore) = await AnteprimaRevocaAsync(u, idVol);
        if (errore != null) return errore;
        if (ant!.Versione != versione)
            return $"Nel frattempo è cambiata l'ultima versione (ora è la {ant.Versione}): ricontrolla prima di revocare.";

        var pagine = await ctx.VolantiniPagines.Where(p => p.IdVol == idVol && p.Versione == versione).ToListAsync();
        var idPagine = pagine.Select(p => p.Id).ToList();

        await using var tx = await ctx.Database.BeginTransactionAsync();

        // 1. le correzioni della versione revocata si archiviano (decisione dell'11/9: prima si mostrano)
        var adesso = DateTime.UtcNow;
        foreach (var n in await ctx.VolantiniPagineNotes.Where(n => idPagine.Contains(n.IdPagina)
                     && n.Stato != ServizioCorrezioni.StatoEliminata && n.Stato != ServizioCorrezioni.StatoArchiviato).ToListAsync())
        {
            n.Stato = ServizioCorrezioni.StatoArchiviato;
            n.DataModifica = adesso;
        }
        foreach (var c in await ctx.VolantiniPagineDisegniComposizionis.Where(c => idPagine.Contains(c.IdPagina)
                     && c.Stato != ServizioCorrezioni.StatoEliminata && c.Stato != ServizioCorrezioni.StatoArchiviato).ToListAsync())
            c.Stato = ServizioCorrezioni.StatoArchiviato;
        var idElementi = await ctx.VolantiniPagineElementis.Where(e => idPagine.Contains(e.IdPagina)).Select(e => e.Id).ToListAsync();
        foreach (var r in await ctx.VolantiniPagineElementiVersionis.Where(r => idElementi.Contains(r.IdElemento)
                     && (r.Stato == ServizioCorrezioni.EaRegistrato || r.Stato == ServizioCorrezioni.EaCorretto)).ToListAsync())
            r.Stato = ServizioCorrezioni.EaAnnullato;

        // 2. la versione esce di scena. L'originale le dava versione 0; qui un numero negativo sempre
        //    nuovo, perche' (id_vol, versione) e (id_vol, numero, versione) sono unici. Un reinvio da
        //    fidelity riprende la numerazione dall'ultima versione valida.
        short minimo = await ctx.VolantiniVersionis.Where(v => v.IdVol == idVol).MinAsync(v => (short?)v.Versione) ?? 0;
        short minPag = await ctx.VolantiniPagines.Where(p => p.IdVol == idVol).MinAsync(p => (short?)p.Versione) ?? 0;
        short revocata = (short)(Math.Min((short)0, Math.Min(minimo, minPag)) - 1);
        foreach (var p in pagine) p.Versione = revocata;
        var riga = await ctx.VolantiniVersionis.FirstOrDefaultAsync(v => v.IdVol == idVol && v.Versione == versione);
        if (riga != null)
        {
            riga.Versione = revocata;
            riga.DataChiusura ??= adesso;
            riga.DaRevocare = true;
        }
        await ctx.SaveChangesAsync();

        // 3. la precedente torna aperta
        var prec = await ctx.VolantiniVersionis.FirstOrDefaultAsync(v => v.IdVol == idVol && v.Versione == ant.Precedente);
        if (prec != null) prec.DataChiusura = null;

        await NotificaAsync(u, new List<int> { idVol }, "revoca");
        await ctx.SaveChangesAsync();
        await tx.CommitAsync();
        return null;
    }

    // ------------------------------------------------------------------ aggiornamento da fidelity

    /// <summary>
    /// Promo/AggiornaDaFidelity, l'UpdateVolData.ashx dell'originale (I20-1076): fidelity-promotion ha
    /// modificato la promo e Correggo4
    /// si allinea. Tocca tutti i volantini della promo (volantini.id_promo_fp, che nell'originale era
    /// "$guid" dentro descrizione) e aggiorna solo i campi ricevuti: fidelity manda le date e il nome solo
    /// se li ha. Senza volantini risponde "volantino_non_trovato", che fidelity non considera un errore.
    ///
    /// Il nome della promo e' la classificazione, che in Correggo4 e' anche la cartella delle pagine
    /// (EstrattorePagine.CartellaDi), il prefisso di volantini_pagine.path_fisico e la chiave delle finestre
    /// Category e Timone: rinominarla vuol dire spostare tutto, se no le pagine spariscono e il prossimo
    /// .pack col nome nuovo creerebbe un volantino doppio. Prima si controllano i conflitti, poi si spostano
    /// le cartelle e si salva tutto insieme; se il salvataggio fallisce le cartelle tornano al loro posto.
    /// </summary>
    public async Task<string?> AggiornaDaFidelityAsync(ServizioCorrezioni.Utente u, Guid idPromo, string? nome,
                                                      DateTime? inizio, DateTime? fine, DateTime? scadenza)
    {
        var vols = await ctx.Volantinis.Where(v => v.IdPromoFp == idPromo).ToListAsync();
        if (vols.Count == 0) return "volantino_non_trovato";

        // --- rinomina: controlli prima di toccare qualunque cosa
        string? nuovoNome = string.IsNullOrWhiteSpace(nome) ? null : nome.Trim();
        var daRinominare = nuovoNome == null ? new List<Volantini>()
                                             : vols.Where(v => v.Classificazione != nuovoNome).ToList();
        var spostamenti = new List<(string Da, string A)>();
        if (daRinominare.Count > 0)
        {
            if (nuovoNome!.Length > 80) return "Il nome della promo supera gli 80 caratteri.";

            var idDellaPromo = vols.Select(v => v.Id).ToList();
            var titoli = daRinominare.Select(v => v.Titolo).ToList();
            bool occupato = await ctx.Volantinis.AnyAsync(v => v.Classificazione == nuovoNome
                                                             && titoli.Contains(v.Titolo)
                                                             && !idDellaPromo.Contains(v.Id));
            bool doppione = vols.Where(v => daRinominare.Contains(v) || v.Classificazione == nuovoNome)
                                .GroupBy(v => v.Titolo).Any(g => g.Count() > 1);
            if (occupato || doppione)
                return $"Esiste gia' un volantino della promo «{nuovoNome}» con lo stesso titolo.";

            foreach (var v in daRinominare)
            {
                string da = estrattore.CartellaDi(v.Classificazione, v.Titolo);
                string a = estrattore.CartellaDi(nuovoNome, v.Titolo);
                if (!Directory.Exists(da) || da == a) continue;
                if (Directory.Exists(a)) return $"La cartella delle pagine di «{nuovoNome}/{v.Titolo}» esiste gia'.";
                spostamenti.Add((da, a));
            }
        }

        // --- date
        var cambiateLeDate = new List<int>();
        foreach (var v in vols)
        {
            bool cambia = false;
            if (inizio != null && v.DataValiditaInizio != inizio) { v.DataValiditaInizio = inizio.Value; cambia = true; }
            if (fine != null && v.DataValiditaFine != fine) { v.DataValiditaFine = fine.Value; cambia = true; }
            if (scadenza != null && v.DataScadenza != scadenza) { v.DataScadenza = scadenza.Value; cambia = true; }
            if (cambia) cambiateLeDate.Add(v.Id);
        }

        // --- nome: volantini, pagine e finestre della promo
        if (daRinominare.Count > 0)
        {
            var vecchiNomi = daRinominare.Select(v => v.Classificazione).Distinct().ToList();
            var idRinominati = daRinominare.Select(v => v.Id).ToList();

            var pagine = await ctx.VolantiniPagines.Where(p => idRinominati.Contains(p.IdVol)).ToListAsync();
            foreach (var v in daRinominare)
            {
                string prefisso = v.Classificazione + "/";
                foreach (var p in pagine.Where(p => p.IdVol == v.Id && p.PathFisico != null
                                                    && p.PathFisico.StartsWith(prefisso, StringComparison.Ordinal)))
                    p.PathFisico = nuovoNome + "/" + p.PathFisico![prefisso.Length..];
                v.Classificazione = nuovoNome!;
            }

            await RinominaFinestreAsync(vecchiNomi, nuovoNome!, idRinominati);
        }

        if (cambiateLeDate.Count == 0 && daRinominare.Count == 0) return null;
        if (cambiateLeDate.Count > 0) await NotificaAsync(u, cambiateLeDate, "date");

        // --- prima le cartelle, poi il database; se il database non salva, le cartelle tornano indietro
        var fatti = new List<(string Da, string A)>();
        try
        {
            foreach (var (da, a) in spostamenti)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(a)!);
                Directory.Move(da, a);
                fatti.Add((da, a));
            }
            await ctx.SaveChangesAsync();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or DbUpdateException)
        {
            foreach (var (da, a) in Enumerable.Reverse(fatti))
            {
                try { Directory.Move(a, da); } catch (IOException) { } catch (UnauthorizedAccessException) { }
            }
            return "Aggiornamento della promo non riuscito: " + ex.Message;
        }

        // la cartella della promo col vecchio nome, se e' rimasta vuota, non serve piu'
        foreach (var (da, _) in fatti)
        {
            string? cartellaPromo = Path.GetDirectoryName(da);
            try
            {
                if (cartellaPromo != null && Directory.Exists(cartellaPromo)
                    && !Directory.EnumerateFileSystemEntries(cartellaPromo).Any())
                    Directory.Delete(cartellaPromo);
            }
            catch (IOException) { }
        }
        return null;
    }

    /// <summary>
    /// Le finestre Category e Timone sono per promo, con la classificazione come chiave. Passano al nome
    /// nuovo se la promo nuova non ne ha gia' una; la riga col vecchio nome resta solo se qualche
    /// volantino di un'altra promo lo usa ancora.
    /// </summary>
    private async Task RinominaFinestreAsync(List<string> vecchiNomi, string nuovoNome, List<int> idRinominati)
    {
        var ancoraUsati = await ctx.Volantinis
            .Where(v => vecchiNomi.Contains(v.Classificazione) && !idRinominati.Contains(v.Id))
            .Select(v => v.Classificazione).Distinct().ToListAsync();

        var category = await ctx.VolantiniFinestreCategories
            .Where(f => vecchiNomi.Contains(f.Classificazione) || f.Classificazione == nuovoNome).ToListAsync();
        if (!category.Any(f => f.Classificazione == nuovoNome))
        {
            var vecchia = category.FirstOrDefault();
            if (vecchia != null)
                ctx.VolantiniFinestreCategories.Add(new VolantiniFinestreCategory
                {
                    Classificazione = nuovoNome, DataInizio = vecchia.DataInizio, DataFine = vecchia.DataFine,
                    IdAutore = vecchia.IdAutore, DataModifica = DateTime.UtcNow
                });
        }
        foreach (var f in category.Where(f => f.Classificazione != nuovoNome && !ancoraUsati.Contains(f.Classificazione)))
            ctx.VolantiniFinestreCategories.Remove(f);

        var timone = await ctx.TimoneFinestre
            .Where(f => vecchiNomi.Contains(f.Classificazione) || f.Classificazione == nuovoNome).ToListAsync();
        if (!timone.Any(f => f.Classificazione == nuovoNome))
        {
            var vecchia = timone.FirstOrDefault();
            if (vecchia != null)
                ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
                {
                    Classificazione = nuovoNome, DataInizio = vecchia.DataInizio, DataFine = vecchia.DataFine,
                    IdAutore = vecchia.IdAutore, DataModifica = DateTime.UtcNow
                });
        }
        foreach (var f in timone.Where(f => f.Classificazione != nuovoNome && !ancoraUsati.Contains(f.Classificazione)))
            ctx.TimoneFinestre.Remove(f);
    }

    // ------------------------------------------------------------------ notifiche

    /// <summary>Una notifica per ogni altro utente attivo e per ogni volantino (Home.aspx.cs:625-645).</summary>
    private async Task NotificaAsync(ServizioCorrezioni.Utente u, List<int> idVols, string tag)
    {
        var altri = await ctx.Utentis.AsNoTracking().Where(x => x.Attivo && x.Id != u.Id).Select(x => x.Id).ToListAsync();
        var adesso = DateTime.UtcNow;
        foreach (int idVol in idVols)
            foreach (short idUtente in altri)
                ctx.Notifiches.Add(new Notifiche
                {
                    IdUtente = idUtente,
                    IdVolantino = idVol,
                    Tag = tag,
                    Stato = 0,
                    DataRegistrazione = adesso
                });
    }
}
