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
/// I20-1174: le note di correzione si mettevano solo con un clic su un prodotto. Ora vanno in
/// qualsiasi punto e in qualsiasi pagina, anche senza prodotti (IdElemento null), con le regole
/// del volantino ma senza la policy dei reparti (scelta dell'utente); e con lo strumento Nota
/// un'etichetta sopra il cursore dice il codice del prodotto o «Nessuna referenza in questo punto».
/// </summary>
public class NoteInQualsiasiPuntoTests
{
    private const short IdAutore = 7;
    private const string Promo = "0S24_26_B";

    private static WebApplicationFactory<Program> App(FabbricaCorreggo fabbrica)
    {
        string nomeDb = "correggo4-note-punto-" + Guid.NewGuid().ToString("N");
        return fabbrica.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<DbContextOptions<Correggo4Context>>();
            s.RemoveAll<IDbContextOptionsConfiguration<Correggo4Context>>();
            s.AddDbContext<Correggo4Context>(o => o.UseInMemoryDatabase(nomeDb));
        }));
    }

    private sealed record Volantino(int Id, int PaginaConProdotto, int PaginaVuota, long Box);

    /// <summary>Un volantino aperto: pagina 1 con un prodotto, pagina 2 senza prodotti.</summary>
    private static async Task<Volantino> VolantinoAsync(WebApplicationFactory<Program> app, bool bloccato = false)
    {
        using var scope = app.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = Promo + "_TDM_B", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6),
            IdAutoreBlocco = bloccato ? (short)1 : null, DataScadenzaBlocco = bloccato ? DateTime.UtcNow.AddHours(1) : null
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = 1, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        VolantiniPagine Pagina(short n) => new()
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = n, Versione = 1,
            Path = $"pag{n}_v1", PathFisico = $"{Promo}/{vol.Titolo}/pag{n}_v1", DataVersione = DateTime.UtcNow
        };
        var p1 = Pagina(1);
        var p2 = Pagina(2);
        ctx.VolantiniPagines.AddRange(p1, p2);
        await ctx.SaveChangesAsync();
        var box = new VolantiniPagineElementi
        {
            IdPagina = p1.Id, LabelInd = "box1", Basecode = "3188717", Contenuto = "", Larghezza = 100, Altezza = 100
        };
        ctx.VolantiniPagineElementis.Add(box);
        await ctx.SaveChangesAsync();
        return new Volantino(vol.Id, p1.Id, p2.Id, box.Id);
    }

    private static ServizioCorrezioni.Utente Marketing() =>
        new(IdAutore, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoMarketing, "Marketing Prova");

    private static async Task<VolantiniPagineNote> UnicaNotaAsync(WebApplicationFactory<Program> app)
    {
        using var scope = app.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<Correggo4Context>()
            .VolantiniPagineNotes.AsNoTracking().SingleAsync();
    }

    [Fact]
    public async Task Una_nota_fuori_dai_prodotti_resta_sulla_pagina_senza_prodotto()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esito = await servizio.NuovaNotaAsync(Marketing(), 0, "manca il logo in alto", 40, 25, v.PaginaConProdotto);

        Assert.True(esito.Ok, esito.Messaggio);
        var nota = await UnicaNotaAsync(app);
        Assert.Null(nota.IdElemento);
        Assert.Equal(v.PaginaConProdotto, nota.IdPagina);
        Assert.Equal((40d, 25d), (nota.Posx, nota.Posy));
    }

    [Fact]
    public async Task Anche_nella_pagina_senza_prodotti()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var servizio = scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>();
        var esito = await servizio.NuovaNotaAsync(Marketing(), 0, "copertina: data sbagliata", 10, 10, v.PaginaVuota);

        Assert.True(esito.Ok, esito.Messaggio);
        Assert.Equal(v.PaginaVuota, (await UnicaNotaAsync(app)).IdPagina);
    }

    [Fact]
    public async Task Un_Category_con_la_policy_dei_reparti_la_mette_fuori_dai_prodotti()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);
        using (var scope = app.Services.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<Correggo4Context>();
            ctx.VolantiniFinestreCategories.Add(new VolantiniFinestreCategory
            {
                Classificazione = Promo, DataInizio = DateTime.UtcNow.AddDays(-1), DataFine = DateTime.UtcNow.AddDays(1),
                DataModifica = DateTime.UtcNow
            });
            ctx.UtentiPolicies.Add(new UtentiPolicy
            {
                IdUtente = IdAutore, Policy = PolicyManager.Json(PolicyManager.Crea(["56-03"])!),
                Nota = AccessoFico.NotaAutomatica, DataModifica = DateTime.UtcNow
            });
            await ctx.SaveChangesAsync();
        }
        var category = new ServizioCorrezioni.Utente(IdAutore, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "Category Prova");

        using var s2 = app.Services.CreateScope();
        var esito = await s2.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .NuovaNotaAsync(category, 0, "nota del category", 5, 5, v.PaginaVuota);

        Assert.True(esito.Ok, esito.Messaggio);
    }

    [Fact]
    public async Task Sul_volantino_bloccato_non_si_salva()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app, bloccato: true);

        using var scope = app.Services.CreateScope();
        var esito = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .NuovaNotaAsync(Marketing(), 0, "nota", 5, 5, v.PaginaVuota);

        Assert.False(esito.Ok);
        Assert.Equal("vol_bloccato", esito.Codice);
    }

    [Fact]
    public async Task Su_una_pagina_che_non_esiste_non_si_salva()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var esito = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .NuovaNotaAsync(Marketing(), 0, "nota", 5, 5, 999_999);

        Assert.False(esito.Ok);
    }

    [Fact]
    public async Task Sul_prodotto_la_nota_resta_legata_al_prodotto()
    {
        using var fabbrica = new FabbricaCorreggo();
        var app = App(fabbrica);
        var v = await VolantinoAsync(app);

        using var scope = app.Services.CreateScope();
        var esito = await scope.ServiceProvider.GetRequiredService<ServizioCorrezioni>()
            .NuovaNotaAsync(Marketing(), v.Box, "prezzo sbagliato", 20, 20);

        Assert.True(esito.Ok, esito.Messaggio);
        var nota = await UnicaNotaAsync(app);
        Assert.Equal(v.Box, nota.IdElemento);
        Assert.Equal(v.PaginaConProdotto, nota.IdPagina);
    }

    [Fact]
    public void La_pagina_accetta_il_clic_fuori_dai_prodotti_con_lo_strumento_Nota()
    {
        string html = Editor();

        Assert.Contains("if (strumento !== 'nota' || !stato.puoScrivere || document.body.classList.contains('tim_on')) return;\n" +
                        "            if (ev.target.closest('.zona, .corr_el, .attesa_agenzia')) return;", html);
        Assert.Contains("popNuovaNota(0, p.x, p.y, ev, Number(f.dataset.idPagina));", html);
        Assert.Contains("idPagina: idPagina || 0,", html);
        Assert.Contains("suggerisci('Nota: clicca nel punto da correggere')", html);
        Assert.DoesNotContain("clicca sul prodotto da correggere", html);
    }

    [Fact]
    public void Con_lo_strumento_Nota_l_etichetta_dice_il_codice_o_Nessuna_referenza()
    {
        string html = Editor();

        Assert.Contains("<div class=\"etichetta_nota\" id=\"etichettaNota\"></div>", html);
        Assert.Contains("etichettaNota.textContent = z ? (z.title || 'Prodotto') : 'Nessuna referenza in questo punto';", html);
        // la zona del prodotto porta il codice nel title
        Assert.Contains("<div class=\"zona\" data-box=\"@b.Id\" title=\"@b.Basecode\"", html);
        // rossa col testo bianco, e solo con lo strumento Nota
        Assert.Contains("background: #e30613; color: #fff;", html);
        Assert.Contains("if (strumento !== 'nota' || !f || document.body.classList.contains('tim_on')) { nascondiEtichettaNota(); return; }", html);
        Assert.Contains("if (s !== 'nota') nascondiEtichettaNota();", html);
    }

    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml")).Replace("\r\n", "\n");

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
