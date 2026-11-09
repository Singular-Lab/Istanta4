using AgenziaLib;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1209: il logo CONAD della linea Armomia di Edro21 (conad_ArmoMia.psd). Esce solo se il brand
/// contiene CONAD e "armomia" sta fra le colonne del controllo (brand, descrizione 1, gusto), e nella
/// scelta del logo CONAD di linea viene per primo. Il server trova il file dalla sigla, uguale.
/// </summary>
public class LogoArmomiaEdro21Tests
{
    [Theory]
    [InlineData("CONAD ARMOMIA", "Detergente piatti", "limone")]
    [InlineData("CONAD", "Armomia detergente piatti", "limone")]
    [InlineData("Conad", "Detergente piatti", "armomia limone")]
    public void Con_brand_CONAD_e_Armomia_in_una_colonna_il_logo_esce(string brand, string desc1, string gusto)
    {
        Assert.True(LogoArmomiaEdro21.ConLogo(brand, desc1, gusto));
    }

    [Theory]
    // Armomia senza CONAD nel brand.
    [InlineData("ARMOMIA", "Detergente piatti", "limone")]
    [InlineData("MARCA X", "Armomia detergente", "limone")]
    // CONAD senza Armomia.
    [InlineData("CONAD", "Detergente piatti", "limone")]
    [InlineData("CONAD PIACERSI", "Yogurt", "bianco")]
    // Colonne vuote.
    [InlineData(null, null, null)]
    [InlineData("", "", "")]
    public void Senza_CONAD_o_senza_Armomia_il_logo_non_esce(string? brand, string? desc1, string? gusto)
    {
        Assert.False(LogoArmomiaEdro21.ConLogo(brand!, desc1!, gusto!));
    }

    [Fact]
    public void Nella_scelta_del_logo_CONAD_di_linea_Armomia_viene_per_primo()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Edro21.cs")).Replace("\r", "");
        var inizio = sorgente.IndexOf("protected Dictionary<string, string> getLoghiEBolliNew(", StringComparison.Ordinal);
        Assert.True(inizio > 0, "getLoghiEBolliNew non c'e' piu'");
        var catena = sorgente.IndexOf("if (brand.Contains(\"conad\"))", inizio, StringComparison.Ordinal);
        Assert.True(catena > 0, "la scelta del logo CONAD di linea non c'e' piu'");

        var armomia = sorgente.IndexOf("if (LogoArmomiaEdro21.ConLogo(brand, desc1, gusto))", catena, StringComparison.Ordinal);
        var biologico = sorgente.IndexOf("prodotto_conad = \"conad_bio\";", catena, StringComparison.Ordinal);
        Assert.True(armomia > 0 && armomia < biologico, "Armomia deve venire prima degli altri loghi di linea");
        Assert.Contains("prodotto_conad = LogoArmomiaEdro21.Sigla;", sorgente.Substring(armomia, biologico - armomia));
    }

    [Fact]
    public void La_sigla_e_quella_registrata_in_SourceLoghiBolli()
    {
        var loghi = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceLoghiBolli.json")));
        var voce = loghi["source"]!.Children<JObject>().SingleOrDefault(l => (string?)l["sigla"] == LogoArmomiaEdro21.Sigla);

        Assert.NotNull(voce);
        Assert.Equal("conad_ArmoMia.psd", (string?)voce!["nome"]);
        Assert.Equal(3, (int)voce["tipo"]!);
    }
}
