using Istanta.Controllers;
using Istanta.Models;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-300b196e: FicoProcess/getOrdinamentoMerceologico espone a Fidelity l'ordinamento
/// merceologico del cliente (SourceOrdinamentoLista.json), lo stesso che
/// Ordinamento.ordinaRecordsTracciato applica in Istanta. Il controller intero vuole database
/// e sessione: si verifica la costruzione della risposta, che e' tutta in un metodo statico.
/// </summary>
public class OrdinamentoMerceologicoTests
{
    private static JsonDbClassificazioneUniversale LeggiOrdinamento(string cartella)
    {
        string file = DllAgenziaLibTests.TrovaFile(cartella + "SourceOrdinamentoLista.json");
        string percorso = Path.GetDirectoryName(file)! + Path.DirectorySeparatorChar;
        return new ExternalSourceClass(percorso).getClassificazioneUniversale();
    }

    [Fact]
    public void Coopfi_espone_le_voci_in_ordine_con_i_campi_del_record()
    {
        var risposta = FicoProcessController.CostruisciOrdinamentoMerceologico(
            LeggiOrdinamento("Istanta/wwwroot/external_source/Coopfi/"));

        Assert.True(risposta.esito);
        Assert.True(risposta.universale);
        Assert.Equal("settore", risposta.campi.area);
        Assert.Equal("reparto", risposta.campi.settore);
        Assert.Equal("categoria", risposta.campi.reparto);
        Assert.Equal("", risposta.campi.categoria);
        Assert.NotEmpty(risposta.voci);
        Assert.Equal(risposta.voci.OrderBy(v => v.orderIndex).Select(v => v.orderIndex), risposta.voci.Select(v => v.orderIndex));

        var prima = risposta.voci[0];
        Assert.Equal("freschissimi", prima.area);
        Assert.Equal("ortofrutta", prima.settore);
    }

    [Fact]
    public void Le_voci_sono_ordinate_per_orderIndex_anche_se_il_file_non_lo_e()
    {
        var db = new JsonDbClassificazioneUniversale
        {
            universale = true,
            bindings = new ClassificazioneBinding
            {
                area = new BindingItem { campoMeta = "settore" },
                settore = new BindingItem { campoMeta = "reparto" },
                reparto = new BindingItem { campoMeta = "categoria" },
                categoria = new BindingItem(),
            },
            lista = new List<ClassificazioneUniversale>
            {
                new() { area = "freschissimi", settore = "macelleria", orderIndex = 2 },
                new() { area = "freschissimi", settore = "ortofrutta", orderIndex = 1 },
            },
        };

        var risposta = FicoProcessController.CostruisciOrdinamentoMerceologico(db);

        Assert.Equal(new[] { "ortofrutta", "macelleria" }, risposta.voci.Select(v => v.settore));
    }

    [Fact]
    public void Un_ordinamento_non_universale_non_espone_voci()
    {
        var db = new JsonDbClassificazioneUniversale
        {
            universale = false,
            bindings = new ClassificazioneBinding(),
            lista = new List<ClassificazioneUniversale> { new() { area = "x", orderIndex = 1 } },
        };

        var risposta = FicoProcessController.CostruisciOrdinamentoMerceologico(db);

        Assert.True(risposta.esito);
        Assert.False(risposta.universale);
        Assert.Empty(risposta.voci);
    }

    [Fact]
    public void Senza_file_di_ordinamento_la_risposta_e_vuota_ma_riuscita()
    {
        string cartella = Path.Combine(Path.GetTempPath(), "ordinamento-assente-" + Guid.NewGuid()) + Path.DirectorySeparatorChar;

        var risposta = FicoProcessController.CostruisciOrdinamentoMerceologico(
            new ExternalSourceClass(cartella).getClassificazioneUniversale());

        Assert.True(risposta.esito);
        Assert.False(risposta.universale);
        Assert.Empty(risposta.voci);
    }
}
