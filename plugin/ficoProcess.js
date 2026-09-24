const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const lavorazioneDelDocumento = require('./lavorazioneDelDocumento');
const { app, ExportFormat } = require('indesign');
const path = require('path');
const FicoProcess=
{    
    errorScaricamentoFicoDataCallback:null,
    successScaricamentoFicoDataCallback:null,
    sourceAree:null,
    sourceCanali:null,
    sourceFormati:null,
    sourceTipiExport:null,
    listaPromoAperte:[],
    cacheKitSearchResult:null,
    cacheKitFilterResult:null,
    datiFicoScaricati:false,
    abortExport:false,
    listaElementiMateriali:[],
    metaLavorazioneCorrente:{},
    init:function(succesCbk, errorCbk)
    {
        //Inizializza FICO PRocess scaricando tutti i dati da Istanta
        //Funzione da richiamare ogniqualvolta si voglia aggiornare il set di dati fico
        this.errorScaricamentoFicoDataCallback=errorCbk;
        this.successScaricamentoFicoDataCallback=succesCbk;

        this.scaricaFicoData(true);
    },
    checklavorazioneSelezionata:async function()
    {
        //VAriabile globale
        idKitLavorazione = 0;

        var file = readFile(pathLavorazione + "/lavorazioni.json");
        
        if(file != null){
            //console.log(file);
            //I20-936: la ricerca sta in lavorazioneDelDocumento, cosi' si puo' verificare sotto Node.
            let refLavorazione = lavorazioneDelDocumento.trovaLavorazione(file, app.activeDocument.name);
            //console.log(resFileValorazione);
            if (refLavorazione != null)
            {
                //La lavorazione è stata trovata
                idKitLavorazione = refLavorazione.id;
                            
                let metaObj=JSON.parse(refLavorazione.details.meta);
                let titoloKit = metaObj.titolo || "";
                let titoloKitTroncato = titoloKit.length > 50 ? titoloKit.substring(0, 50) + "..." : titoloKit;
                $("#nomeKitInLavorazione").text(titoloKitTroncato).attr("title", titoloKit);

                if (this.sourceFormati == null || this.sourceCanali == null || this.sourceAree == null || this.sourceTipiExport == null) {
                    await ficoProcess.scaricaFicoData(true);
                }
                let formatoObj = this.sourceFormati.find(f=>f.guidID == metaObj.guidFormato);
                let canaleObj = this.sourceCanali.find(c=>c.guidID == metaObj.guidCanale);
                let areaObj = this.sourceAree.find(a=>a.guidID == metaObj.guidArea);
                if (formatoObj!=null)
                {
                    this.metaLavorazioneCorrente = {meta:metaObj, formatoDetails:formatoObj, canaleDetails:canaleObj, areaDetails:areaObj};
                }

                console.log("Lavorazione trovata: " + idKitLavorazione);

                if (formatoObj == null || canaleObj == null || areaObj == null)
                    return false;
            }
            else
            {
                console.log("Lavorazione non trovata");
                return false;
            }
        }
        else
        {
            console.log("File inseistente e quindi lavorazione non trovata");
            return false;
        }

        return true;

    },
    getTipoLavorazioneCorrente:function()
    {
        if (this.metaLavorazioneCorrente!=null)
        {
            if (this.metaLavorazioneCorrente.formatoDetails!=null)
                return this.metaLavorazioneCorrente.formatoDetails.tipo;
        }
        
        return 0;
    },
    getFormatoLavorazioneCorrente:function()
    {
        if (this.metaLavorazioneCorrente!=null)
        {
            if (this.metaLavorazioneCorrente.formatoDetails!=null)
                return this.metaLavorazioneCorrente.formatoDetails;
        }
        
        return 0;
    },
    getCanaleLavorazioneCorrente:function()
    {
        if (this.metaLavorazioneCorrente!=null)
        {
            if (this.metaLavorazioneCorrente.canaleDetails!=null)
                return this.metaLavorazioneCorrente.canaleDetails;
        }
        
        return 0;
    },

    getAreaLavorazioneCorrente:function()
    {
        if (this.metaLavorazioneCorrente!=null)
        {
            if (this.metaLavorazioneCorrente.areaDetails!=null)
                return this.metaLavorazioneCorrente.areaDetails;
        }
        
        return 0;
    },

    // scaricaFicoData:function(force) 
    // {
    //     if (userLoggedDetails!=null)
    //     {       
    //         //Se non sono loggato è inutile fare la ricerca di fico data, rimbalzerei
    //         console.log("scarica Fico DATA " + [this.datiFicoScaricati,force]);
    //         if (!this.datiFicoScaricati || force)
    //         {
    //             console.log("scaricaFicoData");
                
    //             sourceAree=null;
    //             sourceCanali=null;
    //             sourceFormati=null;
    //             sourceTipiExport=null;
    //             pluginMiddleware.customPluginDB = null;
    //             pluginMiddleware.getCustomPlugin().then((result) => {
    //                 //Inizia la catena di scaricamento
    //                 this.refreshPromo();
    //             }).catch((err) => {
    //                 messaggioUtente("Code FIP-00 Errore generico durante il caricamento dei dati plugin di agenzia", "error");
    //                 console.log(err);
    //                 if (this.errorScaricamentoFicoDataCallback != null) {
    //                     this.errorScaricamentoFicoDataCallback(err);
    //                 }
    //             });
    //         }
    //     }
    //     else
    //     {
    //         this.datiFicoScaricati=false;
    //     }
    
    // },    


    scaricaFicoData: async function (force) {
        if (userLoggedDetails != null) {
            console.log("scarica Fico DATA " + [this.datiFicoScaricati, force]);

            if (!this.datiFicoScaricati || force) {
                console.log("scaricaFicoData");

                sourceAree = null;
                sourceCanali = null;
                sourceFormati = null;
                sourceTipiExport = null;
                pluginMiddleware.customPluginDB = null;

                try {
                    await pluginMiddleware.getCustomPlugin();

                    // Aspetta che refreshPromo finisca
                    await this.refreshPromo();
                }
                catch (err) {
                    messaggioUtente(
                        "Code FIP-00 Errore generico durante il caricamento dei dati plugin di agenzia",
                        "error",
                        false, 
                        5, 
                        true
                    );

                    console.log(err);

                    if (this.errorScaricamentoFicoDataCallback != null) {
                        this.errorScaricamentoFicoDataCallback(err);
                    }
                }
            }
        }
        else {
            this.datiFicoScaricati = false;
        }
    },

    requestFicoData: function (url, method = "GET") {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequestClient();

            xhr.onload = (objResult, parsed) => {
                try {
                    if (!parsed) {
                        objResult = JSON.parse(objResult);
                    }

                    resolve(objResult);
                }
                catch (e) {
                    reject(e);
                }
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4 && xhr.status != 200) {
                    reject("Errore HTTP " + xhr.status + " su " + url);
                }
            };

            xhr.onerror = function () {
                reject("Errore di rete su " + url);
            };

            xhr.send(url, null, method);
        });
    },

    // refreshPromo:function()
    // {
    //     //Refresh promo
    //     let me=this;

    //     var endend = false;
    //     const xhr = new XMLHttpRequestClient();
    //     xhr.onload = (objResult, parsed) => {
    //         try {
    //             if (!parsed) {
    //                 objResult = JSON.parse(objResult);
    //             }

    //             me.listaPromoAperte=objResult;
    //             //console.log("promo aperte");
    //             //console.log(objResult);
    //             var menu = $("#kitPromoCmb").find("sp-menu");
    //             menu.empty();
    //             menu.append("<sp-menu-item value='0' selected>Seleziona una promo</sp-menu-item>");

    //             for(let p=0; p<objResult.length; p++)
    //             {
    //                 //console.log(">>>>" + objResult[p].nomePromo);
    //                 menu.append("<sp-menu-item value="+ objResult[p].guidID +">"+objResult[p].nomePromo+"</sp-menu-item>");
    //             }

    //             me.refreshFormati();

    //             menu.on("change", function(e)
    //             {
    //                 console.log("Evvai!");
    //                 kitPromoCmb_changed();
    //             });

    //         }
    //         catch (ex) {
    //             messaggioUtente("Code FIP-01 Errore generico durante il caricamento delle promo", "error");
    //             console.log(ex);
    //             if (me.errorScaricamentoFicoDataCallback!=null)
    //             {
    //                 me.errorScaricamentoFicoDataCallback(ex);
    //             }

    //         }
    //         finally {
    //             endend = true;
    //         }
    //     }

    //     xhr.onreadystatechange = function () {
    //         if (xhr.readyState == 4) {
    //             if (xhr.status == 200) {
    //                 //messaggioUtente("Richiesta completata con successo", "success");
    //             } else {
    //                 //messaggioUtente("impostaTendinaTracciato: Errore durante la richiesta dei tracciati: " + xhr.status, "error");
    //             }
    //         }
    //     };

    //     xhr.onerror = function () {
    //         //messaggioUtente("impostaTendinaTracciato: Errore di rete", "error");
    //         if (me.errorScaricamentoFicoDataCallback!=null)
    //         {
    //             me.errorScaricamentoFicoDataCallback("refreshPromo error generico");
    //         }
    //     };


    //     xhr.send("Tracciati/getPromoAperte", null, "GET");
    // },

    // refreshFormati:function()
    // {
    //     let me=this;

    //     var xhr = new XMLHttpRequestClient();
    //     xhr.onload = async (objResult, parsed) => 
    //     {
    //         try {

    //             if (!parsed) {
    //                 try{
    //                     objResult = JSON.parse(objResult);
    //                 }
    //                 catch(e){
    //                     messaggioUtente("Code FIP-02 Errore durante il parsing della risposta:" + e, "error");
    //                     return;
    //                 }
    //             }

    //             me.sourceFormati=objResult.content != null ? objResult.content : objResult;


    //             //Per il momento li impagino una sola volta
    //             let menuFormati = $("#kitFormatiCmb").find("sp-menu");
    //             menuFormati.empty();
    //             menuFormati.append("<sp-menu-item value=\"0\" selected>Seleziona Formato</sp-menu-item>");

    //             for (let i=0; i<me.sourceFormati.length; i++)
    //             {
    //                 let formato=me.sourceFormati[i];
    //                 menuFormati.append("<sp-menu-item value=\""+formato.guidID+"\">" + formato.titolo + "</sp-menu-item>");
    //             }         

    //             me.refreshCanali();

    //         }
    //         catch (e) {

    //             if (me.errorScaricamentoFicoDataCallback!=null)
    //             {
    //                 me.errorScaricamentoFicoDataCallback(e);
    //             }
    //         }


    //     }
    //     xhr.onreadystatechange = function () {};
    //     xhr.onerror = function () {

    //         if (me.errorScaricamentoFicoDataCallback!=null)
    //         {
    //             me.errorScaricamentoFicoDataCallback("refreshFormati error generico");
    //         }

    //     };
    //     xhr.send("FicoProcess/getFormati", null, "GET");
    // },
    // refreshCanali:function()
    // {
    //     let me=this;

    //     var xhr = new XMLHttpRequestClient();
    //     xhr.onload = async (objResult, parsed) => {
    //         try {
    //             try {
    //                 if (!parsed) {
    //                     try{
    //                         objResult = JSON.parse(objResult);
    //                     }
    //                     catch(e){
    //                         messaggioUtente("Code FIP-02 Errore durante il parsing della risposta:" + e, "error");
    //                         return;
    //                     }
    //                 }
    //                 me.sourceCanali = objResult;
    //                 console.log("sourceCanali");
    //                 console.log(objResult);

    //                 me.refreshAree();



    //             }
    //             catch (e) {
    //                 if (me.errorScaricamentoFicoDataCallback!=null)
    //                 {
    //                     me.errorScaricamentoFicoDataCallback(e);
    //                 }
    //             }

    //         }
    //         catch (e) {
    //             if (me.errorScaricamentoFicoDataCallback!=null)
    //             {
    //                 me.errorScaricamentoFicoDataCallback(e);
    //             }
    //         }
    //     }
    //     xhr.onreadystatechange = function () {};
    //     xhr.onerror = function () {
    //         if (me.errorScaricamentoFicoDataCallback!=null)
    //         {
    //             me.errorScaricamentoFicoDataCallback("refreshCanali error generico");
    //         }
    //     };

    //     xhr.send("ACPV/getCanali", null, "GET");
    // },
    // refreshAree:function()
    // {
    //     let me=this;

    //     var xhr = new XMLHttpRequestClient();
    //     xhr.onload = async (objResult, parsed) => {
    //         try {
    //             try {
    //                 if (!parsed) {
    //                     try{
    //                         objResult = JSON.parse(objResult);
    //                     }
    //                     catch(e){
    //                         messaggioUtente("Code FIP-02 Errore durante il parsing della risposta:" + e, "error");
    //                         return;
    //                     }
    //                 }
    //                 //console.log(objResult);
    //                 me.sourceAree = objResult;
    //                 console.log("sourceAree");

    //                 me.refreshTipiExport();

    //             }
    //             catch (e) {

    //                 if (me.errorScaricamentoFicoDataCallback!=null)
    //                 {
    //                     me.errorScaricamentoFicoDataCallback(e);
    //                 }
    //             }

    //         }
    //         catch (e) {
    //             if (me.errorScaricamentoFicoDataCallback!=null)
    //             {
    //                 me.errorScaricamentoFicoDataCallback(e);
    //             }
    //         }


    //     }

    //     xhr.onreadystatechange = function () {};
    //     xhr.onerror = function () {
    //         if (me.errorScaricamentoFicoDataCallback!=null)
    //         {
    //             me.errorScaricamentoFicoDataCallback("refreshAree error generico");
    //         }
    //     };

    //     xhr.send("ACPV/getAree", null, "GET");
    // },
    // refreshTipiExport:function()
    // {
    //     let me=this;

    //     var xhr = new XMLHttpRequestClient();
    //     xhr.onload = async (objResult, parsed) => {
    //         try {
    //             try {
    //                 if (!parsed) {
    //                     try{
    //                         objResult = JSON.parse(objResult);
    //                     }
    //                     catch(e){
    //                         messaggioUtente("Code FIP-02 Errore durante il parsing della risposta:" + e, "error");
    //                         return;
    //                     }
    //                 }
    //                 //console.log(objResult);
    //                 me.sourceTipiExport = objResult;
    //                 console.log("sourceTipiDiExport");
    //                 console.log(me.sourceTipiExport);

    //                 let menuTipiExport = $("#cmbTipiDiExport").find("sp-menu");
    //                 menuTipiExport.empty();
    //                 //menuTipiExport.append('<option value="0" selected>Seleziona tipo di esportazione disponibile</option>');
    //                 menuTipiExport.append("<sp-menu-item selected value=\"0\">Seleziona tipo di esportazione disponibile</sp-menu-item>");

    //                 for(let te=0; te<me.sourceTipiExport.content.length; te++)
    //                 {
    //                     let item = me.sourceTipiExport.content[te];
    //                     //menuTipiExport.append('<option value="'+item.guidID+'">'+item.titolo+'</option>');

    //                     if(me.tipoDiExportValido(item.guidID))
    //                     {
    //                         menuTipiExport.append("<sp-menu-item value=\""+item.guidID+"\">"+item.titolo+"</sp-menu-item>");
    //                     }
    //                 }

    //                 me.datiFicoScaricati=true;
    //                 if (me.successScaricamentoFicoDataCallback!=null)
    //                 {
    //                     me.successScaricamentoFicoDataCallback();
    //                 }

    //             }
    //             catch (e) {
    //                 if (me.errorScaricamentoFicoDataCallback!=null)
    //                 {
    //                     me.errorScaricamentoFicoDataCallback(e);
    //                 }
    //             }

    //         }
    //         catch (e) {
    //             if (me.errorScaricamentoFicoDataCallback!=null)
    //             {
    //                 me.errorScaricamentoFicoDataCallback(e);
    //             }
    //         }


    //     }

    //     xhr.onreadystatechange = function () {};
    //     xhr.onerror = function () {
    //         if (me.errorScaricamentoFicoDataCallback!=null)
    //         {
    //             me.errorScaricamentoFicoDataCallback("refreshTipiExport error generico");
    //         }
    //     };
    //     xhr.send("FicoProcess/getTipiDiExport", null, "GET");
    // },

    refreshPromo: async function () {
        try {
            let objResult = await this.requestFicoData("Tracciati/getPromoAperte");

            this.listaPromoAperte = objResult;

            let menu = $("#kitPromoCmb").find("sp-menu");
            menu.empty();
            menu.append("<sp-menu-item value='0' selected>Seleziona una promo</sp-menu-item>");

            for (let p = 0; p < objResult.length; p++) {
                menu.append(
                    "<sp-menu-item value=\"" + objResult[p].guidID + "\">" +
                    objResult[p].nomePromo +
                    "</sp-menu-item>"
                );
            }

            menu.off("change").on("change", function (e) {
                console.log("Evvai!");
                kitPromoCmb_changed();
            });

            await this.refreshFormati();
        }
        catch (ex) {
            messaggioUtente("Code FIP-01 Errore generico durante il caricamento delle promo", "error", false, 5, true);
            console.log(ex);

            if (this.errorScaricamentoFicoDataCallback != null) {
                this.errorScaricamentoFicoDataCallback(ex);
            }

            throw ex;
        }
    },

    refreshFormati: async function () {
        try {
            let objResult = await this.requestFicoData("FicoProcess/getFormati");

            this.sourceFormati = objResult.content != null ? objResult.content : objResult;

            let menuFormati = $("#kitFormatiCmb").find("sp-menu");
            menuFormati.empty();
            menuFormati.append("<sp-menu-item value=\"0\" selected>Seleziona Formato</sp-menu-item>");

            for (let i = 0; i < this.sourceFormati.length; i++) {
                let formato = this.sourceFormati[i];

                menuFormati.append(
                    "<sp-menu-item value=\"" + formato.guidID + "\">" +
                    formato.titolo +
                    "</sp-menu-item>"
                );
            }

            await this.refreshCanali();
        }
        catch (e) {
            messaggioUtente("Code FIP-02 Errore durante il caricamento dei formati", "error", false, 5, true);
            console.log(e);

            if (this.errorScaricamentoFicoDataCallback != null) {
                this.errorScaricamentoFicoDataCallback(e);
            }

            throw e;
        }
    },

    refreshCanali: async function () {
        try {
            let objResult = await this.requestFicoData("ACPV/getCanali");

            this.sourceCanali = objResult;

            console.log("sourceCanali");
            console.log(objResult);

            await this.refreshAree();
        }
        catch (e) {
            messaggioUtente("Code FIP-03 Errore durante il caricamento dei canali", "error", false, 5, true);
            console.log(e);

            if (this.errorScaricamentoFicoDataCallback != null) {
                this.errorScaricamentoFicoDataCallback(e);
            }

            throw e;
        }
    },

    refreshAree: async function () {
        try {
            let objResult = await this.requestFicoData("ACPV/getAree");

            this.sourceAree = objResult;

            console.log("sourceAree");

            await this.refreshTipiExport();
        }
        catch (e) {
            messaggioUtente("Code FIP-04 Errore durante il caricamento delle aree", "error", false, 5, true);
            console.log(e);

            if (this.errorScaricamentoFicoDataCallback != null) {
                this.errorScaricamentoFicoDataCallback(e);
            }

            throw e;
        }
    },

    refreshTipiExport: async function () {
        try {
            let objResult = await this.requestFicoData("FicoProcess/getTipiDiExport");

            this.sourceTipiExport = objResult;

            console.log("sourceTipiDiExport");
            console.log(this.sourceTipiExport);

            let menuTipiExport = $("#cmbTipiDiExport").find("sp-menu");
            menuTipiExport.empty();

            menuTipiExport.append(
                "<sp-menu-item selected value=\"0\">" +
                "Seleziona tipo di esportazione disponibile" +
                "</sp-menu-item>"
            );

            for (let te = 0; te < this.sourceTipiExport.content.length; te++) {
                let item = this.sourceTipiExport.content[te];

                if (this.tipoDiExportValido(item.guidID).valido) {
                    menuTipiExport.append(
                        "<sp-menu-item value=\"" + item.guidID + "\">" +
                        item.titolo +
                        "</sp-menu-item>"
                    );
                }
            }

            this.datiFicoScaricati = true;

            if (this.successScaricamentoFicoDataCallback != null) {
                this.successScaricamentoFicoDataCallback();
            }
        }
        catch (e) {
            messaggioUtente("Code FIP-05 Errore durante il caricamento dei tipi export", "error", false, 5, true);
            console.log(e);

            if (this.errorScaricamentoFicoDataCallback != null) {
                this.errorScaricamentoFicoDataCallback(e);
            }

            throw e;
        }
    },
    
    cercaKit:function(cbk)
    {
        console.log("Cerco KIT: " + $("#kitPromoCmb").val() + " - " + $("#kitFormatiCmb").val() + " - " + $("#kitCanaliCmb").val() + " - " + $("#kitAreeCmb").val());
    
        $("#listaKitTrovati").empty();
    
        let docAperti=(docInLavorazione && docInLavorazione.isValid);
        if (!docAperti) 
            $("#actMassivaSuKit").css("display", "block");
        else
            $("#actMassivaSuKit").css("display", "none");

        let me = this;
        const xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                console.log(objResult);
    
                let templateRowKit='<div id="item_%0" style="width:100%;display:flex;">'+
                  '<div style="float:left;width:10%;"><img src="images/%1.png" style="width:40px;"></div>'+
                  '<div style="float:left;width:70%;"><h3>%2</h3></div>'+
                  ((docAperti)?'<div style="float:left;width:20%;"><button class="btnActKit" id="btnAction_%3">%4</button></div>':'')+
                  '<hr>'+
                '</div>';
                
                me.cacheKitSearchResult=objResult.records;
    

                for (let i=0; i<objResult.records.length; i++)
                {
                    let item = objResult.records[i];
                    let recHtml=templateRowKit;
                    recHtml=recHtml.replace("%0",item.guidId);
                    recHtml=recHtml.replace("%1",item.id==0?"box":"unbox");
                    recHtml=recHtml.replace("%2",JSON.parse(item.meta).titolo);
                    recHtml=recHtml.replace("%3",item.id);
                    recHtml=recHtml.replace("%4",item.id==0?"INIZIA":"CONTINUA");
    
                    // if (i>0)
                    // {
                    //     $("#listaKitTrovati").append("<hr>");
                    // }
                        
                    console.log(recHtml);
                    let recHtmlObject=$(recHtml);
                    recHtmlObject.find("button").click(function(){
                        console.log("Lavora kit");
                        console.log([item.guidId, item.id]);
                        me.lavoraKit(item.guidId, item.id);
                    });
                    $("#listaKitTrovati").append(recHtmlObject);
    
                }
    
                $("#kitRicercaResult").css("visibility","visible");


                //Resize scoll container
                let _boundsKit = {_y:270};
                let _height = document.getElementById("wrapper").clientHeight;
                let avanzo =  _height - _boundsKit._y;

                //Sistemo la griafica
                let massButtVisible=($("#actMassivaSuKit").css("display")=="block");
                $("#listaKitTrovati").css("height", avanzo - (massButtVisible?150:100) + "px");
                if (massButtVisible)
                    $("#actMassivaSuKit").css("height", "70px");

                if (cbk!=null)
                {
                    cbk(objResult.records);
                }
            }
            catch (ex) {
                console.log(ex);
            }
            finally {
              
            }
        }
    
        xhr.onreadystatechange = function () {
            console.log("ready state change");
        };
    
        xhr.onerror = function () {
            messaggioUtente("Code FIP-15 Errore di rete durante la ricerca dei kit", "error");
            console.error("Code FIP-15 Errore di rete durante la ricerca dei kit");
        };
    
        let guidPromo = $("#kitPromoCmb").val();
        let guidFormato = $("#kitFormatiCmb").val();

        let guidCanale = $("#kitCanaliCmb").val();
        if (guidCanale=="")
            guidCanale = "0";

        let guidArea = $("#kitAreeCmb").val();
        if (guidArea=="")
            guidArea = "0";

    
    
        //xhr.send("FicoProcess/getCombinazioniKitFromIndd", formData, "PUT");
        xhr.send("FicoProcess/getCombinazioniByPromo/"+guidPromo+"/"+guidFormato+"/"+guidCanale+"/"+guidArea, null, "GET");
    
    },
    filtraKit:function(resultFiltrato)
    {
        //Questa funzione filtra localmente il risultato di ricerca.
        //Si usa per lavorare un insieme di kit in un colpo. 
        //Processo PoP
        $("#listaKitTrovati").find("div").each(function(){
            let _id=$(this).attr("id");
            if(_id!=null)
            {
                let idItem = _id.replace("item_","");
                let foundInFilter = resultFiltrato.find(f=>f.guidId==idItem);
                if (foundInFilter==null)
                {
                    $(this).hide();
                }
                else
                {
                    foundInFilter.ok=true;//Approvo questo file kit per la lavorazione massiva
                    $(this).find(".btnActKit").hide();
                    $(this).show();
                }
            }
            
        });

        this.cacheKitFilterResult = resultFiltrato;
    },
    lavoraKit:function(idKit, idLavorazioneLocale)
    {
        if (idLavorazioneLocale>0)
        {
            //Scarico diretto il kit
            let itemsInSearch =  this.cacheKitSearchResult.filter(f=>f.id==idLavorazioneLocale);
    
            if (itemsInSearch.length>0)
            {
                //Devo salvare il kit sul file
                var filePath = pathLavorazione + "/lavorazioni.json";
                //leggiamo il file di lavorazione e guardiamo se ha almeno un elemento, se lo ha proviamo a leggere il suo pathLinks e pathLoghi
                let file = readFile(filePath);
                if (file == null)
                {
                    //errore, il file dovrebbe esistere
                    //messaggioUtente("Errore: File lavorazioni.json non trovato", "error");
                    //return;
                    appendToFile(filePath, "");
                    file== readFile(filePath);
                }
                //controlliamo se il file è vuoto
                let pathLinks = "";
                let pathLoghi = "";
                let pathLogs = "";
                let pathEsportazione = "";
                if (file.length>0){
                    let item = file[0];
                    if (item.pathLinks!=null && item.pathLinks!="")
                    {
                        pathLinks = item.pathLinks;
                    }
                    if (item.pathLoghi!=null && item.pathLoghi!="")
                    {
                        pathLoghi = item.pathLoghi;
                    }
                    if (item.pathLogs!=null && item.pathLogs!="")
                    {
                        pathLogs = item.pathLogs;
                    }
                    if (item.pathEsportazione!=null && item.pathEsportazione!="")
                    {
                        pathEsportazione = item.pathEsportazione;
                    }
                }

                //facciamo prima un controllo se nel file esiste già un elemento con questo file
                let existingItems = file.find(f=>f.file==app.activeDocument.name);
                if (existingItems != null){
                    existingItems.file = app.activeDocument.name;
                    existingItems.id = itemsInSearch[0].id;
                    existingItems.details = itemsInSearch[0];
                    existingItems.pathLinks = pathLinks;
                    existingItems.pathLoghi = pathLoghi;
                    existingItems.pathLogs = pathLogs;
                    existingItems.pathEsportazione = pathEsportazione;
                    //riscriviamo il file
                    fs.writeFileSync(filePath, JSON.stringify(file));
                }
                else{
                    appendToFile(filePath, {file:app.activeDocument.name, id:itemsInSearch[0].id, pathLinks:pathLinks, pathLoghi:pathLoghi, pathLogs:pathLogs, pathEsportazione:pathEsportazione ,details:itemsInSearch[0]});
                }
                
    
                initDocumentInLavorazione();
            }
        }
        else
        {
            let me=this;
    
            //Inizio la lavorazione
            const xhr = new XMLHttpRequestClient();
            xhr.onload = (objResult, parsed) => {
                console.log(objResult);
                if (objResult.esito && objResult.records.length>0)
                {
                    let lavorazioneItem = objResult.records[0];
                    //Scrivo il file di lavorazione o lo aggiungo al file di lavorazione
                    var filePath = pathLavorazione + "/lavorazioni.json";
                    appendToFile(filePath, {file:app.activeDocument.name, id:lavorazioneItem.id,details:lavorazioneItem});
    
                    //Adesso posso procedere con il processare il kit
                    initDocumentInLavorazione();
                }
            };
            xhr.onerror = function () {
                messaggioUtente("Code FIP-16 Errore di rete durante la ricerca dei kit", "error");
                console.error("Code FIP-16 Errore di rete durante la ricerca dei kit");
            };
    
            let guidPromo = $("#kitPromoCmb").val();
            console.log("Inizio lavorazione kit: " + guidPromo + "/" + idKit);//idKit è il riferimetno ID del design
            xhr.send("FicoProcess/iniziaLavorazione/"+guidPromo+"/"+idKit, null, "GET");
        }
        
    },
    lavoraKitMassivo:async function()
    {

        var fd = await selectFile();
        if (fd == null) {
            console.log("Nessun file selezionato");
            return;
        }
        else
        {
            setTimeout(function () {
            showLoading("Creazione lavorazione massiva...");

            }, 100);

            await Utility.sleep(1000);

            //Riempio il libro con le lavorazioni da fare
            let book = app.books.item(0);
            let fullName = await book.filePath;
            let nativeBookPath = fullName.nativePath;

            for (let f=0; f<this.cacheKitSearchResult.length; f++)
            {
                let item = this.cacheKitSearchResult[f];
                //let guidPromo = item.guidPromo;
                let guidCanale = item.guidCanale;
                let guidArea = item.guidArea;
                let areaItem = this.sourceAree.find(a=>a.guidID==guidArea);
                let canaleItem  =this.sourceCanali.find(c=>c.guidID==guidCanale);
                //let promoItem = this.listaPromoAperte.find(p=>p.guidID==guidPromo);


                let tit = canaleItem.sigla + "_" + areaItem.sigla;
                //Copio file fd e aggiungo al copia al libro
                let destFile=nativeBookPath + Utility.getDirSeparator() + tit + ".indd";
                fs.copyFile(fd.filePath, destFile);
                
                item.fullName = destFile;

                let tentativi=0;
                let max_tentativi=10;
                while(tentativi<max_tentativi)
                {
                    console.log("Tentativo " + tentativi + " per file: " + destFile);

                    await Utility.sleep(1000);
                    try {
                            // Leggi il contenuto del file
                        fs.readFileSync(destFile, 'utf8');
                        console.log("Il file esiste si puo proseguire")
                        
                        break;
                    }
                    catch(err)
                    {
                        if (err.message.indexOf("no such file or directory") >= 0) {
                            console.log("Tentativo fallito, il file non esiste: " + destFile);
                        }
                        else
                        {
                            console.error("Errore durante la lettura del file: " + err + " ma si procede lo stesso");
                            break;

                        }                        
                    }                    

                    tentativi++;
                }
                
                //await Utility.sleep(5000);

                book.bookContents.add(destFile);
            }


            let result = this.lavoraKitMassivo_Queue(0);
            if (result)
            {
                await Utility.sleep(3000);
                await initLibroInLavorazione();
            }
            else
            {
                messaggioUtente("Code FIP-03 Errore durante la creazione della lavorazione massiva", "error");
            }

            hideLoading();

            return result;
        }


       
        
    },
    lavoraKitMassivo_Queue:function(indice)
    {
        let objFileKit = this.cacheKitSearchResult[indice];

        if (objFileKit==null)
        {
            //Coda terminata
            return true;
        }


        let idKit = objFileKit.guidId;
        let idLavorazioneLocale = objFileKit.id;

        let fileTree = objFileKit.fullName.split(Utility.getDirSeparator());
        let nomeFile = fileTree[fileTree.length - 1];
        let _pathLavorazione=objFileKit.fullName.substring(0, objFileKit.fullName.lastIndexOf(Utility.getDirSeparator()));

        if (idLavorazioneLocale > 0) {
            //Scarico diretto il kit
            let itemsInSearch = this.cacheKitSearchResult.filter(f => f.id == idLavorazioneLocale);

            if (itemsInSearch.length > 0) {
                //Devo salvare il kit sul file
                var filePath = _pathLavorazione + "/lavorazioni.json";
                //leggiamo il file di lavorazione e guardiamo se ha almeno un elemento, se lo ha proviamo a leggere il suo pathLinks e pathLoghi
                let file = readFile(filePath);
                if (file == null) {
                    //errore, il file dovrebbe esistere
                    //messaggioUtente("Errore: File lavorazioni.json non trovato", "error");
                    //return;
                    appendToFile(filePath);
                    file == readFile(filePath);
                }
                //controlliamo se il file è vuoto
                let pathLinks = "";
                let pathLoghi = "";
                let pathLogs = "";
                let pathEsportazione = "";
                if (file!=null && file.length > 0) 
                {
                    let item = file[0];
                    if (item.pathLinks != null && item.pathLinks != "") {
                        pathLinks = item.pathLinks;
                    }
                    if (item.pathLoghi != null && item.pathLoghi != "") {
                        pathLoghi = item.pathLoghi;
                    }
                    if (item.pathLogs != null && item.pathLogs != "") {
                        pathLogs = item.pathLogs;
                    }
                    if (item.pathEsportazione != null && item.pathEsportazione != "") {
                        pathEsportazione = item.pathEsportazione;
                    }
                }



                //facciamo prima un controllo se nel file esiste già un elemento con questo file

                let existingItems = file!=null?file.find(f => f.file == nomeFile):null;
                if (existingItems != null) {
                    existingItems.file = nomeFile;
                    existingItems.id = itemsInSearch[0].id;
                    existingItems.details = itemsInSearch[0];
                    existingItems.pathLinks = pathLinks;
                    existingItems.pathLoghi = pathLoghi;
                    existingItems.pathLogs = pathLogs;
                    existingItems.pathEsportazione = pathEsportazione;
                    //riscriviamo il file
                    fs.writeFileSync(filePath, JSON.stringify(file));
                }
                else {
                    appendToFile(filePath, { file: nomeFile, id: itemsInSearch[0].id, pathLinks: pathLinks, pathLoghi: pathLoghi, pathLogs: pathLogs, pathEsportazione: pathEsportazione, details: itemsInSearch[0] });
                }

                return this.lavoraKitMassivo_Queue(indice + 1);
            }
            else
            {
                console.error("Errore: lavorazione locale non trovata per kit massivo: " + nomeFile);
                return false;
            }

        }
        else {
            let me = this;

            //Inizio la lavorazione
            const xhr = new XMLHttpRequestClient();
            xhr.onload = (objResult, parsed) => {
                console.log(objResult);
                if (objResult.esito && objResult.records.length > 0) {
                    let lavorazioneItem = objResult.records[0];
                    //Scrivo il file di lavorazione o lo aggiungo al file di lavorazione
                    var filePath = _pathLavorazione + "/lavorazioni.json";
                    appendToFile(filePath, { file: nomeFile, id: lavorazioneItem.id, details: lavorazioneItem });

                    return me.lavoraKitMassivo_Queue(indice + 1);
                }
                else
                {
                    console.error("Code FIP-17 Errore: impossibile iniziare lavorazione kit massivo: " + objFileKit.guidPromo + "/" + idKit);
                    messaggioUtente("Code FIP-17 Errore durante l'inizio della lavorazione kit massivo", "error");
                }
                

            };
            xhr.onerror = function () {
                messaggioUtente("Code FIP-16 Errore di rete durante l'inizio della lavorazione kit massivo", "error");
                console.error("Code FIP-16 iniziaLavorazione kit massivo: " + objFileKit.guidPromo + "/" + idKit);
                
            };


            console.log("Inizio lavorazione kit: " + objFileKit.guidPromo + "/" + idKit);//idKit è il riferimetno ID del design
            xhr.send("FicoProcess/iniziaLavorazione/" + objFileKit.guidPromo + "/" + idKit, null, "GET");
        }
    },
    // selezionatoTipoDiExport:function()
    // {
    //     let guidID = $("#cmbTipiDiExport").val();
    //     console.log("Selezionato tipo di export");
    //     if (guidID=="0")
    //     {
    //         $("#esportaButton").css("display", "none");
    //     }
    //     else
    //     {
            
    //         //Immaginiamo per semplicità di adesso di avere a che fare con FORMATI VOL
    //         let objTipoExport = this.sourceTipiExport.content.find(t=>t.guidID==guidID);

    //         //Adesso vedo se per la lavorazione corrente POSSO esportare con questo guid
    //         let tipoAutorizzato = this.metaLavorazioneCorrente.meta.tipiDiExportInKit.find(ik=>ik.tipoDiExportGuidID==guidID);
    //         if (tipoAutorizzato==null)
    //         {    
    //             $("#esportaButton").css("display", "none");
    //         }
    //         else
    //         {
    //             if (objTipoExport!=null)
    //             {
    //                 $("#esportaButton").css("display", "block");
    //                 let forWeb=(objTipoExport.codice=="WEB");
    //                 $("#esportaButton").text(forWeb?"Esporta Webpliant":"Esporta");
    //                 $("#esportaButton").attr("actionFormat", forWeb?"web":"pdf");
    //                 $("#esportaButton").attr("exportTemplate", forWeb?"none":objTipoExport.codice);
    //             }
    //             else
    //             {
    //                 $("#esportaButton").css("display", "none");
    //             }
    //         }
           
    //     }
    // },    
    
    tipoDiExportValido: function (guidID) {

        var res = {
            valido : false,
            objTipoExport : null
        }
        if (guidID == "0")
            return res;

        if(this.metaLavorazioneCorrente == null || this.metaLavorazioneCorrente.meta == null || this.metaLavorazioneCorrente.meta.tipiDiExportInKit == null)
        {
            //non siamo in una lavorazione quindi non sappiamo quali tipi di export sono validi, mostriamo tutti i tipi di export disponibili
            res.valido = true;
            return res;
        }
        let objTipoExport = this.sourceTipiExport.content.find(t => t.guidID == guidID);
        res.objTipoExport = objTipoExport;

        if (objTipoExport == null)
            return res;

        let tipoAutorizzato = this.metaLavorazioneCorrente.meta.tipiDiExportInKit
            .find(ik => ik.tipoDiExportGuidID == guidID);

        if (tipoAutorizzato == null)
            return res;

        res.valido = true;

        return res;
    },

    disattivaPulsanteExport: function () {
        $("#esportaButton").css("display", "none");
    },

    attivaPulsanteExport: function (objTipoExport) {
        let forWeb = objTipoExport.codice == "WEB";

        $("#esportaButton").css("display", "block");
        $("#esportaButton").text(forWeb ? "Esporta Webpliant" : "Esporta");
        $("#esportaButton").attr("actionFormat", forWeb ? "web" : "pdf");
        $("#esportaButton").attr("exportTemplate", forWeb ? "none" : objTipoExport.codice);
    },

    selezionatoTipoDiExport: function () {
        let guidID = $("#cmbTipiDiExport").val();

        console.log("Selezionato tipo di export");

        let res = this.tipoDiExportValido(guidID);
        let objTipoExport = res.objTipoExport;
        let valido = res.valido;

        //rimuoviamo eventuale banner di avviso export
        $("#exportProfileMissingBanner").empty();

        if (res.valido == false) {
            this.disattivaPulsanteExport();
            return;
        }

        if(objTipoExport.codice != "WEB"){

            var templateObj = app.pdfExportPresets.itemByName(objTipoExport.codice);
    
            if (templateObj == null || !templateObj.isValid) {
                this.creaBannerAvviso(objTipoExport.codice);
                return;
            }
        }

        this.attivaPulsanteExport(objTipoExport);
    },

    creaBannerAvviso: function (siglaExport) {
        //invece del pulsante di export mostro un banner di avviso che dice "Profilo di Export <siglaExport> non presente in Indesign, aggiungere il profilo di export e riprovare"
        let bannerId = "bannerExportMissing_" + siglaExport;
        let banner = $("#" + bannerId);
        if (banner.length == 0) {
            banner = $("<div id=\"" + bannerId + "\" style=\"background-color: #ffcccc; color: #990000; padding: 10px; margin-top: 10px; border: 1px solid #990000; border-radius: 5px;\">" +
                "Profilo di Export <span style=\"font-weight: bold;\" id=\"exportProfileMissingSigla_" + siglaExport + "\"></span> non presente in Indesign, aggiungere il profilo di export e riprovare." +
                "</div>");
            $("#exportProfileMissingBanner").append(banner);
        }
        $("#exportProfileMissingSigla_" + siglaExport).text(siglaExport);
    },
    
    //esportaMateriale:async function(actionFormat, guidExport, exportTemplate)
    esportaMateriale:async function(guidExport, callBack, paginaRestart = null)
    {
        try 
        {        
            setTimeout(function () {
                showLoading("Inizializzazione esportazione...");

            }, 100);

            await Utility.sleep(1000);

            this.abortExport = false;
            let me = this;

            let exportTemplate = ficoProcess.sourceTipiExport.content.find(te=>te.guidID==guidExport);
            let actionFormat = exportTemplate.codice.toLowerCase();

            let contatore= paginaRestart !== null ? paginaRestart : 1;

            async function esportaMaterialeOperation() {
                //controllo che l'id lavorazione sia stato selezionato e che il file listaKit + idlavorazione.json esista
                if (idKitLavorazione == null || idKitLavorazione == "" || idKitLavorazione == 0) {
                    messaggioUtente("Code FIP-04 Errore: Nessun kit selezionato", "error");
                    return;
                }


                let itemTipoExport = me.sourceTipiExport.content.find(te => te.guidID == guidExport);

                let metaIncluded = true;//itemTipoExport.metaIncluded;

                showLoading("Esportazione in corso...");
                let job = [];

                let fileName = "";
                if (actionFormat == "web") {

                    var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
                    if (file == null) {
                        messaggioUtente("Code FIP-05 Errore: File listaKit" + idKitLavorazione + ".json non trovato", "error");
                        return;
                    }

                    //scorriamo ogni pagina e cerchiamo tutti i gruppi della pagina, per ogni gruppo cerchiamo la sua base, se la troviamo salviamo la label in una variabile
                    me.listaElementiMateriali = [];
                    for (var i = 0; i < app.activeDocument.pages.length; i++) {

                        var page = app.activeDocument.pages.item(i);

                        if (me.abortExport) {
                            console.log("ABORT EXPORT!!!!");
                            hideLoading();
                            return;
                        }

                        await me.processExport(page, file);

                        console.log("Esporto pag " + page.name);
                        setTimeout(function () {
                            showLoading("Esportazione pag " + page.name);
                        }, 100);



                    }

                    //serializziamo e scriviamo il file con il nome di Esportazione_+ nome documento.json
                    fileName = "Esportazione_" + app.activeDocument.name.replace(".indd", "") + ".webpliant";
                    fs.writeFileSync(pathLavorazione + "/" + fileName, JSON.stringify(me.listaElementiMateriali));

                    job.push({ fileName: pathLavorazione + "/" + fileName, fileOnlyName: fileName, meta: {} });

                }
                else {
                    //Esporto il PDF con la specifiche SIGLA

                    var templateObj = app.pdfExportPresets.itemByName(exportTemplate.codice);

                    if (templateObj == null || !templateObj.isValid) {
                        hideLoading();
                        messaggioUtente("Code FIP-06 Errore: Export non trovato");
                        if (callBack != null) {
                            callBack(false, "Export non trovato");
                        }
                        return;
                    }
                    
                    let meta={};
                    
                    if (itemTipoExport.modalita <= 1) {

                        if (metaIncluded)
                        {

                            var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
                            if (file == null) {
                                messaggioUtente("Code FIP-05 Errore: File listaKit" + idKitLavorazione + ".json non trovato", "error");
                                return;
                            }
                            
                            let pagine = app.activeDocument.pages;     
                            me.listaElementiMateriali = [];
                            for (let p = 0; p < pagine.length; p++) {

                                let pagItem = pagine.item(p);

                                setTimeout(function () {
                                    showLoading("Analisi pag " + pagItem.name);
                                }, 100);

                                await me.processExport(pagItem, file);

                            }
                        }

                        setTimeout(function () {
                            showLoading("Creazione file...");
                        }, 100);

                        await Utility.sleep(1000);

                        //Prendiamo il primo elemento della lista e leggiamo name relativo al tipo di export
                        let firstRec = contenutoKitInLavorazione.records.find(f => f.recordInTracciato["StatoSelezione"] == 1);
                        let names = firstRec.recordInTracciato["Kit.Names"];
                        fileName = names.find(nc => nc.guidIdTipoExport == guidExport).nomeFile;
                        //fileName = "VOLTEST.pdf";

                        //Esporta tutto in unico OPDF
                        //app.activeDocument.asynchronousExportFile(ExportFormat.PDF_TYPE, pathLavorazione + "/" + fileName, false, templateObj);
                        app.pdfExportPreferences.pageRange = "";
                        app.activeDocument.exportFile(ExportFormat.PDF_TYPE, /*pathLavorazione +*/ percorsoEsportazione + fileName, false, templateObj);

                        //recuperiamo l'ultima pagina di indesign
                        let lastPage = app.activeDocument.pages.item(-1);
                        job.push({ fileName: /*pathLavorazione +*/ percorsoEsportazione + fileName, fileOnlyName: fileName, meta: me.listaElementiMateriali, page: lastPage.name });
                    }
                    else {
                        //Esportas pagina per pagina
                        //Solitamente è un PoP - Ma ci torneremo sopra proabilmente
                        let pagine = app.activeDocument.pages;

                        let localDbDataset = readFile(pathLavorazione + "/listaImpaginata" + idKitLavorazione + ".json")[0].result;
                        let listaLineareRef = [];
                        for (let r = 0; r < localDbDataset.length; r++) {
                            listaLineareRef = listaLineareRef.concat(localDbDataset[r].listaRef);
                        }

                         var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
                            if (file == null) {
                                messaggioUtente("Code FIP-05 Errore: File listaKit" + idKitLavorazione + ".json non trovato", "error");
                                return;
                            }
                        

                        for (let p = 0; p < pagine.length; p++) {

                            let pagItem = pagine.item(p);
                            if (paginaRestart != null && paginaRestart.toString() != "" && paginaRestart.toString() != pagItem.name) {
                                continue;
                            }
                            paginaRestart = null;
                            let pagLabel = "none";
                            let objItem = {};
                            let descrPag = "";

                            let foundObj = false;
                            let objMeta = {};
                            for (let p2 = 0; p2 < pagItem.groups.length; p2++) {

                                let rootElement = pagItem.groups.item(p2);

                                let boxDNA = Utility.getDnaOfBox(rootElement);

                                if (boxDNA != null) {
                                    pagLabel = Utility.parseLabel(rootElement.label);

                                    try {


                                        setTimeout(function () {
                                            showLoading("Analisi pag " + pagItem.name);
                                        }, 100);

                                        me.listaElementiMateriali = [];

                                        await me.processExport(pagItem, file);

                                        //objItem = listaLineareRef.find(el => el["Referenza.Codice"] == boxDNA.codice);//JSON.parse(pagLabel);
                                        objItem = me.listaElementiMateriali.find(el => el.recordInTracciato["Referenza.Codice"] == boxDNA.codice || el.recordInTracciato["Scatto.CodiceGruppo"] == boxDNA.codice);//JSON.parse(pagLabel);
                                        

                                        if (objItem != null) {
                                            objItem=objItem.recordInTracciato;
                                            foundObj = true;



                                            let kitNames = objItem["Kit.Names"];
                                            fileName = kitNames.find(kn => kn.guidIdTipoExport == guidExport).nomeFile;
                                            fileName = fileName.replace("{{pag}}", pagItem.name);
                                            fileName = fileName.replace("{{contatore}}", contatore);

                                            break;
                                        }
                                    }
                                    catch (err) {
                                        console.error("Errore nel trovare l'elemento per la pagina " + pagItem.name + " # label: " + pagLabel);
                                        console.error(err);
                                        messaggioUtente("Code FIP-07 Errore nel trovare l'elemento per la pagina " + pagItem.name + " # label: " + pagLabel + ": " + err, "error");
                                        hideLoading();
                                        return;

                                    }
                                }
                            }

                            if (!foundObj) {
                                console.error("Errore in esportazione pagina " + pagItem.name + " # label: " + pagLabel);
                                continue;
                            }

                     
                            objMeta=me.listaElementiMateriali;



                            app.pdfExportPreferences.pageRange = pagItem.name;

                            try {
                                let file_name = /*pathLavorazione +*/ percorsoEsportazione + fileName;
                                app.activeDocument.exportFile(ExportFormat.PDF_TYPE, file_name, false, templateObj);
                                console.log("Stream creato!");

                                //job.push({ fileName: file_name,  fileOnlyName:fileName, meta: { descrizione: descrPag } });
                                job.push({ fileName: file_name, fileOnlyName: fileName, meta: objMeta, page: pagItem.name, objItem: objItem });

                                //cerchiamo in objItem["Kit.Declinazioni"]per ogni elemento in lista
                                var declinazioni = objItem["Kit.Declinazioni"];
                                if (declinazioni != null) {
                                    for (let d = 0; d < declinazioni.length; d++) {
                                        let declinazioneItem = declinazioni[d];
                                        let codifica = declinazioneItem["codifica"];
                                        let codificaCorrispondente = codifica.find(c => c.guidIdTipoExport == guidExport);
                                        if (codificaCorrispondente != null && codificaCorrispondente.nomeFile != null && codificaCorrispondente.nomeFile != "") {
                                            let fileNameDeclinazione = codificaCorrispondente.nomeFile;
                                            //let percorsoEsportazioneDecl = pathLavorazione + percorsoEsportazione;

                                            let nuovoNomeFile = fileNameDeclinazione.replace("{{pag}}", pagItem.name);
                                            nuovoNomeFile = nuovoNomeFile.replace("{{contatore}}", contatore);
                                            Utility.duplicaFile(/*pathLavorazione +*/ percorsoEsportazione + fileName, /*pathLavorazione +*/ percorsoEsportazione + nuovoNomeFile);
                                            job.push({ fileName: /*pathLavorazione +*/ percorsoEsportazione + nuovoNomeFile, fileOnlyName: nuovoNomeFile, meta: objMeta, page: pagItem.name, objItem: objItem });
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                console.error("Impossibile esportare la pagina " + pagItem.name);
                                hideLoading();
                                messaggioUtente("Code FIP-08 Errore durante l'esportazione della pagina " + pagItem.name + ": " + e, "error");
                                return;
                            }

                            contatore++;
                        }


                    }

                }

                if (fileName == "") {
                    messaggioUtente("Code FIP-09 Errore: Filename empty", "error");
                    return;
                }

                

                console.log(job);
                console.log("Parte la chiamata a FP!");

               
                
                setTimeout(function () {
                    showLoading("Uplaod verso FidelityPromotion...");
                }, 100);

                FicoProcess.processFPExport(0, job, guidExport, callBack);
            }

            if(paginaRestart != null){
                await esportaMaterialeOperation();
                return;
            }


            //Prima di qualsiasi cosa svuota il kit su FP
            let xhrSvuota= new XMLHttpRequestClient();
            xhrSvuota.onload = async (objResult, parsed) => {
                try {

                    if (objResult.esito)
                    {
                        await esportaMaterialeOperation();
                    }
                    else
                    {
                        hideLoading();
                        messaggioUtente("Code FIP-10 Errore nello svuotamento del kit runtime: " + objResult.error, "error");
                    }
                }
                catch (e) {
                    hideLoading();
                    messaggioUtente("Code FIP-11 Errore generico durante l'export: " + e, "error");
                }
            }

            xhrSvuota.onreadystatechange = function () {
                if (xhrInProcess.readyState == 4) {
                    if (xhrInProcess.status == 200) {
                        //messaggioUtente("Richiesta completata con successo", "success");
                    } else {
                    // messaggioUtente("refreshCambiaPS: Errore durante la richiesta: " + xhr.status, "error");
                    }
                }
            };

            xhrSvuota.onerror = function () {
                //messaggioUtente("refreshCambiaPS:Errore di rete", "error");
            }


            xhrSvuota.send("FicoProcess/svuotaMaterialeKitFP/" + idKitLavorazione+"/"+ guidExport, null, "GET");


        }
        catch (e) {
            console.log(e);
            console.error(e.toString());
            messaggioUtente("Code FIP-12 Errore durante l'esportazione: " + e, "error");
            hideLoading();
        }
    },

    //Processo di lettura locale info
    processExport:async function (page, file)
    {
        return new Promise(resolve => setTimeout(() => {

            let pageOffset = 0;

            if (page.bounds[1] != 0)
                pageOffset = page.bounds[3] - page.bounds[1];//app.activeDocument.documentPreferences.pageWidth + marginXOffset;

            let page_data_bounds = [page.bounds[0], page.bounds[1] - pageOffset, page.bounds[2], page.bounds[3] - pageOffset];
            let wPag=page_data_bounds[3];
            let hPag=page_data_bounds[2];

            for (var j = 0; j < page.groups.length; j++) {
                var group = page.groups.item(j);
                let dna = Utility.getDnaOfBox(group);
                if (dna != null) {
                    for (var k = 0; k < group.allPageItems.length; k++) {
                        var item = group.allPageItems[k];
                        //i param sono rispettevimanete [0] = base, [1] = meccanica, [2] = codice, [3] = codiceGruppo
                        //troviamo nel file listaKit l'elemento con codice = param[2]
                        if (dna.codice != null) {
                            //var element = file.records.find(f => f.recordInTracciato["Scatto.CodiceGruppo"].toString() == dna.codice_gruppo && (f.recordInTracciato["StatoSelezione"].toString() == 1 || dna.codice==dna.codice_gruppo));
                            var element = file.records.find(f => f.recordInTracciato["Scatto.CodiceGruppo"].toString() == dna.codice_gruppo && f.recordInTracciato["Referenza.Codice"].toString() == dna.codice);
                            if (element != null) {
                                //Prendiamo dettagli sull'ingombro
                                element.recordInTracciato["View.wPag"]=wPag;
                                element.recordInTracciato["View.hPag"]=hPag;
                                element.recordInTracciato["View.h"]=group.geometricBounds[2]-group.geometricBounds[0];
                                element.recordInTracciato["View.w"]=group.geometricBounds[3]-group.geometricBounds[1];
                                element.recordInTracciato["View.percIngombro"] = (element.recordInTracciato["View.w"]*element.recordInTracciato["View.h"])/(wPag*hPag);
                                element.recordInTracciato["View.aspectRatio"] = element.recordInTracciato["View.w"] / element.recordInTracciato["View.h"];
                                element.recordInTracciato["View.x"] = group.geometricBounds[1];
                                element.recordInTracciato["View.y"] = group.geometricBounds[0];
                                element.recordInTracciato["View.pag"] = Number(page.name);

                                this.listaElementiMateriali.push(element);
                            }
                            else {
                                messaggioUtente("Code FIP-07 Errore: Elemento con codice " + dna.codice + " non trovato nella lista tracciato", "error");
                            }
                        }
                        break;

                    }
                }
            }

            resolve();
        }, 500));

    },

    //Processo di upload http verso FP
    processFPExport:async function(inx, job, guidExport, callBack)
    {

        try{
            let item = job[inx];
            let me=this;
    
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (objResult, parsed) => {
    
                try {
                    try {
    
                        if (objResult.esito) {
                            console.log("Fine upload");
                            //leggiamo il prossimo job, se la pagina è diversa o questo è l'ultimo elemento della lista, procediamo alla callback di update progresso

                            var nextItem = null;
                            if (inx + 1 < job.length) {
                                nextItem = job[inx + 1];
                            }

                            if (nextItem == null || nextItem.page != item.page) {
                                //Fine dell'upload
                                if(callBack!=null){
                                    //callback di fine
                                    callBack(true, "", { listaRef: [item.objItem], pag: item.page }, nextItem == null);
                                }
                                else{
                                    messaggioUtente("Code FIP-13 Esportazione terminata con successo", "success");
                                    hideLoading();
                                }
                                if(nextItem==null){
                                    messaggioUtente("Code FIP-13 Esportazione terminata con successo", "success");
                                    hideLoading();
                                    return;
                                }

                                me.processFPExport(inx + 1, job, guidExport, callBack);
                            }
                            else {
                                //il prossimo oggetto è della stessa pagina, procedo senza chiamare la callback
                                me.processFPExport(inx + 1, job, guidExport, callBack);
                            }
                        }
                        else {
                            messaggioUtente("Code FIP-14 Errore: " + objResult.error, "error");
                        }
    
                    }
                    catch (e) {
                        console.error(e);
                        hideLoading();
                        messaggioUtente("Code FIP-14 Errore: " + e, "error");
                        if(callBack!=null){
                            callBack(false, "Code FIP-14 Errore: " + e);
                        }
                    }
    
                }
                catch (e) { 
                    console.error(e);
                    hideLoading();
                    messaggioUtente("Code FIP-14 Errore generico: " + e, "error");
                    if (callBack != null) {
                        callBack(false, "Code FIP-14 Errore generico: " + e);
                    }
                }
            }
    
            xhr.onreadystatechange = function () { };
            xhr.onerror = function () { 
                console.error("Errore di chiamata!");
                messaggioUtente("Code FIP-14 Errore durante la chiamata al server", "error");
                if(callBack!=null){
                    callBack(false, "Code FIP-14 Errore di chiamata sul server");
                }
                hideLoading();
            };
    
    
            var file = readFile(pathLavorazione + "/lavorazioni.json");
            if(file == null){
                hideLoading();
                messaggioUtente("Code FIP-14 Errore: File lavorazioni.json non trovato", "error");
                if(callBack!=null){
                    callBack(false, "Code FIP-14 Errore: File lavorazioni.json non trovato");
                }
                return;
            }
            
            var guidId = file.find(f=>f.file == app.activeDocument.name).details.guidId;
            let fd = new FormData();
    
            fd.append("guidKitRuntime", guidId);//itemsInSearch[0].guidId);   
            fd.append("tipoExport", guidExport);//Etruria//"8f790d25-f3be-496f-98e8-952d04fc87d7");//Edro21 locale
            fd.append("nomeFile", item.fileOnlyName);
            let metaStr=JSON.stringify(item.meta);
            fd.append("meta", metaStr);
    
            
            const fileBuffer = fs.readFileSync(item.fileName);
            
            // console.log(fileBuffer);
            // const fileBlob = new Blob([fileBuffer], { type: 'application/json' });
    
            fd.append("file", fileBuffer);
    
            console.log(item.fileOnlyName);
            console.log(fileBuffer);
            
    
            setTimeout(function () {
                showLoading("Upload " + (inx+1) + " di " + job.length);
            }, 100);
    
            console.log("Inizio upload");
            xhr.sendFiles("FicoProcess/esportaMateriale", fd, "POST");
        }
        catch (e) {
            console.error(e);
            hideLoading();
            messaggioUtente("Code FIP-14 Errore generico: " + e, "error");
            callBack(false, "Code FIP-14 Errore generico: " + e, "error");
        }
    },

    processCorreggoExport: async function (tipoExportObj) {


       setTimeout(function () {
           
           showLoading("Esportazione per Correggo");
        }, 100);

        await Utility.sleep(1000);


        let xhrSvuota= new XMLHttpRequestClient();
        xhrSvuota.onload = async (objResult, parsed) => {
            try {

                if (objResult.esito) {
                    // let tipoExportObj = this.sourceTipiExport.content.find(te=>te.codice=="CORREGGO");
                    // if (tipoExportObj==null)
                    // {
                    //     hideLoading();
                    //     messaggioUtente("Tipo di export CORREGGO non trovato!");
                    //     return;
                    // }

                    //let tipoExportVOL = this.sourceTipiExport.content.find(te=>te.codice=="VOL");//Si usa questo per il naming convention, almeno per adesso 


                    //Leggo la lista che DEVE essere aggiornata
                    var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");

                    let pages = app.activeDocument.pages;

                    let resultEsportazioneDato = [];
                    let pagsData=[];

                    let marginXOffset=(app.activeDocument.marginPreferences.left + app.activeDocument.marginPreferences.right);

                    for (let p = 0; p < pages.length; p++) {
                        let pItem = pages.item(p);
                        
                        showLoading("Esportazione pag. " + pItem.name);
                        await Utility.sleep(500);
                        //pagProg = pItem.name;

                        // setTimeout(function () {
                        //     showLoading("Esportazione pag. " + pItem.name);
                        // }, 100);
                        
                        let pageOffset=0;

                        if (pItem.bounds[1] !=0)
                            pageOffset=pItem.bounds[3]-pItem.bounds[1];//app.activeDocument.documentPreferences.pageWidth + marginXOffset;
                        //else if (pItem.bounds[1]<-1)
                            //pageOffset=(app.activeDocument.documentPreferences.pageWidth+marginXOffset)*-1;

                        let page_data_bounds= [pItem.bounds[0],pItem.bounds[1]-pageOffset,pItem.bounds[2],pItem.bounds[3]-pageOffset];

                        // if (pItem.bounds[1] >1)
                        //     pageOffset=app.activeDocument.documentPreferences.pageWidth + marginXOffset;
                        // else if (pItem.bounds[1]<-1)
                        //     pageOffset=(app.activeDocument.documentPreferences.pageWidth+marginXOffset)*-1;

                        pagsData.push({numero:parseInt(pItem.name), bounds:page_data_bounds});

                        //Preparazione dei dati
                        for (var j = 0; j < pItem.groups.length; j++) {
                            var group = pItem.groups.item(j);
                            
                            console.log("export progress -> pag " + pItem.name + " __ " + (j+1) + " di " + pItem.groups.length);

                            try
                            {
                                let dna = Utility.getDnaOfBox(group);
                                if (dna != null) {

                                    //Raccolgo tutte le label indd e relativi item
                                    //let allBoxItems = group.allPageItems;
                                    let dbItems = Utility.getAllFieldsInGroup(group); //[];
                                    // for (let bi = 0; bi < allBoxItems.length; bi++) {
                                    //     let element = allBoxItems[bi];
                                    //     if (element.label != "") {
                                    //         dbItems.push({ label: element.label, item: element });
                                    //     }
                                    // }

                                    let objItem = file.records.find(el =>el.recordInTracciato["StatoSelezione"]==1 && el.recordInTracciato["Referenza.Codice"] == dna.codice || el.recordInTracciato["Scatto.CodiceGruppo"] == dna.codice_gruppo);
                                    if (objItem != null) {
                                        
                                        //Ref dati estraiamo lo schema campi
                                        let schemaAzioni = await cambiStrutturaliJs.getCambioStrutturalePath(objItem, group);
                                        let data = { boxName: group.label, azioni: [], itemRefStringfied:null, pag:parseInt(pItem.name), bounds:[group.geometricBounds[0],group.geometricBounds[1]-pageOffset,group.geometricBounds[2],group.geometricBounds[3]-pageOffset]};

                                        objItem = objItem.recordInTracciato;

                                        let objToStringy = {};

                                        //Raccolgo lista dei campi indd sensibili
                                        for (let i = 0; i < schemaAzioni.length; i++) {
                                            let azione = schemaAzioni[i];
                                            let labelIndd = "";
                                            let compiledValue = "";

                                            let boundsEl = [group.geometricBounds[0],group.geometricBounds[1]-pageOffset,group.geometricBounds[2],group.geometricBounds[3]-pageOffset];

                                            if (azione.campiInddCoinvolti != null && azione.campiInddCoinvolti.length > 0) {
                                                //Faccio il binding dei campi coinvolti  nell'istruzione, se li trovo
                                                for (let i2 = 0; i2 < azione.campiInddCoinvolti.length; i2++) {
                                                    let campoCoinvolto = azione.campiInddCoinvolti[i2];

                                                    let refItem = dbItems.find(c => Utility.parseLabel(c.label) == Utility.parseLabel(campoCoinvolto.label));
                                                    if (refItem != null) {
                                                        //campoCoinvolto.item=refItem;
                                                        labelIndd = Utility.parseLabel(campoCoinvolto.label);
                                                        if (azione.labelELementCorreggo!=null)
                                                            labelIndd = azione.labelELementCorreggo;

                                                        compiledValue = refItem.item.contents;

                                                        if (refItem.item.constructorName!="Line")
                                                        {
                                                            let startY=refItem.item.geometricBounds[0];//descrItem.item.lines.item(0).baseline-5;
                                                            if (Utility.parseLabel(refItem.item.label)=="descrizione")
                                                            {
                                                                startY = refItem.item.lines.item(0).baseline-5;
                                                            }

                                                            boundsEl = [startY,refItem.item.geometricBounds[1]-pageOffset,refItem.item.geometricBounds[2],refItem.item.geometricBounds[3]-pageOffset];
                                                        }
                                                        else
                                                        {
                                                            let endY = refItem.item.characters.item(0).baseline;
                                                            let startX = refItem.item.horizontalOffset;
                                                            let endX = refItem.item.endHorizontalOffset;
                                                            boundsEl = [endY-5,startX-pageOffset,endY,endX-pageOffset];

                                                        }

                                                        break;
                                                    }


                                                }
                                            }
                                            else {
                                                //Istruzioni al livello di box
                                                //L'unico compiled field a livello di box hce posso mettere è il codice del box
                                                labelIndd = "base";
                                                compiledValue = objItem.codiceBox;
                                            }

                                            if (labelIndd != "") {
                                                let objAz = { id:azione.id, titolo: azione.titolo, compiledValue: compiledValue, labelIndd: labelIndd, istruzioni: [], bounds:boundsEl };
                                                for (let i3 = 0; i3 < azione.istruzioni.length; i3++) {
                                                    let instr = azione.istruzioni[i3];

                                                    let objInstr = {};
                                                    if (instr.valore != null) {
                                                        if (typeof instr.valore === "object") {
                                                            //Scelta valore
                                                            objInstr.tipoDato = "array";
                                                            objInstr.valore = instr.valore;
                                                        }
                                                        else {
                                                            //Valore singolo netto
                                                            objInstr.tipoDato = typeof instr.valore;
                                                            objInstr.valore = [instr.valore];
                                                        }
                                                    }
                                                    else {
                                                        //Manuale dall'utente
                                                        objInstr.tipoDato = typeof objItem[instr.field];//leggo il tipo dato meta che verrebbe alterato dall'operatore
                                                        objInstr.valore = [];
                                                    }

                                                    objInstr.field = instr.field;
                                                    // if (instr.triggerActionId!=null)
                                                    //     objInstr.triggerActionId=instr.triggerActionId;
                                                    if (instr.primary!=null)
                                                        objInstr.primary=instr.primary;
                                                    // if (instr.autocomplete!=null)
                                                    //     objInstr.autocomplete=instr.autocomplete;

                                                    objToStringy[objInstr.field.replace("$",".")]=objItem[objInstr.field.replace("$",".")];

                                                    objAz.istruzioni.push(objInstr);
                                                }

                                                data.azioni.push(objAz);
                                                
                                            }

                                        }

                                        //Dopo averli raccolti è il momento di riumovere eventuali campi con triggerIdAction che puntano ad un'azione non esistente
                                        // data.azioni.forEach(a=>{

                                        //     let istruzioniNoTrigger = a.istruzioni.filter(a2 =>
                                        //         a2.triggerActionId==null
                                        //     );

                                        //     let triggerActionValide = a.istruzioni.filter(a2 =>
                                        //         data.azioni.some(a3 => a3.id === a2.triggerActionId)
                                        //     );

                                        //     a.istruzioni = istruzioniNoTrigger.concat(triggerActionValide);
                                        //     for (let i4 = 0; i4 < a.istruzioni.length; i4++) 
                                        //     {
                                        //         let objInstr = a.istruzioni[i4];
                                        //         if (objItem[objInstr.field]!=null)
                                        //             objToStringy[objInstr.field]=objItem[objInstr.field];
                                        //     }

                                        // });



                                        
                                        objToStringy["Referenza.Codice"]=objItem["Referenza.Codice"];
                                        objToStringy["Scatto.CodiceGruppo"]=objItem["Scatto.CodiceGruppo"];

                                        //Aggiunta custom di campi di controllo, non per forza coinvolti nelle istruzioni
                                        //Servono a Correggo ad esempio per la gestione delle policy
                                        if (pluginMiddleware.getCampo("metaAggiuntiviPerEsportazioneCorreggo") !== null)
                                        {
                                            pluginMiddleware.getCampo("metaAggiuntiviPerEsportazioneCorreggo").forEach(f=>{
                                                objToStringy[f]=objItem[f];
                                            });
                                        }

                                        data.itemRefStringfied = JSON.stringify(objToStringy);
                                        //Aggiungo anche la descrizione e questo si fa staticamente
                                        let descrItem = dbItems.find(c => Utility.parseLabel(c.label) == "descrizione");

                                        if (descrItem!=null)
                                        {
                                            try
                                            {
                                                let startY=descrItem.item.lines.item(0).baseline-5;
                                                let objAz = { titolo: "Cambia descrizione", compiledValue: Utility.componiStringTagFromInndTextFrame(descrItem.item), labelIndd: "descrizione", istruzioni: [], bounds:[startY,descrItem.item.geometricBounds[1]-pageOffset,descrItem.item.geometricBounds[2],descrItem.item.geometricBounds[3]-pageOffset] };
                                                data.azioni.push(objAz);
                                            }
                                            catch(err)
                                            {
                                                console.error(err);
                                            }
                                        }

                                        var nomeFotoPrimaria = pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "immagine";
                                        var nomeFotoSecondaria = pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto_secondaria";

                                        let immagineItem = dbItems.find(c => c.label.indexOf(nomeFotoPrimaria)==0);
                                        if(immagineItem==null)
                                        {
                                            //cerchiamo una secondaria come fallback
                                            immagineItem = dbItems.find(c => c.label.indexOf(nomeFotoSecondaria) == 0);
                                        }

                                        if (immagineItem!=null)
                                        {
                                            let objAzImg = { titolo: "Cambia immagine o selezione P/S", compiledValue: objItem["Foto.guidid"], labelIndd: "immagine", istruzioni: [], bounds:[immagineItem.item.geometricBounds[0],immagineItem.item.geometricBounds[1]-pageOffset,immagineItem.item.geometricBounds[2],immagineItem.item.geometricBounds[3]-pageOffset] };
                                            data.azioni.push(objAzImg);
                                        }

                                        resultEsportazioneDato.push(data);


                                    }
                                }
                            }
                            catch(err_export)
                            {
                                console.error(err_export);
                            }
                        }
                    }


                    console.log(resultEsportazioneDato);

                    let pack = {lista:resultEsportazioneDato, pagine:pagsData};


                    console.log(pack);
           



                    let meta = JSON.stringify(pack);

                    var xhr = new XMLHttpRequestClient();
                    xhr.onload = async (objResult, parsed) => {
                        
                        try {
                            try {

                                if (objResult.esito)
                                {
                                    console.log("Fine upload");
                                    messaggioUtente("Code FIP-14 Pubblicazione correggo avvenuta!", "success");
                                }
                                else
                                {
                                    messaggioUtente("Code FIP-14 Errore: " + objResult.error, "error");
                                }

                                hideLoading();

                            }
                            catch (e) { }

                        }
                        catch (e) { 
                            messaggioUtente("Errore: " + e, "error");
                        }
                    }

                    xhr.onreadystatechange = function () { };
                    xhr.onerror = function () { 
                        messaggioUtente("Errore di chiamata!", "error");
                        hideLoading();
                    };


                    var file = readFile(pathLavorazione + "/lavorazioni.json");
                    if(file == null){
                        hideLoading();
                        messaggioUtente("Errore: File lavorazioni.json non trovato", "error");
                        return;
                    }
                    
                    let firstRec = contenutoKitInLavorazione.records.find(f=>f.recordInTracciato["StatoSelezione"]==1);//[0];
                    let names=firstRec.recordInTracciato["Kit.Names"];

                    //if (names==null)


                    //let guidIDDelCazzo = "691e92ec-9fd7-42b5-9b1e-e61ae20e203d";
                    //let fileName = names.find(nc => nc.guidIdTipoExport == guidIDDelCazzo).nomeFile;
                    let fileName = names.find(nc => nc.guidIdTipoExport == tipoExportObj.guidID).nomeFile;
                    let objLavorazione = file.find(f=>f.file == app.activeDocument.name)

                    let fd = new FormData();

                    fd.append("guidKitRuntime", objLavorazione.details.guidId);
                    fd.append("tipoExport", tipoExportObj.guidID);
                    fd.append("nomeFile", fileName);//Da togliere .pdf appena si sitema la NC
                    //let metaStr=JSON.stringify(meta);
                    fd.append("meta", meta);

                    showLoading("Creazione file...");
                    await Utility.sleep(500);

                    let templateObj = app.pdfExportPresets.itemByName(tipoExportObj.codice);
                    app.pdfExportPreferences.pageRange = "";
                    app.activeDocument.exportFile(ExportFormat.PDF_TYPE, /*pathLavorazione +*/ percorsoEsportazione + fileName, false, templateObj);
                    const fileBuffer = fs.readFileSync(/*pathLavorazione +*/ percorsoEsportazione + fileName);

                    fd.append("file", fileBuffer);

                    console.log("Inizio upload");
                    showLoading("Upload verso FidelityPromotion...");

                    xhr.sendFiles("FicoProcess/esportaMateriale", fd, "POST");
                }
            }
            catch (e) {
                console.error("Errore durante l'upload: ", e);
                messaggioUtente("Code FIP-14 Errore generico durante l'upload: " + e, "error");
                hideLoading();
            }
        }

        xhrSvuota.send("FicoProcess/svuotaMaterialeKitFP/" + idKitLavorazione+"/"+ tipoExportObj.guidID, null, "GET");



        

    }
}

module.exports = FicoProcess;