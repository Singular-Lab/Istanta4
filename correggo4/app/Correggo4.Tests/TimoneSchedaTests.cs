using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1183, due ritocchi alla scheda dentro le caselle del timone (wwwroot/js/timone.js):
///  - la descrizione mostrava l'a capo forzato di InDesign in chiaro («meleFORCED_LINE_BREAKgolden
///    MELINDA»): ora diventa uno spazio, come nelle altre etichette su una riga (I20-1170);
///  - zoomando le caselle crescevano col foglio ma scritte e foto restavano della stessa misura, cioe'
///    sempre piu' piccole rispetto alla pagina: oltre lo zoom «adatta» (48%) la scheda si ingrandisce
///    intera, sotto si adatta alla casella come prima (j304).
/// Si controlla il sorgente, come per le viste in AcapoForzatoTests.
/// </summary>
public class TimoneSchedaTests
{
    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    private static string Funzione(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        // la funzione finisce alla prima graffa chiusa a inizio riga: rientrata di 4 dentro il modulo,
        // senza rientro per le funzioni del report (rpPulisci)
        int fine = new[] { "\n    }\n", "\n}\n" }
            .Select(f => sorgente.IndexOf(f, inizio, StringComparison.Ordinal))
            .Where(i => i >= 0).Min();
        return sorgente.Substring(inizio, fine - inizio);
    }

    // ------------------------------------------------------------------ a capo forzato

    [Fact]
    public void Nella_scheda_e_nei_pannelli_l_a_capo_forzato_diventa_uno_spazio()
    {
        string js = Timone();

        Assert.Contains("var ACAPO_FORZATO = /FORCED_LINE_BREAK/g;", js);
        // prima l'a capo forzato, poi i tag, poi gli spazi stretti: «mele golden MELINDA»
        Assert.Contains(".replace(ACAPO_FORZATO, ' ').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim()",
                        Funzione(js, "function leggibile(s)"));
    }

    [Fact]
    public void Nel_report_del_timone_l_a_capo_forzato_diventa_uno_spazio()
    {
        Assert.Contains(".replace(ACAPO_FORZATO, ' ')", Funzione(Timone(), "function rpPulisci(t)"));
    }

    [Fact]
    public void Anche_la_descrizione_di_Istanta_passa_dalla_pulizia()
    {
        string js = Timone();

        Assert.Contains("dd.textContent = leggibile(v.etichetta) || leggibile(f && f.descrizione);", js);
        Assert.Contains("de.textContent = leggibile(f.descrizione);", js);
        Assert.Contains("descrizione: rpPulisci(mia.descrizione)", js);
        Assert.DoesNotContain("de.textContent = f.descrizione;", js);
    }

    // ------------------------------------------------------------------ zoom

    [Fact]
    public void Oltre_lo_zoom_adatta_la_scheda_si_ingrandisce_dello_zoom_diviso_48()
    {
        string js = Timone();

        Assert.Contains("var ZOOM_ADATTA = 48;", js);
        string scala = Funzione(js, "function scalaScheda()");
        Assert.Contains("return quanto > ZOOM_ADATTA ? quanto / ZOOM_ADATTA : 1;", scala);

        string scheda = Funzione(js, "function disegnaScheda(c, v, scala)");
        Assert.Contains("if (scala > 1) {", scheda);
        Assert.Contains("sk.style.transform = 'scale(' + scala + ')';", scheda);
        Assert.Contains("sk.style.width = (100 / scala) + '%';", scheda);
        Assert.Contains("sk.style.height = (100 / scala) + '%';", scheda);
        Assert.Contains("sk.style.transformOrigin = '0 0';", scheda);
    }

    [Fact]
    public void Sotto_lo_zoom_adatta_non_si_scala_niente()
    {
        // la scala non scende mai sotto 1: fino al 48% la scheda si adatta alla casella (j304)
        string scala = Funzione(Timone(), "function scalaScheda()");
        Assert.DoesNotContain("Math.min", scala);
        Assert.Contains(": 1;", scala);
    }

    [Fact]
    public void La_forma_della_scheda_si_sceglie_sulla_misura_a_zoom_adatta()
    {
        string casella = Funzione(Timone(), "function disegnaCasella(foglio, v, pagina, dove)");

        Assert.Contains("var scala = scalaScheda();", casella);
        Assert.Contains("var largaPx = largoFoglio0 ? q.w / dw * largoFoglio0 / scala : 999;", casella);
        Assert.Contains("var altaPx = altoFoglio0 ? q.h / dh * altoFoglio0 / scala : 999;", casella);
        Assert.Contains("disegnaScheda(c, v, scala);", casella);
    }

    [Fact]
    public void Gli_spazi_per_la_barra_e_l_etichetta_restano_in_pixel_veri()
    {
        string js = Timone();

        Assert.Contains("padding: calc(32px / var(--tim-s, 1)) 0 calc(18px / var(--tim-s, 1));", js);
        Assert.Contains(".tim_casella.stretta .sk { padding-top: calc(20px / var(--tim-s, 1)); }", js);
        Assert.Contains(".tim_casella.minima .sk { padding-top: calc(19px / var(--tim-s, 1));", js);
        Assert.Contains("sk.style.setProperty('--tim-s', String(scala));", js);
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
