using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1254: lo sconto stampato da Coop nelle aree B e B1 si arrotonda per difetto al multiplo di 5,
/// nel volantino e nel PoP. Prima si andava al multiplo piu' vicino con soglia 3 (33 faceva 35), e nel
/// PoP solo in B: in B1 il PoP non arrotondava. Nel volantino A e A- tengono la regola di prima; le
/// altre aree, e A e A- nel PoP, non arrotondano.
/// </summary>
public class ScontoStampatoCoopTests
{
    private static string Sorgente() =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");

    private static string Tra(string testo, string inizio, string fine)
    {
        int da = testo.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, inizio);
        int a = testo.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, fine);
        return testo.Substring(da, a - da);
    }

    /* ---- B e B1: per difetto al multiplo di 5 ---- */

    [Theory]
    [InlineData("B", false)]
    [InlineData("B1", false)]
    [InlineData("B", true)]
    [InlineData("B1", true)]
    public void Gli_esempi_della_issue_fanno_30_e_35_resta_35(string area, bool pop)
    {
        foreach (var sconto in new[] { 31m, 32m, 32.5m, 32.99m, 33m, 34.9m })
        {
            Assert.Equal(30m, Coopfi.scontoStampato(sconto, area, pop));
        }
        Assert.Equal(35m, Coopfi.scontoStampato(35m, area, pop));
    }

    [Theory]
    [InlineData(40, 40)]
    [InlineData(44.99, 40)]
    [InlineData(25, 25)]
    [InlineData(24.9, 20)]
    [InlineData(4.9, 0)]
    [InlineData(0, 0)]
    public void Multipli_esatti_restano_e_il_resto_va_per_difetto(double scontoDouble, double attesoDouble)
    {
        //InlineData non accetta decimal: si passano double e si convertono.
        decimal sconto = (decimal)scontoDouble;
        decimal atteso = (decimal)attesoDouble;
        Assert.Equal(atteso, Coopfi.scontoStampato(sconto, "B", pop: false));
        Assert.Equal(atteso, Coopfi.scontoStampato(sconto, "B1", pop: true));
    }

    /* ---- le altre aree ---- */

    [Theory]
    [InlineData("A")]
    [InlineData("A-")]
    public void Nel_volantino_A_e_A_meno_tengono_la_regola_di_prima(string area)
    {
        Assert.Equal(35m, Coopfi.scontoStampato(33m, area, pop: false));
        Assert.Equal(30m, Coopfi.scontoStampato(32m, area, pop: false));
        Assert.Equal(35m, Coopfi.scontoStampato(34.9m, area, pop: false));
    }

    [Theory]
    [InlineData("A", true)]
    [InlineData("A-", true)]
    [InlineData("C", false)]
    [InlineData("C", true)]
    public void Le_altre_aree_e_A_nel_PoP_non_arrotondano(string area, bool pop)
    {
        Assert.Equal(33m, Coopfi.scontoStampato(33m, area, pop));
        Assert.Equal(32.5m, Coopfi.scontoStampato(32.5m, area, pop));
    }

    /* ---- i punti del codice ---- */

    [Fact]
    public void Volantino_e_PoP_usano_la_stessa_regola()
    {
        string sorgente = Sorgente();
        string pop = Tra(sorgente, "public TracciatoResultKit esportaPoP(", "public TracciatoResultKit esportaVolantino(");
        string volantino = Tra(sorgente, "public TracciatoResultKit esportaVolantino(", "decimal sconto_soci = ");

        Assert.Contains("sconto = scontoStampato(sconto, siglaAreaKit, pop: true);", pop);
        Assert.Contains("sconto = scontoStampato(sconto, siglaAreaKit, pop: false);", volantino);
        //Il calcolo vecchio non resta da nessuna parte nelle due esportazioni.
        Assert.DoesNotContain("sconto % 5 < 3", pop);
        Assert.DoesNotContain("sconto % 5 < 3", volantino);
    }
}
