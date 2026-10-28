using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Models.Vista;
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
/// I20-1154: come nel Correggo vecchio, la colonna Propagazioni della finestra del prodotto elenca i
/// volantini aperti dove compare lo stesso prodotto anche quando il prodotto non ha correzioni.
/// L'elenco arriva dal servizio dei gemelli (che non chiede una correzione) e la pagina lo chiede
/// subito, disegnandolo senza spunta.
/// </summary>
public class VolantiniDelProdottoTests
{
    private const string Promo = "0S24_26_B";

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-gemelli-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    /// <summary>Un volantino aperto (in correzione, non scaduto, versione non chiusa) con un prodotto.</summary>
    private static async Task<long> VolantinoAsync(WebApplicationFactory<Program> app, string titolo, string basecode)
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
            IdPagina = pagina.Id, LabelInd = "box1", Basecode = basecode, Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        return box.Id;
    }

    private static async Task<List<GemelloEditVista>> GemelliAsync(WebApplicationFactory<Program> app, long idBox)
    {
        using var scope = app.Services.CreateScope();
        var u = new ServizioCorrezioni.Utente(1, Ruoli.CodiceAgenzia, null, "Agenzia Prova");
        var esito = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().GemelliEditAsync(u, idBox, "offerta");
        Assert.True(esito.Ok, esito.Messaggio);
        return Assert.IsType<List<GemelloEditVista>>(esito.Dati);
    }

    [Fact]
    public async Task Senza_correzioni_il_prodotto_elenca_gli_altri_volantini_dove_compare()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        long avocado = await VolantinoAsync(app, "0S24_26_B_TDM_B", "8001234567890");
        await VolantinoAsync(app, "0S24_26_B_UFI_B1", "8001234567890");
        await VolantinoAsync(app, "0S24_26_B_TDM_B1", "8001234567890");
        await VolantinoAsync(app, "0S24_26_B_TDM_B2", "8009999999999");   // un altro prodotto

        var gemelli = await GemelliAsync(app, avocado);

        Assert.Equal(new[] { "0S24_26_B_TDM_B1", "0S24_26_B_UFI_B1" }, gemelli.Select(g => g.Volantino).ToArray());
        Assert.All(gemelli, g => Assert.False(g.Propagato));
    }

    [Fact]
    public async Task Un_prodotto_che_non_compare_altrove_non_elenca_volantini()
    {
        using var fabbrica = new FabbricaCorreggo();
        using var app = App(fabbrica);
        long solo = await VolantinoAsync(app, "0S24_26_B_TDM_B", "8001234567890");
        await VolantinoAsync(app, "0S24_26_B_UFI_B1", "8009999999999");

        Assert.Empty(await GemelliAsync(app, solo));
    }

    [Fact]
    public void La_finestra_chiede_i_volantini_anche_senza_correzioni_e_li_mostra_senza_spunta()
    {
        string html = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

        Assert.Contains("<div class=\"ea_prop_vuoto\" data-gemelli=\"offerta\" data-solo-elenco=\"1\">", html);
        Assert.DoesNotContain("'Salva una correzione: poi qui scegli su quali volantini gemelli portarla.'", html);

        int inizio = html.IndexOf("function disegnaVolantiniProdotto(", StringComparison.Ordinal);
        int fine = html.IndexOf("function disegnaGemelliEdit(", StringComparison.Ordinal);
        Assert.True(inizio > 0 && fine > inizio, "disegnaVolantiniProdotto non trovata prima di disegnaGemelliEdit");
        string corpo = html[inizio..fine];
        Assert.Contains("infoButton.png", corpo);
        Assert.DoesNotContain("checkbox", corpo);
        Assert.Contains("Questo prodotto non compare su altri volantini aperti.", corpo);
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
