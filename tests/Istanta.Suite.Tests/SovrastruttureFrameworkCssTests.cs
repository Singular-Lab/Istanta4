using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1026: sovrastrutture, condizioni sulla ref e sulla forma del box, regola nascondi e
/// distanza in percentuale dei followAnchor.
///
/// Il SourceFrameworkCss del cliente passa dalle classi C# sia quando il Plugin lo scarica
/// (scaricaAllineamenti) sia quando lo si salva dall'editor di Istanta (salvaSourceJsonCode):
/// una proprieta' che le classi non dichiarano sparisce in silenzio, ed e' gia' successo con
/// useTextBounds (I20-974). Qui si fissa che le proprieta' nuove si leggono e sopravvivono al
/// salvataggio, e che i file gia' in esercizio, che non le hanno, si leggono come prima.
/// </summary>
public class SovrastruttureFrameworkCssTests
{
    private const string KitConSovrastruttura =
        "{\"kit\":{\"canaliValidi\":[\"SC\"]},\"operazioniPerBox\":[],"
        + "\"sovrastrutture\":[{\"nome\":\"Parmigiano\","
        + "\"listSetCondizioni\":[{\"setCondizioni\":[{\"refCondition\":[{\"campo\":\"Descrizioni.Descrizione1\",\"contiene\":\"parmigiano reggiano\"}]}]}],"
        + "\"operazioni\":{\"nomiBox\":[],"
        + "\"nascondi\":[{\"nomeGruppo\":\"testoVerticale\",\"elementi\":[\"*parmigiano_testo_2mod_verticale*\"],"
        + "\"listSetCondizioni\":[{\"setCondizioni\":[{\"formaBoxCondition\":[{\"forme\":[\"largo\",\"standard\"],\"rapporto\":1.6}]}]}]}],"
        + "\"allineamenti\":[{\"nomeGruppo\":\"BolloMesi\",\"fase\":\"dopoFixFoto\","
        + "\"followAnchor\":[{\"nomiGruppiSeguiti\":[\"immagine*\"],"
        + "\"yAnchor\":{\"distance\":0,\"distancePercentuale\":25,\"allineaAlLato\":0,\"allineaLato\":0}}]}]}}]}";

    [Fact]
    public void Un_kit_senza_sovrastrutture_si_legge_come_prima()
    {
        // Forma dei file gia' in esercizio.
        var kit = JsonConvert.DeserializeObject<dbModifiche>("{\"kit\":{},\"operazioniPerBox\":[{\"nomiBox\":[\"BOX1\"]}]}");

        Assert.NotNull(kit);
        Assert.Empty(kit!.sovrastrutture);
        Assert.Empty(kit.operazioniPerBox.Single().nascondi);
    }

    [Fact]
    public void Una_sovrastruttura_si_legge_con_condizioni_e_operazioni()
    {
        var kit = JsonConvert.DeserializeObject<dbModifiche>(KitConSovrastruttura);

        var sovrastruttura = Assert.Single(kit!.sovrastrutture);
        Assert.Equal("Parmigiano", sovrastruttura.nome);

        var condizione = Assert.Single(Assert.Single(sovrastruttura.listSetCondizioni).setCondizioni);
        var ref1 = Assert.Single(condizione.refCondition);
        Assert.Equal("Descrizioni.Descrizione1", ref1.campo);
        Assert.Equal("parmigiano reggiano", ref1.contiene);

        var nascondi = Assert.Single(sovrastruttura.operazioni.nascondi);
        Assert.Equal("testoVerticale", nascondi.nomeGruppo);
        Assert.Equal(new[] { "*parmigiano_testo_2mod_verticale*" }, nascondi.elementi);
        var forma = Assert.Single(Assert.Single(Assert.Single(nascondi.listSetCondizioni).setCondizioni).formaBoxCondition);
        Assert.Equal(new[] { "largo", "standard" }, forma.forme);
        Assert.Equal(1.6, forma.rapporto);

        var ancora = Assert.Single(Assert.Single(sovrastruttura.operazioni.allineamenti).followAnchor);
        Assert.Equal(25, ancora.yAnchor!.distancePercentuale);
    }

    [Fact]
    public void Le_proprieta_nuove_sopravvivono_al_salvataggio()
    {
        // Il salvataggio dall'editor deserializza e riserializza: e' il punto in cui una
        // proprieta' non dichiarata si perde.
        var letto = JsonConvert.DeserializeObject<dbModifiche>(KitConSovrastruttura);
        var riletto = JsonConvert.DeserializeObject<dbModifiche>(JsonConvert.SerializeObject(letto));

        var sovrastruttura = Assert.Single(riletto!.sovrastrutture);
        Assert.Equal("parmigiano reggiano", sovrastruttura.listSetCondizioni.Single().setCondizioni.Single().refCondition.Single().contiene);
        Assert.Equal("testoVerticale", sovrastruttura.operazioni.nascondi.Single().nomeGruppo);
        Assert.Equal(new[] { "largo", "standard" },
            sovrastruttura.operazioni.nascondi.Single().listSetCondizioni.Single().setCondizioni.Single().formaBoxCondition.Single().forme);
        Assert.Equal(25, sovrastruttura.operazioni.allineamenti.Single().followAnchor.Single().yAnchor!.distancePercentuale);
    }

    [Fact]
    public void Un_ancora_senza_percentuale_resta_in_millimetri()
    {
        var ancora = JsonConvert.DeserializeObject<FollowOnY>("{\"distance\":2.5}");

        Assert.Equal(2.5, ancora!.distance);
        Assert.Null(ancora.distancePercentuale);
    }

    [Fact]
    public void Una_forma_senza_rapporto_lascia_decidere_il_valore_predefinito()
    {
        // Il rapporto predefinito, 1.6, lo applica il Plugin: qui resta null.
        var forma = JsonConvert.DeserializeObject<FormaBoxCondition>("{\"forme\":[\"alto\"]}");

        Assert.Equal(new[] { "alto" }, forma!.forme);
        Assert.Null(forma.rapporto);
    }
}
