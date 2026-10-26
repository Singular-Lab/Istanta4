using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-852df159: su Linux la versione di AgenziaLib sotto il login usciva vuota. La dll veniva
/// cercata in AppContext.BaseDirectory/wwwroot/external_lib, mentre l'installazione la monta in
/// pathLib (/app/external_lib/). Ora si legge da pathLib, con le fonti della versione in catena,
/// e quando non c'e' niente da mostrare compare "n/a".
/// </summary>
public class VersioneAgenziaLibTests : IDisposable
{
    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "VersioneAgenziaLib_" + Guid.NewGuid().ToString("N"));

    public VersioneAgenziaLibTests()
    {
        Directory.CreateDirectory(_cartella);
    }

    public void Dispose()
    {
        try { Directory.Delete(_cartella, true); } catch { }
    }

    [Fact]
    public void La_dll_si_cerca_nella_cartella_pathLib_configurata()
    {
        string pathLib = _cartella + Path.DirectorySeparatorChar;

        Assert.Equal(Path.Combine(_cartella, "AgenziaLib.dll"), VersioneAgenziaLib.PercorsoDll(pathLib));
    }

    [Fact]
    public void Senza_pathLib_si_cerca_in_wwwroot_external_lib_dell_applicazione()
    {
        Assert.Equal(
            Path.Combine(AppContext.BaseDirectory, "wwwroot", "external_lib", "AgenziaLib.dll"),
            VersioneAgenziaLib.PercorsoDll(""));
    }

    [Fact]
    public void La_dll_in_pathLib_restituisce_una_versione()
    {
        // La dll committata, copiata in una cartella che non e' wwwroot/external_lib: e' il caso
        // dell'installazione Linux con pathLib=/app/external_lib/.
        File.Copy(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_lib/AgenziaLib.dll"), Path.Combine(_cartella, "AgenziaLib.dll"));

        string versione = VersioneAgenziaLib.Leggi(VersioneAgenziaLib.PercorsoDll(_cartella + Path.DirectorySeparatorChar));

        Assert.False(string.IsNullOrWhiteSpace(versione));
        Assert.NotEqual(VersioneAgenziaLib.NonDisponibile, versione);
        Assert.DoesNotContain("+", versione);
        Assert.Matches(@"^\d+(\.\d+)*", versione);
    }

    [Fact]
    public void Senza_dll_la_versione_e_n_a()
    {
        Assert.Equal("n/a", VersioneAgenziaLib.Leggi(Path.Combine(_cartella, "AgenziaLib.dll")));
        Assert.Equal("n/a", VersioneAgenziaLib.Leggi(""));
    }

    [Fact]
    public void Un_file_che_non_e_una_dll_da_n_a()
    {
        string finta = Path.Combine(_cartella, "AgenziaLib.dll");
        File.WriteAllText(finta, "non sono una dll");

        Assert.Equal("n/a", VersioneAgenziaLib.Leggi(finta));
    }
}
