using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1130: gli elementi del box connessi alle foto, che "Seleziona tutte le foto" del Plugin
/// prende insieme alle foto. Viaggiano nel SourceCustomPlugin del cliente: il modello deve
/// leggerli, non perderli al salvataggio, e il file di Edro21 deve dichiarare le ombre.
/// </summary>
public class ElementiConnessiAlleFotoTests
{
    [Fact]
    public void Un_source_senza_il_campo_si_legge_con_la_lista_vuota()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\",\"nomeFotoSecondaria\":\"foto_secondaria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.elementiConnessiAlleFoto);
    }

    [Fact]
    public void Il_campo_si_legge_e_sopravvive_al_salvataggio()
    {
        const string json = "{\"nomeFotoPrimaria\":\"immagine\",\"elementiConnessiAlleFoto\":[\"sy_ombra*\",\"parentesi_BeF\"]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);
        Assert.Equal(new[] { "sy_ombra*", "parentesi_BeF" }, agenzia!.elementiConnessiAlleFoto);

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia));
        Assert.Equal(new[] { "sy_ombra*", "parentesi_BeF" }, riletto!.elementiConnessiAlleFoto);
    }

    [Fact]
    public void Il_source_di_Edro21_dichiara_le_ombre_connesse_alle_foto()
    {
        var percorso = TrovaSorgenteEdro21();
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(percorso));

        Assert.NotNull(agenzia);
        Assert.Equal("immagine", agenzia!.nomeFotoPrimaria);
        Assert.Equal(new[] { "sy_ombra*" }, agenzia.elementiConnessiAlleFoto);
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
