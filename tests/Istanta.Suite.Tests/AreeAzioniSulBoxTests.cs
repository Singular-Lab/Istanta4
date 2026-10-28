using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1157: un'azione sul box puo' valere solo in alcune aree della lavorazione.
///
/// Nel SourceCustomPlugin.json di un'agenzia ogni azione di cambiStrutturali puo' dichiarare, con
/// Aree, le sigle delle aree in cui vale; senza dichiarazione vale ovunque. Il filtro lo fa il
/// Plugin: qui si fissa che il server legge le aree e non le perde salvando la configurazione, e
/// che Coop Firenze limita "Forza sconto piccolo" ad A e A- lasciando ovunque la sua rimozione.
/// </summary>
public class AreeAzioniSulBoxTests : IDisposable
{
    private readonly string cartella;

    public AreeAzioniSulBoxTests()
    {
        this.cartella = Path.Combine(Path.GetTempPath(), "istanta-aree-azioni-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(this.cartella);
    }

    public void Dispose()
    {
        try { Directory.Delete(this.cartella, true); } catch { /* la pulizia non deve far fallire il test */ }
    }

    private DbCustomPlugin Carica(string cambiStrutturali)
    {
        File.WriteAllText(Path.Combine(this.cartella, DbCustomPlugin.dbSourceName), "{\"cambiStrutturali\":" + cambiStrutturali + "}");
        return DbCustomPlugin.Load(this.cartella);
    }

    [Fact]
    public void Le_aree_dichiarate_si_leggono_dalla_configurazione()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\",\"Aree\":[\"A\",\"A-\"]}]");

        Assert.Equal(new[] { "A", "A-" }, db.DB.cambiStrutturali[0].Aree);
    }

    [Fact]
    public void Un_azione_senza_aree_resta_con_la_lista_vuota()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\"}]");

        Assert.NotNull(db.DB.cambiStrutturali[0].Aree);
        Assert.Empty(db.DB.cambiStrutturali[0].Aree);
    }

    [Fact]
    public void Salvare_la_configurazione_non_perde_le_aree()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\",\"Aree\":[\"A-\"]}]");

        db.SaveChanges();
        var riletto = DbCustomPlugin.Load(this.cartella);

        Assert.Equal(new[] { "A-" }, riletto.DB.cambiStrutturali[0].Aree);
    }

    [Fact]
    public void Coopfi_limita_Forza_sconto_piccolo_ad_A_e_A_meno()
    {
        string file = DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/" + DbCustomPlugin.dbSourceName);
        var azioni = DbCustomPlugin.Load(Path.GetDirectoryName(file)!).DB.cambiStrutturali;

        Assert.Equal(new[] { "A", "A-" }, azioni.Single(a => a.Titolo == "Forza sconto piccolo").Aree);
        Assert.Empty(azioni.Single(a => a.Titolo == "Rimuovi forzatura sconto piccolo").Aree);
        // Nessun'altra azione di Coop Firenze e' limitata per area.
        Assert.All(azioni.Where(a => a.Titolo != "Forza sconto piccolo"), a => Assert.Empty(a.Aree));
    }
}
