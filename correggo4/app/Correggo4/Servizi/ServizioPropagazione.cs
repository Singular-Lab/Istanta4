using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Il motore delle propagazioni, come il vecchio Correggo (correggo-demoni.md §4):
/// salvando una nota o un timbro l'applicazione **non** costruisce la catena, ma crea la
/// propagazione in stato "in costruzione" e mette un lavoro in coda (demone_activity);
/// il demone (DemonePropagazioni) la costruisce cercando i gemelli su tutti i volantini aperti.
/// I propagati nascono **dormienti** (attivo = false, stato = 2): sono suggerimenti, e li attiva
/// chi corregge dalla finestra del megafono.
/// </summary>
public sealed partial class ServizioPropagazione
{
    // volantini_propagazioni.attivo (StatoPropagazione dell'originale)
    public const short CatenaInattiva = 0;
    public const short CatenaAttiva = 1;
    public const short CatenaRettificata = 2;
    public const short CatenaInCostruzione = 3;

    // demone_activity.tipo_azione (TipoDemoneActivity dell'originale)
    public const short AzioneAggiungi = 1;
    public const short AzioneRimuovi = 2;
    public const short AzioneCorrezione = 3;
    public const short AzioneCostruzioneCatena = 4;

    // volantini_propagazioni_elementi.stato (StatoCorrezione dell'originale)
    public const short PropSuggerita = 2;    // Eliminata: il suggerimento non ancora attivato
    public const short PropDaFare = 0;       // NonVerificata: attivata, da eseguire
    public const short PropFatta = 1;        // Corretta

    private readonly Correggo4Context ctx;
    private readonly ILogger<ServizioPropagazione> log;
    private readonly IHttpContextAccessor http;

    public ServizioPropagazione(Correggo4Context ctx, ILogger<ServizioPropagazione> log,
                                IHttpContextAccessor http)
    {
        this.ctx = ctx; this.log = log; this.http = http;
    }

    // ------------------------------------------------------------------ creazione della catena

    /// <summary>Una nota propaga sempre (l'originale non le metteva vincoli di promo o canale).</summary>
    public Task GeneraPerNotaAsync(long idNota, long idBox, int idVol) =>
        GeneraAsync(idNota, null, idBox, idVol);

    /// <summary>Un timbro propaga solo se la sua policy lo consente (Gemelli.Policy).</summary>
    public async Task GeneraPerTimbroAsync(long idDisegno, long idBox, int idVol, string? simbolo)
    {
        if (!Gemelli.Policy(simbolo).Propagabile) return;
        await GeneraAsync(null, idDisegno, idBox, idVol);
    }

    private async Task GeneraAsync(long? idNota, long? idDisegno, long idBox, int idVol)
    {
        var prop = new VolantiniPropagazioni
        {
            IdNotaMaster = idNota,
            IdDisegnoMaster = idDisegno,
            DataRegistrazione = DateTime.UtcNow,
            Visto = false,
            Attivo = CatenaInCostruzione
        };
        ctx.VolantiniPropagazionis.Add(prop);
        await ctx.SaveChangesAsync();

        ctx.DemoneActivities.Add(new DemoneActivity
        {
            TipoAzione = AzioneCostruzioneCatena,
            IdVol = idVol,
            IdNota = idNota,
            IdDisegno = idDisegno,
            IdPropagazione = prop.Id,
            IdElemento = idBox,
            DataRegistrazione = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
    }

    /// <summary>Correzione eliminata: la catena si spegne (eliminaPropagazione dell'originale, S:4765).</summary>
    public async Task ChiudiPerNotaAsync(long idNota) => await ChiudiAsync(p => p.IdNotaMaster == idNota);

    public async Task ChiudiPerTimbroAsync(long idDisegno) => await ChiudiAsync(p => p.IdDisegnoMaster == idDisegno);

    private async Task ChiudiAsync(System.Linq.Expressions.Expression<Func<VolantiniPropagazioni, bool>> quale)
    {
        var catene = await ctx.VolantiniPropagazionis.Where(quale).ToListAsync();
        if (catene.Count == 0) return;
        foreach (var c in catene) c.Attivo = CatenaInattiva;
        await ctx.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ la coda

    /// <summary>
    /// Prende i lavori in coda e costruisce le catene. Il claim usa "for update skip locked" così
    /// due giri non si pestano i piedi (l'originale si affidava alla scrittura immediata di
    /// data_inizio_processo, CostruttoreCatena.cs:236).
    /// </summary>
    public async Task<int> ElaboraCodaAsync(int massimo = 20, CancellationToken ferma = default)
    {
        int fatte = 0;
        for (int i = 0; i < massimo; i++)
        {
            if (ferma.IsCancellationRequested) break;
            long? id = await ClaimAsync(ferma);
            if (id == null) break;
            await CostruisciAsync(id.Value, ferma);
            fatte++;
        }
        return fatte;
    }

    /// <summary>Segna un lavoro come "preso in carico" e ne restituisce l'id, o null se la coda è vuota.</summary>
    private async Task<long?> ClaimAsync(CancellationToken ferma)
    {
        var conn = ctx.Database.GetDbConnection();
        bool daAprire = conn.State != System.Data.ConnectionState.Open;
        if (daAprire) await conn.OpenAsync(ferma);
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                update demone_activity set data_inizio_processo = now()
                where id = (select id from demone_activity
                            where tipo_azione = @tipo and id_propagazione is not null
                                  and data_inizio_processo is null and data_processo is null
                            order by data_registrazione, id
                            for update skip locked limit 1)
                returning id
                """;
            var p = cmd.CreateParameter();
            p.ParameterName = "tipo";
            p.Value = AzioneCostruzioneCatena;
            cmd.Parameters.Add(p);
            object? r = await cmd.ExecuteScalarAsync(ferma);
            return r == null || r is DBNull ? null : Convert.ToInt64(r);
        }
        finally
        {
            if (daAprire) await conn.CloseAsync();
        }
    }

    // ------------------------------------------------------------------ il costruttore di catene

    /// <summary>
    /// bulidCatenaConIndicizzazione dell'originale (CostruttoreCatena.cs:206-410): candidati dal
    /// database, gemellaggio in memoria, propagati dormienti, catena "attiva" anche se ha trovato zero
    /// gemelli. Restituisce quanti gemelli ha scritto.
    /// </summary>
    public async Task<int> CostruisciAsync(long idAttivita, CancellationToken ferma = default)
    {
        var att = await ctx.DemoneActivities.FirstOrDefaultAsync(a => a.Id == idAttivita, ferma);
        if (att == null || att.IdPropagazione == null || att.IdElemento == null) return 0;
        try
        {
            var catena = await ctx.VolantiniPropagazionis.FirstOrDefaultAsync(p => p.Id == att.IdPropagazione, ferma);
            var pilota = await ctx.VolantiniPagineElementis.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == att.IdElemento, ferma);
            if (catena == null || pilota == null)
            {
                att.DataProcesso = DateTime.UtcNow;
                att.Errore = "propagazione o prodotto non trovati";
                await ctx.SaveChangesAsync(ferma);
                return 0;
            }

            // 1. policy del simbolo: promo o canale del volantino del pilota
            string? simbolo = catena.IdDisegnoMaster == null ? null
                : await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
                    .Where(c => c.Id == catena.IdDisegnoMaster).Select(c => c.Simbolo).FirstOrDefaultAsync(ferma);
            var pol = catena.IdDisegnoMaster == null ? new PolicySimbolo(true, false, false) : Gemelli.Policy(simbolo);

            var volPilota = await (from p in ctx.VolantiniPagines.AsNoTracking()
                                   join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                                   where p.Id == pilota.IdPagina
                                   select new { v.Id, v.Titolo, v.Classificazione }).FirstAsync(ferma);
            string classif = "", canale = "";
            if (pol.SoloStessaPromo)
            {
                classif = volPilota.Classificazione;
                if (pol.SoloStessoCanale) { classif = ""; canale = Gemelli.Canale(volPilota.Titolo); }
            }

            // 2. candidati: box radice di versioni aperte di volantini non chiusi e non scaduti
            var adesso = DateTime.UtcNow;
            var q = from e in ctx.VolantiniPagineElementis.AsNoTracking()
                    join p in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals p.Id
                    join v in ctx.Volantinis.AsNoTracking() on p.IdVol equals v.Id
                    where e.IdParent == null && e.Id != pilota.Id
                          // L'originale chiedeva "volantino non chiuso"; in Correggo4 status 1 = in
                          // correzione (0 = nascosto, come i volantini di prova), quindi si guarda quello.
                          && v.Status == StatoVolantinoAperto && v.DataScadenza > adesso
                          // versione non chiusa, come l'originale
                          && !ctx.VolantiniVersionis.Any(ver => ver.Id == p.IdVersione && ver.DataChiusura != null)
                          && e.Basecode != ""
                    select new { e, v.Titolo, v.Classificazione };
            if (classif != "") q = q.Where(x => x.Classificazione == classif);
            else if (canale != "") q = q.Where(x => x.Titolo.StartsWith(canale));
            var candidati = await q.ToListAsync(ferma);

            // 3. gemellaggio in memoria, come l'originale (tutti i gemelli, non il primo)
            var gemelli = candidati.Where(x => Gemelli.StessoDna(pilota, x.e)).Select(x => x.e).ToList();

            // 4. se il pilota e' un timbro, salto i box che hanno gia' quel simbolo (a mano o propagato)
            if (catena.IdDisegnoMaster != null && simbolo != null && gemelli.Count > 0)
            {
                var ids = gemelli.Select(g => g.Id).ToList();
                var conTimbro = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
                    .Where(c => c.IdElemento != null && ids.Contains(c.IdElemento.Value)
                                && c.Simbolo == simbolo && c.Stato != StatoCorrezioneEliminata)
                    .Select(c => c.IdElemento!.Value).Distinct().ToListAsync(ferma);
                var conPropagato = await (from pe in ctx.VolantiniPropagazioniElementis.AsNoTracking()
                                          join pr in ctx.VolantiniPropagazionis.AsNoTracking() on pe.IdPropagazione equals pr.Id
                                          join d in ctx.VolantiniPagineDisegniComposizionis.AsNoTracking() on pr.IdDisegnoMaster equals d.Id
                                          where ids.Contains(pe.IdElemento) && pr.Attivo != CatenaInattiva
                                                && d.Simbolo == simbolo && d.Stato != StatoCorrezioneEliminata
                                          select pe.IdElemento).Distinct().ToListAsync(ferma);
                var salta = conTimbro.Concat(conPropagato).ToHashSet();
                gemelli = gemelli.Where(g => !salta.Contains(g.Id)).ToList();
            }

            // 5. scrittura dei propagati: dormienti, come l'originale
            var giaCi = await ctx.VolantiniPropagazioniElementis.AsNoTracking()
                .Where(pe => pe.IdPropagazione == catena.Id).Select(pe => pe.IdElemento).ToListAsync(ferma);
            int scritti = 0;
            foreach (var g in gemelli)
            {
                if (giaCi.Contains(g.Id)) continue;
                ctx.VolantiniPropagazioniElementis.Add(new VolantiniPropagazioniElementi
                {
                    IdPropagazione = catena.Id,
                    IdElemento = g.Id,
                    Stato = PropSuggerita,
                    Attivo = false
                });
                scritti++;
            }

            // 6. chiusura: la catena e' attiva anche se non ha trovato nessun gemello
            catena.Attivo = CatenaAttiva;
            att.DataProcesso = DateTime.UtcNow;
            await ctx.SaveChangesAsync(ferma);
            log.LogInformation("Catena {Catena}: {Candidati} candidati, {Gemelli} gemelli, {Scritti} scritti",
                catena.Id, candidati.Count, gemelli.Count, scritti);
            return scritti;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // L'originale riazzerava data_inizio_processo e riprovava all'infinito: qui il lavoro si
            // chiude con l'errore scritto, così una riga malata non blocca la coda.
            log.LogWarning(ex, "Costruzione della catena {Attivita} non riuscita", idAttivita);
            ctx.ChangeTracker.Clear();
            var a2 = await ctx.DemoneActivities.FirstOrDefaultAsync(a => a.Id == idAttivita, CancellationToken.None);
            if (a2 != null)
            {
                a2.DataProcesso = DateTime.UtcNow;
                a2.Errore = ex.Message.Length > 900 ? ex.Message[..900] : ex.Message;
                await ctx.SaveChangesAsync(CancellationToken.None);
            }
            return 0;
        }
    }

    private const short StatoVolantinoAperto = 1;
    private const short StatoCorrezioneEliminata = 2;
    private const short StatoCorrezioneDaFare = 0;
    private const short StatoCorrezioneFatta = 1;
    private const short StatoCorrezioneRevisionata = 3;
    private const short StatoCorrezioneIrrisolta = 6;
    /// <summary>Scorciatoia dell'originale (Helper.cs:798-832): dopo un'ora il megafono non lampeggia piu'.</summary>
    public const int MinutiLampeggio = 60;

    // ------------------------------------------------------------------ lettura per il megafono

    /// <summary>
    /// Lo stato delle catene delle correzioni di certe pagine, per disegnare il megafono
    /// (propagazione_attiva / in_costruzione / attivate / corrette_anche_obsolete dell'originale).
    /// </summary>
    public async Task<(Dictionary<long, PropagazioneVista> Note, Dictionary<long, PropagazioneVista> Timbri)>
        StatiAsync(List<int> idPagine)
    {
        var vuoto = (new Dictionary<long, PropagazioneVista>(), new Dictionary<long, PropagazioneVista>());
        if (idPagine.Count == 0) return vuoto;

        var catene = await (from p in ctx.VolantiniPropagazionis.AsNoTracking()
                            join n in ctx.VolantiniPagineNotes.AsNoTracking() on p.IdNotaMaster equals n.Id into note
                            from n in note.DefaultIfEmpty()
                            join d in ctx.VolantiniPagineDisegniComposizionis.AsNoTracking() on p.IdDisegnoMaster equals d.Id into dis
                            from d in dis.DefaultIfEmpty()
                            where p.Attivo != CatenaInattiva
                                  && ((n != null && idPagine.Contains(n.IdPagina)) || (d != null && idPagine.Contains(d.IdPagina)))
                            select new CatenaGrezza(p.Id, p.Attivo, p.DataRegistrazione,
                                n != null ? n.Stato : (d != null ? d.Stato : (short)0),
                                p.IdNotaMaster, p.IdDisegnoMaster)).ToListAsync();
        if (catene.Count == 0) return vuoto;

        var viste = await CalcolaVisteAsync(catene);
        var perNota = new Dictionary<long, PropagazioneVista>();
        var perTimbro = new Dictionary<long, PropagazioneVista>();
        foreach (var c in catene)
        {
            if (!viste.TryGetValue(c.Id, out var vista)) continue;
            if (c.IdNotaMaster != null) perNota[c.IdNotaMaster.Value] = vista;
            else if (c.IdDisegnoMaster != null) perTimbro[c.IdDisegnoMaster.Value] = vista;
        }
        return (perNota, perTimbro);
    }

    /// <summary>
    /// Le propagazioni **ricevute** dalle pagine aperte: quello che l'originale disegna sul volantino
    /// gemello (getCorrezioni, "//PROPAGAZIONI", S:5074-5104). Le righe sono quelle delle catene accese,
    /// attivate oppure ancora da consultare (mai confermate): i suggerimenti si vedono sbiaditi.
    /// </summary>
    public async Task<List<PropagataVista>> RicevuteAsync(ServizioCorrezioni.Utente u, List<int> idPagine,
                                                          Dictionary<int, short> numeroPagina, bool volantinoFermo)
    {
        var lista = new List<PropagataVista>();
        if (idPagine.Count == 0) return lista;

        var righe = await (from pe in ctx.VolantiniPropagazioniElementis.AsNoTracking()
                           join e in ctx.VolantiniPagineElementis.AsNoTracking() on pe.IdElemento equals e.Id
                           join p in ctx.VolantiniPropagazionis.AsNoTracking() on pe.IdPropagazione equals p.Id
                           where idPagine.Contains(e.IdPagina) && p.Attivo != CatenaInattiva
                                 && (pe.Attivo || pe.DataCorrezione == null)
                           orderby pe.Id
                           select new
                           {
                               pe.Id, pe.IdPropagazione, pe.IdElemento, e.IdPagina, pe.Stato, pe.Attivo,
                               pe.IdCorrettore, pe.DataCorrezione, p.IdNotaMaster, p.IdDisegnoMaster
                           }).ToListAsync();
        if (righe.Count == 0) return lista;

        var idCatene = righe.Select(r => r.IdPropagazione).Distinct().ToList();
        var catene = await (from p in ctx.VolantiniPropagazionis.AsNoTracking()
                            join n in ctx.VolantiniPagineNotes.AsNoTracking() on p.IdNotaMaster equals n.Id into note
                            from n in note.DefaultIfEmpty()
                            join d in ctx.VolantiniPagineDisegniComposizionis.AsNoTracking() on p.IdDisegnoMaster equals d.Id into dis
                            from d in dis.DefaultIfEmpty()
                            where idCatene.Contains(p.Id)
                            select new CatenaGrezza(p.Id, p.Attivo, p.DataRegistrazione,
                                n != null ? n.Stato : (d != null ? d.Stato : (short)0),
                                p.IdNotaMaster, p.IdDisegnoMaster)).ToListAsync();
        var viste = await CalcolaVisteAsync(catene);

        var idNote = righe.Where(r => r.IdNotaMaster != null).Select(r => r.IdNotaMaster!.Value).Distinct().ToList();
        var piloti = await ctx.VolantiniPagineNotes.AsNoTracking().Where(n => idNote.Contains(n.Id))
            .Select(n => new { n.Id, n.Descrizione, n.IdAutore, n.DataInserimento, n.Tipo }).ToListAsync();
        var idDis = righe.Where(r => r.IdDisegnoMaster != null).Select(r => r.IdDisegnoMaster!.Value).Distinct().ToList();
        var pilotiTimbro = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking().Where(d => idDis.Contains(d.Id))
            .Select(d => new { d.Id, d.Simbolo, d.IdAutore, d.DataInserimento }).ToListAsync();

        // IdAutore e' short sulle note e short? sui timbri: porto tutto a short? e poi filtro i nulli
        var idUtenti = piloti.Select(x => (short?)x.IdAutore)
            .Concat(pilotiTimbro.Select(x => (short?)x.IdAutore))
            .Concat(righe.Select(r => r.IdCorrettore))
            .Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
        var utenti = await ctx.Utentis.AsNoTracking().Where(x => idUtenti.Contains(x.Id))
            .Select(x => new { x.Id, Nome = x.Nome + " " + x.Cognome, x.Ruolo, x.TipoUtenteFico }).ToListAsync();
        string nome(short? id) => utenti.FirstOrDefault(x => x.Id == id)?.Nome ?? "";
        string tipo(short? id)
        {
            var x = utenti.FirstOrDefault(y => y.Id == id);
            return x == null ? "" : (x.Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : ServizioCorrezioni.TipoTesto(x.TipoUtenteFico));
        }

        foreach (var r in righe)
        {
            var v = new PropagataVista
            {
                Id = r.Id,
                IdCatena = r.IdPropagazione,
                IdBox = r.IdElemento,
                IdPagina = r.IdPagina,
                Pagina = numeroPagina.TryGetValue(r.IdPagina, out var np) ? np : (short)0,
                Stato = r.Stato,
                Attivo = r.Attivo,
                Suggerimento = !r.Attivo,
                Correttore = nome(r.IdCorrettore),
                DataCorrezione = r.DataCorrezione,
                StatoTesto = TestoStato(r.Stato, r.Attivo, false),
                PuoConfermare = u.Accetta && r.Attivo && r.Stato == StatoCorrezioneDaFare && !volantinoFermo
            };
            if (r.IdNotaMaster != null)
            {
                var n = piloti.FirstOrDefault(x => x.Id == r.IdNotaMaster);
                if (n == null) continue;
                if (n.Tipo == ServizioCorrezioni.TipoNotaPromemoria) continue;   // i promemoria non si propagano
                v.Tipo = "nota"; v.IdCorrezione = n.Id; v.Testo = n.Descrizione;
                v.Autore = nome(n.IdAutore); v.TipoAutore = tipo(n.IdAutore); v.Data = n.DataInserimento;
            }
            else if (r.IdDisegnoMaster != null)
            {
                var d = pilotiTimbro.FirstOrDefault(x => x.Id == r.IdDisegnoMaster);
                if (d == null) continue;
                v.Tipo = "timbro"; v.IdCorrezione = d.Id; v.Simbolo = d.Simbolo;
                v.Nome = ServizioCorrezioni.Timbri.TryGetValue(d.Simbolo, out var nm) ? nm : d.Simbolo;
                v.Autore = nome(d.IdAutore); v.TipoAutore = tipo(d.IdAutore); v.Data = d.DataInserimento;
            }
            else continue;
            if (viste.TryGetValue(r.IdPropagazione, out var vista)) v.Propagazione = vista;
            lista.Add(v);
        }
        return lista;
    }

    /// <summary>La catena come serve al calcolo del megafono, senza il corredo della finestra.</summary>
    private sealed record CatenaGrezza(long Id, short Attivo, DateTime DataRegistrazione, short StatoMaster,
                                       long? IdNotaMaster, long? IdDisegnoMaster);

    /// <summary>
    /// Lo stato del megafono per un gruppo di catene: gemelli, attivati, fatti, in costruzione,
    /// alone verde (percentuale "corrette anche obsolete" dell'originale) e lampeggio entro l'ora.
    /// </summary>
    private async Task<Dictionary<long, PropagazioneVista>> CalcolaVisteAsync(List<CatenaGrezza> catene)
    {
        var risultato = new Dictionary<long, PropagazioneVista>();
        if (catene.Count == 0) return risultato;
        var ids = catene.Select(c => c.Id).ToList();
        var propagati = await (from pe in ctx.VolantiniPropagazioniElementis.AsNoTracking()
                               join e in ctx.VolantiniPagineElementis.AsNoTracking() on pe.IdElemento equals e.Id
                               join pg in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals pg.Id
                               where ids.Contains(pe.IdPropagazione)
                               select new
                               {
                                   pe.IdPropagazione, pe.Stato, pe.Attivo,
                                   Superata = ctx.VolantiniVersionis.Any(v => v.Id == pg.IdVersione && v.DataChiusura != null)
                               }).ToListAsync();
        var inCoda = await ctx.DemoneActivities.AsNoTracking()
            .Where(a => a.IdPropagazione != null && ids.Contains(a.IdPropagazione.Value)
                        && a.TipoAzione == AzioneCostruzioneCatena && a.DataProcesso == null)
            .Select(a => a.IdPropagazione!.Value).Distinct().ToListAsync();

        var adesso = DateTime.UtcNow;
        foreach (var c in catene)
        {
            var suoi = propagati.Where(x => x.IdPropagazione == c.Id).ToList();
            bool costruzione = c.Attivo == CatenaInCostruzione || inCoda.Contains(c.Id);
            int attivati = suoi.Count(x => x.Attivo);
            int fatti = suoi.Count(x => x.Attivo && Fatta(x.Stato));

            // percentuale "corrette anche obsolete" dell'originale: propagati attivi non scartati + il pilota
            int totale = suoi.Count(x => x.Attivo && x.Stato != StatoCorrezioneEliminata);
            int progresso = fatti;
            if (c.StatoMaster != StatoCorrezioneEliminata) { totale++; if (Fatta(c.StatoMaster)) progresso++; }

            risultato[c.Id] = new PropagazioneVista
            {
                Id = c.Id,
                InCostruzione = costruzione,
                Gemelli = suoi.Count,
                Attivati = attivati,
                Fatti = fatti,
                TuttiFatti = totale > 0 && progresso == totale,
                DaConsultare = attivati == 0 && (adesso - c.DataRegistrazione).TotalMinutes <= MinutiLampeggio
            };
        }
        return risultato;
    }

    private static bool Fatta(short stato) =>
        stato is StatoCorrezioneFatta or StatoCorrezioneRevisionata or StatoCorrezioneIrrisolta;

    // ------------------------------------------------------------------ la finestra del megafono

    public async Task<EsitoCorrezione> CaricaCatenaAsync(ServizioCorrezioni.Utente u, long idCatena)
    {
        var catena = await ctx.VolantiniPropagazionis.AsNoTracking().FirstOrDefaultAsync(p => p.Id == idCatena);
        if (catena == null || catena.Attivo == CatenaInattiva)
            return EsitoCorrezione.No(404, "catena_non_trovata", "Questa propagazione non esiste piu'.");

        var vista = new CatenaVista
        {
            Id = catena.Id,
            Stato = catena.Attivo,
            Data = catena.DataRegistrazione,
            PuoAttivare = u.Scrive,
            PuoConfermare = u.Accetta,
            Tipo = catena.IdNotaMaster != null ? "nota" : "timbro"
        };
        vista.InCostruzione = catena.Attivo == CatenaInCostruzione || await ctx.DemoneActivities.AsNoTracking()
            .AnyAsync(a => a.IdPropagazione == catena.Id && a.TipoAzione == AzioneCostruzioneCatena && a.DataProcesso == null);

        long idBoxPilota = 0;
        short statoMaster = 0;
        string correttorePilota = "";
        DateTime? dataCorrezionePilota = null;
        if (catena.IdNotaMaster != null)
        {
            var n = await ctx.VolantiniPagineNotes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == catena.IdNotaMaster);
            if (n == null) return EsitoCorrezione.No(404, "catena_non_trovata", "La correzione non esiste piu'.");
            vista.IdCorrezione = n.Id; vista.Testo = n.Descrizione; statoMaster = n.Stato;
            idBoxPilota = n.IdElemento ?? 0;
            dataCorrezionePilota = n.DataCorrezione;
            correttorePilota = await NomeAsync(n.IdCorrettore);
            var a = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == n.IdAutore);
            vista.Autore = a == null ? "" : $"{a.Nome} {a.Cognome}";
            vista.TipoAutore = a == null ? "" : (a.Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : ServizioCorrezioni.TipoTesto(a.TipoUtenteFico));
        }
        else
        {
            var d = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == catena.IdDisegnoMaster);
            if (d == null) return EsitoCorrezione.No(404, "catena_non_trovata", "La correzione non esiste piu'.");
            vista.IdCorrezione = d.Id; vista.Simbolo = d.Simbolo; statoMaster = d.Stato;
            dataCorrezionePilota = d.DataCorrezione;
            correttorePilota = await NomeAsync(d.IdCorrettore);
            vista.Testo = ServizioCorrezioni.Timbri.TryGetValue(d.Simbolo, out var nome) ? nome : d.Simbolo;
            idBoxPilota = d.IdElemento ?? 0;
            var a = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == d.IdAutore);
            vista.Autore = a == null ? "" : $"{a.Nome} {a.Cognome}";
            vista.TipoAutore = a == null ? "" : (a.Ruolo == Ruoli.CodiceAgenzia ? "Agenzia" : ServizioCorrezioni.TipoTesto(a.TipoUtenteFico));
        }

        var adesso = DateTime.UtcNow;
        if (idBoxPilota > 0)
        {
            var p = await RigaAsync(idBoxPilota, adesso);
            if (p != null)
            {
                p.Stato = statoMaster;
                p.Attivo = statoMaster != StatoCorrezioneEliminata;
                p.StatoTesto = TestoStato(statoMaster, p.Attivo, p.VersioneSuperata);
                p.Correttore = correttorePilota;
                p.DataCorrezione = dataCorrezionePilota;
                p.PuoConfermare = u.Accetta && statoMaster == StatoCorrezioneDaFare
                                  && !p.Bloccato && p.GiorniAllaScadenza >= 0;
                vista.Pilota = p;
            }
        }

        var righe = await ctx.VolantiniPropagazioniElementis.AsNoTracking()
            .Where(pe => pe.IdPropagazione == catena.Id).OrderBy(pe => pe.Id).ToListAsync();
        var idCorrettori = righe.Where(pe => pe.IdCorrettore != null).Select(pe => pe.IdCorrettore!.Value).Distinct().ToList();
        var nomi = idCorrettori.Count == 0 ? new Dictionary<short, string>()
            : await ctx.Utentis.AsNoTracking().Where(x => idCorrettori.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => $"{x.Nome} {x.Cognome}");
        foreach (var pe in righe)
        {
            var r = await RigaAsync(pe.IdElemento, adesso);
            if (r == null) continue;
            r.Id = pe.Id;
            r.Stato = pe.Stato;
            r.Attivo = pe.Attivo;
            r.StatoTesto = TestoStato(pe.Stato, pe.Attivo, r.VersioneSuperata);
            r.DataCorrezione = pe.DataCorrezione;
            r.Correttore = pe.IdCorrettore == null ? "" : (nomi.TryGetValue(pe.IdCorrettore.Value, out var nc) ? nc : "");
            r.PuoConfermare = u.Accetta && pe.Attivo && pe.Stato == StatoCorrezioneDaFare
                              && !r.Bloccato && r.GiorniAllaScadenza >= 0;
            vista.Propagati.Add(r);
        }
        // ordine dell'originale: prima la promo del pilota, poi le altre, i superati in coda
        string promoPilota = vista.Pilota?.Promo ?? "";
        vista.Propagati = vista.Propagati
            .OrderBy(r => r.VersioneSuperata)
            .ThenByDescending(r => r.Promo == promoPilota)
            .ThenBy(r => r.Promo).ThenBy(r => r.Volantino).ThenBy(r => r.Pagina).ToList();

        int attiviTot = vista.Propagati.Count;
        int attivi = vista.Propagati.Count(r => r.Attivo);
        vista.PercentualeAttivati = attiviTot == 0 ? 0
            : ((adesso - catena.DataRegistrazione).TotalMinutes > MinutiLampeggio ? 100 : attivi * 100 / attiviTot);
        int tot = vista.Propagati.Count(r => r.Attivo && r.Stato != StatoCorrezioneEliminata);
        int prog = vista.Propagati.Count(r => r.Attivo && Fatta(r.Stato));
        if (statoMaster != StatoCorrezioneEliminata) { tot++; if (Fatta(statoMaster)) prog++; }
        vista.PercentualeFatti = tot <= 0 ? 0 : prog * 100 / tot;
        vista.PromoDiverse = vista.Propagati.Any(r => r.Promo != promoPilota);
        // j230: il bottone «ELIMINA DEFINITIVAMENTE» dell'originale (correzioni.js:4573-4577 lo
        // nascondeva all'Agenzia, 4751 e 4801 se pilota o una riga non erano in stato 0 o 2).
        vista.PuoEliminare = u.Scrive && !vista.InCostruzione && catena.Attivo != CatenaInattiva
            && (statoMaster == StatoCorrezioneDaFare || statoMaster == StatoCorrezioneEliminata)
            && vista.Propagati.All(r => r.Stato == StatoCorrezioneDaFare || r.Stato == StatoCorrezioneEliminata);
        return EsitoCorrezione.Fatto(vista);
    }

    private async Task<string> NomeAsync(short? idUtente)
    {
        if (idUtente == null) return "";
        var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == idUtente);
        return u == null ? "" : $"{u.Nome} {u.Cognome}";
    }

    /// <summary>Una riga della finestra: da dove viene quel box.</summary>
    private async Task<VocePropagata?> RigaAsync(long idBox, DateTime adesso)
    {
        var dati = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                          join pg in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals pg.Id
                          join v in ctx.Volantinis.AsNoTracking() on pg.IdVol equals v.Id
                          where e.Id == idBox
                          select new
                          {
                              e.Basecode, e.Dna, pg.Numero, pg.Versione, pg.IdVersione,
                              v.Id, v.Titolo, v.Classificazione, v.DataScadenza, v.IdAutoreBlocco, v.DataScadenzaBlocco,
                              // j232: il ritaglio del prodotto nella finestra, come il vecchio
                              // (thumbnailbox.aspx). La pagina e' un file statico, quindi basta l'indirizzo
                              // piu' la geometria del box: il ritaglio lo fa il browser.
                              e.PosizioneX, e.PosizioneY, BoxL = e.Larghezza, BoxA = e.Altezza,
                              PagL = pg.Larghezza, PagA = pg.Altezza
                          }).FirstOrDefaultAsync();
        if (dati == null) return null;
        bool superata = dati.IdVersione != null && await ctx.VolantiniVersionis.AsNoTracking()
            .AnyAsync(v => v.Id == dati.IdVersione && v.DataChiusura != null);
        string descr = "";
        if (!string.IsNullOrWhiteSpace(dati.Dna))
        {
            try
            {
                using var d = JsonDocument.Parse(dati.Dna);
                if (d.RootElement.ValueKind == JsonValueKind.Object && d.RootElement.TryGetProperty("descrizione", out var de)
                    && de.ValueKind == JsonValueKind.String)
                    descr = System.Text.RegularExpressions.Regex.Replace(de.GetString() ?? "", "</?[A-Z0-9_]+>", " ").Trim();
            }
            catch (JsonException) { }
        }
        return new VocePropagata
        {
            IdBox = idBox,
            IdVolantino = dati.Id,
            Volantino = dati.Titolo,
            Promo = dati.Classificazione,
            Pagina = dati.Numero,
            Versione = dati.Versione,
            VersioneSuperata = superata,
            Etichetta = descr == "" ? dati.Basecode : $"{dati.Basecode} – {descr}",
            Codici = dati.Basecode,
            Bloccato = dati.IdAutoreBlocco != null && dati.DataScadenzaBlocco != null && dati.DataScadenzaBlocco > adesso,
            GiorniAllaScadenza = (int)Math.Floor((dati.DataScadenza - adesso).TotalDays),
            // stesso indirizzo che usa l'editor per le pagine (VolantiniController.CorrezioniAsync)
            UrlPagina = Indirizzi.Con(http.HttpContext, "/volantini/" + Uri.EscapeDataString(dati.Classificazione) + "/"
                        + Uri.EscapeDataString(dati.Titolo) + $"/pag{dati.Numero}_v{dati.Versione}.jpg"),
            Px = (double)dati.PosizioneX,
            Py = (double)dati.PosizioneY,
            Pw = (double)dati.BoxL,
            Ph = (double)dati.BoxA,
            PagW = (double)dati.PagL,
            PagH = (double)dati.PagA
        };
    }

    private static string TestoStato(short stato, bool attivo, bool superata) => stato switch
    {
        StatoCorrezioneFatta => "Fatta",
        StatoCorrezioneRevisionata => "Revisionata",
        StatoCorrezioneIrrisolta => "Irrisolta",
        StatoCorrezioneEliminata => attivo ? "Annullata" : "Non propagato",
        _ => superata ? "Non eseguita" : "Da fare"
    };

    // ------------------------------------------------------------------ attivazione

    /// <summary>
    /// attivaPropagazione dell'originale (S:6024-6069) sul propagato: lo accende (da fare) o lo spegne
    /// (suggerimento). Controlli nello stesso ordine: catena spenta, volantino bloccato, correzione
    /// già fatta, volantino scaduto, valore già uguale.
    /// </summary>
    public async Task<EsitoCorrezione> AttivaAsync(ServizioCorrezioni.Utente u, long idPropagato, bool attiva)
    {
        if (!u.Scrive) return EsitoCorrezione.No(403, "non_autorizzato", "Le propagazioni le attiva chi scrive le correzioni.");
        var pe = await ctx.VolantiniPropagazioniElementis.FirstOrDefaultAsync(x => x.Id == idPropagato);
        if (pe == null) return EsitoCorrezione.No(404, "non_trovata", "Questa propagazione non esiste piu'.");
        var errore = await ControlliAsync(pe.IdPropagazione, pe.IdElemento);
        if (errore != null) return errore;
        if (pe.Stato == StatoCorrezioneFatta)
            return EsitoCorrezione.No(409, "gia_fatta", "Questa propagazione e' già stata eseguita dall'Agenzia.");
        if (pe.Attivo == attiva) return EsitoCorrezione.No(409, "uguale", "Era già così.");

        pe.Attivo = attiva;
        pe.Stato = attiva ? StatoCorrezioneDaFare : StatoCorrezioneEliminata;
        pe.IdAutore = u.Id;
        pe.DataAttivazione = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        return EsitoCorrezione.Fatto(new { id = pe.Id, attivo = pe.Attivo });
    }

    /// <summary>attivaInteraCatenaDiPropagazione (S:6089): tutti i gemelli, ma in una sola transazione.</summary>
    public async Task<EsitoCorrezione> AttivaTuttiAsync(ServizioCorrezioni.Utente u, long idCatena, bool attiva)
    {
        if (!u.Scrive) return EsitoCorrezione.No(403, "non_autorizzato", "Le propagazioni le attiva chi scrive le correzioni.");
        var catena = await ctx.VolantiniPropagazionis.AsNoTracking().FirstOrDefaultAsync(p => p.Id == idCatena);
        if (catena == null || catena.Attivo == CatenaInattiva)
            return EsitoCorrezione.No(404, "catena_non_trovata", "Questa propagazione non esiste piu'.");

        var righe = await ctx.VolantiniPropagazioniElementis.Where(pe => pe.IdPropagazione == idCatena).ToListAsync();
        int cambiati = 0, saltati = 0;
        var adesso = DateTime.UtcNow;
        foreach (var pe in righe)
        {
            if (pe.Attivo == attiva || pe.Stato == StatoCorrezioneFatta) { saltati++; continue; }
            if (await ControlliAsync(idCatena, pe.IdElemento) != null) { saltati++; continue; }
            pe.Attivo = attiva;
            pe.Stato = attiva ? StatoCorrezioneDaFare : StatoCorrezioneEliminata;
            pe.IdAutore = u.Id;
            pe.DataAttivazione = adesso;
            cambiati++;
        }
        if (cambiati > 0) await ctx.SaveChangesAsync();
        return EsitoCorrezione.Fatto(new { cambiati, saltati });
    }

    /// <summary>Controlli comuni dell'originale sul volantino del gemello e sulla catena.</summary>
    private async Task<EsitoCorrezione?> ControlliAsync(long idCatena, long idBox)
    {
        var catena = await ctx.VolantiniPropagazionis.AsNoTracking().FirstOrDefaultAsync(p => p.Id == idCatena);
        if (catena == null || catena.Attivo == CatenaInattiva)
            return EsitoCorrezione.No(409, "catena_spenta", "La correzione di partenza e' stata eliminata.");
        var vol = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                         join pg in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals pg.Id
                         join v in ctx.Volantinis.AsNoTracking() on pg.IdVol equals v.Id
                         where e.Id == idBox select v).FirstOrDefaultAsync();
        if (vol == null) return EsitoCorrezione.No(404, "non_trovata", "Il prodotto non esiste piu'.");
        var adesso = DateTime.UtcNow;
        if (ServizioCorrezioni.Bloccato(vol, adesso))
            return EsitoCorrezione.No(423, "volantino_bloccato", $"«{vol.Titolo}» e' bloccato in ripubblicazione: riprova piu' tardi.");
        if (ServizioCorrezioni.Scaduto(vol, adesso))
            return EsitoCorrezione.No(423, "volantino_scaduto", $"«{vol.Titolo}» e' scaduto: non si corregge piu'.");
        return null;
    }
}
