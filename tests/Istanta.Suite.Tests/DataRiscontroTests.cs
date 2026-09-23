using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-986: la data di un riscontro durante il ricollegamento.
///
/// I riscontri in altri tracciati arrivano come dizionari costruiti altrove, e servono ordinati
/// dal piu' recente per proporre da dove clonare. La chiave della data veniva letta senza
/// controllare che ci fosse, mentre tutte le altre erano protette: bastava un riscontro senza
/// quella chiave perche' l'operatore, invece della proposta di clonazione, vedesse un errore.
/// </summary>
public class DataRiscontroTests
{
    [Fact]
    public void La_data_si_legge_quando_c_e()
    {
        var riscontro = new Dictionary<string, object> { { "dataPromo", new DateTime(2026, 9, 23) } };

        Assert.Equal(new DateTime(2026, 9, 23), Istanta.Utility.Main.dataDelRiscontro(riscontro));
    }

    [Fact]
    public void Senza_la_chiave_non_si_solleva_niente()
    {
        var riscontro = new Dictionary<string, object> { { "promo", "Volantino" } };

        Assert.Null(Istanta.Utility.Main.dataDelRiscontro(riscontro));
        Assert.Null(Istanta.Utility.Main.dataDelRiscontro(null));
    }

    [Fact]
    public void Una_data_scritta_come_testo_si_capisce_lo_stesso()
    {
        var riscontro = new Dictionary<string, object> { { "dataPromo", "2026-09-23" } };

        Assert.Equal(new DateTime(2026, 9, 23), Istanta.Utility.Main.dataDelRiscontro(riscontro));
    }

    [Fact]
    public void Un_valore_che_non_e_una_data_non_diventa_una_data()
    {
        var riscontro = new Dictionary<string, object> { { "dataPromo", "non una data" } };

        Assert.Null(Istanta.Utility.Main.dataDelRiscontro(riscontro));
    }

    // Quello che conta per l'uso vero: i riscontri si ordinano dal piu' recente, e quelli senza
    // data finiscono in fondo invece di far fallire tutto.
    [Fact]
    public void I_riscontri_senza_data_finiscono_in_fondo()
    {
        var riscontri = new List<Dictionary<string, object>>
        {
            new() { { "promo", "vecchia" }, { "dataPromo", new DateTime(2026, 1, 1) } },
            new() { { "promo", "senza data" } },
            new() { { "promo", "recente" }, { "dataPromo", new DateTime(2026, 9, 1) } }
        };

        var ordinati = riscontri
            .OrderByDescending(r => Istanta.Utility.Main.dataDelRiscontro(r))
            .Select(r => r["promo"].ToString())
            .ToList();

        Assert.Equal(new[] { "recente", "vecchia", "senza data" }, ordinati);
    }
}
