using AgenziaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Nel PoP Coop il cartello di gruppo di un gruppo marcato linea aggiungeva _LINEA agli stili della
/// descrizione per qualunque box. Nel CssFramework di Coop pero' doppio sconto, Sprint, Jolly, Jolly
/// evidenziato, esclusiva soci e SpendiPunti vengono prima di BOX_LINEA e restano tali anche con
/// IS_LINEA: ne uscivano stili inesistenti come DESCRIZIONE_TITOLO_SPENDIPUNTI_LINEA, e per
/// BOX_doppio_SCONTO_LINEA, che ha gia' gli stili _LINEA, un _LINEA_LINEA. Ora, come nel volantino,
/// _LINEA vale solo per BOX_LINEA e BOX_doppio_SCONTO_LINEA, una volta sola. Il box e' quello del
/// record: per una linea sotto le 10 referenze esportaPoP tratta i singoli come BOX_STD.
/// </summary>
public class PopCoopStiliLineaCartelloGruppoTests
{
    [Theory]
    [InlineData("DESCRIZIONE_TITOLO_SPENDIPUNTI", "BOX_ESCLUSIVA_SOCI", "DESCRIZIONE_TITOLO_SPENDIPUNTI")]
    [InlineData("DESCRIZIONE_TITOLO_SPENDIPUNTI", "BOX_SpendiPunti", "DESCRIZIONE_TITOLO_SPENDIPUNTI")]
    [InlineData("DESCRIZIONE_TITOLO", "BOX_doppio_SCONTO", "DESCRIZIONE_TITOLO")]
    [InlineData("DESCRIZIONE_TITOLO", "BOX_JOLLY", "DESCRIZIONE_TITOLO")]
    [InlineData("DESCRIZIONE_TITOLO", "BOX_SPRINT", "DESCRIZIONE_TITOLO")]
    [InlineData("DESCRIZIONE_TITOLO", "BOX_LINEA", "DESCRIZIONE_TITOLO_LINEA")]
    [InlineData("DESCRIZIONE_GRAMMATURA", "BOX_LINEA", "DESCRIZIONE_GRAMMATURA_LINEA")]
    [InlineData("DESCRIZIONE_TITOLO_LINEA", "BOX_doppio_SCONTO_LINEA", "DESCRIZIONE_TITOLO_LINEA")]
    [InlineData("DESCRIZIONE_TITOLO", "BOX_doppio_SCONTO_LINEA", "DESCRIZIONE_TITOLO_LINEA")]
    public void Lo_stile_di_linea_del_cartello_di_gruppo_vale_solo_per_i_box_di_linea_una_volta_sola(string stile, string box, string atteso)
    {
        Assert.Equal(atteso, Coopfi.stileDescrizioneCartelloDiLinea(stile, box));
    }

    [Fact]
    public void Il_cartello_di_gruppo_marcato_linea_usa_lo_stile_calcolato_dal_box_del_record()
    {
        string coop = File.ReadAllText(DllAgenziaLibTests.TrovaFile("AgenziaLib/Coopfi.cs")).Replace("\r", "");
        int inizio = coop.IndexOf("public TracciatoResultKit esportaPoP(", StringComparison.Ordinal);
        string pop = coop.Substring(inizio, coop.IndexOf("public TracciatoResultKit esportaVolantino(", inizio, StringComparison.Ordinal) - inizio);

        int ramo = pop.IndexOf("if (is_linea) {", StringComparison.Ordinal);
        Assert.True(ramo > 0);
        string linea = pop.Substring(ramo, pop.IndexOf("} else", ramo, StringComparison.Ordinal) - ramo);

        Assert.Contains("string boxDelGruppo = recItem[key_codiceBox].ToString();", linea);
        foreach (string n in new[] { "1", "2", "3", "4" })
        {
            Assert.Contains($"string stileLinea{n} = stileDescrizioneCartelloDiLinea(stileDescr{n}, boxDelGruppo);", linea);
            Assert.Contains($"<{{stileLinea{n}}}>{{Descrizione{n}}}</{{stileLinea{n}}}>", linea);
        }
        //Il suffisso non e' piu' scritto a mano.
        Assert.DoesNotContain("}_LINEA>", linea);
    }
}
