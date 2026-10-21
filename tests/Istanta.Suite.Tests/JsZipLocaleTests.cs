using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-6c531031: la pagina SyncFoto caricava JSZip da cdnjs. Ora il file sta in
/// Istanta/wwwroot/lib/jszip/dist/, versionato in git e pubblicato con wwwroot, e la view lo
/// prende da li'. L'integrity della view resta quella del file di cdnjs: se il file locale
/// cambiasse senza aggiornarla, il browser lo rifiuterebbe e lo zip delle foto non partirebbe.
/// </summary>
public class JsZipLocaleTests
{
    private const string PercorsoView = "Istanta/Views/SyncFoto/Index.cshtml";
    private const string PercorsoFile = "Istanta/wwwroot/lib/jszip/dist/jszip.min.js";

    [Fact]
    public void La_view_carica_jszip_in_locale_e_non_dal_cdn()
    {
        string view = File.ReadAllText(DllAgenziaLibTests.TrovaFile(PercorsoView));

        Assert.Contains("src=\"~/lib/jszip/dist/jszip.min.js\"", view);
        Assert.DoesNotMatch(@"https?://[^""]*jszip", view);
    }

    [Fact]
    public void Il_file_locale_corrisponde_all_integrity_della_view()
    {
        string view = File.ReadAllText(DllAgenziaLibTests.TrovaFile(PercorsoView));
        var integrity = Regex.Match(view, @"jszip\.min\.js""\s+integrity=""sha512-([^""]+)""");
        Assert.True(integrity.Success, "La view deve dichiarare l'integrity sha512 di jszip.min.js");

        byte[] contenuto = File.ReadAllBytes(DllAgenziaLibTests.TrovaFile(PercorsoFile));

        Assert.Contains("JSZip v3.10.1", System.Text.Encoding.UTF8.GetString(contenuto, 0, 200));
        Assert.Equal(integrity.Groups[1].Value, Convert.ToBase64String(SHA512.HashData(contenuto)));
    }

    [Fact]
    public void Libman_dichiara_jszip_nella_cartella_locale()
    {
        string libman = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/libman.json"));

        Assert.Contains("\"jszip@3.10.1\"", libman);
        Assert.Contains("\"wwwroot/lib/jszip/dist/\"", libman);
    }
}
