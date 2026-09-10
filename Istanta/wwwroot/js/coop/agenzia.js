
/* trea */
//Marco 02/01/24 1.0.0.1
//Alessio 12/01/2024


class Agenzia extends IAgenzia{
    repartoPath = "";
    tipo_tracciato_selezionato = 0;
    Form_importazioneTracciato = "";



    returnConfrontiSettings()
    {
        //let confrontiSettings = {
        //    locandine: true,
        //    multiSecondarie: true
        //};

        //return confrontiSettings;
    }

    formatiMenaboPagina = ["5x5", "4x5", "3x5", "3x6", "4x6"];

    lista_temporanea;
    lista_ordinata=[];
    blocco_lista_ordinata = [];
    parametri_visualizzati_codice_menabo = [keyRefCodice];
    parametri_visualizzati_tracciato_menabo = [keyDescr1];
    parametri_visualizzati_revisionato_menabo = ["descrizione1", "descrizione2", "descrizione3", "descrizione4"];

    Form_ricercaTracciato =
        '<option value="note">Note</option>' +
        '<option value="categoria">Categoria</option>' +
        '<option value="copertina">Copertina</option>';

    schedeCustomConfronti =
        '<ul class="nav nav-tabs mb-3" id="schede">' +
        '<li class = "nav-item"> ' +
        '<a class = "nav-link active testataSchedaConfronti" data-toggle="tab" onclick="confInstance.agenzia.setScheda(1,$(this))" href="#ConfrontoTracciatiScheda">Confronto tracciati</a>' +
        '</li > ' +
        '<li class="nav-item">' +
        '<a class="nav-link testataSchedaConfronti" data-toggle="tab" onclick="confInstance.agenzia.setScheda(2,$(this))" href="#ConfrontoLocandineScheda">Confronto locandine</a>' +
        '</li>' +
        '</ul>' +
        '<div class="tab-content">' +
        '<div id="ConfrontoTracciatiScheda" class="container tab-pane schedaConfronti active">' +
        '</div>' +
        '<div id="ConfrontoLocandineScheda" class="container tab-pane schedaConfronti">' +
        '<div class="row mb-3">' +
        '<div class="col-5">' +
        '<h2>Promo</h2>' +
        '<select id="TendinaPromo" class="form-select" aria-label="Menu a tendina" onchange="confInstance.agenzia.impostaCheckbox($(this).val())">' +
        '<option value="0" selected>Seleziona promo</option>' +
        '</select>' +
        '<div id="ColonnaInputDirectory" class="col-5 mt-3" style="display:block">' +
        '<h4>Cartella di destinazione:</h4>' +
        '<input type="text" class="form-control" id="InputDirectoryLoc" placeholder="C:\Users\TuoNome\OneDrive\Desktop">' +
        '</div>' +
        '</div>' +
        '<div id="ColonnaTestoConfrontoLoc" class="col-2 d-flex flex-column align-items-center" style="margin-top:43.5px">' +
        '<button disabled id="confrontaButtonLocandine" type="button" style="font-size: 14px; width:120px; height:36px;" class="btn btn-primary" onclick="confInstance.agenzia.confrontaLocandine()">Confronta</button>' +
        '</div>' +
        '<div id="ColonnaTendineTracciati" class="col-5">' +
        '<h2>Seleziona i tracciati</h2>' +
        '<div id="TracciatiVolantini">' +
        '</div>' +
        '</div>' +

        '<div class="row mt-4 progressBarLocandina" id="row_progress_export_loc" style="display:block;">' +
        '<div class="container">' +
        '<div class="row">' +
        '<div class="col mb-2">' +
        '<div class="progress">' +
        '<div class="progress-bar progress-bar-striped progress-bar-animated progressBar" id="progressbar" role="progressbar" style="width:0%;"></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="row">' +
        '<div class="col text-center text-secondary">' +
        '<p class="progressMsg" id="progressMsg"></p>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '</div>'

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
    parametriComposizioneCustom = {
        segnaposto: "copertina,categoria",
        nomeVisualizzato: "copertina:,Cat:",
        requiredVal: "x,",
        comparator: "==,",
        hideVal: "true,false",
        sottochiavi: []
    }

    LabelNota = [
        {
            Note: ["ARTWORK FIDELITY", "AWF", "ARTWORK FID", "ART FID", "AW FID"],
            Label: "AW FID"
        },
        {
            Note: ["FIDELITY", "FID", "FD"],
            Label: "FID"
        },
        {
            Note: ["ARTWORK", "AW", "ART"],
            Label: "AW"
        },
        {
            Note: ["BOMBA", "BOMB", "BOMBAOF"],
            Label: "BOMBA"
        },
        {
            Note: ["BOMBA FIDELITY", "BOMBA FID", "BF", "BOM FID", "BOMB FID"],
            Label: "BOMBA FID"
        },
    ]


    compilaBoxAgenzia(item) {
        //viene chiamata per ogni box del menabò in pagina al momento in cui viene cambiata la pagina
        let template = $("#templateBox").clone();

        let htmlBox = $(template.html());

        let codice = "";
        let descr = "";

        let _container = htmlBox.find(".refInMenabo");

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

        return [_container, htmlBox];

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
        descr2.parent().find(".form-label").text("Tipo");
        descr3.parent().find(".form-label").text("Brand");
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

    ordinaRecordsTracciatoInMenabo(lista, cb) {

        cb(lista);
	return;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceOrdinamentoLista.json?v=1.0.0.' + rndVersion, function (data) {

            let categorie = data.categorie;
            let aree = data.aree;
            let settori = data.settori;
            let gruppi = data.gruppi;
            let segmenti = data.segmenti;

            console.log(gruppi);

            for (let inx = 0; inx < lista.length; inx++) {

                let rit = lista[inx].recordInTracciato;
                if (rit["area"] != null) {

                    lista[inx].ordered = true;

                    let inxArea = rit["area"] - 1;
                    let inxSettore = rit["settore"] - 1;
                    let inxGruppo = rit["gruppo"] - 1;
                    let inxSegmento = rit["segmento"] - 1;



                    let areaOrder = rit["area"];//
                    let settoreOrder = rit["settore"];
                    let gruppoOrder = rit["gruppo"];
                    let segmentoOrder = rit["segmento"];

                    if (rit[keyRefCodice]=="5072707")
                    {
                        console.warn("DEBUG 5072707");
                        console.log([inxArea, inxSettore, inxGruppo, inxSegmento]);
                        console.log(rit);
                    }

                    if (inxArea>=0 && aree.length > inxArea)
                    {
                        areaOrder = aree[inxArea];

                        if (inxSettore>=0 && settori[inxArea].length > inxSettore)
                        {
                            settoreOrder = settori[inxArea][inxSettore];

                            if (inxGruppo>=0 && gruppi[inxArea][inxSettore].length > inxGruppo)
                            {
                                gruppoOrder = gruppi[inxArea][inxSettore][inxGruppo];

                                if (inxSegmento>=0 && segmenti[inxArea][inxSettore][inxGruppo].length > inxSegmento)
                                {
                                    segmentoOrder = segmenti[inxArea][inxSettore][inxGruppo][inxSegmento];
                                }
                            }

                        }

                    }


                    if (rit.copertina=="x")
                       "debug".toString();

                    let macro = 99;
                    categorie=categorie.sort(function (a, b) {
                        var inxA = a.indice;
                        var inxB = b.indice;

                        if (inxA < inxB)
                            return -1;
                        else if (inxA > inxB)
                            return 1;
                        else
                            return 0;

                    });

                    //console.log("SEGUI ORDINE CAT");
                    //console.log(categorie);

                    for (let c = 0; c < categorie.length; c++) {
                        let item = categorie[c];
                        let val = rit[item.chiave].toLowerCase();
                        console.log(item.chiave + " -> " + val);
                        if (val.indexOf(item.valore.toLowerCase()) >= 0) {
                            macro = parseInt(item.indice);
                            break;
                        }
                    }

                    let macroStr = macro.toString().padStart(2, '0');

                    let areaStr = areaOrder.toString().padStart(2, '0');
                    let settoreStr = settoreOrder.toString().padStart(2, '0');
                    let gruppoStr = gruppoOrder.toString().padStart(2, '0');
                    let segmentoStr = segmentoOrder.toString().padStart(2, '0');

                    rit["strOrdinamento"] = macroStr + "_" + areaStr + "_" + settoreStr + "_" + gruppoStr + "_" + segmentoStr;


                }
                else {
                    rit["strOrdinamento"] = "99_99_99_99_99";
                }
            }

            let lista_ordinata = lista.sort(function (a, b) {
                var inxA = "";
                var inxB = "";
                if (a.recordInTracciato["strOrdinamento"] != null)
                    inxA = a.recordInTracciato["strOrdinamento"];
                if (b.recordInTracciato["strOrdinamento"] != null)
                    inxB = b.recordInTracciato["strOrdinamento"];

                if (inxA < inxB)
                    return -1;
                else if (inxA > inxB)
                    return 1;
                else
                    return 0;
            });

            cb(lista_ordinata);

        });



        //let settoriNewOrderAREA1 = [0, 4, 6, 17, 19, 12, 14, 23, 11, 15, 16, 18, 21, 5, 1, 7, 8, 9, 2, 3, 20, 10, 22, 13];
        //let gruppiSettore2NewOrderAREA1 = [0, 6, 2, 3, 4, 5, 1];
        //let gruppiSettore5NewOrderAREA1 = [0, 2, 5, 3, 4, 1];
        ////let settoriNewOrder = [0, 1, 2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

        //for (let inx = 0; inx < lista.length; inx++) {

        //    let rit=lista[inx].recordInTracciato;
        //    if (rit["area"] != null) {

        //        lista[inx].ordered = true;

        //        let area = rit["area"];

        //        let settore = rit["settore"];
        //        let settoreOrder = settore;
        //        console.log(settore);
        //        if (settoriNewOrderAREA1.length > settore && area==1) {
        //            settoreOrder = settoriNewOrderAREA1[rit["settore"]];
        //        }

        //        let gruppo = rit["gruppo"];
        //        let gruppoOrder = gruppo;
        //        if (gruppiSettore2NewOrderAREA1.length > gruppo && area == 1 && settore == 2) {
        //            gruppoOrder = gruppiSettore2NewOrderAREA1[gruppo];
        //        }
        //        else if (gruppiSettore5NewOrderAREA1.length > gruppo && area == 1 && settore == 5) {
        //            gruppoOrder = gruppiSettore5NewOrderAREA1[gruppo];
        //        }

        //        let segmento = rit["segmento"];

        //        let macro = 99;
        //        if (rit["copertina"].toLowerCase() == "x") {
        //            macro = 1;
        //        }
        //        else {
        //            let cat = rit["categoria"].toLowerCase();
        //            if (cat.indexOf("gastronomia") >= 0) {
        //                macro = 2;
        //            }
        //            else if (cat.indexOf("ortofrutta") >= 0) {
        //                macro = 3;
        //            }
        //            else if (cat.indexOf("macelleria") >= 0) {
        //                macro = 4;
        //            }
        //            else if (cat.indexOf("pescheria") >= 0) {
        //                macro = 5;
        //            }
        //            else if (cat.indexOf("freschi") >= 0) {
        //                macro = 6;
        //            }
        //            else if (cat.indexOf("surgelati") >= 0) {
        //                macro = 7;
        //            }
        //            else if (cat.indexOf("dispensa") >= 0) {
        //                macro = 8;
        //            }
        //            else if (cat.indexOf("igiene") >= 0) {
        //                macro = 9;
        //            }
        //            else if (cat.indexOf("petfood") >= 0) {
        //                macro = 10;
        //            }
        //        }

        //        let macroStr = macro.toString().padStart(2, '0');
        //        let areaStr = area.toString().padStart(2, '0');
        //        //let settoreStr = settore.toString().padStart(2, '0');
        //        let settoreStr = settoreOrder.toString().padStart(2, '0');
        //        //let gruppoStr = gruppo.toString().padStart(2, '0');
        //        let gruppoStr = gruppoOrder.toString().padStart(2, '0');
        //        let segmentoStr = segmento.toString().padStart(2, '0');

        //        rit["strOrdinamento"] = macroStr + "_" + areaStr + "_" + settoreStr + "_" + gruppoStr + "_" + segmentoStr;

                
        //    }
        //    else {
        //        rit["strOrdinamento"] = "99_99_99_99_99";
        //    }


        //}

        //let lista_ordinata = lista.sort(function (a, b) {
        //    var inxA = "";
        //    var inxB = "";
        //    if (a.recordInTracciato["strOrdinamento"] != null)
        //        inxA = a.recordInTracciato["strOrdinamento"];
        //    if (b.recordInTracciato["strOrdinamento"] != null)
        //        inxB = b.recordInTracciato["strOrdinamento"];

        //    if (inxA < inxB)
        //        return -1;
        //    else if (inxA > inxB)
        //        return 1;
        //    else
        //        return 0;
        //});

        //cb(lista_ordinata);
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
        //this.ApplicaSegnaposto(groupElements, codice);
        this.aggiungiDettagliARecordInTracciato(groupElements, codice);
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

    AggiungiInfoPezzo(groupElements, codice, area) {
        //aggiunge le informazioni al record in lista tracciato di sinistra
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
            var _um = currentElement.recordRevisionato.um.toLowerCase();
            if ( _um == "kg" || _um=="gr") {
                text = "Al Kg: ";
            }
            else if (_um == "lt" || _um == "ml") {
                text = "Al lt: ";
            }
            else {
                text = "Cad: ";
            }
        }
        else {
            var _um = currentElement.recordInTracciato[keyDescrUm].toLowerCase();
            if (_um == "kg" || _um == "gr") {
                text = "Al Kg: ";
            }
            else if (_um == "lt" || _um == "ml") {
                text = "Al lt: ";
            }
            else {
                text = "Cad: ";
            }
        }
       
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

    getParametriSegnaposto() {
        return this.parametriComposizioneCustom;
    }

    //ApplicaSegnaposto(groupElements, codice) {
    //    if (groupElements.length > 1 && codice.indexOf(",") == -1) {
    //        return;
    //    }

    //    let segnaposto = $("#segnaposto_template").clone();
    //    segnaposto = $(segnaposto.html());

    //    let segnapostoChiave = [];
    //    for (const param of this.parametriComposizioneCustom) {
    //        if (param.segnaposto) {
    //            let chiavi = param.segnaposto.split(" ");
    //            chiavi.forEach(function (item) {
    //                segnapostoChiave.push(item);
    //            });                
    //            break;
    //        }
    //    }

    //    if (segnapostoChiave.length > 0) {
    //        let chiaveValore = [];
    //        let label = "";
    //        segnapostoChiave.forEach(function (item) {
    //            //console.log(groupElements[0].recordInTracciato["copertina"]);
    //            if (groupElements[0].recordInTracciato["copertina"]!=null && groupElements[0].recordInTracciato["copertina"].toString().toLowerCase() == "x") {
    //                chiaveValore.push("Copertina");
    //                label += "Copertina - ";
    //            }
    //            else {
    //                chiaveValore.push(groupElements[0].recordInTracciato[item])
    //                label += groupElements[0].recordInTracciato[item] + " - ";
    //            }
                
    //        });
    //        label = label.substring(0, label.length - 3);
    //        segnaposto.find("#labelSegna").text(label.toLowerCase());

    //        let pageElement;
    //        if (groupElements.length > 1) {
    //            pageElement = $(".record_menabo_gruppo[codice_gruppo='" + codice + "']");
    //        } else {
    //            pageElement = $(".record_menabo[codice_gruppo='" + codice + "']");
    //        }


    //        let Segna;
    //        Segna = this.findElementFromBottomUp((groupElements.length > 1 ? pageElement.parent().parent() : pageElement), "#segnaposto");
    //        console.log(Segna);
    //        if (Segna != null && Segna.find("#labelSegna").text() == label.toLowerCase()) {
    //            let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
    //            lastSegnaValue++;
    //            Segna.find("#valueSegna").text(lastSegnaValue);
    //            console.log(lastSegnaValue);
    //        } else {
    //            if (groupElements.length > 1) {
    //                let newSegna = segnaposto.insertBefore(pageElement.parent().parent());
    //                Segna = this.findElementFromUpBottom(pageElement.parent().parent(), "#segnaposto");
    //                if (Segna != null && Segna.find("#labelSegna").text() == label.toLowerCase()) {
    //                    let lastSegnaValue = parseInt(Segna.find("#valueSegna").text());
    //                    lastSegnaValue++;
    //                    newSegna.find("#valueSegna").text(lastSegnaValue);
    //                    Segna.remove();
    //                    console.log(lastSegnaValue);
    //                }


    //            } else {
    //                segnaposto.insertBefore(pageElement);
    //            }
    //        }
    //    }
    //}

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

    //AggiornaSegnapostiPostRicerca() {
    //    let me = this;
    //    $("#container_tracciato .segnaposto").each(function () {
    //        let countSibling = me.contaSiblingSottoSegnaposto(this);
    //        $(this).find("#labelValue").text(countSibling);
    //        if (countSibling == 0) {
    //            $(this).css("display", "none");
    //        }
    //        else {
    //            $(this).css("display", "block");
    //        }
    //    });
    //}

    //contaSiblingSottoSegnaposto(segnaposto) {
    //    let count = 0;
    //    let currentElement = $(segnaposto).next();

    //    while (currentElement.length > 0 && !currentElement.hasClass('segnaposto')) {
    //        if (currentElement.is(':visible')) {
    //            count++;
    //        }
    //        currentElement = currentElement.next();
    //    }

    //    return count;
    //}

    getForm_ricercaTracciato() {
        return this.Form_ricercaTracciato;
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

    getMeccanicaCustom(idMastro, note) {

        let meccanicaRequired = "";
        let mastroFounded = menaboInstance.mastroSource.find(f => f.id == idMastro);
        if (mastroFounded == null) {
            console.error("Mastro non trovata");
            return meccanicaRequired;
        }
        if (mastroFounded.associazioni != null && mastroFounded.associazioni.length > 0 && note != "") {
            mastroFounded.associazioni.forEach(function (associazione) {
                let corrispondenza = true;
                if (meccanicaRequired == "") {
                    associazione.note.forEach(function (notaConfronto) {
                        if (!note.includes(notaConfronto)) {
                            corrispondenza = false;
                        }
                    });
                    if (corrispondenza) {
                        meccanicaRequired = menaboInstance.meccanicheSource.find(f => f.nomeTraduzione == associazione.nomeMeccanica).nomeTraduzione;
                    }
                }
            });
            if (meccanicaRequired != "") {
                return meccanicaRequired;
            }
        }

        if (mastroFounded.meccanicaDefault == null || mastroFounded.meccanicaDefault == "") {
            return meccanicaRequired;
        }
        else {
            try {
                let res = menaboInstance.meccanicheSource.find(f => f.nomeTraduzione == mastroFounded.meccanicaDefault).nomeTraduzione;
                if (res != null) {
                    meccanicaRequired = res;
                }
            }
            catch {

            }
            return meccanicaRequired;
        }
    }

    aggiungiDettagliARecordInTracciato(groupElements, codice) {
        let me = this;
        let element;
        if (codice.includes(",")) {
            return;
        }

        let obj = groupElements.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == codice);
        element = $(".record_menabo[id_rec='" + obj.idRec + "']")

        
        //let idRec = obj.idRec; // parseInt(element.attr("id_rec"));
        //let element = menaboInstance.tracciatoSource.find(f => f.idRec == idRec);
        let label = "";
        me.LabelNota.forEach(function (item) {
            if (label == "" && item.Note.includes(obj.recordInTracciato.note)) {
                label = item.Label;
            }
        });
        if (label != "") {
            let elementToAdd = '<div class="row" id="labelEAvvisi">' +
                '<div class="col d-flex justify-content-end mb-2">' +
                '<span class="bg-danger badge badge-danger">' + label + '</span>' +
                '</div>' +
                '</div>';
            element.find(".labelEAvvisi").append(elementToAdd);
            element.find(".warningImg").parent().removeClass("mb-5");
            element.find(".warningImg").parent().addClass("mb-3");
        }
        
            
    }

    bindSchemaOrdinamento(cb) {
        /* ORINAMENTO SETTINGS */
        let me = this;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('../external_source/SourceOrdinamentoLista.json?v=1.0.0.' + rndVersion, function (data) {

            if (cb != null) {
                cb(data);
            }

            if ($("#schema").length > 0) {
                //Trovo container dove poter scrivere lo schema da poter editare in CUSTOM
                me.schemaOrdinamento = { categorie: data.categorie, aree: data.aree, settori: data.settori, gruppi: data.gruppi, segmenti: data.segmenti };

                me.schemaOrdinamento.categorie = me.schemaOrdinamento.categorie.sort(function (a, b)
                {
                    return (parseInt(a.indice) < parseInt(b.indice)) ? -1 : (parseInt(a.indice) > parseInt(b.indice)) ? 1 : 0;
                });

                $("#schema").append(
                    '<div class="container">' +
                    '<div class="row" id="row_lista_categorie">' +
                    '<div class="col">' +
                    '<h2>Categoria</h2><hr>' +
                    '<div class="container">' +
                    '<div class="row">' +
                    '<div class="col" id="col_lista_categorie">' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '<div class="row" id="row_classificazione">' +
                    '<div class="col-3">' +
                    '<h2>Aree</h2><hr>' +
                    '<div class="container">' +
                    '<div class="row">' +
                    '<div class="col" id="col_lista_aree">' +                    
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '<div class="col-3">' +
                    '<h2>Settori</h2><hr>' +
                    '<div class="container">' +
                    '<div class="row">' +
                    '<div class="col" id="col_lista_settori">' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '<div class="col-3">' +
                    '<h2>Gruppi</h2><hr>' +
                    '<div class="container">' +
                    '<div class="row">' +
                    '<div class="col" id="col_lista_gruppi">' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '<div class="col-3">' +
                    '<h2>Segmenti</h2><hr>' +
                    '<div class="container">' +
                    '<div class="row">' +
                    '<div class="col" id="col_lista_segmenti">' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >' +
                    '</div >'
                );


                //$("#schema").find("#col_lista_categorie").append('<div class="container" style="border: 2px solid #cfdfde;"><div class="row mt-2" style="background-color:#cfdfde"><h2>Segmenti</h2></div><div class="row"><div class="col" id="lista_segmenti"></div></div></div>');
                //$("#schema").find("#col_lista_gruppi").append('<div class="container" style="border: 2px solid #cfdfde;"><div class="row mt-2 mb-2" style="background-color:#cfdfde"><h2>Sezioni</h2></div><div class="row"><div class="col" id="lista_sezioni"></div></div><div id="sezNew" class="row mt-2 mb-2" style="background-color:#cfdfde"></div></div>');

                $("#schema").find("#col_lista_categorie").append('<ul id="lista_categorie"></ul>');
                let div_categorie = $("#schema").find("#lista_categorie");

                $("#schema").find("#col_lista_categorie").parent().parent().css("margin-bottom", "10px");

                for (let i = 0; i < me.schemaOrdinamento.categorie.length; i++) {
                    let item = me.schemaOrdinamento.categorie[i];
                    div_categorie.append(
                        '<div class="list-group-item list-group-item-action flex-column align-items-start">' +
                        '<div class="container"><div class="row">' +
                        '<div class="col-1"><h5>'+(i+1)+'.</h5></div>' +
                        '<div class="col-3"><input type="text" value="' + item.chiave + '" indice="' + i +'" onkeyup="agenzia.cambioCategoria($(this), \'key\')"/></div>' +
                        '<div class="col-4"><input type="text" value="' + item.valore + '" indice="' + i +'" onkeyup="agenzia.cambioCategoria($(this), \'val\')"/></div>' +
                        '<div class="col-4"><input type="text" value="' + item.indice + '" indice="' + i +'" onkeyup="agenzia.cambioCategoria($(this), \'inx\')"/></div>' +
                        '</div></div>' +
                        '</div>'
                    );
                }

                let addSpaziControl = '<div class="input-group">' +
                    '<input type="text" class="form-control" value="0" />' +
                    '<div class="input-group-append">' +
                    '<button class="btn btn-outline-secondary" type="button" onclick="agenzia.assegnaPostiOrdinamento($(this))">Assegna</button>' +
                    '</div>' +
                    '</div>';

                $("#col_lista_aree").append(addSpaziControl +
                    '<div class="container" id="lista_aree"></div>');

                $("#col_lista_settori").append(addSpaziControl +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbSettoriAree" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Area</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbSettoriAree" id="cmb_settori_aree">' +
                    '</div>' +
                    '</div>'+
                    '<div class="container" id="lista_settori"></div>' 
                    );

                $("#col_lista_gruppi").append(addSpaziControl +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbGruppiAree" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Area</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbGruppiAree" id="cmb_gruppi_aree">' +
                    '</div>' +
                    '</div>' +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbGruppiSettori" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Settore</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbGruppiSettori" id="cmb_gruppi_settori">' +
                    '</div>' +
                    '</div>' +
                    '<div class="container" id="lista_gruppi"></div>');

                $("#col_lista_segmenti").append(addSpaziControl +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbSegmentiAree" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Area</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbSegmentiAree" id="cmb_segmenti_aree">' +
                    '</div>' +
                    '</div>' +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbSegmentiSettori" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Settore</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbSegmentiSettori" id="cmb_segmenti_settori">' +
                    '</div>' +
                    '</div>' +
                    '<div class="dropdown mt-2">' +
                    '<button class="btn btn-secondary dropdown-toggle" id="cmbSegmentiGruppi" type="button" data-bs-toggle="dropdown" aria-expanded="false">Seleziona Gruppo</button>' +
                    '<ul class="dropdown-menu" aria-labelledby="cmbSegmentiGruppi" id="cmb_segmenti_gruppi">' +
                    '</div>' +
                    '</div>' +
                    '<div class="container" id="lista_segmenti"></div>');

                $("#schema").append('<div class="container mt-3 p-3" style="background-color:#e1e0d1; text-align:center;"><input type="button" class="btn btn-primary" value="SALVA" onclick="agenzia.salvaSchemaOrdinamento()"></input><input type="button" class="btn btn-primary ms-3" value="RESET" onclick="agenzia.resetOrdinamento()"></input></div>');

                me.bindSchemaOrdinamentoClassificazioni();



            }
        });
    }

    bindSchemaOrdinamentoClassificazioni() {

        let div_aree = $("#lista_aree");
        div_aree.empty();

        $("#cmb_settori_aree").empty();
        $("#cmb_gruppi_aree").empty();
        $("#cmb_segmenti_aree").empty();

        for (let i = 0; i < this.schemaOrdinamento.aree.length; i++) {
            let item = this.schemaOrdinamento.aree[i];
            div_aree.append(
                '<div class="row mt-2">' +
                '<div class="col small">' + (i + 1) + '<input type="text" id="area_'+i+'" onchange="agenzia.cambiaOrdinamentoAreaVal($(this))" style="width:50px; margin-left:10px;" value="' + item + '" /></div>' +
                '</div>');

            let rec = '<li><a class="dropdown-item" onclick="agenzia.cambioAreaOrdinamento($(this),' + (i + 1) + ')">' + (i + 1) + '</a></li>';
            $("#cmb_settori_aree").append(rec);
            $("#cmb_gruppi_aree").append(rec);
            $("#cmb_segmenti_aree").append(rec);
        }


          
    }

    assegnaPostiOrdinamento(sender) {
        let val = sender.parent().parent().find("input[type='text']").val();
        let ctx = sender.parent().parent().parent().attr("id");

        var arrRef;

        if (ctx == "col_lista_aree") {
            console.log("Aree da assegnare " + val);
            arrRef = this.schemaOrdinamento.aree;
        }
        else if (ctx == "col_lista_settori") {
            console.log("Settori da assegnare " + val);
            arrRef = this.schemaOrdinamento.settori[0];
        }
        else if (ctx == "col_lista_gruppi") {
            console.log("Gruppi da assegnare " + val);
            arrRef = this.schemaOrdinamento.gruppi[0][0];
        }
        else if (ctx == "col_lista_segmenti") {
            console.log("Segmenti da assegnare " + val);
            arrRef = this.schemaOrdinamento.segmenti[0][0][0];
        }

        if (arrRef.length > val) {
            alert("Perdita del dato");
        }
        else {


            if (ctx == "col_lista_aree") {
                for (var i = this.schemaOrdinamento.aree.length; i < val; i++) {
                    this.schemaOrdinamento.aree.push(i+1);
                }

                //Si propaga su tutti e 4 i contesti

                //Settori
                let esempio = [];
                if (this.schemaOrdinamento.settori.length > 0) {
                    esempio = this.schemaOrdinamento.settori[0];
                }

                for (var i = this.schemaOrdinamento.settori.length; i < val; i++) {

                    this.schemaOrdinamento.settori.push([]);
                    let sett = this.schemaOrdinamento.settori[i];
                    for (var i2 = 0; i2 < esempio.length; i2++) 
                    {
                        sett.push(i2+1);
                    }
                    
                }


                //Gruppi
                let esempio2 = [];
                if (this.schemaOrdinamento.gruppi.length > 0) {
                    esempio2 = this.schemaOrdinamento.gruppi[0][0];
                }

                for (var i = this.schemaOrdinamento.gruppi.length; i < val; i++) {

                    this.schemaOrdinamento.gruppi.push([[]]);
                    let grp = this.schemaOrdinamento.gruppi[i];
                    for (var i2 = 0; i2 < grp.length; i2++) {
                        for (var i3 = 0; i3 < esempio2.length; i3++) {
                            grp[i2].push(i3+1); 
                        }
                        
                    }
                }


                //Segmenti
                let esempio3 = [];
                if (this.schemaOrdinamento.segmenti.length > 0) {
                    esempio3 = this.schemaOrdinamento.segmenti[0][0][0];
                }

                for (var i = this.schemaOrdinamento.segmenti.length; i < val; i++) {

                    this.schemaOrdinamento.segmenti.push([[[]]]);
                    let seg = this.schemaOrdinamento.segmenti[i];
                    for (var i2 = 0; i2 < seg.length; i2++) {
                        //seg.push([]);
                        for (var i3 = 0; i3 < seg[i2].length; i3++) {
                            //seg[i2].push([]);
                            for (var i4 = 0; i3 < esempio3.length; i3++) {
                                seg[i2][i3].push(i4+1);
                            }
                        }

                    }
                }


            }
            else if (ctx == "col_lista_settori") {

                for (var i = 0; i < this.schemaOrdinamento.settori.length; i++) {

                    for (var i2 = this.schemaOrdinamento.settori[i].length; i2 < val; i2++) {
                        this.schemaOrdinamento.settori[i].push(i2+1);
                    }

                }

                //Si propaga negli altri 2 contesti

                //Gruppi
                let esempio2 = [];
                if (this.schemaOrdinamento.gruppi.length > 0) {
                    esempio2 = this.schemaOrdinamento.gruppi[0][0];
                }

                for (var i = 0; i < this.schemaOrdinamento.gruppi.length; i++) {
                    let grp = this.schemaOrdinamento.gruppi[i];
                    for (var i2 = grp.length; i2 < val; i2++) {
                        grp.push([]);
                        for (var i3 = 0; i3 < esempio2.length; i3++) {
                            grp[i2].push(i3+1);
                        }

                    }
                }

                //Segmenti
                let esempio3 = [];
                if (this.schemaOrdinamento.segmenti.length > 0) {
                    esempio3 = this.schemaOrdinamento.segmenti[0][0][0];
                }

                for (var i = 0; i < this.schemaOrdinamento.segmenti.length; i++) {
                    let seg = this.schemaOrdinamento.segmenti[i];
                    for (var i2 = seg.length; i2 < val; i2++) {
                        seg.push([[]]);
                        for (var i3 = 0; i3 < seg[i2].length; i3++) {
                            //seg[i2].push([]);
                            for (var i4 = 0; i3 < esempio3.length; i3++) {
                                seg[i2][i3].push(i4+1);
                            }
                        }

                    }
                }


            }
            else if (ctx == "col_lista_gruppi") {

                for (var i = 0; i < this.schemaOrdinamento.gruppi.length; i++) {

                    for (var i2 = 0; i2 < this.schemaOrdinamento.gruppi[i].length; i2++) {
                        for (var i3 = this.schemaOrdinamento.gruppi[i][i2].length; i3 < val; i3++) {
                                this.schemaOrdinamento.gruppi[i][i2].push(i3+1);
                        }
                    }

                }

                //Si propaga nei segmenti

                //Segmenti
                let esempio3 = [];
                if (this.schemaOrdinamento.segmenti.length > 0) {
                    esempio3 = this.schemaOrdinamento.segmenti[0][0][0];
                }

                for (var i = 0; i < this.schemaOrdinamento.segmenti.length; i++) {
                    let seg = this.schemaOrdinamento.segmenti[i];
                    for (var i2 = 0; i2 < seg.length; i2++) {
                        for (var i3 = seg[i2].length; i3 < val; i3++) {
                            seg[i2].push([]);
                            for (var i4 = 0; i3 < esempio3.length; i3++) {
                                seg[i2][i3].push(i4+1);
                            }
                        }

                    }
                }

            }
            else {
                for (var i = 0; i < this.schemaOrdinamento.segmenti.length; i++) {
                    for (var i2 = 0; i2 < this.schemaOrdinamento.segmenti[i].length; i2++) {
                        for (var i3 = 0; i3 < this.schemaOrdinamento.segmenti[i][i2].length; i3++) {
                            for (var i4 = this.schemaOrdinamento.segmenti[i][i2][i3].length; i4 < val; i4++) {
                                this.schemaOrdinamento.segmenti[i][i2][i3].push(i4+1);
                            }
                        }
                    }

                }
            }


            //this.bindSchemaOrdinamentoClassificazioni();
        }

    }

    cambioAreaOrdinamento(sender, inx) {
        let _p = sender.parent().parent().attr("id").split("_");
        if (_p[1] == "settori") {
            let div_settori = $("#lista_settori");
            div_settori.empty();

            for (let i = 0; i < this.schemaOrdinamento.settori[inx - 1].length; i++) {
                let item = this.schemaOrdinamento.settori[inx - 1][i];
                div_settori.append(
                    '<div class="row mt-2">' +
                    '<div class="col small">' + (i + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoSettoreVal($(this))" id="settore_' + i +'" area="' + (inx - 1) +'" value="' + item + '" /></div>' +
                    '</div>');
            }
        }
        else if (_p[1] == "gruppi") {
            let div_gruppi = $("#lista_gruppi");
            div_gruppi.empty();

            let inxSettori = parseInt($("#cmbGruppiSettori").attr("value"));
            if (inxSettori > 0) {
                for (let i = 0; i < this.schemaOrdinamento.gruppi[inx - 1][inxSettori - 1].length; i++) {
                    let item = this.schemaOrdinamento.gruppi[inx - 1][inxSettori - 1][i];
                    div_gruppi.append(
                        '<div class="row mt-2">' +
                        '<div class="col small">' + (i + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoGruppoVal($(this))" id="settore_' + i + '" area="' + (inx - 1) + '" value="' + item + '" /></div>' +
                        '</div>');
                }
            }
        }
        else if (_p[1] == "segmenti") {
            let div_gruppi = $("#lista_segmenti");
            div_gruppi.empty();

            let inxGruppi = parseInt($("#cmbSegmentiGruppi").attr("value"));
            let inxSettori = parseInt($("#cmbSegmentiSettori").attr("value"));
            if (inxGruppi > 0 && inxSettori > 0) {
                for (let i = 0; i < this.schemaOrdinamento.segmenti[inx - 1][inxSettori - 1][inxGruppi - 1].length; i++) {
                    let item = this.schemaOrdinamento.segmenti[inx - 1][inxSettori - 1][inxGruppi - 1][i];
                    div_gruppi.append(
                        '<div class="row mt-2">' +
                        '<div class="col small">' + (i + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoSegmentoVal($(this))" id="settore_' + i + '" area="' + (inx - 1) + '" value="' + item + '" /></div>' +
                        '</div>');
                }
            }
        }

        let _div = $("#cmb_" + _p[1] + "_settori");
        if (_div.length > 0) {
            _div.empty();


            for (let i = 0; i < this.schemaOrdinamento.settori[inx - 1].length; i++) {
                //let item = this.schemaOrdinamento[_p[1]][inx-1][i];
                let rec = '<li><a class="dropdown-item" onclick="agenzia.cambioSettoriOrdinamento($(this),' + (i + 1) + ')">' + (i + 1) + '</a></li>';
                _div.append(rec);
            }

        }

        let actionID = "cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Aree";
        $("#" + actionID).val(inx);
        $("#" + actionID).text("Area " + inx);
    }

    cambioSettoriOrdinamento(sender, inx) {
        let _p = sender.parent().parent().attr("id").split("_");


        let areeInx = $("#cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Aree").val();
        if (areeInx != null) {
            areeInx = parseInt(areeInx) - 1;
        }

        if (_p[1] == "gruppi") {

            let div_gruppi = $("#lista_gruppi");
            div_gruppi.empty();

            

            if (areeInx>=0) {

                //for (let i = 0; i < this.schemaOrdinamento.gruppi[areeInx][inx-1].length; i++) {
                    let item = this.schemaOrdinamento.gruppi[areeInx][inx - 1];
                    console.log("> " + item.length);
                    for (let i2 = 0; i2 < item.length; i2++) {
                        console.log(item[i2]);
                        div_gruppi.append(
                            '<div class="row mt-2">' +
                            '<div class="col small">' + (i2 + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoGruppoVal($(this))" id="gruppo_' + i2 +'" area="' + areeInx + '" settore="' + (inx - 1) + '" value="' + item[i2] + '" /></div>' +
                            '</div>');
                    }
                //}
            }
        }
        else if (_p[1] == "segmenti") {
            let div_gruppi = $("#lista_segmenti");
            div_gruppi.empty();

            let inxGruppi = parseInt($("#cmbSegmentiGruppi").attr("value"));
            let inxAree = parseInt($("#cmbSegmentiAree").attr("value"));
            if (inxGruppi> 0 && inxAree > 0) {
                for (let i = 0; i < this.schemaOrdinamento.segmenti[inxAree-1][inx - 1][inxGruppi - 1].length; i++) {
                    let item = this.schemaOrdinamento.segmenti[inxAree - 1][inx - 1][inxGruppi - 1][i];
                    div_gruppi.append(
                        '<div class="row mt-2">' +
                        '<div class="col small">' + (i + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoSegmentoVal($(this))" id="settore_' + i + '" area="' + (inx - 1) + '" value="' + item + '" /></div>' +
                        '</div>');
                }
            }
        }

        let _div = $("#cmb_" + _p[1] + "_gruppi");
        if (_div.length > 0) {
            _div.empty();

            for (let i = 0; i < this.schemaOrdinamento.gruppi[areeInx][inx - 1].length; i++) {
                //let item = this.schemaOrdinamento[_p[1]][inx-1][i];
                let rec = '<li><a class="dropdown-item" onclick="agenzia.cambioGruppiOrdinamento($(this),' + (i + 1) + ')">' + (i + 1) + '</a></li>';
                _div.append(rec);
            }
        }

        let actionID = "cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Settori";
        $("#" + actionID).val(inx);
        $("#" + actionID).text("Settore " + inx);
    }

    cambioGruppiOrdinamento(sender, inx) {

        let _p = sender.parent().parent().attr("id").split("_");

        let areeInx = $("#cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Aree").val();
        if (areeInx != null) {
            areeInx = parseInt(areeInx) - 1;
        }


        let settoriInx = $("#cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Settori").val();
        if (settoriInx != null) {
            settoriInx = parseInt(settoriInx) - 1;
        }


        if (_p[1] == "segmenti") {

            let div_segmenti = $("#lista_segmenti");
            div_segmenti.empty();

            if (areeInx != null && settoriInx != null) {
                //for (let i = 0; i < this.schemaOrdinamento.segmenti[areeInx][settoriInx][inx-1].length; i++) {
                    let item = this.schemaOrdinamento.segmenti[areeInx][settoriInx][inx - 1];
                    for (let i2 = 0; i2 < item.length; i2++) {
                        div_segmenti.append(
                            '<div class="row mt-2">' +
                            '<div class="col small">' + (i2 + 1) + '<input type="text" style="width:50px; margin-left:10px;" onchange="agenzia.cambiaOrdinamentoSegmentoVal($(this))" id="segmento_' + i2 +'" area="' + areeInx + '" settore="' + settoriInx + '" gruppo="' + (inx - 1) + '" value="' + item[i2] + '" /></div>' +
                            '</div>');
                    }
                //}
            }
        }

        let actionID = "cmb" + _p[1][0].toUpperCase() + _p[1].substring(1) + "Gruppi";
        $("#" + actionID).val(inx);
        $("#" + actionID).text("Gruppo " + inx);

    }

    cambiaOrdinamentoAreaVal(sender) {
        let inxArea = parseInt(sender.attr("id").replace("area_", ""));
        this.schemaOrdinamento.aree[inxArea] = parseInt(sender.val());
    }

    cambiaOrdinamentoSettoreVal(sender) {
        let inxSettore = parseInt(sender.attr("id").replace("settore_", ""));
        let inxArea = parseInt(sender.attr("area"));
        this.schemaOrdinamento.settori[inxArea][inxSettore] = parseInt(sender.val());
    }

    cambiaOrdinamentoGruppoVal(sender) {
        let inxGruppo = parseInt(sender.attr("id").replace("gruppo_", ""));
        let inxArea = parseInt(sender.attr("area"));
        let inxSettore = parseInt(sender.attr("settore"));
        this.schemaOrdinamento.gruppi[inxArea][inxSettore][inxGruppo] = parseInt(sender.val());
    }

    cambiaOrdinamentoSegmentoVal(sender) {
        let inxSegmento = parseInt(sender.attr("id").replace("segmento_", ""));
        let inxArea = parseInt(sender.attr("area"));
        let inxSettore = parseInt(sender.attr("settore"));
        let inxGruppo = parseInt(sender.attr("gruppo"));
        this.schemaOrdinamento.segmenti[inxArea][inxSettore][inxGruppo][inxSegmento] = parseInt(sender.val());
    }

    cambioCategoria(sender, type)
    {
        let ID = sender.attr("indice");
        let prop = "chiave";
        if (type == "val")
            prop = "valore";
        else if (type == "inx")
            prop = "indice";

        this.schemaOrdinamento.categorie[ID][prop] = sender.val();
    }

    resetOrdinamento() {
        this.schemaOrdinamento.aree = [];
        this.schemaOrdinamento.settori = [];
        this.schemaOrdinamento.gruppi = [];
        this.schemaOrdinamento.segmenti = [];

        this.salvaSchemaOrdinamento();

    }

    salvaSchemaOrdinamento() {
        let fd = new FormData();
        fd.append("schema", JSON.stringify(this.schemaOrdinamento));

        Call.doWithUpload("MenaboSettings", "salvaSchemaOrdinamento", "POST", fd, this, function (result, sender) {
            if (result.esito) {
                alert("Operazione terminata");
            }
        });
    }

    modificaColPesoTracciato(colPesoTracciato, pesoTracciatoVal, inTrac, group) {
        if (pesoTracciatoVal == null || pesoTracciatoVal == "") {
            colPesoTracciato.find("div").each(function () {
                $(this).css("display", "none");
            });

            let contenutoSostitutivo = '<div class="input-group" style="border: 1px solid red">' +
                '<span class="input-group-text" style = "font-size:small;">Peso tot (Err)</span>' +
                '<input type="text" readonly class="form-control" id="PesoTracciatoErrato" name="PesoTracciatoErrato" value="' + (inTrac.grammatura != null ? inTrac.grammatura : "")+ '"/>' +
                '</div>'

            colPesoTracciato.append(contenutoSostitutivo);
        }
    }

    getCustomConfronti() {

        $("#testataModalita").css("display", "block");

        var opzioneConfrontoLocandine = {
            testo: "Confronto locandine",
            hiddenValue: {
                multiPrimaria: true,
                secondaria: false,
                multiSecondaria: false,
                requireXmlFile: false,
                specialParam: "confrontoLocandine=true"
            }
        };

        let nuovaOpzione = $('<option>').text(opzioneConfrontoLocandine.testo)
            .attr('multi-primaria', opzioneConfrontoLocandine.hiddenValue.multiPrimaria)
            .attr('secondaria', opzioneConfrontoLocandine.hiddenValue.secondaria)
            .attr('multi-secondaria', opzioneConfrontoLocandine.hiddenValue.multiSecondaria)
            .attr('requireXmlFile', opzioneConfrontoLocandine.hiddenValue.requireXmlFile)
            .attr('special-param', opzioneConfrontoLocandine.hiddenValue.specialParam);

        $("#SelectModalita").append(nuovaOpzione);

        var opzioneConfrontoListato = {
            testo: "Confronto Listato-Volantino",
            hiddenValue: {
                multiPrimaria: false,
                secondaria: false,
                multiSecondaria: false,
                requireXmlFile: false,
                specialParam: "confrontoListato=true"
            }
        };

        nuovaOpzione = $('<option>').text(opzioneConfrontoListato.testo)
            .attr('multi-primaria', opzioneConfrontoListato.hiddenValue.multiPrimaria)
            .attr('secondaria', opzioneConfrontoListato.hiddenValue.secondaria)
            .attr('multi-secondaria', opzioneConfrontoListato.hiddenValue.multiSecondaria)
            .attr('requireXmlFile', opzioneConfrontoListato.hiddenValue.requireXmlFile)
            .attr('special-param', opzioneConfrontoListato.hiddenValue.specialParam);

        $("#SelectModalita").append(nuovaOpzione);
    }

    mostraFirmaTracciato()
    {
        return true;
    }
}