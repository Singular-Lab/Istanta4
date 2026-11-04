using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1200: le segnalazioni di impaginazione decise dal cliente. Il meccanismo e' del Plugin
/// (pluginMiddleware), le regole stanno nel SourceCustomPlugin del cliente: il modello deve leggerle e
/// non perderle al salvataggio, altrimenti il server le scarta in silenzio. Senza regole, nessuna
/// segnalazione. Edro21 segnala le foto il cui nome non contiene ".psd".
/// </summary>
public class SegnalazioniPersonalizzateTests
{
    [Fact]
    public void Un_source_senza_segnalazioni_si_legge_con_la_lista_vuota()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.segnalazioniPersonalizzate);
    }

    [Fact]
    public void Le_segnalazioni_si_leggono_e_sopravvivono_al_salvataggio()
    {
        const string json = "{\"segnalazioniPersonalizzate\":[{\"campo\":\"nomeFoto\",\"deveContenere\":\".tif\",\"gravita\":\"error\",\"codice\":\"TIF-01\",\"testo\":\"{valore} non e' un tif\"}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));

        var regola = Assert.Single(riletto!.segnalazioniPersonalizzate);
        Assert.Equal("nomeFoto", regola.campo);
        Assert.Equal(".tif", regola.deveContenere);
        Assert.Equal("error", regola.gravita);
        Assert.Equal("TIF-01", regola.codice);
        Assert.Equal("{valore} non e' un tif", regola.testo);
    }

    [Fact]
    public void Una_segnalazione_senza_gravita_e_un_warning()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"segnalazioniPersonalizzate\":[{\"campo\":\"nomeFoto\",\"deveContenere\":\".psd\",\"testo\":\"x\"}]}");

        var regola = Assert.Single(agenzia!.segnalazioniPersonalizzate);
        Assert.Equal("warning", regola.gravita);
        Assert.Equal("", regola.codice);
    }

    [Fact]
    public void Edro21_segnala_le_foto_che_non_sono_psd()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgenteEdro21()));

        var regola = Assert.Single(agenzia!.segnalazioniPersonalizzate);
        Assert.Equal("nomeFoto", regola.campo);
        Assert.Equal(".psd", regola.deveContenere);
        Assert.Equal("warning", regola.gravita);
        Assert.Equal("PSD-01", regola.codice);
        Assert.Contains("{valore}", regola.testo);
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
