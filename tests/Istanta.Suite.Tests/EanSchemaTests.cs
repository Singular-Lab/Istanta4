using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-988: la misura nel programma e quella nelle colonne devono dire la stessa cosa.
///
/// Se si scollassero, il primo ean lungo farebbe fallire la scrittura invece di essere tagliato:
/// il programma lo lascerebbe passare intero e il database lo rifiuterebbe. La mappatura del
/// modello non ha bisogno di un controllo, perche' ora usa direttamente la costante; i numeri
/// scritti a mano sono quelli dei file sql, ed e' li' che la guardia serve.
/// </summary>
public class EanSchemaTests
{
    // Lo schema si applica solo alla creazione del database: questo riguarda le installazioni
    // nuove, mentre quelle gia' in uso hanno bisogno dell'alterazione.
    [Fact]
    public void Lo_schema_di_creazione_dichiara_la_stessa_misura()
    {
        var schema = File.ReadAllText(Path.Combine(RadiceDelProgetto(), "pg-ctx1.sql"));

        Assert.Contains("ean character varying(" + Istanta.Utility.Main.lunghezzaMassimaEan + ")", schema);
        Assert.DoesNotContain("ean character varying(30)", schema);
    }

    [Fact]
    public void Esiste_l_alterazione_per_i_database_gia_esistenti()
    {
        var alterazione = File.ReadAllText(Path.Combine(RadiceDelProgetto(), "alterazione_ean_300.sql"));

        Assert.Contains("ALTER TABLE articoli", alterazione);
        Assert.Contains("character varying(" + Istanta.Utility.Main.lunghezzaMassimaEan + ")", alterazione);
    }

    private static string RadiceDelProgetto()
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);

        while (cartella != null && !File.Exists(Path.Combine(cartella.FullName, "pg-ctx1.sql")))
        {
            cartella = cartella.Parent;
        }

        Assert.NotNull(cartella);
        return cartella!.FullName;
    }
}
