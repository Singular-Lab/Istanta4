using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1026: sovrastrutture, condizioni sulla ref e sulla forma del box, regola disattiva e
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
        + "\"disattiva\":[{\"nomeGruppo\":\"testoVerticale\",\"elementi\":[\"*parmigiano_testo_2mod_verticale*\"],"
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
        Assert.Empty(kit.operazioniPerBox.Single().disattiva);
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

        var disattiva = Assert.Single(sovrastruttura.operazioni.disattiva);
        Assert.Equal("testoVerticale", disattiva.nomeGruppo);
        Assert.Equal(new[] { "*parmigiano_testo_2mod_verticale*" }, disattiva.elementi);
        var forma = Assert.Single(Assert.Single(Assert.Single(disattiva.listSetCondizioni).setCondizioni).formaBoxCondition);
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
        Assert.Equal("testoVerticale", sovrastruttura.operazioni.disattiva.Single().nomeGruppo);
        Assert.Equal(new[] { "largo", "standard" },
            sovrastruttura.operazioni.disattiva.Single().listSetCondizioni.Single().setCondizioni.Single().formaBoxCondition.Single().forme);
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
    public void Le_regole_di_Edro21_portano_la_sovrastruttura_Parmigiano_e_la_conservano()
    {
        // Il file vero del cliente: due kit volantino, ciascuno con la sovrastruttura, che deve
        // restare intera anche dopo un salvataggio dall'editor di Istanta.
        var root = JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json")));
        var riletto = JsonConvert.DeserializeObject<DbFrameworkCss>(JsonConvert.SerializeObject(root));

        foreach (var db in new[] { root!, riletto! })
        {
            var kitVolantino = db.dbRidimensionamentiAllineamenti.modificheCssPerKit
                .Where(k => k.kit.kitTipoLavorazioniValide.Contains(1)).ToList();
            Assert.Equal(2, kitVolantino.Count);

            foreach (var kit in kitVolantino)
            {
                var parmigiano = Assert.Single(kit.sovrastrutture, s => s.nome == "Parmigiano Reggiano");
                Assert.Equal("Descrizioni.Descrizione1", parmigiano.listSetCondizioni.Single().setCondizioni.Single().refCondition.Single().campo);
                Assert.Equal(3, parmigiano.operazioni.disattiva.Count);
                var bollo = Assert.Single(parmigiano.operazioni.allineamenti, a => a.nomeGruppo == "Parmigiano_BolloMesi");
                Assert.Equal("dopoFixFoto", bollo.fase);
                Assert.Equal(25, bollo.followAnchor.Single().yAnchor!.distancePercentuale);
            }
        }
    }

    private static string TrovaFile(string relativo)
    {
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

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
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
