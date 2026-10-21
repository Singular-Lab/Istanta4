using Istanta.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1102: il gruppo di allineamento a slot viaggia nel SourceFrameworkCss del cliente e passa
/// dalle classi C# sia quando il Plugin lo scarica sia quando l'editor lo salva: un campo che le
/// classi non conoscono si perderebbe senza errori. Nel PoP di Coop i gruppi Loghi riempiono
/// slot_logo1, slot_logo2, slot_logo3 e tolgono tutti i riquadri slot_logo*.
/// </summary>
public class AllineamentoSlotTests
{
    private static DbFrameworkCss Coop() =>
        JsonConvert.DeserializeObject<DbFrameworkCss>(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json")))!;

    private static List<Allineamento> GruppiLoghi(DbFrameworkCss db, int tipoLavorazione) =>
        db.dbRidimensionamentiAllineamenti.modificheCssPerKit
            .Where(k => k.kit.kitTipoLavorazioniValide.Contains(tipoLavorazione) && (k.kit.kitFormatiValidi == null || k.kit.kitFormatiValidi.Count == 0))
            .SelectMany(k => k.operazioniPerBox)
            .SelectMany(op => op.allineamenti)
            .Where(a => a.nomeGruppo == "Loghi")
            .ToList();

    [Fact]
    public void Nel_PoP_di_Coop_i_Loghi_hanno_gli_slot_e_li_conservano_dopo_un_salvataggio()
    {
        var letto = Coop();
        var riletto = JsonConvert.DeserializeObject<DbFrameworkCss>(JsonConvert.SerializeObject(letto))!;

        foreach (var db in new[] { letto, riletto })
        {
            var pop = GruppiLoghi(db, 2);
            Assert.Equal(2, pop.Count);
            Assert.All(pop, g =>
            {
                Assert.NotNull(g.slot);
                Assert.Equal(new[] { "slot_logo1", "slot_logo2", "slot_logo3" }, g.slot!.cornici);
                Assert.Equal("posizioneEDimensione", g.slot.modalita);
                Assert.Equal(new[] { "slot_logo*" }, g.slot.corniciDaRimuovere);
            });
        }
    }

    [Fact]
    public void Un_gruppo_senza_slot_resta_a_livelli_e_non_scrive_la_chiave()
    {
        var volantino = GruppiLoghi(Coop(), 1);
        Assert.NotEmpty(volantino);
        Assert.All(volantino, g => Assert.Null(g.slot));

        //Le configurazioni che non usano gli slot non cambiano quando l'editor le salva.
        var scritto = JObject.FromObject(new Allineamento { nomeGruppo = "Loghi" }, JsonSerializer.Create());
        Assert.False(scritto.ContainsKey("slot"));
    }

    [Fact]
    public void Gli_slot_si_leggono_come_li_scrive_la_configurazione_con_i_valori_di_partenza()
    {
        var gruppo = JsonConvert.DeserializeObject<Allineamento>("{\"nomeGruppo\":\"Loghi\",\"slot\":{\"cornici\":[\"slot_logo1\"]}}")!;

        Assert.Equal(new[] { "slot_logo1" }, gruppo.slot!.cornici);
        Assert.Equal("posizione", gruppo.slot.modalita);
        Assert.Empty(gruppo.slot.corniciDaRimuovere);
    }
}
