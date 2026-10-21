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
/// il kit A7 sta prima. Prima differenza voluta: le misure dei tre loghi con misura propria, ridotte
/// della percentuale di FiorFiore (21,981 x 6,647 mm, data dall'operatore) con le stesse proporzioni.
/// Seconda: nel doppio sconto le distanze degli allineamenti, ridotte dello stesso fattore, e la
/// descrizione, che nell'A7 sta di lato e segue il prezzo soci alla distanza dell'info pack.
/// Terza: nell'esclusiva soci lo sconto non e' impilato e resta dove lo mette la meccanica, e la pila ha
/// la spaziatura dell'A3 ridotta dello stesso fattore.
/// </summary>
public class CssKitA7PopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";
    private static readonly string[] BoxVerticaliA3O = { "BOX_STD", "BOX_1+1", "BOX_doppio_SCONTO_LINEA", "BOX_SpendiPunti" };
    //I due gruppi che in A3 verticale agganciano il prezzo al kg dell'esclusiva soci al prezzo.
    //Misura A3 e misura A7 dei loghi con misura propria.
    private static readonly (string logo, string a3w, string a3h, string a7w, string a7h)[] MisureLoghi =
    {
        ("Logo_FiorFiore", "90.949", "27.502", "21.981", "6.647"),
        ("Logo_BancodelGusto", "65", "32.637", "15.71", "7.888"),
        ("Logo_OrigineItalia", "54.84", "14.4", "13.254", "3.48")
    };

    private const double Riduzione = 21.981 / 90.949;

    //Distanza in x dei gruppi del doppio sconto: A3 e A7 (A3 per il fattore dei loghi, al millesimo).
    private static readonly (string gruppo, double a3, double a7)[] DistanzeDoppioSconto =
    {
        ("prezzo_info_pack_FIX", -7.25, -1.752),
        ("prezzo_info_pack_SOCI_DOPPIAFIX", -7.25, -1.752),
        ("DistanzaInfoePromo", -14.33, -3.463),
        ("Loghi", -12.7, -3.069)
    };

    private static bool DoppioSconto(JObject operazione) => operazione["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_doppio_SCONTO" });

    //Il gruppo senza la distanza in x dell'ancora, per confrontare il resto.
    private static JObject SenzaDistanzaX(JObject gruppo)
    {
        var copia = (JObject)gruppo.DeepClone();
        foreach (var ancora in copia["followAnchor"]!.Cast<JObject>().Where(a => a["xAnchor"]!.Type == JTokenType.Object))
        {
            ((JObject)ancora["xAnchor"]!).Remove("distance");
        }
        return copia;
    }

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
            foreach (var sezione in new[] { "ridimensionamenti", "segnalazioniConflitti" })
            {
                Assert.True(JToken.DeepEquals(a3[i][sezione], a7[i][sezione]), sezione + " di " + a3[i]["nomiBox"]);
            }

            //I post ridimensionamenti sono gli stessi, salvo la misura dei tre loghi.
            var postA3 = (JArray)a3[i]["postRidimensionamenti"]!.DeepClone();
            var postA7 = (JArray)a7[i]["postRidimensionamenti"]!.DeepClone();
            Assert.Equal(postA3.Count, postA7.Count);
            foreach (var post in postA3.Concat(postA7).Cast<JObject>().Where(g => MisureLoghi.Any(m => m.logo == (string?)g["nomeGruppo"])))
            {
                foreach (var r in post["ridimensionamenti"]!.Cast<JObject>())
                {
                    r.Remove("setWidth");
                    r.Remove("setHeight");
                }
            }
            Assert.True(JToken.DeepEquals(postA3, postA7), "postRidimensionamenti di " + a3[i]["nomiBox"]);
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
            var attesi = nomiA3.Where(n => !esclusivaSoci || !SoloA3VEsclusivaSoci.Contains(n)).ToList();
            if (DoppioSconto(a3[i]))
            {
                attesi.Add("descrizione_accanto_al_prezzo_soci");
            }
            Assert.Equal(attesi, nomiA7);

            foreach (var nome in nomiA7.Where(n => n != "Loghi" && n != "Campi_PrincipaliEsclusivaSoci" && n != "descrizione_accanto_al_prezzo_soci"))
            {
                bool distanzaRidotta = DoppioSconto(a3[i]) && DistanzeDoppioSconto.Any(d => d.gruppo == nome);
                var a3g = distanzaRidotta ? SenzaDistanzaX(Gruppo(a3[i], nome)) : Gruppo(a3[i], nome);
                var a7g = distanzaRidotta ? SenzaDistanzaX(Gruppo(a7[i], nome)) : Gruppo(a7[i], nome);
                Assert.True(JToken.DeepEquals(a3g, a7g), nome);
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
            Assert.True(JToken.DeepEquals(SenzaDistanzaX(a3)["followAnchor"], SenzaDistanzaX(Gruppo(operazione, "Loghi"))["followAnchor"]));
        }
    }

    [Fact]
    public void Nel_doppio_sconto_dell_A7_le_distanze_sono_quelle_dell_A3_ridotte_come_i_loghi()
    {
        var a7 = Operazioni(KitA7()).Single(DoppioSconto);
        var a3 = Operazioni(KitA3()).Single(DoppioSconto);

        foreach (var (gruppo, distanzaA3, distanzaA7) in DistanzeDoppioSconto)
        {
            double inA3 = (double)Gruppo(a3, gruppo)["followAnchor"]![0]!["xAnchor"]!["distance"]!;
            double inA7 = (double)Gruppo(a7, gruppo)["followAnchor"]![0]!["xAnchor"]!["distance"]!;
            Assert.Equal(distanzaA3, inA3);
            Assert.Equal(distanzaA7, inA7);
            Assert.Equal(distanzaA3 * Riduzione, inA7, 3);
        }
        //Il generico del kit A7 non cambia in questo giro: l'info pack resta a 5,2 mm.
        var generica = Operazioni(KitA7()).Single(o => !o["nomiBox"]!.Any());
        Assert.Equal(-5.2, (double)Gruppo(generica, "prezzo_info_pack_FIX")["followAnchor"]![0]!["xAnchor"]!["distance"]!);
    }

    [Fact]
    public void Nel_doppio_sconto_dell_A7_la_descrizione_segue_il_prezzo_soci_alla_distanza_dell_info_pack()
    {
        var doppio = Operazioni(KitA7()).Single(DoppioSconto);
        var descrizione = Gruppo(doppio, "descrizione_accanto_al_prezzo_soci");
        var infoPack = Gruppo(doppio, "prezzo_info_pack_FIX");

        Assert.Equal(new[] { "descrizione" }, descrizione["gruppoEtichette"]!.Values<string>());
        Assert.Equal(new[] { "descrizione" }, descrizione["ordinamentoLivelli"]!.Single()["elementi"]!.Values<string>());
        var ancora = descrizione["followAnchor"]!.Single();
        Assert.Equal(new[] { "prezzo_promo_SOCI_DOPPIA" }, ancora["nomiGruppiSeguiti"]!.Values<string>());
        //Lato sinistro della descrizione sul lato destro del testo del prezzo soci, solo in orizzontale.
        Assert.Equal(1, (int)ancora["xAnchor"]!["allineaAlLato"]!);
        Assert.Equal(0, (int)ancora["xAnchor"]!["allineaLato"]!);
        Assert.Equal((double)infoPack["followAnchor"]![0]!["xAnchor"]!["distance"]!, (double)ancora["xAnchor"]!["distance"]!);
        Assert.Equal(JTokenType.Null, ancora["yAnchor"]!.Type);
        Assert.True((bool)ancora["useTextBounds"]!);
        Assert.Equal(JTokenType.Null, descrizione["listSetCondizioni"]!.Type);
        //Dopo DistanzaInfoePromo, che sposta il gruppo del prezzo soci.
        Assert.True((int)descrizione["ordine"]! > (int)Gruppo(doppio, "DistanzaInfoePromo")["ordine"]!);

        //Nel kit A3 la descrizione del doppio sconto non ha questa regola.
        var doppioA3 = Operazioni(KitA3()).Single(DoppioSconto);
        Assert.DoesNotContain(doppioA3["allineamenti"]!, g => (string?)g["nomeGruppo"] == "descrizione_accanto_al_prezzo_soci");
    }

    [Fact]
    public void Nell_A7_i_loghi_hanno_la_misura_ridotta_come_FiorFiore_e_le_stesse_proporzioni()
    {
        var a7 = Operazioni(KitA7());
        var a3 = Operazioni(KitA3());
        double riduzione = 21.981 / 90.949;
        var it = System.Globalization.CultureInfo.InvariantCulture;

        foreach (var (logo, a3w, a3h, a7w, a7h) in MisureLoghi)
        {
            //Nell'operazione generica e in quella del doppio sconto, in A7; l'A3 non cambia.
            var gruppiA7 = a7.SelectMany(o => o["postRidimensionamenti"]!.Cast<JObject>()).Where(g => (string?)g["nomeGruppo"] == logo).ToList();
            var gruppiA3 = a3.SelectMany(o => o["postRidimensionamenti"]!.Cast<JObject>()).Where(g => (string?)g["nomeGruppo"] == logo).ToList();
            Assert.Equal(2, gruppiA7.Count);
            Assert.All(gruppiA7, g => Assert.Equal((a7w, a7h), ((string)g["ridimensionamenti"]!.Single()["setWidth"]!, (string)g["ridimensionamenti"]!.Single()["setHeight"]!)));
            Assert.All(gruppiA3, g => Assert.Equal((a3w, a3h), ((string)g["ridimensionamenti"]!.Single()["setWidth"]!, (string)g["ridimensionamenti"]!.Single()["setHeight"]!)));

            //Ridotte della percentuale di FiorFiore, al millesimo di mm.
            Assert.Equal(double.Parse(a3w, it) * riduzione, double.Parse(a7w, it), 3);
            Assert.Equal(double.Parse(a3h, it) * riduzione, double.Parse(a7h, it), 3);
        }
    }

    [Fact]
    public void Nell_A7_il_prezzo_al_kg_dell_esclusiva_soci_resta_impilato_come_in_A3_orizzontale()
    {
        var esclusiva = Operazioni(KitA7()).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" }));
        var livelli = Gruppo(esclusiva, "Campi_PrincipaliEsclusivaSoci")["ordinamentoLivelli"]!.Cast<JObject>().ToList();

        Assert.Equal(new[] { "banda_inferiore_mastro", "descrizione", "box_risparmi", "prezzo_continuo", "prezzo_promo_kgl", "gruppo_prezzo2" },
            livelli.Select(l => (string)l["elementi"]!.Single()!));
        Assert.All(livelli, l => Assert.Equal(JTokenType.Null, l["listSetCondizioni"]!.Type));
    }

    [Fact]
    public void Nell_A7_lo_sconto_dell_esclusiva_soci_resta_dove_lo_mette_la_meccanica_e_la_pila_e_piu_stretta()
    {
        var esclusivaA7 = Operazioni(KitA7()).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" }));
        var esclusivaA3 = Operazioni(KitA3()).Single(o => o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_ESCLUSIVA_SOCI" }));
        var pilaA7 = Gruppo(esclusivaA7, "Campi_PrincipaliEsclusivaSoci");
        var pilaA3 = Gruppo(esclusivaA3, "Campi_PrincipaliEsclusivaSoci");

        //Nessun gruppo di allineamento dell'A7 muove box_sconto; il ridimensionamento in altezza resta.
        Assert.DoesNotContain(esclusivaA7["allineamenti"]!.Cast<JObject>(), g => g["gruppoEtichette"]!.Values<string>().Contains("box_sconto"));
        Assert.Contains(esclusivaA7["ridimensionamenti"]!, r => r["gruppoEtichette"]!.Values<string>().Contains("box_sconto"));

        //La spaziatura dell'A3 ridotta del fattore dei loghi.
        Assert.Equal(2.0, (double)pilaA3["spacingLivelli"]!);
        Assert.Equal(0.483, (double)pilaA7["spacingLivelli"]!);
        Assert.Equal(2.0 * Riduzione, (double)pilaA7["spacingLivelli"]!, 3);

        //Nell'A3 lo sconto resta in cima alla pila.
        Assert.Equal("box_sconto", (string)pilaA3["ordinamentoLivelli"]!.Last()["elementi"]!.Single()!);
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
