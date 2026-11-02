using System.Collections.Generic;
using System.IO;
using System.Linq;
using AgenziaLib;
using Istanta.Controllers;
using Istanta.Models;
using Istanta.Utility;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// La voce "Fuori vol" del tracciato del Plugin e la rimessa in volantino. I fuori volantino li
/// raccoglie l'esportazione dell'agenzia nel punto in cui li esclude, e arrivano con la lista del
/// kit in una sezione a parte; un gruppo misto (referenze dentro e fuori) e' un dato corrotto e si
/// segnala. La rimessa in volantino scrive il campo core e i campi del cliente su tutto il gruppo.
/// La lista del kit in cache non vale piu' dopo un cambio dei dati del tracciato.
/// </summary>
public class FuoriVolantinoTracciatoTests
{
    private static string Sorgente(string relativo) =>
        File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");

    private static ArticoloInKit Articolo(string codiceGruppo, string label = "VOL") => new()
    {
        label = label,
        recordInTracciato = new Dictionary<string, object> { [GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codiceGruppo },
    };

    /* ---- la cache della lista del kit ---- */

    [Fact]
    public void La_chiave_della_cache_cambia_quando_i_dati_di_un_suo_tracciato_cambiano()
    {
        //Tracciati che nessun altro test usa: la generazione e' del processo.
        int[] tracciati = { 990001, 990002 };
        string prima = GenerazioniCacheKit.Chiave(tracciati);

        Assert.Equal(prima, GenerazioniCacheKit.Chiave(new[] { 990002, 990001 }));

        GenerazioniCacheKit.Invalida(990002);
        string dopo = GenerazioniCacheKit.Chiave(tracciati);
        Assert.NotEqual(prima, dopo);

        //Un tracciato che non c'entra non la cambia.
        GenerazioniCacheKit.Invalida(990003);
        Assert.Equal(dopo, GenerazioniCacheKit.Chiave(tracciati));

        GenerazioniCacheKit.Invalida(new[] { 990001, 990001 });
        Assert.Equal(1L, GenerazioniCacheKit.Generazione(990001));
    }

    [Fact]
    public void Chi_cambia_i_record_di_un_tracciato_invalida_la_sua_lista_in_cache()
    {
        var fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        Assert.Contains("string kitCacheId = $\"{GenerazioniCacheKit.Chiave(idsTrVincitori)}${kit.guidIdRaccoglitore}${mode}\";", fico);

        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        //Azioni sul box, Sgruppa, Raggruppa e rimessa in volantino.
        Assert.Contains("result.salvati++;\n                        //La lista del kit in cache non vale piu' per questo tracciato.\n                        GenerazioniCacheKit.Invalida(ptr.IdTracciato);", menabo);
        Assert.Contains("await this.ctx2.SaveChangesAsync();\n                //I gruppi del tracciato sono cambiati: la lista del kit in cache non vale piu'.\n                GenerazioniCacheKit.Invalida(idTracciato);", menabo);
        Assert.Contains("GenerazioniCacheKit.Invalida(_ptrList.Select(p => p.IdTracciato));", menabo);
        Assert.Contains("if (result.salvati > 0)\n                    GenerazioniCacheKit.Invalida(idTracciato);", menabo);

        //Le reimportazioni.
        Assert.Contains("_ = await ctx_2.SaveChangesAsync();\n                                //Il tracciato ha una versione nuova: la lista del kit in cache non vale piu'.\n                                GenerazioniCacheKit.Invalida(pTr.Id);", Sorgente("Istanta/Controllers/OperationsController.cs"));
        Assert.Contains("this.ctx2.SaveChanges();\n                    GenerazioniCacheKit.Invalida(tracciatiImportati);", Sorgente("Istanta/Controllers/TracciatiController.cs"));
    }

    /* ---- i fuori volantino dell'esportazione ---- */

    [Theory]
    [InlineData("AgenziaLib/Coopfi.cs", "result.esclusiFuoriVolantino.Add(tracciato[i]);")]
    [InlineData("AgenziaLib/Edro21.cs", "result.esclusiFuoriVolantino.Add(tracciato[i]);")]
    [InlineData("AgenziaLib/Famila.cs", "result.esclusiFuoriVolantino.Add(artInKit);")]
    public void L_esportazione_raccoglie_gli_esclusi_nel_ramo_stesso_in_cui_li_esclude(string file, string raccolta)
    {
        var sorgente = Sorgente(file);
        int esclusione = sorgente.IndexOf("!StatoVolantino.InVolantino(recItem, RegolaPrecedenteInVolantino)");
        Assert.True(esclusione > 0);
        int aggiunta = sorgente.IndexOf(raccolta, esclusione);
        int salto = sorgente.IndexOf("continue;", esclusione);
        //Subito prima del continue del fuori volantino, e una volta sola.
        Assert.True(aggiunta > esclusione && aggiunta < salto, "gli esclusi si raccolgono nel ramo del continue del fuori volantino");
        Assert.Equal(1, sorgente.Split(raccolta).Length - 1);
    }

    [Fact]
    public void La_lista_porta_i_fuori_volantino_dall_esportazione_fino_al_Plugin()
    {
        var fico = Sorgente("Istanta/Controllers/FicoProcessController.cs");
        Assert.Contains("resultGlobale.fuoriVolantino.AddRange(resultAgenzia.esclusiFuoriVolantino);", fico);
        Assert.Contains("if (resultAgenzia.errors != \"\" && !TuttoFuoriVolantino(resultAgenzia, recordsFiltrati.Count))", fico);
        Assert.Contains("result.fuoriVolantino.AddRange(kitResult.fuoriVolantino);", fico);

        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        Assert.Contains("result.fuoriVolantino = Ordinamento.ordinaRecordsTracciatoNew(result.fuoriVolantino, exClass);", menabo);
        Assert.Contains("result.gruppiMisti = FicoProcessController.GruppiMisti(result.records, result.fuoriVolantino);", menabo);
        //La scheda del gruppo, per spostarlo nella sezione giusta senza riscaricare la lista.
        Assert.Contains("fuoriVolantinoDellaScheda = resultAgenzia.esclusiFuoriVolantino;", menabo);
        Assert.Contains("fuoriVolantino = fuoriVolantinoDellaScheda.Select(s => new ArticoloInKit()", menabo);
    }

    [Fact]
    public void La_lista_tutta_fuori_volantino_non_e_un_errore()
    {
        TracciatoResultKit Azzerata(int esclusi) => new()
        {
            errors = "Nessun articolo",
            errorCode = ErrorCodesFico.ListaAzzerataInEsportazione,
            esclusiFuoriVolantino = Enumerable.Range(0, esclusi).Select(_ => new ArticoloInKit()).ToList(),
        };

        Assert.True(FicoProcessController.TuttoFuoriVolantino(Azzerata(3), 3));
        //Azzerata per altro (nessun primario o secondario): resta un errore.
        Assert.False(FicoProcessController.TuttoFuoriVolantino(Azzerata(2), 3));
        Assert.False(FicoProcessController.TuttoFuoriVolantino(Azzerata(0), 0));
        Assert.False(FicoProcessController.TuttoFuoriVolantino(new TracciatoResultKit { errors = "eccezione", esclusiFuoriVolantino = { new ArticoloInKit() } }, 1));
    }

    [Fact]
    public void Il_gruppo_misto_e_un_gruppo_con_referenze_dentro_e_fuori_nella_stessa_label()
    {
        var dentro = new[] { Articolo("1,2"), Articolo("3"), Articolo("5,6", "POP"), Articolo("7,8") };
        var fuori = new[] { Articolo("1,2"), Articolo("3"), Articolo("5,6"), Articolo("9,10"), Articolo("7,8"), Articolo("7,8") };

        Assert.Equal(new[] { "VOL|1,2", "VOL|7,8" }, FicoProcessController.GruppiMisti(dentro, fuori));
        Assert.Empty(FicoProcessController.GruppiMisti(new ArticoloInKit[0], fuori));
    }

    /* ---- la rimessa in volantino ---- */

    [Fact]
    public void Rimettere_in_volantino_scrive_i_campi_e_il_campo_core_e_ricorda_i_valori_di_prima()
    {
        var dato = new Dictionary<string, object>
        {
            ["tema"] = "SPRINT fuori depliant",
            [GLOBAL_VARIABLES_FICO.keyInVolantino] = false,
        };

        RimessaInVolantino.Applica(dato, new Dictionary<string, object> { [RimessaInVolantino.Chiave("tema")] = "SPRINT" });

        Assert.Equal("SPRINT", dato["tema"]);
        Assert.Equal(true, dato[GLOBAL_VARIABLES_FICO.keyInVolantino]);
        var alterazioni = Assert.IsType<Dictionary<string, object>>(dato[GLOBAL_VARIABLES.keyAlterazioni]);
        Assert.Equal("SPRINT fuori depliant", alterazioni["tema"]);
        Assert.Equal(false, alterazioni[GLOBAL_VARIABLES_FICO.keyInVolantino]);
        //Il dato riletto e' in volantino anche con la regola di Coop.
        var riletto = JsonConvert.DeserializeObject<Dictionary<string, object>>(JsonConvert.SerializeObject(dato))!;
        Assert.True(StatoVolantino.InVolantino(riletto, Coopfi.RegolaPrecedenteInVolantino));
    }

    [Fact]
    public void Le_alterazioni_tengono_il_valore_originale_e_un_campo_nuovo_parte_vuoto()
    {
        //Come le arrivano dal Dato salvato: Alterazioni e' un JObject, col tema dell'importazione.
        var dato = JsonConvert.DeserializeObject<Dictionary<string, object>>(
            "{\"tema\":\"JOLLY fuori depliant\",\"Alterazioni\":{\"tema\":\"JOLLY\"}}")!;

        RimessaInVolantino.Applica(dato, new Dictionary<string, object> { ["tema"] = "JOLLY" });

        var alterazioni = Assert.IsType<Dictionary<string, object>>(dato[GLOBAL_VARIABLES.keyAlterazioni]);
        Assert.Equal("JOLLY", alterazioni["tema"].ToString());
        Assert.Equal("", alterazioni[GLOBAL_VARIABLES_FICO.keyInVolantino]);
        Assert.Equal(true, dato[GLOBAL_VARIABLES_FICO.keyInVolantino]);
    }

    [Fact]
    public void Nelle_richieste_del_Plugin_il_punto_del_campo_si_scrive_col_dollaro()
    {
        Assert.Equal("Descrizioni.Peso", RimessaInVolantino.Chiave("Descrizioni$Peso"));
        Assert.Equal("tema", RimessaInVolantino.Chiave("tema"));
    }

    [Fact]
    public void L_endpoint_agisce_su_tutto_il_gruppo_di_un_record_della_promo_della_lavorazione()
    {
        var menabo = Sorgente("Istanta/Controllers/MenaboController.cs");
        int inizio = menabo.IndexOf("public IActionResult rimettiInVolantino(");
        Assert.True(inizio > 0);
        string corpo = menabo.Substring(inizio, menabo.IndexOf("return Ok(result);", inizio) - inizio);

        Assert.Contains("if (recordScelto.IdTracciatoNavigation.IdPromo != promo.Id)", corpo);
        Assert.Contains("GetRecordsGruppoDaRaggruppare(recordScelto.CodiceGruppo!, recordScelto.IdTracciato, recordScelto);", corpo);
        Assert.Contains("ptr.Dato = JsonConvert.SerializeObject(RimessaInVolantino.Applica(dato, campi));", corpo);
        Assert.Contains("result.error = TestoCambioNonRiuscito(result.salvati, result.totale, ex);", corpo);
        //Il percorso delle azioni sul box, che vuole un gruppo impaginato, non si usa.
        Assert.DoesNotContain("GetLavorazioneRecordConFratelli", corpo);
    }

    /* ---- la configurazione dei clienti ---- */

    private static AgenziaCustomPlugin Configurazione(string cliente) =>
        JsonConvert.DeserializeObject<AgenziaCustomPlugin>(
            File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json")).TrimStart('﻿'))!;

    [Fact]
    public void Coop_abilita_Fuori_vol_con_la_regola_del_tema_le_altre_agenzie_no()
    {
        var coop = Configurazione("Coopfi").fuoriVolantinoInTracciato;
        Assert.True(coop.abilitato);
        var regola = Assert.Single(coop.regole);
        Assert.Equal(new[] { "tema" }, regola.campi);
        var condizione = Assert.Single(Assert.Single(regola.condizione).Regole);
        Assert.Equal("tema", condizione.Campo);
        Assert.Equal(OperatoreCondizione.Contains, condizione.Operatore);
        Assert.Equal("fuori depliant", condizione.Value);

        Assert.False(Configurazione("Edro21").fuoriVolantinoInTracciato.abilitato);
        Assert.False(Configurazione("Famila").fuoriVolantinoInTracciato.abilitato);
    }

    //Gli stessi casi del test del Plugin (tests/plugin/fuoriVolantino.test.js), che valuta la regola
    //del JSON: devono dire fuori volantino esattamente quando lo dice Coopfi.InVolantinoDaTema.
    [Theory]
    [InlineData("FUORI DEPLIANT", false)]
    [InlineData("SPRINT fuori depliant", false)]
    [InlineData("Fuori Depliant - ortofrutta", false)]
    [InlineData("SPRINT", true)]
    [InlineData("", true)]
    public void La_regola_del_Plugin_e_quella_di_Coop_su_gli_stessi_casi(string tema, bool inVolantino)
    {
        var condizione = Configurazione("Coopfi").fuoriVolantinoInTracciato.regole[0].condizione[0].Regole[0];
        //Contains del Plugin: senza distinguere maiuscole e minuscole.
        bool regolaDelPlugin = tema.ToLowerInvariant().Contains(condizione.Value.ToLowerInvariant());
        Assert.Equal(!inVolantino, regolaDelPlugin);
        Assert.Equal(inVolantino, Coopfi.InVolantinoDaTema(tema));
    }
}
