using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// I commenti generici di un volantino (j241), quelli del bottone "Commenti" della home.
/// Nell'originale non esistevano: c'era solo la chat attaccata a una singola correzione
/// (`volantini_correzzioni_messaggistica`), che resta fuori. Qui si scrive un appunto sul
/// volantino, lo leggono tutti (Category, Marketing e Agenzia) e resta la firma con la data.
/// </summary>
public sealed partial class ServizioCorrezioni
{
    public const int LunghezzaMassimaCommento = 2000;

    /// <summary>L'elenco dei commenti di un volantino, dal piu' recente.</summary>
    public async Task<EsitoCorrezione> CommentiAsync(int idVolantino)
    {
        var esiste = await ctx.Volantinis.AsNoTracking().AnyAsync(v => v.Id == idVolantino);
        if (!esiste) return EsitoCorrezione.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        var lista = await (from c in ctx.VolantiniCommentis.AsNoTracking()
                           join u in ctx.Utentis.AsNoTracking() on c.IdAutore equals u.Id into au
                           from u in au.DefaultIfEmpty()
                           where c.IdVol == idVolantino
                           orderby c.Data descending
                           select new
                           {
                               c.Id,
                               testo = c.Testo,
                               data = c.Data,
                               autore = u == null ? "—" : u.Nome + " " + u.Cognome,
                               tipoAutore = u == null ? "" : (u.Ruolo == Ruoli.CodiceAgenzia
                                   ? "Agenzia" : TipoTesto(u.TipoUtenteFico))
                           }).ToListAsync();

        return EsitoCorrezione.Fatto(new { quanti = lista.Count, commenti = lista });
    }

    /// <summary>Quanti commenti ha ogni volantino: un solo giro per tutte le card della home.</summary>
    public async Task<EsitoCorrezione> ContiCommentiAsync()
    {
        var conti = await ctx.VolantiniCommentis.AsNoTracking()
            .GroupBy(c => c.IdVol)
            .Select(g => new { idVol = g.Key, quanti = g.Count() })
            .ToListAsync();
        return EsitoCorrezione.Fatto(new { conti });
    }

    /// <summary>
    /// Scrive un commento. Lo possono scrivere tutti quelli che entrano nel volantino: non e' una
    /// correzione, quindi non passa dai controlli di blocco, scadenza e finestra.
    /// </summary>
    public async Task<EsitoCorrezione> AggiungiCommentoAsync(Utente u, int idVolantino, string? testo)
    {
        var esiste = await ctx.Volantinis.AsNoTracking().AnyAsync(v => v.Id == idVolantino);
        if (!esiste) return EsitoCorrezione.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        testo = (testo ?? "").Trim();
        if (testo.Length == 0)
            return EsitoCorrezione.No(400, "commento_vuoto", "Il commento e' vuoto.");
        if (testo.Length > LunghezzaMassimaCommento)
            return EsitoCorrezione.No(400, "commento_lungo",
                $"Il commento e' troppo lungo (massimo {LunghezzaMassimaCommento} caratteri).");

        var c = new VolantiniCommenti
        {
            IdVol = idVolantino,
            IdAutore = u.Id,
            Testo = testo,
            Data = DateTime.UtcNow
        };
        ctx.VolantiniCommentis.Add(c);
        await ctx.SaveChangesAsync();
        return await CommentiAsync(idVolantino);
    }
}
