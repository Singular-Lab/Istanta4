using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le regole che tolgono alcune foto dalle proposte della schermata Cambia foto del Plugin. Il
/// comportamento e' del core, le regole stanno nel SourceCustomPlugin del cliente: il modello deve
/// leggerle, non perderle al salvataggio, e senza regole tutto resta come prima. Edro21 toglie i jpg
/// e i png che hanno lo stesso nome in psd.
/// </summary>
public class EsclusioneCambioFotoTests
{
    [Fact]
    public void Un_source_senza_regole_si_legge_con_la_lista_vuota()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.regoleEsclusioneCambioFoto);
    }

    [Fact]
    public void Le_regole_si_leggono_e_sopravvivono_al_salvataggio()
    {
        const string json = "{\"regoleEsclusioneCambioFoto\":[{\"estensioni\":[\"jpg\"],\"seEsisteEstensione\":[\"psd\"],\"mantieniSelezionata\":false}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));

        var regola = Assert.Single(riletto!.regoleEsclusioneCambioFoto);
        Assert.Equal(new[] { "jpg" }, regola.estensioni);
        Assert.Equal(new[] { "psd" }, regola.seEsisteEstensione);
        Assert.False(regola.mantieniSelezionata);
    }

    [Fact]
    public void Una_regola_senza_mantieniSelezionata_tiene_la_foto_della_referenza()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"regoleEsclusioneCambioFoto\":[{\"estensioni\":[\"png\"]}]}");

        var regola = Assert.Single(agenzia!.regoleEsclusioneCambioFoto);
        Assert.True(regola.mantieniSelezionata);
        Assert.Empty(regola.seEsisteEstensione);
    }

    [Fact]
    public void Edro21_toglie_jpg_e_png_che_hanno_lo_stesso_nome_in_psd()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgenteEdro21()));

        var regola = Assert.Single(agenzia!.regoleEsclusioneCambioFoto);
        Assert.Equal(new[] { "jpg", "jpeg", "png" }, regola.estensioni);
        Assert.Equal(new[] { "psd" }, regola.seEsisteEstensione);
        Assert.True(regola.mantieniSelezionata);
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
