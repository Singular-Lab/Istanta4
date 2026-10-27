using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1146: il lucchetto nella schermata delle promo attive. L'Agenzia blocca per un'ora, e sblocca,
/// un volantino dalla sua card o tutti i volantini di una promo dal suo riquadro, con
/// Promo/Blocco/Hub; gli altri utenti non vedono il lucchetto e il server li rifiuta.
///
/// Correggo4 vero con il database in memoria. Si entra con un'autenticazione di prova che legge
/// l'utente da un header: niente credenziali nel codice. Il token antiforgery si prende dalla
/// schermata stessa, come fa la pagina.
/// </summary>
public class BloccoDalleCardTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";

    // ------------------------------------------------------------------ allestimento

    /// <summary>Correggo4 con l'autenticazione di prova al posto del cookie.</summary>
    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica) =>
        fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.AddAuthentication(Schema).AddScheme<AuthenticationSchemeOptions, AutenticazioneDiProva>(Schema, _ => { });
            s.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = Schema;
                o.DefaultAuthenticateScheme = Schema;
                o.DefaultChallengeScheme = Schema;
                o.DefaultForbidScheme = Schema;
            });
        }));

    /// <summary>L'utente e' quello dell'header, col ruolo letto dal database.</summary>
    private sealed class AutenticazioneDiProva(IOptionsMonitor<AuthenticationSchemeOptions> o, ILoggerFactory l, UrlEncoder e)
        : AuthenticationHandler<AuthenticationSchemeOptions>(o, l, e)
    {
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!short.TryParse(Request.Headers[HeaderUtente], out short id))
                return AuthenticateResult.NoResult();
            var ctx = Context.RequestServices.GetRequiredService<Correggo4Context>();
            var u = await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (u == null)
                return AuthenticateResult.Fail("utente di prova sconosciuto");
            var identita = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
                new Claim(ClaimTypes.Name, $"{u.Nome} {u.Cognome}"),
                new Claim(ClaimTypes.Role, Ruoli.Nome(u.Ruolo))
            }, Schema);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identita), Schema));
        }
    }

    private static async Task<short> UtenteAsync(WebApplicationFactory<Program> app, short ruolo, string nome)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var u = new Utenti
        {
            Nome = nome, Cognome = "Prova", Email = $"{nome.ToLowerInvariant()}@prova.local",
            Username = $"{nome.ToLowerInvariant()}-prova", Ruolo = ruolo, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(u);
        await ctx.SaveChangesAsync();
        return u.Id;
    }

    private static async Task<int> VolantinoAsync(WebApplicationFactory<Program> app, string promo, string titolo, int status = 1)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var v = new Volantini
        {
            Titolo = titolo, Classificazione = promo, Status = (short)status,
            DataValiditaInizio = oggi.AddDays(-3), DataValiditaFine = oggi.AddDays(10), DataScadenza = oggi.AddDays(5)
        };
        ctx.Volantinis.Add(v);
        await ctx.SaveChangesAsync();
        return v.Id;
    }

    private static async Task<Dictionary<int, Volantini>> VolantiniAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        return await ctx.Volantinis.AsNoTracking().ToDictionaryAsync(v => v.Id);
    }

    /// <summary>Il client di un utente: tiene i cookie, come il browser.</summary>
    private static HttpClient Client(WebApplicationFactory<Program> app, short idUtente)
    {
        var c = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(HeaderUtente, idUtente.ToString());
        return c;
    }

    /// <summary>La schermata delle promo attive: il token antiforgery e i dati che la pagina riceve.</summary>
    private static async Task<(string Token, JsonElement Dati)> HubAsync(HttpClient client)
    {
        string html = await client.GetStringAsync("/Volantini");
        var t = Regex.Match(html, "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"");
        Assert.True(t.Success, "token antiforgery non trovato nella schermata");
        var d = Regex.Match(html, @"const DATI = (\{.*?\});\r?\n");
        Assert.True(d.Success, "dati della schermata non trovati");
        return (t.Groups[1].Value, JsonDocument.Parse(d.Groups[1].Value).RootElement.Clone());
    }

    /// <summary>Il clic sul lucchetto: la stessa chiamata della pagina.</summary>
    private static async Task<HttpResponseMessage> BloccoAsync(HttpClient client, string? token, Dictionary<string, string> campi)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "/Promo/Blocco/Hub") { Content = new FormUrlEncodedContent(campi) };
        if (token != null) req.Headers.Add("RequestVerificationToken", token);
        return await client.SendAsync(req);
    }

    private static async Task<JsonElement> OkAsync(HttpResponseMessage r)
    {
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.Clone();
        Assert.True(j.GetProperty("ok").GetBoolean(), j.GetRawText());
        return j;
    }

    private static void BloccatoUnOra(Volantini v, short da)
    {
        Assert.True(ServizioCorrezioni.Bloccato(v, DateTime.UtcNow), $"volantino {v.Id} non bloccato");
        Assert.Equal(da, v.IdAutoreBlocco);
        var minuti = (v.DataScadenzaBlocco!.Value - DateTime.UtcNow).TotalMinutes;
        Assert.InRange(minuti, ServizioPromo.MinutiBlocco - 2, ServizioPromo.MinutiBlocco);
    }

    // ------------------------------------------------------------------ Agenzia

    [Fact]
    public async Task L_Agenzia_blocca_un_volantino_dalla_card_per_un_ora()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        int a = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");
        int b = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_UFI_B1");
        using var client = Client(app, agenzia);
        var (token, _) = await HubAsync(client);

        var j = await OkAsync(await BloccoAsync(client, token,
            new() { ["promo"] = "0S24_26_B", ["idVol"] = a.ToString(), ["blocca"] = "true", ["tutta"] = "false" }));

        Assert.True(j.GetProperty("dati").GetProperty("bloccato").GetBoolean());
        Assert.Equal(ServizioPromo.MinutiBlocco, j.GetProperty("dati").GetProperty("minuti").GetInt32());
        var vols = await VolantiniAsync(app);
        BloccatoUnOra(vols[a], agenzia);
        Assert.False(ServizioCorrezioni.Bloccato(vols[b], DateTime.UtcNow), "l'altro volantino della promo non va toccato");
    }

    [Fact]
    public async Task L_Agenzia_blocca_dal_riquadro_tutti_i_volantini_in_esercizio_della_promo()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        var suoi = new List<int>();
        foreach (var t in new[] { "TDM_B1", "UFI_B1", "TDM_B", "UFI_B" })
            suoi.Add(await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_" + t));
        int diProva = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_prova", status: 0);
        int altraPromo = await VolantinoAsync(app, "0S25_26_A", "0S25_26_A_UFI");
        using var client = Client(app, agenzia);
        var (token, _) = await HubAsync(client);

        await OkAsync(await BloccoAsync(client, token,
            new() { ["promo"] = "0S24_26_B", ["blocca"] = "true", ["tutta"] = "true" }));

        var vols = await VolantiniAsync(app);
        foreach (int id in suoi) BloccatoUnOra(vols[id], agenzia);
        Assert.False(ServizioCorrezioni.Bloccato(vols[altraPromo], DateTime.UtcNow), "un'altra promo non va toccata");
        Assert.False(ServizioCorrezioni.Bloccato(vols[diProva], DateTime.UtcNow), "un volantino fuori esercizio non va toccato");
    }

    [Fact]
    public async Task L_Agenzia_sblocca_il_volantino_e_la_promo()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        int a = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");
        int b = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_UFI_B1");
        using var client = Client(app, agenzia);
        var (token, _) = await HubAsync(client);
        await OkAsync(await BloccoAsync(client, token, new() { ["promo"] = "0S24_26_B", ["blocca"] = "true", ["tutta"] = "true" }));

        var j = await OkAsync(await BloccoAsync(client, token,
            new() { ["promo"] = "0S24_26_B", ["idVol"] = a.ToString(), ["blocca"] = "false", ["tutta"] = "false" }));
        Assert.False(j.GetProperty("dati").GetProperty("bloccato").GetBoolean());
        var vols = await VolantiniAsync(app);
        Assert.False(ServizioCorrezioni.Bloccato(vols[a], DateTime.UtcNow));
        Assert.True(ServizioCorrezioni.Bloccato(vols[b], DateTime.UtcNow), "sbloccare un volantino non sblocca gli altri");

        await OkAsync(await BloccoAsync(client, token, new() { ["promo"] = "0S24_26_B", ["blocca"] = "false", ["tutta"] = "true" }));
        vols = await VolantiniAsync(app);
        Assert.False(ServizioCorrezioni.Bloccato(vols[b], DateTime.UtcNow));
    }

    [Fact]
    public async Task Il_blocco_avvisa_gli_altri_utenti()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");
        int a = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");
        using var client = Client(app, agenzia);
        var (token, _) = await HubAsync(client);

        await OkAsync(await BloccoAsync(client, token,
            new() { ["promo"] = "0S24_26_B", ["idVol"] = a.ToString(), ["blocca"] = "true", ["tutta"] = "false" }));

        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var notifiche = await ctx.Notifiches.AsNoTracking().Where(n => n.IdVolantino == a).ToListAsync();
        Assert.Contains(notifiche, n => n.IdUtente == category && n.Tag == "blocco");
        Assert.DoesNotContain(notifiche, n => n.IdUtente == agenzia);
    }

    [Fact]
    public async Task La_schermata_da_il_lucchetto_solo_all_Agenzia()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");
        await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");

        using var cAgenzia = Client(app, agenzia);
        using var cCategory = Client(app, category);
        var (_, datiAgenzia) = await HubAsync(cAgenzia);
        var (_, datiCategory) = await HubAsync(cCategory);

        Assert.True(datiAgenzia.GetProperty("puoBloccare").GetBoolean());
        Assert.False(datiCategory.GetProperty("puoBloccare").GetBoolean());
    }

    // ------------------------------------------------------------------ rifiuti

    [Fact]
    public async Task Un_utente_GDO_non_blocca_e_niente_cambia()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");
        int a = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");
        using var client = Client(app, category);
        var (token, _) = await HubAsync(client);

        var r = await BloccoAsync(client, token,
            new() { ["promo"] = "0S24_26_B", ["idVol"] = a.ToString(), ["blocca"] = "true", ["tutta"] = "false" });
        var rTutta = await BloccoAsync(client, token, new() { ["promo"] = "0S24_26_B", ["blocca"] = "true", ["tutta"] = "true" });

        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, rTutta.StatusCode);
        Assert.False(ServizioCorrezioni.Bloccato((await VolantiniAsync(app))[a], DateTime.UtcNow));
    }

    [Fact]
    public async Task Senza_il_token_antiforgery_la_richiesta_e_rifiutata()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        int a = await VolantinoAsync(app, "0S24_26_B", "0S24_26_B_TDM_B1");
        using var client = Client(app, agenzia);
        await HubAsync(client);

        var r = await BloccoAsync(client, null,
            new() { ["promo"] = "0S24_26_B", ["idVol"] = a.ToString(), ["blocca"] = "true", ["tutta"] = "false" });

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.False(ServizioCorrezioni.Bloccato((await VolantiniAsync(app))[a], DateTime.UtcNow));
    }
}
