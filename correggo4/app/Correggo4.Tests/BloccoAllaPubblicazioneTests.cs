using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Correggo4.Models.Vista;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1265: come nel Correggo originale, una versione appena pubblicata resta bloccata per un'ora,
/// finche' l'Agenzia non la controlla e la sblocca col lucchetto. Prima la pubblicazione
/// (ImportatorePack, usato da UploadVolFromFP.ashx e da Ingestione) non scriveva nessun blocco.
/// Il blocco della pubblicazione non ha autore: "bloccato" dipende solo dalla scadenza.
///
/// Correggo4 vero con il database in memoria e un'autenticazione di prova che legge l'utente da un
/// header, come in VersioneZeroTests: niente credenziali nel codice.
/// </summary>
public class BloccoAllaPubblicazioneTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";
    private const string Promo = "0S24_26_B";
    private const string Titolo = "0S24_26_B_TDM_B";

    // ------------------------------------------------------------------ allestimento

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-blocco-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
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

    private static async Task<T> ConContestoAsync<T>(WebApplicationFactory<Program> app, Func<Correggo4Context, Task<T>> fai)
    {
        using var scope = app.Services.CreateScope();
        return await fai(scope.ServiceProvider.GetRequiredService<Correggo4Context>());
    }

    private static Task<short> UtenteAsync(WebApplicationFactory<Program> app, short ruolo, string nome) =>
        ConContestoAsync(app, async ctx =>
        {
            var u = new Utenti
            {
                Nome = nome, Cognome = "Prova", Email = $"{nome.ToLowerInvariant()}@prova.local",
                Username = $"{nome.ToLowerInvariant()}-prova", Ruolo = ruolo, Attivo = true, DataInserimento = DateTime.UtcNow
            };
            ctx.Utentis.Add(u);
            await ctx.SaveChangesAsync();
            return u.Id;
        });

    private static async Task<ServizioCorrezioni.Utente> UtenteCorreggoAsync(WebApplicationFactory<Program> app, short id)
    {
        using var scope = app.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().UtenteAsync(id))!;
    }

    /// <summary>Pubblica una versione del volantino come fa fidelity: una pagina, il PDF dato.</summary>
    private static async Task<EsitoImportazione> PubblicaAsync(WebApplicationFactory<Program> app, byte[] pdf)
    {
        var pacchetto = new PacchettoCorreggoPerFP
        {
            promo = new CorreggoPromo
            {
                titolo = Titolo, classificatore = Promo,
                dataInizio = DateTime.UtcNow.Date, dataFine = DateTime.UtcNow.Date.AddDays(12), dataScadenza = DateTime.UtcNow.Date.AddDays(6)
            },
            pagine = new List<CorreggoPagina> { new() { numero = 1, bounds = new decimal[] { 0, 0, 100, 300 } } }
        };
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ImportatorePack>().ImportaAsync(new ContenutoPack(pacchetto, pdf, 0));
    }

    private static Task<Volantini> VolantinoAsync(WebApplicationFactory<Program> app, int idVol) =>
        ConContestoAsync(app, ctx => ctx.Volantinis.AsNoTracking().FirstAsync(v => v.Id == idVol));

    /// <summary>Una nota del Category sulla pagina dell'ultima versione, senza box: passa dai controlli del volantino.</summary>
    private static async Task<EsitoCorrezione> NotaAsync(WebApplicationFactory<Program> app, short idCategory, int idVol)
    {
        int idPagina = await ConContestoAsync(app, ctx => ctx.VolantiniPagines.AsNoTracking()
            .Where(p => p.IdVol == idVol).OrderByDescending(p => p.Versione).Select(p => p.Id).FirstAsync());
        var u = await UtenteCorreggoAsync(app, idCategory);
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().NuovaNotaAsync(u, 0, "prezzo sbagliato", 10, 10, idPagina);
    }

    private static async Task<VolantinoGestito> InGestisciPromoAsync(WebApplicationFactory<Program> app, int idVol)
    {
        using var scope = app.Services.CreateScope();
        var modello = await scope.ServiceProvider.GetRequiredService<ServizioPromo>().CaricaAsync(Promo);
        return modello.Volantini.Single(v => v.Id == idVol);
    }

    private static async Task<string?> BloccoAsync(WebApplicationFactory<Program> app, short idAgenzia, int idVol, bool blocca)
    {
        var u = await UtenteCorreggoAsync(app, idAgenzia);
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ServizioPromo>().BloccoAsync(u, idVol, null, blocca);
    }

    /// <summary>Il volantino come lo riceve la schermata delle promo attive.</summary>
    private static async Task<JsonElement> NellaHomeAsync(WebApplicationFactory<Program> app, short idUtente, int idVol)
    {
        var client = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add(HeaderUtente, idUtente.ToString());
        string html = await client.GetStringAsync("/Volantini");
        var d = Regex.Match(html, @"const DATI = (\{.*?\});\r?\n");
        Assert.True(d.Success, "dati della schermata non trovati");
        using var dati = JsonDocument.Parse(d.Groups[1].Value);
        foreach (var p in dati.RootElement.GetProperty("promo").EnumerateArray())
            foreach (var v in p.GetProperty("volantini").EnumerateArray())
                if (v.GetProperty("id").GetInt32() == idVol)
                    return v.Clone();
        throw new Xunit.Sdk.XunitException($"volantino {idVol} non presente nella schermata");
    }

    // ------------------------------------------------------------------ prove

    [Fact]
    public async Task La_prima_versione_pubblicata_resta_bloccata_un_ora()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");

        var prima = DateTime.UtcNow;
        var esito = await PubblicaAsync(app, EstrattorePagineTests.PdfCmyk(true));
        Assert.Null(esito.Errore);
        Assert.Equal(1, esito.Versione);

        var vol = await VolantinoAsync(app, esito.IdVolantino);
        Assert.True(ServizioCorrezioni.Bloccato(vol, DateTime.UtcNow));
        Assert.Null(vol.IdAutoreBlocco);
        Assert.InRange(vol.DataScadenzaBlocco!.Value, prima.AddMinutes(ServizioPromo.MinutiBlocco), DateTime.UtcNow.AddMinutes(ServizioPromo.MinutiBlocco));

        // La schermata delle promo attive e Gestisci promo lo mostrano bloccato, con i minuti.
        var home = await NellaHomeAsync(app, agenzia, esito.IdVolantino);
        Assert.Equal("bloccato", home.GetProperty("stato").GetString());
        Assert.InRange(home.GetProperty("bloccoMinuti").GetInt32(), 59, 60);

        var gestito = await InGestisciPromoAsync(app, esito.IdVolantino);
        Assert.True(gestito.Bloccato);
        Assert.Equal(ServizioPromo.BloccatoDallaPubblicazione, gestito.BloccatoDa);
    }

    [Fact]
    public async Task Una_nuova_versione_blocca_il_volantino_e_le_correzioni_si_rifiutano()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");

        var v1 = await PubblicaAsync(app, EstrattorePagineTests.PdfCmyk(true));
        Assert.Null(await BloccoAsync(app, agenzia, v1.IdVolantino, false));
        Assert.True((await NotaAsync(app, category, v1.IdVolantino)).Ok, "sbloccato, la nota si salva");

        var v2 = await PubblicaAsync(app, EstrattorePagineTests.PdfCmyk(true));
        Assert.Null(v2.Errore);
        Assert.Equal(2, v2.Versione);
        Assert.True(ServizioCorrezioni.Bloccato(await VolantinoAsync(app, v2.IdVolantino), DateTime.UtcNow));

        var nota = await NotaAsync(app, category, v2.IdVolantino);
        Assert.False(nota.Ok);
        Assert.Equal(423, nota.Http);
        Assert.Equal("vol_bloccato", nota.Codice);
    }

    [Fact]
    public async Task L_Agenzia_sblocca_la_versione_appena_pubblicata()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");

        var esito = await PubblicaAsync(app, EstrattorePagineTests.PdfCmyk(true));
        Assert.False((await NotaAsync(app, category, esito.IdVolantino)).Ok);

        Assert.Null(await BloccoAsync(app, agenzia, esito.IdVolantino, false));

        Assert.False(ServizioCorrezioni.Bloccato(await VolantinoAsync(app, esito.IdVolantino), DateTime.UtcNow));
        Assert.True((await NotaAsync(app, category, esito.IdVolantino)).Ok);
        Assert.Equal("", (await InGestisciPromoAsync(app, esito.IdVolantino)).BloccatoDa);
    }

    [Fact]
    public async Task Il_blocco_dell_Agenzia_resta_suo()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");

        var esito = await PubblicaAsync(app, EstrattorePagineTests.PdfCmyk(true));
        Assert.Null(await BloccoAsync(app, agenzia, esito.IdVolantino, true));

        var vol = await VolantinoAsync(app, esito.IdVolantino);
        Assert.Equal(agenzia, vol.IdAutoreBlocco);
        Assert.Equal("Agenzia Prova", (await InGestisciPromoAsync(app, esito.IdVolantino)).BloccatoDa);
    }

    [Fact]
    public async Task Una_pubblicazione_fallita_non_blocca()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);

        var esito = await PubblicaAsync(app, "questo non e' un pdf"u8.ToArray());

        Assert.NotNull(esito.Errore);
        var vol = await VolantinoAsync(app, esito.IdVolantino);
        Assert.False(ServizioCorrezioni.Bloccato(vol, DateTime.UtcNow));
        Assert.Null(vol.DataScadenzaBlocco);
    }
}
