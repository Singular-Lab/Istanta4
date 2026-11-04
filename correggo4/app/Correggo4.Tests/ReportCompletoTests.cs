using Correggo4.Auth;
using Correggo4.Controllers;
using Correggo4.Servizi;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1191: accanto a MENABÒ AVANZATO, nell'editor, il pulsante REPORT COMPLETO scarica il report del
/// menabò in PDF senza aprirlo (pagine modificate, correzioni dell'editor, preview di tutte le pagine in
/// coda). Lo vedono Agenzia e Marketing; se il server non ha il motore dei PDF si apre la stampa del
/// browser. Il pulsante e il report stanno nel browser: si controlla il sorgente; la rotta del PDF, che
/// prima era solo dell'Agenzia, si controlla nella sua regola.
/// </summary>
public class ReportCompletoTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine(new[] { RadiceApplicazione() }.Concat(percorso).ToArray())).Replace("\r\n", "\n");

    private static string Timone() => Leggi("wwwroot", "js", "timone.js");

    private static string Funzione(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        int fine = sorgente.IndexOf("\n    }\n", inizio, StringComparison.Ordinal);
        return sorgente.Substring(inizio, fine - inizio);
    }

    [Fact]
    public void Il_pulsante_sta_accanto_a_menabo_avanzato_e_parte_nascosto()
    {
        string vista = Leggi("Views", "Volantini", "Dettaglio.cshtml");
        int menabo = vista.IndexOf(">MENABÒ AVANZATO</button>", StringComparison.Ordinal);
        int report = vista.IndexOf("<button type=\"button\" class=\"nascosto\" id=\"tReportCompleto\"", StringComparison.Ordinal);
        Assert.True(menabo > 0 && report > menabo, "REPORT COMPLETO va subito dopo MENABÒ AVANZATO");
        Assert.True(vista.IndexOf("<span class=\"utente\">", StringComparison.Ordinal) > report);
    }

    [Fact]
    public void Compare_solo_se_il_piano_c_e()
    {
        Assert.Contains("if (j && j.ok && j.dati && j.dati.esiste === true && bReportCompleto) bReportCompleto.classList.remove('nascosto');",
                        Timone());
    }

    [Fact]
    public void Ha_solo_il_contorno_bianco_e_il_blu_pieno_resta_a_menabo_avanzato()
    {
        // I20-1194: col blu pieno di MENABÒ AVANZATO era troppo in vista
        string js = Timone();
        Assert.Contains("#tReportCompleto { background: transparent; box-shadow: none; }", js);
        Assert.Contains("#tReportCompleto:hover { background: rgba(255,255,255,.18); }", js);
        Assert.Contains("border: 2px solid #fff;", js);
        Assert.Contains("#tTimone:hover { background: #2a72ee; }", js);
        Assert.DoesNotContain("#tReportCompleto:hover { background: #2a72ee; }", js);
        Assert.DoesNotContain("#tTimone:hover, #tReportCompleto:hover", js);
    }

    [Fact]
    public void Fa_il_report_del_piano_salvato_con_schede_e_correzioni_e_lo_manda_in_PDF()
    {
        string js = Timone();
        string rc = Funzione(js, "function reportCompleto()");
        Assert.Contains("chiedi(C4_BASE + 'Timone/' + ID_VOL + '/Piano')", rc);
        Assert.Contains("chiediSchedaBox(k, pronto);", rc);
        Assert.Contains("chiediCorrezioni(p, pronto);", rc);
        Assert.Contains("mandaPdf(p, aspetta, stampaInRiquadro);", rc);
        // lo stesso report di ESPORTA PDF: preview in coda e correzioni
        string manda = Funzione(js, "function mandaPdf(p, aspetta, senzaMotore)");
        Assert.Contains("anteprima: function (n) { return rpAnteprima(p, n); },", manda);
        Assert.Contains("correzioni: oc.correzioni,", manda);
    }

    [Fact]
    public void Senza_motore_dei_PDF_si_apre_la_stampa_del_browser()
    {
        string js = Timone();
        Assert.Contains("if (senzaMotore && documento && e && e.codice === 'motore_mancante') { senzaMotore(documento); return; }",
                        Funzione(js, "function mandaPdf(p, aspetta, senzaMotore)"));
        string stampa = Funzione(js, "function stampaInRiquadro(documento)");
        Assert.Contains("document.createElement('iframe')", stampa);
        Assert.Contains("f.contentWindow.print();", stampa);
        Assert.DoesNotContain("window.open", stampa);
    }

    [Theory]
    [InlineData("agenzia", true)]
    [InlineData("marketing", true)]
    [InlineData("category", false)]
    public void Il_PDF_lo_scaricano_Agenzia_e_Marketing(string chi, bool puo)
    {
        var utente = chi switch
        {
            "agenzia" => new ServizioTimone.Chi(1, Ruoli.CodiceAgenzia, null, "Agenzia"),
            "marketing" => new ServizioTimone.Chi(2, Ruoli.CodiceGdo, ServizioTimone.TipoFicoMarketing, "Marketing"),
            _ => new ServizioTimone.Chi(3, Ruoli.CodiceGdo, ServizioCorrezioni.TipoFicoCategory, "Category")
        };
        Assert.Equal(puo, TimonePdfController.PuoScaricare(utente));
    }

    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
