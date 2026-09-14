class Etichette {

    sourceEtichetteRef
    agenzia;
    sourceDaAggiornare = false;

    constructor() {
        this.agenzia = new Agenzia();
    }

    openModal(idEtichetta) {
        let me = this;
        console.log(idEtichetta);
        $("#modalModificaRegole").attr('idEtichetta', idEtichetta);
        if (this.sourceDaAggiornare) {
            Call.do("Etichette", "scaricaEtichette", "GET", null, this, function (result, sender) {
                console.log(result);
                me.sourceEtichetteRef = result;
                me.sourceDaAggiornare = false;

                let etichettaCorrispondente = me.sourceEtichetteRef.find(f => f.id == idEtichetta);
                $("#regoleContainer").empty();
                if (etichettaCorrispondente.regole != null) {
                    etichettaCorrispondente.regole.forEach(function (setRegole) {
                        let setRegoleItem = $($("#setRegole").clone().html());
                        setRegole.forEach(function (regola) {
                            let regolaItem = $($("#regola").clone().html());
                            regolaItem.find("#value").val(regola.value);

                            me.appendiOperatoriOptions(regolaItem.find("#operator"));
                            regolaItem.find("#operator").val(regola.operatore);

                            me.appendiCampiOptions(regolaItem.find("#campo"), regola.campo);
                            console.log(regolaItem.find("#campo"));
                            console.log(regola.campo);

                            setRegoleItem.append(regolaItem);
                        });
                        let addRegola = $($("#addRegola").clone().html());
                        setRegoleItem.append(addRegola);
                        $("#regoleContainer").append(setRegoleItem);
                    });
                }
                else {
                    this.aggiungiNuovoSetRegole($("#regoleContainer"));
                }

                console.log(etichettaCorrispondente);
                $("#modalModificaRegole").modal('show');
            });
        } else {
            let etichettaCorrispondente = this.sourceEtichetteRef.find(f => f.id == idEtichetta);
            $("#regoleContainer").empty();
            if (etichettaCorrispondente.regole != null) {
                etichettaCorrispondente.regole.forEach(function (setRegole) {
                    let setRegoleItem = $($("#setRegole").clone().html());
                    setRegole.forEach(function (regola) {

                        let regolaItem = $($("#regola").clone().html());
                        let percorso = regola.campo.split(".")[0];
                        if (percorso == "kit") {
                            percorso = "kit.declinazioni";
                        }

                        //regola.campo.replace(percorso+".", "");

                        //me.appendiCampiOptions(regolaItem.find("#value"), regola.campo, percorso)

                        //valore di confronto
                        regolaItem.find("#value").val(regola.value);

                        //operatore
                        me.appendiOperatoriOptions(regolaItem.find("#operator"));
                        regolaItem.find("#operator").val(regola.operatore);

                        me.appendiCampiOptions(regolaItem.find("#campo"), regola.campo, percorso);
                        console.log(regolaItem.find("#campo"));
                        console.log(regola.campo);

                        setRegoleItem.append(regolaItem);
                    });
                    let addRegola = $($("#addRegola").clone().html());
                    setRegoleItem.append(addRegola);
                    $("#regoleContainer").append(setRegoleItem);
                });
            }
            else {
                this.aggiungiNuovoSetRegole($("#regoleContainer"));
            }

            console.log(etichettaCorrispondente);
            $("#modalModificaRegole").modal('show');
        }
        
    }

    appendiOperatoriOptions(tendina) {
        tendina.append("<option  value=\"IN\">Contiene</option>");
        tendina.append("<option  value=\"CIN\">Contiene(CaseSensitive)</option>");
        tendina.append("<option  value=\"SIN\">Contiene(NoSpacing)</option>");
        tendina.append("<option  value=\"SCIN\">Contiene(NoSpacing & CaseSensitive)</option>");
        tendina.append("<option  value=\"!IN\">Non Contiene</option>");
        tendina.append("<option  value=\"C!IN\">Non Contiene(CaseSensitive)</option>");
        tendina.append("<option  value=\"S!IN\">Non Contiene(NoSpacing)</option>");
        tendina.append("<option  value=\"SC!IN\">Non Contiene(NoSpacing & CaseSensitive)</option>");
        tendina.append("<option  value=\"==\">Uguale</option>");
        tendina.append("<option  value=\"C==\">Uguale(CaseSensitive)</option>");
        tendina.append("<option  value=\"S==\">Uguale(NoSpacing)</option>");
        tendina.append("<option  value=\"SC==\">Uguale(NoSpacing & CaseSensitive)</option>");
        tendina.append("<option  value=\"!=\">Diverso</option>");
        tendina.append("<option  value=\"C!=\">Diverso(CaseSensitive)</option>");
        tendina.append("<option  value=\"S!=\">Diverso(NoSpacing)</option>");
        tendina.append("<option  value=\"SC!=\">Diverso(NoSpacing & CaseSensitive)</option>");
        tendina.append("<option  value=\">\">\></option>");
        tendina.append("<option  value=\">=\">\>=</option>");
        tendina.append("<option  value=\">=\">\<</option>");
        tendina.append("<option  value=\">=\">\<=</option>");
    }

    appendiCampiOptions(tendina, campo, percorso) {
        tendina.empty();
        tendina.append("<option  value=\"0\">Seleziona campo</option>");
        
        if (percorso == null || percorso == "recordInTracciato" || (campo != null && campo.indexOf("recordInTracciato") != -1)) {
            Call.do("Tracciati", "getAddestramenti", "GET", null, this, function (result, senderOwn) {
                result.forEach(function (addestramento) {
                    let campi = addestramento.schemaCampiExcels;
                    campi = campi.sort(function (a, b) {
                        return (a.indice < b.indice) ? -1 : ((a.indice > b.indice) ? 1 : 0);
                    });

                    for (let $va = 0; $va < campi.length; $va++) {

                        let item = campi[$va];
                        tendina.append("<option  value=\"" + item.nomeColonna + "\">" + item.nomeColonnaOriginale + "</option>");
                    }
                });
                for (let $va = 0; $va < chiaviTracciato.length; $va++) {

                    let item = chiaviTracciato[$va];
                    tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
                }
                var campiDaAppendere = senderOwn.agenzia.customCampiEtichettaturaTracciato();
                if (campiDaAppendere != null && campiDaAppendere.length > 0) {
                    for (var i = 0; i < campiDaAppendere.length; i++) {
                        var campoDaAppendere = campiDaAppendere[i];
                        tendina.append("<option  value=\"" + campoDaAppendere.value + "\">" + campoDaAppendere.nome + "</option>");
                    }
                }


                var values = {};
                tendina.children('option').each(function () {
                    var optionValue = $(this).val();
                    if (values[optionValue]) {
                        $(this).remove();
                    } else {
                        values[optionValue] = true;
                    }
                });
                tendina.closest(".col").find("#percorso").val("recordInTracciato");
                if (campo != null) {
                    let campoVal = campo.replace(/^recordInTracciato\./, "");
                    tendina.val(campoVal);
                }
            });
        }
        else if (percorso == "recordRevisionato" || (campo != null && campo.indexOf("recordRevisionato") != -1)) {
            for (let $va = 0; $va < chiaviRevisionato.length; $va++) {

                let item = chiaviRevisionato[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }
            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("recordRevisionato");
            if (campo != null) {
                let campoVal = campo.replace(/^recordRevisionato\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "recordImpaginato" || (campo != null && campo.indexOf("recordImpaginato") != -1)) {
            for (let $va = 0; $va < chiaviImpaginato.length; $va++) {

                let item = chiaviImpaginato[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }
            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("recordImpaginato");
            if (campo != null) {
                let campoVal = campo.replace(/^recordImpaginato\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "promoTracciati" || (campo != null && campo.indexOf("promoTracciati") != -1)) {
            for (let $va = 0; $va < chiaviPromoTracciato.length; $va++) {

                let item = chiaviPromoTracciato[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }

            var campiDaAppendere = this.agenzia.customCampiEtichettaturaPromoTracciati();
            if (campiDaAppendere != null && campiDaAppendere.length > 0) {
                for (var i = 0; i < campiDaAppendere.length; i++) {
                    var campoDaAppendere = campiDaAppendere[i];
                    tendina.append("<option  value=\"" + campoDaAppendere.value + "\">" + campoDaAppendere.nome + "</option>");
                }
            }

            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("promoTracciati");
            if (campo != null) {
                let campoVal = campo.replace(/^promoTracciati\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "promo" || (campo != null && campo.indexOf("promo") != -1)) {
            for (let $va = 0; $va < chiaviPromo.length; $va++) {

                let item = chiaviPromo[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }
            var campiDaAppendere = this.agenzia.customCampiEtichettaturaPromo();
            if (campiDaAppendere != null && campiDaAppendere.length > 0) {
                for (var i = 0; i < campiDaAppendere.length; i++) {
                    var campoDaAppendere = campiDaAppendere[i];
                    tendina.append("<option  value=\"" + campoDaAppendere.value + "\">" + campoDaAppendere.nome + "</option>");
                }
            }

            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("promo");
            if (campo != null) {
                let campoVal = campo.replace(/^promo\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "formato" || (campo != null && campo.indexOf("formato") != -1)) {
            for (let $va = 0; $va < chiaviFormato.length; $va++) {

                let item = chiaviFormato[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }

            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("formato");
            if (campo != null) {
                let campoVal = campo.replace(/^formato\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "kit.declinazioni" || (campo != null && campo.indexOf("kit.declinazioni") != -1)) {
            for (let $va = 0; $va < chiaviKitDeclinazioni.length; $va++) {

                let item = chiaviKitDeclinazioni[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }

            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("kit.declinazioni");
            if (campo != null) {
                let campoVal = campo.replace(/^kit.declinazioni\./, "");
                tendina.val(campoVal);
            }
        }
        else if (percorso == "context" || (campo != null && campo.indexOf("context") != -1)) {
            for (let $va = 0; $va < chiaviContext.length; $va++) {

                let item = chiaviContext[$va];
                tendina.append("<option  value=\"" + item + "\">" + item + "</option>");
            }
            var values = {};
            tendina.children('option').each(function () {
                var optionValue = $(this).val();
                if (values[optionValue]) {
                    $(this).remove();
                } else {
                    values[optionValue] = true;
                }
            });
            tendina.closest(".col").find("#percorso").val("context");
            if (campo != null) {
                let campoVal = campo.replace(/^context\./, "");
                tendina.val(campoVal);
            }
        }
        
    }

    aggiungiNuovoSetRegole(modalContainer) {
        let setRegole = $($("#setRegole").clone().html());
        let regola = $($("#regola").clone().html());
        let addRegola = $($("#addRegola").clone().html());
        this.appendiOperatoriOptions(regola.find("#operator"));
        this.appendiCampiOptions(regola.find("#campo"), null);                

        setRegole.append(regola);
        setRegole.append(addRegola);
        modalContainer.append(setRegole);
    }

    aggiungiRegola(addRegolaItem) {
        let regola = $($("#regola").clone().html());
        this.appendiOperatoriOptions(regola.find("#operator"));
        this.appendiCampiOptions(regola.find("#campo"), null);         
        regola.insertBefore(addRegolaItem);
    }

    eliminaSetRegole(setDaEliminare) {
        if (confirm("Sicuro di voler eliminare? Sarà possibile recuperare il set eliminato uscendo senza salvare")) {
            setDaEliminare.remove();
        }
    }

    eliminaRegola(regola) {
        regola.remove();
    }

    salvaEModifica() {
        
        let item = {
            Regole: [],
            }
        let idEtichetta = $("#modalModificaRegole").attr('idEtichetta');
        $("#modalModificaRegole").find(".setRegole").each(function () {
            let setRegole = [];
            $(this).find(".regola").each(function () {
                let regola = {
                    Value: "",
                    campo: "",
                    Operatore: ""
                }

                regola.Value = $(this).find("#value").val();
                regola.campo = $(this).find("#percorso").val() +".";
                regola.campo += $(this).find("#campo").val();
                regola.Operatore = $(this).find("#operator").val();

                if (regola.campo != "0" && regola.Operatore != "0") {
                    setRegole.push(regola);
                }
            });
            if (setRegole.length > 0) {
                item.Regole.push(setRegole);
            }
        });
        console.log(item.Regole);
        Call.do("Etichette", "UpdateRegole/" + parseInt(idEtichetta), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalModificaRegole").modal('hide');
                sender.sourceDaAggiornare = true;
                //window.location.reload();
            }
            else {
                showAlertModal("Errore, regola non aggiornata","danger")
            }
        });
    }

    showAlertModal(message, esito) {
        let width = $("#liveAlertPlaceholder").offsetWidth;
        const appendAlert = (message, type) => {
            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
            const content = $('<div></div>').text(message)
            const closeButton = $('<button></button>').addClass('btn-close').attr({
                'type': 'button',
                'data-bs-dismiss': 'alert',
                'aria-label': 'Close'
            })
            wrapper.append(content, closeButton)
            $("#liveAlertPlaceholder").css("width", width + "px");
            $('#liveAlertPlaceholder').append(wrapper)

            //// Chiude automaticamente l'alert dopo 1 secondo
            //setTimeout(function () {
            //    wrapper.alert('close')
            //    if (sender != null) { sender.prop("disabled", false); }
            //}, 2000);
        }

        appendAlert(message, esito);
    }
}