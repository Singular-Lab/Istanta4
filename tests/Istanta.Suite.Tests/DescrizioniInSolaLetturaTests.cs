using System.IO;
using System.Linq;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1132: le descrizioni fondamentali che la scheda ref del Plugin mostra in sola lettura quando
/// una regola dell'agenzia vale per il record. Il meccanismo e' del core; qui si verifica il dato di
/// agenzia nel SourceCustomPlugin: si legge, non si perde al salvataggio, e per Edro21 dichiara la
/// grammatura quando il record porta grammatura_da_confezione.
/// </summary>
public class DescrizioniInSolaLetturaTests
{
    [Fact]
    public void Un_source_senza_il_campo_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.descrizioniInSolaLettura);
    }

    [Fact]
    public void La_voce_si_legge_con_fondamentale_nota_e_regola_e_sopravvive_al_salvataggio()
    {
        const string json = "{\"descrizioniInSolaLettura\":[{\"fondamentale\":\"descrizione4\",\"nota\":\"Grammatura della confezione {grammatura_da_confezione}\","
            + "\"setRegole\":[{\"Id\":1,\"Deepness\":0,\"Regole\":[{\"isBox\":false,\"Campo\":\"grammatura_da_confezione\","
            + "\"Operatore\":6,\"Value\":\"\"}],\"RegoleAnnidate\":[]}]}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        var voce = Assert.Single(agenzia!.descrizioniInSolaLettura);
        Assert.Equal("descrizione4", voce.fondamentale);
        Assert.Equal("Grammatura della confezione {grammatura_da_confezione}", voce.nota);
        var regola = Assert.Single(Assert.Single(voce.setRegole).Regole);
        Assert.Equal("grammatura_da_confezione", regola.Campo);
        Assert.Equal(OperatoreCondizione.Exist, regola.Operatore);

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));
        var voceRiletta = Assert.Single(riletto!.descrizioniInSolaLettura);
        Assert.Equal("descrizione4", voceRiletta.fondamentale);
        Assert.Equal(voce.nota, voceRiletta.nota);
        Assert.Equal(OperatoreCondizione.Exist, Assert.Single(Assert.Single(voceRiletta.setRegole).Regole).Operatore);
    }

    [Fact]
    public void Il_source_di_Edro21_dichiara_la_grammatura_in_sola_lettura_con_la_confezione_primaria()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgenteEdro21()));

        Assert.NotNull(agenzia);
        var voce = Assert.Single(agenzia!.descrizioniInSolaLettura);
        Assert.Equal("descrizione4", voce.fondamentale);
        Assert.Contains("{grammatura_da_confezione}", voce.nota);
        Assert.Contains("revisore", voce.nota);
        var regola = Assert.Single(Assert.Single(voce.setRegole).Regole);
        Assert.Equal("grammatura_da_confezione", regola.Campo);
        Assert.Equal(OperatoreCondizione.Exist, regola.Operatore);
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json";

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

        throw new FileNotFoundException("SourceCustomPlugin.json di Edro21 non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
