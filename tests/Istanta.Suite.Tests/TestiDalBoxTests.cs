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
/// della lavorazione e li rimette nei campi compilati di lista e scheda.
/// I20-1088: il testo vale finche' il meta esiste. Con il record il server restituisce lo stato di
/// ogni meta (valore originale e versione registrati, contenuto e versione attuali), da cui il Plugin
/// lo segnala da verificare; Aggiorna e Rimuovi lo cambiano; quello che il server compone gia' si
/// toglie scaricando la lista.
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

    [Fact]
    public void Registrando_il_testo_si_registra_anche_la_versione_del_record()
    {
        var meta = new RevisioneMetaPromoLavorazioni();

        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") }, 3);

        Assert.Equal((byte)3, meta.testiDalBox!.Single().versione);
        Assert.Equal((byte)3, MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta))!.testiDalBox!.Single().versione);
        //I meta di prima non hanno la versione, e si leggono lo stesso.
        Assert.Null(MetaPromoLavorazioni.leggi("{\"testiDalBox\":[{\"label\":\"x\",\"contenuto\":\"a\",\"contenutoServer\":\"b\"}]}")!.testiDalBox!.Single().versione);
    }

    /* ---- i campi compilati ---- */

    [Fact]
    public void Il_testo_del_box_va_nel_campo_e_lo_stato_dice_cosa_compone_il_server()
    {
        var campi = Campi();
        var testo = Testo("prezzo_info_pack", "cad.", "a conf.");
        testo.versione = 3;

        var stati = MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { testo }, 3);

        Assert.Equal("cad.", campi[0].content);
        Assert.Equal("invece di € 1,89 a conf.", campi[1].content);
        var stato = Assert.Single(stati);
        Assert.Equal("prezzo_info_pack", stato.label);
        Assert.Equal("cad.", stato.contenuto);
        Assert.Equal("a conf.", stato.contenutoServer);
        Assert.Equal("a conf.", stato.contenutoServerAttuale);
        Assert.Equal((byte)3, stato.versione);
        Assert.Equal((byte)3, stato.versioneAttuale);
        Assert.False(stato.allineato);
    }

    [Fact]
    public void Se_il_dato_del_server_e_cambiato_il_meta_resta_e_lo_stato_porta_il_valore_nuovo()
    {
        var campi = Campi();
        campi[0].content = "al kg";

        var stati = MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") }, 4);

        //E' l'operatore a decidere se il meta e' decaduto: intanto vale.
        Assert.Equal("cad.", campi[0].content);
        var stato = Assert.Single(stati);
        Assert.Equal("a conf.", stato.contenutoServer);
        Assert.Equal("al kg", stato.contenutoServerAttuale);
        Assert.Equal((byte)4, stato.versioneAttuale);
        Assert.False(stato.allineato);
    }

    [Fact]
    public void Se_il_server_compone_gia_il_testo_del_meta_lo_stato_e_allineato()
    {
        var campi = Campi();
        campi[0].content = "cad.";

        var stato = Assert.Single(MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") }));

        Assert.True(stato.allineato);
        Assert.Equal("cad.", campi[0].content);
    }

    [Fact]
    public void Un_meta_senza_il_suo_campo_non_ha_stato()
    {
        var campi = Campi();

        Assert.Empty(MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, new List<TestoDalBox> { Testo("prezzo_che_non_c_e", "cad.", "a conf.") }));
        Assert.Empty(MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(null, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf.") }));
        Assert.Empty(MetaPromoLavorazioni.applicaTestiDalBoxAiCampi(campi, null));
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

    [Fact]
    public void Lo_stato_va_nel_record_e_nel_sottogruppo_con_la_versione_attuale_del_record()
    {
        var record = new ArticoloInKit { IdRec = 10, recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = "123", [GLOBAL_VARIABLES.keyCompiledFields] = Campi() } };
        record.sottogruppo = new Dictionary<string, object> { [GLOBAL_VARIABLES.keyCompiledFields] = Campi() };
        var perGruppo = new Dictionary<string, List<TestoDalBox>> { [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { Testo("prezzo_info_pack", "cad.", "a conf.") } };

        var allineati = FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { record }, perGruppo, new Dictionary<long, byte> { [10] = 5 });

        Assert.Empty(allineati);
        var stato = Assert.Single((List<StatoTestoDalBox>)record.recordInTracciato[GLOBAL_VARIABLES.keyTestiDalBox]);
        Assert.Equal((byte)5, stato.versioneAttuale);
        Assert.Single((List<StatoTestoDalBox>)record.sottogruppo[GLOBAL_VARIABLES.keyTestiDalBox]);
    }

    [Fact]
    public void Un_meta_che_il_server_compone_gia_non_si_restituisce_e_torna_fra_quelli_da_togliere()
    {
        var campi = Campi();
        campi[0].content = "cad.";
        var record = new ArticoloInKit { IdRec = 10, recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = "123", [GLOBAL_VARIABLES.keyCompiledFields] = campi } };
        var chiave = FicoProcessController.chiaveDellImpaginazione("123", 10);
        var perGruppo = new Dictionary<string, List<TestoDalBox>> { [chiave] = new() { Testo("prezzo_info_pack", "cad.", "a conf.") } };

        var allineati = FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { record }, perGruppo);

        Assert.False(record.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
        Assert.Equal(new[] { "prezzo_info_pack" }, allineati[chiave]);
    }

    [Fact]
    public void Un_meta_superato_nel_record_ma_non_nel_sottogruppo_non_si_toglie()
    {
        var campi = Campi();
        campi[0].content = "cad.";
        var record = new ArticoloInKit { IdRec = 10, recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = "123", [GLOBAL_VARIABLES.keyCompiledFields] = campi } };
        record.sottogruppo = new Dictionary<string, object> { [GLOBAL_VARIABLES.keyCompiledFields] = Campi() };
        var perGruppo = new Dictionary<string, List<TestoDalBox>> { [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { Testo("prezzo_info_pack", "cad.", "a conf.") } };

        Assert.Empty(FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { record }, perGruppo));
    }

    /* ---- Aggiorna e Rimuovi ---- */

    private static RevisioneMetaPromoLavorazioni MetaConDueTesti()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { Testo("prezzo_info_pack", "cad.", "a conf."), Testo("prezzo_continuo", "invece di € 1,89 cad.", "invece di € 1,89 a conf.") }, 3);
        return meta;
    }

    [Fact]
    public void Aggiorna_tiene_il_testo_e_porta_valore_originale_e_versione_al_server_di_adesso()
    {
        var meta = MetaConDueTesti();

        int cambiati = MetaPromoLavorazioni.modificaTestiDalBox(meta, new RichiestaTestiDalBox
        {
            voci = new() { new VoceRichiestaTestoDalBox { label = "PREZZO_INFO_PACK", azione = AzioneTestoDalBox.Aggiorna, contenutoServer = "al kg", versione = 4 } }
        });

        Assert.Equal(1, cambiati);
        var aggiornato = meta.testiDalBox!.Single(t => t.label == "prezzo_info_pack");
        Assert.Equal("cad.", aggiornato.contenuto);
        Assert.Equal("al kg", aggiornato.contenutoServer);
        Assert.Equal((byte)4, aggiornato.versione);
        Assert.Equal((byte)3, meta.testiDalBox!.Single(t => t.label == "prezzo_continuo").versione);
    }

    [Fact]
    public void Rimuovi_toglie_il_meta_e_senza_testi_la_chiave_sparisce()
    {
        var meta = MetaConDueTesti();

        MetaPromoLavorazioni.modificaTestiDalBox(meta, new RichiestaTestiDalBox
        {
            voci = new()
            {
                new VoceRichiestaTestoDalBox { label = "prezzo_info_pack", azione = AzioneTestoDalBox.Rimuovi },
                new VoceRichiestaTestoDalBox { label = "prezzo_continuo", azione = AzioneTestoDalBox.Rimuovi }
            }
        });

        Assert.Null(meta.testiDalBox);
    }

    [Fact]
    public void Aggiorna_su_un_campo_senza_meta_non_ne_crea_uno()
    {
        var meta = MetaConDueTesti();

        int cambiati = MetaPromoLavorazioni.modificaTestiDalBox(meta, new RichiestaTestiDalBox
        {
            voci = new() { new VoceRichiestaTestoDalBox { label = "prezzo_altro", azione = AzioneTestoDalBox.Aggiorna, contenutoServer = "x" } }
        });

        Assert.Equal(0, cambiati);
        Assert.Equal(2, meta.testiDalBox!.Count);
    }

    [Fact]
    public void Le_richieste_senza_voci_senza_campo_o_senza_valore_per_Aggiorna_non_sono_buone()
    {
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(null));
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() }));
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "", azione = AzioneTestoDalBox.Rimuovi } } }));
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = (AzioneTestoDalBox)9 } } }));
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = AzioneTestoDalBox.Aggiorna } } }));
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = AzioneTestoDalBox.Rimuovi } } }));

        //Come la manda il Plugin: { voci: [ { label, azione, contenutoServer } ] }.
        var letta = MetaPromoLavorazioni.leggiRichiestaTestiDalBox("{\"voci\":[{\"label\":\"prezzo_info_pack\",\"azione\":1,\"contenutoServer\":\"al kg\"}]}");
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(letta));
        Assert.Equal(AzioneTestoDalBox.Aggiorna, letta!.voci!.Single().azione);
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void Il_salvataggio_registra_e_le_due_letture_applicano_dopo_l_export_di_agenzia()
    {
        string revisore = Sorgente("Istanta/Controllers/RevisoreController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");

        //I20-1088: nella riga dell'impaginazione del box, con la versione del suo record.
        Assert.Contains("PromoLavorazioniRecord rigaDeiTesti = RecordDellaLavorazione.Trova(this.ctx2, req.idLavorazione, req.codice_gruppo, req.idRec);", revisore);
        Assert.Contains("MetaPromoLavorazioni.applicaTestiDalBox(metaTesti, req.testiDalBox, versione);", revisore);
        Assert.Contains("rigaDeiTesti.Meta = JsonConvert.SerializeObject(metaTesti);", revisore);

        Assert.True(menabo.IndexOf("FicoProcessController.applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal)
            < menabo.IndexOf("FicoProcessController.applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo, ficoController.versioniDeiRecordConTesti(resultGlobale.records, testiDalBoxPerGruppo));", StringComparison.Ordinal));
        Assert.True(fico.IndexOf("applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal)
            < fico.IndexOf("var testiAllineati = applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo, versioniDeiRecordConTesti(resultGlobale.records, testiDalBoxPerGruppo));", StringComparison.Ordinal));

        //I meta superati si tolgono solo scaricando la lista (processaKitDo), non aprendo la scheda.
        Assert.Contains("togliTestiDalBoxAllineati(testiAllineati, righeDeiTesti);", fico);
        Assert.DoesNotContain("togliTestiDalBoxAllineati", menabo);

        //Dal meta di questa lavorazione soltanto, non dal passato.
        Assert.Contains("if (metaDiQuestaLavorazione && storeField.testiDalBox != null", fico);
    }

    [Fact]
    public void Aggiorna_e_Rimuovi_passano_da_un_endpoint_che_registra_l_operazione_sul_meta()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string register = Sorgente("Istanta/Utility/Register.cs");

        Assert.Contains("[Route(\"Menabo/modificaTestiDalBox/{idOperazione}\")]", menabo);
        Assert.Contains("tipoOperazione.updateTestiDalBox,", menabo);
        //Aggiorna prende la versione attuale del record del box.
        Assert.Contains("byte? versione = RecordDellaLavorazione.VersioneDelRecord(this.ctx2, dato.idRec > 0 ? dato.idRec : plrItem.IdRecordTracciato);", menabo);
        Assert.Contains("MetaPromoLavorazioni.modificaTestiDalBox(storeField!, MetaPromoLavorazioni.leggiRichiestaTestiDalBox(operazione.FormData!));", register);
        Assert.Equal(16, (int)tipoOperazione.updateTestiDalBox);
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
