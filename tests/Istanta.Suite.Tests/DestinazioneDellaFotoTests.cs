using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-985: dove vale una foto, come si scrive in archivio.
///
/// Dalla scheda si sceglie la destinazione con due menu, e la voce che vale per tutte arriva
/// come asterisco. In archivio quel concetto si scrive come stringa vuota: e' su quella che il
/// server calcola la precedenza fra foto, dove area piu' canale batte la sola area, che batte
/// il solo canale, che batte quella valida ovunque. Scrivere l'asterisco farebbe risultare la
/// foto di un'area che non esiste, e la precedenza smetterebbe di funzionare.
/// </summary>
public class DestinazioneDellaFotoTests
{
    [Fact]
    public void La_destinazione_scelta_si_scrive_com_e()
    {
        var destinazione = Istanta.Utility.Main.destinazioneDellaFoto("SA", "GDO");

        Assert.Equal("SA", destinazione.area);
        Assert.Equal("GDO", destinazione.canale);
    }

    [Fact]
    public void Vale_per_tutte_si_scrive_vuoto()
    {
        var destinazione = Istanta.Utility.Main.destinazioneDellaFoto("*", "*");

        Assert.Equal("", destinazione.area);
        Assert.Equal("", destinazione.canale);
    }

    [Fact]
    public void Una_meta_sola_puo_valere_per_tutte()
    {
        var soloArea = Istanta.Utility.Main.destinazioneDellaFoto("SA", "*");
        var soloCanale = Istanta.Utility.Main.destinazioneDellaFoto("*", "GDO");

        Assert.Equal("SA", soloArea.area);
        Assert.Equal("", soloArea.canale);
        Assert.Equal("", soloCanale.area);
        Assert.Equal("GDO", soloCanale.canale);
    }

    // Niente e' gia' il modo in cui l'archivio dice "vale ovunque": non va tradotto in altro.
    [Fact]
    public void Niente_resta_niente()
    {
        var destinazione = Istanta.Utility.Main.destinazioneDellaFoto(null, "   ");

        Assert.Equal("", destinazione.area);
        Assert.Equal("", destinazione.canale);
    }

    [Fact]
    public void Gli_spazi_intorno_alla_sigla_non_entrano_in_archivio()
    {
        var destinazione = Istanta.Utility.Main.destinazioneDellaFoto(" SA ", " GDO ");

        Assert.Equal("SA", destinazione.area);
        Assert.Equal("GDO", destinazione.canale);
    }
}
