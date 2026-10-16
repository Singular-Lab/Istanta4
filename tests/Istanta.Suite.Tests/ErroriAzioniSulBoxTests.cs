using Istanta.Controllers;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1069, gruppo 2: le azioni sul box dicono dove e perche' si sono fermate, e nessuna risponde
/// "successo" dopo un salvataggio fallito.
///
/// Prima: impaginaSingolo cercava il primario con First e l'indicizzatore, e senza primario o senza
/// StatoSelezione dava un'eccezione senza dati; ricollegaBox leggeva le pagine con Byte.Parse (e un
/// intervallo fino a 255 non finiva mai) e trasformava un errore dello storico in "inesistente";
/// modificaPrimarieSecondarie e modificaNoRender ignoravano l'esito della registrazione e
/// rispondevano sempre Esito = true, mentre Register.addOperazione scriveva l'errore solo in console;
/// il cambio strutturale, senza IdAddestramento, si rompeva a meta' del ciclo e, salvando record per
/// record, lasciava il dato modificato in parte senza dirlo.
///
/// Le parti nuove si chiamano direttamente; i controller vogliono il database, che i test non usano:
/// per loro si controlla il sorgente, come in ErroriIstantaTests.
/// </summary>
public class ErroriAzioniSulBoxTests
{
    /* ---- l'errore di salvataggio del database ---- */

    [Fact]
    public void Un_errore_di_salvataggio_dice_la_causa_vera_e_non_see_the_inner_exception()
    {
        var causa = new InvalidOperationException("violazione del vincolo FK_PromoLavorazioniRecords");
        var salvataggio = new DbUpdateException("An error occurred while saving the entity changes. See the inner exception for details.", causa);

        Assert.Same(causa, DescrizioneErrori.Radice(salvataggio));
        Assert.Contains("violazione del vincolo FK_PromoLavorazioniRecords", DescrizioneErrori.Breve("modificaPrimarieSecondarie", salvataggio));
        Assert.DoesNotContain("See the inner exception", DescrizioneErrori.Breve("modificaPrimarieSecondarie", salvataggio));
    }

    /* ---- le pagine del ricollegamento ---- */

    [Fact]
    public void Le_pagine_di_un_intervallo_si_leggono_come_prima()
    {
        Assert.Equal(new byte[] { 1, 3, 4, 5 }, MenaboController.PagineDellIntervallo("1,3-5"));
        Assert.Equal(new byte[] { 7 }, MenaboController.PagineDellIntervallo("7"));
        Assert.Empty(MenaboController.PagineDellIntervallo(null));
        Assert.Empty(MenaboController.PagineDellIntervallo(""));
    }

    [Fact]
    public void Un_intervallo_che_arriva_a_255_finisce()
    {
        //Con il ciclo su Byte, dopo 255 tornava a 0 e non finiva mai.
        Assert.Equal(new byte[] { 253, 254, 255 }, MenaboController.PagineDellIntervallo("253-255"));
    }

    [Theory]
    [InlineData("A1", "'A1'")]
    [InlineData("1,,3", "''")]
    [InlineData("5-3", "'5-3'")]
    [InlineData("300", "'300'")]
    [InlineData("1-2-3", "'1-2-3'")]
    public void Una_pagina_che_non_e_una_pagina_dice_quale(string intervallo, string citato)
    {
        var errore = Assert.Throws<ErroreIstanta>(() => MenaboController.PagineDellIntervallo(intervallo));

        Assert.Equal("lettura delle pagine", errore.Passo);
        Assert.Contains(citato + " in '" + intervallo + "'", errore.Message);
    }

    /* ---- il cambio strutturale salvato a meta' ---- */

    [Fact]
    public void Il_cambio_fermato_a_meta_dice_per_primo_quanti_record_erano_gia_salvati()
    {
        var errore = new ErroreIstanta("lettura dell'addestramento", "il record 812 del gruppo 6322946 non ha l'addestramento della lista (IdAddestramento).");

        string testo = MenaboController.TestoCambioNonRiuscito(2, 3, errore);

        Assert.StartsWith("Salvati 2 record su 3, dato modificato solo in parte. ", testo);
        Assert.EndsWith("cambio strutturale, lettura dell'addestramento: il record 812 del gruppo 6322946 non ha l'addestramento della lista (IdAddestramento).", testo);
    }

    [Fact]
    public void Il_cambio_fermato_prima_di_salvare_dice_solo_il_motivo()
    {
        var errore = new ErroreIstanta("scelta dei record", "la ref 6322946 non e' nel gruppo 6322946,6322965.");

        Assert.Equal("cambio strutturale, scelta dei record: la ref 6322946 non e' nel gruppo 6322946,6322965.",
            MenaboController.TestoCambioNonRiuscito(0, 3, errore));
    }

    /* ---- i punti del codice ---- */

    [Fact]
    public void ImpaginaSingolo_cerca_il_primario_e_lo_dice_se_manca()
    {
        string metodo = Tratto(Sorgente(Menabo), "\n        public async Task<IActionResult> impaginaSingolo(", "\n        [Http");

        Assert.Contains("if (!Int16.TryParse(session, out Int16 id_utente))\n                    throw ErroreIstanta.SessioneScaduta();", metodo);
        Assert.DoesNotContain("Int16.Parse(session)", metodo);
        Assert.DoesNotContain(".First(f => Convert.ToByte(f.recordInTracciato[", metodo);
        Assert.Contains("RecordTracciato.Richiesto(f.recordInTracciato, GLOBAL_VARIABLES.keyXMLSelezione,", metodo);
        Assert.Contains("throw new ErroreIstanta(\"scelta del primario\", $\"il gruppo {richiesta.codiceGruppo} non ha un record primario.\");", metodo);
        //La traccia di getSchedaRef arriva al Plugin, e il suo avviso anche.
        Assert.Equal(2, Conta(metodo, "dettaglioDiGetSchedaRef = gruppoResult?.dettaglio;"));
        Assert.Contains("dettaglio = dettaglioDiGetSchedaRef ?? DescrizioneErrori.Dettaglio(ex),", metodo);
        Assert.Equal(2, Conta(metodo, "result.warn = gruppoResult.warn;"));
        Assert.DoesNotContain("LeggiTracciatiRecord", metodo);
    }

    [Fact]
    public void Primarie_secondarie_e_noRender_non_rispondono_successo_se_la_registrazione_fallisce()
    {
        string sorgente = Sorgente(Menabo);
        string ps = Tratto(sorgente, "\n        public async Task<IActionResult> modificaPrimarieSecondarie(", "public class InddObjNoRenderRequest");
        string noRender = Tratto(sorgente, "\n        public async Task<IActionResult> modificaNoRender(", "public class InddObjExtraLavorazioneRequest");

        foreach (var (nome, metodo) in new[] { ("modificaPrimarieSecondarie", ps), ("modificaNoRender", noRender) })
        {
            int controllo = metodo.IndexOf("if (esito != \"ok\")\n                    throw new ErroreIstanta(\"registrazione della decisione\", esito);", StringComparison.Ordinal);
            int successo = metodo.IndexOf("result.Esito = true;", StringComparison.Ordinal);
            Assert.True(controllo > 0, nome + ": manca il controllo dell'esito");
            Assert.True(successo > controllo, nome + ": l'esito positivo solo dopo il controllo");
            Assert.Contains($"result.error = DescrizioneErrori.Breve(\"{nome}\", ex);", metodo);
            Assert.Contains("result.dettaglio = DescrizioneErrori.Dettaglio(ex);", metodo);
            Assert.DoesNotContain("result.error = ex.ToString()", metodo);
        }
        Assert.Contains("throw new ErroreIstanta(\"lettura della richiesta\", $\"le primarie e secondarie del gruppo {dato.CodiceGruppo} non si leggono.\");", ps);
    }

    [Fact]
    public void La_registrazione_dice_se_i_meta_non_si_sono_salvati()
    {
        string register = Tratto(Sorgente("Istanta/Utility/Register.cs"), "public long addOperazione(", "public bool updateOperazione(");
        Assert.Contains("Errore = null;", register);
        Assert.Contains("Errore = \"salvataggio dell'operazione: \" + DescrizioneErrori.Motivo(ex);", register);
        Assert.Contains("la decisione non e' stata salvata.", register);

        string registra = Tratto(Sorgente(Menabo), "private string registraAttivitaMenabo(int id_operazione, string codRef, string url, tipoOperazione tipo, string? formData", "public class FileTest");
        Assert.Contains("if (!int.TryParse(session, out int autore))", registra);
        Assert.DoesNotContain("int.Parse(session)", registra);
        int controllo = registra.IndexOf("if (register.Errore != null)", StringComparison.Ordinal);
        Assert.True(controllo > registra.IndexOf("register.addOperazione(", StringComparison.Ordinal), "l'errore si guarda dopo la registrazione");
        Assert.Contains("return register.Errore;", registra);
    }

    [Fact]
    public void RicollegaBox_legge_pagine_e_storico_senza_nascondere_gli_errori()
    {
        string metodo = Tratto(Sorgente(Menabo), "\n        public async Task<IActionResult> ricollegaBox(", "\n        [Http");

        Assert.Contains("List<Byte> _pagineCoinvolte = PagineDellIntervallo(request.rangePagine);", metodo);
        Assert.DoesNotContain("Byte.Parse(", metodo);
        Assert.Contains("catch (JsonException exJson)", metodo);
        Assert.DoesNotContain("\"lavorazione_inesistente\"", metodo);
        Assert.DoesNotContain("\"promo_inesistente\"", metodo);
        //Lo storico che non si legge e' un errore dell'elemento, non un "inesistente".
        int letturaFallita = metodo.IndexOf("else if (okResult.Value is BoolResult letturaFallita && !letturaFallita.Esito)", StringComparison.Ordinal);
        int errore = metodo.IndexOf("result.codici.Add(new RicollegamentoBoxItem() { error = erroreDelloStorico });", StringComparison.Ordinal);
        int inesistente = metodo.IndexOf("else if (riscontroTracciati.Count == 0)", StringComparison.Ordinal);
        Assert.True(letturaFallita > 0 && errore > letturaFallita && inesistente > errore, "lo stato Inesistente solo dopo aver escluso l'errore dello storico");
        Assert.Contains("result.dettaglio = DescrizioneErrori.Dettaglio(ex);", metodo);

        string fratelli = Tratto(Sorgente(Menabo), "private PromoLavorazioniRecord? GetLavorazioneRecordConFratelli(", "var matchEsatto = candidati");
        Assert.Contains("throw new ErroreIstanta(\"lettura del record\", $\"il record {idRec} del gruppo {codiceGruppo} non e' piu' nel tracciato: riscaricare la lista e riprovare.\");", fratelli);
    }

    [Fact]
    public void Il_cambio_strutturale_controlla_sessione_addestramento_e_primario_e_conta_i_salvati()
    {
        string sorgente = Sorgente(Menabo);
        string cambio = Tratto(sorgente, "\n        public async Task<IActionResult> cambioMetaRecordInLavorazione(", "public static string TestoCambioNonRiuscito(");

        int apertura = cambio.IndexOf("try\n            {", StringComparison.Ordinal);
        int sessione = cambio.IndexOf("if (!Int16.TryParse(session, out Int16 id_utente))", StringComparison.Ordinal);
        Assert.True(apertura > 0 && sessione > apertura, "la sessione si legge dentro il try");
        Assert.DoesNotContain("int.Parse(session)", cambio);
        Assert.DoesNotContain("Int16.Parse(session)", cambio);

        int addestramento = cambio.IndexOf("throw new ErroreIstanta(\"lettura dell'addestramento\",", StringComparison.Ordinal);
        int ciclo = cambio.IndexOf("foreach (var (act, ptrList_Act) in azioniConRecord)", StringComparison.Ordinal);
        Assert.True(addestramento > 0 && ciclo > addestramento, "senza addestramento ci si ferma prima di salvare qualunque record");

        int salvataggio = cambio.IndexOf("this.ctx2.SaveChanges();\n", ciclo, StringComparison.Ordinal);
        int conta = cambio.IndexOf("result.salvati++;", ciclo, StringComparison.Ordinal);
        Assert.True(salvataggio > 0 && conta > salvataggio, "un record si conta salvato dopo il suo SaveChanges");
        Assert.Contains("result.totale = azioniConRecord.Sum(a => a.records.Count);", cambio);
        Assert.Contains("result.error = TestoCambioNonRiuscito(result.salvati, result.totale, ex);", cambio);
        Assert.Contains("throw new ErroreIstanta(\"registrazione del cambio\", $\"ref {ptr.Codice}: {register.Errore}\");", cambio);
        Assert.DoesNotContain("result.error = ex.ToString()", cambio);

        string set = Tratto(sorgente, "\n        public async Task<IActionResult> setCambioStrutturale(", "\n        [Http");
        Assert.Contains("throw ErroreIstanta.Inoltrato(resultSet.error,", set);
        Assert.DoesNotContain("Error:\" + resultSet.error", set);
        Assert.Contains("?? throw new ErroreIstanta(\"scelta del primario\", $\"dopo il cambio strutturale il gruppo {obj.codiceGruppo} non ha un record primario.\");", set);
        Assert.DoesNotContain("primario!.", set);
        Assert.Contains("throw new ErroreIstanta(\"raggruppamento della lista\", resLista.error);", set);
        Assert.Contains("result.dettaglio = dettaglioDelCambio ?? DescrizioneErrori.Dettaglio(ex);", set);
    }

    /* ---- strumenti ---- */

    private const string Menabo = "Istanta/Controllers/MenaboController.cs";

    private static int Conta(string testo, string cercato)
    {
        int volte = 0;
        for (int i = testo.IndexOf(cercato, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cercato, i + cercato.Length, StringComparison.Ordinal))
        {
            volte++;
        }
        return volte;
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
