using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// La finestra del Marketing sul timone (j253). E' la gemella della finestra dei Category di j209:
/// vale per **tutta la promo** (classificazione), ha una data di apertura e una di chiusura, e la
/// tabella ha la classificazione come chiave, quindi una promo ha una finestra sola.
///
/// Chi la apre e la chiude e' **solo l'Agenzia**, e lo puo' fare sempre: non passa da
/// PuoScrivereAsync, altrimenti a finestra aperta non potrebbe piu' chiuderla.
///
/// Le date arrivano dai campi datetime-local del browser, cioe' ora locale: qui si convertono in
/// UTC prima di scriverle, perche' FinestraAsync le confronta con DateTime.UtcNow.
/// </summary>
public sealed partial class ServizioTimone
{
    /// <summary>Com'e' messa la finestra di una promo, con lo stato in parole per la pagina.</summary>
    public sealed record StatoFinestra(
        bool Impostata, bool Aperta, DateTime? Inizio, DateTime? Fine, string Stato, string? Autore);

    private const string StatoNonImpostata = "";
    private const string StatoDaAprire = "da_aprire";
    private const string StatoAperta = "aperta";
    private const string StatoChiusa = "chiusa";

    /// <summary>Legge la finestra di una promo. Non serve nessun permesso: e' sola lettura.</summary>
    public async Task<StatoFinestra> LeggiFinestraAsync(string? classificazione)
    {
        if (string.IsNullOrWhiteSpace(classificazione))
            return new StatoFinestra(false, false, null, null, StatoNonImpostata, null);

        var f = await ctx.TimoneFinestre.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Classificazione == classificazione);
        if (f == null) return new StatoFinestra(false, false, null, null, StatoNonImpostata, null);

        var adesso = DateTime.UtcNow;
        string stato = adesso < f.DataInizio ? StatoDaAprire
                     : adesso > f.DataFine ? StatoChiusa
                     : StatoAperta;

        string? autore = await ctx.Utentis.AsNoTracking()
            .Where(u => u.Id == f.IdAutore).Select(u => u.Nome + " " + u.Cognome).FirstOrDefaultAsync();

        return new StatoFinestra(true, stato == StatoAperta, f.DataInizio, f.DataFine, stato, autore);
    }

    /// <summary>
    /// Apre (o risistema) la finestra del Marketing su una promo. Se non si dà l'inizio, parte
    /// adesso: e' il caso normale, l'Agenzia dice solo fino a quando.
    /// </summary>
    public async Task<Esito> SalvaFinestraAsync(Chi chi, string? classificazione, DateTime? inizio, DateTime? fine)
    {
        if (!chi.Agenzia)
            return Esito.No(403, "non_autorizzato", "La finestra del Marketing la apre l'Agenzia.");
        if (string.IsNullOrWhiteSpace(classificazione))
            return Esito.No(400, "promo_mancante", "Non so su quale promo aprire la finestra.");
        if (fine == null)
            return Esito.No(400, "data_mancante", "Serve la data di chiusura della finestra.");

        DateTime daUtc = InUtc(inizio) ?? DateTime.UtcNow;
        DateTime aUtc = InUtc(fine)!.Value;
        if (aUtc <= daUtc)
            return Esito.No(400, "date_al_rovescio", "La data di chiusura deve venire dopo quella di apertura.");

        var f = await ctx.TimoneFinestre.FirstOrDefaultAsync(x => x.Classificazione == classificazione);
        if (f == null)
        {
            ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
            {
                Classificazione = classificazione!,
                DataInizio = daUtc, DataFine = aUtc,
                IdAutore = chi.Id, DataModifica = DateTime.UtcNow
            });
        }
        else
        {
            f.DataInizio = daUtc; f.DataFine = aUtc;
            f.IdAutore = chi.Id; f.DataModifica = DateTime.UtcNow;
        }
        await ctx.SaveChangesAsync();

        return Esito.Fatto(await LeggiFinestraAsync(classificazione));
    }

    /// <summary>
    /// Chiude subito la finestra: la data di chiusura diventa adesso. La riga non si cancella,
    /// cosi' resta scritto chi l'aveva aperta e fino a quando.
    /// </summary>
    public async Task<Esito> ChiudiFinestraAsync(Chi chi, string? classificazione)
    {
        if (!chi.Agenzia)
            return Esito.No(403, "non_autorizzato", "La finestra del Marketing la chiude l'Agenzia.");
        if (string.IsNullOrWhiteSpace(classificazione))
            return Esito.No(400, "promo_mancante", "Non so su quale promo chiudere la finestra.");

        var f = await ctx.TimoneFinestre.FirstOrDefaultAsync(x => x.Classificazione == classificazione);
        if (f == null)
            return Esito.No(404, "finestra_non_trovata", "Su questa promo non c'e' nessuna finestra del Marketing.");

        var adesso = DateTime.UtcNow;
        // il vincolo della tabella vuole data_fine > data_inizio: se la finestra non era ancora
        // partita, si tira indietro anche l'inizio di un minuto
        if (f.DataInizio >= adesso) f.DataInizio = adesso.AddMinutes(-1);
        f.DataFine = adesso;
        f.IdAutore = chi.Id;
        f.DataModifica = adesso;
        await ctx.SaveChangesAsync();

        return Esito.Fatto(await LeggiFinestraAsync(classificazione));
    }

    /// <summary>La promo (classificazione) di un volantino: l'editor conosce solo il suo id.</summary>
    public Task<string?> PromoDelVolantinoAsync(int idVolantino) =>
        ctx.Volantinis.AsNoTracking().Where(v => v.Id == idVolantino)
            .Select(v => v.Classificazione).FirstOrDefaultAsync();

    /// <summary>
    /// Un'ora scritta nei campi del browser e' ora locale del server: si porta in UTC, perche' in
    /// banca dati le colonne sono "timestamp with time zone" e i confronti usano DateTime.UtcNow.
    /// </summary>
    private static DateTime? InUtc(DateTime? d) =>
        d == null ? null
        : d.Value.Kind == DateTimeKind.Utc ? d
        : DateTime.SpecifyKind(d.Value, DateTimeKind.Local).ToUniversalTime();
}
