//using ImageMagick;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
//using System.Text.Json.Serialization;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Security.Permissions;
using System.Security.Policy;
using System.Text;
using System.Threading.Tasks;

namespace IstantaLib
{

    public enum FicoCombinazioniKitStato
    {
        ATTIVO = 1,
        DISATTIVO = 0
    }

    public enum FicoCombinazioneKitReadMode
    {
        OnlyMeta=1,//Dato letto solo a livello tracciato
        Classic=2,//Dato che comprende anche i dettagli core (foto/descrizioni ecc)
        Advanced=3,//Dato che raccoglie informazioni ancor più avanate (da capire con Marco)
        Host=4//Host: Al momento solo FP che ha bisongo esclusivamente della lista dei files che verranno propdotti MA che in tal senso potrebbe significare scaricare info specifiche 
    }
    public enum FicoTipoDiExportMode
    {
        TutteLePagine = 1,
        SingolaPagina = 2
    }

    public enum TipoLavorazione
    {
        Volantino = 1,
        PoP = 2
    }

    public enum FicoUserType
    {
        Superadmin = 1,
        Agenzia = 2,
        Guest = 3,
        GDO = 4,
        PuntoVendita = 5,//Sempre riferito a GDO
        Category = 6,//Sempre riferito a GDO
        Marketing = 7,//Sempre riferito a GDO
        IT = 8,//Sempre riferito a GDO
    }

    public enum FitOperation
    {
        FRAME_TO_CONTENT,
        CONTENT_TO_FRAME,
        PROPORTIONALLY,
        FILL_PROPORTIONALLY
    }

    public enum ErrorCodesFico
    {
        None = 0,
        Generic = 1,
        ListaAzzerataInEsportazione = 2
    }
    public class FotoElementoGruppo
    {
        public string codRef { get; set; }
        public string nomeFoto { get; set; }
        public Byte statoSelezione { get; set; }
        public string hash { get; set; }
        /// <summary>
        /// Quando true il Plugin impagina comunque questa foto ma la rende invisibile
        /// nel documento. L'assenza del valore equivale a false.
        /// </summary>
        public bool noRender { get; set; }
    }
    public class FicoContextField
    {
        public string nome_field { get; set; } = String.Empty;
        public string user_value { get; set; } = String.Empty;
    }
    public class FicoCombinazioniKitResponse
    {
        public List<FicoCombinazioneKit> content { get; set; }        
        public bool esito { get; set; }
        public string error { get; set; }

    }
    public class FicoRuntimeKitResponse
    {
        public List<FicoRuntimeKit> content { get; set; }
        public bool esito { get; set; }
        public string error { get; set; }

    }

    public class FicoCombinazioneKit
    {
        public string guidId { get; set; }
        public string guidArea { get; set; }
        public string guidCanale { get; set; }
        public string guidPV { get; set; }
        public string guidFormato { get; set; }
        public Int16 quantitaCopie { get; set; }
        public string titolo { get; set; }
        public string guidIdRaccoglitore { get; set; }
        public FicoCombinazioniKitStato stato { get; set; }

        public List<FicoCombinazioniKitFiltro> filtroContesto { get; set; }
        public List<FicoCombinazioniKitFiltro> filtro { get; set; }
        public List<FicoCombinazioniKitDeclinazione> declinazioni { get; set; }
        public List<TipoDiExportInKit> tipiDiExportInKit { get; set; }
        //public List<FicoNamingConventionField> namingConvention { get; set; }
        public List<FicoContextField> context { get; set; }
        public List<ArticoloInKit> records { get; set; } = new List<ArticoloInKit>();
        //public List<string> fileNames { get; set; }

    }

    public class FicoRuntimeKit
    {
        public string guidId { get; set; }
        public string guidIdDesign { get; set; }
        public string guidArea { get; set; }
        public string guidCanale { get; set; }
        public string guidPV { get; set; }
        public string guidFormato { get; set; }
        public string idPromo { get; set; }
        public List<TipoDiExportInKit> tipiDiExportInKit { get; set; }
        public Int16 quantitaCopie { get; set; }
        public string titolo { get; set; }
        public string guidIdRaccoglitore { get; set; }
        //public FicoCombinazioniKitStato stato { get; set; }
//        public List<FicoNamingConventionField> namingConvention { get; set; }
        public List<FicoContextField> context { get; set; }
        //public FicoCombinazioniKitStato stato { get; set; }

        public List<FicoCombinazioniKitFiltro> filtroContesto { get; set; }
        public List<FicoCombinazioniKitFiltro> filtro { get; set; }

        public List<FicoCombinazioniKitDeclinazione> declinazioni { get; set; }
        public List<ArticoloInKit> records { get; set; } = new List<ArticoloInKit>();

        public List<FileDesignInKit> files { get; set; }
    }

    public class FicoRuntimeFromFPRequest
    {
        public FicoRuntimeKit kit { get; set; }
        public List<string> dataFieldsRequest { get; set; }
    }

    public class FicoCombinazioniKitFiltro
    {
        public string titoloFiltro { get; set; }
        public List<FicoCombinazioniKitFiltroCondizione> condizioni { get; set; }
    }

    public class FicoCombinazioniKitFiltroCondizione
    {
        public string nome_field { get; set; }
        public string operatore { get; set; }
        public string valore { get; set; }
        public string idAddestramento { get; set; }

    }

    public class FileDesignInKit
    {
        public string id { get; set; }
        public string direttive { get; set; }
        public string nome { get; set; }
        public string nome_originale { get; set; }
        public bool isOptional { get; set; }
        public string id_olimpo_cloud { get; set; }
        public string blob { get; set; }
        public string mime { get; set; }
        public string error { get; set; }

    }

    public class FicoCombinazioniKitDeclinazione
    {
        public string titolo { get; set; }
        public List<FicoCombinazioniKitDeclinazioneProprieta> proprieta { get; set; }
        public List<FicoCombinazioniKitFiltro> filtri { get; set; }

    }

    public class FicoCombinazioniKitDeclinazioneProprieta
    {
        public Int16 idChiave { get; set; }
        public string chiaveCompilata { get; set; }
        public string valore { get; set; }
    }

    public class FicoDeclinazioneKitRuntime
    {
        public string Nome { get; set; }
        public List<FicoCombinazioniKitDeclinazioneProprieta> Proprieta { get; set; }

        public List<ArticoloInKitExportName> Codifica { get; set; }
    }

    public class TipoDiExport
    {
        public string guidID { get; set; }
        public string titolo { get; set; }
        public string codice { get; set; }
        public string guidIdNamingConvention { get; set; }
        public List<FicoCombinazioniKitFiltro> filtro { get; set; }
        public FicoTipoDiExportMode modalita { get; set; } //1= tutte le pagine, 2= pagina singola

    }
    public class Formato
    {
        public string guidID { get; set; }
        public string titolo { get; set; }
        public string codice { get; set; }
        public string descrizione { get; set; }
        public TipoLavorazione tipo { get; set; }
        public List<FormatoDettagli> dettagliGriglie { get; set; } = new List<FormatoDettagli>();
        public List<regoleGriglia> regoleGriglie { get; set; } = new List<regoleGriglia>();

    }

    public class FormatoDettagli
    {
        public Int16 pag { get; set; }
        public List<string> griglie { get; set; }

    }

    public class regoleGriglia
    {
        public List<string> nomiGriglie { get; set; }
        public List<RegolaComparazioneFormato> regoleFormato { get; set; } = new List<RegolaComparazioneFormato>();
        public bool includi { get; set; } = false;

    }


    public class RegolaComparazioneFormato
    {
        public string guidArea { get; set; } = "";
        public string guidCanale { get; set; } = "";
        public List<int> pagVal { get; set; } = new List<int>();
        public List<RegolaComparazioneContext> condizioniPromoContesto { get; set; } = new List<RegolaComparazioneContext>();
        public List<RegolaComparazioneContext> condizioniTracciatoContesto { get; set; } = new List<RegolaComparazioneContext>();
        
    }

    public class RegolaComparazioneContext
    {
        public string Value { get; set; }
        public string campo { get; set; }
        public string Operatore { get; set; }
    }

    public class TipoDiExportInKit
    {
        public string tipoDiExportGuidID { get; set; }
        public List<FicoCombinazioniKitFiltro> filtro { get; set; }
    }

    public class FicoNamingConvention
    {
        public List<FicoNamingConventionComponent> components;
        public List<FicoNamingConventionCombinazione> combinazioni;

    }

    public class FicoNamingConventionCombinazione
    {
        public string guidId { get; set; }
        public List<string> combinazione { get; set; }
    }

    public class FicoNamingConventionComponent
    {
        public string Id { get; set; }
        public string Nome { get; set; }
        public string NomeVisual { get; set; }
        public string Descrizione { get; set; }
    }

    public class FicoSchemaAddestramento
    {
        public Int64 Id { get; set; }
        public string Nome { get; set; }
        public List<FicoSchemaAddestramentoField> fields { get; set; }
    }

    public class FicoSchemaAddestramentoField
    {
        public Int64 IdCampo { get; set; }
        public int IdAddestramento { get; set; }
        public string NomeColonnaOriginale { get; set; }
        public short Indice { get; set; }
        public string NomeColonna { get; set; }
        public string NomeVisualizzato { get; set; }
    }

    public class FicoContextSchemeField
    {
        public string nome_field { get; set; } = String.Empty;
        public List<FicoContextSchemeFieldValue> valore { get; set; }
    }

    public class FicoContextSchemeFieldValue
    {
        public string titolo { get; set;}
        public string valore { get; set; }
    }
        
    public class FicoContextScheme
    {
        public string titolo { get; set; }
        public List<FicoContextSchemeField> ficoContextFields { get; set; }

    }

    public static class GLOBAL_VARIABLES_FICO
    {
        public static readonly string keyNomeFileEsportazione = "NomiFilesEsportazione";
        public static readonly string keyRefCodice = "Referenza.Codice";
        public static readonly string keyRefCodiceOrigin = "Origin.Codice";
        public static readonly string keyEanCodice = "Referenza.Ean";
        public static readonly string keyDescrizione1 = "Descrizioni.Descrizione1";
        public static readonly string keyDescrizione2 = "Descrizioni.Descrizione2";
        public static readonly string keyDescrizione3 = "Descrizioni.Descrizione3";
        public static readonly string keyDescrizione4 = "Descrizioni.Descrizione4";
        public static readonly string keyDescr1Tracciato = "Descrizioni.Descrizione1Tracciato";
        public static readonly string keyDescr2Tracciato = "Descrizioni.Descrizione2Tracciato";
        public static readonly string keyDescr3Tracciato = "Descrizioni.Descrizione3Tracciato";
        public static readonly string keyDescr4Tracciato = "Descrizioni.Descrizione4Tracciato";
        public static readonly string keyDescrizioneIndd = "Descrizioni.DescrizioneIndd";
        public static readonly string keySuggerimentoDescrizione1 = "Descrizioni.Suggerimento1";
        public static readonly string keySuggerimentoDescrizione2 = "Descrizioni.Suggerimento2";
        public static readonly string keySuggerimentoDescrizione3 = "Descrizioni.Suggerimento3";
        public static readonly string keySuggerimentoDescrizione4 = "Descrizioni.Suggerimento4";
        public static readonly string keySuggerimentoDescrizioneGruppo1 = "Descrizioni.SuggerimentoGruppo1";
        public static readonly string keySuggerimentoDescrizioneGruppo2 = "Descrizioni.SuggerimentoGruppo2";
        public static readonly string keySuggerimentoDescrizioneGruppo3 = "Descrizioni.SuggerimentoGruppo3";
        public static readonly string keySuggerimentoDescrizioneGruppo4 = "Descrizioni.SuggerimentoGruppo4";

        public static readonly string keyDescrUm = "Descrizioni.Um";
        public static readonly string keyDescrPeso = "Descrizioni.Peso";
        public static readonly string keyFotoNome = "Foto.Nome";
        public static readonly string keyFotoHash = "Foto.Hash";
        public static readonly string keyFotoUri = "Foto.OriginUri";//Se le GDO implementano una loro api o servizio di fruizione immagini allo stato grezzo, imposta la uri qui che viene poi usata dal SYNC per poter fare una raccolta automatica di foto da processare internamente
        public static readonly string keyFotoSelezioeDaTracciato = "Foto.SelezioneDaTracciato";
        public static readonly string keyMembriGruppoFoto = "membriGruppoFoto";


        public static readonly string keyDescrizioneGruppo = "descrizione_gruppo";
        public static readonly string keyCodiceGruppo = "Scatto.CodiceGruppo";
        public static readonly string keySottoGruppo = "Scatto.CodiceSottogruppo";

        public static readonly string keyAreaContext = "GuidArea";
        public static readonly string keyCanaleContext = "GuidCanale";
        public static readonly string keyPVContext = "GuidPV";

        public static readonly string keyTracciatoFirma = "Tracciato.Firma";
        public static readonly string keyFirmaRevisione = "FirmaRevisione";

        public static readonly string keyFicoDeclinazioni = "Kit.Declinazioni";
        public static readonly string keyFicoNames = "Kit.Names";
        public static readonly string codiceBox = "codiceBox";

        public static readonly string compiledFieldKeyMastro = "Mastro";

        public static readonly string keyVersioneTracciato = "Tracciato.Versione";
        public static readonly string keyXlsxTracciato = "Tracciato.Xlsx";
        public static readonly string keyLabel = "Tracciato.Label";
        public static readonly string keyContextPromo = "Context.Promo";
        public static readonly string keyContextTracciato = "Context.Tracciato";
        public static readonly string keyKitDeclinazioni = "Kit.Declinazioni";
        public static readonly string descrizioniStileHidden = "$Hidden";



    }

    public class ArticoloInKitExportName
    {
        public string guidIdTipoExport { get; set; }
        public string nomeFile { get; set; }
    }

    public class ArticoloInKit
    {
        public Int64 IdRec { get; set; }
        public Dictionary<string, object> recordInTracciato;
        public Dictionary<string, object> sottogruppo;
        public bool forzaSoloUscitaSottogruppo { get; set; } = false;

        //public List<AritcoloInKitExportName> names= new List<AritcoloInKitExportName>();
        //public List<AritcoloInKitExportName> groupNames= new List<AritcoloInKitExportName>();
        public List<string> allEtichette = new List<string>();
        public List<string> etichetteVisual = new List<string>();
        public string label;
        public string firmaRevisione = "";
    }

    public class TracciatoKit
    {
        public string errors = "";
        public List<ArticoloInKit> Records=new List<ArticoloInKit>();
    }

    public class TracciatoResultKit
    {
        public string errors = "";
        public ErrorCodesFico errorCode = ErrorCodesFico.None;
        public List<TracciatoKit> liste = new List<TracciatoKit>();
    }

    public class LogoBollo:ICloneable
    {
        public string id { get; set; }
        public string nome { get; set; }
        public string guidId { get; set; }//Olympus ID
        public string sigla { get; set; }
        public string dataModifica { get; set; }
        public TipoFoto tipo { get; set; }
        public bool escluso { get; set; } = false;

        public object Clone()
        {
            return new LogoBollo() { 
                id = this.id,
                nome = this.nome,
                guidId = this.guidId,
                sigla = this.sigla,
                dataModifica = this.dataModifica,
                tipo = this.tipo,
                escluso = this.escluso
            };
        }
    }

    public class LogoBollo_ExtraNoAuto
    {
        public int id { get; set; }
        public bool attiva { get; set; }
        public string area { get; set; } = null;
        public string canale { get; set; } = null;
        public string guidId { get; set; }
        public string nome { get; set; }//Olympus ID
        public Byte statoSelezione { get; set; }
        public Byte tipo { get; set; }

        public bool puntatore { get; set; } = false;
        public string sigla { get; set; } = "";
    }

    public class fotoExtraForFP
    {
        public string guidId { get; set; }
        public bool attiva { get; set; }
        public string sigla { get; set; }
        public TipoFoto tipo { get; set; }
    }

    public class CompiledField
    {
        public string paragraphName { get; set; }//paragraph in InDesign. Se vuoto non viene trattato
        public string labelName { get; set; }//label in InDesign
        public string content { get; set; }
    }

    public class BoxIndd
    {
        public string codiceBox = "";
        public List<string> labelCampiBox = new List<string>();
    }

    public class RevisioneDescrizione
    {
        public string descrizione1 { get; set; }
        public string descrizione2 { get; set; }
        public string descrizione3 { get; set; }
        public string descrizione4 { get; set; }
        public string valore { get; set; }
        public string valoreInddSoloFondamentali { get; set; }
        public string valoreIndd { get; set; }

        public string meta { get; set; }

    }

    public class DatiRegionali
    {
        public string canale { get; set; }
        public string area { get; set; }
        public string custom { get; set; }

    }

    public class RevisioneCampiOffertaFromIndd
    {
        public string label { get; set; }
        public string labelUniversale { get; set; }
        public string valore { get; set; }
        public string valoreInddSoloFondamentali { get; set; }
        public string valoreIndd { get; set; }

    }

    public class CambioMetaRecordTracciatoAzione
    {
        public string codice { get; set; }//Identificativo di un singolo all'interno della prestazione coinvolta nell'alterazione
        public string codiceSottoGruppo { get; set; }//Identificativo di un sottogruppo all'interno della prestazione coinvolta nell'alterazione
        public Dictionary<string, object> attributi { get; set; }
    }

    public class CambioMetaRecordTracciatoAzioneRequest
    {
        public string codice { get; set; }//Identificativo di un singolo all'interno della prestazione coinvolta nell'alterazione
        public string codiceSottoGruppo { get; set; }//Identificativo di un sottogruppo all'interno della prestazione coinvolta nell'alterazione
        public Dictionary<string, string> attributi { get; set; }
    }


    public class AnalisiPorpagazione
    {
        public Dictionary<string, object> recDestinazione { get; set; }
        public Area areaDestinazione {get; set;}
        public Canale canaleDestinazione { get; set; }
        public Dictionary<string, object> recOrigine { get; set; }
        public Area areaOrigine { get; set; }
        public Canale canaleOrigine { get; set; }


    }

    public class AnalisiPorpagazioneResult
    {
        public PrioritaPropagazione priorita { get; set; }
    }

    public class MappaStili
    {
        public List<Stili> stileList { get; set; }
    }

    public class Stili
    {
        public string meccanica { get; set; }
        public string nome_campo { get; set; }
        public string stile { get; set; }

    }

    public class SampleKitDiDestinazioneClone
    {
        public string codiceArea { get; set; }
        public string codiceCanale { get; set; }
        public string codiceFormato { get; set; }
        public byte idAddestramento { get; set; }
        public string label { get; set; }
        public List<FicoContextField> context { get; set; }
        public Dictionary<string, object> sampleData { get; set; }
    }

    public class richiestaClonazione
    {
        public byte idAddestramento { get; set; }
        public byte pagina { get; set; }
        public string label { get; set; }
        public string codiceBox { get; set; }
        public List<string> meta { get; set; }
    }


    public class CambioStrutturale
    {
        public int Id { get; set; }
        public string Titolo { get; set; } = string.Empty;
        public List<IstruzioneCambio> Istruzioni { get; set; } = new List<IstruzioneCambio>();
        public List<BloccoRegole> Condizione { get; set; } = new List<BloccoRegole>();
        public string LabelElementCorreggo { get; set; } = null;
        public List<CampoInddCoinvolto> CampiInddCoinvolti { get; set; } = new List<CampoInddCoinvolto>();
    }

    public class CampoInddCoinvolto
    {
        public string Label { get; set; } = string.Empty;
        public string Item { get; set; } = null;
    }

    public class IstruzioneCambio
    {
        public string Field { get; set; } = string.Empty;
        public TipoOperazione Operazione { get; set; } = TipoOperazione.Set;
        public string Valore { get; set; }

        public bool Primary { get; set; }
    }

    public class BloccoRegole
    {
        public int Id { get; set; }
        public int Deepness { get; set; }
        public List<RegolaCondizione> Regole { get; set; } = new List<RegolaCondizione>();
        public List<BloccoRegole> RegoleAnnidate { get; set; } = new List<BloccoRegole>();
    }

    public class RegolaCondizione
    {
        public bool isBox { get; set; } = false;
        public string Campo { get; set; } = string.Empty;
        public OperatoreCondizione Operatore { get; set; } = OperatoreCondizione.Equals;
        public string Value { get; set; } = string.Empty;
    }

    public class Istruzione
    {
        public TipoOperazione Operazione { get; set; } = TipoOperazione.Set;
        public string Valore { get; set; }
    }



    //[System.Text.Json.Serialization.JsonConverter(typeof(JsonStringEnumConverter))]
    public enum OperatoreCondizione
    {
        Equals,
        NotEquals,
        Contains,
        NotContains,
        In,
        NotIn,
        Exist,
        NotExist
    }

    //[System.Text.Json.Serialization.JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TipoOperazione
    {
        Set,
        AppendText,
        RemoveText,
        AddToList,
        RemoveFromList
    }

    public enum TipoFoto
    {
        Foto = 1,
        Bollino = 2,
        Logo = 3,
        Ambientata = 4,
        Sfondo=5,
        Artwork=6
    }

    public enum PrioritaPropagazione
    {
        Danger=1,
        Warning=2,
        Safe=3,
        None=4
    }
    public enum StatoPropagazione
    {
        Segnalato=1,
        Svolto=2,
        Scartato=3
    }

    public static class RefCloner
    {
        public static Dictionary<string, object> Clona(Dictionary<string, object> origin)
        {
            var result = new Dictionary<string, object>();
            foreach (var item in origin)
            {
                result.Add(item.Key, item.Value);
            }
            return result;

        }
        public static Dictionary<string, object> CopiaETrasformaObjSingoloInObjSottogruppo(Dictionary<string, object> origin)
        {
            var result = new Dictionary<string, object>();
            foreach (var item in origin)
            {
                result.Add(item.Key, item.Value);
            }
            //Cambio del Cod Ref
            result[GLOBAL_VARIABLES_FICO.keyRefCodiceOrigin] = result[GLOBAL_VARIABLES_FICO.keyRefCodice];
            result[GLOBAL_VARIABLES_FICO.keyRefCodice] = origin[GLOBAL_VARIABLES_FICO.keySottoGruppo];

            if (origin.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizioneGruppo))
            {
                //Cambio anche le descrizioni dato che il sottogruppo avrà una propria fisicità
                Dictionary<string, object> descrGruppo = origin[GLOBAL_VARIABLES_FICO.keyDescrizioneGruppo] as Dictionary<string, object>;

                result[GLOBAL_VARIABLES_FICO.keyDescrizione1] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrizione1];
                result[GLOBAL_VARIABLES_FICO.keyDescrizione2] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrizione2];
                result[GLOBAL_VARIABLES_FICO.keyDescrizione3] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrizione3];
                result[GLOBAL_VARIABLES_FICO.keyDescrizione4] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrizione4];
                if (descrGruppo.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrUm))
                    result[GLOBAL_VARIABLES_FICO.keyDescrUm] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrUm];
                if (descrGruppo.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrPeso))
                    result[GLOBAL_VARIABLES_FICO.keyDescrPeso] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrPeso];
                if (descrGruppo.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizioneIndd))
                    result[GLOBAL_VARIABLES_FICO.keyDescrizioneIndd] = descrGruppo[GLOBAL_VARIABLES_FICO.keyDescrizioneIndd];

                if (descrGruppo.ContainsKey(GLOBAL_VARIABLES_FICO.keyFirmaRevisione))
                    result[GLOBAL_VARIABLES_FICO.keyFirmaRevisione] = descrGruppo[GLOBAL_VARIABLES_FICO.keyFirmaRevisione];

            }
            else
            {
                //Sottogruppo non revisionato
                result[GLOBAL_VARIABLES_FICO.keyFirmaRevisione] = "norev";
            }

            //Mi porto dietro anche la FIRMA in REVISIONE



            //NON SI ELIMINA descrizione_gruppo perchè altrimenti non sappiamo riconoscere se è stato revisionato opure no



            return result;
        }
    }

    public class ExtraAutoFIelds
    {
        public extraAutoTypeContent type { get; set; }
        public string content { get; set; }
    }

    public enum extraAutoTypeContent
    {
        stringa,
    }

    public class ACcomuni
    {
        public string NomeAC;
        public string canale;
        public string area;
        public string label;
        public bool InVol = true;
    }

    public class q_records_per_getListaRevisione
    {
        public Dictionary<string,object> Dato;
        public Int64 Id;
        public string Canale;
        public string Area;
        public string Label;
        public bool isGruppo;
    }

    public class colonnaReportImportazione
    {
        public string nomeColonna;
        public string scope;
        public color coloreDefaultColonna = color.none;
        public List<List<RegolaComparazioneWarning>> Regole { get; set; }
        public color coloreWarningColonna = color.Yellow;
        public bool hideIfNotWarning = false;

    }

    public class RegolaComparazioneWarning
    {
        public string Value { get; set; }
        public string campo { get; set; }
        public string Operatore { get; set; }
    }


    public enum color
    {
        none = 0,
        Green = 1,
        Yellow = 2,
        Red = 3,
        Blue = 4,
    }
    public class AnalisiMomentoTracciatoDetails
    {
        public string guidArea { get; set; }
        public string guidCanale { get; set; }
        public string context { get; set; }
        public List<Dictionary<string, object>> records { get; set; }
    }
    public class AnalisiConfrontoResponse
    {
        public AnalisiConfrontoTracciatoDetails primario { get; set; } = new AnalisiConfrontoTracciatoDetails();
        public AnalisiConfrontoTracciatoDetails secondario { get; set; } = new AnalisiConfrontoTracciatoDetails();
        public bool esito { get; set; }
        public string errors { get; set; }
        public string warnings { get; set; }
    }
    public class AnalisiConfrontoTracciatoDetails
    {
        public string guidId { get; set; } //Guidid del momento
        public List<AnalisiMomentoTracciatoDetails> tracciati { get; set; } = new List<AnalisiMomentoTracciatoDetails>();
    }

    #region Correggo types

    public class PacchettoCorreggoPerFPRequest
    {
        public string req { get; set; }

    }
    public class PacchettoCorreggoPerFP
    {
        public Correggo_Promo promo;
        public List<Correggo_Pagina> pagine;
        public List<Correggo_SchemaCampiDellaRef> lista;
    }

    public class Correggo_Promo
    {       
        public Correggo_Promo(string titoloPromo, DateTime dtInizio, DateTime dtFine, DateTime dtScadenza, string ctx, string canale, string area)
        {
            this.titoloPromo = titoloPromo;
            this.dtInizio = dtInizio;
            this.dtFine = dtFine;
            this.dtScadenza = dtScadenza;
            this.ctx = ctx;
            this.canale = canale;
            this.area = area;
        }
        private string titoloPromo;
        private DateTime dtInizio;
        private DateTime dtFine;
        private DateTime dtScadenza;
        private string ctx;
        private string canale;
        private string area;

        //Nel mondo correggo il titolo deve essere specificato da un modelo custom
        public string titolo 
        {
            get
            {
                //Al momento ereditiamo la regola dell'unico che la usa COOP, ma se CNO ha bisogno di altro va trovato un odello dinamico
                return $"{this.titoloPromo}_{this.canale}_{this.area}";
            }
        }

        public string classificatore;//Nel mondo correggo è il titolo della promo
        public string guidIdKitRuntime;
        public string guidIdPromo;
        public Int32 idLavorazioneIstanta;
        public DateTime dataInizio;
        public DateTime dataFine;
        public DateTime dataScadenza;
    }

    public class Correggo_Pagina
    {
        public Byte numero;
        public decimal[] bounds;
    }

    public class Correggo_SchemaCampiDellaRef
    {
        public string boxName = "";
        public string itemRefStringfied;
        public Byte pag;
        public List<Correggo_AzioniSullaRef> azioni;
        public decimal[] bounds;
    }

    public class Correggo_AzioniSullaRef
    {
        public int id;
        public string titolo = "";
        public string compiledValue = "";//Valore del compiledField di Istanta
        public string labelIndd = "";
        public decimal[] bounds;
        public List<Correggo_IstruzioneCampoDellaRef> istruzioni; //Istruzioni a livello di campo
    }
    public class Correggo_IstruzioneCampoDellaRef
    {

        public string tipoDato = "";//string, int, decimal
        public string field = "";
        public string[] valore;//Se null il valore lo deve mettere l'utente, Se specificato un valore, quello deve essere solo confermato dall'utente, se sono spefcificati più  valori l'utente li deve scegliere da una tendina
        public string autocomplete;
        public bool primary;
        public int triggerActionId;
    }

    #endregion

    #region cutomClasses Plugin

    public class AgenziaCustomPlugin
    {
        #region filtri e visualizzazione

        public List<AgenziaCustomPlugin_CampiFiltro> campiFiltro { get; set; }
        public List<AgenziaCustomPlugin_ViewColonneTracciato> colonneTracciato { get; set; }

        public bool controlloNomeFileFiltri { get; set; } = false;//Se true il plugin cerca il filtro corrispondente al nome file della lavorazione corrente

        public List<AgenziaCustomPlugin_KeyLabel> infoRapide;//Lista delle chiavi da mostrare subito quando dalla scheda ref si preme la icona I di Info

        public List<AgenziaCustomPlugin_SchemaOrdinamentoConPesi> schemiOrdinamentoConPesi;

        #endregion

        #region Impaginazione 
        public List<CambioStrutturale> cambiStrutturali { get; set; } = new List<CambioStrutturale>();
        public string nomeLibreriaIndd { get; set; } = "";//Se valorizzato, al momento del lancio dell'impaginazione, viene passato al plugin il nome della libreria indesign da usare per l'impaginazione. In questo modo è possibile per le agenzie gestire librerie indesign diverse a seconda delle esigenze (esempio: una libreria con stili specifici per volantino e una per pop ad esempio)
        public List<string> etichetteEsclusePerFixDescrizione { get; set; } = new List<string>();//Se valorizzato, al momento del lancio dell'impaginazione, viene passato al plugin il nome della libreria indesign da usare per l'impaginazione. In questo modo è possibile per le agenzie gestire librerie indesign diverse a seconda delle esigenze (esempio: una libreria con stili specifici per volantino e una per pop ad esempio)
        public bool invalidareStileDiCarattere { get; set; } = false;//Se true, durante l'impaginazione l'agenzia ha la regola di impostare uno stile di carattere NESSUNO di sua proprietà
        
        public Byte defaultDirectionOverflow { get; set; } = 1;//1- vertical 2- horizontal. 
        public List<AgenziaCustomPlugin_CampiSoggettiAOverflow> campiSoggettiAOverflow { get; set; } = new List<AgenziaCustomPlugin_CampiSoggettiAOverflow>();

        public string defaultParagraphStyle { get; set; } = "";//Se valorizzato, durante l'impaginazione l'agenzia ha la regola di impostare questo stile di paragrafo di default su tutti i campi testuali impaginati. In questo modo è possibile per le agenzie gestire uno stile di paragrafo di default diverso a seconda delle esigenze 


        public List<AgenziaCustomPlugin_InfoExtraCommand> infoExtraCommands { get; set; }
        //public List<AgenziaCustomPlugin_RegoleIstruzioni> infoExtraCommands { get; set; }
        public List<AgenziaCustomPlugin_EtichetteCommand> etichetteCommands { get; set; }
        //public List<AgenziaCustomPlugin_RegoleIstruzioni> etichetteCommands { get; set; }
        public List<AgenziaCustomPlugin_FitTypeLogoRule> fitTypeLogos { get; set; } = new List<AgenziaCustomPlugin_FitTypeLogoRule>(); public List<AgenziaCustomPlugin_RequireIngombriSetDiRegole> requiresIngombriConteggio { get; set; }
        //public List<AgenziaCustomPlugin_RegoleIstruzioni> requiresIngombriConteggio { get; set; }
        public AgenziaCustomPlugin_OutputRulesSet suffissiLavorazioneRules { get; set; } = new AgenziaCustomPlugin_OutputRulesSet();
        public AgenziaCustomPlugin_OutputRulesSet declinazioneMeccanicaRules { get; set; } = new AgenziaCustomPlugin_OutputRulesSet();

        public List<AgenziaCustomPlugin_PolicyImpaginazioneMechanism> policyImpaginazioneMechanism = new List<AgenziaCustomPlugin_PolicyImpaginazioneMechanism>();

        #endregion

        #region Ref, Revisione, confronto ed Export

        public List<AgenziaCustomPlugin_SchemaDescrizioni> schemiDescrizioni { get; set; }//Gli schemi descrizioni servono per definire regole di composizione dinamica delle descrizioni in fase di revisione, in questo modo è possibile per le agenzie definire logiche di composizione delle descrizioni diverse a seconda delle esigenze
        //public List<AgenziaCustomPlugin_RegoleIstruzioni> schemiDescrizioni { get; set; }//Gli schemi descrizioni servono per definire regole di composizione dinamica delle descrizioni in fase di revisione, in questo modo è possibile per le agenzie definire logiche di composizione delle descrizioni diverse a seconda delle esigenze
        public AgenziaCustomPlugin_StileUniversale[] listaStiliUniversali { get; set; }

        public AgenziaCustomPlugin_GrandezzaBoxRevisione grandezzeBox { get; set; }//Definisce la grandezza dei box di revisione, in questo modo è possibile per le agenzie gestire la visualizzazione a piacimento
        
        public bool abilitaDescrizioniRegionali { get; set; }
        public bool abilitaDescrizioniCanale { get; set; } 

        public string[] listCampiNonEditabili { get; set; }//Lista dei campi che non devono essere editabti quando si clona un record da un tracciato
        public string[] listaCampiEditabiliPrioritari { get; set; }//Lista dei campi editabili messi in evidenza al momento della clonazione
        
        public string nomeFotoPrimaria { get; set; }//Label che riceve la foto primaria nel box
        public string nomeFotoSecondaria { get; set; }//Label che riceve la foto secondaria nel box
        public string fotoNotFound { get; set; }//Nome del file che contiene info FOTO NOT FOUND su disco
        public string nomeNoFoto { get; set; }//Nome del file che contiene info NESSUNA FOTO PER QUESTA REF
        public string[] listCampiConfrontoBypass { get; set; }//Campi che non vengono tenuti in considerazione nel check delle differenze nel confronto
        public Byte modeConfronto{ get; set; } = 1;//Specificare quali sono le modalità

        public string[] schemasNotEditable { get; set; }//Specifica quali degli stili rappresentati su scheda revisione NON possono essere editati       
        public List<AgenziaCustomPlugin_EditSchedaRefRules> editSchedaRefRules { get; set; }

        /// I20-976: avvisi da mostrare quando cambia il primario di un gruppo nella scheda ref.
        /// Vuoto: nessun avviso, e resta il solo comportamento core.
        public List<AgenziaCustomPlugin_AvvisoCambioPrimario> avvisiCambioPrimario { get; set; } = new List<AgenziaCustomPlugin_AvvisoCambioPrimario>();

        /// I20-981: i campi che l'agenzia tiene d'occhio nella sezione Confronti del Report
        /// Integrita'. Non cambiano l'aspetto del box, quindi l'analisi di integrita' non li
        /// guarda, ma l'operatore li usa per decidere a che pagina va la referenza: se
        /// cambiano, la pagina puo' dover cambiare, e vuole vederlo.
        /// La chiave e' quella del record, l'etichetta e' cio' che legge l'operatore.
        /// Vuoto: la sezione non ha nulla da confrontare e lo dice.
        public List<AgenziaCustomPlugin_KeyLabel> campiOsservatiConfronto { get; set; } = new List<AgenziaCustomPlugin_KeyLabel>();

        public List<AgenziaCustomPlugin_LibreriaIndd> regoleLibrerie { get; set; } //

        public List<TemplateFiltro> templateFiltro { get; set; } = new List<TemplateFiltro>();
        public string[] metaAggiuntiviPerEsportazioneCorreggo { get; set; } = new string[] {};
        public List<AgenziaCustomPlugin_KeyLabel> campiExtraEditPrimarieSecondarie { get; set; }
        public List<DerivazioneDna> regoleApplicazioneDNA { get; set; }
        #endregion

    }

    public class AgenziaCustomPlugin_OutputRulesSet
    {
        public List<AgenziaCustomPlugin_ContextKey> contextKeys { get; set; } = new List<AgenziaCustomPlugin_ContextKey>();
        public List<AgenziaCustomPlugin_OutputRule> rules { get; set; } = new List<AgenziaCustomPlugin_OutputRule>();
        public string defaultValue { get; set; } = string.Empty;
    }

    public class AgenziaCustomPlugin_OutputRule
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();
        public string result { get; set; } = string.Empty;
    }

    public class AgenziaCustomPlugin_ContextKey
    {
        public string alias { get; set; } = string.Empty;
        public string key { get; set; } = string.Empty;
        public string source { get; set; } = string.Empty;
    }

    //Campo definito per apparire tra le opzioni di chiave filtro ricerca
    public class AgenziaCustomPlugin_CampiFiltro
    {
        public string nomeCampoVisualizzato { get; set; }
        public string campoAssociato { get; set; }
        public string scope { get; set; }
        public bool tendina { get; set; }
        public bool isData { get; set; } = false;
    }

    //Oggetto che specifica la colonna di visualizzazione di un record prestazione
    public class AgenziaCustomPlugin_ViewColonneTracciato
    {
        public string name { get; set; }
        public string chiaveDato{ get; set; }
        public decimal percColonna { get; set; }
    }

    //Oggetto che definisce la modalità di overflow con cui un determinato elemento etichettato deve essere trattato
    public class AgenziaCustomPlugin_CampiSoggettiAOverflow
    {
        public string label { get; set; } = string.Empty;
        public string h { get; set; } = string.Empty; // bottom/top
        public string w { get; set; } = string.Empty; // left/right

        public decimal amountH { get; set; } = 3; // quanto espande top/bottom
        public decimal amountW { get; set; } = 3; // quanto espande left/right
    }

    public class AgenziaCustomPlugin_SchemaDescrizioni
    {
        public string[] schema { get; set; }
        public List<BloccoRegole> setRegole { get; set; }
    }

    public class AgenziaCustomPlugin_StileUniversale
    {
        public string nome { get; set; }
        public string rule { get; set; }
        public string fondamentale { get; set; }

    }

    public class AgenziaCustomPlugin_GrandezzaBoxRevisione
    {
        public decimal bigBoxWidth { get; set; }//Se 0 = auto
        public decimal bigBoxHeight { get; set; }//Se 0 = auto
        public decimal smallBoxWidth { get; set; }//Se 0 = auto
        public decimal smallBoxHeight { get; set; }//Se 0 = auto
        public int bigBoxPerRow { get; set; }
        public int smallBoxPerRow { get; set; }
        public decimal marginBetweenBigBox { get; set; }
        public decimal marginBetweenSmallBox { get; set; }

    }

    public class AgenziaCustomPlugin_RegoleIstruzioni
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();
        public List<Istruzione> istruzioni { get; set; } = new List<Istruzione>();
    }

    //Oggetto che satbilisce le regole per cui alcune ref in base alle caratteristiche vengono destinate a spazi di impaginazione specifici con ingombri specifici
    public class AgenziaCustomPlugin_RequireIngombriSetDiRegole
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();
        public string[] result { get; set; } //[0] ingombro, cio che viene scritto nella cella di conteggio [1] stile di oggetto applicato
    }

    public class AgenziaCustomPlugin_InfoExtraCommand
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();
        public string text { get; set; }//Scritto ad es cosi "Reparto: {reparto}" questo scrive la parte fuori dalle graffe così come si vede e riporta il valore della chiave preso dinamicamente dall'oggetto
    }

    public class AgenziaCustomPlugin_EtichetteCommand
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();
        public string[] etichette { get; set; }
        public TipoOperazione operazione { get; set; } = TipoOperazione.Set;
    }

    public class AgenziaCustomPlugin_FitTypeLogoRule
    {
        public List<BloccoRegole> regole { get; set; } = new List<BloccoRegole>();

        // null = non applicare fit
        public FitOperation? tipoFit { get; set; }
    }

    public class AgenziaCustomPlugin_KeyLabel
    {
        public string label { get; set; }
        public string keyInRecordInTracciato { get; set; }
    }

    public class AgenziaCustomPlugin_SchemaOrdinamentoConPesi
    {
        public string titolo { get; set; }
        public List<string> gerarchia { get; set; }
        public string regex { get; set; }
    }

    public class AgenziaCustomPlugin_EditSchedaRefRules
    {
        public bool valido { get; set; }
        public List<BloccoRegole> setRegole { get; set; }
    }

    /// Avviso che il Plugin mostra quando l'operatore cambia il primario di un gruppo.
    /// Vale la prima regola che corrisponde al record, come per editSchedaRefRules.
    ///
    /// Riscaricare la scheda dopo il cambio e allineare il box sono comportamenti core, di
    /// tutti i clienti. Qui resta solo cio' che una singola agenzia ha da dire in piu': in
    /// Edro, che con l'esempio governato dal gruppo il cambio di primario non lo modifica.
    public class AgenziaCustomPlugin_AvvisoCambioPrimario
    {
        /// Testo mostrato all'operatore, in stile avviso. Vuoto: nessun avviso.
        public string messaggio { get; set; } = "";

        public List<BloccoRegole> setRegole { get; set; } = new List<BloccoRegole>();
    }
    public class AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKit
    {
        public AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitRule nomePromo { get; set; }
        public AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitRule siglaFormato { get; set; }
        public AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitRule siglaCanale { get; set; }
        public AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitRule siglaArea { get; set; }
    }
    public class AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitRule
    {
        public List<AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitLevels> levelsDataSource { get; set; }
        public List<AgenziaCustomPlugin_RegoleIstruzioni> outputRules { get; set; }

    }
    public class AgenziaCustomPlugin_DecodificaNomeFilePerRicercaKitLevels
    {
        public Byte level { get; set; }//Indica l'indice della stringa da interpretare, dove 0 indica il nome del file e a ritroso si legge i nome delle cartelle contenitore
        public string splitChars { get; set; }//Stringa di split da applicare al nome del livello in cui ci troviamo
    }

    public class AgenziaCustomPlugin_LibreriaIndd
    {
        public int ordine { get; set; }
        public List<string> canale { get; set; } = new List<string>(); //una lista vuota indica che va bene qualsiasi canale
        public List<string> area { get; set; } = new List<string>(); //una lista vuota indica che va bene qualsiasi area
        public List<FicoContextField> context { get; set; }
        public List<string> nomePromo { get; set; } = new List<string>(); //una lista vuota indica che non ci sono controlli sul nome promo
        public List<string> formati { get; set; } = new List<string>(); //una lista vuota indica che non ci sono controlli sul nome promo
        public List<int> tipoLavorazione { get; set; } = new List<int>(); // se svuotata si applica a tutte le lavorazioni
        public List<string> nomeLibreria { get; set; } = new List<string>(); //la lista non può essere vuota
    }

    public class DerivazioneDna
    {
        public List<string> codiceBox { get; set; }//Identificativo i codiciBox in cui applichiamo la variazione di DNA
        public List<string> meccanicaAssegnata { get; set; }//Identificativo i codiciBox in cui applichiamo la variazione di DNA
        public List<string> campiDNA { get; set; }
    }


    public class TemplateFiltro
    {
        public string nomeTemplate { get; set; }
        public List<CriterioFiltroTemplate> criteri { get; set; } = new List<CriterioFiltroTemplate>();
    }

    public class CriterioFiltroTemplate
    {
        public string chiave { get; set; }
        public string operatore { get; set; }
        public string valore { get; set; }
    }

    public class AgenziaCustomPlugin_PolicyImpaginazioneMechanism
    {
        public Byte tipo_utente = Byte.MinValue; //0 nessuno
        public int idUtente = 0;
        public List<Dictionary<string,object>> macro = new List<Dictionary<string,object>>();//ad es. [{"azione":"clippingPath","valore":false},{"azione":"clippingPath","valore":true,"options":{tolerance:3,threshold:5}}]
    }

    #endregion


    public class WrapperPerGetGarante
    {
        public int idPromo = 0;
        public List<WrapperGruppoConTracciato> gruppiPerTracciato = new List<WrapperGruppoConTracciato>();
    }

    public class WrapperGruppoConTracciato
    {
        public int idTracciato = 0;
        public List<Dictionary<string, object>> gruppo = new List<Dictionary<string, object>>();
        public string siglaTracciato = "";
    }

    public class StrutturaMetaPerRevisione
    {
        public int idPromo { get; set; }
        public int idTracciato { get; set; }
        public string siglaTracciato { get; set; } = "";
        public string chiaviMeta { get; set; } = "";
    }

    public class RitornoMetaPerRevisioneGarante
    {
        public string metaRev { get; set; } = "";

        public int idPromo { get; set; } = 0;
        public int idTracciato { get; set; } = 0;
        public string siglaTracciato { get; set; } = "";

        public List<Dictionary<string, object>> gruppo { get; set; } = new List<Dictionary<string, object>>();
    }

    public class WrapperBatchPerGetGarante
    {
        public List<WrapperItemPerGetGarante> items { get; set; } = new List<WrapperItemPerGetGarante>();
    }

    public class WrapperItemPerGetGarante
    {
        public string key { get; set; } = "";
        public string meta { get; set; } = "";
        public WrapperPerGetGarante wrap { get; set; } = new WrapperPerGetGarante();
    }

    public class RitornoBatchGarante
    {
        public List<RitornoItemGarante> items { get; set; } = new List<RitornoItemGarante>();
    }

    public class RitornoItemGarante
    {
        public string key { get; set; } = "";
        public string metaRev { get; set; } = "";

        public int idPromo { get; set; } = 0;

        // Garante proposto ora
        public int idTracciato { get; set; } = 0;
        public string siglaTracciato { get; set; } = "";

        public List<Dictionary<string, object>> gruppo { get; set; } = new List<Dictionary<string, object>>();

        public bool firmaGarantita { get; set; } = false;

        // Garante storico, letto da recordRevisionato.Meta
        public string siglaTracciatoFirmaGarantita { get; set; } = "";
    }

    public class EsitoFirmaGarantita
    {
        public bool garantita { get; set; } = false;
        public string siglaTracciatoFirmaGarantita { get; set; } = "";
    }

    public class WrapperBatchCheckFirmaPlugin
    {
        public List<WrapperItemCheckFirmaPlugin> items { get; set; } = new List<WrapperItemCheckFirmaPlugin>();
    }

    public class WrapperItemCheckFirmaPlugin
    {
        public string key { get; set; } = "";
        public string meta { get; set; } = "";
        public List<Dictionary<string, object>> recordsGruppo { get; set; } = new List<Dictionary<string, object>>();
    }

    public class RitornoBatchCheckFirmaPlugin
    {
        public List<RitornoItemCheckFirmaPlugin> items { get; set; } = new List<RitornoItemCheckFirmaPlugin>();
    }

    public class RitornoItemCheckFirmaPlugin
    {
        public string key { get; set; } = "";
        public bool firmaGarantita { get; set; } = false;
        public string siglaTracciatoFirmaGarantita { get; set; } = "";
    }

}
