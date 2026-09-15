class LoghiBolli {

    agenzia;
    filesToSync = [];

    constructor() {
        this.agenzia = new Agenzia();
    }

    get() {

        Call.do("LoghiBolli", "get", "GET", null, this, function (result, me) {

            console.log(result);

            let tblBody = $("#tblResult > tbody");
            tblBody.empty();

            let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=";

            if (result.error == null) {
                let template = $("#template").clone();

                for (let i = 0; i < result.length; i++) {
                    let item = result[i];
                    let itemHtml = $(template.html());

                    itemHtml.find("#nomeFile").text(item.nome);
                    itemHtml.find("#sigla").val(item.sigla);
                    itemHtml.find("#cmbTipo").val(item.tipo);

                    itemHtml.attr("id", item.id);

                    itemHtml.find("#preview").attr("src", olUri + item.guidId + "&width=30&height=0");

                    //td><button class="btn btn-primary" onclick="loghiBolliInstance.salvaLogoBollo($(this))">Salva</button></td>
                    itemHtml.find("#btnSalvaLogo").on("click", function () { loghiBolliInstance.salvaLogoBollo($(this)); });
                    itemHtml.find("#btnEliminaLogo").on("click", function () {
                        if (confirm("Sei sicuro di voler eliminare questo elemento?"))
                            loghiBolliInstance.delDo($(this).closest("tr").attr("id"));
                    });

                    itemHtml.find("#preview").on("click", function () { loghiBolliInstance.sostituisciFile($(this)); });

                    tblBody.append(itemHtml);
                }

                let templateNew = $("#templateNew").clone();
                let itemHtmlNew = $(templateNew.html());
                itemHtmlNew.find("#btnAggiungiLogo").on("click", function () {
                    loghiBolliInstance.salvaNuovoLogoBollo($(this));
                });

                itemHtmlNew.find("#previewNew").on("click", function () {
                    loghiBolliInstance.nuovoFile($(this))
                });
      
                tblBody.append(itemHtmlNew);

                $(".fileUpload").on("change", function () {
                    loghiBolliInstance.fileDaSostituireSelezionato($(this));

                });


                $("#fileNew").on("change", function () {
                    loghiBolliInstance.fileNuovoSelezionato($(this));
                });


            }
            else {
                mostraMessaggio(result.error, "danger");
            }

            hideLoading();
        });
    }

    sostituisciFile(sender) {
        sender.parent().find(".fileUpload").click();
    }
    fileDaSostituireSelezionato(sender) {

        let file = sender.prop("files")[0];
        if (file == null)        // l'utente ha annullato la finestra di scelta
            return;

        // Si controlla subito, alla scelta: dire "formato non ammesso" adesso e'
        // piu' utile che dirlo dopo aver premuto Salva.
        let errori = this.validaFile(file);
        if (errori.length > 0) {
            mostraMessaggio(errori.join("<br>"), "danger");
            sender.val("");      // si scarta la scelta, cosi' non parte al salvataggio
            return;
        }

        sender.closest("tr").find("#nomeFile").text(file.name);
        sender.closest("tr").find("button").removeClass("btn-primary");
        sender.closest("tr").find("button").addClass("btn-danger");
        sender.closest("tr").find("#nomeFile").css("color", "red");

    }

    nuovoFile(sender) {
        sender.parent().find("#fileNew").click();
    }

    fileNuovoSelezionato(sender) {
        let file = sender.prop("files")[0];
        if (file == null)        // l'utente ha annullato la finestra di scelta
            return;

        let errori = this.validaFile(file);
        if (errori.length > 0) {
            mostraMessaggio(errori.join("<br>"), "danger");
            sender.val("");
            sender.closest("tr").find("#nomeNew").text("");
            return;
        }

        sender.closest("tr").find("#nomeNew").text(file.name);

    }

    // Controlla il solo file. Separata dal resto perche' serve in due momenti:
    // appena l'utente sceglie l'immagine, e di nuovo prima di inviarla.
    // NON si controlla il formato: qui si accetta qualunque tipo di file, e se non
    // va bene sara' Olimpo a rifiutarlo, con il suo messaggio. Si ferma solo il file
    // vuoto, che non e' una questione di formato ma di caricamento andato storto.
    validaFile(file) {
        let errori = [];

        if (file.size === 0)
            errori.push("Il file \"" + file.name + "\" e' vuoto.");

        return errori;
    }

    // Controlla la riga intera prima di inviarla. Restituisce l'elenco dei
    // problemi: vuoto vuol dire che si puo' salvare. Il controllo sta anche qui e
    // non solo sul server perche' l'utente deve sapere cosa manca subito, senza
    // aspettare l'andata e ritorno di un file che magari pesa.
    validaLogoBollo(sigla, tipo, file, fileObbligatorio) {
        let errori = [];

        if (sigla == null || sigla.trim() === "")
            errori.push("La sigla e' obbligatoria.");

        // La voce "Seleziona tipo" vale 0, che non e' un TipoFoto valido: senza
        // questo controllo il server rispondeva esito=true senza salvare niente.
        if (tipo == null || tipo === "" || tipo === "0")
            errori.push("Scegli il tipo: Logo, Bollo o Sfondo.");

        if (file == null) {
            if (fileObbligatorio)
                errori.push("Scegli l'immagine da caricare.");
        }
        else {
            errori = errori.concat(this.validaFile(file));
        }

        return errori;
    }

    salvaLogoBollo(sender)
    {
        nascondiMessaggio();
        let riga = sender.closest("tr");
        let id_logobollo = riga.attr("id");
        // Qui il file e' facoltativo: si sta modificando una riga che l'immagine
        // ce l'ha gia', e si puo' voler cambiare solo sigla o tipo.
        let file = riga.find(".fileUpload").prop("files")[0] || null;

        let errori = this.validaLogoBollo(riga.find("#sigla").val(), riga.find("#cmbTipo").val(), file, false);
        if (errori.length > 0) {
            mostraMessaggio(errori.join("<br>"), "danger");
            return;
        }

        let fd = new FormData();
        fd.append("id", id_logobollo);
        fd.append("sigla", riga.find("#sigla").val());
        fd.append("tipo", riga.find("#cmbTipo").val());
        // Si allega solo se c'e' davvero: allegare un file nullo faceva arrivare al
        // server la stringa "undefined" al posto del file.
        if (file != null)
            fd.append("file", file);

        this.salvaDo(fd, id_logobollo);
    }

    salvaNuovoLogoBollo(sender) {
        nascondiMessaggio();
        let riga = sender.closest("tr");
        let file = riga.find("#fileNew").prop("files")[0] || null;

        let errori = this.validaLogoBollo(riga.find("#siglaNew").val(), riga.find("#cmbTipoNew").val(), file, true);
        if (errori.length > 0) {
            mostraMessaggio(errori.join("<br>"), "danger");
            return;
        }

        let fd = new FormData();
        fd.append("id", "");
        fd.append("sigla", riga.find("#siglaNew").val());
        fd.append("tipo", riga.find("#cmbTipoNew").val());
        fd.append("file", file);

        this.salvaDo(fd, "");
    }

    salvaDo(obj, id)
    {

        showLoading();

        let me = this;
        Call.doWithUpload("LoghiBolli", "salva", "POST", obj, this, function (result, me) {

            console.log("RISULTATO SALVATAGGIO");
            console.log(result);

            if (result.esito) {

                nascondiMessaggio();
                console.log(id);

                if (id == "") {
                    me.get();
                }
                else {
                    let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=";
                    let itemHtml = $("#" + id);
                    itemHtml.find("#btnSalvaLogo").addClass("btn-primary");
                    itemHtml.find("#btnSalvaLogo").removeClass("btn-danger");

                    itemHtml.find("#nomeFile").css("color", "black");
                    itemHtml.find("#preview").attr("src", olUri + result.item.guidId + "&width=30&height=0");

                    hideLoading();
                }
            }
            else {
                // Prima qui non c'era niente. Quando il server rispondeva "non fatto"
                // (campi incompleti, file rifiutato, caricamento su Olimpo fallito) la
                // pagina restava muta e hideLoading non veniva mai chiamata: all'utente
                // sembrava un blocco, non un errore.
                mostraMessaggio(
                    (result.error != null && result.error !== "") ? result.error : "Salvataggio non riuscito.",
                    "danger");
                hideLoading();
            }
        });
    }

    delDo(id) {

        showLoading();

        let me = this;
        Call.doWithUpload("LoghiBolli", "elimina/"+id, "GET", null, this, function (result, me) {

            console.log("RISULTATO ELIMINAZIONE");
            console.log(result);

            if (result.esito) {

                console.log(id);

                me.get();

            }
            else {

                alert(result.error);
                hideLoading();
            }

        });
    }
}