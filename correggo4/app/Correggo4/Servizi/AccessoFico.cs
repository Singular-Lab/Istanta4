using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// L'ingresso da Fidelity con il parametro `context` (I20-1091): l'OAuthLanded.ashx del Correggo
/// originale (classe AuthAD), lasciato fuori dal porting. Come l'originale:
///   1. decifra `context` con secretKeyFico e ne legge la publicKey (FicoAuthUrlMetaData);
///   2. GET {Olimpo}/auth/checkIdentity con la publicKey come Bearer;
///   3. se l'utente e' autorizzato lo cerca per email e lo crea se manca (tipo FICO da Olimpo, ruolo
///      Agenzia per Superadmin e Agenzia, GDO per gli altri, super admin come l'originale), oppure ne
///      aggiorna il tipo FICO se e' cambiato.
/// Scostamenti decisi con l'utente (13/10/2026):
///   - la creazione delle policy via PolicyManager non e' portata: il sorgente non c'e', la policy
///     resta quella di utenti_policy (port in un task a parte);
///   - un utente disattivato non entra, come dal form di login;
///   - gli errori arrivano al chiamante senza stack trace (finisce nel log).
/// Configurazione: Fico:SecretKey (variabile d'ambiente Fico__SecretKey, uguale a FICO_SECRET di
/// Fidelity) e Fico:OlimpoUrl.
/// </summary>
public sealed class AccessoFico
{
    // FicoUserType (IstantaLib/FicoTypes.cs), come lo salva utenti.tipo_utente_fico.
    public const short TipoSuperadmin = 1;
    public const short TipoAgenzia = 2;

    private static readonly Dictionary<string, short> TipiPerNome = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Superadmin"] = 1, ["Agenzia"] = 2, ["Guest"] = 3, ["GDO"] = 4,
        ["PuntoVendita"] = 5, ["Category"] = 6, ["Marketing"] = 7, ["IT"] = 8
    };

    private static readonly JsonSerializerOptions Opzioni = new() { PropertyNameCaseInsensitive = true };

    private readonly IHttpClientFactory http;
    private readonly IConfiguration config;
    private readonly Correggo4Context ctx;
    private readonly ILogger<AccessoFico> log;

    public AccessoFico(IHttpClientFactory http, IConfiguration config, Correggo4Context ctx, ILogger<AccessoFico> log)
    {
        this.http = http; this.config = config; this.ctx = ctx; this.log = log;
    }

    private string OlimpoUrl => (config["Fico:OlimpoUrl"] ?? "http://127.0.0.1:3005/olimpo").TrimEnd('/');

    /// <summary>La chiave con cui Fidelity cifra il context (secretKeyFico dell'originale).</summary>
    public string? Chiave => string.IsNullOrWhiteSpace(config["Fico:SecretKey"]) ? null : config["Fico:SecretKey"];

    /// <summary>
    /// Esito dell'ingresso: l'utente con cui aprire la sessione, oppure il nome da mostrare nella
    /// pagina di utente non autorizzato (Category senza policy leggibile), oppure l'errore.
    /// </summary>
    public sealed record Esito(Utenti? Utente, string? NonAutorizzato, string? Errore);

    public async Task<Esito> EntraAsync(string? context)
    {
        string? chiave = Chiave;
        if (chiave == null)
            return new Esito(null, null, "secretKeyFico non configurata (Fico:SecretKey)");
        if (string.IsNullOrWhiteSpace(context))
            return new Esito(null, null, "Parametro context mancante");

        MetaDati? meta;
        try
        {
            meta = JsonSerializer.Deserialize<MetaDati>(Crypto.DecryptString(context, chiave), Opzioni);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or JsonException)
        {
            return new Esito(null, null, "Parametro context non valido");
        }
        if (meta == null || string.IsNullOrWhiteSpace(meta.publicKey))
            return new Esito(null, null, "Parametro context senza publicKey");

        Identita? identita;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, OlimpoUrl + "/auth/checkIdentity");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", meta.publicKey);
            using var r = await http.CreateClient("fico").SendAsync(req);
            if (!r.IsSuccessStatusCode)
                return new Esito(null, null, $"Olimpo ha risposto {(int)r.StatusCode} a checkIdentity");
            identita = JsonSerializer.Deserialize<Identita>(await r.Content.ReadAsStringAsync(), Opzioni);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning(ex, "checkIdentity non riuscito per l'ingresso da Fidelity");
            return new Esito(null, null, "Olimpo non raggiungibile");
        }

        if (identita == null || !identita.autorizzato || string.IsNullOrWhiteSpace(identita.username))
            return new Esito(null, null, $"Utente {identita?.username} non autorizzato");

        short? tipo = Tipo(identita.tipoUtente);
        if (tipo == null)
            return new Esito(null, null, $"Tipo utente non riconosciuto per {identita.username}");

        var utente = await ctx.Utentis.FirstOrDefaultAsync(u => u.Email == identita.username);
        if (utente == null)
        {
            utente = new Utenti
            {
                Nome = Campo(identita.userPolicy, "nome"),
                Cognome = Campo(identita.userPolicy, "cognome"),
                Email = identita.username,
                Username = identita.username,
                PswHash = null,
                TipoUtenteFico = tipo,
                Ruolo = tipo is TipoSuperadmin or TipoAgenzia ? Ruoli.CodiceAgenzia : Ruoli.CodiceGdo,
                IsSuperAdmin = true,
                Attivo = true,
                DataInserimento = DateTime.UtcNow
            };
            ctx.Utentis.Add(utente);
            await ctx.SaveChangesAsync();
        }
        else
        {
            if (!utente.Attivo)
                return new Esito(null, null, $"Utente {identita.username} non attivo");
            if (utente.TipoUtenteFico != tipo)
            {
                utente.TipoUtenteFico = tipo;
                utente.DataModifica = DateTime.UtcNow;
                await ctx.SaveChangesAsync();
            }
        }

        // L'originale qui passava i gruppi di Olimpo a PolicyManager.parseGruppi e, se la scansione
        // falliva per un Category, lo mandava a userNotAuthorized.aspx. PolicyManager non e' portato
        // (I20-1091, opzione A): i gruppi non si leggono, la policy resta quella di utenti_policy e
        // questo ramo non scatta finche' il port non arriva.
        bool gruppiLetti = true;
        if (!gruppiLetti && tipo == ServizioCorrezioni.TipoFicoCategory)
            return new Esito(null, $"{utente.Nome} {utente.Cognome}".Trim(), null);

        return new Esito(utente, null, null);
    }

    /// <summary>Il tipo FICO come numero: Olimpo oggi lo manda per nome ("Category"), l'originale per numero.</summary>
    private static short? Tipo(JsonElement valore) => valore.ValueKind switch
    {
        JsonValueKind.Number when valore.TryGetInt16(out short n) && n is >= 1 and <= 8 => n,
        JsonValueKind.String when TipiPerNome.TryGetValue(valore.GetString() ?? "", out short n) => n,
        JsonValueKind.String when short.TryParse(valore.GetString(), out short n) && n is >= 1 and <= 8 => n,
        _ => null
    };

    /// <summary>nome e cognome da userPolicy.campi_essenziali; userPolicy puo' anche essere un array vuoto.</summary>
    private static string Campo(JsonElement policy, string nome) =>
        policy.ValueKind == JsonValueKind.Object
        && policy.TryGetProperty("campi_essenziali", out var campi) && campi.ValueKind == JsonValueKind.Object
        && campi.TryGetProperty(nome, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";

    /// <summary>FicoAuthUrlMetaData dell'originale.</summary>
    private sealed class MetaDati
    {
        public string? publicKey { get; set; }
        public string? route { get; set; }
        public Dictionary<string, string>? queryParams { get; set; }
    }

    /// <summary>La risposta di /auth/checkIdentity (OlympusChekIdentity), con i soli campi che servono.</summary>
    private sealed class Identita
    {
        public string? username { get; set; }
        public JsonElement tipoUtente { get; set; }
        public JsonElement userPolicy { get; set; }
        public bool autorizzato { get; set; }
    }
}
