using System.Text.RegularExpressions;
using AgenziaLib;
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
