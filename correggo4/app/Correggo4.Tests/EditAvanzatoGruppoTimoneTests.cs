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
/// I20-1186: il Marketing non corregge dall'Edit avanzato dell'editor un box che sta in un gruppo
/// del timone (referenze di box diversi in una casella): la correzione del gruppo si fa dalla
/// «Modifica referenza» del timone. Il server rifiuta con 423 «gruppo_timone» e lo stato dell'editor
/// elenca quei box, perche' la scheda li apra in sola lettura con il messaggio.
///
/// Il volantino ha tre box: A e B nello stesso gruppo del timone, C da solo.
/// </summary>
public class EditAvanzatoGruppoTimoneTests
{
    private const short IdMarketing = 7;
    private const short IdAgenzia = 8;
    private const short IdCategory = 9;
    private const string Promo = "0524_26_B";

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-gruppo-timone-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Volantino(int Id, long BoxA, long BoxB, long BoxC, long Compagno);

    private static async Task<Volantino> VolantinoAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = Promo + "_TDM_B", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
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
            Path = "pag1_v1", PathFisico = $"{Promo}/{vol.Titolo}/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        VolantiniPagineElementi Box(string basecode) => new()
        {
            IdPagina = pagina.Id, LabelInd = "box", Basecode = basecode, Contenuto = "", Larghezza = 100, Altezza = 100
        };
        var a = Box("1078545");
        var b = Box("6562233");
        var c = Box("777");
        ctx.VolantiniPagineElementis.AddRange(a, b, c);
        await ctx.SaveChangesAsync();

        var piano = new VolantiniTimone
        {
            IdVol = vol.Id, Versione = 1, Stato = ServizioTimone.PianoInLavorazione, Revisione = 1,
            DataCreazione = DateTime.UtcNow, IdAutore = IdAgenzia
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();
        var tp = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 1, Ordine = 1, Attiva = true };
        ctx.TimonePagine.Add(tp);
        await ctx.SaveChangesAsync();
        VolantiniTimoneVoci Voce(VolantiniPagineElementi box, short? posizione, long? gruppo) => new()
        {
            IdTimone = piano.Id, IdElemento = box.Id, Codice = box.Basecode, Basecode = box.Basecode,
            Etichetta = box.Basecode, IdPaginaTimone = tp.Id, Posizione = posizione, IdGruppo = gruppo,
            PaginaOrigine = 1, Stato = ServizioTimone.VoceInPagina
        };
        var compagno = Voce(b, null, 1);
        ctx.TimoneVoci.AddRange(Voce(a, 1, 1), compagno, Voce(c, 2, null));
        // le due finestre aperte: il Marketing lavora nel timone, il Category corregge
        ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
        {
            Classificazione = Promo, DataInizio = DateTime.UtcNow.AddHours(-1), DataFine = DateTime.UtcNow.AddDays(1),
            IdAutore = IdAgenzia, DataModifica = DateTime.UtcNow
        });
        ctx.VolantiniFinestreCategories.Add(new VolantiniFinestreCategory
        {
            Classificazione = Promo, DataInizio = DateTime.UtcNow.AddHours(-1), DataFine = DateTime.UtcNow.AddDays(1),
            IdAutore = IdAgenzia, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
        return new Volantino(vol.Id, a.Id, b.Id, c.Id, compagno.Id);
    }

    private static ServizioCorrezioni.Utente Marketing() =>
        new(IdMarketing, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "Marketing Prova");

    private static ServizioCorrezioni.Utente Category() =>
        new(IdCategory, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "Category Prova");

    private static ServizioCorrezioni.Utente Agenzia() =>
        new(IdAgenzia, Ruoli.CodiceAgenzia, null, "Agenzia Prova");

    /// <summary>Le quattro scritture dell'Edit avanzato che il gruppo del timone ferma.</summary>
    private static Task<EsitoCorrezione> ScriviAsync(ServizioCorrezioni s, ServizioCorrezioni.Utente u, long idBox, string cosa) =>
        cosa switch
        {
            "offerta" => s.SalvaEditOffertaAsync(u, idBox, new RichiestaEditOfferta()),
            "descrizione" => s.SalvaEditDescrizioneAsync(u, idBox, new RichiestaEditScheda()),
            "annulla" => s.AnnullaEditAsync(u, idBox, ServizioCorrezioni.ParteOfferta),
            _ => s.PropagaEditAsync(u, idBox, ServizioCorrezioni.ParteOfferta, 0, true)
        };

    private static async Task<EsitoCorrezione> EsitoAsync(WebApplicationFactory<Program> app, ServizioCorrezioni.Utente u,
                                                          long idBox, string cosa)
    {
        using var scope = app.Services.CreateScope();
        return await ScriviAsync(scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>(), u, idBox, cosa);
    }

    [Theory]
    [InlineData("offerta")]
    [InlineData("descrizione")]
    [InlineData("annulla")]
    [InlineData("propaga")]
    public async Task Il_Marketing_e_fermato_sui_box_del_gruppo_con_il_messaggio(string cosa)
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        foreach (long box in new[] { v.BoxA, v.BoxB })
        {
            var e = await EsitoAsync(app, Marketing(), box, cosa);
            Assert.False(e.Ok);
            Assert.Equal(423, e.Http);
            Assert.Equal("gruppo_timone", e.Codice);
            Assert.Equal(ServizioCorrezioni.MessaggioGruppoTimone, e.Messaggio);
        }
        Assert.NotEqual("gruppo_timone", (await EsitoAsync(app, Marketing(), v.BoxC, cosa)).Codice);
    }

    [Fact]
    public async Task Category_e_Agenzia_non_sono_fermati()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        Assert.NotEqual("gruppo_timone", (await EsitoAsync(app, Category(), v.BoxA, "offerta")).Codice);
        Assert.NotEqual("gruppo_timone", (await EsitoAsync(app, Agenzia(), v.BoxA, "offerta")).Codice);
    }

    [Fact]
    public async Task Sciolto_il_gruppo_il_Marketing_torna_a_correggere()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            foreach (var voce in await ctx.TimoneVoci.ToListAsync())
            {
                voce.IdGruppo = null;
                if (voce.Id == v.Compagno) voce.Posizione = 3;
            }
            await ctx.SaveChangesAsync();
        }

        Assert.NotEqual("gruppo_timone", (await EsitoAsync(app, Marketing(), v.BoxA, "offerta")).Codice);
    }

    [Fact]
    public async Task Lo_stato_dell_editor_elenca_i_box_del_gruppo_solo_al_Marketing()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        Assert.Equal(new[] { v.BoxA, v.BoxB }.OrderBy(x => x), (await servizio.CaricaAsync(v.Id, Marketing())).BoxGruppoTimone);
        Assert.Empty((await servizio.CaricaAsync(v.Id, Category())).BoxGruppoTimone);
        Assert.Empty((await servizio.CaricaAsync(v.Id, Agenzia())).BoxGruppoTimone);
    }
}
