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
    public void La_selezione_della_foto_resta_su_ps_ma_il_noRender_confluisce_negli_elementi()
    {
        // ps continua a portare la selezione primaria/secondaria: quello che se ne va e'
        // soltanto l'opzione di rendering, che ora vive con gli altri elementi del box.
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

        Assert.Equal(StatoSelezioneFoto.Primaria, riletto!.ps!.Single().stato);
        Assert.Equal(2, riletto.noRender!.Count);
        Assert.Contains(riletto.noRender!, e => e.tipo == TipoElementoBox.Logo && e.chiave == "logo_bio");
        Assert.Contains(riletto.noRender!, e => e.tipo == TipoElementoBox.Foto && e.chiave == "3150596");
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
        // Con il canale unico foto e altri elementi stanno nella stessa lista, che si scrive
        // intera: nessuno dei due puo' piu' sovrascrivere il lavoro dell'altro.
        var elementi = MetaPromoLavorazioni.normalizzaElementiNoRender(new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio" },
            new() { tipo = TipoElementoBox.Foto, chiave = "3150596", nome = "primaria.psd" }
        });

        var riletto = MetaPromoLavorazioni.leggi(
            JsonConvert.SerializeObject(new RevisioneMetaPromoLavorazioni { noRender = elementi }));

        Assert.Equal(2, riletto!.noRender!.Count);
        Assert.Contains(riletto.noRender!, e => e.tipo == TipoElementoBox.Foto && e.chiave == "3150596");
        Assert.Contains(riletto.noRender!, e => e.tipo == TipoElementoBox.Logo && e.chiave == "logo_bio");
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

/// <summary>
/// Le foto primarie/secondarie sono passate dalla struttura ps a quella degli elementi del
/// box. I meta gia' salvati marcano le foto dentro ps: vanno convertiti alla lettura, o le
/// marcature fatte dagli operatori andrebbero perse.
/// </summary>
public class MigrazioneNoRenderDelleFotoTests
{
    [Fact]
    public void Un_meta_storico_porta_la_foto_nella_struttura_unica()
    {
        const string metaStorico = "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1,\"noRender\":true}]}";

        var meta = MetaPromoLavorazioni.leggi(metaStorico);

        var elemento = Assert.Single(meta!.noRender!);
        Assert.Equal(TipoElementoBox.Foto, elemento.tipo);
        Assert.Equal("3150596", elemento.chiave);
    }

    [Fact]
    public void Una_foto_non_marcata_non_genera_nulla()
    {
        const string metaStorico = "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1,\"noRender\":false}]}";

        var meta = MetaPromoLavorazioni.leggi(metaStorico);

        Assert.Null(meta!.noRender);
    }

    [Fact]
    public void La_voce_non_viene_duplicata_se_gia_presente()
    {
        const string meta =
            "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1,\"noRender\":true}]," +
            "\"noRender\":[{\"tipo\":5,\"chiave\":\"3150596\",\"nome\":\"primaria.psd\"}]}";

        var letto = MetaPromoLavorazioni.leggi(meta);

        var elemento = Assert.Single(letto!.noRender!);
        Assert.Equal("primaria.psd", elemento.nome);
    }

    [Fact]
    public void La_migrazione_non_tocca_gli_altri_elementi()
    {
        const string meta =
            "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1,\"noRender\":true}]," +
            "\"noRender\":[{\"tipo\":2,\"chiave\":\"logo_bio\"}]}";

        var letto = MetaPromoLavorazioni.leggi(meta);

        Assert.Equal(2, letto!.noRender!.Count);
        Assert.Contains(letto.noRender!, e => e.tipo == TipoElementoBox.Logo && e.chiave == "logo_bio");
        Assert.Contains(letto.noRender!, e => e.tipo == TipoElementoBox.Foto && e.chiave == "3150596");
    }

    [Fact]
    public void Una_foto_marcata_sopravvive_al_giro_completo_del_meta()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            noRender = new List<RevisioneNoRenderFromIndd>
            {
                new() { tipo = TipoElementoBox.Foto, chiave = "3150596", nome = "primaria.psd" }
            }
        };

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));

        var elemento = Assert.Single(riletto!.noRender!);
        Assert.Equal(TipoElementoBox.Foto, elemento.tipo);
        Assert.Equal("3150596", elemento.chiave);
    }

    [Fact]
    public void Un_meta_senza_ps_non_disturba_la_migrazione()
    {
        var meta = MetaPromoLavorazioni.leggi("{\"noRender\":[{\"tipo\":2,\"chiave\":\"logo_bio\"}]}");

        Assert.Single(meta!.noRender!);
    }
}

/// <summary>
/// I20-977: una foto riattivata dal modal tornava fra gli elementi disattivati.
///
/// Le foto portano il noRender in due posti: la struttura nuova del box e il vecchio flag
/// dentro ps, che la lettura dei meta considera un dato storico da migrare. Il modal riscrive
/// solo la struttura nuova, quindi la foto liberata veniva riportata indietro dalla migrazione
/// alla prima rilettura, e la pre analisi la segnalava come disattivata mentre il box la
/// mostrava. Questi casi guardano la scrittura, che ora allinea i due posti.
/// </summary>
public class AllineamentoNoRenderDelleFotoTests
{
    /// Quello che fa il server quando applica updateNoRender: sostituisce l'elenco e allinea.
    private static RevisioneMetaPromoLavorazioni salvaDalModal(
        RevisioneMetaPromoLavorazioni meta, List<RevisioneNoRenderFromIndd> elementi)
    {
        meta.noRender = MetaPromoLavorazioni.normalizzaElementiNoRender(elementi);
        MetaPromoLavorazioni.allineaNoRenderDelleFoto(meta);
        return meta;
    }

    private static RevisioneMetaPromoLavorazioni metaConFotoDisattivata() => new()
    {
        ps = new List<RevisioneSelezioneFotoFromIndd>
        {
            new() { codRef = "3150596", stato = StatoSelezioneFoto.Primaria, noRender = true }
        },
        noRender = new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.Foto, chiave = "3150596", nome = "primaria.psd" }
        }
    };

    // Il caso del difetto, dal salvataggio alla rilettura.
    [Fact]
    public void Una_foto_riattivata_non_torna_disattivata_alla_lettura_successiva()
    {
        var meta = salvaDalModal(metaConFotoDisattivata(), new List<RevisioneNoRenderFromIndd>());

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));

        Assert.True(riletto!.noRender == null || riletto.noRender.Count == 0);
    }

    [Fact]
    public void Riattivare_una_foto_libera_anche_il_flag_storico()
    {
        var meta = salvaDalModal(metaConFotoDisattivata(), new List<RevisioneNoRenderFromIndd>());

        Assert.False(Assert.Single(meta.ps!).noRender);
    }

    // L'allineamento non deve liberare quello che l'operatore ha appena marcato.
    [Fact]
    public void Una_foto_marcata_dal_modal_resta_marcata_anche_in_ps()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd>
            {
                new() { codRef = "3150596", stato = StatoSelezioneFoto.Primaria, noRender = false },
                new() { codRef = "3150597", stato = StatoSelezioneFoto.Selezionata, noRender = false }
            }
        };

        salvaDalModal(meta, new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.Foto, chiave = "3150596", nome = "primaria.psd" }
        });

        Assert.True(meta.ps!.Single(s => s.codRef == "3150596").noRender);
        Assert.False(meta.ps!.Single(s => s.codRef == "3150597").noRender);

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));
        Assert.Single(riletto!.noRender!);
    }

    // Gli altri elementi del box non hanno nulla dentro ps: l'allineamento non deve toccarli.
    [Fact]
    public void Loghi_e_campi_non_vengono_sfiorati_dall_allineamento()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            ps = new List<RevisioneSelezioneFotoFromIndd>
            {
                new() { codRef = "3150596", stato = StatoSelezioneFoto.Primaria, noRender = true }
            }
        };

        salvaDalModal(meta, new List<RevisioneNoRenderFromIndd>
        {
            new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio", nome = "Logo bio" }
        });

        Assert.False(Assert.Single(meta.ps!).noRender);
        Assert.Equal(TipoElementoBox.Logo, Assert.Single(meta.noRender!).tipo);
    }

    [Fact]
    public void Un_meta_senza_ps_non_fa_fallire_l_allineamento()
    {
        var meta = new RevisioneMetaPromoLavorazioni
        {
            noRender = new List<RevisioneNoRenderFromIndd>
            {
                new() { tipo = TipoElementoBox.Foto, chiave = "3150596" }
            }
        };

        MetaPromoLavorazioni.allineaNoRenderDelleFoto(meta);
        MetaPromoLavorazioni.allineaNoRenderDelleFoto(null);

        Assert.Single(meta.noRender!);
    }

    // La migrazione serve ancora ai meta che dal modal non sono mai passati: allineare in
    // scrittura non deve togliere le marcature storiche a chi non ha ancora salvato.
    [Fact]
    public void I_meta_storici_mai_passati_dal_modal_continuano_a_migrare()
    {
        var storico = "{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1,\"noRender\":true}]}";

        var riletto = MetaPromoLavorazioni.leggi(storico);

        var elemento = Assert.Single(riletto!.noRender!);
        Assert.Equal(TipoElementoBox.Foto, elemento.tipo);
        Assert.Equal("3150596", elemento.chiave);
    }
}
