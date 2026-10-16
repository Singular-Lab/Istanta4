using Istanta.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop Logo_FiorFiore (90,949 x 27,502), Logo_BancodelGusto (65 x 32,637) e
/// Logo_OrigineItalia (54,84 x 14,4) escono con la loro misura, l'immagine adattata in proporzione.
/// Negli slot sono centrati; nei box delle meccaniche verticali - A3 orizzontale: BOX_STD, BOX_1+1,
/// BOX_doppio_SCONTO_LINEA, BOX_SpendiPunti; A3 verticale: BOX_doppio_SCONTO_LINEA, BOX_SpendiPunti,
/// BOX_ESCLUSIVA_SOCI - centrati in verticale con il bordo destro sullo slot. Lo dicono le eccezioni
/// del gruppo a slot, che devono passare dal modello SlotAllineamento per arrivare al Plugin. Gli
/// altri loghi restano alla misura dello slot. Loghi e bollini che si toccano si segnalano.
/// </summary>
public class LoghiMisuraPropriaPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";
    private static readonly string[] Fior = { "*Logo_FiorFiore*", "*fiorfiore.psd*" };
    private static readonly string[] Banco = { "*Logo_BancodelGusto*" };
    private static readonly string[] Origine = { "*Logo_OrigineItalia*", "*Origine_Italia-logo.psd*" };

    private static IEnumerable<JObject> OperazioniConLoghi()
    {
        var pop = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!
            .Cast<JObject>().Single(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { 2 }));
        return pop["operazioniPerBox"]!.Cast<JObject>()
            .Where(o => !o["nomiBox"]!.Any() || o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_doppio_SCONTO" }));
    }

    [Theory]
    [InlineData("Logo_FiorFiore", "90.949", "27.502")]
    [InlineData("Logo_BancodelGusto", "65", "32.637")]
    [InlineData("Logo_OrigineItalia", "54.84", "14.4")]
    public void I_tre_loghi_hanno_la_loro_misura_e_l_immagine_in_proporzione(string nome, string larghezza, string altezza)
    {
        var operazioni = OperazioniConLoghi().ToList();
        Assert.Equal(2, operazioni.Count);
        foreach (var operazione in operazioni)
        {
            var post = operazione["postRidimensionamenti"]!.Cast<JObject>().ToList();
            var gruppo = post.Single(g => (string?)g["nomeGruppo"] == nome);
            var misura = gruppo["ridimensionamenti"]!.Single();
            Assert.Equal(larghezza, (string?)misura["setWidth"]);
            Assert.Equal(altezza, (string?)misura["setHeight"]);
            Assert.All(gruppo["finalFit"]!, f => Assert.Equal(new[] { 2 }, f["fit"]!.Values<int>()));

            //Dopo il ridimensionamento generico, cosi' la sua misura e' l'ultima.
            Assert.True(post.IndexOf(gruppo) > post.FindIndex(g => (string?)g["nomeGruppo"] == "loghi"));
        }
    }

    [Fact]
    public void FiorFiore_e_Origine_Italia_non_sono_piu_nel_ridimensionamento_generico()
    {
        foreach (var operazione in OperazioniConLoghi())
        {
            var loghi = operazione["postRidimensionamenti"]!.Cast<JObject>().Single(g => (string?)g["nomeGruppo"] == "loghi");
            foreach (var pattern in Fior.Concat(Origine))
            {
                Assert.DoesNotContain(pattern, loghi["gruppoEtichette"]!.Values<string>());
            }
        }
    }

    [Fact]
    public void Le_eccezioni_del_gruppo_Loghi_allineano_a_destra_nei_box_verticali_e_altrove_centrano()
    {
        foreach (var operazione in OperazioniConLoghi())
        {
            var slot = operazione["allineamenti"]!.Cast<JObject>().Single(a => (string?)a["nomeGruppo"] == "Loghi")["slot"]!;
            Assert.Equal("posizioneEDimensione", (string?)slot["modalita"]);

            var eccezioni = slot["eccezioni"]!.Cast<JObject>().ToList();
            Assert.Equal(2, eccezioni.Count);
            var tre = Fior.Concat(Banco).Concat(Origine).ToArray();

            var destra = eccezioni[0];
            Assert.Equal(tre, destra["elementi"]!.Values<string>());
            Assert.Equal("posizione", (string?)destra["modalita"]);
            Assert.Equal("destra", (string?)destra["allineamentoOrizzontale"]);
            var insiemi = destra["listSetCondizioni"]!.Select(s => s["setCondizioni"]!.Single()).ToList();
            Assert.Equal(2, insiemi.Count);
            Assert.Equal(new[] { "A3_ORIZZONTALI" }, insiemi[0]["kitCondition"]!.Single()["kitFormatiValidi"]!.Values<string>());
            Assert.Equal(new[] { "BOX_STD", "BOX_1+1", "BOX_doppio_SCONTO_LINEA", "BOX_SpendiPunti" }, insiemi[0]["boxCondition"]!.Single()["boxValidi"]!.Values<string>());
            Assert.Equal(new[] { "A3_VERTICALI" }, insiemi[1]["kitCondition"]!.Single()["kitFormatiValidi"]!.Values<string>());
            Assert.Equal(new[] { "BOX_doppio_SCONTO_LINEA", "BOX_SpendiPunti", "BOX_ESCLUSIVA_SOCI" }, insiemi[1]["boxCondition"]!.Single()["boxValidi"]!.Values<string>());

            var centro = eccezioni[1];
            Assert.Equal(tre, centro["elementi"]!.Values<string>());
            Assert.Equal("posizione", (string?)centro["modalita"]);
            Assert.Equal("centro", (string?)centro["allineamentoOrizzontale"]);
            Assert.Empty(centro["listSetCondizioni"]!);
        }
    }

    [Fact]
    public void Nel_PoP_si_segnalano_loghi_e_bollini_che_si_toccano()
    {
        var generica = OperazioniConLoghi().Single(o => !o["nomiBox"]!.Any());
        var regola = generica["segnalazioniConflitti"]!.Single();

        Assert.Equal(new[] { "foto_extra*tipo_3, foto_extra*tipo_2" }, regola["segnalazioni"]!.Values<string>());
        Assert.False((bool)regola["useTextBounds"]!);
    }

    [Fact]
    public void Le_eccezioni_arrivano_al_Plugin_e_non_si_scrivono_quando_mancano()
    {
        var db = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))!;
        var riletto = JsonConvert.DeserializeObject<DbFrameworkCss>(JsonConvert.SerializeObject(db))!;

        var slot = riletto.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .Where(k => k.kit.kitTipoLavorazioniValide.Contains(2))
            .SelectMany(k => k.operazioniPerBox).SelectMany(o => o.allineamenti)
            .First(a => a.nomeGruppo == "Loghi").slot!;
        var destra = slot.eccezioni![0];
        Assert.Equal("destra", destra.allineamentoOrizzontale);
        Assert.Equal("posizione", destra.modalita);
        Assert.Equal(new[] { "A3_ORIZZONTALI" }, destra.listSetCondizioni[0].setCondizioni[0].kitCondition[0].kitFormatiValidi);
        Assert.Equal("BOX_SpendiPunti", destra.listSetCondizioni[1].setCondizioni[0].boxCondition[0].boxValidi[1]);

        //Un gruppo a slot senza eccezioni non scrive la chiave.
        var scritto = JObject.FromObject(new SlotAllineamento { cornici = new() { "slot_logo1" } }, JsonSerializer.Create());
        Assert.False(scritto.ContainsKey("eccezioni"));
    }
}
