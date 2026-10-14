using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1103: scaricando la lista di un POP, ogni impaginazione eredita i meta del suo corrispettivo
/// nel volantino piu' recente della stessa promo, area e canale che ha la referenza: testi (descrizione
/// compresa), noRender, primarie/secondarie, foto e foto extra, tranne le decisioni SoloVolantino.
/// Il corrispettivo comanda anche senza meta; senza corrispettivo vale la lettura di prima. Nel POP i
/// testi ereditati si applicano e basta. Il noRender non si eredita piu' dalle lavorazioni passate.
/// </summary>
public class MetaVolantinoPopTests
{
    private static readonly string KeyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;
    private static readonly string KeyRefCodice = Enum.GetName(AddestramentoRuoli.Referenza) + "." + GLOBAL_VARIABLES.keyRefCodice;

    private static ArticoloInKit RecordPop(string codGruppo, string codice, long idRec = 0, string? contenuto = null)
    {
        var record = new ArticoloInKit
        {
            IdRec = idRec,
            recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = codGruppo, [KeyRefCodice] = codice }
        };
        if (contenuto != null)
            record.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields] = new List<CompiledField> { new() { labelName = "prezzo_info_pack", content = contenuto } };
        return record;
    }

    private static FicoProcessController.MetaDelVolantino Riga(int idLavorazione, string codiceGruppo, RevisioneMetaPromoLavorazioni? meta, long idRecord = 0, string? codice = null) =>
        new() { IdLavorazione = idLavorazione, CodiceGruppo = codiceGruppo, Codice = codice, IdRecordTracciato = idRecord, Meta = meta };

    private static TestoDalBox Testo(string contenuto = "cad.") =>
        new() { label = "prezzo_info_pack", contenuto = contenuto, contenutoServer = "a conf.", versione = 2 };

    private static RevisioneNoRenderFromIndd NoRender(TipoElementoBox tipo, string chiave) => new() { tipo = tipo, chiave = chiave, nome = chiave };

    private static RevisioneExtraLavorazioneFromIndd Escludi(string sigla, AmbitoDecisioneLavorazione ambito) =>
        new() { tipo = TipoElementoBox.Logo, sigla = sigla, azione = AzioneExtraLavorazione.Escludi, nomeServer = sigla + ".psd", tipoFoto = 3, ambito = ambito };

    private static RevisioneMetaPromoLavorazioni MetaCompleto() => new()
    {
        testiDalBox = new() { Testo() },
        noRender = new() { NoRender(TipoElementoBox.Logo, "Logo_BDP"), NoRender(TipoElementoBox.Foto, "123") },
        ps = new() { new RevisioneSelezioneFotoFromIndd { codRef = "123", stato = StatoSelezioneFoto.Selezionata } },
        foto = new() { new RevisioneFotoFromIndd { codRef = "123", nomeFoto = "123_2.jpg", tipo = TipoFoto.Foto } },
        extraLavorazione = new() { Escludi("Logo_tutto", AmbitoDecisioneLavorazione.Tutto), Escludi("Logo_volantino", AmbitoDecisioneLavorazione.SoloVolantino) }
    };

    /* ---- quali meta ---- */

    [Fact]
    public void Il_POP_prende_tutti_i_meta_tranne_le_decisioni_solo_volantino()
    {
        var ereditati = FicoProcessController.metaPerIlPop(MetaCompleto());

        Assert.Equal("cad.", ereditati.testiDalBox!.Single().contenuto);
        Assert.Equal(2, ereditati.noRender!.Count);
        Assert.Equal(StatoSelezioneFoto.Selezionata, ereditati.ps!.Single().stato);
        Assert.Equal("123_2.jpg", ereditati.foto!.Single().nomeFoto);
        Assert.Equal("Logo_tutto", ereditati.extraLavorazione!.Single().sigla);
    }

    [Fact]
    public void Senza_meta_o_con_sole_decisioni_solo_volantino_il_POP_non_eredita_niente()
    {
        var vuoto = FicoProcessController.metaPerIlPop(null);
        Assert.Null(vuoto.testiDalBox);
        Assert.Null(vuoto.extraLavorazione);

        var soloVolantino = FicoProcessController.metaPerIlPop(new RevisioneMetaPromoLavorazioni { extraLavorazione = new() { Escludi("Logo_volantino", AmbitoDecisioneLavorazione.SoloVolantino) } });
        Assert.Null(soloVolantino.extraLavorazione);
    }

    /* ---- il corrispettivo ---- */

    [Fact]
    public void Il_corrispettivo_e_nel_volantino_piu_recente_che_ha_la_referenza()
    {
        // Dal volantino piu' recente: il 3 non ha la referenza, il 2 si', l'1 e' piu' vecchio.
        var volantino = new List<FicoProcessController.MetaDelVolantino>
        {
            Riga(3, "999", MetaCompleto()),
            Riga(2, "123", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { Testo("dal 2") } }),
            Riga(1, "123", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { Testo("dall'1") } })
        };

        var corrispettivo = FicoProcessController.corrispettivoNelVolantino(new[] { "123" }, new long[] { 50 }, volantino);

        Assert.Equal(2, corrispettivo!.IdLavorazione);
        Assert.Equal("dal 2", corrispettivo.Meta!.testiDalBox!.Single().contenuto);
    }

    [Fact]
    public void Con_due_impaginazioni_del_gruppo_nel_volantino_vale_quella_dello_stesso_record()
    {
        // Nello stesso volantino le righe arrivano dalla piu' recente.
        var volantino = new List<FicoProcessController.MetaDelVolantino>
        {
            Riga(2, "123", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { Testo("record 20") } }, idRecord: 20),
            Riga(2, "123", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { Testo("record 10") } }, idRecord: 10)
        };

        Assert.Equal(10, FicoProcessController.corrispettivoNelVolantino(new[] { "123" }, new long[] { 10 }, volantino)!.IdRecordTracciato);
        Assert.Equal(20, FicoProcessController.corrispettivoNelVolantino(new[] { "123" }, new long[] { 30 }, volantino)!.IdRecordTracciato);
    }

    [Fact]
    public void Il_corrispettivo_si_lega_per_referenza_anche_col_gruppo_diverso()
    {
        var volantino = new List<FicoProcessController.MetaDelVolantino>
        {
            Riga(1, "4569070,4569074,4569080", MetaCompleto()),
            Riga(1, "777", MetaCompleto(), codice: "4569099")
        };

        var perChiave = FicoProcessController.metaDelVolantinoPerIlPop(new List<ArticoloInKit> { RecordPop("SUB-7", "4569074"), RecordPop("SUB-8", "4569099") }, volantino);

        Assert.True(perChiave.ContainsKey("SUB-7"));
        Assert.True(perChiave.ContainsKey("SUB-8"));
    }

    [Fact]
    public void Senza_la_referenza_nel_volantino_non_c_e_corrispettivo()
    {
        var volantino = new List<FicoProcessController.MetaDelVolantino> { Riga(1, "123", MetaCompleto()) };

        Assert.Null(FicoProcessController.corrispettivoNelVolantino(new[] { "999" }, new long[] { 1 }, volantino));
        Assert.Null(FicoProcessController.corrispettivoNelVolantino(new[] { "123" }, null, null));
        Assert.Empty(FicoProcessController.metaDelVolantinoPerIlPop(new List<ArticoloInKit> { RecordPop("999", "999") }, volantino));
    }

    /* ---- al posto dei meta del POP ---- */

    [Fact]
    public void I_meta_del_corrispettivo_prendono_il_posto_di_quelli_del_POP()
    {
        var pop = new List<ArticoloInKit> { RecordPop("123", "123", 10) };
        var chiave = FicoProcessController.chiaveDellImpaginazione("123", 10);
        var noRenderPerRef = new Dictionary<string, bool>();
        var noRender = new Dictionary<string, List<RevisioneNoRenderFromIndd>> { [chiave] = new() { NoRender(TipoElementoBox.Campo, "del_pop") } };
        var extra = new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>> { [chiave] = new() { Escludi("Logo_del_pop", AmbitoDecisioneLavorazione.Tutto) } };
        var testi = new Dictionary<string, List<TestoDalBox>> { [chiave] = new() { Testo("del pop") } };
        var righe = new Dictionary<string, PromoLavorazioniRecord> { [chiave] = new PromoLavorazioniRecord { Id = 1 } };

        var ereditati = FicoProcessController.sostituisciConIMetaDelVolantino(
            FicoProcessController.metaDelVolantinoPerIlPop(pop, new List<FicoProcessController.MetaDelVolantino> { Riga(1, "123", MetaCompleto()) }),
            noRenderPerRef, noRender, extra, testi, righe);

        Assert.Equal(new[] { "Logo_BDP", "123" }, noRender[chiave].Select(n => n.chiave));
        Assert.Single(noRenderPerRef);
        Assert.Equal("Logo_tutto", extra[chiave].Single().sigla);
        Assert.Equal("cad.", testi[chiave].Single().contenuto);
        Assert.Contains(chiave, ereditati);
        // Nessuna riga di questa lavorazione da cui togliere i testi ereditati.
        Assert.False(righe.ContainsKey(chiave));
    }

    [Fact]
    public void Il_corrispettivo_senza_meta_toglie_i_meta_del_POP()
    {
        var pop = new List<ArticoloInKit> { RecordPop("123", "123") };
        var noRenderPerRef = new Dictionary<string, bool> { ["123|123"] = true };
        var noRender = new Dictionary<string, List<RevisioneNoRenderFromIndd>> { ["123"] = new() { NoRender(TipoElementoBox.Foto, "123") } };
        var testi = new Dictionary<string, List<TestoDalBox>> { ["123"] = new() { Testo("del pop") } };

        var ereditati = FicoProcessController.sostituisciConIMetaDelVolantino(
            FicoProcessController.metaDelVolantinoPerIlPop(pop, new List<FicoProcessController.MetaDelVolantino> { Riga(1, "123", null) }),
            noRenderPerRef, noRender, new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>(), testi);

        Assert.Empty(noRenderPerRef);
        Assert.Empty(noRender);
        Assert.Empty(testi);
        Assert.Empty(ereditati);
    }

    [Fact]
    public void Senza_corrispettivo_restano_i_meta_del_POP_ma_non_le_sue_foto_extra()
    {
        var noRender = new Dictionary<string, List<RevisioneNoRenderFromIndd>> { ["999"] = new() { NoRender(TipoElementoBox.Campo, "del_pop") } };
        var testi = new Dictionary<string, List<TestoDalBox>> { ["999"] = new() { Testo("del pop") } };
        var extra = new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>> { ["999"] = new() { Escludi("Logo_del_pop", AmbitoDecisioneLavorazione.Tutto) } };

        FicoProcessController.sostituisciConIMetaDelVolantino(
            FicoProcessController.metaDelVolantinoPerIlPop(new List<ArticoloInKit> { RecordPop("999", "999") }, new List<FicoProcessController.MetaDelVolantino> { Riga(1, "123", MetaCompleto()) }),
            null, noRender, extra, testi);

        Assert.Equal("del_pop", noRender["999"].Single().chiave);
        Assert.Equal("del pop", testi["999"].Single().contenuto);
        // I20-1082: il POP non decide sulle foto extra.
        Assert.Empty(extra);
    }

    /* ---- i testi ereditati nel POP ---- */

    [Fact]
    public void Nel_POP_i_testi_ereditati_stanno_nei_campi_senza_stato_da_verificare()
    {
        var ereditato = RecordPop("123", "123", 10, "a conf.");
        ereditato.sottogruppo = new Dictionary<string, object> { [GLOBAL_VARIABLES.keyCompiledFields] = new List<CompiledField> { new() { labelName = "prezzo_info_pack", content = "a conf." } } };
        var proprio = RecordPop("456", "456", 20, "a conf.");
        var testi = new Dictionary<string, List<TestoDalBox>>
        {
            [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { Testo() },
            [FicoProcessController.chiaveDellImpaginazione("456", 20)] = new() { Testo() }
        };
        var records = new List<ArticoloInKit> { ereditato, proprio };

        var allineati = FicoProcessController.applicaTestiDalBox(records, testi, new Dictionary<long, byte> { [10] = 3, [20] = 3 });
        FicoProcessController.togliStatoDeiTestiEreditati(records, new HashSet<string> { FicoProcessController.chiaveDellImpaginazione("123", 10) });

        Assert.Equal("cad.", ((List<CompiledField>)ereditato.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.Equal("cad.", ((List<CompiledField>)ereditato.sottogruppo[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.False(ereditato.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
        Assert.False(ereditato.sottogruppo.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
        // Un meta proprio resta da verificare come prima.
        Assert.True(proprio.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
        Assert.Empty(allineati);
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void Le_due_letture_del_POP_legano_i_meta_del_volantino_prima_e_dopo_l_export()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        // Lista: i volantini si leggono solo per il POP e arrivano a updateDatiFromMetaPromoLavorazioni.
        Assert.Contains("volantinoDelPop = volantinoDellaPromo ??= metaDeiVolantiniDellaPromo(idLavorazione);", fico);
        Assert.Contains("testiDalBoxPerGruppo, righeDeiTesti, volantinoDelPop);", fico);
        // Dopo l'export, prima del noRender; i testi ereditati perdono lo stato prima della pulizia dei superati.
        int kit = fico.IndexOf("testiEreditati = sostituisciConIMetaDelVolantino(", StringComparison.Ordinal);
        Assert.True(kit > 0 && kit < fico.IndexOf("applicaNoRenderAiMembriGruppoFoto(itemLista.Records, noRenderPerRef);", StringComparison.Ordinal));
        int stato = fico.IndexOf("togliStatoDeiTestiEreditati(resultGlobale.records, testiEreditati);", StringComparison.Ordinal);
        Assert.True(stato > fico.IndexOf("var testiAllineati = applicaTestiDalBox(", StringComparison.Ordinal));
        Assert.True(stato < fico.IndexOf("togliTestiDalBoxAllineati(testiAllineati, righeDeiTesti);", StringComparison.Ordinal));

        // Scheda: lo stesso.
        Assert.Contains("testiDalBoxPerGruppo, null, volantinoDelPop);", menabo);
        int scheda = menabo.IndexOf("testiEreditati = FicoProcessController.sostituisciConIMetaDelVolantino(", StringComparison.Ordinal);
        Assert.True(scheda > 0 && scheda < menabo.IndexOf("FicoProcessController.applicaNoRenderAiMembriGruppoFoto(itemLista.Records, noRenderPerRef);", StringComparison.Ordinal));
        Assert.True(menabo.IndexOf("FicoProcessController.togliStatoDeiTestiEreditati(resultGlobale.records, testiEreditati);", StringComparison.Ordinal)
            > menabo.IndexOf("FicoProcessController.applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo", StringComparison.Ordinal));
    }

    [Fact]
    public void Prima_dell_export_il_corrispettivo_porta_primarie_e_foto_e_prende_il_posto_del_POP_e_del_passato()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        int inizio = fico.IndexOf("public List<ArticoloInKit> updateDatiFromMetaPromoLavorazioni(", StringComparison.Ordinal);
        string lettura = fico.Substring(inizio, fico.IndexOf("return artInkit;", inizio, StringComparison.Ordinal) - inizio);

        int corrispettivo = lettura.IndexOf("if (corrispettivo != null)", StringComparison.Ordinal);
        Assert.True(corrispettivo > 0);
        Assert.True(corrispettivo < lettura.IndexOf("else if (promoLavorazione != null && promoLavorazione.Meta != null)", StringComparison.Ordinal));
        Assert.Contains("storeField = new RevisioneMetaPromoLavorazioni { ps = ereditati.ps, foto = ereditati.foto };", lettura);

        // Il noRender non si eredita piu' dalle lavorazioni passate.
        Assert.DoesNotContain("recPassato.noRender", lettura);
    }

    [Fact]
    public void I_volantini_si_leggono_con_tutte_le_righe_anche_senza_meta()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        int inizio = fico.IndexOf("public List<MetaDelVolantino> metaDeiVolantiniDellaPromo(int idLavorazione)", StringComparison.Ordinal);
        string lettura = fico.Substring(inizio, fico.IndexOf("/// <summary>", inizio, StringComparison.Ordinal) - inizio);

        Assert.Contains(".Where(r => volantini.Contains(r.IdLavorazione))", lettura);
        Assert.DoesNotContain("r.Meta != null)", lettura);
    }

    /* ---- la descrizione di un gruppo va al solo cartello di gruppo ---- */

    private static List<CompiledField> Campi(string descrizione) => new()
    {
        new() { labelName = "descrizione", content = descrizione },
        new() { labelName = "prezzo_info_pack", content = "a conf." }
    };

    private static ArticoloInKit CartelloPop(string codGruppo, string codice, long idRec, bool conCartelloDiGruppo = false)
    {
        var record = RecordPop(codGruppo, codice, idRec);
        record.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields] = Campi("<DESCRIZIONE_TITOLO>" + codice + "</DESCRIZIONE_TITOLO>");
        if (conCartelloDiGruppo)
            record.sottogruppo = new Dictionary<string, object> { [GLOBAL_VARIABLES.keyCompiledFields] = Campi("<DESCRIZIONE_TITOLO_LINEA>GRUPPO</DESCRIZIONE_TITOLO_LINEA>") };
        return record;
    }

    private static string Contenuto(Dictionary<string, object> dati, string label) =>
        ((List<CompiledField>)dati[GLOBAL_VARIABLES.keyCompiledFields]).Single(c => c.labelName == label).content;

    private static readonly TestoDalBox DescrizioneDelVolantino = new() { label = "descrizione", contenuto = "<DESCRIZIONE_TITOLO_LINEA>SALUMI AFFETTATI</DESCRIZIONE_TITOLO_LINEA>", contenutoServer = "x" };
    private static readonly TestoDalBox InfoPackDelVolantino = new() { label = "prezzo_info_pack", contenuto = "al kg", contenutoServer = "a conf." };

    /// Il giro della lettura del POP, dalle righe del volantino ai campi dei record.
    private static void LeggiIlPop(List<ArticoloInKit> records, List<FicoProcessController.MetaDelVolantino> volantino)
    {
        var metaDelPop = FicoProcessController.metaDelVolantinoPerIlPop(records, volantino);
        var cartelli = FicoProcessController.descrizioneDelGruppoAlSoloCartello(records, metaDelPop);
        var testi = new Dictionary<string, List<TestoDalBox>>();
        var ereditati = FicoProcessController.sostituisciConIMetaDelVolantino(metaDelPop, null, null, new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>(), testi);
        FicoProcessController.applicaTestiDalBox(records, testi);
        FicoProcessController.applicaDescrizioniAiCartelliDiGruppo(records, cartelli);
        FicoProcessController.togliStatoDeiTestiEreditati(records, ereditati);
    }

    [Fact]
    public void La_descrizione_di_un_gruppo_va_al_cartello_di_gruppo_e_non_ai_singoli()
    {
        var primo = CartelloPop("101,102,103", "101", 1, conCartelloDiGruppo: true);
        var secondo = CartelloPop("101,102,103", "102", 2);
        var terzo = CartelloPop("101,102,103", "103", 3);
        var records = new List<ArticoloInKit> { primo, secondo, terzo };

        LeggiIlPop(records, new List<FicoProcessController.MetaDelVolantino>
        {
            Riga(1, "101,102,103", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { DescrizioneDelVolantino, InfoPackDelVolantino } })
        });

        foreach (var (record, codice) in new[] { (primo, "101"), (secondo, "102"), (terzo, "103") })
        {
            Assert.Equal("<DESCRIZIONE_TITOLO>" + codice + "</DESCRIZIONE_TITOLO>", Contenuto(record.recordInTracciato, "descrizione"));
            Assert.Equal("al kg", Contenuto(record.recordInTracciato, "prezzo_info_pack"));
        }
        Assert.Equal(DescrizioneDelVolantino.contenuto, Contenuto(primo.sottogruppo!, "descrizione"));
        Assert.Equal("al kg", Contenuto(primo.sottogruppo!, "prezzo_info_pack"));
        Assert.False(primo.sottogruppo!.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
    }

    [Fact]
    public void Una_referenza_singola_eredita_la_descrizione()
    {
        var singola = CartelloPop("200", "200", 4);

        LeggiIlPop(new List<ArticoloInKit> { singola }, new List<FicoProcessController.MetaDelVolantino>
        {
            Riga(1, "200", new RevisioneMetaPromoLavorazioni { testiDalBox = new() { DescrizioneDelVolantino } })
        });

        Assert.Equal(DescrizioneDelVolantino.contenuto, Contenuto(singola.recordInTracciato, "descrizione"));
        Assert.False(singola.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
    }

    [Fact]
    public void I_testi_della_riga_del_volantino_restano_quelli()
    {
        var meta = new RevisioneMetaPromoLavorazioni { testiDalBox = new() { DescrizioneDelVolantino, InfoPackDelVolantino } };

        LeggiIlPop(new List<ArticoloInKit> { CartelloPop("101,102", "101", 1, true), CartelloPop("101,102", "102", 2) },
            new List<FicoProcessController.MetaDelVolantino> { Riga(1, "101,102", meta) });

        Assert.Equal(2, meta.testiDalBox!.Count);
    }

    [Fact]
    public void Senza_cartello_di_gruppo_la_descrizione_non_passa_ai_singoli()
    {
        //Linee da 10 in su e gruppi "vari": nessun sottogruppo, solo cartelli singoli.
        var record = CartelloPop("101,102", "101", 1);
        var metaDelPop = new Dictionary<string, RevisioneMetaPromoLavorazioni>
        {
            [FicoProcessController.chiaveDellImpaginazione("101,102", 1)] = new() { testiDalBox = new() { DescrizioneDelVolantino } }
        };

        var cartelli = FicoProcessController.descrizioneDelGruppoAlSoloCartello(new List<ArticoloInKit> { record }, metaDelPop);

        Assert.Empty(cartelli);
        Assert.Null(metaDelPop.Values.Single().testiDalBox);
    }

    [Fact]
    public void Le_due_letture_tolgono_la_descrizione_ai_singoli_e_la_danno_al_cartello()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        int separa = fico.IndexOf("descrizioniDeiCartelli = descrizioneDelGruppoAlSoloCartello(recordsDelPop, metaDelPop);", StringComparison.Ordinal);
        Assert.True(separa > 0 && separa < fico.IndexOf("testiEreditati = sostituisciConIMetaDelVolantino(metaDelPop,", StringComparison.Ordinal));
        int cartello = fico.IndexOf("applicaDescrizioniAiCartelliDiGruppo(resultGlobale.records, descrizioniDeiCartelli);", StringComparison.Ordinal);
        Assert.True(cartello > fico.IndexOf("var testiAllineati = applicaTestiDalBox(", StringComparison.Ordinal));

        int separaScheda = menabo.IndexOf("descrizioniDeiCartelli = FicoProcessController.descrizioneDelGruppoAlSoloCartello(recordsDelPop, metaDelPop);", StringComparison.Ordinal);
        Assert.True(separaScheda > 0 && separaScheda < menabo.IndexOf("testiEreditati = FicoProcessController.sostituisciConIMetaDelVolantino(metaDelPop,", StringComparison.Ordinal));
        Assert.True(menabo.IndexOf("FicoProcessController.applicaDescrizioniAiCartelliDiGruppo(resultGlobale.records, descrizioniDeiCartelli);", StringComparison.Ordinal)
            > menabo.IndexOf("FicoProcessController.applicaTestiDalBox(resultGlobale.records, testiDalBoxPerGruppo", StringComparison.Ordinal));
    }

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
