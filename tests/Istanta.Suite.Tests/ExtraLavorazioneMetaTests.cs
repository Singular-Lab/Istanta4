using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1070: le foto extra decise dall'operatore per questa sola lavorazione. Vivono nel meta del
/// record (extraLavorazione), una voce per sigla e tipo, con tre azioni: sovrascrivi (immagine del
/// box al posto di quella del server), aggiungi (foto extra in piu' nel box, tenuta solo qui),
/// escludi (foto extra del dato che qui non si vuole). Il server le applica ai record dopo
/// l'export di agenzia e le consegna al Plugin, che le mostra e le puo' togliere.
/// </summary>
public class ExtraLavorazioneMetaTests
{
    private static readonly string KeyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
    private static readonly string KeyExtraAuto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtraAuto;
    private static readonly string KeyExtra = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtra;

    private static RichiestaExtraLavorazione Richiesta(AzioneExtraLavorazione azione, string sigla, string? nome = null, string? nomeServer = null, bool rimuovi = false, TipoElementoBox tipo = TipoElementoBox.Logo, int tipoFoto = 3)
    {
        return new RichiestaExtraLavorazione
        {
            rimuovi = rimuovi,
            voce = new RevisioneExtraLavorazioneFromIndd { tipo = tipo, sigla = sigla, azione = azione, nome = nome, nomeServer = nomeServer, tipoFoto = tipoFoto }
        };
    }

    /* ---- il meta ---- */

    [Fact]
    public void Meta_senza_decisioni_non_le_espone()
    {
        var meta = MetaPromoLavorazioni.leggi("{\"ps\":[{\"codRef\":\"3150596\",\"stato\":1}]}");

        Assert.NotNull(meta);
        Assert.Null(meta!.extraLavorazione);
    }

    [Fact]
    public void Round_trip_conserva_tipo_sigla_azione_e_nomi()
    {
        var originale = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaExtraLavorazione(originale, Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", "Logo_BDP_2025.psd", "Logo_BDP_2026.psd"));

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(originale));

        var voce = Assert.Single(riletto!.extraLavorazione!);
        Assert.Equal(TipoElementoBox.Logo, voce.tipo);
        Assert.Equal("Logo_BDP", voce.sigla);
        Assert.Equal(AzioneExtraLavorazione.Sovrascrivi, voce.azione);
        Assert.Equal("Logo_BDP_2025.psd", voce.nome);
        Assert.Equal("Logo_BDP_2026.psd", voce.nomeServer);
        Assert.Equal(3, voce.tipoFoto);
    }

    [Fact]
    public void Una_decisione_nuova_sulla_stessa_foto_sostituisce_la_precedente()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", "vecchio.psd"));
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP"));
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Aggiungi, "Logo_SDB", "Logo_SDB.psd"));

        Assert.Equal(2, meta.extraLavorazione!.Count);
        Assert.Equal(AzioneExtraLavorazione.Escludi, meta.extraLavorazione.Single(v => v.sigla == "Logo_BDP").azione);
        Assert.Equal(AzioneExtraLavorazione.Aggiungi, meta.extraLavorazione.Single(v => v.sigla == "Logo_SDB").azione);
    }

    [Fact]
    public void Togliere_l_ultima_decisione_fa_sparire_la_chiave()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP"));
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP", rimuovi: true));

        Assert.Null(meta.extraLavorazione);
        Assert.DoesNotContain("extraLavorazione", JsonConvert.SerializeObject(meta, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore }));
    }

    [Fact]
    public void Una_richiesta_vuota_o_senza_sigla_non_tocca_il_meta()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, null);
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, new RichiestaExtraLavorazione());
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, Richiesta(AzioneExtraLavorazione.Escludi, " "));

        Assert.Null(meta.extraLavorazione);
    }

    [Fact]
    public void La_richiesta_si_valida_prima_di_registrarla()
    {
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", "a.psd")));
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP")));
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", rimuovi: true)));

        Assert.Contains("manca la voce", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(null));
        Assert.Contains("manca la sigla", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Escludi, "")));
        Assert.Contains("non e' una foto extra", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Escludi, "x", tipo: TipoElementoBox.Campo)));
        Assert.Contains("non esiste", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta((AzioneExtraLavorazione)9, "x")));
        Assert.Contains("serve il nome del file", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Aggiungi, "x")));
        Assert.Contains("serve il nome del file", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(Richiesta(AzioneExtraLavorazione.Sovrascrivi, "x", "")));
    }

    [Fact]
    public void La_richiesta_del_Plugin_si_legge_dal_JSON()
    {
        var letta = MetaPromoLavorazioni.leggiRichiestaExtraLavorazione("{\"rimuovi\":false,\"voce\":{\"tipo\":2,\"sigla\":\"Logo_BDP\",\"azione\":1,\"nome\":\"a.psd\",\"nomeServer\":\"b.psd\",\"tipoFoto\":3}}");

        Assert.NotNull(letta);
        Assert.False(letta!.rimuovi);
        Assert.Equal(TipoElementoBox.Logo, letta.voce!.tipo);
        Assert.Equal(AzioneExtraLavorazione.Sovrascrivi, letta.voce.azione);
        Assert.Equal("a.psd", letta.voce.nome);
    }

    /* ---- l'applicazione ai record ---- */

    private static ArticoloInKit Record(string codGruppo, List<LogoBollo>? automatiche = null, List<LogoBollo_ExtraNoAuto>? manuali = null)
    {
        var record = new ArticoloInKit { recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = codGruppo } };
        if (automatiche != null)
        {
            record.recordInTracciato[KeyExtraAuto] = automatiche;
        }
        if (manuali != null)
        {
            record.recordInTracciato[KeyExtra] = manuali;
        }
        return record;
    }

    private static LogoBollo Logo(string sigla, string nome) => new() { sigla = sigla, nome = nome, tipo = TipoFoto.Logo, guidId = "g-" + sigla, id = "1" };

    private static Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>> PerGruppo(string codGruppo, params RichiestaExtraLavorazione[] richieste)
    {
        return new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>> { [codGruppo] = richieste.Select(r => r.voce!).ToList() };
    }

    [Fact]
    public void Sovrascrivi_cambia_il_nome_della_foto_con_quella_sigla_automatica_e_manuale()
    {
        var record = Record("123",
            new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP_2026.psd"), Logo("Logo_SDB", "Logo_SDB.psd") },
            new List<LogoBollo_ExtraNoAuto> { new() { sigla = "payoff", nome = "payoff_2026.psd", attiva = true } });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record },
            PerGruppo("123", Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", "Logo_BDP_2025.psd", "Logo_BDP_2026.psd"),
                Richiesta(AzioneExtraLavorazione.Sovrascrivi, "payoff", "payoff_box.psd", tipo: TipoElementoBox.FotoExtra)));

        var automatiche = (List<LogoBollo>)record.recordInTracciato[KeyExtraAuto];
        Assert.Equal("Logo_BDP_2025.psd", automatiche.Single(l => l.sigla == "Logo_BDP").nome);
        Assert.Equal("Logo_SDB.psd", automatiche.Single(l => l.sigla == "Logo_SDB").nome);
        Assert.Equal("payoff_box.psd", ((List<LogoBollo_ExtraNoAuto>)record.recordInTracciato[KeyExtra]).Single().nome);

        var decise = Assert.IsType<List<RevisioneExtraLavorazioneFromIndd>>(record.recordInTracciato[GLOBAL_VARIABLES.keyExtraLavorazione]);
        Assert.Equal(2, decise.Count);
        Assert.Equal("Logo_BDP_2026.psd", decise.Single(v => v.sigla == "Logo_BDP").nomeServer);
    }

    [Fact]
    public void Aggiungi_mette_la_foto_del_box_fra_le_automatiche_anche_se_il_record_non_ne_aveva()
    {
        var record = Record("123");

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record },
            PerGruppo("123", Richiesta(AzioneExtraLavorazione.Aggiungi, "Logo_locale", "Logo_locale.psd", tipoFoto: 3)));

        var aggiunta = Assert.Single((List<LogoBollo>)record.recordInTracciato[KeyExtraAuto]);
        Assert.Equal("Logo_locale", aggiunta.sigla);
        Assert.Equal("Logo_locale.psd", aggiunta.nome);
        Assert.Equal(TipoFoto.Logo, aggiunta.tipo);
        Assert.False(aggiunta.escluso);
        Assert.Equal("", aggiunta.guidId);
    }

    [Fact]
    public void Aggiungi_non_duplica_una_sigla_che_il_dato_ha_gia_e_senza_tipoFoto_usa_il_tipo_della_voce()
    {
        var record = Record("123", new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP_2026.psd") });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record },
            PerGruppo("123", Richiesta(AzioneExtraLavorazione.Aggiungi, "Logo_BDP", "altro.psd"),
                Richiesta(AzioneExtraLavorazione.Aggiungi, "bollo_x", "bollo_x.psd", tipo: TipoElementoBox.FotoExtra, tipoFoto: 0)));

        var automatiche = (List<LogoBollo>)record.recordInTracciato[KeyExtraAuto];
        Assert.Equal(2, automatiche.Count);
        Assert.Equal("Logo_BDP_2026.psd", automatiche.Single(l => l.sigla == "Logo_BDP").nome);
        Assert.Equal(TipoFoto.Foto, automatiche.Single(l => l.sigla == "bollo_x").tipo);
    }

    [Fact]
    public void Escludi_segna_esclusa_l_automatica_e_non_attiva_la_manuale()
    {
        var record = Record("123",
            new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP.psd") },
            new List<LogoBollo_ExtraNoAuto> { new() { sigla = "payoff", nome = "payoff.psd", attiva = true } });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record },
            PerGruppo("123", Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP"), Richiesta(AzioneExtraLavorazione.Escludi, "payoff", tipo: TipoElementoBox.FotoExtra)));

        Assert.True(((List<LogoBollo>)record.recordInTracciato[KeyExtraAuto]).Single().escluso);
        Assert.False(((List<LogoBollo_ExtraNoAuto>)record.recordInTracciato[KeyExtra]).Single().attiva);
    }

    [Fact]
    public void Le_decisioni_valgono_solo_per_il_loro_gruppo()
    {
        var mio = Record("123", new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP.psd") });
        var altro = Record("456", new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP.psd") });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { mio, altro }, PerGruppo("123", Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP")));

        Assert.True(((List<LogoBollo>)mio.recordInTracciato[KeyExtraAuto]).Single().escluso);
        Assert.False(((List<LogoBollo>)altro.recordInTracciato[KeyExtraAuto]).Single().escluso);
        Assert.False(altro.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyExtraLavorazione));
    }

    [Fact]
    public void Una_lista_arrivata_da_cache_come_JArray_si_tipizza_e_la_modifica_resta()
    {
        var record = Record("123");
        record.recordInTracciato[KeyExtraAuto] = JArray.FromObject(new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP_2026.psd") });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record },
            PerGruppo("123", Richiesta(AzioneExtraLavorazione.Sovrascrivi, "Logo_BDP", "Logo_BDP_2025.psd")));

        var automatiche = Assert.IsType<List<LogoBollo>>(record.recordInTracciato[KeyExtraAuto]);
        Assert.Equal("Logo_BDP_2025.psd", automatiche.Single().nome);
    }

    [Fact]
    public void Senza_decisioni_o_senza_record_non_succede_niente()
    {
        var record = Record("123", new List<LogoBollo> { Logo("Logo_BDP", "Logo_BDP.psd") });

        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record }, null);
        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { record }, new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>());
        FicoProcessController.applicaExtraDellaLavorazione(null, PerGruppo("123", Richiesta(AzioneExtraLavorazione.Escludi, "Logo_BDP")));

        Assert.False(((List<LogoBollo>)record.recordInTracciato[KeyExtraAuto]).Single().escluso);
        Assert.False(record.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyExtraLavorazione));
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void Le_due_letture_del_dato_applicano_le_decisioni_dopo_l_export_di_agenzia()
    {
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");

        //getSchedaRef: raccolta dal meta e applicazione dopo le foto escluse.
        Assert.Contains("ficoController.updateDatiFromMetaPromoLavorazioni(prepLista.records, idLavorazione, kit!, noRenderPerRef, noRenderElementiPerGruppo, extraLavorazionePerGruppo);", menabo);
        Assert.Contains("FicoProcessController.applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", menabo);
        Assert.True(menabo.IndexOf("MB Scheda 12977 - Escludo foto", StringComparison.Ordinal) < menabo.IndexOf("FicoProcessController.applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal));

        //processaKitDo, la strada dell'impaginazione.
        Assert.Contains("updateDatiFromMetaPromoLavorazioni(recordsFiltrati, idLavorazione, kit/*, confronto*/, noRenderPerRef, noRenderElementiPerGruppo, extraLavorazionePerGruppo);", fico);
        Assert.Contains("applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", fico);
        Assert.True(fico.IndexOf("FicoProcess 2802 - Escludo foto", StringComparison.Ordinal) < fico.IndexOf("applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal));

        //Dal meta di questa lavorazione soltanto: la raccolta sta dopo quella del noRender della
        //lavorazione corrente, non nel ramo delle lavorazioni passate.
        Assert.Contains("extraLavorazionePerGruppo[group.Key.CodiceGruppo] = storeField.extraLavorazione;", fico);
        Assert.DoesNotContain("recPassato.extraLavorazione", fico);
    }

    [Fact]
    public void Il_registro_e_l_endpoint_registrano_la_decisione()
    {
        string register = Sorgente("Istanta/Utility/Register.cs");
        Assert.Contains("operazione.TipoOperazione == (Byte)tipoOperazione.updateExtraLavorazione", register);
        Assert.Contains("MetaPromoLavorazioni.applicaExtraLavorazione(storeField!, MetaPromoLavorazioni.leggiRichiestaExtraLavorazione(operazione.FormData!));", register);

        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        Assert.Contains("[Route(\"Menabo/modificaExtraLavorazione/{idOperazione}\")]", menabo);
        Assert.Contains("tipoOperazione.updateExtraLavorazione,", menabo);
        //A differenza di modificaNoRender, un esito diverso da ok e' un errore per il Plugin.
        Assert.Contains("if (esito != \"ok\")", menabo);
        Assert.Contains("result.error = DescrizioneErrori.Breve(\"modificaExtraLavorazione\", ex);", menabo);
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
