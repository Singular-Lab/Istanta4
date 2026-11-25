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
/// I20-1268: quando l'Agenzia conferma la correzione di un prodotto sul volantino in cui e' nata (dalla
/// finestra del prodotto o con «Conferma correzioni» del Plugin), la correzione arriva confermata sui
/// volantini gemelli aperti: descrizione, foto e loghi su tutti, anche dove non era ancora arrivata; i
/// prezzi solo sui gemelli spuntati. Sul gemello l'editor la vede confermata, e il Plugin della sua
/// lavorazione la riceve ancora fra quelle da applicare finche' non la applica.
/// </summary>
public class ConfermaPropagataTests
{
    private const string Promo = "0S24_26_B";
    private const string Basecode = "8001234567890";
    private const short IdMarketing = 7;
    private const short IdAgenzia = 8;

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-conferma-propagata-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Prodotto(int IdVol, int Lavorazione, long Box, long Descrizione);

    /// <summary>Un volantino della promo con il prodotto e la sua descrizione, aperto o scaduto.</summary>
    private static async Task<Prodotto> VolantinoAsync(WebApplicationFactory<Program> app, string titolo, int lavorazione,
                                                       bool scaduto = false, bool bloccato = false)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12),
            DataScadenza = scaduto ? oggi.AddDays(-1) : oggi.AddDays(6),
            IdLavorazioneIstanta = lavorazione, UltimaPubblicazione = DateTime.UtcNow,
            DataScadenzaBlocco = bloccato ? DateTime.UtcNow.AddMinutes(30) : null
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
        return new Prodotto(vol.Id, lavorazione, box.Id, descr.Id);
    }

    private static ServizioCorrezioni.Utente Marketing() => new(IdMarketing, Ruoli.CodiceGdo, null, "Marketing Prova");
    private static ServizioCorrezioni.Utente Agenzia() => new(IdAgenzia, Ruoli.CodiceAgenzia, null, "Agenzia Prova");

    private static async Task<T> ConServizioAsync<T>(WebApplicationFactory<Program> app, Func<ServizioCorrezioni, Task<T>> fai)
    {
        using var scope = app.Services.CreateScope();
        return await fai(scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>());
    }

    private static Task<EsitoCorrezione> SalvaDescrizioneAsync(WebApplicationFactory<Program> app, long idBox, string testo) =>
        ConServizioAsync(app, s => s.SalvaEditDescrizioneAsync(Marketing(), idBox, new RichiestaEditScheda { Testo = testo, Sezione = "descrizione" }));

    private static Task<EsitoCorrezione> ConfermaAsync(WebApplicationFactory<Program> app, long idBox, string parte) =>
        ConServizioAsync(app, s => s.ConfermaEditAsync(Agenzia(), idBox, parte));

    private static async Task<List<VolantiniPagineElementiVersioni>> RigheDiAsync(WebApplicationFactory<Program> app, long idElemento)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        return await ctx.VolantiniPagineElementiVersionis.AsNoTracking().Where(v => v.IdElemento == idElemento).ToListAsync();
    }

    /// <summary>Le correzioni che il Report Correggo del Plugin riceve per la lavorazione.</summary>
    private static async Task<List<CorrezionePlugin>> NelPluginAsync(WebApplicationFactory<Program> app, int lavorazione)
    {
        var esito = await ConServizioAsync(app, s => s.CorrezioniPerPluginAsync(Agenzia(), lavorazione));
        Assert.True(esito.Ok, esito.Messaggio);
        return ((CorrezioniPerPlugin)esito.Dati!).Correzioni;
    }

    /// <summary>La correzione della descrizione come la vede l'editor del volantino.</summary>
    private static async Task<EditVista> NellEditorAsync(WebApplicationFactory<Program> app, Prodotto p)
    {
        var stato = await ConServizioAsync(app, s => s.CaricaAsync(p.IdVol, Agenzia()));
        return Assert.Single(stato.Edit, e => e.IdBox == p.Box && e.Parte == ServizioCorrezioni.ParteDescrizione);
    }

    /// <summary>Una correzione dei prezzi registrata sul pilota e, se spuntato, il suo rimando su un gemello.</summary>
    private static async Task PrezziAsync(WebApplicationFactory<Program> app, Prodotto pilota, params Prodotto[] spuntati)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        int idPagina = await ctx.VolantiniPagineElementis.Where(e => e.Id == pilota.Box).Select(e => e.IdPagina).FirstAsync();
        ctx.VolantiniPagineElementiVersionis.Add(new VolantiniPagineElementiVersioni
        {
            IdElemento = pilota.Box, IdPagina = idPagina, NuovaVersione = "[]", DataModifica = DateTime.UtcNow,
            IdAutore = IdMarketing, Stato = ServizioCorrezioni.EaRegistrato
        });
        foreach (var g in spuntati)
        {
            int idPaginaGemello = await ctx.VolantiniPagineElementis.Where(e => e.Id == g.Box).Select(e => e.IdPagina).FirstAsync();
            ctx.VolantiniPagineElementiVersionis.Add(new VolantiniPagineElementiVersioni
            {
                IdElemento = g.Box, IdPagina = idPaginaGemello, NuovaVersione = "[]", DataModifica = DateTime.UtcNow,
                IdAutore = IdMarketing, Stato = ServizioCorrezioni.EaRegistrato, IdElementoMaster = pilota.Box
            });
        }
        await ctx.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ descrizione, foto e loghi

    [Fact]
    public async Task Confermata_sul_pilota_arriva_confermata_sui_gemelli_e_il_Plugin_la_riceve()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var gemello1 = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        var gemello2 = await VolantinoAsync(app, "0S24_26_B_UFI_B", 103);
        Assert.True((await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo")).Ok);

        var esito = await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteDescrizione);

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaCorretto, Assert.Single(await RigheDiAsync(app, pilota.Descrizione)).Stato);
        foreach (var g in new[] { gemello1, gemello2 })
        {
            var rimando = Assert.Single(await RigheDiAsync(app, g.Descrizione));
            Assert.Equal(pilota.Box, rimando.IdElementoMaster);
            Assert.Equal(ServizioCorrezioni.EaConfermataDaApplicare, rimando.Stato);

            // per l'editor e' confermata: nessun CONFERMA CORREZIONE da premere
            var vista = await NellEditorAsync(app, g);
            Assert.Equal(ServizioCorrezioni.EaCorretto, vista.Stato);
            Assert.True(vista.DaApplicareNelPlugin);

            // il Plugin della lavorazione del gemello la riceve, con il testo del pilota
            var c = Assert.Single(await NelPluginAsync(app, g.Lavorazione));
            Assert.Equal($"edit:{g.Box}:descrizione", c.Id);
            Assert.True(c.Propagata);
            Assert.Equal("Avocado Hass maturo", c.Descrizione);
        }
        // il pilota confermato non e' piu' da applicare, come prima
        Assert.Empty(await NelPluginAsync(app, pilota.Lavorazione));
    }

    [Fact]
    public async Task Arriva_anche_sul_gemello_aperto_dopo_il_salvataggio()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        Assert.True((await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo")).Ok);
        var tardivo = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);   // pubblicato dopo il SALVA
        Assert.Empty(await RigheDiAsync(app, tardivo.Descrizione));

        Assert.True((await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteDescrizione)).Ok);

        var rimando = Assert.Single(await RigheDiAsync(app, tardivo.Descrizione));
        Assert.Equal(pilota.Box, rimando.IdElementoMaster);
        Assert.Equal(ServizioCorrezioni.EaConfermataDaApplicare, rimando.Stato);
        Assert.Equal(IdMarketing, rimando.IdAutore);   // l'autore della correzione, non chi conferma
        Assert.Single(await NelPluginAsync(app, tardivo.Lavorazione));
    }

    [Fact]
    public async Task La_conferma_dal_Plugin_propaga_come_quella_dell_editor()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var gemello = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        Assert.True((await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo")).Ok);

        var esito = await ConServizioAsync(app, s => s.ChiudiDalPluginAsync(Agenzia(), pilota.Lavorazione,
            new[] { $"edit:{pilota.Box}:descrizione" }));

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaCorretto, Assert.Single(await RigheDiAsync(app, pilota.Descrizione)).Stato);
        Assert.Equal(ServizioCorrezioni.EaConfermataDaApplicare, Assert.Single(await RigheDiAsync(app, gemello.Descrizione)).Stato);
        Assert.Single(await NelPluginAsync(app, gemello.Lavorazione));
    }

    [Fact]
    public async Task Applicata_dal_Plugin_del_gemello_non_arriva_piu_e_resta_confermata()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var gemello = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        Assert.True((await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo")).Ok);
        Assert.True((await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteDescrizione)).Ok);

        var esito = await ConServizioAsync(app, s => s.ChiudiDalPluginAsync(Agenzia(), gemello.Lavorazione,
            new[] { $"edit:{gemello.Box}:descrizione" }));

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaCorretto, Assert.Single(await RigheDiAsync(app, gemello.Descrizione)).Stato);
        Assert.Empty(await NelPluginAsync(app, gemello.Lavorazione));
        var vista = await NellEditorAsync(app, gemello);
        Assert.Equal(ServizioCorrezioni.EaCorretto, vista.Stato);
        Assert.False(vista.DaApplicareNelPlugin);
    }

    [Fact]
    public async Task Non_tocca_i_gemelli_con_una_correzione_sua_scaduti_o_bloccati()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var suo = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        Assert.True((await SalvaDescrizioneAsync(app, suo.Box, "Avocado Hass del gemello")).Ok);
        Assert.True((await SalvaDescrizioneAsync(app, pilota.Box, "Avocado Hass maturo")).Ok);
        var scaduto = await VolantinoAsync(app, "0S24_26_B_UFI_B", 103, scaduto: true);
        var bloccato = await VolantinoAsync(app, "0S24_26_B_UFI_B1", 104, bloccato: true);

        Assert.True((await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteDescrizione)).Ok);

        var sua = Assert.Single(await RigheDiAsync(app, suo.Descrizione));
        Assert.Null(sua.IdElementoMaster);
        Assert.Equal(ServizioCorrezioni.EaRegistrato, sua.Stato);
        Assert.Empty(await RigheDiAsync(app, scaduto.Descrizione));
        Assert.Empty(await RigheDiAsync(app, bloccato.Descrizione));
    }

    // ------------------------------------------------------------------ prezzi

    [Fact]
    public async Task I_prezzi_confermati_arrivano_solo_sui_gemelli_spuntati()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var spuntato = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        var nonSpuntato = await VolantinoAsync(app, "0S24_26_B_UFI_B", 103);
        await PrezziAsync(app, pilota, spuntato);

        var esito = await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteOfferta);

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaCorretto, Assert.Single(await RigheDiAsync(app, pilota.Box)).Stato);
        var rimando = Assert.Single(await RigheDiAsync(app, spuntato.Box));
        Assert.Equal(ServizioCorrezioni.EaConfermataDaApplicare, rimando.Stato);
        Assert.Empty(await RigheDiAsync(app, nonSpuntato.Box));
    }

    [Fact]
    public async Task Una_correzione_arrivata_confermata_non_si_annulla_ne_si_toglie()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var pilota = await VolantinoAsync(app, "0S24_26_B_TDM_B", 101);
        var gemello = await VolantinoAsync(app, "0S24_26_B_TDM_B1", 102);
        await PrezziAsync(app, pilota, gemello);
        Assert.True((await ConfermaAsync(app, pilota.Box, ServizioCorrezioni.ParteOfferta)).Ok);

        var togli = await ConServizioAsync(app, s => s.PropagaEditAsync(Marketing(), pilota.Box, ServizioCorrezioni.ParteOfferta, gemello.Box, propaga: false));

        Assert.False(togli.Ok);
        Assert.Equal("gia_confermata", togli.Codice);
        Assert.Equal(ServizioCorrezioni.EaConfermataDaApplicare, Assert.Single(await RigheDiAsync(app, gemello.Box)).Stato);
    }
}
