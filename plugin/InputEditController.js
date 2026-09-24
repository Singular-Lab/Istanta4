
class InputEditController {
    inputCollection = [];
    datasource = {};
    myContainer = null;
    convalidaFirma = false;//Boolean che mi specifica se tale REF in lettura è stata REVISIONATA con la FIRMA del tracciato o se invece è DA CONTROLLARE.
    descrInArchivio;
    inMismatch=false;
    //I20-993: le varianti che non comandano si guardano e non si toccano.
    solaLettura = false;

    constructor(container, convalidaFirma, descrInArchivio, compiledFields = null) {
        this.myContainer = container;//.find('input');
        this.convalidaFirma = convalidaFirma;   
        this.descrInArchivio = descrInArchivio;

        if(compiledFields!=null){
            let matchFieldData = compiledFields.find(f => Utility.parseLabel(f.labelName) == "descrizione");
            if (matchFieldData != null) {
                //Posso compilare il campo con i dati che leggo
                let content = matchFieldData.content;
                //Parsing del content
                if(content!=null){
                    let contentObj = Utility.parseContent(content);
                    //mettiamoci da parte una lista di tutti gli stili di tutte le row in contentObj post parse
                    for (let r = 0; r < contentObj.length; r++) {
                        let itemRow = contentObj[r];
                        if (itemRow.stile != null && itemRow.stile != "" && itemRow.stile.includes("_$Hidden")) {
                            var stile = itemRow.stile.replace("_$Hidden", "");
                            var stileUniversale = pluginMiddleware.getNameStileUniversale(stile);

                            if (stileUniversale != null) {

                                if (stileUniversale.fondamentale == "descrizione1") {
                                    descrInArchivio[0] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione2") {
                                    descrInArchivio[1] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione3") {
                                    descrInArchivio[2] = "";
                                }

                                if (stileUniversale.fondamentale == "descrizione4") {
                                    descrInArchivio[3] = "";
                                }
                            }
                        }
                    }
                }
            }
        }


        this.listen();

    }

    listen() {
        let me = this;

        let inddNettoInpage = "";
        let descr1InPage="";
        let descr2InPage="";
        let descr3InPage="";
        let descr4InPage="";

        //console.log("LISTEN");
        //console.log(this.myContainer.find("textarea"));
        this.myContainer.find("textarea").each((index, element) => {
            //console.log(element);
            let el = $(element);
            let labFam = el.attr("labelcorrispondente");

            if (labFam=="descrizione")
            {
                let style= el.attr("currentcharacterstyle");
                let univStyle = pluginMiddleware.getNameStileUniversale(style);
                if (univStyle!=null){

                    let val=el.val();
                    if (val[0]=='\n')
                    {
                        val = val.substring(1);                        
                    }
                    if (val[val.length-1]=='\n')
                    {
                        val = val.substring(0,val.length-1);
                    }

                    if (univStyle.fondamentale=="descrizione1")
                    {
                        if (descr1InPage=="")
                            descr1InPage=val;

                        inddNettoInpage+=val;
                    }
                                        
                    if (univStyle.fondamentale=="descrizione2")
                    {
                        if (descr2InPage=="")
                            descr2InPage=val;

                        inddNettoInpage+=val;
                    }

                    if (univStyle.fondamentale=="descrizione3")
                    {
                        if (descr3InPage=="")
                            descr3InPage=val;

                        inddNettoInpage+=val;
                    }


                    if (univStyle.fondamentale=="descrizione4")
                    {
                        if (descr4InPage=="")
                            descr4InPage=val;

                        inddNettoInpage+=val;
                    }
    

                }
            }
            

            let fam = me.datasource[labFam];
            if (fam == null) {
                me.datasource[labFam] = { lista: [], modificato: false };
            }

            me.datasource[labFam].lista.push(el);

            el.on('input', function (event) {
                //console.log("testo cambiato");

                let objFam = me.datasource[labFam];
                let elFamList = objFam.lista;

                let diff = false;
                for (let f = 0; f < elFamList.length; f++) {
                    let currVal = $(elFamList[f]).val();
                    let originVal = $(elFamList[f]).attr("defaultvalue");
                    //console.log(currVal + " != " + originVal);
                    if (currVal != originVal) {
                        diff = true;
                    }
                }

                objFam.modificato = diff;

                if (!diff) {
                    // for (let f = 0; f < elFamList.length; f++) {
                    //     $(elFamList[f]).css("background-color", "white");
                    //     //aggiungiamo una classe per il changestato
                    //     $(elFamList[f]).removeClass("textModified");
                    // }

                    $(el).css("background-color", "white");
                    //aggiungiamo una classe per il changestato
                    $(el).removeClass("textModified");
                    

                }
                else {
                    // for (let f = 0; f < elFamList.length; f++) {
                    //     $(elFamList[f]).css("background-color", "red");
                    //     //aggiungiamo una classe per il changestato
                    //     $(elFamList[f]).addClass("textModified");
                    // }

                    $(el).css("background-color", "red");
                    //aggiungiamo una classe per il changestato
                    $(el).addClass("textModified");
                }

                me.checkStato();

            });
            // $(element).on('keydown', me.onKeyDown);
        });

        this.checkStato();


        //Controllo MISMATCH

        this.descrInArchivio[0] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[0]);
        this.descrInArchivio[1] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[1]);
        this.descrInArchivio[2] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[2]);
        this.descrInArchivio[3] = Utility.replaceAllSpecialCharacters(this.descrInArchivio[3]);

        if (false){//this.descrInArchivio[4] != null && this.descrInArchivio[4] != "") {
            //Esiste in archivio la desczrizione INDD
            let inddNettoINArchivioObj = Utility.parseContent(this.descrInArchivio[4]);

            let inddNettoINArchivio ="";
            for (let i2=0; i2<inddNettoINArchivioObj.length; i2++ )
            {
                let item2 = inddNettoINArchivioObj[i2];
                let val=item2.content;
                // if (val[0]=='\n')
                // {
                //     val = val.substring(1);                        
                // }
                // if (val[val.length-1]=='\n')
                // {
                //     val = val.substring(0,val.length-1);
                // }
                inddNettoINArchivio+=Utility.trimDescrizione(val);
            }



            if (inddNettoINArchivio != Utility.trimDescrizione(inddNettoInpage)) {
                //MISMATCH WARNING
                $("#mismatchWarningPanel").text("ATTENZIONE - Mismatch tra impaginato e Istanta: La desrizione HTML non coincide");
                $("#mismatchWarningPanel").css("background-color", "orange");
                
                //Abilito il bottone di azione
                $("#salvaButton").css("display", "block");
                this.inMismatch=true;
            }
        }
        else {
            let report = "";

            if (Utility.trimDescrizione(this.descrInArchivio[0]) != Utility.trimDescrizione(descr1InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione1 no match";
            }
            if (Utility.trimDescrizione(this.descrInArchivio[1]) != Utility.trimDescrizione(descr2InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione2 no match";
            }
            if (Utility.trimDescrizione(this.descrInArchivio[2]) != Utility.trimDescrizione(descr3InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione3 no match";
            }
            if (Utility.trimDescrizione(this.descrInArchivio[3]) != Utility.trimDescrizione(descr4InPage)) {
                //MISMATCH WARNING
                report +=" Descrizione4 no match";
            }

            if (report != "") {
                //MISMATCH WARNING
                $("#mismatchWarningPanel").html("<h5>ATTENZIONE - Mismatch tra impaginato e Istanta:" + report+"</h5>");
                $("#mismatchWarningPanel").css("background-color", "orange");

                //Abilito il bottone di azione
                $("#salvaButton").css("display", "block");
                this.inMismatch=true;
            }

        }

    }

    checkStato() {
        let modificato = false;
        for (let key in this.datasource) {
            let objFam = this.datasource[key];

            if (objFam.modificato) {
                modificato = true;
                break;
            }

        }

        let azioniStrutturali = false;
        //controlliamo se #azioni_strutturali ha figli
        if ($("#azioni_strutturali").children().length > 0) {
            azioniStrutturali = true;
        }

        //$("#salvaButton").prop("disabled", !modificato);
        $("#salvaButton").css("display", modificato || azioniStrutturali ? "block" : "none");
        if (!this.convalidaFirma) {
            messaggioUtente("Convalidare firma", "warning", false, 3);
            //Il pulsante va fatto vedere a prescindere anche se con testo diverso
            //$("#salvaButton").text("Approva descrizione");
            //cambiamo il colore del testo del pulsante
            $("#salvaButton").css("color", "yellow");
            $("#salvaButton").css("display", "block");

            //$("#edit_campi_offerta").css("display", "none");

        }

        if (this.inMismatch)
        {
            $("#salvaButton").css("display", "block");
        }

    }

    getOperazioniDiSalvataggioDaFare(descrizioneEreditata = false)
    {
        //Funzione che torna al gestore le cose che devono essere cambiate
        let operazioni={
            revisione:{valore:"",valoreInddSoloFondamentali:"",valoreIndd:""},
            campi_offerta:[]
        };

        let lastValLettoInDescrizione="";

        for (let key in this.datasource) {
            let objFam = this.datasource[key];

            if (objFam.modificato ||
                (key=="descrizione" && (!this.convalidaFirma || this.inMismatch || descrizioneEreditata))
             ) {

                for(let i=0; i<objFam.lista.length; i++)
                {
                    let el = objFam.lista[i];
                    let style= $(el).attr("currentcharacterstyle");
                    let hasMismatch = $(el).hasClass("mismatchInImpaginato");
                    let textModified = $(el).hasClass("textModified");
                    let parag="none";
                    let parag_universale = parag;
                    if (style=="mix")
                    {
                        parag= $(el).attr("paragraphStyle");
                        let parag_universale_search = pluginMiddleware.getNameStileUniversale(parag);
                        if (parag_universale_search!=null)
                        {
                            parag_universale=parag_universale_search.nome;
                        }
                        else
                        {
                            parag_universale=parag;
                        }
                    }
                    
                    let valNetto = $(el).val();
                    //leggiamo descrInArchivio[i] e lo confrontiamo con valNetto


                    //Vediamo se dobbiamo aggiungere uno spazio prima dell'inizio del testo
                    // if (lastValLettoInDescrizione!="" && valNetto!="")
                    // {
                    //     if (valNetto[0]!=' ' && valNetto[0]!='\n')
                    //     {       
                    //         if (lastValLettoInDescrizione[lastValLettoInDescrizione.length-1]!=' ' && 
                    //             lastValLettoInDescrizione[lastValLettoInDescrizione.length-1]!='\n'
                    //         )
                    //         {
                    //             valNetto = " " + valNetto;   
                    //             $(el).val(valNetto);
                    //         }
                    //     }
                    // }  

                    let valWithTag="<"+style+">";
                    valWithTag+=valNetto;
                    valWithTag+="</"+style+">";

                    let stile_universale = pluginMiddleware.getNameStileUniversale(style);


                    let valoreInddUniversale=valWithTag;

                    if (stile_universale!=null)
                    {
                        valoreInddUniversale="<"+stile_universale.nome+">";
                        valoreInddUniversale+=valNetto;
                        valoreInddUniversale+="</"+stile_universale.nome+">";
                    }

                    if (key=="descrizione")
                    {
                        //operazioni.campi_offerta.push({label:key, valore:objFam.lista});
                        
                        if (stile_universale!=null)
                        {

                            //Lo prendo in considerazione                            

               
                            operazioni.revisione.valoreInddSoloFondamentali += valoreInddUniversale;
                            if (stile_universale.fondamentale=="descrizione1")
                            {
                                if (textModified || this.inMismatch || descrizioneEreditata) {
                                    operazioni.revisione.descrizione1 = valNetto;
                                } else if (operazioni.revisione.descrizione1 == null) {
                                    operazioni.revisione.descrizione1 = "<untouched>";
                                }
                            }
                            else if (stile_universale.fondamentale=="descrizione2")
                            {
                                if (textModified || this.inMismatch || descrizioneEreditata) {
                                    operazioni.revisione.descrizione2 = valNetto;
                                } else if (operazioni.revisione.descrizione2 == null) {
                                    operazioni.revisione.descrizione2 = "<untouched>";
                                }
                            }
                            else if (stile_universale.fondamentale=="descrizione3")
                            {
                                if (textModified || this.inMismatch || descrizioneEreditata) {
                                    operazioni.revisione.descrizione3 = valNetto;
                                } else if (operazioni.revisione.descrizione3 == null) {
                                    operazioni.revisione.descrizione3 = "<untouched>";
                                }
                            }
                            else if (stile_universale.fondamentale=="descrizione4")
                            {
                                if (textModified || this.inMismatch || descrizioneEreditata) {
                                    operazioni.revisione.descrizione4 = valNetto;
                                } else if (operazioni.revisione.descrizione4 == null) {
                                    operazioni.revisione.descrizione4 = "<untouched>";
                                }
                            }

                        }

                        operazioni.revisione.valore += valNetto;
                        operazioni.revisione.valoreIndd += valWithTag;

                        //Descrizione come campo SyncIndd
                        let item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        if (item==null)
                        {
                            operazioni.campi_offerta.push(
                                {
                                    label:key, 
                                    labelUniversale:key,
                                    valore:"",
                                    valoreIndd:"",
                                    valoreInddSoloFondamentali:"",
                                    paragraphStyle:"none",//Descrizione non puo avere paragrafo
                                    paragraphStyleUniversale:"none"

                                }
                            );
                        }
                        item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        item.valore += valNetto;
                        item.valoreIndd+= valWithTag;
                        item.valoreInddSoloFondamentali += valoreInddUniversale;

                        if (valNetto!="")
                        {
                            //Solo se il campo  definito
                            lastValLettoInDescrizione = valNetto;
                        }
                    }
                    else
                    {
                        //operazioni.campi_offerta.push({label:key, valore:objFam.lista});
                        let item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        if (item==null)
                        {
                            operazioni.campi_offerta.push(
                                {
                                    label:key, 
                                    labelUniversale:(stile_universale!=null?stile_universale.nome:key),
                                    valore:"",
                                    valoreIndd:"",
                                    valoreInddSoloFondamentali:"",
                                    paragraphStyle:parag,
                                    paragraphStyleUniversale:parag_universale
                                }
                            );
                        }
                        item = operazioni.campi_offerta.find(x=>Utility.parseLabel(x.label)==key);
                        item.valore += valNetto;
                        item.valoreIndd+= valWithTag;
                        item.valoreInddSoloFondamentali += valoreInddUniversale;

                    }


                }
                    
            }

        }

        return operazioni;
    }


    /// I20-993: mette o toglie la sola lettura sui campi della scheda.
    ///
    /// Solo la variante piu' specifica applicabile si modifica; le altre si mostrano e basta.
    /// Chi non chiama questo metodo non cambia comportamento: si parte modificabili, come prima.
    impostaSolaLettura(solaLettura) {
        this.solaLettura = solaLettura === true;

        let me = this;

        this.myContainer.find("textarea").each(function () {
            let campo = $(this);

            //Alcuni campi nascono gia' in sola lettura, perche' l'agenzia o la revisione non
            //li lascia toccare. Quello stato va ricordato la prima volta e mai perso: togliere
            //la sola lettura a tutti renderebbe scrivibile chi non doveva esserlo.
            if (campo.attr("data-solaletturaoriginale") == null) {
                campo.attr("data-solaletturaoriginale", campo.prop("readonly") ? "1" : "0");
            }

            let originale = campo.attr("data-solaletturaoriginale") === "1";

            campo.prop("readonly", me.solaLettura || originale);
            //Si vede che non si tocca, senza nascondere il testo: serve leggerlo.
            campo.css("opacity", me.solaLettura ? "0.6" : "");
        });
    }
}

module.exports = InputEditController;