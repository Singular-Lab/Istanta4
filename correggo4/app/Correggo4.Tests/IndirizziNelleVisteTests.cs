using System.Text.RegularExpressions;
using Xunit;

namespace Correggo4.Tests;

/// <summary>
/// Guardia contro il ritorno degli indirizzi scritti dalla radice ("/Volantini", fetch('/Correzioni/...')):
/// funzionano su localhost e si rompono appena Correggo4 sta in una cartella. Nelle viste si scrive
/// "~/..." o Url.Content("~/..."), nel JavaScript C4_BASE + 'Percorso/...'.
/// </summary>
public class IndirizziNelleVisteTests
{
    // Attributi HTML che puntano alla radice del dominio invece che a quella dell'applicazione.
    private static readonly Regex AttributoDallaRadice =
        new(@"\b(href|src|action)=""/(?!/)", RegexOptions.Compiled);

    // Stringhe JavaScript che iniziano un percorso dell'applicazione dalla radice. Si guardano solo
    // quelle in testa all'espressione: '/Accetta' dopo un "+" e' un pezzo di percorso, non l'inizio.
    private static readonly Regex StringaDallaRadice = new(
        @"(?<!\+\s*)(['""`])/(Account|Correzioni|Foto|Home|Ingestione|Legenda|Notifiche|Promo|Storico|Timone|TimonePdf|Volantini|volantini|immagini-correggo|guide|js|css|lib|cliente)(?=[/'""`?])",
        RegexOptions.Compiled);

    public static TheoryData<string> FileDaControllare()
    {
        var dati = new TheoryData<string>();
        string radice = RadiceApplicazione();
        foreach (string f in Directory.EnumerateFiles(Path.Combine(radice, "Views"), "*.cshtml", SearchOption.AllDirectories))
            dati.Add(Path.GetRelativePath(radice, f));
        foreach (string f in Directory.EnumerateFiles(Path.Combine(radice, "wwwroot", "js"), "*.js", SearchOption.AllDirectories))
            dati.Add(Path.GetRelativePath(radice, f));
        return dati;
    }

    [Theory]
    [MemberData(nameof(FileDaControllare))]
    public void Nessun_indirizzo_dalla_radice(string file)
    {
        string[] righe = System.IO.File.ReadAllLines(Path.Combine(RadiceApplicazione(), file));
        var trovati = new List<string>();
        for (int i = 0; i < righe.Length; i++)
        {
            if (file.EndsWith(".cshtml", StringComparison.Ordinal) && AttributoDallaRadice.IsMatch(righe[i]))
                trovati.Add($"{file}:{i + 1}: {righe[i].Trim()}");
            if (StringaDallaRadice.IsMatch(righe[i]))
                trovati.Add($"{file}:{i + 1}: {righe[i].Trim()}");
        }
        Assert.True(trovati.Count == 0, "Indirizzi scritti dalla radice:\n" + string.Join("\n", trovati));
    }

    [Fact]
    public void La_guardia_riconosce_gli_indirizzi_dalla_radice()
    {
        Assert.Matches(AttributoDallaRadice, "<a href=\"/Volantini\">");
        Assert.Matches(StringaDallaRadice, "fetch('/Correzioni/Commenti/' + id)");
        Assert.Matches(StringaDallaRadice, "onclick=\"location.href='/Volantini'\"");
        Assert.DoesNotMatch(AttributoDallaRadice, "<a href=\"~/Volantini\">");
        Assert.DoesNotMatch(StringaDallaRadice, "fetch(C4_BASE + 'Correzioni/Commenti/' + id)");
        Assert.DoesNotMatch(StringaDallaRadice, "C4_BASE + 'Correzioni/Edit/' + id + '/Foto/' + codice");
    }

    /// <summary>La cartella del progetto Correggo4, risalendo da quella dei test compilati.</summary>
    private static string RadiceApplicazione()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent)
        {
            string candidata = Path.Combine(d.FullName, "Correggo4");
            if (System.IO.File.Exists(Path.Combine(candidata, "Correggo4.csproj")))
                return candidata;
        }
        throw new DirectoryNotFoundException("Cartella del progetto Correggo4 non trovata sopra " + AppContext.BaseDirectory);
    }
}
