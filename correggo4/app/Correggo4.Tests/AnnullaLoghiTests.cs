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
/// I20-1164: nella finestra del prodotto i loghi si annullano da soli. La correzione della descrizione
/// sta in due righe: il testo, e la lista dell'immagine con foto P/S (stati 1-3) e loghi (4-5).
/// ANNULLA CORREZIONE dei loghi toglie solo le voci dei loghi; quello della descrizione annulla testo
/// e foto e lascia i loghi in attesa.
/// </summary>
public class AnnullaLoghiTests
{
    private const short IdAutore = 7;
    private const string LogoAggiunto = "logo-aggiunto";

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-annulla-loghi-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Prodotto(long Box, long Descrizione, long Immagine);

    /// <summary>
    /// Un volantino aperto con un prodotto e la sua correzione in attesa: il testo, e nell'immagine
    /// le voci indicate (foto e/o loghi).
    /// </summary>
    private static async Task<Prodotto> ProdottoCorrettoAsync(WebApplicationFactory<Program> app, bool conTesto, params VoceFoto[] voci)
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
        var descr = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, IdParent = box.Id, LabelInd = SchemaReferenza.LabelDescrizione, Basecode = box.Basecode, Contenuto = "Mela", Larghezza = 50, Altezza = 10
        };
        var imm = new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, IdParent = box.Id, LabelInd = SchemaReferenza.LabelImmagine, Basecode = box.Basecode, Contenuto = "", Larghezza = 50, Altezza = 50
        };
        ctx.VolantiniPagineElementis.AddRange(descr, imm);
        await ctx.SaveChangesAsync();
        if (conTesto)
            ctx.VolantiniPagineElementiVersionis.Add(Riga(descr.Id, pagina.Id,
                "{\"id_utente\":7,\"register_date\":\"2026-10-29T15:00:00Z\",\"id_azione\":-1,\"keyvalues\":[{\"field\":\"descrizione\",\"valore\":\"Mela rossa\"}]}"));
        if (voci.Length > 0)
            ctx.VolantiniPagineElementiVersionis.Add(Riga(imm.Id, pagina.Id, JsonSerializer.Serialize(voci)));
        await ctx.SaveChangesAsync();
        return new Prodotto(box.Id, descr.Id, imm.Id);
    }

    private static VolantiniPagineElementiVersioni Riga(long idElemento, int idPagina, string nuovaVersione) => new()
    {
        IdElemento = idElemento, IdPagina = idPagina, IdAutore = IdAutore, DataModifica = DateTime.UtcNow,
        Stato = ServizioCorrezioni.EaRegistrato, NuovaVersione = nuovaVersione
    };

    private static VoceFoto Foto() => new() { guidid = "foto-nuova", codice = "8001234567890", nomeFile = "mela.jpg", stato = 1 };
    private static VoceFoto Logo() => new() { guidid = LogoAggiunto, codice = "BIO", nomeFile = "bio.png", stato = 4 };

    private static async Task<EsitoCorrezione> AnnullaAsync(WebApplicationFactory<Program> app, long idBox, string parte)
    {
        using var scope = app.Services.CreateScope();
        var u = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, null, "Marketing Prova");
        return await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>().AnnullaEditAsync(u, idBox, parte);
    }

    private static async Task<VolantiniPagineElementiVersioni?> RigaDiAsync(WebApplicationFactory<Program> app, long idElemento)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        return await ctx.VolantiniPagineElementiVersionis.AsNoTracking().FirstOrDefaultAsync(v => v.IdElemento == idElemento);
    }

    private static List<VoceFoto> Voci(VolantiniPagineElementiVersioni riga) =>
        JsonSerializer.Deserialize<List<VoceFoto>>(riga.NuovaVersione)!;

    [Fact]
    public async Task Annullare_i_loghi_lascia_in_attesa_descrizione_e_foto()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var p = await ProdottoCorrettoAsync(app, conTesto: true, Foto(), Logo());

        var esito = await AnnullaAsync(app, p.Box, "loghi");

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaRegistrato, (await RigaDiAsync(app, p.Descrizione))!.Stato);
        var imm = (await RigaDiAsync(app, p.Immagine))!;
        Assert.Equal(ServizioCorrezioni.EaRegistrato, imm.Stato);
        var voce = Assert.Single(Voci(imm));
        Assert.Equal(1, voce.stato);   // resta la foto, il logo e' andato
    }

    [Fact]
    public async Task Annullare_la_descrizione_lascia_in_attesa_i_loghi()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var p = await ProdottoCorrettoAsync(app, conTesto: true, Foto(), Logo());

        var esito = await AnnullaAsync(app, p.Box, "descrizione");

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaAnnullato, (await RigaDiAsync(app, p.Descrizione))!.Stato);
        var imm = (await RigaDiAsync(app, p.Immagine))!;
        Assert.Equal(ServizioCorrezioni.EaRegistrato, imm.Stato);
        var voce = Assert.Single(Voci(imm));
        Assert.Equal(LogoAggiunto, voce.guidid);
    }

    [Fact]
    public async Task Dopo_un_annullamento_parziale_si_annulla_anche_il_resto()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var p = await ProdottoCorrettoAsync(app, conTesto: true, Logo());

        Assert.True((await AnnullaAsync(app, p.Box, "descrizione")).Ok);
        // la riga del testo ora e' annullata: la correzione dei loghi si trova lo stesso
        var esito = await AnnullaAsync(app, p.Box, "loghi");

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(ServizioCorrezioni.EaAnnullato, (await RigaDiAsync(app, p.Immagine))!.Stato);
    }

    [Fact]
    public async Task Senza_loghi_in_attesa_non_c_e_niente_da_annullare()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var p = await ProdottoCorrettoAsync(app, conTesto: true, Foto());

        var esito = await AnnullaAsync(app, p.Box, "loghi");

        Assert.False(esito.Ok);
        Assert.Equal(ServizioCorrezioni.EaRegistrato, (await RigaDiAsync(app, p.Descrizione))!.Stato);
        Assert.Equal(ServizioCorrezioni.EaRegistrato, (await RigaDiAsync(app, p.Immagine))!.Stato);
    }
}
