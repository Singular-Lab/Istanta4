using AgenziaLib;
using AgenziaLib.Tipi;
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

/// <summary>
/// I20-522: come si sceglie il primario di un gruppo take away.
///
/// La dicitura "disponibile anche take away" la scrive l'operatore in una delle quattro
/// descrizioni: quando c'e', il primario del gruppo e' la ref di peso 1. Il riconoscimento
/// per settore che c'era prima non viene sostituito, questo gli si aggiunge. Il peso arriva
/// nel record solo quando non e' nullo, quindi il ripiego non e' ornamentale: un gruppo che
/// uscisse senza primaria verrebbe saltato nell'export e farebbe fallire l'impaginazione.
/// </summary>
public class AutoSelezionePrimarioTakeAwayTests
{
    [Fact]
    public void La_dicitura_rende_primaria_la_ref_di_peso_uno()
    {
        // La dicitura sta su una ref, il peso 1 su un'altra: la regola guarda il gruppo intero.
        var alPezzo = Referenza(descrizione: "Porchetta, disponibile anche Take Away", peso: 0.250m);
        var alChilo = Referenza(descrizione: "Porchetta", peso: 1m);

        Seleziona(alPezzo, alChilo);

        Assert.Equal(TipoSelezioneMenabo.Primaria, Selezione(alChilo));
        Assert.NotEqual(TipoSelezioneMenabo.Primaria, Selezione(alPezzo));
    }

    [Fact]
    public void Il_gruppo_riconosciuto_dalla_dicitura_viene_marcato_take_away()
    {
        var conDicitura = Referenza(descrizione: "disponibile anche take away", peso: 1m);
        var altra = Referenza(descrizione: "Contorno");

        Seleziona(conDicitura, altra);

        Assert.True(conDicitura.ContainsKey("isTakeAway"));
        Assert.True(altra.ContainsKey("isTakeAway"));
    }

    [Theory]
    [InlineData("disponibile anche take away")]
    [InlineData("Disponibile anche Take Away")]
    [InlineData("DISPONIBILE ANCHE TAKE AWAY")]
    [InlineData("  disponibile   anche\n\ntake away  ")]
    [InlineData("Porchetta di Ariccia - disponibile anche Take Away - 100g")]
    public void La_dicitura_si_riconosce_comunque_sia_stata_scritta(string scritta)
    {
        // E' battuta a mano: maiuscole e spazi di troppo non devono farla mancare.
        Assert.True(Edro21.contieneDicituraTakeAway(scritta));
    }

    [Theory]
    [InlineData("")]
    [InlineData("Porchetta di Ariccia")]
    [InlineData("take away")]
    [InlineData("disponibile anche da asporto")]
    public void Un_testo_che_non_contiene_la_dicitura_non_la_dichiara(string scritta)
    {
        Assert.False(Edro21.contieneDicituraTakeAway(scritta));
    }

    [Fact]
    public void La_dicitura_vale_anche_nelle_descrizioni_di_gruppo()
    {
        // Le descrizioni di gruppo viaggiano in un dizionario annidato, non dritte nel record.
        var primaDelGruppo = Referenza(descrizione: "Porchetta");
        primaDelGruppo[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] = new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES.keyDescr3] = "disponibile anche Take Away"
        };
        var alChilo = Referenza(descrizione: "Porchetta", peso: 1m);

        Seleziona(primaDelGruppo, alChilo);

        Assert.Equal(TipoSelezioneMenabo.Primaria, Selezione(alChilo));
    }

    [Fact]
    public void Senza_peso_uno_si_ripiega_sull_unita_di_fatturazione_a_peso()
    {
        // Il peso puo' mancare del tutto. Qui l'unita' e' scritta minuscola: prima di I20-522
        // il gruppo veniva dichiarato take away e restava senza primaria.
        var alPezzo = Referenza(descrizione: "disponibile anche Take Away", unitaFatt: "pezzo");
        var aPeso = Referenza(descrizione: "Porchetta", unitaFatt: "peso");

        Seleziona(alPezzo, aPeso);

        Assert.Equal(TipoSelezioneMenabo.Primaria, Selezione(aPeso));
    }

    [Fact]
    public void Senza_peso_e_senza_unita_a_peso_la_primaria_e_la_prima_ref()
    {
        // Ultimo ripiego: un gruppo take away non esce mai senza primaria.
        var prima = Referenza(descrizione: "disponibile anche Take Away");
        var seconda = Referenza(descrizione: "Contorno");

        Seleziona(prima, seconda);

        Assert.Equal(TipoSelezioneMenabo.Primaria, Selezione(prima));
        Assert.Equal(1, new[] { prima, seconda }.Count(r => Selezione(r) == TipoSelezioneMenabo.Primaria));
    }

    [Fact]
    public void Il_riconoscimento_per_settore_continua_a_valere_senza_dicitura()
    {
        // Comportamento di prima di I20-522: gastronomia a vendita assistita con peso e pezzo.
        var alPezzo = Referenza(descrizione: "Porchetta", unitaFatt: "pezzo", settore: "2507");
        var aPeso = Referenza(descrizione: "Porchetta", unitaFatt: "Peso");

        Seleziona(alPezzo, aPeso);

        Assert.Equal(TipoSelezioneMenabo.Primaria, Selezione(aPeso));
        Assert.True(alPezzo.ContainsKey("isTakeAway"));
    }

    [Fact]
    public void Un_gruppo_senza_dicitura_e_fuori_dal_settore_non_diventa_take_away()
    {
        var prima = Referenza(descrizione: "Pasta");
        var seconda = Referenza(descrizione: "Sugo");

        Seleziona(prima, seconda);

        Assert.False(prima.ContainsKey("isTakeAway"));
        Assert.False(seconda.ContainsKey("isTakeAway"));
    }

    private static void Seleziona(params Dictionary<string, object>[] gruppo)
    {
        new Edro21().eseguiAutoSelezioneGruppo(gruppo.ToList(), null!);
    }

    private static TipoSelezioneMenabo Selezione(Dictionary<string, object> record)
    {
        return (TipoSelezioneMenabo)Convert.ToByte(record[GLOBAL_VARIABLES.keyXMLSelezione]);
    }

    private static Dictionary<string, object> Referenza(
        string descrizione = "",
        decimal? peso = null,
        string unitaFatt = "",
        string settore = "")
    {
        var record = new Dictionary<string, object>
        {
            ["Scatto.CodiceGruppo"] = "GRUPPO",
            ["potenziale_esempio"] = "",
            ["referenza_pilota"] = "N",
            [GLOBAL_VARIABLES.keyDescr1] = descrizione
        };

        // Il peso e l'unita' finiscono nel record solo quando ci sono davvero.
        if (peso != null) record[GLOBAL_VARIABLES.keyDescrPeso] = peso.Value;
        if (unitaFatt != "") record["unita_fatt"] = unitaFatt;
        if (settore != "") record["settore"] = settore;

        return record;
    }
}
