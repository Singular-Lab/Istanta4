using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1098: nell'esportazione PoP Coop il cartello singolo di una referenza in gruppo usa la propria
/// descrizione, anche con prezzi e pesi tutti uguali; il cartello di gruppo resta con tutti i gusti.
/// Le linee da 10 referenze in su tengono la descrizione di gruppo.
/// </summary>
public class PopCoopDescrizioneSingoliTests
{
    [Fact]
    public void In_un_gruppo_il_singolo_usa_la_propria_descrizione()
    {
        // Un gruppo di 3 gusti con prezzi e pesi uguali: prima il singolo prendeva la descrizione di gruppo.
        Assert.False(Coopfi.singoloConDescrizioneDiGruppo(inGruppo: true, haDescrizioneDiGruppo: true, lineaDa10InSu: false));
    }

    [Fact]
    public void Nelle_linee_da_10_in_su_il_cartello_linea_usa_la_descrizione_di_gruppo()
    {
        Assert.True(Coopfi.singoloConDescrizioneDiGruppo(inGruppo: true, haDescrizioneDiGruppo: true, lineaDa10InSu: true));
    }

    [Theory]
    [InlineData(false, true, false)]
    [InlineData(false, false, false)]
    [InlineData(true, false, false)]
    [InlineData(true, false, true)]
    public void Senza_gruppo_o_senza_descrizione_di_gruppo_resta_la_propria(bool inGruppo, bool haDescrizioneDiGruppo, bool lineaDa10InSu)
    {
        Assert.False(Coopfi.singoloConDescrizioneDiGruppo(inGruppo, haDescrizioneDiGruppo, lineaDa10InSu));
    }

    [Fact]
    public void EsportaPoP_sceglie_la_descrizione_del_singolo_con_la_regola_e_lascia_quella_del_cartello_di_gruppo()
    {
        string coop = Sorgente("AgenziaLib/Coopfi.cs");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        int fine = coop.IndexOf("public TracciatoResultKit esportaVolantino(", StringComparison.Ordinal);
        string esporta = coop.Substring(inizio, fine - inizio);

        // I20-1099: con in coda i gruppi con "vari"/"varie" a prezzo unico.
        int regola = esporta.IndexOf("if (singoloConDescrizioneDiGruppo(codice_referenza != codice_gruppo, recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo), isLineaMaggioreUguale10, gruppoConGustiVari))", StringComparison.Ordinal);
        Assert.True(regola > 0);
        // Subito dopo, la descrizione 1 del cartello viene da quella di gruppo.
        Assert.True(esporta.IndexOf("Descrizione1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo]", regola, StringComparison.Ordinal) > regola);
        Assert.DoesNotContain("((prezziDiversiInGruppo == false && pesiDiversiInGruppo == false) || isLineaMaggioreUguale10)", esporta);

        // Il cartello di gruppo (sottogruppo) continua a prendere la descrizione di gruppo.
        int sottogruppo = esporta.IndexOf("RefCloner.CopiaETrasformaObjSingoloInObjSottogruppo(recItem)", StringComparison.Ordinal);
        Assert.True(esporta.IndexOf("Descrizione1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo]", sottogruppo, StringComparison.Ordinal) > sottogruppo);
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
