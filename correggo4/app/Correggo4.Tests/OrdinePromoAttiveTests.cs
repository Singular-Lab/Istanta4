using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
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
/// I20-1270: nella colonna Promo attive le promo stanno ferme, in ordine di primo caricamento su
/// Correggo: in cima la prima caricata, in fondo l'ultima. Una nuova pubblicazione dal Plugin non
/// le sposta piu'.
///
/// Correggo4 vero con il database in memoria e l'autenticazione di prova, come BloccoDalleCardTests:
/// si legge l'ordine delle promo nei dati che la schermata riceve.
/// </summary>
public class OrdinePromoAttiveTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";

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

    private static async Task<short> AgenziaAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var u = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local",
            Username = "agenzia-prova", Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.Add(u);
        await ctx.SaveChangesAsync();
        return u.Id;
    }

    /// <summary>
    /// Un volantino in esercizio. caricato = data_pubblicazione (il primo caricamento su Correggo),
    /// ultima = ultima_pubblicazione (l'ultima versione pubblicata dal Plugin).
    /// </summary>
    private static async Task VolantinoAsync(WebApplicationFactory<Program> app, string promo, string titolo,
                                             DateTime? caricato, DateTime? ultima = null)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        ctx.Volantinis.Add(new Volantini
        {
            Titolo = titolo, Classificazione = promo, Status = 1,
            DataValiditaInizio = oggi.AddDays(-3), DataValiditaFine = oggi.AddDays(10), DataScadenza = oggi.AddDays(5),
            DataPubblicazione = caricato, UltimaPubblicazione = ultima ?? caricato
        });
        await ctx.SaveChangesAsync();
    }

    /// <summary>Le promo della colonna Promo attive, nell'ordine in cui la schermata le riceve.</summary>
    private static async Task<List<string>> OrdineAsync(WebApplicationFactory<Program> app, short idUtente)
    {
        using var client = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add(HeaderUtente, idUtente.ToString());
        string html = await client.GetStringAsync("/Volantini");
        var d = Regex.Match(html, @"const DATI = (\{.*?\});\r?\n");
        Assert.True(d.Success, "dati della schermata non trovati");
        using var dati = JsonDocument.Parse(d.Groups[1].Value);
        return dati.RootElement.GetProperty("promo").EnumerateArray()
            .Select(p => p.GetProperty("classificazione").GetString()!)
            .ToList();
    }

    private static readonly DateTime Base = new(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Le_promo_sono_in_ordine_di_primo_caricamento()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await AgenziaAsync(app);
        // inserite in ordine sparso: conta la data del primo caricamento, non l'inserimento
        await VolantinoAsync(app, "0S1_27_B", "0S1_27_B_TDM_B", Base.AddDays(10));
        await VolantinoAsync(app, "0S26_26_B", "0S26_26_B_TDM_B", Base);
        await VolantinoAsync(app, "0S26_26BIS_B", "0S26_26BIS_B_TDM_B", Base.AddDays(5));

        Assert.Equal(new[] { "0S26_26_B", "0S26_26BIS_B", "0S1_27_B" }, await OrdineAsync(app, agenzia));
    }

    [Fact]
    public async Task Una_ripubblicazione_dal_Plugin_non_sposta_la_promo()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await AgenziaAsync(app);
        // 0S26_26_B caricata per prima ma ripubblicata oggi, dopo il caricamento di 0S1_27_B
        await VolantinoAsync(app, "0S26_26_B", "0S26_26_B_TDM_B", Base, ultima: Base.AddDays(15));
        await VolantinoAsync(app, "0S1_27_B", "0S1_27_B_TDM_B", Base.AddDays(10));

        Assert.Equal(new[] { "0S26_26_B", "0S1_27_B" }, await OrdineAsync(app, agenzia));
    }

    [Fact]
    public async Task Un_nuovo_volantino_di_una_promo_gia_presente_non_la_sposta()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await AgenziaAsync(app);
        await VolantinoAsync(app, "0S26_26_B", "0S26_26_B_TDM_B", Base);
        await VolantinoAsync(app, "0S1_27_B", "0S1_27_B_TDM_B", Base.AddDays(10));
        // un altro canale di 0S26_26_B caricato dopo tutti: la promo resta dov'era
        await VolantinoAsync(app, "0S26_26_B", "0S26_26_B_UFI_B1", Base.AddDays(20));

        Assert.Equal(new[] { "0S26_26_B", "0S1_27_B" }, await OrdineAsync(app, agenzia));
    }

    [Fact]
    public async Task Una_promo_senza_data_di_caricamento_va_in_coda()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await AgenziaAsync(app);
        // senza data_pubblicazione (mai pubblicata per intero): in fondo, nell'ordine di inserimento
        await VolantinoAsync(app, "SENZA_DATA_A", "SENZA_DATA_A_TDM", caricato: null);
        await VolantinoAsync(app, "0S1_27_B", "0S1_27_B_TDM_B", Base.AddDays(10));
        await VolantinoAsync(app, "SENZA_DATA_B", "SENZA_DATA_B_TDM", caricato: null);
        await VolantinoAsync(app, "0S26_26_B", "0S26_26_B_TDM_B", Base);

        Assert.Equal(new[] { "0S26_26_B", "0S1_27_B", "SENZA_DATA_A", "SENZA_DATA_B" }, await OrdineAsync(app, agenzia));
    }
}
