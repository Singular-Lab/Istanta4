const convertBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(file);

        fileReader.onload = () => {
            resolve(fileReader.result);
        };

        fileReader.onerror = (error) => {
            reject(error);
        };
    });
};


function rappresenteDecimaleInCulturaItaliana(val) {
    if (val != null) {
        return val.toString().replace(".", ",");
    }
    else {
        return "";
    }
}

function rappresenteDecimaleInCulturaInglese(val) {
    if (val != null) {
        return val.toString().replace(",", ".");
    }
    else {
        return "";
    }
}

function rappresenteNumeroADueCifreAncheSeMinoreDi10(val) {
    if (val <10) {
        return "0" + val.toString();
    }
    else {
        return val;
    }
}

function checkRedirect() {
    var str = document.location.toString();
    console.log("checkRedirect -> " + str.lastIndexOf);
    if (str.substring(str.lastIndexOf("/") + 1).toLowerCase() == "agenzia") {
        document.location = "http://produzione/agenzia/";
    }
}

function statoToString(stato) {
    switch (stato) {
        case SyncFileStato.New:
            return "Nuovo";
        case SyncFileStato.Changed:
            return "Modificato";
        case SyncFileStato.AlreadyExists:
            return "Esistente";
        case SyncFileStato.AlreadyExistsButNotSelected:
            return "Esistente non selezionato";
        case SyncFileStato.NoMatch:
            return "Nessuna corrispondenza";
        case SyncFileStato.NotInTracciato:
            return "Non presente nel tracciato";
        case SyncFileStato.Synced:
            return "Sincronizzato";
        default:
            return "Sconosciuto";
    }
}

function apriLinkEsterno(dest) {

    Call.do("FicoProcess", "getAuthUrlAD/" + dest, "GET", null, null, function (result, sender) {


        if (result.esito) {
            //Crea link e aprilo in _blank
            let url = result.url;
            let a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.click();

        }

        hideLoading();
    });
}

//Chiavi di addestramento regole

const keyArea = "Area";
const keyAreaCodice = "Area.Codice";
const keyCanaleCodice = "Area.Canale";
const keyAreaGruppoSiti = "Area.GruppoSiti";

const keyRef = "Referenza";
const keyRefCodice = "Referenza.Codice";
const keyRefEan = "Referenza.Ean";
const keyRefId = "Referenza.Id";

const keyDescr = "Descrizioni";
const keyDescr1 = "Descrizioni.Descrizione1";
const keyDescr1GruppoTracciato = "Descrizioni.Descrizione1GruppoTracciato";
const keyDescr2 = "Descrizioni.Descrizione2";
const keyDescr2GruppoTracciato = "Descrizioni.Descrizione2GruppoTracciato";
const keyDescr3 = "Descrizioni.Descrizione3";
const keyDescr3GruppoTracciato = "Descrizioni.Descrizione3GruppoTracciato";
const keyDescr4 = "Descrizioni.Descrizione4";
const keyDescr4GruppoTracciato = "Descrizioni.Descrizione4GruppoTracciato";
const keyDescrGruppo = "Descrizioni.Gruppo";
const keyDescrUm = "Descrizioni.Um";
const keyDescrUmGruppoTracciato = "Descrizioni.UmGruppoTracciato";
const keyDescrPeso = "Descrizioni.Peso";
const keyDescrPesoGruppoTracciato = "Descrizioni.PesoGruppoTracciato";

const keyScatto = "Scatto";
const keyScattoCodice = "Scatto.Codice";
const keyScattoCodiceGruppo = "Scatto.CodiceGruppo";
const keyScattoCodiceGruppoMultiplex = "Scatto.CodiceGruppoMultiplex";
const keyScattoCodiceSottogruppo= "Scatto.CodiceSottogruppo";

const keyTracciato = "Tracciato";
const keyTracciatoFirma = "Tracciato.Firma";
const keyTracciatoXlsx = "Tracciato.Xlsx";


const keyRequisitoPrezziDiversi = "PrezziDiversi";//Se true indica che i prezzi sono diversi
//Con queste combinazioni di chiave, si chiede al core di recuperare la descrizione dall'archivio per far uscire le ref indicate con questo attributo
const keyRequisitoDescrizioneSingola = "DescrizioneSingola";//Richiesta descrizione singola
const keyRequisitoDescrizioneSottogruppo = "DescrizioneSottoGruppo";//Richiesta descrizione del sottogruppo di appartenenza
const keyRequisitoDescrizioneGruppo = "DescrizioneGruppo";//Richiesta descrizione del proprio gruppo
const keyRequisitoDescrizioneGruppoMultiplex = "DescrizioneGruppoMultiplex";//Richiesta descrizione del gruppo multiplex di appartenenza
const keyCombinazioneAssegnata = "combinazioneAssegnata";


const chiaviTracciato = [keyRefCodice, keyScattoCodiceGruppo, keyScattoCodiceGruppoMultiplex, keyScattoCodiceSottogruppo, keyCombinazioneAssegnata];
const chiaviRevisionato = [
    "Approvata",
    "Area",
    "Canale",
    "CodiceGruppo",
    "DataUltimaRicezione",
    "Descrizione1",
    "Descrizione2",
    "Descrizione3",
    "Descrizione4",
    "DescrizioneIndd",
    "Extra",
    "FirmaTracciato",
    "Id",
    "IdArticolo",
    "Peso",
    "Um"
];

const chiaviImpaginato = [
    "CodiceGruppo",
    "Formato",
    "Id",
    "IdPagina",
    "IdRecord",
    "Indice",
    "IdPaginaNavigation.Formato",
    "IdPaginaNavigation.IdMastro",
];

const chiaviPromoTracciato = [
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
];

const chiaviPromo = [
    "DataRegistrazione",
    "DataScadenza",
    "GuidID",
    "Id",
    "NomePromo",
    "Stato",
    "ValiditaAl",
    "ValiditaDal",
];

const chiaviFormato = [
    "tipo",
];

const chiaviKitDeclinazioni = [
    "isFidelity",
    "isSed",
];

const SyncFotoStatus = [
    ""
];

class SyncFileStato {
    static New = 6;
    static Changed = 7;
    static AlreadyExists = 8;
    static AlreadyExistsButNotSelected = 11;
    static NoMatch = 9;
    static NotInTracciato = 10;
    static Synced = 1;

};

class TipoFoto {
    static FotoDelProdotto = 1;
    static Bollino = 2;
    static Logo = 3;
    static Extra = 4;
}
//Colori stato Sync
/*

#cad3d0 - No match(Nessuna corrispondenza trovata in archivio) STATO 9
#1cdd9c - Sincronizzato o Sincronizzabile STATO 1,5,6
#f1e67f - Non sincronizzato con warning(Ad es.Foto già esistente, stesso hash, in archivio) STATO 7 o 8
#dd5252 - Non sincronizzato / scansionato con errori STATO 2 o 4
*/
const ColorSyncStatoNoMatch = "#ef4b4b";
const ColorSyncStatoNoChanges = "#cad3d0";
const ColorSyncStatoOk = "#1cdd9c";
const ColorSyncStatoConWarning = "#f1e67f";
const ColorSyncStatoConWarning2 = "#f1c17f";
const ColorSyncStatoError = "#dd5252";
const ColorAlreayExistsButNotSelected = "linear-gradient(90deg, rgb(28, 221, 156) 0%, #212529 100%)";

let exPathCustom = $("#ExternalSourceCustom").val();
console.log("exPathCustom -> " + exPathCustom);