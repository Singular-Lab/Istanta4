using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1093: nell'esportazione PoP Coop ogni referenza di un gruppo esce con il suo cartello, fino al
/// numero di codici del gruppo. Il conteggio riparte a ogni cambio di gruppo: prima continuava dal
/// gruppo precedente, e con due gruppi consecutivi una referenza del secondo veniva saltata.
/// </summary>
public class PopCoopContatoreGruppiTests
{
    // Il ciclo di esportaPoP ridotto al contatore: le referenze singole (codice = codice gruppo) non
    // passano dal contatore, quelle di un gruppo si saltano quando il contatore lo dice.
    private static List<string> Esportate(params (string referenza, string gruppo)[] lista)
    {
        var contatore = new Coopfi.ContatoreDelGruppo();
        var esportate = new List<string>();
        foreach (var (referenza, gruppo) in lista)
        {
            if (referenza != gruppo && contatore.Salta(gruppo))
                continue;
            esportate.Add(referenza);
        }
        return esportate;
    }

    [Fact]
    public void Due_gruppi_consecutivi_della_stessa_dimensione_escono_tutti()
    {
        var esportate = Esportate(("101", "101,102"), ("102", "101,102"), ("201", "201,202"), ("202", "201,202"));

        Assert.Equal(new[] { "101", "102", "201", "202" }, esportate);
    }

    [Fact]
    public void Un_gruppo_piu_grande_dopo_uno_piu_piccolo_esce_tutto()
    {
        var esportate = Esportate(("101", "101,102"), ("102", "101,102"), ("201", "201,202,203"), ("202", "201,202,203"), ("203", "201,202,203"));

        Assert.Equal(new[] { "101", "102", "201", "202", "203" }, esportate);
    }

    [Fact]
    public void Un_gruppo_solo_esce_come_prima()
    {
        Assert.Equal(new[] { "101", "102", "103" }, Esportate(("101", "101,102,103"), ("102", "101,102,103"), ("103", "101,102,103")));
    }

    [Fact]
    public void Un_gruppo_con_piu_righe_che_codici_salta_quelle_in_eccesso()
    {
        // Come prima: al piu' tante referenze quanti sono i codici del gruppo.
        var esportate = Esportate(("101", "101,102"), ("102", "101,102"), ("102", "101,102"));

        Assert.Equal(new[] { "101", "102" }, esportate);
    }

    [Fact]
    public void Le_referenze_singole_in_mezzo_non_cambiano_il_conteggio()
    {
        var esportate = Esportate(("101", "101,102"), ("102", "101,102"), ("300", "300"), ("201", "201,202"), ("202", "201,202"), ("400", "400"));

        Assert.Equal(new[] { "101", "102", "300", "201", "202", "400" }, esportate);
    }

    [Fact]
    public void EsportaPoP_conta_con_il_contatore_del_gruppo()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string esporta = fine > inizio ? coop.Substring(inizio, fine - inizio) : coop.Substring(inizio);

        Assert.Contains("ContatoreDelGruppo contatoreDelGruppo = new ContatoreDelGruppo();", esporta);
        Assert.Contains("if (contatoreDelGruppo.Salta(codice_gruppo))", esporta);
        Assert.DoesNotContain("contaRefGruppo", coop);
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
