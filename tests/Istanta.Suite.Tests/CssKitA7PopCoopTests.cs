using Istanta.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Il CssFramework del PoP Coop A7 ha un kit suo, da modificare in seguito per conto proprio. Per
/// iniziare eredita esattamente le regole dell'A3 orizzontale: e' la copia del kit PoP con le
/// condizioni di formato risolte per l'A3 orizzontale. L'eccezione dei loghi a destra vale nei box
/// BOX_STD, BOX_1+1, BOX_doppio_SCONTO_LINEA e BOX_SpendiPunti senza condizione di formato, il prezzo
/// al kg dell'esclusiva soci resta impilato, e le regole solo A3 verticale non ci sono. Il Plugin
/// prende il primo kit valido per tipo e formato, e il kit PoP senza formato vale anche per l'A7:
/// il kit A7 sta prima.
/// </summary>
public class CssKitA7PopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";
    private static readonly string[] BoxVerticaliA3O = { "BOX_STD", "BOX_1+1", "BOX_doppio_SCONTO_LINEA", "BOX_SpendiPunti" };
    //I due gruppi che in A3 verticale agganciano il prezzo al kg dell'esclusiva soci al prezzo.
    private static readonly string[] SoloA3VEsclusivaSoci = { "prezzo_promo_kgl_su_info_pack_SOCI_DOPPIA", "prezzo_promo_kgl_su_prezzo_promo" };

    private static List<JObject> Kit() =>
        JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!
            .Cast<JObject>().ToList();

    private static bool DelPoP(JObject k) => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { 2 });

    private static JObject KitA7(List<JObject>? kit = null) =>
        (kit ?? Kit()).Single(k => DelPoP(k) && k["kit"]!["kitFormatiValidi"]!.Values<string>().SequenceEqual(new[] { "A7" }));

    private static JObject KitA3(List<JObject>? kit = null) => (kit ?? Kit()).Single(k => DelPoP(k) && !k["kit"]!["kitFormatiValidi"]!.Any());

    private static List<JObject> Operazioni(JObject kit) => kit["operazioniPerBox"]!.Cast<JObject>().ToList();

    private static JObject Gruppo(JObject operazione, string nome) =>
        operazione["allineamenti"]!.Cast<JObject>().Single(a => (string?)a["nomeGruppo"] == nome);

    [Fact]
    public void Il_kit_A7_vale_per_il_solo_A7_del_PoP_e_sta_prima_del_kit_PoP_senza_formato()
    {
        var kit = Kit();
        var a7 = KitA7(kit);

        Assert.Empty(a7["kit"]!["areeValide"]!);
        Assert.Empty(a7["kit"]!["canaliValidi"]!);
        Assert.True(kit.IndexOf(a7) < kit.IndexOf(KitA3(kit)), "il primo kit valido per l'A7 deve essere il suo");
        Assert.Equal(2, kit.Count(DelPoP));
    }

    [Fact]
    public void Il_kit_A7_ha_le_stesse_operazioni_ridimensionamenti_e_segnalazioni_dell_A3()
    {
        var a7 = Operazioni(KitA7());
        var a3 = Operazioni(KitA3());

        Assert.Equal(a3.Select(o => string.Join(",", o["nomiBox"]!.Values<string>())), a7.Select(o => string.Join(",", o["nomiBox"]!.Values<string>())));
        for (int i = 0; i < a3.Count; i++)
        {
            foreach (var sezione in new[] { "ridimensionamenti", "postRidimensionamenti", "segnalazioniConflitti" })
            {
                Assert.True(JToken.DeepEquals(a3[i][sezione], a7[i][sezione]), sezione + " di " + a3[i]["nomiBox"]);
            }
        }
    }

    [Fact]
    public void I_gruppi_di_allineamento_sono_quelli_dell_A3_tranne_le_regole_di_formato()
    {
        var a7 = Operazioni(KitA7());
        var a3 = Operazioni(KitA3());

        for (int i = 0; i < a3.Count; i++)
        {
            var nomiA3 = a3[i]["allineamenti"]!.Select(g => (string)g["nomeGruppo"]!).ToList();
            var nomiA7 = a7[i]["allineamenti"]!.Select(g => (string)g["nomeGruppo"]!).ToList();
            bool esclusivaSoci = a3[i]["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" });
            Assert.Equal(nomiA3.Where(n => !esclusivaSoci || !SoloA3VEsclusivaSoci.Contains(n)), nomiA7);

            foreach (var nome in nomiA7.Where(n => n != "Loghi" && n != "Campi_PrincipaliEsclusivaSoci"))
            {
                Assert.True(JToken.DeepEquals(Gruppo(a3[i], nome), Gruppo(a7[i], nome)), nome);
            }
        }
        Assert.DoesNotContain("A3_VERTICALI", KitA7().ToString());
        Assert.DoesNotContain("A3_ORIZZONTALI", KitA7().ToString());
    }

    [Fact]
    public void Nell_A7_i_loghi_vanno_a_destra_negli_stessi_box_dell_A3_orizzontale()
    {
        foreach (var operazione in Operazioni(KitA7()).Where(o => o["allineamenti"]!.Any(a => (string?)a["nomeGruppo"] == "Loghi")))
        {
            var eccezioni = Gruppo(operazione, "Loghi")["slot"]!["eccezioni"]!.Cast<JObject>().ToList();
            Assert.Equal(2, eccezioni.Count);

            var destra = eccezioni[0];
            Assert.Equal("destra", (string?)destra["allineamentoOrizzontale"]);
            var insieme = (JObject)destra["listSetCondizioni"]!.Single()["setCondizioni"]!.Single();
            Assert.Equal(BoxVerticaliA3O, insieme["boxCondition"]!.Single()["boxValidi"]!.Values<string>());
            Assert.Empty(insieme["kitCondition"]!);

            //Quello che resta del gruppo e' identico all'A3.
            var a3 = Gruppo(Operazioni(KitA3()).Single(o => JToken.DeepEquals(o["nomiBox"], operazione["nomiBox"])), "Loghi");
            Assert.True(JToken.DeepEquals(a3["slot"]!["eccezioni"]![1], eccezioni[1]), "eccezione al centro");
            Assert.True(JToken.DeepEquals(a3["ordinamentoLivelli"], Gruppo(operazione, "Loghi")["ordinamentoLivelli"]));
            Assert.True(JToken.DeepEquals(a3["followAnchor"], Gruppo(operazione, "Loghi")["followAnchor"]));
        }
    }

    [Fact]
    public void Nell_A7_il_prezzo_al_kg_dell_esclusiva_soci_resta_impilato_come_in_A3_orizzontale()
    {
        var esclusiva = Operazioni(KitA7()).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" }));
        var livelli = Gruppo(esclusiva, "Campi_PrincipaliEsclusivaSoci")["ordinamentoLivelli"]!.Cast<JObject>().ToList();

        Assert.Equal(new[] { "banda_inferiore_mastro", "descrizione", "box_risparmi", "prezzo_continuo", "prezzo_promo_kgl", "gruppo_prezzo2", "box_sconto" },
            livelli.Select(l => (string)l["elementi"]!.Single()!));
        Assert.All(livelli, l => Assert.Equal(JTokenType.Null, l["listSetCondizioni"]!.Type));
    }

    [Fact]
    public void Il_kit_A7_arriva_al_Plugin_con_il_suo_formato()
    {
        var db = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))!;
        var riletto = JsonConvert.DeserializeObject<DbFrameworkCss>(JsonConvert.SerializeObject(db))!;

        var a7 = riletto.dbRidimensionamentiAllineamenti.modificheCssPerKit.Single(k => k.kit.kitFormatiValidi.SequenceEqual(new[] { "A7" }));
        Assert.Equal(new[] { 2 }, a7.kit.kitTipoLavorazioniValide);
        Assert.Equal(4, a7.operazioniPerBox.Count);
    }
}
