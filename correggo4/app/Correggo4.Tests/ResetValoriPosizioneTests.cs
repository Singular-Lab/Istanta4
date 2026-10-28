using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1155: nella finestra del prodotto RESET VALORI sta come nel Correggo vecchio, a cavallo della
/// linea sotto la testata e centrato sopra la colonna dei prezzi, non in una riga sua. La posizione
/// la decide il browser: qui si controlla il codice della pagina.
/// </summary>
public class ResetValoriPosizioneTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void Il_bottone_sta_nella_testata_e_non_in_una_riga_sua()
    {
        string html = Editor();

        int testa = html.IndexOf("<div class=\"modale\" id=\"modale\">", StringComparison.Ordinal);
        int colonne = html.IndexOf("<div class=\"colonne\">", testa, StringComparison.Ordinal);
        Assert.True(testa > 0 && colonne > testa, "finestra del prodotto non trovata");
        string intestazione = html[testa..colonne];

        // il bottone si chiude dentro la testata: dopo di lui c'e' la chiusura della testata, poi le colonne
        int reset = intestazione.IndexOf("id=\"mReset\"", StringComparison.Ordinal);
        int chiudi = intestazione.IndexOf("id=\"mChiudi\"", StringComparison.Ordinal);
        Assert.True(chiudi > 0 && reset > chiudi, "RESET VALORI deve stare nella testata, dopo CHIUDI");
        Assert.Matches(@"id=""mReset"">RESET VALORI</button></div>\s*</div>\s*$", intestazione);
    }

    [Fact]
    public void Il_bottone_e_centrato_sopra_la_colonna_dei_prezzi_a_cavallo_della_linea()
    {
        string html = Editor();

        Assert.Contains(".modale .reset_valori { position: absolute; left: 50%; width: 26%; bottom: 0; transform: translateY(50%);", html);
        Assert.Contains(".c3 { width: 26%; }", html);
        Assert.DoesNotContain(".modale .reset_valori { text-align: center; padding: 4px 0; }", html);
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
