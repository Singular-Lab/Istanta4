const InputEditController = require('./InputEditController');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const { app, PDFExportOptions, CompressionQuality } = require('indesign');
const fs = require('fs');

const schedaArtwork = {
    existingArtwork:null,
    potentialArtwork: null,
    codici:[],
    idRecs:[],
    schedeRefDati:[],
    refs: null,
    job:[],
    showSchermataArtworkMultiRef(refs, artwork){
        this.refs = refs;
        this.potentialArtwork = artwork;
        this.idRecs = [];
        $("#artworkTab").show();
        //$("#artworkTab").click();
        jsIndexControls.changeSubMenu($("#artworkTab").attr("subTab"));
        jsIndexControls.changeImage($("#artworkTab"));
        onresizeWindow();

        $("#collegaAdArtwork").show();
        $("#scollegTuttoArtwork").hide();

        $("#listaGruppiArtwork").empty();
        for(let i=0; i<this.refs.length; i++)
        {
            let item = this.refs[i];
            let idRec = null;
            if (item != null && item.idRec != null && item.idRec !== "" && !isNaN(parseInt(item.idRec))) {
                idRec = parseInt(item.idRec);
            }
            this.idRecs.push(idRec);
            $("#listaGruppiArtwork").append("<h4 class=\"artworkGroupListed\">"+(i+1)+". " + item.codiceGruppo + "</h4>");
        }

    },
    showSchermataArtworkEsistente(artworkEl){
        this.existingArtwork=artworkEl;

        showLoading("Recupero informazioni...");

        $("#artworkTab").show();
        //$("#artworkTab").click();
        jsIndexControls.changeSubMenu($("#artworkTab").attr("subTab"));
        jsIndexControls.changeImage($("#artworkTab"));
        onresizeWindow();


        $("#collegaAdArtwork").hide();
        $("#scollegTuttoArtwork").show();

        console.log("Scrivo i dettagli dell'artwork "  + this.existingArtwork.label);

        $("#listaGruppiArtwork").empty();
        this.codici = this.existingArtwork.label.split("_")[1].split("-");
        this.idRecs = this.codici.map(cod => this.getIdRecByCodice(cod));
        let me=this;
        //Coda di recupero info per ogni record artwork
        this.bindDati(0);

        // for(let i=0; i<cods.length; i++)
        // {
        //     let gruppo = cods[i];
        //     $("#listaGruppiArtwork").append("<h4 class=\"artworkGroupListed\">"+(i+1)+". " + gruppo + "</h4>");
        // }
    },
    bindDati(indice){
        let me=this;

        try{
            if (indice>=this.codici.length)
            {
                hideLoading();
                //Inserisco trigger pulsanti
                $(".bSelectRefInArtwork").on("click", async function(){
                    let cod=$(this).attr("codice");
                    let idRecAttr = $(this).attr("idRec");
                    let idRec = null;
                    if (idRecAttr != null && idRecAttr !== "" && !isNaN(parseInt(idRecAttr))) {
                        idRec = parseInt(idRecAttr);
                    }
                    console.log("Seleziono " + cod);
    
                    showLoading("Ricerca...");
    
                    let item = await me.processoDiRicerca(cod, idRec);
                    if (item==null)
                    {
                        hideLoading();
                        messaggioUtente("Code ATW-1 Elemento non trovato", "error");
                    }
                    else
                    {
                        hideLoading();
                        item.select();
                    }
                    
    
                });
                return;
                
            }
            me.schedeRefDati.splice(0);
            let cod=this.codici[indice];
            let idRec = this.idRecs != null && this.idRecs.length > indice ? this.idRecs[indice] : null;
            this.getSchedaRef(cod, (error, schedaRef) => {
                if (error) {
                    console.error("Code ATW-2 Errore durante la richiesta:", error);
                    messaggioUtente("Code ATW-2 Errore durante la richiesta", "error");
                    hideLoading();
                    return;
                }
                me.schedeRefDati.push(schedaRef);
                let descr=schedaRef.records[0].recordInTracciato["Descrizioni.Descrizione1"];
                if (cod.split(",").length>1)
                {
                    if (schedaRef.records[0].recordInTracciato.descrizione_gruppo!=null)
                    {
                        descr = schedaRef.records[0].recordInTracciato.descrizione_gruppo["Descrizioni.Descrizione1"];
                    }
    
                }
    
                $("#listaGruppiArtwork").append("<div style=\"margin-bottom:10px;\"><div style=\"display:flex;\"><div style=\"width:37px;\"><button class=\"bSelectRefInArtwork\" codice=\""+cod+"\" idRec=\""+(idRec != null ? idRec : "")+"\">S</button></div><div style=\"width:380px;padding-top:7px;\"><h4 class=\"artworkGroupListed\">"+(indice+1)+". " + cod + "</h4></div></div><div><span>"+ descr +"</span></div>");
    
                me.bindDati(indice+1);
            }, idRec != null ? idRec : 0);
        }
        catch(e){
            console.error("Code ATW-3 Errore durante il binding dei dati:", e);
            messaggioUtente("Code ATW-3 Errore durante il binding dei dati: " + e.message, "error");
            hideLoading();
        }
    },

    getSchedaRef(codiceGruppo, callback, idRec = 0) {
        var xhr = new XMLHttpRequestClient();
    
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code ATW-4 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                // Chiamata alla callback con il risultato ottenuto
                if (callback) {
                    callback(null, objResult); // Passiamo `null` come primo argomento per indicare che non c'è errore
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
    
        // Esegui la richiesta GET
        var formData = new FormData();
        formData.append("codiceGruppo", codiceGruppo);
        formData.append("idRec", idRec);
        xhr.send("Menabo/getSchedaRef/" + idKitLavorazione + "/" + false, formData, "PUT");
    },
    esportaFotoArtwork(idArtwork, cbk){
        let fileArtwork=pathLavorazione + "/" + idArtwork + ".png";
        let preset=app.pdfExportPresets.add();
        preset.colorBitmapQuality=CompressionQuality.MAXIMUM;
        preset.colorBitmapSamplingDPI=150;
        //preset.appliedFlattenerPreset.
        this.potentialArtwork.exportFile(ExportFormat.PNG_FORMAT,fileArtwork, false, preset);

        const fileBuffer = fs.readFileSync(fileArtwork);

        //const file = new Blob([fileBuffer], idArtwork + ".png", { type: "image/png" });

        var formData = new FormData();
        formData.append("Sigla", idArtwork);
        formData.append("Tipo", 6);
        formData.append("file", fileBuffer);//{file:fileBuffer,nomeFile:idArtwork + ".png", filePath:fileArtwork});
        
        var xhr = new XMLHttpRequestClient();
        xhr.onload = async (data, parsed) => {
            try {
                if (data.error != null && data.error != "") {
                    messaggioUtente("Code ATW-5: " + data.error, "error");                                        
                }
                if (data.esito == false) {
                    cbk("");
                    return;
                }
                console.log("Success");
                console.log(data);
                cbk(data.item.guidId);
            }
            catch (e) {
                console.log(e);
                messaggioUtente("Code ATW-6 Errore generico durante l'upload dell'immagine: " + e, "error");
                cbk("");
            }
        }
        xhr.onreadystatechange = function () {}
        xhr.onerror = function () {}
        xhr.sendFiles("LoghiBolli/salva", formData);
    },
    raggruppaSottoArtwork() {

        if (this.potentialArtwork.label.startsWith("artwork")) {
            //Non si puo creare un artwork su un artowr già esistente, al massimo si edita
            messaggioUtente("Impossibile creare un artwork su un artwork già esistente", "error");
            return;
        }

        setTimeout(() => {
        showLoading("Operazione in corso...");}, 100);

        var artwork = this.potentialArtwork;
        var refs = this.refs;

        if (artwork == null) {
            messaggioUtente("Selezionare prima un artwork", "error");
            return;
        }
        
        this.job=[];

        //se artwork è diverso da null allora prendiamo tutte le selezioni e per ognuna cechiamo la base in se e nei suoi figli, se non c'è mandiamo un errore e torniamo reimpostando l'artwork a null
        var codici = [];
        for (var i = 0; i < refs.length; i++) {
            let item = refs[i];
            //salviamo in codici il codice gruppo di base
            codici.push(item.codiceGruppo);
            this.job.push({codiceGruppo: item.codiceGruppo});
        }

        let artworkId = "artwork_" + codici.join("-");

        //assegno artworkId a tutti i job
        this.job.forEach(j => j.artworkId = artworkId);

        let me=this;
        //Creo foto artowrk
        this.esportaFotoArtwork(artworkId, function(guidId)
        {
            //Cambio i meta sul server
            var xhr = new XMLHttpRequestClient();
            xhr.onload = (objResult, parsed) => {
                try {
                    if (!parsed) {
                        try {
                            objResult = JSON.parse(objResult);
                        } catch (e) {
                            messaggioUtente("Code ATW-4 Errore durante il parsing della risposta: " + e, "error");
                            hideLoading();
                            return;
                        }
                    }
                    console.log(objResult);
                    //mi dovrebbe tornare un oggetto con tre parametri, esito, error e listaGruppi
                    if (!objResult.esito) {
                        messaggioUtente("Code ATW-4 Errore durante l'operazione: " + objResult.error, "error");
                        hideLoading();
                        return;
                    }

                    artwork.label = artworkId;
                    //cbk();

                    //Adesso deve applicare le etichette alle ref coinvolte
                    me.etichettaturaRef("collega");
                    //messaggioUtente("Creazione Artwork avvenuta con successo!", "success");
                    //hideLoading();

                    app.selection = null;

                }
                catch (e) {
                    messaggioUtente("Code ATW-7 Creazione Artwork: Errore: " + e, "error");
                    console.log(e);
                }
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        messaggioUtente("Code ATW-8 Creazione Artwork: Richiesta completata con successo", "success", false, 5);
                    } else {
                        //messaggioUtente("raggruppa: Errore durante la richiesta: " + xhr.status, "error");
                    }
                }
            };

            xhr.onerror = function () {
                //messaggioUtente("raggruppa: Errore di rete", "error");
            }

            var params = "Id=" + artworkId;
            params += "&FotoId=" + guidId;
            params += "&delete=false";
            

            //messaggioUtente("Creazione Artwork: Richiesta inviata", "success", true, 3, true);
            xhr.send("Menabo/setArtwork/" + idKitLavorazione + "/" + 0, params, "PUT", "application/x-www-form-urlencoded");
        });

        
        
    },
    etichettaturaRef(azione)
    {        
        for(let i=0; i<this.refs.length; i++)
        {
            let el = this.refs[i].item;

            if (azione=="collega")
            {
                let etichettaField = el.parentPage.textFrames.add();
                etichettaField.geometricBounds = [el.geometricBounds[0], el.geometricBounds[1], el.geometricBounds[0] + 4 , el.geometricBounds[1] + 15];
                //Stile etichetta
                etichettaField.contents = "ARTWORK";
                //controlliamo l'overflow e se esiste allarghiamo gradualmente orizzontalmente l'etichetta finchè non c'è più overflow
                etichettaField.label = "etichetta_artwork";
                try {
                    etichettaField.paragraphs.item(0).appliedParagraphStyle = docInLavorazione.paragraphStyles.itemByName("Etichetta");
                    etichettaField.fillColor = "Etichetta";
                } catch (err) {
                    console.log(err);
                }


                let page = el.parentPage;
                var oldGroup = el;//field.parent;
                var oldLabel = oldGroup.label;
                var oldItems = oldGroup.pageItems.everyItem().getElements();

                oldGroup.ungroup();

                

                var newItems = oldItems.concat(etichettaField);
                var newGroup = page.groups.add(newItems);
                newGroup.label = oldLabel;

            }
            else
            {
                //Rimuovo etichetta
            }

        }


        messaggioUtente("Creazione Artwork avvenuta con successo!", "success", false, 5);
        hideLoading();

    },
    
    async eliminaArtwork(artworkLabel = null)
    {
        let me=this;
        showLoading("Operazione in corso...");
        let artworkExternal = artworkLabel != null;
        if (artworkLabel == null) {
            artworkLabel = this.existingArtwork.label;
        }

        var xhr = new XMLHttpRequestClient();
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code ATW-09 Errore durante il parsing della risposta: " + e, "error");
                        hideLoading();
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con tre parametri, esito, error e listaGruppi
                if (!objResult.esito) {
                    messaggioUtente("Code ATW-10 Errore durante l'operazione: " + objResult.error, "error");
                    hideLoading();
                    return;
                }

                if(artworkExternal) {
                    $("#selezionaArtwork").hide();
                }
                else{
                    me.existingArtwork.label="";
                }
                //docInLavorazione.pageItems.itemByID(artwork.id).label = "";

                //messaggioUtente("Eliminazione Artwork avvenuta con successo!","success");
                //hideLoading();
                if(!artworkExternal){ //se è uguale a null l'artwork non è stato trovato e si arriva da un elemento collegato (schedaref), per questo non avendo le schedeRefDati non possiamo risalire agli elementi collegati
                    showLoading("Rimozione etichette");
    
                    let errorReportRimozioneEtichette="";
                    for (let s=0; s<me.schedeRefDati.length; s++)
                    {
                        let scheda = me.schedeRefDati[s];
                        let cod = scheda.records[0].recordInTracciato["Scatto.CodiceGruppo"];
                        
                        let item = await me.processoDiRicerca(cod);
                        if (item==null)
                        {
                            errorReportRimozioneEtichette += "Elemento " + cod + " non trovato\n";
                        }
                        else
                        {
                            //Cerco etichetta_artwork tra gli elementi
                            for (let i=0; i<item.pageItems.length; i++)
                            {
                                let el = item.pageItems.item(i);
                                if (el.label=="etichetta_artwork")
                                {
                                    el.remove();
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (errorReportRimozioneEtichette!="")
                    {
                        messaggioUtente("Code ATW-11 Errore durante la rimozione delle etichette: " + errorReportRimozioneEtichette, "error");
                    }
    
                }
                
                hideLoading();

                app.selection = null;
            }
            catch (e) {
                messaggioUtente("Code ATW-12 Errore generico durante l'eliminazione dell'Artwork: " + e, "error");
                console.log(e);
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    //messaggioUtente("Eliminazione Artwork: Richiesta completata con successo", "success", false, 5);
                } else {
                    //messaggioUtente("raggruppa: Errore durante la richiesta: " + xhr.status, "error");
                }
            }
        };

        xhr.onerror = function () {
            //messaggioUtente("raggruppa: Errore di rete", "error");
        }

        var params = "Id=" + (artworkLabel != null ? artworkLabel : this.existingArtwork.label);
        params += "&delete=true";
        

        messaggioUtente("Elimina Artwork: Richiesta inviata", "success", true, 3, true);
        xhr.send("Menabo/setArtwork/" + idKitLavorazione + "/" + 0, params, "PUT", "application/x-www-form-urlencoded");
    },

    async cercaArtwork(page, artworkId){
        try{
            showLoading("Ricerca Artwork in corso...");
            await Utility.sleep(100);
            var items = page.pageItems;
            for (var i = 0; i < items.length; i++) {
                var item = items.item(i);
                if (item.label == artworkId) {
                    //eliminazione dell'item
                    hideLoading();
                    return item;
                }
            }
    
            //se non lo troviamo nella pagina corrente, iniziamo a cercare nelle pagine limitrofe
            var currentPageIndex = parseInt(page.name);
            var pageDistance = 1;
            var pages = docInLavorazione.pages;
            var searchFailed = false;
            var securityCounter = 0;
    
            while (!searchFailed && securityCounter < 100) {
                var noPreviousPage = false;
                var noNextPage = false;
                //cerchiamo prima nella pagina precedente e poi in quella successiva applicando 
                var previousPageIndex = currentPageIndex - pageDistance;
                if (previousPageIndex >= 0 && previousPageIndex < pages.length) {
                    var previousPage = pages.item(previousPageIndex);
                    items = previousPage.pageItems;
                    for (var i = 0; i < items.length; i++) {
                        var item = items.item(i);
                        if (item.label == artworkId) {
                            //eliminazione dell'item
                            hideLoading();
                            return item;
                        }
                    }
                }
                else {
                    noPreviousPage = true;
                }
    
                var nextPageIndex = currentPageIndex + pageDistance;
                if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
                    var nextPage = pages.item(nextPageIndex);
                    items = nextPage.pageItems;
                    for (var i = 0; i < items.length; i++) {
                        var item = items.item(i);
                        if (item.label == artworkId) {
                            //eliminazione dell'item
                            hideLoading();
                            return item;
                        }
                    }
                }
                else {
                    noNextPage = true;
                }
    
                //incrementiamo la distanza per cercare nelle pagine più lontane
                pageDistance++;
                if (noPreviousPage && noNextPage) {
                    searchFailed = true;
                }
                securityCounter++;
            }
    
            if (searchFailed) {
                console.warn("CercaArtwork: Artwork non trovato dopo 100 tentativi di ricerca");
                hideLoading();
    
                return null; // Non trovato
            }
        }
        catch(e){
            console.error("Errore durante la ricerca dell'artwork:", e);
            messaggioUtente("Code ATW-13 Errore generico durante la ricerca dell'artwork: " + e.message, "error");
            hideLoading();
            return null;
        }

    },

    getIdRecByCodice(codice)
    {
        try {
            if (this.existingArtwork == null || this.existingArtwork.parentPage == null) {
                return null;
            }

            let pag = this.existingArtwork.parentPage;
            for (let p=0; p<pag.allPageItems.length; p++)
            {
                let item = pag.allPageItems[p];
                if (item.constructor.name =="Group")
                {
                    let dna = Utility.getDnaOfBox(item);
                    if (dna!=null && dna.codice_gruppo==codice)
                    {
                        if (dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                            return parseInt(dna.idRec);
                        }
                        return null;
                    }
                }
            }
        }
        catch(e){
            console.warn("Impossibile recuperare idRec per codice gruppo " + codice + ": " + e.message);
        }

        return null;
    },

    async processoDiRicerca(codice, idRec = null)
    {
        return new Promise(resolve => setTimeout(() => {
            let pag = this.existingArtwork.parentPage;
            let foundItem=null;
            for (let p=0; p<pag.allPageItems.length; p++)
            {
                let item = pag.allPageItems[p];
                if (item.constructor.name =="Group")
                {
                    let dna = Utility.getDnaOfBox(item);
                    let idRecMatch = true;
                    if (idRec != null) {
                        idRecMatch = dna != null && dna.idRec != null && !isNaN(parseInt(dna.idRec)) && parseInt(dna.idRec) == parseInt(idRec);
                    }

                    if (dna!=null && dna.codice_gruppo==codice && idRecMatch)
                    {
                        foundItem=item;
                        //found=true;
                        break;                    
                        
                    }
                }
            }
            resolve(foundItem);
        }, 500));

        
    }
};

module.exports = schedaArtwork;