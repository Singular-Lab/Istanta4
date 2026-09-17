using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-970: duplicazione di elementi e ordine di sovrapposizione nel framework CSS.
/// Le due regole viaggiano nel SourceFrameworkCss del cliente: vanno lette dai file
/// gia' esistenti, che non le hanno, e rilette senza perdite dopo un salvataggio.
/// </summary>
public class ComposizioneBoxTests
{
    [Fact]
    public void Un_box_senza_le_nuove_regole_si_legge_con_liste_vuote()
    {
        // Forma dei file gia' in esercizio prima di questa modifica.
        const string boxLegacy = "{\"nomiBox\":[\"BOX41\"],\"ridimensionamenti\":[],\"postRidimensionamenti\":[],\"allineamenti\":[],\"segnalazioniConflitti\":[]}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(boxLegacy);

        Assert.NotNull(box);
        Assert.Empty(box!.duplicazioni);
        Assert.Empty(box.ordiniZ);
    }

    [Fact]
    public void La_regola_dell_ombra_per_foto_si_legge_con_i_suoi_adattamenti()
    {
        const string json = "{\"nomiBox\":[\"BOX41\"],\"duplicazioni\":[{\"nomeGruppo\":\"ombra_per_foto\","
            + "\"etichettaSorgente\":\"sy_ombra\",\"bersagli\":[\"immagine*\",\"foto_secondaria*\"],"
            + "\"adattaAlBersaglio\":{\"larghezza\":\"bersaglio\",\"ancoraX\":\"centro\","
            + "\"ancoraY\":\"centroSuLatoBasso\",\"offsetX\":0.0,\"offsetY\":0.0},"
            + "\"mantieniSorgente\":false,\"listSetCondizioni\":[]}]}";

        var box = JsonConvert.DeserializeObject<modificheCssBox>(json);

        var duplicazione = Assert.Single(box!.duplicazioni);
        Assert.Equal("sy_ombra", duplicazione.etichettaSorgente);
        Assert.Equal(new[] { "immagine*", "foto_secondaria*" }, duplicazione.bersagli);
        Assert.False(duplicazione.mantieniSorgente);
        Assert.NotNull(duplicazione.adattaAlBersaglio);
        Assert.Equal("bersaglio", duplicazione.adattaAlBersaglio!.larghezza);
        Assert.Equal("centroSuLatoBasso", duplicazione.adattaAlBersaglio.ancoraY);
    }

    [Fact]
    public void L_ordine_di_sovrapposizione_ha_dietro_come_default()
    {
        const string json = "{\"nomeGruppo\":\"g\",\"etichette\":[\"sy_ombra*\"],\"rispettoA\":[\"immagine*\"]}";

        var ordine = JsonConvert.DeserializeObject<OrdineZObj>(json);

        Assert.Equal("dietro", ordine!.posizione);
        Assert.Equal(new[] { "sy_ombra*" }, ordine.etichette);
        Assert.Equal(new[] { "immagine*" }, ordine.rispettoA);
    }

    [Fact]
    public void Un_salvataggio_non_perde_le_due_nuove_regole()
    {
        var originale = new modificheCssBox
        {
            nomiBox = new List<string> { "BOX41" },
            duplicazioni = new List<DuplicazioneObj>
            {
                new()
                {
                    etichettaSorgente = "sy_ombra",
                    bersagli = new List<string> { "immagine*" },
                    adattaAlBersaglio = new AdattamentoAlBersaglio
                    {
                        larghezza = "bersaglio",
                        ancoraY = "centroSuLatoBasso",
                        offsetY = -1.5
                    }
                }
            },
            ordiniZ = new List<OrdineZObj>
            {
                new()
                {
                    etichette = new List<string> { "sy_ombra*", "parentesi_BeF" },
                    posizione = "dietro",
                    rispettoA = new List<string> { "immagine*" }
                }
            }
        };

        var riletto = JsonConvert.DeserializeObject<modificheCssBox>(JsonConvert.SerializeObject(originale));

        Assert.Equal("sy_ombra", riletto!.duplicazioni.Single().etichettaSorgente);
        Assert.Equal(-1.5, riletto.duplicazioni.Single().adattaAlBersaglio!.offsetY);
        Assert.Equal(2, riletto.ordiniZ.Single().etichette.Count);
        Assert.Equal("parentesi_BeF", riletto.ordiniZ.Single().etichette.Last());
    }

    /// <summary>
    /// La regola scritta per il BOX41 di Edro21 deve essere leggibile dal modello:
    /// se il file e il modello divergono, il Plugin non applicherebbe nulla e in pagina
    /// le ombre resterebbero sopra alle foto, senza alcun errore visibile.
    /// </summary>
    [Fact]
    public void Il_box41_di_Edro21_porta_la_duplicazione_dell_ombra_e_l_ordine_dietro_le_foto()
    {
        var percorso = TrovaSorgenteEdro21();
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(percorso));

        var boxConRegola = root!.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .SelectMany(m => m.operazioniPerBox)
            .Where(op => op.nomiBox.Contains("BOX41"))
            .ToList();

        Assert.NotEmpty(boxConRegola);

        foreach (var box in boxConRegola)
        {
            var duplicazione = Assert.Single(box.duplicazioni);
            Assert.Equal("sy_ombra", duplicazione.etichettaSorgente);
            Assert.Contains("immagine*", duplicazione.bersagli);
            Assert.Contains("foto_secondaria*", duplicazione.bersagli);
            Assert.Equal("bersaglio", duplicazione.adattaAlBersaglio!.larghezza);
            Assert.Equal("centroSuLatoBasso", duplicazione.adattaAlBersaglio.ancoraY);

            var ordine = Assert.Single(box.ordiniZ);
            Assert.Equal("dietro", ordine.posizione);
            Assert.Contains("sy_ombra*", ordine.etichette);
            Assert.Contains("parentesi_BeF", ordine.etichette);
            Assert.Contains("immagine*", ordine.rispettoA);
        }
    }

    private static string TrovaSorgenteEdro21()
    {
        const string relativo = "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json";

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
