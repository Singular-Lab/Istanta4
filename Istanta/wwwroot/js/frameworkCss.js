class FrameworkCss {

    boxDefault;
    sourceFramework;
    agenzia;
    sourceDaAggiornare = false;

    constructor() {
        this.agenzia = new Agenzia();
    }


    nuovoLivello(livello) {
        console.log(livello);
        Call.do("FrameworkCssController", "AddLivello/" + livello, "GET", null, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }

    addDefinizione(livello, ordine, nome, descrizione) {

        if (nome == null || nome == "") {
            alert("Nome non specificato");
            return; // Fermiamo l'esecuzione se il nome non è valido
        }
        if (livello == null || livello == "") {
            alert("Livello non specificato");
            return; // Fermiamo l'esecuzione se il livello non è valido
        }
        if (ordine == null || ordine == "") {
            alert("Ordine non specificato");
            return; // Fermiamo l'esecuzione se l'ordine non è valido
        }

        if (!this.isInteger(ordine)) {
            alert("Ordine non valido");
            return;
        }

        livello = livello.replace(" ", "");
        // Costruire l'id dinamico
        var hiddenInputId = "#liv_" + livello;

        // Leggere il valore dell'input nascosto
        var hiddenInput = $(hiddenInputId);
        var idLivello = 0;
        if (hiddenInput !== undefined) {
            console.log("Valore dell'input nascosto:", hiddenInput.val());
            idLivello = hiddenInput.val();
        } else {
            alert("Livello inesistente");
            return;
        }

        var def = {
            result: nome,
            ordine: parseInt(ordine),
            descrizione: descrizione
        }

        Call.do("FrameworkCssController", "AddDefinizione/" + idLivello, "POST", def, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }


    editOrdineLivello(ordine, id) {
        console.log(ordine);
        console.log(id);

        if (this.isInteger(ordine) && this.isInteger(id)) {
            if (parseInt(ordine) < 0) {
                alert("Inserire un ordine positivo");
                return;
            }
        }
        else {
            alert("Ordine inserito non valido");
            return;
        }

        Call.do("FrameworkCssController", "EditOrdineLivello/" + id + "/" + ordine, "GET", null, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }

    isInteger(value) {
        // Controlla se la stringa non è vuota, è un numero intero e non contiene caratteri non numerici
        let parsedValue = parseInt(value, 10);
        return !isNaN(parsedValue) && Number.isInteger(parsedValue) && parsedValue.toString() === value;
    }

    editDefinizione(nome, ordine, id, descrizione) {
        if (descrizione == "") {
            descrizione = "null";
        }

        if (nome == null || nome == "") {
            alert("Nome non specificato");
            return; // Fermiamo l'esecuzione se il nome non è valido
        }
        if (ordine == null || ordine == "") {
            alert("Ordine non specificato");
            return; // Fermiamo l'esecuzione se l'ordine non è valido
        } 
        if (id == null || id == "") {
            alert("Id non trovato, chiamare un operatore");
            return; // Fermiamo l'esecuzione se l'ordine non è valido
        }

        if (!this.isInteger(ordine)) {
            alert("Ordine non valido");
            return;
        }

        console.log(nome);
        console.log(ordine);
        console.log(id);

        let obj = {
            id: id,
            ordine: ordine,
            result: nome,
            descrizione: descrizione
            }

        Call.do("FrameworkCssController", "UpdateDefinizione", "PUT", obj, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }

    eliminaDefinizione(id) {
        if (!confirm("L'elemento sarà eliminato in modo definitivo, procedere lo stesso?")) {
            return;
        }
        if (id == null || id == "") {
            alert("Id non trovato, chiamare un operatore");
            return; // Fermiamo l'esecuzione se l'ordine non è valido
        }

        console.log(id);

        Call.do("FrameworkCssController", "DeleteDefenizione/" + id, "GET", null, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }

    eliminaLivello(id) {
        if (!confirm("L'elemento sarà eliminato in modo definitivo, procedere lo stesso?")) {
            return;
        }
        if (id == null || id == "") {
            alert("Id non trovato, chiamare un operatore");
            return; // Fermiamo l'esecuzione se l'ordine non è valido
        }

        console.log(id);

        Call.do("FrameworkCssController", "DeleteLivello/" + id, "GET", null, this, function (result, sender) {
            if (result.esito) {
                window.location.reload();
            }
            else {
                alert(result.error);
            }
        });
    }

    openModal(idDefinizione, percorso = "", annidate ) {
        let me = this;
        console.log(idDefinizione);
        idDefinizione = parseInt(idDefinizione);
        $("#modalModificaRegole").attr('idDefinizione', idDefinizione);
        $("#modalModificaRegole").attr('percorso', percorso);
        $("#livDeep").empty();
        let baseButton = $('<button class="btn btn-custom" onclick="frameInstance.openModal($(this).attr(\'idDefinizione\'), $(this).attr(\'percorso\'), $(this).attr(\'annidate\'))">Base</button>');
        baseButton.attr("idDefinizione", idDefinizione);
        baseButton.attr("percorso", "");
        baseButton.attr("annidate", false);

        $("#livDeep").append(baseButton);
        if (this.sourceDaAggiornare) {
            Call.do("FrameworkCssController", "scaricaFramework", "GET", null, this, function (result, sender) {
                console.log(result);
                me.sourceFramework = result.livelli;
                me.boxDefault = result.defaultBox;
                me.sourceDaAggiornare = false;

                sender.openModal(idDefinizione, percorso, annidate);
            });
        } else {
            let livCorrispondente = me.sourceFramework.find(f => f.definizioni.find(s => s.id == idDefinizione) != null);
            let defCorrispondente = livCorrispondente.definizioni.find(s => s.id == idDefinizione);

            if (defCorrispondente == null) {
                console.error("Definizione id:" + idDefinizione + " non trovata nel source");
                return;
            }

            let defCorrispondenteRegole = defCorrispondente.regole;

            if (defCorrispondente == null) {
                console.error("Regole della definizione id:" + idDefinizione + " non trovate nel source");
                return;
            }

            if (percorso != null) {
                let partiPercorso = percorso.split("$").filter(element => element !== "");
                let percorsoParziale = "";
                partiPercorso.forEach(function (item) {
                    let elPercorso = parseInt(item);
                    if (isNaN(elPercorso)) {
                        me.showAlertModal("Non è possibile creare regole annidate di un set non ancora salvato", "warning");
                    }

                    percorsoParziale += elPercorso + "$";
                    let listaDef = defCorrispondenteRegole;
                    defCorrispondenteRegole = defCorrispondenteRegole.find(f => f.id == elPercorso);
                    let index = listaDef.indexOf(defCorrispondenteRegole)+1;
                    let deepness = defCorrispondenteRegole.deepness + 1;
                    defCorrispondenteRegole = defCorrispondenteRegole.regoleAnnidate;
                    $("#livDeep").append('<span class="separator">→</span>');
                    let livButton = $('<button class="btn btn-custom" onclick="frameInstance.openModal($(this).attr(\'idDefinizione\'), $(this).attr(\'percorso\'), $(this).attr(\'annidate\'))">SET'+index+' (Liv' + deepness + ')</button>');
                    livButton.attr("idDefinizione", idDefinizione);
                    livButton.attr("percorso", percorsoParziale);
                    livButton.attr("annidate", true);

                    $("#livDeep").append(livButton);
                });
            }

            $("#regoleContainer").empty();

            if (defCorrispondenteRegole != null && defCorrispondenteRegole.length > 0) {
                let counter = 1;
                defCorrispondenteRegole.forEach(function (setRegole) {
                    let setRegoleItem = $($("#setRegole").clone().html());
                    setRegoleItem.attr("idSet", setRegole.id);
                    setRegoleItem.find("#nomeSet").text("SET" + counter);
                    setRegole.regole.forEach(function (regola) {
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
                    if (setRegole.regoleAnnidate.length > 0) {
                        addRegola.find("#gestisciRegoleAnnidate").text("Modifica regole annidate");
                    }
                    $("#regoleContainer").append(setRegoleItem);
                    counter++;
                });
            }
            else {
                this.aggiungiNuovoSetRegole($("#regoleContainer"));
            }

            console.log(defCorrispondente);
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
        if (campo != null && campo.indexOf("recordInTracciato") != -1) {
            percorso = "recordInTracciato"
        }
        if (campo != null && campo.indexOf("recordRevisionato") != -1) {
            percorso = "recordRevisionato"
        }
        if (campo != null && campo.indexOf("recordImpaginato") != -1) {
            percorso = "recordImpaginato"
        }
        if (campo != null && campo.indexOf("promoTracciati") != -1) {
            percorso = "promoTracciati"
        }
        if (campo != null && campo.indexOf("promo") != -1) {
            percorso = "promo"       
        }
        if (campo != null && campo.indexOf("allEtichette") != -1) {
            percorso = "allEtichette"
        }
        if (campo != null && campo.indexOf("context") != -1) {
            percorso = "context"
        }

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
        else if (percorso == "allEtichette" || (campo != null && campo.indexOf("allEtichette") != -1)) {
            tendina.append("<option  value=\"allEtichette\">lista etichette</option>");
            tendina.closest(".col").find("#percorso").val("allEtichette");
            if (campo != null) {
                let campoVal = campo.replace(/^allEtichette\./, "");
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
        setRegole.find("#nomeSet").text("Nuovo set");
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
        let me = this;
        let idDefinizione = parseInt($("#modalModificaRegole").attr('idDefinizione'));
        let percorso = $("#modalModificaRegole").attr('percorso');
        if (percorso == "") {
            percorso = "0";
        }
        let livCorrispondente = me.sourceFramework.find(f => f.definizioni.find(s => s.id == idDefinizione) != null);
        let defCorrispondente = livCorrispondente.definizioni.find(s => s.id == idDefinizione);

        if (defCorrispondente == null) {
            console.error("Definizione id:" + idDefinizione + " non trovata nel source");
            return;
        }


        let item = {
            id: idDefinizione,
            regole: [],
        }

        $("#modalModificaRegole").find(".setRegole").each(function () {
            let setRegola = [];

            $(this).find(".regola").each(function () {
                let regola = {
                    Value: "",
                    campo: "",
                    Operatore: ""
                };

                regola.Value = $(this).find("#value").val();
                regola.campo = $(this).find("#percorso").val() + ".";
                regola.campo += $(this).find("#campo").val();
                regola.Operatore = $(this).find("#operator").val();

                // Aggiungi la regola solo se il campo e l'operatore sono validi
                if (regola.campo != "0" && regola.Operatore != "0") {
                    setRegola.push(regola); // Aggiungi l'oggetto regola, non un array
                }
            });

            if (setRegola.length > 0) {
                let item2 = {
                    regole: setRegola // Aggiungi direttamente il set di regole (lista di oggetti, non array annidato)
                };

                // Aggiungi item2 alla lista principale
                item.regole.push(item2);
            }
        });
        console.log(item.regole);
        Call.do("FrameworkCssController", "UpdateRegoleDefinizione/" + percorso, "POST", item, this, function (result, sender) {
            console.log(result);
            if (result) {
                //$("#modalModificaRegole").modal('hide');
                sender.sourceDaAggiornare = true;
                sender.openModal(idDefinizione, percorso, percorso != "0");
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
            //}, 5000);
        }

        appendAlert(message, esito);
    }

}