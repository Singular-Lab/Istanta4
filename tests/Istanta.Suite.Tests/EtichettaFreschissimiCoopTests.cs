using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-86ea303e: l'etichetta FRESCHISSIMI di Coop. Le referenze del settore 58, tranne il reparto
/// 01, e quelle del settore 56 nei reparti 03 e 04. La regola sta in
/// Istanta/wwwroot/external_source/Coopfi/SourceEtichetteRef.json e la valuta l'etichettatura vera
/// del MenaboController, per lista e per singolo record.
/// </summary>
public class EtichettaFreschissimiCoopTests : IDisposable
{
    private const string Etichetta = "FRESCHISSIMI";

    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "task-86ea303e-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_cartella))
        {
            Directory.Delete(_cartella, true);
        }
    }

    private sealed class FabbricaSenzaConnessione<T> : IDbContextFactory<T> where T : DbContext
    {
        private readonly Func<T> _crea;
        public FabbricaSenzaConnessione(Func<T> crea) => _crea = crea;
        public T CreateDbContext() => _crea();
    }

    /// Il controller vero, con contesti che non aprono mai una connessione e l'external source in una
    /// cartella temporanea con le etichette di Coop (come NumeroDiRegolaTests per Edro21).
    private MenaboController Controller()
    {
        Directory.CreateDirectory(_cartella);
        File.Copy(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourceEtichetteRef.json"),
            Path.Combine(_cartella, "SourceEtichetteRef.json"), true);
        return new MenaboController(
            null,
            new ConfigurationBuilder().Build(),
            Options.Create(new PathExternal { pathSource = _cartella + Path.DirectorySeparatorChar, pathLib = _cartella + Path.DirectorySeparatorChar }),
            null,
            null,
            null,
            null,
            Options.Create(new FicoConfig()),
            new FabbricaSenzaConnessione<edro21_dbContext>(() => new edro21_dbContext(
                new DbContextOptionsBuilder<edro21_dbContext>().UseNpgsql("Host=localhost;Database=nessuno").Options)),
            new FabbricaSenzaConnessione<Edro21_DbContext2>(() => new Edro21_DbContext2(
                new DbContextOptionsBuilder<Edro21_DbContext2>().UseNpgsql("Host=localhost;Database=nessuno").Options)));
    }

    private static ArticoloInRevisione Referenza(string settore, string reparto) => new ArticoloInRevisione
    {
        recordInTracciato = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = "1234567",
            ["codice_settore"] = settore,
            ["codice_reparto"] = reparto,
            ["tema"] = "",
            ["tipo_evento"] = "",
            ["meccanica"] = "",
            ["is_linea"] = ""
        },
        allEtichette = new List<string>(),
        etichetteVisual = new List<string>()
    };

    /// Le etichette che le due Etichettatura (per lista e per singolo record) danno alla referenza.
    private List<List<string>> Etichette(string settore, string reparto)
    {
        var controller = Controller();
        var perLista = controller.Etichettatura(new List<ArticoloInRevisione> { Referenza(settore, reparto) }).Single().allEtichette;
        var perRecord = controller.Etichettatura(Referenza(settore, reparto)).allEtichette;
        return new List<List<string>> { perLista, perRecord };
    }

    [Theory]
    [InlineData("58", "02")]
    [InlineData("58", "08")]
    [InlineData("58", "12")]
    [InlineData("56", "03")]
    [InlineData("56", "04")]
    //I codici valgono come numeri: il reparto scritto senza lo zero e' lo stesso reparto.
    [InlineData("56", "3")]
    [InlineData("58", "2")]
    public void Il_settore_58_fuori_dal_reparto_01_e_il_56_nei_reparti_03_e_04_sono_freschissimi(string settore, string reparto)
    {
        foreach (var etichette in Etichette(settore, reparto))
        {
            Assert.Contains(Etichetta, etichette);
        }
    }

    [Theory]
    [InlineData("58", "01")]
    [InlineData("58", "1")]
    [InlineData("56", "01")]
    [InlineData("56", "02")]
    [InlineData("56", "05")]
    [InlineData("57", "03")]
    [InlineData("62", "04")]
    public void Le_altre_referenze_non_sono_freschissime(string settore, string reparto)
    {
        foreach (var etichette in Etichette(settore, reparto))
        {
            Assert.DoesNotContain(Etichetta, etichette);
        }
    }
}
