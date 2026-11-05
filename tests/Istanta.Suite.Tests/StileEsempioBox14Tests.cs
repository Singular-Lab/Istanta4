using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-d4976be3: nel BOX14 di Edro21, il box delle mini collection, la descrizione di esempio
/// prendeva DES_descr_es come negli altri box, mentre gli altri stili della descrizione MC sono gia'
/// _MC (DES_descr_nome_MC...). Ora l'esempio del BOX14 ha DES_descr_es_MC, in ogni canale; gli altri
/// box restano come prima.
/// </summary>
public class StileEsempioBox14Tests
{
    private static readonly Dictionary<string, object> Record = new();

    [Theory]
    [InlineData("SS")]
    [InlineData("CN")]
    [InlineData("SC")]
    public void Nel_BOX14_l_esempio_ha_lo_stile_MC(string canale)
    {
        Assert.Equal("DES_descr_es_MC", AgenziaLib.Edro21.getStileEsempio(Record, canale, "BOX14"));
    }

    [Fact]
    public void Negli_altri_box_lo_stile_resta_quello_di_prima()
    {
        Assert.Equal("DES_descr_es", AgenziaLib.Edro21.getStileEsempio(Record, "SS", "BOX1"));
        Assert.Equal("A.DES_descr_es_SC", AgenziaLib.Edro21.getStileEsempio(Record, "SC", "BOX1"));
        Assert.Equal("DES_descr_es", AgenziaLib.Edro21.getStileEsempio(Record, "SS", ""));
    }
}
