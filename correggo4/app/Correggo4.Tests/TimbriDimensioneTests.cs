using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1169: i quattro timbri di dimensione (x2, x4, meta', un quarto) mancavano nel pannello per
/// tutti. Ora ci sono fra i Gruppo e A confezione, ma solo per i Marketing (decisione dell'utente
/// in revisione: un Category senza reparti li vedeva); la policy dei reparti li toglie comunque.
/// </summary>
public class TimbriDimensioneTests
{
    private const short IdAutore = 7;

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-timbri-dimensione-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Volantino(int Id, long Box);

    /// <summary>Un volantino aperto con un prodotto.</summary>
    private static async Task<Volantino> VolantinoAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = "0S24_26_B_TDM_B", Classificazione = "0S24_26_B", Status = 1, Margini = "0,0,0,0",
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
            Path = "pag1_v1", PathFisico = "0S24_26_B/0S24_26_B_TDM_B/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        var box = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box1", Basecode = "8001234567890", Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        return new Volantino(vol.Id, box.Id);
    }

    private static ServizioCorrezioni.Utente Marketing() =>
        new(IdAutore, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "Marketing Prova");

    /// <summary>Tipo FICO 4 = GDO (AccessoFico.TipiPerNome).</summary>
    public static TheoryData<short> NonMarketing => new() { ServizioCorrezioni.TipoFicoCategory, 4 };

    [Fact]
    public void I_timbri_di_dimensione_sono_nel_pannello_fra_i_Gruppo_e_A_confezione()
    {
        var chiavi = ServizioCorrezioni.Timbri.Keys.ToList();

        int g4 = chiavi.IndexOf("_2_6_g4");
        Assert.Equal(PolicyManager.TimbriDimensione, chiavi.Skip(g4 + 1).Take(4));
        Assert.Equal("_4_1_aconf", chiavi[g4 + 5]);
        foreach (string t in PolicyManager.TimbriDimensione)
            Assert.True(File.Exists(Path.Combine(RadiceApplicazione(), "wwwroot", "immagini-correggo", t + ".png")), t);
    }

    [Fact]
    public async Task Un_Marketing_senza_policy_mette_il_timbro_x2()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esito = await servizio.NuovoTimbroAsync(Marketing(), v.Box, "_3_1_x2", 10, 10);

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Empty(TimbriEsclusi(await servizio.PaginePermesseAsync(Marketing(), v.Id)));
    }

    [Theory]
    [MemberData(nameof(NonMarketing))]
    public async Task Chi_non_e_Marketing_non_li_ha_anche_senza_policy(short tipoFico)
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);
        var utente = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, tipoFico, "Category Prova");

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();

        // I20-1171: al Category si toglie anche lo Star (viene prima nel pannello)
        var attesi = tipoFico == ServizioCorrezioni.TipoFicoCategory
            ? PolicyManager.TimbriDimensione.Prepend(ServizioCorrezioni.TimbroStar).ToList()
            : PolicyManager.TimbriDimensione.ToList();
        Assert.Equal(attesi, TimbriEsclusi(await servizio.PaginePermesseAsync(utente, v.Id)));
        Assert.False(ServizioCorrezioni.TimbroPermesso(utente, null, "_3_1_x2"));
        // gli altri timbri restano
        Assert.True(ServizioCorrezioni.TimbroPermesso(utente, null, "_2_1_artwork"));
    }

    /// <summary>I20-1171: lo Star non e' dei Category, con o senza policy; gli altri lo tengono.</summary>
    [Fact]
    public void Lo_Star_e_tolto_solo_ai_Category()
    {
        var policyReparti = PolicyManager.Crea(["56-03"]);
        var category = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "Category Prova");
        var gdo = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, 4, "GDO Prova");

        Assert.False(ServizioCorrezioni.TimbroPermesso(category, null, ServizioCorrezioni.TimbroStar));
        Assert.False(ServizioCorrezioni.TimbroPermesso(category, policyReparti, ServizioCorrezioni.TimbroStar));
        Assert.True(ServizioCorrezioni.TimbroPermesso(Marketing(), null, ServizioCorrezioni.TimbroStar));
        Assert.True(ServizioCorrezioni.TimbroPermesso(gdo, null, ServizioCorrezioni.TimbroStar));
        Assert.True(ServizioCorrezioni.TimbroPermesso(gdo, policyReparti, ServizioCorrezioni.TimbroStar));
    }

    /// <summary>Col GDO (il Category scrive solo a finestra aperta, FinestreCategory) si vede il rifiuto del server.</summary>
    [Fact]
    public async Task Il_server_rifiuta_il_timbro_x2_a_chi_non_e_Marketing()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);
        var gdo = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, 4, "GDO Prova");

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esito = await servizio.NuovoTimbroAsync(gdo, v.Box, "_3_1_x2", 10, 10);

        Assert.False(esito.Ok);
        Assert.Equal("timbro_fuori_policy", esito.Codice);
        Assert.True((await servizio.NuovoTimbroAsync(gdo, v.Box, "_2_2_star", 10, 10)).Ok);
    }

    [Fact]
    public async Task Con_la_policy_dei_reparti_i_timbri_di_dimensione_restano_esclusi()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            ctx.UtentiPolicies.Add(new UtentiPolicy
            {
                IdUtente = IdAutore, Policy = PolicyManager.Json(PolicyManager.Crea(["56-03"])!),
                Nota = AccessoFico.NotaAutomatica, DataModifica = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync();
        }

        using var s2 = app.Services.CreateScope();
        var servizio = s2.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esclusi = TimbriEsclusi(await servizio.PaginePermesseAsync(Marketing(), v.Id));

        Assert.Equal(PolicyManager.TimbriDimensione, esclusi);
        // il server lo rifiuta comunque
        Assert.False((await servizio.NuovoTimbroAsync(Marketing(), v.Box, "_3_1_x2", 10, 10)).Ok);
    }

    [Fact]
    public void La_pagina_toglie_i_timbri_esclusi_anche_senza_policy()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml")).Replace("\r\n", "\n");

        Assert.Contains("if (!d) return;\n" +
                        "            // I20-1169: i timbri di dimensione si tolgono a chi non e' Marketing anche senza policy\n" +
                        "            applicaTimbriEsclusi(d.timbriEsclusi);\n" +
                        "            if (d.conPolicy) applicaBoxFuoriPolicy();", html);
        Assert.DoesNotContain("if (!d || !d.conPolicy) return;\n            applicaBoxFuoriPolicy();", html);
    }

    private static List<string> TimbriEsclusi(EsitoCorrezione esito)
    {
        Assert.True(esito.Ok, esito.Messaggio);
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(esito.Dati));
        return doc.RootElement.GetProperty("timbriEsclusi").EnumerateArray().Select(e => e.GetString()!).ToList();
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
