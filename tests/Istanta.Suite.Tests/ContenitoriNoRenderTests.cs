using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Contenitori del noRender: l'agenzia dichiara nel SourceCustomPlugin, per un campo, il gruppo del
/// box che va nascosto con lui e che la segnalazione del Plugin indica quando manca insieme al campo.
/// Coop: txt_sconto sta nel gruppo box_sconto, e togliere lo sconto vuol dire togliere il gruppo.
/// La chiave deve stare nel modello AgenziaCustomPlugin, altrimenti il server la perde rileggendo e
/// riscrivendo la configurazione.
/// </summary>
public class ContenitoriNoRenderTests
{
    [Fact]
    public void Senza_la_chiave_non_ci_sono_contenitori()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}")!;

        Assert.NotNull(agenzia.contenitoriNoRender);
        Assert.Empty(agenzia.contenitoriNoRender);
    }

    [Fact]
    public void La_chiave_sopravvive_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"contenitoriNoRender\":{\"txt_sconto\":\"box_sconto\"}}")!;
        var riletta = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia))!;

        Assert.Equal("box_sconto", riletta.contenitoriNoRender["txt_sconto"]);
    }

    [Fact]
    public void Coop_dichiara_txt_sconto_nel_gruppo_box_sconto()
    {
        string file = DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json");
        var coop = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(file))!;

        Assert.Equal("box_sconto", coop.contenitoriNoRender["txt_sconto"]);
    }

    [Theory]
    [InlineData("Edro21")]
    [InlineData("Famila")]
    public void Le_altre_agenzie_non_dichiarano_contenitori(string cliente)
    {
        string file = DllAgenziaLibTests.TrovaFile($"Istanta/wwwroot/external_source/{cliente}/SourceCustomPlugin.json");
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(file))!;

        Assert.Empty(agenzia.contenitoriNoRender);
    }
}
