using Istanta.Models_2;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1104: impaginando, Istanta toglie dalla lista i gruppi gia' impaginati nella lavorazione
/// (Utility.Main.getLavorazioneRecord, in ImpaginaFromInDesignNew e nel controllo dei codici forzati).
/// Lo stesso codice gruppo puo' esserci con due label (main e soci), cioe' due box e due righe
/// impaginate. Prima si guardava solo la prima riga del codice gruppo: il secondario di una label
/// restava in lista senza il suo primario, e ogni impaginazione della lavorazione si fermava con
/// "il gruppo ... non ha un record primario" (lavorazione 1193, gruppo 7938749,7951882).
/// </summary>
public class GruppiGiaImpaginatiTests
{
    private const string Gruppo = "7938749,7951882";

    //Il caso della lavorazione 1193: due label, ciascuna con primario (7938749) e secondario (7951882).
    private const long MainPrimario = 87776, MainSecondario = 87777, SociPrimario = 88875, SociSecondario = 88876;

    private static ArticoloInKit Record(long idRec, string label, string codiceGruppo = Gruppo) =>
        new()
        {
            IdRec = idRec,
            label = label,
            recordInTracciato = new Dictionary<string, object> { [GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codiceGruppo }
        };

    private static List<ArticoloInKit> Kit() => new()
    {
        Record(MainPrimario, "main"),
        Record(MainSecondario, "main"),
        Record(SociPrimario, "soci"),
        Record(SociSecondario, "soci"),
        Record(90001, "main", "1018787")
    };

    //Le righe reali della lavorazione 1193: 268471 (box main, pag. 3) e 268472 (box soci, pag. 4).
    private static PromoLavorazioniRecord Riga(long id, long idRecord, string codiceGruppo = Gruppo) =>
        new() { Id = id, IdLavorazione = 1193, CodiceGruppo = codiceGruppo, IdRecordTracciato = idRecord };

    private static PromoLavorazioniRecord? Impaginato(long idRec, List<PromoLavorazioniRecord> righe, List<ArticoloInKit> kit) =>
        Utility.Main.getLavorazioneRecord(Gruppo, (int)idRec, righe, kit);

    //La stessa esclusione di ImpaginaFromInDesignNew: restano i record senza riga impaginata.
    private static List<long> DaImpaginare(List<PromoLavorazioniRecord> righe, List<ArticoloInKit> kit) =>
        kit.Where(f => Utility.Main.getLavorazioneRecord(
                f.recordInTracciato[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString()!, (int)f.IdRec, righe, kit) == null)
            .Select(f => f.IdRec)
            .ToList();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Con_main_e_soci_impaginati_tutto_il_gruppo_e_impaginato_in_qualunque_ordine_arrivino_le_righe(bool sociPrima)
    {
        var kit = Kit();
        var righe = new List<PromoLavorazioniRecord> { Riga(268471, MainPrimario), Riga(268472, SociPrimario) };
        if (sociPrima)
            righe.Reverse();

        Assert.Equal(268471, Impaginato(MainPrimario, righe, kit)!.Id);
        Assert.Equal(268471, Impaginato(MainSecondario, righe, kit)!.Id);
        Assert.Equal(268472, Impaginato(SociPrimario, righe, kit)!.Id);
        Assert.Equal(268472, Impaginato(SociSecondario, righe, kit)!.Id);

        //Nessun secondario resta in lista senza il suo primario: resta solo l'altro gruppo.
        Assert.Equal(new List<long> { 90001 }, DaImpaginare(righe, kit));
    }

    [Fact]
    public void Con_il_solo_main_impaginato_la_label_soci_resta_da_impaginare_intera()
    {
        var kit = Kit();
        var righe = new List<PromoLavorazioniRecord> { Riga(268471, MainPrimario) };

        Assert.NotNull(Impaginato(MainSecondario, righe, kit));
        Assert.Null(Impaginato(SociPrimario, righe, kit));
        Assert.Null(Impaginato(SociSecondario, righe, kit));
        Assert.Equal(new List<long> { SociPrimario, SociSecondario, 90001 }, DaImpaginare(righe, kit));
    }

    [Fact]
    public void Una_riga_di_un_record_che_non_e_piu_nel_kit_non_esclude_niente_e_non_nasconde_le_altre()
    {
        var kit = Kit();
        var righe = new List<PromoLavorazioniRecord> { Riga(1, 55555), Riga(268471, MainPrimario) };

        Assert.Equal(268471, Impaginato(MainSecondario, righe, kit)!.Id);
        Assert.Equal(new List<long> { SociPrimario, SociSecondario, 90001 }, DaImpaginare(righe, kit));
    }

    [Fact]
    public void Le_regole_di_prima_restano_corrispondenza_esatta_gruppo_mai_impaginato_record_fuori_dal_kit()
    {
        var kit = Kit();
        var righe = new List<PromoLavorazioniRecord> { Riga(268471, MainPrimario), Riga(268472, SociPrimario) };

        //La riga del record stesso vale anche se il record non e' piu' fra quelli del kit.
        Assert.Equal(268471, Utility.Main.getLavorazioneRecord(Gruppo, (int)MainPrimario, righe, new List<ArticoloInKit>())!.Id);

        Assert.Null(Utility.Main.getLavorazioneRecord("1018787", 90001, righe, kit));
        Assert.Null(Utility.Main.getLavorazioneRecord(Gruppo, (int)MainSecondario, new List<PromoLavorazioniRecord>(), kit));

        var errore = Assert.Throws<Exception>(() => Utility.Main.getLavorazioneRecord(Gruppo, 12345, righe, kit));
        Assert.Contains("idRec 12345", errore.Message);
    }
}
