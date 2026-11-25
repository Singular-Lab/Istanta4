class Ordinamento {

    db = {};

    //In questi array ci mettiamo la lista in stringa di tutte le chiavi presenti in schema universale
    areaListGroup = [];
    settoreListGroup = [];
    repartoListGroup = [];
    categoriaListGroup = [];

    timeoutOperation;
    trashButton = '<svg onclick="ordinamentoCore.execDeleteRule($(this))" style="cursor:pointer;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>';

    constructor() {
        
    }


    bind() {

       
        showLoading();
        $("[data-bs-toggle=popover]").popover();

        let me = this;
        $("[data-bs-toggle=popover]").on('show.bs.popover', function () {
            console.log("popover showed!");
            console.log($(this).attr("id"));
            let idPopover = $(this).attr("id");
            
            setTimeout(function () {
                //$(".popover-body").html("<div class=\"container\"><div class=\"row\" style=\"width:40ppx; height:40px; background-color:yellow;\"><div class=\"col\">Ciao mondo</div></div>siamo qua<a href='Questo è il link'></a></button></div> bllaaaaaa</div>");
                $(".popover-body").text("Caricamento dati...");
                me.bindMasterNode(idPopover);
            }, 100);

        })

        let rndVersion = Math.floor(Math.random() * 999999);

        $.getJSON('../external_source' + exPathCustom + '/SourceOrdinamentoLista.json?v1.' + rndVersion, function (data) {
            me.db = data;
            let _listaUniversale = data.lista;
            if (_listaUniversale==null) {
                //Inavlid
                alert("Lista custom per questo cliente!");
                hideLoading();
                return;
            }
            //$("#container").empty();
            $("#schema").empty();
            for (let i = 0; i < _listaUniversale.length; i++) {
                let item = _listaUniversale[i];

                var area = item.area;
                var areaInx = item.areaIndex;
                var settore = item.settore;
                var settoreInx = item.settoreIndex;
                var reparto = item.reparto;
                var repartoInx = item.repartoIndex;
                var categoria = item.categoria;
                var categoriaInx = item.categoriaIndex;

                var recItem = $($("#record").clone().html());
                recItem.find("#area").text(area);
                recItem.find("#area").attr("index", areaInx);

                recItem.find("#settore").text(settore);
                recItem.find("#settore").attr("index", settoreInx);

                recItem.find("#reparto").text(reparto);
                recItem.find("#reparto").attr("index", repartoInx);

                recItem.find("#categoria").text(categoria);
                recItem.find("#categoria").attr("index", categoriaInx);
                recItem.find("#orderInx").attr("originalValue", item.orderIndex);
                recItem.find("#orderInx").val(item.orderIndex);

                if (!me.areaListGroup.includes(area)) {
                    me.areaListGroup.push(area);
                }

                if (!me.settoreListGroup.includes(settore)) {
                    me.settoreListGroup.push(settore);
                }

                if (!me.repartoListGroup.includes(reparto)) {
                    me.repartoListGroup.push(reparto);
                }

                if (!me.categoriaListGroup.includes(categoria)) {
                    me.categoriaListGroup.push(categoria);
                }

                $("#schema").append(recItem);

                recItem.find(".bCambioIndice").on("click", function () {
                    ordinamentoCore.execCambioIndiceOrdinamento($(this));
                });

                recItem.find(".checkOrdinamento").on("change", function () {
                    ordinamentoCore.gestisciCheckbox($(this));
                });

            }

            hideLoading();
        });
    }

    refreshBindRules() {

        let rndVersion = Math.floor(Math.random() * 999999);
        let me = this;
        $.getJSON('/external_source/SourceOrdinamentoLista.json?v1.' + rndVersion, function (data) {
            me.db.bindings = data.bindings;
            console.log("BINDINGS REFRESHED");

        });
    }

    bindMasterNode(id) {

        let entity = id.replace("toggle_", "");
        let dictNode = this.db.bindings[entity];
        let rules = dictNode.rules;
        let htmlContent = '<div><div class="container" id="combsContainer">' +
            '<div class="row">' +
            '<div class="col-5">Definizione Universale</div>' +
            '<div class="col-5">Valori in tracciato</div>' +
            '</div>' +
            '</div></div>';

        let htmlObj = $(htmlContent);

        let cmbDefinizioniSource = this[entity + "ListGroup"];
        let cmbDefinizioniStr = '<select id="cmbDefinizione" style="width:200px;" id="cmb_definizione"><option value="0">Seleziona definizione</option>'; 
        for (var i = 0; i < cmbDefinizioniSource.length; i++) {
            let _item = cmbDefinizioniSource[i];
            cmbDefinizioniStr += '<option value="' + _item + '">' + _item +'</option>';
        }
        cmbDefinizioniStr += "</select>";

        

        for (var i = 0; i < rules.length; i++)
        {
            let ruleItem = rules[i];
            let valori = ruleItem.valoridaRicercare;
            console.log(ruleItem);
            console.log(htmlObj.find("#combsContainer"));
            htmlObj.find("#combsContainer").append('<div class="row" id_comb="' + ruleItem.id + '" entity="' + entity + '">' +
                '<div class="col-5"><input type="text" id="txt_definizione" style="width:90%;" value="'+ ruleItem.definizione +'" readonly></input></div>' +
                '<div class="col-5"><input type="text" id="txt_valori" style="width:90%;" value="' + valori + '" onKeyUp="ordinamentoCore.startTimeoutToEditRule($(this))"></input></div>' +
                '<div class="col-2">' + this.trashButton +'</div>' +                
                '</div>');
        }

        htmlObj.find("#combsContainer").append('<hr id="separatoreCombs"><div class="row mt-2">' +
            '<div class="col-5">' + cmbDefinizioniStr +'</div>' +
            '<div class="col-5"><input type="text" id="txt_valori_add" style="width:90%;"></input></div>' +
            '<div class="col-2"><input type="button" bindingName="' + entity +'" class="btn-primary" value="Add" onclick="ordinamentoCore.execAddRule($(this))"></input></div>' +
            '</div>');

        $(".popover-body").css("width", "650px");
        //console.log($(".popover-body").parent());
        $(".popover-body").parent().css("max-width", "650px");
        $(".popover-body").html(htmlObj.html());

    }


    execAddRule(sender)
    {
        let _root = $("#combsContainer");

        var obj = {
            bindingName:sender.attr("bindingName"),
            definizione: _root.find("#cmbDefinizione").val(),
            valoriDaCercare: _root.find("#txt_valori_add").val()
        };
        Call.do("MenaboSettings", "addRuleToClassificatoreUniversale", "PUT", obj, this, function (result, senderCall) {

            console.log(result);
            if (result.esito != "") {
                $('<div class="row" id_comb="' + result.esito + '" entity="' + obj.bindingName + '">' +
                    '<div class="col-5"><input type="text" id="txt_definizione" style="width:90%;" value="' + obj.definizione + '" readonly></input></div>' +
                    '<div class="col-5"><input type="text" id="txt_valori" style="width:90%;" value="' + obj.valoriDaCercare + '"></input></div>' +
                    '<div class="col-2">' + senderCall.trashButton + '</div>' +
                    '</div>').insertBefore(_root.find("#separatoreCombs"));

                senderCall.refreshBindRules();

            }
            else {
                alert("ERROR: " + result.error);
            }

        });
    }

    startTimeoutToEditRule(sender) {
        if (this.timeoutOperation != null)
            clearTimeout(this.timeoutOperation);

        let me = this;

        sender.css("background-color", "#ebb1b1");

        this.timeoutOperation = setTimeout(function () {
            me.execEditRule(sender);
        }, 100);

    }

    execEditRule(sender) {
        let _root = sender.closest(".row");

        var obj = {
            bindingName: _root.attr("entity"),
            id: _root.attr("id_comb"),
            valoriDaCercare: _root.find("#txt_valori").val()
        };
        Call.do("MenaboSettings", "editRuleOfClassificatoreUniversale", "PUT", obj, this, function (result, senderCall) {

            console.log(result);
            if (result.esito) {

                sender.css("background-color", "#b1ebb5");
                senderCall.refreshBindRules();
            }
            else {
                //alert("ERROR: " + result.error);
                console.log(result.error)
            }

        });
    }

    execDeleteRule(sender) {

        if (confirm("Sicuro di voler procedere con l'eliminazione?")) {
            let _root = sender.closest(".row");

            var obj = {
                bindingName: _root.attr("entity"),
                id: _root.attr("id_comb")
            };
            Call.do("MenaboSettings", "deleteRuleOfClassificatoreUniversale", "PUT", obj, this, function (result, senderCall) {

                console.log(result);
                if (result.esito) {
                    _root.remove();
                    senderCall.refreshBindRules();
                }
                else {
                    alert("ERROR: " + result.error);
                }

            });
        }
    }

    bindingOrdinamentoAutomatico() {
        showLoading();
        Call.do("MenaboSettings", "creaOrdinamentoAutomatico", "GET", null, this, function (result, sender) {
            if (result == null || !result.esito) {
                alert("Operazione fallita: " + result.error);
            }
            else {
                sender.bind();
            }
            hideLoading();
        });
    }

    gestisciCheckbox(sender) {
        if (sender.prop("checked") == true) {


            var posizioneVerticaleOrigine = sender.offset().top;

            $(".checkOrdinamento:not(:checked)").css("visibility", "hidden"); // Nasconde tutti gli elementi non checkati
            let nextRecord = sender.closest(".container").next().find(".record");
            nextRecord.find("#checkOrdinamento").css("visibility", "visible");

            $(".divisorio").css("display", "flex");
            $(".checkOrdinamento:checked").each(function () {
                $(this).closest(".container").prev().find(".divisorio").css("display", "none");
                $(this).closest(".container").find(".divisorio").css("display", "none");
            });

            // Calcola la posizione verticale dell'elemento checkbox selezionato rispetto al documento
            var posizioneVerticale = sender.offset().top;

            // Calcola la metà dell'altezza della finestra
            var metaAltezzaFinestra = $(window).height() / 2;

            // Calcola la posizione di scorrimento verticale per centrare l'elemento
            var posizioneScorrimentoVerticale = posizioneVerticale - metaAltezzaFinestra;

            // Effettua lo scrolling fino alla posizione calcolata senza animazione
            //console.log([posizioneVerticaleOrigine, posizioneVerticale,posizioneScorrimentoVerticale]);
            $(window).scrollTop(posizioneScorrimentoVerticale);
        }
        else {
            let nextRow = sender.closest(".container").nextAll(); // Seleziona tutte le righe successive
            nextRow.find("#checkOrdinamento").css("visibility", "hidden"); // Nasconde tutti i checkbox successivi
            nextRow.find("#checkOrdinamento").prop("checked", false); // Imposta lo stato di selezione di tutti i checkbox successivi a false

            $(".divisorio").css("display", "flex");
            $(".checkOrdinamento:checked").each(function () {
                $(this).closest(".container").prev().find(".divisorio").css("display", "none");
                $(this).closest(".container").find(".divisorio").css("display", "none");
            });

            if ($(".checkOrdinamento:checked").length == 0) {
                $(".checkOrdinamento").css("visibility", "visible");

                $(".divisorio").css("display", "none");
            }

            var posizioneVerticale = sender.offset().top;

            // Calcola la metà dell'altezza della finestra
            var metaAltezzaFinestra = $(window).height() / 2;

            // Calcola la posizione di scorrimento verticale per centrare l'elemento
            var posizioneScorrimentoVerticale = posizioneVerticale - metaAltezzaFinestra;

            // Effettua lo scrolling fino alla posizione calcolata senza animazione
            $(window).scrollTop(posizioneScorrimentoVerticale);
        }
    }

    execCambioIndiceOrdinamento(sender) {
        //console.log("-----Eseguo chiamata------");
        let objList = {
            lista: [],
            idProg:1
        }
        let containerList = [];

        let _row = sender.closest(".container").next();
        let i = parseInt(_row.find(".ordinamentoVal").attr("originalvalue"));
        if (isNaN(i)) {
            i = 1;
            $(".record").each(function () {
                i++;
            })
        }
        $(".checkOrdinamento:checked").each(function () {
            // Il codice che desideri eseguire per ciascun elemento $(".checkOrdinamento") checkato
            let checkboxSpostati = {
                areaIndex: $(this).closest(".row").find("#area").attr("index"),
                settoreIndex: $(this).closest(".row").find("#settore").attr("index"),
                repartoIndex: $(this).closest(".row").find("#reparto").attr("index"),
                categoriaIndex: $(this).closest(".row").find("#categoria").attr("index"),
                orderIndex: i
            };
            containerList.push($(this).closest(".container"));
            objList.lista.push(checkboxSpostati);
            i++;
        });
        console.log(objList);

        $(".checkOrdinamento").css("visibility", "hidden");
        $(".checkOrdinamento").prop("checked", false);

        Call.do("MenaboSettings", "multiEditOrdinamentoUniversale", "PUT", objList, null, function (result) {

            let prevElement = sender.closest(".container");
            console.log(result);
            if (result.esito) {
                containerList.forEach(function (item) {
                    item.insertAfter(prevElement);
                    prevElement = item;
                })

                $(".divisorio").css("display", "none");
                $(".checkOrdinamento").prop("checked", false);
                $(".checkOrdinamento").css("visibility", "visible");

                i = 1;
                $(".ordinamentoVal").each(function () {
                    $(this).attr("originalvalue", i);
                    i++;
                });
            }

        });
    }


    addRecordToOrdinamento(record) {
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceOrdinamentoLista.json?v=' + rndVersion, function (data) {
            let obj = {
                area : "",
                settore : "",
                reparto : ""
            }

            let keyArea = data.bindings.area.campoMeta;
            let keySettore = data.bindings.settore.campoMeta;
            let keyReparto = data.bindings.reparto.campoMeta;

            if (record.recordInTracciato[keyArea] != null) {
                obj.area = record.recordInTracciato[keyArea];
            }

            if (record.recordInTracciato[keySettore] != null) {
                obj.settore = record.recordInTracciato[keySettore];
            }

            if (record.recordInTracciato[keyReparto] != null) {
                obj.reparto = record.recordInTracciato[keyReparto];
            }

            if (obj.area != "" && obj.settore != "" && obj.reparto != "") {

                Call.do("MenaboSettings", "addOrdinamento", "PUT", obj, null, function (result) {

                });
            }
        });

    }
}


//I20-1269: la sezione Excel della pagina Ordinamento. Si carica un Excel, si sceglie l'addestramento
//lista che ne descrive le colonne e si associa ogni campo del primo elemento dello schema a una
//colonna o a un valore automatico (%PROG% 1, 2, 3..., %NOW% data e ora). Proposta e generazione le fa
//Istanta (MenaboSettings/proponiOrdinamentoDaExcel e generaOrdinamentoDaExcel, Utility/OrdinamentoDaExcel):
//il risultato va nella sezione Source e si salva solo con il suo Salva.
class OrdinamentoExcel {

    static PROGRESSIVO = "%PROG%";
    static ADESSO = "%NOW%";
    //I20-1269: valore della voce "Formula" nella tendina; nella mappatura c'e' la formula stessa, che comincia con "="
    static FORMULA = "__formula__";

    constructor() {
        this.source = null;
        this.proposta = null;
        this.aperta = false;
    }

    //Si genera solo quando ogni campo ha la sua associazione.
    static campiCompleti(proposta) {
        return proposta != null && Array.isArray(proposta.campi) && proposta.campi.length > 0
            && proposta.campi.every(c => OrdinamentoExcel.valoreCompleto((proposta.mappatura || {})[c]));
    }

    static eFormula(valore) {
        return typeof valore === "string" && valore.trim().startsWith("=");
    }

    //Una formula conta solo se c'e' qualcosa dopo l'"=".
    static valoreCompleto(valore) {
        if (!valore) {
            return false;
        }
        return !OrdinamentoExcel.eFormula(valore) || valore.trim().length > 1;
    }

    static esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    apri() {
        if (this.aperta) {
            return;
        }
        this.aperta = true;
        let me = this;

        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('/' + getWebAppRootFolder() + 'external_source' + exPathCustom + '/SourceOrdinamentoLista.json?v1.' + rndVersion, function (data) {
            me.source = data;
            me.proponi();
        });
        Call.do("Tracciati", "getAddestramenti", "GET", null, this, function (result, sender) {
            sender.disegnaAddestramenti(result);
        });

        $("#cmbAddestramentoOrdinamento").on("change", function () { me.proponi(); });
        $("#fileOrdinamentoExcel").on("change", function () { me.aggiornaGenera(); });
        $("#btnGeneraOrdinamento").on("click", function () { me.genera(); });
    }

    disegnaAddestramenti(lista) {
        let html = '<option value="">Scegli l\'addestramento lista</option>';
        (Array.isArray(lista) ? lista : []).forEach(a => {
            html += '<option value="' + a.id + '">' + OrdinamentoExcel.esc(a.titolo || a.fileAddestramento || ("Addestramento " + a.id)) + '</option>';
        });
        $("#cmbAddestramentoOrdinamento").html(html);
    }

    messaggio(testo, tipo = "warning") {
        $("#esitoOrdinamentoExcel").html(testo ? '<div class="alert alert-' + tipo + '" role="alert">' + OrdinamentoExcel.esc(testo) + '</div>' : "");
    }

    proponi() {
        let id = Number($("#cmbAddestramentoOrdinamento").val());
        this.proposta = null;
        $("#mappaturaOrdinamento").empty();
        this.aggiornaGenera();
        if (!id || this.source == null) {
            return;
        }
        this.messaggio("");
        Call.doWithLargePayload("MenaboSettings", "proponiOrdinamentoDaExcel", "PUT",
            { source: JSON.stringify(this.source), idAddestramento: id }, this,
            function (result, sender) {
                if (!result || !result.esito) {
                    sender.messaggio(result && result.error ? result.error : "Proposta non riuscita.");
                    return;
                }
                sender.proposta = result.proposta;
                sender.disegnaMappatura();
            });
    }

    disegnaMappatura() {
        let p = this.proposta;
        let esc = OrdinamentoExcel.esc;
        let opzioni = ['<option value="">— da associare —</option>']
            .concat(p.colonne.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>'))
            .concat(['<option value="' + OrdinamentoExcel.PROGRESSIVO + '">' + OrdinamentoExcel.PROGRESSIVO + ' – numero progressivo</option>',
                     '<option value="' + OrdinamentoExcel.ADESSO + '">' + OrdinamentoExcel.ADESSO + ' – data e ora di adesso</option>',
                     '<option value="' + OrdinamentoExcel.FORMULA + '">ƒ Formula…</option>']);
        let html = '<table class="table table-sm"><thead><tr><th>Campo dello schema</th><th>Colonna (nome dato in Training), valore o formula</th></tr></thead><tbody>';
        p.campi.forEach(campo => {
            html += '<tr><td>' + esc(campo) + '</td><td><select class="form-select form-select-sm selMappatura" data-campo="' +
                esc(campo) + '">' + opzioni.join("") + '</select>' +
                '<input type="text" class="form-control form-control-sm mt-1 txtFormula" data-campo="' + esc(campo) +
                '" placeholder="' + esc('=SE([Food]="X";"FOOD";"NO FOOD")') + '" style="display:none;font-family:monospace;" /></td></tr>';
        });
        html += '</tbody></table>' +
            '<div class="small text-muted">Formula come in Excel, in italiano (SE, ;) o in inglese (IF, ,): le colonne si scrivono tra quadre col nome dato in Training, ' +
            'per esempio <code>' + esc('=SE([Food]="X";"FOOD";SE([NoFood]="X";"NO FOOD";""))') + '</code>, e valgono per la riga che si calcola.</div>';
        $("#mappaturaOrdinamento").html(html);

        let me = this;
        let casella = (campo) => $("#mappaturaOrdinamento .txtFormula[data-campo=\"" + campo.replace(/"/g, '\\"') + "\"]");
        $("#mappaturaOrdinamento .selMappatura").each(function () {
            let campo = $(this).attr("data-campo");
            let valore = p.mappatura[campo] || "";
            if (OrdinamentoExcel.eFormula(valore)) {
                $(this).val(OrdinamentoExcel.FORMULA);
                casella(campo).val(valore).show();
            } else {
                $(this).val(valore);
            }
        }).on("change", function () {
            let campo = $(this).attr("data-campo");
            if ($(this).val() === OrdinamentoExcel.FORMULA) {
                let testo = casella(campo).val() || "=";
                casella(campo).val(testo).show().trigger("focus");
                p.mappatura[campo] = testo;
            } else {
                casella(campo).hide();
                p.mappatura[campo] = $(this).val() || "";
            }
            me.aggiornaGenera();
        });
        $("#mappaturaOrdinamento .txtFormula").on("input", function () {
            me.impostaFormula($(this).attr("data-campo"), $(this).val());
        });
        this.aggiornaGenera();
    }

    impostaFormula(campo, testo) {
        if (this.proposta == null) {
            return;
        }
        this.proposta.mappatura[campo] = testo || "";
        this.aggiornaGenera();
    }

    aggiornaGenera() {
        let file = document.getElementById("fileOrdinamentoExcel");
        let conFile = !!(file && file.files && file.files.length > 0);
        $("#btnGeneraOrdinamento").prop("disabled", !(conFile && OrdinamentoExcel.campiCompleti(this.proposta)));
    }

    async genera() {
        let file = document.getElementById("fileOrdinamentoExcel").files[0];
        if (!file || !OrdinamentoExcel.campiCompleti(this.proposta)) {
            return;
        }
        showLoading();
        let richiesta = {
            source: JSON.stringify(this.source),
            idAddestramento: Number($("#cmbAddestramentoOrdinamento").val()),
            mappatura: this.proposta.mappatura,
            file: await convertBase64(file),
            filename: file.name
        };
        Call.doWithLargePayload("MenaboSettings", "generaOrdinamentoDaExcel", "PUT", richiesta, this, function (result, sender) {
            hideLoading();
            if (!result || !result.esito) {
                sender.messaggio(result && result.error ? result.error : "Generazione non riuscita.");
                return;
            }
            sender.messaggio("Generati " + result.elementi + " elementi: controllali nella sezione Source e premi Salva per salvarli.", "success");
            exSourceEditor.impostaValore(result.jsoncode);
            menuSource();
        });
    }
}
