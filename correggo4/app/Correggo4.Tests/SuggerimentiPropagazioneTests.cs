using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1176: l'occhietto «Mostra o nascondi i suggerimenti» cambiava solo icona. Come nel Correggo
/// vecchio, spento nasconde le note e i timbri propagati da un altro volantino che sono ancora solo
/// proposte (suggerimento = true, sbiaditi); le altre correzioni non dipendono da lui. Lo disegna la
/// pagina: qui se ne controlla il codice, come in FinestraLoghiTests.
/// </summary>
public class SuggerimentiPropagazioneTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml")).Replace("\r\n", "\n");

    [Fact]
    public void L_occhietto_accende_e_spegne_i_suggerimenti_e_ridisegna()
    {
        string html = Editor();

        Assert.Contains("collegaInterruttore('tSugg', function (visibile) { vedi.suggerimenti = visibile; disegna(); });", html);
        Assert.DoesNotContain("i suggerimenti non sono ancora portati", html);
        // all'apertura e' acceso
        Assert.Contains("category: true, ea: true, suggerimenti: true };", html);
    }

    [Fact]
    public void Spento_salta_solo_le_propagazioni_suggerite()
    {
        string html = Editor();
        int inizio = html.IndexOf("(stato.propagate || []).forEach(function (r) {", StringComparison.Ordinal);
        Assert.True(inizio >= 0);
        string ciclo = html.Substring(inizio, 600);

        Assert.Contains("if (r.suggerimento && !vedi.suggerimenti) return;", ciclo);
        // le note e i timbri del volantino non guardano l'occhietto
        Assert.Equal(1, html.Split("vedi.suggerimenti").Length - 2);
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
