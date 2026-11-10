using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1217: la sezione "Foto cambiate" della schermata delle segnalazioni del Plugin vale solo per il
/// cliente che lo dichiara nel SourceCustomPlugin (segnalaFotoCambiate). Il modello deve leggere la
/// chiave e non perderla al salvataggio, altrimenti il server la scarta in silenzio. Coop la dichiara,
/// Edro21 no; senza la chiave e' spenta.
/// </summary>
public class FotoCambiateCustomPluginTests
{
    [Fact]
    public void Senza_la_chiave_le_foto_cambiate_sono_spente()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}");

        Assert.NotNull(agenzia);
        Assert.False(agenzia!.segnalaFotoCambiate);
    }

    [Fact]
    public void La_chiave_si_legge_e_sopravvive_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"segnalaFotoCambiate\":true}");
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));

        Assert.True(riletto!.segnalaFotoCambiate);
    }

    [Fact]
    public void Coop_dichiara_le_foto_cambiate()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgente("Coopfi")));

        Assert.True(agenzia!.segnalaFotoCambiate);
    }

    [Fact]
    public void Edro21_non_dichiara_le_foto_cambiate()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSorgente("Edro21")));

        Assert.False(agenzia!.segnalaFotoCambiate);
    }

    private static string TrovaSorgente(string cliente)
    {
        var relativo = "Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json";

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

        throw new FileNotFoundException("SourceCustomPlugin.json di " + cliente + " non trovato risalendo da " + AppContext.BaseDirectory);
    }
}
