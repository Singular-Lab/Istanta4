const { app } = require('indesign');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const {Utility} = require('./utility');
const { refSelected } = require('./schedaRef');
const {Logger} = require('./logger');
const reportIntegritaAvvio = require('./reportIntegritaAvvio');

class InddEvents {
    mainInterval = null;
    lastActiveDocument = null;
    lastActiveLibro = null;
    lastSelectedPage = null;

    lastSelectionID = []; //Array di id di oggetti selezionati
    lastSelectionIDValidated = [];
    lastSelectionDetails = [];
    lastInvalidSelectionID = [];//Tiene memoria dell'ultima selezione app presa in esame a prescindere dalle logiche di interpretazione

    lastValidRefsSelection={dataSelezione:null, refs:[]};

    timestampInizioSelezione = null;
    timeStampStatus = null;
    timeStampTime = null;
    //timeStampSession=null;
    //pingFailedNumber = 0;


    istantaState = IstantaState.None;//0-None 1-Logged 2-NotLogged 3-IstantaDown
    isOnline = false;

    checkStatusInProcess = false;
    // pingInProcess=false;
    // checkSessionInProgress = false;

    listeners = [];

    xhrCheckSession=null;
    sessionCallTimeout=null;

    isBusy=false;
    asleep=false;

    //I20-981: il Report Integrita' tiene isBusy per tutto il tempo in cui resta aperto, e
    //con isBusy questo ciclo si fermava prima di accorgersi del cambio di documento. Il
    //controllo che chiude il report vive fuori da quel cancello, rallentato perche' chiedere
    //il percorso del documento attivo costa una chiamata a InDesign.
    INTERVALLO_CONTROLLO_REPORT = 500;
    timeStampControlloReport = 0;
    controlloReportInCorso = false;

    //Lista eventi
    EVENT_NEW_DOCUMENT_SELECTED = "newDocumentSelected";//Cambio di selezione di un documento
    EVENT_NEW_LIBRO_OPENED = "newLibroOpened";//Apertura libro
    EVENT_NO_DOCUMENT_OPENED = "noDocumentsOpened";//Nessun file aperto in InDesign

    EVENT_NEW_PAGE_SELECTED = "newPageSelected";//Cambio pagina di lavorazione

    EVENT_NEW_MULTISELECTION = "newMultiSelection";//Nuova selezione di oggetti
    EVENT_NEW_REF_SELECTED = "newRefSelected";//Nuova ref selezionata
    EVENT_NEW_MULTIREF_SELECTED = "newMultiRefSelected";//Nuova ref selezionata
    EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED = "newArtworkMultiRefSelected";//Nuovo possibile artwork
    EVENT_NEW_ARTWORK_SELECTED = "newArtworkSelected";//Nuova artwork selezionata
    EVENT_NEW_GRIGLIA_SELECTED = "newGrigliaSelected";//Nuova griglia selezionata
    
    EVENT_NO_REF_SELECTED = "noRefSelected";//Nessuna ref selezionata
    EVENT_NEW_REF_FIELD_SELECTED = "newRefFieldSelected";//Nuovo campo ref selezionato
    EVENT_NEW_SELECTION_INVALID_POTENTIAL = "newSelectionInvalidPotential";//Nuova selezione di oggetti

    EVENT_ONLINE = "isOnline";//Connessione attiva
    EVENT_OFFLINE = "isOffline";//Connessione inattiva

    EVENT_USER_LOGGED = "userLogged";//Utente loggato
    EVENT_USER_NOT_LOGGED = "userNotLogged";//Utente non loggato

    EVENT_ISTANTA_DOWN = "istantaDown";

    EVENT_REF_PAGECHANGED = "refPagChanged";//Nuova griglia selezionata    

    //PARAMETRI VALUTAZIONALI
    INTERVALLO_SELEZIONE_STABILE = 100;//valore in millisecondi
    
    INTERVALLO_STATUS = 10000;//valore in millisecondi
    INTERVALLOTIMESTAMP = 3000;
    //INTERVALLO_SESSIONE = 5000;//valore in millisecondi

    //dimensioni finestra del plugin
    lastWidthDimension = 0;
    lastHeightDimension = 0;

    previousSelectionEventTriggered = null;
    policyIsLocked = false;

    constructor() {
        this.timeStampStatus = Date.now();
        console.log(this.timeStampStatus);

        this.init(true);

    }

    init(firstCheck = false) {
        let me = this;

        //this.checkSession();
        //this.checkStatus(this.checkStatusResonse);

        this.mainInterval = setInterval(async function () {

            try {

                if (me.asleep || app == null)
                    return;

                if(document.getElementById("wrapper").clientWidth != lastWidthDimension || document.getElementById("wrapper").clientHeight != lastHeightDimension){
                    onresizeWindow();
                }

                await me.controllaChiusuraReportIntegrita();

                if (me.isBusy){
                    //console.warn("IsBusy: "+me.isBusy)
                    return;
                }
                //console.warn("IsBusy: "+me.isBusy)



            //Unica funzione perpetua nel tempo ed in ascolto di ciò che avviene in inDesign
                // if (Date.now() - me.timeStampTime > me.INTERVALLOTIMESTAMP)
                // {
                //     me.timestamp();
                //     me.timeStampTime = Date.now();
                // }

                //console.log("Entro in interval ---> " + (Date.now() - me.timeStampStatus) );

                //if (Date.now() - me.timeStampStatus > me.INTERVALLO_STATUS) {


                    //console.log(">>>PROCESS");
                    
                    //Unica funzione perpetua nel tempo ed in ascolto di ciò che avviene in inDesign
                    if (Date.now() - me.timeStampTime > me.INTERVALLOTIMESTAMP) {
                        //console.log("timestamp");
                        me.timestamp();
                        me.timeStampTime = Date.now();
                        //console.log("timestamp");
                    }

                    if (Date.now() - me.timeStampStatus > me.INTERVALLO_STATUS) {

                        //console.log("check status");
                        //console.log("Check ping " + me.pingInProcess);
                        if (!me.checkStatusInProcess) {
                            //Effettuo ping per controllare la connesione
                            me.checkStatus(me.checkStatusResonse);
                            //console.log("Check ping");
                            me.timeStampStatus = Date.now();
                        }
                    }

                    if (app.documents.length > 0) {
                        //console.log("Documenti aperti: "+app.documents.length);

                        //Controllo intanto se il documento è lo stesso
                        //console.log("Documenti aperti: "+app.documents.length);

                        //console.log("Selezione intercettata");

                        var f = await app.activeDocument.fullName;
                        //console.log(f.nativePath);
                        //console.log(me.lastActiveDocument);
                        //console.log(f.nativePath + "!=" +me.lastActiveDocument );
                        if (me.lastActiveDocument != f.nativePath) {
                            //console.log("Nuovo documento aperto: " + f.nativePath);
                            me.lastActiveDocument = f.nativePath;
                            me.lastActiveLibro=null;
                            me.policyIsLocked=false;
                            me.fireEvent(me.EVENT_NEW_DOCUMENT_SELECTED, [app.activeDocument]);
                        }
                        else {

                            //Se si tratta di un documemto NON ancora in lavorazione, fermare i controlli
                            if(me.policyIsLocked){
                                return;
                            }

                            //Analisi del cambio pagina
                            let activeWindow = await app.activeWindow;
                            if (activeWindow != null) {
                                if (activeWindow.activePage != null && me.lastSelectedPage != activeWindow.activePage.name) {
                                    me.lastSelectedPage = activeWindow.activePage.name;
                                    me.fireEvent(me.EVENT_NEW_PAGE_SELECTED, [me.lastSelectedPage]);
                                }
                            }


                            //Andiamo ad ognimodo ad ascoltare la selzione dell'utente all'interno del documento

                            //Intanto cercando di capire se è selezione singola o multipla
                            let newIDSelection = [];
                            //me.lastAppSelection=app.selection;

                            if (app.selection.length > 0) {
                                let validation=true;
                                if (app.selection.length == 1) {
                                    //Selezione singola
                                    if(app.selection[0].isInvalid){
                                        console.error("Element isInvalid");
                                        validation=false
                                    }
                                    else
                                    {
                                        newIDSelection = [app.selection[0].id];
                                    }

                                }
                                else {
                                    //Selezione multipla
                                    app.selection.forEach(element => {
                                        if(element.isInvalid){
                                            console.error("Element isInvalid");
                                            validation=false;
                                            return;
                                        }
                                        newIDSelection.push(element.id);
                                    });
                                }

                                if (!validation)
                                {
                                    return;
                                }

                                //Ordino per id crescente
                                newIDSelection.sort();

                                if (me.interpretaSelezione(newIDSelection)) {
                                    //Se è la stessa di prima
                                    //Controllo la pagina


                                    //Selezione stabile
                                    //Solo nel caso in cui sia signola è il caso di fare un'analisi più approfondita
                                    if (newIDSelection.length == 1) {
                                        let el = app.selection[0];
                                        if(el.isInvalid){
                                            console.error("Elemento isInvalid");
                                            return;
                                        }
                                        if (el.label.startsWith("artwork")) {
                                            me.fireEvent(me.EVENT_NEW_ARTWORK_SELECTED, [el]);
                                            me.lastSelectionDetails = [];
                                            me.previousSelectionEventTriggered = me.EVENT_NEW_ARTWORK_SELECTED;
                                        }
                                        else if(el.label.startsWith("griglia")){
                                            me.fireEvent(me.EVENT_NEW_GRIGLIA_SELECTED, [el]);
                                            me.previousSelectionEventTriggered = me.EVENT_NEW_GRIGLIA_SELECTED;
                                        }
                                        else if (el.constructor.name == "Group") {

                                            //Analisi dell'elemento base
                                            let dna = Utility.getDnaOfBox(el);
                                            let is_ref = dna!=null;

                                            //let refParams = [];
                                            // for (let t = 0; t < el.allPageItems.length; t++) {
                                            //     let b = el.allPageItems[t].label;
                                            //     if (b.indexOf("base") == 0) {
                                            //         refParams = b.split("$");
                                            //         if (refParams.length > 1) {
                                            //             is_ref = true;
                                            //             break;
                                            //         }
                                            //     }
                                            // }

                                            //Verifichiamo se è una ref                                
                                            if (is_ref) {
                                                let currPag = el.parentPage == null ? -1 : parseInt(el.parentPage.name);

                                                if (me.lastSelectionDetails.length > 0 &&
                                                    me.lastSelectionDetails[0].codice == dna.codice &&
                                                    me.lastSelectionDetails[0].codiceGruppo == dna.codice_gruppo &&
                                                    me.lastSelectionDetails[0].idRec == dna.idRec) {

                                                    //Controlliamo il cambiop pagina
                                                    if (me.lastSelectionDetails[0].pag != currPag) {
                                                        //la ref ha cambiato pagina
                                                        if (currPag == -1) {
                                                            //La ref è fuori vol
                                                        }
                                                        else {
                                                            //Cambio pagina

                                                        }
                                                    }
                                                }
                                                else {
                                                    var pagNumber = el.parentPage == null ? -1 : parseInt(el.parentPage.name);
                                                    me.lastSelectionDetails = [{
                                                        pag: pagNumber,
                                                        pagRef: el.parentPage,
                                                        item: el,
                                                        boxOriginalBounds: el.geometricBounds,
                                                        codice: dna.codice,
                                                        codiceGruppo: dna.codice_gruppo,
                                                        idRec: dna.idRec,
                                                        meccanica: dna.box
                                                    }];

                                                    //Nuova ref selezionata
                                                    me.lastValidRefsSelection.dataSelezione = Date.now();
                                                    me.lastValidRefsSelection.refs = me.lastSelectionDetails;

                                                    me.fireEvent(me.EVENT_NEW_REF_SELECTED, me.lastSelectionDetails);
                                                }

                                            }
                                            else {
                                                if (me.lastSelectionID.length > 0) {

                                                    me.lastInvalidSelectionID = newIDSelection;
                                                    console.log("EVENT_NO_REF_SELECTED 1");
                                                    me.fireEvent(me.EVENT_NO_REF_SELECTED, [me.previousSelectionEventTriggered]);
                                                    me.previousSelectionEventTriggered = null;

                                                }
                                                else
                                                {
                                                    me.resetLastSelection();
                                                }
                                                
                                            }
                                        }
                                        else {
                                            //Label nulla, potrebbe non aver senso la selezione
                                            me.lastInvalidSelectionID = newIDSelection;
                                            if (el.label!="")
                                            {
                                                let tentativi = 0; 
                                                let scope = el;
                                                let dna = "";
                                                while(tentativi<10)
                                                {
                                                    scope=scope.parent;
                                                    dna = Utility.getDnaOfBox(scope);
                                                    if (dna!=null)
                                                        break;
                                                    tentativi++;
                                                }

                                                if (dna!=null)
                                                {
                                                    Logger.log("ATTENZIONE: Selezionato elemento non autorizzato:"+ Utility.parseLabel(el.label) + " REF: " + dna.codice, "warn");
                                                }
                                                
                                                me.fireEvent(me.EVENT_NEW_REF_FIELD_SELECTED, app.selection);
                                                me.previousSelectionEventTriggered = me.EVENT_NEW_REF_FIELD_SELECTED;
                                                
                                            }
                                            else
                                            {
                                                me.fireEvent(me.EVENT_NEW_SELECTION_INVALID_POTENTIAL, app.selection);
                                                me.previousSelectionEventTriggered = me.EVENT_NEW_SELECTION_INVALID_POTENTIAL;
                                            }
                                        }
                                    }
                                    else {
                                        //Qui dobbiamo verificare se è una multiselezione di referenze oppure di oggetti misti
                                        
                                        me.lastSelectionID = newIDSelection;

                                        let isMultiRefs = true;
                                        me.lastSelectionDetails = [];
                                        let refInvalidCounted = 0;
                                        var potentialArtwork = null;
                                        for (let t = 0; t < app.selection.length; t++) {
                                            let potentialRef = app.selection[t];
                                            if (potentialRef.isInvalid){
                                                console.error("Element isInvalid");
                                                return;
                                            }

                                            
                                            if (potentialRef.constructor.name != "Group") {
                                                refInvalidCounted++;
                                                if(refInvalidCounted > 1){
                                                    break;
                                                }
                                                potentialArtwork = potentialRef;
                                                isMultiRefs = false;
                                            }
                                            else{
                                                let dna=Utility.getDnaOfBox(potentialRef);
                                                if (dna==null)
                                                {
                                                    isMultiRefs=false;
                                                    refInvalidCounted++;
                                                    potentialArtwork = potentialRef;

                                                    if(refInvalidCounted > 1){
                                                        break;
                                                    }
                                                }
                                                else
                                                {
                                                    let pagNumber = potentialRef.parentPage == null ? -1 : parseInt(potentialRef.parentPage.name);
    
                                                    me.lastSelectionDetails.push({
                                                        pag: pagNumber,
                                                        pagRef: potentialRef.parentPage,
                                                        item: potentialRef,
                                                        codice: dna.codice,
                                                        codiceGruppo: dna.codice_gruppo,
                                                        meccanica: dna.box
                                                    });
                                                }
                                            }


                                        }

                                        if (isMultiRefs) 
                                        {
                                            me.lastValidRefsSelection.dataSelezione = Date.now();
                                            me.lastValidRefsSelection.refs = me.lastSelectionDetails;

                                            me.fireEvent(me.EVENT_NEW_MULTIREF_SELECTED, me.lastSelectionDetails);
                                            me.previousSelectionEventTriggered = me.EVENT_NEW_MULTIREF_SELECTED;
                                        }
                                        else if(refInvalidCounted == 1){
                                            me.fireEvent(me.EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED, [me.lastSelectionDetails, potentialArtwork]);
                                            me.previousSelectionEventTriggered = me.EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED;
                                        }
                                        else
                                        {
                                            me.fireEvent(me.EVENT_NEW_MULTISELECTION, app.selection);
                                            me.previousSelectionEventTriggered = me.EVENT_NEW_MULTISELECTION;
                                        }
                                    }
                                }
                                else
                                {
                                    if (me.lastSelectionDetails!=null)
                                    {
                                        //Facciamo una prova con un singolo
                                        if (me.lastSelectionDetails.length==1)
                                        {
                                            let objLast = me.lastSelectionDetails[0];
                                            //console.log(objLast.pag + " != " + app.selection[0].parentPage.name);
                                            if (objLast.pag !=app.selection[0].parentPage.name)
                                            {
                                                //Cambio pagina
                                                me.fireEvent(me.EVENT_REF_PAGECHANGED, 
                                                    [{codiceGruppo:me.lastSelectionDetails[0].codiceGruppo, codice:me.lastSelectionDetails[0].codice, pag:parseInt(app.selection[0].parentPage.name)}]);
                                                
                                                objLast.pag = parseInt(app.selection[0].parentPage.name);
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                //Nessuna selezione
                                if (me.lastSelectionID.length > 0) {
                                    console.log("EVENT_NO_REF_SELECTED 2");
                                    me.fireEvent(me.EVENT_NO_REF_SELECTED, [me.previousSelectionEventTriggered]);
                                    me.previousSelectionEventTriggered = null;
                                }
                                newIDSelection = [];
                                me.resetLastSelection();
                            }


                        }


                    }
                    else if (app.books.count()>0)
                    {
                        let _b = app.books.item(0);
                        let _f = await _b.fullName;
                        if (me.lastActiveLibro != _f.nativePath) {
                            //console.log("Nuovo libro aperto: " + _b.name);
                            me.lastActiveLibro = _f.nativePath;
                            me.fireEvent(me.EVENT_NEW_LIBRO_OPENED, [_b]);
                        }
                        else
                        {
                            //me.fireEvent(me.EVENT_NO_DOCUMENT_OPENED, []);
                        }
                    }
                    else {


                        let _flag=false;
                        //Nessuna selezione, indesign ha chiuso tutti i documenti
                        if (me.lastActiveDocument != null || firstCheck) {
                            me.lastActiveDocument = null;
                            _flag=true;
                            me.fireEvent(me.EVENT_NO_DOCUMENT_OPENED, []);
                        }

                        //console.log("No Selezione intercettata");
                        if (me.lastActiveLibro != null) {
                            me.lastActiveLibro = null;
                            if (_flag==false)
                            {
                                me.fireEvent(me.EVENT_NO_DOCUMENT_OPENED, []);
                            }
                        }
                        
                    }

                    //console.log("fine interval");
                //}
                firstCheck = false;
            }catch(err)
            {
                console.log("INTERVAL ERROR " + err);
            }
        }
            , 100);
    }

    /// I20-981: il report integrita' descrive un documento preciso. Se l'operatore passa a un
    /// altro file, o li chiude tutti, quelle segnalazioni non si possono piu' verificare e il
    /// report va chiuso senza chiedere niente: la domanda "sicuro di voler interrompere?"
    /// resta per la chiusura fatta a mano.
    async controllaChiusuraReportIntegrita() {
        if (this.controlloReportInCorso) {
            return;
        }

        if (Date.now() - this.timeStampControlloReport < this.INTERVALLO_CONTROLLO_REPORT) {
            return;
        }

        this.timeStampControlloReport = Date.now();

        if (typeof confronti === "undefined" || confronti == null || !confronti.reportIntegritaAperto()) {
            return;
        }

        this.controlloReportInCorso = true;

        try {
            let documentoAttuale = null;

            if (app.documents.length > 0) {
                const nomeCompleto = await app.activeDocument.fullName;
                documentoAttuale = nomeCompleto != null ? nomeCompleto.nativePath : null;
            }

            if (reportIntegritaAvvio.deveChiudereReport(confronti.documentoDelReport(), documentoAttuale)) {
                confronti.chiudiReportIntegrita("il documento non e' piu' quello del report");
            }
        }
        catch (err) {
            console.error("Errore durante il controllo di chiusura del report integrita':", err);
        }
        finally {
            this.controlloReportInCorso = false;
        }
    }

    resetLastSelection(){
        this.lastSelectionID = [];
        this.lastSelectionIDValidated = [];
        this.lastSelectionDetails = [];
        this.lastInvalidSelectionID=[];
    }

    checkStatusResonse(conn, login, me, params) {
        //console.log("checkStatusResonse " + conn + " - " + login);
        //console.log(this);

        if (!conn) {
            if (me.isOnline) {
                me.isOnline = false;
                //console.log("SISTEMA OFFLINE");
                me.fireEvent(me.EVENT_OFFLINE, []);
                
            }

        }
        else if (conn) {
            if (!me.isOnline) {
                me.isOnline = me;
                //console.log("SISTEMA ONLINE");
                me.fireEvent(me.EVENT_ONLINE, []);
                
            }

        }
        //console.log("checkStatusResonse > step 2");

        if (login > 0) {
            if (me.istantaState != login) {
                me.istantaState = login;

                if (login == IstantaState.Logged) {
                    console.log("UTENTE LOGGATO");
                    me.fireEvent(me.EVENT_USER_LOGGED, params);
                }
                else if (login == IstantaState.NotLogged) {
                    console.log("UTENTE NON LOGGATO");
                    me.fireEvent(me.EVENT_USER_NOT_LOGGED, []);
                }
                else if (login == IstantaState.IstantaDown) {
                    console.log("ISTANTA DOWN");
                    me.fireEvent(me.EVENT_ISTANTA_DOWN, []);
                }
            }
        }
        else {
            if (me.istantaState == IstantaState.NotLogged) {
                //Stato non definito di Istanta,
                //Il sistema praticamente non è mai arrivato ad intrerrogarlo
                //Succede quando il sistema si avvia in una sitazione OFFLINE perenne
            }

        }
    }

    logout() {
        this.istantaState = IstantaState.NotLogged;
    }

    async test() {
        let res = await app.activeWindow;
        console.log(res.activePage.name);
    }

    interpretaSelezione(newSelection) {
        //Funzione di analisi comportamentale della selezione
        if (newSelection.join()==this.lastInvalidSelectionID.join() && this.lastInvalidSelectionID.length>0)
            return false;

        //console.log(newSelection.join() + " == " + this.lastInvalidSelectionID.join());

        if (this.lastSelectionID.join() != newSelection.join()) {
            //Selezione cambiata
            this.lastSelectionID = newSelection;
            this.timestampInizioSelezione = Date.now();
            // this.fireEvent("selectionChanged", [newSelection]);
        }
        else {
            //Incremento intervallo d validità
            let intervalValiditaSelezione = Date.now() - this.timestampInizioSelezione;
            if (intervalValiditaSelezione > this.INTERVALLO_SELEZIONE_STABILE) {
                //Selezione stabile
                //Se è già stato innescato come ultimo, non lo innesco più
                if (newSelection.join()==this.lastSelectionIDValidated.join() && this.lastSelectionIDValidated.length>0)
                    return false;

                this.lastSelectionIDValidated=newSelection;
                return true;
            }
        }

        return false;
    }

    addEventListener(event, callback) {
        this.listeners.push({ eventName: event, callback: callback });
    }

    fireEvent(eventName, params) {
        console.log("Fire event: " + eventName);
        //console.log(params);
        //return;

        this.listeners.forEach(listener => {
            //console.log(listener.eventName + " - " + eventName);
            if (listener.eventName == eventName) {
                listener.callback(params);
            }
        });
    }

    //callback deve essere una fuinzione di ascolto risultato che espone due parametri in ingresso
    //0- Connectivity state (true-online, false-offline)
    //1 - Istanta state IstantaState enum
    checkStatus(callback) {

        //console.log("Check status");    

        let me = this;

        this.checkStatusInProcess = true;

        //Prima faccio il PING
        fetch('https://www.google.com')
            .then(response => {

                //console.log("Response check status fetch google: " + response.ok);

                if (response.ok) {
                    // if (!me.isOnline) {
                    //     me.fireEvent(me.EVENT_ONLINE, []);
                    //     me.isOnline=true;
                    //console.log('Connesso a internet!');

                    //     me.checkSession(callback);
                    // } 

                    //Sono online, los tato è per forza 1
                    //Ora vado a vedere la session
                    me.checkSession(callback);

                }
                else {
                    // if (me.isOnline) 
                    // {
                    //     me.isOnline=false;
                    //     me.fireEvent(me.EVENT_OFFLINE, []);
                    //console.log('Problema di connessione o risposta non valida.', response.status);

                    // }

                    me.checkStatusInProcess = false;
                    callback(false, IstantaState.None, me);
                }

            })
            .catch(error => {

                //console.error("Errore nella richiesta:", error);

                //console.log("Errore nel ping a google");
                // if (me.isOnline) 
                // {
                //     me.isOnline=false;
                //     me.fireEvent(me.EVENT_OFFLINE, []);
                //     console.log('Problema di connessione o risposta non valida.', response.status);

                // }
                me.checkStatusInProcess = false;
                callback(false, IstantaState.None, me);
            });

    }

    checkSession(callback) {

        //console.log("Check session");
        let me = this;

        //if (this.xhrCheckSession!=null)
            //this.xhrCheckSession.abort();

        let _xhrCheckSession = new XMLHttpRequestClient();
        _xhrCheckSession.onload = async (objResult) => {
            //console.log("checkSession onload");
            me.checkSessionInProgress = false;
            try {

                //console.log("Result check session");
                //console.log(objResult);
                clearTimeout(me.sessionCallTimeout);

                if (objResult.esito) {
                    //Utente loggato
                    // if (!me.isUserLogged)
                    // {
                    //     me.isUserLogged=true;
                    //     me.fireEvent(me.EVENT_USER_LOGGED, [objResult]);
                    // }

                    //console.log("Utente loggato");

                    me.checkStatusInProcess = false;
                    callback(true, IstantaState.Logged, me, [objResult]);
                }
                else {
                    //Utente non loggato
                    // if (me.isUserLogged)
                    // {
                    // me.isUserLogged = false;
                    // me.fireEvent(me.EVENT_USER_NOT_LOGGED, []);

                    //console.log("Utente non loggato");

                    me.checkStatusInProcess = false;
                    callback(true, IstantaState.NotLogged, me);

                    // }
                }


            }
            catch (e) {
            }
            finally {

            }
        }

        _xhrCheckSession.onreadystatechange = function () {
            //console.log("checkSession onreadystatechange");
            if (_xhrCheckSession.readyState == 4) {
                if (_xhrCheckSession.status == 200) {
                } else {
                }
            }
        }

        _xhrCheckSession.onerror = function (code) {

            //console.log("Istanta DOWN " + code);

            // me.fireEvent(me.EVENT_ISTANTA_DOWN,[]);
            // me.isUserLogged=false;
            // me.checkSessionInProgress=false;
            clearTimeout(me.sessionCallTimeout);

            me.checkStatusInProcess = false;
            callback(true, IstantaState.IstantaDown, me);

        };


        //console.log("Call " + "LoginController/getSession");
        //this.checkSessionInProgress=true;

        _xhrCheckSession.timeout = 5000; // Potrebbe non rispettarlo, allora per paracadute ci procuriamo pure noi un timeout locale
        _xhrCheckSession.send("LoginController/getSession", null, "GET");

        this.sessionCallTimeout = setTimeout(function(){
            
            console.log("TIMEOUT checkSESSIOn FIRED!!!");

            if (_xhrCheckSession!=null)
            {
                _xhrCheckSession.abort();                
            }            
            
            
            me.checkStatusInProcess = false;
            callback(true, IstantaState.IstantaDown, me);

        }, 7000);

    }

    quit() {
        clearInterval(this.mainInterval);
    }

    timestamp()
    {        
        const now = new Date();
    
        // Ottieni le ore, i minuti e i secondi
        let hours = now.getHours();
        let minutes = now.getMinutes();
        let seconds = now.getSeconds();
    
        // Aggiungi uno zero davanti ai numeri singoli (es. 9 diventa 09)
        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
    
        // Restituisci l'ora nel formato hh:mm:ss
        $("#timestamp").text(`${hours}:${minutes}:${seconds}`)
        
    }

    setBusy(busy)
    {
        this.isBusy=busy;
    }
    
    sleep(sleep)
    {
        this.asleep=sleep;
    }

}

module.exports = InddEvents;
