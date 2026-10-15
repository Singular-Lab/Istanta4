using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Istanta.Models;
using Istanta.Models_2;
using IstantaLib;
using Newtonsoft.Json;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1106 (Lotto 2): la pulizia delle liste. Le regole dei tipi di record usano gli operatori
/// delle etichette; nel report entrano i record che un tipo riconosce e che la lista scelta non
/// ha piu', i manuali prima; gli impaginati si vedono ma non si eliminano; l'eliminazione salta
/// chi nel frattempo e' stato impaginato. Tutto senza database: il controller passa cio' che legge.
/// </summary>
public class PuliziaListeTests
{
    private static RegolaComparazioneEtichetta R(string campo, string operatore, string value)
    {
        return new RegolaComparazioneEtichetta { campo = campo, Operatore = operatore, Value = value };
    }

    private static TipoRecordPulizia Tipo(string nome, params RegolaComparazioneEtichetta[] regoleInAnd)
    {
        return new TipoRecordPulizia { Id = 1, Nome = nome, Regole = new List<List<RegolaComparazioneEtichetta>> { regoleInAnd.ToList() } };
    }

    private static Dictionary<string, object> Dato(string json)
    {
        return PuliziaListe.LeggiDato(json)!;
    }

    private static PromoTracciatiRecord Record(long id, string codice, string dato, byte modalita = 1, string label = "VOL", byte versione = 1, string? codiceGruppo = null)
    {
        return new PromoTracciatiRecord
        {
            Id = id,
            Codice = codice,
            CodiceGruppo = codiceGruppo ?? codice,
            Label = label,
            Versione = versione,
            ModalitaInserimento = modalita,
            Dato = dato,
            IdTracciato = 10,
            Stato = 1
        };
    }

    private static RecordDaValutare DaValutare(PromoTracciatiRecord r, params string[] etichette)
    {
        return new RecordDaValutare { record = r, dato = PuliziaListe.LeggiDato(r.Dato), etichette = etichette.ToList(), tracciato = "SS" };
    }

    private static readonly Dictionary<long, Impaginazione> NessunImpaginato = new Dictionary<long, Impaginazione>();

    private static readonly Dictionary<int, string> Lavorazioni = new Dictionary<int, string>
    {
        [5] = "Volantino · P2611 TO",
        [6] = "PoP A3_VERTICALI · P2611 A3"
    };

    /* ---- gli operatori ---- */

    [Fact]
    public void IN_ignora_le_maiuscole_e_CIN_no()
    {
        Assert.True(PuliziaListe.RegolaSoddisfatta("Fuori Depliant - ortofrutta", R("tema", "IN", "fuori depliant")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("Fuori Depliant - ortofrutta", R("tema", "CIN", "fuori depliant")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("Fuori Depliant", R("tema", "CIN", "Fuori Depliant")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("PROMO SOCI ESCL", R("tema", "IN", "fuori depliant")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("PROMO SOCI ESCL", R("tema", "!IN", "fuori depliant")));
    }

    [Fact]
    public void S_toglie_gli_spazi_prima_di_confrontare()
    {
        Assert.True(PuliziaListe.RegolaSoddisfatta("fuori depliant", R("tema", "SIN", "fuoridepliant")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("Fuori Depliant", R("tema", "SC==", "FuoriDepliant")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("Fuori Depliant", R("tema", "SC==", "fuoridepliant")));
    }

    [Fact]
    public void Uguale_confronta_come_numero_quando_entrambi_lo_sono_e_come_testo_altrimenti()
    {
        Assert.True(PuliziaListe.RegolaSoddisfatta("3,50", R("prezzo", "==", "3.5")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("abc", R("x", "==", "ABC")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("abc", R("x", "C==", "ABC")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("3,50", R("prezzo", "!=", "4")));
    }

    [Fact]
    public void I_confronti_d_ordine_valgono_solo_fra_numeri()
    {
        Assert.True(PuliziaListe.RegolaSoddisfatta("10", R("n", ">", "9")));
        Assert.True(PuliziaListe.RegolaSoddisfatta("9", R("n", "<=", "9")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("b", R("n", ">", "a")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("", R("n", "<", "1")));
    }

    [Fact]
    public void Un_operatore_sconosciuto_non_e_mai_soddisfatto()
    {
        Assert.False(PuliziaListe.RegolaSoddisfatta("x", R("campo", "LIKE", "x")));
        Assert.False(PuliziaListe.RegolaSoddisfatta("x", R("campo", "", "x")));
    }

    /* ---- i campi ---- */

    [Fact]
    public void Un_campo_mancante_vale_vuoto_e_il_prefisso_delle_etichette_si_toglie()
    {
        var dato = Dato("{\"tema\":\"FUORI DEPLIANT\",\"prezzo\":3.5,\"Context.Promo\":[{\"nome_field\":\"canale\",\"user_value\":\"SS\"}]}");

        Assert.Equal("FUORI DEPLIANT", PuliziaListe.ValoreDelCampo(dato, "recordInTracciato.tema"));
        Assert.Equal("FUORI DEPLIANT", PuliziaListe.ValoreDelCampo(dato, "tema"));
        Assert.Equal("3.5", PuliziaListe.ValoreDelCampo(dato, "prezzo"));
        Assert.Equal("", PuliziaListe.ValoreDelCampo(dato, "recordInTracciato.non_esiste"));
        Assert.Equal("", PuliziaListe.ValoreDelCampo(null, "tema"));
        // Il contesto, salvato come lista di {nome_field, user_value}, si legge per nome del field.
        Assert.Equal("SS", PuliziaListe.ValoreDelCampo(dato, "recordInTracciato.Context.Promo.canale"));
        Assert.Equal("SS", PuliziaListe.ValoreDelCampo(dato, "Context.Promocanale"));
        Assert.Equal("", PuliziaListe.ValoreDelCampo(dato, "Context.Promo.area"));

        // Un campo che manca si valuta su "": !IN passa, IN no, come in Etichettatura.
        Assert.True(PuliziaListe.RegolaSoddisfatta(PuliziaListe.ValoreDelCampo(dato, "non_esiste"), R("non_esiste", "!IN", "x")));
        Assert.False(PuliziaListe.RegolaSoddisfatta(PuliziaListe.ValoreDelCampo(dato, "non_esiste"), R("non_esiste", "IN", "x")));
    }

    [Fact]
    public void DatoPerEtichettatura_toglie_le_chiavi_che_Etichettatura_aggiunge()
    {
        var dato = Dato("{\"tema\":\"x\",\"allEtichette\":[\"A\"],\"etichetteVisual\":[]}");

        var copia = PuliziaListe.DatoPerEtichettatura(dato);

        Assert.Equal(new[] { "tema" }, copia.Keys.ToArray());
        Assert.True(dato.ContainsKey("allEtichette"));   // l'originale non cambia
        Assert.Empty(PuliziaListe.DatoPerEtichettatura(null));
    }

    /* ---- i tipi ---- */

    [Fact]
    public void Un_tipo_senza_regole_non_riconosce_nulla()
    {
        var vuoto = new TipoRecordPulizia { Nome = "VUOTO" };
        var conSetVuoto = new TipoRecordPulizia { Nome = "SET VUOTO", Regole = new List<List<RegolaComparazioneEtichetta>> { new List<RegolaComparazioneEtichetta>() } };

        Assert.False(PuliziaListe.TipoCorrisponde(vuoto, Dato("{\"tema\":\"x\"}"), new List<string>()));
        Assert.False(PuliziaListe.TipoCorrisponde(conSetVuoto, Dato("{\"tema\":\"x\"}"), new List<string>()));
    }

    [Fact]
    public void Fra_i_set_vale_l_OR_e_dentro_un_set_l_AND()
    {
        var tipo = new TipoRecordPulizia
        {
            Nome = "T",
            Regole = new List<List<RegolaComparazioneEtichetta>>
            {
                new List<RegolaComparazioneEtichetta> { R("tema", "IN", "fuori"), R("reparto", "==", "ORTO") },
                new List<RegolaComparazioneEtichetta> { R("tema", "IN", "esclusiva") }
            }
        };

        Assert.True(PuliziaListe.TipoCorrisponde(tipo, Dato("{\"tema\":\"FUORI DEPLIANT\",\"reparto\":\"orto\"}"), null));
        Assert.False(PuliziaListe.TipoCorrisponde(tipo, Dato("{\"tema\":\"FUORI DEPLIANT\",\"reparto\":\"CARNE\"}"), null));
        Assert.True(PuliziaListe.TipoCorrisponde(tipo, Dato("{\"tema\":\"ESCLUSIVA SOCI\",\"reparto\":\"CARNE\"}"), null));
    }

    [Fact]
    public void Le_regole_sulle_etichette_contano_presenza_e_assenza_e_si_sommano_a_quelle_sui_campi()
    {
        var soloEtichette = new TipoRecordPulizia
        {
            Nome = "SPRINT",
            RegoleEtichette = new List<List<RegolaComparazionePerEtichetta>>
            {
                new List<RegolaComparazionePerEtichetta> { new RegolaComparazionePerEtichetta { nomeEtichetta = "SPRINT", presente = true }, new RegolaComparazionePerEtichetta { nomeEtichetta = "JOLLY", presente = false } }
            }
        };
        Assert.True(PuliziaListe.TipoCorrisponde(soloEtichette, Dato("{}"), new[] { "sprint" }));
        Assert.False(PuliziaListe.TipoCorrisponde(soloEtichette, Dato("{}"), new[] { "SPRINT", "JOLLY" }));
        Assert.False(PuliziaListe.TipoCorrisponde(soloEtichette, Dato("{}"), new List<string>()));

        var entrambe = Tipo("FUORI SPRINT", R("tema", "IN", "fuori"));
        entrambe.RegoleEtichette = soloEtichette.RegoleEtichette;
        Assert.True(PuliziaListe.TipoCorrisponde(entrambe, Dato("{\"tema\":\"fuori depliant\"}"), new[] { "SPRINT" }));
        Assert.False(PuliziaListe.TipoCorrisponde(entrambe, Dato("{\"tema\":\"fuori depliant\"}"), new List<string>()));
        Assert.False(PuliziaListe.TipoCorrisponde(entrambe, Dato("{\"tema\":\"promo soci\"}"), new[] { "SPRINT" }));
    }

    /* ---- il report ---- */

    [Fact]
    public void Il_report_esclude_i_codici_in_lista_e_mette_i_manuali_prima()
    {
        var tipi = new List<TipoRecordPulizia> { Tipo("FUORI DEPLIANT", R("recordInTracciato.tema", "IN", "fuori depliant")) };
        var records = new[]
        {
            DaValutare(Record(1, "123", "{\"tema\":\"FUORI DEPLIANT\",\"Descrizioni.Descrizione1\":\"Mele\"}", modalita: 1)),
            DaValutare(Record(2, "456", "{\"tema\":\"FUORI DEPLIANT\"}", modalita: 1)),          // ancora in lista
            DaValutare(Record(3, "789", "{\"tema\":\"PROMO SOCI\"}", modalita: 1)),              // nessun tipo
            DaValutare(Record(4, "100", "{\"tema\":\"fuori depliant bis\",\"descrizione\":\"Pere\"}", modalita: 2)), // manuale: prima
            DaValutare(Record(5, "050", "{\"tema\":\"Fuori Depliant\"}", modalita: 1, versione: 2)),
            DaValutare(Record(6, "050", "{\"tema\":\"Fuori Depliant\"}", modalita: 1, versione: 1))
        };
        var inLista = new CodiciLista(new[] { " 456 ", "999" });

        var report = PuliziaListe.ComponiReport("lista.xlsx", "VOL", tipi, records, inLista, NessunImpaginato);

        Assert.True(report.esito);
        Assert.Equal("lista.xlsx", report.nomeLista);
        Assert.Equal("VOL", report.label);
        Assert.Equal(new[] { "FUORI DEPLIANT" }, report.tipi.ToArray());
        Assert.Equal(2, report.codiciInLista);
        // Manuali prima, poi per codice, poi dalla versione piu' alta.
        Assert.Equal(new long[] { 4, 5, 6, 1 }, report.righe.Select(r => r.id).ToArray());
        Assert.True(report.righe[0].manuale);
        Assert.Equal("Pere", report.righe[0].descrizione);
        Assert.Equal("Mele", report.righe[3].descrizione);
        Assert.Equal("FUORI DEPLIANT", report.righe[3].tipo);
        Assert.Equal("FUORI DEPLIANT", report.righe[3].valoriRegole["tema"]);
        Assert.Equal("SS", report.righe[3].tracciato);
        Assert.All(report.righe, r => Assert.False(r.impaginato));
        Assert.Equal(1, report.contatori.manuali);
        Assert.Equal(3, report.contatori.daLista);
        Assert.Equal(0, report.contatori.impaginati);
        Assert.Equal(4, report.contatori.tutti);
    }

    [Fact]
    public void I_codici_della_lista_si_leggono_per_sezione_canale_area_e_tutti_insieme()
    {
        var liste = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(
            "[{\"guidCanale\":\"C1\",\"guidArea\":\"A1\",\"Records\":[{\"Referenza.Codice\":\"123\"},{\"Referenza.Codice\":\" 456\"}]}," +
            "{\"guidCanale\":\"C2\",\"guidArea\":\"A1\",\"Records\":[{\"Referenza.Codice\":\"789\"},{\"altro\":1}]}]")!;

        var codici = PuliziaListe.CodiciPerCombinazione(liste);

        Assert.Equal(3, codici.tutti.Count);
        Assert.Equal(2, codici.perCombinazione.Count);
        Assert.True(codici.InLista("C1", "A1", "456"));
        Assert.False(codici.InLista("C1", "A1", "789"));          // 789 c'e' solo nella sezione C2/A1
        Assert.True(codici.InLista("C2", "A1", "789"));
        // Una sezione che la lista non ha: si confronta con l'intera lista.
        Assert.False(codici.HaSezione("C3", "A9"));
        Assert.True(codici.InLista("C3", "A9", "789"));
        Assert.False(codici.InLista("C3", "A9", "000"));
        Assert.Equal(3, PuliziaListe.CodiciDellaLista(liste).Count);
        Assert.Empty(PuliziaListe.CodiciPerCombinazione(null).tutti);
    }

    private static PromoTracciatiRecord RecordNelTracciato(long id, string codice, string guidCanale, string guidArea, string dato = "{\"tema\":\"fuori depliant\"}")
    {
        var r = Record(id, codice, dato);
        r.IdTracciatoNavigation = new PromoTracciati { Id = 10, IdPromo = 44, guidCanale = guidCanale, guidArea = guidArea, Sigla = guidCanale + guidArea };
        return r;
    }

    // Un codice uscito dalla sezione SS ma ancora in quella TO: si segnala il record del tracciato SS, non quello di TO.
    [Fact]
    public void Un_codice_ancora_in_lista_solo_in_un_altro_canale_viene_segnalato_nel_suo()
    {
        var tipi = new List<TipoRecordPulizia> { Tipo("FUORI DEPLIANT", R("tema", "IN", "fuori depliant")) };
        var ss = RecordNelTracciato(1, "123", "SS", "A");
        var to = RecordNelTracciato(2, "123", "TO", "A");
        var records = new[] { ss, to }.Select(r => new RecordDaValutare
        {
            record = r, dato = PuliziaListe.LeggiDato(r.Dato), guidCanale = r.IdTracciatoNavigation.guidCanale, guidArea = r.IdTracciatoNavigation.guidArea, canale = r.IdTracciatoNavigation.guidCanale!, area = "A"
        });
        var codici = new CodiciLista();
        codici.Aggiungi("TO", "A", "123");
        codici.Aggiungi("SS", "A", "999");

        var report = PuliziaListe.ComponiReport("l", "VOL", tipi, records, codici, NessunImpaginato);

        var riga = Assert.Single(report.righe);
        Assert.Equal(1, riga.id);
        Assert.Equal("SS", riga.canale);
        Assert.Equal("A", riga.area);
    }

    [Fact]
    public void Il_filtro_per_canale_e_area_e_facoltativo_e_vale_anche_per_uno_solo_dei_due()
    {
        var records = new[]
        {
            RecordNelTracciato(1, "1", "SS", "A"),
            RecordNelTracciato(2, "2", "SS", "B"),
            RecordNelTracciato(3, "3", "TO", "A"),
            RecordNelTracciato(4, "4", "TO", "B")
        };

        Assert.Equal(new long[] { 1, 2, 3, 4 }, PuliziaListe.FiltraPerCanaleArea(records, null, null).Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 1, 2, 3, 4 }, PuliziaListe.FiltraPerCanaleArea(records, "", " ").Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 1, 2 }, PuliziaListe.FiltraPerCanaleArea(records, "ss", null).Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 1, 3 }, PuliziaListe.FiltraPerCanaleArea(records, null, "A").Select(r => r.Id).ToArray());
        Assert.Equal(new long[] { 4 }, PuliziaListe.FiltraPerCanaleArea(records, "TO", "B").Select(r => r.Id).ToArray());
        Assert.Empty(PuliziaListe.FiltraPerCanaleArea(records, "XX", null));
    }

    /* ---- gli impaginati e l'eliminazione ---- */

    [Fact]
    public void Gli_impaginati_si_vedono_con_il_motivo_e_l_eliminazione_li_salta()
    {
        var records = new List<PromoTracciatiRecord>
        {
            Record(1, "101", "{\"tema\":\"fuori depliant\"}", codiceGruppo: "101,102"),  // primario impaginato
            Record(2, "102", "{\"tema\":\"fuori depliant\"}", codiceGruppo: "101,102"),  // secondaria dello stesso gruppo, stessa label
            Record(3, "102", "{\"tema\":\"fuori depliant\"}", label: "POP", codiceGruppo: "101,102"), // stesso codice, altra label: libera
            Record(4, "200", "{\"tema\":\"fuori depliant\"}"),                            // nel menabo'
            Record(5, "300", "{\"tema\":\"fuori depliant\"}")                             // libero
        };
        var lavorazioni = new[] { new PromoLavorazioniRecord { Id = 900, IdLavorazione = 5, IdRecordTracciato = 1, Codice = "101", CodiceGruppo = "101,102" } };
        var labelDeiPrimari = new Dictionary<long, string?> { [1] = "VOL" };

        var impaginati = PuliziaListe.Impaginati(records, lavorazioni, labelDeiPrimari, new long[] { 4, 999 }, Lavorazioni);

        // L'avviso dice dove: la lavorazione con il suo tipo.
        Assert.Equal("impaginato in Volantino · P2611 TO", impaginati[1].motivo);
        Assert.Equal(new[] { "Volantino · P2611 TO" }, impaginati[1].lavorazioni.ToArray());
        Assert.Equal("in un gruppo impaginato in Volantino · P2611 TO", impaginati[2].motivo);
        Assert.False(impaginati.ContainsKey(3));
        Assert.Equal(PuliziaListe.MOTIVO_NEL_MENABO, impaginati[4].motivo);
        Assert.Empty(impaginati[4].lavorazioni);
        Assert.False(impaginati.ContainsKey(5));

        var tipi = new List<TipoRecordPulizia> { Tipo("FUORI DEPLIANT", R("tema", "IN", "fuori depliant")) };
        var report = PuliziaListe.ComponiReport("l", "VOL", tipi, records.Select(r => DaValutare(r)), new CodiciLista(), impaginati);
        Assert.Equal(5, report.righe.Count);
        Assert.Equal(3, report.contatori.impaginati);
        Assert.Equal(PuliziaListe.MOTIVO_NEL_MENABO, report.righe.Single(r => r.id == 4).motivoImpaginato);
        Assert.Equal("impaginato in Volantino · P2611 TO", report.righe.Single(r => r.id == 1).motivoImpaginato);
        Assert.Equal(new[] { "Volantino · P2611 TO" }, report.righe.Single(r => r.id == 1).lavorazioni.ToArray());
        Assert.Empty(report.righe.Single(r => r.id == 5).lavorazioni);

        var piano = PuliziaListe.PianificaEliminazione(new long[] { 1, 2, 3, 4, 5, 77, 5 }, records, impaginati);
        Assert.Equal(new long[] { 3, 5 }, piano.daEliminare.ToArray());
        Assert.Equal(4, piano.saltati.Count);
        Assert.Equal("impaginato in Volantino · P2611 TO", piano.saltati.Single(s => s.id == 1).motivo);
        Assert.Equal("102", piano.saltati.Single(s => s.id == 2).codice);
        Assert.Equal(PuliziaListe.MOTIVO_NON_TROVATO, piano.saltati.Single(s => s.id == 77).motivo);
    }

    [Fact]
    public void Senza_la_label_del_primario_la_secondaria_e_bloccata_dal_solo_codice()
    {
        var records = new List<PromoTracciatiRecord> { Record(2, "102", "{}", label: "POP", codiceGruppo: "101,102") };
        var lavorazioni = new[] { new PromoLavorazioniRecord { Id = 900, IdLavorazione = 5, IdRecordTracciato = 1, CodiceGruppo = "101,102" } };

        // Senza la descrizione della lavorazione 5, l'avviso dice almeno il suo numero.
        var impaginati = PuliziaListe.Impaginati(records, lavorazioni, new Dictionary<long, string?>(), Array.Empty<long>(), new Dictionary<int, string>());

        Assert.Equal("in un gruppo impaginato in lavorazione 5", impaginati[2].motivo);
    }

    [Fact]
    public void La_lavorazione_si_descrive_con_tipo_formato_e_titolo()
    {
        Assert.Equal("PoP A3_VERTICALI · P2611 A3", PuliziaListe.DescriviLavorazione(TipoLavorazione.PoP, "A3_VERTICALI", "P2611 A3", 7));
        Assert.Equal("Volantino · P2611 TO", PuliziaListe.DescriviLavorazione(TipoLavorazione.Volantino, null, " P2611 TO ", 7));
        Assert.Equal("Volantino A4", PuliziaListe.DescriviLavorazione(TipoLavorazione.Volantino, "A4", "", 7));
        // Formato sconosciuto (DBFORMATI non caricato o guid non trovato): resta il numero della lavorazione.
        Assert.Equal("lavorazione 7 · P2611", PuliziaListe.DescriviLavorazione(null, "A4", "P2611", 7));
        Assert.Equal("lavorazione 7", PuliziaListe.DescriviLavorazione(null, null, null, 7));
    }

    // Un record impaginato sia nel Volantino sia nel PoP: l'avviso le nomina tutte e due, nell'ordine.
    [Fact]
    public void Un_record_in_piu_lavorazioni_le_nomina_tutte()
    {
        var records = new List<PromoTracciatiRecord>
        {
            Record(1, "101", "{}", codiceGruppo: "101,102"),
            Record(2, "102", "{}", codiceGruppo: "101,102")
        };
        var righe = new[]
        {
            new PromoLavorazioniRecord { Id = 900, IdLavorazione = 5, IdRecordTracciato = 1, CodiceGruppo = "101,102" },
            new PromoLavorazioniRecord { Id = 901, IdLavorazione = 6, IdRecordTracciato = 1, CodiceGruppo = "101,102" },
            new PromoLavorazioniRecord { Id = 902, IdLavorazione = 6, IdRecordTracciato = 1, CodiceGruppo = "101,102" }   // due volte nella stessa: una sola voce
        };

        var impaginati = PuliziaListe.Impaginati(records, righe, new Dictionary<long, string?> { [1] = "VOL" }, Array.Empty<long>(), Lavorazioni);

        Assert.Equal("impaginato in Volantino · P2611 TO; PoP A3_VERTICALI · P2611 A3", impaginati[1].motivo);
        Assert.Equal(new[] { "Volantino · P2611 TO", "PoP A3_VERTICALI · P2611 A3" }, impaginati[1].lavorazioni.ToArray());
        Assert.Equal("in un gruppo impaginato in Volantino · P2611 TO; PoP A3_VERTICALI · P2611 A3", impaginati[2].motivo);
    }

    [Fact]
    public void L_origine_del_backup_nomina_la_pulizia_e_la_lista()
    {
        Assert.Equal("Pulizia liste: lista.xlsx (VOL)", PuliziaListe.OrigineBackup("lista.xlsx", "VOL"));
        Assert.Equal("Pulizia liste: lista.xlsx", PuliziaListe.OrigineBackup("lista.xlsx", ""));
        Assert.Equal("Pulizia liste: lista", PuliziaListe.OrigineBackup(null, null));
        Assert.StartsWith(PuliziaListe.ORIGINE_BACKUP, PuliziaListe.OrigineBackup("x", "y"));
    }

    /* ---- le regole vere di Coop ---- */

    // Il collaudo della issue e' su Coop: il tipo FUORI DEPLIANT deve prendere cio' che
    // esportaVolantino esclude dal volantino (tema con "fuori depliant"), e niente altro.
    [Fact]
    public void Le_regole_di_Coop_riconoscono_il_fuori_depliant_e_non_il_resto()
    {
        var json = File.ReadAllText(TrovaFile("Istanta/wwwroot/external_source/Coopfi/SourcePuliziaListe.json"));
        var db = JsonConvert.DeserializeObject<DbPuliziaListe>(json)!;

        var fuori = Assert.Single(db.source);
        Assert.Equal("FUORI DEPLIANT", fuori.Nome);

        Assert.True(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"Fuori Depliant - ortofrutta\"}"), new List<string>()));
        Assert.True(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"FUORI DEPLIANT\"}"), null));
        Assert.False(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"tema\":\"PROMO SOCI ESCL\"}"), null));
        Assert.False(PuliziaListe.TipoCorrisponde(fuori, Dato("{\"reparto\":\"orto\"}"), null));
    }

    // Il modello vergine e quello degli altri clienti sono vuoti ma validi: non riconoscono nulla.
    [Theory]
    [InlineData("vergine")]
    [InlineData("Edro21")]
    [InlineData("Famila")]
    [InlineData("Pac")]
    [InlineData("Trea")]
    public void Il_modello_vergine_e_gli_altri_clienti_hanno_un_file_vuoto_valido(string cartella)
    {
        var json = File.ReadAllText(TrovaFile("Istanta/wwwroot/external_source/" + cartella + "/SourcePuliziaListe.json"));

        var db = JsonConvert.DeserializeObject<DbPuliziaListe>(json)!;

        Assert.NotNull(db.source);
        Assert.Empty(db.source);
    }

    private static string TrovaFile(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
