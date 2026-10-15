using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le regole dei loghi nel SourceFrameworkCss di Coop. Il Plugin etichetta un logo
/// foto_extra$sigla$tipo_N, lo piazza grande quanto il box e confronta le etichette con i pattern
/// della configurazione come regex ancorate (CssFramework.makeRegexFromGroupName: * diventa .*).
/// Un logo che nessun post-ridimensionamento prende resta grande quanto il box; un pattern che
/// prende anche un logo dal nome piu' lungo lo ridimensiona due volte e lo mette in due livelli.
/// Nel PoP: Logo_FiorFiore scritto senza asterischi, Logo_Fru_Swing_Nero mancante,
/// Logo_BancodelGusto con fit 1 (CONTENT_TO_FRAME, senza proporzioni); nel volantino e nel PoP:
/// *LOGO_VIVIVERDE* e *logo_senzaolioPalma* che prendevano anche _BIO e Coop.
/// Le foto extra caricate a mano hanno nomi imprevedibili: nel PoP le prendono i pattern generici
/// *foto_extra$*$tipo_3* e *foto_extra$*$tipo_2*, in livelli in coda validi solo con gli slot, dove
/// ogni elemento si prende una volta sola (CssFotoExtraManualiPopCoopTests). I livelli sempre attivi
/// restano uno per logo.
/// </summary>
public class CssLoghiPopCoopTests
{
    private const string FileCss = "Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json";

    private static JObject Css() => JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile(FileCss)));

    /// Come CssFramework.makeRegexFromGroupName.
    private static Regex Pattern(string gruppo)
    {
        string nome = Regex.Replace(gruppo, @"\[itemLink\]$|\[exist\]$", "", RegexOptions.IgnoreCase);
        string escaped = Regex.Replace(nome, @"[-\/\\^$+?.()|[\]{}]", m => "\\" + m.Value);
        return new Regex("^" + escaped.Replace("*", ".*") + "$");
    }

    private static bool Prende(IEnumerable<JToken>? patterns, string etichetta) =>
        (patterns ?? Enumerable.Empty<JToken>()).Any(p => Pattern((string)p!).IsMatch(etichetta));

    private static string Etichetta(string sigla) => "foto_extra$" + sigla + "$tipo_3";

    private static IEnumerable<JObject> Operazioni(JObject css, int tipoLavorazione) =>
        css["dbRidimensionamentiAllineamenti"]!["modificheCssPerKit"]!.Cast<JObject>()
            .Where(k => k["kit"]!["kitTipoLavorazioniValide"]!.Values<int>().SequenceEqual(new[] { tipoLavorazione })
                        && !k["kit"]!["areeValide"]!.Any())
            .SelectMany(k => k["operazioniPerBox"]!.Cast<JObject>());

    private static JObject? Loghi(JObject operazione) =>
        (operazione["allineamenti"] as JArray)?.Cast<JObject>().FirstOrDefault(a => (string?)a["nomeGruppo"] == "Loghi");

    private static IEnumerable<JObject> PostRidimensionamenti(JObject operazione) =>
        (operazione["postRidimensionamenti"] as JArray)?.Cast<JObject>() ?? Enumerable.Empty<JObject>();

    /// I pattern che prendono le foto extra caricate a mano: non sono sigle di loghi.
    private static bool Generico(string pattern) => pattern.StartsWith("*foto_extra$");

    /// Un livello senza condizioni vale in ogni box, con e senza slot.
    private static bool SempreAttivo(JToken livello) => !(livello["listSetCondizioni"] is JArray condizioni && condizioni.Count > 0);

    private static List<JObject> OperazioniConLoghi(int tipoLavorazione) =>
        Operazioni(Css(), tipoLavorazione).Where(o => Loghi(o) != null).ToList();

    /// I loghi che possono uscire: quelli che le regole dei loghi di volantino e PoP nominano per
    /// sigla (i pattern con il nome del file valgono solo per i loghi senza sigla).
    private static List<string> SigleDeiLoghi()
    {
        var css = Css();
        return Operazioni(css, 1).Concat(Operazioni(css, 2))
            .Select(Loghi).Where(a => a != null)
            .SelectMany(a => a!["gruppoEtichette"]!.Values<string>())
            .Where(p => !Generico(p!))
            .Select(p => p!.Trim('*').Trim('$'))
            .Where(s => !s.Contains('.'))
            .Distinct()
            .ToList();
    }

    [Fact]
    public void Nel_PoP_ogni_logo_ha_ridimensionamento_un_solo_livello_e_fit_finale()
    {
        var operazioni = OperazioniConLoghi(2);
        Assert.Equal(2, operazioni.Count);
        var sigle = SigleDeiLoghi();
        Assert.Contains("Logo_FiorFiore", sigle);
        Assert.Contains("Logo_Fru_Swing_Nero", sigle);

        foreach (var operazione in operazioni)
        {
            var loghi = Loghi(operazione)!;
            foreach (var sigla in sigle)
            {
                string etichetta = Etichetta(sigla);
                string dove = $"{sigla} nel PoP, box {operazione["nomiBox"]}";

                Assert.True(PostRidimensionamenti(operazione).Any(g => Prende(g["gruppoEtichette"], etichetta)), dove + ": nessun ridimensionamento");
                Assert.True(Prende(loghi["gruppoEtichette"], etichetta), dove + ": fuori dal gruppo Loghi");
                Assert.Equal(1, loghi["ordinamentoLivelli"]!.Where(SempreAttivo).Count(l => Prende(l["elementi"], etichetta)));
                Assert.True(loghi["finalFit"]!.Any(f => Prende(f["nomiElementi"], etichetta)), dove + ": nessun fit finale");
            }
        }
    }

    /// Nel volantino il BOX_SuperprezziOF aveva "Logo_FiorFiore" senza asterischi nel gruppo Loghi:
    /// il FiorFiore non entrava nel gruppo e non si allineava.
    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void I_pattern_dei_loghi_hanno_gli_asterischi(int tipoLavorazione)
    {
        foreach (var operazione in OperazioniConLoghi(tipoLavorazione))
        {
            var pattern = PostRidimensionamenti(operazione).SelectMany(g => g["gruppoEtichette"]!.Values<string>())
                .Concat(Loghi(operazione)!["gruppoEtichette"]!.Values<string>())
                .Concat(Loghi(operazione)!["finalFit"]!.SelectMany(f => f["nomiElementi"]!.Values<string>()));
            Assert.All(pattern, p => Assert.True(p!.StartsWith('*') && p.EndsWith('*'), p + " senza asterischi"));
        }
    }

    [Fact]
    public void Nel_PoP_il_FiorFiore_riempie_proporzionalmente_come_nel_volantino()
    {
        foreach (var operazione in OperazioniConLoghi(2))
        {
            var fit = Loghi(operazione)!["finalFit"]!
                .Where(f => Prende(f["nomiElementi"], Etichetta("Logo_FiorFiore")))
                .Select(f => string.Join(",", f["fit"]!.Values<int>()))
                .ToList();
            //Prima il fit generico delle foto extra, poi il suo: conta l'ultimo, che riempie.
            Assert.Equal(new[] { "2", "3" }, fit);
        }
    }

    [Fact]
    public void Nel_PoP_il_Banco_del_Gusto_si_ridimensiona_in_proporzione()
    {
        foreach (var operazione in OperazioniConLoghi(2))
        {
            var fit = PostRidimensionamenti(operazione)
                .Where(g => Prende(g["gruppoEtichette"], Etichetta("Logo_BancodelGusto")))
                .SelectMany(g => g["finalFit"]!.SelectMany(f => f["fit"]!.Values<int>()))
                .ToList();
            Assert.NotEmpty(fit);
            Assert.All(fit, f => Assert.Equal(2, f));
        }
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void I_loghi_dal_nome_simile_stanno_ognuno_nel_proprio_livello(int tipoLavorazione)
    {
        foreach (var operazione in OperazioniConLoghi(tipoLavorazione))
        {
            foreach (var sigla in new[] { "LOGO_VIVIVERDE", "LOGO_VIVIVERDE_BIO", "logo_senzaolioPalma", "logo_senzaolioPalmaCoop" })
            {
                Assert.Equal(1, Loghi(operazione)!["ordinamentoLivelli"]!.Where(SempreAttivo).Count(l => Prende(l["elementi"], Etichetta(sigla))));
            }
        }
    }

    [Theory]
    [InlineData("LOGO_VIVIVERDE", "15.776", "12.116")]
    [InlineData("LOGO_VIVIVERDE_BIO", "27", "21")]
    [InlineData("logo_senzaolioPalma", "14", "14")]
    [InlineData("logo_senzaolioPalmaCoop", "16.671", "14.366")]
    public void Nel_volantino_i_loghi_dal_nome_simile_prendono_solo_la_propria_misura(string sigla, string larghezza, string altezza)
    {
        var generale = Operazioni(Css(), 1).Single(o => !o["nomiBox"]!.Any() && PostRidimensionamenti(o).Any());
        var gruppi = PostRidimensionamenti(generale).Where(g => Prende(g["gruppoEtichette"], Etichetta(sigla))).ToList();

        var gruppo = Assert.Single(gruppi);
        Assert.Equal(larghezza, (string?)gruppo["ridimensionamenti"]![0]!["setWidth"]);
        Assert.Equal(altezza, (string?)gruppo["ridimensionamenti"]![0]!["setHeight"]);
    }

    [Fact]
    public void Il_pattern_esatto_prende_solo_la_sua_sigla()
    {
        Assert.Matches(Pattern("*$LOGO_VIVIVERDE$*"), Etichetta("LOGO_VIVIVERDE"));
        Assert.DoesNotMatch(Pattern("*$LOGO_VIVIVERDE$*"), Etichetta("LOGO_VIVIVERDE_BIO"));
        Assert.DoesNotMatch(Pattern("Logo_FiorFiore"), Etichetta("Logo_FiorFiore"));
    }
}
