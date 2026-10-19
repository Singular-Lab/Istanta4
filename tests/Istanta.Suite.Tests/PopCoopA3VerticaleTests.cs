using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Tre regole del PoP Coop:
/// - nell'A3 verticale i Superprezzi ortofrutta (BOX_SuperprezziOF) non escono; prima (#211) vi uscivano
///   come BOX_STD. Negli altri formati restano col loro box;
/// - i Jolly evidenziati (BOX_JOLLY_EVIDENZIATO, tema VENDITE PROPOSITIVE) non escono in nessun formato,
///   come i temi jolly ed extra tripla; il tema sprint non esce negli A3 (negli A7 e' il cartello Sprint,
///   vedi PopCoopA7Tests);
/// - il prezzo di STD ha lo stile PREZZO_STD_SCONTO_PICCOLO solo quando lo sconto piccolo c'e' davvero;
///   prima lo prendeva con qualunque sconto sotto il 25%, anche zero e in ogni area. Nel 1+1 lo sconto
///   piccolo viene sempre tolto, e il prezzo resta PREZZO_PROMO.
/// </summary>
public class PopCoopA3VerticaleTests
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

    private static string Pop() => Tra(Sorgente(), "public TracciatoResultKit esportaPoP(", "public TracciatoResultKit esportaVolantino(");

    /* ---- Superprezzi esclusi dall'A3 verticale ---- */

    [Theory]
    [InlineData("BOX_SuperprezziOF", "A3_VERTICALI", true)]
    [InlineData("BOX_SuperprezziOF", "A3_ORIZZONTALI", false)]
    [InlineData("BOX_SuperprezziOF", "A7", false)]
    [InlineData("BOX_STD", "A3_VERTICALI", false)]
    [InlineData("BOX_1+1", "A3_VERTICALI", false)]
    public void Nell_A3_verticale_i_Superprezzi_non_escono(string box, string formato, bool esclusa)
    {
        Assert.Equal(esclusa, Coopfi.esclusaDalPoP("superprezzi of", box, formato));
    }

    [Fact]
    public void I_Superprezzi_non_si_convertono_piu_in_STD()
    {
        string coop = Sorgente();

        Assert.DoesNotContain("boxNelPoP", coop);
        Assert.DoesNotContain("recItem[key_codiceBox] = codiceBox;", Pop());
    }

    /* ---- Jolly evidenziati esclusi ---- */

    [Theory]
    [InlineData("vendite propositive", "BOX_JOLLY_EVIDENZIATO", true)]
    [InlineData("jolly", "BOX_JOLLY", true)]
    [InlineData("ex tripla", "BOX_STD", true)]
    [InlineData("superprezzi of", "BOX_SuperprezziOF", false)]
    [InlineData("", "BOX_STD", false)]
    public void Non_escono_jolly_extra_tripla_e_jolly_evidenziati(string tema, string box, bool esclusa)
    {
        //In ogni formato: qui il formato e' l'A3 orizzontale, dove i Superprezzi escono.
        Assert.Equal(esclusa, Coopfi.esclusaDalPoP(tema, box, "A3_ORIZZONTALI"));
        if (esclusa)
        {
            Assert.True(Coopfi.esclusaDalPoP(tema, box, "A3_VERTICALI"));
            Assert.True(Coopfi.esclusaDalPoP(tema, box, "A7"));
        }
    }

    [Fact]
    public void Il_tema_sprint_non_esce_negli_A3()
    {
        Assert.True(Coopfi.esclusaDalPoP("sprint", "BOX_SPRINT", "A3_ORIZZONTALI"));
        Assert.True(Coopfi.esclusaDalPoP("sprint", "BOX_SPRINT", "A3_VERTICALI"));
    }

    [Fact]
    public void L_esclusione_vale_in_tutti_e_tre_i_formati_del_PoP()
    {
        string filtro = Tra(Pop(), "if (formatoKit == \"A3_ORIZZONTALI\")", "var gruppo = tracciato.Where(");

        Assert.Equal(3, filtro.Split("if (esclusaDalPoP(tema, recItem[key_codiceBox].ToString(), formatoKit))").Length - 1);
        Assert.DoesNotContain("tema.Contains(\"jolly\")", filtro);
    }

    /* ---- stile del prezzo con lo sconto piccolo ---- */

    [Theory]
    [InlineData("A", 20, false, false, true)]
    [InlineData("A", 24.9, false, false, true)]
    [InlineData("A", 25, false, false, false)]
    [InlineData("A", 0, false, false, false)]
    [InlineData("B", 20, false, false, false)]
    [InlineData("A-", 20, false, false, false)]
    [InlineData("A", 20, true, false, false)]
    [InlineData("A", 20, false, true, false)]
    public void Lo_sconto_piccolo_c_e_solo_in_area_A_tra_0_e_25_senza_Toscana_ne_evento(string area, double sconto, bool toscana, bool evento, bool atteso)
    {
        Assert.Equal(atteso, Coopfi.scontoPiccoloNelPoP(area, (decimal)sconto, toscana, evento));
    }

    [Fact]
    public void Nello_STD_il_prezzo_ha_lo_stile_dello_sconto_piccolo_solo_con_lo_sconto_piccolo()
    {
        string pop = Pop();
        string std = Tra(pop, "if (codiceBox == \"BOX_STD\" /*|| codiceBox == \"BOX_SuperprezziOF\"*/)", "else if (codiceBox == \"BOX_1+1\")");
        string unoPiuUno = Tra(pop, "else if (codiceBox == \"BOX_1+1\")", "else if (codiceBox == \"BOX_SuperprezziOF\")");

        Assert.Contains("if (scontoPiccoloNelPoP(siglaAreaKit, sconto, speciale_toscana, contiene_evento_eccezionale))\n                            {\n                                stile_prezzo_promo = \"PREZZO_STD_SCONTO_PICCOLO\";", std);
        Assert.DoesNotContain("if (sconto < 25)", std);
        Assert.DoesNotContain("PREZZO_STD_SCONTO_PICCOLO", unoPiuUno);
        Assert.DoesNotContain("if (sconto < 25)", unoPiuUno);
    }

    [Fact]
    public void Il_volantino_non_cambia()
    {
        string volantino = Sorgente();
        volantino = volantino.Substring(volantino.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal));

        Assert.DoesNotContain("boxNelPoP(", volantino);
        Assert.DoesNotContain("esclusaDalPoP(", volantino);
        Assert.DoesNotContain("scontoPiccoloNelPoP(", volantino);
    }
}
