using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// La policy di correzione letta dalla banca dati (j235) e il suo effetto sui prodotti (j236).
/// Nell'originale erano `login.aspx.cs:66` (policy in sessione), `Service.getPolicyPag`
/// (`Service.cs:754-792`) per il lucchetto del pannello pagine, e il campo `policyOn` che
/// `getCorrezioni` / `getElementiDelleRefByPag` mandavano per ogni prodotto — quello che il client
/// usava per disegnarli neri al 40% (`page.js:159`) e per non creare le zone cliccabili
/// dell'Edit avanzato (`tool.js:255-281`).
/// </summary>
public sealed partial class ServizioCorrezioni
{
    /// <summary>Null = nessun limite (nessuna riga in `utenti_policy`, o regole vuote).</summary>
    public async Task<PolicyCorrezione?> PolicyAsync(short idUtente)
    {
        var riga = await ctx.UtentiPolicies.AsNoTracking().FirstOrDefaultAsync(p => p.IdUtente == idUtente);
        var pol = PolicyCorrezione.Leggi(riga?.Policy);
        return pol == null || pol.SenzaRegole ? null : pol;
    }

    /// <summary>
    /// Quello che serve all'editor in un colpo solo: per ogni pagina dell'ultima versione se
    /// l'utente ha almeno un prodotto suo (il lucchetto, j235) e **quali prodotti non sono suoi**
    /// (j236). Senza policy: tutte le pagine permesse e nessun prodotto escluso, come l'originale.
    /// </summary>
    public async Task<EsitoCorrezione> PaginePermesseAsync(Utente u, int idVolantino)
    {
        var esiste = await ctx.Volantinis.AsNoTracking().AnyAsync(v => v.Id == idVolantino);
        if (!esiste) return EsitoCorrezione.No(404, "volantino_non_trovato", "Questo volantino non esiste.");

        short versione = await ctx.VolantiniPagines.Where(p => p.IdVol == idVolantino)
            .MaxAsync(p => (short?)p.Versione) ?? 0;
        var pagine = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVolantino && p.Versione == versione)
            .Select(p => new { p.Id, p.Numero })
            .OrderBy(p => p.Numero).ToListAsync();

        var policy = await PolicyAsync(u.Id);
        if (policy == null)
        {
            return EsitoCorrezione.Fatto(new
            {
                conPolicy = false,
                pagine = pagine.Select(p => new { numero = p.Numero, policyOk = true }),
                box = Array.Empty<long>(),
                timbriEsclusi = Array.Empty<string>()
            });
        }
        // j237: i timbri che la policy esclude (nell'originale i quattro di dimensione `_3_*`)
        var timbriEsclusi = Timbri.Keys.Where(k => !policy.StrumentoPermesso("timbro", k)).ToList();

        var idPagine = pagine.Select(p => p.Id).ToList();
        var numeroDi = pagine.ToDictionary(p => p.Id, p => p.Numero);
        // solo i box radice, e solo quello che serve alla verifica
        var box = await ctx.VolantiniPagineElementis.AsNoTracking()
            .Where(e => idPagine.Contains(e.IdPagina) && e.IdParent == null)
            .Select(e => new { e.Id, e.IdPagina, e.Contenuto }).ToListAsync();

        var permesse = new HashSet<short>();
        var fuori = new List<long>();
        foreach (var b in box)
        {
            short numero = numeroDi.TryGetValue(b.IdPagina, out var n) ? n : (short)0;
            if (policy.Check(SchemaReferenza.Leggi(b.Contenuto), numero)) permesse.Add(numero);
            else fuori.Add(b.Id);
        }

        return EsitoCorrezione.Fatto(new
        {
            conPolicy = true,
            pagine = pagine.Select(p => new { numero = p.Numero, policyOk = permesse.Contains(p.Numero) }),
            box = fuori,
            timbriEsclusi
        });
    }

    /// <summary>
    /// `minVersion` della policy (j237): l'originale, nella lista delle promo
    /// (`ftp.aspx.cs:139-142`), teneva solo i volantini con **almeno una versione &gt;= minVersion**.
    /// Restituisce gli id dei volantini da nascondere a questo utente; lista vuota = nessun filtro.
    /// </summary>
    public async Task<List<int>> VolantiniSottoMinVersionAsync(short idUtente, List<int> idVolantini)
    {
        var policy = await PolicyAsync(idUtente);
        if (policy == null || policy.MinVersion == 0 || idVolantini.Count == 0) return new();
        short minima = policy.MinVersion;
        var abbastanza = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => idVolantini.Contains(p.IdVol) && p.Versione >= minima)
            .Select(p => p.IdVol).Distinct().ToListAsync();
        return idVolantini.Where(id => !abbastanza.Contains(id)).ToList();
    }

    /// <summary>
    /// Il controllo che l'originale **non** faceva sul server (nascondeva e basta nel browser, e chi
    /// sapeva l'indirizzo scriveva comunque): se la policy non copre questo prodotto, niente
    /// correzioni. Passa da `BoxScrivibileAsync`, quindi vale per note, timbri, OK visto, Edit
    /// avanzato, carica foto e propagazione dell'Edit avanzato.
    /// Null = nessun problema.
    /// </summary>
    public async Task<EsitoCorrezione?> FuoriPolicyAsync(Utente u, VolantiniPagineElementi box)
    {
        var policy = await PolicyAsync(u.Id);
        if (policy == null) return null;
        short numero = await ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.Id == box.IdPagina).Select(p => p.Numero).FirstOrDefaultAsync();
        if (policy.Check(SchemaReferenza.Leggi(box.Contenuto), numero)) return null;
        return EsitoCorrezione.No(403, "fuori_policy",
            "Questo prodotto non è fra quelli che puoi correggere.");
    }
}
