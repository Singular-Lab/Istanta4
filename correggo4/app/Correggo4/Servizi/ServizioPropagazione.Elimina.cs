using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// «ELIMINA DEFINITIVAMENTE» (j230): la scelta di NON propagare una correzione.
///
/// Nell'originale la catena nasceva sempre e la scelta stava nella finestra del megafono:
/// il bottone di `Main.aspx:501` chiamava `Propagazioni.eliminaPropagazione` (correzioni.js:5503)
/// che chiedeva *«Sicuro di voler eliminare l'intera propagazione?»* e poi
/// `Service.eliminaPropagazione` (Service.cs:4666-4832). Lì la catena passava a **Inattiva**:
/// la correzione restava, ma solo sul suo volantino; i suggerimenti sparivano dai gemelli e il
/// megafono non compariva più.
///
/// Differenze volute rispetto all'originale:
/// - **non** accodiamo il `demone_activity` tipo 2 (Rimuovi): serviva ai contatori e alle notifiche,
///   che in Correggo4 non hanno un demone (stessa scelta del j224 sulla conferma);
/// - l'originale rispondeva al client i contatori dei box gemelli da decrementare a video senza
///   però riscriverli in banca dati: qui non serve, l'editor rilegge lo stato vero ogni volta.
/// </summary>
public sealed partial class ServizioPropagazione
{
    public async Task<EsitoCorrezione> EliminaAsync(ServizioCorrezioni.Utente u, long idCatena)
    {
        if (!u.Scrive)
            return EsitoCorrezione.No(403, "non_autorizzato",
                "La propagazione la elimina chi scrive le correzioni.");

        var catena = await ctx.VolantiniPropagazionis.FirstOrDefaultAsync(p => p.Id == idCatena);
        if (catena == null)
            return EsitoCorrezione.No(404, "catena_non_trovata", "Questa propagazione non esiste piu'.");
        if (catena.Attivo == CatenaInattiva)
            return EsitoCorrezione.No(409, "gia_eliminata", "Questa propagazione era già stata eliminata.");
        if (catena.Attivo == CatenaInCostruzione || await ctx.DemoneActivities.AsNoTracking()
                .AnyAsync(a => a.IdPropagazione == idCatena && a.TipoAzione == AzioneCostruzioneCatena
                               && a.DataProcesso == null))
            return EsitoCorrezione.No(409, "in_costruzione",
                "La catena e' ancora in costruzione: riprova fra qualche secondo.");

        // il pilota: se l'Agenzia l'ha già eseguita non si torna indietro (come l'originale)
        short statoMaster;
        string cosa;
        if (catena.IdNotaMaster != null)
        {
            var n = await ctx.VolantiniPagineNotes.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == catena.IdNotaMaster);
            if (n == null) return EsitoCorrezione.No(404, "catena_non_trovata", "La correzione non esiste piu'.");
            statoMaster = n.Stato;
            cosa = "nota";
            if (n.DataCorrezione != null) statoMaster = StatoCorrezioneFatta;
        }
        else
        {
            var d = await ctx.VolantiniPagineDisegniComposizionis.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == catena.IdDisegnoMaster);
            if (d == null) return EsitoCorrezione.No(404, "catena_non_trovata", "La correzione non esiste piu'.");
            statoMaster = d.Stato;
            cosa = "timbro";
            if (d.DataCorrezione != null) statoMaster = StatoCorrezioneFatta;
        }
        if (statoMaster == StatoCorrezioneFatta || statoMaster == StatoCorrezioneRevisionata)
            return EsitoCorrezione.No(409, "non_eliminabile",
                $"La {cosa} di partenza e' già stata eseguita: la propagazione non si elimina piu'.");

        // i gemelli attivati: nessuno deve aver già corretto (l'originale guardava data_correzione)
        var righe = await ctx.VolantiniPropagazioniElementis.AsNoTracking()
            .Where(pe => pe.IdPropagazione == idCatena && pe.Attivo).ToListAsync();
        if (righe.Any(pe => pe.DataCorrezione != null || pe.Stato == StatoCorrezioneFatta
                            || pe.Stato == StatoCorrezioneRevisionata))
            return EsitoCorrezione.No(409, "non_eliminabile",
                "Alcune delle propagazioni sono già state corrette: non si elimina piu'.");

        // e i loro volantini devono essere liberi, come l'originale
        var adesso = DateTime.UtcNow;
        if (righe.Count > 0)
        {
            var idBox = righe.Select(pe => pe.IdElemento).Distinct().ToList();
            var volantini = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                                   join pg in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals pg.Id
                                   join v in ctx.Volantinis.AsNoTracking() on pg.IdVol equals v.Id
                                   where idBox.Contains(e.Id)
                                   select v).Distinct().ToListAsync();
            var bloccato = volantini.FirstOrDefault(v => ServizioCorrezioni.Bloccato(v, adesso));
            if (bloccato != null)
                return EsitoCorrezione.No(423, "volantino_bloccato",
                    $"«{bloccato.Titolo}» e' bloccato in ripubblicazione: riprova piu' tardi.");
            var chiuso = volantini.FirstOrDefault(v => v.Status != StatoVolantinoAperto
                                                       || ServizioCorrezioni.Scaduto(v, adesso));
            if (chiuso != null)
                return EsitoCorrezione.No(423, "volantino_chiuso",
                    $"«{chiuso.Titolo}» non e' piu' in correzione: contatta l'Agenzia.");
        }

        catena.Attivo = CatenaInattiva;
        await ctx.SaveChangesAsync();
        log.LogInformation("Propagazione {Catena} eliminata dall'utente {Utente} ({Righe} gemelli attivati)",
            idCatena, u.Id, righe.Count);
        return EsitoCorrezione.Fatto(new { eliminata = idCatena, gemelli = righe.Count });
    }
}
