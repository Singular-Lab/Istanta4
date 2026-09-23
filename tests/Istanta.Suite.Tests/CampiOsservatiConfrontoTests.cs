using System.Collections.Generic;
using System.Linq;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-981: i campi che l'agenzia tiene d'occhio nella sezione Confronti del Report Integrita'.
/// Non cambiano l'aspetto del box, quindi l'analisi di integrita' non li guarda, ma l'operatore
/// li usa per decidere a che pagina va la referenza. Viaggiano nel SourceCustomPlugin del
/// cliente, come gli altri contributi di agenzia.
/// </summary>
public class CampiOsservatiConfrontoTests
{
    [Fact]
    public void Un_source_senza_campi_osservati_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica: devono continuare a leggersi.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.campiOsservatiConfronto);
    }

    [Fact]
    public void I_campi_osservati_si_leggono_con_chiave_ed_etichetta()
    {
        const string json = "{\"campiOsservatiConfronto\":["
            + "{\"label\":\"Data validita' da\",\"keyInRecordInTracciato\":\"data_da\"},"
            + "{\"label\":\"Tema\",\"keyInRecordInTracciato\":\"tema\"}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);

        Assert.Equal(2, agenzia!.campiOsservatiConfronto.Count);
        Assert.Equal("data_da", agenzia.campiOsservatiConfronto[0].keyInRecordInTracciato);
        Assert.Equal("Data validita' da", agenzia.campiOsservatiConfronto[0].label);
        Assert.Equal("tema", agenzia.campiOsservatiConfronto[1].keyInRecordInTracciato);
    }

    [Fact]
    public void Un_salvataggio_non_perde_i_campi_osservati()
    {
        // Il file del cliente viene riscritto dalla pagina di configurazione: se la chiave non
        // sopravvivesse al giro, la sezione Confronti si svuoterebbe al primo salvataggio.
        var originale = new AgenziaCustomPlugin
        {
            campiOsservatiConfronto = new List<AgenziaCustomPlugin_KeyLabel>
            {
                new AgenziaCustomPlugin_KeyLabel { label = "Ruolo", keyInRecordInTracciato = "ruolo" }
            }
        };

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(originale));

        var campo = Assert.Single(riletto!.campiOsservatiConfronto);
        Assert.Equal("ruolo", campo.keyInRecordInTracciato);
        Assert.Equal("Ruolo", campo.label);
    }

    [Fact]
    public void Il_source_di_Edro_dichiara_i_campi_concordati()
    {
        // Le chiavi sono quelle del record, non i nomi delle colonne dell'excel: e' una
        // distinzione che si e' gia' pagata una volta con tipo_comunicazione.
        var percorso = System.IO.Path.Combine(
            System.AppContext.BaseDirectory, "..", "..", "..", "..", "..",
            "Istanta", "wwwroot", "external_source", "Edro21", "SourceCustomPlugin.json");

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(System.IO.File.ReadAllText(percorso));

        var chiavi = agenzia!.campiOsservatiConfronto.Select(c => c.keyInRecordInTracciato).ToList();

        Assert.Equal(
            new[] { "data_da", "data_a", "tema", "tipo_tema", "sezione", "tipo_comunicazione", "note_category", "ruolo" },
            chiavi);
    }
}
