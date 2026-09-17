using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Spazio riservato attorno alle foto dal fixFoto, espresso per lato come i post
/// ridimensionamenti: numeri o etichette del box. Viaggia nel SourceFrameworkCss.
/// </summary>
public class EstensioniFotoTests
{
    [Fact]
    public void Un_box_senza_estensioni_le_legge_assenti()
    {
        var box = JsonConvert.DeserializeObject<modificheCssBox>("{\"nomiBox\":[\"BOX1\"]}");

        Assert.Null(box!.estensioniFoto);
    }

    [Fact]
    public void Le_estensioni_si_leggono_per_lato_con_espressioni_su_etichetta()
    {
        const string json = "{\"nomiBox\":[\"BOX41\"],\"estensioniFoto\":{\"alto\":null,\"sinistra\":\"2\","
            + "\"basso\":\"sy_ombra*[H][50%]\",\"destra\":null}}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        Assert.NotNull(box!.estensioniFoto);
        Assert.Null(box.estensioniFoto!.alto);
        Assert.Equal("2", box.estensioniFoto.sinistra);
        Assert.Equal("sy_ombra*[H][50%]", box.estensioniFoto.basso);
        Assert.Null(box.estensioniFoto.destra);
    }

    [Fact]
    public void Un_salvataggio_non_perde_le_estensioni()
    {
        var originale = new modificheCssBox
        {
            nomiBox = new List<string> { "BOX41" },
            estensioniFoto = new EstensioniFotoObj { basso = "sy_ombra*[H][50%]", destra = "1.5" }
        };

        var riletto = JsonConvert.DeserializeObject<modificheCssBox>(JsonConvert.SerializeObject(originale));

        Assert.Equal("sy_ombra*[H][50%]", riletto!.estensioniFoto!.basso);
        Assert.Equal("1.5", riletto.estensioniFoto.destra);
        Assert.Null(riletto.estensioniFoto.alto);
    }

    /// <summary>
    /// Nel BOX41 di Edro21 l'ombra sporge sotto la foto di meta' della propria altezza:
    /// senza questa regola il fixFoto la farebbe finire sulla descrizione.
    /// </summary>
    [Fact]
    public void Il_box41_di_Edro21_riserva_sotto_la_foto_meta_dell_altezza_dell_ombra()
    {
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaSorgenteEdro21()));

        var boxConRegola = root!.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .SelectMany(m => m.operazioniPerBox)
            .Where(op => op.nomiBox.Contains("BOX41"))
            .ToList();

        Assert.NotEmpty(boxConRegola);
        Assert.All(boxConRegola, box =>
        {
            Assert.NotNull(box.estensioniFoto);
            Assert.Equal("sy_ombra*[H][50%]", box.estensioniFoto!.basso);
            Assert.True(string.IsNullOrEmpty(box.estensioniFoto.alto));
            Assert.True(string.IsNullOrEmpty(box.estensioniFoto.sinistra));
            Assert.True(string.IsNullOrEmpty(box.estensioniFoto.destra));
        });
    }

    [Fact]
    public void Gli_altri_box_di_Edro21_non_riservano_spazio()
    {
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaSorgenteEdro21()));

        var altriBox = root!.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .SelectMany(m => m.operazioniPerBox)
            .Where(op => !op.nomiBox.Contains("BOX41"));

        Assert.All(altriBox, box => Assert.Null(box.estensioniFoto));
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json";

        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
