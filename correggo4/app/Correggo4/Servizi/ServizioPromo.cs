using Correggo4.Data;
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

    public ServizioPromo(Correggo4Context ctx, ServizioCorrezioni correzioni)
    {
        this.ctx = ctx;
        this.correzioni = correzioni;
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
