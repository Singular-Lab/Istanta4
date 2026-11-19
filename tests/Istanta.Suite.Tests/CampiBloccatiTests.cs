using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using AgenziaLib;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1247: i cambi strutturali non si perdono piu' alla reimportazione della lista. Un cambio strutturale
/// blocca i campi che scrive (Alterazioni.Locked); un'azione sul box li lascia sbloccati solo se l'external
/// source la dichiara non bloccante (Edro21: le "Rimuovi"; Coop: nessuna). Alla reimportazione un campo
/// bloccato resta, uno sbloccato prende la lista, uno che la lista non porta resta sempre. Il report segnala
/// le forzature che hanno trattenuto un valore diverso della lista.
/// </summary>
public class CampiBloccatiTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static AgenziaCustomPlugin Configurazione(string cliente) =>
        JsonConvert.DeserializeObject<AgenziaCustomPlugin>(
            File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json")).TrimStart('﻿'))!;

    /// Il dato di un record come lo legge la reimportazione dal database: Alterazioni e' un JObject.
    private static Dictionary<string, object> Dato(string json) =>
        JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;

    private static CambioStrutturale Azione(int id, string campo, bool? locked = null)
    {
        var azione = new CambioStrutturale { Id = id, Titolo = "azione " + id, Istruzioni = new List<IstruzioneCambio> { new IstruzioneCambio { Field = campo, Valore = "x" } } };
        if (locked != null)
        {
            azione.Locked = locked.Value;
        }
        return azione;
    }

    /* ---- quali campi sblocca un'azione sul box ---- */

    [Fact]
    public void Un_azione_che_non_dichiara_Locked_blocca_i_suoi_campi()
    {
        var configurazione = new[] { Azione(1, "tema") };

        Assert.True(configurazione[0].Locked);
        Assert.Empty(CampiBloccati.CampiSbloccati("1", configurazione));
    }

    [Fact]
    public void Un_azione_dichiarata_non_bloccante_sblocca_i_suoi_campi_col_punto_al_posto_del_dollaro()
    {
        var configurazione = new[] { Azione(4, "Referenza$InVolantino", locked: false) };

        Assert.Equal(new[] { "Referenza.InVolantino" }, CampiBloccati.CampiSbloccati("4", configurazione));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("999")]
    [InlineData("abc")]
    public void Senza_Id_o_con_un_Id_sconosciuto_non_si_sblocca_niente(string? idAzioni)
    {
        var configurazione = new[] { Azione(4, "tema", locked: false) };

        Assert.Empty(CampiBloccati.CampiSbloccati(idAzioni, configurazione));
    }

    [Fact]
    public void Due_azioni_sullo_stesso_campo_vince_il_blocco()
    {
        var configurazione = new[] { Azione(1, "distintivita"), Azione(2, "distintivita", locked: false), Azione(3, "art_qual", locked: false) };

        Assert.Equal(new[] { "art_qual" }, CampiBloccati.CampiSbloccati("1, 2,3", configurazione));
    }

    [Fact]
    public void Edro21_sblocca_solo_con_le_azioni_che_tolgono_una_forzatura()
    {
        var azioni = Configurazione("Edro21").cambiStrutturali;

        Assert.Equal(new[] { 2, 6, 8, 10 }, azioni.Where(a => !a.Locked).Select(a => a.Id).OrderBy(i => i).ToArray());
        Assert.Equal(new[] { "distintivita" }, CampiBloccati.CampiSbloccati("2", azioni));
        Assert.Equal(new[] { "sconto_linea_forzato" }, CampiBloccati.CampiSbloccati("10", azioni));
        Assert.Empty(CampiBloccati.CampiSbloccati("9", azioni));
        //Forza format B&F "Nel corpo del volantino" resta una forzatura.
        Assert.Empty(CampiBloccati.CampiSbloccati("4", azioni));
    }

    [Fact]
    public void Per_Coop_e_Famila_ogni_azione_blocca_anche_le_rimozioni()
    {
        foreach (string cliente in new[] { "Coopfi", "Famila" })
        {
            var azioni = Configurazione(cliente).cambiStrutturali;
            Assert.All(azioni, a => Assert.True(a.Locked, cliente + " " + a.Titolo));
            Assert.Empty(CampiBloccati.CampiSbloccati(string.Join(",", azioni.Select(a => a.Id)), azioni));
        }
    }

    [Fact]
    public void Edro21_ha_Metti_fuori_volantino_come_Coop_e_la_riserva_dice_lo_stesso_del_JSON()
    {
        var dalSource = Configurazione("Edro21").cambiStrutturali;
        var metti = dalSource.Single(a => a.Titolo == "Metti fuori volantino");
        var diCoop = Configurazione("Coopfi").cambiStrutturali.Single(a => a.Titolo == "Metti fuori volantino");
        Assert.Equal(11, metti.Id);
        Assert.True(metti.Locked);
        Assert.Equal(diCoop.Istruzioni.Single().Field, metti.Istruzioni.Single().Field);
        Assert.Equal(diCoop.Istruzioni.Single().Valore, metti.Istruzioni.Single().Valore);
        Assert.Empty(metti.Condizione);
        //Come ogni azione di Edro21, vale solo per tutto il gruppo.
        Assert.Equal(new[] { "tutto" }, metti.OpzioniValide);

        //Le azioni della riserva in AgenziaLib bloccano come quelle del JSON con lo stesso Id.
        foreach (var dallaRiserva in new Edro21().GetCambioStrutturalePath())
        {
            var json = dalSource.Single(a => a.Id == dallaRiserva.Id);
            Assert.Equal(json.Titolo, dallaRiserva.Titolo);
            Assert.Equal(json.Locked, dallaRiserva.Locked);
        }
    }

    /* ---- il blocco nelle Alterazioni ---- */

    [Fact]
    public void Il_blocco_si_registra_accanto_alle_alterazioni_e_si_rilegge_dal_dato_salvato()
    {
        //Come le legge l'azione sul box dal Dato: con la mappa di un cambio precedente.
        var alterazioni = CampiBloccati.Alterazioni(Dato("{\"Alterazioni\":{\"tema\":\"SPRINT\",\"Locked\":{\"tema\":true}}}"));

        CampiBloccati.Registra(alterazioni, "is_linea", false);

        var riletto = CampiBloccati.Alterazioni(Dato(JsonConvert.SerializeObject(new Dictionary<string, object> { [GLOBAL_VARIABLES.keyAlterazioni] = alterazioni })));
        Assert.Equal(new Dictionary<string, bool> { ["tema"] = true, ["is_linea"] = false }, CampiBloccati.Mappa(riletto));
        Assert.Equal("SPRINT", riletto["tema"].ToString());
    }

    /* ---- la reimportazione ---- */

    [Fact]
    public void Una_forzatura_bloccata_resta_e_si_segnala_se_la_lista_porta_un_altro_valore()
    {
        var vecchio = Dato("{\"distintivita\":\" benessere\",\"prezzo_promo\":\"1,99\",\"Alterazioni\":{\"distintivita\":\"benessere\",\"Locked\":{\"distintivita\":true}}}");
        var nuovo = new Dictionary<string, object> { ["distintivita"] = "premium", ["prezzo_promo"] = "1,49" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.Equal(" benessere", nuovo["distintivita"]);
        Assert.Equal("1,49", nuovo["prezzo_promo"]);
        Assert.Equal("premium", esito.Forzature["distintivita"]);
        Assert.Equal("premium", esito.Alterazioni["distintivita"]);
        Assert.Equal(new Dictionary<string, bool> { ["distintivita"] = true }, CampiBloccati.Mappa(esito.Alterazioni));
    }

    [Fact]
    public void Una_forzatura_uguale_alla_lista_resta_senza_segnalazione()
    {
        var vecchio = Dato("{\"tema\":\"JOLLY\",\"Alterazioni\":{\"tema\":\"SPRINT\",\"Locked\":{\"tema\":true}}}");
        var nuovo = new Dictionary<string, object> { ["tema"] = "JOLLY" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.Equal("JOLLY", nuovo["tema"]);
        Assert.Empty(esito.Forzature);
        Assert.True(CampiBloccati.Mappa(esito.Alterazioni)["tema"]);
    }

    [Fact]
    public void Un_campo_sbloccato_che_la_lista_porta_prende_la_lista_ed_esce_dalla_mappa()
    {
        var vecchio = Dato("{\"distintivita\":\"benessere\",\"Alterazioni\":{\"distintivita\":\"benessere\",\"Locked\":{\"distintivita\":false}}}");
        var nuovo = new Dictionary<string, object> { ["distintivita"] = "premium" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.Equal("premium", nuovo["distintivita"]);
        Assert.Empty(esito.Alterazioni);
        Assert.Empty(esito.Forzature);
    }

    [Fact]
    public void Un_campo_che_la_lista_non_porta_resta_anche_se_sbloccato()
    {
        //"Forza Artisti Qualita'" e poi "Rimuovi forzatura Artisti Qualita'": art_qual non e' nella lista.
        var vecchio = Dato("{\"art_qual\":\"\",\"sconto_linea_forzato\":\"true\",\"Alterazioni\":{\"art_qual\":\"\",\"sconto_linea_forzato\":\"\",\"Locked\":{\"art_qual\":false,\"sconto_linea_forzato\":true}}}");
        var nuovo = new Dictionary<string, object> { ["prezzo_promo"] = "1,49" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.Equal("", nuovo["art_qual"]);
        Assert.Equal("true", nuovo["sconto_linea_forzato"]);
        Assert.Empty(esito.Forzature);
        Assert.Equal(new Dictionary<string, bool> { ["art_qual"] = false, ["sconto_linea_forzato"] = true }, CampiBloccati.Mappa(esito.Alterazioni));
    }

    [Fact]
    public void Un_record_senza_mappa_si_reimporta_come_prima()
    {
        //Cambiato prima di I20-1247: le Alterazioni non dicono cosa e' strutturale.
        var vecchio = Dato("{\"tema\":\"JOLLY\",\"art_qual\":\"true\",\"Alterazioni\":{\"tema\":\"SPRINT\"}}");
        var nuovo = new Dictionary<string, object> { ["tema"] = "SPRINT" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.Equal(new Dictionary<string, object> { ["tema"] = "SPRINT" }, nuovo);
        Assert.Empty(esito.Alterazioni);
        Assert.Empty(esito.Forzature);
    }

    [Fact]
    public void Un_campo_bloccato_conservato_non_cambia_la_data_di_modifica_ne_le_alterazioni()
    {
        var vecchio = Dato("{\"tema\":\"JOLLY\",\"prezzo_promo\":\"1,99\",\"Alterazioni\":{\"tema\":\"SPRINT\",\"Locked\":{\"tema\":true}}}");
        var nuovo = new Dictionary<string, object> { ["tema"] = "SPRINT", ["prezzo_promo"] = "1,99" };

        var esito = CampiBloccati.ApplicaAllaReimportazione(vecchio, nuovo);

        Assert.False(DateRecordTracciato.CambiatoDaImportazione(vecchio, nuovo));
        var daSalvare = CampiBloccati.AlterazioniDaSalvare(new Dictionary<string, object>(), esito);
        Assert.Equal(new[] { "tema", CampiBloccati.ChiaveLocked }, daSalvare.Keys.ToArray());
        //Registro e report non le vedono: l'importazione non ha cambiato niente.
        Assert.Null(AlterazioniImportazione.OperazioneDiRegistro(1, "1", "1", new Dictionary<string, object>()));
    }

    [Fact]
    public void Fuori_volantino_resta_fino_alla_rimessa_e_dopo_decide_la_lista()
    {
        string inVol = GLOBAL_VARIABLES_FICO.keyInVolantino;
        //"Metti fuori volantino": il campo core a false, bloccato.
        var dato = Dato("{\"tema\":\"SPRINT\",\"" + inVol + "\":false,\"Alterazioni\":{\"" + inVol + "\":true,\"Locked\":{\"" + inVol + "\":true}}}");
        var lista = new Dictionary<string, object> { ["tema"] = "SPRINT", [inVol] = true };

        var esito = CampiBloccati.ApplicaAllaReimportazione(dato, lista);
        Assert.Equal(false, lista[inVol]);
        Assert.Equal(true, esito.Forzature[inVol]);

        //Rimessa in volantino: sblocca, e la lista successiva che la da' fuori vince.
        RimessaInVolantino.Applica(dato, new Dictionary<string, object>());
        var salvato = Dato(JsonConvert.SerializeObject(dato));
        var listaFuori = new Dictionary<string, object> { ["tema"] = "SPRINT", [inVol] = false };

        var dopo = CampiBloccati.ApplicaAllaReimportazione(salvato, listaFuori);
        Assert.Equal(false, listaFuori[inVol]);
        Assert.Empty(dopo.Forzature);
        Assert.Empty(dopo.Alterazioni);
    }

    /* ---- dove si usa ---- */

    [Fact]
    public void La_reimportazione_applica_i_blocchi_prima_del_confronto_e_li_salva_nel_dato()
    {
        var operazioni = Sorgente("Istanta/Controllers/OperationsController.cs");
        int blocchi = operazioni.IndexOf("CampiBloccati.Esito bloccati = CampiBloccati.ApplicaAllaReimportazione(oldItem, item);", StringComparison.Ordinal);
        int data = operazioni.IndexOf("if (DateRecordTracciato.CambiatoDaImportazione(oldItem, item))", StringComparison.Ordinal);
        Assert.True(blocchi > 0, "i blocchi si applicano");
        Assert.True(blocchi < data, "prima della data di modifica e del confronto");
        Assert.Contains("item[GLOBAL_VARIABLES.keyAlterazioni] = CampiBloccati.AlterazioniDaSalvare(alterazioni, bloccati);", operazioni);
        Assert.Contains("item[ReportImportazione.KeyForzature] = forzature;", operazioni);
    }

    [Fact]
    public void Solo_i_cambi_strutturali_bloccano_e_il_blocco_viene_dalla_configurazione()
    {
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        Assert.Contains("HashSet<string> campiSbloccati = CampiBloccati.CampiSbloccati(act.idAzioni, SingletonConfiguration.DbPluginAgenzia?.DB?.cambiStrutturali);", menabo);
        //L'artwork passa da qui con strutturale false: non blocca.
        Assert.Matches(@"if \(strutturale\)\s*\{\s*CampiBloccati\.Registra\(alterazioniObj, kParsed, !campiSbloccati\.Contains\(kParsed\)\);", menabo);
        Assert.Contains("var op = await cambioMetaRecordInLavorazione(req, idLavorazione, idOperazione);", menabo);
    }

    [Fact]
    public void Il_confronto_delle_liste_non_conta_la_mappa_dei_blocchi_come_alterazione()
    {
        var confronti = Sorgente("Istanta/Controllers/ConfrontiController.cs");
        Assert.Contains("if (dictAlterazione!.Keys.Count(k => k != CampiBloccati.ChiaveLocked)>0)", confronti);
    }
}
