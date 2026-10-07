using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Le notifiche dell'utente (j243): quello che si apre dalla campanella della home, e il
/// "semaforo verde" deciso da Michele il 16/9.
///
/// COSA FA NASCERE UNA NOTIFICA
///  - la finestra dei Category di una promo che si APRE  -> avviso a Category e Marketing
///    («si puo' iniziare a correggere»);
///  - la stessa finestra che si CHIUDE -> avviso all'Agenzia («le correzioni sono da lavorare»).
///  Le altre notifiche (date, blocco, sblocco, revoca) le scriveva gia' ServizioPromo (j209):
///  qui si limitano a comparire nell'elenco con una frase leggibile.
///  Le notifiche sulle singole correzioni NON si fanno: scelta di Michele, altrimenti a ogni
///  nota tutti ricevono un avviso e il semaforo si perde nel rumore.
///
/// COME SI EVITANO I DOPPIONI
///  La tabella `notifiche` non ha un posto per la promo (il vincolo ck_notifiche_un_solo_target
///  vuole un bersaglio solo), quindi la notifica si attacca a un volantino della promo che fa da
///  ancora, e il giorno della finestra finisce dentro il `tag`: "fin_ap_20260925".
///  Cosi' una finestra nuova (giorno diverso) fa un avviso nuovo, e lo stesso giro del demone
///  ripetuto mille volte non ne fa mille.
///
/// FASCIA DI SICUREZZA
///  Si guardano solo le finestre che si sono aperte o chiuse negli ultimi 7 giorni: se il demone
///  resta fermo a lungo, o si riparte da zero, non arriva una valanga di avvisi vecchi.
/// </summary>
public sealed class ServizioNotifiche
{
    /// <summary>Quante notifiche mostra la tendina della campanella.</summary>
    public const int QuanteNeMostro = 30;

    /// <summary>Quanti giorni indietro si guarda: oltre, la finestra e' storia.</summary>
    public const int GiorniIndietro = 7;

    public const string TagAperta = "fin_ap_";
    public const string TagChiusa = "fin_ch_";

    private readonly Correggo4Context ctx;

    public ServizioNotifiche(Correggo4Context ctx) => this.ctx = ctx;

    // ------------------------------------------------------------------ lettura

    /// <summary>L'elenco per la tendina: le piu' recenti in cima, lette e non lette insieme.</summary>
    public async Task<object> ElencoAsync(short idUtente)
    {
        var righe = await (from n in ctx.Notifiches.AsNoTracking()
                           join v in ctx.Volantinis.AsNoTracking() on n.IdVolantino equals (int?)v.Id into av
                           from v in av.DefaultIfEmpty()
                           where n.IdUtente == idUtente
                           orderby n.DataRegistrazione descending, n.Id descending
                           select new
                           {
                               n.Id,
                               n.Tag,
                               n.IdVolantino,
                               n.DataRegistrazione,
                               n.DataLettura,
                               titolo = v == null ? null : v.Titolo,
                               promo = v == null ? null : v.Classificazione
                           })
                          .Take(QuanteNeMostro)
                          .ToListAsync();

        var voci = righe.Select(r =>
        {
            var (testo, link, semaforo) = Frase(r.Tag, r.promo, r.titolo, r.IdVolantino);
            return new
            {
                id = r.Id,
                testo,
                link,
                semaforo,
                data = r.DataRegistrazione,
                letta = r.DataLettura != null
            };
        }).ToList();

        int nonLette = await NonLetteAsync(idUtente);
        long ultimo = await ctx.Notifiches.AsNoTracking()
            .Where(n => n.IdUtente == idUtente)
            .MaxAsync(n => (long?)n.Id) ?? 0L;
        return new { quanteNonLette = nonLette, ultimoId = ultimo, voci };
    }

    /// <summary>
    /// Il giro che fa la pagina ogni minuto: quante non lette, e quali sono arrivate dopo quella
    /// che il browser ha gia' visto. `dopo = 0` significa "prima volta": non e' novita', quindi
    /// non suona niente (altrimenti suonerebbe a ogni ricarica).
    /// </summary>
    public async Task<object> NuoveAsync(short idUtente, long dopo)
    {
        int nonLette = await NonLetteAsync(idUtente);
        long ultimo = await ctx.Notifiches.AsNoTracking()
            .Where(n => n.IdUtente == idUtente)
            .MaxAsync(n => (long?)n.Id) ?? 0L;

        if (dopo <= 0)
            return new { quanteNonLette = nonLette, ultimoId = ultimo, suona = false, nuove = new List<object>() };

        var righe = await (from n in ctx.Notifiches.AsNoTracking()
                           join v in ctx.Volantinis.AsNoTracking() on n.IdVolantino equals (int?)v.Id into av
                           from v in av.DefaultIfEmpty()
                           where n.IdUtente == idUtente && n.Id > dopo
                           orderby n.Id descending
                           select new
                           {
                               n.Id,
                               n.Tag,
                               n.IdVolantino,
                               n.DataRegistrazione,
                               titolo = v == null ? null : v.Titolo,
                               promo = v == null ? null : v.Classificazione
                           })
                          .Take(10)
                          .ToListAsync();

        var nuove = righe.Select(r =>
        {
            var (testo, link, semaforo) = Frase(r.Tag, r.promo, r.titolo, r.IdVolantino);
            return new { id = r.Id, testo, link, semaforo, data = r.DataRegistrazione };
        }).ToList();

        // Suona solo il semaforo (finestra aperta o chiusa): le altre novita' aggiornano il
        // numerino in silenzio. Michele, 16/9: il suono serve a chi aspetta il via.
        return new
        {
            quanteNonLette = nonLette,
            ultimoId = ultimo,
            suona = nuove.Any(x => x.semaforo),
            nuove
        };
    }

    public Task<int> NonLetteAsync(short idUtente) =>
        ctx.Notifiches.AsNoTracking().CountAsync(n => n.IdUtente == idUtente && n.DataLettura == null);

    // ------------------------------------------------------------------ scrittura

    /// <summary>
    /// «Segna tutte come lette» (scelta di Michele: non si azzerano da sole all'apertura).
    /// Si scrive solo `data_lettura`: `stato` resta come l'ha messo chi ha creato la notifica,
    /// perche' il significato dei suoi valori nell'originale non e' documentato.
    /// </summary>
    public async Task<object> SegnaLetteAsync(short idUtente)
    {
        var adesso = DateTime.UtcNow;
        int quante = await ctx.Notifiches
            .Where(n => n.IdUtente == idUtente && n.DataLettura == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.DataLettura, adesso));
        return new { segnate = quante, quanteNonLette = 0 };
    }

    /// <summary>Se l'utente vuole le email di notifica. Nessuna riga = si'.</summary>
    public async Task<bool> EmailAttiveAsync(short idUtente) =>
        await ctx.Impostazioni.AsNoTracking()
            .Where(x => x.IdUtente == idUtente)
            .Select(x => (bool?)x.EmailNotifiche)
            .FirstOrDefaultAsync() ?? true;

    public async Task<object> LeggiEmailAsync(short idUtente) =>
        new { emailAttive = await EmailAttiveAsync(idUtente) };

    public async Task<object> SalvaEmailAsync(short idUtente, bool attive)
    {
        var riga = await ctx.Impostazioni.FirstOrDefaultAsync(x => x.IdUtente == idUtente);
        if (riga == null)
        {
            riga = new UtentiImpostazioni { IdUtente = idUtente };
            ctx.Impostazioni.Add(riga);
        }
        riga.EmailNotifiche = attive;
        riga.DataModifica = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
        return new { emailAttive = attive };
    }

    // ------------------------------------------------------------------ il semaforo

    /// <summary>
    /// Il giro del semaforo, chiamato dal demone. Guarda le finestre dei Category e scrive gli
    /// avvisi che mancano. Restituisce quanti ne ha scritti.
    /// </summary>
    public async Task<int> SemaforoAsync(CancellationToken ferma = default)
    {
        var adesso = DateTime.UtcNow;
        var da = adesso.AddDays(-GiorniIndietro);

        var finestre = await ctx.VolantiniFinestreCategories.AsNoTracking().ToListAsync(ferma);
        if (finestre.Count == 0) return 0;

        // Chi deve sapere che si puo' correggere: Category e Marketing, cioe' tutti i non-Agenzia
        // (la colonna `ruolo` ammette solo i due valori). Chi deve sapere che la finestra e'
        // chiusa: l'Agenzia, che da quel momento lavora le correzioni.
        var gdo = await ctx.Utentis.AsNoTracking()
            .Where(u => u.Attivo && u.Ruolo != Ruoli.CodiceAgenzia).Select(u => u.Id).ToListAsync(ferma);
        var agenzia = await ctx.Utentis.AsNoTracking()
            .Where(u => u.Attivo && u.Ruolo == Ruoli.CodiceAgenzia).Select(u => u.Id).ToListAsync(ferma);

        int fatte = 0;
        foreach (var f in finestre)
        {
            bool apertaOra = f.DataInizio <= adesso && f.DataInizio > da;
            bool chiusaOra = f.DataFine < adesso && f.DataFine > da;
            if (!apertaOra && !chiusaOra) continue;

            // Il volantino d'ancora serve solo al vincolo della tabella: la frase parla della
            // promo e il collegamento porta alla home, dove la promo si vede tutta.
            int? ancora = await ctx.Volantinis.AsNoTracking()
                .Where(v => v.Classificazione == f.Classificazione)
                .OrderByDescending(v => v.Id)
                .Select(v => (int?)v.Id)
                .FirstOrDefaultAsync(ferma);
            if (ancora == null) continue;

            if (apertaOra && gdo.Count > 0)
                fatte += await AvvisaAsync(gdo, ancora.Value, TagAperta + Giorno(f.DataInizio), adesso, ferma);
            if (chiusaOra && agenzia.Count > 0)
                fatte += await AvvisaAsync(agenzia, ancora.Value, TagChiusa + Giorno(f.DataFine), adesso, ferma);
        }

        if (fatte > 0) await ctx.SaveChangesAsync(ferma);
        return fatte;
    }

    private async Task<int> AvvisaAsync(List<short> utenti, int idVol, string tag,
                                        DateTime adesso, CancellationToken ferma)
    {
        var gia = await ctx.Notifiches.AsNoTracking()
            .Where(n => n.IdVolantino == idVol && n.Tag == tag)
            .Select(n => n.IdUtente)
            .ToListAsync(ferma);

        var mancanti = utenti.Except(gia).ToList();
        foreach (short id in mancanti)
            ctx.Notifiches.Add(new Notifiche
            {
                IdUtente = id,
                IdVolantino = idVol,
                Tag = tag,
                Stato = 0,
                DataRegistrazione = adesso
            });
        return mancanti.Count;
    }

    private static string Giorno(DateTime utc) => FinestreCategory.Locale(utc).ToString("yyyyMMdd");

    // ------------------------------------------------------------------ le frasi

    /// <summary>
    /// Da tag a frase leggibile. Niente lettere accentate: il resto del codice fa lo stesso e
    /// cosi' il testo non cambia passando per JSON, log e collaudi.
    /// </summary>
    private static (string testo, string? link, bool semaforo) Frase(string? tag, string? promo,
                                                                    string? titolo, int? idVol)
    {
        string p = string.IsNullOrWhiteSpace(promo) ? "una promo" : promo!;
        string t = string.IsNullOrWhiteSpace(titolo) ? "un volantino" : titolo!;
        string? aVolantino = idVol == null ? "/Volantini" : "/Volantini/Dettaglio/" + idVol;

        if (tag != null && tag.StartsWith(TagAperta, StringComparison.Ordinal))
            return ($"Semaforo verde su «{p}»: la finestra dei Category e' aperta, si puo' correggere.",
                    "/Volantini", true);

        if (tag != null && tag.StartsWith(TagChiusa, StringComparison.Ordinal))
            return ($"La finestra dei Category su «{p}» e' chiusa: le correzioni sono da lavorare.",
                    "/Volantini", true);

        return tag switch
        {
            "date"    => ($"Sono cambiate le date della promo «{p}».", "/Volantini", false),
            "blocco"  => ($"Il volantino «{t}» e' stato bloccato.", aVolantino, false),
            "sblocco" => ($"Il volantino «{t}» e' stato sbloccato.", aVolantino, false),
            "revoca"  => ($"E' stata revocata una versione del volantino «{t}».", aVolantino, false),
            _         => ($"C'e' una novita' su «{t}».", aVolantino, false)
        };
    }
}
