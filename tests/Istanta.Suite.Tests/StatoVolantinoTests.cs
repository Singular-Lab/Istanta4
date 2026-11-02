using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using AgenziaLib;
using Istanta.Models;
using IstantaLib;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// Lo stato in volantino / fuori volantino come campo core (Referenza.InVolantino). Prima ogni
/// agenzia lo codificava a modo suo: Edro21 con tipo_volantino (F e O fuori), Coop accodando
/// "fuori depliant" al tema, Famila con tipo_offerta "SS". Ora l'importazione dell'agenzia decide
/// il campo, se non decide vale "in volantino", e chi legge usa il campo se c'e' e altrimenti la
/// regola di prima: le liste importate prima del campo non cambiano comportamento. L'azione
/// "Metti fuori volantino" scrive solo il campo.
/// </summary>
public class StatoVolantinoTests
{
    private const string Chiave = "Referenza.InVolantino";

    private static Dictionary<string, object> Record(params (string chiave, object valore)[] campi)
    {
        var record = new Dictionary<string, object>();
        foreach (var (chiave, valore) in campi)
        {
            record[chiave] = valore;
        }
        return record;
    }

    private static string Sorgente(string relativo)
    {
        return File.ReadAllText(DllAgenziaLibTests.TrovaFile(relativo)).Replace("\r", "");
    }

    /* ---- il campo core ---- */

    [Fact]
    public void La_chiave_core_e_la_stessa_nel_core_e_in_AgenziaLib()
    {
        Assert.Equal(Chiave, GLOBAL_VARIABLES_FICO.keyInVolantino);
        Assert.Equal(Chiave, AgenziaLib.Tipi.GLOBAL_VARIABLES.keyInVolantino);
    }

    [Fact]
    public void Senza_campo_e_senza_regola_precedente_la_referenza_e_in_volantino()
    {
        Assert.Null(StatoVolantino.Leggi(Record()));
        Assert.True(StatoVolantino.InVolantino(Record()));
        Assert.True(StatoVolantino.InVolantino(null!));
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    [InlineData("false", false)]
    [InlineData("False", false)]
    [InlineData(" true ", true)]
    [InlineData("TRUE", true)]
    public void Il_campo_si_legge_da_bool_e_da_testo(object valore, bool atteso)
    {
        Assert.Equal(atteso, StatoVolantino.Leggi(Record((Chiave, valore))));
        Assert.Equal(atteso, StatoVolantino.Leggi(Record((Chiave, new JValue(valore)))));
    }

    [Fact]
    public void Il_campo_sopravvive_al_giro_nel_Dato_del_record()
    {
        foreach (bool valore in new[] { true, false })
        {
            var salvato = JsonConvert.SerializeObject(Record((Chiave, valore)));
            var riletto = JsonConvert.DeserializeObject<Dictionary<string, object>>(salvato)!;
            Assert.Equal(valore, StatoVolantino.InVolantino(riletto, r => !valore));
        }
    }

    [Fact]
    public void Con_il_campo_vale_il_campo_anche_contro_la_regola_precedente()
    {
        Assert.False(StatoVolantino.InVolantino(Record((Chiave, "false")), r => true));
        Assert.True(StatoVolantino.InVolantino(Record((Chiave, true)), r => false));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("boh")]
    public void Senza_un_campo_leggibile_vale_la_regola_precedente(string? valore)
    {
        var record = valore == null ? Record() : Record((Chiave, valore));
        Assert.False(StatoVolantino.InVolantino(record, r => false));
        Assert.True(StatoVolantino.InVolantino(record, r => true));
    }

    [Fact]
    public void Il_predefinito_mette_in_volantino_solo_chi_non_ha_deciso()
    {
        var senza = Record();
        var nullo = Record((Chiave, null!));
        var vuoto = Record((Chiave, " "));
        var fuori = Record((Chiave, false));
        var fuoriTesto = Record((Chiave, "false"));
        var illeggibile = Record((Chiave, "boh"));

        foreach (var r in new[] { senza, nullo, vuoto, fuori, fuoriTesto, illeggibile })
        {
            StatoVolantino.ApplicaPredefinito(r);
        }

        Assert.Equal(true, senza[Chiave]);
        Assert.Equal(true, nullo[Chiave]);
        Assert.Equal(true, vuoto[Chiave]);
        Assert.Equal(false, fuori[Chiave]);
        Assert.Equal("false", fuoriTesto[Chiave]);
        //Quello che l'agenzia ha scritto resta: in lettura vale la regola precedente.
        Assert.Equal("boh", illeggibile[Chiave]);
        StatoVolantino.ApplicaPredefinito(null!);
    }

    /* ---- il revisore ---- */

    private static ACcomuni AC(string area, string canale = "SC", string label = "VOL") =>
        new ACcomuni { NomeAC = canale + area, area = area, canale = canale, label = label };

    private static q_records_per_getListaRevisione Origine(string codice, string area, Dictionary<string, object> dato, string canale = "SC", string label = "VOL")
    {
        dato[GLOBAL_VARIABLES_FICO.keyRefCodice] = codice;
        return new q_records_per_getListaRevisione { Dato = dato, Area = area, Canale = canale, Label = label };
    }

    private static q_records_per_getListaRevisione Singolo(string codice, List<ACcomuni> ac) => new()
    {
        Dato = new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = codice,
            [GLOBAL_VARIABLES_FICO.keyACComuni] = ac,
        },
    };

    private static q_records_per_getListaRevisione Gruppo(string codici, List<ACcomuni> ac) => new()
    {
        isGruppo = true,
        Dato = new Dictionary<string, object>
        {
            [GLOBAL_VARIABLES_FICO.keyRefCodice] = codici.Split(',')[0],
            [GLOBAL_VARIABLES_FICO.keyCodiceGruppo] = codici,
            [GLOBAL_VARIABLES_FICO.keyACComuni] = ac,
        },
    };

    [Fact]
    public void Il_revisore_da_lo_stato_di_ogni_area_e_il_gruppo_e_dentro_solo_se_lo_sono_tutti()
    {
        var acA = new List<ACcomuni> { AC("TO"), AC("FI") };
        var acB = new List<ACcomuni> { AC("TO"), AC("FI") };
        var acGruppo = new List<ACcomuni> { AC("TO"), AC("FI") };
        var revisione = new List<q_records_per_getListaRevisione>
        {
            Singolo("A", acA), Singolo("B", acB), Gruppo("A,B", acGruppo),
        };
        var origine = new List<q_records_per_getListaRevisione>
        {
            Origine("A", "TO", Record((Chiave, true))),
            Origine("A", "FI", Record((Chiave, true))),
            Origine("B", "TO", Record((Chiave, true))),
            Origine("B", "FI", Record((Chiave, "false"))),
        };

        StatoVolantino.CalcolaInVolRevisione(revisione, origine, r => StatoVolantino.InVolantino(r), inVolSeManca: true);

        Assert.True(acA.All(a => a.InVol));
        Assert.True(acB.Single(a => a.area == "TO").InVol);
        Assert.False(acB.Single(a => a.area == "FI").InVol);
        Assert.True(acGruppo.Single(a => a.area == "TO").InVol);
        Assert.False(acGruppo.Single(a => a.area == "FI").InVol);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Senza_il_record_d_origine_decide_l_agenzia(bool inVolSeManca)
    {
        var ac = new List<ACcomuni> { AC("TO") };
        var revisione = new List<q_records_per_getListaRevisione> { Singolo("A", ac) };

        StatoVolantino.CalcolaInVolRevisione(revisione, new List<q_records_per_getListaRevisione>(), r => true, inVolSeManca);

        Assert.Equal(inVolSeManca, ac[0].InVol);
    }

    [Fact]
    public void Un_record_senza_codice_non_ferma_il_revisore()
    {
        var ac = new List<ACcomuni> { AC("TO") };
        var senzaCodice = new q_records_per_getListaRevisione
        {
            Dato = new Dictionary<string, object> { [GLOBAL_VARIABLES_FICO.keyACComuni] = ac },
        };
        var origineSenzaCodice = new q_records_per_getListaRevisione { Dato = new Dictionary<string, object>(), Area = "TO", Canale = "SC", Label = "VOL" };

        var esito = StatoVolantino.CalcolaInVolRevisione(
            new List<q_records_per_getListaRevisione> { senzaCodice },
            new List<q_records_per_getListaRevisione> { origineSenzaCodice },
            r => true, inVolSeManca: false);

        Assert.Single(esito);
        Assert.Empty(StatoVolantino.CalcolaInVolRevisione(null!, null!, r => true, true));
    }

    /* ---- Edro21: tipo_volantino ---- */

    [Theory]
    [InlineData("V - Volantino", true)]
    [InlineData("v - volantino", true)]
    [InlineData("F - Fuori Volantino", false)]
    [InlineData("f - fuori volantino", false)]
    //Opportunita' e' fuori, come la escludeva esportaVolantino.
    [InlineData("O - Opportunità", false)]
    [InlineData("o - opportunita", false)]
    [InlineData("", true)]
    [InlineData(null, true)]
    public void Edro21_decide_dal_tipo_volantino(string? tipoVolantino, bool atteso)
    {
        Assert.Equal(atteso, Edro21.InVolantinoDaTipoVolantino(tipoVolantino));
    }

    [Fact]
    public void Edro21_lista_vecchia_usa_tipo_volantino_e_il_campo_core_prevale()
    {
        Assert.False(StatoVolantino.InVolantino(Record(("tipo_volantino", "F - Fuori Volantino")), Edro21.RegolaPrecedenteInVolantino));
        Assert.True(StatoVolantino.InVolantino(Record(("tipo_volantino", "V - Volantino")), Edro21.RegolaPrecedenteInVolantino));
        Assert.True(StatoVolantino.InVolantino(Record(), Edro21.RegolaPrecedenteInVolantino));
        Assert.True(StatoVolantino.InVolantino(Record(("tipo_volantino", "F - Fuori Volantino"), (Chiave, true)), Edro21.RegolaPrecedenteInVolantino));
    }

    [Fact]
    public void Edro21_revisore_lista_vecchia_fuori_e_record_mancante_fuori_come_prima()
    {
        var acTO = new List<ACcomuni> { AC("TO"), AC("FI") };
        var revisione = new List<q_records_per_getListaRevisione> { Singolo("A", acTO) };
        var origine = new List<q_records_per_getListaRevisione>
        {
            Origine("A", "TO", Record(("tipo_volantino", "F - Fuori Volantino"))),
        };

        new Edro21().specificaInOutVol(revisione, origine);

        Assert.False(acTO.Single(a => a.area == "TO").InVol);
        //Nessun record d'origine per FI: fuori, come prima del campo core.
        Assert.False(acTO.Single(a => a.area == "FI").InVol);
    }

    /* ---- Coop: tema "fuori depliant" ---- */

    [Theory]
    [InlineData("FUORI DEPLIANT", false)]
    [InlineData("SPRINT fuori depliant", false)]
    [InlineData("Fuori Depliant - ortofrutta", false)]
    [InlineData("SPRINT", true)]
    [InlineData("", true)]
    [InlineData(null, true)]
    public void Coop_decide_dal_tema(string? tema, bool atteso)
    {
        Assert.Equal(atteso, Coopfi.InVolantinoDaTema(tema));
    }

    [Fact]
    public void Coop_lista_vecchia_usa_il_tema_e_il_campo_core_prevale()
    {
        Assert.False(StatoVolantino.InVolantino(Record(("tema", "SPRINT fuori depliant")), Coopfi.RegolaPrecedenteInVolantino));
        Assert.True(StatoVolantino.InVolantino(Record(("tema", "SPRINT")), Coopfi.RegolaPrecedenteInVolantino));
        //Messa fuori dal Plugin: il tema resta pulito, decide il campo.
        Assert.False(StatoVolantino.InVolantino(Record(("tema", "SPRINT"), (Chiave, "false")), Coopfi.RegolaPrecedenteInVolantino));
    }

    [Fact]
    public void Coop_revisore_mostra_finalmente_il_fuori_vol_e_il_record_mancante_resta_dentro()
    {
        var ac = new List<ACcomuni> { AC("TO"), AC("FI"), AC("SI") };
        var revisione = new List<q_records_per_getListaRevisione> { Singolo("A", ac) };
        var origine = new List<q_records_per_getListaRevisione>
        {
            Origine("A", "TO", Record(("tema", "FUORI DEPLIANT"))),
            Origine("A", "FI", Record(("tema", "SPRINT"), (Chiave, "false"))),
        };

        new Coopfi().specificaInOutVol(revisione, origine);

        Assert.False(ac.Single(a => a.area == "TO").InVol);
        Assert.False(ac.Single(a => a.area == "FI").InVol);
        Assert.True(ac.Single(a => a.area == "SI").InVol);
    }

    [Fact]
    public void Coop_Metti_fuori_volantino_scrive_solo_il_campo_core()
    {
        var azione = new Coopfi().GetCambioStrutturalePath().Single(a => a.Titolo == "Metti fuori volantino");

        var istruzione = Assert.Single(azione.Istruzioni);
        Assert.Equal("Referenza$InVolantino", istruzione.Field);
        Assert.Equal(TipoOperazione.Set, istruzione.Operazione);
        Assert.Equal("false", istruzione.Valore);
        //Il server rimette il punto (MenaboController.cambioMetaRecordInLavorazione) e il valore
        //scritto come testo si legge come fuori volantino.
        Assert.Equal(Chiave, istruzione.Field.Replace("$", "."));
        Assert.False(StatoVolantino.InVolantino(Record(("tema", "SPRINT"), (Chiave, istruzione.Valore)), Coopfi.RegolaPrecedenteInVolantino));
    }

    /* ---- Famila: tipo_offerta "SS" ---- */

    [Theory]
    [InlineData("SS", false)]
    [InlineData("PN", true)]
    //Uguale esatto come prima: "PNSS" (l'azione vecchia su "PN") non usciva.
    [InlineData("PNSS", true)]
    [InlineData("", true)]
    [InlineData(null, true)]
    public void Famila_decide_dal_tipo_offerta(string? tipoOfferta, bool atteso)
    {
        Assert.Equal(atteso, Famila.InVolantinoDaTipoOfferta(tipoOfferta));
    }

    [Fact]
    public void Famila_revisore_lista_vecchia_e_campo_core()
    {
        var ac = new List<ACcomuni> { AC("TO"), AC("FI") };
        var revisione = new List<q_records_per_getListaRevisione> { Singolo("A", ac) };
        var origine = new List<q_records_per_getListaRevisione>
        {
            Origine("A", "TO", Record(("tipo_offerta", "SS"))),
            Origine("A", "FI", Record(("tipo_offerta", "PN"), (Chiave, true))),
        };

        new Famila().specificaInOutVol(revisione, origine);

        Assert.False(ac.Single(a => a.area == "TO").InVol);
        Assert.True(ac.Single(a => a.area == "FI").InVol);
    }

    /* ---- le azioni del Plugin nei JSON dei clienti ---- */

    [Theory]
    [InlineData("Coopfi")]
    [InlineData("Famila")]
    public void Nel_JSON_del_Plugin_Metti_fuori_volantino_scrive_solo_il_campo_core(string cliente)
    {
        var json = JObject.Parse(File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json")).TrimStart('﻿'));
        var azione = json["cambiStrutturali"]!.Single(a => (string?)a["Titolo"] == "Metti fuori volantino");

        var istruzione = Assert.Single(azione["Istruzioni"]!);
        Assert.Equal("Referenza$InVolantino", (string?)istruzione["Field"]);
        Assert.Equal(0, (int)istruzione["Operazione"]!);
        Assert.Equal("false", (string?)istruzione["Valore"]);
    }

    /* ---- la pulizia liste di Coop ---- */

    [Fact]
    public void La_pulizia_liste_di_Coop_riconosce_anche_chi_e_fuori_dal_campo_core()
    {
        var json = File.ReadAllText(DllAgenziaLibTests.TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourcePuliziaListe.json"));
        var fuori = Assert.Single(JsonConvert.DeserializeObject<DbPuliziaListe>(json)!.source);

        Dictionary<string, object> Dato(string d) => PuliziaListe.LeggiDato(d)!;
        Assert.True(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"SPRINT\",\"Referenza.InVolantino\":false}"), null));
        Assert.True(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"SPRINT\",\"Referenza.InVolantino\":\"false\"}"), null));
        Assert.False(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"SPRINT\",\"Referenza.InVolantino\":true}"), null));
        Assert.False(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"SPRINT\"}"), null));
        //Le liste vecchie restano riconosciute dal tema.
        Assert.True(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"FUORI DEPLIANT\"}"), null));
    }

    /* ---- chi scrive e chi legge il campo ---- */

    // Le importazioni e le esportazioni delle agenzie hanno bisogno di file e configurazioni del
    // cliente: qui si controlla che scrivano e leggano il campo con le regole provate sopra.
    [Fact]
    public void Le_agenzie_scrivono_il_campo_all_importazione_e_lo_leggono_in_esportaVolantino()
    {
        var edro = Sorgente("AgenziaLib/Edro21.cs");
        Assert.Contains("item[GLOBAL_VARIABLES_FICO.keyInVolantino] = InVolantinoDaTipoVolantino(tipo_vol);", edro);
        Assert.Contains("bool is_fuori_volantino = !StatoVolantino.InVolantino(recItem, RegolaPrecedenteInVolantino);", edro);

        var coop = Sorgente("AgenziaLib/Coopfi.cs");
        var finaleImportCoop = coop.Substring(coop.IndexOf("public string importaTracciato("));
        finaleImportCoop = finaleImportCoop.Substring(0, finaleImportCoop.IndexOf("return JsonConvert.SerializeObject(impResult);"));
        Assert.Contains("rec[GLOBAL_VARIABLES_FICO.keyInVolantino] = RegolaPrecedenteInVolantino(rec);", finaleImportCoop);
        Assert.Contains("bool is_fuori_volantino = !StatoVolantino.InVolantino(recItem, RegolaPrecedenteInVolantino);", coop);
        Assert.DoesNotContain("Valore = \" fuori depliant\"", coop);

        var famila = Sorgente("AgenziaLib/Famila.cs");
        Assert.Contains("rec[GLOBAL_VARIABLES_FICO.keyInVolantino] = RegolaPrecedenteInVolantino(rec);", famila);
        Assert.Contains("if (!StatoVolantino.InVolantino(recItem, RegolaPrecedenteInVolantino))", famila);
        Assert.DoesNotContain("if (tipoOfferta == \"SS\")", famila);
    }

    [Fact]
    public void Il_core_mette_il_predefinito_all_importazione_e_calcola_il_revisore_prima_dell_agenzia()
    {
        Assert.Contains("StatoVolantino.ApplicaPredefinito(item);", Sorgente("Istanta/Controllers/OperationsController.cs"));
        Assert.Contains("StatoVolantino.ApplicaPredefinito(item);", Sorgente("Istanta/Controllers/TracciatiController.cs"));

        var revisore = Sorgente("Istanta/Controllers/RevisoreController.cs");
        int core = revisore.IndexOf("StatoVolantino.CalcolaInVolRevisione(tracciatoRevisione, q_records, r => StatoVolantino.InVolantino(r), inVolSeManca: true);");
        int agenzia = revisore.IndexOf(".specificaInOutVol\", objParams)");
        Assert.True(core > 0, "il revisore non calcola lo stato dal campo core");
        Assert.True(core < agenzia, "il campo core va calcolato prima che l'agenzia applichi la sua regola precedente");
        Assert.Single(Regex.Matches(revisore, "CalcolaInVolRevisione"));
    }
}
