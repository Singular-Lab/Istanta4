using System.Text.RegularExpressions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1190: stringendo la finestra l'editor del volantino, col menabò avanzato aperto, si accavallava:
/// la barra del menabò usciva dallo schermo (sparivano REPORT e CHIUDI), i bottoni in alto finivano
/// sotto la barra alta, il pannello delle pagine e i pannelli a sinistra restavano larghi come su uno
/// schermo grande. Ora la disposizione si riadatta, senza rimpicciolire niente; a finestra larga resta
/// quella di sempre. Si controlla il sorgente di Views/Volantini/Dettaglio.cshtml e wwwroot/js/timone.js.
/// </summary>
public class EditorFinestraStrettaTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine(new[] { RadiceApplicazione() }.Concat(percorso).ToArray())).Replace("\r\n", "\n");

    private static string Editor() => Leggi("Views", "Volantini", "Dettaglio.cshtml");
    private static string Timone() => Leggi("wwwroot", "js", "timone.js");

    [Fact]
    public void La_barra_alta_e_in_riga_e_il_titolo_si_accorcia()
    {
        string v = Editor();
        Assert.Contains("display: flex; align-items: center;\n    }\n    .barra_alta .logo { flex: none;", v);
        Assert.Contains(".barra_alta .titolo_zona .titolo_testo { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }", v);
        Assert.Contains(".barra_alta .destra { flex: none; margin-left: auto;", v);
        Assert.DoesNotContain(".barra_alta .destra { float: right;", v);
    }

    [Fact]
    public void Il_pannello_delle_pagine_si_restringe_con_la_finestra()
    {
        Assert.Contains("width: clamp(180px, 30vw, 300px); height: 85%;", Editor());
    }

    [Fact]
    public void La_barra_del_menabo_va_a_capo_e_chi_sta_sotto_ne_segue_l_altezza()
    {
        string js = Timone();
        Assert.Contains("#tim_barra { position: fixed; left: 0; right: 0; top: 80px; min-height: 42px;", js);
        Assert.Contains("flex-wrap: wrap;", js);
        Assert.Contains("document.documentElement.style.setProperty('--tim-h', (h > 0 ? h : 42) + 'px');", js);
        Assert.Contains("new ResizeObserver(altezzaBarra).observe(barra);", js);
        Assert.Contains("body.tim_on .area { top: calc(80px + var(--tim-h)); left: calc(var(--tim-pan) + 10px); }", js);
    }

    [Fact]
    public void Nel_foglio_di_stile_del_menabo_non_restano_altezze_scritte_a_mano()
    {
        // i 122px (80 della barra alta + 42 di quella del menabò) erano scritti in sette punti
        string stile = Timone();
        int fine = stile.IndexOf("var STILE_REPORT", StringComparison.Ordinal);
        Assert.True(fine > 0, "STILE_REPORT non trovato: il test va aggiornato");
        Assert.DoesNotMatch(new Regex(@"\b12[2-8]px\b"), stile[..fine]);
    }

    [Fact]
    public void I_pannelli_a_sinistra_si_restringono_con_la_finestra()
    {
        string js = Timone();
        Assert.Contains(":root { --tim-h: 42px; --tim-pan: clamp(170px, 22vw, 240px); }", js);
        Assert.Contains(".tim_pan { position: fixed; left: 0; width: var(--tim-pan);", js);
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
