using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
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
/// I20-1149: la revoca arriva fino alla versione 0, come nel Correggo originale. Revocando la
/// versione 1 il volantino resta senza versioni valide (le revocate hanno numeri negativi): non si
/// apre, non si corregge, compare con la versione 0, e la prima versione che arriva da fidelity e'
/// di nuovo la 1.
///
/// Correggo4 vero con il database in memoria (con le transazioni ignorate, che la revoca apre) e
/// un'autenticazione di prova che legge l'utente da un header: niente credenziali nel codice.
/// </summary>
public class VersioneZeroTests
{
    private const string Schema = "Prova";
    private const string HeaderUtente = "X-Utente-Prova";
    private const string Promo = "0S24_26_B";
    private const string Titolo = "0S24_26_B_TDM_B";

    // ------------------------------------------------------------------ allestimento

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-v0-" + Guid.NewGuid().ToString("N");
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

    /// <summary>Il volantino con le versioni indicate: una pagina e un prodotto per versione, e una nota sull'ultima.</summary>
    private static Task<(int IdVol, Dictionary<short, long> Box, long IdNota)> VolantinoAsync(
        WebApplicationFactory<Program> app, short idAutore, params short[] versioni) =>
        ConContestoAsync(app, async ctx =>
        {
            var oggi = DateTime.UtcNow.Date;
            var vol = new Volantini
            {
                Titolo = Titolo, Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
                DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
            };
            ctx.Volantinis.Add(vol);
            await ctx.SaveChangesAsync();

            var box = new Dictionary<short, long>();
            foreach (short ver in versioni)
            {
                var versione = new VolantiniVersioni
                {
                    IdVol = vol.Id, Versione = ver, DataPubblicazione = DateTime.UtcNow,
                    DataChiusura = ver == versioni.Max() ? null : DateTime.UtcNow
                };
                ctx.VolantiniVersionis.Add(versione);
                await ctx.SaveChangesAsync();
                var pagina = new VolantiniPagine
                {
                    IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = ver,
                    Path = $"pag1_v{ver}", PathFisico = $"{Promo}/{Titolo}/pag1_v{ver}", DataVersione = DateTime.UtcNow
                };
                ctx.VolantiniPagines.Add(pagina);
                await ctx.SaveChangesAsync();
                var e = new VolantiniPagineElementi
                {
                    IdPagina = pagina.Id, LabelInd = "box1", Basecode = "8001234567890", Contenuto = "",
                    Larghezza = 100, Altezza = 100
                };
                ctx.VolantiniPagineElementis.Add(e);
                await ctx.SaveChangesAsync();
                box[ver] = e.Id;
            }

            var ultima = versioni.Max();
            var paginaUltima = await ctx.VolantiniPagines.FirstAsync(p => p.IdVol == vol.Id && p.Versione == ultima);
            var nota = new VolantiniPagineNote
            {
                IdPagina = paginaUltima.Id, IdElemento = box[ultima], Descrizione = "prezzo sbagliato",
                Stato = ServizioCorrezioni.StatoNonVerificata, IdAutore = idAutore, DataInserimento = DateTime.UtcNow
            };
            ctx.VolantiniPagineNotes.Add(nota);
            await ctx.SaveChangesAsync();
            return (vol.Id, box, nota.Id);
        });

    private static async Task<ServizioCorrezioni.Utente> AgenziaAsync(WebApplicationFactory<Program> app, short id)
    {
        using var scope = app.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().UtenteAsync(id))!;
    }

    private static async Task<string?> RevocaAsync(WebApplicationFactory<Program> app, ServizioCorrezioni.Utente u, int idVol, short versione)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ServizioPromo>().RevocaAsync(u, idVol, versione);
    }

    private static HttpClient Client(WebApplicationFactory<Program> app, short idUtente)
    {
        var c = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(HeaderUtente, idUtente.ToString());
        return c;
    }

    /// <summary>Il volantino come lo riceve la schermata delle promo attive.</summary>
    private static async Task<JsonElement> NellaHomeAsync(HttpClient client, int idVol)
    {
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

    // ------------------------------------------------------------------ revoca

    [Fact]
    public async Task Revocando_la_versione_1_il_volantino_va_alla_versione_0()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");
        var (idVol, _, idNota) = await VolantinoAsync(app, category, 1);
        var u = await AgenziaAsync(app, agenzia);

        using (var scope = app.Services.CreateScope())
        {
            var (ant, errore) = await scope.ServiceProvider.GetRequiredService<ServizioPromo>().AnteprimaRevocaAsync(u, idVol);
            Assert.Null(errore);
            Assert.Equal(1, ant!.Versione);
            Assert.Equal(0, ant.Precedente);
        }
        Assert.Null(await RevocaAsync(app, u, idVol, 1));

        await ConContestoAsync(app, async ctx =>
        {
            Assert.DoesNotContain(await ctx.VolantiniPagines.Where(p => p.IdVol == idVol).ToListAsync(), p => p.Versione > 0);
            Assert.Equal(ServizioCorrezioni.StatoArchiviato, (await ctx.VolantiniPagineNotes.FirstAsync(n => n.Id == idNota)).Stato);
            Assert.Contains(await ctx.Notifiches.Where(n => n.IdVolantino == idVol).ToListAsync(),
                            n => n.IdUtente == category && n.Tag == "revoca");
            return 0;
        });

        using var scope2 = app.Services.CreateScope();
        var promo = scope2.ServiceProvider.GetRequiredService<ServizioPromo>();
        var gestita = Assert.Single((await promo.CaricaAsync(Promo)).Volantini);
        Assert.Equal(0, gestita.Versione);
        Assert.False(gestita.Revocabile);
        var (_, errore0) = await promo.AnteprimaRevocaAsync(u, idVol);
        Assert.Contains("versione 0", errore0);
    }

    [Fact]
    public async Task Revocando_la_versione_2_si_torna_alla_1_come_prima()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        var (idVol, _, _) = await VolantinoAsync(app, agenzia, 1, 2);
        var u = await AgenziaAsync(app, agenzia);

        Assert.Null(await RevocaAsync(app, u, idVol, 2));

        using var scope = app.Services.CreateScope();
        var gestita = Assert.Single((await scope.ServiceProvider.GetRequiredService<ServizioPromo>().CaricaAsync(Promo)).Volantini);
        Assert.Equal(1, gestita.Versione);
        Assert.True(gestita.Revocabile);
    }

    // ------------------------------------------------------------------ versione 0: non si apre

    [Fact]
    public async Task Alla_versione_0_il_volantino_compare_con_la_versione_0_e_non_si_apre()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        var (idVol, _, _) = await VolantinoAsync(app, agenzia, 1);
        Assert.Null(await RevocaAsync(app, await AgenziaAsync(app, agenzia), idVol, 1));
        using var client = Client(app, agenzia);

        var v = await NellaHomeAsync(client, idVol);
        Assert.Equal(0, v.GetProperty("versione").GetInt32());
        Assert.Equal(0, v.GetProperty("pagine").GetInt32());

        foreach (string indirizzo in new[] { $"/Volantini/Dettaglio/{idVol}", $"/Volantini/Affiancata/{idVol}" })
        {
            var r = await client.GetAsync(indirizzo);
            Assert.Equal(HttpStatusCode.Redirect, r.StatusCode);
            // la home: Volantini/Index e' la rotta predefinita, quindi la radice
            Assert.Equal("/", r.Headers.Location?.OriginalString);
            string home = await client.GetStringAsync("/");
            Assert.Contains("alla versione 0: tutte le sue versioni sono state revocate", home);
        }
    }

    [Fact]
    public async Task Alla_versione_0_non_si_salva_nessuna_correzione()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        short category = await UtenteAsync(app, Ruoli.CodiceGdo, "Category");
        var (idVol, box, _) = await VolantinoAsync(app, agenzia, 1);
        Assert.Null(await RevocaAsync(app, await AgenziaAsync(app, agenzia), idVol, 1));

        using var scope = app.Services.CreateScope();
        var correzioni = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esito = await correzioni.NuovaNotaAsync((await correzioni.UtenteAsync(category))!, box[1], "nota sulla pagina revocata", 10, 10);

        Assert.False(esito.Ok);
        Assert.Equal("versione_zero", esito.Codice);
        Assert.Contains("alla versione 0", esito.Messaggio);
    }

    // ------------------------------------------------------------------ dopo la versione 0

    [Fact]
    public async Task Dopo_la_versione_0_il_volantino_che_torna_da_fidelity_e_la_versione_1()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        short agenzia = await UtenteAsync(app, Ruoli.CodiceAgenzia, "Agenzia");
        var (idVol, _, _) = await VolantinoAsync(app, agenzia, 1, 2);
        var u = await AgenziaAsync(app, agenzia);
        Assert.Null(await RevocaAsync(app, u, idVol, 2));
        Assert.Null(await RevocaAsync(app, u, idVol, 1));

        var pacchetto = new PacchettoCorreggoPerFP
        {
            promo = new CorreggoPromo
            {
                titolo = Titolo, classificatore = Promo,
                dataInizio = DateTime.UtcNow.Date, dataFine = DateTime.UtcNow.Date.AddDays(12), dataScadenza = DateTime.UtcNow.Date.AddDays(6)
            },
            pagine = new List<CorreggoPagina> { new() { numero = 1, bounds = new decimal[] { 0, 0, 100, 300 } } }
        };
        EsitoImportazione esito;
        using (var scope = app.Services.CreateScope())
            esito = await scope.ServiceProvider.GetRequiredService<ImportatorePack>()
                .ImportaAsync(new ContenutoPack(pacchetto, EstrattorePagineTests.PdfCmyk(true), agenzia));

        Assert.Null(esito.Errore);
        Assert.Equal(idVol, esito.IdVolantino);
        Assert.Equal(1, esito.Versione);

        using var client = Client(app, agenzia);
        Assert.Equal(1, (await NellaHomeAsync(client, idVol)).GetProperty("versione").GetInt32());
    }
}
