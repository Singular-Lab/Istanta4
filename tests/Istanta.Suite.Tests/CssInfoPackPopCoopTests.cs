using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop l'info pack (prezzo_info_pack, "a conf.") ha il bordo sinistro a 5,2 mm dal bordo
/// destro del testo di prezzo_promo. La regola seguiva prezzo_promo*, che prende anche
/// prezzo_promo_kgl, a 13 mm: l'info pack usciva dal box e il Plugin riportava dentro tutto
/// gruppo_prezzo, spostando a sinistra anche il prezzo. Il BOX_doppio_SCONTO e il volantino non cambiano.
/// </summary>
public class CssInfoPackPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";

    private static IEnumerable<JObject> Kit() =>
        ((JArray)JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!).Cast<JObject>();

    private static JObject Operazione(string? box)
    {
        var pop = Kit().Single(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { 2 }));
        return pop["operazioniPerBox"]!.Cast<JObject>()
            .Single(o => box == null ? !o["nomiBox"]!.Any() : o["nomiBox"]!.Values<string>().SequenceEqual(new[] { box }));
    }

    private static JToken Ancora(JObject operazione, string gruppo) =>
        operazione["allineamenti"]!.Cast<JObject>().Single(a => (string?)a["nomeGruppo"] == gruppo)["followAnchor"]!.Single();

    [Fact]
    public void Nel_PoP_l_info_pack_segue_il_solo_prezzo_promo_a_5_2_mm()
    {
        var ancora = Ancora(Operazione(null), "prezzo_info_pack_FIX");

        //prezzo_promo e non prezzo_promo*: il pattern con l'asterisco prende anche prezzo_promo_kgl.
        Assert.Equal(new[] { "prezzo_promo" }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        //HorizontalReferenceLine: 0 sinistra, 1 destra. Il bordo sinistro dell'info pack sul destro
        //del prezzo; la distanza negativa porta l'info pack oltre quel bordo.
        Assert.Equal(1, (int)ancora["xAnchor"]!["allineaAlLato"]!);
        Assert.Equal(0, (int)ancora["xAnchor"]!["allineaLato"]!);
        Assert.Equal(-5.2m, (decimal)ancora["xAnchor"]!["distance"]!);
        Assert.True((bool)ancora["useTextBounds"]!);
        Assert.Equal(JTokenType.Null, ancora["yAnchor"]!.Type);
    }

    [Fact]
    public void Il_doppio_sconto_tiene_la_sua_regola()
    {
        var ancora = Ancora(Operazione("BOX_doppio_SCONTO"), "prezzo_info_pack_FIX");

        Assert.Equal(new[] { "prezzo_promo" }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        Assert.Equal(-7.25m, (decimal)ancora["xAnchor"]!["distance"]!);
    }

    [Theory]
    [InlineData("B", -1.28)]
    [InlineData("A", -0.78)]
    public void Il_volantino_non_cambia(string area, double distanza)
    {
        var kit = Kit().Single(k => k["kit"]!["areeValide"]!.Values<string>().Contains(area));
        var ancora = Ancora(kit["operazioniPerBox"]!.Cast<JObject>().Single(o => !o["nomiBox"]!.Any()), "fix_alKg");

        Assert.Equal(new[] { "prezzo_promo*" }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        Assert.Equal((decimal)distanza, (decimal)ancora["xAnchor"]!["distance"]!);
    }
}
