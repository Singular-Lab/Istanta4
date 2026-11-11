using AgenziaLib;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-f434bd2f: una lista che porta lo stesso codice piu' volte con la stessa label, nello stesso canale e
/// nella stessa area, ferma l'importazione prima di salvare e l'operatore decide se annullare o continuare.
/// Il caso da cui nasce: Coop, codice 3191029 in UFI B1 con l'evento FUORI DEPLIANT FOOD e con l'evento
/// INTEGRAZIONE TERRANUOVA; Coopfi teneva la prima riga e scartava la seconda in silenzio, e il prodotto
/// restava fuori volantino. Le fusioni volute da Coop (PROMO + FIDELITY, PIU VALORE) non sono doppi.
/// </summary>
public class CodiciDoppiImportazioneTests
{
    private const string KeyCodice = "Referenza.Codice";

    private static Dictionary<string, object> Lista(string canale, string area, params string[] codici) => new()
    {
        ["Canale"] = canale,
        ["Area"] = area,
        ["Records"] = codici.Select(c => new Dictionary<string, object> { [KeyCodice] = c }).ToList()
    };

    /* ---------- CodiciDoppiImportazione.Trova: il controllo del core ---------- */

    [Fact]
    public void Una_lista_senza_codici_ripetuti_non_ha_doppi()
    {
        var doppi = CodiciDoppiImportazione.Trova(new[] { Lista("UFI", "B1", "1", "2", "3") }, "main", null, KeyCodice);

        Assert.Empty(doppi);
    }

    [Fact]
    public void Un_codice_ripetuto_nella_stessa_lista_e_doppio_con_label_canale_e_area()
    {
        var doppi = CodiciDoppiImportazione.Trova(new[] { Lista("UFI", "B1", "3191029", "2", "3191029", "3191029") }, "main", null, KeyCodice);

        var doppio = Assert.Single(doppi);
        Assert.Equal(("3191029", "main", "UFI", "B1"), (doppio.codice, doppio.label, doppio.canale, doppio.area));
    }

    [Fact]
    public void Lo_stesso_codice_in_canali_o_aree_diversi_non_e_doppio()
    {
        var doppi = CodiciDoppiImportazione.Trova(new[] { Lista("UFI", "B1", "1"), Lista("TDM", "B1", "1"), Lista("UFI", "A", "1") }, "main", null, KeyCodice);

        Assert.Empty(doppi);
    }

    [Fact]
    public void I_codici_segnalati_dall_agenzia_si_aggiungono_con_la_label_dell_importazione()
    {
        var segnalati = new[] { new CodiceDoppioInLista { codice = "3191029", canale = "UFI", area = "B1" } };

        var doppio = Assert.Single(CodiciDoppiImportazione.Trova(new[] { Lista("UFI", "B1", "3191029") }, "main", segnalati, KeyCodice));

        Assert.Equal(("3191029", "main", "UFI", "B1"), (doppio.codice, doppio.label, doppio.canale, doppio.area));
    }

    [Fact]
    public void Lo_stesso_doppio_trovato_due_volte_compare_una_volta_e_l_elenco_e_ordinato()
    {
        var segnalati = new[]
        {
            new CodiceDoppioInLista { codice = "9", canale = "UFI", area = "B1" },
            new CodiceDoppioInLista { codice = "9", canale = "UFI", area = "B1" },
            new CodiceDoppioInLista { codice = "5", canale = "TDM", area = "A" }
        };

        var doppi = CodiciDoppiImportazione.Trova(new[] { Lista("UFI", "B1", "9", "9") }, "main", segnalati, KeyCodice);

        Assert.Equal(new[] { "TDM A 5", "UFI B1 9" }, doppi.Select(d => $"{d.canale} {d.area} {d.codice}"));
    }

    [Fact]
    public void Senza_liste_e_senza_segnalazioni_non_ci_sono_doppi()
    {
        Assert.Empty(CodiciDoppiImportazione.Trova(null, "main", null, KeyCodice));
    }

    [Fact]
    public void Le_liste_come_arrivano_dall_agenzia_in_JSON_si_leggono()
    {
        //importaVolantino riceve le liste deserializzando il JSON dell'agenzia: Records e' un JArray.
        string json = JsonConvert.SerializeObject(new { errors = "", liste = new[] { Lista("UFI", "B1", "7", "7") } });
        var risultato = JsonConvert.DeserializeObject<Istanta.Models.ImportResult>(json)!;

        var doppio = Assert.Single(CodiciDoppiImportazione.Trova(risultato.liste, "main", risultato.codiciDoppi, KeyCodice));
        Assert.Equal("7", doppio.codice);
    }

    /* ---------- Coopfi: le righe doppie scartate si segnalano, le fusioni volute no ---------- */

    private static Dictionary<string, object> RigaCoop(string codice, string tema, string tipoEvento) => new()
    {
        [GLOBAL_VARIABLES_FICO.keyRefCodice] = codice,
        [GLOBAL_VARIABLES_FICO.keyDescrizione1] = "LS BOLLITO MISTO C/CAPPONE",
        [GLOBAL_VARIABLES_FICO.keyDescrizione2] = "",
        ["Descrizione_depliant"] = "PROMO 26 - DEPLIANT B1 UFI",
        ["tema"] = tema,
        ["tipo_evento"] = tipoEvento,
        ["format_1"] = "",
        ["format_2"] = "MG",
        ["Format_PdvRif"] = "MG",
        ["codice_settore"] = "10",
        ["codice_reparto"] = "20",
        ["codice_categoria"] = "152",
        ["codice_sottocategoria"] = "13",
        ["sottomarchio"] = "",
        ["prestazione"] = "",
        ["codice_UPC"] = "",
        ["inizio_promo"] = "2026-12-17",
        ["fine_promo"] = "2026-12-27",
        ["txt_sconto"] = 30,
        ["prezzo_continuo"] = 14.2,
        ["prezzo_promo"] = 9.94,
        ["prezzo_promo_kgl"] = 9.94,
        ["N_punti"] = "",
        ["N_pezzi_soci"] = "",
        ["pezzi_soci"] = ""
    };

    private static AgenziaLib.Tipi.ImportResult ImportaCoop(params Dictionary<string, object>[] righe)
    {
        string acpv = Path.Combine(Path.GetTempPath(), "acpv-" + Guid.NewGuid().ToString("N") + ".json");
        File.WriteAllText(acpv, JsonConvert.SerializeObject(new
        {
            aree = new[] { new { sigla = "B1", guidID = "area-b1" } },
            canali = new[] { new { sigla = "UFI", guidID = "canale-ufi" }, new { sigla = "TDM", guidID = "canale-tdm" } },
            combinazioni = Array.Empty<object>()
        }));
        try
        {
            string json = new Coopfi().importaTracciato(righe.ToList(), new Dictionary<string, string> { ["idLabel"] = "b1" },
                new List<FicoContextField>(), new List<FicoContextField>(), acpv, "", "", "");
            var risultato = JsonConvert.DeserializeObject<AgenziaLib.Tipi.ImportResult>(json)!;
            Assert.Equal("", risultato.errors);
            return risultato;
        }
        finally
        {
            File.Delete(acpv);
        }
    }

    [Fact]
    public void Coop_segnala_la_riga_doppia_che_scarta_il_caso_3191029()
    {
        var risultato = ImportaCoop(
            RigaCoop("3191029", "FUORI DEPLIANT FOOD (OS26B) 42UFI+17TDM+A", "FUORI VOLANTINO"),
            RigaCoop("3191029", "INTEGRAZIONE TERRANUOVA OS26B", "DEPLIANT"));

        var doppio = Assert.Single(risultato.codiciDoppi);
        Assert.Equal(("3191029", "UFI", "B1"), (doppio.codice, doppio.canale, doppio.area));
        //Il comportamento dell'importazione non cambia: resta la prima riga.
        var record = Assert.Single(Assert.Single(risultato.liste).Records);
        Assert.Equal("FUORI DEPLIANT FOOD (OS26B) 42UFI+17TDM+A", record["tema"].ToString());
    }

    [Fact]
    public void Coop_non_segnala_PROMO_e_FIDELITY_dello_stesso_codice()
    {
        var risultato = ImportaCoop(
            RigaCoop("1234567", "PROMO", "PROMO"),
            RigaCoop("1234567", "PROMO", "FIDELITY"));

        Assert.Empty(risultato.codiciDoppi);
        Assert.Equal("FIDELITY", Assert.Single(Assert.Single(risultato.liste).Records)["tipo_evento"].ToString());
    }

    [Fact]
    public void Coop_non_segnala_FIDELITY_seguito_dal_suo_PROMO()
    {
        var risultato = ImportaCoop(
            RigaCoop("1234567", "PROMO", "FIDELITY"),
            RigaCoop("1234567", "PROMO", "PROMO"));

        Assert.Empty(risultato.codiciDoppi);
    }

    [Theory]
    [InlineData("PIU VALORE SOCI")]
    [InlineData("PIU VALORE NEW SOCI")]
    public void Coop_non_segnala_le_righe_PIU_VALORE_soci(string tema)
    {
        var risultato = ImportaCoop(
            RigaCoop("1234567", "PROMO", "PROMO"),
            RigaCoop("1234567", tema, "PROMO"));

        Assert.Empty(risultato.codiciDoppi);
    }

    [Fact]
    public void Coop_segnala_due_PROMO_dello_stesso_codice()
    {
        var risultato = ImportaCoop(
            RigaCoop("1234567", "PROMO", "PROMO"),
            RigaCoop("1234567", "ALTRO", "PROMO"));

        Assert.Equal("1234567", Assert.Single(risultato.codiciDoppi).codice);
    }

    [Fact]
    public void Coop_senza_codici_ripetuti_non_segnala_niente()
    {
        var risultato = ImportaCoop(
            RigaCoop("1111111", "PROMO", "PROMO"),
            RigaCoop("2222222", "PROMO", "PROMO"));

        Assert.Empty(risultato.codiciDoppi);
        Assert.Equal(2, Assert.Single(risultato.liste).Records.Count);
    }

    /* ---------- Trea: tiene la prima riga di un codice ripetuto, ora la segnala ---------- */

    [Fact]
    public void Trea_segnala_la_riga_doppia_che_scarta()
    {
        string acpv = Path.Combine(Path.GetTempPath(), "acpv-" + Guid.NewGuid().ToString("N") + ".json");
        File.WriteAllText(acpv, JsonConvert.SerializeObject(new
        {
            aree = new[] { new { sigla = "3A", guidID = "area-3a" } },
            canali = new[] { new { sigla = "SUPER", guidID = "canale-super" } },
            combinazioni = Array.Empty<object>()
        }));
        Dictionary<string, object> Riga(string codice) => new()
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = codice, ["prestazione"] = 1, ["canale"] = "SUPER", ["copertina"] = ""
        };
        try
        {
            string json = new Trea().importaTracciato(new List<Dictionary<string, object>> { Riga("1"), Riga("1"), Riga("2") },
                new Dictionary<string, string>(), new List<FicoContextField>(), new List<FicoContextField>(), acpv, "", "", "");
            var risultato = JsonConvert.DeserializeObject<AgenziaLib.Tipi.ImportResult>(json)!;

            Assert.Equal("", risultato.errors);
            var doppio = Assert.Single(risultato.codiciDoppi);
            Assert.Equal(("1", "SUPER", "3A"), (doppio.codice, doppio.canale, doppio.area));
            Assert.Equal(2, Assert.Single(risultato.liste).Records.Count);
        }
        finally
        {
            File.Delete(acpv);
        }
    }

    /* ---------- Il percorso nell'importazione: dove si ferma e cosa resta deciso ---------- */

    private static string Sorgente(string file) => File.ReadAllText(DllAgenziaLibTests.TrovaFile(file)).Replace("\r", "");

    [Fact]
    public void L_importazione_si_ferma_sui_doppi_prima_di_salvare_e_rispetta_ignoraDoppioni()
    {
        string s = Sorgente("Istanta/Controllers/OperationsController.cs");
        int chiamata = s.IndexOf("AgenziaLib.{this._ficoClientName}.importaTracciato");
        int controllo = s.IndexOf("CodiciDoppiImportazione.Trova(parsingRes.liste, idLabel, parsingRes.codiciDoppi, keyCodiceDoppi)");
        int salvataggio = s.IndexOf("if (addestramento.salvaSuDb)");

        Assert.True(chiamata > 0 && controllo > chiamata && salvataggio > controllo);
        string blocco = s.Substring(controllo, salvataggio - controllo);
        Assert.Contains("if (codiciDoppi.Count > 0 && !pkg.ignoraDoppioni)", blocco);
        Assert.Contains("res.Attivita.Stato = (Byte)OperationStauts.InAttesaDiConfermaUtente;", blocco);
        Assert.Contains("return Ok(res);", blocco);
    }

    [Fact]
    public void Continua_non_si_annulla_con_una_conferma_successiva()
    {
        string s = Sorgente("Istanta/Controllers/ApiController.cs");
        int inizio = s.IndexOf("public async Task<IActionResult> confermaAttivitaByUtente(");
        string conferma = s.Substring(inizio, s.IndexOf("opReq.Packet = packet;", inizio) - inizio);

        Assert.Contains("[FromQuery] bool ignoraDoppioni = false", conferma);
        Assert.Contains("if (ignoraDoppioni)", conferma);
        Assert.DoesNotContain("ignoraDoppioni = false;", conferma);
    }
}
