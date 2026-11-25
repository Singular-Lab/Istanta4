using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Auth;
using Correggo4.Controllers;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1271: la colonna Promo attive divisa per canale. Il canale lo dice Fidelity, dalle aree dei
/// kit della promo (getAreeKitByPromo, chiamata col passaporto di Olimpo); le promo con aree in
/// comune stanno sotto lo stesso canale (Coop: B e B1 insieme), quelle senza aree in «Altre promo».
///
/// Correggo4 vero con il database in memoria e l'autenticazione di prova, come BloccoDalleCardTests;
/// Olimpo e Fidelity sono finti, dietro il client "fico".
/// </summary>
public class CanaliPromoTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";
    private const string FidelityUrl = "http://fidelity.test/api";
    private const string Passaporto = "passaporto-di-prova";

    // ------------------------------------------------------------------ raggruppamento

    private static readonly Guid PromoA = Guid.NewGuid();
    private static readonly Guid PromoAmeno = Guid.NewGuid();
    private static readonly Guid PromoB = Guid.NewGuid();
    private static readonly Guid PromoTerranuova = Guid.NewGuid();
    private static readonly Guid PromoSenzaAree = Guid.NewGuid();

    [Fact]
    public void Le_promo_con_aree_in_comune_stanno_sotto_lo_stesso_canale()
    {
        var (canali, ordine) = VolantiniController.CanaliDaAree(new Dictionary<Guid, List<string>>
        {
            [PromoB] = new() { "B", "B1" },
            [PromoTerranuova] = new() { "B1" },
            [PromoAmeno] = new() { "A-" },
            [PromoA] = new() { "A" },
            [PromoSenzaAree] = new()
        });

        Assert.Equal("A", canali[PromoA]);
        Assert.Equal("A-", canali[PromoAmeno]);
        Assert.Equal("B & B1", canali[PromoB]);
        Assert.Equal("B & B1", canali[PromoTerranuova]);
        // senza aree non ha canale: la pagina la mette in «Altre promo»
        Assert.False(canali.ContainsKey(PromoSenzaAree));
        Assert.Equal(new[] { "A", "A-", "B & B1" }, ordine);
    }

    [Fact]
    public void B1_da_sola_e_un_canale_suo_se_nessuna_promo_ha_anche_B()
    {
        var (canali, ordine) = VolantiniController.CanaliDaAree(new Dictionary<Guid, List<string>>
        {
            [PromoB] = new() { "B" },
            [PromoTerranuova] = new() { "B1" }
        });

        Assert.Equal("B", canali[PromoB]);
        Assert.Equal("B1", canali[PromoTerranuova]);
        Assert.Equal(new[] { "B", "B1" }, ordine);
    }

    [Fact]
    public void Le_aree_si_uniscono_anche_a_catena()
    {
        // X ha B e B1, Y ha B1 e B2: B, B1 e B2 sono lo stesso canale
        var x = Guid.NewGuid();
        var y = Guid.NewGuid();
        var (canali, _) = VolantiniController.CanaliDaAree(new Dictionary<Guid, List<string>>
        {
            [x] = new() { "B", "B1" },
            [y] = new() { "B1", "B2" }
        });

        Assert.Equal("B & B1 & B2", canali[x]);
        Assert.Equal("B & B1 & B2", canali[y]);
    }

    // ------------------------------------------------------------------ rotta e home

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica, bool conFidelity = true) =>
        fabbrica.WithWebHostBuilder(b =>
        {
            if (conFidelity) b.UseSetting("Fico:FidelityUrl", FidelityUrl);
            b.ConfigureTestServices(s =>
            {
                s.AddAuthentication(Schema).AddScheme<AuthenticationSchemeOptions, AutenticazioneDiProva>(Schema, _ => { });
                s.PostConfigure<AuthenticationOptions>(o =>
                {
                    o.DefaultScheme = Schema;
                    o.DefaultAuthenticateScheme = Schema;
                    o.DefaultChallengeScheme = Schema;
                    o.DefaultForbidScheme = Schema;
                });
            });
        });

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

    private static Task<short> AgenziaAsync(WebApplicationFactory<Program> app) =>
        UtenteAsync(app, Ruoli.CodiceAgenzia, null, "agenzia");

    private static async Task<short> UtenteAsync(WebApplicationFactory<Program> app, short ruolo, short? tipoFico, string nome)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var u = new Utenti
        {
            Nome = nome, Cognome = "Prova", Email = $"{nome}-canali@prova.local",
            Username = $"{nome}-canali-prova", Ruolo = ruolo, TipoUtenteFico = tipoFico,
            Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(u);
        await ctx.SaveChangesAsync();
        return u.Id;
    }

    // ------------------------------------------------------------------ solo Agenzia e Marketing

    [Theory]
    [InlineData(Ruoli.CodiceAgenzia, null, true)]
    [InlineData(Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, true)]
    [InlineData(Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, false)]
    [InlineData(Ruoli.CodiceGdo, null, false)]
    public void Vedono_i_canali_solo_Agenzia_e_Marketing(short ruolo, short? tipoFico, bool vede)
    {
        Assert.Equal(vede, VolantiniController.VedeCanali(new ServizioCorrezioni.Utente(1, ruolo, tipoFico, "Prova")));
        Assert.False(VolantiniController.VedeCanali(null));
    }

    [Theory]
    [InlineData(Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "category")]
    [InlineData(Ruoli.CodiceGdo, null, "gdo")]
    public async Task Category_e_GDO_senza_tipo_non_ricevono_i_canali_e_Fidelity_non_si_chiama(short ruolo, short? tipoFico, string nome)
    {
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new(), aFidelity) };
        using var app = App(fabbrica);
        using var client = Client(app, await UtenteAsync(app, ruolo, tipoFico, nome));

        var r = await client.GetAsync("/Volantini/CanaliPromo?id=" + Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Empty(aFidelity);
    }

    [Fact]
    public async Task Il_Marketing_riceve_i_canali()
    {
        Guid b = Guid.NewGuid();
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new() { [b] = new[] { "B" } }, aFidelity) };
        using var app = App(fabbrica);
        using var client = Client(app, await UtenteAsync(app, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "marketing"));

        var j = await CanaliAsync(client, b);

        Assert.True(j.GetProperty("ok").GetBoolean(), j.GetRawText());
        Assert.Equal("B", j.GetProperty("dati").GetProperty("canali").GetProperty(b.ToString()).GetString());
    }

    [Theory]
    [InlineData(Ruoli.CodiceAgenzia, null, "agenzia", true)]
    [InlineData(Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "marketing", true)]
    [InlineData(Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "category", false)]
    public async Task La_home_dice_alla_pagina_se_dividere_per_canale(short ruolo, short? tipoFico, string nome, bool vede)
    {
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new(), new()) };
        using var app = App(fabbrica);
        using var client = Client(app, await UtenteAsync(app, ruolo, tipoFico, nome));

        string html = await client.GetStringAsync("/Volantini");

        var d = Regex.Match(html, @"const DATI = (\{.*?\});\r?\n");
        Assert.True(d.Success, "dati della schermata non trovati");
        using var dati = JsonDocument.Parse(d.Groups[1].Value);
        Assert.Equal(vede, dati.RootElement.GetProperty("canaliVisibili").GetBoolean());
    }

    private static HttpClient Client(WebApplicationFactory<Program> app, short idUtente)
    {
        var c = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(HeaderUtente, idUtente.ToString());
        return c;
    }

    private static HttpResponseMessage Json(object corpo, HttpStatusCode stato = HttpStatusCode.OK) =>
        new(stato) { Content = new StringContent(JsonSerializer.Serialize(corpo), Encoding.UTF8, "application/json") };

    /// <summary>Olimpo da' il passaporto, Fidelity risponde con le aree; le richieste a Fidelity si contano.</summary>
    private static Func<HttpRequestMessage, HttpResponseMessage> OlimpoEFidelity(
        Dictionary<Guid, string[]> aree, List<HttpRequestMessage> aFidelity, HttpStatusCode statoFidelity = HttpStatusCode.OK) => req =>
    {
        string url = req.RequestUri!.ToString();
        if (url.EndsWith("/auth/getPassport"))
            return Json(new { esito = true, publicKey = Passaporto });
        if (url.StartsWith(FidelityUrl + "/getAreeKitByPromo"))
        {
            aFidelity.Add(req);
            if (statoFidelity != HttpStatusCode.OK) return Json(new { message = "errore" }, statoFidelity);
            return Json(new { aree = aree.ToDictionary(a => a.Key.ToString(), a => a.Value) });
        }
        return new HttpResponseMessage(HttpStatusCode.NotFound);
    };

    private static async Task<JsonElement> CanaliAsync(HttpClient client, params Guid[] ids)
    {
        string q = string.Join("&", ids.Select(id => "id=" + id));
        var r = await client.GetAsync("/Volantini/CanaliPromo?" + q);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.Clone();
    }

    [Fact]
    public async Task La_rotta_chiede_a_Fidelity_col_passaporto_e_restituisce_canali_e_ordine()
    {
        Guid a = Guid.NewGuid(), b = Guid.NewGuid(), b1 = Guid.NewGuid(), altra = Guid.NewGuid();
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo
        {
            OlimpoFinto = OlimpoEFidelity(new()
            {
                [a] = new[] { "A" }, [b] = new[] { "B", "B1" }, [b1] = new[] { "B1" }, [altra] = Array.Empty<string>()
            }, aFidelity)
        };
        using var app = App(fabbrica);
        using var client = Client(app, await AgenziaAsync(app));

        var j = await CanaliAsync(client, a, b, b1, altra);

        Assert.True(j.GetProperty("ok").GetBoolean(), j.GetRawText());
        var canali = j.GetProperty("dati").GetProperty("canali");
        Assert.Equal("A", canali.GetProperty(a.ToString()).GetString());
        Assert.Equal("B & B1", canali.GetProperty(b.ToString()).GetString());
        Assert.Equal("B & B1", canali.GetProperty(b1.ToString()).GetString());
        Assert.False(canali.TryGetProperty(altra.ToString(), out _));
        Assert.Equal(new[] { "A", "B & B1" },
            j.GetProperty("dati").GetProperty("ordine").EnumerateArray().Select(x => x.GetString()).ToArray());

        var richiesta = Assert.Single(aFidelity);
        Assert.Equal(HttpMethod.Get, richiesta.Method);
        Assert.Equal("Bearer " + Passaporto, richiesta.Headers.Authorization?.ToString());
        foreach (var id in new[] { a, b, b1, altra })
            Assert.Contains(id.ToString(), richiesta.RequestUri!.Query);
    }

    [Fact]
    public async Task Le_aree_restano_in_memoria_e_Fidelity_non_si_richiama_a_ogni_apertura()
    {
        Guid b = Guid.NewGuid();
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new() { [b] = new[] { "B" } }, aFidelity) };
        using var app = App(fabbrica);
        using var client = Client(app, await AgenziaAsync(app));

        await CanaliAsync(client, b);
        var j = await CanaliAsync(client, b);

        Assert.True(j.GetProperty("ok").GetBoolean());
        Assert.Single(aFidelity);
    }

    [Fact]
    public async Task Senza_Fidelity_configurato_la_rotta_dice_di_no_e_la_home_resta_com_era()
    {
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new(), aFidelity) };
        using var app = App(fabbrica, conFidelity: false);
        using var client = Client(app, await AgenziaAsync(app));

        var j = await CanaliAsync(client, Guid.NewGuid());

        Assert.False(j.GetProperty("ok").GetBoolean());
        Assert.Empty(aFidelity);
    }

    [Fact]
    public async Task Se_Fidelity_risponde_con_un_errore_la_rotta_dice_di_no()
    {
        var aFidelity = new List<HttpRequestMessage>();
        using var fabbrica = new FabbricaCorreggo
        {
            OlimpoFinto = OlimpoEFidelity(new(), aFidelity, HttpStatusCode.InternalServerError)
        };
        using var app = App(fabbrica);
        using var client = Client(app, await AgenziaAsync(app));

        var j = await CanaliAsync(client, Guid.NewGuid());

        Assert.False(j.GetProperty("ok").GetBoolean());
        Assert.Single(aFidelity);
    }

    [Fact]
    public async Task La_home_passa_alla_pagina_l_id_Fidelity_di_ogni_promo()
    {
        Guid idPromo = Guid.NewGuid();
        using var fabbrica = new FabbricaCorreggo { OlimpoFinto = OlimpoEFidelity(new(), new()) };
        using var app = App(fabbrica);
        short agenzia = await AgenziaAsync(app);
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            var oggi = DateTime.UtcNow.Date;
            ctx.Volantinis.Add(new Volantini
            {
                Titolo = "0S26_26_B_TDM_B", Classificazione = "0S26_26_B", Status = 1, IdPromoFp = idPromo,
                DataValiditaInizio = oggi.AddDays(-3), DataValiditaFine = oggi.AddDays(10), DataScadenza = oggi.AddDays(5),
                DataPubblicazione = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync();
        }
        using var client = Client(app, agenzia);

        string html = await client.GetStringAsync("/Volantini");

        var d = Regex.Match(html, @"const DATI = (\{.*?\});\r?\n");
        Assert.True(d.Success, "dati della schermata non trovati");
        using var dati = JsonDocument.Parse(d.Groups[1].Value);
        var promo = Assert.Single(dati.RootElement.GetProperty("promo").EnumerateArray());
        Assert.Equal(idPromo.ToString(), promo.GetProperty("idPromoFp").GetString());
    }

    [Fact]
    public void La_pagina_si_divide_per_canale_solo_quando_Fidelity_risponde()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Index.cshtml")).Replace("\r\n", "\n");

        // la chiamata parte dopo il primo disegno, con gli id Fidelity delle promo, solo per Agenzia e Marketing
        Assert.Contains("if (!DATI.canaliVisibili) return;", html);
        Assert.Contains("fetch(C4_BASE + \"Volantini/CanaliPromo?\"", html);
        // senza risposta (o senza canali) la colonna resta com'era
        Assert.Contains("if (!j || !j.ok || !j.dati || !j.dati.ordine || !j.dati.ordine.length) return;", html);
        Assert.Contains("if(!CANALI_PROMO) return list;", html);
        // cartelline: «Canale X» e in fondo «Altre promo»
        Assert.Contains("function nomeCanale(c){ const can = canaleDi(c); return can ? `Canale ${can}` : ALTRE_PROMO; }", html);
        Assert.Contains("const ALTRE_PROMO = \"Altre promo\";", html);
        Assert.Contains("<section class=\"canale\">", html);
        Assert.Contains("<button class=\"canale-head\" type=\"button\" data-canale=\"${esc(g.nome)}\" aria-expanded=\"${aperta}\">", html);
        // chiusa: resta solo la barra, senza le promo
        Assert.Contains("${aperta ? `<div class=\"canale-promo\">${g.promo.map(card).join(\"\")}</div>` : \"\"}", html);
        // se l'utente non ha ancora scelto, si seleziona la prima promo della prima cartellina aperta
        Assert.Contains("if (!selezioneToccata) {", html);
        Assert.Contains("const prima = visibili.find(c => !canaleChiuso(nomeCanale(c))) || visibili[0];", html);
    }

    [Fact]
    public void Le_cartelline_si_aprono_e_chiudono_e_il_browser_le_ricorda()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Index.cshtml")).Replace("\r\n", "\n");

        // il clic sulla barra apre o chiude la cartellina e salva la scelta
        Assert.Contains("if(CANALI_CHIUSI.has(nome)) CANALI_CHIUSI.delete(nome); else CANALI_CHIUSI.add(nome);", html);
        Assert.Contains("salvaCanaliChiusi(); render(); return;", html);
        // la memoria del browser puo' mancare: lettura e scrittura non devono rompere la pagina
        Assert.Contains("try { const v = JSON.parse(localStorage.getItem(CHIAVE_CANALI_CHIUSI) || \"[]\"); return Array.isArray(v) ? v : []; }", html);
        Assert.Contains("try { localStorage.setItem(CHIAVE_CANALI_CHIUSI, JSON.stringify([...CANALI_CHIUSI])); } catch {}", html);
        // cercando si aprono tutte, cosi' un risultato non resta nascosto
        Assert.Contains("const canaleChiuso = nome => !S.q && CANALI_CHIUSI.has(nome);", html);
        // le icone della cartellina ci sono
        Assert.Contains("<symbol id=\"i-folder\"", html);
        Assert.Contains("<symbol id=\"i-folder-open\"", html);
    }

    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
