/// I20-1015: procurarsi la foto giusta - le operazioni. Sapere se una foto c'e' gia' nella
/// cartella Links e se e' ancora quella del server, chiederla al server, scaricarla, impaginarla
/// appena arriva, e le operazioni grosse sul pacchetto foto.
///
/// Tre livelli, che vanno tenuti distinti:
///   operazioni concrete   toccano disco o server: fotoPresenteNeiLinks, getInfoFotoDalServer,
///                         scaricaFotoSingolaNeiLinks, scriviFileInCartella, getLinkHash, i bolli
///   il ponte              assicuraFotoNeiLinks: inietta le operazioni concrete in autoSync.js e
///                         lascia a lui la decisione. E' il modello da conservare
///   operazioni grosse     il sync del pacchetto foto (apri, avvia, annulla), getFotoData,
///                         ricollegaFotoMassivo, impaginaFotoAppenaDisponibile
///
/// Il concetto sta in questa cartella: schedaFoto.js (la parte foto della scheda, mescolata in
/// schedaRef), questo, scaricamento.js (lo scaricamento vero, ex cmd.js), fotoPlacer.js
/// (collocare il file nel riquadro, ex FotoPlacer di utility.js) e quattro regole pure: autoSync.js,
/// cacheHash.js, dataCaricamento.js e fineScaricamento.js (I20-1027).
///
/// Prima era sparso: le prime undici funzioni erano globali di indexNew.js, getLinkHash e i bolli
/// membri di Utility. indexNew.js dichiara ReperimentoFoto; index.html, schedaRef, confronti e il
/// Report Integrita' lo usano da li'. Usa come globali quelle di indexNew (scaricamentoFoto,
/// Utility, pathLavorazione, percorsoLinks, fs, uxp, messaggioUtente, ...), come faceva prima.

const XMLHttpRequestClient = require('../XMLHttpRequestClient');
const fotoAutoSync = require('./autoSync');
const cacheHashFoto = require('./cacheHash');
const FotoPlacer = require('./fotoPlacer');
const fineScaricamento = require('./fineScaricamento');

const ReperimentoFoto = {
    /// Apre la finestra dello scaricamento del pacchetto foto.
    ///
    /// Se uno scaricamento e' gia' in corso non ne avvia un altro: rimostra la finestra di quello,
    /// che l'operatore aveva ridotto a icona. E' l'unico motivo per cui syncFotoInCorso e' una
    /// lista e non un booleano.
    async apriSchermataSyncPacchettoFoto(){
    
        //se negli id delle operazioni di sync in corso c'è già un id non avviamo nuove operazioni ma ricostruiamo solo la schermata con i dati correnti
        // mostriamo di nuovo dialogSyncPacchettoFoto che è stato nascosto
        if (syncFotoInCorso.length > 0) {
            $("#overlayModal" + "DownloadFoto").show();
            return;
        }

        //rimuoviamo il progressBarContainerMini se esiste
        $("#progressBarContainerMini").remove();

        Modali.apriModalCustom("dialogSyncPacchettoFoto", "Scaricamento pacchetto foto", "DownloadFoto", true, ["riduciIconaRow"]);
        $("#bodySyncPacchettoFoto").hide();
    },

    //I20-967: presenza del file nella cartella Links. Usa la stessa lettura con cui la
    //scheda ref decide se una foto e' in cartella, cosi' i due controlli non possono discordare.
    /// Se la foto c'e' gia' nella cartella Links.
    /// Non si limita a guardare se il file esiste: un file troncato o vuoto vale come ASSENTE,
    /// perche' non e' impaginabile.
    fotoPresenteNeiLinks(nomeFoto) {
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
    },

    /// I20-967: scrive nella cartella indicata i byte di un file scelto
    /// dall'operatore.
    ///
    /// Attende davvero la scrittura, con la stessa API usata dallo scaricamento foto: senza
    /// l'attesa, chi impagina subito dopo trova il file a meta'.
    async scriviFileInCartella(bytes, cartella, nomeFile) {
        const folder = await fs2.getEntryWithUrl("file://" + cartella);
        const file = await folder.createFile(nomeFile, { overwrite: true });
        const dati = (bytes instanceof ArrayBuffer) ? new Uint8Array(bytes) : bytes;
        await file.write(dati);
    },

    /// I20-967: impagina una foto appena arrivata in cartella, concedendo a
    /// InDesign un secondo tentativo se il primo place e' caduto sul segnaposto di foto non trovata.
    ///
    /// Fra il momento in cui il file compare e quello in cui InDesign lo sa collocare passa un
    /// istante: la decisione di ritentare sta in fotoAutoSync, che e' un modulo puro e si puo'
    /// provare; qui restano le due operazioni concrete, impaginare e aspettare.
    async impaginaFotoAppenaDisponibile(nomeFoto, box, fotoRectangle, codice, statoSelezione = null, noRender = false) {
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
    },

    /// I20-967: dati di download della singola foto, chiesti per guid cosi' da
    /// avere esattamente quella appena assegnata alla ref e non quella che la risoluzione
    /// area/canale ritiene corrente.
    ///
    /// Non fallisce mai: ogni strada - risposta illeggibile, errore del server, rete assente -
    /// risolve con null. Chi chiama deve solo sapere se la foto si puo' scaricare o no.
    getInfoFotoDalServer(guidId) {
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
    },

    /// I20-967: scaricamento silenzioso della singola foto. Non apre la modale
    /// del pacchetto foto: l'operatore ha gia' confermato il cambio foto e non deve chiudere altre
    /// finestre.
    ///
    /// Riusa scaricamentoFoto.downloadImages, cioe' la stessa strada del pacchetto completo, ma con le callback
    /// di avanzamento quasi tutte vuote: si vede solo la riga di caricamento.
    ///
    /// Il finally toglie l'id da entrambe le liste: senza, un'operazione finita male lascerebbe
    /// syncFotoInCorso non vuoto e apriSchermataSyncPacchettoFoto non farebbe piu' partire niente.
    async scaricaFotoSingolaNeiLinks(recordFoto) {
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
            await scaricamentoFoto.downloadImages([recordFoto], objProcess, folder, idOperazione);
        }
        finally {
            syncFotoInCorso = syncFotoInCorso.filter(id => id !== idOperazione);
            abortedSyncFoto = abortedSyncFoto.filter(id => id !== idOperazione);
        }
    },

    //I20-967: usata dalla scheda ref subito prima di impaginare una foto appena cambiata.
    //Ritorna true se il file e' nei Links; false lascia proseguire col comportamento precedente.
    /// Il ponte verso il modulo puro: inietta in fotoAutoSync le tre operazioni
    /// concrete - c'e' gia'? chiedila al server; scaricala - e gli lascia la decisione.
    /// Sedici righe, ed e' il pattern del progetto fatto bene: la decisione sta dove si puo' provare,
    /// le operazioni concrete dove devono stare.
    async assicuraFotoNeiLinks(nomeFoto, guidId) {
        var esito = await fotoAutoSync.assicuraFotoNeiLinks(nomeFoto, guidId, {
            fotoPresente: async function (nome) { return ReperimentoFoto.fotoPresenteNeiLinks(nome); },
            //I20-1015: passate come valori, non chiamate. Da globali di indexNew sono diventate membri.
            infoFoto: ReperimentoFoto.getInfoFotoDalServer,
            scarica: ReperimentoFoto.scaricaFotoSingolaNeiLinks
        });

        console.log("assicuraFotoNeiLinks " + nomeFoto + " -> " + esito.motivo);

        if (!esito.presente) {
            console.warn("Code IDX-153 foto " + nomeFoto + " non disponibile nei Links: " + esito.motivo);
        }

        return esito.presente;
    },

    /// I20-1027: la fine di una fase dello scaricamento, scritta nella finestra. La decisione -
    /// e' la fine vera? che messaggio? serve il pulsante Fine? - sta in fineScaricamento.js; qui
    /// resta l'applicarla.
    ///
    /// Tutto passa da #overlayModalDownloadFoto. La finestra e' un clone del modello
    /// dialogSyncPacchettoFoto di index.html: a finestra chiusa, come nell'impaginazione del libro
    /// che scarica senza aprirla, un $("#...") globale troverebbe il modello e lo cambierebbe, e
    /// Fine comparirebbe gia' all'apertura successiva. A finestra chiusa, invece, qui non si tocca
    /// niente.
    ///
    /// Alla fine vera l'operazione esce da syncFotoInCorso. Sulle strade d'errore nessuno la
    /// toglieva, e apriSchermataSyncPacchettoFoto, trovandola, rimostrava la finestra gia' chiusa
    /// e vuota invece di avviarne una nuova.
    mostraFineScaricamento(modo, esito, idOperazione = null) {
        var stato = fineScaricamento.statoAlTermine(modo, esito);
        var finestra = $("#overlayModalDownloadFoto");

        if (stato.concluso && idOperazione != null) {
            syncFotoInCorso = syncFotoInCorso.filter(id => id !== idOperazione);
        }

        finestra.find("#messageOperazione").text(stato.messaggio);
        if (stato.mostraFine) {
            finestra.find("#fineSyncPacchettoFoto").show();
            finestra.find("#closeModal").show();
            finestra.find("#riduciIconaRow").hide();
        }

        return stato;
    },

    /// Lo scaricamento massivo del pacchetto foto, con barra di avanzamento e
    /// possibilita' di interruzione. 348 righe.
    async avviaSyncPacchettoFoto(mode, callback, codici = []){
        // var idTracciato = parseInt($("#idTracciato").val());
        // if(idTracciato == null || idTracciato == "" || idTracciato == 0){
        //     messaggioUtente("Errore: Nessun tracciato selezionato", "error");
        //     return;
        // }

        if(mode == 2){
            Modali.apriModalCustom("dialogSyncPacchettoFoto", "Scaricamento pacchetto foto", "DownloadFoto", true, ["riduciIconaRow"]);
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
        //I20-1027: Fine compare solo alla fine vera, mai durante.
        $("#overlayModalDownloadFoto").find("#fineSyncPacchettoFoto").hide();
    
    
    
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
                            ReperimentoFoto.mostraFineScaricamento(0, fineScaricamento.esiti.nonRiuscito, codiceSyncFoto);
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
                                //I20-1027: finite le foto il processo non e' finito, partono loghi e
                                //bolli: niente "Operazione completata" qui, lo dira' il modo 1.
                                syncFotoInCorso = syncFotoInCorso.filter(id => id !== codiceSyncFoto);
                                if (!abortedSyncFoto.includes(codiceSyncFoto)) {
                                    ReperimentoFoto.mostraFineScaricamento(0, fineScaricamento.esiti.completato, codiceSyncFoto);
                                    ReperimentoFoto.avviaSyncPacchettoFoto(1, callback);
                                }
                                else{
                                    abortedSyncFoto = abortedSyncFoto.filter(id => id !== codiceSyncFoto);
                                }
                            }
                        };
                        await scaricamentoFoto.downloadImages(data, objProcess, folder, codiceSyncFoto);
                    }
                    catch (e) {
                        console.log(e);
                        ReperimentoFoto.mostraFineScaricamento(0, fineScaricamento.esiti.nonRiuscito, codiceSyncFoto);
                        if (callback != null) {
                            callback();
                        }
                    }
                }

                xhr.onreadystatechange = function () { }

                xhr.onerror = function () {
                    console.error("errore");
                    //I20-1027: oltre alla croce, il messaggio e Fine.
                    ReperimentoFoto.mostraFineScaricamento(0, fineScaricamento.esiti.nonRiuscito, codiceSyncFoto);
                }

                xhr.onNoConnection = async function () { }

                xhr.send("SyncFoto/getPacchettoFotoTracciatoAsContract/" + idKitLavorazione, null, "GET", null);

            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
                ReperimentoFoto.mostraFineScaricamento(0, fineScaricamento.esiti.nonRiuscito, codiceSyncFoto);
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
                            ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode1);
                            return;
                        }
                        console.log(data);
                        //modifichiamo il ? con la lunghezza dell'array
                        //creiamo un oggetto contenente due funzioni, onProgress e onComplete
                        var total = 0;
                        //I20-1027: un'operazione annullata non arriva a onComplete, ma il codice dopo
                        //downloadImages gira lo stesso: questo dice se mostrare la fine.
                        var annullata = false;
                        var objProcess = {
                            onAbort: async function(message = null){
                                annullata = true;
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
                                    Modali.chiudiModalCustom("DownloadFoto");
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
                        await scaricamentoFoto.downloadImages(data, objProcess, folder, codiceSyncFotoMode1);
                        //I20-1027: la fine vera, anche del sync completo. Se la finestra era ridotta a
                        //icona onComplete l'ha gia' chiusa col messaggio verde, e qui non si tocca niente.
                        if (!annullata) {
                            ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.completato, codiceSyncFotoMode1);
                        }


                        if (callback != null) {
                            callback();
                        }

                    }
                    catch (e) {
                        console.log(e);
                        ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode1);
                        if (callback != null) {
                            callback();
                        }
                    }
                }

                xhr.onreadystatechange = function () { }

                xhr.onerror = function () {
                    console.error("errore");
                    ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode1);
                }

                xhr.onNoConnection = async function () { }

                xhr.send("SyncFoto/getPacchettoLoghiBolliAsContract", null, "GET", null);

            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
                ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode1);
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
                        //I20-1027: come nel modo 1, l'annullamento non deve mostrare la fine.
                        var annullata = false;
                        var objProcess = {

                            onAbort: async function(message = null){
                                annullata = true;
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
                        await scaricamentoFoto.downloadImages(data.lista, objProcess, folder, codiceSyncFotoMode2);

                        //I20-1027: la fine si mostra sempre, non solo quando c'e' una callback: senza,
                        //la finestra restava senza croce.
                        if (!annullata) {
                            ReperimentoFoto.mostraFineScaricamento(2, fineScaricamento.esiti.completato, codiceSyncFotoMode2);
                        }

                        if (callback != null) {
                            callback();
                        }
                    }
                    catch (e) {
                        console.log(e);
                        ReperimentoFoto.mostraFineScaricamento(2, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode2);
                    }
                }

                xhr.onreadystatechange = function () { }

                xhr.onerror = function () { 
                    console.error("errore");
                    ReperimentoFoto.mostraFineScaricamento(2, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode2);
                }

                xhr.onNoConnection = async function () { }

                var formData = new FormData();
                formData.append("codici", codici.join(","));

                xhr.send("SyncFoto/getFotosAsContractNew/" + idKitLavorazione, formData, "PUT", null);

            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code IDX-150 Errore generico: " + e, "error");
                ReperimentoFoto.mostraFineScaricamento(2, fineScaricamento.esiti.nonRiuscito, codiceSyncFotoMode2);
            }
        }
    },

    /// Annulla lo scaricamento del pacchetto foto in corso, dopo conferma.
    ///
    /// Non interrompe niente di brutale: sposta gli id delle operazioni in corso in
    /// abortedSyncFoto, ed e' chi scarica a controllare quella lista e fermarsi da solo. Le
    /// foto gia' arrivate restano, e la conferma lo dice.
    async abortSyncPacchettoFotoFunction(){
        //usiamo un confirm
        var res = await Modali.confirm("Sicuro di voler annullare l'operazione in corso? Le immagini già scaricate verranno mantenute.");
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
        Modali.chiudiModalCustom('DownloadFoto');

    },

    /// Chiede al server i dati di scaricamento delle foto di una referenza, per codice.
    /// L'equivalente di getLoghiBolliData per le foto di prodotto.
    getFotoData(codice, callback) {
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
    },

    /// Riaggancia in blocco le foto dei box impaginati. 445 righe.
    /// Gli esiti che il server manda indietro si leggono con ricollegaEsiti.js, che e' verificabile.
    async ricollegaFotoMassivo(ricollegaFotoPresentiModificate = false, advancedMode = false){
        Modali.chiudiModal();

        showLoading("Mappatura impaginato in corso...");
        await Utility.sleep(100);

        //I20-986: il rapporto si dichiara qui e non dentro al try. Dichiarato dentro, il blocco che
        //gestisce gli errori non lo vedeva: falliva a sua volta, e cosi' non usciva nessun messaggio,
        //non si scriveva nessun rapporto e la rotella di attesa restava accesa per sempre.
        let fileEsito = {
            esito: true,
            error: [],
            fileModificati: [],
        };

        try{
         
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
                                        messaggioUtente(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto), "error");
                                        fileEsito.error.push(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto));
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
                                                messaggioUtente(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto), "error");
                                                fileEsito.error.push(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto));
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
                                        else {
                                            //I20-986: senza questo ramo la foto restava li' in silenzio,
                                            //agganciata a una referenza che non c'e' piu', e del fatto
                                            //non restava traccia nemmeno nel rapporto.
                                            let avviso = RicollegaEsiti.messaggioSecondariaSparita(item.codiceGruppo, foto);
                                            messaggioUtente(avviso, "warning");
                                            fileEsito.error.push(avviso);
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
                                            messaggioUtente(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto), "error");
                                            fileEsito.error.push(RicollegaEsiti.messaggioDatoManomesso(item.codiceGruppo, foto));
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
                            //I20-986: l'elemento si legge per primo. Stava dopo, ma il ramo senza foto
                            //esistente lo usava gia': chi non aveva ancora una foto nel box, cioe'
                            //proprio chi ne sta creando una, si prendeva un errore invece della foto.
                            let item = elementiDaCreare[i];

                            //cerchiamo nel box se c'è già un'immagine startsWith(immagine) o startsWith(foto_secondaria), se c'è prendiamo le sue misure
                            let existingPhoto = null;
                            for (let j = 0; j < boxImpaginato.allPageItems.length; j++) {
                                let elementoDelBox = boxImpaginato.allPageItems[j];
                                if (elementoDelBox.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria")+"$" :"immagine$")) || elementoDelBox.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") != null ? pluginMiddleware.getCampo("nomeFotoSecondaria")+"$" :"foto_secondaria$"))) {
                                    existingPhoto = elementoDelBox;
                                    break;
                                }
                            }

                            let g_new = RicollegaEsiti.boundsNuovaFoto(
                                existingPhoto != null ? existingPhoto.geometricBounds : null,
                                item.group != null ? item.group.geometricBounds : null);

                            if (g_new == null) {
                                messaggioUtente("Code IDX-164 Impossibile calcolare dove mettere la foto " + item.nomeFoto + " nel gruppo " + item.codiceGruppo, "error");
                                fileEsito.error.push("Code IDX-164 Impossibile calcolare dove mettere la foto " + item.nomeFoto + " nel gruppo " + item.codiceGruppo);
                                continue;
                            }

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
                            var res = SistemazioneFoto.getSpazioImpaginazione(boxImpaginato);
                            SistemazioneFoto.fixFoto(boxImpaginato, res.candidate, res.obstacles);
                        }
                    }

                    //creiamo il file di esito
                    fileEsito.esito = true;
                    let fileName = RicollegaEsiti.nomeFileEsito(docInLavorazione.name, new Date());
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
                    let fileName = RicollegaEsiti.nomeFileEsito(docInLavorazione.name, new Date());
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
            let fileName = RicollegaEsiti.nomeFileEsito(docInLavorazione.name, new Date());
            let filePath = pathLavorazione + "/" + fileName;
            fs.writeFileSync(filePath, JSON.stringify(fileEsito));
            messaggioUtente("File di esito creato: " + fileName, "info");
            hideLoading();
        }
    },

    getBolloNOFOTO(callback, callbackError)
    {
        this.getNomeFotoLogoBolloBySigla("nofoto", callback, callbackError);
    },

    getBolloFOTONOFOUND(callback, callbackError)
    {
        this.getNomeFotoLogoBolloBySigla("fotonofound", callback, callbackError);
    },

    getNomeFotoLogoBolloBySigla:function(sigla, callback, callbackError)
    {
        var xhr = new XMLHttpRequestClient();
    
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        if (callbackError)
                            callbackError("result parsing error ::: " + e);
                        return;
                    }
                }
                // Chiamata alla callback con il risultato ottenuto
                if (objResult.esito)
                {
                    if (callback) {
                        callback(objResult.item.nome); // Passiamo `null` come primo argomento per indicare che non c'è errore
                    }
                }
                else
                {
                    if (callbackError)
                        callbackError(objResult.error);
                }
            } catch (e) {
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
    

        xhr.send("LoghiBolli/getBySigla/" + sigla, null, "GET");
    },
    /// Pausa. E' una delle otto funzioni che meritano davvero il nome di questo file.,

    /// L'md5 dell'immagine collegata a un riquadro, per sapere se e' ancora quella del server.
    /// Passa da cacheHashFoto, perche' il calcolo su centinaia di file e' il costo dominante del
    /// Report Integrita'.
    async getLinkHash(rectangle) {
        var result = {
            success: false,
            missing: false,
            mismatch: false,
            hash: null,
            error: null
        }
        try{
            if (rectangle == null || rectangle.graphics.length == 0) {
                result.error = "Rectangle is null or has no graphics.";
                return result;
            }
            const graphic = rectangle.graphics.item(0);
            const link = graphic.itemLink;
    
            if (link.status.toString() == "LINK_MISSING") {
                result.error = "Immagine non presente nella cartella: " + link.status.toString();
                result.missing = true;
                return result;
            }
            else if (link.status.toString() == "LINK_EMBEDDED") {
                result.error = "Immagine incorporata nel documento: " + link.status.toString();
                return result;
            }
            else if (link.status.toString() == "LINK_INACCESSIBLE") {
                result.error = "Immagine non accessibile: " + link.status.toString();
                return result;
            }
            else if(link.status.toString() == "LINK_UNKNOWN") {
                result.error = "Immagine in stato sconosciuto: " + link.status.toString();
                return result;
            }
    
            const filePath = link.filePath;

            const fs = require("uxp").storage.localFileSystem;
            const fileEntry = await fs.getEntryWithUrl("file://" + filePath);

            //I20-981: leggere il file e calcolarne l'md5 e' il costo dominante del Report
            //Integrita', che lo fa per ogni foto di ogni box. La chiave della cache porta
            //dentro dimensione e data di modifica, quindi una foto sostituita non puo'
            //riusare l'hash vecchio. Se i metadati non si leggono si calcola e non si
            //conserva nulla.
            let chiaveCache = null;
            try {
                chiaveCache = cacheHashFoto.chiave(filePath, await fileEntry.getMetadata());
            }
            catch (exMeta) {
                chiaveCache = null;
            }

            const hashInCache = cacheHashFoto.ottieni(chiaveCache);
            if (hashInCache != null) {
                result.hash = hashInCache;
            }
            else {
                const data = await fileEntry.read({ format: require("uxp").storage.formats.binary });
                const byteArray = new Uint8Array(data);

                result.hash = scaricamentoFoto.md5ArrayBuffer(byteArray);
                cacheHashFoto.memorizza(chiaveCache, result.hash);
            }
    
            if (link.status.toString() == "LINK_OUT_OF_DATE") {
                result.error = "Immagine non aggiornata: " + link.status.toString();
                result.mismatch = true;
            }
        }
        catch (ex) {
            result.error = "Errore sconosciuto durante il calcolo dell'hash: " + ex.message;
            return result;
        }

        result.success = true;
        return result;
    },
};

module.exports = ReperimentoFoto;
