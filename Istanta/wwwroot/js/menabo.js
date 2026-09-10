class Menabo {
    pagSelected = -1;
    pagineSource;
    mastroSource;
    meccanicheSource;
    declinazioneMeccanicheSource;
    declinazioneMeccanicheCombinazioni;
    etichetteRefSource;
    tracciatoSource;
    tracciatoSourceObsoleti;
    idTracciato;
    agenzia;
    geometraInstance;
    currentFormatLastRefSelected;
    currentCodorRefModal;
    areaTracciato;
    canvasAnchorPoint = [];
    targetElement;
    tipoDiEsportazioneInCorso;//1-menabo 2-pop
    addestramentiTracciati;
    tracciatoScaricato = true;
    meccanicheDb = {};
    socket;
    adattataGriglia = false;
    _listaFormati = [];

    AutoImpaginamentoRiuscito = [];
    AutoImpaginamentoFallitoGenerico = [];
    AutoImpaginamentoFallitoNoSpacePagina = [];
    AutoImpaginamentoFallitoAlreadyImpaginate = [];

    constructor(id_tracciato, pagine, mastro, meccaniche) {
        let me = this;
        this.pagineSource = pagine;
        this.mastroSource = mastro;
        this.meccanicheSource = meccaniche;
        this.idTracciato = id_tracciato;
        this.agenzia = new Agenzia();
        this.geometraInstance = new MenaboGeometra();
        this.socket = new MySocket(me.onMessageMenabo);

        console.log(this.pagineSource);

        for (let m = 0; m < this.mastroSource.length; m++) {
            let item = this.mastroSource[m];
            if (item.active) {
                $("#cmb_mastro").append("<option value=\"" + item.id + "\">" + item.nome + "</option>");
            }
        }


        this.bindPagine();

        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceMenabo.json?v1.' + rndVersion, function (data) {
            me._listaFormati = data.formatiMenaboPagina;
            //$('#cmb_formato_griglia').empty();
            //$('#cmb_formato_griglia').append("<option value=\"0\">Seleziona formato</option>");
            me._listaFormati.forEach(i => {
                $('#cmb_formato_griglia').append("<option value=\"" + i + "\">" + i + "</option>");

            });
        });

        if (this.meccanicheSource == null) {
            $.getJSON('external_source/SourceDeclinazioneMeccaniche.json?v1.' + rndVersion, function (data) {
                if (data != null) {
                    me.declinazioneMeccanicheSource = data.source;
                    me.declinazioneMeccanicheCombinazioni = data.combinazioniMeccaniche;
                }
            });
        }

        if (this.meccanicheSource == null) {
            $.getJSON('external_source/SourceEtichetteRef.json?v1.' + rndVersion, function (data) {
                if (data != null) {
                    me.etichetteRefSource = data.source;
                }
            });
        }

        if (this.meccanicheSource != null) {
            for (let m = 0; m < this.meccanicheSource.length; m++) {
                let item = this.meccanicheSource[m];

                var optionValue = item.nomeTraduzione;
                this.meccanicheDb[optionValue] = item.formato;
            }
        }

        //for (let f = 0; f < this.agenzia.formatiMenaboPagina.length; f++) {
        //    let item = this.agenzia.formatiMenaboPagina[f];
        //    $("#cmb_formato_griglia").append("<option value=\"" + item + "\">" + item + "</option>");
        //}

        if (this.agenzia.BloccaScaricamentoListaAutomatico == null) {
            showLoading();
            this.bindTracciato();
        }
        else {
            if (!this.agenzia.BloccaScaricamentoListaAutomatico) {
                showLoading();
                this.bindTracciato();
            }
            else {
                $("#scaricaTracciatoManualmente").css("display", "block");
                this.tracciatoScaricato = false;
            }
        }
    }

    bindManuale() {
        $("#scaricaTracciatoManualmente").css("display", "none");
        showLoading();
        this.bindTracciato();
    }

    bindPagine() {

        $("#cmb_pags").find('option').remove();

        $("#cmb_pags").append("<option value=\"-2\" selected>Seleziona pagina</option>");
        $("#cmb_pags").append("<option value=\"0\">Aggiungi pagina</option>");
        $("#cmb_pags").append("<option value=\"-1\">Aggiungi pagine da schema</option>");

        for (let p = 0; p < this.pagineSource.length; p++) {
            let item = this.pagineSource[p];
            $("#cmb_pags").append("<option value=\"" + item.id + "\">Pag. " + item.numero + "</option>");
        }
    }

    bindTracciato() {
        let me = this;
        Call.do("Menabo", "getListaTracciato/" + this.idTracciato, "GET", null, this, function (result, sender) {
            console.log("Recuperato tracciato");
            console.log(result);

            sender.tracciatoSource = result.data;
            sender.tracciatoSourceObsoleti = result.articoliObsoleti;
            sender.areaTracciato = result.areaPromo;

            ordInstance.ordinaRecordsTracciato(sender.tracciatoSource, sender.agenzia, function (orderedList) {
                console.log("lista ordinata");
                console.log(orderedList);
                sender.tracciatoSource = orderedList;
                sender.tracciatoSource = sender.agenzia.filterRecordsTracciatiOnMenabo(orderedList);

                console.log("Fine ordinamento 2");

                sender.build();
            });
        });
    }

    build() {
        let ME = this;
        this.aggiungiParametroRicerca();
        let gruppoTrue = this.tracciatoSource.filter(obj => obj.isGruppo);
        let gruppoFalse = this.tracciatoSource.filter(obj => !obj.isGruppo);

        // Unire gli oggetti mantenendo l'ordine
        this.tracciatoSource = gruppoFalse.concat(gruppoTrue);
        let ultimaEtichetta = "";
        let ordinamentoUniversale = true;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceOrdinamentoLista.json?v=' + rndVersion, function (data) {
            if (data.ordinamentoUniversale != null) {
                ordinamentoUniversale = data.ordinamentoUniversale;
            }
            else {
                ordinamentoUniversale = false;
            }
        });

        for (let i = 0; i < this.tracciatoSource.length; i++) {
            let item = this.tracciatoSource[i];
            console.log(">>> " + item.recordInTracciato[keyRefCodice]);

            let codGruppo = item.recordInTracciato[keyScattoCodiceGruppo];
            let pagItem = item.recordImpaginato != null ? this.pagineSource.find(p => p.id == item.recordImpaginato.idPagina) : null;
            if (item.isGruppo) {

                if ($("#container_tracciato").find(".record_menabo[codice_gruppo='" + codGruppo + "']").length > 0) {

                    let infoImpaginato = (item.recordImpaginato != null ? item.recordImpaginato.indice + " a Pag. " + pagItem.numero : "");
                    let toggleImpaginatoGruppo = '<div class="row">' +
                        '<div class="col text-center">' +
                        '<div class="form-check form-switch text-start">' +
                        '<input class="form-check-input chImpaginatoGruppo" type="checkbox" role="switch" id="onoff_impaginato" ' + (item.recordImpaginato != null ? "checked" : "") + '>' +
                        '<label class="form-check-label" for="flexSwitchCheckDefault" id="lab_onoff_impaginato" style="font-size:10px;">' + infoImpaginato + '</label>' +
                        '<img class="targetImgGrp" id="targetImgGrp" src="images/target.png" style="width:15px; visibility:visible; cursor:pointer" onclick="menaboInstance.drawline($(this))"/>' +
                        '</div>' +
                        '</div >' +
                        '</div >';
                    let gruppoHtml = $("<ul class=\"groupItemListaTracciato list-group border border-primary border-4 mb-1\" codice_gruppo=\"" + codGruppo + "\"><li class=\"list-group-item list-group-item-success overflow-hidden\" aria-current=\"true\"><div class=\"container record_menabo_gruppo\" codice_gruppo=\"" + codGruppo + "\"> <div id=\"intestazioneRowTracciato\"class=\"row\"><div class=\"col-10\"></div></div>" + "<div class=\"row\"><div class=\"col-10\" data-bs-toggle=\"tooltip\" data-bs-placement=\"right\" title=\"" + codGruppo + "\">" + codGruppo + "</div></div>" + toggleImpaginatoGruppo + "</div></li></ul>");
                    //$("#container_tracciato").append(gruppoHtml);

                    let inx_primo_del_gruppo = -1;
                    $("#container_tracciato").find(".record_menabo[codice_gruppo='" + codGruppo + "']").each(function () {
                        if (item.recordImpaginato != null) {
                            $(this).find("#onoff_impaginato").attr("disabled", true);
                        }
                        else if ($(this).find("#onoff_impaginato").is(':checked')) {
                            let gGruppoItem = gruppoHtml.find(".record_menabo_gruppo");
                            gGruppoItem.find("#onoff_impaginato").attr("disabled", true);
                        }
                        if (inx_primo_del_gruppo < 0) {
                            inx_primo_del_gruppo = $(".record_menabo").index($(this));
                            //console.log(inx_primo_del_gruppo);
                            gruppoHtml.insertBefore($(this));
                        }
                        gruppoHtml.append($(this));

                    });
                }

                let elementsGroup = this.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == codGruppo);
                if (this.agenzia.onRenderRefInListaMenabo != null) {
                    if (elementsGroup == null || elementsGroup.length == 0) {
                        console.log("hey");
                    }
                    this.agenzia.onRenderRefInListaMenabo(elementsGroup, item.recordInTracciato[keyScattoCodiceGruppo], this.areaTracciato);
                }
            }
            else {
                let recHtml = $($("#template").clone().html());
                recHtml.find("#codice_ref").text(item.recordInTracciato[keyRefCodice]);
                recHtml.find("#descr_ref").text(item.recordInTracciato[keyDescr1]);
                recHtml.attr("codice_gruppo", codGruppo);
                recHtml.attr("id_rec", item.idRec);

                if (item.recordImpaginato != null) {
                    //console.log("Check impagianto " + item.recordImpaginato.indice + " a Pag. " + item.recordImpaginato.idPaginaNavigation.numero);
                    recHtml.find("#onoff_impaginato").attr("checked", true);
                    //let pagItem = sender.pagineSource.find(f => f.id == item.recordImpaginato.idPagina);
                    recHtml.find("#lab_onoff_impaginato").text(item.recordImpaginato.indice + " a Pag. " + pagItem.numero);
                }


                if (item.ordered) {
                    recHtml.css("border-left", "10px solid #00ff7d");
                    recHtml.find("#addToOrdinamento").css("display", "none");
                }
                else {
                    recHtml.css("border-left", "10px solid rgb(255 0 0)");
                    if (!ordinamentoUniversale) {
                        recHtml.find("#addToOrdinamento").css("display", "none");
                    }
                }

                ultimaEtichetta = this.ApplicaSegnaposto(ultimaEtichetta, item);
                
                let gruppoGiaImpaginato = $("#container_tracciato").find(".groupItemListaTracciato[codice_gruppo='" + codGruppo + "']");
                if (gruppoGiaImpaginato.length > 0) {
                    gruppoGiaImpaginato.append(recHtml);
                    if (gruppoGiaImpaginato.find(".chImpaginatoGruppo").is(':checked')) {
                        recHtml.find("#onoff_impaginato").attr("disabled", true);
                    }
                }
                else {
                    $("#container_tracciato").append(recHtml);
                }
                let elementsGroup = this.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == codGruppo);
                if (item.recordInTracciato[keyRefCodice] != null && item.recordInTracciato[keyRefCodice] == 2164259) {
                    console.log("bug");
                }
                if (this.etichetteRefSource != null) {
                    ME.aggiungiEtichettaATracciato(elementsGroup, item.recordInTracciato[keyRefCodice]);
                }
                if (this.agenzia.onRenderRefInListaMenabo != null) {
                    if (elementsGroup == null || elementsGroup.length == 0) {
                        console.log("hey");
                    }
                    this.agenzia.onRenderRefInListaMenabo(elementsGroup, item.recordInTracciato[keyRefCodice], this.areaTracciato);
                }

                //$("#container_tracciato").append("<div class=\"row\" codice_gruppo=\"" + item.recordInTracciato[keyScattoCodiceGruppo] + "\"><div class=\"col\">" + item.recordInTracciato[keyRefCodice] + "</div></div>");
            }
        }

        hideLoading();
        attivaTolltips();

        $("#container_tracciato").find(".chImpaginato").on("click", function () {
            let rMenabo = $(this).closest(".record_menabo");
            //console.log("Inserisci nella pagina selezionata " + rMenabo.attr("codice_gruppo") + "," + rMenabo.attr("id_rec"));
            return ME.inMenabo($(this), rMenabo.attr("codice_gruppo"), rMenabo.attr("id_rec"));
        });


        $("#container_tracciato").find(".chImpaginatoGruppo").on("click", function () {
            let rMenabo = $(this).closest(".record_menabo_gruppo");
            //console.log("Inserisci nella pagina selezionata " + rMenabo.attr("codice_gruppo") + "," + rMenabo.attr("id_rec"));
            return ME.inMenabo($(this), rMenabo.attr("codice_gruppo"), null);

        });


        //if (this.agenzia.aggiungiDettagliARecordInTracciato != null) {
        //    this.agenzia.aggiungiDettagliARecordInTracciato();
        //}

        this.AttivaIconeTracciato();
        this.hideFotoIconTracciato();
        this.disattivaTarget();
        this.opacizzaRecordInTracciato();
        this.setTogglePoPTracciato();
        this.IndividuazioneErrori("");
        this.contaArticoliInTracciato();
        this.ContaRefPerSegnaposti();
        //this.ordinaRefInTracciato();
    }

    getDimensioneGriglia() {
        let currentPage = this.pagineSource.find(f => f.id == this.paginaSelected());
        let formato = currentPage.formato; //$("#cmb_formato_griglia").val();
        let wh = formato.split("x");
        let w = wh[0];
        let h = wh[1];
        return [w, h];
    }

    creaGriglia() {
        /*let formato = $("#cmb_formato_griglia").val();
        let wh = formato.split("x");
        let w = wh[0];
        let h = wh[1];*/
        let me = this;
        let dim = this.getDimensioneGriglia();
        let formato = this.pagineSource.find(f => f.id == this.paginaSelected()).formato;

        $("#griglia").html("");


        let hRow = (100 / dim[1]);//parseInt(hContainer * ((100 / h) / 100));
        let wCol = (100 / dim[0]);//parseInt(wContainer * ((100 / w) / 100));

        if (isNaN(hRow) || isNaN(wCol)) {
            hRow = 0;
            wCol = 0;
        }

        $(".maskFormato").remove();
        if (!me._listaFormati.includes(formato)) {
            let maskFormato = $("<div></div>").addClass("maskFormato").css({
                background: "rgba(255, 255, 0, 0.5)",
                position: "relative",
                transform: "translate(0%, -100%)",
                zIndex: "999",
                display: "block",
                width: "100%", // Larghezza desiderata
                height: "100%", // Altezza desiderata
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none"
            });

            $("#cmb_formato_griglia").parent().append(maskFormato);
        }

        let indiceBox = 1;
        for (let i = 0; i < dim[1]; i++) {
            let row = $("<div class=\"row\" style=\"height:" + hRow + "%\"></row>");
            for (let i2 = 0; i2 < dim[0]; i2++) {
                row.append("<div class=\"col boxMenabo overflow-auto\" style=\"width:" + wCol + "%; height:100%; border:2px solid #a5a1a1;position:relative;\" id=\"box_" + indiceBox + "\"><div class=\"container d-flex align-items-center\" style=\"height:100%; font-size:30px;\"><p class=\"text-center\" style=\"width:100%;color:#a5a1a1;\">" + indiceBox + "</p></div<</div>");
                // Crea l'elemento della maschera gialla semitrasparente con un'icona di warning centrale
                var mask = $("<div></div>").addClass("mask").css({
                    background: "rgba(255, 255, 0, 0.5)",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: "999",
                    display: "none",
                    width: "100%", // Larghezza desiderata
                    height: "100%", // Altezza desiderata
                    alignItems: "center",
                    justifyContent: "center"
                });

                // Crea l'elemento dell'icona di warning centrale utilizzando Bootstrap
                var icon = $("<i></i>").addClass("fas fa-exclamation-triangle").css({
                    fontSize: "50px",
                    color: "red",
                    cursor: "pointer"
                });

                // Aggiungi l'icona di warning all'elemento della maschera
                mask.append(icon);

                // Seleziona l'elemento specificato e aggiungi la maschera come figlio
                var box = row.find("#box_" + indiceBox);
                box.append(mask);
                icon.click(function () {
                    me.apriModalObsoletiWarning($(this));
                });
                indiceBox++;
            }

            $("#griglia").append(row);
        }

    }



    adattaGriglia() {
        if ($("#offcanvasTracciato").css("visibility") == "visible") {
            if (menaboInstance.adattataGriglia) {
                return;
            }
            let offsetGriglia = $("#griglia").offset();
            console.log($("#griglia").offset());


            let hWin = $(window).height();
            let wWin = $(window).width();

            //console.log("Offset griglia: ");
            //console.log($("#griglia").offset());
            let offset_x = 525 - ($("#griglia").offset().left - 50);

            $("#griglia").attr("style", "width:" + (wWin - (575 + 10)) + "px !important");



            $("#griglia").css("margin-left", offset_x + "px");
            $("#griglia").css("background-color", "rgb(228, 230, 235)");

            $("#griglia").height(hWin - (offsetGriglia.top + 10));
            //$('#txt').css('width', '100px !important');
            //$("#griglia").width(wWin - (550 + 10));
            //$("#griglia").attr("width", "!important");

            console.log((wWin - (550 + 10)) + "px !important");
            console.log($("#griglia").height());
            console.log($("#griglia").width());
            console.log($(window).width());


            let canvas = $("#myCanvas");
            canvas.attr("width", $(window).width());
            canvas.attr("height", $(window).height());

            $("#griglia").find(".multiplexSelection").each(function () {

                let _box = $(this).closest(".boxMenabo");
                $(this).css("top", _box.outerHeight() - $(this).outerHeight());
                $(this).css("left", _box.outerWidth() - $(this).outerWidth());
            });
            //console.log($('#box_1').hasScrollBar());
            menaboInstance.adattataGriglia = true;
        }
        else {
            $("#griglia").css("margin-left", "0px");
            $("#griglia").attr("style", "");
            $("#griglia").css("background-color", "rgb(228, 230, 235)");
            let offsetGriglia = $("#griglia").offset();
            //let wWin = $(window).width();
            let hWin = $(window).height();

            //$("#griglia").width();// wWin - (offsetGriglia.left * 2));
            $("#griglia").height(hWin - (offsetGriglia.top + 10));

            let hRow = $("#griglia").find(".row").height();
            let wRow = $("#griglia").find(".row").width();
            let rowCount = $('#griglia > .row').length;

            let rapporto = (wRow / hRow);
            if (rapporto > 1.5) {
                //console.log("Check 1 " + (wRow / hRow));

                let nuova_altezza = wRow / 1.75;
                console.log("NUOVA ALTEZZA " + nuova_altezza);
                $("#griglia").height(nuova_altezza);
                /*
                if ((wRow / hRow) >= 11) {
                    $("#griglia").height(rowCount * 170);
                }
                console.log("Check 2 " + ((wRow / hRow) / rowCount));
                if ((wRow / hRow) / rowCount <= 2.2) {
                    $("#griglia").height(rowCount * 170);
                }
                */
            }

            $("#griglia").find(".multiplexSelection").each(function () {

                let _box = $(this).closest(".boxMenabo");
                
                $(this).css("top", _box.outerHeight() - $(this).outerHeight());
                $(this).css("left", _box.outerWidth() - $(this).outerWidth());
                if (_box.hasScrollBar()) {
                    $(this).css("top", $(this).position().top - 8 + "px");
                    $(this).css("left", $(this).position().left - 5 + "px");
                }
            });
            //console.log($('#box_1').hasScrollBar());
            menaboInstance.adattataGriglia = false;

        }
    }

    paginaSelected() {
        return $("#cmb_pags").val();
    }

    selezionataPagina() {
        let me = this;
        if (this.paginaSelected() != this.pagSelected) {
            $('#spostaPaginaIcon').css('display', 'none');
            $('#goToButton').find("img").attr("src", "images/goTo.png");
        }
        this.AttivaIconeTracciato();
        this.disattivaTarget();
        this.opacizzaRecordInTracciato();
        let curr = this.paginaSelected();
        console.log(curr);

        if (curr > 0) {
            this.showAlert("warning", "La visualizzazione pagine è attualmente disabilitata", 5);
            return;
            //Cerco nel bind
            let pagItem = this.pagineSource.find(f => f.id == curr);
            $("#cmb_mastro").val(pagItem.idMastro);
            $("#cmb_formato_griglia").val(pagItem.formato);
            this.creaGriglia();

            if (curr > 0) {
                this.pagSelected = curr;
            }

            //Impagino le ref
            //console.log(pagItem.menaboRefs);
            //let template = $("#templateBox").clone();
            for (let i = 0; i < pagItem.menaboRefs.length; i++) {
                let item = pagItem.menaboRefs[i];
                $("#box_" + item.indice).html("");

                var mask = $("<div></div>").addClass("mask").css({
                    background: "rgba(255, 255, 0, 0.5)",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: "999",
                    display: "none",
                    width: "100%", // Larghezza desiderata
                    height: "100%", // Altezza desiderata
                    alignItems: "center",
                    justifyContent: "center"
                });

                // Crea l'elemento dell'icona di warning centrale utilizzando Bootstrap
                var icon = $("<i></i>").addClass("fas fa-exclamation-triangle").css({
                    fontSize: "50px",
                    color: "red",
                    cursor: "pointer"
                });

                // Aggiungi l'icona di warning all'elemento della maschera
                mask.append(icon);

                $("#box_" + item.indice).append(mask);

                icon.click(function () {
                    me.apriModalObsoletiWarning($(this));
                });
            }

            for (let i = 0; i < pagItem.menaboRefs.length; i++) {
                let item = pagItem.menaboRefs[i];
                this.renderBoxInMenabo(item);
                /*
                let htmlBox = $(template.html());

                let codice = "";
                let descr = "";
                if (item.idRecord > 0) {
                    let obj = this.tracciatoSource.find(f => f.idRec == item.idRecord);
                    console.log(obj);
                    codice = obj.recordInTracciato[keyRefCodice];
                    descr = obj.recordInTracciato[keyDescr1];
                }
                else {
                    let obj = this.tracciatoSource.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
                    codice = obj.recordInTracciato[keyScattoCodiceGruppo];
                    descr = obj.recordInTracciato[keyDescr1];
                    if (descr == null) {
                        descr = "<i>Non definita</i>";
                    }
                }

                htmlBox.find("#boxTitle").text(codice);
                htmlBox.find("#boxDescr").text(descr);
                
                $("#box_" + item.indice).append(htmlBox);
                //htmlBox.height($("#box_" + item.indice).height());
                htmlBox.css("height", "100%");
                */
            }

            let mastroPag = me.mastroSource.find(f => f.id == pagItem.idMastro);
            if (!mastroPag.active) {
                $(".maskMastro").remove();

                $("#consultaTracciato").prop("disabled", true);
                $("#offcanvasTracciato").css("visibility", "hidden");
                $("#offcanvasTracciato").removeClass("show");
                var overlay = $("<div>").addClass("row maskMastro")
                    .css({
                        "background": "rgba(255, 255, 0, 0.5)",
                        "position": "relative",
                        "transform": "translate(0%, -100%)",
                        "z-index": "999",
                        "display": "block",
                        "height": "100%",
                        "align-items": "center",
                        "justify-content": "center"
                    });

                var overlayCmb = $("<div>").addClass("maskMastro")
                    .css({
                        "background": "rgba(255, 255, 0, 0.5)",
                        "position": "relative",
                        "transform": "translate(0%, -100%)",
                        "z-index": "999",
                        "display": "block",
                        "height": "100%",
                        "align-items": "center",
                        "justify-content": "center"
                    });

                $("#griglia").append(overlay);
                $("#cmb_formato_griglia").parent().append(overlayCmb);

                // Animazione lampeggiante
                overlay.fadeOut(500).fadeIn(500);
            }
            else {
                $("#consultaTracciato").prop("disabled", false);
                $(".maskMastro").remove();
            }
        }
        else {

            //Caso
            //0 - Creo pagina progressiva
            //-1 - Creo pagine da schema
            this.salvaPagina();


        }
        this.applyIconToMultiplexWithSelectionError();
        this.BloccaCaselleOccupate();
        this.adattaGriglia();

        if ($('#goToButton').find("img").attr("src") === "images/selectedGoTo.png") {
            this.ToggleMandaAPaginaButton();
        }

        let spostaPaginaIcon = $("#spostaPaginaIcon");
        let griglia = $("#griglia");

        let nuovaX = -spostaPaginaIcon.width();
        let nuovaY = griglia.offset().top - spostaPaginaIcon.height();

        spostaPaginaIcon.css({
            left: 0 + "px",
            top: nuovaY + "px"
        });

    }

    selezionataMastro() {
        let me = this;
        let page = this.pagineSource.find(f => f.id == this.pagSelected);
        let nuovoFormato = me.mastroSource.find(f => f.id == $("#cmb_mastro").val()).formato;
        let response = false;
        for (var i = 0; i < page.menaboRefs.length; i++) {
            if (!response) {
                let result = me.geometraInstance.CalcolaSpazi(nuovoFormato, page.menaboRefs[i].indice, me.meccanicheDb[page.menaboRefs[i].formato], false);
                if (!result.result) {
                    response = confirm($("#cmb_mastro option:selected").text() + " richiede il formato " + nuovoFormato + " ma lo spazio richiesto dagli impaginati è maggiore. Procedere a modificare la mastro senza modificare il formato?");
                    if (!response) {
                        $("#cmb_mastro").val(me.pagineSource[me.pagineSource.findIndex(f => f.id == me.pagSelected)].idMastro);
                        return;
                    }
                }

            }
        }
        if (!response) {
            $("#cmb_formato_griglia").val(nuovoFormato);
        }
        this.salvaPagina();
    }

    selezionatoFormato() {
        let me = this;
        let page = this.pagineSource.find(f => f.id == this.pagSelected);
        //let pageIndex = this.pagineSource.findIndex(f => f.id == this.pagSelected);
        let nuovoFormato = $("#cmb_formato_griglia").val();
        for (var i = 0; i < page.menaboRefs.length; i++) {
            let result = me.geometraInstance.CalcolaSpazi(nuovoFormato, page.menaboRefs[i].indice, me.meccanicheDb[page.menaboRefs[i].formato]);
            if (!result.result) {
                $("#cmb_formato_griglia").val(page.formato);
                return;
            }
        }
        this.salvaPagina();

        //this.pagineSource[pageIndex].formato = nuovoFormato;
        //this.creaGriglia();
        //this.selezionataPagina();

    }

    salvaPagina() {
        let curr = this.paginaSelected();
        let me = this;
        if (curr == -2) {
            return;
        }

        showLoading();

        Call.do("Menabo", "salvaPagina/" + this.idTracciato + "/" + curr + "/" + $("#cmb_mastro").val() + "/" + $("#cmb_formato_griglia").val(), "GET", null, this, function (result, sender) {
            console.log(result)
            console.log(result)
            if (result.error == null) {
                if (result.id > 0) {
                    //E' stata creata una pagina singola
                    sender.pagineSource.push(result);

                    console.log("Aggiunta pagina " + result.numero);
                    console.log(sender.pagineSource);

                    $("#cmb_pags").append("<option  value=\"" + result.id + "\" selected>Pag. " + result.numero + "</option>");
                    $("#cmb_mastro").val(result.idMastro);
                    $("#cmb_formato_griglia").val(result.formato);

                    sender.creaGriglia();
                    sender.pagSelected = result.id;

                }
                else {
                    //Ok ho creato lo schema.
                    //Popolo la tendina e seleziono la prima pagina
                    sender.pagineSource = result;
                    sender.bindPagine();

                    mostraMessaggio("Pagine generate con successo", "success");
                }
            }
            else {
                if (result.error == "") {
                    //Ok ho salvato una pagina esistente
                    let pagItem = sender.pagineSource.find(f => f.id == curr);
                    console.log("Sovrascrivo pag");
                    console.log(pagItem);
                    //Sovrascrivo oggetto scaricato
                    pagItem.idMastro = $("#cmb_mastro").val();
                    pagItem.formato = $("#cmb_formato_griglia").val();
                }
                else {
                    //Mostro errore
                    console.warn("Error: " + result.error);
                    mostraMessaggio(result.error, "danger");
                }
            }
            hideLoading();

            if (result.esito) {
                me.pagineSource[me.pagineSource.findIndex(f => f.id == me.pagSelected)].formato = $("#cmb_formato_griglia").val();
                me.creaGriglia();
                me.selezionataPagina();
            }
            else {
                $("#cmb_formato_griglia").val(me.pagineSource[me.pagineSource.findIndex(f => f.id == me.pagSelected)].formato);
                me.creaGriglia();
                me.selezionataPagina();
            }
        });
    }

    inMenabo(sender, codice_gruppo, id_rec, indice = 0) {

        let currPag = this.paginaSelected();
        let me = this;

        let onoff = sender.is(':checked');
        console.log(onoff);
        if (onoff && currPag <= 0) {

            alert("Selezionare una pagina per poter aggiungere a menabo");
            sender.removeAttr("checked");

            return false;
        }

        if (!onoff && id_rec != null) {
            sender.closest(".record_menabo").find(".targetImg").css("display", "inline");
        }
        else {
            sender.closest(".record_menabo_gruppo").find(".targetImgGrp").css("display", "inline");
        }

        showLoading();

        let obj = { idRecord: 0, codiceGruppo: codice_gruppo, idPagina: currPag };

        let recInTracciato = null;

        if (id_rec != null) {
            //Singolo
            obj.idRecord = id_rec

            recInTracciato = this.tracciatoSource.find(f => f.idRec == id_rec);
            console.log("Cercato rec singolo id " + id_rec);
            console.log(recInTracciato);
        }
        else {
            recInTracciato = this.tracciatoSource.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == codice_gruppo && f.isGruppo);
            console.log("Cercato gruppo codice " + codice_gruppo);
            console.log(recInTracciato);
        }
        //console.log("Invio tutta la pag");
        //console.log(obj);
        if (this.declinazioneMeccanicheSource != null && this.etichetteRefSource != null) {
            Call.do("Menabo", "inMenaboNew/" + onoff + "/" + indice + "/" + this.idTracciato + "/" + this.areaTracciato, "PUT", obj, this, function (result, me) {
                console.log(result);
                if (onoff) {
                    //Inserimento
                    if (result.esito == null) {

                        sender.parent().find("#lab_onoff_impaginato").text(result.ref.indice + " a Pag. " + result.ref.idPaginaNavigation.numero);
                        let pagItem = me.pagineSource.find(f => f.id == result.ref.idPagina);
                        pagItem.menaboRefs.push(result.ref);

                        recInTracciato.recordImpaginato = result.ref;
                        recInTracciato.allEtichette = result.allEtichette;
                        recInTracciato.etichetteVisual = result.etichetteVisual;
                        //Inserisco fisicamente il box nella pagina corrente
                        me.renderBoxInMenabo(result.ref);

                        if (obj.idRecord) {
                            //Se è in un gruppo, disabilito check inserimento del gruppo
                            sender.closest("ul").find(".record_menabo_gruppo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });

                            if (sender.closest("ul").find(".record_menabo_gruppo").length > 0 && $("#switchNascondiImpaginati").prop("checked")) {
                                let allChecked = true;
                                sender.closest("ul").find(".record_menabo").each(function () {
                                    if (allChecked) {
                                        allChecked = $(this).find("#onoff_impaginato").prop("checked");
                                    }
                                });
                                if (allChecked) {
                                    sender.closest("ul").css("display", "none");
                                    me.contaArticoliInTracciato();
                                    me.ContaRefPerSegnaposti();
                                }
                            }
                            else if ($("#switchNascondiImpaginati").prop("checked")) {
                                sender.closest(".record_menabo").css("display", "none");
                                me.contaArticoliInTracciato();
                                me.ContaRefPerSegnaposti();
                            }
                        }
                        else {
                            //Disabilito il check inserimento di tutte le ref figlie
                            sender.closest("ul").find(".record_menabo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });

                            if ($("#switchNascondiImpaginati").prop("checked")) {
                                sender.closest("ul").css("display", "none");
                                me.contaArticoliInTracciato();
                                me.ContaRefPerSegnaposti();
                            }
                        }

                        if (result.codiceMultiplexAggiunto != null /*|| result.codiceMultiplexAggiunto != ""*/) {

                            //aggiorno i codici multiplex
                            result.codiciRefdaAggiungere.forEach(function (item) {
                                if (item.indexOf(',') == -1) {
                                    let element = me.tracciatoSource.find(f => f.idRec == item);
                                    element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                }
                                else {
                                    let elements = item.split(",");
                                    elements.forEach(function (item2) {
                                        let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                        singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                    });
                                }
                            });
                        }

                        //let meccanicaObj = me.CalcolaMeccanica(recInTracciato);
                        //console.log(meccanicaObj);
                        //if (meccanicaObj != null && meccanicaObj.meccanicaName != "") {
                        //    if (me.agenzia.modifyMeccanica != null) {
                        //        let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
                        //        let record = (recInTracciato.isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == recInTracciato.recordInTracciato[keyScattoCodiceGruppo]) : recInTracciato);
                        //        meccanicaObj.meccanicaName = me.agenzia.modifyMeccanica(currPage, record, meccanicaObj);
                        //    }
                        //}
                        //let formatoCombinazione = me.CheckForExceptionFormat(meccanicaObj.meccanicaName);
                        //if (formatoCombinazione != null) {
                        //    meccanicaObj.formatoRichiesto = formatoCombinazione;
                        //}
                        //me.checkSpazioMeccanicaRichiestaNew(meccanicaObj, result.ref, result.ref.idPagina);
                        //if (me.agenzia.getMeccanicaCustom != null) {
                        //    let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
                        //    let record = (recInTracciato.isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == recInTracciato.recordInTracciato[keyScattoCodiceGruppo]) : recInTracciato);
                        //    let resultMeccanica = me.agenzia.getMeccanicaCustom(currPage.idMastro, record).meccanicaRequired;
                        //    if (resultMeccanica != null && resultMeccanica != "") {
                        //        me.checkSpazioMeccanicaRichiesta(resultMeccanica, result.ref, result.ref.idPagina);
                        //    }
                        //}
                    }
                    else if (result.esito == false) {
                        mostraMessaggio(result.error, "danger");
                        if (onoff) {
                            sender.parent().find("#lab_onoff_impaginato").text("");
                            sender.prop("checked", false);
                        }
                    }

                }
                else {
                    //Leggo esito
                    if (result.esito == null) {
                        if (recInTracciato.recordImpaginato.idPagina == currPag) {
                            //Lo riumovo in diretta
                            $("#box_" + recInTracciato.recordImpaginato.indice).html("");
                        }

                        let index = me.pagineSource.find(f => f.id == recInTracciato.recordImpaginato.idPagina).menaboRefs.findIndex(f => f.id == result.ref.id);
                        if (index !== -1) {
                            me.pagineSource.find(f => f.id == recInTracciato.recordImpaginato.idPagina).menaboRefs.splice(index, 1);
                        }


                        recInTracciato.recordImpaginato = null;

                        if (obj.idRecord > 0) {
                            //Se è all'interno di un gruppo, riabilito check inserimento del gruppo

                            let all_no_placed = true;
                            sender.closest("ul").find(".record_menabo").each(function () {
                                if ($(this).find("#onoff_impaginato").is(":checked")) {
                                    all_no_placed = false;
                                }
                            });

                            if (all_no_placed) {
                                let gGruppoItem = sender.closest("ul").find(".record_menabo_gruppo");
                                gGruppoItem.find("#onoff_impaginato").attr("disabled", false);
                                console.log(gGruppoItem);
                                gGruppoItem.find(".targetImgGrp").css("display", "inline");
                            }

                        }
                        else {
                            //Riabilito il check inserimento di tutte le ref figlie
                            sender.closest("ul").find(".record_menabo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", false);
                                console.log($(this));
                                $(this).find(".targetImg").css("display", "inline");
                            });
                        }


                        sender.parent().find("#lab_onoff_impaginato").text("");

                        //aggiorno i codici multiplex
                        if (result.codiceMultiplexRimossi != null) {

                            console.log(result.ref.idRecord);
                            console.log(result.ref.codiceGruppo);
                            console.log(me.tracciatoSource.find(f => (result.ref.idRecord != null ? f.idRec == result.ref.idRecord : (f.isGruppo == true && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == result.ref.codiceGruppo))));
                            let elementToRemoveMultiplex = me.tracciatoSource.find(f => (result.ref.idRecord != null ? f.idRec == result.ref.idRecord : (f.isGruppo == true && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == result.ref.codiceGruppo)));
                            if (elementToRemoveMultiplex.isGruppo) {
                                let elementsToRemove = me.tracciatoSource.filter(f => f.isGruppo == false && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == elementToRemoveMultiplex.recordInTracciato[keyScattoCodiceGruppo]);
                                elementsToRemove.forEach(function (item) {
                                    delete item.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                });
                            }
                            else {
                                delete elementToRemoveMultiplex.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                            }


                            result.codiciRefdaRimuovere.forEach(function (item) {
                                if (item.indexOf(',') == -1) {
                                    let element = me.tracciatoSource.find(f => f.idRec == item);
                                    if (result.codiceMultiplexRimossi != "") {
                                        element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                    }
                                    else {
                                        delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                    }

                                }
                                else {
                                    let elements = item.split(",");
                                    elements.forEach(function (item2) {
                                        let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);

                                        if (result.codiceMultiplexRimossi != "") {
                                            singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                        }
                                        else {
                                            delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                        }
                                    });
                                }
                            });
                        }

                    }
                    else {
                        mostraMessaggio(result.error, "danger");
                        if (onoff) {
                            sender.parent().find("#lab_onoff_impaginato").text("");
                            console.log("Devo togliere la spunta");
                            sender.prop("checked", false);
                        }
                    }
                }

                me.selezionataPagina();
                hideLoading();
            });
        }
        else {
            Call.do("Menabo", "inMenabo/" + onoff + "/" + indice + "/" + this.idTracciato + "/" + this.areaTracciato, "PUT", obj, this, function (result, me) {
                console.log(result);
                if (onoff) {
                    //Inserimento
                    if (result.esito == null) {

                        sender.parent().find("#lab_onoff_impaginato").text(result.ref.indice + " a Pag. " + result.ref.idPaginaNavigation.numero);
                        let pagItem = me.pagineSource.find(f => f.id == result.ref.idPagina);
                        pagItem.menaboRefs.push(result.ref);

                        recInTracciato.recordImpaginato = result.ref;

                        //Inserisco fisicamente il box nella pagina corrente
                        me.renderBoxInMenabo(result.ref);

                        if (obj.idRecord) {
                            //Se è in un gruppo, disabilito check inserimento del gruppo
                            sender.closest("ul").find(".record_menabo_gruppo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });

                            if (sender.closest("ul").find(".record_menabo_gruppo").length > 0 && $("#switchNascondiImpaginati").prop("checked")) {
                                let allChecked = true;
                                sender.closest("ul").find(".record_menabo").each(function () {
                                    if (allChecked) {
                                        allChecked = $(this).find("#onoff_impaginato").prop("checked");
                                    }
                                });
                                if (allChecked) {
                                    sender.closest("ul").css("display", "none");
                                    me.contaArticoliInTracciato();
                                    me.ContaRefPerSegnaposti();
                                }
                            }
                            else if ($("#switchNascondiImpaginati").prop("checked")) {
                                sender.closest(".record_menabo").css("display", "none");
                                me.contaArticoliInTracciato();
                                me.ContaRefPerSegnaposti();
                            }
                        }
                        else {
                            //Disabilito il check inserimento di tutte le ref figlie
                            sender.closest("ul").find(".record_menabo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });

                            if ($("#switchNascondiImpaginati").prop("checked")) {
                                sender.closest("ul").css("display", "none");
                                me.contaArticoliInTracciato();
                                me.ContaRefPerSegnaposti();
                            }
                        }

                        if (result.codiceMultiplexAggiunto != null /*|| result.codiceMultiplexAggiunto != ""*/) {

                            //aggiorno i codici multiplex
                            result.codiciRefdaAggiungere.forEach(function (item) {
                                if (item.indexOf(',') == -1) {
                                    let element = me.tracciatoSource.find(f => f.idRec == item);
                                    element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                }
                                else {
                                    let elements = item.split(",");
                                    elements.forEach(function (item2) {
                                        let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                        singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                    });
                                }
                            });
                        }

                        if (me.agenzia.getMeccanicaCustom != null) {
                            let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
                            let record = (recInTracciato.isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == recInTracciato.recordInTracciato[keyScattoCodiceGruppo]) : recInTracciato);
                            let resultMeccanica = me.agenzia.getMeccanicaCustom(currPage.idMastro, record).meccanicaRequired;
                            if (resultMeccanica != null && resultMeccanica != "") {
                                me.checkSpazioMeccanicaRichiesta(resultMeccanica, result.ref, result.ref.idPagina);
                            }
                        }
                    }
                    else if (result.esito == false) {
                        mostraMessaggio(result.error, "danger");
                        if (onoff) {
                            sender.parent().find("#lab_onoff_impaginato").text("");
                            console.log("Devo togliere la spunta");
                            sender.prop("checked", false);
                        }
                    }

                }
                else {
                    //Leggo esito
                    if (result.esito == null) {
                        if (recInTracciato.recordImpaginato.idPagina == currPag) {
                            //Lo riumovo in diretta
                            $("#box_" + recInTracciato.recordImpaginato.indice).html("");
                        }

                        let index = me.pagineSource.find(f => f.id == recInTracciato.recordImpaginato.idPagina).menaboRefs.findIndex(f => f.id == result.ref.id);
                        if (index !== -1) {
                            me.pagineSource.find(f => f.id == recInTracciato.recordImpaginato.idPagina).menaboRefs.splice(index, 1);
                        }


                        recInTracciato.recordImpaginato = null;

                        if (obj.idRecord > 0) {
                            //Se è all'interno di un gruppo, riabilito check inserimento del gruppo

                            let all_no_placed = true;
                            sender.closest("ul").find(".record_menabo").each(function () {
                                if ($(this).find("#onoff_impaginato").is(":checked")) {
                                    all_no_placed = false;
                                }
                            });

                            if (all_no_placed) {
                                let gGruppoItem = sender.closest("ul").find(".record_menabo_gruppo");
                                gGruppoItem.find("#onoff_impaginato").attr("disabled", false);
                                console.log(gGruppoItem);
                                gGruppoItem.find(".targetImgGrp").css("display", "inline");
                            }

                        }
                        else {
                            //Riabilito il check inserimento di tutte le ref figlie
                            sender.closest("ul").find(".record_menabo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", false);
                                console.log($(this));
                                $(this).find(".targetImg").css("display", "inline");
                            });
                        }


                        sender.parent().find("#lab_onoff_impaginato").text("");

                        //aggiorno i codici multiplex
                        if (result.codiceMultiplexRimossi != null) {

                            console.log(result.ref.idRecord);
                            console.log(result.ref.codiceGruppo);
                            console.log(me.tracciatoSource.find(f => (result.ref.idRecord != null ? f.idRec == result.ref.idRecord : (f.isGruppo == true && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == result.ref.codiceGruppo))));
                            let elementToRemoveMultiplex = me.tracciatoSource.find(f => (result.ref.idRecord != null ? f.idRec == result.ref.idRecord : (f.isGruppo == true && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == result.ref.codiceGruppo)));
                            if (elementToRemoveMultiplex.isGruppo) {
                                let elementsToRemove = me.tracciatoSource.filter(f => f.isGruppo == false && f.recordInTracciato != null && f.recordInTracciato[keyScattoCodiceGruppo] != null && f.recordInTracciato[keyScattoCodiceGruppo] == elementToRemoveMultiplex.recordInTracciato[keyScattoCodiceGruppo]);
                                elementsToRemove.forEach(function (item) {
                                    delete item.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                });
                            }
                            else {
                                delete elementToRemoveMultiplex.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                            }


                            result.codiciRefdaRimuovere.forEach(function (item) {
                                if (item.indexOf(',') == -1) {
                                    let element = me.tracciatoSource.find(f => f.idRec == item);
                                    if (result.codiceMultiplexRimossi != "") {
                                        element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                    }
                                    else {
                                        delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                    }

                                }
                                else {
                                    let elements = item.split(",");
                                    elements.forEach(function (item2) {
                                        let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);

                                        if (result.codiceMultiplexRimossi != "") {
                                            singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                        }
                                        else {
                                            delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                        }
                                    });
                                }
                            });
                        }

                    }
                    else {
                        mostraMessaggio(result.error, "danger");
                        if (onoff) {
                            sender.parent().find("#lab_onoff_impaginato").text("");
                            console.log("Devo togliere la spunta");
                            sender.prop("checked", false);
                        }
                    }
                }

                me.selezionataPagina();
                hideLoading();
            });
        }
        console.log(obj);
        return true;
    }

    CheckForExceptionFormat(nomeMeccanica) {
        let combinazione = this.declinazioneMeccanicheCombinazioni.find(f => f.NomeCombinazione == nomeMeccanica);
        if (combinazione != null) {
            return combinazione.Formato;
        } else {
            return null;
        }
    }

    CalcolaMeccanica(record) {      
        let me = this;
        let codice = "";
        if (record.isGruppo) {
            codice = record.recordInTracciato[keyScattoCodiceGruppo];
            record = this.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == record.recordInTracciato[keyScattoCodiceGruppo])
        }
        else {
            codice = record.recordInTracciato[keyRefCodice];
        }
        

        const groupedByLevel = this.declinazioneMeccanicheSource.reduce((acc, obj) => {
            const { Livello, ...rest } = obj;
            if (!acc[Livello]) {
                acc[Livello] = []; // Se non esiste ancora un array per questo livello, crealo
            }
            acc[Livello].push(rest); // Aggiungi l'oggetto all'array corrispondente al livello
            return acc;
        }, {});

        let listLivelli = {};


        // Cicla su ogni livello e sui relativi oggetti
        for (const level in groupedByLevel) {
            console.log(`Livello ${level}:`);
            let objMeccAndDef = {
                Meccaniche : [],
                DefaultMeccaniche : [],
                Formato : "",
            }
            groupedByLevel[level].forEach(obj => {
                if (obj.Regole != null) {
                    obj.Regole.forEach(setRegole => {
                        let setValido = true;
                        setRegole.forEach(regola => {
                            if (!((regola.presente && record.allEtichette.includes(regola.nomeEtichetta)) || (!regola.presente && !record.allEtichette.includes(regola.nomeEtichetta)))) {
                                setValido = false;
                            }
                        });
                        if (setValido) {
                            objMeccAndDef.Meccaniche.push(obj); 
                            if (obj.formato != null && obj.formato != "") {
                                objMeccAndDef.Formato = obj.formato;
                            }
                        }
                    });
                }
                else {
                    objMeccAndDef.DefaultMeccaniche.push(obj);
                }
            });
            listLivelli[level] = objMeccAndDef;
        }
        let meccanicaObj = {
            meccanicaName: "",
            listLivelliPresenti: [],
            formatoRichiesto: "1x1",
        }

        for (var livello in listLivelli) {
            console.log(listLivelli[livello]);
            if (listLivelli[livello].Meccaniche.length > 0 || listLivelli[livello].DefaultMeccaniche.length > 0) {
                if (listLivelli[livello].Meccaniche.length > 0) {
                    if (listLivelli[livello].Meccaniche.length > 1) {
                        let meccanicheAvanzate = "";
                        for (let i = 1; i < listLivelli[livello].Meccaniche.length; i++) {
                            meccanicheAvanzate += listLivelli[livello].Meccaniche[i] + ",";
                        }
                        meccanicheAvanzate = meccanicheAvanzate.substring(0, meccanicheAvanzate.length - 1);
                        me.showAlert("warning", "Il record " + codice.substring(0, 10) + " appena inserito ha meccaniche multiple valide al livello " + livello + ". " + "È stata assegnata la meccanica" + listLivelli[livello].Meccaniche[0] + "ma erano valide anche le meccaniche: " + meccanicheAvanzate);
                    }
                    meccanicaObj.meccanicaName += listLivelli[livello].Meccaniche[0].Nome + "_";
                    if (listLivelli[livello].Formato != "") {
                        meccanicaObj.formatoRichiesto = listLivelli[livello].Formato;
                    }
                } else {
                    if (listLivelli[livello].DefaultMeccaniche.length > 1) {
                        let meccanicheAvanzate = "";
                        for (let i = 1; i < listLivelli[livello].DefaultMeccaniche.length; i++) {
                            meccanicheAvanzate += listLivelli[livello].DefaultMeccaniche[i] + ",";
                        }
                        meccanicheAvanzate = meccanicheAvanzate.substring(0, meccanicheAvanzate.length - 1);
                        me.showAlert("warning", "Il record " + codice.substring(0, 10) + " appena inserito ha meccaniche multiple valide al livello " + livello + ". " + "È stata assegnata la meccanica di default" + listLivelli[livello].DefaultMeccaniche[0] + "ma erano presenti anche altre meccaniche di default: " + meccanicheAvanzate);
                    }
                    meccanicaObj.meccanicaName += listLivelli[livello].DefaultMeccaniche[0].Nome + "_";
                    if (listLivelli[livello].Formato != "") {
                        meccanicaObj.formatoRichiesto = listLivelli[livello].Formato;
                    }
                }
                meccanicaObj.listLivelliPresenti.push(livello);
            }
        }
        meccanicaObj.meccanicaName = meccanicaObj.meccanicaName.substring(0, meccanicaObj.meccanicaName.length - 1);
        console.log(meccanicaObj);
        return meccanicaObj;
    }

    renderBoxInMenabo(item) {
        let template = $("#templateBox").clone();

        let htmlBox = $(template.html());

        let codice = "";
        let descr = "";
        let revisionato = false;
        let incongruenzaFirma = false;
        let formato = "1x1";
        let codice_foto_in_vista = "";
        let formatoObsoleto = false;
        console.log(htmlBox);
        //let _container = $(htmlBox[4]);
        let _container = htmlBox.find(".refInMenabo");

        let obsoleto = false;
        if (item.idRecord > 0) {
            let obj = this.tracciatoSource.find(f => f.idRec == item.idRecord);
            if (obj == null) {
                obj = this.tracciatoSourceObsoleti.find(f => f.idRec == item.idRecord);
                if (obj != null) {
                    obsoleto = true;
                }
                else {
                    obsoleto = true;
                    console.error("dato mancante");
                }
            }
            let res = this.agenzia.compilaBoxAgenzia(item)//, function (result) {
            if (res != null) {
                _container = res[0];
                htmlBox = res[1];
            }      
            else {

                let template = $("#templateBox").clone();
                let htmlBox = $(template.html());
                let cod = "";
                let descr = "";

                //_container = htmlBox.find(".refInMenabo");
                let objTrac = menaboInstance.tracciatoSource.find(f => f.idRec == item.idRecord);
                if (objTrac == null) {
                    objTrac = menaboInstance.tracciatoSourceObsoleti.find(f => f.idRec == item.idRecord);
                }
                cod = objTrac.recordInTracciato[keyRefCodice];
                if (objTrac.recordRevisionato != null) {
                    let parametri_visualizzati_revisionato_menabo = ["descrizione1"];
                    for (var i = 0; i < parametri_visualizzati_revisionato_menabo.length; i++) {
                        if (objTrac.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]] != null && obj.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]] != "") {
                            if (descr != "") {
                                descr += "\n";
                            }
                            descr += objTrac.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]];
                        }
                    }
                }
                if (descr == "") {
                    let parametri_visualizzati_tracciato_menabo = [keyDescr1];
                    for (var i = 0; i < parametri_visualizzati_tracciato_menabo.length; i++) {
                        if (obj.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]] != null && obj.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]] != "") {
                            if (descr != "") {
                                descr += "\n";
                            }
                            descr += obj.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]];
                        }
                    }
                }
                _container.find("#boxTitle").text(cod);
                _container.find("#boxDescr").html(descr);

            }
            codice = obj.recordInTracciato[keyRefCodice];

            let firmaTracciato = obj.recordInTracciato[keyTracciatoFirma];
            if (obj.recordRevisionato != null) {
                if (obj.recordRevisionato.firmaTracciato != null && obj.recordRevisionato.firmaTracciato == firmaTracciato) {
                    revisionato = true;
                }
                else if (obj.recordRevisionato.firmaTracciato != null){
                    incongruenzaFirma = true;
                }
                //descr = obj.recordrevisionato.descrizione1;
            }

            _container.attr("id_rec", obj.idRec);
            codice_foto_in_vista = codice;
        }
        else {
            let obj_gruppo = this.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == null && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
            if (obj_gruppo == null) {
                obj_gruppo = this.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == null && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
                if (obj_gruppo != null) {
                    obsoleto = true;
                }
                else {
                    obsoleto = true;
                    console.warn("dato mancante");
                }
            }
            if (obj_gruppo != null) {
                
                let res = this.agenzia.compilaBoxAgenzia(item)//, function (result) {
                if (res != null) {
                    _container = res[0];
                    htmlBox = res[1];
                }                
                else {
                    let cod = "";
                    if (obj_gruppo != null) {
                        cod = obj_gruppo.recordInTracciato[keyScattoCodiceGruppo];
                        if (obj_gruppo.recordRevisionato != null) {
                            let parametri_visualizzati_revisionato_menabo = ["descrizione1"];
                            for (var i = 0; i < parametri_visualizzati_revisionato_menabo.length; i++) {
                                console.log(obj_gruppo.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]]);
                                console.log(obj_gruppo.recordRevisionato);
                                console.log(parametri_visualizzati_revisionato_menabo[i]);
                                if (obj_gruppo.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]] != null && obj_gruppo.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]] != "") {
                                    if (descr != "") {
                                        descr += "\n";
                                    }
                                    descr += obj_gruppo.recordRevisionato[parametri_visualizzati_revisionato_menabo[i]];
                                }
                            }                            
                        }
                        if (descr == "") {
                            let parametri_visualizzati_tracciato_menabo = [keyDescr1];
                            for (var i = 0; i < parametri_visualizzati_tracciato_menabo.length; i++) {
                                if (obj_gruppo.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]] != null && obj.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]] != "") {
                                    if (descr != "") {
                                        descr += "\n";
                                    }
                                    descr += obj_gruppo.recordInTracciato[parametri_visualizzati_tracciato_menabo[i]];
                                }
                            }
                        }
                        if (descr == null) {
                            descr = "<i>Non definita</i>";
                        }
                    }

                    _container.find("#boxTitle").text(cod);
                    _container.find("#boxDescr").html(descr);
                }

                //Il gruppo manco viene trovato nel tracciato per cui non è stato revisionato in alcun modo
                revisionato = false;
                let firmaTracciato = obj_gruppo.recordInTracciato[keyTracciatoFirma];
                if (obj_gruppo.recordRevisionato != null) {
                    if (firmaTracciato == null || obj_gruppo.recordRevisionato.firmaTracciato == firmaTracciato) {
                        revisionato = true;
                    }
                    //descr = obj_gruppo.recordRevisionato.descrizione1;
                }

                //Cerco la selezionata per mostrare la foto corretta
                this.tracciatoSource.filter(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo).forEach(f => {
                    if (f.statoSelezione == 1) {
                        codice_foto_in_vista = f.recordInTracciato[keyRefCodice];
                        //codice_foto_in_vista = codice;
                    }
                }
                );

                if (codice_foto_in_vista == "")
                    codice_foto_in_vista = codice.split(",")[0];
            }


            _container.attr("codice_gruppo", item.codiceGruppo);
        }

        _container.attr("id_menabo_ref", item.id);
        //_container.find("#boxTitle").text(codice);
        //_container.find("#boxDescr").html(descr);
        _container.css("background-image", "url('Thumb?codice=" + codice_foto_in_vista + "&id_foto=0&w=200&h=200')");

        //htmlBox.find("#btnPos").text(item.indice);

        let cmbIndici = htmlBox.find("#cmbPos");
        //$(htmlBox[0]);
        let dim = this.getDimensioneGriglia();
        let totBox = dim[0] * dim[1];

        cmbIndici.append("<option value=\"0\">del</option>")
        for (let b = 1; b <= totBox; b++) {
            let selected = item.indice == b ? "selected" : "";
            cmbIndici.append("<option value=\"" + b + "\" " + selected + ">" + b + "</option>");
        }

        if (revisionato) {
            _container.find("#stato_revisione").removeClass("bg-danger");
            _container.find("#stato_revisione").removeClass("bg-warning");
            _container.find("#stato_revisione").addClass("bg-success");
            _container.find("#stato_revisione").text("Revisonato");
        }
        else if (incongruenzaFirma) {
            _container.find("#stato_revisione").removeClass("bg-danger");
            _container.find("#stato_revisione").addClass("bg-warning");
            _container.find("#stato_revisione").text("Da confermare");
        }
        //$("#box_" + item.indice).html("");
        let multiplex = false;
        if ($("#box_" + item.indice).find(".single_box").length >= 1) {
            multiplex = true;
            htmlBox.css("display", "none");
            if ($("#box_" + item.indice).find(".single_box").length == 1) {
                let Multiplex = $("#multiplex").clone();
                let htmlMultiplex = $(Multiplex.html());
                htmlMultiplex.attr("index", item.indice);
                $("#box_" + item.indice).append(htmlMultiplex);
            }
            $("#box_" + item.indice).find("#multiplexSelection").text($("#box_" + item.indice).find(".single_box").length + 1);
            let element = this.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.indice == item.indice && f.recordImpaginato.idPagina == this.pagSelected);
            if (element == null) {
                element = this.tracciatoSourceObsoleti.find(f => f.recordImpaginato != null && f.recordImpaginato.indice == item.indice && f.recordImpaginato.idPagina == this.pagSelected);
            }
            if (element == null) {
                console.error("Elemento non trovato durante la composizione multiplex");
            }
            if (element.isGruppo && !obsoleto) {
                element = this.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == element.recordInTracciato[keyScattoCodiceGruppo].split(",")[0])
            }
            else if (element.isGruppo && obsoleto) {
                element = this.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == element.recordInTracciato[keyScattoCodiceGruppo].split(",")[0])
                if (element == null) {
                    element = this.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == element.recordInTracciato[keyScattoCodiceGruppo].split(",")[0])
                }
                if (element == null) {
                    console.error("Elemento non trovato durante la composizione multiplex");
                }
            }
            console.log(element.recordInTracciato[keyScattoCodiceGruppoMultiplex]);
            if (element.recordInTracciato[keyScattoCodiceGruppoMultiplex] != null) {
                Call.do("Menabo", "controllaRevisioneMultiplex/" + element.recordInTracciato[keyScattoCodiceGruppoMultiplex], "GET", null, this, function (result, me) {
                    if (result.esito) {
                        if (result.revisioneEffettuata) {
                            $("#box_" + item.indice).find("#multiplexSelection").css("background-color", "green");
                            $("#box_" + item.indice).find("#multiplexSelection").attr("codiceMultiplex", element.recordInTracciato[keyScattoCodiceGruppoMultiplex]);
                        }
                        else {
                            $("#box_" + item.indice).find("#multiplexSelection").css("background-color", "red");
                            $("#box_" + item.indice).find("#multiplexSelection").attr("codiceMultiplex", element.recordInTracciato[keyScattoCodiceGruppoMultiplex]);
                        }
                    }
                    else {
                        console.log(result.error);
                    }
                });
            }
        }
        if (!multiplex) {
            $("#box_" + item.indice).find(".container").remove();
        }
        $("#box_" + item.indice).append(htmlBox);
        if (obsoleto) {
            $("#box_" + item.indice).find(".mask").css("display", "flex");
        }

        //console.log($("#box_" + item.indice).width() + "," + $("#box_" + item.indice).height());
        let _multiplex = $("#box_" + item.indice).find("#multiplexSelection");
        let _box = $("#box_" + item.indice);
        $("#box_" + item.indice).find("#multiplexSelection").css("top", _box.outerHeight() - _multiplex.outerHeight());
        $("#box_" + item.indice).find("#multiplexSelection").css("left", _box.outerWidth() - _multiplex.outerWidth());

        var cmbMeccanica = $("#box_" + item.indice).find(".refInMenabo[id_menabo_ref='" + item.id + "']").closest(".single_box").find("#cmbDim");

        if (this.meccanicheSource != null) {
            for (let m = 0; m < this.meccanicheSource.length; m++) {
                let item = this.meccanicheSource[m];
                var optionValue = item.nomeTraduzione;

                if (item.aree != null && (item.aree.length == 0 || item.aree.includes(this.areaTracciato))) {
                    // Verifica se esiste già un'opzione con lo stesso valore
                    if (cmbMeccanica.find('option[value="' + optionValue + '"]').length === 0) {
                        cmbMeccanica.append("<option value=\"" + optionValue + "\">" + optionValue + "</option>");
                    }
                }
            }
            if (cmbMeccanica.length > 0 && cmbMeccanica.find("option[value='" + item.formato + "']").length == 0) {
                formatoObsoleto = true;
            }
        }
        else {
            if (item.meccaniche != null) {
                if (typeof item.meccaniche === "string") {
                    let deserializedMecc = JSON.parse(item.meccaniche);
                    deserializedMecc.forEach(function (option) {
                        var optionValue = option.NomeCombinazione;
                        if (cmbMeccanica.find('option[value="' + optionValue + '"]').length === 0) {
                            cmbMeccanica.append("<option value=\"" + optionValue + "\">" + optionValue + "</option>");
                        }
                    });
                }
                else {
                    item.meccaniche.forEach(function (option) {
                        var optionValue = option.nomeCombinazione;
                        if (cmbMeccanica.find('option[value="' + optionValue + '"]').length === 0) {
                            cmbMeccanica.append("<option value=\"" + optionValue + "\">" + optionValue + "</option>");
                        }
                    });
                }

                cmbMeccanica.val(item.formato);
            }
        }


        if (formatoObsoleto) {
            $("#box_" + item.indice).find(".mask").css("display", "flex");
            $("#box_" + item.indice).find(".mask").css("pointer-events", "none");
            $("#box_" + item.indice).find(".mask").css("background", "rgba(255, 255, 0, 0.3)");
            $("#box_" + item.indice).find(".mask").find(".fas").remove();
            $("#box_" + item.indice).find(".mask").addClass("formatoNonDisponibile");
            let maskElement = $("#box_" + item.indice).find(".mask");
            setInterval(function () {
                maskElement.fadeTo(0, 0.1).fadeTo(1000, 1.0).fadeTo(1000, 0.1).fadeTo(1000, 1.0).fadeTo(1000,0.1);
            });
        }

        //if (cmbMeccanica.find("option[value='" + item.formato + "']").length == 0) {
        //    alert("L'elemento ad indice " + item.indice + " richiede la meccanica " + item.formato + " ma non è disponibile, rivedere le meccaniche del tracciato o assegnare una nuova meccanica valida");
        //}
        cmbMeccanica.val(item.formato);
        

        _container.css("height", "100%");
        //console.log(htmlBox);

    }

    cambioIndice(sender) {
        let newInx = parseInt(sender.val());
        let _box = sender.parent();
        this.eseguiCambioIndice(newInx, _box)
    }

    eseguiCambioIndice(newInx, box) {
        let me = this;
        let _container = box.find(".container");
        let curr = this.paginaSelected();
        let pagItem = this.pagineSource.find(f => f.id == curr);

        let itemInMenabo = pagItem.menaboRefs.find(r => r.id == _container.attr("id_menabo_ref"));
        let tracciatoItem = this.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
        if (tracciatoItem == null) {
            tracciatoItem = this.tracciatoSourceObsoleti.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
        }


        //let res = {
        //    result: true,
        //}
        let formatoElemento = box.find("#cmbDim").val();
        let ElementIndexOccupato = pagItem.menaboRefs.find(f => f.indice == newInx);
        if (ElementIndexOccupato != null) {
            console.log("index occupato");
        }
        //se sto cercando di cancellare resta true,altrienti res viene sostituita con il risultato
        //if (newInx != 0 && ElementIndexOccupato == null) {
        //    res = { result: true };// this.controllaSpazioinGriglia(box);
        //}
        if (newInx != 0 && ElementIndexOccupato != null) {
            let elements = pagItem.menaboRefs.filter(f => f.indice == newInx);
            for (var i = 0; i < elements.length; i++) {
                let corrupted = me.tracciatoSourceObsoleti.find(f => f.recordImpaginato != null && f.recordImpaginato.id == elements[i].id);
                if (corrupted != null) {
                    alert("Impossibile spostare, a tale indice è presente un elemento che richiede intervento dall'operatore");
                    box.find("#cmbPos").val(parseInt(box.closest(".boxMenabo").attr("id").split("_")[1]));
                    return;
                }
            }
            $("#modalSwapOrMultiplex").attr("codiceGruppoOIdRec", 0);
            $("#modalSwapOrMultiplex").attr("idMenaboRef", itemInMenabo.id);
            $("#modalSwapOrMultiplex").attr("newInx", newInx);
            $("#modalSwapOrMultiplex").modal("show");
            return;

            //let result = confirm("Indice già occupato da un'altra referenza, sicuro di voler spostare?");
            //if (result === true) {
            //    let idorCod;
            //    if (tracciatoItem.isGruppo) { idorCod = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo] }
            //    else { idorCod = tracciatoItem.idRec }

            //    Call.do("Menabo", "cambiaFormato/" + pagItem.id + "/" + idorCod + "/" + ElementIndexOccupato.formato, "GET", null, this, function (result, me) {
            //        if (result.esito == true) {
            //            me.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id).recordImpaginato.formato = ElementIndexOccupato.formato;
            //            box.find("#cmbPos").val(ElementIndexOccupato.formato);
            //            hideLoading();
            //            console.log(result);
            //            me.selezionataPagina();
            //        }
            //        else {
            //            mostraMessaggio(result.error, "danger");
            //            box.find("#cmbPos").val(parseInt(box.closest(".boxMenabo").attr("id").split("_")[1]));
            //            return;
            //        }

            //    });

            //} else {
            //    box.find("#cmbPos").val(parseInt(box.closest(".boxMenabo").attr("id").split("_")[1]));
            //    return;
            //}
        } 
        this.concludiCambioIndice(formatoElemento, newInx, itemInMenabo, tracciatoItem)
        
    }

    concludiCambioIndice(formatoElemento, newInx, itemInMenabo, tracciatoItem) {
        let me = this;
        let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());

        let obj = {
            id: itemInMenabo.id,
            indice: newInx
        }

        let esito = me.geometraInstance.CalcolaSpazi(pagItem.formato, newInx, this.meccanicheDb[formatoElemento], true, false);
        if (!esito.result) {
            $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);
            return;
        }
        showLoading();
        //salvaRefInMenabo
        if (this.meccanicheSource != null) {
            Call.do("Menabo", "salvaRefInMenabo/" + this.idTracciato, "PUT", obj, this, function (result, me) {
                console.log(result);
                if (result.error == null) {

                    //Aggiorno sia la sorgente della pagina che del record tracciato a monte che contiene info sull'impaginazione.

                    if (newInx > 0) {

                        //Cambio di posizione

                        itemInMenabo.indice = newInx;
                        tracciatoItem.recordImpaginato.indice = newInx;

                        if (!tracciatoItem.isObsoleto) {
                            //Aggiorno info dell'indice sulla lista a sinistra
                            if (tracciatoItem.idRec > 0) {
                                //Si tratta di un singolo
                                let listaHtmlItem = $("#container_tracciato").find(".record_menabo[id_rec='" + tracciatoItem.idRec + "']");
                                listaHtmlItem.find("#lab_onoff_impaginato").text(newInx + " a Pag. " + pagItem.numero);

                            }
                            else {
                                let codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
                                let listaHtmlItem = $("#container_tracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
                                listaHtmlItem.find("#lab_onoff_impaginato").text(newInx + " a Pag. " + pagItem.numero);
                            }
                        }
                    }
                    else {

                        //Rimozione da menabo
                        if (tracciatoItem != null) {
                            tracciatoItem.recordImpaginato = null;
                        }
                        let inxDel = pagItem.menaboRefs.indexOf(itemInMenabo);
                        console.warn(inxDel);
                        pagItem.menaboRefs.splice(inxDel, 1);

                        me.EliminaeSincronizzainGrigliaeLista(tracciatoItem);
                        me.ricercaInTracciatoMenabo($("#switchNascondiImpaginati"));
                    }
                    if (result.codiceMultiplexRimossi != null) {

                        if (result.ref.codiceGruppo != null) {
                            let elements = result.ref.codiceGruppo.split(",");
                            elements.forEach(function (item2) {
                                let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                if (singleElement == null) {
                                    singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                }
                                if (singleElement != null) {
                                    delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                }
                            });
                        }
                        else {
                            let element = me.tracciatoSource.find(f => f.idRec == result.ref.idRecord);
                            if (element == null) {
                                element = me.tracciatoSourceObsoleti.find(f => f.idRec == result.ref.idRecord);
                            }
                            if (element != null) {
                                delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                            }
                        }

                        result.codiciRefdaRimuovere.forEach(function (item) {
                            if (item.indexOf(',') == -1) {
                                let element = me.tracciatoSource.find(f => f.idRec == item);
                                if (element == null) {
                                    element = me.tracciatoSourceObsoleti.find(f => f.idRec == item);
                                }
                                if (result.codiceMultiplexRimossi != "") {
                                    element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                }
                                else {
                                    if (element != null) {
                                        delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                    }
                                }

                            }
                            else {
                                let elements = item.split(",");
                                elements.forEach(function (item2) {
                                    let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    if (singleElement == null) {
                                        singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    }
                                    if (result.codiceMultiplexRimossi != "") {
                                        singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                    }
                                    else {
                                        if (singleElement != null) {
                                            delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                        }
                                    }
                                });
                            }
                        });
                    }

                    if (result.codiceMultiplexAggiunto != null) {

                        //aggiorno i codici multiplex
                        result.codiciRefdaAggiungere.forEach(function (item) {
                            if (item.indexOf(',') == -1) {
                                let element = me.tracciatoSource.find(f => f.idRec == item);
                                if (element == null) {
                                    element = me.tracciatoSourceObsoleti.find(f => f.idRec == item);
                                }
                                element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                            }
                            else {
                                let elements = item.split(",");
                                elements.forEach(function (item2) {
                                    let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    if (singleElement == null) {
                                        singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    }
                                    singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                });
                            }
                        });
                    }


                    //controllo se il formato 

                    //Refresh della pagina
                    me.selezionataPagina();
                }
                else {
                    mostraMessaggio(result.error, "danger");
                    $("#offcanvasTracciato").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);
                }

                hideLoading();

            });
        }
        else {
            Call.do("Menabo", "salvaRefInMenaboNew/" + this.idTracciato, "PUT", obj, this, function (result, me) {
                console.log(result);
                if (result.error == null) {

                    //Aggiorno sia la sorgente della pagina che del record tracciato a monte che contiene info sull'impaginazione.

                    if (newInx > 0) {

                        //Cambio di posizione

                        itemInMenabo.indice = newInx;
                        tracciatoItem.recordImpaginato.indice = newInx;

                        if (!tracciatoItem.isObsoleto) {
                            //Aggiorno info dell'indice sulla lista a sinistra
                            if (tracciatoItem.idRec > 0) {
                                //Si tratta di un singolo
                                let listaHtmlItem = $("#container_tracciato").find(".record_menabo[id_rec='" + tracciatoItem.idRec + "']");
                                listaHtmlItem.find("#lab_onoff_impaginato").text(newInx + " a Pag. " + pagItem.numero);

                            }
                            else {
                                let codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
                                let listaHtmlItem = $("#container_tracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
                                listaHtmlItem.find("#lab_onoff_impaginato").text(newInx + " a Pag. " + pagItem.numero);
                            }
                        }
                    }
                    else {

                        //Rimozione da menabo
                        if (tracciatoItem != null) {
                            tracciatoItem.recordImpaginato = null;
                        }
                        let inxDel = pagItem.menaboRefs.indexOf(itemInMenabo);
                        console.warn(inxDel);
                        pagItem.menaboRefs.splice(inxDel, 1);

                        me.EliminaeSincronizzainGrigliaeLista(tracciatoItem);
                        me.ricercaInTracciatoMenabo($("#switchNascondiImpaginati"));
                    }
                    if (result.codiceMultiplexRimossi != null) {

                        if (result.ref.codiceGruppo != null) {
                            let elements = result.ref.codiceGruppo.split(",");
                            elements.forEach(function (item2) {
                                let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                if (singleElement == null) {
                                    singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                }
                                if (singleElement != null) {
                                    delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                }
                            });
                        }
                        else {
                            let element = me.tracciatoSource.find(f => f.idRec == result.ref.idRecord);
                            if (element == null) {
                                element = me.tracciatoSourceObsoleti.find(f => f.idRec == result.ref.idRecord);
                            }
                            if (element != null) {
                                delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                            }
                        }

                        result.codiciRefdaRimuovere.forEach(function (item) {
                            if (item.indexOf(',') == -1) {
                                let element = me.tracciatoSource.find(f => f.idRec == item);
                                if (element == null) {
                                    element = me.tracciatoSourceObsoleti.find(f => f.idRec == item);
                                }
                                if (result.codiceMultiplexRimossi != "") {
                                    element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                }
                                else {
                                    if (element != null) {
                                        delete element.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                    }
                                }

                            }
                            else {
                                let elements = item.split(",");
                                elements.forEach(function (item2) {
                                    let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    if (singleElement == null) {
                                        singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    }
                                    if (result.codiceMultiplexRimossi != "") {
                                        singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexRimossi;
                                    }
                                    else {
                                        if (singleElement != null) {
                                            delete singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                        }
                                    }
                                });
                            }
                        });
                    }

                    if (result.codiceMultiplexAggiunto != null) {

                        //aggiorno i codici multiplex
                        result.codiciRefdaAggiungere.forEach(function (item) {
                            if (item.indexOf(',') == -1) {
                                let element = me.tracciatoSource.find(f => f.idRec == item);
                                if (element == null) {
                                    element = me.tracciatoSourceObsoleti.find(f => f.idRec == item);
                                }
                                element.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                            }
                            else {
                                let elements = item.split(",");
                                elements.forEach(function (item2) {
                                    let singleElement = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    if (singleElement == null) {
                                        singleElement = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato[keyRefCodice] == item2);
                                    }
                                    singleElement.recordInTracciato[keyScattoCodiceGruppoMultiplex] = result.codiceMultiplexAggiunto;
                                });
                            }
                        });
                    }


                    //controllo se il formato 

                    //Refresh della pagina
                    me.selezionataPagina();
                }
                else {
                    mostraMessaggio(result.error, "danger");
                    $("#offcanvasTracciato").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);
                }

                hideLoading();

            });
        }
    }

    AnnullaCambioIndice(itemInMenaboId, idOrCodGruppo) {
        if (itemInMenaboId != 0) {
            let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());
            let itemInMenabo = pagItem.menaboRefs.find(r => r.id == parseInt(itemInMenaboId));
            $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);
        }
    }

    FormaMultiplex(itemInMenaboId, idOrCodGruppo, newInx) {
        newInx = parseInt(newInx);
        if (itemInMenaboId != 0 && itemInMenaboId != null) {
            let me = this;
            let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());
            let itemInMenabo = pagItem.menaboRefs.find(r => r.id == parseInt(itemInMenaboId));
            let ElementIndexOccupato = pagItem.menaboRefs.find(f => f.indice == newInx);
            let tracciatoItem = this.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
            if (tracciatoItem == null) {
                tracciatoItem = this.tracciatoSourceObsoleti.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
            }

            let idorCod;
            if (tracciatoItem.isGruppo) { idorCod = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo] }
            else { idorCod = tracciatoItem.idRec }

            Call.do("Menabo", "cambiaFormato/" + pagItem.id + "/" + idorCod + "/" + ElementIndexOccupato.formato, "GET", null, this, function (result, me) {
                if (result.esito == true) {
                    itemInMenabo.formato = ElementIndexOccupato.formato;
                    me.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id).recordImpaginato.formato = ElementIndexOccupato.formato;
                    $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbDim").val(ElementIndexOccupato.formato);
                    //console.log($("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']"));
                    //box.find("#cmbPos").val(ElementIndexOccupato.formato);
                    hideLoading();
                    console.log(result);
                    me.selezionataPagina();
                    me.concludiCambioIndice(ElementIndexOccupato.formato, newInx, itemInMenabo, tracciatoItem)
                }
                else {
                    mostraMessaggio(result.error, "danger");
                    $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);

                    //box.find("#cmbPos").val(parseInt(box.closest(".boxMenabo").attr("id").split("_")[1]));
                    return;
                }

            });
        }
        else if (idOrCodGruppo != 0 && idOrCodGruppo != null) {
            let me = this;
            let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());
            let codGruppo = "";
            let idRec = null;
            let targetElement = null;
            if (idOrCodGruppo.includes(",")) {
                codGruppo = idOrCodGruppo;
                targetElement = $("#offcanvasTracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
            }
            else {
                let tracciatoItem = this.tracciatoSource.find(t => t.idRec == idOrCodGruppo);
                codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
                idRec = idOrCodGruppo;
                targetElement = $("#offcanvasTracciato").find(".record_menabo[id_rec='" + idRec + "']");
            }
            if (targetElement != null && targetElement.length > 0) {
                //console.log(targetElement);
                //console.log(targetElement.find("#onoff_impaginato"));
                targetElement.find("#onoff_impaginato").prop("checked", true);
                this.inMenabo(targetElement.find("#onoff_impaginato"), codGruppo, idRec, newInx);
            }
        }
    }

    ScorriRef(itemInMenaboId, idOrCodGruppo, newInx) {
        let me = this;
        newInx = parseInt(newInx);
        let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());

        let itemInMenabo = null;
        if (itemInMenaboId != null && itemInMenaboId != 0) {
            itemInMenabo = pagItem.menaboRefs.find(r => r.id == parseInt(itemInMenaboId));
        }
        //let tracciatoItem = this.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
        //if (tracciatoItem == null) {
        //    tracciatoItem = this.tracciatoSourceObsoleti.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
        //}

        //let idorCod;
        //if (tracciatoItem.isGruppo) { idorCod = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo] }
        //else { idorCod = tracciatoItem.idRec }
        Call.do("Menabo", "scorriPagina/" + this.idTracciato + "/" + pagItem.id + "/" + newInx + "/" + idOrCodGruppo, "PUT", itemInMenabo, this, function (result, me) {
            console.log(result);

            if (result.error == null) {
                pagItem = me.pagineSource.find(f => f.id == me.paginaSelected())
                pagItem.menaboRefs = result.menaboRefs;

                result.menaboRefs.forEach(function (item) {
                    let tracciatoObj = me.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == item.id);
                    tracciatoObj.recordImpaginato = item;
                });

                let codGruppo = "";
                let idRec = null;
                let targetElement = null;
                if (idOrCodGruppo.includes(",")) {
                    codGruppo = idOrCodGruppo;
                    targetElement = $("#offcanvasTracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
                }
                else {
                    let tracciatoItem = me.tracciatoSource.find(t => t.idRec == idOrCodGruppo);
                    codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
                    idRec = idOrCodGruppo;
                    targetElement = $("#offcanvasTracciato").find(".record_menabo[id_rec='" + idRec + "']");
                }
                if (targetElement != null && targetElement.length > 0) {
                    //console.log(targetElement);
                    //console.log(targetElement.find("#onoff_impaginato"));
                    targetElement.find("#onoff_impaginato").prop("checked", true);
                    me.inMenabo(targetElement.find("#onoff_impaginato"), codGruppo, idRec, newInx);
                }
                me.selezionataPagina();
            }
            else {
                if (itemInMenabo != null) {
                    $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenabo.id + "']").parent().find("#cmbPos").val(itemInMenabo.indice);
                }
                console.log(result.error);
                mostraMessaggio(result.error, "danger");
            }
        });
    }

    ScambiaRef(itemInMenaboId, idOrCodGruppo, newInx) {
        let me = this;
        newInx = parseInt(newInx);
        let pagItem = this.pagineSource.find(f => f.id == this.paginaSelected());
        let itemInMenabo = null;
        if (itemInMenaboId != null && itemInMenaboId != 0) {
            itemInMenabo = pagItem.menaboRefs.find(r => r.id == parseInt(itemInMenaboId));
        }
        let tracciatoItem = null;
        if (idOrCodGruppo == 0) {
            tracciatoItem = this.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
        }
        else {
            if (idOrCodGruppo.includes(",")) {
                tracciatoItem = this.tracciatoSource.find(t => t.isGruppo && t.recordInTracciato[keyScattoCodiceGruppo] == idOrCodGruppo);
            }
            else {
                tracciatoItem = this.tracciatoSource.find(t => !t.isGruppo && t.idRec == idOrCodGruppo);
            }
        }

        //let idorCod;
        //if (tracciatoItem.isGruppo) { idorCod = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo] }
        //else { idorCod = tracciatoItem.idRec }

        Call.do("Menabo", "ScambiaRef/" + this.idTracciato + "/" + pagItem.id + "/" + newInx + "/" + idOrCodGruppo + "/" + this.areaTracciato, "PUT", itemInMenabo, this, function (result, me) {
            console.log(result);
            let res = null;
            if (itemInMenabo != null) {
                if (result.error == null) {
                    pagItem = me.pagineSource.find(f => f.id == me.paginaSelected())
                    pagItem.menaboRefs = result.menaboRefs;

                    result.menaboRefs.forEach(function (item) {
                        let tracciatoObj = me.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == item.id);
                        tracciatoObj.recordImpaginato = item;
                    });

                    me.selezionataPagina();
                }
                else {
                    $("#griglia").find(".refInMenabo[id_menabo_ref='" + itemInMenaboId + "']").parent().find("#cmbPos").val(itemInMenabo.indice);                    
                    console.log(result.error);
                    mostraMessaggio(result.error, "danger");
                }
            }
            else {
                if (result.error == null) {
                    pagItem = me.pagineSource.find(f => f.id == me.paginaSelected())
                    let itemsDaRimuovere = pagItem.menaboRefs.filter(f => f.indice == newInx);
                    itemsDaRimuovere.forEach(function (itemDaRimuovere) {
                        if (itemDaRimuovere.codiceGruppo != null) {
                            let codGruppo = itemDaRimuovere.codiceGruppo;
                            let targetElement = $("#offcanvasTracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
                            targetElement.find("#onoff_impaginato").prop("checked", false);
                            targetElement.find(".targetImgGrp").css("display", "inline");

                            let tracciatoObj = me.tracciatoSource.find(t => t.isGruppo && t.recordImpaginato != null && t.recordInTracciato[keyScattoCodiceGruppo] == codGruppo);
                            tracciatoObj.recordImpaginato = null;
                            me.EliminaeSincronizzainGrigliaeLista(tracciatoObj);

                        }
                        else {
                            let idRec = itemDaRimuovere.idRecord;
                            let targetElement = $("#offcanvasTracciato").find(".record_menabo[id_rec='" + idRec + "']");
                            targetElement.find("#onoff_impaginato").prop("checked", false);
                            targetElement.find(".targetImg").css("display", "inline");

                            let tracciatoObj = me.tracciatoSource.find(t => !t.isGruppo && t.recordImpaginato != null && t.idRec == idRec);
                            tracciatoObj.recordImpaginato = null;
                            me.EliminaeSincronizzainGrigliaeLista(tracciatoObj);
                        }
                    });
                    
                        
                    

                    if (idOrCodGruppo.includes(",")) {
                        let codGruppo = idOrCodGruppo;
                        let targetElement = $("#offcanvasTracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
                        targetElement.find("#onoff_impaginato").prop("checked", true);
                        targetElement.find(".targetImgGrp").css("display", "none");


                        let tracciatoObjIndex = me.tracciatoSource.findIndex(t => t.isGruppo && t.recordInTracciato[keyScattoCodiceGruppo] == codGruppo);
                        res = result.menaboRefs.find(f => f.codiceGruppo == codGruppo);

                        me.tracciatoSource[tracciatoObjIndex].recordImpaginato = res;




                        targetElement.find("#lab_onoff_impaginato").text(res.indice + " a Pag. " + result.numero);
                        //Disabilito il check inserimento di tutte le ref figlie
                        targetElement.closest("ul").find(".record_menabo").each(function () {
                            $(this).find("#onoff_impaginato").attr("disabled", true);
                        });

                        if ($("#switchNascondiImpaginati").prop("checked")) {
                            sender.closest("ul").css("display", "none");
                            me.contaArticoliInTracciato();
                            me.ContaRefPerSegnaposti();
                        }
                    }
                    else {
                        let idRec = idOrCodGruppo;
                        let targetElement = $("#offcanvasTracciato").find(".record_menabo[id_rec='" + idRec + "']");
                        targetElement.find("#onoff_impaginato").prop("checked", true);
                        targetElement.find(".targetImg").css("display", "none");

                        let tracciatoObjIndex = me.tracciatoSource.findIndex(t => !t.isGruppo && t.idRec == idRec);
                        res = result.menaboRefs.find(f => f.idRecord == idRec);
                        console.log(targetElement);
                        targetElement.find("#lab_onoff_impaginato").text(res.indice + " a Pag. " + result.numero);

                        // Assicurati di avere il riferimento esatto all'oggetto da aggiornare
                        me.tracciatoSource[tracciatoObjIndex].recordImpaginato = res;

                        if (me.tracciatoSource[tracciatoObjIndex].recordInTracciato[keyScattoCodiceGruppo].includes(",")) {

                            //Se è in un gruppo, disabilito check inserimento del gruppo
                            targetElement.closest("ul").find(".record_menabo_gruppo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });

                            if (targetElement.closest("ul").find(".record_menabo_gruppo").length > 0 && $("#switchNascondiImpaginati").prop("checked")) {
                                let allChecked = true;
                                targetElement.closest("ul").find(".record_menabo").each(function () {
                                    if (allChecked) {
                                        allChecked = $(this).find("#onoff_impaginato").prop("checked");
                                    }
                                });
                                if (allChecked) {
                                    targetElement.closest("ul").css("display", "none");
                                    me.contaArticoliInTracciato();
                                    me.ContaRefPerSegnaposti();
                                }
                            }
                            else if ($("#switchNascondiImpaginati").prop("checked")) {
                                targetElement.closest(".record_menabo").css("display", "none");
                                me.contaArticoliInTracciato();
                                me.ContaRefPerSegnaposti();
                            }                           
                        }
                    }

                    pagItem.menaboRefs = result.menaboRefs;
                    me.selezionataPagina();
                }
                else {
                    console.log(result.error);
                    mostraMessaggio(result.error, "danger");
                }
            }

            if (itemInMenabo == null) {
                let meccanicaObj = me.CalcolaMeccanica(tracciatoItem);
                if (meccanicaObj != null && meccanicaObj.meccanicaName != "") {
                    if (me.agenzia.modifyMeccanica != null) {
                        let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
                        let record = (tracciatoItem.isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == tracciatoItem.recordInTracciato[keyScattoCodiceGruppo]) : tracciatoItem);
                        meccanicaObj.meccanicaName = me.agenzia.modifyMeccanica(currPage, record, meccanicaObj);
                    }
                }
                let formatoCombinazione = me.CheckForExceptionFormat(meccanicaObj.meccanicaName);
                if (formatoCombinazione != null) {
                    meccanicaObj.formatoRichiesto = formatoCombinazione;
                }
                if (resultMeccanica != null && resultMeccanica != "") {
                    me.checkSpazioMeccanicaRichiestaNew(meccanicaObj, res, pagItem.id);
                }
            }

            //if (me.agenzia.getMeccanicaCustom != null && itemInMenabo == null) {
            //    let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
            //    let note = (tracciatoItem.isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == tracciatoItem.recordInTracciato[keyScattoCodiceGruppo]).recordInTracciato.note : tracciatoItem.recordInTracciato.note);
            //    let resultMeccanica = me.agenzia.getMeccanicaCustom(currPage.idMastro, note).meccanicaRequired;
            //    if (resultMeccanica != null && resultMeccanica != "") {
            //        me.checkSpazioMeccanicaRichiesta(resultMeccanica, res, pagItem.id);
            //    }
            //}
        });
    }


    cambioSelezione(sender) {

        let recRev = sender.closest(".record-revisione");

        let id_rec = recRev.attr("id_rec");
        let tipo_selezione = sender.val();
        this.assegnaBackgroundColorToSelezione(sender);
        if (id_rec == null) {
            id_rec = sender.closest(".oggetto_multiplex_container").attr("id_rec");
        }
        showLoading();

        let obj = {
            id: id_rec,
            selezioneMenabo: tipo_selezione
        };

        Call.do("Menabo", "selezioneRefInMenabo", "PUT", obj, this, function (result, me) {

            console.log(result);
            me.AggiornaSelezioneLocale(obj, true);
            hideLoading();

        });


    }

    cambioSelezioneCheckbox(sender) {


        let recRev = sender.closest(".container");

        let id_rec = recRev.attr("id_rec");
        let tipo_selezione;
        if (sender.attr("id") == "SelezionePilotaGruppo") {
            tipo_selezione = sender.is(':checked') ? 1 : 3;
            sender.parent().parent().find("#SelezioneSecondarioGruppo").prop("checked", false);
        }
        else if (sender.attr("id") == "SelezioneSecondarioGruppo") {
            tipo_selezione = sender.is(':checked') ? 2 : 3;
            sender.parent().parent().find("#SelezionePilotaGruppo").prop("checked", false);
        }


        showLoading();

        let obj = {
            id: id_rec,
            selezioneMenabo: tipo_selezione
        };

        Call.do("Menabo", "selezioneRefInMenabo", "PUT", obj, this, function (result, me) {

            console.log(result);
            me.AggiornaSelezioneLocale(obj, false);
            hideLoading();

        });
    }

    AggiornaSelezioneLocale(obj, senderIsntCheckbox) {
        console.log(this.tracciatoSource.find(f => f.idRec == obj.id).statoSelezione);
        this.tracciatoSource.find(f => f.idRec == obj.id).statoSelezione = obj.selezioneMenabo;
        console.log(this.tracciatoSource.find(f => f.idRec == obj.id).statoSelezione);
        if (senderIsntCheckbox) {
            if (obj.selezioneMenabo == 1) {
                $("#container_tracciato").find(".container[id_rec=" + obj.id + "]").find("#SelezionePilotaGruppo").prop("checked", true);
                $("#container_tracciato").find(".container[id_rec=" + obj.id + "]").find("#SelezioneSecondarioGruppo").prop("checked", false);
            }
            else {
                $("#container_tracciato").find(".container[id_rec=" + obj.id + "]").find("#SelezionePilotaGruppo").prop("checked", false);
                $("#container_tracciato").find(".container[id_rec=" + obj.id + "]").find("#SelezioneSecondarioGruppo").prop("checked", true);
            }

        }
        this.applyIconToMultiplexWithSelectionError();
        this.multiplexMostraErrore("modalVisualizzaBox");
    }

    apriDettaglio(sender, idModal) {
        let id_rec = sender.closest(".container").attr("id_rec");

        $("#" + idModal).find("#content").html("");

        let me = this;
        let index = sender.closest(".boxMenabo").find("#multiplexSelection").attr("index");
        let obj;
        let codice;
        if (index != null && idModal != "modalDtl") {
            let htmlItem = $($("#templateDettaglioMultiplex").clone().html());
            let currentPage = this.pagineSource.find(f => f.id == this.pagSelected);
            currentPage.menaboRefs.forEach(function (item) {
                if (item.indice == index) {
                    if (item.codiceGruppo != null) {

                        obj = me.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo);
                        const lastElement = obj.pop();
                        obj.unshift(lastElement);
                        let tmpText = $(htmlItem).find("#codici_multiplex").text();
                        if (tmpText == "") {
                            let tmp = me.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == obj[0].recordInTracciato[keyScattoCodiceGruppo].split(",")[0]);
                            codice = (tmp.recordInTracciato[keyScattoCodiceGruppoMultiplex] != null ? tmp.recordInTracciato[keyScattoCodiceGruppoMultiplex] : "Multiplex corrotto");
                        }
                        $(htmlItem).find("#codici_multiplex").text(codice);
                    }
                    else {
                        obj = me.tracciatoSource.filter(f => f.idRec == item.idRecord);
                        let tmpText = $(htmlItem).find("#codici_multiplex").text();
                        if (tmpText == "") {
                            codice = obj[0].recordInTracciato[keyScattoCodiceGruppoMultiplex];
                        }
                        $(htmlItem).find("#codici_multiplex").text(codice);
                    }

                    obj.forEach(function (objItem) {
                        let htmlOggetto = $($("#oggetto_multiplex").clone().html());
                        console.log(objItem);
                        $(htmlOggetto).attr("id_rec", objItem.idRec);
                        if (!objItem.isGruppo) {
                            $(htmlOggetto).find("#cmbStatoSelezioneMultiplex").val(objItem.statoSelezione);
                            me.assegnaBackgroundColorToSelezione($(htmlOggetto).find("#cmbStatoSelezioneMultiplex"));
                        }
                        else {
                            $(htmlOggetto).find("#cmbStatoSelezioneMultiplex").css("visibility", "hidden");
                        }

                        if (!objItem.isGruppo && objItem.recordInTracciato[keyScattoCodiceGruppo] != objItem.recordInTracciato[keyRefCodice]) {
                            $(htmlOggetto).addClass("bg-success");
                            $(htmlOggetto).addClass("bg-opacity-25");
                        }
                        else if (objItem.isGruppo) {
                            $(htmlOggetto).css("margin-left", "-25px");
                            $(htmlOggetto).addClass("bg-success");
                            $(htmlOggetto).addClass("bg-opacity-75");
                        }
                        else {
                            $(htmlOggetto).addClass("bg-light");
                            $(htmlOggetto).addClass("bg-opacity-75");
                        }
                        var stringaTagliata = "";
                        if (objItem.isGruppo) {
                            var stringaCompleta = objItem.recordInTracciato[keyScattoCodiceGruppo];

                            if (stringaCompleta.length >= 18) {
                                stringaTagliata = stringaCompleta.substring(0, 18) + "...";
                            } else {
                                stringaTagliata = stringaCompleta;
                            }
                        }
                        $(htmlOggetto).find(".codiceReferenzaMultiplex").text((objItem.isGruppo ? stringaTagliata : objItem.recordInTracciato[keyRefCodice]));
                        if (objItem.recordRevisionato != null) {
                            $(htmlOggetto).find("#Descrizione1Mult").text(objItem.recordRevisionato.descrizione1);
                            if ($(htmlOggetto).find("#Descrizione1Mult").text() == "") { $(htmlOggetto).find("#Descrizione1Mult").closest(".row").css("display", "none"); }

                            $(htmlOggetto).find("#Descrizione2Mult").text(objItem.recordRevisionato.descrizione2);
                            if ($(htmlOggetto).find("#Descrizione2Mult").text() == "") { $(htmlOggetto).find("#Descrizione2Mult").closest(".row").css("display", "none"); }

                            $(htmlOggetto).find("#Descrizione3Mult").text(objItem.recordRevisionato.descrizione3);
                            if ($(htmlOggetto).find("#Descrizione3Mult").text() == "") { $(htmlOggetto).find("#Descrizione3Mult").closest(".row").css("display", "none"); }

                            $(htmlOggetto).find("#Descrizione4Mult").text(objItem.recordRevisionato.descrizione4);
                            if ($(htmlOggetto).find("#Descrizione4Mult").text() == "") { $(htmlOggetto).find("#Descrizione4Mult").closest(".row").css("display", "none"); }

                            $(htmlOggetto).find("#DescrizioneInddMult").text(objItem.recordRevisionato.descrizioneIndd);
                            if ($(htmlOggetto).find("#DescrizioneInddMult").text() == "") { $(htmlOggetto).find("#DescrizioneInddMult").closest(".row").css("display", "none"); }


                            if ($(htmlOggetto).find("#DescrizioneInddMult").text() == "") {
                                if ($(htmlOggetto).find("#Descrizione4Mult").text() != "") {
                                    $(htmlOggetto).find("#Descrizione4Mult").closest(".row").addClass("mb-3");
                                }
                                else if ($(htmlOggetto).find("#Descrizione3Mult").text() != "") {
                                    $(htmlOggetto).find("#Descrizione3Mult").closest(".row").addClass("mb-3");
                                }
                                else if ($(htmlOggetto).find("#Descrizione2Mult").text() != "") {
                                    $(htmlOggetto).find("#Descrizione2Mult").closest(".row").addClass("mb-3");
                                }
                                else if ($(htmlOggetto).find("#Descrizione1Mult").text() != "") {
                                    $(htmlOggetto).find("#Descrizione1Mult").closest(".row").addClass("mb-3");
                                }
                            }
                        }

                        $(htmlItem).find(".dettagliOggettiMultiplex").append(htmlOggetto);
                    });
                }
            });
            $(htmlItem).attr("codice_gruppo", codice);
            let tmpText = $(htmlItem).find("#codici_multiplex").text();
            if (tmpText.length > 60) {
                tmpText = tmpText.substring(0, 60);
                $(htmlItem).find("#codici_multiplex").text(tmpText);
            }


            let fd = new FormData();
            fd.append("codice", codice);

            Call.doWithUpload("Archivio", "GetDescrizioneByCodice", "PUT", fd, this, function (result, sender) {
                console.log(result);
                if (result != null) {
                    $(htmlItem).find("#Descrizione1").text(result.descrizione1);
                    $(htmlItem).find("#Descrizione2").text(result.descrizione2);
                    $(htmlItem).find("#Descrizione3").text(result.descrizione3);
                    $(htmlItem).find("#Descrizione4").text(result.descrizione4);
                    $(htmlItem).find("#DescrizioneIndd").text(result.descrizioneIndd);
                    $(htmlItem).find("#Peso").val(result.peso);
                    $(htmlItem).find("#Um").val(result.um);
                }
            });



            $("#" + idModal).find("#content").append(htmlItem);
        }

        if (idModal == "modalVisualizzaBox") {
            this.multiplexMostraErrore(idModal);
            return;
        }

        if (id_rec != null) {
            console.log("singola");
            obj = this.tracciatoSource.find(f => f.idRec == id_rec);
            //console.log(obj);

            //Accede alla funzione definita in components.js
            let htmlItem = renderRecordRevisione("templateDettaglio", obj, this.agenzia, true, this.areaTracciato, null, false, this.agenzia.mostraFirmaTracciato());

            $("#modalDtl").find("#content").append(htmlItem);

            //console.log("Check Multiplex per cmbStatoSelezione 2");
            if (obj.recordInTracciato[keyScattoCodiceGruppoMultiplex] == null) {
                $("#modalDtl").find("#cmbStatoSelezione").css("visibility", "hidden");
                //console.log("NO MULTIPLEX 2");
                //console.log(obj);
            }
            else {
                let ME = this;
                $("#modalDtl").find(".record-revisione").each(function () {

                    let id_rec = $(this).attr("id_rec");
                    console.log("## " + id_rec);
                    if (id_rec != null) {
                        obj = ME.tracciatoSource.find(f => f.idRec == id_rec);

                        if (obj.statoSelezione == 0)//fix dopo il cambio di assegnazione valori all' enumerazione
                            obj.statoSelezione = 3;

                        $(this).find("#cmbStatoSelezione").val(obj.statoSelezione);
                        me.assegnaBackgroundColorToSelezione($(this).find("#cmbStatoSelezione"));
                    }

                });
            }
        }
        else {
            console.log("gruppo");
            let cod_gruppo = sender.closest(".container").attr("codice_gruppo");
            obj = this.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == cod_gruppo);
            //console.log(obj);
            let htmlItem = renderRecordRevisione("templateDettaglio", obj, this.agenzia, true, this.areaTracciato, null, false, this.agenzia.mostraFirmaTracciato());

            $("#modalDtl").find("#content").append(htmlItem);

            let ME = this;


            htmlItem.find(".record-revisione").each(function () {

                let id_rec = $(this).attr("id_rec");
                console.log("## " + id_rec);
                if (id_rec != null) {
                    obj = ME.tracciatoSource.find(f => f.idRec == id_rec);

                    if (obj.statoSelezione == 0)//fix dopo il cambio di assegnazione valori all' enumerazione
                        obj.statoSelezione = 3;

                    $(this).find("#cmbStatoSelezione").val(obj.statoSelezione);
                    me.assegnaBackgroundColorToSelezione($(this).find("#cmbStatoSelezione"));
                }

            });

            $("#modalDtl").find("#cmbStatoSelezione").css("visibility", "hidden");
        }



        //this.ordinaRefInDettaglio();
    }

    onSalvataRevisione(resultAll, sender) {
        console.log("onSalvata Revisione");

        menaboInstance.showAlertModal(sender);

        let ME = menaboInstance;

        let result = resultAll[0];
        console.log(result);
        if (result != null) {
            if (result.idArticolo > 0) {
                //Revisione singola
                console.log(ME);
                let item = ME.tracciatoSource.find(a => a.recordRevisionato != null && a.recordRevisionato.idArticolo == result.idArticolo);
                if (item == null) {
                    console.warn("Non trovato nel set di dati...");
                    item = ME.tracciatoSource.find(a => a.recordInTracciato[keyRefCodice] == result.idArticoloNavigation.codice);
                    if (item != null) {
                        result.idArticoloNavigation = null;//Posso togliere questo dato che mi appesantisce senza alcun motivo il repository locale
                    }
                }
                /*console.log("Sovrascrivo");
                console.log(item.recordRevisionato);
                console.log("con");
                console.log(result);*/
                item.recordRevisionato = result;

                //Cerco se esiste il box impaginato e cambio descrizione e stato
                if (item.recordInTracciato[keyTracciatoFirma] == null || item.recordInTracciato[keyTracciatoFirma] == "" || item.recordRevisionato != null && item.recordInTracciato[keyTracciatoFirma] != null && item.recordRevisionato.firmaTracciato != null && item.recordRevisionato.firmaTracciato == item.recordInTracciato[keyTracciatoFirma]) {
                    //console.log("Cerco rec impaginato -> " + item.recordImpaginato.id);
                    let _imp = [];
                    if (item.recordImpaginato != null) {
                        _imp = $("#griglia").find(".refInMenabo[id_menabo_ref='" + item.recordImpaginato.id + "']");
                    }
                    if (_imp.length > 0) {
                        _imp.find(".badge").removeClass("bg-danger");
                        _imp.find(".badge").removeClass("bg-warning");
                        _imp.find(".badge").addClass("bg-success");
                        _imp.find(".badge").text("Revisionato");
                        if (item.recordRevisionato.descrizioneIndd != null && item.recordRevisionato.descrizioneIndd != "") {
                            _imp.find("#boxDescr").html(item.recordRevisionato.descrizioneIndd);
                        }
                        else {
                            _imp.find("#boxDescr").html(item.recordRevisionato.descrizione1);
                        }
                    }
                }
            }
            else {
                //Revisione di gruppo
                let item = ME.tracciatoSource.find(a => (a.recordRevisionato != null && a.recordRevisionato.codiceGruppo == result.codiceGruppo));
                if (item == null) {
                    console.warn("Non trovato gruppo nel set di dati..., possibile codice multiplex");
                    let multiplex = $("#multiplexSelection[codicemultiplex='" + result.codiceGruppo + "']")
                    if (multiplex.length !== 0) {
                        multiplex.css("background-color", "green");
                        return;
                    }
                    item = ME.tracciatoSource.find(a => a.recordInTracciato[keyRefCodice] == null && a.recordInTracciato[keyScattoCodiceGruppo] == result.codiceGruppo);

                }
                item.recordRevisionato = result;

                if (item.recordImpaginato != null) {
                    let _imp = $("#griglia").find(".refInMenabo[id_menabo_ref='" + item.recordImpaginato.id + "']");
                    if (_imp.length > 0) {
                        _imp.find(".badge").removeClass("bg-danger");
                        _imp.find(".badge").removeClass("bg-warning");
                        _imp.find(".badge").addClass("bg-success");
                        _imp.find(".badge").text("Revisionato");
                        _imp.find("#boxDescr").html(item.recordRevisionato.descrizione1);
                    }
                }

            }
        }
        else {
            console.warn("Result nullo, se non si tratta di un multiplex è possibile ci sia un errore");
        }


    }

    abilitaODisabilitaEsporta() {
        let filtro_pagine = $("#FiltroPagine").val();
        let obj = this.IndividuazioneErrori(filtro_pagine);
        if (obj.caratteriNonValidi == true) {
            let Modal = ($("#modalEsportazione"));
            const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

            // Aggiunta dell'evento click al bottone "Vedi"
            vediButton.on('click', function () {
                // Chiudi il modal "modalEsportazione"
                $('#modalEsportazione').modal('hide');

                // Apri il modal "ModalCorrezioneErrori"
                $('#ModalCorrezioneErrori').modal('show');

                // Chiamata alla funzione menaboInstance.ShowErrorModal()
                menaboInstance.ShowErrorModal();
            });
            // Aggiunta del bottone "Vedi" al div delle alert
            const appendAlert = (message, type) => {
                const wrapper = $('<div></div>').addClass(`alert alert-${type}`).attr('role', 'alert');
                const row = $('<div></div>').addClass('row');
                const contentCol = $('<div></div>').addClass('col-10').text(message);
                const buttonCol = $('<div></div>').addClass('col-2');
                const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

                // Aggiunta dell'evento click al bottone "Vedi"
                vediButton.on('click', function () {
                    // Chiudi il modal "modalEsportazione"
                    $('#modalEsportazione').modal('hide');

                    // Apri il modal "ModalCorrezioneErrori"
                    $('#ModalCorrezioneErrori').modal('show');

                    // Chiamata alla funzione menaboInstance.ShowErrorModal()
                    menaboInstance.ShowErrorModal();
                });

                buttonCol.append(vediButton);
                row.append(contentCol);
                row.append(buttonCol);
                wrapper.append(row);

                Modal.find('#liveAlertEsportazione').empty();
                Modal.find('#liveAlertEsportazione').append(wrapper);
            }

            if (filtro_pagine != "") {
                appendAlert('Caratteri non validi all\'interno del filtro pagina', 'danger');
            }
            else {
                appendAlert('Caratteri non validi all\'interno del filtro pagina', 'danger');
            }
            $("#esportaMenaboButton").prop("disabled", true);
        }
        else if (obj.paginaNonPresente) {
            let Modal = ($("#modalEsportazione"));
            const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

            // Aggiunta dell'evento click al bottone "Vedi"
            vediButton.on('click', function () {
                // Chiudi il modal "modalEsportazione"
                $('#modalEsportazione').modal('hide');

                // Apri il modal "ModalCorrezioneErrori"
                $('#ModalCorrezioneErrori').modal('show');

                // Chiamata alla funzione menaboInstance.ShowErrorModal()
                menaboInstance.ShowErrorModal();
            });
            // Aggiunta del bottone "Vedi" al div delle alert
            const appendAlert = (message, type) => {
                const wrapper = $('<div></div>').addClass(`alert alert-${type}`).attr('role', 'alert');
                const row = $('<div></div>').addClass('row');
                const contentCol = $('<div></div>').addClass('col-10').text(message);
                const buttonCol = $('<div></div>').addClass('col-2');
                const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

                // Aggiunta dell'evento click al bottone "Vedi"
                vediButton.on('click', function () {
                    // Chiudi il modal "modalEsportazione"
                    $('#modalEsportazione').modal('hide');

                    // Apri il modal "ModalCorrezioneErrori"
                    $('#ModalCorrezioneErrori').modal('show');

                    // Chiamata alla funzione menaboInstance.ShowErrorModal()
                    menaboInstance.ShowErrorModal();
                });

                buttonCol.append(vediButton);
                row.append(contentCol);
                row.append(buttonCol);
                wrapper.append(row);

                Modal.find('#liveAlertEsportazione').empty();
                Modal.find('#liveAlertEsportazione').append(wrapper);
            }

            if (filtro_pagine != "") {
                appendAlert('Una o più pagine richieste dal filtro non sono presenti', 'danger');
            }
            else {
                appendAlert('Una o più pagine richieste dal filtro non sono presenti', 'danger');
            }
            $("#esportaMenaboButton").prop("disabled", true);
        }
        else if (obj.errorFounded) {
            let Modal = ($("#modalEsportazione"));
            const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

            // Aggiunta dell'evento click al bottone "Vedi"
            vediButton.on('click', function () {
                // Chiudi il modal "modalEsportazione"
                $('#modalEsportazione').modal('hide');

                // Apri il modal "ModalCorrezioneErrori"
                $('#ModalCorrezioneErrori').modal('show');

                // Chiamata alla funzione menaboInstance.ShowErrorModal()
                menaboInstance.ShowErrorModal();
            });
            // Aggiunta del bottone "Vedi" al div delle alert
            const appendAlert = (message, type) => {
                const wrapper = $('<div></div>').addClass(`alert alert-${type}`).attr('role', 'alert');
                const row = $('<div></div>').addClass('row');
                const contentCol = $('<div></div>').addClass('col-10').text(message);
                const buttonCol = $('<div></div>').addClass('col-2');
                const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

                // Aggiunta dell'evento click al bottone "Vedi"
                vediButton.on('click', function () {
                    // Chiudi il modal "modalEsportazione"
                    $('#modalEsportazione').modal('hide');

                    // Apri il modal "ModalCorrezioneErrori"
                    $('#ModalCorrezioneErrori').modal('show');

                    // Chiamata alla funzione menaboInstance.ShowErrorModal()
                    menaboInstance.ShowErrorModal();
                });

                buttonCol.append(vediButton);
                row.append(contentCol);
                row.append(buttonCol);
                wrapper.append(row);

                Modal.find('#liveAlertEsportazione').empty();
                Modal.find('#liveAlertEsportazione').append(wrapper);
            }

            if (filtro_pagine != "") {
                appendAlert('Errori presenti nelle pagine selezionate', 'danger');
            }
            else {
                appendAlert('Errori presenti in menabò', 'danger');
            }
            $("#esportaMenaboButton").prop("disabled", true);
        }
        else if (obj.warnFounded) {
            let Modal = ($("#modalEsportazione"));
            const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

            // Aggiunta dell'evento click al bottone "Vedi"
            vediButton.on('click', function () {
                // Chiudi il modal "modalEsportazione"
                $('#modalEsportazione').modal('hide');

                // Apri il modal "ModalCorrezioneErrori"
                $('#ModalCorrezioneErrori').modal('show');

                // Chiamata alla funzione menaboInstance.ShowErrorModal()
                menaboInstance.ShowErrorModal();
            });

            // Aggiunta del bottone "Vedi" al div delle alert
            // Aggiunta del bottone "Vedi" al div delle alert
            const appendAlert = (message, type) => {
                const wrapper = $('<div></div>').addClass(`alert alert-${type}`).attr('role', 'alert');
                const row = $('<div></div>').addClass('row');
                const contentCol = $('<div></div>').addClass('col-10').text(message);
                const buttonCol = $('<div></div>').addClass('col-2');
                const vediButton = $('<button></button>').addClass('btn btn-sm btn-primary').text('Vedi');

                // Aggiunta dell'evento click al bottone "Vedi"
                vediButton.on('click', function () {
                    // Chiudi il modal "modalEsportazione"
                    $('#modalEsportazione').modal('hide');

                    // Apri il modal "ModalCorrezioneErrori"
                    $('#ModalCorrezioneErrori').modal('show');

                    // Chiamata alla funzione menaboInstance.ShowErrorModal()
                    menaboInstance.ShowErrorModal();
                });

                buttonCol.append(vediButton);
                row.append(contentCol);
                row.append(buttonCol);
                wrapper.append(row);

                Modal.find('#liveAlertEsportazione').empty();
                Modal.find('#liveAlertEsportazione').append(wrapper);
            }

            if (filtro_pagine != "") {
                appendAlert('Warning presenti nelle pagine selezionate', 'warning');
            }
            else {
                appendAlert('Warning presenti in menabò', 'warning');
            }
            $("#esportaMenaboButton").prop("disabled", false);
        }
        else {
            let Modal = ($("#modalEsportazione"));
            Modal.find('#liveAlertEsportazione').empty();
            $("#esportaMenaboButton").prop("disabled", false);
        }
    }

    finestraEsportaPopInApertura() {
        if (this.agenzia.onRenderFinestraEsportazionePoP != null) {

            this.agenzia.onRenderFinestraEsportazionePoP();
        }

    }

    esporta() {
        let obj = {
            CartellaDiEsportazione: $("#CartellaDiEsportazione").val(),
            ChEsportaDaArchivio: $("#ChEsportaDaArchivio").is(":checked"),
            ChEsportaFoto: $("#ChEsportaFoto").is(":checked"),
            ChEsportaDaMenabo: !$("#ChEsportaTutto").is(":checked"),
            fields: {
                id_tracciato: this.idTracciato,
                filtro_pagine: $("#FiltroPagine").val()
            }
        };

        this.tipoDiEsportazioneInCorso = 1;

        Call.do("Menabo", "esporta", "PUT", obj, this, function (result, me) {
            console.log(result);
            $("#row_progress_export").attr("id_attivita", result.attivita.id);
            $("#row_progress_export").css("display", "block");
            taskManager.Add(result.attivita.id);
        });
    }

    esportaPoP() {

        //Revupero, se ci soino, i parametri custom agenzia
        var _input_fields = $("#divEsportaPopAgenzia").find("input, select");

        //fd.append("cmbTipoTracciato", obj.cmbTipoTracciato);
        //fd.append("cmbAddestramenti", obj.cmbAddestramento);
        let obj = {
            CartellaDiEsportazione: $("#CartellaDiEsportazionePoP").val(),
            ChEsportaDaArchivio: $("#ChEsportaDaArchivioPoP").is(":checked"),
            ChEsportaFoto: $("#ChEsportaFotoPoP").is(":checked"),
            fields: {
                id_tracciato: this.idTracciato
            }
        };


        for (let i_fd = 0; i_fd < _input_fields.length; i_fd++) {

            let _field = $(_input_fields[i_fd]);
            //console.log(_field[0].className);
            ///fields += _field.attr("id") + "=";

            if (_field[0].className != "form-check-input") {
                obj.fields[_field.attr("id")] = _field.val();
                //fields += _field.val();
            }
            else {
                obj.fields[_field.attr("id")] = _field.is(":checked");
                //fields += _field.is(":checked");
            }

            //fields += "&";
        }



        this.tipoDiEsportazioneInCorso = 2;

        Call.do("Menabo", "esportaPoP", "PUT", obj, this, function (result, me) {
            console.log(result);
            $("#row_progress_exportPoP").attr("id_attivita", result.attivita.id);
            $("#row_progress_exportPoP").css("display", "block");
            taskManager.Add(result.attivita.id);
        });
    }

    onAttivitaChageStatus(id_attivita, stato) {
        if (stato == 6 || stato == 7) {
            //Refresh pagina
            if (this.tipoDiEsportazioneInCorso == 1) {
                setTimeout(function () {
                    $("#CartellaDiEsportazione").val("");
                    $('#ChEsportaDaArchivio').prop('checked', false);
                    $('#ChEsportaFoto').prop('checked', false);
                    $("#FiltroPagine").val("");
                    $("#row_progress_export").css("display", "none");
                    $('#modalEsportazione').modal('hide');
                }, 2000);
            }
            else {
                setTimeout(function () {
                    $("#CartellaDiEsportazionePoP").val("");
                    $('#ChEsportaDaArchivioPoP').prop('checked', false);
                    $('#ChEsportaFotoPoP').prop('checked', false);
                    $("#row_progress_exportPoP").css("display", "none");
                    $('#modalEsportazionePoP').modal('hide');
                }, 2000);
            }
        }
    }

    svuotaPagina() {
        console.log("Entro in svuota pagina");
        let currPag = this.paginaSelected();

        if (this.pagSelected == -1) {
            return;
        }
        let tmpList = [];
        console.log("compongo lista da rimuovere");
        this.tracciatoSource.filter(l => l.recordImpaginato != null && l.recordImpaginato.idPagina == currPag).forEach(function (item) {
            if (item.recordImpaginato != null) {
                tmpList.push(item);
            }
        });
        this.tracciatoSourceObsoleti.filter(l => l.recordImpaginato != null && l.recordImpaginato.idPagina == currPag).forEach(function (item) {
            if (item.recordImpaginato != null) {
                tmpList.push(item);
            }
        });
        console.log(tmpList);
        console.log("svuoto la lista");
        Call.do("Menabo", "svuotaPagina/" + currPag, "GET", null, this, function (result, me) {
            console.log(result);
            tmpList.forEach(function (item) {
                let pagItem = me.pagineSource.find(f => f.id == currPag);
                let itemInMenabo = pagItem.menaboRefs.find(r => r.id == item.recordImpaginato.id);
                let tracciatoItem = me.tracciatoSource.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
                if (tracciatoItem == null) {
                    tracciatoItem = me.tracciatoSourceObsoleti.find(t => t.recordImpaginato != null && t.recordImpaginato.id == itemInMenabo.id);
                }
                tracciatoItem.recordImpaginato = null;
                let inxDel = pagItem.menaboRefs.indexOf(itemInMenabo);
                console.warn(inxDel);
                pagItem.menaboRefs.splice(inxDel, 1);
                me.EliminaeSincronizzainGrigliaeLista(tracciatoItem)
            });
            me.ricercaInTracciatoMenabo($("#switchNascondiImpaginati"));
            me.selezionataPagina();
        });
    }

    EliminaeSincronizzainGrigliaeLista(tracciatoItem) {
        if (tracciatoItem == null) {
            return;
        }
        //Aggiorno info dell'indice sulla lista a sinistra
        if (tracciatoItem.idRec > 0) {
            //Si tratta di un singolo,
            //devo verificare adesso se è in un gruppo e se era il solo ad avere il check.
            //In tal caso oltre a levarlo a lui devo riabilitarlo anche al suo item grppo di riferimento
            let codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
            let listaSingoloHtmlItem = $("#container_tracciato").find(".record_menabo[id_rec='" + tracciatoItem.idRec + "']");

            listaSingoloHtmlItem.find("#onoff_impaginato").prop("checked", false);
            listaSingoloHtmlItem.find(".targetImg").css("display", "inline");
            let listaGruppoHtmlItem = $("#container_tracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");
            if (listaGruppoHtmlItem.length > 0) {
                //E' in un gruppo
                let all_no_placed = true;
                listaGruppoHtmlItem.closest("ul").find(".record_menabo").each(function () {
                    if ($(this).find("#onoff_impaginato").is(":checked")) {
                        all_no_placed = false;
                    }
                });

                if (all_no_placed) {
                    listaGruppoHtmlItem.find("#onoff_impaginato").attr("disabled", false);
                    listaGruppoHtmlItem.find(".targetImgGrp").css("display", "inline");
                }
                listaGruppoHtmlItem.find("#lab_onoff_impaginato").text("");
            }

            listaSingoloHtmlItem.find("#lab_onoff_impaginato").text("");


        }
        else {
            let codGruppo = tracciatoItem.recordInTracciato[keyScattoCodiceGruppo];
            let listaHtmlItem = $("#container_tracciato").find(".record_menabo_gruppo[codice_gruppo='" + codGruppo + "']");

            listaHtmlItem.find("#onoff_impaginato").prop("checked", false);
            listaHtmlItem.find(".targetImgGrp").css("display", "inline");
            //Di sicxuro tutti i figli erano disabilitati per cui li riabilito
            listaHtmlItem.closest("ul").find(".record_menabo").each(function () {
                $(this).find("#onoff_impaginato").attr("disabled", false);
                $(this).find(".targetImg").css("display", "inline");
            });

            listaHtmlItem.find("#lab_onoff_impaginato").text("");

        }
    }

    ridimensionaRef(box) {
        let boxParent = box.parent();
        console.log(boxParent);
        let meccanica = boxParent.find("#cmbDim").val();
        let idElement = boxParent.find('[id_rec]:first').attr('id_rec');
        let isGruppo = false;
        if (idElement == null) {
            isGruppo = true;
            idElement = boxParent.find('[codice_gruppo]:first').attr('codice_gruppo');
        }
        let refImpaginata = this.pagineSource.find(f => f.id == this.pagSelected).menaboRefs.find(f => isGruppo ? f.codiceGruppo == idElement : f.idRecord == idElement);
        let res = this.checkSpazioMeccanicaRichiesta(meccanica, refImpaginata, this.pagSelected);
        if (!res.result) {
            boxParent.find("#cmbDim").val(res.element.formato);
        }
        
    }

    checkSpazioMeccanicaRichiesta(meccanica, refImpaginata, idPag) {//deprecato

        let res = this.controllaSpazioinGriglia(refImpaginata, meccanica, idPag);
        if (res.result) {
            showLoading();
            console.log(res.idElement);
            console.log(res.formato);
            console.log(res.element);
            var _item = this.tracciatoSource.find(f => f.recordImpaginato != null && (f.recordImpaginato.idRecord == res.idElement || f.recordImpaginato.codiceGruppo == res.idElement));

            this.cambiaFormato(_item, res.idElement, meccanica);
        }
        return res;
    }

    checkSpazioMeccanicaRichiestaNew(meccanicaObj, refImpaginata, idPag) {

        let res = this.controllaSpazioinGrigliaNew(refImpaginata, meccanicaObj, idPag);
        if (res.result) {
            showLoading();
            console.log(res.idElement);
            console.log(res.formato);
            console.log(res.element);
            var _item = this.tracciatoSource.find(f => f.recordImpaginato != null && (f.recordImpaginato.idRecord == res.idElement || f.recordImpaginato.codiceGruppo == res.idElement));

            this.cambiaFormatoNew(_item, res.idElement, meccanicaObj);
        }
        return res;
    }

    cambiaFormatoNew(_item, idRecOrCodiceGruppo, meccanicaObj) {
        let me = this;
        Call.do("Menabo", "cambiaFormatoNew/" + _item.recordImpaginato.idPagina + "/" + idRecOrCodiceGruppo, "PUT", meccanicaObj, this, function (result, me) {

            _item.recordImpaginato.formato = meccanicaObj.meccanicaName;
            let pagItem = me.pagineSource.find(f => f.id == _item.recordImpaginato.idPagina);
            let itemsAtIndice = pagItem.menaboRefs.filter(mr => mr.indice == _item.recordImpaginato.indice);
            let tracciatoItems = [];
            itemsAtIndice.forEach(function (obj) {
                obj.formato = meccanicaObj.meccanicaName;
            });
            tracciatoItems = me.tracciatoSource.filter(f => f.recordImpaginato != null && f.recordImpaginato.idPagina == pagItem.id && f.recordImpaginato.indice == _item.recordImpaginato.indice);
            tracciatoItems.forEach(function (obj) {
                obj.recordImpaginato.formato = meccanicaObj.meccanicaName;
            });
            hideLoading();
            console.log(result);
            me.selezionataPagina();
        });
    }

    cambiaFormato(_item, idRecOrCodiceGruppo, meccanica) {//deprecato
        let me = this;
        Call.do("Menabo", "cambiaFormato/" + _item.recordImpaginato.idPagina + "/" + idRecOrCodiceGruppo + "/" + meccanica, "GET", null, this, function (result, me) {

            _item.recordImpaginato.formato = meccanica;
            let pagItem = me.pagineSource.find(f => f.id == _item.recordImpaginato.idPagina);
            let itemsAtIndice = pagItem.menaboRefs.filter(mr => mr.indice == _item.recordImpaginato.indice);
            let tracciatoItems = [];
            itemsAtIndice.forEach(function (obj) {
                obj.formato = meccanica;
            });
            tracciatoItems = me.tracciatoSource.filter(f => f.recordImpaginato != null && f.recordImpaginato.idPagina == pagItem.id && f.recordImpaginato.indice == _item.recordImpaginato.indice);
            tracciatoItems.forEach(function (obj) {
                obj.recordImpaginato.formato = meccanica;
            });
            hideLoading();
            console.log(result);
            me.selezionataPagina();
        });
    }

    controllaSpazioinGrigliaNew(element, meccanicaObj, idPag) {
        let me = this;

        let returnObject = {
            element: "",
            idElement: "",
            formato: "",
            spaceRequired: [],
            pageFormat: "",
            result: false
        };

        let idElement = element.idRecord;
        if (idElement == null) {
            idElement = element.codiceGruppo;
        }
        let pagElements = [];
        pagElements = this.filterElementbyPag(idPag);
        let pagSource = this.pagineSource.find(p => p.id == idPag);
        returnObject.pageFormat = pagSource.formato;
        let elementActualIndex = element.indice;
        let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, elementActualIndex, meccanicaObj.formatoRichiesto);
        let listIndexRequired = result.listIndexRequired;

        returnObject.element = element;
        returnObject.idElement = idElement;
        returnObject.formato = meccanicaObj.meccanicaName;

        if (!result.result) {
            return returnObject;
        }
        console.log("La pagina può contenere, controllo la presenza di altre ref");
        var count = 0;

        // Conta il numero di elementi in comune tra le due liste



        //continua da qui


        //guarda da qui
        for (var i = 0; i < pagElements.length; i++) {
            if (pagElements[i].recordImpaginato.indice != element.indice) {

                let meccanicaObjTmp = me.CalcolaMeccanica(pagElements[i]);
                if (meccanicaObjTmp != null && meccanicaObjTmp.meccanicaName != "") {
                    if (me.agenzia.modifyMeccanica != null) {
                        let currPage = me.pagineSource.find(f => f.id == me.pagSelected);
                        let record = (pagElements[i].isGruppo ? me.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == pagElements[i].recordInTracciato[keyScattoCodiceGruppo]) : pagElements[i]);
                        meccanicaObjTmp.meccanicaName = me.agenzia.modifyMeccanica(currPage, record, meccanicaObjTmp);
                    }
                }
                let formatoCombinazione = me.CheckForExceptionFormat(meccanicaObjTmp.meccanicaName);
                if (formatoCombinazione != null) {
                    meccanicaObjTmp.formatoRichiesto = formatoCombinazione;
                }


                let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, pagElements[i].recordImpaginato.indice, meccanicaObjTmp.formatoRichiesto);
                let tmplistIndex = result.listIndexRequired;
                for (var i2 = 0; i2 < tmplistIndex.length; i2++) {
                    for (var i3 = 0; i3 < listIndexRequired.length; i3++) {
                        if (tmplistIndex[i2] == listIndexRequired[i3]) {
                            count++;
                        }
                    }
                }
            }
        }

        if (elementActualIndex == (pagElements.find(f => f.recordImpaginato.id == element.id).recordImpaginato.indice)) {

            if (count > 0) {
                mostraMessaggio("Modifica impossibile, spazio già occupato da altre referenze", "warning");
                return returnObject;
            }
        }
        else {
            let countConflictHimself = 0;
            let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, element.indice, meccanicaObj.formatoRichiesto);
            let tmplistIndex = result.listIndexRequired;
            for (var i = 0; i < tmplistIndex.length; i++) {
                for (var i2 = 0; i2 < listIndexRequired.length; i2++) {
                    if (tmplistIndex[i] == listIndexRequired[i2]) {
                        countConflictHimself++;
                    }
                }
            }

            if (count > countConflictHimself) {
                mostraMessaggio("Modifica impossibile, spazio già occupato da altre referenze", "warning");
                return returnObject;
            }
        }

        returnObject.spaceRequired = listIndexRequired;
        returnObject.result = true;
        return returnObject;
    }

    controllaSpazioinGriglia(element, formato, idPag) { //deprecato
        let me = this;
        let returnObject = {
            element: "",
            idElement: "",
            formato: "",
            spaceRequired: [],
            pageFormat: "",
            result: false
        };

        //let isGruppo = false;
        let idElement = element.idRecord;//boxparent.find('[id_rec]:first').attr('id_rec');
        if (idElement == null) {
            //isGruppo = true;
            idElement = element.codiceGruppo;//boxparent.find('[codice_gruppo]:first').attr('codice_gruppo');
        }
        let pagElements = [];
        pagElements = this.filterElementbyPag(idPag);
        let pagSource = this.pagineSource.find(p => p.id == idPag);
        returnObject.pageFormat = pagSource.formato;
        //let element;
        //if (isGruppo) {
        //    element = pagElements.find(f => f.recordImpaginato.codiceGruppo == idElement).recordImpaginato;
        //}
        //else {
        //    element = pagElements.find(f => f.recordImpaginato.idRecord == idElement).recordImpaginato;
        //}
        let elementActualIndex = element.indice;//parseInt(boxparent.find("#cmbPos").val());
        let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, elementActualIndex, me.meccanicheDb[formato]);
        let listIndexRequired = result.listIndexRequired;
        //listIndex torna un bool false se fallisce a trovare lo spazio

        returnObject.element = element;
        returnObject.idElement = idElement;
        returnObject.formato = formato;

        if (!result.result) {
            //boxparent.find("#cmbPos").val(element.indice);
            //boxparent.find("#cmbDim").val(element.formato);
            return returnObject;
        }
        console.log("La pagina può contenere, controllo la presenza di altre ref");
        var count = 0;

        // Conta il numero di elementi in comune tra le due liste

        //guarda da qui
        for (var i = 0; i < pagElements.length; i++) {
            if (pagElements[i].recordImpaginato.indice != element.indice) {
                let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, pagElements[i].recordImpaginato.indice, this.meccanicheDb[pagElements[i].recordImpaginato.formato]);
                let tmplistIndex = result.listIndexRequired;
                for (var i2 = 0; i2 < tmplistIndex.length; i2++) {
                    for (var i3 = 0; i3 < listIndexRequired.length; i3++) {
                        if (tmplistIndex[i2] == listIndexRequired[i3]) {
                            count++;
                        }
                    }
                }
            }
        }

        if (elementActualIndex == (pagElements.find(f => f.recordImpaginato.id == element.id).recordImpaginato.indice)) {
            //let righeXcolonne = [1, 1];// formato.split("x");
            //let righeXcolonneOld = [1, 1];// element.formato.split("x");
            //let righeConflict = righeXcolonne[0] < righeXcolonneOld[0] ? righeXcolonne[0] : righeXcolonneOld[0];
            //let colonneConflict = righeXcolonne[1] < righeXcolonneOld[1] ? righeXcolonne[1] : righeXcolonneOld[1];
            if (count > 0/*righeConflict * colonneConflict*/) {
                mostraMessaggio("Modifica impossibile, spazio già occupato da altre referenze", "warning");
                //console.log("Altre ref bloccano il cambio di formato");
                //boxparent.find("#cmbDim").val(element.formato);
                return returnObject;
            }
        }
        else {
            let countConflictHimself = 0;
            let result = this.geometraInstance.CalcolaSpazi(pagSource.formato, element.indice, me.meccanicheDb[formato]);
            let tmplistIndex = result.listIndexRequired;
            for (var i = 0; i < tmplistIndex.length; i++) {
                for (var i2 = 0; i2 < listIndexRequired.length; i2++) {
                    if (tmplistIndex[i] == listIndexRequired[i2]) {
                        countConflictHimself++;
                    }
                }
            }

            if (count > countConflictHimself) {
                mostraMessaggio("Modifica impossibile, spazio già occupato da altre referenze", "warning");
                //console.log("Altre ref bloccano il cambio di formato");
                //boxparent.find("#cmbPos").val(element.indice);
                return returnObject;
            }
        }

        returnObject.spaceRequired = listIndexRequired;
        returnObject.result = true;
        return returnObject;
    }

    filterElementbyPag(pagId) {
        let tmpList = [];
        tmpList = this.tracciatoSource.filter(f => f.recordImpaginato != null && f.recordImpaginato.idPagina == pagId);
        return tmpList;
    }

    getPageFormat() {
        let pagSource = this.pagineSource.find(p => p.id == this.pagSelected).formato;
        return pagSource;
    }

    BloccaCaselleOccupate() {
        
        let me = this;
        let pagElements = this.filterElementbyPag(this.pagSelected);
        console.log(pagElements);
        pagElements.forEach(function (item) {

            let result = me.geometraInstance.CalcolaSpazi(me.getPageFormat(), item.recordImpaginato.indice, me.meccanicheDb[item.recordImpaginato.formato]);
            let listCaselle = result.listIndexRequired;
            for (var i = 1; i < listCaselle.length; i++) {
                $("#box_" + listCaselle[i]).find(".container").text("");
                $("#box_" + listCaselle[i]).find(".container").append("<img style='width:30px; height:30px' class='centered-image mx-auto' src='images/red_X.png' >");
            }
            let formatoElement = ["1","1"];
            if (me.meccanicheDb[item.recordImpaginato.formato] != null) {
                formatoElement = me.meccanicheDb[item.recordImpaginato.formato].split("x");
            }
            for (var i = 0; i < listCaselle.length; i++) {

                if ((i % parseInt(formatoElement[0])) == 0) {
                    $("#box_" + listCaselle[i]).css("border-left", "2px solid red");
                }
                if (((i + 1) % parseInt(formatoElement[0])) == 0) {
                    $("#box_" + listCaselle[i]).css("border-right", "2px solid red");
                }

                if (Math.floor(i / parseInt(formatoElement[0])) + 1 == 1) {
                    $("#box_" + listCaselle[i]).css("border-top", "2px solid red");
                }
                if (Math.floor(i / parseInt(formatoElement[0])) + 1 == parseInt(formatoElement[1])) {
                    $("#box_" + listCaselle[i]).css("border-bottom", "2px solid red");
                }
            }
        });
        
    }

    bindModalSpostaAPag(modalButton) {
        console.log("entro");
        let box = modalButton.parent().parent().parent();

        this.currentCodorRefModal = box.attr("id_rec");
        if (this.currentCodorRefModal == null) {
            this.currentCodorRefModal = box.attr("codice_gruppo");
        }
        console.log(this.currentCodorRefModal);
        $("#cmbDimModal").val(box.parent().find("#cmbDim").val());

        console.log(box.find("#boxTitle").text());

        $("#spostapagTitle").text("Sposta ref:  " + box.find("#boxTitle").text() + " " + box.find("#boxDescr").text());

        $("#pagModal").empty();
        for (let p = 0; p < this.pagineSource.length; p++) {
            let item = this.pagineSource[p];
            $("#pagModal").append("<option value=\"" + item.id + "\">Pag. " + item.numero + "</option>");
        }

        $('#pagModal option[value=' + this.pagSelected + ']').remove();
        console.log(this.pagSelected);
        $("#pagModal").eq(0).val();
        this.modalSetPage($("#pagModal").eq(0).val());
    }

    modalSetPage(id_pag) {
        this.CreateModalGrid(id_pag);
        this.bindIndex(id_pag);
        this.FillModalGrid(id_pag);
    }

    CreateModalGrid(id_pag) {
        let page = this.pagineSource.find(f => f.id == id_pag);
        let righeXcolonne = page.formato.split("x");
        let w = parseInt(righeXcolonne[0]);
        let h = parseInt(righeXcolonne[1]);
        console.log(righeXcolonne);

        $("#grigliaModal").html("");


        let hRow = (100 / h);
        let wCol = (100 / w);

        let indiceBox = 1;
        for (let i = 0; i < h; i++) {
            let row = $("<div class=\"row\" style=\"height:" + hRow + "%\"></row>");
            for (let i2 = 0; i2 < w; i2++) {
                row.append("<div class=\"col boxMenabo overflow-hidden\" style=\"width:" + wCol + "%;border:2px solid #a5a1a1;\" id=\"Modalbox_" + indiceBox + "\"><div class=\"container d-flex align-items-center\" style=\"height:100%; font-size:30px;\"><p class=\"text-center\" style=\"width:100%;color:#a5a1a1;\">" + indiceBox + "</p></div></div>");
                // Crea l'elemento della maschera gialla semitrasparente con un'icona di warning centrale
                var mask = $("<div></div>").addClass("mask").css({
                    background: "rgba(255, 255, 0, 0.5)",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: "999",
                    display: "none",
                    width: "100%", // Larghezza desiderata
                    height: "100%", // Altezza desiderata
                    alignItems: "center",
                    justifyContent: "center"
                });

                // Crea l'elemento dell'icona di warning centrale utilizzando Bootstrap
                var icon = $("<i></i>").addClass("fas fa-exclamation-triangle").css({
                    fontSize: "50px",
                    color: "red",
                    cursor: "pointer"
                });

                // Aggiungi l'icona di warning all'elemento della maschera
                mask.append(icon);

                // Seleziona l'elemento specificato e aggiungi la maschera come figlio
                $("#Modalbox_" + indiceBox).append(mask);

                icon.click(function () {
                    me.apriModalObsoletiWarning();
                });

                indiceBox++;
            }

            $("#grigliaModal").append(row);
        }
    }

    bindIndex(id_pag) {
        let me = this;
        let page = this.pagineSource.find(f => f.id == id_pag);
        let righeXcolonne = page.formato.split("x");
        $("#cmbPosModal").empty();
        let listIndex = [];
        for (var i = 1; i <= parseInt(righeXcolonne[0]) * parseInt(righeXcolonne[1]); i++) {
            listIndex.push(i);
        }
        page.menaboRefs.forEach(function (item) {
            let result = me.geometraInstance.CalcolaSpazi(page.formato, item.indice, me.meccanicheDb[item.formato]);
            let tmpList = result.listIndexRequired;
            listIndex = listIndex.filter(function (element) {
                return tmpList.indexOf(element) === -1;
            });
        });
        let disabledList = [];
        let occupato;
        listIndex.forEach(function (item) {
            occupato = false;
            console.log($("#cmbDimModal").val());
            let result = me.geometraInstance.CalcolaSpazi(page.formato, item, me.meccanicheDb[$("#cmbDimModal").val()]);
            let tmpList = result.listIndexRequired;
            for (var i = 0; i < tmpList.length; i++) {
                let indexOccupato = listIndex.find(f => f == tmpList[i]);
                if (indexOccupato == null) {
                    occupato = true;
                    break;
                }
            }
            if (!tmpList) {
                occupato = true;
            }
            if (occupato) {
                disabledList.push(item);
            }
        });
        let allDisactive = true;

        page.menaboRefs.forEach(function (item) {
            let result = me.geometraInstance.CalcolaSpazi(page.formato, item.indice, me.meccanicheDb[item.formato]);
            let tmpList = result.listIndexRequired
            tmpList.forEach(function (item) {
                disabledList.push(item);
            });
        });

        for (let p = 0; p < listIndex.length; p++) {
            let item = listIndex[p];
            if (disabledList.includes(item)) {
                $("#cmbPosModal").append("<option value=\"" + item + "\" disabled>" + item + "</option>");
                $('#cmbPosModal option[value=' + item + ']').addClass("bg-warning");
            }
            else {
                $("#cmbPosModal").append("<option value=\"" + item + "\">" + item + "</option>");
                allDisactive = false;
            }
        }
        if (allDisactive) {
            $("#cmbPosModal").append("<option value=\"" + -1 + "\"> </option>");
            console.log("tutto disattivato");
        }
    }

    FillModalGrid(id_pag) {
        let me = this;
        let page = this.pagineSource.find(f => f.id == id_pag);
        page.menaboRefs.forEach(function (item) {
            let id_rec;
            let codice_gruppo;
            if (item.idRecord != null) {
                id_rec = item.idRecord;
            }
            if (item.codiceGruppo != null) {
                codice_gruppo = item.codiceGruppo;
            }

            let element;
            if (id_rec != null) {
                element = me.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.idRecord == id_rec);
            }
            if (codice_gruppo != null) {
                element = me.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.codiceGruppo == codice_gruppo);
            }


            $("#Modalbox_" + item.indice).find(".container").text("");
            $("#Modalbox_" + item.indice).find(".container").css({
                "background-image": "url('images/Icon_Istanta.png')",
                "background-repeat": "no-repeat",
                "background-position": "center",
                "background-size": "contain"
            });

            if (element.recordRevisionato != null) {
                $("#Modalbox_" + item.indice).find(".container").text(element.recordRevisionato.descrizione1 + " " + (element.isGruppo ? element.recordRevisionato.codiceGruppo : element.recordRevisionato.idArticoloNavigation.codice));
            }
            else {
                $("#Modalbox_" + item.indice).find(".container").text(element.recordInTracciato[keyDescr1] + " " + (element.isGruppo ? element.recordInTracciato[keyScattoCodiceGruppo] : element.recordInTracciato[keyRefCodice]));
            }

            var container = $("#Modalbox_" + item.indice).find(".container");
            var fontSize = $(window).width() * 0.015;
            container.css("font-size", fontSize);

            //$("#Modalbox_" + item.indice).find(".container").append("<img class='centered-image mx-auto img-fluid' src='images/Icon_Istanta.png' width='60' height='60'>");
        });
        this.BloccaCaselleOccupateGrid(id_pag);
    }

    BloccaCaselleOccupateGrid(id_pag) {
        let me = this;
        let pagElements = this.filterElementbyPag(id_pag);
        let page = this.pagineSource.find(f => f.id == id_pag);
        console.log(pagElements);
        pagElements.forEach(function (item) {

            let result = me.geometraInstance.CalcolaSpazi(page.formato, item.recordImpaginato.indice, me.meccanicheDb[item.recordImpaginato.formato]);
            let listCaselle = result.listIndexRequired;
            for (var i = 1; i < listCaselle.length; i++) {
                $("#Modalbox_" + listCaselle[i]).find(".container").text("");
                $("#Modalbox_" + listCaselle[i]).find(".container").append("<img class='centered-image mx-auto img-fluid' src='images/red_X.png' width='30' height='30'>");
            }

            let formatoElement = item.recordImpaginato.formato.split("x");
            for (var i = 0; i < listCaselle.length; i++) {

                if ((i % parseInt(formatoElement[0])) == 0) {
                    $("#Modalbox_" + listCaselle[i]).css("border-left", "2px solid red");
                }
                if (((i + 1) % parseInt(formatoElement[0])) == 0) {
                    $("#Modalbox_" + listCaselle[i]).css("border-right", "2px solid red");
                }

                if (Math.floor(i / parseInt(formatoElement[0])) + 1 == 1) {
                    $("#Modalbox_" + listCaselle[i]).css("border-top", "2px solid red");
                }
                if (Math.floor(i / parseInt(formatoElement[0])) + 1 == parseInt(formatoElement[1])) {
                    $("#Modalbox_" + listCaselle[i]).css("border-bottom", "2px solid red");
                }
            }
        });
    }

    sendToPage() {
        let newPageID = $("#pagModal").val();
        let newIndex = $("#cmbPosModal").val();
        let newFormat = $("#cmbDimModal").val();

        if (newIndex <= 0 || newIndex == null) {
            console.log("indice non valido");
            return;
        }


        console.log(newPageID);
        console.log(newIndex);
        console.log(newFormat);

        Call.do("Menabo", "inviaANuovaPagina/" + this.currentCodorRefModal + "/" + this.pagSelected + "/" + newPageID + "/" + newIndex + "/" + newFormat, "GET", null, this, function (result, sender) {
            if (result.esito) {
                let page = sender.pagineSource.find(f => f.id == sender.pagSelected);
                //console.log(typeof sender.currentCodorRefModal);
                //console.log(typeof page.menaboRefs[1].codiceGruppo);
                //console.log(typeof page.menaboRefs[1].idRecord);
                let element = page.menaboRefs.find(f => (f.idRecord != null && f.idRecord == sender.currentCodorRefModal) || (f.codiceGruppo != null && f.codiceGruppo == sender.currentCodorRefModal));
                page.menaboRefs = page.menaboRefs.filter(f => !(f.idRecord != null && f.idRecord == sender.currentCodorRefModal) && !(f.codiceGruppo != null && f.codiceGruppo == sender.currentCodorRefModal));

                element.idPagina = newPageID;
                element.formato = newFormat;
                element.indice = newIndex;
                let pageToAdd = sender.pagineSource.find(f => f.id == newPageID);

                pageToAdd.menaboRefs.push(element);
                let index = sender.tracciatoSource.findIndex(f => f.recordImpaginato != null && f.recordImpaginato.idPagina == sender.pagSelected && ((f.recordImpaginato.idRecord != null && f.recordImpaginato.idRecord == sender.currentCodorRefModal) || (f.recordImpaginato.codiceGruppo != null && f.recordImpaginato.codiceGruppo == sender.currentCodorRefModal)));

                sender.tracciatoSource[index].recordImpaginato.codiceGruppo = element.codiceGruppo;
                sender.tracciatoSource[index].recordImpaginato.formato = element.formato;
                sender.tracciatoSource[index].recordImpaginato.id = element.id;
                sender.tracciatoSource[index].recordImpaginato.idPagina = element.idPagina;
                sender.tracciatoSource[index].recordImpaginato.idRecord = element.idRecord;
                sender.tracciatoSource[index].recordImpaginato.indice = parseInt(element.indice);
            }
            sender.selezionataPagina();
        });
    }

    ToggleMandaAPaginaButton() {
        if (this.pagSelected == -1) {
            return;
        }
        if ($('#spostaPaginaIcon').css('display') == 'none') {
            $('#spostaPaginaIcon').css('display', 'inline');
            $('#goToButton').find("img").attr("src", "images/selectedGoTo.png");
            //$('#griglia').find('.goto_img').css('display', 'inline');
            //$('#griglia').find('.stato_revisione').css('display', 'none');
        }
        else {
            $('#spostaPaginaIcon').css('display', 'none');
            $('#goToButton').find("img").attr("src", "images/goTo.png");
            //$('#griglia').find('.goto_img').css('display', 'none');
            //$('#griglia').find('.stato_revisione').css('display', 'inline');
        }

    }

    AttivaIconeTracciato() {
        let me = this;
        $("#container_tracciato").find(".htmlImg").each(function (item) {
            let cod_ref = $(this).parent().parent().parent().parent().find("#codice_ref").text();
            let element = me.tracciatoSource.find(f => f.recordInTracciato != null && f.recordInTracciato.Referenza != null && f.recordInTracciato.Referenza.Codice == cod_ref);
            if (element != null && element.recordRevisionato != null && element.recordRevisionato.descrizioneIndd != null && element.recordRevisionato.descrizioneIndd != "") {
                $(this).css("visibility", "visible");
            }
        });

        $("#container_tracciato").find(".container").each(function (item) {
            if ($(this).attr("id_rec") != null) {
                let id_rec = $(this).attr("id_rec");
                let element = me.tracciatoSource.find(f => f.idRec == id_rec);
                //item.recordRevisionato != null && item.recordInTracciato[keyTracciatoFirma] != null && item.recordRevisionato.firmaTracciato == item.recordInTracciato[keyTracciatoFirma]
                if ((element != null && element.recordRevisionato == null) || element.recordRevisionato != null && element.recordRevisionato.firmaTracciato != null && element.recordInTracciato[keyTracciatoFirma] != null && element.recordRevisionato.firmaTracciato != element.recordInTracciato[keyTracciatoFirma]) {
                    $(this).find(".warningImg").css("visibility", "visible");
                }
            }
        });

        $("#container_tracciato").find(".container").each(function (item) {
            if ($(this).attr("id_rec") != null) {
                let id_rec = $(this).attr("id_rec");
                let element = me.tracciatoSource.find(f => f.idRec == id_rec);
                if (element != null && element.statoSelezione == 1) {
                    $(this).find("#SelezionePilotaGruppo").prop("checked", true);
                }
                else if (element != null && element.statoSelezione == 2) {
                    $(this).find("#SelezioneSecondarioGruppo").prop("checked", true);
                }

                if (element.recordInTracciato[keyRefCodice] != null && element.recordInTracciato[keyScattoCodiceGruppo] == element.recordInTracciato[keyRefCodice]) {
                    //Controlliamo però anche se è in un gruppo Multiplex
                    if (element.recordInTracciato[keyScattoCodiceGruppoMultiplex] == null) {
                        $(this).find("#SelezionePilotaGruppo").css("visibility", "hidden");
                        $(this).find("#SelezioneSecondarioGruppo").css("visibility", "hidden");
                    }
                    else {
                        $(this).find("#SelezionePilotaGruppo").css("visibility", "visible");
                        $(this).find("#SelezioneSecondarioGruppo").css("visibility", "visible");
                    }

                }

                if ($(this).find("#onoff_impaginato").is(":checked")) {

                    $(this).closest(".list-group").find(".SelezionePilotaGruppo").each(function (item) {
                        $(this).prop("disabled", true);
                        $(this).prop("checked", false);
                    });

                    $(this).closest(".list-group").find(".SelezioneSecondarioGruppo").each(function (item) {
                        $(this).prop("disabled", true);
                        $(this).prop("checked", false);
                    });
                    //$(this).find("#SelezionePilotaGruppo").prop("disabled", true);
                    //$(this).find("#SelezionePilotaGruppo").prop("checked", false);
                }
            }
        });
    }

    DisattivaIconaPilota(sender) {
        let me = this;
        let container = sender.closest(".container").closest(".list-group");
        if (sender.is(":checked")) {
            container.find(".SelezionePilotaGruppo").each(function (item) {
                $(this).prop("disabled", true);
                $(this).prop("checked", false);
                me.cambioSelezioneCheckbox($(this));
            });
            container.find(".SelezioneSecondarioGruppo").each(function (item) {
                $(this).prop("disabled", true);
                $(this).prop("checked", false);
                me.cambioSelezioneCheckbox($(this));
            });
        }
        else {
            container.find(".SelezionePilotaGruppo").each(function (item) {
                $(this).prop("disabled", false);
            });
            container.find(".SelezioneSecondarioGruppo").each(function (item) {
                $(this).prop("disabled", false);
            });
        }

    }

    DettagliTracciato(sender) {
        $("#modalDtlTracciato").find("#content").empty();
        let id_rec = sender.closest(".container").attr("id_rec");
        $("#modalDtlTracciato").attr("id_rec", id_rec);
        let element = this.tracciatoSource.find(f => f.idRec == id_rec);
        for (const param in element.recordInTracciato) {
            if ((`${param}`).includes(keyArea + ".") || (`${param}`) == keyArea || (`${param}`).includes(keyDescr + ".") || (`${param}`) == keyDescr || (`${param}`).includes(keyRef + ".") || (`${param}`) == keyRef || (`${param}`).includes(keyScatto + ".") || (`${param}`) == keyScatto || (`${param}`).includes(keyTracciato + "." || (`${param}`) == keyTracciato)) {
                continue;
            }
            console.log(`${param}: ${element.recordInTracciato[param]}`);
            console.log(typeof element.recordInTracciato[param]);
            if (typeof element.recordInTracciato[param] == "boolean") {
                let tmpHtml = '<div class="container">' +
                    '<div class="row mb-2">' +
                    '<div class="col-md-5" text-end>' +
                    '<label for="checkbox' + `${param}` + '">' + (`${param}`).replace("_", " ") + '</label>' +
                    '</div>' +
                    '<div class="col-md-auto">' +
                    '<div class="form-check text-center">' +
                    '<input class="form-check-input" type="checkbox" varType="boolean" id="' + `${param}` + '"' + (element.recordInTracciato[param] ? "checked" : "") + '>' +
                    '</div>' +
                    '</div>' +
                    '</div >' +
                    '</div >';
                $("#modalDtlTracciato").find("#content").append(tmpHtml);
            }

            if (typeof element.recordInTracciato[param] == "string") {
                let tmpHtml = '<div class="container">' +
                    '<div class="rowo mb-2">' +
                    '<div class="col-md-5" text-end>' +
                    '<label for="text' + `${param}` + '">' + (`${param}`).replace("_", " ") + '</label>' +
                    '</div>' +
                    '<div class="col-md-auto">' +
                    '<div class="form-check">' +
                    '<input class="form-control" type="text" varType="string" id="' + `${param}` + '" value="' + element.recordInTracciato[param] + '">' +
                    '</div>' +
                    '</div>' +
                    '</div >' +
                    '</div >';
                $("#modalDtlTracciato").find("#content").append(tmpHtml);
            }

            if (typeof element.recordInTracciato[param] == "number") {
                let tmpHtml = '<div class="container">' +
                    '<div class="rowo mb-2">' +
                    '<div class="col-md-5" text-end>' +
                    '<label for="number' + `${param}` + '">' + (`${param}`).replace("_", " ") + '</label>' +
                    '</div>' +
                    '<div class="col-md-auto">' +
                    '<div class="form-check">' +
                    '<input class="form-control" type="text" varType="number" id="' + `${param}` + '" value="' + element.recordInTracciato[param] + '">' +
                    '</div>' +
                    '</div>' +
                    '</div >' +
                    '</div >';
                $("#modalDtlTracciato").find("#content").append(tmpHtml);
            }
            console.log($("#" + `${param}`));
            $("#" + `${param}`).on('keypress', function (event) {
                if (event.which === 13) {
                    //console.log($(this));
                    menaboInstance.ModalDettaglioSalvaModifiche($(this));
                    $(this).removeClass("bg-danger");
                    $(this).addClass("bg-success");
                    $(this).addClass("bg-opacity-25");
                }
            });

            $("#" + `${param}`).on('input', function (event) {
                $(this).removeClass("bg-success");
                $(this).addClass("bg-danger");
                $(this).addClass("bg-opacity-25");
            });
        }
    }

    ModalDettaglioSalvaModifiche(sender) {
        showLoading();
        let idrec = $("#modalDtlTracciato").attr("id_rec");
        let element = this.tracciatoSource.find(f => f.idRec == idrec);
        console.log(element.recordInTracciato[sender.attr("id")])
        if (sender.attr("vartype") == "boolean") {
            console.log(sender.is(':checked'));
            if (element.recordInTracciato[sender.attr("id")] != sender.is(':checked')) {

                let Obj = {
                    id_rec: idrec,
                    chiave: sender.attr("id"),
                    value: sender.is(':checked'),
                    type: typeof element.recordInTracciato[sender.attr("id")]
                };
                element.recordInTracciato[sender.attr("id")] = sender.is(':checked');
                console.log(Obj);

                Call.do("Menabo", "salvaDettaglio", "PUT", Obj, this, function (result, me) {
                    console.log(result);
                    hideLoading();
                });
            }
            else {
                hideLoading();
            }

        }
        else {
            if (element.recordInTracciato[sender.attr("id")] != sender.val()) {

                let Obj = {
                    id_rec: idrec,
                    chiave: sender.attr("id"),
                    value: sender.val(),
                    type: typeof element.recordInTracciato[sender.attr("id")],
                };

                if (Obj.type == "number") {
                    element.recordInTracciato[sender.attr("id")] = parseFloat(sender.val());
                }
                else if (Obj.type == "string") {
                    element.recordInTracciato[sender.attr("id")] = sender.val();
                }

                element.recordInTracciato[sender.attr("id")] = sender.val();
                console.log(Obj);

                Call.do("Menabo", "salvaDettaglio", "PUT", Obj, this, function (result, me) {
                    console.log(result);
                    hideLoading();
                });
            }
            else {
                hideLoading();
            }
        }
    }

    modalBoxSovrapposto(sender) {
        let me = this;
        let index = sender.attr("index");
        let currentPage = this.pagineSource.find(f => f.id == this.pagSelected);
        $("#list_ref_modal").empty();
        let optionNumber = 0;
        currentPage.menaboRefs.forEach(function (item) {
            if (item.indice == index) {
                let tmpHtml;
                let elementoCercato = $(".refInMenabo[id_menabo_ref='" + item.id + "']").closest(".single_box");
                let isElementoCercatoVisible = (elementoCercato.css("display") === "block");

                if (item.codiceGruppo != null) {
                    let codiceGruppoTagliato = item.codiceGruppo.substring(0, 20);
                    if (item.codiceGruppo.length > 20) {
                        codiceGruppoTagliato += "...";
                    }
                    tmpHtml = '<option' + (isElementoCercatoVisible ? ' selected' : '') + ' value="' + index + '" index="' + index + '" optionNumber="' + optionNumber + '">' + codiceGruppoTagliato + '</option>';
                } else {
                    let id_ref = me.tracciatoSource.find(f => f.idRec == item.idRecord).recordInTracciato.Referenza.Codice;
                    tmpHtml = '<option' + (isElementoCercatoVisible ? ' selected' : '') + ' value="' + index + '" index="' + index + '" optionNumber="' + optionNumber + '">' + id_ref + '</option>';
                }

                optionNumber++;
                $("#list_ref_modal").append(tmpHtml);
            }
        });

        console.log(index);
    }

    PortaInPrimoPianoRef(sender) {
        let me = this;
        var selectedOption = sender.find(":selected");
        let index = selectedOption.attr("index");
        let indexBox = selectedOption.attr("optionNumber");
        //let currentPage = this.pagineSource.find(f => f.id == this.pagSelected);
        let findedIndex = 0;
        $("#box_" + index).find(".single_box").each(function () {
            console.log(findedIndex + " == " + indexBox);
            if (findedIndex == indexBox) {
                $(this).css("display", "block");
            }
            else {
                $(this).css("display", "none");
            }
            findedIndex++;
        });
    }

    aggiungiParametroRicerca() {
        let baseFiltro = $("#filtroTemplate").clone();
        //baseFiltro.removeAttr("id");  // Rimuovi l'ID per evitare duplicati
        baseFiltro = $(baseFiltro.html());

        let filtro_custom = this.agenzia.getForm_ricercaTracciato();
        if (filtro_custom == null) {
            $("#filterAgenzia").empty();
            $("#filterAgenzia").text("Filtro non implementato");
            $("#filterAgenzia").addClass("bg-warning bg-opacity-25");
            return;
        }

        baseFiltro.find("#ricercaTracciato").append(filtro_custom);

        $("#filterAgenzia").append(baseFiltro);

        if ($("#ricercaAgenzia").find(".form-select").length == 1) {
            $("#ricercaAgenzia").find("#trashIcon").css("visibility", "hidden");
            $("#ricercaAgenzia").find("#trashIcon").css("display", "none");
        }
    }



    rimuoviParametroRicerca(sender) {
        sender.parent().remove();
        let boolParametroRicercaPresente;
        $("#ricercaAgenzia").find(".input-group").each(function () {
            let Value = $(this).find(".form-select").val();
            if (Value == "0" || $(this).find("#ricercaText").val() == "") {
                $(this).find(".form-select").removeClass("bg-success");
                $(this).find(".form-select").removeClass("bg-opacity-25");
            }
            else {
                boolParametroRicercaPresente = true;
            }
        });

        if (boolParametroRicercaPresente) {
            $("#container_tracciato").find(".record_menabo_gruppo").each(function () {
                $(this).closest(".list-group").css("display", "none");
            });

            $("#container_tracciato").find(".record_menabo").each(function () {
                if (!$(this).attr("codice_gruppo").includes(",")) {
                    $(this).css("display", "none");
                }

            });

            $("#container_tracciato").find(".record_menabo").each(function () {
                let record = $(this).attr("id_rec");
                let element = me.tracciatoSource.find(f => f.idRec == record);
                let recordElement = $(this);
                $("#ricercaAgenzia").find(".input-group").each(function () {
                    let Value = $(this).find(".form-select").val();
                    if (Value != "0" && $(this).find("#ricercaText").val() != "") {
                        $(this).find(".form-select").addClass("bg-success");
                        $(this).find(".form-select").addClass("bg-opacity-25");
                        if (element.recordInTracciato[Value].toLowerCase().includes(sender.val().toLowerCase())) {
                            if (!recordElement.attr("codice_gruppo").includes(",")) {
                                recordElement.css("display", "block");
                            }
                            else {
                                recordElement.closest(".list-group").css("display", "block");
                            }
                        }
                    }
                    else {
                        $(this).find(".form-select").removeClass("bg-danger");
                        $(this).find(".form-select").removeClass("bg-success");
                        $(this).find(".form-select").removeClass("bg-opacity-25");
                    }
                });
            });
        }
        else {

            $("#container_tracciato").find(".record_menabo_gruppo").each(function () {
                $(this).closest(".list-group").css("display", "block");
            });

            $("#container_tracciato").find(".record_menabo").each(function () {
                if (!$(this).attr("codice_gruppo").includes(",")) {
                    $(this).css("display", "block");
                }

            });
        }

    }

    rimuoviTuttiParametriRicerca() {
        $("#filterAgenzia").html("");
        this.aggiungiParametroRicerca();

        $("#container_tracciato").find(".record_menabo_gruppo").each(function () {
            $(this).closest(".list-group").css("display", "block");
        });

        $("#container_tracciato").find(".record_menabo").each(function () {
            if (!$(this).attr("codice_gruppo").includes(",")) {
                $(this).css("display", "block");
            }
        });
    }

    ricercaInTracciatoMenabo(sender) {
        let me = this;
        let checkSwitchNascondiImpaginati = $("#switchNascondiImpaginati").prop("checked");
        let resetFiltro = sender.attr("id") == "ricercaTracciato";
        if (event.which === 13 || sender.attr("id") == "switchNascondiImpaginati" || resetFiltro) {
            let selectionValue = sender.closest("ricercaAgenzia").find(".input-group").find(".form-select").val();
            if ((selectionValue == "0" || sender.val() == "") && !resetFiltro) {
                sender.closest(".input-group").find(".form-select").addClass("bg-danger");
                sender.closest(".input-group").find(".form-select").addClass("bg-opacity-25");
            }
            else {
                sender.closest(".input-group").find(".form-select").addClass("bg-success");
                sender.closest(".input-group").find(".form-select").addClass("bg-opacity-25");

                $("#container_tracciato").find(".record_menabo_gruppo").each(function () {
                    $(this).closest(".list-group").css("display", "none");
                });

                $("#container_tracciato").find(".record_menabo").each(function () {
                    if (!$(this).attr("codice_gruppo").includes(",")) {
                        $(this).css("display", "none");
                    }
                });

                $("#container_tracciato").find(".record_menabo").each(function () {
                    if (checkSwitchNascondiImpaginati) {
                        let record = $(this).attr("id_rec");
                        let element = me.tracciatoSource.find(f => f.idRec == record);
                        let recordElement = $(this);
                        let validRecord = true;
                        $("#ricercaAgenzia").find(".input-group").each(function () {
                            let Value = $(this).find(".form-select").val();
                            let textRicerca = $(this).find("#ricercaText").val().toLowerCase();
                            if (Value != "0" && $(this).find("#ricercaText").val() != "") {
                                $(this).find(".form-select").addClass("bg-success");
                                $(this).find(".form-select").addClass("bg-opacity-25");
                                if (element.recordInTracciato[Value] == null || !element.recordInTracciato[Value].toLowerCase().includes(textRicerca)) {
                                    validRecord = false;
                                }
                            }
                            else {
                                $(this).find(".form-select").removeClass("bg-danger");
                                $(this).find(".form-select").removeClass("bg-success");
                                $(this).find(".form-select").removeClass("bg-opacity-25");
                                //if (!recordElement.find("#onoff_impaginato").prop("checked")) {
                                //    let codGr = recordElement.attr("codice_gruppo");
                                //    if (!codGr.includes(",") && !recordElement.find("#onoff_impaginato").prop("checked")) {
                                //        recordElement.css("display", "block");
                                //    }
                                //    else if (codGr.includes(",") && !recordElement.find("#onoff_impaginato").prop("checked") && !recordElement.closest(".list-group").find("#onoff_impaginato").prop("checked")) {
                                //        recordElement.closest(".list-group").css("display", "block");
                                //    }
                                //}
                            }
                            if (validRecord) {
                                let codGr = recordElement.attr("codice_gruppo");
                                if (!codGr.includes(",") && !recordElement.find("#onoff_impaginato").prop("checked")) {
                                    recordElement.css("display", "block");
                                }
                                else if (codGr.includes(",") && !recordElement.find("#onoff_impaginato").prop("checked") && !recordElement.closest(".list-group").find("#onoff_impaginato").prop("checked")) {
                                    recordElement.closest(".list-group").css("display", "block");
                                }
                            }
                        });
                    }
                    else {
                        let record = $(this).attr("id_rec");
                        let element = me.tracciatoSource.find(f => f.idRec == record);
                        let recordElement = $(this);
                        let validRecord = true;
                        $("#ricercaAgenzia").find(".input-group").each(function () {
                            let Value = $(this).find(".form-select").val();
                            if (Value != "0" && $(this).find("#ricercaText").val() != "") {
                                $(this).find(".form-select").addClass("bg-success");
                                $(this).find(".form-select").addClass("bg-opacity-25");
                                let textRicerca = $(this).find("#ricercaText").val().toLowerCase();
                                if (element.recordInTracciato[Value] == null || !element.recordInTracciato[Value].toLowerCase().includes(textRicerca)) {
                                    validRecord = false;
                                }                              
                            }
                            else {
                                $(this).find(".form-select").removeClass("bg-danger");
                                $(this).find(".form-select").removeClass("bg-success");
                                $(this).find(".form-select").removeClass("bg-opacity-25");

                                //let codGr = recordElement.attr("codice_gruppo");
                                //if (!codGr.includes(",")) {
                                //    recordElement.css("display", "block");
                                //}
                                //else {
                                //    recordElement.closest(".list-group").css("display", "block");
                                //}
                            }
                        });
                        if (validRecord) {
                            if (!recordElement.attr("codice_gruppo").includes(",")) {
                                recordElement.css("display", "block");
                            }
                            else {
                                recordElement.closest(".list-group").css("display", "block");
                            }
                        }
                    }
                });
            }
            this.contaArticoliInTracciato();
            me.ContaRefPerSegnaposti();
        }
        if (resetFiltro && sender.val() == 0) {
            sender.closest(".input-group").find("#ricercaText").val("");
        }
    }

    //ricercaInTracciatoMenabo(sender) {
    //    let me = this;
    //    if (event.which === 13) {
    //        let selectionValue = sender.closest(".input-group").find(".form-select").val();
    //        if (selectionValue == "0" || sender.val() == "") {
    //            sender.closest(".input-group").find(".form-select").addClass("bg-danger");
    //            sender.closest(".input-group").find(".form-select").addClass("bg-opacity-25");
    //        }
    //        else {
    //            sender.closest(".input-group").find(".form-select").addClass("bg-success");
    //            sender.closest(".input-group").find(".form-select").addClass("bg-opacity-25");

    //            $("#container_tracciato").find(".record_menabo_gruppo").each(function () {
    //                $(this).closest(".list-group").css("display", "none");
    //            });

    //            $("#container_tracciato").find(".record_menabo").each(function () {
    //                if (!$(this).attr("codice_gruppo").includes(",")) {
    //                    $(this).css("display", "none");
    //                }

    //            });

    //            $("#container_tracciato").find(".record_menabo").each(function () {
    //                let record = $(this).attr("id_rec");
    //                let element = me.tracciatoSource.find(f => f.idRec == record);
    //                let recordElement = $(this);
    //                $("#ricercaAgenzia").find(".input-group").each(function () {
    //                    let Value = $(this).find(".form-select").val();
    //                    if (Value != "0" && $(this).find("#ricercaText").val() != "") {
    //                        $(this).find(".form-select").addClass("bg-success");
    //                        $(this).find(".form-select").addClass("bg-opacity-25");
    //                        if (element.recordInTracciato[Value].toLowerCase().includes($(this).parent().find("#ricercaText").val().toLowerCase())) {
    //                            if (!recordElement.attr("codice_gruppo").includes(",")) {
    //                                recordElement.css("display", "block");
    //                            }
    //                            else {
    //                                recordElement.closest(".list-group").css("display", "block");
    //                            }
    //                        }
    //                    }
    //                    else {
    //                        $(this).find(".form-select").removeClass("bg-danger");
    //                        $(this).find(".form-select").removeClass("bg-success");
    //                        $(this).find(".form-select").removeClass("bg-opacity-25");
    //                    }
    //                });
    //            });
    //        }
    //        this.contaArticoliInTracciato();
    //        this.agenzia.AggiornaSegnapostiPostRicerca();
    //    }
    //}

    //aggiustaRicerca(sender) {
    //    this.ricercaInTracciatoMenabo(sender); //workaround da correggere in merito al filtro agenzia
    //}

    disattivaTarget() {
        $("#offcanvasTracciato").find(".record_menabo_gruppo").each(function () {
            if ($(this).find("#onoff_impaginato").prop("checked")) {
                //console.log($(this).find(".targetImgGrp"));
                $(this).find(".targetImgGrp").css("display", "none");
            }
        });

        $("#offcanvasTracciato").find(".record_menabo").each(function () {
            if ($(this).find("#onoff_impaginato").prop("checked")) {
                //console.log($(this).find(".targetImg"));
                $(this).find(".targetImg").css("display", "none");
                if ($(this).attr("codice_gruppo").includes(",")) {
                    $(this).closest(".list-group").find(".record_menabo_gruppo").find(".targetImgGrp").css("display", "none");
                }
            }
            //console.log($(this).attr("codice_gruppo") + " = " + $(this).attr("codice_gruppo").includes(","));
            if ($(this).attr("codice_gruppo").includes(",") && $(this).closest(".list-group").find(".record_menabo_gruppo").find("#onoff_impaginato").prop("checked")) {
                $(this).find(".targetImg").css("display", "none");
            }
        });
    }

    opacizzaRecordInTracciato() {
        $("#offcanvasTracciato").find(".record_menabo_gruppo").each(function () {
            if ($(this).find("#onoff_impaginato").prop("checked")) {
                //console.log($(this).find(".targetImgGrp"));
                $(this).parent().parent().css("opacity", "0.6");
            }
            else {
                $(this).parent().parent().css("opacity", "1");
            }
        });

        $("#offcanvasTracciato").find(".record_menabo").each(function () {
            if ($(this).find("#onoff_impaginato").prop("checked")) {
                //console.log($(this).find(".targetImg"));
                $(this).css("opacity", "0.6");
            }
            else {
                $(this).css("opacity", "1");

            }
        });
    }

    drawline(sender) {
        // Coordinate del punto fisso
        console.log()
        if (sender.attr("id") == "targetImgGrp") {
            this.targetElement = sender.closest(".record_menabo_gruppo");
        }
        else {
            this.targetElement = sender.closest(".record_menabo");
        }
        // Calcola la posizione centrale dell'immagine
        let imgWidth = sender.width();
        let imgHeight = sender.height();
        let imgOffset = sender.offset();
        let x1 = imgOffset.left + (imgWidth / 2);
        let y1 = imgOffset.top + (imgHeight / 2);
        this.canvasAnchorPoint = [x1, y1];

        // Gestisci l'evento del movimento del mouse
        window.addEventListener('mousemove', this.startCanvas);
        $("#griglia").find(".boxMenabo").each(function () {
            $(this).on('click', menaboInstance.placeRef);
        });
        //Gestisci l'evento click del mouse
        setTimeout(function () {
            window.addEventListener('click', menaboInstance.stopCanvas);
        }, 10);

    }

    placeRef() {
        //console.log(menaboInstance.targetElement);
        //console.log(this);
        let id = this.id;
        let bool = false;
        let refFinded = false;
        $(this).find(".refInMenabo").each(function () {
            refFinded = true;
            let elementCorrupted = menaboInstance.tracciatoSourceObsoleti.find(f => f.recordImpaginato != null && f.recordImpaginato.id == parseInt($(this).attr("id_menabo_ref")));
            if (elementCorrupted != null) {
                alert("Impossibile posizionare l'elemento, risolvere prima gli errori all'indice selezionato");
                bool = true;
                return;
            }
        });
        if (bool) {
            return;
        }
        const numero = parseInt(id.replace("box_", ""));
        if (refFinded) {
            if (menaboInstance.targetElement.hasClass("record_menabo_gruppo")) {
                $("#modalSwapOrMultiplex").attr("idMenaboRef", 0);
                $("#modalSwapOrMultiplex").attr("codiceGruppoOIdRec", menaboInstance.targetElement.attr("codice_gruppo"));
                $("#modalSwapOrMultiplex").attr("newInx", numero);
                $("#modalSwapOrMultiplex").modal("show");

            }
            else {
                $("#modalSwapOrMultiplex").attr("idMenaboRef", 0);
                $("#modalSwapOrMultiplex").attr("codiceGruppoOIdRec", menaboInstance.targetElement.attr("id_rec"));
                $("#modalSwapOrMultiplex").attr("newInx", numero);
                $("#modalSwapOrMultiplex").modal("show");
            }
            return;
        }

        menaboInstance.targetElement.find("#onoff_impaginato").prop("checked", true);
        let codice_gruppo = menaboInstance.targetElement.attr("codice_gruppo");
        let id_rec = menaboInstance.targetElement.attr("id_rec");
        //console.log(codice_gruppo);
        //console.log(id_rec);
        menaboInstance.inMenabo(menaboInstance.targetElement.find("#onoff_impaginato"), codice_gruppo, id_rec, numero);
    }

    startCanvas(event) {

        let canvas = document.getElementById('myCanvas');
        let ctx = canvas.getContext('2d');

        // Coordinate del mouse
        let x2 = event.clientX;
        let y2 = event.clientY;

        // Cancella il canvas per disegnare la nuova linea
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Disegna la linea tra il punto fisso e la posizione del mouse
        ctx.beginPath();
        ctx.moveTo(menaboInstance.canvasAnchorPoint[0], menaboInstance.canvasAnchorPoint[1]);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    stopCanvas() {
        let canvas = document.getElementById('myCanvas');
        let ctx = canvas.getContext('2d');

        // Cancella il canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        $("#griglia").find(".boxMenabo").each(function () {
            $(this).off('click', menaboInstance.placeRef);
        });

        // Rimuovi i listener dell'evento del movimento del mouse e dell'evento click del mouse
        window.removeEventListener("mousemove", menaboInstance.startCanvas);
        window.removeEventListener('click', menaboInstance.stopCanvas);
    }

    ordinaRefInTracciato() {
        //let primaryHtml = [];
        //let secondaryHtml = [];
        //let allOtherHtml = [];
        //let parent;
        //$("#offcanvasTracciato").find(".record_menabo_gruppo").each(function () {
        //    parent = $(this).parent().parent();
        //    parent.find(".record_menabo").each(function () {
        //        let currentElement = $(this);
        //        if (currentElement.find(".SelezionePilotaGruppo").prop("checked")) {
        //            primaryHtml.push(currentElement);
        //            currentElement.remove();
        //        }
        //        else if (currentElement.find(".SelezioneSecondarioGruppo ").prop("checked")) {
        //            secondaryHtml.push(currentElement);
        //            currentElement.remove();
        //        }
        //        else {
        //            allOtherHtml.push(currentElement);
        //            currentElement.remove();
        //        }
        //    });
        //    primaryHtml.forEach(function (item) {
        //        parent.append(item);
        //    });
        //    secondaryHtml.forEach(function (item) {
        //        parent.append(item);
        //    });
        //    allOtherHtml.forEach(function (item) {
        //        parent.append(item);
        //    });

        //    primaryHtml = [];
        //    secondaryHtml = [];
        //    allOtherHtml = [];
        //});      
    }

    ordinaRefInDettaglio() {
        let primaryHtml = [];
        let secondaryHtml = [];
        let allOtherHtml = [];
        let parent;
        //modalDtl
        //record-revisione

        $("#modalDtl").find(".record-revisione").each(function () {
            parent = $(this).parent().parent();
            console.log(parent);
            parent.find(".record-revisione").each(function () {
                let currentElement = $(this).parent();
                if (currentElement.find("#cmbStatoSelezione").css("visibility") == "hidden") {
                }
                else if (currentElement.find("#cmbStatoSelezione").val() == "1") {
                    primaryHtml.push(currentElement);
                    currentElement.remove();
                }
                else if (currentElement.find("#cmbStatoSelezione ").val() == "2") {
                    secondaryHtml.push(currentElement);
                    currentElement.remove();
                }
                else {
                    allOtherHtml.push(currentElement);
                    currentElement.remove();
                }
            });
            primaryHtml.forEach(function (item) {
                parent.append(item);
            });
            secondaryHtml.forEach(function (item) {
                parent.append(item);
            });
            allOtherHtml.forEach(function (item) {
                parent.append(item);
            });

            primaryHtml = [];
            secondaryHtml = [];
            allOtherHtml = [];
        });
    }

    showFoto(sender) {
        console.log("showFoto");
        const senderElement = sender.get(0); // Prendi il primo elemento jQuery corrispondente
        const senderRect = senderElement.getBoundingClientRect();
        const senderTop = senderRect.top;
        const senderLeft = senderRect.left;
        let senderWidth = sender.width();
        let senderHeight = sender.height();

        let element = sender.closest(".record_menabo");
        let codiceFoto = this.tracciatoSource.find(f => f.idRec == element.attr("id_rec")).recordInTracciato[keyRefCodice];
        console.log(codiceFoto);
        console.log(senderWidth);
        console.log(senderTop);
        console.log(senderLeft);
        $("#imageBox").css("display", "block");
        $("#imageFoto").css("visibility", "hidden");
        $("#imageFoto").attr("src", "Thumb?codice=" + codiceFoto + "&id_foto=0&w=200&h=200");
        $("#imageBox").css({
            "top": senderTop + senderHeight / 2 + "px",
            "left": senderLeft + senderWidth + 10 + "px"
        });

    }

    hideFoto() {
        console.log("hideFoto");
        $("#imageBox").css("display", "none");
    }

    centraFoto(sender) {
        console.log("centraFoto");
        $("#imageFoto").css("height", "");
        $("#imageFoto").css("width", "");
        let senderWidth = sender.width();
        let senderHeight = sender.height();
        if (senderHeight > senderWidth) {
            if (senderHeight > 150) {
                $("#imageFoto").css("height", "150px");
            }
        }
        else {
            if (senderWidth > 150) {
                $("#imageFoto").css("width", "150px");
            }
        }

        const senderElement = sender.get(0); // Prendi il primo elemento jQuery corrispondente
        const senderRect = senderElement.getBoundingClientRect();
        const senderTop = senderRect.top;
        const senderLeft = senderRect.left;
        $("#imageFoto").css("visibility", "visible");
        $("#imageBox").css({
            "top": senderTop - senderHeight / 2 + "px",
            "left": senderLeft + "px"
        });
    }

    showAlertModal(sender) {
        let Modal = ($("#modalDtl").hasClass("show") ? $("#modalDtl") : $("#modalVisualizzaBox"));
        let width = Modal.find("#content").width();
        sender.prop("disabled", true);
        if (sender != null) { }
        const appendAlert = (message, type) => {
            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
            const content = $('<div></div>').text(message)
            const closeButton = $('<button></button>').addClass('btn-close').attr({
                'type': 'button',
                'data-bs-dismiss': 'alert',
                'aria-label': 'Close'
            })
            wrapper.append(content, closeButton)
            Modal.find("#liveAlertPlaceholder").css("width", width + "px");
            Modal.find('#liveAlertPlaceholder').append(wrapper)

            // Chiude automaticamente l'alert dopo 1 secondo
            setTimeout(function () {
                wrapper.alert('close')
                if (sender != null) { sender.prop("disabled", false); }
            }, 2000);
        }

        appendAlert('Revisione effettuata', 'success');
    }

    showAlert(esito, message, secondDuration) {

        const appendAlert = (message, type) => {
            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
            const content = $('<div></div>').html(message)
            const closeButton = $('<button></button>').addClass('btn-close').attr({
                'type': 'button',
                'data-bs-dismiss': 'alert',
                'aria-label': 'Close'
            })
            wrapper.append(content, closeButton)
            $('#msg_container').css("display", "block");
            $('#msg_container').append(wrapper)

            // Chiude automaticamente l'alert dopo 1 secondo
            if (secondDuration > 0) {
                setTimeout(function () {
                    wrapper.alert('close')
                    if (sender != null) { sender.prop("disabled", false); }
                }, secondDuration*1000);
            }
        }

        appendAlert(message, esito);
    }


    hideFotoIconTracciato() {
        let me = this;
        $("#container_tracciato").find(".fotoIcon").each(function () {
            let record = $(this).closest(".record_menabo");
            let recordIdRec = record.attr("id_rec");
            let element = me.tracciatoSource.find(f => f.idRec == recordIdRec);
            if (element.hasFoto == 2) {
                $(this).css("visibility", "hidden");
            }
        });
    }

    assegnaBackgroundColorToSelezione(element) {
        let value = $(element).val();
        if (value == 1) {
            $(element).removeClass("bg-warning");
            $(element).addClass("bg-primary");
            $(element).addClass("bg-opacity-50");
        }
        else if (value == 2) {
            $(element).removeClass("bg-primary");
            $(element).addClass("bg-warning");
            $(element).addClass("bg-opacity-50");
        }
        else {
            $(element).removeClass("bg-primary");
            $(element).removeClass("bg-warning");
            $(element).addClass("bg-opacity-50");
        }
    }

    ControllaPrimarie(modal) {
        let primarie = 0;
        let secondarie = 0;
        let returnObj = {
            result: false,
            message: "",
            modalWarning: "",
        }
        let isSingolo = true;
        if (modal.attr("id") == "modalVisualizzaBox") {
            isSingolo = modal.find(".oggetto_multiplex_container").length == 1;
            modal.find(".oggetto_multiplex_container").each(function () {
                if ($(this).find("#cmbStatoSelezioneMultiplex").val() == 1) {
                    primarie++;
                }
                else if ($(this).find("#cmbStatoSelezioneMultiplex").val() == 2) {
                    secondarie++;
                }
            });
        }
        else {
            isSingolo = modal.find(".record-revisione").length == 1;
            modal.find(".record-revisione").each(function () {
                if ($(this).find("#cmbStatoSelezione").val() == 1) {
                    primarie++;
                }
                else if ($(this).find("#cmbStatoSelezione").val() == 2) {
                    secondarie++;
                }
            });
        }
        if (isSingolo) {
            returnObj.message = ("");
            returnObj.result = true;
        }
        else if (primarie < 1) {
            returnObj.message = ("Non hai specificato nessuna referenza primaria, chiudere lo stesso?");
            returnObj.modalWarning = ("Referenza primaria mancante");
            returnObj.result = false;
        }
        else if (primarie > 1) {
            returnObj.message = ("Hai specificato più di una referenza primaria, chiudere lo stesso?")
            returnObj.modalWarning = ("Inserita referenza primaria multipla");
            returnObj.result = false;
        }
        else if (secondarie == 0) {
            returnObj.message = ("Non hai specificato nessuna referenza secondaria, chiudere lo stesso?")
            returnObj.modalWarning = ("Nessuna referenza secondaria impostata");
            returnObj.result = true;
        }
        else {
            returnObj.message = ("");
            returnObj.result = true;
        }

        return returnObj;
    }

    applyIconToMultiplexWithSelectionError() {
        let me = this;
        let primarie = 0;
        $(".multiplexSelection").each(function () {
            let box = $(this).closest(".boxMenabo");
            box.find(".single_box").each(function () {
                let id = $(this).find(".refInMenabo").attr("id_rec");
                let isGruppo = false;
                if (id == null) {
                    id = $(this).find(".refInMenabo").attr("codice_gruppo");
                    isGruppo = true;
                }
                if (isGruppo) {
                    if (me.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == id).length <= 0) {
                        return;
                    }
                    me.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == id).forEach(function (item) {
                        if (item.statoSelezione == 1) {
                            primarie++;
                        }
                    });
                }
                else {
                    let element = me.tracciatoSource.find(f => f.idRec == id);
                    if (element == null) {
                        return;
                    }
                    if (element.statoSelezione == 1) {
                        primarie++;
                    }
                }

            });
            if (primarie !== 1) {
                $(this).find("img.warning-triangle").remove();
                $(this).append('<img width="20" class="mx-1 mb-2 warning-triangle" src="images/warningTriangle.png" alt="Errore in impostazione referenze primarie" title="Errore in impostazione referenze primarie">');
            } else {
                $(this).find("img.warning-triangle").remove();
            }

            primarie = 0;
        });
    }

    multiplexMostraErrore(idModal) {
        let error = this.ControllaPrimarie($("#" + idModal));
        if (error.modalWarning != "") {
            $("#" + idModal).find("#primarieWarning").css("display", "block");
            $("#" + idModal).find("#primarieWarning").text(error.modalWarning);
            if (error.result) {
                $("#" + idModal).find("#primarieWarning").removeClass("bg-danger");
                $("#" + idModal).find("#primarieWarning").addClass("bg-warning");
            }
            else {
                $("#" + idModal).find("#primarieWarning").addClass("bg-danger");
            }
        }
        else {
            $("#" + idModal).find("#primarieWarning").css("display", "none");
        }
    }

    MandaTuttaPaginaButton() {
        let PagineLibere = [];
        let thisPage = this.pagineSource.find(f => f.id == this.pagSelected);
        console.log(thisPage);
        console.log(this.pagSelected);

        let bool;
        thisPage.menaboRefs.forEach(function (item) {
            if (!bool) {
                let corruptedElement = menaboInstance.tracciatoSourceObsoleti.find(f => f.recordImpaginato != null && f.recordImpaginato.id == item.id);
                if (corruptedElement != null) {
                    alert("Impossibile spostare la pagina, alcuni elementi richiedono l'intervento dell'operatore");
                    bool = true;
                }
            }
        });
        if (bool) {
            return;
        }
        PagineLibere = this.pagineSource.filter(f => f.menaboRefs.length == 0 && f.id != thisPage.id);
        $("#selezionaPaginaACuiMandarePagina").empty();
        $("#selezionaPaginaACuiMandarePagina").append("<option value=0>Seleziona pagina</option>");
        PagineLibere.forEach(function (item) {
            $("#selezionaPaginaACuiMandarePagina").append("<option value=" + item.id + ">Pagina " + item.numero + "</option>")
        });
        $("#modalspostatuttapag").modal("show");
    }

    spostaTuttoAPagina(senderSelection) {
        if (senderSelection.val() == 0) {
            return;
        }
        let elements = this.pagineSource.find(f => f.id == this.pagSelected).menaboRefs;
        let elementsToSend = [];
        let obj;
        elements.forEach(function (item) {
            obj = {
                Id: item.id,
                IdRecord: item.idRecord,
                CodiceGruppo: item.codiceGruppo,
                IdPagina: item.idPagina,
                Indice: item.indice,
                Formato: item.formato
            }
            elementsToSend.push(obj);
        })
        console.log(elementsToSend);
        console.log(senderSelection.val());

        let objToSend = {
            articoli: elementsToSend,
        }
        Call.do("Menabo", "spostaAPaginaDiMassa/" + parseInt(senderSelection.val()) + "/" + this.idTracciato, "PUT", objToSend, this, function (result, sender) {
            if (result.esito) {
                let page = sender.pagineSource.find(f => f.id == sender.pagSelected);
                let newFormato = page.formato;
                let newMastro = page.idMastro;
                let elements = page.menaboRefs;
                page.menaboRefs = [];

                elements.forEach(function (item) {
                    item.idPagina = parseInt(senderSelection.val());
                });

                let pageToAdd = sender.pagineSource.find(f => f.id == senderSelection.val());
                pageToAdd.formato = newFormato;
                pageToAdd.idMastro = newMastro;
                pageToAdd.menaboRefs = elements;

                elements.forEach(function (item) {
                    let index = sender.tracciatoSource.findIndex(f => f.recordImpaginato != null && /*f.recordImpaginato.idPagina == sender.pagSelected &&*/ ((item.idRecord != null && f.recordImpaginato.idRecord != null && f.recordImpaginato.idRecord == item.idRecord) || (item.codiceGruppo != null && f.recordImpaginato.codiceGruppo != null && f.recordImpaginato.codiceGruppo == item.codiceGruppo)));
                    sender.tracciatoSource[index].recordImpaginato.idPagina = item.idPagina;
                });
            }
            else {
                setTimeout(function () {
                    alert("Spostamento fallito");
                }, 200);
            }
            sender.selezionataPagina();
        });
    }

    TogglePoP(toggle) {
        let toggleValue = toggle.prop('checked');
        let id_rec = toggle.closest(".record_menabo").attr("id_rec");
        let element = this.tracciatoSource.find(f => f.idRec == id_rec);
        let codice = element.recordInTracciato[keyRefCodice]
        let obj = {
            id: codice,
            value: toggleValue
        }
        this.ModificaInPop([obj]);
    }

    SetAllPoP(bool) {
        let me = this;
        let listObj = [];
        $("#container_tracciato").find(".container").each(function (item) {
            console.log([$(this).css("display"), ($(this).attr("codice_gruppo").indexOf(",") == -1 ? true : $(this).parent().css("display") != "none")]);

            if ($(this).css("display") != "none" && ($(this).attr("codice_gruppo").indexOf(",") == -1 ? true : $(this).parent().css("display") != "none")) {
                console.log("ENTRATO");
                let toggleValue = bool;
                let id_rec = $(this).attr("id_rec");
                if (id_rec != null) {
                    console.log("pusho");
                    let element = me.tracciatoSource.find(f => f.idRec == id_rec);
                    let codice = element.recordInTracciato[keyRefCodice]
                    let obj = {
                        id: codice,
                        value: toggleValue
                    }
                    listObj.push(obj);
                }
            }
        });

        this.ModificaInPop(listObj);
    }

    ModificaInPop(listObjIdRecBool) {
        let objToSend = {
            PoPElements: listObjIdRecBool,
        }

        showLoading()
        Call.do("Menabo", "modificaUscitaInPoP/" + this.idTracciato, "PUT", objToSend, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                listObjIdRecBool.forEach(function (item) {
                    let element;
                    if (item.id.indexOf(",") == -1) {
                        element = sender.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == item.id);
                    }
                    else {
                        element = sender.tracciatoSource.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == item.id);
                    }
                    if (element == null) {
                        console.error("elemento non trovato in locale");
                    }
                    else {
                        if (!item.value) {
                            element.recordInTracciato.FuoriPoP = true;
                        }
                        else {
                            delete element.recordInTracciato.FuoriPoP;
                        }
                    }
                })
                sender.setTogglePoPTracciato();
            }
            else {
                alert("Errore durante l'operazione, ricaricare la pagina");
            }
            hideLoading();
        });
    }

    setTogglePoPTracciato() {
        let me = this;
        $("#container_tracciato").find(".container").each(function (item) {
            if ($(this).attr("id_rec") != null) {
                let id_rec = $(this).attr("id_rec");
                let element = me.tracciatoSource.find(f => f.idRec == id_rec);
                if (element != null && element.recordInTracciato.FuoriPoP != null) {
                    $(this).find("#InPoPSwitch").prop("checked", false);
                }
                else {
                    $(this).find("#InPoPSwitch").prop("checked", true);
                }
            }
        });
    }

    apriModalObsoletiWarning(sender) {
        let me = this;
        let box = sender.closest(".boxMenabo");
        let listaIdRefImpaginateObsolete = [];
        let listaIdRefImpaginate = [];
        let text = "";
        let elementiAssentiGruppo = [];
        let elementiPresentiGruppoInAltroGruppo = [];
        let elementiPresentiGruppoSingoli = [];
        let listCodiciGruppo = [];
        let ListaCodiceGruppoGruppiConAggiunte = [];
        box.find(".single_box").each(function () {
            let id = $(this).find(".refInMenabo").attr("id_menabo_ref");
            let element = me.tracciatoSourceObsoleti.find(f => f.recordImpaginato != null && f.recordImpaginato.id == id);
            if (element != null) {
                listaIdRefImpaginateObsolete.push(element);
            }
            else {
                element = me.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.id == id);
                if (element != null) {
                    listaIdRefImpaginate.push(element);
                }
                else {
                    ListaCodiceGruppoGruppiConAggiunte.push($(this).find(".refInMenabo").attr("codice_gruppo"));
                }
            }
        });
        if (ListaCodiceGruppoGruppiConAggiunte.length > 0) {
            let text = "";
            ListaCodiceGruppoGruppiConAggiunte.forEach(function (item) {
                text += "Il gruppo <span class='text-danger'>" + item + "</span> non è più valido a causa dell'aggiunta di nuovi elementi.<br>";
            });
            if (listaIdRefImpaginate.length > 1) {
                let vecchioCodiceMultiplex = (listaIdRefImpaginate[0].isGruppo ? this.tracciatoSource.find(listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppo].split(",")[0]).recordInTracciato[keyScattoCodiceGruppoMultiplex] : listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppoMultiplex]);
                text += "Il multiplex precedentemente composto da <span class='text-danger'>" + vecchioCodiceMultiplex + "</span> non è più valido e diventerà <span class='text-danger'>";
                let nuovoCodiceMultiplex = "";
                ListaCodiceGruppoGruppiConAggiunte.forEach(function (item) {
                    vecchioCodiceMultiplex = vecchioCodiceMultiplex.replace(item, "");
                    vecchioCodiceMultiplex.replace(",,", ",");
                    if (vecchioCodiceMultiplex[vecchioCodiceMultiplex.length - 1] == ",") {
                        vecchioCodiceMultiplex = vecchioCodiceMultiplex.slice(0, -1);
                    }
                    if (vecchioCodiceMultiplex[0] == ",") {
                        vecchioCodiceMultiplex = vecchioCodiceMultiplex.substring(1);
                    }
                });
                nuovoCodiceMultiplex = vecchioCodiceMultiplex;
                text += nuovoCodiceMultiplex + "</span>";

            }
            else if (listaIdRefImpaginate.length == 1) {
                let vecchioCodiceMultiplex = (listaIdRefImpaginate[0].isGruppo ? this.tracciatoSource.find(listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppo].split(",")[0]).recordInTracciato[keyScattoCodiceGruppoMultiplex] : listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppoMultiplex]);
                text += "Il multiplex <span class='text-danger'>" + vecchioCodiceMultiplex + "</span> non conta più elementi a sufficienza e verrà rimosso, al suo posto rimarrà";
                if (listaIdRefImpaginate[0].isGruppo) {
                    text += " il gruppo <span class='text-danger'>" + listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppo] + "</span>.";
                }
                else {
                    text += " il singolo <span class='text-danger'>" + listaIdRefImpaginate[0].recordInTracciato[keyRefCodice] + "</span>.";
                }
            }
            let string = "";
            ListaCodiceGruppoGruppiConAggiunte.forEach(function (item) {
                string += item + "-";
            });
            string = string.slice(0, -1);
            $('#modalWarningVersione').attr("refDaCorreggere", string);
            $('#modalWarningVersione').find(".modal-body").html(text);
            $('#modalWarningVersione').modal('show');
            return;
        }
        listaIdRefImpaginateObsolete.forEach(function (item) {
            if (item.isObsoleto) {
                if (item.isGruppo) {
                    elementiAssentiGruppo = [];
                    elementiPresentiGruppoInAltroGruppo = [];
                    elementiPresentiGruppoSingoli = [];
                    listCodiciGruppo = item.recordInTracciato[keyScattoCodiceGruppo].split(",");
                    listCodiciGruppo.forEach(function (item2) {
                        let element = me.tracciatoSourceObsoleti.find(f => f.recordInTracciato != null && f.recordInTracciato[keyRefCodice] == item2);
                        if (element != null) {
                            elementiAssentiGruppo.push(element);
                        }
                        else {
                            element = me.tracciatoSource.find(f => f.recordInTracciato != null && f.recordInTracciato[keyRefCodice] == item2);
                            if (element != null && element.recordInTracciato[keyScattoCodiceGruppo] != element.recordInTracciato[keyRefCodice]) {
                                elementiPresentiGruppoInAltroGruppo.push(element);
                            }
                            else if (element != null && element.recordInTracciato[keyScattoCodiceGruppo] == element.recordInTracciato[keyRefCodice]) {
                                elementiPresentiGruppoSingoli.push(element);
                            }
                        }

                    });
                    //text += "Il gruppo " + item.recordInTracciato[keyScattoCodiceGruppo] + " non è più valido a causa dell'assenza\n";
                    text += "Il gruppo <span class='text-danger'>" + item.recordInTracciato[keyScattoCodiceGruppo] + "</span> non è più valido a causa dell'assenza ";

                    if (elementiAssentiGruppo.length > 1) {
                        text += "dei singoli ";
                        elementiAssentiGruppo.forEach(function (item2) {
                            text += "<span class='text-danger'>" + item2.recordInTracciato[keyRefCodice] + "</span>, ";
                        });
                        text = text.slice(0, -2);
                        text += ".";
                        text += "<br>";
                    }
                    else if (elementiAssentiGruppo.length == 1) {
                        text += "del singolo ";
                        elementiAssentiGruppo.forEach(function (item2) {
                            text += "<span class='text-danger'>" + item2.recordInTracciato[keyRefCodice] + "</span>";
                        });
                        text += ".";
                        text += "<br>";
                    }

                    if (elementiPresentiGruppoSingoli.length > 1) {
                        text += "<br>";
                        text += "I seguenti elementi sono diventati singoli: ";
                        elementiPresentiGruppoSingoli.forEach(function (item2) {
                            text += "<span class='text-danger'>" + item2.recordInTracciato[keyRefCodice] + ".</span>";
                        });
                    }
                    else if (elementiPresentiGruppoSingoli.length == 1) {
                        text += "<br>";
                        text += "Il seguente elemento è diventato singolo: ";
                        elementiPresentiGruppoSingoli.forEach(function (item2) {
                            text += "<span class='text-danger'>" + item2.recordInTracciato[keyRefCodice] + ".</span>";
                        });
                    }

                    if (elementiPresentiGruppoInAltroGruppo.length > 0) {
                        elementiPresentiGruppoInAltroGruppo.sort(function (a, b) {
                            var codiceGruppoA = a.recordInTracciato[keyScattoCodiceGruppo];
                            var codiceGruppoB = b.recordInTracciato[keyScattoCodiceGruppo];
                            return codiceGruppoA.localeCompare(codiceGruppoB);
                        });

                        let elementiNelloStessoGruppo = [];
                        let elementIndex = 0;
                        elementiPresentiGruppoInAltroGruppo.forEach(function (item2) {
                            if (elementiNelloStessoGruppo.length == 0) {
                                elementiNelloStessoGruppo.push(item2);
                            }
                            else {
                                if (item2.recordInTracciato[keyScattoCodiceGruppo] == elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo]) {
                                    elementiNelloStessoGruppo.push(item2);
                                    if (elementIndex == elementiPresentiGruppoInAltroGruppo.length - 1) {
                                        if (elementiNelloStessoGruppo.length > 1) {
                                            text += "<br>";
                                            text += "Gli elementi "
                                            elementiNelloStessoGruppo.forEach(function (item3) {
                                                text += "<span class='text-danger'>" + item3.recordInTracciato[keyRefCodice] + "</span>, ";
                                            });
                                            text = text.slice(0, -2);
                                            text += " fanno ora parte del gruppo: ";
                                            let codiciGruppo = elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo].split(",");
                                            codiciGruppo.forEach(function (item3) {
                                                if (elementiNelloStessoGruppo.find(f => f.recordInTracciato[keyRefCodice] == item3) != null) {
                                                    text += "<span class='text-danger'>" + item3 + "</span>,"
                                                }
                                                else {
                                                    text += item3 + ",";
                                                }
                                            });
                                            text = text.slice(0, -1);
                                            text += ".";
                                            elementiNelloStessoGruppo = [];
                                            elementiNelloStessoGruppo.push(item2);
                                        }
                                        else {
                                            text += "<br>";
                                            text += "L'elemento "
                                            elementiNelloStessoGruppo.forEach(function (item3) {
                                                text += "<span class='text-danger'>" + item3.recordInTracciato[keyRefCodice] + "</span>, ";
                                            });
                                            text = text.slice(0, -2);
                                            text += " fa ora parte del gruppo: ";
                                            let codiciGruppo = elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo].split(",");
                                            codiciGruppo.forEach(function (item3) {
                                                if (elementiNelloStessoGruppo.find(f => f.recordInTracciato[keyRefCodice] == item3) != null) {
                                                    text += "<span class='text-danger'>" + item3 + "</span>,"
                                                }
                                                else {
                                                    text += item3 + ", ";
                                                }
                                            });
                                            text = text.slice(0, -1);
                                            text += ".";
                                            elementiNelloStessoGruppo = [];
                                            elementiNelloStessoGruppo.push(item2);
                                        }
                                    }
                                }
                                else if (item2.recordInTracciato[keyScattoCodiceGruppo] != elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo]) {
                                    if (elementiNelloStessoGruppo.length > 1) {
                                        text += "<br>";
                                        text += "Gli elementi "
                                        elementiNelloStessoGruppo.forEach(function (item3) {
                                            text += "<span class='text-danger'>" + item3.recordInTracciato[keyRefCodice] + "</span>, ";
                                        });
                                        text = text.slice(0, -2);
                                        text += " fanno ora parte del gruppo: ";
                                        let codiciGruppo = elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo].split(",");
                                        codiciGruppo.forEach(function (item3) {
                                            if (elementiNelloStessoGruppo.find(f => f.recordInTracciato[keyRefCodice] == item3) != null) {
                                                text += "<span class='text-danger'>" + item3 + "</span>,"
                                            }
                                            else {
                                                text += item3 + ",";
                                            }
                                        });
                                        text = text.slice(0, -1);
                                        text += ".";
                                        elementiNelloStessoGruppo = [];
                                        elementiNelloStessoGruppo.push(item2);
                                    }
                                    else {
                                        text += "<br>";
                                        text += "L'elemento "
                                        elementiNelloStessoGruppo.forEach(function (item3) {
                                            text += "<span class='text-danger'>" + item3.recordInTracciato[keyRefCodice] + "</span>,";
                                        });
                                        text = text.slice(0, -1);
                                        text += " fa ora parte del gruppo: ";
                                        let codiciGruppo = elementiNelloStessoGruppo[0].recordInTracciato[keyScattoCodiceGruppo].split(",");
                                        codiciGruppo.forEach(function (item3) {
                                            if (elementiNelloStessoGruppo.find(f => f.recordInTracciato[keyRefCodice] == item3) != null) {
                                                text += "<span class='text-danger'>" + item3 + "</span>,"
                                            }
                                            else {
                                                text += item3 + ",";
                                            }
                                        });
                                        text = text.slice(0, -1);
                                        text += ".";
                                        elementiNelloStessoGruppo = [];
                                        elementiNelloStessoGruppo.push(item2);
                                    }
                                }
                            }
                            elementIndex++;
                        });
                    }
                }
                else {
                    text += "Il singolo <span class='text-danger'>" + item.recordInTracciato[keyRefCodice] + "</span> non è più valido.";
                }
            }
            else {
                console.error("Una referenza non obsoleta è stata trovata nella lista TracciatoSourceObsoleti");
            }
        });
        if (listaIdRefImpaginate.length > 0) {
            let codiceMultiplex;
            text += "<br>";
            text += "Il multiplex <span class='text-danger'>";
            if (listaIdRefImpaginateObsolete[0].isGruppo) {
                codiceMultiplex = elementiAssentiGruppo[0].recordInTracciato[keyScattoCodiceGruppoMultiplex];
                text += codiceMultiplex + "</span>";
            }
            else {
                codiceMultiplex = listaIdRefImpaginateObsolete[0].recordInTracciato[keyScattoCodiceGruppoMultiplex];
                text += codiceMultiplex + "</span>";
            }
            text += " non è più valido.<br>";
            if (listaIdRefImpaginate.length > 1) {
                listaIdRefImpaginateObsolete.forEach(function (item) {
                    if (item.isGruppo) {
                        codiceMultiplex = codiceMultiplex.replace(item.recordInTracciato[keyScattoCodiceGruppo], '');
                    }
                    else {
                        codiceMultiplex = codiceMultiplex.replace(item.recordInTracciato[keyRefCodice].toString(), '');
                    }
                    codiceMultiplex = codiceMultiplex.replace(",,", ",");
                    if (codiceMultiplex[codiceMultiplex.length - 1] == ",") {
                        codiceMultiplex = codiceMultiplex.slice(0, -1);
                    }
                });

                text += "Dopo la correzione errori il multiplex diventerà: <span class='text-danger'>" + codiceMultiplex + ".</span>";
            }
            else {
                text += "Il gruppo multiplex verrà rimosso e rimarrà l'elemento: <span class='text-danger'>" + (listaIdRefImpaginate[0].isGruppo ? listaIdRefImpaginate[0].recordInTracciato[keyScattoCodiceGruppo] : listaIdRefImpaginate[0].recordInTracciato[keyRefCodice]) + ".</span>";
            }

        }
        let string = "";
        listaIdRefImpaginateObsolete.forEach(function (item) {
            if (item.isGruppo) {
                string += item.recordInTracciato[keyScattoCodiceGruppo] + "-";
            }
            else {
                string += item.idRec + "-";
            }
        });
        string = string.slice(0, -1);
        $('#modalWarningVersione').attr("refDaCorreggere", string);
        $('#modalWarningVersione').find(".modal-body").html(text);
        $('#modalWarningVersione').modal('show');
    }

    CorreggiErroriModal(sender) {
        let me = this;
        let modal = sender.closest("#modalWarningVersione");
        let codici = modal.attr("refDaCorreggere").split("-");
        codici.forEach(function (item) {
            let box;
            if (item.indexOf(",") != -1) {
                box = $(".refInMenabo[codice_gruppo='" + item + "']").closest(".single_box");
            }
            else {
                box = $(".refInMenabo[id_rec='" + item + "']").closest(".single_box");
            }
            me.eseguiCambioIndice(0, box);
        });
    }

    ShowErrorModal() {
        let text = this.IndividuazioneErrori().errorText;
        if (text == "") {
            text = "Nessun errore è stato individuato";
        }
        $("#ModalCorrezioneErrori").find(".modal-body").html(text);
        $("#ModalCorrezioneErrori").modal("show");
    }

    IndividuazioneErrori(pages) {
        let me = this;
        let errorText = "";
        let listPage = [];
        let errorFounded = false;
        let warnFounded = false;
        let obj = {
            caratteriNonValidi: false,
            paginaNonPresente: false,
            errorText: "",
            errorFounded: null,
            warnFounded: null
        }
        if (pages != null && pages != "") {
            pages = pages.replace(/\s/g, '');
            let singlePage = pages.split(',');
            let caratteriNonValidi = false;
            singlePage.forEach(function (item) {
                if (!caratteriNonValidi) {
                    if (item.includes('-')) {
                        let rangeInterval = item.split('-');
                        if (isNaN(parseInt(rangeInterval[0])) || isNaN(parseInt(rangeInterval[1]))) {
                            caratteriNonValidi = true;
                        }
                        else {
                            for (var i = parseInt(rangeInterval[0]); i <= parseInt(rangeInterval[1]); i++) {
                                listPage.push(i);
                            }
                        }
                    }
                    else {
                        if (!isNaN(parseInt(item))) {
                            listPage.push(parseInt(item));
                        }
                        else {
                            console.error("È stato inserito un carattere non valido nella selezione della pagina");
                            caratteriNonValidi = true;
                        }
                    }
                }
                obj.caratteriNonValidi = caratteriNonValidi;
            });
            if (caratteriNonValidi) { return obj; }
            console.log(listPage);
        }
        else {
            me.pagineSource.forEach(function (item) {
                listPage.push(item.numero);
            });
        }

        let paginaNonPresente = false;
        listPage.forEach(function (item) {
            let page = me.pagineSource.find(f => f.numero == item);
            if (page != null) {
                let nessunErroreRilevato = true;
                let mastroPag = me.mastroSource.find(f => f.id == page.idMastro);
                if (!mastroPag.active) {
                    if (nessunErroreRilevato) {
                        nessunErroreRilevato = false;
                        errorText += "<b>Pagina " + item + ": </b><br>";
                    }
                    errorFounded = true;
                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: La pagina <span class='text-danger'>" + page.numero + "</span> sta  usando la mastro <span class='text-danger'>" + mastroPag.nome + "</span> ma tale mastro è stata rimossa, sostituirla con una valida</div>";
                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + 0 + ")'>Trova</button></div></div>";
                }

                if (!me._listaFormati.includes(page.formato)) {
                    if (nessunErroreRilevato) {
                        nessunErroreRilevato = false;
                        errorText += "<b>Pagina " + item + ": </b><br>";
                    }
                    errorFounded = true;
                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: La pagina <span class='text-danger'>" + page.numero + "</span> richiede il formato <span class='text-danger'>" + page.formato + "</span> ma tale formato non è dichiarato nei formati pagine presenti.</div>";
                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + 0 + ")'>Trova</button></div></div>";
                }

                console.log(page);
                let currentPageIndexChecked = [];
                page.menaboRefs.forEach(function (item2) {
                    if (currentPageIndexChecked.indexOf(item2.indice) == -1) {
                        currentPageIndexChecked.push(item2.indice);

                        let elementsAtIndex = page.menaboRefs.filter(f => f.indice == item2.indice);
                        if (elementsAtIndex.length > 1) {
                            let multiplexCorrotto = false;
                            let primarieSelezionate = 0;
                            let secondarieSelezionate = 0;
                            let codiceMultiplex;
                            let indiceMultiplex;
                            elementsAtIndex.forEach(function (item3) {
                                let elementMultiplex = me.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.id == item3.id);
                                if (elementMultiplex != null && !multiplexCorrotto) {
                                    indiceMultiplex = elementMultiplex.recordImpaginato.indice;
                                    if (elementMultiplex.isGruppo) {
                                        let singles = [];
                                        singles = me.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == elementMultiplex.recordInTracciato[keyScattoCodiceGruppo] && f.isGruppo == false);
                                        singles.forEach(function (item4) {
                                            if (codiceMultiplex == null || codiceMultiplex == "") {
                                                codiceMultiplex = item4.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                            }
                                            if (item4.statoSelezione == 1) {
                                                primarieSelezionate++;
                                            }
                                            else if (item4.statoSelezione == 2) {
                                                secondarieSelezionate++;
                                            }
                                        });
                                    }
                                    else {
                                        if (codiceMultiplex == null || codiceMultiplex == "") {
                                            codiceMultiplex = elementMultiplex.recordInTracciato[keyScattoCodiceGruppoMultiplex];
                                        }
                                        if (elementMultiplex.statoSelezione == 1) {
                                            primarieSelezionate++;
                                        }
                                        else if (elementMultiplex.statoSelezione == 2) {
                                            secondarieSelezionate++;
                                        }
                                    }
                                }
                                if (elementMultiplex == null) {
                                    multiplexCorrotto = true;
                                    //elemento singolo corrotto
                                    if (nessunErroreRilevato) {
                                        nessunErroreRilevato = false;
                                        errorText += "<b>Pagina " + item + ": </b><br>";
                                    }
                                    errorFounded = true;
                                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: L'elemento <span class='text-danger'>" + (item3.idRecord != null ? item3.idRecord : item3.codiceGruppo) + "</span> ad indice <span class='text-danger'>" + item3.indice + "</span> è corrotto</div>";
                                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item3.indice + ")'>Trova</button></div></div>";
                                }
                                if (!multiplexCorrotto) {
                                    if (me.meccanicheSource != null) {
                                        let itemMeccanica = me.meccanicheSource.find(f => f.nomeOrigine == item3.formato);
                                        if (itemMeccanica != null) {
                                            if (itemMeccanica.aree != null && (itemMeccanica.aree.length > 0 && !itemMeccanica.aree.includes(me.areaTracciato))) {
                                                if (nessunErroreRilevato) {
                                                    nessunErroreRilevato = false;
                                                    errorText += "<b>Pagina " + item + ": </b><br>";
                                                }
                                                errorFounded = true;
                                                errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: L'elemento <span class='text-danger'>" + (item3.idRecord != null ? item3.idRecord : item3.codiceGruppo) + "</span> ad indice <span class='text-danger'>" + item3.indice + "</span> richiede la meccanica " + elementMultiplex.recordImpaginato.formato + " ma tale meccanica non è disponibile per questo tracciato</div>";
                                                errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item3.indice + ")'>Trova</button></div></div>";
                                            }
                                        }
                                        else {
                                            if (nessunErroreRilevato) {
                                                nessunErroreRilevato = false;
                                                errorText += "<b>Pagina " + item + ": </b><br>";
                                            }
                                            errorFounded = true;
                                            errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: L'elemento <span class='text-danger'>" + (item3.idRecord != null ? item3.idRecord : item3.codiceGruppo) + "</span> ad indice <span class='text-danger'>" + item3.indice + "</span> richiede la meccanica " + elementMultiplex.recordImpaginato.formato + " ma tale meccanica non esiste in meccaniche source</div>";
                                            errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item3.indice + ")'>Trova</button></div></div>";
                                        }
                                    }
                                }
                            })

                            if (!multiplexCorrotto) {
                                if (primarieSelezionate == 0) {
                                    if (nessunErroreRilevato) {
                                        nessunErroreRilevato = false;
                                        errorText += "<b>Pagina " + item + ": </b><br>";
                                    }
                                    errorFounded = true;
                                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il multiplex <span class='text-danger'>" + codiceMultiplex + "</span> ad indice <span class='text-danger'>" + indiceMultiplex + "</span> non ha nessuna primaria selezionata</div>";
                                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + indiceMultiplex + ")'>Trova</button></div></div>";

                                }
                                else if (primarieSelezionate > 1) {
                                    if (nessunErroreRilevato) {
                                        nessunErroreRilevato = false;
                                        errorText += "<b>Pagina " + item + ": </b><br>";
                                    }
                                    errorFounded = true;
                                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il multiplex <span class='text-danger'>" + codiceMultiplex + "</span> ad indice <span class='text-danger'>" + indiceMultiplex + "</span> ha più di una primaria selezionata</div>";
                                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + indiceMultiplex + ")'>Trova</button></div></div>";

                                }

                                if (secondarieSelezionate == 0) {
                                    if (nessunErroreRilevato) {
                                        nessunErroreRilevato = false;
                                        errorText += "<b>Pagina " + item + ": </b><br>";
                                    }
                                    warnFounded = true;
                                    errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-warning'>Attenzione</span>: Il multiplex <span class='text-warning'>" + codiceMultiplex + "</span> ad indice <span class='text-warning'>" + indiceMultiplex + "</span> non ha nessuna secondaria selezionata</div>";
                                    errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + indiceMultiplex + ")'>Trova</button></div></div>";
                                }
                            }
                        }
                        else {
                            let element = me.tracciatoSource.find(f => f.recordImpaginato != null && f.recordImpaginato.id == item2.id);
                            if (element != null) {
                                if (element.isGruppo) {
                                    let singles = [];
                                    let codiciMultiplex = [];
                                    singles = me.tracciatoSource.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == element.recordInTracciato[keyScattoCodiceGruppo] && f.isGruppo == false);
                                    let primarieSelezionate = 0;
                                    let secondarieSelezionate = 0;
                                    singles.forEach(function (item3) {
                                        if (item3.statoSelezione == 1) {
                                            primarieSelezionate++;
                                        }
                                        else if (item3.statoSelezione == 2) {
                                            secondarieSelezionate++;
                                        }
                                        if (item3.recordInTracciato[keyScattoCodiceGruppoMultiplex] != null) {
                                            codiciMultiplex.push(item3.recordInTracciato[keyScattoCodiceGruppoMultiplex]);
                                        }
                                    });
                                    codiciMultiplex = [...new Set(codiciMultiplex)];
                                    if (codiciMultiplex.length == 1) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        errorFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il gruppo non multiplexato <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> risulta far parte del multiplex <span class='text-danger'>" + codiciMultiplex[0] + "</span></div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                    }
                                    else if (codiciMultiplex.length > 1) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        errorFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Gli elementi che compongono il gruppo non multiplexato <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> risultano far parte di vari multiplex</div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                    }
                                    if (primarieSelezionate == 0) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        errorFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il gruppo <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> non ha nessuna primaria selezionata</div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";

                                    }
                                    else if (primarieSelezionate > 1) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        errorFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il gruppo <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> ha più di una primaria selezionata</div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";

                                    }

                                    if (secondarieSelezionate == 0) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        warnFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-warning'>Attenzione</span>: Il gruppo <span class='text-warning'>" + item2.codiceGruppo + "</span> ad indice <span class='text-warning'>" + item2.indice + "</span> non ha nessuna secondaria selezionata</div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                    }

                                    if (me.meccanicheSource != null) {
                                        let itemMeccanica = me.meccanicheSource.find(f => f.nomeOrigine == element.recordImpaginato.formato);
                                        if (itemMeccanica != null) {
                                            if (itemMeccanica.aree != null && (itemMeccanica.aree.length > 0 && !itemMeccanica.aree.includes(me.areaTracciato))) {
                                                if (nessunErroreRilevato) {
                                                    nessunErroreRilevato = false;
                                                    errorText += "<b>Pagina " + item + ": </b><br>";
                                                }
                                                errorFounded = true;
                                                errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il gruppo <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> richiede la meccanica " + element.recordImpaginato.formato + " ma tale meccanica non è inclusa tra quelle del canale</div>";
                                                errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                            }
                                        }
                                        else {
                                            if (nessunErroreRilevato) {
                                                nessunErroreRilevato = false;
                                                errorText += "<b>Pagina " + item + ": </b><br>";
                                            }
                                            errorFounded = true;
                                            errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il gruppo <span class='text-danger'>" + item2.codiceGruppo + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> richiede la meccanica " + element.recordImpaginato.formato + " ma tale meccanica non esiste in meccaniche source</div>";
                                            errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                        }
                                    }
                                }
                                else {
                                    if (element.recordInTracciato[keyScattoCodiceGruppoMultiplex] != null) {
                                        if (nessunErroreRilevato) {
                                            nessunErroreRilevato = false;
                                            errorText += "<b>Pagina " + item + ": </b><br>";
                                        }
                                        errorFounded = true;
                                        errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il singolo non multiplexato <span class='text-danger'>" + element.recordInTracciato[keyRefCodice] + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> risulta di far parte del multiplex <span class='text-danger'>" + element.recordInTracciato[keyScattoCodiceGruppoMultiplex] + "</span></div>";
                                        errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                    }

                                    if (me.meccanicheSource != null) {
                                        let itemMeccanica = me.meccanicheSource.find(f => f.nomeOrigine == element.recordImpaginato.formato);
                                        if (itemMeccanica != null) {
                                            if (itemMeccanica.aree != null && (itemMeccanica.aree.length > 0 && !itemMeccanica.aree.includes(me.areaTracciato))) {
                                                if (nessunErroreRilevato) {
                                                    nessunErroreRilevato = false;
                                                    errorText += "<b>Pagina " + item + ": </b><br>";
                                                }
                                                errorFounded = true;
                                                errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il singolo <span class='text-danger'>" + element.recordInTracciato[keyRefCodice] + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> richiede la meccanica " + element.recordImpaginato.formato + " ma tale meccanica non è inclusa tra quelle del canale</div>";
                                                errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                            }
                                        }
                                        else {
                                            if (nessunErroreRilevato) {
                                                nessunErroreRilevato = false;
                                                errorText += "<b>Pagina " + item + ": </b><br>";
                                            }
                                            errorFounded = true;
                                            errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: Il singolo <span class='text-danger'>" + element.recordInTracciato[keyRefCodice] + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> richiede la meccanica " + element.recordImpaginato.formato + " ma tale meccanica non esiste in meccaniche source</div>";
                                            errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                                        }
                                    }
                                }
                            }
                            else {
                                //elemento singolo corrotto
                                if (nessunErroreRilevato) {
                                    nessunErroreRilevato = false;
                                    errorText += "<b>Pagina " + item + ": </b><br>";
                                }
                                errorFounded = true;
                                errorText += "<div class='row border-bottom pb-2'><div class='col-10'><span class='text-danger'>Errore</span>: L'elemento <span class='text-danger'>" + (item2.idRecord != null ? item2.idRecord : item2.codiceGruppo) + "</span> ad indice <span class='text-danger'>" + item2.indice + "</span> è corrotto</div>";
                                errorText += "<div class='col-2'><button type='button' class='btn btn-primary btn-sm mt-2' onclick='menaboInstance.CorreggiErrore(" + page.id + ", " + item2.indice + ")'>Trova</button></div></div>";
                            }
                        }
                        if (me.agenzia.checkCustomErrors != null) {
                            Text = me.agenzia.checkCustomErrors(item2, page);
                            Text = (Text == null ? "" : Text);
                            if (Text != "") {
                                if (nessunErroreRilevato) {
                                    nessunErroreRilevato = false;
                                    errorText += "<b>Pagina " + item + ": </b><br>";
                                }
                                warnFounded = true;
                            }
                            errorText += Text;
                        }
                    }
                });
            }
            else {
                paginaNonPresente = true;
            }
        });
        if (errorFounded) {
            $("#ApriCorrezioneErrori").css("color", "red");
            $("#ApriCorrezioneErrori").css("display", "block");
        }
        else if (warnFounded) {
            $("#ApriCorrezioneErrori").css("color", "yellow");
            $("#ApriCorrezioneErrori").css("display", "block");
        }
        else {
            $("#ApriCorrezioneErrori").css("display", "none");
        }
        obj = {
            caratteriNonValidi: false,
            paginaNonPresente: paginaNonPresente,
            errorText: errorText,
            errorFounded: errorFounded,
            warnFounded: warnFounded,
        }
        return (obj);
    }

    CorreggiErrore(page, index) {
        $("#cmb_pags").val(page);
        this.selezionataPagina();
        $("#ModalCorrezioneErrori").modal("hide");

        if (index > 0) {
            const maskElement = $("#box_" + index).find(".mask");
            const iconElement = maskElement.find(".fa-exclamation-triangle");

            if (maskElement.css("display") === "none") {
                maskElement.css("display", "flex");
                iconElement.css("display", "none");

                const flashingInterval = setInterval(function () {
                    maskElement.fadeTo(0, 0.1).fadeTo(300, 1.0).fadeTo(300, 0.1).fadeTo(300, 1.0);
                }, 900);

                setTimeout(function () {
                    clearInterval(flashingInterval);
                    maskElement.css("display", "none");
                    iconElement.css("display", "block");
                }, 1800);
            } else {
                const flashingInterval = setInterval(function () {
                    maskElement.fadeTo(0, 0.1).fadeTo(300, 1.0).fadeTo(300, 0.1).fadeTo(300, 1.0);
                }, 900);

                setTimeout(function () {
                    clearInterval(flashingInterval);
                }, 1800);
            }
        }
    }

    ApriModalControlloDuplicazione() {
        if (this.IndividuazioneErrori().errorFounded) {
            alert("Non è possibile duplicare il menabò attuale finchè sono presenti errori, usare lo strumento di correzione per individuare gli errori presenti");
            return;
        }
        showLoading();
        Call.do("Menabo", "trovaAltriTracciatiNellaStessaPromo/" + this.idTracciato, "GET", null, this, function (result, sender) {
            if (result != null && result.length > 0) {
                $("#selezionaMenaboSuCuiDuplicare").empty();
                $("#selezionaMenaboSuCuiDuplicare").append("<option value=0>Nessun menabò selezionato</option>");
                result.forEach(function (item) {
                    $("#selezionaMenaboSuCuiDuplicare").append("<option value=" + item.id + ">" + item.sigla + "</option>");
                });
            }
            else {
                $("#selezionaMenaboSuCuiDuplicare").empty();
                $("#selezionaMenaboSuCuiDuplicare").append("<option value=0>Nessun'altro menabò trovato in promo</option>");
            }
            hideLoading();
            $("#modalDuplicaMenabo").find(".modal-body").html("Seleziona menabò su cui duplicare");
            $("#modalDuplicaMenabo").modal("show");
        });
    }

    ControlloPresenzaPagineInMenabooDuplicazione(senderDropdown) {
        if (parseInt(senderDropdown.val()) == 0) {
            $("#iniziaDuplicazione").prop("disabled", true);
            $("#modalDuplicaMenabo").find(".modal-body").html("Seleziona menabò su cui duplicare");
            return;
        }
        showLoading();
        let me = this;
        Call.do("Menabo", "controllaPresenzaPagineTracciato/" + parseInt(senderDropdown.val()), "GET", null, this, function (result, sender) {
            if (result) {
                hideLoading();
                let resultConfirm = confirm("Il menabò selezionato contiene già delle pagine che verranno sovrascritte in caso di duplicazione, procedere comunque?");
                if (resultConfirm === true) {
                    $("#modalDuplicaMenabo").attr("pagineDaSovrascrivere", true);
                } else {
                    $("#selezionaMenaboSuCuiDuplicare").val(0);
                    $("#modalDuplicaMenabo").find(".modal-body").html("Seleziona menabò su cui duplicare");
                    $("#iniziaDuplicazione").prop("disabled", true);
                    return;
                }
            }
            else {
                $("#modalDuplicaMenabo").attr("pagineDaSovrascrivere", false);
            }
            $("#iniziaDuplicazione").prop("disabled", false);
            me.ControllaErroriInDuplicazione(parseInt(senderDropdown.val()));
            hideLoading();
        });
    }

    ControllaErroriInDuplicazione(idTracciato) {
        showLoading();
        Call.do("Menabo", "trovaConflittiInDuplicazione/" + this.idTracciato + "/" + idTracciato, "GET", null, this, function (result, sender) {
            if (result.esito) {
                result.report = result.report.replace(/\n/g, "<br>");
                if (result.report == "") {
                    result.report = "Nessun errore o conflitto, tutto l'impaginato verrà duplicato.";
                }
                $("#modalDuplicaMenabo").find(".modal-body").html(result.report);
                $("#modalDuplicaMenabo").attr("indiciConErrore", result.indici_paginaDaNonDuplicare);
            }
            else {
                $("#modalDuplicaMenabo").find(".modal-body").html(result.error);
            }
            hideLoading();
        });
    }

    DuplicaMenabo() {
        let indiciDaNonDuplicare = $("#modalDuplicaMenabo").attr("indiciConErrore").split(",");
        let sovrascriviMenabo = $("#modalDuplicaMenabo").attr("pagineDaSovrascrivere");
        let confirmed;
        if (sovrascriviMenabo) {
            confirmed = confirm("Il menabò di destinazione verrà sovrascritto, procedere alla duplicazione? L'operazione potrebbe richiedere un po' di tempo.");
        }
        else {
            confirmed = confirm("Procedere alla duplicazione? L'operazione potrebbe richiedere un po' di tempo.");
        }

        if (!confirmed) {
            return;
        }
        showLoading();
        let obj = {
            stringhe: indiciDaNonDuplicare
        }
        Call.do("Menabo", "duplica/" + this.idTracciato + "/" + parseInt($("#selezionaMenaboSuCuiDuplicare").val()), "PUT", obj, this, function (result, sender) {
            if (result.esito) {
                alert("Operazione effettuata con successo");
            }
            else {
                alert("Operazione fallita, errore: " + result.error);
            }
            hideLoading();
        });
    }

    leggiCodiceRichiesto() {
        let me = this;
        let codice = $("#codiceArticoloDaInserire").val();
        if (codice == "") {
            $("#inserisciArticoloInDB").find(".content").css("display", "none");
            return (false);
        }
        let isGruppo = codice.split(",").length > 1;
        if (codice.indexOf(" ") != -1) {
            alert("Il" + (isGruppo ? " gruppo" : " codice") + " inserito contiene spazi, rimuovere gli spazi per poter procedere");
            return (false);
        }
        if (codice[codice.length - 1] == ",") {
            alert("L'ultimo elemento del gruppo non è stato inserito, rimuovere la , finale o inserire l'ultimo elemento");
            return (false);
        }
        let codiceInTracciato = this.tracciatoSource.find(f => f.isGruppo == isGruppo && (isGruppo ? f.recordInTracciato[keyScattoCodiceGruppo] == codice : f.recordInTracciato[keyRefCodice] == codice));
        if (codiceInTracciato != null) {
            alert("Il" + (isGruppo ? " gruppo" : " codice") + " inserito è già prensente in tracciato, inserire un codice diverso");
            return (false);
        }

        if (isGruppo) {
            let codici = codice.split(",");
            for (var i = 0; i < codici.length; i++) {
                let codiceAnalizzato = this.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == codici[i]);
                if (codiceAnalizzato != null) {
                    alert("Il gruppo inserito contiene l'elemento " + codici[i] + " già prensente in tracciato, inserire un codice diverso");
                    return (false);
                }
            }
        }
        $("#inserisciArticoloInDB").find(".content").css("display", "block");

        if (!isGruppo) {
            $("#inserisciArticoloInDB").find("#codiceGruppo").val("");
            $("#inserisciArticoloInDB").find("#codiceGruppo").attr("codgr", "0");
            $("#inserisciArticoloInDB").find("#codiceGruppo").removeClass("bg-success");
            $("#inserisciArticoloInDB").find("#codiceGruppo").removeClass("bg-danger");
            $("#inserisciArticoloInDB").find("#InserimentoInGruppo").css("display", "block");
        }
        else {
            $("#inserisciArticoloInDB").find("#codiceGruppo").val("");
            $("#inserisciArticoloInDB").find("#codiceGruppo").attr("codgr", codice);
            $("#inserisciArticoloInDB").find("#codiceGruppo").removeClass("bg-success");
            $("#inserisciArticoloInDB").find("#codiceGruppo").removeClass("bg-danger");
            $("#inserisciArticoloInDB").find("#InserimentoInGruppo").css("display", "none");
        }

        showLoading();
        Call.do("Tracciati", "getAddestramenti/", "GET", null, this, function (result, sender) {
            console.log(result);
            me.addestramentiTracciati = result;
            hideLoading();
            $("#selectAddestramento").empty();
            $("#selectAddestramento").append('<option value="0">Seleziona addestramento</option>');

            me.addestramentiTracciati.forEach(function (addestramento) {
                $("#selectAddestramento").append('<option value="' + addestramento.id + '">' + addestramento.titolo + '</option>');
            });

            me.costruisciCodiciModalInserisciArticolo(codice);
        });
    }

    costruisciCodiciModalInserisciArticolo(codice) {
        let me = this;
        let codici = codice.split(",");
        let content = "";
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceLabels.json?v=1.' + rndVersion, function (data) {
            console.log(data);
            $('#cmbLabel').empty();
            $('#cmbLabel').append("<option value=\"0\">Seleziona label</option>");
            data.source.forEach(i => {
                $('#cmbLabel').append("<option value=\"" + i.Codice + "\">" + i.Nome + "</option>");

            });
        });

        codici.forEach(function (item) {
            content += '<div class="addestramentoContent">';
            content += '<div class="row campoArticolo riga_Referenza.Codice my-3">' +
                '  <div class="col-3">' +
                '    <label for="codiceArt">Codice Articolo:</label>' +
                '  </div>' +
                '  <div class="col-9">' +
                '    <input type="text" class="campoart" id="Referenza.Codice" readonly value=' + item + '>' +
                '  </div>' +
                '</div>';

            content += '</select >';
            content += '</div>';
            content += '<div class="border-bottom border-3 pb-3"></div>';
        });
        $("#CardsArticolo").html(content);
    }

    selezionatoAddestramento(senderVal) {
        let me = this;
        let addestramentoSelezionato = this.addestramentiTracciati.find(f => f.id == senderVal);
        if (addestramentoSelezionato == null) {
            alert("Errore nel recupero dell'addestramento");
            return;
        }

        addestramentoSelezionato.schemaCampiExcels.forEach(function (addestramento) {
            var content = '';
            var id = addestramento.nomeColonna;
            var label = addestramento.nomeColonnaOriginale;

            if (id != "Referenza.Codice") {
                switch (addestramento.tipoDato) {
                    case 0: // NonAssegnato
                        console.warn('Tipo di dato 0 per: ' + label);
                        break;

                    case 1: // Stringa
                    case 2: // Numerico
                    case 3: // Decimale
                        content = '<div class="row campoArticolo riga_' + id + ' mb-3">' +
                            '  <div class="col-3">' +
                            '    <label for="' + id + '">' + label + '</label>' +
                            '  </div>' +
                            '  <div class="col-9">' +
                            '    <input class="campoart" type="text" id="' + id + '">' +
                            '  </div>' +
                            '</div>';
                        break;

                    case 4: // Data
                        content = '<div class="row campoArticolo riga_' + id + ' mb-3">' +
                            '  <div class="col-3">' +
                            '    <label for="' + id + '">' + label + '</label>' +
                            '  </div>' +
                            '  <div class="col-9">' +
                            '    <input class="campoart" type="date" id="' + id + '">' +
                            '  </div>' +
                            '</div>';
                        break;

                    case 5: // Bool
                        content = '<div class="row campoArticolo riga_' + id + ' mb-3">' +
                            '  <div class="col-3">' +
                            '    <label for="' + id + '">' + label + '</label>' +
                            '  </div>' +
                            '  <div class="col-9 bg-warning">' +
                            '    <input class="campoart" type="checkbox" id="' + id + '">' +
                            '  </div>' +
                            '</div>';
                        break;

                    default:
                        console.error('Tipo di dato non valido per: ' + label);
                        break;
                }

                $(".addestramentoContent").each(function () {
                    $(this).append(content);
                });

                if (me.agenzia.NascondiParametriInserimentoArticoli != null) {
                    me.agenzia.NascondiParametriInserimentoArticoli();
                }
                if (me.agenzia.OperazioniInserimentoArticoliCustom != null) {
                    me.agenzia.OperazioniInserimentoArticoliCustom(me.idTracciato);
                }
                $("#CreaNuovoArticolo").css("display", "block");
            }
        });
    }

    getCampoValue(id, content) {
        let returnVal = $(content).find('[id="' + id + '"]').val();
        return returnVal;
    }

    CreaArticoloManualmente() {
        let me = this;
        var recordInTracciatoArray = [];
        let codGruppo = $("#InserimentoInGruppo").find("#codiceGruppo").attr("codgr");
        let idAddestramento = $("#selectAddestramento").val();
        let label = $("#cmbLabel").val();
        if (idAddestramento == 0) {
            alert("Addestramento non selezionato, impossibile procedere");
            return;
        }
        if (label == 0) {
            alert("Label non selezionata, impossibile procedere");
            return;
        }
        let addestramentoSelezionato = this.addestramentiTracciati.find(f => f.id == idAddestramento);
        $(".addestramentoContent").each(function () {
            var recordInTracciato = {};
            let content = $(this);
            addestramentoSelezionato.schemaCampiExcels.forEach(function (addestramento) {
                var id = addestramento.nomeColonna;

                // Verifica che l'id del campo sia diverso da "Referenza.Codice"
                switch (addestramento.tipoDato) {
                    case 0: // NonAssegnato
                        console.warn('Tipo di dato 0 per: ' + addestramento.nomeColonnaOriginale);
                        break;

                    case 1: // Stringa
                        recordInTracciato[id] = me.getCampoValue(id, content);
                        break;

                    case 2: // Numerico
                        var numericValue = me.getCampoValue(id, content);
                        recordInTracciato[id] = numericValue !== '' ? parseInt(numericValue) : null;
                        break;

                    case 3: // Decimale
                        var decimalValue = me.getCampoValue(id, content);
                        decimalValue = decimalValue.replace(',', '.');
                        recordInTracciato[id] = decimalValue !== '' ? parseFloat(decimalValue) : null;
                        break;

                    case 4: // Data
                        var dateValue = me.getCampoValue(id, content);
                        // Se la data è inserita nel campo, convertila in formato ISO (yyyy-mm-dd)
                        if (dateValue) {
                            var dateObject = new Date(dateValue);
                            recordInTracciato[id] = dateObject.toISOString().split('T')[0];
                        } else {
                            recordInTracciato[id] = null;
                        }
                        break;

                    case 5: // Bool
                        recordInTracciato[id] = $(content).find("#" + id).is(":checked");
                        break;

                    default:
                        console.error('Tipo di dato non valido per: ' + addestramento.nomeColonnaOriginale);
                        break;
                }

            });

            // Aggiungi il recordInTracciato all'array
            recordInTracciatoArray.push(recordInTracciato);
        });

        let obj = {
            listTracciato: recordInTracciatoArray
            }
        // Ora l'array recordInTracciatoArray contiene i recordInTracciato per ogni sezione .addestramentoContent
        console.log(recordInTracciatoArray);

        this.DisattivaBottone(true);
        Call.do("Tracciati", "importaManualmente/" + idAddestramento + "/" + label + "/" + this.idTracciato + "/" + codGruppo, "PUT", obj, this, function (result, sender) {
            me.DisattivaBottone(false);
            if (result.error != null && result.error != "") {
                alert(result.error);
            }
            else {
                // Crea un elemento div per il messaggio
                var messageDiv = $('<div class="alert alert-success">Operazione completata con successo, ricaricare la pagina per visualizzare il nuovo elemento in tracciato</div>');

                // Aggiungi il messaggio al messageContainer
                $('.messageContainer').append(messageDiv);

                // Imposta il colore di sfondo con opacity 0.5
                $('.modal-footer').css({
                    'background-color': 'success',
                    'opacity': 0.5
                });

                // Dopo 3 secondi, rimuovi il colore di sfondo e il messaggio con un fadeout
                setTimeout(function () {
                    $('.modal-footer').css({
                        'background-color': '',
                        'opacity': ''
                    });
                    messageDiv.fadeOut('slow', function () {
                        messageDiv.remove();
                    });
                }, 6000);
            }

        });
    }

    DisattivaBottone(disattiva) {
    var bottone = $("#CreaNuovoArticolo");

    if (disattiva) {
        // Disattiva il bottone e mostra lo spinner
        bottone.prop("disabled", true);
        bottone.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Caricamento...');
    } else {
        // Rimuovi lo spinner e riattiva il bottone con il testo originale
        bottone.prop("disabled", false);
        bottone.html('Crea articolo');
    }
}

    leggiCodiceGruppoRichiesto(codice) {
        //let me = this;
        //let codiceSingolo = $("#codiceArticoloDaInserire").val();
        if (codice == "") {
            return (false);
        }
        let isGruppo = codice.split(",").length > 1;
        if (codice.indexOf(" ") != -1) {
            alert("Il gruppo inserito contiene spazi, rimuovere gli spazi per poter procedere");
            return (false);
        }
        if (codice[codice.length - 1] == ",") {
            alert("Rimuovere la , finale o inserire l'ultimo elemento");
            return (false);
        }
        let codiceInTracciato = this.tracciatoSource.find(f => f.isGruppo == isGruppo && (isGruppo ? f.recordInTracciato[keyScattoCodiceGruppo] == codice : f.recordInTracciato[keyRefCodice] == codice));
        if (codiceInTracciato == null) {
            alert("Il gruppo richiesto non è presente in tracciato, inserire un codice diverso");
            return (false);
        }
        $("#InserimentoInGruppo").find("#codiceGruppo").attr("CodGr", codice);
        

        Call.do("Tracciati", "controllaIntegritaGruppo/" + this.idTracciato + "/" + codice, "GET", null, this, function (result, sender) {
            if (result.esito) {
                if (result.error != "") {
                    alert("Il seguente gruppo è presente solo nei tracciati: " + result.error +", non verrà modificato negli altri.");
                }
            }
            else {
                alert("Non è stato possibile controllare l'integrità del gruppo, errore: " + result.error);
            }
        });


        if ($("#selectAddestramento").val() != 0) {
            this.compilaCampiInserimentoArticoloInGruppo();
        }
        return (true);
    }

    svuotaCampiInserimentoInGruppo() {
        $(".campoArticolo").each(function () {
            // Verifica se l'elemento è quello da escludere
            if ($(this).find(":input[readonly]").first().attr("id") !== "Referenza.Codice") {
                // Trova il primo campo "readonly" al loro interno e rimuovi il readonly
                var campo = $(this).find(":input[readonly]").first();
                if (campo.is(":input")) {
                    if (campo.is(":checkbox")) {
                        campo.prop("checked", false);
                    } else {
                        campo.val("");
                    }
                } else {
                    campo.text("");
                }

                campo.prop("readonly", false);
            }
        });
    }

    compilaCampiInserimentoArticoloInGruppo() {
        let codGruppo = $("#InserimentoInGruppo").find("#codiceGruppo").attr("CodGr");
        if (codGruppo == "" || codGruppo == "0") {
            return;
        }
        let gruppoInTracciato = (this.tracciatoSource.find(f => f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == codGruppo)) != null;
        let singoloInTracciato = (this.tracciatoSource.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == codGruppo)) != null;
        let parametriCodiceScatto = this.agenzia.returnParametriCodiciScatto();
        if (gruppoInTracciato) {
            let firstItem = this.tracciatoSource.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == codGruppo);
            if (firstItem == null) {
                console.error("nessun elemento del gruppo trovato");
            }
            parametriCodiceScatto.forEach(function (item) {
                var value = firstItem.recordInTracciato[item];
                $("#inserisciArticoloInDB").find(".campoArticolo").each(function () {
                    $(this).find('[id="' + item + '"]').val(value);
                    $(this).find('[id="' + item + '"]').prop("readonly", true);
                });
            });
        }
        else if (singoloInTracciato)
        {
            let firstItem = this.tracciatoSource.find(f => f.recordInTracciato[keyRefCodice] == codGruppo);
            if (firstItem == null) {
                console.error("nessun elemento trovato");
            }
            parametriCodiceScatto.forEach(function (item) {
                var value = firstItem.recordInTracciato[item];
                $("#inserisciArticoloInDB").find(".campoArticolo").each(function () {
                    $(this).find('[id="' + item + '"]').val(value);
                    $(this).find('[id="' + item + '"]').prop("readonly", true);
                });
            });
        }
        else {
            this.applicaListenerPerFormareCodiceScatto();
        }
    }

    applicaListenerPerFormareCodiceScatto() {
        let parametriCodiceScatto = this.agenzia.returnParametriCodiciScatto();

        parametriCodiceScatto.forEach(function (item) {
            $("#CardsArticolo").find(".campoart").each(function () {
                if ($(this).attr("id") == item) {
                    // Verifica il tipo dell'elemento
                    if ($(this).is(":checkbox")) {
                        // Aggiungi il listener "onchange" per checkbox
                        $(this).on("change", function () {
                            // Chiamata alla funzione menaboInstance.sincronizzaCampi($(this));
                            menaboInstance.sincronizzaCampi($(this));
                        });
                    } else if ($(this).is(":text")) {
                        // Aggiungi il listener "onkeyup" per gli input di testo
                        $(this).on("keyup", function () {
                            // Chiamata alla funzione menaboInstance.sincronizzaCampi($(this).val());
                            menaboInstance.sincronizzaCampi($(this));
                        });
                    } else if ($(this).prop("type") === "date") {
                        // Aggiungi il listener "change" per gli input di tipo "date"
                        $(this).on("change", function () {
                            // Chiamata alla funzione menaboInstance.sincronizzaCampi($(this).val());
                            menaboInstance.sincronizzaCampi($(this));
                        });
                    }
                }
            });
        });
    }

    sincronizzaCampi(sender) {
        let senderVal = sender.val();
        let id = sender.attr("id");
        $("#CardsArticolo").find(".campoArticolo").each(function () {
            $(this).find('[id="' + id + '"]').val(senderVal);            
        });
    }

    contaArticoliInTracciato() {
        //let gruppi = $("#container_tracciato").find(".record_menabo_gruppo:not([style*='display: none'])").length;
        let gruppi = $("#container_tracciato").find(".record_menabo_gruppo").filter(function () {
            return $(this).parent().parent().css("display") !== "none";
        }).length;
        let singoli = $("#container_tracciato").find(".record_menabo").filter(function () {
            return !$(this).attr("codice_gruppo").includes(",") && $(this).css("display") !== "none";
        }).length;
        let referenze = $("#container_tracciato").find(".record_menabo").filter(function () {
            return (($(this).attr("codice_gruppo").includes(",") && $(this).parent().css("display") !== "none") || (!$(this).attr("codice_gruppo").includes(",") && $(this).css("display") !== "none"));
        }).length;
        $("#numeroArticoliTrovati").text(referenze + " referenze trovate, " + gruppi + " gruppi, " + singoli + " singoli.");
    }

    ApriModalEliminazioneManuale(id_rec) {
        let element = this.tracciatoSource.find(f => f.idRec == id_rec);
        console.log(element);
        //if (element.recordImpaginato != null) {
        //    let numPagina = this.pagineSource.find(f => f.id == element.recordImpaginato.idPagina).numero;
        //    let indice = element.recordImpaginato.indice;
        //    alert("L'elemento " + element.recordInTracciato[keyRefCodice] + " non può essere rimosso poichè impaginato a pagina " + numPagina + ", indice " + indice);
        //    return;
        //}
        //if (element.recordInTracciato[keyScattoCodiceGruppo] != element.recordInTracciato[keyRefCodice]) {
        //    let gruppoElement = this.tracciatoSource.find(f => f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == element.recordInTracciato[keyScattoCodiceGruppo]);
        //    if (gruppoElement.recordImpaginato != null) {
        //        let numPagina = this.pagineSource.find(f => f.id == gruppoElement.recordImpaginato.idPagina).numero;
        //        let indice = gruppoElement.recordImpaginato.indice;
        //        alert("L'elemento " + element.recordInTracciato[keyRefCodice] + " non può essere rimosso poichè il gruppo di cui fa parte è impaginato a pagina " + numPagina + ", indice " + indice);
        //        return;
        //    }
        //}
        //if (keyScattoCodiceGruppoMultiplex in element.recordInTracciato) {
        //    alert("L'elemento " + element.recordInTracciato[keyRefCodice] + " fa parte del multiplex " + element.recordInTracciato[keyScattoCodiceGruppoMultiplex] + ", rimuovere prima di poter procedere");
        //    return;
        //}
        this.CompilaModalEliminazione(element);
    }

    CompilaModalEliminazione(element) {
        $("#modalEliminazioneTracciato").attr("DaEliminare", element.idRec);
        let obj = {
            id: element.idRec,
            codice: element.recordInTracciato[keyRefCodice],
            codiceGruppo: element.recordInTracciato[keyScattoCodiceGruppo],
            idTracciato: this.idTracciato
        };

        Call.do("Menabo", "recuperaInformazioniArticoloInEliminazione", "PUT", obj, this, function (result, me) {
            console.log(result);
            if (result.esito != null) {
                console.error(result.error);
            }
            else {
                $("#modalEliminazioneTracciato").find(".modal-title").text("Eliminazione di " + element.recordInTracciato[keyRefCodice]);
                $("#contentModalEliminazione").empty()
                var headerRow = $('<div>').addClass('row mb-3');
                var headerCol1 = $('<div>').addClass('col text-center').css('font-weight', 'bold').text('Tracciato');
                var headerCol2 = $('<div>').addClass('col text-center').css('font-weight', 'bold').text('Codice Gruppo');
                var headerCol3 = $('<div>').addClass('col text-center').css('font-weight', 'bold').text('Multiplex');
                var headerCol4 = $('<div>').addClass('col text-center').css('font-weight', 'bold').text('Elimina');
                headerRow.append(headerCol1, headerCol2, headerCol3, headerCol4);

                $("#contentModalEliminazione").append(headerRow);
                var isCheckboxChecked = false;
                result.forEach(function (item) {
                    // Colonna 1: Sigla Tracciato (in rosso)
                    var col1 = $('<div>').text(item.siglaTracciato).css('color', 'red');

                    // Colonna 2: Codice Gruppo
                    var codiceGruppo = item.record.codiceGruppo.length > 18 ? item.record.codiceGruppo.substring(0, 18) + '...' : item.record.codiceGruppo;
                    var col2 = $('<div>').text(codiceGruppo !== item.record.codice ? codiceGruppo : 'Nessun gruppo');

                    // Colonna 3: Codice Multiplex
                    var codiceMultiplex = item.codiceMultiplex.length > 18 ? item.codiceMultiplex.substring(0, 18) + '...' : item.codiceMultiplex;
                    var col3 = $('<div>').text(codiceMultiplex !== "" ? codiceMultiplex : 'Nessun multiplex');

                    // Colonna 4: Checkbox o Testo "Impaginato"/"Gruppo impaginato"
                    var col4;
                    if (item.impaginato && item.gruppoImpaginato) {
                        alert("Nel tracciato " + item.siglaTracciato + " l'articolo risulta impaginato sia come gruppo che singolarmente, errore di sistema controllare il tracciato");
                        col4 = $('<div>').text("Errore");
                    } else if (item.impaginato || item.gruppoImpaginato) {
                        // Impaginato o Gruppo impaginato, aggiungiamo il checkbox nascosto
                        col4 = $('<div>').text(item.impaginato ? "Impaginato" : "Gruppo impaginato")
                            .append($('<input>').addClass("checkboxEliminazione").attr('type', 'checkbox').css('display', 'none').attr("idRec", item.record.id));
                    } else {
                        // Altrimenti, checkbox visibile
                        col4 = $('<input>').addClass("checkboxEliminazione").attr('type', 'checkbox').attr("idRec", item.record.id).prop('checked', !isCheckboxChecked);
                    }

                    // Creazione della riga e inserimento delle colonne
                    var row = $('<div>').addClass('row mb-2');
                    var colDiv1 = $('<div>').addClass('col text-center').append(col1);
                    var colDiv2 = $('<div>').addClass('col text-center').append(col2);
                    var colDiv3 = $('<div>').addClass('col text-center').append(col3);
                    var colDiv4 = $('<div>').addClass('col text-center').append(col4);
                    row.append(colDiv1, colDiv2, colDiv3, colDiv4);

                    // Aggiunta della riga al contentModalEliminazione
                    $("#contentModalEliminazione").append(row);
                    isCheckboxChecked = true;
                });                                
            }
        });
        $("#modalEliminazioneTracciato").modal("show");
        $("#modalDtlTracciato").modal("hide");
    }

    EliminaArticoloManualmente(modalEliminazione) {
        let me = this;
        let checkboxes = $(modalEliminazione).find(".checkboxEliminazione:checked");
        if (checkboxes.length == 0) {
            alert("Nessun elemento selezionato per l'eliminazione");
            return;
        }
        let element = this.tracciatoSource.find(f => f.idRec == $("#modalEliminazioneTracciato").attr("daEliminare"));
        let confirmed = confirm("L'elemento " + element.recordInTracciato[keyRefCodice] + " verrà rimosso dai tracciati selezionati, sicuro di voler procedere?");
        if (confirmed) {
            let records = [];
            checkboxes.each(function () {
                let obj = {
                    id: parseInt($(this).attr("idrec")),
                    codice: element.recordInTracciato[keyRefCodice],
                };
                records.push(obj);
            });
            let recs = {
                records: records
                }

            Call.do("Menabo", "eliminaArticoloManuale", "PUT", recs, this, function (result, me) {
                if (result.esito) {
                    alert("Operazione riuscita");
                    showLoading();
                    me.tracciatoSource = [];
                    $("#container_tracciato").empty();
                    $("#filterAgenzia").empty();
                    me.bindTracciato();
                    $("#modalEliminazioneTracciato").modal("hide");
                }
                else {
                    alert(result.error);
                }
            });
        }
    }

    impostaPrimarieSecondarie() {
        //alert("Quasi funzionante ma per ora no");
        //return;
        showLoading();
        Call.do("Menabo", "selezioneAutomaticaRefInMenabo/" + this.idTracciato, "GET", null, this, function (result, me) {
            if (result.esito) {
                alert("Operazione riuscita");
            }
            else {
                alert("Operazione fallita");
            }
            location.reload();
        });
    }

    creaCsv() {           //creazioneAddestramentoCsv //creazioneCsv
        Call.do("Menabo", "creazioneCsv/" + this.idTracciato, "GET", null, this, function (result, me) {
            if (result.esito) {
                alert("Operazione riuscita");
            }
            else {
                alert("Operazione fallita, " + result.error);
            }
        });
    }

    leggiCsv() {
        showLoading()
        Call.do("Menabo", "leggiCsv/" + this.idTracciato, "GET", null, this, function (result, me) {
            if (result.esito) {
                hideLoading();
                alert("Operazione riuscita");
            }
            else {
                hideLoading();
                alert("Operazione fallita, " + result.error);
            }
        });
    }

    compilazioneAutomatica() {
        let me = this;
        if (menaboInstance.pagineSource.length <= 0) {
            alert("Impossibile compilare il menabò se non sono presenti pagine, importa uno schema prima di iniziare");
            return;
        }
        showLoading();
        Call.do("Menabo", "AutoImpaginazione/" + this.idTracciato + "/" + this.areaTracciato, "GET", null, this, function (result, me) {            
            console.log(result);
            Call.do("Menabo", "scaricaPagineSource/" + menaboInstance.idTracciato, "GET", null, this, function (resultPag, me) {
                menaboInstance.pagineSource = resultPag;
                menaboInstance.tracciatoSource = [];
                $("#container_tracciato").empty();
                $("#ricercaAgenzia").empty();
                menaboInstance.bindTracciato();
                //menaboInstance.selezionataPagina(menaboInstance.currentPage);

                menaboInstance.AutoImpaginamentoRiuscito = result.menaboRefsImpaginated;
                menaboInstance.AutoImpaginamentoFallitoGenerico = result.menaboRefsFailed;
                $("#modalReportAutoMenabo").modal("show");
                $("#contentModalReportAutoMenabo").empty();
                let stringText = "";
                stringText += "<div class='row'><div class='col-11'>Elementi correttamente impaginati: " + (result.menaboRefsImpaginated.length) + " su " + (result.menaboRefsImpaginated.length + result.menaboRefsFailed.length) + "<hr></div>" +
                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi correttamente impaginati' listName='AutoImpaginamentoRiuscito' errorCode='0' aria-label='Vedi'>Vedi</button></div><br></div>";
                //if (listNoSpaceAdIndice.length > 0) {
                //    stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati: " + listNoSpaceAdIndice.length + "<hr></div>" +
                //        "<div class='col-1'><button type='button' class='btn btn-primary' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                //}
                if (result.menaboRefsFailed.length > 0) {
                    let countElementiImpaginati = result.menaboRefsFailed.filter(f => f.errorCode == 16).length;
                    if (countElementiImpaginati > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che erano già impaginati: " + countElementiImpaginati + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che erano già impaginati' listName='AutoImpaginamentoFallitoGenerico' errorCode='16' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countElementiSenzaPagina = result.menaboRefsFailed.filter(f => f.errorCode == 15).length;
                    if (countElementiSenzaPagina > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano una pagina non esistente: " + countElementiSenzaPagina + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano una pagina non esistente' listName='AutoImpaginamentoFallitoGenerico' errorCode='15' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countTroppiElementiPagina = result.menaboRefsFailed.filter(f => f.errorCode == 12).length;
                    if (countTroppiElementiPagina > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che non hanno trovato posto in pagina: " + countTroppiElementiPagina + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che non hanno trovato posto in pagina' listName='AutoImpaginamentoFallitoGenerico' errorCode='12' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countIndiciFuoriFormato = result.menaboRefsFailed.filter(f => f.errorCode == 2).length;
                    if (countIndiciFuoriFormato > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un formato maggiore non esistente: " + countIndiciFuoriFormato + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un formato maggiore non esistente' listName='AutoImpaginamentoFallitoGenerico' errorCode='2' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countIndiciGiaOccupati = result.menaboRefsFailed.filter(f => f.errorCode == 13).length;
                    if (countIndiciGiaOccupati > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati: " + countIndiciGiaOccupati + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati' listName='AutoImpaginamentoFallitoGenerico' errorCode='13' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countPagineNonDisponibili = result.menaboRefsFailed.filter(f => f.errorCode == 14).length;
                    if (countPagineNonDisponibili > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che non hanno trovato nessuna pagina disponibile: " + countPagineNonDisponibili + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che non hanno trovato nessuna pagina disponibile' listName='AutoImpaginamentoFallitoGenerico' errorCode='14' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                    let countElementiCheRichiedevanoUnDiversoFormato = result.menaboRefsFailed.filter(f => f.errorCode == 15).length;
                    if (countElementiCheRichiedevanoUnDiversoFormato > 0) {
                        stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un formato pagina non disponibile: " + countElementiCheRichiedevanoUnDiversoFormato + "<hr></div>" +
                            "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un formato pagina non disponibile' listName='AutoImpaginamentoFallitoGenerico' errorCode='15' aria-label='Vedi'>Vedi</button></div><br><br></div>";
                    }
                }
                /*                        stringText += "<div class='row'><div class='col-11'>Elementi che non rispettavano nessuna regola di ordinamento: " + (menaboInstance.tracciatoSource.length - listObjToImpaginate.length) + "<hr></div></div>";*/

                $("#contentModalReportAutoMenabo").append(stringText);

                const vediButtons = document.querySelectorAll('button.vediButton_');

                // Aggiungi un gestore di eventi a ciascun pulsante
                vediButtons.forEach(button => {
                    button.addEventListener('click', function () {
                        const listName = $(this).attr('listName');
                        const errorCode = $(this).attr('errorCode');
                        const title = $(this).attr('title');
                        const selectedList = menaboInstance[listName];
                        menaboInstance.vediDettaglioReportAutoImpaginamento(selectedList, errorCode, title);
                    });
                });
            });           
        });





//        Call.do("Tracciati", "getAllRegoleMenabo", "GET", null, this, function (result, me) {
//            if (typeof result === "string" || result == null) {
//                alert("Operazione fallita, " + result);
//            }
//            else {
//                let listObjToImpaginate = [];
//                let listObjCantImpaginate = [];
//                console.log(result);
//                let copyTracciatoSource = menaboInstance.tracciatoSource;
//                copyTracciatoSource.forEach(function (item) {
//                    let objResult = menaboInstance.checkCorrispondenzaRegole(item, result);
//                    if (objResult.esito) {
//                        let objToImpaginate = {
//                            menaboItem: item,
//                            idRegola: objResult.regola.id,
//                            regole: objResult.regola,
//                        }

//                        if (listObjToImpaginate.find(f => f.Pagina == objToImpaginate.regole.paginaDa && f.Indice == objToImpaginate.regole.indice && f.Indice != 0) == null) {
//                            listObjToImpaginate.push(objToImpaginate);
//                        }
//                        else {
//                            listObjCantImpaginate.push(objToImpaginate);
//                        }
//                    }
//                });
//                console.log(listObjToImpaginate);

//                let listObjItemGroup = [];
//                let groupElementsToRemove = [];
//                listObjToImpaginate.forEach(function (item) {
//                    if (!groupElementsToRemove.includes(item.menaboItem.recordInTracciato[keyRefCodice])) {
//                        if (item.menaboItem.recordInTracciato[keyScattoCodiceGruppo] != item.menaboItem.recordInTracciato[keyRefCodice]) {
//                            console.log("Elemento in un gruppo");
//                            let elementiGruppo = item.menaboItem.recordInTracciato[keyScattoCodiceGruppo].split(",");
//                            console.log(elementiGruppo);
//                            let allElementIncluded = true;
//                            elementiGruppo.forEach(function (element) {
//                                allElementIncluded = listObjToImpaginate.find(f => f.menaboItem.recordInTracciato[keyRefCodice] == element) != null;
//                            });
//                            if (allElementIncluded) {
//                                let objItemGroup = {
//                                    groupElementsToRemove: [],
//                                    groupsToAdd: "",
//                                }
//                                groupElementsToRemove = elementiGruppo;
//                                objItemGroup.groupElementsToRemove = objItemGroup.groupElementsToRemove.concat(elementiGruppo);
//                                objItemGroup.groupsToAdd = item.menaboItem.recordInTracciato[keyScattoCodiceGruppo];
//                                listObjItemGroup.push(objItemGroup);
//                            }
//                        }
//                    }
//                });

//                listObjItemGroup.forEach(function (item) {
//                    let regola = listObjToImpaginate.find(f => f.menaboItem.recordInTracciato[keyRefCodice] == item.groupElementsToRemove[0]).regole;
//                    console.log(item.groupElementsToRemove[0]);
//                    let indexToPush = listObjToImpaginate.findIndex(f => f.menaboItem.recordInTracciato[keyRefCodice] == item.groupElementsToRemove[0]);
//                    item.groupElementsToRemove.forEach(function (itemToRemove) {
//                        let objToRemove = listObjToImpaginate.find(f => f.menaboItem.recordInTracciato[keyRefCodice] == itemToRemove);
//                        listObjToImpaginate = listObjToImpaginate.filter(f => f !== objToRemove);
//                    });
//                    let codiceGruppo = item.groupsToAdd;
//                    let objToImpaginate = {
//                        menaboItem: menaboInstance.tracciatoSource.find(f => f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == codiceGruppo),
//                        regole: regola,
//                        //Pagina: pagina,
//                        //Indice: indice,
//                    }
//                    listObjToImpaginate.splice(indexToPush, 0, objToImpaginate);
//                });


//                let listAlreadyImpaginate = [];
//                let listNoSpacePagina = [];
//                //let listNoSpaceAdIndice = [];
//                listObjToImpaginate.forEach(function (item) {
//                    if (menaboInstance.pagineSource.find(f => f.menaboRefs.find(g => (item.menaboItem.isGruppo ? g.codiceGruppo == item.menaboItem.recordInTracciato[keyScattoCodiceGruppo] : g.idRecord == item.menaboItem.idRec)))!=null) {
//                        listAlreadyImpaginate.push(item);
//                    }
//                    if (menaboInstance.pagineSource.find(f => f.numero == item.regole.paginaA) == null || menaboInstance.pagineSource.find(f => f.numero == item.regole.paginaDa) == null) {
//                        listNoSpacePagina.push(item);
//                    }
//                    //else if (menaboInstance.pagineSource.find(f => f.numero == item.Pagina && f.menaboRefs.find(g => g.indice == item.Indice) != null) != null) {
//                    //    listNoSpaceAdIndice.push(item);
//                    //}
//                });
//                console.log(listAlreadyImpaginate);
//                console.log(listNoSpacePagina);

//                listObjToImpaginate = listObjToImpaginate.filter(elemento => !listAlreadyImpaginate.includes(elemento));
//                listObjToImpaginate = listObjToImpaginate.filter(elemento => !listNoSpacePagina.includes(elemento));
//                //listObjToImpaginate = listObjToImpaginate.filter(elemento => !listNoSpaceAdIndice.includes(elemento));
//                console.log(listObjToImpaginate);

//                let tmpList = [];
//                let tmplistObjToImpaginate = [];
//                result.forEach(function (item) {
//                    listObjToImpaginate.forEach(function (ref) {
//                        if (ref.regole.id == item.id) {
//                            tmpList.push(ref);
//                        }
//                    });
//                    tmplistObjToImpaginate = tmplistObjToImpaginate.concat(tmpList);
//                    tmpList = [];
//                });
//                listObjToImpaginate = tmplistObjToImpaginate;


//                console.log(listObjToImpaginate);

//                let objs = {
//                    refsToImpaginate: [],
//                }

//                let refConIndicePreciso = [];
//                let refConFormatoPaginaPreciso = [];
//                let refConFormatoPaginaEIndicePreciso = [];
//                let refSenzaIndicePreciso = [];

//                listObjToImpaginate.forEach(function (item) {
//                    let objRef = { idRecord: (item.menaboItem.isGruppo ? 0 : item.menaboItem.idRec), codiceGruppo: (item.menaboItem.isGruppo ? item.menaboItem.recordInTracciato[keyScattoCodiceGruppo] : 0), idPagina: menaboInstance.pagineSource.find(f => f.numero == item.regole.paginaDa).id };

//                    let objRefToImpaginate = {
//                        menaboref: objRef,
//                        regole: item.regole,
//                        idTracciato: menaboInstance.idTracciato,
//                    }
//                    if (me.meccanicheDb[objRefToImpaginate.meccanica] != "1x1" && objRefToImpaginate.indicePreciso)
//                    {
//                        refConFormatoPaginaEIndicePreciso.push(objRefToImpaginate);
//                    }
//                    else if (me.meccanicheDb[objRefToImpaginate.meccanica] != "1x1")
//                    {
//                        refConFormatoPaginaPreciso.push(objRefToImpaginate);
//                    }
//                    else if (objRefToImpaginate.indicePreciso) {
//                        refConIndicePreciso.push(objRefToImpaginate);
//                    }
//                    else {
//                        refSenzaIndicePreciso.push(objRefToImpaginate);
//                    }
                    
//                });
//                console.log(objs);
//                objs.refsToImpaginate = refConFormatoPaginaEIndicePreciso.concat(refConFormatoPaginaPreciso);
//                objs.refsToImpaginate = objs.refsToImpaginate.concat(refConIndicePreciso);
//                objs.refsToImpaginate = objs.refsToImpaginate.concat(refSenzaIndicePreciso);

//                Call.do("Menabo", "AllInMenabo", "POST", objs, this, function (result, me) {
//                    $("#container_tracciato").empty();
//                    $("#ricercaAgenzia").empty();
//                    showLoading();
//                    Call.do("Menabo", "scaricaPagineSource/" + menaboInstance.idTracciato, "GET", null, this, function (result, me) {
//                        menaboInstance.pagineSource = result;
//                        menaboInstance.bindTracciato();
//                        menaboInstance.selezionataPagina(menaboInstance.currentPage);
//                    });
//                    console.log(result);
//                    menaboInstance.AutoImpaginamentoRiuscito = result.menaboRefsImpaginated;
//                    menaboInstance.AutoImpaginamentoFallitoGenerico = result.menaboRefsFailed;
//                    menaboInstance.AutoImpaginamentoFallitoNoSpacePagina = listNoSpacePagina;
//                    menaboInstance.AutoImpaginamentoFallitoAlreadyImpaginate = listAlreadyImpaginate;
//                    const copYlistNoSpacePaginaSenzaComuni = listNoSpacePagina.filter(item => !listAlreadyImpaginate.includes(item));
//                    $("#modalReportAutoMenabo").modal("show");
//                    $("#contentModalReportAutoMenabo").empty();
//                    let stringText = ""; 
//                    stringText += "<div class='row'><div class='col-11'>Elementi correttamente impaginati: " + (result.menaboRefsImpaginated.length) + " su " + (listObjToImpaginate.length + listAlreadyImpaginate.length + copYlistNoSpacePaginaSenzaComuni.length) + "<hr></div>" +
//                        "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi correttamente impaginati' listName='AutoImpaginamentoRiuscito' errorCode='0' aria-label='Vedi'>Vedi</button></div><br></div>";

//                        if (listAlreadyImpaginate.length > 0) {
//                            stringText += "<div class='row'><div class='col-11'>Elementi che erano già impaginati: " + listAlreadyImpaginate.length + "<hr></div>" +
//                                "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che erano già impaginati' listName='AutoImpaginamentoFallitoAlreadyImpaginate' errorCode='Impaginati' aria-label='Vedi' data-list='listAlreadyImpaginate'>Vedi</button></div><br><br></div>";
//                        }
//                        if (listNoSpacePagina.length > 0) {
//                            stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano una pagina non esistente: " + listNoSpacePagina.length + "<hr></div>" +
//                                "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano una pagina non esistente' listName='AutoImpaginamentoFallitoNoSpacePagina' errorCode='PaginaInesistente' aria-label='Vedi' data-list='listNoSpacePagina'>Vedi</button></div><br><br></div>";
//                        }
//                        //if (listNoSpaceAdIndice.length > 0) {
//                        //    stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati: " + listNoSpaceAdIndice.length + "<hr></div>" +
//                        //        "<div class='col-1'><button type='button' class='btn btn-primary' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                        //}
//                        if (result.menaboRefsFailed.length > 0) {
//                            let countTroppiElementiPagina = result.menaboRefsFailed.filter(f => f.errorCode == 12).length;
//                            if (countTroppiElementiPagina > 0) {
//                                stringText += "<div class='row'><div class='col-11'>Elementi che non hanno trovato posto in pagina: " + countTroppiElementiPagina + "<hr></div>" +
//                                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che non hanno trovato posto in pagina' listName='AutoImpaginamentoFallitoGenerico' errorCode='12' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                            }
//                            let countIndiciFuoriFormato = result.menaboRefsFailed.filter(f => f.errorCode == 2).length;
//                            if (countIndiciFuoriFormato > 0) {
//                                stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un formato maggiore non esistente: " + countIndiciFuoriFormato + "<hr></div>" +
//                                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un formato maggiore non esistente' listName='AutoImpaginamentoFallitoGenerico' errorCode='2' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                            }
//                            let countIndiciGiaOccupati = result.menaboRefsFailed.filter(f => f.errorCode == 13).length;
//                            if (countIndiciGiaOccupati > 0) {
//                                stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati: " + countIndiciGiaOccupati + "<hr></div>" +
//                                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un indice già occupato da elementi precedentemente impaginati' listName='AutoImpaginamentoFallitoGenerico' errorCode='13' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                            }
//                            let countPagineNonDisponibili = result.menaboRefsFailed.filter(f => f.errorCode == 14).length;
//                            if (countPagineNonDisponibili > 0) {
//                                stringText += "<div class='row'><div class='col-11'>Elementi che non hanno trovato nessuna pagina disponibile: " + countPagineNonDisponibili + "<hr></div>" +
//                                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che non hanno trovato nessuna pagina disponibile' listName='AutoImpaginamentoFallitoGenerico' errorCode='14' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                            }
//                            let countElementiCheRichiedevanoUnDiversoFormato = result.menaboRefsFailed.filter(f => f.errorCode == 15).length;
//                            if (countElementiCheRichiedevanoUnDiversoFormato > 0) {
//                                stringText += "<div class='row'><div class='col-11'>Elementi che richiedevano un formato pagina non disponibile: " + countElementiCheRichiedevanoUnDiversoFormato + "<hr></div>" +
//                                    "<div class='col-1'><button type='button' class='btn btn-primary vediButton_' title='Elementi che richiedevano un formato pagina non disponibile' listName='AutoImpaginamentoFallitoGenerico' errorCode='15' aria-label='Vedi'>Vedi</button></div><br><br></div>";
//                            }
//                        }
///*                        stringText += "<div class='row'><div class='col-11'>Elementi che non rispettavano nessuna regola di ordinamento: " + (menaboInstance.tracciatoSource.length - listObjToImpaginate.length) + "<hr></div></div>";*/

//                        $("#contentModalReportAutoMenabo").append(stringText);

//                        const vediButtons = document.querySelectorAll('button.vediButton_');

//                        // Aggiungi un gestore di eventi a ciascun pulsante
//                        vediButtons.forEach(button => {
//                            button.addEventListener('click', function () {
//                                const listName = $(this).attr('listName');
//                                const errorCode = $(this).attr('errorCode');
//                                const title = $(this).attr('title');
//                                const selectedList = menaboInstance[listName];
//                                menaboInstance.vediDettaglioReportAutoImpaginamento(selectedList, errorCode, title);
//                            });
//                        });
                    
//                });
//            }
//        });
    }

    vediDettaglioReportAutoImpaginamento(list, errorCode, title) {
        console.log(list);
        console.log(errorCode);
        $("#titleDettaglioReport").text(title);
        $("#modalDettaglioReportAutoMenabo").modal("show");
        $("#contentModalDettaglioReportAutoMenabo").empty()
        if (list.length == 0) {
            let stringText = "<div class='row'><div class='col-11'>Nessun elemento presente in lista </div></div>";
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);
            return;
        }
        if (errorCode == 16) {
            let stringText = "";
            list.forEach(function (item) {
                if (item.errorCode == errorCode) {
                    stringText += "<div class='row'><div class='col-4'>COD: " + (item.refs.menaboref.idRecord != 0 ? menaboInstance.tracciatoSource.find(f => f.idRec == item.refs.menaboref.idRecord).recordInTracciato[keyRefCodice] : item.refs.menaboref.codiceGruppo) + "</div>";
                    stringText += (item.refs.regole.paginaA != item.refs.regole.paginaDa ? "<div class='col-4'> Pag richieste: Tra" + item.refs.regole.paginaDa + " e " + item.refs.regole.paginaA + "</div>" : "<div class='col-4'> Pag richiesta: " + item.refs.regole.paginaA + "</div>");
                    let paginaImpaginato = menaboInstance.pagineSource.find(f => {
                        const foundItem = (item.refs.menaboref.idRecord != 0 ? f.menaboRefs.find(g => g.idRecord == item.refs.menaboref.idRecord): f.menaboRefs.find(g=> g.codiceGruppo == item.refs.menaboref.codiceGruppo));
                        if (foundItem !== null) {
                            return foundItem;
                        }
                        else {
                            return null;
                        }
                    });
                    stringText += "<div class='col-4'> Impaginato a: " + (paginaImpaginato != null ? paginaImpaginato.numero : "Non trovato") + "</div></div><hr>";
                }
            });
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);
            $("#contentModalDettaglioReportAutoMenabo").append("<form action=\"Menabo/creaFile\" method=\"POST\"><input type=\"hidden\" id=\"fileContent\" name=\"fileContent\" value=\"" + title + "<br>" + stringText + "\" /><input type=\"hidden\" id=\"fileName\" name=\"fileName\" value=\"report.html\" /><input type=\"submit\" value=\"Scarica report\" /></form>");

        }
        else if (errorCode == 15) {
            let stringText = "";
            const paginaConValoreMassimo = menaboInstance.pagineSource.reduce((max, current) => {
                return max.numero > current.numero ? max : current;
            });
            stringText += "<div class='row'><div class='col-4'> Pagina massima: " + paginaConValoreMassimo.numero + "</div></div><hr><br>";
            list.forEach(function (item) {
                stringText += "<div class='row'><div class='col-4'>COD: " + (item.refs.menaboref.idRecord != 0 ? menaboInstance.tracciatoSource.find(f => f.idRec == item.refs.menaboref.idRecord).recordInTracciato[keyRefCodice] : item.refs.menaboref.codiceGruppo) + "</div>";
                stringText += (item.refs.regole.paginaA != item.refs.regole.paginaDa ? "<div class='col-4'> Pag richieste: Tra" + item.refs.regole.paginaDa + " e " + item.refs.regole.paginaA + "</div>" : "<div class='col-4'> Pag richiesta: " + item.refs.regole.paginaA + "</div>");

            });
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);

            $("#contentModalDettaglioReportAutoMenabo").append("<form action=\"Menabo/creaFile\" method=\"POST\"><input type=\"hidden\" id=\"fileContent\" name=\"fileContent\" value=\"" + title + "<br>" + stringText + "\" /><input type=\"hidden\" id=\"fileName\" name=\"fileName\" value=\"report.html\" /><input type=\"submit\" value=\"Scarica report\" /></form>");
        }
        else if (errorCode == 13) {
            let stringText = "";
            list.forEach(function (item) {
                if (item.errorCode == errorCode) {
                    stringText += "<div class='row'><div class='col-4'>COD: " + (item.refs.menaboref.idRecord != 0 ? menaboInstance.tracciatoSource.find(f => f.idRec == item.refs.menaboref.idRecord).recordInTracciato[keyRefCodice] : item.refs.menaboref.codiceGruppo) + "</div>";
                    stringText += (item.refs.regole.paginaA != item.refs.regole.paginaDa ? "<div class='col-4'> Pag richieste: Tra" + item.refs.regole.paginaDa + " e " + item.refs.regole.paginaA + "</div>" : "<div class='col-4'> Pag richiesta: " + item.refs.regole.paginaA + "</div>");
                    stringText += "<div class='col-4'> Indice richiesto: " + item.refs.regole.indice + "</div></div><hr>";
                }
            });
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);

            $("#contentModalDettaglioReportAutoMenabo").append("<form action=\"Menabo/creaFile\" method=\"POST\"><input type=\"hidden\" id=\"fileContent\" name=\"fileContent\" value=\"" + title + "<br>" + stringText + "\" /><input type=\"hidden\" id=\"fileName\" name=\"fileName\" value=\"report.html\" /><input type=\"submit\" value=\"Scarica report\" /></form>");
        }
        else if (errorCode == 12 || errorCode == 2 || errorCode == 14 || errorCode == 15) {
            let stringText = "";
            list.forEach(function (item) {
                if (item.errorCode == errorCode) {
                    stringText += "<div class='row'><div class='col-4'>COD: " + (item.refs.menaboref.idRecord != 0 ? menaboInstance.tracciatoSource.find(f => f.idRec == item.refs.menaboref.idRecord).recordInTracciato[keyRefCodice] : item.refs.menaboref.codiceGruppo) + "</div>";
                    stringText += (item.refs.regole.paginaA != item.refs.regole.paginaDa ? "<div class='col-4'> Pag richieste: Tra " + item.refs.regole.paginaDa + " e " + item.refs.regole.paginaA + "</div></div>" : "<div class='col-4'> Pag richiesta: " + item.refs.regole.paginaA + "</div></div>");
                }
            });
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);
            $("#contentModalDettaglioReportAutoMenabo").append("<form action=\"Menabo/creaFile\" method=\"POST\"><input type=\"hidden\" id=\"fileContent\" name=\"fileContent\" value=\"" + title + "<br>" + stringText + "\" /><input type=\"hidden\" id=\"fileName\" name=\"fileName\" value=\"report.html\" /><input type=\"submit\" value=\"Scarica report\" /></form>");
        }
        else if (errorCode == 0) {

            let stringText = "";
            list.forEach(function (item) {
                stringText += "<div class='row'><div class='col-4'>COD: " + (item.refs.menaboref.idRecord != 0 ? menaboInstance.tracciatoSource.find(f => f.idRec == item.refs.menaboref.idRecord).recordInTracciato[keyRefCodice] : item.refs.menaboref.codiceGruppo) + "</div>";
                stringText += "<div class='col-4'> Indice: " + item.refs.indiceImpaginato+ "</div>";
                stringText += "<div class='col-4'> Pag: " + item.refs.paginaImpaginato + "</div></div><hr>";
            });
            $("#contentModalDettaglioReportAutoMenabo").append(stringText);

            $("#contentModalDettaglioReportAutoMenabo").append("<form action=\"Menabo/creaFile\" method=\"POST\"><input type=\"hidden\" id=\"fileContent\" name=\"fileContent\" value=\"" + title + "<br>" + stringText + "\" /><input type=\"hidden\" id=\"fileName\" name=\"fileName\" value=\"report.html\" /><input type=\"submit\" value=\"Scarica report\" /></form>");

        }
    }

    checkCorrispondenzaRegole(menaboItem, setDiRegoleList) {
        let objRes = {
            esito: false,
            regola: null
        }
        setDiRegoleList.forEach(function (setRegoleList) {
            if (setRegoleList.id < 50) {
                let notValidLabelOrGroup = false;
                if (menaboItem.isGruppo || setRegoleList.label != null && setRegoleList.label != "" && setRegoleList.label != menaboItem.label) {
                    notValidLabelOrGroup = true
                }
                if (objRes.esito == false && !notValidLabelOrGroup) {
                    setRegoleList.setRegoleList.forEach(function (setRegole) {
                        if (objRes.esito == false) {
                            let regoleRispettate = true;
                            let entered = false;
                            setRegole.setDiRegole.forEach(function (regole) {
                                entered = true;
                                if (regoleRispettate) {
                                    if (menaboItem.recordInTracciato[regole.nomeCampo] == null) {
                                        console.log("Nullo");
                                    }
                                    regoleRispettate = menaboInstance.checkCorrispondenza(regole.operatorId, menaboItem.recordInTracciato[regole.nomeCampo], regole.value);
                                }
                            });
                            if (regoleRispettate && entered) {

                                objRes = {
                                    esito: true,
                                    regola: setRegoleList
                                }
                            }
                        }
                    });
                }
            }
            
        });

        return objRes;
    }

    checkCorrispondenza(operatore, menaboItemValue, regolaValue) {
        if (menaboItemValue == null) {
            return false;
        }
        switch (operatore) {
            case 0: //uguale
                return (menaboItemValue.toString().toLowerCase() == regolaValue.toString().toLowerCase());
                break;
            case 1: //Diverso
                return (menaboItemValue.toString().toLowerCase() != regolaValue.toString().toLowerCase());
                break;
            case 2: //Contiene
                return (menaboItemValue.toString().toLowerCase().includes(regolaValue.toString().toLowerCase()));
                break;
            case 3: //Non_contiene
                return (!menaboItemValue.toString().toLowerCase().includes(regolaValue.toString().toLowerCase()));
                break;
            case 4: //Inizia_con
                return (menaboItemValue.toString().toLowerCase().startsWith(regolaValue.toString().toLowerCase()));
                break;
            case 5: //Finisce_con
                return (menaboItemValue.toString().toLowerCase().endsWith(regolaValue.toString().toLowerCase()));
                break;
            case 6: //Maggiore_di
                if (!isNaN(parseFloat(menaboItemValue)) && parseFloat(parseFloat(regolaValue))) {
                    return (parseFloat(menaboItemValue) > parseFloat(regolaValue));
                }
                else {
                    return false;
                }
                break;
            case 7: //Maggiore_o_uguale_di
                if (!isNaN(parseFloat(menaboItemValue)) && parseFloat(parseFloat(regolaValue))) {
                    return (parseFloat(menaboItemValue) >= parseFloat(regolaValue));
                }
                else {
                    return false;
                }
                break;
            case 8: //Minore_di
                if (!isNaN(parseFloat(menaboItemValue)) && parseFloat(parseFloat(regolaValue))) {
                    return (parseFloat(menaboItemValue) < parseFloat(regolaValue));
                }
                else {
                    return false;
                }
                break;
            case 9: //Minore_o_uguale_di
                if (!isNaN(parseFloat(menaboItemValue)) && parseFloat(parseFloat(regolaValue))) {
                    return (parseFloat(menaboItemValue) <= parseFloat(regolaValue));
                }
                else {
                    return false;
                }
                break;
            default:
                console.log("Scelta non valida");
                return false;
                break;
        }
    }

    CambioModalita(switchVal) {
        console.log(switchVal);
        let me = this;
        if (switchVal) {
            var switchInput = $("#switchModalitaAutomatica");
            var switchInputId = switchInput.attr("id");
            var labelElement = $("label[for='" + switchInputId + "']");
            labelElement.text("Modalità automatica");
            $("#opzioniAggiungiATracciato").css("display", "none");
            $("#aggiungiFiltriRow").css("display", "flex");
            $("#footerImpaginazioneRapida").css("display", "flex");
            $("#selezionaMeccanica").empty();
            $("#selezionaMeccanica").append("<option selected value='0'>Auto</option>");
            this.meccanicheSource.forEach(function (item) {
                if (item.aree.some(area => area.toLowerCase() === me.areaTracciato.toLowerCase())) {
                    $("#selezionaMeccanica").append("<option value=\"" + item.nomeTraduzione + "\">" + item.nomeTraduzione + "</option>");
                }
            });
        }
        else {
            var switchInput = $("#switchModalitaAutomatica");
            var switchInputId = switchInput.attr("id");
            var labelElement = $("label[for='" + switchInputId + "']");
            labelElement.text("Modalità manuale");
            $("#aggiungiFiltriRow").css("display", "none");
            $("#footerImpaginazioneRapida").css("display", "none");
            $("#opzioniAggiungiATracciato").css("display", "flex");
            this.rimuoviTuttiParametriRicerca();
        }
    }

    ImpaginazioneRapida(numberOfRefToImpaginate, StartIndex) {
        if (this.pagSelected <= 0) {
            alert("Selezionare la pagina prima di impaginare");
            return;
        }
        let formatoSplit = $("#cmb_formato_griglia").val().split("x")
        let spaziPagina = parseInt(formatoSplit[0]) * parseInt(formatoSplit[1]);
        console.log(spaziPagina);
        let distinctIndici = [];
        this.pagineSource.find(f => f.id == this.pagSelected).menaboRefs.forEach(function (item) {
            if (distinctIndici.find(f=> f == item.indice) == null) {
                distinctIndici.push(item.indice);
            }
        });

        if (spaziPagina <= distinctIndici.length) {
            alert("La pagina è già piena");
            return;
        }

        //if ($("#selezionaMeccanica").val() == "0") {
        //    alert("Modalità di inserimento Automatico non ancora implementata, scegliere la meccanica");
        //    return;
        //}
        numberOfRefToImpaginate = (numberOfRefToImpaginate == '' || parseInt(numberOfRefToImpaginate) <= 0 ? 0 : parseInt(numberOfRefToImpaginate));
        numberOfRefToImpaginate = (numberOfRefToImpaginate < spaziPagina - distinctIndici.length && numberOfRefToImpaginate > 0 ? numberOfRefToImpaginate : spaziPagina - distinctIndici.length)

        StartIndex = (StartIndex == '' || parseInt(StartIndex) <= 0 ? 0 : parseInt(StartIndex));
        console.log(numberOfRefToImpaginate);
        console.log(StartIndex);
        let me = this;
        let record = $("#container_tracciato").find(".record_menabo, .record_menabo_gruppo");
        let listRegole = []
        let regola = {
            id: 0,
            setRegoleList: [],
            ordine: 0,
            idAddestramento: 0,
            paginaDa: me.pagineSource.find(f=>f.id == this.pagSelected).numero,
            paginaA: me.pagineSource.find(f => f.id == this.pagSelected).numero,
            indice: StartIndex,
            indicePreciso: false,
            restrizioni: 0,
            formatoPagina: "0",
            meccanica: $("#selezionaMeccanica").val(),
            label: "",
        }

        listRegole.push(regola);
        let objs = {
            refsToImpaginate: [],
        }

        record.each(function () {
            if (numberOfRefToImpaginate > 0) {
                let isGruppo = $(this).hasClass("record_menabo_gruppo");
                if (isGruppo) {
                    let elementCheckedLikeSingle = false;
                    $(this).closest(".groupItemListaTracciato").find(".record_menabo").each(function () {
                        if ($(this).find("#onoff_impaginato").prop("checked") == true) {
                            elementCheckedLikeSingle = true
                        }
                    });
                    if (!elementCheckedLikeSingle && $(this).parent().parent().css("display") != "none" && !$(this).find("#onoff_impaginato").prop("checked")) {
                        let objToImpaginate = {
                            menaboItem: me.tracciatoSource.find(f => f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == $(this).attr("codice_gruppo")),
                            idRegola: 0,
                            regole: listRegole,
                        }
                        objs.refsToImpaginate.push(objToImpaginate);
                        numberOfRefToImpaginate--;
                    }
                }
                else {
                    let gruppoInserito = false;
                    let elementCheckedLikeSingle = false;
                    if ($(this).attr("codice_gruppo").includes(",")) {
                        gruppoInserito = $(this).closest(".groupItemListaTracciato").find(".record_menabo_gruppo").find("#onoff_impaginato").prop("checked");
                        $(this).closest(".groupItemListaTracciato").find(".record_menabo").each(function () {
                            if ($(this).find("#onoff_impaginato").prop("checked") == true) {
                                elementCheckedLikeSingle = true
                            }
                        });
                    }
                    if (!gruppoInserito && elementCheckedLikeSingle && $(this).css("display") != "none" && !$(this).find("#onoff_impaginato").prop("checked")) {

                        let objToImpaginate = {
                            menaboItem: me.tracciatoSource.find(f => f.idRec.toString() == $(this).attr("id_rec")),
                            idRegola: 0,
                            regole: listRegole,
                        }
                        objs.refsToImpaginate.push(objToImpaginate);
                        numberOfRefToImpaginate--;
                    }
                }
            }
        });   

        let objToSend = {
            refsToImpaginate : [],
        };

        objs.refsToImpaginate.forEach(function (item) {
            let objRef = { idRecord: (item.menaboItem.isGruppo ? 0 : item.menaboItem.idRec), codiceGruppo: (item.menaboItem.isGruppo ? item.menaboItem.recordInTracciato[keyScattoCodiceGruppo] : 0), idPagina: menaboInstance.pagineSource.find(f => f.numero == item.regole[0].paginaDa).id };

            let refsToImpaginate = {
                menaboref: objRef,
                regole: item.regole,
                idTracciato: me.idTracciato,
                areaTracciato: me.areaTracciato
            }

            objToSend.refsToImpaginate.push(refsToImpaginate);
        });

        showLoading();
        Call.do("Menabo", "AllInMenabo" , "POST", objToSend, this, function (result, me) {
            console.log(result);
            if (!result.failedOperation) {
                result.menaboRefsImpaginated.forEach(function (item) {
                    let tracciatoElement = (item.refs.menaboref.idRecord != null ? $("#offcanvasTracciato").find(".record_menabo[id_rec='" + item.refs.menaboref.idRecord.toString() + "']") : $("#offcanvasTracciato").find(".record_menabo_gruppo[codice_gruppo='" + item.refs.menaboref.codiceGruppo + "']"));
                    tracciatoElement.find("#lab_onoff_impaginato").text(item.refs.indiceImpaginato + " a Pag. " + item.refs.paginaImpaginato);
                    tracciatoElement.find("#onoff_impaginato").prop("checked", true);
                    console.log(tracciatoElement.find("#lab_onoff_impaginato"))
                    let pagItem = me.pagineSource.find(f => f.numero == item.refs.paginaImpaginato);
                    pagItem.menaboRefs.push(item.refs.menaboref);
                    let record = me.tracciatoSource.find(f => (item.refs.menaboref.idRecord != null ? f.idRec == item.refs.menaboref.idRecord : f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == item.refs.menaboref.codiceGruppo));
                    record.recordImpaginato = item.refs.menaboref;
                    me.renderBoxInMenabo(item.refs.menaboref);

                    if (record.isGruppo || !record.isGruppo && record.recordInTracciato[keyScattoCodiceGruppo] != record.recordInTracciato[keyRefCodice]) {
                        if (!record.isGruppo) {
                            //Se è in un gruppo, disabilito check inserimento del gruppo
                            tracciatoElement.find("#lab_onoff_impaginato").closest("ul").find(".record_menabo_gruppo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });
                        }
                        else {
                            //Disabilito il check inserimento di tutte le ref figlie
                            tracciatoElement.closest("ul").find(".record_menabo").each(function () {
                                $(this).find("#onoff_impaginato").attr("disabled", true);
                            });
                        }
                    }
                });
                me.selezionataPagina();
            }
            else {
                me.showAlert("danger", result.error, 0);
                console.log(result.error);
            }
            hideLoading();
            //sender.parent().find("#lab_onoff_impaginato").text(result.ref.indice + " a Pag. " + result.ref.idPaginaNavigation.numero);


            //Inserisco fisicamente il box nella pagina corrente


        });


    }

    onMessageMenabo(message) {
        console.log(message);
        if (message.areaOperativa == 2 && message.tracciato == menaboInstance.idTracciato) {

        }
        else if (message.areaOperativa == 4) {
            switch (message.messageId) {
                case 101:
                    let codiciList = {
                        stringhe: message.codici,
                    };
                    menaboInstance.aggiornaRevisioni(codiciList);
                    break; // Aggiungi l'istruzione break per terminare il caso 101

                default:
                    // Inserisci eventuali istruzioni per il caso predefinito
                    break; // Aggiungi l'istruzione break per il caso predefinito
            }
        }
    }

    aggiornaRevisioni(codiciList) {
        let me = this;
        Call.do("Revisore", "getArticoliDescrizioni", "PUT", codiciList, this, function (result, sender) {
            console.log(result);
            result.forEach(function (item) {
                let element = null;
                if (me.tracciatoSource.find(f => (item.codiceGruppo != null ? f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo : !f.isGruppo && f.recordInTracciato[keyRefCodice] == item.idArticoloNavigation.codice)) != null) {
                    element = me.tracciatoSource.find(f => (item.codiceGruppo != null ? f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == item.codiceGruppo : !f.isGruppo && f.recordInTracciato[keyRefCodice] == item.idArticoloNavigation.codice));
                    element.recordRevisionato = item;
                }
                if (element != null) {
                    let recHtml = null;
                    if (element.isGruppo) {
                        recHtml = $(".modal").find(".record-revisione[codice_gruppo='" + element.recordInTracciato[keyScattoCodiceGruppo] + "']");
                    }
                    else {
                        recHtml = $(".modal").find(".record-revisione[id_ref='" + item.idArticolo + "']");
                    }
                    if (recHtml != null) {
                        recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                        recHtml.find("#Descrizione1").val(item.descrizione1 == null ? "" : item.descrizione1);
                        recHtml.find("#Descrizione2").val(item.descrizione2 == null ? "" : item.descrizione2);
                        recHtml.find("#Descrizione3").val(item.descrizione3 == null ? "" : item.descrizione3);
                        recHtml.find("#Descrizione4").val(item.descrizione4 == null ? "" : item.descrizione4);
                        recHtml.find("#DescrizioneIndd").val(item.descrizioneIndd == null ? "" : item.descrizioneIndd);
                        recHtml.find("#Peso").val(item.peso == null ? "" : item.peso);
                        recHtml.find("#Um").val(item.um == null ? "" : item.um);
                        if (element.recordImpaginato != null && element.recordImpaginato.idPagina == parseInt(me.pagSelected)) {
                            let boxRevisionato = $(".refInMenabo[id_menabo_ref='" + element.recordImpaginato.id + "']");
                            boxRevisionato.find("#stato_revisione").removeClass("bg-danger");
                            boxRevisionato.find("#stato_revisione").removeClass("bg-warning");
                            boxRevisionato.find("#stato_revisione").addClass("bg-success");
                            boxRevisionato.find("#stato_revisione").text("Revisonato");
                        }
                    }
                }
            });
        });
    }

    //ApplicaSegnaposto(groupElements, codice) {
    //    if (groupElements.length > 1 && codice.indexOf(",") == -1) {
    //        return;
    //    }

    //    let segnaposto = $("#segnaposto_template").clone();
    //    segnaposto = $(segnaposto.html());

    //    let segnapostoChiave = [];
    //    for (const param of this.agenzia.getParametriSegnaposto() /*this.parametriComposizioneCustom*/) {
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
    //            if (groupElements[0].recordInTracciato["copertina"] != null && groupElements[0].recordInTracciato["copertina"].toString().toLowerCase() == "x") {
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

    ApplicaSegnaposto(ultimaEtichetta, singolo) {
        try {

            let segnapostoObj = null;
            if (this.agenzia.getParametriSegnaposto != null) {
                segnapostoObj = this.agenzia.getParametriSegnaposto();
            }

            let segnaposto = $("#segnaposto_template").clone();
            segnaposto = $(segnaposto.html());

            let segna = {
                chiave: [],
                nome: [],
                requiredVal: [],
                comparator: [],
                hideVal: [],
            };
            for (const param in segnapostoObj) {
                if (param == "segnaposto") {
                    //let chiavi = segnapostoObj[param].split(" ");//.segnaposto.split(" ");
                    //chiavi.forEach(function (item) {
                    //    segna.chiave.push(item);
                    //});

                    let chiaviPerPriorita = segnapostoObj[param].split(",");//.segnaposto.split(" ");
                    chiaviPerPriorita.forEach(function (item) {
                        let chiavi = item.split(" ");
                        segna.chiave.push(chiavi);
                    });
                }
                if (param == "nomeVisualizzato") {
                    let chiaviPerPriorita = segnapostoObj[param].split(",");//.segnaposto.split(" ");
                    chiaviPerPriorita.forEach(function (item) {
                        let chiavi = item.split(" ");
                        segna.nome.push(chiavi);
                    });

                    //let chiavi = segnapostoObj[param].split(" ");//.nomeVisualizzato.split(" ");
                    //chiavi.forEach(function (item) {
                    //    segna.nome.push(item);
                    //});
                }

                if (param == "requiredVal") {
                    let chiaviPerPriorita = segnapostoObj[param].split(",");//.segnaposto.split(" ");
                    chiaviPerPriorita.forEach(function (item) {
                        let chiavi = item.split(" ");
                        segna.requiredVal.push(chiavi);
                    });

                    //let chiavi = segnapostoObj[param].split(" ");//.nomeVisualizzato.split(" ");
                    //chiavi.forEach(function (item) {
                    //    segna.nome.push(item);
                    //});
                }

                if (param == "comparator") {
                    let chiaviPerPriorita = segnapostoObj[param].split(",");//.segnaposto.split(" ");
                    chiaviPerPriorita.forEach(function (item) {
                        let chiavi = item.split(" ");
                        segna.comparator.push(chiavi);
                    });
                }

                if (param == "hideVal") {
                    let chiaviPerPriorita = segnapostoObj[param].split(",");//.segnaposto.split(" ");
                    chiaviPerPriorita.forEach(function (item) {
                        let chiavi = item.split(" ");
                        segna.hideVal.push(chiavi);
                    });
                }
            }
            if (segna.chiave.length > 0) {
                //let chiaveValore = [];
                let chiaveValore = null;
                let label = "";
                let etichettaReturnValue = "";
                for (let i = 0; i < segna.chiave.length; i++) {
                    label = "";
                    etichettaReturnValue = "";
                    let nextIteration = false;

                    for (let y = 0; y < segna.chiave[i].length; y++) {
                        chiaveValore = singolo.recordInTracciato[segna.chiave[i][y]];
                        if (segna.requiredVal[i][y] != "") {
                            switch (segna.comparator[i][y].toLowerCase()) {
                                case "==":
                                    if (segna.requiredVal[i][y].toLowerCase() != chiaveValore.toString().toLowerCase()) {
                                        nextIteration = true;
                                    }
                                    break;

                                case "!=":
                                    if (segna.requiredVal[i][y].toLowerCase() == chiaveValore.toString().toLowerCase()) {
                                        nextIteration = true;
                                    }
                                    break;

                                case "include":
                                    if (!segna.requiredVal[i][y].toLowerCase().includes(chiaveValore.toString().toLowerCase())) {
                                        nextIteration = true;
                                    }
                                    break;

                                case "!include":
                                    if (segna.requiredVal[i][y].toLowerCase().includes(chiaveValore.toString().toLowerCase())) {
                                        nextIteration = true;
                                    }
                                    break;
                            }
                        }
                        label += segna.nome[i][y] + " ";
                        etichettaReturnValue += segna.nome[i][y] + " ";
                        label += (segna.hideVal[i][y].toLowerCase() == "true" ? "" : chiaveValore + " _ ");
                        etichettaReturnValue += (segna.hideVal[i][y].toLowerCase() == "true" ? "" : chiaveValore + " _ ");
                    }

                    if (nextIteration) {
                        continue;
                    }

                    if (etichettaReturnValue[etichettaReturnValue.length - 2] != ":") {
                        etichettaReturnValue = etichettaReturnValue.substring(0, etichettaReturnValue.length - 3);
                    }
                    else {
                        etichettaReturnValue = etichettaReturnValue.substring(0, etichettaReturnValue.length - 2);
                    }
                    if (label[label.length - 2] != ":") {
                        label = label.substring(0, label.length - 3);
                    }
                    else {
                        label = label.substring(0, label.length - 2);
                    }
                    if (ultimaEtichetta != etichettaReturnValue) {
                        segnaposto.find("#labelSegna").text(label);
                        $("#container_tracciato").append(segnaposto);
                    }
                    return etichettaReturnValue;
                }
                if (ultimaEtichetta != "No valid value") {
                    segnaposto.find("#labelSegna").text("No valid value");
                    $("#container_tracciato").append(segnaposto);
                }
                return "No valid value";
            }
        }
        catch {
            console.error("Errore nell'inserimento del segnalibro");
        }
    }

    ContaRefPerSegnaposti() {
        let me = this;
        $("#container_tracciato .segnaposto").each(function () {
            let countSibling = me.contaSiblingSottoSegnaposto(this);
            $(this).find("#valueSegna").text(countSibling);
            if (countSibling == 0) {
                $(this).css("display", "none");
            }
            else {
                $(this).css("display", "block");
            }
            if (me.agenzia.customSegnaposti != null) {
                me.agenzia.customSegnaposti(this);
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

    aggiungiRecordAdOrdinamento(idRec) {
        let element = this.tracciatoSource.find(f => f.idRec == parseInt(idRec));
        ordInstance.addRecordToOrdinamento(element);

        $("#container_tracciato").empty();
        $("#filterAgenzia").empty();
        this.bindTracciato();
        $("#modalAggiungiAdOrdinamento").modal("hide");
    }

    aggiungiAdOrdinamentoModal(record) {

        let obj = {
            area: "",
            settore: "",
            reparto: ""
        }

        let element = this.tracciatoSource.find(f => f.idRec == parseInt(record.attr("id_rec")));
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceOrdinamentoLista.json?v=' + rndVersion, function (data) {
            let keyArea = data.bindings.area.campoMeta;
            let keySettore = data.bindings.settore.campoMeta;
            let keyReparto = data.bindings.reparto.campoMeta;

            if (element.recordInTracciato[keyArea] != null) {
                obj.area = element.recordInTracciato[keyArea];
            }

            if (element.recordInTracciato[keySettore] != null) {
                obj.settore = element.recordInTracciato[keySettore];
            }

            if (element.recordInTracciato[keyReparto] != null) {
                obj.reparto = element.recordInTracciato[keyReparto];
            }

            $("#modalAggiungiAdOrdinamento").modal("show");
            $("#modalAggiungiAdOrdinamento").find("#areaVal").val(obj.area);
            $("#modalAggiungiAdOrdinamento").find("#areaVal").attr("areaVal", obj.area);

            $("#modalAggiungiAdOrdinamento").find("#settoreVal").val(obj.settore);
            $("#modalAggiungiAdOrdinamento").find("#settoreVal").attr("settoreVal", obj.settore);

            $("#modalAggiungiAdOrdinamento").find("#repartoVal").val(obj.reparto);
            $("#modalAggiungiAdOrdinamento").find("#repartoVal").attr("repartoVal", obj.reparto);

            $("#modalAggiungiAdOrdinamento").attr("idRec", element.idRec);
        });
    }

    aggiungiEtichettaATracciato(groupElements, codice) {
        let me = this;
        let element;
        if (codice.includes(",")) {
            return;
        }

        let obj = groupElements.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == codice);
        element = $(".record_menabo[id_rec='" + obj.idRec + "']");

        if (obj.etichetteVisual != null && obj.etichetteVisual.length > 0) {
            obj.etichetteVisual.forEach(function (item) {
                let elementToAdd = '<div class="row" id="label">' +
                    '<div class="col d-flex justify-content-end mb-2">' +
                    '<span class="bg-danger badge badge-danger">' + item + '</span>' +
                    '</div>' +
                    '</div>';
                element.find(".labelEAvvisi").append(elementToAdd);
                element.find(".warningImg").parent().removeClass("mb-5");
                element.find(".warningImg").parent().addClass("mb-3");
            });
        }
    }

    scaricaPacchettoFoto() {
        let me = this;
        $("#ScaricaPacchettoFotoButton").html("Scarica Pacchetto Foto <i class='fa fa-spinner fa-spin'></i>");
        me.showAlert("success", "Download pacchetto foto in corso, l'operazione potrebbe richiedere qualche minuto <i class='fa fa-spinner fa-spin'></i>", 0);
        Call.do("Menabo", "donwloadPacchettoFoto/" + this.idTracciato, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $("#ScaricaPacchettoFotoButton").html("Scarica Pacchetto Foto <i class='fa fa-check'></i>");
                me.showAlert("success", "Download terminato, disponibile per 1 ora: <a href=\"/" + getWebAppRootFolder() + result.zipName +"\">" + "/" + getWebAppRootFolder() + result.zipName +"</a>", 0);
            }
            else {
                $("#ScaricaPacchettoFotoButton").html("Scarica Pacchetto Foto <i class='fa fa-times'></i>");
                me.showAlert("danger", "Download fallito: " + result.error, 0);
            }
        });
    }
}

class MenaboGeometra {

    CalcolaSpazi(FormatoPag, IndiceRef, FormatoRef, sendError = true, cambioMeccanica = false) {
        let returnObject = {
            listIndexRequired: [],
            result: true
        };

        //if (FormatoRef == null)
        //    FormatoRef = "1x1";

        let righexColonne = ["1","1"];
        if (FormatoRef != null) {
            righexColonne = FormatoRef.split("x");
        }
        let paginaRighexColonne = FormatoPag.split("x");

        //console.log("Pagina " + paginaRighexColonne[0] + "x" + paginaRighexColonne[1]);
        //console.log("Ref " + righexColonne[0] + "x" + righexColonne[0]);
        //console.log("Indice " + IndiceRef);
        let ColonnaRefStart = Math.trunc((IndiceRef - 1) / paginaRighexColonne[0]);

        //controllo se la grandezza selezionata può stare nella pagina
        if (parseInt(paginaRighexColonne[0]) < parseInt(righexColonne[0]) + ((IndiceRef - 1) % parseInt(paginaRighexColonne[0])) || parseInt(paginaRighexColonne[1]) < parseInt(righexColonne[1]) + ColonnaRefStart) {
            if (sendError && cambioMeccanica) { mostraMessaggio("Impossibile cambiare meccanica, pagina troppo piccola", "warning"); }
            if (sendError && !cambioMeccanica) { mostraMessaggio("Impossibile spostare l'elemento, pagina troppo piccola", "warning"); }
            console.log("pagina troppo piccola per la grandezza selezionata partendo da indice " + IndiceRef);
            returnObject.result = false;
            return (returnObject);
        }

        for (let i = 0; i < parseInt(righexColonne[1]); i++) {
            for (let i2 = 0; i2 < parseInt(righexColonne[0]); i2++) {
                let result = IndiceRef + i2 + (i * parseInt(paginaRighexColonne[0]));
                returnObject.listIndexRequired.push(result);
            }
        }
        return (returnObject);
    }
}