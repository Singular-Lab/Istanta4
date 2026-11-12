using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1226: l'etichetta SF (GA) di Edro21, scorciatoia per le referenze di salumi e formaggi della
/// vendita assistita: i settori 2501 e 2503. Sta nel gruppo Default delle etichette (Raccolta vuota) e
/// serve a filtrare nel Plugin con il criterio "Etichette Ref", che elenca etichetteVisual: per questo ha
/// il testo visibile SF (GA). La regola sta in Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json
/// e la valuta l'etichettatura vera del MenaboController, per lista e per singolo record.
/// </summary>
public class EtichettaSfGaEdro21Tests : IDisposable
{
    private const string Etichetta = "SF (GA)";

    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "i20-1226-" + Guid.NewGuid().ToString("N"));

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
    /// cartella temporanea con le etichette di Edro21 (come NumeroDiRegolaTests).
    private MenaboController Controller()
    {
        Directory.CreateDirectory(_cartella);
        File.Copy(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json"),
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

    private static ArticoloInRevisione Referenza(string settore) => new ArticoloInRevisione
    {
        recordInTracciato = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = "1234567",
            ["reparto"] = settore.Length >= 2 ? settore.Substring(0, 2) : "",
            ["settore"] = settore
        },
        allEtichette = new List<string>(),
        etichetteVisual = new List<string>()
    };

    /// Le etichette che le due Etichettatura (per lista e per singolo record) danno alla referenza:
    /// tutte (allEtichette) e quelle visibili (etichetteVisual, i valori del criterio Etichette Ref).
    private List<List<string>> Etichette(string settore)
    {
        var controller = Controller();
        var perLista = controller.Etichettatura(new List<ArticoloInRevisione> { Referenza(settore) }).Single();
        var perRecord = controller.Etichettatura(Referenza(settore));
        return new List<List<string>> { perLista.allEtichette, perRecord.allEtichette, perLista.etichetteVisual, perRecord.etichetteVisual };
    }

    [Theory]
    [InlineData("2501")]
    [InlineData("2503")]
    public void I_settori_2501_e_2503_hanno_SF_GA(string settore)
    {
        foreach (var etichette in Etichette(settore))
        {
            Assert.Contains(Etichetta, etichette);
        }
    }

    [Theory]
    [InlineData("2502")]
    [InlineData("2401")]
    [InlineData("3309")]
    [InlineData("")]
    public void Gli_altri_settori_non_hanno_SF_GA(string settore)
    {
        foreach (var etichette in Etichette(settore))
        {
            Assert.DoesNotContain(Etichetta, etichette);
        }
    }

    [Fact]
    public void SF_GA_sta_nel_gruppo_Default_con_il_testo_visibile_per_il_filtro()
    {
        var json = Newtonsoft.Json.Linq.JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceEtichetteRef.json")));
        var voci = json["source"]!.Where(e => (string?)e["Etichetta"] == Etichetta).ToList();

        var voce = Assert.Single(voci);
        Assert.Equal("", (string?)voce["Raccolta"]);
        //Senza testo visibile non entrerebbe in etichetteVisual, e il filtro Etichette Ref non la offrirebbe.
        Assert.Equal(Etichetta, (string?)voce["Visual"]);
        //Un Id nuovo, che nessun'altra etichetta usa.
        Assert.Single(json["source"]!.Where(e => (int)e["Id"]! == (int)voce["Id"]!));
    }
}
