namespace Correggo4.Servizi;

/// <summary>
/// Gli indirizzi che Correggo4 manda al browser, con davanti il percorso sotto cui e' pubblicato.
/// In produzione Correggo4 puo' stare in una cartella di un dominio condiviso (http://dominio/cartella/),
/// dietro IIS o dietro nginx: il percorso arriva come Request.PathBase (applicazione IIS,
/// UsePathBase da configurazione o X-Forwarded-Prefix, vedi Program.cs) e qui lo si mette davanti
/// ai percorsi scritti dalla radice dell'applicazione ("/volantini/...", "/Volantini/Dettaglio/3").
/// Le viste usano "~/" e Url.Content, il JavaScript C4_BASE: questo serve al codice C#.
/// </summary>
public static class Indirizzi
{
    /// <summary>
    /// percorso, scritto dalla radice dell'applicazione, con davanti la base di pubblicazione.
    /// Gli indirizzi completi (http://, //host) e quelli che non partono da "/" restano come sono.
    /// </summary>
    public static string Con(PathString basePubblicazione, string percorso)
    {
        if (string.IsNullOrEmpty(percorso) || percorso[0] != '/' || percorso.StartsWith("//", StringComparison.Ordinal))
            return percorso;
        if (!basePubblicazione.HasValue || basePubblicazione.Value == "/")
            return percorso;
        return basePubblicazione.Value!.TrimEnd('/') + percorso;
    }

    /// <summary>Come sopra, con la base della richiesta in corso; senza richiesta (il demone) la base e' vuota.</summary>
    public static string Con(HttpContext? http, string percorso) =>
        Con(http?.Request.PathBase ?? PathString.Empty, percorso);

    /// <summary>Come sopra, per i link facoltativi (null resta null).</summary>
    public static string? ConOpzionale(HttpContext? http, string? percorso) =>
        percorso == null ? null : Con(http, percorso);
}
