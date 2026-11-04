using AgenziaLib;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-16f63122: in Edro21 il dato cancella un gruppo del box (Range_Punti_2,
/// prezzo_offerta_gruppo), ma i campi che stanno li' dentro (range2, tipo_punti2, punti2,
/// prezzo_offerta) restavano fra i campi compilati: l'interprete toglieva solo l'etichetta
/// cancellata. La scheda ref li segnalava come mancanti nel box. Ora l'agenzia dichiara i campi di
/// ogni gruppo (campiDeiContenitori del SourceCustomPlugin) e, cancellato il gruppo, i suoi campi
/// non si mandano. Senza dichiarazione tutto come prima.
/// </summary>
public class CampiDeiContenitoriTests
{
    private static readonly Dictionary<string, List<string>> ContenitoriEdro21 = new()
    {
        ["Range_Punti_2"] = new List<string> { "range2", "tipo_punti2", "punti2" },
        ["prezzo_offerta_gruppo"] = new List<string> { "prezzo_offerta", "sy_euro" },
    };

    private static CompiledFieldInterpreter ConPunti(Dictionary<string, List<string>>? contenitori)
    {
        var interprete = new CompiledFieldInterpreter();
        if (contenitori != null)
        {
            interprete.campiDeiContenitori = contenitori;
        }
        interprete.assignCompiledField("range1", "Campo_range1_MC", "1 pezzo");
        interprete.assignCompiledField("range2", "Campo_range2", "1 pezzo");
        interprete.assignCompiledField("tipo_punti2", "Campo_TipoPunti2", "Superbollini");
        interprete.assignCompiledField("punti2", "Campo_punti2", "0");
        interprete.assignCompiledField("prezzo_offerta", "PREZ_Fidelity_MC", "6,98");
        return interprete;
    }

    private static List<string> Etichette(CompiledFieldInterpreter interprete) =>
        interprete.getFields().compiledFields.Select(f => f.labelName).ToList();

    [Fact]
    public void Cancellato_il_gruppo_i_suoi_campi_non_si_mandano()
    {
        var interprete = ConPunti(ContenitoriEdro21);
        interprete.removeCompiledField("Range_Punti_2");

        Assert.Equal(new[] { "range1", "prezzo_offerta" }, Etichette(interprete));
        // L'elenco dei cancellati resta quello che l'agenzia ha scritto.
        Assert.Equal(new[] { "Range_Punti_2" }, interprete.getFields().deletedFields);
    }

    [Fact]
    public void Il_gruppo_del_prezzo_cancellato_toglie_prezzo_offerta_anche_dopo_finalizeFields()
    {
        var interprete = ConPunti(ContenitoriEdro21);
        interprete.removeCompiledField("prezzo_offerta_gruppo");
        interprete.finalizeFields();

        Assert.False(interprete.compiledContainsKey("prezzo_offerta"));
        Assert.True(interprete.compiledContainsKey("range2"));
    }

    [Fact]
    public void Senza_il_gruppo_cancellato_i_campi_restano()
    {
        Assert.Equal(new[] { "range1", "range2", "tipo_punti2", "punti2", "prezzo_offerta" }, Etichette(ConPunti(ContenitoriEdro21)));
    }

    [Fact]
    public void Senza_dichiarazione_conta_solo_l_etichetta_cancellata()
    {
        var interprete = ConPunti(null);
        interprete.removeCompiledField("Range_Punti_2");

        Assert.Equal(new[] { "range1", "range2", "tipo_punti2", "punti2", "prezzo_offerta" }, Etichette(interprete));
    }

    [Fact]
    public void Ripristinato_il_gruppo_i_campi_tornano()
    {
        var interprete = ConPunti(ContenitoriEdro21);
        interprete.removeCompiledField("Range_Punti_2");
        interprete.restoreCompiledField("Range_Punti_2");

        Assert.Contains("range2", Etichette(interprete));
    }

    [Fact]
    public void Il_clone_conserva_i_contenitori()
    {
        var interprete = ConPunti(ContenitoriEdro21);
        var clone = interprete.Clone();
        clone.removeCompiledField("Range_Punti_2");

        Assert.DoesNotContain("range2", Etichette(clone));
    }

    [Fact]
    public void Edro21_legge_i_contenitori_dal_SourceCustomPlugin()
    {
        var mappa = AgenziaLib.Edro21.LeggiCampiDeiContenitori(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json")));

        Assert.Equal(new[] { "range1", "tipo_punti1", "punti1" }, mappa["Range_Punti_1"]);
        Assert.Equal(new[] { "range2", "tipo_punti2", "punti2" }, mappa["Range_Punti_2"]);
        Assert.Equal(new[] { "prezzo_offerta", "sy_euro" }, mappa["prezzo_offerta_gruppo"]);
    }

    [Fact]
    public void Senza_chiave_o_con_valori_sbagliati_nessun_contenitore()
    {
        Assert.Empty(AgenziaLib.Edro21.LeggiCampiDeiContenitori("{\"nomeFotoPrimaria\":\"immagine\"}"));
        Assert.Empty(AgenziaLib.Edro21.LeggiCampiDeiContenitori("{\"campiDeiContenitori\":[]}"));

        var mappa = AgenziaLib.Edro21.LeggiCampiDeiContenitori("{\"campiDeiContenitori\":{\"A\":\"x\",\"B\":[\"b1\",\"\"]}}");
        Assert.Equal(new[] { "B" }, mappa.Keys);
        Assert.Equal(new[] { "b1" }, mappa["B"]);
    }

    [Fact]
    public void Senza_SourceCustomPlugin_nella_cartella_nessun_contenitore()
    {
        var cartella = Directory.CreateTempSubdirectory("contenitori").FullName;
        try
        {
            Assert.Empty(AgenziaLib.Edro21.CampiDeiContenitori(Path.Combine(cartella, "SourceMappaStili.json")));
            Assert.Empty(AgenziaLib.Edro21.CampiDeiContenitori(""));
        }
        finally
        {
            Directory.Delete(cartella, true);
        }
    }

    [Fact]
    public void Il_modello_della_configurazione_conserva_la_chiave()
    {
        var json = "{\"campiDeiContenitori\":{\"Range_Punti_2\":[\"range2\",\"punti2\"]}}";
        var config = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json)!;

        Assert.Equal(new[] { "range2", "punti2" }, config.campiDeiContenitori["Range_Punti_2"]);
        Assert.Contains("\"campiDeiContenitori\":{\"Range_Punti_2\":[\"range2\",\"punti2\"]}", JsonConvert.SerializeObject(config));
        Assert.Empty(JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{}")!.campiDeiContenitori);
    }
}
