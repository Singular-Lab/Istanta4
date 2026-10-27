using System.Text.RegularExpressions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// I20-1150: nell'Edit avanzato il ritaglio del prodotto era verticale 3:4, largo quanto la prima
/// colonna, e sugli schermi larghi schiacciava in fondo l'elenco Loghi/Bolli. Ora e' orizzontale
/// 4:3 come nel Correggo vecchio. Il prodotto lo inquadra ritaglia(), che legge la misura del
/// riquadro: se smettesse di farlo, il prodotto uscirebbe dal riquadro piu' basso.
/// </summary>
public class RitaglioEditAvanzatoTests
{
    private static string Editor() =>
        File.ReadAllText(Path.Combine(RadiceApplicazione(), "Views", "Volantini", "Dettaglio.cshtml"));

    [Fact]
    public void Il_ritaglio_del_prodotto_e_orizzontale_4_3()
    {
        var regola = Regex.Match(Editor(), @"^\s*\.ritaglio \{[^}]*\}", RegexOptions.Multiline);

        Assert.True(regola.Success, "regola .ritaglio non trovata");
        Assert.Contains("aspect-ratio: 4/3;", regola.Value);
        Assert.DoesNotContain("aspect-ratio: 3/4", regola.Value);
    }

    [Fact]
    public void Il_prodotto_si_inquadra_sulla_misura_del_riquadro()
    {
        string html = Editor();

        Assert.Contains("var lc = cont.clientWidth, hc = cont.clientHeight;", html);
        Assert.Contains("var s = Math.min(lc / b.pw, hc / b.ph);", html);
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
