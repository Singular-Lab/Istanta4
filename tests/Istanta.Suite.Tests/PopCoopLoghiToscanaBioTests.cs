using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1100: per decisione dell'ufficio marketing Coop del 13/10/2026 nel PoP non escono mai i loghi
/// logo_toscana1 e logo_bio; il codice che li inseriva resta, spento e marcato DEPRECATO. In area A la
/// colonna logo_toscana1 valorizzata ("x" o "X") continua a togliere lo sconto piccolo. Il volantino
/// non cambia.
/// </summary>
public class PopCoopLoghiToscanaBioTests
{
    [Theory]
    [InlineData("x")]
    [InlineData("X")]
    [InlineData(" x ")]
    public void La_colonna_Toscana_con_x_o_X_e_valorizzata(string valore)
    {
        Assert.True(Coopfi.colonnaToscanaValorizzata(valore));
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("no")]
    [InlineData("xx")]
    public void Senza_x_la_colonna_Toscana_non_e_valorizzata(string? valore)
    {
        Assert.False(Coopfi.colonnaToscanaValorizzata(valore));
    }

    [Fact]
    public void I_loghi_Toscana_e_bio_sono_spenti_nel_PoP()
    {
        Assert.False(Coopfi.LoghiToscanaEBioNelPoP);
    }

    [Fact]
    public void EsportaPoP_non_inserisce_i_loghi_Toscana_e_bio()
    {
        string pop = EsportaPoP();

        int salto = pop.IndexOf("if (s == \"logo_toscana1\" && !LoghiToscanaEBioNelPoP)", StringComparison.Ordinal);
        Assert.True(salto > 0);
        Assert.True(salto < pop.IndexOf("LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == s);", StringComparison.Ordinal));

        int bio = pop.IndexOf("if (LoghiToscanaEBioNelPoP && (", StringComparison.Ordinal);
        Assert.True(bio > 0);
        Assert.True(bio < pop.IndexOf("LogoBollo lBIO = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == \"logo_bio\");", StringComparison.Ordinal));
    }

    [Fact]
    public void EsportaPoP_toglie_lo_sconto_piccolo_con_la_colonna_Toscana_x_o_X()
    {
        string pop = EsportaPoP();

        Assert.Equal(2, Occorrenze(pop, "bool speciale_toscana = colonnaToscanaValorizzata(recItem[\"logo_toscana1\"]);"));
        Assert.DoesNotContain("recItem[\"logo_toscana1\"].ToString() == \"X\"", pop);
        Assert.Equal(2, Occorrenze(pop, "!speciale_toscana &&"));
    }

    [Fact]
    public void La_disattivazione_dice_chi_l_ha_decisa_e_quando()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int interruttore = coop.IndexOf("public static readonly bool LoghiToscanaEBioNelPoP = false;", StringComparison.Ordinal);
        string commento = coop.Substring(coop.LastIndexOf("/// <summary>", interruttore, StringComparison.Ordinal), interruttore - coop.LastIndexOf("/// <summary>", interruttore, StringComparison.Ordinal));

        Assert.Contains("DEPRECATO", commento);
        Assert.Contains("marketing Coop", commento);
        Assert.Contains("13/10/2026", commento);
    }

    [Fact]
    public void Il_volantino_inserisce_ancora_i_loghi_Toscana_e_bio()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        string volantino = coop.Substring(coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal));

        Assert.Contains("\"logo_toscana1\", \"logo_vegano\"", volantino);
        Assert.Contains("LogoBollo lBIO = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == \"logo_bio\");", volantino);
        Assert.DoesNotContain("LoghiToscanaEBioNelPoP", volantino);
    }

    private static int Occorrenze(string testo, string cercato) => testo.Split(cercato).Length - 1;

    private static string EsportaPoP()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        return coop.Substring(inizio, fine - inizio);
    }

    private static string Sorgente(string relativo) => File.ReadAllText(Percorso(relativo.Replace('/', Path.DirectorySeparatorChar))).Replace("\r", "");

    private static string Percorso(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo);
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
