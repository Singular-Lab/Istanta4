using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-988: quanto puo' essere lungo un ean.
///
/// La misura era scritta a mano in cinque posti: la mappatura del modello, lo schema e tre
/// tagli dentro all'importazione, piu' uno nei confronti. Allargare la colonna senza toccare i
/// tagli non sarebbe servito a niente, perche' gli ean lunghi avrebbero continuato ad arrivare
/// gia' tagliati. Qui si fissa la misura unica e la regola del taglio.
/// </summary>
public class EanTests
{
    [Fact]
    public void La_misura_dell_ean_e_trecento()
    {
        Assert.Equal(300, Istanta.Utility.Main.lunghezzaMassimaEan);
    }

    [Fact]
    public void Un_ean_dentro_la_misura_non_si_tocca()
    {
        Assert.Equal("8057018222537", Istanta.Utility.Main.eanTroncato("8057018222537"));
    }

    // Trenta caratteri era il limite di prima: un ean di quella lunghezza deve passare intero,
    // altrimenti la modifica non avrebbe cambiato niente per chi importa.
    [Fact]
    public void Quello_che_prima_veniva_tagliato_adesso_passa()
    {
        var ean = new string('8', 120);

        Assert.Equal(ean, Istanta.Utility.Main.eanTroncato(ean));
        Assert.Equal(120, Istanta.Utility.Main.eanTroncato(ean)!.Length);
    }

    [Fact]
    public void Oltre_la_misura_si_taglia()
    {
        var ean = new string('8', 350);

        Assert.Equal(300, Istanta.Utility.Main.eanTroncato(ean)!.Length);
    }

    // Il taglio esiste perche' un dato fuori misura non fermi l'intera importazione: sul confine
    // esatto non deve tagliare, o si perderebbe un carattere buono.
    [Fact]
    public void Sul_confine_esatto_non_si_taglia()
    {
        var ean = new string('8', 300);

        Assert.Equal(ean, Istanta.Utility.Main.eanTroncato(ean));
    }

    [Fact]
    public void Niente_resta_niente()
    {
        Assert.Null(Istanta.Utility.Main.eanTroncato(null));
        Assert.Equal("", Istanta.Utility.Main.eanTroncato(""));
    }
}
