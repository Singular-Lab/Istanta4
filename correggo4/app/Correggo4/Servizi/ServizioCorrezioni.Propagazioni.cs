using Correggo4.Models.Vista;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// La conferma delle propagazioni da parte dell'Agenzia (j224).
/// Nell'originale erano tre servizi diversi (`confermaNota`/`confermaDisegno` per la singola riga,
/// `confermaSelezioneDiPropagazione` per le righe spuntate, `confermaInteraCatenaDiPropagazione` per
/// tutte) che scrivevano le stesse tre colonne. Qui c'e' una sola strada, con la selezione passata dal
/// client: la riga singola e' una selezione di uno, "Conferma tutti" e' la selezione di tutte piu' il
/// pilota. Sta dentro ServizioCorrezioni (classe parziale) perche' la conferma del pilota e' la stessa
/// accettazione della correzione (AccettaNotaAsync / AccettaTimbroAsync) e deve stare nella stessa
/// transazione dei gemelli: l'originale non aveva transazione e un errore a metà lasciava la catena
/// mezza confermata (relazione-propagazioni.md § 6.6).
/// </summary>
public sealed partial class ServizioCorrezioni
{
    /// <summary>Esito di una conferma: quante righe sono passate, quante saltate e perche'.</summary>
    public sealed record EsitoConferma(int Confermati, int Saltati, string? Motivo);

    public Task<EsitoCorrezione> ConfermaPropagazioniAsync(Utente u, long idCatena,
                                                           List<long>? selezionati, bool ancheIlPilota) =>
        ConfermaCatenaAsync(u, idCatena, selezionati ?? new List<long>(), ancheIlPilota);

    private async Task<EsitoCorrezione> ConfermaCatenaAsync(Utente u, long idCatena,
                                                            List<long> selezionati, bool ancheIlPilota)
    {
        if (!u.Accetta) return NonAutorizzato("Le propagazioni le conferma l'Agenzia.");

        var catena = await ctx.VolantiniPropagazionis.AsNoTracking().FirstOrDefaultAsync(p => p.Id == idCatena);
        if (catena == null || catena.Attivo == ServizioPropagazione.CatenaInattiva)
            return EsitoCorrezione.No(404, "catena_non_trovata", "Questa propagazione non esiste più.");
        if (catena.Attivo == ServizioPropagazione.CatenaInCostruzione)
            return EsitoCorrezione.No(409, "in_costruzione",
                "La propagazione è ancora in costruzione: riprova fra qualche secondo.");

        var ids = selezionati.Distinct().ToList();
        if (ids.Count == 0 && !ancheIlPilota)
            return EsitoCorrezione.No(400, "niente_da_confermare", "Non hai scelto nessuna propagazione.");

        // Il tempo di battitura si misura sulla nota di partenza e vale per tutta la catena, come
        // l'originale (S:6650-6652: la soglia e' sulla data_modifica del pilota anche per i propagati).
        // I timbri non hanno battitura, ne' nell'originale ne' qui.
        if (catena.IdNotaMaster != null)
        {
            var nota = await ctx.VolantiniPagineNotes.AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == catena.IdNotaMaster);
            if (nota == null) return NonTrovata("La correzione di partenza non esiste più.");
            if (nota.Tipo == TipoNotaPromemoria)
                return EsitoCorrezione.No(409, "promemoria", "Un promemoria non si conferma.");
            int mancano = SecondiBattitura -
                (int)Math.Floor((DateTime.UtcNow - (nota.DataModifica ?? nota.DataInserimento)).TotalSeconds);
            if (mancano > 0)
                return new EsitoCorrezione(false, 409, "in_battitura",
                    $"La correzione è stata scritta da poco: si potrà confermare tra {TempoLeggibile(mancano)}.",
                    new { secondi = mancano });
        }

        var righe = await ctx.VolantiniPropagazioniElementis
            .Where(pe => pe.IdPropagazione == idCatena && ids.Contains(pe.Id))
            .OrderBy(pe => pe.Id).ToListAsync();

        // I volantini dei gemelli in un colpo solo: servono per bloccato / scaduto.
        var idBox = righe.Select(r => r.IdElemento).ToList();
        var volantini = await (from e in ctx.VolantiniPagineElementis.AsNoTracking()
                               join pg in ctx.VolantiniPagines.AsNoTracking() on e.IdPagina equals pg.Id
                               join v in ctx.Volantinis.AsNoTracking() on pg.IdVol equals v.Id
                               where idBox.Contains(e.Id)
                               select new { IdBox = e.Id, Volantino = v }).ToListAsync();
        var perBox = volantini.ToDictionary(x => x.IdBox, x => x.Volantino);

        int confermati = 0, saltati = ids.Count - righe.Count;
        var motivi = new List<string>();
        if (saltati > 0) motivi.Add("qualche proposta non c'è più");

        await using var tx = await ctx.Database.BeginTransactionAsync();

        if (ancheIlPilota)
        {
            var esito = catena.IdNotaMaster != null
                ? await AccettaNotaAsync(u, catena.IdNotaMaster.Value)
                : await AccettaTimbroAsync(u, catena.IdDisegnoMaster!.Value);
            if (esito.Ok) confermati++;
            else if (esito.Codice == "gia_accettata")
            {
                saltati++; motivi.Add("la correzione di partenza era già confermata");
            }
            else
            {
                // Come l'originale (S:6203-6207): se il pilota non si puo' confermare si esce con
                // il suo errore, senza toccare i gemelli.
                await tx.RollbackAsync();
                return esito;
            }
        }

        var adesso = DateTime.UtcNow;
        foreach (var pe in righe)
        {
            if (pe.Stato == ServizioPropagazione.PropFatta)
            {
                saltati++; motivi.Add("qualcuna era già fatta"); continue;
            }
            if (!pe.Attivo || pe.Stato != ServizioPropagazione.PropDaFare)
            {
                saltati++; motivi.Add("qualcuna non era attivata"); continue;
            }
            if (!perBox.TryGetValue(pe.IdElemento, out var vol))
            {
                saltati++; motivi.Add("qualche prodotto non c'è più"); continue;
            }
            if (Bloccato(vol, adesso))
            {
                saltati++; motivi.Add($"«{vol.Titolo}» è bloccato in ripubblicazione"); continue;
            }
            if (Scaduto(vol, adesso))
            {
                saltati++; motivi.Add($"«{vol.Titolo}» è scaduto"); continue;
            }
            pe.Stato = ServizioPropagazione.PropFatta;
            pe.IdCorrettore = u.Id;
            pe.DataCorrezione = adesso;
            confermati++;
        }

        if (confermati > 0) await ctx.SaveChangesAsync();
        await tx.CommitAsync();

        if (confermati == 0)
            return EsitoCorrezione.No(409, "niente_confermato",
                "Non c'era niente da confermare" + (motivi.Count > 0 ? ": " + string.Join(", ", motivi.Distinct()) + "." : "."));

        return EsitoCorrezione.Fatto(new EsitoConferma(confermati, saltati,
            motivi.Count == 0 ? null : string.Join(", ", motivi.Distinct())));
    }
}
