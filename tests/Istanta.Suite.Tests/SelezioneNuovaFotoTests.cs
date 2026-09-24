using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-985: come nasce una foto appena caricata.
///
/// Dalla scheda articolo si archiviano scatti che non devono sostituire quello in uso.
/// Il caricamento, pero', era nato per il Plugin: la foto nuova diventava primaria e attiva, e
/// prima ancora di crearla venivano spente le altre foto attive. Caricare dalla scheda avrebbe
/// quindi cambiato la foto del prodotto sotto gli occhi dell'operatore, che non l'ha chiesto.
/// </summary>
public class SelezioneNuovaFotoTests
{
    [Fact]
    public void Il_caricamento_di_sempre_mette_la_foto_in_uso()
    {
        var nascita = Istanta.Utility.Main.selezioneNuovaFoto(false);

        Assert.Equal((byte)StatoSelezioneFoto.Primaria, nascita.statoSelezione);
        Assert.True(nascita.attiva);
        Assert.True(nascita.spegniLeAltre);
    }

    [Fact]
    public void Archiviare_e_basta_non_seleziona_la_foto()
    {
        var nascita = Istanta.Utility.Main.selezioneNuovaFoto(true);

        Assert.Equal((byte)StatoSelezioneFoto.NonSelezionata, nascita.statoSelezione);
        Assert.False(nascita.attiva);
    }

    // Le prime due condizioni da sole non bastano: il caricamento spegne le altre foto attive
    // prima di creare la nuova, e l'articolo resterebbe senza nessuna foto in uso.
    [Fact]
    public void Archiviare_e_basta_non_spegne_la_foto_in_uso()
    {
        Assert.False(Istanta.Utility.Main.selezioneNuovaFoto(true).spegniLeAltre);
    }
}
