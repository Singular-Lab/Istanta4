class RegoleMastro {

    sourceEtichette
    sourceRegoleMastro
    optionSpecifiche = {
        FillColor: 0,
        TextColor: 1,
        CharacterStyle: 2,
        ParagraphStyle: 3,
        BorderColor: 4,
    }

    constructor() {
        let me = this;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source/SourceEtichetteRef.json?v1.' + rndVersion, function (data) {
            me.sourceEtichette = data.source;
        });
    }

    openModal(idMastro) {
        let me = this;
        console.log(idMastro);
        $("#modalModificaRegole").attr('idMastro', idMastro);

        let mastroCorrispondente = this.sourceRegoleMastro.find(f => f.id == idMastro);
        $("#regoleContainer").empty();
        if (mastroCorrispondente.regole != null) {
            mastroCorrispondente.regole.forEach(function (setRegole) {
                let setEtichetteItem = $($("#setEtichette").clone().html());
                setRegole.forEach(function (regola) {
                    let etichetta = $($("#etichetta").clone().html());

                    me.appendiEtichette(etichetta.find("#etichettaVal"));
                    etichetta.find("#etichettaVal").val(regola.nomeEtichetta);
                    etichetta.find("#presente").attr("checked", regola.presente);
                    setEtichetteItem.append(etichetta);
                });
                let addEtichetta = $($("#addEtichetta").clone().html());
                setEtichetteItem.append(addEtichetta);
                $("#regoleContainer").append(setEtichetteItem);
            });
        }
        else {
            //this.aggiungiNuovoSetRegole($("#regoleContainer"));
        }
        
        $("#modalModificaRegole").modal('show');
    }

    appendiEtichette(tendina) {
        this.sourceEtichette.forEach(function (item) {
            tendina.append("<option  value=\"" + item.Etichetta + "\">" + item.Etichetta +"</option>");
        });
    }

    aggiungiNuovoSetRegole(modalContainer) {
        let setEtichette = $($("#setEtichette").clone().html());
        let etichetta = $($("#etichetta").clone().html());
        let addEtichetta = $($("#addEtichetta").clone().html());
        this.appendiEtichette(etichetta.find("#etichettaVal"));          

        setEtichette.append(etichetta);
        setEtichette.append(addEtichetta);
        modalContainer.append(setEtichette);
    }

    aggiungiRegola(addEtichettaItem) {
        let etichetta = $($("#etichetta").clone().html());
        this.appendiEtichette(etichetta.find("#etichettaVal"));     
        etichetta.insertBefore(addEtichettaItem);
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
        let item = {
            Nome : "",
            Livello : 0,
            Regole: [],
            }
        let idMastro = $("#modalModificaRegole").attr('idMastro');
        $("#modalModificaRegole").find(".setEtichette").each(function () {
            let setEtichette = [];
            $(this).find(".etichetta").each(function () {
                let etichetta = {
                    nomeEtichetta: "",
                    presente: false,
                }

                etichetta.nomeEtichetta = $(this).find("#etichettaVal").val();
                etichetta.presente = $(this).find("#presente").prop("checked");
                setEtichette.push(etichetta);
            });
            if (setEtichette.length > 0) {
                item.Regole.push(setEtichette);
            }
        });
        console.log(item.Regole);
        Call.do("RegoleMastro", "Update/" + parseInt(idMastro), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalModificaRegole").modal('hide');
                window.location.reload();
            }
            else {
                me.showAlertModal("Errore, regola non aggiornata", "danger", $("#modalModificaRegole"))
            }
        });
    }

    openModalSpecifiche(idMastro) {
        let me = this;
        console.log(idMastro);
        $("#modalModificaSpecifiche").attr('idMastro', idMastro);

        let mastroCorrispondente = this.sourceRegoleMastro.find(f => f.id == idMastro);
        $("#specificheContainer").empty();
        if (mastroCorrispondente.specifiche != null) {
            mastroCorrispondente.specifiche.forEach(function (specifiche) {

                let specifica = $($("#specifica").clone().html());

                specifica.find("#etichettaScript").val(specifiche.etichetta);

                me.appendiSpecifica(specifica.find("#tipoElemento"));
                specifica.find("#tipoElemento").val(specifiche.tipoElemento);

                specifica.find("#nomeStile").val(specifiche.value);

                specifica.attr("id", "specificaApplicata");

                $("#specificheContainer").append(specifica);
            });
        }
        else {
            //this.aggiungiNuovoSetRegole($("#regoleContainer"));
        }

        $("#modalModificaSpecifiche").modal('show');
    }

    appendiSpecifica(tendina) {

        for (var key in this.optionSpecifiche) {
            // Verifica se la chiave è una proprietà diretta dell'oggetto (non ereditata)
            if (this.optionSpecifiche.hasOwnProperty(key)) {
                // Accesso alla chiave e al valore per ogni chiave nell'oggetto
                var chiave = key;
                var valore = this.optionSpecifiche[key];
                // Ora puoi fare qualcosa con chiave e valore
                tendina.append("<option  value=\"" + valore + "\">" + chiave + "</option>");
            }
        }
    }


    aggiungiSpecifica() {
        let specifica = $($("#specifica").clone().html());

        this.appendiSpecifica(specifica.find("#tipoElemento"));

        specifica.attr("id", "specificaApplicata");

        $("#specificheContainer").append(specifica);
    }

    eliminaSpecifica(specifica) {
        specifica.remove();
    }

    salvaEModificaSpecifiche() {
        let me = this;
        let item = {
            Nome: "",
            Specifiche: [],
        }
        let idMastro = $("#modalModificaSpecifiche").attr('idMastro');
        $("#modalModificaSpecifiche").find(".specifica").each(function () {

            let specifica = {
                etichetta: "",
                tipoElemento: -1,
                value: "",
            }

            specifica.etichetta = $(this).find("#etichettaScript").val();
            specifica.tipoElemento = $(this).find("#tipoElemento").val();
            specifica.value = $(this).find("#nomeStile").val();
            item.Specifiche.push(specifica);
        });
        console.log(item.Specifiche);
        Call.do("RegoleMastro", "Update/" + parseInt(idMastro), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalModificaSpecifiche").modal('hide');
                window.location.reload();
            }
            else {
                me.showAlertModal("Errore, specifiche non aggiornate", "danger", $("#modalModificaSpecifiche"))
            }
        });
    }

    showAlertModal(message, esito, modal) {
        let width = modal.find("#liveAlertPlaceholder").offsetWidth;
        const appendAlert = (message, type) => {
            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
            const content = $('<div></div>').text(message)
            const closeButton = $('<button></button>').addClass('btn-close').attr({
                'type': 'button',
                'data-bs-dismiss': 'alert',
                'aria-label': 'Close'
            })
            wrapper.append(content, closeButton)
            modal.find("#liveAlertPlaceholder").css("width", width + "px");
            modal.find('#liveAlertPlaceholder').append(wrapper)

            //// Chiude automaticamente l'alert dopo 1 secondo
            //setTimeout(function () {
            //    wrapper.alert('close')
            //    if (sender != null) { sender.prop("disabled", false); }
            //}, 2000);
        }

        appendAlert(message, esito);
    }
}