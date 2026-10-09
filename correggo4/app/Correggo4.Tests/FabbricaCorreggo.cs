using System.Net;
using Correggo4.Data;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Correggo4.Tests;

/// <summary>
/// Correggo4 vero, con il database in memoria e lo storage in una cartella temporanea:
/// niente PostgreSQL, niente /srv, niente demone delle propagazioni.
/// pathBase e' il PathBase di configurazione (null = pubblicato alla radice);
/// ipClient e' l'indirizzo da cui sembra arrivare la richiesta, per i proxy fidati o no.
/// </summary>
public sealed class FabbricaCorreggo : WebApplicationFactory<Program>
{
    private readonly string? pathBase;
    private readonly IPAddress ipClient;
    private readonly string cartella = Path.Combine(Path.GetTempPath(), "correggo4-test-" + Guid.NewGuid().ToString("N"));
    private readonly string nomeDb = "correggo4-" + Guid.NewGuid().ToString("N");

    /// <summary>La cartella dei volantini di questa istanza (Storage:VolantiniPath).</summary>
    public string CartellaVolantini => Path.Combine(cartella, "volantini");

    /// <summary>
    /// Olimpo finto per il client "fico": riceve la richiesta e decide la risposta. Va impostato prima
    /// della prima richiesta; senza, il client "fico" resta quello vero.
    /// </summary>
    public Func<HttpRequestMessage, HttpResponseMessage>? OlimpoFinto { get; set; }

    public FabbricaCorreggo(string? pathBase = null, IPAddress? ipClient = null)
    {
        this.pathBase = pathBase;
        this.ipClient = ipClient ?? IPAddress.Loopback;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Correggo4Db", "Host=non-usato");
        builder.UseSetting("Storage:VolantiniPath", CartellaVolantini);
        builder.UseSetting("Fico:OlimpoUrl", "http://olimpo.test/olimpo");
        if (pathBase != null)
            builder.UseSetting("PathBase", pathBase);

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<Correggo4Context>>();
            services.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            services.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));

            var demone = services.Where(d => d.ImplementationType == typeof(DemonePropagazioni)).ToList();
            foreach (var d in demone) services.Remove(d);

            services.AddSingleton<Microsoft.AspNetCore.Hosting.IStartupFilter>(new FiltroIpClient(ipClient));

            if (OlimpoFinto != null)
                services.AddHttpClient("fico").ConfigurePrimaryHttpMessageHandler(() => new GestoreFinto(OlimpoFinto));
        });
    }

    /// <summary>Il client di prova: niente redirect automatici, si guardano i 302.</summary>
    public HttpClient Client() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { if (Directory.Exists(cartella)) Directory.Delete(cartella, true); } catch (IOException) { }
    }

    private sealed class GestoreFinto(Func<HttpRequestMessage, HttpResponseMessage> risposta) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(risposta(request));
    }

    /// <summary>TestServer non ha un indirizzo remoto: lo si mette prima di tutto il resto.</summary>
    private sealed class FiltroIpClient(IPAddress ip) : Microsoft.AspNetCore.Hosting.IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((ctx, avanti) =>
            {
                ctx.Connection.RemoteIpAddress = ip;
                return avanti(ctx);
            });
            next(app);
        };
    }
}
