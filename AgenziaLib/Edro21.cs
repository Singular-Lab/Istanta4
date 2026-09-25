#define OFALKG_ENALBED

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using AgenziaLib.Tipi;
using System.IO;
using System.ComponentModel;
using Microsoft.SqlServer.Server;
using System.Security.Policy;
using System.Xml;
using System.Xml.XPath;
using System.Runtime.InteropServices;
using Edro21Context;
using System.Diagnostics;
using System.Data;
using System.Security.Cryptography;
using IstantaLib;
using System.Globalization;
using IstantaLib.Utility;
using System.Runtime.CompilerServices;
//using static System.Net.WebRequestMethods;
//using System.Runtime.Remoting;

namespace Edro21Context
{
    public static class Meta
    {
        public static string referenza_pilota = "referenza_pilota";
        public static string potenziale_esempio = "potenziale_esempio";
        public static string prenotazione_pilota = "prenotazione_pilota";
        public static string meccanica_origine = "meccanica_origine";
        public static string area = "area";
        public static string gruppo_siti_stringa = "gruppo_siti_stringa";
        public static string gruppo_siti = "gruppo_siti";
        public static string tipo_volantino = "tipo_volantino";
        public static string ruolo = "ruolo";
        public static string segmento = "segmento";
        public static string fuoribanco = "fuoribanco";
        public static string distintivita = "distintivita";
        public static string localismo = "localismo";
        public static string territorialita = "territorialita";
        public static string tipo_riga = "tipo_riga";
        public static string reparto = "reparto";
        public static string nome_foto = "nome_foto";
        public static string codice_scatto = "codice_scatto";
        public static string id_pop = "id_pop";
        public static string data_da = "data_da";
        public static string data_a = "data_a";
        public static string iniziativa = "iniziativa";
        public static string tema = "tema";
        public static string ScattoCodice = "Scatto.Codice";
        public static string descrizione_iniziativa = "descrizione_iniziativa";
        public static string sconto_MM = "sconto_MM";
        public static string prezzo_offerta = "prezzo_offerta";
        public static string prezzo_offerta_kgl = "prezzo_offerta_kgl";
        public static string prezzo_offerta_secondo = "prezzo_offerta_secondo";
        public static string sconto_FID = "sconto_FID";
        public static string prezzo_offerta_secondo_kgl = "prezzo_offerta_secondo_kgl";
        public static string sezione = "sezione";
        public static string sconto_agenzia = "sconto_agenzia";
        public static string tipo_tema = "tipo_tema";
        public static string range_1 = "range_1";
        public static string range_2 = "range_2";
        public static string codice_vv = "codice_vv";
        public static string prezzo_offerta_kgl_secondo = "prezzo_offerta_kgl_secondo";
        public static string tipo_sconto_FID = "tipo_sconto_FID";
        public static string punti_1 = "punti_1";
        public static string punti_2 = "punti_2";
        public static string settore = "settore";
        public static string meccanica = "meccanica";
        public static string meccanica_tradotta = "meccanica_tradotta";
        public static string meccanica_invalidata = "meccanica_invalidata";
        public static string tipo_sconto_MM = "tipo_sconto_MM";
        public static string tipo_punti = "tipo_punti";
        public static string prezzo_anziche = "prezzo_anziche";
        public static string prezzo_anziche_kgl = "prezzo_anziche_kgl";
        public static string paghi_due_pezzi = "paghi_due_pezzi";
        public static string N_MM = "N_MM";
        public static string M_MM = "M_MM";
        public static string refs = "refs";
        public static string fuori_banco = "fuori_banco";
        public static string note_category = "note_category";
        public static string AreaCodice = "Area.Codice";
        public static string DescrizioniPeso = "Descrizioni.Peso";
        public static string ReferenzaCodice = "Referenza.Codice";
        public static string N_FID = "N_FID";
        public static string M_FID = "M_FID";
        public static string numero_settore = "numero_settore";
        public static string numero_reparto = "numero_reparto";
        public static string prezzo_offerta_um_com = "prezzo_offerta_um_com";
        public static string prezzo_anziche_um_com = "prezzo_anziche_um_com";
        public static string unita_fatt = "unita_fatt";
        public static string um_com = "um_com";
        public static string dicitura_reparto = "dicitura_reparto";
        public static string DescrizioniDescrizione1 = "Descrizioni.Descrizione1";
        public static string DescrizioniDescrizione2 = "Descrizioni.Descrizione2";
        public static string DescrizioniDescrizione3 = "Descrizioni.Descrizione3";
        public static string DescrizioniDescrizione4 = "Descrizioni.Descrizione4";
        public static string DescrizioniDescrizione1Tracciato = "Descrizioni.Descrizione1Tracciato";
        public static string DescrizioniDescrizione2Tracciato = "Descrizioni.Descrizione2Tracciato";
        public static string DescrizioniDescrizione3Tracciato = "Descrizioni.Descrizione3Tracciato";
        public static string DescrizioniDescrizione4Tracciato = "Descrizioni.Descrizione4Tracciato";
        //public static string keyDescr1Gruppo = "Descrizioni.Descrizione1GruppoTracciato";
        //public static string keyDescr2Gruppo = "Descrizioni.Descrizione2GruppoTracciato";
        //public static string keyDescr3Gruppo = "Descrizioni.Descrizione3GruppoTracciato";
        //public static string keyDescr4Gruppo = "Descrizioni.Descrizione4GruppoTracciato";
        public static string ScattoCodiceGruppo = "Scatto.CodiceGruppo";
        public static string NomeFoto = "Foto.Nome";
        public static string IndiceConfronto = "indice_confronto";
        public static string IndiceGruppo = "indice_gruppo";
        public static string NomeGruppoOrdinamento = "nome_gruppo_ordinamento";
        public static string IndiceOridinamentoSezione = "indice_sezione";
        public static string nota_esempio = "nota_esempio";
        //public static string keySelezioneMenabo = "selezione_menabo";
        public static string keyStatoSelezione = "StatoSelezione";
        public static string keyFood = "food";
        public static string keyFluff = "fluff";
        public static string keyMeccanicaTradotta = "meccanica_tradotta";
        public static string keyFlag_All = "flag_all";
        public static string keyFlag_Fid = "flag_fid";
        public static string keyCombinazioneMeccanica = "combinazioneMeccanica";
        public static string keyCombinazioneAssegnata = "combinazioneAssegnata";
        public static string keyCodiceBox = "codiceBox";
        public static string keyRepartoForzato = "reparto_forzato";
        public static readonly string keyXMLDescrizioneGruppo = "descrizione_gruppo";
        public static readonly string keyACComuni = "ACComuni";
        public static readonly string keyDataEstrazione = "data_estrazione";

    }
}

namespace AgenziaLib
{

    public class VVGroup
    {
        public string Vv { get; set; }
        public string Codice { get; set; }
    }
    public class IndiceDifferenza
    {
        public int indice { get; set; }
        public string details_sottogruppi { get; set; } = String.Empty;

        public string error { get; set; } = "";

    }

    public class Edro21AreaCanale
    {
        public string AreaInput;
        public string CanaleInput;
        public string AreaOutput;
        public string CanaleOutput;
        public string GruppoSiti;
        public string [] keyRicercaLocalismo;

        public bool AreaEqualsTo(string comparer)
        {
            if (this.AreaInput.StartsWith("IN$"))
            {
                string searchValue = this.AreaInput.Substring(3);

                return comparer.Contains(searchValue);
            }

            return (comparer==this.AreaInput);
        }

    }

    internal class Edro21 : IAgenzia
    {

        // I source del cliente cambiano di rado ma venivano riletti e riparsati a ogni
        // export: per Edro sono circa 9,9 MB, di cui 8,5 solo di SourceMappaStili.
        // La cache si invalida sulla data di modifica e sulla dimensione del file, quindi
        // una modifica fatta dall'editor di Istanta viene raccolta al primo export dopo.
        //
        // I valori in cache sono condivisi fra le chiamate: vanno letti, non modificati.
        // Oggi vale per tutti e sette, verificato prima di introdurre la cache.
        private static readonly IstantaLib.CacheFilePerPercorso<object> cacheSourceCliente = new();

        private static T SourceInCache<T>(string percorso, Func<string, T> carica) where T : class
        {
            return (T)cacheSourceCliente.Ottieni(
                percorso,
                p => (object)carica(p),
                percorso + "|" + typeof(T).FullName);
        }

        private static T SourceJson<T>(string percorso) where T : class
        {
            return SourceInCache(percorso, p => JObject.Parse(File.ReadAllText(p)).ToObject<T>()!);
        }

        private List<Meccanica> dbMeccaniche;
        private List<Ordinamento> dbGrammature;
        private List<AreaItem> dbAree;
        private List<Area> dbAree2;
        private List<Canale> dbCanali2;
        private List<Mastro> dbMastro;
        Dictionary<string, string> requestParams;
        public List<string> errors = new List<string>();

        List<Dictionary<string, object>> lista_tracciato;
        DbPopCombinazioni popDB;
        DbLoghiBolli loghibolliDB;

        public static string SEGMENTI_X_FUORIBANCO = "0103010001\r\n0103010004\r\n0103010007\r\n0103010010\r\n0103010013\r\n0103010016\r\n0103010019\r\n0103010020\r\n0103010022\r\n0103013001\r\n0103013004\r\n0103013007\r\n0103013010\r\n0103013013\r\n0103013016\r\n0103013019\r\n0103019001\r\n0103019004\r\n0103019007\r\n0103019010\r\n0103019013\r\n0103019016\r\n0103019019\r\n0103019020\r\n0103019022\r\n0103022001\r\n0103022004\r\n0103022007\r\n0103022008\r\n0103022010\r\n0103025001\r\n0103025004\r\n0103025005\r\n0103025007\r\n0101025001\r\n0101025004\r\n0101025007\r\n0101025008\r\n0101025010\r\n0111001001\r\n0111001004\r\n0111001007\r\n0111001010\r\n0111001013\r\n0111001014\r\n0111001016\r\n0111001019\r\n0111004001\r\n0111004004\r\n0111004007\r\n0111007001\r\n0111007004\r\n0111007005\r\n0111007007\r\n0115001001\r\n0115001004\r\n0115001007\r\n0115001010\r\n0115001013\r\n0115001014\r\n0115001016\r\n0105001007\r\n0105002004\r\n0105001001\r\n0105001004\r\n0105001010\r\n0105001011\r\n0105001013\r\n0105002001\r\n0105002007\r\n0105002010\r\n0105013011\r\n0105013007\r\n0105013010\r\n0105013001\r\n0105013004\r\n0105013013\r\n0107001001\r\n0107001004\r\n0107001007\r\n0107001010\r\n0107001013\r\n0107001016\r\n0107001019\r\n0107004001\r\n0107004004\r\n0107004007\r\n0107004010\r\n0107004013\r\n0107004016\r\n0107004019\r\n0107016001\r\n0107016004\r\n0107016007\r\n0107016010\r\n0107016013\r\n0107016016\r\n0107016019\r\n0107022001\r\n0107022004\r\n0107022007\r\n0107022010\r\n0107022013\r\n0107022016\r\n0107022019\r\n0301001001\r\n0301001004\r\n0301001007\r\n0301001010\r\n0301001013\r\n0301001015\r\n0301001016\r\n0301001019\r\n0301001020\r\n0301001021\r\n0301001022\r\n0303013001\r\n0303013004\r\n0303013007\r\n0303013010\r\n0303013013\r\n0303019001\r\n0303019004\r\n0303022001\r\n0303022004\r\n0303022007\r\n0303022010\r\n0303025001\r\n0303025004\r\n0303025007\r\n0303025010\r\n0303031001\r\n0303031004\r\n0303031007\r\n0303031010\r\n0303016001\r\n0303016004\r\n0303016007\r\n0305001001\r\n0305001004\r\n0305001007\r\n0305001010\r\n0305001013\r\n0305001016\r\n0305001019\r\n0305001022\r\n0305001025\r\n0305001028\r\n0305001031\r\n0305001034\r\n0305001037\r\n2423003001\r\n2423003003\r\n2423003005\r\n2423003007\r\n2423003009\r\n0501001001\r\n0501001004\r\n0501004001\r\n0501004004\r\n0501004007\r\n0501007001\r\n0501007004\r\n0501007007\r\n0501007010\r\n0501007013\r\n0501010001\r\n0501010004\r\n0501010007\r\n0501010010\r\n0503001001\r\n0503001004\r\n0503004001\r\n0503004004\r\n0503016001\r\n0503007001\r\n0503007004\r\n0503019001\r\n0503016007\r\n0503019007\r\n0503010001\r\n0503010004\r\n0503010007\r\n0503010010\r\n0503010013\r\n0503010016\r\n0503010019\r\n0503010022\r\n0503010025\r\n0503010028\r\n0503010031\r\n0503016004\r\n0503016010\r\n0503013001\r\n0503013004\r\n0503013007\r\n0503013010\r\n0503019004\r\n0503019010\r\n0503022001\r\n0503022004\r\n0503022007\r\n0503022010\r\n0503025001\r\n0503025004\r\n0503025007\r\n0503025010\r\n0503028001\r\n0503028004\r\n0503028007\r\n0503031001\r\n0503031004\r\n0503031007\r\n0503031010\r\n0505007001\r\n0505007004\r\n0505007007\r\n0505007010\r\n0505007013\r\n0505007016\r\n0705001001\r\n0705001004\r\n0705001007\r\n0705001010\r\n0707010001\r\n0707010004\r\n0707010007\r\n0707001001\r\n0707001004\r\n0707001007\r\n0707001010\r\n0107014001\r\n2423003013\r\n2423003015\r\n2423003017\r\n2423003019\r\n0107028001\r\n0107019007";
        public static string RUOLI_X_FUORIBANCO = "STAR\r\nVEDETTE\r\nPRIMA PAGINA\r\n";
        //Tutti quei segmenti che non hanno bisogno di match con RUOLI_X_FUORIBANCO, se ci sono valgono come FUORI BANCO
        public static string SEGMENTI_X_FUORIBANCO_ESCLUSIVI = "107001001\r\n107001004\r\n107001007\r\n107001010\r\n107001013\r\n107001016\r\n107001019\r\n107004001\r\n107004004\r\n107004007\r\n107004010\r\n107004013\r\n107004016\r\n107004019\r\n107016001\r\n107016004\r\n107016007\r\n107016010\r\n107016013\r\n107016016\r\n107016019\r\n107022001\r\n107022004\r\n107022007\r\n107022010\r\n107022013\r\n107022016\r\n107022019\r\n0107019004\r\n0107007004\r\n0107007007\r\n0107014001\r\n0107028001\r\n0107019007\r\n0107005013\r\n0107007010";
        public static string REPARTI_EXTRA = "83\r\n84\r\n85";

        public string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string, string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC)
        {
            ImportResult impResult = new ImportResult();

            List<Tracciato> result = new List<Tracciato>();
            //string errors = "";
            errors.Clear();



            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            //Voglio impostare la cultura italiana per il parsing delle date


            try
            {

                bool flag_error = false;
                Byte imp_tipo_tracciato = (Byte)1;// Byte.Parse(formRequest["cmbTipoTracciato"].ToString());

                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV areeDB = o1.ToObject<DbACPV>();
                dbAree2 = areeDB.aree;
                dbCanali2 = areeDB.canali;

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                dbGrammature = ordDB.source;

                //JArray o2 = JArray.Parse(File.ReadAllText(pathOrdinamentoLista));
                //DbOrdinamento ordDb = new DbOrdinamento();
                //ordDb.source = o2.ToObject<List<Ordinamento>>();
                //dbGrammature = ordDb.source;

                JObject o3 = JObject.Parse(File.ReadAllText(pathMeccaniche));
                DbMeccaniche mcDB = o3.ToObject<DbMeccaniche>();
                dbMeccaniche = mcDB.source;


                //requestParams = formRequest;
                //Per adesso questa variabile la istanziamo vuota, dorà essere rimpiazzata dalle logiche di context e contextPromo che già arrivano a questa funzione
                requestParams = new Dictionary<string, string>();

                JArray oTrad = JArray.Parse(File.ReadAllText(pathTraduttoreAC));
                string test = oTrad.ToString();
                List<Edro21AreaCanale> MappaturaCanaleArea = oTrad.ToObject<List<Edro21AreaCanale>>();//JsonConvert.DeserializeObject<List<Edro21AreaCanale>>(oTrad.ToString());
                foreach (var m in MappaturaCanaleArea)
                {
                    switch (m.AreaOutput)
                    {
                        case "TO":
                            m.keyRicercaLocalismo = new string[] { "TOSCANA" };
                            break;
                        case "PI":
                            m.keyRicercaLocalismo = new string[] { "PIEMONTE" };
                            break;
                        case "SA":
                            m.keyRicercaLocalismo = new string[] { "SARDEGNA" };
                            break;
                        case "LA":
                            m.keyRicercaLocalismo = new string[] { "LAZIO" };
                            break;
                        case "EM":
                            m.keyRicercaLocalismo = new string[] { "EMILIA" };
                            break;
                        case "LI":
                            m.keyRicercaLocalismo = new string[] { "LIGURIA" };
                            break;
                        case "SP":
                            m.keyRicercaLocalismo = new string[] { "LIGURIA", "TOSCANA" };
                            break;
                        case "AO":
                            m.keyRicercaLocalismo = new string[] { "AOSTA" };
                            break;
                        default:
                            //errors.Add("AreaOutput " + m.AreaOutput + " non riconosciuta nella mappatura canale/area");
                            break;
                    }
                }


                Dictionary<string, string> traduttoreUm = new Dictionary<string, string>() {
                    {"LT", "Litro"},
                    {"PZ", "Pezzo" },
                    { "KG", "Kg"}
                };
                List<string> listSegmentiFuoribanco = SEGMENTI_X_FUORIBANCO.Split(new string[] { "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries).ToList();
                List<string> listRuoliFuoribanco = RUOLI_X_FUORIBANCO.Split(new string[] { "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries).ToList();
                List<string> listSegmentiFuoribancoEsclusivi = SEGMENTI_X_FUORIBANCO_ESCLUSIVI.Split(new string[] { "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries).ToList();
                List<int> listRepartiExtra = REPARTI_EXTRA.Split(new string[] { "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries).ToList().Select(s => Int32.Parse(s)).ToList();

                // Prima di fare qualsiasi ragionamento eredito le regole che applicava la MACRO Standard di Edro21 
                //string referenza_pilota = item[Edro21Context.Meta.referenza_pilota].ToString(); non mi torna quindi faccio a modo mio
                string referenza_pilota = Edro21Context.Meta.referenza_pilota;
                string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
                string prenotazione_pilota = Edro21Context.Meta.prenotazione_pilota;
                string meccanica_origine = Edro21Context.Meta.meccanica_origine;
                string keyArea = Edro21Context.Meta.area;
                string keyGruppo_siti_stringa = Edro21Context.Meta.gruppo_siti_stringa;
                string keyGruppo_siti = Edro21Context.Meta.gruppo_siti;
                string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
                string keyRuolo = Edro21Context.Meta.ruolo;
                string keySegmento = Edro21Context.Meta.segmento;
                string keyNote_category = Edro21Context.Meta.note_category;
                string keyFuoribanco = Edro21Context.Meta.fuoribanco;


                string keyDistintivita = Edro21Context.Meta.distintivita;
                string keyLocalismo = Edro21Context.Meta.localismo;
                string keyTerritorialita = Edro21Context.Meta.territorialita;
                string keyTipo_riga = Edro21Context.Meta.tipo_riga;
                string keyReparto = Edro21Context.Meta.reparto;
                string keyNome_foto = Edro21Context.Meta.nome_foto;

                //I20-1000: il nome foto arriva dalla chiave custom nome_foto sulle liste vecchie e
                //dalla chiave core Foto.SelezioneDaTracciato su quelle nuove, e per un po' le due
                //generazioni convivono. Si legge quella che c'e'.
                //Prima si faceva item[keyNome_foto] diretto: su un dizionario una chiave assente non
                //restituisce vuoto, solleva un'eccezione, quindi su una lista nuova non si degradava,
                //ci si fermava. Mancando entrambe si prosegue con la stringa vuota, che i controlli
                //piu' avanti gia' sanno gestire.
                string leggiNomeFoto(Dictionary<string, object> riga)
                {
                    if (riga == null)
                    {
                        return "";
                    }

                    if (riga.ContainsKey(keyNome_foto) && riga[keyNome_foto] != null)
                    {
                        return riga[keyNome_foto].ToString()!;
                    }

                    if (riga.ContainsKey(GLOBAL_VARIABLES.keyFotoSelezioneDaTracciato) && riga[GLOBAL_VARIABLES.keyFotoSelezioneDaTracciato] != null)
                    {
                        return riga[GLOBAL_VARIABLES.keyFotoSelezioneDaTracciato].ToString()!;
                    }

                    return "";
                }
                string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
                string keyId_pop = Edro21Context.Meta.id_pop;
                string keyData_da = Edro21Context.Meta.data_da;
                string keyData_a = Edro21Context.Meta.data_a;
                string keyIniziativa = Edro21Context.Meta.iniziativa;
                string keyTema = Edro21Context.Meta.tema;
                string keyScattoCodice = Edro21Context.Meta.ScattoCodice;
                string keyDescrizione_iniziativa = Edro21Context.Meta.descrizione_iniziativa;
                string keySconto_MM = Edro21Context.Meta.sconto_MM;
                string keyPrezzo_offerta_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
                string keySconto_FID = Edro21Context.Meta.sconto_FID;
                string keySezione = Edro21Context.Meta.sezione;
                string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
                string keyTipo_tema = Edro21Context.Meta.tipo_tema;
                string keyRange_1 = Edro21Context.Meta.range_1;
                string keyRange_2 = Edro21Context.Meta.range_2;
                string keyCodice_vv = Edro21Context.Meta.codice_vv;
                string keyPrezzo_offerta_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
                string keyTipo_sconto_FID = Edro21Context.Meta.tipo_sconto_FID;
                string keyPunti_1 = Edro21Context.Meta.punti_1;
                string keyPunti_2 = Edro21Context.Meta.punti_2;
                string keySettore = Edro21Context.Meta.settore;
                string keyTipo_sconto_MM = Edro21Context.Meta.tipo_sconto_MM;
                string keyTipo_punti = Edro21Context.Meta.tipo_punti;
                string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
                string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
                string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
                string keyN_MM = Edro21Context.Meta.N_MM;
                string keyM_MM = Edro21Context.Meta.M_MM;
                string keyDicituraReparto = Edro21Context.Meta.dicitura_reparto;
                string keyRefs = Edro21Context.Meta.refs;
                string keyFuori_banco = Edro21Context.Meta.fuori_banco;
                string KeyAreaCodice = Edro21Context.Meta.AreaCodice;
                string keyDescrizioniPeso = Edro21Context.Meta.DescrizioniPeso;
                string keyReferenzaCodice = Edro21Context.Meta.ReferenzaCodice;
                string keyN_FID = Edro21Context.Meta.N_FID;
                string keyM_FID = Edro21Context.Meta.M_FID;
                string keyDescrizioniDescrizione1 = Edro21Context.Meta.DescrizioniDescrizione1;
                string keyDescrizioniDescrizione1Gruppo = GLOBAL_VARIABLES.keyDescr1Gruppo;// Edro21Context.Meta.keyDescr1Gruppo;
                string keyDescrizioniDescrizione2Gruppo = GLOBAL_VARIABLES.keyDescr2Gruppo;//Edro21Context.Meta.keyDescr2Gruppo;
                string keyDescrizioniDescrizione3Gruppo = GLOBAL_VARIABLES.keyDescr3Gruppo;//Edro21Context.Meta.keyDescr3Gruppo;
                string keyDescrizioniDescrizione4Gruppo = GLOBAL_VARIABLES.keyDescr4Gruppo;// Edro21Context.Meta.keyDescr4Gruppo;
                //string keySelezioneMenabo = Edro21Context.Meta.keySelezioneMenabo;
                string keyFood = Edro21Context.Meta.keyFood;
                string keyFlagAll = Edro21Context.Meta.keyFlag_All;
                string keyFlagFid = Edro21Context.Meta.keyFlag_Fid;

                string sigla_materiale = "VOL";// formRequest["cmbMaterialeVol"].ToString();
                int id_area_custom = 0;//Int16.TryParse(id_canale_area, out id_area_customformRequest["cmbCanaleArea"].ToString());
                string mzApName = "";// formRequest["MzApName"];


                string combinazioneAP = "";

                var contextPromoTema = contextPromo.FirstOrDefault(f => f.nome_field == "tema");
                if (contextPromoTema != null)
                {
                    sigla_materiale = contextPromoTema.user_value;

                    if (contextPromoTema.user_value == "AP")
                    {
                        var fieldContextAP_AC = contextPromo.FirstOrDefault(f => f.nome_field == "cmb_ap_ac");
                        if (fieldContextAP_AC == null)
                        {
                            throw new Exception("AP non specifica combinazione!");
                        }

                        combinazioneAP = fieldContextAP_AC.user_value;

                    }
                }

                Int32 gruppo_siti = 0;
                string codice_area_custom = "";
                if (sigla_materiale == "AP")
                {
                    CombinazioneAreaCanale combAP = areeDB.combinazioni.FirstOrDefault(c => c.guidID == combinazioneAP);
                    Area areaAP = areeDB.aree.FirstOrDefault(a => a.guidID == combAP.guidIDArea);
                    Canale canaleAP = areeDB.canali.FirstOrDefault(c => c.guidID == combAP.guidIDCanale);
                    codice_area_custom = $"{canaleAP.sigla}{areaAP.sigla}";
                }
                //else if (sigla_materiale.ToLower().IndexOf("mz") == 0)
                //{

                //    AreaItem a_custom_item = null;


                //    //Ho selezionato una custom
                //    if (id_area_custom > 0)
                //    {
                //        a_custom_item = dbAree.Where(a => a.Id == id_area_custom).FirstOrDefault();
                //        if (a_custom_item != null)
                //            gruppo_siti = a_custom_item.GruppoSiti;
                //    }



                //    if (sigla_materiale.ToLower() == "mz")
                //    {
                //        sigla_materiale += "_" + mzApName;
                //        if (a_custom_item != null)
                //        {
                //            sigla_materiale += "_" + a_custom_item.Area.Substring(0, 2) + "_" + a_custom_item.Area.Substring(2, 2);
                //        }
                //        else
                //        {
                //            errors.Add("CANALE/AREA MAGAZINE non trovato per il gruppo siti " + gruppo_siti);
                //        }
                //    }
                //    else
                //    {
                //        sigla_materiale += "_" + mzApName;
                //    }

                //    if (a_custom_item != null)
                //        codice_area_custom = a_custom_item.Area;
                //}




                int counter = 0;
                int counter2 = 0;

                DateTime tracciato_date_da = new DateTime(1900, 1, 1);
                DateTime tracciato_date_a = new DateTime(1900, 1, 1);



                Dictionary<string, int> cod_scatto_index = new Dictionary<string, int>();



                string report_read_error = "";

                bool area_found = false;
                Int16 perc_prog_lettura = 0;

                Tracciato tracciato_item = null;



                //errors += "Leggo lista di " + tracciato.Count + " refs\n";

                double media_processo_item = 0;
                int count_items = 0;

                var gruppoAvv = new
                {
                    Indice = -1,
                    Descrizione1 = "",
                    Descrizione2 = "",
                    Descrizione3 = "",
                    Descrizione4 = "",
                    Peso = "",
                    Um = "",
                    ListaFoto = "",
                    CodiceRadice = ""
                };




                for (int i = 0; i < tracciato.Count; i++)
                {
                    DateTime inizio_processo_item = DateTime.Now;

                    try
                    {

                        Dictionary<string, object> item = tracciato[i];

                        if (item[keyReferenzaCodice].ToString() == "4058997")
                        {
                            Debug.WriteLine("");
                        }
                        #region definizione area del record

                        if (item[keyArea].ToString() == "AREA")
                            continue;

                        string area_origine = item[keyArea].ToString();
                        string gruppo_siti_stringa = item[keyGruppo_siti_stringa].ToString();
                        //Cerco la codifica dell'area/gruppo siti nel dataset di Edro21

                        string codice_area = area_origine;
                        Area aItem = null;
                        Canale cItem = null;

                        Edro21AreaCanale canale_area_codificato = null;

                        if (codice_area_custom != "" && codice_area_custom != null)
                        {
                            //canale_area_codificato = MappaturaCanaleArea.Where(m => m.AreaEqualsTo(area_origine) && m.CanaleInput == gruppo_siti_stringa).FirstOrDefault();
                            //if (canale_area_codificato==null)
                            //{
                            //    errors.Add("Codifica CANALE/AREA non trovata per AREA:" + area_origine + " CANALE:" + gruppo_siti_stringa);
                            //    break;
                            //}

                            //Se c'è un custom che forza, tutto cio che è scritto nell'excel viene scartato
                            codice_area = codice_area_custom;
                            //Devo pero verificare che il codice custom sia valido
                            //Per farlo diamo per assodato che la sigla sia divisa in 2 e 2 rispettivamente CANALE/AREA?!
                            if (codice_area.Length != 4)
                            {
                                errors.Add("Codice custom non valido: " + codice_area + ". Si aspetta un codice da 4 lettere CCAA\n");
                                continue;
                            }
                            else
                            {
                                string canaleCustom = codice_area.Substring(0, 2);
                                string areaCustom = codice_area.Substring(2, 2);
                                aItem = dbAree2.Where(a => a.sigla == areaCustom).FirstOrDefault();
                                cItem = dbCanali2.Where(c => c.sigla == canaleCustom).FirstOrDefault();

                                if (aItem == null)//!area.ContainsKey("Id"))
                                {
                                    errors.Add("AREA non trovata: " + areaCustom);
                                    break;
                                }
                                else if (cItem == null)//!area.ContainsKey("Id"))
                                {
                                    errors.Add("CANALE non trovato: " + canaleCustom);
                                    break;
                                }

                                canale_area_codificato = MappaturaCanaleArea.Where(a => a.CanaleOutput == canaleCustom && a.AreaOutput == areaCustom).FirstOrDefault();
                            }

                        }
                        else
                        {
                            //errors  += " >> Cerco " + area_origine + " Canale origine " + gruppo_siti_stringa;

                            //canale_area_codificato = MappaturaCanaleArea.Where(m => m.AreaInput == area_origine && m.CanaleInput == gruppo_siti_stringa).FirstOrDefault();
                            canale_area_codificato = MappaturaCanaleArea.Where(m => m.AreaEqualsTo(area_origine) && m.CanaleInput == gruppo_siti_stringa).FirstOrDefault();

                            if (canale_area_codificato != null)
                            {
                                item[keyArea] = canale_area_codificato.CanaleOutput + canale_area_codificato.AreaOutput;
                                //Definisco per la prima volta il campo gruppo_siti
                                int _grppoSitiInt;
                                Int32.TryParse(canale_area_codificato.GruppoSiti, out _grppoSitiInt);
                                item[keyGruppo_siti] = _grppoSitiInt;

                                //gruppo_siti =  Int32.Parse(canale_area_codificato.GruppoSiti);
                                aItem = dbAree2.Where(a => a.sigla == canale_area_codificato.AreaOutput).FirstOrDefault();
                                cItem = dbCanali2.Where(c => c.sigla == canale_area_codificato.CanaleOutput).FirstOrDefault();

                                if (aItem == null)//!area.ContainsKey("Id"))
                                {
                                    errors.Add("AREA non trovata: " + canale_area_codificato.AreaOutput);
                                    break;
                                }
                                else if (cItem == null)//!area.ContainsKey("Id"))
                                {
                                    errors.Add("CANALE non trovato: " + canale_area_codificato.CanaleOutput);
                                    break;
                                }

                                codice_area = item[keyArea].ToString();

                                //errors += " >> CODICE TROVATO " + codice_area;

                            }
                            else
                            {
                                errors.Add("Codifica CANALE/AREA non trovata per AREA:" + area_origine + " CANALE:" + gruppo_siti_stringa);
                                break;
                            }



                        }

                        #endregion


                        if (item.ContainsKey(GLOBAL_VARIABLES_FICO.keyXlsxTracciato))
                        {
                            string nome_file_excel = item[GLOBAL_VARIABLES_FICO.keyXlsxTracciato].ToString();
                            string[] parts = nome_file_excel.Split('_');
                            if (parts.Length >= 3)
                            {
                                string data = parts[parts.Length - 2];
                                string ora = parts[parts.Length - 1];
                                ora = ora.Substring(0, ora.LastIndexOf('.'));
                                DateTime data_excel;
                                if (DateTime.TryParseExact($"{data} {ora}", "yyyy-MM-dd HH.mm.ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out data_excel))
                                {

                                    item[Meta.keyDataEstrazione] = data_excel;
                                }
                            }
                        }

                        if (!item.ContainsKey(GLOBAL_VARIABLES.keySiglaReparto))
                        {
                            switch (item[keyReparto].ToString())
                            {
                                case "29":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "CA";
                                    break;

                                case "33":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "OF";
                                    break;

                                case "31":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "PE";
                                    break;

                                case "25":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "GA";
                                    break;

                                case "27":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "FO";
                                    break;

                                case "01":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "DAL";
                                    break;

                                case "03":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "BV";
                                    break;

                                case "21":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "SG";
                                    break;

                                case "24":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "LS";
                                    break;

                                case "05":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                    break;
                                case "07":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                    break;

                                case "09":
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "CP";
                                    break;

                                default:
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "EX";
                                    break;
                            }
                        }



                        if (item.ContainsKey(prenotazione_pilota) && (bool)item[prenotazione_pilota])
                        {
                            item[referenza_pilota] = "S";
                            item.Remove(prenotazione_pilota);
                        }

                        string meccanica = item[meccanica_origine].ToString();
                        if (meccanica == "")
                        {
                            item[meccanica_origine] = "VUOTA";
                        }

                        string tipo_vol = item[keyTipo_volantino].ToString();
                        if (tipo_vol == "V")
                        {
                            item[keyTipo_volantino] = "V - Volantino";
                        }
                        else if (tipo_vol == "F")
                        {
                            item[keyTipo_volantino] = "F - Fuori Volantino";
                        }
                        tipo_vol = item[keyTipo_volantino].ToString();

                        string ean = item[GLOBAL_VARIABLES.keyRefEan].ToString();
                        if (ean.Contains(","))
                        {
                            item[GLOBAL_VARIABLES.keyRefEan] = ean.Replace(",", "_");
                        }

                        string um = item[GLOBAL_VARIABLES.keyDescrUm].ToString();
                        if (traduttoreUm.ContainsKey(um))
                        {
                            item[GLOBAL_VARIABLES.keyDescrUm] = traduttoreUm[um];
                        }

                        string ruolo = item[keyRuolo].ToString();
                        string segmento = item[keySegmento].ToString();
                        string note_category = item[keyNote_category].ToString().ToUpper();

                        if ((listSegmentiFuoribanco.Contains(segmento) && listRuoliFuoribanco.Contains(ruolo)) ||
                                note_category.Contains("POP A4") ||
                                listSegmentiFuoribancoEsclusivi.Contains(segmento) ||
                                ruolo.ToLower().Contains("prima pagina")
                            )
                        {
                            item[keyFuoribanco] = "FUORI BANCO";
                        }


                        //Routine del gruppo
                        string tipo_riga = item[keyTipo_riga].ToString();
                        int reparto = Int32.Parse(item[keyReparto].ToString());

                        string descrizione = item[GLOBAL_VARIABLES.keyDescr1].ToString();

                        string brand = item[GLOBAL_VARIABLES.keyDescr2].ToString();
                        string distintivita = item[keyDistintivita] != null ? item[keyDistintivita].ToString() : "";
                        if (item[keyReferenzaCodice].ToString() == "5263812")
                        {
                            Console.WriteLine("Codice: 5263812");
                            Console.WriteLine("Brand: " + brand);
                            Console.WriteLine("keyLocalismo: " + item[keyLocalismo].ToString());
                            Console.WriteLine("area_origine: " + area_origine);
                            Console.WriteLine("item[keyLocalismo] != null && item[keyLocalismo].ToString().ToLower().Contains(area_origine.ToLower()) && item[keyLocalismo].ToString().ToLower().Contains(\"territorio\")");
                            Console.WriteLine(item[keyLocalismo] != null && item[keyLocalismo].ToString().ToLower().Contains(area_origine.ToLower()) && item[keyLocalismo].ToString().ToLower().Contains("territorio"));

                        }
                        if (brand.ToLower().Contains("dintorni"))
                        {
                            if (item[keyReferenzaCodice].ToString() == "5263812")
                            {
                                Console.WriteLine("Codice: 5263812");
                                Console.WriteLine("Entro 0");
                            }
                            if (distintivita.ToLower() != "tipico")
                                item[keyDistintivita] = "TIPICO_BRAND";
                        }
                        else if (item[keyLocalismo] != null)
                        {
                            var localismo = item[keyLocalismo].ToString();
                            if (localismo != "")
                            {
                                Debug.WriteLine("trovato");
                            }
                            bool areaContenuta = canale_area_codificato.keyRicercaLocalismo.Any(word => item[keyLocalismo].ToString().ToLower().Contains(word.ToLower()));
                            if (areaContenuta && item[keyLocalismo].ToString().ToLower().Contains("territorio"))
                            {

                                if (item[keyReferenzaCodice].ToString() == "5263812")
                                {
                                    Console.WriteLine("Codice: 5263812");
                                    Console.WriteLine("Entro 1");
                                }
                                item[keyTerritorialita] = "territorio_" + canale_area_codificato.AreaOutput;
                            }
                            else if (areaContenuta && item[keyLocalismo].ToString().ToLower().Contains("nostri"))
                            {
                                if (item[keyReferenzaCodice].ToString() == "5263812")
                                {
                                    Console.WriteLine("Codice: 5263812");
                                    Console.WriteLine("Entro 2");
                                }
                                item[keyTerritorialita] = "inostriori_" + canale_area_codificato.AreaOutput;
                            }
                        }


                        string tipo = item[GLOBAL_VARIABLES.keyDescr3].ToString();
                        string grammatura = item[GLOBAL_VARIABLES.keyDescr4].ToString();
                        string peso = item[GLOBAL_VARIABLES.keyDescrPeso].ToString();
                        string lista_foto = leggiNomeFoto(item);

                        string codice_scatto = item[keyCodice_scatto].ToString();
                        string sezione = item[keySezione].ToString().ToLower();



                        if (tipo_riga == "AVV")
                        {
                            //record gruppo
                            var lista_articoli_nel_gruppo = tracciato.Where(t => t[keyArea].ToString() == area_origine && t[keyCodice_scatto].ToString() == codice_scatto && t[keyTipo_riga].ToString() != "AVV").ToList();

                            //Sistemazione potenziale esempio
                            foreach (var itemPerFixPE in lista_articoli_nel_gruppo)
                            {
                                if (itemPerFixPE[referenza_pilota].ToString() != "S")//referenza_pilota != "S")
                                {
                                    itemPerFixPE[potenziale_esempio] = "";
                                }

                            }

                            List<VVGroup> vvGruppoFounded = new List<VVGroup>();
                            for (int j = 0; j < lista_articoli_nel_gruppo.Count(); j++)
                            {
                                var artGruppo = lista_articoli_nel_gruppo[j];
                                var codiceGiaPresenteList = vvGruppoFounded.Where(f => f.Codice == artGruppo[keyReferenzaCodice]).ToList();
                                //vvGruppoFounded.Contains(artGruppo[keyCodice_vv].ToString())
                                if (codiceGiaPresenteList.Count > 0)
                                {
                                    var codPresenteStessoVV = codiceGiaPresenteList.Find(f => f.Codice == artGruppo[keyCodice_vv].ToString()) != null;
                                    if (codPresenteStessoVV)
                                    {
                                        lista_articoli_nel_gruppo.Remove(artGruppo);
                                        tracciato.Remove(artGruppo);
                                        j--;
                                        continue;
                                    }

                                }
                                vvGruppoFounded.Add(new VVGroup { Vv = artGruppo[keyCodice_vv].ToString(), Codice = artGruppo[keyReferenzaCodice].ToString() });
                                artGruppo[keyReferenzaCodice] = artGruppo[keyReferenzaCodice] + (artGruppo[keyCodice_vv].ToString() != "1" ? "vv" + artGruppo[keyCodice_vv] : "");
                            }

                            var meccCorrispondente = dbMeccaniche.Find(f => f.NomeOrigine == meccanica);
                            if (meccCorrispondente != null)
                            {
                                foreach (var artItem in lista_articoli_nel_gruppo)
                                {
                                    artItem[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                                }
                            }

                            if (lista_articoli_nel_gruppo.Count > 1)
                            {

                                foreach (var artItem in lista_articoli_nel_gruppo)
                                {
                                    if (!artItem.ContainsKey(GLOBAL_VARIABLES.keySiglaReparto))
                                    {
                                        switch (artItem[keyReparto].ToString())
                                        {
                                            case "29":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "CA";
                                                break;

                                            case "33":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "OF";
                                                break;

                                            case "31":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "PE";
                                                break;

                                            case "25":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "GA";
                                                break;

                                            case "27":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "FO";
                                                break;

                                            case "01":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "DAL";
                                                break;

                                            case "03":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "BV";
                                                break;

                                            case "21":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "SG";
                                                break;

                                            case "24":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "LS";
                                                break;

                                            case "05":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                                break;
                                            case "07":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                                break;

                                            case "09":
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "CP";
                                                break;

                                            default:
                                                artItem[GLOBAL_VARIABLES.keySiglaReparto] = "EX";
                                                break;
                                        }
                                    }
                                }

                                bool isLazio = (aItem.sigla == "LA");

                                //E' un reale gruppo
                                bool isExtra = listRepartiExtra.Contains(reparto);
                                gruppoAvv = new
                                {
                                    Indice = i,
                                    Descrizione1 = descrizione,
                                    Descrizione2 = brand,
                                    Descrizione3 = tipo,
                                    Descrizione4 = grammatura,
                                    Peso = peso,
                                    Um = um,
                                    ListaFoto = lista_foto,
                                    CodiceRadice = item[GLOBAL_VARIABLES.keyRefCodice].ToString()
                                };

                                string codGruppo = String.Join(",", lista_articoli_nel_gruppo.Select(s => s[GLOBAL_VARIABLES.keyRefCodice].ToString()).OrderBy(o => o).ToList());

                                //Aggiungo in note category di ognuno, la firma fatta di tutte le descrizioni in unica stringa
                                string firma = String.Format("### {0}|{1}|{2}|{3}", descrizione, brand, tipo, grammatura);

                                //Sttogruppi cache
                                List<string> id_pops = new List<string>();

                                if (item[GLOBAL_VARIABLES.keyRefCodice].ToString() == "2452226")
                                {
                                    "debug".ToString();
                                }

                                //object[] obj_es = getNotaEsempio(lista_articoli_nel_gruppo, "", item[keyArea].ToString());
                                string nota_crocettatura = getNoteCrocettamento(item, lista_articoli_nel_gruppo);

                                string nota_esempio = nota_crocettatura;// obj_es[0].ToString();

                                //if(obj_es[0].ToString() == "")
                                //{
                                //    var pilota = lista_articoli_nel_gruppo.Find(f => f[referenza_pilota] == "S");
                                //    if (pilota == null)
                                //    {
                                //        pilota = lista_articoli_nel_gruppo[0];
                                //    }

                                //    bool diff_gramm = false;
                                //    string pesoPilota = pilota[GLOBAL_VARIABLES.keyDescrPeso].ToString();
                                //    diff_gramm = lista_articoli_nel_gruppo.Find(f => f.ContainsKey(GLOBAL_VARIABLES.keyDescrPeso) && f[GLOBAL_VARIABLES.keyDescrPeso].ToString() != pesoPilota) != null;


                                //    if (diff_gramm || (pilota[referenza_pilota].ToString() == "S" && pilota[keyTipo_volantino].ToString() != "F"))
                                //    {
                                //        nota_esempio = "Necessario Esempio";
                                //    }
                                //    else
                                //    {
                                //        nota_esempio = "Esempio non necessario";
                                //    }

                                //}

                                //if (obj_es[1].ToString() != "")
                                //nota_esempio += obj_es[1].ToString();



                                foreach (Dictionary<string, object> itemInGruppo in lista_articoli_nel_gruppo)
                                {


                                    string id_pop = itemInGruppo[keyId_pop].ToString();
                                    if (!id_pops.Contains(id_pop))
                                    {
                                        //Creo sottogruppo di tutte le ref del gruppo che hanno questo id_pop
                                        var sottogruppoPoP = lista_articoli_nel_gruppo.Where(s => s[keyId_pop].ToString() == id_pop);
                                        if (sottogruppoPoP.Count() > 1)
                                        {

                                            string codSottogruppo = String.Join(",", sottogruppoPoP.Select(s1 => s1[GLOBAL_VARIABLES.keyRefCodice].ToString()).OrderBy(f => f).ToList());

                                            foreach (Dictionary<string, object> itemInSottogruppo in sottogruppoPoP)
                                            {
                                                itemInSottogruppo[GLOBAL_VARIABLES.keyScattoCodiceSottogruppo] = codSottogruppo;
                                            }
                                        }

                                        id_pops.Add(id_pop);
                                    }

                                    //if (isLazio)
                                    //{
                                    //    //itemInGruppo["referenza_pilota"] = "S";
                                    //    itemInGruppo[prenotazione_pilota] = true;
                                    //}
                                    //else
                                    //{
                                        //Controllo se la sua foto è dentro il lista foto del gruppo
                                        var arrFotoGruppo = gruppoAvv.ListaFoto.Split(',');
                                        //itemInGruppo["referenza_pilota"] = arrFotoGruppo.Contains(itemInGruppo[keyNome_foto].ToString()) ? "S" : "";
                                        itemInGruppo[prenotazione_pilota] = arrFotoGruppo.Contains(leggiNomeFoto(itemInGruppo)) ? true : false;
                                    //}

                                    if (nota_esempio != "")
                                    {
                                        "debug".ToString();
                                    }

                                    itemInGruppo[keyNote_category] = item[keyNote_category].ToString();// firma;
                                    itemInGruppo[Meta.nota_esempio] = nota_esempio;
                                    itemInGruppo[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = codGruppo;

                                    itemInGruppo[keyDescrizioniDescrizione1Gruppo] = gruppoAvv.Descrizione1;
                                    itemInGruppo[keyDescrizioniDescrizione2Gruppo] = gruppoAvv.Descrizione2;
                                    itemInGruppo[keyDescrizioniDescrizione3Gruppo] = gruppoAvv.Descrizione3;
                                    itemInGruppo[keyDescrizioniDescrizione4Gruppo] = gruppoAvv.Descrizione4;
                                    itemInGruppo[GLOBAL_VARIABLES.keyPesoGruppo] = gruppoAvv.Peso;
                                    itemInGruppo[GLOBAL_VARIABLES.keyUmGruppo] = gruppoAvv.Um;


                                    var prefissiFoto = gruppoAvv.ListaFoto  //il motivo per cui si estraggono i prefissi è che una foto è scritta ad esempio 6504297-1-T5 ma il suffisso viene spesso sbagliato per logiche interne loro, per cui per vedere se la foto corrisponde effettivamente tra la lista e la foto del singolo cinviene confrontare solo il prefisso (ovvero il codice)
                                    .Split(',')
                                    .Select(foto => foto.Split('-')[0])
                                    .ToList();

                                    //if (itemInGruppo[GLOBAL_VARIABLES.keyRefCodice].ToString() == gruppoAvv.CodiceRadice)
                                    //{
                                    //    itemInGruppo[keySelezioneMenabo] = 1;
                                    //}
                                    //else if (prefissiFoto.Contains(itemInGruppo[keyNome_foto].ToString()))
                                    //{
                                    //    itemInGruppo[keySelezioneMenabo] = 2;
                                    //}
                                    //else
                                    //{
                                    //    itemInGruppo[keySelezioneMenabo] = 3;
                                    //}


                                }



                            }
                            else
                            {

                                var itemSingolo = lista_articoli_nel_gruppo.FirstOrDefault();
                                //Copio i dati descrittivi nella monoreferenza ART
                                itemSingolo[GLOBAL_VARIABLES.keyDescr1] = descrizione;
                                itemSingolo[GLOBAL_VARIABLES.keyDescr2] = brand;
                                itemSingolo[GLOBAL_VARIABLES.keyDescr3] = tipo;
                                itemSingolo[GLOBAL_VARIABLES.keyDescr4] = grammatura;
                            }
                        }
                        else
                        {
                            //record articolo


                            //Imposto indice di ordinamento
                            Ordinamento grItem = dbGrammature.Where(g => g.CodiceSegmento == segmento).FirstOrDefault();
                            //SezioneOrdinamento szItem = ordDB.sezioni.Where(s => s.nome.ToLower() == sezione).FirstOrDefault();
                            item[GLOBAL_VARIABLES.keyIndiceOrdinamento] = (Int16)9999;
                            item[Meta.IndiceOridinamentoSezione] = (Int16)9999;

                            if (grItem != null)
                            {
                                item[GLOBAL_VARIABLES.keyIndiceOrdinamento] = grItem.GlobalIndice;
                                item[Meta.NomeGruppoOrdinamento] = grItem.Gruppo;
                                item[Meta.keyFood] = grItem.Food;
                                item[Meta.keyFluff] = grItem.Fluff;

                                if (grItem.Gruppo.Contains("POP_CP"))
                                {
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "CP";
                                }
                                else if (grItem.Gruppo.Contains("POP_PC"))
                                {
                                    item[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                }
                            }
                            else
                            {
                                item[Meta.NomeGruppoOrdinamento] = "";
                                item[Meta.keyFood] = false;
                                item[Meta.keyFluff] = false;

                            }

                            if (item[Meta.NomeGruppoOrdinamento] == null)
                            {
                                Debug.WriteLine("");
                            }
                            //if(szItem!=null)
                            //{
                            //    item[Meta.IndiceOridinamentoSezione] = szItem.indice;
                            //}

                            var meccCorrispondente = dbMeccaniche.Find(f => f.NomeOrigine == meccanica);
                            if (meccCorrispondente != null)
                            {
                                item[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                            }

                            string data_da = item[keyData_da].ToString();
                            string data_a = item[keyData_a].ToString();

                            //errors += $">>>>> dal {data_da} al {data_a}";
                            DateTime local_data_da_dt = DateTime.Parse(data_da, culture);//(DateTime)item[keyData_da].ToString();
                            DateTime local_data_a_dt = DateTime.Parse(data_a, culture); //(DateTime)item[keyData_a];
                            //errors += $"Conversione valore data DA {data_da} che diventa {local_data_da_dt.ToString()}";
                            //errors += $"Conversione valore data A {data_a} che diventa {local_data_a_dt.ToString()}";

                            //errors += $">>>>> convertite correttamente";

                            DateTime d_tracciato = local_data_da_dt;


                            if (codice_area == "")
                                break;

                            tracciato_date_da = local_data_da_dt;
                            tracciato_date_a = local_data_a_dt;


                            if (codice_area != "")
                            {

                                string iniziativa = item[keyIniziativa].ToString();
                                string descr_iniziativa = item[keyDescrizione_iniziativa].ToString();

                                //Posso identificare il tipo di volantino!
                                //Area item_area = aree.Where(a => a.gruppo_siti == gruppo_siti).FirstOrDefault();

                                string nome_esportazione = d_tracciato.ToString("dd-MM-yy");


                                if (codice_area.Length == 4 &&
                                    (sigla_materiale.ToLower().IndexOf("mz") != 0 && sigla_materiale.ToLower().IndexOf("ap") != 0))
                                {
                                    nome_esportazione = sigla_materiale + "_" + codice_area.Substring(0, 2) + "_" + codice_area.Substring(2, 2) + "_" + nome_esportazione;
                                    if (imp_tipo_tracciato == (Byte)TipoImportazione.Manifesto && sigla_materiale != "MANIF")
                                        nome_esportazione = "MANIF_" + nome_esportazione;
                                }
                                else
                                {
                                    nome_esportazione = sigla_materiale + "_" + nome_esportazione;
                                }



                                area_found = true;


                                int conta = result.Where(l => (l.Canale + l.Area) == codice_area).Count();

                                if (conta <= 0)
                                {
                                    //Aggiungo il tracciato
                                    //errors += " +++ Aggiungo tracciato " + aItem.sigla + "/" + cItem.sigla;
                                    try
                                    {
                                        if (tracciato_date_da.Year > 1900)
                                        {

                                            Tracciato t_item = new Tracciato();

                                            t_item.NomeEsportazione = nome_esportazione;
                                            //if (imp_tipo_tracciato == (Byte)TipoImportazione.PoP && codice_area_originale_xls != codice_area_originale_xls_x_pop)
                                            //    t_item.Area = codice_area_originale_xls_x_pop;
                                            //else
                                            t_item.Area = aItem.sigla;
                                            t_item.Canale = cItem.sigla;
                                            t_item.guidCanale = cItem.guidID;
                                            t_item.guidArea = aItem.guidID;
                                            t_item.DataDa = tracciato_date_da;
                                            t_item.DataA = tracciato_date_a;
                                            t_item.DescrizioneIniziativa = descr_iniziativa;
                                            t_item.Iniziativa = iniziativa;
                                            t_item.Tipo = imp_tipo_tracciato;
                                            t_item.Promozione50Al50 = false;

                                            if (imp_tipo_tracciato == (Byte)TipoImportazione.Vol || imp_tipo_tracciato != (Byte)TipoImportazione.PoP)
                                            {
                                                tracciato_item = t_item;
                                            }

                                            result.Add(t_item);
                                        }
                                        else
                                        {
                                            errors.Add("DATA INVALIDA (" + tracciato_date_da.Year + ")");
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        errors.Add(ex.ToString());
                                        break;
                                    }

                                }
                                else
                                {

                                    //NOTA: Per far in modo che esca sempre il codice area originale da excel per ogni referenza.
                                    //nella query liste_x_area bisogna specificare anche "|| l.Key.area==codice_area_originale_xls"
                                    tracciato_item = result.Where(l => (l.Canale + l.Area) == codice_area).FirstOrDefault();
                                }

                            }


                            if (area_found)
                            {

                                counter2++;

                                #region lettura dettagli signolo record


                                string nome_foto = leggiNomeFoto(item);

                                //Dictionary<string, object> ref_archivio = item["Referenza"] as Dictionary<string, object>;
                                string codice_radice = item[GLOBAL_VARIABLES.keyRefCodice].ToString();

                                if (codice_radice == "")
                                {
                                    errors.Add("Interruzione lettura: Codice Articolo non trovato: " + codice_radice);
                                    break;
                                }


                                // Dictionary<string, object> descrizioni = item["Descrizioni"] as Dictionary<string, object>;
                                //string descrizione1 = descrizioni["Descrizione1"].ToString();
                                //descrizione1 = descrizione1.Replace("\n", Environment.NewLine);


                                string tema = item[keyTema].ToString();


                                decimal sconto_massmarket = 0;
                                string str_sconto_mm = item[keySconto_MM].ToString();
                                str_sconto_mm = str_sconto_mm.Replace(" ", "");
                                Decimal.TryParse(str_sconto_mm, out sconto_massmarket);
                                sconto_massmarket = Math.Abs(sconto_massmarket);
                                item[keySconto_MM] = sconto_massmarket;



                                decimal sconto_fidelity = 0;
                                string str_sconto_fid = item[keySconto_FID].ToString();
                                str_sconto_fid = str_sconto_fid.Replace(" ", "");
                                Decimal.TryParse(str_sconto_fid, out sconto_fidelity);
                                sconto_fidelity = Math.Abs(sconto_fidelity);
                                item[keySconto_FID] = sconto_fidelity;

                                string tipo_sconto_fidelity = item[keyTipo_sconto_FID].ToString();
                                string tipo_sconto_MM = item[keyTipo_sconto_MM].ToString();

                                string punti1 = item[keyPunti_1].ToString();

                                string range1 = item[keyRange_1].ToString();

                                if (punti1 != "" && range1 == "")
                                    range1 = "1";

                                item[keyRange_1] = range1;

                                string punti2 = item[keyPunti_2].ToString();

                                string range2 = item[keyRange_2].ToString();

                                if (punti2 != "" && range2 == "")
                                    range2 = "1";

                                item[keyRange_2] = range1;




                                decimal sconto_agenzia = 0;
                                string str_sconto_agenzia = item[keySconto_agenzia].ToString();
                                str_sconto_agenzia = str_sconto_agenzia.Replace(" ", "");
                                Decimal.TryParse(str_sconto_agenzia, out sconto_agenzia);
                                sconto_agenzia = Math.Abs(sconto_agenzia);
                                item[keySconto_agenzia] = sconto_agenzia;


                                //string brand = descrizioni["Descrizione2"].ToString();
                                brand = brand.Replace("\n", Environment.NewLine);

                                //string tipo_gusto = descrizioni["Descrizione3"].ToString();
                                //tipo_gusto = tipo_gusto.Replace("\n", Environment.NewLine);

                                //string grammatura = descrizioni["Descrizione4"].ToString();
                                //grammatura = grammatura.Replace("\n", Environment.NewLine);

                                //if (item["tipo_riga"].ToString() == "AVV")
                                //{
                                //    //Inserisco descrizione gruppo come dato per far capire al sistema che questo record è riferito al gruppo stesso di appartenenza
                                //    descrizioni["Gruppo"] = new Dictionary<string, object>();
                                //    Dictionary<string, object> _descr_gruppo = descrizioni["Gruppo"] as Dictionary<string, object>;
                                //    _descr_gruppo.Add("Descrizione1", descrizione1);
                                //    _descr_gruppo.Add("Descrizione2", brand);
                                //    _descr_gruppo.Add("Descrizione3", tipo_gusto);
                                //    _descr_gruppo.Add("Descrizione4", grammatura);
                                //    _descr_gruppo.Add("Um", item["unita_misura"]);
                                //    _descr_gruppo.Add("Peso", item["peso"]);

                                //}



                                if (tipo_vol.ToLower().IndexOf("f - fuori volantino") < 0 &&
                                    tipo_vol.ToLower().IndexOf("v - volantino") < 0 &&
                                    tipo_vol.ToLower().IndexOf("o - opportunit") < 0)
                                {
                                    errors.Add("Interruzione lettura: Tipo Volantino sconosciuto: " + tipo_vol + " per l'articolo " + codice_radice);
                                    break;
                                }

                                string tipo_tema = item[keyTipo_tema].ToString();

                                if (segmento.Length < "0101001001".Length)
                                {
                                    segmento = "0" + segmento;//Questo valore ad oggi ha lunghezza fissaa 10, il giorno che questa regola cambierà questa porzione dovrà essere cambiata
                                }



                                #endregion

                                #region creazione record


                                if (nome_foto.Length > 50)
                                {
                                    flag_error = true;
                                    //report_op += "Nome foto supera i 50 caratteri: " + nome_foto + "<br>codice " + codice_radice;
                                    errors.Add("Nome foto supera i 50 caratteri: " + nome_foto + "<br>codice " + codice_radice);

                                    break;
                                }


                                if (tema.Length > 40)
                                {
                                    flag_error = true;
                                    //report_op += "Tema supera i 40 caratteri: " + tema + "<br>codice " + codice_radice;
                                    errors.Add("Tema supera i 40 caratteri: " + tema + "<br>codice " + codice_radice);
                                    break;
                                }


                                if (tipo_sconto_fidelity.Length > 30)
                                {
                                    flag_error = true;
                                    //report_op += "Tipo sconto fidelity supera i 30 caratteri: " + tipo_sconto_fidelity + "<br>codice " + codice_radice;
                                    errors.Add("Tipo sconto fidelity supera i 30 caratteri: " + tipo_sconto_fidelity + "<br>codice " + codice_radice);
                                    break;
                                }


                                if (tipo_sconto_MM.Length > 30)
                                {
                                    flag_error = true;

                                    //report_op += "Tipo sconto massmarket supera i 30 caratteri: " + tipo_sconto_massmarket + "<br>codice " + codice_radice;
                                    errors.Add("Tipo sconto massmarket supera i 30 caratteri: " + tipo_sconto_MM + "<br>codice " + codice_radice);
                                    break;
                                }


                                if (tipo_tema.Length > 40)
                                {
                                    flag_error = true;
                                    errors.Add("Tipo tema supera i 40 caratteri: " + tipo_tema + "<br>codice " + codice_radice);
                                    break;
                                }

                                if (!item.ContainsKey(GLOBAL_VARIABLES.keyScattoCodiceGruppo))
                                {
                                    item[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = codice_radice;
                                }

                                //if (segmento != "")
                                //{
                                //    if (ref_archivio.ContainsKey("Segmento"))
                                //    {
                                //        ref_archivio["Segmento"] = segmento;
                                //    }
                                //    else
                                //    {
                                //        ref_archivio.Add("Segmento", segmento);
                                //    }
                                //}

                                //Cerco indice ordinamento e lo imposto


                                tracciato_item.Records.Add(item);

                                #endregion
                            }
                            else
                            {

                            }




                        }

                        //Fine intervento EX MASTRO
                    }
                    catch (Exception ex)
                    {
                        errors.Add(ex.ToString() + "\n");
                    }

                    media_processo_item += DateTime.Now.Subtract(inizio_processo_item).TotalMilliseconds;
                    count_items++;

                }

                //errors += "step4 - ";

                try
                {

                    foreach (Tracciato t in result)
                    {
                        var simili = t.Records.Where(tr => tr.ContainsKey(keySezione) && tr[keySezione].ToString().ToLower().Contains("50 prodotti al 50%") || tr[keySezione].ToString().ToLower().Contains("50 prod.sconto 50%")).ToList();
                        //errors += " simili (" + simili.Count + ")";

                        //errors += " recs tracciato " +t.Area + "_" + t.Canale + " (" + t.Records.Count + ")";
                        for (int i = 0; i < t.Records.Count; i++)
                        {
                            // errors += " >> rec  " + (i+1);
                            bool flagAll = false;
                            bool flagFid = false;
                            Dictionary<string, object> item = t.Records[i];
                            if (item[meccanica_origine] == "PERCENTO_FID_ALL")
                            {
                                foreach (var record in simili)
                                {
                                    if (record[meccanica_origine].ToString().ToLower().Contains("% mm all"))
                                    {
                                        flagAll = true;
                                    }

                                    if (record[meccanica_origine].ToString().ToLower().Contains("% fid all"))
                                    {
                                        flagFid = true;
                                    }

                                    if (flagFid && flagAll)
                                    {
                                        break;
                                    }
                                }
                                item[keyFlagFid] = flagFid;
                                item[keyFlagAll] = flagAll;
                            }
                            else
                            {
                                item[keyFlagFid] = false;
                                item[keyFlagAll] = false;
                            }
                        }
                    }
                }
                catch (Exception exstep)
                {
                    //errors += "!! "  + exstep.ToString() + "\n";
                }

                //errors += "step5 - ";

                media_processo_item = media_processo_item / count_items;
                //errors += "MEDIA: " + media_processo_item + "\n";
                string key_codice_scatto = Edro21Context.Meta.ScattoCodice;
                string key_codice_scatto_gruppo = Edro21Context.Meta.ScattoCodiceGruppo;
                if (!flag_error)
                {

                    #region Formulazione array di IN/OUT volantino per ogni refs/area

                    List<string> codici_cache = new List<string>();
                    foreach (Tracciato t in result)
                    {
                        //Estraggo nuovi codici ancora da elaborare
                        List<string> nuovi_codici_da_tracciato = t.Records
                            .Where(r => !codici_cache.Contains(r[GLOBAL_VARIABLES.keyRefCodice].ToString()))
                            .Select(s => s[GLOBAL_VARIABLES.keyRefCodice].ToString()).ToList();

                        foreach (string cod in nuovi_codici_da_tracciato)
                        {
                            if (cod == "190050")
                            {
                                Debug.WriteLine("");
                            }
                            var trList = result.Select(s => new
                            {
                                Articolo = s.Records.Where(r => r[GLOBAL_VARIABLES.keyRefCodice].ToString() == cod).FirstOrDefault(),
                                CodiceArea = s.Area,
                                CodiceCanale = s.Canale
                            }).ToList();

                            var area_out = trList.Where(t2 => t2.Articolo != null &&
                            t2.Articolo[Meta.tipo_volantino].ToString().ToLower().IndexOf("fuori volantino") >= 0)
                                .Select(s => new {
                                    CodiceArea = s.CodiceArea,
                                    CodiceCanale = s.CodiceCanale
                                }).ToList();

                            var area_in = trList.Where(t3 => t3.Articolo != null &&
                            t3.Articolo[Meta.tipo_volantino].ToString().ToLower().IndexOf("fuori volantino") < 0)
                                .Select(s => new {
                                    CodiceArea = s.CodiceArea,
                                    CodiceCanale = s.CodiceCanale
                                }).ToList();

                            foreach (var obj in trList)
                            {
                                if (obj.Articolo != null)
                                {
                                    List<string> aree_in = new List<string>();
                                    foreach (var ar in area_in)
                                    {
                                        aree_in.Add(ar.CodiceCanale + ar.CodiceArea);
                                    }
                                    obj.Articolo["areeIn"] = aree_in;
                                    List<string> aree_out = new List<string>();
                                    foreach (var ar in area_out)
                                    {
                                        aree_out.Add(ar.CodiceCanale + ar.CodiceArea);
                                    }
                                    obj.Articolo["areeOut"] = aree_out;
                                }
                            }


                        }

                        codici_cache.AddRange(nuovi_codici_da_tracciato);

                    }

                    #endregion

                    #region Ordinamento liste

                    //errors += "step6 - ";

                    for (int i = 0; i < result.Count; i++)
                    {
                        Tracciato tItem = result[i];
                        tItem.Records = tItem.Records.OrderBy(o => (Int16)o[Meta.IndiceOridinamentoSezione]).ThenBy(o => (Int16)o[GLOBAL_VARIABLES.keyIndiceOrdinamento]).ToList();
                    }

                    //errors += "step7 - ";

                    #endregion



                    if (counter2 == 0 && counter > 0)
                    {
                        errors.Add("Nessun CANALE/AREA valido per l'importazione");

                    }
                    else
                    {

                    }

                }
                else
                {

                }
            }
            catch (Exception ex)
            {
                errors.Add(ex.ToString());
            }

            impResult.liste = result;
            impResult.errors = string.Join("-", errors);

            return JsonConvert.SerializeObject(impResult);
        }

        public string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista)
        {
            IstantaLib.Utility.Logger.Log("Inizio ordinamento");

            JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
            DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
            dbGrammature = ordDB.source;
            string keySegmento = Edro21Context.Meta.segmento;
            for (int i = 0; i < listRecs.Count; i++)
            {
                var item = listRecs[i];
                string segmento = item[keySegmento].ToString();
                if (segmento == "3105026001")
                {
                    Debug.WriteLine("");
                    IstantaLib.Utility.Logger.Log("Segmento 3105026001 trovato");
                }
                item[GLOBAL_VARIABLES.keyIndiceOrdinamento] = (Int16)9999;
                Ordinamento grItem = dbGrammature.Where(g => g.CodiceSegmento == segmento).FirstOrDefault();
                if (segmento == "3105026001")
                {
                    if (grItem != null)
                    {
                        IstantaLib.Utility.Logger.Log("grItem trovato: indice " + grItem.GlobalIndice);
                    }
                    else
                    {
                        IstantaLib.Utility.Logger.Log("grItem null");
                    }
                }
                if (grItem != null)
                {
                    item[GLOBAL_VARIABLES.keyIndiceOrdinamento] = grItem.GlobalIndice;
                }
            }

            listRecs = listRecs.OrderBy(o => (Int16)o[GLOBAL_VARIABLES.keyIndiceOrdinamento]).ToList();
            IstantaLib.Utility.Logger.Log("Fine ordinamento");

            return JsonConvert.SerializeObject(listRecs);
        }
        public string getFirma(Dictionary<string, object> rec, List<Dictionary<string, object>> tracciato)
        {
            string keyArea = Edro21Context.Meta.area;
            string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
            string keyReferenzaCodice = Edro21Context.Meta.ReferenzaCodice;

            if (rec.ContainsKey(keyArea))
            {
                string codScatto = rec[keyCodice_scatto].ToString();
                List<Dictionary<string, object>> gruppo = tracciato.Where(t => t[keyCodice_scatto] == codScatto).ToList();

                string codice_gruppo = "";
                foreach (Dictionary<string, object> itemGroup in gruppo)
                {
                    if (codice_gruppo != "")
                    {
                        codice_gruppo += ",";
                    }
                    if (itemGroup.ContainsKey("Referenza"))
                    {
                        var _ref = itemGroup["Referenza"];// as Dictionary<string, object>;
                        codice_gruppo += "##";// _ref["Codice"].ToString();
                    }
                    else
                    {
                        codice_gruppo += itemGroup[keyReferenzaCodice].ToString();
                    }
                }

                return codice_gruppo;
            }
            return "";
        }


        public TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            Console.WriteLine("Esportazione volantino Edro21 versione 1.4.0.6");


            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;



            TracciatoResultKit result = new TracciatoResultKit();
            errors.Clear();
            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keySegmento = Edro21Context.Meta.segmento;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
            string keyTema = Edro21Context.Meta.tema;
            string keyPrezzo_offerta = Edro21Context.Meta.prezzo_offerta;
            string keyPrezzo_offerta_kgl = Edro21Context.Meta.prezzo_offerta_kgl;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keySettore = Edro21Context.Meta.settore;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
            string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyRefs = Edro21Context.Meta.refs;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;
            string keyM_numero_reparto = Edro21Context.Meta.numero_reparto;
            string keyM_numero_settore = Edro21Context.Meta.numero_settore;
            string keyDicituraReparto = Edro21Context.Meta.dicitura_reparto;
            string keyM_prezzo_offerta_um_com = Edro21Context.Meta.prezzo_offerta_um_com;
            string keyM_prezzo_anziche_um_com = Edro21Context.Meta.prezzo_anziche_um_com;
            string keyM_unita_fatt = Edro21Context.Meta.unita_fatt;
            string keyM_um_com = Edro21Context.Meta.um_com;
            string key_combinazioneAssegnata = Edro21Context.Meta.keyCombinazioneAssegnata;
            string key_codiceBox = Edro21Context.Meta.keyCodiceBox;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;





            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            try
            {
                //requestParams = formRequest;
                lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

                string tipo_materiale = "vol";
                Byte tipo_volantino = 1;

                //Le sette letture di questo blocco pesavano quanto tutto il resto dell'export
                //messo insieme: ora passano dalla cache e si ripetono solo se il file cambia.
                var swSource = System.Diagnostics.Stopwatch.StartNew();

                DbOrdinamento ordDB = SourceJson<DbOrdinamento>(pathOrdinamentoLista);
                dbGrammature = ordDB.source;


                DbMeccaniche mcDB = SourceJson<DbMeccaniche>(pathMeccaniche);
                dbMeccaniche = mcDB.source;


                DbACPV acpvDB = SourceJson<DbACPV>(pathACPV);

                loghibolliDB = SourceJson<DbLoghiBolli>(pathLoghiBolli);

                DbTipoDiExport tipiExportDB = SourceJson<DbTipoDiExport>(pathTipiDiExport);

                bool isWeb = false;
                if (kit.tipiDiExportInKit.Count == 1)
                {
                    var tipoDiExp = tipiExportDB.source.Find(f => f.codice == "WEB");
                    if (tipoDiExp != null)
                    {
                        isWeb = tipoDiExp.guidID == kit.tipiDiExportInKit[0].tipoDiExportGuidID;
                    }
                }

                MappaStili mappaStili = SourceJson<MappaStili>(pathMappaStili);

                FicoNamingConvention ncDB = SourceInCache(
                    pathNamingConvention,
                    p => JsonConvert.DeserializeObject<FicoNamingConvention>(File.ReadAllText(p))!);

                swSource.Stop();
                Console.WriteLine($"esportaVolantino: source del cliente pronti in {swSource.ElapsedMilliseconds} ms (caricamenti dall'avvio: {cacheSourceCliente.Caricamenti})");

                //I nomi saranno per tutte le ref identici quindi lo estraggouna volta soltanto
                List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();

                string tipoExport = "";
                foreach (TipoDiExport tItem in tipiExportDB.source)
                {
                    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                    codifica.guidIdTipoExport = tItem.guidID;
                    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, null, null, this, null);
                    exportNames.Add(codifica);
                }

                var tipoDiExpWeb = tipiExportDB.source.Find(f => f.codice == "WEB");

                if (kit.tipiDiExportInKit.Count == 1 && kit.tipiDiExportInKit[0].tipoDiExportGuidID == tipoDiExpWeb.guidID)
                {
                    tipoExport = "WEB";
                }

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();

                int counter = 0;
                tracciato = tracciato.OrderBy(o => Convert.ToInt32(o.recordInTracciato[GLOBAL_VARIABLES.keyIndiceOrdinamento])).ToList();
                for (int i = 0; i < tracciato.Count; i++)
                {
                    //assegniamo prima tutte le meccaniche tradotte perchè alcuni processi analizzano tutto il gruppo PRIMA che il record singolo sia stato processato
                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;
                    var meccOrigin = recItem[meccanica_origine].ToString();
                    var meccCorrispondente = dbMeccaniche.Where(f => f.NomeOrigine == meccOrigin).FirstOrDefault();
                    if (meccCorrispondente != null)
                    {
                        recItem[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                    }
                }

                for (int i = 0; i < tracciato.Count; i++)
                {

                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;

                    if (recItem[GLOBAL_VARIABLES.keyRefCodice].ToString() == "4058997")
                    {
                        recItem.ToString();
                    }

                    string inout_vol = recItem[keyTipo_volantino].ToString().ToLower();

                    bool is_fuori_volantino = (inout_vol.IndexOf("fuori volantino") >= 0) ||
                        (inout_vol.IndexOf("opportunit") >= 0);

                    if (is_fuori_volantino) // !is_fuori_volantino && FuoriVolField.IndexOf("volantino") < 0)
                    {
                        continue;
                    }

                    if (!recItem.ContainsKey(key_combinazioneAssegnata))
                    {
                        recItem.ToString();
                        continue;
                    }

                    //var meccOrigin = recItem[meccanica_origine].ToString();
                    //var meccCorrispondente = dbMeccaniche.Where(f => f.NomeOrigine == meccOrigin).FirstOrDefault();
                    //if (meccCorrispondente != null)
                    //{
                    //    recItem[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                    //}

                    if (!recItem.ContainsKey(GLOBAL_VARIABLES.keySiglaReparto))
                    {
                        switch (recItem[keyReparto].ToString())
                        {
                            case "29":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "CA";
                                break;

                            case "33":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "OF";
                                break;

                            case "31":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PE";
                                break;

                            case "25":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "GA";
                                break;

                            case "27":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "FO";
                                break;

                            case "01":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "DAL";
                                break;

                            case "03":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "BV";
                                break;

                            case "21":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "SG";
                                break;

                            case "24":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "LS";
                                break;

                            case "05":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                break;
                            case "07":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                break;

                            case "09":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "CP";
                                break;

                            default:
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "EX";
                                break;
                        }
                    }



                    string tipo_tema = recItem[keyTipo_tema].ToString().ToLower();
                    string tema = recItem[keyTema].ToString().ToLower();
                    string ruolo = recItem[keyRuolo].ToString().ToLower();
                    string nota_category = recItem[keyNote_category].ToString();

                    string sezione = recItem[keySezione].ToString();

                    Int64 reparto = Int64.Parse(recItem[keyReparto].ToString());
                    Int64 settore = Int64.Parse(recItem[keySettore].ToString());
                    string segmento = recItem[keySegmento].ToString();
                    string meccanica = recItem[meccanica_origine].ToString();


                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();
                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    string codice_scatto = recItem[keyCodice_scatto].ToString();
                    string codice_area = recItem[keyArea].ToString();

                    decimal paghi = recItem[keyPrezzo_offerta].ToDecimal();
                    decimal paghi_kgl = recItem[keyPrezzo_offerta_kgl].ToDecimal();
                    decimal anziche = recItem[keyPrezzo_anziche].ToDecimal();
                    decimal anziche_kgl = recItem[keyPrezzo_anziche_kgl].ToDecimal();
                    decimal prezzo_um_com = recItem[keyM_prezzo_offerta_um_com].ToDecimal();
                    decimal anziche_um_com = recItem[keyM_prezzo_anziche_um_com].ToDecimal();
                    string distintivita = recItem[keyDistintivita].ToString();

                    string um = recItem[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string um_fatt = recItem[keyM_unita_fatt].ToString();
                    string um_com = recItem[keyM_um_com].ToString();


                    decimal peso = recItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                    string descr_1 = "";
                    string descr_brand = "";
                    string descr_tipo = "";
                    string descr_gramm = "";
                    if (codice_gruppo.Contains(",") && recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                    {
                        descr_1 = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr1].ToString();
                        descr_brand = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr2].ToString();
                        descr_tipo = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr3].ToString();
                        descr_gramm = (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)[GLOBAL_VARIABLES.keyDescr4].ToString();
                    }
                    else
                    {
                        descr_1 = recItem[GLOBAL_VARIABLES.keyDescr1].ToString();
                        descr_brand = recItem[GLOBAL_VARIABLES.keyDescr2].ToString();
                        descr_tipo = recItem[GLOBAL_VARIABLES.keyDescr3].ToString();
                        descr_gramm = recItem[GLOBAL_VARIABLES.keyDescr4].ToString();
                    }

                    decimal scontoAgenzia = recItem[keySconto_agenzia].ToDecimal();
                    decimal N_MM = recItem[keyN_MM].ToDecimal();
                    decimal N_FID = recItem[keyN_FID].ToDecimal();
                    decimal M_MM = recItem[keyM_MM].ToDecimal();
                    decimal M_FID = recItem[keyM_FID].ToDecimal();

                    string punti1 = recItem[keyPunti_1].ToString();
                    string punti2 = recItem[keyPunti_2].ToString();
                    string range1 = recItem[keyRange_1].ToString();
                    string range2 = recItem[keyRange_2].ToString();
                    string note_cat = recItem[keyNote_category].ToString();
                    string tipo_punti = recItem[keyTipo_punti].ToString();

                    string tipo_punti1 = recItem[keyTipo_punti].ToString();
                    string tipo_punti2 = recItem[keyTipo_punti].ToString();

                    string descrizioneParagraphStyle = "";

                    //decimal scontoMM = (decimal)recItem["scontoMM"]; 
                    //decimal scontoFID = (decimal)recItem["scontoFID"];

                    //sezione riassegnazione variabili cambiate di nome (In attesa del fix)
                    //recItem["sconto_norm"] = recItem[keySconto_MM];
                    //recItem["sconto_fid"] = recItem[keySconto_FID];
                    var sconto_norm = recItem[keySconto_MM].ToString();
                    var sconto_fid = recItem[keySconto_FID].ToString();
                    //recItem["test"] = true;

                    bool basso_fisso = ((tipo_tema.ToLower().Contains("bass") && tipo_tema.ToLower().Contains("fiss")) || (tipo_tema.ToLower().Contains("bef") && !tipo_tema.ToLower().Contains("befana"))) ||
                        ((tema.ToLower().Contains("bass") && tema.ToLower().Contains("fiss")) || (tema.ToLower().Contains("bef") && !tema.ToLower().Contains("befana"))) ||
                        (ruolo.ToLower().Contains("b&f")) ||
                        (nota_category.ToLower().Contains("bass") && nota_category.ToLower().Contains("fiss"));

                    if (!basso_fisso && sezione != null)
                        basso_fisso = sezione.ToLower().Contains("b&f") || (sezione.ToLower().Contains("bass") && sezione.ToLower().Contains("fiss"));

                    //if (tItem.tipo.Value == 2)
                    //Response.Write(nota_category + " - " + basso_fisso.ToString());



                    //Recupero le 4 descrizioni
                    string[] descrizioni_articolo_tracciato = get4Descrizioni(recItem, (tipo_volantino == (Byte)TipoImportazione.PoP), false, false);
                    string[] descrizioni_articolo = new string[] { descr_1, descr_brand, descr_tipo, descr_gramm };

                    #region Decifrazione meccanica e controllo "Al Kg al Lt"

                    Ordinamento gItem = dbGrammature.Where(s => s.CodiceSegmento == segmento).FirstOrDefault();

                    string str_offerta_unita = "";
                    string str_offerta_unita_sconto = "";
                    string str_offerta_unita_etto = "";
                    string str_offerta_unita_sconto_etto = "";
                    string str_offerta_unita_secondo = "";
                    string str_offerta_unitaTdopo = "";

                    bool flag_meccanica_unita = false;
                    bool flag_articolo_2x1_bis = false;
                    bool flag_articolo_2x1_bis_x_errore = false;




                    //Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == meccanica).FirstOrDefault();

                    string mIem_meccanica = recItem[key_combinazioneAssegnata].ToString();
                    Meccanica mItem = new Meccanica();
                    mItem.NomeTraduzione = mIem_meccanica;

                    //if (mItem == null)
                    //{

                    //    result.errors += "Ref. " + codice_referenza + " - Meccanica " + meccanica + " non trovata!";

                    //    continue;
                    //}

                    #region note crocettatura

                    //E' ancora da TESTARE
                    string note_crocettatura = "";
                    List<Dictionary<string, object>> myGroup = lista_tracciato.Where(l => l[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == codice_gruppo).ToList();
                    List<Dictionary<string, object>> myGroupFiltered = myGroup.Where(r => filtroConfezione(recItem, r, myGroup)).ToList();

                    //Imposto le foto secondarie del gruppo
                    List<FotoElementoGruppo> membriGruppoFoto = RefsHelper.getFotoSecondarieDelGruppo(myGroupFiltered);
                    recItem[GLOBAL_VARIABLES_FICO.keyMembriGruppoFoto] = membriGruppoFoto;

                    #region nuova implementazione
                    /*if (!req.confronta_liste)
                    {
                        if (oItem.CodiceScatto != "")
                        {*/
                    note_crocettatura = getNoteCrocettamento(recItem, myGroupFiltered);


                    #endregion

                    if (is_fuori_volantino)
                        note_crocettatura = "";


                    //current_codScatto = oItem.codice_scatto;

                    #endregion

                    decimal paghi_kg_lt_indipendente = paghi_kgl;
                    //Response.Write(oItem.codice_referenza + " -> " + oItem.meccanica.ToLower()+"<br>");
                    var nmFid = false;
                    if (meccanica.ToLower() == "nm fid" || meccanica.ToLower() == "nm mix fid")
                    {
                        nmFid = true;
                        //recItem[keyPaghi_secondo] = paghi;
                        //recItem[keyPaghi_kgl_secondo] = paghi_kgl;
                        //recItem[keyPaghi_due_pezzi] = anziche;
                        //recItem["prezzo_offerte_kgl_lt_indipendente"] = anziche_kgl;
                    }

                    string paghi_etto = "";
                    //recItem[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 999999;
                    if (gItem != null)
                    {
                        //recItem[GLOBAL_VARIABLES.keyIndiceOrdinamento] = gItem.Indice;

                        string u_str = "Kg";
                        if (um.ToLower() == "litro" || um.ToLower() == "lt")
                            u_str = "l";

                        str_offerta_unita = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi_kg_lt_indipendente));
                        str_offerta_unitaTdopo = String.Format("€ {0} al {1}", MathExt.DecimalRoundToString(paghi_kg_lt_indipendente), (u_str.ToLower() == "l" ? "lt" : u_str.ToLower()));
                        str_offerta_unita_sconto = String.Format("al {0} da € {1} a € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(anziche_kgl), MathExt.DecimalRoundToString(paghi_kgl));
                        if (nmFid/*recItem.ContainsKey(keyPaghi_kgl_secondo)*/)
                            str_offerta_unita_secondo = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi_kgl/*recItem[keyPaghi_kgl_secondo].ToDecimal()*/));

                        paghi_etto = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                        string anziche_etto = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');

                        str_offerta_unita_etto = String.Format("al {0} € {1}", u_str.ToLower(), paghi_etto);
                        str_offerta_unita_sconto_etto = String.Format("al {0} € {1} anzichè € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi), MathExt.DecimalRoundToString(anziche));

                        recItem[keyM_numero_reparto] = gItem.numeroReparto;
                        recItem[keyM_numero_settore] = gItem.numeroSettore;

                        //Aggiunto il 10/03/2017 appositamente per l'uscita del TAG ERRORE che viene impostato sotto
                        flag_articolo_2x1_bis_x_errore = ((mItem.NomeTraduzione.IndexOf("NM_MM") >= 0 ||
                            mItem.NomeTraduzione.IndexOf("NM_FID") >= 0 ||
                            mItem.NomeTraduzione.IndexOf("NM_MIX_MM") >= 0 ||
                            mItem.NomeTraduzione.IndexOf("NM_MIX_FID") >= 0 || mItem.NomeTraduzione.ToLower().IndexOf("50sulsecondo") >= 0));


                        //recItem["gruppo_settori"] = gItem.Se


                        if (gItem.Food)
                        {

                            if (peso != 1 && peso != 0.1M)
                            {
                                if (um_fatt.ToLower() != "peso")
                                {
                                    //Response.Write("M -> " + meccanica_tradotta +"<br>");

                                    flag_meccanica_unita = true;

                                    flag_articolo_2x1_bis = ((mItem.NomeTraduzione.IndexOf("NM_MM") >= 0 ||
                                    mItem.NomeTraduzione.IndexOf("NM_FID") >= 0 ||
                                    mItem.NomeTraduzione.IndexOf("NM_MIX_MM") >= 0 ||
                                    mItem.NomeTraduzione.IndexOf("NM_MIX_FID") >= 0 || mItem.NomeTraduzione.ToString().IndexOf("50sulsecondo") >= 0) &&
                                    (peso >= 0.051M && peso <= 0.099M));


                                    string meccanica_temp = recItem[key_combinazioneAssegnata].ToString();

                                    if (meccanica_temp.ToLower().Contains("50sulsecondo") && peso < 0.1M)
                                    {

                                        string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                        string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                        str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                        if (peso <= 0.049M)
                                        {
                                            paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                            str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);
                                            str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                        }

                                    }
                                    else if (peso > 0.1M ||
                                        ((mItem.NomeTraduzione.IndexOf("NM_MM") >= 0 ||
                                        mItem.NomeTraduzione.IndexOf("NM_FID") >= 0 ||
                                        mItem.NomeTraduzione.IndexOf("NM_MIX_MM") >= 0 ||
                                        mItem.NomeTraduzione.IndexOf("NM_MIX_FID") >= 0) &&
                                        (peso >= 0.051M && peso <= 0.099M))
                                        )
                                    {

                                        //Questa parte l'ho riportata sopra perchè questi dati servono A PRESCINDERE!

                                    }
                                    else
                                    {
                                        string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                        string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                        str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);

                                        paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                        str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);

                                        if (nmFid/*recItem.ContainsKey(keyPaghi_kgl_secondo)*/ && (peso >= 0.01M && peso <= 0.49M))
                                        {
                                            string paghi_100g_sec = MathExt.DecimalRoundToString(Decimal.Round((/*(decimal)recItem[keyPaghi_kgl_secondo]*/paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                            str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g_sec);
                                        }
                                    }

                                    //Response.Write("campo_offerta_KgL -> " + str_offerta_unita + "<br>");
                                    //Response.Write("campo_offerta_KgL_secondo -> " + str_offerta_unita_secondo + "<br>");
                                }

                            }

                            if ((mItem.NomeTraduzione.IndexOf("NM_MM") >= 0 ||
                                mItem.NomeTraduzione.IndexOf("NM_FID") >= 0 ||
                                mItem.NomeTraduzione.IndexOf("NM_MIX_MM") >= 0 ||
                                mItem.NomeTraduzione.IndexOf("NM_MIX_FID") >= 0) && (peso == 1 || peso == 0.1M))
                            {
                                flag_meccanica_unita = true;
                            }
                        }


                    }
                    else
                    {
                        errors.Add("Segmento: " + segmento + " non trovato");
                    }

                    //if ()
                    string descr_gr_copy = descr_gramm;


                    //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                    //Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                    //string meccanica_tradotta = mec2.NomeTraduzione;
                    string meccanica_tradotta = recItem[key_combinazioneAssegnata].ToString();
                    byte[] str_desc2_bytes = System.Text.Encoding.UTF8.GetBytes(descr_brand);
                    string _brand = System.Text.Encoding.UTF8.GetString(str_desc2_bytes);
                    byte[] str_desc3_bytes = System.Text.Encoding.UTF8.GetBytes(descr_tipo);
                    string _tipogusto = System.Text.Encoding.UTF8.GetString(str_desc3_bytes);
                    byte[] str_desc4_bytes = System.Text.Encoding.UTF8.GetBytes(descr_gr_copy);
                    string _gramm = System.Text.Encoding.UTF8.GetString(str_desc4_bytes);

                    #endregion

                    #region CSV record

                    byte[] str_desc1_bytes = System.Text.Encoding.UTF8.GetBytes(descr_1);

                    if (true)//!req.confronta_liste)
                    {
                        //In assenza di confronto aggiungo questo record a CSV
                    }

                    #endregion
                    //if (esportazione_da_menabo)
                    //{
                    //    //A rpescindere se è esportazione menabo sovrascrivo l'eventuale parametro ricevuto dalla form
                    //    //id_mastro = Int16.Parse(recItemGroup["mastro"].ToString());
                    //    
                    //    //id_mastro = 0;
                    //}

                    //if (id_mastro > 0 )
                    //{

                    //controllo il mismatch prezzi per il reparto 9 e se corrisponde rimuovo il prezzo paghi
                    bool mismatchPrezzi = false;
                    if (reparto == 9 && (recItem[key_combinazioneAssegnata].ToString().ToLower().IndexOf("percento_fid_all") >= 0 ||
                        recItem[key_combinazioneAssegnata].ToString().ToLower().IndexOf("percento_mm_all") >= 0))
                    {
                        var prezzoBase = myGroup[0][keyPrezzo_offerta].ToDecimal();
                        foreach (var item in myGroup)
                        {
                            if (prezzoBase != item[keyPrezzo_offerta].ToDecimal())
                            {
                                mismatchPrezzi = true;
                                break;
                            }
                        }
                    }

                    bool foto = recItem[referenza_pilota].ToString() == "S";
                    bool esempio = recItem[potenziale_esempio].ToString() != "";
                    int statoSelezione = 3;
                    if (recItem.ContainsKey(keyStatoSelezione))
                    {

                        statoSelezione = int.Parse(recItem[keyStatoSelezione].ToString());
                    }
                    else
                    {
                        //Console.WriteLine($"Attenzione {codice_referenza} non ha la SELEZIONE!");
                    }

                    if (recItem["Referenza.Codice"].ToString() == "5263850")
                    {
                        Debug.WriteLine("");
                    }

                    //if (foto || esempio)// || req.confronta_liste)
                    if (statoSelezione == 1 || statoSelezione == 2)
                    {
                        #region xml record                                                                    

                        if (counter == 0)
                        {


                        }


                        counter++;

                        //Aggiusto 0 nei prezzi addestramento nativi

                        recItem[keyPrezzo_offerta] = mismatchPrezzi ? "" : MathExt.DecimalRoundToString(paghi);
                        recItem[keyPrezzo_offerta_kgl] = MathExt.DecimalRoundToString(paghi_kgl);
                        //recItem["prezzo_offerta_KgL"] = MathExt.DecimalRoundToString(paghi_kgl);
                        var prezzo_offerta_KgL = MathExt.DecimalRoundToString(paghi_kgl);
                        recItem[keyPrezzo_anziche] = MathExt.DecimalRoundToString(anziche);
                        recItem[keyPrezzo_anziche_kgl] = MathExt.DecimalRoundToString(anziche_kgl);
                        recItem[keyM_prezzo_offerta_um_com] = MathExt.DecimalRoundToString(prezzo_um_com);
                        recItem[keyM_prezzo_anziche_um_com] = MathExt.DecimalRoundToString(anziche_um_com);




                        string sez_data = "";



                        KeyValuePair<string, object> dicitura_reparto = getDicituraSuReparto(recItem, recItem[key_combinazioneAssegnata].ToString(), tipo_materiale.ToLower(), codice_area);

                        var DicituraReparto = dicitura_reparto.Value.ToString();


                        if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_sdb") > 0 &&
                            ((sezione.ToLower().IndexOf("tipico") >= 0 && sezione.IndexOf("benessere") >= 0) ||
                            (distintivita.ToLower().IndexOf("benessere") >= 0 && sezione.ToLower().IndexOf("benessere") >= 0) ||
                            (distintivita.ToLower().IndexOf("tipico") >= 0 && sezione.ToLower().IndexOf("tipico") >= 0)))
                        {
                            recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                        }
                        else if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_bdp") > 0 &&
                            sezione.ToLower().Contains("buono del paese"))
                        {
                            recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                        }


                        //if (oItem.nota_category != null)
                        //if (basso_fisso)
                        //    recItem["logo_bassi_fissi"] = "logo_BassieFissi.psd";
                        //else
                        //    recItem["logo_bassi_fissi"] = "";



                        //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia
                        var loghibolli = getLoghiEBolliNew(recItem, descrizioni_articolo, gItem, 1, promoContext, kit, tipoExport, myGroup);
                        List<LogoBollo> _bolliloghi = new List<LogoBollo>();
                        foreach (var item in loghibolli.Keys)
                        {
                            if (item != "")
                            {
                                string val = loghibolli[item];
                                LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == val);
                                if (lbItem != null)
                                    _bolliloghi.Add((LogoBollo)lbItem.Clone());
                                else
                                {
                                    if (item == "logo_attributo_it")
                                    {
                                        recItem["logo_attributo_it"] = val;
                                        LogoBollo logo_attributo_it = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_attributo_it");
                                        if (logo_attributo_it != null)
                                            _bolliloghi.Add((LogoBollo)logo_attributo_it.Clone());
                                    }
                                }
                            }
                        }

                        recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;

                        //if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                        //{
                        //    (recItem[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] as Dictionary<string, object>)["alessioTest"] = _bolliloghi;

                        //}


                        //recItem["prezzo_offerta_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi);
                        //recItem["prezzo_offerta_KgL_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi_kgl);

                        var prezzo_offerta_EURprima = mismatchPrezzi ? "" : "€ " + MathExt.DecimalRoundToString(paghi);
                        var prezzo_offerta_KgL_EURprima = "€ " + MathExt.DecimalRoundToString(paghi_kgl);


                        //string str_anziche = String.Format("anzichè € {0}", MathExt.Round(oItem.anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));
                        string str_anziche = String.Format("€ {0}", MathExt.Round(anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));

                        //recItem["campo_offerta_KgL"] = str_offerta_unita;
                        //recItem["campo_offerta_KgLt_dopo"] = str_offerta_unitaTdopo;
                        //recItem["campo_offerta"] = str_anziche;
                        //recItem["campo_offerta_KgL_sconto"] = str_offerta_unita_sconto;

                        var campo_offerta_KgL = str_offerta_unita;
                        var campo_offerta_KgLt_dopo = str_offerta_unitaTdopo;
                        var campo_offerta = str_anziche;
                        var campo_offerta_KgL_sconto = str_offerta_unita_sconto;

                        var sconto_effettivo = "";
                        var sconto_effettivo_grande = "";


                        if (scontoAgenzia >= 0)
                        {
                            //recItem["sconto_effettivo"] = "sconto " + MathExt.DecimalRoundToString(scontoAgenzia) + "%";

                            //if (scontoAgenzia == 0)
                            //    recItem["sconto_effettivo_grande"] = "-00,00%";
                            //else
                            //{
                            //    recItem["sconto_effettivo_grande"] = "-" + MathExt.DecimalRoundToString(scontoAgenzia) + "%";
                            //}

                            sconto_effettivo = "sconto " + MathExt.DecimalRoundToString(scontoAgenzia) + "%";

                            if (scontoAgenzia == 0)
                                sconto_effettivo_grande = "-00,00%";
                            else
                            {
                                sconto_effettivo_grande = "-" + MathExt.DecimalRoundToString(scontoAgenzia) + "%";
                            }
                        }

                        //recItem["campo_offerta_conf"] = "a conf. € " + MathExt.DecimalRoundToString(paghi);
                        //recItem["campo_offerta_ofalkg"] = "€ " + MathExt.DecimalRoundToString(anziche_kgl);
                        //recItem["campo_offerta_conf_sconto"] = "a conf. da € " + MathExt.DecimalRoundToString(anziche) + " a € " + MathExt.DecimalRoundToString(paghi);

                        var campo_offerta_conf = "a conf. € " + MathExt.DecimalRoundToString(paghi);
                        var campo_offerta_ofalkg = "€ " + MathExt.DecimalRoundToString(anziche_kgl);
                        var campo_offerta_conf_sconto = "a conf. da € " + MathExt.DecimalRoundToString(anziche) + " a € " + MathExt.DecimalRoundToString(paghi);

                        decimal pz_etto_dec = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero);
                        string prezzo_offerta_etto = pz_etto_dec.ToString("0.00").Replace('.', ',');

                        decimal etto_dec = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero);
                        string campo_offerta_etto = "€ " + etto_dec.ToString("0.00").Replace('.', ',');
                        //recItem["prezzo_offerta_etto"] = prezzo_offerta_etto;
                        //recItem["prezzo_offerta_etto_EURprima"] = "€ " + prezzo_offerta_etto;
                        var prezzo_offerta_etto_EURprima = "€ " + prezzo_offerta_etto;
                        //recItem["campo_offerta_etto"] = campo_offerta_etto;



                        //recItem["stringa_etto"] = str_offerta_unita_sconto_etto;
                        var stringa_etto = str_offerta_unita_sconto_etto;

                        string differenza_etto_note = "";

                        ///*Non campionato


                        string prezzo_offerta_etto_LISTA = MathExt.DecimalRoundToString(prezzo_um_com);// MathExt.Round((RecInXml.prezzo_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                        string campo_offerta_etto_LISTA = "€ " + MathExt.DecimalRoundToString(anziche_um_com);//MathExt.Round((RecInXml.anziche_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                        string str_etto_LISTA = String.Format("al {0} € {1} anzichè € {2}", um_com, prezzo_um_com.ToString(), anziche_um_com.ToString()); //MathExt.DecimalRoundToString(RecInXml.prezzo_unita_misura_com.Value), MathExt.DecimalRoundToString(RecInXml.anziche_unita_misura_com.Value));

                        //recItem["prezzo_offerta_etto_LISTA"] = prezzo_offerta_etto_LISTA;
                        //recItem["prezzo_offerta_etto_EURprima_LISTA"] = "€ " + prezzo_offerta_etto_LISTA;
                        var prezzo_offerta_etto_EURprima_LISTA = "€ " + prezzo_offerta_etto_LISTA;
                        //recItem["campo_offerta_etto_LISTA"] = campo_offerta_etto_LISTA;
                        //recItem["stringa_etto_LISTA"] = str_offerta_unita_sconto_etto;
                        var stringa_etto_LISTA = str_offerta_unita_sconto_etto;

                        if ((pz_etto_dec != prezzo_um_com || etto_dec != anziche_um_com) &&
                            recItem[key_combinazioneAssegnata].ToString().Contains("_boxetto"))
                        {
                            differenza_etto_note = "prezzo Etto diverso su lista";
                        }



                        decimal paghi_due_pezzi = nmFid ? anziche : 0;
                        //decimal paghi_secondo = recItem.ContainsKey(keyPaghi_secondo) ? (decimal)recItem[keyPaghi_secondo] : 0;
                        decimal paghi_secondo = nmFid ? paghi : 0;

                        //recItem["prezzo_NOofferta_1pezzo"] = MathExt.DecimalRoundToString(paghi);
                        //recItem["prezzo_NOofferta_1pezzo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi);
                        //recItem["prezzo_NOofferta_2pezzi"] = MathExt.DecimalRoundToString(paghi_due_pezzi);
                        var prezzo_NOofferta_1pezzo = MathExt.DecimalRoundToString(paghi);
                        var prezzo_NOofferta_1pezzo_EURprima = "€ " + MathExt.DecimalRoundToString(paghi);
                        var prezzo_NOofferta_2pezzi = MathExt.DecimalRoundToString(paghi_due_pezzi);
                        //recItem["prezzo_offerta_secondo"] = MathExt.DecimalRoundToString(paghi_secondo);
                        //recItem["prezzo_offerta_secondo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi_secondo);
                        var prezzo_offerta_secondo = MathExt.DecimalRoundToString(paghi_secondo);
                        var prezzo_offerta_secondo_EURprima = "€ " + MathExt.DecimalRoundToString(paghi_secondo);
                        //recItem["campo_offerta_KgL_secondo"] = str_offerta_unita_secondo;
                        var campo_offerta_KgL_secondo = str_offerta_unita_secondo;


                        string _tipo_range = getTipoRange(recItem, "1");
                        //recItem["PezzConf"] = "1 " + _tipo_range;
                        var PezzConf = "1 " + _tipo_range;

                        //recItem["campo_x1"] = "1 " + _tipo_range + " € " + MathExt.DecimalRoundToString(paghi);
                        var campo_x1 = "1 " + _tipo_range + " € " + MathExt.DecimalRoundToString(paghi);

                        var PezzConf_NM = "";
                        //if (recItem[key_combinazioneAssegnata].ToString().IndexOf("NM_") >= 0)//Meccanica BIS
                        //{
                        //    if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_FID") < 0)
                        //        recItem["PezzConf_NM"] = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM));
                        //    else
                        //        recItem["PezzConf_NM"] = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID));
                        //}
                        //else
                        //    recItem["PezzConf_NM"] = "";
                        if (recItem[key_combinazioneAssegnata].ToString().IndexOf("NM_") >= 0)//Meccanica BIS
                        {
                            if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_FID") < 0)
                                PezzConf_NM = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM));
                            else
                                PezzConf_NM = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID));
                        }
                        else
                            PezzConf_NM = "";


                        string un_pezzo_euro = " € " + MathExt.DecimalRoundToString(paghi);

                        //recItem["N_MM_str"] = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        //recItem["M_MM_str"] = MathExt.DecimalOrIntToString(M_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        //recItem["N_FID_str"] = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID)) + un_pezzo_euro;//xml_writer.WriteElementString(keyN_FID, Helpers.MathExt.DecimalOrIntToString(oItem.n_fidelity.Value) + " " + ((oItem.n_fidelity.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        //recItem["M_FID_str"] = MathExt.DecimalOrIntToString(M_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_FID)) + un_pezzo_euro;

                        var N_MM_str = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        var M_MM_str = MathExt.DecimalOrIntToString(M_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        var N_FID_str = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID)) + un_pezzo_euro;//xml_writer.WriteElementString(keyN_FID, Helpers.MathExt.DecimalOrIntToString(oItem.n_fidelity.Value) + " " + ((oItem.n_fidelity.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                        var M_FID_str = MathExt.DecimalOrIntToString(M_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_FID)) + un_pezzo_euro;


                        if (flag_articolo_2x1_bis_x_errore)
                        {

                            if ((N_MM != 2 || N_MM != 1) &&
                                (mItem.NomeTraduzione.IndexOf("NM_MM") >= 0 || mItem.NomeTraduzione.IndexOf("NM_MIX_MM") >= 0)
                                )
                            {
                                note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                            }
                            else if ((N_FID != 2 || M_FID != 1) &&
                                (mItem.NomeTraduzione.IndexOf("NM_FID") >= 0 || mItem.NomeTraduzione.IndexOf("NM_MIX_FID") >= 0 || mItem.NomeTraduzione.IndexOf("50SulSecondo") >= 0)
                                )
                            {
                                note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                            }
                        }


                        if (recItem[key_combinazioneAssegnata].ToString().IndexOf("PUNTI_PERCENTO") >= 0 || recItem[key_combinazioneAssegnata].ToString().IndexOf("PUNTI_TP") >= 0)
                        {
                            if (punti1 == "")
                            {
                                note_crocettatura += "<br>ERRORE: CONTROLLARE VALORI RANGE/PUNTI";
                            }
                        }

                        if (differenza_etto_note != "")
                        {
                            note_crocettatura += ("<br>" + differenza_etto_note);
                        }

                        //recItem["range1_xExport"] = range1;

                        if (range1 != "")
                            //recItem["range1_xExport"] = range1 + " " + getTipoRange(recItem, range1);
                            range1 = range1 + " " + getTipoRange(recItem, range1);


                        tipo_punti1 = getTipoPunti(tipo_punti, punti1);


                        //recItem["range2_xExport"] = "";
                        //recItem["range2_xExport"] = range2 + " " + getTipoRange(recItem, range2);
                        range2 = range2 + " " + getTipoRange(recItem, range2);
                        tipo_punti2 = getTipoPunti(tipo_punti, punti2);



                        if (note_cat.Replace(" ", "") == "")
                            recItem[keyNote_category] = "";
                        else
                            recItem[keyNote_category] = recItem[keyNote_category].ToString().Replace("\r\n", "<br>");


                        //recItem["note"] = note_crocettatura;
                        var note = note_crocettatura;


                        //Ripristino la grammatura originale come da excel!
                        recItem[GLOBAL_VARIABLES.keyDescr4] = descr_gr_copy;



                        #endregion

                        tracciato[i].recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = exportNames;

                        #region compiledfield
                        var combinazioneAssegnata = recItem[key_combinazioneAssegnata].ToString();
                        var codiceBox = recItem[key_codiceBox].ToString();

                        if (!recItem.ContainsKey(keyM_numero_reparto))
                        {
                            throw new Exception("Numero reparto non specificato per il prodotto: " + recItem["Referenza.Codice"] + ". Il gItem è " + (gItem == null ? "null" : "presente") + ", il segmento che non è stato trovato è: " + segmento);
                        }

                        var numero_reparto = int.Parse(recItem[keyM_numero_reparto].ToString());
                        var guidArea = kit.guidArea;
                        var guidCanale = kit.guidCanale;
                        var areaObj = acpvDB.aree.Find(f => f.guidID == guidArea);
                        var area = areaObj != null ? areaObj.sigla : "";
                        var canaleObj = acpvDB.canali.Find(f => f.guidID == guidCanale);
                        var canale = canaleObj != null ? canaleObj.sigla : "";
                        //parseMeccanica_provvisorio(objRef, allEtichette, pathLavorazione, area, canale) {
                        var contesto_promo = recItem.ContainsKey("Context.Promo") ? recItem["Context.Promo"] as List<FicoContextField> : new List<FicoContextField>();
                        var materiale = cercaChiaveContesto("materiale", contesto_promo);
                        var temaContesto = cercaChiaveContesto("tema", contesto_promo);
                        var allEtichette = recItem["allEtichette"] as List<string>;
                        var grafica_50al50 = allEtichette.Contains("SEZ. 50 AL 50");
                        bool isMZLOC = ((tema.ToUpper().IndexOf("LOC") >= 0 && materiale == "MZ") || allEtichette.Contains("MZLOC"));

                        var suffix_plus = "";
                        if (materiale == "EV" && combinazioneAssegnata != "validita")
                            suffix_plus = "_evento";

                        if (materiale == "ISTITUZIONALE" && combinazioneAssegnata != "validita")
                            suffix_plus = "_BFist";

                        if (materiale == "INT" && combinazioneAssegnata != "validita")
                            suffix_plus = "_INT";

                        if (materiale == "RIL" && combinazioneAssegnata != "validita")
                            suffix_plus = "_RIL";

                        #region dichiarazione box
                        List<BoxIndd> boxIndesignList = new List<BoxIndd>();
                        if (recItem["Referenza.Codice"].ToString() == "5589800")
                        {
                            Debug.WriteLine("Hey");
                        }
                        var prezzoOfferta = recItem["prezzo_offerta"].ToString();
                        if (codiceBox == "BOX1")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                            interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                            interprete.assignCompiledField("sconto_fid", paragraphName, sconto_fid);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "PezzConf_NM", codiceBox, canale);
                            interprete.assignCompiledField("PezzConf_NM", paragraphName, PezzConf_NM);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                            if (canale != "SC")
                            {
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }

                                if (materiale != "EV")
                                {
                                    interprete.removeCompiledField("sy_etto");
                                    interprete.removeCompiledField("LBL_Carte");

                                }
                            }
                        }
                        else if (codiceBox == "BOX12")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                            interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                            interprete.assignCompiledField("sconto_fid", paragraphName, sconto_fid);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                            if (canale != "SC")
                            {
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                            }
                        }
                        else if (codiceBox == "BOX6")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale);
                            interprete.assignCompiledField("prezzo_offerta_etto", paragraphName, prezzo_offerta_etto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                            interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_etto", paragraphName, campo_offerta_etto);

                            if (canale != "SC")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_etto_EURprima", paragraphName, prezzo_offerta_etto_EURprima);
                            }

                            if (!(meccanica_tradotta.IndexOf("_sdb") >= 0))
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                interprete.removeCompiledField("fondo_distintivita_SDB");
                            }

                            if (!(meccanica_tradotta.IndexOf("_bdp") >= 0))
                            {
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_BDP");
                            }

                        }
                        else if (codiceBox == "BOX40")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, "campo_offerta");

                            if (sezione == "B&F RICHIAMO VOLANTINO")
                            {
                                interprete.removeCompiledField("fondo_BeF");
                                interprete.removeCompiledField("margherita_BeF");
                                interprete.removeCompiledField("parentesi_BeF");
                                interprete.removeCompiledField("sy_ombra");
                                //interprete.removeCompiledField("immagine*");
                                //interprete.removeCompiledField("foto_secondaria*");
                                interprete.removeCompiledField("foto_extra*");
                                interprete.removeCompiledField("sfondo");
                            }
                        }
                        else if (codiceBox == "BOX41")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, "campo_offerta");

                            if (sezione == "B&F RICHIAMO VOLANTINO")
                            {
                                interprete.removeCompiledField("fondo_BeF");
                                interprete.removeCompiledField("margherita_BeF");
                                interprete.removeCompiledField("parentesi_BeF");
                                interprete.removeCompiledField("sy_ombra");
                                interprete.removeCompiledField("immagine*");
                                interprete.removeCompiledField("foto_secondaria*");
                                interprete.removeCompiledField("foto_extra*");
                                interprete.removeCompiledField("sfondo");
                            }
                        }
                        else if (codiceBox == "BOX4")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);
                        }
                        else if (codiceBox == "BOX7")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "PezzConf_NM", codiceBox, canale);
                            interprete.assignCompiledField("PezzConf_NM", paragraphName, PezzConf_NM);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "M_MM", codiceBox, canale);
                            interprete.assignCompiledField("M_MM", paragraphName, recItem["M_MM"].ToString());
                        }
                        else if (codiceBox == "BOX14")
                        {
                            string paragraphName = "";
                            if (recItem.ContainsKey("range_2"))
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "range2", codiceBox, canale);
                                interprete.assignCompiledField("range2", paragraphName, range2);
                            }

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "tipo_punti2", codiceBox, canale);
                            interprete.assignCompiledField("tipo_punti2", paragraphName, tipo_punti2);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "punti2", codiceBox, canale);
                            interprete.assignCompiledField("punti2", paragraphName, recItem["punti_2"].ToString());

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "range1", codiceBox, canale);
                            interprete.assignCompiledField("range1", paragraphName, range1);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "tipo_punti1", codiceBox, canale);
                            interprete.assignCompiledField("tipo_punti1", paragraphName, tipo_punti1);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "punti1", codiceBox, canale);
                            interprete.assignCompiledField("punti1", paragraphName, recItem["punti_1"].ToString());

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                            interprete.assignCompiledField("sconto_fid", paragraphName, sconto_fid);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            //Console.WriteLine("combinazioneAssegnata: " + combinazioneAssegnata);
                            //Console.WriteLine("Suffix: " + suffix_plus);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            //Console.WriteLine("Paragraph Name prezzo_offerta: " + paragraphName);
                            //Console.WriteLine("Canale: " + canale);


                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                            if (combinazioneAssegnata == "PUNTI_minicoll" || combinazioneAssegnata == "PUNTI_KgL_minicoll")
                            {
                                descrizioneParagraphStyle = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descrizione", codiceBox, canale);
                            }

                        }
                        else if (codiceBox == "BOX2")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            if (prezzoOfferta != null && prezzoOfferta != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                            interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                            interprete.assignCompiledField("sconto_fid", paragraphName, sconto_fid);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                            if (canale != "SC")
                            {
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                            }
                        }
                        else if (codiceBox == "BOX62")
                        {
                            //interprete.assignCompiledField("campo_offerta_KgL_sconto", "campo_offerta_KgL_sconto", recItem["campo_offerta_KgL_sconto"].ToString());
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                            interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                            if (paghi_etto != "")
                            {
                                interprete.assignCompiledField("prezzo_offerta_etto", paragraphName, paghi_etto);
                            }
                            else
                            {
                                interprete.assignCompiledField("prezzo_offerta_etto", paragraphName, recItem["prezzo_offerta"].ToString());
                            }

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                            interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_etto", paragraphName, campo_offerta);

                            if (canale != "SC")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_etto_EURprima", paragraphName, prezzo_offerta_etto_EURprima);
                            }
                        }
                        else if (codiceBox == "BOX3")
                        {
                            if (canale != "SC")
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                                interprete.assignCompiledField("sconto_norm", paragraphName, sconto_norm);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                                interprete.assignCompiledField("sconto_fid", paragraphName, sconto_fid);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);


                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                            }
                            else
                            {
                                Logger.Log("Errore, non dovrebbe esistere un BOX3 SC");
                            }
                        }
                        else if (codiceBox == "BOX8")
                        {
                            if (canale != "SC")
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_secondo_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_secondo_EURprima", paragraphName, prezzo_offerta_secondo_EURprima);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_NOofferta_1pezzo_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_NOofferta_1pezzo_EURprima", paragraphName, prezzo_NOofferta_1pezzo_EURprima);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "PezzConf", codiceBox, canale);
                                interprete.assignCompiledField("PezzConf", paragraphName, PezzConf);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "PezzConf_NM", codiceBox, canale);
                                interprete.assignCompiledField("PezzConf_NM", paragraphName, PezzConf_NM);
                            }
                            else
                            {
                                Logger.Log("Errore, non dovrebbe esistere un BOX8 SC");
                            }
                        }
                        else if (codiceBox == "BOX11")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                            if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_EURprima);
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            }
                        }

                        #endregion

                        #region parseMeccanica

                        if (/*recItem.ContainsKey("sconto_norm") && (Double)*/sconto_norm == "0")
                        {
                            interprete.removeCompiledField("sconto_norm");

                        }
                        if (/*recItem.ContainsKey("sconto_fid") && (Double)recItem["*/sconto_fid == "0"/*"] == 0*/)
                        {
                            interprete.removeCompiledField("sconto_fid");
                        }


                        var descrizione = "";
                        //var stringa_etto = "stringa_etto";
                        var val_stringa_etto = stringa_etto;

                        if (temaContesto.ToUpper().IndexOf("LOC") >= 0)
                        {
                            //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
                            contesto_promo = assegnaNuovoValoreContesto("materiale", "VOL", contesto_promo);
                            materiale = "VOL";
                        }



                        interprete.removeCompiledField("LBL_Reparto");




                        if (meccanica_tradotta.IndexOf("VAL_MM") >= 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto");
                        }
                        else if (meccanica_tradotta.IndexOf("VAL_FID") >= 0)
                        {
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto");
                        }
                        else if (meccanica_tradotta.IndexOf("50al50") >= 0)
                        {
                            if (canale != "SC")
                            {
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("sconto_effettivo_grande");
                            }

                            if (meccanica_tradotta.IndexOf("50al50Norm") >= 0)
                            {
                                interprete.removeCompiledField("LBL_Carte");
                                interprete.removeCompiledField("sconto_fid");
                            }
                            else
                            {
                                interprete.removeCompiledField("sconto_norm");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("_minicoll") > 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("prezzo");
                            interprete.removeCompiledField("anzichè");
                            interprete.removeCompiledField("linee");


                            if (meccanica_tradotta.IndexOf("PUNTI_TP") < 0 && meccanica_tradotta.IndexOf("PERCENTO") < 0)
                            {
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (1) per meccanica: " + meccanica_tradotta);
                                interprete.removeCompiledField("campo_offerta_KgL");
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                interprete.removeCompiledField("sconto_effettivo_grande");


                                if (meccanica_tradotta.IndexOf("PUNTI_MULTI") < 0)
                                {
                                    interprete.removeCompiledField("Range_Punti_2");
                                    interprete.removeCompiledField("LBL_Carte");
                                }

                            }
                            else if (meccanica_tradotta.IndexOf("PUNTI_TP") >= 0)
                            {
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("Range_Punti_2");

                            }
                            else if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("Range_Punti_2");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("_bonus") > 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("prezzo");
                            interprete.removeCompiledField("anzichè");

                            if (meccanica_tradotta.IndexOf("MULTI_PERCENTO") > 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo_grande");
                            }
                            else if (meccanica_tradotta.IndexOf("MULTI_TP") > 0)
                            {
                                interprete.removeCompiledField("gruppo_sconto");
                            }
                            else if (meccanica_tradotta.IndexOf("MULTI") > 0)
                            {
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (2) per meccanica: " + meccanica_tradotta);

                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                                interprete.removeCompiledField("PezzConf");
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                interprete.removeCompiledField("linee");
                            }
                            else if (meccanica_tradotta.IndexOf("PERCENTO") > 0)
                            {
                                interprete.removeCompiledField("Range_Punti_2");
                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("PezzConf");
                            }
                            else if (meccanica_tradotta.IndexOf("TP") > 0)
                            {
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("PezzConf");

                                interprete.removeCompiledField("Range_Punti_2");
                            }
                            else
                            {
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (3) per meccanica: " + meccanica_tradotta);

                                interprete.removeCompiledField("campo_offerta_KgL");
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                                interprete.removeCompiledField("PezzConf");
                                interprete.removeCompiledField("Range_Punti_2");
                                interprete.removeCompiledField("linee");
                            }

                        }
                        else if (meccanica_tradotta.IndexOf("ALTRO") >= 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("LBL_Carte");
                            interprete.removeCompiledField("LBL_Titolari");

                            if (canale == "SC")
                            {
                                interprete.removeCompiledField("PIEDE_Titolari");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("OA_") == 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("LBL_Carte");
                            interprete.removeCompiledField("LBL_Titolari");

                            if (canale == "SC")
                            {
                                interprete.removeCompiledField("PIEDE_Titolari");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_123") >= 0)
                            {

                                interprete.removeCompiledField("carta");
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("sconto");
                                interprete.removeCompiledField("00");
                                interprete.removeCompiledField("scritta_xx");
                                interprete.removeCompiledField("anzichè");
                            }

                            if (meccanica_tradotta.IndexOf("_KgL") > 0)
                            {
                                if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                                }

                                else
                                {
                                    interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                }

                            }


                            var suff = "_KgL";
                            var stile = "";
                            if (meccanica_tradotta.IndexOf("_regionale") > 0)
                            {
                                suff = "_KgL_sconto";
                            }

                            if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                            {
                                if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf);

                                }
                                else
                                {
                                    interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL", paragraphName, campo_offerta_conf);

                                }

                                if (materiale != "EV")
                                {
                                    if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                    {
                                        var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                        interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_offerta");
                                    }
                                }
                                else
                                {
                                    if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                    {
                                        var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                        interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_offerta_EURprima");
                                    }
                                }
                            }
                            else if (meccanica_tradotta.IndexOf("_ofaconf") >= 0)
                            {
                                if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                                }
                                else
                                {
                                    interprete.removeCompiledField("campo_offerta_KgL_sconto");//Tanto va avanti campo:offerta_KgL
                                }
                            }
                            else if (meccanica_tradotta.IndexOf("_regionale") >= 0)
                            {
                                if (meccanica_tradotta.IndexOf("_KgL") > 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_KgL);
                                }

                                if (meccanica_tradotta.IndexOf("_boxetto") >= 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                                {
                                    interprete.removeCompiledField("campo_offerta_etto");

                                }
                            }

                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("sconto_effettivo");

                            interprete.removeCompiledField("sconto_fid");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("LBL_Carte");
                        }
                        else if (meccanica_tradotta.IndexOf("sir_sconto") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_123") >= 0)
                            {
                                interprete.removeCompiledField("carta");
                            }

                            if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                            {
                                if (materiale == "EV")
                                {
                                    interprete.removeCompiledField("LBL_Carte");
                                }
                            }
                            else
                            {
                                interprete.removeCompiledField("campo_offerta_KgL");
                                interprete.removeCompiledField("LBL_Carte");
                            }

                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("gruppo_sconto");

                            //if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("_evento") < 0 /*&& meccanica_tradotta.IndexOf("_inostriori")<0  */ && materiale != "EV") {
                            if (materiale != "INT" && materiale != "RIL" && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            else
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                        }
                        else if (meccanica_tradotta.IndexOf("TP_FID") >= 0)
                        {

                            if (tema.ToUpper().IndexOf("LOC") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_KgL");
                            }


                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("gruppo_sconto");

                            if (materiale != "INT" && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            {
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            }
                            else
                            {
                                if (meccanica_tradotta.IndexOf("_evento") < 0)
                                {
                                    interprete.removeCompiledField("prezzo_offerta_gruppo");
                                }
                            }

                            if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                            {

                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);
                                if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta");
                                }
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_ofalkg", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_ofalkg);

                                if (materiale == "EV")
                                {
                                    if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                    {
                                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                        interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_offerta_EURprima");
                                    }
                                }
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("MM_ALL") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_123") >= 0)
                            {
                                interprete.removeCompiledField("carta");
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("00");
                                interprete.removeCompiledField("scritta_xx");
                                interprete.removeCompiledField("anzichè");
                            }


                            if (tema.ToUpper().IndexOf("LOC") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_KgL");
                            }

                            interprete.removeCompiledField("sconto_fid");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("LBL_Carte");
                        }
                        else if (meccanica_tradotta.IndexOf("FID_ALL") >= 0)
                        {
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("anzichè");
                            interprete.removeCompiledField("sconto_norm");

                            if (tema.ToUpper().IndexOf("LOC") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_KgL");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("NM_MM") >= 0 || meccanica_tradotta.IndexOf("NM_MIX") >= 0 || meccanica_tradotta.IndexOf("NM_FID") >= 0)
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "M_MM", codiceBox, canale);
                            interprete.assignCompiledField("M_MM", paragraphName, M_MM_str);

                            if (meccanica_tradotta.IndexOf("FID") > 0)
                            {

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "M_fid", codiceBox, canale);
                                interprete.assignCompiledField("M_MM", paragraphName, M_FID_str);
                            }
                            else if (meccanica_tradotta.IndexOf("_123") > 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (4) per meccanica: " + meccanica_tradotta);

                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                                interprete.removeCompiledField("gruppo_sconto");
                                //console.error("gs 9");
                                if (meccanica_tradotta.IndexOf("_KgL") > 0)
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                                }
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("MM") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_123") >= 0)
                            {
                                interprete.removeCompiledField("carta");
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("00");
                                interprete.removeCompiledField("scritta_xx");
                            }

                            if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                            {
                                interprete.removeCompiledField("sconto_fid");
                                interprete.removeCompiledField("scritta_xx");
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("LBL_Carte");
                            }

                        }
                        else if (meccanica_tradotta.IndexOf("_FID") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_123") >= 0)
                            {
                                interprete.removeCompiledField("PezzConf_NM");
                                interprete.removeCompiledField("00");
                                interprete.removeCompiledField("scritta_xx");
                            }

                            if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                            {
                                interprete.removeCompiledField("sconto_norm");
                                interprete.removeCompiledField("scritta_xx");
                                interprete.removeCompiledField("PezzConf_NM");
                            }

                            if (tema.ToUpper().IndexOf("LOC") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_KgL");
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("VEDERE_NOTE") >= 0)
                        {

                            interprete.removeCompiledField("LBL_Carte");
                            interprete.removeCompiledField("LBL_Titolari");

                            if (canale == "SC")
                            {
                                interprete.removeCompiledField("PIEDE_Titolari");

                            }

                            if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                            {
                                interprete.removeCompiledField("linee");
                            }


                        }


                        if (meccanica_tradotta.IndexOf("_sdb") >= 0 || meccanica_tradotta.IndexOf("_bdp") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_bdp") >= 0)
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                interprete.removeCompiledField("fondo_distintivita_SDB");

                            }
                            else
                            {
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_BDP");

                            }

                            if (meccanica_tradotta.IndexOf("_boxetto") >= 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            {
                                if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                                {
                                    interprete.removeCompiledField("campo_offerta_etto");
                                }

                                if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                                {
                                    stringa_etto = "campo_offerta_KgL";
                                    val_stringa_etto = campo_offerta_KgL;

                                    //interprete.assignCompiledField("stringa_etto", "", "<campo_offerta_KgL>" + recItem["campo_offerta_KgL"].ToString() + "</campo_offerta_KgL>");
                                }


                                if (meccanica_tradotta.IndexOf("PERCENTO") < 0 && materiale != "INT" && materiale != "RIL")
                                {
                                    interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                                }
                                else
                                {
                                    if (meccanica_tradotta.IndexOf("PERCENTO") >= 0 && canale == "SC")
                                    {
                                        interprete.removeCompiledField("prezzo_offerta_gruppo");
                                    }
                                }

                                interprete.removeCompiledField("stringa_etto");

                            }
                            else
                            {
                                interprete.removeCompiledField("alletto");
                            }



                        }
                        else if (meccanica_tradotta.IndexOf("_boxetto") >= 0)
                        {
                            if (isMZLOC)
                            {
                                interprete.removeCompiledField("base");
                            }

                            if (canale == "SC")
                            {
                                if (tipo_tema.ToLower().IndexOf("focus") >= 0)
                                {
                                    //interprete.removeCompiledField("logo_SDB");
                                    //interprete.removeCompiledField("logo_BDP");
                                    interprete.removeCompiledField("fondo_distintivita_SDB");
                                    interprete.removeCompiledField("fondo_distintivita_BDP");
                                }
                            }
                            else
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_SDB");
                                interprete.removeCompiledField("fondo_distintivita_BDP");
                            }

                            interprete.removeCompiledField("stringa_etto");
                            interprete.removeCompiledField("LBL_Carte");


                            if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                            {
                                stringa_etto = "campo_offerta_KgL";
                                val_stringa_etto = campo_offerta_KgL;
                                //interprete.assignCompiledField("stringa_etto", "", "<campo_offerta_KgL>" + recItem["campo_offerta_KgL"].ToString() + "</campo_offerta_KgL>");
                            }

                            if ((meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV") &&
                                (meccanica_tradotta.IndexOf("TP_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("sir_sconto") >= 0))
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_etto_EURprima);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_etto);
                            }

                            if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                            {
                                if (canale != "SC")
                                    interprete.removeCompiledField("prezzo_offerta_etto");

                                interprete.removeCompiledField("sconto_effettivo_grande");
                                if (materiale.Contains("MZ") && meccanica_tradotta.IndexOf("_evento") < 0 && canale != "SC")
                                {
                                    interprete.removeCompiledField("sy_euro");
                                }
                            }
                            else
                            {
                                interprete.removeCompiledField("gruppo_sconto");

                                if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("PERCENTO") < 0)
                                    interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_gruppo");
                                }

                                if (meccanica_tradotta.IndexOf("sir_sconto") < 0)
                                {
                                    interprete.removeCompiledField("sconto_effettivo_grande");
                                }

                                if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                                {
                                    interprete.removeCompiledField("campo_offerta_etto");
                                }
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("_inostriori") >= 0 || meccanica_tradotta.IndexOf("_territorio") >= 0)
                        {

                            if (meccanica_tradotta.IndexOf("_boxetto") >= 0)
                            {
                                interprete.removeCompiledField("base");
                            }

                            if (!isMZLOC)
                            {
                                interprete.removeCompiledField("boxDescrPrezzi_ORI_TERRITORIO");
                                interprete.removeCompiledField("base_inostriori_territorio");
                            }
                            else
                            {
                                interprete.removeCompiledField("base");
                            }

                            if (reparto != 33 &&
                                reparto != 31 &&
                                reparto != 29 &&
                                reparto != 27 &&
                                reparto != 25 &&
                                reparto != 21)
                            {
                                interprete.removeCompiledField("gruppo_reparto");
                            }

                        }
                        else if (isMZLOC)
                        {
                            //Siamo in caso meccanica Territorio NON _inostriori
                            interprete.removeCompiledField("base");
                        }

                        if (meccanica_tradotta.IndexOf("_KgL") < 0)
                        {

                            interprete.removeCompiledField("campo_offerta_KgL");
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");
                        }



                        interprete.removeCompiledField("sconto");

                        if (meccanica_tradotta.IndexOf("NM_MM") < 0 && meccanica_tradotta.IndexOf("NM_MIX") < 0 && meccanica_tradotta.IndexOf("50al50") < 0)
                        {
                            if (meccanica_tradotta.IndexOf("PERCENTO") < 0 &&
                                meccanica_tradotta.IndexOf("TP_FID") < 0 &&
                                meccanica_tradotta.IndexOf("sir_sconto") < 0 &&
                                meccanica_tradotta.IndexOf("PUNTI") < 0 &&
                                meccanica_tradotta.IndexOf("sottocosto") < 0 &&
                                meccanica_tradotta.IndexOf("50sulSecondo") < 0)
                            {
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (5) per meccanica: " + meccanica_tradotta);


                                if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                                else if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                                {
                                    interprete.removeCompiledField("sconto_effettivo");
                                }

                                interprete.removeCompiledField("gruppo_sconto");

                            }
                            else if (meccanica_tradotta.IndexOf("PERCENTO") >= 0 && meccanica_tradotta.IndexOf("_minicoll") < 0 && meccanica_tradotta.IndexOf("_bonus") < 0 && meccanica_tradotta.IndexOf("_evento") < 0)
                            {

                                if ((tema.ToUpper().IndexOf("LOC") < 0 && canale != "SC") || isMZLOC)
                                {
                                    interprete.removeCompiledField("prezzo_offerta_gruppo");
                                }

                                interprete.removeCompiledField("sconto_effettivo_grande");

                                if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                                {
                                    interprete.removeCompiledField("sconto_effettivo");
                                }


                                if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);

                                    if (canale == "SC")
                                    {
                                        if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                        {
                                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                            interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                        }
                                        else
                                        {
                                            interprete.removeCompiledField("prezzo_offerta");
                                        }
                                    }

                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);

                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_ofalkg", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_ofalkg);
                                }
                            }
                        }


                        if (meccanica_tradotta.IndexOf("_sdb") >= 0)
                        {

                            if (meccanica_tradotta.IndexOf("_FID") < 0)
                                interprete.removeCompiledField("sconto_fid");

                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("PezzConf_NM");

                            interprete.removeCompiledField("alletto");//Da capire quando serve

                            if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                            {


                                if (meccanica_tradotta.IndexOf("_boxetto") > 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                                {
                                    interprete.removeCompiledField("linee");
                                }

                                interprete.removeCompiledField("sconto_effettivo_grande");
                            }
                            else
                            {
                                interprete.removeCompiledField("gruppo_sconto");
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            }
                        }
                        else
                        {
                            interprete.removeCompiledField("rect_regionale");
                        }

                        if (meccanica_tradotta.IndexOf("_bdp") >= 0 || meccanica_tradotta.IndexOf("_sdb") >= 0)
                        {
                            if (tipo_tema.ToLower().IndexOf("focus") >= 0)
                            {
                                if (canale == "SC")
                                {
                                    //interprete.removeCompiledField("logo_SDB");
                                    //interprete.removeCompiledField("logo_BDP");
                                    interprete.removeCompiledField("fondo_distintivita_SDB");
                                    interprete.removeCompiledField("fondo_distintivita_BDP");
                                }
                                else
                                {
                                    //interprete.removeCompiledField("logo_SDB");
                                    //interprete.removeCompiledField("logo_BDP");
                                    interprete.removeCompiledField("fondo_distintivita_SDB");
                                    interprete.removeCompiledField("fondo_distintivita_BDP");
                                }
                            }

                        }
                        else
                        {
                            //interprete.removeCompiledField("logo_SDB");
                            //interprete.removeCompiledField("logo_BDP");
                        }

                        if (meccanica_tradotta.IndexOf("_mercato") > 0 && codiceBox != "BOX7")
                        {

                            if (meccanica == "PERCENTO_MM_mercato_boxetto" && canale == "SC")
                            {
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                                interprete.removeCompiledField("sy_etto");
                                interprete.removeCompiledField("rect_etto");
                            }

                        }

                        if ((codiceBox == "BOX6" && meccanica_tradotta.IndexOf("PERCENTO") < 0) || tema.ToUpper().IndexOf("LOC") >= 0)
                        {
                            interprete.removeCompiledField("linee");
                        }

                        if (meccanica_tradotta.IndexOf("_evento") > 0 || (materiale == "EV" && meccanica != "validita"))
                        {

                            interprete.removeCompiledField("linea");

                            if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                            {
                                interprete.removeCompiledField("sy_etto");
                            }
                            else
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);
                            }

                            if (meccanica_tradotta.IndexOf("NM_") < 0)
                            {
                                if (meccanica_tradotta.IndexOf("FID") < 0)
                                {
                                    interprete.removeCompiledField("sconto_fid");
                                }
                            }
                        }

                        if (meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_FID") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("PERCENTO_MM_ALL") < 0 && meccanica_tradotta.IndexOf("PERCENTO_FID_ALL") < 0)
                            {
                                interprete.removeCompiledField("PezzConf_NM");
                                if (canale == "SC")
                                {
                                    interprete.removeCompiledField("rect_tipico");
                                }
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                                interprete.removeCompiledField("campo_offerta");
                                Console.WriteLine("Rimuovo campo_offerta (6) per meccanica: " + meccanica_tradotta);

                                interprete.removeCompiledField("sconto_effettivo_grande");
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                interprete.removeCompiledField("campo_offerta_KgL");
                                interprete.removeCompiledField("stringa_etto");
                                interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                                interprete.removeCompiledField("campo_offerta_etto");
                                interprete.removeCompiledField("quantitativi");
                                interprete.removeCompiledField("M_MM");
                                interprete.removeCompiledField("gruppo_PezzConf");
                                interprete.removeCompiledField("prezzo_NOofferta_1pezzo_EURprima");
                                interprete.removeCompiledField("prezzo_offerta_secondo_EURprima");
                                interprete.removeCompiledField("sy_2x1");
                            }
                            else if (meccanica_tradotta.IndexOf("_evento") >= 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo_grande");
                                if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);

                                    if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                    {
                                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                        interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_offerta");
                                    }
                                }
                            }

                            if (meccanica_tradotta.IndexOf("PERCENTO_MM_ALL") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_FID_ALL") >= 0)
                            {
                                if (int.Parse(recItem["numero_reparto"].ToString()) == 9 && recItem["prezzo_offerta"].ToString() == "")
                                {
                                    interprete.removeCompiledField("prezzo_offerta_gruppo");
                                    interprete.removeCompiledField("campo_offerta");
                                    Console.WriteLine("Rimuovo campo_offerta (7) per meccanica: " + meccanica_tradotta);

                                }
                            }
                        }

                        if ((materiale == "INT" || materiale == "RIL") && (meccanica_tradotta.IndexOf("_ofalkg") >= 0))
                        {
                            if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            }
                        }

                        if ((temaContesto.Contains("LOC Mensile") || temaContesto.Contains("LOC 1a DATA") || temaContesto.Contains("LOC 2a DATA")) && meccanica_tradotta != "validita")
                        {
                            if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                            {
                                interprete.removeCompiledField("sy_etto");
                            }
                            else
                            {
                                interprete.removeCompiledField("sconto_fid");

                                if (meccanica_tradotta.IndexOf("TP_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("sir_sconto") >= 0)
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);

                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale);
                                    interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_etto);

                                }
                            }

                            if (meccanica_tradotta.IndexOf("NM_") >= 0)
                            {
                                if (meccanica_tradotta.IndexOf("_FID") < 0)
                                {
                                    interprete.removeCompiledField("LBL_Carte");
                                }
                            }
                            else
                            {
                                if (meccanica_tradotta.IndexOf("TP_FID") < 0 && meccanica_tradotta.IndexOf("sir_sconto") < 0)
                                {
                                    interprete.removeCompiledField("sconto_effettivo");
                                }
                            }

                            if (temaContesto.Contains("LOC Mensile"))
                            {
                                interprete.removeCompiledField("Triangolo_VAL");
                            }
                        }

                        if ((materiale.Contains("BASSI&FISSI") && meccanica_tradotta != "validita") || allEtichette.Contains("IS BASSI E FISSI"))
                        {

                            if (!materiale.Contains("ISTITUZIONALE"))
                            {
                                if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                                {
                                    interprete.removeCompiledField("rect_etto");
                                    interprete.removeCompiledField("sy_etto");

                                }
                                else
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);

                                }
                            }
                        }

                        if (meccanica_tradotta.IndexOf("_FID") < 0 && meccanica_tradotta.IndexOf("PUNTI") < 0)
                        {
                            interprete.removeCompiledField("LBL_Titolari");

                            if (canale == "SC" && codiceBox != "BOX41")
                            {
                                interprete.removeCompiledField("PIEDE_Titolari");
                            }
                        }

                        if (codiceBox == "BOX41" && (tipo_tema.ToLower() == "focus" || tipo_tema.ToLower() == "attivita di reparto"))
                        {

                            interprete.removeCompiledField("parentesi_BeF");
                            interprete.removeCompiledField("sy_ombra");
                            interprete.removeCompiledField("margherita_BeF");
                        }
                        if (codiceBox != "BOX41" && (tipo_tema.ToLower() == "focus" || tipo_tema.ToLower() == "attivita di reparto"))
                        {
                            interprete.removeCompiledField("fondo_distintivita_SDB");
                            interprete.removeCompiledField("fondo_distintivita_BDP");
                        }


                        if ((materiale == "INT" || materiale == "RIL") && meccanica_tradotta.IndexOf("TP_MM") >= 0 && codiceBox != "BOX41")
                        {
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                        }

                        var bdp_sdb_distintivita = (tipo_tema.IndexOf("_focus") < 0 && (meccanica_tradotta.IndexOf("_sdb") >= 0 || meccanica_tradotta.IndexOf("_bdp") >= 0));

                        if (codiceBox != "BOX41" && canale != "SC" && meccanica_tradotta.IndexOf("_minicoll") < 0 && meccanica_tradotta.IndexOf("_bonus") < 0 && !bdp_sdb_distintivita)
                        {
                            interprete.removeCompiledField("linee");
                        }


                        if (canale != "SC" && meccanica_tradotta.IndexOf("_bonus") < 0 && meccanica_tradotta.IndexOf("_minicoll") < 0 && !bdp_sdb_distintivita)
                        {
                            interprete.removeCompiledField("linee");
                        }

                        if(interprete.compiledContainsKey("prezzo_offerta_EURprima") && !interprete.deletedContainsKey("prezzo_offerta_EURprima"))
                        {
                            interprete.removeCompiledField("prezzo_offerta");
                        }

                        #endregion parseMeccanica

                        #region descrizione




                        //ATTENZIONE
                        //posizionare la descirizione allineandola a prezzo offerta TOP o 
                        //SCONTO TOP se si tratta di meccanica percentuale o sir
                        var Descrizione1 = "";
                        var Descrizione2 = "";
                        var Descrizione3 = "";
                        var Descrizione4 = "";
                        var descrizioneEsempio = "";
                        var Peso = "";
                        var Um = "";
                        string stileParagDescr = "";
                        if (canale == "SC")
                        {
                            stileParagDescr = "DES_Descrizione_SC";
                        }
                        else
                        {
                            stileParagDescr = "DES_Descrizione";
                        }

                        //NOTA ESEMPIO
                        bool desEsempio = false;
                        string provenienzaEsempio = "Primario";
                        var nota_esempio = "";
                        if (recItem.ContainsKey("nota_esempio"))
                        {
                            nota_esempio = recItem["nota_esempio"].ToString().ToLower();
                        }
                        else
                        {
                            recItem["nota_esempio"] = "";
                        }

                        if (recItem.ContainsKey("Descrizioni.Extra"))
                        {
                            JObject jObjExtra = recItem["Descrizioni.Extra"] as JObject;
                            Dictionary<string, ExtraAutoFIelds> listExtra = jObjExtra.ToObject<Dictionary<string, ExtraAutoFIelds>>();

                            //recItem.TryGetValue("Descrizioni.Extra", out JObject extraObj);
                            if (listExtra != null)
                            {
                                //JObject extra = JObject.Parse(extraJson);  // deserializza in JObject
                                if (listExtra.ContainsKey("nota_esempio") && recItem.ContainsKey("nota_esempio"))
                                {
                                    descrizioneEsempio = listExtra["nota_esempio"].content;
                                }
                            }
                        }

                        if (recItem.ContainsKey("descrizione_gruppo"))
                        {
                            var dg = (Dictionary<string, object>)recItem["descrizione_gruppo"];

                            Descrizione1 = dg["Descrizioni.Descrizione1"].ToString();
                            Descrizione2 = dg["Descrizioni.Descrizione2"].ToString();
                            Descrizione3 = dg["Descrizioni.Descrizione3"].ToString();
                            Descrizione4 = dg["Descrizioni.Descrizione4"].ToString();//recItem["Descrizioni.Descrizione4"].ToString();
                            Peso = recItem["Descrizioni.Peso"].ToString();
                            Um = recItem["Descrizioni.Um"].ToString();

                            //sovrascriviamo la nota esempio con quella del gruppo se è presente
                            if (dg.ContainsKey("Descrizioni.Extra"))
                            {
                                JObject jObjExtra = dg["Descrizioni.Extra"] as JObject;
                                Dictionary<string, ExtraAutoFIelds> listExtra = jObjExtra.ToObject<Dictionary<string, ExtraAutoFIelds>>();

                                if (listExtra != null)
                                {
                                    //JObject extra = JObject.Parse(extraJson);  // deserializza in JObject
                                    if (listExtra.ContainsKey("nota_esempio") && recItem.ContainsKey("nota_esempio"))
                                    {
                                        descrizioneEsempio = listExtra["nota_esempio"].content;
                                        provenienzaEsempio = "Gruppo";

                                    }
                                }
                            }
                        }
                        else
                        {
                            Descrizione1 = recItem["Descrizioni.Descrizione1"].ToString();
                            Descrizione2 = recItem["Descrizioni.Descrizione2"].ToString();
                            Descrizione3 = recItem["Descrizioni.Descrizione3"].ToString();
                            Descrizione4 = recItem["Descrizioni.Descrizione4"].ToString();
                            Peso = recItem["Descrizioni.Peso"].ToString();
                            Um = recItem["Descrizioni.Um"].ToString();
                        }

                        if (descrizioneEsempio != null && descrizioneEsempio != "" &&
                            codice_gruppo != codice_referenza &&
                            Convert.ToByte(recItem["StatoSelezione"]) == (byte)1 &&
                            nota_esempio.Contains("esempio") && !nota_esempio.Contains("EVIDENZIATO ESEMPIO MA NON NECESSARIO".ToLower()))
                        {
                            desEsempio = true;
                        }

                        bool isTakeway = recItem.ContainsKey("isTakeAway");
                        if (isTakeway)
                        {
                            desEsempio = false;
                        }


                        while (Descrizione1.Contains("<br>"))
                        {
                            Descrizione1 = Descrizione1.Replace("<br>", "\n");
                        }
                        while (Descrizione2.Contains("<br>"))
                        {
                            Descrizione2 = Descrizione2.Replace("<br>", "\n");
                        }
                        while (Descrizione3.Contains("<br>"))
                        {
                            Descrizione3 = Descrizione3.Replace("<br>", "\n");
                        }
                        while (Descrizione4.Contains("<br>"))
                        {
                            Descrizione4 = Descrizione4.Replace("<br>", "\n");
                        }


                        var no_str_etto = (combinazioneAssegnata.IndexOf("_boxetto") < 0 || (canale == "SC" && combinazioneAssegnata.IndexOf("PERCENTO_MM") >= 0 && combinazioneAssegnata.IndexOf("ALL") < 0));

                        try
                        {
                            var mecc_stili = combinazioneAssegnata;
                            // if (obj.meccanica_stili != null && obj.meccanica_stili != "")
                            //     mecc_stili = obj.meccanica_stili;


                            //PRIMA IL REPARTO SE C'è
                            //var listRepartiEsistenti = new List<int>() { 33, 31, 29, 27, 25, 21 };
                            var listRepartiDaInserire = new List<int>() { 31 };
                            bool repartoForzato = false;
                            if (recItem.ContainsKey(Meta.keyRepartoForzato))
                            {
                                repartoForzato = Convert.ToBoolean(recItem[Meta.keyRepartoForzato]);
                            }
                            if (codiceBox != "BOX20" && codiceBox != "BOX21" && (listRepartiDaInserire.IndexOf(numero_reparto) >= 0 || repartoForzato || /*?*/ tema.ToNoSpacing().ToUpper() == "CATLOC" /*?*/))
                            {
                                var pab = DicituraReparto.ToLower().IndexOf("prodotti al banco");
                                if (pab >= 0)
                                {
                                    var inx_pab = pab + "prodotti al banco".Length;
                                    DicituraReparto = DicituraReparto.Substring(0, inx_pab) + "\n" + DicituraReparto.Substring(inx_pab + 1);
                                }

                                //se dicitura reparto contiene "con reparto pescheria" va a capo prima di "con reparto pescheria" purchè ci sia testo prima
                                var crp = DicituraReparto.ToLower().IndexOf("con reparto pescheria");
                                if (crp > 0)
                                {
                                    DicituraReparto = DicituraReparto.Substring(0, crp) + "\n" + DicituraReparto.Substring(crp);
                                }

                                var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "Reparto_" + numero_reparto, codiceBox, canale);
                                stileParagDescr = nome_stile;
                                nome_stile = nome_stile.Replace("DIC_", "DICITURA_");

                                descrizione = "<" + nome_stile + ">" + DicituraReparto + "\n" + "</" + nome_stile + ">";
                            }

                            //DESCRIZIONE
                            if (Descrizione1 != "")
                            {
                                var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_nome", codiceBox, canale);
                                var aCapo = "";
                                bool descr1HaGiaACapoFinale =
Descrizione1.EndsWith("\n") ||
Descrizione1.EndsWith("\r") ||
Descrizione1.EndsWith("\r\n");

                                if (!descr1HaGiaACapoFinale)
                                {
                                    if (Descrizione2 != "" || Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                                    {
                                        aCapo += "\n";
                                    }
                                }
                                descrizione += "<" + nome_stile + ">" + Descrizione1 + aCapo + "</" + nome_stile + ">";
                            }

                            if (Descrizione2 != "")
                            {
                                var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_marca", codiceBox, canale);
                                var aCapo = "";
                                bool descr2HaGiaACapoFinale =
                                    Descrizione2.EndsWith("\n") ||
                                    Descrizione2.EndsWith("\r") ||
                                    Descrizione2.EndsWith("\r\n");

                                if (!descr2HaGiaACapoFinale)
                                {
                                    if (Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto) || desEsempio)
                                    {
                                        aCapo += "\n";
                                    }
                                }
                                descrizione += "<" + nome_stile + ">" + Descrizione2 + aCapo + "</" + nome_stile + ">";
                            }
                            //TIPO


                            string unEsempio = "";
                            var esempioPresente = false;
                            if (desEsempio && !mismatchPrezzi)
                            {
                                var aCapo = "";
                                if (Descrizione3 != "")
                                {
                                    var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_tipo", codiceBox, canale);
                                    bool descr3HaGiaACapoFinale =
                                        Descrizione3.EndsWith("\n") ||
                                        Descrizione3.EndsWith("\r") ||
                                        Descrizione3.EndsWith("\r\n");

                                    if (!descr3HaGiaACapoFinale)
                                    {
                                        aCapo += "\n";
                                    }
                                    descrizione += "<" + nome_stile + ">" + Descrizione3 + aCapo + "</" + nome_stile + ">";
                                }

                                //DA AGGIORNARE IN MAPPA STILI
                                //var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_esempio", codiceBox, canale);
                                var nome_stile_esempio = getStileEsempio(recItem, canale); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_esempio", codiceBox, canale);

                                if (!descrizioneEsempio.ToLower().StartsWith("un esempio"))
                                {
                                    unEsempio = "un esempio:\n";
                                }

                                //aCapo = "";
                                bool descrEsempioHaGiaACapoFinale =
descrizioneEsempio.EndsWith("\n") ||
descrizioneEsempio.EndsWith("\r") ||
descrizioneEsempio.EndsWith("\r\n");

                                //if (!descrEsempioHaGiaACapoFinale)
                                //{
                                //    if (Descrizione4 != "" || !no_str_etto)
                                //    {
                                //        aCapo += "\n";
                                //    }
                                //}

                                descrizione += "<" + nome_stile_esempio + ">" + unEsempio + descrizioneEsempio + /*aCapo +*/ "</" + nome_stile_esempio + ">";

                                esempioPresente = true;
                                recItem["provenienzaEsempio"] = provenienzaEsempio;
                            }
                            else
                            {
                                if (Descrizione3 != "")
                                {
                                    var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_tipo", codiceBox, canale);
                                    var aCapo = "";
                                    bool descr3HaGiaACapoFinale =
    Descrizione3.EndsWith("\n") ||
    Descrizione3.EndsWith("\r") ||
    Descrizione3.EndsWith("\r\n");
                                    if (!descr3HaGiaACapoFinale)
                                    {
                                        if (Descrizione4 != "" || !no_str_etto)
                                        {
                                            aCapo += "\n";
                                        }
                                    }

                                    descrizione += "<" + nome_stile + ">" + Descrizione3 + aCapo + "</" + nome_stile + ">";
                                }
                            }





                            //GRAMMATURA
                            var first_gramm_char_inx = -1;
                            bool isOfalKg = combinazioneAssegnata.Contains("_ofalkg");
                            var alKg = "";
                            if (!esempioPresente)
                            {
                                //La grammatura va inserita se NON esiste il riferimento "un esempio"
                                if (no_str_etto)
                                {

                                    if (Descrizione4 != "")
                                    {
                                        if (isOfalKg && !Descrizione4.ToLower().Contains("al kg"))
                                        {
                                            var nome_stile_kg = getStileKg(recItem, canale); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_alkg", codiceBox, canale);

                                            alKg += "<" + nome_stile_kg + ">" + "\nal kg" + "</" + nome_stile_kg + ">";
                                        }

                                        var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_gr", codiceBox, canale);
                                        descrizione += "<" + nome_stile + ">" + Descrizione4 + "</" + nome_stile + ">";

                                        descrizione += alKg;

                                    }
                                }
                                else
                                {
                                    var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_gr", codiceBox, canale);
                                    if (Descrizione4 != "")
                                    {
                                        var hiddenStyle = GLOBAL_VARIABLES_FICO.descrizioniStileHidden;
                                        //la impostiamo ad hidden
                                        descrizione += "<" + nome_stile + "_" + hiddenStyle + ">" + Descrizione4 + "</" + nome_stile + "_" + hiddenStyle + ">";
                                    }

                                    string nome_campo = stringa_etto;
                                    nome_stile = stringaEtto(recItem, canale); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, nome_campo, codiceBox, canale);
                                    var s_etto = "<" + nome_stile + ">" + val_stringa_etto + "</" + nome_stile + ">";

                                    descrizione += s_etto;
                                    if (descrizione.IndexOf("€") > 0 && combinazioneAssegnata.IndexOf("_evento") < 0 && combinazioneAssegnata.IndexOf("_inostriori") < 0 && combinazioneAssegnata.IndexOf("_territorio") < 0)
                                    {
                                        //console.error("€ " + codiceBox);
                                        if (canale != "SC")
                                            descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto" + suffix_plus + ">€</EURO piccolo_Descr2_boxetto" + suffix_plus + ">");
                                        else
                                            descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto_SC>€</EURO piccolo_Descr2_boxetto_SC>");
                                    }
                                    else
                                    {
                                        descrizione.Replace("€", "<C" + nome_stile + ">€</C" + nome_stile + ">");
                                    }

                                }
                            }

                            //I20-522: se la dicitura e' gia' nelle descrizioni scritte dall'operatore,
                            //aggiungerla qui la stamperebbe due volte sul box.
                            if (isTakeway && !contieneDicituraTakeAway(descrizione))
                            {
                                var nome_stile = getStileTakeAway(recItem, canale);

                                descrizione += "<" + nome_stile + ">\n\ndisponibile anche Take Away</" + nome_stile + ">";
                            }
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine(ex);
                        }
                        interprete.assignCompiledField("descrizione", descrizioneParagraphStyle, descrizione);


                        #endregion descrizione

                        if (Descrizione4.Trim().ToLower() == "al pezzo")
                        {
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");

                        }

                        //if (sezione.ToUpper() == "B&F RICHIAMO VOLANTINO")
                        //{
                        //    interprete.removeCompiledField("immagine");
                        //    interprete.removeCompiledField("sfondo");
                        //}

                        interprete.finalizeFields();
                        var fields = interprete.getFields();
                        recItem["compiledFields"] = fields.compiledFields;
                        recItem["deletedFields"] = fields.deletedFields;
                        interprete.clearInterpreter();
                        #endregion
                    }
                    else
                    {
                        recItem["NoXml"] = true;
                    }





                    result.liste[0].Records.Add(tracciato[i]);

                }


                if (counter <= 0)
                {
                    result.errors += "Nessun articolo della lista corrisponde ai requisiti di esportazione. Controllare la lista e ripetere l'importazione";
                }


            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }

            //impResult.liste = result;
            //impResult.errors = errors;

            return result;
        }

        private string getStileKg(Dictionary<string, object> recItem, string canale, int tipoLavorazione = 1)
        {
            if (canale == "SC")
            {
                if (tipoLavorazione == 1)
                {
                    return "A.DES_descr_alkg_SC";
                }
                else
                {
                    return "PROMO_A.PROMO_A_DES_descr_alkg";
                }
            }
            return "DES_descr_alkg";
        }

        private string getStileEsempio(Dictionary<string, object> recItem, string canale)
        {
            if (canale == "SC")
            {
                return "A.DES_descr_es_SC";
            }
            return "DES_descr_es";
        }

        private string getStileTakeAway(Dictionary<string, object> recItem, string canale)
        {
            //da aggiornare con il nuovo stile quando ci sarà
            if (canale == "SC")
            {
                return "A.A_dicitura_TakeAway";
            }
            return "P.P_dicitura_TakeAway";

            //da inserire anche il CAT LOCALISMO si chiama CAT_RIC_dicitura_TakeAway
        }

        private string stringaEtto(Dictionary<string, object> recItem, string canale, int tipoLavorazione = 1)
        {
            if (canale == "SC")
            {
                if (tipoLavorazione == 1)
                {
                    return "A.CPREZ_CampoOfferta_Descr2_boxetto_SC";
                }
                else
                {
                    return "PROMO_A.PROMO_A_CPREZ_CampoOfferta_Descr2_boxetto";
                }


            }
            return "CPREZ_CampoOfferta_Descr2_boxetto";
        }

        public string GetStileForField(MappaStili mappa, string mastro_p, string nomeField, string codiceBox, string canale, int tipoLavorazine = 1)
        {
            var mappaStili = mappa.stileList;
            string mastro = mastro_p;

            if (canale == "SC" && codiceBox != "BOX40" && tipoLavorazine == 1)
                mastro = mastro_p + "_SC";

            //Console.WriteLine("Cerca stile per meccanica: " + mastro + " campo: " + nomeField + " canale:" + canale+ "  codiceBox:"+ codiceBox);
            //Console.WriteLine(mappaStili != null);
            Stili sty = null;

            if (mappaStili != null)
            {
                sty = mappaStili.FirstOrDefault(f => f.meccanica == mastro && f.nome_campo == nomeField);
            }

            if (sty != null)
            {
                if (sty.stile.EndsWith("_SC"))
                {
                    return "A." + sty.stile;
                }
                if (tipoLavorazine == 2)
                {
                    return "PROMO_A.PROMO_A_" + sty.stile;
                }
                return sty.stile;
            }
            else
            {
                string newMecc = mastro.Replace("_SC", "");
                sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);

                if (sty != null)
                {
                    return sty.stile;
                }
            }

            if ((mastro.Contains("_ofalkg") || mastro.Contains("_ofaconf") || mastro.Contains("_boxetto"))
                && mastro.Contains("_evento"))
            {
                int inx = mastro.IndexOf("_ofalkg");
                if (inx < 0) inx = mastro.IndexOf("_ofaconf");
                if (inx < 0) inx = mastro.IndexOf("_boxetto");

                int inxEv = mastro.IndexOf("_evento");

                if (inxEv > inx)
                {
                    string newMecc = mastro.Replace("_evento", "");
                    newMecc = newMecc.Substring(0, inx) + "_evento" + newMecc.Substring(inx);

                    sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);

                    if (sty == null && newMecc.Contains("_SC_"))
                    {
                        newMecc = newMecc.Replace("_SC", "");
                        sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);
                    }

                    if (sty != null) {
                        if (sty.stile.EndsWith("_SC"))
                        {
                            return "A." + sty.stile;
                        }
                        if (tipoLavorazine == 2)
                        {
                            return "PROMO_A.PROMO_A_" + sty.stile;
                        }
                        return sty.stile;
                    }
                }

                int inxTerritorio = mastro.IndexOf("_territorio");
                if (inxTerritorio > inx)
                {
                    string newMecc = mastro.Replace("_territorio", "");
                    newMecc = newMecc.Substring(0, inx) + "_territorio" + newMecc.Substring(inx);

                    sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);

                    if (sty == null && newMecc.Contains("_SC_"))
                    {
                        newMecc = newMecc.Replace("_SC", "");
                        sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);
                    }

                    if (sty != null) {
                        if (sty.stile.EndsWith("_SC"))
                        {
                            return "A." + sty.stile;
                        }
                        if (tipoLavorazine == 2)
                        {
                            return "PROMO_A.PROMO_A_" + sty.stile;
                        }
                        return sty.stile;
                    }
                }

                int inxNori = mastro.IndexOf("_inostriori");
                if (inxNori > inx)
                {
                    string newMecc = mastro.Replace("_inostriori", "");
                    newMecc = newMecc.Substring(0, inx) + "_inostriori" + newMecc.Substring(inx);

                    sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);

                    if (sty == null && newMecc.Contains("_SC_"))
                    {
                        newMecc = newMecc.Replace("_SC", "");
                        sty = mappaStili?.FirstOrDefault(f => f.meccanica == newMecc && f.nome_campo == nomeField);
                    }

                    if (sty != null) {
                        if (sty.stile.EndsWith("_SC"))
                        {
                            return "A." + sty.stile;
                        }
                        if (tipoLavorazine == 2)
                        {
                            return "PROMO_A.PROMO_A_" + sty.stile;
                        }
                        return sty.stile;
                    }
                }
            }

            List<string> dict = new List<string> { "_KgL", "_mercato", "_123", "_focus", "_regionale", "_bdp", "_sdb", "_evento", "_inostriori", "_territorio", "_minicoll", "_bonus", "_ricorrenza", "_sapori", "_parafarmacia", "_boxetto", "_ofalkg", "_ofaconf", "_LOC" };

            int leader = -1;

            foreach (var d in dict)
            {
                int inx = mastro.IndexOf(d);
                if (inx > 0 && (leader > inx || leader == -1))
                {
                    leader = inx;
                }
            }

            if (leader > 0)
            {
                string disoss = mastro.Substring(0, leader);
                string res = mastro.Replace(disoss, "TP_MM");

                sty = mappaStili?.FirstOrDefault(f => f.meccanica == res && f.nome_campo == nomeField);

                if (sty != null)
                {
                    if (sty.stile.EndsWith("_SC"))
                    {
                        return "A." + sty.stile;
                    }
                    if (tipoLavorazine == 2)
                    {
                        return "PROMO_A.PROMO_A_" + sty.stile;
                    }
                    return sty.stile;
                }
            }

            return "null";
        }

        private string cercaChiaveContesto(string keyName, List<FicoContextField> contesto)
        {
            if (contesto == null)
            {
                return "";
            }
            for (int i = 0; i < contesto.Count; i++)
            {
                if (contesto[i].nome_field == keyName)
                {
                    return contesto[i].user_value;
                }
            }

            return "";
        }

        private string cercaChiaveKit(string keyName, List<FicoContextField> contesto)
        {
            if (contesto == null)
            {
                return "";
            }
            for (int i = 0; i < contesto.Count; i++)
            {
                if (contesto[i].nome_field == keyName)
                {
                    return contesto[i].user_value;
                }
            }

            return "";
        }
        private List<FicoContextField> assegnaNuovoValoreContesto(string key, string value, List<FicoContextField> contesto)
        {
            FicoContextField nuovoElemento = new FicoContextField()
            {
                nome_field = key,
                user_value = value,
            };

            for (int i = 0; i < contesto.Count; i++)
            {
                if (contesto[i].nome_field == key)
                {
                    contesto[i].user_value = value;
                    return contesto;
                }
            }

            contesto.Add(nuovoElemento);
            return contesto;
        }


        public TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode)
        {
            System.Globalization.CultureInfo culture = new System.Globalization.CultureInfo("it-IT");
            CultureInfo.CurrentCulture = culture;
            TracciatoResultKit result = new TracciatoResultKit();

            Console.WriteLine("PathMappaStili: " + pathMappaStili);

            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keySegmento = Edro21Context.Meta.segmento;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyCodice_scatto = Edro21Context.Meta.codice_scatto;
            string keyTema = Edro21Context.Meta.tema;
            string keyPrezzo_offerta = Edro21Context.Meta.prezzo_offerta;
            string keyPrezzo_offerta_kgl = Edro21Context.Meta.prezzo_offerta_kgl;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keySettore = Edro21Context.Meta.settore;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
            string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyRefs = Edro21Context.Meta.refs;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;
            string keyM_numero_reparto = Edro21Context.Meta.numero_reparto;
            string keyM_numero_settore = Edro21Context.Meta.numero_settore;
            string keyDicituraReparto = Edro21Context.Meta.dicitura_reparto;
            string keyM_prezzo_offerta_um_com = Edro21Context.Meta.prezzo_offerta_um_com;
            string keyM_prezzo_anziche_um_com = Edro21Context.Meta.prezzo_anziche_um_com;
            string keyM_unita_fatt = Edro21Context.Meta.unita_fatt;
            string keyM_um_com = Edro21Context.Meta.um_com;
            string key_combinazioneAssegnata = Edro21Context.Meta.keyCombinazioneAssegnata;
            string key_codiceBox = Edro21Context.Meta.keyCodiceBox;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyStatoSelezione = Edro21Context.Meta.keyStatoSelezione;
            string keySottogruppo = GLOBAL_VARIABLES.keyScattoCodiceSottogruppo;



            TracciatoKit tracciato_da_esportare = new TracciatoKit();
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            result.liste = new List<TracciatoKit>() { tracciato_da_esportare };
            result.liste[0].Records = new List<ArticoloInKit>();
            result.liste[0].errors = "";// = new List<Dictionary<string, object>>();
            try
            {
                //requestParams = formRequest;
                lista_tracciato = tracciato.Select(s => s.recordInTracciato).ToList();

                string tipo_materiale = "vol";
                Byte tipo_volantino = 2;//PoP

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                dbGrammature = ordDB.source;


                JObject o3 = JObject.Parse(File.ReadAllText(pathMeccaniche));
                DbMeccaniche mcDB = o3.ToObject<DbMeccaniche>();
                dbMeccaniche = mcDB.source;


                JObject o1 = JObject.Parse(File.ReadAllText(pathACPV));
                DbACPV acpvDB = o1.ToObject<DbACPV>();

                JObject o5 = JObject.Parse(File.ReadAllText(pathLoghiBolli));
                loghibolliDB = o5.ToObject<DbLoghiBolli>();

                JObject o6 = JObject.Parse(File.ReadAllText(pathTipiDiExport));
                DbTipoDiExport tipiExportDB = o6.ToObject<DbTipoDiExport>();

                JObject o7 = JObject.Parse(File.ReadAllText(pathFormati));
                DbFormati formatiDB = o7.ToObject<DbFormati>();

                JObject o8 = JObject.Parse(File.ReadAllText(pathMappaStili));
                MappaStili mappaStili = o8.ToObject<MappaStili>();

                Console.WriteLine("mappastili not null: " + (mappaStili != null).ToString());

                var formato = formatiDB.source.Find(f => f.guidID == kit.guidFormato).codice;

                var guidArea = kit.guidArea;
                var guidCanale = kit.guidCanale;
                var areaObj = acpvDB.aree.Find(f => f.guidID == guidArea);
                var area = areaObj != null ? areaObj.sigla : "";
                var canaleObj = acpvDB.canali.Find(f => f.guidID == guidCanale);
                var canale = canaleObj != null ? canaleObj.sigla : "";


                string ncContentFile = File.ReadAllText(pathNamingConvention);
                FicoNamingConvention ncDB = JsonConvert.DeserializeObject<FicoNamingConvention>(ncContentFile);

                //I nomi saranno per tutte le ref identici quindi lo estraggouna volta soltanto
                List<IstantaLib.ArticoloInKitExportName> exportNames = new List<IstantaLib.ArticoloInKitExportName>();

                List<TipoDiExport> tipiExportDelKit = new List<TipoDiExport>();
                foreach (TipoDiExportInKit tItemInKit in kit.tipiDiExportInKit)
                {
                    TipoDiExport tItem = tipiExportDB.source.FirstOrDefault(w => w.guidID == tItemInKit.tipoDiExportGuidID);
                    if (tItem != null)
                    {
                        tipiExportDelKit.Add(tItem);
                    }
                }



                int counter = 0;
                List<string> _cacheSottogruppi = new List<string>();

                CompiledFieldInterpreter interprete = new CompiledFieldInterpreter();
                CompiledFieldInterpreter interpreteSottogruppo = new CompiledFieldInterpreter();

                Console.WriteLine("Inizio elaborazione tracciato POP... count " + tracciato.Count);

                for (int i = 0; i < tracciato.Count; i++)
                {
                    //assegniamo prima tutte le meccaniche tradotte perchè alcuni processi analizzano tutto il gruppo PRIMA che il record singolo sia stato processato
                    Dictionary<string, object> recItem = tracciato[i].recordInTracciato;
                    var meccOrigin = recItem[meccanica_origine].ToString();
                    var meccCorrispondente = dbMeccaniche.Where(f => f.NomeOrigine == meccOrigin).FirstOrDefault();
                    if (meccCorrispondente != null)
                    {
                        recItem[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                    }
                }

                for (int i = 0; i < tracciato.Count; i++) //lista_tracciato.Count; i++)
                {
                    ArticoloInKit artInKit = tracciato[i];

                    if (i > 10)
                        break;

                    Dictionary<string, object> recItem = artInKit.recordInTracciato;// lista_tracciato[i];


                    string inout_vol = recItem[keyTipo_volantino].ToString().ToLower();

                    //bool is_fuori_volantino = (inout_vol.IndexOf("fuori volantino") >= 0) ||
                    //    (inout_vol.IndexOf("opportunit") >= 0);

                    //if (is_fuori_volantino) // !is_fuori_volantino && FuoriVolField.IndexOf("volantino") < 0)
                    //{
                    //    continue;
                    //}

                    //if (!recItem.ContainsKey(key_combinazioneAssegnata))
                    //{
                    //    recItem.ToString();
                    //    continue;
                    //}

                    string sez_data = "";
                    DateTime data_da = DateTime.Parse(recItem["data_da"].ToString());
                    DateTime data_a = DateTime.Parse(recItem["data_a"].ToString());

                    if (data_da.Month == data_a.Month)
                    {
                        sez_data = String.Format("Dal {0} al {1}", data_da.Day.ToString("d"), data_a.ToString("d MMMM yyyy"));
                    }
                    else
                    {
                        if (data_da.Year != data_a.Year)
                        {
                            sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM yyyy"), data_a.ToString("d MMMM yyyy"));
                        }
                        else
                        {
                            sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM"), data_a.ToString("d MMMM yyyy"));
                        }
                    }

                    //recItem["sez_data"] = sez_data;

                    //var meccOrigin = recItem[meccanica_origine].ToString();
                    //var meccCorrispondente = dbMeccaniche.Where(f => f.NomeOrigine == meccOrigin).FirstOrDefault();
                    //if (meccCorrispondente != null)
                    //{
                    //    recItem[Meta.keyMeccanicaTradotta] = meccCorrispondente.NomeTraduzione;
                    //}

                    if (!recItem.ContainsKey(GLOBAL_VARIABLES.keySiglaReparto))
                    {
                        switch (recItem[keyReparto].ToString())
                        {
                            case "29":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "CA";
                                break;

                            case "33":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "OF";
                                break;

                            case "31":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PE";
                                break;

                            case "25":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "GA";
                                break;

                            case "27":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "FO";
                                break;

                            case "01":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "DAL";
                                break;

                            case "03":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "BV";
                                break;

                            case "21":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "SG";
                                break;

                            case "24":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "LS";
                                break;

                            case "05":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                break;
                            case "07":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "PC";
                                break;

                            case "09":
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "CP";
                                break;

                            default:
                                recItem[GLOBAL_VARIABLES.keySiglaReparto] = "EX";
                                break;
                        }
                    }



                    string tipo_tema = recItem[keyTipo_tema].ToString().ToLower();
                    string tema = recItem[keyTema].ToString().ToLower();
                    string ruolo = recItem[keyRuolo].ToString().ToLower();
                    string nota_category = recItem[keyNote_category].ToString();

                    string sezione = recItem[keySezione].ToString();

                    Int64 reparto = Int64.Parse(recItem[keyReparto].ToString());
                    Int64 settore = Int64.Parse(recItem[keySettore].ToString());
                    string segmento = recItem[keySegmento].ToString();
                    string meccanica = recItem[meccanica_origine].ToString();


                    string codice_referenza = recItem[GLOBAL_VARIABLES.keyRefCodice].ToString();
                    string codice_gruppo = recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString();
                    string codice_scatto = recItem[keyCodice_scatto].ToString();
                    string codice_area = recItem[keyArea].ToString();

                    decimal paghi = recItem[keyPrezzo_offerta].ToDecimal();
                    decimal paghi_kgl = recItem[keyPrezzo_offerta_kgl].ToDecimal();
                    decimal anziche = recItem[keyPrezzo_anziche].ToDecimal();
                    decimal anziche_kgl = recItem[keyPrezzo_anziche_kgl].ToDecimal();
                    decimal prezzo_um_com = recItem[keyM_prezzo_offerta_um_com].ToDecimal();
                    decimal anziche_um_com = recItem[keyM_prezzo_anziche_um_com].ToDecimal();
                    string distintivita = recItem[keyDistintivita].ToString();

                    string um = recItem[GLOBAL_VARIABLES.keyDescrUm].ToString();
                    string um_fatt = recItem[keyM_unita_fatt].ToString();
                    string um_com = recItem[keyM_um_com].ToString();


                    decimal peso = recItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();

                    string descr_1 = recItem[GLOBAL_VARIABLES.keyDescr1].ToString();
                    string descr_brand = recItem[GLOBAL_VARIABLES.keyDescr2].ToString();
                    string descr_tipo = recItem[GLOBAL_VARIABLES.keyDescr3].ToString();
                    string descr_gramm = recItem[GLOBAL_VARIABLES.keyDescr4].ToString();

                    decimal scontoAgenzia = recItem[keySconto_agenzia].ToDecimal();
                    decimal N_MM = recItem[keyN_MM].ToDecimal();
                    decimal N_FID = recItem[keyN_FID].ToDecimal();
                    decimal M_MM = recItem[keyM_MM].ToDecimal();
                    decimal M_FID = recItem[keyM_FID].ToDecimal();

                    string punti1 = recItem[keyPunti_1].ToString();
                    string punti2 = recItem[keyPunti_2].ToString();
                    string range1 = recItem[keyRange_1].ToString();
                    string range2 = recItem[keyRange_2].ToString();
                    string tipo_punti = recItem[keyTipo_punti].ToString();
                    string note_cat = recItem[keyNote_category].ToString();

                    //decimal scontoMM = (decimal)recItem["scontoMM"]; 
                    //decimal scontoFID = (decimal)recItem["scontoFID"];

                    //sezione riassegnazione variabili cambiate di nome (In attesa del fix)
                    //recItem["sconto_norm"] = recItem[keySconto_MM];
                    //recItem["sconto_fid"] = recItem[keySconto_FID];
                    var sconto_norm = recItem[keySconto_MM].ToString();
                    var sconto_fid = recItem[keySconto_FID].ToString();

                    bool basso_fisso = ((tipo_tema.Contains("bass") && tipo_tema.Contains("fiss")) || (tipo_tema.Contains("bef") && !tipo_tema.Contains("befana"))) ||
                        ((tema.Contains("bass") && tema.Contains("fiss")) || (tema.Contains("bef") && !tema.Contains("befana"))) ||
                        (ruolo.Contains("b&f")) ||
                        (nota_category.Contains("bass") && nota_category.Contains("fiss"));

                    if (!basso_fisso && sezione != null)
                        basso_fisso = sezione.Contains("b&f") || (sezione.Contains("bass") && sezione.Contains("fiss"));

                    //if (tItem.tipo.Value == 2)
                    //Response.Write(nota_category + " - " + basso_fisso.ToString());



                    //Recupero le 4 descrizioni
                    string[] descrizioni_articolo = new string[] { descr_1, descr_brand, descr_tipo, descr_gramm };

                    #region Decifrazione meccanica e controllo "Al Kg al Lt"

                    Ordinamento gItem = dbGrammature.Where(s => s.CodiceSegmento == segmento).FirstOrDefault();

                    string str_offerta_unita = "";
                    string str_offerta_unita_sconto = "";
                    string str_offerta_unita_etto = "";
                    string str_offerta_unita_sconto_etto = "";
                    string str_offerta_unita_secondo = "";
                    string str_offerta_unitaTdopo = "";

                    bool flag_meccanica_unita = false;
                    bool flag_articolo_2x1_bis = false;
                    bool flag_articolo_2x1_bis_x_errore = false;



                    Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == meccanica).FirstOrDefault();

                    if (mItem == null)
                    {

                        result.errors += "Ref. " + codice_referenza + " - Meccanica " + meccanica + " non trovata!";

                        continue;
                    }

                    #region note crocettatura

                    //E' ancora da TESTARE
                    string note_crocettatura = "";
                    List<Dictionary<string, object>> myGroup = lista_tracciato.Where(l => l[GLOBAL_VARIABLES.keyScattoCodiceGruppo].ToString() == codice_gruppo).ToList();
                    List<Dictionary<string, object>> myGroupFiltered = myGroup.Where(r => filtroConfezione(recItem, r, myGroup)).ToList();

                    #region nuova implementazione
                    /*if (!req.confronta_liste)
                    {
                        if (oItem.CodiceScatto != "")
                        {*/
                    note_crocettatura = getNoteCrocettamento(recItem, myGroupFiltered);


                    #endregion

                    //if (is_fuori_volantino)
                    //    note_crocettatura = "";


                    //current_codScatto = oItem.codice_scatto;

                    #endregion

                    decimal paghi_kg_lt_indipendente = paghi_kgl;
                    //Response.Write(oItem.codice_referenza + " -> " + oItem.meccanica.ToLower()+"<br>");
                    var nmFid = false;
                    if (meccanica.ToLower() == "nm fid" || meccanica.ToLower() == "nm mix fid")
                    {
                        nmFid = true;
                        //recItem[keyPaghi_secondo] = paghi;
                        //recItem[keyPaghi_kgl_secondo] = paghi_kgl;
                        //recItem[keyPaghi_due_pezzi] = anziche;
                        //recItem["prezzo_offerte_kgl_lt_indipendente"] = anziche_kgl;
                    }

                    string paghi_etto = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                    string anziche_etto = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');


                    //recItem[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 999999;
                    if (gItem != null)
                    {
                        //recItem[GLOBAL_VARIABLES.keyIndiceOrdinamento] = gItem.Indice;

                        string u_str = "Kg";
                        if (um.ToLower() == "litro" || um.ToLower() == "lt")
                            u_str = "l";

                        str_offerta_unita = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi_kg_lt_indipendente));
                        str_offerta_unitaTdopo = String.Format("€ {0} al {1}", MathExt.DecimalRoundToString(paghi_kg_lt_indipendente), (u_str.ToLower() == "l" ? "lt" : u_str.ToLower()));
                        str_offerta_unita_sconto = String.Format("al {0} da € {1} a € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(anziche_kgl), MathExt.DecimalRoundToString(paghi_kgl));
                        if (/*recItem.ContainsKey(keyPaghi_kgl_secondo)*/nmFid)
                            str_offerta_unita_secondo = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi_kgl/*recItem[keyPaghi_kgl_secondo].ToDecimal()*/));



                        str_offerta_unita_etto = String.Format("al {0} € {1}", u_str.ToLower(), paghi_etto);
                        str_offerta_unita_sconto_etto = String.Format("al {0} € {1} anzichè € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi), MathExt.DecimalRoundToString(anziche));

                        recItem[keyM_numero_reparto] = gItem.numeroReparto;
                        recItem[keyM_numero_settore] = gItem.numeroSettore;

                        //Aggiunto il 10/03/2017 appositamente per l'uscita del TAG ERRORE che viene impostato sotto
                        flag_articolo_2x1_bis_x_errore = ((mItem.NomeTraduzione == "NM_MM" ||
                            mItem.NomeTraduzione == "NM_FID" ||
                            mItem.NomeTraduzione == "NM_MIX_MM" ||
                            mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione.ToLower() == "50sulsecondo"));


                        //recItem["gruppo_settori"] = gItem.Se


                        if (gItem.Food)
                        {

                            if (peso != 1 && peso != 0.1M)
                            {
                                if (um_fatt.ToLower() != "peso")
                                {
                                    //Response.Write("M -> " + meccanica_tradotta +"<br>");

                                    flag_meccanica_unita = true;

                                    flag_articolo_2x1_bis = ((mItem.NomeTraduzione == "NM_MM" ||
                                    mItem.NomeTraduzione == "NM_FID" ||
                                    mItem.NomeTraduzione == "NM_MIX_MM" ||
                                    mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione.ToString() == "50sulsecondo") &&
                                    (peso >= 0.051M && peso <= 0.099M));


                                    string meccanica_temp = recItem[key_combinazioneAssegnata].ToString();

                                    if (meccanica_temp.ToLower().Contains("50sulsecondo") && peso < 0.1M)
                                    {

                                        string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                        string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                        str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                        if (peso <= 0.049M)
                                        {
                                            paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                            str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);
                                            str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                        }

                                    }
                                    else if (peso > 0.1M ||
                                        ((mItem.NomeTraduzione == "NM_MM" ||
                                        mItem.NomeTraduzione == "NM_FID" ||
                                        mItem.NomeTraduzione == "NM_MIX_MM" ||
                                        mItem.NomeTraduzione == "NM_MIX_FID") &&
                                        (peso >= 0.051M && peso <= 0.099M))
                                        )
                                    {

                                        //Questa parte l'ho riportata sopra perchè questi dati servono A PRESCINDERE!

                                    }
                                    else
                                    {
                                        string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                        string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                        str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);

                                        paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                        str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);

                                        if (/*recItem.ContainsKey(keyPaghi_kgl_secondo)*/ nmFid && (peso >= 0.01M && peso <= 0.49M))
                                        {
                                            string paghi_100g_sec = MathExt.DecimalRoundToString(Decimal.Round((/*(decimal)recItem[keyPaghi_kgl_secondo]*/paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                            str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g_sec);
                                        }
                                    }

                                    //Response.Write("campo_offerta_KgL -> " + str_offerta_unita + "<br>");
                                    //Response.Write("campo_offerta_KgL_secondo -> " + str_offerta_unita_secondo + "<br>");
                                }

                            }

                            if ((mItem.NomeTraduzione == "NM_MM" ||
                                mItem.NomeTraduzione == "NM_FID" ||
                                mItem.NomeTraduzione == "NM_MIX_MM" ||
                                mItem.NomeTraduzione == "NM_MIX_FID") && (peso == 1 || peso == 0.1M))
                            {
                                flag_meccanica_unita = true;
                            }
                        }


                    }

                    //if ()
                    string descr_gr_copy = descr_gramm;


                    //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                    //Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                    //string meccanica_tradotta = mec2.NomeTraduzione;
                    string meccanica_tradotta = recItem[key_combinazioneAssegnata].ToString();
                    byte[] str_desc2_bytes = System.Text.Encoding.UTF8.GetBytes(descr_brand);
                    string _brand = System.Text.Encoding.UTF8.GetString(str_desc2_bytes);
                    byte[] str_desc3_bytes = System.Text.Encoding.UTF8.GetBytes(descr_tipo);
                    string _tipogusto = System.Text.Encoding.UTF8.GetString(str_desc3_bytes);
                    byte[] str_desc4_bytes = System.Text.Encoding.UTF8.GetBytes(descr_gr_copy);
                    string _gramm = System.Text.Encoding.UTF8.GetString(str_desc4_bytes);

                    #endregion

                    //controllo il mismatch prezzi per il reparto 9 e se corrisponde rimuovo il prezzo paghi
                    //bool mismatchPrezzi = false;
                    //if (reparto == 9)
                    //{
                    //    var prezzoBase = myGroup[0][keyPrezzo_offerta].ToDecimal();
                    //    foreach (var item in myGroup)
                    //    {
                    //        if (prezzoBase != item[keyPrezzo_offerta].ToDecimal())
                    //        {
                    //            mismatchPrezzi = true;
                    //            break;
                    //        }
                    //    }
                    //}

                    bool foto = recItem[referenza_pilota].ToString() == "S";
                    bool esempio = recItem[potenziale_esempio].ToString() != "";
                    //int statoSelezione = int.Parse(recItem[keyStatoSelezione].ToString());

                    if (recItem["Referenza.Codice"].ToString() == "5263850")
                    {
                        Debug.WriteLine("");
                    }


                    #region xml record                                                                    

                    if (counter == 0)
                    {


                    }


                    counter++;

                    //Aggiusto 0 nei prezzi addestramento nativi
                    //recItem[keyPrezzo_offerta] = mismatchPrezzi ? "" : MathExt.DecimalRoundToString(paghi);
                    recItem[keyPrezzo_offerta] = MathExt.DecimalRoundToString(paghi);
                    recItem[keyPrezzo_offerta_kgl] = MathExt.DecimalRoundToString(paghi_kgl);
                    //recItem["prezzo_offerta_KgL"] = MathExt.DecimalRoundToString(paghi_kgl);
                    var prezzo_offerta_KgL = MathExt.DecimalRoundToString(paghi_kgl);
                    recItem[keyPrezzo_anziche] = MathExt.DecimalRoundToString(anziche);
                    recItem[keyPrezzo_anziche_kgl] = MathExt.DecimalRoundToString(anziche_kgl);
                    recItem[keyM_prezzo_offerta_um_com] = MathExt.DecimalRoundToString(prezzo_um_com);
                    recItem[keyM_prezzo_anziche_um_com] = MathExt.DecimalRoundToString(anziche_um_com);


                    KeyValuePair<string, object> dicitura_reparto = getDicituraSuReparto(recItem, recItem[key_combinazioneAssegnata].ToString(), tipo_materiale.ToLower(), codice_area);
                    //recItem[dicitura_reparto.Key] = dicitura_reparto.Value;
                    //recItem[keyDicituraReparto] = dicitura_reparto.Value;

                    if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_sdb") > 0 &&
                        ((sezione.ToLower().IndexOf("tipico") >= 0 && sezione.IndexOf("benessere") >= 0) ||
                        (distintivita.ToLower().IndexOf("benessere") >= 0 && sezione.ToLower().IndexOf("benessere") >= 0) ||
                        (distintivita.ToLower().IndexOf("tipico") >= 0 && sezione.ToLower().IndexOf("tipico") >= 0)))
                    {
                        recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                    }
                    else if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_bdp") > 0 &&
                        sezione.ToLower().Contains("buono del paese"))
                    {
                        recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                    }




                    //Gestione dei loghi e bolli EXTRA - Messi in automatico secondo regole di agenzia
                    var loghibolli = getLoghiEBolliNew(recItem, descrizioni_articolo, gItem, 2, promoContext, kit, "", myGroup, formato, canale, area);
                    List<LogoBollo> _bolliloghi = new List<LogoBollo>();
                    foreach (var item in loghibolli.Keys)
                    {
                        if (item != "")
                        {
                            string val = loghibolli[item];
                            LogoBollo lbItem = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == val);
                            if (lbItem != null)
                                _bolliloghi.Add((LogoBollo)lbItem.Clone());
                            else
                            {
                                if (item == "logo_attributo_it")
                                {
                                    recItem["logo_attributo_it"] = val;
                                    LogoBollo logo_attributo_it = loghibolliDB.source.FirstOrDefault(lb => lb.sigla == "logo_attributo_it");
                                    if (logo_attributo_it != null)
                                        _bolliloghi.Add((LogoBollo)logo_attributo_it.Clone());
                                }
                            }
                        }
                    }

                    recItem[GLOBAL_VARIABLES.keyFotoExtraAuto] = _bolliloghi;

                    var prezzo_offerta_EURprima = "€ " + MathExt.DecimalRoundToString(paghi);
                    var prezzo_offerta_KgL_EURprima = "€ " + MathExt.DecimalRoundToString(paghi_kgl);

                    //string str_anziche = String.Format("anzichè € {0}", MathExt.Round(oItem.anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));
                    string str_anziche = String.Format("€ {0}", MathExt.Round(anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));


                    var campo_offerta_KgL = str_offerta_unita;
                    var campo_offerta_KgLt_dopo = str_offerta_unitaTdopo;
                    var campo_offerta = str_anziche;
                    var campo_offerta_KgL_sconto = str_offerta_unita_sconto;


                    var sconto_effettivo = "";
                    var sconto_effettivo_grande = "";

                    if (scontoAgenzia >= 0)
                    {
                        sconto_effettivo = "sconto " + MathExt.DecimalRoundToString(scontoAgenzia) + "%";

                        if (scontoAgenzia == 0)
                            sconto_effettivo_grande = "-00,00%";
                        else
                        {
                            sconto_effettivo_grande = "-" + MathExt.DecimalRoundToString(scontoAgenzia) + "%";
                        }
                    }

                    var campo_offerta_conf = "a conf. € " + MathExt.DecimalRoundToString(paghi);
                    var campo_offerta_ofalkg = "€ " + MathExt.DecimalRoundToString(anziche_kgl);
                    var campo_offerta_conf_sconto = "a conf. da € " + MathExt.DecimalRoundToString(anziche) + " a € " + MathExt.DecimalRoundToString(paghi);

                    decimal pz_etto_dec = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero);
                    string prezzo_offerta_etto = pz_etto_dec.ToString("0.00").Replace('.', ',');

                    decimal etto_dec = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero);
                    string campo_offerta_etto = "€ " + etto_dec.ToString("0.00").Replace('.', ',');
                    //recItem["prezzo_offerta_etto"] = prezzo_offerta_etto;
                    var prezzo_offerta_etto_EURprima = "€ " + prezzo_offerta_etto;
                    //recItem["campo_offerta_etto"] = campo_offerta_etto;



                    //recItem["stringa_etto"] = str_offerta_unita_sconto_etto;
                    var stringa_etto = str_offerta_unita_sconto_etto;

                    string differenza_etto_note = "";

                    ///*Non campionato


                    string prezzo_offerta_etto_LISTA = MathExt.DecimalRoundToString(prezzo_um_com);// MathExt.Round((RecInXml.prezzo_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                    string campo_offerta_etto_LISTA = "€ " + MathExt.DecimalRoundToString(anziche_um_com);//MathExt.Round((RecInXml.anziche_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                    string str_etto_LISTA = String.Format("al {0} € {1} anzichè € {2}", um_com, prezzo_um_com.ToString(), anziche_um_com.ToString()); //MathExt.DecimalRoundToString(RecInXml.prezzo_unita_misura_com.Value), MathExt.DecimalRoundToString(RecInXml.anziche_unita_misura_com.Value));

                    //recItem["prezzo_offerta_etto_LISTA"] = prezzo_offerta_etto_LISTA;
                    //recItem["prezzo_offerta_etto_EURprima_LISTA"] = "€ " + prezzo_offerta_etto_LISTA;
                    var prezzo_offerta_etto_EURprima_LISTA = "€ " + prezzo_offerta_etto_LISTA;
                    //recItem["campo_offerta_etto_LISTA"] = campo_offerta_etto_LISTA;
                    //recItem["stringa_etto_LISTA"] = str_offerta_unita_sconto_etto;
                    var stringa_etto_LISTA = str_offerta_unita_sconto_etto;

                    if ((pz_etto_dec != prezzo_um_com || etto_dec != anziche_um_com) &&
                        recItem[key_combinazioneAssegnata].ToString().Contains("_boxetto"))
                    {
                        differenza_etto_note = "prezzo Etto diverso su lista";
                    }



                    //decimal paghi_due_pezzi = recItem.ContainsKey(keyPaghi_due_pezzi) ? (decimal)recItem[keyPaghi_due_pezzi] : 0;
                    decimal paghi_due_pezzi = nmFid ? anziche : 0;
                    decimal paghi_secondo = recItem.ContainsKey(keyPaghi_secondo) ? (decimal)recItem[keyPaghi_secondo] : 0;

                    //recItem["prezzo_NOofferta_1pezzo"] = MathExt.DecimalRoundToString(paghi);
                    //recItem["prezzo_NOofferta_1pezzo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi);
                    //recItem["prezzo_NOofferta_2pezzi"] = MathExt.DecimalRoundToString(paghi_due_pezzi);
                    var prezzo_NOofferta_1pezzo = MathExt.DecimalRoundToString(paghi);
                    var prezzo_NOofferta_1pezzo_EURprima = "€ " + MathExt.DecimalRoundToString(paghi);
                    var prezzo_NOofferta_2pezzi = MathExt.DecimalRoundToString(paghi_due_pezzi);
                    //recItem["prezzo_offerta_secondo"] = MathExt.DecimalRoundToString(paghi_secondo);
                    //recItem["prezzo_offerta_secondo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi_secondo);
                    var prezzo_offerta_secondo = MathExt.DecimalRoundToString(paghi_secondo);
                    var prezzo_offerta_secondo_EURprima = "€ " + MathExt.DecimalRoundToString(paghi_secondo);
                    //recItem["campo_offerta_KgL_secondo"] = str_offerta_unita_secondo;
                    var campo_offerta_KgL_secondo = str_offerta_unita_secondo;


                    string _tipo_range = getTipoRange(recItem, "1");
                    //recItem["PezzConf"] = "1 " + _tipo_range;
                    var PezzConf = "1 " + _tipo_range;

                    //recItem["campo_x1"] = "1 " + _tipo_range + " € " + MathExt.DecimalRoundToString(paghi);
                    var campo_x1 = "1 " + _tipo_range + " € " + MathExt.DecimalRoundToString(paghi);


                    var PezzConf_NM = "";
                    if (recItem[key_combinazioneAssegnata].ToString().IndexOf("NM_") >= 0)//Meccanica BIS
                    {
                        if (recItem[key_combinazioneAssegnata].ToString().IndexOf("_FID") < 0)
                            PezzConf_NM = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM));
                        else
                            PezzConf_NM = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID));
                    }
                    else
                        PezzConf_NM = "";


                    string un_pezzo_euro = " € " + MathExt.DecimalRoundToString(paghi);

                    //recItem["N_MM_str"] = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    //recItem["M_MM_str"] = MathExt.DecimalOrIntToString(M_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    //recItem["N_FID_str"] = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID)) + un_pezzo_euro;//xml_writer.WriteElementString(keyN_FID, Helpers.MathExt.DecimalOrIntToString(oItem.n_fidelity.Value) + " " + ((oItem.n_fidelity.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    //recItem["M_FID_str"] = MathExt.DecimalOrIntToString(M_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_FID)) + un_pezzo_euro;

                    var N_MM_str = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    var M_MM_str = MathExt.DecimalOrIntToString(M_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    var N_FID_str = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID)) + un_pezzo_euro;//xml_writer.WriteElementString(keyN_FID, Helpers.MathExt.DecimalOrIntToString(oItem.n_fidelity.Value) + " " + ((oItem.n_fidelity.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                    var M_FID_str = MathExt.DecimalOrIntToString(M_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_FID)) + un_pezzo_euro;


                    if (flag_articolo_2x1_bis_x_errore)
                    {

                        if ((N_MM != 2 || N_MM != 1) &&
                            (mItem.NomeTraduzione == "NM_MM" || mItem.NomeTraduzione == "NM_MIX_MM")
                            )
                        {
                            note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                        }
                        else if ((N_FID != 2 || M_FID != 1) &&
                            (mItem.NomeTraduzione == "NM_FID" || mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione == "50SulSecondo")
                            )
                        {
                            note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                        }
                    }


                    if (recItem[key_combinazioneAssegnata].ToString().IndexOf("PUNTI_PERCENTO") >= 0 || recItem[key_combinazioneAssegnata].ToString().IndexOf("PUNTI_TP") >= 0)
                    {
                        if (punti1 == "")
                        {
                            note_crocettatura += "<br>ERRORE: CONTROLLARE VALORI RANGE/PUNTI";
                        }
                    }

                    if (differenza_etto_note != "")
                    {
                        note_crocettatura += ("<br>" + differenza_etto_note);
                    }

                    //recItem["range1_xExport"] = range1;

                    if (range1 != "")
                        //recItem["range1_xExport"] = range1 + " " + getTipoRange(recItem, range1);
                        range1 = range1 + " " + getTipoRange(recItem, range1);



                    var tipo_punti1 = getTipoPunti(tipo_punti, punti1);
                    //recItem["tipo_punti1"] = tipo_punti1;



                    //recItem["range2_xExport"] = "";
                    //recItem["range2_xExport"] = range2 + " " + getTipoRange(recItem, range2);
                    range2 = range2 + " " + getTipoRange(recItem, range2);
                    var tipo_punti2 = getTipoPunti(tipo_punti, punti2);
                    //recItem["tipo_punti2"] = tipo_punti2;



                    if (note_cat.Replace(" ", "") == "")
                        recItem[keyNote_category] = "";
                    else
                        recItem[keyNote_category] = recItem[keyNote_category].ToString().Replace("\r\n", "<br>");


                    //recItem["note"] = note_crocettatura;
                    var note = note_crocettatura;


                    //Ripristino la grammatura originale come da excel!
                    recItem[GLOBAL_VARIABLES.keyDescr4] = descr_gr_copy;


                    #endregion

                    #region compiledfield
                    var combinazioneAssegnata = recItem[key_combinazioneAssegnata].ToString();
                    var codiceBox = recItem[key_codiceBox].ToString();

                    if (!recItem.ContainsKey(keyM_numero_reparto))
                    {
                        throw new Exception("Numero reparto non specificato per il prodotto: " + recItem["Referenza.Codice"] + ". Il gItem è " + (gItem == null ? "null" : "presente") + ", il segmento che non è stato trovato è: " + segmento);
                    }

                    var numero_reparto = int.Parse(recItem[keyM_numero_reparto].ToString());
                    //var guidArea = kit.guidArea;
                    //var guidCanale = kit.guidCanale;
                    //var areaObj = acpvDB.aree.Find(f => f.guidID == guidArea);
                    //var area = areaObj != null ? areaObj.sigla : "";
                    //var canaleObj = acpvDB.canali.Find(f => f.guidID == guidCanale);
                    //var canale = canaleObj != null ? canaleObj.sigla : "";
                    //parseMeccanica_provvisorio(objRef, allEtichette, pathLavorazione, area, canale) {
                    var contesto_promo = recItem.ContainsKey("Context.Promo") ? recItem["Context.Promo"] as List<FicoContextField> : new List<FicoContextField>();
                    var materiale = cercaChiaveContesto("materiale", contesto_promo);
                    var temaContesto = cercaChiaveContesto("tema", contesto_promo);
                    var allEtichette = recItem["allEtichette"] as List<string>;
                    var grafica_50al50 = allEtichette.Contains("SEZ. 50 AL 50");
                    bool isMZLOC = ((tema.ToUpper().IndexOf("LOC") >= 0 && materiale == "MZ") || allEtichette.Contains("MZLOC"));
                    string descrizioneParagraphStyle = "";

                    var suffix_plus = "";
                    if (materiale == "EV" && combinazioneAssegnata != "validita")
                        suffix_plus = "_evento";

                    if (materiale == "ISTITUZIONALE" && combinazioneAssegnata != "validita")
                        suffix_plus = "_BFist";

                    if (materiale == "INT" && combinazioneAssegnata != "validita")
                        suffix_plus = "_INT";

                    if (materiale == "RIL" && combinazioneAssegnata != "validita")
                        suffix_plus = "_RIL";

                    #region dichiarazione box
                    List<BoxIndd> boxIndesignList = new List<BoxIndd>();
                    if (recItem["Referenza.Codice"].ToString() == "5589800")
                    {
                        Debug.WriteLine("Hey");
                    }

                    var prezzoOfferta = recItem["prezzo_offerta"].ToString();

                    if (codiceBox == "BOX1_PoP")
                    {
                        var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                        if (prezzoOfferta != null && prezzoOfferta != "")
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_offerta");
                        }
                        var sconto = sconto_norm;
                        if (!combinazioneAssegnata.ToLower().Contains("_fid"))
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale, 2); // ✔
                        }
                        else
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale, 2); // ✔
                            sconto = sconto_fid;
                        }

                        string characterName = paragraphName.Replace("_SCONTO", "_CSconto");


                        if (combinazioneAssegnata.ToLower().Contains("_all") ||
                            combinazioneAssegnata.ToLower().Contains("_kgl"))
                        {
                            interprete.assignCompiledField("val_sconto", "", "<" + characterName + ">" + sconto + "</" + characterName + ">");
                            interprete.removeCompiledField("gruppo_sconto_grande");
                        }
                        else
                        {
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.assignCompiledField("val_sconto_grande", paragraphName, "<" + characterName + ">" + sconto + "</" + characterName + ">");
                        }

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "PezzConf_NM", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("PezzConf_NM", paragraphName, PezzConf_NM);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                        //if (canale != "SC")
                        //{
                        //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                        //    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, recItem["prezzo_offerta_EURprima"].ToString());

                        //    if (materiale != "EV")
                        //    {
                        //        interprete.removeCompiledField("sy_etto");
                        //        interprete.removeCompiledField("LBL_Carte");

                        //    }
                        //}
                    }
                    //else if (codiceBox == "BOX2_PoP")
                    //{
                    //    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale);
                    //    interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, recItem["campo_offerta_KgL_sconto"].ToString());

                    //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale);
                    //    interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, recItem["sconto_effettivo_grande"].ToString());

                    //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                    //    interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());

                    //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale);
                    //    interprete.assignCompiledField("sconto_norm", paragraphName, recItem["sconto_norm"].ToString());

                    //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale);
                    //    interprete.assignCompiledField("sconto_fid", paragraphName, recItem["sconto_fid"].ToString());

                    //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale);
                    //    interprete.assignCompiledField("campo_offerta", paragraphName, recItem["campo_offerta"].ToString());

                    //    if (canale != "SC")
                    //    {
                    //        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_EURprima", codiceBox, canale);
                    //        interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, recItem["prezzo_offerta_EURprima"].ToString());
                    //    }
                    //}
                    else if (codiceBox == "BOX2_PoP")
                    {
                        var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale); // ✔
                        interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("prezzo_offerta_etto", paragraphName, prezzo_offerta_etto);


                        if (!combinazioneAssegnata.ToLower().Contains("_fid"))
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_norm", codiceBox, canale, 2); // ✔
                            interprete.assignCompiledField("val_sconto", paragraphName, sconto_norm);
                        }
                        else
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_fid", codiceBox, canale, 2); // ✔
                            interprete.assignCompiledField("val_sconto", paragraphName, sconto_fid);
                        }

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("campo_offerta_etto", paragraphName, campo_offerta_etto);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("prezzo_offerta_etto_EURprima", paragraphName, prezzo_offerta_etto_EURprima);
                        //if (canale != "SC")
                        //{
                        //    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale); // ✔
                        //    interprete.assignCompiledField("prezzo_offerta_etto_EURprima", paragraphName, recItem["prezzo_offerta_etto_EURprima"].ToString());
                        //}
                    }
                    else if (codiceBox == "BOX3_PoP")
                    {
                        string paragraphName = "";

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "range1", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("range1", paragraphName, range1);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "punti1", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("punti1", paragraphName, recItem["punti_1"].ToString());

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                        if (prezzoOfferta != null && prezzoOfferta != "")
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_offerta");
                        }
                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale, 2); // ✔
                        interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);
                    }
                    else if (codiceBox == "BOX4_PoP")
                    {
                        string paragraphName = "";

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "range1", codiceBox, canale, 2);
                        interprete.assignCompiledField("range1", paragraphName, range1);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "punti1", codiceBox, canale, 2);
                        interprete.assignCompiledField("punti1", paragraphName, recItem["punti_1"].ToString());

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "tipo_punti1", codiceBox, canale, 2);
                        interprete.assignCompiledField("tipo_punti1", paragraphName, tipo_punti1);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL_sconto", codiceBox, canale, 2);
                        interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL_sconto);

                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "sconto_effettivo_grande", codiceBox, canale, 2);
                        interprete.assignCompiledField("sconto_effettivo_grande", paragraphName, sconto_effettivo_grande);

                        if (prezzoOfferta != null && prezzoOfferta != "")
                        {
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta", codiceBox, canale);
                            interprete.assignCompiledField("prezzo_offerta", paragraphName, recItem["prezzo_offerta"].ToString());
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_offerta");
                        }
                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta", codiceBox, canale, 2);
                        interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta);

                        if (combinazioneAssegnata == "PUNTI_minicoll" || combinazioneAssegnata == "PUNTI_KgL_minicoll")
                        {
                            descrizioneParagraphStyle = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descrizione", codiceBox, canale, 2);
                        }
                    }

                    recItem[GLOBAL_VARIABLES.keyScattoCodiceGruppo] = recItem[GLOBAL_VARIABLES.keyRefCodice];


                    #endregion

                    #region parseMeccanica


                    var descrizione = "";
                    //var stringa_etto = "stringa_etto";
                    var val_stringa_etto = stringa_etto;

                    if (temaContesto.ToUpper().IndexOf("LOC") >= 0)
                    {
                        //Dalla tendina iniziale ho slezionato LOC. Per effetto placebo lo impostiamo a VOL
                        contesto_promo = assegnaNuovoValoreContesto("materiale", "VOL", contesto_promo);
                        materiale = "VOL";
                    }



                    interprete.removeCompiledField("LBL_Reparto");




                    if (meccanica_tradotta.IndexOf("VAL_MM") >= 0)
                    {
                        interprete.removeCompiledField("carta");
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("sconto");
                        interprete.removeCompiledField("sconto_grande");
                    }
                    else if (meccanica_tradotta.IndexOf("VAL_FID") >= 0)
                    {
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("sconto");
                        interprete.removeCompiledField("sconto_grande");
                    }
                    else if (meccanica_tradotta.IndexOf("50al50") >= 0)
                    {
                        if (canale != "SC")
                        {
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto_effettivo_grande");
                        }

                        if (meccanica_tradotta.IndexOf("50al50Norm") >= 0)
                        {
                            interprete.removeCompiledField("LBL_Carte");
                            interprete.removeCompiledField("sconto_fid");
                        }
                        else
                        {
                            interprete.removeCompiledField("sconto_norm");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("_minicoll") > 0)
                    {
                        interprete.removeCompiledField("carta");
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("sconto");
                        interprete.removeCompiledField("00");
                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("prezzo");
                        interprete.removeCompiledField("anzichè");
                        interprete.removeCompiledField("linee");


                        if (meccanica_tradotta.IndexOf("PUNTI_TP") < 0 && meccanica_tradotta.IndexOf("PERCENTO") < 0)
                        {
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (1) per meccanica: " + meccanica_tradotta);
                            interprete.removeCompiledField("campo_offerta_KgL");
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");
                            interprete.removeCompiledField("sconto_effettivo_grande");


                            if (meccanica_tradotta.IndexOf("PUNTI_MULTI") < 0)
                            {
                                interprete.removeCompiledField("Range_Punti_2");
                                interprete.removeCompiledField("LBL_Carte");
                            }

                        }
                        else if (meccanica_tradotta.IndexOf("PUNTI_TP") >= 0)
                        {
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("Range_Punti_2");

                        }
                        else if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                        {
                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("Range_Punti_2");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("_bonus") > 0)
                    {
                        interprete.removeCompiledField("carta");
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("sconto");
                        interprete.removeCompiledField("00");
                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("prezzo");
                        interprete.removeCompiledField("anzichè");

                        if (meccanica_tradotta.IndexOf("MULTI_PERCENTO") > 0)
                        {
                            interprete.removeCompiledField("sconto_effettivo_grande");
                        }
                        else if (meccanica_tradotta.IndexOf("MULTI_TP") > 0)
                        {
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("gruppo_sconto_grande");

                        }
                        else if (meccanica_tradotta.IndexOf("MULTI") > 0)
                        {
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (2) per meccanica: " + meccanica_tradotta);

                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("gruppo_sconto_grande");

                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                            interprete.removeCompiledField("PezzConf");
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");
                            interprete.removeCompiledField("linee");
                        }
                        else if (meccanica_tradotta.IndexOf("PERCENTO") > 0)
                        {
                            interprete.removeCompiledField("Range_Punti_2");
                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("PezzConf");
                        }
                        else if (meccanica_tradotta.IndexOf("TP") > 0)
                        {
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("gruppo_sconto_grande");

                            interprete.removeCompiledField("PezzConf");

                            interprete.removeCompiledField("Range_Punti_2");
                        }
                        else
                        {
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (3) per meccanica: " + meccanica_tradotta);

                            interprete.removeCompiledField("campo_offerta_KgL");
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");
                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                            interprete.removeCompiledField("PezzConf");
                            interprete.removeCompiledField("Range_Punti_2");
                            interprete.removeCompiledField("linee");
                        }

                    }
                    else if (meccanica_tradotta.IndexOf("ALTRO") >= 0)
                    {
                        interprete.removeCompiledField("carta");
                        interprete.removeCompiledField("LBL_Carte");
                        interprete.removeCompiledField("LBL_Titolari");

                        if (canale == "SC")
                        {
                            interprete.removeCompiledField("PIEDE_Titolari");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("OA_") == 0)
                    {
                        interprete.removeCompiledField("carta");
                        interprete.removeCompiledField("LBL_Carte");
                        interprete.removeCompiledField("LBL_Titolari");

                        if (canale == "SC")
                        {
                            interprete.removeCompiledField("PIEDE_Titolari");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_123") >= 0)
                        {

                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("sconto");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("anzichè");
                        }

                        if (meccanica_tradotta.IndexOf("_KgL") > 0)
                        {
                            if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                            }

                            else
                            {
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                            }

                        }


                        var suff = "_KgL";
                        var stile = "";
                        if (meccanica_tradotta.IndexOf("_regionale") > 0)
                        {
                            suff = "_KgL_sconto";
                        }

                        if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                        {
                            if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf);

                            }
                            else
                            {
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL", paragraphName, campo_offerta_conf);

                            }

                            if (materiale != "EV")
                            {
                                if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta");
                                }
                            }
                            else
                            {
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("_ofaconf") >= 0)
                        {
                            if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                            }
                            else
                            {
                                interprete.removeCompiledField("campo_offerta_KgL_sconto");//Tanto va avanti campo:offerta_KgL
                            }
                        }
                        else if (meccanica_tradotta.IndexOf("_regionale") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_KgL") > 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_KgL);
                            }

                            if (meccanica_tradotta.IndexOf("_boxetto") >= 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            {
                                interprete.removeCompiledField("campo_offerta_etto");

                            }
                        }

                        interprete.removeCompiledField("sconto_effettivo_grande");
                        interprete.removeCompiledField("sconto_effettivo");

                        interprete.removeCompiledField("sconto_fid");
                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("LBL_Carte");
                    }
                    else if (meccanica_tradotta.IndexOf("sir_sconto") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_123") >= 0)
                        {
                            interprete.removeCompiledField("carta");
                        }

                        if (temaContesto.ToUpper().IndexOf("LOC") < 0)
                        {
                            if (materiale == "EV")
                            {
                                interprete.removeCompiledField("LBL_Carte");
                            }
                        }
                        else
                        {
                            interprete.removeCompiledField("campo_offerta_KgL");
                            interprete.removeCompiledField("LBL_Carte");
                        }

                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("gruppo_sconto_grande");
                        interprete.removeCompiledField("gruppo_sconto");

                        //if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("_evento") < 0 /*&& meccanica_tradotta.IndexOf("_inostriori")<0  */ && materiale != "EV") {
                        if (materiale != "INT" && materiale != "RIL" && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                        else
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                    }
                    else if (meccanica_tradotta.IndexOf("TP_FID") >= 0)
                    {

                        if (tema.ToUpper().IndexOf("LOC") >= 0)
                        {
                            interprete.removeCompiledField("campo_offerta_KgL");
                        }


                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("gruppo_sconto_grande");
                        interprete.removeCompiledField("gruppo_sconto");

                        if (materiale != "INT" && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                        {
                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                        }
                        else
                        {
                            if (meccanica_tradotta.IndexOf("_evento") < 0)
                            {
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                            }
                        }

                        if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                        {

                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale, 2);
                            interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);
                            if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                            }
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta");
                            }
                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_ofalkg", codiceBox, canale, 2);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_ofalkg);

                            if (materiale == "EV")
                            {
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }
                            }
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("MM_ALL") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_123") >= 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("anzichè");
                        }


                        if (tema.ToUpper().IndexOf("LOC") >= 0)
                        {
                            interprete.removeCompiledField("campo_offerta_KgL");
                        }

                        interprete.removeCompiledField("sconto_fid");
                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("LBL_Carte");
                    }
                    else if (meccanica_tradotta.IndexOf("FID_ALL") >= 0)
                    {
                        interprete.removeCompiledField("PezzConf_NM");
                        interprete.removeCompiledField("00");
                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("anzichè");
                        interprete.removeCompiledField("sconto_norm");

                        if (tema.ToUpper().IndexOf("LOC") >= 0)
                        {
                            interprete.removeCompiledField("campo_offerta_KgL");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("NM_MM") >= 0 || meccanica_tradotta.IndexOf("NM_MIX") >= 0 || meccanica_tradotta.IndexOf("NM_FID") >= 0)
                    {
                        var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "M_MM", codiceBox, canale, 2);
                        interprete.assignCompiledField("M_MM", paragraphName, M_MM_str);

                        if (meccanica_tradotta.IndexOf("FID") > 0)
                        {

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "M_fid", codiceBox, canale, 2);
                            interprete.assignCompiledField("M_MM", paragraphName, M_FID_str);
                        }
                        else if (meccanica_tradotta.IndexOf("_123") > 0)
                        {
                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (4) per meccanica: " + meccanica_tradotta);

                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("gruppo_sconto");
                            //console.error("gs 9");
                            if (meccanica_tradotta.IndexOf("_KgL") > 0)
                            {
                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_KgL", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_KgL);
                            }
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("MM") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_123") >= 0)
                        {
                            interprete.removeCompiledField("carta");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                        }

                        if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                        {
                            interprete.removeCompiledField("sconto_fid");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("LBL_Carte");
                        }

                    }
                    else if (meccanica_tradotta.IndexOf("_FID") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_123") >= 0)
                        {
                            interprete.removeCompiledField("PezzConf_NM");
                            interprete.removeCompiledField("00");
                            interprete.removeCompiledField("scritta_xx");
                        }

                        if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                        {
                            interprete.removeCompiledField("sconto_norm");
                            interprete.removeCompiledField("scritta_xx");
                            interprete.removeCompiledField("PezzConf_NM");
                        }

                        if (tema.ToUpper().IndexOf("LOC") >= 0)
                        {
                            interprete.removeCompiledField("campo_offerta_KgL");
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("VEDERE_NOTE") >= 0)
                    {

                        interprete.removeCompiledField("LBL_Carte");
                        interprete.removeCompiledField("LBL_Titolari");

                        if (canale == "SC")
                        {
                            interprete.removeCompiledField("PIEDE_Titolari");

                        }

                        if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                        {
                            interprete.removeCompiledField("linee");
                        }


                    }


                    if (meccanica_tradotta.IndexOf("_sdb") >= 0 || meccanica_tradotta.IndexOf("_bdp") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("_bdp") >= 0)
                        {
                            //interprete.removeCompiledField("logo_SDB");
                            interprete.removeCompiledField("fondo_distintivita_SDB");

                        }
                        else
                        {
                            //interprete.removeCompiledField("logo_BDP");
                            interprete.removeCompiledField("fondo_distintivita_BDP");

                        }

                        if (meccanica_tradotta.IndexOf("_boxetto") >= 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                        {
                            if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_etto");
                            }

                            if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                            {
                                stringa_etto = "campo_offerta_KgL";
                                val_stringa_etto = campo_offerta_KgL;

                                //interprete.assignCompiledField("stringa_etto", "", "<campo_offerta_KgL>" + recItem["campo_offerta_KgL"].ToString() + "</campo_offerta_KgL>");
                            }


                            if (meccanica_tradotta.IndexOf("PERCENTO") < 0 && materiale != "INT" && materiale != "RIL")
                            {
                                interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                            }
                            else
                            {
                                if (meccanica_tradotta.IndexOf("PERCENTO") >= 0 && canale == "SC")
                                {
                                    interprete.removeCompiledField("prezzo_offerta_gruppo");
                                }
                            }

                            interprete.removeCompiledField("stringa_etto");

                        }
                        else
                        {
                            interprete.removeCompiledField("alletto");
                        }



                    }
                    else if (meccanica_tradotta.IndexOf("_boxetto") >= 0)
                    {
                        if (isMZLOC)
                        {
                            interprete.removeCompiledField("base");
                        }

                        if (canale == "SC")
                        {
                            if (tipo_tema.ToLower().IndexOf("focus") >= 0)
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_SDB");
                                interprete.removeCompiledField("fondo_distintivita_BDP");
                            }
                        }
                        else
                        {
                            //interprete.removeCompiledField("logo_SDB");
                            //interprete.removeCompiledField("logo_BDP");
                            interprete.removeCompiledField("fondo_distintivita_SDB");
                            interprete.removeCompiledField("fondo_distintivita_BDP");
                        }

                        interprete.removeCompiledField("stringa_etto");
                        interprete.removeCompiledField("LBL_Carte");


                        if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                        {
                            stringa_etto = "campo_offerta_KgL";
                            val_stringa_etto = campo_offerta_KgL;
                            //interprete.assignCompiledField("stringa_etto", "", "<campo_offerta_KgL>" + recItem["campo_offerta_KgL"].ToString() + "</campo_offerta_KgL>");
                        }

                        if ((meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV") &&
                            (meccanica_tradotta.IndexOf("TP_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("sir_sconto") >= 0))
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto_EURprima", codiceBox, canale, 2);
                            interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_etto_EURprima);

                            paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale, 2);
                            interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_etto);
                        }

                        if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                        {
                            if (canale != "SC")
                                interprete.removeCompiledField("prezzo_offerta_etto");

                            interprete.removeCompiledField("sconto_effettivo_grande");
                            if (materiale.Contains("MZ") && meccanica_tradotta.IndexOf("_evento") < 0 && canale != "SC")
                            {
                                interprete.removeCompiledField("sy_euro");
                            }
                        }
                        else
                        {
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("gruppo_sconto");

                            if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("PERCENTO") < 0)
                                interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                            else
                            {
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                            }

                            if (meccanica_tradotta.IndexOf("sir_sconto") < 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo_grande");
                            }

                            if (meccanica_tradotta.IndexOf("TP_MM") >= 0)
                            {
                                interprete.removeCompiledField("campo_offerta_etto");
                            }
                        }
                    }
                    else if (meccanica_tradotta.IndexOf("_inostriori") >= 0 || meccanica_tradotta.IndexOf("_territorio") >= 0)
                    {

                        if (meccanica_tradotta.IndexOf("_boxetto") >= 0)
                        {
                            interprete.removeCompiledField("base");
                        }

                        if (!isMZLOC)
                        {
                            interprete.removeCompiledField("boxDescrPrezzi_ORI_TERRITORIO");
                            interprete.removeCompiledField("base_inostriori_territorio");
                        }
                        else
                        {
                            interprete.removeCompiledField("base");
                        }

                        if (reparto != 33 &&
                            reparto != 31 &&
                            reparto != 29 &&
                            reparto != 27 &&
                            reparto != 25 &&
                            reparto != 21)
                        {
                            interprete.removeCompiledField("gruppo_reparto");
                        }

                    }
                    else if (isMZLOC)
                    {
                        //Siamo in caso meccanica Territorio NON _inostriori
                        interprete.removeCompiledField("base");
                    }

                    if (meccanica_tradotta.IndexOf("_KgL") < 0)
                    {

                        interprete.removeCompiledField("campo_offerta_KgL");
                        interprete.removeCompiledField("campo_offerta_KgL_sconto");
                    }



                    interprete.removeCompiledField("sconto");

                    if (meccanica_tradotta.IndexOf("NM_MM") < 0 && meccanica_tradotta.IndexOf("NM_MIX") < 0 && meccanica_tradotta.IndexOf("50al50") < 0)
                    {
                        if (meccanica_tradotta.IndexOf("PERCENTO") < 0 &&
                            meccanica_tradotta.IndexOf("TP_FID") < 0 &&
                            meccanica_tradotta.IndexOf("sir_sconto") < 0 &&
                            meccanica_tradotta.IndexOf("PUNTI") < 0 &&
                            meccanica_tradotta.IndexOf("sottocosto") < 0 &&
                            meccanica_tradotta.IndexOf("50sulSecondo") < 0)
                        {
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (5) per meccanica: " + meccanica_tradotta);


                            if ((materiale != "INT" && materiale != "RIL") && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            {
                                interprete.removeCompiledField("prezzo_offerta_EURprima");
                            }
                            else if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                            {
                                interprete.removeCompiledField("sconto_effettivo");
                            }

                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("gruppo_sconto");

                        }
                        else if (meccanica_tradotta.IndexOf("PERCENTO") >= 0 && meccanica_tradotta.IndexOf("_minicoll") < 0 && meccanica_tradotta.IndexOf("_bonus") < 0 && meccanica_tradotta.IndexOf("_evento") < 0)
                        {

                            if ((tema.ToUpper().IndexOf("LOC") < 0 && canale != "SC") || isMZLOC)
                            {
                                interprete.removeCompiledField("prezzo_offerta_gruppo");
                            }

                            interprete.removeCompiledField("sconto_effettivo_grande");

                            if (meccanica_tradotta.IndexOf("_evento") >= 0 || materiale == "EV")
                            {
                                interprete.removeCompiledField("sconto_effettivo");
                            }


                            if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                            {
                                string paragraphName = "";
                                if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta_EURprima");
                                }

                                if (canale == "SC")
                                {
                                    if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                    {
                                        paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                        interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                    }
                                    else
                                    {
                                        interprete.removeCompiledField("prezzo_offerta");
                                    }
                                }

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_ofalkg", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_ofalkg);
                            }
                        }
                    }


                    if (meccanica_tradotta.IndexOf("_sdb") >= 0)
                    {

                        if (meccanica_tradotta.IndexOf("_FID") < 0)
                            interprete.removeCompiledField("sconto_fid");

                        interprete.removeCompiledField("scritta_xx");
                        interprete.removeCompiledField("PezzConf_NM");

                        interprete.removeCompiledField("alletto");//Da capire quando serve

                        if (meccanica_tradotta.IndexOf("PERCENTO") >= 0)
                        {


                            if (meccanica_tradotta.IndexOf("_boxetto") > 0 && meccanica_tradotta.IndexOf("_evento") < 0 && materiale != "EV")
                            {
                                interprete.removeCompiledField("linee");
                            }

                            interprete.removeCompiledField("sconto_effettivo_grande");
                        }
                        else
                        {
                            interprete.removeCompiledField("gruppo_sconto_grande");
                            interprete.removeCompiledField("gruppo_sconto");
                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                        }
                    }
                    else
                    {
                        interprete.removeCompiledField("rect_regionale");
                    }

                    if (meccanica_tradotta.IndexOf("_bdp") >= 0 || meccanica_tradotta.IndexOf("_sdb") >= 0)
                    {
                        if (tipo_tema.ToLower().IndexOf("focus") >= 0)
                        {
                            if (canale == "SC")
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_SDB");
                                interprete.removeCompiledField("fondo_distintivita_BDP");
                            }
                            else
                            {
                                //interprete.removeCompiledField("logo_SDB");
                                //interprete.removeCompiledField("logo_BDP");
                                interprete.removeCompiledField("fondo_distintivita_SDB");
                                interprete.removeCompiledField("fondo_distintivita_BDP");
                            }
                        }

                    }
                    else
                    {
                        //interprete.removeCompiledField("logo_SDB");
                        //interprete.removeCompiledField("logo_BDP");
                    }

                    if (meccanica_tradotta.IndexOf("_mercato") > 0 && codiceBox != "BOX7")
                    {

                        if (meccanica == "PERCENTO_MM_mercato_boxetto" && canale == "SC")
                        {
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                            interprete.removeCompiledField("sy_etto");
                            interprete.removeCompiledField("rect_etto");
                        }

                    }

                    if ((codiceBox == "BOX6" && meccanica_tradotta.IndexOf("PERCENTO") < 0) || tema.ToUpper().IndexOf("LOC") >= 0)
                    {
                        interprete.removeCompiledField("linee");
                    }

                    if (meccanica_tradotta.IndexOf("_evento") > 0 || (materiale == "EV" && meccanica != "validita"))
                    {

                        interprete.removeCompiledField("linea");

                        if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                        {
                            interprete.removeCompiledField("sy_etto");
                        }
                        else
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale, 2);
                            interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);
                        }

                        if (meccanica_tradotta.IndexOf("NM_") < 0)
                        {
                            if (meccanica_tradotta.IndexOf("FID") < 0)
                            {
                                interprete.removeCompiledField("sconto_fid");
                            }
                        }
                    }

                    if (meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_FID") >= 0)
                    {
                        if (meccanica_tradotta.IndexOf("PERCENTO_MM_ALL") < 0 && meccanica_tradotta.IndexOf("PERCENTO_FID_ALL") < 0)
                        {
                            interprete.removeCompiledField("PezzConf_NM");
                            if (canale == "SC")
                            {
                                interprete.removeCompiledField("rect_tipico");
                            }
                            interprete.removeCompiledField("prezzo_offerta_gruppo");
                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                            interprete.removeCompiledField("campo_offerta");
                            Console.WriteLine("Rimuovo campo_offerta (6) per meccanica: " + meccanica_tradotta);

                            interprete.removeCompiledField("sconto_effettivo_grande");
                            interprete.removeCompiledField("campo_offerta_KgL_sconto");
                            interprete.removeCompiledField("campo_offerta_KgL");
                            interprete.removeCompiledField("stringa_etto");
                            interprete.removeCompiledField("prezzo_offerta_etto_EURprima");
                            interprete.removeCompiledField("campo_offerta_etto");
                            interprete.removeCompiledField("quantitativi");
                            interprete.removeCompiledField("M_MM");
                            interprete.removeCompiledField("gruppo_PezzConf");
                            interprete.removeCompiledField("prezzo_NOofferta_1pezzo_EURprima");
                            interprete.removeCompiledField("prezzo_offerta_secondo_EURprima");
                            interprete.removeCompiledField("sy_2x1");
                        }
                        else if (meccanica_tradotta.IndexOf("_evento") >= 0)
                        {
                            interprete.removeCompiledField("sconto_effettivo_grande");
                            if (meccanica_tradotta.IndexOf("_ofalkg") >= 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_conf_sconto", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta_KgL_sconto", paragraphName, campo_offerta_conf_sconto);

                                if (prezzo_offerta_KgL != null && prezzo_offerta_KgL != "")
                                {
                                    paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL", codiceBox, canale);
                                    interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_KgL);
                                }
                                else
                                {
                                    interprete.removeCompiledField("prezzo_offerta");
                                }
                            }
                        }

                        //if (meccanica_tradotta.IndexOf("PERCENTO_MM_ALL") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_FID_ALL") >= 0)
                        //{
                        //    if (int.Parse(recItem["numero_reparto"].ToString()) == 9 && recItem["prezzo_offerta"].ToString() == "")
                        //    {
                        //        interprete.removeCompiledField("prezzo_offerta_gruppo");
                        //        interprete.removeCompiledField("campo_offerta");
                        //        Console.WriteLine("Rimuovo campo_offerta (7) per meccanica: " + meccanica_tradotta);

                        //    }
                        //}
                    }

                    if ((materiale == "INT" || materiale == "RIL") && (meccanica_tradotta.IndexOf("_ofalkg") >= 0))
                    {
                        if (prezzo_offerta_EURprima != null && prezzo_offerta_EURprima != "")
                        {
                            var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_KgL_EURprima", codiceBox, canale);
                            interprete.assignCompiledField("prezzo_offerta_EURprima", paragraphName, prezzo_offerta_KgL_EURprima);
                        }
                        else
                        {
                            interprete.removeCompiledField("prezzo_offerta_EURprima");
                        }
                    }

                    if ((temaContesto.Contains("LOC Mensile") || temaContesto.Contains("LOC 1a DATA") || temaContesto.Contains("LOC 2a DATA")) && meccanica_tradotta != "validita")
                    {
                        if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                        {
                            interprete.removeCompiledField("sy_etto");
                        }
                        else
                        {
                            interprete.removeCompiledField("sconto_fid");

                            if (meccanica_tradotta.IndexOf("TP_MM") >= 0 || meccanica_tradotta.IndexOf("PERCENTO_MM") >= 0 || meccanica_tradotta.IndexOf("sir_sconto") >= 0)
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale, 2);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);

                                paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "campo_offerta_etto", codiceBox, canale, 2);
                                interprete.assignCompiledField("campo_offerta", paragraphName, campo_offerta_etto);

                            }
                        }

                        if (meccanica_tradotta.IndexOf("NM_") >= 0)
                        {
                            if (meccanica_tradotta.IndexOf("_FID") < 0)
                            {
                                interprete.removeCompiledField("LBL_Carte");
                            }
                        }
                        else
                        {
                            if (meccanica_tradotta.IndexOf("TP_FID") < 0 && meccanica_tradotta.IndexOf("sir_sconto") < 0)
                            {
                                interprete.removeCompiledField("sconto_effettivo");
                            }
                        }

                        if (temaContesto.Contains("LOC Mensile"))
                        {
                            interprete.removeCompiledField("Triangolo_VAL");
                        }
                    }

                    if ((materiale.Contains("BASSI&FISSI") && meccanica_tradotta != "validita") || allEtichette.Contains("IS BASSI E FISSI"))
                    {

                        if (!materiale.Contains("ISTITUZIONALE"))
                        {
                            if (meccanica_tradotta.IndexOf("_boxetto") < 0)
                            {
                                interprete.removeCompiledField("rect_etto");
                                interprete.removeCompiledField("sy_etto");

                            }
                            else
                            {
                                var paragraphName = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "prezzo_offerta_etto", codiceBox, canale, 2);
                                interprete.assignCompiledField("prezzo_offerta", paragraphName, prezzo_offerta_etto);

                            }
                        }
                    }

                    if (meccanica_tradotta.IndexOf("_FID") < 0 && meccanica_tradotta.IndexOf("PUNTI") < 0)
                    {
                        interprete.removeCompiledField("LBL_Titolari");

                        if (canale == "SC" && codiceBox != "BOX41")
                        {
                            interprete.removeCompiledField("PIEDE_Titolari");
                        }
                    }

                    if (codiceBox == "BOX41" && (tipo_tema.ToLower() == "focus" || tipo_tema.ToLower() == "attivita di reparto"))
                    {

                        interprete.removeCompiledField("parentesi_BeF");
                        interprete.removeCompiledField("sy_ombra");
                        interprete.removeCompiledField("margherita_BeF");
                    }
                    if (codiceBox != "BOX41" && (tipo_tema.ToLower() == "focus" || tipo_tema.ToLower() == "attivita di reparto"))
                    {
                        interprete.removeCompiledField("fondo_distintivita_SDB");
                        interprete.removeCompiledField("fondo_distintivita_BDP");
                    }


                    if ((materiale == "INT" || materiale == "RIL") && meccanica_tradotta.IndexOf("TP_MM") >= 0 && codiceBox != "BOX41")
                    {
                        interprete.removeCompiledField("prezzo_offerta_gruppo");
                    }

                    var bdp_sdb_distintivita = (tipo_tema.IndexOf("_focus") < 0 && (meccanica_tradotta.IndexOf("_sdb") >= 0 || meccanica_tradotta.IndexOf("_bdp") >= 0));

                    if (codiceBox != "BOX41" && canale != "SC" && meccanica_tradotta.IndexOf("_minicoll") < 0 && meccanica_tradotta.IndexOf("_bonus") < 0 && !bdp_sdb_distintivita)
                    {
                        interprete.removeCompiledField("linee");
                    }


                    if (canale != "SC" && meccanica_tradotta.IndexOf("_bonus") < 0 && meccanica_tradotta.IndexOf("_minicoll") < 0 && !bdp_sdb_distintivita)
                    {
                        interprete.removeCompiledField("linee");
                    }

                    if (!combinazioneAssegnata.Contains("ofalkg"))
                    {
                        interprete.removeCompiledField("alKg");
                    }

                    #endregion parseMeccanica

                    #region descrizione




                    //ATTENZIONE
                    //posizionare la descirizione allineandola a prezzo offerta TOP o 
                    //SCONTO TOP se si tratta di meccanica percentuale o sir
                    var Descrizione1 = "";
                    var Descrizione2 = "";
                    var Descrizione3 = "";
                    var Descrizione4 = "";
                    var Peso = "";
                    var Um = "";
                    string stileParagDescr = "";
                    if (canale == "SC")
                    {
                        stileParagDescr = "DES_Descrizione_SC";
                    }
                    else
                    {
                        stileParagDescr = "DES_Descrizione";
                    }

                    //if (recItem.ContainsKey("descrizione_gruppo"))
                    //{
                    //    Descrizione1 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione1"].ToString();
                    //    Descrizione2 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione2"].ToString();
                    //    Descrizione3 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione3"].ToString();
                    //    Descrizione4 = (recItem["descrizione_gruppo"] as Dictionary<string, object>)["Descrizioni.Descrizione4"].ToString();//recItem["Descrizioni.Descrizione4"].ToString();
                    //    Peso = recItem["Descrizioni.Peso"].ToString();
                    //    Um = recItem["Descrizioni.Um"].ToString();
                    //}
                    //else
                    //{
                    Descrizione1 = recItem["Descrizioni.Descrizione1"].ToString();
                    Descrizione2 = recItem["Descrizioni.Descrizione2"].ToString();
                    Descrizione3 = recItem["Descrizioni.Descrizione3"].ToString();
                    Descrizione4 = recItem["Descrizioni.Descrizione4"].ToString();
                    Peso = recItem["Descrizioni.Peso"].ToString();
                    Um = recItem["Descrizioni.Um"].ToString();
                    //}




                    while (Descrizione1.Contains("<br>"))
                    {
                        Descrizione1 = Descrizione1.Replace("<br>", "\n");
                    }
                    while (Descrizione2.Contains("<br>"))
                    {
                        Descrizione2 = Descrizione2.Replace("<br>", "\n");
                    }
                    while (Descrizione3.Contains("<br>"))
                    {
                        Descrizione3 = Descrizione3.Replace("<br>", "\n");
                    }
                    while (Descrizione4.Contains("<br>"))
                    {
                        Descrizione4 = Descrizione4.Replace("<br>", "\n");
                    }


                    var no_str_etto = (combinazioneAssegnata.IndexOf("_boxetto") < 0 || (canale == "SC" && combinazioneAssegnata.IndexOf("PERCENTO_MM") >= 0 && combinazioneAssegnata.IndexOf("ALL") < 0));

                    try
                    {
                        var mecc_stili = combinazioneAssegnata;

                        if (recItem.ContainsKey("codice_articolo_pop"))
                        {
                            var nome_stile = "PROMO_A.PROMO_A_P_cod_POP";
                            var nome_stile_bold = "PROMO_A.PROMO_A_P_cod_POP_bold";

                            var aCapo = "";
                            if (Descrizione1 != "" || Descrizione2 != "" || Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                            {
                                aCapo += "\n";
                            }
                            descrizione += "<" + nome_stile_bold + ">" + recItem["flag_prenotazione"].ToString() + "</" + nome_stile_bold + ">" + "<" + nome_stile + ">" + recItem["codice_articolo_pop"].ToString() + aCapo + "</" + nome_stile + ">";
                        }


                        //DESCRIZIONE
                        if (Descrizione1 != "")
                        {
                            var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_nome", codiceBox, canale, 2);

                            var aCapo = "";
                            bool descr1HaGiaACapoFinale =
    Descrizione1.EndsWith("\n") ||
    Descrizione1.EndsWith("\r") ||
    Descrizione1.EndsWith("\r\n");

                            if (!descr1HaGiaACapoFinale)
                            {
                                if (Descrizione2 != "" || Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                                {
                                    aCapo = "\n";
                                }
                            }
                            descrizione += "<" + nome_stile + ">" + Descrizione1 + aCapo + "</" + nome_stile + ">";
                        }

                        if (Descrizione2 != "")
                        {
                            var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_marca", codiceBox, canale, 2);
                            var aCapo = "";
                            bool descr2HaGiaACapoFinale =
Descrizione2.EndsWith("\n") ||
Descrizione2.EndsWith("\r") ||
Descrizione2.EndsWith("\r\n");

                            if (!descr2HaGiaACapoFinale)
                            {
                                if (Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                                {
                                    aCapo += "\n";
                                }
                            }

                            descrizione += "<" + nome_stile + ">" + Descrizione2 + aCapo + "</" + nome_stile + ">";
                        }
                        //TIPO
                        if (Descrizione3 != "")
                        {
                            var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_tipo", codiceBox, canale, 2);
                            var aCapo = "";
                            bool descr3HaGiaACapoFinale =
Descrizione3.EndsWith("\n") ||
Descrizione3.EndsWith("\r") ||
Descrizione3.EndsWith("\r\n");

                            if (!descr3HaGiaACapoFinale)
                            {
                                if (Descrizione4 != "" || !no_str_etto)
                                {
                                    aCapo += "\n";
                                }
                            }
                            descrizione += "<" + nome_stile + ">" + Descrizione3 + aCapo + "</" + nome_stile + ">";

                        }


                        //GRAMMATURA
                        var first_gramm_char_inx = -1;
                        bool isOfalKg = combinazioneAssegnata.Contains("_ofalkg");
                        var alKg = "";
                        if (no_str_etto)
                        {

                            if (Descrizione4 != "")
                            {
                                if (isOfalKg && !Descrizione4.ToLower().Contains("al kg"))
                                {
                                    var nome_stile_kg = getStileKg(recItem, canale, 2); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_alkg", codiceBox, canale);

                                    alKg += "<" + nome_stile_kg + ">" + "\nal kg" + "</" + nome_stile_kg + ">";
                                }

                                var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_gr", codiceBox, canale, 2);
                                descrizione += "<" + nome_stile + ">" + Descrizione4 + "</" + nome_stile + ">";

                                descrizione += alKg;
                            }
                        }
                        else
                        {
                            string nome_campo = stringa_etto;
                            string nome_stile = stringaEtto(recItem, canale, 2); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, nome_campo, codiceBox, canale);
                            var s_etto = "<" + nome_stile + ">" + val_stringa_etto + "</" + nome_stile + ">";


                            descrizione += s_etto;
                            if (descrizione.IndexOf("€") > 0 && combinazioneAssegnata.IndexOf("_evento") < 0 && combinazioneAssegnata.IndexOf("_inostriori") < 0 && combinazioneAssegnata.IndexOf("_territorio") < 0)
                            {
                                //console.error("€ " + codiceBox);
                                if (canale != "SC")
                                    descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto" + suffix_plus + ">€</EURO piccolo_Descr2_boxetto" + suffix_plus + ">");
                                else
                                    descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto_SC>€</EURO piccolo_Descr2_boxetto_SC>");
                            }
                            else
                            {
                                descrizione.Replace("€", "<C" + nome_stile + ">€</C" + nome_stile + ">");
                            }

                        }


                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine(ex);
                    }
                    interprete.assignCompiledField("descrizione", descrizioneParagraphStyle, descrizione);


                    #endregion descrizione

                    if (Descrizione4.Trim().ToLower() == "al pezzo")
                    {
                        interprete.removeCompiledField("campo_offerta_KgL_sconto");

                    }

                    if (sezione.ToUpper() == "B&F RICHIAMO VOLANTINO")
                    {
                        interprete.removeCompiledField("immagine");
                        interprete.removeCompiledField("sfondo");
                    }

                    interprete.finalizeFields();
                    var fields = interprete.getFields();
                    recItem["compiledFields"] = fields.compiledFields;
                    recItem["deletedFields"] = fields.deletedFields;

                    #endregion


                    //if (recItem.ContainsKey(key_codiceBox))
                    //    recItem.Remove(key_codiceBox);

                    //List<ArticoloInKitExportName> _list_names = new List<ArticoloInKitExportName>();
                    //foreach (TipoDiExport tItem in tipiExportDB.source)
                    //{
                    //    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                    //    codifica.guidIdTipoExport = tItem.guidID;
                    //    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.recordInTracciato, this);
                    //    _list_names.Add(codifica);
                    //}
                    //artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = _list_names;

                    //Controllo sottogruppo
                    if (recItem.ContainsKey(keySottogruppo))
                    {
                        string _codSottoGruppo = recItem[keySottogruppo].ToString();
                        bool inCache = _cacheSottogruppi.Contains(_codSottoGruppo);
                        if (_codSottoGruppo != "" && _codSottoGruppo != recItem[GLOBAL_VARIABLES.keyRefCodice] && !inCache)
                        {
                            List<Dictionary<string, object>> elementiSottogruppo = tracciato.Where(t => t.recordInTracciato.ContainsKey(keySottogruppo) && t.recordInTracciato[keySottogruppo].ToString() == _codSottoGruppo).Select(s => s.recordInTracciato).ToList();

                            if (elementiSottogruppo.Count > 1)
                            {
                                var sottogruppo = RefCloner.CopiaETrasformaObjSingoloInObjSottogruppo(recItem);
                                if (recItem.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo))
                                {
                                    //throw new Exception($"Sottogruppo {_codSottoGruppo} con tag descrizione_gruppo non trovato nell'elemento. Questo non deve poter succedere.");
                                    //Rimuovo il tag dal singolo
                                    recItem.Remove(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo);
                                }

                                #region descrizione sottogruppo
                                descrizione = "";
                                try
                                {
                                    var mecc_stili = combinazioneAssegnata;
                                    Descrizione1 = sottogruppo["Descrizioni.Descrizione1"].ToString();
                                    Descrizione2 = sottogruppo["Descrizioni.Descrizione2"].ToString();
                                    Descrizione3 = sottogruppo["Descrizioni.Descrizione3"].ToString();
                                    Descrizione4 = sottogruppo["Descrizioni.Descrizione4"].ToString();
                                    Peso = sottogruppo["Descrizioni.Peso"].ToString();
                                    Um = sottogruppo["Descrizioni.Um"].ToString();

                                    //DESCRIZIONE
                                    if (Descrizione1 != "")
                                    {
                                        var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_nome", codiceBox, canale, 2);

                                        descrizione += "<" + nome_stile + ">" + Descrizione1 + "</" + nome_stile + ">";
                                        if (Descrizione2 != "" || Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                                        {
                                            descrizione += "\n";
                                        }
                                    }

                                    if (Descrizione2 != "")
                                    {
                                        var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_marca", codiceBox, canale, 2);

                                        descrizione += "<" + nome_stile + ">" + Descrizione2 + "</" + nome_stile + ">";
                                        if (Descrizione3 != "" || (Descrizione4 != "" || !no_str_etto))
                                        {
                                            descrizione += "\n";
                                        }
                                    }
                                    //TIPO
                                    if (Descrizione3 != "")
                                    {
                                        var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_tipo", codiceBox, canale, 2);

                                        descrizione += "<" + nome_stile + ">" + Descrizione3 + "</" + nome_stile + ">";

                                    }



                                    if (Descrizione3 != ""/* || desEsempio*/)
                                    {
                                        if (Descrizione4 != "" || !no_str_etto)
                                        {
                                            descrizione += "\n";
                                        }
                                    }





                                    //GRAMMATURA
                                    var first_gramm_char_inx = -1;
                                    bool isOfalKg = combinazioneAssegnata.Contains("_ofalkg");
                                    var alKg = "";
                                    if (no_str_etto)
                                    {

                                        if (Descrizione4 != "")
                                        {
                                            if (isOfalKg && !Descrizione4.ToLower().Contains("al kg"))
                                            {
                                                var nome_stile_kg = getStileKg(recItem, canale, 2); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_alkg", codiceBox, canale);

                                                alKg += "<" + nome_stile_kg + ">" + "\nal kg" + "</" + nome_stile_kg + ">";
                                            }

                                            var nome_stile = GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, "descr_gr", codiceBox, canale, 2);
                                            descrizione += "<" + nome_stile + ">" + Descrizione4 + "</" + nome_stile + ">";

                                            descrizione += alKg;
                                        }
                                    }
                                    else
                                    {
                                        string nome_campo = stringa_etto;
                                        string nome_stile = stringaEtto(recItem, canale, 2); //GetStileForField(mappaStili, combinazioneAssegnata + suffix_plus, nome_campo, codiceBox, canale);
                                        var s_etto = "<" + nome_stile + ">" + val_stringa_etto + "</" + nome_stile + ">";


                                        descrizione += s_etto;
                                        if (descrizione.IndexOf("€") > 0 && combinazioneAssegnata.IndexOf("_evento") < 0 && combinazioneAssegnata.IndexOf("_inostriori") < 0 && combinazioneAssegnata.IndexOf("_territorio") < 0)
                                        {
                                            //console.error("€ " + codiceBox);
                                            if (canale != "SC")
                                                descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto" + suffix_plus + ">€</EURO piccolo_Descr2_boxetto" + suffix_plus + ">");
                                            else
                                                descrizione.Replace("€", "<EURO piccolo_Descr2_boxetto_SC>€</EURO piccolo_Descr2_boxetto_SC>");
                                        }
                                        else
                                        {
                                            descrizione.Replace("€", "<C" + nome_stile + ">€</C" + nome_stile + ">");
                                        }

                                    }


                                }
                                catch (Exception ex)
                                {
                                    Debug.WriteLine(ex);
                                }

                                interpreteSottogruppo = interprete.Clone();
                                interpreteSottogruppo.assignCompiledField("descrizione", descrizioneParagraphStyle, descrizione);
                                interpreteSottogruppo.finalizeFields();
                                var fieldsSottogruppo = interpreteSottogruppo.getFields();
                                sottogruppo["compiledFields"] = fieldsSottogruppo.compiledFields;
                                #endregion

                                //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                                //Code
                                //Devo recuperare gli elementi singoli del gruppo dalla lista di origine
                                string selezionePSDelSottogruppo = eseguiAutoSelezioneGruppo(elementiSottogruppo, null);
                                List<Dictionary<string, object>> gruppoPSDelSottogruppo = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(selezionePSDelSottogruppo);

                                //Adesso potrei estrarre il nuovo primario del gruppo per poter assegnare al sottogruppo la foto primaria
                                //Non lo faccio eprchè Edro non vuole foto nel materiale PoP, per cui vanificherei uno sforzo


                                //Alterazione dati del sottogruppo secondo logiche Edro21, se necessario
                                //NAMING SINGOLO
                                artInKit.sottogruppo = sottogruppo;

                                List<ArticoloInKitExportName> _names_sott = new List<ArticoloInKitExportName>();
                                List<FicoDeclinazioneKitRuntime> lista_dec_sottogruppo = sottogruppo.ContainsKey(GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni) ? sottogruppo[GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni] as List<FicoDeclinazioneKitRuntime> : new List<FicoDeclinazioneKitRuntime>();

                                foreach (TipoDiExport tItem in tipiExportDelKit)
                                {
                                    IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                                    codifica.guidIdTipoExport = tItem.guidID;
                                    codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.sottogruppo, this, null);
                                    _names_sott.Add(codifica);

                                    foreach (var dec in lista_dec_sottogruppo)
                                    {
                                        //Codifico anche le declinazioni
                                        IstantaLib.ArticoloInKitExportName codificaDec = new IstantaLib.ArticoloInKitExportName();
                                        codificaDec.guidIdTipoExport = tItem.guidID;
                                        codificaDec.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.sottogruppo, this, dec.Proprieta);
                                        if (dec.Codifica == null)
                                            dec.Codifica = new List<ArticoloInKitExportName>();
                                        dec.Codifica.Add(codificaDec);
                                    }

                                }

                                artInKit.sottogruppo[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names_sott;


                                _cacheSottogruppi.Add(_codSottoGruppo);
                            }

                        }
                        else if (inCache)
                        {
                            //Da questo singolo va tolta la descrizione gruppo dato che è già stata processata
                            recItem.Remove(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo);
                        }
                    }


                    interprete.clearInterpreter();
                    interpreteSottogruppo.clearInterpreter();

                    //NAMING SINGOLO
                    List<ArticoloInKitExportName> _names = new List<ArticoloInKitExportName>();
                    //List<FicoDeclinazioneKitRuntime> lista_dec = artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni] as List<FicoDeclinazioneKitRuntime>;
                    List<FicoDeclinazioneKitRuntime> lista_dec = artInKit.recordInTracciato.ContainsKey(GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni) ? artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoDeclinazioni] as List<FicoDeclinazioneKitRuntime> : new List<FicoDeclinazioneKitRuntime>();
                    foreach (TipoDiExport tItem in tipiExportDelKit)
                    {
                        IstantaLib.ArticoloInKitExportName codifica = new IstantaLib.ArticoloInKitExportName();
                        codifica.guidIdTipoExport = tItem.guidID;
                        codifica.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.recordInTracciato, this, null);
                        _names.Add(codifica);

                        foreach (var dec in lista_dec)
                        {
                            //Codifico anche le declinazioni
                            IstantaLib.ArticoloInKitExportName codificaDec = new IstantaLib.ArticoloInKitExportName();
                            codificaDec.guidIdTipoExport = tItem.guidID;
                            codificaDec.nomeFile = NamingConventionUtility.Decode(tItem, promoContext, tracciatoContext, kit, acpvDB, ncDB, formatiDB, artInKit.recordInTracciato, this, dec.Proprieta);
                            if (dec.Codifica == null)
                                dec.Codifica = new List<ArticoloInKitExportName>();
                            dec.Codifica.Add(codificaDec);
                        }

                    }

                    artInKit.recordInTracciato[GLOBAL_VARIABLES_FICO.keyFicoNames] = _names;


                    result.liste[0].Records.Add(artInKit);



                }


                if (counter <= 0)
                {
                    result.errors += "Nessun articolo della lista corrisponde ai requisiti di esportazione. Controllare la lista e ripetere l'importazione";
                }


            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }

            //impResult.liste = result;
            //impResult.errors = errors;

            return result;
        }

        public string esportaPOPOld(Dictionary<string, string> formRequest, List<Dictionary<string, object>> tracciato, string pathMeccaniche, string pathOrdinamentoLista, string pathAree, string pathMastro, string pathCombinazioniPoP)
        {
            ExportResult result = new ExportResult();
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keySegmento = Edro21Context.Meta.segmento;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyTema = Edro21Context.Meta.tema;
            string keyScattoCodice = Edro21Context.Meta.ScattoCodice;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keySettore = Edro21Context.Meta.settore;
            string keyMeccanica = Edro21Context.Meta.meccanica;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyRefs = Edro21Context.Meta.refs;
            string keyNote_category = Edro21Context.Meta.note_category;
            string KeyAreaCodice = Edro21Context.Meta.AreaCodice;
            string keyDescrizioniPeso = Edro21Context.Meta.DescrizioniPeso;
            string keyReferenzaCodice = Edro21Context.Meta.ReferenzaCodice;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;
            string keyDescrizioniDescrizione1 = Edro21Context.Meta.DescrizioniDescrizione1;
            string keyDescrizioniDescrizione2 = Edro21Context.Meta.DescrizioniDescrizione2;
            string keyDescrizioniDescrizione3 = Edro21Context.Meta.DescrizioniDescrizione3;
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;
            string keyScattoCodiceGruppo = Edro21Context.Meta.ScattoCodiceGruppo;

            try
            {
                List<Tracciato> tracciato_da_esportare = new List<Tracciato>();

                //Recupero la richiesta avvenuta all'import di questo tracciato che ora è in esportazione.
                Dictionary<string, string> reqImport = JsonConvert.DeserializeObject<Dictionary<string, string>>(formRequest["importFieldsStringfy"]);
                Byte tipo_volantino = Byte.Parse(reqImport["cmbTipoTracciato"]);
                Dictionary<string, string> reqTracciato = JsonConvert.DeserializeObject<Dictionary<string, string>>(formRequest["tracciatoFieldsStringfy"]);

                string materialePoP = reqImport["cmbMaterialePoP"];
                string nome_esportazione = reqTracciato["NomeEsportazione"];

                foreach (Dictionary<string, object> gItem in tracciato)
                {
                    List<Dictionary<string, object>> myGroup = gItem[keyRefs] as List<Dictionary<string, object>>;

                    foreach (Dictionary<string, object> item in myGroup)
                    {
                        string tipo_lista_pop = getTipoListaPerTema(item);

                        string nome_esportazionne_tracciaato = nome_esportazione.Replace(materialePoP, tipo_lista_pop);
                        var tItem = tracciato_da_esportare.Where(t => t.NomeEsportazione == nome_esportazionne_tracciaato).FirstOrDefault();
                        if (tItem == null)
                        {
                            tItem = new Tracciato();
                            tItem.NomeEsportazione = nome_esportazione.Replace(materialePoP, tipo_lista_pop);
                            tracciato_da_esportare.Add(tItem);
                        }

                        //Mi basta prendere il primo del gruppo per capire dove vanno i restanti (Regola da confermare da Edro ovvviamente)
                        tItem.Records.Add(gItem);
                        break;
                    }

                }



                requestParams = formRequest;
                lista_tracciato = tracciato;



                DateTime data_da = DateTime.Parse(reqTracciato["DataDa"].ToString());
                DateTime data_a = DateTime.Parse(reqTracciato["DataA"].ToString());

                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                dbGrammature = ordDB.source;

                JObject o3 = JObject.Parse(File.ReadAllText(pathMeccaniche));
                DbMeccaniche mcDB = o3.ToObject<DbMeccaniche>();
                dbMeccaniche = mcDB.source;

                JObject o4 = JObject.Parse(File.ReadAllText(pathAree));
                DbAree aDB = o4.ToObject<DbAree>();
                dbAree = aDB.source;


                JObject o5 = JObject.Parse(File.ReadAllText(pathMastro));
                DbMastro mastroDB = o5.ToObject<DbMastro>();
                dbMastro = mastroDB.source;


                Int16 id_mastro = 0;
                string nome_mastro = "";


                if (formRequest.ContainsKey("cmbMastro"))
                {
                    id_mastro = Int16.Parse(formRequest["cmbMastro"].ToString());
                    nome_mastro = dbMastro.Where(m => m.Id == id_mastro).FirstOrDefault().Nome;
                }
                else
                {
                    var _m = dbMastro.FirstOrDefault();
                    id_mastro = _m.Id;
                    nome_mastro = _m.Nome;
                }


                bool esportazione_foto = (formRequest["esportaFoto"].ToString().ToLower() == "true");
                bool esportazione_da_archivio = formRequest["esportaDaArchivio"].ToString().ToLower() == "true";

                JObject o6 = JObject.Parse(File.ReadAllText(pathCombinazioniPoP));
                popDB = o6.ToObject<DbPopCombinazioni>();

                PopMateriale materiale = popDB.Materiali.Where(m => m.Codice == materialePoP).FirstOrDefault();
                AreaItem area = dbAree.Where(a => a.Area == reqTracciato[keyArea]).FirstOrDefault();

                //Prendo tutte le liste già spezzate in tipologia e ne ricavo ulteriori spezzettamenti a seconda delle combinazioni POP 
                List<PopCombinazione> combs = popDB.Combinazioni.Where(p => p.IdArea == area.Id && p.IdMateriale == materiale.Id && p.Attivo).ToList();


                foreach (var t in tracciato_da_esportare)
                {
                    foreach (var comb in combs)
                    {
                        string formato = popDB.Formati.Where(f => f.Id == comb.IdFormato).FirstOrDefault().Nome;
                        string codice_area = dbAree.Where(f => f.Id == comb.IdArea).FirstOrDefault().Area;
                        string mat = popDB.Materiali.Where(m => m.Id == comb.IdMateriale).FirstOrDefault().Codice;
                        string categoria = popDB.Categorie.Where(c => c.Id == comb.IdCategoria).FirstOrDefault().Nome;
                        bool dupFidelity = (bool)comb.Options["dupFidelity"];
                        string nomeFidelity = comb.Options["nomeFidelity"].ToString();



                        bool is_floc = (mat.ToLower() == "flocalismo");
                        bool is_reg = (mat.ToLower() == "regionale");
                        bool is_sap = (mat.ToLower() == "sap");
                        bool is_sott = (mat.ToLower() == "sott");

                        //bool no_fid = (tipo_materiale_pop.ToLower() == "ap" && (is_floc || is_reg || is_sap || is_sott));
                        bool no_fid = (materiale.Codice.ToLower() == "ap" && (is_floc || is_reg || is_sap || is_sott));


                        if (dupFidelity && mat.ToLower() != "ap" && !no_fid)
                        {

                            //Response.Write("Combinazione " + combinazioni[y].nome_fidelity + " ## " + String.Format("{0},{1},{2},{3}<br>", combinazioni[y].id_area, combinazioni[y].pop_categorie.nome, combinazioni[y].pop_formati.nome, combinazioni[y].tipi_materiale.nome));
                            //importa_come_fidelity
                            string[] nomi_fidelity = nomeFidelity.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);

                            foreach (string s in nomi_fidelity)
                            {
                                //Response.Write("Nome fidelity -> " + s + "<br>");

                                PopCombinazione combItem = new PopCombinazione();
                                combItem.IdArea = comb.IdArea;
                                combItem.IdCategoria = comb.IdCategoria;
                                combItem.IdFormato = comb.IdFormato;
                                combItem.IdMateriale = comb.IdMateriale;
                                combItem.Options["nomeFidelity"] = s;
                                combItem.Attivo = comb.Attivo;
                                combItem.Options["dupFidelity"] = true;

                                //Faccio uscire la versione fidelity
                                Tracciato rItem = new Tracciato();
                                rItem.Records = filtraListaPoP(t.Records, combItem);
                                rItem.NomeEsportazione = getNomeEsportazionePoP(combItem, t.NomeEsportazione, "", materialePoP, reqImport["MzApName"]);

                                //Response.Write("Trovati -> " + rItem.items.Count + "<br>");

                                if (rItem.Records.Count > 0 && result.liste.Where(l => l.NomeEsportazione == rItem.NomeEsportazione).Count() <= 0)
                                {
                                    //Response.Write("Lista da esportare: " +getNomeEsportazionePoP(combItem, tItem.nome_esportazione, "<br>") );
                                    result.liste.Add(rItem);
                                }

                            }

                        }

                        if (comb.Attivo)
                        {

                            PopCombinazione combItem = new PopCombinazione();
                            combItem.IdArea = comb.IdArea;
                            combItem.IdCategoria = comb.IdCategoria;
                            combItem.IdFormato = comb.IdFormato;
                            combItem.IdMateriale = comb.IdMateriale;
                            combItem.Options["nomeFidelity"] = comb.Options["nomeFidelity"];
                            combItem.Attivo = comb.Attivo;
                            combItem.Options["dupFidelity"] = false;
                            combItem.Options["foto"] = "no";

                            //Faccio uscire la lista classica
                            Tracciato rItem = new Tracciato();
                            //rItem.items = filtraListaPoP(parco_liste, combItem);
                            rItem.Records = filtraListaPoP(t.Records, combItem);
                            rItem.NomeEsportazione = getNomeEsportazionePoP(combItem, t.NomeEsportazione, "", materialePoP, reqImport["MzApName"]);

                            string codice_area_comb = dbAree.Where(a => a.Id == combItem.IdArea).FirstOrDefault().Area;
                            string formato_comb = popDB.Formati.Where(f => f.Id == combItem.IdFormato).FirstOrDefault().Nome;
                            string cat_comb = popDB.Categorie.Where(c => c.Id == combItem.IdCategoria).FirstOrDefault().Nome;

                            //Va inserito qui lo split per le liste _FOTO.
                            if ((codice_area_comb.IndexOf("IP") == 0 || codice_area_comb.IndexOf("SC") == 0) &&
                                formato_comb == "A3" &&
                                (cat_comb == "CA" || cat_comb == "PE" || cat_comb == "GA" || cat_comb == "FO")
                                )
                            {
                                //CA, PE, GA e FO

                                Tracciato rItem2 = new Tracciato();
                                rItem2.Records = rItem.Records.Where(r => !r[keyTipo_volantino].ToString().Contains("fuori volantino")).ToList();
                                combItem.Options["foto"] = "si";
                                rItem2.NomeEsportazione = getNomeEsportazionePoP(combItem, t.NomeEsportazione, "", materialePoP, reqImport["MzApName"]);

                                rItem.Records = rItem.Records.Where(r => r[keyTipo_volantino].ToString().Contains("fuori volantino")).ToList();

                                if (rItem.Records.Count > 0 && result.liste.Where(l => l.NomeEsportazione == rItem.NomeEsportazione).Count() <= 0)
                                {
                                    result.liste.Add(rItem);
                                }

                                if (rItem2.Records.Count > 0 && result.liste.Where(l => l.NomeEsportazione == rItem2.NomeEsportazione).Count() <= 0)
                                {
                                    result.liste.Add(rItem2);
                                }

                            }
                            else if (rItem.Records.Count > 0 && result.liste.Where(l => l.NomeEsportazione == rItem.NomeEsportazione).Count() <= 0)
                            {
                                result.liste.Add(rItem);
                            }

                        }

                    }
                }

                int counter = 0;
                for (int z = 0; z < result.liste.Count; z++)
                {
                    Tracciato tracciato_pop = result.liste[z];

                    for (int i = 0; i < tracciato_pop.Records.Count; i++)
                    {
                        Dictionary<string, object> recItemGroup = tracciato_pop.Records[i];


                        if (!recItemGroup.ContainsKey(keyRefs))
                            continue;

                        List<Dictionary<string, object>> myGroup = recItemGroup[keyRefs] as List<Dictionary<string, object>>;
                        List<Dictionary<string, object>> myGroupNew = new List<Dictionary<string, object>>();

                        foreach (Dictionary<string, object> recItem in myGroup)
                        {
                            string FuoriVolField = recItem[keyTipo_volantino].ToString().ToLower();

                            bool is_fuori_volantino = (FuoriVolField.IndexOf("fuori volantino") >= 0) ||
                                (FuoriVolField.IndexOf("opportunit") >= 0);

                            if (is_fuori_volantino)
                                continue;

                            if (!is_fuori_volantino && FuoriVolField.IndexOf("volantino") < 0)
                            {

                            }

                            string tipo_tema = recItem[keyTipo_tema].ToString().ToLower();
                            string tema = recItem[keyTema].ToString().ToLower();
                            string ruolo = recItem[keyRuolo].ToString().ToLower();
                            string nota_category = recItem[keyNote_category].ToString();

                            string sezione = recItem[keySezione].ToString();

                            Int64 reparto = (Int64)recItem[keyReparto];
                            Int64 settore = (Int64)recItem[keySettore];
                            string segmento = recItem[keySegmento].ToString();
                            string meccanica = recItem[keyMeccanica].ToString();

                            string codice_referenza = recItem[keyReferenzaCodice].ToString();
                            string codice_gruppo = recItem[keyScattoCodiceGruppo].ToString();
                            string codice_scatto = recItem[keyScattoCodice].ToString();
                            string codice_area = recItem[KeyAreaCodice].ToString();

                            decimal paghi = recItem["paghi"].ToDecimal();
                            decimal paghi_kgl = recItem["paghi_kgl"].ToDecimal();
                            decimal anziche = recItem["anziche"].ToDecimal();
                            decimal anziche_kgl = recItem["anziche_kgl"].ToDecimal();
                            decimal prezzo_um_com = recItem["prezzo_um_com"].ToDecimal();
                            decimal anziche_um_com = recItem["anziche_um_com"].ToDecimal();
                            string distintivita = recItem[keyDistintivita].ToString();

                            string um = recItem["Descrizioni.Um"].ToString();
                            string um_fatt = recItem[Meta.unita_fatt].ToString();
                            string um_com = recItem["um_com"].ToString();

                            decimal peso = recItem[keyDescrizioniPeso].ToDecimal();

                            string descr_1 = recItem[keyDescrizioniDescrizione1].ToString();
                            string descr_brand = recItem[keyDescrizioniDescrizione2].ToString();
                            string descr_tipo = recItem[keyDescrizioniDescrizione3].ToString();
                            string descr_gramm = recItem[keyDescrizioniDescrizione4].ToString();

                            decimal scontoAgenzia = recItem[keySconto_agenzia].ToDecimal();
                            decimal N_MM = recItem[keyN_MM].ToDecimal();
                            decimal N_FID = recItem[keyN_FID].ToDecimal();
                            decimal M_MM = recItem[keyM_MM].ToDecimal();
                            decimal M_FID = recItem[keyM_FID].ToDecimal();

                            string punti1 = recItem["punti1"].ToString();
                            string punti2 = recItem["punti2"].ToString();
                            string range1 = recItem["range1"].ToString();
                            string range2 = recItem["range_2"].ToString();
                            string tipo_punti = recItem[keyTipo_punti].ToString();
                            string note_cat = recItem[keyNote_category].ToString();

                            //decimal scontoMM = (decimal)recItem["scontoMM"]; 
                            //decimal scontoFID = (decimal)recItem["scontoFID"];

                            bool basso_fisso = ((tipo_tema.Contains("bass") && tipo_tema.Contains("fiss")) || (tipo_tema.Contains("bef") && !tipo_tema.Contains("befana"))) ||
                                ((tema.Contains("bass") && tema.Contains("fiss")) || (tema.Contains("bef") && !tema.Contains("befana"))) ||
                                (ruolo.Contains("b&f")) ||
                                (nota_category.Contains("bass") && nota_category.Contains("fiss"));

                            if (!basso_fisso && sezione != null)
                                basso_fisso = sezione.Contains("b&f") || (sezione.Contains("bass") && sezione.Contains("fiss"));

                            //if (tItem.tipo.Value == 2)
                            //Response.Write(nota_category + " - " + basso_fisso.ToString());


                            if (((!is_fuori_volantino || tipo_volantino == 2 || tipo_volantino == 3) &&
                                ((tipo_volantino == 2 && !basso_fisso) || tipo_volantino == 1 || tipo_volantino == 3)))
                            {


                                //Recupero le 4 descrizioni
                                //string[] descrizioni_articolo = get4Descrizioni(recItem, (tipo_volantino == (Byte)TipoImportazione.PoP), esportazione_da_archivio, false);
                                string[] descrizioni_articolo = new string[] { recItem[keyDescrizioniDescrizione1].ToString(), recItem[keyDescrizioniDescrizione2].ToString(), recItem[keyDescrizioniDescrizione3].ToString(), recItem[keyDescrizioniDescrizione4].ToString() };

                                #region Decifrazione meccanica e controllo "Al Kg al Lt"

                                Ordinamento gItem = dbGrammature.Where(s => s.CodiceSegmento == segmento).FirstOrDefault();

                                string str_offerta_unita = "";
                                string str_offerta_unita_sconto = "";
                                string str_offerta_unita_etto = "";
                                string str_offerta_unita_sconto_etto = "";
                                string str_offerta_unita_secondo = "";
                                string str_offerta_unitaTdopo = "";

                                bool flag_meccanica_unita = false;
                                bool flag_articolo_2x1_bis = false;
                                bool flag_articolo_2x1_bis_x_errore = false;

                                Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == meccanica).FirstOrDefault();

                                if (mItem == null)
                                {

                                    result.errors += "Ref. " + codice_referenza + " - Meccanica " + meccanica + " non trovata!";

                                    continue;
                                }

                                #region note crocettatura

                                //E' ancora da TESTARE
                                string note_crocettatura = "";
                                myGroup = myGroup.Where(r => filtroConfezione(recItem, r, myGroup)).ToList();

                                #region nuova implementazione
                                /*if (!req.confronta_liste)
                                {
                                    if (oItem.CodiceScatto != "")
                                    {*/
                                note_crocettatura = getNoteCrocettamento(recItem, myGroup);
                                /*}
                            }
                            else
                            {
                                note_crocettatura = oItem.NoteCrocettatura;
                            }*/

                                #endregion

                                if (is_fuori_volantino && tipo_volantino != 3 && tipo_volantino != 2)
                                    note_crocettatura = "";

                                if (is_fuori_volantino && tipo_volantino == 3)
                                    note_crocettatura = "F - Fuori Volantino";

                                //current_codScatto = oItem.codice_scatto;

                                #endregion

                                decimal paghi_kg_lt_indipendente = paghi_kgl;
                                //Response.Write(oItem.codice_referenza + " -> " + oItem.meccanica.ToLower()+"<br>");
                                if (meccanica.ToLower() == "nm fid" || meccanica.ToLower() == "nm mix fid")
                                {
                                    recItem[keyPaghi_secondo] = paghi;
                                    recItem[keyPaghi_kgl_secondo] = paghi_kgl;
                                    recItem[keyPaghi_due_pezzi] = anziche;
                                    recItem["paghi_kgl_lt_indipendente"] = anziche_kgl;
                                }

                                string paghi_etto = "";
                                if (gItem != null)
                                {
                                    string u_str = "Kg";
                                    if (um.ToLower() == "litro")
                                        u_str = "l";

                                    str_offerta_unita = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi_kg_lt_indipendente));
                                    str_offerta_unitaTdopo = String.Format("€ {0} al {1}", MathExt.DecimalRoundToString(paghi_kg_lt_indipendente), (u_str.ToLower() == "l" ? "lt" : u_str.ToLower()));
                                    str_offerta_unita_sconto = String.Format("al {0} da € {1} a € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(anziche_kgl), MathExt.DecimalRoundToString(paghi_kgl));
                                    if (recItem.ContainsKey(keyPaghi_kgl_secondo))
                                        str_offerta_unita_secondo = String.Format("al {0} € {1}", u_str.ToLower(), MathExt.DecimalRoundToString(recItem[keyPaghi_kgl_secondo].ToDecimal()));

                                    paghi_etto = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                                    string anziche_etto = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');

                                    str_offerta_unita_etto = String.Format("al {0} € {1}", u_str.ToLower(), paghi_etto);
                                    str_offerta_unita_sconto_etto = String.Format("al {0} € {1} anzichè € {2}", u_str.ToLower(), MathExt.DecimalRoundToString(paghi), MathExt.DecimalRoundToString(anziche));


                                    //Aggiunto il 10/03/2017 appositamente per l'uscita del TAG ERRORE che viene impostato sotto
                                    flag_articolo_2x1_bis_x_errore = ((mItem.NomeTraduzione == "NM_MM" ||
                                        mItem.NomeTraduzione == "NM_FID" ||
                                        mItem.NomeTraduzione == "NM_MIX_MM" ||
                                        mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione.ToLower() == "50sulsecondo"));

                                    if (gItem.Food)
                                    {

                                        if (peso != 1 && peso != 0.1M)
                                        {
                                            if (um_fatt.ToLower() != "peso")
                                            {
                                                //Response.Write("M -> " + meccanica_tradotta +"<br>");

                                                flag_meccanica_unita = true;

                                                flag_articolo_2x1_bis = ((mItem.NomeTraduzione == "NM_MM" ||
                                                mItem.NomeTraduzione == "NM_FID" ||
                                                mItem.NomeTraduzione == "NM_MIX_MM" ||
                                                mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione.ToString() == "50sulsecondo") &&
                                                (peso >= 0.051M && peso <= 0.099M));

                                                Meccanica mec = interpretaMeccanica(recItem, flag_meccanica_unita);
                                                string meccanica_temp = mec.NomeTraduzione;

                                                if (meccanica_temp.ToLower().Contains("50sulsecondo") && peso < 0.1M)
                                                {

                                                    string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                                    string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                                    str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                                    if (peso <= 0.049M)
                                                    {
                                                        paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                                        str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);
                                                        str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);
                                                    }

                                                }
                                                else if (peso > 0.1M ||
                                                    ((mItem.NomeTraduzione == "NM_MM" ||
                                                    mItem.NomeTraduzione == "NM_FID" ||
                                                    mItem.NomeTraduzione == "NM_MIX_MM" ||
                                                    mItem.NomeTraduzione == "NM_MIX_FID") &&
                                                    (peso >= 0.051M && peso <= 0.099M))
                                                    )
                                                {

                                                    //Questa parte l'ho riportata sopra perchè questi dati servono A PRESCINDERE!

                                                }
                                                else
                                                {
                                                    string paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kg_lt_indipendente / 10), 2, MidpointRounding.AwayFromZero));
                                                    string anziche_100g = MathExt.DecimalRoundToString(Decimal.Round((anziche_kgl / 10), 2, MidpointRounding.AwayFromZero));

                                                    str_offerta_unita = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g);

                                                    paghi_100g = MathExt.DecimalRoundToString(Decimal.Round((paghi_kgl / 10), 2, MidpointRounding.AwayFromZero));
                                                    str_offerta_unita_sconto = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" da € {0} a € {1}", anziche_100g, paghi_100g);

                                                    if (recItem.ContainsKey(keyPaghi_kgl_secondo) && (peso >= 0.01M && peso <= 0.49M))
                                                    {
                                                        string paghi_100g_sec = MathExt.DecimalRoundToString(Decimal.Round(((decimal)recItem[keyPaghi_kgl_secondo] / 10), 2, MidpointRounding.AwayFromZero));
                                                        str_offerta_unita_secondo = "per 100 " + (um.ToLower() == "litro" ? "ml" : "g") + String.Format(" € {0}", paghi_100g_sec);
                                                    }
                                                }

                                                //Response.Write("campo_offerta_KgL -> " + str_offerta_unita + "<br>");
                                                //Response.Write("campo_offerta_KgL_secondo -> " + str_offerta_unita_secondo + "<br>");
                                            }

                                        }

                                        if ((mItem.NomeTraduzione == "NM_MM" ||
                                            mItem.NomeTraduzione == "NM_FID" ||
                                            mItem.NomeTraduzione == "NM_MIX_MM" ||
                                            mItem.NomeTraduzione == "NM_MIX_FID") && (peso == 1 || peso == 0.1M))
                                        {
                                            flag_meccanica_unita = true;
                                        }
                                    }


                                }

                                string descr_gr_copy = descr_gramm;
                                //recItem[keyDescrizioniDescrizione4] = descrizioni_articolo[3];
                                Meccanica mec2 = interpretaMeccanica(recItem, flag_meccanica_unita);
                                string meccanica_tradotta = mec2.NomeTraduzione;


                                byte[] str_desc2_bytes = System.Text.Encoding.UTF8.GetBytes(descr_brand);
                                string _brand = System.Text.Encoding.UTF8.GetString(str_desc2_bytes);
                                byte[] str_desc3_bytes = System.Text.Encoding.UTF8.GetBytes(descr_tipo);
                                string _tipogusto = System.Text.Encoding.UTF8.GetString(str_desc3_bytes);
                                byte[] str_desc4_bytes = System.Text.Encoding.UTF8.GetBytes(descr_gr_copy);
                                string _gramm = System.Text.Encoding.UTF8.GetString(str_desc4_bytes);

                                #endregion

                                #region CSV record

                                byte[] str_desc1_bytes = System.Text.Encoding.UTF8.GetBytes(descr_1);

                                if (true)//!req.confronta_liste)
                                {
                                    //In assenza di confronto aggiungo questo record a CSV
                                }

                                #endregion

                                if (id_mastro > 0)
                                {
                                    bool foto = (bool)recItem["foto"];
                                    bool esempio = (bool)recItem["esempio"];

                                    if (foto || esempio || tipo_volantino == 2)// || req.confronta_liste)
                                    {
                                        #region xml record                                


                                        if (false)//liste_da_esportare[l].combinazione != null)
                                        {
                                        }

                                        if (counter == 0)
                                        {
                                            //if (isPoP(tItem.tipo.Value))
                                            //{
                                            //Date range
                                            System.Globalization.DateTimeFormatInfo mfi = new System.Globalization.DateTimeFormatInfo();
                                            string range_date = "";
                                            if (data_da.Year != data_a.Year)
                                            {
                                                range_date = String.Format("Dal {0} {1} {2} al {3} {4} {5}",
                                                    data_da.Day,
                                                    data_da.ToString("MMMM").UppercaseFirst(),
                                                    data_da.Year,
                                                    data_a.Day,
                                                    data_a.ToString("MMMM").UppercaseFirst(),
                                                    data_a.Year);
                                            }
                                            else if (data_da.Month != data_a.Month)
                                            {
                                                range_date = String.Format("Dal {0} {1} al {2} {3} {4}",
                                                    data_da.Day,
                                                    data_a.ToString("MMMM").UppercaseFirst(),
                                                    data_a.Day,
                                                    data_a.ToString("MMMM").UppercaseFirst(),
                                                    data_da.Year);
                                            }
                                            else
                                            {
                                                range_date = String.Format("Dal {0} al {1} {2} {3}",
                                                    data_da.Day,
                                                    data_a.Day,
                                                    data_da.ToString("MMMM").UppercaseFirst(),
                                                    data_da.Year);
                                            }

                                            //scriviRecordHeaderInXml("validita", range_date, nome_mastro, xml_writer);
                                            //}

                                            /*
                                            if (tipo_volantino == (Byte)TipoImportazione.PoP &&
                                                areaApplicabile("aree_titoloPOP_xml",!req.confronta_liste && tipo_materiale == "ap") ? reqImport["cmbCanaleArea"] : codice_area) &&
                                                (liste_da_esportare[l].combinazione.IdFormatoNavigation.Nome.ToLower() != "50x70") &&
                                                (liste_da_esportare[l].combinazione.IdFormatoNavigation.Nome.ToLower() != "70x100" || tipo_materiale.ToLower() != "fec"))
                                            {
                                                //tracciato["titolo"] = nome_file_xml.Replace(".xml", ""), nome_mastro, xml_writer);
                                            }*/

                                        }


                                        counter++;

                                        //Apertura record
                                        //Aggiustamento 0 nei prezzi base


                                        recItem["meccanica_tradotta"] = meccanica_tradotta;
                                        recItem["grafica_50al50"] = mec2.grafica_50_al_50 ? "true" : "false";
                                        recItem["mastro"] = nome_mastro;

                                        string sez_data = "";

                                        if (data_da.Month == data_a.Month)
                                        {
                                            sez_data = String.Format("Dal {0} al {1}", data_da.Day.ToString("d"), data_a.ToString("d MMMM yyyy"));
                                        }
                                        else
                                        {
                                            if (data_da.Year != data_a.Year)
                                            {
                                                sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM yyyy"), data_a.ToString("d MMMM yyyy"));
                                            }
                                            else
                                            {
                                                sez_data = String.Format("Dal {0} al {1}", data_da.ToString("d MMMM"), data_a.ToString("d MMMM yyyy"));
                                            }
                                        }

                                        recItem["sez_data"] = sez_data;


                                        //Ordinamento grItem = dbGrammature.Where(g => g.CodiceSegmento == segmento).FirstOrDefault();
                                        //if (grItem != null)
                                        //{
                                        //    //xml_writer.WriteElementString("gruppo_settori", grItem.IdGruppoNavigation.Nome);
                                        //    recItem["numero_reparto"] = grItem.NumeroReparto.ToString();
                                        //}

                                        KeyValuePair<string, object> dicitura_reparto = getDicituraSuReparto(recItem, meccanica_tradotta, materialePoP.ToLower(), codice_area);
                                        recItem[dicitura_reparto.Key] = dicitura_reparto.Value;

                                        if (meccanica_tradotta.IndexOf("_sdb") > 0 &&
                                            ((sezione.ToLower().IndexOf("tipico") >= 0 && sezione.IndexOf("benessere") >= 0) ||
                                            (distintivita.ToLower().IndexOf("benessere") >= 0 && sezione.ToLower().IndexOf("benessere") >= 0) ||
                                            (distintivita.ToLower().IndexOf("tipico") >= 0 && sezione.ToLower().IndexOf("tipico") >= 0)))
                                        {
                                            recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                                        }
                                        else if (meccanica_tradotta.IndexOf("_bdp") > 0 &&
                                            sezione.ToLower().Contains("buono del paese"))
                                        {
                                            recItem[keyTipo_tema] = recItem[keyTipo_tema].ToString() + "_focus";
                                        }


                                        //if (oItem.nota_category != null)
                                        //if (basso_fisso)
                                        //    recItem["logo_bassi_fissi"] = "logo_BassieFissi.psd";
                                        //else
                                        //    recItem["logo_bassi_fissi"] = "";



                                        if (
                                            tipo_volantino == 1
                                            ||
                                            tipo_volantino == 2
                                            ||
                                            (tipo_volantino == 3 &&
                                            materialePoP.ToLower() == "bb")
                                            ||
                                            (esportazione_foto /*||
                                        (liste_da_esportare[l].combinazione != null &&
                                        liste_da_esportare[l].combinazione.IdFormatoNavigation.Nome.ToLower() == "70x100" &&
                                        tipo_materiale.ToLower() == "fec")*/
                                            )
                                            )
                                        {
                                            recItem["loghi"] = getLoghiEBolli(recItem, descrizioni_articolo, gItem);
                                        }
                                        else
                                        {
                                            recItem["loghi"] = getLoghiEBolli(null, descrizioni_articolo, gItem);
                                        }



                                        recItem["prezzo_offerta_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi);
                                        recItem["prezzo_offerta_KgL_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi_kgl);


                                        //string str_anziche = String.Format("anzichè € {0}", MathExt.Round(oItem.anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));
                                        string str_anziche = String.Format("€ {0}", MathExt.Round(anziche, 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ','));

                                        recItem["campo_offerta_KgL"] = str_offerta_unita;
                                        recItem["campo_offerta_KgLt_dopo"] = str_offerta_unitaTdopo;
                                        recItem["campo_offerta"] = str_anziche;
                                        recItem["campo_offerta_KgL_sconto"] = str_offerta_unita_sconto;

                                        if (scontoAgenzia >= 0)
                                        {
                                            recItem["sconto_effettivo"] = "sconto " + MathExt.DecimalRoundToString(scontoAgenzia) + "%";

                                            if (scontoAgenzia == 0)
                                                recItem["sconto_effettivo_grande"] = "-00,00%";
                                            else
                                            {
                                                recItem["sconto_effettivo_grande"] = "-" + MathExt.DecimalRoundToString(scontoAgenzia) + "%";
                                            }
                                        }

                                        recItem["campo_offerta_conf"] = "a conf. € " + MathExt.DecimalRoundToString(paghi);
                                        recItem["campo_offerta_ofalkg"] = "€ " + MathExt.DecimalRoundToString(anziche_kgl);
                                        recItem["campo_offerta_conf_sconto"] = "a conf. da € " + MathExt.DecimalRoundToString(anziche) + " a € " + MathExt.DecimalRoundToString(paghi);

                                        decimal pz_etto_dec = MathExt.Round((paghi / 10), 2, MidpointRounding.AwayFromZero);
                                        string prezzo_offerta_etto = pz_etto_dec.ToString("0.00").Replace('.', ',');

                                        decimal etto_dec = MathExt.Round((anziche / 10), 2, MidpointRounding.AwayFromZero);
                                        string campo_offerta_etto = "€ " + etto_dec.ToString("0.00").Replace('.', ',');
                                        recItem["prezzo_offerta_etto"] = prezzo_offerta_etto;
                                        recItem["prezzo_offerta_etto_EURprima"] = "€ " + prezzo_offerta_etto;
                                        recItem["campo_offerta_etto"] = campo_offerta_etto;



                                        recItem["stringa_etto"] = str_offerta_unita_sconto_etto;

                                        string differenza_etto_note = "";

                                        ///*Non campionato


                                        string prezzo_offerta_etto_LISTA = MathExt.DecimalRoundToString(prezzo_um_com);// MathExt.Round((RecInXml.prezzo_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                                        string campo_offerta_etto_LISTA = "€ " + MathExt.DecimalRoundToString(anziche_um_com);//MathExt.Round((RecInXml.anziche_unita_misura_com.Value / 10), 2, MidpointRounding.AwayFromZero).ToString("0.00").Replace('.', ',');
                                        string str_etto_LISTA = String.Format("al {0} € {1} anzichè € {2}", um_com, prezzo_um_com.ToString(), anziche_um_com.ToString()); //MathExt.DecimalRoundToString(RecInXml.prezzo_unita_misura_com.Value), MathExt.DecimalRoundToString(RecInXml.anziche_unita_misura_com.Value));

                                        recItem["prezzo_offerta_etto_LISTA"] = prezzo_offerta_etto_LISTA;
                                        recItem["prezzo_offerta_etto_EURprima_LISTA"] = "€ " + prezzo_offerta_etto_LISTA;
                                        recItem["campo_offerta_etto_LISTA"] = campo_offerta_etto_LISTA;
                                        recItem["stringa_etto_LISTA"] = str_offerta_unita_sconto_etto;

                                        if ((pz_etto_dec != prezzo_um_com || etto_dec != anziche_um_com) &&
                                            meccanica_tradotta.Contains("_boxetto"))
                                        {
                                            differenza_etto_note = "prezzo Etto diverso su lista";
                                        }



                                        decimal paghi_due_pezzi = recItem.ContainsKey(keyPaghi_due_pezzi) ? (decimal)recItem[keyPaghi_due_pezzi] : 0;
                                        decimal paghi_secondo = recItem.ContainsKey(keyPaghi_secondo) ? (decimal)recItem[keyPaghi_secondo] : 0;

                                        recItem["prezzo_NOofferta_1pezzo"] = MathExt.DecimalRoundToString(paghi);
                                        recItem["prezzo_NOofferta_1pezzo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi);
                                        recItem["prezzo_NOofferta_2pezzi"] = MathExt.DecimalRoundToString(paghi_due_pezzi);
                                        recItem["prezzo_offerta_secondo"] = MathExt.DecimalRoundToString(paghi_secondo);
                                        recItem["prezzo_offerta_secondo_EURprima"] = "€ " + MathExt.DecimalRoundToString(paghi_secondo);
                                        recItem["campo_offerta_KgL_secondo"] = str_offerta_unita_secondo;


                                        string _tipo_range = getTipoRange(recItem, "1");
                                        recItem["PezzConf"] = "1 " + _tipo_range;

                                        recItem["campo_x1"] = "1 " + _tipo_range + " € " + MathExt.DecimalRoundToString(paghi);


                                        if (meccanica_tradotta.IndexOf("NM_") >= 0)//Meccanica BIS
                                        {
                                            if (meccanica_tradotta.IndexOf("_FID") < 0)
                                                recItem["PezzConf_NM"] = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM));
                                            else
                                                recItem["PezzConf_NM"] = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID));
                                        }
                                        else
                                            recItem["PezzConf_NM"] = "";


                                        string un_pezzo_euro = " € " + MathExt.DecimalRoundToString(paghi);

                                        recItem["N_MM_str"] = MathExt.DecimalOrIntToString(N_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                                        recItem["M_MM_str"] = MathExt.DecimalOrIntToString(M_MM) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_MM)) + un_pezzo_euro; // xml_writer.WriteElementString(keyN_MM, Helpers.MathExt.DecimalOrIntToString(oItem.n_massmarket.Value) + " " + ((oItem.n_massmarket.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                                        recItem["N_FID_str"] = MathExt.DecimalOrIntToString(N_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(N_FID)) + un_pezzo_euro;//xml_writer.WriteElementString(keyN_FID, Helpers.MathExt.DecimalOrIntToString(oItem.n_fidelity.Value) + " " + ((oItem.n_fidelity.Value == 1) ? "pezzo" : "pezzi") + un_pezzo_euro);
                                        recItem["M_FID_str"] = MathExt.DecimalOrIntToString(M_FID) + " " + getTipoRange(recItem, MathExt.DecimalOrIntToString(M_FID)) + un_pezzo_euro;


                                        if (flag_articolo_2x1_bis_x_errore)
                                        {

                                            if ((N_MM != 2 || N_MM != 1) &&
                                                (mItem.NomeTraduzione == "NM_MM" || mItem.NomeTraduzione == "NM_MIX_MM")
                                                )
                                            {
                                                note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                                            }
                                            else if ((N_FID != 2 || M_FID != 1) &&
                                                (mItem.NomeTraduzione == "NM_FID" || mItem.NomeTraduzione == "NM_MIX_FID" || mItem.NomeTraduzione == "50SulSecondo")
                                                )
                                            {
                                                note_crocettatura += "<br>ERRORE: in lista valori non validi per meccanica BIS 2x1";
                                            }
                                        }


                                        if (meccanica_tradotta.IndexOf("PUNTI_PERCENTO") >= 0 || meccanica_tradotta.IndexOf("PUNTI_TP") >= 0)
                                        {
                                            if (punti1 == "")
                                            {
                                                note_crocettatura += "<br>ERRORE: CONTROLLARE VALORI RANGE/PUNTI";
                                            }
                                        }

                                        if (differenza_etto_note != "")
                                        {
                                            note_crocettatura += ("<br>" + differenza_etto_note);
                                        }

                                        if (range1 != "")
                                            recItem["range1"] = range1 + " " + getTipoRange(recItem, range1);



                                        recItem["tipo_punti1"] = getTipoPunti(tipo_punti, punti1);


                                        recItem["range_2"] = range2 + " " + getTipoRange(recItem, range2);
                                        recItem["tipo_punti2"] = getTipoPunti(tipo_punti, punti2);



                                        if (note_cat.Replace(" ", "") == "")
                                            recItem[keyNote_category] = "";
                                        else
                                            recItem[keyNote_category] = recItem[keyNote_category].ToString().Replace("\r\n", "<br>");


                                        recItem["note"] = note_crocettatura;


                                        //Ripristino la grammatura originale come da excel!
                                        recItem[keyDescrizioniDescrizione4] = descr_gr_copy;


                                        string logo_ruolo = "";
                                        if (ruolo.Contains("star"))
                                            logo_ruolo = "boll_STAR";
                                        else if (ruolo.ToLower().Contains("vedette"))
                                            logo_ruolo = "boll_VEDETTE";
                                        else if (ruolo.ToLower().Contains("prima pagina"))
                                            logo_ruolo = "boll_PPAG";
                                        else if (ruolo.ToLower().Contains("artwork") || ruolo.ToLower().Contains("cmkt"))
                                            logo_ruolo = "boll_ARTWORK";

                                        recItem["boll_ruolo"] = logo_ruolo;

                                        string logo_dist = "";
                                        if (distintivita.ToLower().Contains("tipico"))
                                        {
                                            logo_dist = "boll_TIPICO";
                                        }
                                        else if (distintivita.ToLower().Contains("benessere"))
                                        {
                                            logo_dist = "boll_BENESSERE";
                                        }

                                        recItem["boll_distintivita"] = logo_dist;


                                        if (note_crocettatura.ToUpper().Contains("EVIDENZIATO ESEMPIO MA NON NECESSARIO"))
                                        {
                                            recItem["NO_Esempio"] = "true";
                                        }
                                        else
                                        {
                                            recItem["NO_Esempio"] = "false";
                                        }

                                        try
                                        {
                                            recItem["corretto_edro21"] =
                                               ((descrizioni_articolo[0].Replace(Environment.NewLine, "").Replace(" ", "") != recItem[GLOBAL_VARIABLES.keyDescr1Tracciato].ToString().Replace(Environment.NewLine, "").Replace(" ", "")) ||
                                               (descrizioni_articolo[1].Replace(Environment.NewLine, "").Replace(" ", "") != recItem[GLOBAL_VARIABLES.keyDescr2Tracciato].ToString().Replace(Environment.NewLine, "").Replace(" ", "")) ||
                                               (descrizioni_articolo[2].Replace(Environment.NewLine, "").Replace(" ", "") != recItem[GLOBAL_VARIABLES.keyDescr3Tracciato].ToString().Replace(Environment.NewLine, "").Replace(" ", "")) ||
                                               (descrizioni_articolo[3].Replace(Environment.NewLine, "").Replace(" ", "") != recItem[GLOBAL_VARIABLES.keyDescr4Tracciato].ToString().Replace(Environment.NewLine, "").Replace(" ", ""))).ToString().ToLower();
                                        }
                                        catch
                                        {

                                        }


                                        if (codice_area.ToLower().IndexOf("mg") == 0 &&
                                            codice_area.ToLower().IndexOf("la") < 0)
                                        {
                                            if (meccanica == "TP FID" ||
                                                meccanica == "% FID" ||
                                                meccanica == "VAL FID" ||
                                                meccanica == "% FID ALL" ||
                                                meccanica == "VAL FID ALL" ||
                                                meccanica == "NM FID" ||
                                                meccanica == "NM Mix FID" ||
                                                meccanica_tradotta.Contains("50al50Fid") ||
                                                meccanica == "PUNTI" ||
                                                meccanica == "PUNTI + %" ||
                                                meccanica == "PUNTI MULTI")
                                            {
                                                recItem["mg_nofidelity"] = "true";
                                            }
                                            else
                                            {
                                                recItem["mg_nofidelity"] = "false";
                                            }

                                        }
                                        else
                                        {
                                            recItem["mg_nofidelity"] = "false";
                                        }

                                        try
                                        {
                                            if (meccanica == "TP FID" && meccanica_tradotta.IndexOf("PUNTI_TP") >= 0)
                                            {
                                                recItem["noPunti_daConad"] = "true";
                                            }
                                            else
                                            {
                                                recItem["noPunti_daConad"] = "false";
                                            }
                                        }
                                        catch
                                        {
                                            recItem["noPunti_daConad"] = "false";
                                        }

                                        if (differenza_etto_note != "" && meccanica_tradotta.Contains("_boxetto"))
                                        {
                                            recItem["Etto_lista_diverso"] = "true";
                                        }
                                        else
                                        {
                                            recItem["Etto_lista_diverso"] = "false";
                                        }

                                        //Il BOLLO TASTO aggiunto da Laura il 20/02/2019, è un bollo tratttato diversamente dagli altri che invece si basano
                                        //esclusivamente s attributi della referenza. Questo è dedicato solo al POP ed uscirà solo per lui. dovesse aggiungersene un altro è ipotizzabile
                                        //la creazione di una funzione bolliLoghiPoP dedicata
                                        if (tipo_volantino == (Byte)TipoImportazione.PoP)
                                        {
                                            /*
                                            PopCombinazioni popComb = liste_da_esportare[l].combinazione;
                                            if (oItem.Reparto == 33 && oItem.UnitaFatt.ToLower() == "peso" &&
                                                (popComb.IdCategoriaNavigation.Nome == "OF" || req.cmbMaterialePoP.ToLower() == "pos") &&
                                                (popComb.IdFormatoNavigation.Nome == "A4" || popComb.IdFormatoNavigation.Nome == "A3"))
                                            {
                                                xml_writer.WriteElementString("bollo_tasto", "Tasto.psd");
                                            }
                                            else
                                            {
                                                xml_writer.WriteElementString("bollo_tasto", "");
                                            }
                                            */
                                        }

                                        #endregion

                                    }
                                    else
                                    {
                                        recItem["NoXml"] = true;
                                    }
                                }
                                else if (tipo_volantino == 1)
                                {

                                    //Ordinamento grItem = dbGrammature.Where(g => g.CodiceSegmento == segmento).FirstOrDefault();//g.numero_settore == oItem.settore).FirstOrDefault();
                                    //if (grItem != null)
                                    //{
                                    //    //xml_writer.WriteElementString("gruppo_settori", grItem.IdGruppoNavigation.Nome);
                                    //    recItem["numero_reparto"] = grItem.NumeroReparto.ToString();
                                    //}


                                    if (note_cat.Replace(" ", "") == "")
                                        recItem[keyNote_category] = "";
                                    else
                                        recItem[keyNote_category] = recItem[keyNote_category].ToString().Replace("\r\n", "<br>");

                                }
                                else
                                {
                                    throw new Exception("Mastro non specificata");
                                }

                                myGroupNew.Add(recItem);

                            }
                            else
                            {
                                recItem["NoXml"] = true;
                                recItem["NoCsv"] = true;
                            }

                        }

                    }

                }
            }
            catch (Exception ex)
            {
                result.errors = ex.ToString();
            }

            //impResult.liste = result;
            //impResult.errors = errors;

            return JsonConvert.SerializeObject(result);
        }

        protected string[] get4Descrizioni(Dictionary<string, object> tItem, bool is_pop, bool esporta_da_archivio, bool confronto_liste)//, PopCombinazioni popComb = null)
        {
            string keyReparto = Edro21Context.Meta.reparto;
            string keyDescrizioniPeso = Edro21Context.Meta.DescrizioniPeso;
            string keyDescrizioniDescrizione1 = Edro21Context.Meta.DescrizioniDescrizione1;
            string keyDescrizioniDescrizione2 = Edro21Context.Meta.DescrizioniDescrizione2;
            string keyDescrizioniDescrizione3 = Edro21Context.Meta.DescrizioniDescrizione3;
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;

            string descr1 = tItem[keyDescrizioniDescrizione1].ToString();
            string descr2 = tItem[keyDescrizioniDescrizione2].ToString();
            string descr3 = tItem[keyDescrizioniDescrizione3].ToString();
            string descr4 = tItem[keyDescrizioniDescrizione4].ToString();
            string pt = tItem[keyDescrizioniPeso].ToString();
            string um = tItem["Descrizioni.Um"].ToString();
            Int64 reparto = Int64.Parse(tItem[keyReparto].ToString());
            string unitaFatt = tItem[Meta.unita_fatt].ToString();

            string[] result = new string[] { descr1, descr3, descr2, descr4, pt, um };

            try
            {

                if (
                    //(is_pop && esporta_da_archivio) ||
                    //(confronto_liste && esporta_da_archivio))
                    esporta_da_archivio
                    )
                {
                    //if (tItem.ContainsKey("Referenza"))
                    //{
                    //Dictionary<string, object> art = tItem["Referenza"] as Dictionary<string, object>;
                    //if (art != null)
                    //{
                    result = new string[] { tItem[Meta.DescrizioniDescrizione1].ToString(), tItem[Meta.DescrizioniDescrizione2].ToString(), tItem[Meta.DescrizioniDescrizione3].ToString(), tItem[Meta.DescrizioniDescrizione4].ToString(), tItem[GLOBAL_VARIABLES.keyDescrPeso].ToString(), tItem[GLOBAL_VARIABLES.keyDescrUm].ToString() };
                    //}
                    //}
                }

            }
            catch
            {

            }

            return result;
        }

        protected bool filtroConfezione(Dictionary<string, object> item1, Dictionary<string, object> item2, List<Dictionary<string, object>> group)
        {
            string keyCodice_vv = Edro21Context.Meta.codice_vv;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;

            if (item1.Equals(item2))
            {
                return true;
            }

            string codVV1 = item1[keyCodice_vv].ToString();
            string codRef1 = item1[GLOBAL_VARIABLES.keyRefCodice].ToString();

            string codVV2 = item2[keyCodice_vv].ToString();
            string codRef2 = item2[GLOBAL_VARIABLES.keyRefCodice].ToString();

            if (codVV1 == "1")
            {
                if (codVV2 == "1")
                {
                    return true;
                }
                else if (codRef1.IndexOf(codRef2) < 0)
                {
                    //Confezione 2 (DI UN ALTRO CODICE) che però non ha il relativo vv1 (pezzo singolo) deve cmq uscire nel gruppo
                    if (group.Where(rg => rg[keyCodice_vv].ToString() == "1" && codRef2.IndexOf(rg[GLOBAL_VARIABLES.keyRefCodice].ToString()) >= 0).Count() <= 0)
                    {
                        return true;
                    }
                }


            }
            else
            {
                if (codVV2 != "1")
                {
                    return true;
                }
                else if (codRef1.IndexOf(codRef2) < 0)
                {
                    //Prodott singolo (vv1)  (DI UN ALTRO CODICE) che però non ha la confeziopne (vv2/3) deve cmq uscire nel gruppo
                    if (group.Where(rg => (rg[keyCodice_vv].ToString() == "2" || rg[keyCodice_vv].ToString() == "3") && rg[GLOBAL_VARIABLES.keyRefCodice].ToString().IndexOf(codRef2) >= 0).Count() <= 0)
                    {
                        return true;
                    }
                }

            }

            return false;

        }

        public static List<List<Dictionary<string, object>>> ReduceGroupByPriorityLayers(
    List<Dictionary<string, object>> myGroup)
        {
            var result = new List<List<Dictionary<string, object>>>();

            if (myGroup == null || myGroup.Count == 0)
                return result;

            // Per ogni gruppo logico salvo tutti gli elementi appartenenti a quel gruppo.
            // Mantengo anche l'indice originale per poter preservare l'ordine.
            var itemsByGroup = new Dictionary<string, List<(Dictionary<string, object> Item, int Index, int Priority)>>();

            // Mantiene l'ordine originale dei gruppi logici incontrati
            var groupOrder = new List<string>();

            for (int i = 0; i < myGroup.Count; i++)
            {
                var item = myGroup[i];

                if (item == null ||
                    !item.TryGetValue(GLOBAL_VARIABLES.keyRefCodice, out var codeObj) ||
                    codeObj == null)
                {
                    continue;
                }

                string code = codeObj.ToString();
                string groupKey = GetGroupKey(code);
                int priority = GetPriority(item, code);

                if (!itemsByGroup.TryGetValue(groupKey, out var list))
                {
                    list = new List<(Dictionary<string, object> Item, int Index, int Priority)>();
                    itemsByGroup[groupKey] = list;
                    groupOrder.Add(groupKey);
                }

                list.Add((item, i, priority));
            }

            // Ordino gli elementi di ogni gruppo per priorità.
            // In caso di pari priorità, mantengo l'ordine originale.
            foreach (var groupKey in groupOrder)
            {
                itemsByGroup[groupKey] = itemsByGroup[groupKey]
                    .OrderBy(x => x.Priority)
                    .ThenBy(x => x.Index)
                    .ToList();
            }

            int maxLayerCount = itemsByGroup.Values.Max(list => list.Count);

            for (int layerIndex = 0; layerIndex < maxLayerCount; layerIndex++)
            {
                var layer = new List<(Dictionary<string, object> Item, int OriginalIndex)>();

                foreach (var groupKey in groupOrder)
                {
                    var groupItems = itemsByGroup[groupKey];

                    if (layerIndex < groupItems.Count)
                    {
                        var selected = groupItems[layerIndex];
                        layer.Add((selected.Item, selected.Index));
                    }
                }

                // Mantengo l'ordine originale degli elementi selezionati nel layer
                var orderedLayer = layer
                    .OrderBy(x => x.OriginalIndex)
                    .Select(x => x.Item)
                    .ToList();

                if (orderedLayer.Count > 0)
                    result.Add(orderedLayer);
            }

            return result;
        }

        public static List<Dictionary<string, object>> ReduceGroup(List<Dictionary<string, object>> myGroup)
        {
            if (myGroup == null)
                return new List<Dictionary<string, object>>();

            // Per ogni "gruppo logico" tengo l'indice del miglior elemento trovato
            var bestIndexByGroup = new Dictionary<string, int>();

            for (int i = 0; i < myGroup.Count; i++)
            {
                var item = myGroup[i];
                if (item == null || !item.TryGetValue(GLOBAL_VARIABLES.keyRefCodice, out var codeObj) || codeObj == null)
                    continue;

                string code = codeObj.ToString();
                string groupKey = GetGroupKey(code);
                int currentPriority = GetPriority(item, code);

                if (!bestIndexByGroup.TryGetValue(groupKey, out int existingIndex))
                {
                    bestIndexByGroup[groupKey] = i;
                    continue;
                }

                var existingItem = myGroup[existingIndex];
                string existingCode = existingItem[GLOBAL_VARIABLES.keyRefCodice]?.ToString();
                int existingPriority = GetPriority(existingItem, existingCode);

                // Sostituisco solo se il nuovo è migliore (vv1 < vv2 < vv3)
                if (currentPriority < existingPriority)
                {
                    bestIndexByGroup[groupKey] = i;
                }
            }

            // Ricostruisco la lista mantenendo l'ordine originale
            var selectedIndexes = new HashSet<int>(bestIndexByGroup.Values);
            var result = new List<Dictionary<string, object>>();

            for (int i = 0; i < myGroup.Count; i++)
            {
                if (selectedIndexes.Contains(i))
                {
                    result.Add(myGroup[i]);
                }
            }

            return result;
        }

        private static string GetGroupKey(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
                return code;

            code = code.Trim();

            if (EndsWithVv(code))
                return code.Substring(0, code.Length - 3);

            // I codici normali restano indipendenti
            return code;
        }

        private static int GetPriority(Dictionary<string, object> item, string code)
        {
            if (string.IsNullOrWhiteSpace(code))
                return int.MaxValue;

            code = code.Trim();

            // Se NON è un codice vv, non va deduplicato con altri: priorità assoluta del proprio gruppo
            if (!EndsWithVv(code))
                return 0;

            if (item != null &&
                item.TryGetValue(Edro21Context.Meta.codice_vv, out var vvObj) &&
                vvObj != null &&
                int.TryParse(vvObj.ToString(), out int vv))
            {
                if (vv >= 1 && vv <= 3)
                    return vv;
            }

            // Fallback: se il metadata manca ma il codice finisce con vv1/vv2/vv3
            if (code.EndsWith("vv1", StringComparison.OrdinalIgnoreCase)) return 1;
            if (code.EndsWith("vv2", StringComparison.OrdinalIgnoreCase)) return 2;
            if (code.EndsWith("vv3", StringComparison.OrdinalIgnoreCase)) return 3;

            return int.MaxValue;
        }

        private static bool EndsWithVv(string code)
        {
            return code.EndsWith("vv1", StringComparison.OrdinalIgnoreCase)
                || code.EndsWith("vv2", StringComparison.OrdinalIgnoreCase)
                || code.EndsWith("vv3", StringComparison.OrdinalIgnoreCase);
        }

        protected string getNoteCrocettamento(Dictionary<string, object> master, List<Dictionary<string, object>> myGroup/*, OrdinaListeRecord vv1 = null x il confronto*/)
        {
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;//.tipo_volantino;
            string keyTema = Edro21Context.Meta.tema;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyNote_category = Edro21Context.Meta.note_category;

            //Dictionary<string, string> reqImport = JsonConvert.DeserializeObject<Dictionary<string, string>>(requestParams["importFieldsStringfy"]);

            //if (requestParams["importFieldsStringfy"].Length > 1 && requestParams["importFieldsStringfy"][requestParams["importFieldsStringfy"].Length - 2] == '&')
            //{
            //    requestParams["importFieldsStringfy"] = requestParams["importFieldsStringfy"].Remove(requestParams["importFieldsStringfy"].Length - 2, 1);
            //}

            //string queryString = requestParams["importFieldsStringfy"];
            // Usa HttpUtility.ParseQueryString per convertire la stringa in un NameValueCollection
            //var nameValueCollection = HttpUtility.ParseQueryString(queryString);

            // Converte il NameValueCollection in un dizionario
            Dictionary<string, string> reqImport = new Dictionary<string, string>();// nameValueCollection.AllKeys
                                                                                    //.ToDictionary(key => key, key => nameValueCollection[key]);

            //if (!reqImport.ContainsKey("cmbMaterialeVol"))
            //{
            reqImport["cmbMaterialeVol"] = "vol";
            //}

            string tipo_materiale = reqImport["cmbMaterialeVol"];
            Byte tipo_volantino = (Byte)1;//

            if (reqImport.ContainsKey("cmbTipoTracciato"))
            {
                tipo_volantino = Byte.Parse(reqImport["cmbTipoTracciato"]);
            }



            string note_crocettatura = "";

            string fuori_vol = master[keyTipo_volantino].ToString().ToLower();
            bool foto = master[referenza_pilota].ToString() == "S";
            bool esempio = master[potenziale_esempio].ToString() != "";
            string cod_ref = master[GLOBAL_VARIABLES.keyRefCodice].ToString();
            string tema = master[keyTema].ToString().ToLower();
            string meccanica = master[meccanica_origine].ToString();
            decimal scontoMM = master[keySconto_MM].ToDecimal();
            decimal scontoFID = master[keySconto_FID].ToDecimal();

            bool is_fuori_volantino = fuori_vol.Contains("fuori volantino");

            var reducedGroup = ReduceGroup(myGroup);

            if (reducedGroup.Find(f=> f["Referenza.Codice"].ToString() == "4651211") != null)
            {
                Console.WriteLine("");
            }

            //if (myGroup.Where(f => f[Edro21Context.Meta.codice_vv].ToString() == "1").ToList().Count == 1 || (is_fuori_volantino && tipo_volantino == 3))
            if (reducedGroup.Count == 1 || (is_fuori_volantino && tipo_volantino == 3))
            {
                //Codice scatto signolo
                note_crocettatura = "solo";
                if (is_fuori_volantino && tipo_volantino == 3)
                {
                    note_crocettatura = "F - Fuori Volantino";
                }
                else if (tipo_volantino == 2)
                {
                    is_fuori_volantino = (is_fuori_volantino || myGroup.Where(g => g[keyTipo_volantino].ToString().ToLower().Contains("fuori volantino")).Count() > 0);
                    if (is_fuori_volantino)
                        note_crocettatura = "FV - " + note_crocettatura;
                }
                else if (!foto && !esempio)
                {
                    /* x Confronto
                    if (vv1 != null)
                    {
                        if (!vv1.item.Foto && !vv1.item.Esempio)
                        {
                            note_crocettatura = "solo<br>errore:<br>non indicati foto e/o es.";
                        }
                    }
                    else
                    {*/
                    note_crocettatura = "solo<br>errore:<br>non indicati foto e/o es.";
                    //}
                }
            }
            else
            {

                Byte conteggio_esempio = 0;
                Byte conteggio_foto = 0;

                for (int z = 0; z < myGroup.Count; z++)
                {
                    var obj = myGroup[z];
                    if (obj[potenziale_esempio].ToString() != "")
                        conteggio_esempio++;
                    if (obj[referenza_pilota] != null && obj[referenza_pilota].ToString() == "S")
                        conteggio_foto++;
                }
                //for (int z = 0; z < myGroup.Count; z++)
                //{
                //    var obj = myGroup[z];
                //    if (obj[potenziale_esempio].ToString() != "")
                //        conteggio_esempio++;
                //    if (obj[referenza_pilota] != null && obj[referenza_pilota].ToString() == "S")
                //        conteggio_foto++;
                //}

                if (conteggio_esempio == 1)
                {
                    if (!esempio)
                    {
                        conteggio_esempio = 100;
                    }
                }

                //if (myGroup.Where(f=> f[Edro21Context.Meta.codice_vv].ToString() == "1").ToList().Count == 2)
                if (reducedGroup.Count == 2)
                {
                    //gemelli
                    if (conteggio_esempio == 0 && conteggio_foto == 0)
                        note_crocettatura = "gemelli<br>errore:<br>non indicati foto e/o es.";
                    else if (conteggio_esempio == 0 && conteggio_foto == 2)
                        note_crocettatura = "gemelli";
                    else if (conteggio_esempio == 0 && conteggio_foto == 1)
                        note_crocettatura = "gemelli";
                    else if (conteggio_esempio == 1)
                        note_crocettatura = "gemelli<br>esempio";
                    else if (conteggio_esempio == 100)
                        note_crocettatura = "gemelli<br>presente esempio";
                    else if (conteggio_esempio >= 2 /*&& conteggio_foto == 2*/)
                        note_crocettatura = "gemelli<br>esempio<br>errore:<br>indicati più es.";
                    else if (conteggio_foto > reducedGroup.Count)
                        note_crocettatura = "gemelli<br>errore selezione foto vv";
                    else
                        note_crocettatura = "gemelli";

                }
                else
                {
                    //Multiplo
                    note_crocettatura = "raggruppa";
                    if (conteggio_esempio == 1)
                        note_crocettatura += "<br>esempio";
                    else if (conteggio_esempio >= 2)
                    {
                        if (conteggio_esempio == 100)
                            note_crocettatura += "<br>presente esempio";
                        else
                            note_crocettatura += "<br>esempio<br>errore:<br>indicati più es.";
                    }
                    else if (conteggio_foto > reducedGroup.Count)
                        note_crocettatura += "<br>errore:<br> selezione foto vv";
                    else if (conteggio_esempio == 0 && conteggio_foto == 0)
                        note_crocettatura += "<br>errore:<br>non indicati foto e/o es.";
                }

                //Solo per POP
                is_fuori_volantino = (tipo_volantino == 2 && (is_fuori_volantino || myGroup.Where(g => g[keyTipo_volantino].ToString().ToLower().Contains("fuori volantino")).Count() > 0));

                if (is_fuori_volantino)
                {
                    string dtl_fv = "(";
                    List<string> _cods = myGroup.Where(g => g[keyTipo_volantino].ToString().ToLower().Contains("fuori volantino")).Select(s => s[GLOBAL_VARIABLES.keyRefCodice].ToString()).ToList();
                    if (fuori_vol.Contains("fuori volantino"))
                        _cods.Insert(0, cod_ref);

                    for (int c = 0; c < _cods.Count; c++)
                    {
                        if (c > 0)
                            dtl_fv += ",";

                        dtl_fv += _cods[c];

                    }
                    if (dtl_fv != "(")
                        dtl_fv += " ";
                    note_crocettatura = dtl_fv + "FV) - " + note_crocettatura;

                }

            }

            bool star_in_ruolo = ((myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("star") && !gr[keyRuolo].ToString().ToLower().Contains("starissima")).Count() > 0) ||
                (myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("star") && !gr[keyNote_category].ToString().ToLower().Contains("starissima")).Count() > 0));

            bool starissima_in_ruolo = (myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("starissima")).Count() > 0 ||
                myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("starissima")).Count() > 0);

            bool vedette_in_ruolo = (myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("vedette")).Count() > 0 ||
                myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("vedette")).Count() > 0);

            bool comark_in_ruolo = ((myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("comarketing") ||
                gr[keyRuolo].ToString().ToLower().Contains("comkt") ||
                gr[keyRuolo].ToString().ToLower().Contains("comark")).Count() > 0) ||
                (myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("comarketing") ||
                gr[keyNote_category].ToString().ToLower().Contains("comkt") ||
                gr[keyNote_category].ToString().ToLower().Contains("comark")).Count() > 0));

            bool artwork_in_ruolo = (myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("artwork")).Count() > 0 ||
                myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("artwork")).Count() > 0);

            bool prima_pagina_in_ruolo = (myGroup.Where(gr => gr[keyNote_category].ToString().ToLower().Contains("prima pagina")).Count() > 0 ||
                myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("prima pagina")).Count() > 0);

            //RICHIAMO B&F
            bool is_bassi_e_fissi = (myGroup.Where(gr => gr[keyRuolo].ToString().ToLower().Contains("richiamo b&f")).Count() > 0);

            #region nota ruolo

            string nota_ruolo = "";
            if (star_in_ruolo)
                nota_ruolo = "<br>star";
            if (starissima_in_ruolo)
            {
                if (nota_ruolo != "")
                    nota_ruolo = "<br>(errore ruolo)";
                else
                    nota_ruolo = "<br>starissima";
            }
            if (vedette_in_ruolo)
            {
                if (nota_ruolo != "")
                    nota_ruolo = "<br>(errore ruolo)";
                else
                    nota_ruolo = "<br>vedette";
            }

            if (comark_in_ruolo)
            {
                nota_ruolo += "<br>Co-Marketing";
            }
            if (artwork_in_ruolo)
            {
                nota_ruolo += "<br>Artwork";
            }

            if (prima_pagina_in_ruolo)
            {
                nota_ruolo += "<br>PRIMA PAGINA VERIFICARE AREA";
            }

            if (is_bassi_e_fissi)
            {
                nota_ruolo += "<br>B&F";
            }

            note_crocettatura += nota_ruolo;

            #endregion

            #region nota esempio

            string nota_esempio = "";

            try
            {


                object[] obj_es = getNotaEsempio(myGroup, tipo_volantino == 2 ? note_crocettatura : "");
                nota_esempio = obj_es[0].ToString();

                if (obj_es[1].ToString() != "")
                    nota_esempio += obj_es[1].ToString();

            }
            catch { }

            if (nota_esempio != "")
                note_crocettatura += nota_esempio;

            #endregion

            #region nota 50 al 50
            if (tema.ToLower().IndexOf("mt.prod.50%fi") >= 0 ||
                             tema.ToLower().IndexOf("m50pr.50%fid") >= 0 ||
                             tema.ToLower().IndexOf("m50prod.50%fi") >= 0 ||
                             tema.ToLower().IndexOf("m50prodsc50%") >= 0/*master.tema.ToLower().IndexOf("50%") >= 0 || master.tema.ToLower().IndexOf("50 %") >= 0*/)
            {
                Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == meccanica).FirstOrDefault();

                if (mItem != null)
                {
                    if (mItem.NomeTraduzione == "PERCENTO_MM" || (mItem.NomeTraduzione == "PERCENTO_FID" && (tema.ToLower().IndexOf("m50prodsc50%") < 0 || tipo_volantino == 2)))
                    {
                        note_crocettatura += "<br>ref. a tema 50al50 ma grafica solo sconto. OK???";
                    }

                    if ((mItem.NomeTraduzione == "PERCENTO_MM_ALL" || mItem.NomeTraduzione == "PERCENTO_MM") && scontoMM != 50)
                    {
                        note_crocettatura += "<br>errore:<br> sconto diverso da 50";
                    }
                    else if ((mItem.NomeTraduzione == "PERCENTO_FID" || mItem.NomeTraduzione == "PERCENTO_FID_ALL") && scontoFID != 50)
                    {
                        if (tema.ToLower().IndexOf("m50prodsc50%") < 0 || tipo_volantino == 2)
                            note_crocettatura += "<br>errore:<br> sconto diverso da 50";
                    }
                }
            }
            #endregion


            //if (fuori_volantino && tItem.tipo.Value != 2)
            //note_crocettatura = "";

            return note_crocettatura;
        }

        protected object[] getNotaEsempio(List<Dictionary<string, object>> myGroup, string parziale_note = "", string areaTracciato = "")
        {
            string nota_sottogruppo = "";

            try
            {
                string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;
                string keyScattoCodiceGruppo = Edro21Context.Meta.ScattoCodiceGruppo;
                string keyReferenzaCodice = Edro21Context.Meta.ReferenzaCodice;

                bool esempio_non_sepcificato = false;
                bool esempio_non_necessario = false;
                IndiceDifferenza idx = null;
                int indice_differenza = -1;
                Dictionary<string, object> item_esempio = myGroup.FirstOrDefault();
                List<string> sottogruppi = new List<string>();
                if (myGroup.Find(f => f[keyReferenzaCodice].ToString() == "2452226") != null)
                {
                    Debug.WriteLine("");
                }
                var errorNotaEsempio = "";

                var reducedGroups = ReduceGroupByPriorityLayers(myGroup);

                if (item_esempio != null)
                {
                    foreach (var group in reducedGroups)
                    {
                        var esempioReducedGroup = group.FirstOrDefault();
                        //volutamente myGroup invece che group
                        if (myGroup.Where(g => g[potenziale_esempio].ToString() != "").Count() <= 0)
                        {

                            for (int y = 1; y < group.Count; y++)
                            {
                                var current = group[y];
                                //if (current[Edro21Context.Meta.codice_vv].ToString() != "1")
                                //{
                                //    continue;
                                //}
                                idx = getIndiceDifferenze(esempioReducedGroup, current, areaTracciato);
                                if (idx.indice == -1)
                                {
                                    return new object[] { idx.error, nota_sottogruppo };
                                }
                                if (idx.details_sottogruppi != "")
                                    sottogruppi.Add(current[GLOBAL_VARIABLES.keyRefCodice].ToString() + "#" + idx.details_sottogruppi);
                                indice_differenza = idx.indice;
                                esempio_non_sepcificato = (indice_differenza > 0);//ciSonoDifferenzeFraIRecords(item_esempio, current);

                                if (esempio_non_sepcificato && parziale_note == "")
                                    break;
                            }
                        }
                        else if (group.Count > 1)
                        {
                            esempio_non_necessario = true;

                            for (int y = 1; y < group.Count; y++)
                            {
                                var current = group[y];
                                //if (current[Edro21Context.Meta.codice_vv].ToString() != "1")
                                //{
                                //    continue;
                                //}
                                idx = getIndiceDifferenze(esempioReducedGroup, current, areaTracciato);
                                if (idx.indice == -1)
                                {
                                    return new object[] { idx.error, nota_sottogruppo };
                                }
                                if (idx.details_sottogruppi != "")
                                    sottogruppi.Add(current[GLOBAL_VARIABLES.keyRefCodice].ToString() + "#" + idx.details_sottogruppi);
                                indice_differenza = idx.indice;
                                bool differenze = (indice_differenza > 0);//ciSonoDifferenzeFraIRecords(item_esempio, current);

                                if (differenze)
                                {
                                    esempio_non_necessario = false;
                                    if (parziale_note == "")
                                        break;
                                }
                            }
                        }
                    }
                }




                if (parziale_note != ""/* &&  
                (esempio_non_sepcificato || 
                parziale_note.Contains("esempio")) &&
                !esempio_non_necessario*/)
                {
                    //Ci vuole la nota di sottogruppo
                    string master = "";
                    Dictionary<string, string> gruppi_di_sottogruppi = new Dictionary<string, string>();
                    foreach (string sgItem in sottogruppi)
                    {
                        string[] sgItem_parsing = sgItem.Split('#');
                        Dictionary<string, object> obj = JsonConvert.DeserializeObject<Dictionary<string, object>>(sgItem_parsing[1]);
                        if (master == "")
                        {
                            master = obj["master"].ToString();
                            gruppi_di_sottogruppi.Add(master, ", " + item_esempio[keyReferenzaCodice].ToString() + ",");
                        }

                        string key = obj["child"].ToString();
                        if (key != "")
                        {
                            if (!gruppi_di_sottogruppi.ContainsKey(key))
                            {
                                gruppi_di_sottogruppi.Add(key, ",");
                            }

                            gruppi_di_sottogruppi[key] = gruppi_di_sottogruppi[key] + " " + sgItem_parsing[0] + ",";
                        }
                        else
                        {
                            gruppi_di_sottogruppi[master] = gruppi_di_sottogruppi[master] + " " + sgItem_parsing[0] + ",";
                        }

                    }

                    if (gruppi_di_sottogruppi.Keys.Count > 0)
                    {
                        nota_sottogruppo += "<br>REF IN COMUNE:" + item_esempio[keyScattoCodiceGruppo];
                        int countg = 1;
                        foreach (string gKey in gruppi_di_sottogruppi.Keys)
                        {
                            nota_sottogruppo += "<br>";
                            nota_sottogruppo += "g" + countg + "->" + gruppi_di_sottogruppi[gKey];
                            countg++;
                        }
                    }
                }



                if (esempio_non_sepcificato)
                {
                    return new object[] { "<br>NON EVIDENZIATO ESEMPIO MA NECESSARIO", nota_sottogruppo };
                }

                if (esempio_non_necessario)
                {
                    return new object[] { "<br>EVIDENZIATO ESEMPIO MA NON NECESSARIO", nota_sottogruppo };
                }


            }
            catch (Exception ex)
            {
                return new object[] { "Error -> " + ex.ToString(), "" };
            }

            return new object[] { "", nota_sottogruppo };
        }

        protected IndiceDifferenza getIndiceDifferenze(Dictionary<string, object> item_esempio, Dictionary<string, object> current, string areaTracciato = "")
        {
            string keySegmento = Edro21Context.Meta.segmento;
            string keySconto_MM = Edro21Context.Meta.sconto_MM;
            string keyPrezzo_paghi = Edro21Context.Meta.prezzo_offerta;
            string keyPrezzo_paghi_kgl = Edro21Context.Meta.prezzo_offerta_kgl;
            string keyPaghi_secondo = Edro21Context.Meta.prezzo_offerta_secondo;
            string keySconto_FID = Edro21Context.Meta.sconto_FID;
            string keyPaghi_secondo_kgl = Edro21Context.Meta.prezzo_offerta_secondo_kgl;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPaghi_kgl_secondo = Edro21Context.Meta.prezzo_offerta_kgl_secondo;
            string keyTipo_sconto_FID = Edro21Context.Meta.tipo_sconto_FID;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keyTipo_sconto_MM = Edro21Context.Meta.tipo_sconto_MM;
            string keyTipo_punti = Edro21Context.Meta.tipo_punti;
            string keyPrezzo_anziche = Edro21Context.Meta.prezzo_anziche;
            string keyPrezzo_anziche_kgl = Edro21Context.Meta.prezzo_anziche_kgl;
            string keyPaghi_due_pezzi = Edro21Context.Meta.paghi_due_pezzi;
            string keyN_MM = Edro21Context.Meta.N_MM;
            string keyM_MM = Edro21Context.Meta.M_MM;
            string keyN_FID = Edro21Context.Meta.N_FID;
            string keyM_FID = Edro21Context.Meta.M_FID;


            IndiceDifferenza id = new IndiceDifferenza();

            //controllo prezzi
            decimal paghi = item_esempio[keyPrezzo_paghi].ToDecimal();
            decimal paghi_secondo = item_esempio.ContainsKey(keyPaghi_secondo) ? item_esempio[keyPaghi_secondo].ToDecimal() : 0;
            decimal paghi_kl = item_esempio[keyPrezzo_paghi_kgl].ToDecimal();
            decimal paghi_kl_secondo = item_esempio.ContainsKey(keyPaghi_secondo_kgl) ? item_esempio[keyPaghi_secondo_kgl].ToDecimal() : 0;
            decimal paghi_due_pezzi = item_esempio.ContainsKey(keyPaghi_due_pezzi) ? item_esempio[keyPaghi_due_pezzi].ToDecimal() : 0;
            decimal anziche = item_esempio[keyPrezzo_anziche].ToDecimal();
            decimal anziche_kl = item_esempio[keyPrezzo_anziche_kgl].ToDecimal();
            //decimal prezzo = item_esempio["prezzo"].ToDecimal();
            string range1 = item_esempio[keyRange_1].ToString();
            string range2 = item_esempio[keyRange_2].ToString();
            string punti1 = item_esempio[keyPunti_1].ToString();
            string punti2 = item_esempio[keyPunti_2].ToString();
            string tipo_punti = item_esempio[keyTipo_punti].ToString();
            decimal sconto_mm = item_esempio[keySconto_MM].ToDecimal();
            decimal sconto_fid = item_esempio[keySconto_FID].ToDecimal();

            string meccanica = "";
            if (item_esempio.ContainsKey(Meta.meccanica_tradotta))
            {
                meccanica = item_esempio[Meta.meccanica_tradotta].ToString();
            }
            else
            {
                if (item_esempio["Referenza.Codice"].ToString() == "7184397")
                {
                    Debug.WriteLine("");
                }
                Meccanica m = interpretaMeccanica(item_esempio, false, null);
                meccanica = m.NomeTraduzione;

                if (meccanica == null) {
                    errors.Add("Meccanica non trovata, ricontrollare la lista");
                    id.error = "Meccanica non trovata, ricontrollare la lista";
                    id.indice = -1;
                    id.details_sottogruppi = "";
                    return id;
                }
                item_esempio[Meta.meccanica_tradotta] = meccanica;
            }

            string tipo_sconto_mm = item_esempio[keyTipo_sconto_MM].ToString();
            string tipo_sconto_fid = item_esempio[keyTipo_sconto_FID].ToString();
            decimal sconto_agenzia = item_esempio[keySconto_agenzia].ToDecimal();

            //Questi al momento li imposto tutti a 0 per la demo perchè nell'addestramento ho lasciato il tipo valore a string
            Decimal n_massmarket = item_esempio[keyN_MM].ToDecimal();
            Decimal m_massmarket = item_esempio[keyM_MM].ToDecimal();
            Decimal n_fidelity = item_esempio[keyN_FID].ToDecimal();
            Decimal m_fidelity = item_esempio[keyM_FID].ToDecimal();

            bool is_tpmm = (meccanica.ToLower().IndexOf("tp_mm") >= 0);
            bool is_punti = (meccanica.ToLower().IndexOf("punti") >= 0);
            bool is_punti_percento = (meccanica.ToLower().IndexOf("punti_percento") >= 0);
            bool is_punti_multi = (meccanica.ToLower().IndexOf("punti_multi") >= 0);
            bool is_punti_multi_percento = (meccanica.ToLower().IndexOf("punti_multi_percento") >= 0);
            bool is_punti_multi_tp = (meccanica.ToLower().IndexOf("punti_multi_tp") >= 0);
            bool is_punti_tp = (meccanica.ToLower().IndexOf("punti_tp") >= 0);
            bool is_50_al_secondo = ((meccanica.ToLower().IndexOf("50alsecondo") >= 0) || (meccanica.ToLower().IndexOf("50sulsecondo") >= 0));
            bool is_percento_mm = (meccanica.ToLower().IndexOf("percento_mm") >= 0 && meccanica.ToLower().IndexOf("_all") < 0);
            bool is_percento_fid = (meccanica.ToLower().IndexOf("percento_fid") >= 0 && meccanica.ToLower().IndexOf("_all") < 0);

            string codice_sottogruppo = "";

            if (meccanica.IndexOf("NM") == 0 && meccanica.IndexOf("FID") < 0)
            {
                meccanica = "NM BIS";
            }
            else if (meccanica.IndexOf("NM") == 0 && meccanica.IndexOf("FID") > 0)
            {
                meccanica = "NM BIS FID";
            }

            if (/*is_punti_multi || */is_punti_percento || is_punti_tp || is_punti_multi_percento || is_punti_multi_tp)
                is_punti = false;

            Ordinamento gItem = dbGrammature.Where(g => g.CodiceSegmento == item_esempio[keySegmento].ToString()).FirstOrDefault();
            if (gItem != null)
            {
                bool is_food = gItem.Food;

                decimal curr_sconto_mm = current[keySconto_MM].ToDecimal();
                decimal curr_sconto_fid = current[keySconto_FID].ToDecimal();
                decimal curr_sconto_agenzia = current[keySconto_agenzia].ToDecimal();
                decimal curr_paghi_secondo = current.ContainsKey(keyPaghi_secondo) ? current[keyPaghi_secondo].ToDecimal() : 0;
                decimal curr_paghi_kl_secondo = current.ContainsKey(keyPaghi_kgl_secondo) ? current[keyPaghi_kgl_secondo].ToDecimal() : 0;
                decimal curr_paghi_due_pezzi = current.ContainsKey(keyPaghi_due_pezzi) ? current[keyPaghi_due_pezzi].ToDecimal() : 0;
                string curr_meccanica = "";
                if (current.ContainsKey(Meta.meccanica_tradotta))
                {
                    curr_meccanica = current[Meta.meccanica_tradotta].ToString();
                }
                else
                {
                    Meccanica m2 = interpretaMeccanica(current, false, null);
                    curr_meccanica = m2.NomeTraduzione;
                    current[Meta.meccanica_tradotta] = curr_meccanica;
                }
                //Meccanica m2 = interpretaMeccanica(current, false, null);

                Decimal curr_n_massmarket = 0;//(decimal)current[keyN_MM];
                Decimal curr_m_massmarket = 0;//(decimal)current[keyM_MM];
                Decimal curr_n_fidelity = 0;//(decimal)current[keyN_FID];
                Decimal curr_m_fidelity = 0;//(decimal)current[keyM_FID];

                bool prezzi_diversi = false;
                bool range_punti_diversi = false;


                if (curr_meccanica.IndexOf("NM") == 0 && curr_meccanica.IndexOf("FID") < 0)
                {
                    curr_meccanica = "NM BIS";
                }
                else if (curr_meccanica.IndexOf("NM") == 0 && curr_meccanica.IndexOf("FID") > 0)
                {
                    curr_meccanica = "NM BIS FID";
                }


                //Recupero la richiesta avvenuta all'import di questo tracciato che ora è in esportazione.
                Byte tipo_volantino = 1;
                string tipo_materiale = "vol";
                int id_area = -1;


                string range1_2 = current[keyRange_1].ToString();
                string range2_2 = current[keyRange_2].ToString();
                string punti1_2 = current[keyPunti_1].ToString();
                string punti2_2 = current[keyPunti_2].ToString();
                string tipo_punti_2 = current[keyTipo_punti].ToString();
                decimal paghi_2 = current[keyPrezzo_paghi].ToDecimal();
                decimal paghi_kl_2 = current[keyPrezzo_paghi_kgl].ToDecimal();
                decimal anziche_2 = current[keyPrezzo_anziche].ToDecimal();
                decimal anziche_kl_2 = current[keyPrezzo_anziche_kgl].ToDecimal();
                string tipo_sconto_mm_2 = current[keyTipo_sconto_MM].ToString();
                string tipo_sconto_fid_2 = current[keyTipo_sconto_FID].ToString();


                if (id_area == 0)
                {
                    decimal paghi_secondo_2 = current.ContainsKey(keyPaghi_secondo) ? current[keyPaghi_secondo].ToDecimal() : 0;
                    decimal paghi_kl_secondo_2 = current.ContainsKey(keyPaghi_secondo_kgl) ? current[keyPaghi_secondo_kgl].ToDecimal() : 0;
                    decimal paghi_due_pezzi_2 = current.ContainsKey(keyPaghi_due_pezzi) ? current[keyPaghi_due_pezzi].ToDecimal() : 0;




                    decimal sconto_agenzia_2 = current[keySconto_agenzia].ToDecimal();

                    prezzi_diversi = (paghi != paghi_2 ||
                                anziche != anziche_2 ||
                                sconto_agenzia != sconto_agenzia_2 ||
                                sconto_mm != curr_sconto_mm ||
                                sconto_fid != curr_sconto_fid ||
                                tipo_sconto_mm != tipo_sconto_mm_2 ||
                                tipo_sconto_fid != tipo_sconto_fid_2 ||
                                paghi_kl_secondo != curr_paghi_kl_secondo ||
                                paghi_due_pezzi != curr_paghi_due_pezzi ||
                                paghi_secondo != curr_paghi_secondo ||
                                paghi_kl != paghi_kl_2 ||
                                anziche_kl != anziche_kl_2 ||
                                n_massmarket != curr_n_massmarket ||
                                m_massmarket != curr_m_massmarket ||
                                n_fidelity != curr_n_fidelity ||
                                m_fidelity != curr_m_fidelity);

                    range_punti_diversi = (range1 != range1_2 ||
                                range2 != range2_2 ||
                                punti1 != punti1_2 ||
                                punti2 != punti2_2 ||
                                tipo_punti != tipo_punti_2);

                }
                else if (is_food && is_tpmm)
                {
                    string master = "\"master\":\"" + paghi + ";" + paghi_kl + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        paghi_kl != paghi_kl_2 ||
                        meccanica != curr_meccanica/*current.meccanica*/
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 || paghi_kl != paghi_kl_2);


                        range_punti_diversi = (range1 != range1_2 || range2 != range2_2
                            || punti1 != punti1_2 || punti2 != punti2_2 || tipo_punti != tipo_punti_2);

                        child = "\"child\":\"" + paghi_2 + ";" + paghi_kl_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica + "\"";

                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";

                }
                else if (!is_food && is_tpmm)
                {
                    string master = "\"master\":\"" + paghi + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica + "\"";
                    string child = "\"child\":\"\"";
                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        meccanica != curr_meccanica/*current.meccanica*/
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2);


                        range_punti_diversi = (range1 != range1_2 || range2 != range2_2
                            || punti1 != punti1_2 || punti2 != punti2_2 || tipo_punti != tipo_punti_2);

                        child = "\"child\":\"" + paghi_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica + "\"";
                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";
                }
                else if (is_punti)
                {
                    string master = "\"master\":\"" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        meccanica != curr_meccanica
                        )
                    {
                        range_punti_diversi = (range1 != range1_2 || range2 != range2_2
                            || punti1 != punti1_2 || punti2 != punti2_2 || tipo_punti != tipo_punti_2);

                        //return true;

                        child = "\"child\":\"" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica + "\"";
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";

                }
                else if (is_food && (is_punti_percento || is_punti_multi || is_punti_tp || is_punti_multi_percento || is_punti_multi_tp))
                {
                    string sgM = paghi + ";" + paghi_kl + ";" + anziche + ";" + anziche_kl + ";" + sconto_agenzia + ";" + sconto_mm + ";" + sconto_fid + ";" + tipo_sconto_mm + ";" + tipo_sconto_fid + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        paghi_kl != paghi_kl_2 ||
                        anziche != anziche_2 ||
                        anziche_kl != anziche_kl_2 ||
                        sconto_agenzia != curr_sconto_agenzia ||
                        sconto_mm != curr_sconto_mm ||
                        sconto_fid != curr_sconto_fid ||
                        tipo_sconto_mm != tipo_sconto_mm_2 ||
                        tipo_sconto_fid != tipo_sconto_fid_2 ||
                        meccanica != curr_meccanica
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 || paghi_kl != paghi_kl_2 ||
                                            anziche != anziche_2 ||
                                            anziche_kl != anziche_kl_2 ||
                                            sconto_agenzia != curr_sconto_agenzia ||
                                            sconto_mm != curr_sconto_mm ||
                                            sconto_fid != curr_sconto_fid ||
                                            tipo_sconto_mm != tipo_sconto_mm_2 ||
                                            tipo_sconto_fid != tipo_sconto_fid_2);


                        string sgC = paghi_2 + ";" + paghi_kl_2 + ";" + anziche_2 + ";" + anziche_kl_2 + ";" + curr_sconto_agenzia + ";" + curr_sconto_mm + ";" + curr_sconto_fid + ";" + tipo_sconto_mm_2 + ";" + tipo_sconto_fid_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica;

                        child = "\"child\":\"" + sgC + "\"";

                        range_punti_diversi = (range1 != range1_2 || range2 != range2_2
                            || punti1 != punti1_2 || punti2 != punti2_2 || tipo_punti != tipo_punti_2);

                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";

                }
                else if (!is_food && (is_punti_percento || is_punti_multi || is_punti_tp || is_punti_multi_percento || is_punti_multi_tp))
                {
                    string sgM = paghi + ";" + anziche + ";" + sconto_agenzia + ";" + sconto_mm + ";" + sconto_fid + ";" + tipo_sconto_mm + ";" + tipo_sconto_fid + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        anziche != anziche_2 ||
                        sconto_agenzia != curr_sconto_agenzia ||
                        sconto_mm != curr_sconto_mm ||
                        sconto_fid != curr_sconto_fid ||
                        tipo_sconto_mm != tipo_sconto_mm_2 ||
                        tipo_sconto_fid != tipo_sconto_fid_2 ||
                        meccanica != curr_meccanica
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 ||
                                    anziche != anziche_2 ||
                                    sconto_agenzia != curr_sconto_agenzia ||
                                    sconto_mm != curr_sconto_mm ||
                                    sconto_fid != curr_sconto_fid ||
                                    tipo_sconto_mm != tipo_sconto_mm_2 ||
                                    tipo_sconto_fid != tipo_sconto_fid_2);

                        string sgC = paghi_2 + ";" + anziche_2 + ";" + curr_sconto_agenzia + ";" + curr_sconto_mm + ";" + curr_sconto_fid + ";" + tipo_sconto_mm_2 + ";" + tipo_sconto_fid_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica;
                        child = "\"child\":\"" + sgC + "\"";

                        range_punti_diversi = (range1 != range1_2 ||
                                    range2 != range2_2 ||
                                    punti1 != punti1_2 ||
                                    punti2 != punti2_2 ||
                                    tipo_punti != tipo_punti_2);

                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";
                }
                else if (is_food && is_50_al_secondo)
                {
                    string sgM = paghi + ";" + paghi_kl + ";" + paghi_secondo + ";" + paghi_kl_secondo + ";" + paghi_due_pezzi + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        paghi != paghi_2 ||
                        paghi_kl != paghi_kl_2 ||
                        paghi_secondo != curr_paghi_secondo ||
                        paghi_kl_secondo != curr_paghi_kl_secondo ||
                        paghi_due_pezzi != curr_paghi_due_pezzi ||
                        meccanica != curr_meccanica
                        )
                    {

                        /*if (item_esempio.codice_referenza == "2484320")
                        {
                            Response.Write("SI!<br>");
                        }*/

                        prezzi_diversi = (paghi != paghi_2 ||
                                    paghi_kl != paghi_kl_2 ||
                                    paghi_secondo != curr_paghi_secondo ||
                                    paghi_kl_secondo != curr_paghi_kl_secondo ||
                                    paghi_due_pezzi != curr_paghi_due_pezzi);

                        string sgC = paghi_2 + ";" + paghi_kl_2 + ";" + curr_paghi_secondo + ";" + curr_paghi_kl_secondo + ";" + curr_paghi_due_pezzi + ";" + curr_meccanica;
                        child = "\"child\":\"" + sgC + "\"";

                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";
                }
                else if (!is_food && is_50_al_secondo)
                {
                    string sgM = paghi + ";" + paghi_secondo + ";" + paghi_due_pezzi + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        paghi != paghi_2 ||
                        paghi_secondo != curr_paghi_secondo ||
                        paghi_due_pezzi != curr_paghi_due_pezzi ||
                        meccanica != curr_meccanica
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 ||
                                    paghi_secondo != curr_paghi_secondo ||
                                    paghi_due_pezzi != curr_paghi_due_pezzi);

                        string sgC = paghi_2 + ";" + curr_paghi_secondo + ";" + curr_paghi_due_pezzi + ";" + curr_meccanica;
                        child = "\"child\":\"" + sgC + "\"";

                        //return true;
                    }

                    codice_sottogruppo = "{" + master + "," + child + "}";

                }
                else if (is_percento_mm)
                {
                    prezzi_diversi = (sconto_mm != curr_sconto_mm);
                    codice_sottogruppo = "{\"master\":\"" + sconto_mm + "\",\"child\":\"" + curr_sconto_mm + "\"}";
                }
                else if (is_percento_fid)
                {
                    prezzi_diversi = (sconto_fid != curr_sconto_fid);
                    codice_sottogruppo = "{\"master\":\"" + sconto_fid + "\",\"child\":\"" + curr_sconto_fid + "\"}";
                }
                else if (is_food && (!is_tpmm && !is_punti && !is_punti_multi && !is_punti_percento && !is_punti_tp && !is_50_al_secondo))
                {
                    string sconto_special_master = is_percento_mm ? sconto_mm.ToString() : sconto_fid.ToString();
                    string sgM = paghi + ";" + paghi_kl + ";" + anziche + ";" + anziche_kl + ";" + sconto_agenzia + ";" + sconto_special_master + ";" + tipo_sconto_mm + ";" + tipo_sconto_fid + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        paghi_kl != paghi_kl_2 ||
                        anziche != anziche_2 ||
                        anziche_kl != anziche_kl_2 ||
                        sconto_agenzia != curr_sconto_agenzia ||
                        (is_percento_mm && sconto_mm != curr_sconto_mm) ||
                        (is_percento_fid && sconto_fid != curr_sconto_fid) ||
                        tipo_sconto_mm != tipo_sconto_mm_2 ||
                        tipo_sconto_fid != tipo_sconto_fid_2 ||
                        meccanica != curr_meccanica/*current.meccanica*/
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 ||
                                    paghi_kl != paghi_kl_2 ||
                                    anziche != anziche_2 ||
                                    anziche_kl != anziche_kl_2 ||
                                    sconto_agenzia != curr_sconto_agenzia ||
                                    (is_percento_mm && sconto_mm != curr_sconto_mm) ||
                                    (is_percento_fid && sconto_fid != curr_sconto_fid) ||
                                    tipo_sconto_mm != tipo_sconto_mm_2 ||
                                    tipo_sconto_fid != tipo_sconto_fid_2);


                        string sconto_special_child = is_percento_mm ? sconto_mm.ToString() : sconto_fid.ToString();

                        string sgC = paghi_2 + ";" + paghi_kl_2 + ";" + anziche_2 + ";" + anziche_kl_2 + ";" + curr_sconto_agenzia + ";" + sconto_special_child + ";" + tipo_sconto_mm_2 + ";" + tipo_sconto_fid_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica;
                        child = "\"child\":\"" + sgC + "\"";

                        range_punti_diversi = (range1 != range1_2 ||
                                    range2 != range2_2 ||
                                    punti1 != punti1_2 ||
                                    punti2 != punti2_2 ||
                                    tipo_punti != tipo_punti_2);

                        //return true;
                    }
                    codice_sottogruppo = "{" + master + "," + child + "}";
                }
                else if (!is_food && (!is_tpmm && !is_punti && !is_punti_multi && !is_punti_percento && !is_punti_tp && !is_50_al_secondo))
                {
                    string sconto_special_master = is_percento_mm ? sconto_mm.ToString() : sconto_fid.ToString();
                    string sgM = paghi + ";" + anziche + ";" + sconto_agenzia + ";" + sconto_special_master + ";" + tipo_sconto_mm + ";" + tipo_sconto_fid + ";" + range1 + ";" + range2 + ";"
                            + punti1 + ";" + punti2 + ";" + tipo_punti + ";" + meccanica;
                    string master = "\"master\":\"" + sgM + "\"";
                    string child = "\"child\":\"\"";

                    if (
                        range1 != range1_2 ||
                        range2 != range2_2 ||
                        punti1 != punti1_2 ||
                        punti2 != punti2_2 ||
                        tipo_punti != tipo_punti_2 ||
                        paghi != paghi_2 ||
                        anziche != anziche_2 ||
                        sconto_agenzia != curr_sconto_agenzia ||
                        (is_percento_mm && sconto_mm != curr_sconto_mm) ||
                        (is_percento_fid && sconto_fid != curr_sconto_fid) ||
                        tipo_sconto_mm != tipo_sconto_mm_2 ||
                        tipo_sconto_fid != tipo_sconto_fid_2 ||
                        meccanica != curr_meccanica/*current.meccanica*/
                        )
                    {
                        prezzi_diversi = (paghi != paghi_2 ||
                                    anziche != anziche_2 ||
                                    sconto_agenzia != curr_sconto_agenzia ||
                                    (is_percento_mm && sconto_mm != curr_sconto_mm) ||
                                    (is_percento_fid && sconto_fid != curr_sconto_fid) ||
                                    tipo_sconto_mm != tipo_sconto_mm_2 ||
                                    tipo_sconto_fid != tipo_sconto_fid_2);


                        string sconto_special_child = is_percento_mm ? sconto_mm.ToString() : sconto_fid.ToString();
                        string sgC = paghi_2 + ";" + anziche_2 + ";" + curr_sconto_agenzia + ";" + sconto_special_child + ";" + tipo_sconto_mm_2 + ";" + tipo_sconto_mm_2 + ";" + range1_2 + ";" + range2_2 + ";"
                            + punti1_2 + ";" + punti2_2 + ";" + tipo_punti_2 + ";" + curr_meccanica;
                        child = "\"child\":\"" + sgC + "\"";

                        range_punti_diversi = (range1 != range1_2 ||
                                    range2 != range2_2 ||
                                    punti1 != punti1_2 ||
                                    punti2 != punti2_2 ||
                                    tipo_punti != tipo_punti_2);

                        //return true;
                    }
                    codice_sottogruppo = "{" + master + "," + child + "}";
                }

                if (prezzi_diversi && range_punti_diversi && curr_meccanica == meccanica)
                {
                    id.indice = 31;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
                else if (prezzi_diversi && !range_punti_diversi && curr_meccanica == meccanica)
                {
                    /*if (item_esempio.codice_referenza == "2484320")
                    {
                        Response.Write("1<br>");
                    }*/
                    id.indice = 1;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
                else if (!prezzi_diversi && range_punti_diversi && curr_meccanica == meccanica)
                {
                    id.indice = 3;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
                else if (!prezzi_diversi && range_punti_diversi && curr_meccanica != meccanica)
                {
                    id.indice = 32;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
                else if (curr_meccanica != meccanica)
                {
                    id.indice = 2;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
                else
                {
                    /*if (item_esempio.codice_referenza == "2484320")
                    {
                        Response.Write("0<br>");
                    }*/
                    id.indice = 0;
                    id.details_sottogruppi = codice_sottogruppo;
                    return id;
                }
            }
            else
            {
                errors.Add("Segmento: " + item_esempio[keySegmento] + " non trovato.");
            }

            id.indice = 0;
            id.details_sottogruppi = "";

            return id;
        }

        protected Meccanica interpretaMeccanica(Dictionary<string, object> tItem, bool flag_meccanica_unita, Dictionary<string, object> combinazione_pop = null)
        {
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyArea = Edro21Context.Meta.area;
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keyReparto = Edro21Context.Meta.reparto;
            string keySezione = Edro21Context.Meta.sezione;
            string keySconto_agenzia = Edro21Context.Meta.sconto_agenzia;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyRange_1 = Edro21Context.Meta.range_1;
            string keyRange_2 = Edro21Context.Meta.range_2;
            string keyPunti_1 = Edro21Context.Meta.punti_1;
            string keyPunti_2 = Edro21Context.Meta.punti_2;
            string keySettore = Edro21Context.Meta.settore;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDescrizioniDescrizione1 = Edro21Context.Meta.DescrizioniDescrizione1;
            string keyDescrizioniDescrizione2 = Edro21Context.Meta.DescrizioniDescrizione2;
            string keyDescrizioniDescrizione3 = Edro21Context.Meta.DescrizioniDescrizione3;
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;
            Meccanica result = new Meccanica();
            string meccanica_originale = tItem[meccanica_origine].ToString();

            Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == meccanica_originale).FirstOrDefault();

            string cod_ref_test = "";

            if (mItem != null)
            {
                Byte tipo_volantino = 1;
                string tipo_materiale = "vol";

                if (requestParams.ContainsKey("importFieldsStringfy"))
                {
                    Dictionary<string, string> reqImport = JsonConvert.DeserializeObject<Dictionary<string, string>>(requestParams["importFieldsStringfy"]);

                    if (!reqImport.ContainsKey("cmbMaterialeVol"))
                    {
                        reqImport["cmbMaterialeVol"] = "vol";
                    }

                    tipo_materiale = reqImport["cmbMaterialeVol"].ToLower();


                    if (reqImport.ContainsKey("cmbTipoTracciato"))
                    {
                        tipo_volantino = Byte.Parse(reqImport["cmbTipoTracciato"]);
                    }
                }
                else if (requestParams.ContainsKey("cmbTipoTracciato"))
                {
                    if (!requestParams.ContainsKey("cmbMaterialeVol"))
                    {
                        requestParams["cmbMaterialeVol"] = "vol";
                    }

                    tipo_materiale = requestParams["cmbMaterialeVol"].ToLower();

                    if (requestParams.ContainsKey("cmbTipoTracciato"))
                    {
                        tipo_volantino = Byte.Parse(requestParams["cmbTipoTracciato"]);
                    }
                }

                string meccanica = mItem.NomeTraduzione;
                Byte tipo_tracciato = tipo_volantino;
                if (tipo_tracciato == 0)
                    tipo_tracciato = 1;

                string unita = "";
                if (flag_meccanica_unita)
                    unita = "_KgL";

                if (tipo_materiale == "sott")
                    meccanica = "sottocosto";

                string tipo_tema = tItem[keyTipo_tema].ToString();
                string tema = "";// tItem[keyTema].ToString();
                string ruolo = tItem[keyRuolo].ToString();
                string note_cat = tItem[keyNote_category].ToString();
                string sezione = tItem[keySezione].ToString();
                Int64 reparto = Int64.Parse(tItem[keyReparto].ToString());
                Int64 settore = Int64.Parse(tItem[keySettore].ToString());
                string recTipo_vol = tItem[keyTipo_volantino].ToString().ToLower();
                string codice_area = tItem[keyArea].ToString();
                // Int64 gruppo_siti = (Int64)tItem["Area.GruppoSiti"];
                decimal peso_totale = tItem[GLOBAL_VARIABLES.keyDescrPeso].ToDecimal();
                string um_fatt = tItem["unita_fatt"].ToString();
                decimal sconto_agenzia = tItem[keySconto_agenzia].ToDecimal();
                //string gramm = tItem[keyDescrizioniDescrizione4].ToString();
                string punti1 = tItem[keyPunti_1].ToString();
                string punti2 = tItem[keyPunti_2].ToString();
                string range1 = tItem[keyRange_1].ToString();
                string range2 = tItem[keyRange_2].ToString();
                string distintivita = tItem[keyDistintivita].ToString();
                string grammatura = tItem[keyDescrizioniDescrizione4].ToString();

                bool is_bassi_e_fissi = ((tipo_tema.ToLower().Contains("bass") && tipo_tema.ToLower().Contains("fiss")) || tipo_tema.ToLower().Contains("BeF")) ||
                    ((tema.Contains("bass") && tema.ToLower().Contains("fiss")) || tema.Contains("BeF")) ||
                    ruolo.ToLower().IndexOf("b&f") >= 0 ||
                    (note_cat.ToLower().Contains("bass") && note_cat.ToLower().Contains("fiss")) ||
                    sezione.ToLower().IndexOf("b&f") >= 0;

                #region controllo tema



                string sez = sezione != null ? sezione.ToLower() : "";

                if (tipo_tema != null && ((tipo_tracciato == 1 && tipo_materiale != "mz") || tipo_tracciato != 1))
                {
                    string tipo_tema_check = tipo_tema.ToLower();
                    string tema_check = tema.ToLower();

                    if (tipo_tracciato != 2 || (tipo_tracciato == 2 && tipo_materiale != "mz" && tipo_materiale != "fec"))
                    {
                        string sez_no_space = sez.ToNoSpacing().ToLower();

                        if (tipo_materiale == "mc")
                        {
                            //ATTENZIONE: regola inserita il 14/02/2022 a causa di un problema di liste PJ. Sicuramente da ritornarci!
                            tema = "_minicoll";
                        }
                        else if (tipo_tema_check.IndexOf("focus") >= 0 && tema_check.IndexOf("ffresc.local.") < 0)
                        {
                            if (tipo_materiale != "mc" &&
                                tipo_materiale != "bb" &&
                                tipo_tracciato != 3)
                            {
                                //Trovato focus
                                if (tema_check.IndexOf("s % d") >= 0
                                    && tipo_materiale != "fec" && tipo_materiale != "mc" && tipo_materiale != "bb")
                                {
                                    //Trovato sapori
                                    if (tipo_tracciato != 2)
                                        tema = "_sapori";
                                }
                                else if (tipo_tracciato == 1)
                                {
                                    if ((tema_check.Contains("puglia") ||
                                     tema_check.Contains("sicilia") ||
                                     tema_check.Contains("trentino") ||
                                     tema_check.Contains("fsicilia") ||
                                     tema_check.Contains("ftrent.a.adig") ||
                                     tema_check.Contains("emiliaromagn") ||
                                     tema_check.Contains("emilia")) && tipo_materiale != "mz")
                                    {
                                        tema = "_regionale";
                                    }
                                    else
                                        tema = "_focus";


                                    if (tipo_tema_check == "focus" &&
                                        (tema_check.IndexOf("fbuono dpaese") >= 0 ||
                                        (!is_bassi_e_fissi && sez != "" && sez.IndexOf("buono del paese") >= 0 &&
                            !sez.Contains("+buonodelpaese") &&
                            !sez.Contains("+tipico") &&
                            !sez.Contains(" + buono del paese") &&
                            !sez.Contains(" + tipico"))
                                        ))
                                    {
                                        //Trovato B. del paese
                                        tema = "_bdp";
                                    }
                                    else if (tipo_tema_check == "focus" &&
                                        (tema_check.IndexOf("fscelte benes") >= 0 ||
                                        (!is_bassi_e_fissi && sez.IndexOf("benessere") >= 0 && sez.IndexOf(" e benessere") < 0
                            && !sez_no_space.Contains("+benessere")
                            && !sez_no_space.Contains("+sceltedibenessere")
                            && !sez.Contains(" + scelte di benessere")
                            && !sez.Contains(" + benessere"))
                                        ))
                                    {
                                        //Trovato S. di benessere
                                        tema = "_sdb";
                                    }
                                }
                            }
                        }
                        else if (tipo_tracciato == 1 && !is_bassi_e_fissi && sez.IndexOf("buono del paese") >= 0 &&
                            !sez.Contains("+buonodelpaese") &&
                            !sez.Contains("+tipico") &&
                            !sez.Contains(" + buono del paese") &&
                            !sez.Contains(" + tipico"))
                        {
                            if (!tipo_tema_check.Contains("sottocosto") && !tema_check.Contains("sottocosto") &&
                                           !tema_check.Contains("_123"))
                            {
                                tema = "_bdp";
                            }
                        }
                        else if (tipo_tracciato == 1 && !is_bassi_e_fissi && sez != "" && sez.IndexOf("benessere") >= 0 && sez.IndexOf(" e benessere") < 0
                            && !sez_no_space.Contains("+benessere")
                            && !sez_no_space.Contains("+sceltedibenessere")
                            && !sez.Contains(" + scelte di benessere")
                            && !sez.Contains(" + benessere"))
                        {
                            if (!tipo_tema_check.Contains("sottocosto") && !tema_check.Contains("sottocosto") && !tema_check.Contains("_123"))
                            {
                                tema = "_sdb";
                            }
                        }
                        else if ((tipo_tema_check.IndexOf("mini coll") >= 0 ||
                            tipo_tema_check.IndexOf("minicoll") >= 0)
                            && tipo_materiale != "bb" &&
                            tipo_tracciato != 3)
                        {
                            tema = "_minicoll";
                        }
                        else if ((tipo_tema_check.IndexOf("extra bonus") >= 0 ||
                            tipo_tema_check.IndexOf("extrabonus") >= 0 ||
                            tipo_tema_check.IndexOf("punti extra") >= 0 ||
                            tipo_tema_check.IndexOf("puntiextra") >= 0 ||
                            sez.IndexOf("extra bonus") >= 0 ||
                            sez.IndexOf("extrabonus") >= 0 ||
                            sez.IndexOf("punti extra") >= 0 ||
                            sez.IndexOf("puntiextra") >= 0
                            )
                            && tipo_materiale != "mc")
                        {
                            tema = "_bonus";
                        }
                        else if (tipo_tema_check.IndexOf("parafarm") >= 0 ||
                            tipo_tema_check.IndexOf("pfarmacia") >= 0
                            && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                            tipo_tracciato != 3)
                        {
                            tema = "_parafarmacia";
                        }
                        else if ((tipo_tema_check.IndexOf("event") >= 0 || tema_check.IndexOf("ffresc.local.") >= 0) && tipo_tracciato == 1
                            && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                            tipo_tracciato != 3)
                        {
                            //Trovato evento
                            tema = "_evento";
                        }
                        else if (tipo_tema_check.IndexOf("ricorrenz") >= 0 && tipo_tracciato == 1
                            && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                            tipo_tracciato != 3)
                        {
                            //Trovato ricorrenza
                            tema = "_ricorrenza";
                        }

                        if (reparto == 86 && tipo_tracciato != 2)
                            tema = "_parafarmacia";
                    }

                    if (sez.IndexOf("sottocosto") >= 0
                        && tipo_materiale != "fec" && !recTipo_vol.Contains("fuori volantino"))
                    {
                        meccanica = "sottocosto";
                    }

                }


                if (tema.ToLower() == "msec.meta pr" /*//aggiunta condizione il 01/03/2017 alle 12:00 ->> */ && (meccanica_originale == "NM FID" || meccanica_originale == "NM Mix FID"))
                {
                    meccanica = "50sulSecondo";
                }

                if (
                    (tipo_tracciato == 1 && (tipo_materiale == "vol" || tipo_materiale == "ap")) ||
                    (tipo_tracciato == 2 && (tipo_materiale == "vol" || tipo_materiale == "ap"))
                    )
                {
                    if (tema.ToLower() == "1-2-3 euro" ||
                        tema.ToLower() == "m1-2-3 euro" ||
                        tema.ToLower() == "mfasce euro")
                    {
                        tema = "_123";
                    }
                }


                #endregion

                #region controllo regole

                //bool area_valida = dbAree.Where(a => a.GruppoSiti == gruppo_siti).Count() > 0;

                string regola = "";


                if (meccanica != "sottocosto")
                {

                    #region regola 50al50
                    //if (tItem.tracciati.promozione_50_al_50.HasValue && tItem.tracciati.promozione_50_al_50.Value)
                    //{
                    //Siamo nel caso 50 al 50
                    //ma devo verificare se il record rispetta la prommozione.
                    //CONAD deve ancora dare le regole precise, per il momento abbiamo solo supposto                    
                    if (tipo_tracciato != 2)
                    {
                        //VOL
                        if (sez.Contains("50 prodotti al 50%") ||
                            sez.Contains("50 prod.sconto 50%"))
                        {
                            result.grafica_50_al_50 = true;

                            if (meccanica == "PERCENTO_MM_ALL")
                            {
                                if (combinazione_pop != null)//&& combinazione_pop.DupFidelity)
                                {
                                    meccanica = "50al50Fid";
                                }
                                else
                                {
                                    meccanica = "50al50Norm";
                                }
                            }
                            else if (meccanica == "PERCENTO_FID_ALL")
                            {
                                if (lista_tracciato != null)
                                {
                                    //se è null siamo in importazione e non ci interessa effettuare questi passaggi

                                    var simili = lista_tracciato.Where(l => l[keySezione].ToString().ToLower().Contains("50 prodotti al 50%")).ToList();
                                    //this.ctx.Tracciatis.Include(i => i.TracciatiRecords).Where(t => t.Id == tItem.Id).FirstOrDefault()!.TracciatiRecords.Where(tr => tr.Sezione.ToLower().Contains("50 prodotti al 50%")).ToList();
                                    bool flag_all = false;
                                    bool flag_fid = false;
                                    foreach (Dictionary<string, object> item in simili)
                                    {
                                        string mecc = item[meccanica_origine].ToString();
                                        if (mecc.Contains("% MM ALL"))
                                            flag_all = true;
                                        if (mecc.Contains("% FID ALL"))
                                            flag_fid = true;

                                        if (flag_fid && flag_all)
                                            break;
                                    }

                                    if (flag_fid && !flag_all)
                                        meccanica = "50al50Fid";
                                }
                            }
                        }
                        else
                        {
                            if (meccanica == "PERCENTO_MM_ALL" &&
                                 tema.ToLower().IndexOf("m50prodsc50%") >= 0)
                            {
                                result.grafica_50_al_50 = true;

                                if (meccanica == "PERCENTO_MM_ALL")
                                {
                                    if (combinazione_pop != null)// && combinazione_pop.DupFidelity)
                                    {
                                        meccanica = "50al50Fid";
                                    }
                                    else
                                    {
                                        meccanica = "50al50Norm";
                                    }
                                }
                            }
                            else if (meccanica == "PERCENTO_FID_ALL" && (tema.ToLower().IndexOf("mt.prod.50%fi") >= 0 ||
                            tema.ToLower().IndexOf("m50pr.50%fid") >= 0 ||
                             tema.ToLower().IndexOf("m50prod.50%fi") >= 0)/*&& tItem.sconto_fidelity == 50*/)
                            {
                                result.grafica_50_al_50 = true;
                                //NOTA: m50prodsc50% NON varia nel caso di FID MA sullo script ID invece deve essere prevista la condizione
                                if (meccanica == "PERCENTO_FID_ALL")
                                    meccanica = "50al50Fid";
                            }
                        }
                    }
                    else
                    {
                        //POP
                        if (
                            sez.IndexOf("50 prodotti al 50%") >= 0 ||
                            sez.IndexOf("50 prod.sconto 50%") >= 0 ||
                                 sez.countStringIn("50") >= 2)
                        {
                            if (meccanica == "PERCENTO_MM_ALL")
                            {
                                result.grafica_50_al_50 = true;
                                meccanica = "50al50Norm";
                            }
                            else if (meccanica == "PERCENTO_FID_ALL")
                            {
                                result.grafica_50_al_50 = true;
                                //NOTA: m50prodsc50% NON varia nel caso di FID MA sullo script ID invece deve essere prevista la condizione
                                meccanica = "50al50Fid";
                            }
                        }

                    }

                    //}

                    #endregion

                    #region regola mercato

                    //Response.Write("Interpreto meccanica " + tipo_tracciato + "," + tema+"<br>");
                    if (tipo_tracciato == 1 &&
                        tema == "" &&
                        meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                        tipo_materiale != "mz" && tipo_materiale != "mc" && tipo_materiale != "bb")
                    {
                        //Response.Write("Reparto " + tItem.reparto + "<br>");
                        //Controllo dei reparti compresi nella regola
                        if (reparto == 25 ||
                            reparto == 27 ||
                            reparto == 29 ||
                            reparto == 31 ||
                            reparto == 33
                            )
                        {
                            regola = "_mercato";
                        }
                    }

                    #endregion

                    #region regola boxetto

                    //Controllo del gruppo sito con area 
                    if (meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                        /*(tipo_materiale != "mz" || tipo_tracciato == 2)
                        &&*/ tipo_materiale != "fec" && tipo_materiale != "mc" && tipo_materiale != "bb" &&
                            tipo_tracciato != 3)
                    {
                        //Ok il codice area corrisponde al suo relativo gruppo sito
                        //Cosa che deve SEMPRE tornare a meno che CONAD non commetta un errore
                        //nella scrittura del tracciato

                        if (
                            (codice_area.IndexOf("SA") == 2) &&
                            peso_totale == 1 &&
                            um_fatt.ToLower() == "peso" /*ATTENZIONE questa riga è stta aggiunta in data 21/02/2017 in seguito ad una regola rettificata da Laura sia per VOL che per POP*/
                            )
                        {
                            //Ok, l'area c'è
                            if (reparto == 25 /*&& (tItem.settore == 2501 || tItem.settore == 2503)*/)
                            {
                                //Ok il settore è quello considerato nella regola
                                regola += "_boxetto";
                            }
                        }
                    }

                    if (meccanica != "50al50Norm" && meccanica != "50al50Fid" &&
                        (codice_area.IndexOf("TO") == 2 ||
                        codice_area.IndexOf("SL") == 2 ||
                        codice_area.IndexOf("LA") == 2 ||
                        codice_area.IndexOf("EM") == 2 ||
                        codice_area.IndexOf("PI") == 2 ||
                        codice_area.IndexOf("LI") == 2) &&
                            (settore == 2507 || settore == 2505) && peso_totale == 1 &&
                            um_fatt.ToLower() == "peso" && tipo_tracciato != 3)
                    {
                        //if ((tipo_tracciato==1 && tipo_materiale!="mz") || tipo_tracciato != 1)

                        /* if (tipo_tracciato == 1 || (tipo_tracciato != 1 && tItem.settore == 2507 && codice_area.IndexOf("TO") == 2))*/
                        regola += "_boxetto";
                    }


                    #endregion

                    #region regola _ofalkg

                    if (peso_totale > 1 &&
                        tipo_tracciato != 3 &&
                        (tipo_tracciato != 1 || (tipo_tracciato == 1 && tipo_materiale != "mc" && tipo_materiale != "bb")) &&
                        (tipo_tracciato != 2 || (tipo_tracciato == 2 && tipo_materiale != "mc" && tipo_materiale != "bb"))
                        )
                    {
                        if (reparto == 33)
                        {
#if (OFALKG_ENALBED)

                            regola += "_ofalkg";
                            if (grammatura.IndexOf("-<br2>") < 0)
                            {
                                if (tipo_tracciato != 2)
                                    tItem[keyDescrizioniDescrizione4] = grammatura + "-<br2>al kg";
                                else
                                    tItem[keyDescrizioniDescrizione4] = grammatura + "-<br2>al kg";
                            }

#else

                            regola += "_ofaconf";
                            /*if (tItem.grammatura.IndexOf("-<br2>") < 0)
                            {
                                if (tipo_tracciato != 2)
                                    tItem.grammatura += "-<br2>al kg";
                                else
                                    tItem.grammatura += "-<br2>al Kg";
                            }*/

#endif

                        }
                    }

                    #endregion

                    #region regola prodalkg sir_sconto e boxetto

                    //Response.Write("tipo_tracciato... " + tipo_tracciato);


                    if (/*(*/tipo_tracciato == 1 /*|| tipo_materiale=="ap")*/ &&
                        /*areaApplicabile("aree_sirsconto", codice_area)*/
                        codice_area.IndexOf("LA") == 2)
                    {
                        //Response.Write(tItem.codice_referenza + " -  AREA " + codice_area);
                        if (meccanica == "TP_MM" && sconto_agenzia != 0)
                        {
                            if (reparto != 29 &&
                                        reparto != 31 &&
                                        reparto != 33 &&
                                        /*tItem.tracciati.area.ToLower()!="mgla" && tItem.tracciati.area.ToLower() != "cnla" &&
                                        tItem.tracciati.area.ToLower() != "ssla" && tItem.tracciati.area.ToLower() != "cyla" &&
                                        tItem.tracciati.area.ToLower() != "avla" && tItem.tracciati.area.ToLower() != "gsla" &&
                                        tItem.tracciati.area.ToLower() != "psla" && tItem.tracciati.area.ToLower() != "ipla" &&
                                        tItem.tracciati.area.ToLower() != "gssl" && tItem.tracciati.area.ToLower() != "mala" &&
                                        tItem.tracciati.area.ToLower() != "scla"*/
                                        codice_area.ToLower() != "mgla" && codice_area.ToLower() != "cnla" &&
                                        codice_area.ToLower() != "ssla" && codice_area.ToLower() != "cyla" &&
                                        codice_area.ToLower() != "avla" && codice_area.ToLower() != "gsla" &&
                                        codice_area.ToLower() != "psla" && codice_area.ToLower() != "ipla" &&
                                        codice_area.ToLower() != "gssl" && codice_area.ToLower() != "mala" &&
                                        codice_area.ToLower() != "scla")
                            {
                                meccanica = "sir_sconto";
                            }
                        }
                    }
                    else if (tipo_tracciato == 2)
                    {
                        //Response.Write("meccanica... " + meccanica);

                        if (meccanica == "TP_MM")
                        {
                            if (
                                sconto_agenzia != 0 &&
                                (meccanica != "50al50Norm" && meccanica != "50al50Fid")
                                )
                            {
                                if (combinazione_pop == null || (combinazione_pop != null/* && !combinazione_pop.DupFidelity*/))
                                {
                                    /*if (tItem.reparto != 29 &&
                                        tItem.reparto != 31 &&
                                        tItem.reparto != 33)
                                    {*/
                                    if (sconto_agenzia > 13.99m)
                                    {
                                        meccanica = "sir_sconto";
                                    }
                                    //}
                                }
                                else if (combinazione_pop != null/* && combinazione_pop.DupFidelity*/)
                                {
                                    /*if (tItem.reparto != 29 &&
                                        tItem.reparto != 31 &&
                                        tItem.reparto != 33)
                                    {*/
                                    if (regola.IndexOf("boxetto") >= 0)
                                    {
                                        if (sconto_agenzia >= 14)
                                        {
                                            meccanica = "sir_sconto";
                                        }
                                    }
                                    else if ((meccanica == "PERCENTO_MM_ALL" || meccanica == "TP_MM") &&
                                        um_fatt.ToLower() == "peso")
                                    {
                                        if (sconto_agenzia >= 14)
                                        {
                                            meccanica = "sir_sconto";
                                        }
                                    }
                                    else
                                    {
                                        //if (tItem.sconto_agenzia.Value >= 14)
                                        //{
                                        meccanica = "sir_sconto";
                                        //}
                                        /*}
                                        else if (tItem.peso_totale != 1)
                                        {
                                            meccanica = "sir_sconto";
                                        }*/
                                    }
                                }
                            }
                        }

                        /*if (tItem.codice_referenza == cod_ref_test)
                        {
                            Response.Write("Regola temporanea: " + regola + "<br>");
                            Response.Write("Meccanica temporanea: " + meccanica + "<br>");
                        }*/

                        #region regola cambiata il 14/08/2014 alle 16:01

                        ////Nuove regole inserite il 14/08/2014 alle 16:01
                        if (um_fatt.ToLower() == "peso"
                            && regola == "" &&
                            /*tipo_materiale != "fec" &&*/
                            tipo_materiale != "mc" &&
                            tipo_materiale != "bb")
                        {
                            if (/*areaApplicabile("aree_boxetto", codice_area)*/codice_area.IndexOf("SA") == 2 /*|| codice_area.IndexOf("LA") == 2*/)
                            {
                                if (reparto == 25 /*&& tItem.settore == 2501 || tItem.settore == 2503*/)
                                {
                                    regola = "_boxetto";
                                }
                                else
                                {
                                    if (combinazione_pop != null/* && combinazione_pop.DupFidelity*/)
                                    {
                                        regola = "_prodalkg";
                                        if (tipo_tracciato != 2)
                                            tItem[keyDescrizioniDescrizione4] = "-<br2>al kg";
                                        else
                                            tItem[keyDescrizioniDescrizione4] = "-<br2>al kg";
                                    }
                                }
                            }
                            else if (codice_area.IndexOf("TO") == 2 &&
                            settore == 2507 && peso_totale == 1 &&
                            um_fatt.ToLower() == "peso" && tipo_materiale == "mz")
                            {
                                regola = "_boxetto";
                            }
                            else
                            {
                                if (combinazione_pop != null /*&& combinazione_pop.DupFidelity*/)
                                {
                                    regola = "_prodalkg";
                                    if (tipo_tracciato != 2)
                                        tItem[keyDescrizioniDescrizione4] = "-<br2>al kg";
                                    else
                                        tItem[keyDescrizioniDescrizione4] = "-<br2>al kg";
                                }
                            }
                        }

                        #endregion


                    }

                    #endregion

                    #region controllo meccanica POP fidelity

                    if (tipo_tracciato == 2 && combinazione_pop != null /*&& combinazione_pop.DupFidelity*/)
                    {

                        if (regola.IndexOf("_boxetto") < 0 && regola.IndexOf("_prodalkg") < 0)
                        {
                            if ((reparto == 29 || reparto == 33) &&
                                    um_fatt.ToLower() == "pezzo" &&
                                    meccanica_originale == "TP MM" && sconto_agenzia != 0)
                            {
                                meccanica = "TP_FID";//meccanica = "sir_sconto"; //cambiato il 20/12/2018 su richiesta di Laura
                            }
                        }

                        if (tipo_materiale == "fec" &&
                            (reparto == 24 ||
                            /*tItem.reparto==25 ||*/
                            reparto == 27 ||
                            reparto == 29 ||
                            reparto == 31 ||
                            reparto == 33
                            ) &&
                            um_fatt.ToLower() == "peso"
                            )
                        {
                            regola = "_prodalkg";
                        }

                    }

                    #endregion

                    #region 1,2,3 EURO

                    if ((meccanica == "NM_MM" || meccanica == "NM_MIX_MM")
                        && tema == "_123" &&
                        peso_totale == 0.5M)
                    {
                        unita = "";
                    }
                    #endregion

                }

                if (tema == "_bonus" || tema == "_minicoll")
                {
                    if (punti2 == "")
                    {
                        if (meccanica == "PERCENTO_FID_ALL")
                        {
                            meccanica = "PUNTI_PERCENTO";
                        }
                        else if (meccanica == "TP_FID")
                        {
                            meccanica = "PUNTI_TP";
                        }
                    }
                    else if (punti2 != "" && range2 != "")
                    {
                        if (meccanica == "PERCENTO_FID_ALL")
                        {
                            meccanica = "PUNTI_MULTI_PERCENTO";
                        }
                        else if (meccanica == "TP_FID")
                        {
                            meccanica = "PUNTI_MULTI_TP";
                        }
                    }
                }


                #endregion

                #region regola distintività

                if (tipo_tracciato != 2 && (distintivita.ToLower().IndexOf("tipico") >= 0 || distintivita.ToLower().IndexOf("benessere") >= 0))
                {
                    if (tema != "_sdb" && tema != "_bdp" && tema != "_evento" && tema != "_regionale" &&
                        mItem.NomeTraduzione.IndexOf("NM_") < 0 &&
                        mItem.NomeTraduzione.IndexOf("PUNTI") < 0 &&
                        meccanica.IndexOf("50al50") < 0 &&
                        !tipo_tema.ToLower().Contains("sottocosto") && !tipo_tema.ToLower().Contains("eventi") &&
                        !tipo_tema.ToLower().Contains("bass") && !tipo_tema.ToLower().Contains("fiss") &&
                        tema.ToLower().IndexOf("bass") < 0 && tema.ToLower().IndexOf("fiss") < 0 &&
                        ruolo.ToLower().IndexOf("b&f") < 0 &&
                        note_cat.ToLower().IndexOf("bass") < 0 && note_cat.ToLower().IndexOf("fiss") < 0 &&
                        sezione.ToLower().IndexOf("b&f") < 0 && sezione.ToLower().IndexOf("vist") < 0 && sezione.ToLower().IndexOf("tv") < 0
                        )
                    {
                        if (distintivita.ToLower().IndexOf("tipico") >= 0)
                            tema = "_bdp";
                        else
                            tema = "_sdb";

                        regola = regola.Replace("_mercato", "");
                    }
                }

                #endregion

                result.NomeTraduzione = meccanica + unita + tema + regola;

                return result;
            }
            else
            {
                return result;
            }
        }

        protected bool areaApplicabile(string codice, string area_referenza)
        {
            try
            {
                string gs = dbAree.Where(a => a.Area == area_referenza).FirstOrDefault().GruppoSiti.ToString();

                string val = "";// this.ctx.Settings.Where(s => s.Codice == codice).FirstOrDefault().Valore;
                string[] canali = val.Split(',');

                foreach (string canale in canali)
                {
                    //Response.Write("#" + canale.Replace(" ", "") + "# = " + area_referenza);
                    if (canale.Replace(" ", "") == gs)
                    {
                        return true;
                    }
                }

            }
            catch (Exception ex)
            {
                ex.ToString();
            }

            return false;
        }

        protected KeyValuePair<string, object> getDicituraSuReparto(Dictionary<string, object> oItem, string meccanica_interpretata, string tipo_materiale, string area)//, PopCombinazioni combinazione=null)
        {
            string meccanica_origine = Edro21Context.Meta.meccanica_origine;
            string keyGruppo_siti = Edro21Context.Meta.gruppo_siti;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyTema = Edro21Context.Meta.tema;
            string keySettore = Edro21Context.Meta.settore;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;

            Int64 reparto = Int64.Parse(oItem[keyReparto].ToString());
            Int64 settore = Int64.Parse(oItem[keySettore].ToString());
            Int64 gruppo_siti = 0;
            if (oItem.ContainsKey(keyGruppo_siti))
                gruppo_siti = (Int64)oItem[keyGruppo_siti];
            string tema = oItem[keyTema].ToString().ToLower();
            string note_cat = oItem[keyNote_category].ToString();

            string mecc = oItem[meccanica_origine].ToString();
            Meccanica mItem = dbMeccaniche.Where(m => m.NomeOrigine == mecc).FirstOrDefault();

            string titolo = "";

            if (mItem != null)
            {
                string meccanica = mItem.NomeTraduzione;

                string formato = "";
                //if (combinazione != null)
                //formato = combinazione.IdFormatoNavigation.Nome;

                bool is_123 = (tema == "1-2-3 euro" ||
                    tema == "m1-2-3 euro" ||
                    tema == "mfasce euro");

                bool is_grmarche50 = (tema == "mgrmarche50%" || tema == "grmarche");

                if (reparto == 33)
                {

                    if (tipo_materiale == "vol" || tipo_materiale == "ap"
                        || tipo_materiale == "mz" || tipo_materiale == "mc"
                        || tipo_materiale == "bb" || tipo_materiale == "manif"
                        || (tipo_materiale == "fec" && formato == "70x100")
                        || (tipo_materiale == "sottocosto" && formato == "50x70"))
                    {
                        if (settore == 3309)
                        {
                            titolo = "Reparto Piante & Fiori";
                        }
                        else
                        {
                            titolo = "Reparto Frutta & Verdura";
                        }
                    }
                }
                else if (reparto == 29)
                {
                    if (tipo_materiale == "vol" || tipo_materiale == "ap"
                        || tipo_materiale == "mz" || tipo_materiale == "mc"
                        || tipo_materiale == "bb" || tipo_materiale == "manif"
                        || (tipo_materiale == "fec" && formato == "70x100")
                        || (tipo_materiale == "sottocosto" && formato == "50x70"))
                    {

                        titolo = "Reparto Macelleria";
                    }
                }
                else if (reparto == 31)
                {
                    if (area.IndexOf("CY") >= 0)
                    {
                        string note = note_cat.ToLower();
                        if (note.Contains("pesch") && note.Contains("ass"))
                        {
                            titolo = "NEI PUNTI VENDITA CON REPARTO PESCHERIA ASSISTITA";
                        }
                    }
                    else
                    {
                        if (tipo_materiale == "vol" || tipo_materiale == "ap")
                        {
                            if (gruppo_siti == 474 ||
                                gruppo_siti == 768 ||
                                gruppo_siti == 473 ||
                                gruppo_siti == 472 ||
                                gruppo_siti == 157 ||
                                gruppo_siti == 205 ||
                                gruppo_siti == 156 ||
                                gruppo_siti == 138 ||
                                gruppo_siti == 1321 ||
                                gruppo_siti == 1323 ||
                                gruppo_siti == 1322 ||
                                gruppo_siti == 412 ||
                                gruppo_siti == 414 ||
                                gruppo_siti == 411 ||
                                gruppo_siti == 1324 ||
                                gruppo_siti == 1328 ||
                                gruppo_siti == 1329 ||
                                gruppo_siti == 1330 ||
                                gruppo_siti == 709 ||
                                gruppo_siti == 138 ||
                                gruppo_siti == 157 ||
                                gruppo_siti == 891 ||
                                gruppo_siti == 205 ||
                                gruppo_siti == 156 ||
                                gruppo_siti == 333 ||
                                gruppo_siti == 111 ||
                                gruppo_siti == 222 ||
                                gruppo_siti == 9999 ||
                                gruppo_siti == 8888 ||
                                gruppo_siti == 7777 ||
                                gruppo_siti == 5550 ||
                                gruppo_siti == 4450 ||
                                gruppo_siti == 3350 ||
                                gruppo_siti == 5540 ||
                                gruppo_siti == 4440 ||
                                gruppo_siti == 3340
                                )
                            {

                                titolo = "Reparto Pescheria";
                            }
                            else
                            {
                                titolo = "Nei punti vendita con Reparto Pescheria";
                            }
                        }

                        if (tipo_materiale == "mz" || tipo_materiale == "mc"
                            || tipo_materiale == "bb" || tipo_materiale == "manif"
                            || (tipo_materiale == "fec" && formato == "70x100")
                            || (tipo_materiale == "sottocosto" && formato == "50x70"))
                        {
                            titolo = "Reparto Pescheria";
                        }
                    }
                }
                else if (reparto == 27)
                {
                    if (tipo_materiale == "vol" || tipo_materiale == "ap"
                        || tipo_materiale == "mz" || tipo_materiale == "mc"
                        || tipo_materiale == "bb" || tipo_materiale == "manif"
                        || (tipo_materiale == "fec" && formato == "70x100")
                        || (tipo_materiale == "sottocosto" && formato == "50x70"))
                    {
                        if (settore == 2709 ||
                            settore == 2705 ||
                            settore == 2707 ||
                            settore == 2701 ||
                            settore == 2703 ||
                            settore == 2711 ||
                            settore == 2715 ||
                            settore == 2717 ||
                            settore == 2719 ||
                            settore == 2721 ||
                            settore == 2723 ||
                            settore == 2725 ||
                            settore == 2713)
                        {
                            titolo = "Reparto Forno";
                        }
                        /*
                        else
                        {
                            titolo = "Nei punti vendita con Reparto Forno";
                        }*/
                    }
                }
                else if (reparto == 25)
                {

                    if (tipo_materiale == "vol" || tipo_materiale == "ap"
                        || tipo_materiale == "mz" || tipo_materiale == "mc"
                        || tipo_materiale == "bb" || tipo_materiale == "manif"
                        || (tipo_materiale == "fec" && formato == "70x100")
                        || (tipo_materiale == "sottocosto" && formato == "50x70"))
                    {

                        titolo = "Reparto Gastronomia";// "Prodotti al banco Gastronomia";

                    }
                }
                else if (reparto == 21)
                {
                    if (tipo_materiale == "vol" || tipo_materiale == "ap"
                        || tipo_materiale == "mz" || tipo_materiale == "mc"
                        || tipo_materiale == "bb" || tipo_materiale == "manif"
                        || (tipo_materiale == "fec" && formato == "70x100")
                        || (tipo_materiale == "sottocosto" && formato == "50x70"))
                    {
                        titolo = "Reparto Surgelati";
                    }
                }
            }

            return new KeyValuePair<string, object>("Reparto_" + reparto, titolo);
        }

        protected string getTipoRange(Dictionary<string, object> _ref, string range)
        {
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;


            if (range == "")
                return "";

            int quantita = 0;
            Int32.TryParse(range, out quantita);

            string gramm = _ref[keyDescrizioniDescrizione4].ToString();
            if (gramm.ToLower().Contains("conf."))
                return "conf.";

            if (quantita == 1)
            {
                return "pezzo";
            }

            return "pezzi";
        }

        protected string getTipoPunti(string tipologia, string str_quantita)
        {
            if (str_quantita == "")
                return "";

            Int64 quantita = 0;
            Int64.TryParse(str_quantita, out quantita);



            //if (tipologia.ToLower() == "bollini")
            //{
            //    if (quantita == 1)
            //        return "bollino";

            //    return tipologia.ToLower();
            //}
            //else if (tipologia.ToLower() == "bollino")
            //{
            //    if (quantita > 1)
            //        return "bollini";

            //    return tipologia.ToLower();
            //}
            if (tipologia.ToLower() == "bollini")
            {
                if (quantita == 1)
                    return "Superbollino";

                return "Superbollini";//tipologia.ToLower();
            }
            else if (tipologia.ToLower() == "bollino")
            {
                if (quantita > 1)
                    return "Superbollini";

                return "Superbollino";//tipologia.ToLower();
            }
            if (tipologia.ToLower() == "bolloni")
            {
                if (quantita == 1)
                    return "Bollone";
            }
            else if (tipologia.ToLower() == "bollone")
            {
                if (quantita > 1)
                    return "Bolloni";
            }
            else if (tipologia.ToLower() == "cartoline")
            {
                if (quantita == 1)
                    return "Cartolina";
            }
            else if (tipologia.ToLower() == "cartolina")
            {
                if (quantita > 1)
                    return "Cartoline";
            }
            else if (tipologia.ToLower() == "card")
            {
                if (quantita > 1)
                    return "Cards";
            }
            else if (tipologia.ToLower() == "cards")
            {
                if (quantita == 1)
                    return "Card";
            }
            else if (tipologia.ToLower() == "bustina")
            {
                if (quantita > 1)
                    return "Bustine";
            }
            else if (tipologia.ToLower() == "bustine")
            {
                if (quantita == 1)
                    return "Bustina";
            }
            else if (tipologia.ToLower() == "figurina")
            {
                if (quantita > 1)
                    return "Figurine";
            }
            else if (tipologia.ToLower() == "figurine")
            {
                if (quantita == 1)
                    return "Figurina";
            }
            else if (tipologia.ToLower() == "punti fiore" || tipologia.ToLower() == "punti fiori")
            {
                if (quantita == 1)
                    return "Punto Fiore";
                else
                    return "Punti Fiore";
            }
            else if (tipologia.ToLower() == "punto fiore" || tipologia.ToLower() == "punto fiori")
            {
                if (quantita > 1)
                    return "Punti Fiore";
                else
                    return "Punto Fiore";
            }

            if (tipologia.Length > 1)
            {
                string[] tipologia_split = tipologia.Split(' ');
                string str_composta = "";
                for (int z = 0; z < tipologia_split.Length; z++)
                {
                    string part = tipologia_split[z];
                    if (part.Length > 1)
                        str_composta += (z > 0 ? " " : "") + part[0].ToString().ToUpper() + part.Substring(1).ToString().ToLower();
                }

                return str_composta;
            }
            else
            {
                if (tipologia == "")
                    return "TipoP ERROR";
                else
                    return tipologia;
            }
        }

        protected List<Dictionary<string, string>> getLoghiEBolli(Dictionary<string, object> oItem, string[] descrizioni, Ordinamento gItem)
        {
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyTema = Edro21Context.Meta.tema;
            string keySezione = Edro21Context.Meta.sezione;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyNote_category = Edro21Context.Meta.note_category;
            string KeyAreaCodice = Edro21Context.Meta.AreaCodice;

            //prodotto_conad


            //LOGO CONAD
            //LOGO CONAD IL BIOLOGICO
            //LOGO CONAD PERCORSO QUALITà
            //LOGO SAPORI E DINTORNI CONAD
            //LOGO PIACERSI CONAD
            //LOGO CONAD KIDS    
            //LOGO CONAD VERSO NATURA BIO
            //LOGO CONAD VERSO NATURA EQUO
            //LOGO CONAD VERSO NATORE ECO
            //LOGO CONAD VERSO NATURA VEG

            //tipo_logo
            //LOGO DOP
            //LOGO IGP

            //selezione_conad
            //LOGO SELEZIONE

            //logo_ori
            //ORI DI TOSCANA
            //ORI DEL LAZIO
            //ORI DI SARDEGNA
            //ORI DEL MAR TIRRENO

            //logo_focus
            //Agriqualita

            string prodotto_conad = "";
            string tipo_logo = "";
            string logo_ori = "";
            string selezione_conad = "";
            string logo_focus = "";
            string logo_in_tv = "";
            string logo_carne = "";
            string logo_pesce = "";
            string logo_bandiera_it = "";

            string logo_attributo_it = "";




            List<Dictionary<string, string>> loghi_e_bolli = new List<Dictionary<string, string>>();

            loghi_e_bolli.Add(new Dictionary<string, string>() { { "selezione_conad", selezione_conad } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "tipo_logo", tipo_logo } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "prodotto_conad", prodotto_conad } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_focus", logo_focus } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_ori", logo_ori } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_intv", logo_in_tv } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_carne", logo_carne } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_pesce", logo_pesce } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_bandiera_it", logo_bandiera_it } });
            loghi_e_bolli.Add(new Dictionary<string, string>() { { "logo_attributo_it", logo_attributo_it } });

            return loghi_e_bolli;

        }

        protected Dictionary<string, string> getLoghiEBolliNew(Dictionary<string, object> oItem, string[] descrizioni, Ordinamento gItem, int tipo_lavorazione, List<FicoContextField> promoContext, FicoRuntimeKit kit, string codiceTipoExport, List<Dictionary<string, object>> myGroup, string sigla_formato = "", string canale = "", string area = "")
        {
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyTema = Edro21Context.Meta.tema;
            string keySezione = Edro21Context.Meta.sezione;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyNote_category = Edro21Context.Meta.note_category;
            string KeyAreaCodice = Edro21Context.Meta.AreaCodice;
            string key_combinazioneAssegnata = Edro21Context.Meta.keyCombinazioneAssegnata;
            string key_distintivita = Edro21Context.Meta.distintivita;
            string keyScattoCodiceGruppo = Edro21Context.Meta.ScattoCodiceGruppo;
            string keyRefCodice = Edro21Context.Meta.ReferenzaCodice;
            string keyDescrizioniDescrizione1 = Edro21Context.Meta.DescrizioniDescrizione1;
            string keyDescrizioniDescrizione2 = Edro21Context.Meta.DescrizioniDescrizione2;
            string keyDescrizioniDescrizione3 = Edro21Context.Meta.DescrizioniDescrizione3;
            string keyDescrizioniDescrizione4 = Edro21Context.Meta.DescrizioniDescrizione4;

            string keyDescrizioniDescrizione1Tracciato = Edro21Context.Meta.DescrizioniDescrizione1Tracciato;
            string keyDescrizioniDescrizione2Tracciato = Edro21Context.Meta.DescrizioniDescrizione2Tracciato;
            string keyDescrizioniDescrizione3Tracciato = Edro21Context.Meta.DescrizioniDescrizione3Tracciato;
            string keyDescrizioniDescrizione4Tracciato = Edro21Context.Meta.DescrizioniDescrizione4Tracciato;



            //prodotto_conad

            //LOGO CONAD
            //LOGO CONAD IL BIOLOGICO
            //LOGO CONAD PERCORSO QUALITà
            //LOGO SAPORI E DINTORNI CONAD
            //LOGO PIACERSI CONAD
            //LOGO CONAD KIDS    
            //LOGO CONAD VERSO NATURA BIO
            //LOGO CONAD VERSO NATURA EQUO
            //LOGO CONAD VERSO NATORE ECO
            //LOGO CONAD VERSO NATURA VEG

            //tipo_logo
            //LOGO DOP
            //LOGO IGP

            //selezione_conad
            //LOGO SELEZIONE

            //logo_ori
            //ORI DI TOSCANA
            //ORI DEL LAZIO
            //ORI DI SARDEGNA
            //ORI DEL MAR TIRRENO

            //logo_focus
            //Agriqualita

            string prodotto_conad = "";
            string sfondo = "";
            string tipo_logo = "";
            string logo_ori = "";
            string selezione_conad = "";
            string logo_focus = "";
            string logo_in_tv = "";
            string logo_carne = "";
            string logo_pesce = "";
            string logo_bandiera_it = "";

            string logo_attributo_it = "";
            string logo_parmigiano = "";

            var temaContesto = cercaChiaveContesto("tema", promoContext);

            Dictionary<string, string> loghi_e_bolli = new Dictionary<string, string>()
            {
            };

            if (oItem != null)
            {

                string nota_category = oItem[keyNote_category].ToString().ToLower();
                string tema = oItem[keyTema].ToString().ToLower();
                string tipo_tema = oItem[keyTipo_tema].ToString().ToLower();
                string ruolo = oItem[keyRuolo].ToString().ToLower();
                string sezione = oItem[keySezione].ToString().ToLower();
                Int64 reparto = Int64.Parse(oItem[keyReparto].ToString());

                if (oItem["Referenza.Codice"].ToString() == "6050479")
                {
                    Debug.WriteLine("");
                }

                //Console.WriteLine("Sezione: "+sezione);

                if (sezione.ToUpper() == "B&F RICHIAMO VOLANTINO")
                {
                    Console.WriteLine("Richiamo volantino: " + sezione.ToUpper());

                    return loghi_e_bolli;
                }

                //Logger.Log("Contiene territorialita? " + oItem.ContainsKey(Meta.territorialita));
                if (oItem.ContainsKey(Meta.territorialita))
                {
                    //Logger.Log("Valore territorialita: " + oItem[Meta.territorialita]);

                }

                if (oItem.ContainsKey(Meta.territorialita) && oItem[Meta.territorialita].ToString().ToLower().Contains("inostriori"))
                {
                    if (oItem[Meta.territorialita].ToString().Contains("_SP"))
                    {
                        loghi_e_bolli.Add("inostriori", "INOSTRIORI_generico");
                    }
                    else
                    {
                        loghi_e_bolli.Add("inostriori", oItem[Meta.territorialita].ToString().ToUpper() + (oItem[keyReparto].ToString() == "31" && area != "PI" && area != "AOSTA" ? "_PESCE" : "") + (temaContesto.ToUpper() == "LOC" ? " LOC" : " VOL"));
                    }

                }

                if (oItem.ContainsKey(Meta.territorialita) && oItem[Meta.territorialita].ToString().ToLower().Contains("territorio"))
                {
                    //loghi_e_bolli.Add("territorio", "TERRITORIO");

                    if (oItem[Meta.territorialita].ToString().Contains("_SP"))
                    {
                        loghi_e_bolli.Add("territorio", "TERRITORIO_generico");
                    }
                    else
                    {
                        loghi_e_bolli.Add("territorio", oItem[Meta.territorialita].ToString().ToUpper() + (oItem[keyReparto].ToString() == "31" && area != "PI" && area != "AOSTA" ? "_PESCE" : "") + (temaContesto.ToUpper() == "LOC" ? " LOC" : " VOL"));
                    }
                }


                if (oItem[key_combinazioneAssegnata].ToString().ToLower().Contains("_sdb") && tipo_lavorazione == 1)
                {
                    //Console.WriteLine("Trovato SDB per articolo " + oItem[keyRefCodice].ToString());
                    sfondo = "sfondo_sdb";
                    loghi_e_bolli.Add("sdb", "Logo_SDB");

                }

                if (oItem[key_combinazioneAssegnata].ToString().ToLower().Contains("_bdp") && tipo_lavorazione == 1)
                {
                    //Console.WriteLine("Trovato BDP per articolo " + oItem[keyRefCodice].ToString());
                    loghi_e_bolli.Add("bdp", "Logo_BDP");
                    sfondo = "sfondo_bdp";
                }


                string brand = "";
                if (descrizioni.Length > 2/*oItem.brand != null*/)
                    brand = descrizioni[1].ToLower();//.Replace(Environment.NewLine, "");// oItem.brand.ToLower();

                string desc1 = "";
                if (descrizioni.Length > 0/* oItem.descrizione_1 != null*/)
                    desc1 = descrizioni[0].ToLower();//.Replace(Environment.NewLine, "");/*oItem.descrizione_1.ToLower()*/;

                string gusto = "";
                if (descrizioni.Length > 1/* oItem.tipo != null*/)
                    gusto = descrizioni[2].ToLower();//.Replace(Environment.NewLine, "");// oItem.tipo.ToLower();


                bool basso_fisso = ((tipo_tema.Contains("bass") && tipo_tema.Contains("fiss")) || (tipo_tema.Contains("bef") && !tipo_tema.Contains("befana"))) ||
    ((tema.Contains("bass") && tema.Contains("fiss")) || (tema.Contains("bef") && !tema.Contains("befana"))) ||
    (ruolo.Contains("b&f")) ||
    (nota_category.Contains("bass") && nota_category.Contains("fiss"));

                if (!basso_fisso && sezione != null && tipo_lavorazione == 1)
                    basso_fisso = sezione.Contains("b&f") || (sezione.Contains("bass") && sezione.Contains("fiss"));

                if (basso_fisso && (tipo_tema.Contains("focus") || sezione.Contains("focus")) && tipo_lavorazione == 1)
                    loghi_e_bolli.Add("logo_BassieFissi", "logo_BassieFissi");

                if (brand.Contains("conad"))
                {
                    if (gusto.ToNoSpacing().Contains("ilbiologico") || desc1.ToNoSpacing().Contains("ilbiologico") || brand.ToNoSpacing().Contains("ilbiologico"))
                        prodotto_conad = "conad_bio";
                    else if ((gusto.Contains("sapori&dintorni") || desc1.Contains("sapori&dintorni") || brand.Contains("sapori&dintorni")) &&
                        (gusto.Contains("percorso qualità") || desc1.Contains("percorso qualità") || brand.Contains("percorso qualità")))
                        prodotto_conad = "conad_saporidintorniPQ";
                    else if ((gusto.Contains("sapori&idee") || desc1.Contains("sapori&idee") || brand.Contains("sapori&idee")) &&
                        (gusto.Contains("percorso qualità") || desc1.Contains("percorso qualità") || brand.Contains("percorso qualità")))
                        prodotto_conad = "conad_saporiideePQ";
                    else if (gusto.ToNoSpacing().Contains("percorsoqualità") || desc1.ToNoSpacing().Contains("percorsoqualità") || brand.ToNoSpacing().Contains("percorsoqualità"))
                        prodotto_conad = "conad_cpq";
                    else if (gusto.Contains("sapori&dintorni") || desc1.Contains("sapori&dintorni") || brand.Contains("sapori&dintorni"))
                        prodotto_conad = "conad_saporidintorni";
                    else if (gusto.Contains("sapori&idee") || desc1.Contains("sapori&idee") || brand.Contains("sapori&idee"))
                        prodotto_conad = "conad_saporiidee";
                    else if (gusto.Contains("piacersi") || desc1.Contains("piacersi") || brand.Contains("piacersi"))
                    {
                        if (!(tipo_tema.Contains("focus") || sezione.Contains("focus")))
                        {
                            prodotto_conad = "conad_piacersi";
                        }
                    }
                    else if ((gusto.Contains("alimentum") || desc1.Contains("alimentum") || brand.Contains("alimentum")) && (gusto.ToNoSpacing().Contains("senzalattosio") || desc1.ToNoSpacing().Contains("senzalattosio") || brand.ToNoSpacing().Contains("senzalattosio")))
                    {
                        //if (!gusto.ToNoSpacing().Contains("senzaglutine") && !desc1.ToNoSpacing().Contains("senzaglutine") && !brand.ToNoSpacing().Contains("senzaglutine"))
                        List<int> leader1_list = new int[] { gusto.ToNoSpacing().IndexOf("senzalattosio"), desc1.ToNoSpacing().IndexOf("senzalattosio"), brand.ToNoSpacing().IndexOf("senzalattosio") }.ToList();
                        List<int> leader2_list = new int[] { gusto.ToNoSpacing().IndexOf("senzaglutine"), desc1.ToNoSpacing().IndexOf("senzaglutine"), brand.ToNoSpacing().IndexOf("senzaglutine") }.ToList();
                        int leader1 = leader1_list.Where(l => l >= 0).OrderBy(l => l).FirstOrDefault();
                        int leader2 = leader2_list.Where(l => l >= 0).OrderBy(l => l).FirstOrDefault();
                        if (leader2_list.Where(l => l >= 0).OrderBy(l => l).Count() == 0 || leader1 < leader2)
                            prodotto_conad = "conad_aslattosio";
                        else
                            prodotto_conad = "conad_asglutine";
                        //else
                        //prodotto_conad = "logo";
                    }
                    else if ((gusto.Contains("alimentum") || desc1.Contains("alimentum") || brand.Contains("alimentum")) && (gusto.ToNoSpacing().Contains("senzaglutine") || desc1.ToNoSpacing().Contains("senzaglutine") || brand.ToNoSpacing().Contains("senzaglutine")))
                    {
                        prodotto_conad = "conad_asglutine";
                    }



                    //else if (gusto.Contains("kids") || desc1.Contains("kids") || brand.Contains("kids"))
                    //prodotto_conad = "kids";
                    //else if (gusto.ToNoSpacing().Contains("versonaturaequo") || desc1.ToNoSpacing().Contains("versonaturaequo") || brand.ToNoSpacing().Contains("versonaturaequo"))
                    //    prodotto_conad = "vnequo";
                    //else if (gusto.ToNoSpacing().Contains("versonaturaeco") || desc1.ToNoSpacing().Contains("versonaturaeco") || brand.ToNoSpacing().Contains("versonaturaeco"))
                    //    prodotto_conad = "vneco";
                    //else if (gusto.ToNoSpacing().Contains("versonaturaveg") || desc1.ToNoSpacing().Contains("versonaturaveg") || brand.ToNoSpacing().Contains("versonaturaveg"))
                    //    prodotto_conad = "vnveg";
                    //else if (gusto.ToNoSpacing().Contains("versonaturabio") || desc1.ToNoSpacing().Contains("versonaturabio") || brand.ToNoSpacing().Contains("versonaturabio"))
                    //    prodotto_conad = "vnbio";
                    else if ((gusto.ToNoSpacing().Contains("versonatura") || desc1.ToNoSpacing().Contains("versonatura") || brand.ToNoSpacing().Contains("versonatura")) && brand.ToNoSpacing().Contains("conad"))
                    {

                        prodotto_conad = "conad_vn";
                        if (!(tipo_tema.Contains("focus") || sezione.Contains("focus")))
                        {
                            if (sfondo == "")
                            {
                                sfondo = "sfondo_vn";
                            }
                        }

                    }
                    else if (brand.Contains("conad") && (gusto.Contains("parafarmacia") || desc1.Contains("parafarmacia") || brand.Contains("parafarmacia")))
                        prodotto_conad = "conad_parafarmacia";
                    else if (gusto.Contains("11 paralleli") || desc1.Contains("11 paralleli") || brand.Contains("11 paralleli"))
                        prodotto_conad = "conad_11p";
                    else if (gusto.Contains("baby") || desc1.Contains("baby") || brand.Contains("baby"))
                        prodotto_conad = "conad_baby";
                    else if (gusto.Contains("essentiae lab") || desc1.Contains("essentiae lab") || brand.Contains("essentiae lab"))
                        prodotto_conad = "conad_essentiae_LAB";
                    else if (gusto.Contains("essentiae") || desc1.Contains("essentiae") || brand.Contains("essentiae"))
                        prodotto_conad = "conad_essentiae";
                    else if (gusto.Contains("petfriends plus") || desc1.Contains("petfriends plus") || brand.Contains("petfriends plus"))
                        prodotto_conad = "conad_petfrplus";
                    else if (gusto.Contains("petfriends") || desc1.Contains("petfriends") || brand.Contains("petfriends"))
                        prodotto_conad = "conad_PetFr";
                    else
                        prodotto_conad = "conad_logo";
                }

                bool dop_in_gusto = false;
                if (gusto.Contains("dop"))
                {
                    int inx = gusto.IndexOf("dop");

                    bool flag = false;

                    if (inx + 3 < gusto.Length)
                    {
                        if (gusto[inx + 3] != ' ' && gusto[inx + 3] != '\n' && gusto[inx + 3] != '\r')
                        {
                            flag = true;
                        }
                    }

                    if (inx > 0 && gusto[inx - 1] != ' ' && gusto[inx - 1] != '\n' && gusto[inx - 1] != '\r')
                    {
                        flag = true;
                    }

                    if (!flag)
                        dop_in_gusto = true;// tipo_logo = "dop";
                }

                if (tipo_logo == "" && !dop_in_gusto && desc1.Contains("dop") && reparto != 3)
                {
                    int inx = desc1.IndexOf("dop");

                    bool flag = false;

                    if (inx + 3 < desc1.Length)
                    {
                        if (desc1[inx + 3] != ' ' && desc1[inx + 3] != '\n' && desc1[inx + 3] != '\r')
                        {
                            flag = true;
                        }
                    }

                    if (inx > 0 && desc1[inx - 1] != ' ' && desc1[inx - 1] != '\n' && desc1[inx - 1] != '\r')
                    {
                        flag = true;
                    }

                    if (!flag)
                        tipo_logo = "dop";
                }

                if (tipo_logo == "" &&
                    ((!gusto.Contains("igp") && desc1.Contains("igp") && reparto != 3) ||
                    (gusto.Contains("igp") && (gusto.Contains("chianina") || desc1.Contains("chianina")) && brand.Contains("sapori&dintorni")))
                    )
                    tipo_logo = "igp";


                if (desc1.Contains("agriqualità") || brand.Contains("agriqualità"))
                    logo_focus = "Logo_Agriqualità";


                if (brand.Contains(" ori") || nota_category.Contains(" ori") ||
                    brand.Contains("\nori") || nota_category.Contains("\nori") ||
                    brand.Contains("\rori") || nota_category.Contains("\rori"))
                {
                    if (/*desc1.Contains("ori di toscana") ||*/
                    brand.Contains("ori di toscana") ||/*
                gusto.Contains("ori di toscana") ||*/
                        nota_category.Contains("ori di toscana"))
                    {
                        if (
                            !nota_category.stringIsPartOfABiggerString("ori di toscana"))
                        {
                            logo_ori = "toscana";
                        }
                    }
                    else if (/*desc1.Contains("ori del lazio") ||*/
                         brand.Contains("ori del lazio") ||/*
                    gusto.Contains("ori del lazio") ||*/
                            nota_category.Contains("ori del lazio"))
                    {
                        if (/*!stringIsPartOfABiggerString(desc1, "ori del lazio") &&
                    !stringIsPartOfABiggerString(brand, "ori del lazio") &&
                    !stringIsPartOfABiggerString(gusto, "ori del lazio") &&*/
                            !nota_category.stringIsPartOfABiggerString("ori del lazio"))
                        {
                            logo_ori = "lazio";
                        }
                    }
                    else if (/*desc1.Contains("ori di sardegna") ||*/
                         brand.Contains("ori di sardegna") ||/*
                    gusto.Contains("ori di sardegna") ||*/
                            nota_category.Contains("ori di sardegna"))
                    {
                        if (/*!stringIsPartOfABiggerString(desc1, "ori di sardegna") &&
                    !stringIsPartOfABiggerString(brand, "ori di sardegna") &&
                    !stringIsPartOfABiggerString(gusto, "ori di sardegna") &&*/
                            !nota_category.stringIsPartOfABiggerString("ori di sardegna"))
                        {
                            logo_ori = "sardegna";
                        }

                    }
                    else if (
                         brand.Contains("ori del piemonte") ||
                            nota_category.Contains("ori del piemonte"))
                    {
                        if (
                            !nota_category.stringIsPartOfABiggerString("ori del piemonte"))
                        {
                            logo_ori = "piemonte";
                        }

                    }
                    else if ((desc1.Contains("ori") && desc1.Contains("tirreno")) ||
                             (brand.Contains("ori") && brand.Contains("tirreno")) ||
                            (gusto.Contains("ori") && gusto.Contains("tirreno")) ||
                            (nota_category.Contains("ori") && nota_category.Contains("tirreno")) &&
                        reparto == 31)
                    {
                        logo_ori = "tirreno";
                    }
                    else if (brand.Contains("ori di liguria") ||
                            nota_category.Contains("ori di liguria") ||
                            brand.Contains("ori della liguria") ||
                            nota_category.Contains("ori della liguria"))
                    {
                        logo_ori = "liguria";
                    }
                    else if (brand.Contains("ori della valle d'aosta") ||
                            nota_category.Contains("ori della valle d'aosta") ||
                            brand.Contains("ori della val d'aosta") ||
                            nota_category.Contains("ori della val d'aosta"))
                    {
                        logo_ori = "valledaosta";
                    }
                    else if (brand.Contains("ori dell'emilia") ||
                    nota_category.Contains("ori dell'emilia"))
                    {
                        logo_ori = "emilia";
                    }
                }

                if (gusto.Contains("selezione conad") && tipo_lavorazione == 1)
                    selezione_conad = "logo_selezione";

                if (/*(nota_category.Contains("tv") && nota_category.Contains("visto")) ||*/
                    (tema.ToLower().Contains("tv") && tema.ToLower().Contains("vist")) ||
                    (sezione.ToLower().Contains("tv") && sezione.ToLower().Contains("vist")) ||
                    (tipo_tema.ToLower().Contains("tv") && tipo_tema.ToLower().Contains("vist")) ||
                    ruolo.ToLower().Contains("tv") ||
                    tema.ToLower().Contains("cedipiu")
                    )
                {
                    logo_in_tv = "Logo_VistoinTV";
                }



                if (brand.Contains("conad") && tipo_lavorazione == 1)
                {
                    if (brand.Contains("italian") || gusto.Contains("italian") || desc1.Contains("italian"))
                    {
                        //Estrazione della parola
                        string str_analisi = desc1;
                        if (gusto.Contains("italian"))
                            str_analisi = gusto;
                        if (brand.Contains("italian"))
                            str_analisi = brand;

                        string italian = str_analisi.Substring(str_analisi.ToLower().IndexOf("italian"));
                        //if (italian.IndexOf(" ") > 0 || italian.IndexOf(Environment.NewLine) > 0)
                        //{
                        //    if (italian.IndexOf(" ") > 0 && (italian.IndexOf(" ") < italian.IndexOf(Environment.NewLine) || italian.IndexOf(Environment.NewLine) < 0))
                        //    {
                        //        italian = italian.Substring(0, italian.IndexOf(" "));
                        //    }
                        //    else if (italian.IndexOf(Environment.NewLine) > 0)
                        //    {
                        //        italian = italian.Substring(0, italian.IndexOf(Environment.NewLine));
                        //    }
                        //}

                        int firstSpace = italian.IndexOf(' ');

                        // Trova le varie forme di newline
                        int posRN = italian.IndexOf("\r\n");
                        int posN = italian.IndexOf('\n');
                        int posR = italian.IndexOf('\r');

                        // Normalizza per trovare il primo tra tutti
                        int firstNewLine = -1;
                        foreach (int p in new[] { posRN, posN, posR })
                        {
                            if (p >= 0 && (firstNewLine < 0 || p < firstNewLine))
                                firstNewLine = p;
                        }

                        if (firstSpace > 0 || firstNewLine > 0)
                        {
                            if (firstSpace > 0 && (firstSpace < firstNewLine || firstNewLine < 0))
                                italian = italian.Substring(0, firstSpace);
                            else if (firstNewLine > 0)
                                italian = italian.Substring(0, firstNewLine);
                        }

                        str_analisi = str_analisi.Substring(0, str_analisi.ToLower().IndexOf("italian"));
                        str_analisi = str_analisi.Replace("100%", "");
                        str_analisi = str_analisi.Replace("  ", " ");
                        str_analisi = str_analisi.Replace(Environment.NewLine, "\n");


                        List<string> el = new List<string>();
                        string[] analisi_soggetto = str_analisi.Split(new string[] { " " }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (string s in analisi_soggetto)
                        {
                            string[] analisi_soggetto2 = s.Split(new string[] { "\n" }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (string s2 in analisi_soggetto2)
                            {
                                el.Add(s2);
                                logo_attributo_it += ((logo_attributo_it != "") ? " " : "") + s2;
                            }
                        }


                        if (el.Count <= 0)
                            logo_attributo_it = "???";
                        else
                            logo_attributo_it = el.LastOrDefault();

                        logo_attributo_it += "<br>" + italian;
                        //logo_attributo_it = str_analisi.Replace(Environment.NewLine, "")+"<br>"+italian;
                    }
                    else if (brand.Contains("prodotto in italia") || gusto.Contains("prodotto in italia") || desc1.Contains("prodotto in italia"))
                    {

                        logo_attributo_it = "PRODOTTO<br>IN ITALIA";
                    }
                }

                if ((brand.ToNoSpacing().Contains("parmigianoreggiano") || gusto.ToNoSpacing().Contains("parmigianoreggiano") || desc1.ToNoSpacing().Contains("parmigianoreggiano")) && tipo_lavorazione == 1)
                {

                    if (gusto.Contains("stagionatura") && gusto.Contains("mesi"))
                    {
                        //Intercettiamo il numero dei mesi
                        string stagionatura = gusto.Substring(gusto.ToLower().IndexOf("stagionatura"));
                        if (stagionatura.IndexOf(" ") > 0 || stagionatura.IndexOf(Environment.NewLine) > 0)
                        {
                            if (stagionatura.IndexOf(" ") > 0 && (stagionatura.IndexOf(" ") < stagionatura.IndexOf(Environment.NewLine) || stagionatura.IndexOf(Environment.NewLine) < 0))
                            {
                                stagionatura = stagionatura.Substring(0, stagionatura.IndexOf(" "));
                            }
                            else if (stagionatura.IndexOf(Environment.NewLine) > 0)
                            {
                                stagionatura = stagionatura.Substring(0, stagionatura.IndexOf(Environment.NewLine));
                            }
                        }
                        int mesi = 0;
                        if (Int32.TryParse(stagionatura, out mesi))
                        {
                            logo_parmigiano = "PARMIGIANO_mesi" + mesi;
                        }
                        else
                        {
                            //Nessun mese trovato
                            logo_parmigiano = "PARMIGIANO_mesiNO";
                        }

                    }
                    else
                    {
                        //Logo stagionatura generica
                        logo_parmigiano = "PARMIGIANO_mesiNO";
                    }

                    loghi_e_bolli.Add("logo_parmigiano", logo_parmigiano);

                    if (codiceTipoExport.ToUpper() != "WEB")
                    {
                        sfondo = "sfondo_parmigiano";
                    }
                }

                if (brand.Contains("conad") && gusto.Contains("antibiotic")/* && oItem.reparto == 29*/)
                {
                    //if (logo_carne != "")
                    //    logo_carne += ",";
                    //logo_carne += "LOGO_carneS_USOdiANTIBIOTICI";
                    if (tipo_lavorazione == 1 || sigla_formato.Contains("70x100"))
                    {
                        loghi_e_bolli.Add("LOGO_carneS_USOdiANTIBIOTICI", "LOGO_carneS_USOdiANTIBIOTICI");
                    }

                }
                //if ((desc1.Contains("chianina") || gusto.Contains("chianina")) &&
                //    brand.Contains("sapori&dintorni") &&
                //    reparto == 29)
                //{
                if (tipo_lavorazione == 1 || sigla_formato.Contains("70x100"))
                {
                    bool chianinaGruppo = true;
                    for (int i = 0; i < myGroup.Count; i++)
                    {
                        var el = myGroup[i];

                        string descr_1 = "";
                        string descr_brand = "";
                        string descr_tipo = "";
                        string descr_gramm = "";

                        descr_1 = el[GLOBAL_VARIABLES.keyDescr1].ToString().ToLower();
                        descr_brand = el[GLOBAL_VARIABLES.keyDescr2].ToString().ToLower();
                        descr_tipo = el[GLOBAL_VARIABLES.keyDescr3].ToString().ToLower();
                        descr_gramm = el[GLOBAL_VARIABLES.keyDescr4].ToString().ToLower();

                        if (!((descr_1.Contains("chianina") || descr_tipo.Contains("chianina")) &&
                            descr_brand.Contains("sapori&dintorni") &&
                            reparto == 29))
                        {
                            chianinaGruppo = false;
                            break;
                        }
                    }

                    if (chianinaGruppo)
                    {
                        loghi_e_bolli.Add("LOGO_Carne_Chianina", "LOGO_Carne_Chianina");
                    }
                }

                //}
                if (brand.Contains("conad") && gusto.Contains("filiera") && gusto.Contains("controllata"))
                {
                    //if (logo_carne != "")
                    //    logo_carne += ",";
                    //logo_carne += "LOGO_filiera";
                    if (tipo_lavorazione == 1 || sigla_formato.Contains("70x100"))
                    {
                        loghi_e_bolli.Add("LOGO_filiera", "LOGO_filiera");
                    }

                }

                //((((gusto.Contains("origine") && gusto.Contains("italia")) || (gusto.Contains("prodotto") && gusto.Contains("italia"))) && reparto == 33))
                if ((nota_category.Contains("bollo") && nota_category.Contains("italia")) ||
                    (gusto.Contains("carne") && gusto.Contains("italiana") && !brand.Contains("conad") && reparto == 29) ||
                    (gusto.Contains("origine") && gusto.Contains("italia") && reparto == 33))
                {
                    if (tipo_lavorazione == 1)
                    {
                        logo_bandiera_it = "LOGO_bandiera_italiana";
                    }
                }

                if (nota_category.Contains("pront") && nota_category.Contains("mangiare") && reparto == 31 && tipo_lavorazione == 1)
                {
                    //logo_pesce = "Logo_PE_PRONTIdaMangiare";
                    loghi_e_bolli.Add("Logo_PE_PRONTIdaMangiare", "Logo_PE_PRONTIdaMangiare");

                }
                if (nota_category.Contains("pront") && nota_category.Contains("cuocere") && reparto == 31 && tipo_lavorazione == 1)
                {
                    //if (logo_pesce != "")
                    //    logo_pesce += ",";
                    //logo_pesce += "Logo_PE_PRONTIdaCuocere";
                    loghi_e_bolli.Add("Logo_PE_PRONTIdaCuocere", "Logo_PE_PRONTIdaCuocere");

                }
                if (nota_category.Contains("conf") && nota_category.Contains("naturale") && reparto == 31 && tipo_lavorazione == 1)
                {
                    //if (logo_pesce != "")
                    //    logo_pesce += ",";
                    //logo_pesce += "Logo_PE_CONFalNaturale";
                    loghi_e_bolli.Add("Logo_PE_CONFalNaturale", "Logo_PE_CONFalNaturale");

                }
                if (nota_category.Contains("sea") && nota_category.Contains("friend") && tipo_lavorazione == 1)
                {
                    //if (logo_pesce != "")
                    //    logo_pesce += ",";
                    //logo_pesce += "Logo_Friend-of-the-Sea";
                    loghi_e_bolli.Add("Logo_Friend-of-the-Sea", "Logo_Friend-of-the-Sea");

                }
                if (nota_category.Contains("marinou") && tipo_lavorazione == 1)
                {
                    //if (logo_pesce != "")
                    //    logo_pesce += ",";
                    //logo_pesce += "Logo_Marinou";
                    loghi_e_bolli.Add("Logo_Marinou", "Logo_Marinou");

                }

                var tipoMateriale = cercaChiaveContesto("tipo_materiale", promoContext);

                if (oItem["Referenza.Codice"].ToString() == "560773")
                {
                    Console.WriteLine("Reparto: " + reparto);
                    Console.WriteLine(reparto == 33);
                    Console.WriteLine("Unità di fatturazione: " + oItem["unita_fatt"].ToString());
                    Console.WriteLine(oItem["unita_fatt"].ToString().ToLower() == "peso");
                    Console.WriteLine("Sigla reparto: " + oItem[GLOBAL_VARIABLES.keySiglaReparto].ToString());
                    Console.WriteLine("Tipo materiale: " + tipoMateriale);
                    Console.WriteLine(oItem[GLOBAL_VARIABLES.keySiglaReparto].ToString() == "OF" || tipoMateriale == "pos");
                    Console.WriteLine("Formato: " + sigla_formato);
                    Console.WriteLine(sigla_formato.Contains("A4") || sigla_formato.Contains("A3"));
                }

                if (reparto == 33 && oItem["unita_fatt"].ToString().ToLower() == "peso" &&
                    (oItem[GLOBAL_VARIABLES.keySiglaReparto].ToString() == "OF" || tipoMateriale == "pos") &&
                    (sigla_formato.Contains("A4") || sigla_formato.Contains("A3")))
                {
                    Console.WriteLine("Assegno Tasto");

                    loghi_e_bolli.Add("Tasto", "Tasto");
                }
                if (oItem.TryGetValue("art_qual", out var artQualValue) &&
                    artQualValue is string artQual &&
                    artQual != null && artQual != "")
                {
                    loghi_e_bolli.Add("Logo_ADQnaz", "Logo_ADQnaz");
                    loghi_e_bolli.Add("Margherita_ADQnaz", "Margherita_ADQnaz");
                }


                if (tipo_lavorazione == 2)
                {
                    var declSed = kit.declinazioni != null ? kit.declinazioni.Find(f => f.proprieta.Find(g => g.chiaveCompilata == "isSed") != null) : null;
                    bool isSed = false;
                    if (declSed != null && declSed.proprieta != null)
                    {
                        var valFounded = declSed.proprieta.Find(f => f.chiaveCompilata == "isSed");
                        if (valFounded != null && valFounded.valore != null)
                        {
                            isSed = (valFounded.valore.ToLower() == "true");
                        }
                    }

                    var declFid = kit.declinazioni != null ? kit.declinazioni.Find(f => f.proprieta.Find(g => g.chiaveCompilata == "isFidelity") != null) : null;
                    bool isFid = false;
                    if (declFid != null)
                    {
                        var valFounded = declSed.proprieta.Find(f => f.chiaveCompilata == "isFidelity");
                        if (valFounded != null && valFounded.valore != null)
                        {
                            isFid = (valFounded.valore.ToLower() == "true");
                        }
                    }
                    string nomeDelBaffo = sigla_formato;
                    if (tema == "convwow")
                    {
                        //noi lo identifichiammo ma per ora in indd non entrerà mai perchè il WOW ha una meccanica tutta sua.
                        nomeDelBaffo += "_WOW";
                    }
                    else
                    {

                        if (canale == "SC")
                        {
                            nomeDelBaffo += "_A";
                        }
                        else
                        {
                            if (isSed)
                            {
                                nomeDelBaffo += "_SeD";
                            }
                            else
                            {
                                nomeDelBaffo += "_P";
                            }
                        }
                        string sigla_main = cercaChiaveContesto("siglaMain", promoContext);
                        string materiale = cercaChiaveContesto("materiale", promoContext);
                        string sottosigla = cercaChiaveContesto("sottoSigla", promoContext);

                        if (sigla_main == "CAMPIONI" ||
                                sigla_main == "SOTT" ||
                                sigla_main == "SUPERMARCHE" ||
                                sigla_main == "BDP" ||
                                sigla_main == "SDB" ||
                                (materiale != null && materiale.ToLower() == "mz" && sigla_main != "GIORNATA" && sigla_main != "AR" && sigla_main != "REGIONALE")
                            )
                        {
                            //Segmento 3
                            nomeDelBaffo += "_PROMO";
                            //Segmento 4
                            nomeDelBaffo += "_" + sigla_main;
                        }
                        else if (sottosigla != "")
                        {
                            //Segmento 3
                            if (sigla_main == "GIORNATA")
                            {
                                nomeDelBaffo += "_GIORNATA";
                            }
                            else if (sigla_main == "AR")
                            {
                                nomeDelBaffo += "_AR";
                            }
                            else
                            {
                                nomeDelBaffo += "_PROMO";
                            }

                            //segmento 4
                            if (sottosigla == "LOCALISMO" || sottosigla == "TERRITORIO")
                            {
                                nomeDelBaffo += "_" + sottosigla + "_" + area;
                            }
                            else
                            {
                                nomeDelBaffo += "_" + sottosigla;
                            }
                        }
                        else
                        {
                            //Segmento 3 //Segmento 4
                            nomeDelBaffo += "_PROMO_Offerta";
                        }

                    }

                    if (isFid)
                    {
                        nomeDelBaffo += "_FID";
                    }
                    sfondo = nomeDelBaffo;

                }

                if (ruolo.ToUpper().Contains("PRIMA PAGINA") && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("PRIMA_PAGINA", "PRIMA_PAGINA");

                }

                if (ruolo.ToUpper().Contains("VEDETTE") && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("VEDETTE", "VEDETTE");

                }

                if (ruolo.ToUpper().Contains("STAR") && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("STAR", "STAR");

                }

                if (ruolo.ToUpper().Contains("ARTWORK") || oItem[keyNote_category].ToString().ToLower().Contains("cmkt"))
                {
                    if (tipo_lavorazione == 1)
                    {
                        loghi_e_bolli.Add("ARTWORK", "ARTWORK");
                    }
                }

                if (oItem[keyScattoCodiceGruppo].ToString() == oItem[keyRefCodice].ToString() && (
                    oItem[keyDescrizioniDescrizione1].ToString() != oItem[keyDescrizioniDescrizione1Tracciato].ToString() ||
                    oItem[keyDescrizioniDescrizione2].ToString() != oItem[keyDescrizioniDescrizione2Tracciato].ToString() ||
                    oItem[keyDescrizioniDescrizione3].ToString() != oItem[keyDescrizioniDescrizione3Tracciato].ToString() ||
                    oItem[keyDescrizioniDescrizione4].ToString() != oItem[keyDescrizioniDescrizione4Tracciato].ToString()
                    ) && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("CORRETTO_EDRO", "CORRETTO_EDRO");
                }

                if (oItem[GLOBAL_VARIABLES.keySiglaReparto].ToString() != "EX" && oItem.ContainsKey(Meta.nota_esempio) && oItem[Meta.nota_esempio].ToString().Contains("EVIDENZIATO ESEMPIO MA NON NECESSARIO") && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("ESEMPIO_NONnecessario", "ESEMPIO_NONnecessario");
                }

                if (oItem[keyScattoCodiceGruppo].ToString() != oItem[keyRefCodice].ToString() && oItem[GLOBAL_VARIABLES.keySiglaReparto].ToString() == "EX" && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("DES_GRUPO_EX", "DES_GRUPO_EX");
                }

                if ((bool)oItem[Meta.meccanica_invalidata] && tipo_lavorazione == 1)
                {
                    loghi_e_bolli.Add("VEDI_LISTA", "VEDI_LISTA");
                }


            }




            //Dictionary<string, string> loghi_e_bolli = new Dictionary<string, string>() {
            //    { "selezione_conad", selezione_conad },
            //    { "tipo_logo", tipo_logo },
            //    { "prodotto_conad", prodotto_conad },
            //    { "logo_focus", logo_focus },
            //    { "logo_ori", logo_ori },
            //    { "logo_intv", logo_in_tv },
            //    { "logo_carne", logo_carne },
            //    { "logo_pesce", logo_pesce },
            //    { "logo_bandiera_it", logo_bandiera_it },
            //    { "logo_attributo_it", logo_attributo_it }
            //};

            if (selezione_conad != null && selezione_conad != "")
                loghi_e_bolli.Add("selezione_conad", selezione_conad);

            if (sfondo != null && sfondo != "")
                loghi_e_bolli.Add("sfondo", sfondo);

            if (tipo_logo != null && tipo_logo != "")
                loghi_e_bolli.Add("tipo_logo", tipo_logo);

            if (prodotto_conad != null && prodotto_conad != "")
                loghi_e_bolli.Add("prodotto_conad", prodotto_conad);

            if (logo_focus != null && logo_focus != "")
                loghi_e_bolli.Add("logo_focus", logo_focus);

            if (logo_ori != null && logo_ori != "")
                loghi_e_bolli.Add("logo_ori", logo_ori);

            if (logo_in_tv != null && logo_in_tv != "")
                loghi_e_bolli.Add("logo_intv", logo_in_tv);

            if (logo_bandiera_it != null && logo_bandiera_it != "")
                loghi_e_bolli.Add("logo_bandiera_it", logo_bandiera_it);

            if (logo_attributo_it != null && logo_attributo_it != "")
                loghi_e_bolli.Add("logo_attributo_it", logo_attributo_it);

            if (oItem[key_combinazioneAssegnata].ToString().Contains("minicoll"))
            {
                //rimuoviamo tutti i loghi tranne logo_BassieFissi, territorio e inostriori

                var keysToRemove = loghi_e_bolli.Keys.Where(k => k != "logo_BassieFissi" && k != "territorio" && k != "inostriori").ToList();

                foreach (var key in keysToRemove)
                {
                    loghi_e_bolli.Remove(key);
                }
            }

            return loghi_e_bolli;

        }

        protected string getTipoListaPerTema(Dictionary<string, object> oItem)
        {
            /*if (t_item.tema.ToLower().Contains("s % d"))
            {
                return "SAP";
            }
            else */
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyTema = Edro21Context.Meta.tema;
            string keySezione = Edro21Context.Meta.sezione;
            string KeyAreaCodice = Edro21Context.Meta.AreaCodice;
            string keyDescrizioniPeso = Edro21Context.Meta.DescrizioniPeso;

            string sezione = oItem[keySezione].ToString().ToLower();
            string recTipo_vol = oItem[keyTipo_volantino].ToString().ToLower();
            Int64 reparto = (Int64)oItem[keyReparto];
            string tema = oItem[keyTema].ToString();
            string codice_area = oItem[KeyAreaCodice].ToString();

            if ((/*t_item.tema.ToLower().Contains("sottocosto") ||*/ sezione.Contains("sottocosto")) && !recTipo_vol.Contains("fuori volantino"))
            {
                return "SOTT";
            }
            /*else if (t_item.tipo_tema.ToLower().Contains("focus") &&
                (t_item.tema.ToLower().Contains("puglia") ||
                t_item.tema.ToLower().Contains("sicilia") ||
                t_item.tema.ToLower().Contains("trentino") ||
                t_item.tema.ToLower().Contains("fsicilia") ||
                t_item.tema.ToLower().Contains("ftrent.a.adig") ||
                t_item.tema.ToLower().Contains("emilia") ||
                t_item.tema.ToLower().Contains("emiliaromagn")))
            {
                return "REGIONALE";
            }
            */
            else if (sezione.Contains("paese") && !sezione.Contains(" + buono del paese"))
            {
                return "BDP";
            }
            else if (sezione.Contains("benessere") && !sezione.Contains(" + benessere"))
            {
                return "SDB";
            }
            /*else if (t_item.nota_category.ToLower().Contains("wow") || t_item.sezione.ToLower().Contains("wow"))*/
            /*else if ((t_item.settore == 3301 || t_item.settore == 3305 || t_item.settore == 3303 || t_item.settore == 3307 || t_item.settore ==3311 || t_item.settore == 3308)
                && (t_item.ruolo.ToLower()=="star" || t_item.ruolo.ToLower() == "vedette"))*/
            else if (sezione.Contains("wow") && reparto == 33)
            {
                return "WOW";
            }
            else if (sezione.Contains("campioni"))
            {
                return "CAMPIONI";
            }
            /*else if (t_item.tema.ToLower().Contains("localismo"))
            {
                return "FLOCALISMO";
            }*/
            else if (tema.Contains("mreper1ggmart"))
            {
                return "REMART";
            }
            else if (tema.Contains("mreper1gggiov"))
            {
                return "REGIOV";
            }
            else if ((tema.Contains("mvisto in tv") || sezione.Contains("visti in tv") || sezione.Contains("visto in tv")) &&
                codice_area.ToLower() != "ssla" && codice_area.ToLower() != "cnla" && codice_area.ToLower() != "cyla")
            {
                return "INTV";
            }
            else
            {
                return "classic";
            }
        }

        protected List<Dictionary<string, object>> filtraListaPoP(List<Dictionary<string, object>> lista, PopCombinazione combinazione)
        {
            string formato = popDB.Formati.Where(f => f.Id == combinazione.IdFormato).FirstOrDefault().Nome;
            string materiale = popDB.Materiali.Where(m => m.Id == combinazione.IdMateriale).FirstOrDefault().Codice;
            string nome_categoria = popDB.Categorie.Where(c => c.Id == combinazione.IdCategoria).FirstOrDefault().Nome.ToLower();
            string keyTipo_volantino = Edro21Context.Meta.tipo_volantino;
            string keyReparto = Edro21Context.Meta.reparto;
            string keyRefs = Edro21Context.Meta.refs;
            string keyFuori_banco = Edro21Context.Meta.fuori_banco;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyDescrizioniPeso = Edro21Context.Meta.DescrizioniPeso;
            string keyReferenzaCodice = Edro21Context.Meta.ReferenzaCodice;

            List<Dictionary<string, object>> result = new List<Dictionary<string, object>>();

            if (nome_categoria == "ca")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 29 &&
                    (r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 29).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "of")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 33 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 33).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "pe")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 31 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 31).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "of_pe")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 33 || (Int64)r[keyReparto] == 31) &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 33 || (Int64)r[keyReparto] == 31).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "ex")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 83
                    || (Int64)r[keyReparto] == 84 ||
                    (Int64)r[keyReparto] == 85) &&
                    (
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 83
                    || (Int64)r[keyReparto] == 84 ||
                    (Int64)r[keyReparto] == 85).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "gvsl")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 27
                            || (Int64)r[keyReparto] == 25
                            || (Int64)r[keyReparto] == 24
                            || (Int64)r[keyReparto] == 21
                            || (Int64)r[keyReparto] == 1
                            || (Int64)r[keyReparto] == 3
                            || (Int64)r[keyReparto] == 9
                            || (Int64)r[keyReparto] == 5
                            || (Int64)r[keyReparto] == 7
                            || (Int64)r[keyReparto] == 91
                            || (Int64)r[keyReparto] == 92
                            || (Int64)r[keyReparto] == 23
                            || (Int64)r[keyReparto] == 26
                            || (Int64)r[keyReparto] == 51
                            || (Int64)r[keyReparto] == 53
                            || (Int64)r[keyReparto] == 54
                            || (Int64)r[keyReparto] == 55
                            || (Int64)r[keyReparto] == 56
                            || (Int64)r[keyReparto] == 57
                            || (Int64)r[keyReparto] == 59
                            || (Int64)r[keyReparto] == 61).Count() > 0).ToList();
            }
            else if (nome_categoria == "dal")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 1 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 1).Count() > 0).ToList();
                }

            }
            else if (nome_categoria == "bv")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 3 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 3).Count() > 0).ToList();
                }

            }
            else if (nome_categoria == "pc")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 5 || (Int64)r[keyReparto] == 7) &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 5 || (Int64)r[keyReparto] == 7).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "cp")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 9 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0
                    ).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 9).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "sg")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 21 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 21).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "ls")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 24 &&
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    )).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 24).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "ga")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 25 && ((double)r[keyDescrizioniPeso] == 1 ||
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    ))).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 25).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "fo")
            {
                if (formato == "A4_FBANCO")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 27 && ((double)r[keyDescrizioniPeso] == 1 ||
                    (
                    r[keyNote_category].ToString().ToLower().Contains("pop a4") ||
                    (r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc"))
                    ))).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] == 27).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "ga_fo")
            {
                if (materiale == "SOTT")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r =>
                    ((double)r[keyDescrizioniPeso] == 1 && ((Int64)r[keyReparto] == 25 || (Int64)r[keyReparto] == 27)) &&
                    !r[keyTipo_volantino].ToString().Contains("fuori volantino")).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r =>
                    ((double)r[keyDescrizioniPeso] == 1 && ((Int64)r[keyReparto] == 25 || (Int64)r[keyReparto] == 27)) &&
                    !r[keyTipo_volantino].ToString().Contains("fuori volantino") &&
                    (!r[keyFuori_banco].ToString().Contains("fuor") || !r[keyFuori_banco].ToString().Contains("banc"))).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "fbanco_ga_fo")
            {
                if (materiale == "SOTT")
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r =>
                    (double)r[keyDescrizioniPeso] == 1 && ((Int64)r[keyReparto] == 25 || (Int64)r[keyReparto] == 27)).Count() > 0).ToList();
                }
                else
                {
                    result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r =>
                    (((double)r[keyDescrizioniPeso] == 1 && ((Int64)r[keyReparto] == 25 || (Int64)r[keyReparto] == 27)) &&
                    !r[keyTipo_volantino].ToString().Contains("fuori volantino")) ||
                    ((r[keyFuori_banco].ToString().Contains("fuor") && r[keyFuori_banco].ToString().Contains("banc")) &&
                      ((Int64)r[keyReparto] == 1 || (Int64)r[keyReparto] == 3 || (Int64)r[keyReparto] == 5 || (Int64)r[keyReparto] == 7 || (Int64)r[keyReparto] == 9 || (Int64)r[keyReparto] == 21 || (Int64)r[keyReparto] == 24)
                    )).Count() > 0).ToList();
                }
            }
            else if (nome_categoria == "vol")
            {
                //result = lista.Where(r => r.reparto != 86 && !r.tipo_volantino.Contains("fuori volantino")).ToList();
                //Tolto 86 su richiesta di Laura il 07/04/2022 alle 12.20
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => /*r.reparto != 86 && */!r[keyTipo_volantino].ToString().Contains("fuori volantino")).Count() > 0).ToList();
            }
            else if (nome_categoria == "volsed")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => !r[keyTipo_volantino].ToString().Contains("fuori volantino") && (Int64)r[keyReparto] != 31 && (Int64)r[keyReparto] != 86).Count() > 0).ToList();
            }
            else if (nome_categoria == "volcy")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => !r[keyTipo_volantino].ToString().Contains("fuori volantino") &&
                    ((Int64)r[keyReparto] == 25 ||
                    (Int64)r[keyReparto] == 27 ||
                    (Int64)r[keyReparto] == 29 ||
                    (Int64)r[keyReparto] == 31 ||
                    (Int64)r[keyReparto] == 33)).Count() > 0).ToList();
            }
            else if (nome_categoria == "tutto")
            {
                if (materiale != "POS")
                    result = lista/*.Where(r => r.reparto != 86)*/.ToList();
                else
                    result = lista.ToList();
            }
            else if (nome_categoria == "tuttosed")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => (Int64)r[keyReparto] != 31 && (Int64)r[keyReparto] != 86).Count() > 0).ToList();
            }
            else if (nome_categoria == "tuttocy")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 25 ||
                    (Int64)r[keyReparto] == 27 ||
                    (Int64)r[keyReparto] == 29 ||
                    (Int64)r[keyReparto] == 31 ||
                    (Int64)r[keyReparto] == 33)).Count() > 0).ToList();
            }
            else if (nome_categoria == "gvslcy")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 25 || (Int64)r[keyReparto] == 27)).Count() > 0).ToList();
            }
            else if (nome_categoria == "ex_fbanco")
            {
                result = lista.Where(r2 => (r2[keyRefs] as List<Dictionary<string, object>>).Where(r => ((Int64)r[keyReparto] == 83 || (Int64)r[keyReparto] == 84 || (Int64)r[keyReparto] == 85) /*&&*/).Count() > 0).ToList();
            }

            return result;
        }

        protected string getNomeEsportazionePoP(PopCombinazione combinazione, string nome_volantino, string extra_content, string tipo_materiale_pop, string mz_ap_name)
        {
            string formato = popDB.Formati.Where(f => f.Id == combinazione.IdFormato).FirstOrDefault().Nome;
            string nome_area = dbAree.Where(f => f.Id == combinazione.IdArea).FirstOrDefault().Area;
            string materiale = popDB.Materiali.Where(m => m.Id == combinazione.IdMateriale).FirstOrDefault().Codice;
            string cat = popDB.Categorie.Where(c => c.Id == combinazione.IdCategoria).FirstOrDefault().Nome;
            bool is_foto = (combinazione.Options.ContainsKey("foto") && combinazione.Options["foto"].ToString() == "si");

            nome_area = nome_area.Substring(0, 2) + "_" + nome_area.Substring(2, 2);

            string[] formato_complex = new string[2] { formato, "" };
            if (formato == "A4_FBANCO")
            {
                formato_complex[0] = "A4";
                formato_complex[1] = "_FBANCO";
            }


            if (tipo_materiale_pop.ToLower() == "mz")
                materiale = "_mz";
            /*else if (combinazione.tipi_materiale.codice=="INTV" && 
                (nome_area.ToLower()=="ss_la") || (nome_area.ToLower() == "cn_la") || (nome_area.ToLower() == "cy_la"))
                materiale = "";*/

            bool dup_fid = (bool)combinazione.Options["dupFidelity"];
            string nome_fid = combinazione.Options["nomeFidelity"].ToString();

            if (dup_fid && materiale.ToLower() != "_ap" /*&& materiale.ToLower() != "_mz"*/)
            {
                //materiale = combinazione.tipi_materiale.codice + "_" + combinazione.nome_fidelity;
                nome_area = nome_fid;// +"_" + nome_area.Substring(3, 2);
                                     //Response.Write("Il nome area sarebbe " + nome_area + "<br>");
            }

            if (materiale.ToLower() == "_vol")
                materiale = "";


            if (cat == "TUTTO")
                cat = "";

            string agg_PROMO = "";
            if (tipo_materiale_pop.ToLower() == "vol" && !new List<string>() { "_SOTT", "_REGIONALE", "_BDP", "_SDB", "_WOW", "_CAMPIONI", "_FLOCALISMO", "_REMART", "_REGIOV", "_INTV" }.Contains(materiale.ToUpper()))
                agg_PROMO = "_PROMO";

            if (tipo_materiale_pop.ToLower() == "pos")
            {
                string data_vol = nome_volantino.Substring(nome_volantino.LastIndexOf("_"));
                string add_to = extra_content;
                add_to = add_to.Replace("\\", "");
                add_to = add_to.Replace("/", "");
                add_to = add_to.Replace(".", "");
                add_to = add_to.Replace(",", "");
                string result = formato_complex[0] + "_" + nome_area + data_vol + formato_complex[1] + add_to + "_" + (is_foto ? "FOTO_" : "") + cat;
                return result;
            }
            else if (tipo_materiale_pop.ToLower() != "ap"/*materiale.ToLower() != "_ap"*/)
            {
                if (materiale.ToLower() == "_mz")
                    materiale += "_" + mz_ap_name;

                //if (cat=="")

                //return nome_area + "_" + formato + "_" + materiale + "_" + cat + nome_volantino.Substring(nome_volantino.LastIndexOf("_"));
                string data_vol = nome_volantino.Substring(nome_volantino.LastIndexOf("_"));
                if (data_vol != "_diff")
                {
                    if (cat != "")
                    {
                        cat = "_" + cat;
                        if (materiale.ToLower() == "_fec")
                        {
                            if (cat.ToLower() == "_volcy")
                                cat = "";
                            else if (cat.ToLower() == "_vol")
                                cat = "";
                            else if (cat.ToLower() == "_volsed")
                                cat = "";
                            else if (cat.ToLower() == "_tutto")
                                cat = "";
                            else if (cat.ToLower() == "_tuttosed")
                                cat = "";
                            else if (cat.ToLower() == "_tuttocy")
                                cat = "";
                        }
                    }
                    return formato_complex[0] + "_" + nome_area + data_vol + materiale + formato_complex[1] + (is_foto ? "_FOTO" : "") + agg_PROMO + cat;
                }
                else
                {
                    return formato_complex[0] + "_" + nome_area + materiale + formato_complex[1] + "_" + cat + (is_foto ? "_FOTO" : "") + data_vol;
                }

            }
            else
            {
                if (materiale.ToLower().Contains("flocalismo") ||
                    materiale.ToLower().Contains("benessere") ||
                    materiale.ToLower().Contains("sap") ||
                    materiale.ToLower().Contains("sott") ||
                    materiale.ToLower().Contains("regionale") ||
                    materiale.ToLower().Contains("paese"))
                {
                    return formato_complex[0] + "_" + tipo_materiale_pop + "_" + mz_ap_name + nome_volantino.Substring(nome_volantino.LastIndexOf("_")) + materiale + formato_complex[1] + "_" + (is_foto ? "FOTO_" : "") + agg_PROMO + cat;
                }
                else
                {
                    return formato_complex[0] + materiale + "_" + mz_ap_name + nome_volantino.Substring(nome_volantino.LastIndexOf("_")) + formato_complex[1] + "_" + (is_foto ? "FOTO_" : "") + agg_PROMO + cat;
                }

            }
        }

        public string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd)
        {
            throw new NotImplementedException();
        }

        //I20-522: la dicitura che l'operatore scrive in una delle quattro descrizioni quando la
        //referenza si vende anche d'asporto. Si confronta senza maiuscole e con gli spazi
        //normalizzati: e' scritta a mano, e una distrazione non deve farla mancare.
        private const string dicituraTakeAway = "disponibile anche take away";

        private static string normalizzaPerConfronto(string testo)
        {
            return string.Join(" ", testo.ToLower().Split((char[])null, StringSplitOptions.RemoveEmptyEntries));
        }

        internal static bool contieneDicituraTakeAway(string testo)
        {
            return !string.IsNullOrWhiteSpace(testo) && normalizzaPerConfronto(testo).Contains(dicituraTakeAway);
        }

        //Le descrizioni arrivano in due forme: dritte nel record quando sono della singola ref, dentro
        //un dizionario annidato quando sono del gruppo. Guardarne una sola ne perderebbe meta'.
        private static IEnumerable<string> descrizioniDellaRef(Dictionary<string, object> item)
        {
            string[] chiavi = { GLOBAL_VARIABLES.keyDescr1, GLOBAL_VARIABLES.keyDescr2, GLOBAL_VARIABLES.keyDescr3, GLOBAL_VARIABLES.keyDescr4 };

            foreach (var chiave in chiavi)
            {
                if (item.ContainsKey(chiave) && item[chiave] != null)
                    yield return item[chiave].ToString();
            }

            if (item.ContainsKey(GLOBAL_VARIABLES.keyXMLDescrizioneGruppo) &&
                item[GLOBAL_VARIABLES.keyXMLDescrizioneGruppo] is Dictionary<string, object> descrizioniDiGruppo)
            {
                foreach (var chiave in chiavi)
                {
                    if (descrizioniDiGruppo.ContainsKey(chiave) && descrizioniDiGruppo[chiave] != null)
                        yield return descrizioniDiGruppo[chiave].ToString();
                }
            }
        }

        private static bool gruppoDichiaraTakeAway(List<Dictionary<string, object>> gruppo)
        {
            return gruppo.Any(item => descrizioniDellaRef(item).Any(contieneDicituraTakeAway));
        }

        //I20-522: fra le ref di un gruppo take away il primario e' quello di peso 1. Quel peso pero'
        //arriva nel record solo quando non e' nullo, quindi puo' mancare: si ripiega allora sul criterio
        //di prima, l'unita' di fatturazione a peso, e in ultimo sul primo elemento. Un gruppo senza
        //primaria verrebbe saltato nell'export e farebbe fallire l'impaginazione.
        private static Dictionary<string, object> scegliPrimariaTakeAway(List<Dictionary<string, object>> gruppo)
        {
            var perPeso = gruppo.FirstOrDefault(pesoUnitario);
            if (perPeso != null)
                return perPeso;

            var perUnitaDiFatturazione = gruppo.FirstOrDefault(item => item.ContainsKey("unita_fatt") && item["unita_fatt"] != null
                && item["unita_fatt"].ToString().Trim().ToLower() == "peso");
            if (perUnitaDiFatturazione != null)
                return perUnitaDiFatturazione;

            return gruppo[0];
        }

        private static bool pesoUnitario(Dictionary<string, object> item)
        {
            if (!item.ContainsKey(GLOBAL_VARIABLES.keyDescrPeso) || item[GLOBAL_VARIABLES.keyDescrPeso] == null)
                return false;

            return decimal.TryParse(Convert.ToString(item[GLOBAL_VARIABLES.keyDescrPeso], CultureInfo.InvariantCulture),
                NumberStyles.Any, CultureInfo.InvariantCulture, out decimal peso) && peso == 1m;
        }

        public string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost)
        {
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            string potenziale_esempio = Edro21Context.Meta.potenziale_esempio;

            string keyXMLSelezione = GLOBAL_VARIABLES.keyXMLSelezione;
            double prezzoMaggiore = 0;
            var elPrezzoMaggiore = gruppo[0];
            bool primaria_gia_assegnata = false;


            //controlliamo se è un take away
            bool takeAwayPerSettore = false;
            if (gruppo[0].ContainsKey("settore") && gruppo[0]["settore"].ToString() == "2507")
            {
                //se siamo qui è GASTRONOMIA VENDITA ASSISTITA (2507), ora controlliamo se è take away
                bool peso = gruppo.Any(g => g.ContainsKey("unita_fatt") && g["unita_fatt"].ToString().ToLower() == "peso");
                bool pezzo = gruppo.Any(g => g.ContainsKey("unita_fatt") && g["unita_fatt"].ToString().ToLower() == "pezzo");
                takeAwayPerSettore = peso && pezzo;
            }

            //I20-522: vale come take away anche il gruppo che se lo dice da solo in una delle quattro
            //descrizioni. Il riconoscimento per settore resta, questo gli si aggiunge.
            if (takeAwayPerSettore || gruppoDichiaraTakeAway(gruppo))
            {
                //è take away
                var refPrimaria = scegliPrimariaTakeAway(gruppo);

                foreach (var item in gruppo)
                {
                    if (!primaria_gia_assegnata && ReferenceEquals(item, refPrimaria))
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                        primaria_gia_assegnata = true;
                    }
                    else if (item[potenziale_esempio].ToString() != "" || item[referenza_pilota].ToString() == "S")
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                    }
                    else
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                    }
                    item["isTakeAway"] = true;
                }

                return JsonConvert.SerializeObject(gruppo);
            }

            if (gruppo.Count > 1)
            {
                if (gruppo[0]["Scatto.CodiceGruppo"].ToString().Contains("4058997"))
                {
                    Debug.WriteLine("");
                }
                if (!gruppo.Any(f => f[potenziale_esempio].ToString() != "" || f[referenza_pilota].ToString() == "S"))
                {
                    //impostiamo il primo elemento a primario poichè nessuno è valido per essere selezionato
                    gruppo[0][keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                    for (int i = 1; i < gruppo.Count; i++)
                    {
                        gruppo[i][keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                    }

                    return JsonConvert.SerializeObject(gruppo);
                }


                foreach (var item in gruppo)
                {
                    if (!primaria_gia_assegnata && item[potenziale_esempio].ToString() != "")
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                        primaria_gia_assegnata = true;
                    }
                    else if (item[referenza_pilota].ToString() == "S")
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Secondaria;
                    }
                    else
                    {
                        item[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.None;
                    }

                }

                if (!primaria_gia_assegnata)
                {
                    //Se nessuna ha ESEMPIO, prendo la prima che ha S in referenza_pilota
                    var itemPrim = gruppo.Where(g => g[referenza_pilota].ToString() == "S").FirstOrDefault();
                    if (itemPrim != null)
                    {
                        itemPrim[keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                    }
                    else
                    {
                        gruppo[0][keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
                    }

                }
            }
            else
            {
                gruppo[0][keyXMLSelezione] = (Byte)TipoSelezioneMenabo.Primaria;
            }

            //Console.WriteLine($"CUSTOM FATTO >> {gruppo.Count(c => !c.ContainsKey(keyXMLSelezione))}");

            return JsonConvert.SerializeObject(gruppo);
        }

        public List<List<Dictionary<string, object>>> eseguiAutoSelezioneGruppoMassiva(List<List<Dictionary<string, object>>> gruppo, List<Dictionary<string, object>> ghost)
        {
            foreach (var gruppoSingolo in gruppo)
            {
                string resGruppo = eseguiAutoSelezioneGruppo(gruppoSingolo, ghost);
                List<Dictionary<string, object>> resultExtDict = JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(resGruppo);
                //foreach (var el in resultExtDict)
                //{
                //    if (el.ContainsKey(GLOBAL_VARIABLES.keyXMLSelezione))
                //    {
                //        var refSingola = gruppoSingolo.FirstOrDefault(g => g[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() == el[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString());
                //        refSingola[GLOBAL_VARIABLES.keyXMLSelezione] = Byte.Parse(el[GLOBAL_VARIABLES.keyXMLSelezione].ToString());
                //    }
                //}

                foreach (var el in resultExtDict)
                {
                    if (!el.TryGetValue("idRec", out var idValue) ||
                        !long.TryParse(idValue?.ToString(), out var idRec))
                    {
                        continue;
                    }

                    var refSingola = gruppoSingolo.FirstOrDefault(g =>
                        g.TryGetValue("idRec", out var currentId) &&
                        long.TryParse(currentId?.ToString(), out var parsedId) &&
                        parsedId == idRec
                    );

                    if (refSingola == null)
                    {
                        throw new InvalidOperationException(
                            $"Record {idRec} non trovato nel gruppo massivo."
                        );
                    }

                    if (el.TryGetValue(
                            GLOBAL_VARIABLES.keyXMLSelezione,
                            out var selezioneValue) &&
                        byte.TryParse(
                            selezioneValue?.ToString(),
                            out var selezione))
                    {
                        refSingola[GLOBAL_VARIABLES.keyXMLSelezione] = selezione;
                    }
                }
            }

            return gruppo;
        }

        public AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public string confrontaListeCustom(List<Dictionary<string, object>> primario, List<Dictionary<string, object>> secondario, bool controlloVersione, Dictionary<string, string> reqParams, string pathMeccaniche, string pathOrdinamentoLista)
        {
            string Descr1 = GLOBAL_VARIABLES.keyDescr1;
            string Descr2 = GLOBAL_VARIABLES.keyDescr2;
            string Descr3 = GLOBAL_VARIABLES.keyDescr3;
            string Descr4 = GLOBAL_VARIABLES.keyDescr4;
            string DescrPeso = GLOBAL_VARIABLES.keyDescrPeso;
            string DescrUM = GLOBAL_VARIABLES.keyDescrUm;
            string referenza_pilota = Edro21Context.Meta.referenza_pilota;
            string keyNomeFoto = Edro21Context.Meta.NomeFoto;
            string keyEsempio = Edro21Context.Meta.potenziale_esempio;
            string keyRuolo = Edro21Context.Meta.ruolo;
            string keyTipoVolantino = Edro21Context.Meta.tipo_volantino;
            string keyData_a = Edro21Context.Meta.data_a;
            string keyData_da = Edro21Context.Meta.data_da;
            string keyUnita_fatt = Edro21Context.Meta.unita_fatt;
            string keyTema = Edro21Context.Meta.tema;
            string keyTipo_tema = Edro21Context.Meta.tipo_tema;
            string keyNote_category = Edro21Context.Meta.note_category;
            string keyFuoribanco = Edro21Context.Meta.fuoribanco;
            string keyDistintivita = Edro21Context.Meta.distintivita;
            string keySezione = Edro21Context.Meta.sezione;
            string keyScattoCodice = Edro21Context.Meta.codice_scatto;
            string keyMeccanicaTradotta = Edro21Context.Meta.meccanica_tradotta;
            string keyMeccanicaInvalidata = Edro21Context.Meta.meccanica_invalidata;
            string keyScattoCodiceGruppo = Edro21Context.Meta.ScattoCodiceGruppo;
            string keyRefCodice = Edro21Context.Meta.ReferenzaCodice;

            Dictionary<string, string> colonne = new Dictionary<string, string>
            {
                { "Area", "area" },
                { "Iniziativa", "iniziativa" },
                { "Note raggr", "" }, //
                { "Da", keyData_da },
                { "A", keyData_a },
                { "Gruppo siti", "gruppo_siti_stringa" },
                { "CodScatto", "codice_scatto" },
                { "Reparto", "reparto" },
                { "Descr.Reparto", "descrizione_reparto" },
                { "Settore", "settore" },
                { "Descr.Settore", "descrizione_settore" },
                { "Prodotto mercato", "" },  //
                { "Ean", "Referenza.Ean" },
                { "NomeFoto", "Foto.Nome" },
                { "CodRadice", keyRefCodice },
                { "CodVV", "codice_vv" },
                { "Nome", Descr1 },
                { "Peso totale L/Kg", DescrPeso },
                { "UNITA_MISURA", DescrUM },
                { "UNITA_FATT", keyUnita_fatt },
                { "Tema", keyTema },
                { "Prezzo Norm.", "prezzo_base" },
                { "Prezzo prom. Mass Market", "" }, //
                { "Prezzo prom. Fidelity", "" }, //
                { "N - Mass Market", "N_MM" },
                { "M - Mass Market", "M_MM" },
                { "N - Fidelity", "N_FID" },
                { "M - Fidelity", "M_FID" },
                { "Valore Sconto - Mass Market", "sconto_MM" },
                { "Tipo sconto - Mass Market", "tipo_sconto_MM" },
                { "Valore sconto - Fidelity", "sconto_FID" },
                { "Tipo sconto - Fidelity", "tipo_sconto_FID" },
                { "Range 1", "range_1" },
                { "Punti 1", "punti_1" },
                { "Range 2", "range_2" },
                { "Punti 2", "punti_2" },
                { "Tipo Punti", "tipo_punti" },
                { "Limite QTA", "" }, //
                { "Conad Card", "" },//
                { "Paghi", "prezzo_offerta" },
                { "Anzichè", "prezzo_anziche" },
                { "Prezzo offerta Kg/Lt", "prezzo_offerta_kgl" },
                { "Prezzo base Kg/Lt", "prezzo_anziche_kgl" },
                { "Note category", keyNote_category },
                { "Foto", referenza_pilota },
                { "Naz", "" }, //
                { "Ruolo", keyRuolo },
                { "Esempio", keyEsempio },
                { "Numero Pagina", "" }, //
                { "Posizione Pagina", "" },//
                { "ScontoAgenzia", "sconto_agenzia" },
                { "Brand", Descr2 },
                { "Tipo/Gusto", Descr3 },
                { "Grammatura", Descr4 },
                { "Meccanica", keyMeccanicaTradotta },
                { "Tipo Volantino", keyTipoVolantino },
                { "Tipo Tema", keyTipo_tema },
                { "Nota Fuoribanco", keyFuoribanco },
                { "CodiceRagMixMatch", "" },//
                { "Segmento", "segmento" },
                { "Tipo comunicazione", "" },//
                { "Descrizione regionale", "" },//
                { "U.Misura Comunicazione", "um_com" },
                { "Prezzo u. misura Comunicazione", "prezzo_offerta_um_com" },
                { "Anzichè u. misura Comunicazione", "prezzo_anziche_um_com" },
                { "Distintività", keyDistintivita },
                { "Sezione", keySezione },
                { "ID Prestazione", "" },//
                { "Tipo riga", "tipo_riga" },
                { "Piano promozionale", "promotion_plan" },
                { "File immagini", "file_immagini" },
                { "Flag Prenotazione", "flag_prenotazione" },
                { "Codice articolo POP", "codice_articolo_pop" },
                { "DNA", keyScattoCodiceGruppo }, //
                { "DIFF DESCR", "" },
                { "DIFF", "" },
                { "DIFF FOTO S", "" },
                { "N_FOTO", "" },
                { "DIFF ES", "" },
                { "DIFF RUOLO", "" },
                { "V-FV", "" },
                { "ERR", "" },
                { "DIFF SCATTO", "" },
                { "C/S/P", "" }
            };

            DateTime inizio = DateTime.Now;


            JObject o3 = JObject.Parse(File.ReadAllText(pathMeccaniche));
            DbMeccaniche mcDB = o3.ToObject<DbMeccaniche>();
            dbMeccaniche = mcDB.source;

            JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
            DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
            dbGrammature = ordDB.source;

            this.requestParams = reqParams;

            //string[] colonneValori = new string[colonne.Count];
            //for (int i = 0; i < colonne.Count; i++)
            //{
            //    colonneValori[i] = colonne.ElementAt(i).Key.ToString();
            //}
            //risultato.Add(colonneValori);
            List<string[]> risultato = new List<string[]>();
            string[] arrayValoriElementiComuni = new string[colonne.Count];
            csvDataset csvResultComuni = new csvDataset();

            string[] arrayValoriElementiSoloPrimario = new string[colonne.Count];
            csvDataset csvResultSoloPrimario = new csvDataset();

            string[] arrayValoriElementiSoloSecondario = new string[colonne.Count];
            csvDataset csvResultSoloSecondario = new csvDataset();

            List<string[]> risultatoComuni = new List<string[]>();
            List<string[]> risultatoSoloPrimario = new List<string[]>();
            List<string[]> risultatoSoloSecondario = new List<string[]>();


            csvDataset csvResult = new csvDataset();
            string[] colonneValori = new string[colonne.Count];
            for (int i = 0; i < colonne.Count; i++)
            {
                colonneValori[i] = colonne.ElementAt(i).Key.ToString();
            }
            csvResult.header.AddRange(colonneValori);
            for (int i = 0; i < colonne.Count; i++)
            {
                colonneValori[i] = colonne.ElementAt(i).Value.ToString();
            }
            csvResult.headerField.AddRange(csvResult.header);

            List<double> tempi1 = new List<double>();
            List<double> tempi1_2 = new List<double>();
            List<double> tempi2 = new List<double>();
            List<double> tempi2_2 = new List<double>();

            DateTime momento1 = DateTime.Now;

            foreach (var elementoPrimario in primario)
            {
                DateTime dtInizioEl = DateTime.Now;

                Dictionary<string, string> csvRec = new Dictionary<string, string>();
                string codicePrimario = elementoPrimario[keyRefCodice].ToString();
                Dictionary<string, object> elementoCorrispondenteSecondario = new Dictionary<string, object>();
                if (controlloVersione)
                {
                    elementoCorrispondenteSecondario = secondario.FirstOrDefault(e => e[keyRefCodice].ToString() == codicePrimario && e["id_tracciato"].ToString() == elementoPrimario["id_tracciato"].ToString());
                    secondario.Remove(elementoCorrispondenteSecondario);
                }
                else
                {
                    elementoCorrispondenteSecondario = secondario.FirstOrDefault(e => e[keyRefCodice].ToString() == codicePrimario);
                    secondario.Remove(elementoCorrispondenteSecondario);
                }
                bool differenzaTrovata = false;
                Meccanica mec = interpretaMeccanica(elementoPrimario, false, null);
                elementoPrimario[keyMeccanicaTradotta] = mec.NomeTraduzione;

                DateTime dtInizioElCols = DateTime.Now;

                for (int i = 0; i < colonne.Count; i++)
                {
                    var coppia = colonne.ElementAt(i);
                    string chiave = coppia.Key;
                    string valore = coppia.Value;

                    if (elementoCorrispondenteSecondario != null)
                    {
                        if (valore != "" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = elementoPrimario[valore].ToString();
                            csvRec[chiave] = elementoPrimario[valore].ToString();
                        }
                        else
                        {
                            csvRec[chiave] = "";
                        }



                        if (chiave == "Foto" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "S";
                            csvRec[chiave] = "S";
                        }
                        else if (chiave == "Foto" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Meccanica" && mec != null)
                        {
                            //arrayValoriElementiComuni[i] = "S";
                            csvRec[chiave] = mec.NomeTraduzione;
                        }
                        else if (chiave == "Meccanica" && mec == null)
                        {
                            csvRec[chiave] = "";
                        }


                        if (chiave == "Esempio" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "1";
                            csvRec[chiave] = "1";
                        }
                        else if (chiave == "Esempio" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Grammatura" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = elementoPrimario[valore].ToString().Replace("-<br2>", " ");
                            csvRec[chiave] = elementoPrimario[valore].ToString().Replace("-<br2>", " ");
                        }
                        else if (chiave == "Grammatura" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Codice articolo POP" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "=\"" + elementoPrimario[valore].ToString() + "\"";
                            csvRec[chiave] = "=\"" + elementoPrimario[valore].ToString() + "\"";
                        }
                        else if (chiave == "Codice articolo POP" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF DESCR")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if (elementoPrimario.ContainsKey(Descr1) && elementoCorrispondenteSecondario.ContainsKey(Descr1) && elementoPrimario[Descr1].ToString() != elementoCorrispondenteSecondario[Descr1].ToString())
                            {
                                //arrayValoriElementiComuni[i] = "N";
                                csvRec[chiave] = "N";
                                differenzaTrovata = true;
                            }
                            if (elementoPrimario.ContainsKey(Descr2) && elementoCorrispondenteSecondario.ContainsKey(Descr2) && elementoPrimario[Descr2].ToString() != elementoCorrispondenteSecondario[Descr2].ToString())
                            {
                                if (/*arrayValoriElementiComuni[i]*/ csvRec[chiave] != "")
                                {
                                    //arrayValoriElementiComuni[i] = "D";
                                    csvRec[chiave] = "D";
                                    differenzaTrovata = true;

                                }
                                else
                                {
                                    //arrayValoriElementiComuni[i] = "B";
                                    csvRec[chiave] = "B";
                                    differenzaTrovata = true;

                                }
                            }
                            if (elementoPrimario.ContainsKey(Descr3) && elementoCorrispondenteSecondario.ContainsKey(Descr3) && elementoPrimario[Descr3].ToString() != elementoCorrispondenteSecondario[Descr3].ToString())
                            {
                                if (/*arrayValoriElementiComuni[i]*/ csvRec[chiave] != "")
                                {
                                    //arrayValoriElementiComuni[i] = "D";
                                    csvRec[chiave] = "D";
                                    differenzaTrovata = true;

                                }
                                else
                                {
                                    //arrayValoriElementiComuni[i] = "TG";
                                    csvRec[chiave] = "TG";
                                    differenzaTrovata = true;

                                }
                            }
                            if (elementoPrimario.ContainsKey(Descr4) && elementoCorrispondenteSecondario.ContainsKey(Descr4) && elementoPrimario[Descr4].ToString() != elementoCorrispondenteSecondario[Descr4].ToString())
                            {
                                if (/*arrayValoriElementiComuni[i]*/ csvRec[chiave] != "")
                                {
                                    //arrayValoriElementiComuni[i] = "D";
                                    csvRec[chiave] = "D";
                                    differenzaTrovata = true;

                                }
                                else
                                {
                                    //arrayValoriElementiComuni[i] = "G";
                                    csvRec[chiave] = "G";
                                    differenzaTrovata = true;

                                }
                            }
                            if ((elementoPrimario.ContainsKey(DescrPeso) && elementoCorrispondenteSecondario.ContainsKey(DescrPeso) && elementoPrimario[DescrPeso].ToString() != elementoCorrispondenteSecondario[DescrPeso].ToString()) || (elementoPrimario.ContainsKey(DescrUM) && elementoCorrispondenteSecondario.ContainsKey(DescrUM) && elementoPrimario[DescrUM].ToString() != elementoCorrispondenteSecondario[DescrUM].ToString()) || (elementoPrimario.ContainsKey(DescrPeso) && !elementoCorrispondenteSecondario.ContainsKey(DescrPeso)) || (!elementoPrimario.ContainsKey(DescrPeso) && elementoCorrispondenteSecondario.ContainsKey(DescrPeso)))
                            {
                                //arrayValoriElementiComuni[i] = "CF";
                                csvRec[chiave] = "CF";
                                differenzaTrovata = true;

                            }
                        }

                        if (chiave == "DIFF")
                        {
                            IndiceDifferenza idx = getIndiceDifferenze(elementoCorrispondenteSecondario, elementoPrimario);
                            csvRec[chiave] = idx.indice.ToString();
                            //da implementare
                        }

                        if (chiave == "DIFF FOTO S")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if (((elementoPrimario.ContainsKey(referenza_pilota) && elementoCorrispondenteSecondario.ContainsKey(referenza_pilota)) && (elementoPrimario[referenza_pilota].ToString() != elementoCorrispondenteSecondario[referenza_pilota].ToString())) || (elementoPrimario.ContainsKey(referenza_pilota) && !elementoCorrispondenteSecondario.ContainsKey(referenza_pilota)) || (!elementoPrimario.ContainsKey(referenza_pilota) && elementoCorrispondenteSecondario.ContainsKey(referenza_pilota)))
                            {
                                //arrayValoriElementiComuni[i] = "DF";
                                csvRec[chiave] = "DF";
                                differenzaTrovata = true;

                            }
                        }

                        if (chiave == "N_FOTO")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((elementoPrimario.ContainsKey(keyNomeFoto) && elementoCorrispondenteSecondario.ContainsKey(keyNomeFoto) && elementoPrimario[keyNomeFoto].ToString() != elementoCorrispondenteSecondario[keyNomeFoto].ToString()) || (elementoPrimario.ContainsKey(keyNomeFoto) && !elementoCorrispondenteSecondario.ContainsKey(keyNomeFoto)) || (!elementoPrimario.ContainsKey(keyNomeFoto) && elementoCorrispondenteSecondario.ContainsKey(keyNomeFoto)))
                            {
                                //arrayValoriElementiComuni[i] = "NF";
                                csvRec[chiave] = "NF";
                                differenzaTrovata = true;

                            }
                        }

                        if (chiave == "DIFF ES")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((elementoPrimario.ContainsKey(keyEsempio) && elementoCorrispondenteSecondario.ContainsKey(keyEsempio) && elementoPrimario[keyEsempio].ToString() != elementoCorrispondenteSecondario[keyEsempio].ToString()) || (elementoPrimario.ContainsKey(keyEsempio) && !elementoCorrispondenteSecondario.ContainsKey(keyEsempio)) || (!elementoPrimario.ContainsKey(keyEsempio) && elementoCorrispondenteSecondario.ContainsKey(keyEsempio)))
                            {
                                //arrayValoriElementiComuni[i] = "ES";
                                csvRec[chiave] = "ES";
                                differenzaTrovata = true;

                            }
                        }

                        if (chiave == "DIFF RUOLO")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((elementoPrimario.ContainsKey(keyRuolo) && elementoCorrispondenteSecondario.ContainsKey(keyRuolo) && elementoPrimario[keyRuolo].ToString() != elementoCorrispondenteSecondario[keyRuolo].ToString()) || (elementoPrimario.ContainsKey(keyRuolo) && !elementoCorrispondenteSecondario.ContainsKey(keyRuolo)) || (!elementoPrimario.ContainsKey(keyRuolo) && elementoCorrispondenteSecondario.ContainsKey(keyRuolo)))
                            {
                                //arrayValoriElementiComuni[i] = "R";
                                csvRec[chiave] = "R";
                                differenzaTrovata = true;
                            }
                        }

                        if (chiave == "V-FV")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((elementoPrimario.ContainsKey(keyTipoVolantino) && elementoCorrispondenteSecondario.ContainsKey(keyTipoVolantino) && elementoPrimario[keyTipoVolantino].ToString() != elementoCorrispondenteSecondario[keyTipoVolantino].ToString()))
                            {
                                //arrayValoriElementiComuni[i] = "V";
                                csvRec[chiave] = "V";
                                differenzaTrovata = true;

                                if (elementoPrimario[keyTipoVolantino].ToString().Contains("fuori volantino") || elementoCorrispondenteSecondario[keyTipoVolantino].ToString().Contains("fuori volantino"))
                                {
                                    //arrayValoriElementiComuni[i] = "FV";
                                    csvRec[chiave] = "FV";
                                    differenzaTrovata = true;

                                }
                            }
                            else if ((elementoPrimario.ContainsKey(keyTipoVolantino) && elementoCorrispondenteSecondario.ContainsKey(keyTipoVolantino) && elementoPrimario[keyTipoVolantino].ToString() == elementoCorrispondenteSecondario[keyTipoVolantino].ToString()) || (elementoPrimario.ContainsKey(keyTipoVolantino) && !elementoCorrispondenteSecondario.ContainsKey(keyTipoVolantino)) || (!elementoPrimario.ContainsKey(keyTipoVolantino) && elementoCorrispondenteSecondario.ContainsKey(keyTipoVolantino)))
                            {
                                //arrayValoriElementiComuni[i] = "";
                                csvRec[chiave] = "";
                            }
                        }

                        if (chiave == "ERR")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((!elementoPrimario.ContainsKey(keyData_da) || !elementoCorrispondenteSecondario.ContainsKey(keyData_da) || elementoPrimario[keyData_da].ToString() != elementoCorrispondenteSecondario[keyData_da].ToString() ||
                                !elementoPrimario.ContainsKey(keyData_a) || !elementoCorrispondenteSecondario.ContainsKey(keyData_a) || elementoPrimario[keyData_a].ToString() != elementoCorrispondenteSecondario[keyData_a].ToString() ||
                                !elementoPrimario.ContainsKey(keyUnita_fatt) || !elementoCorrispondenteSecondario.ContainsKey(keyUnita_fatt) || elementoPrimario[keyUnita_fatt].ToString() != elementoCorrispondenteSecondario[keyUnita_fatt].ToString() ||
                                !elementoPrimario.ContainsKey(keyTema) || !elementoCorrispondenteSecondario.ContainsKey(keyTema) || elementoPrimario[keyTema].ToString() != elementoCorrispondenteSecondario[keyTema].ToString() ||
                                !elementoPrimario.ContainsKey(keyTipo_tema) || !elementoCorrispondenteSecondario.ContainsKey(keyTipo_tema) || elementoPrimario[keyTipo_tema].ToString() != elementoCorrispondenteSecondario[keyTipo_tema].ToString() ||
                                !elementoPrimario.ContainsKey(keyNote_category) || !elementoCorrispondenteSecondario.ContainsKey(keyNote_category) || elementoPrimario[keyNote_category].ToString() != elementoCorrispondenteSecondario[keyNote_category].ToString() ||
                                !elementoPrimario.ContainsKey(keyFuoribanco) || !elementoCorrispondenteSecondario.ContainsKey(keyFuoribanco) || elementoPrimario[keyFuoribanco].ToString() != elementoCorrispondenteSecondario[keyFuoribanco].ToString() ||
                                !elementoPrimario.ContainsKey(keyDistintivita) || !elementoCorrispondenteSecondario.ContainsKey(keyDistintivita) || elementoPrimario[keyDistintivita].ToString() != elementoCorrispondenteSecondario[keyDistintivita].ToString() ||
                                !elementoPrimario.ContainsKey(keySezione) || !elementoCorrispondenteSecondario.ContainsKey(keySezione) || elementoPrimario[keySezione].ToString() != elementoCorrispondenteSecondario[keySezione].ToString()))
                            {
                                //arrayValoriElementiComuni[i] = "ER";
                                csvRec[chiave] = "ER";
                                differenzaTrovata = true;

                            }
                        }

                        if (chiave == "DIFF SCATTO")
                        {
                            //arrayValoriElementiComuni[i] = "";
                            csvRec[chiave] = "";
                            if ((elementoPrimario.ContainsKey(keyScattoCodiceGruppo) && elementoCorrispondenteSecondario.ContainsKey(keyScattoCodiceGruppo) && elementoPrimario[keyScattoCodiceGruppo].ToString() != elementoCorrispondenteSecondario[keyScattoCodiceGruppo].ToString()) || (elementoPrimario.ContainsKey(keyScattoCodiceGruppo) && !elementoCorrispondenteSecondario.ContainsKey(keyScattoCodiceGruppo)) || (!elementoPrimario.ContainsKey(keyScattoCodiceGruppo) && elementoCorrispondenteSecondario.ContainsKey(keyScattoCodiceGruppo)))
                            {
                                //arrayValoriElementiComuni[i] = "X";
                                csvRec[chiave] = "X";
                                differenzaTrovata = true;
                            }
                        }

                        if (chiave == "C/S/P")
                        {
                            ////arrayValoriElementiComuni[i] = "";
                            //csvRec[chiave] = "";
                            //if (differenzaTrovata)
                            //{
                            //arrayValoriElementiComuni[i] = "C";
                            csvRec[chiave] = "C";
                            //}
                        }

                        //risultatoComuni.Add(arrayValoriElementiComuni);

                    }
                    else
                    {
                        if (valore != "" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = elementoPrimario[valore].ToString();
                            csvRec[chiave] = elementoPrimario[valore].ToString();
                        }
                        else
                        {
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Foto" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "S";
                            csvRec[chiave] = "S";
                        }
                        else if (chiave == "Foto" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Meccanica" && mec != null)
                        {
                            //arrayValoriElementiComuni[i] = "S";
                            csvRec[chiave] = mec.NomeTraduzione;
                        }
                        else if (chiave == "Meccanica" && mec == null)
                        {
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Esempio" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "1";
                            csvRec[chiave] = "1";
                        }
                        else if (chiave == "Esempio" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Grammatura" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = elementoPrimario[valore].ToString().Replace("-<br2>", " ");
                            csvRec[chiave] = elementoPrimario[valore].ToString().Replace("-<br2>", " ");
                        }
                        else if (chiave == "Grammatura" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Codice articolo POP" && elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "=\"" + elementoPrimario[valore].ToString() + "\"";
                            csvRec[chiave] = "=\"" + elementoPrimario[valore].ToString() + "\"";
                        }
                        else if (chiave == "Codice articolo POP" && !elementoPrimario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF DESCR")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "0";
                            //da implementare
                        }

                        if (chiave == "DIFF FOTO S")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "N_FOTO")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF ES")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF RUOLO")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "V-FV")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "ERR")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF SCATTO")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "";
                            csvRec[chiave] = "";

                        }

                        if (chiave == "C/S/P")
                        {
                            //arrayValoriElementiSoloPrimario[i] = "P";
                            csvRec[chiave] = "P";
                        }

                        //risultatoSoloPrimario.Add(arrayValoriElementiSoloPrimario);

                    }
                }


                if (elementoCorrispondenteSecondario != null)
                {
                    csvResultComuni.records.Add(csvRec);
                    tempi1_2.Add(DateTime.Now.Subtract(dtInizioEl).TotalMilliseconds);
                    tempi2_2.Add(DateTime.Now.Subtract(dtInizioElCols).TotalMilliseconds);
                }
                else
                {
                    csvResultSoloPrimario.records.Add(csvRec);
                    tempi1.Add(DateTime.Now.Subtract(dtInizioEl).TotalMilliseconds);
                    tempi2.Add(DateTime.Now.Subtract(dtInizioElCols).TotalMilliseconds);
                }

            }

            double totmsM1 = DateTime.Now.Subtract(momento1).TotalMilliseconds;

            double media_tempi1_2 = tempi1_2.Sum() / tempi1_2.Count;
            double media_tempi2_2 = tempi2_2.Sum() / tempi1_2.Count;

            DateTime momento2 = DateTime.Now;


            // Qui aggiungiamo la parte per iterare attraverso "secondario" e aggiungere elementi mancanti da "primario"
            foreach (var elementoSecondario in secondario)
            {
                Dictionary<string, string> csvRec = new Dictionary<string, string>();

                string codiceSecondario = elementoSecondario[keyRefCodice].ToString();
                Dictionary<string, object> elementoCorrispondentePrimario = new Dictionary<string, object>();
                if (controlloVersione)
                {
                    elementoCorrispondentePrimario = primario.FirstOrDefault(e => e[keyRefCodice].ToString() == codiceSecondario && e["id_tracciato"].ToString() == elementoSecondario["id_tracciato"].ToString());
                    primario.Remove(elementoCorrispondentePrimario);
                }
                else
                {
                    elementoCorrispondentePrimario = primario.FirstOrDefault(e => e[keyRefCodice].ToString() == codiceSecondario);
                    primario.Remove(elementoCorrispondentePrimario);
                }
                Meccanica mec = interpretaMeccanica(elementoSecondario, false, null);
                elementoSecondario[keyMeccanicaTradotta] = mec.NomeTraduzione;
                for (int i = 0; i < colonne.Count; i++)
                {
                    var coppia = colonne.ElementAt(i);
                    string chiave = coppia.Key;
                    string valore = coppia.Value;

                    if (elementoCorrispondentePrimario != null)
                    {
                        //non fare niente
                    }
                    else
                    {
                        if (valore != "" && elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = elementoSecondario[valore].ToString();
                            csvRec[chiave] = elementoSecondario[valore].ToString();
                        }
                        else
                        {
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Foto" && elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "S";
                            csvRec[chiave] = "S";
                        }
                        else if (chiave == "Foto" && !elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Meccanica" && mec != null)
                        {
                            //arrayValoriElementiComuni[i] = "S";
                            csvRec[chiave] = mec.NomeTraduzione;
                        }
                        else if (chiave == "Meccanica" && mec == null)
                        {
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Esempio" && elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "1";
                            csvRec[chiave] = "1";
                        }
                        else if (chiave == "Esempio" && !elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Grammatura" && elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = elementoSecondario[valore].ToString().Replace("-<br2>", " ");
                            csvRec[chiave] = elementoSecondario[valore].ToString().Replace("-<br2>", " ");
                        }
                        else if (chiave == "Grammatura" && !elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "Codice articolo POP" && elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "=\"" + elementoSecondario[valore].ToString() + "\"";
                            csvRec[chiave] = "=\"" + elementoSecondario[valore].ToString() + "\"";
                        }
                        else if (chiave == "Codice articolo POP" && !elementoSecondario.ContainsKey(valore))
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF DESCR")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "0";
                        }

                        if (chiave == "DIFF FOTO S")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "N_FOTO")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF ES")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF RUOLO")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "V-FV")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "ERR")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";
                        }

                        if (chiave == "DIFF SCATTO")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "";
                            csvRec[chiave] = "";

                        }

                        if (chiave == "C/S/P")
                        {
                            //arrayValoriElementiSoloSecondario[i] = "P";
                            csvRec[chiave] = "S";
                        }

                        //risultatoSoloSecondario.Add(arrayValoriElementiSoloSecondario);
                    }
                }
                if (elementoCorrispondentePrimario != null)
                {

                }
                else
                {
                    csvResultSoloSecondario.records.Add(csvRec);
                }
            }


            double totmsM2 = DateTime.Now.Subtract(momento2).TotalMilliseconds;


            Dictionary<string, string> csvRecSeparatoreComuni = new Dictionary<string, string>();
            Dictionary<string, string> csvRecSeparatorePrimari = new Dictionary<string, string>();
            Dictionary<string, string> csvRecSeparatoreSecondari = new Dictionary<string, string>();
            //for (int i = 0; i < colonne.Count; i++) //creo la riga per i record comuni
            //{
            //    if (i == 0)
            //    {
            //        colonneValori[i] = "Comuni";
            //    }
            //    else
            //    {
            //        colonneValori[i] = "";
            //    }
            //}

            DateTime momento3 = DateTime.Now;

            int count = 0;
            foreach (var item in colonne)
            {
                if (count == 0)
                {
                    csvRecSeparatoreComuni[item.Key] = "Comuni";
                    count++;
                }
                else
                {
                    csvRecSeparatoreComuni[item.Key] = "";
                }
            }
            csvResult.records.Add(csvRecSeparatoreComuni);
            csvResult.records.AddRange(csvResultComuni.records);

            count = 0;
            foreach (var item in colonne)
            {
                if (count == 0)
                {
                    csvRecSeparatorePrimari[item.Key] = "Solo primario";
                    count++;
                }
                else
                {
                    csvRecSeparatorePrimari[item.Key] = "";
                }
            }
            csvResult.records.Add(csvRecSeparatorePrimari);
            csvResult.records.AddRange(csvResultSoloPrimario.records);

            count = 0;
            foreach (var item in colonne)
            {
                if (count == 0)
                {
                    csvRecSeparatoreSecondari[item.Key] = "Solo secondario";
                    count++;
                }
                else
                {
                    csvRecSeparatoreSecondari[item.Key] = "";
                }
            }
            csvResult.records.Add(csvRecSeparatoreSecondari);
            csvResult.records.AddRange(csvResultSoloSecondario.records);

            double totmsM3 = DateTime.Now.Subtract(momento3).TotalMilliseconds;

            //risultato.Add(colonneValori);
            //risultato.AddRange(risultatoComuni);
            //for (int i = 0; i < colonne.Count; i++) //creo la riga per i record comuni
            //{
            //    if (i == 0)
            //    {
            //        colonneValori[i] = "Solo primario";
            //    }
            //    else
            //    {
            //        colonneValori[i] = "";
            //    }
            //}
            //risultato.Add(colonneValori);
            //risultato.AddRange(risultatoSoloPrimario);
            //for (int i = 0; i < colonne.Count; i++) //creo la riga per i record comuni
            //{
            //    if (i == 0)
            //    {
            //        colonneValori[i] = "Solo secondario";
            //    }
            //    else
            //    {
            //        colonneValori[i] = "";
            //    }
            //}
            //risultato.Add(colonneValori);
            //risultato.AddRange(risultatoSoloSecondario);

            double totMS = DateTime.Now.Subtract(inizio).TotalMilliseconds;

            string jsonResult = JsonConvert.SerializeObject(csvResult);
            return jsonResult;
        }

        public string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams)
        {
            throw new NotImplementedException();
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerCambioMeta(AnalisiPorpagazione analisiAzione, List<CambioMetaRecordTracciatoAzione> azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
            //throw new NotImplementedException();
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerModificaCampiOfferta(AnalisiPorpagazione analisiAzione, RevisioneCampiOffertaFromIndd azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
        }

        public AnalisiPorpagazioneResult analizzaPropagazionePerRevisione(AnalisiPorpagazione analisiAzione, RevisioneDescrizione azione)
        {
            AnalisiPorpagazioneResult res = new AnalisiPorpagazioneResult();
            res.priorita = PrioritaPropagazione.Safe;
            return res;
        }


        public List<q_records_per_getListaRevisione> specificaInOutVol(
    List<q_records_per_getListaRevisione> tracciatoRevisione,
    List<q_records_per_getListaRevisione> listaOrigine)
        {

            Stopwatch sw1 = new Stopwatch();
            sw1.Start();

            if (tracciatoRevisione == null)
            {
                return new List<q_records_per_getListaRevisione>();
            }

            if (listaOrigine == null)
            {
                listaOrigine = new List<q_records_per_getListaRevisione>();
            }

            var lookupOrigine = listaOrigine
                .GroupBy(f => $"{f.Area}_{f.Canale}_{f.Dato[Meta.ReferenzaCodice]}_{f.Label}")
                .ToDictionary(
                    g => g.Key,
                    g => g.First()
                );

            //
            // 1. Aggiorno InVol dei singoli.
            //
            var singoli = tracciatoRevisione
                .Where(x => x.Dato != null && !x.isGruppo)
                .ToList();



            foreach (var item in singoli)
            {
                var acComuni = item.Dato[Meta.keyACComuni] as List<ACcomuni>;



                if (acComuni == null)
                {
                    continue;
                }

                foreach (var ac in acComuni)
                {
                    var key = $"{ac.area}_{ac.canale}_{item.Dato[Meta.ReferenzaCodice]}_{ac.label}";



                    if (!lookupOrigine.TryGetValue(key, out var elementoCorrispondenteAC))
                    {
                        Debug.WriteLine("Errore");
                        ac.InVol = false;
                        continue;
                    }

                    var tipoVolantino = elementoCorrispondenteAC.Dato[Meta.tipo_volantino] as string;
                    ac.InVol = tipoVolantino != null && tipoVolantino.Contains("V - Volantino");
                }
            }

            //
            // 2. Preparo lookup dei singoli aggiornati per CodiceRef.
            //
            var singoliPerCodice = singoli
                .Where(x => x.Dato.ContainsKey(Meta.ReferenzaCodice))
                .GroupBy(x => x.Dato[Meta.ReferenzaCodice]?.ToString() ?? "")
                .ToDictionary(
                    g => g.Key,
                    g => g.ToList()
                );

            //
            // 3. Aggiorno InVol dei gruppi.
            //
            var gruppi = tracciatoRevisione
                .Where(x => x.Dato != null && x.isGruppo)
                .ToList();

            foreach (var gruppo in gruppi)
            {
                if (!gruppo.Dato.ContainsKey(Meta.ScattoCodiceGruppo))
                {
                    continue;
                }

                var codiceGruppo = gruppo.Dato[Meta.ScattoCodiceGruppo]?.ToString() ?? "";

                if (string.IsNullOrWhiteSpace(codiceGruppo))
                {
                    continue;
                }

                var codiciMembri = codiceGruppo
                    .Split(',')
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (codiciMembri.Contains("440110"))
                {
                    Console.WriteLine("");
                }

                var acComuniGruppo = gruppo.Dato[Meta.keyACComuni] as List<ACcomuni>;

                if (acComuniGruppo == null)
                {
                    continue;
                }

                foreach (var acGruppo in acComuniGruppo)
                {
                    bool gruppoInVol = true;

                    foreach (var codiceMembro in codiciMembri)
                    {
                        if (!singoliPerCodice.TryGetValue(codiceMembro, out var recordsMembro))
                        {
                            gruppoInVol = false;
                            break;
                        }

                        var recordMembroSuAC = recordsMembro
                            .FirstOrDefault(x =>
                            {
                                var acMembroList = x.Dato[Meta.keyACComuni] as List<ACcomuni>;

                                if (acMembroList == null)
                                {
                                    return false;
                                }

                                return acMembroList.Any(ac =>
                                    string.Equals(ac.area, acGruppo.area, StringComparison.OrdinalIgnoreCase) &&
                                    string.Equals(ac.canale, acGruppo.canale, StringComparison.OrdinalIgnoreCase)
                                );
                            });

                        if (recordMembroSuAC == null)
                        {
                            gruppoInVol = false;
                            break;
                        }

                        var acMembro = (recordMembroSuAC.Dato[Meta.keyACComuni] as List<ACcomuni>)
                            ?.FirstOrDefault(ac =>
                                string.Equals(ac.area, acGruppo.area, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(ac.canale, acGruppo.canale, StringComparison.OrdinalIgnoreCase)
                            );

                        if (acMembro == null || !acMembro.InVol)
                        {
                            gruppoInVol = false;
                            break;
                        }
                    }

                    acGruppo.InVol = gruppoInVol;
                }
            }

            sw1.Stop();
            return tracciatoRevisione;
        }

        public List<colonnaReportImportazione> getColonneReportImportaziones()
        {
            List<colonnaReportImportazione> colonneRichieste = new List<colonnaReportImportazione>();
            return colonneRichieste;
        }

        public string callbackNamingConventionDynamicField(string campo, Dictionary<string, object> rec, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione)
        {
            Console.WriteLine($"callbackNamingConventionDynamicField -> {campo}");

            if (campo == "isGruppo" || campo == "id_pop")
            {
                if (rec == null)
                {
                    return campo;
                }
                //A=Singolo G=Gruppo
                if (rec[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString() != rec[GLOBAL_VARIABLES_FICO.keyCodiceGruppo].ToString())
                {
                    if (campo == "id_pop")
                    {
                        return rec["id_pop"].ToString();
                    }
                    else if (campo == "isGruppo")
                        return "G";
                }
                else
                {
                    if (campo == "id_pop")
                    {
                        return rec["codice_articolo_pop"].ToString();
                    }
                    else if (campo == "isGruppo")
                        return "A";
                }
            }
            else if (campo == "codiceCanalexPoP")
            {
                try
                {
                    if (propsDeclinazione != null)
                    {
                        Console.WriteLine($"props declinazioni -> {propsDeclinazione.Count}");

                        var prop = propsDeclinazione.FirstOrDefault(d => d.chiaveCompilata == "tipo");
                        if (prop != null)
                        {
                            return prop.valore;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Errore in callbackNamingConventionDynamicField codiceCanalexPoP: {ex.ToString()}");
                }

                if (rec == null)
                {
                    return campo;
                }

                return rec["area"].ToString().Substring(0, 2);

            }
            else if (campo == "tematica")
            {
                string tema = "";
                try
                {
                    if (rec == null)
                    {
                        return campo;
                    }

                    if (rec.ContainsKey(GLOBAL_VARIABLES_FICO.keyContextPromo))
                    {
                        var ctxPromo = (rec[GLOBAL_VARIABLES_FICO.keyContextPromo] as JArray).ToObject<List<FicoContextField>>();

                        var objTema = ctxPromo.FirstOrDefault(d => d.nome_field == "tema");
                        if (objTema != null)
                        {
                            tema = objTema.user_value;
                        }

                    }

                    if (tema == "")
                    {
                        if (rec.ContainsKey(GLOBAL_VARIABLES_FICO.keyContextTracciato))
                        {
                            var ctxTrac = (rec[GLOBAL_VARIABLES_FICO.keyContextTracciato] as JArray).ToObject<List<FicoContextField>>();
                            var objTema = ctxTrac.FirstOrDefault(d => d.nome_field == "tema");
                            if (objTema != null)
                            {
                                tema = objTema.user_value;
                            }
                        }
                    }

                    if (rec.ContainsKey("tema_ricavato"))
                    {
                        return rec["tema_ricavato"].ToString();
                    }

                    if (tema == "")
                        return "VOL";
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Errore in callbackNamingConventionDynamicField tematica: {ex.Message}");
                    return "VOL";
                }

                return tema;
            }

            return "";
        }

        public List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string pathACPV)
        {
            return records;
        }

        public Dictionary<string, object> elaboraRecordDaClonare(Dictionary<string, object> origin, Dictionary<string, object> chiaviEliminate, SampleKitDiDestinazioneClone sample, string codiceBox, string pathOrdinamentoLista)
        {
            string keySegmento = Edro21Context.Meta.segmento;

            if (origin.ContainsKey(Meta.area) && sample.sampleData.ContainsKey(Meta.area))
            {
                origin[Meta.area] = sample.sampleData[Meta.area];
            }
            origin["areeIn"] = new List<string>();
            origin["areeOut"] = new List<string>();
            origin[GLOBAL_VARIABLES.keyIndiceOrdinamento] = 9999;
            origin[Meta.IndiceOridinamentoSezione] = 9999;

            string segmento = "";
            if (origin.ContainsKey(keySegmento))
            {
                segmento = origin[keySegmento].ToString();
                JObject o2 = JObject.Parse(File.ReadAllText(pathOrdinamentoLista));
                DbOrdinamento ordDB = o2.ToObject<DbOrdinamento>();
                dbGrammature = ordDB.source;

                Ordinamento grItem = dbGrammature.Where(g => g.CodiceSegmento == segmento).FirstOrDefault();


                if (grItem != null)
                {
                    origin[GLOBAL_VARIABLES.keyIndiceOrdinamento] = grItem.GlobalIndice;
                    origin[Meta.NomeGruppoOrdinamento] = grItem.Gruppo;
                    origin[Meta.keyFood] = grItem.Food;
                    origin[Meta.keyFluff] = grItem.Fluff;
                }
                else
                {
                    origin[Meta.NomeGruppoOrdinamento] = "";
                    origin[Meta.keyFood] = false;
                    origin[Meta.keyFluff] = false;
                }
            }
            return origin;
        }


        #region Cambio strutturale


        public static class Campi
        {
            public const string Distintivita = "distintivita";
            public const string AllEtichette = "allEtichette";
            public const string Sezione = "sezione";
        }

        public List<CambioStrutturale> GetCambioStrutturalePath()
        {
            return new List<CambioStrutturale>
            {
                BuildForzaFormatSdb(),
                BuildRimuoviFormatSdb(),
                BuildForzaFormatIstituzionale(),
                BuildForzaFormatNelCorpoDelVolantino()
            };
        }

        private static CambioStrutturale BuildForzaFormatSdb()
        {
            return new CambioStrutturale
            {
                Id = 1,
                Titolo = "Forza format SDB",
                Istruzioni = new List<IstruzioneCambio>
                {
                    new IstruzioneCambio
                    {
                        Field = "distintivita",
                        Operazione = TipoOperazione.AppendText,
                        Valore = " benessere"
                    }
                },
                Condizione = new List<BloccoRegole>
                {
                    new BloccoRegole
                    {
                        Id = 1,
                        Deepness = 0,
                        Regole = new List<RegolaCondizione>
                        {
                            new RegolaCondizione
                            {
                                Campo = Campi.Distintivita,
                                Operatore = OperatoreCondizione.NotContains,
                                Value = "benessere"
                            }
                        }
                    }
                }
            };
        }

        private static CambioStrutturale BuildRimuoviFormatSdb()
        {
            return new CambioStrutturale
            {
                Id = 2,
                Titolo = "Rimuovi format SDB",
                Istruzioni = new List<IstruzioneCambio>
                {
                    new IstruzioneCambio
                    {
                        Field = "distintivita",
                        Operazione = TipoOperazione.RemoveText,
                        Valore = "benessere"
                    }
                },
                Condizione = new List<BloccoRegole>
                {
                    new BloccoRegole
                    {
                        Id = 1,
                        Deepness = 0,
                        Regole = new List<RegolaCondizione>
                        {
                            new RegolaCondizione
                            {
                                Campo = Campi.Distintivita,
                                Operatore = OperatoreCondizione.Contains,
                                Value = "benessere"
                            }
                        }
                    }
                }
            };
        }

        private static CambioStrutturale BuildForzaFormatIstituzionale()
        {
            return new CambioStrutturale
            {
                Id = 3,
                Titolo = "Forza format B&F \"ISTITUZIONALE\"",
                Istruzioni = new List<IstruzioneCambio>
                {
                    new IstruzioneCambio
                    {
                        Field = "sezione",
                        Operazione = TipoOperazione.Set,
                        Valore = "B&F RICHIAMO VOLANTINO"
                    }
                },
                Condizione = new List<BloccoRegole>
                {
                    new BloccoRegole
                    {
                        Id = 1,
                        Deepness = 0,
                        Regole = new List<RegolaCondizione>
                        {
                            new RegolaCondizione
                            {
                                Campo = Campi.AllEtichette,
                                Operatore = OperatoreCondizione.NotIn,
                                Value = "ISTITUZIONALE"
                            }
                        },
                    }
                }
            };
        }

        private static CambioStrutturale BuildForzaFormatNelCorpoDelVolantino()
        {
            return new CambioStrutturale
            {
                Id = 4,
                Titolo = "Forza format B&F \"Nel corpo del volantino\"",
                Istruzioni = new List<IstruzioneCambio>
                {
                    new IstruzioneCambio
                    {
                        Field = "sezione",
                        Operazione = TipoOperazione.Set,
                        Valore = ""
                    }
                },
                Condizione = new List<BloccoRegole>
                {
                    new BloccoRegole
                    {
                        Id = 1,
                        Deepness = 0,
                        Regole = new List<RegolaCondizione>
                        {
                            new RegolaCondizione
                            {
                                Campo = Campi.AllEtichette,
                                Operatore = OperatoreCondizione.In,
                                Value = "ISTITUZIONALE"
                            }
                        }
                    }
                }
            };
        }

        #endregion


        public string MetaPerRevisione(
    List<Dictionary<string, object>> recordsGruppo,
    int idPromo,
    int idTracciato,
    string siglaTracciato)
        {
            if (recordsGruppo == null || recordsGruppo.Count == 0)
            {
                return "";
            }

            var el = recordsGruppo[0];

            var struttura = new StrutturaMetaPerRevisione
            {
                idPromo = idPromo,
                idTracciato = idTracciato,
                siglaTracciato = siglaTracciato ?? "",
                chiaviMeta = ""
            };

            if (el.ContainsKey(Meta.keyDataEstrazione))
            {
                struttura.chiaviMeta = JsonConvert.SerializeObject(new Dictionary<string, object>
        {
            { Meta.keyDataEstrazione, el[Meta.keyDataEstrazione] }
        });
            }

            return JsonConvert.SerializeObject(struttura);
        }

        public EsitoFirmaGarantita CheckFirmaGarantita(List<Dictionary<string, object>> recordsGruppo, string meta)
        {
            var result = new EsitoFirmaGarantita();

            if (recordsGruppo == null || recordsGruppo.Count == 0)
            {
                return result;
            }

            if (string.IsNullOrWhiteSpace(meta))
            {
                return result;
            }

            var primoRecord = recordsGruppo[0];

            if (!primoRecord.ContainsKey(Meta.keyDataEstrazione))
            {
                return result;
            }

            try
            {
                var struttura = JsonConvert.DeserializeObject<StrutturaMetaPerRevisione>(meta);

                if (struttura == null)
                {
                    return result;
                }

                if (string.IsNullOrWhiteSpace(struttura.chiaviMeta))
                {
                    return result;
                }

                var metaCustom = JsonConvert.DeserializeObject<Dictionary<string, object>>(struttura.chiaviMeta);

                if (metaCustom == null || !metaCustom.ContainsKey(Meta.keyDataEstrazione))
                {
                    return result;
                }

                if (!DateTime.TryParse(
                        Convert.ToString(primoRecord[Meta.keyDataEstrazione]),
                        out DateTime dataEstrazioneRecordProposto))
                {
                    return result;
                }

                if (!DateTime.TryParse(
                        Convert.ToString(metaCustom[Meta.keyDataEstrazione]),
                        out DateTime dataEstrazioneMetaRevisionato))
                {
                    return result;
                }

                // Caso 1:
                // Il garante proposto ha data minore o uguale di quella nel meta.
                // Vince il garante storico scritto nel recordRevisionato.Meta.
                if (dataEstrazioneMetaRevisionato >= dataEstrazioneRecordProposto)
                {
                    result.garantita = true;
                    result.siglaTracciatoFirmaGarantita = struttura.siglaTracciato ?? "";
                }

                return result;
            }
            catch
            {
                return result;
            }
        }

        public string GetMetaPerRevisioneDaGruppiMultipli(WrapperPerGetGarante wrap)
        {
            bool TryParseDataEstrazione(object value, out DateTime dataEstrazione)
            {
                dataEstrazione = default(DateTime);

                if (value == null)
                {
                    return false;
                }

                if (value is DateTime dt)
                {
                    dataEstrazione = dt;
                    return true;
                }

                string valueString = value.ToString();

                if (string.IsNullOrWhiteSpace(valueString))
                {
                    return false;
                }

                return DateTime.TryParse(valueString, out dataEstrazione);
            }


            if (wrap == null || wrap.gruppiPerTracciato == null || wrap.gruppiPerTracciato.Count == 0)
            {
                return JsonConvert.SerializeObject(new RitornoMetaPerRevisioneGarante());
            }

            WrapperGruppoConTracciato gruppoGarante = null;
            DateTime? dataMigliore = null;

            foreach (var gruppoConTracciato in wrap.gruppiPerTracciato)
            {
                if (gruppoConTracciato == null || gruppoConTracciato.gruppo == null || gruppoConTracciato.gruppo.Count == 0)
                {
                    continue;
                }

                var primoElemento = gruppoConTracciato.gruppo[0];

                if (primoElemento == null || !primoElemento.ContainsKey(Meta.keyDataEstrazione))
                {
                    continue;
                }

                var rawDataEstrazione = primoElemento[Meta.keyDataEstrazione];

                DateTime dataEstrazione;
                if (!TryParseDataEstrazione(rawDataEstrazione, out dataEstrazione))
                {
                    continue;
                }

                if (gruppoGarante == null || dataMigliore == null || dataEstrazione > dataMigliore.Value)
                {
                    gruppoGarante = gruppoConTracciato;
                    dataMigliore = dataEstrazione;
                }
            }

            if (gruppoGarante == null)
            {
                return JsonConvert.SerializeObject(new RitornoMetaPerRevisioneGarante());
            }

            string metaRev = MetaPerRevisione(
                gruppoGarante.gruppo,
                wrap.idPromo,
                gruppoGarante.idTracciato,
                gruppoGarante.siglaTracciato
            );

            var result = new RitornoMetaPerRevisioneGarante
            {
                metaRev = metaRev ?? "",
                idPromo = wrap.idPromo,
                idTracciato = gruppoGarante.idTracciato,
                siglaTracciato = gruppoGarante.siglaTracciato ?? "",
                gruppo = gruppoGarante.gruppo ?? new List<Dictionary<string, object>>()
            };

            return JsonConvert.SerializeObject(result);
        }

        public string GetMetaPerRevisioneDaGruppiMultipliBatch(WrapperBatchPerGetGarante batch)
        {
            var result = new RitornoBatchGarante();

            if (batch == null || batch.items == null || batch.items.Count == 0)
            {
                return JsonConvert.SerializeObject(result);
            }

            foreach (var item in batch.items)
            {
                if (item == null || item.wrap == null)
                {
                    continue;
                }

                string resultJson = GetMetaPerRevisioneDaGruppiMultipli(item.wrap);

                var garante = !string.IsNullOrWhiteSpace(resultJson)
                    ? JsonConvert.DeserializeObject<RitornoMetaPerRevisioneGarante>(resultJson)
                    : null;

                if (garante == null || garante.gruppo == null || garante.gruppo.Count == 0)
                {
                    result.items.Add(new RitornoItemGarante
                    {
                        key = item.key
                    });

                    continue;
                }

                var esitoFirmaGarantita = CheckFirmaGarantita(
    garante.gruppo,
    item.meta
);

                result.items.Add(new RitornoItemGarante
                {
                    key = item.key,
                    metaRev = garante.metaRev ?? "",

                    idPromo = garante.idPromo,
                    idTracciato = garante.idTracciato,
                    siglaTracciato = garante.siglaTracciato ?? "",

                    gruppo = garante.gruppo ?? new List<Dictionary<string, object>>(),

                    firmaGarantita = esitoFirmaGarantita.garantita,
                    siglaTracciatoFirmaGarantita = esitoFirmaGarantita.siglaTracciatoFirmaGarantita ?? ""
                });
            }

            return JsonConvert.SerializeObject(result);
        }

        /// Records che il conteggio delle revisioni deve considerare, con la stessa regola
        /// della pagina del revisore: vedere FiltroRevisioneReparto. Chiamata da Istanta per
        /// nome tramite execLibFunction, che lega i parametri per nome: "records" e "utente".
        public List<Dictionary<string, object>> FiltraRecordsPerConteggioRevisione(
    List<Dictionary<string, object>> records,
    string utente)
        {
            return FiltroRevisioneReparto.Filtra(records, utente);
        }


        public string CheckFirmaPluginGarantitaBatch(WrapperBatchCheckFirmaPlugin batch)
        {
            var result = new RitornoBatchCheckFirmaPlugin();

            if (batch == null || batch.items == null || batch.items.Count == 0)
            {
                return JsonConvert.SerializeObject(result);
            }

            foreach (var item in batch.items)
            {
                if (item == null || item.recordsGruppo == null || item.recordsGruppo.Count == 0)
                {
                    result.items.Add(new RitornoItemCheckFirmaPlugin
                    {
                        key = item?.key ?? "",
                        firmaGarantita = false,
                        siglaTracciatoFirmaGarantita = ""
                    });

                    continue;
                }

                var esito = CheckFirmaGarantita(
                    item.recordsGruppo,
                    item.meta
                );

                result.items.Add(new RitornoItemCheckFirmaPlugin
                {
                    key = item.key ?? "",
                    firmaGarantita = esito != null && esito.garantita,
                    siglaTracciatoFirmaGarantita = esito?.siglaTracciatoFirmaGarantita ?? ""
                });
            }

            return JsonConvert.SerializeObject(result);
        }
    }
}