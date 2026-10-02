/// I20-1002: il file che tiene insieme il Plugin.
///
/// Non e' "la schermata principale": e' il punto in cui tutto si incontra. Carica ogni altro
/// modulo, definisce le globali che tutti usano senza dichiararle, ascolta gli eventi di
/// events.js e contiene le operazioni grosse - impaginazione, esportazione, sincronizzazione
/// foto.
///
/// 135 funzioni globali, 228 membri di oggetti, 85 variabili globali. Settantatre' delle
/// funzioni globali non appartengono a nessuna famiglia riconoscibile: e' il file in cui "c'e'
/// stato messo di tutto", ed e' un task a se' dividerlo.
///
/// Le globali che arrivano piu' lontano sono pathLavorazione e messaggioUtente, usate in
/// diciassette file su quaranta: sono l'interfaccia implicita del Plugin e non esistono da
/// nessun'altra parte.
///
/// La documentazione sta in sorgenti/documentazione/plugin/indexNew/.

const uxp = require('uxp');
const { storage } = require('uxp');
const fs = require('fs');
const fs2 = require('uxp').storage.localFileSystem;
const { app, Justification, FitOptions, LocationOptions, File, ColorModel, Folder, ExportFormat, ContentType, SaveOptions, CoordinateSpaces, AnchorPoint, ResizeMethods} = require('indesign');
const customAgenzia = require('./custom');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const { parse, format } = require('path');
//I20-1015: lo scaricamento delle foto, ex cmd.js. Lo usano come globale schedaFoto e
//ReperimentoFoto: sotto Node scaricamento.js non si carica, e schedaRef deve continuare a farlo.
const scaricamentoFoto = require('./reperimentoFoto/scaricamento');
const InddEvents = require('./events');
const garbageCollector = require('./garbageCollector');
const InputEditController = require('./InputEditController');
const cambiStrutturaliJs = require('./cambiStrutturali');
const {Utility, FotoPlacer} = require('./utility');
//I20-1012: usciti da utility.js. Li usano come globali quasi tutti i file del Plugin, e
//index.html dai suoi pulsanti.
const Modali = require('./modali/modali');
const Tooltip = require('./tooltip/tooltip');
const Menu = require('./menu');
const TestoTag = require('./testoTag');
const jsIndexControls = require('./jsIndexControls');
const schedaRef = require('./schedaRef');
//I20-1015: procurarsi la foto giusta. schedaRef, index.html, confronti e il report lo usano da qui.
const ReperimentoFoto = require('./reperimentoFoto/reperimentoFoto');
const schedaArtwork = require('./schedaArtwork');
const manifesto = require("./manifest.json");
const ipconfig = require("./ipconfig.json");
const confronti = require('./confronti');
//I20-1014: il Report Integrita' ha una cartella sua. events.js e index.html lo usano da qui.
const ReportIntegrita = require('./reportIntegrita/reportIntegrita');
const NoRenderElementi = require('./noRenderElementi');
const RicollegaEsiti = require('./ricollegaEsiti');
const VersionePlugin = require('./versionePlugin');
const AltezzaScorrimento = require('./altezzaScorrimento');
//I20-1029: le segnalazioni di impaginazione nel bollino del box, tutte, non solo la piu' grave.
const Segnalazioni = require('./segnalazioni/segnalazioni');
const etichettaSegnalazioni = require('./segnalazioni/etichetta');
const SchermataSegnalazioni = require('./segnalazioni/schermata');
//I20-1035: i conti della barra orizzontale della lista dei tracciati, gli stessi del Report Integrita'.
const barraScorrimento = require('./reportIntegrita/barraScorrimento');
const ficoProcess = require('./ficoProcess');
const grigliaJs = require('./griglia');
const filtriJs = require('./filtri');
const CssFramework = require('./CssFramework');
//I20-1009: la sistemazione delle foto nel box ha un modulo suo. Anche schedaRef la usa da qui.
const SistemazioneFoto = require('./sistemazioneFoto/sistemazioneFoto');
const pluginMiddleware = require('./pluginMiddleware');
const credenzialiSalvateModulo = require('./credenzialiSalvate');

//I20-956: le credenziali ricordate vivono nell'archivio cifrato del sistema operativo.
//Se questa versione di UXP non lo espone, l'oggetto resta senza archivio e il Plugin
//continua a chiedere le credenziali a mano, senza mai scriverle su disco in chiaro.
const credenzialiSalvate = credenzialiSalvateModulo.crea((function () {
    try {
        return require('uxp').storage.secureStorage;
    }
    catch (e) {
        console.log('Archivio sicuro non disponibile: le credenziali non verranno ricordate');
        return null;
    }
})());

Menu.registerDateMenuPicker();
//I20-981: da qui in poi ogni elemento con un title mostra il suo suggerimento.
//In UXP l'attributo da solo non fa nulla: il riquadro lo disegna il plugin.
Tooltip.abilitaTooltipGlobali();
showLoading("Inizializzazione...");


/// Una sola richiesta al server in volo alla volta: chi ne avvia una nuova ferma la precedente.
/// E' la variabile che spiega i sei abort() sparsi per il Plugin. Ognuno dice il suo motivo,
/// e l'operatore lo legge nel messaggio HRC-02 (I20-1004).
let xhrInProcess=null;//Processo XHR uncio per tutte le operazioni che devono per forza di cosa essere sequenziali
let docInLavorazione=null;
let libroInLavorazione=null;
let jobImpaginazioneLibro={queue:[], index:-1, stato:0}
let contenutoKitInLavorazione=null;
var pagSelected = -1;
//let refSelected=null;
var offlineMode = true;
//let editRefFieldController=null;

let userLoggedDetails=null;

var listaTracciatiScaricata = false;
var tracciatoOnlineScaricato = false;
var pathLavorazione = "";
var pluginPath = "";
var intervalSpeed=100;
/// ATTENZIONE: qui pathLavorazione e' ancora la stringa vuota, quindi si legge /dbMastro.json
/// alla radice, che non esiste. Vale null finche' qualcuno non la riassegna.
var dbMastro = readFile(pathLavorazione + "/dbMastro.json");
let useCompiledField = true;
/// I quattro percorsi di lavoro, ognuno col suo gemello defaultPercorso*: i primi si possono
/// cambiare, i secondi dicono da cosa si riparte.
let percorsoLinks = "/Links/";
let percorsoLoghi = "/Links/Loghi/";
let percorsoLogs = "/Logs/";
let percorsoEsportazione = "/Export/";
let defaultPercorsoLinks = "/Links/";
let defaultPercorsoLoghi = "/Links/Loghi/";
let defaultPercorsoLogs = "/Logs/";
let defaultPercorsoEsportazione = "/Export/";



// ======= Enum ruolo utente =======
const RuoloUtente = {
    nonTrovato: 0,
    superAdmin: 1,
    agenzia: 2,
    GDO : 4,
    PuntoVendita : 5
};

const IstantaState = {
    None:0,
    Logged:1,
    NotLogged:2,
    IstantaDown:3
}

let istantaState=IstantaState.None;
let isOnline = false;

var ruoloUtenteLoggato = RuoloUtente.nonTrovato;
var nomeUtente = "";
var idUtente = 0;
var datiRefInEsame = [];
var cacheLoghi = {};
let idKitLavorazione=0;
let segnalazioniBoxImpaginato = [];

/// Il pezzo di HTML di un bottone dei filtri: icona a sinistra, etichetta a destra.
/// Non tocca la pagina, restituisce soltanto la stringa.
///
/// DA SPOSTARE (task di divisione): sta in filtri.js. E' l'unica riga di indexNew che
/// parla dell'aspetto dei filtri, e qui non la trova nessuno.
function getFiltroButtonMarkup(iconName, label) {
    return '<span style="display:flex;align-items:center;gap:6px;">'
        + '<img src="images/' + iconName + '" style="width:16px;height:16px;object-fit:contain;">'
        + '<span>' + label + '</span>'
        + '</span>';
}

//VARIABILI GLOBALI
const testMode = ipconfig.testMode;//false;//true;
const noCache = true;
// IP
const olimpoIp = testMode?ipconfig.olimpoIpTestMode:ipconfig.olimpoIp;
const istantaIp = testMode?ipconfig.istantaIpTestMode:ipconfig.istantaIp;//"istanta.istantademo.it/pac/"//"192.168.178.172/doc/";

ficoProcess.successScaricamentoFicoDataCallback=function (){

    initDocumentInLavorazione();
    if (docInLavorazione==null)
        initLibroInLavorazione();
};

//setMenaboInterface(0);

setVersionePlugin();
/// Scrive la versione in fondo al pannello, leggendola da manifest.json.
///
/// Il suffisso "(testmode)" non e' un dettaglio estetico: e' l'unico segno visibile che
/// quella copia del Plugin sta parlando con la macchina di sviluppo invece che col server
/// del cliente. Chi non lo nota lavora per ore contro i dati sbagliati.
///
/// Si chiama da sola, alla riga sopra la propria definizione.
///
/// DA SPOSTARE (task di divisione): con controllaVersionePubblicata e
/// bloccaPerVersioneDisallineata in versionePlugin.js, che gia' esiste e tiene il
/// confronto fra versioni. Qui restano tre funzioni di un concetto che ha gia' casa.
function setVersionePlugin() {
    //leggiamo la versione da manifest.json version
    var versione = manifesto.version;
    $("#versionePlugin").text("Istanta v. " + versione + (testMode ? " - (testmode)" : ""));
}

/// I20-987: il Plugin installato deve essere quello pubblicato per il cliente.
///
/// Lavorare con una versione diversa da quella del server vuol dire lavorare con regole diverse,
/// e i guai che ne nascono si scoprono a impaginato fatto. Se la versione pubblicata non si
/// riesce a leggere non si blocca niente: questo controllo gira a ogni avvio, e fermare il
/// lavoro per un server che non risponde sarebbe un danno peggiore di quello che si previene.
function controllaVersionePubblicata() {
    try {
        var xhr = new XMLHttpRequestClient();

        xhr.onload = function (objResult, parsed) {
            try {
                if (!parsed) {
                    objResult = JSON.parse(objResult);
                }

                var pubblicata = objResult != null && objResult.boolEsito ? objResult.esito : "";
                var esito = VersionePlugin.confronta(manifesto.version, pubblicata);

                if (VersionePlugin.siPuoLavorare(esito)) {
                    if (esito === VersionePlugin.ESITO.nonVerificabile) {
                        console.log("Code IDX-165 Versione pubblicata non verificabile: " +
                            (objResult != null && objResult.error != null ? objResult.error : ""));
                    }
                    return;
                }

                bloccaPerVersioneDisallineata(VersionePlugin.messaggioDisallineamento(manifesto.version, pubblicata));
            }
            catch (e) {
                //Un controllo che non riesce non deve fermare chi lavora: si annota e si va avanti.
                console.error("Code IDX-165 Controllo della versione non riuscito: " + e);
            }
        };

        xhr.onerror = function () {
            console.log("Code IDX-165 Versione pubblicata non verificabile: errore di rete");
        };

        xhr.send("LoginController/getVersionePluginPubblicata", null, "GET", "application/x-www-form-urlencoded");
    }
    catch (e) {
        console.error("Code IDX-165 Controllo della versione non avviato: " + e);
    }
}

/// Copre il pannello con l'avviso a tutta pagina e non lo toglie piu': quando la versione
/// installata non e' quella pubblicata, l'unica via d'uscita e' aggiornare il Plugin.
///
/// Riusa #istantaDownAlert, lo stesso riquadro del server irraggiungibile: sono due guasti
/// diversi ma la risposta dell'operatore e' la stessa, fermarsi.
///
/// DA SPOSTARE (task di divisione): in versionePlugin.js, vedi setVersionePlugin.
function bloccaPerVersioneDisallineata(avviso) {
    console.error("Code IDX-166 " + avviso.titolo + " - " + avviso.dettaglio);

    $("#istantaDownAlert").find("h1").text(avviso.titolo);
    $("#istantaDownAlert").find("h3").text(avviso.dettaglio);
    $("#istantaDownAlert").css("display", "flex");
}

/// Mette in Links/Loghi le due immagini che il Plugin usa quando una foto manca -
/// nofoto.png e fotoNoFound.png - copiandole da images/ se non ci sono gia'.
///
/// Sono segnaposto, non loghi: finiscono li' perche' quella e' la cartella che InDesign
/// ha gia' collegata, cosi' il riquadro mostra qualcosa invece di restare vuoto.
///
/// I due blocchi sono identici, uno per file: il try esterno e' il modo storto di chiedere
/// "il file c'e'?", perche' la lettura fallisce se manca.
///
/// DA SPOSTARE (task di divisione): nel js delle foto, insieme a chi quelle immagini le
/// usa. Qui non c'entra con niente di quello che la circonda.
function checkForLoghiCore(){
    //cerchiamo nella cartella pathLavorazioni + "Links/Loghi" se esitono le foto nofoto e fotonofound
    //se non esistono li copiamo dalla cartella images e li inseriamo nella cartella Links/Loghi
    
    console.log("Entro in checkForLoghiCore");
    try{
        var fileBuffer = fs.readFileSync(/*pathLavorazione+*/percorsoLoghi+"nofoto.png"); 
    }
    catch(e){
        //se siamo qui non esiste il file nofoto
        try{
            var fileBuffer = fs.readFileSync(pluginPath+"/images/nofoto.png");
            fs.writeFileSync(/*pathLavorazione+*/percorsoLoghi+"nofoto.png", fileBuffer);
        }
        catch(e2){
            console.error("Errore durante la copia del file nofoto da images a "+ percorsoLoghi);
            console.log(e2);
        }
    }


    try{
        var fileBuffer = fs.readFileSync(/*pathLavorazione+*/percorsoLoghi+"fotoNoFound.png");
    }
    catch(e){
        //se siamo qui non esiste il file nofoto
        try{
            var fileBuffer = fs.readFileSync(pluginPath+"/images/fotoNoFound.png");
            fs.writeFileSync(/*pathLavorazione+*/percorsoLoghi+"fotoNoFound.png", fileBuffer);
        }
        catch(e2){
            console.error("Errore durante la copia del file fotoNoFound da images a "+ percorsoLoghi);
            console.log(e2);
        }
    } 
}

// #region EVENTS

let indesignEvents = new InddEvents();
const gC = new garbageCollector();
//I20-968: rende invisibili gli elementi del box che l'operatore ha messo in noRender.
//L'elenco arriva dal record consegnato da Istanta, letto dai meta della lavorazione.
/// I20-968: rende invisibili gli elementi del box che l'operatore ha messo in noRender.
/// L'elenco arriva dal record consegnato da Istanta, letto dai meta della lavorazione.
///
/// Gira in coda alla composizione del box, quando tutto e' gia' al suo posto: e' una
/// sottrazione finale, non una regola di impaginazione.
///
/// Il conteggio finale distingue due guasti che altrimenti si confonderebbero: se i marcati
/// sono piu' di quelli spenti, l'elenco arriva ma le label del box non corrispondono alle
/// chiavi salvate.
function applicaNoRenderAgliElementiDelBox(box, elementiNoRender) {
    if (box == null || elementiNoRender == null || elementiNoRender.length == 0) {
        return;
    }

    var resiInvisibili = 0;

    var nomePrimaria = pluginMiddleware.getCampo("nomeFotoPrimaria");
    var nomeSecondaria = pluginMiddleware.getCampo("nomeFotoSecondaria");

    try {
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            var classificato = NoRenderElementi.classificaLabel(item.label, nomePrimaria, nomeSecondaria);
            //Le foto non fanno piu' eccezione: stanno nella stessa struttura degli altri
            //elementi, e questa e' l'unica applicazione, in coda alla composizione del box.
            if (classificato == null) {
                continue;
            }
            if (NoRenderElementi.inNoRender(elementiNoRender, classificato.tipo, classificato.chiave)) {
                FotoPlacer.applicaNoRender(item, true);
                resiInvisibili++;
            }
        }

        //Se i marcati sono piu' di quelli resi invisibili, l'elenco arriva ma le label del
        //box non corrispondono alle chiavi salvate: sono due guasti diversi e vanno distinti.
        console.log("noRender: " + resiInvisibili + " elementi resi invisibili su " + elementiNoRender.length + " marcati");
    }
    catch (e) {
        console.error("Impossibile applicare il noRender agli elementi del box", e);
    }
}
/// Consegna un elemento al garbage collector perche' lo rimuova piu' tardi.
/// Con una chiave, la rimozione avviene solo quando quella chiave viene attivata.
///
/// Una riga sola che inoltra a gC. Le tre funzioni qui sotto sono uguali: esistono perche'
/// nel resto del file gC non e' mai nominato direttamente.
function addToGarbageCollector(element, keyToDelete = null) {
    gC.Add(element, keyToDelete);
}

/// Chiede al garbage collector una chiave nuova, da dare poi agli elementi da rimuovere
/// insieme. Inoltra a gC e basta.
function requireKeyForGarbage(){
    return gC.generateKey();
}

/// Attiva una chiave: da questo momento il garbage collector puo' rimuovere tutti gli
/// elementi che erano stati messi in attesa con quella chiave. Inoltra a gC e basta.
function activateKeyForGarbage(key){
    return gC.activateKey(key);
}
//indesignEvents.test();

//console.log(indesignEvents);
indesignEvents.addEventListener(indesignEvents.EVENT_NEW_DOCUMENT_SELECTED, async function(args){

    console.log("EVENT_NEW_DOCUMENT_SELECTED");
    console.log(args);
    schedaRef.svuotaRef();
    app.selection = null;
    
    //Annullo qualsiasi operazione in corso per potermi focalizzarfe sulla nuova selezione di documento
    if (xhrInProcess!=null)
        xhrInProcess.abort("Cambio documento attivo");
    
    docInLavorazione = args[0];
    
    clearNarrow();
    //if(sourceAree==null || sourceAree.length==null || sourceAree.length<=0)
    //{ 
        //scaricaFicoData(true);
        ficoProcess.scaricaFicoData(true);
    //}

    $("#nomeKitInLavorazione").text("");

    await initDocumentInLavorazione();
    if (docInLavorazione==null)
        await initLibroInLavorazione();

});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_LIBRO_OPENED, async function(args){

    await initLibroInLavorazione();

});

indesignEvents.addEventListener(indesignEvents.EVENT_NO_DOCUMENT_OPENED, async function(args){

    console.log("EVENT_NO_DOCUMENT_OPENED");
    if (app.books.count() > 0)
    {
        console.log("C'è un libro aperto, procedo con l'inizializzazione del libro");
        await initLibroInLavorazione();
    }
    else
    {
        console.log(args);

        setNarrow("Nessun documento aperto");

        //Annullo qualsiasi operazione in corso per potermi focalizzarfe sulla nuova selezione di documento
        if (xhrInProcess!=null)
            xhrInProcess.abort("Nessun documento aperto");

        docInLavorazione = null;

        $("#nomeKitInLavorazione").text("");
        $("#dialogSelectKit").css("display","none");        
        $("#wrapper").css("display","block");
    }
});


indesignEvents.addEventListener(indesignEvents.EVENT_NEW_PAGE_SELECTED, function(args){

    console.log("new page selected");

    console.log(args);
    pagSelected = parseInt(args[0]);
    $("#svuotaPagina").attr("pag", args[0]);

    clearNarrow();

});

indesignEvents.addEventListener(indesignEvents.EVENT_OFFLINE, function(args){
    //console.log("offline");

    isOnline=false;
    cambioDiStatoDelSistema();

    // offlineMode = true;
    // $("#modalita").text("Offline");
    // $("#modalita").show();
    // $("#footer").css("background-color", "red");
    // $("#tornaOnlineButton").hide();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_ONLINE, function(args){

    //console.log("online");

    isOnline=true;
    cambioDiStatoDelSistema();


    clearNarrow();

});

indesignEvents.addEventListener(indesignEvents.EVENT_USER_LOGGED, function(args){

    istantaState=IstantaState.Logged;
    userLoggedDetails=args[0];

    ruoloUtenteLoggato = userLoggedDetails.ruoloUtente;
    nomeUtente = userLoggedDetails.nomeUtente;
    idUtente = userLoggedDetails.idUtente;

    console.log([ruoloUtenteLoggato, nomeUtente, idUtente]);
    hideLoading();
    setFinestrePerRuolo();

    cambioDiStatoDelSistema();

    //I20-987: appena si e' loggati si guarda se il Plugin installato e' quello pubblicato per
    //il cliente. Prima del login non si puo': serve il server, ed e' il login a dirci che
    //risponde.
    controllaVersionePubblicata();


    $("#nomeUtente").text(nomeUtente);
    // $("#messaggioUtenteLoginComposto").remove();
    // var benvenuto = $('<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,1); z-index: 2000; display: flex; justify-content: center; align-items: center; color:white;"><h1>Benvenuto ' + nomeUtente + '</h1></div>');
    // $("body").append(benvenuto);
    


    $("#nomeUtente").text(nomeUtente.length > 30 ? nomeUtente.substring(0, 30) + "..." : nomeUtente);
    $("#loginPanel").hide();
    $("#username").val("");
    $("#password").val("");


    clearNarrow();


    // setTimeout(function () {
    //     benvenuto.fadeOut(1000, function () {
    //         benvenuto.remove();

    //         console.log("MOSTRO INTERFACCIA BENVENUTO FINE!");
        
            
    //         setFinestrePerRuolo();
    //     });
    // }, 500);

    // if (sourceAree == null || sourceAree.length == null || sourceAree.length <= 0)
    //     scaricaFicoData();

    ficoProcess.scaricaFicoData(true);

});

indesignEvents.addEventListener(indesignEvents.EVENT_USER_NOT_LOGGED, function(args){

    $("#nomeUtente").text("NO LOGIN");
    // if(sourceAree==null || sourceAree.length==null || sourceAree.length<=0)
    //     scaricaFicoData();
    ficoProcess.scaricaFicoData(false);

    //console.log("no login");
    istantaState = IstantaState.NotLogged;
    userLoggedDetails=null;

    cambioDiStatoDelSistema();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_ISTANTA_DOWN, function(args){
    istantaState = IstantaState.IstantaDown;
    cambioDiStatoDelSistema();
    
    clearNarrow();

});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_REF_SELECTED, async function(args){

    console.log("EVENT_NEW_REF_SELECTED");
    console.log(args);
    
    Modali.closeAllModal();
    clearNarrow();
    $("#grigliaTab").hide();

    if (args.length == 1 && userLoggedDetails!=null && istantaState!=IstantaState.IstantaDown) {
        //schedaRef.svuotaRef();
        
        //refSelected=args[0];

        showLoading("Caricamento scheda REF");
        $("#refImage").show();
        schedaRef.initSchedaRef(args[0]);

    }

});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_MULTIREF_SELECTED, async function(args){    
    Modali.closeAllModal();

    console.log(args);
    schedaRef.svuotaRef();
    //schedaRef.resetRefInterface();
    schedaRef.setInvalidated(false);
    schedaRef.initMultiSchedaRef(args);
    $("#grigliaTab").hide();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED, async function(args){    
    console.log(args);
    schedaRef.svuotaRef();
    schedaRef.resetRefInterface();
    schedaArtwork.showSchermataArtworkMultiRef(args[0], args[1]);
    $("#grigliaTab").hide();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_ARTWORK_SELECTED, async function(args){    
    console.log(args);
    schedaRef.setInvalidated(true);
    schedaRef.svuotaRef();
    schedaRef.resetRefInterface();
    //setMenaboInterface(0);
    schedaArtwork.showSchermataArtworkEsistente(args[0]);
    $("#refImage").hide();
    $("#raggruppaImage").hide();
    $("#grigliaTab").hide();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_GRIGLIA_SELECTED, async function(args){    
    Modali.closeAllModal();

    console.log(args);
    schedaRef.svuotaRef();
    schedaRef.resetRefInterface();
    $("#refImage").hide();
    $("#raggruppaImage").hide();

    $("#grigliaTab").show();
    onresizeWindow();
    var pagArgs = args[0].parentPage.name;
    //setMenaboInterface(1);
    grigliaJs.mostraElementiAvanzati(pagArgs);
    grigliaJs.compilaGriglia(args[0]);
    //assegnamo al pulsante #ricalcaGriglia un riferimento all'oggetto args[0]
    $("#TabGriglia").data("griglia", args[0]);
    $("#sliderTrasparenzaGriglia").val(args[0].transparencySettings.blendingSettings.opacity);
    jsIndexControls.changeSubMenu($("#grigliaTab").attr("subTab"));
    jsIndexControls.changeImage($("#grigliaTab"));
    //scriviamo i data del pulsante

    clearNarrow();

});

indesignEvents.addEventListener(indesignEvents.EVENT_NO_REF_SELECTED, async function(args){    
    Modali.closeAllModal();

    schedaRef.setInvalidated(true);
    schedaRef.svuotaRef();
    schedaRef.resetRefInterface();
    //setMenaboInterface(0);
    //Torna al tab home
    $("#refImage").hide();
    $("#raggruppaImage").hide();
    $("#grigliaTab").hide();

    if (jsIndexControls.findOpenedTab() != "menaboTab") {
        jsIndexControls.changeSubMenu($("#homeImage").attr("subTab"));
        jsIndexControls.changeImage($("#homeImage"));
    }
    else{
        jsIndexControls.changeSubMenu($("#menaboTab").attr("subTab"));
        jsIndexControls.changeImage($("#menaboTab"));
    }
    onresizeWindow();

    //$("#homeImage").click();
    //$(".subTab1").hide();

    clearNarrow();
});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_SELECTION_INVALID_POTENTIAL, async function(args){    
    schedaRef.resetRefInterface(true);
    $("#grigliaTab").hide();

    setNarrow("Selezionato un elemento sconosciuto");

});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_REF_FIELD_SELECTED, async function(args){    
    schedaRef.resetRefInterface(true);
    $("#grigliaTab").hide();


    if ((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? args[0].label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria")) : args[0].label.toLowerCase().startsWith("immagine")) ||
        (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? args[0].label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria")) : args[0].label.toLowerCase().startsWith("foto_secondaria"))) {
        var buttons = [{
            buttonText: "Seleziona tutte le foto",
            buttonCallback: function () {
                // risaliamo di parent fino a trovare la spread
                let currentElement = args[0];
                while (currentElement.parent != null && currentElement.parent.constructorName != "Spread") {
                    currentElement = currentElement.parent;
                }

                //abbiamo trovato il box, cerchiamo tutti i box che iniziano con "immagine" o "foto_secondaria"
                let allImageBoxes = currentElement.allPageItems.filter(item => item.label != null && ((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria")) : item.label.toLowerCase().startsWith("immagine")) ||
                    (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria")) : item.label.toLowerCase().startsWith("foto_secondaria"))));
                if (allImageBoxes.length > 0) {
                    app.selection = allImageBoxes;
                }
                else {
                    console.error("Non sono riuscito a trovare immagini nel box");
                }
            }
        },
        {
            buttonText: "Fix foto",
            buttonCallback: function () {
                // risaliamo di parent fino a trovare la spread
                let currentElement = args[0];
                while (currentElement.parent != null && currentElement.parent.constructorName != "Spread") {
                    currentElement = currentElement.parent;
                }

                var obs =SistemazioneFoto.getSpazioImpaginazione(currentElement);
                SistemazioneFoto.fixFoto(currentElement, obs.candidate, obs.obstacles);
            }
        }];

        setNarrow("Selezionato il campo " + Utility.parseLabel(args[0].label), buttons);
    }
    else {
        setNarrow("Selezionato il campo " + Utility.parseLabel(args[0].label))  ;
    }

});

indesignEvents.addEventListener(indesignEvents.EVENT_NEW_MULTISELECTION, async function(args){    
    schedaRef.resetRefInterface(true);
    $("#grigliaTab").hide();

    setNarrow("Multiselezione sconosciuta");

});




/// Toglie il messaggio a tutta larghezza e rimette in vista il pannello.
///
/// Se non c'e' un documento in lavorazione non fa niente: senza documento il messaggio
/// e' l'unica cosa che ha senso mostrare, e toglierlo lascerebbe una schermata vuota.
function clearNarrow()
{
    if (docInLavorazione == null){
        return;
    }
    $("#narrow").css("display","none");
    $("#narrow_talker").text("");
    $("#mainContent").show();
}

/// Mostra al posto del pannello una riga di testo a tutta larghezza - "Nessun documento
/// aperto", "Selezionato il campo X" - con eventuali pulsanti sotto.
///
/// E' il modo in cui il Plugin dice perche' non si puo' lavorare. I pulsanti servono a dare
/// una via d'uscita dentro al messaggio stesso: senza, l'operatore puo' solo chiudere e
/// riaprire il pannello.
///
/// Con hideMainContent a false il messaggio convive col pannello invece di sostituirlo.
function setNarrow(msg, buttons = [], hideMainContent = true)
{
    $("#narrow").css("display","block");
    $("#narrow_talker").text(msg);
    if (hideMainContent) {
        $("#mainContent").hide();
    } else {
        $("#mainContent").show();
    }
    // Rimuoviamo eventuali pulsanti esistenti
    $("#narrow_buttons").empty();

    // Creiamo i pulsanti se forniti
    if (Array.isArray(buttons) && buttons.length > 0) {
        buttons.forEach(button => {
            if (button.buttonText && typeof button.buttonCallback === "function") {
                const btn = $("<button></button>")
                    .text(button.buttonText)
                    .on("click", button.buttonCallback)
                    .css({ margin: "5px" });
                $("#narrow_buttons").append(btn);
            }
        });
        $("#narrow_buttons").show();
    } else {
        $("#narrow_buttons").hide();
    }
}

/// Inoltra a schedaRef.selectSchedaRef. Esiste perche' la chiama index.html da un onclick,
/// e li' dentro si vedono solo le funzioni globali.
function selectSchedaRef(enumSchedaRef){
    schedaRef.selectSchedaRef(enumSchedaRef);
}

/// Inoltra a schedaRef.SchermataRaggruppamento. Chiamata da un onclick di index.html.
///
/// Il parametro enumSchedaRef lo riceve e non lo passa: la funzione chiamata non ne vuole.
/// E' un residuo, non un dimenticato - togliendolo non cambia niente.
function raggruppa(enumSchedaRef){
    schedaRef.SchermataRaggruppamento();
}

/// Inoltra a schedaArtwork.raggruppaSottoArtwork. Chiamata da un onclick di index.html.
function raggruppaSottoArtwork(){
    schedaArtwork.raggruppaSottoArtwork();
}

/// Inoltra a schedaArtwork.eliminaArtwork. Chiamata da un onclick di index.html.
function eliminaArtwork(){
    schedaArtwork.eliminaArtwork();
}

// function setMenaboInterface(mode){
//     //if(mode == 0){
//         if(modalitaFiltriAvanzati){
//             $("#menuFiltri").show();
//             $("#menuImpaginazione").hide();
//         }
//         else{
//             $("#menuImpaginazione").show();
//             $("#menuFiltri").hide();
//         }
//         // $("#menuGriglia").hide();
//         // $("#menuRefAvanzate").hide();
//         $("#menuMenaboExtra").show();
//     // }
//     // else{
//     //     if(modalitaFiltriAvanzati){
//     //         $("#menuImpaginazione").hide();
//     //     }
//     //     else{
//     //         $("#menuImpaginazione").hide();
//     //         $("#menuFiltri").hide();
//     //     }
//     //     $("#menuGriglia").show();
//     //     $("#menuRefAvanzate").show();
//     //     $("#menuMenaboExtra").hide();
//     // }
// }

/// Il Plugin ha due interruttori indipendenti - c'e' internet (isOnline) e Istanta risponde
/// (istantaState) - e questa funzione traduce la loro combinazione in cosa si vede.
///
/// Il colore della barra in basso e' il riassunto: verde si lavora, arancione Istanta e'
/// giu', rosso non c'e' rete.
///
/// Il caso interessante e' Istanta giu' CON una lavorazione gia' aperta: li' non si mostra
/// il login, si tira dritto. Il tracciato e' gia' in locale, e fermare chi sta impaginando
/// perche' il server ha un problema sarebbe un danno inutile.
///
/// Quando invece si e' collegati e tutto risponde, prima di aprire il documento carica i
/// due bolli di ripiego (nofoto, fotoNoFound) nel pluginMiddleware: servono dopo, quando
/// una foto non si trova, e allora sarebbe tardi per andarli a chiedere.
///
/// La chiamano gli eventi di rete e di sessione: non e' una funzione che si invoca, e' la
/// risposta a un cambiamento.
async function cambioDiStatoDelSistema()
{
    $("#modalita").text(isOnline?"ONLINE":"OFFLINE");
    $("#istantaState").text(" - OK");

    console.log("Cambio di stato del sistema " + [isOnline, istantaState]);

    if (isOnline)
    {
        $("#footer").css("background-color", "#0c986b");

        if (istantaState==IstantaState.None || istantaState==IstantaState.NotLogged)
        {
            //Mostro il login
            showLogin();
            $("#statusLoginOp").text("");
            $("#login").css("display","flex");
            clearInfo();
        }
        else if (istantaState == IstantaState.Logged)
        {
            //Mostro schermata operativa
            //Che significa analizzare il documento in questione            
            //Perchè potrebbe essere che si è operativi o che ci sia da configurare il kit  
            //impostiamo il logo nofoto dell'agenzia
            ReperimentoFoto.getBolloNOFOTO(function (item) {
                console.log(item);
                if (pluginMiddleware.setBolloNOFOTO != null) {
                    pluginMiddleware.setBolloNOFOTO(item);
                }
                else {
                    console.error("nomeNoFoto assente nel pluginMiddleware");
                }
            }, function (err) {
                console.error(err);
                if (pluginMiddleware.setBolloNOFOTO != null) {
                    pluginMiddleware.setBolloNOFOTO("");
                }
                else {
                    console.error("nomeNoFoto assente nel pluginMiddleware");
                }
            })

            ReperimentoFoto.getBolloFOTONOFOUND(function (item) {
                console.log(item);
                if (pluginMiddleware.setBolloFOTONOFOUND != null) {
                    pluginMiddleware.setBolloFOTONOFOUND(item);
                }
                else {
                    console.error("fotoNoFound assente nel pluginMiddleware");
                }
            }, function (err) {
                console.error(err);
                if (pluginMiddleware.setBolloFOTONOFOUND != null) {
                    pluginMiddleware.setBolloFOTONOFOUND("");
                }
                else {
                    console.error("fotoNoFound assente nel pluginMiddleware");
                }
            })

            await initDocumentInLavorazione();       
            if (docInLavorazione==null)
                await initLibroInLavorazione();
        }
        else if (istantaState == IstantaState.IstantaDown)
        {
            $("#istantaState").text(" - DOWN");
            $("#footer").css("background-color", "#eaa527");
            
            //Se la lavorazione lo permette continuare l'operatività
            //altrimenti login
            if (idKitLavorazione==0)
            {
                showLogin();

                $("#statusLoginOp").text("Istanta non disponibile");
                $("#login").css("display","none");
            }
            else
            {
               //Si procede regolarmente 
               //Devo recuperare il titolo della lavorazione per metterlo in alto

            }
        }
    }
    else
    {
        //Sono offline per cui a prescindere dallo stato di Istatnta, sono operativo ma OFFLINE 
        //SOLO se il documento corrente non ha bisogno di essere associato a Kit
        //In tal caso schermata di blocco
        $("#footer").css("background-color", "#d84e4e");
    }
}


// #region INIT FUNCTION

//I20-936: rilegge la cartella del documento senza chiudere il pannello.
//Il lucchetto va tolto per primo: l'ha alzato il blocco che ha mostrato il messaggio e nessun
//altro lo abbasserebbe, quindi restando su terrebbe il plugin fermo anche a lavorazione trovata.
//Se la lavorazione manca ancora, initDocumentInLavorazione rimette il messaggio col suo pulsante.
var riletturaDocumentoInCorso = false;
/// I20-936: rilegge la cartella del documento senza chiudere il pannello.
///
/// Il lucchetto (policyIsLocked) va tolto per primo: l'ha alzato il blocco che ha mostrato
/// il messaggio e nessun altro lo abbasserebbe, quindi restando su terrebbe il Plugin fermo
/// anche a lavorazione trovata. Se la lavorazione manca ancora,
/// initDocumentInLavorazione rimette il messaggio col suo pulsante.
///
/// riletturaDocumentoInCorso impedisce che due clic di seguito avviino due riletture: il
/// finally la riabbassa sempre, anche se l'inizializzazione ha lanciato.
async function rileggiDocumentoInLavorazione()
{
    if (riletturaDocumentoInCorso)
    {
        return;
    }
    riletturaDocumentoInCorso = true;

    try
    {
        indesignEvents.policyIsLocked = false;
        clearNarrow();
        await initDocumentInLavorazione();
    }
    finally
    {
        riletturaDocumentoInCorso = false;
    }
}

/// Da un documento InDesign aperto ricava tutto il resto: la cartella di lavoro, il kit
/// associato, il tracciato, i percorsi di sistema, l'interfaccia giusta.
///
/// E' il passaggio da "c'e' un file aperto" a "si puo' lavorare", e finisce in uno di tre
/// posti: il pannello operativo, la scelta del kit, o un messaggio che spiega cosa manca.
///
/// Due cose non ovvie:
///
/// - il tipo di lavorazione 2 cambia il bottone principale da Conteggio a Impagina e
///   nasconde mezzo menu. Non e' una preferenza: quella lavorazione non ha referenze da
///   aggiungere, quindi quei comandi non avrebbero su cosa agire.
/// - chi non e' superAdmin e trova un documento senza lavorazione non viene mandato alla
///   scelta del kit: viene bloccato con un messaggio e un pulsante per rileggere. La
///   lavorazione gliela deve creare un amministratore.
///
/// - con la lavorazione trovata si aspetta che ci siano i quattro percorsi di sistema:
///   checkPercorsi apre la finestra che li chiede, e la si ricontrolla ogni secondo finche'
///   l'operatore non li ha indicati tutti. L'attesa si interrompe se nel frattempo cambia
///   il documento: checkPercorsi legge le globali, quindi continuerebbe a controllare il
///   documento nuovo, per il quale e' gia' partita un'altra inizializzazione.
///
/// I20-1016: la riga era "while (await !checkPercorsi())", cioe' await applicato alla
/// NEGAZIONE della promise, che vale sempre false: il ciclo non girava mai e si tirava
/// dritto senza percorsi. Lo stesso errore resta in initLibroInLavorazione, lasciato cosi'
/// di proposito.
async function initDocumentInLavorazione()
{
    if (docInLavorazione == null)
    {
        return null;
    }

    var f = await docInLavorazione.filePath;
    console.log(f.nativePath);
    
    console.log("Set di un nuovo path di lavorazione");
    console.log(path);

    pathLavorazione = f.nativePath;

    var pluginPathTmp = await fs2.getPluginFolder();
    pluginPath = pluginPathTmp.nativePath;




    
    //Azione in base allo stato
    
    if (isOnline && istantaState==IstantaState.NotLogged)
    {
        //Non faccio niente, aspetto che l'utente si logghi        
    }
    else
    {
        //In ogni altro caso posso procedere all'analisi del documento e kit associato
        var res = ficoProcess.checklavorazioneSelezionata();
        let tipo_lavorazione_corrente = ficoProcess.getTipoLavorazioneCorrente();
        if (idKitLavorazione>0 && res)
        {

            customAgenzia.setLavorazione();
            if(tipo_lavorazione_corrente==2)
            {
                $("#aggiungiReferenzaMenuImg").hide();
                // $("#syncRimaste").hide();
                // $("#svuotaCodaSync").hide();
                $("#bOpt2Advanced").hide();
                $("#bOpt1Advanced").html(getFiltroButtonMarkup('impagina.png', 'Impagina'));
                $("#opzioniAddizionali").hide();
                $("#svuotaPagina").hide();
            }
            else{
                $("#aggiungiReferenzaMenuImg").show();
                // $("#syncRimaste").show();
                // $("#svuotaCodaSync").show();
                $("#bOpt2Advanced").show();
                $("#opzioniAddizionali").show();
                $("#svuotaPagina").show();
                $("#bOpt1Advanced").html(getFiltroButtonMarkup('conteggio.png', 'Conteggio'));
            }
            $("#dialogSelectKit").css("display","none");
            $("#wrapper").css("display","block");
            $("#loginPanel").css("display","none");



            //Iniziamo intanto con il leggere il tracciato che è in locale. Nel caso è l'utente che lo aggiorna se DEVE
            leggiContenutoKit(idKitLavorazione);
            if (isOnline && istantaState!=IstantaState.IstantaDown)
            {
                //scaricaContenutoKit(idKitLavorazione);                
            }
            else
            {
                //Provo a leggerlo in locale
                //leggiContenutoKit(idKitLavorazione);
                if (contenutoKitInLavorazione==null)
                {
                    //Purtroppo non ho il tracciato della lavorazione in locale per cui devo per froza necessitare della connessione per riscaricare
                    if (!isOnline)
                    {
                        //Non posso scaricafre perchp non c'è internet
                        $("#istantaDownAlert").find("h1").text("Connessione ad internet assente");
                        $("#istantaDownAlert").find("h3").text("Necessaria la connessione per poter scaricare il contenuto del kit");
                    }
                    else if (istantaState==IstantaState.IstantaDown)
                    {
                        //Non posso scaricare perchè Istanta2 non è disponibile
                        $("#istantaDownAlert").find("h1").text("Istanta2 indisponibile");
                        $("#istantaDownAlert").find("h3").text("Richiedere assistenza tecnica per ripristino del servizio");
                    }
                }
                else
                {
                    //Si puo procedere in lavorazione
                    if (!isOnline)
                    {
                        //Disabilitare le funzionalità che richiedono la connessione
                    }
                    
                    if (istantaState==IstantaState.IstantaDown)
                    {
                        //Disabiolitare le funzionalità che richiedono il dialogo con istanta senza offrire alternative
                        //Ad. es. conteggio e impaginazione
                    }
                }
            }

            if (IstantaState.Logged == istantaState) {
                // while (!checkPercorsoFotoLoghi()) {
                //     await Utility.sleep(1000);
                // }
                // while (!checkPercorsiDiSistema()) {
                //     await Utility.sleep(1000);
                // }
                const docAtteso = docInLavorazione;
                try {
                    while (docInLavorazione === docAtteso && !(await checkPercorsi())) {
                        await Utility.sleep(1000);
                    }
                }
                catch (e) {
                    //Finche' l'await non c'era un errore qui dentro non arrivava a nessuno: e' cosi'
                    //che il ReferenceError su forceOptions (I20-1002) e' rimasto nascosto per mesi.
                    //Ora lo si dice, e poi si prosegue come si e' sempre fatto.
                    console.error(e);
                    messaggioUtente("Code IDX-167 Errore durante la verifica dei percorsi di sistema: " + e, "error");
                }
                if (docInLavorazione !== docAtteso) {
                    //Il documento e' cambiato durante l'attesa: ci pensa la sua inizializzazione.
                    return;
                }
                checkForLoghiCore();
            }
            
        }
        else
        {
            if (isOnline && istantaState!=IstantaState.IstantaDown)
            {
                if (ruoloUtenteLoggato != RuoloUtente.superAdmin) {
                    indesignEvents.policyIsLocked = true;
                    //I20-936: chi non puo' creare la lavorazione se la fa mandare e la mette nella
                    //cartella a pannello aperto. Il file si rilegge solo a una nuova
                    //inizializzazione, quindi senza questo pulsante l'unico modo di vederla era
                    //chiudere e riaprire il plugin.
                    setNarrow("Impossibile inizializzare questo documento con l’account " + nomeUtente + ". Contattare l’amministratore per risolvere la lavorazione.",
                        [{ buttonText: "Rileggi il documento", buttonCallback: rileggiDocumentoInLavorazione }]);
                    $("#nomeKitInLavorazione").text("");
                    $("#wrapper").css("display", "block");
                    return;
                }

                $("#dialogSelectKit").css("display","block");
                $("#wrapper").css("display","none");
                await autoCompilazioneCampiKit();
            }   
            else
            {
                $("#istantaDownAlert").find("h1").text("Documento non legato a KIT");
                $("#istantaDownAlert").find("h3").text("Istanta2 è al momento non disponibile e per poter procedere con l'elaborazione è necessario attendere che Istanta2 sia di nuovo funzionante");
            }
        }
    }
    Modali.closeAllModal();
    $("#homeImage").click();
}

/// L'equivalente di initDocumentInLavorazione quando invece di un documento e' aperto un
/// libro InDesign: si entra qui solo se docInLavorazione e' null.
///
/// Un libro e' un elenco di .indd, e il Plugin lo lavora tutto insieme. Per sapere quali
/// file sono lavorabili legge lavorazioni.json nella cartella del libro e tiene solo quelli
/// che ci compaiono: gli altri sono file che stanno nel libro ma non appartengono a questa
/// lavorazione.
///
/// Lo stato di jobImpaginazioneLibro decide cosa si vede, ed e' persistente fra una
/// sessione e l'altra: 0 mai partito, 1 interrotto a meta' (il bottone diventa CONTINUA
/// IMPAGINAZIONE), 2 e 4 finito (si passa all'esportazione), 3 esportazione interrotta.
/// E' quello che permette di riprendere un libro lasciato a meta' il giorno prima.
///
/// DIFETTO (I20-1002): "await !checkPercorsi()" come in initDocumentInLavorazione - vedi
/// li' la spiegazione. Qui il risultato finisce in _resTest, che viene solo stampato.
async function initLibroInLavorazione()
{
    if (isOnline && istantaState != IstantaState.NotLogged) {

        if (app.books.count() > 0) {
            let book = app.books.item(0);
            console.log("Libro in lavorazione: " + book.name);

            //Devo mostrare al posto della schermata di home tradizionale, la lista di file lavorabili con questo libro e un unico pulsante di IMPAGINA


            $("#contanierRiepilogoLibro").empty();

            let fullName = await book.fullName;
            let nativePath = fullName.nativePath;
            let sep = Utility.getDirSeparator();
            let _pathDelLibro = nativePath.substring(0, nativePath.lastIndexOf(sep) + 1);
            let lav = readFile(_pathDelLibro + "lavorazioni.json");
            let _count = 0;

            let _itemTrovati = [];
            if (lav != null) {
                let bookContents = book.bookContents;
                for (let i = 0; i < bookContents.count(); i++) {
                    let bookContent = bookContents.item(i);
                    let bcFullname = await bookContent.fullName;
                    let bcNativePath = bcFullname.nativePath;
                    let nomeFile = bcNativePath.substring(bcNativePath.lastIndexOf(sep) + 1);
                    let cercaInLav = lav.filter(l => l.file == nomeFile);
                    if (cercaInLav.length > 0) {
                        //Elenco questo file nel contenuto
                        $("#contanierRiepilogoLibro").append("<div style=\"padding:5px;\">File: " + nomeFile + " - Kit: " + JSON.parse(cercaInLav[0].details.meta).titolo + "</div>");
                        _count++;
                        _itemTrovati.push({ pathLavorazione: _pathDelLibro, docName: nomeFile });
                    }
                }

            }

            if (_count == 0) {
                //Nessuna lavorazione trovata, parto con autocompilazione e quindi ricerca del kit
                if (isOnline && istantaState != IstantaState.IstantaDown) {
                    $("#dialogSelectKit").css("display", "block");
                    $("#wrapper").css("display", "none");
                    //await autoCompilazioneCampiKit();
                }
                else {
                    setNarrow("Nessun documento aperto");
                }
            }
            else {

                libroInLavorazione = book;

                jsIndexControls.openTab(null, "Tab14");
                setNarrow("Libro in lavorazione: " + book.name);
                jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();
                if (jobImpaginazioneLibro == null) {
                    jobImpaginazioneLibro = {};

                    jobImpaginazioneLibro.stato = 0;//1;//In lavorazione 2//completato
                    jobImpaginazioneLibro.index = -1;
                    jobImpaginazioneLibro.queue = [];
                }

                if(jobImpaginazioneLibro.stato == 2 || jobImpaginazioneLibro.stato == 4){
                    setNarrow("Libro già impaginato: " + book.name);
                    //Nascondiamo impaginaLibroContainer
                    $("#impaginaLibroContainer").css("display", "none");
                    $("#continuaEsportaLibroContainer").css("display", "none");
                    //mostriamo esportaLibroContainer
                    $("#esportaLibroContainer").css("display", "block");
                }
                else if (jobImpaginazioneLibro.stato == 1 || jobImpaginazioneLibro.stato == 0){
                    //Mostriamo impaginaLibroContainer
                    $("#impaginaLibroContainer").css("display", "block");
                    //nascondiamo esportaLibroContainer
                    $("#esportaLibroContainer").css("display", "none");
                    $("#continuaEsportaLibroContainer").css("display", "none");

                    //se lo stato è 1 cambiamo il testo del bottone di impaginaLibroPoP in "CONTINUA IMPAGINAZIONE"
                    if(jobImpaginazioneLibro.stato == 1){
                        $("#impaginaLibroPoP").text("CONTINUA IMPAGINAZIONE");
                    }
                }
                else if(jobImpaginazioneLibro.stato == 3 ){
                    setNarrow("Esportazione interrotta: " + book.name);
                    //Mostriamo impaginaLibroContainer
                    $("#impaginaLibroContainer").css("display", "none");
                    //nascondiamo esportaLibroContainer
                    $("#esportaLibroContainer").css("display", "none");
                    $("#continuaEsportaLibroContainer").css("display", "block");
                }

                $("#mainContent").show();

                $("#dialogSelectKit").css("display", "none");
                $("#wrapper").css("display", "block");

                //Prendo il primo file trovato, gli altri li clono partendo da questo

                //Vorrei impostare qui i percorsi del primo file trovato
                let _resTest = await !checkPercorsi(/*_itemTrovati[0]*/);
                console.log("_resTest: " + _resTest);

                // while (await !checkPercorsi(_itemTrovati[0])) {
                //     console.log("check percorsi in corso...");
                //     await Utility.sleep(1000);
                // }

                // console.log("check percorsi terminato.");
                //Poi duplicarte i percorsi impostati per tutti fli atlri files del libro, sono i medeimi.

                //A questo punto si puo procedere ad operare con impaginazione e scelta di fare sync foto oppure no

            }


        }
        else {
            //a tutti gli effetti non c'è niente di aperto
            $("#dialogSelectKit").css("display", "none");
            $("#wrapper").css("display", "block");
            setNarrow("Nessun documento aperto");
        }
    }

}

/// Apre la finestra di esportazione del libro mettendoci dentro una casella per ogni tipo
/// di export che serve davvero.
///
/// I tipi non sono un elenco fisso: si ricavano da quello che e' stato impaginato. Per ogni
/// voce della coda si guarda l'ultimo elemento, si leggono i Kit.Names delle sue referenze,
/// e da ogni guidIdTipoExport si risale al tipo in ficoProcess.sourceTipiExport. Senza
/// ripetizioni, perche' lo stesso tipo compare in ogni referenza.
///
/// Cosi' all'operatore vengono proposte solo le esportazioni che quel libro puo' produrre.
async function apriModalEsportaLibro(){
    Modali.apriModal("dialogEsportaLibro", "Esporta Libro");
    //In jobImpaginazioneLibro.queue ci sono i tipi di esportazione che ci interessano
    //Scorriamo tutti gli elementi e per ognuno accediamo a lastItem.listaRef[0][Kit.Names]
    //kit.names è così formata
    // "Kit.Names": [
    //     {
    //         "guidIdTipoExport": "aec23741-d19a-4585-a462-a64cb6d71d00",
    //         "nomeFile": "A4_FLUSSO2_SC_LI_2025-06-27_VOL_OF_{{contatore}}_2515A_1361_A.pdf"
    //     },
    //     {
    //         "guidIdTipoExport": "e842616d-c8cd-4a68-906a-ca9335b25e12",
    //         "nomeFile": "A4_FLUSSO2_SC_LI_2025-06-27_VOL_OF_{{contatore}}_2515A_1361_A_[4075348].pdf"
    //     }
    // ]

    //noi per ogni elemento in lista leggiamo il guidIdTipoExport e cerchiamo in ficoProcess.sourceTipiExport 
    //l'elemento con guidID == guidIdTipoExport e lo mettiamo da parte in lista (listTipiExportSelezionati) senza ripetizioni
    //infine compiliamo #bodyEsportazioniLibro con una lista di checkbox con scritto il listTipiExportSelezionati[i].titolo e con param nascosto il guidID
    jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();
    var listTipiExportSelezionati = [];
    for (let i = 0; i < jobImpaginazioneLibro.queue.length; i++) {
        let el = jobImpaginazioneLibro.queue[i];
        let lastItem = el.lastItem;
        if(lastItem == null){
            continue;
        }
        let listaRef = lastItem.listaRef;
        for (let j = 0; j < listaRef.length; j++) {
            let kitNames = listaRef[j]["Kit.Names"];
            for (let k = 0; k < kitNames.length; k++) {
                let guidIdTipoExport = kitNames[k].guidIdTipoExport;
                let tipoExport = ficoProcess.sourceTipiExport.content.find(t => t.guidID == guidIdTipoExport);
                if (tipoExport != null) {
                    // Accumulatore locale (function-scoped via var) dei tipi export unici
                    if (!listTipiExportSelezionati.some(t => t.guidID === tipoExport.guidID)) {
                        listTipiExportSelezionati.push(tipoExport);
                    }
                }
            }
        }
    }

    for (let i = 0; i < listTipiExportSelezionati.length; i++) {
        let tipoExport = listTipiExportSelezionati[i];
        let checkbox = $(`
            <div style="
            display:flex;
            align-items:center;
            gap:8px;
            padding:8px 12px;
            margin:6px 0;
            border:1px solid #e3e3e7;
            border-radius:8px;
            background:#fff;
            ">
            <input
                type="checkbox"
                class="exportTipoCheckbox"
                id="exportTipo_${tipoExport.guidID}"
                style="
                width:16px;
                height:16px;
                accent-color:#0c986b;
                cursor:pointer;
                "
            />
            <label
                for="exportTipo_${tipoExport.guidID}"
                style="
                flex:1;
                color:#1f1f1f;
                font-size:13px;
                line-height:1.2;
                cursor:pointer;
                user-select:none;
                "
            >
                ${tipoExport.titolo}
            </label>
            </div>
        `);
        $("#bodyEsportazioniLibro").append(checkbox);
    }


}

/// Esporta tutti i file del libro, uno dopo l'altro, in tutti i formati scelti nella
/// finestra aperta da apriModalEsportaLibro.
///
/// E' l'operazione piu' lunga del Plugin: apre ogni .indd, lo inizializza, produce ogni
/// esportazione, lo richiude salvando. Gli eventi restano spenti per tutta la durata
/// (setBusy), altrimenti ogni apertura di documento farebbe ripartire l'analisi.
///
/// E' ripartibile, ed e' la ragione di meta' del codice. Dopo ogni file esportato lo stato
/// finisce su disco (registraStatoLavorazioneLibro): se il processo si interrompe, allo
/// stato 3 si rientra da dove si era - stesso file, stesso tipo di export, pagina
/// successiva all'ultima riuscita. I due controlli su lastItemExport.pag == tot servono a
/// saltare cio' che era gia' finito.
///
/// Due conferme sbarrano la strada quando lo stato non e' quello previsto: se e' gia' stato
/// esportato (4) si chiede se ripetere, se l'impaginazione non e' finita (0 o 1) si avverte
/// che forzando non si potra' piu' impaginare - e si spiega come tornare indietro,
/// cancellando listaImpaginata<idKit>.json.
///
/// _processJob aspetta con un ciclo di sleep che esitoFinale smetta di essere null:
/// ficoProcess.esportaMateriale lavora a callback e non restituisce una promise, quindi
/// non c'e' niente da attendere.
async function esportaLibro(){
    try{

        //leggiamo tutti i checkbox selezionati in #bodyEsportazioniLibro e mettiamo da parte i loro guidID
        jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();
    
        let tipiExportSelezionati = [];
        
        $(".exportTipoCheckbox:checked").each(function () {
            let id = $(this).attr("id").replace("exportTipo_", "");
            tipiExportSelezionati.push(id);
        });
        Modali.chiudiModal();
    
    
        let job = jobImpaginazioneLibro;
        let esportazioneDaRiprendere = false;
    
        if(job.stato == 4){
            var res = await Modali.confirm("Il processo di esportazione del libro è già stato effettuato, vuoi ripeterlo?.");
            if(!res){
                return;
            }
            //resettiamo i lastItemExport
            for (let i = 0; i < job.queue.length; i++) {
                let bindData = job.queue[i];
                bindData.lastItemExport = null;
            }
        }
    
        if(job.stato == 1 || job.stato == 0){
            var res = await Modali.confirm("Impaginazione non ancora completata. Vuoi forzare il processo di esportazione? Non sarà possibile più possibile impaginare il libro. Per ripristinare l'impaginazione in un secondo momento cancellare il file listaImpaginata"+idKitLavorazione+".json nella cartella del libro. CONTINUARE?");
            if(!res){
                return;
            }
        }
    
        if (job.stato == 3) {
            esportazioneDaRiprendere = true;
        }
    
        if(!esportazioneDaRiprendere && tipiExportSelezionati.length == 0){
            messaggioUtente("Code IDX-01 Nessun tipo di esportazione selezionato, impossibile procedere", "error", false, 10);
            return;
        }
        
        job.stato = 3; //In esportazione
    
        //Blocco gli events
        indesignEvents.setBusy(true);
    
        async function _processJob(guidIDTipoExport, nomeFileInBook, bindData, paginaDiRipresa) {
            // //await Utility.sleep(500);
            console.log("Esportazione file " + nomeFileInBook);
    
            setTimeout(function () {
                showLoading("Esportazione file " + nomeFileInBook);
    
            }, 100);
            var esitoFinale = null;
            await ficoProcess.esportaMateriale(guidIDTipoExport, async function (esito, msg, item, operationEnded = false) {
                if (!esito){
                    console.error("Errore durante esportazione file " + nomeFileInBook + ": " + msg);
                    messaggioUtente("Code IDX-02 Errore durante esportazione file " + nomeFileInBook + ": " + msg, "error", false, 10);
                    esitoFinale = false;
                    return;
                }
    
                bindData.lastItemExport = item;
                await registraStatoLavorazioneLibro();
    
                if(operationEnded){
                    console.log("Esportazione file " + nomeFileInBook + " terminata: " + msg);
                    console.log("Finalizzo esportazione...");
                    esitoFinale = true;
                }
            }, paginaDiRipresa);
    
            while (esitoFinale == null) {
                await Utility.sleep(500);
            }
    
            return esitoFinale;
        }
    
        var endedWithError = false;
    
        for (let i = 0; i < job.queue.length; i++) {
            let bindData = job.queue[i];
            let tipoDiExportCorrente = bindData.tipoExportCorrente;
            if (esportazioneDaRiprendere && tipiExportSelezionati.length == 0) {
                //recuperiamo lastItemExport per leggere tipiExport e tipoExportCorrente
                tipiExportSelezionati = bindData.tipiExport;
            }
    
            if (tipoDiExportCorrente != null && tipoDiExportCorrente == tipiExportSelezionati[tipiExportSelezionati.length - 1]) {
                //siamo nell'ultimo export, controlliamo se tutti gli item sono stati esportati
                if (bindData.lastItemExport != null) {
                    if (Number(bindData.lastItemExport.pag) == bindData.tot) {
                        //Gia completato
                        continue;
                    }
                }
            }
    
            job.index = i;
            let _pathLavorazioneLibro = bindData.pathLavorazione;
            let nomeFileInBook = bindData.docName;
    
            let fullFilePath = _pathLavorazioneLibro + Utility.getDirSeparator() + nomeFileInBook;
            console.log("Apro il file: " + fullFilePath);
    
            app.open(fullFilePath);
    
            console.log("Inizio esportazione libro, indice " + i + "...");
            //Blocco gli events
            //Inizializzo lavorazione file che mi imposta il documento e il path di lavorazione
            docInLavorazione = app.activeDocument;
            await initDocumentInLavorazione();
            bindData.tipiExport = tipiExportSelezionati;
            for (let k = 0; k < tipiExportSelezionati.length; k++) {
                bindData.tipoExportCorrente = tipiExportSelezionati[k];
                var paginaDiRipresa = null;
                //se tipoDiExportCorrente non è null dobbiamo riprendere da li
                if (esportazioneDaRiprendere) {
                    if (bindData.tipoExportCorrente != tipoDiExportCorrente) {
                        console.log("Skippo esportazione tipo " + bindData.tipoExportCorrente + " perchè già esportata");
                        continue;
                    }
                    else {
                        esportazioneDaRiprendere = false; //tolgo il flag perchè da qui in poi devo procedere normalmente
                    }
    
                    if (Number(bindData.lastItemExport.pag) == bindData.tot) {
                        //Gia completato
                        continue;
                    }
    
                    paginaDiRipresa = Number(bindData.lastItemExport.pag) + 1;
                }
                let guidIDTipoExport = tipiExportSelezionati[k];
                console.log("Esporto tipo: " + guidIDTipoExport);
                var esito = await _processJob(guidIDTipoExport, nomeFileInBook, bindData, paginaDiRipresa);
                if (!esito) {
                    console.error("Esportazione interrotta per errore.");
                    endedWithError = true;
                    break;
                }
            }
            if (endedWithError) {
                break;
            }
            app.activeDocument.close(SaveOptions.YES);
        }
    
        hideLoading();
        indesignEvents.setBusy(false);
        if (!endedWithError) {
            jobImpaginazioneLibro.stato = 4; //Completato
            await registraStatoLavorazioneLibro();
            messaggioUtente("Code IDX-03 Esportazione libro completata", "success", false, 10);
        }
        else{
            messaggioUtente("Code IDX-04 Esportazione libro interrotta per errori", "error", false);
        }
    
        jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();
        if (jobImpaginazioneLibro.stato == 2 || jobImpaginazioneLibro.stato == 4) {
            setNarrow("Libro impaginato", [], false);
            //Nascondiamo impaginaLibroContainer
            $("#impaginaLibroContainer").css("display", "none");
            $("#continuaEsportaLibroContainer").css("display", "none");
            //mostriamo esportaLibroContainer
            $("#esportaLibroContainer").css("display", "block");
        }
        else if (jobImpaginazioneLibro.stato == 1 || jobImpaginazioneLibro.stato == 0) {
            //Mostriamo impaginaLibroContainer
            $("#impaginaLibroContainer").css("display", "block");
            //nascondiamo esportaLibroContainer
            $("#esportaLibroContainer").css("display", "none");
            $("#continuaEsportaLibroContainer").css("display", "none");
        }
        else if (jobImpaginazioneLibro.stato == 3) {
            setNarrow("Esportazione interrotta", [], false);
            //Mostriamo impaginaLibroContainer
            $("#impaginaLibroContainer").css("display", "none");
            //nascondiamo esportaLibroContainer
            $("#esportaLibroContainer").css("display", "none");
            $("#continuaEsportaLibroContainer").css("display", "block");
        }
    }
    catch(ex){
        hideLoading();
        indesignEvents.setBusy(false);
        console.error("Errore durante esportazione libro: " + ex.message);
        messaggioUtente("Code IDX-05 Errore durante esportazione libro: " + ex.message, "error", false);
    }
}

/// I20-1017: il percorso completo del documento, che decodificaNomeFile vuole intero perche' la
/// promo e' il nome della cartella che lo contiene. Il separatore si prende dalla cartella, che e'
/// gia' nella forma del sistema operativo.
function percorsoCompletoDocumento(cartella, nomeFile) {
    if (typeof cartella !== "string" || cartella === "" || typeof nomeFile !== "string" || nomeFile === "") {
        return null;
    }
    var sep = cartella.indexOf("\\") >= 0 && cartella.indexOf("/") < 0 ? "\\" : "/";
    return cartella.endsWith(sep) ? cartella + nomeFile : cartella + sep + nomeFile;
}

/// I20-1017: dal nome del file alle quattro opzioni da selezionare nella scelta del kit.
///
/// decodificaNomeFile restituisce nomi e sigle - nomePromo, siglaCanale, siglaArea, siglaFormato -
/// mentre le tendine hanno come valore il guidID: qui si cercano gli elementi corrispondenti. La
/// promo si confronta con nomePromo, canale e area con la sigla, il formato con il codice (VOL,
/// A4_FLUSSO2...). Canale e area valgono solo se la promo li ha davvero fra i suoi tracciati,
/// perche' la tendina mostra solo quelli. Quello che non si trova resta null.
function opzioniKitDaNomeFile(decodificato, promoAperte, canali, aree, formati) {
    var scelte = { guidPromo: null, guidCanale: null, guidArea: null, guidFormato: null };
    if (decodificato == null) {
        return scelte;
    }

    var stessoTesto = function (a, b) {
        return a != null && b != null && String(a).trim() !== "" && String(a).trim() === String(b).trim();
    };

    var promo = (promoAperte || []).find(function (p) { return p != null && stessoTesto(p.nomePromo, decodificato.nomePromo); });
    if (promo != null) {
        scelte.guidPromo = promo.guidID;

        var tracciati = promo.promoTracciatis || [];
        var canale = (canali || []).find(function (c) {
            return c != null && stessoTesto(c.sigla, decodificato.siglaCanale) &&
                tracciati.some(function (tr) { return tr.guidCanale == c.guidID; });
        });
        var area = (aree || []).find(function (a) {
            return a != null && stessoTesto(a.sigla, decodificato.siglaArea) &&
                tracciati.some(function (tr) { return tr.guidArea == a.guidID; });
        });
        scelte.guidCanale = canale != null ? canale.guidID : null;
        scelte.guidArea = area != null ? area.guidID : null;
    }

    var formato = (formati || []).find(function (f) { return f != null && stessoTesto(f.codice, decodificato.siglaFormato); });
    scelte.guidFormato = formato != null ? formato.guidID : null;

    return scelte;
}

/// I20-1017: se le quattro opzioni ci sono tutte. Solo allora la ricerca del kit parte da sola, e
/// solo allora il metodo principale basta senza ricorrere alla riserva.
function sceltaKitCompleta(scelte) {
    return scelte != null && scelte.guidPromo != null && scelte.guidCanale != null &&
        scelte.guidArea != null && scelte.guidFormato != null;
}

/// Legge il nome del documento aperto, ne ricava promo, canale, area e formato, riempie le quattro
/// tendine della scelta kit e, se le trova tutte e quattro, fa partire da sola la ricerca del kit.
/// Cosi' l'operatore che apre un file gia' battezzato con le regole del cliente non deve
/// ridigitare quello che il nome contiene gia'.
///
/// I20-1017: non aveva mai funzionato, e per quattro motivi, non uno: il risultato di
/// decodificaNomeFile si buttava via; si leggevano promo/canale/area/formato mentre il decoder
/// restituisce nomePromo/siglaCanale/siglaArea/siglaFormato; gli si passava il solo nome del file
/// mentre la promo la ricava dalla cartella; e le tendine confrontano il guidID, non il nome. In
/// piu' canale e area si riempiono solo scegliendo la promo, cosa che setPickerValue non fa
/// scattare: dopo la promo si chiama kitPromoCmb_changed.
///
/// I due metodi, nell'ordine (I20-1017, secondo giro):
/// 1. principale, customAgenzia.decodificaNomeFileConPromo: tutto dal nome del file, che si chiama
///    <NOME PROMO>_<CANALE><AREA>; se trova tutte e quattro le opzioni basta lui, e la cartella non
///    si guarda;
/// 2. riserva, customAgenzia.decodificaNomeFile: la promo e' il nome della cartella, e il file si
///    chiama <FORMATO>_<CANALE><AREA>_... Un risultato parziale del principale non si mescola con la
///    riserva: o tutto dal nome del file, o la riserva.
///
/// Se manca anche uno dei quattro si compila quello che si e' trovato e la ricerca non parte:
/// l'operatore completa a mano. I clienti senza nessuno dei due metodi non passano di qui.
async function autoCompilazioneCampiKit(){

    $("#actMassivaSuKit").css("display", "none");

    if (docInLavorazione == null ||
        (customAgenzia.decodificaNomeFileConPromo == null && customAgenzia.decodificaNomeFile == null)) {
        return;
    }

    var elenchi = [ficoProcess.listaPromoAperte, ficoProcess.sourceCanali, ficoProcess.sourceAree, ficoProcess.sourceFormati];
    var scelte = null;

    //Un nome scritto in un altro modo non deve fermare l'apertura: ogni metodo che fallisce si
    //salta, e al peggio le tendine restano da compilare a mano.
    if (customAgenzia.decodificaNomeFileConPromo != null) {
        try {
            var nomiPromo = (ficoProcess.listaPromoAperte || []).map(function (p) { return p != null ? p.nomePromo : null; });
            var codiciFormato = (ficoProcess.sourceFormati || []).map(function (f) { return f != null ? f.codice : null; });
            var dalNome = customAgenzia.decodificaNomeFileConPromo(docInLavorazione.name, nomiPromo, codiciFormato);
            var scelteDalNome = opzioniKitDaNomeFile(dalNome, elenchi[0], elenchi[1], elenchi[2], elenchi[3]);
            if (sceltaKitCompleta(scelteDalNome)) {
                scelte = scelteDalNome;
            }
        }
        catch (e) {
            console.warn("Compilazione automatica del kit dal nome del file non riuscita:", e);
        }
    }

    if (scelte == null && customAgenzia.decodificaNomeFile != null) {
        try {
            var percorso = percorsoCompletoDocumento(pathLavorazione, docInLavorazione.name);
            if (percorso != null) {
                var decodificato = customAgenzia.decodificaNomeFile(percorso);
                scelte = opzioniKitDaNomeFile(decodificato, elenchi[0], elenchi[1], elenchi[2], elenchi[3]);
            }
        }
        catch (e) {
            console.warn("Compilazione automatica del kit da cartella e nome del file non riuscita:", e);
        }
    }

    if (scelte == null) {
        return;
    }

    if (scelte.guidPromo != null) {
        Menu.setPickerValue($("#kitPromoCmb"), scelte.guidPromo, false);
        //Canale e area si riempiono solo con la promo scelta.
        kitPromoCmb_changed();
        await Utility.sleep(50);

        if (scelte.guidCanale != null) {
            Menu.setPickerValue($("#kitCanaliCmb"), scelte.guidCanale, false);
        }
        if (scelte.guidArea != null) {
            Menu.setPickerValue($("#kitAreeCmb"), scelte.guidArea, false);
        }
    }

    if (scelte.guidFormato != null) {
        Menu.setPickerValue($("#kitFormatiCmb"), scelte.guidFormato, false);
    }

    if (sceltaKitCompleta(scelte)) {
        ficoProcess.cercaKit(function(result)
        {
            console.log("Ricerca kit terminata");

        });
    }
}

//Funzione che scarica da Istanta2 il contenuto del kit

/// Scarica da Istanta il tracciato del kit, lo salva in listaKit<idKit>.json nella cartella
/// della lavorazione, e rilegge subito il file appena scritto per ridisegnare il tracciato.
///
/// Il file su disco e' quello che rende possibile lavorare con Istanta irraggiungibile:
/// finche' c'e', leggiContenutoKit basta a se' stessa.
///
/// Una richiesta gia' in volo viene annullata (xhrInProcess.abort): l'operatore che preme
/// due volte non si ritrova due tracciati che si sovrascrivono a vicenda.
///
/// I20-1004: se e' questo scaricamento a essere annullato, spegne il suo caricamento e
/// onErrore lo viene a sapere col motivo.
///
/// I20-981, due correzioni che vanno lette insieme:
///
/// - il rinfresco dell'interfaccia sta in un try suo. Prima era nello stesso try della
///   callback, e un errore li' dentro - leggiContenutoKit rifa' il tracciato, e con lui la
///   riga del bottone appena premuto - faceva saltare la callback: il Report Integrita' non
///   partiva mai e l'operatore doveva richiederlo.
/// - onerror ora avvisa, tramite onErrore. Prima l'errore non arrivava a nessuno e chi
///   attendeva la lista restava appeso per sempre.
///
/// DA SPOSTARE (task di divisione): questa, scaricaContenutoKitAsync e leggiContenutoKit
/// sono il kit in lavorazione, non la schermata. Starebbero in ficoProcess.js, che gia'
/// tiene la ricerca e la selezione del kit.
function scaricaContenutoKit(idKit, noCacheValue = null, callback = null, skipMostraTracciato = false, onErrore = null)
{
    if(idKit == null){
        idKit = idKitLavorazione;
    }
    if(noCacheValue == null){
        noCacheValue = noCache;
    }
    console.log("scaricaContenutoKit("+ idKit +")");

    console.log("step1");

    //I20-1004: prima si annulla, poi si accende il caricamento. Lo scaricamento annullato
    //spegne il suo nell'onabort, e spegnerebbe questo se fosse gia' acceso.
    if (xhrInProcess!=null)
        xhrInProcess.abort("Nuovo scaricamento della lista");

    showLoading("Scaricamento lista...");

    console.log("step2");

    xhrInProcess = new XMLHttpRequestClient();
    xhrInProcess.descrizione = "Scaricamento lista";
    xhrInProcess.onload = (objResult, parsed) => {

        console.log(objResult);

        // if (!parsed) {
        //     try {
        //         objResult = JSON.parse(objResult);
        //     } catch (e) {
        //         messaggioUtente("Code IDX-06 Errore durante il parsing del risultato: " + e, "error");
        //         return;
        //     }
        // }



        try {
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                }
                catch (e) {
                    messaggioUtente("Code IDX-06 Errore durante il parsing del risultato: " + e, "error");
                    hideLoading();
                    return;
                }
            }
            console.log(objResult);

            //salviamo il risultato in un file json
            var filePath = pathLavorazione + "/listaKit" + idKit + ".json";
            //aggiungiamo a objResult una chiave con la data di scaricamento fino al secondo        
            objResult["DataScaricamento"] = new Date().toLocaleString('it-IT');
            objResult["idKit"] = idKit;

            fs.writeFileSync(filePath, JSON.stringify(objResult));
            if (typeof ReportIntegrita !== "undefined" && ReportIntegrita.eliminaReportIntegritaLocale) {
                ReportIntegrita.eliminaReportIntegritaLocale(idKit);
            }

            //I20-981: il rinfresco dell'interfaccia non deve poter impedire il lavoro di chi
            //aspetta la lista. Prima stava dentro lo stesso try della callback: un errore qui
            //(leggiContenutoKit rifa' il tracciato, e con lui la riga del bottone appena
            //premuto) faceva saltare la callback e il Report Integrita' non partiva mai, con
            //l'operatore costretto a richiederlo.
            try {
                leggiContenutoKit(idKit, skipMostraTracciato);
            }
            catch (exUi) {
                console.error("Errore durante la lettura del contenuto del kit appena scaricato:", exUi);
            }

            tracciatoOnlineScaricato = true;
            //scaricaTracciatoLocale(idTracciato);

            xhrInProcess = null;

            if (callback != null && typeof callback === "function") {
                callback(objResult);
            }
            else {
                hideLoading();
            }

        }
        catch (e) {
            messaggioUtente("Code IDX-07 Errore durante lo scaricamento del contenuto del kit: " + e, "error");
            console.log(e);
        }
        finally {
            hideLoading();
        }
    }

    xhrInProcess.onreadystatechange = function () {
        if (xhrInProcess.readyState == 4) {
            if (xhrInProcess.status == 200) {
                //messaggioUtente("Richiesta completata con successo", "success");
            } else {
               // messaggioUtente("refreshCambiaPS: Errore durante la richiesta: " + xhr.status, "error");
            }
        }
    };

    xhrInProcess.onerror = function (errore) {
        //I20-981: prima l'errore non arrivava a nessuno e chi attendeva la lista restava
        //appeso. Il chiamante che passa onErrore lo viene a sapere.
        hideLoading();
        if (onErrore != null && typeof onErrore === "function") {
            onErrore(errore);
        }
    }

    xhrInProcess.onabort = function (motivo) {
        //Il caricamento acceso qui va spento qui: la risposta, che lo spegneva nel suo
        //finally, non arrivera' piu', e chi ha annullato - un cambio di documento, per
        //esempio - non ne sa niente. Il pannello resterebbe sopra tutto il Plugin.
        hideLoading();
        if (onErrore != null && typeof onErrore === "function") {
            onErrore("annullato a causa di: " + motivo);
        }
    }


    console.log("Menabo/getListaTracciatoNew/" + idKit);
    //var formData = new FormData();
    console.log(xhrInProcess);
    xhrInProcess.send("Menabo/getListaTracciatoNew2/" + idKit+"/"+noCacheValue, null, "GET");
}

//I20-981: la lista del kit attesa come si deve.
//Il Report Integrita' partiva dentro la callback di scaricaContenutoKit e da la' in poi
//nessuno sapeva piu' se il download fosse andato bene: onload chiudeva con un finally che
//spegneva il loading mentre la callback era ancora in volo e onerror non avvisava nessuno.
//Chi attende la lista ora ha una Promise che si risolve o fallisce.
/// I20-981: la lista del kit attesa come si deve.
///
/// Avvolge scaricaContenutoKit in una Promise che si risolve col risultato o fallisce con
/// l'errore. Prima chi aveva bisogno della lista doveva passare una callback e sperare:
/// onload chiudeva con un finally che spegneva il loading mentre la callback era ancora in
/// volo, e onerror non avvisava nessuno.
///
/// DA SPOSTARE (task di divisione): in ficoProcess.js con scaricaContenutoKit.
function scaricaContenutoKitAsync(idKit, noCacheValue = null, skipMostraTracciato = false) {
    return new Promise((resolve, reject) => {
        try {
            scaricaContenutoKit(
                idKit,
                noCacheValue,
                function (objResult) {
                    resolve(objResult);
                },
                skipMostraTracciato,
                function (errore) {
                    reject(new Error("scaricamento della lista non riuscito: " + errore));
                });
        }
        catch (e) {
            reject(e);
        }
    });
}

//Funzione che legge in locale il contentuo del kit grazie al file json ultimo scaricato
/// Rilegge da disco listaKit<idKit>.json e lo mette in contenutoKitInLavorazione, poi
/// ridisegna il tracciato.
///
/// Non chiede niente al server: e' la meta' offline di scaricaContenutoKit, ed e' quella
/// che si usa all'avvio. L'operatore aggiorna quando decide lui.
///
/// skipMostraTracciato serve a chi il tracciato lo ridisegna per conto suo dopo, e non
/// vuole pagarlo due volte.
///
/// DA SPOSTARE (task di divisione): in ficoProcess.js con scaricaContenutoKit.
function leggiContenutoKit(idKit, skipMostraTracciato = false)
{
    console.log("leggiContenutoKit("+ idKit +")");

    let filePath = pathLavorazione + "/listaKit"+idKit+".json";   
    contenutoKitInLavorazione=readFile(filePath);

    clearInfo();
    if (!skipMostraTracciato) {
        mostraTracciato();
    }
}

// #endregion


/// Mostra il modulo di accesso e nasconde il resto.
///
/// I20-956: se l'operatore ha chiesto di ricordare le credenziali, le ritrova gia' scritte
/// nei campi, col segno di spunta alzato. Il Plugin non entra da solo: l'accesso resta un
/// gesto suo. Dopo un logout non c'e' nulla da rimettere, perche' il logout le dimentica.
///
/// DA SPOSTARE (task di divisione): con login, logout e setFinestrePerRuolo in un js
/// dell'accesso. Sono quattro funzioni di un concetto solo.
async function showLogin()
{
    console.log("Devo mostrare il form di login");

    //I20-956: se l'operatore ha chiesto di ricordare le credenziali, le ritrova gia'
    //scritte nei campi. Il Plugin non entra da solo: l'accesso resta un gesto suo.
    //Dopo un logout non c'e' nulla da rimettere, perche' il logout le dimentica.
    var ricordate = await credenzialiSalvate.leggi();
    if (ricordate != null) {
        $("#username").val(ricordate.username);
        $("#password").val(ricordate.password);
        $("#ricordami").prop("checked", true);
    }

    hideLoading();
    $("#loginPanel").css("display", "flex");


    $("#dialogSelectKit").css("display","none");
    $("#wrapper").css("display","flex");

}

/// Restituisce l'elenco delle aree caricato da ficoProcess. Una riga di inoltro, perche'
/// index.html vede solo le globali.
function getSourceAree(){
    return ficoProcess.sourceAree;
}

/// Restituisce l'elenco dei canali caricato da ficoProcess. Vedi getSourceAree.
function getSourceCanali(){
    return ficoProcess.sourceCanali;
}

/// Restituisce l'elenco dei formati caricato da ficoProcess. Vedi getSourceAree.
function getSourceFormati(){
    return ficoProcess.sourceFormati;
}

// ======= Webview in a dialog =======
const bOpt1 = document.getElementById("bOpt1Advanced");
const bOpt2 = document.getElementById("bOpt2Advanced");
var lastSelections = [];

/// Rimette i due bottoni grossi al loro aspetto normale: Conteggio a sinistra, Impagina a
/// destra.
///
/// Serve dopo che initDocumentInLavorazione li ha cambiati per una lavorazione di tipo 2,
/// che di bottoni ne mostra uno solo.
///
/// DA SPOSTARE (task di divisione): in filtri.js con getFiltroButtonMarkup.
function setFiltroButtonsDefaultMarkup() {
    if (bOpt1 != null) {
        bOpt1.innerHTML = getFiltroButtonMarkup('conteggio.png', 'Conteggio');
    }
    if (bOpt2 != null) {
        bOpt2.innerHTML = getFiltroButtonMarkup('impagina.png', 'Impagina');
    }
}





/// I20-980: il dialogo di scelta file puo' aprirsi su un punto preciso, di norma la foto che
/// si sta sostituendo dentro la cartella Links della lavorazione.
///
/// Niente di tutto questo puo' impedire di scegliere un file a mano: se il percorso non si
/// risolve si ripiega sulla cartella che lo contiene, e se non si risolve nemmeno quella il
/// dialogo si apre come si e' sempre aperto.
async function puntoDiAperturaFile(percorso) {
    var url = schedaRef.urlDiPercorso(percorso);
    if (url == null) {
        return undefined;
    }

    try {
        //Il file si risolve e viene passato, ma il dialogo di sistema ne usa solo la cartella:
        //si apre nel posto giusto senza selezionare la foto. Verificato in esercizio su Mac
        //con InDesign 19 (I20-980).
        return { initialLocation: await storage.localFileSystem.getEntryWithUrl(url) };
    }
    catch (e) {
        //Il file puo' non esserci piu': rinominato, spostato, o mai arrivato in cartella.
        console.log("Punto di apertura non risolto, si prova la cartella: " + e);
    }

    var urlCartella = schedaRef.urlDiPercorso(schedaRef.cartellaDiPercorso(percorso));
    if (urlCartella == null) {
        return undefined;
    }

    try {
        return { initialLocation: await storage.localFileSystem.getEntryWithUrl(urlCartella) };
    }
    catch (e) {
        console.log("Cartella di apertura non risolta: " + e);
        return undefined;
    }
}

/// Apre il dialogo di sistema per scegliere un file e ne restituisce nome, percorso e
/// contenuto binario. Se l'operatore annulla, restituisce undefined.
///
/// Il punto in cui si apre lo decide puntoDiAperturaFile qui sopra: di norma la cartella
/// della foto che si sta sostituendo, cosi' non si parte ogni volta dalla home.
async function selectFile(percorsoDiPartenza = null) {
    // Ottieni il file tramite un dialogo
    const fileEntry = await storage.localFileSystem.getFileForOpening(
        await puntoDiAperturaFile(percorsoDiPartenza));
    if (!fileEntry) {
        console.log("Nessun file selezionato");
        return;
    }
    else {
        const fileContents = await fileEntry.read({ format: storage.formats.binary });

        // Ora puoi utilizzare i byte del file per ulteriori operazioni
        console.log("Bytes del file:", fileContents);
        console.log("File selezionato: " + fileEntry);
        console.log("File selezionato: " + fileEntry.nativePath);
        var fd = {
            nomeFile: fileEntry.name,
            file: fileContents,
            filePath: fileEntry.nativePath
        }
        return fd;
    }
}


/// Conta senza impaginare: chiama conteggiaImpagina(false). Attaccata al bottone di
/// sinistra di index.html.
function conteggia() {
    conteggiaImpagina(false);
}

if (bOpt2 != null){
    bOpt2.onclick = async () => {
        const conferma = await Modali.confirm("Confermi l'impaginazione?");
        if (conferma) {
            impagina();
        }
    };
}

/// Impagina davvero: chiama conteggiaImpagina(true). Attaccata al bottone di destra, che
/// prima chiede conferma - e' l'operazione che modifica il documento.
function impagina() {
    console.log("Impagino (modalita standard)");
    conteggiaImpagina(true);
}

/// Avvia l'impaginazione di tutti i file del libro, mettendoli in coda uno dietro l'altro.
///
/// E' il gemello di esportaLibro sul lato impaginazione: stessa coda, stesso stato su
/// disco, stessa possibilita' di riprendere. Prepara jobImpaginazioneLibro e poi lascia
/// fare a impaginaLibroTask, che si richiama per ogni file.
async function impaginaLibro() {
    //Controllo se il libro è effettivamente attivo
    if (libroInLavorazione == null) {
        messaggioUtente("Code IDX-08 Nessun libro aperto", "Error", false, 5);
        return;
    }
    console.log("Impagino il libro: " + libroInLavorazione.name);
    //Prendo da lavorazioni.json i file associati a questo libro
    let _libroFilePath = await libroInLavorazione.filePath; 
    let _pathLavorazioneLibro = _libroFilePath.nativePath;
    
    var file = readFile(_pathLavorazioneLibro + "/lavorazioni.json");
    if (file == null) {
        messaggioUtente("Code IDX-09 Impaginazione libro: Nessuna lavorazione associata al libro", "Error", false, 5);
        return;
    }

    //Loading

    setTimeout(function () {
        showLoading("Inizializzazione massiva in corso");

    }, 100);


    let _filesDaImpaginare = file.filter(f => f.file.endsWith(".indd"));
    console.log("File da impaginare: ");
    console.log(_filesDaImpaginare);
    indesignEvents.setBusy(true);

    jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();

    if (jobImpaginazioneLibro==null)
    {
        jobImpaginazioneLibro={};

        jobImpaginazioneLibro.stato=0;//1;//In lavorazione 2//completato
        jobImpaginazioneLibro.index=-1;
        jobImpaginazioneLibro.queue=[];
    }

    for (let i = 0; i < libroInLavorazione.bookContents.length; i++) 
    {
        let fileInBook = libroInLavorazione.bookContents.item(i);
        let fileInBookFullname = await fileInBook.fullName;
        let fileInBookNativePath = fileInBookFullname.nativePath;
        let sep = Utility.getDirSeparator();
        let nomeFileInBook = fileInBookNativePath.substring(fileInBookNativePath.lastIndexOf(sep) + 1);

        let _file = _filesDaImpaginare.find(f => f.file == nomeFileInBook);
        if (_file==null) {
            //Questo file non è da impaginare
            console.log("Il file " + nomeFileInBook + " non è da impaginare, salto.");
            continue;
        }

        //Controllo se essite gia
        let _esistente = jobImpaginazioneLibro.queue.find(j=>j.docName==nomeFileInBook);
        if (_esistente==null)
        {
            jobImpaginazioneLibro.queue.push({ pathLavorazione: _pathLavorazioneLibro, docName: nomeFileInBook, lastItem:{}});
        }       
        
    }

    //Possiamo far partire il job
    if (jobImpaginazioneLibro.queue.length>0)
    {
        jobImpaginazioneLibro.stato=1;
        await registraStatoLavorazioneLibro();
        impaginaLibroTask(0);
    }

    //Li apro uno ad uno e lancio l'impaginazione

}

/// Impagina un file del libro e poi richiama se stessa sul successivo: la ricorsione E' la
/// coda. Finito l'ultimo, lo stato passa a 2 e la coda si svuota.
///
/// Apre il file, lo inizializza come se l'operatore l'avesse aperto a mano, impagina,
/// chiude salvando. L'indice viene scritto su disco PRIMA di cominciare, non dopo: se
/// InDesign muore a meta', al riavvio si sa a che punto si era. Un file gia' completo
/// (lastItem.pag == tot) viene saltato senza nemmeno aprirlo.
///
/// La scelta sulle foto si fa una volta sola, al primo file. Col pacchetto completo
/// spuntato si scarica tutto prima di partire; senza, si scaricano solo i loghi - e solo
/// all'indice 0, perche' i loghi sono gli stessi per tutti i file del libro.
///
/// conteggiaImpagina lavora a callback, quindi viene avvolta in una Promise per poterla
/// aspettare. Il terzo argomento e' la pagina da cui riprendere.
async function impaginaLibroTask(indice)
{
    //Blocco gli events
    indesignEvents.setBusy(true);
    let bindData =  jobImpaginazioneLibro.queue[indice];

    if (bindData.lastItem!=null)
    {
        if (Number(bindData.lastItem.pag)==bindData.tot)
        {
            //Gia completato
            indice++;
            if (indice < jobImpaginazioneLibro.queue.length) {

                impaginaLibroTask(indice);
                return;
            }
            else {
                hideLoading();
                indesignEvents.setBusy(false);
                jobImpaginazioneLibro.stato=2;
                await registraStatoLavorazioneLibro();

                setTimeout(function () {
                    hideLoading();
                }, 100);

                messaggioUtente("Code IDX-10 Impaginazione libro completata", "success", false, 10);

                return;
            }

        }
    }

    jobImpaginazioneLibro.index=indice;
    await registraStatoLavorazioneLibro();

    let _pathLavorazioneLibro = bindData.pathLavorazione;
    let nomeFileInBook = bindData.docName;

    let fullFilePath = _pathLavorazioneLibro + Utility.getDirSeparator() + nomeFileInBook;
    console.log("Apro il file: " + fullFilePath);

    app.open(fullFilePath);


    //await Utility.sleep(500);
    console.log("Inizio impaginazione 2...");
    //Inizializzo lavorazione file che mi imposta il documento e il path di lavorazione
    docInLavorazione = app.activeDocument;
    await initDocumentInLavorazione();

    async function _processJob()
    {
        // //await Utility.sleep(500);
        console.log("Impaginazione file " + nomeFileInBook );
        
        setTimeout(function () {
            showLoading("Impaginazione file " + nomeFileInBook );

        }, 100);


        const esitoImpaginazione = await new Promise(function (resolve) {
            conteggiaImpagina(
                true,
                function (msg) {
                    resolve(msg);
                },
                bindData != null && bindData.lastItem != null && bindData.lastItem.pag != null ? Number(bindData.lastItem.pag) : 0
            );
        });

        console.log("Impaginazione file " + nomeFileInBook + " terminata: " + esitoImpaginazione);
        console.log("Finalizzo impaginazione...");
        app.activeDocument.close(SaveOptions.YES);
        await registraStatoLavorazioneLibro();

        //Chiamo il task successivo
        indice++;
        if (indice < jobImpaginazioneLibro.queue.length)
        {
            impaginaLibroTask(indice);
        }
        else
        {
            jobImpaginazioneLibro.stato = 2;
            await registraStatoLavorazioneLibro();
            //Ho finito tutto
            hideLoading();
            indesignEvents.setBusy(false);
            jobImpaginazioneLibro.stato = 2;
            jobImpaginazioneLibro.queue = [];
        }
    }

    if (!$("#chPacchettoFotoPerImpaginazioneMassiva").is(":checked") && indice==0)
    {
        setTimeout(function () {
            showLoading("Scaricamento loghi...");
        }, 100);
        //Sci scaricano solo i loghi per cui va fatto una volta soltanto quindi al primo indice
        ReperimentoFoto.avviaSyncPacchettoFoto(1, function(){
            _processJob();
        })
    }
    else
    {
        if ($("#chPacchettoFotoPerImpaginazioneMassiva").is(":checked"))
        {

            setTimeout(function () {
                showLoading("Scaricamento pacchetto foto completo...");
            }, 100);

            ReperimentoFoto.avviaSyncPacchettoFoto(0, function(){
                _processJob();
            });            
        
        }
        else
        {
            _processJob();
        }
    }


    //await Utility.sleep(500);


}

/// Rilegge da disco lo stato del libro: <nomeLibro>_register.json, nella cartella del
/// libro. Restituisce null se il file non c'e' ancora.
///
/// E' questo file che rende ripartibili impaginazione ed esportazione: tiene lo stato, la
/// coda dei documenti e, per ognuno, l'ultima pagina andata a buon fine.
async function leggiStatoLavorazioneLibro()
{
    let _libroFilePath = await libroInLavorazione.filePath; 
    let _pathLavorazioneLibro = _libroFilePath.nativePath;
    let filePath=_pathLavorazioneLibro+Utility.getDirSeparator()+libroInLavorazione.name+"_register.json";
    let file = readFile(filePath);

    return file;
}

/// Scrive su disco jobImpaginazioneLibro, nello stesso file che legge
/// leggiStatoLavorazioneLibro.
///
/// Viene chiamata dopo ogni passo - non a fine operazione - ed e' proprio quello a renderle
/// riprendibili: quello che c'e' nel file e' sempre quello che e' gia' stato fatto.
///
/// La riga "file== readFile(filePath)" e' un doppio uguale al posto di un uguale: e' un
/// confronto che non assegna niente. Non fa danno perche' quella variabile non viene poi
/// letta, ma e' un refuso.
async function registraStatoLavorazioneLibro()
{
    let _libroFilePath = await libroInLavorazione.filePath; 
    let _pathLavorazioneLibro = _libroFilePath.nativePath;
    let filePath=_pathLavorazioneLibro+Utility.getDirSeparator()+libroInLavorazione.name+"_register.json";

    let file = readFile(filePath);
    if (file == null)
    {
        //errore, il file dovrebbe esistere
        //messaggioUtente("Errore: File lavorazioni.json non trovato", "error");
        //return;
        appendToFile(filePath, "");
        file== readFile(filePath);
    }

    fs.writeFileSync(filePath, JSON.stringify(jobImpaginazioneLibro));

}

/// Toglie dal documento tutti i loghi e i bolli messi in cache e svuota la cache.
///
/// I loghi vengono piazzati durante l'impaginazione e tenuti da parte per riusarli: quando
/// l'operazione finisce, o ricomincia, quelli rimasti in giro vanno rimossi, altrimenti si
/// sommano a quelli del giro successivo.
///
/// DA SPOSTARE (task di divisione): nel js delle foto. E' gestione di immagini piazzate,
/// non interfaccia.
function rimuoviSimboli() {
    for (var key in cacheLoghi) {
        if (cacheLoghi[key] != null && cacheLoghi[key].isValid) {
            cacheLoghi[key].remove();
        }
    }
    cacheLoghi = {};
}

/// L'idRec di un record, da qualunque delle forme in cui arriva: idRec, IdRec, o la chiave
/// letterale "idRec".
///
/// I record passano da Istanta, dal file su disco e dalle etichette del documento, e lungo
/// la strada le maiuscole non si conservano. Questa funzione esiste per non dover ricordare
/// ogni volta quale delle tre forme ha in mano chi chiama.
///
/// DA SPOSTARE (task di divisione): questa e le cinque qui sotto sono l'identita' di una
/// referenza - come si legge, come si scrive in un'etichetta, come si confronta. Le usa
/// anche griglia.js. Starebbero in un js loro, o in utility.js.
function getIdRecFromItemRef(itemRef) {
    if (itemRef == null) {
        return null;
    }

    if (itemRef.idRec != null) {
        return parseInt(itemRef.idRec);
    }

    if (itemRef.IdRec != null) {
        return parseInt(itemRef.IdRec);
    }

    if (itemRef["idRec"] != null) {
        return parseInt(itemRef["idRec"]);
    }

    return null;
}

/// Il codice gruppo di un record: "Scatto.CodiceGruppo" se c'e', altrimenti "codice".
/// Stringa vuota se non c'e' nessuno dei due.
///
/// Due nomi per la stessa cosa, come per getIdRecFromItemRef: il primo e' come arriva dal
/// tracciato, il secondo come lo scrive il Plugin.
function getCodiceGruppoFromItemRef(itemRef) {
    if (itemRef == null) {
        return "";
    }

    if (itemRef["Scatto.CodiceGruppo"] != null) {
        return itemRef["Scatto.CodiceGruppo"].toString();
    }

    if (itemRef.codice != null) {
        return itemRef.codice.toString();
    }

    return "";
}

/// Costruisce l'etichetta con cui un elemento del documento dichiara a quale referenza
/// appartiene: "codice_associato$<codice>$<idRec>".
///
/// Ci vogliono entrambi. Il codice gruppo da solo non basta, perche' la stessa referenza
/// puo' comparire piu' volte nella stessa lavorazione: e' l'idRec a dire quale.
///
/// Lancia invece di restituire vuoto: un'etichetta sbagliata non si nota, e lega
/// l'elemento alla referenza sbagliata per sempre.
function makeCodiceAssociatoLabel(codice, idRec) {
    if (codice == null || codice === "") {
        throw new Error("Codice gruppo mancante per codice_associato");
    }

    if (idRec == null || isNaN(parseInt(idRec))) {
        throw new Error("idRec mancante per codice_associato: " + codice);
    }

    return "codice_associato$" + codice.toString() + "$" + parseInt(idRec);
}

/// Da un record ricava la coppia {codice, idRec} che lo identifica, usando le due funzioni
/// qui sopra. Lancia se manca uno dei due.
///
/// E' la chiave con cui il Plugin riconosce una referenza in ogni elenco: esclusi, filtri,
/// griglia.
function makeCodiceFiltroFromItemRef(itemRef) {
    var codice = getCodiceGruppoFromItemRef(itemRef);
    var idRec = getIdRecFromItemRef(itemRef);

    if (codice == null || codice === "") {
        throw new Error("Codice gruppo mancante nel record");
    }

    if (idRec == null || isNaN(idRec)) {
        throw new Error("idRec mancante per il codice gruppo " + codice);
    }

    return {
        codice: codice,
        idRec: parseInt(idRec)
    };
}

/// Dice se due coppie {codice, idRec} indicano la stessa referenza.
///
/// Il confronto e' esplicito - codice come stringa, idRec come intero - perche' le due
/// coppie possono venire da fonti diverse: una letta da JSON, l'altra costruita in memoria,
/// e li' un 12 e un "12" sono la stessa referenza.
function sameCodiceFiltro(a, b) {
    if (a == null || b == null) {
        return false;
    }

    return a.codice != null &&
        b.codice != null &&
        a.codice.toString() === b.codice.toString() &&
        parseInt(a.idRec) === parseInt(b.idRec);
}

/// Aggiunge a una querystring in costruzione i due campi di una coppia
/// {codice, idRec}, nella forma "<rootPath>.<propName>[<i>].codice=...&...idRec=...".
///
/// E' il formato che si aspetta il model binder di ASP.NET dall'altra parte: e' cosi' che
/// un elenco di referenze arriva al server come lista di oggetti invece che di stringhe.
function addCodiceFiltroToReq(req, rootPath, propName, index, codiceFiltro) {
    req += rootPath + "." + propName + "[" + index + "].codice=" + encodeURIComponent(codiceFiltro.codice) + "&";
    req += rootPath + "." + propName + "[" + index + "].idRec=" + encodeURIComponent(codiceFiltro.idRec) + "&";
    return req;
}

var paramsCache = {};
/// IMPAGINAZIONE. L'ingresso: con impagina a false conta soltanto quante referenze ci
/// starebbero, senza toccare il documento.
///
/// Qui non si impagina: si CATTURA IL CONTESTO - documento, percorso, kit - e lo si passa a
/// _conteggiaImpaginaConContesto. L'impaginazione dura minuti, e se nel frattempo l'operatore
/// cambia documento o kit le globali cambiano sotto i piedi dell'operazione in corso.
/// IDX-163 se il documento non e' valido.
async function conteggiaImpagina(impagina = false, cbkEnd = null, restartFromIndexPoP = 0) {
    const documentoImpaginazione = docInLavorazione;
    const pathImpaginazione = pathLavorazione;
    const idKitImpaginazione = idKitLavorazione;

    if (documentoImpaginazione == null || documentoImpaginazione.isValid === false) {
        messaggioUtente("Code IDX-163: il documento non è valido", "error");
        cbkEnd?.("error");
        return;
    }

    return _conteggiaImpaginaConContesto(
        documentoImpaginazione,
        pathImpaginazione,
        idKitImpaginazione,
        impagina,
        cbkEnd,
        restartFromIndexPoP
    );
}

/// IMPAGINAZIONE. Il motore: chiede a Istanta quali gruppi vanno in quali box e, per ognuno,
/// chiama impaginaBox. E' la funzione piu' lunga del Plugin, 1.798 righe.
///
/// ATTENZIONE ai nomi dei parametri: docInLavorazione, pathLavorazione e idKitLavorazione
/// OMBREGGIANO DELIBERATAMENTE le globali omonime. Dentro questa funzione quei nomi sono il
/// contesto fissato all'avvio da conteggiaImpagina, non le variabili di modulo. E' cosi' che il
/// codice interno, scritto quando le globali si usavano direttamente, lavora su un contesto
/// stabile senza essere stato riscritto.
/// I20-1038: dove si era quando l'elaborazione del filtro e' fallita: la pagina del risultato
/// in lavorazione e, se si era gia' nel ciclo dei box, la ref (codice gruppo e inizio della
/// descrizione). "Object is invalid" da solo non dice niente, e il log non ha lo stack.
/// Non lancia mai: la chiama un catch.
function contestoErroreFiltro(filtroResult, itemRef) {
    var parti = [];
    try {
        if (filtroResult != null && filtroResult.pag != null) {
            parti.push("pagina " + filtroResult.pag);
        }
        if (itemRef != null) {
            var codice = itemRef["Scatto.CodiceGruppo"] != null ? itemRef["Scatto.CodiceGruppo"] : itemRef["Referenza.Codice"];
            var descr = itemRef["Descrizioni.Descrizione1"] != null ? String(itemRef["Descrizioni.Descrizione1"]).substring(0, 40) : "";
            parti.push("ref " + codice + (descr !== "" ? " (" + descr + ")" : ""));
        }
    }
    catch (e) {
        //il contesto e' un aiuto: se non si legge, si va avanti senza
    }
    return parti.length > 0 ? parti.join(", ") : "prima del primo risultato";
}

/// I20-1038: la griglia da piazzare dalla libreria InDesign: prima con il lato (_SX/_DX), poi
/// senza. Se la libreria ha piu' asset con quel nome lo dice (IDX-170): InDesign prende il primo.
/// Se non ne ha nessuno lo dice a chi fa le librerie e ferma l'impaginazione (IDX-169): prima
/// placeAsset su un asset inesistente dava "Object is invalid", senza nome ne' libreria.
/// L'eccezione e' marcata giaSegnalato, cosi' il catch IDX-27 non la ripete all'operatore.
function grigliaDallaLibreria(libreria, nomeGriglia, suffix, pagina) {
    var nomi = [nomeGriglia + suffix, nomeGriglia];
    for (var i = 0; i < nomi.length; i++) {
        var nome = nomi[i];
        var asset = libreria.assets.itemByName(nome);
        if (asset != null && asset.isValid) {
            var omonimi = 0;
            try {
                omonimi = libreria.assets.everyItem().getElements().filter(function (a) { return a.name === nome; }).length;
            }
            catch (e) {
                omonimi = 0;
            }
            if (omonimi > 1) {
                messaggioUtente("Code IDX-170 Filtro: nella libreria '" + libreria.name + "' ci sono " + omonimi + " asset chiamati '" + nome + "': il Plugin usa il primo, i doppioni vanno tolti dalla libreria", "warning");
            }
            return asset;
        }
    }
    var messaggio = "Code IDX-169 Filtro: nella libreria '" + libreria.name + "' manca la griglia '" + nomi[0] + "' (cercata anche come '" + nomi[1] + "'), richiesta dal server per la pagina " + pagina + ". L'impaginazione si ferma: la libreria va completata con l'asset mancante e l'impaginazione rifatta";
    messaggioUtente(messaggio, "error");
    var errore = new Error(messaggio);
    errore.giaSegnalato = true;
    throw errore;
}

async function _conteggiaImpaginaConContesto(docInLavorazione, pathLavorazione, idKitLavorazione, impagina = false, cbkEnd = null, restartFromIndexPoP = 0) {
    var noCacheCheck = !($("#cacheCheckAdvanced").is(":checked"));

    Modali.chiudiModal();

    CssFramework.richiediDiScaricareFramework();

    var reportImpaginazioneObj = { segnalazioni: [] };
    let tipo_lavorazione_corrente = ficoProcess.getTipoLavorazioneCorrente();

    try {
        var libreria = pluginMiddleware.getLibreria();
        if (libreria == null && tipo_lavorazione_corrente == 2){ //in questo caso saltiamo, non ci serve per forza una libreria perchè siamo in pop
        }
        else if (libreria == null || !libreria.isValid) {
            var nomeLibreria = "";
            if (nomeLibreria == null) {
                nomeLibreria = pluginMiddleware.getCampo("nomeLibreriaIndd");
            }
            if (ficoProcess.getTipoLavorazioneCorrente() == 1 && app.libraries.length == 0) {
                if (nomeLibreria) {
                    messaggioUtente("Code IDX-11 Filtro: Non è stata caricata la libreria " + nomeLibreria, "Error", false, 5);
                }
                else {
                    messaggioUtente("Code IDX-12 Filtro: Non è stata caricata nessuna libreria", "Error", false, 5);
                }
                hideLoading();

                cbkEnd?.("error");

                return;
            }
            else if (nomeLibreria) {
                libreria = app.libraries.itemByName(nomeLibreria);
            }
            else if (app.libraries.length == 1) {
                libreria = app.libraries.item(0);
            }

            if (libreria == null || !libreria.isValid) {
                if (nomeLibreria) {
                    messaggioUtente("Code IDX-13 Filtro: Non è stata trovata la libreria " + nomeLibreria, "Error", false, 5);
                }
                else if (app.libraries.length > 1) {
                    messaggioUtente("Code IDX-14 Filtro: Sono caricate librerie multiple, chiudere tutte le librerie eccetto quella di impaginazione prima di procedere", "Error", false, 5);
                }
                else {
                    messaggioUtente("Code IDX-15 Filtro: Non è stata trovata la libreria", "Error", false, 5);
                }
                hideLoading();
                cbkEnd?.("error");
                return;
            }
        }
    }
    catch (ex) {
        messaggioUtente("Errore durante il recupero della libreria: " + ex.message, "Error", false, 5); 
        hideLoading();
        cbkEnd?.("error");
        return;
    }




    if (tipo_lavorazione_corrente== 1) {


        showLoading(impagina ? "Leggo i filtri per l'impaginazione" : "Leggo i filtri per il conteggio");
        await Utility.sleep(100);
        indesignEvents.setBusy(true);

        //disattiviamo gli sp-button bOpt1 e bOpt2 per evitare doppie richieste, per farlo impostiamo un attr chiamato disabled a true    
        bOpt1.disabled = true;
        bOpt2.disabled = true;
        //cambiamo il testo del bottone bOpt1 in "Elaborazione..." se impagina è false altrimenti cambiamo il testo del bottone bOpt2 in "Elaborazione..."


        if (!impagina) {
            bOpt1.text = "Elaborazione...";
        }
        else {
            bOpt2.text = "Elaborazione...";
        }

        //leggiamo il val di pagineRange e creiamo un array di pagine da elaborare
        //facciamo prima uno split per , poi per ogni elemento facciamo uno split per - e creiamo un array di pagine
        var pagine = [];
        pagine = docInLavorazione.pages.everyItem().getElements().map(function (p) {
            return parseInt(p.name);
        });


        let mappa = null;

        console.log(pagine);

        //cicliamo tutti i gruppi con layer FILTRO o GRIGLIA in tutte le pagine e se l'item è non visibile si rimuove
        //facciamo una lista di pages composta dalle pagine contenute in pagine
        var pages = docInLavorazione.pages.everyItem().getElements().filter(function (p) {
            return pagine.includes(parseInt(p.name));
        });



        ////DISATTIVATA IN DATA 17/11/25 PERCHè CAUSA UN CRASH DI INDESIGN QUANDO IN MC SI HANNO DUE GRIGLIE ADIACENTI DA RIMUOVERE (MOTIVI IGNOTI)        
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            let arrGroups = page.groups;

            for (var j = 0; j < arrGroups.length; j++) {
                var item = arrGroups.item(j);
                if (/*item.itemLayer.name == "FILTRO" || */ item.itemLayer.name == "GRIGLIA") {
                    if (!item.visible) {
                        item.remove();
                    }
                }
            }
        }
        

        await Utility.sleep(100);
        var debug = "riga try";
        try {

            paramsCache = {};
            var req = "";
            var filterIndex = 0;
            if (docInLavorazione != null) {
                var listaRefEscluse = readFile(pathLavorazione + "/listaRefEscluse.json");
                var filtriJson = readFile(filtriJs.getNomeFileFiltriJson());

                var pagineRange = "";
                //leggiamo filtriJson e formiamo la stringa del pagineRange
                if (filtriJson != null && filtriJson.source != null && filtriJson.source.length > 0) {
                    for (var i = 0; i < filtriJson.source.length; i++) {
                        var f = filtriJson.source[i];
                        if ((f.active) && f.pagina != null && f.pagina != "") {
                            if (pagineRange != "") {
                                pagineRange += ",";
                            }
                            pagineRange += f.pagina;
                        }
                    }
                }

                showLoading("Chiamata a istanta in corso, l'operazione potrebbe richiedere un po' di tempo");

                let lastFiltroJson = null;
                let ordineFiltri = 0;
                for (var $p = 0; $p < pages.length; $p++) {
                    var pItem = pages[$p];


                    //cerchiamo il filtro per la pagina corrente
                    let filtroPage = filtriJson.source.find(f => f.pagina == pItem.name);
                    if(filtroPage.blocco){
                        lastFiltroJson = null;
                    }
                    else if ((filtroPage.active) && filtroPage.filtri != null && filtroPage.filtri.length > 0) {
                        lastFiltroJson = filtroPage.filtri;
                    }
                    else if (!filtroPage.active && filtroPage.filtri != null && filtroPage.filtri.length > 0) {
                        lastFiltroJson = null;
                        continue;
                    }
                    else if (lastFiltroJson != null){
                        //pagina libera
                    }
                    else {
                        continue;
                    }
                    //console.log("page " + ($p+1));

                    var debug = "pages.lenght";

                    if (pagine.length > 0 && !pagine.includes(parseInt(pItem.name))) {
                        continue;
                    }

                    //leggiamo in var listaRefEscluse = readFile(pathLavorazione + "/listaRefEscluse.json");
                    //cerchiamo se la pagina corrente è presente in listaRefEscluse
                    //se c'è prendiamo tutti i codici gruppo degli elementi in listaEscluse e li mettiamo in un array

                    var listaRefEscluseArray = [];
                    if (listaRefEscluse != null) {
                        var pagEscluse = listaRefEscluse.find(f => f.Pag == pItem.name);
                        if (pagEscluse != null) {
                            var refEscluse = pagEscluse.listaEscluse;
                            for (var $r = 0; $r < refEscluse.length; $r++) {
                                listaRefEscluseArray.push(makeCodiceFiltroFromItemRef(refEscluse[$r]));
                            }
                        }
                    }
                    var allElementsInPages = pItem.allPageItems;

                    var pagina_bloccata = false;
                    var rootPath = "Filters[" + filterIndex + "]";
                    var listCodiciRichiestiInPagina = [];
                    for (var $e = allElementsInPages.length - 1; $e >= 0; $e--) {
                        var debug = "allElementsInPages.lenght";

                        var elItem = allElementsInPages[$e];

                        //console.log("el " + elItem.label);

                        //se elItem è un gruppo
                        if (elItem.constructor.name == "Group") {
                            // if (elItem.label.indexOf("filtro") >= 0 || elItem.label == "stato_locked" || elItem.label == "box_conteggio") {
                            //     //se il layer non è FILTRO lo spostiamo in filtro
                            //     if (elItem.itemLayer.name != "FILTRO") {
                            //         elItem.itemLayer = docInLavorazione.layers.itemByName("FILTRO");
                            //     }
                            // }
                            // else 
                            if (elItem.label.indexOf("griglia_") >= 0 && elItem.visible) {
                                //se il layer non è GRIGLIA lo spostiamo in griglia
                                if (elItem.itemLayer.name != "GRIGLIA") {
                                    if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                        docInLavorazione.layers.add({ name: "GRIGLIA" });
                                    }
                                    elItem.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                                }
                            }
                        }


                        if (elItem.itemLayer.name == "GRIGLIA" && elItem.visible) {

                            if (elItem.label == "segnalazione_ingombro") {
                                elItem.visible = false;
                            }
                            else if (elItem.label.indexOf("griglia") >= 0) {
                                var formato = elItem.label.split("_")[1];
                                // var formatoGriglia = elItem.label.split("_")[1];
                                // var righe = parseInt(formatoGriglia.split("x")[1]);
                                // var colonne = parseInt(formatoGriglia.split("x")[0]);
                                // var righeGriglia = [];
                                var boxNonTrovato = false;
                                var boxNumber = 1;
                                var listBoxBloccati = [];
                                while (!boxNonTrovato) {
                                    var box = grigliaJs.getBoxByNumber(elItem, boxNumber);
                                    if (box == null || !box.isValid) {
                                        boxNonTrovato = true;
                                        break;
                                    }
                                    else if (box != null && box.isValid) {
                                        if (!impagina) {
                                            var locked = grigliaJs.getVisibilityLabelsBox(box, "lock");
                                            if (!locked) {
                                                grigliaJs.resetCodiceAssociato(box);
                                                var info = grigliaJs.getChildBoxByLabel(box, "info", true);
                                                info.label = "info";
                                                //info.contents = "";
                                                grigliaJs.setContent(info, "");


                                            }
                                            else {
                                                //leggiamo il codice associato se c'è
                                                var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                                if (codiceFiltro != null) {
                                                    listCodiciRichiestiInPagina.push(codiceFiltro);
                                                }
                                            }

                                        }
                                        else {
                                            //leggiamo il codice associato se c'è
                                            var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                            if (codiceFiltro != null) {
                                                listCodiciRichiestiInPagina.push(codiceFiltro);
                                            }
                                        }
                                        var bloccato = grigliaJs.getVisibilityLabelsBox(box, "no");
                                        // var H = grigliaJs.getVisibilityLabelsBox(box, "h");
                                        // var W = grigliaJs.getVisibilityLabelsBox(box, "v");
                                        if (bloccato) {
                                            listBoxBloccati.push(boxNumber);
                                        }
                                    }
                                    boxNumber++;
                                }


                                req += rootPath + ".Griglia.formato=" + formato + "&";
                                for (var $r = 0; $r < listBoxBloccati.length; $r++) {
                                    req += rootPath + ".Griglia.boxOccupati[" + $r + "]=" + listBoxBloccati[$r] + "&";
                                }

                                paramsCache["pag_" + pItem.name] = { griglia: elItem };
                                console.log("Aggiunta griglia per pag " + pItem.name + " ### " + elItem.label);
                            }



                        }
                    }

                    //Se la griglia non è stata trovata controllo la masterSpread assegnata alla pagina
                    //controllo dunque le pagine della masterSpread prendendo la prima se il nome della pagina è pari o la seconda se il nome della pagina è dispari
                    //infine controllo se la pagina ha una label, se c'è quello è il nome della griglia da mettere
                    if(paramsCache["pag_" + pItem.name] == null){
                        var masterSpread = pItem.appliedMaster;
                        if (masterSpread != null && masterSpread.isValid) {
                            var masterPages = masterSpread.pages.everyItem().getElements();
                            if (masterPages.length > 0) {
                                var masterPage = masterPages[parseInt(pItem.name) % 2];
                                if (masterPage != null && masterPage.isValid && masterPage.label != "") {
                                    var masterGriglia = masterPage.label;
                                    //proviamo a cercare in libreria la griglia
                                    var griglia = libreria.assets.itemByName(masterGriglia);
                                    //mettiamo la griglia in pagina
                                    if(griglia != null && griglia.isValid){
                                        let grigliaMastro = griglia.placeAsset(docInLavorazione)[0];
                                        var grigliaObj = grigliaMastro.duplicate(pItem);
                                        var offsetPag = 0;
                                        var wPage = pItem.bounds[3] - pItem.bounds[1];
                                        if (parseInt(pItem.name) % 2 != 0 && parseInt(pItem.name) > 1) {
                                            offsetPag += wPage;
                                        }
                                        grigliaObj.move([offsetPag, 0]);
                                        grigliaMastro.remove();

                                        var formato = grigliaObj.label.split("_")[1];
                                        var boxNonTrovato = false;
                                        var boxNumber = 1;
                                        var listBoxBloccati = [];
                                        while (!boxNonTrovato){
                                            var box = grigliaJs.getBoxByNumber(grigliaObj, boxNumber);
                                            if (box == null || !box.isValid) {
                                                boxNonTrovato = true;
                                                break;
                                            }
                                            else if (box != null && box.isValid) {
                                                if(!impagina){
                                                    var locked = grigliaJs.getVisibilityLabelsBox(box, "lock");
                                                    if (!locked) {
                                                        grigliaJs.resetCodiceAssociato(box);
                                                        var info = grigliaJs.getChildBoxByLabel(box, "info", true);
                                                        info.label = "info";
                                                        grigliaJs.setContent(info, "");
                                                        // info.contents = "";
                                                        // var myColor = docInLavorazione.swatches.item("None");
                                                        // elItem.fillColor = myColor;
                                                    }
                                                    else {
                                                        //leggiamo il codice associato se c'è
                                                        var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                                        if (codiceFiltro != null) {
                                                            listCodiciRichiestiInPagina.push(codiceFiltro);
                                                        }
                                                    }
        
                                                }
                                                else{
                                                    //leggiamo il codice associato se c'è
                                                    var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                                    if (codiceFiltro != null) {
                                                        listCodiciRichiestiInPagina.push(codiceFiltro);
                                                    }
                                                }
                                                var bloccato = grigliaJs.getVisibilityLabelsBox(box, "no");
                                                // var H = grigliaJs.getVisibilityLabelsBox(box, "h");
                                                // var W = grigliaJs.getVisibilityLabelsBox(box, "v");
                                                if(bloccato){
                                                    listBoxBloccati.push(boxNumber);
                                                }
                                            }
                                            boxNumber++;
                                        }
        
                                        // for (var $r = 0; $r < righeGriglia.length; $r++) {
                                        //     var debug = "righeGriglia.lenght";
        
                                        //     var colonne = righeGriglia[$r];
                                        //     for (var $c = 0; $c < colonne.length; $c++) {
                                        //         debug = "colonne.lenght";
        
                                        //         req += rootPath + ".Griglia.Righe[" + $r + "][" + $c + "]=" + colonne[$c] + "&";
                                        //     }
                                        // }
                                        req += rootPath + ".Griglia.formato=" + formato + "&";
                                        for (var $r = 0; $r < listBoxBloccati.length; $r++) {
                                            req += rootPath + ".Griglia.boxOccupati[" + $r + "]=" + listBoxBloccati[$r] + "&";
                                        }
        
                                        paramsCache["pag_" + pItem.name] = { griglia: grigliaObj };
                                        console.log("Aggiunta griglia per pag " + pItem.name + " ### " + grigliaObj.label);
                                    }
                                }
                            }
                        }

                    }

                    if (pagina_bloccata || (filtroPage != null && filtroPage.blocco)) {
                        //Metto nel fitro che questa pagina è bloccata

                        req += rootPath + ".Pag=" + pItem.name + "&" + rootPath + ".Stato=1&"+ rootPath + ".Ordine=" + ordineFiltri + "&";

                        filterIndex++;

                    }
                    else if (filtroPage.filtri.length > 0) {
                        var debug = "filtri_trovati.lenght";
                        //lastFiltroJson = filtroPage.filtri;
                        //Imposto i filtri per questa pagina
                        var filtriList = [];
                        for (var $f = 0; $f < filtroPage.filtri.length; $f++) {
                            var fil = filtroPage.filtri[$f];
                            var validazione_filtro = false;

                            for (var $f2 = 0; $f2 < fil.criteri.length; $f2++) {

                                let crit = fil.criteri[$f2];
                                if(crit.chiave != null && crit.chiave != "" && crit.operatore != null && crit.operatore != "" && crit.valore != null){
                                    validazione_filtro = true;
                                }
                                else{
                                    messaggioUtente("Code IDX-22 Filtro: Errore durante la validazione del filtro: " + crit.chiave + " " + crit.operatore + " " + crit.valore, "error", false, 5);
                                }

                                crit.chiave = encodeURIComponent(crit.chiave);
                                crit.operatore = getOperatoreEnumValue(crit.operatore);
                                crit.valore = encodeURIComponent(crit.valore);
                            }

                            filtriList.push(fil);
                        }

                        if (validazione_filtro) {
                            ordineFiltri = filtroPage.ordine;
                            req += rootPath + ".Pag=" + pItem.name + "&" + rootPath + ".Stato=2&" + rootPath + ".Ordine=" + ordineFiltri + "&";

                            for (var $f = 0; $f < filtriList.length; $f++) {
                                var debug = "filtriList.lenght";

                                var inxCriterio = 0;
                                var fil = filtriList[$f];
                                req += rootPath + ".listFiltri[" + $f + "].Ordine=" + fil.ordine + "&" + rootPath + ".listFiltri[" + $f + "].Limite=" + fil.limite + "&";
                                for (var $c = 0; $c < fil.criteri.length; $c++) {
                                    var debug = "criteri.lenght";

                                    var criterio = fil.criteri[$c];
                                    if (criterio.chiave != null && criterio.chiave != "") {
                                        var stringPath = rootPath + ".listFiltri[" + $f + "].Criteri[" + inxCriterio + "]";
                                        req += stringPath + ".Chiave=" + criterio.chiave + "&" + stringPath + ".Operatore=" + criterio.operatore + "&" + stringPath + ".Valore=" + criterio.valore + "&";

                                        inxCriterio++;

                                    }
                                }
                                // if (customAgenzia.applyCustomFilter != null) {
                                //     req += customAgenzia.applyCustomFilter(pItem, rootPath, $f, inxCriterio);
                                // }

                            }

                            filterIndex++;
                        }
                    }
                    else if (lastFiltroJson != null && (filtroPage == null || (filtroPage != null && filtroPage.filtri.length == 0))) {
                        //Pagina vuota senza destinazione
                        req += rootPath + ".Pag=" + pItem.name + "&" + rootPath + ".Stato=2&" + rootPath + ".Ordine=" + ordineFiltri + "&";

                        filterIndex++;
                    }
                    else {
                        messaggioUtente("Code IDX-23 Filtro: Non è stato trovato un filtro per la pagina " + pItem.name, "warning", false, 5);
                        req += rootPath + ".Pag=" + pItem.name + "&" + rootPath + ".Stato=2&";
                        //Pagina vuota senza destinazione
                    }

                    //se la pagina non è bloccata aggiungo alla req i codici richiesti
                    if (!pagina_bloccata && listCodiciRichiestiInPagina.length > 0) {
                        for (var $cf = 0; $cf < listCodiciRichiestiInPagina.length; $cf++) {
                            req = addCodiceFiltroToReq(
                                req,
                                rootPath,
                                "codiciForzatiConId",
                                $cf,
                                listCodiciRichiestiInPagina[$cf]
                            );
                        }
                    }

                    //aggiungiamo le refEscluse alla req
                    if (listaRefEscluseArray.length > 0) {
                        for (var $r = 0; $r < listaRefEscluseArray.length; $r++) {
                            req = addCodiceFiltroToReq(
                                req,
                                rootPath,
                                "codiciEsclusiConId",
                                $r,
                                listaRefEscluseArray[$r]
                            );
                        }
                    }

                }

                var canale = ficoProcess.getCanaleLavorazioneCorrente();
                var siglaCanale = null;
                if(canale != null && canale != ""){
                    siglaCanale = canale.sigla;
                }
                //leggiamo dalla libreria tutti gli oggetti presenti. I nomi sono in questi possibili formati:
                //formato (es=> 4x4)
                //formato_canale (es=> 4x4_SS o 4x4_SC)
                //formato_canale-canale-* (es=> 4x4_SS-SC o 4x4_SS-SC-CN-CY)
                //formato_canale_latoPagina (es=> 4x4_SS_SX o 4x4_SC-SS_DX)

                //noi dobbiamo mettere da parte in lista i nomi di tutte le griglie che:
                //facendo split by (_) hanno lenght 1 (ovvero quelle solo formato)
                //quelle il cui canale è incluso nella lista di canali del nome griglia (es=> siamo nel canale SS le griglie 2x2_SS o 4x4_SS-SC vanno bene poichè contengono tra i canali (split by _ o -) il canale SS, mentre 4x4_SC no poichè non contiene SS)
                //quelle il cui canale è XX (ovvero qualsiasi canale)
                //alla fine avremo una lista di nomi griglia a cui dobbiamo togliere le indicazioni di pagina, poi facciamo un hash per rimuovere duplicati
                var griglieDisponibili = [];
                var griglieInLibreria = libreria.assets.everyItem().getElements();
                for (var $g = 0; $g < griglieInLibreria.length; $g++) {
                    var elGriglia = griglieInLibreria[$g];
                    var nameSplit = elGriglia.name.split("_");
                    if (nameSplit.length == 0){
                        continue;
                    }

                    if (nameSplit[0].indexOf("x") >= 1) {
                        if (nameSplit.length == 1) {
                            if (griglieDisponibili.findIndex(g => g.formato == nameSplit[0]) < 0) {
                                griglieDisponibili.push({nomeGriglia: nameSplit[0], formato: nameSplit[0]});
                            }
                        }
                        else {
                            var canaliGriglia = nameSplit[1].split("-");
                            if (siglaCanale != null && (canaliGriglia.includes(siglaCanale) || canaliGriglia.includes("XX"))) {
                                if (griglieDisponibili.findIndex(g => g.formato == nameSplit[0]) < 0) {
                                    griglieDisponibili.push({ nomeGriglia: nameSplit[0] + "_" + nameSplit[1], formato: nameSplit[0] });
                                }
                            }
                        }
                    }
                }

                if (griglieDisponibili.length == 0) {
                    //cicliamo tutte le pagine e cerchiamo nei paramCache se tutte hanno già una griglia assegnata forzata
                    let throwError = false;
                    for (var $p = 0; $p < pages.length; $p++) {
                        var pItem = pages[$p];
                        if (pagine.length > 0 && !pagine.includes(parseInt(pItem.name))) {
                            continue;
                        }

                        if (paramsCache["pag_" + pItem.name] == null) {
                            throwError = true;
                            break;
                        }
                    }
                    if (throwError) {
                        messaggioUtente("Code IDX-164: Nessuna griglia valida trovata, ricontrollare la libreria " + libreria.name, "error", false, 10);
                        hideLoading();
                        indesignEvents.setBusy(false);
                        return;
                    }
                }

                for (var $g = 0; $g < griglieDisponibili.length; $g++) {
                    req += "GriglieValide[" + $g + "].nomeGriglia=" + griglieDisponibili[$g].nomeGriglia + "&";
                    req += "GriglieValide[" + $g + "].formato=" + griglieDisponibili[$g].formato + "&";
                }
            }
            else{
                messaggioUtente("Code IDX-163: il documento non è valido", "error");
            }

            if (xhrInProcess != null)
                xhrInProcess.abort(impagina ? "Nuova impaginazione avviata" : "Nuovo conteggio avviato");

            xhrInProcess = new XMLHttpRequestClient();
            xhrInProcess.descrizione = impagina ? "Calcolo dell'impaginazione" : "Calcolo del conteggio";
            xhrInProcess.onload = async (objResult, parsed) => {

                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>RISULTATO FILTRO CONTEGGIO");
                console.log(objResult);
                clearFile(pathLavorazione + "/log.txt");
                var logFilePath = pathLavorazione + "/log.txt";
                var logContent = "";
                var currentDate = new Date();
                logContent += currentDate.toLocaleDateString() + " alle " + currentDate.toLocaleTimeString() + " operazione di " + (impagina ? "impaginazione" : "conteggio") + " iniziata\n";
                try {
                    try {
                        if (!parsed) {
                            objResult = JSON.parse(objResult);
                        }
                        console.log(objResult);
                    }
                    catch (e) {
                        console.log(e);
                        messaggioUtente("Code IDX-24 Filtro: Errore durante il parsing della risposta:" + objResult, "error");
                        logContent += "Code IDX-24 Filtro: Errore durante il parsing della risposta:" + objResult + "\n";
                        cbkEnd?.("error");
                        return;
                    }

                    if(objResult.error != null && objResult.error != ""){
                        messaggioUtente("Code IDX-25 Filtro: Errore durante l'elaborazione del filtro: " + objResult.error, "error");
                        logContent += "Code IDX-25 Filtro: Errore durante l'elaborazione del filtro: " + objResult.error + "\n";
                        cbkEnd?.("error");
                        return;
                    }
                    else if (objResult.result.length == 0) {
                        messaggioUtente("Code IDX-26 Filtro: Operazione riuscita ma nessun elemento è stato trovato tra i non impaginati con i filtri impostati", "warning");
                    }

                    var boxInGriglia = null;
                    var grigliaObj = null;
                    var mappaGriglia = null;

                    if (!impagina) {
                        showLoading("Compilazione del risultato di conteggio");
                        await Utility.sleep(100);
                        //var boxConteggioTemplate = libreria.assets.itemByName("Box Conteggio").placeAsset(docInLavorazione)[0];
                        var filePath = pathLavorazione + "/listaRefConteggio.json";
                        clearFile(filePath);
                        logContent += "ripulisco la lista di ref avanzate\n ";
                        let date = new Date().toLocaleString('it-IT')
                        for (var $r = 0; $r < objResult.result.length; $r++) {
                            var filtroResult = objResult.result[$r];
                            itemRef = null; //I20-1038: il contesto di IDX-27 non deve mostrare la ref della pagina prima

                            var pagCoinvolta = docInLavorazione.pages.itemByName(filtroResult.pag.toString());
                            // var pagCoinvolta = docInLavorazione.pages.item(filtroResult.pag - 1);
                            //serializzo filtroResult.listaRefAvanzate per salvarle in un file suddivise per pagina

                            var listaRefImpaginate = filtroResult.listaRef;
                            var listaRefImpaginateSerialized = JSON.stringify(listaRefImpaginate);

                            var listaRefAvanzate = filtroResult.listaRefNonImpaginate;
                            var listaRefAvanzateSerialized = JSON.stringify(listaRefAvanzate);

                            // Crea un oggetto con la pagina e la lista
                            var data = {
                                Pag: filtroResult.pag,
                                data: date,
                                listaImpaginate: listaRefImpaginateSerialized,
                                listaAvanzate: listaRefAvanzateSerialized,
                                codiceFiltro: filtroResult.codiceFiltro,
                            };

                            // Aggiungi l'oggetto all'array nel file
                            appendToFile(filePath, data);

                            pagCoinvolta.select();

                            //var boxConteggio = boxConteggioTemplate.duplicate(pagCoinvolta);
                            var wPage = pagCoinvolta.bounds[3] - pagCoinvolta.bounds[1];
                            //var wBox = boxConteggio.geometricBounds[3] - boxConteggio.geometricBounds[1];

                            var offsetPag = 0;
                            if (parseInt(pagCoinvolta.name) % 2 != 0 && parseInt(pagCoinvolta.name) > 1) {
                                offsetPag += wPage;
                            }

                            // boxConteggio.itemLayer = docInLavorazione.layers.itemByName("FILTRO");
                            // boxConteggio.move([offsetPag + (wPage - wBox) / 2, 0]);

                            console.log("PAG -> " + pagCoinvolta.name);

                            // for (var $c = 0; $c < boxConteggio.allPageItems.length; $c++) {
                            //     var item = boxConteggio.allPageItems[$c];
                            //     console.log(item.label);
                            //     if (item.label == "tot_ref") {
                            //         console.log(">" + filtroResult.conteggioRef);
                            //         item.contents = filtroResult.conteggioRef.toString();
                            //     }
                            //     else if (item.label == "tot_box") {
                            //         console.log(">" + filtroResult.listaRef.length);
                            //         item.contents = filtroResult.listaRef.length.toString();
                            //     }
                            //     else if (item.label == "griglia_scelta") {
                            //var righe = filtroResult.griglia.righe;
                            var nome_griglia = filtroResult.griglia.nomeGriglia;
                            var grigliaObj = null;
                            var suffisso_lavorazione = "";
                            if (pluginMiddleware.getSuffissoLavorazione != null) {
                                suffisso_lavorazione = pluginMiddleware.getSuffissoLavorazione(filtroResult.listaRef);
                            }
                            //Qui va controllato se ESISTE già una griglia
                            if (paramsCache["pag_" + pagCoinvolta.name] != null) {
                                grigliaObj = paramsCache["pag_" + pagCoinvolta.name].griglia;
                                nome_griglia = grigliaObj.label;
                                logContent += "PAG -> " + pagCoinvolta.name + " - Griglia già presente: " + grigliaObj.label + "\n";
                            }
                            else if (nome_griglia != null) {

                                var suffix = "";
                                if (filtroResult.pag % 2 != 0) {
                                    suffix = "_DX";
                                }
                                else {
                                    suffix = "_SX";
                                }
                                var grigliaTemplate = grigliaDallaLibreria(libreria, nome_griglia, suffix, filtroResult.pag);
                                grigliaTemplate = grigliaTemplate.placeAsset(docInLavorazione)[0];
                                var grigliaObj = grigliaTemplate.duplicate(pagCoinvolta);
                                grigliaObj.move([offsetPag, 0]);
                                grigliaTemplate.remove();
                                if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                    docInLavorazione.layers.add({ name: "GRIGLIA" });
                                }
                                grigliaObj.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                            }

                            console.log(">>>>>>> " + grigliaObj.label);

                            // var rc = nome_griglia.split("x");
                            // var nColonne = parseInt(rc[0]);
                            // var nRighe = parseInt(rc[1]);

                            // console.log([nRighe, nColonne]);
                            boxInGriglia = [];
                            for (var iG = 0; iG < grigliaObj.groups.length; iG++) {
                                boxInGriglia.push(grigliaObj.groups.item(iG));
                            }
                            //ordiniamoli per numero della label, le label sono tutte numerate da 1 a X chiamate box_1, box_2, ecc
                            boxInGriglia = boxInGriglia.sort(function (a, b) {
                                var numA = parseInt(a.label.split("_")[1]);
                                var numB = parseInt(b.label.split("_")[1]);
                                return numA - numB;
                            });
                            griglia = grigliaObj;
                            mappaGriglia = grigliaJs.mappaturaGriglia(griglia);

                            console.log("BOX IN GRIGLIA " + boxInGriglia.length);
                            for (var $f = 0; $f < filtroResult.listaRef.length; $f++) {
                                var itemRef = filtroResult.listaRef[$f];
                                var descrParts = [
                                    itemRef.descrizione_gruppo != null ? itemRef.descrizione_gruppo["Descrizioni.Descrizione1"] || "" : itemRef["Descrizioni.Descrizione1"] || "",
                                    itemRef.descrizione_gruppo != null ? itemRef.descrizione_gruppo["Descrizioni.Descrizione2"] || "" : itemRef["Descrizioni.Descrizione2"] || "",
                                    itemRef.descrizione_gruppo != null ? itemRef.descrizione_gruppo["Descrizioni.Descrizione3"] || "" : itemRef["Descrizioni.Descrizione3"] || "",
                                    itemRef.descrizione_gruppo != null ? itemRef.descrizione_gruppo["Descrizioni.Descrizione4"] || "" : itemRef["Descrizioni.Descrizione4"] || ""
                                ].filter(s => s && s.trim() !== "").join(" || ");

                                //togliamo eventuali a capo
                                descrParts = descrParts.replace(/\n/g, " ");
                                var descr = descrParts.length > 75 ? descrParts.substring(0, 75) + "..." : descrParts;

                                var res = null;
                                if (boxInGriglia != null) {
                                    var codiceFiltroItem = makeCodiceFiltroFromItemRef(itemRef);

                                    res = mappaGriglia.find(function (f) {
                                        return sameCodiceFiltro(f.codiceFiltroAssociato, codiceFiltroItem);
                                    });
                                }

                                let ingombroAgenzia = pluginMiddleware.requiresIngombro(itemRef);
                                //se ingombro è un array
                                let ingombro = "";
                                let stile = "";
                                if (ingombroAgenzia instanceof Array) {
                                    ingombro = ingombroAgenzia[0];
                                    stile = ingombroAgenzia[1];
                                }
                                else {
                                    ingombro = ingombroAgenzia;
                                }

                                if (ingombro != "") {
                                    descr += "\n" + "INGOMBRO: " + ingombro + "\n";//itemRef["combinazioneAssegnata"].toString();
                                }

                                if (itemRef["Scatto.CodiceGruppo"].toString().split(",").length > 1) {
                                    descr += "\nGruppo di:" + itemRef["Scatto.CodiceGruppo"].toString().split(",").length + " articoli";
                                }
                                else {
                                    descr += "\nCodice Singolo: " + itemRef["Referenza.Codice"].toString();
                                }

                                descr += pluginMiddleware.getInfoExtra(itemRef);

                                var codiceFiltro = filtroResult.codiceFiltro
                                //cerchiamo tutti i filtriResult con lo stesso codice filtro incluso se stesso
                                var gruppoFiltri = objResult.result.filter(function (el) {
                                    return el.codiceFiltro == codiceFiltro;
                                });
                                //cerchiamo il primo elemento con listaRefNonImpaginate.length > 0
                                var filtroResultGruppoFiltri = gruppoFiltri.find(function (el) {
                                    return el.listaRefNonImpaginate.length > 0;
                                });
                                var avanzate = filtroResult.listaRefNonImpaginate;
                                if (avanzate.length == 0 && filtroResultGruppoFiltri != null) {
                                    avanzate = filtroResultGruppoFiltri.listaRefNonImpaginate;
                                }
                                if (avanzate.length > 0) {
                                    for (var $b = 0; $b < boxInGriglia.length; $b++) {
                                        var bItem = boxInGriglia[$b];
                                        if (bItem.label == "avanzate") {

                                            bItem.visible = true;
                                            for (var $b2 = 0; $b2 < bItem.allPageItems.length; $b2++) {
                                                var elInBox = bItem.allPageItems[$b2];
                                                if (elInBox.label == "text_avanzate") {
                                                    elInBox.contents = avanzate.length.toString();
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                                else {
                                    for (var $b = 0; $b < boxInGriglia.length; $b++) {
                                        var bItem = boxInGriglia[$b];
                                        if (bItem.label == "avanzate") {
                                            bItem.visible = false;
                                            break;
                                        }
                                    }
                                }

                                for (var $b = 0; $b < boxInGriglia.length; $b++) {
                                    var bItem = null;
                                    if (res != null) {
                                        if (boxInGriglia[$b].label == res.nomeBox) {
                                            bItem = boxInGriglia[$b];
                                        }
                                        else {
                                            continue;
                                        }
                                    }
                                    else {
                                        bItem = boxInGriglia[$b];
                                    }

                                    if (grigliaJs.getVisibilityLabelsBox(bItem, "no")) {
                                        continue;
                                    }

                                    var codiceAssociato = grigliaJs.getCodiceAssociato(bItem);

                                    if (res != null || codiceAssociato == "" /*bItem.label == "box_" + inx*/) {

                                        for (var $b2 = 0; $b2 < bItem.allPageItems.length; $b2++) {
                                            var elInBox = bItem.allPageItems[$b2];

                                            if (elInBox.label.split("$")[0] == "info") {
                                                elInBox.label = "info";
                                                grigliaJs.setContent(elInBox, descr);
                                            }

                                            if (elInBox.label.split("$")[0] == "codice_associato") {
                                                var codiceFiltro = makeCodiceFiltroFromItemRef(itemRef);
                                                elInBox.label = makeCodiceAssociatoLabel(codiceFiltro.codice, codiceFiltro.idRec);
                                            }

                                            if (elInBox.label == "segnalazione_ingombro" && ingombro != "") {
                                                elInBox.visible = true;
                                                if (stile != null && stile != "") {
                                                    var style = TestoTag.parseObjStile(stile);
                                                    if (style != null && style.isValid) {
                                                        elInBox.appliedObjectStyle = style;
                                                    }
                                                }
                                            }
                                        }

                                        break;
                                    }


                                }


                            }



                            //}
                            // }
                        }

                        //boxConteggioTemplate.remove();
                    }
                    else {
                        var modeConfronto = 0;
                        listElementiNonImpaginati = [];
                        inProcess = true;
                        //cambiamo il livello selezionato nel livello In pagina


                        //var boxConteggioTemplate = libreria.assets.itemByName("Box Conteggio").placeAsset(docInLavorazione)[0];

                        for (var $r = 0; $r < objResult.result.length; $r++) {
                            docInLavorazione.activeLayer = docInLavorazione.layers.itemByName("InPagina");
                            var filtroResult = objResult.result[$r];
                            itemRef = null; //I20-1038: il contesto di IDX-27 non deve mostrare la ref della pagina prima
                            showLoading("Impaginazione di pagina: " + filtroResult.pag);
                            await Utility.sleep(10);
                            var XoffsetElementiConfronto = 0; //offset usato solo in caso di confronto per sfalzare i record impaginati in alto a sinistra
                            var YoffsetElementiConfronto = 0; //offset usato solo in caso di confronto per sfalzare i record impaginati in alto a sinistra
                            var offsetElementiConfrontoSpostati = 0; //offset usato solo in caso di confronto per sfalzare i record impaginati in alto a sinistra
                            // var pagCoinvolta = docInLavorazione.pages.item(filtroResult.pag - 1);
                            var pagCoinvolta = docInLavorazione.pages.itemByName(filtroResult.pag.toString());
                            //pagCoinvolta.select();

                            //ATTENZIONE
                            //Box COnteggio in materiale PoP potrebbe non aver senso
                            //il PoP ha la caratteristica di essere una produzione a catena dove ogni prestazione ha vita a se
                            //Tuttavia il PoP puo richiedere le GRIGLIE (per ottimizzare lo spazio di stampa o per altre logiche possibili)
                            //Allora nle cao PoP non eisste Box Conteggio, ma si cerca in libreria la "griglia_" seguita da SIGLA del formato PoP
                            //Da li in poi per capire dove piazzare la ref torna la stessa logica dei VOL

                            //var boxConteggio = boxConteggioTemplate.duplicate(pagCoinvolta);
                            var wPage = pagCoinvolta.bounds[3] - pagCoinvolta.bounds[1];
                            //var wBox = boxConteggio.geometricBounds[3] - boxConteggio.geometricBounds[1];

                            var offsetPag = 0;
                            if (parseInt(pagCoinvolta.name) % 2 != 0 && parseInt(pagCoinvolta.name) > 1) {
                                offsetPag += wPage;
                            }

                            // boxConteggio.itemLayer = docInLavorazione.layers.itemByName("FILTRO");
                            // boxConteggio.move([offsetPag + (wPage - wBox) / 2, 0]);

                            console.log("PAG -> " + pagCoinvolta.name);

                            var nome_griglia = filtroResult.griglia.nomeGriglia;
                            
                            var grigliaObj = null;
                            var suffisso_lavorazione = "";
                            if (pluginMiddleware.getSuffissoLavorazione != null) {
                                suffisso_lavorazione = pluginMiddleware.getSuffissoLavorazione(filtroResult.listaRef);
                            }
                            //Qui va controllato se ESISTE già una griglia
                            if (paramsCache["pag_" + pagCoinvolta.name] != null) {
                                grigliaObj = paramsCache["pag_" + pagCoinvolta.name].griglia;
                                nome_griglia = grigliaObj.label;
                                logContent += "PAG -> " + pagCoinvolta.name + " - Griglia già presente: " + grigliaObj.label + "\n";
                            }
                            else if (nome_griglia != null) {
                                var suffix = "";
                                if (filtroResult.pag % 2 != 0) {
                                    suffix = "_DX";
                                }
                                else {
                                    suffix = "_SX";
                                }
                                var grigliaTemplate = grigliaDallaLibreria(libreria, nome_griglia, suffix, filtroResult.pag);
                                grigliaTemplate = grigliaTemplate.placeAsset(docInLavorazione)[0];
                                //var grigliaTemplate = libreria.assets.itemByName(nome_griglia).placeAsset(docInLavorazione)[0];
                                var grigliaObj = grigliaTemplate.duplicate(pagCoinvolta);
                                grigliaObj.move([offsetPag, 0]);
                                grigliaTemplate.remove();


                                if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                    docInLavorazione.layers.add({ name: "GRIGLIA" });
                                }

                                grigliaObj.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                                logContent += "PAG -> " + pagCoinvolta.name + " - Griglia creata: " + grigliaObj.label + "\n";
                            }

                            if(nome_griglia == null){
                                messaggioUtente("Code IDX-griglia Nessuna griglia trovata per la pagina " + pagCoinvolta.name + ", impaginazione non possibile", "error");
                                throw new Error("Code IDX-griglia Nessuna griglia trovata per la pagina " + pagCoinvolta.name + ", impaginazione non possibile");
                            }
                            //rendiamo la griglia con l'alfa al 50%
                            grigliaObj.transparencySettings.blendingSettings.opacity = 30;
                            console.log(">>>>>>> " + grigliaObj.label);

                            boxInGriglia = [];
                            for (var iG = 0; iG < grigliaObj.groups.length; iG++) {
                                boxInGriglia.push(grigliaObj.groups.item(iG));
                            }
                            boxInGriglia = boxInGriglia.sort(function (a, b) {
                                var numA = parseInt(a.label.split("_")[1]);
                                var numB = parseInt(b.label.split("_")[1]);
                                return numA - numB;
                            });
                            griglia = grigliaObj;
                            mappaGriglia = grigliaJs.mappaturaGriglia(griglia);
                            console.log("BOX IN GRIGLIA " + boxInGriglia.length);


                            let currIndexBoxProg=0;

                            for (var $f = 0; $f < filtroResult.listaRef.length; $f++) {
                                var itemRef = filtroResult.listaRef[$f];
                                var descr = itemRef["Descrizioni.Descrizione1"];

                                var meccanica = itemRef["codiceBox"] != null && itemRef["codiceBox"].toString() != "" ? itemRef["codiceBox"].toString() : itemRef["combinazioneAssegnata"].toString();
                                //var meccanicaAlt = "";
                                var trovato = false;

                                //cerchiamo in mappa se esiste un elemento con codiceGruppo = itemRef["Scatto.CodiceGruppo"]
                                var res = null;
                                // if (boxInGriglia != null) {
                                //     res = mappaGriglia.find(f=>f.codiceAssociato == itemRef["Scatto.CodiceGruppo"].toString());
                                // }
                                if (boxInGriglia != null) {
                                    var codiceFiltroItem = makeCodiceFiltroFromItemRef(itemRef);

                                    res = mappaGriglia.find(function (f) {
                                        return sameCodiceFiltro(f.codiceFiltroAssociato, codiceFiltroItem);
                                    });
                                }

                                
                                for (var $b = currIndexBoxProg; $b < boxInGriglia.length; $b++) {
                                    var bItem = null;
                                    if(res != null ){
                                        if(boxInGriglia[$b].label == res.nomeBox){
                                            bItem = boxInGriglia[$b];
                                        }
                                        else{
                                            continue;
                                        }
                                    }
                                    else{
                                        bItem = boxInGriglia[$b];
                                        currIndexBoxProg=($b+1);

                                        //se il box è bloccato continuiamo
                                        if(grigliaJs.getVisibilityLabelsBox(bItem, "no")){
                                            continue;
                                        }
                                    }

                                    var bounds = bItem.geometricBounds;
                                    //cerchiamo in mappa se esiste un elemento con codiceGruppo = itemRef["Scatto.CodiceGruppo"]

                                    var codiceAssociato = grigliaJs.getCodiceAssociato(bItem);

                                    if (res != null || codiceAssociato == "" /*bItem.label == "box_" + inx*/) {

                                        res = await impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, tipo_lavorazione_corrente, reportImpaginazioneObj, null, null, docInLavorazione);
                                        
                                        if (res != null) {
                                            trovato = res.trovato;
                                            listElementiNonImpaginati = res.listElementiNonImpaginati;
                                        }
                                    }
                                    if (trovato) {
                                        break;
                                    }
                                }
                                
                            }

                            //applichiamo la grigliaSfondo_ alla pagina in base alla griglia scelta

                            var nomeGriglia = filtroResult.griglia.formato;
                            logContent += "PAG -> " + pagCoinvolta.name + " - Griglia sfondo scelta: " + nomeGriglia + "\n";
                            var trovato = false;
                            var pagPari = true;
                            if (parseInt(pagCoinvolta.name) % 2 != 0) {
                                pagPari = false;
                            }
                            for (var i = 0; i < docInLavorazione.masterSpreads.length; i++) {
                                var masterSpread = docInLavorazione.masterSpreads.item(i);
                                for (var j = 0; j < masterSpread.groups.length; j++) {
                                    var grigliaSfondo = masterSpread.groups.item(j);
                                    if (grigliaSfondo.label == "GrigliaSfondo_" + nomeGriglia + (pagPari ? "_sx" : "_dx")) {
                                        var grigliaImpaginata = grigliaSfondo.duplicate(pagCoinvolta);
                                        if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                            docInLavorazione.layers.add({ name: "GRIGLIA" });
                                        }
                                        grigliaImpaginata.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                                        trovato = true;
                                        break;
                                    }
                                }
                                if (trovato) {
                                    break;
                                }
                            }
                            if (!trovato) {
                                logContent += "PAG -> " + pagCoinvolta.name + " - Griglia sfondo non trovata\n";
                            }
                            logContent += "PAG -> " + pagCoinvolta.name + " - rimuovo la griglia conteggio\n";
                            //griglia.remove();
                            grigliaObj.visible = false;
                        }

                        inProcess = false;
                        if (listElementiNonImpaginati.length > 0) {
                            logContent += "Rimuovo gli elementi non impaginati con successo\n";
                            await rimuoviRefImpaginata(listElementiNonImpaginati, true);
                        }
                    };

                    //I20-1029, lotto 2: si aspetta il ridisegno del Menabo' prima di aprire la schermata
                    //delle segnalazioni nel finally: il popup nasconde i controlli nativi (.hideble) che
                    //trova, e le caselle Ordine create dopo gli resterebbero sopra. Un errore del ridisegno
                    //resta in console, come quando non si aspettava, e non diventa un errore del filtro.
                    await filtriJs.visualizzaHomePageFiltri().catch(e => console.error("Ridisegno del Menabo' non riuscito:", e));

                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();


                }
                catch (ex) {
                    //I20-1038: il messaggio dice dove si era (pagina e ref); lo stack va solo in console e nel
                    //log testuale. filtroResult e itemRef sono var della stessa funzione: qui valgono anche se il
                    //try si e' fermato prima del ciclo dei box; typeof protegge se finissero in una funzione interna.
                    //Un errore gia' detto all'operatore (giaSegnalato, come IDX-169) non si ripete: resta la pulizia.
                    var contestoErrore = contestoErroreFiltro(typeof filtroResult !== "undefined" ? filtroResult : null, typeof itemRef !== "undefined" ? itemRef : null);
                    if (!(ex != null && ex.giaSegnalato === true)) {
                        messaggioUtente("Code IDX-27 Filtro: Errore durante l'elaborazione del filtro (Deb1) [" + contestoErrore + "]: " + ex, "error");
                    }
                    console.error(ex);
                    logContent += "Errore durante l'elaborazione del filtro [" + contestoErrore + "]: " + ex.toString() + "\n" + (ex != null && ex.stack != null ? ex.stack + "\n" : "");
                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();

                    indesignEvents.setBusy(false);

                }
                finally {
                    rimuoviSimboli();
                    stampaSegnalazioni(reportImpaginazioneObj);
                    //I20-1029, lotto 2: se l'impaginazione ha prodotto segnalazioni, la schermata si
                    //apre da sola.
                    if (impagina) {
                        SchermataSegnalazioni.apriSeCiSono(reportImpaginazioneObj);
                    }

                    //scriviamo il log
                    var currentDate = new Date();
                    logContent += currentDate.toLocaleDateString() + " alle " + currentDate.toLocaleTimeString() + " Operazione di " + (impagina ? "impaginazione" : "conteggio") + " terminata\n";
                    fs.writeFileSync(logFilePath, logContent);

                    hideLoading();
                    indesignEvents.setBusy(false);
                }
            }

            xhrInProcess.onreadystatechange = function () {
                if (xhrInProcess.readyState == 4) {
                    if (xhrInProcess.status == 200) {
                        messaggioUtente("Code IDX-28 Filtro: Richiesta completata con successo", "success", false, 5);
                        bOpt1.disabled = false;
                        bOpt2.disabled = false;
                        setFiltroButtonsDefaultMarkup();
                    } else {
                        messaggioUtente("Code IDX-29 Filtro: Errore durante la richiesta: " + xhrInProcess.status, "error");
                        bOpt1.disabled = false;
                        bOpt2.disabled = false;
                        setFiltroButtonsDefaultMarkup();
                    }
                }
            };

            xhrInProcess.onerror = function () {
                messaggioUtente("Code IDX-30 Filtro: Errore di rete", "error");
                hideLoading();
            };
            console.log("Menabo/ImpaginaFromInDesignNew/" + idKitLavorazione + "/" + impagina + "/" + noCacheCheck);
            xhrInProcess.send("Menabo/ImpaginaFromInDesignNew/" + idKitLavorazione + "/" + impagina + "/" + noCacheCheck, req, "PUT", "application/x-www-form-urlencoded");
            messaggioUtente("Code IDX-31 Filtro: Richiesta inviata", "success", true, 0, true);

        }
        catch (ex) {
            rimuoviSimboli();
            console.error(ex);
            messaggioUtente("Code IDX-32 Errore generico durante l'elaborazione del filtro: " + ex.toString(), "error");
            //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
            bOpt1.disabled = false;
            bOpt2.disabled = false;
            setFiltroButtonsDefaultMarkup();

            hideLoading();
            indesignEvents.setBusy(false);
        }
    }
    else if (tipo_lavorazione_corrente == 2) {
        try {

            showLoading("Operazione sul server in corso, attendere; il processo potrebbe richiedere del tempo");
            await Utility.sleep(100);
            indesignEvents.setBusy(true);

            //disattiviamo gli sp-button bOpt1 e bOpt2 per evitare doppie richieste, per farlo impostiamo un attr chiamato disabled a true    
            bOpt1.disabled = true;
            bOpt2.disabled = true;

            var pages = docInLavorazione.pages;
            var req = "";
            var filterIndex = 0;

            for (var i = 0; i < pages.length; i++) {
                var page = pages.item(i);
                let arrGroups = page.groups;
                var rootPath = "Filters[" + filterIndex + "]";
                var listCodiciRichiestiInPagina = [];

                for (var j = 0; j < arrGroups.length; j++) {
                    var item = arrGroups.item(j);
                    if (item.itemLayer.name == "GRIGLIA") {
                        if (!item.visible) {
                            //Utility.moveToPasteBoard(item);
                            //app.redraw();
                            item.remove();
                        }
                    }

                    if (item.label.indexOf("griglia_") >= 0 && item.visible) {
                        //se il layer non è GRIGLIA lo spostiamo in griglia
                        if (item.itemLayer.name != "GRIGLIA") {
                            if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                docInLavorazione.layers.add({ name: "GRIGLIA" });
                            }
                            item.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                        }

                        var formato = item.label.split("_")[1];
                        var boxNonTrovato = false;
                        var boxNumber = 1;
                        var listBoxBloccati = [];
                        while (!boxNonTrovato) {
                            var box = grigliaJs.getBoxByNumber(item, boxNumber);
                            if (box == null || !box.isValid) {
                                boxNonTrovato = true;
                                break;
                            }
                            else if (box != null && box.isValid) {
                                //leggiamo il codice associato se c'è
                                var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                if (codiceFiltro != null) {
                                    listCodiciRichiestiInPagina.push(codiceFiltro);
                                }

                                var bloccato = grigliaJs.getVisibilityLabelsBox(box, "no");
                                if (bloccato) {
                                    listBoxBloccati.push(boxNumber);
                                }
                            }
                            boxNumber++;
                        }

                        req += rootPath + ".Griglia.formato=" + formato + "&";
                        for (var $r = 0; $r < listBoxBloccati.length; $r++) {
                            req += rootPath + ".Griglia.boxOccupati[" + $r + "]=" + listBoxBloccati[$r] + "&";
                        }
                        req += rootPath + ".Pag=" + page.name + "&" + rootPath + ".Stato=2&";
                        paramsCache["pag_" + page.name] = { griglia: item };
                        console.log("Aggiunta griglia per pag " + page.name + " ### " + item.label);

                    }

                    //Se la griglia non è stata trovata controllo la masterSpread assegnata alla pagina
                    //controllo dunque le pagine della masterSpread prendendo la prima se il nome della pagina è pari o la seconda se il nome della pagina è dispari
                    //infine controllo se la pagina ha una label, se c'è quello è il nome della griglia da mettere
                    if (paramsCache["pag_" + item.name] == null) {
                        var masterSpread = item.appliedMaster;
                        if (masterSpread != null && masterSpread.isValid) {
                            var masterPages = masterSpread.pages.everyItem().getElements();
                            if (masterPages.length > 0) {
                                var masterPage = masterPages[parseInt(item.name) % 2];
                                if (masterPage != null && masterPage.isValid && masterPage.label != "") {
                                    var masterGriglia = masterPage.label;
                                    //proviamo a cercare in libreria la griglia
                                    var griglia = libreria.assets.itemByName(masterGriglia);
                                    //mettiamo la griglia in pagina
                                    if (griglia != null && griglia.isValid) {
                                        let grigliaMastro = griglia.placeAsset(docInLavorazione)[0];
                                        var grigliaObj = grigliaMastro.duplicate(item);
                                        var offsetPag = 0;
                                        var wPage = item.bounds[3] - item.bounds[1];
                                        if (parseInt(item.name) % 2 != 0 && parseInt(item.name) > 1) {
                                            offsetPag += wPage;
                                        }
                                        grigliaObj.move([offsetPag, 0]);
                                        grigliaMastro.remove();

                                        var formato = grigliaObj.label.split("_")[1];
                                        var boxNonTrovato = false;
                                        var boxNumber = 1;
                                        var listBoxBloccati = [];
                                        while (!boxNonTrovato) {
                                            var box = grigliaJs.getBoxByNumber(grigliaObj, boxNumber);
                                            if (box == null || !box.isValid) {
                                                boxNonTrovato = true;
                                                break;
                                            }
                                            else if (box != null && box.isValid) {

                                                //leggiamo il codice associato se c'è
                                                var codiceFiltro = grigliaJs.getCodiceAssociatoConId(box);
                                                if (codiceFiltro != null) {
                                                    listCodiciRichiestiInPagina.push(codiceFiltro);
                                                }

                                                var bloccato = grigliaJs.getVisibilityLabelsBox(box, "no");
                                                if (bloccato) {
                                                    listBoxBloccati.push(boxNumber);
                                                }
                                            }
                                            boxNumber++;
                                        }

                                        req += rootPath + ".Griglia.formato=" + formato + "&";
                                        for (var $r = 0; $r < listBoxBloccati.length; $r++) {
                                            req += rootPath + ".Griglia.boxOccupati[" + $r + "]=" + listBoxBloccati[$r] + "&";
                                        }

                                        paramsCache["pag_" + pItem.name] = { griglia: grigliaObj };
                                        console.log("Aggiunta griglia per pag " + pItem.name + " ### " + grigliaObj.label);
                                        await Utility.sleep(100);
                                    }
                                }
                            }
                        }

                    }
                }

                filterIndex++;
            }

            if (libreria != null && libreria.isValid) {
                var griglieDisponibili = [];
                var griglieInLibreria = libreria.assets.everyItem().getElements();
                for (var $g = 0; $g < griglieInLibreria.length; $g++) {
                    var elGriglia = griglieInLibreria[$g];
                    var nameSplit = elGriglia.name.split("_");
                    if (nameSplit.length == 0) {
                        continue;
                    }

                    if (nameSplit[0].indexOf("x") >= 1) {
                        if (nameSplit.length == 1) {
                            if (griglieDisponibili.findIndex(g => g.formato == nameSplit[0]) < 0) {
                                griglieDisponibili.push({ nomeGriglia: nameSplit[0], formato: nameSplit[0] });
                            }
                        }
                        else {
                            var canaliGriglia = nameSplit[1].split("-");
                            if (siglaCanale != null && (canaliGriglia.includes(siglaCanale) || canaliGriglia.includes("XX"))) {
                                if (griglieDisponibili.findIndex(g => g.formato == nameSplit[0]) < 0) {
                                    griglieDisponibili.push({ nomeGriglia: nameSplit[0] + "_" + nameSplit[1], formato: nameSplit[0] });
                                }
                            }
                        }
                    }
                }

                for (var $g = 0; $g < griglieDisponibili.length; $g++) {
                    req += "GriglieValide[" + $g + "].nomeGriglia=" + griglieDisponibili[$g].nomeGriglia + "&";
                    req += "GriglieValide[" + $g + "].formato=" + griglieDisponibili[$g].formato + "&";
                }
            }

            //rimuoviamo il carattere di & finale
            if (req.endsWith("&")) {
                req = req.slice(0, -1);
            }

            async function impaginaLista(objResult, parsed) {
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>RIUSLTATO FILTRO CONTEGGIO");
                console.log(objResult);
                clearFile(pathLavorazione + "/logImpaginazionePop.txt");
                var logFilePath = pathLavorazione + "/logImpaginazionePop.txt";
                var logContent = "";
                var currentDate = new Date();
                logContent += currentDate.toLocaleDateString() + " alle " + currentDate.toLocaleTimeString() + " operazione di impaginazione Pop iniziata\n";
                try {
                    try {
                        if (!parsed) {
                            objResult = JSON.parse(objResult);
                        }
                        console.log(objResult);
                    }
                    catch (e) {
                        console.log(e);
                        messaggioUtente("Code IDX-33 Filtro: Errore durante il parsing della risposta:" + objResult, "error");
                        logContent += "Code IDX-33 Filtro: Errore durante il parsing della risposta:" + objResult + "\n";
                        cbkEnd?.("error");
                        return;
                    }
                    if (objResult.error != null && objResult.error != "") {
                        messaggioUtente("Code IDX-34 Filtro: Errore durante l'elaborazione del filtro: " + objResult.error, "error");
                        logContent += "Code IDX-34 Filtro: Errore durante l'elaborazione del filtro: " + objResult.error + "\n";
                        cbkEnd?.("error");
                        return;
                    }
                    else if (objResult.result.length == 0) {
                        messaggioUtente("Code IDX-35 Filtro: Operazione riuscita ma nessun elemento è stato trovato tra i non impaginati con i filtri impostati", "warning");
                    }

                    listElementiNonImpaginati = [];
                    inProcess = true;
                    //cambiamo il livello selezionato nel livello In pagina


                    //var boxConteggioTemplate = libreria.assets.itemByName("Box Conteggio").placeAsset(docInLavorazione)[0];

                    docInLavorazione.activeLayer = docInLavorazione.layers.itemByName("InPagina");


                    //Si salva solo per PoP, per VOL è frammentata solitamente
                    let filePathSaveData = pathLavorazione + "/listaImpaginata" + idKitLavorazione + ".json";
                    clearFile(filePathSaveData);
                    appendToFile(filePathSaveData, objResult);


                    var count = 0;
                    var dictionaryGriglieControllate = {};
                    for (var $r = restartFromIndexPoP; $r < objResult.result.length; $r++) {
                        //qui controlliamo ch le griglie richieste siano tutte presenti
                        //per farlo prendiamo il primo elemento di ogni pagina e guardiamo che griglia chiede
                        //se la griglia è 1x1 allora non c'è bisogno di griglia e passiamo al prossimo elemento
                        //se è diversa da 1x1 allora cerchiamo la griglia in libreria e la piazziamo
                        count++;

                        var filtroResult = objResult.result[$r];
                        //var righe = filtroResult.griglia.righe;
                        var nome_griglia = filtroResult.griglia.nomeGriglia;
                        if (nome_griglia != null) {
                            //var nome_griglia = righe[0].length + "x" + righe.length;
                            if (nome_griglia != "1x1") {
                                if (dictionaryGriglieControllate[nome_griglia] == null) {
                                    var suffisso_lavorazione = "";
                                    if (pluginMiddleware.getSuffissoLavorazione != null) {
                                        suffisso_lavorazione = pluginMiddleware.getSuffissoLavorazione(filtroResult.listaRef);
                                    }
                                    var grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/);
                                    if (grigliaTemplate != null && grigliaTemplate.isValid) {
                                        dictionaryGriglieControllate[nome_griglia] = true;
                                    }
                                    else {
                                        dictionaryGriglieControllate[nome_griglia] = false;
                                    }

                                }
                            }
                        }
                    }

                    //scorriamo tutte le chiavi del dictionary e se il valore è false allora la griglia non è stata trovata, formiamo dunque un messaggio di errore
                    //con tutte le griglie non trovate, dunque se l'errore è stato formato non procediamo con l'impaginazione

                    var griglieNonTrovate = "Griglie non trovate: ";
                    var errorGriglieNonTrovate = false;
                    for (var key in dictionaryGriglieControllate) {
                        if (!dictionaryGriglieControllate[key]) {
                            griglieNonTrovate += key + " ";
                            errorGriglieNonTrovate = true;
                        }
                    }

                    if (errorGriglieNonTrovate) {
                        messaggioUtente("Code IDX-36 Filtro: " + griglieNonTrovate, "error");
                        logContent += "Filtro: " + griglieNonTrovate + "\n";

                        //mandiamo lo svuota menabò
                        //await svuotaMenabo();
                        inProcess = false;
                        indesignEvents.setBusy(false);

                        //disattiviamo gli sp-button bOpt1 e bOpt2 per evitare doppie richieste, per farlo impostiamo un attr chiamato disabled a true    
                        bOpt1.disabled = false;
                        bOpt2.disabled = false;
                        setFiltroButtonsDefaultMarkup();
                        cbkEnd?.("error");
                        return;
                    }

                    count = 0;
                    if (jobImpaginazioneLibro != null && jobImpaginazioneLibro.stato == 1 && jobImpaginazioneLibro.index >= 0) {
                        let lastItemInJobQueue = jobImpaginazioneLibro.queue[jobImpaginazioneLibro.index];
                        if (lastItemInJobQueue != null) {
                            lastItemInJobQueue.tot = objResult.result.length;
                            await registraStatoLavorazioneLibro();
                        }
                    }

                    for (var $r = restartFromIndexPoP; $r < objResult.result.length; $r++) {
                        var filtroResult = objResult.result[$r];
                        // if (count == 10) {
                        //      break;
                        // }
                        count++;
                        //controlliamo se la pagina richiesta esiste, se non esiste la aggiungiamo, altrimenti la svuotiamo prima di impaginare
                        var pag = null;
                        if (docInLavorazione.pages.length < filtroResult.pag) {
                            pag = docInLavorazione.pages.add();//LocationOptions.AT_END);
                            //pag.move(LocationOptions.AT_END, docInLavorazione.spreads.add());
                        }
                        else {
                            //pag = docInLavorazione.pages.item(filtroResult.pag - 1);
                            pag = docInLavorazione.pages.itemByName(filtroResult.pag.toString());
                            var items = pag.pageItems.everyItem();
                            //rimuoviamo tutti gli elementi presenti nel layer InPagina
                            for (var $i = items.length - 1; $i >= 0; $i--) {
                                var item = items.item($i);
                                if (item.itemLayer.name == "InPagina") {
                                    item.remove();
                                }
                            }
                        }

                        //inanzi tutto ci ricaviamo la griglia e se è diversa da 1x1 la impaginiamo
                        //var righe = filtroResult.griglia.righe;
                        var griglia = null;
                        var nome_griglia = filtroResult.griglia.nomeGriglia;
                        var suffisso_lavorazione = "";
                        if (pluginMiddleware.getSuffissoLavorazione != null) {
                            suffisso_lavorazione = pluginMiddleware.getSuffissoLavorazione(filtroResult.listaRef);
                        }
                        if (filtroResult.listaRef.length > 1) {
                            var wPage = pag.bounds[3] - pag.bounds[1];

                            var offsetPag = 0;
                            if (parseInt(pag.name) % 2 != 0 && parseInt(pag.name) > 1) {
                                offsetPag += wPage;
                            }
                            console.log("PAG -> " + pag.name);

                            if (nome_griglia != null && nome_griglia != "") {
                                griglia = null;
                                var suffisso_lavorazione = "";
                                if (pluginMiddleware.getSuffissoLavorazione != null) {
                                    suffisso_lavorazione = pluginMiddleware.getSuffissoLavorazione(filtroResult.listaRef);
                                }
                                //Qui va controllato se ESISTE già una griglia
                                if (paramsCache["pag_" + pag.name] != null) {
                                    //await Utility.sleep(5000);
                                    griglia = paramsCache["pag_" + pag.name].griglia;
                                    console.warn(griglia);
                                    //await Utility.sleep(5000);
                                    logContent += "PAG -> " + pag.name + " - Griglia già presente: " + griglia.label + "\n";
                                }
                                else {
                                    var suffix = "";
                                    if (filtroResult.pag % 2 != 0) {
                                        suffix = "_DX";
                                    }
                                    else {
                                        suffix = "_SX";
                                    }
                                    var grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/ + suffix);
                                    if (grigliaTemplate == null || !grigliaTemplate.isValid) {
                                        grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/);
                                        if (grigliaTemplate == null || !grigliaTemplate.isValid) {
                                            throw "Griglia non trovata: " + nome_griglia + suffisso_lavorazione + suffix + " ,nè " + nome_griglia + suffisso_lavorazione;
                                        }
                                    }
                                    grigliaTemplate = grigliaTemplate.placeAsset(docInLavorazione)[0];

                                    //var grigliaTemplate = libreria.assets.itemByName(nome_griglia).placeAsset(docInLavorazione)[0];
                                    var griglia = grigliaTemplate.duplicate(pagCoinvolta);
                                    griglia.move([offsetPag, 0]);
                                    grigliaTemplate.remove();
                                    if (docInLavorazione.layers.itemByName("GRIGLIA") == null || !docInLavorazione.layers.itemByName("GRIGLIA").isValid) {
                                        docInLavorazione.layers.add({ name: "GRIGLIA" });
                                    }
                                    griglia.itemLayer = docInLavorazione.layers.itemByName("GRIGLIA");
                                    logContent += "PAG -> " + pag.name + " - Griglia creata: " + griglia.label + "\n";
                                }
                                //rendiamo la griglia con l'alfa al 50%
                                griglia.transparencySettings.blendingSettings.opacity = 30;
                                console.log(">>>>>>> " + griglia.label);
                            }

                        }

                        showLoading("Impaginazione di pagina: " + filtroResult.pag);
                        await Utility.sleep(10);
                        //var pagCoinvolta = docInLavorazione.pages.item(filtroResult.pag - 1);
                        var pagCoinvolta = docInLavorazione.pages.itemByName(filtroResult.pag.toString());
                        //pagCoinvolta.select();

                        //ATTENZIONE
                        //Box COnteggio in materiale PoP potrebbe non aver senso
                        //il PoP ha la caratteristica di essere una produzione a catena dove ogni prestazione ha vita a se
                        //Tuttavia il PoP puo richiedere le GRIGLIE (per ottimizzare lo spazio di stampa o per altre logiche possibili)
                        //Allora nel caso PoP non eisste Box Conteggio, ma si cerca in libreria la "griglia_" seguita da SIGLA del formato PoP
                        //Da li in poi per capire dove piazzare la ref torna la stessa logica dei VOL

                        //var boxConteggio = null;


                        //prendiamo i box in griglia
                        var boxInGriglia = [];
                        if(griglia!=null){
                            for (var iG = 0; iG < griglia.groups.length; iG++) {
                                boxInGriglia.push(griglia.groups.item(iG));
                            }
                            boxInGriglia = boxInGriglia.sort(function (a, b) {
                                var numA = parseInt(a.label.split("_")[1]);
                                var numB = parseInt(b.label.split("_")[1]);
                                return numA - numB;
                            });
                        }


                        for (var $f = 0; $f < filtroResult.listaRef.length; $f++) {

                            // if (count == 10) {
                            //     break;
                            // }

                            var itemRef = filtroResult.listaRef[$f];
                            //var descr = itemRef["Descrizioni.Descrizione1"];
                            //var pos = itemRef.posizioniRichieste;
                            // logContent += "PAG -> " + pagCoinvolta.name + " - Record " + itemRef["Scatto.CodiceGruppo"] + " - Descrizione: " + descr + " - Posizione: " + pos + "\n";
                            // var startInx = (pos[1] * nColonne) + 1;
                            // var inx = startInx + pos[0];
                            var inx = itemRef.boxRichiesto;

                            var meccanica = itemRef["codiceBox"] != null && itemRef["codiceBox"].toString() != "" ? itemRef["codiceBox"].toString() : itemRef["combinazioneAssegnata"].toString();
                            //var meccanicaAlt = "";
                            var trovato = false;

                            if (griglia != null) {

                                var res = null;
                                for (var $b = 0; $b < boxInGriglia.length; $b++) {
                                    var bItem = boxInGriglia[$b];
                                    var bounds = bItem.geometricBounds;

                                    if (bItem.label == "box_" + inx) {
                                        console.log("Trovato box " + inx);

                                        res = await impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, tipo_lavorazione_corrente, reportImpaginazioneObj, null, null, docInLavorazione);

                                        trovato = res.trovato;
                                        listElementiNonImpaginati = res.listElementiNonImpaginati;
                                    }
                                    if (trovato) {
                                        break;
                                    }
                                }
                            }
                            else {
                                //in questa casistica siamo in 1x1 e non c'è griglia
                                res = await impaginaBox(meccanica, pagCoinvolta, null, itemRef, pathLavorazione, listElementiNonImpaginati, tipo_lavorazione_corrente, reportImpaginazioneObj, null, null, docInLavorazione);
                                trovato = res.trovato;
                                listElementiNonImpaginati = res.listElementiNonImpaginati;
                            }

                        }

                        if (jobImpaginazioneLibro != null && jobImpaginazioneLibro.stato == 1 && jobImpaginazioneLibro.index >= 0) {
                            let lastItemInJobQueue = jobImpaginazioneLibro.queue[jobImpaginazioneLibro.index];
                            if (lastItemInJobQueue != null) {
                                //Registro ultima pagina impaginata
                                lastItemInJobQueue.lastItem = { pag: pag.name, listaRef: filtroResult.listaRef };
                                await registraStatoLavorazioneLibro();
                            }

                        }


                        rimuoviSimboli();

                        if (griglia != null) {
                            logContent += "PAG -> " + pagCoinvolta.name + " - rimuovo la griglia conteggio\n";
                            //griglia.remove();
                            griglia.visible = false;
                        }
                    }

                    // if (boxConteggio != null) {
                    //     boxConteggio.remove();
                    // }

                    // boxConteggioTemplate.remove();

                    inProcess = false;
                    if (listElementiNonImpaginati.length > 0) {
                        logContent += "Rimuovo gli elementi non impaginati con successo\n";
                        await rimuoviRefImpaginata(listElementiNonImpaginati, true);
                    }


                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();

                    cbkEnd?.("ok");

                }
                catch (ex) {
                    rimuoviSimboli();
                    //await svuotaMenabo();
                    messaggioUtente("Code IDX-32 Errore generico durante l'elaborazione del filtro: " + ex.toString(), "error");
                    console.error(ex);
                    logContent += "Filtro: Errore durante l'elaborazione del filtro: " + ex.toString() + "\n";
                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();

                    indesignEvents.setBusy(false);

                }
                finally {
                    //scriviamo il log
                    var currentDate = new Date();
                    logContent += currentDate.toLocaleDateString() + " alle " + currentDate.toLocaleTimeString() + " Operazione di impaginazione terminata\n";
                    fs.writeFileSync(logFilePath, logContent);

                    //I20-1029, lotto 2: anche il PoP ha il suo report e la sua schermata, che prima
                    //non aveva. Non dentro il giro di un libro: li' i documenti si impaginano uno
                    //alla volta e si chiudono, e la schermata non avrebbe niente da mostrare.
                    if (!(jobImpaginazioneLibro.stato == 1 && jobImpaginazioneLibro.queue.length > 0)) {
                        stampaSegnalazioni(reportImpaginazioneObj);
                        SchermataSegnalazioni.apriSeCiSono(reportImpaginazioneObj);
                    }

                    if (jobImpaginazioneLibro.stato == 2 || jobImpaginazioneLibro.stato == 4) {
                        setNarrow("Libro impaginato");
                        //Nascondiamo impaginaLibroContainer
                        $("#impaginaLibroContainer").css("display", "none");
                        $("#continuaEsportaLibroContainer").css("display", "none");
                        //mostriamo esportaLibroContainer
                        $("#esportaLibroContainer").css("display", "block");
                    }
                    else if (jobImpaginazioneLibro.stato == 1 || jobImpaginazioneLibro.stato == 0) {
                        //Mostriamo impaginaLibroContainer
                        $("#impaginaLibroContainer").css("display", "block");
                        //nascondiamo esportaLibroContainer
                        $("#esportaLibroContainer").css("display", "none");
                        $("#continuaEsportaLibroContainer").css("display", "none");

                        //se lo stato è 1 cambiamo il testo del bottone di impaginaLibroPoP in "CONTINUA IMPAGINAZIONE"
                        if (jobImpaginazioneLibro.stato == 1) {
                            $("#impaginaLibroPoP").text("CONTINUA IMPAGINAZIONE");
                        }
                    }
                    else if (jobImpaginazioneLibro.stato == 3) {
                        setNarrow("Esportazione interrotta");
                        //Mostriamo impaginaLibroContainer
                        $("#impaginaLibroContainer").css("display", "none");
                        //nascondiamo esportaLibroContainer
                        $("#esportaLibroContainer").css("display", "none");
                        $("#continuaEsportaLibroContainer").css("display", "block");
                    }

                    hideLoading();
                    indesignEvents.setBusy(false);
                }
            }

            if(restartFromIndexPoP == 0){
                if (xhrInProcess != null)
                    xhrInProcess.abort("Nuova impaginazione del libro avviata");
    
                xhrInProcess = new XMLHttpRequestClient();
                xhrInProcess.descrizione = "Calcolo dell'impaginazione del libro";
                xhrInProcess.onload = async (objResult, parsed) => {
                    await impaginaLista(objResult, parsed);
                }
    
                xhrInProcess.onreadystatechange = function () {
                    if (xhrInProcess.readyState == 4) {
                        if (xhrInProcess.status == 200) {
                            messaggioUtente("Code IDX-37 Filtro: Richiesta completata con successo", "success", false, 5);
                            bOpt1.disabled = false;
                            bOpt2.disabled = false;
                            setFiltroButtonsDefaultMarkup();
                        } else {
                            messaggioUtente("Code IDX-38 Filtro: Errore durante la richiesta: " + xhrInProcess.status, "error");
                            bOpt1.disabled = false;
                            bOpt2.disabled = false;
                            setFiltroButtonsDefaultMarkup();
                        }
                    }
                };
    
                xhrInProcess.onerror = function () {
                    messaggioUtente("Code IDX-39 Filtro: Errore di rete", "error");
                    hideLoading();
                };
    
                xhrInProcess.send("Menabo/ImpaginaFromInDesignNew/" + idKitLavorazione + "/" + true + "/" + noCacheCheck, req, "PUT", "application/x-www-form-urlencoded");
                //console.log(req);
                //messaggioUtente("Filtro: Richiesta inviata", "success", true, 0, true);
            }
            else if (restartFromIndexPoP > 0) {
                let localDbDataset= readFile(pathLavorazione+"/listaImpaginata"+idKitLavorazione+".json");
                //controlliamo che il file sia un json valido
                if(localDbDataset == null || localDbDataset == ""){
                    throw "Impossibile leggere il file di impaginazione locale per la ripresa dell'impaginazione.";
                }
                else{
                    await impaginaLista(localDbDataset[0], true);
                }
            }

        }
        catch (ex) {
            console.error(ex);
            messaggioUtente("Code IDX-32 Errore generico durante l'elaborazione del filtro: " + ex.toString() + " Debug: " + debug, "error");
            //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
            bOpt1.disabled = false;
            bOpt2.disabled = false;
            setFiltroButtonsDefaultMarkup();

            hideLoading();
            indesignEvents.setBusy(false);
        }
    }

}

//I20-981: i dati del primario che servono a confrontare un box con la lista.
//Erano scritti dentro impaginazioneSingoloIndd, e per averli la preanalisi del Report
//Integrita' doveva passare da quella funzione anche quando non c'era nulla da impaginare.
//Qui stanno una volta sola, cosi' le due strade non possono divergere.
/// Da un gruppo di record estrae quello primario (StatoSelezione == 1) e ne ricava tutto
/// cio' che serve a confrontare il box col tracciato: campi compilati, campi cancellati,
/// foto, foto extra.
///
/// Se il primario ha un sottogruppo, e' il sottogruppo a comandare: e' li' che stanno i
/// dati con cui il box e' stato davvero impaginato.
///
/// I20-968: gli elementi in noRender stanno sul record, non sul sottogruppo. Se si impagina
/// a partire dal sottogruppo la chiave va portata avanti, altrimenti una reimpaginazione
/// riporta visibili gli elementi che l'operatore aveva nascosto.
///
/// La lista foto si compone di due sorgenti: i membri del gruppo foto scelti
/// (statoSelezione == 2) piu' la foto principale, se ha un nome.
///
/// DA SPOSTARE (task di divisione): con l'accorpamento del Report Integrita', questa,
/// boxDellElementoMappa e preAnalisiBoxMappato vanno nel js del report.
function datiPrimarioPerConfronto(records) {
    var primario = (records || []).find(f => f.recordInTracciato["StatoSelezione"] == 1);
    if (primario == null) {
        return null;
    }

    var agenziaUsaSottogruppi = true;
    //* ad ora è disattivato poichè nessuno lo usava
    // if (customAgenzia.usaSottogruppi != null) {
    //     agenziaUsaSottogruppi = customAgenzia.usaSottogruppi;
    // }

    var tracciatoPrimario = primario.sottogruppo && agenziaUsaSottogruppi ? primario.sottogruppo : primario.recordInTracciato;

    //I20-968: gli elementi in noRender stanno sul record, non sul sottogruppo. Se si
    //impagina a partire dal sottogruppo la chiave va portata avanti, altrimenti una
    //reimpaginazione riporta visibili gli elementi che l'operatore aveva nascosto.
    if (tracciatoPrimario != null && tracciatoPrimario.noRenderElementi == null) {
        tracciatoPrimario.noRenderElementi = primario.recordInTracciato.noRenderElementi;
    }

    let listaFoto = [];
    if (tracciatoPrimario.membriGruppoFoto != null) {
        listaFoto = tracciatoPrimario.membriGruppoFoto
            .filter(membro => membro.nomeFoto && membro.statoSelezione == 2)
            .map(membro => {
                return {
                    nomeFoto: membro.nomeFoto,
                    hash: membro.hash
                };
            });
    }

    if (tracciatoPrimario["Foto.Nome"] != "") {
        listaFoto.push({
            nomeFoto: tracciatoPrimario["Foto.Nome"],
            hash: tracciatoPrimario["Foto.Hash"]
        });
    }

    return {
        primario: primario,
        tracciatoPrimario: tracciatoPrimario,
        compiledFields: tracciatoPrimario.compiledFields,
        deletedFields: tracciatoPrimario.deletedFields,
        fotoExtra: tracciatoPrimario["Foto.Extra"],
        fotoExtraAuto: tracciatoPrimario["Foto.ExtraAuto"],
        listaFoto: listaFoto
    };
}



/// IMPAGINAZIONE. Sistema una referenza impaginata male, senza rifare tutto il box.
async function fixRefImpaginata() {
    try{
        //controlliamo la ref
        var listItemDaFixare = [];
        var map = {};
        var reportObj = {
            segnalazioni: []
        }

        //for (var i = 0; i < app.selection.length; i++) {
            //cerchiamo base
            // var DNA = Utility.getDNAFromBox(app.selection[0]);
            // //var base = Utility.getFieldByLabel("base", app.selection[0]);
            // if (DNA == null) {
            //     messaggioUtente("Code IDX-42 fixRef: elemento con etichetta Base non trovata nel box", "error");
            //     return;
            // }
            var dna = null;
            var box = Utility.getBoxFromElementOfBox(app.selection[0]);
            if (box == null) {
                messaggioUtente("Code IDX-42 fixRef: elemento selezionato non è un box valido", "error");
                return;
            }
            
            dna = Utility.getDnaOfBox(box);
            var codiceGruppo = dna.codice_gruppo;
            var idRec = null;


            if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                idRec = parseInt(dna.idRec);
            }

            //base c'è, ora controlliamo se i bounds correnti e originali sono diversi di dimensione (non posizione)

            var bounds = box.geometricBounds;
            var schedaRefData = null;
            var originalBounds = null;
            if (schedaRef.schedeRefDati != null) {
                schedaRefData = schedaRef.schedeRefDati.find(function (s) {
                    if (s.recordInTracciato["Scatto.CodiceGruppo"].toString() != codiceGruppo || s.recordInTracciato.StatoSelezione != 1) {
                        return false;
                    }

                    if (idRec == null) {
                        return true;
                    }

                    return getIdRecFromItemRef(s.recordInTracciato) === idRec;
                });
                if (schedaRefData != null) {
                    originalBounds = schedaRef.refSelected.boxOriginalBounds;
                }
            }

            //se i bounds sono larghi o alti diversi dagli original (se ci sono)
            if (originalBounds != null) {
                var widthOriginal = originalBounds[3] - originalBounds[1];
                var heightOriginal = originalBounds[2] - originalBounds[0];
                var widthCurrent = bounds[3] - bounds[1];
                var heightCurrent = bounds[2] - bounds[0];
                //se sono diversi
                if (Math.abs(widthOriginal - widthCurrent) > 0.1 || Math.abs(heightOriginal - heightCurrent) > 0.1) {
                    const top = bounds[0];
                    const left = bounds[1];
                    box.geometricBounds = [
                        top,
                        left,
                        top + heightOriginal,
                        left + widthOriginal
                    ];
                }
            }

            //ora la dimensione è corretta, mappiamo
            for (var j = 0; j < app.selection[0].allPageItems.length; j++) {
                if (app.selection[0].allPageItems[j].label != "") {
                    //aggiungiamo in mappa una chiave della label e valore l'item selezionato
                    map[Utility.parseLabel(app.selection[0].allPageItems[j].label)] = app.selection[0].allPageItems[j].geometricBounds;
                }
                else {
                    //lo aggiungiamo usando l'id univoco
                    map[app.selection[0].allPageItems[j].id] = app.selection[0].allPageItems[j].geometricBounds;
                }
            }
            
            //ripristiniamo i bounds
            box.geometricBounds = bounds;

            securityCounter = 0;
            while (box.parent.constructor.name != "Spread" && securityCounter < 1000) {
                box = box.parent;
                securityCounter++;
            }
            listItemDaFixare.push({ box: box, codiceGruppo: codiceGruppo, idRec: idRec, map: map });
        //}

        // for (var a = 0; a < listItemDaFixare.length; a++) {
        //     var bounds = listItemDaFixare[a].box.geometricBounds;
        //     var schedaRefData = null;
        //     var originalBounds = null;
        //     if (schedaRef.schedeRefDati != null) {
        //         schedaRefData = schedaRef.schedeRefDati.find(s => s.recordInTracciato["Scatto.CodiceGruppo"].toString() == codiceGruppo && s.recordInTracciato.StatoSelezione == 1);
        //         if (schedaRefData != null) {
        //             originalBounds = schedaRef.refSelected.boxOriginalBounds;
        //         }
        //     }

        //     //se i bounds sono larghi o alti diversi dagli original
        //     if (originalBounds != null) {
        //         var widthOriginal = originalBounds[3] - originalBounds[1];
        //         var heightOriginal = originalBounds[2] - originalBounds[0];
        //         var widthCurrent = bounds[3] - bounds[1];
        //         var heightCurrent = bounds[2] - bounds[0];
        //         //se sono diversi
        //         if (Math.abs(widthOriginal - widthCurrent) > 0.1 || Math.abs(heightOriginal - heightCurrent) > 0.1) {
        //             const top = bounds[0];
        //             const left = bounds[1];
        //             listItemDaFixare[a].box.geometricBounds = [
        //                 top,
        //                 left,
        //                 top + heightOriginal,
        //                 left + widthOriginal
        //             ];
        //         }
        //     }
        // }

    
        if (listItemDaFixare.length == 0) {
            messaggioUtente("Code IDX-43 fixRef: Nessuna ref valida selezionata", "error");
            return;
        }


    
        indesignEvents.setBusy(true);
    
        var confirmRes = await Modali.confirm("Ridimensionare il box alle dimensioni desiderate");


        for (var a = 0; a < listItemDaFixare.length; a++) {

            var bounds = listItemDaFixare[a].box.geometricBounds;

            if (bounds == null) {
                messaggioUtente("Code IDX-44 fixRef: Impossibile recuperare i bounds del box selezionato", "error");
                indesignEvents.setBusy(false);
                return;
            }

            listItemDaFixare[a].bounds = bounds;

            var itemDaFixare = listItemDaFixare[a];
            for (var b = 0; b < itemDaFixare.box.allPageItems.length; b++) {
                if (itemDaFixare.box.allPageItems[b].label != "") {
                    if (itemDaFixare.map[Utility.parseLabel(itemDaFixare.box.allPageItems[b].label)] == null) {
                        messaggioUtente("Code IDX-45 fixRef: L'elemento con etichetta " + itemDaFixare.box.allPageItems[b].label + " è stato aggiunto illegalmente, l'operazione verrà annullata.", "error");
                        confirmRes = false;
                    }
                    else{
                        itemDaFixare.box.allPageItems[b].geometricBounds = itemDaFixare.map[Utility.parseLabel(itemDaFixare.box.allPageItems[b].label)]
                    }
                }
                else {
                    if (itemDaFixare.map[itemDaFixare.box.allPageItems[b].id] == null) {
                        messaggioUtente("Code IDX-46 fixRef: L'elemento senza etichetta e con id " + itemDaFixare.box.allPageItems[b].id + " è stato aggiunto illegalmente, l'operazione verrà annullata.", "error");
                        confirmRes = false;
                    }
                    else{
                        itemDaFixare.box.allPageItems[b].geometricBounds = itemDaFixare.map[itemDaFixare.box.allPageItems[b].id]
                    }
                }
            }
        }
    
    
        if(!confirmRes){
            indesignEvents.setBusy(false);

            return;
        }
    
    
        CssFramework.richiediDiScaricareFramework();
    
    
        var pacchettiTerminati = 0;

        for (var k = 0; k < listItemDaFixare.length; k++) {
            var boxImpaginato = listItemDaFixare[k].box;
            var codiceGruppo = listItemDaFixare[k].codiceGruppo;
            var idRec = listItemDaFixare[k].idRec;
            var bounds = listItemDaFixare[k].bounds;

            var datiRef = null;

            try {
                var schedaRefData = null;

                if (schedaRef.schedeRefDati != null) {
                    schedaRefData = schedaRef.schedeRefDati.find(function (s) {
                        if (s.recordInTracciato["Scatto.CodiceGruppo"].toString() != codiceGruppo
                            || s.recordInTracciato.StatoSelezione != 1) {
                            return false;
                        }

                        if (idRec == null) {
                            return true;
                        }

                        return getIdRecFromItemRef(s.recordInTracciato) === idRec;
                    });
                }

                if (schedaRefData == null) {
                    datiRef = await getSchedaRefAsync(schedaRef, codiceGruppo, idRec);
                } else {
                    datiRef = schedaRefData.recordInTracciato;
                }

                //I20-1029: il box si rifa' da capo, e le sue segnalazioni con lui: il bollino di
                //prima non vale piu'. Le nuove, se ce ne sono, le scrive finalizzaSegnalazioni.
                segnalazioniBoxImpaginato = [];
                boxImpaginato = Segnalazioni.togliDalBox(boxImpaginato);

                boxImpaginato = await callAllOperationFixBox(boxImpaginato, bounds, datiRef);

                // aggiorniamo boxOriginalBounds
                schedaRef.refSelected.item = boxImpaginato;
                schedaRef.refSelected.boxOriginalBounds = boxImpaginato.geometricBounds;

                boxImpaginato = finalizzaSegnalazioni(reportObj, codiceGruppo, boxImpaginato);

            } catch (errore) {
                messaggioUtente(
                    "Code IDX-47 fixRef: Errore durante il recupero/elaborazione della scheda ref per il codice gruppo "
                    + codiceGruppo + ": " + errore,
                    "error"
                );

                indesignEvents.setBusy(false);
                return;
            }
        }
        //creiamo il file di report con le segnalazioni
        
        indesignEvents.setBusy(false);
        
        messaggioUtente("Code IDX-49 fixRef: Operazione completata con successo", "success", false, 3);
        
        stampaSegnalazioni(reportObj);
    }
    catch(ex){
        indesignEvents.setBusy(false);
        messaggioUtente("Code IDX-50 fixRef: Errore durante l'elaborazione: " + ex.toString(), "error");
        console.error(ex);
    }

}

/// Avvolge schedaRef.getSchedaRef, che lavora a callback, in una Promise.
///
/// Il primo parametro si chiama come il modulo globale schedaRef e lo nasconde dentro il
/// corpo della funzione. Funziona perche' chi la chiama passa proprio quel modulo, ma e' un
/// nome che inganna: qui dentro `schedaRef` non e' la globale.
///
/// DA SPOSTARE (task di divisione): in schedaRef.js, accanto alla funzione che avvolge.
function getSchedaRefAsync(schedaRef, codiceGruppo, idRec = 0) {
    return new Promise(function (resolve, reject) {
        schedaRef.getSchedaRef(codiceGruppo, function (errore, data) {
            if (errore != null) {
                reject(errore);
                return;
            }

            resolve(data);
        }, idRec);
    });
}

/// Mette da parte un avviso nato durante l'impaginazione di un box, in attesa che
/// finalizzaSegnalazioni lo tiri fuori.
///
/// Le segnalazioni non si mostrano subito: un box ne puo' produrre diverse, e vanno
/// raccolte per essere presentate insieme e in ordine di gravita'. Le priorita' sono 1
/// alta, 2 media, 3 bassa.
///
/// impostazioniBollino ha sei posizioni - testo, colore, e altre quattro - e il chiamante
/// puo' passarne meno: le mancanti vengono completate coi valori di riferimento. E' la
/// ragione della scaletta di if, che altrimenti non avrebbe senso.
///
/// I20-1029: il bollino e la sua etichetta stanno in segnalazioni/ (segnalazioni.js,
/// etichetta.js). Qui restano la raccolta durante l'impaginazione e il report di fine.
function addSegnalazione(msg, typeMessage = "Error", priority = 2, applicaBollino = true, impostazioniBollino = ["", "red", null, 0, null, false], key = null) {
    //le priority sono 1 (alta), 2 (media), 3 (bassa)
    //aggiungiamo la segnalazione in segnalazioniBoxImpaginato
    //in impostaBollino potremmo ricevere array con meno parametri, in quel caso integriamo quelli che mancano con i valori di default
    if (impostazioniBollino == null) {
        impostazioniBollino = ["", "red", null, 0, null, false];
    }
    if(impostazioniBollino.length < 6){
        if (impostazioniBollino.length < 1){
            impostazioniBollino.push("");
        }
        if (impostazioniBollino.length < 2){
            impostazioniBollino.push("red");
        }
        if (impostazioniBollino.length < 3){
            impostazioniBollino.push(null);
        }
        if (impostazioniBollino.length < 4){
            impostazioniBollino.push(0);
        }
        if (impostazioniBollino.length < 5){
            impostazioniBollino.push(null);
        }
        if (impostazioniBollino.length < 6){
            impostazioniBollino.push(false);
        }
    }
    var segnalazione = { msg: msg, typeMessage: typeMessage, priority: priority, applicaBollino: applicaBollino, impostazioniBollino: impostazioniBollino, key: key };
    //I20-1029: il motore CSS ripassa piu' volte sugli stessi controlli; la stessa segnalazione
    //(stessa chiave o stesso testo) entra una volta sola.
    if (etichettaSegnalazioni.giaPresente(segnalazioniBoxImpaginato, segnalazione)) {
        return;
    }
    segnalazioniBoxImpaginato.push(segnalazione);
}

/// Chiude le segnalazioni raccolte per un box: le ordina per gravita', ne fa un unico
/// messaggio nel report, scrive nel bollino del box tutte le segnalazioni, e svuota la lista
/// per il box successivo.
///
/// I20-1029: il bollino e' uno solo per box, vuoto, del colore della gravita' peggiore, e la sua
/// etichetta le contiene tutte (segnalazioni/etichetta.js). Prima portava come testo la sola
/// prima segnalazione con applicaBollino, mandata apposta in overflow, e le altre si perdevano;
/// i colori delle impostazioniBollino dei chiamanti non contano piu': decide la gravita'.
function finalizzaSegnalazioni(reportImpaginazioneObj = { segnalazioni: [] }, codiceGruppo, boxImpaginato = null) {
    var segnalazioni = segnalazioniBoxImpaginato.sort((a, b) => a.priority - b.priority);
    //aggiungiamo le segnalazioni al reportObj, nel report mettiamo solo un messaggio formato da
    //prima inseriamo il codice gruppo (solo se ha segnalazioni)
    //typeMessage: + msg
    if (segnalazioni.length > 0) {
        var msg = "Codice gruppo " + codiceGruppo + ": \n";
        var typeMessage = "Notifica";
        segnalazioni.forEach(s => {
            msg += "- " + s.typeMessage + ": " + s.msg + "\n";
            //il typeMessage del report sarà il più grave tra tutte le segnalazioni (Error > Warning > Notifica)
            if (s.typeMessage.toLowerCase() == "error" && typeMessage != "error") {
                typeMessage = "error";
            }
            else if (s.typeMessage.toLowerCase() == "warning" && typeMessage != "error") {
                typeMessage = "warning";
            }
        });
        reportImpaginazioneObj.segnalazioni.push({ codiceGruppo: codiceGruppo, msg: msg, typeMessage: typeMessage });
    }
    //I20-1029: un solo bollino per box, vuoto, del colore della gravita' peggiore, con TUTTE le
    //segnalazioni nell'etichetta. Prima ne disegnava una sola, la prima con applicaBollino, con il
    //testo mandato apposta in overflow, e le altre si perdevano. Senza segnalazioni il bollino
    //non si tocca: questa funzione arriva due volte per box, e la seconda con la lista vuota.
    if (boxImpaginato != null && segnalazioni.length > 0) {
        boxImpaginato = Segnalazioni.applicaAlBox(boxImpaginato, segnalazioni.map(s => etichettaSegnalazioni.daSegnalazione(s)));
    }

    //svuotiamo le segnalazioni
    segnalazioniBoxImpaginato = [];
    return boxImpaginato;
}

/// A fine impaginazione scrive tutte le segnalazioni raccolte in un file di testo nella
/// cartella dei log, e avvisa l'operatore con un solo messaggio del colore della
/// segnalazione piu' grave.
///
/// Un messaggio per ogni segnalazione sarebbe illeggibile dopo un'impaginazione da
/// centinaia di box: qui si dice quante sono e dove leggerle.
///
/// Il nome del file contiene data e ora fino ai secondi, cosi' i report non si
/// sovrascrivono fra loro.
function stampaSegnalazioni(reportImpaginazioneObj = { segnalazioni: [] }) {
    //se ci sono segnalazioni in segnalazioniBoxImpaginato stampiamo un unico messaggio che avvisa l'utente di controllare le segnalazioni.
    //il colore del messaggio dipende dal typeMessage più grave presente nelle segnalazioni.
    if (reportImpaginazioneObj.segnalazioni.length > 0) {
        var nomeFileReport = "reportSegnalazioni_" + idKitLavorazione + "_" + new Date().getDate() + "_" + new Date().getMonth() + "_" + new Date().getFullYear() + "__" + new Date().getHours() + ":" + new Date().getMinutes() + ":" + new Date().getSeconds() + ".txt";
        var percorsoFileReport = /*pathLavorazione +*/ percorsoLogs + nomeFileReport;
        var reportContent = "Segnalazioni durante l'impaginazione:\n\n";

        var typeMessagePiuGrave = "success";
        reportImpaginazioneObj.segnalazioni.forEach(s => {
            reportContent += s.msg;
            if (s.typeMessage.toLowerCase() == "error" && typeMessagePiuGrave != "error") {
                typeMessagePiuGrave = "error";
            }
            else if (s.typeMessage.toLowerCase() == "warning" && typeMessagePiuGrave != "error") {
                typeMessagePiuGrave = "warning";
            }
        });
        messaggioUtente("Sono presenti " + reportImpaginazioneObj.segnalazioni.length + (reportImpaginazioneObj.segnalazioni.length > 1 ? " segnalazioni" : " segnalazione") + ", controlla il report per maggiori dettagli.", typeMessagePiuGrave.toLowerCase(), false, 10);
        
        //creiamo il file di report
        fs.writeFileSync(percorsoFileReport, reportContent);
    }
}

/// Mette in fila tutte le sistemazioni che un box subisce dopo essere stato compilato:
/// overflow, ridimensionamento CSS, e quello che il CssFramework applica di seguito.
///
/// E' il punto in cui l'impaginazione smette di collocare contenuti e comincia a farli
/// stare dentro lo spazio che hanno.
async function callAllOperationFixBox(boxImpaginato, bounds, itemRef, garbageKey = null, modalitaOperazioniRidimensionamento = 0) {
    CssFramework.fixOverflowFromBox(boxImpaginato.geometricBounds, boxImpaginato);
    var mappaBoxOriginale = null;
    var tipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();
    var res = {
        esito: false,
        mappaBoxOriginale: mappaBoxOriginale
    };



        var res = await CssFramework.applicaRidimensionamentoCss(boxImpaginato, bounds, itemRef, garbageKey, modalitaOperazioniRidimensionamento);

        if (res != null && res.esito) {
            mappaBoxOriginale = res.mappaBoxOriginale;
            boxImpaginato = res.box;
        }
        await Utility.sleep(200);
    



        boxImpaginato = CssFramework.applicaAllineamentoCss(boxImpaginato, bounds, mappaBoxOriginale, itemRef);
    

    if (tipoLavorazione == 2) {
        CssFramework.reflowTextFrameAvoidConflicts(Utility.getFieldByLabel("descrizione", boxImpaginato),
            boxImpaginato,
            pluginMiddleware.getCampo("etichetteEsclusePerFixDescrizione") !== null ? pluginMiddleware.getCampo("etichetteEsclusePerFixDescrizione") : []);
    }

    var fixFotoLavorazioni = [1];

    if(customAgenzia.fixFotoLavorazioni != null){
        fixFotoLavorazioni = customAgenzia.fixFotoLavorazioni;
    }


    CssFramework.sospendiControlloSegnalazioniConflitti = true;
    try {
        if (customAgenzia.setCustomFixFoto != null) {
            boxImpaginato = customAgenzia.setCustomFixFoto(boxImpaginato);
        }
        else if (fixFotoLavorazioni.includes(tipoLavorazione)) {
            var res = SistemazioneFoto.getSpazioImpaginazione(boxImpaginato);
            SistemazioneFoto.fixFoto(boxImpaginato, res.candidate, res.obstacles);
        }
    }
    finally {
        CssFramework.sospendiControlloSegnalazioniConflitti = false;
    }

    //La sistemazione delle foto ha appena spostato le immagini. Qui vanno le operazioni che
    //devono inseguirle: le regole dichiarate per il momento dopoFixFoto e gli elementi derivati,
    //come le ombre, che prendono le misure dalle foto.
    boxImpaginato = CssFramework.applicaOperazioniDopoFixFoto(boxImpaginato, bounds);

    CssFramework.controllaSegnalazioniConflittiPendenti(boxImpaginato);

    return boxImpaginato;
}

/// Allarga un campo che trabocca, un passo alla volta, fino a che ci sta o fino a cento
/// tentativi.
///
/// Di quanto e in che direzione crescere non lo decide questa funzione: lo dice
/// pluginMiddleware.getOverflowsInstruction leggendo la configurazione del cliente
/// (campiSoggettiAOverflow). Se quel campo non e' fra quelli previsti, non si tocca niente.
///
/// Il campo non puo' uscire dal box: prima di applicare lo spostamento i nuovi bounds
/// vengono tagliati su quelli del box, e lo step ridotto di conseguenza. Quando tutti e
/// quattro gli step diventano zero si esce - il campo tocca i bordi e non c'e' altro spazio
/// da dargli. Il limite dei cento tentativi e' la rete di sicurezza.
///
/// NOTA (I20-1002): overflowInstruction e' assegnata senza var, let o const, quindi e' una
/// globale implicita. Il file non ha "use strict", percio' passa inosservata. Funziona
/// solo perche' viene riscritta a ogni chiamata prima di essere letta.
///
/// DA SPOSTARE (task di divisione): e' una regola di impaginazione sul contenuto di un
/// campo, come quelle del CssFramework. Starebbe li'.
function applyOverflowFix(boxbounds, field) {
    try{
        if(field == null || !field.overflows)
        {
            return;
        }
        overflowInstruction = pluginMiddleware.getOverflowsInstruction(field);
        if(overflowInstruction == null){
            return;
        }
        let tentativi = 0;
        //let stepVal = 1;
        while (field.overflows && tentativi < 100) {
            //Overflows da gestire
            let stepToResolve = [0, 0, 0, 0];
            if (overflowInstruction[0] != 0) {
                //Ho alzato il campo, devo tentare di alzarlo pian piano adesso
                //stepToResolve[0] = -(stepVal);
                stepToResolve[0] = (overflowInstruction[0]);
            }
            else if (overflowInstruction[2] != 0) {
                //Ho abbassato il campo, devo tentare di abbassarlo pian piano adesso
                //stepToResolve[2] = stepVal;
                stepToResolve[2] = overflowInstruction[2];
            }
    
            if (overflowInstruction[1] != 0) {
                //Ho alzato il campo, devo tentare di alzarlo pian piano adesso
                //stepToResolve[1] = -(stepVal);
                stepToResolve[1] = (overflowInstruction[1]);
            }
            else if (overflowInstruction[3] != 0) {
                //Ho abbassato il campo, devo tentare di abbassarlo pian piano adesso
                //stepToResolve[3] = stepVal;
                stepToResolve[3] = overflowInstruction[3];
            }
    
            //prima di applicare controlliamo se i nuovi bounds uscirebbero fuori dal box
            //se uscirebbero riduciamo per far si che il bound che esce vada a toccare il bound del box
            let newBounds = [
                field.geometricBounds[0] + stepToResolve[0],
                field.geometricBounds[1] + stepToResolve[1],
                field.geometricBounds[2] + stepToResolve[2],
                field.geometricBounds[3] + stepToResolve[3]
            ];
            if (newBounds[0] < boxbounds[0]) {
                //uscirebbe sopra
                newBounds[0] = boxbounds[0];
                //adeguo lo step
                stepToResolve[0] = boxbounds[0] - field.geometricBounds[0];
            }
            if (newBounds[1] < boxbounds[1]) {
                //uscirebbe a sinistra
                newBounds[1] = boxbounds[1];
                //adeguo lo step
                stepToResolve[1] = boxbounds[1] - field.geometricBounds[1];
            }
            if (newBounds[2] > boxbounds[2]) {
                //uscirebbe sotto
                newBounds[2] = boxbounds[2];
                //adeguo lo step
                stepToResolve[2] = boxbounds[2] - field.geometricBounds[2];
            }
            if (newBounds[3] > boxbounds[3]) {
                //uscirebbe a destra
                newBounds[3] = boxbounds[3];
                //adeguo lo step
                stepToResolve[3] = boxbounds[3] - field.geometricBounds[3];
            }
    
            field.geometricBounds = [
                field.geometricBounds[0] + stepToResolve[0],
                field.geometricBounds[1] + stepToResolve[1],
                field.geometricBounds[2] + stepToResolve[2],
                field.geometricBounds[3] + stepToResolve[3]
            ];
    
            //se tutti fli step sono 0 esco dal ciclo
            if (stepToResolve[0] == 0 && stepToResolve[1] == 0 && stepToResolve[2] == 0 && stepToResolve[3] == 0) {
                break;
            }
    
            tentativi++;
    
        }

        console.log("Tentativi overflow risolti: " + tentativi);
    }
    catch(ex){
        console.error(ex);
    }
        
}

/// Trasforma il nome di un campo in una regex, con l'asterisco come jolly:
/// "prezzo*" diventa /^prezzo.*$/. Serve a ritrovare un campo del box partendo
/// dal nome scritto nella referenza (compiledFields, deletedFields).
///
/// NON e' CssFramework.makeRegexFromGroupName, da cui si chiamava uguale fino a
/// I20-1002: quella toglie prima i suffissi [itemLink] e [exist], questa no.
/// Il nome uguale era una trappola, perche' questa e' una globale: una chiamata
/// dentro CssFramework scritta senza this. non dava ReferenceError, cadeva qui e
/// si comportava in modo diverso senza dirlo a nessuno.
function makeRegexFromFieldName(groupName) {
    // Escapa i caratteri speciali, tranne *
    let escaped = groupName.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    // Converte * in .*
    let regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr);
}


/// IMPAGINAZIONE. Costruisce il singolo box: prende la meccanica dalla libreria, compila i
/// campi, colloca le foto, applica il CSS. 751 righe.
async function impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, tipoLavorazione, reportImpaginazioneObj, preAnalisi = null, refConfronto = null, docOperazione = docInLavorazione) {
    try{
        if (preAnalisi != null && preAnalisi.differenze.length == 0) {
            return {
                trovato : true,
                listElementiNonImpaginati : listElementiNonImpaginati,
                boxAggiunto : refConfronto
            }
        }
        var doc = docOperazione;
        var boxImpaginato = null;
        //I20-1029: le segnalazioni partono vuote per ogni box. Se il box di prima e' andato in
        //errore prima di chiuderle, non devono passare a questo.
        segnalazioniBoxImpaginato = [];

        var trovato = false;
        var error = "Meccanica non trovata";
        let nessCharStyle=doc.characterStyles.item("NESSUNO");
        let nessCharStyleSys = doc.characterStyles.item("[Nessuno]");
        if (!nessCharStyle.isValid)
        {
            nessCharStyle=doc.characterStyles.item("[Nessuno]");
        }

        for (var i = 0; i < doc.masterSpreads.length; i++) {
            var masterSpread = doc.masterSpreads.item(i);
            var declinazioneMeccanica = pluginMiddleware.getDeclinazioneMeccanica != null ? pluginMiddleware.getDeclinazioneMeccanica(itemRef) : "";
            var nomeMasterSpread = "meccaniche"+declinazioneMeccanica;
            if (masterSpread.baseName.toLowerCase() != nomeMasterSpread.toLowerCase()) {
                continue;
            }
            for (var j = 0; j < masterSpread.groups.length; j++) {
                //se il gruppo non è sul layer inPagina saltiamo
                if (masterSpread.groups.item(j).itemLayer.name != "InPagina") {
                    continue;
                }

                var boxMeccanica = masterSpread.groups.item(j);
                if ((meccanica != "" && boxMeccanica.label == meccanica) /*|| (meccanicaAlt != "" && boxMeccanica.label == meccanicaAlt)*/) {
                    let garbageKey = null;
                    try{
                        boxImpaginato = boxMeccanica.duplicate(pagCoinvolta);
                        //logContent += "PAG -> " + pagCoinvolta.name + " - Meccanica " + meccanica + " trovata, procedo con l'impaginazione\n";
                        console.log("PAG -> " + pagCoinvolta.name + " - Meccanica " + meccanica + " trovata, procedo con l'impaginazione");
                        //boxImpaginato.geometricBounds = bounds;
                        if (bounds == null) {
                            // consideriamo i bleed del documento
                            var topBleed = doc.documentPreferences.documentBleedTopOffset;
                            var leftBleed = doc.documentPreferences.documentBleedInsideOrLeftOffset;
    
                            if (tipoLavorazione == 1) {
                                // posiziona in alto a sinistra tenendo conto dei bleed
                                boxImpaginato.move([pagCoinvolta.bounds[1] - leftBleed, pagCoinvolta.bounds[0] - topBleed]);
                                bounds = boxImpaginato.geometricBounds;
                            }
                            else {
                                // centriamo il box in pagina tenendo conto dei bleed
                                var wPage = pagCoinvolta.bounds[3] - pagCoinvolta.bounds[1];
                                var wBox = boxImpaginato.geometricBounds[3] - boxImpaginato.geometricBounds[1];
                                var hPage = pagCoinvolta.bounds[2] - pagCoinvolta.bounds[0];
                                var hBox = boxImpaginato.geometricBounds[2] - boxImpaginato.geometricBounds[0];
    
                                var targetX = ((wPage - wBox) / 2) + pagCoinvolta.bounds[1];
                                var targetY = ((hPage - hBox) / 2) + pagCoinvolta.bounds[0];
    
                                boxImpaginato.move([targetX, targetY]);
                                bounds = boxImpaginato.geometricBounds;
                            }
                        }
                        else {
                            boxImpaginato.move([bounds[1], bounds[0]]);
                        }
                        console.log("bindRefData");
                        //da riattivare e mettere ageznia edro
                        //Compilazione CORE
                        //var base = null;
                        //Imposto il DNA cerecando BASE

                        var campiDNA = pluginMiddleware.getRegoleApplicazioneDNA(itemRef);

                        // for (let r = 0; r < boxImpaginato.allPageItems.length; r++) {
                        //     let field = boxImpaginato.allPageItems[r];
                            // if (Utility.parseLabel(field.label).startsWith("base")) {
                            //     if (itemRef["Scatto.CodiceGruppo"] == "613372,613380,613398")//23614 liquore che si centra pag.103
                            //         console.log("debug");
    
                            //     field.label += "$" + boxImpaginato.label + "$" + itemRef["Referenza.Codice"] + "$" + itemRef["Scatto.CodiceGruppo"] + "$" +itemRef["idRec"];
                            //     base = field;
                            // }
                        // }
    
                        var resRidimensionamento = null;
    
                        resRidimensionamento = await CssFramework.applicaRidimensionamentoCss(boxImpaginato, bounds, itemRef, null, 1);
    
    
    
                        let elementiDaGruppare = [];
                        if (useCompiledField && itemRef.compiledFields != null) {
                            garbageKey = requireKeyForGarbage();
                            let fotoAlreadyProcessed = false;
    
                            //console.log("Ref compilata");
                            //console.log(itemRef.Compiled);
                            //console.log(boxImpaginato.allPageItems.length);
                            var noFotoLogoCaricato = false;
                            try {
                                var noFoto = fs.readFileSync(/*pathLavorazione +*/ percorsoLinks + (pluginMiddleware.getCampo("nomeNoFoto") != null ? pluginMiddleware.getCampo("nomeNoFoto") : "nofoto.png"));
                                noFotoLogoCaricato = true;
                            }
                            catch (e) {
                                noFotoLogoCaricato = false;
                            }
                            var listElementToSendBack = [];
                            var myPage = boxImpaginato.parentPage;
                            
                            // var base = null;
                            try {
                                for (let r = 0; r < boxImpaginato.allPageItems.length; r++) {
                                    let field = boxImpaginato.allPageItems[r];
    
                                    //console.log("field....");
    
                                    let lab_field = Utility.parseLabel(field.label);
                                    if (lab_field != "") {
    
                                        if (lab_field.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine")
                                            || lab_field.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria")) {
                                            if (fotoAlreadyProcessed)
                                                continue;
    
                                            fotoAlreadyProcessed = true;
    
                                            var imgDeleted = false;
    
                                            if (itemRef.deletedFields != null && itemRef.deletedFields.length > 0) {
                                                let deleteField = itemRef.deletedFields.find(f => makeRegexFromFieldName(f).test(lab_field));
    
                                                if (deleteField != null) {
                                                    //è stato cancellato, eliminiamo il campo
                                                    console.log("Campo foto cancellato, elimino il campo");
                                                    imgDeleted = true;
                                                    field.visible = false;
                                                    gC.Add(field, garbageKey);
                                                }
                                            }
    
                                            if (!imgDeleted) {
                                                var secondarie = 0;
                                                var listFoto = [];
                                                //var elementiGruppo = listaTracciato.records.filter(f=>f.recordInTracciato["Scatto.CodiceGruppo"] == itemRef["Scatto.CodiceGruppo"]);
                                                if (itemRef.membriGruppoFoto==null)
                                                    itemRef.membriGruppoFoto = [];
    
                                                for (var im = 0; im < itemRef.membriGruppoFoto.length; im++) {
                                                    var elemento = itemRef.membriGruppoFoto[im];
                                                    if (elemento.statoSelezione == 2) {
                                                        var nomeFoto = elemento.nomeFoto;
                                                        var offset = 5 * (secondarie + 1);
                                                        var g_new = [field.geometricBounds[0] + offset, field.geometricBounds[1] + offset, field.geometricBounds[2] + offset, field.geometricBounds[3] + offset];
                                                        //controlliamo se i buond escono fuori dal box, se lo fanno riduciamo l'x o la y necessarie per farlo stare
                                                        if (g_new[2] > boxImpaginato.geometricBounds[2]) {
                                                            g_new[0] = g_new[0] - (g_new[2] - boxImpaginato.geometricBounds[2]);
                                                            g_new[2] = boxImpaginato.geometricBounds[2];
                                                        }
                                                        if (g_new[3] > boxImpaginato.geometricBounds[3]) {
                                                            g_new[1] = g_new[1] - (g_new[3] - boxImpaginato.geometricBounds[3]);
                                                            g_new[3] = boxImpaginato.geometricBounds[3];
                                                        }
                                                        var photo = field.parentPage.rectangles.add(field.itemLayer, LocationOptions.UNKNOWN, { geometricBounds: g_new });
                                                        listFoto.push(photo);
                                                        try {
                                                            var label = (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") + "$" : "foto_secondaria$") + elemento.codRef;
                                                            FotoPlacer.placeFoto(nomeFoto, photo);
                                                            //Impaginata comunque, resa invisibile se richiesto dai meta della lavorazione
                                                            FotoPlacer.applicaNoRender(photo, elemento.noRender);
                                                            secondarie++;
                                                            //mettiamo foto sul livello InPagina
                                                            photo.label = label;
                                                            photo.itemLayer = doc.layers.item("InPagina");
                                                            listElementToSendBack.push(photo);
                                                            elementiDaGruppare.push(photo);
                                                        }
                                                        catch (err) {
                                                            //eliminiamo la foto secondaria
                                                            photo.remove();
                                                            console.log(err);
                                                            messaggioUtente("Code IDX-52: Foto secondaria " + elemento.nomeFoto + " non posizionata, errore:" + err, "error")
                                                        }
                                                    }
                                                }
                                                try {
                                                    listFoto.unshift(field);
                                                    var nomeFoto = itemRef["Foto.Nome"];
                                                    field.label = (pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria")+"$" :"immagine$") + itemRef["Referenza.Codice"];
                                                    FotoPlacer.placeFoto(nomeFoto, field);
                                                    //L'opzione di rendering della primaria viaggia dentro membriGruppoFoto,
                                                    //non sul record contenitore del box.
                                                    var membroPrimaria = itemRef.membriGruppoFoto.find(m => m.statoSelezione == 1);
                                                    FotoPlacer.applicaNoRender(field, membroPrimaria != null && membroPrimaria.noRender);
                                                    listElementToSendBack.push(field);
                                                } catch (err) {
                                                    console.log(err);
                                                }
                                                //cicliamo adesso tutti gli elementi del box cercando quelo che inizia per base e che con lo split[0] sia uguale a base
                                                for (var jm = 0; jm < field.parent.allPageItems.length; jm++) {
                                                    var item2 = field.parent.allPageItems[jm];
                                                    if (item2.label != null && item2.label != "" && item2.label.startsWith("base")) {
                                                        listElementToSendBack.unshift(item2);
                                                        //base = item2;
                                                    }
                                                }
                                            }    
                                        }
                                        else if (lab_field == "sfondo") {
    
                                            if (itemRef.deletedFields != null && itemRef.deletedFields.length > 0) {
                                                let deleteField = itemRef.deletedFields.find(f => makeRegexFromFieldName(f).test(lab_field));
    
                                                if (deleteField != null) {
                                                    //è stato cancellato, eliminiamo il campo
                                                    console.log("Campo sfondo cancellato, elimino il campo");
                                                    imgDeleted = true;
                                                    field.visible = false;
                                                    gC.Add(field, garbageKey);
                                                    continue;
                                                }
                                            }
    
                                            for (var ij = 0; ij < itemRef["Foto.ExtraAuto"].length; ij++) {
                                                if (itemRef["Foto.ExtraAuto"][ij].tipo == 5) {
                                                    var imgName = itemRef["Foto.ExtraAuto"][ij].nome;
                                                    var sigla = itemRef["Foto.ExtraAuto"][ij].sigla;
                                                    var tipo = itemRef["Foto.ExtraAuto"][ij].tipo;
                                                    var path = /*pathLavorazione +*/ percorsoLoghi + imgName;
                                                    //Controllo esstensine
                                                    //idms rappresenta un eccezione
                                                    //Deve essere caricato SOLO 1 VOLTA ew piazzato nella prima pagina in alto a sx
    
                                                    field.label = "sfondo$" + sigla + "$tipo_" + tipo;
                                                    field.place(path);
    
    
                                                    itemRef["Foto.ExtraAuto"][ij].referenceTo = field;
                                                    //base.fillColor = "None";
                                                }
                                            }
                                        }else {
                                            console.log(">>> " + lab_field);
                                            
                                            let matchFieldData = itemRef.compiledFields.find(f => makeRegexFromFieldName(f.labelName).test(lab_field));
                                            let deleteField = itemRef.deletedFields.find(f => makeRegexFromFieldName(f).test(lab_field));
                                            if (matchFieldData != null && deleteField == null) {
                                                if (matchFieldData.content != "" && field.constructor.name == "TextFrame") {
                                                    //Posso compilare il campo con i dati che leggo
                                                    let parag = matchFieldData.paragraphName;
                                                    let content = matchFieldData.content;
    
    
                                                    var originalPar = "[Paragrafo base]"
                                                    if (field.paragraphs.length > 0) {
                                                        originalPar = field.paragraphs.item(0).appliedParagraphStyle;
                                                    }    
                                                    var paragrafoBase = "[Paragrafo base]";
                                                    if (parag != "") {
                                                        if (pluginMiddleware.getCampo("defaultParagraphStyle") !== null) {
                                                            paragrafoBase = pluginMiddleware.getCampo("defaultParagraphStyle");
                                                        }
                                                        var parBase = doc.paragraphStyles.item(paragrafoBase);
                                                        if (!parBase.isValid) {
                                                            messaggioUtente("Code IDX-53: Stile paragrafo base non trovato: " + paragrafoBase, "error");
                                                        }
                                                        else {
                                                            field.paragraphs.item(0).appliedParagraphStyle = parBase;
                                                        }
                                                    }
    
    
                                                    if (parag != null && parag != "") {
                                                        //Parsing del content
                                                        let contentObj = TestoTag.parseContent(content);
                                                        // let haStileDiCarattere = false;
                                                        // if (contentObj.length > 0) {
                                                        //     if (contentObj[0].stile != "") {
                                                        //         haStileDiCarattere = true;
                                                        //     }
                                                        // }
    
                                                        var invalidareStileDiCarattere = pluginMiddleware.getCampo("invalidareStileDiCarattere") !== null ? pluginMiddleware.getCampo("invalidareStileDiCarattere") : false;
    
                                                        if (/*!haStileDiCarattere || */invalidareStileDiCarattere && field.characters.length > 0) {
                                                            field.characters.itemByRange(0, field.characters.length - 1).appliedCharacterStyle = nessCharStyle;
                                                        }
    
                                                        let stile = (TestoTag.parseStile != null ? TestoTag.parseStile(parag, true) : null);
                                                        var par = stile != null ? stile : doc.paragraphStyles.itemByName(parag);
    
                                                        if (par != null && par.isValid && field.paragraphs && field.paragraphs.length > 0) {
                                                            field.paragraphs.item(0).appliedParagraphStyle = par;
                                                        }
                                                        else {
                                                            if (field.paragraphs == null || field.paragraphs.length == 0) {
                                                                messaggioUtente("Code IDX-54: Paragrafo non trovato per il campo: " + lab_field, "warning");
                                                            }
                                                            else {
                                                                messaggioUtente("Code IDX-54: Stile paragrafo non trovato: " + parag + " per il campo: " + lab_field, "warning");
                                                                field.paragraphs.item(0).appliedParagraphStyle = originalPar;
    
                                                            }
                                                            console.warn("Campo: " + lab_field);
                                                            console.warn("Stile paragrafo non trovato: " + parag);
                                                            console.warn("record:")
                                                            console.warn(itemRef);
                                                        }
    
                                                        if (/*!haStileDiCarattere || */invalidareStileDiCarattere && field.characters.length > 0) {
                                                            field.characters.itemByRange(0, field.characters.length - 1).appliedCharacterStyle = nessCharStyleSys;
                                                        }
    
                                                    }
    
                                                    if (content != "" && content != null) {
                                                        TestoTag.applicaTagStringToInndTextFrame(field, content, bounds);
                                                    }
                                                }
                                                else {
                                                    //Se non è niente di specifico lo tratto come elemento visibile/invisibile
                                                    //Per cui se content di CompiledField è vuoto allora lo elimino
                                                    if (matchFieldData.content == "") {
                                                        field.visible = false;
                                                        gC.Add(field, garbageKey);
                                                        //Poi va trovato modo di cestinarli tutti (credo!)       \\
                                                    }
                                                }
                                            }
                                            else if (deleteField != null) {
                                                field.visible = false;
                                                gC.Add(field, garbageKey);
                                                //Rimuovo il campo
                                            }
                                        }
                                    }
                                }
    
                                
    
                                if (itemRef["Foto.ExtraAuto"] != null) {
                                    //I20-1026: i loghi che la regola disattiva del framework CSS vuole fuori da questo
                                    //box non si piazzano. La forma si misura sulla cella della griglia: un box che nasce
                                    //alto o largo ha subito il suo formato. Al fix, callAllOperationFixBox li toglie e
                                    //li rimette se il box cambia forma.
                                    var disattivatiDallaForma = CssFramework.disattivatiDallaForma(boxImpaginato, itemRef, bounds).disattivati;
                                    for (var ij = 0; ij < itemRef["Foto.ExtraAuto"].length; ij++) {
    
                                        if (itemRef["Foto.ExtraAuto"][ij].escluso == true) {
                                            continue;
                                        }
    
                                        if((itemRef["Foto.ExtraAuto"][ij].tipo != 5)){
                                            if (disattivatiDallaForma.has(itemRef["Foto.ExtraAuto"][ij].sigla)) {
                                                continue;
                                            }
                                            //I20-1026: il piazzamento sta in FotoPlacer, comune all'impaginazione e al fix.
                                            elementiDaGruppare.push(FotoPlacer.piazzaFotoExtraAuto(itemRef["Foto.ExtraAuto"][ij], boxImpaginato, pagCoinvolta, doc));
                                        }
                                    }
                                }
    
                                if (itemRef["Foto.Extra"] != null) {
                                    for (var i2 = 0; i2 < itemRef["Foto.Extra"].length; i2++) {
                                        let itemExtra = itemRef["Foto.Extra"][i2];
                                        if (itemExtra.attiva != null && !itemExtra.attiva)
                                        {
                                            continue;
                                        }
                                        let nome = itemExtra.nome;
                                        let tipo = itemExtra.tipo;
                                        var sigla = itemExtra.sigla;
                                        let nomeDaUsare = sigla != null && sigla != "" ? sigla : nome;
    
                                        let path = /*pathLavorazione +*/ percorsoLoghi + nome;
    
                                        var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, boxImpaginato, { geometricBounds: boxImpaginato.geometricBounds })
    
                                        elementiDaGruppare.push(rect);
                                        rect.label = "foto_extra$" + nomeDaUsare + "$tipo_" + tipo;
                                        rect.place(path);
                                        //rect.fit(FitOptions.FRAME_TO_CONTENT);
                                        //Alessio: Ho ripristinato questo al posto di FRAME_TO_CONTENT perchè in Despar faceva un macelllo con i loghi che costringevano il frame ad adattarsi.
                                        //non possiamo permettergli di farlo, se questa cosa era stata fatta per Edro21 va ritestata e capita una misura comune
                                        
                                        let fitType = FitOptions.CONTENT_TO_FRAME;
                                        if (pluginMiddleware.getFitTypeLogo != null) {
                                            fitType = pluginMiddleware.getFitTypeLogo(nomeDaUsare, tipo);
                                        }
    
                                        if (fitType != null) {
                                            rect.fit(fitType);
                                            rect.fit(FitOptions.PROPORTIONALLY);
                                        }
                                        //rect.fillColor = "None";
                                        itemRef["Foto.Extra"][i2].referenceTo = rect;
    
                                    }
                                }
    
                                if (elementiDaGruppare.length > 0) {
                                    //Rifaccio il gruppo se ci somo foto secondarie da includere
    
                                    let page = boxImpaginato.parentPage;
                                    var oldGroup = boxImpaginato;//field.parent;
                                    var oldLabel = oldGroup.label;
                                    var oldItems = oldGroup.pageItems.everyItem().getElements();
                                    oldGroup.ungroup();
    
    
    
    
                                    var newItems = oldItems.concat(elementiDaGruppare);
                                    var newGroup = page.groups.add(newItems);
                                    //photo.sendToBack();
                                    newGroup.label = oldLabel;
                                    boxImpaginato = newGroup;
                                }

    
    
                                let mastroCompiledData = itemRef.compiledFields.find(f => f.labelName == "Mastro");
                                if (mastroCompiledData != null) {
                                    //Applico mastro alla pagina in cui ci troviamo
                                    myPage.appliedMaster = Utility.getMasterSpreadByName(mastroCompiledData.content, doc);
                                }
    
                                for (let r = listElementToSendBack.length - 1; r >= 0; r--) {
                                    listElementToSendBack[r].sendToBack();
                                }
                            }
                            catch (ex) {
                                console.error(ex);
                                messaggioUtente("Code IDX-55 Errore generico durante l'impaginazione: " + ex.toString(), "error");
                            }
    
                            boxImpaginato = customAgenzia.bindRefDataCompiled(boxImpaginato, itemRef, pathLavorazione, bounds);
    
                        }
                        
    
    
    
                        if (!useCompiledField)
                            boxImpaginato = customAgenzia.bindRefData(boxImpaginato, itemRef, pathLavorazione, bounds);
    
    
    
                        if (boxImpaginato == null) {
                            error = "Impaginazione fallita";
                            trovato = false;
                            break;
                        }
    
    
                        //Etichettatura
                        let etichetteList = [];
                        //Controllo firma e revisione per determinare le eventuali etichette
                        //DA CONFERMARE, DA REVISIONARE, Artwork
                        
                        if (itemRef["Scatto.CodiceGruppo"] != itemRef["Referenza.Codice"]) {
                            if (itemRef["FirmaRevisione"] == null || itemRef["FirmaRevisione"] == "") {
                                etichetteList.push("DA REVISIONARE");
                            }
                            else if (itemRef["FirmaRevisione"] != itemRef["Tracciato.Firma"] 
                                && (itemRef["FirmaPluginGarantita"] == null || itemRef["FirmaPluginGarantita"]== "")) {
                                if (itemRef["FirmaRevisione"]!="firmaFiduciariaXGruppo" && tipoLavorazione != 2)
                                    etichetteList.push("DA CONFERMARE");
                            }
                        }
                        else {
                            if (itemRef["FirmaRevisione"] == null || itemRef["FirmaRevisione"] == "") {
                                etichetteList.push("DA REVISIONARE");
                            }
                            else if (itemRef["FirmaRevisione"] != itemRef["Tracciato.Firma"] && (itemRef["FirmaPluginGarantita"] == null || itemRef["FirmaPluginGarantita"]== "")) {
                                if (itemRef["FirmaRevisione"]!="firmaFiduciariaXGruppo" && tipoLavorazione != 2)
                                    etichetteList.push("DA CONFERMARE");
                            }
                        }
    
                        if (pluginMiddleware.getEtichette!=null)
                            etichetteList = pluginMiddleware.getEtichette(itemRef, etichetteList);
    
                        let offsetOrizzontale = 0;
                        let offsetVerticale = 0;
                        //var nessChar = docInLavorazione.characterStyles.item("[Nessuno]");
                        var etichettaPar = doc.paragraphStyles.itemByName("Etichetta");
                        //prendiamo lo stile di oggetto Etichetta
                        var etichettaObjStyle = doc.objectStyles.itemByName("Etichetta");
    
    
                        for (let e = 0; e < etichetteList.length; e++) {
                            let etichetta = etichetteList[e];
                            let etichettaField = boxImpaginato.parentPage.textFrames.add();
                            //controlliamo se boxImpaginato.geometricBounds[1] + 25 + offsetOrizzontale supera i limiti destri del box
                            if (boxImpaginato.geometricBounds[1] + 25 + offsetOrizzontale > boxImpaginato.geometricBounds[3]) {
                                offsetOrizzontale = 0;
                                offsetVerticale += 6;
                            }
    
                            etichettaField.geometricBounds = [boxImpaginato.geometricBounds[0] + offsetVerticale, boxImpaginato.geometricBounds[1] + offsetOrizzontale, boxImpaginato.geometricBounds[0] + 10, boxImpaginato.geometricBounds[3] + offsetOrizzontale];
                            //controlliamo se l'etichetta è in overflow, se lo è la allarghiamo di 100 verticalmente e orizzontalmente finchè non c'è più overflow ma salvandoci le misure attuali
                            //dopo impostiamo lo stile e riportiamo le dimensioni alle originali
    
    
    
                            //Stile etichetta
                            //etichettaField.contents = "";
                            grigliaJs.setContent(etichettaField, etichetta);
                            etichettaField.contents = etichetta;
                            //controlliamo l'overflow e se esiste allarghiamo gradualmente orizzontalmente l'etichetta finchè non c'è più overflow
                            etichettaField.label = "etichetta_" + etichetta;
    
                            let oldBounds = etichettaField.geometricBounds;
    
                            try {
                                //mettiamo lo stile di carattere a nessuno
                                etichettaField.fit(FitOptions.FRAME_TO_CONTENT);
                                etichettaField.contents = etichetta;
                                for (var car = 0; car < etichettaField.characters.length; car++) {
                                    etichettaField.characters.item(car).appliedCharacterStyle = nessCharStyleSys;// nessChar;
                                }
    
                                // if(etichettaPar == null || !etichettaPar.isValid){
                                //     throw new Error("Stile paragrafo Etichetta non trovato");
                                // }
                                // etichettaField.paragraphs.item(0).appliedParagraphStyle = etichettaPar;
                                ////etichettaField.fillColor = "Etichetta";
    
                                if (etichettaField.overflows) {
                                    //let offSetAllargamentoX = 20;
                                    let offSetAllargamentoY = 5;
                                    while (etichettaField.overflows && offSetAllargamentoY <= 20) {
                                        etichettaField.geometricBounds = [oldBounds[0], oldBounds[1], oldBounds[2] + offSetAllargamentoY, oldBounds[3]];
                                        //offSetAllargamentoX+=5;
                                        offSetAllargamentoY += 3;
                                    }
                                }
    
                                //se lo stile di oggetto Etichetta esiste lo applichiamo
                                if (etichettaObjStyle != null && etichettaObjStyle.isValid) {
                                    etichettaField.appliedObjectStyle = etichettaObjStyle;
                                }
                                else{
                                    //messaggio utente in warning
                                    messaggioUtente("Code IDX-56 Stile di oggetto 'Etichetta' non trovato", "warning");
                                }
    
    
                                if (etichettaField.overflows) {
                                    //let offSetAllargamentoX = 20;
                                    let offSetAllargamentoY = 5;
                                    while (etichettaField.overflows && offSetAllargamentoY <= 20) {
                                        etichettaField.geometricBounds = [oldBounds[0], oldBounds[1], oldBounds[2] + offSetAllargamentoY, oldBounds[3]];
                                        //offSetAllargamentoX+=5;
                                        offSetAllargamentoY += 3;
                                    }
                                }
    
                                await Utility.sleep(100);
                                //etichettaField.geometricBounds = [etichettaField.geometricBounds[0], etichettaField.geometricBounds[1], etichettaField.lines.item(0).baseline + 2, etichettaField.lines.item(0).endHorizontalOffset + 2]
                                etichettaField.fit(FitOptions.FRAME_TO_CONTENT);
    
                                //etichettaField.geometricBounds = oldBounds;
                                elementiDaGruppare.push(etichettaField);
        
                                //calcoliamo un offset orizzontale per la prossima etichetta
                                //offsetOrizzontale += etichettaField.geometricBounds[3] - etichettaField.geometricBounds[1] + 2.5;
                                offsetOrizzontale += ((etichettaField.geometricBounds[3] - etichettaField.geometricBounds[1]) + 1);
    
                            } catch (err) {
                                console.warn(err);
                                messaggioUtente("Code IDX-57 Errore la creazione dell'etichetta " + etichetta + " per il record " + itemRef["Scatto.CodiceGruppo"] + ": " + err.toString(), "error");
                            }
    
                        }
                        
                        if (elementiDaGruppare.length > 0) {
                            //Rifaccio il gruppo se ci somo foto secondarie da includere
    
                            let page = boxImpaginato.parentPage;
                            var oldGroup = boxImpaginato;//field.parent;
                            var oldLabel = oldGroup.label;
                            var oldItems = oldGroup.pageItems.everyItem().getElements();
                            oldGroup.ungroup();
    
    
    
    
                            var newItems = oldItems.concat(elementiDaGruppare);
                            var newGroup = page.groups.add(newItems);
                            //photo.sendToBack();
                            newGroup.label = oldLabel;
                            boxImpaginato = newGroup;
    
                            //spostiamolo sul livello InPagina
                            boxImpaginato.move(doc.layers.itemByName("InPagina"));
    
                        }

                    }
                    catch(ex){
                        console.error(ex);
                        messaggioUtente("Code IDX-57.5 Errore generico durante l'impaginazione del box, record " + itemRef["Scatto.CodiceGruppo"] + ": " + ex.toString(), "error");
                        boxImpaginato = null;
                        addSegnalazione("IDX-57.5 Errore generico durante l'impaginazione del box", "error", 1, false, []);
                    }

                    Utility.setCampoDNA(campiDNA, boxImpaginato, itemRef);


                    try{

                        boxImpaginato =  await callAllOperationFixBox(boxImpaginato, bounds, itemRef, garbageKey, 2);
                    }
                    catch(ex){
                        console.error(ex);
                        messaggioUtente("Code IDX-58 Errore generico durante l'applicazione del cssFramework, " + ex.toString(), "error");
                        //listElementiNonImpaginati.push(itemRef["Scatto.CodiceGruppo"]);
                        boxImpaginato = null;
                        addSegnalazione("IDX-58 Errore generico durante l'applicazione del cssFramework", "error", 1, false, []);
                    }

                   

                    lastBoxImpaginatoInPagina = boxImpaginato;
                    lastItemRefImpaginato = itemRef;
                    trovato = true;

                    boxImpaginato =finalizzaSegnalazioni(reportImpaginazioneObj, itemRef["Scatto.CodiceGruppo"], boxImpaginato);
                    break;
                }
                trovato = false;
            }
            if (trovato) {
                break;
            }
        }
        if (!trovato) {
            if(error == "Meccanica non trovata"){
                console.error("Meccanica " + meccanica + " non trovata, record " + itemRef["Scatto.CodiceGruppo"]);
                addSegnalazione("Meccanica non trovata", "error", 1, false, []);
                if(bounds != null){
                    var textFrame = pagCoinvolta.textFrames.add();
                    textFrame.geometricBounds = bounds;
                    textFrame.contents = "Meccanica " + meccanica + " non trovata, record " + itemRef["Scatto.CodiceGruppo"];

                }
            }
            else{
                //impaginazione fallita
                console.error("Impaginazione fallita, record " + itemRef["Scatto.CodiceGruppo"]);
                addSegnalazione("Impaginazione fallita. errore generico", "error", 1, false, []);
                if(bounds != null){

                    var textFrame = pagCoinvolta.textFrames.add();
                    textFrame.geometricBounds = bounds;
                    textFrame.contents = "Impaginazione fallita, record " + itemRef["Scatto.CodiceGruppo"];
                }
            }
            if(textFrame != null){
                //in ogni caso aumentiamo la textsize a 10
                textFrame.texts.item(0).pointSize = 10;
    
                let swatchName = "C=0 M=100 Y=100 K=0";
                let swatch = doc.swatches.itemByName(swatchName);
                if (!swatch.isValid) {
                    swatch = doc.colors.add({
                        name: swatchName,
                        model: ColorModel.process,
                        colorValue: [0, 100, 100, 0]
                    });
                }
                textFrame.fillColor = swatch;
            }
            var idRec = getIdRecFromItemRef(itemRef);
            listElementiNonImpaginati.push({
                codice: itemRef["Scatto.CodiceGruppo"],
                idRec: idRec != null && !isNaN(parseInt(idRec)) ? parseInt(idRec) : 0
            });
        }

        //I20-968: qui il box e' composto per intero, qualunque ramo abbia creato i suoi
        //elementi. Gli elementi in noRender sono impaginati e poi resi invisibili; le foto
        //primarie/secondarie non passano di qui, la loro opzione arriva da membriGruppoFoto.
        applicaNoRenderAgliElementiDelBox(boxImpaginato, itemRef.noRenderElementi);

        boxImpaginato = finalizzaSegnalazioni(reportImpaginazioneObj, itemRef["Scatto.CodiceGruppo"], boxImpaginato);
    }
    catch (ex) {
        console.error(ex);
        messaggioUtente("Code IDX-59 Errore generico durante l'impaginazione del box per il record " + itemRef["Scatto.CodiceGruppo"] + ": " + ex.toString(), "error");
        return null;
    }

    return {
        trovato : trovato,
        listElementiNonImpaginati : listElementiNonImpaginati,
        boxAggiunto : boxImpaginato
    }
}

/// Svuota un file scrivendoci dentro la stringa vuota. Non lo cancella: il file resta, a
/// zero byte.
function clearFile(filePath) {
    fs.writeFileSync(filePath, "");
}

/// Legge un file e ne restituisce il JSON deserializzato. null se il file non c'e', non si
/// legge, o non e' JSON valido.
///
/// I tre casi si confondono di proposito: per chi chiama - il tracciato del kit, lo stato
/// del libro, la lista degli esclusi - non fanno differenza, in tutti e tre il dato non c'e'
/// e va riscaricato. Il catch senza parametro e' quello che rende esplicito che l'errore
/// non serve.
///
/// DA SPOSTARE (task di divisione): questa, clearFile e appendToFile sono accesso al disco,
/// non interfaccia. Starebbero in utility.js.
function readFile(filePath) {
    try {
        // Leggi il contenuto del file
        let content = fs.readFileSync(filePath, 'utf8');
        // Deserializza i dati JSON
        let data = JSON.parse(content);
        console.log(data);

        return data;
    }
    catch {
        return null;
    }
}

/// Aggiunge un elemento a un file che contiene un array JSON, creandolo se non c'e'.
///
/// Non e' un append di testo: rilegge tutto, fa il push, riscrive tutto. Su file piccoli -
/// gli esclusi, lo stato del libro - va bene; e' il motivo per cui non esiste altrove.
///
/// Chiamata con data nullo o vuoto, scrive comunque il file: e' cosi' che la si usa per
/// crearlo vuoto.
function appendToFile(filePath, data) {
    try {
        // Leggi il contenuto esistente del file
        let existingContent = '[]';
        let existingData=[];
        try {
            existingContent = fs.readFileSync(filePath, 'utf8');
            if (existingContent == "" || existingContent == null) {
                existingContent = '[]';
            }
            
        }
        catch {
            console.log("File non trovato, verrà creato");
        }

        if (data!=null && data!="")
        {
            console.log("Appendo al file " + existingContent);
            // Converte il contenuto esistente in un array
            existingData = JSON.parse(existingContent);

            // Aggiungi i nuovi dati all'array esistente
            existingData.push(data);
        }


        // Scrivi l'array aggiornato nel file
        fs.writeFileSync(filePath, JSON.stringify(existingData));

        return true;
    }
    catch (ex) {
        console.log(ex);
        return false;
    }
}

/// Traduce il simbolo di un operatore di confronto nel numero che usa il server:
/// = 0, < 1, <= 2, > 3, >= 4, != 5, in 6, !in 7. -1 se il simbolo non e' riconosciuto.
///
/// Sono gli stessi valori di cambiStrutturali.js, dove pero' sono scritti come costanti.
/// Qui la tabella e' una scaletta di if.
///
/// Attenzione al primo if: e' separato dalla catena else che segue. Non cambia il
/// risultato, ma non e' come sembra a prima vista.
function getOperatoreEnumValue(symbolParam) {
    var symbol = symbolParam.toLowerCase();

    if (symbol == "=") {
        return 0;
    }
    if (symbol == "<") {
        return 1;
    }
    else if (symbol == "<=") {
        return 2;
    }
    else if (symbol == ">") {
        return 3;
    }
    else if (symbol == ">=") {
        return 4;
    }
    else if (symbol == "!=") {
        return 5;
    }
    else if (symbol == "in") {
        return 6;
    }
    else if (symbol == "!in") {
        return 7;
    }
    else {
        console.log("Operatore non riconosciuto: " + symbol);
        return -1;
    }
}

var ignoreChangeEvent = false;


var currentTimeoutId = null;




tracciatoVisualizzato = false;
lastWidthDimension = 0;
lastHeightDimension = 0;



/// IMPAGINAZIONE. Toglie una o piu' referenze dall'impaginato, e in un caso preciso le elimina
/// anche dal tracciato sul server.
///
/// DUE MODI DI CHIAMARLA, e la differenza e' tutta li':
///   - SENZA lista, dal pulsante di index.html: chiede conferma, e per un superAdmin puo'
///     arrivare a eliminare dal tracciato;
///   - CON lista, dai due punti di indexNew che ripuliscono gli elementi che hanno fallito
///     l'impaginazione: nessuna conferma, e NON elimina mai dal tracciato. Serve a rimettere
///     d'accordo server e impaginato.
///
/// eliminaDaTracciato diventa vero solo se si verificano QUATTRO cose insieme: la chiamata viene
/// dal pulsante, l'utente e' superAdmin, ha alzato la spunta in Modali.confirmRimozioneRef, e poi
/// ha scritto la parola ELIMINA in Modali.confirmParolaEliminazione (I20-1013).
/// Il flag va al server: Menabo/rimuoviRefImpaginata/{idKit}/{eliminaDaTracciato}.
///
/// L'ELIMINAZIONE DAL TRACCIATO CANCELLA IL RECORD SUL SERVER, ed e' voluta. La specifica
/// flusso-impaginazione-indesign la elenca ancora fra i rischi con la domanda se debba alterare
/// anche il dato server: la risposta e' si', confermata dall'operatore in I20-1002, e la
/// specifica andrebbe aggiornata.
/// I20-1013: annullare la seconda conferma, o sbagliare la parola, annulla TUTTO: non si rimuove
/// nemmeno dall'impaginato.
async function rimuoviRefImpaginata(listaCodiciConId = [], mantieniBusyEsterno = false) {
    //scorriamo tutte le selezioni, cerchiamo le loro basi e ci salviamo in una lista i loro codici gruppo

    function setBusyRimozione(value) {
        if (!mantieniBusyEsterno) {
            indesignEvents.setBusy(value);
        }
    }

    try{

        var askConfirm = listaCodiciConId.length == 0;

        showLoading("Lettura codice in corso...");
        await Utility.sleep(10);
    
        var codiciGruppo = [];
        var listaCodiciConIdDaInviare = [];
        var itemsDaRimuovere = [];
        if (listaCodiciConId.length > 0) {
            //questa parte della funzione non si occupa di rimuovere la ref dalla pagina perchè quando chiamata non abbiamo il riferimento della ref
            //in ogni caso per ora non serve perchè viene chiamata solo per rimuovere elementi che hanno fallito l'impaginazione (in poche parole serve a ripulire le dissicronie tra server e impaginato)
            for (var c = 0; c < listaCodiciConId.length; c++) {
                var itemCodiceConId = listaCodiciConId[c];
                if (itemCodiceConId == null || typeof itemCodiceConId !== "object") {
                    continue;
                }

                var codiceGruppoInput = itemCodiceConId.codice != null ? itemCodiceConId.codice.toString() : "";
                if (codiceGruppoInput === "") {
                    continue;
                }

                var idRecInput = itemCodiceConId.idRec != null && !isNaN(parseInt(itemCodiceConId.idRec))
                    ? parseInt(itemCodiceConId.idRec)
                    : 0;

                codiciGruppo.push(codiceGruppoInput);
                listaCodiciConIdDaInviare.push({ codice: codiceGruppoInput, idRec: idRecInput });
            }
        }
        else {
            //for (var i = 0; i < app.selection.length; i++) {
                //var base = null;
                // if (Utility.parseLabel(app.selection[i].label).startsWith("base")) {
                //     base = app.selection[i];
                // }
                // if (base == null) {
                //     for (var j = 0; j < app.selection[i].allPageItems.length; j++) {
                //         if (Utility.parseLabel(app.selection[i].allPageItems[j].label).startsWith("base")) {
                //             base = app.selection[i].allPageItems[j];
                //             break;
                //         }
                //     }
                // }
                // if (base == null) {
                //     messaggioUtente("Code IDX-63 campo con etichetta Base non trovato nel box selezionato", "error");
                //     return;
                // }

            var dna = Utility.getDnaOfBox(app.selection[0]);
            if (dna == null) {
                messaggioUtente("Code IDX-63 campo con DNA non trovato nel box selezionato", "error");
                return;
            }
            var codiceGruppo = dna.codice_gruppo;

            //torniamo dalla base a monte fino a che il parent non è la pagina
            var itemToRemove = app.selection[0];
            var securityCounter = 0;
            while (itemToRemove.parent.constructor.name != "Spread" && securityCounter < 1000) {
                itemToRemove = itemToRemove.parent;
                securityCounter++;
            }

            var idRec = 0;
            if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                idRec = parseInt(dna.idRec);
            }

            itemsDaRimuovere.push(itemToRemove);
            codiciGruppo.push(codiceGruppo);
            listaCodiciConIdDaInviare.push({ codice: codiceGruppo, idRec: idRec });
            //}
    
            if (codiciGruppo.length == 0) {
                messaggioUtente("Code IDX-64 Nessuna referenza selezionata", "error");
                return;
            }
        }

        var eliminaDaTracciato = false;
        hideLoading();

        if (askConfirm) {

            if (ruoloUtenteLoggato == RuoloUtente.superAdmin){
                var resConfirm = await Modali.confirmRimozioneRef(codiciGruppo);
    
                if (!resConfirm.confermato) {
                    return;
                }
    
                if (resConfirm.eliminaDaTracciato) {
                    console.log("Da eliminare dal tracciato:", resConfirm.codici);
                    eliminaDaTracciato = true;
                }
            }
            else {
                var resConfirn = await Modali.confirm("Procedere alla rimozione dall'impaginato?");
                if (!resConfirn) {
                    return;
                }
            }
        }


        showLoading("Rimozione ref in corso...");
        await Utility.sleep(10);

        setBusyRimozione(true);
        console.log("rimuoviRefImpaginata");
    

        var res = false;
        //mandiamo la richiesta con xhr
        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code IDX-65: Errore durante il parsing della risposta: " + e, "error");
                        inProcess = false;
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code IDX-66 rimuoviRefImpaginata: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }
    
                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code IDX-67 rimuoviRefImpaginata: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                //rimuoviamo scorrendo al contrario gli itemsDaRimuovere
                for (var i = itemsDaRimuovere.length - 1; i >= 0; i--) {
                    itemsDaRimuovere[i].remove();
                }

                res = true;
            }
            catch (e) {
                messaggioUtente("Code IDX-68 rimuoviRefImpaginata: Errore generico " + e, "error");
            }
            finally {
                hideLoading();
                setBusyRimozione(false);
            }
        };
    
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code IDX-69 rimuoviRefImpaginata: Richiesta completata con successo", "success", false, 5);
                } else {
                    hideLoading();
                    setBusyRimozione(false);
                }
            }
        };
    
        xhr.onerror = function () {
            messaggioUtente("Code IDX-70 rimuoviRefImpaginata: Errore di rete", "error");
            hideLoading();
            setBusyRimozione(false);
        }
        //componiamo la lista da mandare al server
        var params = "";
        for (var i = 0; i < listaCodiciConIdDaInviare.length; i++) {
            var codiceItem = listaCodiciConIdDaInviare[i] != null && listaCodiciConIdDaInviare[i].codice != null ? listaCodiciConIdDaInviare[i].codice.toString() : "";
            var idRecItem = listaCodiciConIdDaInviare[i] != null && listaCodiciConIdDaInviare[i].idRec != null && !isNaN(parseInt(listaCodiciConIdDaInviare[i].idRec))
                ? parseInt(listaCodiciConIdDaInviare[i].idRec)
                : 0;

            if (codiceItem === "") {
                continue;
            }

            params += "ListaCodiciConId[" + i + "].codice=" + encodeURIComponent(codiceItem) + "&";
            params += "ListaCodiciConId[" + i + "].idRec=" + encodeURIComponent(idRecItem) + "&";
        }
    
        xhr.send("Menabo/rimuoviRefImpaginata/" + idKitLavorazione + "/" + eliminaDaTracciato, params, "PUT", "application/x-www-form-urlencoded");
        messaggioUtente("Code IDX-71 rimuoviRefImpaginata: Richiesta inviata", "success", true, 3);

        var securityCounter = 0;
        while(!res && securityCounter < 300){
            await Utility.sleep(100);
            securityCounter++;
        }

        if (!res) {
            messaggioUtente("Code IDX-72 rimuoviRefImpaginata: Timeout scaduto", "error");
            hideLoading();
        }

        var filtro = $("#areaFiltriEffettiva");
        if(filtro != null && filtro.length > 0){
            var res = await filtriJs.ricercaFiltro(filtro);
            await aggiornaTracciatoPostRicerca(res);
        }
    }
    catch(e){
        console.log(e);
        messaggioUtente("Code IDX-73 rimuoviRefImpaginata errore generico " + e, "error");
        hideLoading();
        setBusyRimozione(false);
    }
}

/// Svuota una pagina: avvisa prima il server, e solo se il server conferma rimuove i gruppi
/// dal documento.
///
/// L'ordine e' la cosa importante. I box si tolgono dentro la callback di onload, dopo che
/// Menabo/SvuotaPagina ha risposto con esito positivo: se la richiesta fallisce, il
/// documento resta com'era e server e impaginato non si disallineano.
///
/// Si rimuove solo cio' che ha un DNA (Utility.getDnaOfBox): quello che l'operatore ha
/// messo a mano nella pagina non e' roba del Plugin e non si tocca.
///
/// La rimozione scorre l'array all'indietro, perche' togliere un elemento sposta gli indici
/// di quelli dopo.
///
/// NOTA (I20-1002): il controllo "pagSelected == -1 && page == null" legge `page` prima
/// della sua dichiarazione. Con var la variabile c'e' gia' ma vale undefined, quindi quella
/// meta' del controllo e' sempre vera e la condizione si riduce a pagSelected == -1.
async function svuotaPaginaByPageName(pageName) {
    try{

        if (pageName == null || pageName == "") {
            messaggioUtente("Code IDX-74 Numero pagina non valido", "error");
            return;
        }

        showLoading("Svuota pagina in corso...");
        await Utility.sleep(100);
    
        if(pagSelected == -1 && page == null){
            messaggioUtente("Code IDX-75 Pagina non selezionata, posizionarsi sulla pagina corretta", "error");
            return;
        }
    
        var page = null;
        
        for (var i = 0; i < docInLavorazione.pages.length; i++) {
            if (docInLavorazione.pages.item(i).name == pageName) {
                page = docInLavorazione.pages.item(i);
                console.log(page);
                break;
            }
        }
        
    
        if (page == null) {
            messaggioUtente("Code IDX-76 Pagina non trovata", "error");
            return;
        }
        var itemsDaRimuovere = [];
    
        // Itera su tutti i gruppi nella pagina
        for (var i = 0; i < page.groups.length; i++) {
            var group = page.groups.item(i);
            var dna = Utility.getDnaOfBox(group);
            if (dna == null) {
                continue;
            }

            itemsDaRimuovere.push(group);


            // Cerca gli oggetti con label che iniziano con "base" all'interno del gruppo
            // for (var j = 0; j < group.allPageItems.length; j++) {
            //     var item = group.allPageItems[j];
    
            //     // Controlla se l'oggetto ha la label desiderata
            //     if (item.label && Utility.parseLabel(item.label).startsWith("base")) {
            //         var itemToRemove = item.parent;
            //         var securityCounter = 0;
            //         while (itemToRemove.parent.constructor.name != "Spread" && securityCounter < 1000) {
            //             itemToRemove = itemToRemove.parent;
            //             securityCounter++;
            //         }
            //         if(itemToRemove.isValid && securityCounter < 1000)
            //         {
            //             itemsDaRimuovere.push(itemToRemove);
            //         }
            //         else{
            //             throw "Errore durante la rimozione della ref";
            //         }
            //         break; // Interrompi il ciclo interno una volta trovata la base nel gruppo
            //     }
            // }
        }
    
        indesignEvents.setBusy(true);
        console.log("rimuoviRefImpaginata");
    
    
        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code IDX-77 Svuota pagina: Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code IDX-78 Svuota pagina: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }
    
                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code IDX-79 Svuota pagina: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                //rimuoviamo scorrendo al contrario gli itemsDaRimuovere
                for (var i = itemsDaRimuovere.length - 1; i >= 0; i--) {
                    itemsDaRimuovere[i].remove();
                }
            }
            catch (e) {
                messaggioUtente("Code IDX-80 Errore generico: " + e, "error");
            }
            finally {
                indesignEvents.setBusy(false);
                hideLoading();
            }
        };
    
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code IDX-81 Svuota pagina: Richiesta completata con successo", "success", false, 5);
                } else {
                    hideLoading();
                    indesignEvents.setBusy(false);
                }
            }
        };
    
        xhr.onerror = function () {
            messaggioUtente("Code IDX-82 Svuota pagina: Errore di rete", "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
    
        xhr.send("Menabo/SvuotaPagina/" + idKitLavorazione + "/" + parseInt(pageName), null, "GET", "application/x-www-form-urlencoded");
        // messaggioUtente("Svuota pagina: Richiesta inviata", "success", true, 3);
    }
    catch(e){
        console.log(e);
        messaggioUtente("Code IDX-83 Svuota pagina errore generico: " + e, "error");
        hideLoading();
        indesignEvents.setBusy(false);
    }

}


/// Quando l'operatore sceglie la promo, riempie le due tendine sotto - canali e aree - con
/// le sole voci che quella promo contiene davvero.
///
/// Non sono elenchi fissi: si ricavano dai promoTracciatis della promo scelta, senza
/// ripetizioni, e si risolvono in ficoProcess.sourceCanali e sourceAree per averne la
/// sigla. Scegliendo "nessuna promo" (valore 0) le due tendine spariscono, perche' senza
/// promo non hanno contenuto.
///
/// L'ordine lo decide pluginMiddleware.applicaSchemaDiOrdinamentoConPesi, cioe' la
/// configurazione del cliente: a ogni sigla corrisponde un peso, e i canali dell'operatore
/// escono nell'ordine in cui e' abituato a vederli invece che in ordine alfabetico.
function kitPromoCmb_changed()
{
    //console.log("kitPromoCmb_changed");
    let val = $("#kitPromoCmb").val();
    //console.log("Indice promo "  + indiceP);

    

    if (val == 0)
    {
        $("#kitAreeDiv").css("display","none");
        $("#kitCanaliDiv").css("display","none");
    }
    else
    {
        let promoItem=ficoProcess.listaPromoAperte.find(x => x.guidID == val);
        console.log(promoItem.promoTracciatis);

        let canali=[];
        let aree=[];

        promoItem.promoTracciatis.forEach(function (item) {

            if (canali.find(f=>f.guidID==item.guidCanale)==null)
            {
                canali.push(ficoProcess.sourceCanali.find(c=>c.guidID==item.guidCanale));
            }

            if (aree.find(f=>f.guidID==item.guidArea)==null)
            {
                aree.push(ficoProcess.sourceAree.find(a=>a.guidID==item.guidArea));
            }
        });

        console.log("Canali in questa promo");
        console.log(canali);
        console.log("Aree in questa promo");
        console.log(aree);


        $("#kitAreeDiv").css("display","block");
        $("#kitCanaliDiv").css("display","block");

        let menuCanali = $("#kitCanaliCmb").find("sp-menu");
        menuCanali.empty();
        menuCanali.append("<sp-menu-item value=\"0\" selected>Seleziona Canale</sp-menu-item>");

        // if (customAgenzia.applicaSchemaDiOrdinamentoCanali != null){
        //     canali = customAgenzia.applicaSchemaDiOrdinamentoCanali(canali, "sigla");
        // }

        canali = pluginMiddleware.applicaSchemaDiOrdinamentoConPesi(canali, "sigla", "canali");

        for (let i=0; i<canali.length; i++)
        {
            let canale=canali[i];
            menuCanali.append("<sp-menu-item value=\""+canale.guidID+"\">" + canale.sigla + "</sp-menu-item>");
        }

        let menuAree = $("#kitAreeCmb").find("sp-menu");
        menuAree.empty();
        menuAree.append("<sp-menu-item value=\"0\" selected>Seleziona Area</sp-menu-item>");

        // if (customAgenzia.applicaSchemaDiOrdinamentoAree != null){
        //     aree = customAgenzia.applicaSchemaDiOrdinamentoAree(aree, "sigla");
        // }

        aree = pluginMiddleware.applicaSchemaDiOrdinamentoConPesi(aree, "sigla", "aree");
        
        for (let i=0; i<aree.length; i++)
        {
            let area=aree[i];
            menuAree.append("<sp-menu-item value=\""+ area.guidID +"\">" + area.sigla + "</sp-menu-item>");
        }
        //<sp-menu-item value="0" selected>Seleziona Canale</sp-menu-item>
        //<sp-menu-item value="0" selected>Seleziona Area</sp-menu-item>

    }
}

/// Copre il pannello con la schermata di attesa, col testo passato o con "Caricamento in
/// corso...".
///
/// Nasconde anche gli elementi marcati hideable: sono quelli che in UXP si disegnano sopra
/// qualunque cosa - le tendine di sistema - e resterebbero visibili sopra l'attesa.
function showLoading(msg)//Facoltativo
{

    $("#loadingPanel").show();
    
    if (msg!=null)
    {
        $("#loadingPanel").find("h1").text(msg);
    }
    else
    {
        //I20-1002: qui c'era una riga col solo identificatore "Default", che non esiste
        //da nessuna parte: questo ramo lanciava ReferenceError, e showLoading non ha un
        //try/catch. Non si notava perche' nessuno chiamava showLoading() senza testo,
        //ma tre chiamanti passano una variabile che puo' essere nulla.
        $("#loadingPanel").find("h1").text("Caricamento in corso...");
    }
    Modali.nascondiHidebleElements();

}

/// Toglie la schermata di attesa e rimette gli elementi hideable. L'opposto esatto di
/// showLoading, tranne quando un popup e' aperto.
///
/// I20-1029, lotto 2: con un popup aperto gli elementi restano nascosti, li riaccende lui
/// quando si chiude. La schermata delle segnalazioni si apre a fine impaginazione, prima
/// di questa chiamata: riaccenderli qui rimetteva le caselle Ordine del Menabo' sopra il
/// popup (in UXP i controlli nativi restano sopra a tutto).
function hideLoading() {
    $("#loadingPanel").hide();
    if ($("#popup").length === 0) {
        Modali.mostraHidebleElements();
    }
}

/// Svuota le quattro liste del tracciato e toglie la riga con la data di scaricamento.
///
/// Si chiama prima di rifare il tracciato: senza, le referenze si accumulerebbero a quelle
/// gia' scritte.
function clearInfo()
{
    $("#FiltroRicercaTracciato").empty();    
    $("#TuttiElementiTracciato").empty();
    $("#ImpaginatiTracciato").empty();
    $("#NonImpaginatiTracciato").empty();
    $("#dataScaricamentoTracciato").remove();
}

/// Ridisegna da zero la scheda del tracciato: la riga di sincronizzazione in alto, l'area
/// dei filtri, l'elenco delle referenze.
///
/// Si rifa' tutto a ogni chiamata - si rimuove e si ricrea - invece di aggiornare cio' che
/// c'e'. E' la ragione del guasto corretto in I20-981: chi premeva un bottone del tracciato
/// si vedeva ricostruire sotto il bottone stesso mentre il gestore era ancora in corso.
///
/// Senza kit non fa niente. Senza contenuto scaricato mostra la sola riga di
/// sincronizzazione, che e' proprio da dove si scarica.
///
/// L'intero corpo e' in un try che registra e tace: un errore qui lascia il tracciato a
/// meta' senza dirlo all'operatore.
async function mostraTracciato() {

    try {
        //controlliamo che il file listaTracciato.json esista, se non esiste riempiamo $(#TracciatoRecords) con la scritta "Nessun tracciato scaricato"
        if (idKitLavorazione == 0) {
            return;
        }
        else {
            $("#tabTracciatoImpaginati").show();
        }

        leggiContenutoKit(idKitLavorazione, true);

        $("#TuttiElementiTracciato").empty();
        $("#ImpaginatiTracciato").empty();
        $("#NonImpaginatiTracciato").empty();
        $("#scaricaTracciato").remove();
        $("#info_no_tracciato_scaricato").remove();
        $("#dataScaricamentoTracciato").remove();

        //rimuoviamo la riga esistente se c'è
        $("#rowSyncTracciato").remove();
        var htmlRow = $('<div id="rowSyncTracciato" style="width:99%"></div>');
        const ui = creaRigaSync(contenutoKitInLavorazione);
        htmlRow.append(ui.$row);

        if (contenutoKitInLavorazione == null) {

            $("#TracciatoRecords").prepend(htmlRow);
            //svuotiamo area filtri e tracciato
            $("#areaFiltri").remove();
            $("#Tab1Intestazione").empty();
            $("#ElementiTracciato").empty();
            return;
        }



        //inseriamo all'inizio di tracciaRecords la row
        //creiamo un div con una freccia in alto a destra per il collapse del pannello
        // Creiamo il div areaFiltri se non esiste già
        if ($("#areaFiltri").length === 0) {
            var areaFiltri = $('<div id="areaFiltri" style="margin-top: 10px; margin-bottom: 10px; position: relative;"></div>');
            $("#TracciatoRecords").prepend(areaFiltri);
        }

        //rimuoviamo areaFiltriEffettiva se esiste
        $("#areaFiltriEffettiva").remove();


        // Creiamo un div interno chiamato areaFiltriEffettiva
        var areaFiltriEffettiva = $('<div id="areaFiltriEffettiva" style="overflow: hidden;"></div>');
        $("#areaFiltri").append(areaFiltriEffettiva);

        // // Creiamo il collapse icon e lo posizioniamo in corrispondenza dell'angolo destro di Area filtri
        // var collapseDiv = $('<div class="collapse-icon" style="position: absolute; top: 0; right: 0; cursor: pointer; z-index: 1; background-color: white;"><img src="images/collapse.png" style="height: 15px; width: 15px;"></div>');
        // collapseDiv.on('click', function () {
        //     //facciamo il collapse di areaFiltriEffettiva
        //     var area = $("#areaFiltriEffettiva");
        //     if (area.height() > 0) {
        //         area.animate({ height: '0px' }, 300);
        //         Utility.sleep(300).then(() => {
        //             onResizeTab1Tracciato();
        //         });
        //     }
        //     else {
        //         area.animate({ height: 'auto' }, 300);
        //         Utility.sleep(300).then(() => {
        //             onResizeTab1Tracciato();
        //         });
        //     }
        // });

        // // Append the collapse icon to areaFiltri
        // $("#areaFiltri").prepend(collapseDiv);

        $("#TracciatoRecords").prepend(htmlRow);


        await filtriJs.addNewFiltro(null, $("#areaFiltriEffettiva"), true, true);

        return;
    }
    catch (e) {
        console.error(e);
    }

}

/// Costruisce la riga in cima al tracciato: quando e' stato scaricato l'ultimo, una tendina
/// con cosa avviare, e il pulsante Avvia.
///
/// La tendina ha due voci, ma la seconda - Report integrita' - la vede solo un superAdmin.
/// E' un controllo di ruolo fatto costruendo l'interfaccia, non nascondendola dopo.
///
/// I20-981: la sequenza del report vive in avviaReportIntegrita, non piu' dentro il gestore
/// di questo bottone, che il rinfresco del tracciato ricostruisce mentre gira.
///
/// DA VERIFICARE (I20-1002): il gestore legge la tendina con box.$picker[1].value. E' un
/// oggetto jQuery che avvolge un solo elemento, quindi l'indice 1 dovrebbe essere
/// undefined e la lettura lanciare. E' l'unico accesso indicizzato di questa forma in tutto
/// il Plugin. Non e' stato toccato perche' non lo si puo' provare senza InDesign: se in
/// esercizio il pulsante Avvia funziona, allora qui c'e' qualcosa che non si vede dal
/// sorgente; se non funziona, l'indice giusto e' 0.
///
/// Restano due gestori vuoti - il clic sull'icona info e il change della tendina - e un
/// campo per l'intervallo di pagine (pagineRange_<uid>) che nasce nascosto e che nessuno
/// mostra ne' legge.
function creaRigaSync(contenutoKitInLavorazione) {
    const dataScaricamento = contenutoKitInLavorazione != null
        ? contenutoKitInLavorazione["DataScaricamento"]
        : "Mai scaricato";

    const uid = String(idKitLavorazione ?? "0");

    const $row = $("<div/>").css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "8px 10px",
        marginTop: "8px",
        borderRadius: "6px",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        fontSize: "13px",
        flexWrap: "wrap"
    });

    const $leftCol = $("<div/>").css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "8px",
        flex: "1 1 auto",
        minWidth: "220px"
    });

    const $rightCol = $("<div/>").css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "10px",
        flex: "0 0 auto",
        flexWrap: "wrap"
    });

    const $infoIcon = $("<img/>", {
        src: "images/info.png",
        alt: "info"
    }).css({
        width: "18px",
        height: "18px",
        cursor: "pointer",
        flex: "0 0 auto",
        marginRight: "5px"
    });

    const $download = $("<span/>", {
        id: "dataScaricamento_" + uid
    }).text("Ultimo download: " + dataScaricamento).css({
        whiteSpace: "nowrap",
        lineHeight: "20px"
    });

    const $syncBtn = $("<button/>", {
        type: "button",
        id: "syncButton_" + uid
    }).text("Avvia").css({
        border: "none",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        height: "28px",
        width: "50px",
        flex: "0 0 auto"
    });

    function creaPickerCol(pickerId, items, minWidthPx) {
        const $col = $("<div/>").css({
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            alignItems: "flex-start",
            flex: "0 0 auto"
        });

        // const $lab = $("<div/>").text(titolo).css({
        //     color: "#cfd8e3",
        //     fontSize: "11px",
        //     lineHeight: "1"
        // });

        const $picker = $(`<sp-picker id="${pickerId}"></sp-picker>`).css({
            minWidth: (minWidthPx || 180) + "px",
            width: minWidthPx ? minWidthPx + "px" : "100%",
            height: "28px"
        });

        const $menu = $('<sp-menu slot="options"></sp-menu>');
        for (const it of items) {
            const $mi = $(`<sp-menu-item value="${it.value}">${it.label}</sp-menu-item>`);
            if (it.selected) $mi.attr("selected", "");
            $menu.append($mi);
        }

        $picker.append($menu);
        $col.append($picker);

        return { $col, $picker };
    }

    const boxPickerId = "syncBoxPicker_" + uid;

    var optionsBox = [
        { value: "none", label: "Scaricamento Lista", selected: true }
    ];

    if (ruoloUtenteLoggato == RuoloUtente.superAdmin) {
        optionsBox.push({ value: "report_confronto", label: "Report integrità" });
    }

    const box = creaPickerCol(
        boxPickerId,
        optionsBox,
        160
    );

    const $pagineRange = $(
        `<sp-textfield placeholder="Es: 2-5,7,9,14-18" id="pagineRange_${uid}" style="color: white; display: none; min-width: 150px;"></sp-textfield>`
    ).css({
        minWidth: "150px"
    });

    $leftCol.append($infoIcon, $download);

    // ordine invertito richiesto: prima picker, poi avvia
    $rightCol.append(box.$col, $syncBtn, $pagineRange);

    $row.append($leftCol, $rightCol);

    $infoIcon.on("click", function () {
    });

    $syncBtn.on("click", async function () {
        clearInfo();

        const boxVal = box.$picker[1].value;
        console.log("Valore picker box: " + boxVal);

        if (boxVal === "none") {
            scaricaContenutoKit(idKitLavorazione, true);
            return;
        }

        //I20-981: la sequenza del report vive in avviaReportIntegrita, non piu' dentro il
        //gestore di un bottone che il rinfresco del tracciato ricostruisce mentre gira.
        await ReportIntegrita.avviaReportIntegrita(idKitLavorazione);
    });

    box.$picker.on("change", function (e) {
    });

    return {
        $row,
        $infoIcon,
        $download,
        $syncBtn,
        $syncBoxPicker: box.$picker
    };
}

/// Ridisegna il corpo del tracciato con i record da mostrare: tutti, i soli impaginati, o i
/// soli da impaginare, secondo il filtro di visualizzazione.
///
/// Due sorgenti diverse a seconda di come ci si arriva. Senza ricerca si parte dal
/// contenuto del kit e si divide confrontando con la lista dei codici gia' impaginati nel
/// documento. Con una ricerca si usano le liste che la ricerca ha gia' preparato, e li'
/// conta criteriValidati: se i criteri non sono stati validati valgono le liste complete,
/// altrimenti quelle filtrate.
///
/// Le righe si aggiungono a un DocumentFragment e si attaccano in una volta sola: mille
/// append diretti al DOM sarebbero mille ridisegni.
async function aggiornaTracciatoPostRicerca(resRicerca) {
    try {
        $("#Tab1Table").empty();

        const $header = renderIntestazioneTracciato();
        const $body = $("<div/>", { id: "ElementiTracciato" });

        $("#Tab1Table").append($header);
        $("#Tab1Table").append($body);

        const val = $("#areaFiltriEffettiva").find(".filtro-visualizzazione").val();
        let recordsDaMostrare = [];

        if (resRicerca == null) {
            const listImpaginati = await Utility.getListaCodiciImpaginati();

            if (val === "all") {
                recordsDaMostrare = contenutoKitInLavorazione.records || [];
            } else if (val === "impaginati") {
                recordsDaMostrare = (contenutoKitInLavorazione.records || []).filter(r =>
                    listImpaginati.includes(r.recordInTracciato.idRec)
                );
            } else if (val === "da_impaginare") {
                recordsDaMostrare = (contenutoKitInLavorazione.records || []).filter(r =>
                    !listImpaginati.includes(r.recordInTracciato.idRec)
                );
            }
        } else {
            let tutti = [];

            if (val === "all") {
                if (!resRicerca.criteriValidati) {
                    tutti = resRicerca.listaCompleta || [];
                } else {
                    tutti = [].concat(resRicerca.impaginati || [], resRicerca.nonImpaginati || []);
                }
            } else if (val === "impaginati") {
                tutti = !resRicerca.criteriValidati
                    ? (resRicerca.listaCompletaImpaginati || [])
                    : (resRicerca.impaginati || []);
            } else if (val === "da_impaginare") {
                tutti = !resRicerca.criteriValidati
                    ? (resRicerca.listaCompletaNonImpaginati || [])
                    : (resRicerca.nonImpaginati || []);
            }

            tutti.sort((a, b) => (a.index || 0) - (b.index || 0));
            recordsDaMostrare = tutti;
        }

        //I20-1029, lotto 3: le segnalazioni del documento si leggono una volta per ridisegno, non
        //una per riga: le righe possono essere migliaia.
        const riepilogoSegnalazioni = riepilogoSegnalazioniTracciato();
        const frag = $(document.createDocumentFragment());
        var first = true;
        recordsDaMostrare.forEach(record => {
            frag.append(creaElementoTracciato(record, first, riepilogoSegnalazioni));
            first = false;
        });

        $body.append(frag);

        //I20-1035: le colonne possono essere cambiate. Come nel Report Integrita', si riporta la
        //tabella dove dice lo spostamento e si rimette il cursore in accordo.
        const statoBarra = assicuraBarraScorrimentoTracciato();
        scorriTracciato(statoBarra, statoBarra != null ? (statoBarra.spostamento || 0) : 0);

        await Utility.sleep(50);
        onResizeTab1Tracciato();
    } catch (e) {
        console.error(e);
    }
}

//I20-1035: la barra di scorrimento orizzontale della lista dei tracciati, disegnata da noi.
//E' la replica di quella dei Nuovi del Report Integrita' (reportIntegrita/pannelli.js,
//_crBarraScorrimentoNuovi e seguenti, I20-981): stessi pezzi, stessi stili, stessi conti di
//barraScorrimento. In UXP la lista non scorre in orizzontale in nessun modo nativo - assegnare
//scrollLeft interrompe il comando, provato in console -, cosi' la tabella viene spostata con un
//margine negativo e la barra la mettiamo sotto la lista, sempre visibile quando serve.
//Le differenze sono solo quelle della Home: si sposta #Tab1Table, le misure si prendono da
//#Tab1Table e #Tab1Viewport, e la barra si crea una volta sola, perche' #TracciatoRecords non si
//svuota mai. Le frecce e il clic sulla traccia bastano da soli: se il trascinamento del cursore
//non funzionasse, la tabella si scorre comunque.
const PASSO_SCORRIMENTO_TRACCIATO = 160;
var statoBarraTracciato = { barra: null, traccia: null, cursore: null, spostamento: 0, trascinamento: null };
var trascinamentoBarraTracciatoAttivo = false;

/// La barra sotto la lista: creata la prima volta, poi la stessa. Restituisce lo stato, o null se
/// la lista non c'e'.
function assicuraBarraScorrimentoTracciato() {
    const state = statoBarraTracciato;
    const lista = document.getElementById("Tab1Viewport");
    if (lista == null) {
        return null;
    }

    if (state.barra == null || document.getElementById("barraScorrimentoTracciato") == null) {
        $(lista).after(crBarraScorrimentoTracciato(state));
    }

    return state;
}

/// Costruisce la barra, come _crBarraScorrimentoNuovi: freccia, traccia con il cursore, freccia.
/// Frecce e traccia con il click, il cursore con il trascinamento.
function crBarraScorrimentoTracciato(state) {
    const barra = document.createElement("div");
    barra.id = "barraScorrimentoTracciato";
    barra.style.display = "flex";
    barra.style.alignItems = "center";
    barra.style.gap = "4px";
    barra.style.flexShrink = "0";
    barra.style.padding = "4px 0 0 0";

    const indietro = crFrecciaScorrimentoTracciato("‹", "Sposta la tabella verso sinistra");
    const avanti = crFrecciaScorrimentoTracciato("›", "Sposta la tabella verso destra");

    const traccia = document.createElement("div");
    traccia.style.position = "relative";
    traccia.style.flex = "1 1 auto";
    traccia.style.height = "12px";
    traccia.style.minWidth = "0";
    traccia.style.backgroundColor = "#e6e6e6";
    traccia.style.borderRadius = "6px";
    traccia.style.cursor = "pointer";
    Tooltip.impostaTooltip(traccia, "Clicca o trascina per scorrere le colonne");

    const cursore = document.createElement("div");
    cursore.style.position = "absolute";
    cursore.style.top = "0";
    cursore.style.left = "0";
    cursore.style.height = "12px";
    cursore.style.width = "40px";
    cursore.style.backgroundColor = "#8a8a8a";
    cursore.style.borderRadius = "6px";
    cursore.style.cursor = "grab";

    traccia.appendChild(cursore);

    barra.appendChild(indietro);
    barra.appendChild(traccia);
    barra.appendChild(avanti);

    state.barra = barra;
    state.traccia = traccia;
    state.cursore = cursore;
    state.spostamento = 0;

    indietro.addEventListener("click", () => scorriTracciato(state, state.spostamento - PASSO_SCORRIMENTO_TRACCIATO));
    avanti.addEventListener("click", () => scorriTracciato(state, state.spostamento + PASSO_SCORRIMENTO_TRACCIATO));

    traccia.addEventListener("click", (evento) => {
        //Il clic sul cursore lo prende il cursore: qui arriva solo il clic sulla traccia.
        if (evento?.target === cursore) {
            return;
        }

        const misure = misureScorrimentoTracciato(state);
        const posizione = posizioneNellaTracciaTracciato(evento, traccia);

        scorriTracciato(state, barraScorrimento.spostamentoDaClic(
            posizione, misure.contenuto, misure.visibile, misure.traccia));
    });

    //Terzo strato: il trascinamento. Se questi eventi non arrivano, restano frecce e traccia.
    cursore.addEventListener("mousedown", (evento) => {
        const misure = misureScorrimentoTracciato(state);

        state.trascinamento = {
            partenzaX: evento?.clientX || 0,
            spostamentoIniziale: state.spostamento,
            misure: misure
        };

        cursore.style.cursor = "grabbing";
    });

    abilitaTrascinamentoBarraTracciato();

    return barra;
}

/// Il pulsante di una freccia, con il suo tooltip.
function crFrecciaScorrimentoTracciato(simbolo, descrizione) {
    const freccia = document.createElement("button");
    freccia.type = "button";
    freccia.textContent = simbolo;
    freccia.style.height = "16px";
    freccia.style.minWidth = "18px";
    freccia.style.padding = "0";
    freccia.style.lineHeight = "1";
    freccia.style.cursor = "pointer";
    freccia.style.flexShrink = "0";
    Tooltip.impostaTooltip(freccia, descrizione);
    return freccia;
}

/// Il trascinamento si ascolta una volta sola sul documento: il mouse esce dal cursore
/// quasi subito, e se ascoltassimo solo lui il movimento si perderebbe.
function abilitaTrascinamentoBarraTracciato() {
    if (trascinamentoBarraTracciatoAttivo) {
        return;
    }

    trascinamentoBarraTracciatoAttivo = true;

    $(document).on("mousemove", function (evento) {
        const state = statoBarraTracciato;
        if (state == null || state.trascinamento == null) {
            return;
        }

        const misure = state.trascinamento.misure;
        const pixel = (evento?.clientX || 0) - state.trascinamento.partenzaX;

        scorriTracciato(state, barraScorrimento.spostamentoDaTrascinamento(
            state.trascinamento.spostamentoIniziale, pixel,
            misure.contenuto, misure.visibile, misure.traccia));
    });

    $(document).on("mouseup", function () {
        const state = statoBarraTracciato;
        if (state == null || state.trascinamento == null) {
            return;
        }

        state.trascinamento = null;
        if (state.cursore != null) {
            state.cursore.style.cursor = "grab";
        }
    });
}

/// Le misure si leggono adesso, non alla costruzione: quando la barra nasce la lista non e'
/// ancora impaginata e tornerebbero zero. Il contenuto e' la larghezza vera della tabella, il
/// visibile quella della lista che la taglia.
function misureScorrimentoTracciato(state) {
    let contenuto = 0;
    let visibile = 0;
    let traccia = 0;

    try {
        contenuto = document.getElementById("Tab1Table")?.scrollWidth || 0;
        visibile = document.getElementById("Tab1Viewport")?.clientWidth || 0;
        traccia = state?.traccia?.clientWidth || 0;
    }
    catch (err) {
        console.error("Misure della barra non disponibili:", err);
    }

    return {
        contenuto: contenuto,
        visibile: visibile,
        traccia: traccia
    };
}

/// Dove e' caduto il clic, in pixel dall'inizio della traccia.
function posizioneNellaTracciaTracciato(evento, traccia) {
    try {
        const rettangolo = traccia.getBoundingClientRect();
        return (evento?.clientX || 0) - (rettangolo?.left || 0);
    }
    catch (err) {
        return 0;
    }
}

/// Sposta la tabella e aggiorna il cursore.
function scorriTracciato(state, spostamento) {
    const table = document.getElementById("Tab1Table");
    if (state == null || table == null) {
        return;
    }

    const misure = misureScorrimentoTracciato(state);

    state.spostamento = barraScorrimento.limitaSpostamento(spostamento, misure.contenuto, misure.visibile);
    table.style.marginLeft = "-" + state.spostamento + "px";

    aggiornaCursoreTracciato(state, misure);
}

/// Mostra o nasconde la barra e mette il cursore dove dice lo spostamento.
function aggiornaCursoreTracciato(state, misure) {
    if (state == null || state.cursore == null) {
        return;
    }

    const m = misure || misureScorrimentoTracciato(state);
    const serve = barraScorrimento.serveLaBarra(m.contenuto, m.visibile);

    if (state.barra != null) {
        //Se le colonne ci stanno tutte, la barra non ha niente da fare e sparisce.
        //Finche' le misure non sono disponibili la si lascia, altrimenti lampeggerebbe.
        state.barra.style.display = (m.visibile > 0 && !serve) ? "none" : "flex";
    }

    const geometria = barraScorrimento.geometriaCursore(
        state.spostamento, m.contenuto, m.visibile, m.traccia);

    state.cursore.style.width = geometria.larghezza + "px";
    state.cursore.style.left = geometria.sinistra + "px";
}

/// L'altezza che la barra occupa sotto la lista, zero se non c'e' o e' nascosta. Serve a
/// onResizeTab1Tracciato per lasciarle posto: lista e barra insieme devono stare dentro
/// #contenitoreTab, altrimenti tornerebbe a scorrere quello.
function altezzaBarraScorrimentoTracciato() {
    const barra = statoBarraTracciato.barra;
    if (barra == null || barra.style.display === "none") {
        return 0;
    }

    try {
        return Math.ceil(barra.getBoundingClientRect().height || 0);
    }
    catch (err) {
        return 0;
    }
}

/// Le colonne del tracciato: Pag sempre per prima, poi quelle che il cliente ha configurato
/// (pluginMiddleware.getColonneTracciatoIntestazione).
///
/// Pag non e' configurabile perche' non viene dal record: e' la pagina in cui la referenza
/// si trova nell'impaginato, e la calcola il Plugin.
function getTracciatoColumns() {
    let colonne = [];

    if (pluginMiddleware.getColonneTracciatoIntestazione) {
        colonne = pluginMiddleware.getColonneTracciatoIntestazione() || [];
    }

    const result = [
        { nome: "Pag", chiaveDato: "__pagina__", width: 40 }
    ];

    colonne.forEach(col => {
        result.push({
            nome: col.name,
            chiaveDato: col.chiaveDato,
            width: col.percColonna || 80
        });
    });

    return result;
}

/// Fissa la larghezza di una cella in tutti e quattro i modi che servono perche' resti
/// ferma: width, minWidth, maxWidth e la base flex.
///
/// La sola width non basta dentro un contenitore flex, che allargherebbe o stringerebbe le
/// celle per far quadrare la riga. Qui le colonne devono restare allineate con
/// l'intestazione, riga dopo riga.
function applicaLarghezzaCella($cell, width) {
    $cell.css({
        width: width + "px",
        minWidth: width + "px",
        maxWidth: width + "px",
        flex: "0 0 " + width + "px"
    });
}


/// Costruisce la riga di intestazione del tracciato, una cella per colonna, usando le stesse
/// larghezze delle righe di dati.
function renderIntestazioneTracciato() {
    const columns = getTracciatoColumns();

    const $header = $("<div/>", {
        id: "Tab1Intestazione",
        class: "tracciato-header"
    });

    columns.forEach(col => {
        const $cell = $("<div/>", {
            class: "tracciato-cell",
            text: col.nome
        }).css({
            fontWeight: "bold",
            color: "lightblue"
        });

        applicaLarghezzaCella($cell, col.width);
        $header.append($cell);
    });

    return $header;
}

/// La pagina su cui si trova l'operatore adesso: si chiede alla finestra attiva di InDesign,
/// e se non risponde si ripiega su pagSelected, l'ultima pagina che il Plugin ha visto
/// selezionare.
///
/// Restituisce null se non si arriva a un valore sensato, cosi' chi chiama sa che non puo'
/// impaginare da qui.
///
/// Si usa il nome della pagina, non il numero: con le sezioni i due non coincidono.
async function getPaginaImpaginazioneCorrente() {
    var pagina = pagSelected;

    try {
        var activeWindow = await app.activeWindow;
        if (activeWindow != null && activeWindow.activePage != null) {
            pagina = activeWindow.activePage.name;
        }
    } catch (e) {
        console.warn("Impossibile leggere la pagina corrente: " + e);
    }

    if (pagina == null || pagina === "" || pagina === -1 || pagina === "-1" || Number.isNaN(pagina)) {
        return null;
    }

    return pagina;
}

/// Le quattro descrizioni del record unite da " | ", saltando quelle vuote.
///
/// Se il record appartiene a un gruppo, le descrizioni si prendono dal gruppo
/// (descrizione_gruppo): e' quella che l'operatore riconosce, perche' e' il gruppo che
/// finisce nel box, non il singolo record.
function getDescrizioneRecordTracciato(record) {
    var sorgenteDescrizione = record.descrizione_gruppo != null ? record.descrizione_gruppo : record;

    return [
        sorgenteDescrizione["Descrizioni.Descrizione1"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione2"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione3"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione4"] || ""
    ].filter(Boolean).join(" | ");
}

/// Aggiunge al riquadro di conferma una riga "etichetta: valore", saltandola se il valore
/// non c'e'.
///
/// Il testo si mette con .text e non con l'HTML: una descrizione che contenga < o & non
/// deve poter rompere il riquadro.
function appendRigaRiepilogoImpaginazione($container, label, value) {
    if (value == null || value === "") {
        return;
    }

    var $row = $("<div/>").css({
        display: "flex",
        gap: "8px",
        marginTop: "4px",
        fontSize: "13px",
        color: "#222"
    });

    $row.append($("<span/>").css({
        fontWeight: "bold",
        minWidth: "95px"
    }).text(label + ":"));

    $row.append($("<span/>").css({
        flex: "1"
    }).text(value));

    $container.append($row);
}

/// Chiede conferma prima di impaginare una referenza presa dal tracciato, mostrando su
/// quale pagina finira' e quale referenza e'.
///
/// La pagina e' in grassetto perche' e' l'unica cosa che l'operatore puo' avere sbagliato:
/// la referenza l'ha scelta lui, la pagina gliela propone il Plugin in base a dove si trova
/// in quel momento.
///
/// Codice gruppo, idRec e descrizione servono a riconoscere la referenza: il solo codice
/// non basta, perche' la stessa referenza puo' comparire piu' volte.
async function confermaImpaginazioneDaTracciato(record, pagina) {
    var codiceGruppo = record["Scatto.CodiceGruppo"] || "";
    var idRec = getIdRecFromItemRef(record);
    var descrizione = getDescrizioneRecordTracciato(record);

    var $container = $("<div/>").css({
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "520px",
        color: "#222"
    });

    $container.append($("<div/>").css({
        fontSize: "17px",
        fontWeight: "bold",
        marginBottom: "10px"
    }).text("Confermi l'impaginazione dal tracciato?"));

    var $messaggioPagina = $("<div/>").css({
        marginBottom: "10px",
        fontSize: "14px"
    });

    $messaggioPagina.append(document.createTextNode("Procedendo, il record verrà impaginato a "));
    $messaggioPagina.append($("<span/>").css({ fontWeight: "bold" }).text("pagina " + String(pagina)));
    $messaggioPagina.append(document.createTextNode("."));

    $container.append($messaggioPagina);

    appendRigaRiepilogoImpaginazione($container, "Codice gruppo", codiceGruppo);
    appendRigaRiepilogoImpaginazione($container, "idRec", idRec);
    appendRigaRiepilogoImpaginazione($container, "Descrizione", descrizione);

    return await Modali.confirm($container);
}

//I20-1029, lotto 3: il badge di pagina del tracciato prende il colore della segnalazione di
//impaginazione piu' grave del box della referenza, letta dai bollini del documento: rosso gli
//errori, arancione i warning, gli stessi colori della schermata delle segnalazioni. Senza
//segnalazioni resta il blu di sempre.
const COLORE_BADGE_TRACCIATO = "rgb(45,140,235)";

/// Le segnalazioni del documento per referenza (Segnalazioni.riepilogoPerRecord), o una mappa
/// vuota se il documento non si legge: il tracciato si disegna comunque, col blu di sempre.
function riepilogoSegnalazioniTracciato() {
    try {
        const documento = docInLavorazione != null ? docInLavorazione : (app.documents.length > 0 ? app.activeDocument : null);
        return Segnalazioni.riepilogoPerRecord(Segnalazioni.leggiDocumento(documento));
    }
    catch (e) {
        console.warn("Segnalazioni non lette per il tracciato:", e);
        return {};
    }
}

/// Colora il badge di pagina di una referenza con le sue segnalazioni, e ci mette il
/// suggerimento; senza segnalazioni lo riporta al blu, senza suggerimento.
function coloraBadgeTracciato($badge, riepilogo) {
    const testo = SchermataSegnalazioni.testoRiepilogo(riepilogo);
    $badge.css("background-color", testo !== "" ? SchermataSegnalazioni.coloreCss(riepilogo.gravita) : COLORE_BADGE_TRACCIATO);
    if (testo !== "") {
        $badge.attr("title", testo);
    } else {
        $badge.removeAttr("title");
    }
}

/// Ricolora i badge gia' disegnati, senza rifare il tracciato. La chiama la schermata delle
/// segnalazioni quando si chiude: dopo un "Risolvi" il colore di prima non e' piu' vero.
function aggiornaBadgeSegnalazioniTracciato() {
    const riepilogo = riepilogoSegnalazioniTracciato();
    $("#ElementiTracciato .badge-pagina-tracciato").each(function () {
        coloraBadgeTracciato($(this), riepilogo[$(this).attr("idRec")]);
    });
}

/// Costruisce la riga di una referenza nel tracciato: una cella per colonna, coi valori
/// presi dal record. riepilogoSegnalazioni (lotto 3 di I20-1029) e' la mappa di
/// riepilogoSegnalazioniTracciato, letta una volta per tutto il tracciato.
///
/// NOTA (I20-1002): chiama getTracciatoColumns a ogni riga, e quella a sua volta interroga
/// il pluginMiddleware. Le colonne sono le stesse per tutto l'elenco: su un tracciato da
/// migliaia di referenze e' lo stesso lavoro rifatto migliaia di volte. Andrebbe calcolato
/// una volta in aggiornaTracciatoPostRicerca e passato qui.
function creaElementoTracciato(obj, isFirst, riepilogoSegnalazioni = {}) {
    const record = obj.recordInTracciato || {};
    const columns = getTracciatoColumns();

    //se è isFirst mettiamo un margin-top: 30px

    const $row = $("<div/>", {
        class: "tracciato-row elemento-tracciato"
    });
    if (isFirst) {
        $row.css("margin-top", "30px");
    }
    columns.forEach(col => {
        let $cell = $("<div/>", {
            class: "tracciato-cell"
        });

        applicaLarghezzaCella($cell, col.width);

        if (col.chiaveDato === "__pagina__") {
            $cell.addClass("pag");

            if (obj.paginaImpaginazione) {
                const $badge = $("<div/>").css({
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: COLORE_BADGE_TRACCIATO,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "11px"
                }).text(obj.paginaImpaginazione);

                const chiaveRecord = Segnalazioni.chiaveRecord(getIdRecFromItemRef(record));
                $badge.addClass("badge-pagina-tracciato");
                if (chiaveRecord != null) {
                    $badge.attr("idRec", chiaveRecord);
                }
                coloraBadgeTracciato($badge, chiaveRecord != null && riepilogoSegnalazioni != null ? riepilogoSegnalazioni[chiaveRecord] : null);

                $badge.on("click", function () {
                    trovaRecord(record["Scatto.CodiceGruppo"], getIdRecFromItemRef(record), obj.paginaImpaginazione, true, true);
                });

                $cell.append($badge);
            } else {
                const $btn = $("<button/>", {
                    class: "impagina-singolo",
                    title: "Impagina"
                }).css({
                    width: "20px",
                    height: "20px",
                    margin: "0",
                    border: "none",
                    borderRadius: "50%",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0"
                });

                $btn.html('<img src="images/impaginaRef.png" alt="Impagina" style="width:20px;height:20px;">');

                $btn.on("click", async function () {
                    const paginaImpaginazione = await getPaginaImpaginazioneCorrente();
                    if (paginaImpaginazione == null) {
                        messaggioUtente("Code IDX-101 Pagina corrente non rilevata, impossibile procedere con l'impaginazione.", "error", false, 5);
                        return;
                    }

                    const conferma = await confermaImpaginazioneDaTracciato(record, paginaImpaginazione);
                    if (!conferma) {
                        return;
                    }

                    await impaginaSingolo(record["Scatto.CodiceGruppo"], paginaImpaginazione, false, getIdRecFromItemRef(record));
                    const filtro = $("#areaFiltriEffettiva");
                    const res = await filtriJs.ricercaFiltro(filtro);
                    await aggiornaTracciatoPostRicerca(res);
                });

                $cell.append($btn);
            }
        }
        else if (col.chiaveDato.toLowerCase() === "codice") {
            const value = record["Scatto.CodiceGruppo"] || "";

            $cell.attr("title", value);
            $cell.attr("codiceGruppo", value);
            $cell.css("cursor", "pointer");
            $cell.text(value);

            $cell.on("click", function () {
                navigator.clipboard.writeText($(this).attr("codiceGruppo"));
                messaggioUtente("Code IDX-88 Codice copiato negli appunti", "success", false, 1);
            });
        }
        else if (col.chiaveDato.toLowerCase() === "descrizione") {
            var value = getDescrizioneRecordTracciato(record);


            $cell.attr("title", value);
            $cell.text(value);

            //aumentiamo un po' la larghezza di questa cella
            $cell.css("width", "300px");
            // Se vuoi descrizione multilinea:
            $cell.addClass("wrap");
        }
        else {
            const value = record[col.chiaveDato] || "";
            $cell.attr("title", value);
            $cell.text(value);
        }

        $row.append($cell);
    });

    return $row;
}

/// Impagina una sola referenza: chiede il dato al server e lo passa a
/// impaginazioneSingoloIndd.
///
/// byPassBloccoGiaImpaginato serve quando la referenza risulta gia' impaginata da qualche
/// parte e si vuole rifarla lo stesso: e' il server a tenere quel blocco, e il flag glielo
/// fa saltare.
///
/// In coda c'e' un ciclo di attesa, fino a venti secondi, perche' la risposta arriva in una
/// callback e la funzione e' async: senza, tornerebbe prima che l'impaginazione sia
/// avvenuta. Se l'attesa scade si avvisa l'operatore.
///
/// Attenzione: res diventa vero solo sul cammino che va a buon fine. Se il server risponde
/// con un errore l'operatore vede il messaggio dell'errore, ma questa funzione aspetta
/// comunque i venti secondi e poi aggiunge un timeout che timeout non e'.
async function impaginaSingolo(codice, pagina, byPassBloccoGiaImpaginato = false, idRec = null) {
    showLoading("Scaricamento del dato");
    indesignEvents.setBusy(true);
    await Utility.sleep(100);

    if (pagina == null) {
        pagina = pagSelected;
    }

    var xhr = new XMLHttpRequestClient();

    var res = false;
    xhr.onload = async (objResult, parsed) => {
        try{
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                } catch (e) {
                    messaggioUtente("Code IDX-89 Errore durante il parsing della risposta: " + e, "error");
                    return;
                }
            }
            console.log(objResult);
            if(!objResult.esito){
                console.error(objResult.error);
                messaggioUtente("Code IDX-90 Impaginazione singolo, errore durante il recupero del dato: " + objResult.error, "error");
                return;
            }

            var box = await impaginazioneSingoloIndd(objResult.records, pagina);
            res = true;
            if(box == null){
                messaggioUtente("Code IDX-91 Impaginazione singolo: Fallita impaginazione del box con codice "+codice, "error");
            }
        }
        catch (e) {
            messaggioUtente("Code IDX-92 Impaginazione singolo, errore generico: " + e, "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
        finally {
            hideLoading();
            indesignEvents.setBusy(false);
        }
    };

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
            } else {
                hideLoading();
                indesignEvents.setBusy(false);
            }
        }
    };

    xhr.onerror = function () {
        messaggioUtente("Code IDX-93 Impaginazione singolo: Errore di rete", "error");
        hideLoading();
        indesignEvents.setBusy(false);
    }

    var formData = new FormData();
    var idRecNorm = idRec != null && idRec !== "" && !isNaN(parseInt(idRec)) ? parseInt(idRec) : 0;
    formData.append("codiceGruppo", codice);
    formData.append("idRec", idRecNorm);
    formData.append("idLavorazione", idKitLavorazione);
    formData.append("pagina", pagina);
    formData.append("byPassBloccoGiaImpaginato", byPassBloccoGiaImpaginato);
    xhr.send("Menabo/impaginaSingolo", formData, "PUT");

    var securityCounter = 0;
    while(!res && securityCounter < 200){
        await Utility.sleep(100);
        securityCounter++;
    }

    if(securityCounter >= 200){
        messaggioUtente("Code IDX-94 Impaginazione singolo: Timeout durante l'impaginazione del singolo", "error");
    }
}


//I20-981: via i parametri getPreAnalisi ed elementoMappaTarget. Servivano solo al Report
//Integrita', che per avere una preanalisi passava da qui pagando la ricerca del box e la
//selezione della pagina: ora la preanalisi ha la sua strada in preAnalisiBoxMappato e questa
//funzione fa una cosa sola, impaginare il singolo.
/// Impagina una referenza in una pagina precisa. E' il gesto singolo, quello del pulsante
/// sulla referenza, non l'impaginazione di massa.
///
/// I20-981: via i parametri getPreAnalisi ed elementoMappaTarget. Servivano solo al Report
/// Integrita', che per avere una preanalisi passava da qui pagando la ricerca del box e la
/// selezione della pagina: ora la preanalisi ha la sua strada in preAnalisiBoxMappato e
/// questa funzione fa una cosa sola, impaginare il singolo.
///
/// Il punto delicato e' da dove prende i bounds, cioe' dove va a finire il box:
///   - se la mappa conosce gia' il box, si riusano i suoi bounds - si rifa' dov'era;
///   - se in pagina c'e' un altro box del Plugin, se ne copiano le misure e si parte
///     dall'angolo alto a sinistra: i box di una pagina hanno tutti la stessa forma;
///   - su pagina dispari si aggiunge la larghezza di pagina, perche' in uno spread le
///     coordinate proseguono sulla facciata destra invece di ripartire da zero.
///
/// Se il box c'e' gia' e la preanalisi non trova differenze, si esce restituendolo:
/// rifarlo identico costerebbe e basta.
///
/// Il noRender si riapplica in fondo perche' ricollegamento, confronto e rimozione dei
/// simboli possono rifare elementi del box, e un elemento rifatto nasce visibile.
/// L'operazione e' idempotente.
///
/// La variabile `found` viene assegnata e mai letta: e' un residuo.
async function impaginazioneSingoloIndd(records, pagina, cercaInPaginaPerConfronto, mappaPagina, massiveOperation = false, bounds = null, richiederRicollegamento = false) {
    try {
        //I20-981: primario, tracciato del primario e foto stanno in datiPrimarioPerConfronto,
        //che usa anche la preanalisi del Report Integrita'.
        var datiPrimario = datiPrimarioPerConfronto(records);
        if (datiPrimario == null) {
            messaggioUtente("Code IDX-95 Impaginazione singolo: Nessun elemento primario trovato nel gruppo", "error");
            return;
        }

        var primario = datiPrimario.primario;
        var tracciatoPrimario = datiPrimario.tracciatoPrimario;

        var boundsSpecifici = bounds != null;
        //i bounds avranno l'angolo sinistro superiore in 0,0 e l'angolo inferiore destro in larghezza,altezza pari ad 1/3 della pagina
        //[0, 0, (docInLavorazione.documentPreferences.pageHeight / 4), docInLavorazione.documentPreferences.pageWidth / 4];
        let tipo_lavorazione_corrente = ficoProcess.getTipoLavorazioneCorrente();

        var originalBox = null;
        //se c'è una mappa cerchiamo l'elemento target, oppure il primo con codice gruppo uguale al primario
        if (mappaPagina != null) {
            let elementoMappa = mappaPagina.find(el => el.codiceGruppo == primario.recordInTracciato["Scatto.CodiceGruppo"]);
            
            if (elementoMappa != null) {
                pagina = elementoMappa.pagina;
                originalBox = Utility._findBoxInExpectedPage(elementoMappa.refId, pagina);
                if(originalBox == null){
                    originalBox = Utility._findBoxInDocument(elementoMappa.refId);
                }
            }
        }

        //prendiamo quella con il nome uguale a pagina
        let page = docInLavorazione.pages.everyItem().getElements().find(p => p.name == pagina.toString());
        if (page == null) {
            messaggioUtente("Code IDX-96 Pagina " + pagina + " non trovata", "error");
            return;
        }

        //facciamo un select della pagina
        page.select();

        if (originalBox == null){
            //controlliamo se in pagina ci sono box (controlliamo i groups della pagina e se uno di questi ha la label che inizia con "base")
            //se c'è cambiamo i bounds in modo che l'angolo alto a sinistra resta uguale ma larghezza e altezza diventano pari a quelle del box trovato
            for (var i = 0; i < page.groups.length; i++) {
                var group = page.groups.item(i);
                var dna = Utility.getDnaOfBox(group);
                if (dna == null){
                    continue;
                }
                var found = false;
                if(bounds == null){
                    let width = group.geometricBounds[3] - group.geometricBounds[1];
                    let height = group.geometricBounds[2] - group.geometricBounds[0];
                    bounds = [0, 0, height, width];
                }

                if(cercaInPaginaPerConfronto){
                    if (primario.recordInTracciato["Scatto.CodiceGruppo"] == dna.codice_gruppo) {
                        found = true;
                        originalBox = group;
                        bounds = originalBox.geometricBounds;
                        break;
                    }
                }
                else {
                    found = true;
                    break;
                }
            }
        }
        else{
            //calcoliamo i bounds in base all'originalBox
            bounds = originalBox.geometricBounds;
        }

        //se l'originalBox è null dobbiamo vedere se siamo ad una pagina pari o dispari, se la pagina è dispari dobbiamo
        //applicare un offset alla posizione del box pari alla larghezza della pagina
        if (originalBox == null && !boundsSpecifici && bounds != null) {
            const pageNum = Number(page.name);
            if (!isNaN(pageNum) && pageNum != 1 && pageNum % 2 !== 0) {
                const pageWidth = docInLavorazione.documentPreferences.pageWidth;
                bounds = [bounds[0], bounds[1] + pageWidth, bounds[2], bounds[3] + pageWidth];
            }
        }

        if (originalBox != null) {
            var preAnalisi = await confronti.confrontoBoxCompiledFieldPreAnalisi(originalBox, datiPrimario.compiledFields, datiPrimario.deletedFields, datiPrimario.listaFoto, datiPrimario.fotoExtra, datiPrimario.fotoExtraAuto, true,
                NoRenderElementi.elencoPerSegnalazioni(tracciatoPrimario.noRenderElementi, tracciatoPrimario.membriGruppoFoto), tracciatoPrimario);

            if (preAnalisi != null && preAnalisi.differenze.length == 0) {
                return originalBox;
            }

        }

        if(!massiveOperation){
            CssFramework.richiediDiScaricareFramework();
        }

        var reportImpaginazioneObj = { segnalazioni: [] };

        var box = await impaginaBox(tracciatoPrimario["codiceBox"] != null ? tracciatoPrimario["codiceBox"] : tracciatoPrimario["combinazioneAssegnata"], page, bounds, tracciatoPrimario, pathLavorazione, [], tipo_lavorazione_corrente, reportImpaginazioneObj);
        //calcoliamo il top e left bleed del documento
        // let topBleed = docInLavorazione.documentPreferences.documentBleedTopOffset;
        // let leftBleed = docInLavorazione.documentPreferences.documentBleedInsideOrLeftOffset;
        // box.boxAggiunto.move([page.bounds[1] - (leftBleed), page.bounds[0] - (topBleed)]);
        
        if(box != null && box.boxAggiunto != null && richiederRicollegamento){
            await schedaRef.ricollegaBoxImpaginato(box.boxAggiunto, true);
        }
        
        if (originalBox != null && box != null && cercaInPaginaPerConfronto) {
            await confronti.confrontoBox(originalBox, box.boxAggiunto);
        }
        
        if(!massiveOperation){
            stampaSegnalazioni(reportImpaginazioneObj);
            rimuoviSimboli();
            //I20-1029, lotto 2: la schermata, se il box ha segnalazioni. Le operazioni massive del
            //Report Integrita' non passano di qui: la aprirebbero a ogni box.
            SchermataSegnalazioni.apriSeCiSono(reportImpaginazioneObj);
        }

        //Ricollegamento, confronto e rimozione dei simboli possono rifare elementi del box,
        //e un elemento rifatto nasce visibile: si riapplica, l'operazione e' idempotente.
        if (box != null && box.boxAggiunto != null) {
            applicaNoRenderAgliElementiDelBox(box.boxAggiunto, tracciatoPrimario.noRenderElementi);
        }

        return box;
    } catch (e) {
        console.error(e);
        messaggioUtente("Code IDX-97 Errore generico durante l'impaginazione in InDesign: " + e, "error");
        return null;
    }
}

var cartellaAssenteCheck = false;
//I20-981: dove scrivere un messaggio all'operatore.
//Con un overlay aperto il posto giusto e' il contenitore dentro l'overlay: quello della
//schermata principale gli finisce sotto. Si guarda lo stile in linea invece di :visible,
//perche' in UXP le misure su cui :visible si basa non sono affidabili.
/// I20-1018: la cartella in cui scrivere i log, per messaggioUtente e writeDebugMessageForCrash.
///
/// percorsoLogs parte da "/Logs/", relativo alla lavorazione, e impostaPercorsiDiSistema lo
/// rende assoluto: da file.pathLogs di lavorazioni.json, o da pathLavorazione + "/Logs/" se
/// manca. Da li' in poi si usa com'e'; concatenarci davanti pathLavorazione dava un percorso
/// inesistente. Prima che succeda, pero', si scrive gia': aprendo una lavorazione nuova,
/// impostaPercorsiDiSistema per foto e loghi scrive nel log prima che tocchi ai log, e in quel
/// momento il valore relativo va ancora completato. Vuoto vuol dire che la cartella non c'e'.
function cartellaDeiLog() {
    return percorsoLogs === defaultPercorsoLogs ? pathLavorazione + percorsoLogs : percorsoLogs;
}

/// I20-981: dove scrivere un messaggio all'operatore.
///
/// Con un overlay aperto il posto giusto e' il contenitore dentro l'overlay: quello della
/// schermata principale gli finisce sotto e non si legge. Si guarda lo stile in linea
/// invece di :visible, perche' in UXP le misure su cui :visible si basa non sono
/// affidabili.
///
/// Se qualcosa va storto si ripiega sul contenitore indicato dal parametro: un messaggio
/// nel posto sbagliato e' meglio di nessun messaggio.
function contenitoreMessaggi(modal) {
    try {
        const aperti = $(".overlayModal").filter(function () {
            const display = this.style ? this.style.display : "";
            return display != null && display !== "" && display !== "none";
        });

        if (aperti.length > 0) {
            const dentroOverlay = aperti.first().find('[id="messaggiUtenteModal"]').first();
            if (dentroOverlay.length > 0) {
                return dentroOverlay;
            }
        }
    }
    catch (e) {
        console.error("Errore nella scelta del contenitore dei messaggi:", e);
    }

    return $("#messaggiUtente" + (modal ? "Modal" : ""));
}

/// L'unico modo in cui il Plugin parla all'operatore. Scrive il messaggio a video e lo
/// registra nel file di log del giorno.
///
/// Il colore dice la gravita': verde riuscito, arancione avviso, rosso tutto il resto -
/// compreso uno stile non riconosciuto, perche' un messaggio di cui non si sa la natura e'
/// piu' prudente mostrarlo come errore.
///
/// A video ce n'e' uno alla volta: il precedente viene rimosso. Sopra i 200 caratteri si
/// tronca, perche' il pannello e' stretto e il testo lungo lo sfonda; nel log, invece, il
/// messaggio finisce intero.
///
/// tempo > 0 lo fa sparire da solo dopo quei secondi. Il timeout precedente viene sempre
/// annullato, altrimenti un messaggio vecchio porterebbe via quello nuovo.
///
/// I20-981: col modal aperto i messaggi finivano dietro, nel contenitore della schermata
/// principale, e non si leggevano. Il parametro modal esiste da sempre ma quasi nessuno lo
/// passa: invece di rincorrere le chiamate, il contenitore lo sceglie contenitoreMessaggi
/// guardando se c'e' un overlay aperto.
///
/// dontWriteInLogs evita la ricorsione: se e' la scrittura del log a fallire, il messaggio
/// che lo dice non puo' provare a scriversi nel log.
/// I20-1038: il nome della macchina che scrive il log. I log stanno in una cartella Dropbox
/// condivisa fra piu' postazioni, e senza questo campo non si capisce da quale PC viene una riga.
/// UXP non garantisce os.hostname(): si prova, poi l'utente, poi il nome della home; mai un
/// errore, e il risultato si calcola una volta sola. Il parametro os serve ai test.
var nomeMacchinaCache = null;
function nomeMacchina(os = null) {
    if (nomeMacchinaCache != null && os == null) {
        return nomeMacchinaCache;
    }
    var modulo = os;
    try {
        if (modulo == null) {
            modulo = require('os');
        }
    }
    catch (e) {
        modulo = null;
    }
    var tentativi = [
        function () { return modulo.hostname(); },
        function () { return modulo.userInfo().username; },
        function () { return modulo.homedir().split(/[\\/]/).filter(function (p) { return p !== ""; }).pop(); }
    ];
    var nome = null;
    for (var i = 0; i < tentativi.length && nome == null; i++) {
        try {
            var valore = tentativi[i]();
            if (valore != null && String(valore).trim() !== "") {
                nome = String(valore).trim();
            }
        }
        catch (e) {
            //si passa al tentativo dopo
        }
    }
    if (nome == null) {
        nome = "sconosciuta";
    }
    if (os == null) {
        nomeMacchinaCache = nome;
    }
    return nome;
}

/// I20-1033: il canale e l'area di una lavorazione, scritti come li legge l'operatore:
/// "Canale CN · Area TO". Riceve i dettagli di ficoProcess (oggetti con la sigla, oppure 0
/// quando mancano) e restituisce null se non ce n'e' nessuno.
function contestoLavorazioneMessaggio(canale, area) {
    var parti = [];
    if (canale != null && canale.sigla) {
        parti.push("Canale " + canale.sigla);
    }
    if (area != null && area.sigla) {
        parti.push("Area " + area.sigla);
    }
    return parti.length > 0 ? parti.join(" · ") : null;
}

/// I20-1033: canale e area della lavorazione aperta adesso, per i messaggi della console e del
/// log. Null senza una lavorazione: idKitLavorazione torna a 0 quando il documento non ne ha una,
/// mentre i dettagli di ficoProcess restano quelli della lavorazione di prima. Non fallisce mai:
/// un messaggio non deve perdersi per colpa del suo contesto.
function contestoLavorazioneCorrente() {
    try {
        if (!idKitLavorazione) {
            return null;
        }
        return contestoLavorazioneMessaggio(ficoProcess.getCanaleLavorazioneCorrente(), ficoProcess.getAreaLavorazioneCorrente());
    }
    catch (e) {
        return null;
    }
}

async function messaggioUtente(msg, style, loading = false, tempo = 0, dontWriteInLogs = false, modal = false) {
    try {
        if (msg == null || msg == "") {
            return;
        }
        style = style ? style.toLowerCase() : style;
        //apriamo la sottocartella logs (se non c'è la creiamo) e cerchiamo un file chiamato log_dd-mm-yy.txt, se non c'è lo creiamo e scriviamo il messaggio nel seguente formato
        //un oggetto composto da data:giorno/mese/anno, orario:ora:minuti:secondi, stile:style, msg:msg; se il file esiste appendiamo il messaggio
        function formatTwoDigits(n) {
            return n < 10 ? '0' + n : '' + n;
        }

        var logPath = cartellaDeiLog();

        var date = new Date();
        var logMessage = {
            data: formatTwoDigits(date.getDate()) + "/" + formatTwoDigits((date.getMonth() + 1)) + "/" + date.getFullYear(),
            orario: formatTwoDigits(date.getHours()) + ":" + formatTwoDigits(date.getMinutes()) + ":" + formatTwoDigits(date.getSeconds()),
            macchina: nomeMacchina(),
            stile: style,
            msg: msg
        };
        //I20-1033: canale e area della lavorazione, per la console e per il file di log. Il
        //riquadro in cima al pannello resta com'era: lo compone msg, non logMessage.
        var lavorazioneMessaggio = contestoLavorazioneCorrente();
        if (lavorazioneMessaggio != null) {
            logMessage.lavorazione = lavorazioneMessaggio;
        }

        writeFileInConsole(logMessage);

        if (!dontWriteInLogs) {
            var logFile = logPath + "log_" + date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear() + ".txt";
            var file = readFile(logFile);
            if (file == null) {
                try {
                    if (!appendToFile(logFile, logMessage)) {
                        if (!cartellaAssenteCheck) {
                            messaggioUtente("Code IDX-98 Errore cartella logs assente nella cartella di lavorazione, i log non verranno salvati", "error", false, 0, true);
                            cartellaAssenteCheck = true;
                        }
                        // tryToCreateLogsFolder = true;
                        // var folder = await fs2.getFolder();
                        // if (folder != null) {
                        //     folder.createFolder("logs");
                        //     appendToFile(logFile,logMessage);
                        // }
                        // else{
                        //     messaggioUtente("Errore durante la creazione della cartella logs, i log non verranno salvati", "error");
                        //     folderLogsPresente = false;
                        // }
                    }
                }
                catch (e) {
                    messaggioUtente("Code IDX-99 Errore durante la creazione della cartella logs, i log non verranno salvati: " + e, "error", false, 0, true);
                }
            }
            else {
                appendToFile(logFile, logMessage);
            }
        }

        $("#messaggioUtenteComposto").remove();
        //appendiamo il messaggio a #messaggiUtente, se lo style è 'success' il colore di sfondo è verde, se è 'error' è rosso, se è 'warning' è giallo altrimenti è rosso, se loading è true mettiamo un'animazione di caricamento e se tempo è maggiore di 0 chiudiamo il messaggio dopo tempo secondi
        var color = "red";
        if (style == "success") {
            color = "green";
        }
        else if (style == "warning") {
            color = "darkorange";
        }

        //se il messaggio è più lungo di 200 caratteri lo tronchiamo e aggiungiamo i tre puntini
        if (msg.length > 200) {
            msg = msg.substring(0, 200) + "...";
        }

        var html = '<div class="row" id="messaggioUtente" style="background-color: ' + color + '; width:90%; display: flex; padding:2px;"> <div class="col" style="color: white; padding-left: 10px; font-size:10px; width:90%;"><h4 style="margin: 0; display: flex; align-items: center;width: 100%;">' + msg + '</h4></div>';
        //I20-981: col modal aperto i messaggi finivano dietro, nel contenitore della schermata
        //principale, e non si leggevano. Il parametro modal esiste da sempre ma quasi nessuno
        //lo passa: invece di rincorrere le chiamate, il contenitore lo sceglie la funzione,
        //guardando se c'e' un overlay aperto.
        contenitoreMessaggi(modal).append(html);
        //usiamo uno spinner per il caricamento, poichè non supporta le gif dobbiamo creare noi un effetto che possa sembrare un caricamento
        if (loading) {

            //$("#messaggioUtente").append('<img class="col" src="images/spinner.gif" style="height: 20px; width: 20px;">');
            $("#messaggioUtente").append('<div class="loader"></div>');
        }
        //aggiungiamo un pulsante per chiudere il messaggio
        var closeButton = $('<button style="color: black; margin-left: 10px;">X</button>')
        closeButton.click(function () {
            $(this).parent().remove();
        });
        $("#messaggioUtente").append(closeButton);
        $("#messaggioUtente").attr("id", "messaggioUtenteComposto");
        if (tempo > 0) {
            var timeoutId = setTimeout(function () {
                $("#messaggioUtenteComposto").remove();
            }, tempo * 1000);
            // Clear the current timeout if it exists
            if (currentTimeoutId !== null) {
                clearTimeout(currentTimeoutId);
            }
            currentTimeoutId = timeoutId;
        }
        else {
            if (currentTimeoutId !== null) {
                clearTimeout(currentTimeoutId);
            }
            currentTimeoutId = null;
        }
    }
    catch (e) {
        console.log(e);
    }
}

/// Scrive una riga in un file Debuglog_<data>.txt, per ricostruire cosa stava succedendo
/// quando InDesign e' morto. Non mostra niente a video.
///
/// Serve dove un console.log non basta: se il processo crolla, la console se ne va con lui,
/// il file no.
///
/// I20-1018: il percorso era "pathLavorazione + percorsoLogs", ma percorsoLogs e' gia'
/// assoluto: il Debuglog non veniva mai scritto, e la scrittura fallita mostrava "Code IDX-98
/// Errore cartella logs assente" anche con la cartella al suo posto. Ora la cartella la dice
/// cartellaDeiLog, la stessa di messaggioUtente.
function writeDebugMessageForCrash(msg) {
    try {
        if (msg == null || msg == "") {
            return;
        }
        //apriamo la sottocartella logs (se non c'è la creiamo) e cerchiamo un file chiamato log_dd-mm-yy.txt, se non c'è lo creiamo e scriviamo il messaggio nel seguente formato
        //un oggetto composto da data:giorno/mese/anno, orario:ora:minuti:secondi, stile:style, msg:msg; se il file esiste appendiamo il messaggio
        function formatTwoDigits(n) {
            return n < 10 ? '0' + n : '' + n;
        }

        var logPath = cartellaDeiLog();

        var date = new Date();
        var logMessage = {
            data: formatTwoDigits(date.getDate()) + "/" + formatTwoDigits((date.getMonth() + 1)) + "/" + date.getFullYear(),
            orario: formatTwoDigits(date.getHours()) + ":" + formatTwoDigits(date.getMinutes()) + ":" + formatTwoDigits(date.getSeconds()),
            macchina: nomeMacchina(),
            msg: msg
        };


        var logFile = logPath + "Debuglog_" + date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear() + ".txt";
        var file = readFile(logFile);
        if (file == null) {
            try {
                if (!appendToFile(logFile, logMessage)) {
                    if (!cartellaAssenteCheck) {
                        messaggioUtente("Code IDX-98 Errore cartella logs assente nella cartella di lavorazione, i log non verranno salvati", "error", false, 0, true);
                        cartellaAssenteCheck = true;
                    }
                }
            }
            catch (e) {
                messaggioUtente("Code IDX-99 Errore durante la creazione della cartella logs, i log non verranno salvati: " + e, "error", false, 0, true);
            }
        }
        else {
            appendToFile(logFile, logMessage);
        }

    }
    catch (e) {
        console.log(e);
    }
}

//da finire di ripristinare
/// Cerca nel documento il box di una referenza e lo seleziona.
///
/// Il riconoscimento avviene sul DNA del box (Utility.getDnaOfBox), non sull'etichetta:
/// serve la coppia codice gruppo + idRec, perche' la stessa referenza puo' comparire piu'
/// volte. Si guardano solo i gruppi del livello "InPagina": quello che sta su altri livelli
/// non e' impaginato.
///
/// Tre esiti, in ordine di bonta':
///   - trovato con l'idRec giusto: si seleziona e si dice trovato;
///   - trovato lo stesso codice ma con un altro idRec (alternativeMatch): si seleziona
///     comunque, avvisando che l'idRec non corrisponde. Meglio portare l'operatore vicino
///     a quello che cerca che dirgli di no;
///   - non trovato nella pagina attesa: si ricerca in tutto il documento, e se salta fuori
///     altrove si avvisa che l'impaginato andrebbe sincronizzato.
///
/// Con RemoveOnFail, se non si trova proprio, si propone di toglierla dall'impaginato sul
/// server: e' il caso di una referenza che il server crede impaginata e nel documento non
/// c'e' piu'. La conferma e' obbligatoria.
async function trovaRecord(codice, idRec, searchPage = null, select = true, RemoveOnFail = false, paginaAttesa = searchPage) {
    try{
        //cerchiamo in ogni pagina il box con label uguale a base$codice e lo selezioniamo   
        console.log("cerchiamo il record " + codice + " nella pagina " + (searchPage == null ? "null" : searchPage.toString()));
        showLoading("Ricerca in corso...");
        await Utility.sleep(50);
        var alternativeMatch = null;
        for (var p = 0; p < docInLavorazione.pages.length; p++) {
            var page = docInLavorazione.pages.item(p);
            if (searchPage != null && page.name != searchPage.toString()) {
                continue;
            }
            for (var i = 0; i < page.groups.length; i++) {
                var group = page.groups.item(i);
                if (group.itemLayer.name != "InPagina") {
                    continue;
                }
                var dna = Utility.getDnaOfBox(group);
                if (dna == null) {
                    continue;
                }

    
                if (dna.codice_gruppo == codice && dna.id_rec == idRec) {
                    if (select) {
                        group.select();
                    }
                    messaggioUtente("Code IDX-100 Elemento trovato (" + codice + ")", "success", false, 2);
                    hideLoading();

                    var result = {
                        esito: true,
                        page: p
                    };
                    return result;
                }
                else if(dna.codice_gruppo == codice && alternativeMatch == null){
                    alternativeMatch = group;
                }
            }
        }

        if(alternativeMatch != null){
            if (select) {
                alternativeMatch.select();
            }
            messaggioUtente("Code IDX-100 Elemento trovato (" + codice + ") ma il suo idRec non corrisponde", "success", false, 2);
            hideLoading();

            var result = {
                esito: true,
                page: alternativeMatch.parentPage ? alternativeMatch.parentPage.name : null
            };
            return result;
        }
    
        //se non è stata trovata e la searchPage non è null ripetiamo la ricerca senza searchPage
        if (searchPage != null) {
            var res = await trovaRecord(codice, idRec, null, select, RemoveOnFail, searchPage);
            if(res.esito){
                messaggioUtente("Code IDX-101 Elemento trovato (" + codice + ") trovato a pagina " + res.page + ", la pagina attesa era " + searchPage+". Si consiglia di sincronizzare l'impaginato.", "warning", false, 2);
            }
            return res;
        }
    
        if (RemoveOnFail) {
            hideLoading();
            var idRecNorm = idRec != null && !isNaN(parseInt(idRec)) ? parseInt(idRec) : 0;
            var confermaRimozione = await Modali.confirmRimozioneRefNonTrovata({
                codice: codice,
                idRec: idRecNorm,
                paginaAttesa: paginaAttesa
            });

            if (confermaRimozione) {
                messaggioUtente("Code IDX-102 Elemento non trovato, procedo a rimuoverlo dall'impaginato sul server", "warning", false, 0);
                await rimuoviRefImpaginata([{ codice: codice, idRec: idRecNorm }]);
            }
            else {
                messaggioUtente("Code IDX-102 Rimozione dal server annullata per elemento non trovato (" + codice + ")", "warning", false, 5);
            }
        }
        else{
            messaggioUtente("Code IDX-103 Elemento non trovato (" + codice + ") si consiglia di sincronizzare l'impaginato", "warning", false, 2);
        }

    }
    catch(e){
        console.error(e);
        messaggioUtente("Code IDX-104 Errore generico durante la ricerca dell'elemento " + codice + ": " + e, "error");
    }
    hideLoading();
    var result = {
        esito: false,
        page: 0
    };
    return result;
}

/// Mostra o nasconde l'elenco del tracciato, cambiando anche il testo del pulsante.
///
/// Lo stato sta in un attributo del pulsante stesso (tracciatoVisibile), non in una
/// variabile: e' il pulsante a ricordarsi come e' messo.
function mostraNascondiTracciato() {
    //cerchiamo mostraNascondiTracciato e leggiamo il sua attr tracciatoVisibile
    var bottoneTracciato = $("#mostraNascondiTracciato");
    var tracciatoVisibile = bottoneTracciato.attr("tracciatoVisibile");

    //se tracciatoVisibile è false modifichiamo il valore in true e il testo del bottone in Nascondi tracciato, altrimenti modifichiamo il valore in false e il testo in Mostra tracciato
    if (tracciatoVisibile == "false") {
        bottoneTracciato.attr("tracciatoVisibile", "true");
        bottoneTracciato.text("Nascondi tracciato");
        $("#TracciatoRecords").show();
        //openTab(null, 'Tab7');
    }
    else {
        bottoneTracciato.attr("tracciatoVisibile", "false");
        bottoneTracciato.text("Mostra tracciato");
        $("#TracciatoRecords").hide();
    }
}

var listaRecordDaAltriTracciati = [];
//#region clonazione del record da rivedere
/// Cerca una referenza per codice, prima nel tracciato aperto e poi in tutti gli altri.
///
/// Le due ricerche sono annidate di proposito: la prima, su getSchedaRef col kit corrente,
/// serve a dire "ce l'hai gia'" - e in quel caso ci si ferma con un avviso. Solo se
/// fallisce parte la seconda (LeggiTracciatoRecord con idTracciato 0), che guarda
/// ovunque. Trovandola altrove si apre la clonazione, che e' il modo di portarla qui.
///
/// Un codice di gruppo arriva come elenco separato da virgole: viene riordinato
/// alfabeticamente prima di spedirlo, perche' il server riconosce il gruppo dalla stringa e
/// "A,B" e "B,A" sono lo stesso gruppo.
function cercaRecordInTracciato(Codice) {
    //mandiamo la richiesta xhr per ottenere il record
    if (Codice == null || Codice == "" || Codice == 0 || Codice == "0") {
        messaggioUtente("Code IDX-105 Codice non valido", "error");
        return;
    }
    //se è un gruppo, ovvero con split(",") troviamo almeno 2 elementi, allora riordiniamo gli elementi in modo che siano in ordine alfabetico e poi rifacciamo il join
    if (Codice.includes(",")) {
        var elementi = Codice.split(",");
        elementi.sort();
        Codice = elementi.join(",");
    }

    resetEditTracciato();
    var xhr = new XMLHttpRequestClient();
    xhr.onload = (objResult, parsed) => {
        try {
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                    console.log(objResult);
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code IDX-106 CercaRecordInTracciato: Errore durante il parsing della risposta:" + e, "error");
                }
            }
            //mi dovrebbe tornare un oggetto con due parametri, esito, error se l'operazione è fallita, sennò mi arriva una menaboRef
            if (objResult.esito != null && !objResult.esito) {
                // messaggioUtente("Errore durante la ricerca su server: " + objResult.error, "error");
                // return;

                //creiamo una nuova richiesta xhr passando idTracciato 0 e l'ultimo parm a true
                var xhr2 = new XMLHttpRequestClient();
                xhr2.onload = (objResult, parsed) => {
                    if (!parsed) {
                        try {
                            objResult = JSON.parse(objResult);
                            console.log(objResult);
                        }
                        catch (e) {
                            console.log(e);
                            messaggioUtente("Code IDX-106 CercaRecordInTracciato: Errore durante il parsing della risposta:" + e, "error");
                        }
                    }
                    //mi dovrebbe tornare un oggetto con due parametri, esito, error se l'operazione è fallita, sennò mi arriva una menaboRef
                    if (objResult.esito != null && !objResult.esito) {
                        messaggioUtente("Code IDX-107 CercaRecordInTracciato: Errore durante la ricerca su server: " + objResult.error, "error");
                        return;
                    }

                    if (objResult.error != null && objResult.error != "") {
                        messaggioUtente("Code IDX-108 CercaRecordInTracciato: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                    }

                    if (objResult.length == 0) {
                        messaggioUtente("Code IDX-109 CercaRecordInTracciato: Operazione terminata, nessun record trovato", "warning", false, 5);
                        var errorText = $('<span style="color:white; font-size:10px; margin-top:5px;">Il record non è stato trovato in nessun tracciato, ricontrollare il codice inserito</span>');
                        $("#campiRecord").append(errorText);
                        return;
                    }

                    schedaRef.ricollegaBoxImpaginato(null, true, Codice)
                }

                xhr2.onreadystatechange = function () {
                    if (xhr2.readyState == 4) {
                        if (xhr2.status == 200) {
                            messaggioUtente("Code IDX-110 CercaRecordInTracciato: Richiesta completata con successo", "success", false, 5);
                        } else {
                        }
                    }
                }

                xhr2.onerror = function () {
                    messaggioUtente("Code IDX-111 CercaRecordInTracciato: Errore di rete", "error");
                }

                var formData = new FormData();
                formData.append("codiceOrCodiceGruppo", Codice);
                xhr2.send("Menabo/LeggiTracciatoRecord/" + 0 + "/" + false + "/" + false + "/" + false + "/" + true + "/" + true, formData, "PUT");
            }
            else {
                messaggioUtente("Code IDX-112 Il record si trova già nel tracciato attualmente selezionato", "warning", false, 5);
            }
        }
        catch (e) {
            messaggioUtente("Code IDX-113 CercaRecordInTracciato Errore generico: " + e, "error");
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                messaggioUtente("Code IDX-114 CercaRecordInTracciato: Richiesta completata con successo", "success", false, 5);
            } else {
            }
        }
    }

    xhr.onerror = function () {
        messaggioUtente("Code IDX-115 CercaRecordInTracciato: Errore di rete", "error");
    };
    var formData = new FormData();
    formData.append("codiceGruppo", Codice);
    xhr.send("Menabo/getSchedaRef/" + idKitLavorazione + "/" + false, formData, "PUT");
}

/// Chiede al server le schede di piu' referenze in una volta sola, invece di una richiesta
/// per referenza.
///
/// I codici viaggiano uniti da un trattino; gli idRec, se ci sono, allo stesso modo e nello
/// stesso ordine.
///
/// Il secondo parametro puo' essere la callback: e' la forma vecchia della chiamata, senza
/// idRec, e le prime righe la riconoscono per non rompere chi la usa ancora.
///
/// NOTA (I20-1002): "let me = this" e il controllo me.isInvalidated sono un trapianto da
/// schedaRef.js, dove this e' l'oggetto modulo. Qui la funzione e' globale e this e'
/// l'oggetto globale, quindi me.isInvalidated e' sempre undefined e quel controllo non
/// scatta mai. Lo stesso vale per "this.isBusy = false" nel catch, che scrive su una
/// proprieta' del globale che nessuno legge.
async function getSchedeRefsMassivo(codiciGruppi, idRecs, callback) {
    if (typeof idRecs === "function") {
        callback = idRecs;
        idRecs = null;
    }

    let me = this;

    var xhr = new XMLHttpRequestClient();
    xhr.onload = async (objResult, parsed) => {
        try {

            if (me.isInvalidated) {
                console.warn("La scheda ref non è più valida");
                callback("La scheda ref non è più valida", null);
                return;
            }

            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                } catch (e) {
                    messaggioUtente("Code IDX-116 getSchedeRefsMassivo: Errore durante il parsing della risposta: " + e, "error");
                    return;
                }
            }
            // Chiamata alla callback con il risultato ottenuto
            if (callback) {
                try {
                    callback(null, objResult); // Passiamo `null` come primo argomento per indicare che non c'è errore
                } catch (e) {
                    console.error(e);
                    this.isBusy = false;
                }
            }
        } catch (e) {
            messaggioUtente("Code IDX-117 getSchedeRefsMassivo: Errore generico durante l'elaborazione della risposta: " + e, "error");
            // Gestione dell'errore e chiamata alla callback con l'errore
            if (callback) {
                callback(e, null);
            }
        }
    };

    xhr.onerror = function (e) {
        // Gestione degli errori di rete e chiamata alla callback con l'errore
        if (callback) {
            callback(e, null);
        }
    };

    // Esegui la richiesta GET
    var formData = new FormData();
    formData.append("codiciGruppo", codiciGruppi.join("-"));
    if (Array.isArray(idRecs) && idRecs.length > 0) {
        formData.append("idsRec", idRecs.map(id => id == null ? "" : parseInt(id)).join("-"));
    }

    xhr.send("Menabo/getSchedeRefs/" + idKitLavorazione + "/" + true, formData, "PUT");
}

/// Quando si sceglie un tracciato dalla tendina della clonazione, mostra i campi di quel
/// record perche' l'operatore possa correggerli prima di clonarlo.
///
/// I campi non sono tutti modificabili allo stesso modo: il cliente decide quali non si
/// toccano e quali vanno messi per primi (listCampiNonEditabili,
/// listCampiEditabiliPrioritari).
///
/// Senza record scelto scrive l'avviso che spiega cosa sta succedendo: la referenza non e'
/// in questo tracciato ma esiste in altri, e va scelto da quale portarla.
function selezionatoTracciatoEdit(idTracciato) {
    $("#campiRecord").empty();
    //convertiamo idTracciato in un numero
    idTracciato = parseInt(idTracciato);
    //cerchiamo l'array in listaRecordDaAltriTracciati con idTracciato uguale a idTracciato
    var record = null;
    for (var i = 0; i < listaRecordDaAltriTracciati.length; i++) {
        if (listaRecordDaAltriTracciati[i]["idTracciato"] == idTracciato) {
            record = listaRecordDaAltriTracciati[i];
            break;
        }
    }

    if (record == null) {
        var h4 = $('<span style="color:white; font-size:10px; margin-top:5px;">Il record non è stato trovato nel tracciato attualmente selezionato, ma è presente in altri tracciati; scegliere un tracciato per iniziare il processo di clonazione (una seconda conferma sarà richiesta dopo aver finito di modificare i campi)</span>');
        $("#campiRecord").append(h4);
        return;
    }

    //scarichiamo dal custom le liste     listCampiNonEditabili : [] e listCampiEditabiliPrioritari : []
    var listCampiNonEditabili = [];
    var listCampiEditabiliPrioritari = [];
    try {
        var listCampiNonEditabili = pluginMiddleware.getCampo("listCampiNonEditabili");
    }
    catch { }
    try {
        var listCampiEditabiliPrioritari = pluginMiddleware.getCampo("listCampiEditabiliPrioritari");
    }
    catch { }

    //le due liste contengono tutti nomi di chiavi che si possono trovare nei record all'interno di records
    //adesso adottiamo due comportamenti uno in caso di gruppi (records ha length > 1) e uno in caso di record singoli (length == 1)
    if (record.Dato != null) {
        //creiamo intanto due div dentro campiRecord, nel primo inseriremo i campi prioritari, il secondo div invece avrà un pulsante per essere mostrato (di defualt è in display:none) e conterra tutti campi che non appaiono in nessuna lista
        $("#campiRecord").empty();
        //questo è il caso sia un gruppo, per ogni record creiamo un div nascosto composto dai vari singoli e un pulsante per ognuno con scritto Mostra (codice) che mostra il div corrispondente

        var dato = record.Dato;

        // var buttonApriSingolo = $('<button style="width: 100%; margin-top: 10px; display:block; margin-left:0px;" mostra="' + 0 + '" codice="' + dato["Referenza.Codice"] + '">Mostra ' + dato["Referenza.Codice"] + '</button>');
        // buttonApriSingolo.click(function () {
        //     if ($("#record" + $(this).attr("mostra")).css("display") === "none") {
        //         $(this).text("Nascondi " + $(this).attr("codice"));
        //         $("#record" + $(this).attr("mostra")).show();
        //     } else {
        //         $(this).text("Mostra " + $(this).attr("codice"));
        //         $("#record" + $(this).attr("mostra")).hide();
        //     }
        // });
        // $("#campiRecord").append(buttonApriSingolo);
        var div = $('<div style="display:block;" class="recordClonazione" id="record' + 0 + '" codice="' + dato["Referenza.Codice"] + '"></div>');
        $("#campiRecord").append(div);

        var div1 = $('<div style="display:block;" id="campiPrioritari' + 0 + '"></div>');
        var div2 = $('<div style="display:none; margin-top: 10px;" id="altriCampi' + 0 + '"></div>');
        //creaiamo un pulsante per mostrare gli altri campi
        var button = $('<button style="width: 100%; margin-top: 10px;"mostra="' + 0 + '">Mostra altri campi</button>');
        button.click(function () {
            if ($("#altriCampi" + $(this).attr("mostra")).css("display") === "none") {
                $(this).text("Nascondi altri campi");
                $("#altriCampi" + $(this).attr("mostra")).show();
            } else {
                $(this).text("Mostra altri campi");
                $("#altriCampi" + $(this).attr("mostra")).hide();
            }
        });
        $("#record" + 0).append(div1);
        $("#record" + 0).append(div2);
        $("#record" + 0).append(button);
        for (var key in dato) {
            if (listCampiNonEditabili.includes(key)) {
                continue;
            }
            if (listCampiEditabiliPrioritari.includes(key)) {
                var div = $('<div style="display:block; width:100%;"></div>');
                var label = $('<label style="width: 30%; color: white;">' + key + '</label>');
                div.append(label);
                var value = dato[key];
                if (typeof value == "string") {
                    var textArea = $('<textarea class="hideble" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">' + value + '</textarea>');
                    div.append(textArea);
                }
                else if (typeof value == "number") {
                    var input = $('<input type="text" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">');
                    div.append(input);
                }
                else if (typeof value == "boolean") {
                    var checkbox = $('<input type="checkbox" style="width: 70%;" ' + (value ? 'checked' : '') + ' key="' + key + '">');
                    div.append(checkbox);
                }
                div1.append(div);
            }
            else {
                var div = $('<div style="display:block; width:100%;"></div>');
                var label = $('<label style="width: 30%; color: white;">' + key + '</label>');
                div.append(label);
                var value = dato[key];
                if (typeof value == "string") {
                    var textArea = $('<textarea class="hideble" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">' + value + '</textarea>');
                    div.append(textArea);
                }
                else if (typeof value == "number") {
                    var input = $('<input type="text" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">');
                    div.append(input);
                }
                else if (typeof value == "boolean") {
                    var checkbox = $('<input type="checkbox" style="width: 70%;" ' + (value ? 'checked' : '') + ' key="' + key + '">');
                    div.append(checkbox);
                }
                div2.append(div);
            }
        }

        
        //creiamo il pulsante clona che se premuto chiama la funzione clonaRecord passando il codice gruppo salvato come attr nel pulsante
        var clonaButton = $('<button style="width: 100%; margin-top: 10px;">Clona record</button>');
        clonaButton.click(function () {
            clonaRecord($(this).attr("codiceGruppo"));
        });
        clonaButton.attr("codiceGruppo", dato["Scatto.CodiceGruppo"]);
        $("#campiRecord").append(clonaButton);
    }
    // else if (record.length == 1) {
    //     //creiamo intanto due div dentro campiRecord, nel primo inseriremo i campi prioritari, il secondo div invece avrà un pulsante per essere mostrato (di defualt è in display:none) e conterra tutti campi che non appaiono in nessuna lista
    //     var divClone = $('<div style="display:block; width:100%;" class="recordClonazione" id="record0" codice="' + record[0]["Referenza.Codice"] + '" ></div>');
    //     var div1 = $('<div style="display:block; margin-left:0px;" id="campiPrioritari"></div>');
    //     var div2 = $('<div style="display:none; margin-top: 10px; margin-left:0px;" id="altriCampi"></div>');
    //     $("#campiRecord").empty();
    //     $("#campiRecord").append(divClone);
    //     $("#record0").append(div1);
    //     //creaiamo un pulsante per mostrare gli altri campi
    //     var button = $('<button style="width: 100%; margin-top: 10px;">Mostra altri campi</button>');
    //     button.click(function () {
    //         if ($("#altriCampi").css("display") === "none") {
    //             $(this).text("Nascondi altri campi");
    //             $("#altriCampi").show();
    //         } else {
    //             $(this).text("Mostra altri campi");
    //             $("#altriCampi").hide();
    //         }
    //     });

    //     $("#record0").append(button);
    //     $("#record0").append(div2);

    //     //creiamo il pulsante clona che se premuto chiama la funzione clonaRecord passando il codice gruppo salvato come attr nel pulsante
    //     var clonaButton = $('<button style="width: 100%; margin-top: 10px;">Clona record</button>');
    //     clonaButton.click(function () {
    //         clonaRecord($(this).attr("codiceGruppo"));
    //     });
    //     clonaButton.attr("codiceGruppo", record[0]["Referenza.Codice"]);
    //     $("#campiRecord").append(clonaButton);


    //     //questo è il caso sia un singolo record, per ogni chiave in records[0] seguiamo i seguenti passaggi:
    //     //se la chiave è in listCampiNonEditabili allora la saltiamo
    //     //se la chiave è in listCampiEditabiliPrioritari allora la inseriamo in campiPrioritari con una label uguale alla chiave e: se è una stringa un textArea con il valore uguale alla stringa, se è un numero un input text con il valore uguale al numero, se è un booleano un checkbox con il valore uguale al booleano
    //     //se la chiave non è in nessuna delle due liste la inseriamo in altriCampi con una label uguale alla chiave e: se è una stringa un textArea con il valore uguale alla stringa, se è un numero un input text con il valore uguale al numero, se è un booleano un checkbox con il valore uguale al booleano
    //     for (var key in record[0]) {
    //         if (listCampiNonEditabili.includes(key)) {
    //             continue;
    //         }
    //         if (listCampiEditabiliPrioritari.includes(key)) {
    //             var div = $('<div style="display:block; width:100%;"></div>');
    //             var label = $('<label style="width: 30%; color: white;">' + key + '</label>');
    //             div.append(label);
    //             var value = record[0][key];
    //             if (typeof value == "string") {
    //                 var textArea = $('<textarea class="hideble" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">' + value + '</textarea>');
    //                 div.append(textArea);
    //             }
    //             else if (typeof value == "number") {
    //                 var input = $('<input type="text" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">');
    //                 div.append(input);
    //             }
    //             else if (typeof value == "boolean") {
    //                 var checkbox = $('<input type="checkbox" style="width: 70%;" ' + (value ? 'checked' : '') + 'key="' + key + '">');
    //                 div.append(checkbox);
    //             }
    //             div1.append(div);
    //         }
    //         else {
    //             var div = $('<div style="display:block; width:100%;"></div>');
    //             var label = $('<label style="width: 30%; color: white;">' + key + '</label>');
    //             div.append(label);
    //             var value = record[0][key];
    //             if (typeof value == "string") {
    //                 var textArea = $('<textarea class="hideble" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">' + value + '</textarea>');
    //                 div.append(textArea);
    //             }
    //             else if (typeof value == "number") {
    //                 var input = $('<input type="text" style="width: 70%; color: white;" value="' + value + '" key="' + key + '">');
    //                 div.append(input);
    //             }
    //             else if (typeof value == "boolean") {
    //                 var checkbox = $('<input type="checkbox" style="width: 70%;" ' + (value ? 'checked' : '') + 'key="' + key + '">');
    //                 div.append(checkbox);
    //             }
    //             div2.append(div);
    //         }
    //     }
    // }
    else {
        messaggioUtente("Code IDX-118 Nessun record trovato", "error");
        return;
    }


}

/// Chiude la tendina di scelta tracciato e svuota i campi: riporta la clonazione al punto di
/// partenza.
function resetEditTracciato() {
    $("#tendinaEditTracciato").hide();
    $("#campiRecord").empty();
}

/// Porta una referenza da un altro tracciato in quello in lavorazione, coi valori che
/// l'operatore ha eventualmente corretto.
///
/// I valori si rileggono dal DOM al momento dell'invio, non da una copia in memoria: per
/// ogni blocco .recordClonazione si raccolgono textarea, input di testo e caselle di
/// spunta, e la chiave di ogni campo e' l'attributo key del controllo.
///
/// A clonazione riuscita il tracciato si riscarica da capo: dopo una clonazione quello che
/// si ha in locale e' vecchio.
function clonaRecord(recordGruppo) {
    //leggiamo tutte le textarea e input e checkbox all'interno di ogni div con classe recordClonazione e salviamo i valori in una lista di oggetti, dove ogni oggetto ha come chiavi il valore dell'attributo key e come valore il valore del campo oltre al codice ricavato dal div stesso
    var records = [];
    $(".recordClonazione").each(function () {
        var record = {};
        record["Referenza.Codice"] = $(this).attr("codice");
        record["Scatto.CodiceGruppo"] = recordGruppo;
        $(this).find("textarea").each(function () {
            record[$(this).attr("key")] = $(this).val();
        });
        $(this).find("input[type='text']").each(function () {
            record[$(this).attr("key")] = $(this).val();
        });
        $(this).find("input[type='checkbox']").each(function () {
            record[$(this).attr("key")] = $(this).is(":checked");
        });
        //aggiungiamo il tracciato della tendina
        record["idTracciato"] = parseInt($("#tendinaEditTracciato").find("sp-menu").val());
        records.push(record);
    });
    console.log(records);

    if (records.length == 0 || records == null || records[0]["Scatto.CodiceGruppo"] == null || records[0]["Scatto.CodiceGruppo"] == "") {
        messaggioUtente("Code IDX-119 ClonaRecord: Errore durante la lettura dei dati per la clonazione", "error");
        return;
    }

    //mandiamo la richiesta xhr per clonare il record
    var xhr = new XMLHttpRequestClient();
    xhr.onload = (objResult, parsed) => {
        try {
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                    console.log(objResult);
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code IDX-120 ClonaRecord: Errore durante il parsing della risposta:" + e, "error");
                }
            }
            //mi dovrebbe tornare un oggetto con due parametri, esito, error se l'operazione è fallita
            if (objResult.esito != null && !objResult.esito) {
                messaggioUtente("Code IDX-121 ClonaRecord: Errore durante la clonazione su server: " + objResult.error, "error");
                return;
            }

            if (objResult.error != null && objResult.error != "") {
                messaggioUtente("Code IDX-122 ClonaRecord: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning", false, 0, true);
            }

            //riscarichiamo il tracciato
            //scaricaTracciato();
            scaricaContenutoKit(idKitLavorazione);
            resetEditTracciato();
            messaggioUtente("Code IDX-123 ClonaRecord: Operazione completata con successo, procedo a riscaricare il tracciato aggiornato, l'operazione potrebbe richiedere un po' di tempo", "success", false, 5);
            //openTab(null, "Tab7");
        }
        catch (e) {
            messaggioUtente("Code IDX-124 ClonaRecord Errore generico: " + e, "error");
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
            } else {
            }
        }
    }

    xhr.onerror = function () {
        messaggioUtente("Code IDX-125 ClonaRecord: Errore di rete", "error");
    };

    var req = {
        obj: JSON.stringify(records),
    };
    req = JSON.stringify(req);

    var idTracciato = parseInt($("#idTracciato").val());
    // xhr.open("PUT", (testMode ? "http://192.168.178.191:5076/Menabo/ClonaRecord/" : "http://192.168.178.172/doc/Menabo/ClonaRecord/") + idTracciato);
    // xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    console.log(req);
    // let encodedStr = encodeURIComponent(req);
    // console.log(encodedStr);

    //xhr.send("req=" + encodedStr);
    var formData = new FormData();
    formData.append("req", req);
    xhr.send("Menabo/ClonaRecord/" + idTracciato, formData, "PUT");
}
//#endregion
/// Apre la finestra di svuotamento, gia' impostata su una delle due modalita': per
/// intervallo di pagine (0) o su tutto (1).
///
/// L'intervallo si propone gia' compilato con la pagina su cui sta l'operatore: e' quasi
/// sempre quella che vuole svuotare.
function apriModalSvuotamento(mode) {
    //in entrambe le modalità apriamo il modal dialogSvuotaPagina
    Modali.apriModal("dialogSvuotaPagina", "Svuota impaginato");

    if(mode == "0"){
        Menu.setPickerValue($("#svuotaImpaginazioneMode"), "0");
        $("#pagineRangeSvuotatura").show();
    }
    else if (mode == "1") {
        Menu.setPickerValue($("#svuotaImpaginazioneMode"), "1");
        $("#pagineRangeSvuotatura").hide();
    }
    //uguale alla pagina attualmente selezionata
    $("#pagineRangeSvuotatura").val(pagSelected);

}

/// Apre la finestra dei bolli, che serve sia ad attivarli che a disattivarli: cambia solo il
/// testo del pulsante e il suo attributo attiva.
///
/// Un'unica finestra per due operazioni opposte, ed e' l'attributo a portare avanti quale
/// delle due si e' scelta.
function apriModalBolli(mode) {
    if( mode != "0" && mode != "1") {
        messaggioUtente("Code IDX-126 Modalità di attivazione/disattivazione non valida", "error");
        return;
    }

    //in entrambe le modalità apriamo il modal dialogSvuotaPagina
    Modali.apriModal("dialogAttivaDisattivaBolli", (mode=="0" ? "Disattiva" : "Attiva") + " bolli");

    //uguale alla pagina attualmente selezionata
    $("#pagineRangeAttivaDisattivaBolli").val(pagSelected);

    //cambiamo il testo del bottone in base alla modalità
    if (mode == "0") {
        $("#bottoneAttivaDisattivaBolli").text("Disattiva bolli");
        $("#bottoneAttivaDisattivaBolli").attr("attiva", "false");
    } else if (mode == "1") {
        $("#bottoneAttivaDisattivaBolli").text("Attiva bolli");
        $("#bottoneAttivaDisattivaBolli").attr("attiva", "true");
    }
}

/// Accende o spegne i bolli sulle pagine scelte: su un intervallo, o su tutto il documento.
function selectionAttivaDisattivaBolli(mode, attiva){
    attiva = (attiva == "true" || attiva == true);
    console.log((attiva ? "Attivazione" : "Disattivazione") + " bolli in corso, modalità: " + mode);

    var pages = null;
    if(mode == "1"){
        //attiviamo o disattiviamo tutti i bolli, un bollo è un oggetto contenuto in una referenza in pagina.
        //si riconosce perchè la label inizia con foto_extra e facendo lo split by $, il terzo parametro [2] è uguale a "tipo_2"
        pages = docInLavorazione.pages.everyItem().getElements();        
    }
    else if (mode == "0") {
        //prendiamo solo le pagine selezionate
        var pagineRange = $("#pagineRangeAttivaDisattivaBolli").val();
        var pagineRangeSplit = pagineRange.split(",");
        let pagine = [];
        for (var i = 0; i < pagineRangeSplit.length; i++) {
            var range = pagineRangeSplit[i].split("-");
            if (range.length == 1) {
                var page = parseInt(range[0]);
                if (isNaN(page)) {
                    messaggioUtente("Code IDX-127 Pagina non valida: " + range[0], "Error", false, 5);
                    return;
                }
                pagine.push(page);
            }
            else if (range.length == 2) {
                var startPage = parseInt(range[0]);
                var endPage = parseInt(range[1]);
                if (isNaN(startPage) || isNaN(endPage)) {
                    messaggioUtente("Code IDX-128 Intervallo di pagine non valido: " + range[0] + "-" + range[1], "Error", false, 5);
                    hideLoading();
                    return;
                }
                for (var j = startPage; j <= endPage; j++) {
                    pagine.push(j);
                }
            }
        }

        //prendiamo le pagine corrispondenti
        for (var i = 0; i < pagine.length; i++) {
            //cerchiamo la pagina che si chiama uguale a pagine[i]
            var pageName = pagine[i].toString();
            var page = docInLavorazione.pages.itemByName(pageName);
            if (page.isValid) {
                if (pages == null) {
                    pages = [];
                }
                pages.push(page);
            } else {
                messaggioUtente("Code IDX-129 Pagina " + pageName + " non trovata", "error", false, 5);
                Modali.chiudiModal();
                return;
            }
        }
        
    }
    for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        var groups = page.groups.everyItem().getElements();
        for (var j = 0; j < groups.length; j++) {
            var group = groups[j];
            var items = group.allPageItems;
            for (var k = 0; k < items.length; k++) {
                var item = items[k];
                if (item.label && item.label.startsWith("foto_extra")) {
                    //controlliamo se il label contiene $ e se sì lo split e prendiamo il terzo parametro [2]
                    var labelParts = item.label.split("$");
                    if (labelParts.length > 2 && labelParts[2] == "tipo_2") {
                        //è un bollo, lo attiviamo o disattiviamo
                        attivaDisattivaBollo(item, attiva);
                        console.log("Bollo " + item.label + " " + (attiva ? "attivato" : "disattivato"));
                    }
                }
            }
        }
    }

    messaggioUtente((attiva ? "Attivazione" : "Disattivazione") + " bolli completata", "success", false, 3);
    Modali.chiudiModal();
}

/// Accende o spegne un singolo bollo. E' il gesto elementare che
/// selectionAttivaDisattivaBolli ripete su tutti quelli che trova.
function attivaDisattivaBollo(bollo, attiva) {
    //rendiamo visibile o invisibile il bollo
    if(bollo != null && bollo.isValid){
        if (attiva) {
            bollo.visible = true;
        } else {
            bollo.visible = false;
        }
    }

}

/// Esegue lo svuotamento scelto nella finestra: le pagine di un intervallo, una per una, o
/// tutto il documento.
///
/// Ogni pagina passa da svuotaPaginaByPageName, quindi ognuna avvisa il server prima di
/// toccare il documento: se il server rifiuta a meta' elenco, le pagine gia' fatte restano
/// fatte e le altre no, ma server e impaginato restano d'accordo su entrambe.
async function selectionModalSvuota(mode){
    showLoading("Svuotamento in corso, l'operazione potrebbe richiedere un po' di tempo...");
    if(mode == "1"){
        svuotaMenabo();
    }
    else if (mode == "0"){
        var pagineRange = $("#pagineRangeSvuotatura").val();
        var pagineRangeSplit = pagineRange.split(",");
        let pagine = [];
        for (var i = 0; i < pagineRangeSplit.length; i++) {
            var range = pagineRangeSplit[i].split("-");
            if (range.length == 1) {
                var page = parseInt(range[0]);
                if (isNaN(page)) {
                    messaggioUtente("Code IDX-127 Pagina non valida: " + range[0], "Error", false, 5);
                    hideLoading();
                    return;
                }
                pagine.push(page);
            }
            else if (range.length == 2) {
                var startPage = parseInt(range[0]);
                var endPage = parseInt(range[1]);
                if (isNaN(startPage) || isNaN(endPage)) {
                    messaggioUtente("Code IDX-128 Intervallo di pagine non valido: " + range[0] + "-" + range[1], "Error", false, 5);
                    hideLoading();
                    return;
                }
                for (var j = startPage; j <= endPage; j++) {
                    pagine.push(j);
                }
            }
        }

        Modali.chiudiModal();


        var preAnalisi = await ReportIntegrita.preAnalisiMismatchNumeriPagina(pagineRange);

        if(preAnalisi == null || preAnalisi.esito == false){
            if (preAnalisi == null) {
                messaggioUtente("Code IDX-130 Errore durante l'analisi delle pagine: risposta nulla", "error");
            } else {
                messaggioUtente("Code IDX-130 Errore durante l'analisi delle pagine: " + preAnalisi.error, "error");
            }

            hideLoading()

            if (Modali.confirm("Errore durante l'analisi delle pagine, le pagine non sono state sincronizzate, vuoi comunque procedere con lo svuotamento?")) {
                showLoading("Svuotamento in corso, l'operazione potrebbe richiedere un po' di tempo...");
                for (const page of pagine) {
                    await svuotaPaginaByPageName(page);
                }

                messaggioUtente("Svuotamento completato", "success", false, 3);
            }
            hideLoading();
            return;
        }

        //la preanalisi ha questa struttura (un esempio):
        // errors: []
        // esito: true
        // resultPaginas: [{
            // codiciCorrispondentiConId: [{ codice: "5329719,5365965,5365999,5633416,6344292,6927108,6927146", idRec: 123 }]
            // codiciImpaginatiAPaginaDifferenteConId: [{ codice: "6593680", idRec: 456 }]
            // codiciNonImpaginatiSulServerConId: [{ codice: "6096504", idRec: 789 }]
            // codiciPresentiSoloSulServerConId: [{ codice: "2617525", idRec: 321 }]
            // nomePagina: "1"]}

        //per ogni pagina dobbiamo decidere se fare il sync o meno, tale sync potrebbe anche richiedere una mappa generale dell'impaginato
        //per decidere ci basiamo sulle seguenti cose
        //se per tutte le pagine solo la lista codiciCorrispondentiConId ha elementi allora non serve ne sync ne mappa
        //se anche solo una pagina ha elementi in codiciImpaginatiAPaginaDifferenteConId serve il sync
        //se anche solo una pagina ha elementi in codiciNonImpaginatiSulServerConId non servono interventi
        //se anche solo una pagina ha elementi in codiciPresentiSoloSulServerConId serve la mappa e il sync
        //chiaramente applichiamo la regola che richiede più cose

        function normalizeCodiciConId(list) {
            if (!Array.isArray(list)) {
                return [];
            }

            var result = [];
            for (var idx = 0; idx < list.length; idx++) {
                var item = list[idx];
                if (item == null) {
                    continue;
                }

                var codice = "";
                var idRec = 0;

                if (typeof item === "string" || typeof item === "number") {
                    codice = item.toString();
                }
                else {
                    codice = item.codice != null ? item.codice.toString() : "";
                    idRec = item.idRec != null && !isNaN(parseInt(item.idRec)) ? parseInt(item.idRec) : 0;
                }

                if (codice !== "") {
                    result.push({ codice: codice, idRec: idRec });
                }
            }

            return result;
        }

        var serveSync = false;
        var serveMappa = false;
        for(var i=0; i<preAnalisi.resultPaginas.length; i++){
            var pagina = preAnalisi.resultPaginas[i];

            var codiciImpaginatiAPaginaDifferenteConId = normalizeCodiciConId(pagina.codiciImpaginatiAPaginaDifferenteConId);
            var codiciPresentiSoloSulServerConId = normalizeCodiciConId(pagina.codiciPresentiSoloSulServerConId);

            if(codiciImpaginatiAPaginaDifferenteConId.length > 0){
                serveSync = true;
            }
            if(codiciPresentiSoloSulServerConId.length > 0){
                serveMappa = true;
                serveSync = true;
            }
        }
        var mappa = null;
        if(serveMappa){
            mappa = await confronti.mappaturaImpaginato(pagineRange, false, true);
        }

        if(serveSync){
            await ReportIntegrita.syncImpaginatoConServer(mappa, preAnalisi);
        }


        for (const page of pagine) {
            await svuotaPaginaByPageName(page);
        }

        messaggioUtente("Svuotamento completato", "success", false, 3);
    }
    else{
        messaggioUtente("Code IDX-131 Modalità di svuotamento non valida", "error");
        hideLoading();
        return;
    }

    hideLoading();
}


/// IMPAGINAZIONE. Svuota l'intero menabo': tutte le referenze escono dall'impaginato.
async function svuotaMenabo() {
    //mandiamo la richiesta xhr per svuotare il tracciato
    var xhr = new XMLHttpRequestClient();
    xhr.onload = async (objResult, parsed) => {
        try {
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                    console.log(objResult);
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code IDX-132 Errore durante il parsing della risposta:" + e, "error");
                }
            }
            //mi dovrebbe tornare un oggetto con due parametri, esito, error se l'operazione è fallita
            if (objResult.esito != null && !objResult.esito) {
                messaggioUtente("Code IDX-133 Errore durante la svuotatura su server: " + objResult.error, "error");
                return;
            }

            if (objResult.error != null && objResult.error != "") {
                messaggioUtente("Code IDX-134 Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning", false, 0, true);
            }

            messaggioUtente("Operazione completata con successo, procedo a svuotare le pagine e a riscaricare il tracciato aggiornato, l'operazione potrebbe richiedere un po' di tempo", "success", false, 5, true);
            //setbusy
            indesignEvents.setBusy(true);
            showLoading("Svuotamento in corso...");
            await Utility.sleep(100);
            try {

                var elementiDaRimuovere = [];
                //cicliamo ogni gruppo di ogni pagina e controlliamo se il grupp contine un elemento con etichetta base, se sì lo eliminiamo
                var nPag = docInLavorazione.pages.length;

                let tipo_lavorazione_corrente = ficoProcess.getTipoLavorazioneCorrente();

                if (tipo_lavorazione_corrente==1)
                    {
                    for (var i = 0; i < docInLavorazione.pages.length; i++) {
                        var page = docInLavorazione.pages.item(i);
                        showLoading("Svuotamento in corso... Pagina " + (i + 1) + " di " + nPag);
                        await Utility.sleep(10);
                        if (tipo_lavorazione_corrente==1)
                        {
                            for (var i2 = 0; i2 < page.groups.length; i2++) {
                                var group = page.groups.item(i2);
                                var dna = Utility.getDnaOfBox(group);
                                if(dna == null){
                                    continue;
                                }
                                elementiDaRimuovere.push(group); // Aggiungi il gruppo all'elenco da rimuovere

                                // Cerca gli oggetti con label che iniziano con "base" all'interno del gruppo
                                // for (var j = 0; j < group.allPageItems.length; j++) {
                                //     var item = group.allPageItems[j];

                                //     // Controlla se l'oggetto ha la label desiderata
                                //     if (item.label && Utility.parseLabel(item.label).startsWith("base")) {
                                //         elementiDaRimuovere.push(group); // Aggiungi il gruppo all'elenco da rimuovere
                                //         break; // Interrompi il ciclo interno una volta trovata la base nel gruppo
                                //     }
                                // }
                            }
                        }
                    }

                    //rimuoviamo gli elementi scorrendo al contrario la lista
                    for (var i = elementiDaRimuovere.length - 1; i >= 0; i--) {
                        lastSelections.splice(lastSelections.indexOf(elementiDaRimuovere[i].id), 1);
                        elementiDaRimuovere[i].remove();
                    }
                }
                else if (tipo_lavorazione_corrente==2)
                {
                    //eliminiamo tutte le pagine tranne la prima
                    for (var i = docInLavorazione.pages.length - 1; i > 0; i--) {
                        showLoading("Eliminazione in corso... Pagina " + (i + 1) + " di " + nPag);
                        await Utility.sleep(10);

                        docInLavorazione.pages.item(i).remove();
                    }

                    //rimuoviamo tutti gli elementi rimasti a pagina 1
                    var page = docInLavorazione.pages.item(0);
                    for (var i = page.groups.length - 1; i >= 0; i--) {
                        var group = page.groups.item(i);
                        group.remove();
                    }

                    //eliminamo ora tutti gli allPAgeItems
                    for (var i = page.allPageItems.length - 1; i >= 0; i--) {
                        var item = page.allPageItems[i];
                        item.remove();
                    }
                }
            }
            catch (e) {
                messaggioUtente("Code IDX-135 Errore generico: " + e, "error");
            }
            finally {
                indesignEvents.setBusy(false);
                hideLoading();
            }
            
        }
        catch (e) {
            messaggioUtente("Code IDX-135 Errore generico: " + e, "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
            } else {
            }
        }
    }

    xhr.onerror = function () {
        messaggioUtente("Code IDX-136 Errore di rete", "error");
    };

    xhr.send("Menabo/svuotaMenabo/" + idKitLavorazione, null, "GET");
}

/// Scrive un messaggio nella console interna del Plugin (#debugLogs), col colore dello
/// stile, l'ora, un pulsante per copiarlo e uno per toglierlo.
///
/// I messaggi identici consecutivi non si ripetono: al primo si aggiunge un contatore fra
/// parentesi e si aggiorna l'ora. Senza, un errore dentro un ciclo riempirebbe la console
/// di mille righe uguali.
///
/// Aggiorna anche il contatore dei non letti e il colore dell'icona della console, che
/// peggiora e non migliora: un warning non cancella un errore gia' segnato in rosso.
///
/// NOTA (I20-1002): il messaggio viene inserito come HTML, e finisce anche dentro
/// l'attributo msg del pulsante di copia. I messaggi contengono testi di eccezione: uno con
/// dentro un apice o un < rompe il markup. Andrebbe messo con .text e .attr.
function writeFileInConsole(logMessage) {
    //logMessage è un oggetto di forma
    // var logMessage = {
    //     data: formatTwoDigits(date.getDate()) + "/" + formatTwoDigits((date.getMonth() + 1)) + "/" + date.getFullYear(),
    //     orario: formatTwoDigits(date.getHours()) + ":" + formatTwoDigits(date.getMinutes()) + ":" + formatTwoDigits(date.getSeconds()),
    //     stile: style,
    //     msg: msg
    // };
    //mentre #debugLogs è la nostra console, questa funzione deve creare un nuovo div del colore dello stile (gli stili ricevuti dovrebbero essere success, warning ed error), in cima scritta in piccolo c'è l'ora, sotto il messaggio, come hidden attr va messo data, ora e stile per poi poter applicare dopo i filtri
    //infine il div deve contenere una piccola x per eliminare il messaggio
    var style = logMessage.stile;
    var msg = logMessage.msg;
    var date = new Date();
    var color = "red";
    if (style == "success") {
        color = "green";
    }
    else if (style == "warning") {
        color = "darkorange";
    }
    var div = $('<div class="logMessage" style="width:100%; background-color: ' + color + '; color: white; margin-left:0px; padding: 5px; margin-top: 5px; display: flex; justify-content: space-between; text-align: left;"></div>');
    var orario = $('<span style="font-size: 10px; margin-right: 10px;">' + logMessage.orario + '</span>');
    var messaggio = $('<span style="flex-grow: 1;">' + msg + '</span>');
    //I20-1033: canale e area della lavorazione, sotto il testo e piu' piccoli. Come testo, non come
    //HTML. Ci sono anche nei log riletti con leggiLog, se il messaggio li aveva.
    if (logMessage.lavorazione) {
        messaggio.append($('<div class="lavorazioneMessaggio" style="font-size: 10px; margin-top: 2px;"></div>').text(logMessage.lavorazione));
    }
    var x = $('<span style="font-size: 10px; cursor: pointer; margin-left:5px;">X</span>');
    var copyButton = $('<img src="images/copyToClipBoard.png" style="height: 10px; margin-left:5px;" msg="' + msg + '">');
    copyButton.msg = msg;
    //I20-1033: chi copia il messaggio si porta dietro anche canale e area.
    if (logMessage.lavorazione) {
        copyButton.attr("msg", msg + " [" + logMessage.lavorazione + "]");
    }

    copyButton.on('click', function () {
        navigator.clipboard.writeText(String($(this).attr("msg") || ""));
        //cambiamo il colore del pulsante per 1 secondo
        $(this).attr("src", "images/check.png");
        setTimeout(function () {
            copyButton.attr("src", "images/copyToClipBoard.png");
        }, 1000);

    });
    x.click(function () {
        $(this).parent().remove();
    });
    div.append(orario);
    div.append(messaggio);
    div.append(x);
    div.append(copyButton);

    // Check if the last message in console is the same as the current message
    var lastMessage = $("#debugLogs .logMessage:first-child span:nth-child(2)").text();
    if ($("#debugLogs .logMessage:first-child span:nth-child(2)").hasClass("count")) {
        lastMessage = $("#debugLogs .logMessage:first-child span:nth-child(3)").text();
    } else {
        lastMessage = $("#debugLogs .logMessage:first-child span:nth-child(2)").text();
    }
    //I20-1033: si confronta tutto il testo, canale e area compresi: lo stesso messaggio da due
    //lavorazioni diverse resta su due righe.
    if (lastMessage === messaggio.text()) {
        // Get the count element of the last message
        var countElement = $("#debugLogs .logMessage:first-child .count");
        if (countElement.length === 0) {
            // If count element doesn't exist, create it
            countElement = $('<span class="count" style="font-size: 10px; margin-right: 10px;"></span>');
            $("#debugLogs .logMessage:first-child").children().eq(1).after(countElement);
        }
        // Increment the count
        var count = parseInt(countElement.text().replace(/\(|\)/g, "")) || 0;
        count++;
        countElement.text("(" + count + ")");
        // Change the text of the time
        $("#debugLogs .logMessage:first-child span:nth-child(1)").text(logMessage.orario);
    } else {
        // If the messages are different, append the new message
        $("#debugLogs").prepend(div);
    }

    //prendiamo ora il counter #counterNonLetti, leggiamo il testo, facciamo il parse e incrementiamo di 1, poi lo scriviamo di nuovo
    var counter = $("#counterNonLetti").text();
    counter = parseInt(counter);
    counter++;
    $("#counterNonLetti").text(counter);
    //adesso guardiamo il colore di background di #consoleIcon, se abbiamo ricevuto un warning è il colore non è rosso allora lo mettiamo a darkorange, se riceviamo error lo mettiamo a red
    if (style == "warning" && $("#consoleIcon").css("background-color") != "red") {
        $("#consoleIcon").css("background-color", "orange");
    }
    else if (style == "error") {
        $("#consoleIcon").css("background-color", "red");
    }
    //$("#debugLogs").prepend(div); 
}

/// Svuota la console interna, azzera il contatore dei non letti e rimette l'icona verde.
function svuotaConsole() {
    $("#debugLogs").empty();
    $("#counterNonLetti").text(0);
    $("#consoleIcon").css("background-color", "green");
}

/// Mostra o nasconde i messaggi della console secondo le tre caselle - errori, warning,
/// info.
///
/// DA VERIFICARE (I20-1002): il filtro riconosce lo stile confrontando
/// .css("background-color") con le parole "red", "darkorange" e "green". Il colore e'
/// scritto con quelle parole nello stile in linea, ma .css legge lo stile CALCOLATO, che di
/// norma restituisce "rgb(255, 0, 0)". Se qui si comporta come altrove, nessun confronto e'
/// mai vero e spuntando un filtro spariscono tutti i messaggi. Non e' stato toccato perche'
/// non lo si puo' provare senza InDesign; lo stile andrebbe comunque letto da un attributo
/// nostro, non dedotto dal colore.
function cambioVisualizzazioneConsole() {
    //leggiamo i tre checkBox logErrori, logWarning e logInfo, nascondiamo tutti i messaggi e poi li mostriamo in base ai checkBox
    var logErrori = $("#logErrori").is(":checked");
    var logWarning = $("#logWarning").is(":checked");
    var logInfo = $("#logInfo").is(":checked");
    var logMessages = $("#debugLogs .logMessage");
    logMessages.hide();
    for (var i = 0; i < logMessages.length; i++) {
        var logMessage = logMessages.eq(i);
        var stile = logMessage.css("background-color");
        if (logErrori && stile == "red") {
            logMessage.show();
        }
        else if (logWarning && stile == "darkorange") {
            logMessage.show();
        }
        else if (logInfo && stile == "green") {
            logMessage.show();
        }
    }
}

/// Apre un file di log salvato e lo rimette nella console, riga per riga.
///
/// Serve a guardare cosa e' successo in una sessione precedente, o sulla macchina di
/// qualcun altro: il file dei log e' l'unica cosa che sopravvive alla chiusura del Plugin.
async function leggiLog() {
    var file = await fs2.getFileForOpening();
    if (file != null) {
        if (file.name.endsWith('.txt')) {
            // Read the file and perform operations
            const contents = await file.read();
            console.log(contents);
            //in contents se abbiamo selezionato il file giusto ci ritroviamo una struttura tipo questa 
            //[{"data":"12/06/2024","orario":"17:23:47","stile":"success","msg":"Richiesta scaricamento tracciato inviata"},{"data":"12/06/2024","orario":"17:23:57","stile":"success","msg":"scaricaTracciato: Tracciato scaricato con successo"},...]
            //noi dobbiamo leggerla e per ogni elemento chiamare writeFileInConsole
            try {
                var logMessages = JSON.parse(contents);
                for (var i = 0; i < logMessages.length; i++) {
                    writeFileInConsole(logMessages[i]);
                }
            } catch (e) {
                messaggioUtente("Code IDX-137 Errore durante il parsing del file: " + e, "error");
            }
        } else {
            messaggioUtente("Code IDX-138 Il file selezionato non è un file di testo.", "error");
        }
    } else {
        messaggioUtente("Code IDX-139 Errore durante la selezione del file.", "error");
    }
}

var currentTimeoutIdLogin = null;
/// Manda credenziali al server e, se vanno bene, fa ripartire il controllo di stato che
/// porta il Plugin in lavorazione.
///
/// I messaggi di errore non passano da messaggioUtente ma vengono scritti direttamente
/// sopra il pannello di accesso: quando si e' fermi al login, il contenitore dei messaggi
/// della schermata principale non e' in vista.
///
/// I20-956: si ricorda solo se l'operatore lo ha chiesto, e si dimentica appena toglie la
/// spunta, altrimenti la scelta precedente resterebbe viva.
///
/// onNoConnection e' un caso a parte: senza rete non si fallisce, si entra in modalita'
/// agenzia e si avvisa che al ritorno della rete andra' fatto l'accesso per sincronizzare.
///
/// DA SPOSTARE (task di divisione): con showLogin, logout e setFinestrePerRuolo in un js
/// dell'accesso.
async function login(username, password, ricordami = false){

    //cambiamo il testo del pulsante in un ciclo di "Connessione", "Connessione.","Connessione..","Connessione...","Connessione"
    var pulsante = $("#loginText");

    //facciamo la chiamata xhr per settare la sessione
    var xhr = new XMLHttpRequestClient();

    xhr.onload = async (objResult, parsed) => {
        try {
            try {
                // if (!parsed) {
                //     try{
                //         objResult = JSON.parse(objResult);
                //     }
                //     catch(e){
                //         messaggioUtente("Errore durante il parsing della risposta:" + objResult, "error");
                //         return;
                //     }
                // }
                console.log("RESULT login");
                console.log(objResult);

                //se l'esito è true allora:
                //creiamo una schermata con scritto Benvenuto username che appare sopra a tutto (z-index 2000) e la appendiamo
                //nascondiamo la schermata di login (loginPanel hide) e mettiamo gli input di testo #username e password a ""
                //dopo 0.5 sec iniziamo la dissolvenza della schermata di benvenuto che in 1 secondo sparisce completamente e poi viene rimossa

                pulsante.text("Login");
                hideLoading();
                if (objResult.esito) {
                    console.log("Login avvenuto con successo");

                    //I20-956: si ricorda solo se l'operatore lo ha chiesto, e si dimentica
                    //appena toglie la spunta, altrimenti la scelta precedente resterebbe viva.
                    if (ricordami) {
                        await credenzialiSalvate.salva(username, password);
                    }
                    else {
                        await credenzialiSalvate.dimentica();
                    }

                    indesignEvents.checkStatus(indesignEvents.checkStatusResonse);
                }
                else {
                    console.log("Login fallito");

                    $("#messaggioUtenteLoginComposto").remove();
                    var color = "red";
                    var html = '<div class="row" id="messaggioUtenteLogin" style="background-color: ' + color + '; width:90%; display: flex; padding:2px; z-index:9999; position:fixed; margin-top: 5%; align-self: self-start;"> <div class="col" style="color: white; padding-left: 10px; font-size:10px; width:90%;"><h4 style="margin: 0; display: flex; align-items: center;width: 100%;">' + objResult.error + '</h4></div>';
                    //mettiamo il messaggio in cima a tutto
                    $("#loginPanel").prepend(html);
                    //aggiungiamo un pulsante per chiudere il messaggio
                    var closeButton = $('<button style="color: black; margin-left: 10px;">X</button>')
                    closeButton.click(function () {
                        $(this).parent().remove();
                    });
                    $("#messaggioUtenteLogin").append(closeButton);
                    $("#messaggioUtenteLogin").attr("id", "messaggioUtenteLoginComposto");
                }
            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code IDX-140 Errore durante il parsing della risposta:" + e, "error");
            }
        }
        catch (e) {
            messaggioUtente("Code IDX-141 Errore generico: " + e, "error");
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
            } else {
            }
        }
    }

    xhr.onerror = function (err) {
        $("#messaggioUtenteLoginComposto").remove();
        var color = "red";
        var html = '<div class="row" id="messaggioUtenteLogin" style="background-color: ' + color + '; width:90%; display: flex; padding:2px; z-index:9999; position:fixed; margin-top: 5%; align-self: self-start;"> <div class="col" style="color: white; padding-left: 10px; font-size:10px; width:90%;"><h4 style="margin: 0; display: flex; align-items: center;width: 100%;">' + err + '</h4></div>';
        //mettiamo il messaggio in cima a tutto
        $("#loginPanel").prepend(html);
        //aggiungiamo un pulsante per chiudere il messaggio
        var closeButton = $('<button style="color: black; margin-left: 10px;">X</button>')
        closeButton.click(function () {
            $(this).parent().remove();
        });
        $("#messaggioUtenteLogin").append(closeButton);
        $("#messaggioUtenteLogin").attr("id", "messaggioUtenteLoginComposto");
        console.log(err);
        hideLoading();

    };

    xhr.onNoConnection = async function () {
        messaggioUtente("Code IDX-142 Impossibile effettuare il login per problemi di rete, l'utente è stato attivato in modalità agenzia, fare il login al ritorno della rete per poter sincronizzare le modifiche", "warning");
    };

    //creiamo la req composta da username e password
    var formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    formData.append("fromPlugin", true);

    showLoading("Login in corso...");

    xhr.send("LoginController/login", formData , "POST");
}

/// Trova i quattro percorsi di sistema - Links, Loghi, Logs, Esportazione - e, se ne manca
/// uno, apre la finestra che chiede all'operatore di indicarli. Restituisce true solo
/// quando ci sono tutti.
///
/// Tre tentativi in ordine, per ognuno:
///   1. quello scritto in lavorazioni.json, ma solo se la cartella esiste davvero: un
///      percorso registrato e poi spostato varrebbe come assente;
///   2. la cartella prevista sotto la lavorazione (defaultPercorso...), che se c'e' viene
///      anche registrata;
///   3. niente, e allora si chiede.
///
/// scope serve a chiedere solo una parte: linksLoghi sono i percorsi delle immagini,
/// sistema quelli di log ed esportazione. La finestra pero' e' sempre la stessa e li mostra
/// tutti e quattro.
///
/// Col libro aperto e nessun documento, i percorsi si cercano a partire dal primo file del
/// libro: sono gli stessi per tutti.
///
/// DA SPOSTARE (task di divisione): questa e impostaPercorsiDiSistema sono i percorsi di
/// lavoro, un concetto a se'. Starebbero in un js loro.
async function checkPercorsi(forceOpenModal = false, scope = 'entrambi') {
    
    let _pathLavorazione = pathLavorazione;
    let docName = docInLavorazione!=null?docInLavorazione.name:"";
    // if (forceOptions != null) {
    //     _pathLavorazione = forceOptions.pathLavorazione || _pathLavorazione;
    //     docName = forceOptions.docName || docName;
    // }

    if (_pathLavorazione == "" || docName == "") {
        if (libroInLavorazione!=null)
        {
            let file_path =  await libroInLavorazione.filePath;
            _pathLavorazione = file_path.nativePath;
            let firstFileName = libroInLavorazione.bookContents.item(0).name;
            docName = firstFileName;
        }
    }

    const filePath = _pathLavorazione + "/lavorazioni.json";

    var lavorazioni = readFile(filePath);
    var file = lavorazioni?.find(f => f.file == docName);

    if (!file) {
        messaggioUtente("Code IDX-143 File lavorazioni.json non trovato", "error");
        return false;
    }
    var percorsoLinksNullo = false;
    var percorsoLoghiNullo = false;
    var percorsoLogsNullo = false;
    var percorsoEsportazioneNullo = false;

    // --- Imposta variabili globali se valorizzate nel JSON ---
    if (file.pathLinks != null && file.pathLinks !== "") {
        try {
            //proviamo a cercare la cartella per vedere se esiste davvero
            const folder = await fs2.getEntryWithUrl("file://" + /*_pathLavorazione +*/ file.pathLinks);
            percorsoLinks = file.pathLinks;
        }
        catch (e) {
            percorsoLinksNullo = true;
        }
    }
    else {
        percorsoLinksNullo = true;
    }

    if (file.pathLoghi != null && file.pathLoghi !== "") {
        try {
            //proviamo a cercare la cartella per vedere se esiste davvero
            const folder = await fs2.getEntryWithUrl("file://" + /*_pathLavorazione +*/ file.pathLoghi);
            percorsoLoghi = file.pathLoghi;
        }
        catch (e) {
            percorsoLoghiNullo = true;
        }
    }
    else {
        percorsoLoghiNullo = true;
    }

    if (file.pathLogs != null && file.pathLogs !== "") {
        try {
            //proviamo a cercare la cartella per vedere se esiste davvero
            const folder = await fs2.getEntryWithUrl("file://" + /*_pathLavorazione +*/ file.pathLogs);
            percorsoLogs = file.pathLogs;
        }
        catch (e) {
            percorsoLogsNullo = true;
        }
    }
    else {
        percorsoLogsNullo = true;
    }

    if (file.pathEsportazione != null && file.pathEsportazione !== "") {
        try {
            //proviamo a cercare la cartella per vedere se esiste davvero
            const folder = await fs2.getEntryWithUrl("file://" + /*_pathLavorazione +*/ file.pathEsportazione);
            percorsoEsportazione = file.pathEsportazione;
        }
        catch (e) {            
            percorsoEsportazioneNullo = true;
        }
    }
    else {
        percorsoEsportazioneNullo = true;
    }

    //stampiamo i 4 path in console
    console.log("Percorso Links: " + percorsoLinks);
    console.log("Percorso Loghi: " + percorsoLoghi);
    console.log("Percorso Logs: " + percorsoLogs);
    console.log("Percorso Esportazione: " + percorsoEsportazione);

    //per ogni percorso rimasto nullo cerchiamo se è presente la cartella di default ovvero quella il cui percorso è
    //pathLavorazione + percorsoLoghi ecc ecc
    if (percorsoLinksNullo) {
        //controlliamo se esiste la cartella pathLavorazione + percorsoLinks
        try {
            const folder = await fs2.getEntryWithUrl("file://" + _pathLavorazione + defaultPercorsoLinks);
            impostaPercorsiDiSistema(0, _pathLavorazione + defaultPercorsoLinks);
        }
        catch (e) {
            percorsoLinks = "";
            forceOpenModal = true;

        }
    }
    if (percorsoLoghiNullo) {
        try {
            const folder = await fs2.getEntryWithUrl("file://" + _pathLavorazione + defaultPercorsoLoghi);
            impostaPercorsiDiSistema(1, _pathLavorazione + defaultPercorsoLoghi);
        }
        catch (e) {
            percorsoLoghi = "";
            forceOpenModal = true;

        }
    }
    if (percorsoLogsNullo) {
        try {
            const folder = await fs2.getEntryWithUrl("file://" + _pathLavorazione + defaultPercorsoLogs);
            impostaPercorsiDiSistema(2, _pathLavorazione + defaultPercorsoLogs);
        }
        catch (e) {
            percorsoLogs = "";
            forceOpenModal = true;

        }
    }
    if (percorsoEsportazioneNullo) {
        try {
            const folder = await fs2.getEntryWithUrl("file://" + _pathLavorazione + defaultPercorsoEsportazione);
            impostaPercorsiDiSistema(3, _pathLavorazione + defaultPercorsoEsportazione);
        }
        catch (e) {
            percorsoEsportazione = "";
            forceOpenModal = true;
        }
    }

    var lavorazioni = readFile(filePath);
    var file = lavorazioni?.find(f => f.file == docName);

    // --- Definisce i campi richiesti in base allo scope ---
    const requirementsByScope = {
        linksLoghi: [
            { key: 'pathLinks', value: percorsoLinks },
            { key: 'pathLoghi', value: percorsoLoghi },
        ],
        sistema: [
            { key: 'pathLogs', value: percorsoLogs },
            { key: 'pathEsportazione', value: percorsoEsportazione },
        ],
        entrambi: [
            { key: 'pathLinks', value: percorsoLinks },
            { key: 'pathLoghi', value: percorsoLoghi },
            { key: 'pathLogs', value: percorsoLogs },
            { key: 'pathEsportazione', value: percorsoEsportazione },
        ],
    };

    const required = requirementsByScope[scope] || requirementsByScope.entrambi;

    // --- Verifica mancanti ---
    const missing = required.filter(r => r.value == null || r.value === "");
    if (missing.length > 0 || forceOpenModal) {
        
        console.log("apro il dialog!");

        // Apri SEMPRE lo stesso dialog anche per links/loghi
        if ($("#overlayModal").css("display") == "none" &&
            $("#overlayModal").find("#dialogPathDiSistema").length == 0) {
            Modali.apriModal(
                "dialogPathDiSistema",
                "Seleziona i percorsi di sistema (links, loghi, logs, esportazione)",
                false,
                [],
                true
            );

            //impostiamo i valori dei path già presenti
            $("#pathFoto").val(percorsoLinks);
            $("#pathFoto").text(percorsoLinks);
            $("#pathLoghi").val(percorsoLoghi);
            $("#pathLoghi").text(percorsoLoghi);
            $("#pathLogs").val(percorsoLogs);
            $("#pathLogs").text(percorsoLogs);
            $("#pathEsportazione").val(percorsoEsportazione);
            $("#pathEsportazione").text(percorsoEsportazione);

            //Il pulsante di conferma compare solo quando tutti e quattro i percorsi ci sono.
            //I20-1002: qui la condizione aveva in coda "|| forceOptions != null", ma
            //forceOptions era un parametro rimosso - restano le tre righe commentate in
            //cima alla funzione. Era un identificatore inesistente, quindi ReferenceError
            //ogni volta che mancava un percorso, cioe' proprio nel caso per cui questo
            //ramo esiste. Nessun chiamante ha mai passato forceOptions, percio' quel
            //confronto valeva false anche prima: toglierlo non cambia il comportamento.
            if (percorsoLinks && percorsoLoghi && percorsoLogs && percorsoEsportazione) {
                $("#confermaPercorsi").show();
            }
        }

        console.log("...alive...");

        return false;
    }
    console.log("...t'apposto!");

    return true;
}

/// Chiude la sessione sul server, dimentica le credenziali salvate e riporta al modulo di
/// accesso.
async function logout(){
    showLoading("Logout in corso...");
    //facciamo la chiamata xhr per settare la sessione
    var xhr = new XMLHttpRequestClient();
    xhr.onload = async (objResult, parsed) => {
        try {
            try {
                if (!parsed) {
                    try{
                        objResult = JSON.parse(objResult);
                    }
                    catch(e){
                        messaggioUtente("Code IDX-144 Errore durante il parsing della risposta:" + e, "error");
                        return;
                    }
                }
                console.log(objResult);

                if(objResult.esito){
                    Modali.closeAllModal();
                    $("#mainContent").hide();
                    indesignEvents.logout();
                    nomeUtente = "";
                    idUtente = 0;
                    cambiStrutturaliJs.cambiStrutturaliDB = [];

                    //I20-956: uscire deve uscire davvero. Le credenziali ricordate si
                    //dimenticano, cosi' il form che ricompare e' vuoto.
                    await credenzialiSalvate.dimentica();
                    $("#username").val("");
                    $("#password").val("");
                    $("#ricordami").prop("checked", false);

                    hideLoading();
                    showLogin();

                }
                else{
                    messaggioUtente("Code IDX-145 Errore durante il logout: " + objResult.error, "error");
                }
            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code IDX-144 Errore generico durante il logout: " + e, "error");
            }
            finally {
                hideLoading();
            }
        }
        catch (e) {
            messaggioUtente("Code IDX-144 Errore generico durante il logout: " + e, "error");
        }
    }

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
            } else {
                hideLoading();
            }
        }
    }

    xhr.onerror = function () {
        messaggioUtente("Code IDX-146 Errore di rete", "error");
        hideLoading();
    };

    xhr.send("LoginController/logout", null, "GET");
                        
}

/// Ricalcola a mano le altezze dei pannelli quando la finestra cambia dimensione.
///
/// Si fa in JavaScript e non in CSS perche' le altezze dipendono da quelle di intestazione
/// e barra in basso, che cambiano col contenuto. Il setTimeout da' al pannello il tempo di
/// assestarsi: misurare subito dopo un cambio restituisce i valori di prima - vale in UXP
/// come altrove.
function onresizeWindow(){
    try{
        setTimeout(function () {
            lastWidthDimension = document.getElementById("wrapper").clientWidth;
            lastHeightDimension = document.getElementById("wrapper").clientHeight;
            footerHeight = document.getElementById("footer").clientHeight;
    
            var altezzaHeader = document.getElementById("spazioHeader").clientHeight;
            var altezzaRes = lastHeightDimension - altezzaHeader - footerHeight;
            $("#contenitoreTab").css("height", "" + altezzaRes + "px");
    
            //resizeRef
    
            var altezzaHeaderRef = document.getElementById("referenza").clientHeight;
            var altezzaFooterRef = document.getElementById("footerRef").clientHeight;
    
            //l'altezza di Tab5, Tab6, Tab7, Tab8 diventa quella di contenitoreTab - altezzaHeaderRef - altezzaFooterRef
            var altezzaResRef = altezzaRes - altezzaHeaderRef - altezzaFooterRef - 25;
            console.log("Altezza: " + altezzaResRef);
            $("#Tab5").css("height", "" + (altezzaResRef) + "px");
            $("#Tab6").css("height", "" + altezzaResRef + "px");
            $("#Tab7").css("height", "" + altezzaResRef + "px");
            $("#Tab8").css("height", "" + altezzaResRef + "px");
            $("#bloccoTracciatoNonScaricato").css("height", "" + altezzaResRef + "px");
            $("#bloccoTracciatoNonScaricato").css("height", "" + altezzaResRef + "px");

    
            altezzaResRef = altezzaRes - 25;
            let altezzaHeaderFiltri = $("#comandiInterfacciaAdvanced").outerHeight();

            let scrollTop = $('#filtriBodyGriglia').length ? $('#filtriBodyGriglia').scrollTop() : 0;
            //I20-1031: sotto la griglia dei filtri c'e' la barra orizzontale. Prima le colonne si
            //ricalcolano sulla larghezza nuova e la barra compare o sparisce, come nella Home; poi
            //l'altezza le lascia posto.
            filtriJs.aggiornaBarraGriglia();
            $("#filtriBodyGriglia").css("height", "" + (altezzaResRef - 10 - altezzaHeaderFiltri - filtriJs.altezzaBarraGriglia()) + "px");
            $('#filtriBodyGriglia').scrollTop(scrollTop);

            onResizeTab1Tracciato();
    
        }, 100);

    }
    catch(e){
        console.log("Errore durante il resize della finestra: " + e);
    }
}

/// Ricalcola l'altezza e la larghezza dell'elenco del tracciato, sottraendo quanto occupano
/// la riga di sincronizzazione e l'area dei filtri.
///
/// Se quei due elementi non ci sono ancora esce senza fare niente: viene chiamata anche
/// mentre il tracciato si sta costruendo.
///
/// La larghezza si prende dallo scrollWidth dell'intestazione, cosi' le righe non vanno mai
/// piu' strette delle colonne.
///
/// I20-1030: per prima cosa da' alla lista (#Tab1Viewport) un'altezza vera, lo spazio che resta
/// libero in #contenitoreTab. Senza, la lista cresceva quanto tutte le righe e la rotella del
/// mouse non la faceva scorrere: in UXP la rotella scorre solo un contenitore che ha un'altezza.
/// Sta prima delle uscite anticipate, perche' vale anche quando quelle escono. Le altezze qui
/// sotto sono per #Tab1Tracciato e #Tab1Container, la lista di prima, oggi commentata in
/// index.html.
function onResizeTab1Tracciato(){
    setTimeout(function () {
        //I20-1035: sotto la lista c'e' la barra orizzontale, e l'altezza le lascia posto. Prima
        //l'altezza, poi la barra - fissare l'altezza puo' far comparire la barra verticale, che
        //stringe la lista - e di nuovo l'altezza, nel caso la barra sia comparsa o sparita.
        var contenitoreTab = document.getElementById("contenitoreTab");
        var listaTracciato = document.getElementById("Tab1Viewport");
        AltezzaScorrimento.fissaAltezza(contenitoreTab, listaTracciato, { margine: AltezzaScorrimento.MARGINE + altezzaBarraScorrimentoTracciato() });
        scorriTracciato(statoBarraTracciato, statoBarraTracciato.spostamento || 0);
        AltezzaScorrimento.fissaAltezza(contenitoreTab, listaTracciato, { margine: AltezzaScorrimento.MARGINE + altezzaBarraScorrimentoTracciato() });

        lastHeightDimension = document.getElementById("wrapper").clientHeight;
        footerHeight = document.getElementById("footer").clientHeight;

        var altezzaHeader = document.getElementById("spazioHeader").clientHeight;
        var altezzaRes = lastHeightDimension - altezzaHeader - footerHeight;

        var dataScaricamentoHeight = document.getElementById("dataScaricamentoTracciato");
        var areaFiltriHeight = document.getElementById("areaFiltri");

        if(!dataScaricamentoHeight || !areaFiltriHeight){
            return;
        }

        var altezzaTabTracciato = altezzaRes
            - dataScaricamentoHeight.clientHeight - parseFloat(getComputedStyle(dataScaricamentoHeight).marginTop) - parseFloat(getComputedStyle(dataScaricamentoHeight).marginBottom)
            - areaFiltriHeight.clientHeight - parseFloat(getComputedStyle(areaFiltriHeight).marginTop) - parseFloat(getComputedStyle(areaFiltriHeight).marginBottom)
            -28;

        $("#Tab1Tracciato").css("height", "" + (altezzaTabTracciato-21) + "px");
        $("#Tab1Container").css("height", "" + (altezzaTabTracciato+20) + "px");

        var Tab1Intestazione = document.getElementById("Tab1Intestazione");

        if(!Tab1Intestazione){
            return;
        }
        var width = Tab1Intestazione.scrollWidth;

        console.log("Width tracciato: " + width);
        $("#Tab1Tracciato").css("width", "" + (width+20) + "px");
        //$("#Tab1Intestazione").css("width", "" + (width) + "px");

    }, 100);
}


/// Registra in lavorazioni.json uno dei quattro percorsi di sistema: 0 Links, 1 Loghi,
/// 2 Logs, 3 Esportazione.
///
/// Col valore passato lo scrive e basta; senza, apre il dialogo di scelta cartella.
/// checkPercorsi la usa nel primo modo quando trova la cartella prevista, l'operatore nel
/// secondo quando gliela si chiede.
async function impostaPercorsiDiSistema(tipo, value = null){

    try{
        writeDebugMessageForCrash("Entrato in impostaPercorsiDiSistema tipo: " + tipo + " value: " + value);
        var percorso = value;
        if(value == null){
            //tipo 0 foto, 1 loghi
            var cartella = await fs2.getFolder();
            if (!cartella) {
                console.log("Cartella non selezionata.");
                return;
            }    
            //se la cartella è valida ne leggiamo il percorso e facciamo il console log del percorso
            var percorso = cartella.nativePath;
        }
    
        let _pathLavorazione = pathLavorazione;
        let docName = docInLavorazione!=null?docInLavorazione.name:"";
        if (_pathLavorazione == "" || docName == "") {
            if (libroInLavorazione!=null)
            {
                let file_path =  await libroInLavorazione.filePath;
                _pathLavorazione = file_path.nativePath;
                let firstFileName = libroInLavorazione.bookContents.item(0).name;
                docName = firstFileName;
            }
        }
    
    
        
        if (percorso) {
    
            console.log("Percorso selezionato: " + percorso);
        
            //controlliamo se il percorso inizia con il pathlavorazione, se sì lo rimuoviamo se no mandiamo un errore a schermo
            // if (!percorso.startsWith(_pathLavorazione)) {
            //     messaggioUtente("Code IDX-147 Il percorso selezionato non è valido, deve essere all'interno della cartella di lavorazione: " + pathLavorazione, "error", false, 0, false, true);
            //     return;
            // }
            // percorso = percorso.replace(_pathLavorazione, ""); //rimuoviamo il pathLavorazione dal percorso
    
            var filePath = _pathLavorazione + "/lavorazioni.json";
            let lavorazioni = readFile(filePath);
    
            _procFiles=[];
            if (docInLavorazione!=null)
            {   
                _procFiles.push(docInLavorazione.name);
            }
            else if (libroInLavorazione!=null)
            {
                for (let i=0; i<libroInLavorazione.bookContents.length; i++)
                {
                    let fileName = libroInLavorazione.bookContents.item(i).name;
                    _procFiles.push(fileName);
                }
            }
    
            for (let f=0; f<_procFiles.length; f++)
            {
                docName = _procFiles[f];
            
                var file = lavorazioni.find(f=> f.file == docName);
                if (file == null){
                    messaggioUtente("Code IDX-143 File lavorazioni.json non trovato", "error");
                    return false;
                }
    
                if (tipo == 0) {
                    percorsoLinks = percorso.endsWith("/") ? percorso : percorso + "/";
                    $("#pathFoto").val(percorso);
                    $("#pathFoto").text(percorso);
                    //scriviamo nel file lavorazioni.json il percorso
                    file.pathLinks = percorsoLinks;
                    //scriviamo il file lavorazioni.json
                    messaggioUtente("Percorso per le foto impostato a: " + percorso, "success", false, 0, false, true);
                } else if (tipo == 1) {
                    percorsoLoghi = percorso.endsWith("/") ? percorso : percorso + "/";
                    $("#pathLoghi").val(percorso);
                    $("#pathLoghi").text(percorso);
                    //scriviamo nel file lavorazioni.json il percorso
                    file.pathLoghi = percorsoLoghi;
                    messaggioUtente("Percorso per i loghi impostato a: " + percorso, "success", false, 0, false, true);
                } else if (tipo == 2) {
                    //cartella logs
                    percorsoLogs = percorso.endsWith("/") ? percorso : percorso + "/";
                    $("#pathLogs").val(percorso);
                    $("#pathLogs").text(percorso);
                    //scriviamo nel file lavorazioni.json il percorso
                    file.pathLogs = percorsoLogs;
                    //scriviamo il file lavorazioni.json
                    messaggioUtente("Percorso per i logs impostato a: " + percorso, "success", false, 0, false, true);
                } else if (tipo == 3) {
                    //cartella di esportazione
                    percorsoEsportazione = percorso.endsWith("/") ? percorso : percorso + "/";
                    $("#pathEsportazione").val(percorso);
                    $("#pathEsportazione").text(percorso);
                    //scriviamo nel file lavorazioni.json il percorso
                    file.pathEsportazione = percorsoEsportazione;
                    //scriviamo il file lavorazioni.json            
                    messaggioUtente("Percorso per l'esportazione impostato a: " + percorso, "success", false, 0, false, true);
                }
            }
    
            fs.writeFileSync(filePath, JSON.stringify(lavorazioni));        
        }
    
        //se sia pathFoto che pathLoghi .val sono diversi da "" allora abilitiamo il pulsante di salvataggio
        // if ((tipo == 0 || tipo == 1) && $("#pathFoto").val() != "" && $("#pathLoghi").val() != "") {
        //     $("#confermaPercorsi").show();
        // }
        // else if((tipo == 2 || tipo == 3) && $("#pathLogs").val() != "" && $("#pathEsportazione").val() != "") {
        //     $("#confermaPercorsi").show();
        // }
    
        if (value == null && $("#pathFoto").val() != "" && $("#pathLoghi").val() != "" && $("#pathLogs").val() != "" && $("#pathEsportazione").val() != "") {
            $("#confermaPercorsi").show();
        }

    }
    catch(e){
        writeDebugMessageForCrash("Errore in impostaPercorsiDiSistema: " + e);
        console.error("Errore in impostaPercorsiDiSistema: " + e);
    }
}


/// Copia un pezzo di interfaccia portandosi dietro i gestori onclick e onchange scritti
/// negli attributi.
///
/// Un clone jQuery perde gli eventi legati via JavaScript ma conserva gli attributi: qui si
/// rileggono e si riattaccano. Il valore dell'attributo si esegue con eval, perche' e'
/// testo, ed e' l'unico eval del file.
///
/// L'abbinamento fra originale e copia e' per posizione (eq(index)): regge finche' le due
/// strutture sono identiche, il che e' vero subito dopo il clone.
function cloneElementWithEvents($element) {
    // Clona l'elemento
    var $clone = $element.clone();

    //console.log("Sovrascrivo gli onclick");
    //Riassegna gli eventi onclick
    $clone.find('[onclick]').each(function (index) {
        var originalOnclick = $element.find('[onclick]').eq(index).attr('onclick');
        $(this).on('click', function () {
            eval(originalOnclick);
        });
    });

    $clone.find('[onchange]').each(function (index) {
        var originalOnclick = $element.find('[onchange]').eq(index).attr('onchange');
        $(this).on('change', function () {
            eval(originalOnclick);
        });
    });

    return $clone;
}

/// Aspetta il numero di millisecondi indicato. Un wrapper su setTimeout, per poter scrivere
/// await delay(500).
///
/// DA SPOSTARE (task di divisione): esiste gia' Utility.sleep, che fa la stessa identica
/// cosa. Una delle due va tolta.
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/// Mostra o nasconde le parti del pannello riservate: menabo, referenze avanzate e le due
/// schede Sync e Tab13 le vede il solo superAdmin.
///
/// Agenzia, GDO e Punto Vendita le nascondono. Un ruolo che non rientra in nessuno dei due
/// gruppi lascia tutto com'e' - e' il ramo else vuoto, e vale come "non decido".
///
/// resetIdRec compare solo in testMode: e' un comando che riscrive le etichette di tutti i
/// box, e su una macchina di produzione non deve nemmeno vedersi.
///
/// DA SPOSTARE (task di divisione): con login, logout e showLogin in un js dell'accesso.
function setFinestrePerRuolo() {
    if (ruoloUtenteLoggato == RuoloUtente.superAdmin) {
        $("#menaboTab").show();
        $("#menuRefAvanzate").show();
        $('[tab="TabSync"]').show();
        $('[tab="Tab13"]').show();
    }
    else if (ruoloUtenteLoggato == RuoloUtente.agenzia || ruoloUtenteLoggato == RuoloUtente.GDO || ruoloUtenteLoggato == RuoloUtente.PuntoVendita) {
        $("#menaboTab").hide();
        $("#menuRefAvanzate").hide();
        $('[tab="TabSync"]').hide();
        $('[tab="Tab13"]').hide();
        
    }
    else {

    }

    if (testMode){
        $("#resetIdRec").show();
    }
    else{
        $("#resetIdRec").hide();
    }
}

var intervalId = null;
var intervalReconnection = null;
var pingInProcess = false;

//Modalità OFFLINE

// async function apriSchermataSyncModifiche(){
//     //leggiamo tutti i task irrisolti dal file e poi con i dati ottenuti creiamo una lita da inserire nel modal nel seguente modo:
//     //in #processiRimastiTab creiamo una riga per ogni task, la riga è suddivisa in 3 colonne: La prima colonna contiene il codiceRefAssociato, la seconda colonna contiene il tipo di operazione espresso in stringa (1 ad esempio è revisione), la terza colonna contiene un div con sfondo con scritto di base lo stato In attesa e che poi verrà modificato durante le operazioni
//     // if(!await singlePing()){
//     //     messaggioUtente("Impossibile sincronizzare le modifiche, connessione assente", "error");
//     //     pingForReconnection();
//     //     return;
//     // }
//     var file = readFile(pathLavorazione + "/tasksIrrisolti.json");
    
//     if(file != null){
//         var tasks = file;

//         for(var i = 0; i < tasks.length; i++){
//             var task = tasks[i];
//             if(task.tipoOperazione == 0){
//                 messaggioUtente("Code IDX-148 Errore durante la sincronizzazione: " + task.url + " - " + task.formData, "error");
//                 continue;
//             }
//             else if(task.tipoOperazione == 1 || task.tipoOperazione == 2 || task.tipoOperazione == 3){
//                 var dataTask = new Date(task.dataInvioOperazione);
//                 var trovato = false;
//                 for(var j = 0; j < tasks.length; j++){
//                     var task2 = tasks[j];
//                     if(task2.tipoOperazione == task.tipoOperazione && task2.codiceRefAssociato == task.codiceRefAssociato){
//                         var dataTask2 = new Date(task2.dataInvioOperazione);
//                         if(dataTask2 > dataTask){
//                             trovato = true;
//                             break;
//                         }
//                     }
//                 }
//                 if(trovato){
//                     tasks.splice(i, 1);
//                     i--;
//                     continue;
//                 }
//             }
//         }

//         $("#processiRimastiTab").empty();
//         //inseriamo un contatore in alto a destra che indica il numero eseguiti (0 di base)/numero di task totali
//         var row = $('<div class="row" style="width: 100%; display: flex; justify-content: flex-end; align-items: center; padding: 5px;"></div>');
//         var col = $('<div class="col" style="width: 100%; justify-content: end; display:flex;"><h3 id="taskEseguiti" style="margin:0px; color: white;">0</h3><h3 style="margin:0px; color: white;">/'+tasks.length+'</h3></div>');
//         row.append(col);
//         $("#processiRimastiTab").append(row);
        
//         //facciamo un piccolo margine e inseriamo una riga con i titoli delle colonne
//         var row_1 = $('<div class="row" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//         var col1 = $('<div class="col" style="width: 30%; text-align: center; color: white;">Codice Ref</div>');
//         var col2 = $('<div class="col" style="width: 30%; text-align: center; color: white;">Tipo Operazione</div>');
//         var col3 = $('<div class="col" style="width: 30%; text-align: center; color: white;">Data</div>');
//         var col4 = $('<div class="col" style="width: 30%; text-align: center; color: white;">Stato</div>');
//         row_1.append(col1);
//         row_1.append(col2);
//         row_1.append(col3);
//         row_1.append(col4);
//         $("#processiRimastiTab").append(row_1);

//         //appendiamo una copia della testata anche nei tab processiTerminatiTab e processiFallitiTab
//         $("#processiTerminatiTab").empty();
//         $("#processiFallitiTab").empty();
//         $("#processiTerminatiTab").append(row_1.clone());
//         $("#processiFallitiTab").append(row_1.clone());
        

//         for (var i = 0; i < tasks.length; i++) {
//             var task = tasks[i];

//             //     if(task.tipoOperazione == 0){
//             //         messaggioUtente("Errore durante la sincronizzazione: " + task.url + " - " + task.formData, "error");
//             //         continue;
//             //     }
//             //     else if(task.tipoOperazione == 1 || task.tipoOperazione == 2 || task.tipoOperazione == 3){
//             //         var dataTask = new Date(task.dataInvioOperazione);
//             //         var trovato = false;
//             //         for(var j = 0; j < tasks.length; j++){
//             //             var task2 = tasks[j];
//             //             if(task2.tipoOperazione == task.tipoOperazione && task2.codiceRefAssociato == task.codiceRefAssociato){
//             //                 var dataTask2 = new Date(task2.dataInvioOperazione);
//             //                 if(dataTask2 > dataTask){
//             //                     trovato = true;
//             //                     break;
//             //                 }
//             //             }
//             //         }
//             //         if(trovato){
//             //             tasks.splice(i, 1);
//             //             i--;
//             //             continue;
//             //         }
//             //     }


//             var row2 = $('<div class="rowSync" codice="' + task.codiceRefAssociato + '" tipoOperazione="' + task.tipoOperazione + '" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//             var col5 = $('<div class="col" codice="' + task.codiceRefAssociato + '" style="width: 30%; text-align: center; color: white; font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (task.codiceRefAssociato.length > 20 ? task.codiceRefAssociato.substring(0, 20) + '...' : task.codiceRefAssociato) + '</div>');

//             //tipoOperazione è un enum (0 - errore, 1 - revisione, 2 - updatePS, 3 - updateFoto, 4 - gruppa, 5 - sgruppa)
//             var col6 = $('<div class="col" style="width: 30%; text-align: center; color: white;">' + getTipoOperazioneString(task.tipoOperazione) + '</div>');
//             var col7 = $('<div class="col" style="width: 30%; text-align: center; color: white;">' + (new Date(task.dataInvioOperazione).toLocaleDateString() === new Date().toLocaleDateString() ? new Date(task.dataInvioOperazione).toLocaleTimeString() : new Date(task.dataInvioOperazione).toLocaleString('en-US', { timeZone: 'Europe/Rome' })) + '</div>');
//             var col8 = $('<div class="col" style="width: 30%; text-align: center; color: yellow;">In attesa</div>');
//             row2.append(col5);
//             row2.append(col6);
//             row2.append(col7);
//             row2.append(col8);
//             $("#processiRimastiTab").append(row2);
//         }
//         if (tasks.length > 0) {
//             if(offlineMode){
//                 Modali.apriModal("dialogSyncModifiche", "Sync modifiche", false, ["pulsantiTestataSync"]);                
//             }
//             else{
//                 Modali.apriModal("dialogSyncModifiche", "Sync modifiche", false, ["pulsantiTestataSyncOnline"]);
//             }
//             //simuliamo il click sul primo elemento di #tabButtons
//             $("#tabButtons").children().eq(0).click();
            
//         }
//         else{
//             offlineMode = false;
//             $("#modalita").show();
//             $("#modalita").text("Online");
//             $("#tornaOnlineButton").hide();
//             $("#footer").css("background-color", "#333");
//         }
//     }
// }

// async function svuotaCodaSync(){
//     var result = await Modali.confirm("La coda di operazioni nei task irrisolti verrà svuotata, l'operazione sarà irreversibile, continuare?");
//     if(result){
//         fs.writeFileSync(pathLavorazione + "/tasksIrrisolti.json", JSON.stringify([]));
//     }
// }



// function addTaskToQueue(tipoOperazione, codiceRefAssociato, codiciDaControllareIntegrita, idTracciato, requireDataControl, requireAreaControl, requireCanaleControl, url, formData, metodo, type, creaDipendenze=false, indipendenteDaAltreOperazioni=false){
//     //creiamo un oggetto task da mettere in un json, il task ha i seguenti campi:
//     //tipoOperazione è un enum (0 - errore, 1 - revisione, 2 - updatePS, 3 - updateFoto, 4 - gruppa, 5 - sgruppa, 6 - syncFoto, 7 - revisioneCampiOfferta, 8 - revisioneDescrEcampiOfferta)
//     //codiceRefAssociato è il codice del ref associato
//     //codiciDaControllareIntegrita è un array di codici di ref da controllare per l'integrità sul DB, i codici gruppo controllano la presenza dei singoli e la loro appartenza al gruppo, i codici singoli uguale ma controllano che non facciano paerte di nessun gruppo (operazioni di gruppa, sgruppa)
//     //requireDataControl è un booleano che indica se è necessario controllare la data dell'operazione prima di decidere se sincronizzare o meno l'operazione
//     //url è l'url della chiamata
//     //formData è il formData da inviare
//     //metodo è il metodo della chiamata
//     //type è il tipo della chiamata
//     //creaDipendenze è un booleano che indica se l'operazione blocca altre operazioni con codiceRefAssociato
//     //indipendenteDaAltreOperazioni è un booleano che indica se l'operazione può essere eseguita anche se c'è una dipendenza a monte per quel codice ref
//     //dataInvioOperazione è la data in cui l'operazione è stata inviata

//     var day = ("0" + new Date().getDate()).slice(-2);
//     var month = ("0" + (new Date().getMonth() + 1)).slice(-2);
//     var year = new Date().getFullYear();
//     var hours = ("0" + new Date().getHours()).slice(-2);
//     var minutes = ("0" + new Date().getMinutes()).slice(-2);
//     var seconds = ("0" + new Date().getSeconds()).slice(-2);

//     var task = {
//         tipoOperazione: tipoOperazione,
//         codiceRefAssociato: codiceRefAssociato,
//         codiciDaControllareIntegrita: codiciDaControllareIntegrita,
//         idTracciato: idTracciato,
//         requireDataControl: requireDataControl,
//         requireAreaControl: requireAreaControl,
//         requireCanaleControl: requireCanaleControl,
//         url: url,
//         formData: formData,
//         metodo: metodo,
//         type: type,
//         creaDipendenze: creaDipendenze,
//         indipendenteDaAltreOperazioni: indipendenteDaAltreOperazioni,
//         dataInvioOperazione: day + "/" + month + "/" + year + " " + hours + ":" + minutes + ":" + seconds,
//         utenteRichiedente: idUtente
//     };

//     //salviamo il task in un json
//     var file = readFile(pathLavorazione + "/tasksIrrisolti.json");
//     if(file != null){
//         appendToFile(pathLavorazione + "/tasksIrrisolti.json", task);
//     }
//     else{
//         fs.writeFileSync(pathLavorazione + "/tasksIrrisolti.json", JSON.stringify([task]));
//     }
// }

// function getTipoOperazioneString(tipoOperazione){
//     switch(tipoOperazione){
//         case 0:
//             return "Errore";
//         case 1:
//             return "Revisione";
//         case 2:
//             return "Update PS";
//         case 3:
//             return "Update Foto";
//         case 4:
//             return "Gruppa";
//         case 5:
//             return "Sgruppa";
//         default:
//             return "Errore";
//     }
// }

// async function sincronizzaModificheOffline(){
//     if(!await singlePing()){
//         messaggioUtente("Impossibile sincronizzare le modifiche, connessione assente", "error", false, 0, true, true);
//         pingForReconnection();
//         return;
//     }
//     offlineMode = false;
//     $("#modalita").show();
//     $("#modalita").text("Online");
//     $("#tornaOnlineButton").hide();
//     $("#footer").css("background-color", "#333");
//     var maxTentativi = 5;
//     var attesaInSecondi = 5;
//     var listaTaskFalliti = [];
//     var file = readFile(pathLavorazione + "/tasksIrrisolti.json");
//     //leggiamo i task irrisolti e uno ad uno li eseguiamo seguendo questi passaggi:
//     //1. leggiamo il primo task della lista
//     //2. se il tipo è: 0 (errore) mandiamo un messaggio utente segnalandolo con le informazioni del task, se è 1 (revisione) o 2 (updatePS) o 3 (updateFoto) cerchiamo un altra operazione in lista che abbia lo stesso tipo e lo stesso codice ma con una data maggiore rispetto a quella di questo task; se c'è passiamo al prossimo task e questo viene rimosso altrimenti si passa allo step 3, se è altro si passa allo step 3
//     //2.5 controlliamo se in listaTaskFalliti c'è un task con lo stesso codiceRefAssociato, se c'è e creaDipendenze è true allora passiamo al prossimo task, se c'è e creaDipendenze è true allora inseriamo questo task in listaTaskFalliti e passiamo al prossimo task
//     //3. lasciamo uno spazio vuoto per controlli futuri
//     //4. facciamo la chiamata xhr con i dati del task
//     //5. aspettiamo il ritorono della chiamata, se va a buon fine passiamo al prossimo task e rimuoviamo dalla lista il task corrente, se non va a buon fine mandiamo un messaggio utente con scritto tentativo di sincronizzazione numero: +n+ fallito, secondo tentativo tra x secondi.
//     //6 se è fallito aspettiamo x secondi e riproviamo, ripetiamo il ciclo fino a che non va a buon fine o fino a che non raggiungiamo un numero massimo di tentativi, se dopo il numero massimo di tentativi non va a buon fine mandiamo un messaggio che avvisa del fallimento della sincronizzazione e salviamo il task fallito in una nuova lista poi avviamo il prossimo
//     //7. se il task è riuscito lo rimuoviamo dalla lista e mandiamo il prossimo

//     if(file != null){
//         var tasks = file;
//         var velocitaScomparsa = 20/tasks.length < 1 ? (20/tasks.length)*1000 : 1000;
//         for(var i = 0; i < tasks.length; i++){
//             var task = tasks[i];
//             if(task.tipoOperazione == 0){
//                 messaggioUtente("Errore durante la sincronizzazione: " + task.url + " - " + task.formData, "error");

//                 //modifichiamo lo stato del task in fallito e creiamo una riga da appendere nella tabella dei task falliti
//                 var row = $(".rowSync[codice='" + task.codiceRefAssociato + "'][tipoOperazione='" + task.tipoOperazione + "']").not("[risolto]").first();
//                 row.find(".col").last().text("Fallito");
//                 //cambiamo il colore del testo in rosso
//                 row.find(".col").last().css("color", "red");

//                 await delay(velocitaScomparsa);
//                 //spostiamo la row in fondo alla tabella dei task falliti
//                 //rimuoviamo il border-bottom
//                 row.css("border-bottom", "none");
//                 $("#processiFallitiTab").append(row);
//                 //aggiungiamo sotto la row una riga con il motivo del fallimento, in questo caso il motivo è che il task ha dipendenze irrisolte
//                 var rowMotivo = $('<div class="row" style="width: 100%; display: flex; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//                 var colMotivo = $('<div class="col" style="width: 100%; text-align: center; color: white;">Errore: Il task non è stato salvato correttamente</div>');
//                 rowMotivo.append(colMotivo);
//                 $("#processiFallitiTab").append(rowMotivo);          
//                 continue;
//             }
//             else if(task.tipoOperazione == 1 || task.tipoOperazione == 2 || task.tipoOperazione == 3){
//                 var dataTask = new Date(task.dataInvioOperazione);
//                 var trovato = false;
//                 for(var j = 0; j < tasks.length; j++){
//                     var task2 = tasks[j];
//                     if(task2.tipoOperazione == task.tipoOperazione && task2.codiceRefAssociato == task.codiceRefAssociato){
//                         var dataTask2 = new Date(task2.dataInvioOperazione);
//                         if(dataTask2 > dataTask){
//                             trovato = true;
//                             break;
//                         }
//                     }
//                 }
//                 if (trovato) {
//                     tasks.splice(i, 1);
//                     i--;
//                     continue;
//                 }
//             }
            
//             var trovato = false;
//             for(var j = 0; j < listaTaskFalliti.length; j++){
//                 var taskFallito = listaTaskFalliti[j];
//                 if(taskFallito.codiceRefAssociato == task.codiceRefAssociato){
//                     if(taskFallito.creaDipendenze && !task.indipendenteDaAltreOperazioni){
//                         trovato = true;
//                         break;
//                     }
//                 }

//                 if(trovato){
//                     taskFallito.push(task);
//                     tasks.splice(i, 1);
//                     i--;
//                     break;
//                 }
//             }

//             if(trovato){

//                 //modifichiamo lo stato del task in fallito e creiamo una riga da appendere nella tabella dei task falliti
//                 var row = $(".rowSync[codice='"+task.codiceRefAssociato+"'][tipoOperazione='"+task.tipoOperazione+"']").not("[risolto]").first();
//                 row.find(".col").last().text("Fallito");
//                 //cambiamo il colore del testo in rosso
//                 row.find(".col").last().css("color", "red");

//                 await delay(velocitaScomparsa);
//                 //spostiamo la row in fondo alla tabella dei task falliti
//                 //rimuoviamo il border-bottom
//                 row.css("border-bottom", "none");
//                 $("#processiFallitiTab").append(row);
//                 //aggiungiamo sotto la row una riga con il motivo del fallimento, in questo caso il motivo è che il task ha dipendenze irrisolte
//                 var rowMotivo = $('<div class="row" style="width: 100%; display: flex; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//                 var colMotivo = $('<div class="col" style="width: 100%; text-align: center; color: white;">Errore: Il task ha dipendenze irrisolte</div>');
//                 rowMotivo.append(colMotivo);
//                 $("#processiFallitiTab").append(rowMotivo);

//                 continue;
//             }

//             // var operation = {
//             //     tipoOperazione: task.tipoOperazione,
//             //     codice: task.codiceRefAssociato,
//             //     codiciDaControllareIntegrita: task.codiciDaControllareIntegrita,
//             //     idTracciato: task.idTracciato,
//             //     dataControl: task.requireDataControl,
//             //     area: task.requireAreaControl,
//             //     canale: task.requireCanaleControl,
//             //     url: task.url.toString(),
//             //     formData: JSON.stringify(task.formData),
//             //     dataRegistrazione: task.dataInvioOperazione
//             // };

//             var semaforo = null;
//             var errore = null;
//             var idOperazione = 0;
//             var xhrCheck = new XMLHttpRequestClient();

//             xhrCheck.onload = async (objResult, parsed) => {
//                 try {
//                     if (!parsed) {
//                         try {
//                             objResult = JSON.parse(objResult);
//                         }
//                         catch (e) {
//                             messaggioUtente("Errore durante il parsing della risposta:" + objResult, "error");
//                             return;
//                         }
//                     }
//                     console.log(objResult);
//                     if (objResult.esito) {
//                         semaforo = true;   
//                         errore = objResult.error; 
//                         idOperazione = objResult.id;                   
//                     }
//                     else{
//                         semaforo = false;
//                         errore = objResult.error;
//                     }

//                 }
//                 catch (e) {
//                     console.log(e);
//                 }
//             }

//             xhrCheck.onreadystatechange = function () {
//                 if (xhrCheck.readyState == 4) {
//                     if (xhrCheck.status == 200) {
//                     } else {
//                     }
//                 }
//             }

//             xhrCheck.onerror = function () {
//                 semaforo = false;
//                 errore = "Errore durante la richiesta: " + xhrCheck.status;
//             }

//             xhrCheck.onNoConnection = async function (objResult, parsed) {}

//             console.log("RegisterController/autorizzaOperazioneDaSync");
//             var formData = new FormData();
//             formData.append("tipoOperazione", task.tipoOperazione);
//             formData.append("codice", task.codiceRefAssociato);
//             //facciamo il join dei codici usando il carattere - come separatore
//             formData.append("codiciDaControllareIntegrita", (task.codiciDaControllareIntegrita != null ? task.codiciDaControllareIntegrita.join("-") : ""));
//             formData.append("idTracciato", task.idTracciato);
//             formData.append("dataControl", task.requireDataControl);
//             formData.append("area", task.requireAreaControl);
//             formData.append("canale", task.requireCanaleControl);
//             formData.append("url", task.url.toString());
//             formData.append("formData", JSON.stringify(task.formData));
//             formData.append("dataRegistrazione", task.dataInvioOperazione);
//             formData.append("autore", task.utenteRichiedente);
//             xhrCheck.send("RegisterController/autorizzaOperazioneDaSync", formData, "PUT");


//             while (semaforo === null) {
//                 await delay(200); // Wait for 0,2 second
//             }
//             ///////////////////////////////////////////////

//             if (semaforo && errore != "") 
//             {
//                 //se siamo qui vuol dire che il task non ha ricevuto l'autorizzazione a procedere poichè sul server l'operazione risulta obsoleta  
//                 //modifichiamo lo stato del task in fallito e creiamo una riga da appendere nella tabella dei task falliti
//                 var row = $(".rowSync[codice='" + task.codiceRefAssociato + "'][tipoOperazione='" + task.tipoOperazione + "']").not("[risolto]").first();
//                 row.find(".col").last().text("Obsoleto");
//                 //cambiamo il colore del testo in rosso
//                 row.find(".col").last().css("color", "yellow");

//                 await delay(velocitaScomparsa);
//                 //spostiamo la row in fondo alla tabella dei task falliti
//                 //rimuoviamo il border-bottom
//                 row.css("border-bottom", "none");
//                 $("#processiFallitiTab").append(row);
//                 //aggiungiamo sotto la row una riga con il motivo del fallimento, in questo caso il motivo è che il task ha dipendenze irrisolte
//                 var rowMotivo = $('<div class="row" style="width: 100%; display: flex; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//                 var colMotivo = $('<div class="col" style="width: 100%; text-align: center; color: white;">Operazione obsoleta: ' + errore + '</div>');
//                 rowMotivo.append(colMotivo);
//                 $("#processiFallitiTab").append(rowMotivo);
//                 continue;        
//             }
//             else if (!semaforo) {
//                 //sul server l'operazione di controllo è fallita e non possiamo procedere

//                 //salviamo il task in una lista di task falliti
//                 listaTaskFalliti.push(task);
//                 if (offlineMode) {
//                     //salviamo tutti i task rimasti nei task falliti mantenendo l'ordine e poi usciamo dal ciclo
//                     for (var j = i + 1; j < tasks.length; j++) {
//                         listaTaskFalliti.push(tasks[j]);
//                     }
//                     messaggioUtente("Sei offline, impossibile sincronizzare le modifiche", "warning", false, 0, true, true);
//                     break;
//                 }
//                 else {
//                     //modifichiamo lo stato del task in fallito e creiamo una riga da appendere nella tabella dei task falliti
//                     var row = $(".rowSync[codice='" + task.codiceRefAssociato + "'][tipoOperazione='" + task.tipoOperazione + "']").not("[risolto]").first();
//                     row.find(".col").last().text("Fallito");
//                     //cambiamo il colore del testo in rosso
//                     row.find(".col").last().css("color", "red");

//                     await delay(velocitaScomparsa);
//                     //spostiamo la row in fondo alla tabella dei task falliti
//                     //rimuoviamo il border-bottom
//                     row.css("border-bottom", "none");
//                     $("#processiFallitiTab").append(row);
//                     //aggiungiamo sotto la row una riga con il motivo del fallimento, in questo caso il motivo è che il task ha dipendenze irrisolte
//                     var rowMotivo = $('<div class="row" style="width: 100%; display: flex; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//                     var colMotivo = $('<div class="col" style="width: 100%; text-align: center; color: white;">Errore sul server: ' + errore + '</div>');
//                     rowMotivo.append(colMotivo);
//                     $("#processiFallitiTab").append(rowMotivo);
//                     continue;
//                 }
                
//             }


//             var taskCompletato = false;
//             var tentativo = 0;
//             while (taskCompletato == false && tentativo <= maxTentativi && !offlineMode) {
//                 var esitoTentativo = null;
//                 //facciamo la chiamata xhr
//                 var xhr = new XMLHttpRequestClient();
//                 var error = "";
//                 xhr.onload = async (objResult, parsed) => {
//                     try {
//                         if (!parsed) {
//                             try {
//                                 objResult = JSON.parse(objResult);
//                             }
//                             catch (e) {
//                                 messaggioUtente("Errore durante il parsing della risposta:" + objResult, "error");
//                                 return;
//                             }
//                         }
//                         console.log(objResult);
//                         if (objResult.esito) {
//                             taskCompletato = true;
//                             esitoTentativo = true;
//                         }
//                         else{
//                             if(tentativo < maxTentativi){
//                                 messaggioUtente("Tentativo di sincronizzazione numero: " + tentativo + " fallito, prossimo tentativo tra " + attesaInSecondi + " secondi", "warning");
//                             }
//                             else{
//                                 messaggioUtente("Tentativo di sincronizzazione numero: " + tentativo + " fallito, raggiunto il numero massimo di tentativi", "error");
//                             }
//                             error = objResult.error;
//                             esitoTentativo = false;
//                         }

//                     }
//                     catch (e) {
//                         console.log(e);
//                     }
//                 }

//                 xhr.onreadystatechange = function () {
//                     if (xhr.readyState == 4) {
//                         if (xhr.status == 200) {
//                         } else {
//                             //messaggioUtente("Errore durante la richiesta: " + xhr.status, "error");
//                         }
//                     }
//                 }

//                 xhr.onerror = function () {
//                     esitoTentativo = false;
//                 }

//                 xhr.onNoConnection = async function (objResult, parsed) {}
//                 //sostituiamo nell'url idOperazione con l'id dell'operazione appena creata
//                 task.url = task.url.replace("idOperazione", idOperazione);
//                 if(task.tipoOperazione == 3) //updateFoto
//                 {
//                     xhr.sendFiles(task.url, task.formData);
//                 }
//                 else{
//                     xhr.send(task.url, task.formData, task.metodo, task.type);
//                 }

                
//                 while (esitoTentativo === null) {
//                     await delay(500); // Wait for 0,5 second
//                 }
                

//                 if(esitoTentativo == true){
//                     break;
//                 }               
//                 tentativo++;
//             }

//             if(!esitoTentativo && (offlineMode || tentativo >= maxTentativi)){
//                 //salviamo il task in una lista di task falliti
//                 listaTaskFalliti.push(task);
//                 if(offlineMode)
//                 {
//                     //salviamo tutti i task rimasti nei task falliti mantenendo l'ordine e poi usciamo dal ciclo
//                     for(var j = i+1; j < tasks.length; j++){
//                         listaTaskFalliti.push(tasks[j]);
//                     }
//                     messaggioUtente("Sei offline, impossibile sincronizzare le modifiche", "warning", false, 0, true, true);
//                     break;
//                 }
//                 else {
//                     //il task ha superato il massimo di tentativi
//                     //modifichiamo lo stato del task in fallito e creiamo una riga da appendere nella tabella dei task falliti
//                     var row = $(".rowSync[codice='" + task.codiceRefAssociato + "'][tipoOperazione='" + task.tipoOperazione + "']").not("[risolto]").first();
//                     row.find(".col").last().text("Fallito");
//                     //cambiamo il colore del testo in rosso
//                     row.find(".col").last().css("color", "red");

//                     await delay(velocitaScomparsa);
//                     //spostiamo la row in fondo alla tabella dei task falliti
//                     //rimuoviamo il border-bottom
//                     row.css("border-bottom", "none");
//                     $("#processiFallitiTab").append(row);
//                     //aggiungiamo sotto la row una riga con il motivo del fallimento, in questo caso il motivo è che il task ha dipendenze irrisolte
//                     var rowMotivo = $('<div class="row" style="width: 100%; display: flex; align-items: center; padding: 5px; border-bottom: 1px solid white;"></div>');
//                     var colMotivo = $('<div class="col" style="width: 100%; text-align: center; color: white;">Errore sul server: '+ error +'</div>');
//                     rowMotivo.append(colMotivo);
//                     $("#processiFallitiTab").append(rowMotivo);
//                     continue;
//                 }
//             }

//             //se siamo qui il task è riuscito
//             var row = $(".rowSync[codice='" + task.codiceRefAssociato + "'][tipoOperazione='" + task.tipoOperazione + "']").not("[risolto]").first();
//             row.find(".col").last().text("Completato");
//             row.find(".col").last().css("color", "lightgreen");

//             await delay(velocitaScomparsa);
//             //spostiamo la row in fondo alla tabella dei task falliti
//             //rimuoviamo il border-bottom
//             row.css("border-bottom", "none");
//             $("#processiTerminatiTab").append(row);
//             //aumentiamo di 1 il valore del task eseguiti
//             var taskEseguiti = parseInt($("#taskEseguiti").text());
//             $("#taskEseguiti").text(taskEseguiti + 1);
//         }

//         //sostituiamo i task irrisolti sul file con la lista di task falliti
//         fs.writeFileSync(pathLavorazione + "/tasksIrrisolti.json", JSON.stringify(listaTaskFalliti));

//         //eliminiamo pulsantiTestataSync e nascondiamo il pulsante closeModal
//         $("#headerModal").find("#pulsantiTestataSync").hide();
//         $("#headerModal").find("#closeModal").hide();
//         //appendiamo con gli eventi pulsantiTestataSyncOnline e lo appendiamo dove prima erano i pulsantiTestataSync
//         var pulsanti = cloneElementWithEvents($("#pulsantiTestataSyncOnline"));
//         $("#headerModal").find("#pulsantiTestataSync").replaceWith(pulsanti);

//         //nascondiamo il pulsante iniziaSincronizzazione
//         $("#headerModal").find("#iniziaSincronizzazione").hide();
//     }
                    
// }



// function continuaOffline(){
//     offlineMode = true;
//     $("#modalita").text("Offline");
//     $("#modalita").hide();
//     $("#footer").css("background-color", "red");
//     $("#tornaOnlineButton").show();
//     Modali.chiudiModal();
// }

//FINE - Modalità OFFLINE


var abortedSyncFoto = [];
var syncFotoInCorso = [];

/// Chiede al server l'elenco di loghi e bolli da scaricare, nel formato che si aspetta
/// scaricamentoFoto.downloadImages.
///
/// Sono le immagini comuni a tutta la lavorazione, non quelle delle singole referenze: si
/// scaricano una volta per libro.
function getLoghiBolliData(callback) {
    var xhr = new XMLHttpRequestClient();
    xhr.onload = async (data, parsed) => {
        try {
            if (data.error != null && data.error != "") {
                messaggioUtente("Code IDX-151 errore sul server: " + data.error, "error");
            }
            if (data.esito == false) {
                return;
            }
            console.log(data);

            if (callback != null) {
                callback(data);
            }

        }
        catch (e) {
            console.log(e);
            if (callback != null) {
                callback();
            }
        }
    }

    xhr.onreadystatechange = function () { }

    xhr.onerror = function () {
        console.error("errore");
    }

    xhr.onNoConnection = async function () { }

    xhr.send("SyncFoto/getPacchettoLoghiBolliAsContract", null, "GET", null);
}

/// Involucro: controlla il kit, legge il tipo di export scelto e chiama
/// ficoProcess.esportaMateriale, dove sta il lavoro vero.
async function esportaMateriale(sender)
{
    
    try 
    {        
        //controllo che l'id lavorazione sia stato selezionato e che il file listaKit + idlavorazione.json esista
        if (idKitLavorazione == null || idKitLavorazione == "" || idKitLavorazione == 0) {
            messaggioUtente("Code IDX-153 Errore: Nessun kit selezionato", "error");
            return;
        }

        let actionFormat = sender.attr("actionFormat");
        let guidExport=$("#cmbTipiDiExport").val();
        let itemTipoExport = ficoProcess.sourceTipiExport.content.find(te=>te.guidID==guidExport);

        scaricaContenutoKit(idKitLavorazione, true, async function () {
            setTimeout(function(){showLoading("Esportazione in corso...");},200);
            if (itemTipoExport.codice == "CORREGGO") {
                ficoProcess.processCorreggoExport(itemTipoExport);
            }
            else {
                //ficoProcess.esportaMateriale(actionFormat, guidExport, itemTipoExport);
                ficoProcess.esportaMateriale(guidExport);
            }
        });

        showLoading("Preparazione esportazione...");

        return;
    }
    catch (e) {
        console.log(e);
        console.error(e.toString());
        hideLoading();
    }
}

/// Il pulsante che mette il Plugin in pausa: smette di reagire ai cambi di selezione e di
/// pagina, e copre il pannello con un avviso.
///
/// Serve quando l'operatore deve lavorare in InDesign senza che ogni clic faccia partire
/// un'analisi. Lo stato sta nell'attributo dell'icona, che e' anche cio' che decide quale
/// delle due immagini mostrare.
function clickOnSleepAwake(sender)
{
    if (sender.attr('stato')=='wake')
    {
        sender.attr('src','images/sleep.png');
        sender.attr('stato','sleep');
        indesignEvents.sleep(true);
        Modali.apriModal("dialogSleepLock", "Modalità sleep attiva", false);
        
    }
    else
    {
        sender.attr('src','images/wake.png');
        sender.attr('stato','wake');
        indesignEvents.sleep(false);
        Modali.chiudiModal();
        
    }
}

/// Toglie l'idRec dall'etichetta di tutti i box del documento, in tutte le pagine.
///
/// E' un attrezzo da banco di prova, e si vede solo in testMode (setFinestrePerRuolo).
/// Senza idRec i box tornano a essere riconoscibili per solo codice gruppo, che e' come si
/// faceva prima: serve a riprodurre quella situazione.
///
/// La posizione dell'idRec nell'etichetta dipende da quanto e' vecchio il box: campo 4 nel
/// formato vecchio, campo 5 in quello nuovo. E' getDnaOfBox a dire quale dei due si ha per
/// le mani (dna.oldBoxFormat).
async function resetIdRec(){
    //confirm all'utente
    var res = await Modali.confirm("Verranno rimossi tutti gli idRec da tutti i box, sicuro di voler procedere?");
    if (!res) {
        return;
    }

    //scorriamo tutte le pagine del documento, guardiamo a tutti i gruppi in pagina, per ogni gruppo cerchiamo la base
    //facciamo un controllo sulla label se facendo split ha un campo [4], quello è l'idRec, se c'è lo rimuoviamo
    for (let i = 0; i < docInLavorazione.pages.length; i++) {
        let page = docInLavorazione.pages.item(i);
        for (let j = 0; j < page.groups.length; j++) {
            let group = page.groups.item(j);
            var dna = Utility.getDnaOfBox(group);
            if (dna == null) {
                continue;
            }
            if (dna.item != null) {
                let labelParts = dna.item.label.split("$");
                if(dna.oldBoxFormat){
                    if (labelParts.length > 4) {
                        labelParts[4] = "";
                        dna.item.label = labelParts.join("$");
                    }
                }
                else{
                    if (labelParts.length > 5) {
                        labelParts[5] = "";
                        dna.item.label = labelParts.join("$");
                    }
                }
            }
        }
    }
}


showLoading("Avvio del plugin in corso...");
