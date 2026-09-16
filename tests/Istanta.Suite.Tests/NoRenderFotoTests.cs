using AgenziaLib;
using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-965: opzione noRender sulle foto primarie/secondarie di un box.
/// L'opzione vive sulle voci foto, mai sul record contenitore; se non e' presente vale false.
/// </summary>
public class NoRenderMetaTests
{
    [Fact]
    public void Meta_senza_noRender_deserializza_a_false()
    {
        // Forma dei meta gia' salvati in promo_lavorazioni_records prima di questa modifica.
        const string metaLegacy = "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1}]}";

        var meta = JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(metaLegacy);

        Assert.NotNull(meta);
        var voce = Assert.Single(meta!.ps!);
        Assert.Equal(StatoSelezioneFoto.Primaria, voce.stato);
        Assert.False(voce.noRender);
    }

    [Fact]
    public void Meta_con_noRender_true_viene_letto_come_true()
    {
        const string meta = "{\"ps\":[{\"codRef\":\"3150599\",\"stato\":2,\"noRender\":true}]}";

        var letto = JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(meta);

        var voce = Assert.Single(letto!.ps!);
        Assert.True(voce.noRender);
    }

    [Fact]
    public void Round_trip_conserva_noRender_per_ogni_voce()
    {
        var originale = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd>
            {
                new() { codRef = "3150596", stato = StatoSelezioneFoto.Primaria, noRender = true },
                new() { codRef = "3150599", stato = StatoSelezioneFoto.Selezionata, noRender = false }
            }
        };

        var riletto = JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(
            JsonConvert.SerializeObject(originale));

        Assert.True(riletto!.ps!.Single(p => p.codRef == "3150596").noRender);
        Assert.False(riletto.ps!.Single(p => p.codRef == "3150599").noRender);
    }

    [Fact]
    public void Meta_legacy_completo_resta_leggibile()
    {
        // Meta realistico prodotto dalla versione precedente: campiOfferta + foto + ps.
        const string metaLegacy =
            "{\"campiOfferta\":[{\"label\":\"prezzo\",\"valore\":\"1,99\"}]," +
            "\"foto\":[{\"codRef\":\"3150596\",\"nomeFoto\":\"a.psd\",\"guidId\":\"g1\",\"tipo\":1,\"rimuoviFoto\":false}]," +
            "\"ps\":[{\"codRef\":\"3150596\",\"stato\":1},{\"codRef\":\"3150599\",\"stato\":3}]}";

        var meta = JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(metaLegacy);

        Assert.Equal(2, meta!.ps!.Count);
        Assert.All(meta.ps!, voce => Assert.False(voce.noRender));
        Assert.Single(meta.foto!);
    }
}

/// <summary>
/// Le foto del box viaggiano verso il Plugin dentro membriGruppoFoto: e' li' che
/// l'opzione di rendering deve arrivare, primaria inclusa.
/// </summary>
public class MembriGruppoFotoTests
{
    private static Dictionary<string, object> Record(string codRef, int statoSelezione, string nomeFoto)
    {
        return new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = codRef,
            [GLOBAL_VARIABLES_FICO.keyFotoNome] = nomeFoto,
            [GLOBAL_VARIABLES_FICO.keyFotoHash] = "hash-" + codRef,
            [Edro21Context.Meta.keyStatoSelezione] = statoSelezione
        };
    }

    [Fact]
    public void La_primaria_e_le_secondarie_entrano_nella_lista_le_non_selezionate_no()
    {
        var gruppo = new List<Dictionary<string, object>>
        {
            Record("3150596", 1, "primaria.psd"),
            Record("3150599", 2, "secondaria.psd"),
            Record("3150600", 3, "esclusa.psd")
        };

        var membri = RefsHelper.getFotoSecondarieDelGruppo(gruppo);

        Assert.Equal(2, membri.Count);
        Assert.Contains(membri, m => m.codRef == "3150596" && m.statoSelezione == 1);
        Assert.Contains(membri, m => m.codRef == "3150599" && m.statoSelezione == 2);
        Assert.DoesNotContain(membri, m => m.codRef == "3150600");
    }

    [Fact]
    public void Senza_meta_ogni_membro_nasce_con_noRender_false()
    {
        var gruppo = new List<Dictionary<string, object>>
        {
            Record("3150596", 1, "primaria.psd"),
            Record("3150599", 2, "secondaria.psd")
        };

        var membri = RefsHelper.getFotoSecondarieDelGruppo(gruppo);

        Assert.All(membri, m => Assert.False(m.noRender));
    }
}

/// <summary>
/// Applicazione dell'opzione letta dai meta alle voci foto, dopo l'export di agenzia.
/// </summary>
public class ApplicaNoRenderTests
{
    private const string KeyCodiceGruppo = "Scatto.CodiceGruppo";

    private static ArticoloInKit Box(string codiceGruppo, params FotoElementoGruppo[] membri)
    {
        return new ArticoloInKit
        {
            recordInTracciato = new Dictionary<string, object>
            {
                [KeyCodiceGruppo] = codiceGruppo,
                [GLOBAL_VARIABLES.keyMembriGruppoFoto] = membri.ToList()
            }
        };
    }

    private static FotoElementoGruppo Membro(string codRef, byte stato)
    {
        return new FotoElementoGruppo { codRef = codRef, statoSelezione = stato, nomeFoto = codRef + ".psd", hash = "h" };
    }

    [Fact]
    public void Applica_noRender_a_primaria_e_secondaria_del_box()
    {
        var box = Box("3150596,3150599", Membro("3150596", 1), Membro("3150599", 2));
        var mappa = new Dictionary<string, bool>
        {
            ["3150596,3150599|3150596"] = true,
            ["3150596,3150599|3150599"] = false
        };

        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(new List<ArticoloInKit> { box }, mappa);

        var membri = (List<FotoElementoGruppo>)box.recordInTracciato[GLOBAL_VARIABLES.keyMembriGruppoFoto];
        Assert.True(membri.Single(m => m.codRef == "3150596").noRender);
        Assert.False(membri.Single(m => m.codRef == "3150599").noRender);
    }

    [Fact]
    public void Lo_stesso_codice_in_un_altro_gruppo_non_viene_toccato()
    {
        // Il codice referenza da solo non identifica la foto: serve anche il codice gruppo.
        var boxA = Box("gruppoA", Membro("3150596", 1));
        var boxB = Box("gruppoB", Membro("3150596", 1));
        var mappa = new Dictionary<string, bool> { ["gruppoA|3150596"] = true };

        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(new List<ArticoloInKit> { boxA, boxB }, mappa);

        Assert.True(((List<FotoElementoGruppo>)boxA.recordInTracciato[GLOBAL_VARIABLES.keyMembriGruppoFoto]).Single().noRender);
        Assert.False(((List<FotoElementoGruppo>)boxB.recordInTracciato[GLOBAL_VARIABLES.keyMembriGruppoFoto]).Single().noRender);
    }

    [Fact]
    public void Senza_voce_nei_meta_il_membro_resta_a_false()
    {
        var box = Box("3150596,3150599", Membro("3150596", 1), Membro("3150599", 2));
        var mappa = new Dictionary<string, bool> { ["3150596,3150599|3150596"] = true };

        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(new List<ArticoloInKit> { box }, mappa);

        var membri = (List<FotoElementoGruppo>)box.recordInTracciato[GLOBAL_VARIABLES.keyMembriGruppoFoto];
        Assert.False(membri.Single(m => m.codRef == "3150599").noRender);
    }

    [Fact]
    public void Mappa_vuota_o_record_senza_membri_non_sollevano_eccezioni()
    {
        var boxSenzaMembri = new ArticoloInKit
        {
            recordInTracciato = new Dictionary<string, object> { [KeyCodiceGruppo] = "gruppoA" }
        };

        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(new List<ArticoloInKit> { boxSenzaMembri }, new Dictionary<string, bool> { ["gruppoA|x"] = true });
        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(new List<ArticoloInKit> { boxSenzaMembri }, null);
        FicoProcessController.applicaNoRenderAiMembriGruppoFoto(null, new Dictionary<string, bool>());
    }
}
