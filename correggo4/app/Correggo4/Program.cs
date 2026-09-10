using System.Globalization;
using System.Security.Claims;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Ingestione;
using Correggo4.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
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

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.LoginPath = "/Account/Login";
        opt.AccessDeniedPath = "/Account/Login";
        opt.ExpireTimeSpan = TimeSpan.FromHours(8);
        opt.SlidingExpiration = true;
        opt.Cookie.Name = "correggo4";
    });

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapStaticAssets();

// Le pagine dei volantini stanno fuori da wwwroot (storage separato).
string radiceVolantini = builder.Configuration["Storage:VolantiniPath"]
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
