using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-60aaf10d: per Edro21 la foto da impaginare e' quella del tracciato (NOME_FOTO, scritto
/// senza estensione). Le liste la portano in nome_foto, ma il server guardava solo
/// Foto.SelezioneDaTracciato: vinceva la foto attiva piu' recente, e ogni versione nuova arrivata
/// da IS2 metteva in dubbio quella impaginata. L'agenzia dichiara nel SourceCustomPlugin dove sta
/// il nome e come scegliere la foto; l'operatore la cambia solo per la lavorazione, e la scelta
/// decade quando una lista nuova indica un'altra foto.
/// </summary>
public class FotoDaTracciatoEdro21Tests
{
    private static readonly AgenziaCustomPlugin_FotoDaTracciato Edro21 = new()
    {
        campi = new List<string> { "nome_foto", "Foto.SelezioneDaTracciato" },
        estensioniPreferite = new List<string> { "psd" },
        cambioSoloPerLavorazione = true,
        ereditaFotoDalPassato = false,
    };

    private static ArticoliFoto Foto(int id, string nome, int giorniFa, byte? tipo = (byte)TipoFoto.Foto, bool attiva = true) => new()
    {
        Id = id,
        IdArticolo = 1,
        NomeReale = nome,
        PathFoto = nome,
        GuidId = "g" + id,
        Hash = "h" + id,
        Tipo = tipo,
        Attiva = attiva,
        DataModifica = DateTime.Now.AddDays(-giorniFa),
    };

    [Fact]
    public void Edro21_legge_il_nome_da_nome_foto()
    {
        var record = new Dictionary<string, object> { ["nome_foto"] = " 5263850_1_AD " };

        Assert.True(FotoDaTracciato.LeggiNome(record, Edro21, out var nome));
        Assert.Equal("5263850_1_AD", nome);
    }

    [Fact]
    public void Con_nome_foto_vuoto_vale_Foto_SelezioneDaTracciato()
    {
        var record = new Dictionary<string, object> { ["nome_foto"] = "", ["Foto.SelezioneDaTracciato"] = "123_1_AD" };

        Assert.True(FotoDaTracciato.LeggiNome(record, Edro21, out var nome));
        Assert.Equal("123_1_AD", nome);
    }

    [Fact]
    public void Senza_nome_in_nessun_campo_la_lista_non_indica_foto()
    {
        var record = new Dictionary<string, object> { ["nome_foto"] = "  " };

        Assert.False(FotoDaTracciato.LeggiNome(record, Edro21, out var nome));
        Assert.Null(nome);
    }

    [Fact]
    public void Senza_configurazione_vale_la_regola_di_prima_sulla_sola_Foto_SelezioneDaTracciato()
    {
        // nome_foto non conta, e la chiave dichiara anche vuota (I20-999).
        Assert.False(FotoDaTracciato.LeggiNome(new Dictionary<string, object> { ["nome_foto"] = "123_1_AD" }, null, out _));
        Assert.True(FotoDaTracciato.LeggiNome(new Dictionary<string, object> { ["Foto.SelezioneDaTracciato"] = "" }, null, out var nome));
        Assert.Equal("", nome);
    }

    [Fact]
    public void Fra_le_foto_con_il_nome_della_lista_vince_il_psd()
    {
        var foto = new[] { Foto(1, "323456_1_AD.jpg", 0), Foto(2, "323456_1_AD.psd", 5), Foto(3, "323456_1_T5.psd", 0) };

        Assert.Equal(2, FotoDaTracciato.Scegli(foto, "323456_1_AD", Edro21.estensioniPreferite)!.Id);
    }

    [Fact]
    public void Senza_psd_vince_la_piu_recente_con_quel_nome()
    {
        var foto = new[] { Foto(1, "323456_1_AD.png", 3), Foto(2, "323456_1_AD.jpg", 1), Foto(3, "323456_1_T5.psd", 0) };

        Assert.Equal(2, FotoDaTracciato.Scegli(foto, "323456_1_AD", Edro21.estensioniPreferite)!.Id);
    }

    [Fact]
    public void Una_versione_nuova_con_un_altro_nome_non_scavalca_la_foto_della_lista()
    {
        // Il caso del cliente: la lavorazione e' impaginata con _AD, da IS2 arriva _T1 piu' recente.
        var foto = new[] { Foto(1, "5263850_1_AD.psd", 30), Foto(2, "5263850_1_T1.psd", 0) };

        Assert.Equal("5263850_1_AD.psd", FotoDaTracciato.Scegli(foto, "5263850_1_AD", Edro21.estensioniPreferite)!.NomeReale);
    }

    [Fact]
    public void Un_nome_che_contiene_quello_della_lista_non_e_la_foto_della_lista()
    {
        // Il "contiene" di prima prendeva anche AD2 o un codice piu' lungo.
        var foto = new[] { Foto(1, "323456_1_AD2.psd", 0), Foto(2, "1323456_1_AD.psd", 0) };

        Assert.Null(FotoDaTracciato.Scegli(foto, "323456_1_AD", Edro21.estensioniPreferite));
    }

    [Fact]
    public void Il_nome_si_confronta_senza_maiuscole_e_anche_con_l_estensione_nella_lista()
    {
        var foto = new[] { Foto(1, "323456_1_ad.PSD", 0) };

        Assert.Equal(1, FotoDaTracciato.Scegli(foto, "323456_1_AD", Edro21.estensioniPreferite)!.Id);
        Assert.Equal(1, FotoDaTracciato.Scegli(foto, "323456_1_AD.jpg", Edro21.estensioniPreferite)!.Id);
    }

    [Fact]
    public void Le_foto_extra_non_sono_la_foto_della_lista_e_una_foto_spenta_si()
    {
        var foto = new[] { Foto(1, "323456_1_AD.psd", 0, tipo: (byte)TipoFoto.Logo), Foto(2, "323456_1_AD.jpg", 5, attiva: false) };

        Assert.Equal(2, FotoDaTracciato.Scegli(foto, "323456_1_AD", Edro21.estensioniPreferite)!.Id);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Senza_nome_nessuna_foto(string? nome)
    {
        Assert.Null(FotoDaTracciato.Scegli(new[] { Foto(1, "323456_1_AD.psd", 0) }, nome, Edro21.estensioniPreferite));
    }

    [Fact]
    public void La_scelta_resta_se_la_lista_nuova_indica_la_stessa_foto()
    {
        Assert.True(FotoDaTracciato.SceltaDaApplicare(Edro21, "323456_1_AD", "323456_1_ad"));
    }

    [Fact]
    public void La_scelta_decade_se_la_lista_nuova_indica_un_altra_foto()
    {
        Assert.False(FotoDaTracciato.SceltaDaApplicare(Edro21, "323456_1_AD", "323456_1_CN"));
    }

    [Theory]
    [InlineData(null, "323456_1_CN")]
    [InlineData("323456_1_AD", null)]
    [InlineData("323456_1_AD", "")]
    public void La_scelta_resta_se_e_di_prima_o_se_la_lista_non_indica_foto(string? allaScelta, string? oggi)
    {
        Assert.True(FotoDaTracciato.SceltaDaApplicare(Edro21, allaScelta, oggi));
    }

    [Fact]
    public void Senza_configurazione_la_lista_non_comanda_sulle_scelte()
    {
        Assert.True(FotoDaTracciato.SceltaDaApplicare(null, "323456_1_AD", "323456_1_CN"));
    }

    [Fact]
    public void Edro21_non_eredita_la_foto_dal_passato_le_altre_agenzie_si()
    {
        Assert.False(FotoDaTracciato.FotoEreditabile(Edro21));
        Assert.True(FotoDaTracciato.FotoEreditabile(null));
        Assert.True(FotoDaTracciato.FotoEreditabile(new AgenziaCustomPlugin_FotoDaTracciato()));
    }

    [Fact]
    public void Il_SourceCustomPlugin_di_Edro21_dichiara_la_foto_da_tracciato()
    {
        var json = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"));
        var config = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json)!.fotoDaTracciato;

        Assert.NotNull(config);
        Assert.Equal(new[] { "nome_foto", "Foto.SelezioneDaTracciato" }, config.campi);
        Assert.Equal(new[] { "psd" }, config.estensioniPreferite);
        Assert.True(config.cambioSoloPerLavorazione);
        Assert.False(config.ereditaFotoDalPassato);
    }

    [Fact]
    public void Una_configurazione_senza_la_chiave_non_ha_foto_da_tracciato()
    {
        Assert.Null(JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"nomeFotoPrimaria\":\"immagine\"}")!.fotoDaTracciato);
    }

    [Fact]
    public void La_foto_caricata_solo_per_la_lavorazione_si_registra_spenta()
    {
        var fotoDellArticolo = new List<ArticoliFoto> { Foto(1, "123_1_AD.psd", 10) };
        var nuova = new ArticoliFoto { IdArticolo = 1, NomeReale = "123_nuova.psd", PathFoto = "123_nuova.psd", GuidId = "gNuova", Area = "TO", Canale = "SS", Attiva = true, StatoSelezione = (byte)StatoSelezioneFoto.Primaria };

        var registrata = RegistroFotoArticolo.PerLaSolaLavorazione(fotoDellArticolo, nuova);

        Assert.Same(nuova, registrata);
        Assert.Contains(nuova, fotoDellArticolo);
        Assert.False(registrata.Attiva);
        Assert.Equal((byte)StatoSelezioneFoto.NonSelezionata, registrata.StatoSelezione);
        // La foto dell'archivio resta com'era.
        Assert.True(fotoDellArticolo[0].Attiva);
    }

    [Fact]
    public void La_stessa_immagine_gia_in_archivio_si_usa_senza_cambiarne_lo_stato()
    {
        var esistente = Foto(1, "123_1_AD.psd", 10);
        var fotoDellArticolo = new List<ArticoliFoto> { esistente };
        var nuova = new ArticoliFoto { IdArticolo = 1, NomeReale = "copia.psd", PathFoto = "copia.psd", GuidId = esistente.GuidId };

        var registrata = RegistroFotoArticolo.PerLaSolaLavorazione(fotoDellArticolo, nuova);

        Assert.Same(esistente, registrata);
        Assert.Single(fotoDellArticolo);
        Assert.True(esistente.Attiva);
    }
}
