using System.Reflection;
using Istanta.Utility;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1062, lotto 1: gli errori di Istanta dicono dove e perche' si e' rotto il codice.
/// Nel caso della issue getSchedaRef non trovava il formato in DBFORMATI e il Plugin riceveva
/// solo "Object reference not set to an instance of an object", senza riga ne' dati.
///
/// Qui le basi comuni - ErroreIstanta, la descrizione breve per l'operatore, la ricerca unica del
/// formato, i campi obbligatori dei record - e i punti in cui getSchedaRef e il codice condiviso le
/// usano. Il controller intero non si prova: vuole il database, e i test non usano quello reale.
/// </summary>
public class ErroriIstantaTests
{
    /* ---- la descrizione breve ---- */

    [Fact]
    public void Un_ErroreIstanta_dice_chiamata_passo_e_motivo()
    {
        var errore = new ErroreIstanta("lettura del formato", "il formato abc della lavorazione 812 non c'e'.");

        Assert.Equal("getSchedaRef, lettura del formato: il formato abc della lavorazione 812 non c'e'.",
            DescrizioneErrori.Breve("getSchedaRef", errore));
    }

    [Fact]
    public void Un_errore_imprevisto_dice_tipo_file_e_riga()
    {
        var errore = Assert.Throws<NullReferenceException>(() => DereferenziaNull(null));

        string breve = DescrizioneErrori.Breve("getSchedaRef", errore);

        Assert.StartsWith("getSchedaRef: NullReferenceException in ErroriIstantaTests.cs:", breve);
        Assert.Contains(" - ", breve);
    }

    [Fact]
    public void L_errore_di_AgenziaLib_si_legge_dentro_la_TargetInvocationException()
    {
        //La dll si chiama per riflessione: l'eccezione vera arriva incapsulata.
        MethodInfo metodo = typeof(ErroriIstantaTests).GetMethod(nameof(LanciaDaAgenzia), BindingFlags.NonPublic | BindingFlags.Static)!;
        var incapsulata = Assert.Throws<TargetInvocationException>(() => metodo.Invoke(null, null));

        Assert.Equal("esportaVolantino, ordinamento: lista vuota.", DescrizioneErrori.Breve("esportaVolantino", incapsulata));
        Assert.IsType<ErroreIstanta>(DescrizioneErrori.Radice(incapsulata));
    }

    [Fact]
    public void Un_errore_gia_descritto_passa_cosi_com_e()
    {
        var inoltrato = ErroreIstanta.Inoltrato("getSchedaRef, lettura del formato: il formato abc non c'e'.", "Gruppo 12 non trovato");

        Assert.Equal("getSchedaRef, lettura del formato: il formato abc non c'e'.", DescrizioneErrori.Breve("impaginaSingolo", inoltrato));
        Assert.Equal("Gruppo 12 non trovato", DescrizioneErrori.Breve("impaginaSingolo", ErroreIstanta.Inoltrato("", "Gruppo 12 non trovato")));
        Assert.Equal("Gruppo 12 non trovato", DescrizioneErrori.Breve("impaginaSingolo", ErroreIstanta.Inoltrato(null, "Gruppo 12 non trovato")));
    }

    [Fact]
    public void Il_messaggio_breve_sta_su_una_riga_e_nel_limite()
    {
        var lungo = new ErroreIstanta("passo", "riga uno\r\nriga due " + new string('x', 400));

        string breve = DescrizioneErrori.Breve("getSchedaRef", lungo);

        Assert.True(breve.Length <= DescrizioneErrori.LunghezzaMassima, breve.Length.ToString());
        Assert.DoesNotContain("\n", breve);
        Assert.EndsWith("...", breve);
        Assert.Equal(160, DescrizioneErrori.LunghezzaMassima);
    }

    [Fact]
    public void Il_dettaglio_e_la_traccia_completa()
    {
        var errore = Assert.Throws<NullReferenceException>(() => DereferenziaNull(null));

        Assert.Equal(errore.ToString(), DescrizioneErrori.Dettaglio(errore));
    }

    [Fact]
    public void La_prima_riga_di_un_ToString_salvato()
    {
        Assert.Equal("System.Exception: rotto", DescrizioneErrori.PrimaRiga("System.Exception: rotto\r\n   at X.Y()"));
        Assert.Equal("nessun dettaglio", DescrizioneErrori.PrimaRiga(null));
        Assert.Equal("nessun dettaglio", DescrizioneErrori.PrimaRiga("  "));
    }

    /* ---- il formato ---- */

    private static readonly List<Formato> FORMATI = new()
    {
        new Formato { guidID = "vol-1", titolo = "Volantino", tipo = TipoLavorazione.Volantino },
        new Formato { guidID = "pop-1", titolo = "PoP", tipo = TipoLavorazione.PoP }
    };

    [Fact]
    public void Il_formato_conosciuto_si_trova()
    {
        Assert.Equal(TipoLavorazione.PoP, Formati.Trova(FORMATI, "pop-1", "lavorazione 812").tipo);
    }

    [Fact]
    public void Il_formato_sconosciuto_dice_quale_di_chi_e_del_riavvio()
    {
        var errore = Assert.Throws<ErroreIstanta>(() => Formati.Trova(FORMATI, "9f3a-sconosciuto", "lavorazione 812"));

        Assert.Equal("lettura del formato", errore.Passo);
        Assert.Contains("9f3a-sconosciuto", errore.Message);
        Assert.Contains("lavorazione 812", errore.Message);
        Assert.Contains("SourceFormati.json", errore.Message);
        Assert.Contains("riavviare Istanta", errore.Message);
    }

    [Fact]
    public void Senza_formato_o_senza_elenco_lo_dice()
    {
        Assert.Contains("non indica nessun formato", Assert.Throws<ErroreIstanta>(() => Formati.Trova(FORMATI, "", "lavorazione 812")).Message);
        Assert.Contains("non indica nessun formato", Assert.Throws<ErroreIstanta>(() => Formati.Trova(FORMATI, null, "lavorazione 812")).Message);
        Assert.Contains("non e' stato caricato", Assert.Throws<ErroreIstanta>(() => Formati.Trova(null, "vol-1", "lavorazione 812")).Message);
    }

    /* ---- i campi dei record ---- */

    [Fact]
    public void Il_campo_presente_si_legge()
    {
        var record = new Dictionary<string, object> { ["Referenza.Codice"] = "12345" };

        Assert.Equal("12345", RecordTracciato.Richiesto(record, "Referenza.Codice", "lettura del gruppo", "il record 7"));
    }

    [Fact]
    public void Il_campo_mancante_o_nullo_dice_quale_e_di_quale_record()
    {
        var senza = new Dictionary<string, object>();
        var nullo = new Dictionary<string, object> { ["Referenza.Codice"] = null! };

        foreach (var record in new[] { senza, nullo })
        {
            var errore = Assert.Throws<ErroreIstanta>(() => RecordTracciato.Richiesto(record, "Referenza.Codice", "lettura del gruppo", "il record 7 del gruppo 99"));
            Assert.Equal("lettura del gruppo", errore.Passo);
            Assert.Equal("il record 7 del gruppo 99 non ha il campo Referenza.Codice.", errore.Message);
        }

        Assert.Contains("non si legge", Assert.Throws<ErroreIstanta>(() => RecordTracciato.Richiesto(null, "Referenza.Codice", "lettura del gruppo", "il record 7")).Message);
    }

    /* ---- dove si usano ---- */

    [Fact]
    public void GetSchedaRef_cerca_il_formato_con_Formati_Trova_e_risponde_con_la_descrizione_breve()
    {
        string corpo = Metodo(Sorgente("Istanta/Controllers/MenaboController.cs"), "public async Task<IActionResult> getSchedaRef(");

        Assert.DoesNotContain("DBFORMATI!", corpo);
        Assert.Contains("Formati.Trova(lavorazione.GuidFormato, $\"lavorazione {idLavorazione}\")", corpo);
        Assert.Contains("Formati.Trova(kit.guidFormato, formatoDelKit)", corpo);
        Assert.Contains("error = DescrizioneErrori.Breve(\"getSchedaRef\", ex),", corpo);
        Assert.Contains("dettaglio = DescrizioneErrori.Dettaglio(ex),", corpo);
        Assert.Contains("throw new ErroreIstanta(\"esportazione di agenzia\", resultAgenzia.errors);", corpo);
        Assert.DoesNotContain("error = ex.ToString()", corpo);
    }

    [Fact]
    public void Chi_chiama_getSchedaRef_inoltra_il_suo_errore()
    {
        string sorgente = Sorgente("Istanta/Controllers/MenaboController.cs");

        string impaginaSingolo = Metodo(sorgente, "public async Task<IActionResult> impaginaSingolo(");
        Assert.Equal(2, Conta(impaginaSingolo, "throw ErroreIstanta.Inoltrato(gruppoResult?.error,"));
        Assert.Contains("error = DescrizioneErrori.Breve(\"impaginaSingolo\", ex),", impaginaSingolo);

        string setCambio = Metodo(sorgente, "public async Task<IActionResult> setCambioStrutturale(");
        Assert.Contains("throw ErroreIstanta.Inoltrato(schedaRefResult?.error,", setCambio);
        Assert.Contains("result.error = DescrizioneErrori.Breve(\"setCambioStrutturale\", ex);", setCambio);

        string ricollega = Metodo(sorgente, "public async Task<IActionResult> ricollegaBox(");
        Assert.Contains("_err = !string.IsNullOrWhiteSpace(gruppoResult?.error)", ricollega);
    }

    [Fact]
    public void L_esportazione_di_agenzia_non_restituisce_mai_null()
    {
        string corpo = Metodo(Sorgente("Istanta/Controllers/FicoProcessController.cs"), "public TracciatoResultKit esportaConLogicheDiAgenzia(");

        Assert.Contains("?? new TracciatoResultKit() { errors = $\"{metodo} non esiste in AgenziaLib.dll", corpo);
        Assert.Contains("if (string.IsNullOrEmpty(agenziaFunc))", corpo);
        Assert.Contains("DescrizioneErrori.Radice(ex)", corpo);
        Assert.DoesNotContain("as TracciatoResultKit)!", corpo);
    }

    [Fact]
    public void Le_lavorazioni_passate_con_formato_sconosciuto_si_saltano()
    {
        string sorgente = Sorgente("Istanta/Controllers/FicoProcessController.cs");

        Assert.Contains("Formati.CercaTipo(Utility.Main.getFicoRuntimeKit(p.IdPromoLavorazioniNavigation.Meta)?.guidFormato) == TipoLavorazione.Volantino", sorgente);
        Assert.Contains("attiva = s.Attiva ?? throw new ErroreIstanta(\"foto dell'articolo\",", sorgente);
    }

    /* ---- strumenti ---- */

    private static int DereferenziaNull(string? testo)
    {
        return testo!.Length;
    }

    private static void LanciaDaAgenzia()
    {
        throw new ErroreIstanta("ordinamento", "lista vuota.");
    }

    private static int Conta(string testo, string cercato)
    {
        int volte = 0;
        for (int i = testo.IndexOf(cercato, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cercato, i + cercato.Length, StringComparison.Ordinal))
        {
            volte++;
        }
        return volte;
    }

    /// Il corpo di un metodo, senza le righe commentate: dalla sua firma alla firma del metodo
    /// pubblico successivo. La firma si cerca a inizio riga, perche' i controller tengono anche le
    /// versioni vecchie dei metodi, commentate.
    private static string Metodo(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf("\n        " + firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, "manca " + firma);
        int fine = sorgente.IndexOf("\n        public ", inizio + firma.Length, StringComparison.Ordinal);
        string corpo = fine > 0 ? sorgente.Substring(inizio, fine - inizio) : sorgente.Substring(inizio);
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
