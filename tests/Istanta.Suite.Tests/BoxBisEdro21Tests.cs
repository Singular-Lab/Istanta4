using System.Text.RegularExpressions;
using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I box bis di Edro21 (BOX7, meccaniche NM) non hanno il riquadro sconto_effettivo_grande, ma
/// l'export del volantino lo forniva fra i campi compilati come per i box che lo hanno: il Plugin
/// lo cercava nel box e lo segnalava come mancante a ogni apertura della scheda e in ogni Report
/// Integrita'. La regola sta in BoxBisEdro21 e il ramo BOX7 di esportaVolantino la rispetta.
/// </summary>
public class BoxBisEdro21Tests
{
    [Theory]
    [InlineData("BOX7")]
    [InlineData("box7")]
    [InlineData(" BOX7 ")]
    public void Il_box_bis_non_prevede_sconto_effettivo_grande(string codiceBox)
    {
        Assert.False(BoxBisEdro21.PrevedeScontoEffettivoGrande(codiceBox));
    }

    [Theory]
    [InlineData("BOX1")]
    [InlineData("BOX12")]
    [InlineData("BOX6")]
    [InlineData("BOX40")]
    [InlineData("BOX41")]
    [InlineData("BOX4")]
    [InlineData("BOX14")]
    [InlineData("BOX2")]
    [InlineData("BOX62")]
    [InlineData("BOX70")]
    [InlineData("")]
    [InlineData(null)]
    public void Gli_altri_box_lo_prevedono_come_prima(string? codiceBox)
    {
        Assert.True(BoxBisEdro21.PrevedeScontoEffettivoGrande(codiceBox));
    }

    [Fact]
    public void Il_ramo_BOX7_dell_export_del_volantino_passa_dalla_regola()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "");
        var inizio = sorgente.IndexOf("else if (codiceBox == \"BOX7\")", StringComparison.Ordinal);
        Assert.True(inizio > 0, "il ramo BOX7 non c'e' piu'");
        var fine = sorgente.IndexOf("else if (codiceBox == \"BOX14\")", inizio, StringComparison.Ordinal);
        var ramo = sorgente.Substring(inizio, fine - inizio);

        // Il campo si assegna solo se il box lo prevede, e il box bis non lo prevede.
        Assert.Matches(new Regex(@"if \(BoxBisEdro21\.PrevedeScontoEffettivoGrande\(codiceBox\)\)\s*\{\s*paragraphName = GetStileForField\([^;]*""sconto_effettivo_grande""[^;]*\);\s*interprete\.assignCompiledField\(""sconto_effettivo_grande"""), ramo);
        // Gli altri campi del box bis restano.
        Assert.Contains("assignCompiledField(\"campo_offerta_KgL_sconto\"", ramo);
        Assert.Contains("assignCompiledField(\"PezzConf_NM\"", ramo);
        Assert.Contains("assignCompiledField(\"M_MM\"", ramo);
    }
}

/// <summary>
/// I20-1134: nelle meccaniche BIS (canali SS, CN, CY) e 1+1 (canale SC) di Edro21, tutte NM_, il box
/// mostra al massimo due foto. L'export del volantino metteva in membriGruppoFoto tutte le secondarie
/// selezionate del gruppo e il Plugin creava una cornice per ognuna: il gruppo San Benedetto della
/// issue usciva con tre bottiglie. FotoMeccanicaBisEdro21 tiene la primaria e la prima secondaria.
/// </summary>
public class FotoMeccanicaBisEdro21Tests
{
    private static FotoElementoGruppo Membro(string codRef, byte stato) =>
        new FotoElementoGruppo { codRef = codRef, nomeFoto = codRef + ".psd", statoSelezione = stato, hash = "h" + codRef };

    private static string Codici(List<FotoElementoGruppo> membri) => string.Join(",", membri.Select(m => m.codRef + ":" + m.statoSelezione));

    [Theory]
    [InlineData("NM_MM")]
    [InlineData("NM_MIX_MM")]
    [InlineData("NM_FID")]
    [InlineData("NM_MIX_FID")]
    public void Nel_BIS_e_nell_1_1_restano_la_primaria_e_la_prima_secondaria(string meccanica)
    {
        var membri = new List<FotoElementoGruppo> { Membro("100", 1), Membro("101", 2), Membro("102", 2) };

        Assert.Equal("100:1,101:2", Codici(FotoMeccanicaBisEdro21.Limita(membri, meccanica)));
        // La lista di partenza non si tocca.
        Assert.Equal(3, membri.Count);
    }

    [Fact]
    public void La_primaria_resta_anche_se_viene_dopo_le_secondarie()
    {
        var membri = new List<FotoElementoGruppo> { Membro("101", 2), Membro("102", 2), Membro("100", 1) };

        Assert.Equal("101:2,100:1", Codici(FotoMeccanicaBisEdro21.Limita(membri, "NM_MM")));
    }

    [Fact]
    public void Con_due_foto_o_meno_nel_BIS_non_cambia_niente()
    {
        Assert.Equal("100:1,101:2", Codici(FotoMeccanicaBisEdro21.Limita(new List<FotoElementoGruppo> { Membro("100", 1), Membro("101", 2) }, "NM_MM")));
        Assert.Equal("100:1", Codici(FotoMeccanicaBisEdro21.Limita(new List<FotoElementoGruppo> { Membro("100", 1) }, "NM_MM")));
        Assert.Empty(FotoMeccanicaBisEdro21.Limita(new List<FotoElementoGruppo>(), "NM_MM"));
    }

    [Theory]
    [InlineData("TAGLIO_PREZZO")]
    [InlineData("PERCENTO_MM")]
    [InlineData("")]
    [InlineData(null)]
    public void Le_altre_meccaniche_tengono_tutte_le_foto(string? meccanica)
    {
        var membri = new List<FotoElementoGruppo> { Membro("100", 1), Membro("101", 2), Membro("102", 2) };

        Assert.Equal("100:1,101:2,102:2", Codici(FotoMeccanicaBisEdro21.Limita(membri, meccanica)));
    }

    [Fact]
    public void Una_lista_nulla_resta_nulla()
    {
        Assert.Null(FotoMeccanicaBisEdro21.Limita(null!, "NM_MM"));
    }

    [Fact]
    public void L_export_del_volantino_passa_le_foto_del_gruppo_dalla_regola()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "");

        Assert.Matches(new Regex(@"List<FotoElementoGruppo> membriGruppoFoto = FotoMeccanicaBisEdro21\.Limita\(\s*RefsHelper\.getFotoSecondarieDelGruppo\(myGroupFiltered\), recItem\[key_combinazioneAssegnata\]\?\.ToString\(\)\);\s*recItem\[GLOBAL_VARIABLES_FICO\.keyMembriGruppoFoto\] = membriGruppoFoto;"), sorgente);
    }
}
