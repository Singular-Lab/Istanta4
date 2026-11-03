using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1186, la parte nel browser. La «Modifica referenza» del timone su un gruppo del timone apre la
/// scheda dell'Edit avanzato in modalita' timone (Views/Volantini/Dettaglio.cshtml): referenze di
/// tutto il gruppo, SALVA e ANNULLA che non chiamano il server ma passano la correzione al timone,
/// niente CONFERMA ne' propagazioni. Il timone (wwwroot/js/timone.js) la tiene nella bozza, la manda
/// col SALVA e la scrive nel report. Fuori dal timone il Marketing vede il messaggio.
/// Si controlla il sorgente, come per gli altri test delle viste.
/// </summary>
public class TimoneGruppoSchedaTests
{
    private static string Leggi(params string[] percorso) =>
        File.ReadAllText(Path.Combine(new[] { RadiceApplicazione() }.Concat(percorso).ToArray())).Replace("\r\n", "\n");

    private static string Scheda() => Leggi("Views", "Volantini", "Dettaglio.cshtml");
    private static string Timone() => Leggi("wwwroot", "js", "timone.js");

    /// <summary>Dalla firma alla prima graffa chiusa rientrata di 4 (o alla fine indicata).</summary>
    private static string Funzione(string sorgente, string firma, string fineFunzione = "\n    }\n")
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata: il test va aggiornato");
        int fine = sorgente.IndexOf(fineFunzione, inizio, StringComparison.Ordinal);
        Assert.True(fine > inizio, $"fine di «{firma}» non trovata: il test va aggiornato");
        return sorgente.Substring(inizio, fine - inizio);
    }

    // ------------------------------------------------------------------ la scheda

    [Fact]
    public void Il_gancio_apre_la_scheda_in_modalita_timone_solo_con_il_gruppo()
    {
        string apri = Funzione(Scheda(), "apri: function (idBox, opzioni) {", "chiudi: chiudiModale");
        Assert.Contains("modoTimone = null;", apri);
        Assert.Contains("if (opzioni && opzioni.gruppo) {", apri);
        Assert.Contains("boxGruppo: opzioni.gruppo.map(String),", apri);
        Assert.Contains("modificabile: opzioni.modificabile === true,", apri);
    }

    [Fact]
    public void In_modalita_timone_salva_e_annulla_non_chiamano_il_server()
    {
        string js = Scheda();
        Assert.Contains("if (inModoTimone(id)) { errore.textContent = ''; eseguiNelTimone(id, parte, azione, errore); return; }",
                        Funzione(js, "function eseguiEdit(id, parte, azione, bottone, errore)"));
        string nelTimone = Funzione(js, "function eseguiNelTimone(id, parte, azione, errore)");
        Assert.DoesNotContain("api(", nelTimone);
        Assert.Contains("modoTimone.salva(m);", nelTimone);
    }

    [Fact]
    public void In_modalita_timone_la_scheda_parte_dalla_correzione_del_gruppo()
    {
        string js = Scheda();
        Assert.Contains("if (inModoTimone(id)) return editDelGruppo(parte);", Funzione(js, "function editDi(id, parte)"));
        // le foto di tutti i box del gruppo; la nuova foto si carica sul box del suo codice
        Assert.Contains("var boxes = inModoTimone(id) ? modoTimone.boxGruppo : [String(id)];",
                        Funzione(js, "function schedaDelBox(id)"));
        Assert.Contains("fetch(C4_BASE + 'Correzioni/Edit/' + idBoxFoto + '/Foto/'", js);
    }

    [Fact]
    public void Nel_gruppo_la_prima_foto_parte_primaria_e_le_altre_secondarie()
    {
        string inizializza = Funzione(Scheda(), "function inizializzaFoto(id)");
        int proposta = inizializza.IndexOf(
            "schedaFoto.foto.forEach(function (f, i) { fotoCorrenti[f.codice].stato = i === 0 ? 1 : 2; });", StringComparison.Ordinal);
        int salvate = inizializza.IndexOf("var ed = editDi(id, 'descrizione');", StringComparison.Ordinal);
        Assert.True(proposta >= 0, "manca la proposta P/S del gruppo");
        Assert.True(salvate > proposta, "le foto salvate devono venire dopo la proposta, per vincere");
        Assert.Contains("if (inModoTimone(id))", inizializza);
    }

    [Fact]
    public void Il_box_di_chi_tiene_la_casella_arriva_per_primo()
    {
        Assert.Contains("[capo].concat(gruppoDi(v).filter(function (x) { return x !== capo; })).forEach(",
                        Funzione(Timone(), "function boxDelGruppo(v)"));
    }

    [Fact]
    public void In_modalita_timone_niente_conferma_ne_propagazioni()
    {
        string js = Scheda();
        Assert.Contains("} else if (stato.puoAccettare && ed && ed.stato === 0 && !inModoTimone(id)) {",
                        Funzione(js, "function piedeEdit(id, parte)"));
        Assert.Contains("if (inModoTimone(id)) {", Funzione(js, "function disegnaPropagazioniEdit(id)"));
    }

    [Fact]
    public void Fuori_dal_timone_il_Marketing_vede_il_messaggio_del_server()
    {
        string js = Scheda();
        Assert.Contains("var MESSAGGIO_GRUPPO_TIMONE = @Html.Raw(System.Text.Json.JsonSerializer.Serialize(" +
                        "Correggo4.Servizi.ServizioCorrezioni.MessaggioGruppoTimone));", js);
        Assert.Contains("if (bloccatoDalTimone(id)) return false;", Funzione(js, "function puoModificare(id, parte)"));
        // il messaggio sta nel riquadro rosso al centro della scheda, non piu' nella riga grigia sotto i campi
        string avviso = Funzione(js, "function avvisoGruppoTimone(id)");
        Assert.Contains("var acceso = !inModoTimone(id) && bloccatoDalTimone(id);", avviso);
        Assert.Contains("MESSAGGIO_GRUPPO_TIMONE", avviso);
        Assert.DoesNotContain("esc(MESSAGGIO_GRUPPO_TIMONE) + '</div>'", Funzione(js, "function piedeEdit(id, parte)"));
    }

    [Fact]
    public void Il_riquadro_si_accende_all_apertura_e_si_spegne_alla_chiusura()
    {
        string js = Scheda();
        Assert.Contains("avvisoGruppoTimone(id);", Funzione(js, "function apri(id, clickX, clickY)"));
        Assert.Contains("document.getElementById('mAvvisoGruppo').classList.remove('visibile');",
                        Funzione(js, "function chiudiModale()"));
        Assert.Contains("<div class=\"avviso_gruppo_timone\" id=\"mAvvisoGruppo\">", js);
    }

    [Fact]
    public void CHIUDI_sta_sopra_il_velo_del_riquadro()
    {
        string js = Scheda();
        Assert.Contains("background: rgba(235,235,235,.68);", js);   // la scheda si vede, sbiadita
        Assert.Contains(".modale .avviso_gruppo_timone {\n        display: none; position: absolute; left: 0; right: 0; bottom: 0; top: 0; z-index: 3;", js);
        Assert.Contains(".modale .testa .chiudi { position: relative; z-index: 4; }", js);
    }

    // ------------------------------------------------------------------ il timone

    [Fact]
    public void La_matita_su_un_gruppo_del_timone_non_chiede_di_salvare_prima()
    {
        string matita = Funzione(Timone(), "function apriSchedaBox(v)");
        int gruppo = matita.IndexOf("if (eGruppoDelTimone(v)) {", StringComparison.Ordinal);
        int primaSalva = matita.IndexOf("if (modifiche > 0) {", StringComparison.Ordinal);
        Assert.True(gruppo >= 0 && primaSalva > gruppo, "il gruppo del timone va gestito prima di «Prima salva il timone»");
        Assert.Contains("gruppo: boxDelGruppo(v),", matita);
        Assert.Contains("scriviModificaDelGruppo(v, modifica);", matita);
    }

    [Fact]
    public void Un_gruppo_del_timone_viene_da_almeno_due_box()
    {
        string js = Timone();
        Assert.Contains("function eGruppoDelTimone(v) { return boxDelGruppo(v).length >= 2; }", js);
    }

    [Fact]
    public void Il_salva_del_timone_manda_la_correzione_del_gruppo()
    {
        Assert.Contains("modificaGruppo: v.modificaGruppo || null", Funzione(Timone(), "function salva()"));
    }

    [Fact]
    public void Il_report_scrive_la_modifica_del_gruppo()
    {
        string js = Timone();
        Assert.Contains("mod: ['mod', 'GRUPPO MODIFICATO']", js);
        Assert.Contains("if (v.stato === 0 && v.modificaGruppo) r.tipi.push('mod');", js);
        Assert.Contains("s += rpModifica(r.voce.modificaGruppo);", js);
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
