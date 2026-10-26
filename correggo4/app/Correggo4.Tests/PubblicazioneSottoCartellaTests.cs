using System.Net;
using System.Text.RegularExpressions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// In produzione Correggo4 sta in una cartella di un dominio condiviso (http://dominio/cartella/),
/// dietro IIS oggi e nginx in Docker domani: il login rimandava a http://dominio/Account/Login (404)
/// perche' l'applicazione non sapeva della cartella. Qui si verifica che redirect, form e link
/// la portino con se', che alla radice tutto resti com'era e che dopo il login non si esca dal sito.
/// </summary>
public class PubblicazioneSottoCartellaTests
{
    private static string Location(HttpResponseMessage r) =>
        r.Headers.Location?.OriginalString ?? "";

    [Fact]
    public async Task Sotto_la_cartella_configurata_il_login_resta_nella_cartella()
    {
        using var app = new FabbricaCorreggo(pathBase: "/cartella");
        using var client = app.Client();

        var r = await client.GetAsync("/cartella/Volantini");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.StartsWith("http://localhost/cartella/Account/Login?", Location(r));
        Assert.Contains("ReturnUrl=%2Fcartella%2FVolantini", Location(r));
    }

    [Fact]
    public async Task La_cartella_configurata_si_accetta_anche_senza_barra_iniziale_e_con_quella_finale()
    {
        using var app = new FabbricaCorreggo(pathBase: "cartella/");
        using var client = app.Client();

        var r = await client.GetAsync("/cartella/Volantini");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.StartsWith("http://localhost/cartella/Account/Login?", Location(r));
    }

    [Fact]
    public async Task Con_il_proxy_che_toglie_la_cartella_vale_X_Forwarded_Prefix()
    {
        using var app = new FabbricaCorreggo(ipClient: IPAddress.Parse("172.18.0.5"));
        using var client = app.Client();
        using var richiesta = new HttpRequestMessage(HttpMethod.Get, "/Volantini");
        richiesta.Headers.Add("X-Forwarded-Prefix", "/cartella");

        var r = await client.SendAsync(richiesta);

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.StartsWith("http://localhost/cartella/Account/Login?", Location(r));
    }

    [Fact]
    public async Task X_Forwarded_Prefix_da_un_indirizzo_non_fidato_si_ignora()
    {
        using var app = new FabbricaCorreggo(ipClient: IPAddress.Parse("203.0.113.7"));
        using var client = app.Client();
        using var richiesta = new HttpRequestMessage(HttpMethod.Get, "/Volantini");
        richiesta.Headers.Add("X-Forwarded-Prefix", "/altrove");

        var r = await client.SendAsync(richiesta);

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.StartsWith("http://localhost/Account/Login?", Location(r));
    }

    [Fact]
    public async Task Alla_radice_il_login_resta_quello_di_sempre()
    {
        using var app = new FabbricaCorreggo();
        using var client = app.Client();

        var r = await client.GetAsync("/Volantini");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.StartsWith("http://localhost/Account/Login?", Location(r));
        Assert.Contains("ReturnUrl=%2FVolantini", Location(r));
    }

    [Fact]
    public async Task La_pagina_di_login_sotto_la_cartella_manda_il_form_nella_cartella()
    {
        using var app = new FabbricaCorreggo(pathBase: "/cartella");
        using var client = app.Client();

        string html = await client.GetStringAsync("/cartella/Account/Login");

        Assert.Contains("action=\"/cartella/Account/Login\"", html);
        Assert.Contains("href=\"/cartella/lib/bootstrap/dist/css/bootstrap.min.css\"", html);
    }

    [Fact]
    public async Task Dopo_il_login_si_torna_alla_pagina_chiesta_nella_cartella()
    {
        using var app = new FabbricaCorreggo(pathBase: "/cartella");
        using var client = app.Client();

        var r = await EntraAsync(client, "/cartella", "/cartella/Volantini");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/cartella/Volantini", Location(r));
    }

    [Fact]
    public async Task Dopo_il_login_un_returnUrl_esterno_porta_alla_home_della_cartella()
    {
        using var app = new FabbricaCorreggo(pathBase: "/cartella");
        using var client = app.Client();

        var r = await EntraAsync(client, "/cartella", "https://esterno.example/");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/cartella/", Location(r));
    }

    [Fact]
    public async Task Dopo_il_login_senza_returnUrl_alla_radice_si_va_alla_home()
    {
        using var app = new FabbricaCorreggo();
        using var client = app.Client();

        var r = await EntraAsync(client, "", null);

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/", Location(r));
    }

    [Fact]
    public async Task L_uscita_sotto_la_cartella_torna_al_login_della_cartella()
    {
        using var app = new FabbricaCorreggo(pathBase: "/cartella");
        using var client = app.Client();
        await EntraAsync(client, "/cartella", null);
        string token = Token(await client.GetStringAsync("/cartella/Account/Login"));

        var r = await client.PostAsync("/cartella/Account/Logout",
            new FormUrlEncodedContent(new Dictionary<string, string> { ["__RequestVerificationToken"] = token }));

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/cartella/Account/Login", Location(r));
    }

    /// <summary>Login con l'utente di prova che Program.cs crea a database vuoto.</summary>
    private static async Task<HttpResponseMessage> EntraAsync(HttpClient client, string cartella, string? returnUrl)
    {
        string token = Token(await client.GetStringAsync(cartella + "/Account/Login"));
        var campi = new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = token,
            ["username"] = "gdo",
            ["password"] = "correggo4gdo"
        };
        if (returnUrl != null) campi["returnUrl"] = returnUrl;
        return await client.PostAsync(cartella + "/Account/Login", new FormUrlEncodedContent(campi));
    }

    private static string Token(string html)
    {
        var m = Regex.Match(html, "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"");
        Assert.True(m.Success, "token antiforgery non trovato nella pagina");
        return m.Groups[1].Value;
    }
}
