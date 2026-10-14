using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1096: nell'esportazione PoP Coop una linea da 10 referenze in su da' al piu' 10 cartelli linea
/// per gruppo, senza un cartello di gruppo in piu'; sotto i 10 restano i cartelli singoli piu' 1
/// cartello linea.
/// </summary>
public class PopCoopLineeTests
{
    // Il ciclo di esportaPoP ridotto alle linee da 10 referenze in su: quante escono per gruppo.
    private static Dictionary<string, int> CartelliPerLinea(params string[] gruppiInOrdine)
    {
        var cartelli = new Coopfi.CartelliDellaLinea();
        var usciti = new Dictionary<string, int>();
        foreach (var gruppo in gruppiInOrdine)
        {
            if (cartelli.Salta(gruppo))
                continue;
            usciti[gruppo] = usciti.GetValueOrDefault(gruppo) + 1;
        }
        return usciti;
    }

    private static string[] Linea(string gruppo, int referenze) => Enumerable.Repeat(gruppo, referenze).ToArray();

    [Fact]
    public void Una_linea_da_25_referenze_da_esattamente_10_cartelli()
    {
        Assert.Equal(10, CartelliPerLinea(Linea("L25", 25))["L25"]);
        Assert.Equal(10, Coopfi.CartelliDellaLinea.Massimo);
    }

    [Fact]
    public void Una_linea_da_10_referenze_ne_da_10()
    {
        Assert.Equal(10, CartelliPerLinea(Linea("L10", 10))["L10"]);
    }

    [Fact]
    public void Ogni_linea_ha_i_suoi_10_cartelli()
    {
        var usciti = CartelliPerLinea(Linea("A", 15).Concat(Linea("B", 15)).ToArray());

        Assert.Equal(10, usciti["A"]);
        Assert.Equal(10, usciti["B"]);
    }

    [Fact]
    public void Le_referenze_della_linea_non_consecutive_contano_per_la_stessa_linea()
    {
        var usciti = CartelliPerLinea(Linea("A", 6).Concat(Linea("B", 3)).Concat(Linea("A", 9)).ToArray());

        Assert.Equal(10, usciti["A"]);
        Assert.Equal(3, usciti["B"]);
    }

    [Fact]
    public void EsportaPoP_salta_oltre_il_decimo_solo_nelle_linee_da_10_in_su()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string esporta = coop.Substring(inizio, fine - inizio);

        Assert.Contains("CartelliDellaLinea cartelliDellaLinea = new CartelliDellaLinea();", esporta);
        int salto = esporta.IndexOf("if (isLineaMaggioreUguale10 && cartelliDellaLinea.Salta(codice_gruppo))", StringComparison.Ordinal);
        Assert.True(salto > esporta.IndexOf("bool isLineaMaggioreUguale10 = (codiceBox == \"BOX_LINEA\" && listaDelGruppo.Count >= 10);", StringComparison.Ordinal));
        // Prima del separatore di reparto, che si aggiunge con la prima referenza che esce.
        Assert.True(salto < esporta.IndexOf("if (reparto != curr_reparto)", StringComparison.Ordinal));

        // Sotto i 10 non cambia niente: cartelli singoli (BOX_STD) e il sottogruppo, che e' il cartello linea.
        Assert.Contains("if (!isLineaMaggioreUguale10)", esporta);
        Assert.Contains("if (!eludi && codice_gruppo != codice_referenza && !isLineaMaggioreUguale10)", esporta);
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
