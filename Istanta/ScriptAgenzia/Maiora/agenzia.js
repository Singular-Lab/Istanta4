
/* Maiora */

class Agenzia extends IAgenzia {
    repartoPath = "";
    tipo_tracciato_selezionato = 0;
    Form_importazioneTracciato = "";

    lista_temporanea;
    lista_ordinata=[];
    blocco_lista_ordinata = [];
    parametri_visualizzati_codice_menabo = [keyRefCodice];
    parametri_visualizzati_tracciato_menabo = [keyDescr1];
    parametri_visualizzati_revisionato_menabo = ["descrizione1", "descrizione2", "descrizione3", "descrizione4"];

    Form_ricercaTracciato = '<div class="input-group input-group-sm">' +
        '<select class="form-select form-select-sm" id="ricercaTracciato" name="ricercaTracciato" style="width: 40%;" onchange="menaboInstance.ricercaInTracciatoMenabo($(this))" onclick="this.classList.remove(\'bg-danger\')" onchange="this.classList.remove(\'bg-success\',\'bg-opacity-25\')">' +
        '<option value="0" selected>Filtro</option>' +
        '<option value="tipo_offerta">Tipo Offerta</option>' +
        '<option value="reparto">Reparto</option>' +
        '<option value="descrizione_promozione">Descr. promozione</option>' +
        '<option value="posizione">Posizione</option>' +
        '</select>' +
        '<input type="text" id="ricercaText" class="form-control ricercaText" aria-label="Sizing example input" aria-describedby="inputGroup-sizing-sm" style="width: 50%;" onkeypress="menaboInstance.ricercaInTracciatoMenabo($(this))" >' +
        '<img src="images/trashcanIcon.png" class="mx-1" id="trashIcon" style="width:20px;" onclick="menaboInstance.rimuoviParametroRicerca($(this))"/>' +
        '</div>';

    //tag descrizioniIndd
    DESCRIZIONE_TITOLO = "<DESCRIZIONE TITOLO>";
    DESCRIZIONE_TITOLO_end = "</DESCRIZIONE TITOLO>";
    DESCRIZIONE_GRAMMATURA = "<DESCRIZIONE GRAMMATURA>";
    DESCRIZIONE_GRAMMATURA_end = "</DESCRIZIONE GRAMMATURA>";
    DESCRIZIONE_TIPO = "<DESCRIZIONE TIPO>";
    DESCRIZIONE_TIPO_end = "</DESCRIZIONE TIPO>";
    DESCRIZIONE_CARTA = "<DESCRIZIONE CARTA>";
    DESCRIZIONE_CARTA_end = "</DESCRIZIONE CARTA>";
    DESCRIZIONE_11 = "<DESCRIZIONE 1+1>";
    DESCRIZIONE_11_end = "</DESCRIZIONE 1+1>";
    ESEMPIO = "<ESEMPIO>";
    ESEMPIO_end = "</ESEMPIO>";
    DESCRIZIONE_ESEMPIO = "<DESCRIZIONE ESEMPIO>";
    DESCRIZIONE_ESEMPIO_end = "</DESCRIZIONE ESEMPIO>";
    PEZZI_DISPONIBILI = "<PEZZI DISPONIBILI>";
    PEZZI_DISPONIBILI_end = "</PEZZI DISPONIBILI>";
    PARAGRAFO_BASE = "<[Paragrafo base]>";
    PARAGRAFO_BASE_end = "</[Paragrafo base]>";


    InserimentiArticoloNascostiIds = []; //inserire id degli elementi da nascondere tipo artwork
    parametriCodiceScatto = ["categoria", "reparto", "settore", "ragione_sociale", "prestazione", "speciale"];
    parametriComposizioneCustom = [{ segnaposto: "pag" }]


    compilaBoxAgenzia(item, callback){
        let template = $("#templateBox").clone();

        let htmlBox = $(template.html());

        let codice = "";
        let descr = "";

        let _container = htmlBox.find(".refInMenabo");
        console.log(callback);

        if (item.idRecord > 0) {
            let obj = menaboInstance.tracciatoSource.find(f => f.idRec == item.idRecord);
            if (obj == null) {
                obj = menaboInstance.tracciatoSourceObsoleti.find(f => f.idRec == item.idRecord);
            }
            codice = obj.recordInTracciato[keyRefCodice];

            if (obj.recordRevisionato != null) {
                if (obj.recordRevisionato.descrizioneIndd != null && obj.recordRevisionato.descrizioneIndd != "") {
                    let stringa = obj.recordRevisionato.descrizioneIndd;
                    let finalString = "";
                    let substring = "";
                    let i = 0;
                    while (i < stringa.length) {
                        //console.log(stringa[i]);
                        finalString += stringa[i];
                        if (stringa[i] == "<")
                        {
                            substring = "";
                        }
                        substring += stringa[i];
                        if (stringa[i] == ">" &&
                            (substring == this.PARAGRAFO_BASE || substring == this.PARAGRAFO_BASE_end
                                || substring == this.DESCRIZIONE_TITOLO || substring == this.DESCRIZIONE_TITOLO_end
                                || substring == this.DESCRIZIONE_GRAMMATURA || substring == this.DESCRIZIONE_GRAMMATURA_end
                                || substring == this.DESCRIZIONE_TIPO || substring == this.DESCRIZIONE_TIPO_end
                                || substring == this.DESCRIZIONE_CARTA || substring == this.DESCRIZIONE_CARTA_end
                                || substring == this.DESCRIZIONE_11 || substring == this.DESCRIZIONE_11_end
                                || substring == this.ESEMPIO || substring == this.ESEMPIO_end
                                || substring == this.DESCRIZIONE_ESEMPIO || substring == this.DESCRIZIONE_ESEMPIO_end
                                || substring == this.PEZZI_DISPONIBILI || substring == this.PEZZI_DISPONIBILI_end))
                        {
                            finalString = finalString.replace(substring, "");
                        }
                        i++;
                        if (i > 1000) {
                            break;
                        }
                    }
                    descr = finalString;
                }
                else {
                    for (var i = 0; i < this.parametri_visualizzati_revisionato_menabo.length; i++) {
                        if (obj.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]] != null && obj.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]] != "") {
                            if (descr != "") {
                                descr += "\n";
                            }
                            descr += obj.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]];
                        }
                    }
                }

            }

            if (descr == "") {
                for (var i = 0; i < this.parametri_visualizzati_tracciato_menabo.length; i++) {
                    if (obj.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]] != null && obj.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]] != "") {
                        if (descr != "") {
                            descr += "\n";
                        }
                        descr += obj.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]];
                    }
                }
            }
        }
        else {
            let obj_gruppo = menaboInstance.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == null && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
            if (obj_gruppo == null) {
                obj_gruppo = menaboInstance.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == null && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
            }
            if (obj_gruppo != null) {
                codice = obj_gruppo.recordInTracciato[keyScattoCodiceGruppo];

                if (obj_gruppo.recordRevisionato != null) {

                    if (obj_gruppo.recordRevisionato.descrizioneIndd != null && obj_gruppo.recordRevisionato.descrizioneIndd != "") {
                        let stringa = obj_gruppo.recordRevisionato.descrizioneIndd;
                        let finalString = "";
                        let substring = "";
                        let i = 0;
                        while (i < stringa.length) {
                            //console.log(stringa[i]);
                            finalString += stringa[i];
                            if (stringa[i] == "<") {
                                substring = "";
                            }
                            substring += stringa[i];
                            if (stringa[i] == ">" &&
                                (substring == this.PARAGRAFO_BASE || substring == this.PARAGRAFO_BASE_end
                                    || substring == this.DESCRIZIONE_TITOLO || substring == this.DESCRIZIONE_TITOLO_end
                                    || substring == this.DESCRIZIONE_GRAMMATURA || substring == this.DESCRIZIONE_GRAMMATURA_end
                                    || substring == this.DESCRIZIONE_TIPO || substring == this.DESCRIZIONE_TIPO_end
                                    || substring == this.DESCRIZIONE_CARTA || substring == this.DESCRIZIONE_CARTA_end
                                    || substring == this.DESCRIZIONE_11 || substring == this.DESCRIZIONE_11_end
                                    || substring == this.ESEMPIO || substring == this.ESEMPIO_end
                                    || substring == this.DESCRIZIONE_ESEMPIO || substring == this.DESCRIZIONE_ESEMPIO_end
                                    || substring == this.PEZZI_DISPONIBILI || substring == this.PEZZI_DISPONIBILI_end))
                            {
                                finalString = finalString.replace(substring, "");
                            }
                            i++;
                            if (i > 1000) {
                                break;
                            }
                        }
                        console.log(finalString);
                        descr = finalString;
                    }
                    else
                    {
                        for (var i = 0; i < this.parametri_visualizzati_revisionato_menabo.length; i++) {
                            if (obj_gruppo.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]] != null && obj_gruppo.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]] != "") {
                                if (descr != "") {
                                    descr += "\n";
                                }
                                descr += obj_gruppo.recordRevisionato[this.parametri_visualizzati_revisionato_menabo[i]];
                            }
                        }
                    }
                }
                if (descr == "") {
                    for (var i = 0; i < this.parametri_visualizzati_tracciato_menabo.length; i++) {
                        console.log(obj_gruppo.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]]);
                        if (obj_gruppo.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]] != null && obj.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]] != "") {
                            if (descr != "") {
                                descr += "\n";
                            }
                            descr += obj_gruppo.recordInTracciato[this.parametri_visualizzati_tracciato_menabo[i]];
                        }
                    }
                }

                if (descr == null) {
                    descr = "<i>Non definita</i>";
                }
            }
        }
        _container.find("#boxTitle").text(codice);
        _container.find("#boxDescr").html(descr);

        console.log(callback);
        let result = [_container, htmlBox]
        callback(result);

    }

    getForm_importazioneTracciato(callback) {
        let result = this.Form_importazioneTracciato;
        callback(result);

    }

    setRecord_revisioneArticolo(htmlItem) {

        let descr1 = htmlItem.find("#Descrizione1");
        let descr2 = htmlItem.find("#Descrizione2");
        let descr3 = htmlItem.find("#Descrizione3");
        let descr4 = htmlItem.find("#Descrizione4");

        descr1.parent().find(".form-label").text("Brand");
        descr2.parent().find(".form-label").text("Nome");
        descr3.parent().find(".form-label").text("Tipo/Gusto");
        descr4.parent().find(".form-label").text("Grammatura");

        let descr1T = htmlItem.find("#Descrizione1Tracciato");
        let descr2T = htmlItem.find("#Descrizione2Tracciato");
        let descr3T = htmlItem.find("#Descrizione3Tracciato");
        let descr4T = htmlItem.find("#Descrizione4Tracciato");


        descr1T.parent().find(".form-label").text("Nome");
        descr2T.parent().find(".form-label").text("Brand");
        descr3T.parent().find(".form-label").text("Tipo/Gusto");
        descr4T.parent().find(".form-label").text("Grammatura");

    }


    filterRecordsTracciatiOnMenabo(lista) {

        return lista;

    }


    ordinaRecordsTracciatoInMenabo(lista, cb) {


        let lista_ordinata = lista.sort(function (a, b) {
            var inxA = "";
            var inxB = "";
            if (a.recordInTracciato["pag"] != null)
                inxA = a.recordInTracciato["pag"];
            if (b.recordInTracciato["pag"] != null)
                inxB = b.recordInTracciato["pag"];

            a.ordered = true;
            b.ordered = true;

            if (inxA < inxB)
                return -1;
            else if (inxA > inxB)
                return 1;
            else
                return 0;
        });

        cb(lista_ordinata);

    }

    vuoiAggiungereFiltri(List) {
        console.log("entroInAgenzia filtri");
        console.log(List);
        let element = $("#FiltriAnchor");
        let listFiltro = [];
        let tmpItem = '<div class="row mt-5">' +
            '<div class="col-2">' +
            '<label for="CmbReparto" class="form-label">Reparto</label>'+
            '<select id="CmbReparto" name="CmbReparto" class="form-select form-select-sm" customSearchParameterPath="reparto" onchange="revInstance.setCustomSearch(this)">';
        List.forEach(function (item) {

            if (item.recordInTracciato != null && item.recordInTracciato.reparto !=null && listFiltro.indexOf(item.recordInTracciato.reparto) < 0)
            {
                //Lo devo mettere in lista
                listFiltro.push(item.recordInTracciato.reparto);
            }

        });

        console.log(listFiltro);
        for (let i = 0; i < listFiltro.length; i++)
        {
            if (i == 0) {
                tmpItem += '<option value="Reset">Nessun reparto selezionato</option>';
            }
            tmpItem += '<option value="' + listFiltro[i] + '">' + listFiltro[i] + '</option>';
        }
        tmpItem += '</select>' +
            '</div>';


        tmpItem += '<div class="col-2">' +
            '<label for="CmbSpeciale" class="form-label">Speciale</label>'+
            '<input type="text" id="CmbSpeciale" name="CmbSpeciale" class="form-control" customSearchParameterPath="speciale" onchange="revInstance.setCustomSearch(this)">';



        tmpItem +='</div>';
        tmpItem +='</div>';
        element.empty();
        element.append($(tmpItem));

        
    }

    onRenderRefInListaMenabo(groupElements, codice, area) {
        console.log("### RENDER " + codice);
        this.AggiungiInfo(groupElements, codice);
        this.ApplicaSegnaposto(groupElements, codice);
    }

    onRenderFinestraEsportazionePoP()
    {
        //La finestra POP si sta aprendo, chiamo le logiche di agenzia per sapere se vuole aggiugnere qualcosa
        $("#divEsportaPopAgenzia").css("display", "block");
        $("#divEsportaPopAgenzia").empty();
        //Aggiungo tendina di scelta del formato. Obbligatoria da specificare
        $("#divEsportaPopAgenzia").append(
            '<label for="cmbFormato" class="form-label">Formato</label>' +
            '<select class="form-select form-select-lg mb-3" id="cmbFormato" name="cmbFormato">' +
            '<option value="locandina" selected>Locandina</option>' +
            '<option value="stopper">Stopper</option>' +
            '</select>');
    }

    AggiungiInfo(groupElements, codice) {
        let currentElement = groupElements.find(f => f.recordInTracciato[keyRefCodice] == codice);

        if (codice.indexOf(',') != -1) {

            return;
        }


        let elementHtml = $("#container_tracciato").find(".record_menabo[id_rec='" + currentElement.idRec + "']");

        if (currentElement.recordInTracciato.prezzo != null) {
            elementHtml.find("#agenziaRow0").html("<span>Prezzo:<br> <b>€ " + currentElement.recordInTracciato.prezzo + "</b></span>");
            elementHtml.find("#agenziaRow0").css("display", "flex");
            elementHtml.find("#agenziaRow0").css("font-size", "12px");
        }
        else {
            elementHtml.find("#agenziaRow0").css("display", "none");
        }

        if (currentElement.recordInTracciato.tipo_foto != null && currentElement.recordInTracciato.tipo_foto != "") {
            elementHtml.find("#agenziaRow1").text(currentElement.recordInTracciato.tipo_foto);
            elementHtml.find("#agenziaRow1").css("display", "flex");
            elementHtml.find("#agenziaRow1").css("font-weight", "bold");
        }
        else {
            elementHtml.find("#agenziaRow1").css("display", "none");
        }

        if (currentElement.recordInTracciato.prestazione != null &&
            currentElement.recordInTracciato.prestazione == currentElement.recordInTracciato[keyRefCodice]
            )
        {
            elementHtml.find("#agenziaRow2").text("PILOTA");
            elementHtml.find("#agenziaRow2").css("display", "flex");
            elementHtml.find("#agenziaRow2").css("font-weight", "bold");
        }
        else {
            elementHtml.find("#agenziaRow2").css("display", "none");
        }
        


        
    }

    ApplicaSegnaposto(groupElements, codice) {
        if (groupElements.length > 1 && codice.indexOf(",") == -1) {
            return;
        }

        let segnaposto = $("#segnaposto_template").clone();
        segnaposto = $(segnaposto.html());
        segnaposto.find("#valueSegna").attr("val", "0");
        segnaposto.find("#valueSegna").attr("evid", "0");
        segnaposto.find("#valueSegna").css("width", "25%");

        let segnapostoChiave = [];
        for (const param of this.parametriComposizioneCustom) {
            if (param.segnaposto) {
                let chiavi = param.segnaposto.split(" ");
                chiavi.forEach(function (item) {
                    segnapostoChiave.push(item);
                });                
                break;
            }
        }

        console.log("Conteggio EVID " + codice);
        var countEvi = 0;
        groupElements.forEach(function (item) {
            if (item.recordInTracciato != null && item.recordInTracciato.tipo_foto!=null && item.recordInTracciato.tipo_foto.indexOf("EVID") >= 0)
                countEvi++;
        });
        console.log(countEvi);


        if (segnapostoChiave.length > 0) {
            let chiaveValore = [];
            let label = "";
            segnapostoChiave.forEach(function (item) {
                chiaveValore.push(groupElements[0].recordInTracciato[item])
                label += groupElements[0].recordInTracciato[item] + " - ";
            });
            label = label.substring(0, label.length - 3);
            segnaposto.find("#labelSegna").text("Pag. " + label.toLowerCase());

            let pageElement;
            if (groupElements.length > 1) {
                pageElement = $(".record_menabo_gruppo[codice_gruppo='" + codice + "']");
            } else {
                pageElement = $(".record_menabo[codice_gruppo='" + codice + "']");
            }


            let Segna;
            Segna = this.findElementFromBottomUp((groupElements.length > 1 ? pageElement.parent().parent() : pageElement), "#segnaposto");
            //console.log(Segna);
            if (Segna != null && Segna.find("#labelSegna").text() == "Pag. " + label.toLowerCase()) {
                //let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
                let lastSegnaValue = parseInt(Segna.find("#valueSegna").attr("val"));
                lastSegnaValue++;
                
                Segna.find("#valueSegna").attr("val", lastSegnaValue);
                Segna.find("#valueSegna").text(lastSegnaValue);
                if (countEvi > 0) {
                    Segna.find("#valueSegna").attr("evid", parseInt(Segna.find("#valueSegna").attr("val")) + countEvi);                    
                }

                //if (Segna.find("#valueSegna").attr("evid")!="0")
                    //Segna.find("#valueSegna").text(lastSegnaValue + " (" + Segna.find("#valueSegna").attr("evid") + " EVID)");
                
                //console.log(lastSegnaValue);
            } else {
                if (groupElements.length > 1) {
                    let newSegna = segnaposto.insertBefore(pageElement.parent().parent());
                    Segna = this.findElementFromUpBottom(pageElement.parent().parent(), "#segnaposto");
                    if (Segna != null && Segna.find("#labelSegna").text() == "Pag. " + label.toLowerCase()) {
                        //let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
                        let lastSegnaValue = parseInt(Segna.find("#valueSegna").attr("val"));
                        lastSegnaValue++;
                        
                        newSegna.find("#valueSegna").attr("val", lastSegnaValue);
                        newSegna.find("#valueSegna").text(lastSegnaValue);
                        if (countEvi > 0) {
                            newSegna.find("#valueSegna").attr("evid", parseInt(Segna.find("#valueSegna").attr("val")) + countEvi);
                            
                        }

                        //if (newSegna.find("#valueSegna").attr("evid") != "0")
                            //newSegna.find("#valueSegna").text(lastSegnaValue + " (" + newSegna.find("#valueSegna").attr("evid") + " EVID)");

                        

                        Segna.remove();
                        //console.log(lastSegnaValue);
                    }


                } else {

                    let lastSegnaValue = parseInt(segnaposto.find("#valueSegna").attr("val"));
                    lastSegnaValue++;

                    segnaposto.find("#valueSegna").attr("val", lastSegnaValue);

                    if (countEvi > 0) {
                        segnaposto.find("#valueSegna").attr("evid", parseInt(segnaposto.find("#valueSegna").attr("val")) + countEvi);                    
                    }

                    //if (segnaposto.find("#valueSegna").attr("evid") != "0")
                        //segnaposto.find("#valueSegna").text(lastSegnaValue + " (" + segnaposto.find("#valueSegna").attr("evid") + " EVID)");

                    segnaposto.insertBefore(pageElement);
                }
            }
        }
    }

    findElementFromBottomUp(startElement, targetSelector) {
        let currentElement = $(startElement);
        while (currentElement.length > 0) {
            if (currentElement.is(targetSelector)) {
                return currentElement;
            }
            currentElement = currentElement.prev();
        }
        return null; // Se non trovi l'elemento desiderato, restituisci null
    }

    findElementFromUpBottom(startElement, targetSelector) {
        let currentElement = $(startElement);
        while (currentElement.length > 0) {
            if (currentElement.is(targetSelector)) {
                return currentElement;
            }
            currentElement = currentElement.next();
        }
        return null; // Se non trovi l'elemento desiderato, restituisci null
    }

    AggiornaSegnapostiPostRicerca() {
        let me = this;
        $("#container_tracciato .segnaposto").each(function () {
            let countSibling = me.contaSiblingSottoSegnaposto(this);
            $(this).find("#labelValue").text(countSibling);
            if (countSibling == 0) {
                $(this).css("display", "none");
            }
            else {
                $(this).css("display", "block");
            }
        });
    }

    contaSiblingSottoSegnaposto(segnaposto) {
        let count = 0;
        let currentElement = $(segnaposto).next();

        while (currentElement.length > 0 && !currentElement.hasClass('segnaposto')) {
            if (currentElement.is(':visible')) {
                count++;
            }
            currentElement = currentElement.next();
        }

        return count;
    }

    getForm_ricercaTracciato(callback) {
        let result = this.Form_ricercaTracciato;
        callback(result);
    }

    customViewOnRecordSyncFromIndd(dato, codice_gruppo, elementGruppo, elementiFigli) {

        let primoFiglio = dato.find(d => d.codiceGruppo == codice_gruppo);
        //Attenzione, fare chiave DINAMICA in utility.js
        if (primoFiglio.dato.SyncIndd != null) {
            console.log(primoFiglio.dato.SyncIndd);
            if (primoFiglio.dato.SyncIndd.requisiti[keyRequisitoDescrizioneSingola]) {
                //Qui posso comprimere i figli, al massimo li rimette dopo l'utente se vuol vedere
                if (primoFiglio.log.stato == 1) {
                    elementGruppo.find("#lab_stato").text("Ok");
                    elementGruppo.css("background-color", "#daedda");

                }
                else if (primoFiglio.log.stato == 2) {
                    elementGruppo.find("#lab_stato").text("Non trovato in tracciato");
                    elementGruppo.css("background-color", "#626262");
                    elementGruppo.css("color", "white");
                }
                else if (primoFiglio.log.stato == 3) {
                    elementGruppo.find("#lab_stato").text("Gruppo corrotto");
                    elementGruppo.css("background-color", "#dfbbbb");

                }
                else if (primoFiglio.log.stato == 4) {
                    elementGruppo.css("background-color", "#b8d0df");
                    elementGruppo.find("#lab_stato").text("Nuovo multiplex");

                }



                elementiFigli.removeClass("collapsedRef");
                elementGruppo.find(".icoCollapse").attr("src", "/images/collapse.png");

            }
            else {

                console.warn("Analisi gruppo custom from navcove js");
                console.warn(primoFiglio);
                elementGruppo.find("#lab_descrizione").text("La metterò");// primoFiglio.dato.SyncIndd.indd.descrizione);
                //elementGruppo.find("#lab_descrizione").html("<span style='color:red;'><b>Uscirà per tutti la stessa descrizione</b></span><br>" + primoFiglio.dato.SyncIndd.indd.descrizione);

                elementiFigli.addClass("collapsedRef");
                elementGruppo.find(".icoCollapse").attr("src", "/images/expand.png");
            }
        }
        else {
            elementGruppo.find(".icoCollapse").attr("src", "/images/expand.png");
        }


        let count = [0, 0, 0, 0, 0];
        elementiFigli.each(function () {
            count[parseInt($(this).attr("stato"))] += 1;
        });

        if (count[1] == elementiFigli.length) {
            elementGruppo.find("#lab_stato").text("Ok");
            elementGruppo.css("background-color", "#daedda");
        }
        else {
            if (count[0] > 0) {
                elementGruppo.css("background-color", "#dfbbbb");
                elementGruppo.find("#lab_descrizione").text("");
                elementGruppo.find("#lab_stato").text("Non trovato in impaginato");
            }
            else if (count[2] > 0) {
                elementGruppo.find("#lab_stato").text("Non trovato in tracciato");
                elementGruppo.css("background-color", "#626262");
                elementGruppo.css("color", "white");
            }
            else if (count[3] > 0) {
                elementGruppo.find("#lab_stato").text("Gruppo corrotto");
                elementGruppo.css("background-color", "#dfbbbb");
            }
            else if (count[4] > 0) {
                elementGruppo.css("background-color", "#b8d0df");
                elementGruppo.find("#lab_stato").text("Nuovo multiplex");
            }
        }

    }

    returnParametriCodiciScatto() {
        return this.parametriCodiceScatto;
    }

    NascondiParametriInserimentoArticoli() {
        this.InserimentiArticoloNascostiIds.forEach(function (item) {
            $("#inserisciArticoloInDB").find(".campoArticolo").each(function () {
                $(this).find('[id="' + item + '"]').css("display", "none");
            });
        });
    }

    OperazioniInserimentoArticoliCustom(idTracciato) {
        $("#rm").val("true");
        Call.do("Tracciati", "getTracciatoById/" + idTracciato, "GET", null, this, function (result, sender) {
            if (result == null) {
                console.error("Tracciato corrente non trovato nel database, errore");
            }
            else {
                let boolOro = result.sigla.includes("ORO");
                let boolProssimità = result.sigla.includes("PROSSIMITA");
                if (boolOro) { $("#rv").val("true"); }
                else { $("#rv").val("false"); }
                if (boolProssimità) { $("#rp").val("true"); }
                else { $("#rp").val("false"); }

            }
        });

    }

    getCustomConfronti() {
        $("#customOutOfmainContent").append(this.schedeCustomConfronti);
        $("#pageContent").appendTo($("#ConfrontoTracciatiScheda"));
    }

    controllaCambioPromoCustomConfrontiPostOperation(tendinaVal) {
        $("#TendinaTracciato1").text("Confronta locandine");
    }

    appendPromoToOtherElements(result){
        result.forEach(function (item) {
            $("#TendinaPromo").append("<option value=" + item.id + ">" + item.nomePromo + "</option>");
        });
    }

    impostaCheckbox(idPromo) {
        $("#TracciatiVolantini").empty();
        if (idPromo != 0) {
            $("#confrontaButtonLocandine").prop('disabled', false);
            Call.do("Tracciati", "GetTracciatiPromo/" + idPromo, "GET", null, this, function (result, sender) {
                console.log(result);
                if (typeof result !== 'string') {
                    result.forEach(function (item) {
                        $("#TracciatiVolantini").append('<div class="form-check locandineCheckbox">' +
                            '<input class="form-check-input" nomeTracciato="'+item.sigla+'" type="checkbox" id="' + item.id + '" value="' + item.id+'">' +
                            '<label class="form-check-label" for="' + item.id + '">' + // Usa l'ID specifico
                            item.sigla +
                            '</label>' +
                            '</div>');
                    });
                }
                else {
                    console.log(result);
                }
            });
        }
        else {
            $("#confrontaButtonLocandine").prop('disabled', true);
        }
    }

    confrontaLocandine() {
        let checkboxSpuntati = $(".locandineCheckbox input[type='checkbox']:checked");
        if (checkboxSpuntati.length < 2) {
            alert("Selezionare almeno 2 checkbox per poter continuare");
            return;
        }


        let IdPromo1 = parseInt($("#TendinaPromo").val(), 10);
        let IdPromo2 = parseInt($("#TendinaPromo").val(), 10);
        let IdTracc1 = [];
        let IdTracc2 = [];
        let count = 0;
        let paramTracciati = "";
        checkboxSpuntati.each(function () {
            if (count == 0) {
                count++;
                IdTracc1.push($(this).val());
                paramTracciati += "&" + $(this).val() + "=" + $(this).attr("nometracciato");
            }
            else {
                IdTracc2.push($(this).val());
                paramTracciati += "&" + $(this).val() + "=" + $(this).attr("nometracciato");
            }
        });
        let versionePrec = false;
        let destinazione = $("#InputDirectoryLoc").val();

        let InputForConfronto = {
            requestForms: "confrontoLocandine=true" + paramTracciati,
            IdPromoPrimaria: IdPromo1,
            IdPromoSecondaria: IdPromo2,
            IdTracciatoPrimario: IdTracc1,
            IdTracciatoSecondario: IdTracc2,
            VersionePrecedente: versionePrec,
            CartellaDiEsportazione: destinazione
        }

        Call.do("Confronti", "ConfrontaListe", "PUT", InputForConfronto, this, function (result, sender) {
            $("#row_progress_export_loc").attr("id_attivita", result.attivita.id);
            $("#row_progress_export_loc").css("display", "block");
            taskManager.Add(result.attivita.id);
        });
    }

    setScheda(schedaNumber, testata) {
        let testate = $(".testataSchedaConfronti");
        testate.each(function () {
            $(this).removeClass("active");
        });
        testata.addClass("active");
        let allSchede = $(".schedaConfronti");
        allSchede.each(function () {
            $(this).removeClass("active");
        });
        if (schedaNumber == 1) {
            $("#ConfrontoTracciatiScheda").addClass("active");
        }
        else if (schedaNumber == 2) {
            $("#ConfrontoLocandineScheda").addClass("active");
        }
    }
}