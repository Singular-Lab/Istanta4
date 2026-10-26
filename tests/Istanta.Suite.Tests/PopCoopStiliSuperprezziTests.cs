using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Il PoP Coop non ha gli stili Superprezzi (_SP): per il BOX_SuperprezziOF la descrizione usa gli
/// stili normali e il prezzo al kg lo stile del riquadro. Con gli stili _SP, che nel documento PoP non
/// ci sono, la descrizione usciva con gli stili spostati. Il volantino li tiene.
/// </summary>
public class PopCoopStiliSuperprezziTests
{
    private static string Sorgente() =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");

    private static string Metodo(string coop, string firma, string? fine)
    {
        int inizio = coop.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, firma);
        int termine = fine == null ? coop.Length : coop.IndexOf(fine, inizio, StringComparison.Ordinal);
        return coop.Substring(inizio, termine - inizio);
    }

    [Fact]
    public void Nel_PoP_il_Superprezzi_non_usa_gli_stili_SP()
    {
        string coop = Sorgente();
        string pop = Metodo(coop, "public TracciatoResultKit esportaPoP(", "public TracciatoResultKit esportaVolantino(");

        Assert.DoesNotContain("+= \"_SP\";", pop);
        Assert.DoesNotContain("PREZZO_PROMO_KGL_SP", pop);
        //Il ramo del Superprezzi c'e' ancora, con il prezzo al kg allo stile del riquadro.
        Assert.Contains("else if (codiceBox == \"BOX_SuperprezziOF\")", pop);
        Assert.Contains("interprete.assignCompiledField(\"prezzo_promo_kgl\", \"\", MathExt.DecimalRoundToString(prezzo_promo_kgl));", pop);
    }

    [Fact]
    public void Nel_volantino_il_Superprezzi_tiene_gli_stili_SP()
    {
        string coop = Sorgente();
        string volantino = Metodo(coop, "public TracciatoResultKit esportaVolantino(", null);

        Assert.Contains("stileDescr1 += \"_SP\";", volantino);
        Assert.Contains("PREZZO_PROMO_KGL_SP", volantino);
    }
}
