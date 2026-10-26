using System.Text.RegularExpressions;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le librerie client di Correggo4 devono stare nel repository, non solo sul disco di chi
/// le ha scaricate una volta.
///
/// Il .gitignore esclude tutti i dist/ perche' di solito sono output di build. L'eccezione che
/// riammette wwwroot/lib/<pacchetto>/dist/ esisteva gia', ma era ancorata a Istanta/: Correggo4
/// non era coperto e le sue cinque librerie non sono mai entrate in git. Chi clonava otteneva
/// un'applicazione che si avvia, risponde e compila - quindi nessuna build se ne accorge - ma
/// serve pagine senza stile e senza validazione client.
///
/// Il test non elenca i file attesi: legge le view e verifica che ogni ~/lib referenziato esista
/// davvero. Cosi' copre anche la libreria che qualcuno aggiungera' domani, e su una clone pulita
/// fallisce esattamente nel caso che vogliamo impedire.
/// </summary>
public class LibrerieClientCorreggo4Tests
{
    private const string CartellaView = "correggo4/app/Correggo4/Views";
    private const string CartellaWwwroot = "correggo4/app/Correggo4/wwwroot";

    // src="~/lib/..." oppure href="~/lib/...": le view usano il tilde di ASP.NET, che a runtime
    // diventa la radice di wwwroot.
    private static readonly Regex RiferimentoLib =
        new(@"(?:src|href)\s*=\s*""~/(lib/[^""]+)""", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [Fact]
    public void Ogni_libreria_client_referenziata_dalle_view_esiste_nel_repository()
    {
        var radice = TrovaRadiceRepository();
        var mancanti = new List<string>();

        foreach (var riferimento in RaccogliRiferimenti(radice))
        {
            var percorso = Path.Combine(
                radice,
                CartellaWwwroot.Replace('/', Path.DirectorySeparatorChar),
                riferimento.Replace('/', Path.DirectorySeparatorChar));

            if (!File.Exists(percorso))
            {
                mancanti.Add(riferimento);
            }
        }

        Assert.True(mancanti.Count == 0,
            "Librerie referenziate dalle view di Correggo4 ma assenti dal repository: "
            + string.Join(", ", mancanti)
            + ". Controlla che il .gitignore non stia escludendo wwwroot/lib/<pacchetto>/dist/.");
    }

    [Fact]
    public void Le_view_referenziano_davvero_le_librerie_attese()
    {
        // Senza questa verifica il test qui sopra passerebbe anche se la regex smettesse di
        // trovare qualcosa - per esempio perche' una view cambia il modo di scrivere il percorso.
        // Un controllo che non controlla niente e' peggio di nessun controllo.
        var riferimenti = RaccogliRiferimenti(TrovaRadiceRepository());

        Assert.Contains("lib/bootstrap/dist/css/bootstrap.min.css", riferimenti);
        Assert.Contains("lib/bootstrap/dist/js/bootstrap.bundle.min.js", riferimenti);
        Assert.Contains("lib/jquery/dist/jquery.min.js", riferimenti);
        Assert.Contains("lib/jquery-validation/dist/jquery.validate.min.js", riferimenti);
        Assert.Contains("lib/jquery-validation-unobtrusive/dist/jquery.validate.unobtrusive.min.js", riferimenti);
    }

    private static HashSet<string> RaccogliRiferimenti(string radice)
    {
        var cartella = Path.Combine(radice, CartellaView.Replace('/', Path.DirectorySeparatorChar));
        var riferimenti = new HashSet<string>(StringComparer.Ordinal);

        foreach (var view in Directory.EnumerateFiles(cartella, "*.cshtml", SearchOption.AllDirectories))
        {
            foreach (Match match in RiferimentoLib.Matches(File.ReadAllText(view)))
            {
                riferimenti.Add(match.Groups[1].Value);
            }
        }

        return riferimenti;
    }

    private static string TrovaRadiceRepository()
    {
        // Stesso modo degli altri test della suite: si risale dalla cartella di esecuzione
        // finche' non si riconosce la radice, cosi' il percorso non dipende dal profilo di build.
        const string riferimento = "correggo4/app/Correggo4/Views/Shared/_Layout.cshtml";

        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, riferimento.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return cartella.FullName;
            }
            cartella = cartella.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Radice del repository non trovata risalendo da {AppContext.BaseDirectory}");
    }
}
