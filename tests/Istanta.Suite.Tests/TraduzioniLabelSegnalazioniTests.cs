using System.Collections.Generic;
using System.IO;
using System.Linq;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-991: le label di InDesign sono nomi tecnici, e durante il fix integrita' l'operatore si
/// trova davanti sigle come "campo_offerta" senza sapere che si parla del prezzo di prima.
/// L'agenzia dichiara come si chiamano quelle cose nel suo linguaggio, nel proprio
/// SourceCustomPlugin, e chi mostra la segnalazione scrive la traduzione con accanto la label
/// originale fra parentesi.
/// </summary>
public class TraduzioniLabelSegnalazioniTests
{
    [Fact]
    public void Un_source_senza_traduzioni_si_legge_con_la_lista_vuota()
    {
        // Forma dei file delle altre agenzie: continuano a leggersi, e le loro label restano
        // quelle di sempre.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}");

        Assert.NotNull(agenzia);
        Assert.Empty(agenzia!.traduzioniLabelSegnalazioni);
    }

    [Fact]
    public void Le_traduzioni_si_leggono_con_label_e_testo()
    {
        const string json = "{\"traduzioniLabelSegnalazioni\":["
            + "{\"label\":\"campo_offerta\",\"traduzione\":\"ANZICH\\u00e8\"},"
            + "{\"label\":\"sconto_effettivo_grande\",\"traduzione\":\"SCONTO EFFETTIVO\"}]}";

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json);

        Assert.Equal(2, agenzia!.traduzioniLabelSegnalazioni.Count);
        Assert.Equal("campo_offerta", agenzia.traduzioniLabelSegnalazioni[0].label);
        Assert.Equal("ANZICHè", agenzia.traduzioniLabelSegnalazioni[0].traduzione);
        Assert.Equal("sconto_effettivo_grande", agenzia.traduzioniLabelSegnalazioni[1].label);
        Assert.Equal("SCONTO EFFETTIVO", agenzia.traduzioniLabelSegnalazioni[1].traduzione);
    }

    [Fact]
    public void Un_salvataggio_non_perde_le_traduzioni()
    {
        // Il file del cliente viene riscritto dalla pagina di configurazione: se la chiave non
        // sopravvivesse al giro di serializzazione, le traduzioni sparirebbero al primo salvataggio.
        var partenza = new AgenziaCustomPlugin
        {
            traduzioniLabelSegnalazioni = new List<AgenziaCustomPlugin_TraduzioneLabel>
            {
                new AgenziaCustomPlugin_TraduzioneLabel { label = "campo_offerta", traduzione = "ANZICHè" }
            }
        };

        var riletto = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(partenza));

        var traduzione = Assert.Single(riletto!.traduzioniLabelSegnalazioni);
        Assert.Equal("campo_offerta", traduzione.label);
        Assert.Equal("ANZICHè", traduzione.traduzione);
    }

    [Fact]
    public void Il_source_di_Edro21_dichiara_le_tre_label_della_issue()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSourceEdro21()));

        Assert.NotNull(agenzia);

        var perLabel = agenzia!.traduzioniLabelSegnalazioni.ToDictionary(t => t.label, t => t.traduzione);

        Assert.Equal("ANZICHè", perLabel["campo_offerta"]);
        Assert.Equal("PREZZI AL KG/L", perLabel["campo_offerta_KgL_sconto"]);
        Assert.Equal("SCONTO EFFETTIVO", perLabel["sconto_effettivo_grande"]);
    }

    [Fact]
    public void La_e_accentata_di_Edro21_resta_minuscola_come_richiesto()
    {
        // I20-991: la e accentata in coda a sei maiuscole e' voluta, e va riportata tale e quale.
        // Se qualcuno "sistemasse" il source scrivendo ANZICHE' tutto maiuscolo, il csv e la
        // riga a schermo direbbero una cosa diversa da quella concordata.
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(TrovaSourceEdro21()));

        var traduzione = agenzia!.traduzioniLabelSegnalazioni
            .Single(t => t.label == "campo_offerta").traduzione;

        Assert.EndsWith("è", traduzione);
        Assert.DoesNotContain("È", traduzione);
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
