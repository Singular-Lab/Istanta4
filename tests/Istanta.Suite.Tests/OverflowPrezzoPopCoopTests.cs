using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop il prezzo (prezzo_promo) che non sta nel riquadro cresce verso destra dal bordo
/// sinistro del modello; nel volantino no. Lo dice una voce di campiSoggettiAOverflow con w "right" e
/// tipiLavorazione [2]. Il campo tipiLavorazione deve stare nel modello
/// AgenziaCustomPlugin_CampiSoggettiAOverflow, altrimenti il server lo perde rileggendo e riscrivendo
/// la configurazione, e la voce varrebbe anche nel volantino.
/// </summary>
public class OverflowPrezzoPopCoopTests
{
    private static AgenziaCustomPlugin Coop() =>
        JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json")))!;

    [Fact]
    public void I_tipi_di_lavorazione_della_voce_sopravvivono_al_salvataggio()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"campiSoggettiAOverflow\":[{\"label\":\"prezzo_promo\",\"w\":\"right\",\"tipiLavorazione\":[2]}]}")!;
        var riletta = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia))!;

        var voce = Assert.Single(riletta.campiSoggettiAOverflow);
        Assert.Equal(new[] { 2 }, voce.tipiLavorazione);
        Assert.Equal("right", voce.w);
    }

    [Fact]
    public void Senza_tipi_la_voce_vale_per_tutte_le_lavorazioni()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"campiSoggettiAOverflow\":[{\"label\":\"descrizione\",\"h\":\"top\"}]}")!;

        Assert.Empty(agenzia.campiSoggettiAOverflow.Single().tipiLavorazione);
    }

    [Fact]
    public void Coop_fa_crescere_il_prezzo_verso_destra_solo_nel_PoP()
    {
        var voci = Coop().campiSoggettiAOverflow;

        var prezzo = voci.Single(v => v.label == "prezzo_promo");
        Assert.Equal("right", prezzo.w);
        Assert.Equal("", prezzo.h);
        Assert.Equal(new[] { 2 }, prezzo.tipiLavorazione);

        //La descrizione resta com'era: in verticale, in tutte le lavorazioni.
        var descrizione = voci.Single(v => v.label == "descrizione");
        Assert.Equal("top", descrizione.h);
        Assert.Equal("", descrizione.w);
        Assert.Empty(descrizione.tipiLavorazione);
    }
}
