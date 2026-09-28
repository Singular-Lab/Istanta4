class LoghiBolli {

    agenzia;
    filesToSync = [];

    // I20-1008: i file scelti in una volta sola, ognuno in attesa di sigla e tipo nel
    // riepilogo. Ogni riga e' { chiave, file, sigla, tipo, errori }.
    riepilogo = [];

    // Le sigle gia' a sistema, prese dall'ultimo elenco: servono a dire nel riepilogo, prima
    // di inviare, che una sigla e' gia' usata.
    sigleEsistenti = [];

    invioInCorso = false;

    constructor() {
        // In Node (tests/istanta-web) Agenzia non c'e': la classe si prova senza.
        this.agenzia = typeof Agenzia !== "undefined" ? new Agenzia() : null;
    }

    get() {

        Call.do("LoghiBolli", "get", "GET", null, this, function (result, me) {

            console.log(result);

            let tblBody = $("#tblResult > tbody");
            tblBody.empty();

            let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=";

            if (result.error == null) {
                me.sigleEsistenti = result.map(function (item) { return item.sigla; });

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
                // I20-1008: icona e pulsante aprono la stessa scelta, che ora accetta piu' file.
                itemHtmlNew.find("#previewNew, #btnAggiungiLoghi").on("click", function () {
                    loghiBolliInstance.nuovoFile($(this));
                });
      
                tblBody.append(itemHtmlNew);

                $(".fileUpload").on("change", function () {
                    loghiBolliInstance.fileDaSostituireSelezionato($(this));

                });


                $("#fileNew").on("change", function () {
                    loghiBolliInstance.fileNuoviSelezionati($(this));
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
        sender.closest("tr").find("#fileNew").click();
    }

    // I20-1008: i file scelti vanno nel riepilogo, dove per ognuno si scrivono sigla e tipo.
    // Il file vuoto si scarta subito, come prima, dicendo quale.
    fileNuoviSelezionati(sender) {
        let files = Array.from(sender.prop("files") || []);
        // Si svuota subito: scegliendo di nuovo gli stessi file, senza, il change non
        // scatterebbe e il riepilogo non si riaprirebbe.
        sender.val("");

        if (files.length === 0)      // l'utente ha annullato la finestra di scelta
            return;

        nascondiMessaggio();
        let scelta = LoghiBolli.righeDaFile(files, this.validaFile);

        if (scelta.righe.length === 0) {
            mostraMessaggio(scelta.scartati.join("<br>"), "danger");
            return;
        }

        this.riepilogo = scelta.righe;
        this.mostraRiepilogo(scelta.scartati);
    }

    // Una riga del riepilogo per ogni file, con sigla e tipo ancora da scegliere. I file che
    // non passano validaFile non entrano, e in scartati c'e' il perche'.
    static righeDaFile(files, validaFile) {
        let righe = [];
        let scartati = [];

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            if (file == null)
                continue;

            let errori = validaFile(file);
            if (errori.length > 0) {
                scartati = scartati.concat(errori);
                continue;
            }

            righe.push({ chiave: "riga" + i, file: file, sigla: "", tipo: "0", errori: [] });
        }

        return { righe: righe, scartati: scartati };
    }

    // La sigla come la confronta il Plugin, che cerca il logo lettera per lettera (I20-990):
    // maiuscole e minuscole contano. Si tolgono solo gli spazi ai bordi, che nessuno scrive
    // apposta e che renderebbero il logo introvabile.
    static siglaPulita(sigla) {
        return sigla == null ? "" : String(sigla).trim();
    }

    // Gli errori di ogni riga, per chiave: un oggetto vuoto vuol dire che si puo' inviare
    // tutto. Si controlla l'intero riepilogo prima di mandare qualcosa, cosi' l'utente
    // sistema tutto in una volta invece di scoprire i problemi un file alla volta.
    erroriRiepilogo(righe, sigleEsistenti) {
        let errori = {};
        let esistenti = new Set((sigleEsistenti || []).map(LoghiBolli.siglaPulita));
        let ripetizioni = {};

        righe.forEach(function (riga) {
            let sigla = LoghiBolli.siglaPulita(riga.sigla);
            if (sigla !== "")
                ripetizioni[sigla] = (ripetizioni[sigla] || 0) + 1;
        });

        let me = this;
        righe.forEach(function (riga) {
            let sigla = LoghiBolli.siglaPulita(riga.sigla);
            let erroriRiga = me.validaLogoBollo(sigla, riga.tipo, riga.file, true);

            // Il Plugin prende il primo logo con quella sigla: un doppione non si vedrebbe
            // mai, e non si capirebbe quale dei due sta usando.
            if (sigla !== "" && esistenti.has(sigla))
                erroriRiga.push("La sigla \"" + sigla + "\" e' gia' usata da un logo a sistema.");
            else if (ripetizioni[sigla] > 1)
                erroriRiga.push("La sigla \"" + sigla + "\" e' ripetuta in questo caricamento.");

            if (erroriRiga.length > 0)
                errori[riga.chiave] = erroriRiga;
        });

        return errori;
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

    // Il modulo di un logo nuovo, come lo spediva la vecchia riga di inserimento: id vuoto
    // vuol dire nuovo, e il file e' sempre presente.
    static formDataNuovo(riga) {
        let fd = new FormData();
        fd.append("id", "");
        fd.append("sigla", LoghiBolli.siglaPulita(riga.sigla));
        fd.append("tipo", riga.tipo);
        fd.append("file", riga.file);
        return fd;
    }

    // Si manda un file alla volta, con lo stesso LoghiBolli/salva di sempre: un invio unico
    // con tutti i file sarebbe un contratto nuovo, e il server controlla gia' ogni logo per
    // conto suo. In sequenza e non in parallelo perche' ogni salvataggio aggiunge alla stessa
    // lista in memoria e la riscrive intera. Un rifiuto non ferma gli altri: si annota e si
    // prosegue.
    static async inviaInSequenza(righe, invia) {
        let esiti = [];

        for (let riga of righe) {
            let risposta;
            try {
                risposta = await invia(riga);
            }
            catch (e) {
                risposta = { esito: false, error: String(e) };
            }

            let riuscito = risposta != null && risposta.esito === true;
            esiti.push({ riga: riga, riuscito: riuscito, errore: riuscito ? null : LoghiBolli.messaggioRifiuto(risposta) });
        }

        return esiti;
    }

    // "uknown" e' quello che Call.doWithUpload passa quando la richiesta non arriva nemmeno:
    // all'utente non dice niente.
    static messaggioRifiuto(risposta) {
        if (risposta == null || risposta.error == null || risposta.error === "" || risposta.error === "uknown")
            return "Salvataggio non riuscito.";
        return risposta.error;
    }

    // Dopo l'invio restano nel riepilogo solo le righe rifiutate, ognuna col suo motivo: le
    // altre sono gia' salvate, e rimandarle le duplicherebbe.
    static righeRimaste(esiti) {
        return esiti
            .filter(function (esito) { return !esito.riuscito; })
            .map(function (esito) { esito.riga.errori = [esito.errore]; return esito.riga; });
    }

    inviaNuovo(riga) {
        let fd = LoghiBolli.formDataNuovo(riga);
        return new Promise(function (resolve) {
            Call.doWithUpload("LoghiBolli", "salva", "POST", fd, null, function (result) { resolve(result); });
        });
    }

    async salvaRiepilogo() {
        if (this.invioInCorso)
            return;

        this.messaggioRiepilogo([]);

        let errori = this.erroriRiepilogo(this.riepilogo, this.sigleEsistenti);
        this.riepilogo.forEach(function (riga) { riga.errori = errori[riga.chiave] || []; });
        if (Object.keys(errori).length > 0) {
            this.aggiornaRiepilogo();
            this.messaggioRiepilogo(["Correggi le righe segnate: non e' stato inviato nessun file."]);
            return;
        }

        this.invioInCorso = true;
        $("#btnSalvaRiepilogo").prop("disabled", true);
        showLoading();

        let me = this;
        let esiti = await LoghiBolli.inviaInSequenza(this.riepilogo, function (riga) { return me.inviaNuovo(riga); });

        esiti.filter(function (esito) { return esito.riuscito; })
            .forEach(function (esito) { me.sigleEsistenti.push(LoghiBolli.siglaPulita(esito.riga.sigla)); });

        this.riepilogo = LoghiBolli.righeRimaste(esiti);
        this.invioInCorso = false;

        if (this.riepilogo.length === 0) {
            this.modalRiepilogo().hide();
        }
        else {
            this.aggiornaRiepilogo();
            let salvati = esiti.length - this.riepilogo.length;
            this.messaggioRiepilogo([salvati + " file salvati, " + this.riepilogo.length + " non salvati: correggi e premi di nuovo Salva."]);
        }

        // L'elenco si ricarica comunque, cosi' i loghi gia' salvati compaiono anche se
        // qualcuno e' rimasto nel riepilogo. get() toglie anche il caricamento.
        this.get();
    }

    modalRiepilogo() {
        return bootstrap.Modal.getOrCreateInstance(document.getElementById("riepilogoLoghiModal"));
    }

    mostraRiepilogo(scartati) {
        let corpo = $("#tblRiepilogo > tbody");
        corpo.empty();

        let me = this;
        this.riepilogo.forEach(function (riga) {
            let rigaHtml = $($("#templateRiepilogo").html());
            rigaHtml.attr("data-chiave", riga.chiave);
            rigaHtml.find(".nomeFileRiepilogo").text(riga.file.name);
            rigaHtml.find(".siglaRiepilogo").on("input", function () { riga.sigla = $(this).val(); });
            rigaHtml.find(".tipoRiepilogo").on("change", function () { riga.tipo = $(this).val(); });
            rigaHtml.find(".rimuoviRiepilogo").on("click", function () { me.rimuoviDalRiepilogo(riga.chiave); });

            corpo.append(rigaHtml);
            me.anteprima(riga.file, rigaHtml.find(".anteprimaRiepilogo"));
        });

        this.aggiornaRiepilogo();
        this.messaggioRiepilogo(scartati || []);
        this.modalRiepilogo().show();
    }

    rimuoviDalRiepilogo(chiave) {
        this.riepilogo = this.riepilogo.filter(function (riga) { return riga.chiave !== chiave; });

        if (this.riepilogo.length === 0) {
            this.modalRiepilogo().hide();
            return;
        }

        this.aggiornaRiepilogo();
    }

    // Lo stato del riepilogo riportato nella tabella: via le righe tolte, e sotto ogni sigla
    // i problemi di quella riga. Il testo si mette con text() perche' contiene la sigla
    // scritta dall'utente e il messaggio del server.
    aggiornaRiepilogo() {
        let me = this;

        $("#tblRiepilogo > tbody > tr").each(function () {
            let tr = $(this);
            let riga = me.riepilogo.find(function (r) { return r.chiave === tr.attr("data-chiave"); });
            if (riga == null) {
                tr.remove();
                return;
            }

            let casella = tr.find(".erroriRiepilogo");
            casella.empty();
            riga.errori.forEach(function (errore) { casella.append($("<div>").text(errore)); });
        });

        $("#contatoreRiepilogo").text(this.riepilogo.length === 1 ? "1 file" : this.riepilogo.length + " file");
        $("#btnSalvaRiepilogo").prop("disabled", this.riepilogo.length === 0 || this.invioInCorso);
    }

    // I messaggi del riepilogo stanno dentro al modal: quelli di mostraMessaggio finirebbero
    // dietro, dove non li vede nessuno.
    messaggioRiepilogo(messaggi) {
        let casella = $("#messaggioRiepilogo");
        casella.empty();
        messaggi.forEach(function (messaggio) { casella.append($("<div>").text(messaggio)); });
        if (messaggi.length > 0)
            casella.show();
        else
            casella.hide();
    }

    svuotaRiepilogo() {
        if (this.invioInCorso)
            return;
        this.riepilogo = [];
        $("#tblRiepilogo > tbody").empty();
    }

    // L'anteprima del file prima dell'invio, con gli strumenti della scheda articolo (I20-985).
    // Se non si riesce resta l'icona: il nome del file accanto dice comunque cos'e'.
    anteprima(file, immagine) {
        LoghiBolli.indirizzoAnteprima(file).then(function (indirizzo) {
            if (indirizzo == null)
                return;

            let icona = immagine.attr("src");
            immagine.on("error", function () {
                immagine.off("error");
                immagine.attr("src", icona);
            });
            immagine.attr("src", indirizzo);
        });
    }

    // L'indirizzo dell'anteprima, oppure null. Il psd il browser non lo disegna, ma Photoshop
    // ci lascia dentro una miniatura (AnteprimaPsd); il resto lo si fa disegnare al browser.
    // Sempre come indirizzo data, perche' la policy della pagina rifiuta i blob. Non fallisce
    // mai: l'anteprima e' un di piu' e non deve fermare il caricamento.
    static indirizzoAnteprima(file) {
        return new Promise(function (resolve) {
            try {
                if (typeof Archivio === "undefined") {
                    resolve(null);
                    return;
                }

                if (Archivio.eUnPsd(file.name)) {
                    if (typeof AnteprimaPsd === "undefined") {
                        resolve(null);
                        return;
                    }

                    let lettore = new FileReader();
                    lettore.onload = function () { resolve(AnteprimaPsd.indirizzoMiniatura(lettore.result)); };
                    lettore.onerror = function () { resolve(null); };
                    // Si legge solo la testa: la miniatura sta all'inizio del file.
                    lettore.readAsArrayBuffer(file.slice(0, Archivio.TESTA_PSD));
                    return;
                }

                if (typeof createImageBitmap !== "function") {
                    LoghiBolli.indirizzoDalContenuto(file).then(resolve);
                    return;
                }

                createImageBitmap(file).then(function (immagine) {
                    let indirizzo = Archivio.indirizzoRimpicciolito(immagine);
                    try { immagine.close(); } catch (e) { }

                    if (indirizzo != null)
                        resolve(indirizzo);
                    else
                        LoghiBolli.indirizzoDalContenuto(file).then(resolve);
                }).catch(function () {
                    LoghiBolli.indirizzoDalContenuto(file).then(resolve);
                });
            }
            catch (e) {
                resolve(null);
            }
        });
    }

    // Ultima strada, come nella scheda articolo: il file intero come indirizzo data, se non e'
    // troppo grande da tenere in memoria. Se l'immagine non lo sa disegnare, torna l'icona.
    static indirizzoDalContenuto(file) {
        return new Promise(function (resolve) {
            if (!Archivio.siPuoLeggereTutto(file.size)) {
                resolve(null);
                return;
            }

            let lettore = new FileReader();
            lettore.onload = function () { resolve(lettore.result); };
            lettore.onerror = function () { resolve(null); };
            lettore.readAsDataURL(file);
        });
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

//I20-1008: in Node si esporta per i test (tests/istanta-web). Nella pagina module non esiste
//e questa riga non fa nulla.
if (typeof module !== "undefined" && module.exports) {
    module.exports = LoghiBolli;
}