using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1076: Promo/AggiornaDaFidelity, l'UpdateVolData.ashx dell'originale lasciato fuori dal porting.
/// fidelity-promotion lo chiama quando
/// l'operatore modifica una promo; Correggo4 verifica il Bearer su Olimpo e allinea nome e date di tutti
/// i volantini della promo (volantini.id_promo_fp). Olimpo qui e' finto, il database in memoria e lo
/// storage in una cartella temporanea.
/// </summary>
public class AggiornamentoPromoTests
{
    private static readonly Guid Promo = Guid.Parse("6f1c7e3a-2b44-4c55-9d1e-0a1b2c3d4e5f");
    private const string Token = "chiave-privata-di-prova";

    private static readonly DateTime Dal = new(2026, 10, 31, 23, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Al = new(2026, 11, 14, 23, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Scadenza = new(2026, 10, 20, 22, 0, 0, DateTimeKind.Utc);

    // ------------------------------------------------------------------ allestimento

    /// <summary>Olimpo che riconosce solo Token, con l'origine indicata.</summary>
    private static FabbricaCorreggo App(string origine = "FP", bool autorizzato = true)
    {
        var app = new FabbricaCorreggo();
        app.OlimpoFinto = req =>
        {
            if (req.RequestUri!.AbsolutePath != "/olimpo/auth/checkIdentity"
                || req.Headers.Authorization?.Parameter != Token)
                return new HttpResponseMessage(HttpStatusCode.Unauthorized);
            string json = JsonSerializer.Serialize(new
            {
                origin = origine,
                username = "operatore@fidelity.local",
                autorizzato,
                userPolicy = new { campi_essenziali = new Dictionary<string, object> { ["nome"] = "Anna", ["cognome"] = "Rossi", ["eta"] = 40 } }
            });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        };
        return app;
    }

    private static async Task<int> VolantinoAsync(FabbricaCorreggo app, string promo, string titolo, Guid? idPromo,
                                                  bool conPagine = true)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var v = new Volantini
        {
            Titolo = titolo, Classificazione = promo, IdPromoFp = idPromo, Status = 1,
            DataValiditaInizio = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            DataValiditaFine = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc),
            DataScadenza = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc)
        };
        ctx.Volantinis.Add(v);
        await ctx.SaveChangesAsync();

        if (conPagine)
        {
            ctx.VolantiniPagines.Add(new VolantiniPagine
            {
                IdVol = v.Id, Numero = 1, Versione = 1, Path = "pag1_v1",
                PathFisico = $"{promo}/{titolo}/pag1_v1", DataVersione = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync();

            string cartella = Path.Combine(app.CartellaVolantini, promo, titolo);
            Directory.CreateDirectory(Path.Combine(cartella, "thumbs"));
            await File.WriteAllTextAsync(Path.Combine(cartella, "pag1_v1.jpg"), "pagina");
        }
        return v.Id;
    }

    private static async Task<T> ConContestoAsync<T>(FabbricaCorreggo app, Func<Correggo4Context, Task<T>> leggi)
    {
        using var scope = app.Services.CreateScope();
        return await leggi(scope.ServiceProvider.GetRequiredService<Correggo4Context>());
    }

    /// <summary>La chiamata di fidelity (PromoController.updatePromo): form con i soli campi presenti.</summary>
    private static async Task<(bool Esito, string Errore)> AggiornaAsync(FabbricaCorreggo app,
        Dictionary<string, string> campi, string? token = Token, string rotta = "/Promo/AggiornaDaFidelity")
    {
        using var client = app.Client();
        using var req = new HttpRequestMessage(HttpMethod.Post, rotta) { Content = new MultipartFormDataContent() };
        foreach (var (k, v) in campi)
            ((MultipartFormDataContent)req.Content).Add(new StringContent(v), k);
        if (token != null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var r = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        using var json = JsonDocument.Parse(await r.Content.ReadAsStringAsync());
        return (json.RootElement.GetProperty("esito").GetBoolean(),
                json.RootElement.GetProperty("error_detail").GetString() ?? "");
    }

    private static Dictionary<string, string> Date(Guid promo) => new()
    {
        ["guid_id"] = promo.ToString(),
        ["validitaDal"] = "2026-10-31T23:00:00.000Z",
        ["validitaAl"] = "2026-11-14T23:00:00.000Z",
        ["dataScadenza"] = "2026-10-20T22:00:00.000Z",
        ["dataRegistrazione"] = "2026-10-09T10:00:00.000Z"
    };

    // ------------------------------------------------------------------ date

    [Fact]
    public async Task Le_date_nuove_vanno_su_tutti_i_volantini_della_promo()
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        int b = await VolantinoAsync(app, "PROMO A", "Volantino 2", Promo);
        int altro = await VolantinoAsync(app, "PROMO X", "Altro", Guid.NewGuid());

        var (esito, errore) = await AggiornaAsync(app, Date(Promo));

        Assert.True(esito, errore);
        Assert.Equal("", errore);
        var vols = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking().ToDictionaryAsync(v => v.Id));
        foreach (int id in new[] { a, b })
        {
            Assert.Equal(Dal, vols[id].DataValiditaInizio);
            Assert.Equal(Al, vols[id].DataValiditaFine);
            Assert.Equal(Scadenza, vols[id].DataScadenza);
        }
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), vols[altro].DataValiditaInizio);
    }

    [Fact]
    public async Task Il_cambio_di_date_avvisa_gli_altri_utenti()
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        await AggiornaAsync(app, Date(Promo));

        var notifiche = await ConContestoAsync(app, c => c.Notifiches.AsNoTracking().Where(n => n.IdVolantino == a).ToListAsync());
        Assert.NotEmpty(notifiche);
        Assert.All(notifiche, n => Assert.Equal("date", n.Tag));
    }

    [Fact]
    public async Task Si_aggiornano_solo_i_campi_ricevuti()
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        var (esito, _) = await AggiornaAsync(app, new() { ["guid_id"] = Promo.ToString(), ["dataScadenza"] = "2026-10-20T22:00:00.000Z" });

        Assert.True(esito);
        var v = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking().SingleAsync(x => x.Id == a));
        Assert.Equal(Scadenza, v.DataScadenza);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), v.DataValiditaInizio);
        Assert.Equal("PROMO A", v.Classificazione);
    }

    [Fact]
    public async Task Il_vecchio_percorso_ashx_non_e_esposto()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        using var client = app.Client();
        using var form = new MultipartFormDataContent { { new StringContent(Promo.ToString()), "guid_id" } };

        var r = await client.PostAsync("/UpdateVolData.ashx", form);

        // nessun controller risponde: in POST il fallback dei file statici (MapStaticAssets) da' 405,
        // come per qualunque percorso che Correggo4 non conosce
        Assert.Contains(r.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        Assert.DoesNotContain("esito", await r.Content.ReadAsStringAsync());
    }

    // ------------------------------------------------------------------ rinomina

    [Fact]
    public async Task La_promo_rinominata_si_porta_dietro_pagine_cartelle_e_finestre()
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        await ConContestoAsync(app, async c =>
        {
            c.VolantiniFinestreCategories.Add(new VolantiniFinestreCategory
                { Classificazione = "PROMO A", DataInizio = Dal, DataFine = Al, DataModifica = DateTime.UtcNow });
            c.TimoneFinestre.Add(new VolantiniTimoneFinestre
                { Classificazione = "PROMO A", DataInizio = Dal, DataFine = Al, IdAutore = 1, DataModifica = DateTime.UtcNow });
            return await c.SaveChangesAsync();
        });
        var campi = Date(Promo);
        campi["nomePromo"] = "PROMO B";

        var (esito, errore) = await AggiornaAsync(app, campi);

        Assert.True(esito, errore);
        var v = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking().SingleAsync(x => x.Id == a));
        Assert.Equal("PROMO B", v.Classificazione);
        var pagina = await ConContestoAsync(app, c => c.VolantiniPagines.AsNoTracking().SingleAsync(p => p.IdVol == a));
        Assert.Equal("PROMO B/Volantino 1/pag1_v1", pagina.PathFisico);
        Assert.True(File.Exists(Path.Combine(app.CartellaVolantini, "PROMO B", "Volantino 1", "pag1_v1.jpg")));
        Assert.False(Directory.Exists(Path.Combine(app.CartellaVolantini, "PROMO A")));
        var category = await ConContestoAsync(app, c => c.VolantiniFinestreCategories.AsNoTracking().Select(f => f.Classificazione).ToListAsync());
        Assert.Equal(new[] { "PROMO B" }, category);
        var timone = await ConContestoAsync(app, c => c.TimoneFinestre.AsNoTracking().Select(f => f.Classificazione).ToListAsync());
        Assert.Equal(new[] { "PROMO B" }, timone);

        // come cerca il volantino l'importazione di un .pack (ImportatorePack): stesso volantino, niente doppione
        var trovato = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Classificazione == "PROMO B" && x.Titolo == "Volantino 1"));
        Assert.Equal(a, trovato!.Id);
    }

    [Fact]
    public async Task La_pagina_si_vede_ancora_dopo_la_rinomina()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        var campi = Date(Promo);
        campi["nomePromo"] = "PROMO B";
        await AggiornaAsync(app, campi);

        using var client = app.Client();
        var r = await client.GetAsync("/volantini/PROMO%20B/Volantino%201/pag1_v1.jpg");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
    }

    [Fact]
    public async Task Rinomina_in_conflitto_con_un_altra_promo_non_cambia_nulla()
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        await VolantinoAsync(app, "PROMO B", "Volantino 1", Guid.NewGuid());
        var campi = Date(Promo);
        campi["nomePromo"] = "PROMO B";

        var (esito, errore) = await AggiornaAsync(app, campi);

        Assert.False(esito);
        Assert.Contains("PROMO B", errore);
        var v = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking().SingleAsync(x => x.Id == a));
        Assert.Equal("PROMO A", v.Classificazione);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), v.DataValiditaInizio);
        Assert.True(File.Exists(Path.Combine(app.CartellaVolantini, "PROMO A", "Volantino 1", "pag1_v1.jpg")));
    }

    [Fact]
    public async Task La_finestra_resta_al_vecchio_nome_se_un_altra_promo_lo_usa_ancora()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        await VolantinoAsync(app, "PROMO A", "Volantino 9", Guid.NewGuid(), conPagine: false);
        await ConContestoAsync(app, async c =>
        {
            c.VolantiniFinestreCategories.Add(new VolantiniFinestreCategory
                { Classificazione = "PROMO A", DataInizio = Dal, DataFine = Al, DataModifica = DateTime.UtcNow });
            return await c.SaveChangesAsync();
        });
        var campi = Date(Promo);
        campi["nomePromo"] = "PROMO B";

        var (esito, errore) = await AggiornaAsync(app, campi);

        Assert.True(esito, errore);
        var category = await ConContestoAsync(app, c => c.VolantiniFinestreCategories.AsNoTracking()
            .OrderBy(f => f.Classificazione).Select(f => f.Classificazione).ToListAsync());
        Assert.Equal(new[] { "PROMO A", "PROMO B" }, category);
    }

    // ------------------------------------------------------------------ casi negativi

    [Fact]
    public async Task Senza_volantini_della_promo_risponde_volantino_non_trovato()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Guid.NewGuid());

        var (esito, errore) = await AggiornaAsync(app, Date(Promo));

        Assert.False(esito);
        Assert.Equal("volantino_non_trovato", errore);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("token-sbagliato")]
    public async Task Senza_un_Bearer_riconosciuto_da_Olimpo_non_cambia_nulla(string? token)
    {
        using var app = App();
        int a = await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        var (esito, _) = await AggiornaAsync(app, Date(Promo), token);

        Assert.False(esito);
        var v = await ConContestoAsync(app, c => c.Volantinis.AsNoTracking().SingleAsync(x => x.Id == a));
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), v.DataValiditaInizio);
    }

    [Fact]
    public async Task Un_utente_non_autorizzato_da_Olimpo_e_rifiutato()
    {
        using var app = App(autorizzato: false);
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        var (esito, errore) = await AggiornaAsync(app, Date(Promo));

        Assert.False(esito);
        Assert.Contains("non autorizzato", errore);
    }

    [Fact]
    public async Task Un_utente_di_Correggo_stesso_e_rifiutato()
    {
        using var app = App(origine: "CO");
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        var (esito, errore) = await AggiornaAsync(app, Date(Promo));

        Assert.False(esito);
        Assert.Equal("Utente loopback non autorizzato", errore);
    }

    [Fact]
    public async Task Una_data_illeggibile_e_rifiutata()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);
        var campi = Date(Promo);
        campi["validitaAl"] = "non-una-data";

        var (esito, errore) = await AggiornaAsync(app, campi);

        Assert.False(esito);
        Assert.Contains("validitaAl", errore);
    }

    // ------------------------------------------------------------------ utente

    [Fact]
    public async Task L_utente_Olimpo_sconosciuto_diventa_Agenzia_senza_password()
    {
        using var app = App();
        await VolantinoAsync(app, "PROMO A", "Volantino 1", Promo);

        await AggiornaAsync(app, Date(Promo));

        var u = await ConContestoAsync(app, c => c.Utentis.AsNoTracking().SingleAsync(x => x.Email == "operatore@fidelity.local"));
        Assert.Equal(Ruoli.CodiceAgenzia, u.Ruolo);
        Assert.True(u.IsSuperAdmin);
        Assert.Equal("Anna", u.Nome);
        Assert.Equal("Rossi", u.Cognome);
        Assert.False(Password.Verifica("", u.PswHash));
    }
}
