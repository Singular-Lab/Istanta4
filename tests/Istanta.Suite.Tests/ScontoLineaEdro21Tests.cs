using System.IO;
using System.Linq;
using AgenziaLib;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1127: la resa "sconto linea" delle meccaniche % MM ALL e % FID ALL, senza prezzo barrato ne'
/// prezzo offerta, usciva solo per cura persona senza prezzo offerta. L'azione sul box "Forza a sconto
/// linea" la estende a ogni reparto scrivendo sconto_linea_forzato nel record; fuori da EXTRA la
/// descrizione esce senza esempio. La regola sta in ScontoLineaEdro21 e esportaVolantino la usa.
/// </summary>
public class ScontoLineaEdro21Tests
{
    [Theory]
    //Cura persona senza prezzo offerta: come sempre.
    [InlineData("PERCENTO_MM_ALL", "9", "", false, true)]
    [InlineData("PERCENTO_FID_ALL", "9", "", false, true)]
    [InlineData("PERCENTO_FID_ALL", " 9 ", "", false, true)]
    //Cura persona con il prezzo, o un altro reparto, senza forzatura: i prezzi restano.
    [InlineData("PERCENTO_MM_ALL", "9", "7,92", false, false)]
    [InlineData("PERCENTO_MM_ALL", "83", "7,92", false, false)]
    [InlineData("PERCENTO_FID_ALL", "31", "", false, false)]
    //Forzata: il caso della issue, reparto EXTRA con i prezzi, e un reparto revisionato.
    [InlineData("PERCENTO_FID_ALL", "83", "7,92", true, true)]
    [InlineData("PERCENTO_MM_ALL", "31", "", true, true)]
    [InlineData("PERCENTO_MM_ALL_boxetto", "31", "7,92", true, true)]
    //Senza una meccanica ALL la forzatura non fa niente.
    [InlineData("PERCENTO_MM", "9", "", true, false)]
    [InlineData("PERCENTO_FID", "83", "7,92", true, false)]
    [InlineData("NM_MM", "9", "", true, false)]
    [InlineData("", "9", "", true, false)]
    [InlineData(null, "9", "", false, false)]
    public void Il_box_esce_senza_prezzi_per_cura_persona_senza_prezzo_o_per_forzatura(string? meccanica, string reparto, string prezzo, bool forzato, bool atteso)
    {
        Assert.Equal(atteso, ScontoLineaEdro21.SenzaPrezzi(meccanica, reparto, prezzo, forzato));
    }

    [Fact]
    public void La_forzatura_si_legge_come_testo_o_come_booleano_e_nient_altro()
    {
        Assert.True(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = "true" }));
        Assert.True(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = "True" }));
        Assert.True(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = true }));
        Assert.False(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = "false" }));
        Assert.False(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = false }));
        Assert.False(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = "" }));
        Assert.False(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["sconto_linea_forzato"] = null! }));
        //La chiave assente: la ref non e' mai stata forzata.
        Assert.False(ScontoLineaEdro21.Forzato(new Dictionary<string, object> { ["reparto_forzato"] = "true" }));
        Assert.False(ScontoLineaEdro21.Forzato(null));
    }

    [Theory]
    [InlineData(true, "EX", false)]
    [InlineData(true, "ex", false)]
    [InlineData(true, " EX ", false)]
    [InlineData(true, "FR", true)]
    [InlineData(true, "", true)]
    [InlineData(true, null, true)]
    [InlineData(false, "FR", false)]
    [InlineData(false, "EX", false)]
    public void L_esempio_esce_dalla_descrizione_solo_se_forzata_e_fuori_da_EXTRA(bool forzato, string? sigla, bool atteso)
    {
        Assert.Equal(atteso, ScontoLineaEdro21.EsempioEscluso(forzato, sigla));
    }

    private static List<(int Blocco, string Campo, IstantaLib.OperatoreCondizione Operatore, string Value)> Regole(IstantaLib.CambioStrutturale azione)
        => azione.Condizione.SelectMany(b => b.Regole.Select(r => (b.Id, r.Campo, r.Operatore, r.Value))).ToList();

    [Fact]
    public void Forza_a_sconto_linea_vale_solo_per_le_meccaniche_ALL_non_forzate()
    {
        var azione = new Edro21().GetCambioStrutturalePath().Single(a => a.Titolo == "Forza a sconto linea");

        Assert.Equal("sconto_linea_forzato", azione.Istruzioni.Single().Field);
        Assert.Equal("true", azione.Istruzioni.Single().Valore);
        Assert.Equal(new[]
        {
            (1, "meccanica_tradotta", IstantaLib.OperatoreCondizione.Contains, "PERCENTO_MM_ALL"),
            (1, "sconto_linea_forzato", IstantaLib.OperatoreCondizione.NotEquals, "true"),
            (2, "meccanica_tradotta", IstantaLib.OperatoreCondizione.Contains, "PERCENTO_FID_ALL"),
            (2, "sconto_linea_forzato", IstantaLib.OperatoreCondizione.NotEquals, "true")
        }, Regole(azione));
    }

    [Fact]
    public void Rimuovi_forzatura_sconto_linea_vale_solo_per_la_ref_forzata()
    {
        var azione = new Edro21().GetCambioStrutturalePath().Single(a => a.Titolo == "Rimuovi forzatura sconto linea");

        Assert.Equal("false", azione.Istruzioni.Single().Valore);
        Assert.Equal(new[] { (1, "sconto_linea_forzato", IstantaLib.OperatoreCondizione.Equals, "true") }, Regole(azione));
    }

    [Theory]
    [InlineData("Forza a sconto linea")]
    [InlineData("Rimuovi forzatura sconto linea")]
    public void La_riserva_in_AgenziaLib_e_il_SourceCustomPlugin_di_Edro21_hanno_le_stesse_condizioni(string titolo)
    {
        var json = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json")));
        var dalSource = json["cambiStrutturali"]!.ToObject<List<IstantaLib.CambioStrutturale>>()!.Single(a => a.Titolo == titolo);
        var dallaRiserva = new Edro21().GetCambioStrutturalePath().Single(a => a.Titolo == titolo);

        Assert.Equal(Regole(dallaRiserva), Regole(dalSource));
        Assert.Equal(dallaRiserva.Istruzioni.Single().Field, dalSource.Istruzioni.Single().Field);
        Assert.Equal(dallaRiserva.Istruzioni.Single().Valore, dalSource.Istruzioni.Single().Valore);
        //Come ogni azione di Edro21, vale solo per tutto il gruppo.
        Assert.Equal(new[] { "tutto" }, dalSource.OpzioniValide);
    }
}
