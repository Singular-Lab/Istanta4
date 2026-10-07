using System.Globalization;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// La finestra dei Category (j209, "Gestisci promo"). Regole dell'originale (ftp.aspx.cs:102-160,
/// Main.aspx.cs:165-201) con le decisioni dell'11/9:
///  - un Category vede ed entra in una promo solo con la finestra impostata e aperta (senza finestra
///    non la vede, come l'originale);
///  - Marketing e Agenzia non hanno finestra;
///  - l'Agenzia accetta le correzioni solo quando la finestra non e' aperta.
/// A differenza dell'originale la finestra si controlla anche sul server a ogni salvataggio.
/// </summary>
public static class FinestreCategory
{
    public static readonly TimeZoneInfo Roma = TrovaRoma();

    private static TimeZoneInfo TrovaRoma()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
    }

    public static bool Aperta(VolantiniFinestreCategory? f, DateTime adessoUtc) =>
        f != null && f.DataInizio <= adessoUtc && adessoUtc <= f.DataFine;

    public static Task<VolantiniFinestreCategory?> LeggiAsync(Correggo4Context ctx, string classificazione) =>
        ctx.VolantiniFinestreCategories.AsNoTracking().FirstOrDefaultAsync(f => f.Classificazione == classificazione);

    public static async Task<HashSet<string>> ApertePerCategoryAsync(Correggo4Context ctx, DateTime adessoUtc) =>
        (await ctx.VolantiniFinestreCategories.AsNoTracking()
            .Where(f => f.DataInizio <= adessoUtc && adessoUtc <= f.DataFine)
            .Select(f => f.Classificazione).ToListAsync()).ToHashSet();

    public static DateTime Locale(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Roma);

    public static DateTime Utc(DateTime locale) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(locale, DateTimeKind.Unspecified), Roma);

    public static string Testo(DateTime utc) =>
        Locale(utc).ToString("dd/MM/yyyy 'alle' HH:mm", CultureInfo.InvariantCulture);
}
