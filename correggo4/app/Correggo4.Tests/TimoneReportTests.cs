using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1189: il report delle modifiche del timone (wwwroot/js/timone.js, rpCostruisci).
///  - solo le pagine su cui e' cambiato qualcosa; le altre in una riga;
///  - un filtro per etichette, solo a schermo: stampa e PDF escono completi;
///  - VEDI PREVIEW in fondo a ogni pagina: com'era a sinistra, lo schema del piano a destra;
///  - in stampa e nel PDF le preview di tutte le pagine cambiate, in coda;
///  - niente piu' tabella di tutte le pagine; «come si legge» aggiornato.
/// Il report si disegna nel browser: si controlla il sorgente, come per gli altri test del timone.
/// </summary>
public class TimoneReportTests
{
    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    /// <summary>
    /// Dalla firma alla graffa che la chiude: rientrata di 4 per le funzioni del modulo, a inizio riga
    /// per quelle del report (rpCostruisci), che dentro hanno altre funzioni rientrate di 4.
    /// </summary>
    private static string Funzione(string sorgente, string firma, string chiusura = "\n    }\n")
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        int fine = sorgente.IndexOf(chiusura, inizio, StringComparison.Ordinal);
        Assert.True(fine > inizio, $"fine di «{firma}» non trovata: il test va aggiornato");
        return sorgente.Substring(inizio, fine - inizio);
    }

    private static string Report() => Funzione(Timone(), "function rpCostruisci(piano, opzioni)", "\n}\n");

    [Fact]
    public void Si_mostrano_solo_le_pagine_cambiate_e_le_altre_in_una_riga()
    {
        string rp = Report();
        Assert.Contains("cambiata: arrivate.length > 0 || partite.length > 0 || bloccateQui.length > 0", rp);
        Assert.Contains("cambiate.forEach(function (p) {", rp);
        Assert.DoesNotContain("pagine.forEach(function (p) {\n        var dentro", rp);
        Assert.Contains("'Pagina senza modifiche', 'Pagine senza modifiche'", rp);
        Assert.DoesNotContain("non &egrave; stato ' +\n                   'cambiato niente", rp);
    }

    [Fact]
    public void La_tabella_di_tutte_le_pagine_non_c_e_piu()
    {
        string js = Timone();
        Assert.DoesNotContain("TUTTE LE PAGINE, IN UNA TABELLA", js);
        Assert.DoesNotContain("table class=\"rp_tab\"", js);
    }

    [Fact]
    public void Il_filtro_c_e_solo_a_schermo_e_non_tocca_la_stampa()
    {
        string js = Timone();
        string rp = Report();
        Assert.Contains("if (aSchermo && presenti.length) {", rp);
        Assert.Contains("data-filtro-tutte>SELEZIONA TUTTE</button>", rp);
        Assert.Contains("data-filtro-nessuna>DESELEZIONA TUTTE</button>", rp);
        Assert.Contains("cb.checked = false;", Funzione(js, "function collegaFiltro()"));
        Assert.Contains("'<div class=\"rp_riga\" data-tipi=\"' + r.tipi.join(' ') + '\">", rp);
        // nascosto dal filtro solo su schermo; la fila delle spunte non si stampa
        Assert.Contains("@media screen { #tim_report .rp_via { display: none !important; } }", js);
        Assert.Contains("#tim_report .rp_barra, #tim_report .rp_avviso, #tim_report .rp_filtro, #tim_report .rp_vedi,", js);
        Assert.Contains("el.classList.toggle('rp_via', !visibile);", Funzione(js, "function collegaFiltro()"));
    }

    [Fact]
    public void Ogni_pagina_ha_vedi_preview_e_la_preview_affianca_com_era_e_il_piano()
    {
        string js = Timone();
        Assert.Contains("'<button type=\"button\" class=\"rp_vedi\" data-anteprima=\"' + p.numero + '\">VEDI PREVIEW</button>'", Report());

        string ante = Funzione(js, "function rpAnteprima(p, numero)");
        Assert.Contains("document.querySelector('.foglio[data-numero=\"' + numero + '\"] img.pagina')", ante);
        // i due lati si chiamano PRIMA e DOPO (revisione del 03/11)
        Assert.Contains("<div class=\"tit\">PRIMA <small>", ante);
        Assert.Contains("<div class=\"tit\">DOPO <small>", ante);
        Assert.DoesNotContain("COM\\'ERA", ante);
        Assert.DoesNotContain("IL PIANO", ante);
        // stessa geometria del timone
        Assert.Contains("riquadro(nativi, pagina)", ante);
        Assert.Contains("rettangoloDi(r, pagina, v.posizione, v.colonne, v.righe)", ante);
        Assert.Contains("cellaDi(r, pagina, b.posizione)", ante);
    }

    [Fact]
    public void In_stampa_e_nel_PDF_le_preview_sono_in_coda()
    {
        string js = Timone();
        string rp = Report();
        // tutte le pagine, anche quelle senza modifiche (revisione del 03/11)
        Assert.Contains("PREVIEW DI TUTTE LE PAGINE", rp);
        Assert.Contains("if (anteprima && pagine.length) {", rp);
        Assert.Contains("pagine.forEach(function (p, i) {\n            var ferma = cambiate.indexOf(p) < 0;", rp);
        Assert.Contains("(ferma ? '<span class=\"flag\">SENZA MODIFICHE</span>' : '')", rp);
        Assert.Contains("h.push('<div class=\"rp_solo_stampa\">');", rp);
        Assert.Contains("#tim_report .rp_solo_stampa { display: none; }", js);
        Assert.Contains("#tim_report .rp_solo_stampa { display: block; }", js);
        // il PDF le costruisce anche lui
        Assert.Contains("anteprima: function (n) { return rpAnteprima(p, n); }", Funzione(js, "function esportaPdf()"));
    }

    [Fact]
    public void In_fondo_al_report_mostra_preview_completa_a_schermo()
    {
        string js = Timone();
        Assert.Contains("data-anteprime-tutte>MOSTRA PREVIEW COMPLETA</button>", Report());
        Assert.Contains("#tim_report .rp_solo_stampa.aperta { display: block; }", js);
        // e' un rp_vedi: in stampa non c'e'
        Assert.Contains("class=\"rp_vedi rp_vedi_tutte\"", Report());
        Assert.Contains("'NASCONDI PREVIEW COMPLETA' : 'MOSTRA PREVIEW COMPLETA'", Funzione(js, "function disegnaReport()"));
    }

    [Fact]
    public void La_scritta_sola_lettura_resta_su_una_riga_e_si_legge_intera_col_mouse()
    {
        string js = Timone();
        Assert.Contains("white-space: nowrap; overflow: hidden; text-overflow: ellipsis;", js);
        Assert.Contains("min-width: 0; max-width: 360px; flex: 0 1 auto; }", js);
        Assert.Contains("s.title = s.textContent;", js);
    }

    [Fact]
    public void Il_bottone_dell_editor_si_chiama_menabo_avanzato()
    {
        string vista = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));
        Assert.Contains("title=\"MENABÒ AVANZATO - il piano di rimpaginazione\">MENABÒ AVANZATO</button>", vista);
        Assert.DoesNotContain(">TIMONE</button>", vista);
    }

    /// <summary>
    /// Le correzioni dell'editor (note, timbri, Edit avanzato) sotto ogni pagina, prese dallo stesso
    /// report della finestra REPORT dell'editor e divise per «PAG. N» (Views/Storico/_VociReport.cshtml).
    /// </summary>
    [Fact]
    public void Sotto_ogni_pagina_ci_sono_le_correzioni_dell_editor()
    {
        string js = Timone();
        string rp = Report();
        string chiedi = Funzione(js, "function chiediCorrezioni(p, poi)");
        Assert.Contains("'Storico/Report/' + ID_VOL + '/' + p.versione + '?incorporato=true'", chiedi);
        Assert.Contains("el.classList.contains('rp_pag')", chiedi);
        Assert.Contains("el.classList.contains('rp_voce')", chiedi);
        Assert.Contains("removeAttribute('loading')", chiedi);

        // una pagina con sole correzioni va nel report, e le correzioni hanno la loro etichetta
        Assert.Contains("|| corr !== '' };", rp);
        Assert.Contains("'<div class=\"rp_corr\" data-tipi=\"cor\"><div class=\"rp_corr_tit\">CORREZIONI NELL\\'EDITOR</div>'", rp);
        Assert.Contains("t === 'cor' ? ['cor', 'CORREZIONI']", rp);
        // lo stile del report dell'editor vale solo dentro il blocco
        Assert.Contains("#tim_report .rp_corr .rp_foto { flex: none; height: auto;", js);
        // anche il PDF le porta
        Assert.Contains("correzioni: oc.correzioni,", Funzione(js, "function esportaPdf()"));

        // a sinistra di ogni correzione la miniatura del prodotto del suo box, o il «no foto»
        Assert.Contains("idBox: el.dataset.box ? Number(el.dataset.box) : null", chiedi);
        string mini = Funzione(js, "function miniaturaCorrezione(p, idBox)");
        Assert.Contains("return v.idElemento === idBox;", mini);
        Assert.Contains("rpInfoRef(v.codice, v)", mini);
        Assert.Contains("VIA_NOFOTO", mini);
        Assert.Contains("miniaturaCorrezione(p, x.idBox)", Funzione(js, "function opzioniCorrezioni(p)"));
    }

    [Fact]
    public void Il_formato_del_report_dell_editor_e_quello_che_il_menabo_divide()
    {
        string voci = File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Storico", "_VociReport.cshtml"));
        Assert.Contains("<div class=\"@(Model.Prodotto ? \"rp_pag rp_pag_piccola\" : \"rp_pag\")\">PAG. @gp.Key</div>", voci);
        Assert.Contains("<div class=\"rp_voce\" data-box=\"@v.IdBox\">", voci);
    }

    [Fact]
    public void Il_come_si_legge_racconta_pagine_filtro_e_preview()
    {
        string rp = Report();
        Assert.Contains("solo le pagine su cui ' +", rp);
        Assert.Contains("<b>VEDI PREVIEW</b>", rp);
        Assert.Contains("<b>MOSTRA PREVIEW COMPLETA</b>", rp);
        Assert.Contains("etichette sopra le pagine fanno da filtro", rp);
        Assert.DoesNotContain("la tabella di tutte le pagine", rp);
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
