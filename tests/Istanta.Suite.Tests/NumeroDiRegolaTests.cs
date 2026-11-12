using System.Globalization;
using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-13e871a5: le confezioni di frutta secca Edro21 da 100-500 g uscivano con il prezzo al kg in
/// grande (ofalkg), che vuole l'etichetta PESO>1 ("Descrizioni.Peso > 1 e reparto 33"). Le regole
/// delle etichette leggevano i numeri con double.TryParse nella cultura corrente, e le esportazioni di
/// AgenziaLib lasciano it-IT sul thread: il peso "0.25" valeva 25. Ora i numeri delle regole si
/// leggono con NumeroDiRegola, uguali in ogni cultura.
/// </summary>
public class NumeroDiRegolaTests : IDisposable
{
    private readonly CultureInfo _culturaDiPrima = CultureInfo.CurrentCulture;

    public void Dispose()
    {
        CultureInfo.CurrentCulture = _culturaDiPrima;
        if (Directory.Exists(_cartella))
        {
            Directory.Delete(_cartella, true);
        }
    }

    public static IEnumerable<object[]> Culture() => new[] { new object[] { "it-IT" }, new object[] { "en-GB" } };

    /* ---- la lettura ---- */

    [Theory]
    [MemberData(nameof(Culture))]
    public void Punto_e_virgola_sono_il_separatore_decimale(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        foreach (var valore in new object[] { "0.25", "0,25", " 0.25 ", 0.25, 0.25m, 0.25f, new JValue(0.25), new JValue("0.25"), JToken.Parse("{\"p\":0.25}")["p"]! })
        {
            Assert.True(NumeroDiRegola.TryLeggi(valore, out double numero), valore.ToString());
            Assert.Equal(0.25, numero, 6);
        }
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void I_valori_della_segnalazione(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        Assert.True(NumeroDiRegola.TryLeggi("0.1", out double cento));
        Assert.Equal(0.1, cento, 6);
        Assert.True(NumeroDiRegola.TryLeggi("1.5", out double chiloEMezzo));
        Assert.Equal(1.5, chiloEMezzo, 6);
        Assert.True(NumeroDiRegola.TryLeggi("33", out double reparto));
        Assert.Equal(33, reparto);
        Assert.True(NumeroDiRegola.TryLeggi(33, out double repartoIntero));
        Assert.Equal(33, repartoIntero);
    }

    [Theory]
    [InlineData("1.234,5")]
    [InlineData("1,234.5")]
    public void Con_tutti_e_due_i_separatori_l_ultimo_e_il_decimale(string testo)
    {
        Assert.True(NumeroDiRegola.TryLeggi(testo, out double numero));
        Assert.Equal(1234.5, numero, 6);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("ORTOFRUTTA")]
    [InlineData("1.2.3")]
    public void Vuoto_o_testo_non_sono_numeri(string? valore)
    {
        Assert.False(NumeroDiRegola.TryLeggi(valore, out _));
    }

    [Fact]
    public void Un_booleano_o_un_NaN_non_sono_numeri()
    {
        Assert.False(NumeroDiRegola.TryLeggi(true, out _));
        Assert.False(NumeroDiRegola.TryLeggi(double.NaN, out _));
        Assert.False(NumeroDiRegola.TryLeggiDecimale(double.NaN, out _));
        Assert.False(NumeroDiRegola.TryLeggiDecimale(double.PositiveInfinity, out _));
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void I_decimali_dei_prezzi_e_dei_pesi(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        foreach (var valore in new object[] { "2,87", "2.87", 2.87m, 2.87, new JValue("2,87") })
        {
            Assert.True(NumeroDiRegola.TryLeggiDecimale(valore, out decimal prezzo), valore.ToString());
            Assert.Equal(2.87m, prezzo);
        }
        Assert.Equal(1234.5m, NumeroDiRegola.ComeDecimale("1.234,5"));
        Assert.Equal(0.25m, NumeroDiRegola.ComeDecimale("0.25"));
        Assert.Equal(0.25, NumeroDiRegola.ComeDouble("0,25"), 6);
        Assert.Equal(12.5m, NumeroDiRegola.ComeDecimale(12.5));
    }

    [Fact]
    public void Le_conversioni_dirette_lanciano_come_prima_su_un_testo_non_numerico()
    {
        //Al posto di Parse e Convert: un valore che non e' un numero continua a dare errore.
        Assert.Throws<FormatException>(() => NumeroDiRegola.ComeDouble("ORTOFRUTTA"));
        Assert.Throws<FormatException>(() => NumeroDiRegola.ComeDecimale("ORTOFRUTTA"));
        Assert.Equal(0m, NumeroDiRegola.ComeDecimale(null));
    }

    /* ---- l'etichettatura vera, con le regole di Edro21 ---- */

    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "task-13e871a5-" + Guid.NewGuid().ToString("N"));

    private sealed class FabbricaSenzaConnessione<T> : IDbContextFactory<T> where T : DbContext
    {
        private readonly Func<T> _crea;
        public FabbricaSenzaConnessione(Func<T> crea) => _crea = crea;
        public T CreateDbContext() => _crea();
    }

    /// Il controller vero, con contesti che non aprono mai una connessione e l'external source in una
    /// cartella temporanea con le etichette di Edro21 (come SceltaDiBenessereEdro21Tests).
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

    private static ArticoloInRevisione Referenza(object peso) => new ArticoloInRevisione
    {
        recordInTracciato = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = "6841566",
            ["reparto"] = "33",
            ["Descrizioni.Peso"] = peso,
            ["unita_fatt"] = "Pezzo"
        },
        allEtichette = new List<string>(),
        etichetteVisual = new List<string>()
    };

    /// Le etichette che le due Etichettatura (per lista e per singolo record) danno alla referenza.
    private List<List<string>> Etichette(object peso)
    {
        var controller = Controller();
        var perLista = controller.Etichettatura(new List<ArticoloInRevisione> { Referenza(peso) }).Single().allEtichette;
        var perRecord = controller.Etichettatura(Referenza(peso)).allEtichette;
        return new List<List<string>> { perLista, perRecord };
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void Una_confezione_da_250_g_non_ha_PESO_maggiore_di_1(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        foreach (var peso in new object[] { "0.25", "0,25", 0.25, "0.1", 0.1 })
        {
            foreach (var etichette in Etichette(peso))
            {
                Assert.Contains("REPARTO33", etichette);
                Assert.DoesNotContain("PESO>1", etichette);
            }
        }
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void Sopra_il_chilo_PESO_maggiore_di_1_resta(string cultura)
    {
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        foreach (var peso in new object[] { "1.5", "1,5", 1.5 })
        {
            foreach (var etichette in Etichette(peso))
            {
                Assert.Contains("PESO>1", etichette);
            }
        }
    }

    [Theory]
    [MemberData(nameof(Culture))]
    public void La_regola_scritta_con_la_virgola_vale_in_ogni_cultura(string cultura)
    {
        //"PESO TOTALE 0,5": Descrizioni.Peso == "0,5".
        CultureInfo.CurrentCulture = new CultureInfo(cultura);

        foreach (var peso in new object[] { 0.5, "0.5", "0,5" })
        {
            foreach (var etichette in Etichette(peso))
            {
                Assert.Contains("PESO TOTALE 0,5", etichette);
            }
        }
    }

    [Fact]
    public void Le_due_Etichettatura_non_leggono_piu_i_numeri_nella_cultura_corrente()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/MenaboController.cs")).Replace("\r", "");
        int perLista = sorgente.IndexOf("public List<ArticoloInRevisione> Etichettatura(List<ArticoloInRevisione> records)", StringComparison.Ordinal);
        int fine = sorgente.IndexOf("bool getPercorso(ArticoloInRevisione record, string campo, out object percorso)", StringComparison.Ordinal);
        Assert.True(perLista > 0 && fine > perLista);
        var etichettatura = sorgente.Substring(perLista, fine - perLista);

        Assert.DoesNotContain("double.TryParse(", etichettatura);
        Assert.Contains("NumeroDiRegola.TryLeggi(percorso, out", etichettatura);
        Assert.Contains("NumeroDiRegola.TryLeggi(regola.Value, out", etichettatura);
    }
}
