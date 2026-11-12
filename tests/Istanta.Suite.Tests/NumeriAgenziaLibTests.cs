using System.Globalization;
using System.Text.RegularExpressions;
using AgenziaLib;
using Istanta.Models;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-13e871a5: i numeri dei record letti allo stesso modo in ogni cultura, anche in AgenziaLib. Le
/// esportazioni impostano it-IT sul thread e le altre chiamate arrivano in en-GB: ToDecimal leggeva
/// "0.25" come 25 nella prima e "2,87" come 287 nella seconda. AgenziaLib ha la sua copia della lettura
/// (NumeriSenzaCultura) perche' la DLL si distribuisce da sola: qui si tiene uguale a quella di Istanta.
/// </summary>
public class NumeriAgenziaLibTests : IDisposable
{
    private readonly CultureInfo _culturaDiPrima = CultureInfo.CurrentCulture;

    public void Dispose() => CultureInfo.CurrentCulture = _culturaDiPrima;

    public static IEnumerable<object[]> Culture() => new[] { new object[] { "it-IT" }, new object[] { "en-GB" } };

    [Theory]
    [MemberData(nameof(Culture))]
    public void ToDecimal_legge_virgola_e_punto_come_decimali(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        Assert.Equal(2.87m, "2,87".ToDecimal());
        Assert.Equal(2.87m, "2.87".ToDecimal());
        Assert.Equal(0.25m, "0.25".ToDecimal());
        Assert.Equal(0.25m, "0,25".ToDecimal());
        Assert.Equal(1234.5m, "1.234,5".ToDecimal());
        Assert.Equal(1234.5m, "1,234.5".ToDecimal());
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void ToDecimal_resta_com_era_sugli_altri_valori(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        Assert.Equal(2.87m, 2.87.ToDecimal());
        Assert.Equal(2.87m, 2.87m.ToDecimal());
        Assert.Equal(0m, "".ToDecimal());
        Assert.Equal(0m, "ORTOFRUTTA".ToDecimal());
        //Come prima: ToDecimal legge solo double, decimal, float e testo.
        Assert.Equal(0m, 3.ToDecimal());
    }

    public static IEnumerable<object?[]> Casi() => new[]
    {
        new object?[] { "0.25" }, new object?[] { "0,25" }, new object?[] { " 2,87 " }, new object?[] { "1.234,5" },
        new object?[] { "1,234.5" }, new object?[] { "33" }, new object?[] { "-1,5" }, new object?[] { "" },
        new object?[] { "ORTOFRUTTA" }, new object?[] { "1.2.3" }, new object?[] { null }, new object?[] { true },
        new object?[] { 0.25 }, new object?[] { 0.25m }, new object?[] { 0.25f }, new object?[] { 33 }, new object?[] { 33L },
        new object?[] { double.NaN }, new object?[] { new JValue("0,25") }, new object?[] { new JValue(1.5) }
    };

    [Theory]
    [MemberData(nameof(Casi))]
    public void Le_due_copie_della_lettura_danno_lo_stesso_risultato(object? valore)
    {
        foreach (var cultura in new[] { "it-IT", "en-GB" })
        {
            CultureInfo.CurrentCulture = new CultureInfo(cultura);

            bool istanta = NumeroDiRegola.TryLeggi(valore, out double numeroIstanta);
            bool agenzia = NumeriSenzaCultura.TryLeggi(valore, out double numeroAgenzia);
            Assert.Equal(istanta, agenzia);
            Assert.Equal(numeroIstanta, numeroAgenzia);

            bool istantaDec = NumeroDiRegola.TryLeggiDecimale(valore, out decimal decIstanta);
            bool agenziaDec = NumeriSenzaCultura.TryLeggiDecimale(valore, out decimal decAgenzia);
            Assert.Equal(istantaDec, agenziaDec);
            Assert.Equal(decIstanta, decAgenzia);
        }
    }

    /* ---- guardia: nessuna nuova lettura numerica che dipenda dalla cultura ---- */

    private static readonly Regex LetturaNumerica = new Regex(
        @"\b(?:double|decimal|float|Double|Decimal|Single)\.(?:TryParse|Parse)\(|Convert\.To(?:Double|Decimal|Single)\(");

    [Fact]
    public void Nessuna_lettura_numerica_dipende_dalla_cultura_del_thread()
    {
        var radice = Path.GetDirectoryName(Path.GetDirectoryName(DllAgenziaLibTests.TrovaFile("Istanta/Istanta.csproj")))!;
        var trovate = new List<string>();
        foreach (var progetto in new[] { "Istanta", "IstantaLib", "AgenziaLib" })
        {
            foreach (var file in Directory.EnumerateFiles(Path.Combine(radice, progetto), "*.cs", SearchOption.AllDirectories))
            {
                var relativo = Path.GetRelativePath(radice, file).Replace('\\', '/');
                if (relativo.Contains("/obj/") || relativo.Contains("/bin/") || relativo.Contains("/Migrations/"))
                {
                    continue;
                }
                var righe = File.ReadAllLines(file);
                for (int i = 0; i < righe.Length; i++)
                {
                    var riga = righe[i].Trim();
                    if (riga.StartsWith("//"))
                    {
                        continue;
                    }
                    int commento = riga.IndexOf("//", StringComparison.Ordinal);
                    var codice = commento >= 0 ? riga.Substring(0, commento) : riga;
                    if (!LetturaNumerica.IsMatch(codice))
                    {
                        continue;
                    }
                    //Ammesse: la lettura invariante (le due copie di NumeroDiRegola, Famila col testo gia'
                    //normalizzato) e la conversione di un numero, che non ha cultura.
                    if (codice.Contains("CultureInfo.InvariantCulture") || codice.Contains("Math.Pow("))
                    {
                        continue;
                    }
                    trovate.Add(relativo + ":" + (i + 1) + "  " + riga);
                }
            }
        }

        Assert.True(trovate.Count == 0, "Letture numeriche nella cultura del thread: usare NumeroDiRegola (Istanta) o NumeriSenzaCultura (AgenziaLib).\n" + string.Join("\n", trovate));
    }

    [Fact]
    public void L_importazione_e_le_regole_usano_la_lettura_senza_cultura()
    {
        string Sorgente(string file) => File.ReadAllText(DllAgenziaLibTests.TrovaFile(file)).Replace("\r", "");

        //Importazione dei tracciati: i campi decimali dello schema e quelli del file.
        var tracciati = Sorgente("Istanta/Controllers/TracciatiController.cs");
        Assert.Contains("NumeroDiRegola.TryLeggiDecimale(_val, out _decVal);", tracciati);
        Assert.Contains("NumeroDiRegola.TryLeggiDecimale(campo.Value, out dc_val)", tracciati);
        //Regole dei box (CssFramework) e dei filtri.
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        Assert.DoesNotContain("CultureInfo.GetCultureInfo(\"it-IT\"), out float", menabo);
        //Il confronto delle regole dei filtri (CompareValue); quello delle regole di impaginazione automatica e' stato tolto con il menabo' web.
        Assert.Contains("NumeroDiRegola.TryLeggi(datoStr, out double datoValue)", menabo);
        //AgenziaLib: ToDecimal passa da NumeriSenzaCultura.
        var utility = Sorgente("AgenziaLib/Utility.cs");
        Assert.Contains("NumeriSenzaCultura.TryLeggiDecimale(obj.ToString(), out d);", utility);
    }
}
