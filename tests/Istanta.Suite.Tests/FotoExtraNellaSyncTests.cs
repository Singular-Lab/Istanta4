using Istanta.Controllers;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// SYNC FOTO: l'impaginazione piazza le foto extra di una ref dalla cartella Loghi del Plugin, ma
/// la sincronizzazione scaricava solo le foto del prodotto e l'archivio Loghi/Bolli. Un logo .ai
/// caricato come foto extra arrivava solo sulla postazione che lo aveva caricato. Ora il pacchetto
/// del kit e la lista di codici portano anche le foto extra con un file proprio, col loro tipo, e
/// il Plugin le mette nella cartella Loghi.
/// </summary>
public class FotoExtraNellaSyncTests
{
    private static LogoBollo_ExtraNoAuto Extra(int id, string guid, string nome, TipoFoto tipo, bool puntatore = false, bool attiva = true) =>
        new LogoBollo_ExtraNoAuto { id = id, guidId = guid, nome = nome, tipo = (byte)tipo, puntatore = puntatore, attiva = attiva };

    private static ArticoliFoto Foto(int id, string guid, string nome, TipoFoto? tipo, string? area = null, string? canale = null, bool puntatore = false) =>
        new ArticoliFoto { Id = id, GuidId = guid, NomeReale = nome, Tipo = tipo.HasValue ? (byte)tipo.Value : null, Area = area, Canale = canale, Attiva = true, Puntatore = puntatore };

    [Fact]
    public void Si_scaricano_le_foto_extra_con_un_file_proprio_col_loro_tipo()
    {
        var richieste = SyncFotoController.FotoExtraDaScaricare(new[]
        {
            Extra(1, "g-logo", "logo_cliente.ai", TipoFoto.Logo),
            Extra(2, "g-bollino", "bollino.psd", TipoFoto.Bollino, attiva: false),
            Extra(3, "g-archivio", "Logo_FiorFiore.psd", TipoFoto.Logo, puntatore: true),
            Extra(4, "", "senza_guid.png", TipoFoto.Logo)
        });

        //Il puntatore arriva con l'archivio Loghi/Bolli; senza guid Olimpo non ha niente da dare.
        //La disattivata si scarica: l'operatore puo' riattivarla dal Plugin.
        Assert.Equal(new[] { "g-logo", "g-bollino" }, richieste.Select(r => r.Id));
        var logo = richieste[0];
        Assert.Equal("logo_cliente.ai", logo.FileName);
        Assert.Equal("1", logo.IdRef);
        Assert.Equal(TipoFoto.Logo, logo.Tipo);
        Assert.Equal(TipoFoto.Bollino, richieste[1].Tipo);
        Assert.Empty(SyncFotoController.FotoExtraDaScaricare(null));
    }

    [Fact]
    public void Foto_Extra_del_record_si_legge_come_lista_JArray_o_stringa()
    {
        var lista = new List<LogoBollo_ExtraNoAuto> { Extra(1, "g-logo", "logo_cliente.ai", TipoFoto.Logo) };

        Assert.Same(lista, SyncFotoController.LeggiFotoExtra(lista));
        Assert.Equal("g-logo", SyncFotoController.LeggiFotoExtra(JArray.FromObject(lista))!.Single().guidId);
        Assert.Equal("g-logo", SyncFotoController.LeggiFotoExtra(JsonConvert.SerializeObject(lista))!.Single().guidId);
        Assert.Null(SyncFotoController.LeggiFotoExtra(null));
        Assert.Null(SyncFotoController.LeggiFotoExtra(""));
    }

    [Fact]
    public void Della_ref_restano_le_foto_extra_della_sua_area_e_del_suo_canale()
    {
        var foto = new[]
        {
            Foto(1, "g-prodotto", "123.psd", TipoFoto.Foto),
            Foto(2, "g-vecchia", "123_vecchia.psd", null),
            Foto(3, "g-tutti", "logo_tutti.ai", TipoFoto.Logo),
            Foto(4, "g-canale", "logo_canale.ai", TipoFoto.Logo, canale: "PoP"),
            Foto(5, "g-altro-canale", "logo_altro.ai", TipoFoto.Logo, canale: "Volantino"),
            Foto(6, "g-altra-area", "bollino_area.psd", TipoFoto.Bollino, area: "B"),
            Foto(7, "g-archivio", "Logo_FiorFiore.psd", TipoFoto.Logo, puntatore: true)
        };

        var extra = SyncFotoController.FotoExtraDellaRef(foto, "A", "PoP");

        Assert.Equal(new[] { "g-tutti", "g-canale", "g-archivio" }, extra.Select(e => e.guidId));
        Assert.True(extra.Last().puntatore);
        Assert.Equal(new[] { "g-tutti", "g-canale" }, SyncFotoController.FotoExtraDaScaricare(extra).Select(r => r.Id));
        Assert.Empty(SyncFotoController.FotoExtraDellaRef(null, "A", "PoP"));
    }

    [Fact]
    public void La_risposta_di_Olimpo_riprende_il_tipo_delle_foto_extra()
    {
        var richieste = new List<FileOlympoSync>
        {
            new FileOlympoSync { Id = "g-prodotto", FileName = "123.psd", IdRef = "1" },
            new FileOlympoSync { Id = "g-logo", FileName = "logo_cliente.ai", IdRef = "3", Tipo = TipoFoto.Logo }
        };
        //Olimpo restituisce id, nome, hash e dimensione, senza IdRef e senza tipo.
        var risposta = new List<FileOlympoSync>
        {
            new FileOlympoSync { Id = "g-prodotto", FileName = "123.psd", FileHash = "a1", Size = 10 },
            new FileOlympoSync { Id = "g-logo", FileName = "logo_cliente.ai", FileHash = "b2", Size = 20 }
        };

        var conTipo = SyncFotoController.ConTipoDelleRichieste(risposta, richieste);

        Assert.Equal((TipoFoto)0, conTipo[0].Tipo);
        Assert.Equal(TipoFoto.Logo, conTipo[1].Tipo);
        Assert.Equal("b2", conTipo[1].FileHash);
        Assert.Empty(SyncFotoController.ConTipoDelleRichieste(null, richieste));
    }

    [Fact]
    public void Il_pacchetto_del_kit_e_la_lista_di_codici_portano_le_foto_extra()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs")).Replace("\r", "");

        string kit = Tra(sorgente, "public async Task<IActionResult> getPacchettoFotoAsContract(", "public async Task<IActionResult> getFotosAsContractNew(");
        Assert.Contains("fotoRichieste.AddRange(FotoExtraDeiRecord(result.records));", kit);
        Assert.Contains("return Ok(ConTipoDelleRichieste(dataOlympo, fotoRichieste));", kit);

        string codici = Tra(sorgente, "public async Task<IActionResult> getFotosAsContractNew(", "public ArticoliFoto getFoto(");
        Assert.Contains("fotoRichieste.AddRange(FotoExtraDaScaricare(FotoExtraDellaRef(art.ArticoliFotos, area, canale)));", codici);
        Assert.Contains("result.lista = ConTipoDelleRichieste(dataOlympo, fotoRichieste);", codici);
    }

    private static ArticoloInKit Record(object? fotoExtra)
    {
        var record = new ArticoloInKit { recordInTracciato = new Dictionary<string, object>(), sottogruppo = new Dictionary<string, object>() };
        if (fotoExtra != null)
        {
            record.recordInTracciato["Foto.Extra"] = fotoExtra;
        }
        return record;
    }

    [Fact]
    public void Le_foto_extra_di_un_kit_si_raccolgono_da_tutti_i_suoi_record()
    {
        var records = new[]
        {
            Record(new List<LogoBollo_ExtraNoAuto> { Extra(1, "g-logo", "logo_cliente.ai", TipoFoto.Logo), Extra(2, "g-archivio", "Logo_FiorFiore.psd", TipoFoto.Logo, puntatore: true) }),
            Record(null),
            Record(JArray.FromObject(new List<LogoBollo_ExtraNoAuto> { Extra(3, "g-bollino", "bollino.psd", TipoFoto.Bollino) }))
        };

        var richieste = SyncFotoController.FotoExtraDeiRecord(records);

        Assert.Equal(new[] { "g-logo", "g-bollino" }, richieste.Select(r => r.Id));
        Assert.Equal(new[] { TipoFoto.Logo, TipoFoto.Bollino }, richieste.Select(r => r.Tipo));
        Assert.Empty(SyncFotoController.FotoExtraDeiRecord(null));
    }

    [Fact]
    public void La_sync_loghi_porta_le_foto_extra_della_lavorazione_solo_se_la_riceve()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/SyncFotoController.cs")).Replace("\r", "");

        string loghi = Tra(sorgente, "public async Task<IActionResult> getPacchettoLoghiBolliAsContract(int id_lavorazione = 0)", "[Route(\"SyncFoto/getInfoFoto/{guid}\")]");
        Assert.Contains("if (id_lavorazione > 0)\n            {\n                fotoRichieste.AddRange(await FotoExtraDellaLavorazione(id_lavorazione));", loghi);
        Assert.Contains("var dataOlympo = ConTipoDelleRichieste(JsonConvert.DeserializeObject<List<FileOlympoSync>>(responseBody), fotoRichieste);", loghi);

        //Un kit che non si legge non ferma la sync loghi: l'archivio arriva comunque.
        string lettura = Tra(sorgente, "private async Task<List<FileOlympoSync>> FotoExtraDellaLavorazione(int id_lavorazione)", "[HttpGet]");
        Assert.Contains("try", lettura);
        Assert.Contains("ficoController.processaKit(id_lavorazione, FicoCombinazioneKitReadMode.Advanced);", lettura);
        Assert.Contains("return FotoExtraDeiRecord(kit?.records);", lettura);
        Assert.Contains("catch (Exception ex)", lettura);
        Assert.Contains("return new List<FileOlympoSync>();", lettura);
    }

    private static string Tra(string testo, string inizio, string fine)
    {
        int da = testo.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, inizio);
        int a = testo.IndexOf(fine, da, StringComparison.Ordinal);
        Assert.True(a > da, fine);
        return testo.Substring(da, a - da);
    }
}
