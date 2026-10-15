using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop le foto extra caricate a mano sulla ref, loghi e bollini, vanno negli slot dei loghi
/// come gli altri, senza conoscerne il nome. Il Plugin le etichetta foto_extra$nome$tipo_N come i
/// loghi automatici: le prendono due livelli generici in coda al gruppo a slot Loghi, prima i loghi
/// (tipo 3) e poi i bollini (tipo 2). Il gruppo a slot prende ogni elemento una volta sola, quindi ai
/// generici restano solo i loghi che nessun livello ha riconosciuto. Senza slot i livelli non
/// escludono gli elementi gia' presi: i generici valgono solo se il box ha i riquadri slot_logo*.
/// Fit finale e ridimensionamento generici stanno in testa, cosi' quelli specifici, applicati dopo,
/// restano validi.
/// </summary>
public class CssFotoExtraManualiPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";
    private const string Loghi = "*foto_extra$*$tipo_3*";
    private const string Bollini = "*foto_extra$*$tipo_2*";

    /// Come CssFramework.makeRegexFromGroupName.
    private static Regex Pattern(string gruppo)
    {
        string escaped = Regex.Replace(gruppo, @"[-\/\\^$+?.()|[\]{}]", m => "\\" + m.Value);
        return new Regex("^" + escaped.Replace("*", ".*") + "$");
    }

    private static IEnumerable<JObject> OperazioniDelPoP()
    {
        var pop = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)))["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!
            .Cast<JObject>()
            .Single(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { 2 }));
        return pop["operazioniPerBox"]!.Cast<JObject>()
            .Where(o => !o["nomiBox"]!.Any() || o["nomiBox"]!.Values<string>().SequenceEqual(new[] { "BOX_doppio_SCONTO" }));
    }

    private static JObject GruppoLoghi(JObject operazione) =>
        operazione["allineamenti"]!.Cast<JObject>().Single(a => (string?)a["nomeGruppo"] == "Loghi");

    [Fact]
    public void I_livelli_generici_stanno_in_coda_prima_i_loghi_poi_i_bollini_e_solo_con_gli_slot()
    {
        var operazioni = OperazioniDelPoP().ToList();
        Assert.Equal(2, operazioni.Count);

        foreach (var operazione in operazioni)
        {
            var gruppo = GruppoLoghi(operazione);
            var livelli = gruppo["ordinamentoLivelli"]!.OrderBy(l => (int)l["livello"]!).ToList();
            var penultimo = livelli[^2];
            var ultimo = livelli[^1];

            Assert.Equal(new[] { Loghi }, penultimo["elementi"]!.Values<string>());
            Assert.Equal(new[] { Bollini }, ultimo["elementi"]!.Values<string>());
            foreach (var livello in new[] { penultimo, ultimo })
            {
                var condizione = livello["listSetCondizioni"]!.Single()["setCondizioni"]!.Single();
                Assert.Equal(new[] { "slot_logo*" }, condizione["elementiDaTrovare"]!.Values<string>());
                Assert.Empty(condizione["elementiDaNonTrovare"]!);
            }
            //Gli altri livelli valgono sempre, come prima.
            Assert.All(livelli.Take(livelli.Count - 2), l => Assert.True(l["listSetCondizioni"] == null || l["listSetCondizioni"]!.Type == JTokenType.Null || !l["listSetCondizioni"]!.Any()));

            Assert.Contains(Loghi, gruppo["gruppoEtichette"]!.Values<string>());
            Assert.Contains(Bollini, gruppo["gruppoEtichette"]!.Values<string>());
            Assert.Equal(new[] { "slot_logo1", "slot_logo2", "slot_logo3" }, gruppo["slot"]!["cornici"]!.Values<string>());
        }
    }

    [Fact]
    public void Fit_finale_e_ridimensionamento_generici_vengono_prima_degli_specifici()
    {
        foreach (var operazione in OperazioniDelPoP())
        {
            var fit = GruppoLoghi(operazione)["finalFit"]!.First();
            Assert.Equal(new[] { Loghi, Bollini }, fit["nomiElementi"]!.Values<string>());
            Assert.Equal(new[] { 2 }, fit["fit"]!.Values<int>());

            //I post-ridimensionamenti girano nell'ordine del file: gli specifici dopo il generico.
            var ridimensionamento = operazione["postRidimensionamenti"]!.First();
            Assert.Equal("loghi_foto_extra", (string?)ridimensionamento["nomeGruppo"]);
            Assert.Equal(new[] { Loghi, Bollini }, ridimensionamento["gruppoEtichette"]!.Values<string>());
            var misura = ridimensionamento["ridimensionamenti"]!.Single();
            Assert.Equal("68", (string?)misura["setWidth"]);
            Assert.Equal("48.6", (string?)misura["setHeight"]);
            Assert.Equal(new[] { 2 }, ridimensionamento["finalFit"]!.Single()["fit"]!.Values<int>());
        }
    }

    [Theory]
    [InlineData("foto_extra$logo_cliente.ai$tipo_3", true)]
    [InlineData("foto_extra$Logo Nuovo 2025.psd$tipo_3", true)]
    [InlineData("foto_extra$bollino_qualita.psd$tipo_2", true)]
    [InlineData("foto_extra$ambientata.jpg$tipo_4", false)]
    [InlineData("foto_extra$sfondo.jpg$tipo_5", false)]
    [InlineData("foto_extra$artwork.ai$tipo_6", false)]
    [InlineData("immagine", false)]
    public void I_pattern_generici_prendono_loghi_e_bollini_e_nient_altro(string etichetta, bool preso)
    {
        Assert.Equal(preso, Pattern(Loghi).IsMatch(etichetta) || Pattern(Bollini).IsMatch(etichetta));
    }
}
