
class SyncFoto {

    agenzia;
    syncOp;
    pingInterval;
    scanCheckInterval;
    restoreInterval;
    firstJob = true;
    filesToSync = [];
    processi = [];
    //worker = null;
    lastCountFilesScanned = 0;

    constructor() {      
        this.agenzia = new Agenzia();
        //this.worker = new Worker('js/worker.js');

        let visFiltroTracciato = this.agenzia.nascondiFiltroTracciatiInSyncFoto();
        $("#cmbFiltroTracciato").css("display", visFiltroTracciato ? "none" : "block");

        //// Log dal worker
        //this.worker.onmessage = (e) => {
        //    console.log(`Upload completato: ${e.data.name}`);
        //};
    }

    uploadZip(fileImpacchettato, inx, procObj, originDir)
    {
        let problemConnFlag = false;

        var formData = new FormData();
        let file = fileImpacchettato.blob;
        if (file == null)
        {
            //file = $("#fileZip")[0].files[0];
            file = $("#file")[0].files[0];
        }
        else
        {
            formData.append("processID", procObj.ID);
        }


        if (file == null) {
            mostraMessaggio("Selezionare un file ZIP da caricare", "danger");
            return;
        }
    
        //formData.append("fileZip", file);
        formData.append("file", file);

    
        //showLoading();

        //this.syncOp = { jobName: "", files: [] };

        let me = this;


        //fetch("http://"+$("#ipUploadGate").val()+"/api/upload", {
        //    method: "POST",
        //    body: formData
        //}).then(response => {
        //    if (!response.ok) {
        //        throw new Error("Upload failed");
        //    }
        //    else {
        //        //console.log("Response data:", data);
        //        return response.text(); // Usa .json() se ti aspetti una risposta JSON
        //    }
        //}).then(data => {
        //    console.log("Response data:", data); // Esegui un'azione con i dati di risposta
        //    me.scanZip(JSON.parse(data), "0");
        //})
        //.catch(error => console.error("Error uploading chunk:", error));

        if (this.pingInterval != null) {
            clearInterval(this.pingInterval);
        }


        var xhr = new XMLHttpRequest();
        //        xhr.open("POST", $("#ipUploadGate").val() + "/api/upload", true);
        xhr.open("POST", getWebAppRootUrl() + "SyncFoto/UploadFileZip", true);        
        xhr.me = this;
        xhr.onload = function ()
        {
            if (xhr.status === 200) {
                var obj = JSON.parse(xhr.response);

                fileImpacchettato.response = obj;

                procObj.zipProgress++;
                
                if (procObj.zipCount == procObj.zipProgress) {

                    console.log("FINE INVIO");
                    clearInterval(me.pingInterval);
                    //hideLoading();

                    let arrResponse = [];

                    for (let i = 0; i < procObj.files.length; i++) {
                        let fItem = procObj.files[i];
                        arrResponse.push(fItem.response.filename);
                    }

                    //this.me.scanZip(obj, "0");
                    this.me.scanZip(arrResponse, null, originDir);
                }
                else {
                    me.uploadZip(procObj.files[procObj.zipProgress], procObj.zipProgress, procObj, originDir);
                }


            } else {
                console.error("Errore nella richiesta:", xhr.status);
                problemConnFlag = true;
            }
        }

        xhr.onreadystatechange = function ()
        {
            console.log("readyState " + xhr.readyState);

            if (xhr.readyState == XMLHttpRequest.DONE) {
                if (xhr.status != 200) {
                    console.error("ERRORE " + xhr.status);
                    problemConnFlag = true;

                    // showLoading("Problemi con la rete. Tentativo di ripristino pacchetto n." + (inx + 1));

                    

                    // setTimeout(function () {
                    //     console.log("Riproviamo con l'indice " + inx);
                    //     me.uploadZip(fileImpacchettato, inx, procObj, originDir);
                    // }, 10000);

                }

            }
        }

        xhr.onerror = function (data) {

            console.warn("Errore di rete durante l'upload");
            problemConnFlag = true;
            // if (data.status == 0) {
            //     alert("Riscontrati problemi con la connessione, impossibile portare a termine l'operazione!");
            // }
            // else {
            //     alert("Errore " + data.status + ", impossibile portare a termine l'operazione!");
            // }

            // console.error("Errore di rete durante l'upload");

            // hideLoading();
        }

        xhr.ontimeout = function () {
            console.warn("Timeout durante l'upload");
        }
        xhr.onabort = function () {
            console.warn("Upload abortito");

        }

        xhr.upload.onprogress = function (e) {
            //console.log("progress " + e.loaded + " - " + e.total);

            fileImpacchettato.total = e.total;
            fileImpacchettato.loaded = e.loaded;

            $("#progress").css("display", "block");
            if (e.lengthComputable) {

                //Calcolo progressivo generale
                let t = 0;
                let l = 0;

                for (let u = 0; u < procObj.files.length; u++) {
                    let fItem = procObj.files[u];
                    t += fItem.total;
                    l += fItem.loaded;
                }

                let _perc = ((l / t) * 100);
                console.log("progress " + l + " - " + t);
                showLoading("Upload pacchetti " +parseInt(_perc) + "%");

                if (l == t) {
                    $("#progress").css("display", "none");
                    //showLoading("In attesa di scansione...");
                }
                else {
                    $(".progress-bar").css("width", _perc +"%");
                }
            }
            else {
                $(".progress-bar").css("width", "0%");
            }

        };


        xhr.timeout = 0;// 30*60*1000; //1 ora
        xhr.send(formData);

        this.pingInterval = setInterval(async function () {

            try {

                if (problemConnFlag) {
                    //Se è stata lanciata una flag esplicita dal processo di upload allora devo a prescindere lanciatre eccezione e far partire meccanismo di restore
                    throw new Error("Problemi di connessione durante l'upload");
                }

                let responsePing = await fetch(getWebAppRootUrl() + "ping");
                if (!responsePing.ok) {
                    console.log("Online, ma il server ha risposto con un errore:", responsePing.status);
                    xhr.abort();

                    alert("Operazione fallita: Il server ha risposto con codice errore: " + responsePing.status);
                    hideLoading();


                } else {
                    console.log("Ping riuscito!");
                }
            }
            catch (e) {
                //Qualcosa è andato storto
                console.log("Qualcosa è andato storto con la connessione: " + e.message);
                xhr.abort();

                showLoading("Problemi di connessione. Tentativo di ripristino pacchetto n." + (inx + 1));



                setTimeout(function () {
                    console.log("Riproviamo con l'indice " + inx);
                    me.uploadZip(fileImpacchettato, inx, procObj, originDir);
                }, 10000);

            }
        }, 5000);


        $("#stepScan").find("button").attr("disabled", "true");
        $("#cmbFiltroTracciato").attr("disabled", "true");
    
       
        
    }


    scanZip(uploadResult, reqCache, originDir) {


        let req = reqCache;
        if (req == null) {

            req = {
                idFiltroTracciato: $("#cmbFiltroTracciato").val(),
                workDir: "0",
                packagesName: uploadResult
            };

            req.files = [];
            req.originDir = originDir;
            this.syncOp = req;
        }
        else {
            req.workDir = "1";//Specifico che leggo dalla cache
        }

        let me = this;
        showLoading("Analisi dati del pacchetto...");
        //Call.do("SyncFoto", "ScanPacchettoFoto/" + $("#cmbFiltroTracciato").val() + "/" + (uploadResult!=null?uploadResult.filename:"0") + "/" + workDir, "GET", null, this, function (result, me) {        
        Call.do("SyncFoto", "ScanPacchettoFoto", "PUT", req, this, this.scanPacchettoFotoResultCallback, function (err) { 

            //alert("ScanPacchettoFoto error: " + err.message);
            //hideLoading();

            showLoading("Problemi con la rete...Tentativo di ripristino dell'operazione");
            setTimeout(function () {
                me.scanZip(uploadResult, reqCache, originDir);
            }, 10000);

        });
    }

    scanPacchettoFotoResultCallback(result, me) {

        //Qui arriva la risposta immediata della presa in carico della scansione
        //Con il guidid della scansione faccio partire il ciclo di controllo
        if (me.scanCheckInterval != null)
            clearInterval(me.scanCheckInterval);

        showLoading("Inizializzazione della scansione...");

        me.scanCheckInterval = setInterval(function () {

            console.log("Check stato della scansione");
            Call.do("SyncFoto", "ScanPacchettoFotoCheck/" + result.guidid, "GET", null, me,
                function (result) {

                    clearInterval(me.scanCheckInterval);

                    let tblBody = $("#tblResult > tbody");
                    tblBody.empty();
                    $("#headerResult").find("h5").text("Report scansione");
                    $("#tblResult").css("visibility", "visible");
                    $("#headerResult").css("visibility", "visible");
                    $("#countResult").css("visibility", "visible");

                    console.log(result);

                    //me.syncOp.jobName = result.jobName;
                    me.syncOp.files = result.files;//Inizialmente li prendo tutti!
                    me.syncOp.originDir = result.originDir;


                    if (result.error == null) {
                        $("#countResult").find("h6").text("File trovati: " + result.files.length);

                        let template = $("#template").clone();


                        let lista_file = result.files;
                        let ciSonoNoMatch = false;
                        let ciSonoPP = false;

                        for (let i = 0; i < lista_file.length; i++) {
                            let item = lista_file[i];
                            let itemHtml = $(template.html());

                            itemHtml.attr("id", (i + 1) + "_" + item.md5);//item.filename.replace(".", ""));

                            item.idRecView = (i + 1) + "_" + item.md5;

                            itemHtml.find("#lab_filename").text(item.filename);
                            let _circle = itemHtml.find("#status");

                            _circle.attr("stato", item.stato);
                            _circle.attr("dpp", item.daPostProdurre);

                            if (item.daPostProdurre)
                                ciSonoPP = true;

                            if (item.stato == SyncFileStato.NoMatch || item.stato == SyncFileStato.NotInTracciato || item.stato == SyncFileStato.AlreadyExists) {
                                if (item.stato == SyncFileStato.NoMatch) {
                                    _circle.css("background-color", ColorSyncStatoNoMatch);
                                    ciSonoNoMatch = true;
                                }
                                else {
                                    _circle.css("background-color", ColorSyncStatoNoChanges);
                                }
                                itemHtml.find("#chSync").attr("disabled", true);
                                itemHtml.find("#chSync").attr("checked", false);

                            }
                            else if (item.stato == SyncFileStato.New)//item.stato == 1 || item.stato == 5 || item.stato == 6) {
                            {
                                _circle.css("background-color", ColorSyncStatoOk);
                                itemHtml.find("#chSync").attr("checked", true);
                                itemHtml.attr("selezionato", "1");
                            }
                            else if (item.stato == SyncFileStato.Changed || item.stato == SyncFileStato.AlreadyExistsButNotSelected) {
                                if (item.stato == SyncFileStato.Changed) {
                                    _circle.css("background-color", ColorSyncStatoConWarning);
                                }
                                else {

                                    _circle.css("background", ColorAlreayExistsButNotSelected);
                                }

                                //checked solo se è abilitato l'overwrite'
                                if ($("#ChOverwrite").is(":checked")) {
                                    itemHtml.find("#chSync").attr("checked", true);
                                    itemHtml.attr("selezionato", "1");
                                }
                                else {
                                    itemHtml.find("#chSync").attr("disabled", true);
                                }
                            }

                            if (item.details != null) {
                                _circle.attr("title", item.details);
                                itemHtml.find("#lab_result").text(item.details);
                            }


                            tblBody.append(itemHtml);

                        }

                        if (ciSonoNoMatch) {
                            $("#alertNoMatch").css("display", "block");
                        }

                        if (ciSonoPP) {
                            $("#alertPP").css("display", "block");
                        }
                    }
                    else {
                        mostraMessaggio(result.error, "danger");
                    }

                    if (me.firstJob) {

                        //Conrolliamo se devo andare diretto verso il SYNC
                        let chDiretto = $("#ChBypassCheck").prop("checked");



                        $("#stepSync").css("display", "block");
                        $("#stepScan").css("display", "none");
                        $("#rowOptDiretto").css("display", "none");
                        $("#cmbFiltroTracciato").attr("disabled", "true");
                        $("#stepSceltaOverwrite").css("display", "block");

                        if (chDiretto) {
                            $("#stepSceltaOverwrite").css("display", "none");
                            $("#stepSync").css("display", "none");

                            //Seleione automatica per overwrite
                            me.selezionataOpzioneSovrascrittura($("#ChOverwrite"));
                            me.startSyncZip();

                        }
                        else {
                            hideLoading();
                        }
                    }
                    else {
                        //$("#div_rescan").css("display", "none");
                        //$("#div_resync").css("display", "block");
                        hideLoading();
                    }
                },
                function (err) {
                    if (err.info.status == 0) {
                        showLoading("Problemi con la rete...Tentativo di ripristino dell'operazione");
                    }
                    else {
                        if (err.info.status == 404)
                        {
                            //Risorsa non ancora disponibile
                            showLoading("In attesa del risultato...");
                        }
                        else
                        {
                            showLoading("Errore durante il check. Codice: " + err.info.status); 
                        }
                    }
                    
                }
            );


        },5000);

    }

    startSyncZip() {
        this.filesToSync = [];
        let me = this;
        let recs = $("#tblResult > tbody").children();

        recs.each(function () {
            //Se è selezionato
            let _id = $(this).attr("id");

            //console.log("Analizzo rec in lista " + _id);

            if ($(this).attr("selezionato") == "1") {
                if ($(this).attr("synced") != "1" && $(this).css("display") != "none" && $(this).find("#chSync").is(':checked')) {
                    
                    let md5 = _id.split("_")[1];
                    console.log(md5 + "---> approvato");
                    let rec = me.syncOp.files.find(f => f.md5 == md5 && f.idRecView==_id);
                    console.log(rec);
                    me.filesToSync.push(rec);
                }
            }
        });

        console.log("SYNC files preparati");
        console.log(this.filesToSync);

        this.syncZip(0, 20);
    }

    syncZip(from, count) {


        let _to = (from + count);
        if (_to>this.filesToSync.length)
            _to = this.filesToSync.length;

        showLoading("Sync " + _to + " di " + this.filesToSync.length);

        let me = this;

        let obj = { files: [] };
        for (let i2 = from; i2 < from + count; i2++)
        {
            if (i2 >= this.filesToSync.length)
                break;

            obj.files.push(this.filesToSync[i2]);
        }

        if (obj.files.length > 0)
        {
            obj.originDir = this.syncOp.originDir;
            if (this.syncOp.originDir == null)
                obj.originDir = "fromUri";

            obj.totalFilesScanned = this.lastCountFilesScanned;
                
            console.log("Sincronizzo da " + from + " to " + (from+count));
            Call.do("SyncFoto", "SyncPacchettoFoto/" + $("#ChOverwrite").is(':checked') , "PUT", obj, this, function (result, me) {
                console.log(result);

                let lista_file = result.files;
                let id_attivita = result.id_attivita;

                for (let i = 0; i < lista_file.length; i++) {
                    let item = lista_file[i];                    
                    let idRec = item.idRecView;

                    if (item.stato == SyncFileStato.Synced) {
                        let olUri = $("#ipOlympus").val() +"/foto/getThumbNailOnDemand?guidId=" + item.guidid + "&width=30&height=0";

                        $("#" + idRec).find("#colIcon").append("<img src=\"images/done.png\" style=\"width:30px; height:30px;\">");
                        $("#" + idRec).find("#colIcon").find("#preview").attr("src", olUri);

                        $("#" + idRec).attr("synced", "1");
                    }
                    else {                        
                        let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=" + item.guidid + "&width=30&height=0";
                        $("#" + idRec).find("#colIcon").find("#preview").attr("src", "images/warning_icon.png");
                        $("#" + idRec).closest("tr").css("background-color", "#fffb9c");
                        //Metto icona di errore sul record
                        
                        console.error("ERROR SU RECORD " + idRec + " stato # " + item.stato);

                    }
                }

                me.syncZip(from + count, count);
            }, function (err) { 

                if (err.info.status == 0) {
                    showLoading("Problemi di connessione. Tentativo di ripristino operazione a partire dal file n." + (from + 1));



                    setTimeout(function () {
                        console.log("Riproviamo sync a partire dal file n." + (from + 1));
                        me.syncZip(from, count);
                    }, 10000);
                }
                else
                {
                    alert("Operazione di sync fallita, codice di errore: " + err.info.status );
                    hideLoading();
                }

                
            });
        }
        else
        {
            hideLoading();
            if (this.pingInterval != null) {
                clearInterval(this.pingInterval);
            }


            if (this.firstJob) {
                //$("#commandBar").css("display", "none");
                $("#bFirstSync").css("display", "none");
                $("#commandBarPostJob").css("display", "block");
            }
            else {
                //$("#div_rescan").css("display", "block");
                //$("#div_resync").css("display", "none");
            }
            
            


        }
    }

    rescan() {
        showLoading("Ripetizione scansione...");
        this.firstJob = false;
        this.scanZip(null, this.syncOp, this.syncOp.originDir);
    }
    /*
    scan(withSync) {

        
        if (withSync) {
            if (!confirm("Conferma sincronizzazione dei file in SYNC?"))
                return;
        }

        showLoading();

        Call.do("SyncFoto", "Scan/" + withSync + "/" + $("#ChOverwrite").is(':checked') + "/" + $("#cmbFiltroTracciato").val(), "GET", null, this, function (result, me) {

            console.log(result);

            let tblBody = $("#tblResult > tbody");
            tblBody.empty();
            $("#headerResult").find("h5").text(!withSync?"Report scansione":"Report sync");
            $("#tblResult").css("visibility", "visible");
            $("#headerResult").css("visibility", "visible");

            if (result.error == null)
            {                
                let template = $("#template").clone();
                
                for (let i = 0; i < result.length; i++) {
                    let item = result[i];
                    let itemHtml = $(template.html());

                    itemHtml.find("#lab_filename").text(item.filename);
                    let _circle = itemHtml.find("#status");

                    _circle.attr("stato", item.stato);

                    if (item.stato == 9) {
                        _circle.css("background-color", ColorSyncStatoNoMatch);

                    }
                    else if (item.stato == 2 || item.stato == 4){
                        _circle.css("background-color", ColorSyncStatoError);

                    }
                    else if (item.stato == 1 || item.stato == 5 || item.stato == 6) {
                        _circle.css("background-color", ColorSyncStatoOk);    
                        if (item.stato == 6) {
                            _circle.text("N");

                        }
                    }
                    else if (item.stato == 7) {
                        if (withSync) {
                            _circle.css("background-color", ColorSyncStatoOk);
                            _circle.text("O");
                        }
                        else {
                            _circle.css("background-color", ColorSyncStatoConWarning);
                        }
                    }
                    else if (item.stato == 8) {
                        _circle.css("background-color", ColorSyncStatoConWarning2);
                        
                    }

                    if (item.details != null) {
                        _circle.attr("title", item.details);
                        itemHtml.find("#lab_result").text(item.details);
                    }

                    if (withSync) {
                        if (item.stato == 1 || item.stato == 6 || item.stato == 7) {
                            //Sync avvenuto con successo
                            //Posso chiedere di mostrare preview della foto
                            itemHtml.find("#preview").attr("src", "Thumb?id_foto=" + item.id + "&w=40&h=40");       
                        }
                    }

                    tblBody.append(itemHtml);
                }
            }
            else {
                mostraMessaggio(result.error, "danger");
            }

            hideLoading();
        });
    }
    */

    syncAsSingle(sender) {

        var fileSingle = sender.closest("tr").find("#lab_filename").text();
        console.log("sync single: " + fileSingle);
        

        if (confirm("Conferma sincronizzazione del file: " + fileSingle)) {
            showLoading();

            var file = { FileName: fileSingle }
            Call.do("SyncFoto", "ScanSingle", "PUT", file, this, function (result, me) {

                console.log(result);
                let imgThumb = sender.closest("tr").find("#preview");
                imgThumb.attr("src", "Thumb?id_foto=" + result.id + "&w=40&h=40");    
                sender.css("display", "none");

                hideLoading();
            });
        }
    }

    filtraPerStato() {

        var filtroVal = $("#cmbFiltroStato").val();

        var statiFilters = {
            stato0: [],
            stato1: ["6"],
            stato2: ["7", "11"],
            stato3: ["8"],
            stato4: ["9", "10"],
            stato5: ["6","7","11"]
        };


        var stati_da_filtrare = statiFilters["stato" + filtroVal];
        let _count = 0;

        $("#tblResult").find(".status_circle").each(function () {

            if (stati_da_filtrare.length <= 0) {
                //Nessun filtro
                $(this).closest("tr").css("display", "revert");
                _count++;
                //console.log("1. faccio vedere");
            }
            else {
                var myStatoVal = $(this).attr("stato");
                let dpp = $(this).attr("dpp").toLowerCase()=="true";
                let filtroDPP = filtroVal == "5" ? dpp : true;

                if (
                    (stati_da_filtrare.filter(f => f == myStatoVal).length > 0 && filtroVal != "5") ||
                    (filtroVal == "5" && filtroDPP ) ) {
                    $(this).closest("tr").css("display", "revert");
                    _count++;
                    //console.log("2. faccio vedere");
                }
                else {
                    $(this).closest("tr").css("display", "none");
                    //console.log("nascondo");
                }
            }

        });

        $("#countResult").find("h6").text("File trovati: " + _count);

        /*
         
        None=0,
        Synced=1,
        SyncedError=2,
        Scanned=3,//Solo temporaneo dopodichè il CORE decide
        ScannedError=4,
            Syncable=5,
            SyncableAsNew=6,
            SyncableAsOverwrite = 7,
            AlreadyExist =8,
        NoMatch=9,
        NotInTracciato=10

          */

        /*
                         <option value="0">Seleziona stato</option>
                <option value="1">Foto nuove</option>
                <option value="2">Foto cambiate</option>
                <option value="3">Foto inalterate</option>
                <option value="4">Articolo nuovo</option>
                <option value="5">Non sincronizzabili</option>
                */

    }

    filtraPerTracciatoPromo(sender) {
        let val = sender.val();


        if (val != "0") {
            $("#bScanByUri").css("display", "block");
        }
        else
        {
            $("#bScanByUri").css("display", "none");
        }
        
    }

    scanFotoByUri() {
        let val = $("#cmbFiltroTracciato").val();
        let idPromo = "0";
        let idTracciato = "0";


        if (val != "0") {
            if (val[0] == 'p') {
                //Promo
                idPromo = val.substring(1);

            }
            else {
                //tracciato
                idTracciato = val.substring(1);
            }
            $("#bScanByUri").css("display", "block");

            showLoading("Scansione foto by URI...");

            let req = {
                idFiltroTracciato: $("#cmbFiltroTracciato").val(),
                workDir: "0",//in questo caso ininfluente
                packagesName: []//in questo caso ininfluente
            };

            req.files = [];

            this.syncOp = req;

            Call.do("SyncFoto", "ScanPacchettoFotoByFotoUri/" + idPromo + "/" + idTracciato, "GET", null, this, this.scanPacchettoFotoResultCallback);

        }
        else {
            $("#bScanByUri").css("display", "none");
        }
    }

    downloadPerStato(forcedStatus) {

        let lista_foto = [];
        let me = this;

        showLoading("Preparazione pacchetto...");

        $("#tblResult").find(".status_circle").each(function () {

            if (forcedStatus!=null) {
                var myStatoVal = $(this).attr("stato");
                if (forcedStatus == myStatoVal) {

                    let _id = $(this).closest("tr").attr("id");
                    let md5 = _id.split("_")[1];
                    let rec = me.syncOp.files.find(f => f.md5 == md5 && f.idRecView == _id);
                    lista_foto.push(rec);

                }
            }
            else {
                if ($(this).closest("tr").css("display") != "none") {

                    let _id = $(this).closest("tr").attr("id");
                    let md5 = _id.split("_")[1];
                    let rec = me.syncOp.files.find(f => f.md5 == md5 && f.idRecView == _id);


                    lista_foto.push(rec);//$(this).closest("tr").find("#lab_filename").text());
                }
            }

        });

        if (lista_foto.length <= 0) {
            hideLoading();
            alert("Nessun file da scaricare");
            return;
        }

        let objReq = {
            jobName: "",
            lista: [],
            files: lista_foto,
            dirOperatore: $("#dirOperatore").val(),
            tipoFiltro: $("#cmbFiltroStato").val()
        };

        if (confirm("Confermi download del file ?"))
        {
            Call.do("SyncFoto", "downloadPacchettoFoto", "PUT", objReq, this, function (result, sender) { 


                    showLoading("Download in corso...");
                    sender.downloadFile(result.url, result.fileName, (p) => {
                        if (p.lengthComputable) {
                            console.log(`Download: ${p.percent}% (${p.loaded}/${p.total})`);
                            showLoading(`Download al ${p.percent}%`);
                        } else {
                            console.log(`Scaricati ${p.loaded} byte`);
                        }

                        if (p.percent >= 100) {
                            hideLoading();
                        }
                    });


            });
        }
        else {
            alert("Download annullato!");
            hideLoading();
        }

        //FUNZOINANTE MA SENZA PROGRESS
        //$.ajax({
        //    //dataType: 'json',
        //    type: "PUT",
        //    url: "/" + getWebAppRootFolder() + "SyncFoto/downloadPacchettoFoto",
        //    contentType: "application/json; charset=utf-8",
        //    data: JSON.stringify(objReq),
        //    xhrFields: {
        //        responseType: 'blob'  // Assicura che la risposta sia gestita come Blob
        //    },
        //    success: function (data, textStatus, xhr) {

        //        let disposition = xhr.getResponseHeader('Content-Disposition');;
        //        let fileName = "pacchetto_foto.zip";//Nome generico

        //        if (disposition && disposition.indexOf('filename=') !== -1) {
        //            var match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        //            if (match != null && match[1]) {
        //                fileName = match[1].replace(/['"]/g, '');
        //            }
        //        }

        //        if (confirm("Confermi download del file " + fileName + "?")) {



        //            var blob = new Blob([data], { type: 'application/zip' });
        //            var downloadUrl = URL.createObjectURL(blob);
        //            var a = document.createElement("a");
        //            a.href = downloadUrl;
        //            a.download = fileName;
        //            document.body.appendChild(a);
        //            a.click();
        //            a.remove();
        //            hideLoading();
        //        }
        //        else {
        //            alert("Downoad annullato!");
        //            hideLoading();
        //        }
                
        //    },
        //    error: function (xhr, textStatus, errorThrown) {

        //        console.log('Errore nella richiesta PUT: ' + errorThrown);
        //    },

        //});
    }

    downloadFile(url, fileName, onProgress)
    {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "blob";

            xhr.onprogress = function (event) {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress?.({
                        loaded: event.loaded,
                        total: event.total,
                        percent: percent,
                        lengthComputable: true
                    });
                } else {
                    onProgress?.({
                        loaded: event.loaded,
                        total: null,
                        percent: null,
                        lengthComputable: false
                    });
                }
            };

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const blob = xhr.response;
                    const downloadUrl = URL.createObjectURL(blob);

                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();

                    URL.revokeObjectURL(downloadUrl);
                    resolve();
                } else {
                    reject(new Error(`Errore HTTP ${xhr.status}`));
                }
            };

            xhr.onerror = function () {
                reject(new Error("Errore di rete durante il download"));
            };

            xhr.send();
        });
    }


    selezionaDeselezionaTutti() {
        let chAll = $("#chAll").is(":checked");
        let recs = $("#tblResult > tbody").children();

        recs.each(function () {
            let stato = parseInt($(this).find("#status").attr("stato"));
            if (stato != SyncFileStato.NoMatch && stato != SyncFileStato.NotInTracciato && stato != SyncFileStato.AlreadyExists) {

                if (stato != SyncFileStato.AlreadyExistsButNotSelected && stato != SyncFileStato.Changed) {

                    $(this).find("#chSync").prop("checked", chAll);
                    $(this).attr("selezionato", chAll ? "1" : "0");
                }
                else {
                    if ($("#ChOverwrite").is(":checked")) {
                        $(this).find("#chSync").prop("checked", chAll);
                        $(this).attr("selezionato", chAll ? "1" : "0");
                    }
                    else {
                        $(this).find("#chSync").prop("checked", false);
                        $(this).find("#chSync").attr("disabled", true);
                    }
                }

            }
        });
        
    }

    selezionaDeselezionaSingolo(sender)
    {
        sender.parent().parent().attr("selezionato", sender.is(":checked") ? "1" : "0");
    }

    selezionataOpzioneSovrascrittura(sender) {

        if (sender.is(":checked")) {
            //Seleziono automaticamente tutte le foto cambiate e le abilito a passare

            let recs = $("#tblResult > tbody").children();
            recs.each(function () {
                let stato = parseInt($(this).find("#status").attr("stato"));
                if (stato == SyncFileStato.Changed  || stato == SyncFileStato.AlreadyExistsButNotSelected) {
                    $(this).find("#chSync").prop("checked", true);
                    $(this).find("#chSync").attr("disabled", false);
                    $(this).attr("selezionato", "1");
                }
            });
        }
        else {
            //Deseleziono tutte le foto cambiate e disabilito il checkbox
            let recs = $("#tblResult > tbody").children();
            recs.each(function () {
                let stato = parseInt($(this).find("#status").attr("stato"));
                if (stato == SyncFileStato.Changed || stato == SyncFileStato.AlreadyExistsButNotSelected) {
                    $(this).find("#chSync").prop("checked", false);
                    $(this).find("#chSync").attr("disabled", true);
                    $(this).attr("selezionato", "0");

                }
            });
        }

    }

    //Creazione e preparazione zip
    async creaZipDaCartella() {



        let procObj = { ID: "1234", zipCount: 0, zipProgress: 0, files:[] };

        let relPath = $("#fileZip")[0].files[0].webkitRelativePath;
        let dir = relPath.substring(0, relPath.indexOf("/"));
        $("#dirOperatore").val(dir);

        showLoading("Creazione pacchetti upload...");

        const filesInFolder = $("#fileZip")[0].files;



        let zip = JSZip();

        let progDim = 0;
        let countFileProcessed = 0;

        this.lastCountFilesScanned = filesInFolder.length;

        for (let i = 0; i < filesInFolder.length; i++) {

            let file = filesInFolder[i];

            const content = await file.arrayBuffer();
            let relPath =  file.webkitRelativePath.substring(file.webkitRelativePath.indexOf("/") + 1); // Rimuove la parte iniziale del percorso
            zip.file(relPath, content);

            countFileProcessed++;
            console.log("Zippped file " + countFileProcessed + " di " + filesInFolder);

            progDim += (file.size / 1024 / 1024);
            if (progDim > 500 || i == filesInFolder.length - 1)//Se si supera 500MB si chiude il pacchetto
            //if (progDim > 5 || i == filesInFolder.length - 1)//Se si supera 5MB si chiude il pacchetto
            {
                console.log("Creazione pacchetto");
                procObj.zipCount++;
                progDim = 0;

                const blob = await zip.generateAsync({ type: "blob" });
                //Vorrei creare un oggetto File
                const file = new File([blob], "test" + (procObj.files.length+1) + ".zip", { type: "application/zip" });
                procObj.files.push({ blob: file, total: file.size, loaded: 0, response:null });

                zip = JSZip();

                showLoading("Pacchetti creati: " + procObj.zipCount + " Files rimanenti: " + (filesInFolder.length - countFileProcessed));

            }

        }

        let jobs = [];
        let me = this;

        // for (let inx = 0; inx < procObj.files.length; inx++)
        // {
            this.uploadZip(procObj.files[0], 0, procObj, dir);
        //}


    }

    cercaNelRegistro(obj)
    {
        showLoading();
        $("#tblResult").empty();

        Call.do("SyncFoto", "ricercaNelRegistro", "POST", obj, this, function (result, me) {
            //Status code
            console.log(result);
            let arrDef = [];
            let lastGroup = { dir: "", list: [], dataRegistrazione: null, totalFilesScanned:0 };
            for (const element of result.list)
            {
                let rec = element.meta;
                let myDir = rec.dir;

                if (myDir == lastGroup.dir) {
                    lastGroup.list = lastGroup.list.concat(rec.fileSynced);
                    //reduce
                    lastGroup.list = [...new Map(lastGroup.list.map(item => [item.filename, item])).values()];
                }
                else {
                    if (lastGroup.dir == "") {

                        lastGroup.list = lastGroup.list.concat(rec.fileSynced);
                        //reduce
                        lastGroup.list = [...new Map(lastGroup.list.map(item => [item.filename, item])).values()];

                    }
                    else {
                        arrDef.push({ dir: lastGroup.dir, list: lastGroup.list, dataRegistrazione: lastGroup.dataRegistrazione, url: lastGroup.url, totalFilesScanned: lastGroup.totalFilesScanned });

                        //Registro
                        lastGroup.list = rec.fileSynced;
                        //reduce
                        lastGroup.list = [...new Map(lastGroup.list.map(item => [item.filename, item])).values()];
                    }
                }

                lastGroup.dir = myDir;
                lastGroup.dataRegistrazione = element.dataRegistrazione;
                lastGroup.url = element.url;
                lastGroup.totalFilesScanned = rec.totalFilesScanned;
                
            }


            //console.log(unique);

            arrDef.push({ dir: lastGroup.dir, totalFilesScanned: lastGroup.totalFilesScanned, list: lastGroup.list, dataRegistrazione: lastGroup.dataRegistrazione, url: lastGroup.url });

            console.log(arrDef);


            let prog = 0;
            for (const el of arrDef)
            {
                prog++;

                let obj = $($("#template").clone().html());
                let _id="row" + prog;
                obj.find(".accordion-collapse").attr("id", _id);
                obj.closest(".accordion-item").attr("dir", el.dir);
                let counterText = el.list.length.toString();
                if (el.totalFilesScanned > 0) {
                    counterText = counterText + " di " + el.totalFilesScanned;
                }
                obj.find(".accordion-button").text(el.dataRegistrazione + " - " + el.dir + " (" + counterText + ")");
                obj.find(".accordion-button").attr("data-bs-target","#"+_id);                

                let container = obj.find(".accordion-body").find(".containerRecords");
                

                for (const el2 of el.list) {
                    let rec = $($("#template_file").clone().html());
                    rec.find(".nomeFileLabel").text(el2.filename);
                    rec.find(".statoFilelabel").text(el2.daPostProdurre?"Da post produrre":statoToString(el2.stato));
                    rec.attr("stato", el2.stato);
                    rec.attr("dpp", el2.daPostProdurre);
                    rec.attr("ziporigindir", el2.zipOriginDir);

                    container.append(rec);
                }

                obj.find(".fileNameFilterText").on("keyup", function () {
                    me.ricercaRecordFileLocale($(this));
                });
                obj.find(".statoFilterCmb").on("change", function () {
                    me.ricercaRecordFileLocale($(this));
                });
                obj.find(".btnDownloadFiles").on("click", function () {
                    me.downloadFilesDaRegistro($(this));
                });

                $("#tblResult").append(obj);
            }

            hideLoading();
            
        }, function (err) {

            console.error("Trovato errore: " + err.message.error);
            alert(err.message.error);
            hideLoading();
        });
    }

    ricercaRecordFileLocale(sender) {
        let _body = sender.closest(".accordion-body");
        let txtFilter = _body.find(".fileNameFilterText").val().toLowerCase();
        let statoFilter = _body.find(".statoFilterCmb").val();
        let _container = _body.find(".containerRecords");
        let counter = 0;

        var statiFilters = {
            stato0: [],
            stato1: ["6"],
            stato2: ["7", "11"],
            stato3: ["8"],
            stato4: ["9", "10"],
            stato5: ["6", "7", "11"]
        };


        _container.find(".recordFileSync").each(function () {
            let _rec = $(this);//.find(".recordFileSync");
            let _nomeFileRec = _rec.find(".nomeFileLabel").text().toLowerCase();
            let _statoSync = _rec.attr("stato");
            let _dpp = _rec.attr("dpp");

            if (
                (txtFilter == "" || _nomeFileRec.indexOf(txtFilter) >= 0) &&
                (statoFilter == 0 || _statoSync == statoFilter ||
                    (_dpp == "true" && statoFilter == 5) ||
                    statiFilters["stato" + statoFilter].includes(_statoSync))
            ) {
                //Match
                _rec.css("display", "flex");
                counter++;
            }
            else {
                _rec.css("display", "none");
            }
        });

        _body.find(".labCounterFiltroRegistro").text("Trovati: "+counter);
    }

    downloadFilesDaRegistro(sender) {

        showLoading("Preparazione del pacchetto...");

        let _body = sender.closest(".accordion-body");
        let _container = _body.find(".containerRecords");
        let accItem = sender.closest(".accordion-item")
        let dirName = accItem.attr("dir");

        let _list = [];

        _container.find(".recordFileSync").each(function () {
            let _rec = $(this);//.find(".recordFileSync");
                           
            if (_rec.css("display") != "none") {
                let _nomeFileRec = _rec.find(".nomeFileLabel").text()
                _list.push({ zipDirOrigin: _rec.attr("ziporigindir"), filename: _nomeFileRec });
            }     
        });

        if (_list.length <= 0) {
            hideLoading();
            alert("Nessun file da scaricare");            
            return;
        }

        let objReq = {
            jobName: "",
            lista: [],
            files: _list,
            dirOperatore: dirName,//ATTENZIONE, da sistemare
            tipoFiltro: sender.closest(".row").find(".statoFilterCmb").val()
        };

        //xhr.send(objReq);

        Call.do("SyncFoto", "downloadPacchettoFoto", "PUT", objReq, this, function (result, sender) {

            if (confirm("Confermi download del file " + result.fileName + "?")) {
                showLoading("Download in corso...");
                sender.downloadFile(result.url, result.fileName, (p) => {
                    if (p.lengthComputable) {
                        //console.log(`Download: ${p.percent}% (${p.loaded}/${p.total})`);
                        showLoading(`Download al ${p.percent}%`);
                    } else {
                        console.log(`Scaricati ${p.loaded} byte`);
                    }

                    if (p.percent >= 100) {
                        hideLoading();
                    }
                });
            }
            else {
                alert("Download annullato!");
                hideLoading();
            }

        });

        //$.ajax({
        //    //dataType: 'json',
        //    type: "PUT",
        //    url: "/" + getWebAppRootFolder() + "SyncFoto/downloadPacchettoFoto",
        //    contentType: "application/json; charset=utf-8",
        //    data: JSON.stringify(objReq),
        //    xhrFields: {
        //        responseType: 'blob'  // Assicura che la risposta sia gestita come Blob
        //    },
        //    success: function (data, textStatus, xhr) {

        //        let disposition = xhr.getResponseHeader('Content-Disposition');                    ;
        //        let fileName = "pacchetto_foto.zip";//Nome generico

        //        if (disposition && disposition.indexOf('filename=') !== -1) {
        //            var match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        //            if (match != null && match[1]) {
        //                fileName = match[1].replace(/['"]/g, '');
        //            }
        //        }

        //        var blob = new Blob([data], { type: 'application/zip' });
        //        var downloadUrl = URL.createObjectURL(blob);
        //        var a = document.createElement("a");
        //        a.href = downloadUrl;
        //        a.download = fileName;
        //        document.body.appendChild(a);
        //        a.click();
        //        a.remove(); 


        //        hideLoading();

        //    },
        //    error: function (xhr, textStatus, errorThrown) {

        //        console.log('Errore nella richiesta PUT: ' + errorThrown);
        //    },

        //});

    }

}