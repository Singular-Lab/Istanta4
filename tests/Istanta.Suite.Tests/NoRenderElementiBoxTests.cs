using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-968: opzione noRender sugli elementi del box (campi, loghi, foto extra).
/// Vive nella struttura noRender dei meta, separata da ps che regge le foto primarie/secondarie.
/// Nei meta finiscono solo gli elementi marcati: togliere il noRender rimuove la voce.
/// </summary>
public class NoRenderElementiMetaTests
{
    [Fact]
    public void Meta_senza_noRender_non_espone_elementi()
    {
        // Forma dei meta salvati prima di questa modifica.
        const string metaLegacy = "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1}]}";

        var meta = MetaPromoLavorazioni.leggi(metaLegacy);

        Assert.NotNull(meta);
        Assert.Null(meta!.noRender);
    }

    [Fact]
    public void Round_trip_conserva_tipo_chiave_e_nome_di_ogni_elemento()
    {
        var originale = new RevisioneMetaPromoLavorazioni
        {
            noRender = new List<RevisioneNoRenderFromIndd>
            {
                new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio", nome = "Logo biologico" },
                new() { tipo = TipoElementoBox.Campo, chiave = "PIEDE_Titolari", nome = "PIEDE_Titolari" }
            }
        };

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(originale));

        Assert.Equal(2, riletto!.noRender!.Count);
        var logo = riletto.noRender!.Single(e => e.chiave == "logo_bio");
        Assert.Equal(TipoElementoBox.Logo, logo.tipo);
        Assert.Equal("Logo biologico", logo.nome);
        Assert.Equal(TipoElementoBox.Campo, riletto.noRender!.Single(e => e.chiave == "PIEDE_Titolari").tipo);
    }

    [Fact]
    public void Elemento_con_chiave_null_non_fa_fallire_la_lettura()
    {
        // Stessa tolleranza dei meta gia' applicata alle altre strutture (SRF-04).
        const string meta = "{\"noRender\":[{\"tipo\":null,\"chiave\":\"logo_bio\",\"nome\":null}]}";

        var letto = MetaPromoLavorazioni.leggi(meta);

        var elemento = Assert.Single(letto!.noRender!);
        Assert.Equal("logo_bio", elemento.chiave);
        Assert.Equal(default(TipoElementoBox), elemento.tipo);
    }

    [Fact]
    public void Le_due_strutture_non_si_toccano()
    {
        // Le foto primarie/secondarie restano su ps, gli altri elementi sulla nuova struttura:
        // scrivere l'una non deve alterare l'altra.
        var meta = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd>
            {
                new() { codRef = "3150596", stato = StatoSelezioneFoto.Primaria, noRender = true }
            },
            noRender = new List<RevisioneNoRenderFromIndd>
            {
                new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio", nome = "Logo biologico" }
            }
        };

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));

        Assert.True(riletto!.ps!.Single().noRender);
        Assert.Equal("logo_bio", Assert.Single(riletto.noRender!).chiave);
    }
}

/// <summary>
/// Regola dell'elenco vuoto: i meta non conservano liste vuote, altrimenti ogni box
/// toccato una volta si porterebbe dietro una chiave inutile.
/// </summary>
public class NormalizzaElementiNoRenderTests
{
    [Fact]
    public void Elenco_vuoto_toglie_la_chiave_dai_meta()
    {
        Assert.Null(MetaPromoLavorazioni.normalizzaElementiNoRender(new List<RevisioneNoRenderFromIndd>()));
    }

    [Fact]
    public void Elenco_nullo_resta_nullo()
    {
        Assert.Null(MetaPromoLavorazioni.normalizzaElementiNoRender(null));
    }

    [Fact]
    public void Elenco_valorizzato_viene_conservato()
    {
        var elementi = new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.FotoExtra, chiave = "sfondo_vn" }
        };

        Assert.Same(elementi, MetaPromoLavorazioni.normalizzaElementiNoRender(elementi));
    }
}

/// <summary>
/// Consegna al Plugin: gli elementi del box viaggiano sotto la chiave noRenderElementi
/// del record, unico posto in cui il Plugin li cerca.
/// </summary>
public class ApplicaNoRenderElementiTests
{
    private const string KeyCodiceGruppo = "Scatto.CodiceGruppo";

    private static ArticoloInKit Box(string codiceGruppo)
    {
        return new ArticoloInKit
        {
            recordInTracciato = new Dictionary<string, object>
            {
                [KeyCodiceGruppo] = codiceGruppo
            }
        };
    }

    private static List<RevisioneNoRenderFromIndd> Elementi(params string[] chiavi)
    {
        return chiavi
            .Select(c => new RevisioneNoRenderFromIndd { tipo = TipoElementoBox.Logo, chiave = c, nome = c })
            .ToList();
    }

    [Fact]
    public void Ogni_box_riceve_soltanto_i_propri_elementi()
    {
        var boxA = Box("3150596");
        var boxB = Box("4831132");
        var mappa = new Dictionary<string, List<RevisioneNoRenderFromIndd>>
        {
            ["3150596"] = Elementi("logo_bio"),
            ["4831132"] = Elementi("logo_conv")
        };

        FicoProcessController.applicaNoRenderAgliElementiDelBox(new List<ArticoloInKit> { boxA, boxB }, mappa);

        Assert.Equal("logo_bio", ((List<RevisioneNoRenderFromIndd>)boxA.recordInTracciato[GLOBAL_VARIABLES.keyNoRenderElementi]).Single().chiave);
        Assert.Equal("logo_conv", ((List<RevisioneNoRenderFromIndd>)boxB.recordInTracciato[GLOBAL_VARIABLES.keyNoRenderElementi]).Single().chiave);
    }

    [Fact]
    public void Un_box_senza_elementi_marcati_non_riceve_la_chiave()
    {
        var box = Box("3150596");

        FicoProcessController.applicaNoRenderAgliElementiDelBox(
            new List<ArticoloInKit> { box },
            new Dictionary<string, List<RevisioneNoRenderFromIndd>> { ["4831132"] = Elementi("logo_conv") });

        Assert.False(box.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyNoRenderElementi));
    }

    [Fact]
    public void Mappa_vuota_lascia_il_record_intatto()
    {
        var box = Box("3150596");

        FicoProcessController.applicaNoRenderAgliElementiDelBox(
            new List<ArticoloInKit> { box },
            new Dictionary<string, List<RevisioneNoRenderFromIndd>>());

        Assert.False(box.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyNoRenderElementi));
    }
}

/// <summary>
/// Fusione delle selezioni foto nei meta. Le foto primarie/secondarie hanno un canale
/// separato da quello degli elementi del box: scrivere l'uno non deve cancellare l'altro,
/// e la lista ps puo' mancare del tutto perche' il meta puo' venire da un'altra operazione.
/// </summary>
public class ApplicaSelezioniFotoTests
{
    private static RevisioneSelezioneFotoFromIndd Selezione(string codRef, StatoSelezioneFoto stato, bool noRender)
    {
        return new RevisioneSelezioneFotoFromIndd { codRef = codRef, stato = stato, noRender = noRender };
    }

    [Fact]
    public void Un_meta_senza_lista_ps_accoglie_la_selezione_invece_di_esplodere()
    {
        // Un meta scritto dal flusso noRender puo' arrivare senza la chiave ps: prima qui
        // si sollevava NullReferenceException e l'aggiornamento delle foto si perdeva.
        var meta = MetaPromoLavorazioni.leggi("{\"noRender\":[{\"tipo\":2,\"chiave\":\"logo_bio\"}]}")!;
        Assert.Null(meta.ps);

        MetaPromoLavorazioni.applicaSelezioniFoto(meta, new List<RevisioneSelezioneFotoFromIndd>
        {
            Selezione("3150596", StatoSelezioneFoto.Primaria, true)
        });

        var voce = Assert.Single(meta.ps!);
        Assert.Equal("3150596", voce.codRef);
        Assert.True(voce.noRender);
    }

    [Fact]
    public void Una_voce_gia_presente_viene_aggiornata_non_duplicata()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd> { Selezione("3150596", StatoSelezioneFoto.Primaria, false) }
        };

        MetaPromoLavorazioni.applicaSelezioniFoto(meta, new List<RevisioneSelezioneFotoFromIndd>
        {
            Selezione("3150596", StatoSelezioneFoto.Selezionata, true)
        });

        var voce = Assert.Single(meta.ps!);
        Assert.Equal(StatoSelezioneFoto.Selezionata, voce.stato);
        Assert.True(voce.noRender);
    }

    [Fact]
    public void Salvare_le_foto_non_cancella_gli_elementi_del_box()
    {
        // E' il difetto che si vedeva: i due canali scrivono sullo stesso meta e uno dei due
        // spariva. Qui si verifica che la fusione lasci intatta l'altra struttura.
        var meta = new RevisioneMetaPromoLavorazioni
        {
            noRender = new List<RevisioneNoRenderFromIndd>
            {
                new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio", nome = "Logo biologico" }
            }
        };

        MetaPromoLavorazioni.applicaSelezioniFoto(meta, new List<RevisioneSelezioneFotoFromIndd>
        {
            Selezione("3150596", StatoSelezioneFoto.Primaria, true)
        });

        Assert.True(Assert.Single(meta.ps!).noRender);
        Assert.Equal("logo_bio", Assert.Single(meta.noRender!).chiave);
    }

    [Fact]
    public void Salvare_gli_elementi_non_cancella_le_foto()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd> { Selezione("3150596", StatoSelezioneFoto.Primaria, true) }
        };

        meta.noRender = MetaPromoLavorazioni.normalizzaElementiNoRender(new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio" }
        });

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta))!;

        Assert.True(Assert.Single(riletto.ps!).noRender);
        Assert.Equal("logo_bio", Assert.Single(riletto.noRender!).chiave);
    }

    [Fact]
    public void Selezioni_assenti_o_vuote_non_toccano_il_meta()
    {
        var meta = new RevisioneMetaPromoLavorazioni();

        MetaPromoLavorazioni.applicaSelezioniFoto(meta, null);
        MetaPromoLavorazioni.applicaSelezioniFoto(meta, new List<RevisioneSelezioneFotoFromIndd>());

        Assert.Null(meta.ps);
    }
}
