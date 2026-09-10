//Edro21
class Agenzia extends IAgenzia {
    repartoPath = "";
    tipo_tracciato_selezionato = 0;
    parametri_visualizzati_revisionato_menabo = ["descrizione1", "descrizione2", "descrizione3", "descrizione4"];
    listGruppiInOut = [];
    Form_importazioneTracciato = '<div class="container mt-3">' +

        '<div class="row"><div class="col">' +
            '<label for="cmbTipoTracciato" class="form-label">Tipo</label>' +
            '<select class="form-select form-select-lg mb-3" id="cmbTipoTracciato" name="cmbTipoTracciato">' +
            '<option value="0" selected>Seleziona tipologia di tracciato</option>' +
            '<option value="1">Volantino</option>' +
            '<option value="2">PoP</option>' +
            '<option value="3">Manifesto  (regole VOL con FV)</option>' +
            '</select>' +
        '</div></div>' +

        '<div class="row"><div class="col" id="col_materiale_lab" style="display:none;">' +
            '<label for="cmbMateriale" class="form-label">Materiale</label>' +
            '<select class="form-select form-select-lg mb-3" id="cmbMaterialeVol" name="cmbMaterialeVol" style="display:none;">' +
            '$source_materiale_vol' +
            '</select>' +
            '<select class="form-select form-select-lg mb-3" id="cmbMaterialePoP" name="cmbMaterialePoP" style="display:none;">' +
            '$source_materiale_pop' +
            '</select>' +
            '<select class="form-select form-select-lg mb-3" id="cmbMaterialeManifesto" name="cmbMaterialeManifesto" style="display:none;">' +
            '$source_materiale_manifesto' +
            '</select>' +
        '</div></div>' +

        '<div class="row mt-4" id="row_canale_area" style="display:none;"><div class="col">' +
            '<select class="form-select form-select-lg mb-3" id="cmbCanaleArea" name="cmbCanaleArea">' +
            '<option value="0" selected>Seleziona Canale/Area</option>' +
            '$source_aree' +
            '</select>' +
        '</div></div>' +

        '<div class="row" id="row_mzap_name" style="display:none;"><div class="col-4">' +
            '<label for="MzApName" class="form-label">Nome:</label>' +
            '<input type="text" id="MzApName" name="MzApName" class="form-control" />' +
        '</div></div>'/* +

        '<div class="row"><div class="col mt-2">' +
            '<input type="checkbox" id="ChEsportaFoto" name="ChEsportaFoto" class="form-check-input" />' +
            '<label for="ChEsportaFoto" class="form-label">Esporta anche le foto</label>' +
        '</div></div>' +

        '<div class="row"><div class="col mt-2">' +
            '<input type="checkbox" id="ChEsportaDaArchivio" name="ChEsportaDaArchivio" class="form-check-input" />' +
            '<label for="ChEsportaDaArchivio" class="form-label">Esporta descrizioni da archivio</label>' +
        '</div></div>' */+
        
        '</div>';

    campiConfrontiTracciati = '<div class="row mb-3">' +
        '<div id="ColonnaTendinaTipoTracciato" class="col-4">' +
        '<h4>Tipo tracciato</h4>'+
        '<select id="cmbTipoTracciato" class="form-select customInput" aria-label="Menu a tendina" onchange="confInstance.agenzia.confrontiSetTipoMateriali($(this).val())">' +
        '<option value = "0" selected>Seleziona un\'opzione</option> ' +
        '<option value = "1" >Volantino</option> ' +
        '<option value = "2" >Pop</option> ' +
        '<option value = "3" >Manifesto</option> ' +
        '</select>' +
        '</div>' +
        '<div class="col-1"></div>' +
        '<div id="ColonnaTendinaMastro" class="col-3">' +
        '<h4>Mastro</h4>' +
        '<select id="cmbMastro" class="form-select customInput" aria-label="Menu a tendina" onchange="">' +
        '<option value="0" selected>Scegli mastro</option> ' +
        '</select>' +
        '</div>' +
        '<div class="col-1" style="display:none"></div>' +
        '<div id="ColonnaTendinaMateriali" class="col-3" style="display:none">' +
        '<h4>Materiali</h4>' +
        '<select id="cmbMaterialeVol" class="form-select customInput" aria-label="Menu a tendina" onchange="">' +
        '<option value = "0" selected>Scegli tipo</option>' +
        '</select > ' +
        '<input type="hidden" id="cmbCanaleArea" value="0" class="customInput"></input>'+
        '</div>' +
        '</div>';


    formatiMenaboPagina = ["1x1", "2x2", "3x3", "4x3", "3x4", "4x4", "5x4", "4x5"];

    //Form_ricercaTracciato = '<div class="input-group input-group-sm">' +
    //    '<select class="form-select form-select-sm" id="ricercaTracciato" name="ricercaTracciato" style="width: 40%;" onchange="menaboInstance.ricercaInTracciatoMenabo($(this))" onclick="this.classList.remove(\'bg-danger\')" onchange="this.classList.remove(\'bg-success\',\'bg-opacity-25\')">' +

    //    '</select>' +
    //    '<input type="text" id="ricercaText" class="form-control ricercaText" aria-label="Sizing example input" aria-describedby="inputGroup-sizing-sm" style="width: 50%;" onkeypress="menaboInstance.ricercaInTracciatoMenabo($(this))" >' +
    //    '<img src="images/trashcanIcon.png" class="mx-1" id="trashIcon" style="width:20px;" onclick="menaboInstance.rimuoviParametroRicerca($(this))"/>' +
    //    '</div>';

    Form_ricercaTracciato =
        '<option value="reparto">Reparto</option>' +
        '<option value="ruolo">Ruolo</option>' +
        '<option value="sezione">Sez.Volantino</option>' +
        '<option value="nome_gruppo_ordinamento">Gruppo ordinamento</option>';

    BloccaScaricamentoListaAutomatico = true;

    schemaOrdinamento = {};

    parametriComposizioneCustom = {
        segnaposto: "reparto",
        nomeVisualizzato: "Rep:",
        requiredVal: "",
        comparator: "",
        hideVal: "false",
        sottochiavi: [{
            chiave: "descrizione_iniziativa",
            titolo: "Sott:",
            value: "Sottocosto"
        }]
    }

    getParametriSegnaposto() {
        return this.parametriComposizioneCustom;
    }

    compilaBoxConInformazioniCustom(htmlItem, dataItem)
    {
        this.aggiungiAreeInAreeOutDettaglio(htmlItem, dataItem);
        this.aggiungiCampiRevisioneTracciato(htmlItem, dataItem);
        this.aggiungiCampiRevisioneArchivio(htmlItem, dataItem);
    }

    addCustomDettagli(itemHtml, groupElements) {
    //    let htmlGroupElement = `
    //<div class="container bg-warning bg-opacity-50 pb-1 mb-2">
    //    <div class="row">
    //        <div class="col">
    //            <label for="Esempio" class="form-label">Note Esempio</label>
    //            <textarea class="form-control" readonly style="height:40px;" id="Esempio" name="Esempio"></textarea>
    //        </div>
    //    </div>
    //</div>`;
    //    let htmlGroupeElementObject = $(htmlGroupElement);

    //    itemHtml.prepend(htmlGroupeElementObject);

        //htmlItem.find(".dettaglioCampiElemento").prepend(htmlSingleElement);
        //let pilota = groupElements.find(f => f.recordInTracciato.referenza_pilota == "S" && f.recordInTracciato.referenza_pilota != null);
        //if (pilota == null) {
        //    pilota = groupElements[0];
        //}



        //let infoEsempio = pilota.recordInTracciato.nota_esempio;
        //let evidenzia = false;
        //if (infoEsempio.toLowerCase().includes("esempio") && !infoEsempio.toLowerCase().includes("non")) {
        //    evidenzia = true;
        //}

        //while (infoEsempio.includes("<br>")) {
        //    infoEsempio = infoEsempio.replace("<br>", " ");

        //}

        //htmlGroupeElementObject.find("#Esempio").val(infoEsempio);
        //if (evidenzia) {
        //    htmlGroupeElementObject.find("#Esempio").css("font-weight", "bold");
        //    htmlGroupeElementObject.find("#Esempio").css("color", "red");
        //}
    }

    aggiungiAreeInAreeOutDettaglio(htmlItem, dataItem) {
        //if (!dataItem.isGruppo) {


            if (htmlItem.find(".areeInDettaglio").length > 0) {
                let areeText = "";
                if (dataItem.recordInTracciato.ACComuni != null) {
                    dataItem.recordInTracciato.ACComuni.forEach(function (itemArea) {
                        if (itemArea.inVol) {
                            areeText += itemArea.canale + itemArea.area + ",";
                        }
                    });
                    areeText = areeText.slice(0, -1);
                }
                var aree = areeText.split(",");
                var areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");
                htmlItem.find(".areeInDettaglio").text("In vol: " + areeOrdinate.join(", "));

                areeText = "";
                if (dataItem.recordInTracciato.ACComuni != null) {
                    dataItem.recordInTracciato.ACComuni.forEach(function (itemArea) {
                        if (!itemArea.inVol) {
                            areeText += itemArea.canale + itemArea.area + ",";
                        }
                    });
                    areeText = areeText.slice(0, -1);
                }
                aree = areeText.split(",");
                areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");

                htmlItem.find(".fuoriAreeInDettaglio").text("Fuori vol: " + areeOrdinate.join(", "));
            }
            else {
                let areeText = "";
                if (dataItem.recordInTracciato.ACComuni != null) {
                    dataItem.recordInTracciato.ACComuni.forEach(function (itemArea) {
                        if (itemArea.inVol) {
                            areeText += itemArea.canale + itemArea.area + ",";
                        }
                    });
                }
                areeText = areeText.slice(0, -1);
                var aree = areeText.split(",");
                var areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");
                htmlItem.find(".inVolList").text("In vol: " + areeOrdinate.join(", "));
                areeText = "";
                if (dataItem.recordInTracciato.ACComuni != null) {
                    dataItem.recordInTracciato.ACComuni.forEach(function (itemArea) {
                        if (!itemArea.inVol) {
                            areeText += itemArea.canale + itemArea.area + ",";
                        }
                    });
                }
                areeText = areeText.slice(0, -1);
                aree = areeText.split(",");
                areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");

                htmlItem.find(".FuoriVolList").text("Fuori vol: " + areeOrdinate.join(", "));
            }
        //}
        //else {

        //    var gruppo = this.listGruppiInOut.find(f => f.codiceGruppo == dataItem.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
        //    var areeIn = gruppo.areeIn;
        //    var areeOut = gruppo.areeOut;

        //    if (htmlItem.find(".areeInDettaglio").length > 0) {
        //        let areeText = "";
        //        if (areeIn != null) {
        //            areeIn.forEach(function (itemArea) {
        //                areeText += itemArea + ",";
        //            });
        //            areeText = areeText.slice(0, -1);
        //        }
        //        var aree = areeText.split(",");
        //        var areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");
        //        htmlItem.find(".areeInDettaglio").text("In vol: " + areeOrdinate.join(", "));

        //        areeText = "";
        //        if (areeOut != null) {
        //            areeOut.forEach(function (itemArea) {
        //                areeText += itemArea + ",";
        //            });
        //            areeText = areeText.slice(0, -1);
        //        }
        //        aree = areeText.split(",");
        //        areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");

        //        htmlItem.find(".fuoriAreeInDettaglio").text("Fuori vol: " + areeOrdinate.join(", "));
        //    }
        //    else {
        //        let areeText = "";
        //        if (areeIn != null) {
        //            areeIn.forEach(function (item) {
        //                areeText += item + ",";
        //            });
        //        }
        //        areeText = areeText.slice(0, -1);
        //        var aree = areeText.split(",");
        //        var areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");
        //        htmlItem.find(".inVolList").text("In vol: " + areeOrdinate.join(", "));
        //        areeText = "";
        //        if (areeOut != null) {
        //            areeOut.forEach(function (item) {
        //                areeText += item + ",";
        //            });
        //        }

        //        areeText = areeText.slice(0, -1);
        //        aree = areeText.split(",");
        //        areeOrdinate = this.applicaSchemaDiOrdinamentoTracciati(aree, "");

        //        htmlItem.find(".FuoriVolList").text("Fuori vol: " + areeOrdinate.join(", "));
        //    }

        //}
    }

    getForm_ricercaTracciato() {
        return this.Form_ricercaTracciato;        
    }

    ordinaRecordsTracciatoInMenabo(lista, cb) {

        //$.getJSON('external_source/SourceOrdinamentoLista.json?v=1.0.0', function (data) {
            //console.log("Oggetto ordinamento");
            //console.log(data);
            //IndiceOrdinamento
            //IndiceOridinamentoSezione
            let lista_ordinata  = lista.sort(function (a, b) {
                var inxA = 99999;
                var inxB = 99999;
                if (a.recordInTracciato["IndiceOrdinamento"] != null)
                    inxA = a.recordInTracciato["IndiceOrdinamento"];
                if (b.recordInTracciato["IndiceOrdinamento"] != null)
                    inxB = b.recordInTracciato["IndiceOrdinamento"];

                var inxASez = 99999;
                var inxBSez = 99999;
                if (a.recordInTracciato["indice_sezione"] != null)
                    inxASez = a.recordInTracciato["indice_sezione"];
                if (b.recordInTracciato["indice_sezione"] != null)
                    inxBSez = b.recordInTracciato["indice_sezione"];

                if (inxASez < inxBSez)
                    return -1;
                else if (inxASez > inxBSez)
                    return 1;
                else
                    return (inxA < inxB) ? -1 : (inxA > inxB) ? 1 : 0;
            });

            cb(lista_ordinata);

        //});
    }

    getCustomConfronti() {
        let result = this.campiConfrontiTracciati;
        $("#customAgenziaCampi").append(result);
        $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceMastro.json', function (data) {
            $("#cmbMastro").empty();
            $("#cmbMastro").append("<option value=\"0\"selected>Scegli mastro</option>");
            data.source.forEach(function (item) {
                $("#cmbMastro").append('<option value=' + item.Id + '>'+ item.Nome+'</option>');
            });
        });
    }

    confrontiSetTipoMateriali(optionSelected) {
        $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceTipiMateriale.json', function (data) {

            if (optionSelected == 1) {
                let _bind_materialeVol = data.source.filter(m => m.Associazione === 1 || m.Associazione === 3);
                let _bind_materialeVolHtml = "";
                for (let i = 0; i < _bind_materialeVol.length; i++) {
                    let item = _bind_materialeVol[i];
                    _bind_materialeVolHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
                }
                $("#cmbMaterialeVol").empty();
                $("#cmbMaterialeVol").append("<option value=\"0\"selected>Scegli tipo</option>");
                $("#cmbMaterialeVol").append(_bind_materialeVolHtml);
                $("#ColonnaTendinaMateriali").css("display","block");

            }
            else if (optionSelected == 2) {
                let _bind_materialePoP = data.source.filter(m => m.Associazione === 2 || m.Associazione === 3);
                let _bind_materialePoPHtml = "";
                for (let i = 0; i < _bind_materialePoP.length; i++) {
                    let item = _bind_materialePoP[i];
                    _bind_materialePoPHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
                }
                $("#cmbMaterialeVol").empty();
                $("#cmbMaterialeVol").append("<option value=\"0\"selected>Scegli tipo</option>");
                $("#cmbMaterialeVol").append(_bind_materialePoPHtml);
                $("#ColonnaTendinaMateriali").css("display", "block");

            }
            else if (optionSelected == 3) {
                let _bind_materialeManif = data.source.filter(m => m.Codice === "BB");
                let _bind_materialeManifHtml = "";
                for (let i = 0; i < _bind_materialeManif.length; i++) {
                    let item = _bind_materialeManif[i];
                    _bind_materialeManifHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
                }
                $("#cmbMaterialeVol").empty();
                $("#cmbMaterialeVol").append("<option value=\"0\"selected>Scegli tipo</option>");
                $("#cmbMaterialeVol").append(_bind_materialeManifHtml);
                $("#ColonnaTendinaMateriali").css("display", "block");

            }
            else {
                $("#ColonnaTendinaMateriali").css("display", "none");
                $("#cmbMaterialeVol").empty();
                $("#cmbMaterialeVol").append("<option value=\"0\"selected>Scegli tipo</option>");
            }
        });
    }

    controllaCambioPromoCustomConfronti(valore) {
        $("#cmbCanaleArea").val(valore);
    }


    //getForm_importazioneTracciato(callback) {
    //    let result = this.Form_importazioneTracciato;
    //    let materialiLoaded = false;
    //    let areeLoaded = false;

    //    let ME = this;

    //    //console.log("sync 1");
    //    $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceTipiMateriale.json', function (data) {
    //        //console.log(data);
    //        //console.log("sync 2");

    //        let _bind_materialeVol = data.source.filter(m => m.Associazione === 1 || m.Associazione === 3);
    //        let _bind_materialePoP = data.source.filter(m => m.Associazione === 2 || m.Associazione === 3);
    //        let _bind_materialeManif = data.source.filter(m => m.Codice === "BB");


    //        let _bind_materialeVolHtml = "";
    //        for (let i = 0; i < _bind_materialeVol.length; i++) {
    //            let item = _bind_materialeVol[i];
    //            _bind_materialeVolHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
    //        }

    //        let _bind_materialePoPHtml = "";
    //        for (let i = 0; i < _bind_materialePoP.length; i++) {
    //            let item = _bind_materialePoP[i];
    //            _bind_materialePoPHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
    //        }

    //        let _bind_materialeManifHtml = "";
    //        for (let i = 0; i < _bind_materialeManif.length; i++) {
    //            let item = _bind_materialeManif[i];
    //            _bind_materialeManifHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
    //        }

    //        result = result.replace("$source_materiale_vol", _bind_materialeVolHtml);
    //        result = result.replace("$source_materiale_pop", _bind_materialePoPHtml);
    //        result = result.replace("$source_materiale_manifesto", _bind_materialeManifHtml);

    //        materialiLoaded = true;
    //        if (areeLoaded) {
    //            callback(result);
    //            ME.listen();
    //        }
    //    });

    //    $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceAree.json', function (data) {

    //        let _bind_areeHtml = "";
    //        for (let i = 0; i < data.source.length; i++) {
    //            let item = data.source[i];
    //            _bind_areeHtml += "<option value=\"" + item.Id + "\">" + item.Codice + "</option>";
    //        }

    //        result = result.replace("$source_aree", _bind_areeHtml);

    //        areeLoaded = true;
    //        if (materialiLoaded) {
    //            callback(result);
    //            ME.listen();
    //        }

    //    });

    //    //console.log("sync 4");
    //}

    listen()
    {
        let ME = this;

        this.resetMaterialeView=function () {
            $("#cmbMaterialeVol").css("display", "none");
            $("#cmbMaterialePoP").css("display", "none");
            $("#cmbMaterialeManifesto").css("display", "none");

        }

        this.selectedTipoTracciato = function () {
            

            ME.resetMaterialeView();

            var val = $("#cmbTipoTracciato").val();

            console.log(val);

            $("#col_materiale_val").css("display", "block");
            $("#col_materiale_lab").css("display", "block");

            if (val == 1) {
                $("#cmbMaterialeVol").css("display", "block");
            }
            else if (val == 2) {
                $("#cmbMaterialePoP").css("display", "block");
            }
            else if (val == 3) {
                $("#cmbMaterialeManifesto").css("display", "block");
            }
            else {
                $("#col_materiale_val").css("display", "none");
                $("#col_materiale_lab").css("display", "none");
            }

            ME.tipo_tracciato_selezionato = val;
            ME.selectedMateriale();
        }

        this.selectedMateriale=function() {

            $("#row_canale_area").css("display", "none");
            $("#row_mzap_name").css("display", "none");

            var val = "";
            if (ME.tipo_tracciato_selezionato == 1) {
                val = $("#cmbMaterialeVol").val();
            }
            else if (ME.tipo_tracciato_selezionato == 2) {
                val = $("#cmbMaterialePoP").val();
            }

            if (val == "AP") {
                $("#row_canale_area").css("display", "block");
                $("#row_mzap_name").css("display", "block");
            }
            else if (val == "MZ") {
                $("#row_mzap_name").css("display", "block");
            }
        }

        $("#cmbTipoTracciato").on("change", this.selectedTipoTracciato);
        $("#cmbMaterialeVol").on("change", this.selectedMateriale);
        $("#cmbMaterialePoP").on("change", this.selectedMateriale);
        $("#cmbMaterialeManifesto").on("change", this.selectedMateriale);

    }

    modificaDescrizioni(obj, primario, htmlItem) {
        if (obj.isGruppo && obj.recordRevisionato == null && primario != null) {
            let descr4 = primario.recordRevisionato != null ? primario.recordRevisionato.descrizione4 : primario.recordInTracciato[keyDescr4];
            htmlItem.find("#Descrizione4").val(descr4);
        }
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

        let result = [];

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

    }

    vuoiAggiungereFiltri(List) {
        console.log("entroInAgenzia filtri");
        console.log(List);
        let element = $("#FiltriAnchor");
        let listFiltro = [];
        let tmpItem = '<div class="row mt-5">' +
            '<div class="col-2">' +
            '<select id="CmbReparto" name="CmbReparto" class="form-select form-select-sm" customSearchParameterPath="reparto">';

        List.forEach(function (item) {
            if (item.recordInTracciato != null && item.recordInTracciato["reparto"] != null && listFiltro.indexOf(item.recordInTracciato["reparto"]) < 0) {
                listFiltro.push(item.recordInTracciato["reparto"]);
            }
        });

        console.log(listFiltro);
        for (let i = 0; i < listFiltro.length; i++) {
            if (i == 0) {
                tmpItem += '<option value="Reset">Nessun reparto selezionato</option>';
            }
            tmpItem += '<option value="' + listFiltro[i] + '">' + listFiltro[i] + '</option>';
        }
        tmpItem += '</select>' +
            '</div>' +
            '</div>';

        element.empty();
        const $markup = $(tmpItem);
        element.append($markup);

        // Bind non-inline dell’onchange
        $markup.find("#CmbReparto").on("change", function () {
            revInstance.setCustomSearch(this);
        });
    }

    AggiungiInfoPezzo(groupElements, codiceSingolo, area) {
        let currentElement = groupElements.find(f => f.recordInTracciato.Referenza.Codice == codiceSingolo);
        let elementHtml = $("#container_tracciato").find(".record_menabo[id_rec='" + currentElement.idRec + "']");
        let numTroncatoPromo;
        let numTroncatoKG;
        if (area == "MARKET") {
            numTroncatoPromo = parseFloat(currentElement.recordInTracciato.prezzo_promo).toFixed(2);
            numTroncatoKG = parseFloat(currentElement.recordInTracciato.prezzo_kgl).toFixed(2);
        }
        else if (area == "ORO") {
            numTroncatoPromo = parseFloat(currentElement.recordInTracciato.prezzo_promo_oro).toFixed(2);
            numTroncatoKG = parseFloat(currentElement.recordInTracciato.prezzo_kgl_oro).toFixed(2);
        }
        elementHtml.find("#agenziaRow1").find(".col").text("Promo: " + numTroncatoPromo + "€");
        elementHtml.find("#agenziaRow2").find(".col").text("Al kg: " + numTroncatoKG + "€");
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
                let ordineSegmenti = data.source;
                me.schemaOrdinamento.source = data.source;
                me.schemaOrdinamento.sezioni = data.sezioni.sort(function (a, b) { return (a.indice < b.indice) ? -1 : (a.indice > b.indice) ? 1 : 0; });

                $("#schema").append('<div class="container"><div class="row"><div class="col-6" id="col_lista_segmenti"></div><div class="col-6" id="col_lista_sezioni"></div></div></div>');

                $("#schema").find("#col_lista_segmenti").append('<div class="container" style="border: 2px solid #cfdfde;"><div class="row mt-2" style="background-color:#cfdfde"><h2>Segmenti</h2></div><div class="row"><div class="col" id="lista_segmenti"></div></div></div>');
                $("#schema").find("#col_lista_sezioni").append('<div class="container" style="border: 2px solid #cfdfde;"><div class="row mt-2 mb-2" style="background-color:#cfdfde"><h2>Sezioni</h2></div><div class="row"><div class="col" id="lista_sezioni"></div></div><div id="sezNew" class="row mt-2 mb-2" style="background-color:#cfdfde"></div></div>');

                let div_segmenti = $("#schema").find("#lista_segmenti");
                let div_sezioni = $("#schema").find("#lista_sezioni");
                let div_sezNew = $("#schema").find("#sezNew");

                for (let i = 0; i < me.schemaOrdinamento.sezioni.length; i++)
                {
                    let item =me.schemaOrdinamento.sezioni[i];
                    div_sezioni.append(
                        '<div class="row">' +
                        '<div class="col-4 small"><input type="text" class="txtSezione" value="' + item.nome + '" /></div>' +
                        '<div class="col-4 small"><input type="text" class="txtIndice" value="' + item.indice + '" /></div>' +
                        '<div class="col-4 small"><input type="button" value="Salva" /></div>' +
                        '</div>');
                }

                div_sezNew.append(
                    '<div class="row">' +
                    '<div class="col-4 small"><input type="text" class="txtSezione" placeholder="Nome" /></div>' +
                    '<div class="col-4 small"><input type="text" class="txtIndice" placeholder="Indice" /></div>' +
                    '<div class="col-4 small"><input type="button" value="Aggiungi" onclick="agenzia.aggiungiSezioneOrdinamento($(this))" /></div>' +
                    '</div>');

                //for (let i = 0; i < me.schemaOrdinamento.source.length; i++) {
                let curr_gruppo = "";
                for (let i = 0; i < me.schemaOrdinamento.source.length; i++) {
                    let item = me.schemaOrdinamento.source[i];
                    if (curr_gruppo != item.Gruppo) {
                        div_segmenti.append(
                            '<div class="row mt-3 mb-3" style="background-color:aliceblue;">' +
                            '<div class="col"><h2>' + item.Gruppo + '</h2></div>' +
                            '</div>');
                    }


                    let bkg = "#e4e8eb";
                    if (i % 2 == 0)
                        bkg = "#f7fafd";

                   div_segmenti.append(
                       '<div class="row" style="background-color:'+bkg+'">' +
                       '<div class="col-3 small">' + item.CodiceSegmento + '</div>' +
                       '<div class="col-4 small">' + item.NomeSettore + '</div>' +
                       '<div class="col-4 small">' + item.NomeReparto + '</div>' +
                       '<div class="col-1 small">' + item.Indice + '</div>' +
                       '</div>');

                    curr_gruppo = item.Gruppo;
                }

            }
        });
    }

    aggiungiSezioneOrdinamento(sender) {

        let sez = sender.parent().parent().find(".txtSezione").val();
        let inx = sender.parent().parent().find(".txtIndice").val();

        //console.log("Aggiungo " + sez + " at " + inx);
        this.schemaOrdinamento.sezioni.push({ nome: sez, indice: parseInt(inx) });

        console.log(JSON.stringify(this.schemaOrdinamento));

        let fd = new FormData();
        fd.append("schema", JSON.stringify(this.schemaOrdinamento));

        Call.doWithUpload("MenaboSettings", "salvaSchemaOrdinamento", "POST", fd, this, function (result, sender) {
            if (result.error == null) {
            }
        });
    }



    WHITELIST_RAW = [
        "gemelli<br>errore:<br>non indicati foto e/o es.",
        "gemelli",
        "gemelli<br>esempio",
        "gemelli<br>esempio<br>errore:<br>indicati più es.",
        "gemelli<br>presente esempio",
        "raggruppa",
        "raggruppa<br>presente esempio",
        "raggruppa<br>esempio",
        "raggruppa<br>esempio<br>errore:<br>indicati più es.",
        "raggruppa<br>esempio<br>errore:<br>non indicati foto e/o es.",
    ];

    // 1) Normalizza: <br> -> spazio, comprime spazi, trim, lowercase
    normalize(s) {
        return String(s)
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }



    // 3) Dato un testo normalizzato, trova l'etichetta ammessa più lunga contenuta
    extractAllowed(normalized) {
        // 2) Whitelist normalizzata (stesso trattamento dei values)
        let WHITELIST = this.WHITELIST_RAW.map(this.normalize);
        const matches = WHITELIST.filter((w) => normalized.includes(w));
        if (matches.length === 0) return "";
        return matches.reduce((a, b) => (b.length > a.length ? b : a), "");
    }

    // 4) Restituisce la versione "pulita" per il confronto (senza toccare l'originale)
    cleanForCompare(value) {
        const n = this.normalize(value);
        return this.extractAllowed(n);
    }

    // 5) Confronto: se tutti i "puliti" sono uguali (anche tutti vuoti) => true
    shouldRemoveMismatchNotaEsempio(valuesArr) {
        let me = this;
        const cleanedMap = valuesArr.map((v, i) => ({
            index: i,
            original: v.value,
            cleaned: me.cleanForCompare(v.value),
        }));

        const uniqueCleaned = Array.from(new Set(cleanedMap.map((x) => x.cleaned)));
        const allEqual = uniqueCleaned.length === 1; // anche [""] => tutti "vuoti" => uguali

        return { allEqual, uniqueCleaned, cleanedMap };
    }

    normalizzaKeyInMismatch(metaKeyInMismatch) {
        const mismatchNotaEsempioIndex = metaKeyInMismatch.findIndex(f => f.key === "nota_esempio");
        if (mismatchNotaEsempioIndex !== -1) {
            const mismatchNotaEsempio = metaKeyInMismatch[mismatchNotaEsempioIndex];
            const { allEqual } = this.shouldRemoveMismatchNotaEsempio(mismatchNotaEsempio.values);

            if (allEqual) {
                // Rimuove l’oggetto dall’array
                metaKeyInMismatch.splice(mismatchNotaEsempioIndex, 1);
            }
        }
    }

    aggiungiCampiRevisioneTracciato(htmlItem, dataItem) {
        //<div class="row">
        //    <div class="col">
        //        <label for="SelezioneFoto" class="form-label">Esempio</label>
        //        <textarea class="form-control" readonly style="height:40px;" id="SelezioneFoto" name="SelezioneFoto"></textarea>
        //    </div>
        //</div>
        var evidenzia = false;
        if (dataItem.isGruppo) {
            let htmlGroupElement = `
    <div class="container bg-warning bg-opacity-50 pb-1 mb-2">
        <div class="row">
            <div class="col">
                <label for="Esempio" class="form-label">Note Esempio</label>
                <textarea class="form-control" readonly style="height:40px;" id="Esempio" name="Esempio"></textarea>
            </div>
        </div>
    </div>`;
            let htmlGroupeElementObject = $(htmlGroupElement);

            htmlItem.find(".dettaglioTracciatoCustom").prepend(htmlGroupeElementObject);
            htmlItem.find(".dettaglioTracciatoCustom").show();

            //htmlItem.find(".dettaglioCampiElemento").prepend(htmlSingleElement);
            let elementiGruppo = revInstance.List.filter(f => !f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == dataItem.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
            let pilota = elementiGruppo.find(f => f.recordInTracciato.referenza_pilota == "S" && f.recordInTracciato.referenza_pilota != null);            
            if (pilota == null) {
                pilota = elementiGruppo[0];
            }

            

            let infoEsempio = pilota.recordInTracciato.nota_esempio;

            if (infoEsempio!=null && infoEsempio.toLowerCase().includes("esempio") && !infoEsempio.toLowerCase().includes("non")) {
                evidenzia = true;
            }

            while (infoEsempio.includes("<br>")) {
                infoEsempio = infoEsempio.replace("<br>", " ");

            }

            htmlGroupeElementObject.find("#Esempio").val(infoEsempio);
            if (evidenzia) {
                htmlGroupeElementObject.find("#Esempio").css("font-weight", "bold");
                htmlGroupeElementObject.find("#Esempio").css("color", "red");
            }

            let mismatchNotaEsempio = pilota.recordInTracciato.metaKeyInMismatch.find(f => f.key == "nota_esempio");
//            if (mismatchNotaEsempio != null) {
//                const dataAree = (pilota.recordInTracciato.ACComuni ?? []).map(f => f.nomeAC);
//                htmlGroupeElementObject.find("#Esempio").attr("mismatch", "val-style");
//                const label = htmlGroupeElementObject.find(`label[for='Esempio']`);

//                const svg = `
//<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="orange" aria-label="avviso">
//  <path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2V10z"></path>
//</svg>
//`;

//                // aggiunge l’SVG *prima del contenuto testuale* senza rimuoverlo
//                label.prepend(svg + ' ');
//                for (var i = 0; i < dataAree.length; i++) {
//                    let area = dataAree[i];
//                    let elArea = mismatchNotaEsempio.values.find(f => f.origins.includes(area));

//                    let style = ["font-weight", "", "color", ""];
//                    if (elArea) {
//                        let valore = elArea.value;
//                        evidenzia = false;
//                        if (valore.toLowerCase().includes("esempio") && !valore.toLowerCase().includes("non")) {
//                            evidenzia = true;
//                        }

//                        while (valore.includes("<br>")) {
//                            valore = valore.replace("<br>", " ");
//                        }

//                        if (evidenzia) {
//                            style = ["font-weight", "bold", "color", "red"];
//                        }

//                        htmlGroupeElementObject.find("#Esempio").attr(area + "-style", style);
//                        htmlGroupeElementObject.find("#Esempio").attr(area + "-val", valore);
//                    }
//                }
//            }
            var mode = $("#filtraPerGruppiOSingoli").val();
            if (mismatchNotaEsempio) {
                var itemToModify = htmlGroupeElementObject.find("#Esempio");
                addMismatchKeyVisual(mismatchNotaEsempio, itemToModify, null, true, function (mismatchKey, itemToModify) {
                    itemToModify.attr("mismatch", "val-style");
                    for (var i = 0; i < mismatchKey.values.length; i++) {
                        let elArea = mismatchKey.values[i];

                        let style = ["font-weight", "", "color", ""];
                        if (elArea) {
                            let valore = elArea.value;
                            let evidenzia = false;

                            if (valore != null) {
                                if (valore.toLowerCase().includes("esempio") && !valore.toLowerCase().includes("non")) {
                                    evidenzia = true;
                                }

                                while (valore.includes("<br>")) {
                                    valore = valore.replace("<br>", " ");
                                }

                                if (evidenzia) {
                                    style = ["font-weight", "bold", "color", "red"];
                                }
                            }
                            htmlGroupeElementObject.find("#Esempio").attr(elArea.origins.join("_") + "-style", style);
                            htmlGroupeElementObject.find("#Esempio").attr(elArea.origins.join("_") + "-val", valore);
                        }
                    }
                });
            }
        }
    }

    //aggiungiCampiRevisioneArchivio(htmlItem, dataItem) {
    //    let htmlSingleElement = `
    //<div class="container">
    //    <div class="row">
    //        <div class="col-2">
    //            Meccanica
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Meccanica" name="Meccanica"></textarea>
    //        </div>
    //        <div class="col-3">
    //            Localismo
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Localismo" name="Localismo"></textarea>
    //        </div>
    //        <div class="col-3">
    //            Distintività
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Distintivita" name="Distintivita"></textarea>
    //        </div>
    //        <div class="col-4">
    //            Territorialità
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Territorialita" name="Territorialita"></textarea>
    //        </div>

    //    </div>
    //    <div class="row">

    //    </div>
    //    <div class="row">
    //        <div class="col">
    //            Tema
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Tema" name="Tema"></textarea>
    //        </div>
    //        <div class="col">
    //            Tipo_tema
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Tipo_tema" name="Tipo_tema"></textarea>
    //        </div>
    //        <div class="col">
    //            Sez. Volantino
    //            <textarea class="form-control" readonly style="height:33.5px;" id="SezVolantino" name="SezVolantino"></textarea>
    //        </div>
    //        <div class="col">
    //            Ruolo
    //            <textarea class="form-control" readonly style="height:33.5px;" id="Ruolo" name="Ruolo"></textarea>
    //        </div>

    //    </div>
    //    <div class="row">
    //        <div class="col">
    //            Note Category
    //            <textarea class="form-control" readonly style="height:33.5px;" id="NoteCat" name="NoteCat"></textarea>
    //        </div>
    //    </div>
    //    <div class="row">
    //        <div class="col-10">
    //            NOTE PER IMPAGINATO
    //            <textarea class="form-control" style="height:33.5px;" id="NoteImpaginato" name="NOTE PER IMPAGINATO"></textarea>
    //        </div>
    //        <div class="col d-flex align-items-end">
    //            <input id="salvaNoteImpaginato" type="button" class="btn btn-primary" value="Salva" onclick="revInstance.salvaCampoInDatoTracciatoFromSender('noteImpaginato', $('#NoteImpaginato').val(), $(this))" />
    //        </div>
    //    </div>
    //</div>`;

    //    let htmlSingleElementObject = $(htmlSingleElement);
    //    // Aggiungi l'oggetto jQuery come primo figlio di ".dettaglioCampiElemento"
    //    htmlItem.find(".dettaglioArchivioCustomDiv").append(htmlSingleElementObject);
    //    htmlItem.find(".dettaglioArchivioCustom").show();
    //    if (!dataItem.isGruppo) {
    //        htmlItem.find("#dettaglioArchivioCustomContainer").css('display', 'none');
    //    }
    //    let elementiGruppo = revInstance.List.filter(f => !f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == dataItem.recordInTracciato[keyScattoCodiceGruppo]);
    //    let pilota = elementiGruppo.find(f => f.recordInTracciato.referenza_pilota == "S" && f.recordInTracciato.referenza_pilota != null);
    //    if (pilota == null) {
    //        pilota = elementiGruppo[0];
    //    }
    //    // Ora puoi utilizzare il metodo find sull'oggetto jQuery
    //    htmlSingleElementObject.find("#Meccanica").val(pilota.recordInTracciato.meccanica_origine);
    //    htmlSingleElementObject.find("#SezVolantino").val(pilota.recordInTracciato.sezione);
    //    htmlSingleElementObject.find("#Distintivita").val(pilota.recordInTracciato.distintivita);
    //    htmlSingleElementObject.find("#Territorialita").val(pilota.recordInTracciato.territorialita);
    //    htmlSingleElementObject.find("#Localismo").val(pilota.recordInTracciato.localismo);
    //    htmlSingleElementObject.find("#Ruolo").val(pilota.recordInTracciato.ruolo);
    //    htmlSingleElementObject.find("#NoteCat").val(pilota.recordInTracciato.note_category);
    //    htmlSingleElementObject.find("#Tema").val(pilota.recordInTracciato.tema);
    //    htmlSingleElementObject.find("#Tipo_tema").val(pilota.recordInTracciato.tipo_tema);
    //    htmlSingleElementObject.find("#NoteImpaginato").val(pilota.recordInTracciato.noteImpaginato);

    //    // Imposta l'altezza dell'elemento .dettaglioGruppo
    //    htmlItem.find(".dettaglioGruppo").css("height", "600px")
    //}

    regoleDiVisualizzazioneCampiInMismatch(recordInTracciato) {
        var mode = $("#filtraPerGruppiOSingoli").val();
        if (mode == "singoli") return false

        return true;
    }


    aggiungiCampiRevisioneArchivio(htmlItem, dataItem) {
        // 1) Costruisco il markup grezzo (tutte e 4 le colonne)
        let htmlSingleElement = `
    <div class="container">
      <div class="row">
        <div class="col-2">
          Meccanica
          <textarea class="form-control" readonly style="height:33.5px;" id="Meccanica"
                    name="Meccanica"></textarea>
        </div>
        <div class="col-3">
          Localismo
          <textarea class="form-control" readonly style="height:33.5px;" id="Localismo"
                    name="Localismo"></textarea>
        </div>
        <div class="col-3">
          Distintività
          <textarea class="form-control" readonly style="height:33.5px;" id="Distintivita"
                    name="Distintivita"></textarea>
        </div>
        <div class="col-4">
          Territorialità
          <textarea class="form-control" readonly style="height:33.5px;" id="Territorialita"
                    name="Territorialita"></textarea>
        </div>
      </div>
      <!-- Altre righe invariate -->
      <div class="row"></div>
      <div class="row">
        <div class="col">Tema
          <textarea class="form-control" readonly style="height:33.5px;" id="Tema"
                    name="Tema"></textarea>
        </div>
        <div class="col">Tipo_tema
          <textarea class="form-control" readonly style="height:33.5px;" id="Tipo_tema"
                    name="Tipo_tema"></textarea>
        </div>
        <div class="col">Sez. Volantino
          <textarea class="form-control" readonly style="height:33.5px;" id="SezVolantino"
                    name="SezVolantino"></textarea>
        </div>
        <div class="col">Ruolo
          <textarea class="form-control" readonly style="height:33.5px;" id="Ruolo"
                    name="Ruolo"></textarea>
        </div>
      </div>
      <div class="row">
        <div class="col">Note Category
          <textarea class="form-control" readonly style="height:33.5px;" id="NoteCat"
                    name="NoteCat"></textarea>
        </div>
      </div>
      <div class="row">
        <div class="col-10">NOTE PER IMPAGINATO
          <textarea class="form-control" style="height:33.5px; " id="NoteImpaginato"
                    name="NOTE PER IMPAGINATO"></textarea>
        </div>
        <div class="col d-flex align-items-end">
          <input id="salvaNoteImpaginato" type="button" class="btn btn-primary"
            value="Salva" />
        </div>
      </div>
    </div>`;

        $(document).on('click', '#salvaNoteImpaginato', function () {
            revInstance.salvaCampoInDatoTracciatoFromSender(
                'noteImpaginato',
                $('#NoteImpaginato').val(),
                $(this)
            );
        });

        // 2) Lo trasformo in oggetto jQuery e lo inietto nel DOM
        let $elem = $(htmlSingleElement);
        htmlItem.find(".dettaglioArchivioCustomDiv").append($elem);
        htmlItem.find(".dettaglioArchivioCustom").show();
        if (!dataItem.isGruppo) {
            htmlItem.find("#dettaglioArchivioCustomContainer").hide();
        }

        // Funzione di utilità per riallineare colonne dopo rimozione
        function adjustColumns($cols, removedSize) {
            const count = $cols.length;
            const baseInc = Math.floor(removedSize / count);
            let extra = removedSize - baseInc * count;
            $cols.each(function (i) {
                const $c = $(this);
                // prendo la classe col-N
                const oldCls = ($c.attr('class').match(/col-(\d+)/) || [])[0];
                const oldSize = oldCls ? parseInt(oldCls.split('-')[1]) : 0;
                const inc = baseInc + (i < extra ? 1 : 0);
                const newSize = oldSize + inc;
                $c.removeClass(oldCls).addClass(`col-${newSize}`);
            });
        }

        // Preparo la lista degli elementi del gruppo
        let elementiGruppo = revInstance.List
            .filter(f => !f.isGruppo
                && f.recordInTracciato[
                (revInstance.modalitaSottogruppi
                    ? keyScattoCodiceSottogruppo
                    : keyScattoCodiceGruppo)
                ]
            == dataItem.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]
            );
        // ----------------------------
        // 3) SE È UN GRUPPO
        // ----------------------------
        if (dataItem.isGruppo) {
            // rimuovo la colonna Localismo (col-3)
            const $localCol = $elem.find('#Localismo').closest('[class*="col-"]');
            const localRow = $localCol.closest('.row');
            $localCol.remove();
            // riallineo le altre tre nella prima row
            const $remaining = localRow.children('[class*="col-"]');
            adjustColumns($remaining, 3);

            // controllo se tutte le territorialità nel gruppo sono uguali
            const allTerr = elementiGruppo
                .map(f => f.recordInTracciato.territorialita);
            const tuttiUguali = allTerr.every(val => val === allTerr[0]);
            if (!tuttiUguali) {
                $elem.find('#Territorialita').val('Dati misti');
            }

            let pilota = elementiGruppo.find(f => f.recordInTracciato.referenza_pilota === "S")
                || elementiGruppo[0];
            $elem.find('#Meccanica').val(pilota.recordInTracciato.meccanica_origine);
            $elem.find('#SezVolantino').val(pilota.recordInTracciato.sezione);
            $elem.find('#Distintivita').val(pilota.recordInTracciato.distintivita);
            $elem.find('#Ruolo').val(pilota.recordInTracciato.ruolo);
            $elem.find('#NoteCat').val(pilota.recordInTracciato.note_category);
            $elem.find('#Tema').val(pilota.recordInTracciato.tema);
            $elem.find('#Tipo_tema').val(pilota.recordInTracciato.tipo_tema);
            $elem.find('#NoteImpaginato').val(pilota.recordInTracciato.noteImpaginato);
        }
        // ---------------------------------------------
        // 4) SE NON È GRUPPO E CI SONO PIÙ ELEMENTI NEL GRUPPO
        // ---------------------------------------------
        else if (elementiGruppo.length > 1) {
            // rimuovo la colonna Territorialità (col-4)
            const $terrCol = $elem.find('#Territorialita').closest('[class*="col-"]');
            const terrRow = $terrCol.closest('.row');

            $terrCol.remove();
            // riallineo le altre tre nella prima row
            const $remaining = terrRow.children('[class*="col-"]');
            adjustColumns($remaining, 4);
        }

        // 5) Popolo tutti gli altri campi esattamente come prima
        if (!dataItem.isGruppo) {
            $elem.find('#Meccanica').val(dataItem.recordInTracciato.meccanica_origine);
            $elem.find('#SezVolantino').val(dataItem.recordInTracciato.sezione);
            $elem.find('#Distintivita').val(dataItem.recordInTracciato.distintivita);
            $elem.find('#Ruolo').val(dataItem.recordInTracciato.ruolo);
            $elem.find('#NoteCat').val(dataItem.recordInTracciato.note_category);
            $elem.find('#Localismo').val(revInstance.getInfoDatoRefSingola(dataItem.recordInTracciato[keyRefCodice], "localismo"));
            $elem.find('#Tema').val(dataItem.recordInTracciato.tema);
            $elem.find('#Tipo_tema').val(dataItem.recordInTracciato.tipo_tema);
            $elem.find('#NoteImpaginato').val(dataItem.recordInTracciato.noteImpaginato);
            $elem.find('#Territorialita').val(dataItem.recordInTracciato.territorialita);
        }

        // imposta altezza fissa (come prima)
        htmlItem.find(".dettaglioGruppo").css("height", "600px");
    }

    getCampiToCheckMismatch() {
        return ["PrimarioGruppo", "nota_esempio", "localismo", "StatoSelezione"];
    }

    impostaFiltriCustom() {
        $("#serach_label").closest(".col").hide();
    }

    compilaBoxAgenzia(item) {
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
                                || substring == this.PEZZI_DISPONIBILI || substring == this.PEZZI_DISPONIBILI_end)) {
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
                                    || substring == this.PEZZI_DISPONIBILI || substring == this.PEZZI_DISPONIBILI_end)) {
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
                    else {
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

        let result = [_container, htmlBox]
        return result;

    }

    //ordinaListaSelezioneTracciato() {
    //    const $select = $("#CmbTracciato");
    //    const $options = $select.find("option");

    //    // Tieni da parte l'opzione con value = "0"
    //    const $firstOption = $options.filter('[value="0"]');

    //    const gerarchia = ["SC", "SS", "CN", "CY"];
    //    const suffissi = ["TO", "SA", "LA", "EM", "LI", "PI"];

    //    function getPeso(text) {
    //        if ($firstOption.length && text === $firstOption.text()) return -1;

    //        const match = text.match(/^(SC|SS|CN|CY)([A-Z]{2})$/);
    //        if (!match) return 9999; // Caso non riconosciuto

    //        const [_, prefix, suffix] = match;
    //        const base = gerarchia.indexOf(prefix);
    //        if (base === -1) return 9999;

    //        const ordine = suffissi.indexOf(suffix);
    //        return base * 100 + (ordine !== -1 ? ordine : 99);
    //    }

    //    // Ordina tutte le option (escludendo quella con val=0 se presente)
    //    const $sorted = $options.not('[value="0"]').sort(function (a, b) {
    //        const pesoA = getPeso($(a).text());
    //        const pesoB = getPeso($(b).text());
    //        return pesoA - pesoB;
    //    });

    //    // Svuota e reinserisce le option
    //    $select.empty();
    //    if ($firstOption.length) $select.append($firstOption);
    //    $select.append($sorted);
    //}

    applicaSchemaDiOrdinamentoTracciati(_lista, field) {

        const gerarchia = ["SC", "SS", "CN", "CY","MG","FID","SeD","PT"];
        const suffissi = ["TO", "SP", "SA", "LA", "EM", "LI", "PI", "AO","NO","OV"];
        function getPeso(text) {

            const match = text.match(/^(SC|SS|CN|CY|MG|FID|SeD|PT)([A-Z]{2})$/);
            if (!match) return 9999; // Caso non riconosciuto

            const [_, prefix, suffix] = match;
            const base = gerarchia.indexOf(prefix);
            if (base === -1) return 9999;

            const ordine = suffissi.indexOf(suffix);
            return base * 100 + (ordine !== -1 ? ordine : 99);
        }

        // Ordina tutte le option (escludendo quella con val=0 se presente)
        const $sorted = _lista.sort(function (a, b) {
            const pesoA = getPeso(field == "" ? a : a[field]);
            const pesoB = getPeso(field == "" ? b : b[field]);
            return pesoA - pesoB;
        });

        return $sorted;

    }

    //parametriComposizioneCustom = [{
    //    segnaposto: "reparto",
    //    nomeVisualizzato: "Rep:",
    //    sottochiavi: [{
    //        chiave: "settore",
    //        titolo: "Set: 3307",
    //        value: 3307
    //    }]
    //}]

    customSegnaposti(segnaposto) {
        if (this.parametriComposizioneCustom != null && this.parametriComposizioneCustom.sottochiavi != null) {
            this.parametriComposizioneCustom.sottochiavi.forEach(function (item) {
                let count = 0;
                let currentElement = $(segnaposto).next();

                while (currentElement.length > 0 && !currentElement.hasClass('segnaposto')) {
                    if (currentElement.is(':visible')) {
                        let isGruppo = currentElement.hasClass("groupItemListaTracciato");
                        if (!isGruppo && !currentElement.hasClass('record_menabo')) {
                            continue;
                        }
                        let menaboItem = menaboInstance.tracciatoSource.find(f => !f.isGruppo && (isGruppo ? f.recordInTracciato[keyScattoCodiceGruppo] == currentElement.attr("codice_gruppo") : f.idRec == parseInt(currentElement.attr("id_rec"))));
                        const chiaveValue = menaboItem.recordInTracciato[item.chiave];
                        const itemValue = (typeof item.value === 'string') ? item.value.toLowerCase() : item.value;

                        if (chiaveValue != null &&
                            (typeof chiaveValue === 'string') && itemValue != null && itemValue != "" &&
                            chiaveValue.toLowerCase() === itemValue) {
                            count++;
                        }
                    }
                    currentElement = currentElement.next();
                }

                if (count > 0) {
                    let newText = $(segnaposto).find("#valueSegna").text();
                    newText += " - " + item.titolo + count;
                    $(segnaposto).find("#valueSegna").text(newText);
                }
            });
        }
    }

    customCampiEtichettaturaTracciato() {
        var campiDaAppendere = [{
            value: "Context.Promo.materiale",
            nome: "Materiale promo contesto",
        },
        {
            value: "Context.Promo.tema",
            nome: "Tema promo contesto",
        },
        {
            value: "food",
            nome: "food",
        },
        {
            value: "meccanica_tradotta",
            nome: "meccanica tradotta",
        },
        {
            value: "flag_all",
            nome: "flag all",
        },
        {
            value: "flag_fid",
            nome: "flag fid",
        },
        {
            value: "grafica_50al50",
            nome: "grafica 50 al 50",
        },
        {
            value: "territorialita",
            nome: "territorialità",
        },
        ]

        return campiDaAppendere;
    }

    customCampiEtichettaturaPromo() {
        var campiDaAppendere = [
            {
                value: "Context.tema",
                nome: "Tema",
            },
            {
                value: "Context.materiale",
                nome: "Materiale",
            },
            {
                value: "Context.macro_materiale",
                nome: "Macro materiale",
            }
        ]

        return campiDaAppendere;
    }

    customCampiEtichettaturaPromoTracciati() {
        var campiDaAppendere = [
            {
                value: "Meta.materiale",
                nome: "Materiale",
            },
            {
                value: "Meta.macro_materiale",
                nome: "Macro materiale",
            }
        ]

        return campiDaAppendere;
    }

    applyFilterToList(list) {
        let gruppi = [];

        if ($('#utenteLoggato').val() != "gg") {
            gruppi = list.filter(f => !f.isGruppo && f.recordInTracciato.sigla_reparto != null && f.recordInTracciato.sigla_reparto == "EX");

            let codiciGruppoUnici = [...new Set(
                gruppi
                    .map(f => f.recordInTracciato[keyScattoCodiceGruppo])
                    .filter(codice => codice != null)
            )];

            list = list.filter(f =>
                !codiciGruppoUnici.includes(f.recordInTracciato[keyScattoCodiceGruppo])
            );
        }


        //list = this.calcolaAreaInAreaOutGruppi(list)

        return list
    }

    applyFilterToListAttivazioneSottogruppi(list) {
        //list = this.calcolaAreaInAreaOutGruppi(list)

        if (revInstance.modalitaSottogruppi) {
            list = list.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] != f.recordInTracciato[keyScattoCodiceSottogruppo] || f.recordInTracciato.gruppoOriginaleAppartenenza != null && f.recordInTracciato.gruppoOriginaleAppartenenza != f.recordInTracciato[keyScattoCodiceSottogruppo]);
        }

        return list
    }


    //calcolaAreaInAreaOutGruppi(list) {
    //    this.listGruppiInOut = [];

    //    let gruppi = list.filter(f => f.isGruppo);
    //    let me = this;
    //    gruppi.forEach(gruppo => {

    //        if (gruppo.recordInTracciato[keyScattoCodiceGruppo].includes("392236,392260,4696660,6205367")) {
    //            console.log("");
    //        }

    //        var elementiGruppo = list.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == gruppo.recordInTracciato[keyScattoCodiceGruppo] && !f.isGruppo);
    //        if (elementiGruppo.length === 0) {
    //            console.log(list.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == "1511255"));
    //            console.log(list.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == "1511236"));
    //            return;
    //        }

    //        var areeIn = elementiGruppo
    //            .map(e => e.recordInTracciato.ACComuni.filter(a => a.inVol).map(a => a.canale + a.area))
    //            .reduce((acc, curr) => acc.filter(area => curr.includes(area)));

    //        var areeOut = elementiGruppo
    //            .map(e => e.recordInTracciato.ACComuni.filter(a => !a.inVol).map(a => a.canale + a.area))
    //            .reduce((acc, curr) => acc.filter(area => curr.includes(area)));

    //        const codiciSingoliDelGruppo = gruppo.recordInTracciato[keyScattoCodiceGruppo].split(",");

    //        const gruppiPiuGrandi = me.listGruppiInOut.filter(gr => {
    //            const codiciGruppo = gr.codiceGruppo.split(",");
    //            return codiciSingoliDelGruppo.every(c => codiciGruppo.includes(c));
    //        });

    //        gruppiPiuGrandi.forEach(gg => {
    //            gg.areeIn.forEach(area => {
    //                var indexArea = areeIn.indexOf(area);
    //                if (indexArea >= 0) {
    //                    areeIn.splice(indexArea, 1);
    //                }
    //            });

    //            gg.areeOut.forEach(area => {
    //                var indexArea = areeOut.indexOf(area);
    //                if (indexArea >= 0) {
    //                    areeOut.splice(indexArea, 1);
    //                }
    //            });
    //        });


    //        gruppo.recordInTracciato.areeIn = areeIn;
    //        gruppo.recordInTracciato.areeOut = areeOut;


    //        this.listGruppiInOut.push( {
    //            codiceGruppo: gruppo.recordInTracciato[keyScattoCodiceGruppo],
    //            areeIn: areeIn,
    //            areeOut: areeOut
    //        })
    //    })


    //    list.sort((a, b) => a._origIdx - b._origIdx);

    //    // 5) Rimuovo il campo temporaneo da ciascun oggetto
    //    list.forEach(el => {
    //        delete el._origIdx;
    //    });


    //    return list;
    //}

    aggiungiCampiExtra(htmlItem, extra, isGruppo) {
        console.log(htmlItem);
        console.log(extra);

        // Deserializza l'oggetto extra se è in formato stringa
        if (extra != null && typeof extra === "string") {
            try {
                extra = JSON.parse(extra);
            } catch (e) {
                console.error("Extra non è un JSON valido:", e);
                extra = {};
            }
        }

        var accordion = null;
        var contenitore = null;
        // Seconda riga: solo se non è un gruppo
        if (!isGruppo) {
            contenitore = $("<div></div>");
        }
        else {

            const uid = Date.now() + "_" + Math.floor(Math.random() * 10000);

            const headingId = "headingOne_" + uid;
            const collapseId = "collapseOne_" + uid;

            accordion = $(`
                <div class="accordion mt-2" id="accordionExtra">
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="${headingId}">
                            <button class="accordion-button collapsed"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target="#${collapseId}"
                                    aria-expanded="true"
                                    aria-controls="${collapseId}">
                                Extra
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse"
                                aria-labelledby="${headingId}"
                                data-bs-parent="#accordionExtra">
                            <div class="accordion-body">
                                <div class="row" id="containerRowsExtras"></div>
                            </div>
                        </div>
                    </div>
                </div>
                `);

            // questo sostituisce il tuo vecchio "contenitore"
            contenitore = accordion.find("#containerRowsExtras");


        }

        const rowExtra2 = $(`
            <div class="row `+ (isGruppo ? `` : +`mt-3`) +`" id="rowExtra">
                <div class="col">
                    <label for="notaEsempio">Un esempio:</label>
                    <textarea 
                        type="text" 
                        class="form-control extraField" 
                        tipoDato="stringa" 
                        chiave="nota_esempio" 
                        id="extraField"
                        style="height:80px; font-family: monospace;"
                    ></textarea>
                </div>
            </div>
        `);

        contenitore.append(rowExtra2);

        // Prima riga: sempre presente
        const rowExtra1 = $(`
            <div class="row `+ (isGruppo ? `` : +`mt-3`) +`" id="rowExtra">
                <div class="col">
                    <label for="extraField">Note</label>
                    <textarea 
                        type="text" 
                        class="form-control extraField" 
                        tipoDato="stringa" 
                        chiave="Note_per_impaginato" 
                        id="extraField"
                        style="font-family: monospace;"
                    ></textarea>
                </div>
            </div>
        `);

        contenitore.append(rowExtra1);

        if (isGruppo) {
            // Inserisce la row prima di #rowRevFirma
            $(htmlItem).find("#rowRevFirma").before(accordion);
        }
        else {
            // Inserisce la row prima di #rowRevFirma
            $(htmlItem).find("#rowRevFirma").before(contenitore);
        }

        // Bind non-inline degli eventi input per i campi extra appena inseriti
        contenitore.find(".extraField").on("input", function () {
            revInstance.controlChangeText($(this));
        });

        if (extra != null) {
            // Riempie i valori dei campi extra se presenti in `extra`
            $(htmlItem).find(".extraField").each(function () {
                const chiave = $(this).attr("chiave");
                if (extra.hasOwnProperty(chiave)) {
                    $(this).val(extra[chiave].content);
                }
            });
        }
    }

    aggiungiCampiExtraSchedaArticolo(htmlItem, item) {

        item.ArticoliDescrizionis.forEach(function (artDescr) {
            var extra = artDescr.Extra;
            var tab = null;
            if (artDescr.Area || artDescr.Canale) {
                tab = htmlItem.closest(".tab-pane[area='" + artDescr.Area + "'][canale='" + artDescr.Canale + "']").first();
            }
            else {
                tab = htmlItem.closest("#tab-Naz");
            }

            var container = tab.find("#rowExtra");

            // Deserializza l'oggetto extra se è in formato stringa
            if (extra != null && typeof extra === "string") {
                try {
                    extra = JSON.parse(extra);
                } catch (e) {
                    console.error("Extra non è un JSON valido:", e);
                    extra = {};
                }
            }

            const contenitore = $("<div></div>"); // contenitore temporaneo per unire più righe



            const rowExtra2 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="notaEsempio">Un esempio:</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="nota_esempio" 
                            id="extraField"
                            style="height:80px; font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra2);


            

            // Prima riga: sempre presente
            const rowExtra1 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="extraField">Note</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="Note_per_impaginato" 
                            id="extraField"
                            style="font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra1);


            const rowExtra3 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="extraField">Approfondimenti</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="approfondimenti" 
                            id="extraField"
                            style="font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra3);

            const rowExtra4 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="extraField">Buono a sapersi</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="buono_a_sapersi" 
                            id="extraField"
                            style="font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra4);

            const rowExtra5 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="extraField">Schede vini</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="schede_vini" 
                            id="extraField"
                            style="font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra5);

            const rowExtra6 = $(`
                <div class="row mt-3" id="rowExtra">
                    <div class="col">
                        <label for="extraField">Ricette</label>
                        <textarea 
                            type="text" 
                            class="form-control extraField" 
                            tipoDato="stringa" 
                            chiave="ricette" 
                            id="extraField"
                            style="font-family: monospace;"
                        ></textarea>
                    </div>
                </div>
            `);

            contenitore.append(rowExtra6);

            // Inserisce la row prima di #rowRevFirma
            container.append(contenitore);

            if (extra != null) {
                // Riempie i valori dei campi extra se presenti in `extra`
                $(htmlItem).find(".extraField").each(function () {
                    const chiave = $(this).attr("chiave");
                    if (extra.hasOwnProperty(chiave)) {
                        $(this).val(extra[chiave].content);
                    }
                });
            }
        })


    }


    nascondiCampiIndesideratiRevisore(htmlItem, isGruppo) {
        return;
        if (isGruppo) {
            htmlItem.find("#Descrizione4").parent().hide();
            htmlItem.find("#Peso").parent().hide();
            htmlItem.find("#Um").parent().hide();
        }
    }

    modificaCampiRevisore(htmlItem, isGruppo) {
        htmlItem.find("#Descrizione1").css("height", "165px");
        htmlItem.find("#Descrizione3").css("height", "165px");
        htmlItem.find("#Descrizione2").css("height", "70px");
        htmlItem.find("#Descrizione4").css("height", "70px");
    }

    controlChangeTextCustom(container, ref) {
        var elementi = container.find('[chiave]');
        let changes = false;
        elementi.each(function (index, el) {
            el = $(el);
            const chiave = el.attr("chiave");
            if (!chiave) return;

            const valoreBox = el.val();

            let extra = ref?.recordRevisionato?.extra;

            // Deserializza se è stringa
            if (extra && typeof extra === "string") {
                try {
                    extra = JSON.parse(extra);
                } catch (e) {
                    console.error("recordRevisionato.extra non è un JSON valido:", e);
                    extra = {};
                }
            }

            if (extra?.[chiave]?.content != null) {
                if (valoreBox !== extra[chiave].content) {
                    revInstance.changeBorderAndSave(el);
                    changes = true;
                } else {
                    revInstance.undoBorder(el);
                }
            } else {
                // Se non esiste il campo, qualunque valore scritto è una modifica
                if (valoreBox && valoreBox.trim() !== "") {
                    revInstance.changeBorderAndSave(el);
                    changes = true;
                } else {
                    revInstance.undoBorder(el);
                }
            }
        });

        return changes;
    }

    getParametriReport() {
        return ["segmento", "reparto", "Referenza.Ean"];
    }

    filtroModePerSingoliOGruppi(mode, currentList) {
        if (mode == "gruppi") {
            return currentList.filter(f => f.isGruppo || f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] != f.recordInTracciato[keyRefCodice]);
        }
        else if (mode == "singoli") {
            var listaSenzaGruppi = currentList.filter(f => !f.isGruppo);
            //in lista senza gruppi ci possono essere elementi con lo stesso codice, prendiamo quegli elementi una volta sola
            listaSenzaGruppi = listaSenzaGruppi.filter((item, index, self) => index === self.findIndex(i => i.recordInTracciato[keyRefCodice] === item.recordInTracciato[keyRefCodice]));
            return listaSenzaGruppi;
        }
    }

    nascondiFiltroTracciatiInSyncFoto() {
        return true;
    }

}