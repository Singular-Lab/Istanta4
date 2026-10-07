using System.Globalization;
using System.Security.Claims;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

// I numeri decimali viaggiano col punto (JavaScript toFixed, JSON, PostgreSQL).
// Senza questa riga il binding dei form usa la cultura del server e legge
// "120.5" come 1205, perche' in it-IT il punto separa le migliaia. E' lo stesso
// inciampo che nel Correggo originale ha lasciato Replace(".", ",") sparsi ovunque.
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<Correggo4Context>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Correggo4Db")));

builder.Services.AddSingleton<EstrattorePagine>();
builder.Services.AddScoped<ImportatorePack>();
builder.Services.AddScoped<Correggo4.Servizi.ServizioCorrezioni>();
// Passo 2 dell'Edit avanzato (j206): Olimpo e Istanta per foto e loghi. Il segreto Fico arriva dalla
// variabile d'ambiente Fico__Secret (/etc/istanta4-correggo4.env), non da appsettings.
builder.Services.AddHttpClient("fico", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddScoped<Correggo4.Servizi.ClienteFico>();
// Gestisci promo (j209): finestra Category, date, blocco, revoca.
builder.Services.AddScoped<Correggo4.Servizi.ServizioPromo>();
// Consulta tutti i volantini (j213): storico, PDF, zip, report.
builder.Services.AddScoped<Correggo4.Servizi.ServizioStorico>();

// Propagazioni (j222): il motore delle catene e il demone che le costruisce, come il vecchio Correggo.
builder.Services.AddScoped<Correggo4.Servizi.ServizioPropagazione>();
// Le notifiche e le propagazioni costruiscono indirizzi per il browser: serve la base della richiesta.
builder.Services.AddHttpContextAccessor();
// j243: le notifiche della campanella e il semaforo del demone
builder.Services.AddScoped<Correggo4.Servizi.ServizioNotifiche>();
// j251: il TIMONE (piano di rimpaginazione del Marketing). Vedi claude/timone-specifica.md.
builder.Services.AddScoped<Correggo4.Servizi.ServizioTimone>();
builder.Services.AddHostedService<Correggo4.Servizi.DemonePropagazioni>();
// L'editor chiama /Correzioni/... con fetch: il token antiforgery viaggia in questo header.
builder.Services.AddAntiforgery(o => o.HeaderName = "RequestVerificationToken");

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.LoginPath = "/Account/Login";
        opt.AccessDeniedPath = "/Account/Login";
        opt.ExpireTimeSpan = TimeSpan.FromHours(8);
        opt.SlidingExpiration = true;
        opt.Cookie.Name = "correggo4";
    });

// Correggo4 puo' girare in una cartella qualsiasi di un dominio condiviso (http://dominio/cartella/),
// dietro IIS oggi e dietro nginx in Docker domani: la cartella non si conosce alla compilazione.
// Tre strade, a seconda di chi sta davanti:
//  - IIS con Correggo4 come applicazione nella cartella: il PathBase lo imposta IIS, niente da fare;
//  - un proxy che inoltra il percorso intero (/cartella/...): PathBase in configurazione;
//  - un proxy che toglie la cartella (nginx proxy_pass .../;): header X-Forwarded-Prefix.
// Si fidano degli header solo i proxy su loopback e reti private (IIS sulla stessa macchina,
// nginx nella rete Docker), salvo ForwardedHeaders:KnownNetworks in configurazione.
builder.Services.AddOptions<ForwardedHeadersOptions>().Configure<IConfiguration>((opt, cfg) =>
{
    opt.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
                         | ForwardedHeaders.XForwardedPrefix;
    string[] reti = cfg.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>()
                    ?? ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128", "fc00::/7"];
    opt.KnownIPNetworks.Clear();
    opt.KnownProxies.Clear();
    foreach (string rete in reti)
        opt.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(rete));
});

var app = builder.Build();

app.UseForwardedHeaders();
string percorsoBase = (app.Configuration["PathBase"] ?? "").Trim().TrimEnd('/');
if (percorsoBase != "")
    app.UsePathBase(percorsoBase.StartsWith('/') ? percorsoBase : "/" + percorsoBase);

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapStaticAssets();

// Le pagine dei volantini stanno fuori da wwwroot (storage separato).
string radiceVolantini = app.Configuration["Storage:VolantiniPath"]
                         ?? "/srv/istanta4/correggo4/storage/volantini";
Directory.CreateDirectory(radiceVolantini);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(radiceVolantini),
    RequestPath = "/volantini",
    ServeUnknownFileTypes = false
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Volantini}/{action=Index}/{id?}")
    .WithStaticAssets();

// Utenti di prova: creati solo se la tabella e' vuota. Credenziali inventate
// per l'esperimento, non provengono da nessun sistema reale.
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
    if (!await ctx.Utentis.AnyAsync())
    {
        ctx.Utentis.AddRange(
            new Utenti
            {
                Nome = "Giulia", Cognome = "Neri",
                Email = "gdo@correggo4.local", Username = "gdo",
                PswHash = Password.Hash("correggo4gdo"),
                Ruolo = Ruoli.CodiceGdo, Attivo = true,
                DataInserimento = DateTime.UtcNow
            },
            new Utenti
            {
                Nome = "Marco", Cognome = "Verdi",
                Email = "agenzia@correggo4.local", Username = "agenzia",
                PswHash = Password.Hash("correggo4agenzia"),
                Ruolo = Ruoli.CodiceAgenzia, Attivo = true, IsSuperAdmin = true,
                DataInserimento = DateTime.UtcNow
            });
        await ctx.SaveChangesAsync();
        app.Logger.LogInformation("Creati gli utenti di prova: gdo (GDO) e agenzia (Agenzia)");
    }
}

app.Run();

// Per WebApplicationFactory nei test di Correggo4.Tests.
public partial class Program;
