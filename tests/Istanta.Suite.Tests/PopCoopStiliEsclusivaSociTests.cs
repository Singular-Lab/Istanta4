using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop il BOX_ESCLUSIVA_SOCI ha stili suoi, in ogni area: lo sconto (txt_sconto) lo stile
/// di paragrafo SCONTO_SOCI_ESCLUSIVA, il prezzo (prezzo_promo) lo stile di paragrafo
/// PREZZO_PROMO_SOCI_ESCLUSIVA, il prezzo al kg (prezzo_promo_kgl) lo stile di carattere
/// PREZZO_PROMO_KGL_SOCI_ESCLUSIVA, che esportaPoP mette come tag attorno al testo. Prima usava gli
/// stili SOCI_DOPPIA, e PREZZO_PROMO_ESCLUSIVA_SOCI per il prezzo nelle aree A. Il volantino non cambia.
/// </summary>
public class PopCoopStiliEsclusivaSociTests
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

    private static string Pop() => Metodo(Sorgente(), "public TracciatoResultKit esportaPoP(", "public TracciatoResultKit esportaVolantino(");

    [Fact]
    public void Nel_PoP_lo_sconto_dell_esclusiva_soci_ha_SCONTO_SOCI_ESCLUSIVA()
    {
        string pop = Pop();

        Assert.Contains("if (codiceBox == \"BOX_ESCLUSIVA_SOCI\")\n                        stile_sconto_speciale = \"SCONTO_SOCI_ESCLUSIVA\";", pop);
        //E' lo stile di paragrafo con cui si assegna txt_sconto per l'esclusiva soci.
        Assert.Contains("interprete.assignCompiledField(\"txt_sconto\", stile_sconto_speciale, sconto_str);", pop);
    }

    [Fact]
    public void Nel_PoP_il_prezzo_dell_esclusiva_soci_ha_PREZZO_PROMO_SOCI_ESCLUSIVA_in_ogni_area()
    {
        string pop = Pop();
        string ramo = Metodo(pop, "else if (codiceBox == \"BOX_ESCLUSIVA_SOCI\")\n                    {\n                        stile_prezzo_promo = ", "interprete.assignCompiledField(\"prezzo_promo\", stile_prezzo_promo,");

        Assert.Contains("stile_prezzo_promo = \"PREZZO_PROMO_SOCI_ESCLUSIVA\";", ramo);
        Assert.DoesNotContain("siglaAreaKit", ramo);
        Assert.DoesNotContain("PREZZO_PROMO_SOCI_DOPPIA", ramo);
    }

    [Fact]
    public void Nel_PoP_il_prezzo_al_kg_dell_esclusiva_soci_e_nello_stile_di_carattere_PREZZO_PROMO_KGL_SOCI_ESCLUSIVA()
    {
        string pop = Pop();

        Assert.Contains("if (codiceBox == \"BOX_ESCLUSIVA_SOCI\")\n                    {\n                        //Nel PoP l'esclusiva soci ha i suoi stili: sconto e prezzo di paragrafo, prezzo al kg di carattere.\n                        stile_prezzo_promo_kgl = \"PREZZO_PROMO_KGL_SOCI_ESCLUSIVA\";", pop);
        //Lo stile SOCI_DOPPIA resta al solo prezzo al kg dei soci del doppio sconto (prezzo_promo_kgl_SOCI_DOPPIA).
        Assert.DoesNotContain("stile_prezzo_promo_kgl = \"PREZZO_PROMO_KGL_SOCI_DOPPIA\";", pop);
        //Lo stile del prezzo al kg e' un tag di carattere attorno al testo, con il paragrafo del riquadro.
        Assert.Contains("string prezzo_promo_kgl_str = $\"<{stile_prezzo_promo_kgl}>€ {MathExt.DecimalRoundToString(prezzo_promo_kgl)} {dic_prezzoInfoPack}</{stile_prezzo_promo_kgl}>\";", pop);
        Assert.Contains("interprete.assignCompiledField(\"prezzo_promo_kgl\", \"\", prezzo_promo_kgl_str);", pop);
    }

    [Fact]
    public void Il_volantino_tiene_gli_stili_dell_esclusiva_soci_di_prima()
    {
        string volantino = Metodo(Sorgente(), "public TracciatoResultKit esportaVolantino(", null);

        Assert.Contains("stile_sconto = \"SCONTO_ESCLUSIVA_SOCI\";", volantino);
        Assert.Contains("sty_pkgl = \"PREZZO_PROMO_KGL_ESCLUSIVA_SOCI\";", volantino);
        Assert.Contains("stile_prezzo_promo = \"PREZZO_PROMO_ESCLUSIVA_SOCI\";", volantino);
        Assert.DoesNotContain("SOCI_ESCLUSIVA", volantino);
    }
}
