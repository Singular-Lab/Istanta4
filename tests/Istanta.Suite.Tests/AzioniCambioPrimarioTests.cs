using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-976: azione da compiere quando cambia il primario di un gruppo nella scheda ref.
/// La regola viaggia nel SourceCustomPlugin del cliente: va letta dai file gia' in esercizio,
/// che non ce l'hanno, e deve arrivare al Plugin intatta dopo un salvataggio.
/// </summary>
public class AzioniCambioPrimarioTests
{
    [Fact]
    public void Un_source_senza_la_regola_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.azioniCambioPrimario);
    }

    [Fact]
    public void La_regola_si_legge_con_azione_messaggio_e_condizioni()
    {
        const string json = "{\"azioniCambioPrimario\":[{\"azione\":\"avviso\",\"messaggio\":\"Esempio del gruppo\","
            + "\"setRegole\":[{\"Id\":1,\"Deepness\":0,\"Regole\":[{\"isBox\":false,\"Campo\":\"provenienzaEsempio\","
            + "\"Operatore\":0,\"Value\":\"Gruppo\"}],\"RegoleAnnidate\":[]}]}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);

        var regola = Assert.Single(agenzia!.azioniCambioPrimario);
        Assert.Equal("avviso", regola.azione);
        Assert.Equal("Esempio del gruppo", regola.messaggio);
        var blocco = Assert.Single(regola.setRegole);
        var condizione = Assert.Single(blocco.Regole);
        Assert.Equal("provenienzaEsempio", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Equals, condizione.Operatore);
        Assert.Equal("Gruppo", condizione.Value);
    }

    [Fact]
    public void Un_salvataggio_non_perde_la_regola()
    {
        var originale = new AgenziaCustomPlugin
        {
            azioniCambioPrimario = new List<AgenziaCustomPlugin_AzioneCambioPrimario>
            {
                new()
                {
                    azione = "ricarica",
                    messaggio = "",
                    setRegole = new List<BloccoRegole>
                    {
                        new()
                        {
                            Regole = new List<RegolaCondizione>
                            {
                                new() { Campo = "provenienzaEsempio", Operatore = OperatoreCondizione.Equals, Value = "Primario" }
                            }
                        }
                    }
                }
            }
        };

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(originale));

        var regola = Assert.Single(riletto!.azioniCambioPrimario);
        Assert.Equal("ricarica", regola.azione);
        Assert.Equal("Primario", regola.setRegole.Single().Regole.Single().Value);
    }

    /// <summary>
    /// Le due regole di Edro: se non arrivassero al Plugin il cambio primario resterebbe
    /// muto come prima, senza alcun errore visibile.
    /// </summary>
    [Fact]
    public void Il_source_di_Edro21_distingue_l_esempio_dal_primario_da_quello_del_gruppo()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSourceEdro21()));

        Assert.NotNull(agenzia);
        Assert.Equal(2, agenzia!.azioniCambioPrimario.Count);

        var ricarica = agenzia.azioniCambioPrimario.Single(a => a.azione == "ricarica");
        Assert.Equal("Primario", ValoreAtteso(ricarica));
        // Nessun testo: il Plugin usa il proprio predefinito.
        Assert.Equal("", ricarica.messaggio);

        var avviso = agenzia.azioniCambioPrimario.Single(a => a.azione == "avviso");
        Assert.Equal("Gruppo", ValoreAtteso(avviso));
        Assert.False(string.IsNullOrWhiteSpace(avviso.messaggio));
        // Il messaggio deve restare corto abbastanza da leggersi in un avviso.
        Assert.InRange(avviso.messaggio.Length, 1, 200);
        Assert.Contains("revisore", avviso.messaggio, StringComparison.OrdinalIgnoreCase);
    }

    private static string ValoreAtteso(AgenziaCustomPlugin_AzioneCambioPrimario regola)
    {
        var condizione = regola.setRegole.Single().Regole.Single();
        Assert.Equal("provenienzaEsempio", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Equals, condizione.Operatore);
        return condizione.Value;
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
