using AgenziaLib;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1019: in Edro21 le meccaniche BIS (NM_MM, NM_MIX_MM, NM_FID, NM_MIX_FID) vogliono due foto
/// nel box. Quando il gruppo ha solo la primaria, esportaVolantino ne aggiunge una copia come
/// secondaria fra le foto del box, e il Plugin la impagina come foto_secondaria.
/// </summary>
public class MeccanicheBisFotoTests
{
    private static FotoElementoGruppo Primaria(string codRef = "3150596", string nomeFoto = "3150596.psd") =>
        new() { codRef = codRef, nomeFoto = nomeFoto, hash = "hash-" + codRef, statoSelezione = 1 };

    private static FotoElementoGruppo Secondaria(string codRef) =>
        new() { codRef = codRef, nomeFoto = codRef + ".psd", hash = "hash-" + codRef, statoSelezione = 2 };

    [Theory]
    [InlineData("NM_MM")]
    [InlineData("NM_MIX_MM")]
    [InlineData("NM_FID")]
    [InlineData("NM_MIX_FID")]
    [InlineData("NM_FID_KgL_evento_SC")]
    [InlineData("NM_MIX_MM_123")]
    public void Con_la_sola_primaria_si_aggiunge_la_sua_copia_come_secondaria(string combinazione)
    {
        var primaria = Primaria();
        var membri = new List<FotoElementoGruppo> { primaria };

        Edro21.aggiungiSecondariaPerMeccanicaBis(combinazione, membri);

        Assert.Equal(2, membri.Count);
        var copia = Assert.Single(membri, m => m.statoSelezione == 2);
        Assert.Equal(primaria.codRef, copia.codRef);
        Assert.Equal(primaria.nomeFoto, copia.nomeFoto);
        Assert.Equal(primaria.hash, copia.hash);
        Assert.False(copia.noRender);
        Assert.NotSame(primaria, copia);
    }

    [Fact]
    public void La_primaria_resta_com_era_e_in_testa()
    {
        var primaria = Primaria();
        var membri = new List<FotoElementoGruppo> { primaria };

        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_FID", membri);

        Assert.Same(primaria, membri[0]);
        Assert.Equal((byte)1, primaria.statoSelezione);
    }

    [Theory]
    [InlineData("3x2")]
    [InlineData("NM_MIX")]          // da sola non e' una delle quattro
    [InlineData("50sulsecondo")]    // stessa famiglia nei prezzi, ma la issue non la chiede
    [InlineData("nm_fid")]          // le sigle si confrontano come nel resto dell'export
    [InlineData("")]
    [InlineData(null)]
    public void Le_altre_meccaniche_non_cambiano_le_foto(string? combinazione)
    {
        var membri = new List<FotoElementoGruppo> { Primaria() };

        Edro21.aggiungiSecondariaPerMeccanicaBis(combinazione!, membri);

        Assert.Single(membri);
    }

    [Fact]
    public void Se_c_e_gia_una_secondaria_non_si_aggiunge_niente()
    {
        var membri = new List<FotoElementoGruppo> { Primaria(), Secondaria("3150599") };

        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_MM", membri);

        Assert.Equal(2, membri.Count);
        Assert.Equal("3150599", Assert.Single(membri, m => m.statoSelezione == 2).codRef);
    }

    // Il metodo gira una volta per record: il secondo passaggio non deve dare una terza foto.
    [Fact]
    public void Due_passaggi_non_danno_una_terza_foto()
    {
        var membri = new List<FotoElementoGruppo> { Primaria() };

        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_MM", membri);
        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_MM", membri);

        Assert.Equal(2, membri.Count);
    }

    [Fact]
    public void Senza_primaria_non_si_inventa_una_foto()
    {
        var soloEscluse = new List<FotoElementoGruppo>();

        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_FID", soloEscluse);

        Assert.Empty(soloEscluse);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Una_primaria_senza_foto_non_si_copia(string nomeFoto)
    {
        var membri = new List<FotoElementoGruppo> { Primaria(nomeFoto: nomeFoto) };

        Edro21.aggiungiSecondariaPerMeccanicaBis("NM_FID", membri);

        Assert.Single(membri);
    }

    [Fact]
    public void Un_elenco_mancante_non_fa_danni()
    {
        var eccezione = Record.Exception(() => Edro21.aggiungiSecondariaPerMeccanicaBis("NM_FID", null!));

        Assert.Null(eccezione);
    }
}
