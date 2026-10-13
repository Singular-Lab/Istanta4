using System.Net;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1091: OAuthLanded.ashx, l'ingresso dall'hub di Fidelity del Correggo originale, perso nel
/// porting. Fidelity cifra { publicKey } con FICO_SECRET nel parametro context; Correggo4 lo decifra,
/// chiede a Olimpo chi e', crea o allinea l'utente e apre la sessione. Olimpo qui e' finto.
/// </summary>
public class OAuthLandedTests
{
    private const string ChiavePubblica = "chiave-pubblica-di-prova";
    private const string Email = "mario@esempio.it";

    // ------------------------------------------------------------------ allestimento

    /// <summary>Olimpo che riconosce solo ChiavePubblica e la descrive con il tipo indicato.</summary>
    private static FabbricaCorreggo App(object tipoUtente, bool autorizzato = true, string? pathBase = null,
                                        Action? chiamato = null)
    {
        var app = new FabbricaCorreggo(pathBase);
        app.OlimpoFinto = req =>
        {
            chiamato?.Invoke();
            if (req.RequestUri!.AbsolutePath != "/olimpo/auth/checkIdentity"
                || req.Headers.Authorization?.Parameter != ChiavePubblica)
                return new HttpResponseMessage(HttpStatusCode.Unauthorized);
            string json = JsonSerializer.Serialize(new
            {
                origin = "FP",
                username = Email,
                tipoUtente,
                autorizzato,
                userPolicy = new { campi_essenziali = new Dictionary<string, object> { ["nome"] = "Mario", ["cognome"] = "Bianchi" } }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        };
        return app;
    }

    private static string Context(string chiavePubblica = ChiavePubblica) =>
        Crypto.EncryptString(JsonSerializer.Serialize(new { publicKey = chiavePubblica, codicePosizione = "" }),
                             FabbricaCorreggo.ChiaveFico);

    private static Task<HttpResponseMessage> EntraAsync(FabbricaCorreggo app, string context, string prefisso = "") =>
        app.Client().GetAsync($"{prefisso}/OAuthLanded.ashx?context={Uri.EscapeDataString(context)}");

    private static async Task<Utenti?> UtenteAsync(FabbricaCorreggo app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        return await ctx.Utentis.AsNoTracking().FirstOrDefaultAsync(u => u.Email == Email);
    }

    private static async Task UtenteEsistenteAsync(FabbricaCorreggo app, short tipo, bool attivo = true)
    {
        _ = app.Client(); // avvia l'applicazione (e il seed degli utenti di prova)
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        ctx.Utentis.Add(new Utenti
        {
            Nome = "Mario", Cognome = "Bianchi", Email = Email, Username = Email,
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = tipo, Attivo = attivo, DataInserimento = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
    }

    private static bool HaCookie(HttpResponseMessage r) =>
        r.Headers.TryGetValues("Set-Cookie", out var c) && c.Any(v => v.StartsWith("correggo4="));

    private static async Task<string> ErroreAsync(HttpResponseMessage r)
    {
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("text/json", r.Content.Headers.ContentType?.MediaType);
        using var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        Assert.Equal("", d.RootElement.GetProperty("result").GetString());
        return d.RootElement.GetProperty("error_detail").GetString() ?? "";
    }

    // ------------------------------------------------------------------ ingresso riuscito

    [Fact]
    public async Task Utente_nuovo_viene_creato_ed_entra_nell_elenco_dei_volantini()
    {
        using var app = App("Category");

        var r = await EntraAsync(app, Context());

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/", r.Headers.Location?.OriginalString);
        Assert.True(HaCookie(r));
        var u = await UtenteAsync(app);
        Assert.NotNull(u);
        Assert.Equal((short)6, u!.TipoUtenteFico);
        Assert.Equal(Ruoli.CodiceGdo, u.Ruolo);
        Assert.Equal("Mario", u.Nome);
        Assert.Equal("Bianchi", u.Cognome);
        Assert.Equal(Email, u.Username);
        Assert.True(u.Attivo);
        Assert.True(u.IsSuperAdmin);   // come l'originale
        Assert.Null(u.PswHash);         // dal form di login non entra
    }

    [Fact]
    public async Task La_sessione_aperta_da_accesso_alle_pagine_protette()
    {
        using var app = App("Category");
        var r = await EntraAsync(app, Context());
        string cookie = r.Headers.GetValues("Set-Cookie").First(v => v.StartsWith("correggo4=")).Split(';')[0];

        var req = new HttpRequestMessage(HttpMethod.Get, "/Storico");
        req.Headers.Add("Cookie", cookie);
        var pagina = await app.Client().SendAsync(req);

        // Senza sessione /Storico rimanda al login; con la sessione no.
        Assert.False(pagina.StatusCode == HttpStatusCode.Redirect
                     && pagina.Headers.Location!.OriginalString.Contains("/Account/Login"));
    }

    [Theory]
    [InlineData("Superadmin")]
    [InlineData("Agenzia")]
    public async Task Superadmin_e_Agenzia_entrano_come_Agenzia(string tipo)
    {
        using var app = App(tipo);

        var r = await EntraAsync(app, Context());

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal(Ruoli.CodiceAgenzia, (await UtenteAsync(app))!.Ruolo);
    }

    [Fact]
    public async Task Il_tipo_numerico_dell_originale_e_accettato()
    {
        using var app = App(2);

        var r = await EntraAsync(app, Context());

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        var u = await UtenteAsync(app);
        Assert.Equal((short)2, u!.TipoUtenteFico);
        Assert.Equal(Ruoli.CodiceAgenzia, u.Ruolo);
    }

    [Fact]
    public async Task Utente_esistente_prende_il_tipo_di_Olimpo_e_conserva_il_ruolo()
    {
        using var app = App("Category");
        await UtenteEsistenteAsync(app, tipo: 7);

        var r = await EntraAsync(app, Context());

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        var u = await UtenteAsync(app);
        Assert.Equal((short)6, u!.TipoUtenteFico);
        Assert.Equal(Ruoli.CodiceGdo, u.Ruolo);
    }

    [Fact]
    public async Task Sotto_una_cartella_il_redirect_resta_nella_cartella()
    {
        using var app = App("GDO", pathBase: "/cartella");

        var r = await EntraAsync(app, Context(), "/cartella");

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
        Assert.Equal("/cartella/", r.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Il_context_in_base64_con_gli_spazi_al_posto_dei_piu_e_accettato()
    {
        using var app = App("GDO");
        // Lo stesso context di Context(), in base64 standard e messo nella query senza codificarlo: i '+'
        // arrivano come spazi, e l'originale li rimetteva a posto con Replace(" ", "+").
        Assert.Equal(CryptoTests.DaFidelity, Context());

        var r = await app.Client().GetAsync("/OAuthLanded.ashx?context=" + CryptoTests.Standard);

        Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
    }

    // ------------------------------------------------------------------ ingresso rifiutato

    [Fact]
    public async Task Utente_non_autorizzato_da_Olimpo_non_entra()
    {
        using var app = App("GDO", autorizzato: false);

        var r = await EntraAsync(app, Context());

        Assert.Contains("non autorizzato", await ErroreAsync(r));
        Assert.False(HaCookie(r));
        Assert.Null(await UtenteAsync(app));
    }

    [Fact]
    public async Task Chiave_pubblica_sconosciuta_a_Olimpo_non_entra()
    {
        using var app = App("GDO");

        var r = await EntraAsync(app, Context("chiave-sconosciuta"));

        Assert.Contains("401", await ErroreAsync(r));
        Assert.False(HaCookie(r));
    }

    [Fact]
    public async Task Context_alterato_non_entra_e_non_interroga_Olimpo()
    {
        int chiamate = 0;
        using var app = App("GDO", chiamato: () => chiamate++);
        string alterato = Crypto.EncryptString("{\"publicKey\":\"x\"}", "un-altro-segreto");

        var r = await EntraAsync(app, alterato);

        Assert.Equal("Parametro context non valido", await ErroreAsync(r));
        Assert.False(HaCookie(r));
        Assert.Equal(0, chiamate);
    }

    [Fact]
    public async Task Senza_context_non_entra()
    {
        using var app = App("GDO");

        var r = await app.Client().GetAsync("/OAuthLanded.ashx");

        Assert.Equal("Parametro context mancante", await ErroreAsync(r));
    }

    [Fact]
    public async Task Utente_disattivato_non_entra()
    {
        using var app = App("GDO");
        await UtenteEsistenteAsync(app, tipo: 4, attivo: false);

        var r = await EntraAsync(app, Context());

        Assert.Contains("non attivo", await ErroreAsync(r));
        Assert.False(HaCookie(r));
    }

    [Fact]
    public async Task Senza_chiave_configurata_non_entra()
    {
        using var base_ = App("GDO");
        using var app = base_.WithWebHostBuilder(b => b.UseSetting("Fico:SecretKey", ""));

        var r = await app.CreateClient(new() { AllowAutoRedirect = false })
            .GetAsync($"/OAuthLanded.ashx?context={Uri.EscapeDataString(Context())}");

        Assert.Contains("Fico:SecretKey", await ErroreAsync(r));
    }

    // ------------------------------------------------------------------ pagina utente non autorizzato

    [Fact]
    public async Task La_pagina_di_utente_non_autorizzato_mostra_il_nome_del_context()
    {
        using var app = App("Category");
        string q = Crypto.EncryptString(JsonSerializer.Serialize(new { nome = "Mario Bianchi" }), FabbricaCorreggo.ChiaveFico);

        foreach (string percorso in new[] { "/Account/NonAutorizzato", "/userNotAuthorized.aspx" })
        {
            var r = await app.Client().GetAsync($"{percorso}?context={Uri.EscapeDataString(q)}");
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
            Assert.Contains("Mario Bianchi", await r.Content.ReadAsStringAsync());
        }
    }
}

/// <summary>La cifratura del context deve essere quella di Fidelity (fidelity/lib/encryption.ts).</summary>
public class CryptoTests
{
    // Prodotto da encryptString di fidelity/lib/encryption.ts con la passphrase FabbricaCorreggo.ChiaveFico.
    internal const string DaFidelity =
        "uv6A1HKcTbyYJ9_AEtaVIYK6LBSUPyroXBTbBbY3WvnFS-YhxZ43FZiXRol2sN1F_XxDqB2jfa0-j26eQyGLrg";

    /// <summary>Gli stessi byte in base64 standard, come li produceva il Correggo originale.</summary>
    internal const string Standard =
        "uv6A1HKcTbyYJ9/AEtaVIYK6LBSUPyroXBTbBbY3WvnFS+YhxZ43FZiXRol2sN1F/XxDqB2jfa0+j26eQyGLrg==";
    private const string Atteso = "{\"publicKey\":\"chiave-pubblica-di-prova\",\"codicePosizione\":\"\"}";

    [Fact]
    public void Decifra_il_context_prodotto_da_Fidelity()
    {
        Assert.Equal(Atteso, Crypto.DecryptString(DaFidelity, FabbricaCorreggo.ChiaveFico));
    }

    [Fact]
    public void Cifra_come_Fidelity()
    {
        Assert.Equal(DaFidelity, Crypto.EncryptString(Atteso, FabbricaCorreggo.ChiaveFico));
    }

    [Fact]
    public void Decifra_anche_il_base64_standard_con_gli_spazi()
    {
        Assert.Equal(Atteso, Crypto.DecryptString(Standard.Replace('+', ' '), FabbricaCorreggo.ChiaveFico));
    }

    [Fact]
    public void Con_un_altra_passphrase_non_decifra()
    {
        // Di solito il padding non torna e si ha un'eccezione; se per caso torna, il testo e' spazzatura.
        string? testo = null;
        var ex = Record.Exception(() => testo = Crypto.DecryptString(DaFidelity, "un-altro-segreto"));
        Assert.True(ex is System.Security.Cryptography.CryptographicException || testo != Atteso);
    }
}
