using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Regole di agenzia degli A7 del PoP Coop:
/// - il tema sprint, escluso negli A3, negli A7 esce con il box BOX_SPRINT, qualunque box gli abbiano dato
///   le regole di assegnazione; descrizione con gli stili _SPRINT, txt_punti_sprint in PUNTI_SPRINT con
///   "1 BOLLINO" o "N BOLLINI", niente campo bollino, mastro ma-Sprint;
/// - lo sconto del BOX_LINEA, nei cartelli della linea e nel cartello di gruppo, ha lo stile
///   SCONTO_LINEA_STOPPER e il meno: "-30%". Gli altri box e gli A3 non cambiano.
/// </summary>
public class PopCoopA7Tests
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

    /* ---- il tema sprint ---- */

    [Fact]
    public void Negli_A7_il_tema_sprint_esce()
    {
        Assert.False(Coopfi.esclusaDalPoP("sprint", "BOX_SPRINT", "A7"));
        Assert.False(Coopfi.esclusaDalPoP("promo sprint autunno", "BOX_STD", "A7"));
        //Il resto dell'esclusione vale anche negli A7.
        Assert.True(Coopfi.esclusaDalPoP("jolly", "BOX_JOLLY", "A7"));
        Assert.True(Coopfi.esclusaDalPoP("vendite propositive", "BOX_JOLLY_EVIDENZIATO", "A7"));
    }

    [Theory]
    [InlineData("promo sprint autunno", "A7", "BOX_STD", "BOX_SPRINT")]
    [InlineData("sprint", "A7", "BOX_SPRINT", "BOX_SPRINT")]
    [InlineData("superprezzi", "A7", "BOX_SuperprezziOF", "BOX_SuperprezziOF")]
    [InlineData("sprint", "A3_ORIZZONTALI", "BOX_STD", "BOX_STD")]
    [InlineData("sprint", "A3_VERTICALI", "BOX_STD", "BOX_STD")]
    public void Negli_A7_il_tema_sprint_ha_il_box_BOX_SPRINT(string tema, string formato, string box, string atteso)
    {
        Assert.Equal(atteso, Coopfi.boxSprintNegliA7(tema, formato, box));
    }

    [Fact]
    public void Il_box_Sprint_si_assegna_al_record_dopo_l_esclusione_e_prima_del_gruppo()
    {
        string pop = Pop();
        int esclusione = pop.IndexOf("else if (formatoKit == \"A7\")", StringComparison.Ordinal);
        int box = pop.IndexOf("recItem[key_codiceBox] = boxSprintNegliA7(tema, formatoKit, recItem[key_codiceBox].ToString());", StringComparison.Ordinal);
        int gruppo = pop.IndexOf("var gruppo = tracciato.Where(", StringComparison.Ordinal);

        Assert.True(esclusione > 0 && box > esclusione, "dopo l'esclusione per formato");
        Assert.True(box < gruppo, "prima del gruppo: il cartello di gruppo copia il record");
        Assert.True(box < pop.IndexOf("var codiceBox = recItem[key_codiceBox].ToString();", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(1, "1 BOLLINO")]
    [InlineData(2, "2 BOLLINI")]
    [InlineData(3, "3 BOLLINI")]
    [InlineData(0, "0 BOLLINI")]
    public void La_dicitura_dei_bollini_e_al_singolare_solo_con_un_bollino(int bollini, string atteso)
    {
        Assert.Equal(atteso, Coopfi.scrittaBolliniSprint(bollini));
    }

    [Fact]
    public void Negli_A7_il_cartello_Sprint_ha_bollini_stili_e_mastro_propri()
    {
        string pop = Pop();
        string sprint = Tra(pop, "else if (codiceBox == \"BOX_SPRINT\")", "else if (codiceBox == \"BOX_SpendiPunti\")");
        string a7 = Tra(sprint, "if (formatoKit == \"A7\")", "else");

        Assert.Contains("interprete.assignCompiledField(\"txt_punti_sprint\", stile_punti_sprint, scrittaBolliniSprint(n_bonus));", a7);
        Assert.Contains("interprete.removeCompiledField(\"bollino\");", a7);
        foreach (var stile in new[] { "stileDescr1", "stileDescr2", "stileDescr3", "stileDescr4" })
        {
            Assert.Contains(stile + " += \"_SPRINT\";", a7);
        }
        Assert.DoesNotContain("_JOLLY", a7);
        Assert.Contains("string stile_punti_sprint = \"PUNTI_SPRINT\";", pop);

        string mastro = Tra(pop, "#region FORMATI_GESTIONE_DELLE_MASTRO_E_STILI", "#endregion");
        Assert.Contains("} else if (codiceBox == \"BOX_SPRINT\" && formatoKit == \"A7\") {\n                        interprete.assignCompiledField(GLOBAL_VARIABLES_FICO.compiledFieldKeyMastro, \"\", \"ma-Sprint\");", mastro);
    }

    /* ---- lo sconto del BOX_LINEA ---- */

    [Fact]
    public void Negli_A7_lo_sconto_della_linea_e_STOPPER_con_il_meno()
    {
        Assert.Equal(("SCONTO_LINEA_STOPPER", "-30%"), Coopfi.scontoDellaLineaNelPoP(30m, "A7"));
        Assert.Equal(("SCONTO_LINEA_STOPPER", "-25%"), Coopfi.scontoDellaLineaNelPoP(25.4m, "A7"));
    }

    [Theory]
    [InlineData("A3_ORIZZONTALI")]
    [InlineData("A3_VERTICALI")]
    public void Negli_A3_lo_sconto_della_linea_resta_com_era(string formato)
    {
        Assert.Equal(("SCONTO_LINEA", "30%"), Coopfi.scontoDellaLineaNelPoP(30m, formato));
    }

    [Fact]
    public void Lo_sconto_della_linea_passa_dalla_regola_nei_cartelli_e_nel_cartello_di_gruppo()
    {
        string pop = Pop();
        string linea = Tra(pop, "else if (codiceBox == \"BOX_LINEA\")\n                    {\n                        interprete.removeCompiledField(\"txt_punti_jolly\");", "else if (codiceBox == \"BOX_JOLLY\")");

        Assert.Contains("var scontoLinea = scontoDellaLineaNelPoP(sconto, formatoKit);\n                        interprete.assignCompiledField(\"txt_sconto\", scontoLinea.stile, scontoLinea.dicitura);", linea);
        Assert.Contains("var scontoLinea = scontoDellaLineaNelPoP(sconto, formatoKit);\n                                interpreteSottogruppo.assignCompiledField(\"txt_sconto\", scontoLinea.stile, scontoLinea.dicitura);", pop);
        //Nel PoP nessuno assegna piu' lo stile della linea per conto suo.
        Assert.DoesNotContain("\"SCONTO_LINEA\", sconto_str", pop);
    }
}
