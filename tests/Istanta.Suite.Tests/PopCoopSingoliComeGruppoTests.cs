using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop, in tutti i formati, i gruppi del settore 58 con reparto 02, 03, 04, 05, 06 o 08 e del
/// settore 56 con reparto 03 o 04 hanno i cartelli singoli per intero uguali al cartello di gruppo: campi
/// compilati e tolti (descrizione, prezzi, sconti...), box e loghi, senza dati misti. Il cartello di gruppo
/// resta. Del singolo restano l'identita' e l'anagrafica grezza della referenza. Il volantino non cambia.
/// </summary>
public class PopCoopSingoliComeGruppoTests
{
    [Theory]
    [InlineData("58", "02", true)]
    [InlineData("58", "03", true)]
    [InlineData("58", "04", true)]
    [InlineData("58", "05", true)]
    [InlineData("58", "06", true)]
    [InlineData("58", "08", true)]
    [InlineData("58", "8", true)]
    [InlineData(" 58 ", "3", true)]
    [InlineData("58", "01", false)]
    [InlineData("58", "07", false)]
    [InlineData("56", "03", true)]
    [InlineData("56", "04", true)]
    [InlineData("56", "02", false)]
    [InlineData("56", "05", false)]
    [InlineData("62", "03", false)]
    [InlineData("", "03", false)]
    [InlineData("58", "", false)]
    [InlineData(null, null, false)]
    public void La_regola_vale_per_settore_58_e_56_con_i_loro_reparti(string? settore, string? reparto, bool vale)
    {
        Assert.Equal(vale, Coopfi.singoliComeIlGruppo(settore, reparto));
    }

    private static Dictionary<string, object> Cartello(string prezzo, string descrizione, string box, params string[] loghi) => new()
    {
        ["Referenza.Codice"] = "GRUPPO",
        ["prezzo_promo"] = prezzo,
        ["codiceBox"] = box,
        ["compiledFields"] = new List<Dictionary<string, string>>
        {
            new() { ["label"] = "prezzo_promo", ["content"] = "€ " + prezzo },
            new() { ["label"] = "descrizione", ["content"] = descrizione }
        },
        ["deletedFields"] = new List<string> { "sconto_piccolo" },
        ["Foto.ExtraAuto"] = loghi.Select(l => new Dictionary<string, string> { ["sigla"] = l }).ToList(),
    };

    [Fact]
    public void Il_singolo_prende_per_intero_campi_box_e_loghi_del_cartello_di_gruppo()
    {
        var gruppo = Cartello("2,99", "<DESCRIZIONE_TITOLO>Bistecche di bovino</DESCRIZIONE_TITOLO>", "BOX_STD", "logo_dop");
        var singolo = Cartello("3,99", "<DESCRIZIONE_TITOLO>Bistecca di scamone</DESCRIZIONE_TITOLO>", "BOX_1+1", "logo_igp", "logo_bio");
        singolo["Referenza.Codice"] = "123";
        singolo["Foto.Extra"] = new List<string> { "logo_cliente.ai" };

        Coopfi.ripetiIlCartelloDiGruppo(singolo, gruppo);

        var campi = (List<Dictionary<string, string>>)singolo["compiledFields"];
        Assert.Equal("€ 2,99", campi[0]["content"]);
        Assert.Contains("Bistecche di bovino", campi[1]["content"]);
        Assert.Equal(new List<string> { "sconto_piccolo" }, singolo["deletedFields"]);
        Assert.Equal("BOX_STD", singolo["codiceBox"]);
        Assert.Equal(new[] { "logo_dop" }, ((List<Dictionary<string, string>>)singolo["Foto.ExtraAuto"]).Select(l => l["sigla"]));
        //Il gruppo non ha foto extra: non restano quelle del singolo.
        Assert.False(singolo.ContainsKey("Foto.Extra"));

        //Identita' e anagrafica grezza del singolo restano sue.
        Assert.Equal("123", singolo["Referenza.Codice"]);
        Assert.Equal("3,99", singolo["prezzo_promo"]);
    }

    [Fact]
    public void Il_singolo_non_condivide_le_liste_col_cartello_di_gruppo()
    {
        var gruppo = Cartello("2,99", "Bistecche", "BOX_STD", "logo_dop");
        var singolo = Cartello("3,99", "Scamone", "BOX_STD");

        Coopfi.ripetiIlCartelloDiGruppo(singolo, gruppo);
        ((List<Dictionary<string, string>>)singolo["compiledFields"])[0]["content"] = "modificato";

        Assert.Equal("€ 2,99", ((List<Dictionary<string, string>>)gruppo["compiledFields"])[0]["content"]);
        Assert.NotSame(gruppo["Foto.ExtraAuto"], singolo["Foto.ExtraAuto"]);
    }

    private static string Sorgente() =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");

    [Fact]
    public void Il_PoP_tiene_da_parte_il_cartello_di_gruppo_e_lo_ripete_alla_fine_del_singolo()
    {
        string coop = Sorgente();
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        string pop = coop.Substring(inizio, coop.IndexOf("public TracciatoResultKit esportaVolantino(", inizio, StringComparison.Ordinal) - inizio);

        int creato = pop.IndexOf("_cacheSottogruppi.Add(codice_gruppo);\n                            _cartelliDiGruppo[codice_gruppo] = artInKit.sottogruppo;", StringComparison.Ordinal);
        Assert.True(creato > 0);

        int copia = pop.IndexOf("ripetiIlCartelloDiGruppo(recItem, cartelloDiGruppo);", StringComparison.Ordinal);
        Assert.True(copia > creato);
        Assert.Contains("singoliComeIlGruppo(recItem.GetValueOrDefault(\"codice_settore\"), recItem.GetValueOrDefault(\"codice_reparto\"))", pop);
        //Dopo il ritorno a BOX_STD dei singoli delle linee, prima del nome del file e dell'uscita del record.
        Assert.True(copia > pop.IndexOf("recItem[GLOBAL_VARIABLES.codiceBox] = \"BOX_STD\";", StringComparison.Ordinal));
        Assert.True(copia < pop.IndexOf("result.liste[0].Records.Add(tracciato[i]);", StringComparison.Ordinal));
    }

    [Fact]
    public void Il_volantino_non_cambia()
    {
        string coop = Sorgente();
        string volantino = coop.Substring(coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal));

        Assert.DoesNotContain("ripetiIlCartelloDiGruppo(", volantino);
        Assert.DoesNotContain("singoliComeIlGruppo(", volantino);
    }
}
