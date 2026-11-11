using Istanta.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-9bf94d47: la configurazione del fix foto viaggia nel SourceFrameworkCss, nella sezione
/// fixFoto generale (con le scelte per box in perBox) e nelle voci dei kit. Il modello non deve
/// perderla: il Plugin la riceve da scaricaAllineamenti, che serializza il modello, e l'editor la
/// salva passando dal modello.
/// </summary>
public class FixFotoTests
{
    [Fact]
    public void Una_voce_senza_fix_foto_lo_legge_assente()
    {
        var box = JsonConvert.DeserializeObject<modificheCssBox>("{\"nomiBox\":[\"BOX1\"]}");
        var radice = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>("{\"modificheCssPerKit\":[]}");

        Assert.Null(box!.fixFoto);
        Assert.Null(radice!.fixFoto);
    }

    [Fact]
    public void La_sezione_generale_si_legge_con_perBox_distanziamento_e_dati_dell_agenzia()
    {
        const string json = "{\"modificheCssPerKit\":[],\"fixFoto\":{\"lavorazioni\":[1,2],"
            + "\"distanziamento\":[{\"foto\":2,\"percDistFoto\":[{\"percDistanceXFoto\":[0.5],\"percDistanceYFoto\":[-0.25],"
            + "\"startRangeRatioCondition\":0,\"endRangeRatioCondition\":null}]}],"
            + "\"eccezioniIgnorati\":[\"*LOGO_filiera*\"],\"marginiFoto\":[1,1],"
            + "\"agenzia\":{\"descrizioneAllineataA\":[\"prezzo_offerta\"]},"
            + "\"perBox\":[{\"nomiBox\":[\"BOX40\"],\"modo\":\"nessuno\"},"
            + "{\"nomiBox\":[\"BOX7\"],\"agenzia\":{\"gruppoDescrizione\":\"gruppo_descrizione_BIS\",\"spostaDescrizioneSenzaGruppo\":false}}]}}";

        var fix = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(json)!.fixFoto!;

        Assert.Equal(new List<int> { 1, 2 }, fix.lavorazioni);
        Assert.Null(fix.modo);
        var intervallo = fix.distanziamento!.Single().percDistFoto.Single();
        Assert.Equal(0.5, intervallo.percDistanceXFoto.Single());
        Assert.Null(intervallo.endRangeRatioCondition);
        Assert.Equal("*LOGO_filiera*", fix.eccezioniIgnorati!.Single());
        Assert.Equal(new List<double> { 1, 1 }, fix.marginiFoto);
        Assert.Equal("prezzo_offerta", fix.agenzia!["descrizioneAllineataA"]![0]!.Value<string>());
        Assert.Equal("nessuno", fix.perBox!.Single(p => p.nomiBox.Contains("BOX40")).modo);
        Assert.False(fix.perBox!.Single(p => p.nomiBox.Contains("BOX7")).agenzia!["spostaDescrizioneSenzaGruppo"]!.Value<bool>());
    }

    [Fact]
    public void Un_salvataggio_non_perde_la_configurazione_ne_i_dati_dell_agenzia()
    {
        var originale = new DbRidimensionamentiAllineamenti
        {
            fixFoto = new FixFotoGeneraleObj
            {
                marginiBox = new List<double> { 0, 0, 0, 0 },
                marginiElementi = new List<MargineElementoFixFotoObj> { new() { label = "descrizione", padding = new List<double> { 1, 2, 3, 4 } } },
                agenzia = JObject.Parse("{\"elementiSottoDescrizione\":[\"PIEDE_Titolari*\"]}"),
                perBox = new List<FixFotoPerBoxObj> { new() { nomiBox = new List<string> { "BOX14", "BOX41" }, modo = "semplice" } }
            }
        };
        originale.modificheCssPerKit.Add(new dbModifiche
        {
            operazioniPerBox = new List<modificheCssBox> { new() { nomiBox = new List<string>(), fixFoto = new FixFotoObj { lavorazioni = new List<int> { 1 } } } }
        });

        var riletto = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(JsonConvert.SerializeObject(originale))!;

        Assert.Equal(new List<double> { 0, 0, 0, 0 }, riletto.fixFoto!.marginiBox);
        Assert.Equal(new List<double> { 1, 2, 3, 4 }, riletto.fixFoto.marginiElementi!.Single().padding);
        Assert.Equal("PIEDE_Titolari*", riletto.fixFoto.agenzia!["elementiSottoDescrizione"]![0]!.Value<string>());
        Assert.Equal("semplice", riletto.fixFoto.perBox!.Single().modo);
        Assert.Equal(new List<int> { 1 }, riletto.modificheCssPerKit.Single().operazioniPerBox.Single().fixFoto!.lavorazioni);
    }

    /// <summary>
    /// I dati che stavano nel custom.js di Edro21 arrivano al Plugin come li scrive il file.
    /// </summary>
    [Fact]
    public void Il_CssFramework_di_Edro21_porta_i_dati_del_fix_foto_dal_modello_al_Plugin()
    {
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaSorgente("Edro21")))!;

        //Come lo serve scaricaAllineamenti: il modello serializzato.
        var servito = JObject.Parse(JsonConvert.SerializeObject(root.dbRidimensionamentiAllineamenti));
        var fix = servito["fixFoto"]!;

        Assert.Contains("*LOGO_filiera*", fix["eccezioniIgnorati"]!.Values<string>());
        Assert.Equal(new[] { 1.0, 1.0 }, fix["marginiFoto"]!.Values<double>());
        Assert.Equal("LBL_Titolari", fix["agenzia"]!["descrizioneAllineataA"]!.Values<string>().Last());
        Assert.Equal(JTokenType.Null, fix["distanziamento"]!.Last!["percDistFoto"]!.Last!["endRangeRatioCondition"]!.Type);
        var perBox = fix["perBox"]!.Children().ToList();
        Assert.Equal("nessuno", perBox.Single(p => p["nomiBox"]!.Values<string>().Contains("BOX40"))["modo"]!.Value<string>());
        Assert.Equal("semplice", perBox.Single(p => p["nomiBox"]!.Values<string>().Contains("BOX41"))["modo"]!.Value<string>());
    }

    [Theory]
    [InlineData("Coopfi")]
    [InlineData("Famila")]
    public void Coop_e_Famila_fanno_il_fix_in_volantino_e_PoP(string cliente)
    {
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaSorgente(cliente)))!;

        var fix = root.dbRidimensionamentiAllineamenti.fixFoto!;

        Assert.Equal(new List<int> { 1, 2 }, fix.lavorazioni);
        Assert.Equal(new List<string> { "sconto", "txt_sconto", "sconto_base", "sfondo" }, fix.elementiIgnorati);
        Assert.Equal(3, fix.distanziamento!.Count);
    }

    /// <summary>
    /// TASK-99de57d1: le regole condizionali del fix foto, il modo a tutto box e i fit 4 e 5 arrivano
    /// al Plugin come li scrive il file.
    /// </summary>
    [Fact]
    public void Le_regole_condizionali_e_l_adattamento_dell_immagine_non_si_perdono()
    {
        const string json = "{\"modificheCssPerKit\":[],\"fixFoto\":{\"perBox\":[{\"nomiBox\":[\"BOX_STD\"],"
            + "\"condizionali\":[{\"quando\":{\"etichette\":[\"FRESCHISSIMI\"],\"lavorazioni\":[1],"
            + "\"campi\":[{\"campo\":\"codice_settore\",\"contiene\":\"58\"}]},"
            + "\"modo\":\"aTuttoBox\",\"adattamentoImmagine\":\"larghezza\"}]}]}}";

        var letto = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(json)!;
        var riletto = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(JsonConvert.SerializeObject(letto))!;

        var regola = riletto.fixFoto!.perBox!.Single().condizionali!.Single();
        Assert.Equal(new List<string> { "FRESCHISSIMI" }, regola.quando.etichette);
        Assert.Equal(new List<int> { 1 }, regola.quando.lavorazioni);
        Assert.Equal("58", regola.quando.campi!.Single().contiene);
        Assert.Equal("aTuttoBox", regola.modo);
        Assert.Equal("larghezza", regola.adattamentoImmagine);
    }

    [Fact]
    public void I_fit_4_e_5_sono_la_larghezza_e_l_altezza()
    {
        var fit = JsonConvert.DeserializeObject<FitClass>("{\"nomiElementi\":[\"immagine*\"],\"fit\":[4,5]}")!;

        Assert.Equal(new List<FitOperation> { FitOperation.FILL_WIDTH_CENTERED, FitOperation.FILL_HEIGHT_CENTERED }, fit.fit);
        Assert.Contains("[4,5]", JsonConvert.SerializeObject(fit));
    }

    [Fact]
    public void Coop_mette_a_tutto_box_il_BOX_STD_FRESCHISSIMI_del_volantino()
    {
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaSorgente("Coopfi")))!;

        var servito = JObject.Parse(JsonConvert.SerializeObject(root.dbRidimensionamentiAllineamenti));
        var regola = servito["fixFoto"]!["perBox"]!.Children()
            .Single(p => p["nomiBox"]!.Values<string>().Contains("BOX_STD"))["condizionali"]!.Single();

        Assert.Equal(new[] { "FRESCHISSIMI" }, regola["quando"]!["etichette"]!.Values<string>());
        Assert.Equal(new[] { 1 }, regola["quando"]!["lavorazioni"]!.Values<int>());
        Assert.Equal("aTuttoBox", regola["modo"]!.Value<string>());
        Assert.Equal("larghezza", regola["adattamentoImmagine"]!.Value<string>());
    }

    private static string TrovaSorgente(string cliente)
    {
        var relativo = $"Istanta/wwwroot/external_source/{cliente}/SourceFrameworkCss.json";

        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
