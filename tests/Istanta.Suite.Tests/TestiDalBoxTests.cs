using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1077: i campi di testo per cui l'operatore, dalla finestra delle differenze del Plugin, ha
/// scelto il testo del box (per esempio prezzo_info_pack "cad." invece di "a conf."). Il salvataggio
/// della scheda li manda con la richiesta (testiDalBox), il server li registra nel meta del record
/// della lavorazione e li rimette nei campi compilati di lista e scheda. Ma solo finche' il server
/// compone per quel campo lo stesso contenuto che c'era quando l'operatore ha scelto: se il dato
/// cambia, il testo del box non si applica e la differenza torna.
/// </summary>
public class TestiDalBoxTests
{
    private static readonly string KeyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

    private static TestoDalBox Testo(string label, string contenuto, string contenutoServer) =>
        new() { label = label, contenuto = contenuto, contenutoServer = contenutoServer };

    private static List<CompiledField> Campi() => new()
    {
        new CompiledField { labelName = "prezzo_info_pack", paragraphName = "PREZ_info", content = "a conf." },
        new CompiledField { labelName = "prezzo_continuo", paragraphName = "PREZ_cont", content = "invece di € 1,89 a conf." }
    };

    /* ---- il meta ---- */

    [Fact]
    public void Registrare_un_testo_del_box_aggiunge_una_voce_per_campo()
    {
        var meta = new RevisioneMetaPromoLavorazioni();

        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") });
        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("PREZZO_INFO_PACK", "al pz.", "a conf.") });

        //Lo stesso campo, anche con le maiuscole diverse: l'ultima scelta sostituisce la prima.
        Assert.Single(meta.testiDalBox!);
        Assert.Equal("al pz.", meta.testiDalBox![0].contenuto);
    }

    [Fact]
    public void Le_voci_senza_campo_o_senza_testo_non_si_registrano()
    {
        var meta = new RevisioneMetaPromoLavorazioni();

        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("", "cad.", "a conf."), new TestoDalBox { label = "x", contenuto = null } });
        MetaPromoLavorazioni.applicaTestiDalBox(meta, null);

        Assert.Null(meta.testiDalBox);
    }

    [Fact]
    public void Il_meta_si_rilegge_con_i_testi_del_box_e_senza_resta_come_prima()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") });

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));
        Assert.Equal("cad.", riletto!.testiDalBox!.Single().contenuto);

        Assert.Null(MetaPromoLavorazioni.leggi("{\"ps\":[]}")!.testiDalBox);
    }

    /* ---- i campi compilati ---- */

    [Fact]
    public void Il_testo_del_box_va_nel_campo_finche_il_server_compone_lo_stesso_contenuto()
    {
        var campi = Campi();

        int cambiati = MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") });

        Assert.Equal(1, cambiati);
        Assert.Equal("cad.", campi[0].content);
        Assert.Equal("invece di € 1,89 a conf.", campi[1].content);
    }

    [Fact]
    public void Se_il_dato_del_server_e_cambiato_il_testo_del_box_decade()
    {
        var campi = Campi();
        campi[0].content = "al kg";

        int cambiati = MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") });

        Assert.Equal(0, cambiati);
        Assert.Equal("al kg", campi[0].content);
    }

    [Fact]
    public void Ai_record_del_gruppo_e_al_loro_sottogruppo_anche_quando_i_campi_arrivano_come_JArray()
    {
        var conLista = new ArticoloInKit { recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = "123", [GLOBAL_VARIABLES.keyCompiledFields] = Campi() } };
        conLista.sottogruppo = new Dictionary<string, object> { [GLOBAL_VARIABLES.keyCompiledFields] = JArray.FromObject(Campi()) };
        var altroGruppo = new ArticoloInKit { recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = "999", [GLOBAL_VARIABLES.keyCompiledFields] = Campi() } };
        var perGruppo = new Dictionary<string, List<TestoDalBox>> { ["123"] = new() { Testo("prezzo_info_pack", "cad.", "a conf.") } };

        FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { conLista, altroGruppo }, perGruppo);

        Assert.Equal("cad.", ((List<CompiledField>)conLista.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.Equal("cad.", ((List<CompiledField>)conLista.sottogruppo[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.Equal("a conf.", ((List<CompiledField>)altroGruppo.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields])[0].content);

        //Senza testi non succede niente.
        FicoProcessController.applicaTestiDalBox(null, perGruppo);
        FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { altroGruppo }, null);
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void Il_salvataggio_registra_e_le_due_letture_applicano_dopo_l_export_di_agenzia()
    {
        string revisore = Sorgente("Istanta/Controllers/RevisoreController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");

        Assert.Contains("MetaPromoLavorazioni.applicaTestiDalBox(metaTesti, req.testiDalBox);", revisore);
        Assert.Contains("plrItem.Meta = JsonConvert.SerializeObject(metaTesti);", revisore);

        Assert.True(menabo.IndexOf("FicoProcessController.applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal)
            < menabo.IndexOf("FicoProcessController.applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo);", StringComparison.Ordinal));
        Assert.True(fico.IndexOf("applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal)
            < fico.IndexOf("applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo);", StringComparison.Ordinal));

        //Dal meta di questa lavorazione soltanto, non dal passato.
        Assert.Contains("if (metaDiQuestaLavorazione && storeField.testiDalBox != null", fico);
    }

    private static string Sorgente(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return File.ReadAllText(candidato).Replace("\r", "");
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"Sorgente non trovata risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
