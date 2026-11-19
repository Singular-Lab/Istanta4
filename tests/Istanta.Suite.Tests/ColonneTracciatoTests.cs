using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-ff931e6d: una colonna del tracciato del Plugin (AgenziaCustomPlugin_ViewColonneTracciato) puo'
/// andare a capo fino a righeMassime righe; senza, su una riga, come prima. Edro21 la usa per la note
/// category, 5 righe. La proprieta' deve arrivare al Plugin: si legge e sopravvive al salvataggio.
/// </summary>
public class ColonneTracciatoTests
{
    [Fact]
    public void Una_colonna_senza_righeMassime_sta_su_una_riga()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"colonneTracciato\":[{\"name\":\"Tema\",\"chiaveDato\":\"tema\",\"percColonna\":60}]}");

        Assert.Equal(0, Assert.Single(agenzia!.colonneTracciato).righeMassime);
    }

    [Fact]
    public void righeMassime_si_legge_e_sopravvive_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"colonneTracciato\":[{\"name\":\"Note\",\"chiaveDato\":\"note_category\",\"percColonna\":120,\"righeMassime\":5}]}");
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));

        Assert.Equal(5, Assert.Single(riletto!.colonneTracciato).righeMassime);
    }

    [Fact]
    public void Edro21_mostra_la_note_category_su_5_righe_e_le_altre_colonne_come_prima()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json")));

        var note = Assert.Single(agenzia!.colonneTracciato, c => c.chiaveDato == "note_category");
        Assert.Equal(5, note.righeMassime);
        Assert.All(agenzia.colonneTracciato.Where(c => c != note), c => Assert.Equal(0, c.righeMassime));
    }
}
