using System.Collections.Generic;
using System.IO;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1079: gli stili delle bruciature che l'agenzia accoda alla descrizione (Coop: "MAX 4 PEZZI
/// PER CARTA SOCIO" con MAX_PEZZI e varianti). Viaggiano nel SourceCustomPlugin del cliente, e il
/// Plugin li lascia fuori dal confronto e dal salvataggio della descrizione. Solo Coop li dichiara.
/// </summary>
public class StiliBruciaturaDescrizioneTests
{
    [Fact]
    public void Un_source_senza_bruciature_si_legge_con_l_elenco_vuoto()
    {
        // Forma dei file gia' in esercizio prima di questa modifica, come quello di Edro21.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.stiliBruciaturaDescrizione);
    }

    [Fact]
    public void Le_bruciature_si_leggono_e_sopravvivono_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"stiliBruciaturaDescrizione\":[\"MAX_PEZZI\"]}");
        Assert.Equal(new List<string> { "MAX_PEZZI" }, agenzia!.stiliBruciaturaDescrizione);

        // Il file del cliente viene riscritto dalla pagina di configurazione: la chiave deve fare il giro.
        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));
        Assert.Equal(new List<string> { "MAX_PEZZI" }, riletto!.stiliBruciaturaDescrizione);
    }

    [Fact]
    public void Solo_Coop_dichiara_le_bruciature()
    {
        Assert.Equal(new List<string> { "MAX_PEZZI" }, SourceDelCliente("Coopfi").stiliBruciaturaDescrizione);
        Assert.Empty(SourceDelCliente("Edro21").stiliBruciaturaDescrizione);
    }

    private static AgenziaCustomPlugin SourceDelCliente(string cliente)
    {
        string relativo = Path.Combine("Istanta", "wwwroot", "external_source", cliente, "SourceCustomPlugin.json");
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo);
            if (File.Exists(candidato))
            {
                return JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(candidato))!;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Source non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
