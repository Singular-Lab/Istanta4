using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1163: nella finestra del prodotto l'elenco Loghi/Bolli (e quello di Aggiungi/rimuovi) era alto
/// al massimo 280px e sotto restava mezza colonna vuota. Ora si prende la prima colonna fino al fondo
/// della finestra, e non scende sotto i 280px. L'altezza la decide il CSS della pagina: qui si
/// controlla il codice della pagina, come in BottoneSalvaTests.
/// </summary>
public class FinestraLoghiTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void L_elenco_dei_loghi_arriva_in_fondo_alla_colonna()
    {
        string html = Editor();

        // la prima colonna e' una pila: ritaglio, linguette, elenco che prende il resto e scorre dentro
        Assert.Contains(".modale .colonna.c1 { display: flex; flex-direction: column; }", html);
        Assert.Contains("#mLoghi { flex: 1 0 280px; overflow-y: auto; }", html);
        Assert.Contains("<div class=\"riquadro_vuoto\" id=\"mLoghi\">", html);
    }

    [Fact]
    public void Niente_tetto_di_280px_e_il_ritaglio_non_si_schiaccia()
    {
        string html = Editor();

        Assert.DoesNotContain("#mLoghi { max-height: 280px;", html);
        // ritaglio 4:3 (I20-1150) e linguette restano della loro misura
        Assert.Contains(".c1 .ritaglio, .c1 .linguette { flex: 0 0 auto; }", html);
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
