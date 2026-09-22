using Istanta.Models_2;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-983: la firma del gruppo quando il salvataggio non viene da una lavorazione.
///
/// Salvando una descrizione dalla scheda articolo non c'e' ne' promo ne' record del tracciato.
/// Il calcolo della firma, davanti a nessun record, risponde "firme discordanti": chi lo
/// chiamava andava allora a cercare il garante, la libreria d'agenzia non aveva nulla da
/// elaborare e il salvataggio moriva con "Elemento con codice X non trovato durante
/// l'estrazione del garante". Quel pulsante non si era mai potuto premere, quindi il difetto
/// era li' da sempre senza che nessuno lo vedesse.
///
/// Senza record la firma e' quella che dichiara il chiamante, e dalla scheda articolo dice
/// "Da archivio": quella descrizione non nasce da un tracciato.
/// </summary>
public class FirmaSalvataggioDaArchivioTests
{
    [Fact]
    public void Senza_record_vale_la_firma_dichiarata()
    {
        var firma = Istanta.Utility.Main.firmaDaRecordsOppureDichiarata(
            new List<PromoTracciatiRecord>(), "1047450", false, "Da archivio");

        Assert.Equal("Da archivio", firma);
    }

    [Fact]
    public void Nessun_elenco_di_record_vale_quanto_un_elenco_vuoto()
    {
        var firma = Istanta.Utility.Main.firmaDaRecordsOppureDichiarata(
            null, "1047450", false, "Da archivio");

        Assert.Equal("Da archivio", firma);
    }

    // Meglio una firma vuota che la parola "null" scritta nel database.
    [Fact]
    public void Senza_record_e_senza_firma_dichiarata_resta_il_vuoto()
    {
        var firma = Istanta.Utility.Main.firmaDaRecordsOppureDichiarata(
            new List<PromoTracciatiRecord>(), "1047450", false, null);

        Assert.Equal(string.Empty, firma);
    }

    // Dove i record ci sono, cioe' in tutti i salvataggi dal revisore, comanda il calcolo di
    // sempre e la firma dichiarata non c'entra nulla.
    [Fact]
    public void Con_i_record_comanda_il_calcolo_e_non_la_dichiarazione()
    {
        var records = new List<PromoTracciatiRecord>
        {
            new PromoTracciatiRecord
            {
                Codice = "1047450",
                Label = "L1",
                Versione = 1,
                Dato = "{\"Tracciato.Firma\":\"ABC\"}",
                IdTracciatoNavigation = new PromoTracciati { guidArea = "areaA", guidCanale = "canaleC" }
            }
        };

        var firma = Istanta.Utility.Main.firmaDaRecordsOppureDichiarata(
            records, "1047450", false, "Da archivio");

        Assert.Equal("ABC", firma);
    }
}
