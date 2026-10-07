using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// L'eredità delle catene quando l'Agenzia pubblica una versione nuova (j226).
/// Nell'originale stava dentro il publisher, duplicata in due metodi (`Worker.readXmlSource` e
/// `Worker.readPackSource`, righe 1841-2140): il publisher era il **secondo costruttore di catene**
/// del sistema, indipendente dal demone e con regole proprie. Qui è un solo metodo, chiamato
/// dall'importatore dopo che i box della versione nuova sono stati scritti.
///
/// Due casi, come l'originale:
/// - **il prodotto c'era già nella versione precedente** (stessa `label_ind`): eredita il contatore
///   storico, le correzioni non eseguite della versione vecchia si chiudono come **Irrisolte**, i
///   suggerimenti dormienti si riportano sul prodotto nuovo, le propagazioni **attivate e non
///   eseguite** diventano Irrisolte e **non** si riportano ("se l'Agenzia non l'ha fatta è perché non
///   poteva farla");
/// - **il prodotto è nuovo**: si cercano i suoi gemelli fra i volantini aperti e le loro correzioni
///   aperte arrivano sul prodotto nuovo come **proposte dormienti** da attivare.
/// </summary>
public sealed partial class ServizioPropagazione
{
    public sealed record EsitoEredita(int Irrisolte, int Riportate, int Nuove);

    /// <summary>Eseguita dall'originale come "risolta": solo Corretta e Revisionata (non Irrisolta).</summary>
    private static bool Eseguita(short stato) =>
        stato == StatoCorrezioneFatta || stato == StatoCorrezioneRevisionata;

    public async Task<EsitoEredita> EreditaAsync(int idVol, short versioneNuova)
    {
        int irrisolte = 0, riportate = 0, nuove = 0;

        var nuoviBox = await (from e in ctx.VolantiniPagineElementis
                              join p in ctx.VolantiniPagines on e.IdPagina equals p.Id
                              where p.IdVol == idVol && p.Versione == versioneNuova && e.IdParent == null
                              select e).ToListAsync();
        if (nuoviBox.Count == 0) return new EsitoEredita(0, 0, 0);

        short precedente = (short)(versioneNuova - 1);
        var vecchiBox = precedente <= 0 ? new List<VolantiniPagineElementi>()
            : await (from e in ctx.VolantiniPagineElementis
                     join p in ctx.VolantiniPagines on e.IdPagina equals p.Id
                     where p.IdVol == idVol && p.Versione == precedente && e.IdParent == null
                     select e).ToListAsync();
        var perEtichetta = vecchiBox.GroupBy(e => e.LabelInd)
            .ToDictionary(g => g.Key, g => g.First());

        // ---------- tutto quello che sta attaccato ai box della versione vecchia ----------
        var idVecchi = vecchiBox.Select(e => e.Id).ToList();
        var noteVecchie = idVecchi.Count == 0 ? new List<VolantiniPagineNote>()
            : await ctx.VolantiniPagineNotes
                .Where(n => n.IdElemento != null && idVecchi.Contains(n.IdElemento.Value)).ToListAsync();
        var timbriVecchi = idVecchi.Count == 0 ? new List<VolantiniPagineDisegniComposizioni>()
            : await ctx.VolantiniPagineDisegniComposizionis
                .Where(c => c.IdElemento != null && idVecchi.Contains(c.IdElemento.Value)).ToListAsync();
        var propVecchi = idVecchi.Count == 0 ? new List<VolantiniPropagazioniElementi>()
            : await ctx.VolantiniPropagazioniElementis
                .Where(pe => idVecchi.Contains(pe.IdElemento)).ToListAsync();

        // le catene coinvolte: quelle dei propagati vecchi e quelle che hanno per pilota
        // una nota o un timbro della versione vecchia
        var idNoteVecchie = noteVecchie.Select(n => n.Id).ToList();
        var idTimbriVecchi = timbriVecchi.Select(t => t.Id).ToList();
        var idCatene = propVecchi.Select(pe => pe.IdPropagazione).Distinct().ToList();
        var catene = await ctx.VolantiniPropagazionis
            .Where(p => idCatene.Contains(p.Id)
                        || (p.IdNotaMaster != null && idNoteVecchie.Contains(p.IdNotaMaster.Value))
                        || (p.IdDisegnoMaster != null && idTimbriVecchi.Contains(p.IdDisegnoMaster.Value)))
            .ToListAsync();

        var idTutteCatene = catene.Select(c => c.Id).ToList();
        List<(long Catena, bool Attivo, short Stato)> righeCatene = new();
        if (idTutteCatene.Count > 0)
            righeCatene = (await ctx.VolantiniPropagazioniElementis.AsNoTracking()
                    .Where(pe => idTutteCatene.Contains(pe.IdPropagazione))
                    .Select(pe => new { pe.IdPropagazione, pe.Attivo, pe.Stato }).ToListAsync())
                .Select(x => (Catena: x.IdPropagazione, Attivo: x.Attivo, Stato: x.Stato)).ToList();

        // stato dei piloti delle catene coinvolte (possono stare su altri volantini)
        var idPilotiNota = catene.Where(c => c.IdNotaMaster != null).Select(c => c.IdNotaMaster!.Value).ToList();
        var statoPilotaNota = await ctx.VolantiniPagineNotes.AsNoTracking()
            .Where(n => idPilotiNota.Contains(n.Id)).Select(n => new { n.Id, n.Stato }).ToListAsync();
        var idPilotiTimbro = catene.Where(c => c.IdDisegnoMaster != null).Select(c => c.IdDisegnoMaster!.Value).ToList();
        var statoPilotaTimbro = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
            .Where(d => idPilotiTimbro.Contains(d.Id)).Select(d => new { d.Id, d.Stato }).ToListAsync();

        short StatoDelPilota(VolantiniPropagazioni c) =>
            c.IdNotaMaster != null
                ? statoPilotaNota.FirstOrDefault(x => x.Id == c.IdNotaMaster)?.Stato ?? StatoCorrezioneEliminata
                : statoPilotaTimbro.FirstOrDefault(x => x.Id == c.IdDisegnoMaster)?.Stato ?? StatoCorrezioneEliminata;

        // catena_risolta dell'originale (Worker.cs:1911-1941): nessun propagato attivo ancora da
        // fare **e** pilota eseguito.
        bool CatenaRisolta(VolantiniPropagazioni c) =>
            !righeCatene.Any(x => x.Catena == c.Id && x.Attivo && !Eseguita(x.Stato))
            && Eseguita(StatoDelPilota(c));

        var idNuovi = nuoviBox.Select(b => b.Id).ToList();
        var giaSulNuovo = new HashSet<(long, long)>(
            (await ctx.VolantiniPropagazioniElementis.AsNoTracking()
                .Where(pe => idNuovi.Contains(pe.IdElemento))
                .Select(pe => new { pe.IdPropagazione, pe.IdElemento }).ToListAsync())
            .Select(x => (x.IdPropagazione, x.IdElemento)));

        // ---------- caso B: i candidati per i prodotti nuovi ----------
        var senzaVecchio = nuoviBox.Where(b => !perEtichetta.ContainsKey(b.LabelInd)).ToList();
        List<VolantiniPagineElementi> candidati = new();
        Dictionary<long, string> promoDelBox = new();
        Dictionary<long, string> titoloDelBox = new();
        if (senzaVecchio.Count > 0)
        {
            var adesso = DateTime.UtcNow;
            var grezzi = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                                join p in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals p.Id
                                join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                                where e.IdParent == null && e.Basecode != ""
                                      && v.Status == StatoVolantinoAperto && v.DataScadenza > adesso
                                      && !(p.IdVol == idVol && p.Versione == versioneNuova)
                                select new { e, p.IdVol, p.Versione, v.Titolo, v.Classificazione }).ToListAsync();
            // "ultima versione di ogni volantino" come il precalcolo dell'originale (Worker.cs:1517-1545)
            var ultima = grezzi.GroupBy(x => x.IdVol).ToDictionary(g => g.Key, g => g.Max(x => x.Versione));
            var scelti = grezzi.Where(x => x.Versione == ultima[x.IdVol]).ToList();
            var idScelti = scelti.Select(x => x.e.Id).ToList();
            // solo i box che hanno qualcosa da propagare
            var conNote = await ctx.VolantiniPagineNotes.AsNoTracking()
                .Where(n => n.IdElemento != null && idScelti.Contains(n.IdElemento.Value)
                            && n.Stato != StatoCorrezioneEliminata)
                .Select(n => n.IdElemento!.Value).Distinct().ToListAsync();
            var conTimbri = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
                .Where(c => c.IdElemento != null && idScelti.Contains(c.IdElemento.Value)
                            && c.Simbolo != "penna" && c.Stato != StatoCorrezioneEliminata)
                .Select(c => c.IdElemento!.Value).Distinct().ToListAsync();
            var utili = conNote.Concat(conTimbri).ToHashSet();
            candidati = scelti.Where(x => utili.Contains(x.e.Id)).Select(x => x.e).ToList();
            foreach (var x in scelti)
            {
                promoDelBox[x.e.Id] = x.Classificazione;
                titoloDelBox[x.e.Id] = x.Titolo;
            }
        }

        var promoNuovo = await ctx.Volantinis.AsNoTracking().Where(v => v.Id == idVol)
            .Select(v => new { v.Classificazione, v.Titolo }).FirstAsync();

        // ---------- caso A: il prodotto c'era già nella versione precedente ----------
        foreach (var nuovo in nuoviBox)
        {
            if (!perEtichetta.TryGetValue(nuovo.LabelInd, out var vecchio)) continue;

            // 1. eredità del contatore storico (Worker.cs:1843)
            nuovo.Contatore = vecchio.Contatore;

            // 2. e 3. le correzioni della versione vecchia ancora da fare si chiudono come Irrisolte,
            // salvo quelle la cui catena è spenta o rettificata (Worker.cs:1858-1895)
            foreach (var n in noteVecchie.Where(n => n.IdElemento == vecchio.Id && n.Stato == StatoCorrezioneDaFare))
            {
                var c = catene.FirstOrDefault(x => x.IdNotaMaster == n.Id);
                if (c != null && (c.Attivo == CatenaInattiva || c.Attivo == CatenaRettificata)) continue;
                n.Stato = StatoCorrezioneIrrisolta;
                irrisolte++;
            }
            foreach (var t in timbriVecchi.Where(t => t.IdElemento == vecchio.Id && t.Stato == StatoCorrezioneDaFare))
            {
                var c = catene.FirstOrDefault(x => x.IdDisegnoMaster == t.Id);
                if (c != null && (c.Attivo == CatenaInattiva || c.Attivo == CatenaRettificata)) continue;
                t.Stato = StatoCorrezioneIrrisolta;
                irrisolte++;
            }

            // 4. i propagati del prodotto vecchio (Worker.cs:1903-1973)
            foreach (var pe in propVecchi.Where(pe => pe.IdElemento == vecchio.Id))
            {
                var c = catene.FirstOrDefault(x => x.Id == pe.IdPropagazione);
                if (c == null || c.Attivo != CatenaAttiva) continue;
                if (pe.IdCorrettore != null || pe.DataCorrezione != null) continue;
                if (CatenaRisolta(c)) continue;

                if (pe.Stato == PropSuggerita)
                {
                    // suggerimento mai attivato: si riporta sul prodotto nuovo, stessa catena
                    if (giaSulNuovo.Add((c.Id, nuovo.Id)))
                    {
                        ctx.VolantiniPropagazioniElementis.Add(new VolantiniPropagazioniElementi
                        {
                            IdPropagazione = c.Id,
                            IdElemento = nuovo.Id,
                            Stato = pe.Stato,
                            Attivo = pe.Attivo
                        });
                        riportate++;
                    }
                }
                else if (pe.Stato == PropDaFare)
                {
                    // era attivata e non è stata eseguita: resta Irrisolta sulla versione vecchia
                    // e non viene riportata (Worker.cs:1967-1973)
                    pe.Stato = StatoCorrezioneIrrisolta;
                    irrisolte++;
                }
            }
        }

        // ---------- caso B: il prodotto è nuovo, si aggancia ai gemelli ----------
        foreach (var nuovo in senzaVecchio)
        {
            if (nuovo.Basecode == "") continue;
            foreach (var g in candidati.Where(c => Gemelli.StessoDna(nuovo, c)))
            {
                foreach (var n in await NoteDaPropagareAsync(g.Id))
                {
                    var c = await CatenaEsistenteAsync(catene, righeCatene, x => x.IdNotaMaster == n.Id);
                    bool risolta = Eseguita(n.Stato)
                                   && (c == null || !righeCatene.Any(x => x.Catena == c.Id && x.Attivo && !Eseguita(x.Stato)));
                    if (risolta) continue;
                    if (c != null && c.Attivo == CatenaInattiva) continue;
                    if (c == null)
                    {
                        // il publisher dell'originale crea la catena direttamente attiva, senza demone
                        c = new VolantiniPropagazioni { IdNotaMaster = n.Id, Visto = false, Attivo = CatenaAttiva };
                        ctx.VolantiniPropagazionis.Add(c);
                        await ctx.SaveChangesAsync();
                        catene.Add(c);
                    }
                    if (!giaSulNuovo.Add((c.Id, nuovo.Id))) continue;
                    ctx.VolantiniPropagazioniElementis.Add(new VolantiniPropagazioniElementi
                    {
                        IdPropagazione = c.Id, IdElemento = nuovo.Id, Stato = PropSuggerita, Attivo = false
                    });
                    nuove++;
                }
                foreach (var t in await TimbriDaPropagareAsync(g.Id))
                {
                    // la policy del simbolo si applica **prima** (Worker.cs:2054-2080)
                    var pol = Gemelli.Policy(t.Simbolo);
                    if (!pol.Propagabile) continue;
                    if (pol.SoloStessoCanale)
                    {
                        if (Gemelli.Canale(titoloDelBox.GetValueOrDefault(g.Id, "")) != Gemelli.Canale(promoNuovo.Titolo)) continue;
                    }
                    else if (pol.SoloStessaPromo)
                    {
                        if (promoDelBox.GetValueOrDefault(g.Id, "") != promoNuovo.Classificazione) continue;
                    }
                    var c = await CatenaEsistenteAsync(catene, righeCatene, x => x.IdDisegnoMaster == t.Id);
                    bool risolta = Eseguita(t.Stato)
                                   && (c == null || !righeCatene.Any(x => x.Catena == c.Id && x.Attivo && !Eseguita(x.Stato)));
                    if (risolta) continue;
                    if (c != null && c.Attivo == CatenaInattiva) continue;
                    if (c == null)
                    {
                        c = new VolantiniPropagazioni { IdDisegnoMaster = t.Id, Visto = false, Attivo = CatenaAttiva };
                        ctx.VolantiniPropagazionis.Add(c);
                        await ctx.SaveChangesAsync();
                        catene.Add(c);
                    }
                    if (!giaSulNuovo.Add((c.Id, nuovo.Id))) continue;
                    ctx.VolantiniPropagazioniElementis.Add(new VolantiniPropagazioniElementi
                    {
                        IdPropagazione = c.Id, IdElemento = nuovo.Id, Stato = PropSuggerita, Attivo = false
                    });
                    nuove++;
                }
            }
        }

        await ctx.SaveChangesAsync();
        log.LogInformation("Eredità propagazioni vol {Vol} v{Ver}: {Irr} irrisolte, {Rip} riportate, {Nuo} nuove",
                           idVol, versioneNuova, irrisolte, riportate, nuove);
        return new EsitoEredita(irrisolte, riportate, nuove);
    }

    /// <summary>
    /// La catena del pilota indicato: prima fra quelle gia' in mano, poi in banca dati (e allora si
    /// caricano anche le sue righe, che servono a capire se la catena e' risolta). Senza questa
    /// ricerca il publisher creerebbe una seconda catena per una correzione che ne ha gia' una.
    /// </summary>
    private async Task<VolantiniPropagazioni?> CatenaEsistenteAsync(
        List<VolantiniPropagazioni> catene, List<(long Catena, bool Attivo, short Stato)> righe,
        System.Linq.Expressions.Expression<Func<VolantiniPropagazioni, bool>> quale)
    {
        var test = quale.Compile();
        var c = catene.FirstOrDefault(test);
        if (c != null) return c;
        c = await ctx.VolantiniPropagazionis.FirstOrDefaultAsync(quale);
        if (c == null) return null;
        catene.Add(c);
        long idc = c.Id;
        righe.AddRange((await ctx.VolantiniPropagazioniElementis.AsNoTracking()
                .Where(pe => pe.IdPropagazione == idc)
                .Select(pe => new { pe.Attivo, pe.Stato }).ToListAsync())
            .Select(x => (Catena: idc, Attivo: x.Attivo, Stato: x.Stato)));
        return c;
    }

    private Task<List<VolantiniPagineNote>> NoteDaPropagareAsync(long idBox) =>
        ctx.VolantiniPagineNotes.AsNoTracking()
            .Where(n => n.IdElemento == idBox && n.Stato != StatoCorrezioneEliminata
                        && n.Stato != ServizioCorrezioni.StatoArchiviato
                        && n.Tipo != ServizioCorrezioni.TipoNotaPromemoria)
            .ToListAsync();

    private Task<List<VolantiniPagineDisegniComposizioni>> TimbriDaPropagareAsync(long idBox) =>
        ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
            .Where(c => c.IdElemento == idBox && c.Simbolo != "penna"
                        && c.Stato != StatoCorrezioneEliminata
                        && c.Stato != ServizioCorrezioni.StatoArchiviato)
            .ToListAsync();
}
