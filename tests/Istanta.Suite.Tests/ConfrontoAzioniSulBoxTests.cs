using System.IO;
using System.Linq;
using System.Text.Json;
using AgenziaLib;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1278: ogni azione sul box dichiara nel plugin di agenzia se rifa' il box confrontandolo con quello
/// di prima (Confronto true, come sempre e se non dichiarato) o senza confronto (false). E' il valore di
/// partenza del parametro "confronto" nel pannello del Plugin, che l'operatore cambia per quella volta.
/// </summary>
public class ConfrontoAzioniSulBoxTests
{
    private static AgenziaCustomPlugin Configurazione(string cliente) =>
        JsonConvert.DeserializeObject<AgenziaCustomPlugin>(
            File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json")).TrimStart('﻿'))!;

    [Fact]
    public void Un_azione_che_non_dichiara_Confronto_confronta()
    {
        Assert.True(new CambioStrutturale().Confronto);
        var letta = JsonConvert.DeserializeObject<CambioStrutturale>("{\"Id\":1,\"Titolo\":\"x\"}")!;
        Assert.True(letta.Confronto);
    }

    [Fact]
    public void Un_azione_dichiarata_senza_confronto_si_legge_false()
    {
        var letta = JsonConvert.DeserializeObject<CambioStrutturale>("{\"Id\":1,\"Titolo\":\"x\",\"Confronto\":false}")!;
        Assert.False(letta.Confronto);
    }

    [Theory]
    [InlineData("Edro21")]
    [InlineData("Coopfi")]
    [InlineData("Famila")]
    public void Ogni_azione_dei_plugin_di_agenzia_dichiara_Confronto_e_confronta_tranne_Forza_a_sconto_linea(string cliente)
    {
        //Forzare lo sconto linea di Edro21 cambia la disposizione del box: di solito si tiene il box rifatto.
        bool SenzaConfronto(int id) => cliente == "Edro21" && id == 9;

        var azioni = Configurazione(cliente).cambiStrutturali;
        Assert.NotEmpty(azioni);
        Assert.All(azioni, a => Assert.Equal(!SenzaConfronto(a.Id), a.Confronto));

        //Il campo c'e' davvero nel JSON, cosi' si vede nella pagina Agenzia Plugin.
        var json = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json")).TrimStart('﻿');
        using var documento = JsonDocument.Parse(json);
        Assert.All(documento.RootElement.GetProperty("cambiStrutturali").EnumerateArray(),
            a => Assert.Equal(!SenzaConfronto(a.GetProperty("Id").GetInt32()), a.GetProperty("Confronto").GetBoolean()));
    }

    [Fact]
    public void Edro21_Forza_a_sconto_linea_parte_senza_confronto_e_Rimuovi_forzatura_con()
    {
        var azioni = Configurazione("Edro21").cambiStrutturali;
        var forza = azioni.Single(a => a.Id == 9);
        Assert.Equal("Forza a sconto linea", forza.Titolo);
        Assert.False(forza.Confronto);
        Assert.True(azioni.Single(a => a.Id == 10).Confronto);
    }

    [Fact]
    public void Al_Plugin_il_campo_arriva_come_confronto()
    {
        //Come lo serializza la risposta di Menabo/getCambioStrutturale (System.Text.Json, nomi camelCase).
        var testo = System.Text.Json.JsonSerializer.Serialize(new CambioStrutturale { Id = 1, Titolo = "x", Confronto = false },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        Assert.Contains("\"confronto\":false", testo);
    }
}
