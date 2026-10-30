using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1172: «Cambia» sulla scheda della referenza apriva un pannello grande con titolo e griglia.
/// Torna la striscia del Correggo vecchio sopra la finestra del prodotto: miniature in fila col
/// bordo nero, gialla quella in uso, CHIUDI sotto; senza la voce «Nessuno» (scelta dell'utente).
/// Lo disegna la pagina: qui se ne controlla il codice, come in FinestraLoghiTests.
/// </summary>
public class SceltaFotoTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml")).Replace("\r\n", "\n");

    [Fact]
    public void La_scelta_della_foto_e_una_striscia_con_CHIUDI_sotto()
    {
        string html = Editor();

        Assert.Contains("<div class=\"scelta_foto\" id=\"sceltaFoto\">\n    <div class=\"striscia_foto\" id=\"sfGriglia\"></div>\n" +
                        "    <button class=\"bottone\" type=\"button\" id=\"sfChiudi\">CHIUDI</button>", html);
        Assert.Contains(".striscia_foto { display: flex; gap: 18px; overflow-x: auto; max-width: 100%; padding: 2px; }", html);
    }

    /// <summary>Secondo giro: a tutto schermo sul velo nero, e un clic sul velo chiude.</summary>
    [Fact]
    public void A_tutto_schermo_sul_velo_nero_che_chiude_al_clic()
    {
        string html = Editor();

        Assert.Contains(".scelta_foto { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 110; display: none;", html);
        Assert.Contains("background: rgba(0,0,0,.7); }", html);
        Assert.Contains("document.getElementById('sceltaFoto').addEventListener('click', function (ev) {\n" +
                        "        if (ev.target === this) this.classList.remove('visibile');", html);
    }

    [Fact]
    public void Foto_grandi_col_bordo_nero_e_gialla_quella_in_uso()
    {
        string html = Editor();

        Assert.Contains(".voce_foto { flex: 0 0 auto; width: 360px; height: 240px; background: #fff; border: 3px solid #000; cursor: pointer; }", html);
        Assert.Contains(".voce_foto.corrente { border-color: #e6d600; }", html);
    }

    [Fact]
    public void Niente_piu_pannello_con_titolo_e_griglia_ne_voce_Nessuno()
    {
        string html = Editor();

        Assert.DoesNotContain("clicca quella da usare", html);
        Assert.DoesNotContain("id=\"sfTitolo\"", html);
        Assert.DoesNotContain(".griglia_foto", html);
        Assert.DoesNotContain("'<br><b>in uso</b>'", html);
        // niente «Nessuno» nella scelta della foto (c'e' altrove, nel riquadro vuoto dei loghi)
        int inizio = html.IndexOf("function apriSceltaFoto(", StringComparison.Ordinal);
        int fine = html.IndexOf("document.getElementById('sfChiudi')", inizio, StringComparison.Ordinal);
        Assert.True(inizio >= 0 && fine > inizio);
        Assert.DoesNotContain("Nessuno", html[inizio..fine]);
        int markup = html.IndexOf("<div class=\"scelta_foto\" id=\"sceltaFoto\">", StringComparison.Ordinal);
        Assert.DoesNotContain("Nessuno", html.Substring(markup, html.IndexOf("</div>\n</div>", markup, StringComparison.Ordinal) - markup));
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
