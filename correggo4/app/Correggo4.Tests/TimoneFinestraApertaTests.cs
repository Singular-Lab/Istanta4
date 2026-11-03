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
/// I20-1182: l'Agenzia apriva la finestra del Marketing su una promo, la pagina la dava aperta, ma
/// dentro i volantini Agenzia e Marketing trovavano «Il timone non e' ancora stato aperto»: la
/// finestra scriveva solo le date, e il piano nasceva soltanto da «Apri il timone», volantino per
/// volantino. Ora a finestra aperta il timone c'e' sempre: lo apre il salvataggio della finestra, e
/// PianoAsync per le finestre gia' aperte e per le versioni arrivate dopo.
///
/// ServizioTimone diretto sul database in memoria, con le transazioni ignorate.
/// </summary>
public class TimoneFinestraApertaTests
{
    private const string Promo = "0524_26_B";
    private const string AltraPromo = "0525_26_B";

    private static Correggo4Context Contesto(string nomeDb) =>
        new(new DbContextOptionsBuilder<Correggo4Context>()
            .UseInMemoryDatabase(nomeDb)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Prova(string Db, ServizioTimone.Chi Agenzia, ServizioTimone.Chi Marketing);

    private static async Task<Prova> ProvaAsync()
    {
        string db = "correggo4-timone-finestra-" + Guid.NewGuid().ToString("N");
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
        await ctx.SaveChangesAsync();
        return new Prova(db,
            new ServizioTimone.Chi(agenzia.Id, agenzia.Ruolo, null, "Agenzia Prova"),
            new ServizioTimone.Chi(marketing.Id, marketing.Ruolo, marketing.TipoUtenteFico, "Marketing Prova"));
    }

    /// <summary>Un volantino della promo con una pagina e un box per ogni versione indicata.</summary>
    private static async Task<int> VolantinoAsync(string db, string promo, string titolo, params short[] versioni)
    {
        using var ctx = Contesto(db);
        var oggi = DateTime.UtcNow.Date;
        var vol = new Volantini
        {
            Titolo = titolo, Classificazione = promo, Status = 1, Margini = "0,0,0,0",
            DataValiditaInizio = oggi.AddDays(-2), DataValiditaFine = oggi.AddDays(12), DataScadenza = oggi.AddDays(6)
        };
        ctx.Volantinis.Add(vol);
        await ctx.SaveChangesAsync();
        foreach (short ver in versioni)
            await VersioneAsync(ctx, vol, ver);
        return vol.Id;
    }

    private static async Task VersioneAsync(Correggo4Context ctx, Volantini vol, short ver)
    {
        var versione = new VolantiniVersioni { IdVol = vol.Id, Versione = ver, DataPubblicazione = DateTime.UtcNow };
        ctx.VolantiniVersionis.Add(versione);
        await ctx.SaveChangesAsync();
        var pagina = new VolantiniPagine
        {
            IdVol = vol.Id, IdVersione = versione.Id, Numero = 1, Versione = ver,
            Path = $"pag1_v{ver}", PathFisico = $"{vol.Classificazione}/{vol.Titolo}/pag1_v{ver}", DataVersione = DateTime.UtcNow
        };
        ctx.VolantiniPagines.Add(pagina);
        await ctx.SaveChangesAsync();
        ctx.VolantiniPagineElementis.Add(new VolantiniPagineElementi
        {
            IdPagina = pagina.Id, LabelInd = "box1", Basecode = "8001234567890", Contenuto = "",
            Larghezza = 100, Altezza = 100
        });
        await ctx.SaveChangesAsync();
    }

    private static async Task<List<VolantiniTimone>> PianiAsync(string db, int idVol)
    {
        using var ctx = Contesto(db);
        return await ctx.Timoni.AsNoTracking().Where(t => t.IdVol == idVol).OrderBy(t => t.Versione).ToListAsync();
    }

    /// <summary>La finestra scritta direttamente, come la trova in produzione chi l'ha aperta prima della correzione.</summary>
    private static async Task FinestraAsync(string db, short idAutore, DateTime inizio, DateTime fine)
    {
        using var ctx = Contesto(db);
        ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
        {
            Classificazione = Promo, DataInizio = inizio, DataFine = fine, IdAutore = idAutore, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();
    }

    private static bool Esiste(ServizioTimone.Esito e)
    {
        Assert.True(e.Ok, e.Messaggio);
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(e.Dati));
        return doc.RootElement.GetProperty("esiste").GetBoolean();
    }

    [Fact]
    public async Task Aprendo_la_finestra_si_apre_il_timone_dei_volantini_della_promo()
    {
        var p = await ProvaAsync();
        int primo = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);
        int secondo = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_B", 1, 2);
        int senzaPagine = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_C");
        int altraPromo = await VolantinoAsync(p.Db, AltraPromo, "0525_26_B_TDM_A", 1);

        using (var ctx = Contesto(p.Db))
        {
            var e = await new ServizioTimone(ctx).SalvaFinestraAsync(p.Agenzia, Promo, null, DateTime.UtcNow.AddDays(2));
            Assert.True(e.Ok, e.Messaggio);
        }

        var pianiPrimo = await PianiAsync(p.Db, primo);
        Assert.Single(pianiPrimo);
        Assert.Equal(1, pianiPrimo[0].Versione);
        Assert.Equal(p.Agenzia.Id, pianiPrimo[0].IdAutore);
        var pianiSecondo = await PianiAsync(p.Db, secondo);
        Assert.Single(pianiSecondo);
        Assert.Equal(2, pianiSecondo[0].Versione);
        Assert.Empty(await PianiAsync(p.Db, senzaPagine));
        Assert.Empty(await PianiAsync(p.Db, altraPromo));

        using (var ctx = Contesto(p.Db))
        {
            var servizio = new ServizioTimone(ctx);
            Assert.True(Esiste(await servizio.PianoAsync(p.Marketing, primo)));
            Assert.True(Esiste(await servizio.PianoAsync(p.Agenzia, secondo)));
        }
    }

    [Fact]
    public async Task Una_finestra_che_parte_piu_avanti_non_apre_ancora_niente()
    {
        var p = await ProvaAsync();
        int vol = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);

        using var ctx = Contesto(p.Db);
        var servizio = new ServizioTimone(ctx);
        var e = await servizio.SalvaFinestraAsync(p.Agenzia, Promo,
            DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(3));
        Assert.True(e.Ok, e.Messaggio);

        Assert.Empty(await PianiAsync(p.Db, vol));
        Assert.False(Esiste(await servizio.PianoAsync(p.Marketing, vol)));
        Assert.Empty(await PianiAsync(p.Db, vol));
    }

    [Fact]
    public async Task Il_Marketing_a_finestra_gia_aperta_trova_il_timone_aperto_dall_Agenzia()
    {
        var p = await ProvaAsync();
        int vol = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);
        await FinestraAsync(p.Db, p.Agenzia.Id, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddDays(1));

        using (var ctx = Contesto(p.Db))
            Assert.True(Esiste(await new ServizioTimone(ctx).PianoAsync(p.Marketing, vol)));

        var piani = await PianiAsync(p.Db, vol);
        Assert.Single(piani);
        Assert.Equal(p.Agenzia.Id, piani[0].IdAutore);
        using (var ctx = Contesto(p.Db))
            Assert.Single(await ctx.TimoneVoci.AsNoTracking().Where(v => v.IdTimone == piani[0].Id).ToListAsync());
    }

    [Fact]
    public async Task A_finestra_chiusa_il_timone_resta_da_aprire()
    {
        var p = await ProvaAsync();
        int vol = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);
        await FinestraAsync(p.Db, p.Agenzia.Id, DateTime.UtcNow.AddDays(-3), DateTime.UtcNow.AddDays(-1));

        using var ctx = Contesto(p.Db);
        var servizio = new ServizioTimone(ctx);
        Assert.False(Esiste(await servizio.PianoAsync(p.Marketing, vol)));
        Assert.False(Esiste(await servizio.PianoAsync(p.Agenzia, vol)));
        Assert.Empty(await PianiAsync(p.Db, vol));
    }

    [Fact]
    public async Task Una_versione_nuova_a_finestra_aperta_ha_il_suo_timone()
    {
        var p = await ProvaAsync();
        int vol = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);
        using (var ctx = Contesto(p.Db))
            Assert.True((await new ServizioTimone(ctx).SalvaFinestraAsync(p.Agenzia, Promo, null, DateTime.UtcNow.AddDays(2))).Ok);

        using (var ctx = Contesto(p.Db))
            await VersioneAsync(ctx, await ctx.Volantinis.FirstAsync(v => v.Id == vol), 2);

        using (var ctx = Contesto(p.Db))
            Assert.True(Esiste(await new ServizioTimone(ctx).PianoAsync(p.Marketing, vol)));

        var piani = await PianiAsync(p.Db, vol);
        Assert.Equal(new short[] { 1, 2 }, piani.Select(t => t.Versione).ToArray());
    }

    [Fact]
    public async Task Un_timone_gia_aperto_non_si_rifotografa()
    {
        var p = await ProvaAsync();
        int vol = await VolantinoAsync(p.Db, Promo, "0524_26_B_TDM_A", 1);
        await FinestraAsync(p.Db, p.Agenzia.Id, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddDays(1));
        using (var ctx = Contesto(p.Db))
            await new ServizioTimone(ctx).PianoAsync(p.Marketing, vol);

        // il Marketing ha spostato la referenza: il segno sta sulla voce e sul piano
        long idPiano;
        using (var ctx = Contesto(p.Db))
        {
            var piano = await ctx.Timoni.SingleAsync(t => t.IdVol == vol);
            idPiano = piano.Id;
            piano.Revisione = 3;
            var voce = await ctx.TimoneVoci.SingleAsync(v => v.IdTimone == piano.Id);
            voce.Posizione = 5;
            voce.DataModifica = DateTime.UtcNow;
            await ctx.SaveChangesAsync();
        }

        using (var ctx = Contesto(p.Db))
        {
            var servizio = new ServizioTimone(ctx);
            Assert.True((await servizio.SalvaFinestraAsync(p.Agenzia, Promo, null, DateTime.UtcNow.AddDays(2))).Ok);
            Assert.True(Esiste(await servizio.PianoAsync(p.Marketing, vol)));
        }

        var piani = await PianiAsync(p.Db, vol);
        Assert.Single(piani);
        Assert.Equal(idPiano, piani[0].Id);
        Assert.Equal(3, piani[0].Revisione);
        using (var ctx = Contesto(p.Db))
            Assert.Equal((short)5, (await ctx.TimoneVoci.SingleAsync(v => v.IdTimone == idPiano)).Posizione);
    }
}
