using Istanta.Utility;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-999: la foto indicata dal tracciato, e cosa succede quando non si trova.
///
/// Se il tracciato la chiede ma in archivio non c'e', prima si azzeravano nome, guid e id e la
/// ref usciva senza immagine anche avendone una buona. Un nome sbagliato nel tracciato non deve
/// spegnere la scelta della foto, deve solo smettere di comandarla.
/// </summary>
public class FotoDaTracciatoTests
{
    [Theory]
    [InlineData("foto1.psd", "foto1.")]
    [InlineData("foto1.PSD", "foto1.")]
    [InlineData("cartella/foto1.psd", "foto1.")]
    [InlineData("foto1", "foto1.")]
    [InlineData("foto.con.punti.psd", "foto.con.punti.")]
    public void Il_nome_si_cerca_senza_estensione_e_col_punto_in_coda(string dalTracciato, string atteso)
    {
        // Il punto in coda serve perche' il confronto in archivio e' un "contiene": senza,
        // "foto1" pescherebbe anche "foto10".
        Assert.Equal(atteso, FotoDaTracciato.NomeDaCercare(dalTracciato));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(".psd")]
    public void Un_nome_inutilizzabile_non_diventa_una_ricerca(string? dalTracciato)
    {
        // Prima si costruiva un FileInfo direttamente sul valore del tracciato: su una stringa
        // vuota quello solleva un'eccezione invece di comportarsi come "foto non trovata".
        Assert.Null(FotoDaTracciato.NomeDaCercare(dalTracciato));
    }

    [Fact]
    public void La_selezione_si_disattiva_solo_se_era_chiesta_e_la_foto_manca()
    {
        Assert.True(FotoDaTracciato.SelezioneDisattivata(chiaveDichiarata: true, fotoTrovata: false));
    }

    [Fact]
    public void Con_la_foto_trovata_comanda_il_tracciato()
    {
        Assert.False(FotoDaTracciato.SelezioneDisattivata(chiaveDichiarata: true, fotoTrovata: true));
    }

    [Fact]
    public void Senza_la_chiave_non_c_e_niente_da_disattivare()
    {
        // La scelta normale gira lo stesso, ma non perche' qualcosa sia stato messo da parte.
        Assert.False(FotoDaTracciato.SelezioneDisattivata(chiaveDichiarata: false, fotoTrovata: false));
        Assert.False(FotoDaTracciato.SelezioneDisattivata(chiaveDichiarata: false, fotoTrovata: true));
    }
}
