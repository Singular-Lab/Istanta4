using System.Reflection;
using Istanta.Controllers;
using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1069, gruppo 1: gli errori comprensibili di I20-1062 portati all'impaginazione e alla lista
/// del kit. Prima ImpaginaFromInDesignNew, getListaTracciatoNew e la catena processaKit -&gt;
/// processaKitDo -&gt; impacchettaTracciato mettevano in error l'intera traccia, riavvolta due o tre
/// volte; la sessione scaduta diventava un FormatException; le griglie perdevano tipo e riga
/// rilanciando il solo messaggio; e un record che impacchettaInfoRecord non completava fermava in
/// silenzio tutti quelli dopo di lui.
///
/// Le parti nuove si chiamano direttamente. I controller interi vogliono il database, che i test
/// non usano: per loro si controlla il sorgente, come in ErroriIstantaTests.
/// </summary>
public class ErroriImpaginazioneListaTests
{
    /* ---- il motivo, senza la chiamata ---- */

    [Fact]
    public void Il_motivo_di_un_errore_imprevisto_dice_tipo_file_e_riga()
    {
        var errore = Assert.Throws<NullReferenceException>(() => DereferenziaNull(null));

        string motivo = DescrizioneErrori.Motivo(errore);

        Assert.StartsWith("NullReferenceException in ErroriImpaginazioneListaTests.cs:", motivo);
        Assert.EndsWith(" - " + errore.Message, motivo);
        //Breve e' lo stesso motivo con davanti la chiamata, come prima di I20-1069.
        Assert.Equal("ImpaginaFromInDesignNew: " + motivo, DescrizioneErrori.Breve("ImpaginaFromInDesignNew", errore));
    }

    [Fact]
    public void Il_motivo_di_un_ErroreIstanta_e_il_suo_messaggio_anche_dentro_AgenziaLib()
    {
        var diretto = new ErroreIstanta("scelta della griglia", "la griglia non ha il formato.");
        Assert.Equal("la griglia non ha il formato.", DescrizioneErrori.Motivo(diretto));

        var daAgenzia = new TargetInvocationException(new ErroreIstanta("ordinamento", "lista vuota."));
        Assert.Equal("lista vuota.", DescrizioneErrori.Motivo(daAgenzia));
    }

    [Fact]
    public void Un_errore_avvolto_nel_suo_passo_conserva_l_originale_e_ne_dice_il_punto()
    {
        var originale = Assert.Throws<NullReferenceException>(() => DereferenziaNull(null));
        var avvolto = new ErroreIstanta("impacchettamento del tracciato 41", DescrizioneErrori.Motivo(originale), originale);

        string breve = DescrizioneErrori.Breve("processaKit", avvolto);

        Assert.StartsWith("processaKit, impacchettamento del tracciato 41: NullReferenceException in ErroriImpaginazioneListaTests.cs:", breve);
        Assert.Same(originale, avvolto.InnerException);
        Assert.Contains("NullReferenceException", DescrizioneErrori.Dettaglio(avvolto));
    }

    /* ---- sessione scaduta e errore di processaKit ---- */

    [Fact]
    public void La_sessione_scaduta_lo_dice_e_non_e_un_errore_di_formato()
    {
        string breve = DescrizioneErrori.Breve("ImpaginaFromInDesignNew", ErroreIstanta.SessioneScaduta());

        Assert.Equal("ImpaginaFromInDesignNew, lettura della sessione: la sessione di Istanta e' scaduta: rifare l'accesso al Plugin.", breve);
        Assert.DoesNotContain("Format", breve);
    }

    [Fact]
    public void L_errore_di_processaKit_passa_cosi_com_e_e_noLogin_diventa_sessione_scaduta()
    {
        string giaDescritto = "processaKit, lettura della promo: la promo abc della lavorazione 302 non esiste.";
        Assert.Equal(giaDescritto, DescrizioneErrori.Breve("getListaTracciatoNew", ErroreIstanta.DiProcessaKit(giaDescritto, true, 302)));

        Assert.Contains("la sessione di Istanta e' scaduta", DescrizioneErrori.Breve("getListaTracciatoNew", ErroreIstanta.DiProcessaKit("noLogin", true, 302)));
    }

    [Fact]
    public void Senza_risposta_o_senza_motivo_processaKit_lo_dice_con_la_lavorazione()
    {
        Assert.Equal("getListaTracciatoNew, lettura della lista del kit: processaKit non ha restituito la lista della lavorazione 302.",
            DescrizioneErrori.Breve("getListaTracciatoNew", ErroreIstanta.DiProcessaKit(null, false, 302)));

        Assert.Contains("lavorazione 302", ErroreIstanta.DiProcessaKit("", true, 302).Message);
    }

    /* ---- le griglie ---- */

    [Theory]
    [InlineData("4x3", 12)]
    [InlineData("4x3+1", 13)]
    [InlineData("2x2-1", 3)]
    public void Il_formato_di_griglia_valido_si_calcola_come_prima(string formato, int box)
    {
        Assert.Equal(box, MenaboController.CalcolaEspressione(formato));
    }

    [Fact]
    public void Il_formato_di_griglia_sbagliato_dice_quale()
    {
        var errore = Assert.Throws<ErroreIstanta>(() => MenaboController.CalcolaEspressione("griglia_4x3"));

        Assert.Equal("calcolo della griglia", errore.Passo);
        Assert.Contains("'griglia_4x3'", errore.Message);
    }

    [Fact]
    public void La_griglia_senza_formato_lo_dice_invece_di_un_NullReferenceException()
    {
        var errore = Assert.Throws<ErroreIstanta>(() => MenaboController.CalcolaEspressione(null));

        Assert.Contains("non ha il formato", errore.Message);
    }

    /* ---- i record che non si completano ---- */

    [Fact]
    public void Il_record_non_completato_dice_ref_gruppo_record_e_motivo()
    {
        var errore = new ErroreIstanta("foto dell'articolo", "la foto 7 dell'articolo 6322946 non ha Attiva.");

        Assert.Equal("ref 6322946 gruppo 6322946,6322965 (record 812): la foto 7 dell'articolo 6322946 non ha Attiva.",
            FicoProcessController.AvvisoRecordNonCompletato(812, "6322946", "6322946,6322965", errore));
        //Un singolo e' il gruppo di se stesso: il gruppo non si ripete.
        Assert.Equal("ref 6322946 (record 812): la foto 7 dell'articolo 6322946 non ha Attiva.",
            FicoProcessController.AvvisoRecordNonCompletato(812, "6322946", "6322946", errore));
    }

    [Fact]
    public void L_avviso_della_lista_conta_i_record_e_ne_mostra_tre()
    {
        Assert.Equal("1 record della lista non completati (senza descrizioni, foto o firma): ref 1 (record 11): x",
            FicoProcessController.AvvisoRecordNonCompletati(new List<string> { "ref 1 (record 11): x" }));

        var cinque = Enumerable.Range(1, 5).Select(i => $"ref {i} (record {i}): x").ToList();
        string avviso = FicoProcessController.AvvisoRecordNonCompletati(cinque);

        Assert.StartsWith("5 record della lista non completati", avviso);
        Assert.Contains("ref 3 (record 3)", avviso);
        Assert.DoesNotContain("ref 4 (record 4)", avviso);
        Assert.EndsWith("e altri 2 (elenco completo nel log di Istanta)", avviso);
    }

    /* ---- i punti del codice ---- */

    [Fact]
    public void ImpaginaFromInDesignNew_controlla_la_sessione_e_risponde_con_la_descrizione_breve()
    {
        string metodo = Tratto(Sorgente(Menabo), "public async Task<IActionResult> ImpaginaFromInDesignNew(", "public static int CalcolaEspressione(");

        Assert.Contains("if (!Int16.TryParse(session, out Int16 id_utente))\n                    throw ErroreIstanta.SessioneScaduta();", metodo);
        Assert.DoesNotContain("Int16.Parse(session)", metodo);
        Assert.Contains("throw ErroreIstanta.DiProcessaKit(esito?.error, esito != null, idLavorazione);", metodo);
        Assert.DoesNotContain("Fallimento durante il processamento del kit", metodo);
        Assert.Contains("result.error = DescrizioneErrori.Breve(\"ImpaginaFromInDesignNew\", ex);", metodo);
        Assert.Contains("result.dettaglio = dettaglioDiProcessaKit ?? DescrizioneErrori.Dettaglio(ex);", metodo);
        Assert.Contains("result.warn = esito.warn;", metodo);
        Assert.DoesNotContain("result.error = ex.ToString()", metodo);
        Assert.Contains("Formati.Trova(promoLav.GuidFormato, $\"lavorazione {idLavorazione}\")", metodo);
        Assert.DoesNotContain("DBFORMATI!", metodo);
        //Il residuo di debug che leggeva il codice gruppo di ogni record.
        Assert.DoesNotContain("2907018", metodo);
        Assert.Contains("throw new ErroreIstanta(\"raggruppamento della lista\", resLista.error);", metodo);
    }

    [Fact]
    public void GetListaTracciatoNew_inoltra_l_errore_di_processaKit_con_la_sua_traccia()
    {
        string metodo = Tratto(Sorgente(Menabo), "public async Task<IActionResult> getListaTracciatoNew(", "\n        [");

        Assert.Contains("ErroreIstanta.DiProcessaKit(risposta?.error, risposta != null, idLavorazione)", metodo);
        Assert.Contains("result.dettaglio = risposta?.dettaglio;", metodo);
        Assert.DoesNotContain("throw new Exception(result.error)", metodo);
        Assert.Contains("result.error = DescrizioneErrori.Breve(\"getListaTracciatoNew\", ex);", metodo);
        Assert.Contains("result.dettaglio = DescrizioneErrori.Dettaglio(ex);", metodo);
        Assert.DoesNotContain("\"getListaTracciatoNew -> \"", metodo);
    }

    [Fact]
    public void Le_griglie_conservano_l_errore_originale_e_dicono_la_pagina()
    {
        string sorgente = Sorgente(Menabo);
        string findGriglia = Tratto(sorgente, "public Griglia findGriglia(", "public Griglia findGrigliaNew(");
        string findGrigliaNew = Tratto(sorgente, "public Griglia findGrigliaNew(", "public List<string> getFormatiValidiGriglie(");

        Assert.Contains("throw new ErroreIstanta(\"scelta della griglia\", $\"pagina {pag}: {DescrizioneErrori.Motivo(ex)}\", ex);", findGriglia);
        Assert.Contains("throw new ErroreIstanta(\"scelta della griglia\", DescrizioneErrori.Motivo(ex), ex);", findGrigliaNew);
        Assert.DoesNotContain("Errore durante la selezione della griglia", findGriglia + findGrigliaNew);
        Assert.DoesNotContain("[catch muto]", findGriglia + findGrigliaNew);
    }

    [Fact]
    public void Il_raggruppamento_dice_il_gruppo_senza_primario_e_non_rimanda_la_traccia()
    {
        string metodo = Tratto(Sorgente(Menabo), "public OkResultGruppi OttieniListaImpaginazione(", "public class grigliaCheck");

        Assert.Contains("throw new ErroreIstanta(\"scelta del primario\", $\"il gruppo {item.Key.CodiceGruppo} non ha un record primario.\");", metodo);
        Assert.Contains("RecordTracciato.Richiesto(f.recordInTracciato, keyXMLSelezione, \"scelta del primario\"", metodo);
        Assert.Contains("result.error = DescrizioneErrori.Motivo(ex);", metodo);
        Assert.DoesNotContain("result.error = ex.ToString()", metodo);
    }

    [Fact]
    public void ProcessaKit_controlla_lavorazione_promo_e_kit_e_risponde_con_la_descrizione_breve()
    {
        string metodo = Tratto(Sorgente(FicoProcess), "public async Task<IActionResult> processaKit(", "public List<PromoTracciati> getTracciatiDelKit(");

        Assert.Contains("throw new ErroreIstanta(\"lettura della lavorazione\", $\"la lavorazione {id} non esiste.\");", metodo);
        Assert.Contains("throw new ErroreIstanta(\"lettura della promo\", $\"la promo {plItem.GuidPromo} della lavorazione {id} non esiste.\");", metodo);
        Assert.DoesNotContain("plItem!.", metodo);
        Assert.DoesNotContain("promo!.", metodo);
        Assert.Contains("result.error = DescrizioneErrori.Breve(\"processaKit\", ex);", metodo);
        Assert.DoesNotContain("\"processaKit -> \"", metodo);
        Assert.DoesNotContain("exProKit.ToString()}", metodo);
        Assert.Contains("result.warn = AvvisoRecordNonCompletati(kitResult.avvisi);", metodo);
        //noLogin resta la risposta senza sessione: la leggono anche altri chiamanti.
        Assert.Contains("result.error = \"noLogin\";", metodo);
    }

    [Fact]
    public void ProcessaKitDo_cerca_il_formato_e_rilancia_l_impacchettamento_nel_suo_passo()
    {
        string metodo = Tratto(Sorgente(FicoProcess), "private async Task<PreparazioneListaResult> processaKitDo(", "private List<Dictionary<string, object>> GetRecordsFirmaPluginPerRec(");

        Assert.Contains("Formato objFormato = Formati.Trova(kit.guidFormato, $\"kit della lavorazione {idLavorazione}\");", metodo);
        Assert.DoesNotContain("DBFORMATI!", metodo);
        Assert.Contains("throw new ErroreIstanta($\"impacchettamento del tracciato {tracciato.Id}\", DescrizioneErrori.Motivo(resultPreparazione.eccezione), resultPreparazione.eccezione);", metodo);
        Assert.DoesNotContain("throw new Exception(resultPreparazione.error)", metodo);
        Assert.Contains("resultGlobale.avvisi.AddRange(resultPreparazione.avvisi);", metodo);
        //Il residuo di debug che cercava il codice 881763 in ogni record.
        Assert.DoesNotContain("881763", metodo);
        Assert.Contains("resultGlobale.error = DescrizioneErrori.Breve(\"processaKit\", ex);", metodo);
        Assert.DoesNotContain("resultGlobale.error = ex.ToString()", metodo);
    }

    [Fact]
    public void Un_record_non_completato_non_ferma_piu_gli_altri_e_finisce_negli_avvisi()
    {
        string metodo = Tratto(Sorgente(FicoProcess), "private async Task<PreparazioneListaResult> impacchettaTracciato(", "public ArticoloInRevisione impacchettaInfoRecord(");
        string catchDelRecord = Tratto(metodo, "ArticoloInRevisione revResult = impacchettaInfoRecord(", "if (tipoLavorazione == TipoLavorazione.PoP && declinazioni != null");

        Assert.DoesNotContain("break;", catchDelRecord);
        Assert.Contains("string avviso = AvvisoRecordNonCompletato(rec.idRec, _cod, _codGruppo, ex);", catchDelRecord);
        Assert.Contains("result.avvisi.Add(avviso);", catchDelRecord);
        //Il risultato si ricostruisce a fine metodo: gli avvisi raccolti devono passarci.
        Assert.Contains("avvisi = result.avvisi", metodo);
        Assert.Contains("result.eccezione = ex;", metodo);
        Assert.DoesNotContain("result.error = ex.ToString()", metodo);
        Assert.Contains("RecordTracciato.Richiesto(rec.recordInTracciato, k_cod, \"lettura del tracciato\", diQualeRecord)", metodo);
    }

    /* ---- strumenti ---- */

    private const string Menabo = "Istanta/Controllers/MenaboController.cs";
    private const string FicoProcess = "Istanta/Controllers/FicoProcessController.cs";

    private static int DereferenziaNull(string? testo)
    {
        return testo!.Length;
    }

    /// Il testo fra inizio e fine, senza le righe commentate: i controller tengono anche il codice
    /// vecchio, commentato, e i commenti di I20-1069 citano quello che e' stato tolto.
    private static string Tratto(string sorgente, string inizio, string fine)
    {
        int da = sorgente.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, "manca " + inizio);
        int a = sorgente.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, "manca " + fine + " dopo " + inizio);
        string corpo = sorgente.Substring(da, a - da);
        return string.Join("\n", corpo.Split('\n').Where(riga => !riga.TrimStart().StartsWith("//")));
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
