using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1086: la configurazione di Coop del repo allineata a quella di produzione.
///
/// In locale due ref uscivano con un box diverso da produzione: una linea forzata dal cambio
/// strutturale (is_linea "xForced") restava BOX_STD, e un tema "PIU VALORE SOCI" non prendeva il
/// doppio sconto. Le regole delle etichette di produzione erano state cambiate sul server e non
/// erano mai arrivate in git. Qui si fissa la catena vera - etichette di SourceEtichetteRef, poi
/// box di SourceFrameworkCss - sui file di Coop del repo, e le voci del plugin agenzia portate da
/// produzione. Cosa e' stato tolto dal framework CSS sta in
/// sorgenti/documentazione/14-coop-allineamento-produzione.md.
/// </summary>
public class ConfigurazioneCoopProduzioneTests
{
    private const string CartellaCoop = "Istanta/wwwroot/external_source/Coopfi/";

    private static string FileCoop(string nome) => DllAgenziaLibTests.TrovaFile(CartellaCoop + nome);

    private sealed class FabbricaSenzaConnessione<T> : IDbContextFactory<T> where T : DbContext
    {
        private readonly Func<T> _crea;
        public FabbricaSenzaConnessione(Func<T> crea) => _crea = crea;
        public T CreateDbContext() => _crea();
    }

    /// Il controller vero, come in SceltaDiBenessereEdro21Tests, con l'external source di Coop del
    /// repo: e' da li' che l'etichettatura legge SourceEtichetteRef.json.
    private static MenaboController Controller()
    {
        string cartella = Path.GetDirectoryName(FileCoop("SourceEtichetteRef.json"))! + Path.DirectorySeparatorChar;
        return new MenaboController(
            null,
            new ConfigurationBuilder().Build(),
            Options.Create(new PathExternal { pathSource = cartella, pathLib = cartella }),
            null,
            null,
            null,
            null,
            Options.Create(new FicoConfig()),
            new FabbricaSenzaConnessione<edro21_dbContext>(() => new edro21_dbContext(
                new DbContextOptionsBuilder<edro21_dbContext>().UseNpgsql("Host=localhost;Database=nessuno").Options)),
            new FabbricaSenzaConnessione<Edro21_DbContext2>(() => new Edro21_DbContext2(
                new DbContextOptionsBuilder<Edro21_DbContext2>().UseNpgsql("Host=localhost;Database=nessuno").Options)));
    }

    private static ArticoloInRevisione Ref(string tema = "", string isLinea = "", string tipoEvento = "DEPLIANT", string meccanica = "SCONTO % ARTICOLO")
    {
        return new ArticoloInRevisione
        {
            recordInTracciato = new Dictionary<string, object>
            {
                ["Referenza.Codice"] = "1121207",
                ["combinazioneAssegnata"] = "",
                ["tema"] = tema,
                ["is_linea"] = isLinea,
                ["tipo_evento"] = tipoEvento,
                ["meccanica"] = meccanica
            }
        };
    }

    /// Le etichette della ref, come le da' SourceEtichetteRef.json di Coop.
    private static List<string> Etichette(ArticoloInRevisione item)
    {
        return Controller().Etichettatura(item).allEtichette ?? new List<string>();
    }

    /// Il box della ref: prima le etichette, poi SourceFrameworkCss.json di Coop, come nel processo del kit.
    private static string CodiceBox(ArticoloInRevisione item)
    {
        // Si rilegge a ogni chiamata: la valutazione riscrive i Value delle regole.
        var frameDB = JObject.Parse(File.ReadAllText(FileCoop("SourceFrameworkCss.json"))).ToObject<DbFrameworkCss>();
        var controller = Controller();
        return controller.IdentificaCodiceBox(controller.Etichettatura(item), frameDB);
    }

    /* ---- la linea ---- */

    [Fact]
    public void La_linea_forzata_dal_cambio_strutturale_esce_BOX_LINEA()
    {
        Assert.Contains("IS_LINEA", Etichette(Ref(isLinea: "xForced")));
        Assert.Equal("BOX_LINEA", CodiceBox(Ref(tema: "CONV.A TAVOLA+ATTRAZ.EXTRA (OS20B) 42UFI+17TDM+A", isLinea: "xForced")));
    }

    [Theory]
    [InlineData("x", "BOX_LINEA")]
    [InlineData("X", "BOX_LINEA")]
    [InlineData("", "BOX_STD")]
    [InlineData("xForcedNo", "BOX_STD")]
    public void La_linea_dal_tracciato_resta_com_era(string isLinea, string box)
    {
        Assert.Equal(box, CodiceBox(Ref(isLinea: isLinea)));
    }

    /* ---- il doppio sconto ---- */

    [Theory]
    [InlineData("PIU VALORE SOCI (OS20B) 42UFI+17TDM+A")]
    [InlineData("PIU VALORE CLIENTI (OS21A)")]
    // Il tema che imposta il cambio strutturale 12 "Cambia meccanica in DoppioSconto".
    [InlineData("NEW SOCI")]
    public void I_temi_del_doppio_sconto_escono_BOX_doppio_SCONTO(string tema)
    {
        Assert.Contains("DOPPIOSCONTO", Etichette(Ref(tema)));
        Assert.Equal("BOX_doppio_SCONTO", CodiceBox(Ref(tema)));
    }

    [Fact]
    public void Un_tema_NEW_CLIENTI_non_e_piu_doppio_sconto()
    {
        // Lo era solo nel repo: produzione non l'ha mai avuto.
        Assert.DoesNotContain("DOPPIOSCONTO", Etichette(Ref("NEW CLIENTI")));
    }

    /* ---- esclusiva soci e jolly evidenziato ---- */

    [Theory]
    [InlineData("PROMO SOCI ESCL 12")]
    [InlineData("SOCI ESCLUSIVA")]
    public void I_temi_dell_esclusiva_soci_escono_BOX_ESCLUSIVA_SOCI(string tema)
    {
        Assert.Contains("ESCLUSIVA_SOCI", Etichette(Ref(tema)));
        Assert.Equal("BOX_ESCLUSIVA_SOCI", CodiceBox(Ref(tema)));
    }

    [Fact]
    public void Il_jolly_evidenziato_prende_anche_il_tema_troncato()
    {
        Assert.Contains("JOLLY_EVIDENZA", Etichette(Ref("VENDITE PROPOSIT (OS20B)")));
        Assert.Contains("JOLLY_EVIDENZA", Etichette(Ref("VENDITE PROPOSITIVE")));
        Assert.Equal("BOX_JOLLY_EVIDENZIATO", CodiceBox(Ref("VENDITE PROPOSIT (OS20B)")));
    }

    [Fact]
    public void Una_ref_senza_niente_di_speciale_resta_BOX_STD()
    {
        Assert.Empty(Etichette(Ref("CONV.A TAVOLA+ATTRAZ.EXTRA (OS20B) 42UFI+17TDM+A")));
        Assert.Equal("BOX_STD", CodiceBox(Ref("CONV.A TAVOLA+ATTRAZ.EXTRA (OS20B) 42UFI+17TDM+A")));
    }

    /* ---- il plugin agenzia ---- */

    private static JObject Plugin() => JObject.Parse(File.ReadAllText(FileCoop("SourceCustomPlugin.json")));

    [Fact]
    public void Il_plugin_agenzia_ha_le_voci_di_produzione()
    {
        var plugin = Plugin();

        Assert.Equal(
            new[] { "tema", "format_1", "format_2", "reparto", "tipo_evento", "prezzo_promo", "prezzo_promo_kgl", "prezzo_continuo", "txt_sconto", "prestazione" },
            plugin["infoRapide"]!.Select(i => (string)i["keyInRecordInTracciato"]!).ToArray());
        Assert.Equal(new[] { 1, 0 }, plugin["policyImpaginazioneMechanism"]!.Select(p => (int)p["tipo_utente"]!).ToArray());
        Assert.Equal(new[] { "tema" }, plugin["listaCampiEditabiliPrioritari"]!.Select(c => (string)c!).ToArray());
        Assert.Equal(
            new[] { "prezzo_promo", "Descrizioni.Peso" },
            plugin["campiExtraEditPrimarieSecondarie"]!.Select(c => (string)c["keyInRecordInTracciato"]!).ToArray());

        // PIU_PREZZI_PROMO non si da' ai box che hanno gia' i loro prezzi.
        var piuPrezzi = plugin["etichetteCommands"]!.First(c => c["etichette"]!.Any(e => (string)e! == "PIU_PREZZI_PROMO"));
        var regole = piuPrezzi["regole"]![0]!["Regole"]!;
        Assert.Equal(
            new[] { "allEtichette:2:PIU_PREZZI_PROMO", "codiceBox:1:BOX_doppio_SCONTO_LINEA", "codiceBox:1:BOX_JOLLY", "codiceBox:1:BOX_SPRINT" },
            regole.Select(r => $"{r["Campo"]}:{r["Operatore"]}:{r["Value"]}").ToArray());
    }

    [Fact]
    public void La_linea_con_le_bruciature_ha_il_suo_schema_prima_di_quella_senza()
    {
        var schemi = Plugin()["schemiDescrizioni"]!.Select(s => string.Join(",", s["schema"]!.Select(x => (string)x!))).ToList();
        const string linea = "START$DESCRIZIONE_LINEA,START$DESCRIZIONE_TITOLO_LINEA,START$DESCRIZIONE_BRAND_LINEA,START$DESCRIZIONE_GRAMMATURA_LINEA,START$DESCRIZIONE_TIPO_LINEA";

        int conBruciature = schemi.IndexOf(linea + ",START$MAX_PEZZI");
        int senza = schemi.IndexOf(linea);
        Assert.True(conBruciature >= 0 && senza >= 0 && conBruciature < senza, string.Join(" | ", schemi));
    }

    [Fact]
    public void Le_aggiunte_locali_del_plugin_agenzia_restano()
    {
        var plugin = Plugin();

        Assert.True((bool)plugin["chiediAmbitoDecisioniLavorazione"]!);
        Assert.NotNull(plugin["disattivazioneRefRules"]);
        Assert.Contains(plugin["schemiDescrizioni"]!, s => s["schema"]!.Any(x => (string)x! == "START$DESCRIZIONE_PREZZO_LINEAP"));
    }

    /* ---- il framework CSS: la copia di produzione ---- */

    private static JArray Kit() => (JArray)JObject.Parse(File.ReadAllText(FileCoop("SourceFrameworkCss.json")))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!;

    private static JToken KitPerAree(int tipoLavorazione, params string[] aree) => Kit().First(k =>
        k["kit"]!["kitTipoLavorazioniValide"]!.Select(t => (int)t!).SequenceEqual(new[] { tipoLavorazione })
        && k["kit"]!["areeValide"]!.Select(a => (string)a!).SequenceEqual(aree));

    private static JToken Box(JToken kit, params string[] nomiBox) =>
        kit["operazioniPerBox"]!.First(o => o["nomiBox"]!.Select(n => (string)n!).SequenceEqual(nomiBox));

    [Fact]
    public void Nel_volantino_ogni_logo_ha_la_sua_misura_e_i_loghi_si_allineano_per_ultimi()
    {
        var tuttiIBox = Box(KitPerAree(1), Array.Empty<string>());
        var misure = tuttiIBox["postRidimensionamenti"]!.Select(p => (string)p["nomeGruppo"]!).ToList();

        Assert.Equal(40, misure.Count(n => n.StartsWith("loghi_")));
        Assert.Equal(13, tuttiIBox["postRidimensionamenti"]!.First(p => (string)p["nomeGruppo"]! == "loghi")["gruppoEtichette"]!.Count());

        var loghi = tuttiIBox["allineamenti"]!.First(a => (string)a["nomeGruppo"]! == "Loghi");
        Assert.Equal(9999999, (int)loghi["ordine"]!);
        Assert.Equal(4.8, (double)loghi["spacingLivelli"]!);
    }

    [Fact]
    public void Nel_doppio_sconto_di_B_la_descrizione_segue_i_prezzi()
    {
        var doppio = Box(KitPerAree(1, "B", "B1"), "BOX_doppio_SCONTO", "BOX_doppio_SCONTO_LINEA");
        var gruppi = doppio["allineamenti"]!.Select(a => (string)a["nomeGruppo"]!).ToList();

        Assert.DoesNotContain("ScontiSoci", gruppi);
        Assert.DoesNotContain("fix_SOCI_DOPPIA", gruppi);
        var campi = doppio["allineamenti"]!.First(a => (string)a["nomeGruppo"]! == "Campi_Principali");
        Assert.Equal("PrezziSoci", (string)campi["followAnchor"]![0]!["nomiGruppiSeguiti"]![0]!);
    }

    [Fact]
    public void B_e_B1_non_hanno_un_loro_blocco_di_loghi()
    {
        var tuttiIBox = Box(KitPerAree(1, "B", "B1"), Array.Empty<string>());

        Assert.Empty(tuttiIBox["postRidimensionamenti"]!);
        Assert.DoesNotContain(tuttiIBox["allineamenti"]!, a => (string)a["nomeGruppo"]! == "Loghi");
    }
}
