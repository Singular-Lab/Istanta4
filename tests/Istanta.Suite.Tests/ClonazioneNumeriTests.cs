using AgenziaLib;
using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1206: una referenza clonata da una promo vecchia perdeva lo sconto nel box. Il record fa il giro
/// Plugin -> JSON -> Istanta, e un decimale tondo (25.0 nel record d'origine) torna come 25: Newtonsoft
/// lo rilegge Int64, e ToDecimal di AgenziaLib vale 0 su un intero. La clonazione ora ridà il decimale
/// alle colonne decimali e di testo, e lascia intere quelle di numeri interi.
/// </summary>
public class ClonazioneNumeriTests
{
    private static SchemaCampiExcel Colonna(string nome, AddestramentoTipoValore tipo) =>
        new SchemaCampiExcel { NomeColonna = nome, NomeColonnaOriginale = nome, TipoDato = (byte)tipo };

    private static readonly List<SchemaCampiExcel> Schema = new()
    {
        Colonna("txt_sconto", AddestramentoTipoValore.Decimale),
        Colonna("prezzo_promo", AddestramentoTipoValore.Decimale),
        Colonna("prezzo_continuo", AddestramentoTipoValore.Decimale),
        Colonna("N_Punti", AddestramentoTipoValore.Numerico),
        Colonna("tema", AddestramentoTipoValore.Stringa),
        Colonna("prezzo_info_pack", AddestramentoTipoValore.Stringa),
    };

    /// Il record come lo manda il Plugin, il giro del salvataggio e la rilettura in esportazione.
    private static Dictionary<string, object> ComeLoLeggeLEsportazione(string jsonDalPlugin, bool conCorrezione)
    {
        var record = JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonDalPlugin)!;
        if (conCorrezione)
        {
            MenaboController.RipristinaDecimaliDelClone(record, Schema);
        }
        string dato = JsonConvert.SerializeObject(record);
        return JsonConvert.DeserializeObject<Dictionary<string, object>>(dato)!;
    }

    [Fact]
    public void Lo_sconto_tondo_di_un_clone_resta_lo_sconto()
    {
        var letto = ComeLoLeggeLEsportazione("{\"txt_sconto\":25,\"prezzo_promo\":2.99}", conCorrezione: true);

        Assert.Equal(25m, letto["txt_sconto"].ToDecimal());
        Assert.Equal(2.99m, letto["prezzo_promo"].ToDecimal());
    }

    [Fact]
    public void Senza_la_correzione_lo_sconto_tondo_valeva_zero()
    {
        var letto = ComeLoLeggeLEsportazione("{\"txt_sconto\":25}", conCorrezione: false);

        Assert.IsType<long>(letto["txt_sconto"]);
        Assert.Equal(0m, letto["txt_sconto"].ToDecimal());
    }

    [Fact]
    public void Un_prezzo_tondo_resta_il_prezzo()
    {
        var letto = ComeLoLeggeLEsportazione("{\"prezzo_continuo\":3}", conCorrezione: true);

        Assert.Equal(3m, letto["prezzo_continuo"].ToDecimal());
    }

    [Fact]
    public void Un_intero_in_una_colonna_di_testo_torna_decimale()
    {
        var letto = ComeLoLeggeLEsportazione("{\"prezzo_info_pack\":20}", conCorrezione: true);

        Assert.Equal(20m, letto["prezzo_info_pack"].ToDecimal());
        Assert.Equal("20", letto["prezzo_info_pack"].ToString());
    }

    [Fact]
    public void Le_colonne_di_numeri_interi_restano_intere()
    {
        var record = JsonConvert.DeserializeObject<Dictionary<string, object>>("{\"N_Punti\":5}")!;

        MenaboController.RipristinaDecimaliDelClone(record, Schema);

        Assert.Equal(5L, Assert.IsType<long>(record["N_Punti"]));
    }

    [Fact]
    public void Testi_decimali_veri_e_colonne_fuori_schema_restano_come_sono()
    {
        var record = JsonConvert.DeserializeObject<Dictionary<string, object>>(
            "{\"txt_sconto\":\"25\",\"prezzo_promo\":3.5,\"tema\":\"SPRINT\",\"fuori_schema\":7}")!;

        MenaboController.RipristinaDecimaliDelClone(record, Schema);

        Assert.Equal("25", Assert.IsType<string>(record["txt_sconto"]));
        Assert.Equal(3.5, Assert.IsType<double>(record["prezzo_promo"]));
        Assert.Equal("SPRINT", record["tema"]);
        Assert.Equal(7L, Assert.IsType<long>(record["fuori_schema"]));
    }

    [Fact]
    public void Una_colonna_senza_valore_nel_record_non_si_aggiunge()
    {
        var record = new Dictionary<string, object> { ["txt_sconto"] = 10L };

        MenaboController.RipristinaDecimaliDelClone(record, Schema);

        Assert.Single(record);
        Assert.Equal(10m, record["txt_sconto"]);
    }

    /* I20-1206, secondo giro: un codice che nella promo vecchia era in un gruppo di 17 si clona da solo
       e diventa un singolo. Il Plugin lo impaginava con il gruppo d'origine (IDX-90): ora la clonazione
       gli restituisce il codice gruppo del clone. */

    [Fact]
    public void La_risposta_della_clonazione_porta_il_codice_gruppo_del_clone()
    {
        var risposta = new RisultatoClonazione { Esito = true, codiceGruppo = "7858239" };

        //Come la scrive Istanta (AddNewtonsoftJson, nomi in camelCase).
        var impostazioni = new JsonSerializerSettings { ContractResolver = new DefaultContractResolver { NamingStrategy = new CamelCaseNamingStrategy() } };
        JObject json = JObject.Parse(JsonConvert.SerializeObject(risposta, impostazioni));

        Assert.Equal("7858239", (string?)json["codiceGruppo"]);
        Assert.True((bool)json["esito"]!);
        Assert.Equal("", (string?)json["error"]);
        Assert.IsAssignableFrom<BoolResult>(risposta);
    }

    [Fact]
    public void La_clonazione_restituisce_il_codice_gruppo_con_cui_salva_il_clone()
    {
        string controller = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/MenaboController.cs")).Replace("\r", "");
        int inizio = controller.IndexOf("public async Task<IActionResult> ClonaRecordRicollegato(");
        int fine = controller.IndexOf("[Route(\"Menabo/getCambioStrutturale\")]", inizio);
        string clonazione = controller.Substring(inizio, fine - inizio);

        Assert.Contains("RisultatoClonazione res = new RisultatoClonazione();", clonazione);
        Assert.Contains("newRecord.CodiceGruppo = codiceGruppo;", clonazione);
        Assert.Contains("res.codiceGruppo = codiceGruppo;", clonazione);
        //Dopo il salvataggio, e prima dell'impaginazione fatta da Istanta.
        Assert.True(clonazione.IndexOf("this.ctx2.SaveChanges();") < clonazione.IndexOf("res.codiceGruppo = codiceGruppo;"));
        Assert.True(clonazione.IndexOf("res.codiceGruppo = codiceGruppo;") < clonazione.IndexOf("if (dati.pagina != 0)"));
    }
}
