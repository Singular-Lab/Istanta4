const InddEvents = require('./events');

const griglia = {
    async compilaGriglia(griglia, mappaGriglia = null) {
        let me = this;
        let pageName = griglia.parentPage.name;
        if (griglia.isValid) {
            console.log("Compila griglia");
            console.log(griglia);
        }
        else {
            messaggioUtente("Code GRD-01 Griglia non valida", "error");
            console.log("Griglia non valida");
            return;
        }
        var defaultMappa = mappaGriglia != null;
        try {


            if (!defaultMappa) {
                showLoading("Mappatura griglia in corso...");
            }
            await Utility.sleep(100);

            if (mappaGriglia == null) {
                mappaGriglia = this.mappaturaGriglia(griglia);
            }
            console.log(mappaGriglia);
            //in #GrigliaEdit creiamo una riga per ogni box in mappaGriglia, la riga contiene le seguenti colonne
            //il numero del box (uguale all'indice + 1)
            //le info scritte nel box ridotte ai primi 20 caratteri e senza a capo
            //se il box è bloccato o no, usando un menù a tendina
            //tutte le info sono già presenti in mappa che ha la struttura per ogni oggetto di:
            // let gruppoObj = {
            //     box: gruppo,
            //     bounds: gruppo.geometricBounds,
            //     infoPresenti: infoPresenti,
            //     info: infoPresenti ? info : null,
            //     bloccato: bloccato,
            //     associato: false,
            // };

            $("#GrigliaEdit").empty();

            //ordianiamo la mappa guardando a box.label
            mappaGriglia.sort((a, b) => parseInt(a.box.label.split("_")[1]) - parseInt(b.box.label.split("_")[1]));
            for (let i = 0; i < mappaGriglia.length; i++) {
                let gruppo = mappaGriglia[i];
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
                var text = $('<span>Box ' + (i + 1) + ': ' + (gruppo.infoPresenti ? gruppo.info.substring(0, 25).replace(/\n/g, " ") + "..." : "") + '</span>'); // Crea il testo
                text.css({ "font-size": "12px", "color": (i % 2 == 0 ? "white" : "lightgreen"), "width": "80%" });
                row.append(text); // Aggiunge il testo alla riga
                var iconBar = $('<div class="icon-bar" style="display: flex; gap: 10px;"></div>');

                // Icona punto rosso o punto rosso spento
                var puntoRossoIcon = $('<img title="Blocca box" src="' + (gruppo.bloccato ? "images/boxBloccato.png" : "images/boxSbloccato.png") + '" alt="punto_rosso" style="cursor: pointer; height: 15px; margin-right:5px;">');
                puntoRossoIcon.on('click', function () {
                    //se il gruppo è pieno
                    if (!gruppo.infoPresenti || gruppo.bloccato) {
                        gruppo.bloccato = !gruppo.bloccato;
                        $(this).attr("src", gruppo.bloccato ? "images/boxBloccato.png" : "images/boxSbloccato.png");
                        me.getChildBoxByLabel(gruppo.box, "no").visible = gruppo.bloccato;
                    }
                    else {
                        let postoSuccessivo = false;
                        let postoPrecedente = false;
                        //controlliamo in mappa se c'è un posto disponibile (non occupato e non bloccato) successivo al gruppo
                        for (var j = i + 1; j < mappaGriglia.length; j++) {
                            if (mappaGriglia[j].bloccato == false && mappaGriglia[j].infoPresenti == false) {
                                postoSuccessivo = true;
                                break;
                            }
                        }
                        //controlliamo in mappa se c'è un posto disponibile (non occupato e non bloccato) precedente al gruppo
                        for (var j = i - 1; j >= 0; j--) {
                            if (mappaGriglia[j].bloccato == false && mappaGriglia[j].infoPresenti == false) {
                                postoPrecedente = true;
                                break;
                            }
                        }

                        if(!postoSuccessivo && !postoPrecedente){
                            //se non c'è posto successivo e non c'è posto precedente allora 
                            me.modalSelezioneElementoIncludiEscludi(false, true, griglia, [pageName], mappaGriglia, gruppo, gruppo.codiceFiltroAssociato, async function (codiceEscluso) {
                                await me.confermatoIncludiEscludi(codiceEscluso);
                                mappaGriglia = me.mappaturaGriglia(griglia);
                                me.compilaGriglia(griglia, mappaGriglia);

                                let postoCorrispondenteSeStesso = (mappaGriglia[i].infoPresenti == false && mappaGriglia[i].bloccato == false);
                                if (!postoCorrispondenteSeStesso) {
                                    //controlliamo in mappa se c'è un posto disponibile (non occupato e non bloccato) successivo al gruppo
                                    for (var j = i + 1; j < mappaGriglia.length; j++) {
                                        if (mappaGriglia[j].bloccato == false && mappaGriglia[j].infoPresenti == false) {
                                            postoSuccessivo = true;
                                            break;
                                        }
                                    }
                                    //controlliamo in mappa se c'è un posto disponibile (non occupato e non bloccato) precedente al gruppo
                                    for (var j = i - 1; j >= 0; j--) {
                                        if (mappaGriglia[j].bloccato == false && mappaGriglia[j].infoPresenti == false) {
                                            postoPrecedente = true;
                                            break;
                                        }
                                    }

                                    if (!postoSuccessivo && !postoPrecedente) {
                                        messaggioUtente("Code GRD-02 Errore, non risultano posti disponibili dopo l'esclusione", "error");
                                    }

                                    mappaGriglia = me.scorri(postoSuccessivo, griglia, i, mappaGriglia);
                                }
                                gruppo = mappaGriglia.find(f => f.nomeBox == gruppo.nomeBox);
                                //blocchiamo il box
                                gruppo.bloccato = true;
                                $(this).attr("src", gruppo.bloccato ? "images/boxBloccato.png" : "images/boxSbloccato.png");
                                me.getChildBoxByLabel(gruppo.box, "no").visible = gruppo.bloccato;

                                me.compilaGriglia(griglia, mappaGriglia);
                                me.mostraElementiAvanzati(pageName);
                            });
                        }
                        else{
                            mappaGriglia = me.scorri(postoSuccessivo, griglia, i, mappaGriglia);
                            //blocchiamo il box
                            gruppo.bloccato = true;
                            $(this).attr("src", gruppo.bloccato ? "images/boxBloccato.png" : "images/boxSbloccato.png");
                            me.getChildBoxByLabel(gruppo.box, "no").visible = gruppo.bloccato;

                            me.compilaGriglia(griglia, mappaGriglia);
                            me.mostraElementiAvanzati(pageName);
                        }

                    }
                });
                iconBar.append(puntoRossoIcon);

                if (!gruppo.infoPresenti) {

                    // Icona includi
                    var includiIcon = $('<img title="Includi elemento" src="images/includi.png" alt="includi" style="cursor: pointer; height: 15px; margin-right:5px;">');
                    includiIcon.on('click', function () {
                        //ci recuperiamo da listaRefConteggio la pagina pageName, leggiamo il suo codice filtro e prendiamo tutte le pagine (inclusa se stessa) con lo stesso codice filtro
                        //facciamo un array con i nomi delle pagine e lo passiamo a modalSelezioneElementoIncludiEscludi
                        var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
                        var pagine = [];
                        if (obj != null) {
                            let pagCercata = obj.find(f => f.Pag == pageName);
                            if (pagCercata != null) {
                                let codiceFiltro = pagCercata.codiceFiltro;
                                let pagineConCodiceFiltro = obj.filter(f => f.codiceFiltro== codiceFiltro);
                                for (var j = 0; j < pagineConCodiceFiltro.length; j++) {
                                    pagine.push(pagineConCodiceFiltro[j].Pag);
                                }
                                console.log("Pagine con codice filtro " + codiceFiltro + ": " + pagine);
                            }
                            else{
                                pagine.push(pageName);
                            }
                        }
                        else{
                            pagine.push(pageName);
                        }

                        me.modalSelezioneElementoIncludiEscludi(true, false, griglia, pagine, mappaGriglia, gruppo);
                    });
                    iconBar.append(includiIcon);
                } else if (gruppo.infoPresenti) {
                    // Icona lock/unlock
                    var lockIcon = $('<img title="Ferma ref conteggiata" src="' + (gruppo.lock ? "images/locked.png" : "images/unlocked.png") + '" alt="lock" style="cursor: pointer; height: 15px; margin-right:5px;">');
                    lockIcon.on('click', function () {
                        var lockElement = me.getChildBoxByLabel(gruppo.box, "lock");
                        lockElement.visible = !lockElement.visible;
                        $(this).attr("src", lockElement.visible ? "images/locked.png" : "images/unlocked.png");
                    });
                    iconBar.append(lockIcon);

                    // Icona escludi
                    var escludiIcon = $('<img title="Escludi elemento" src="images/escludi.png" alt="escludi" style="cursor: pointer; height: 15px; margin-right:5px;">');
                    escludiIcon.on('click', async function () {
                        var res = await Utility.confirmCustom("Escludere l'elemento da tutte le pagine associate al filtro o solo dalla pagina corrente?", "Pagina "+pageName, 1, "Pagine filtro", 2);
                        if (res.result) {
                            var pagine = [];
                            if (res.hiddenVal == 2) {
                                var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
                                if (obj != null) {
                                    let pagCercata = obj.find(f => f.Pag == pageName);
                                    if (pagCercata != null) {
                                        let codiceFiltro = pagCercata.codiceFiltro;
                                        let pagineConCodiceFiltro = obj.filter(f => f.codiceFiltro== codiceFiltro);
                                        for (var j = 0; j < pagineConCodiceFiltro.length; j++) {
                                            pagine.push(pagineConCodiceFiltro[j].Pag);
                                        }
                                        console.log("Pagine con codice filtro " + codiceFiltro + ": " + pagine);
                                    }
                                    else {
                                        messaggioUtente("Code GRD-06 Pagina non trovata nel conteggio, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                                        pagine.push(pageName);
                                    }
                                }
                                else {
                                    messaggioUtente("Code GRD-07 File di conteggio non trovato, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                                    pagine.push(pageName);
                                }
                            }
                            else if(res.hiddenVal == 1){
                                pagine.push(pageName);
                            }
                            else {
                                messaggioUtente("Code GRD-08 Errore: impossibile trovare l'elemento nella lista di avanzati", "error");
                            }

                            if(me.escludiElemento(pagine, gruppo))
                            {
                                me.compilaGriglia(griglia, mappaGriglia);
                                me.mostraElementiAvanzati(pageName);
                            }
                        }
                    });
                    iconBar.append(escludiIcon);

                    // Icona includiEscludi
                    var includiEscludiIcon = $('<img title="Scambia elemento con elemento escluso" src="images/includiEscludi.png" alt="includiEscludi" style="cursor: pointer; height: 15px; margin-right:5px;">');
                    includiEscludiIcon.on('click', async function () {
                        var res = await Utility.confirmCustom("Escludere l'elemento da tutte le pagine associate al filtro o solo dalla pagina corrente?", "Pagina "+pageName, 1, "Pagine filtro", 2);
                        if (res.result) {
                            var pagine = [];
                            if (res.hiddenVal == 2) {
                                var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
                                if (obj != null) {
                                    let pagCercata = obj.find(f => f.Pag == pageName);
                                    if (pagCercata != null) {
                                        let codiceFiltro = pagCercata.codiceFiltro;
                                        let pagineConCodiceFiltro = obj.filter(f => f.codiceFiltro== codiceFiltro);
                                        for (var j = 0; j < pagineConCodiceFiltro.length; j++) {
                                            pagine.push(pagineConCodiceFiltro[j].Pag);
                                        }
                                        console.log("Pagine con codice filtro " + codiceFiltro + ": " + pagine);
                                    }
                                    else {
                                        messaggioUtente("Code GRD-03 Pagina non trovata nel conteggio, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                                        pagine.push(pageName);
                                    }
                                }
                                else {
                                    messaggioUtente("Code GRD-04 File di conteggio non trovato, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                                    pagine.push(pageName);
                                }
                            }
                            else if(res.hiddenVal == 1){
                                pagine.push(pageName);
                            }
                            else {
                                messaggioUtente("Code GRD-05 Errore: impossibile trovare l'elemento nella lista di avanzati", "error");
                            }

                            if (me.escludiElemento(pagine, gruppo)) {
                                me.compilaGriglia(griglia, mappaGriglia);
                                me.mostraElementiAvanzati(pageName);
                                me.modalSelezioneElementoIncludiEscludi(true, false, griglia, pagine, mappaGriglia, gruppo);
                            }
                        }
                    });
                    iconBar.append(includiEscludiIcon);


                }

                // Icona swap
                var swapIcon = $('<img title="Scambia elementi in griglia" src="images/swap.png" alt="swap" style="cursor: pointer; height: 15px; margin-right:5px;">');
                swapIcon.on('click', function () {
                    me.swap(gruppo, mappaGriglia, griglia, pageName);
                });
                iconBar.append(swapIcon);

                if (gruppo.infoPresenti) {
                    iconBar.append(me.creaPulsanteInfoIspezioneDatoDaGruppo(pageName, gruppo));
                }

                row.append(iconBar); // Aggiunge la barra delle icone alla riga

                $("#GrigliaEdit").append(row); // Aggiunge la riga a #GrigliaEdit
                if (i < mappaGriglia.length - 1) {
                    $("#GrigliaEdit").append('<hr>');
                }
            }
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code GRD-09 Errore generico durante il ricalco", "error");
        }
        finally {
            if (!defaultMappa) {
                hideLoading();
            }
        }
    },

    mappaturaGriglia(griglia) {
        let start = Date.now();
        if (!griglia.isValid) {
            console.error("Griglia non valida");
            return;
        }

        let mappa = [];
        //scorriamo tutti i gruppi in griglia in cerca di tutti i box e creiamo una mappa con i loro bounds
        let gruppi = griglia.groups;
        for (let i = 0; i < gruppi.length; i++) {
            let gruppo = gruppi.item(i);
            if (!gruppo.label.toLowerCase().startsWith("box")) {
                continue;
            }

            var infoPresenti = false;
            var info = "";
            var codice = null;

            //prendiamo le info
            var info = this.getChildBoxByLabel(gruppo, "info", true);
            if (info != null && info.contents != "") {
                infoPresenti = true;
                info = info.contents;
            }
            var codiceFiltro = null;
            var codice = null;
            var idRec = null;

            var codice_associato = this.getChildBoxByLabel(gruppo, "codice_associato", true);

            if (
                codice_associato != null &&
                codice_associato.label !== "codice_associato" &&
                codice_associato.label !== "codice_associato$"
            ) {
                codiceFiltro = this.parseCodiceAssociato(codice_associato.label);
                codice = codiceFiltro.codice;
                idRec = codiceFiltro.idRec;
            }
            var bloccato = this.getVisibilityLabelsBox(gruppo, "no");
            var lock = this.getVisibilityLabelsBox(gruppo, "lock");
            var ingombroSpeciale = this.getVisibilityLabelsBox(gruppo, "segnalazione_ingombro");

            let gruppoObj = {
                box: gruppo,
                bounds: gruppo.geometricBounds,
                puntoCentrale: [gruppo.geometricBounds[1] + (gruppo.geometricBounds[3] - gruppo.geometricBounds[1]) / 2, gruppo.geometricBounds[0] + (gruppo.geometricBounds[2] - gruppo.geometricBounds[0]) / 2],
                infoPresenti: infoPresenti,
                info: infoPresenti ? info : null,
                bloccato: bloccato,
                lock: lock,
                associato: false,
                elementiAssociati: [],
                nomeBox: gruppo.label,
                codiceAssociato: codice,
                ingombroSpeciale: ingombroSpeciale,

                // nuovo
                idRecAssociato: idRec,
                codiceFiltroAssociato: codiceFiltro,
            };
            mappa.push(gruppoObj);
        }

        //ordiniamo la mappa basandoci sui bounds dei gruppi
        //l'ordinamento da priorità alla y e poi alla x
        //se la y di due gruppi ha una differenza inferiore a +/- 5 px allora si ordina per x

        mappa.sort((a, b) => {
            // Calcola la differenza assoluta in Y
            const diffY = Math.abs(a.bounds[0] - b.bounds[0]);

            // Se la differenza in Y è 5 o meno, considerali uguali e confronta la X
            if (diffY <= 5) {
                return a.bounds[1] - b.bounds[1];
            }

            // Altrimenti ordina normalmente per Y
            return a.bounds[0] - b.bounds[0];
        });

        let fine = Date.now();
        console.log("Tempo impiegato: " + (fine - start) + " ms");
        return mappa;
    },

    creaPulsanteInfoIspezioneDato(recordInTracciato, dimensione = 20) {
        var infoIcon = $('<img title="Ispeziona dato" src="images/info.png" alt="info" style="cursor: pointer; width: ' + dimensione + 'px; height: ' + dimensione + 'px; margin-right:5px;">');
        infoIcon.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (typeof schedaRef !== "undefined" && typeof schedaRef.apriModalIspezioneDelDato === "function") {
                schedaRef.apriModalIspezioneDelDato(recordInTracciato, "Info dati referenza", recordInTracciato);
            }
            else {
                messaggioUtente("Code GRD-36 Interfaccia di ispezione del dato non disponibile", "error");
            }
        });

        return infoIcon;
    },

    creaPulsanteInfoIspezioneDatoDaGruppo(pagName, gruppo) {
        let me = this;
        var infoIcon = $('<img title="Ispeziona dato" src="images/info.png" alt="info" style="cursor: pointer; width: 15px; height: 15px; margin-right:5px;">');
        infoIcon.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var recordInTracciato = me.trovaRecordInTracciatoDaGruppo(pagName, gruppo);
            if (recordInTracciato == null) {
                messaggioUtente("Code GRD-37 Impossibile trovare il dato completo della referenza in griglia", "error");
                return;
            }

            if (typeof schedaRef !== "undefined" && typeof schedaRef.apriModalIspezioneDelDato === "function") {
                schedaRef.apriModalIspezioneDelDato(recordInTracciato, "Info dati referenza", recordInTracciato);
            }
            else {
                messaggioUtente("Code GRD-36 Interfaccia di ispezione del dato non disponibile", "error");
            }
        });

        return infoIcon;
    },

    trovaRecordInTracciatoDaGruppo(pagName, gruppo) {
        let me = this;
        if (gruppo == null || gruppo.codiceFiltroAssociato == null) {
            return null;
        }

        var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
        if (obj == null) {
            return null;
        }

        var pagCercata = obj.find(f => f.Pag == pagName);
        if (pagCercata != null) {
            var recordPagina = me.trovaRecordInTracciatoDaListaConteggio(pagCercata.listaImpaginate, gruppo.codiceFiltroAssociato);
            if (recordPagina != null) {
                return recordPagina;
            }
        }

        for (var i = 0; i < obj.length; i++) {
            var record = me.trovaRecordInTracciatoDaListaConteggio(obj[i].listaImpaginate, gruppo.codiceFiltroAssociato);
            if (record != null) {
                return record;
            }
        }

        return null;
    },

    trovaRecordInTracciatoDaListaConteggio(listaSerializzata, codiceFiltro) {
        var lista = this.parseListaConteggio(listaSerializzata);

        for (var i = 0; i < lista.length; i++) {
            try {
                if (sameCodiceFiltro(makeCodiceFiltroFromItemRef(lista[i]), codiceFiltro)) {
                    return lista[i];
                }
            }
            catch (e) {
                console.warn("Code GRD-38 Record conteggio non confrontabile:", e);
            }
        }

        return null;
    },

    parseListaConteggio(listaSerializzata) {
        if (listaSerializzata == null || listaSerializzata === "") {
            return [];
        }

        if (Array.isArray(listaSerializzata)) {
            return listaSerializzata;
        }

        try {
            return JSON.parse(listaSerializzata) || [];
        }
        catch (e) {
            console.warn("Code GRD-39 Errore parsing lista conteggio:", e);
            return [];
        }
    },

    mostraElementiAvanzati(pagName) {
        let me = this;
        //analogamente a quanto fatto sotto facciamo lo stesso per gli elementi esclusi inserendoli in #mostraAvanzate
        $("#mostraAvanzate").empty();
        var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
        var text = $('<span>Elementi esclusi dalla pagina ' + pagName + '</span>');
        text.css({ "font-size": "18px", "color": "red" });
        row.append(text);
        $("#mostraAvanzate").append(row);
        $("#mostraAvanzate").append('<br>');
        var obj = readFile(pathLavorazione + "/listaRefEscluse.json");
        if (obj != null) {
            let pagCercata = obj.find(f => f.Pag == pagName);
            if (pagCercata != null) {
                //deserializzamo la lista di pagCercata
                let lista = pagCercata.listaEscluse;
                //se la lista è vuota scriviamo "nessun elemento escluso"
                if (lista != null && lista.length > 0) {
                    for (var i = 0; i < lista.length; i++) {
                        let item = lista[i];
                        var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
                        var codiceGruppo = item["Scatto.CodiceGruppo"];
                        //facciamo un controllo per non farlo apparire troppo lungo
                        if (codiceGruppo.length > 20) {
                            codiceGruppo = codiceGruppo.substring(0, 20) + "...";
                        }
                        var descrizione = item["Descrizioni.Descrizione1"];
                        if (descrizione.length > 30) {
                            descrizione = descrizione.substring(0, 30) + "...";
                        }

                        // Prima colonna: testo
                        var colText = $('<div class="col" style="width: 80%;"></div>');
                        var text = $('<span>(' + codiceGruppo + ') ' + descrizione + '</span>'); // Crea il testo
                        text.css({ "font-size": "12px", "color": (i % 2 == 0 ? "white" : "lightgreen"), "width": "100%" });
                        colText.append(text);
                        row.append(colText);

                        // Seconda colonna: icone
                        var colIcons = $('<div class="col" style="width: 20%; display: flex; justify-content: flex-end; gap: 5px;"></div>');

                        colIcons.append(me.creaPulsanteInfoIspezioneDato(item));

                        // Icona xrossa.png
                        var xrossaIcon = $('<img title="Riabilita elemento da pagina corrente" src="images/xrossa.png" alt="xrossa" style="cursor: pointer; width: 20px; height: 20px; margin-right:5px;">');
                        xrossaIcon.on('click', function () {
                            console.log("xrossa clicked for codiceGruppo:", item["Scatto.CodiceGruppo"]);
                            me.rimuoviDaEsclusi(makeCodiceFiltroFromItemRef(item), pagName);
                        });
                        colIcons.append(xrossaIcon);

                        // Icona rimuoviDaTuttePagine.png
                        var rimuoviIcon = $('<img title="Riabilita elemento da tutte le pagine" src="images/rimuoviDaTuttePagine.png" alt="rimuoviDaTuttePagine" style="cursor: pointer; width: 20px; height: 20px; margin-right:5px;">');
                        rimuoviIcon.on('click', function () {
                            console.log("rimuoviDaTuttePagine clicked for codiceGruppo:", item["Scatto.CodiceGruppo"]);
                            me.rimuoviDaEsclusi(makeCodiceFiltroFromItemRef(item), pagName, true);
                        });
                        colIcons.append(rimuoviIcon);

                        row.append(colIcons);

                        $("#mostraAvanzate").append(row); // Aggiunge la riga a #bodyElementiAvanzati
                        if (i < lista.length - 1) {
                            //facciamo una piccola spaziatura, il br è troppo grande
                            $("#mostraAvanzate").append('<div style="height: 5px;"></div>');
                        }
                    }
                }
                else {
                    var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                    var text = $('<span>Nessun elemento escluso</span>');
                    text.css({ "font-size": "12px", "color": "white" });
                    row.append(text);
                    $("#mostraAvanzate").append(row);
                }
            }
            else {
                //scriviamo file non trovato
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                var text = $('<span>Nessun elemento escluso</span>');
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text);
                $("#mostraAvanzate").append(row);
            }
        }
        else {
            //scriviamo file non trovato
            var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
            var text = $('<span>Nessun elemento escluso</span>');
            text.css({ "font-size": "12px", "color": "white" });
            row.append(text);
            $("#mostraAvanzate").append(row);
        }

        $("#mostraAvanzate").append('<br>');
        $("#mostraAvanzate").append('<hr>');
        $("#mostraAvanzate").append('<br>');


        //inseriamo un titolo in #mostraAvanzate 'Elementi avanzati alla pagina ' + pagName
        var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
        var text = $('<span>Elementi avanzati alla pagina ' + pagName + '</span>');
        text.css({ "font-size": "18px", "color": "orange" });
        row.append(text);
        $("#mostraAvanzate").append(row);
        $("#mostraAvanzate").append('<br>');

        var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
        console.log(obj);

        if (obj != null) {
            let pagCercata = obj.find(f => f.Pag == pagName);
            if (pagCercata == null) {
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                var text = $('<span>Nessun elemento avanzato alla pagina ' + pagName + '</span>');
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text);
                $("#mostraAvanzate").append(row);
                return;
            }
            //cerchiamo tutto il gruppo filtri, ovvere le pagine con lo stesso codiceFiltro
            var gruppoFiltri = obj.filter(f => f.codiceFiltro== pagCercata.codiceFiltro);
            //deserializzamo la lista di pagCercata
            console.log(pagCercata);
            let lista = JSON.parse(pagCercata.listaAvanzate);
            //se la lista è vuota proviamo a controllare se ci sono elementi avanzati in gruppoFiltri, si trova il primo e lo usiamo
            if (lista == null || lista.length == 0) {
                for (var i = 0; i < gruppoFiltri.length; i++) {
                    var gruppo = gruppoFiltri[i];
                    if (gruppo.Pag != pagName) {
                        listaTmp = JSON.parse(gruppo.listaAvanzate);
                        if (listaTmp != null && listaTmp.length > 0) {
                            lista = listaTmp;
                            break;
                        }
                    }
                }
            }

            console.log(lista);
            //per ogni elemento della lista, creiamo un div con il contenuto di Scatto.CodiceGruppo, Descrizioni.Descrizione1, e il più basso e il più alto tra i prezzi_promo contenuti nel Dato dei vari ElementiGruppo
            for (var i = 0; i < lista.length; i++) {
                let item = lista[i];
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
                // var prezzoPromoMin = 999999999;
                // var prezzoPromoMax = 0;
                // for (var j = 0; j < item["ElementiGruppo"].length; j++) {
                //     var dato = item["ElementiGruppo"][j]["Dato"];
                //     if (dato["prezzo_promo"] < prezzoPromoMin) {
                //         prezzoPromoMin = dato["prezzo_promo"];
                //     }
                //     if (dato["prezzo_promo"] > prezzoPromoMax) {
                //         prezzoPromoMax = dato["prezzo_promo"];
                //     }
                // }
                //aggiungiamo accanto al testo un bottone per copiare il codice gruppo  
                var codice = item["Scatto.CodiceGruppo"];
                if (codice.length > 30) {
                    codice = codice.substring(0, 20) + "...";
                }
                var text = $('<span>(' + codice + ') ' + item["Descrizioni.Descrizione1"] + "</span>"); // Crea il testo
                text.css({ "font-size": "12px", "color": (i % 2 == 0 ? "white" : "lightgreen"), "width": "80%" });
                row.append(text); // Aggiunge il testo alla riga

                var copyButton = $('<button codiceGruppo="' + item["Scatto.CodiceGruppo"] + '">Copia</button>');
                copyButton.codice = item["Scatto.CodiceGruppo"];

                copyButton.on('click', function () {
                    navigator.clipboard.writeText({ 'text/plain': $(this).attr("codiceGruppo") }); //item["Scatto.CodiceGruppo"]
                    $(this).attr("src", "images/check.png");
                    setTimeout(function () {
                        copyButton.attr("src", "images/copyToClipBoard.png");
                    }, 1000);
                });
                row.append(copyButton); // Aggiunge il pulsante alla riga

                row.append(me.creaPulsanteInfoIspezioneDato(item));

                $("#mostraAvanzate").append(row); // Aggiunge la riga a #bodyElementiAvanzati
                if (i < lista.length - 1) {
                    //$("#mostraAvanzate").append('<hr>');
                    $("#mostraAvanzate").append('<div style="height: 5px;"></div>');
                }
            }

            //se mostra avanzate è vuoto, scriviamo "nessun elemento avanzato con la stessa formattazione di prima"
            if (lista.length == 0) {
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                var text = $('<span>Nessun elemento avanzato</span>');
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text);
                $("#mostraAvanzate").append(row);
            }
            //$("#mostraAvanzate").show();


        }
        else {
            //scriviamo file non trovato
            var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
            var text = $('<span>File non trovato</span>');
            text.css({ "font-size": "12px", "color": "white" });
            row.append(text);
            $("#mostraAvanzate").append(row);
        }
    },

    setOpacityGriglia(val, griglia) {
        if (!griglia.isValid) {
            messaggioUtente("Code GRD-10 Griglia non valida", "error");
            console.log("Griglia non valida");
            return;
        }

        griglia.transparencySettings.blendingSettings.opacity = val;
    },

    async ricalcaConteggio(griglia) { //mode 0 = sequenziale, mode 1 magnetico
        try {
            let me = this;
            var toggle = $("#toggleMode").prop("checked");
            var mode = toggle ? 0 : 1;
            if (griglia.isValid) {
                console.log("Ricalco griglia");
                console.log(griglia);
            }
            else {
                messaggioUtente("Code GRD-11 Griglia non valida", "error");
                console.log("Griglia non valida");
                return;
            }

            schedaRef.setBusy(true);
            showLoading("Mappatura in corso...");
            await Utility.sleep(100);
            var pageName = griglia.parentPage.name;
            var mappa = await confronti.mappaturaImpaginato(pageName, true);
            var mappaGriglia = this.mappaturaGriglia(griglia);
            var boxBloccati = mappaGriglia.filter(f => f.bloccato == true).length;

            if (mappa[pageName].length > mappaGriglia.length - boxBloccati) {
                messaggioUtente("Code GRD-12 Attenzione, la griglia impostata è insufficiente per ospitare tutti gli elementi, prima di procedere rimuovere dalla pagina gli elementi in eccesso o applicare un griglia più capiente", "warn");
                hideLoading();
                schedaRef.setBusy(false);
                return;
            }

            showLoading("Conteggio in corso...");
            await Utility.sleep(100);
            if (mode == 0) {


                console.log("Conteggio");
                //per ogni elemento in mappa prendiamo il primo box disponibile in mappaGriglia e riempiamo le sue info con infoDescrizione dell'elemento in mappa
                for (var i = 0; i < mappa[pageName].length; i++) {
                    var elemento = mappa[pageName][i];
                    var boxGrigliaEl = mappaGriglia.find(f => f.associato == false && f.bloccato == false);
                    if (boxGrigliaEl == null) {
                        //questa casistica dovrebbe essere impossibile quindi mandiamo un errore e stoppiamo tutto
                        messaggioUtente("Code GRD-13 Errore: impossibile trovare un box libero in mappaGriglia", "error");
                        console.log("Errore: impossibile trovare un box libero in mappaGriglia");
                        hideLoading();
                        schedaRef.setBusy(false);
                        return;
                    }
                    var boxGriglia = boxGrigliaEl.box;
                    if (boxGriglia != null) {
                        elemento.boxAssegnato = mappaGriglia[i];
                        boxGrigliaEl.elementiAssociati = [elemento];
                        boxGrigliaEl.associato = true;
                        var info = elemento.infoDescrizione;
                        var boxItem = this.getChildBoxByLabel(boxGriglia, "info");
                        if (boxItem != null) {
                            boxItem.contents = info;
                            boxGrigliaEl.infoPresenti = true;
                            boxGrigliaEl.info = info;
                        }

                        var codiceItem = this.getChildBoxByLabel(boxGriglia, "codiceForzato$", true);
                        if (codiceItem != null) {
                            codiceItem.label = "codiceForzato$" + elemento.codice;
                        }
                    }
                }

                //scorriamo gli elementi rimanenti in mappaGriglia e rimuoviamo le loro info
                var boxAvanzati = mappaGriglia.filter(f => f.associato == false);
                for (var i = 0; i < boxAvanzati.length; i++) {
                    var boxGriglia = boxAvanzati[i].box;
                    if (boxGriglia != null) {
                        var boxItem = this.getChildBoxByLabel(boxGriglia, "info");
                        if (boxItem != null) {
                            //boxItem.contents = "";
                            this.setContent(boxItem, "");
                            boxAvanzati[i].infoPresenti = false;
                            boxAvanzati[i].info = null;
                        }

                        var codiceItem = this.getChildBoxByLabel(boxGriglia, "codiceForzato$", true);
                        if (codiceItem != null) {
                            codiceItem.label = "codiceForzato$";
                        }
                    }
                }
                console.log("Fine Conteggio");
            }
            else {
                // var result = await confirm("Gli elementi impaginati a pagina "+ pageName +" saranno ricalcati seguendo la griglia selezionata, l'operazione non è annullabile, continuare?");
                // if(result){
                //     showLoading("Ricalco in corso...");
                //     await Utility.sleep(100);

                // }

                //per ogni elemento in mappa aggiungiamo una chiave chiamata magnetismo, tale chiave è così strutturata:
                // magnetismo: [{box: (oggetto in mappaGriglia), distanza: (distanza tra il puntoCentrale dell'oggetto in mappa griglia e questo oggetto in mappa)},{tutti gli altri box}]
                //una volta che abbiamo messo tutti i box così associati li ordiniamo per distanza crescente all'interno della chiave e poi passiamo al prossimo elemento in mappa

                for (var i = 0; i < mappa[pageName].length; i++) {
                    var elemento = mappa[pageName][i];
                    //aggiungiamo la chiave magnetismo e la compiliamo con la lista di tutti i box
                    elemento.magnetismo = [];
                    elemento.boxAssegnato = null;
                    elemento.indiceDiRecessioneMagnetismo = 0;
                    elemento.impossibileDaAssociare = false;
                    for (var j = 0; j < mappaGriglia.length; j++) {
                        var mappaGrigliaElement = mappaGriglia[j];
                        if (mappaGrigliaElement.bloccato) {
                            continue;
                        }

                        var magnetismoElement = {
                            mappaGrigliaElement: mappaGrigliaElement,
                            distanza: me.calcolaDistanza(elemento.puntoCentrale, mappaGrigliaElement.puntoCentrale),
                        };
                        elemento.magnetismo.push(magnetismoElement);
                    }
                    //ordiniamo la lista di magnetismo per distanza crescente
                    elemento.magnetismo.sort((a, b) => a.distanza - b.distanza);
                }

                //ora proviamo ad associare ogni elemento in mappa con un box in mappaGriglia
                //iniziamo con l'elemento più vicino al puntoCentrale dell'elemento in mappa

                for (var i = 0; i < mappa[pageName].length; i++) {
                    var elemento = mappa[pageName][i];
                    if (elemento.boxAssegnato == null) {
                        var boxGriglia = elemento.magnetismo[elemento.indiceDiRecessioneMagnetismo].mappaGrigliaElement;
                        elemento.boxAssegnato = boxGriglia;
                        boxGriglia.elementiAssociati.push(elemento);
                    }
                }

                var securityCounter = 0;
                do {

                    //ore che abbiamo associato tutti gli elementi in mappa con un box in mappaGriglia, possiamo procedere a controllare i conflitti
                    for (var i = 0; i < mappaGriglia.length; i++) {
                        var boxGriglia = mappaGriglia[i];

                        if (!boxGriglia.associato && !boxGriglia.bloccato) {
                            var elementiAssociati = boxGriglia.elementiAssociati;
                            if (elementiAssociati.length > 1) {
                                //se ci sono più elementi associati a un box, dobbiamo scegliere quale tenere
                                //accediamo a tutti gli elementi associati e troviamo quello il cui box contenuto al prossimo indice (rispetto al suo indiceDiRecessioneMagnetismo) è più lontano rispetto agli altri, lui sarà quello che manterrà l'associazione
                                var distanzaMax = 0;
                                var elementoMax = null;
                                for (var j = 0; j < elementiAssociati.length; j++) {
                                    var elemento = elementiAssociati[j];
                                    var distanza = elemento.magnetismo[elemento.indiceDiRecessioneMagnetismo + 1].distanza;
                                    if (distanza > distanzaMax) {
                                        distanzaMax = distanza;
                                        elementoMax = elemento;
                                    }
                                }

                                //associamo il box a elementoMax e rimuoiviamo l'associazione agli altri
                                boxGriglia.elementiAssociati = [elementoMax];
                                boxGriglia.associato = true;

                                //assegnamo agli altri 2 il prossimo box in mappaGriglia
                                for (var j = 0; j < elementiAssociati.length; j++) {
                                    var elemento = elementiAssociati[j];
                                    if (elemento != elementoMax) {
                                        elemento.indiceDiRecessioneMagnetismo++;
                                        if (elemento.indiceDiRecessioneMagnetismo < elemento.magnetismo.length) {
                                            elemento.boxAssegnato = elemento.magnetismo[elemento.indiceDiRecessioneMagnetismo].mappaGrigliaElement;
                                            elemento.boxAssegnato.elementiAssociati.push(elemento);
                                            if (elemento.boxAssegnato.elementiAssociati.length > 1) {
                                                elemento.boxAssegnato.associato = false;
                                            }
                                            else {
                                                elemento.boxAssegnato.associato = true;
                                            }
                                        }
                                        else {
                                            //non esiste nessun box che può ospitarlo
                                            elemento.boxAssegnato = null;
                                            elemento.impossibileDaAssociare = true;
                                        }
                                    }
                                }
                            }
                            else if (elementiAssociati.length == 1) {
                                boxGriglia.associato = true;
                            }
                        }
                    }
                    securityCounter++;
                } while (mappa[pageName].some(s => (s.boxAssegnato == null && !s.impossibileDaAssociare) || (s.boxAssegnato != null && s.boxAssegnato.elementiAssociati.length > 1)) && securityCounter < 10000)

                //adesso per ogni box possiamo compilare con le info corrispondenti
                for (var i = 0; i < mappaGriglia.length; i++) {
                    var boxGriglia = mappaGriglia[i];
                    if (boxGriglia.associato) {
                        var elementiAssociati = boxGriglia.elementiAssociati;
                        var info = "";
                        var elemento = elementiAssociati[0];
                        info += elemento.infoDescrizione + "\n";
                        var boxItem = this.getChildBoxByLabel(boxGriglia.box, "info");
                        if (boxItem != null) {
                            boxItem.contents = info;
                            mappaGriglia[i].infoPresenti = true;
                            mappaGriglia[i].info = info;
                        }

                        var codiceItem = this.getChildBoxByLabel(boxGriglia.box, "codiceForzato$", true);
                        if (codiceItem != null) {
                            codiceItem.label = "codiceForzato$" + elementiAssociati[0].codice;
                        }
                    }
                    else {
                        var boxItem = this.getChildBoxByLabel(boxGriglia.box, "info");
                        if (boxItem != null) {
                            this.setContent(boxItem, "");
                            //boxItem.contents = "";
                            mappaGriglia[i].infoPresenti = false;
                            mappaGriglia[i].info = null;
                        }

                        var codiceItem = this.getChildBoxByLabel(boxGriglia.box, "codiceForzato$", true);
                        if (codiceItem != null) {
                            codiceItem.label = "codiceForzato$";
                        }
                    }
                }
            }

            await this.compilaGriglia(griglia, mappaGriglia);

            return {
                mappa: mappa,
                mappaGriglia: mappaGriglia
            }
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code GRD-14 Errore generico durante il ricalco", "error");
        }
        finally {
            hideLoading();
            schedaRef.setBusy(false);
        }
    },

    async ricalca(griglia) {
        try {
            if (!griglia.isValid) {
                console.log("Griglia non valida");
                messaggioUtente("Code GRD-15 Griglia non valida", "error");
                return;
            }

            result = await Utility.confirm("Gli elementi impaginati a pagina " + griglia.parentPage.name + " saranno ricalcati seguendo la griglia selezionata, l'operazione non è annullabile, continuare?");

            if (result) {
                var mappe = await this.ricalcaConteggio(griglia);
                var pagName = griglia.parentPage.name;
                //scorriamo ogni oggetto in mappe.mappa e lo spostiamo nell'angolo destro del box assegnato
                for (var i = 0; i < mappe.mappa[pagName].length; i++) {
                    var elemento = mappe.mappa[pagName][i];
                    var elementoGriglia = elemento.boxAssegnato;
                    if (elementoGriglia != null) {
                        var bounds = elementoGriglia.bounds;
                        // Muove l'elemento in modo che il suo angolo in alto a sinistra coincida con quello della griglia
                        elemento.ref.move([bounds[1], bounds[0]]);
                    }
                

                    await callAllOperationFixBox(elemento.ref, elementoGriglia.bounds, null)
                }

                //rimuoviamo la griglia dalla pagina
                griglia.remove();
            }
        }
        catch (e) {
            console.error(e);
        }
    },

    calcolaDistanza(punto1, punto2) {
        var dx = punto2[0] - punto1[0]; // Differenza sulle X
        var dy = punto2[1] - punto1[1]; // Differenza sulle Y
        return Math.sqrt(dx * dx + dy * dy); // Distanza euclidea
    },

    async svuotaConteggio(griglia) {
        if (griglia.isValid) {
            console.log("Svuota conteggio");
            console.log(griglia);
        }
        else {
            messaggioUtente("Code GRD-16 Griglia non valida", "error");
            console.log("Griglia non valida");
            return;
        }

        showLoading("Mappatura griglia in corso...");
        await Utility.sleep(100);

        var mappaGriglia = this.mappaturaGriglia(griglia);

        var pagName = griglia.parentPage.name;
        var obj = readFile(pathLavorazione + "/listaRefConteggio.json");

        //cancelliamo le info della pagina in listaRefAvanzate
        if (obj != null) {
            var pagCercata = obj.find(f => f.Pag == pagName);
            //rimuoviamo la pagina dalla lista
            if (pagCercata != null) {
                obj = obj.filter(f => f.Pag != pagName);
                fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(obj));
            }
        }

        for (var i = 0; i < mappaGriglia.length; i++) {
            var box = mappaGriglia[i].box;
            if (box != null) {
                this.setInfo(box, "");
                // var boxItem = this.getChildBoxByLabel(box, "info");
                // if (boxItem != null) {
                //     boxItem.contents = "";
                // }
            }
        }

        hideLoading();
    },

    getVisibilityLabelsBox(box, label) { //box della griglia
        var items = box.allPageItems;
        for (var $i = 0; $i < items.length; $i++) {
            var item = items[$i];
            if (item.label == label) {
                return item.visible;
            }
        }
        console.log("Nessuna label " + label + " trovata");
        return false;
    },

    resetCodiceAssociato(box) {
        var codiciAssociati = this.getChildBoxByLabel(box, "codice_associato", true);
        if (codiciAssociati != null) {
            codiciAssociati.label = "codice_associato";
        }
    },

    getCodiceAssociatoConId(box) {
        var codiciAssociati = this.getChildBoxByLabel(box, "codice_associato", true);
        if (codiciAssociati != null) {
            if (codiciAssociati.label === "codice_associato" || codiciAssociati.label === "codice_associato$") {
                return null;
            }

            return this.parseCodiceAssociato(codiciAssociati.label);
        }

        return null;
    },

    getCodiceAssociato(box) {
        var codiceFiltro = this.getCodiceAssociatoConId(box);
        return codiceFiltro != null ? codiceFiltro.codice : "";
    },

    setCodiceAssociato(box, codiceFiltro) {
        var codiceObj = this.getChildBoxByLabel(box, "codice_associato", true);
        if (codiceObj != null) {
            if (codiceFiltro != null && codiceFiltro !== "") {
                if (typeof codiceFiltro === "string") {
                    throw new Error("setCodiceAssociato richiede codice + idRec, ricevuta stringa: " + codiceFiltro);
                }

                codiceObj.label = makeCodiceAssociatoLabel(codiceFiltro.codice, codiceFiltro.idRec);
            }
            else {
                codiceObj.label = "codice_associato";
            }
        }
    },

    setInfo(box, info) {
        var infoObj = this.getChildBoxByLabel(box, "info");
        this.setContent(infoObj, info);
    },

    setContent(contentObj, info) {
        if (contentObj != null) {
            //prima svuotiamo tutto il testo, potrebbe essere in overflow, se lo è il contents sovrascritto è solo quello visibile, quindi dobbiamo stare attenti ad zzerarlo bene
            contentObj.contents = "";
            var securityCounter = 0;
            while (contentObj.contents != "") {
                contentObj.contents = "";
                if (securityCounter > 10) {
                    console.error("Impossibile svuotare completamente il contenuto del box, potrebbe essere in overflow, procedo comunque a sovrascrivere il contenuto");
                    break;
                }
                securityCounter++;
            }

            contentObj.contents = info != null ? info : "";
        }
    },

    setVisibilityLabelsBox(box, label, visibility, objStyle = null) {
        var obj = this.getChildBoxByLabel(box, label, true);
        if (obj != null) {
            obj.visible = visibility;
            //se objStyle è valorizzato cerchiamo lo stile di oggetto con quel nome e se esiste lo applichiamo all'oggetto
            if (objStyle != null) {
                var style = Utility.parseObjStile(objStyle);
                if (style != null && style.isValid) {
                    obj.appliedObjectStyle = style;
                }
                else{
                    console.log("Stile di oggetto " + objStyle + " non trovato");
                }
            }

            return true;
        }
        else {
            console.error("Nessuna label " + label + " trovata");
            return false;
        }
    },


    getChildBoxByLabel(box, label, startWith = false) {
        var items = box.allPageItems;
        for (var $i = 0; $i < items.length; $i++) {
            var item = items[$i];
            if (startWith) {
                if (item.label.startsWith(label)) {
                    return item;
                }
            }
            else {
                if (item.label == label) {
                    return item;
                }
            }
        }

        return null;
    },

    getBoxByNumber(griglia, number) {
        // console.log("Cerco box " + number);
        // console.log(griglia);
        var items = griglia.allPageItems;
        for (var $i = 0; $i < items.length; $i++) {
            var item = items[$i];
            if (item.label == "box_" + number) {
                return item;
            }
        }
        return null;
    },

    getBoxListByRiga(riga) {
        var box = $("#grigliaController").find(".box");
        var validBoxes = [];
        box.each(function () {
            if ($(this).attr("riga") == riga) {
                validBoxes.push($(this));
            }
        });
        return validBoxes;
    },

    escludiElemento(pagCercate = [], gruppo = null, codiceFiltro = null) {
        let me = this;
        // leggiamo il codice, cerchiamo in listaRefConteggio se è presente alla pagina a cui ci troviamo, se lo troviamo lo spostiamo in listaRefEscluse all'elemento con la stessa pagina
        // altrimenti mandiamo errore
        if (gruppo != null) {
            codiceFiltro = gruppo.codiceFiltroAssociato;
        }

        if (codiceFiltro == null) {
            messaggioUtente("Code GRD-17 Errore: impossibile trovare il codice associato", "error");
            return false;
        }

        if (codiceFiltro != null) {
            var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
            if (obj == null) {
                messaggioUtente("Code GRD-18 Errore: impossibile trovare il file listaRefConteggio.json", "error");
                return false;
            }
            var objEscluse = readFile(pathLavorazione + "/listaRefEscluse.json");
            if (objEscluse == null) {
                objEscluse = [];
            }
            var elementoDaEscludere = null;
            var paginaEl = null;
            //cerchiamo in tutta la listaRefConteggio se c'è l'elemento con codice
            if (gruppo != null) {
                paginaEl = obj.find(f => f.listaImpaginate != null && JSON.parse(f.listaImpaginate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) != null);
                if (paginaEl != null) {
                    //cerchiamo l'elemento con codice
                    elementoDaEscludere = JSON.parse(paginaEl.listaImpaginate)
                        .find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro));
                }
            }
            else {
                paginaEl = obj.find(f => f.listaAvanzate != null && JSON.parse(f.listaAvanzate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) != null);
                if (paginaEl != null) {
                    //cerchiamo l'elemento con codice
                    elementoDaEscludere = JSON.parse(paginaEl.listaAvanzate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro));
                }
            }


            if (elementoDaEscludere != null) {
                for (var i = 0; i < pagCercate.length; i++) {
                    var pagCercata = objEscluse.find(f => f.Pag == pagCercate[i]);
                    if (pagCercata != null) {
                        pagCercata.listaEscluse.unshift(elementoDaEscludere);
                    }
                    else {
                        //la pagina non esiste nelle escluse, va creata e ci va messo l'elemento
                        var newObj = {
                            Pag: pagCercate[i],
                            listaEscluse: [elementoDaEscludere]
                        };
                        objEscluse.push(newObj);
                        //scriviamo il file
                    }

                    fs.writeFileSync(pathLavorazione + "/listaRefEscluse.json", JSON.stringify(objEscluse));

                    if (gruppo != null) {
                        var listaImpaginate = JSON.parse(paginaEl.listaImpaginate);
                        var listaAvanzate = JSON.parse(paginaEl.listaAvanzate);
                        //cerchiamo per codice l'elemento in listaImpaginate
                        var index = listaImpaginate.findIndex(f =>
                            sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)
                        ); if (index > -1) {
                            listaImpaginate.splice(index, 1);
                        }
                        paginaEl.listaImpaginate = JSON.stringify(listaImpaginate);

                        //ora dobbiamo rimuovere il box dalla pagina
                        var boxItem = me.getChildBoxByLabel(gruppo.box, "info");
                        if (boxItem != null) {
                            //boxItem.contents = "";
                            this.setContent(boxItem, "");
                            gruppo.infoPresenti = false;
                            gruppo.info = null;
                        }
                        // ora dobbiamo rimuovere il box dalla pagina
                        var codiceItem = me.getChildBoxByLabel(gruppo.box, "codice_associato$", true);
                        if (codiceItem != null) {
                            codiceItem.label = "codice_associato";
                            gruppo.codiceAssociato = null;
                            gruppo.idRecAssociato = null;
                            gruppo.codiceFiltroAssociato = null;
                        }

                        //disattiviamo il lock
                        var lockItem = me.getChildBoxByLabel(gruppo.box, "lock", true);
                        if (lockItem != null) {
                            lockItem.visible = false;
                            gruppo.lock = false;
                        }

                        //disattiviamo l'ingombro
                        var ingombroItem = me.getChildBoxByLabel(gruppo.box, "segnalazione_ingombro", true);
                        if (ingombroItem != null) {
                            ingombroItem.visible = false;
                            gruppo.ingombroSpeciale = false;
                        }
                    }
                }

                if (gruppo != null) {
                    //usiamo il codiceFiltro per recuperare il gruppo filtri
                    var gruppoFiltri = obj.filter(f => f.codiceFiltro== paginaEl.codiceFiltro);
                    if (gruppoFiltri != null) {
                        //prendiamo l'elemento di pagina di numero maggiore
                        var paginaAvanzati = 0;
                        var max = 0;
                        for (var j = 0; j < gruppoFiltri.length; j++) {
                            if (gruppoFiltri[j].Pag > max) {
                                max = gruppoFiltri[j].Pag;
                                paginaAvanzati = gruppoFiltri[j];
                            }
                        }
                        //aggiungiamo l'elementoDaEscludere alla lista di avanzati
                        var listaAvanzate = JSON.parse(paginaAvanzati.listaAvanzate);
                        if (listaAvanzate != null) {
                            //in testa
                            listaAvanzate.unshift(elementoDaEscludere);
                            gruppoFiltri.find(f => f.Pag == max).listaAvanzate = JSON.stringify(listaAvanzate);
                        }
                        else {
                            listaAvanzate = [elementoDaEscludere];
                        }

                        paginaAvanzati.listaAvanzate = JSON.stringify(listaAvanzate);
                    }
                    else {
                        messaggioUtente("Code GRD-19 Errore: impossibile trovare il gruppo filtri", "error");
                        return false;
                    }
                    //scriviamo il file
                    fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(obj));
                }
            } else {
                messaggioUtente("Code GRD-20 Errore: impossibile trovare il file listaRefConteggio.json", "error");
                return false;
            }
        }
        else {
            messaggioUtente("Code GRD-21 Errore: impossibile trovare il codice associato", "error");
            return false;
        }

        return true;
    },

    includiElemento(codiceFiltro, box) {
        try{
            let me = this;
            if (box == null) {
                var box = this.getChildBoxByLabel(this, "info");
                if (box == null) {
                    messaggioUtente("Code GRD-22 Errore: impossibile trovare il box info", "error");
                    return false;
                }
            }
            var pagName = box.parentPage.name;
    
            //leggiamo il file listaRefEscluse e cerchiamo la pagina
            var obj = readFile(pathLavorazione + "/listaRefEscluse.json");
            if (obj != null) {
                var pagineConElementoCercato = obj.filter(f => f.listaEscluse != null && f.listaEscluse.find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) != null);
                if (pagineConElementoCercato != null && pagineConElementoCercato.length > 0) {
                    var el = pagineConElementoCercato[0].listaEscluse.find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro));
                    //spostiamo l'elemento in listaRefConteggio
                    var objConteggio = readFile(pathLavorazione + "/listaRefConteggio.json");
                    if (objConteggio == null) {
                        objConteggio = [];
                    }
                    //troviamo se c'è l'elemento con la stessa pagina
                    var pagConteggio = objConteggio.find(f => f.Pag == pagName);
                    if (pagConteggio != null) {
                        //aggiungiamo l'elemento alle impaginate
                        var listaImpaginate = JSON.parse(pagConteggio.listaImpaginate);
                        if (listaImpaginate == null) {
                            listaImpaginate = [el];
                        }
                        else {
                            listaImpaginate.push(el);
                        }
                        pagConteggio.listaImpaginate = JSON.stringify(listaImpaginate);
    
                    } else {
                        //creiamo un nuovo oggetto
                        var newObj = {
                            Pag: pagName,
                            listaImpaginate: JSON.stringify([el]),
                            listaAvanzate: JSON.stringify([])
                        };
                        objConteggio.push(newObj);
                    }
    
                    var listeAvanzate = objConteggio.filter(f => f.listaAvanzate != null && JSON.parse(f.listaAvanzate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) != null);
                    if (listeAvanzate != null && listeAvanzate.length > 0) {
                        for (var i = 0; i < listeAvanzate.length; i++) {
                            var listaAvanzate = JSON.parse(listeAvanzate[i].listaAvanzate);
                            if (listaAvanzate != null) {
                                //rimuoviamo l'elemento dalla lista di avanzati
                                var index = listaAvanzate.findIndex(item =>
                                    sameCodiceFiltro(makeCodiceFiltroFromItemRef(item), codiceFiltro)
                                ); 
                                if (index > -1) {
                                    listaAvanzate.splice(index, 1);
                                }
                                listeAvanzate[i].listaAvanzate = JSON.stringify(listaAvanzate);
                            }
                        }
                    }
    
                    //infine rimuoviamo l'elemento dalla lista di escluse
                    for (var i = 0; i < pagineConElementoCercato.length; i++) {
                        var listaEscluse = pagineConElementoCercato[i].listaEscluse;
                        if (listaEscluse != null) {
                            //rimuoviamo l'elemento dalla lista di escluse
                            var index = listaEscluse.findIndex(item =>
                                sameCodiceFiltro(makeCodiceFiltroFromItemRef(item), codiceFiltro)
                            ); 
                            if (index > -1) {
                                listaEscluse.splice(index, 1);
                            }
                            pagineConElementoCercato[i].listaEscluse = listaEscluse;
                        }
                    }
                    //scriviamo nel box il codice e la descrizione
                    var boxItem = me.getChildBoxByLabel(box, "info");
                    if (boxItem != null) {
                        var descr = el["Descrizioni.Descrizione1"];
                        if (pluginMiddleware.getCampo("requiresIngombro") !== null) {
                            let ingombroAgenzia = pluginMiddleware.getCampo("requiresIngombro")(el);
                            //se ingombro è un array
                            let ingombro = "";
                            let stile = "";
                            if(ingombroAgenzia instanceof Array){
                                ingombro = ingombroAgenzia[0];
                                stile = ingombroAgenzia[1];
                            }
                            else{
                                ingombro = ingombroAgenzia;
                            }

                            if (ingombro != "")
                            {
                                descr += "\n" + "INGOMBRO: " + ingombro + "\n";//itemRef["combinazioneAssegnata"].toString();
                            }

                            this.setVisibilityLabelsBox(box, "segnalazione_ingombro", ingombro != "", stile);

                        }
                        else{
                            this.setVisibilityLabelsBox(box, "segnalazione_ingombro", false);
                        }

                        if (el["Scatto.CodiceGruppo"].toString().split(",").length > 1) {
                            descr += "\nGruppo di:" + el["Scatto.CodiceGruppo"].toString().split(",").length + " articoli";
                        }
                        descr += pluginMiddleware.getInfoExtra(el);
    
                        boxItem.contents = descr;
                    }
                    // ora dobbiamo rimuovere il box dalla pagina
                    var codiceItem = me.getChildBoxByLabel(box, "codice_associato", true);
                    if (codiceItem != null) {
                        this.setCodiceAssociato(box, codiceFiltro);
                    }

                    //se il box è bloccato lo sblocchiamo
                    var blocco = me.getChildBoxByLabel(box, "no");
                    if (blocco != null) {
                        blocco.visible = false;
                    }
    
                    //infine attiviamo il lock
                    var lock = me.getChildBoxByLabel(box, "lock");
                    if (lock != null) {
                        lock.visible = true;
                    }
    
    
                    //scriviamo il file
                    fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(objConteggio));
                    //scriviamo il file
                    fs.writeFileSync(pathLavorazione + "/listaRefEscluse.json", JSON.stringify(obj));
    
                }
                else {
                    //cerchiamo l'elemento nelle avanzate
                    var objConteggio = readFile(pathLavorazione + "/listaRefConteggio.json");
                    if (objConteggio == null) {
                        messaggioUtente("Code GRD-23 Errore: impossibile trovare il file listaRefConteggio.json", "error");
                    }
                    var pagineConElementoCercato = objConteggio.filter(f => f.listaAvanzate != null && JSON.parse(f.listaAvanzate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) != null);
                    if (pagineConElementoCercato != null && pagineConElementoCercato.length > 0) {
                        var el = JSON.parse(pagineConElementoCercato[0].listaAvanzate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro));
                        //rimuoviamo cercando per codice gruppo l'elemento dalla lista di avanzati
                        for (var i = 0; i < pagineConElementoCercato.length; i++) {
                            var listaAvanzate = JSON.parse(pagineConElementoCercato[i].listaAvanzate);
                            if (listaAvanzate != null) {
                                //rimuoviamo l'elemento dalla lista di avanzati
                                var index = listaAvanzate.findIndex(item =>
                                    sameCodiceFiltro(makeCodiceFiltroFromItemRef(item), codiceFiltro)
                                ); 
                                if (index > -1) {
                                    listaAvanzate.splice(index, 1);
                                }
                                pagineConElementoCercato[i].listaAvanzate = JSON.stringify(listaAvanzate);
                            }
                        }
    
                    } else {
                        messaggioUtente("Code GRD-24 Errore: impossibile trovare il file listaRefConteggio.json", "error");
                    }
    
                    var pagConteggio = objConteggio.find(f => f.Pag == pagName);
                    if (pagConteggio != null) {
                        //aggiungiamo l'elemento alle impaginate
                        var listaImpaginate = JSON.parse(pagConteggio.listaImpaginate);
                        if (listaImpaginate == null) {
                            listaImpaginate = [el];
                        }
                        else {
                            listaImpaginate.push(el);
                        }
                        pagConteggio.listaImpaginate = JSON.stringify(listaImpaginate);
    
                    } else {
                        //creiamo un nuovo oggetto
                        var newObj = {
                            Pag: pagName,
                            listaImpaginate: JSON.stringify([el]),
                            listaAvanzate: JSON.stringify([])
                        };
                        objConteggio.push(newObj);
                    }
    
                    //scriviamo nel box il codice e la descrizione
                    var boxItem = me.getChildBoxByLabel(box, "info");
                    if (boxItem != null) {
                        var descr = el["Descrizioni.Descrizione1"];
                        let ingombroAgenzia = pluginMiddleware.requiresIngombro(el);
                        //se ingombro è un array
                        let ingombro = "";
                        let stile = "";
                        if (ingombroAgenzia instanceof Array) {
                            ingombro = ingombroAgenzia[0];
                            stile = ingombroAgenzia[1];
                        }
                        else {
                            ingombro = ingombroAgenzia;
                        }

                        if (ingombro != "")
                        {
                            descr += "\n" + "INGOMBRO: " + ingombro + "\n";
                        }
    
                        if (el["Scatto.CodiceGruppo"].toString().split(",").length > 1) {
                            descr += "\nGruppo di:" + el["Scatto.CodiceGruppo"].toString().split(",").length + " articoli";
                        }

                        if(pluginMiddleware.getInfoExtra != null)
                            descr += pluginMiddleware.getInfoExtra(el);

                        if (ingombro != ""){

                            this.setVisibilityLabelsBox(box, "segnalazione_ingombro", ingombro != "", stile);
                        }
                        else{
                            this.setVisibilityLabelsBox(box, "segnalazione_ingombro", false);
                        }
    
                        boxItem.contents = descr;
                    }
                    // ora dobbiamo rimuovere il box dalla pagina
                    var codiceItem = me.getChildBoxByLabel(box, "codice_associato", true);
                    if (codiceItem != null) {
                        this.setCodiceAssociato(box, codiceFiltro);
                    }
    
                    //se il box è bloccato lo sblocchiamo
                    var blocco = me.getChildBoxByLabel(box, "no");
                    if (blocco != null) {
                        blocco.visible = false;
                    }
    
                    //infine attiviamo il lock
                    var lock = me.getChildBoxByLabel(box, "lock");
                    if (lock != null) {
                        lock.visible = true;
                    }


    
                    //scriviamo il file
                    fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(objConteggio));
                }
            } else {
                messaggioUtente("Code GRD-25 Errore: impossibile trovare il file listaRefEscluse.json", "error");
                return false;
            }
            return true;
        }catch(e){
            console.error(e);
        }

    },

    modalSelezioneElementoIncludiEscludi(includi, escludi, griglia, pagCercate = [], mappaGriglia = null, gruppo = null, codiceSuggeritoPerEsclusione = null, callback = null) {
        try {
            if (mappaGriglia == null && griglia != null) {
                //mappiamola
                mappaGriglia = this.mappaturaGriglia(griglia);
            }
            else if (griglia == null) {
                messaggioUtente("Code GRD-26 Errore: griglia non passata", "error");
                return;
            }

            var titolo = "Seleziona l'elemento da " + (includi ? "includere" : "escludere");
            Utility.apriModal("dialogIncludiEscludi", titolo);
            //salviamo nel modal i data della griglia, e se presente del gruppo
            $("#bodyIncludiEscludi").data("griglia", griglia);
            $("#bodyIncludiEscludi").data("mappaGriglia", mappaGriglia);
            $("#bodyIncludiEscludi").data("gruppo", gruppo);
            



            // nel bodyIncludiEscludi scriviamo:
            //se includi è true scriviamo "Seleziona l'elemento da includere" come titolo nel body
            //mettiamo un sottotitolo "Elemento attualmente selezionato: nessun elemento"
            //leggiamo il file listaRefEscluse e creiamo una lista degli elementi contenuti
            //ogni riga contiene il codice, ["Descrizioni.Descrizione1"], e un pulsante per includere con scritto seleziona
            //alla pressione del pulsante il sottotitolo cambia in "Elemento attualmente selezionato: codice + descrizione"
            //inoltre bodyIncludiEscludi.attr(codiceIncluso) diventa il codice dell'elemento selezionato
            //infine facciamo un controllo se includi è vero ed escludi è falso o se entrambi sono veri e sia bodyIncludiEscludi.attr(codiceIncluso) che bodyIncludiEscludi.attr(codiceEscluso) sono diversi da "", allora cambiamo la visibility da hidden a visible di confermaIncludiEscludi

            if (includi) {
                var row = $('<div class="row align-items-center"></div>');
                var text = $('<span id="elementoSelezionato">Elemento da includere:<br>nessun selezionato</span>');
                text.css({ "font-size": "16px", "color": "Red" });
                row.css({ "margin-top": "5px" });
                row.append(text);
                $("#headerIncludiEscludi").append(row);
                //creiamo una lista degli elementi contenuti in listaRefEscluse
                var obj = readFile(pathLavorazione + "/listaRefEscluse.json");
                let listaCodiciGiaScritti = [];
                if (obj != null) {
                    for (var i = 0; i < pagCercate.length; i++) {
                        var pagCercata = obj.find(f => f.Pag == pagCercate[i]);
                        if (pagCercata != null) {
                            var listaEscluse = pagCercata.listaEscluse;
                            if (listaEscluse != null && listaEscluse.length > 0) {
                                for (var i2 = 0; i2 < listaEscluse.length; i2++) {
                                    let elemento = listaEscluse[i2];
                                    //se l'elemento è già stato scritto non lo scriviamo
                                    let keyElemento = me.getCodiceFiltroKey(elemento);
                                    if (listaCodiciGiaScritti.includes(keyElemento)) {
                                        continue;
                                    }
                                    else {
                                        listaCodiciGiaScritti.push(keyElemento);
                                    }
                                    
                                    let codiceFiltro = makeCodiceFiltroFromItemRef(elemento);
                                    let codiceKey = codiceFiltro.codice + "$" + codiceFiltro.idRec;

                                    var row = $('<div class="row align-items-center" codiceAssociato="' + codiceKey + '"></div>');                                   
                                    // prima colonna con il pulsante
                                    var colButton = $('<div class="col" style="width: 5%; text-align: right;"></div>');
                                    var button = $('<img title="Includi elemento" src="images/includi.png" alt="Seleziona" style="cursor: pointer; height: 15px; margin-right:5px;">');
                                    button.click(function () {
                                        // Cambiamo il sottotitolo in "Elemento attualmente selezionato: codice + descrizione"
                                        let codiceGruppo = elemento["Scatto.CodiceGruppo"];
                                        if (codiceGruppo.length > 30) {
                                            codiceGruppo = codiceGruppo.substring(0, 30) + "...";
                                        }
                                        $("#elementoSelezionato").html("Elemento attualmente selezionato per l'inclusione:<br>" + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"]);
                                        // bodyIncludiEscludi.attr(codiceIncluso) diventa il codice dell'elemento selezionato
                                        $("#bodyIncludiEscludi").data("codiceIncluso", codiceFiltro);   
                                                                             // Facciamo diventare tutte le righe con codiceAssociato uguale a quello selezionato con le scritte in verde
                                        $("#bodyIncludiEscludi").find("div[codiceAssociato]").each(function () {
                                            if ($(this).attr("codiceAssociato") == codiceKey) {
                                                $(this).css({ "color": "green" });
                                            }
                                            else {
                                                //rimuoviamo il colore verde
                                                $(this).css({ "color": "black" });
                                            }
                                        });
                                        if (
                                            (includi && !escludi) ||
                                            (
                                                includi &&
                                                escludi &&
                                                $("#bodyIncludiEscludi").data("codiceIncluso") != null &&
                                                $("#bodyIncludiEscludi").data("codiceEscluso") != null
                                            )
                                        ) {
                                            $("#confermaIncludiEscludi").css("visibility", "visible");
                                        }
                                    });
                                    colButton.append(button);
                                    row.append(colButton);
 
                                    // seconda colonna con il testo
                                    var colText = $('<div class="col" style="width: 75%;"></div>');
                                    var codiceGruppo = elemento["Scatto.CodiceGruppo"];
                                    if (codiceGruppo.length > 20) {
                                        codiceGruppo = codiceGruppo.substring(0, 20) + "...";
                                    }
                                    var text = $('<span>' + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"] + '</span>');
                                    text.css({ "font-size": "14px" });
                                    colText.append(text);
                                    row.append(colText);

                                    //aggiungiamo una terza colonna con l'icona info e la sua funzione onclick
                                    var colInfo = $('<div class="col" style="width: 10%;"></div>');
                                    var info = $('<img title="Info extra" src="images/info.png" alt="Info" style="cursor: pointer; width: 25px; height: 20px; margin-right:5px;">');
                                    info.click(function () {
                                        Utility.popup('info', pluginMiddleware.getInfoExtra(elemento))
                                    });
                                    colInfo.append(info);
                                    row.append(colInfo);
                                    $("#bodyIncludiEscludi").append(row);

                                    //facciamo ora subito sotto un'altra riga con scritto "Elemento escluso da: " e la lista di tutte la pagine in cui si trova
                                    var pagineEscluse = obj.filter(f =>
                                        f.listaEscluse != null &&
                                        f.listaEscluse.find(x =>
                                            sameCodiceFiltro(makeCodiceFiltroFromItemRef(x), codiceFiltro)
                                        ) != null
                                    ); 
                                    if (pagineEscluse != null && pagineEscluse.length > 0) {
                                        var rowPagineEscluse = $('<div class="row align-items-center" style="margin-bottom:-5px"></div>');
                                        var colPagineEscluse = $('<div class="col" style="width: 100%;"></div>');
                                        var textPagineEscluse = $('<span style="font-size: 12px;">Elemento escluso da '+(pagineEscluse.length > 1 ? 'pagine: ' : 'pagina: ')+'</span>');
                                        colPagineEscluse.append(textPagineEscluse);
                                        var pagineEscluseText = "";
                                        for (var j = 0; j < pagineEscluse.length; j++) {
                                            if (j > 0) {
                                                pagineEscluseText += ", ";
                                            }
                                            pagineEscluseText += pagineEscluse[j].Pag;
                                        }
                                        var textPagineEscluse = $('<span style="font-size: 12px;">' + pagineEscluseText + '</span>');
                                        textPagineEscluse.css({ "font-size": "12px", "color": "black" });
                                        colPagineEscluse.append(textPagineEscluse);
                                        rowPagineEscluse.append(colPagineEscluse);
                                        //aggiungiamo la riga al bodyIncludiEscludi
                                        $("#bodyIncludiEscludi").append(rowPagineEscluse);
                                    }
                                }
                            }
                        }
                    }
                }
                //adesso ripetiamo l'operazione per gli elementi in listaRefConteggio, listaAvanzati di ogni pagina in pagCercate
                var objConteggio = readFile(pathLavorazione + "/listaRefConteggio.json");
                if (objConteggio != null) {
                    for (var i = 0; i < pagCercate.length; i++) {
                        var pagCercata = objConteggio.find(f => f.Pag == pagCercate[i]);
                        if (pagCercata != null) {
                            var listaAvanzate = JSON.parse(pagCercata.listaAvanzate);
                            if (listaAvanzate != null && listaAvanzate.length > 0) {
                                for (var i2 = 0; i2 < listaAvanzate.length; i2++) {
                                    let elemento = listaAvanzate[i2];
                                    //se l'elemento è già stato scritto non lo scriviamo
                                    let keyElemento = me.getCodiceFiltroKey(elemento);

                                    if (listaCodiciGiaScritti.includes(keyElemento)) {
                                        continue;
                                    }
                                    else {
                                        listaCodiciGiaScritti.push(keyElemento);
                                    }

                                    let codiceFiltro = makeCodiceFiltroFromItemRef(elemento);
                                    let codiceKey = codiceFiltro.codice + "$" + codiceFiltro.idRec;

                                    var row = $('<div class="row align-items-center" codiceAssociato="' + codiceKey + '"></div>');
                                    // prima colonna con il pulsante
                                    var colButton = $('<div class="col" style="width: 5%; text-align: right;"></div>');
                                    var button = $('<img title="Includi elemento" src="images/includi.png" alt="Seleziona" style="cursor: pointer; height: 15px; margin-right:5px;">');
                                    button.click(function () {
                                        // Cambiamo il sottotitolo in "Elemento attualmente selezionato: codice + descrizione"
                                        let codiceGruppo = elemento["Scatto.CodiceGruppo"];
                                        if (codiceGruppo.length > 30) {
                                            codiceGruppo = codiceGruppo.substring(0, 30) + "...";
                                        }
                                        $("#elementoSelezionato").html("Elemento attualmente selezionato per l'inclusione:<br>" + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"]);
                                        // bodyIncludiEscludi.attr(codiceIncluso) diventa il codice dell'elemento selezionato
                                        $("#bodyIncludiEscludi").data("codiceIncluso", codiceFiltro);                                        // Facciamo diventare tutte le righe con codiceAssociato uguale a quello selezionato con le scritte in verde
                                        $("#bodyIncludiEscludi").find("div[codiceAssociato]").each(function () {
                                            if ($(this).attr("codiceAssociato") == codiceKey) {
                                                $(this).css({ "color": "green" });
                                            }
                                            else {
                                                //rimuoviamo il colore verde
                                                $(this).css({ "color": "black" });
                                            }
                                        });
                                        if (
                                            (includi && !escludi) ||
                                            (
                                                includi &&
                                                escludi &&
                                                $("#bodyIncludiEscludi").data("codiceIncluso") != null &&
                                                $("#bodyIncludiEscludi").data("codiceEscluso") != null
                                            )
                                        ) {
                                            $("#confermaIncludiEscludi").css("visibility", "visible");
                                        }
                                    });
                                    colButton.append(button);
                                    row.append(colButton);
                                    // seconda colonna con il testo
                                    var colText = $('<div class="col" style="width: 75%;"></div>');
                                    var codiceGruppo = elemento["Scatto.CodiceGruppo"];
                                    if (codiceGruppo.length > 20) {
                                        codiceGruppo = codiceGruppo.substring(0, 20) + "...";
                                    }
                                    var text = $('<span>' + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"] + '</span>');
                                    text.css({ "font-size": "14px" });
                                    colText.append(text);
                                    row.append(colText);
                                    if(pluginMiddleware.getInfoExtra != null){
                                        //aggiungiamo una terza colonna con l'icona info e la sua funzione onclick
                                        var colInfo = $('<div class="col" style="width: 10%;"></div>');
                                        var info = $('<img title="Info extra" src="images/info.png" alt="Info" style="cursor: pointer; width: 25px; height: 20px; margin-right:5px;">');
                                        info.click(function () {
                                            Utility.popup('info', pluginMiddleware.getInfoExtra(elemento))
                                        });
                                        colInfo.append(info);
                                        row.append(colInfo);
                                    }
                                    $("#bodyIncludiEscludi").append(row);
                                }
                            }
                        }
                    }
                }                                   

            }

            //qui andrà la parte di esclusione
            if(escludi){
                //se il codiceSuggeritoPerEsclusione lo cerchiamo in mappa
                var elementoDaEscludere = null;
                var pagCercata = null;

                //leggiamo il file listaRefConteggio e leggiamo la pagCercata (sarà solo una)
                var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
                if (obj != null) {
                    var pagCercata = obj.find(f => f.Pag == pagCercate[0]);
                }
                else{
                    messaggioUtente("Code GRD-27 Errore: impossibile trovare il file listaRefConteggio.json", "error");
                    return;
                }

                //cerchiamo nell'impaginato l'elemento con il codiceSuggeritoPerEsclusione
                if (pagCercata != null) {
                    var listaImpaginate = JSON.parse(pagCercata.listaImpaginate);
                    if (listaImpaginate != null && listaImpaginate.length > 0) {
                        let codiceFiltroSuggerito = codiceSuggeritoPerEsclusione;

                        if (codiceFiltroSuggerito != null) {
                            elementoDaEscludere = listaImpaginate.find(f =>
                                sameCodiceFiltro(
                                    makeCodiceFiltroFromItemRef(f),
                                    codiceFiltroSuggerito
                                )
                            );
                        }
}
                    else{
                        messaggioUtente("Code GRD-28 Errore: impossibile trovare l'elemento con codice " + codiceSuggeritoPerEsclusione + " nell'impaginato", "error");
                        return;
                    }

                    if (elementoDaEscludere == null) {
                        messaggioUtente("Code GRD-28.5 Errore: impossibile trovare l'elemento suggerito nell'impaginato", "error");
                        return;
                    }

                    let codiceGruppo = elementoDaEscludere["Scatto.CodiceGruppo"];
                    if (codiceGruppo.length > 30) {
                        codiceGruppo = codiceGruppo.substring(0, 30) + "...";
                    }

                    var row = $('<div class="row align-items-center"></div>');
                    var text = $('<span id="elementoSelezionato">Elemento attualmente selezionato per l\'esclusione:<br>' + codiceGruppo + " - " + elementoDaEscludere["Descrizioni.Descrizione1"]+'</span>');
                    text.css({ "font-size": "16px", "color": "Red" });
                    row.append(text);
                    row.css({ "margin-top": "5px" });
                    $("#headerIncludiEscludi").append(row);

                    // bodyIncludiEscludi.attr(codiceIncluso) diventa il codice dell'elemento selezionato
                    $("#bodyIncludiEscludi").data(
                        "codiceEscluso",
                        makeCodiceFiltroFromItemRef(elementoDaEscludere)
                    );

                    //cicliamo ora tutti gli impaginati e per ogni elemento scriviamo una riga con icona escludi.png, il codice e la descrizione
                    //se l'elemento è uguale a quello selezionato lo scriviamo in verde
                    for (var i = 0; i < listaImpaginate.length; i++) {
                        let elemento = listaImpaginate[i];
                        let codiceFiltro = makeCodiceFiltroFromItemRef(elemento);
                        let codiceKey = codiceFiltro.codice + "$" + codiceFiltro.idRec;

                        row = $('<div class="row align-items-center" codiceAssociato="' + codiceKey + '"></div>');  // prima colonna con il pulsante
                        var colButton = $('<div class="col" style="width: 5%; text-align: right;"></div>');
                        var button = $('<img title="Escludi elemento" src="images/escludi.png" alt="Seleziona" style="cursor: pointer; height: 15px; margin-right:5px;">');
                        button.click(function () {
                            // Cambiamo il sottotitolo in "Elemento attualmente selezionato: codice + descrizione"
                            codiceGruppo = elemento["Scatto.CodiceGruppo"];
                            if (codiceGruppo.length > 30) {
                                codiceGruppo = codiceGruppo.substring(0, 30) + "...";
                            }
                            $("#elementoSelezionato").html("Elemento attualmente selezionato per l'esclusione:<br>" + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"]);
                            // bodyIncludiEscludi.attr(codiceIncluso) diventa il codice dell'elemento selezionato
                            let codiceFiltro = makeCodiceFiltroFromItemRef(elemento);
                            let codiceKey = codiceFiltro.codice + "$" + codiceFiltro.idRec;

                            $("#bodyIncludiEscludi").data("codiceEscluso", codiceFiltro);  // Facciamo diventare tutte le righe con codiceAssociato uguale a quello selezionato con le scritte in verde
                            $("#bodyIncludiEscludi").find("div[codiceAssociato]").each(function () {
                                if ($(this).attr("codiceAssociato") == codiceKey) {
                                    $(this).css({ "color": "green" });
                                }
                                else {
                                    //rimuoviamo il colore verde
                                    $(this).css({ "color": "black" });
                                }
                            });

                            //cerchiamo in mappaGriglia il gruppo e poi lo riassegnamo ai data
                            var gruppo = mappaGriglia.find(f =>
                                sameCodiceFiltro(f.codiceFiltroAssociato, codiceFiltro)
                            ); if (gruppo != null) {
                                $("#bodyIncludiEscludi").data("gruppo", gruppo);
                            }   
                        });
                        colButton.append(button);
                        row.append(colButton);
                        // seconda colonna con il testo
                        var colText = $('<div class="col" style="width: 75%;"></div>');
                        codiceGruppo = elemento["Scatto.CodiceGruppo"];
                        if (codiceGruppo.length > 20) {
                            codiceGruppo = codiceGruppo.substring(0, 20) + "...";
                        }
                        var text = $('<span>' + codiceGruppo + " - " + elemento["Descrizioni.Descrizione1"] + '</span>');
                        text.css({ "font-size": "14px" });
                        //se il codice è uguale a quello selezionato lo scriviamo in verde
                        if (sameCodiceFiltro(codiceFiltro, codiceSuggeritoPerEsclusione)) {
                            row.css({ "color": "green" });
                        }

                        colText.append(text);
                        row.append(colText);
                        $("#bodyIncludiEscludi").append(row);
                        $("#confermaIncludiEscludi").css("visibility", "visible");

                    }
                }
                else{
                    messaggioUtente("Code GRD-29 Errore: impossibile trovare la pagina " + pagCercate[0] + " nell'impaginato", "error");
                    return;
                }

            }
            //fine parte esclusione

            //se c'è una callback la impostiamo come evento on click del pulsante #confermaIncludiEscludi sostituendo i precedenti, oltre alla callback ci mettiamo anche Utility.chiudiModal()
            if (callback != null) {
                $("#confermaIncludiEscludi").off("click");
                $("#confermaIncludiEscludi").on("click", async function () {
                    await callback($("#bodyIncludiEscludi").data("codiceEscluso"));
                    Utility.chiudiModal();
                });
}
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code GRD-30 Errore generico durante l'apertura del modal di inclusione/esclusione", "error");
        }

    },

    async confermatoIncludiEscludi(codiceEscluso = null, codiceIncluso = null){
        try {
            //recuperiamo i dati della griglia
            var griglia = $("#bodyIncludiEscludi").data("griglia");
            var mappaGriglia = $("#bodyIncludiEscludi").data("mappaGriglia");
            var gruppo = $("#bodyIncludiEscludi").data("gruppo");
            var pageName = griglia.parentPage.name;

            codiceEscluso ??= $("#bodyIncludiEscludi").data("codiceEscluso");
            codiceIncluso ??= $("#bodyIncludiEscludi").data("codiceIncluso");

            var pagineEsclusione = [];
            if (codiceEscluso != null) {
                var res = await Utility.confirmCustom("Escludere l'elemento da tutte le pagine associate al filtro o solo dalla pagina corrente?", "Pagina "+pageName, 1, "Pagine filtro", 2);
                if (res.result) {
                    if (res.hiddenVal == 2) {
                        var obj = readFile(pathLavorazione + "/listaRefConteggio.json");
                        if (obj != null) {
                            let pagCercata = obj.find(f => f.Pag == pageName);
                            if (pagCercata != null) {
                                let codiceFiltro = pagCercata.codiceFiltro;
                                let pagineConCodiceFiltro = obj.filter(f => f.codiceFiltro == codiceFiltro);
                                for (var j = 0; j < pagineConCodiceFiltro.length; j++) {
                                    pagineEsclusione.push(pagineConCodiceFiltro[j].Pag);
                                }
                                console.log("Pagine con codice filtro " + codiceFiltro + ": " + pagineEsclusione);
                            }
                            else {
                                messaggioUtente("Code GRD-31 Pagina non trovata nel conteggio, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                                pagineEsclusione.push(pageName);
                            }
                        }
                        else {
                            messaggioUtente("Code GRD-32 File di conteggio non trovato, impossibile recuperare le informazioni sul filtro, l'elemento sarà escluso solo da pagina:" + pageName, "warning");
                            pagineEsclusione.push(pageName);
                        }
                    }
                    else if (res.hiddenVal == 1) {
                        pagineEsclusione.push(pageName);
                    }
                    else {
                        messaggioUtente("Code GRD-33 Errore: impossibile trovare l'elemento nella lista di avanzati", "error");
                    }
                }
                else {
                    return;
                }
            }


            //facciamo i vari console.log
            console.log(griglia);
            console.log(gruppo);
            console.log("Codice escluso:", codiceEscluso);
            console.log("Codice incluso:", codiceIncluso);

            if (codiceEscluso != null && gruppo != null) {
                this.escludiElemento(pagineEsclusione, gruppo, codiceEscluso);
            }

            if (codiceIncluso != null && gruppo != null) {
                this.includiElemento(codiceIncluso, gruppo.box/*, gruppo.numeroBox, griglia*/);
            }

            this.compilaGriglia(griglia);
            this.mostraElementiAvanzati(pageName);

            return true;
        }
        catch (e) {
            console.error(e);
        }
    },

    scorri(avanti, griglia, i, mappaGriglia = null){
        //se mappaGriglia è null la creiamo
        let me = this;
        if(mappaGriglia == null){
            mappaGriglia = this.mappaturaGriglia(griglia);
        }
        //la mappa è una lista di strutture
        // let gruppoObj = {
        //     box: gruppo,
        //     bounds: gruppo.geometricBounds,
        //     puntoCentrale: [gruppo.geometricBounds[1] + (gruppo.geometricBounds[3] - gruppo.geometricBounds[1]) / 2, gruppo.geometricBounds[0] + (gruppo.geometricBounds[2] - gruppo.geometricBounds[0]) / 2],
        //     infoPresenti: infoPresenti,
        //     info: infoPresenti ? info : null,
        //     bloccato: bloccato,
        //     lock: lock,
        //     associato: false,
        //     elementiAssociati: [],
        //     nomeBox: gruppo.label,
        //     codiceAssociato: codice,
        // };

        //per ogni box della griglia a partire da i (da i in avanti se avanti è true, altrimenti da i in indietro) controlliamo se il box è associato
        //se avanti è true scorre in avanti, altrimenti indietro al primo box non bloccato che troviamo, li copiamo e sovrascriviamo tutti i dati tranne box, bounds, puntoCentrale e nomeBox
        //se il box in cui ci stiamo trasferendo è pieno salviamo il suo contenuto e lo facciamo scorrere
        //se il box è bloccato lo saltiamo
        //se il box non è bloccato e non è pieno ci scriviamo dentro e si ferma il processo
        //se la griglia finisce ci fermiamo e mandiamo un messaggio di errore

        let codice = "";
        let info = "";
        let bloccato = false;
        let lock = false;
        let ingombro = false;
        let infoPresenti = false;
        let associato = false;
        let elementiAssociati = null;
        let codiceFiltroAssociato = null;

        for (var j = i; j < mappaGriglia.length && j >= 0; avanti ? j++ : j--) {
            let gruppo = mappaGriglia[j];
            if (gruppo.box != null && gruppo.box.visible) {
                //se il box è bloccato lo saltiamo
                if (gruppo.bloccato) {
                    if (avanti) {
                        j++;
                    } else {
                        j--;
                    }
                    continue;
                }
                else if (!gruppo.infoPresenti) {
                    gruppo.codiceAssociato = codice;
                    gruppo.info = info;
                    gruppo.bloccato = bloccato;
                    gruppo.lock = lock;
                    gruppo.infoPresenti = infoPresenti;
                    gruppo.associato = associato;
                    gruppo.elementiAssociati = elementiAssociati;
                    gruppo.ingombroSpeciale = ingombro;
                    gruppo.idRecAssociato = codiceFiltroAssociato != null ? codiceFiltroAssociato.idRec : null;
                    gruppo.codiceFiltroAssociato = codiceFiltroAssociato;
                    break;
                }

                //facciamo scorrere il box
                do {
                    if (avanti) {
                        j++;
                    } else {
                        j--;
                    }
                }
                while (mappaGriglia[j] != null && mappaGriglia[j].bloccato);
                //ora dobbiamo copiare il box in cui ci stiamo trasferendo

                if (mappaGriglia[j] == null) {
                    messaggioUtente("Code GRD-34 Errore: spazio in griglia insufficiente", "error");
                    return mappaGriglia;
                }

                let gruppoDestinazione = mappaGriglia[j];
                //copiamo il box
                //assegnamo a gruppo le varie variabili

                let tmpCodice = gruppoDestinazione.codiceAssociato;
                let tmpInfo = gruppoDestinazione.info;
                let tmpBloccato = gruppoDestinazione.bloccato;
                let tmpLock = gruppoDestinazione.lock;
                let tmpInfoPresenti = gruppoDestinazione.infoPresenti;
                let tmpAssociato = gruppoDestinazione.associato;
                let tmpElementiAssociati = gruppoDestinazione.elementiAssociati;
                let tmpIngombro = gruppoDestinazione.ingombroSpeciale;
                let tmpCodiceFiltro = gruppoDestinazione.codiceFiltroAssociato;


                gruppoDestinazione.codiceAssociato = gruppo.codiceAssociato;
                gruppoDestinazione.info = gruppo.info;
                gruppoDestinazione.bloccato = gruppo.bloccato;
                gruppoDestinazione.lock = gruppo.lock;
                gruppoDestinazione.infoPresenti = gruppo.infoPresenti;
                gruppoDestinazione.associato = gruppo.associato;
                gruppoDestinazione.elementiAssociati = gruppo.elementiAssociati;
                gruppoDestinazione.ingombroSpeciale = gruppo.ingombroSpeciale;
                gruppoDestinazione.idRecAssociato = gruppo.idRecAssociato;
                gruppoDestinazione.codiceFiltroAssociato = gruppo.codiceFiltroAssociato;

                gruppo.codiceAssociato = codice;
                gruppo.info = info;
                gruppo.bloccato = bloccato;
                gruppo.lock = lock;
                gruppo.infoPresenti = infoPresenti;
                gruppo.associato = associato;
                gruppo.elementiAssociati = elementiAssociati;
                gruppo.ingombroSpeciale = ingombro;
                gruppo.idRecAssociato = codiceFiltroAssociato != null ? codiceFiltroAssociato.idRec : null;
                gruppo.codiceFiltroAssociato = codiceFiltroAssociato;

                codice = tmpCodice;
                info = tmpInfo;
                bloccato = tmpBloccato;
                lock = tmpLock;
                infoPresenti = tmpInfoPresenti;
                associato = tmpAssociato;
                elementiAssociati = tmpElementiAssociati;
                ingombro = tmpIngombro;
                codiceFiltroAssociato = tmpCodiceFiltro;
                // let tmpCodice = codice;
                // let tmpInfo = info;
                // let tmpBloccato = bloccato;
                // let tmpLock = lock;
                // let tmpInfoPresenti = infoPresenti;
                // let tmpAssociato = associato;
                // let tmpElementiAssociati = elementiAssociati;

                // codice = gruppoDestinazione.codiceAssociato;
                // info = gruppoDestinazione.info;
                // bloccato = gruppoDestinazione.bloccato;
                // lock = gruppoDestinazione.lock;
                // infoPresenti = gruppoDestinazione.infoPresenti;
                // associato = gruppoDestinazione.associato;
                // elementiAssociati = gruppoDestinazione.elementiAssociati;

                // gruppoDestinazione.codiceAssociato = gruppo.codiceAssociato;
                // gruppoDestinazione.info = gruppo.info;
                // gruppoDestinazione.bloccato = gruppo.bloccato;
                // gruppoDestinazione.lock = gruppo.lock;
                // gruppoDestinazione.infoPresenti = gruppo.infoPresenti;
                // gruppoDestinazione.associato = gruppo.associato;
                // gruppoDestinazione.elementiAssociati = gruppo.elementiAssociati;

                // gruppo.codiceAssociato = tmpCodice;
                // gruppo.info = tmpInfo;
                // gruppo.bloccato = tmpBloccato;
                // gruppo.lock = tmpLock;
                // gruppo.infoPresenti = tmpInfoPresenti;
                // gruppo.associato = tmpAssociato;
                // gruppo.elementiAssociati = tmpElementiAssociati;

                if (!infoPresenti) {
                    break;
                }
            }
        }

        //adesso la mappa dovrebbe essere aggiornata
        //aggiorniamo perciò i contenuti dei box (info, codice e lock) la dove il codice in mappa non corrisponde al codice del box
        for (var j = 0; j < mappaGriglia.length; j++) {
            let gruppo = mappaGriglia[j];
            if (gruppo.box != null) {
                //se il box è bloccato lo saltiamo
                if (gruppo.bloccato) {
                    continue;
                }
                //se il codice del box è diverso da quello in mappa aggiorniamo i contenuti
                let codiceFiltroBox = this.getCodiceAssociatoConId(gruppo.box);
                if (!sameCodiceFiltro(gruppo.codiceFiltroAssociato, codiceFiltroBox)) {
                    
                    let boxItem = me.getChildBoxByLabel(gruppo.box, "info");
                    if (boxItem != null) {
                        boxItem.contents = gruppo.info != null ? gruppo.info : "";
                    }
                    let lock = me.getChildBoxByLabel(gruppo.box, "lock");
                    if (lock != null) {
                        lock.visible = gruppo.lock;
                    }
                    let codiceItem = me.getChildBoxByLabel(gruppo.box, "codice_associato", true);
                    if (codiceItem != null) {
                        if (gruppo.codiceFiltroAssociato != null) {
                            codiceItem.label = makeCodiceAssociatoLabel(gruppo.codiceFiltroAssociato.codice, gruppo.codiceFiltroAssociato.idRec);
                        }
                        else {
                            codiceItem.label = "codice_associato";
                        }
                    }

                    let ingombroItem = me.getChildBoxByLabel(gruppo.box, "segnalazione_ingombro");
                    if (ingombroItem != null) {
                        ingombroItem.visible = gruppo.ingombroSpeciale;
                    }
                }
            }
        }

        return mappaGriglia;

    },

    rimuoviDaEsclusi(codiceFiltro, pagName, svuotaTutto = false) {
        //cerchiamo in listarefAvanzati il codice e lo rimuoviamo, se la pagina è null lo rimuoviamo da tutte le pagine
        //altrimenti lo rimuoviamo solo dalla pagina specificata
        var obj = readFile(pathLavorazione + "/listaRefEscluse.json");
        if (obj != null) {
            for (var i = 0; i < obj.length; i++) {
                let pagCercata = obj[i];
                if (pagCercata.Pag == pagName || svuotaTutto) {
                    //cerchiamo il codice nella lista
                    let listaEscluse = pagCercata.listaEscluse;
                    if (listaEscluse != null && listaEscluse.length > 0) {
                        var inx = listaEscluse.findIndex(f =>
                            sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)
                        ); 
                        if (inx != -1) {
                            //rimuoviamo l'elemento dalla lista
                            listaEscluse.splice(inx, 1);
                        }
                        
                        pagCercata.listaEscluse = listaEscluse;
                    }

                    if (!svuotaTutto) {
                        break;
                    }
                }
            }
            fs.writeFileSync(pathLavorazione + "/listaRefEscluse.json", JSON.stringify(obj));
            this.mostraElementiAvanzati(pagName);
        }
        else {
            messaggioUtente("Code GRD-35 Errore: impossibile trovare il file listaRefEscluse.json", "error");
        }
    },

    terminatoSwap : false,
    annullatoSwap : false,

    setVariabiliSwap(terminato = false, annullato = false){
        this.terminatoSwap = terminato;
        this.annullatoSwap = annullato;
    },

    swap(gruppo, mappaGriglia, griglia, pageName){
        let me = this;
        //riempiamo #elementoDiPartenzaSwap con le seguenti info
        //Box: gruppo.nomeBox
        //Pagina: pageName
        //Codice: gruppo.codiceAssociato, se il codice è vuoto scriviamo "Box vuoto"
        //Info: gruppo.info, se le info non sono presenti scriviamo "Box vuoto"

        let info = gruppo.info != null ? gruppo.info : "Box vuoto";
        let codice = gruppo.codiceAssociato != null ? gruppo.codiceAssociato : "";
        let codiceScritto1 = codice != null ? codice : "Box vuoto";

        //arrotondiamo il codice a 30 caratteri
        if (codiceScritto1.length > 30) {
            codiceScritto1 = codiceScritto1.substring(0, 30) + "...";
        }
        Utility.apriModal("dialogSwap", "Clicca e seleziona il box con cui vuoi scambiare l'elemento "+codiceScritto1, false);

        let box = gruppo.nomeBox != null ? gruppo.nomeBox : "Box vuoto";

        $("#elementoDiPartenzaSwap").html(
            "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + box + "</span><br/>" +
            "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'>" + pageName + "</span><br/>" +
            "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'>" + codiceScritto1 + "</span><br/>" +
            "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'>" + info + "</span>"
        );        
        
        $("#elementoDiSelezioneSwap").html(
            "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + "Non selezionato" + "</span><br/>" +
            "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'></span><br/>" +
            "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'></span><br/>" +
            "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'></span>"
        );

        indesignEvents.setBusy(true);

        //creiamo un intervallo, l'intervallo continua a controllare cose l'utente ha selezionato, scrivendo in elementoDiSelezioneSwap
        //se l'utente ha selezionato qualsiasi cosa non sia un box scriviamo selezione non valida seguito da una spazio e il testo del box non selezionato come di default
        //se l'utente ha selezionato un box scriviamo il nome del box, la pagina, il codice associato e le info
        //se l'utente ha selezionato un box e il box è bloccato scriviamo "Box bloccato"
        //se l'utente ha selezionato un box e il box è vuoto scriviamo "Box vuoto"

        let selection = null;
        let boxSelezionato = null;
        let nomeBox = "";
        let pageNameBoxSelezionato = "";
        let codiceAssociato = null;
        let infoObj = null;
        let infoBoxSelezionato = "";
        let bloccato = false;
        let ingombro = false;
        let ingombroObjStyle = false;

        let intervalloInCorso = false;
        let interval = setInterval(function () {
            if(intervalloInCorso){
                return;
            }
            intervalloInCorso = true;
            if (!me.terminatoSwap && !me.annullatoSwap) {
                //controlliamo se l'utente ha selezionato un box
                if (app.selection[0] == selection) {
                    intervalloInCorso = false;
                    return;
                }

                selection = app.selection[0];
                if (selection != null && selection.constructor.name == "Group" && selection.label.startsWith("box_")) {
                    boxSelezionato = selection;
                    nomeBox = boxSelezionato.label;
                    pageNameBoxSelezionato = boxSelezionato.parentPage.name;
                    codiceAssociato = me.getCodiceAssociato(boxSelezionato);
                    var codiceScritto = codiceAssociato != null ? codiceAssociato : "";
                    //arrotondiamo il codice a 30 caratteri
                    if (codiceScritto.length > 30) {
                        codiceScritto = codiceScritto.substring(0, 30) + "...";
                    }
                    infoObj = me.getChildBoxByLabel(boxSelezionato, "info");
                    infoBoxSelezionato = infoObj != null ? infoObj.contents : "";
                    bloccato = me.getVisibilityLabelsBox(boxSelezionato, "no");
                    ingombro = me.getVisibilityLabelsBox(boxSelezionato, "segnalazione_ingombro");
                    if(ingombro){
                        ingombroObjStyle = me.getChildBoxByLabel(boxSelezionato, "segnalazione_ingombro").appliedObjectStyle;
                    }
                    if (bloccato) {
                        $("#elementoDiSelezioneSwap").html(
                            "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + nomeBox + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'>" + pageNameBoxSelezionato + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'>" + codiceScritto + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'>Box bloccato</span>"
                        );
                    }
                    else if (codiceAssociato == "") {
                        $("#elementoDiSelezioneSwap").html(
                            "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + nomeBox + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'>" + pageNameBoxSelezionato + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'>Box vuoto</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'>Box vuoto</span>"
                        );
                    }
                    else {
                        $("#elementoDiSelezioneSwap").html(
                            "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + nomeBox + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'>" + pageNameBoxSelezionato + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'>" + codiceScritto + "</span><br/>" +
                            "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'>" + infoBoxSelezionato + "</span>"
                        );
                    }
                    //rendiamo visibile confermaSwap
                    $("#confermaSwap").css("visibility", "visible");

                }
                else {
                    //se l'oggetto selezionato non è un box scriviamo "Selezione non valida" e il box non selezionato
                    $("#elementoDiSelezioneSwap").html(
                        "<span style='font-size: 18px; color: red;'>Box:</span> <span style='font-size: 16px; color: black;'>" + "Selezione non valida" + "</span><br/>" +
                        "<span style='font-size: 18px; color: red;'>Pagina:</span> <span style='font-size: 16px; color: black;'></span><br/>" +
                        "<span style='font-size: 18px; color: red;'>Codice:</span> <span style='font-size: 16px; color: black;'></span><br/>" +
                        "<span style='font-size: 18px; color: red;'>Info:</span> <span style='font-size: 16px; color: black;'></span>"
                    );
                    $("#confermaSwap").css("visibility", "hidden");

                }
                intervalloInCorso = false;
            }
            else if (me.annullatoSwap){
                //interrompiamo l'intervallo e settiamo le variabili a false
                clearInterval(interval);
                me.setVariabiliSwap(false, false);
                //chiudiamo il modal
                Utility.chiudiModal();
                app.selection = [griglia];
                indesignEvents.setBusy(false);
                intervalloInCorso = false;
                return;
            }
            else if(me.terminatoSwap){
                //ora dobbiamo aggiornare la mappa, inanzi tutto controlliamo se il box selezionato è alla stessa pagina del box di partenza
                let gruppoSelezionato = null;
                if (pageNameBoxSelezionato == pageName) {
                    //cerchiamo in mappa l'elemento con il codice associato come quello selezionato
                    var codiceFiltroSelezionato = me.getCodiceAssociatoConId(boxSelezionato);

                    gruppoSelezionato = mappaGriglia.find(function (f) {
                        return codiceFiltroSelezionato != null
                            ? sameCodiceFiltro(f.codiceFiltroAssociato, codiceFiltroSelezionato)
                            : f.nomeBox == nomeBox;
                    });
                    if (gruppoSelezionato == null) {
                        //errore
                        messaggioUtente("Code GRD-36 Errore: impossibile trovare il box selezionato in mappa", "error");
                        //interrompiamo l'intervallo e settiamo le variabili a false
                        clearInterval(interval);
                        me.setVariabiliSwap(false, false);
                        //chiudiamo il modal
                        Utility.chiudiModal();
                        app.selection = [griglia];
                        indesignEvents.setBusy(false);
                        intervalloInCorso = false;
                        return;
                    }
                }
                else {
                    //essendo a pagine diverse dobbiamo aggiornare i due impaginati
                    var obj = readFile(pathLavorazione + "/listaRefConteggio.json");

                    //cerchiamo le due pagine in obj, per ogni pagina cerchiamo il codice che dovrebbe essere a quella pagina
                    //se troviamo entrambi i codici allora procediamo a scambiare i dati
                    let pagCercate = [];
                    pagCercate.push(obj.find(f => f.Pag == pageName));
                    pagCercate.push(obj.find(f => f.Pag == pageNameBoxSelezionato));
                    if (pagCercate.length == 2 && pagCercate[0] != null && pagCercate[1] != null) {
                        //cerchiamo SON.parse(f.listaImpaginate).find(f => sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltro)) per entrambe le pagine
                        var listaImpaginatePagina1 = JSON.parse(pagCercate[0].listaImpaginate);
                        var listaImpaginatePagina2 = JSON.parse(pagCercate[1].listaImpaginate);

                        let codiceFiltroGruppo = gruppo.codiceFiltroAssociato;
                        let codiceFiltroSelezionato = me.getCodiceAssociatoConId(boxSelezionato);

                        var el1 = listaImpaginatePagina1.find(f =>
                            f != null &&
                            sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroGruppo)
                        );

                        var el2 = listaImpaginatePagina2.find(f =>
                            f != null &&
                            sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroSelezionato)
                        );

                        if(el1 != null && el2 != null){
                            //ora dobbiamo scambiare i dati
                            let inx1 = listaImpaginatePagina1.findIndex(f =>
                                f != null &&
                                sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroGruppo)
                            );

                            let inx2 = listaImpaginatePagina2.findIndex(f =>
                                f != null &&
                                sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroSelezionato)
                            );
                            listaImpaginatePagina1[inx1] = el2;
                            listaImpaginatePagina2[inx2] = el1;
                            //ora scriviamo i dati nel file
                            pagCercate[0].listaImpaginate = JSON.stringify(listaImpaginatePagina1);
                            pagCercate[1].listaImpaginate = JSON.stringify(listaImpaginatePagina2);
                            //ora scriviamo i dati nel file
                            fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(obj))
                        }
                        else if (el1 == null) {
                            if(gruppo.codiceAssociato == null || gruppo.codiceAssociato == ""){
                                //trasferiamo l'elemento2 alla pagina 1
                                let inx2 = listaImpaginatePagina2.findIndex(f =>
                                    f != null &&
                                    sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroSelezionato)
                                );
                                listaImpaginatePagina1.push(listaImpaginatePagina2[inx2]);
                                listaImpaginatePagina2.splice(inx2, 1);
                                //ora scriviamo i dati nel file
                                pagCercate[0].listaImpaginate = JSON.stringify(listaImpaginatePagina1);
                                pagCercate[1].listaImpaginate = JSON.stringify(listaImpaginatePagina2);
                                //ora scriviamo i dati nel file
                                fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(obj));
                            }
                            else{
                                messaggioUtente("Code GRD-37 Il dato dell'impaginato di pagina "+pageName+ " non risulta sincronizzato alla griglia, si consiglia di ripetere il conteggio per effettuare la sincronizzazione", "warning");
                            }
                        }
                        else if (el2 == null) {
                            if(codiceAssociato == null || codiceAssociato == ""){
                                //trasferiamo l'elemento1 alla pagina 2
                                let inx1 = listaImpaginatePagina1.findIndex(f =>
                                    f != null &&
                                    sameCodiceFiltro(makeCodiceFiltroFromItemRef(f), codiceFiltroGruppo)
                                ); listaImpaginatePagina2.push(listaImpaginatePagina1[inx1]);
                                listaImpaginatePagina1.splice(inx1, 1);
                                //ora scriviamo i dati nel file
                                pagCercate[0].listaImpaginate = JSON.stringify(listaImpaginatePagina1);
                                pagCercate[1].listaImpaginate = JSON.stringify(listaImpaginatePagina2);
                                //ora scriviamo i dati nel file
                                fs.writeFileSync(pathLavorazione + "/listaRefConteggio.json", JSON.stringify(obj));
                            }
                            else{
                                messaggioUtente("Code GRD-38 Il dato dell'impaginato di pagina "+pageNameBoxSelezionato+ " non risulta sincronizzato alla griglia, si consiglia di ripetere il conteggio per effettuare la sincronizzazione", "warning");
                            }
                        }
                        else {
                            if(!((gruppo.codiceAssociato == null || gruppo.codiceAssociato == "") && (codiceAssociato == null || codiceAssociato == ""))){
                                messaggioUtente("Code GRD-39 I dati dell'impaginato di pagina "+pageName+ " e "+pageNameBoxSelezionato+ " non risultano sinconizzati, si consiglia di ripetere i conteggi per effettuare la sincronizzazione", "warning");
                            }
                        }
                    }
                    else {
                        messaggioUtente("Code GRD-40 I dati di conteggio alle pagine "+pageName+ " e "+pageNameBoxSelezionato+ " risultano assenti, si consiglia di ripetere i conteggi per effettuare la sincronizzazione", "warning");
                    }
                    
                }


                //scambiamo il contenuto di codiceAssociato, info, bloccato dei due box, poi se le info sono presenti attiviamo il lock altrimenti lo disattiviamo
                let copiaCodice = gruppo.codiceAssociato;
                let copiaInfo = gruppo.info;
                let copiaBloccato = gruppo.bloccato;
                let infoPresenti = gruppo.infoPresenti;
                let ingombroSpeciale = gruppo.ingombroSpeciale;
                let copiaIdRec = gruppo.idRecAssociato;
                let copiaCodiceFiltro = gruppo.codiceFiltroAssociato;
                if (ingombroSpeciale) {
                    var ingombroObjStyleSpeciale = me.getChildBoxByLabel(gruppo.box, "segnalazione_ingombro").appliedObjectStyle;
                }

                gruppo.codiceAssociato = codiceAssociato;
                gruppo.info = infoBoxSelezionato;
                gruppo.bloccato = bloccato;
                gruppo.infoPresenti = infoBoxSelezionato != null && infoBoxSelezionato != "";
                gruppo.ingombroSpeciale = ingombro;
                gruppo.idRecAssociato = codiceFiltroSelezionato != null ? codiceFiltroSelezionato.idRec : null;
                gruppo.codiceFiltroAssociato = codiceFiltroSelezionato;


                me.setCodiceAssociato(gruppo.box, codiceFiltroSelezionato);
                me.setInfo(gruppo.box, infoBoxSelezionato);
                me.setVisibilityLabelsBox(gruppo.box, "no", bloccato);
                me.setVisibilityLabelsBox(gruppo.box, "segnalazione_ingombro", ingombro);
                if (ingombro && ingombroObjStyle != null) {
                    var gruppoIngombro = me.getChildBoxByLabel(gruppo.box, "segnalazione_ingombro");
                    gruppoIngombro.appliedObjectStyle = ingombroObjStyle;
                }

                //se le info sono presenti attiviamo il lock altrimenti lo disattiviamo
                if (infoBoxSelezionato != null && infoBoxSelezionato != "") {
                    me.setVisibilityLabelsBox(gruppo.box,"lock", true);
                    gruppo.lock = true;
                }
                else {
                    me.setVisibilityLabelsBox(gruppo.box,"lock", false);
                    gruppo.lock = false;
                }
                //ora scriviamo nel box selezionato
                me.setCodiceAssociato(boxSelezionato, copiaCodiceFiltro); 
                me.setInfo(boxSelezionato, copiaInfo);
                me.setVisibilityLabelsBox(boxSelezionato, "no", copiaBloccato);
                me.setVisibilityLabelsBox(boxSelezionato, "segnalazione_ingombro", ingombroSpeciale);
                //se le info sono presenti attiviamo il lock altrimenti lo disattiviamo
                if (copiaInfo != null && copiaInfo != "") {
                    me.setVisibilityLabelsBox(boxSelezionato, "lock", true);
                }
                else {
                    me.setVisibilityLabelsBox(boxSelezionato, "lock", false);
                }

                if(ingombroSpeciale && ingombroObjStyleSpeciale != null){
                    var gruppoIngombroSpeciale = me.getChildBoxByLabel(boxSelezionato, "segnalazione_ingombro");
                    gruppoIngombroSpeciale.appliedObjectStyle = ingombroObjStyleSpeciale;
                }


                //se gruppoSelezionato è != null allora dobbiamo scrivere le info copiate in lui
                if (gruppoSelezionato != null) {
                    gruppoSelezionato.codiceAssociato = copiaCodice;
                    gruppoSelezionato.info = copiaInfo;
                    gruppoSelezionato.bloccato = copiaBloccato;
                    gruppoSelezionato.infoPresenti = infoPresenti;
                    gruppoSelezionato.lock = infoPresenti; //se il box ha delle info lo lockiamo nella nuova posizione
                    gruppoSelezionato.ingombroSpeciale = ingombroSpeciale;
                    gruppoSelezionato.idRecAssociato = copiaIdRec;
                    gruppoSelezionato.codiceFiltroAssociato = copiaCodiceFiltro;
                }

                clearInterval(interval);
                me.setVariabiliSwap(false, false);
                //chiudiamo il modal
                Utility.chiudiModal();
                app.selection = [griglia];
                indesignEvents.setBusy(false);
                intervalloInCorso = false;
                me.compilaGriglia(griglia, mappaGriglia);
            }
        }, 100);

    },


    parseCodiceAssociato(raw) {
        if (raw == null || raw === "") {
            return null;
        }

        var value = raw.toString();
        var parts = value.split("$");

        // label intera: codice_associato$CODICE$IDREC
        if (parts.length === 3 && parts[0] === "codice_associato") {
            return {
                codice: parts[1],
                idRec: parseInt(parts[2])
            };
        }

        // valore raw restituito vecchio/stile getCodiceAssociato: CODICE$IDREC
        if (parts.length === 2) {
            return {
                codice: parts[0],
                idRec: parseInt(parts[1])
            };
        }

        throw new Error("Formato codice_associato non valido: " + value);
    },

    getCodiceFiltroKey(itemRef) {
        var filtro = makeCodiceFiltroFromItemRef(itemRef);
        return filtro.codice + "$" + filtro.idRec;
    },

    // #endregion
};

module.exports = griglia;
