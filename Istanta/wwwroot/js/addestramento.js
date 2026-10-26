class Addestramento {

    _original_excel_fields = "";
    addestramenti = [];
    regoleScaricate = [];
    formatiPagine = [];
    meccanicheSource = [];
    constructor() {

        this.bindAddestramenti(null);
        //this.bindAddestramenti(null, $("#cmbAddestramentiRegole"));
        //this.bindAddestramenti(null, $("#cmbAddestramentiRegoleCreate"));
    }

    getFormati(extraText) {
        if (extraText == null) {
            extraText = "";
        }
        $(".cmbCambioFormato").empty()
        $(".cmbCambioFormato").append("<option value=\"" + 0 + "\">Nessuna modifica</option>");
        let me = this;
        Call.do("Tracciati", "getAllFormatiPaginaMenabo", "GET", null, null, function (result) {
            me.formatiPagine = result;
            result.forEach(function (item) {
                $(".cmbCambioFormato").append("<option value=\"" + item + "\">"+extraText+"" + item + "</option>");
            });
        });
    }

    getMeccaniche() {
        $(".cmbMeccanica").empty()
        let me = this;
        Call.do("Tracciati", "getAllMeccaniche", "GET", null, null, function (result) {
            me.meccanicheSource = result;
            result.forEach(function (item) {
                $(".cmbMeccanica").append("<option formato='" + item.formato + "' value=\"" + item.nomeTraduzione + "\">" + item.nomeTraduzione + "</option>");
            });
        });
    }

    bindAddestramenti(cb) {


        $(".tendinaAddestramenti").empty();
        
        let me = this;
        Call.do("Tracciati", "getAddestramenti", "GET", null, null, function (result) {
            console.log(result.length);
            me.addestramenti = [];
            result.forEach(function (item) {

                let objAddestramento = {
                    nomeAddestramento:item.titolo,
                    idAddestramento:item.id,
                    schemaCampiExcels: item.schemaCampiExcels
                }
                me.addestramenti.push(objAddestramento);
            })

            
            $(".tendinaAddestramenti").append("<option value=\"-1\">Seleziona schema</option>");
            

            for (let $va = 0; $va < result.length; $va++) {
                console.log("-->" + $va);
                let item = result[$va];
                console.log(item);
                $(".tendinaAddestramenti").append("<option value=\"" + item.id + "\">" + item.titolo + "</option>");
  
            }

            if (cb != null)
                cb();

        });
    }

    async importa() {

        $("#formcontainer").find("input").each(function () {
            $(this).attr("disabled", true);
        });

        $("#formcontainer").find("select").each(function () {
            $(this).attr("disabled", true);
        });

        $("#row_progress").css("display", "block");


        var files = document.querySelector('[name=FileTracciato]').files;

        var obj = {};
        if (files.length > 0) {

            const base64 = await convertBase64(files[0]);
            obj.file = base64;
            //console.log(files[0]);
            obj.filename = files[0].name;


        }
        else {
            alert("Selezionare un file");
            return;
        }

        obj.titolo = $("#txtTitolo").val();

        showLoading();

        Call.do("Tracciati", "CaricaAddestramento", "PUT", obj, this, function (result, sender) {

            console.log(result);

            sender.bindAddestramenti(function () {

                $("#cmbAddestramenti").val(result.id);
                sender.selezionaAddestramento();

            });
            
            



        });

    }    

    selezionaAddestramento() {

        $("#external_options").html("");
        $("#addNewFieldContainer").html("");

        if ($("#cmbAddestramenti").val() === "-1") {
            return;
        }

        let template = $("#template").clone();

        this._original_excel_fields = "";
        let me = this;
        Call.do("Tracciati", "getAddestramentoById/" + $("#cmbAddestramenti").val(), "GET", null, this, function (result, senderOwn) {


            $("#lista").html("");

            let campi = result.schemaCampiExcels;

            console.log(result);

            if (campi.length > 0) {

                let template_ops = $("#template_exOption").clone();
                let htmlOptions = $(template_ops.html());
                $("#external_options").append(htmlOptions);
            }

            campi = campi.sort(function (a, b) {
                return (a.indice < b.indice) ? -1 :((a.indice > b.indice) ?1: 0);
            });

            for (let $va = 0; $va < campi.length; $va++) {

                let item = campi[$va];

                let htmlItem = $(template.html());

                htmlItem.find("#nome_colonna_excel").text(item.nomeColonnaOriginale + (item.addestramentoExcelRelazionis.length > 0 ? (" -> " + item.addestramentoExcelRelazionis[0].algoritmo) : ""));
                htmlItem.find("#nome_colonna").val(item.nomeColonna);
                htmlItem.find("#tipo_valore").val(item.tipoDato);
                htmlItem.find("#tipo_ordinamento").val(item.ordinamento);
                htmlItem.find("#ruolo").val(item.ruolo);

                htmlItem.attr("id_campo", item.id);

                //htmlItem.find(".row.schema_campo").attr("id", item.id);

                htmlItem.find("input[type=button]").on("click", function () {


                    $(this).css("display", "none");
                    $(this).parent().append("<button class=\"btn btn-primary\" type=\"button\" disabled><span class=\"spinner-border spinner-border-sm\" role=\"status\" aria-hidden=\"true\"></span>Loading...</button>");

                    if ($(this).val() === "Salva") {

                        let row = $(this).closest(".schema_campo");
                        let _id = row.attr("id_campo");
                        let _tit = row.find("#nome_colonna").val();
                        let _tyval = row.find("#tipo_valore").val();
                        let _tyord = row.find("#tipo_ordinamento").val();
                        let _ruolo = row.find("#ruolo").val();

                        console.log([_id, _tit, _tyval, _tyord, _ruolo]);
                        me.salvaSchemaCampo({ Id: _id, NomeColonna: _tit, Ordinamento: _tyord, TipoDato: _tyval, Ruolo: _ruolo });
                    }
                    else {
                        if (confirm("Sicuro di voler eliminare?")) {
                            let _id = $(this).closest(".schema_campo").attr("id_campo");
                            me.eliminaCampoCustom(_id);
                        }
                    }
                });

                htmlItem.find("#ruolo").on("change", function()
                {
                    me.cambioRuolo($(this));
                });

                //htmlItem.find("#ruolo").text(item.ruolo);

                $("#lista").append(htmlItem);

                if (item.schemaCampiExcelRelazionis.length <= 0) {
                    //Campo secco letto da lista
                    const _res = ["", null].every(value => { return value !== item.nomeColonna; });
                    const _nome = (_res ? item.nomeColonna : "");
                    if (_nome !== "") {
                        senderOwn._original_excel_fields += "<option value=\"" + _nome + "\">" + _nome + "</option>";
                    }
                }
                if (item.indice === -1) {
                    htmlItem.find("input[type=button]").css("display", "inline");
                }

            }

            if (result.externalCallPerImport !== null && result.externalCallPerImport !== "") {
                $("#cmbImportToExternal").val(result.externalCallPerImport.substring(0, result.externalCallPerImport.indexOf("(")));
                senderOwn.selezionatoLibItem($("#cmbImportToExternal"), function () {
                    let lfp = $("#cmbImportToExternal").parent();
                    console.log(lfp);
                    //Setto i parametri
                    let _pstring = result.externalCallPerImport.split("(")[1].replace(")", "");
                    let _plist = _pstring.split(",");

                    for (let _$p = 0; _$p < _plist.length; _$p++) {
                        let val = _plist[_$p];
                        if (val !== "") {
                            console.log("p_" + _$p);
                            lfp.find("#p_" + _$p).val(val);
                        }
                    }


                });

            }

            if (result.externalCallPerExport !== null && result.externalCallPerExport !== "") {
                $("#cmbExportToExternal").val(result.externalCallPerExport.substring(0, result.externalCallPerExport.indexOf("(")));
                senderOwn.selezionatoLibItem($("#cmbExportToExternal"), function () {
                    let lfp = $("#cmbExportToExternal").parent();

                    //Setto i parametri
                    let _pstring = result.externalCallPerExport.split("(")[1].replace(")", "");
                    let _plist = _pstring.split(",");

                    for (let _$p = 0; _$p < _plist.length; _$p++) {
                        let val = _plist[_$p];
                        if (val !== "") {
                            lfp.find("#p_" + _$p).val(val);
                        }
                    }

                });
                //Setto i parametri
            }

            if (result.externalCallPerExportPoP !== null && result.externalCallPerExportPoP !== "") {
                $("#cmbExportPoPToExternal").val(result.externalCallPerExportPoP.substring(0, result.externalCallPerExportPoP.indexOf("(")));
                senderOwn.selezionatoLibItem($("#cmbExportPoPToExternal"), function () {
                    let lfp = $("#cmbExportPoPToExternal").parent();

                    //Setto i parametri
                    let _pstring = result.externalCallPerExportPoP.split("(")[1].replace(")", "");
                    let _plist = _pstring.split(",");

                    for (let _$p = 0; _$p < _plist.length; _$p++) {
                        let val = _plist[_$p];
                        if (val !== "") {
                            lfp.find("#p_" + _$p).val(val);
                        }
                    }

                });
                //Setto i parametri
            }

            $("#chEsportaSubito").prop('checked', result.esportaSubito);

            $("#lista").append("<hr><div class=\"row mb-4\"><div class=\"col-auto\">Aggiungi campo</div></div>");

            $("#addNewFieldContainer").html("");
            let templateNew = $("#templateNew").clone();
            let htmlItem_new = $(templateNew.html());
            htmlItem_new.attr("id_campo", "-1");
            $("#lista").append(htmlItem_new);

            hideLoading();
        });
    }


    cambioRuolo(sender) {
        let val = sender.find("option:selected").text();
        let txt = sender.closest(".row.schema_campo").find("#nome_colonna");
        let txt_nome_colonna = txt.val();
        let _f = txt_nome_colonna.split(".");
        if (_f.length > 1) {
            txt_nome_colonna = val + "." + _f[1];
        }
        else {
            txt_nome_colonna = val + "." + txt_nome_colonna;
        }

        txt.val(txt_nome_colonna);
    }

    salvaSchemaCampo(obj) {
        Call.do("Tracciati", "salvaSchemaCampo", "PUT", obj, this, function (result, sender) {
            console.log(result);
            sender.selezionaAddestramento();
        });
    }

    selezionatoLibItem(sender, callback) {
        let libId = sender.val();
        if (sender.parent().attr("id") === "cmb_lib_custom") {
            if (libId === "0") {
                sender.parent().find("#edit_params").html("");
                $("#cmbWhenAction").css("display", "none");
                return;
            }
            else {
                $("#cmbWhenAction").css("display", "inline");
            }
        }
        else if (libId === "reset") {
            //Azzero funzione
            this.schemaFuncParametroChanged(sender);
            return;
        }

        Call.do("Tracciati", "getLibItemInfo/" + libId, "GET", null, this, function (result, senderOwn) {
            //console.log(result.parameters);

            if (sender.parent().attr("id") !== "cmb_lib_custom") {
                sender.parent().find("#local_func_params").remove();

                let _p = "<div class=\"mt-2\" id=\"local_func_params\">";
                for (let p in result.parameters) {
                    let pObj = result.parameters[p];


                    _p += "<select class=\"form-select-sm ms-2\" aria-label=\"Default select example\" id=\"p_" + p + "\" onchange=\"trainer.schemaFuncParametroChanged($(this))\"><option value=\"-1\">Seleziona parametro</option><option>[" + pObj + "]</option>" + senderOwn._original_excel_fields + "</select>";
                }
                _p += "</div>";
                sender.parent().append(_p);

            }
            else {
                $("#cmb_parameters_custom").html("");

                for (let p in result.parameters) {
                    let pObj = result.parameters[p];
                    $("#cmb_parameters_custom").append("<select class=\"form-select-sm ms-2\" aria-label=\"Default select example\" id=\"p_" + p + "\"><option value=\"-1\">Seleziona parametro</option><option>[" + pObj + "]</option>" + senderOwn._original_excel_fields + "</select>");
                }
            }

            if (callback != null) {
                callback();
            }

        });
    }

    aggiungiCampoCustom() {
        let nome = $("#addNewFieldContainer").find("#nome_colonna").val();
        let tipo = $("#addNewFieldContainer").find("#tipo_valore").val();
        let ord = $("#addNewFieldContainer").find("#tipo_ordinamento").val();
        let ruolo = $("#addNewFieldContainer").find("#ruolo").val();
        let func = $("#addNewFieldContainer").find("#cmbCallToExternal").val();



        console.log([nome, tipo, ord, ruolo, func]);
        let algo = func + "(";
        $("#cmb_parameters_custom").find("select").each(function () {
            console.log($(this).attr("id") + "=" + $(this).val());
            algo += $(this).val() + ",";
        });

        algo += ")";


        this.salvaSchemaCampo({ Id: -1, IdAddestramento: $("#cmbAddestramenti").val(), NomeColonna: nome, Ordinamento: ord, TipoDato: tipo, Ruolo: ruolo, AddestramentoExcelRelazionis: [{ IdCampo: -1, NomeRelazione: "", TipoCompilazione: $("#cmbWhenAction").val(), algoritmo: algo }] });
    }

    eliminaCampoCustom(id) {
        console.log("Id campo " + id);
        Call.do("Tracciati", "eliminaSchemaCampo/" + id, "GET", null, this, function (result, sender) {
            sender.selezionaAddestramento();
        });
    }

    schemaFuncParametroChanged(sender) {
        //Chesk reset
        let mustReset = false;
        if (sender.val() == "reset") {
            mustReset = true;
        }

        let _opt = sender.closest(".exOptions");
        let _optId = _opt.attr("id");

        let _p_str = "";
        let paramNull = false;

        let _p = _opt.find("#local_func_params").find("select").each(function () {
            paramNull = $(this).val() === "-1";
            _p_str += $(this).val() + ",";
        });

        if (paramNull && !mustReset)
            return;

        let obj = { Id: $("#cmbAddestramenti").val(), esportaSubito: $("chEsportaSubito").is(':checked') };

        if (!mustReset) {
            if (_optId === "imp") {
                let _f = _opt.find("#cmbImportToExternal").val();
                obj.externalCallPerImport = _f + "(" + _p_str + ")";

                //console.log("Per import -> " + _f + "(" + _p_str + ")");
            }
            else if (_optId === "exp") {
                let _f = _opt.find("#cmbExportToExternal").val();
                obj.externalCallPerExport = _f + "(" + _p_str + ")";
                //console.log("Per export -> " + _f + "(" + _p_str + ")");
            }
            else if (_optId === "expPoP") {
                let _f = _opt.find("#cmbExportPoPToExternal").val();
                obj.externalCallPerExportPoP = _f + "(" + _p_str + ")";
            }
        }
        else {
            if (_optId === "imp") {
                obj.externalCallPerImport = "null";
            }
            else if (_optId === "exp") {
                obj.externalCallPerExport = "null";
            }
            else if(_optId === "expPoP"){
                obj.externalCallPerExportPoP = "null";
            }

            _opt.find("#local_func_params").remove();
        }



        this.salvaAddestramento(obj, mustReset);


        /*
        Demo test di come passare un oggetto complesso generico ad un controller
        var _o = {nome:"Alessio", cognome:"Mattolini", eta:38, passioni:["Tennis","Teatro","Musica"]};
        Call.do("", "salvaSchemaTest", "PUT", {p:JSON.stringify(_o)} , null, function (result) {
            //console.log();
        });
        */

    }

    checkOpzioneEsportazioneChanged(sender)
    {
        let obj = { Id: $("#cmbAddestramenti").val(), esportaSubito: sender.is(':checked') };
        //console.log(obj);
        this.salvaAddestramento(obj, false);
    }

    salvaAddestramento(obj, mustReset) {
        Call.do("Tracciati", "salvaSchema", "PUT", obj, this, function (result, sender) {
            console.log(result);
            if (!mustReset)
                sender.selezionaAddestramento();
        });
    }

    setScheda(schedaNumber, testata) {
        let testate = $(".testataAddestramentoLista");
        testate.each(function () {
            $(this).removeClass("active");
        });
        testata.addClass("active");
        let allSchede = $(".schedaAddestramentoLista");
        allSchede.each(function () {
            $(this).removeClass("active");
        });
        if (schedaNumber == 1) {
            $("#AddestramentoListaScheda").addClass("active");
        }
        else if (schedaNumber == 2) {
            $("#ImpostaRegoleScheda").addClass("active");
        }
    }

    mostraDivOr(bottone) {
        const orDiv = bottone.parent().find("#orDiv");
        const addButton = bottone.parent().find("#aggiungiNuovoSetRegoleButton");
        addButton.style.display = "none";
        orDiv.style.display = "block";
    }

    appendPrimoSetRegole(selezioneAddestramento) {
        if (selezioneAddestramento.val() == -1) {
            $("#RegoleStabiliteModal").empty();
            $("#creaNuovoSetRegole").prop("disabled", true);
        }
        else {
            $("#creaNuovoSetRegole").prop("disabled", false);
            let recHtmlSetRegole = $($("#setRegoleTemplate").clone().html());
            $("#RegoleStabiliteModal").empty();
            $("#RegoleStabiliteModal").append(recHtmlSetRegole);
        }
    }

    nuovaRegolaButton(bottone) {
        let modal = bottone.closest(".modal-content");
        let idAddestramento = modal.find("#cmbAddestramentiRegole").val();
        if (idAddestramento == null) {
            idAddestramento = $("#addestramentoModifica").attr("idAddestramento");
        }
        this.nuovaRegola(bottone.parent().find("#setRegole"), idAddestramento);
    }

    nuovaRegola(setRegoleToAppend, idAddestramento) {
        let recHtmlRegola = $($("#regolaTemplate").clone().html());
        setRegoleToAppend.append(recHtmlRegola);
        let regola = recHtmlRegola;
        this.addestramenti.forEach(function (item) {
            if (item.idAddestramento == idAddestramento) {
                item.schemaCampiExcels.forEach(function (schemaCampo) {
                    regola.find("#campoAddestramentoRegola").append("<option valoreCampo=\"" + schemaCampo.nomeColonna + "\" value=\"" + schemaCampo.id + "\">" + schemaCampo.nomeColonnaOriginale.replace("_", " ") + "</option>");
                });
            }
        });
        return regola;
    }

    rimuoviSetRegoleButton(bottone) {
        bottone.closest("#setRegoleParent").remove();
    }

    rimuoviRegola(bottone) {
        bottone.closest("#regola").remove();
    }

    creaNuovoSetRegole(RegoleStabiliteModal) {
        let recHtmlSetRegole = $($("#setRegoleTemplate").clone().html());
        RegoleStabiliteModal.append(recHtmlSetRegole);
        return recHtmlSetRegole;
    }

    salvaSetRegole(idRegola, idAddestramento, modal) {
        console.log(modal);
        if (idAddestramento == 0) {
            alert("Non hai specificato nessun addestramento");
            return;
        }
        if (parseInt(modal.find("#PaginaInCuiInserireInizio").val()) <= 0) {
            alert("La pagina di inizio non è valida");
            return;
        }
        if (parseInt(modal.find("#PaginaInCuiInserireFine").val()) <= 0) {
            alert("La pagina di fine non è valida");
            return;
        }
        if (modal.find("#IndicePreciso").is(":checked") && parseInt(modal.find("#PaginaInCuiInserireInizio").val()) != parseInt(modal.find("#PaginaInCuiInserireFine").val())) {
            alert("Non puoi richiedere un indice preciso mentre specifichi un range di pagine superiore a una. Imposta una sola pagina o togli la spunta dal checkbox.");
            return;
        }
        console.log(modal.find("#ordineRegola").val());
        if (modal.find("#ordineRegola").val() == "") {
            modal.find("#ordineRegola").val(0);
        }
        if (modal.attr("id") == "aggiungiNuovaRegola" && parseInt(modal.find("#ordineRegola").val()) < 0) {
            alert("La priorità della pagina deve essere almeno 1.");
            return;
        }
        if (modal.attr("id") == "modificaRegola" && parseInt(modal.find("#ordineRegola").val()) <= 0) {
            alert("La priorità della pagina deve essere almeno 1.");
            return;
        }
        if (parseInt(modal.find("#IndiceACuiInserire").val()) == 0 && modal.find("#IndicePreciso").is(":checked")) {
            alert("Non puoi richiedere indici precisi se non specifichi l'indice");
            return;
        }
        if (modal.find("#cmbMeccanica").find("option:selected").attr("formato") != "1x1" && modal.find("#cmbCambioFormato").val() == "0") {
            alert("Non puoi specificare meccaniche con formati diversi da 1x1 senza impostare il formato pagina.");
            return;
        }
        if (modal.find("#cmbMeccanica").find("option:selected").attr("formato") != "1x1" && modal.find("#cmbCambioFormato").val() == "0") {
            alert("Non puoi specificare meccaniche con formati diversi da 1x1 senza impostare il formato pagina.");
            return;
        }
        let me = this;
        let t1 = parseInt(modal.find("#PaginaInCuiInserireFine").val());
        let t2 = parseInt(modal.find("#PaginaInCuiInserireInizio").val());
        console.log([t1,t2]);
        if (t1 < t2) {//modal.find("#PaginaInCuiInserireFine").val() < modal.find("#PaginaInCuiInserireInizio").val()) {
            console.log(modal.find("#PaginaInCuiInserireFine").val());
            alert("La pagina di fine non può essere inferiore alla pagina di inizio");
            return;
        }
        let objListaSetRegole = {
            id: idRegola,
            setRegoleList: [],
            idAddestramento: idAddestramento,
            ordine: (parseInt(modal.find("#ordineRegola").val()) <= 0 ? -1 :modal.find("#ordineRegola").val()), //-1 mi indica che deve essere inserito in priorità automatica
            paginaDa: modal.find("#PaginaInCuiInserireInizio").val(),
            paginaA: modal.find("#PaginaInCuiInserireFine").val(),
            indice: modal.find("#IndiceACuiInserire").val(),
            indicePreciso: modal.find("#IndicePreciso").is(":checked"),
            restrizioni: modal.find("#cmbRegoleSceltaPagina").val(),
            formatoPagina: modal.find("#cmbCambioFormato").val(),
            meccanica: modal.find("#cmbMeccanica").val(),
            label: modal.find("#cmbLabelSpecifica").val()
        }
        let error = ""
        modal.find(".setRegole").each(function () {
            if (error == "") {
                let objSetRegole = {
                    setDiRegole: []
                }
                $(this).find(".regola").each(function () {
                    if (error == "") {
                        if ($(this).find("#campoAddestramentoRegola").val() == 0) {
                            error = "Alcune regole non hanno il campo addestramento non specificato";
                        }
                        else if ($(this).find("#valoreRegola").val() == "") {
                            error = "Alcune regole hanno il valore rimasto vuoto";
                        }
                        else {
                            let objRegola = {
                                idCampo: $(this).find("#campoAddestramentoRegola").val(),
                                nomeCampo: $(this).find("#campoAddestramentoRegola option:selected").attr("valoreCampo"),
                                operatorId: $(this).find("#operatoreDiConfrontoRegola").val(),
                                value: $(this).find("#valoreRegola").val()
                            }
                            objSetRegole.setDiRegole.push(objRegola);
                        }
                    }
                });
                if (objSetRegole.setDiRegole.length > 0 && error == "") {
                    objListaSetRegole.setRegoleList.push(objSetRegole);
                }
            }
        });
        if (error != "") {
            alert(error);
            return;
        }
        console.log(objListaSetRegole);
        Call.do("Tracciati", "scriviRegolaMenabo/" + false, "PUT", objListaSetRegole, null, function (result) {
            if (result.error != "") {
                alert("Operazione fallita, errore: " + result.error);
            }
            else {
                modal.modal('hide');
                const appendAlert = (message, type) => {
                    const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
                    const content = $('<div></div>').text(message)
                    const closeButton = $('<button></button>').addClass('btn-close').attr({
                        'type': 'button',
                        'data-bs-dismiss': 'alert',
                        'aria-label': 'Close'
                    })
                    wrapper.append(content, closeButton)
                    $('#liveAlertPlaceholder').append(wrapper)

                    setTimeout(function () {
                        wrapper.alert('close')                        
                    }, 2500);
                }

                appendAlert('Regola aggiunta con successo', 'success');
                me.leggiRegole($("#cmbAddestramentiRegoleCreate").val());
            }
        });
    }

    rimuoviSetRegole(idRegola, idAddestramento, modal) {
        let conf = confirm("Sei sicuro di voler rimuovere questo set di regole? Non sarà possibile tornare indietro.");
        let me = this;
        if (!conf) {
            return;
        }
        let objListaSetRegole = {
            id: idRegola,
            setRegoleList: [],
            idAddestramento: idAddestramento,
        }
        Call.do("Tracciati", "scriviRegolaMenabo/" + true, "PUT", objListaSetRegole, null, function (result) {
            if (result.error != "") {
                alert("Operazione fallita, errore: " + result.error);
            }
            else {
                if (modal != null) {
                    modal.modal('hide');
                }
                const appendAlert = (message, type) => {
                    const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
                    const content = $('<div></div>').text(message)
                    const closeButton = $('<button></button>').addClass('btn-close').attr({
                        'type': 'button',
                        'data-bs-dismiss': 'alert',
                        'aria-label': 'Close'
                    })
                    wrapper.append(content, closeButton)
                    $('#liveAlertPlaceholder').append(wrapper)

                    setTimeout(function () {
                        wrapper.alert('close')
                    }, 2500);
                }

                appendAlert('Regola rimossa', 'success');
                me.leggiRegole($("#cmbAddestramentiRegoleCreate").val());
            }
        });
    }

    leggiRegole(idAddestramento) {
        $("#RegoleCreate").empty();
        let me = this;
        if (idAddestramento == -1) {
            return;
        }
        Call.do("Tracciati", "getRegoleMenaboByIdAddestramento/" + idAddestramento, "GET", null, null, function (result) {
            console.log(result);
            if (typeof result === "string") {
                const appendAlert = (message, type) => {
                    const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
                    const content = $('<div></div>').text(message)
                    const closeButton = $('<button></button>').addClass('btn-close').attr({
                        'type': 'button',
                        'data-bs-dismiss': 'alert',
                        'aria-label': 'Close'
                    })
                    wrapper.append(content, closeButton)
                    $('#liveAlertPlaceholder').append(wrapper)
                }

                appendAlert(result, 'danger');
            }
            else if (result != null && result.length > 0) {
                me.regoleScaricate = result;
                result.sort(function (a, b) {
                    return a.ordine - b.ordine;
                });
                result.forEach(function (AllSetRegole) {
                    let recHtmlRegola = $($("#previewRegolaTemplate").clone().html());
                    recHtmlRegola.find("#ordineRegolaPreview").text(AllSetRegole.ordine+")");
                    recHtmlRegola.attr("idRegola", AllSetRegole.id)
                    recHtmlRegola.attr("idAddestramento", AllSetRegole.idAddestramento)
                    $("#RegoleCreate").append(recHtmlRegola);
                    let countRegole = 0;
                    AllSetRegole.setRegoleList.forEach(function (setRegole) {
                        setRegole.setDiRegole.forEach(function (regola) {
                            countRegole++;
                        });
                    });
                    if (countRegole > 1) {
                        recHtmlRegola.find("#regoleAggiuntive").text("+ " + (countRegole-1));
                    }
                    let addestramento = me.addestramenti.find(f => f.idAddestramento == AllSetRegole.idAddestramento);
                    let nomeCampo = addestramento.schemaCampiExcels.find(f => f.id == AllSetRegole.setRegoleList[0].setDiRegole[0].idCampo).nomeColonnaOriginale;
                    //AllSetRegole.setRegoleList[0].setDiRegole[0].idCampo
                    recHtmlRegola.find("#campoAddestramentoRegolaPreview").val(nomeCampo);
                    recHtmlRegola.find("#operatoreDiConfrontoRegola").val(AllSetRegole.setRegoleList[0].setDiRegole[0].operatorId);
                    recHtmlRegola.find("#valoreRegolaPreview").val(AllSetRegole.setRegoleList[0].setDiRegole[0].value);
                });
            }
        });
    }

    apriModalModifica(idRegola, idAddestramento) {
        console.log(idRegola);
        console.log(idAddestramento);
        let addestramento = this.addestramenti.find(f => f.idAddestramento == idAddestramento);
        let listaSetRegole = this.regoleScaricate.find(f => f.id == idRegola && f.idAddestramento == idAddestramento);
        console.log(listaSetRegole);
        let modal = $("#modificaRegola");
        modal.attr("idRegola", idRegola);
        modal.attr("idAddestramento", idAddestramento);
        modal.find("#RegoleStabiliteModalModifica").empty();
        modal.modal("show");
        modal.find("#addestramentoModifica").val(addestramento.nomeAddestramento);
        modal.find("#addestramentoModifica").attr("idAddestramento", idAddestramento)
        modal.find("#ordineRegola").val(listaSetRegole.ordine);
        modal.find("#PaginaInCuiInserireInizio").val(listaSetRegole.paginaDa);
        modal.find("#PaginaInCuiInserireFine").val(listaSetRegole.paginaA);
        modal.find("#IndiceACuiInserire").val(listaSetRegole.indice);
        modal.find("#IndicePreciso").prop("checked",listaSetRegole.indicePreciso);
        this.changeTextIndice(modal.find("#IndicePreciso"));
        modal.find("#cmbRegoleSceltaPagina").val(listaSetRegole.restrizioni);
        modal.find("#cmbCambioFormato").val(listaSetRegole.formatoPagina);
        modal.find("#cmbMeccanica").val(listaSetRegole.meccanica);
        modal.find("#cmbLabelSpecifica").val(listaSetRegole.label);
        this.onChangeMeccanica(modal.find("#cmbMeccanica"));
        let me = this;
        listaSetRegole.setRegoleList.forEach(function (setRegole) {
            let setGiusto = me.creaNuovoSetRegole($("#RegoleStabiliteModalModifica"));
            setRegole.setDiRegole.forEach(function (regola) {
                let regolaInPagina = me.nuovaRegola(setGiusto.find("#setRegole"), idAddestramento);
                regolaInPagina.find("#campoAddestramentoRegola").val(regola.idCampo);
                regolaInPagina.find("#operatoreDiConfrontoRegola").val(regola.operatorId);
                regolaInPagina.find("#valoreRegola").val(regola.value);
            });
        });
    }

    changeTextIndice(checkbox) {
        let modal = checkbox.closest(".modal");
        var isChecked = modal.find("#IndicePreciso").is(":checked");
        if (isChecked){
            modal.find("#IndiceACuiInserire").prev("label").text("Indice");
        }
        else {
            modal.find("#IndiceACuiInserire").prev("label").text("Da Indice");
        }
    }

    onChangeMeccanica(meccanicaChanged) {
        console.log(meccanicaChanged.val()); // Per ottenere il valore selezionato
        console.log(meccanicaChanged.find("option:selected").attr("formato")); // Per ottenere l'attributo "formato" dell'opzione selezionata
        let formato = meccanicaChanged.find("option:selected").attr("formato");
        let modal = meccanicaChanged.closest(".modal");
        if (formato == "1x1") {
            modal.find("#cmbCambioFormato").prev("label").text("Cambio formato");
            var cmbCambioFormato = modal.find("#cmbCambioFormato");

            // Scorriamo tutte le opzioni
            cmbCambioFormato.find("option").each(function () {
                // Otteniamo il testo dell'opzione
                if ($(this).val() != 0) {
                    var optionText = $(this).text();

                    // Rimuoviamo la sottostringa "Aumenta fino a: "
                    var newText = optionText.replace("Aumenta fino a: ", "");
                    var newText = "Aumenta fino a: " + newText;
                    // Impostiamo il nuovo testo all'opzione
                    $(this).text(newText);
                }
            });
        }
        else {
            modal.find("#cmbCambioFormato").prev("label").text("Formato pagina");
            var cmbCambioFormato = modal.find("#cmbCambioFormato");

            // Scorriamo tutte le opzioni
            cmbCambioFormato.find("option").each(function () {
                // Otteniamo il testo dell'opzione
                var optionText = $(this).text();

                // Rimuoviamo la sottostringa "Aumenta fino a: "
                var newText = optionText.replace("Aumenta fino a: ", "");

                // Impostiamo il nuovo testo all'opzione
                $(this).text(newText);
            });
        }
    }

}