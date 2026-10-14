using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1088: i meta della lavorazione sono del record impaginato, non del solo codice gruppo. Una
/// lavorazione ha una riga per gruppo impaginato; lo stesso codice gruppo impaginato due volte
/// (idRec diversi) ha due righe e meta distinti. La riga si sceglie con la stessa regola in
/// lettura e in scrittura (RecordDellaLavorazione), e dopo l'export di agenzia i meta si
/// ritrovano sui record per impaginazione (chiaveDellImpaginazione).
/// </summary>
public class MetaPerRecordImpaginatoTests
{
    private static readonly string KeyCodGruppo = Enum.GetName(AddestramentoRuoli.Scatto) + "." + GLOBAL_VARIABLES.keyScattoCodiceGruppo;

    private static PromoLavorazioniRecord Riga(long id, long idRecord) =>
        new() { Id = id, IdLavorazione = 7, CodiceGruppo = "123", IdRecordTracciato = idRecord };

    private static RecordDellaLavorazione.RecordDelTracciato Record(long id, string label = "L1", byte versione = 2) =>
        new() { Id = id, IdTracciato = 5, CodiceGruppo = "123", Label = label, Versione = versione };

    private static ArticoloInKit Box(long idRec, string codiceGruppo = "123") =>
        new() { IdRec = idRec, recordInTracciato = new Dictionary<string, object> { [KeyCodGruppo] = codiceGruppo } };

    /* ---- la riga in lettura ---- */

    [Fact]
    public void In_lettura_vale_la_riga_legata_a_un_record_del_gruppo_letto()
    {
        var righe = new[] { Riga(1, 10), Riga(2, 20) };

        Assert.Equal(2, RecordDellaLavorazione.PerLaLettura(righe, new long[] { 20, 21 })!.Id);
        Assert.Equal(1, RecordDellaLavorazione.PerLaLettura(righe, new long[] { 10 })!.Id);
    }

    [Fact]
    public void In_lettura_con_piu_righe_e_nessuna_del_gruppo_non_vale_nessuna()
    {
        Assert.Null(RecordDellaLavorazione.PerLaLettura(new[] { Riga(1, 10), Riga(2, 20) }, new long[] { 30 }));
        Assert.Null(RecordDellaLavorazione.PerLaLettura(new PromoLavorazioniRecord[0], new long[] { 10 }));
        Assert.Null(RecordDellaLavorazione.PerLaLettura(null, new long[] { 10 }));
    }

    [Fact]
    public void In_lettura_una_sola_impaginazione_del_gruppo_vale_anche_se_il_suo_record_non_e_fra_quelli_letti()
    {
        Assert.Equal(1, RecordDellaLavorazione.PerLaLettura(new[] { Riga(1, 10) }, new long[] { 99 })!.Id);
    }

    /* ---- la riga in scrittura ---- */

    [Fact]
    public void In_scrittura_vale_il_record_esatto_del_box()
    {
        var candidati = new List<PromoLavorazioniRecord> { Riga(1, 10), Riga(2, 20) };

        Assert.Equal(2, RecordDellaLavorazione.PerLaScrittura(candidati, 20, null, null)!.Id);
    }

    [Fact]
    public void In_scrittura_il_record_fratello_della_stessa_impaginazione_porta_alla_sua_riga()
    {
        var candidati = new List<PromoLavorazioniRecord> { Riga(1, 10), Riga(2, 20) };
        //Il box ha l'idRec 11, l'altra referenza del gruppo impaginato con il record 10.
        var fratelli = new[] { Record(10, "L1"), Record(20, "L2") };

        Assert.Equal(1, RecordDellaLavorazione.PerLaScrittura(candidati, 11, Record(11, "L1"), fratelli)!.Id);
    }

    [Fact]
    public void In_scrittura_senza_idRec_vale_la_prima_riga_e_con_una_sola_riga_vale_quella()
    {
        var candidati = new List<PromoLavorazioniRecord> { Riga(1, 10), Riga(2, 20) };

        Assert.Equal(1, RecordDellaLavorazione.PerLaScrittura(candidati, 0, null, null)!.Id);
        Assert.Equal(1, RecordDellaLavorazione.PerLaScrittura(new List<PromoLavorazioniRecord> { Riga(1, 10) }, 99, null, null)!.Id);
    }

    [Fact]
    public void In_scrittura_con_piu_righe_e_nessuna_dell_impaginazione_non_si_sceglie()
    {
        var candidati = new List<PromoLavorazioniRecord> { Riga(1, 10), Riga(2, 20) };

        Assert.Null(RecordDellaLavorazione.PerLaScrittura(candidati, 30, Record(30, "L3"), new[] { Record(10, "L1"), Record(20, "L2") }));
        Assert.Null(RecordDellaLavorazione.PerLaScrittura(new List<PromoLavorazioniRecord>(), 10, null, null));
    }

    /* ---- i meta sui record dopo l'export ---- */

    [Fact]
    public void La_chiave_dell_impaginazione_porta_l_idRec_e_senza_resta_il_codice_gruppo()
    {
        Assert.Equal("123#10", FicoProcessController.chiaveDellImpaginazione("123", 10));
        Assert.Equal("123", FicoProcessController.chiaveDellImpaginazione("123", 0));
        Assert.NotEqual(FicoProcessController.chiaveDellImpaginazione("123", 10), FicoProcessController.chiaveDellImpaginazione("123", 20));
    }

    [Fact]
    public void Due_impaginazioni_dello_stesso_gruppo_hanno_noRender_e_foto_extra_distinti()
    {
        var box10 = Box(10);
        var box20 = Box(20);
        var noRender = new Dictionary<string, List<RevisioneNoRenderFromIndd>>
        {
            [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { new() { tipo = TipoElementoBox.Logo, chiave = "logo_bio", nome = "logo_bio" } }
        };
        var extra = new Dictionary<string, List<RevisioneExtraLavorazioneFromIndd>>
        {
            [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { new() { tipo = TipoElementoBox.Logo, sigla = "Logo_BDP", azione = AzioneExtraLavorazione.Escludi } }
        };

        FicoProcessController.applicaNoRenderAgliElementiDelBox(new List<ArticoloInKit> { box10, box20 }, noRender);
        FicoProcessController.applicaExtraDellaLavorazione(new List<ArticoloInKit> { box10, box20 }, extra);

        Assert.True(box10.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyNoRenderElementi));
        Assert.True(box10.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyExtraLavorazione));
        Assert.False(box20.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyNoRenderElementi));
        Assert.False(box20.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyExtraLavorazione));
    }

    [Fact]
    public void Due_impaginazioni_dello_stesso_gruppo_hanno_testi_del_box_distinti()
    {
        List<CompiledField> Campi() => new() { new CompiledField { labelName = "prezzo_info_pack", content = "a conf." } };
        var box10 = Box(10);
        box10.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields] = Campi();
        var box20 = Box(20);
        box20.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields] = Campi();
        var perGruppo = new Dictionary<string, List<TestoDalBox>>
        {
            [FicoProcessController.chiaveDellImpaginazione("123", 10)] = new() { new TestoDalBox { label = "prezzo_info_pack", contenuto = "cad.", contenutoServer = "a conf." } }
        };

        FicoProcessController.applicaTestiDalBox(new List<ArticoloInKit> { box10, box20 }, perGruppo);

        Assert.Equal("cad.", ((List<CompiledField>)box10.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.Equal("a conf.", ((List<CompiledField>)box20.recordInTracciato[GLOBAL_VARIABLES.keyCompiledFields])[0].content);
        Assert.False(box20.recordInTracciato.ContainsKey(GLOBAL_VARIABLES.keyTestiDalBox));
    }

    [Fact]
    public void Le_decisioni_del_volantino_vanno_a_ogni_impaginazione_del_POP()
    {
        var pop10 = Box(10);
        var pop20 = Box(20);
        var volantino = new List<FicoProcessController.DecisioniDelVolantino>
        {
            new() { CodiceGruppo = "123", voci = new() { new() { tipo = TipoElementoBox.Logo, sigla = "Logo_BDP", azione = AzioneExtraLavorazione.Escludi, ambito = AmbitoDecisioneLavorazione.Tutto } } }
        };

        var perGruppo = FicoProcessController.decisioniDelVolantinoPerIlPop(new List<ArticoloInKit> { pop10, pop20 }, volantino);

        Assert.Equal("Logo_BDP", perGruppo[FicoProcessController.chiaveDellImpaginazione("123", 10)].Single().sigla);
        Assert.Equal("Logo_BDP", perGruppo[FicoProcessController.chiaveDellImpaginazione("123", 20)].Single().sigla);
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void Lettura_e_scritture_dei_meta_scelgono_la_riga_con_la_stessa_regola()
    {
        string fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        string menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        string syncFoto = Sorgente("Istanta/Controllers/SyncFotoController.cs");

        Assert.Contains("var promoLavorazione = RecordDellaLavorazione.PerLaLettura(righeDelGruppo, group.Select(i => i.IdRec));", fico);
        Assert.Contains("return RecordDellaLavorazione.Trova(this.ctx2, idLavorazione, codiceGruppo, idRecRichiesto);", menabo);
        //updateFotoFromIndd, updateImmagineEsistente, RimuoviFotoDaMeta, RimuoviFoto.
        Assert.Equal(4, syncFoto.Split("PromoLavorazioniRecord? plrItem = RecordDellaLavorazione.Trova(this.ctx2,").Length - 1);
        Assert.DoesNotContain("plr.CodiceGruppo!.Contains(_file.codice)).FirstOrDefault()", syncFoto);
    }

    /* ---- il parametro del cliente ---- */

    [Fact]
    public void Il_controllo_di_versione_dei_meta_si_fa_se_il_cliente_non_lo_spegne()
    {
        Assert.False(JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeLibreriaIndd\":\"libreria\"}")!.ignoraVersioneMeta);
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"ignoraVersioneMeta\":true}");
        Assert.True(agenzia!.ignoraVersioneMeta);
        Assert.True(JsonConvert.DeserializeObject<AgenziaCustomPlugin>(JsonConvert.SerializeObject(agenzia))!.ignoraVersioneMeta);
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
