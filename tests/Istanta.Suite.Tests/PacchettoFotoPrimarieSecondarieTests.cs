using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1230: il pacchetto foto della lavorazione portava la foto di ogni record del kit, anche
/// delle referenze non selezionate dei gruppi: gigabyte a ogni sync. Ora porta solo le primarie e
/// le secondarie (SyncFotoController.RecordConFotoNelPacchetto); le altre si scaricano da Foto P/S.
/// </summary>
public class PacchettoFotoPrimarieSecondarieTests
{
    private static ArticoloInKit Record(string codice, object? stato)
    {
        var dato = new Dictionary<string, object> { ["Referenza.Codice"] = codice };
        if (stato != null)
        {
            dato[GLOBAL_VARIABLES.keyXMLSelezione] = stato;
        }
        return new ArticoloInKit { recordInTracciato = dato };
    }

    private static List<string> Codici(IEnumerable<ArticoloInKit> records) =>
        SyncFotoController.RecordConFotoNelPacchetto(records).Select(r => r.recordInTracciato["Referenza.Codice"].ToString()!).ToList();

    [Fact]
    public void Del_gruppo_restano_la_primaria_e_le_secondarie()
    {
        var kit = new[]
        {
            Record("100", (byte)TipoSelezioneMenabo.Primaria),
            Record("101", (byte)TipoSelezioneMenabo.Secondaria),
            Record("102", (byte)TipoSelezioneMenabo.None),
            Record("103", (byte)TipoSelezioneMenabo.None),
            Record("104", (byte)TipoSelezioneMenabo.Secondaria)
        };

        Assert.Equal(new[] { "100", "101", "104" }, Codici(kit));
    }

    [Fact]
    public void Una_referenza_singola_resta()
    {
        //Il server la segna primaria (FicoProcessController: "un singolo prodotto e' per forza primario").
        Assert.Equal(new[] { "200" }, Codici(new[] { Record("200", (byte)TipoSelezioneMenabo.Primaria) }));
    }

    [Fact]
    public void Un_record_senza_stato_o_con_uno_stato_illeggibile_resta()
    {
        var kit = new[] { Record("300", null), Record("301", "boh"), Record("302", (byte)TipoSelezioneMenabo.None) };

        Assert.Equal(new[] { "300", "301" }, Codici(kit));
    }

    [Theory]
    [InlineData(3L)]
    [InlineData(3)]
    [InlineData("3")]
    public void Lo_stato_si_legge_anche_come_numero_o_testo_del_json(object stato)
    {
        var kit = new[] { Record("400", stato), Record("401", 1L), Record("402", "2") };

        Assert.Equal(new[] { "401", "402" }, Codici(kit));
    }

    [Fact]
    public void Senza_record_il_pacchetto_e_vuoto()
    {
        Assert.Empty(SyncFotoController.RecordConFotoNelPacchetto(null));
        Assert.Empty(SyncFotoController.RecordConFotoNelPacchetto(new ArticoloInKit[] { new ArticoloInKit() }));
    }

    [Fact]
    public void Il_pacchetto_usa_il_filtro_per_le_foto_del_prodotto()
    {
        var sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs"));
        var inizio = sorgente.IndexOf("public async Task<IActionResult> getPacchettoFotoAsContract(", StringComparison.Ordinal);
        var fine = sorgente.IndexOf("SyncFoto/getFotosAsContractNew", inizio, StringComparison.Ordinal);
        Assert.True(inizio > 0 && fine > inizio);
        var metodo = sorgente.Substring(inizio, fine - inizio);

        Assert.Contains("RecordConFotoNelPacchetto(result.records)", metodo);
        Assert.Contains("recordConFoto.Select(", metodo);
        Assert.DoesNotContain("result.records.Select(s => s.recordInTracciato[k_cod]", metodo);
        //Le foto extra restano quelle di tutti i record del kit.
        Assert.Contains("FotoExtraDeiRecord(result.records)", metodo);
    }
}
