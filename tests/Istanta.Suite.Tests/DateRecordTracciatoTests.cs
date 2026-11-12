using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Le date di un record del tracciato: data di registrazione, data di modifica (l'ultima importazione
/// che ha cambiato il dato del tracciato) e data di modifica strutturale (l'ultimo cambio strutturale).
/// Arrivano al Plugin nel dato della lista del kit, in ora italiana al minuto, e Coop filtra il
/// tracciato e il Menabo' per la data di modifica, con il criterio data e ora.
/// </summary>
public class DateRecordTracciatoTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static string Tratto(string sorgente, string inizio, string fine)
    {
        int da = sorgente.IndexOf(inizio, StringComparison.Ordinal);
        Assert.True(da >= 0, "manca: " + inizio);
        int a = sorgente.IndexOf(fine, da + inizio.Length, StringComparison.Ordinal);
        Assert.True(a > da, "manca dopo l'inizio: " + fine);
        return sorgente.Substring(da, a - da);
    }

    private static Dictionary<string, object> Dato(string json) =>
        JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;

    /* ---- quando cambia la data di modifica ---- */

    [Fact]
    public void Un_campo_del_tracciato_con_un_valore_diverso_cambia_la_data_di_modifica()
    {
        var prima = Dato("{\"Referenza.Codice\":\"123\",\"prezzo_promo\":\"1,99\"}");
        var dopo = Dato("{\"Referenza.Codice\":\"123\",\"prezzo_promo\":\"1,49\"}");

        Assert.True(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    [Fact]
    public void La_stessa_lista_reimportata_non_cambia_la_data_di_modifica()
    {
        var prima = Dato("{\"Referenza.Codice\":\"123\",\"prezzo_promo\":\"1,99\",\"pezzi\":2,\"Descrizioni\":{\"Descrizione1\":\"Pasta\"}}");
        var dopo = Dato("{\"Referenza.Codice\":\"123\",\"prezzo_promo\":\"1,99\",\"pezzi\":2,\"Descrizioni\":{\"Descrizione1\":\"Pasta\"}}");

        Assert.False(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    // Prima di confrontare l'importazione rimette nel dato contesto e versione del tracciato: la
    // versione cambia a ogni reimportazione, e non e' un cambiamento della referenza.
    [Fact]
    public void Contesto_e_versione_che_Istanta_rimette_nel_dato_non_contano()
    {
        var prima = Dato("{\"Referenza.Codice\":\"123\",\"Tracciato.Versione\":1,\"Context.Promo\":[{\"a\":1}],\"Context.Tracciato\":[{\"b\":1}],\"Alterazioni\":{}}");
        var dopo = Dato("{\"Referenza.Codice\":\"123\",\"Tracciato.Versione\":2,\"Context.Promo\":[{\"a\":2}],\"Context.Tracciato\":[{\"b\":2}],\"Alterazioni\":{\"x\":1}}");

        Assert.False(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    [Fact]
    public void Un_campo_che_prima_non_c_era_cambia_la_data_di_modifica()
    {
        var prima = Dato("{\"Referenza.Codice\":\"123\"}");
        var dopo = Dato("{\"Referenza.Codice\":\"123\",\"tema\":\"SPRINT\"}");

        Assert.True(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    // Un campo che il dato nuovo non porta la reimportazione non lo tocca: per esempio quello che il
    // Plugin aggiunge con la sincronizzazione dal documento.
    [Fact]
    public void Un_campo_che_il_dato_nuovo_non_porta_non_conta()
    {
        var prima = Dato("{\"Referenza.Codice\":\"123\",\"SyncFromInddVol\":{\"p\":1},\"altro\":\"x\"}");
        var dopo = Dato("{\"Referenza.Codice\":\"123\"}");

        Assert.False(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    [Fact]
    public void Un_valore_annidato_diverso_cambia_la_data_di_modifica()
    {
        var prima = Dato("{\"Descrizioni\":{\"Descrizione1\":\"Pasta\"}}");
        var dopo = Dato("{\"Descrizioni\":{\"Descrizione1\":\"Pasta integrale\"}}");

        Assert.True(DateRecordTracciato.CambiatoDaImportazione(prima, dopo));
    }

    [Fact]
    public void Un_dato_di_prima_che_non_si_legge_conta_come_cambiato()
    {
        Assert.True(DateRecordTracciato.CambiatoDaImportazione(null, Dato("{\"a\":1}")));
    }

    /* ---- le date per il Plugin ---- */

    private static readonly TimeZoneInfo Roma = DateRecordTracciato.FusoItaliano()!;

    [Fact]
    public void Una_data_scritta_in_UTC_arriva_al_Plugin_in_ora_italiana()
    {
        //Il container gira in UTC: 14:05 UTC del 12 novembre (ora solare) sono le 15:05 italiane.
        Assert.Equal("12/11/2026 15:05", DateRecordTracciato.PerIlPlugin(new DateTime(2026, 11, 12, 14, 5, 59), TimeZoneInfo.Utc, Roma));
        //In estate (ora legale) le ore di differenza sono due.
        Assert.Equal("15/07/2026 10:30", DateRecordTracciato.PerIlPlugin(new DateTime(2026, 7, 15, 8, 30, 0), TimeZoneInfo.Utc, Roma));
    }

    [Fact]
    public void Una_data_scritta_gia_in_ora_italiana_non_si_sposta()
    {
        Assert.Equal("12/11/2026 09:15", DateRecordTracciato.PerIlPlugin(new DateTime(2026, 11, 12, 9, 15, 30), Roma, Roma));
    }

    [Fact]
    public void Senza_data_non_c_e_valore()
    {
        Assert.Null(DateRecordTracciato.PerIlPlugin(null, TimeZoneInfo.Utc, Roma));
    }

    [Fact]
    public void Il_dato_della_lista_del_kit_riceve_le_date_e_la_modifica_vale_la_registrazione_se_manca()
    {
        var dato = new Dictionary<string, object> { ["Referenza.Codice"] = "123" };

        DateRecordTracciato.AggiungiAlDato(dato, new DateTime(2026, 11, 12, 9, 15, 0), null, null);

        string registrazione = DateRecordTracciato.PerIlPlugin(new DateTime(2026, 11, 12, 9, 15, 0))!;
        Assert.Equal(registrazione, dato[DateRecordTracciato.ChiaveDataRegistrazione]);
        Assert.Equal(registrazione, dato[DateRecordTracciato.ChiaveDataModifica]);
        //Una data che manca non diventa una chiave: il criterio del Plugin non la trova.
        Assert.False(dato.ContainsKey(DateRecordTracciato.ChiaveDataModificaStrutturale));
    }

    /* ---- chi scrive le date ---- */

    [Fact]
    public void La_lista_del_kit_e_il_gruppo_portano_le_date_del_record()
    {
        const string aggiunta = "DateRecordTracciato.AggiungiAlDato(recordInTracciato, t.DataRegistrazione, t.DataModifica, t.DataModificaStrutturale);";
        Assert.Contains(aggiunta, Sorgente("Istanta/Controllers/FicoProcessController.cs"));
        Assert.Contains(aggiunta, Sorgente("Istanta/Controllers/MenaboController.cs"));
    }

    [Fact]
    public void L_importazione_aggiorna_la_data_di_modifica_solo_se_il_tracciato_e_cambiato()
    {
        var operazioni = Sorgente("Istanta/Controllers/OperationsController.cs");
        Assert.Contains("_rec.DataRegistrazione = DateTime.Now;\n                                    //Alla nascita la data di modifica e' quella di registrazione.\n                                    _rec.DataModifica = _rec.DataRegistrazione;", operazioni);

        //Il confronto va fatto prima del ciclo delle alterazioni, che allinea oldItem al dato nuovo.
        string aggiornamento = Tratto(operazioni, "Dictionary<string, object> oldItem = JsonConvert", "foreach (string _k in item.Keys)");
        Assert.Contains("if (DateRecordTracciato.CambiatoDaImportazione(oldItem, item))", aggiornamento);
        Assert.Contains("_rec.DataModifica = DateTime.Now;", aggiornamento);

        var tracciati = Sorgente("Istanta/Controllers/TracciatiController.cs");
        Assert.Contains("_rec.DataModifica = _rec.DataRegistrazione;", tracciati);
        Assert.Contains("newRecord.DataModifica = newRecord.DataRegistrazione;", tracciati);
        Assert.Contains("if (DateRecordTracciato.CambiatoDaImportazione(Utility.Main.getJsonObject(rec.Dato ?? \"\"), item))", tracciati);

        Assert.Contains("newRecord.DataModifica = newRecord.DataRegistrazione;", Sorgente("Istanta/Controllers/MenaboController.cs"));
    }

    // Le azioni sul box e la rimessa in volantino sono cambi strutturali; l'artwork, Raggruppa e
    // Sgruppa no.
    [Fact]
    public void Solo_i_cambi_strutturali_scrivono_la_data_di_modifica_strutturale()
    {
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");

        string set = Tratto(menabo, "public async Task<IActionResult> setCambioStrutturale(", "\n        [Http");
        Assert.Contains("cambioMetaRecordInLavorazione(obj, idLavorazione, idOperazione, true);", set);

        string pubblica = Tratto(menabo, "public async Task<IActionResult> cambioMetaRecordInLavorazione(", "private async Task<IActionResult> cambioMetaRecordInLavorazione(");
        Assert.Contains("return await cambioMetaRecordInLavorazione(obj, idLavorazione, idOperazione, false);", pubblica);

        string cambio = Tratto(menabo, "private async Task<IActionResult> cambioMetaRecordInLavorazione(", "this.ctx2.SaveChanges();\n                        //I20-1069");
        Assert.Contains("if (strutturale)\n                            {\n                                ptr.DataModificaStrutturale = DateTime.Now;", cambio);

        string artwork = Tratto(menabo, "public async Task<IActionResult> setArtwork(", "\n        [Http");
        Assert.Contains("cambioMetaRecordInLavorazione(req, idLavorazione, idOperazione);", artwork);

        string rimessa = Tratto(menabo, "public IActionResult rimettiInVolantino(", "\n        [Http");
        Assert.Contains("ptr.DataModificaStrutturale = DateTime.Now;", rimessa);

        //Gli unici che la scrivono: cambio strutturale e rimessa in volantino.
        Assert.Equal(2, menabo.Split("DataModificaStrutturale = DateTime.Now").Length - 1);
    }

    /* ---- la chiave dei filtri di Coop ---- */

    [Fact]
    public void Coop_filtra_per_data_di_modifica_con_l_orario()
    {
        var coop = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json")))!;

        var campo = Assert.Single(coop.campiFiltro, c => c.campoAssociato == DateRecordTracciato.ChiaveDataModifica);
        Assert.Equal("Data modifica", campo.nomeCampoVisualizzato);
        Assert.True(campo.isData);
        Assert.True(campo.conOrario);
        Assert.False(campo.tendina);
    }

    // Il server rilegge e riscrive la configurazione con il modello: un campo che il modello non ha
    // si perde.
    [Fact]
    public void ConOrario_sopravvive_al_salvataggio_della_configurazione()
    {
        var agenzia = JsonConvert.DeserializeObject<AgenziaCustomPlugin>("{\"campiFiltro\":[{\"campoAssociato\":\"x\",\"isData\":true,\"conOrario\":true}]}")!;
        var riletta = JObject.Parse(JsonConvert.SerializeObject(agenzia));

        Assert.True((bool)riletta["campiFiltro"]![0]!["conOrario"]!);
    }
}
