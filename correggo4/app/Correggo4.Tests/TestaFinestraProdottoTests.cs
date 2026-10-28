using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Correggo4.Auth;
using Correggo4.Controllers;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1156: la testata della finestra del prodotto dice promo e canale/area del volantino, poi il
/// codice ("0S24_26_B – TDM/B – 1130891"), non piu' la meccanica del box (BOX_STD). Canale e area
/// si ricavano dal titolo come per le card della home.
///
/// L'editor vero si apre con il database in memoria e un'autenticazione di prova che legge
/// l'utente da un header, come in VersioneZeroTests: niente credenziali nel codice.
/// </summary>
public class TestaFinestraProdottoTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";

    // ------------------------------------------------------------------ composizione

    [Theory]
    [InlineData("0S24_26_B_TDM_B", "0S24_26_B", "0S24_26_B – TDM/B")]
    [InlineData("AP142026 - Demo_FAM-FI_TOS", "AP142026 - Demo", "AP142026 - Demo – FAM-FI/TOS")]
    [InlineData("0S24_26_B_TDM", "0S24_26_B", "0S24_26_B – TDM")]
    [InlineData("SCFI_14_09_26", "Speciale Freschi Settembre", "Speciale Freschi Settembre")]
    public void La_testata_e_promo_e_canale_area(string titolo, string promo, string attesa)
    {
        Assert.Equal(attesa, VolantiniController.TestaProdotto(titolo, promo));
    }

    [Fact]
    public void La_finestra_non_mostra_piu_la_meccanica_del_box()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

        Assert.Contains("document.getElementById('mTitolo').textContent = testaProdotto + ' – ' + (b.basecode || '');", html);
        Assert.DoesNotContain("(b.nomeBox || '(box)') + ' – '", html);
    }

    // ------------------------------------------------------------------ editor aperto

    [Fact]
    public async Task L_editor_riceve_la_testata_del_volantino()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app);
        int idVol = await VolantinoAsync(app, "0S24_26_B_TDM_B", "0S24_26_B");

        var c = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(HeaderUtente, agenzia.ToString());
        var r = await c.GetAsync($"/Volantini/Dettaglio/{idVol}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        string html = await r.Content.ReadAsStringAsync();

        // il serializzatore JSON scrive il trattino lungo come –
        Assert.Contains("var testaProdotto = \"0S24_26_B \\u2013 TDM/B\";", html);
    }

    // ------------------------------------------------------------------ allestimento

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-testa-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
            s.AddAuthentication(Schema).AddScheme<AuthenticationSchemeOptions, AutenticazioneDiProva>(Schema, _ => { });
            s.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = Schema;
                o.DefaultAuthenticateScheme = Schema;
                o.DefaultChallengeScheme = Schema;
                o.DefaultForbidScheme = Schema;
            });
        }));
    }

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

    private static async Task<short> UtenteAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var u = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(u);
        await ctx.SaveChangesAsync();
        return u.Id;
    }

    /// <summary>Un volantino alla versione 1 con una pagina e un prodotto.</summary>
    private static async Task<int> VolantinoAsync(WebApplicationFactory<Program> app, string titolo, string promo)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        var pagina = new VolantiniPagine
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = 1,
            Path = "pag1_v1", PathFisico = $"{promo}/{titolo}/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        ctx.VolantiniPagineElementis.Add(new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box1", Basecode = "1130891", Contenuto = "", Larghezza = 100, Altezza = 100
        });
        await ctx.SaveChangesAsync();
        return vol.Id;
    }

    // Come IndirizziNelleVisteTests: la cartella del progetto risalendo da quella dei test.
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
