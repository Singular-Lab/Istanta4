using AgenziaLib;
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
/// I20-1053: in Edro21 una ref con distintivita' BENESSERE nella sezione SCELTE DI BENESSERE ha la
/// meccanica sdb, ma deve uscire col box normale. La combinazione assegnata resta quella; cambiano
/// la meccanica su cui si decide la grafica (AgenziaLib) e il box scelto da SourceFrameworkCss.
/// </summary>
public class SceltaDiBenessereEdro21Tests : IDisposable
{
    private static Dictionary<string, object> Record(string combinazione, string? distintivita, string? sezione)
    {
        var r = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = "A1",
            ["combinazioneAssegnata"] = combinazione
        };
        if (distintivita != null)
        {
            r["distintivita"] = distintivita;
        }
        if (sezione != null)
        {
            r["sezione"] = sezione;
        }
        return r;
    }

    /* ---- la meccanica grafica (AgenziaLib) ---- */

    [Theory]
    [InlineData("TP_MM_sdb", "BENESSERE", "SCELTE DI BENESSERE", "TP_MM")]
    [InlineData("TP_MM_sdb", "benessere", "Scelte di Benessere", "TP_MM")]
    [InlineData("MM_sdb_KgL", "BENESSERE", "FOCUS SCELTE DI BENESSERE", "MM_KgL")]
    public void Una_ref_benessere_nella_sezione_scelte_di_benessere_perde_sdb_nella_grafica(
        string combinazione, string distintivita, string sezione, string attesa)
    {
        var record = Record(combinazione, distintivita, sezione);

        Assert.True(SceltaDiBenessereEdro21.BoxNormaleInSezioneSdb(record));
        Assert.Equal(attesa, SceltaDiBenessereEdro21.MeccanicaGrafica(record));
        // La combinazione assegnata non si tocca: etichette, revisione e confronti la leggono ancora.
        Assert.Equal(combinazione, record["combinazioneAssegnata"]);
    }

    [Theory]
    [InlineData("TP_MM_sdb", "BENESSERE", "BENESSERE")]
    [InlineData("TP_MM_sdb", "BENESSERE", "FRUTTA E VERDURA")]
    [InlineData("TP_MM_sdb", "TIPICO", "SCELTE DI BENESSERE")]
    [InlineData("TP_MM_sdb", "", "SCELTE DI BENESSERE")]
    [InlineData("TP_MM_sdb", null, "SCELTE DI BENESSERE")]
    [InlineData("TP_MM_sdb", "BENESSERE", null)]
    [InlineData("TP_MM", "BENESSERE", "SCELTE DI BENESSERE")]
    [InlineData("TP_MM_bdp", "BENESSERE", "SCELTE DI BENESSERE")]
    public void Negli_altri_casi_la_grafica_segue_la_combinazione_assegnata(string combinazione, string? distintivita, string? sezione)
    {
        var record = Record(combinazione, distintivita, sezione);

        Assert.False(SceltaDiBenessereEdro21.BoxNormaleInSezioneSdb(record));
        Assert.Equal(combinazione, SceltaDiBenessereEdro21.MeccanicaGrafica(record));
    }

    [Fact]
    public void Un_record_nullo_o_senza_combinazione_non_fa_saltare_nulla()
    {
        Assert.False(SceltaDiBenessereEdro21.BoxNormaleInSezioneSdb(null!));
        Assert.Equal("", SceltaDiBenessereEdro21.MeccanicaGrafica(null!));
        Assert.Equal("", SceltaDiBenessereEdro21.MeccanicaGrafica(new Dictionary<string, object>()));
    }

    /* ---- il box (SourceFrameworkCss di Edro21, valutato da Istanta) ---- */

    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "i20-1053-" + Guid.NewGuid().ToString("N"));

    public SceltaDiBenessereEdro21Tests()
    {
        Directory.CreateDirectory(_cartella);
    }

    public void Dispose()
    {
        Directory.Delete(_cartella, true);
    }

    private sealed class FabbricaSenzaConnessione<T> : IDbContextFactory<T> where T : DbContext
    {
        private readonly Func<T> _crea;
        public FabbricaSenzaConnessione(Func<T> crea) => _crea = crea;
        public T CreateDbContext() => _crea();
    }

    /// Il controller vero, con contesti che non aprono mai una connessione (come in
    /// ModifichePendentiTests) e l'external source in una cartella vuota: il FrameworkCss gli si passa.
    private MenaboController Controller()
    {
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

    private string CodiceBox(string combinazione, string? distintivita, string? sezione)
    {
        // Si rilegge a ogni chiamata: la valutazione riscrive i Value delle regole.
        var frameDB = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json")))
            .ToObject<DbFrameworkCss>();
        var item = new ArticoloInRevisione
        {
            recordInTracciato = Record(combinazione, distintivita, sezione),
            allEtichette = new List<string>()
        };

        return Controller().IdentificaCodiceBox(item, frameDB);
    }

    [Fact]
    public void Il_caso_della_issue_esce_col_box_normale()
    {
        Assert.Equal("BOX1", CodiceBox("TP_MM_sdb", "BENESSERE", "SCELTE DI BENESSERE"));
        Assert.Equal("BOX1", CodiceBox("TP_MM_sdb", "Benessere", "scelte di benessere"));
    }

    [Theory]
    [InlineData("TP_MM_sdb", "BENESSERE", "BENESSERE")]
    [InlineData("TP_MM_sdb", "BENESSERE", "FRUTTA E VERDURA")]
    [InlineData("TP_MM_sdb", "TIPICO", "SCELTE DI BENESSERE")]
    [InlineData("TP_MM_sdb", "", "")]
    [InlineData("TP_MM_bdp", "BENESSERE", "SCELTE DI BENESSERE")]
    public void Gli_altri_sdb_e_i_bdp_restano_BOX12(string combinazione, string distintivita, string sezione)
    {
        Assert.Equal("BOX12", CodiceBox(combinazione, distintivita, sezione));
    }

    [Fact]
    public void Una_combinazione_senza_sdb_ne_bdp_non_cambia()
    {
        Assert.Equal("BOX1", CodiceBox("TP_MM", "BENESSERE", "SCELTE DI BENESSERE"));
    }
}
