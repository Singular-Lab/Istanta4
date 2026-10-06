using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1049: le azioni sul box dichiarano a chi si possono applicare in un gruppo.
///
/// Nel SourceCustomPlugin.json di un'agenzia ogni azione di cambiStrutturali puo' dire, con
/// OpzioniValide, se vale per tutto il gruppo ("tutto"), per il solo primario ("primario") o per
/// entrambi. Il Plugin la riceve cosi' com'e': qui si fissa che il server la legge, che la sua
/// assenza resta una lista vuota - cioe' entrambe le opzioni, il comportamento di prima - e che
/// un salvataggio della configurazione non la perde.
/// </summary>
public class OpzioniAzioniSulBoxTests : IDisposable
{
    private readonly string cartella;

    public OpzioniAzioniSulBoxTests()
    {
        this.cartella = Path.Combine(Path.GetTempPath(), "istanta-azioni-box-" + Guid.NewGuid().ToString("N"));
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
    public void Le_opzioni_dichiarate_si_leggono_dalla_configurazione()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\",\"OpzioniValide\":[\"tutto\"]},{\"Id\":2,\"Titolo\":\"Altra\",\"OpzioniValide\":[\"tutto\",\"primario\"]}]");

        Assert.Equal(new[] { "tutto" }, db.DB.cambiStrutturali[0].OpzioniValide);
        Assert.Equal(new[] { "tutto", "primario" }, db.DB.cambiStrutturali[1].OpzioniValide);
    }

    [Fact]
    public void Un_azione_senza_opzioni_resta_con_la_lista_vuota()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\"}]");

        Assert.NotNull(db.DB.cambiStrutturali[0].OpzioniValide);
        Assert.Empty(db.DB.cambiStrutturali[0].OpzioniValide);
    }

    [Fact]
    public void Salvare_la_configurazione_non_perde_le_opzioni()
    {
        var db = Carica("[{\"Id\":1,\"Titolo\":\"Azione\",\"OpzioniValide\":[\"primario\"]}]");

        db.SaveChanges();
        var riletto = DbCustomPlugin.Load(this.cartella);

        Assert.Equal(new[] { "primario" }, riletto.DB.cambiStrutturali[0].OpzioniValide);
    }
}
