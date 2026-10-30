using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1168: nella finestra della propagazione «Conferma selezione» e «Conferma tutti» stanno
/// all'inizio della fascia «Proposte di propagazioni», come nel vecchio, e non sopra la finestra;
/// casella e spunta di conferma sono grandi e affiancate, origine compresa. La finestra la disegna
/// il JavaScript della pagina: qui si controlla il codice della pagina, come in FinestraLoghiTests.
/// </summary>
public class FinestraPropagazioneTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml")).Replace("\r\n", "\n");

    [Fact]
    public void Conferma_selezione_e_Conferma_tutti_nella_fascia_delle_proposte()
    {
        string html = Editor();

        Assert.Contains("'<button type=\"button\" class=\"cat_bott nascosto\" id=\"catSel\">Conferma selezione</button>' +\n" +
                        "               '<button type=\"button\" class=\"cat_bott nascosto\" id=\"catTutti\">Attiva su tutti</button>' +\n" +
                        "               'Proposte di propagazioni:</div>';", html);
        // tutte e tre le fasce (in costruzione, vuota, con le righe) passano dalla stessa funzione
        Assert.DoesNotContain("'<div class=\"cat_barra\">Proposte di propagazioni:</div>'", html);
        Assert.Equal(3, Conta(html, "html += barraProposte() +"));
    }

    [Fact]
    public void Sopra_la_finestra_restano_solo_ELIMINA_e_CHIUDI()
    {
        string html = Editor();
        int menu = html.IndexOf("<div class=\"cat_menu\">", StringComparison.Ordinal);
        int fine = html.IndexOf("<div class=\"cat_finestra\" id=\"catFinestra\">", menu, StringComparison.Ordinal);
        string barra = html[menu..fine];

        Assert.DoesNotContain("id=\"catSel\"", barra);
        Assert.DoesNotContain("id=\"catTutti\"", barra);
        Assert.Contains("id=\"catElimina\"", barra);
        Assert.Contains("id=\"catChiudi\"", barra);
        // all'apertura i bottoni non ci sono ancora: non si cercano
        Assert.DoesNotContain("document.getElementById('catSel').classList.add('nascosto');", html);
        Assert.DoesNotContain("document.getElementById('catTutti').classList.add('nascosto');", html);
    }

    [Fact]
    public void Casella_e_spunta_grandi_e_affiancate_anche_nell_origine()
    {
        string html = Editor();

        Assert.Contains("azione = '<div class=\"cat_azione_orig\"><input type=\"checkbox\" class=\"cat_sel\" id=\"catSelPilota\" title=\"seleziona\">' +\n" +
                        "                     spuntaConferma('confpilota', c.id, 'Conferma la correzione di partenza', 'grande') + '</div>';", html);
        Assert.Contains("spuntaConferma('conf', r.id, 'Conferma l\\'attuazione', 'grande');", html);
        Assert.Contains(".cat_conferma.grande { width: 52px; height: 52px; margin: 0 0 0 6px; }", html);
        Assert.Contains(".cat_sel { width: 22px; height: 22px; vertical-align: middle; margin: 0; }", html);
        // la scritta «seleziona» sotto la spunta dell'origine non c'e' piu'
        Assert.DoesNotContain("id=\"catSelPilota\"> seleziona</label>", html);
    }

    private static int Conta(string testo, string cosa)
    {
        int n = 0;
        for (int i = testo.IndexOf(cosa, StringComparison.Ordinal); i >= 0; i = testo.IndexOf(cosa, i + cosa.Length, StringComparison.Ordinal))
            n++;
        return n;
    }

    // Come IndirizziNelleVisteTests: la cartella del progetto risalendo da quella dei test.
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
