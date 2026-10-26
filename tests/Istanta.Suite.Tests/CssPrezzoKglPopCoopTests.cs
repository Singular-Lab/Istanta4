using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop, nei box BOX_STD e BOX_1+1, il prezzo al kg (prezzo_promo_kgl) ha il bordo destro
/// allineato a quello di gruppo_prezzo se il box lo ha, altrimenti a quello di prezzo_promo; solo in
/// orizzontale, l'altezza resta quella del modello. Due gruppi di allineamento con condizioni opposte
/// su gruppo_prezzo, in un'operazione per quei due box. Il volantino non cambia.
/// </summary>
public class CssPrezzoKglPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";

    private static JArray Kit() =>
        (JArray)JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!;

    private static IEnumerable<JObject> Operazioni(int tipoLavorazione) =>
        Kit().Cast<JObject>()
            .Where(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { tipoLavorazione }) && !k["kit"]!["kitFormatiValidi"]!.Any())
            .SelectMany(k => k["operazioniPerBox"]!.Cast<JObject>());

    private static JObject Gruppo(string nome)
    {
        var operazione = Operazioni(2).Single(o => o["nomiBox"]!.Values<string>().OrderBy(n => n).SequenceEqual(new[] { "BOX_1+1", "BOX_STD" }));
        return operazione["allineamenti"]!.Cast<JObject>().Single(a => (string?)a["nomeGruppo"] == nome);
    }

    private static JObject Condizione(JObject gruppo) => (JObject)gruppo["listSetCondizioni"]!.Single()["setCondizioni"]!.Single();

    [Theory]
    [InlineData("prezzo_promo_kgl_su_gruppo_prezzo", "gruppo_prezzo")]
    [InlineData("prezzo_promo_kgl_su_prezzo_promo", "prezzo_promo")]
    public void Nel_PoP_il_prezzo_al_kg_si_allinea_a_destra_solo_in_orizzontale(string nome, string seguito)
    {
        var gruppo = Gruppo(nome);

        Assert.Equal(new[] { "prezzo_promo_kgl" }, gruppo["ordinamentoLivelli"]!.Single()["elementi"]!.Values<string>());
        var ancora = gruppo["followAnchor"]!.Single();
        Assert.Equal(new[] { seguito }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        //HorizontalReferenceLine: 0 sinistra, 1 destra, 2 centro.
        Assert.Equal(1, (int)ancora["xAnchor"]!["allineaAlLato"]!);
        Assert.Equal(1, (int)ancora["xAnchor"]!["allineaLato"]!);
        Assert.Equal(0m, (decimal)ancora["xAnchor"]!["distance"]!);
        Assert.Equal(JTokenType.Null, ancora["yAnchor"]!.Type);
        Assert.Empty(gruppo["staticAnchor"]!);
    }

    [Fact]
    public void Si_segue_gruppo_prezzo_se_c_e_e_prezzo_promo_se_non_c_e()
    {
        var conGruppo = Condizione(Gruppo("prezzo_promo_kgl_su_gruppo_prezzo"));
        var senzaGruppo = Condizione(Gruppo("prezzo_promo_kgl_su_prezzo_promo"));

        Assert.Equal(new[] { "gruppo_prezzo" }, conGruppo["elementiDaTrovare"]!.Values<string>());
        Assert.Empty(conGruppo["elementiDaNonTrovare"]!);
        Assert.Equal(new[] { "gruppo_prezzo" }, senzaGruppo["elementiDaNonTrovare"]!.Values<string>());
        Assert.Empty(senzaGruppo["elementiDaTrovare"]!);
    }

    [Fact]
    public void Il_prezzo_al_kg_si_allinea_dopo_i_prezzi()
    {
        //In coda ai gruppi che sistemano i prezzi (999999), cosi' segue posizioni gia' definitive.
        Assert.Equal(9999999, (int)Gruppo("prezzo_promo_kgl_su_gruppo_prezzo")["ordine"]!);
        Assert.Equal(9999999, (int)Gruppo("prezzo_promo_kgl_su_prezzo_promo")["ordine"]!);
    }

    [Fact]
    public void Il_volantino_non_ha_queste_regole()
    {
        var nomi = Operazioni(1).SelectMany(o => (o["allineamenti"] as JArray)?.Cast<JObject>() ?? Enumerable.Empty<JObject>())
            .Select(a => (string?)a["nomeGruppo"]);

        Assert.DoesNotContain("prezzo_promo_kgl_su_gruppo_prezzo", nomi);
        Assert.DoesNotContain("prezzo_promo_kgl_su_prezzo_promo", nomi);
    }
}
