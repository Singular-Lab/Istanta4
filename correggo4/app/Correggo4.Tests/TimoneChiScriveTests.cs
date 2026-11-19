using System.Text.Json;
using Correggo4.Auth;
using Correggo4.Data;
using Correggo4.Models;
using Correggo4.Servizi;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1246: chi modifica il menabò avanzato, e quando. Il Marketing a finestra aperta, l'Agenzia a
/// finestra chiusa: cosi' l'Agenzia puo' risistemare le referenze messe male dal Marketing, senza
/// passare dall'Edit avanzato. Quello che l'Agenzia salva dopo l'ultimo FATTO arriva al Plugin come
/// gli scambi del Marketing (con l'Agenzia come autore) e riaccende il «da sistemare».
/// La regola c'era gia' (ServizioTimone.PuoScrivereAsync): questi test la fissano.
/// ServizioTimone diretto sul database in memoria, con le transazioni ignorate.
/// </summary>
public class TimoneChiScriveTests
{
    private const string Promo = "0524_26_B";

    private static Correggo4Context Contesto(string nomeDb) =>
        new(new DbContextOptionsBuilder<Correggo4Context>()
            .UseInMemoryDatabase(nomeDb)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Prova(string Db, int IdVol, ServizioTimone.Chi Agenzia, ServizioTimone.Chi Marketing);

    /// <summary>Agenzia, Marketing e un volantino con una pagina e due box affiancati, 8001 e 8002.</summary>
    private static async Task<Prova> ProvaAsync()
    {
        string db = "correggo4-timone-chi-scrive-" + Guid.NewGuid().ToString("N");
        using var ctx = Contesto(db);
        var agenzia = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        var marketing = new Utenti
        {
            Nome = "Marketing", Cognome = "Prova", Email = "marketing@prova.local", Username = "marketing-prova",
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioTimone.TipoFicoMarketing, Attivo = true,
            DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.AddRange(agenzia, marketing);

        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = "Volantino", Classificazione = Promo, Status = 1, Margini = "0,0,0,0",
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
            Path = "pag1_v1", PathFisico = $"{Promo}/Volantino/pag1_v1", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        ctx.VolantiniPagineElementis.AddRange(
            new VolantiniPagineElementi
            {
                IdPagina = pagina.Id, LabelInd = "box1", Basecode = "8001", Contenuto = "",
                Larghezza = 100, Altezza = 100, PosizioneX = 0, PosizioneY = 0
            },
            new VolantiniPagineElementi
            {
                IdPagina = pagina.Id, LabelInd = "box2", Basecode = "8002", Contenuto = "",
                Larghezza = 100, Altezza = 100, PosizioneX = 100, PosizioneY = 0
            });
        await ctx.SaveChangesAsync();

        return new Prova(db, vol.Id,
            new ServizioTimone.Chi(agenzia.Id, agenzia.Ruolo, null, "Agenzia Prova"),
            new ServizioTimone.Chi(marketing.Id, marketing.Ruolo, marketing.TipoUtenteFico, "Marketing Prova"));
    }

    private static async Task ApriFinestraAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).SalvaFinestraAsync(p.Agenzia, Promo,
            DateTime.UtcNow.AddMinutes(-5), DateTime.UtcNow.AddHours(1));
        Assert.True(e.Ok, e.Messaggio);
    }

    private static async Task ChiudiFinestraAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).ChiudiFinestraAsync(p.Agenzia, Promo);
        Assert.True(e.Ok, e.Messaggio);
    }

    /// <summary>
    /// Salva il piano con 8001 e 8002 nelle caselle indicate, griglia 2x3: «scambiate» le mette una al
    /// posto dell'altra, altrimenti tornano dove sono nell'impaginato.
    /// </summary>
    private static async Task<ServizioTimone.Esito> SalvaAsync(Prova p, ServizioTimone.Chi chi, bool scambiate)
    {
        using var ctx = Contesto(p.Db);
        var piano = await ctx.Timoni.AsNoTracking().SingleAsync(t => t.IdVol == p.IdVol);
        var pagine = await ctx.TimonePagine.AsNoTracking().Where(x => x.IdTimone == piano.Id).ToListAsync();
        var voci = await ctx.TimoneVoci.AsNoTracking().Where(v => v.IdTimone == piano.Id).OrderBy(v => v.Id).ToListAsync();
        Assert.Equal(2, voci.Count);
        var salvate = voci.Select((v, i) => new ServizioTimone.VoceSalvata(
            v.Id, v.IdPaginaTimone, (short)(scambiate ? voci.Count - i : i + 1), 0, null)).ToList();
        return await new ServizioTimone(ctx).SalvaAsync(chi, p.IdVol, piano.Revisione,
            pagine.Select(x => new ServizioTimone.PaginaSalvata(x.Id, "2x3", null, null, null)).ToList(), salvate);
    }

    private static async Task<bool> PuoScrivereAsync(Prova p, ServizioTimone.Chi chi)
    {
        using var ctx = Contesto(p.Db);
        var e = await new ServizioTimone(ctx).PianoAsync(chi, p.IdVol);
        Assert.True(e.Ok, e.Messaggio);
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(e.Dati));
        return doc.RootElement.GetProperty("puoScrivere").GetBoolean();
    }

    private static async Task<ScambiTimone?> ScambiAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        return await new ServizioTimone(ctx).ScambiPerPluginAsync(p.IdVol);
    }

    [Fact]
    public async Task A_finestra_aperta_scrive_il_Marketing_e_non_l_Agenzia()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);

        Assert.True(await PuoScrivereAsync(p, p.Marketing));
        Assert.False(await PuoScrivereAsync(p, p.Agenzia));

        var agenzia = await SalvaAsync(p, p.Agenzia, scambiate: true);
        Assert.False(agenzia.Ok);
        Assert.Equal(423, agenzia.Http);
        Assert.Equal("finestra_timone_aperta", agenzia.Codice);

        var marketing = await SalvaAsync(p, p.Marketing, scambiate: true);
        Assert.True(marketing.Ok, marketing.Messaggio);
    }

    [Fact]
    public async Task A_finestra_chiusa_scrive_l_Agenzia_e_non_il_Marketing()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);
        Assert.True((await SalvaAsync(p, p.Marketing, scambiate: true)).Ok);
        await ChiudiFinestraAsync(p);

        Assert.False(await PuoScrivereAsync(p, p.Marketing));
        Assert.True(await PuoScrivereAsync(p, p.Agenzia));

        var marketing = await SalvaAsync(p, p.Marketing, scambiate: false);
        Assert.False(marketing.Ok);
        Assert.Equal(423, marketing.Http);
        Assert.Equal("finestra_timone_chiusa", marketing.Codice);

        // l'Agenzia rimette a posto le due referenze spostate dal Marketing
        var agenzia = await SalvaAsync(p, p.Agenzia, scambiate: false);
        Assert.True(agenzia.Ok, agenzia.Messaggio);
    }

    [Fact]
    public async Task Quello_che_l_Agenzia_salva_dopo_il_FATTO_arriva_al_Plugin_come_gli_scambi_del_Marketing()
    {
        var p = await ProvaAsync();
        await ApriFinestraAsync(p);
        Assert.True((await SalvaAsync(p, p.Marketing, scambiate: true)).Ok);
        await ChiudiFinestraAsync(p);

        // gli scambi del Marketing arrivano al Plugin
        var delMarketing = await ScambiAsync(p);
        Assert.NotNull(delMarketing);
        Assert.Equal("Marketing", delMarketing!.TipoAutore);
        Assert.Equal(2, delMarketing.Scambi.Count);

        // l'Agenzia li riporta sull'impaginato e registra il FATTO: non resta niente da importare
        using (var ctx = Contesto(p.Db))
            Assert.True((await new ServizioTimone(ctx).SistematoAsync(p.Agenzia, p.IdVol)).Ok);
        Assert.Null(await ScambiAsync(p));

        // poi l'Agenzia risistema le referenze dal menabò avanzato
        await Task.Delay(20);
        Assert.True((await SalvaAsync(p, p.Agenzia, scambiate: false)).Ok);

        var dellAgenzia = await ScambiAsync(p);
        Assert.NotNull(dellAgenzia);
        Assert.Equal("Agenzia", dellAgenzia!.TipoAutore);
        Assert.Equal(new[] { "8001", "8002" }, dellAgenzia.Scambi.Select(s => s.Codice).OrderBy(c => c).ToArray());
        Assert.All(dellAgenzia.Scambi, s => Assert.Null(s.DaSistemareAMano));
        Assert.Contains(dellAgenzia.Scambi, s => s.Codice == "8001" && s.BasecodeDestinazione == "8001");

        using (var ctx = Contesto(p.Db))
            Assert.Equal(new[] { p.IdVol }, await new ServizioTimone(ctx).VolantiniDaSistemareAsync(p.Agenzia, p.IdVol));
    }
}
