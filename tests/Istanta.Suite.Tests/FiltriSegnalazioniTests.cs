using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1211: i filtri della schermata delle segnalazioni del Plugin, dichiarati nel SourceCustomPlugin
/// del cliente. Il modello deve leggerli e non perderli al salvataggio, altrimenti il server li scarta
/// in silenzio e il Plugin non mostra nessun filtro. Senza filtri, nessuno. Edro21: "Solo foto".
/// </summary>
public class FiltriSegnalazioniTests
{
    [Fact]
    public void Un_source_senza_filtri_si_legge_con_la_lista_vuota()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.filtriSegnalazioni);
    }

    [Fact]
    public void I_filtri_si_leggono_e_sopravvivono_al_salvataggio()
    {
        const string json = "{\"filtriSegnalazioni\":[{\"nome\":\"Loghi\",\"condizioni\":[{\"codice\":\"CSF-013\",\"testoContiene\":\"foto_extra\"},{\"codice\":\"PSD-01\"}]}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));

        var filtro = Assert.Single(riletto!.filtriSegnalazioni);
        Assert.Equal("Loghi", filtro.nome);
        Assert.Equal(2, filtro.condizioni.Count);
        Assert.Equal("CSF-013", filtro.condizioni[0].codice);
        Assert.Equal("foto_extra", filtro.condizioni[0].testoContiene);
        Assert.Equal("PSD-01", filtro.condizioni[1].codice);
        Assert.Equal("", filtro.condizioni[1].testoContiene);
    }

    [Fact]
    public void Edro21_ha_il_filtro_Solo_foto()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json")));

        var filtro = Assert.Single(agenzia!.filtriSegnalazioni);
        Assert.Equal("Solo foto", filtro.nome);
        Assert.Equal(new[] { "PSD-01", "CSF-12", "CSF-27", "CSF-19", "CSF-013", "CSF-008" }, filtro.condizioni.Select(c => c.codice));
        // CSF-013 e CSF-008 solo quando nominano una foto.
        Assert.Equal("foto", filtro.condizioni.Single(c => c.codice == "CSF-013").testoContiene);
        Assert.Equal("foto", filtro.condizioni.Single(c => c.codice == "CSF-008").testoContiene);
    }
}
