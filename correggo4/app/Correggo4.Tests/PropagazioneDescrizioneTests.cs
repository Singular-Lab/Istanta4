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
/// I20-1166: descrizione, foto e loghi si portano da soli su tutti i volantini gemelli aperti quando
/// chi corregge salva; i prezzi restano a spunta. Un gemello con una correzione sua la tiene.
/// </summary>
public class PropagazioneDescrizioneTests
{
    private const string Promo = "0S24_26_B";
    private const string Basecode = "8001234567890";
    private const short IdAutore = 7;

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-propaga-descrizione-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Prodotto(long Box, long Descrizione);

    /// <summary>Un volantino aperto con il prodotto e la sua descrizione.</summary>
    private static async Task<Prodotto> VolantinoAsync(WebApplicationFactory<Program> app, string titolo)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
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
            Path = "pag1_v1", PathFisico = $"{Promo}/{titolo}/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        var box = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box1", Basecode = Basecode, Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        var descr = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, IdParent = box.Id, LabelInd = SchemaReferenza.LabelDescrizione, Basecode = Basecode,
            Contenuto = "Avocado Hass", Larghezza = 50, Altezza = 10
        };
        ctx.VolantiniPagineElementis.Add(descr);
        await ctx.SaveChangesAsync();
        return new Prodotto(box.Id, descr.Id);
    }

    private static ServizioCorrezioni.Utente Gdo() => new(IdAutore, Ruoli.CodiceGdo, null, "Marketing Prova");

    private static async Task<EsitoCorrezione> SalvaDescrizioneAsync(WebApplicationFactory<Program> app, long idBox, string testo)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .SalvaEditDescrizioneAsync(Gdo(), idBox, new RichiestaEditScheda { Testo = testo, Sezione = "descrizione" });
    }

    private static async Task<List<VolantiniPagineElementiVersioni>> RigheDiAsync(WebApplicationFactory<Program> app, long idElemento)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        return await ctx.VolantiniPagineElementiVersionis.AsNoTracking().Where(v => v.IdElemento == idElemento).ToListAsync();
    }

    [Fact]
    public async Task Salvando_la_descrizione_arriva_su_tutti_i_gemelli_aperti()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B");
        var gemello1 = await VolantinoAsync(app, "0S24_26_B_TDM_B1");
        var gemello2 = await VolantinoAsync(app, "0S24_26_B_UFI_B");

        var esito = await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo");

        Assert.True(esito.Ok, esito.Messaggio);
        foreach (var g in new[] { gemello1, gemello2 })
        {
            var rimando = Assert.Single(await RigheDiAsync(app, g.Descrizione));
            Assert.Equal(pilota.Box, rimando.IdElementoMaster);   // il valore resta quello del pilota
            Assert.Equal(ServizioCorrezioni.EaRegistrato, rimando.Stato);
        }
    }

    [Fact]
    public async Task Un_gemello_con_una_correzione_sua_la_tiene()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B");
        var gemello = await VolantinoAsync(app, "0S24_26_B_TDM_B1");
        Assert.True((await SalvaDescrizioneAsync(app, gemello.Box, "Avocado Hass del gemello")).Ok);

        var esito = await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo");

        Assert.True(esito.Ok, esito.Messaggio);
        var sua = Assert.Single(await RigheDiAsync(app, gemello.Descrizione));
        Assert.Null(sua.IdElementoMaster);
        Assert.Contains("Avocado Hass del gemello", sua.NuovaVersione);
    }
}
