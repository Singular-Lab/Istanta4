const uxp = require('uxp');
const { storage } = require('uxp');
const fs = require('fs');
const fs2 = require('uxp').storage.localFileSystem;
const { app, Justification, FitOptions, LocationOptions, File, ColorModel, Folder, ExportFormat, ContentType, SaveOptions, CoordinateSpaces, AnchorPoint, ResizeMethods} = require('indesign');
const customAgenzia = require('./custom');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const { parse, format } = require('path');
const cmd = require('./cmd');
const InddEvents = require('./events');
const garbageCollector = require('./garbageCollector');
const InputEditController = require('./InputEditController');
const cambiStrutturaliJs = require('./cambiStrutturali');
const {Utility, FotoPlacer} = require('./utility');
const jsIndexControls = require('./jsIndexControls');
const schedaRef = require('./schedaRef');
const schedaArtwork = require('./schedaArtwork');
const manifesto = require("./manifest.json");
const ipconfig = require("./ipconfig.json");
const confronti = require('./confronti');
const NoRenderElementi = require('./noRenderElementi');
const ficoProcess = require('./ficoProcess');
const grigliaJs = require('./griglia');
const filtriJs = require('./filtri');
const CssFramework = require('./CssFramework');
const pluginMiddleware = require('./pluginMiddleware');
const fotoAutoSync = require('./fotoAutoSync');
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

Utility.registerDateMenuPicker();
showLoading("Inizializzazione...");


let xhrInProcess=null;//Processo XHR uncio per tutte le operazioni che devono per forza di cosa essere sequenziali
let docInLavorazione=null;
let libroInLavorazione=null;
let jobImpaginazioneLibro={queue:[], index:-1, stato:0}
let contenutoKitInLavorazione=null;
let cacheKitSearchResult=null;
var pagSelected = -1;
//let refSelected=null;
var offlineMode = true;
let listaPromoAperte=[];
//let editRefFieldController=null;

let userLoggedDetails=null;

var listaTracciatiScaricata = false;
var tracciatoOnlineScaricato = false;
var pathLavorazione = "";
var pluginPath = "";
var intervalSpeed=100;
var sourceFormati = null;
var sourceAree = null;
var sourceCanali = null;
var sourceTipiExport = null;
var dbMastro = readFile(pathLavorazione + "/dbMastro.json");
let useCompiledField = true;
let percorsoLinks = "/Links/";
let percorsoLoghi = "/Links/Loghi/";
let percorsoLogs = "/Logs/";
let percorsoEsportazione = "/Export/";
let defaultPercorsoLinks = "/Links/";
let defaultPercorsoLoghi = "/Links/Loghi/";
let defaultPercorsoLogs = "/Logs/";
let defaultPercorsoEsportazione = "/Export/";

let datiFicoScaricati=false;

let abortExport=false;

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
function setVersionePlugin() {
    //leggiamo la versione da manifest.json version
    var versione = manifesto.version;
    $("#versionePlugin").text("Istanta v. " + versione + (testMode ? " - (testmode)" : ""));
}

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
function addToGarbageCollector(element, keyToDelete = null) {
    gC.Add(element, keyToDelete);
}

function requireKeyForGarbage(){
    return gC.generateKey();
}

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
        xhrInProcess.abort();
    
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
            xhrInProcess.abort();

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
    
    Utility.closeAllModal();
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
    Utility.closeAllModal();

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
    Utility.closeAllModal();

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
    Utility.closeAllModal();

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

                var obs =CssFramework.getSpazioImpaginazione(currentElement);
                CssFramework.fixFoto(currentElement, obs.candidate, obs.obstacles);
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




function clearNarrow()
{
    if (docInLavorazione == null){
        return;
    }
    $("#narrow").css("display","none");
    $("#narrow_talker").text("");
    $("#mainContent").show();
}

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

function selectSchedaRef(enumSchedaRef){
    schedaRef.selectSchedaRef(enumSchedaRef);
}

function raggruppa(enumSchedaRef){
    schedaRef.SchermataRaggruppamento();
}

function raggruppaSottoArtwork(){
    schedaArtwork.raggruppaSottoArtwork();
}

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
            Utility.getBolloNOFOTO(function (item) {
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

            Utility.getBolloFOTONOFOUND(function (item) {
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
                while (await !checkPercorsi()) {
                    await Utility.sleep(1000);
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
                    setNarrow("Impossibile inizializzare questo documento con l’account " + nomeUtente + ". Contattare l’amministratore per risolvere la lavorazione.");
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
    Utility.closeAllModal();
    $("#homeImage").click();
}

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

                openTab(null, "Tab14");
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

async function apriModalEsportaLibro(){
    Utility.apriModal("dialogEsportaLibro", "Esporta Libro");
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

async function esportaLibro(){
    try{

        //leggiamo tutti i checkbox selezionati in #bodyEsportazioniLibro e mettiamo da parte i loro guidID
        jobImpaginazioneLibro = await leggiStatoLavorazioneLibro();
    
        let tipiExportSelezionati = [];
        
        $(".exportTipoCheckbox:checked").each(function () {
            let id = $(this).attr("id").replace("exportTipo_", "");
            tipiExportSelezionati.push(id);
        });
        Utility.chiudiModal();
    
    
        let job = jobImpaginazioneLibro;
        let esportazioneDaRiprendere = false;
    
        if(job.stato == 4){
            var res = await Utility.confirm("Il processo di esportazione del libro è già stato effettuato, vuoi ripeterlo?.");
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
            var res = await Utility.confirm("Impaginazione non ancora completata. Vuoi forzare il processo di esportazione? Non sarà possibile più possibile impaginare il libro. Per ripristinare l'impaginazione in un secondo momento cancellare il file listaImpaginata"+idKitLavorazione+".json nella cartella del libro. CONTINUARE?");
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

async function autoCompilazioneCampiKit(){

    var campiDecodificati = null;
    
    $("#actMassivaSuKit").css("display", "none");    


    //Se non ci sono file aperti ma c'è un libro analizzo quello
    if (docInLavorazione != null)
    {
        if (customAgenzia.decodificaNomeFile != null)
            customAgenzia.decodificaNomeFile(docInLavorazione.name);

        //l'ogggetto di ritorno ha le seguenti chiavi
        // {
        //     promo: "A2515_SC_27-06-25",
        //     canale: "SC",
        //     area: "TO",
        //     formato: "VOL"
        // }

        var promoTrovata = false;
        var canaleTrovato = false;
        var areaTrovata = false;
        var formatoTrovato = false;

        if(campiDecodificati != null){
            if(campiDecodificati.promo != null){
                promoTrovata = Utility.setPickerValue($("#kitPromoCmb"), campiDecodificati.promo, false);
                await Utility.sleep(50);
                if(promoTrovata){
                    if(campiDecodificati.canale != null){
                        canaleTrovato = Utility.setPickerValue($("#kitCanaliCmb"), campiDecodificati.canale, false);
                    }
                    if(campiDecodificati.area != null){
                        areaTrovata = Utility.setPickerValue($("#kitAreeCmb"), campiDecodificati.area, false);
                    }
                }
            }

            formatoTrovato = Utility.setPickerValue($("#kitFormatiCmb"), campiDecodificati.formato, false);
        }

        if(promoTrovata && canaleTrovato && areaTrovata && formatoTrovato){
            ficoProcess.cercaKit(function(result)
            {
                console.log("Ricerca kit terminata");

            });
        }
    }
}

//Funzione che scarica da Istanta2 il contenuto del kit

function scaricaContenutoKit(idKit, noCacheValue = null, callback = null, skipMostraTracciato = false)
{
    if(idKit == null){
        idKit = idKitLavorazione;
    }
    if(noCacheValue == null){
        noCacheValue = noCache;
    }
    let me = this;
    console.log("scaricaContenutoKit("+ idKit +")");
    showLoading("Scaricamento lista...");

    console.log("step1");

    if (xhrInProcess!=null)
        xhrInProcess.abort();


    console.log("step2");

    xhrInProcess = new XMLHttpRequestClient();
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
            if (typeof confronti !== "undefined" && confronti.eliminaReportIntegritaLocale) {
                confronti.eliminaReportIntegritaLocale(idKit);
            }

            leggiContenutoKit(idKit, skipMostraTracciato);
            //mostraTracciato();

            tracciatoOnlineScaricato = true;
            //scaricaTracciatoLocale(idTracciato);

            if (callback != null && typeof callback === "function") {
                callback(objResult);
            }
            else {
                hideLoading();
            }

            me.xhrInProcess = null;

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

    xhrInProcess.onerror = function () {
        //messaggioUtente("refreshCambiaPS:Errore di rete", "error");
    }


    console.log("Menabo/getListaTracciatoNew/" + idKit);
    //var formData = new FormData();
    console.log(xhrInProcess);
    xhrInProcess.send("Menabo/getListaTracciatoNew2/" + idKit+"/"+noCacheValue, null, "GET");
}

//Funzione che legge in locale il contentuo del kit grazie al file json ultimo scaricato
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

function getSourceAree(){
    return ficoProcess.sourceAree;
}

function getSourceCanali(){
    return ficoProcess.sourceCanali;
}

function getSourceFormati(){
    return ficoProcess.sourceFormati;
}

// ======= Webview in a dialog =======
const bOpt1 = document.getElementById("bOpt1Advanced");
const bOpt2 = document.getElementById("bOpt2Advanced");
var lastSelections = [];

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


function conteggia() {
    conteggiaImpagina(false);
}

if (bOpt2 != null){
    bOpt2.onclick = async () => {
        const conferma = await Utility.confirm("Confermi l'impaginazione?");
        if (conferma) {
            impagina();
        }
    };
}

function impagina() {
    console.log("Impagino (modalita standard)");
    conteggiaImpagina(true);
}

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
        avviaSyncPacchettoFoto(1, function(){
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

            avviaSyncPacchettoFoto(0, function(){
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

async function leggiStatoLavorazioneLibro()
{
    let _libroFilePath = await libroInLavorazione.filePath; 
    let _pathLavorazioneLibro = _libroFilePath.nativePath;
    let filePath=_pathLavorazioneLibro+Utility.getDirSeparator()+libroInLavorazione.name+"_register.json";
    let file = readFile(filePath);

    return file;
}

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

function rimuoviSimboli() {
    for (var key in cacheLoghi) {
        if (cacheLoghi[key] != null && cacheLoghi[key].isValid) {
            cacheLoghi[key].remove();
        }
    }
    cacheLoghi = {};
}

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

function makeCodiceAssociatoLabel(codice, idRec) {
    if (codice == null || codice === "") {
        throw new Error("Codice gruppo mancante per codice_associato");
    }

    if (idRec == null || isNaN(parseInt(idRec))) {
        throw new Error("idRec mancante per codice_associato: " + codice);
    }

    return "codice_associato$" + codice.toString() + "$" + parseInt(idRec);
}

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

function sameCodiceFiltro(a, b) {
    if (a == null || b == null) {
        return false;
    }

    return a.codice != null &&
        b.codice != null &&
        a.codice.toString() === b.codice.toString() &&
        parseInt(a.idRec) === parseInt(b.idRec);
}

function addCodiceFiltroToReq(req, rootPath, propName, index, codiceFiltro) {
    req += rootPath + "." + propName + "[" + index + "].codice=" + encodeURIComponent(codiceFiltro.codice) + "&";
    req += rootPath + "." + propName + "[" + index + "].idRec=" + encodeURIComponent(codiceFiltro.idRec) + "&";
    return req;
}

var paramsCache = {};
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

async function _conteggiaImpaginaConContesto(docInLavorazione, pathLavorazione, idKitLavorazione, impagina = false, cbkEnd = null, restartFromIndexPoP = 0) {
    var noCacheCheck = !($("#cacheCheckAdvanced").is(":checked"));

    Utility.chiudiModal();

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
                xhrInProcess.abort();

            xhrInProcess = new XMLHttpRequestClient();
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
                                var grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/ + suffix);
                                if (grigliaTemplate == null || !grigliaTemplate.isValid) {
                                    grigliaTemplate = libreria.assets.itemByName(nome_griglia/*+suffisso_lavorazione*/);
                                }
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
                                                    var style = Utility.parseObjStile(stile);
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
                                var grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/ + suffix);
                                if (grigliaTemplate == null || !grigliaTemplate.isValid) {
                                    grigliaTemplate = libreria.assets.itemByName(nome_griglia /*+ suffisso_lavorazione*/);
                                }
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

                    filtriJs.visualizzaHomePageFiltri();

                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();


                }
                catch (ex) {
                    messaggioUtente("Code IDX-27 Filtro: Errore durante l'elaborazione del filtro (Deb1): " + ex, "error");
                    console.error(ex);
                    logContent += "Errore durante l'elaborazione del filtro: " + ex.toString() + "\n";
                    //riattiviamo i bottoni bOpt1 e bOpt2 e rimettiamo il testo originale
                    bOpt1.disabled = false;
                    bOpt2.disabled = false;
                    setFiltroButtonsDefaultMarkup();

                    indesignEvents.setBusy(false);

                }
                finally {
                    rimuoviSimboli();
                    stampaSegnalazioni(reportImpaginazioneObj);

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
                    xhrInProcess.abort();
    
                xhrInProcess = new XMLHttpRequestClient();
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

async function applicaConfronto(mappa, usaListaScaricata = false, report = false) {
    console.log(mappa);
    showLoading("Controllo dei box in pagina per ricerca differenze...");
    await Utility.sleep(10);
    //la mappa ha una struttura:
    //1: (3) [{…}, {…}, {…}]
    //dove la chiave è il numero di pagina, dentro tutte le ref a quella pagina
    //una ref ha poi struttura:
    // bounds: (4)[33.999999999999524, 4.9999981350347795, 112.39999999999935, 70.99999813503479]
    // codice: "5329719"
    // codiceGruppo: "5329719,5365965,5365999,5633416,6344292,6927108,6927146"
    // foto: (3)[{… }, {… }, {… }]
    // infoDescrizione: null
    // match: false
    // pagina: "1"
    // paginaAttuale: "1"
    // puntoCentrale: (2)[37.99999813503478, 73.19999999999945]
    // ref: { }
    // refId: 3466160
    // stato: 1

    //recuperiamo da tutte le pagine tutti i codici gruppo e mettiamoli in un'unica lista

    indesignEvents.setBusy(true);


    var listaCodiciGruppo = [];
    var listaIdRec = [];
    for(var key in mappa){
        var listaRef = mappa[key];
        for(var i=0; i<listaRef.length; i++){
            var ref = listaRef[i];
            var idRecNorm = null;
            if (ref.idRec != null && ref.idRec !== "" && !isNaN(parseInt(ref.idRec))) {
                idRecNorm = parseInt(ref.idRec);
            }

            var esisteGia = false;
            for (var x = 0; x < listaCodiciGruppo.length; x++) {
                if (listaCodiciGruppo[x] === ref.codiceGruppo && listaIdRec[x] === idRecNorm) {
                    esisteGia = true;
                    break;
                }
            }

            if(!esisteGia){
                listaCodiciGruppo.push(ref.codiceGruppo);
                listaIdRec.push(idRecNorm);
            }
        }
    }

    if (listaCodiciGruppo.length == 0) {
        messaggioUtente("Code IDX-40 Confronto: Nessun elemento trovato in pagina", "warning");
        hideLoading();
        indesignEvents.setBusy(false);
        return;
    }

    if(usaListaScaricata){
        //recuperiamo dalla lista scaricata le schedeRefs con i codici gruppo presenti nella listaCodiciGruppo
        var lista = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
        console.log(lista);
        var schedeRefs = [];
        for (var i=0; i<listaCodiciGruppo.length; i++){
            var codiceGruppo = listaCodiciGruppo[i];
            var idRec = listaIdRec[i];
            var records = {
                records: lista.records.filter(r => {
                    var recordCodiceGruppo = r.recordInTracciato["Scatto.CodiceGruppo"] != null ? r.recordInTracciato["Scatto.CodiceGruppo"].toString() : "";
                    if (recordCodiceGruppo !== codiceGruppo) {
                        return false;
                    }

                    if (idRec == null) {
                        return true;
                    }

                    return getIdRecFromItemRef(r.recordInTracciato) === idRec;
                })
            }
            schedeRefs.push(records);
        }

        await impaginaSingoliConfrontati(schedeRefs);
    }
    else{
        getSchedeRefsMassivo(listaCodiciGruppo, listaIdRec, async function(error, schedeRefs){
            await impaginaSingoliConfrontati(schedeRefs);
        });
    }

    async function impaginaSingoliConfrontati(schedeRefs){
        try {
            console.log("Schede refs recuperate per confronto:");
            console.log(schedeRefs);

            if (schedeRefs != null && schedeRefs.length > 0) {
                if (!report) {
                    //cicliamo le schedeRefs
                    CssFramework.richiediDiScaricareFramework();
                }
                var reportObj ={
                    recordCambiati: [],
                    recordUsciti: [],
                    recordConErrori: [],
                    recordGiusti: [],
                    errori : []
                }

                var duplicateGroups = {};
                if (report) {
                    for (var keyDup in mappa) {
                        var listaDup = mappa[keyDup] || [];
                        for (var d = 0; d < listaDup.length; d++) {
                            var refDup = listaDup[d];
                            var idRecDup = refDup.idRec != null && !isNaN(parseInt(refDup.idRec)) ? parseInt(refDup.idRec) : "";
                            var refIdDup = refDup.refId != null ? refDup.refId : "";
                            var dupKey = [refDup.codiceGruppo || "", idRecDup].join("|");
                            if (duplicateGroups[dupKey] == null) {
                                duplicateGroups[dupKey] = [];
                            }
                            duplicateGroups[dupKey].push(refDup);
                        }
                    }

                    for (var dupKey in duplicateGroups) {
                        var gruppoDup = duplicateGroups[dupKey];
                        if (gruppoDup.length <= 1) {
                            continue;
                        }

                        for (var gd = 0; gd < gruppoDup.length; gd++) {
                            gruppoDup[gd].duplicateInfo = {
                                key: dupKey,
                                total: gruppoDup.length,
                                index: gd + 1,
                                refId: gruppoDup[gd].refId != null ? gruppoDup[gd].refId : "",
                                instanceId: dupKey + "|" + (gruppoDup[gd].refId != null ? gruppoDup[gd].refId : "") + "|" + (gd + 1)
                            };
                        }
                    }
                }

                for (var i = 0; i < schedeRefs.length; i++) {
                    var schedaRef = schedeRefs[i];

                    if (schedaRef.records == null || schedaRef.records.length == 0) {
                        //la seguente scheda ref ha riportato un errore o warning. Probabilmente la ref non esiste più nel tracciato
                        //a causa di un cambio di lista.
                        continue;
                    }


                    var codiceGruppo = schedaRef.records[0].recordInTracciato["Scatto.CodiceGruppo"].toString();
                    var idRecScheda = getIdRecFromItemRef(schedaRef.records[0].recordInTracciato);
                    var elementiDaAnalizzare = [];

                    for (var key in mappa) {
                        var listaRef = mappa[key];
                        for (var j = 0; j < listaRef.length; j++) {
                            var ref = listaRef[j];
                            if (ref.codiceGruppo != codiceGruppo) {
                                continue;
                            }

                            var idRecRef = ref.idRec != null && !isNaN(parseInt(ref.idRec)) ? parseInt(ref.idRec) : null;
                            if (idRecScheda != null && idRecRef != null && idRecRef !== idRecScheda) {
                                continue;
                            }

                            elementiDaAnalizzare.push({
                                elMappa: ref,
                                elementoPaginaMappa: listaRef,
                                numeroPagina: key.toString()
                            });
                        }
                    }

                    if (elementiDaAnalizzare.length === 0) {
                        console.log("Mismatch tra schedeRef e mappa durante il confronto per il codice gruppo: " + codiceGruppo);
                    }

                    if (!report && elementiDaAnalizzare.length > 1) {
                        elementiDaAnalizzare = [elementiDaAnalizzare[0]];
                    }

                    for (var em = 0; em < elementiDaAnalizzare.length; em++) {
                        var matchMappa = elementiDaAnalizzare[em];
                        var elMappa = matchMappa.elMappa;
                        var elementoPaginaMappa = matchMappa.elementoPaginaMappa;
                        var numeroPagina = matchMappa.numeroPagina;

                        elMappa.match = true;

                        var resAnalisi = null;
                        if (elementoPaginaMappa != null && numeroPagina != null) {
                            console.log("Impaginazione ref confronto per codice gruppo: " + codiceGruppo + " a pagina " + numeroPagina);
                            resAnalisi = await impaginazioneSingoloIndd(schedaRef.records, numeroPagina, true, elementoPaginaMappa, true, report, null, false, elMappa);
                        }

                        if(report){
                            var recordReport = {
                                elementoMappa: elMappa,
                                inddId: elMappa.refId != null ? elMappa.refId : null,
                                codiceGruppo: codiceGruppo,
                                schedaRef: schedaRef,
                                preAnalisi: resAnalisi,
                                numeroPagina: numeroPagina,
                                elementoPaginaMappa: elementoPaginaMappa
                            }

                            if (elMappa.duplicateInfo != null) {
                                recordReport.duplicateInfo = {
                                    key: elMappa.duplicateInfo.key,
                                    total: elMappa.duplicateInfo.total,
                                    index: elMappa.duplicateInfo.index,
                                    refId: elMappa.duplicateInfo.refId,
                                    instanceId: elMappa.duplicateInfo.instanceId,
                                    resolvedCount: 0
                                };
                            }

                            if (recordReport.duplicateInfo != null) {
                                if (resAnalisi == null) {
                                    resAnalisi = { differenze: [], errors: [] };
                                    recordReport.preAnalisi = resAnalisi;
                                }

                                resAnalisi.differenze = resAnalisi.differenze || [];
                                resAnalisi.differenze.push({
                                    label: "Duplicato",
                                    difference: "box duplicato: istanza " + recordReport.duplicateInfo.index + " di " + recordReport.duplicateInfo.total
                                });
                            }

                            if (recordReport.duplicateInfo != null) {
                                reportObj.recordCambiati.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.errors.length > 0) {
                                reportObj.recordConErrori.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.differenze.length > 0) {
                                reportObj.recordCambiati.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.differenze.length == 0) {
                                reportObj.recordGiusti.push(recordReport);
                            }
                        }
                    }
                }

                //adesso scorriamo tutte le ref in mappa e vediamo quali non sono state processate (match = false) e gli applichiamo
                // Utility.addBollinoCustom(ref, "Dif", "orange", null, 1, null);
                for (var key in mappa) {
                    var listaRef = mappa[key];
                    for (var i = 0; i < listaRef.length; i++) {
                        var ref = listaRef[i];
                        if (!ref.match) {
                            if(report){
                                //lo aggiungiamo ai record usciti
                                var recordUscito = {
                                    elementoMappa: ref,
                                    inddId: ref.refId != null ? ref.refId : null,
                                    codiceGruppo: ref.codiceGruppo,
                                    schedaRef: null,
                                    preAnalisi: null,
                                    numeroPagina: key,
                                    elementoPaginaMappa: listaRef
                                };

                                if (ref.duplicateInfo != null) {
                                    recordUscito.duplicateInfo = {
                                        key: ref.duplicateInfo.key,
                                        total: ref.duplicateInfo.total,
                                        index: ref.duplicateInfo.index,
                                        refId: ref.duplicateInfo.refId,
                                        instanceId: ref.duplicateInfo.instanceId,
                                        resolvedCount: 0
                                    };
                                }

                                reportObj.recordUsciti.push(recordUscito);
                            }
                            else{
                                //mettiamo il bollino con la X
                                ref.ref = Utility.addBollinoCustom(ref.ref, "X", "red", null, 1, null);
                            }
                        }
                    }
                }


                hideLoading();
                console.log(reportObj);
                //creiamo un file con il reportObj in output
                if(report){
                    var reportFilePath = confronti._getReportIntegritaFilePath ? confronti._getReportIntegritaFilePath(idKitLavorazione) : pathLavorazione + "/reportIntegrita_" + idKitLavorazione + ".json";
                    messaggioUtente("Report confronto creato con successo: " + reportFilePath, "success", false, 10);
                    confronti.compilaReportConfronto(reportObj);
                }
                else{
                    indesignEvents.setBusy(false);
                }
            }
        }
        catch (ex) {
            console.error(ex);
            messaggioUtente("Code IDX-41 Errore generico durante l'impaginazione del confronto: " + ex.toString(), "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
    }
}



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
    
        var confirmRes = await Utility.confirm("Ridimensionare il box alle dimensioni desiderate");


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
    segnalazioniBoxImpaginato.push({ msg: msg, typeMessage: typeMessage, priority: priority, applicaBollino: applicaBollino, impostazioniBollino: impostazioniBollino, key: key });
}

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
    //ora applichiamo i bollini ai box che li richiedono, prendiamo solo il primo bollino che troviamo nelle segnalazioni (ovvero quello con priorità maggiore (ovvero valore più basso))
    for (var i = 0; i < segnalazioni.length; i++) {
        if (segnalazioni[i].applicaBollino && boxImpaginato != null) {
            var impostazioni = segnalazioni[i].impostazioniBollino;
            //prima di aggiungere il bollino dobbiamo "Allungare il testo" in coda per farlo andare in overflow, in questo modo l'operatore potrà vedere la segnalazione di indesign
            impostazioni[0] = impostazioni[0] + " (Testo per mandare in overflow)";
            boxImpaginato = Utility.addBollinoCustom(boxImpaginato, impostazioni[0], impostazioni[1], impostazioni[2], impostazioni[3], impostazioni[4], impostazioni[5]);
            break;
        }
    }

    //svuotiamo le segnalazioni
    segnalazioniBoxImpaginato = [];
    return boxImpaginato;
}

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
            var res = CssFramework.getSpazioImpaginazione(boxImpaginato);
            CssFramework.fixFoto(boxImpaginato, res.candidate, res.obstacles);
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

function makeRegexFromGroupName(groupName) {
    // Escapa i caratteri speciali, tranne *
    let escaped = groupName.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    // Converte * in .*
    let regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr);
}


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
                                                let deleteField = itemRef.deletedFields.find(f => makeRegexFromGroupName(f).test(lab_field));
    
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
                                                let deleteField = itemRef.deletedFields.find(f => makeRegexFromGroupName(f).test(lab_field));
    
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
                                            
                                            let matchFieldData = itemRef.compiledFields.find(f => makeRegexFromGroupName(f.labelName).test(lab_field));
                                            let deleteField = itemRef.deletedFields.find(f => makeRegexFromGroupName(f).test(lab_field));
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
                                                        let contentObj = Utility.parseContent(content);
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
    
                                                        let stile = (Utility.parseStile != null ? Utility.parseStile(parag, true) : null);
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
                                                        Utility.applicaTagStringToInndTextFrame(field, content, bounds);
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
                                    for (var ij = 0; ij < itemRef["Foto.ExtraAuto"].length; ij++) {
    
                                        if (itemRef["Foto.ExtraAuto"][ij].escluso == true) {
                                            continue;
                                        }
    
                                        if((itemRef["Foto.ExtraAuto"][ij].tipo != 5)){
                                            var imgName = itemRef["Foto.ExtraAuto"][ij].nome;
                                            var sigla = itemRef["Foto.ExtraAuto"][ij].sigla;
                                            var tipo = itemRef["Foto.ExtraAuto"][ij].tipo;
                                            var path = /*pathLavorazione +*/ percorsoLoghi + imgName;
                                            //Controllo esstensine
                                            //idms rappresenta un eccezione
                                            //Deve essere caricato SOLO 1 VOLTA ew piazzato nella prima pagina in alto a sx
                                            if (imgName.split(".")[1] == "idms") {
        
                                                let syObj = null;
                                                if (cacheLoghi[sigla] == null || !cacheLoghi[sigla].isValid) {
                                                    //Cerco in pagina 1 se ho già impaginato il simbolo
                                                    var pag0 = doc.pages.item(0);
                                                    for (var i2 = 0; i2 < pag0.allPageItems.length; i2++) {
                                                        var item = pag0.allPageItems[i2];
                                                        if (item.label == "simbolo$" + sigla + "$tipo_" + tipo) {
                                                            cacheLoghi[sigla] = item;
                                                            break;
                                                        }
                                                    }
        
                                                    if (cacheLoghi[sigla] == null || !cacheLoghi[sigla].isValid) {
                                                        let objDms = doc.pages.item(0).place(path, [0, 0], doc.layers.itemByName("InPagina"));
                                                        objDms.label = "simbolo$" + sigla + "$tipo_" + tipo;
                                                        cacheLoghi[sigla] = objDms[0];
                                                    }
                                                }
                                                syObj = cacheLoghi[sigla];
                                                var sy = syObj.duplicate(pagCoinvolta);
                                                sy.move(doc.layers.itemByName("InPagina"));
                                                //muoviamo sy nell'angolo in alto a sinistra del box
                                                sy.move([boxImpaginato.visibleBounds[1], boxImpaginato.visibleBounds[0]]);
                                                itemRef["Foto.ExtraAuto"][ij].referenceTo = sy;
                                                elementiDaGruppare.push(sy);
                                                sy.label = "foto_extra$" + sigla + "$tipo_" + tipo
                                                sy.bringToFront();
                                            }
                                            else {
                                                var rect = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, boxImpaginato, { geometricBounds: boxImpaginato.geometricBounds })
                                                elementiDaGruppare.push(rect);
                                                rect.label = "foto_extra$" + sigla + "$tipo_" + tipo;
                                                rect.place(path);
                                                //rect.fit(FitOptions.FRAME_TO_CONTENT);
                                                //Alessio: Ho ripristinato questo al posto di FRAME_TO_CONTENT perchè in Despar faceva un macelllo con i loghi che costringevano il frame ad adattarsi.
                                                //non possiamo permettergli di farlo, se questa cosa era stata fatta per Edro21 va ritestata e capita una misura comune
                                                let fitType = FitOptions.CONTENT_TO_FRAME;
                                                if(pluginMiddleware.getFitTypeLogo != null){
                                                    fitType = pluginMiddleware.getFitTypeLogo(sigla, tipo);
                                                }
                                                if (fitType != null) {
                                                    rect.fit(fitType);
                                                    rect.fit(FitOptions.PROPORTIONALLY);
                                                }
                                                //rect.fillColor = "None";
                                                itemRef["Foto.ExtraAuto"][ij].referenceTo = rect;
                                            }
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

function clearFile(filePath) {
    fs.writeFileSync(filePath, "");
}

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

function sincronizzaBoxGriglia(val, boxNumber, boxHtml, griglia) {
    boxNumber = parseInt(boxNumber);
    if (griglia != null) {
        var box = grigliaJs.getBoxByNumber(griglia, boxNumber);
        if (box != null && box.isValid) {
            if (boxHtml.find("sp-picker").attr("lastValue") == "Bloccato" && val != "Bloccato") {
                if (boxHtml.attr("linkedBox") != null) {
                    var linkedBox = $("#" + boxHtml.attr("linkedBox"));
                    linkedBox.find("sp-picker").attr("lastValue", "Vuoto");
                    Utility.setPickerValue(linkedBox.find("sp-picker"), "Vuoto");
                    boxHtml.attr("linkedBox") == null;
                }
            }
            else if (boxHtml.find("sp-picker").attr("lastValue") == "2v" && val != "2v") {
                $("#grigliaController").find(".box").each(function () {
                    var id = boxHtml.attr("id");
                    if ($(this).attr("linkedBox") == id) {
                        $(this).attr("linkedBox", null);
                        $(this).find("sp-picker").attr("lastValue", "Vuoto");
                        Utiliy.setPickerValue($(this).find("sp-picker"), "Vuoto");
                    }
                });

                var RigaBox = grigliaJs.getBoxListByRiga(boxHtml.attr("riga"));
                var currentBox = RigaBox.find(box => $(box).attr("id") === "box_" + boxNumber);

                var RigaSuccessiva = grigliaJs.getBoxListByRiga((parseInt(boxHtml.attr("riga")) + 1).toString());
                if (RigaBox.length > 1 && RigaBox.length == RigaSuccessiva.length) {


                    var nextBoxNumber = RigaSuccessiva[RigaBox.indexOf(currentBox)];
                    var nextBox = grigliaJs.getBoxByNumber(checkCurrentSelection(), $(nextBoxNumber).attr("id").split("_")[1]);
                    var previousBoxLock = grigliaJs.getChildBoxByLabel(nextBox, "no");


                    if (previousBoxLock.visible) {
                        previousBoxLock.visible = false;
                        Utiliy.setPickerValue(nextBoxNumber.find("sp-picker"), "Vuoto");
                    }
                }
            }
            else if (boxHtml.find("sp-picker").attr("lastValue") == "2o" && val != "2o") {
                $("#grigliaController").find(".box").each(function () {
                    var id = boxHtml.attr("id");
                    if ($(this).attr("linkedBox") == id) {
                        $(this).attr("linkedBox", null);
                        $(this).find("sp-picker").attr("lastValue", "Vuoto");
                        Utiliy.setPickerValue($(this).find("sp-picker"), "Vuoto");
                    }
                });
                var RigaBox = grigliaJs.getBoxListByRiga(boxHtml.attr("riga"));
                var currentBox = RigaBox.find(box => $(box).attr("id") === "box_" + boxNumber);
                var rightBoxIndex = RigaBox.indexOf(currentBox) + 1;
                var rightBox = rightBoxIndex < RigaBox.length ? RigaBox[rightBoxIndex] : null;
                console.log("rightbox " + rightBox);
                if (rightBox != null) {
                    console.log((RigaBox.length * parseInt(boxHtml.attr("riga")) + rightBoxIndex + 1));
                    var nextBox = grigliaJs.getBoxByNumber(checkCurrentSelection(), (RigaBox.length * parseInt(boxHtml.attr("riga"))) + rightBoxIndex + 1);
                    var previousBoxLock = grigliaJs.getChildBoxByLabel(nextBox, "no");

                    if (previousBoxLock.visible) {
                        previousBoxLock.visible = false;
                        Utiliy.setPickerValue(rightBox.find("sp-picker"), "Vuoto");
                    }
                }
            }




            if (val == "Vuoto") {
                grigliaJs.getChildBoxByLabel(box, "no").visible = false;
                grigliaJs.getChildBoxByLabel(box, "h").visible = false;
                grigliaJs.getChildBoxByLabel(box, "v").visible = false;
                Utiliy.setPickerValue(boxHtml.find("sp-picker"), val);
            }
            else if (val == "Bloccato") {
                grigliaJs.getChildBoxByLabel(box, "no").visible = true;
                grigliaJs.getChildBoxByLabel(box, "h").visible = false;
                grigliaJs.getChildBoxByLabel(box, "v").visible = false;
                Utiliy.setPickerValue(boxHtml.find("sp-picker"), val);
            }
            else if (val == "2v") {
                var lunghezzaRiga1 = grigliaJs.getBoxListByRiga(boxHtml.attr("riga")).length;
                var lunghezzaRiga2 = grigliaJs.getBoxListByRiga((parseInt(boxHtml.attr("riga")) + 1).toString()).length;
                if (lunghezzaRiga1 == lunghezzaRiga2 && lunghezzaRiga1 > 0) {
                    var otherBox = grigliaJs.getBoxByNumber(checkCurrentSelection(), parseInt(boxNumber) + lunghezzaRiga1);
                    var otherBoxHeight = grigliaJs.getChildBoxByLabel(otherBox, "h");
                    var otherBoxLocked = grigliaJs.getChildBoxByLabel(otherBox, "no");
                    var otherBoxWidth = grigliaJs.getChildBoxByLabel(otherBox, "v");
                    if (otherBoxHeight.visible == false && otherBoxLocked.visible == false && otherBoxWidth.visible == false) {
                        otherBoxLocked.visible = true;
                        grigliaJs.getChildBoxByLabel(box, "h").visible = true;
                        grigliaJs.getChildBoxByLabel(box, "no").visible = false;
                        grigliaJs.getChildBoxByLabel(box, "v").visible = false;
                        console.log($("#box_" + (parseInt(boxNumber) + lunghezzaRiga1)).find("sp-picker"));
                        Utiliy.setPickerValue($("#box_" + (parseInt(boxNumber) + lunghezzaRiga1)).find("sp-picker"), "Bloccato");
                        $("#box_" + (parseInt(boxNumber) + lunghezzaRiga1)).attr("linkedBox", boxHtml.attr("id"));
                        Utiliy.setPickerValue(boxHtml.find("sp-picker"), val);
                    }
                    else {
                        //debugMessage("Non posso mettere 2v, box sottostante occupato", 5000);
                        Utiliy.setPickerValue(boxHtml.find("sp-picker"), boxHtml.find("sp-picker").attr("lastValue"));
                    }

                }
                else {
                    //debugMessage("Non posso mettere 2v, lunghezza righe diverse", 5000);
                    Utiliy.setPickerValue(boxHtml.find("sp-picker"), boxHtml.find("sp-picker").attr("lastValue"));
                }
            }
            else if (val == "2o") {
                var lunghezzaRiga = grigliaJs.getBoxListByRiga(boxHtml.attr("riga")).length;
                if (lunghezzaRiga > parseInt(boxNumber) - (parseInt(boxHtml.attr("riga")) * lunghezzaRiga)) {
                    var otherBox = grigliaJs.getBoxByNumber(checkCurrentSelection(), parseInt(boxNumber) + 1);
                    var otherBoxHeight = grigliaJs.getChildBoxByLabel(otherBox, "h");
                    var otherBoxLocked = grigliaJs.getChildBoxByLabel(otherBox, "no");
                    var otherBoxWidth = grigliaJs.getChildBoxByLabel(otherBox, "v");
                    if (otherBoxHeight.visible == false && otherBoxLocked.visible == false && otherBoxWidth.visible == false) {
                        otherBoxLocked.visible = true;
                        grigliaJs.getChildBoxByLabel(box, "v").visible = true;
                        grigliaJs.getChildBoxByLabel(box, "no").visible = false;
                        grigliaJs.getChildBoxByLabel(box, "h").visible = false;
                        console.log($("#box_" + (parseInt(boxNumber) + 1)).find("sp-picker"));
                        Utiliy.setPickerValue($("#box_" + (parseInt(boxNumber) + 1)).find("sp-picker"), "Bloccato");
                        $("#box_" + (parseInt(boxNumber) + 1)).attr("linkedBox", boxHtml.attr("id"));
                        Utiliy.setPickerValue(boxHtml.find("sp-picker"), val);
                    }
                    else {
                        //debugMessage("Non posso mettere 2o, box a destra occupato", 5000);
                        Utiliy.setPickerValue(boxHtml.find("sp-picker"), boxHtml.find("sp-picker").attr("lastValue"));
                    }

                }
                else {
                    //debugMessage("Non posso mettere 2o, riga terminata", 5000);
                    Utiliy.setPickerValue(boxHtml.find("sp-picker"), boxHtml.find("sp-picker").attr("lastValue"));
                }
            }
        }
    }
}

function replaceAll(str, stringToReplace, replacement) {
    try {
        while (str.indexOf(stringToReplace) != -1) {
            str = str.replace(stringToReplace, replacement);
        }
        return str;
    }
    catch (e) {
        console.log(e);
        return str;
    }
}


tracciatoVisualizzato = false;
lastWidthDimension = 0;
lastHeightDimension = 0;

//da ripristinare
function escludiRef(boxNumber, button) {
    console.log(boxNumber);
    //controlliamo che la current selection sia una griglia
    if (checkCurrentSelection().label.indexOf("griglia") == -1) {
        messaggioUtente("Code IDX-60 escludiRef: Non è stata selezionata una griglia", "error");
        return;
    }
    //cerchiamo il box con il numero passato come parametro nella griglia 
    var box = null;
    box = grigliaJs.getBoxByNumber(checkCurrentSelection(), boxNumber);
    if (box.isValid) {
        //otteniamo il codice cercando tra i suoi figli la label.split("$")[0] == "info", il codice è la label.split("$")[1]
        var codice = null;
        var infoContent = null;
        for (var i = 0; i < box.allPageItems.length; i++) {
            if (box.allPageItems[i].label.split("$")[0] == "info") {
                if (box.allPageItems[i].label == "info") {
                    messaggioUtente("Code IDX-61 escludiRef: Il box non contiene nessun elemento", "error");
                    return;
                }
                codice = box.allPageItems[i].label.split("$")[1];
                infoContent = box.allPageItems[i].contents;
                break;
            }
        }
        //prendiamo solo la prima riga del contenuto
        infoContent = infoContent.split("\n")[0];
        console.log(codice);
        console.log(infoContent);

        //scriviamo il file pathLavorazione + "/listaRefEscluse.json" aggiungendo alla chiave Lista un record della lista con il codice e infoContent, se la chiave Lista non esiste la creiamo
        var filePath = pathLavorazione + "/listaRefEscluse.json";
        var data = readFile(filePath);
        if (data == null) {
            //creiamo il file con la chiave Lista e il record
            var obj = {
                Codice: codice,
                Info: infoContent,
                BoxNumber: boxNumber
            }
            appendToFile(filePath, JSON.stringify(obj));

            //modifichiamo il colore del bottone in tomato e la scritta in escluso
            button.css("backgroundColor", "tomato");
            button.text("Escluso");

            //svuotiamo il contenuto di info nel box con info$ e mettiamo il testo "Escluso"
            for (var i = 0; i < box.allPageItems.length; i++) {
                if (box.allPageItems[i].label.startsWith("info")) {
                    var myColor = docInLavorazione.colors.itemByName("Red");
                    if (myColor == null|| myColor.isValid == false) {
                        myColor = docInLavorazione.colors.add({ name: "Red", model: ColorModel.process, colorValue: [0, 100, 20, 20] });
                    }
                    // Change the text color
                    box.allPageItems[i].fillColor = myColor;
                    //box.allPageItems[i].contents = "Escluso";
                    break;
                }
            }

        }
        else {
            //se la chiave Lista esiste controlliamo se il record esiste già, se esiste non facciamo nulla, altrimenti lo aggiungiamo
            var found = false;
            for (var i = 0; i < data.length; i++) {
                var obj = JSON.parse(data[i]);
                if (obj.Codice == codice) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                var obj = {
                    Codice: codice,
                    Info: infoContent,
                    BoxNumber: boxNumber
                }
                appendToFile(filePath, JSON.stringify(obj));
                //modifichiamo il colore del bottone in tomato e la scritta in escluso
                console.log(button);
                button.css("backgroundColor", "tomato");
                button.text("Escluso");

                for (var i = 0; i < box.allPageItems.length; i++) {
                    if (box.allPageItems[i].label.startsWith("info")) {
                        var myColor = docInLavorazione.colors.itemByName("Red");
                        if (myColor == null|| myColor.isValid == false) {
                            myColor = docInLavorazione.colors.add({ name: "Red", model: ColorModel.process, colorValue: [0, 100, 20, 20] });
                        }
                        // Change the text color
                        box.allPageItems[i].fillColor = myColor;
                        //box.allPageItems[i].contents = "Escluso";
                        break;
                    }
                }
            }
        }
        compilaTabElementiEsclusi();
    }

}
//da ripristinare
function ripristinaElemento(codice, info) {
    //scarichiamo il json delle ref escluse
    var filePath = pathLavorazione + "/listaRefEscluse.json";
    var data = readFile(filePath);
    if (data == null) {
        messaggioUtente("Code IDX-62 ripristinaElemento: Errore, il file listaRefEscluse.json non esiste", "error");
        return;
    }
    //cerchiamo il record con codice uguale a quello passato come parametro e lo rimuoviamo dal file e riscriviamo il file
    boxNumber = -1;
    for (var i = 0; i < data.length; i++) {
        var obj = JSON.parse(data[i]);
        if (obj.Codice == codice) {
            boxNumber = obj.BoxNumber;
            data.splice(i, 1);
            console.log(data);
            fs.writeFileSync(filePath, JSON.stringify(data));
            break;
        }
    }

    compilaTabElementiEsclusi();
    if (checkCurrentSelection().label.indexOf("griglia") != -1) {
        abilitaEDisabilitaPulsantiInBaseAllaSelezione();
        creaGriglia(checkCurrentSelection());
        //troviamo il box con il codice uguale a quello passato come parametro e mettiamo il testo info nel box con label info
        var box = grigliaJs.getBoxByNumber(checkCurrentSelection(), boxNumber);
        if (box != null) {
            for (var i = 0; i < box.allPageItems.length; i++) {
                if (box.allPageItems[i].label.startsWith("info")) {
                    if (box.allPageItems[i].label.split("$").length > 1 && box.allPageItems[i].label.split("$")[1] == codice) {
                        var myColor = docInLavorazione.swatches.item("None");
                        box.allPageItems[i].fillColor = myColor;
                    }
                    break;
                }
            }
        }
    }


}

//da ripristinare
function compilaTabElementiEsclusi() {

    //cerchiamo un file json chiamato listaRefEscluse.json e lo leggiamo, se non c'è lo creiamo vuoto
    var filePath = pathLavorazione + "/listaRefEscluse.json";
    var data = readFile(filePath);
    if (data != null) {
        $("#ElementiEsclusi").empty();
        for (var $i = 0; $i < data.length; $i++) {
            //facciamo il parse e per ogni elemento creiamo una riga contenente il codice fra parentesi e la descrizione scritta in $(#ElementiEsclusi)
            var item = JSON.parse(data[$i]);
            var codice = item["Codice"];
            //arrotondiamo il codice alle prime 20 cifre se più lungo, altrimenti lo lasciamo così, se arrotondato si mette ... alla fine
            if (codice.length > 20) {
                codice = codice.substring(0, 20) + "...";
            }
            var Info = item["Info"];
            //creiamo la row, il testo deve essere bianco per le righe dispari e verde per le pari
            var htmlRow = '<div class="row align-items-center" style="margin-bottom: 10px;">' +
                '<span style="color: ' + ($i % 2 == 0 ? 'lightgreen' : 'white') + '; font-size:12px;">(' + codice + ') ' + Info + '</span>';
            //aggiungiamo il pulsante copia e il pulsante ripristina
            var copyButton = '<button class="copiaElemento" codice="' + item["Codice"] + '">Copia</button>';
            htmlRow += copyButton;
            var ripristinaButton = '<button class="ripristinaElemento" codice="' + item["Codice"] + '" info="' + item["Info"] + '">Ripristina</button>';
            htmlRow += ripristinaButton;
            htmlRow += '</div>';
            $("#ElementiEsclusi").append(htmlRow);
            if ($i < data.length - 1) {
                $("#ElementiEsclusi").append('<hr>');
            }
        }
        //aggiungiamo la funziona di copia del codice nella clipboard
        $(".copiaElemento").on('click', function () {
            navigator.clipboard.writeText({ 'text/plain': $(this).attr("codice") });
        });

        //aggiungiamo la funzione di ripristina dell'elemento
        $(".ripristinaElemento").on('click', function () {
            ripristinaElemento($(this).attr("codice"), $(this).attr("info"));
        });

    }
    else {
        $("#ElementiEsclusi").empty();
        $("#ElementiEsclusi").append('<div class="row align-items-center" style="margin-bottom: 10px; color:white"><h4> Nessun elemento escluso </h4></div>');
    }
}

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
                var resConfirm = await Utility.confirmRimozioneRef(codiciGruppo);
    
                if (!resConfirm.confermato) {
                    return;
                }
    
                if (resConfirm.eliminaDaTracciato) {
                    console.log("Da eliminare dal tracciato:", resConfirm.codici);
                    eliminaDaTracciato = true;
                }
            }
            else {
                var resConfirn = await Utility.confirm("Procedere alla rimozione dall'impaginato?");
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

function decodificaNomeFile(){
    //leggiamo il nome del fil indd aperto
    var nomeFile = docInLavorazione.name;

    //qui ci sarà roba che per ora non c'è

    return{
        promo: "A2515_SC_27-06-25",
        canale: "SC",
        area: "TO",
        formato: null
    }
}

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

function showLoading(msg)//Facoltativo
{

    $("#loadingPanel").show();
    
    if (msg!=null)
    {
        $("#loadingPanel").find("h1").text(msg);
    }
    else
    {
        Default
        $("#loadingPanel").find("h1").text("Caricamento in corso...");
    }
    Utility.nascondiHidebleElements();

}

function hideLoading() {
    $("#loadingPanel").hide();
    Utility.mostraHidebleElements();
}

function clearInfo()
{
    $("#FiltroRicercaTracciato").empty();    
    $("#TuttiElementiTracciato").empty();
    $("#ImpaginatiTracciato").empty();
    $("#NonImpaginatiTracciato").empty();
    $("#dataScaricamentoTracciato").remove();
}

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
        optionsBox.push({ value: "confronto", label: "Fix integrità" });
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

        if (boxVal === "report_confronto" && confronti.leggiReportIntegritaLocale) {
            const reportLocale = confronti.leggiReportIntegritaLocale(idKitLavorazione);
            if (reportLocale != null) {
                const azioneReport = await confronti.richiediAzioneReportIntegritaEsistente(reportLocale);
                if (azioneReport === "open") {
                    confronti.compilaReportConfronto(reportLocale.report, {
                        wrapper: reportLocale,
                        skipSave: true,
                        activeList: "report",
                        activeTab: 0
                    });
                    return;
                }

                if (azioneReport === "cancel") {
                    return;
                }
            }
        }

        var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
        var fileRecente = false;

        if (file != null) {
            const dataScaricamento = file["DataScaricamento"];

            function parseITDateTime(s) {
                const [datePart, timePart] = s.split(",").map(p => p.trim());
                const [dd, mm, yyyy] = datePart.split("/").map(Number);
                const [HH, MM, SS] = timePart.split(":").map(Number);
                return new Date(yyyy, mm - 1, dd, HH, MM, SS);
            }

            if (dataScaricamento != null) {
                const dataScaricamentoDate = parseITDateTime(dataScaricamento);
                const diffMinutes = (new Date() - dataScaricamentoDate) / (1000 * 60);
                if (diffMinutes < 60) {
                    fileRecente = true;
                }
            }
        }

        if (fileRecente && boxVal != "none") {
            var res = await Utility.confirmCustom(
                "La lista degli elementi è stata scaricata meno di un'ora fa, vuoi utilizzare la lista recente?",
                "Usa lista",
                "1",
                "Riscarica",
                "2"
            );

            if (res.hiddenVal == "2") {
                fileRecente = false;
            } else if (res.hiddenVal != "1") {
                return;
            }

            console.log(res);
        }

        let mappa = null;

        showLoading("Calcolo pagine in corso...");
        await Utility.sleep(100);

        var rangePagine = "";

        if (boxVal != "none") {
            for (var i = 0; i < docInLavorazione.pages.length; i++) {
                var page = docInLavorazione.pages.item(i);
                console.log(page);
                var pageNum = parseInt(page.name);

                if (!isNaN(pageNum)) {
                    if (rangePagine.length > 0) {
                        rangePagine += ",";
                    }
                    rangePagine += pageNum;
                }
            }

            console.log("Range pagine: " + rangePagine);

            confronti.mappaturaImpaginato(rangePagine, false, false).then(result => {
                mappa = result;
            });
        }

        if (!fileRecente && boxVal != "none") {
            scaricaContenutoKit(idKitLavorazione, true, async function () {
                await operazioniControlloIntegrita();
            });
        } else {
            await operazioniControlloIntegrita();
        }

        async function operazioniControlloIntegrita() {
            if (boxVal === "none") {
                return;
            }

            if (boxVal != "none") {
                indesignEvents.setBusy(true);

                let counter = 600;
                if (fileRecente) {
                    counter += 3000;
                }

                let attesa = 0;

                if (mappa == null) {
                    showLoading("In attesa della mappatura dell'impaginato...");
                    await Utility.sleep(1);
                }

                while (mappa == null && counter > 0) {
                    if (mappa != null) {
                        break;
                    }

                    if (attesa >= 600) {
                        showLoading("La mappatura dell'impaginato sta richiedendo più tempo del previsto, tempo rimanente prima del timeout: " + (counter) / 10 + " secondi...");
                        await Utility.sleep(1);
                    }

                    await Utility.sleep(100);
                    counter--;
                    attesa++;
                }

                if (mappa == null) {
                    messaggioUtente("Code IDX-84 Timeout scaduto durante la generazione della mappa per il sync delle pagine.", "error");
                    await Utility.sleep(1);
                    indesignEvents.setBusy(false);
                    return;
                }

                showLoading("Inizio sync numeri di pagina...");
                await Utility.sleep(10);

                let preAnalisiMismatchNumeriPagina = await confronti.preAnalisiMismatchNumeriPagina(rangePagine, mappa);
                if (preAnalisiMismatchNumeriPagina == null) {
                    messaggioUtente("Code IDX-85 PreAnalisi di confronto fallita", "error", false, 10);
                    hideLoading();
                    return;
                }

                var statoRes = await confronti.syncImpaginatoConServer(mappa, preAnalisiMismatchNumeriPagina, true);
                if (statoRes == null) {
                    messaggioUtente("Code IDX-86 Sync con server fallita", "error", false, 10);
                    hideLoading();
                    indesignEvents.setBusy(false);
                    return;
                }

                messaggioUtente("Code IDX-87 Sync pagine con server completata con successo", "success", false, 2);
                showLoading("Code IDX-87 Sync pagine con server completata con successo");
                await Utility.sleep(1000);
            }

            if (boxVal != "none") {
                let counter = 600;
                if (fileRecente) {
                    counter += 3000;
                }

                var attesa = 0;

                if (mappa == null) {
                    showLoading("In attesa della mappatura dell'impaginato...");
                    await Utility.sleep(1);
                }

                while (mappa == null && counter > 0) {
                    if (mappa != null) {
                        break;
                    }

                    if (attesa >= 600) {
                        showLoading("La mappatura dell'impaginato sta richiedendo più tempo del previsto, tempo rimanente prima del timeout: " + (counter) / 10 + " secondi...");
                        await Utility.sleep(1);
                    }

                    await Utility.sleep(100);
                    counter--;
                    attesa++;
                }

                if (mappa == null) {
                    messaggioUtente("Code IDX-84 Timeout scaduto durante la generazione della mappa per il sync delle pagine.", "error");
                    hideLoading();
                    indesignEvents.setBusy(false);
                    return;
                }

                showLoading("Inizio confronto box...");
                await Utility.sleep(100);
                await applicaConfronto(mappa, true, boxVal == "report_confronto");
            }
        }
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

        const frag = $(document.createDocumentFragment());
        var first = true;
        recordsDaMostrare.forEach(record => {
            frag.append(creaElementoTracciato(record, first));
            first = false;
        });

        $body.append(frag);

        await Utility.sleep(50);
        onResizeTab1Tracciato();
    } catch (e) {
        console.error(e);
    }
}

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

function applicaLarghezzaCella($cell, width) {
    $cell.css({
        width: width + "px",
        minWidth: width + "px",
        maxWidth: width + "px",
        flex: "0 0 " + width + "px"
    });
}


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

function getDescrizioneRecordTracciato(record) {
    var sorgenteDescrizione = record.descrizione_gruppo != null ? record.descrizione_gruppo : record;

    return [
        sorgenteDescrizione["Descrizioni.Descrizione1"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione2"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione3"] || "",
        sorgenteDescrizione["Descrizioni.Descrizione4"] || ""
    ].filter(Boolean).join(" | ");
}

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

    return await Utility.confirm($container);
}

function creaElementoTracciato(obj, isFirst) {
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
                    backgroundColor: "rgb(45,140,235)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "11px"
                }).text(obj.paginaImpaginazione);

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


async function impaginazioneSingoloIndd(records, pagina, cercaInPaginaPerConfronto, mappaPagina, massiveOperation = false, getPreAnalisi = false, bounds = null, richiederRicollegamento = false, elementoMappaTarget = null) {
    try {
        var primario = records.find(f => f.recordInTracciato["StatoSelezione"] == 1);
        if (primario == null) {
            messaggioUtente("Code IDX-95 Impaginazione singolo: Nessun elemento primario trovato nel gruppo", "error");
            return;
        }

        var boundsSpecifici = bounds != null;

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
        //i bounds avranno l'angolo sinistro superiore in 0,0 e l'angolo inferiore destro in larghezza,altezza pari ad 1/3 della pagina
        //[0, 0, (docInLavorazione.documentPreferences.pageHeight / 4), docInLavorazione.documentPreferences.pageWidth / 4];
        let tipo_lavorazione_corrente = ficoProcess.getTipoLavorazioneCorrente();

        var originalBox = null;
        //se c'è una mappa cerchiamo l'elemento target, oppure il primo con codice gruppo uguale al primario
        if (mappaPagina != null) {
            let elementoMappa = elementoMappaTarget || mappaPagina.find(el => el.codiceGruppo == primario.recordInTracciato["Scatto.CodiceGruppo"]);
            
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
            var compiledField = tracciatoPrimario.compiledFields;
            var deletedFields = tracciatoPrimario.deletedFields;
            var fotoExtra = tracciatoPrimario["Foto.Extra"];
            var fotoExtraAuto = tracciatoPrimario["Foto.ExtraAuto"];
            let listaFoto = [];
            if (tracciatoPrimario.membriGruppoFoto != null)
                listaFoto = tracciatoPrimario.membriGruppoFoto
                    .filter(membro => membro.nomeFoto && membro.statoSelezione == 2)
                    .map(membro => {
                        return {
                            nomeFoto: membro.nomeFoto,
                            hash: membro.hash
                        };
                    });

            if (tracciatoPrimario["Foto.Nome"] != ""){
                listaFoto.push({
                    nomeFoto: tracciatoPrimario["Foto.Nome"],
                    hash: tracciatoPrimario["Foto.Hash"]
                });
            }

            var preAnalisi = await confronti.confrontoBoxCompiledFieldPreAnalisi(originalBox, compiledField, deletedFields, listaFoto, fotoExtra, fotoExtraAuto, true,
                NoRenderElementi.elencoPerSegnalazioni(tracciatoPrimario.noRenderElementi, tracciatoPrimario.membriGruppoFoto));

            if(getPreAnalisi){
                return preAnalisi;
            }

            if (preAnalisi != null && preAnalisi.differenze.length == 0) {
                return originalBox;
            }

        }
        
        if(getPreAnalisi){
            return null;
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

        var logPath = /*pathLavorazione +*/ percorsoLogs;

        var date = new Date();
        var logMessage = {
            data: formatTwoDigits(date.getDate()) + "/" + formatTwoDigits((date.getMonth() + 1)) + "/" + date.getFullYear(),
            orario: formatTwoDigits(date.getHours()) + ":" + formatTwoDigits(date.getMinutes()) + ":" + formatTwoDigits(date.getSeconds()),
            stile: style,
            msg: msg
        };

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
        $("#messaggiUtente"+(modal?"Modal":"")).append(html);
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

        var logPath = pathLavorazione + percorsoLogs;

        var date = new Date();
        var logMessage = {
            data: formatTwoDigits(date.getDate()) + "/" + formatTwoDigits((date.getMonth() + 1)) + "/" + date.getFullYear(),
            orario: formatTwoDigits(date.getHours()) + ":" + formatTwoDigits(date.getMinutes()) + ":" + formatTwoDigits(date.getSeconds()),            
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
            var confermaRimozione = await Utility.confirmRimozioneRefNonTrovata({
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

function resetEditTracciato() {
    $("#tendinaEditTracciato").hide();
    $("#campiRecord").empty();
}

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
function apriModalSvuotamento(mode) {
    //in entrambe le modalità apriamo il modal dialogSvuotaPagina
    Utility.apriModal("dialogSvuotaPagina", "Svuota impaginato");

    if(mode == "0"){
        Utility.setPickerValue($("#svuotaImpaginazioneMode"), "0");
        $("#pagineRangeSvuotatura").show();
    }
    else if (mode == "1") {
        Utility.setPickerValue($("#svuotaImpaginazioneMode"), "1");
        $("#pagineRangeSvuotatura").hide();
    }
    //uguale alla pagina attualmente selezionata
    $("#pagineRangeSvuotatura").val(pagSelected);

}

function apriModalBolli(mode) {
    if( mode != "0" && mode != "1") {
        messaggioUtente("Code IDX-126 Modalità di attivazione/disattivazione non valida", "error");
        return;
    }

    //in entrambe le modalità apriamo il modal dialogSvuotaPagina
    Utility.apriModal("dialogAttivaDisattivaBolli", (mode=="0" ? "Disattiva" : "Attiva") + " bolli");

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
                Utility.chiudiModal();
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
    Utility.chiudiModal();
}

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

        Utility.chiudiModal();


        var preAnalisi = await confronti.preAnalisiMismatchNumeriPagina(pagineRange);

        if(preAnalisi == null || preAnalisi.esito == false){
            if (preAnalisi == null) {
                messaggioUtente("Code IDX-130 Errore durante l'analisi delle pagine: risposta nulla", "error");
            } else {
                messaggioUtente("Code IDX-130 Errore durante l'analisi delle pagine: " + preAnalisi.error, "error");
            }

            hideLoading()

            if (Utility.confirm("Errore durante l'analisi delle pagine, le pagine non sono state sincronizzate, vuoi comunque procedere con lo svuotamento?")) {
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
            await confronti.syncImpaginatoConServer(mappa, preAnalisi);
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
    var x = $('<span style="font-size: 10px; cursor: pointer; margin-left:5px;">X</span>');
    var copyButton = $('<img src="images/copyToClipBoard.png" style="height: 10px; margin-left:5px;" msg="' + msg + '">');
    copyButton.msg = msg;

    copyButton.on('click', function () {
        navigator.clipboard.writeText({ 'text/plain': $(this).attr("msg") }); //item["Scatto.CodiceGruppo"]
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
    if (lastMessage === msg) {
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

function svuotaConsole() {
    $("#debugLogs").empty();
    $("#counterNonLetti").text(0);
    $("#consoleIcon").css("background-color", "green");
}

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
            Utility.apriModal(
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

            //se tutti e 4 i percorsi sono presenti $("#confermaPercorsi").show();
            if (
                (percorsoLinks && percorsoLoghi && percorsoLogs && percorsoEsportazione) ||
                forceOptions!=null
            ) {
                $("#confermaPercorsi").show();
            }
        }

        console.log("...alive...");

        return false;
    }
    console.log("...t'apposto!");

    return true;
}

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
                    Utility.closeAllModal();
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
            $("#filtriBodyGriglia").css("height", "" + altezzaResRef - 10 - altezzaHeaderFiltri + "px");
            $('#filtriBodyGriglia').scrollTop(scrollTop);

            onResizeTab1Tracciato();
    
        }, 100);

    }
    catch(e){
        console.log("Errore durante il resize della finestra: " + e);
    }
}

function onResizeTab1Tracciato(){
    setTimeout(function () {
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
//                 Utility.apriModal("dialogSyncModifiche", "Sync modifiche", false, ["pulsantiTestataSync"]);                
//             }
//             else{
//                 Utility.apriModal("dialogSyncModifiche", "Sync modifiche", false, ["pulsantiTestataSyncOnline"]);
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
//     var result = await Utility.confirm("La coda di operazioni nei task irrisolti verrà svuotata, l'operazione sarà irreversibile, continuare?");
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
//     Utility.chiudiModal();
// }

//FINE - Modalità OFFLINE


async function apriSchermataSyncPacchettoFoto(){
    
    //se negli id delle operazioni di sync in corso c'è già un id non avviamo nuove operazioni ma ricostruiamo solo la schermata con i dati correnti
    // mostriamo di nuovo dialogSyncPacchettoFoto che è stato nascosto
    if (syncFotoInCorso.length > 0) {
        $("#overlayModal" + "DownloadFoto").show();
        return;
    }

    //rimuoviamo il progressBarContainerMini se esiste
    $("#progressBarContainerMini").remove();

    Utility.apriModalCustom("dialogSyncPacchettoFoto", "Scaricamento pacchetto foto", "DownloadFoto", true, ["riduciIconaRow"]);
    $("#bodySyncPacchettoFoto").hide();
}

var abortedSyncFoto = [];
var syncFotoInCorso = [];

//I20-967: presenza del file nella cartella Links. Usa la stessa lettura con cui la
//scheda ref decide se una foto e' in cartella, cosi' i due controlli non possono discordare.
function fotoPresenteNeiLinks(nomeFoto) {
    if (nomeFoto == null || nomeFoto == "") {
        return false;
    }
    try {
        var contenuto = fs.readFileSync(/*pathLavorazione +*/ percorsoLinks + nomeFoto);
        if (contenuto == null) {
            return false;
        }
        //Un file troncato o vuoto non e' impaginabile: vale come assente. La lettura puo'
        //restituire un buffer (byteLength) oppure una stringa (length): valgono entrambi.
        var dimensione = contenuto.byteLength != null ? contenuto.byteLength : contenuto.length;
        return dimensione == null || dimensione > 0;
    }
    catch (e) {
        return false;
    }
}

//I20-967: scrive nella cartella indicata i byte di un file scelto dall'operatore.
//Attende davvero la scrittura, con la stessa API usata dallo scaricamento foto.
async function scriviFileInCartella(bytes, cartella, nomeFile) {
    const folder = await fs2.getEntryWithUrl("file://" + cartella);
    const file = await folder.createFile(nomeFile, { overwrite: true });
    const dati = (bytes instanceof ArrayBuffer) ? new Uint8Array(bytes) : bytes;
    await file.write(dati);
}

//I20-967: impagina una foto appena arrivata in cartella, concedendo a InDesign un
//secondo tentativo se il primo place e' caduto sul segnaposto di foto non trovata.
async function impaginaFotoAppenaDisponibile(nomeFoto, box, fotoRectangle, codice, statoSelezione = null, noRender = false) {
    var esito = await fotoAutoSync.impaginaConRitentativo({
        impagina: async function () {
            return FotoPlacer.updateFoto(nomeFoto, box, fotoRectangle, codice, statoSelezione, noRender);
        },
        attendi: async function () {
            await Utility.sleep(700);
        }
    });

    if (esito != null && esito.ritentata) {
        console.log("impaginaFotoAppenaDisponibile: secondo tentativo per " + nomeFoto + " -> " + (esito.warning ? esito.warning : "riuscito"));
    }
    if (esito != null && esito.warning) {
        console.warn("Code IDX-154 impaginazione di " + nomeFoto + " non riuscita: " + esito.warning);
    }

    return esito;
}

//I20-967: dati di download della singola foto, chiesti per guid cosi' da avere esattamente
//quella appena assegnata alla ref e non quella che la risoluzione area/canale ritiene corrente.
function getInfoFotoDalServer(guidId) {
    return new Promise((resolve) => {
        var xhr = new XMLHttpRequestClient();

        xhr.onload = (data, parsed) => {
            try {
                if (!parsed) {
                    data = JSON.parse(data);
                }
            }
            catch (e) {
                console.log("Code IDX-152 info foto non interpretabile: " + e);
                resolve(null);
                return;
            }

            if (data == null) {
                resolve(null);
                return;
            }
            if (data.error != null && data.error != "") {
                console.log("Code IDX-152 info foto non disponibile: " + data.error);
                resolve(null);
                return;
            }
            resolve(data.record != null ? data.record : null);
        };

        xhr.onreadystatechange = function () { };
        xhr.onerror = function () { resolve(null); };
        xhr.onNoConnection = async function () { resolve(null); };

        xhr.send("SyncFoto/getInfoFoto/" + guidId, null, "GET", null);
    });
}

//I20-967: scaricamento silenzioso della singola foto. Non apre la modale del pacchetto foto:
//l'operatore ha gia' confermato il cambio foto e non deve chiudere altre finestre.
async function scaricaFotoSingolaNeiLinks(recordFoto) {
    const folder = await fs2.getEntryWithUrl("file://" + /*pathLavorazione +*/ percorsoLinks);
    var idOperazione = Utility.generateId();
    syncFotoInCorso.push(idOperazione);

    var objProcess = {
        onTotalCount: async function (count) { },
        onProgress: async function (progress, message = null) {
            if (message != null) {
                showLoading(message);
            }
        },
        onAbort: async function (message = null) { },
        onComplete: async function (message = null) { }
    };

    try {
        await cmd.downloadImages([recordFoto], objProcess, folder, idOperazione);
    }
    finally {
        syncFotoInCorso = syncFotoInCorso.filter(id => id !== idOperazione);
        abortedSyncFoto = abortedSyncFoto.filter(id => id !== idOperazione);
    }
}

//I20-967: usata dalla scheda ref subito prima di impaginare una foto appena cambiata.
//Ritorna true se il file e' nei Links; false lascia proseguire col comportamento precedente.
async function assicuraFotoNeiLinks(nomeFoto, guidId) {
    var esito = await fotoAutoSync.assicuraFotoNeiLinks(nomeFoto, guidId, {
        fotoPresente: async function (nome) { return fotoPresenteNeiLinks(nome); },
        infoFoto: getInfoFotoDalServer,
        scarica: scaricaFotoSingolaNeiLinks
    });

    console.log("assicuraFotoNeiLinks " + nomeFoto + " -> " + esito.motivo);

    if (!esito.presente) {
        console.warn("Code IDX-153 foto " + nomeFoto + " non disponibile nei Links: " + esito.motivo);
    }

    return esito.presente;
}

async function avviaSyncPacchettoFoto(mode, callback, codici = []){
    // var idTracciato = parseInt($("#idTracciato").val());
    // if(idTracciato == null || idTracciato == "" || idTracciato == 0){
    //     messaggioUtente("Errore: Nessun tracciato selezionato", "error");
    //     return;
    // }

    if(mode == 2){
        Utility.apriModalCustom("dialogSyncPacchettoFoto", "Scaricamento pacchetto foto", "DownloadFoto", true, ["riduciIconaRow"]);
    }

    //rimuoviamo vecchie progress bar se esistono
    $("#progressBarContainerMini").remove();

    //prima del pulsante con id ScaricaPacchettoFoto creiamo una piccola progress bar che mostra l'avanzamento del download del pacchetto foto
    var progressBarContainer = $('<div id="progressBarContainerMini" style="width: 100%; height: 2px; background-color: lightgray; margin-top: 10px;"></div>');
    var progressBar = $('<div id="progressBarMini" style="width: 0%; height: 100%; background-color: green;"></div>');
    progressBarContainer.append(progressBar);
    //appendiamo il container della progress bar sotto il pulsante con id ScaricaPacchettoFoto
    $("#ScaricaPacchettoFoto").append(progressBarContainer);

    
    
    //impostiamo riduciIconaRow a display flex
    $("#overlayModalDownloadFoto").find("#riduciIconaRow").css("display", "flex");
    
    $("#avvioOperazioneSyncFoto").hide();
    $("#bodySyncPacchettoFoto").show();
    $("#overlayModalDownloadFoto").find("#closeModal").hide();
    
    
    
    $("#messageOperazione").text("Avvio operazione in corso... Potrebbe richiedere un po' di tempo, attendere prego.");
    $("#progressBar").css("width", 0 + "%");
    $("#progressBarMini").css("width", 0 + "%");
    $("#totalCount").text(0);
    $("#completedCount").text("?");

    if (mode == 0) { //pacchetto foto
        const folder = await fs2.getEntryWithUrl("file://"+ /*pathLavorazione +*/ percorsoLinks);

        //in bodySyncPacchettoFoto scriviamo come fosse una console, scriviamo intanto avvio operazione scaricamento pacchetto foto attemdere...
        inProcess = true;
        //attendiamo per 1 secondo
        await delay(1000);
        //prendiamo l'id tracciato

        try {
            //creiamo un id casuale per identificare questa operazione di sync foto
            var codiceSyncFoto = Utility.generateId();
            syncFotoInCorso.push(codiceSyncFoto);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if(abortedSyncFoto.includes(codiceSyncFoto)){
                        abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFoto);
                        return;
                    }
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code IDX-149 errore sul server: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log(data);
                    //modifichiamo il ? con la lunghezza dell'array
                    //creiamo un oggetto contenente due funzioni, onProgress e onComplete
                    var total = 0;
                    var objProcess = {

                        onTotalCount: async function (count) {
                            total = count;
                            $("#totalCount").text(count);
                        },

                        onProgress: async function (progress, message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            //aggiorniamo il valore di completedCount
                            $("#completedCount").text(progress);

                            //aggiorniamo la progress bar
                            var percentuale = (progress / total) * 100;
                            $("#progressBar").css("width", percentuale + "%");
                            $("#progressBarMini").css("width", percentuale + "%");
                        },

                        onAbort: async function(message = null){
                            if(message != null){
                                $("#messageOperazione").text(message);
                            }
                            abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFoto);
                            $("#progressBarContainerMini").remove();
                        },

                        onComplete: async function (message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            syncFotoInCorso = syncFotoInCorso.filter(id => id !== codiceSyncFoto);
                            if (!abortedSyncFoto.includes(codiceSyncFoto)) {
                                avviaSyncPacchettoFoto(1, callback);
                            }
                            else{
                                abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFoto);
                            }
                        }
                    };
                    await cmd.downloadImages(data, objProcess, folder, codiceSyncFoto);
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
                $("#overlayModalDownloadFoto").find("#closeModal").show();
                //nascondiamo la riduciIconaRow
                $("#overlayModalDownloadFoto").find("#riduciIconaRow").hide();
            }

            xhr.onNoConnection = async function () { }

            xhr.send("SyncFoto/getPacchettoFotoTracciatoAsContract/" + idKitLavorazione, null, "GET", null);

        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
        }
    }
    else if (mode == 1) { //loghi/bolli
        const folder = await fs2.getEntryWithUrl("file://"+ /*pathLavorazione +*/ percorsoLoghi);

        inProcess = true;
        //attendiamo per 1 secondo
        await delay(1000);

        try {
            var codiceSyncFotoMode1 = Utility.generateId();
            syncFotoInCorso.push(codiceSyncFotoMode1);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if(abortedSyncFoto.includes(codiceSyncFotoMode1)){
                        abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode1);
                        return;
                    }
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code IDX-149 errore sul server: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log(data);
                    //modifichiamo il ? con la lunghezza dell'array
                    //creiamo un oggetto contenente due funzioni, onProgress e onComplete
                    var total = 0;
                    var objProcess = {
                        onAbort: async function(message = null){
                            if(message != null){
                                $("#messageOperazione").text(message);
                            }
                            abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode1);
                            $("#progressBarContainerMini").remove();
                        },

                        onTotalCount: async function (count) {
                            total = count;
                            $("#totalCount").text(count);
                        },

                        onProgress: async function (progress, message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            //aggiorniamo il valore di completedCount
                            $("#completedCount").text(progress);

                            //aggiorniamo la progress bar
                            var percentuale = (progress / total) * 100;
                            $("#progressBar").css("width", percentuale + "%");
                            $("#progressBarMini").css("width", percentuale + "%");
                        },

                        onComplete: async function (message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            //se il modal non è visibile
                            if ($("#overlayModalDownloadFoto").css("display") == "none") {
                                messaggioUtente("Scaricamento delle immagini completato", "success");
                                Utility.chiudiModalCustom("DownloadFoto");
                            }
                            abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode1);
                            syncFotoInCorso = syncFotoInCorso.filter(id => id !== codiceSyncFotoMode1);

                        }
                    };
                    let dataToDownload=[];
                    for (var i = 0; i < data.length; i++) {
                        var obj = data[i];
                        dataToDownload.push({fileName: obj.nome, id: obj.guidId});
                    }
                    await cmd.downloadImages(data, objProcess, folder, codiceSyncFotoMode1);
                    $("#overlayModalDownloadFoto").find("#closeModal").show();
                    $("#overlayModalDownloadFoto").find("#riduciIconaRow").hide();


                    if (callback != null) {
                        callback();
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
                $("#overlayModalDownloadFoto").find("#closeModal").show();
                $("#overlayModalDownloadFoto").find("#riduciIconaRow").hide();

            }

            xhr.onNoConnection = async function () { }

            xhr.send("SyncFoto/getPacchettoLoghiBolliAsContract", null, "GET", null);

        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
        }
    }
    else if (mode == 2) { //scaricamento di una lista di codici
        const folder = await fs2.getEntryWithUrl("file://"+ /*pathLavorazione +*/ percorsoLinks);

        //in bodySyncPacchettoFoto scriviamo come fosse una console, scriviamo intanto avvio operazione scaricamento pacchetto foto attemdere...
        inProcess = true;
        //attendiamo per 1 secondo
        await delay(1000);
        //prendiamo l'id tracciato

        try {
            var codiceSyncFotoMode2 = Utility.generateId();
            syncFotoInCorso.push(codiceSyncFotoMode2);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if(abortedSyncFoto.includes(codiceSyncFotoMode2)){
                        abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode2);
                        return;
                    }
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code IDX-149 errore sul server: " + data.error, "error");
                    }

                    console.log(data);
                    //modifichiamo il ? con la lunghezza dell'array
                    //creiamo un oggetto contenente due funzioni, onProgress e onComplete
                    var total = 0;
                    var objProcess = {

                        onAbort: async function(message = null){
                            if(message != null){
                                $("#messageOperazione").text(message);
                            }
                            abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode2);
                            $("#progressBarContainerMini").remove();
                        },

                        onTotalCount: async function (count) {
                            total = count;
                            $("#totalCount").text(count);
                        },

                        onProgress: async function (progress, message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            //aggiorniamo il valore di completedCount
                            $("#completedCount").text(progress);

                            //aggiorniamo la progress bar
                            var percentuale = (progress / total) * 100;
                            $("#progressBar").css("width", percentuale + "%");
                            $("#progressBarMini").css("width", percentuale + "%");
                        },

                        onComplete: async function (message = null) {
                            if (message != null) {
                                $("#messageOperazione").text(message);
                            }
                            abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFotoMode2);
                            syncFotoInCorso = syncFotoInCorso.filter(id => id !== codiceSyncFotoMode2);
                        }
                    };
                    await cmd.downloadImages(data.lista, objProcess, folder, codiceSyncFotoMode2);

                    if (callback != null) {
                        $("#overlayModalDownloadFoto").find("#closeModal").show();
                        $("#overlayModalDownloadFoto").find("#riduciIconaRow").hide();

                        callback();
                    }
                }
                catch (e) {
                    console.log(e);
                }
            }

            xhr.onreadystatechange = function () { }

            xhr.onerror = function () { 
                console.error("errore");
                $("#overlayModalDownloadFoto").find("#closeModal").show();
                $("#overlayModalDownloadFoto").find("#riduciIconaRow").hide();
            }

            xhr.onNoConnection = async function () { }

            var formData = new FormData();
            formData.append("codici", codici.join(","));

            xhr.send("SyncFoto/getFotosAsContractNew/" + idKitLavorazione, formData, "PUT", null);

        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
        }
    }
}

async function abortSyncPacchettoFotoFunction(){
    //usiamo un confirm
    var res = await Utility.confirm("Sicuro di voler annullare l'operazione in corso? Le immagini già scaricate verranno mantenute.");
    if (!res) {
        return;
    }
    //spostiamo in abortedSyncFoto l'id di tutte le operazioni di sync foto in corso
    for(var i = 0; i < syncFotoInCorso.length; i++){
        var id = syncFotoInCorso[i];
        if(!abortedSyncFoto.includes(id)){
            abortedSyncFoto.push(id);
        }
    }
    syncFotoInCorso = [];
    $("#progressBarContainerMini").remove();
    Utility.chiudiModalCustom('DownloadFoto');

}

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

function getFotoData(codice, callback) {
    var xhr = new XMLHttpRequestClient();
    xhr.onload = async (data, parsed) => {
        try {
            if (data.error != null && data.error != "") {
                messaggioUtente("Code IDX-152 errore sul server: " + data.error, "error");
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

    xhr.send("SchedaArticolo/getAllFotoByCodice/"+codice, null, "GET", null);
}

var listaElementiMateriali = [];
async function esportaMateriale(sender)
{
    
    try 
    {        
        abortExport = false;
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

async function ricollegaFotoMassivo(ricollegaFotoPresentiModificate = false, advancedMode = false){
    Utility.chiudiModal();

    showLoading("Mappatura impaginato in corso...");
    await Utility.sleep(100);

    try{
        let fileEsito = {
            esito: true,
            error: [],
            fileModificati: [],
        };
         
        if(advancedMode){
            ricollegaFotoPresentiModificate = true;
        }
        let mappa = await confronti.mappaturaImpaginato();
        scaricaContenutoKit(idKitLavorazione, null, async function (objResult) {
            try {
                if (!objResult.esito) {
                    messaggioUtente("Code IDX-154 Errore durante il download del tracciato: " + objResult.error + " - l'operazione di ricollegamento foto sarà interrotta.", "error");
                    throw new Error("Code IDX-154 Errore durante il download del tracciato: " + objResult.error);
                }

                let listaFotoDaRicollegare = [];
                //per ogni elemento in mappa troviamo il o i suoi corrispettivi
                showLoading("Confronto missmatch foto in corso...");
                await Utility.sleep(100);
                for (let i = 0; i < Object.keys(mappa).length; i++) {
                    //leggiamo la prima chiave di mappa
                    let chiave = Object.keys(mappa)[i];
                    let paginaMappa = mappa[chiave];
                    for (let j = 0; j < paginaMappa.length; j++) {
                        let item = paginaMappa[j];
                        //cerchiamo l'elemento in contenutoKitInLavorazione.records
                        let recs = objResult.records.filter(r => r.recordInTracciato["Scatto.CodiceGruppo"] == item.codiceGruppo);
                        let primario = recs.find(r => r.recordInTracciato.StatoSelezione == 1);
                        if (primario == null) {
                            messaggioUtente("Code IDX-155 Nessun elemento primario trovato per il codice gruppo " + item.codiceGruppo, "error");
                            throw new Error("Code IDX-155 Nessun elemento primario trovato per il codice gruppo " + item.codiceGruppo);
                        }
                        let secondari = recs.filter(r => r.recordInTracciato.StatoSelezione == 2);
                        //confrontiamo le foto in mappa, foto è un array di elementi { nomeFoto: nomeFile, element: rect, statoSelezione: statoSelezione, codiceFoto: codiceFoto}
                        for (let j = 0; j < item.foto.length; j++) {
                            let foto = item.foto[j];
                            if (!ricollegaFotoPresentiModificate && foto.nomeFoto != "nofoto.png" && foto.nomeFoto != "fotoNoFound.png") {
                                //se ricollegaFotoPresentiModificate è true e il nomeFoto non è "nofoto.png" o "fotoNoFound.png" allora saltiamo l'iterazione
                                continue;
                            }
                            //se lo statoSelezione è 1 confrontiamo il nomeFoto con Foto.Nome del primario
                            if (foto.statoSelezione == 1) {
                                let fotoAssente = false;
                                //controlliamo se è un nofoto o fotoNoFound
                                if (foto.nomeFoto == "nofoto.png" || foto.nomeFoto == "fotoNoFound.png") {
                                    fotoAssente = true;
                                }

                                primario["checkedForRicollegamentoFoto"] = true;
                                if (!fotoAssente && !ricollegaFotoPresentiModificate) {
                                    //se la foto è presente e non dobbiamo ricollegare le foto presenti modificate, allora saltiamo l'iterazione
                                    continue;
                                }

                                if (ricollegaFotoPresentiModificate && !fotoAssente && primario.recordInTracciato["Foto.Nome"] == "") {
                                    messaggioUtente("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.", "error");
                                    fileEsito.error.push("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.");
                                    continue;
                                }

                                if (foto.nomeFoto != primario.recordInTracciato["Foto.Nome"] && primario.recordInTracciato["Foto.Nome"] != "") {
                                    //se non sono uguali, allora lo aggiungiamo alla lista dei file da ricollegare
                                    listaFotoDaRicollegare.push({
                                        element: foto.element,
                                        nomeFoto: primario.recordInTracciato["Foto.Nome"],
                                        statoSelezione: foto.statoSelezione,
                                        codiceGruppo: primario.recordInTracciato["Scatto.CodiceGruppo"],
                                        codice: primario.recordInTracciato["Referenza.Codice"],
                                        group: item.ref,
                                    });
                                }
                            }
                            else if (foto.statoSelezione == 2) {
                                //se lo statoSelezione è 2, cerchiamo tramite il codiceFoto l'elemento corrispondente
                                let corrispondente = secondari.find(r => r.recordInTracciato["Referenza.Codice"] == foto.codiceFoto);
                                if (corrispondente == null) {
                                    //se ci troviamo in questo caso vuol dire che c'è stato un cambio di secondarie e la foto trovata non è più presente
                                    if (advancedMode) {
                                        listaFotoDaRicollegare.push({
                                            element: foto.element,
                                            nomeFoto: "",
                                            statoSelezione: 3,
                                            codiceGruppo: primario.recordInTracciato["Scatto.CodiceGruppo"],
                                            codice: "",
                                            group: item.ref,
                                        });
                                    }
                                    else if (ricollegaFotoPresentiModificate) {
                                        corrispondente = recs.find(r => r.recordInTracciato["Referenza.Codice"] == foto.codiceFoto);
                                        if (corrispondente == null) {
                                            messaggioUtente("Code IDX-157 Nessun elemento secondario trovato per il codice foto " + foto.codiceFoto + " nel codice gruppo " + item.codiceGruppo, "error");
                                            fileEsito.error.push("Code IDX-157 Nessun elemento secondario trovato per il codice foto " + foto.codiceFoto + " nel codice gruppo " + item.codiceGruppo);
                                            continue;
                                        }

                                        let fotoAssente = false;
                                        //controlliamo se è un nofoto o fotoNoFound
                                        if (foto.nomeFoto == "nofoto.png" || foto.nomeFoto == "fotoNoFound.png") {
                                            fotoAssente = true;
                                        }

                                        if (!fotoAssente && corrispondente.recordInTracciato["Foto.Nome"] == "") {
                                            messaggioUtente("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.", "error");
                                            fileEsito.error.push("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.");
                                            continue;
                                        }

                                        if (foto.nomeFoto != corrispondente.recordInTracciato["Foto.Nome"] && corrispondente.recordInTracciato["Foto.Nome"] != "") {
                                            listaFotoDaRicollegare.push({
                                                element: foto.element,
                                                nomeFoto: corrispondente.recordInTracciato["Foto.Nome"],
                                                statoSelezione: foto.statoSelezione,
                                                codiceGruppo: primario.recordInTracciato["Scatto.CodiceGruppo"],
                                                codice: corrispondente.recordInTracciato["Referenza.Codice"],
                                                group: item.ref,
                                            });
                                        }

                                    }
                                }
                                else {
                                    let fotoAssente = false;
                                    //controlliamo se è un nofoto o fotoNoFound
                                    if (foto.nomeFoto == "nofoto.png" || foto.nomeFoto == "fotoNoFound.png") {
                                        fotoAssente = true;
                                    }

                                    corrispondente["checkedForRicollegamentoFoto"] = true;
                                    if (!fotoAssente && !ricollegaFotoPresentiModificate) {
                                        //se la foto è presente e non dobbiamo ricollegare le foto presenti modificate, allora saltiamo l'iterazione
                                        continue;
                                    }

                                    if (ricollegaFotoPresentiModificate && !fotoAssente && corrispondente.recordInTracciato["Foto.Nome"] == "") {
                                        messaggioUtente("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.", "error");
                                        fileEsito.error.push("Code IDX-156 Dato manomesso per il codice gruppo " + item.codiceGruppo + " - Foto.Nome del codice:" + foto.codice + " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.");
                                        continue;
                                    }

                                    //se lo statoSelezione è 2 confrontiamo il nomeFoto con Foto.Nome del corrispondente
                                    if (foto.nomeFoto != corrispondente.recordInTracciato["Foto.Nome"] && corrispondente.recordInTracciato["Foto.Nome"] != "") {
                                        //se non sono uguali, allora lo aggiungiamo alla lista dei file da ricollegare
                                        listaFotoDaRicollegare.push({
                                            element: foto.element,
                                            nomeFoto: corrispondente.recordInTracciato["Foto.Nome"],
                                            statoSelezione: foto.statoSelezione,
                                            codiceGruppo: primario.recordInTracciato["Scatto.CodiceGruppo"],
                                            codice: corrispondente.recordInTracciato["Referenza.Codice"],
                                            group: item.ref,
                                        });
                                    }
                                }
                            }
                        }

                        //scorriamo i secondari che non sono stati controllati per il ricollegamento foto
                        if (advancedMode) {
                            for (let j = 0; j < secondari.length; j++) {
                                let corrispondente = secondari[j];
                                if (corrispondente.checkedForRicollegamentoFoto == null || corrispondente.checkedForRicollegamentoFoto == false) {
                                    //se non è stato controllato, allora lo aggiungiamo alla lista dei file da ricollegare
                                    listaFotoDaRicollegare.push({
                                        element: null,
                                        nomeFoto: corrispondente.recordInTracciato["Foto.Nome"],
                                        statoSelezione: 2,
                                        codiceGruppo: corrispondente.recordInTracciato["Scatto.CodiceGruppo"],
                                        codice: corrispondente.recordInTracciato["Referenza.Codice"],
                                        group: item.ref,
                                    });
                                }
                            }

                            if (primario.checkedForRicollegamentoFoto == null || primario.checkedForRicollegamentoFoto == false) {
                                //se non è stato controllato, allora lo aggiungiamo alla lista dei file da ricollegare
                                listaFotoDaRicollegare.push({
                                    element: null,
                                    nomeFoto: primario.recordInTracciato["Foto.Nome"],
                                    statoSelezione: 1,
                                    codiceGruppo: primario.recordInTracciato["Scatto.CodiceGruppo"],
                                    codice: primario.recordInTracciato["Referenza.Codice"],
                                    group: item.ref,
                                });
                            }
                        }
                    }
                }

                //adesso raggruppiamo per codiceGruppo
                let mappaGruppi = {};
                for (let i = 0; i < listaFotoDaRicollegare.length; i++) {
                    let item = listaFotoDaRicollegare[i];
                    if (mappaGruppi[item.codiceGruppo] == null) {
                        mappaGruppi[item.codiceGruppo] = [];
                    }
                    mappaGruppi[item.codiceGruppo].push(item);
                }

                //per ogni gruppo cerchiamo se ci sono elementi con element == null, se si dovremo rompere il gruppo per inserci il nuovo elemento
                //ogni elemento invece con nomeFoto == "" vuol dire che deve essere rimosso
                //infine la casistica base e la più semplice, se nomeFoto != "" allora dobbiamo ricollegare la foto all'elemento
                for (let codiceGruppo in mappaGruppi) {
                    let gruppo = mappaGruppi[codiceGruppo];
                    let boxImpaginato = gruppo[0].group;
                    showLoading("Ricollegamento foto in corso per il gruppo " + codiceGruppo + " a pagina " + boxImpaginato.parentPage.name);
                    await Utility.sleep(10);
                    let elementiDaCreare = [];
                    let elementiDaRicollegare = [];
                    let elementiDaRimuovere = [];
                    for (let i = 0; i < gruppo.length; i++) {
                        let item = gruppo[i];
                        if (item.element == null) {
                            if (!advancedMode) {
                                messaggioUtente("Code IDX-158 un elemento nuovo è stato rischiesto nonostante la modalità scelta non lo preveda", "error");
                                console.error("Code IDX-158 un elemento nuovo è stato rischiesto nonostante la modalità scelta non lo preveda");
                                fileEsito.error.push("Code IDX-158 un elemento nuovo è stato rischiesto nonostante la modalità scelta non lo preveda");
                                continue;
                            }
                            //elemento da ricollegare
                            elementiDaCreare.push(item);
                        }
                        else if (item.nomeFoto == "" && advancedMode) {
                            //elemento da rimuovere
                            elementiDaRimuovere.push(item);
                        }
                        else {
                            //elemento da ricollegare
                            elementiDaRicollegare.push(item);
                        }
                    }

                    //prima ricolleghiamo gli elementi
                    for (let i = 0; i < elementiDaRicollegare.length; i++) {
                        let item = elementiDaRicollegare[i];
                        if (item.element != null) {
                            //ricollego la foto all'elemento
                            try {
                                let result = FotoPlacer.updateFoto(item.nomeFoto, boxImpaginato, item.element, item.codice, item.statoSelezione);
                                boxImpaginato = result.box;
                                fileEsito.fileModificati.push({codiceGruppo: item.codiceGruppo, codice: item.codice, nomeFoto: item.nomeFoto, statoSelezione: item.statoSelezione, operazione: "sostituzione"});
                            } catch (err) {
                                console.error("Code IDX-159 Foto " + item.nomeFoto + " non posizionata correttamente, errore:" + err);
                                messaggioUtente("Code IDX-159 Foto " + item.nomeFoto + " non posizionata correttamente, errore:" + err, "error");
                                fileEsito.error.push("Code IDX-159 Foto " + item.nomeFoto + " non posizionata correttamente, errore:" + err);
                            }
                        }
                    }

                    let key = "";
                    //adesso passiamo a rimuovere gli elementi
                    for (let i = 0; i < elementiDaRimuovere.length; i++) {
                        let item = elementiDaRimuovere[i];
                        key = gC.generateKey();
                        if (item.element != null) {
                            //rimuovo l'elemento
                            gC.Add(item.element, key);
                            fileEsito.fileModificati.push({codiceGruppo: item.codiceGruppo, codice: item.codice, nomeFoto: "", statoSelezione: 3, operazione: "rimozione"});
                        }
                    }

                    let listElementCreati = [];
                    //adesso creiamo gli elementi nuovi e li mettiamo da parte, quando sono tutti prendiamo il gruppo, lo rompiamo e ricreiamo aggiungendo i nuovi elementi
                    for (let i = 0; i < elementiDaCreare.length; i++) {
                        //cerchiamo nel box se c'è già un'immagine startsWith(immagine) o startsWith(foto_secondaria), se c'è prendiamo le sue misure
                        let existingPhoto = null;
                        for (let j = 0; j < boxImpaginato.allPageItems.length; j++) {
                            let item = boxImpaginato.allPageItems[j];
                            if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria")+"$" :"immagine$")) || item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") != null ? pluginMiddleware.getCampo("nomeFotoSecondaria")+"$" :"foto_secondaria$"))) {
                                existingPhoto = item;
                                break;
                            }
                        }
                        let g_new = null;
                        if (existingPhoto != null) {
                            //prendiamo le misure dell'elemento esistente
                            g_new = [existingPhoto.geometricBounds[0] + 5, existingPhoto.geometricBounds[1] + 5, existingPhoto.geometricBounds[2] + 5, existingPhoto.geometricBounds[3] + 5];
                        }
                        else{
                            g_new = [item.group.geometricBounds[0] + 5, item.group.geometricBounds[1] + 5, item.group.geometricBounds[2] + 5, item.group.geometricBounds[3] + 5];
                        }

                        let item = elementiDaCreare[i];
                        if (item.nomeFoto != "") {
                            //creo un nuovo elemento e lo posiziono
                            let photo = item.group.parentPage.rectangles.add(item.group.itemLayer, LocationOptions.UNKNOWN, { geometricBounds: g_new });
                            try {
                                let result = FotoPlacer.updateFoto(item.nomeFoto, boxImpaginato, photo, item.codice, item.statoSelezione);
                                boxImpaginato = result.box;
                                //mettiamo foto sul livello InPagina
                                photo.itemLayer = docInLavorazione.layers.item("InPagina");
                                //aggiungiamo l'elemento alla lista degli elementi da inviare indietro
                                listElementCreati.push(photo);
                                fileEsito.fileModificati.push({codiceGruppo: item.codiceGruppo, codice: item.codice, nomeFoto: item.nomeFoto, statoSelezione: item.statoSelezione, operazione: "creazione"});
                            } catch (err) {
                                //eliminiamo la foto secondaria
                                photo.remove();
                                console.error("Code IDX-159 Foto secondaria " + item.nomeFoto + " non posizionata, errore:" + err);
                                messaggioUtente("Code IDX-159 Foto secondaria " + item.nomeFoto + " non posizionata, errore:" + err, "error");
                                fileEsito.error.push("Code IDX-159 Foto secondaria " + item.nomeFoto + " non posizionata, errore:" + err);
                            }
                        }
                    }

                    //mettiamo da parte gli elementi del gruppo e ricreiamolo aggiungendogli le foto create
                    if (listElementCreati.length > 0) {
                        //Rifaccio il gruppo se ci somo foto secondarie da includere
                        let page = boxImpaginato.parentPage;
                        var oldGroup = boxImpaginato;//field.parent;
                        var oldLabel = oldGroup.label;
                        var oldItems = oldGroup.pageItems.everyItem().getElements();
                        oldGroup.ungroup();

                        var newItems = oldItems.concat(listElementCreati);
                        var newGroup = page.groups.add(newItems);
                        newGroup.label = oldLabel;
                        boxImpaginato = newGroup;

                        //scorriamo tutto il gruppo,mettiamo il primario in secondopiano (sendtoback), poi le secondarie e infine la base
                        let prim = null;
                        let base = null;
                        let secondarie = [];
                        for (let i = 0; i < boxImpaginato.allPageItems.length; i++) {
                            let item = boxImpaginato.allPageItems[i];
                            if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria")!== null ? pluginMiddleware.getCampo("nomeFotoSecondaria")+"$" :"foto_secondaria$"))) {
                                secondarie.push(item);
                            }
                            else if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria")+"$" :"immagine$"))) {
                                prim = item;
                            }
                            else if (Utility.parseLabel(item.label).startsWith("base")) {
                                base = item;
                            }
                        }

                        if (prim != null) {
                            //mettiamo il primario in secondo piano
                            prim.sendToBack();
                        }
                        else {
                            messaggioUtente("Code IDX-160 Errore: Nessun elemento primario trovato per il codice gruppo " + codiceGruppo, "error");
                            console.error("Code IDX-160 Nessun elemento primario trovato per il codice gruppo " + codiceGruppo);
                            fileEsito.error.push("Code IDX-160 Nessun elemento primario trovato per il codice gruppo " + codiceGruppo);
                        }

                        if (secondarie.length > 0) {
                            //mettiamo le secondarie in primo piano
                            for (let i = 0; i < secondarie.length; i++) {
                                let item = secondarie[i];
                                item.sendToBack();
                            }
                        }

                        if (base != null) {
                            base.sendToBack();
                        }
                        else {
                            messaggioUtente("Code IDX-161 Errore: Nessuna base trovata per il codice gruppo " + codiceGruppo, "error");
                            console.error("Code IDX-161 Nessuna base trovata per il codice gruppo " + codiceGruppo);
                            fileEsito.error.push("Code IDX-161 Nessuna base trovata per il codice gruppo " + codiceGruppo);
                        }

                        if (key != "") {
                            gC.activateKey(key);
                            await Utility.sleep(300);
                        }
                    }
                    var fixFotoLavorazioni = [1];

                    if(customAgenzia.fixFotoLavorazioni != null){
                        fixFotoLavorazioni = customAgenzia.fixFotoLavorazioni;
                    }

                    if(customAgenzia.setCustomFixFoto != null){
                        boxImpaginato = customAgenzia.setCustomFixFoto(boxImpaginato);
                    }
                    else if(fixFotoLavorazioni.includes(ficoProcess.getTipoLavorazioneCorrente())){
                        var res = CssFramework.getSpazioImpaginazione(boxImpaginato);
                        CssFramework.fixFoto(boxImpaginato, res.candidate, res.obstacles);
                    }
                }

                //creiamo il file di esito
                fileEsito.esito = true;
                let fileName = "EsitoRicollegamentoFoto_" + docInLavorazione.name.replace(".indd", "") + new Date().toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0]  + ".json";
                let filePath = pathLavorazione + "/" + fileName;
                fs.writeFileSync(filePath, JSON.stringify(fileEsito));
                messaggioUtente("File di esito creato: " + fileName, "success");
                hideLoading();

            }
            catch (e) {
                messaggioUtente("Code IDX-162 Errore durante il ricollegamento foto: " + e, "error");
                console.error("Code IDX-162 Errore durante il ricollegamento foto: " + e);
                fileEsito.esito = false;
                fileEsito.error.push(e.toString());
                //creiamo il file
                let fileName = "EsitoRicollegamentoFoto_" + docInLavorazione.name.replace(".indd", "") + ".json";
                let filePath = pathLavorazione + "/" + fileName;
                fs.writeFileSync(filePath, JSON.stringify(fileEsito));
                messaggioUtente("File di esito creato: " + fileName, "info");
                hideLoading();
            }
        })
    }
    catch (e){
        messaggioUtente("Code IDX-162 Errore generico durante il ricollegamento foto: " + e, "error");
        console.error("Code IDX-162 Errore generico durante il ricollegamento foto: " + e);
        fileEsito.esito = false;
        fileEsito.error.push(e.toString());
        
        //creiamo il file
        let fileName = "EsitoRicollegamentoFoto_" + docInLavorazione.name.replace(".indd", "") + ".json";
        let filePath = pathLavorazione + "/" + fileName;
        fs.writeFileSync(filePath, JSON.stringify(fileEsito));
        messaggioUtente("File di esito creato: " + fileName, "info");
        hideLoading();
    }
}

function clickOnSleepAwake(sender)
{
    if (sender.attr('stato')=='wake')
    {
        sender.attr('src','images/sleep.png');
        sender.attr('stato','sleep');
        indesignEvents.sleep(true);
        Utility.apriModal("dialogSleepLock", "Modalità sleep attiva", false);
        
    }
    else
    {
        sender.attr('src','images/wake.png');
        sender.attr('stato','wake');
        indesignEvents.sleep(false);
        Utility.chiudiModal();
        
    }
}

async function resetIdRec(){
    //confirm all'utente
    var res = await Utility.confirm("Verranno rimossi tutti gli idRec da tutti i box, sicuro di voler procedere?");
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
