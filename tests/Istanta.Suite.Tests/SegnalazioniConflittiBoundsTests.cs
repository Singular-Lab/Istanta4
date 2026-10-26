using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-974: la scelta fra riquadro dell'oggetto e testo reale nelle segnalazioni conflitti.
///
/// La configurazione non arriva al Plugin come file: il server la carica nei tipi di questo
/// progetto e la riserializza. Se il tipo non conosce una proprieta', quella proprieta'
/// muore qui, in silenzio, e il Plugin riceve una regola monca. E' esattamente quello che
/// e' successo con useTextBounds, e questi casi guardano il punto dove si perdeva.
/// </summary>
public class SegnalazioniConflittiBoundsTests
{
    private const string RegolaConTextBounds =
        "{\"segnalazioni\":[\"descrizione\",\"*foto_extra*\"],\"useTextBounds\":true}";

    [Fact]
    public void La_scelta_dei_bounds_sopravvive_alla_lettura()
    {
        var regola = JsonConvert.DeserializeObject<SegnalazioniConflitti>(RegolaConTextBounds)!;

        Assert.True(regola.useTextBounds);
        Assert.Equal("descrizione", regola.segnalazioni[0]);
        Assert.Equal("*foto_extra*", regola.segnalazioni[1]);
    }

    [Fact]
    public void La_scelta_dei_bounds_sopravvive_al_viaggio_verso_il_Plugin()
    {
        // Andata e ritorno: e' il giro che fa la configurazione quando il Plugin la scarica.
        var regola = JsonConvert.DeserializeObject<SegnalazioniConflitti>(RegolaConTextBounds)!;
        var rilettura = JsonConvert.DeserializeObject<SegnalazioniConflitti>(JsonConvert.SerializeObject(regola))!;

        Assert.True(rilettura.useTextBounds);
    }

    [Fact]
    public void Una_regola_senza_la_scelta_resta_sul_riquadro_dell_oggetto()
    {
        // Le regole scritte prima di questa modifica non devono cambiare comportamento.
        var regola = JsonConvert.DeserializeObject<SegnalazioniConflitti>(
            "{\"segnalazioni\":[\"*foto_extra*\"]}")!;

        Assert.False(regola.useTextBounds);
    }

    [Fact]
    public void Il_gruppo_di_modifiche_conserva_la_scelta_di_ogni_regola()
    {
        const string gruppo =
            "{\"nomiBox\":[],\"segnalazioniConflitti\":[" +
            "{\"segnalazioni\":[\"*foto_extra*\"]}," +
            "{\"segnalazioni\":[\"descrizione\",\"*foto_extra*\"],\"useTextBounds\":true}]}";

        var letto = JsonConvert.DeserializeObject<modificheCssBox>(gruppo)!;
        var riletto = JsonConvert.DeserializeObject<modificheCssBox>(JsonConvert.SerializeObject(letto))!;

        Assert.Equal(2, riletto.segnalazioniConflitti.Count);
        Assert.False(riletto.segnalazioniConflitti[0].useTextBounds);
        Assert.True(riletto.segnalazioniConflitti[1].useTextBounds);
    }
}
