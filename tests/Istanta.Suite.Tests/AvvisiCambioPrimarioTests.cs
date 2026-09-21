using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-976: avviso di agenzia quando cambia il primario di un gruppo nella scheda ref.
/// Riscaricare la scheda e allineare il box sono comportamenti core del Plugin; qui si
/// verifica solo il contributo dell'agenzia, che viaggia nel SourceCustomPlugin del cliente.
/// </summary>
public class AvvisiCambioPrimarioTests
{
    [Fact]
    public void Un_source_senza_avvisi_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.avvisiCambioPrimario);
    }

    [Fact]
    public void L_avviso_si_legge_con_il_messaggio_e_le_sue_condizioni()
    {
        const string json = "{\"avvisiCambioPrimario\":[{\"messaggio\":\"Esempio del gruppo\","
            + "\"setRegole\":[{\"Id\":1,\"Deepness\":0,\"Regole\":[{\"isBox\":false,\"Campo\":\"provenienzaEsempio\","
            + "\"Operatore\":0,\"Value\":\"Gruppo\"}],\"RegoleAnnidate\":[]}]}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);

        var regola = Assert.Single(agenzia!.avvisiCambioPrimario);
        Assert.Equal("Esempio del gruppo", regola.messaggio);
        var condizione = Assert.Single(Assert.Single(regola.setRegole).Regole);
        Assert.Equal("provenienzaEsempio", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Equals, condizione.Operatore);
        Assert.Equal("Gruppo", condizione.Value);
    }

    [Fact]
    public void Un_salvataggio_non_perde_l_avviso()
    {
        var originale = new AgenziaCustomPlugin
        {
            avvisiCambioPrimario = new List<AgenziaCustomPlugin_AvvisoCambioPrimario>
            {
                new()
                {
                    messaggio = "Attenzione",
                    setRegole = new List<BloccoRegole>
                    {
                        new()
                        {
                            Regole = new List<RegolaCondizione>
                            {
                                new() { Campo = "provenienzaEsempio", Operatore = OperatoreCondizione.Equals, Value = "Gruppo" }
                            }
                        }
                    }
                }
            }
        };

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(originale));

        var regola = Assert.Single(riletto!.avvisiCambioPrimario);
        Assert.Equal("Attenzione", regola.messaggio);
        Assert.Equal("Gruppo", regola.setRegole.Single().Regole.Single().Value);
    }

    /// <summary>
    /// L'unico extra di Edro: con l'esempio governato dal gruppo, il cambio di primario non
    /// lo modifica e l'operatore va avvisato. Il caso "Primario" non e' configurato perche'
    /// ricade nel comportamento core, che riscarica la scheda e si accorge da se' del cambio.
    /// </summary>
    [Fact]
    public void Il_source_di_Edro21_avvisa_solo_quando_l_esempio_e_del_gruppo()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSourceEdro21()));

        var regola = Assert.Single(agenzia!.avvisiCambioPrimario);

        var condizione = Assert.Single(Assert.Single(regola.setRegole).Regole);
        Assert.Equal("provenienzaEsempio", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Equals, condizione.Operatore);
        Assert.Equal("Gruppo", condizione.Value);

        Assert.False(string.IsNullOrWhiteSpace(regola.messaggio));
        // Il messaggio deve restare corto abbastanza da leggersi in un avviso.
        Assert.InRange(regola.messaggio.Length, 1, 200);
        Assert.Contains("revisore", regola.messaggio, StringComparison.OrdinalIgnoreCase);
    }

    private static string TrovaSourceEdro21()
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

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
