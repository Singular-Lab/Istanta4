using System.Net.Http.Headers;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Servizi;

/// <summary>
/// Chi chiama Correggo4 da un altro sistema (fidelity-promotion) con il Bearer di Olimpo, come il login
/// dell'UpdateVolData.ashx originale (I20-1076):
///   1. GET {Olimpo}/auth/checkIdentity con il Bearer ricevuto;
///   2. l'utente deve essere autorizzato e non venire da Correggo stesso (origine "CO": loopback);
///   3. se in Correggo4 non esiste un utente con quella email lo si crea, Agenzia e super admin come
///      faceva l'originale, ma senza password: dal form di login non entra.
/// Configurazione: Fico:OlimpoUrl, la stessa di ClienteFico.
/// </summary>
public sealed class IdentitaOlimpo
{
    private readonly IHttpClientFactory http;
    private readonly IConfiguration config;
    private readonly Correggo4Context ctx;

    public IdentitaOlimpo(IHttpClientFactory http, IConfiguration config, Correggo4Context ctx)
    {
        this.http = http; this.config = config; this.ctx = ctx;
    }

    private string OlimpoUrl => (config["Fico:OlimpoUrl"] ?? "http://127.0.0.1:3005/olimpo").TrimEnd('/');

    /// <summary>L'utente Correggo4 che corrisponde al Bearer, oppure il motivo per cui non lo si accetta.</summary>
    public async Task<(ServizioCorrezioni.Utente? Utente, string? Errore)> VerificaAsync(string? authorization)
    {
        string bearer = (authorization ?? "").Trim();
        if (bearer.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            bearer = bearer["Bearer ".Length..].Trim();
        if (bearer == "")
            return (null, "public token not found");

        Identita? identita;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, OlimpoUrl + "/auth/checkIdentity");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            using var r = await http.CreateClient("fico").SendAsync(req);
            if (!r.IsSuccessStatusCode)
                return (null, $"Olimpo non ha riconosciuto l'utente ({(int)r.StatusCode})");
            identita = JsonSerializer.Deserialize<Identita>(await r.Content.ReadAsStringAsync(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return (null, "Olimpo non raggiungibile: " + ex.Message);
        }

        if (identita == null || !identita.autorizzato || string.IsNullOrWhiteSpace(identita.username))
            return (null, $"Utente {identita?.username} non autorizzato");
        if (identita.origin == "CO")
            return (null, "Utente loopback non autorizzato");

        var utente = await ctx.Utentis.FirstOrDefaultAsync(u => u.Email == identita.username);
        if (utente == null)
        {
            var campi = identita.userPolicy?.campi_essenziali ?? new Dictionary<string, JsonElement>();
            string Campo(string nome) =>
                campi.TryGetValue(nome, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
            utente = new Utenti
            {
                Nome = Campo("nome"),
                Cognome = Campo("cognome"),
                Email = identita.username,
                Username = identita.username,
                PswHash = null,
                Ruolo = Ruoli.CodiceAgenzia,
                IsSuperAdmin = true,
                Attivo = true,
                DataInserimento = DateTime.UtcNow
            };
            ctx.Utentis.Add(utente);
            await ctx.SaveChangesAsync();
        }

        return (new ServizioCorrezioni.Utente(utente.Id, utente.Ruolo, utente.TipoUtenteFico,
                                              $"{utente.Nome} {utente.Cognome}".Trim()), null);
    }

    /// <summary>La risposta di /auth/checkIdentity, con i soli campi che servono qui.</summary>
    private sealed class Identita
    {
        public string? origin { get; set; }
        public string? username { get; set; }
        public bool autorizzato { get; set; }
        public Politica? userPolicy { get; set; }
    }

    private sealed class Politica
    {
        // Valori di qualunque tipo: si leggono solo nome e cognome, se sono testo.
        public Dictionary<string, JsonElement>? campi_essenziali { get; set; }
    }
}
