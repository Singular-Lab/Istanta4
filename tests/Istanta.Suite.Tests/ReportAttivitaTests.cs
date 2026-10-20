using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-da81d554: in Docker "Consulta report" rispondeva 404. Il Report.json sta in path_to_import
/// (/data/imported_files/), mentre promo.js lo chiedeva come file statico di wwwroot. Ora lo legge
/// Tracciati/reportAttivita da path_to_import.
/// </summary>
public class ReportAttivitaTests : IDisposable
{
    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "ReportAttivita_" + Guid.NewGuid().ToString("N"));

    public ReportAttivitaTests()
    {
        Directory.CreateDirectory(_cartella);
    }

    public void Dispose()
    {
        try { Directory.Delete(_cartella, true); } catch { }
    }

    [Fact]
    public void Il_percorso_e_nella_cartella_dell_attivita_dentro_path_to_import()
    {
        string pathToImport = _cartella + Path.DirectorySeparatorChar;

        Assert.Equal(Path.Combine(_cartella, "20206", "Report.json"), ReportAttivita.Percorso(pathToImport, 20206));
    }

    [Fact]
    public async Task Il_report_fuori_da_wwwroot_si_legge()
    {
        // Come /data/imported_files/20206/Report.json nel container.
        Directory.CreateDirectory(Path.Combine(_cartella, "20206"));
        await File.WriteAllTextAsync(Path.Combine(_cartella, "20206", "Report.json"), "[{\"AC\":\"1\",\"versione\":1}]");

        string? report = await ReportAttivita.LeggiAsync(_cartella + Path.DirectorySeparatorChar, 20206);

        Assert.Equal("[{\"AC\":\"1\",\"versione\":1}]", report);
    }

    [Fact]
    public async Task Senza_report_restituisce_null()
    {
        Directory.CreateDirectory(Path.Combine(_cartella, "20207"));

        Assert.Null(await ReportAttivita.LeggiAsync(_cartella + Path.DirectorySeparatorChar, 20207));
        Assert.Null(await ReportAttivita.LeggiAsync(_cartella + Path.DirectorySeparatorChar, 99999));
    }

    [Fact]
    public void Promo_js_chiede_il_report_al_controller_e_non_a_wwwroot()
    {
        string js = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/js/promo.js"));

        Assert.DoesNotContain("'imported_files/'", js);
        Assert.Contains("Tracciati/reportAttivita/", js);
    }

    [Fact]
    public void Il_controller_espone_reportAttivita()
    {
        string controller = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/TracciatiController.cs"));

        Assert.Contains("[Route(\"Tracciati/reportAttivita/{idAttivita:int}\")]", controller);
        Assert.Contains("ReportAttivita.LeggiAsync(this.path_to_import, idAttivita)", controller);
    }
}
