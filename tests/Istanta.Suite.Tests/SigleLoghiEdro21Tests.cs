using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-990: getLoghiEBolliNew di Edro21 sceglie il logo scrivendone la sigla, e il plugin
/// cerca quella sigla in SourceLoghiBolli confrontandola lettera per lettera: pulisci() in
/// plugin/noRenderElementi.js converte soltanto a stringa, non normalizza maiuscole ne' spazi.
/// Quindi codice e source devono concordare esattamente, altrimenti il logo non si trova e
/// il difetto e' invisibile fino all'impaginazione. Qui si fissa quella concordanza.
/// </summary>
public class SigleLoghiEdro21Tests
{
    private sealed class VoceLogo
    {
        public string nome { get; set; } = "";
        public string sigla { get; set; } = "";
    }

    private sealed class SorgenteLoghi
    {
        public List<VoceLogo> source { get; set; } = new();
    }

    private static List<VoceLogo> Voci()
    {
        var testo = File.ReadAllText(TrovaSorgenteEdro21());
        var radice = JsonConvert.DeserializeObject<SorgenteLoghi>(testo);
        Assert.NotNull(radice);
        return radice!.source;
    }

    [Theory]
    [InlineData("conad_saporidintorniPQ")]
    [InlineData("conad_saporiideePQ")]
    public void Le_sigle_PQ_allineate_alla_produzione_esistono_scritte_cosi(string sigla)
    {
        // Prima di I20-990 il source le scriveva minuscole mentre la produzione, e ora il codice,
        // le scrive con PQ maiuscolo: il confronto sensibile alle maiuscole non le trovava.
        var corrispondenti = Voci().Where(v => v.sigla == sigla).ToList();

        Assert.True(corrispondenti.Count == 1,
            $"la sigla '{sigla}' deve comparire una volta sola nel source, trovate {corrispondenti.Count}");
    }

    [Theory]
    [InlineData("conad_saporidintorni")]
    [InlineData("conad_saporiidee")]
    public void Le_sigle_senza_PQ_restano_voci_distinte(string sigla)
    {
        // Caso limite: le sorelle senza PQ sono loghi diversi e getLoghiEBolliNew le sceglie in
        // rami separati. Se una delle due sparisse o si confondesse con la variante PQ, il
        // volantino porterebbe il logo sbagliato. 'conad_saporiidee' in particolare aveva sigla
        // "conad_saporiidee  Logo" e non era raggiungibile.
        var corrispondenti = Voci().Where(v => v.sigla == sigla).ToList();

        Assert.True(corrispondenti.Count == 1,
            $"la sigla '{sigla}' deve comparire una volta sola nel source, trovate {corrispondenti.Count}");
    }

    [Fact]
    public void Nessuna_sigla_del_source_porta_spazi_in_testa_o_in_coda()
    {
        // Gli spazi non si vedono nell'interfaccia ma rompono il confronto esatto del plugin:
        // e' esattamente il modo in cui "conad_saporiidee  Logo" era diventato irraggiungibile.
        var sporche = Voci()
            .Where(v => !string.IsNullOrEmpty(v.sigla) && v.sigla != v.sigla.Trim())
            .Select(v => $"{v.nome} -> '{v.sigla}'")
            .ToList();

        Assert.True(sporche.Count == 0,
            "sigle con spazi ai bordi: " + string.Join(", ", sporche));
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceLoghiBolli.json";

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
