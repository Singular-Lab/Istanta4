using DocumentFormat.OpenXml.Presentation;
using Istanta.Models_2;
using IstantaLib;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.AspNetCore.SignalR.Protocol;
using System.ComponentModel.DataAnnotations;
using System.Reflection.Metadata;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Istanta.Models
{
    public static class GLOBAL_VARIABLES
    {
        public static readonly Byte maxSimultaneousOperationRequestOfElaboration = 1;//3;
        public static readonly Byte maxSimultaneousOperationRequestOfIO = 20;
        public static readonly Int16 updateToPercentageRange = 10;//Aggiornare le percentuali delle operazioni ogni 10%
        public static readonly String[] tracciatiExcelCellsTemplate = new String[] { "A:AREA", "B:INIZIATIVA", "C:DESCRIZIONE_INIZIATIVA", "D:SEZ_DATA_DA", "E:SEZ_DATA_A", "F:GRUPPO_SITI", "G:CODSCATTO", "H:REPARTO", "I:DESCRIZIONE_REPARTO", "J:SETTORE", "K:DESCRIZIONE_SETTORE", "L:PRODOTTO_MERCATO", "M:EAN", "N:NOME_FOTO", "O:CODRADICE", "P:CODVV", "Q:NOME" };//, "R:PESO_TOTALE", "S:UNITA_MISURA", "T:UNITA_FATT", "U:TEMA", "V:PREZZO_NORMALE", "W:PREZZO_PROM_MASS_MARKET", "X:PREZZO_PROM_FIDELITY", "Y:N_MASS_MARKET", "Z:M_MASS_MARKET", "AA:N_FIDELITY", "AB:M_FIDELITY", "AC:VALORE_SCONTO_MASS_MARKET", "AD:TIPO_SCONTO_MASS_MARKET", "AE:VALORE_SCONTO_FIDELITY", "AF:TIPO_SCONTO_FIDELITY", "AG:RANGE_1", "AH:PUNTI_1", "AI:RANGE_2", "AJ:PUNTI_2", "AK:TIPO_PUNTI", "AL:LIMITE_QTA", "AM:CONAD_CARD", "AN:PAGHI", "AO:ANZICHE", "AP:PREZZO_OFFERTA_KG_LT1", "AQ:PREZZO_BASE_KG_LT1", "AR:NOTA_CATEGORY", "AS:FOTO", "AT:NAZ", "AU:RUOLO", "AV:ESEMPIO", "AW:NUMERO_PAGINA", "AX:POSIZIONE_PAGINA", "AY:SCONTO_AG", "AZ:BRAND", "BA:TIPO_GUSTO", "BB:GRAMMATURA", "BC:MECCANICA", "BD:TIPO_VOLANTINO", "BE:TIPO_TEMA", "BF:FUORI_BANCO", "BG:CODICERAGMIXMATCH", "BH:SEGMENTO", "BI:TIPO_COMUNICAZIONE", "BJ:DESCRIZIONE_REGIONALE", "BK:UNITA_MISURA_COMUNICAZIONE", "BL:PREZZO_UNITA_MISURA_COMUNICAZIONE", "BM:ANZICHE_UNITA_MISURA_COMUNICAZIONE", "BN:DISTINTIVITA", "BO:SEZIONE_VOLANTINO", "BP:ID_PRESTAZIONE", "BQ:TIPO_RIGA", "BR:PROMOTION_PLAN", "BS:FILE_IMMAGINI", "BT:FLAG_PRENOTAZIONE", "BU:CODICE_ARTICOLO_POP" };

        //Chiavi da ricercare nei riferimento del dato json dinamico
        public static readonly string keyArea = "Area";
        public static readonly string keyAreaGuid = "guidArea";
        //public static readonly string keyAreaCodice = "Codice";
        public static readonly string keyCanale = "Canale";
        public static readonly string keyCanaleGuid = "guidCanale";
        //public static readonly string keyAreaGruppoSiti = "GruppoSiti";

        public static readonly string keyRefCodice = "Codice";
        public static readonly string keyRefEan = "Ean";
        public static readonly string keyRefId = "Id";
        public static readonly string keyId = "Id";
        public static readonly string keyRefIdRec = "idRec";

        public static readonly string keyDescr1 = "Descrizione1";
        public static readonly string keyDescr2 = "Descrizione2";
        public static readonly string keyDescr3 = "Descrizione3";
        public static readonly string keyDescr4 = "Descrizione4";
        public static readonly string keyDescr1Tracciato = "Descrizione1Tracciato";
        public static readonly string keyDescr2Tracciato = "Descrizione2Tracciato";
        public static readonly string keyDescr3Tracciato = "Descrizione3Tracciato";
        public static readonly string keyDescr4Tracciato = "Descrizione4Tracciato";
        public static readonly string keyDescr1Gruppo = "Descrizione1GruppoTracciato";
        public static readonly string keyDescr2Gruppo = "Descrizione2GruppoTracciato";
        public static readonly string keyDescr3Gruppo = "Descrizione3GruppoTracciato";
        public static readonly string keyDescr4Gruppo = "Descrizione4GruppoTracciato";
        public static readonly string keyDataUltimaRicezione = "DataUltimaRicezione";
        public static readonly string keyDescrGruppo = "Gruppo";
        public static readonly string keyDescrIndd = "DescrizioneIndd";
        public static readonly string keyDescrUm = "Um";
        public static readonly string keyDescrPeso = "Peso";
        public static readonly string keyDescrExtra = "Extra";
        public static readonly string keyDescrUmGruppo = "UmGruppo";
        public static readonly string keyDescrPesoGruppo = "PesoGruppo";

        public static readonly string keyScattoCodice = "Codice";
        public static readonly string keyScattoCodiceGruppo = "CodiceGruppo";
        public static readonly string keyScattoCodiceGruppoMultiplex = "CodiceGruppoMultiplex";
        public static readonly string keyScattoCodiceSottogruppo = "CodiceSottogruppo";
        public static readonly string keyFuoriPoP = "FuoriPoP";
        public static readonly string keyRegoleMastro = "RegoleMastro";

        public static readonly string keyTracciatoFirma = "Firma";
        public static readonly string keyFirmaRevisione = "FirmaRevisione";


        public static readonly string keyFotoNome = "Nome";
        public static readonly string keyFotoExtra = "Extra";
        public static readonly string keyFotoIsMeta = "IsMeta";
        public static readonly string keyFotoEscluse = "FotoEscluse";
        //public static readonly string keyFotoExtraAuto = "FotoExtraAuto";
        public static readonly string keyFotoExtraAuto = "ExtraAuto";
        public static readonly string keyFotoGuidId = "guidid";
        public static readonly string keyFotoHash = "Hash";

        public static readonly string keyXMLLoghi = "loghi";
        public static readonly string keyXMLSelezione = "StatoSelezione";
        //public static readonly string keySelezioneMenabo = "selezione_menabo";
        public static readonly string keyHasFoto = "HasFoto";

        public static readonly string keySiglaTracciato = "NomeEsportazione";

        public static readonly string keySyncIndd = "SyncFromInddVol";
        public static readonly string keySyncInddRequisiti = "requisiti";

        public static readonly string keySyncFotoInddNome = "nome";
        public static readonly string keySyncFotoInddCodice = "codice";
        public static readonly string keySyncFotoInddIsPrimaria = "primaria";
        public static readonly string keySyncFotoInddStato = "stato";

        public static readonly string keyStatoRevisioneSingolo = "statoRevisioneSingolo";
        public static readonly string keyStatoRevisioneGruppo = "statoRevisioneGruppo";
        public static readonly string keyMembriGruppoFoto = "membriGruppoFoto";


        //Con queste combinazioni di chiave, si chiede al core di recuperare la descrizione dall'archivio per far uscire le ref indicate con questo attributo
        public static readonly string keyRequisitoPrezziDiversi = "PrezziDiversi";//Se true indica che i prezzi sono diversi
        public static readonly string keyRequisitoDescrizioneSingola = "DescrizioneSingola";//Richiesta descrizione singola
        public static readonly string keyRequisitoDescrizioneSottogruppo = "DescrizioneSottoGruppo";//Richiesta descrizione del sottogruppo di appartenenza
        public static readonly string keyRequisitoDescrizioneGruppo = "DescrizioneGruppo";//Richiesta descrizione del proprio gruppo
        public static readonly string keyRequisitoDescrizioneGruppoMultiplex = "DescrizioneGruppoMultiplex";//Richiesta descrizione del gruppo multiplex di appartenenza

        public static readonly string keyXMLDescrizioneGruppo = "descrizione_gruppo";
        public static readonly string keyDescrizioneRegionale = "descrizione_regionale";
        public static readonly string keyDescrizioneCanale = "descrizione_canale";
        public static readonly string keyDescrizioneCustom = "descrizione_custom";
        public static readonly string keyFotoRegionale = "foto_regionale";
        public static readonly string keyFotoCanale = "foto_canale";
        public static readonly string allEtichette = "allEtichette";
        public static readonly string etichetteVisual = "etichetteVisual";
        public static readonly string combinazioneAssegnata = "combinazioneAssegnata";
        public static readonly string combinazioneMeccanica = "combinazioneMeccanica";
        public static readonly string meccanicaInvalidata = "meccanica_invalidata";
        public static readonly string keyLabel = "Tracciato.Label";



        public static readonly string keyContextPromo = "Context.Promo";
        public static readonly string keyContextTracciato = "Context.Tracciato";
        public static readonly string keyKitDeclinazioni = "Kit.Declinazioni";

        public static readonly string keyIndiceOrdinamento = "IndiceOrdinamento";
        public static readonly string keyArtwork = "artworkId";
        public static readonly string keyArtworkFoto = "artworkFotoId";

        public static readonly string keyAlterazioni = "Alterazioni";

        public static readonly string keyConfrontoPaginaInMaster = "Confronto.PaginaInMaster";
        public static readonly string keyPosizioniRichieste = "posizioniRichieste";
        public static readonly string keyBoxRichiesto = "boxRichiesto";
        public static readonly string keyACComuni = "ACComuni";
        public static readonly string keyCompiledFields = "compiledFields";

        public static readonly string keyFirmaFiduciaria = "firmaFiduciariaXGruppo";
        public static readonly string keyMismatchFirma = "MismatchFirma";
        public static readonly string keySuggerimentoFirma = "suggerimento";
        public static readonly string keyDaArchivioFirma = "Da archivio";//Viene usata direttamente da archivio.js al momento del salvataggio. Usa Revisore ancizhè Archivio. La cosa è sbagliata ma almeno si segnala qui di modo da poterla formulare meglio più avati


        public static readonly string[] chiaviTracciato = new string[]
        {
        keyRefCodice,
        keyScattoCodiceGruppoMultiplex,
        keyScattoCodiceSottogruppo,
        combinazioneAssegnata,
        keyScattoCodiceGruppo,
        };

        public static readonly string[] chiaviRevisionato = new string[]
        {
            "approvata",
            //keyArea,
            //keyCodice,
            keyScattoCodiceGruppo,
            "dataUltimaRicezione",
            keyDescr1,
            keyDescr2,
            keyDescr3,
            keyDescr4,
            keyDescrIndd,
            keyDescrExtra,
            keyTracciatoFirma,
            keyRefId,
            "idArticolo",
            keyDescrPesoGruppo,
            keyDescrUmGruppo
        };

        public static readonly string[] chiaviImpaginato = new string[]
        {
            keyScattoCodiceGruppo,
            "formato",
            keyRefId,
            "idPagina",
            "idRecord",
            "indice",
        };

        public static readonly string[] chiaviPromoTracciato = new string[]
        {
            "Area",
            "Canale",
            "GuidIdArea",
            "GuidIdCanale",
            "GuidPV",
            "Id",
            "IdImportazione",
            "IdImportazioneNavigation",
            "IdPromo",
            "Meta",
            "OrdineLista",
            "Sigla",
            "Versione",
        };

        public static readonly string[] chiaviPromo = new string[]
        {
            "Context",
            "DataRegistrazione",
            "DataScadenza",
            "GuidID",
            "Id",
            "NomePromo",
            "Stato",
            "ValiditaAl",
            "ValiditaDal",
        };

        public static readonly string[] chiaviContext = new string[]
        {
            "TipoDiLavorazione",
        };

    }

    #region Classi di appconfig mapping

    public class PathFotoJpg
    {
        public const string jpg_path_foto = "jpg_path_foto";

        public string path { get; set; } = String.Empty;
    }

    public class PathOperationExport
    {
        public const string path_to_export = "path_to_export";

        public string path { get; set; } = String.Empty;
    }

    public class PathOperationImport
    {
        public const string path_to_import = "path_to_import";

        public string path { get; set; } = String.Empty;
    }

    public class PathExternal
    {
        public string pathLib { get; set; } = String.Empty;
        public string pathSource { get; set; } = String.Empty;
    }   

    public class SyncOptions
    {
        public string extractPath { get; set; } = String.Empty;
        public string[]? extPreLavorazione { get; set; }
        public string[]? extPostLavorazione { get; set; }
        public string[]? delimitersQuery { get; set; }
        public SyncFotoDelimiterRule[]? delimitersIndexRules { get; set; }
        public string[]? fotoAmbientateKeyWordsToSearch { get; set; }
        public string[]? loghiKeyWordsToSearch { get; set; }
        public string[]? bolliniKeyWordsToSearch { get; set; }
        public string ipUploadGate { get; set; } = String.Empty;

    }

    public class SyncFotoDelimiterRule
    {
        public int indice { get; set; }
        public string? rule { get; set; }
        public string? output { get; set; }
    }

    public class AntlrOptions
    {
        public AntlrPattern? patternsDescrizioneRegionale { get; set; }
    }

    public class AntlrPattern
    {
        public List<AntlrPatternLevels>? livelli { get; set; }
    }
    public class AntlrPatternLevels
    {
        public string? nome { get; set; }
        public List<AntlrPatternLevelsNode>? patterns { get; set; }
    }

    public class AntlrPatternLevelsNode
    {
        public ExpressionParser.ExprContext? context;
        public string? condizione { get; set; }
        public string? valore { get; set; }
    }

    public class AuthADOptions
    {
        public string Provider { get; set; } = String.Empty;
        public string Domain { get; set; } = String.Empty;
        public string TenantId { get; set; } = String.Empty;
        public string ClientId { get; set; } = String.Empty;
        public string ClientSecret { get; set; } = String.Empty;
    }

    #endregion

    #region FICO objects
    public class OlympusUserPolicyRequest
    {
        public string source { get; set; } = String.Empty;
        public string dest { get; set; } = String.Empty;

    }

    public class FicoConfig
    {
        public string olympusServerUrl { get; set; } = String.Empty;
        public string fpServerUrl { get; set; } = String.Empty;
        public string correggoServerUrl { get; set; } = String.Empty;
        public string secretKey { get; set; } = String.Empty;
        public string contextsPath { get; set; } = String.Empty;
        public OlympusUserPolicyRequest[]? userDataPolicy { get; set; }
        public string nomeCliente { get; set; } = String.Empty;
        public string agent { get; set; } = String.Empty;

    }


    public class FicoContextResult
    {
        public string content { get; set; } = String.Empty;
        public bool esito { get; set; } = false;
        public string error { get; set; } = String.Empty;
    }

    public class FicoContextSchemeResult
    {
        public List<FicoContextScheme>? schemi { get; set; }
        public bool esito { get; set; } = false;
        public string error { get; set; } = String.Empty;
    }

    public class FicoCombinazioniLavorazioneResponse
    {
        public List<FicoCombinazioniLavorazione>? lista { get; set; }
        public bool esito { get; set; } = false;
        public string error { get; set; } = String.Empty;
    }
    public class FicoCombinazioniLavorazione
    {
        public string guidIdArea { get; set; } = String.Empty;
        public string guidIdCanale { get; set; } = String.Empty;
        public List<FicoContextField>? tracciatoContext { get; set; }
    }


    public class OlympusUserPolicyContexts
    {
        public bool fp_context { get; set; } = false;
        public bool correggo_context { get; set; } = false;
        public bool istanta_context { get; set; } = false;
    }

    public class OlympusUserPolicyResponse
    {
        public Dictionary<string, string>? campi_essenziali { get; set; }
        public OlympusUserPolicyContexts? permessi { get; set; }
        public List<OlympusUserPolicyRuolo> ruoli { get; set; }
    }

    public class OlympusUserPolicyRuolo
    {
        public string nodeType { get; set; }
        public string nodeValue { get; set; }
        public List<OlympusUserPolicyRuolo> children { get; set; }
        public string codificaFico {  get; set; }
    }

    public class OlympusChekIdentity
    {
        public string origin { get; set; } = String.Empty;
        public string username { get; set; } = String.Empty;
        public FicoUserType tipoUtente { get; set; }
        public OlympusUserPolicyResponse? userPolicy { get; set; }
        public bool autorizzato { get; set; } = false;

    }

    public class OlympusChekIdentityResult
    {
        public OlympusChekIdentity? utenteFico;
        public Int16 idUtenteLocale;

    }

    public class FicoDataSourceItem
    {
        public string? titolo;
        public string? valore;
    }

    public class FicoDataSourceResult
    {
        public List<FicoDataSourcePacket> list { get; set; } = new List<FicoDataSourcePacket>();

        public bool esito;
        public string? error;
    }

    public class FicoDataSourcePacket
    {
        public List<FicoDataSourceItem>? content;
        public string titoloField { get; set; }="";
        public string tipoField { get; set; } = "";
        public string idField { get; set; } = "";
        public string binding { get; set; } = "";
        public bool nullable { get; set; } = true;
        public bool visible { get; set; } = true;
        public bool esito { get; set; } = false;
        public string? error { get; set; } = "";
    }

    public class FICOPassportCredentials
    {
        public string? origin { get; set; }
        public string? username { get; set; }
        public FicoUserType? tipoUtente { get; set; }
        //public Dictionary<string, string>? userPolicy { get; set; }
        public Dictionary<string, string>? campi_aggiuntivi { get; set; }
    }

    public class FICOLoginResponse
    {
        public string? publicKey { get; set; }
        public string? privateKey { get; set; }
        public bool esito { get; set; }
        public string? error { get; set; }
    }

    public static class FICOOrigins
    {
        public const string FidelityPromotion = "FP";
        public const string Correggo = "CO";
        public const string Istanta = "IS";
        public const string Olympus = "OL";

    }

    public class FICOInizioLavorazioneObject
    {
        public string? guid_id { get; set; }
        public string? GDO { get; set; }
        public string? nomePromo { get; set; }
        public string? dataRegistrazione { get; set; }
        public string? validitaDal { get; set; }
        public string? validitaAl { get; set; }
        public string? dataScadenza { get; set; }
        public string? stato { get; set; }
        public List<FicoContextField>? context { get; set; }


    }

    public class FicoInputImportInLavorazione
    {
        public string? guid_id { get; set; }
        public IFormFile? fileContent { get; set; }
        public string? idPromo { get; set; }
        public string? fileName { get; set; }
        public string? context { get; set; }
    }

    public class FicoStatoImportazioneResult
    {
        public OperationStauts stato { get; set; }
        public string? error { get; set; }
        public bool? esito { get; set; }
    }

    public class FicoExportLavorazione
    {
        public string? guidKitRuntime { get; set; }
        public string? tipoExport { get; set; }
        public string? nomeFile { get; set; }
        public string? meta { get; set; }
        public IFormFile? file { get; set; }
    }

    public class FicoExportLavorazioneResult
    {
        public bool esito { get; set; }
        public string? error { get; set; }
    }

    public class FicoFormatoResult
    {
        public List<Formato>? content;
        public bool esito;
        public string? error;
    }

    public class FicoLoghiBolliResult
    {
        public List<LogoBollo>? content;
        public bool esito;
        public string? error;
    }

    public class FicoTipiDiExportResult
    {
        public List<TipoDiExport>? content;
        public bool esito;
        public string? error;
    }

    public class FicoSchemaAddestramentoResult
    {
        public List<FicoSchemaAddestramento>? content;
        public bool esito;
        public string? error;
    }


    public class FicoSchemaAddestramentoFieldResult
    {
        public List<FicoSchemaAddestramentoField>? content;
        public bool esito;
        public string? error;
    }

    public class FicoNamingConventionResult
    {
        public List<FicoNamingConventionComponent>? content;
        public bool esito;
        public string? error;
    }

    public class FicoDeclinazioneKit
    {
        public Int16 Id { get; set; }
        public string? Nome { get; set; }
        public string? Codice { get; set; }
        public string? Descrizione { get; set; }
    }


    public class FicoDeclinazioneKitResult
    {
        public List<FicoDeclinazioneKit>? content;
        public bool esito;
        public string? error;
    }

    public class FicoCombinazioneKitRequest
    {
        public string? id { get; set; }
        public string? idRaccoglitore { get; set; }
        public string? idPromo { get; set; }
        public string? idCanale { get; set; }
        public string? idArea { get; set; }
        public string? idPV { get; set; }
        public string? idFormato { get; set; }
        public List<FicoContextField>? promoContext { get; set; }
        public bool lettura { get; set; } // Se false legge da FP TEMPLATE, mentre se si imposta TRUE si comanda ad FP di scaricare definitivamente il modello in produzione e da qui in poi sarà il dato runtime a guidare
        public FicoCombinazioneKitReadMode mode { get; set; }

    }

    public class FicoRequestSchedaPromoLavorazioneInFP
    {
        public string guidIdPromo { get; set; } = String.Empty;
    }    

    public class FicoAuthUrlMetaData
    {
        public string publicKey { get; set; } = String.Empty;
        public string route { get; set; } = String.Empty;
        public Dictionary<string, string> queryParams { get; set; } = new Dictionary<string, string>();
    }
    public class FicoAuthADUrlMetaData
    {
        public string tenantId { get; set; } = String.Empty;
        public string tokenAD{ get; set; } = String.Empty;
        public Dictionary<string, string> queryParams { get; set; } = new Dictionary<string, string>();
    }

    public class UserAccessToken
    {
        public string token { get; set; } = String.Empty;
        public int duration { get; set; }= 0;//Espresso in milliseconds
        public DateTime expiration { get; set; }
        public string error { get; set; } = String.Empty;

    }

    public class FicoAuthUrl
    {
        public string url { get; set; } = String.Empty;
        public string error { get; set; } = String.Empty;
        public bool esito { get; set; } = false;
    }

    public class FicoUpgradePackRequest
    {
        public IFormFile file { get; set; }
        public string idTarget { get; set; }
    }
    public class FicoUpgradePackResponse
    {
        public bool Esito { get; set; }
        public string error { get; set; } = "";
    }
    public class FicoUpgradeCheckResponse
    {
        public string result { get; set; }
        public string message { get; set; }
        public string error { get; set; } = "";
    }


    #endregion

    #region OperationsController class
    public class InputForI_O
    {
        public string? Titolo { get; set; }
        public int IdUnitaExport { get; set; }
        public string folder { get; set; } = String.Empty;
        public string csvFile { get; set; } = String.Empty;
        public string xmlFile { get; set; } = String.Empty;
        public List<string> foto { get; set; } = new List<string>();
        public List<string> Logs { get; set; } = new List<string>();
    }

    public interface IIstantaTasking
    {
        public List<string> Downloads { get; set; }
    }

    
    public class InputFormTracciatoOld : IIstantaTasking
    {
        public string[]? file { get; set; }
        public string[]? filename { get; set; }
        //public int cmbTipoTracciato { get; set; }
        public string cmbMaterialeVol { get; set; } = String.Empty;
        public string cmbMaterialePoP { get; set; } = String.Empty;
        public string cmbMaterialeManifesto { get; set; } = String.Empty;
        public string cmbCanaleArea { get; set; } = String.Empty;
        public string MzApName { get; set; } = String.Empty;
        public bool ChEsportaFoto { get; set; }
        public bool ChEsportaDaArchivio { get; set; }
        public List<InputForI_O> IOOperations { get; set; } = new List<InputForI_O>();
        public List<string> Downloads { get; set; } = new List<string>();
    }
    public class InputFormTracciato : IIstantaTasking
    {
        public IFormFile? file { get; set; }
        public string? requestForms { get; set; }
        public string? filename { get; set; }        
        //public int cmbAddestramenti { get; set; }
        //public string? cmbLabels { get; set; }
        public bool AutoRevisione { get; set; }
        public int idPromo { get; set; }
        public int idImportazione { get; set; }
        public string? nomePromo { get; set; }
        public Dictionary<string, string>? fields { get; set; }
        public List<string> Downloads { get; set; } = new List<string>();

        public bool persistent { get; set; } = false;//se true salva su db
        public bool askReport { get; set; } = false;//se true chiede report sulle alterazioni

        public string getFieldByKey(string key)
        {
            if (fields != null && fields.ContainsKey(key))
            {
                return fields[key];
            }
            return String.Empty;
        }
    }
    public class InputForExport : IIstantaTasking
    {
        public Dictionary<string, string>? fields { get; set; }
        public string? CartellaDiEsportazione { get; set; }
        public bool ChEsportaDaArchivio { get; set; }
        public bool ChEsportaFoto { get; set; } = false;
        public bool ChEsportaDaMenabo { get; set; }
        public List<string> Downloads { get; set; } = new List<string>();

    }

    public class InputForConfronto
    {
        public string? requestForms { get; set; }
        public Dictionary<string, string>? fields { get; set; }
        public int IdPromoPrimaria { get; set; }
        public int IdPromoSecondaria { get; set; }
        public List<int>? IdTracciatoPrimario { get; set; }
        public List<int>? IdTracciatoSecondario { get; set; }
        public bool VersionePrecedente { get; set; }
        public string? CartellaDiEsportazione { get; set; }

    }

    public class InputFormAddestramento
    {
        public string file { get; set; } = String.Empty;
        public string filename { get; set; } = String.Empty;
        public string titolo { get; set; } = String.Empty;
    }

    public class InputFormAddestramentoTest
    {
        public string file { get; set; } = String.Empty;
        public string filename { get; set; } = String.Empty;
        public int idAddestramento { get; set; }
    }

    public class RequestForIntegrazioneMirata
    {
        public Int64 idAttivita { get; set; }
        public Int32 idPromo { get; set; }

        //[ValidateNever]
        //public List<Dictionary<string, JsonElement>>? refs { get; set; }
        public List<ItemIntegrazioneMirata>? items { get; set; }

    }

    public class ItemIntegrazioneMirata
    {
        public string codice { get; set; }
        public string ac { get; set; }
        public string result { get; set; }
    }

    public class ResponseForIntegrazioneMirata
    {
        public List<ItemIntegrazioneMirata>? output { get; set; }
        public bool esito { get; set; } = false;
        public string error { get; set; } = "";

    }

    public class ImportResult
    {
        public string errors = "";
        public List<Dictionary<string, object>>? liste;
    }
    public class TracciatoResult
    {
        public string? NomeEsportazione;

        public string? Area;
        public DateTime DataDa;
        public DateTime DataA;
        public string? DescrizioneIniziativa;
        public string? Iniziativa;
        public Byte Tipo;
        public bool Promozione50Al50;

        public List<Dictionary<string, object>> Records = new List<Dictionary<string, object>>();
    }

    public class ExportResult
    {
        public string errors = "";
        public List<TracciatoResult>? liste;
    }

    public class operazioneUtente
    {
        public string nomeUtenteRichiedente { get; set; } = "Utente non trovato";
        public string nomeUtenteEsecutore { get; set; } = "Utente non trovato";
        public RegistroOperazioni operazione { get; set; } = new RegistroOperazioni();
    }

    public class OperazioneQuery
    {
        public byte? TipoOperazione;
        public string? CodiceAssociato;
        public int? IdTracciato;
        public int? idPromoLavorazione;
        public int? idPromoLavorazioniRecord;
        public string? Area;
        public string? Canale;
    }

    public class OperazioniResult
    {
        public List<string> errors { get; set; } = new List<string>();
        public bool esito { get; set; }
        public List<operazioneUtente> operazioni { get; set; } = new List<operazioneUtente>();
    }

    public class CheckLastModificaResult
    {
        public List<CodiceOperazioniResult> Risultati { get; set; } = new List<CodiceOperazioniResult>();
        public bool EsitoGlobale { get; set; }
        public List<string> Errori { get; set; } = new List<string>();
    }

    public class CodiceOperazioniResult
    {
        public string? Codice { get; set; }
        public OperazioniResult? OperazioniResult { get; set; }
    }

    public class operazioneRegistro
    {
        public int tipoOperazione { get; set; } = 0;
        public string codice { get; set; } = string.Empty;
        public string codiciDaControllareIntegrita { get; set; } = "";
        public int? idTracciato { get; set; } = null;
        public bool dataControl { get; set; } = true;
        public bool area { get; set; } = false;
        public bool canale { get; set; } = false;
        public string url { get; set; } = string.Empty;
        public string? formData { get; set; } = null;
        public string? dataRegistrazione { get; set; }
        public int autore { get; set; }
    }

    public class RicercaRegitroRequest
    {
        public string nome { get; set; } = "";
        public DateTime? dataDa { get; set; }
        public DateTime? dataA { get; set; }
    }
    public interface IRecordRicercaRegitroResponse
    {
        public string Url { get; set; }
        public string FormData { get; set; }
        public Byte Stato { get; set; }
        public int Autore { get; set; }
        public DateTime DataRegistrazione { get; set; }
        public string CodiceAssociativo { get; set; }
        public Byte TipoOperazione { get; set; }
    }

    public class RicercaRegistroSyncFotoResponse
    {
        public List<RicercaRecordRegistroSyncFotoResponse> list { get; set; } = new List<RicercaRecordRegistroSyncFotoResponse>();
        public string error { get; set; } = "";
    }

    public class RicercaRecordRegistroSyncFotoResponse:IRecordRicercaRegitroResponse
    {
        public string Url { get; set; } = "";
        public string FormData { get; set; } = "";
        public Byte Stato { get; set; }
        public int Autore { get; set; }
        public DateTime DataRegistrazione { get; set; }
        public string CodiceAssociativo { get; set; }
        public Byte TipoOperazione { get; set; }

        public RevisioneSyncFoto Meta { get; set; } = new RevisioneSyncFoto();

    }

    #endregion

    #region classi di Revisione interna
    public class BoolResult
    {
        public bool Esito { get; set; }
        public ErrorCodes errorCode { get; set; } = ErrorCodes.None;
        public string error { get; set; } = String.Empty;
    }

    public class PromoLavorazioniResult
    {
        public bool Esito { get; set; }
        public string error { get; set; } = String.Empty;

        public List<PromoLavorazioniRecord> records { get; set; } = new List<PromoLavorazioniRecord>();
    }

    public class revisioneMultiplex
    {
        public bool Esito { get; set; }

        public bool revisioneEffettuata { get; set; }
        public ErrorCodes errorCode { get; set; } = ErrorCodes.None;
        public string error { get; set; } = String.Empty;
    }

    public class StringResult
    {
        public string? Esito { get; set; }
        public bool boolEsito { get; set; }
        public ErrorCodes errorCode { get; set; } = ErrorCodes.None;
        public string error { get; set; } = String.Empty;
    }
    public class AttivitaResult
    {
        public Attivitum? Attivita { get; set; }
        public ErrorCodes errorCode { get; set; } = ErrorCodes.None;
        public string error { get; set; } = String.Empty;
    }

    public class OperationRequest
    {
        public OperationCommand Command { get; set; } = OperationCommand.None;
        public object Packet { get; set; } = new object();
        public List<FicoContextField> context { get; set; } = new List<FicoContextField>();
        public Int64 AttivitaAssegnata { get; set; }
        public Int64 AttivitaParent { get; set; }
        public bool RichiestaAutorizzazioneUtenteIstantanea { get; set; } = false;


    }

    public class RevisoreRequest
    {
        public List<Int32>? IdTracciatiPartenza { get; set; }
        public Int32 IdPromo { get; set; }
        public List<Int32>? IdTracciatiRichiesti { get; set; }
        public string[]? metaPerSuggerimento { get; set; }
        /*Deprecato*/
        public Dictionary<string, string>? formRequest { get; set; }

    }

    public class RevisoreCountResult
    {
        public int[] globalCount { get; set; }
        public Dictionary<int, int[]> countTracciati { get; set; }
    }

    public class RevisioneFromInddRequest
    {
        public Int32 idLavorazione { get; set; }
        public string? codice { get; set; }
        public string? codice_gruppo { get; set; }
        public RevisioneDescrizione? revisione { get; set; }
        public List<RevisioneCampiOffertaFromIndd>? campi_offerta { get; set; }

    }

    /// <summary>
    /// Lettura dei meta di una promo lavorazione.
    /// I meta gia' salvati, e i payload dei client, possono portare una chiave valorizzata
    /// a null su una proprieta' che qui e' un tipo valore, ad esempio noRender o stato.
    /// Un null va letto come chiave assente, cioe' come il default: non deve far fallire
    /// la lettura dell'intera scheda.
    /// </summary>
    public static class MetaPromoLavorazioni
    {
        private static readonly Newtonsoft.Json.JsonSerializerSettings settings =
            new Newtonsoft.Json.JsonSerializerSettings
            {
                NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore
            };

        public static RevisioneMetaPromoLavorazioni? leggi(string meta)
        {
            return Newtonsoft.Json.JsonConvert.DeserializeObject<RevisioneMetaPromoLavorazioni>(meta, settings);
        }

        public static List<RevisioneSelezioneFotoFromIndd>? leggiSelezioniFoto(string ps)
        {
            return Newtonsoft.Json.JsonConvert.DeserializeObject<List<RevisioneSelezioneFotoFromIndd>>(ps, settings);
        }
    }

    //Legata esclusivamente al dato di revisione articolo su Istanta
    public class RevisioneMetaPromoLavorazioni
    {
        public List<RevisioneCampiOffertaFromIndd>? campiOfferta { get; set; }
        public List<RevisioneFotoFromIndd>? foto { get; set; }
        public List<RevisioneSelezioneFotoFromIndd>? ps { get; set; }
    }

    //Legato al campo LABEL della rappresentazione grafica
    public class RevisioneFotoFromIndd
    {
        public string? codRef { get; set; }//Codice della referenza di cui è stata alterata la foto o la selezione
        public string? nomeFoto { get; set; }
        public string guidId { get; set; } = "";
        public TipoFoto tipo { get; set; }

        public bool rimuoviFoto { get; set; } = false;
    }

    public class RevisioneSyncFoto
    {
        public string? dir;
        public int totalFilesScanned;
        public List<ShortSyncFile>? fileSynced;
    }

    public class RevisioneSelezioneFotoFromIndd
    {
        public string? codRef { get; set; }//Codice della referenza di cui è stata alterata la foto o la selezione
        public StatoSelezioneFoto stato { get; set; }
        /// <summary>
        /// Opzione di rendering della foto primaria/secondaria del box. Quando true il
        /// Plugin impagina l'immagine ma la rende invisibile in fase di impaginazione.
        /// I meta gia' salvati non contengono la chiave: l'assenza vale false.
        /// </summary>
        public bool noRender { get; set; } = false;
    }



    public class ArticoloInRevisioneOld
    {
        public Int64 TracciatoId { get; set; }
        public string? TracciatoDescrizione { get; set; }
        public string? TracciatoTipo { get; set; }
        public string? TracciatoBrand { get; set; }
        public string? TracciatoGrammatura { get; set; }
        public decimal? TracciatoPeso { get; set; }
        public string? TracciatoUnitaMisura { get; set; }
        public Int64 Id { get; set; }
        public String? CodiceReferenza { get; set; }
        public string? Descrizione { get; set; }
        public string? Tipo { get; set; }
        public string? Brand { get; set; }
        public string? Grammatura { get; set; }
        public decimal Peso { get; set; }
        public string? UnitaMisura { get; set; }
        public string? DettagliInOutVolantino { get; set; }
        public DateTime? DataUltimaRevisione { get; set; }
    }
    public class ArticoloImpaginato
    {
        public Int64 Id { get; set; }
        public Int64? IdRecord { get; set; } = 0;
        public string? CodiceGruppo { get; set; } = "";
        public Int64 IdPagina { get; set; }
        public Int16 Indice { get; set; }
        public string? Formato { get; set; }
        public MenaboPagine? IdPaginaNavigation { get; set; }
        public List<CombinazioniMeccaniche>? Meccaniche { get; set; }
    }

    public class ArticoliImpaginati
    {
        public ArticoloImpaginato[]? articoli { get; set; }
        public string? prova { get; set; }
    }
    /// <summary>
    /// Da dove arriva un'istanza di una referenza: area, canale e nome del file xlsx
    /// importato. La stessa referenza puo' esistere in piu' aree/canali, ognuna con il
    /// suo file di origine. In riga se ne vedeva uno solo, quello del record scelto
    /// come rappresentante, che quindi mentiva su tutte le altre istanze.
    /// </summary>
    public class OrigineTracciato
    {
        public string Area { get; set; } = "";
        public string Canale { get; set; } = "";
        public string Xlsx { get; set; } = "";
    }

    public class ArticoloInRevisione
    {
        public Int64? idRec;
        public Dictionary<string, object>? recordInTracciato;
        public ArticoliDescrizioni? recordRevisionato;
        public List<RevisioneRegionale>? recordRevisionatiRegionali;
        public ArticoloImpaginato? recordImpaginato;
        public PromoTracciati? promoTracciati;
        public Promo? promo;
        public Formato? formato;        

        public Byte Versione;
        public bool isGruppo;
        public bool isObsoleto;
        public string? label;
        //public Byte statoSelezione;
        public Byte hasFoto;
        public List<string>? allEtichette;
        public List<string>? etichetteVisual;
        public List<RegoleMastro> regoleMastro = new List<RegoleMastro>();
        // Tutte le origini della referenza (o del gruppo): una voce per area/canale.
        // Il Revisore ci costruisce sopra l'elenco che si apre dal bottone XLS.
        public List<OrigineTracciato>? origini;
        public string? customLabelForDescrizioneRegionale;

        public ArticoloInRevisione Clona()
        {
            ArticoloInRevisione clone = new ArticoloInRevisione();

            //Valori naturali
            clone.idRec = idRec;
            clone.Versione = Versione;
            clone.isGruppo = isGruppo;
            clone.isObsoleto = isObsoleto;
            clone.label = label;
            //clone.statoSelezione = statoSelezione;
            clone.hasFoto = hasFoto;

            //Valori refernziati che possono rimanere tali
            clone.recordRevisionato = recordRevisionato;
            clone.recordImpaginato = recordImpaginato;
            clone.promoTracciati = promoTracciati;
            clone.promo = promo;
            clone.formato = formato;

            //Lui deve essere creato da zero

            clone.recordInTracciato = new Dictionary<string, object>();
            foreach (var item in recordInTracciato!)
            {
                clone.recordInTracciato.Add(item.Key, item.Value);
            }

            //Questi vengono sempre impostati dopo il CLone
            //clone.allEtichette = allEtichette;
            //clone.etichetteVisual = etichetteVisual;
            //clone.regoleMastro = regoleMastro;
            //clone.names = names;
            //clone.groupNames = groupNames;
            return clone;

        }
    }

    public class RevisioneRegionale
    {
        public Int64 Id { get; set; }
        public Int64? IdArticolo { get; set; }
        public string? CodiceGruppo { get; set; }
        public string? Area { get; set; }
        public string? Canale { get; set; }
        public string? Custom { get; set; }
        public string? Descrizione1 { get; set; }
        public string? Descrizione2 { get; set; }
        public string? Descrizione3 { get; set; }
        public string? Descrizione4 { get; set; }
        public string? DescrizioneIndd { get; set; }
        public string? Extra { get; set; }
        public decimal? Peso { get; set; }
        public string? Um { get; set; }

        public DateTime DataUltimaRicezione { get; set; }

        public bool Approvata { get; set; }
        public bool Attiva { get; set; }
        public string? FirmaTracciato { get; set; }

        public virtual Articoli IdArticoloNavigation { get; set; } = null!;
    }
    public class ArticoloInRevisioneKitResult
    {
        public List<ArticoloInKit> records { get; set; } = new List<ArticoloInKit>();
        public Int64 IdRecInLavorazione { get; set; }
        public TipoLavorazione tipoLavorazione { get; set; }
        public string? error { get; set; }
        public string? warn { get; set; }
        public bool esito { get; set; }
        public int errorCode { get; set; }
    }

    public class ListArticoloInRevisioneKitResult
    {
        public List<recordsPerPagina> recordsPerPagina { get; set; } = new List<recordsPerPagina>();
        public string? error { get; set; }
        public bool Esito { get; set; }
    }

    public class recordsPerPagina
    {
        public string? nomePagina { get; set; }
        public List<List<ArticoloInKit>> records { get; set; } = new List<List<ArticoloInKit>>();
    }

    public class RevisoreResult
    {
        public string? AreaPromo { get; set; }
        public List<ArticoloInRevisione> Data { get; set; } = new List<ArticoloInRevisione>();
        public List<ArticoloInRevisione> ArticoliObsoleti { get; set; } = new List<ArticoloInRevisione>();
        public string? Error { get; set; }
    }

    public class DescrizioniSottogruppi { 
        public string codiceSottogruppo; 
        public List<ArticoliDescrizioni> descrizioni; 
        public string firmaTracciatoSottogruppo; 
    }

    public class RevisioniActions
    {
        public int idPromo { get; set; }
        public List<RevisioneAction> coda { get; set; } = new List<RevisioneAction>();
    }
    public class RevisioneAction
    {
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Descrizione1 { get; set; } = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Descrizione2 { get; set; } = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Descrizione3 { get; set; } = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string Descrizione4 { get; set; } = "";
        [DisplayFormat(ConvertEmptyStringToNull = false)]
        public string DescrizioneIndd { get; set; } = "";
        public decimal Peso { get; set; }
        public string Um { get; set; } = "";
        //public Int64 IdRef { get; set; } = 0;
        public string Codice { get; set; } = "";
        public string CodiceGruppo { get; set; } = "";
        //public string Area { get; set; } = "";
        public string FirmaTracciato { get; set; } = "";

        public Dictionary<string, ExtraAutoFIelds> Extra { get; set; } = new Dictionary<string, ExtraAutoFIelds>();
        //public string Canale { get; set; } = "";
        //public bool canaleRichiesto { get; set; }
        //public bool areaRichiesta { get; set; }

        public DatiRegionali? revRegionale { get; set; }
        public Int64 IdRecord { get; set; } = 0;
        public bool IsSottogruppo { get; set; } = false;
    }

    #endregion

    #region F.I.C.O class
    public class recordResultFromFP
    {
        public List<CompiledField> compiledFields = new List<CompiledField>();
        public List<string> deletedFields = new List<string>();
        public List<string> foto = new List<string>();
        public string meccanica = "";
        public string codiceBox = "";
        public List<fotoExtraForFP> fotoExtra = new List<fotoExtraForFP>();
        public Dictionary<string, object> dataFields = new Dictionary<string, object>();
        public List<Dictionary<string, object>> groupElements = new List<Dictionary<string, object>>();

        public Int16 pag = 0;
        public decimal x = 0;
        public decimal y = 0;
        public decimal w = 0;
        public decimal h = 0;
        public decimal wPage = 0;
        public decimal hPage = 0;
        public decimal percIngombro = 0;
        public decimal aspectRatio = 0;


    }

    public class downloadFromFPResult {
        public List<recordResultFromFP> results = new List<recordResultFromFP>();
        public List<string> errors = new List<string>();
        public bool esito;
    }

    public class FicoCombinazioneKitLocaleResult
    {
        public List<PromoLavorazioni>? records { get; set; }
        public string? error { get; set; }
        public bool esito { get; set; }
    }

    #endregion

    #region Menabo class

    public enum StatoRicollegamentoBox
    {
        GiaImpaginato=1,
        AutoImpaginato=2,
        CambioDiForma=3,
        InesistenteNellaPromo=4,
        Inesistente=5,
        Clonato=6,
        RichiestaClonazione=7,
    }

    public partial class MenaboRefLocal
    {
        public Int64 Id { get; set; }
        public Int64? IdRecord { get; set; }
        public string? CodiceGruppo { get; set; }
        public Int64 IdPagina { get; set; }
        public Int16 Indice { get; set; }
        public Byte Selezione { get; set; }
        public string? Formato { get; set; }
        public List<CombinazioniMeccaniche>? Meccaniche { get; set; }
        public MenaboPagine IdPaginaNavigation { get; set; } = null!;

    }

    public class RecordPostControlloMeccaniche
    {
        public ArticoloInRevisione? record = null;
        public List<CombinazioniMeccaniche> meccanicheValide = new List<CombinazioniMeccaniche>();
        public bool meccanicaInvalidata = false;
        public string meccanicaAssegnata = "";
    }

    public class AddestramentoExternalLibItem
    {
        public string File { get; set; } = String.Empty;
        public string Tipo { get; set; } = String.Empty;
        public string Metodo { get; set; } = String.Empty;
        public Dictionary<int, string>? Parameters { get; set; }

        public override string ToString()
        {
            return File + "." + Tipo + "." + Metodo;
        }
    }


    public class DescrittivaArticolo
    {
        public string? descrizione1;
        public string? descrizione2;
        public string? descrizione3;
        public string? descrizione4;
        public string? um;
        public decimal peso;
        public DescrittivaArticolo? gruppo;
    }

    //public class FileFoto
    //{
    //    public IFormFile? file { get; set; }
    //    public Int64 idArticolo { get; set; }
    //}

    public class InterpreterRuleFromIndd
    {
        public string? type;
        public string? name;
        public string? bind;
        public InterpreterRuleFromIndd[]? children;
        public bool take;
        public bool integrativo; //Quando questo è trrue significa che il dato deve essere INTEGRATO a quello che già ho e NON sostituito
        public bool indicaFoto; //Se true significa che questo campo, nel valore INDICA delle foto da cercare in alta durante le operazioni di esportazione
        public string? separatoreDiValore;//Stringa di separazione tra un valore e l'altro se si tratta di una rappresentazione di più valori in una stringa
        public bool itemTag;
    }
    public class InterpreterXmlFromIndd
    {
        public string? lib;
        public InterpreterRuleFromIndd[]? syncRevisione;
    }

    public class CampoExtraIntegrativo
    {
        public string? valore;
        public string separatore = "|";//Tengo questo valore assoluto come separatore di valori integrativo. Potrebbe anche essere forzato un campo diverso da InterpreterFromIndd.json nelle regole del campo in specifico
    }

    public class InterpreterConfronto
    {
        public string? lib;
        public string? listatoVolantino;
    }

    public class dettaglioObj
    {
        public int id_rec { get; set; }
        public string? chiave { get; set; }
        public string? value { get; set; }
        public string? type { get; set; }
        public float valueNumber { get; set; }
        public string? valueString { get; set; }
        public bool valueBool { get; set; }

    }

    public class refsConMultiplex
    {
        public MenaboRefLocal? Ref { get; set; }
        public List<string>? allEtichette { get; set; }
        public List<string>? etichetteVisual { get; set; }

        public List<string>? codiciRefdaAggiungere = new List<string>();
        public string? codiceMultiplexAggiunto { get; set; }

        public List<string>? codiciRefdaRimuovere = new List<string>();
        public string? codiceMultiplexRimossi { get; set; }
    }

    public class listMenaboRefs
    {
        public List<MenaboRef>? RefList { get; set; }
    }

    public class MenaboRefsToImpaginate
    {
        public MenaboRef? menaboref { get; set; }

        public List<listaSetRegole>? regole { get; set; }
        //public int idRegola { get; set; }
        public int idTracciato { get; set; }

        public int indiceImpaginato;

        public int paginaImpaginato;
        public string? areaTracciato { get; set; }
    }

    public class ListMenaboRefsToImpaginate
    {
        public List<MenaboRefsToImpaginate>? refsToImpaginate { get; set; }
    }

    public class ResultMenaboRefsToImpaginate
    {
        public MenaboRefsToImpaginate? refs { get; set; }
        public string? error { get; set; }

        public int errorCode { get; set; }

    }

    public class ResultImpaginazioneAutomatica
    {
        public List<ResultMenaboRefsToImpaginate> menaboRefsImpaginated = new List<ResultMenaboRefsToImpaginate>();
        public List<ResultMenaboRefsToImpaginate> menaboRefsFailed = new List<ResultMenaboRefsToImpaginate>();
        public bool failedOperation = false;
        public string error = "";
    }

    public class CodiciConSottogruppo
    {

        public List<long>? idRecDaModificare = new List<long>();
        public string? codiceSottogruppo { get; set; }

        public List<string>? tracciatiNonModificati = new List<string>();

        public string? error;

    }

    public class FuoriPoPList
    {
        public List<FuoriPoPObj>? PoPElements { get; set; }
    }

    public class FuoriPoPObj
    {
        public string? id { get; set; }
        public bool? value { get; set; }
    }

    public class ReportDuplicazione
    {
        public string? report;
        public string? error;
        public bool esito;
        public List<string>? indici_paginaDaNonDuplicare;
    }

    public class ElementoRichiesto
    {
        public string? codici { get; set; }
        public string? canale { get; set; }
        public string? area { get; set; }
    }

    public class ElementiInput
    {
        public List<ElementoRichiesto>? elementiRichiesti { get; set; }
    }

    public class ArticoliManuali
    {
        public List<Dictionary<string, string>>? listTracciato { get; set; }
    }

    public class RecordConTracciato
    {
        public PromoTracciatiRecord? record { get; set; }
        public int? idTracciato { get; set; }
        public string? siglaTracciato { get; set; }
        public string codiceMultiplex = "";
        public bool? impaginato { get; set; }
        public bool? gruppoImpaginato { get; set; }

        public int idPagina = 0;
    }

    public class RecordsPromo
    {
        public List<PromoTracciatiRecord>? records { get; set; }
    }

    public class listaSetRegole
    {
        public int id { get; set; }
        public List<setRegole>? setRegoleList { get; set; }
        public int ordine { get; set; }
        public int idAddestramento { get; set; }
        public int paginaDa { get; set; }
        public int paginaA { get; set; }
        public int indice { get; set; }
        public bool indicePreciso { get; set; }
        public int restrizioni { get; set; }
        public string? formatoPagina { get; set; }
        public string? meccanica { get; set; }
        public string? label { get; set; }

        public int priority = 0;
    }
    public class setRegole
    {
        public List<Regola>? setDiRegole { get; set; }
    }
    public class Regola
    {
        public int idCampo { get; set; }
        public string? nomeCampo { get; set; }
        public int operatorId { get; set; }
        public string? value { get; set; }
    }

    public class refImpaginazione
    {
        public MenaboRef refToImpaginate = new MenaboRef();
        public PromoTracciatiRecord record = new PromoTracciatiRecord();
        public int idRegola = 0;
        public List<listaSetRegole> regola = new List<listaSetRegole>();
        public int impaginatoAPagina = 0;
        public int impaginatoAIndice = 0;
        public bool impaginato = false;
        public bool preImpaginato = false;
    }

    public class Meccanica
    {
        public string? meccanicaName { get; set; }
        public List<int>? listLivelliPresenti { get; set; }
        public string? formatoRichiesto { get; set; }
    }

    public class Criterio
    {
        public string? Chiave { get; set; }
        public Operatore Operatore { get; set; }
        public string? Valore { get; set; }
        //public int Ordine { get; set; }
    }

    public class Griglia
    {
        public string? nomeGriglia { get; set; }
        public string formato { get; set; }
        public int numeroBox { get; set; }
        public List<int> boxOccupati { get; set; } = new List<int>();
        //public List<List<int>> Righe { get; set; }
    }


    public class FiltriPerPagina
    {
        public int Pag { get; set; }
        public int Ordine { get; set; }
        public List<Filtro>? listFiltri { get; set; }
        public Griglia? Griglia { get; set; }
        public statoFiltro Stato { get; set; }
        public List<string> codiciEsclusi { get; set; } = new List<string> { };
        public List<string> codiciForzati { get; set; } = new List<string> { };
        public List<filtroCodici> codiciEsclusiConId { get; set; } = new List<filtroCodici>();
        public List<filtroCodici> codiciForzatiConId { get; set; } = new List<filtroCodici>();
    }

    public class filtroCodici
    {
        public string codice { get; set; } = "";
        public int idRec { get; set; } = 0;
    }

    public class Filtro
    {
        public List<Criterio>? Criteri { get; set; }
        public int Ordine { get; set; } = 1;
        public int Limite { get; set; } = 0;
    }

    public class FotoExtraAutoItem
    {
        public string? NomeFoto { get; set; }
        public bool Escluso { get; set; }
    }

    public class RootFilters
    {
        public List<FiltriPerPagina>? Filters { get; set; }
        // Legacy
        public List<string>? CodiciImpaginati { get; set; }
        public List<string>? CodiciEsclusi { get; set; }

        // New
        public List<filtroCodici>? CodiciImpaginatiConId { get; set; }
        public List<filtroCodici>? CodiciEsclusiConId { get; set; }
        public List<Griglia> GriglieValide { get; set; }
    }

    public class ResponseImpagination
    {
        public int Pag { get; set; }
        public string? codiceFiltro { get; set; }
        public int ConteggioRef { get; set; }
        public int ConteggioRefImpaginate { get; set; }
        public int ConteggioBox { get; set; }
        public int ConteggioBoxOccupati { get; set; }
        public List<Dictionary<string, object>>? ListaRef { get; set; }
        public List<Dictionary<string, object>>? ListaRefNonImpaginate { get; set; }
        public Griglia? Griglia { get; set; }
        public List<string>? Errori { get; set; }
    }

    public class RootFilterResponse
    {
        public TipoLavorazione tipoLavorazione { get; set; }
        public List<ResponseImpagination>? Result { get; set; }
        public string? error;
    }

    public class FileIndd
    {
        public string? nomeFileOld { get; set; }
        public string? nomeFile { get; set; }
        public string? area { get; set; }
        public string? canale { get; set; }
        public string? tracciatoCanale { get; set; } = null;
        public string? tracciatoArea { get; set; } = null;
        public IFormFile? file { get; set; }
        public string? codice { get; set; }
        public int idLavorazione { get; set; }
        public Int64 idRec { get; set; }
        public TipoFoto tipo { get; set; }
        public FileInddUploadMethod uploadMethod { get; set; }
        public string? guidId { get; set; }


        public void Normalize()
        {
            area = NormalizeString(area);
            canale = NormalizeString(canale);
            tracciatoArea = NormalizeString(tracciatoArea);
            tracciatoCanale = NormalizeString(tracciatoCanale);
        }

        string? NormalizeString(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            if (value == "null") return null;
            return value;
        }
    }

    public class UpdateImmagineEsistenteModel
    {
        public string? Codice { get; set; }
        public string? scopeArea { get; set; }
        public string? scopeCanale { get; set; }
        public string? tracciatoArea { get; set; }
        public string? tracciatoCanale { get; set; }
        public string? GuidId { get; set; }
        public int id { get; set; }
        public bool validaSoloPerLavorazione { get; set; }
        public int idLavorazione { get; set; }
        public bool propaga { get; set; }


        public void Normalize()
        {
            scopeArea = NormalizeString(scopeArea);
            scopeCanale = NormalizeString(scopeCanale);
            tracciatoArea = NormalizeString(tracciatoArea);
            tracciatoCanale = NormalizeString(tracciatoCanale);
        }

        string? NormalizeString(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            if (value == "null") return null;
            return value;
        }
    }

    public class fotoResult
    {
        public bool esito { get; set; }
        public string? error { get; set; }
        public string? nomeReale { get; set; }
        public TipoFoto tipo { get; set; }
        public string? guidId { get; set; }
        public string? hash { get; set; }
        public int Id { get; set; }
    }

    public class RichiestaImpaginazioneSingolo
    {
        public string? codiceGruppo { get; set; }
        public int idRec { get; set; } = 0;
        public int idLavorazione { get; set; }
        public byte pagina { get; set; }
        public bool byPassBloccoGiaImpaginato { get; set; }
    }
    public class RichiestaRicollegamentoBox
    {
        public RicollegamentoBoxItem elementoDaRicollegare { get; set; }
        public int idLavorazione { get; set; }
        public string canaleDiPartenza { get; set; }
        public string areaDiPartenza { get; set; }
        public string rangePagine { get; set; }
    }
    public class RisultatoRicollegamentoBox
    {
        public List<RicollegamentoBoxItem> codici { get; set; } = new List<RicollegamentoBoxItem>();
        public int idRecSelezionato = 0;
        public int idLavorazione { get; set; }
        public string error;
    }
    public class RicollegamentoBoxItem
    {
        public string codiceGruppo { get; set; }

        public int idRec { get; set; } = 0;
        public Byte pag {  get; set; }
        public Byte idAddestramento {  get; set; }
        public bool forzaloAllaPaginaIndicata { get; set; }
        public List<string> codiciPresenti { get; set; }
        public List<string> codiciNonEsistenti { get; set; }
        public RiscontriInAltriTracciati riscontriInAltriTracciati { get; set; } = new RiscontriInAltriTracciati();
        public StatoRicollegamentoBox stato { get; set; }
        public string error;
    }

    public class RiscontriInAltriTracciati
    {
        public Dictionary<string, object> piuRecente { get; set; } = null;
        public Dictionary<string, object> stessaPromo { get; set; } = null;
        public Dictionary<string, object> stessoCanaleArea { get; set; } = null;
        public Dictionary<string, object> stessoCanale { get; set; } = null;
        public Dictionary<string, object> stessaArea { get; set; } = null;
        public List<Dictionary<string, object>> tuttiRiscontri { get; set; } = new List<Dictionary<string, object>>();

    }

    public class SgruppamentoRequest
    {
        public string? originalGroup { get; set; }
        public int idRec { get; set; } = 0;
        public List<GruppoSgruppato>? ListaGruppi { get; set; }
    }

    public class GruppoSgruppato
    {
        public string? CodiceGruppo { get; set; }
    }

    public class listaRefPerPagina
    {
        public List<referenzePerPagina> listRefPerPagina { get; set; } = new List<referenzePerPagina>();
    }

    public class referenzePerPagina
    {
        public string? nomePagina { get; set; }
        public List<string> codici { get; set; } = new List<string>();
        public List<filtroCodici> codiciConId { get; set; } = new List<filtroCodici>();
    }

    public class SgruppamentoResponse
    {
        public bool esito = true;

        public string error = "";

        public List<Dictionary<string, object>> listaGruppi = new List<Dictionary<string, object>>();
    }

    public class richiestaCodici
    {
        public List<string> ListaCodici { get; set; }
    }

    public class RaggruppamentoResponse
    {
        public bool esito = true;

        public string error = "";

        public Dictionary<string, object> gruppo = new Dictionary<string, object>();
    }

    public class ArtworkRequest
    {
        public string? Id { get; set; }
        public string? FotoId { get; set; }
        public bool delete { get; set; }
    }

    public class CambioMetaRecordTracciatoRequest
    {
        public string? codiceGruppo { get; set; }//Identificativo della prestazione coinvolta nell'alterazione
        public int idRec { get; set; } = 0;//Id del record coinvolto nell'alterazione, se disponibile
        public List<CambioMetaRecordTracciatoAzioneRequest>? azioni { get; set; }
    }

    public class resultPagina
    {
        public string? nomePagina { get; set; }
        public List<string> codiciCorrispondenti = new List<string>();
        public List<string> codiciPresentiSoloSulServer = new List<string>();
        public List<string> codiciImpaginatiAPaginaDifferente = new List<string>();
        public List<string> codiciNonImpaginatiSulServer = new List<string>();
        public List<string> codiciImpaginatiMaNonPiuPresentiInTracciato = new List<string>();

        public List<filtroCodici> codiciCorrispondentiConId = new List<filtroCodici>();
        public List<filtroCodici> codiciPresentiSoloSulServerConId = new List<filtroCodici>();
        public List<filtroCodici> codiciImpaginatiAPaginaDifferenteConId = new List<filtroCodici>();
        public List<filtroCodici> codiciNonImpaginatiSulServerConId = new List<filtroCodici>();
        public List<filtroCodici> codiciImpaginatiMaNonPiuPresentiInTracciatoConId = new List<filtroCodici>();
    }

    public class resultPreAnalisi
    {
        public List<resultPagina> resultPaginas = new List<resultPagina>();
        public bool esito;
        public List<string> errors = new List<string>();
    }




    public class CambioMetaRecordTracciatoResponse
    {
        public bool esito = true;
        public string error = "";
        //public Dictionary<string, object> refItem = new Dictionary<string, object>();
    }

    public class CambioStrutturaleResponse
    {
        public bool esito = true;

        public string error = "";

        public Dictionary<string, object> item = new Dictionary<string, object>();
    }

    public class OkResultGruppi
    {
        public bool esito = true;

        public string error = "";

        public List<Dictionary<string, object>> listaGruppi = new List<Dictionary<string, object>>();
    }

    public class ListaGruppiRaggruppamento
    {
        public List<string>? ListaCodici { get; set; }

        // Nuovo formato id-aware
        public List<filtroCodici>? ListaCodiciConId { get; set; } = new();
    }

    #endregion

    #region Syncfoto class
    public class ScanFileRequest
    {
        public Int32 idFiltroTracciato { get; set; }
        public string[]? packagesName { get; set; }
        public string? workDir { get; set; }
        public string? originDir { get; set; }
    }

    public class SyncFileOperation
    {
        public string guidid { get; set; }
        public Int64 id { get; set; }
        public Int64 id_attivita { get; set; }
        public bool isScan { get; set; }
        public int totalFilesScanned { get; set; }
        public List<SyncFile>? files { get; set; }
        public string? error { get; set; }
        public string? originDir { get; set; }
    }

    public class SyncFileDownloadRequest
    {
        public string? jobName { get; set; }
        public string? dirOperatore { get; set; }
        public string[]? lista { get; set; }
        public List<SyncFile>? files { get; set; }
        public Byte tipoFiltro { get; set; }
    }

    public class FileOlympoOperazioneMassiva
    {
        public string? error { get; set; }
        public List<FileOlympoSync>? lista { get; set; } = new List<FileOlympoSync>();
    }
    public class FileOlympoOperazioneSingola
    {
        public string? error { get; set; }
        public FileOlympoSync? record { get; set; }
    }

    public class FileOlympoSync
    {
        public string? Id { get; set; }
        public string? FileHash { get; set; }

        public string? IdRef { get; set; }
        public string? FileName { get; set; }
        public int? Size { get; set; }

        public TipoFoto Tipo { get; set; }

    }

    #endregion

    #region Confronti

    public class ConfrontoCheckResponse
    {
        public List<Dictionary<string, string>>? combinazioni_master;
        public List<Dictionary<string, string>>? combinazioni_slave;
        public string? error;
    }

    public class InputForConfronto2
    {
        public int IdPromoMaster { get; set; }
        public string filtroCombinazioneMaster { get; set; } = String.Empty;
        public Byte versioneMaster { get; set; }
        public int IdPromoSlave { get; set; }
        public string filtroCombinazioneSlave { get; set; } = String.Empty;
        public Byte versioneSlave { get; set; }
        public int idImportazioneSlave { get; set; }
    }

    public class ResponseConfronto2
    {
        public TipoConfronto tipo;
        public List<ResponseRecordConfronto> lista=new List<ResponseRecordConfronto>();
        public string? acMaster;
        public string? acSlave;
        public List<string>? campiDiControllo;
        public string? csvGuidid;
        public string? error;
    }

    public class InputForFiltroExcel
    {
        public int idImportazioneSlave { get; set; }
        public List<InputFiltroForFiltroExcel> Filtro { get; set; }//Legati da operatore OR nel livello 2 //Legati da operatore AND nel livello 1
    }

    public class InputFiltroForFiltroExcel
    {
        public string chiave { get; set; } = String.Empty;
        public string[] valori { get; set; } = Array.Empty<string>();
    }
    public enum StatoRecordConfronto
    {
        None=0,
        Inalterato = 1,
        Alterato = 2,
        Entrante = 3,
        Uscente = 4
    }

    public enum StatoContestoRecordConfronto
    {
        None=0,
        InComune = 1,
        SoloMaster = 2,
        SoloSlave = 3
    }

    public enum TipoConfronto
    {
        Self=1,
        Different=2
    }

    public class ResponseRecordConfronto
    {
        public string? promo;
        public string? canale;
        public string? area;        
        public StatoRecordConfronto stato;
        public StatoContestoRecordConfronto statoContesto;        
        public List<ResponseRecordConfrontFieldDiff> campiDifferenti=new List<ResponseRecordConfrontFieldDiff>();
        public Dictionary<string, object>? data;
       
    }

    public class ResponseRecordConfrontFieldDiff
    {
        public string? campo;
        public object? valoreMaster;
        public object? valoreSlave;
    }

    public class AnalisiMomentoRequest
    {
        public string guidPromo { get; set; }
        public bool snapshot { get; set; }
        public List<string> listeCaricate {  get; set; }
    }

    public class AnalisiConfrontoRequest
    {
        public AnalisiConfrontoTracciatoDetails primario { get; set; }
        public AnalisiConfrontoTracciatoDetails secondario { get; set; }
    }

    public class AnalisiMomentoResponse
    {
        public List<AnalisiMomentoTracciatoDetails> tracciati { get; set; } = new List<AnalisiMomentoTracciatoDetails>();
        public bool esito { get; set; }
        public string? errors { get; set; }
        public string? warnings { get; set; }
    }



    #endregion

    #region generic class
    public class StringList
    {
        public List<string>? stringhe { get; set; }

    }


    public class StringifiedObject
    {
        public string? obj { get; set; }
    }


    public class csvDataset
    {
        public List<string>? header;
        public List<string>? headerField;
        public List<Dictionary<string, string>>? records = new List<Dictionary<string, string>>();
    }

    #endregion

    #region Dumping class
    public class ModuloCompilazionePerDataDump
    {
        public List<RefForModuloCompilazionePerDataDump>? source;
        public string? error;
    }
    public class RefForModuloCompilazionePerDataDump
    {
        public string? codice;
        public string? descrizione1;
        public string? descrizione2;
        public string? descrizione3;
        public string? descrizione4;
        public string? um;
        public decimal peso;
        public string? nomeFotoAttualeSuIstanta;

    }

    public class InputDump
    {
        public IFormFile? file { get; set; }
    }

    public class DumpOperationResult
    {
        public bool esito { get; set; }
        public int countUpdated { get; set; } = 0;
        public int countNew { get; set; } = 0;
        public string? error { get; set; }
    }

    #endregion

    #region Correggo class

    public class SchedaRefRequestFromCorreggo
    {
        public string? guidIdLavorazione { get; set; }
        public string? codiceGruppo { get; set; }

        public int idRec { get; set; } = 0;
    }

    public class AllFotoRequestByCorreggo_Response
    {
        public string? error;
        public string? result;
    }

    public class ModificaFotoESelezioneCorreggoRequest
    {
        public string? guidIdLavorazione { get; set; }
        public string? codice { get; set; }
        public int idRec { get; set; }
        public List<RecordFotoESelezioneCorreggo>? foto { get; set; }
    }

    public class ModificaFotoESelezioneCorreggoResponse
    {
        public string? error;
        public bool esito;
    }

    public class RecordFotoESelezioneCorreggo
    {
        public string? guidid;
        public string? codice;
        public string? nomeFile;
        public string? md5;
        //public bool p;
        //public bool s;
        public StatoSelezioneFotoCorreggo stato;
    }

    public class PendingConteggioGarante
    {
        public string key { get; set; } = "";
        public string codice { get; set; } = "";
        public string tipo { get; set; } = "";
        // "S" = singolo
        // "G" = gruppo
        // "SG" = sottogruppo
    }

    #endregion

    #region Enumerazioni
    public enum TipoImportazione
    {
        Vol = 1,
        PoP = 2,
        Manifesto = 3
    }
    public enum StatoSelezioneFoto
    {
        NonSelezionata = 0,
        Primaria = 1,
        Selezionata = 2
    }


    public enum ErrorCodes
    {
        None = 0,
        Generic = 1,
        FormatoIncorretto = 2,
        FileNotFound = 3,
        ItemNotFound = 4,
        CanaleAreaNonTrovato = 5,
        TipoVolSconosciuto = 6,
        DataConvertion = 7,
        CodArticoloNonTrovato = 8,
        DirectoryNotFound = 9,
        TracciatoNonTrovato = 10,
        VolantinoNonEsportabile = 11,
        SpazioInsufficienteInMenabò = 12,
        IndiceGiàOccupatoInMenabò = 13,
        NessunaPaginaDisponibile = 14,
        ImpossibileCambiareFormatoPagina = 15,
        ReferenzaImpaginata = 16,
        PaginaInesistente = 17,
    }

    public enum Restrizioni
    {
        Nessuna = 0,
        PaginaNuova = 1,
        PaginaEsclusiva = 2
    }
    public enum OperationCommand
    {
        None = 0,
        ImportazioneVol = 1,
        ImportazionePoP = 2,
        ConfrontoLista = 3,
        SyncFoto = 4,
        EsportazioneVol = 5,
        EsportazionePoP = 6,
        EsportazioneConfronto = 7,
        CopiaFiles = 8
    }
    public enum OperationStauts
    {
        InAttesaDiAssegnazione = 0,//Operazione registrata che attende di essere messa in coda e processata
        InCoda = 1,//Nel caso in cui si verifica overflow di simultaneità, il sistema assegna un numero di coda progressivo
        ElaborazioneDati = 2,//Il sistema sta elaborando l'attività
        AttesaI_O = 3,//Il sistema dice che l'attività è pronta per il processo di I/O 
        I_O = 4,//Il sistema sta procedendo con le operazion di I/O
        Cancellata = 5,//L'operatore ha cancellato l'attività che dovunque si trovi, arresta il processo
        Terminata = 6,//Operazione terminata con successo
        TerminataConErrori = 7,//Operazione terminata ma con errori
        InAttesaDiConfermaUtente = 8,//Operazione da confermare da un utente perchè proveniente da circuito FICO
        Esaminata = 9,
        Scartata=10
    }

    public enum TipoProcesso
    {
        Undefined = 0,
        Elaborazione = 1,
        FileSystem = 2
    }

    public enum TipoDiLog
    {
        None = 0,
        Traccia = 1,
        Warining = 2,
        Error = 3
    }

    public enum TipoEsportazione
    {
        EsportaDaTracciato = 0,
        EsportaDaArchivio = 1,
    }
    public enum TipoFiltroRevisione
    {
        ArticoliDaRevisionare = 1,
        ArticoliRevisionati = 2
    }

    public enum AddestramentoTipoOrdinamento
    {
        None = 0,
        Categoria = 1,
        Reparto = 2,
        Settore = 3,
        Segmento = 4
    }

    public enum AddestramentoTipoValore
    {
        NonAssegnato = 0,
        Stringa = 1,
        Numerico = 2,
        Decimale = 3,
        Data = 4,
        Bool = 5
    }

    public enum AddestramentoRuoli
    {
        Referenza = 1,
        Scatto = 2,
        Descrizioni = 3,
        Ean = 4,
        Peso = 5,
        Speciale = 6,
        UnitaMisura = 7,
        Area = 8,
        CheckArea = 9,
        Foto = 10,
        Tracciato = 11
    }

    public enum StatoPromo
    {
        Chiusa = 0,
        Aperta = 1,
        Eliminata=2
    }

    public enum StatoPromoImportazione
    {
        Processabile = 1,
        InAttesaDiConfermaUtente = 2,
        Processata = 3,
        Annullata = 4
    }

    public enum StatoRevisioneArticolo
    {
        NonProcessato = 0,
        Approvato = 1,
        CorrettoDaEdro = 2,
        Obsoleto = 3,
    }

    public enum TipoCompilazione
    {
        DuranteImportazione = 1,
        FineImportazione = 2,
        Esportazione = 3,
        Manuale = 4
    }

    public enum TipoSelezioneMenabo
    {
        Primaria = 1,
        Secondaria = 2,
        None = 3
    }

    public enum SyncStatus
    {
        Ok = 1,//Referenza INDD intatta come da traccaito
        NotFound = 2,//Referenza INDD NON trovata nel tracciato
        Corrupted = 3,//Referenza INDD identificata come gruppo che è stata ricostruita solo parzialmnente
        MultiplexReversed = 4//Referenza INDD identificata come gruppo che è stata ricostruita evidenziando un nuovo raggruppamento multiplex
    }

    public enum SyncDescrizioneStatus
    {
        None = 0,
        New = 1,
        Updated = 2,
        WillNew = 3,
        WillUpdate = 4
    }

    public enum SyncFotoStatus
    {
        New = 1,
        Updated = 2,
        WillNew = 3,
        WillUpdated = 4,
        Overwrite = 5,
        WillOverwrite = 6,
        NoFoundInSyncFolder = 7,
        SyncError = 8
    }

    public enum AskFoto
    {
        noAsked = 0,
        FotoPresente = 1,
        FotoNonPresente = 2
    }

    public enum ModalitaInserimento
    {
        NonSpecificatto = 0,
        Sistema = 1,
        Manuale = 2,
        Clone = 3
    }

    public enum StatoRecord
    {
        Disattivo = 0,
        Attivo = 1,
    }

    public enum operatorId
    {
        Uguale = 0,
        Diverso = 1,
        Contiene = 2,
        Non_contiene = 3,
        Inizia_con = 4,
        Finisce_con = 5,
        Maggiore_di = 6,
        Maggiore_o_uguale_di = 7,
        Minore_di = 8,
        Minore_o_uguale_di = 9
    }

    public enum statoRevisione
    {
        NonSpecificato = 0,
        Revisionato = 1,
        DaRevisionare = 2,
        DaConfermare = 3,
    }

    public enum statoUtente
    {
        Attivo = 1,
        Disattivo = 2,
        //FicoGuestAttivo = 3,
        //FicoGuestDisttivo = 4,
        FicoOAuth = 5,
    }

    public enum ruoloUtente
    {
        Superadmin = 1,
        Agenzia = 2,
        GDO = 4,
        PuntoVendita = 5,
    }

    //public enum ruoloUtente
    //{
    //    nonTrovato = 0,
    //    superAdmin = 1,
    //    utenteAgenzia = 2,
    //    guestFico=3
    //}

    public enum statoOperazioni
    {
        nonSpecificato,
        inAttesa,
        risolta,
        obsoleta,
        fallita,
    }

    public enum tipoOperazione
    {
        errore = 0,
        revisione = 1,
        updatePS = 2,
        updateFoto = 3,
        gruppa = 4,
        sgruppa = 5,
        syncFoto = 6,
        revisioneCampiOfferta = 7,
        syncPacchettoFoto = 8,
        eliminaFotoExtra = 9,
        cambioMeta = 10,
        cambioPagina = 11,
        rimuoviMetaFoto = 12,
        login=13
    }

    public enum senderOperazione
    {
        istanta,
        indd,
    }

    public enum statoFiltro
    {
        set,
        locked,
        free,
    }

    public enum Operatore
    {
        Uguale,
        Minore,
        MinoreUguale,
        Maggiore,
        MaggioreUguale,
        Diverso,
        In,
        NotIn
    }

    public enum TipoImpagnazione
    {
        ImpaginaTutto,
        SoloIngombranti,
        UnoXUno,
    }

    public enum FileInddUploadMethod
    {
        None = 0,
        Sovrascrivi = 1,
        Mantieni = 2,
        RelativoAllaLavorazione = 3
    }
    
    public enum StatoSelezioneFotoCorreggo
    {
        Primario= 1,
        Secondario=2,
        NonSelezionato= 3,
        ExtraEntrante=4,
        ExtraUscente= 5
    }

    #region FICO enum
    //public enum TipoUtenteFico
    //{
    //    FicoGuest = 0,
    //    Singular = 1,
    //    AgeziaGraficaAdmin = 2,
    //    AgeziaGraficaUser = 3,
    //    GdoAdmin = 4,
    //    GdoUser = 5,
    //    PuntoVendita = 6,
    //    Tipografia = 7

    //}
    public enum FICOAccessLevel
    {
        noSession = 0,
        //guestFico = 1,
        adminLocal = 2
    }

    public enum FICOContexts
    {
        nuovaLavorazione = 1,
        importInLavorazione = 2,
    }

    public enum FICOPromoLavorazioneStato
    {
        InLavorazione = 1,
        Esportato = 2,
    }
    #endregion

    #endregion

    #region crypto
    public static class Crypto
    {
        public static string GetMD5HashFromFile(byte[] byteArray)
        {
            using (var md5 = MD5.Create())
            {
                using (var stream = new MemoryStream(byteArray))
                {
                    return BitConverter.ToString(md5.ComputeHash(stream)).Replace("-", string.Empty);
                }
                //return BitConverter.ToString(md5.ComputeHash(byteArray)).Replace("-", string.Empty);

            }
        }
        public static string EncryptString(string Message, string Passphrase)
        {
            byte[] Results;
            System.Text.UTF8Encoding UTF8 = new System.Text.UTF8Encoding();

            // Step 1. We hash the passphrase using MD5
            // We use the MD5 hash generator as the result is a 128 bit byte array
            // which is a valid length for the TripleDES encoder we use below
            using (MD5 md5 = MD5.Create())
            {
                byte[] tdesKey = md5.ComputeHash(Encoding.UTF8.GetBytes(Passphrase));

                // Per TripleDES:
                using (TripleDES tdes = TripleDES.Create())
                {
                    tdes.Key = tdesKey;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;
                    // qui continua la tua logica, ad es. impostare Mode, Padding, IV, ecc.
                    // Step 4. Convert the input string to a byte[]
                    byte[] DataToEncrypt = UTF8.GetBytes(Message);

                    // Step 5. Attempt to encrypt the string
                    try
                    {
                        ICryptoTransform Encryptor = tdes.CreateEncryptor();
                        Results = Encryptor.TransformFinalBlock(DataToEncrypt, 0, DataToEncrypt.Length);
                    }
                    finally
                    {
                        // Clear the TripleDes and Hashprovider services of any sensitive information
                        tdes.Clear();
                    }

                }

            }

            // Step 6. Return the encrypted string as a base64 encoded string
            string baseUrlEncode = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(Results);
            return baseUrlEncode;////Convert.ToBase64String(Results);//.Replace("/", "|sl|").Replace("=", "|ug|");
        }

        public static string DecryptString(string Message, string Passphrase)
        {
            byte[] Results;
            System.Text.UTF8Encoding UTF8 = new System.Text.UTF8Encoding();

            byte[] DataToDecrypt = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlDecode(Message);
            //string message = Convert.ToBase64String(bytes); //Encoding.UTF8.GetString(bytes);

            // Step 1. We hash the passphrase using MD5
            // We use the MD5 hash generator as the result is a 128 bit byte array
            // which is a valid length for the TripleDES encoder we use below
            using (MD5 md5 = MD5.Create())
            {
                byte[] tdesKey = md5.ComputeHash(Encoding.UTF8.GetBytes(Passphrase));

                // Per TripleDES:
                using (TripleDES tdes = TripleDES.Create())
                {
                    tdes.Key = tdesKey;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;

                    //string convertM = Message.Replace("-sl-", "/").Replace("-ug-", "=");
                    //string convertM = Message;// Message.Replace("|sl|", "/").Replace("|ug|", "=");
                    //byte[] DataToDecrypt = Convert.FromBase64String(convertM);
                    try
                    {
                        ICryptoTransform Decryptor = tdes.CreateDecryptor();
                        Results = Decryptor.TransformFinalBlock(DataToDecrypt, 0, DataToDecrypt.Length);
                    }
                    finally
                    {
                        // Clear the TripleDes and Hashprovider services of any sensitive information
                        tdes.Clear();
                    }

                }
            }
            // Step 6. Return the decrypted string in UTF8 format

            return UTF8.GetString(Results);
        }
    }

    #endregion 

    #region estensioni

    public static class SessionIstantaObject
    {
        public static string ConvertACapoConBrTagPerXml(string obj)
        {
            string result = obj;

            result = result.Replace(Environment.NewLine, "<br>");
            result = result.Replace("\n", "<br>");

            return result;
        }

        public static string GetSession(HttpContext context)
        {
            try
            {
                string? str = context.Session.GetString("id");
                if (str == null)
                {
                    return "No session".ToLower();
                }
                else
                {
                    return str.ToLower();
                }
            }
            catch (Exception ex)
            {
                ex.ToString();
                return "No session".ToLower();
            }
        }
        public static string GetSessionName(HttpContext context)
        {
            if (context.Session != null)
            {
                string? nome = context.Session.GetString("nomeUtente");
                if (nome != null)
                {
                    return nome;
                }
            }
            return "";
        }
        public static string GetRecoverySession(HttpContext context)
        {
            if (context.Session != null)
            {
                string? jsonGuid = context.Session.GetString("recoveryGuid");
                if (jsonGuid != null)
                {
                    return jsonGuid;
                }
            }
            return "";
        }
    }

    #endregion

    #region classi riferite al plugin
    public class PluginManifest
    {
        public string? id { get; set; }
        public string? name { get; set; }
        public string? version { get; set; }
        public string? main { get; set; }
        public int manifestVersion { get; set; }
        public string? versionId { get; set; }
        public List<PluginManifestHost>? host { get; set; }
    }
    public class PluginManifestHost
    {
        public string app { get; set; }
        public string minVersion { get; set; }

    }

    #endregion

    #region logs & audits class
    public class LogsDiSistemaResult
    {
        public string[] lista { get; set; }
        public string error { get; set; }
    }
    public class LogsDiSistemaFileEntry
    {
        public string nome { get; set; }
        public DateTime lastModifiedDate { get; set; }
    }
    public class LogsDiSistemaFileResult
    {
        public List<LogsDiSistemaFileEntry> content { get; set; }
        public string error { get; set; }
    }

    public class RicercaAuditsRequest
    {
        public DateTime? dataInizio { get; set; } = DateTime.MinValue;
        public DateTime? dataFine { get; set; } = DateTime.MinValue;
        public int idUtente { get; set; } = 0;
        public string tipoOperazione { get; set; }
        public int pageSize { get; set; } = 20;
        public int page { get; set; } = 1;
    }
    public class RicercaAuditsResult
    {
        public List<AuditEntry> lista { get; set; }
        public int totalCount { get; set; }
        public string error { get; set; }
    }

    public class AuditEntry
    {
        public Int64 id { get; set; }
        public int idUtente { get; set; }
        public string tipoOperazione { get; set; }
        public string dataRegistrazione { get; set; }
        public string codiceAssociato { get; set; }
    }

    #endregion

}
