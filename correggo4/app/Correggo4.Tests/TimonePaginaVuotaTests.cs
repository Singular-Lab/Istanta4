using Correggo4.Servizi;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1245: nel menabò avanzato una referenza mandata in una pagina vuota cambiava pagina ma non
/// si vedeva. La pagina vuota non ha prodotti suoi da cui indovinare la griglia, e senza griglia il
/// timone disegna solo le referenze nate li'. Adesso la pagina riceve la griglia piu' piccola che
/// basta (con una referenza la 1x3, scelta dell'operatore), sia quando la referenza arriva sia
/// riaprendo un piano gia' salvato; una pagina vuota in cui non arriva niente resta senza.
/// Il timone sta nel browser: si controlla il sorgente, come negli altri test del timone.
/// </summary>
public class TimonePaginaVuotaTests
{
    private static string Timone() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "wwwroot", "js", "timone.js")).Replace("\r\n", "\n");

    private static string Funzione(string sorgente, string firma)
    {
        int inizio = sorgente.IndexOf(firma, StringComparison.Ordinal);
        Assert.True(inizio >= 0, $"«{firma}» non trovata in timone.js: il test va aggiornato");
        int fine = sorgente.IndexOf("\n    }\n", inizio, StringComparison.Ordinal);
        Assert.True(fine > inizio, $"fine di «{firma}» non trovata");
        return sorgente.Substring(inizio, fine - inizio);
    }

    [Fact]
    public void Senza_prodotti_suoi_la_pagina_prende_la_griglia_piu_piccola_che_basta()
    {
        string f = Funzione(Timone(), "function grigliaDiPartenza(");

        // prima si prova a indovinarla dai prodotti nati li', come prima
        int indovina = f.IndexOf("var g = indovinaGriglia(nativi, quante);", StringComparison.Ordinal);
        int ripiego = f.IndexOf("if (!g && quante > 0) g = piuPiccolaCheBasta(quante);", StringComparison.Ordinal);
        Assert.True(indovina >= 0, "la griglia si indovina ancora dai prodotti della pagina");
        Assert.True(ripiego > indovina, "il ripiego viene dopo il tentativo di indovinarla");
        // niente da mettere: niente griglia
        Assert.Contains("if (!g) return;", f.Substring(ripiego));
    }

    [Fact]
    public void La_piu_piccola_che_basta_e_la_prima_delle_ammesse_con_abbastanza_posti()
    {
        string f = Funzione(Timone(), "function piuPiccolaCheBasta(");
        Assert.Contains("(piano.griglieAmmesse || []).filter(function (x) { return x.posti >= quante; })[0] || null", f);
    }

    [Fact]
    public void Le_griglie_ammesse_vanno_dalla_piu_piccola_e_per_una_referenza_e_la_1x3()
    {
        // il browser prende la prima che basta: l'ordine del server e' quello che decide
        var posti = GriglieFormato.Ammesse().Select(g => g.Posti).ToList();
        Assert.Equal(posti.OrderBy(p => p).ToList(), posti);
        Assert.Equal("1x3", GriglieFormato.PiuPiccolaCheBasta(1)?.Nome);
        Assert.Equal("2x3", GriglieFormato.PiuPiccolaCheBasta(4)?.Nome);
    }

    [Fact]
    public void Mandando_una_referenza_in_una_pagina_senza_griglia_la_griglia_si_da_contando_anche_lei()
    {
        string f = Funzione(Timone(), "function spostaInPagina(");

        int indovina = f.IndexOf("grigliaDiPartenza(dest, dentro.filter(", StringComparison.Ordinal);
        int ripiego = f.IndexOf(
            "grigliaDiPartenza(dest, [], dentro.filter(function (x) { return !!x.posizione; }).length + 1);",
            StringComparison.Ordinal);
        int griglia = f.IndexOf("var g = grigliaDi(dest);", StringComparison.Ordinal);
        Assert.True(indovina >= 0 && ripiego > indovina && griglia > ripiego,
            "la griglia della pagina vuota si da' prima di cercare la casella libera");
        Assert.Contains("if (!dest.griglia) {", f);
        // l'avviso dice che la griglia l'ha scelta il timone
        Assert.Contains("non aveva una griglia: ", f);
    }

    [Fact]
    public void Riaprendo_il_timone_la_pagina_con_referenze_arrivate_da_fuori_prende_la_griglia()
    {
        string f = Funzione(Timone(), "function disegna(");
        // «dentro» sono le caselle occupate: con referenze arrivate da altre pagine e nessun
        // prodotto nativo, grigliaDiPartenza ricorre alla piu' piccola che basta
        Assert.Contains("var dentro = tutteInPagina.filter(function (v) { return !!v.posizione; });", f);
        Assert.Contains("grigliaDiPartenza(pagina, nativi, dentro.length);", f);
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
