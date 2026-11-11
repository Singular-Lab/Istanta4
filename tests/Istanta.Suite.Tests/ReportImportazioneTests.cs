using System.Text;
using Istanta.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-c4fdc17b: le regole del report dell'importazione che decide il server (ReportImportazione): i campi
/// esclusi dalle alterazioni, il "Salva e fai report" sulla prima versione che e' un "Salva", il CSV accanto
/// al Report.json e la risposta sullo stato dell'attivita' che dice se c'e' un report.
/// </summary>
public class ReportImportazioneTests : IDisposable
{
    private readonly string _cartella = Path.Combine(Path.GetTempPath(), "task-c4fdc17b-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_cartella))
        {
            Directory.Delete(_cartella, true);
        }
    }

    /* ---- campi esclusi ---- */

    [Fact]
    public void Una_referenza_che_cambia_solo_campi_esclusi_risulta_inalterata()
    {
        var alterazioni = new Dictionary<string, object> { ["Tracciato.Xlsx"] = "a.xlsx", ["data_estrazione"] = "01/11", ["file_immagini"] = "x" };

        var rimaste = ReportImportazione.SenzaCampiEsclusi(alterazioni, new[] { "Tracciato.Xlsx", "data_estrazione", "file_immagini" });

        Assert.Empty(rimaste);
        Assert.Equal(ReportImportazione.StatoInalterato, ReportImportazione.Stato(new Dictionary<string, object> { ["versione"] = 2, [GLOBAL_VARIABLES.keyAlterazioni] = rimaste }));
        //Il dato della referenza non cambia: le alterazioni di partenza restano.
        Assert.Equal(3, alterazioni.Count);
    }

    [Fact]
    public void Un_campo_d_interesse_cambiato_resta_fra_le_alterazioni()
    {
        var alterazioni = new Dictionary<string, object> { ["prezzo_offerta"] = "2,99", ["file_immagini"] = "x" };

        var rimaste = ReportImportazione.SenzaCampiEsclusi(alterazioni, new[] { "Tracciato.Xlsx", "data_estrazione", "file_immagini" });

        Assert.Equal(new[] { "prezzo_offerta" }, rimaste.Keys);
    }

    [Fact]
    public void Senza_campi_esclusi_si_elenca_ogni_campo_cambiato()
    {
        var alterazioni = new Dictionary<string, object> { ["file_immagini"] = "x" };

        Assert.Equal(new[] { "file_immagini" }, ReportImportazione.SenzaCampiEsclusi(alterazioni, null).Keys);
        Assert.Equal(new[] { "file_immagini" }, ReportImportazione.SenzaCampiEsclusi(alterazioni, new string[0]).Keys);
    }

    [Fact]
    public void I_campi_esclusi_si_leggono_da_SourceConfronto_e_i_campi_di_controllo_non_sono_esclusi()
    {
        var conf = JsonConvert.DeserializeObject<DbConfronto>("{\"campiDiControllo\":[{\"nome\":\"prezzo_promo\",\"rules\":[]}],\"campiEsclusiDalReport\":[\"data_estrazione\"]}")!;

        Assert.Equal(new[] { "data_estrazione" }, conf.campiEsclusiDalReport);
        //I campi di controllo dei Confronti sono quelli che contano: nel report restano.
        var rimaste = ReportImportazione.SenzaCampiEsclusi(new Dictionary<string, object> { ["prezzo_promo"] = "1,99" }, conf.campiEsclusiDalReport);
        Assert.Equal(new[] { "prezzo_promo" }, rimaste.Keys);
        //Senza la chiave nel file la lista e' vuota.
        Assert.Empty(JsonConvert.DeserializeObject<DbConfronto>("{\"campiDiControllo\":[]}")!.campiEsclusiDalReport);
    }

    [Fact]
    public void L_importazione_non_toglie_piu_dalle_alterazioni_i_campi_di_controllo()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/OperationsController.cs")).Replace("\r", "");

        Assert.DoesNotContain("foreach (DbConfrontoCampoDiControllo campo in dbConfExt.campiDiControllo)", sorgente);
        Assert.Contains("item[GLOBAL_VARIABLES.keyAlterazioni] = ReportImportazione.SenzaCampiEsclusi(alterazioni, dbConfExt.campiEsclusiDalReport);", sorgente);
    }

    /// <summary>I campi esclusi dal report come li dichiarano Edro21 e Coop nel loro SourceConfronto: il nome
    /// del file caricato cambia a ogni lista, e senza esclusione ogni referenza risulterebbe cambiata.</summary>
    [Fact]
    public void Edro21_e_Coop_escludono_dal_report_i_campi_che_cambiano_a_ogni_lista()
    {
        DbConfronto Conf(string cliente) => JsonConvert.DeserializeObject<DbConfronto>(
            File.ReadAllText(DllAgenziaLibTests.TrovaFile($"Istanta/wwwroot/external_source/{cliente}/SourceConfronto.json")))!;

        var edro = Conf("Edro21");
        var coop = Conf("Coopfi");
        Assert.Equal(new[] { "Tracciato.Xlsx", "data_estrazione", "file_immagini" }, edro.campiEsclusiDalReport);
        Assert.Equal(new[] { "Tracciato.Xlsx" }, coop.campiEsclusiDalReport);

        //Edro21: una referenza che cambia solo quei tre campi e' inalterata.
        var soloTecnici = new Dictionary<string, object> { ["Tracciato.Xlsx"] = "vecchio.xlsx", ["data_estrazione"] = "01/11", ["file_immagini"] = "a.zip" };
        Assert.Empty(ReportImportazione.SenzaCampiEsclusi(soloTecnici, edro.campiEsclusiDalReport));

        //Coop: il prezzo cambiato resta, il nome del file no.
        var conPrezzo = new Dictionary<string, object> { ["Tracciato.Xlsx"] = "vecchio.xlsx", ["prezzo_promo"] = "1,99" };
        Assert.Equal(new[] { "prezzo_promo" }, ReportImportazione.SenzaCampiEsclusi(conPrezzo, coop.campiEsclusiDalReport).Keys);

        //I campi di controllo dei Confronti restano quelli di prima.
        Assert.Equal(new[] { "tema" }, edro.campiDiControllo.Select(c => c.nome));
        Assert.Contains("prezzo_promo", coop.campiDiControllo.Select(c => c.nome));
    }

    /* ---- prima versione ---- */

    [Theory]
    [InlineData(true, true, 5, true, false)]   // Salva e fai report, prima versione ovunque: come un Salva
    [InlineData(true, true, 5, false, true)]   // Salva e fai report, versione successiva: report
    [InlineData(false, true, 5, true, true)]   // Solo report: il report c'e' anche alla prima versione
    [InlineData(true, false, 5, false, false)] // Salva: niente report
    [InlineData(true, true, 0, false, false)]  // nessuna riga
    public void Il_report_si_scrive_solo_quando_c_e_qualcosa_da_confrontare(bool persistent, bool askReport, int righe, bool primaVersione, bool atteso)
    {
        Assert.Equal(atteso, ReportImportazione.ScriveReport(persistent, askReport, righe, primaVersione));
    }

    [Fact]
    public void L_importazione_decide_il_report_con_la_prima_versione_di_ogni_tracciato()
    {
        string sorgente = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/OperationsController.cs")).Replace("\r", "");

        Assert.Contains("bool primaVersioneOvunque = true;", sorgente);
        Assert.Contains("if (versioneLab != 1)\n                            {\n                                primaVersioneOvunque = false;", sorgente);
        Assert.Contains("if (ReportImportazione.ScriveReport(pkg.persistent, pkg.askReport, _report.Count, primaVersioneOvunque))", sorgente);
        //Le tre righe del report portano l'etichetta: nuove, cambiate, uscite.
        Assert.Equal(3, sorgente.Split("[ReportImportazione.KeyEtichetta] = idLabel;").Length - 1);
    }

    [Fact]
    public void HaReport_dice_se_l_attivita_ha_un_report_da_leggere()
    {
        Directory.CreateDirectory(Path.Combine(_cartella, "42"));
        Assert.False(ReportImportazione.HaReport(_cartella + Path.DirectorySeparatorChar, 42));

        File.WriteAllText(ReportAttivita.Percorso(_cartella, 42), "[]");
        Assert.True(ReportImportazione.HaReport(_cartella, 42));

        string api = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/ApiController.cs"));
        Assert.Contains("HaReport = ReportImportazione.HaReport(this.path_to_import, (int)id)", api);
    }

    /* ---- CSV ---- */

    [Fact]
    public void Il_CSV_ha_una_riga_per_campo_alterato_con_il_valore_precedente_e_quello_attuale()
    {
        var report = new List<IDictionary<string, object>>
        {
            new Dictionary<string, object> { ["Referenza.Codice"] = "100", ["AC"] = "SSA", [ReportImportazione.KeyEtichetta] = "VOL", ["versione"] = 2,
                ["prezzo_offerta"] = "2,49", ["tema"] = "JOLLY",
                [GLOBAL_VARIABLES.keyAlterazioni] = new Dictionary<string, object> { ["prezzo_offerta"] = "2,99", ["tema"] = "SPRINT" } },
            new Dictionary<string, object> { ["Referenza.Codice"] = "101", ["AC"] = "SSA", [ReportImportazione.KeyEtichetta] = "VOL", ["versione"] = 1 },
            //Come arrivano le uscite, dal dato salvato: le alterazioni sono un JObject.
            new Dictionary<string, object> { ["Referenza.Codice"] = "103", ["AC"] = "CNA", [ReportImportazione.KeyEtichetta] = "VOL", ["versione"] = -1,
                [GLOBAL_VARIABLES.keyAlterazioni] = new JObject() }
        };

        var linee = ReportImportazione.Csv(report).TrimEnd().Split("\r\n");

        Assert.Equal(new[]
        {
            "Stato;Area/canale;Codice;Etichetta;Campo;Prima;Dopo",
            "Cambiato;SSA;100;VOL;prezzo_offerta;2,99;2,49",
            "Cambiato;SSA;100;VOL;tema;SPRINT;JOLLY",
            "Nuovo;SSA;101;VOL;;;",
            "Uscito;CNA;103;VOL;;;"
        }, linee);
    }

    [Fact]
    public void Nel_CSV_un_valore_con_il_separatore_resta_una_cella_sola()
    {
        var report = new List<IDictionary<string, object>>
        {
            new Dictionary<string, object> { ["Referenza.Codice"] = "1", ["AC"] = "A", ["versione"] = 2, ["descrizione"] = "mele; pere \"bio\"",
                [GLOBAL_VARIABLES.keyAlterazioni] = new Dictionary<string, object> { ["descrizione"] = "mele" } }
        };

        Assert.Equal("Cambiato;A;1;;descrizione;mele;\"mele; pere \"\"bio\"\"\"", ReportImportazione.Csv(report).Split("\r\n")[1]);
    }

    [Fact]
    public async Task Il_CSV_si_salva_accanto_al_Report_json_in_UTF8_con_BOM()
    {
        Directory.CreateDirectory(_cartella);
        var report = new List<IDictionary<string, object>> { new Dictionary<string, object> { ["Referenza.Codice"] = "1", ["AC"] = "A", ["versione"] = 1 } };

        await ReportImportazione.ScriviCsvAsync(_cartella, report);

        byte[] contenuto = File.ReadAllBytes(Path.Combine(_cartella, ReportImportazione.NomeFileCsv));
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, contenuto.Take(3).ToArray());
        Assert.StartsWith("Stato;Area/canale;Codice", Encoding.UTF8.GetString(contenuto, 3, contenuto.Length - 3));
    }

    /* ---- integrazione mirata ---- */

    [Fact]
    public void L_etichetta_del_report_non_finisce_nel_dato_del_record_integrato()
    {
        string tracciati = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/Controllers/TracciatiController.cs"));
        Assert.Contains("else if (key != \"AC\" && key != \"versione\" && key != ReportImportazione.KeyEtichetta)", tracciati);
    }
}
