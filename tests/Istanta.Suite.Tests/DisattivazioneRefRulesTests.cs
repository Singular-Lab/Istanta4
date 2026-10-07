using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1051: le regole di disattivazione delle ref nel SourceCustomPlugin. Sostituiscono
/// editSchedaRefRules, che diceva solo se la scheda ref era modificabile; ora ogni regola dice
/// dove la ref e' disattivata: plugin, revisore, entrambi o nessuno.
/// </summary>
public class DisattivazioneRefRulesTests
{
    private const string Condizione = "[{\"Id\":1,\"Deepness\":0,\"Regole\":[{\"isBox\":false,\"Campo\":\"sigla_reparto\","
        + "\"Operatore\":0,\"Value\":\"EX\"}],\"RegoleAnnidate\":[]}]";

    private static string Nuova(string disattivato) => "{\"disattivato\":\"" + disattivato + "\",\"setRegole\":" + Condizione + "}";

    private static string Vecchia(bool valido) => "{\"valido\":" + (valido ? "true" : "false") + ",\"setRegole\":" + Condizione + "}";

    private static AgenziaCustomPlugin Leggi(string json) => JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json)!;

    [Fact]
    public void I_quattro_stati_si_leggono_dal_testo()
    {
        var agenzia = Leggi("{\"disattivazioneRefRules\":[" + Nuova("nessuno") + "," + Nuova("plugin") + ","
            + Nuova("revisore") + "," + Nuova("entrambi") + "]}");

        Assert.Equal(
            new[] { DisattivazioneRef.Nessuno, DisattivazioneRef.Plugin, DisattivazioneRef.Revisore, DisattivazioneRef.Entrambi },
            agenzia.disattivazioneRefRules.Select(r => r.disattivato));
        Assert.Equal("EX", agenzia.disattivazioneRefRules[0].setRegole.Single().Regole.Single().Value);
    }

    [Fact]
    public void Senza_regole_la_lista_e_vuota_e_senza_stato_la_regola_non_disattiva()
    {
        Assert.Empty(Leggi("{\"nomeLibreriaIndd\":\"libreria\"}").disattivazioneRefRules);

        var regola = Leggi("{\"disattivazioneRefRules\":[{\"setRegole\":" + Condizione + "}]}").disattivazioneRefRules.Single();
        Assert.Equal(DisattivazioneRef.Nessuno, regola.disattivato);
    }

    [Fact]
    public void Uno_stato_sconosciuto_non_si_accetta()
    {
        // L'editor di Istanta salva passando da SetJsonSource: un errore di battitura deve fermarsi li',
        // non diventare in silenzio "nessuno".
        Assert.ThrowsAny<JsonException>(() => Leggi("{\"disattivazioneRefRules\":[" + Nuova("revisor") + "]}"));
    }

    [Fact]
    public void Il_formato_di_prima_si_converte()
    {
        // valido false: scheda non modificabile nel Plugin, e in Edro esclusa dal conteggio con la regola
        // EX scritta nel codice. Insieme fanno "entrambi".
        var agenzia = Leggi("{\"editSchedaRefRules\":[" + Vecchia(false) + "," + Vecchia(true) + "]}");

        Assert.Equal(new[] { DisattivazioneRef.Entrambi, DisattivazioneRef.Nessuno }, agenzia.disattivazioneRefRules.Select(r => r.disattivato));
        Assert.Equal("sigla_reparto", agenzia.disattivazioneRefRules[0].setRegole.Single().Regole.Single().Campo);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Con_entrambe_le_chiavi_vince_la_nuova_in_qualunque_ordine(bool nuovaPrima)
    {
        // Anche quando la nuova e' una lista vuota: e' una scelta scritta, non una chiave mancante.
        const string nuova = "\"disattivazioneRefRules\":[]";
        var vecchia = "\"editSchedaRefRules\":[" + Vecchia(false) + "]";

        var agenzia = Leggi("{" + (nuovaPrima ? nuova + "," + vecchia : vecchia + "," + nuova) + "}");

        Assert.Empty(agenzia.disattivazioneRefRules);
    }

    [Fact]
    public void Un_salvataggio_scrive_solo_la_chiave_nuova_e_lo_stato_come_testo()
    {
        var json = JsonConvert.SerializeObject(Leggi("{\"editSchedaRefRules\":[" + Vecchia(false) + "]}"));

        Assert.DoesNotContain("editSchedaRefRules", json);
        Assert.Contains("\"disattivazioneRefRules\":[{\"disattivato\":\"entrambi\"", json);
    }

    [Fact]
    public void Al_plugin_lo_stato_arriva_come_testo_anche_con_i_nomi_in_camelCase()
    {
        // Le risposte di Istanta usano il resolver camelCase di AddNewtonsoftJson: il Plugin confronta
        // il testo ("plugin", "entrambi"), quindi il numero dell'enum non gli servirebbe.
        var impostazioni = new JsonSerializerSettings { ContractResolver = new CamelCasePropertyNamesContractResolver() };
        var json = JsonConvert.SerializeObject(Leggi("{\"disattivazioneRefRules\":[" + Nuova("plugin") + "]}"), impostazioni);

        Assert.Contains("\"disattivazioneRefRules\":[{\"disattivato\":\"plugin\",\"setRegole\":[{", json);
    }

    [Fact]
    public void Il_source_di_Edro_in_git_disattiva_le_EX_in_entrambi()
    {
        var testo = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"));

        Assert.DoesNotContain("editSchedaRefRules", testo);

        var regola = Leggi(testo).disattivazioneRefRules.Single();
        Assert.Equal(DisattivazioneRef.Entrambi, regola.disattivato);
        var condizione = regola.setRegole.Single().Regole.Single();
        Assert.Equal("sigla_reparto", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Equals, condizione.Operatore);
        Assert.Equal("EX", condizione.Value);
    }

    [Theory]
    [InlineData("Coopfi")]
    [InlineData("Famila")]
    public void Gli_altri_source_in_git_hanno_la_chiave_nuova(string cliente)
    {
        var testo = File.ReadAllText(DllAgenziaLibTests.TrovaFile($"Istanta/wwwroot/external_source/{cliente}/SourceCustomPlugin.json"));

        Assert.DoesNotContain("editSchedaRefRules", testo);
        Assert.Contains("\"disattivazioneRefRules\":[]", testo);
    }
}
