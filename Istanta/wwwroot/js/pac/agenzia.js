//Pac
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


    getForm_importazioneTracciato(callback) {
        let result = this.Form_importazioneTracciato;
        let materialiLoaded = false;
        let areeLoaded = false;

        let ME = this;

        //console.log("sync 1");
        $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceTipiMateriale.json', function (data) {
            //console.log(data);
            //console.log("sync 2");

            let _bind_materialeVol = data.source.filter(m => m.Associazione === 1 || m.Associazione === 3);
            let _bind_materialePoP = data.source.filter(m => m.Associazione === 2 || m.Associazione === 3);
            let _bind_materialeManif = data.source.filter(m => m.Codice === "BB");


            let _bind_materialeVolHtml = "";
            for (let i = 0; i < _bind_materialeVol.length; i++) {
                let item = _bind_materialeVol[i];
                _bind_materialeVolHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
            }

            let _bind_materialePoPHtml = "";
            for (let i = 0; i < _bind_materialePoP.length; i++) {
                let item = _bind_materialePoP[i];
                _bind_materialePoPHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
            }

            let _bind_materialeManifHtml = "";
            for (let i = 0; i < _bind_materialeManif.length; i++) {
                let item = _bind_materialeManif[i];
                _bind_materialeManifHtml += "<option value=\"" + item.Codice + "\">" + item.Nome + "</option>";
            }

            result = result.replace("$source_materiale_vol", _bind_materialeVolHtml);
            result = result.replace("$source_materiale_pop", _bind_materialePoPHtml);
            result = result.replace("$source_materiale_manifesto", _bind_materialeManifHtml);

            materialiLoaded = true;
            if (areeLoaded) {
                callback(result);
                ME.listen();
            }
        });

        $.getJSON("/" + getWebAppRootFolder() + 'external_source/SourceAree.json', function (data) {

            let _bind_areeHtml = "";
            for (let i = 0; i < data.source.length; i++) {
                let item = data.source[i];
                _bind_areeHtml += "<option value=\"" + item.Id + "\">" + item.Codice + "</option>";
            }

            result = result.replace("$source_aree", _bind_areeHtml);

            areeLoaded = true;
            if (materialiLoaded) {
                callback(result);
                ME.listen();
            }

        });

        //console.log("sync 4");
    }

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
            '<select id="CmbReparto" name="CmbReparto" class="form-select form-select-sm" customSearchParameterPath="reparto" onchange="revInstance.setCustomSearch(this)">';
        List.forEach(function (item) {

            if (item.recordInTracciato != null && item.recordInTracciato["reparto"]!=null && listFiltro.indexOf(item.recordInTracciato["reparto"]) < 0)
            {
                //Lo devo mettere in lista
                listFiltro.push(item.recordInTracciato["reparto"]);
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
            '</div>' +
            '</div>';
        element.empty();
        element.append($(tmpItem));        
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

    aggiungiCampiRevisioneTracciato(htmlItem, dataItem) {
        
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
          <textarea class="form-control" style="height:33.5px;" id="NoteImpaginato"
                    name="NOTE PER IMPAGINATO"></textarea>
        </div>
        <div class="col d-flex align-items-end">
          <input id="salvaNoteImpaginato" type="button" class="btn btn-primary"
                 value="Salva"
                 onclick="revInstance.salvaCampoInDatoTracciatoFromSender(
                           'noteImpaginato',
                           $('#NoteImpaginato').val(),
                           $(this)
                         )" />
        </div>
      </div>
    </div>`;

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
                == dataItem.recordInTracciato[keyScattoCodiceGruppo]
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

        // imposta altezza fissa (come prima)
        htmlItem.find(".dettaglioGruppo").css("height", "600px");
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

        return list
    }


    aggiungiCampiExtra(htmlItem, extra) {
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

        const rowExtra = $(`
        <div id="rowExtra" class="row mt-3">
            <div class="col">
                <label for="extraField">Note per impaginato</label>
                <input 
                    type="text" 
                    class="form-control extraField" 
                    tipoDato="stringa" 
                    chiave="Note_per_impaginato" 
                    id="extraField"
                />
            </div>
        </div>
        `);

        // Inserisce la row prima di #rowRevFirma
        $(htmlItem).find("#rowRevFirma").before(rowExtra);

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
}