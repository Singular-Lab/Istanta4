using System.IO.Compression;
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
/// I20-1186: un gruppo fatto nel timone (referenze di box diversi in una casella) si corregge dalla
/// «Modifica referenza» del timone. La correzione sta nel piano, sul capogruppo, parte col SALVA del
/// timone e arriva all'Agenzia: «da sistemare», report e timone.json.
///
/// Il piano ha una pagina senza griglia e quattro voci: 1078545 (box A, casella 1) e 6562233 (box B,
/// dietro) formano un gruppo del timone; 777-1 (casella 2) e 777-2 stanno nello stesso box C, cioe'
/// un gruppo nato da Istanta, che dall'Edit avanzato si corregge come sempre.
/// </summary>
public class TimoneGruppoModificaTests
{
    private const string Promo = "0524_26_B";

    private static Correggo4Context Contesto(string nomeDb) =>
        new(new DbContextOptionsBuilder<Correggo4Context>()
            .UseInMemoryDatabase(nomeDb)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private sealed record Prova(string Db, int IdVol, ServizioTimone.Chi Marketing, ServizioTimone.Chi Agenzia,
                                long Pagina, long Capo, long Compagno, long Istanta1, long Istanta2);

    private static async Task<Prova> ProvaAsync()
    {
        string db = "correggo4-timone-gruppo-" + Guid.NewGuid().ToString("N");
        using var ctx = Contesto(db);
        var marketing = new Utenti
        {
            Nome = "Marketing", Cognome = "Prova", Email = "marketing@prova.local", Username = "marketing-prova",
            Ruolo = Ruoli.CodiceGdo, TipoUtenteFico = ServizioTimone.TipoFicoMarketing, Attivo = true,
            DataInserimento = DateTime.UtcNow
        };
        var agenzia = new Utenti
        {
            Nome = "Agenzia", Cognome = "Prova", Email = "agenzia@prova.local", Username = "agenzia-prova",
            Ruolo = Ruoli.CodiceAgenzia, Attivo = true, DataInserimento = DateTime.UtcNow
        };
        ctx.Utentis.AddRange(marketing, agenzia);
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
            DataCreazione = DateTime.UtcNow, IdAutore = agenzia.Id
        };
        ctx.Timoni.Add(piano);
        await ctx.SaveChangesAsync();
        var tp = new VolantiniTimonePagine { IdTimone = piano.Id, Numero = 1, Ordine = 1, Attiva = true };
        ctx.TimonePagine.Add(tp);
        await ctx.SaveChangesAsync();
        VolantiniTimoneVoci Voce(VolantiniPagineElementi box, string codice, short? posizione, long gruppo) => new()
        {
            IdTimone = piano.Id, IdElemento = box.Id, Codice = codice, Basecode = codice, Etichetta = codice,
            IdPaginaTimone = tp.Id, Posizione = posizione, IdGruppo = gruppo, PaginaOrigine = 1,
            Stato = ServizioTimone.VoceInPagina
        };
        var capo = Voce(a, "1078545", 1, 1);
        var compagno = Voce(b, "6562233", null, 1);
        var istanta1 = Voce(c, "777-1", 2, 2);
        var istanta2 = Voce(c, "777-2", null, 2);
        ctx.TimoneVoci.AddRange(capo, compagno, istanta1, istanta2);
        ctx.TimoneFinestre.Add(new VolantiniTimoneFinestre
        {
            Classificazione = Promo, DataInizio = DateTime.UtcNow.AddHours(-1), DataFine = DateTime.UtcNow.AddDays(1),
            IdAutore = agenzia.Id, DataModifica = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();

        return new Prova(db, vol.Id,
            new ServizioTimone.Chi(marketing.Id, marketing.Ruolo, marketing.TipoUtenteFico, "Marketing Prova"),
            new ServizioTimone.Chi(agenzia.Id, agenzia.Ruolo, null, "Agenzia Prova"),
            tp.Id, capo.Id, compagno.Id, istanta1.Id, istanta2.Id);
    }

    private const string Modifica =
        "{\"offerta\":{\"campi\":[{\"field\":\"prezzo_promo\",\"valore\":\"2,29\"}]}," +
        "\"descrizione\":{\"testo\":\"<DESCRIZIONE_TITOLO>mele golden</DESCRIZIONE_TITOLO>\"," +
        "\"foto\":[{\"codice\":\"1078545\",\"guidId\":\"g-1\",\"stato\":1},{\"codice\":\"6562233\",\"guidId\":\"g-2\",\"stato\":2}]," +
        "\"loghi\":[{\"guidId\":\"l-1\",\"stato\":4,\"sigla\":\"BIO\"}]}}";

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    /// <summary>Le voci come le manda il browser: tutte, con la modifica dove indicato.</summary>
    private static List<ServizioTimone.VoceSalvata> Voci(Prova p, Dictionary<long, string?>? modifiche = null,
                                                          bool sciolto = false)
    {
        JsonElement M(long id) => modifiche != null && modifiche.TryGetValue(id, out var m)
            ? (m == null ? Json("null") : Json(m)) : default;
        return new()
        {
            new(p.Capo, p.Pagina, 1, ServizioTimone.VoceInPagina, sciolto ? null : 1, ModificaGruppo: M(p.Capo)),
            new(p.Compagno, p.Pagina, sciolto ? (short)3 : null, ServizioTimone.VoceInPagina, sciolto ? null : 1,
                ModificaGruppo: M(p.Compagno)),
            new(p.Istanta1, p.Pagina, 2, ServizioTimone.VoceInPagina, 2, ModificaGruppo: M(p.Istanta1)),
            new(p.Istanta2, p.Pagina, null, ServizioTimone.VoceInPagina, 2, ModificaGruppo: M(p.Istanta2))
        };
    }

    private static async Task<ServizioTimone.Esito> SalvaAsync(Prova p, List<ServizioTimone.VoceSalvata> voci)
    {
        using var ctx = Contesto(p.Db);
        int revisione = (await ctx.Timoni.AsNoTracking().FirstAsync(t => t.IdVol == p.IdVol)).Revisione;
        return await new ServizioTimone(ctx).SalvaAsync(p.Marketing, p.IdVol, revisione, null, voci);
    }

    private static async Task<Dictionary<long, VolantiniTimoneVoci>> VociAsync(Prova p)
    {
        using var ctx = Contesto(p.Db);
        return await ctx.TimoneVoci.AsNoTracking().ToDictionaryAsync(v => v.Id);
    }

    [Fact]
    public async Task La_modifica_del_gruppo_si_salva_sul_capogruppo_e_torna_nel_piano()
    {
        var p = await ProvaAsync();
        var e = await SalvaAsync(p, Voci(p, new() { [p.Capo] = Modifica }));
        Assert.True(e.Ok, e.Messaggio);

        var voci = await VociAsync(p);
        Assert.NotNull(voci[p.Capo].ModificaGruppo);
        Assert.Contains("\"prezzo_promo\"", voci[p.Capo].ModificaGruppo);
        Assert.Contains("mele golden", voci[p.Capo].ModificaGruppo);
        Assert.NotNull(voci[p.Capo].DataModifica);
        Assert.Null(voci[p.Compagno].ModificaGruppo);

        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(e.Dati));
        var capo = doc.RootElement.GetProperty("voci").EnumerateArray().First(v => v.GetProperty("id").GetInt64() == p.Capo);
        Assert.Equal("2,29", capo.GetProperty("modificaGruppo").GetProperty("offerta").GetProperty("campi")[0]
                                 .GetProperty("valore").GetString());
        Assert.Equal("BIO", capo.GetProperty("modificaGruppo").GetProperty("descrizione").GetProperty("loghi")[0]
                                .GetProperty("sigla").GetString());
    }

    [Fact]
    public async Task Arrivata_su_un_compagno_passa_a_chi_tiene_la_casella()
    {
        var p = await ProvaAsync();
        var e = await SalvaAsync(p, Voci(p, new() { [p.Compagno] = Modifica }));
        Assert.True(e.Ok, e.Messaggio);

        var voci = await VociAsync(p);
        Assert.NotNull(voci[p.Capo].ModificaGruppo);
        Assert.Null(voci[p.Compagno].ModificaGruppo);
    }

    [Fact]
    public async Task Su_un_gruppo_nato_da_Istanta_non_si_tiene()
    {
        var p = await ProvaAsync();
        var e = await SalvaAsync(p, Voci(p, new() { [p.Istanta1] = Modifica }));
        Assert.True(e.Ok, e.Messaggio);

        var voci = await VociAsync(p);
        Assert.Null(voci[p.Istanta1].ModificaGruppo);
        Assert.Null(voci[p.Istanta2].ModificaGruppo);
    }

    [Fact]
    public async Task Sciogliendo_il_gruppo_la_modifica_si_perde()
    {
        var p = await ProvaAsync();
        Assert.True((await SalvaAsync(p, Voci(p, new() { [p.Capo] = Modifica }))).Ok);

        var e = await SalvaAsync(p, Voci(p, sciolto: true));
        Assert.True(e.Ok, e.Messaggio);
        Assert.Null((await VociAsync(p))[p.Capo].ModificaGruppo);
    }

    [Fact]
    public async Task Un_browser_che_non_la_manda_non_la_cancella_e_null_la_toglie()
    {
        var p = await ProvaAsync();
        Assert.True((await SalvaAsync(p, Voci(p, new() { [p.Capo] = Modifica }))).Ok);

        Assert.True((await SalvaAsync(p, Voci(p))).Ok);
        Assert.NotNull((await VociAsync(p))[p.Capo].ModificaGruppo);

        Assert.True((await SalvaAsync(p, Voci(p, new() { [p.Capo] = null }))).Ok);
        Assert.Null((await VociAsync(p))[p.Capo].ModificaGruppo);
    }

    [Theory]
    [InlineData("testo")]
    [InlineData("loghi")]
    [InlineData("campi")]
    [InlineData("byte")]
    public async Task Oltre_i_limiti_il_timone_non_si_salva(string cosa)
    {
        var p = await ProvaAsync();
        string Logo(int i) => $"{{\"guidId\":\"l-{i}\",\"stato\":4}}";
        string Campo(int i) => $"{{\"field\":\"campo_{i}\",\"valore\":\"1\"}}";
        string modifica = cosa switch
        {
            "testo" => "{\"descrizione\":{\"testo\":\"" + new string('a', ServizioTimone.ModificaGruppoMaxTesto + 1) + "\"}}",
            "loghi" => "{\"descrizione\":{\"loghi\":[" +
                       string.Join(",", Enumerable.Range(1, ServizioTimone.ModificaGruppoMaxVoci + 1).Select(Logo)) + "]}}",
            "campi" => "{\"offerta\":{\"campi\":[" +
                       string.Join(",", Enumerable.Range(1, ServizioTimone.ModificaGruppoMaxVoci + 1).Select(Campo)) + "]}}",
            _ => "{\"descrizione\":{\"testo\":\"x\"},\"zavorra\":\"" + new string('z', ServizioTimone.ModificaGruppoMaxByte) + "\"}"
        };

        var e = await SalvaAsync(p, Voci(p, new() { [p.Capo] = modifica }));
        Assert.False(e.Ok);
        Assert.Equal("modifica_gruppo_troppo_grande", e.Codice);
        var voci = await VociAsync(p);
        Assert.Null(voci[p.Capo].ModificaGruppo);
        Assert.Null(voci[p.Capo].DataModifica);
    }

    [Fact]
    public async Task Nei_limiti_un_gruppo_di_dieci_con_tutto_cambiato_si_salva()
    {
        var p = await ProvaAsync();
        string foto = string.Join(",", Enumerable.Range(1, 10).Select(i =>
            $"{{\"codice\":\"cod-{i}\",\"guidId\":\"{Guid.NewGuid()}\",\"stato\":{(i == 1 ? 1 : 2)}}}"));
        string loghi = string.Join(",", Enumerable.Range(1, 10).Select(i =>
            $"{{\"guidId\":\"{Guid.NewGuid()}\",\"stato\":4,\"sigla\":\"L{i}\",\"nome\":\"Logo {i}\"}}"));
        string modifica = "{\"offerta\":{\"campi\":[{\"field\":\"prezzo_promo\",\"valore\":\"2,29\"}]}," +
                          "\"descrizione\":{\"testo\":\"<DESCRIZIONE_TITOLO>" + new string('m', 400) +
                          "</DESCRIZIONE_TITOLO>\",\"foto\":[" + foto + "],\"loghi\":[" + loghi + "]}}";

        var e = await SalvaAsync(p, Voci(p, new() { [p.Capo] = modifica }));
        Assert.True(e.Ok, e.Messaggio);
        Assert.True((await VociAsync(p))[p.Capo].ModificaGruppo!.Length < 5 * 1024);
    }

    [Fact]
    public async Task Chiusa_la_finestra_l_Agenzia_la_trova_da_sistemare_e_nel_pacchetto()
    {
        var p = await ProvaAsync();
        Assert.True((await SalvaAsync(p, Voci(p, new() { [p.Capo] = Modifica }))).Ok);
        using (var ctx = Contesto(p.Db))
        {
            var f = await ctx.TimoneFinestre.FirstAsync();
            f.DataInizio = DateTime.UtcNow.AddDays(-3);
            f.DataFine = DateTime.UtcNow.AddHours(-1);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = Contesto(p.Db);
        var servizio = new ServizioTimone(ctx2);
        Assert.Contains(p.IdVol, await servizio.VolantiniDaSistemareAsync(p.Agenzia));

        var (errore, pacchetto) = await servizio.EsportaAsync(p.Agenzia, p.IdVol);
        Assert.Null(errore);
        using var zip = new ZipArchive(new MemoryStream(pacchetto!.Contenuto));
        var voce = zip.Entries.First(x => x.Name == "timone.json");
        using var lettore = new StreamReader(voce.Open());
        using var doc = JsonDocument.Parse(await lettore.ReadToEndAsync());
        var gruppo = doc.RootElement.GetProperty("gruppi").EnumerateArray()
            .First(g => g.GetProperty("codiceGruppo").GetString() == "1078545,6562233");
        Assert.Equal("2,29", gruppo.GetProperty("modifiche").GetProperty("offerta").GetProperty("campi")[0]
                                   .GetProperty("valore").GetString());
    }

    [Fact]
    public async Task I_box_bloccati_sono_quelli_dei_gruppi_del_timone()
    {
        var p = await ProvaAsync();
        using var ctx = Contesto(p.Db);
        var voci = await ctx.TimoneVoci.AsNoTracking().ToDictionaryAsync(v => v.Id);

        var box = await ServizioTimone.BoxNeiGruppiAsync(ctx, p.IdVol, 1);
        Assert.Equal(new[] { voci[p.Capo].IdElemento!.Value, voci[p.Compagno].IdElemento!.Value }.OrderBy(x => x),
                     box.OrderBy(x => x));
        Assert.Empty(await ServizioTimone.BoxNeiGruppiAsync(ctx, p.IdVol, 2));
    }
}
