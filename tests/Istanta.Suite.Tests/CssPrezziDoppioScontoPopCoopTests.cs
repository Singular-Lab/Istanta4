using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop, nel box BOX_doppio_SCONTO, il bordo sinistro di prezzo_continuo segue quello di
/// prezzo_promo; quelli di prezzo_promo_kgl_SOCI_DOPPIA e prezzo_continuo_SOCI_DOPPIA seguono quello di
/// prezzo_promo_SOCI_DOPPIA. Solo in orizzontale, sul bordo del testo: l'altezza resta quella del
/// modello. I gruppi girano dopo DistanzaInfoePromo, che continua a piazzare gruppo_prezzo2. Il volantino
/// non cambia.
/// </summary>
public class CssPrezziDoppioScontoPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";

    private static readonly string[] NomiNuovi =
    {
        "prezzo_continuo_su_prezzo_promo",
        "prezzo_promo_kgl_SOCI_DOPPIA_su_prezzo_promo_SOCI_DOPPIA",
        "prezzo_continuo_SOCI_DOPPIA_su_prezzo_promo_SOCI_DOPPIA"
    };

    private static JArray Kit() =>
        (JArray)JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!;

    private static IEnumerable<JObject> Operazioni(int tipoLavorazione) =>
        Kit().Cast<JObject>()
            .Where(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { tipoLavorazione }))
            .SelectMany(k => k["operazioniPerBox"]!.Cast<JObject>());

    private static List<JObject> AllineamentiDoppioSconto() =>
        Operazioni(2).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_doppio_SCONTO" }))["allineamenti"]!
            .Cast<JObject>().ToList();

    private static JObject Gruppo(string nome) => AllineamentiDoppioSconto().Single(a => (string?)a["nomeGruppo"] == nome);

    [Theory]
    [InlineData("prezzo_continuo_su_prezzo_promo", "prezzo_continuo", "prezzo_promo")]
    [InlineData("prezzo_promo_kgl_SOCI_DOPPIA_su_prezzo_promo_SOCI_DOPPIA", "prezzo_promo_kgl_SOCI_DOPPIA", "prezzo_promo_SOCI_DOPPIA")]
    [InlineData("prezzo_continuo_SOCI_DOPPIA_su_prezzo_promo_SOCI_DOPPIA", "prezzo_continuo_SOCI_DOPPIA", "prezzo_promo_SOCI_DOPPIA")]
    public void Nel_PoP_il_bordo_sinistro_segue_quello_del_prezzo_solo_in_orizzontale(string nome, string elemento, string seguito)
    {
        var gruppo = Gruppo(nome);

        Assert.Equal(new[] { elemento }, gruppo["gruppoEtichette"]!.Values<string>());
        Assert.Equal(new[] { elemento }, gruppo["ordinamentoLivelli"]!.Single()["elementi"]!.Values<string>());
        var ancora = gruppo["followAnchor"]!.Single();
        Assert.Equal(new[] { seguito }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        //HorizontalReferenceLine: 0 sinistra, 1 destra, 2 centro.
        Assert.Equal(0, (int)ancora["xAnchor"]!["allineaAlLato"]!);
        Assert.Equal(0, (int)ancora["xAnchor"]!["allineaLato"]!);
        Assert.Equal(0m, (decimal)ancora["xAnchor"]!["distance"]!);
        Assert.False((bool)ancora["xAnchor"]!["stopOnCollision"]!);
        Assert.Equal(JTokenType.Null, ancora["yAnchor"]!.Type);
        Assert.True((bool)ancora["useTextBounds"]!);
        Assert.Empty(gruppo["staticAnchor"]!);
        Assert.Equal(JTokenType.Null, gruppo["listSetCondizioni"]!.Type);
    }

    [Fact]
    public void I_bordi_sinistri_si_allineano_dopo_DistanzaInfoePromo()
    {
        var allineamenti = AllineamentiDoppioSconto();
        var distanza = allineamenti.Single(a => (string?)a["nomeGruppo"] == "DistanzaInfoePromo");

        //DistanzaInfoePromo resta com'era: piazza ancora gruppo_prezzo2 e i due campi soci.
        Assert.Equal(new[] { "gruppo_prezzo2", "prezzo_promo_kgl_SOCI_DOPPIA", "prezzo_continuo_SOCI_DOPPIA" }, distanza["gruppoEtichette"]!.Values<string>());
        foreach (var nome in NomiNuovi)
        {
            Assert.True((int)Gruppo(nome)["ordine"]! > (int)distanza["ordine"]!, nome);
        }
    }

    [Fact]
    public void Il_volantino_non_ha_queste_regole()
    {
        var nomi = Operazioni(1).SelectMany(o => (o["allineamenti"] as JArray)?.Cast<JObject>() ?? Enumerable.Empty<JObject>())
            .Select(a => (string?)a["nomeGruppo"]).ToList();

        foreach (var nome in NomiNuovi)
        {
            Assert.DoesNotContain(nome, nomi);
        }
    }
}
