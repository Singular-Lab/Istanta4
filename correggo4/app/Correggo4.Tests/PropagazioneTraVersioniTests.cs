using System.Text.Json;
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
/// I20-1262: un timbro messo sulla versione 1 di un volantino non deve tornare sulla versione 2 dello
/// stesso volantino come proposta di propagazione (sbiadito, col megafono). Le proposte arrivano solo
/// dai gemelli di altri volantini aperti; la correzione non eseguita della versione 1 resta li' come
/// Irrisolta. Le due strade: l'eredita' alla pubblicazione (EreditaAsync, prodotto non riconosciuto
/// come lo stesso) e la costruzione della catena del demone (CostruisciAsync).
/// </summary>
public class PropagazioneTraVersioniTests
{
    private const string Promo = "0S24_26_B";
    private const string Basecode = "8001234567890";
    private const string Simbolo = "_4_2_alkg";   // Al kg: si propaga senza vincoli di promo o canale
    private const short IdAutore = 7;

    private static string Dna() => JsonSerializer.Serialize(new { codice = Basecode, gruppo = "G1", descrizione = "Avocado Hass" });

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-versioni-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private static async Task<T> ConContextAsync<T>(WebApplicationFactory<Program> app, Func<Correggo4Context, Task<T>> fai)
    {
        using var scope = app.Services.CreateScope();
        return await fai(scope.ServiceProvider.GetRequiredService<Correggo4Context>());
    }

    private static async Task<T> ConPropagazioneAsync<T>(WebApplicationFactory<Program> app, Func<ServizioPropagazione, Task<T>> fai)
    {
        using var scope = app.Services.CreateScope();
        return await fai(scope.ServiceProvider.GetRequiredService<ServizioPropagazione>());
    }

    /// <summary>Un volantino aperto, senza pagine.</summary>
    private static Task<int> VolantinoAsync(WebApplicationFactory<Program> app, string titolo) => ConContextAsync(app, async ctx =>
    {
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        return vol.Id;
    });

    /// <summary>Una versione del volantino con una pagina; chiusa = gia' superata da una versione nuova.</summary>
    private static Task<int> PaginaAsync(WebApplicationFactory<Program> app, int idVol, short versione, bool chiusa) => ConContextAsync(app, async ctx =>
    {
        var ver = new VolantiniVersioni
        {
            IdVol = idVol, Versione = versione, DataPubblicazione = DateTime.UtcNow,
            DataChiusura = chiusa ? DateTime.UtcNow : null
        };
        ctx.VolantiniVersionis.Add(ver);
        await ctx.SaveChangesAsync();
        var pagina = new VolantiniPagine
        {
            IdVol = idVol, IdVersione = ver.Id, Numero = 1, Versione = versione,
            Path = $"pag1_v{versione}", PathFisico = $"{Promo}/{idVol}/pag1_v{versione}", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        return pagina.Id;
    });

    private static Task<long> BoxAsync(WebApplicationFactory<Program> app, int idPagina, string etichetta) => ConContextAsync(app, async ctx =>
    {
        var box = new VolantiniPagineElementi
        {
            IdPagina = idPagina, LabelInd = etichetta, Basecode = Basecode, Dna = Dna(),
            Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        return box.Id;
    });

    /// <summary>Un timbro da fare sul box.</summary>
    private static Task<long> TimbroAsync(WebApplicationFactory<Program> app, int idPagina, long idBox) => ConContextAsync(app, async ctx =>
    {
        var t = new VolantiniPagineDisegniComposizioni
        {
            IdPagina = idPagina, IdElemento = idBox, Simbolo = Simbolo, Stato = 0,
            IdAutore = IdAutore, DataInserimento = DateTime.UtcNow
        };
        ctx.VolantiniPagineDisegniComposizionis.Add(t);
        await ctx.SaveChangesAsync();
        return t.Id;
    });

    /// <summary>Il demone costruisce la catena del timbro, come dopo il salvataggio.</summary>
    private static async Task CostruisciCatenaAsync(WebApplicationFactory<Program> app, long idTimbro, long idBox, int idVol)
    {
        await ConPropagazioneAsync(app, async s => { await s.GeneraPerTimbroAsync(idTimbro, idBox, idVol, Simbolo); return 0; });
        long idAttivita = await ConContextAsync(app, ctx => ctx.DemoneActivities.Where(a => a.IdDisegno == idTimbro)
            .Select(a => a.Id).SingleAsync());
        await ConPropagazioneAsync(app, s => s.CostruisciAsync(idAttivita));
    }

    private static Task<int> ProposteSulAsync(WebApplicationFactory<Program> app, long idBox) =>
        ConContextAsync(app, ctx => ctx.VolantiniPropagazioniElementis.AsNoTracking().CountAsync(pe => pe.IdElemento == idBox));

    // ------------------------------------------------------------------ pubblicazione della versione nuova

    [Fact]
    public async Task Pubblicando_la_v2_il_timbro_della_v1_non_torna_come_proposta()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int vol = await VolantinoAsync(app, "COOP CAPOFILA");
        int pag1 = await PaginaAsync(app, vol, 1, chiusa: true);
        long box1 = await BoxAsync(app, pag1, "box_p1_a");
        await TimbroAsync(app, pag1, box1);
        // lo stesso prodotto sulla v2 con un'etichetta diversa: per l'eredita' e' un prodotto nuovo
        int pag2 = await PaginaAsync(app, vol, 2, chiusa: false);
        long box2 = await BoxAsync(app, pag2, "box_p1_b");

        var esito = await ConPropagazioneAsync(app, s => s.EreditaAsync(vol, 2));

        Assert.Equal(0, esito.Nuove);
        Assert.Equal(0, await ProposteSulAsync(app, box2));
    }

    [Fact]
    public async Task Pubblicando_la_v2_le_proposte_dagli_altri_volantini_arrivano_ancora()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int altro = await VolantinoAsync(app, "COOP ALTRO");
        int pagAltro = await PaginaAsync(app, altro, 1, chiusa: false);
        long boxAltro = await BoxAsync(app, pagAltro, "box_altro");
        await TimbroAsync(app, pagAltro, boxAltro);

        int vol = await VolantinoAsync(app, "COOP CAPOFILA");
        await PaginaAsync(app, vol, 1, chiusa: true);
        int pag2 = await PaginaAsync(app, vol, 2, chiusa: false);
        long box2 = await BoxAsync(app, pag2, "box_p1_b");

        var esito = await ConPropagazioneAsync(app, s => s.EreditaAsync(vol, 2));

        Assert.Equal(1, esito.Nuove);
        Assert.Equal(1, await ProposteSulAsync(app, box2));
    }

    // ------------------------------------------------------------------ costruzione della catena

    [Fact]
    public async Task Il_timbro_di_una_versione_superata_non_propone_niente()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int vol = await VolantinoAsync(app, "COOP CAPOFILA");
        int pag1 = await PaginaAsync(app, vol, 1, chiusa: true);
        long box1 = await BoxAsync(app, pag1, "box_p1");
        long timbro = await TimbroAsync(app, pag1, box1);
        int pag2 = await PaginaAsync(app, vol, 2, chiusa: false);
        long box2 = await BoxAsync(app, pag2, "box_p1");
        int altro = await VolantinoAsync(app, "COOP ALTRO");
        int pagAltro = await PaginaAsync(app, altro, 1, chiusa: false);
        long boxAltro = await BoxAsync(app, pagAltro, "box_altro");

        // la catena si costruisce quando la v2 e' gia' arrivata (timbro messo e v2 caricata subito)
        await CostruisciCatenaAsync(app, timbro, box1, vol);

        Assert.Equal(0, await ProposteSulAsync(app, box2));
        Assert.Equal(0, await ProposteSulAsync(app, boxAltro));
    }

    [Fact]
    public async Task Un_altra_versione_dello_stesso_volantino_non_e_un_gemello()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int vol = await VolantinoAsync(app, "COOP CAPOFILA");
        // tutte e due aperte: il filtro sulle versioni chiuse da solo non basterebbe
        int pag1 = await PaginaAsync(app, vol, 1, chiusa: false);
        long box1 = await BoxAsync(app, pag1, "box_p1");
        int pag2 = await PaginaAsync(app, vol, 2, chiusa: false);
        long box2 = await BoxAsync(app, pag2, "box_p1");
        long timbro = await TimbroAsync(app, pag2, box2);

        await CostruisciCatenaAsync(app, timbro, box2, vol);

        Assert.Equal(0, await ProposteSulAsync(app, box1));
    }

    [Fact]
    public async Task Il_timbro_propone_ancora_ai_gemelli_degli_altri_volantini()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        int vol = await VolantinoAsync(app, "COOP CAPOFILA");
        int pag1 = await PaginaAsync(app, vol, 1, chiusa: false);
        long box1 = await BoxAsync(app, pag1, "box_p1");
        long timbro = await TimbroAsync(app, pag1, box1);
        int altro = await VolantinoAsync(app, "COOP ALTRO");
        int pagAltro = await PaginaAsync(app, altro, 1, chiusa: false);
        long boxAltro = await BoxAsync(app, pagAltro, "box_altro");

        await CostruisciCatenaAsync(app, timbro, box1, vol);

        Assert.Equal(1, await ProposteSulAsync(app, boxAltro));
    }
}
