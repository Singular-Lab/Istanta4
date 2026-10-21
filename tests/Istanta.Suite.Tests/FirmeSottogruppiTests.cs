using Istanta.Models_2;
using Istanta.Utility;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1120: la vista Sottogruppi del revisore chiede descrizioni e firme dei sottogruppi
/// (Revisore/getArticoliDescrizioniSottogruppi). La firma di ogni sottogruppo si calcolava passando
/// a getFirmaTracciatoGruppoDaRecords tutti i record della promo, che ne leggeva il dato ogni volta:
/// 43 s su una promo vera, con la pagina che sembrava vuota. RevisioneConteggio.FirmeDeiSottogruppi
/// passa a ogni sottogruppo solo i record dei suoi codici: le firme devono restare le stesse.
/// </summary>
public class FirmeSottogruppiTests
{
    private static readonly PromoTracciati TracciatoTO = new PromoTracciati { Id = 1, guidArea = "TO", guidCanale = "SC" };
    private static readonly PromoTracciati TracciatoSA = new PromoTracciati { Id = 2, guidArea = "SA", guidCanale = "SC" };

    private static long _id;

    private static PromoTracciatiRecord Record(PromoTracciati tracciato, string codice, string sottogruppo, string descrizione,
        byte versione = 1, string label = "VOL")
    {
        var dato = new Dictionary<string, object>
        {
            ["Referenza.Codice"] = codice,
            ["Scatto.CodiceSottogruppo"] = sottogruppo,
            ["Descrizioni.Descrizione1"] = descrizione,
            ["Tracciato.Firma"] = "firma-" + codice + "-" + descrizione
        };
        return new PromoTracciatiRecord
        {
            Id = ++_id,
            IdTracciato = tracciato.Id,
            IdTracciatoNavigation = tracciato,
            Codice = codice,
            CodiceGruppo = codice,
            Label = label,
            Versione = versione,
            Dato = JsonConvert.SerializeObject(dato)
        };
    }

    /// Una promo con sottogruppi in due tracciati, una versione nuova, un codice scritto in minuscolo
    /// e record che non appartengono a nessun sottogruppo.
    private static List<PromoTracciatiRecord> Promo() => new List<PromoTracciatiRecord>
    {
        Record(TracciatoTO, "100", "100,200", "Pasta"),
        Record(TracciatoTO, "200", "100,200", "Sugo"),
        Record(TracciatoSA, "100", "100,200", "Pasta"),
        Record(TracciatoSA, "200", "100,200", "Sugo rosso", versione: 2),
        Record(TracciatoSA, "200", "100,200", "Sugo", versione: 1),
        Record(TracciatoTO, "300", "300,400", "Latte"),
        Record(TracciatoTO, "abc", "300,ABC", "Burro"),
        Record(TracciatoTO, "300", "300,ABC", "Latte"),
        Record(TracciatoTO, "500", "500", "Pane"),
        Record(TracciatoTO, "900", "", "Fuori da tutto"),
        Record(TracciatoSA, "901", "", "Fuori da tutto")
    };

    [Fact]
    public void Le_firme_sono_le_stesse_calcolate_con_tutti_i_record_della_promo()
    {
        var records = Promo();
        var sottogruppi = new[] { "100,200", "300,400", "300,ABC", "500" };

        var firme = RevisioneConteggio.FirmeDeiSottogruppi(records, sottogruppi);

        foreach (var sottogruppo in sottogruppi)
        {
            Assert.Equal(Main.getFirmaTracciatoGruppoDaRecords(records, sottogruppo, true), firme[sottogruppo]);
        }
    }

    [Fact]
    public void Un_sottogruppo_senza_record_ha_la_firma_di_prima()
    {
        var records = Promo();

        var firme = RevisioneConteggio.FirmeDeiSottogruppi(records, new[] { "700,800" });

        Assert.Equal(Main.getFirmaTracciatoGruppoDaRecords(records, "700,800", true), firme["700,800"]);
    }

    [Fact]
    public void I_codici_si_confrontano_senza_badare_alle_maiuscole()
    {
        var records = Promo();

        var firme = RevisioneConteggio.FirmeDeiSottogruppi(records, new[] { "300,ABC" });

        Assert.Equal(Main.getFirmaTracciatoGruppoDaRecords(records, "300,ABC", true), firme["300,abc"]);
    }

    [Fact]
    public void Senza_record_o_senza_sottogruppi_non_si_rompe()
    {
        Assert.Empty(RevisioneConteggio.FirmeDeiSottogruppi(null, null));
        Assert.Empty(RevisioneConteggio.FirmeDeiSottogruppi(Promo(), new[] { "", " " }));
    }
}
