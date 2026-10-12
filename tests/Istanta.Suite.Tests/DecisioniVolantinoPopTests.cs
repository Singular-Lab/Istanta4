using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1082: le decisioni sulle foto extra prese solo per una lavorazione volantino valgono anche per
/// i POP della stessa promo, area e canale (ambito Tutto, anche per quelle registrate prima), oppure
/// solo per il volantino (SoloVolantino). Il POP non ha la scheda ref e non decide: riceve. Se
/// chiedere l'ambito lo dichiara l'agenzia nel SourceCustomPlugin: Coop si', gli altri no.
/// </summary>
public class DecisioniVolantinoPopTests
{
    private static readonly string KeyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
    private static readonly string KeyRefCodice = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;
    private static readonly string KeyExtraAuto = Enum.GetName(AddestramentoRuoli.Foto) + "." + GLOBAL_VARIABLES.keyFotoExtraAuto;

    private static RevisioneExtraLavorazioneFromIndd Escludi(string sigla, AmbitoDecisioneLavorazione ambito = AmbitoDecisioneLavorazione.Tutto) =>
        new() { tipo = TipoElementoBox.Logo, sigla = sigla, azione = AzioneExtraLavorazione.Escludi, nomeServer = sigla + ".psd", tipoFoto = 3, ambito = ambito };

    private static ArticoloInKit RecordPop(string codGruppo, string codice, params string[] loghi)
    {
        return new ArticoloInKit
        {
            recordInTracciato = new Dictionary<string, object>
            {
                [KeyCodGruppo] = codGruppo,
                [KeyRefCodice] = codice,
                [KeyExtraAuto] = loghi.Select(l => new LogoBollo { sigla = l, nome = l + ".psd", tipo = TipoFoto.Logo, guidId = "g-" + l, id = "1" }).ToList()
            }
        };
    }

    private static FicoProcessController.DecisioniDelVolantino Volantino(string codiceGruppo, params RevisioneExtraLavorazioneFromIndd[] voci) =>
        new() { CodiceGruppo = codiceGruppo, voci = voci.ToList() };

    /* ---- l'ambito nel meta ---- */

    [Fact]
    public void Le_decisioni_registrate_prima_valgono_per_tutto()
    {
        var meta = MetaPromoLavorazioni.leggi("{\"extraLavorazione\":[{\"tipo\":2,\"sigla\":\"Logo_SDB\",\"azione\":3,\"nomeServer\":\"Logo_SDB.psd\",\"tipoFoto\":3}]}");

        Assert.Equal(AmbitoDecisioneLavorazione.Tutto, meta!.extraLavorazione!.Single().ambito);
    }

    [Fact]
    public void Solo_volantino_si_salva_e_si_rilegge()
    {
        var meta = new RevisioneMetaPromoLavorazioni();
        MetaPromoLavorazioni.applicaExtraLavorazione(meta, new RichiestaExtraLavorazione { voce = Escludi("Logo_SDB", AmbitoDecisioneLavorazione.SoloVolantino) });

        var riletto = MetaPromoLavorazioni.leggi(JsonConvert.SerializeObject(meta));

        Assert.Equal(AmbitoDecisioneLavorazione.SoloVolantino, riletto!.extraLavorazione!.Single().ambito);
    }

    [Fact]
    public void Un_ambito_che_non_esiste_si_rifiuta()
    {
        var voce = Escludi("Logo_SDB");
        voce.ambito = (AmbitoDecisioneLavorazione)5;

        Assert.Contains("l'ambito 5 non esiste", MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(new RichiestaExtraLavorazione { voce = voce }));
        Assert.Null(MetaPromoLavorazioni.erroreDellaRichiestaExtraLavorazione(new RichiestaExtraLavorazione { voce = Escludi("Logo_SDB", AmbitoDecisioneLavorazione.SoloVolantino) }));
    }

    /* ---- dal volantino al POP ---- */

    [Fact]
    public void Il_POP_riceve_le_decisioni_Tutto_e_non_quelle_solo_volantino()
    {
        var pop = new List<ArticoloInKit> { RecordPop("123", "123", "Logo_BDP", "Logo_SDB") };
        var volantino = new List<FicoProcessController.DecisioniDelVolantino>
        {
            Volantino("123", Escludi("Logo_BDP"), Escludi("Logo_SDB", AmbitoDecisioneLavorazione.SoloVolantino))
        };

        var perGruppo = FicoProcessController.decisioniDelVolantinoPerIlPop(pop, volantino);
        FicoProcessController.applicaExtraDellaLavorazione(pop, perGruppo);

        Assert.Equal("Logo_BDP", perGruppo["123"].Single().sigla);
        var loghi = (List<LogoBollo>)pop[0].recordInTracciato[KeyExtraAuto];
        Assert.True(loghi.Single(l => l.sigla == "Logo_BDP").escluso);
        Assert.False(loghi.Single(l => l.sigla == "Logo_SDB").escluso);
    }

    [Fact]
    public void Il_POP_si_lega_al_volantino_per_codice_della_referenza_anche_col_gruppo_diverso()
    {
        // Nel POP il codice gruppo puo' essere un sottogruppo: conta la referenza, che sta nel gruppo del volantino.
        var pop = new List<ArticoloInKit> { RecordPop("SUB-7", "4569074") };
        var volantino = new List<FicoProcessController.DecisioniDelVolantino> { Volantino("4569070,4569074,4569080", Escludi("Logo_BDP")) };

        var perGruppo = FicoProcessController.decisioniDelVolantinoPerIlPop(pop, volantino);

        Assert.Equal("Logo_BDP", perGruppo["SUB-7"].Single().sigla);
    }

    [Fact]
    public void Un_POP_senza_la_referenza_nel_volantino_non_riceve_niente()
    {
        var pop = new List<ArticoloInKit> { RecordPop("999", "999") };
        var volantino = new List<FicoProcessController.DecisioniDelVolantino> { Volantino("123", Escludi("Logo_BDP")) };

        Assert.Empty(FicoProcessController.decisioniDelVolantinoPerIlPop(pop, volantino));
    }

    [Fact]
    public void Vale_il_volantino_piu_recente_che_ha_deciso_sul_gruppo()
    {
        var pop = new List<ArticoloInKit> { RecordPop("123", "123") };
        // L'elenco arriva gia' dal piu' recente.
        var volantino = new List<FicoProcessController.DecisioniDelVolantino>
        {
            Volantino("123"),
            Volantino("123", Escludi("Logo_recente")),
            Volantino("123", Escludi("Logo_vecchio"))
        };

        Assert.Equal("Logo_recente", FicoProcessController.decisioniDelVolantinoPerIlPop(pop, volantino)["123"].Single().sigla);
    }

    [Fact]
    public void Se_il_volantino_piu_recente_ha_deciso_solo_per_se_il_POP_non_prende_quelle_vecchie()
    {
        var pop = new List<ArticoloInKit> { RecordPop("123", "123") };
        var volantino = new List<FicoProcessController.DecisioniDelVolantino>
        {
            Volantino("123", Escludi("Logo_recente", AmbitoDecisioneLavorazione.SoloVolantino)),
            Volantino("123", Escludi("Logo_vecchio"))
        };

        Assert.Empty(FicoProcessController.decisioniDelVolantinoPerIlPop(pop, volantino));
    }

    [Fact]
    public void Senza_record_o_senza_volantino_non_succede_niente()
    {
        Assert.Empty(FicoProcessController.decisioniDelVolantinoPerIlPop(null, new List<FicoProcessController.DecisioniDelVolantino> { Volantino("123", Escludi("Logo_BDP")) }));
        Assert.Empty(FicoProcessController.decisioniDelVolantinoPerIlPop(new List<ArticoloInKit> { RecordPop("123", "123") }, null));
        Assert.Empty(FicoProcessController.decisioniDelVolantinoPerIlPop(new List<ArticoloInKit> { RecordPop("123", "123") }, new List<FicoProcessController.DecisioniDelVolantino>()));
    }

    [Fact]
    public void Le_due_letture_del_POP_prendono_le_decisioni_dal_volantino_prima_di_applicarle()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        const string kit = "extraLavorazionePerGruppo = decisioniDelVolantinoPerIlPop(resultGlobale.records, decisioniDeiVolantiniDellaPromo(idLavorazione));";
        Assert.Contains("if (mode == FicoCombinazioneKitReadMode.Advanced && resultGlobale.tipoLavorazione == TipoLavorazione.PoP)", fico);
        Assert.True(fico.IndexOf(kit, StringComparison.Ordinal) > 0);
        Assert.True(fico.IndexOf(kit, StringComparison.Ordinal) < fico.IndexOf("applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal));

        const string scheda = "extraLavorazionePerGruppo = FicoProcessController.decisioniDelVolantinoPerIlPop(resultGlobale.records, ficoController.decisioniDeiVolantiniDellaPromo(idLavorazione));";
        Assert.Contains("if (tipoFormatoKit == TipoLavorazione.PoP)", menabo);
        Assert.True(menabo.IndexOf(scheda, StringComparison.Ordinal) > 0);
        Assert.True(menabo.IndexOf(scheda, StringComparison.Ordinal) < menabo.IndexOf("FicoProcessController.applicaExtraDellaLavorazione(resultGlobale.records, extraLavorazionePerGruppo);", StringComparison.Ordinal));

        // Il volantino e' quello della stessa promo, area e canale, di tipo Volantino, dal piu' recente.
        int inizio = fico.IndexOf("public List<DecisioniDelVolantino> decisioniDeiVolantiniDellaPromo(int idLavorazione)", StringComparison.Ordinal);
        string lettura = fico.Substring(inizio, fico.IndexOf("/// <summary>", inizio, StringComparison.Ordinal) - inizio);
        Assert.Contains("l.GuidPromo == lavorazione.GuidPromo && l.GuidArea == lavorazione.GuidArea && l.GuidCanale == lavorazione.GuidCanale", lettura);
        Assert.Contains("== TipoLavorazione.Volantino", lettura);
        Assert.Contains(".OrderByDescending(l => l.RegisterDate)", lettura);
    }

    /* ---- la configurazione ---- */

    [Fact]
    public void Chiedere_l_ambito_e_spento_di_default_e_la_chiave_sopravvive_al_salvataggio()
    {
        Assert.False(JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}")!.chiediAmbitoDecisioniLavorazione);

        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"chiediAmbitoDecisioniLavorazione\":true}");
        Assert.True(agenzia!.chiediAmbitoDecisioniLavorazione);
        Assert.True(JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia))!.chiediAmbitoDecisioniLavorazione);
    }

    [Fact]
    public void Solo_Coop_chiede_l_ambito()
    {
        Assert.True(SourceDelCliente("Coopfi").chiediAmbitoDecisioniLavorazione);
        Assert.False(SourceDelCliente("Edro21").chiediAmbitoDecisioniLavorazione);
    }

    private static AgenziaCustomPlugin SourceDelCliente(string cliente) =>
        JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(Percorso(Path.Combine("Istanta", "wwwroot", "external_source", cliente, "SourceCustomPlugin.json"))))!;

    private static string Sorgente(string relativo) => File.ReadAllText(Percorso(relativo.Replace('/', Path.DirectorySeparatorChar))).Replace("\r", "");

    private static string Percorso(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo);
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
