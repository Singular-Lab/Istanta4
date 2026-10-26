using Istanta.Controllers;
using Istanta.Models;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1089: quello che serve al Plugin per l'interfaccia dei meta del box. Il server annota nei
/// record le primarie/secondarie e le foto che un meta ha cambiato, con il valore del dato e quello
/// del meta (metaFoto), cosi' la finestra le mostra; e dall'interfaccia si crea un meta di testo nuovo
/// (azione Crea), nella stessa richiesta delle rimozioni.
/// </summary>
public class MetaDelBoxTests
{
    /* ---- le sostituzioni di foto e primarie/secondarie ---- */

    [Fact]
    public void Una_primaria_cambiata_dal_meta_si_annota_con_il_valore_del_dato_e_quello_del_meta()
    {
        var record = new Dictionary<string, object> { ["StatoSelezione"] = 2 };

        FicoProcessController.annotaSostituzioneFoto(record, "selezione", "123", record["StatoSelezione"], (int)StatoSelezioneFoto.Primaria, false);

        var voce = Assert.Single((List<SostituzioneFotoDaMeta>)record[GLOBAL_VARIABLES.keyMetaFoto]);
        Assert.Equal("selezione", voce.tipo);
        Assert.Equal("123", voce.codRef);
        Assert.Equal("2", voce.originale);
        Assert.Equal("1", voce.modificato);
        Assert.False(voce.ereditata);
    }

    [Fact]
    public void Un_meta_che_non_cambia_niente_non_si_annota()
    {
        var record = new Dictionary<string, object>();

        FicoProcessController.annotaSostituzioneFoto(record, "foto", "123", "123_1.jpg", "123_1.jpg", false);
        FicoProcessController.annotaSostituzioneFoto(null, "foto", "123", "a.jpg", "b.jpg", false);

        Assert.False(record.ContainsKey(GLOBAL_VARIABLES.keyMetaFoto));
    }

    [Fact]
    public void La_stessa_referenza_annotata_di_nuovo_sostituisce_la_voce_e_le_foto_ereditate_si_riconoscono()
    {
        var record = new Dictionary<string, object>();

        FicoProcessController.annotaSostituzioneFoto(record, "foto", "123", "123_1.jpg", "123_2.jpg", true);
        FicoProcessController.annotaSostituzioneFoto(record, "foto", "123", "123_1.jpg", "123_3.jpg", true);
        FicoProcessController.annotaSostituzioneFoto(record, "selezione", "123", null, 1, true);

        var voci = (List<SostituzioneFotoDaMeta>)record[GLOBAL_VARIABLES.keyMetaFoto];
        Assert.Equal(2, voci.Count);
        Assert.Equal("123_3.jpg", voci.Single(v => v.tipo == "foto").modificato);
        Assert.Null(voci.Single(v => v.tipo == "selezione").originale);
        Assert.All(voci, v => Assert.True(v.ereditata));
        //Il Plugin le legge dal record serializzato.
        Assert.Contains("\"metaFoto\"", JsonConvert.SerializeObject(record));
    }

    [Fact]
    public void Le_sostituzioni_si_annotano_dal_meta_della_lavorazione_e_da_quello_ereditato()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");

        Assert.Contains("annotaSostituzioneFoto(item.recordInTracciato, \"selezione\", fieldGiaEsistente.codRef, statoDelDato, (int)fieldGiaEsistente.stato, false);", fico);
        Assert.Contains("annotaSostituzioneFoto(item.recordInTracciato, \"selezione\", psItem.codRef, statoDelDato, (int)psItem.stato, true);", fico);
        Assert.Contains("annotaSostituzioneFoto(item.recordInTracciato, \"foto\", fotoScelta.codRef, fotoDelDato, artFotoItem.NomeReale, false);", fico);
        Assert.Contains("annotaSostituzioneFoto(item.recordInTracciato, \"foto\", fotoScelta.codRef, fotoDelDato, artFotoItem.NomeReale, true);", fico);
    }

    /* ---- il meta di testo nuovo ---- */

    [Fact]
    public void Crea_registra_un_meta_nuovo_con_valore_originale_e_versione()
    {
        var meta = new RevisioneMetaPromoLavorazioni();

        int cambiati = MetaPromoLavorazioni.modificaTestiDalBox(meta, new RichiestaTestiDalBox
        {
            voci = new() { new VoceRichiestaTestoDalBox { label = "prezzo_info_pack", azione = AzioneTestoDalBox.Crea, contenuto = "cad.", contenutoServer = "a conf.", versione = 4 } }
        });

        Assert.Equal(1, cambiati);
        var testo = Assert.Single(meta.testiDalBox!);
        Assert.Equal("cad.", testo.contenuto);
        Assert.Equal("a conf.", testo.contenutoServer);
        Assert.Equal((byte)4, testo.versione);
    }

    [Fact]
    public void Rimozioni_e_meta_nuovi_vanno_nella_stessa_richiesta()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaTestiDalBox(meta, new List<TestoDalBox> { new() { label = "prezzo_continuo", contenuto = "x", contenutoServer = "y" } });

        MetaPromoLavorazioni.modificaTestiDalBox(meta, new RichiestaTestiDalBox
        {
            voci = new()
            {
                new VoceRichiestaTestoDalBox { label = "prezzo_continuo", azione = AzioneTestoDalBox.Rimuovi },
                new VoceRichiestaTestoDalBox { label = "prezzo_info_pack", azione = AzioneTestoDalBox.Crea, contenuto = "cad.", contenutoServer = "a conf." }
            }
        });

        Assert.Equal("prezzo_info_pack", Assert.Single(meta.testiDalBox!).label);
    }

    [Fact]
    public void Crea_vuole_il_testo_e_il_contenuto_attuale_del_server()
    {
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = AzioneTestoDalBox.Crea, contenutoServer = "a" } } }));
        Assert.NotNull(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = AzioneTestoDalBox.Crea, contenuto = "a" } } }));
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaTestiDalBox(new RichiestaTestiDalBox { voci = new() { new VoceRichiestaTestoDalBox { label = "x", azione = AzioneTestoDalBox.Crea, contenuto = "", contenutoServer = "a" } } }));

        //Come la manda il Plugin.
        var letta = MetaPromoLavorazioni.leggiRichiestaTestiDalBox("{\"voci\":[{\"label\":\"x\",\"azione\":3,\"contenuto\":\"cad.\",\"contenutoServer\":\"a conf.\"}]}");
        Assert.Equal(AzioneTestoDalBox.Crea, letta!.voci!.Single().azione);
        Assert.Equal("cad.", letta.voci!.Single().contenuto);
    }

    [Fact]
    public void Anche_il_meta_nuovo_prende_la_versione_attuale_del_record()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        Assert.Contains("foreach (var voce in richiesta.voci!.Where(v => v.azione == AzioneTestoDalBox.Aggiorna || v.azione == AzioneTestoDalBox.Crea))", menabo);
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
