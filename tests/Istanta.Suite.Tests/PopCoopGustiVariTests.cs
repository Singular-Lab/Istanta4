using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1099: nell'esportazione PoP Coop un gruppo con "vari" o "varie" come parola a se' nella
/// descrizione di gruppo, e tutte le referenze allo stesso prezzo, esce con un cartello per referenza,
/// tutti con la descrizione di gruppo, senza cartello di gruppo. Con prezzi diversi restano i cartelli
/// singoli; "varieta'" non attiva la regola.
/// </summary>
public class PopCoopGustiVariTests
{
    private static Dictionary<string, object> DescrizioneDiGruppo(string d1, string d2 = "", string d3 = "", string d4 = "") => new()
    {
        ["Descrizioni.Descrizione1"] = d1,
        ["Descrizioni.Descrizione2"] = d2,
        ["Descrizioni.Descrizione3"] = d3,
        ["Descrizioni.Descrizione4"] = d4
    };

    /* ---- i tre casi della issue ---- */

    [Fact]
    public void Yogurt_gusti_vari_allo_stesso_prezzo_da_cartelli_uguali_con_la_descrizione_di_gruppo()
    {
        bool gustiVari = Coopfi.descrizioneDiGruppoConGustiVari(DescrizioneDiGruppo("Yogurt", "Coop", "gusti vari", "125 g x 4"));

        Assert.True(gustiVari);
        // Ogni referenza esce con la descrizione di gruppo.
        Assert.True(Coopfi.singoloConDescrizioneDiGruppo(inGruppo: true, haDescrizioneDiGruppo: true, lineaDa10InSu: false, gustiVariAPrezzoUnico: gustiVari));
    }

    [Fact]
    public void Con_prezzi_diversi_restano_i_cartelli_singoli()
    {
        // In esportaPoP la regola vale solo a prezzo unico: con prezzi diversi gustiVariAPrezzoUnico e' falso.
        Assert.False(Coopfi.singoloConDescrizioneDiGruppo(inGruppo: true, haDescrizioneDiGruppo: true, lineaDa10InSu: false, gustiVariAPrezzoUnico: false));
    }

    [Fact]
    public void Varieta_di_frutta_non_attiva_la_regola()
    {
        Assert.False(Coopfi.descrizioneDiGruppoConGustiVari(DescrizioneDiGruppo("Varietà di frutta")));
    }

    /* ---- la parola a se' ---- */

    [Theory]
    [InlineData("Biscotti assortiti varie")]
    [InlineData("VARIE")]
    [InlineData("vari")]
    [InlineData("gusti vari, 4 pezzi")]
    [InlineData("Yogurt$brvari gusti")]
    [InlineData("Yogurt<br>Vari")]
    [InlineData("(vari)")]
    public void Vari_e_varie_come_parola_a_se_attivano_la_regola(string descrizione)
    {
        Assert.True(Coopfi.descrizioneConGustiVari(descrizione));
    }

    [Theory]
    [InlineData("Varietà di frutta")]
    [InlineData("gelato variegato")]
    [InlineData("variante leggera")]
    [InlineData("svariati gusti")]
    [InlineData("")]
    [InlineData(null)]
    public void Parole_che_contengono_vari_non_attivano_la_regola(string? descrizione)
    {
        Assert.False(Coopfi.descrizioneConGustiVari(descrizione!));
    }

    [Fact]
    public void Basta_una_delle_quattro_descrizioni_di_gruppo()
    {
        Assert.True(Coopfi.descrizioneDiGruppoConGustiVari(DescrizioneDiGruppo("Succo", "", "", "gusti vari")));
        Assert.False(Coopfi.descrizioneDiGruppoConGustiVari(null!));
        Assert.False(Coopfi.descrizioneConGustiVari(null!));
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void EsportaPoP_applica_la_regola_solo_a_prezzo_unico_e_senza_cartello_di_gruppo()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string esporta = coop.Substring(inizio, fine - inizio);

        Assert.Contains("bool gruppoConGustiVari = codice_referenza != codice_gruppo && !prezziDiversiInGruppo", esporta);
        Assert.Contains("&& descrizioneDiGruppoConGustiVari(recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>);", esporta);
        Assert.Contains("isLineaMaggioreUguale10, gruppoConGustiVari))", esporta);
        Assert.Contains("if (!eludi && codice_gruppo != codice_referenza && !isLineaMaggioreUguale10 && !gruppoConGustiVari)", esporta);
        // La regola si decide prima di usarla.
        Assert.True(esporta.IndexOf("bool gruppoConGustiVari", StringComparison.Ordinal) < esporta.IndexOf("isLineaMaggioreUguale10, gruppoConGustiVari))", StringComparison.Ordinal));
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
