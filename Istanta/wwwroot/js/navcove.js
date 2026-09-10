
class Agenzia {
    repartoPath = "";
    tipo_tracciato_selezionato = 0;
    Form_importazioneTracciato = ""/*'<div class="row">' +
        '<div class="col">' +
        '<select class="form-select form-select-lg mt-4" id="cmbTipoTracciato" name="cmbTipoTracciato">' +
        '<option value="0" selected>Seleziona tipologia di tracciato</option>' +
        '<option value="1">Volantino</option>' +
        '<option value="2">PoP</option>' +
        '</select>' +
        '</div>' +       
        '</div>' +*/
       /* '<div class="row mt-3" id="row_canale_area">' +
        '<div class="col">' +
        '<select class="form-select form-select-lg" id="cmbCanaleArea" name="cmbCanaleArea">' +
        '<option value="0" selected>Seleziona Canale/Area</option>' +
        '$source_aree' +
        '</select>' +
        '</div>' +    
        '</div>' +  */
        /*
        '<div class="row mt-4" id="row_mzap_name" style="display:none;">' +
        '<div class="col-4">' +
        '<label for="NomeEsportazione" class="form-label">Nome:</label>' +
        '<input type="text" id="NomeEsportazione" name="NomeEsportazione" class="form-control" />' +
        '</div>' +
        '</div>' +
        '<div class="row mt-3">' +
        '<div class="col-4">' +
        '<label for="FileTracciato" class="form-label">File del tracciato</label>' +
        '<input type="file" id="FileTracciato" name="FileTracciato" class="form-control" />' +
        '</div>' +
        '</div>' +
        '</div>'*/;

    formatiMenaboPagina = ["1x1", "2x2", "3x3", "4x3", "3x4", "4x4", "5x4", "4x5", "5x5", "6x6"];

    lista_temporanea;
    lista_ordinata=[];
    blocco_lista_ordinata = [];
    parametri_visualizzati_codice_menabo = [keyRefCodice];
    parametri_visualizzati_tracciato_menabo = [keyDescr1];
    parametri_visualizzati_revisionato_menabo = ["descrizione1", "descrizione2", "descrizione3", "descrizione4"];

    Form_ricercaTracciato = '<div class="input-group input-group-sm">' +
        '<select class="form-select form-select-sm" id="ricercaTracciato" name="ricercaTracciato" style="width: 40%;" onchange="menaboInstance.aggiustaRicerca($(this))" onclick="this.classList.remove(\'bg-danger\')" onchange="this.classList.remove(\'bg-success\',\'bg-opacity-25\')">' +
        '<option value="0" selected>Filtro</option>' +
        '<option value="speciale">Speciale</option>' +
        '<option value="reparto">Reparto</option>' +
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
    parametriComposizioneCustom = [{ segnaposto:"settore reparto"}]

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
        /*
        let ME = this;

        $.getJSON('external_source/SourceAree.json?v=1', function (data) {

            let _bind_areeHtml = "";
            for (let i = 0; i < data.source.length; i++) {
                let item = data.source[i];
                _bind_areeHtml += "<option value=\"" + item.Id + "\">" + item.Codice + "</option>";
            }

            result = result.replace("$source_aree", _bind_areeHtml);

            callback(result);
        });*/

    }


    setRecord_revisioneArticolo(htmlItem) {

        let descr1 = htmlItem.find("#Descrizione1");
        let descr2 = htmlItem.find("#Descrizione2");
        let descr3 = htmlItem.find("#Descrizione3");
        let descr4 = htmlItem.find("#Descrizione4");

        descr1.parent().find(".form-label").text("Nome");
        descr2.parent().find(".form-label").text("Brand");
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

        /*let result = [];

        for (let i = 0; i < lista.length; i++) {
            let item = lista[i];
            let field = item.recordInTracciato["tipo_volantino"];
            if (field != null) {
                if (field.toLowerCase().indexOf("fuori vol") < 0) {
                    result.push(item);
                }
            }
            else {
                result.push(item);
            }
        }

        return result;
        */
        return lista;

    }

    ordinamentoRecursiveRead(action, _temp)
    {

        
        if (action.sottochiavi != null && action.sottochiavi.length > 0) {
            let new_temp = [];
            if (action.valore.indexOf("!=")>=0) {
                let param = action.valore.split("!=")[1];
                //console.log("1. Cerco " + action.chiave + " su");
                //console.log(action.chiave + "=" + param);
                new_temp = _temp.filter(t => t.recordInTracciato[action.chiave] != null && t.recordInTracciato[action.chiave].toString() != param);
            }
            else {

                //console.log("2. Cerco " + action.chiave + " su");
                //console.log(action.chiave + "=" + action.valore);

                if (action.valore.indexOf("CONTAINS$") == 0) {
                    new_temp = _temp.filter(t => t.recordInTracciato[action.chiave] != null && t.recordInTracciato[action.chiave].toString().indexOf(action.valore.replace("CONTAINS$", ""))>=0);
                }
                else {
                    new_temp = _temp.filter(t => t.recordInTracciato[action.chiave] != null && t.recordInTracciato[action.chiave].toString() == action.valore);
                }
            }

            for (let a = 0; a < action.sottochiavi.length; a++)
            {
                this.ordinamentoRecursiveRead(action.sottochiavi[a], new_temp);
            }
        }
        else {
            let  _l = [];

            if (action.valore.indexOf("CONTAINS$") == 0) {
                _l = _temp.filter(t => t.recordInTracciato[action.chiave].toString().indexOf(action.valore.replace("CONTAINS$", ""))>=0);
            }
            else {
                _l = _temp.filter(t => t.recordInTracciato[action.chiave].toString() == action.valore);
            }



            //result = result.concat(_l);            
            this.blocco_lista_ordinata = this.blocco_lista_ordinata.concat(_l);            
            //console.log("sotto ordinamento su");
            //console.log(this.lista_ordinata);

            //Li tolgo dalla temporanea
            for (let eltodel in _l) {
                this.lista_temporanea.splice(this.lista_temporanea.findIndex(el => el.recordInTracciato[keyRefCodice]== _l[eltodel].recordInTracciato[keyRefCodice]), 1);
            }

 
        }
    }

    ordinaRecordsTracciatoInMenabo(lista, cb) {

        this.lista_temporanea = lista;
        this.lista_ordinata = [];
        let ME = this;
        $.getJSON('external_source/SourceOrdinamentoLista.json?v=1', function (data) {
            for (let i = 0; i < data.source.length; i++) {

                let rule = data.source[i];

                ME.blocco_lista_ordinata = [];
                ME.ordinamentoRecursiveRead(rule, lista);

                console.log("prog myList");
                console.log(ME.blocco_lista_ordinata.length);

                


                
                //Metto i rimasti secondo la macro regola
                if (rule.valore.indexOf("!=")>=0)
                {
                    let val = rule.valore.split("!=")[1];
                    let _rest = ME.lista_temporanea.filter(t => t.recordInTracciato[rule.chiave] != null && t.recordInTracciato[rule.chiave].toString() != val);
                    ME.blocco_lista_ordinata = ME.blocco_lista_ordinata.concat(_rest);
                    for (let d in _rest) {
                        ME.lista_temporanea.splice(ME.lista_temporanea.findIndex(el => el.recordInTracciato[keyRefCodice] == _rest[d].recordInTracciato[keyRefCodice]), 1);
                    }                        
                }
                else
                {
                    let _rest = ME.lista_temporanea.filter(t => t[rule.chiave] != null && t.recordInTracciato[rule.chiave].toString() == rule.valore);
                    ME.blocco_lista_ordinata = ME.blocco_lista_ordinata.concat(_rest);
                    for (let d in _rest)
                        ME.lista_temporanea.splice(ME.lista_temporanea.findIndex(el => el.recordInTracciato[keyRefCodice] == _rest[d].recordInTracciato[keyRefCodice]), 1);
                }

                //console.log("blocco disordinato");

                console.log(ME.blocco_lista_ordinata);

                //ordered_db.AddRange(_myList.OrderBy(o => o["speciale"]));
                let _list_ordinata_per_speciale = ME.blocco_lista_ordinata.sort(function (a, b) {
                    var textA = a.recordInTracciato["speciale"].toLowerCase();
                    var textB = b.recordInTracciato["speciale"].toLowerCase();
                    //console.log("sor check " + [textA,textB]);
                    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
                });

                //console.log("blocco ordinato");
                //console.log(_list_ordinata_per_speciale);

                ME.lista_ordinata = ME.lista_ordinata.concat(_list_ordinata_per_speciale);



                console.log(">>>" + ME.lista_ordinata.length);
                    
            }

            delete ME.blocco_lista_ordinata;

            if (ME.lista_temporanea.length > 0) {
                console.log("Sono rimasti fuori in " + ME.lista_temporanea.length);
                ME.lista_ordinata = ME.lista_ordinata.concat(ME.lista_temporanea);
            }

            console.log(ME.lista_ordinata);

            //List<string> _ids = ordered_db.Select(s => s["id"].ToString()).ToList();
            //List<Dictionary<string, object>> diff = _db.Where(s => !_ids.Contains(s["id"].ToString())).ToList();
           

            cb(ME.lista_ordinata);
        });
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
        this.AggiungiInfoPezzo(groupElements, codice, area);
        this.ApplicaSegnaposto(groupElements, codice);
    }

    AggiungiInfoPezzo(groupElements, codice, area) {
        let currentElement = groupElements.find(f => f.recordInTracciato[keyRefCodice] == codice);

        if (codice.indexOf(',') != -1) {
            let firstElement = groupElements.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == codice);
            let groupElementHtml = $("#container_tracciato").find(".record_menabo_gruppo[codice_gruppo='" + firstElement.recordInTracciato[keyScattoCodiceGruppo] + "']");
            $(groupElementHtml).find("#intestazioneRowTracciato").text(firstElement.recordInTracciato.speciale);
            $(groupElementHtml).find("#intestazioneRowTracciato").css("font-size", "10px");
            $(groupElementHtml).find("#intestazioneRowTracciato").addClass("fw-bold");
            return;
        }
        else {
            
            if (currentElement.recordInTracciato[keyRefCodice] == currentElement.recordInTracciato[keyScattoCodiceGruppo]) {
                let elementHtml = $("#container_tracciato").find(".record_menabo[id_rec='" + currentElement.idRec + "']");
                $(elementHtml).find("#intestazioneRowSingoloTracciato").text(currentElement.recordInTracciato.speciale);
                $(elementHtml).find("#intestazioneRowSingoloTracciato").css("display","block");
                $(elementHtml).find("#intestazioneRowSingoloTracciato").css("font-size", "10px");
                $(elementHtml).find("#intestazioneRowSingoloTracciato").addClass("fw-bold");
            }
            
        }
        let elementHtml = $("#container_tracciato").find(".record_menabo[id_rec='" + currentElement.idRec + "']");
        

        let numTroncatoPromo;
        let numTroncatoKG;
        let prezzoMinPromo = 0;
        let prezzoMaxPromo = -1;
        let prezzoMinKG = 0;
        let prezzoMaxKG = -1;
        let meccanica = "";
        let text = "Errore di lettura";
        if (currentElement.recordRevisionato != null && currentElement.recordRevisionato.um != null) {
            if (currentElement.recordRevisionato.um == "KG") {
                text = "Al Kg: ";
            }
            else if (currentElement.recordRevisionato.um == "LT") {
                text = "Al lt: ";
            }
            else {
                text = "Cad: ";
            }
        }
        else {
            if (currentElement.recordInTracciato[keyDescrUm] == "KG") {
                text = "Al Kg: ";
            }
            else if (currentElement.recordInTracciato[keyDescrUm] == "LT") {
                text = "Al lt: ";
            }
            else {
                text = "Cad: ";
            }
        }
        if (area != "ORO") {
            numTroncatoPromo = parseFloat(currentElement.recordInTracciato.prezzo_promo).toFixed(2);
            numTroncatoKG = parseFloat(currentElement.recordInTracciato.prezzo_kgl).toFixed(2);
            meccanica = currentElement.recordInTracciato.meccanica_market;

            groupElements.forEach(function (item) {
                if (prezzoMinPromo == 0) {
                    prezzoMinPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMinPromo) > parseFloat(parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2))) {
                        prezzoMinPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                    }
                }

                if (prezzoMaxPromo == -1) {
                    prezzoMaxPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMaxPromo) < parseFloat(parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2))) {
                        prezzoMaxPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                    }
                }

                if (prezzoMinKG == 0) {
                    prezzoMinKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMinKG) > parseFloat(parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2))) {
                        prezzoMinKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                    }
                }

                if (prezzoMaxKG == -1) {
                    prezzoMaxKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMaxKG) < parseFloat(parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2))) {
                        prezzoMaxKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                    }
                }
            });
        }
        else {
            numTroncatoPromo = parseFloat(currentElement.recordInTracciato.prezzo_promo_oro).toFixed(2);
            numTroncatoKG = parseFloat(currentElement.recordInTracciato.prezzo_kgl_oro).toFixed(2);
            meccanica = currentElement.recordInTracciato.meccanica_oro;

            groupElements.forEach(function (item) {
                if (prezzoMinPromo == 0) {
                    prezzoMinPromo = parseFloat(item.recordInTracciato.prezzo_promo_oro).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMinPromo) > parseFloat(parseFloat(item.recordInTracciato.prezzo_promo_oro).toFixed(2))) {
                        prezzoMinPromo = parseFloat(item.recordInTracciato.prezzo_promo_oro).toFixed(2);
                    }
                }

                if (prezzoMaxPromo == -1) {
                    prezzoMaxPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMaxPromo) < parseFloat(parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2))) {
                        prezzoMaxPromo = parseFloat(item.recordInTracciato.prezzo_promo).toFixed(2);
                    }
                }

                if (prezzoMinKG == 0) {
                    prezzoMinKG = parseFloat(item.recordInTracciato.prezzo_kgl_oro).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMinKG) > parseFloat(parseFloat(item.recordInTracciato.prezzo_kgl_oro).toFixed(2))) {
                        prezzoMinKG = parseFloat(item.recordInTracciato.prezzo_kgl_oro).toFixed(2);
                    }
                }

                if (prezzoMaxKG == -1) {
                    prezzoMaxKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                }
                else {
                    if (parseFloat(prezzoMaxKG) < parseFloat(parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2))) {
                        prezzoMaxKG = parseFloat(item.recordInTracciato.prezzo_kgl).toFixed(2);
                    }
                }
            });
        }

        if (meccanica == null)
            meccanica = "";

        //if (meccanica.indexOf("PREZZO NETTO")>=0) {
            elementHtml.find("#agenziaRow1").find(".col").text("Promo: " + numTroncatoPromo + "€");
            if (prezzoMaxPromo == numTroncatoPromo) {
                elementHtml.find("#agenziaRow1").find(".col").addClass("bg-danger");
                elementHtml.find("#agenziaRow1").find(".col").addClass("bg-opacity-50");
            }
            if (prezzoMinPromo == numTroncatoPromo) {
                elementHtml.find("#agenziaRow1").find(".col").removeClass("bg-danger");
                elementHtml.find("#agenziaRow1").find(".col").addClass("bg-primary");
                elementHtml.find("#agenziaRow1").find(".col").addClass("bg-opacity-50");
            }            
        elementHtml.find("#agenziaRow2").find(".col").text(text + numTroncatoKG + "€");
            if (prezzoMaxKG == numTroncatoKG) {
                elementHtml.find("#agenziaRow2").find(".col").addClass("bg-danger");
                elementHtml.find("#agenziaRow2").find(".col").addClass("bg-opacity-50");
            }
            if (prezzoMinKG == numTroncatoKG) {
                elementHtml.find("#agenziaRow2").find(".col").removeClass("bg-danger");
                elementHtml.find("#agenziaRow2").find(".col").addClass("bg-primary");
                elementHtml.find("#agenziaRow2").find(".col").addClass("bg-opacity-50");
            }            
        //}
        /*else */ if (meccanica.indexOf("SCONTO") >= 0) {
            elementHtml.find("#agenziaRow0").find(".col").text(meccanica);
            elementHtml.find("#agenziaRow0").find(".col").css("font-size", "12px");
            elementHtml.find("#agenziaRow0").find(".col").addClass("bg-danger");
            elementHtml.find("#agenziaRow0").css("display", "block");
            //elementHtml.find("#agenziaRow2").find(".col").text(numTroncatoPromo);
            //if (prezzoMaxPromo == numTroncatoPromo) {
            //    elementHtml.find("#agenziaRow2").find(".col").addClass("bg-danger");
            //    elementHtml.find("#agenziaRow2").find(".col").addClass("bg-opacity-50");
            //}
            //if (prezzoMinPromo == numTroncatoPromo) {
            //    elementHtml.find("#agenziaRow2").find(".col").removeClass("bg-danger");
            //    elementHtml.find("#agenziaRow2").find(".col").addClass("bg-primary");
            //    elementHtml.find("#agenziaRow2").find(".col").addClass("bg-opacity-50");
            //}            
        }
        else if (!(meccanica.indexOf("SCONTO") >= 0) && !(meccanica.indexOf("PREZZO NETTO") >= 0)){
            elementHtml.find("#agenziaRow0").find(".col").text("Controlla campi");
        }

        
    }

    ApplicaSegnaposto(groupElements, codice) {
        if (groupElements.length > 1 && codice.indexOf(",") == -1) {
            return;
        }

        let segnaposto = $("#segnaposto_template").clone();
        segnaposto = $(segnaposto.html());

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

        if (segnapostoChiave.length > 0) {
            let chiaveValore = [];
            let label = "";
            segnapostoChiave.forEach(function (item) {
                chiaveValore.push(groupElements[0].recordInTracciato[item])
                label += groupElements[0].recordInTracciato[item] + " - ";
            });
            label = label.substring(0, label.length - 3);
            segnaposto.find("#labelSegna").text(label.toLowerCase());

            let pageElement;
            if (groupElements.length > 1) {
                pageElement = $(".record_menabo_gruppo[codice_gruppo='" + codice + "']");
            } else {
                pageElement = $(".record_menabo[codice_gruppo='" + codice + "']");
            }


            let Segna;
            Segna = this.findElementFromBottomUp((groupElements.length > 1 ? pageElement.parent().parent() : pageElement), "#segnaposto");
            console.log(Segna);
            if (Segna != null && Segna.find("#labelSegna").text() == label.toLowerCase()) {
                let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
                lastSegnaValue++;
                Segna.find("#valueSegna").text(lastSegnaValue);
                console.log(lastSegnaValue);
            } else {
                if (groupElements.length > 1) {
                    let newSegna = segnaposto.insertBefore(pageElement.parent().parent());
                    Segna = this.findElementFromUpBottom(pageElement.parent().parent(), "#segnaposto");
                    if (Segna != null && Segna.find("#labelSegna").text() == label.toLowerCase()) {
                        let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
                        lastSegnaValue++;
                        newSegna.find("#valueSegna").text(lastSegnaValue);
                        Segna.remove();
                        console.log(lastSegnaValue);
                    }


                } else {
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
}