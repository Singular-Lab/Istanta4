using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1095: nell'esportazione PoP Coop gli A7 escono senza foto prodotto, ne' primaria ne'
/// secondarie, per le referenze singole e in gruppo. Loghi e bollini restano; negli altri formati
/// le foto non cambiano.
/// </summary>
public class PopCoopA7SenzaFotoTests
{
    private static readonly object Loghi = new List<object> { "Logo_BDP" };
    private static readonly object Extra = new List<object> { "Bollino_SDB" };

    private static Dictionary<string, object> Record(bool inGruppo) => new()
    {
        [GLOBAL_VARIABLES_FICO.keyFotoNome] = "101_1.jpg",
        [GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = inGruppo
            ? new List<FotoElementoGruppo>
            {
                new() { codRef = "101", nomeFoto = "101_1.jpg", statoSelezione = 1 },
                new() { codRef = "102", nomeFoto = "102_1.jpg", statoSelezione = 2 }
            }
            : new List<FotoElementoGruppo>(),
        ["Foto.ExtraAuto"] = Loghi,
        ["Foto.Extra"] = Extra
    };

    [Fact]
    public void In_A7_una_referenza_in_gruppo_esce_senza_foto_ne_secondarie_ma_con_loghi_e_bollini()
    {
        var record = Record(inGruppo: true);

        Coopfi.togliFotoProdottoSeA7(record, "A7");

        Assert.Equal("", record[GLOBAL_VARIABLES_FICO.keyFotoNome]);
        Assert.Empty((List<FotoElementoGruppo>)record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
        Assert.Same(Loghi, record["Foto.ExtraAuto"]);
        Assert.Same(Extra, record["Foto.Extra"]);
    }

    [Fact]
    public void In_A7_una_referenza_singola_esce_senza_foto()
    {
        var record = new Dictionary<string, object> { [GLOBAL_VARIABLES_FICO.keyFotoNome] = "300_1.jpg", ["Foto.ExtraAuto"] = Loghi };

        Coopfi.togliFotoProdottoSeA7(record, "A7");

        Assert.Equal("", record[GLOBAL_VARIABLES_FICO.keyFotoNome]);
        Assert.Empty((List<FotoElementoGruppo>)record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
        Assert.Same(Loghi, record["Foto.ExtraAuto"]);
    }

    [Theory]
    [InlineData("A3_VERTICALI")]
    [InlineData("A3_ORIZZONTALI")]
    public void Negli_altri_formati_le_foto_non_cambiano(string formato)
    {
        var record = Record(inGruppo: true);
        var membri = record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto];

        Coopfi.togliFotoProdottoSeA7(record, formato);

        Assert.Equal("101_1.jpg", record[GLOBAL_VARIABLES_FICO.keyFotoNome]);
        Assert.Same(membri, record[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto]);
        Assert.Equal(2, ((List<FotoElementoGruppo>)membri).Count);
    }

    [Fact]
    public void Senza_record_non_succede_niente()
    {
        Coopfi.togliFotoProdottoSeA7(null, "A7");
    }

    [Fact]
    public void EsportaPoP_toglie_le_foto_dopo_quelle_del_gruppo_e_prima_del_sottogruppo()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string esporta = coop.Substring(inizio, fine - inizio);

        int regola = esporta.IndexOf("togliFotoProdottoSeA7(recItem, formatoKit);", StringComparison.Ordinal);
        Assert.True(regola > 0);
        Assert.True(regola > esporta.IndexOf("recItem[GLOBAL_VARIABLES_FICO.keyFotoNome] = curr_fotoPgroup_processed;", StringComparison.Ordinal));
        Assert.True(regola < esporta.IndexOf("RefCloner.CopiaETrasformaObjSingoloInObjSottogruppo(recItem)", StringComparison.Ordinal));
        // Fuori dal blocco dei gruppi: vale anche per le referenze singole.
        Assert.True(regola < esporta.IndexOf("bool gruppoDeveUscireConISingoliConDescrizioneGruppo", StringComparison.Ordinal));
    }

    private static string Sorgente(string relativo) => File.ReadAllText(Percorso(relativo.Replace('/', Path.DirectorySeparatorChar))).Replace("\r", "");

    private static string Percorso(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo);
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
