using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1117: le info rapide della finestra "Info dati referenza" del Plugin. Ogni voce di
/// infoRapide nel SourceCustomPlugin del cliente dice da quale campo del record del tracciato
/// prende il valore (pluginMiddleware.aggiungiInfoRapidaVisioneDelDato). In Edro21 la voce
/// Sezione aveva la chiave null: compariva sempre vuota, mentre con "Vedi tutto" il campo
/// sezione aveva il suo valore.
/// </summary>
public class InfoRapideTests
{
    private static JArray InfoRapide(string cliente) =>
        (JArray)JObject.Parse(File.ReadAllText(
            DllAgenziaLibTests.TrovaFile($"Istanta/wwwroot/external_source/{cliente}/SourceCustomPlugin.json")))["infoRapide"]!;

    [Fact]
    public void In_Edro21_la_sezione_si_legge_dal_campo_sezione()
    {
        var sezione = Assert.Single(InfoRapide("Edro21"), voce => (string?)voce["label"] == "Sezione");

        Assert.Equal("sezione", (string?)sezione["keyInRecordInTracciato"]);
    }

    [Theory]
    [InlineData("Coopfi")]
    [InlineData("Edro21")]
    [InlineData("Famila")]
    public void Nessuna_info_rapida_e_senza_campo(string cliente)
    {
        var senzaCampo = InfoRapide(cliente)
            .Where(voce => string.IsNullOrWhiteSpace((string?)voce["keyInRecordInTracciato"]))
            .Select(voce => (string?)voce["label"])
            .ToArray();

        Assert.Empty(senzaCampo);
    }
}
