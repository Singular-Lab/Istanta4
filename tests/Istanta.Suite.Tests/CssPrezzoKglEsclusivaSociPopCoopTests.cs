using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop A3 verticale, nel box BOX_ESCLUSIVA_SOCI, il prezzo al kg sta sulla riga del prezzo:
/// la pila Campi_PrincipaliEsclusivaSoci lo impilava fra prezzo_continuo e gruppo_prezzo2, e il prezzo
/// saliva della sua altezza. In A3 verticale il suo livello non vale, e due gruppi con condizioni opposte
/// lo agganciano 5,2 mm a destra del testo di prezzo_info_pack_SOCI_DOPPIA, o di prezzo_promo quando
/// l'info pack manca, con il fondo allineato al campo seguito. Gli altri formati e il volantino non cambiano.
/// </summary>
public class CssPrezzoKglEsclusivaSociPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";
    private const string InfoPack = "prezzo_info_pack_SOCI_DOPPIA";

    private static JArray Kit() =>
        (JArray)JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!;

    private static IEnumerable<JObject> Operazioni(int tipoLavorazione) =>
        Kit().Cast<JObject>()
            .Where(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { tipoLavorazione }) && !k["kit"]!["kitFormatiValidi"]!.Any())
            .SelectMany(k => k["operazioniPerBox"]!.Cast<JObject>());

    private static List<JObject> AllineamentiEsclusivaSoci() =>
        Operazioni(2).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" }))["allineamenti"]!
            .Cast<JObject>().ToList();

    private static JObject Gruppo(string nome) => AllineamentiEsclusivaSoci().Single(a => (string?)a["nomeGruppo"] == nome);

    private static JObject Condizione(JToken listSetCondizioni) => (JObject)listSetCondizioni.Single()["setCondizioni"]!.Single();

    private static string[] Formati(JObject condizione) => condizione["kitCondition"]!.Single()["kitFormatiValidi"]!.Values<string>().ToArray()!;

    [Fact]
    public void In_A3_verticale_il_prezzo_al_kg_non_e_piu_una_riga_della_pila()
    {
        var livelli = Gruppo("Campi_PrincipaliEsclusivaSoci")["ordinamentoLivelli"]!.Cast<JObject>().ToList();
        var kgl = livelli.Single(l => l["elementi"]!.Values<string>().SequenceEqual(new[] { "prezzo_promo_kgl" }));

        Assert.Equal(new[] { "A3_ORIZZONTALI", "A7" }, Formati(Condizione(kgl["listSetCondizioni"]!)));
        //Gli altri livelli valgono in ogni formato: in A3 verticale gruppo_prezzo2 segue prezzo_continuo.
        Assert.All(livelli.Where(l => l != kgl), l => Assert.Equal(JTokenType.Null, l["listSetCondizioni"]!.Type));
    }

    [Theory]
    [InlineData("prezzo_promo_kgl_su_info_pack_SOCI_DOPPIA", InfoPack)]
    [InlineData("prezzo_promo_kgl_su_prezzo_promo", "prezzo_promo")]
    public void In_A3_verticale_il_prezzo_al_kg_segue_il_campo_a_5_2_mm_con_il_fondo_allineato(string nome, string seguito)
    {
        var gruppo = Gruppo(nome);

        Assert.Equal(new[] { "prezzo_promo_kgl" }, gruppo["ordinamentoLivelli"]!.Single()["elementi"]!.Values<string>());
        var ancora = gruppo["followAnchor"]!.Single();
        Assert.Equal(new[] { seguito }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        Assert.True((bool)ancora["useTextBounds"]!);
        //HorizontalReferenceLine: 0 sinistra, 1 destra. Distanza negativa: a destra del campo seguito.
        Assert.Equal(1, (int)ancora["xAnchor"]!["allineaAlLato"]!);
        Assert.Equal(0, (int)ancora["xAnchor"]!["allineaLato"]!);
        Assert.Equal(-5.2m, (decimal)ancora["xAnchor"]!["distance"]!);
        //VerticalReferenceLine: 0 alto, 1 basso.
        Assert.Equal(1, (int)ancora["yAnchor"]!["allineaAlLato"]!);
        Assert.Equal(1, (int)ancora["yAnchor"]!["allineaLato"]!);
        Assert.Equal(0m, (decimal)ancora["yAnchor"]!["distance"]!);
        Assert.Equal(new[] { "A3_VERTICALI" }, Formati(Condizione(gruppo["listSetCondizioni"]!)));
    }

    [Fact]
    public void Si_segue_l_info_pack_se_c_e_e_il_prezzo_se_manca()
    {
        var conInfoPack = Condizione(Gruppo("prezzo_promo_kgl_su_info_pack_SOCI_DOPPIA")["listSetCondizioni"]!);
        var senzaInfoPack = Condizione(Gruppo("prezzo_promo_kgl_su_prezzo_promo")["listSetCondizioni"]!);

        Assert.Equal(new[] { InfoPack }, conInfoPack["elementiDaTrovare"]!.Values<string>());
        Assert.Empty(conInfoPack["elementiDaNonTrovare"]!);
        Assert.Equal(new[] { InfoPack }, senzaInfoPack["elementiDaNonTrovare"]!.Values<string>());
        Assert.Empty(senzaInfoPack["elementiDaTrovare"]!);
    }

    [Fact]
    public void Il_prezzo_al_kg_si_aggancia_dopo_la_pila()
    {
        var pila = (int)Gruppo("Campi_PrincipaliEsclusivaSoci")["ordine"]!;

        Assert.True((int)Gruppo("prezzo_promo_kgl_su_info_pack_SOCI_DOPPIA")["ordine"]! > pila);
        Assert.True((int)Gruppo("prezzo_promo_kgl_su_prezzo_promo")["ordine"]! > pila);
    }

    [Fact]
    public void Il_volantino_non_ha_queste_regole()
    {
        var nomi = Operazioni(1).SelectMany(o => (o["allineamenti"] as JArray)?.Cast<JObject>() ?? Enumerable.Empty<JObject>())
            .Select(a => (string?)a["nomeGruppo"]).ToList();

        Assert.DoesNotContain("prezzo_promo_kgl_su_info_pack_SOCI_DOPPIA", nomi);
        Assert.DoesNotContain("prezzo_promo_kgl_su_prezzo_promo", nomi);
    }
}
