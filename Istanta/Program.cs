using DocumentFormat.OpenXml.Math;
using DocumentFormat.OpenXml.Office2016.Drawing.ChartDrawing;
using DocumentFormat.OpenXml.Wordprocessing;
using Istanta.Controllers;
using Istanta.Handlers;
using Istanta.MiddleWare;
using Istanta.Models;
using Istanta.SocketsManager;
using Istanta.Utility;
using IstantaLib;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Session;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Serialization;
using Serilog;
using Serilog.Events;
using System;
using System.Configuration;
using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Istanta.Models_2;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
AppContext.SetSwitch("Npgsql.DisableDateTimeInfinityConversions", true);


var logPath = Path.Combine(AppContext.BaseDirectory, "logs", "log-.txt");


Log.Logger = new LoggerConfiguration()
        //.MinimumLevel.Debug()
        //.WriteTo.Console()
        .MinimumLevel.Override("Microsoft", LogEventLevel.Warning) // Esclude debug/info di ASP.NET
    .MinimumLevel.Override("System", LogEventLevel.Warning)    // Esclude debug/info di .NET base
    .WriteTo.Async(a => a.File(
        logPath,
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
    ))
    .CreateLogger();


// CORREZIONE 9/9/2026 - portabilita su Linux.
// ExcelDataReader, appena costruisce la sua configurazione, chiede la codepage
// 1252 (Windows-1252). Su .NET quella codepage esiste solo su Windows: su Linux
// il framework porta con se solo UTF-8 e poche altre, e l'importazione di un
// tracciato .xlsx moriva con
//   System.NotSupportedException: No data is available for encoding 1252.
// Va registrato il provider delle codepage prima di qualunque lettura di Excel.
// NON serve alcun pacchetto: su net10 System.Text.Encoding.CodePages e gia nel
// framework (NuGet lo segnala con NU1510 se lo si aggiunge a mano).
// IL PROVIDER ERA GIA REGISTRATO, ma nel posto sbagliato: TracciatiController
// riga ~619 e ConfrontiController riga ~1413 lo registrano quando qualcuno
// passa di li. OperationsController.importaVolantino legge l'Excel senza
// passare da nessuno dei due, quindi il funzionamento dipendeva da cosa era
// stato aperto prima nella vita del processo: su Windows non si vede perche
// la 1252 c'e sempre, su Linux l'importazione va o non va a seconda
// dell'ordine. Registrandolo all'avvio il problema sparisce per tutti.
// Le due registrazioni nei controller restano: sono idempotenti e innocue.
// NON e un problema di PostgreSQL: riguarda qualunque Istanta che giri su Linux.
System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

var builder = WebApplication.CreateBuilder(args);

#if DEBUG

var chosenConfig = "coopfi";

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{chosenConfig}.json", optional: true, reloadOnChange: true);


#endif


builder.Services.AddHttpClient();
//builder.Services.AddDbContext<edro21_dbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("IstandaConnectionDb")!), ServiceLifetime.Transient);
builder.Services.AddDbContextFactory<edro21_dbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("IstandaConnectionDb")!));
builder.Services.AddDbContextFactory<Edro21_DbContext2>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("IstandaConnectionDb")!));
builder.Services.AddControllersWithViews(
    //options => {
    //    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    //}
).AddNewtonsoftJson(options2 => {
            options2.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            //options2.SerializerSettings.DateFormatString = "dd/MM/yyyy HH:mm:ss";
            //options2.SerializerSettings.Culture = CultureInfo.GetCultureInfo("it-IT");
});

builder.Host.UseSerilog();

builder.Services.AddControllersWithViews(options =>
{
    
});


//SQL Session
//IstantaSession
//Linea di comando per popolare il db session
//dotnet tool install --global dotnet-sql-cache
//dotnet-sql-cache create "Server=(LOCAL)\SQLEXPRESS;Database=SessionStorage;User Id=sa;Password=<LOCAL_PASSWORD>;TrustServerCertificate=true;" dbo SessionState
var connectionString = builder.Configuration.GetConnectionString("IstantaSession");


builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("IstantaSession");
    options.InstanceName = "istanta:";
});

builder.Services.AddSession(options =>
{
    options.Cookie.Name = ".MyApp.Session";
    options.IdleTimeout = TimeSpan.FromMinutes(180);//3 ore
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

//InProc Session
//TimeSpan sessionTimeout = TimeSpan.FromMinutes(120);


//builder.Services.AddSession(f =>
//{
//    f.IdleTimeout = sessionTimeout;
//    f.Cookie.HttpOnly = true;
//    f.Cookie.IsEssential = true;
//    //f.Cookie.SameSite = SameSiteMode.None;
//    //f.Cookie.SecurePolicy = CookieSecurePolicy.Always; 
//});

builder.Services.AddHostedService<BackgroundCodeService>();


/*builder.Services.AddSingleton<IConfiguration>(builder.Configuration);
var sect = builder.Configuration.GetSection("jpg_path_foto");
builder.Services.Configure<string>(sect);*/

builder.Services.Configure<PathFotoJpg>(
    builder.Configuration.GetSection(PathFotoJpg.jpg_path_foto));

builder.Services.Configure<PathOperationExport>(
    builder.Configuration.GetSection(PathOperationExport.path_to_export));

builder.Services.Configure<PathOperationImport>(
    builder.Configuration.GetSection(PathOperationImport.path_to_import));

builder.Services.Configure<PathExternal>(
    builder.Configuration.GetSection("external_paths"));

builder.Services.Configure<SyncOptions>(
    builder.Configuration.GetSection("sync_options"));

builder.Services.Configure<FicoConfig>(
    builder.Configuration.GetSection("fico"));

builder.Services.Configure<AntlrOptions>(
    builder.Configuration.GetSection("antlr_options"));

builder.Services.Configure<AuthADOptions>(
    builder.Configuration.GetSection("auth_ad_options"));


builder.Services.AddSingleton(_ => builder.Configuration);

//builder.Services.AddTransient<SingletonConfiguration>();
var configSect = builder.Configuration.GetSection("external_paths")["pathSource"];
SingletonConfiguration.ExternalSourcePath = configSect;// (builder.Configuration.GetSection("external_paths") as PathExternal).pathSource;
//builder.Services.AddSingleton<SingletonConfiguration>(singleton);

builder.Services.AddWebSocketManager();
builder.Services.AddHttpContextAccessor();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10737418240; // 10 GB
    options.BufferBodyLengthLimit = 10737418240; // 10 GB
    options.ValueCountLimit = int.MaxValue; // numero massimo di chiavi consentite
    options.KeyLengthLimit = int.MaxValue;
    options.ValueLengthLimit = int.MaxValue;


});


builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<CustomViewBagFilter>();
});


//Controlliao se esisrte auth_ad_options
var _clientID = builder.Configuration["auth_ad_options:ClientId"];
if (_clientID!=null)//builder.Configuration["auth_ad_options"] != null)
{

    builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie()
    .AddOpenIdConnect(options =>
    {
        options.Authority = $"https://login.microsoftonline.com/{builder.Configuration["auth_ad_options:TenantId"]}/v2.0";
        options.ClientId = builder.Configuration["auth_ad_options:ClientId"]!;
        options.ClientSecret = builder.Configuration["auth_ad_options:ClientSecret"]!;
        options.CallbackPath = "/signin-oidc";

        options.ResponseType = "code";
        options.SaveTokens = true;
    });
}

#if DEBUG


builder.WebHost.ConfigureKestrel(serveroptions => serveroptions.Limits.MaxRequestBodySize = int.MaxValue);
  
builder.WebHost.UseKestrel(options =>
{
    options.Limits.MaxRequestBodySize = int.MaxValue;

});

// Abilita Brotli e Gzip
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

// Configura livello di compressione Brotli
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});

#else


#endif

var app = builder.Build();


var defaultCulture = new CultureInfo("en-GB");
CultureInfo.DefaultThreadCurrentCulture = defaultCulture;
CultureInfo.DefaultThreadCurrentUICulture = defaultCulture;

// Aggiungi opzionalmente middleware di localizzazione
var localizationOptions = new RequestLocalizationOptions
{
    SupportedCultures = new List<CultureInfo> { defaultCulture },
    SupportedUICultures = new List<CultureInfo> { defaultCulture }
};

app.UseRequestLocalization(localizationOptions);

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    //app.UseHsts();
}

#if !DEBUG

app.UseHttpsRedirection();

#endif

//app.UseResponseCompression();

app.UseRouting();

app.UseStaticFiles();/* new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.PhysicalPath;
        if (path.EndsWith(".br"))
        {
            ctx.Context.Response.Headers.Add("Content-Encoding", "br");
            ctx.Context.Response.Headers.Add("Content-Type", "application/javascript");
        }
        else if (path.EndsWith(".gz"))
        {
            ctx.Context.Response.Headers.Add("Content-Encoding", "gzip");
        }
    }
});*/

app.UseAuthorization();
app.UseAuthentication();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Tracciati}/{action=Index}/{id?}");

// Configura CORS
app.UseCors(options => options.AllowAnyOrigin());


app.UseWebSockets();
app.MapSockets("/ws", app!.Services.GetService<WebSocketMessageHandler>()!);

app.MapGet("/ping", async (context) =>
{
    string session = SessionIstantaObject.GetSession(context);
    await context.Response.WriteAsync(session);
});

app.UseSession().UseMiddleware<LoginMiddleWare>();

string olyUrl= builder.Configuration.GetSection("fico")["olympusServerUrl"]!;
int inxDoubleSlash = olyUrl.IndexOf("//");
int inxFirstSep = olyUrl.IndexOf("/", inxDoubleSlash + 2);
if (inxFirstSep>0)
{
    olyUrl= olyUrl.Substring(0, inxFirstSep);
}



app.Use(async (context, next) => {

    var headers = context.Response.Headers;
    

    var nonce = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    context.Items["ScriptNonce"] = nonce;

    // CSP
    //Ha funzoinat ma solo per la pagina di login
    //devo mettere in tutte le dichiarazioni scirpt questa dicitura 
    /*
         @inject Microsoft.AspNetCore.Http.IHttpContextAccessor HttpContextAccessor
    <script nonce="@HttpContextAccessor.HttpContext?.Items["ScriptNonce"]">
     */

    //headers["Content-Security-Policy"] =
    //    $"default-src 'self'; " +
    //    $"connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com; " +
    //    $"script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com 'unsafe-inline'; " +
    //    $"style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com 'unsafe-inline'; " +
    //    $"font-src 'self' https://cdnjs.cloudflare.com; " +
    //    $"img-src 'self' data:; " +
    //    $"object-src 'none'; " +
    //    $"base-uri 'self'; " +
    //    $"frame-ancestors 'none';";

    //https://unpkg.com/monaco-editor@latest/min/vs/editor/editor.main.js
    //Troppo restrittivo il NONCE
    headers["Content-Security-Policy"] =
    $"default-src 'self'; " +
    $"connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com; " +
    $"script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com 'nonce-{nonce}' blob:; " +
    $"style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.datatables.net https://unpkg.com 'unsafe-inline'; " +
    $"font-src 'self' https://cdnjs.cloudflare.com data:; " +
    $"img-src 'self' "+ olyUrl + " data:; " +
    $"object-src 'none'; " +
    $"base-uri 'self'; " +
    $"frame-ancestors 'none';" +
    //$"child-src 'none';" +
    $"frame-src 'none';" +
    //$"worker-src 'none';" +
    $"media-src 'none';" +
    $"manifest-src 'self';"
    ;



    //headers["X-Frame-Options"] = "DENY";
    //headers["X-Content-Type-Options"] = "nosniff";

    var url = context.Request.Path.Value;

    if (url == "/" || url == "")
    {
        string? host = context.Request.Host.Value;
        /*if (host.IndexOf("/") > 0)
            host = host.Substring(host.IndexOf("/") + 1);
        else
            host = "";*/
        if (host == "navcovesviluppo")//NavcoveSviluppo
        {
            if (url == "/")
                context.Response.Redirect("Tracciati");
            else
                context.Response.Redirect("istanta3/Tracciati");// host + " / Tracciati");
            return;
        }
        /*else if (host == "produzione")
        {
            if (url == "/")
                context.Response.Redirect("Tracciati");
            else
                context.Response.Redirect("istanta2/Tracciati");// host + " / Tracciati");
            return;
        }*/
    }
    await next();
});





//var logFilePath = Path.Combine(AppContext.BaseDirectory, "logs\\register.log");
//var fileStream = new FileStream(logFilePath, FileMode.Append, FileAccess.Write);
//var writer = new StreamWriter(fileStream) { AutoFlush = true };
//Console.SetOut(writer);


Console.SetOut(new LogAssistent());
Console.SetError(new LogAssistent());

//Console.WriteLine(System.Globalization.CultureInfo.CurrentCulture.DisplayName);


app.Run();
