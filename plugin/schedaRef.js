
const InputEditController = require('./InputEditController');
const XMLHttpRequestClient = require('./XMLHttpRequestClient');
const DataCaricamentoFoto = require('./dataCaricamentoFoto');
const NoRenderElementi = require('./noRenderElementi');
const RicollegaEsiti = require('./ricollegaEsiti');
const variantiDescrizione = require('./variantiDescrizione');
const trattiDescrizione = require('./trattiDescrizione');

const schedaRef = {
    refSelected: null,
    multiSelection: null,
    schedeRefDati: [],
    //Stato del modal noRender: la lista degli elementi del box con la loro opzione di rendering.
    elementiNoRenderDelBox: null,
    //I20-978: com'erano le foto quando il modal si e' aperto, per sapere al salvataggio se
    //qualcosa e' cambiato e vale la pena proporre il fix foto.
    statoFotoAllApertura: null,
    //I20-980: indirizzo della miniatura estratta da un psd, da liberare alla scelta successiva.
    urlAnteprimaPsd: null,
    multiSchedeRef: [],
    editRefFieldController: null,
    idRecordLavorazione: 0,
    addestramentoCampi: null,
    salvaCambioStrutturaleButton: null,
    isInvalidated: false,
    isBusy: false,

    selezioneClonazioneCorrente: null,

    //I20-992: la pre analisi del box si fa una volta sola, all'apertura della scheda, e da
    //li' in poi si legge questa copia. Tornare alla schermata di edit da foto o struttura
    //non la rifa': prima ripartiva a ogni ritorno, e su box pesanti si aspettava ogni volta.
    //null vuol dire "non ancora fatta per questa scheda"; la svuota svuotaRef.
    segnalazioniDelBox: null,

    //I20-992: le referenze per cui l'operatore ha chiesto di non rivedere le segnalazioni, e
    //l'interruttore che le silenzia tutte. Vivono in memoria e basta: riavviare il plugin o
    //InDesign le riporta a zero, come chiede la issue. Non passano da svuotaRef, altrimenti
    //riaprire la stessa scheda le farebbe tornare e il silenzio non sarebbe silenzio.
    refConSegnalazioniSilenziate: [],
    segnalazioniSilenziateOvunque: false,

    //I20-992: se la finestra si e' gia' proposta da sola per la scheda aperta. Proporla una
    //volta e' un avviso, riproporla a ogni ritorno alla schermata di edit e' un ostacolo:
    //l'operatore torna dalle foto, o riapplica la descrizione, e se la ritrova davanti. Il
    //segnalino intanto resta, e da li' si riapre a mano quando serve. Vale per la scheda
    //aperta: svuotaRef la rimette disponibile, perche' la scheda dopo e' un'altra cosa.
    modalSegnalazioniGiaProposto: false,



    tipiFotoExtra: [{ val: 2, nome: "Bollini" }, { val: 3, nome: "Loghi" }, { val: 4, nome: "Foto ambientate" }, { val: 5, nome: "Sfondo" }],
    constructor() {


    },

    setInvalidated(value) {
        if (value != true) {
            value = false;
        }
        this.isInvalidated = value;
    },


    setBusy(value) {
        if (value != true) {
            value = false;
        }
        this.isBusy = value;
    },

    //I20-981 (Lotto 4a): dal Report Integrita' si arriva a questa scheda, ed e' questa scheda,
    //mostrata al posto del report: non una copia, che vorrebbe dire duplicare il markup di
    //index.html e i suoi id, cioe' due schede che col tempo si allontanano. Quello che cambia
    //e' solo cosa resta raggiungibile, e sono le regole qui sotto.

    //Dalla scheda aperta dal report non si naviga altrove: gli eventi del plugin restano
    //fermi, e il resto dell'interfaccia non sarebbe governato da nessuno.
    DAL_REPORT_VOCI_BARRA_NASCOSTE: ["homeImage", "menaboTab", "grigliaTab", "utilityImage", "artworkTab", "raggruppaImage"],

    //Sgruppa e Struttura restano fuori: cambiano la composizione del gruppo, e non e' quello
    //che si viene a fare da qui.
    DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE: ["Tab8", "Tab13"],

    //Vero mentre la scheda e' stata aperta dal Report Integrita'. Lo accende e lo spegne il
    //report; la scheda lo legge soltanto, per sapere cosa non deve offrire.
    apertaDalReport: false,

    /// Le azioni strutturali offerte dalla schermata di edit non si mostrano quando si arriva
    /// dal report: da li' si viene a sistemare una segnalazione, e rifare la struttura del
    /// gruppo e' un'altra cosa, che si fa dalla scheda normale.
    mostraAzioniStrutturaliInEdit() {
        return this.apertaDalReport !== true;
    },

    /// Il primario del gruppo e il suo tracciato: la regola del sottogruppo e' la stessa che
    /// usa la preanalisi, se c'e' comanda lui. Altrimenti si allineerebbe il box a un dato
    /// diverso da quello con cui viene giudicato.
    tracciatoDelPrimario(records) {
        const primario = (records || []).find(
            r => r != null && r.recordInTracciato != null && r.recordInTracciato["StatoSelezione"] == 1);

        if (primario == null) {
            return null;
        }

        return primario.sottogruppo ? primario.sottogruppo : primario.recordInTracciato;
    },

    /// Il campo compilato della descrizione per il primario della scheda caricata. E'
    /// esattamente cio' con cui il Report Integrita' confronta il box, quindi riportarlo nel
    /// box allinea le due cose per costruzione.
    campoDescrizioneCompilatoDelPrimario(records) {
        const tracciato = this.tracciatoDelPrimario(records);
        const campi = (tracciato != null && tracciato.compiledFields) || [];

        const campo = campi.find(
            c => c != null && String(c.labelName || "").toLowerCase() === "descrizione");

        return campo != null && campo.content ? campo : null;
    },

    descrizioneCompilataDelPrimario(records) {
        const campo = this.campoDescrizioneCompilatoDelPrimario(records);
        return campo != null ? campo.content : null;
    },

    /// Del verdetto della preanalisi si guarda solo il campo che stiamo per riscrivere. La
    /// preanalisi giudica tutto il box e non i soli campi che le passi: le foto extra che
    /// stanno nel box e non nell'elenco che le hai dato risultano tutte in piu', e gli
    /// elementi nascosti rimessi visibili diventano segnalazioni loro. Sono cose vere, ma che
    /// riscrivere la descrizione non aggiusta: offrire il pulsante per quelle sarebbe una
    /// promessa che non manteniamo.
    differenzaDaAllineare(differenze, labelName) {
        const etichetta = String(labelName || "").toLowerCase();

        if (etichetta === "") {
            return false;
        }

        return (differenze || []).some(differenza => {
            if (differenza == null) {
                return false;
            }

            if (String(differenza.label || "").toLowerCase() !== etichetta) {
                return false;
            }

            //Il testo o il suo stile: tutti e due si allineano riscrivendo il campo, perche' il
            //contenuto del server si porta dietro gli stili di carattere. Un campo che nel box
            //non c'e' proprio non si aggiusta scrivendoci dentro.
            return differenza.difference === "contenuto" || differenza.difference === "paragrafo";
        });
    },

    /// Il box dice una descrizione diversa da quella del server? Non lo decidiamo qui: lo
    /// chiediamo alla stessa preanalisi che usa il Report Integrita', sul solo campo della
    /// descrizione. Cosi' il pulsante si offre esattamente quando il report si lamenterebbe,
    /// e non compare quando non c'e' niente da allineare.
    async descrizioneDisallineata(records, box) {
        const campo = this.campoDescrizioneCompilatoDelPrimario(records);

        if (campo == null || box == null) {
            return false;
        }

        try {
            if (!box.isValid) {
                return false;
            }

            const tracciato = this.tracciatoDelPrimario(records);

            const preAnalisi = await confronti.confrontoBoxCompiledFieldPreAnalisi(
                box,
                [campo],
                [],
                [],
                null,
                null,
                false,
                NoRenderElementi.elencoPerSegnalazioni(tracciato.noRenderElementi, tracciato.membriGruppoFoto)
            );

            return this.differenzaDaAllineare(
                preAnalisi != null ? preAnalisi.differenze : null, campo.labelName);
        }
        catch (error) {
            //Se non riusciamo a giudicare, il pulsante si offre lo stesso: proporre un
            //allineamento che non serviva costa un clic, nasconderlo quando serviva costa una
            //segnalazione che l'operatore non sa come togliersi.
            console.error("Allineamento della descrizione non verificabile:", error);
            return true;
        }
    },

    /// La ref che initSchedaRef si aspetta, composta dal box e dal suo dna: la stessa forma
    /// che prepara l'evento di selezione, perche' da li' in poi il flusso deve essere uno solo.
    refDalBoxPerReport(box, dna, contesto) {
        if (box == null || dna == null) {
            return null;
        }

        const dati = contesto || {};

        return {
            pag: dati.pagina != null ? dati.pagina : -1,
            pagRef: dati.paginaRef != null ? dati.paginaRef : null,
            item: box,
            boxOriginalBounds: dati.bounds != null ? dati.bounds : null,
            codice: dna.codice,
            codiceGruppo: dna.codice_gruppo,
            idRec: dna.idRec,
            meccanica: dna.box
        };
    },

    /// Il box su cui la scheda sta lavorando va ripreso: reimpagina e cambi strutturali ne
    /// creano uno nuovo e il vecchio decade, e con gli eventi fermi nessuno ripunta la scheda.
    serveRiaggancioDalReport(box) {
        if (box == null) {
            return true;
        }

        try {
            return box.isValid !== true;
        }
        catch (err) {
            //Un box che non risponde nemmeno su isValid e' un box perso.
            return true;
        }
    },

    initSchedaRef(ref) {
        try {


            console.log("INIRT SCHEDA REF - BUSY " + this.isBusy);
            if (this.isBusy) {
                messaggioUtente("Code SRF-01 Scheda occupata", "error", false, 3);
                hideLoading();
                return;
            }
            let me = this;
            this.addestramentoCampi = null;

            this.svuotaRef();
            this.setInvalidated(false);
            me.refSelected = ref;

            console.log("SET BUSY TRUE")
            this.setBusy(true);
            indesignEvents.setBusy(true);

            //$("#editReferenza").empty();

            //cerchiamo in listaKit l'elemento con codice uguale a refSelected.codice
            // var file = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
            // if (file != null) {
            // var item = file.records.find(f => f.recordInTracciato["Referenza.Codice"] == me.refSelected.codice);
            // console.log(item);
            // if (item != null) {

            me.getSchedaRef(me.refSelected.codiceGruppo, (error, schedaRef) => {
                //writeDebugMessageForCrash("Scheda ref RESULT Returned");

                console.log("Scheda ref RESULT Returned");
                console.log(error);
                if (me.isInvalidated) {
                    //writeDebugMessageForCrash("La scheda 1 ref non è più valida");
                    console.warn("La scheda ref non è più valida");
                    messaggioUtente("Code SRF-02 La scheda ref non è più valida", "error");
                    hideLoading();
                    //writeDebugMessageForCrash("SetBusy false per invalidated");
                    me.setBusy(false);
                    //writeDebugMessageForCrash("Settato busy false per invalidated");
                    return;
                }
                console.log("step1");
                if (error != null) {
                    console.error("Errore durante la richiesta:", error);
                    messaggioUtente("Code SRF-03 Errore generico durante la richiesta", "error");
                    hideLoading();
                    me.setBusy(false);
                    return;
                }
                console.log("step2");
                if (schedaRef.error != null && schedaRef.error != "") {
                    if (schedaRef.errorCode == 8) {
                        me.selectSchedaRef(6);
                        jsIndexControls.changeSubMenu($("#refImage").attr("subTab"));
                        jsIndexControls.changeImage($("#refImage"));
                        return;
                    }
                    else {
                        console.error("Errore durante la richiesta:", schedaRef.error);
                        messaggioUtente("Code SRF-04 Errore sul server durante la richiesta: " + schedaRef.error, "error");
                        hideLoading();
                        me.setBusy(false);
                        return;
                    }
                }
                if (schedaRef.warn != null && schedaRef.warn != "") {
                    console.warn("Warn durante la richiesta:", schedaRef.warn);
                }
                console.log("step3");
                console.log(me.refSelected);
                if (!me.refSelected.item.isValid) {
                    console.log("step3_1");
                    //writeDebugMessageForCrash("La scheda ref non è più valida");
                    me.setInvalidated(true);
                    console.warn("La scheda 2 ref non è più valida");
                    messaggioUtente("Code SRF-02 La scheda ref non è più valida", "error");
                    hideLoading();
                    //writeDebugMessageForCrash("SetBusy false per invalidated 2");
                    me.setBusy(false);
                    //writeDebugMessageForCrash("Settato busy false per invalidated 2");
                    return;

                }

                console.log("Risultato ottenuto:");
                console.log(schedaRef);
                // Puoi ora usare `schedaRef` qui

                // me.setBusy(false);
                // console.log("SET BUSY FALSE");
                //writeDebugMessageForCrash("Scheda ref ottenuta correttamente");

                me.schedeRefDati = schedaRef.records;
                me.idRecordLavorazione = schedaRef.idRecInLavorazione;
                me.selectSchedaRef(1);
                jsIndexControls.changeSubMenu($("#refImage").attr("subTab"));
                jsIndexControls.changeImage($("#refImage"));
            }, me.refSelected.idRec);
            // }
            // else {
            //     messaggioUtente("Elemento " + me.refSelected.codice + " non trovato nel tracciato", "error");
            //     indesignEvents.setBusy(false);
            //     hideLoading();
            // }
            // }
            // else {
            //     messaggioUtente("Errore durante la lettura del file listaKit" + idKitLavorazione + ".json", "error");
            //     indesignEvents.setBusy(false);
            //     hideLoading();
            // }

        } catch (error) {

            indesignEvents.setBusy(false);

            console.log(error);
            messaggioUtente("Code SRF-05 Errore generico durante l'inizializzazione della scheda ref: " + error.message, "error");
            hideLoading();
            me.setBusy(false);
        }
        finally {
            indesignEvents.setBusy(false);
        }
    },

    async initMultiSchedaRef(refs) {
        showLoading("Caricamento scheda...");
        try {
            let me = this;
            me.multiSelection = refs;
            me.multiSchedeRef = [];
            indesignEvents.setBusy(true);
            var listaCodiciGruppo = [];
            var listaIdRec = [];
            $("#editReferenza").empty();
            for (let i = 0; i < refs.length; i++) {
                listaCodiciGruppo.push(refs[i].codiceGruppo);

                var idRec = null;
                if (refs[i].idRec != null && refs[i].idRec !== "" && !isNaN(parseInt(refs[i].idRec))) {
                    idRec = parseInt(refs[i].idRec);
                }
                else if (refs[i].IdRec != null && refs[i].IdRec !== "" && !isNaN(parseInt(refs[i].IdRec))) {
                    idRec = parseInt(refs[i].IdRec);
                }

                listaIdRec.push(idRec);
            }

            await getSchedeRefsMassivo(listaCodiciGruppo, listaIdRec, function (error, schedeRefs) {
                if (error) {
                    console.error("Errore durante la richiesta:", error);
                    messaggioUtente("Code SRF-03 Errore generico durante la richiesta: " + error.message, "error");
                    hideLoading();
                    return;
                }

                console.log("Risultato ottenuto:", schedeRefs);
                // Puoi ora usare `schedaRef` qui

                me.multiSchedeRef = [];
                schedeRefs.forEach(schedaRef => {
                    me.multiSchedeRef.push(schedaRef.records);
                });

                $("#raggruppaImage").show();
                var listaCodiciConId = me.getCodiciConIdFromMultiSelection(me.multiSelection);
                $("#raggruppa").attr("codiciConId", encodeURIComponent(JSON.stringify(listaCodiciConId)));
                me.SchermataRaggruppamento();
            });
        }
        catch (error) {

            indesignEvents.setBusy(false);

            console.log(error);
            hideLoading();
        }
        finally {
            indesignEvents.setBusy(false);
        }
    },

    getSchedaRef(codiceGruppo, callback, idRec = 0) {
        let me = this;

        var xhr = new XMLHttpRequestClient();

        xhr.onload = async (objResult, parsed) => {
            try {

                if (me.isInvalidated) {
                    console.warn("La scheda ref non è più valida");
                    callback("La scheda ref non è più valida", null);
                    return;
                }

                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code SRF-06 Errore durante il parsing della risposta: " + e.message, "error");
                        return;
                    }
                }
                // Chiamata alla callback con il risultato ottenuto
                if (callback) {
                    try {
                        callback(null, objResult); // Passiamo `null` come primo argomento per indicare che non c'è errore
                    } catch (e) {
                        console.error(e);
                        messaggioUtente("Code SRF-07 Errore generico durante l'elaborazione del risultato: " + e.message, "error");
                        this.isBusy = false;
                    }
                }
            } catch (e) {
                // Gestione dell'errore e chiamata alla callback con l'errore
                if (callback) {
                    callback(e, null);
                }
            }
        };

        xhr.onerror = function (e) {
            // Gestione degli errori di rete e chiamata alla callback con l'errore
            if (callback) {
                callback(e, null);
            }
        };

        // Esegui la richiesta GET
        var formData = new FormData();
        formData.append("codiceGruppo", codiceGruppo);
        formData.append("idRec", idRec);

        xhr.send("Menabo/getSchedaRef/" + idKitLavorazione + "/" + false, formData, "PUT");
    },

    async selectSchedaRef(enumSchede) {
        console.log("SELECT SCHEDA REF " + enumSchede);
        //writeDebugMessageForCrash("SELECT SCHEDA REF " + enumSchede);

        let me = this;
        if (enumSchede != 6) {
            //in questo caso la scheda ref non c'è ed è normale perchè dobbiamo ricollegarla
            if (this.refSelected == null || this.schedeRefDati.length == 0) {

                me.setBusy(false);
                console.log("SET BUSY FALSE");

                hideLoading();
                return;
            }
        }
        switch (enumSchede) {
            case 1:
                await me.attivaSchermateReferenza(this.refSelected.meccanica, this.refSelected.item, this.refSelected.pagRef);
                break;
            case 2:
                me.EditFotoPrimarieSecondarie(this.refSelected.item);
                break;
            case 3:
                me.FotoExtraPanel(this.refSelected.item);
                break;
            case 4:
                me.suddividiGruppo();
                break;
            case 5:
                me.CambiaStrutturaDato(this.refSelected.item);
                break;
            case 6:
                me.interfacciaRicollegamentoBoxImpaginato(this.refSelected.item);
                break;
            default:
                console.error("Scheda non trovata");
                break;
        }

        me.setBusy(false);
        console.log("SET BUSY FALSE");
    },

    interfacciaRicollegamentoBoxImpaginato(box) {
        this.resetInitSchedaRef();
        var dna = Utility.getDnaOfBox(box);
        if(dna == null){
            messaggioUtente("Code SRF-17.5 Impossibile ricollegare il box, non è stato possibile leggere il dna del box.", "error");
            return;
        }
        //leggiamo il codice gruppo dalla base
        var codice = dna.codice_gruppo;

        this.componiTitoloCodice(codice);

        //creiamo un piccolo pulsante da appendere a $("#editReferenza") con scritto ricollega, sopra una didascalia con scritto "Il box non risulta al momento impaginato, tentare il ricollegamento?"
        var ricollegaButton = $('<sp-action-button id="ricollegaButton" style="color:lightgreen; margin-top:10px;">Ricollega</sp-action-button>');
        $("#editReferenza").append('<div style="color:white; margin-top:10px;">Il box non risulta al momento impaginato, tentare il ricollegamento?</div>');
        $("#editReferenza").append(ricollegaButton);

        ricollegaButton.on("click", async function () {
            schedaRef.ricollegaBoxImpaginato(box);
        });

        indesignEvents.setBusy(false);
        hideLoading();
        onresizeWindow();

    },

    async ricollegaBoxImpaginato(box, externalCall = false, codiceGruppo = null) {
        try {
            var dna = null;
            if(box != null && box.isValid){
                dna = Utility.getDnaOfBox(box);
            }
            //se il codiceGruppo è definito vuol dire che non abbiamo un box di riferimento
            if (dna == null /*codiceGruppo == null */) {
                //controlliamo se box è valido
                if (box!=null && !box.isValid) {
                    //proviamo a guardare se his.refSelected.item è valido
                    if (this.refSelected.item.isValid) {
                        box = this.refSelected.item;
                        dna = Utility.getDnaOfBox(box);
                    }
                    else {
                        //infine controlliamo come ultima risorsa la selezione dell'utente, se è un singolo elemento e se è valido lo prendiamo come box
                        if (app.selection.length == 1 && app.selection[0].isValid) {
                            box = app.selection[0];
                            dna = Utility.getDnaOfBox(box);
                        }
                        else {
                            console.error("Code SRF-08 Impossibile ricollegare il box, non è stato possibile identificare il box da ricollegare. Deselezionare e riselezionare solo il box interessato.");
                            messaggioUtente("Code SRF-08 Impossibile ricollegare il box, non è stato possibile identificare il box da ricollegare. Deselezionare e riselezionare solo il box interessato.", "error");
                            return;
                        }
                    }
                }
    
                //controlliamo se box ha la base
                // var base = Utility.getFieldByLabel("base", box);
                // if (base == null) {
                //     console.error("Code SRF-09 Impossibile ricollegare il box, non è stata trovata la base nell'elemento selezionato.");
                //     messaggioUtente("Code SRF-09 Impossibile ricollegare il box, non è stata trovata la base nell'elemento selezionato.", "error");
                //     return;
                // }
    
                // //leggiamo il codice gruppo dalla base
                // var codiceGruppo = base.label.split("$")[3];
                // if (codiceGruppo == null || codiceGruppo == "") {
                //     console.error("Code SRF-10 Impossibile ricollegare il box, non è stato possibile leggere il codice gruppo dalla base.");
                //     messaggioUtente("Code SRF-10 Impossibile ricollegare il box, non è stato possibile leggere il codice gruppo dalla base.", "error");
                //     return;
                // }
            }

            codiceGruppo = codiceGruppo != null ? codiceGruppo : dna.codice_gruppo;

            //chiediamo conferma all'utente se vuole ricollegare il box al codice letto
            if (externalCall || await Utility.confirm("Ricollegare il box al codice gruppo " + codiceGruppo + "?")) {
                if(!externalCall){
                    indesignEvents.setBusy(true);
                    showLoading("Ricollegamento in corso...");
                }
                // Logica per ricollegare il box
                var xhr = new XMLHttpRequestClient();
                xhr.onload = async (objResult, parsed) => {
                    try {
                        console.log(objResult);
                        if (!parsed) {
                            objResult = JSON.parse(objResult);
                        }
                        if (objResult.error != null && objResult.error != "") {
                            messaggioUtente("Code SRF-13 Ricollegamento fallito: " + objResult.error, "error");
                            console.error("Code SRF-13 Ricollegamento fallito: " + objResult.error);
                        }
                        
                        if (objResult.codici.length > 0){
                            var element = objResult.codici[0];
                            var allElementGruppo = objResult.codici;

                            //I20-986: si riferisce l'esito di ogni elemento, non solo del primo, e
                            //soprattutto si mostra l'errore che il server scrive dentro al singolo:
                            //prima veniva letto solo l'errore generale, e un ricollegamento fallito
                            //passava per riuscito con la scheda che si aggiornava come se nulla fosse.
                            for (var iEsito = 0; iEsito < allElementGruppo.length; iEsito++) {
                                var avviso = RicollegaEsiti.messaggioPerElemento(allElementGruppo[iEsito]);
                                if (avviso != null) {
                                    messaggioUtente(avviso.testo, avviso.tipo, false, 5);
                                    if (avviso.tipo === "error") {
                                        console.error(avviso.testo);
                                    }
                                }
                            }

                            if(element.stato == 1 || element.stato == 2 || element.stato == 3){
                                if (!externalCall && box != null && box.isValid) {
                                    var idRec = dna.idRec;
                                    if (objResult.idRecSelezionato != null && objResult.idRecSelezionato != 0 && objResult.idRecSelezionato != idRec) {
                                        dna.idRec = objResult.idRecSelezionato.toString();
                                        this.refSelected.idRec = objResult.idRecSelezionato;
                                        if (dna.item != null) {
                                            let labelParts = dna.item.label.split("$");
                                            if (dna.oldBoxFormat) {
                                                if (labelParts.length > 4) {
                                                    labelParts[4] = objResult.idRecSelezionato.toString();
                                                    dna.item.label = labelParts.join("$");
                                                }
                                            }
                                            else {
                                                if (labelParts.length > 5) {
                                                    labelParts[5] = objResult.idRecSelezionato.toString();
                                                    dna.item.label = labelParts.join("$");
                                                }
                                            }
                                        }
                                    }

                                    this.initSchedaRef(this.refSelected);
                                }
                            }
                            else if (element.stato == 5){
                                //il messaggio l'ha gia' dato il giro sugli esiti
                            }
                            else if (element.stato == 7){
                                var skipImpaginazione = codiceGruppo != null;
                                this.gestisciRichiestaClonazione(element, objResult.idLavorazione, allElementGruppo, skipImpaginazione);
                            }
                        }

                        if (!externalCall) {
                            indesignEvents.setBusy(false);
                            hideLoading();
                        }
                    }
                    catch (e) {
                        indesignEvents.setBusy(false);
                        hideLoading();
                        messaggioUtente("Code SRF-14 Errore durante il parsing della risposta:" + e, "error");
                        return;
                    }
                }

                xhr.onreadystatechange = function () {
                    console.log(xhr);
                };

                xhr.onerror = function () {
                    indesignEvents.setBusy(false);
                    hideLoading();
                    console.log("error");
                };
                //creiamo un formData con codiceGruppo e il nome della pagina a cui si trova il box
                var canaleObj = ficoProcess.getCanaleLavorazioneCorrente();
                var canale = canaleObj != null ? canaleObj.sigla : "";
                var areaObj = ficoProcess.getAreaLavorazioneCorrente();
                var area = areaObj != null ? areaObj.sigla : "";

                var idRec = (dna!=null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) ? parseInt(dna.idRec) : 0;
                // if (box != null && box.isValid) {
                //     try {
                //         var dna = Utility.getDnaOfBox(box);
                //         if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                //             idRec = parseInt(dna.idRec);
                //         }
                //     }
                //     catch (e) {
                //         console.warn("Impossibile recuperare idRec durante ricollegaBox, uso 0", e);
                //     }
                // }
                

                //I20-986: un box appoggiato fuori dalla pagina non ha una pagina, e chiederne il
                //nome faceva fallire tutto con l'errore generico, che non dice cosa fare. Si
                //riconosce il caso e lo si dice.
                var nomePagina = "1";
                if (box != null) {
                    var paginaDelBox = null;
                    try { paginaDelBox = box.parentPage; } catch (e) { paginaDelBox = null; }

                    if (paginaDelBox == null) {
                        indesignEvents.setBusy(false);
                        hideLoading();
                        messaggioUtente("Code SRF-18 Il box non si trova su una pagina del documento: spostalo nella pagina in cui deve stare e riprova il ricollegamento.", "error");
                        console.error("Code SRF-18 Box fuori pagina durante il ricollegamento del codice " + codiceGruppo);
                        return;
                    }

                    nomePagina = paginaDelBox.name;
                }

                var formData = new FormData();
                var request = {
                    idLavorazione: idKitLavorazione,
                    canaleDiPartenza: canale,
                    areaDiPartenza: area,
                    rangePagine: nomePagina,
                    elementoDaRicollegare: {
                        codiceGruppo: codiceGruppo,
                        idRec: idRec,
                        pag: nomePagina,
                        forzaloAllaPaginaIndicata: true,
                    }
                }

                formData.append("stringRequest", JSON.stringify(request));
                xhr.send("Menabo/ricollegaBox", formData, "PUT");

            }

        }
        catch (e) {
            indesignEvents.setBusy(false);
            hideLoading();
            console.error("Code SRF-15 Si è verificato un errore durante il ricollegamento del box: " + e);
            messaggioUtente("Code SRF-15 Si è verificato un errore generico durante il ricollegamento del box: " + e.message, "error");
        }
    },

    gestisciRichiestaClonazione(element, idKitLavorazione, allElementGruppo, skipImpaginazione) {
        var me = this;

        me.preparaContenutoKitPerClonazione(idKitLavorazione, function (ok) {
            if (!ok) {
                messaggioUtente("Code SRF-16 Impossibile recuperare la lista del kit in lavorazione", "error", false, 5);
                return;
            }

            me.apriEMontaDialogClonaRecord(element, idKitLavorazione, allElementGruppo, skipImpaginazione);
        });
    },

    preparaContenutoKitPerClonazione(idKitLavorazione, callback) {
        var primoRecordKit = null;

        function getPrimoRecordDaGlobale() {
            if (
                typeof contenutoKitInLavorazione !== "undefined" &&
                contenutoKitInLavorazione &&
                contenutoKitInLavorazione.records &&
                Array.isArray(contenutoKitInLavorazione.records) &&
                contenutoKitInLavorazione.records.length > 0
            ) {
                return contenutoKitInLavorazione.records[0];
            }
            return null;
        }

        // 1) già disponibile
        primoRecordKit = getPrimoRecordDaGlobale();
        if (primoRecordKit) {
            callback(true);
            return;
        }

        // 2) provo a rileggere
        leggiContenutoKit(idKitLavorazione, true);

        primoRecordKit = getPrimoRecordDaGlobale();
        if (primoRecordKit) {
            callback(true);
            return;
        }

        // 3) provo a scaricare
        scaricaContenutoKit(idKitLavorazione, true, function () {
            leggiContenutoKit(idKitLavorazione, true);

            primoRecordKit = getPrimoRecordDaGlobale();
            if (primoRecordKit) {
                callback(true);
                return;
            }

            callback(false);
        }, true);
    },

    apriEMontaDialogClonaRecord(element, idKitLavorazione, allElementGruppo, skipImpaginazione) {
        selezioneClonazioneCorrente = null;
        var datiClonazione = element.riscontriInAltriTracciati || {};
        var suggeriti = this.costruisciSuggeritiAccorpati(datiClonazione);
        var tuttiRiscontri = Array.isArray(datiClonazione.tuttiRiscontri) ? datiClonazione.tuttiRiscontri : [];

        this.salvaSelezioneClonazione(null);

        Utility.apriModal("dialogClonaRecord", "Clona");

        this.montaBodyDialogClonaRecord(suggeriti, tuttiRiscontri, element, idKitLavorazione);
        this.montaFooterDialogClonaRecord(element, idKitLavorazione, allElementGruppo, skipImpaginazione);
    },

    costruisciSuggeritiAccorpati(datiClonazione) {
        let me = this;
        var mappaEtichette = {
            piuRecente: "più recente",
            stessaArea: "stessa area",
            stessaPromo: "stessa promo",
            stessoCanale: "stesso canale",
            stessoCanaleArea: "stesso canale e area"
        };

        var ordineLabel = ["piuRecente", "stessaPromo", "stessoCanaleArea", "stessaArea", "stessoCanale"];

        var gruppi = {};
        var output = [];

        ordineLabel.forEach(function (chiave) {
            var item = datiClonazione[chiave];
            if (!item) return;

            var keyUnivoca = (item.idPromo || "") + "_" + (item.idTracciato || "");
            if (!gruppi[keyUnivoca]) {
                gruppi[keyUnivoca] = {
                    key: keyUnivoca,
                    item: item,
                    labels: []
                };
                output.push(gruppi[keyUnivoca]);
            }

            gruppi[keyUnivoca].labels.push(mappaEtichette[chiave]);
        });

        output.forEach(function (g) {
            g.labelCompatta = me.compattaLabelSuggerite(g.labels);
        });

        return output;
    },

    compattaLabelSuggerite(labels) {
        if (!labels || labels.length === 0) return "";

        if (labels.length === 1) return labels[0];
        if (labels.length === 2) return labels[0] + " e " + labels[1];

        return labels.slice(0, labels.length - 1).join(", ") + " e " + labels[labels.length - 1];
    },

    montaBodyDialogClonaRecord(suggeriti, tuttiRiscontri, element, idKitLavorazione) {
        var $body = $("#bodyClonaRecord");
        $body.empty();
        let me = this;

        var html = "";
        html += "<div class='clona-record-wrapper' style='height:100%; display:flex; flex-direction:column; gap:8px; padding:10px; box-sizing:border-box; overflow:hidden;'>";

        html += "  <div style='padding:8px 10px; background:#f5f7fa; border:1px solid #d9e1ea; border-radius:8px; flex:0 0 auto;'>";
        html += "      <div style='font-size:16px; font-weight:bold; margin-bottom:2px;'>Da dove clonare</div>";
        html += "      <div style='font-size:12px; color:#666; line-height:1.3;'>Seleziona un suggerimento oppure scegli manualmente da tutti i riscontri trovati.</div>";
        html += "  </div>";

        html += "  <div id='clonaRecordSuggeritiContainer' style='display:flex; flex-wrap:wrap; gap:8px; flex:0 0 auto; align-content:flex-start;'></div>";

        html += "  <div style='padding:10px; border:1px solid #dcdcdc; border-radius:8px; background:#fff; flex:0 0 auto;'>";
        html += "      <div style='font-weight:bold; font-size:12px; margin-bottom:6px;'>Tutti i riscontri</div>";
        html += "      <select id='selectTuttiRiscontriClona' style='width:100%; padding:7px 8px; box-sizing:border-box;'>";
        html += "          <option value=''>Nessuna selezione</option>";
        html += "      </select>";
        html += "  </div>";

        html += "  <div id='clonaRecordDettaglioSelezione' style='flex:1 1 auto; min-height:90px; overflow:auto; padding:10px; border:1px solid #dcdcdc; border-radius:8px; background:#fcfcfc;'>";
        html += "      <div style='color:#777; font-size:12px;'>Nessun elemento selezionato.</div>";
        html += "  </div>";

        html += "</div>";

        $body.html(html);

        me.renderSuggeritiClona(suggeriti);
        me.renderSelectTuttiRiscontri(tuttiRiscontri);
        me.bindEventiDialogClonaRecord(suggeriti, tuttiRiscontri, element, idKitLavorazione);
    },

    renderSuggeritiClona(suggeriti) {
        let me = this;
        var $container = $("#clonaRecordSuggeritiContainer");
        $container.empty();

        if (!suggeriti || suggeriti.length === 0) {
            $container.append(
                "<div style='padding:10px; border:1px dashed #ccc; border-radius:8px; color:#777; background:#fafafa; font-size:12px;'>" +
                "Nessun suggerimento disponibile." +
                "</div>"
            );
            return;
        }

        suggeriti.forEach(function (s, index) {
            var item = s.item;
            var titolo = me.escapeHtml(s.labelCompatta);
            var promo = me.escapeHtml(item.promo || "");

            var card = "";
            card += "<div class='clona-suggerito-card' " +
                "data-index='" + index + "' " +
                "data-idpromo='" + (item.idPromo || "") + "' " +
                "data-idtracciato='" + (item.idTracciato || "") + "' " +
                "title='" + promo + "' " +
                "style='cursor:pointer; min-width:100px; max-width:240px; flex:1 1 auto; border:1px solid #d6dce5; border-radius:8px; background:#fff; padding:8px 10px; box-sizing:border-box; transition:all .15s; overflow:hidden;'>";

            card += "   <div style='font-size:12px; font-weight:bold; color:#2b5fab; margin-bottom:4px; line-height:1.2; word-break:break-word;'>" + titolo + "</div>";
            card += "   <div style='font-size:14px; font-weight:bold; line-height:1.25; word-break:break-word; overflow-wrap:anywhere;'>" + promo + "</div>";
            card += "</div>";

            $container.append(card);
        });
    },

    renderSelectTuttiRiscontri(tuttiRiscontri) {
        var $select = $("#selectTuttiRiscontriClona");
        $select.empty();

        $select.append(
            $("<option></option>")
                .val(-1)
                .text("Nessuna selezione")
        );

        (tuttiRiscontri || []).forEach(function (item, index) {
            var testo = (item.promo || "") + " - " + (item.canale || "") + " - " + (item.area || "");
            $select.append(
                $("<option></option>")
                    .val(index)
                    .text(testo)
            );
        });

        $select.val(-1);
    },

    bindEventiDialogClonaRecord(suggeriti, tuttiRiscontri, element, idKitLavorazione) {
        $("#clonaRecordSuggeritiContainer").off("click", ".clona-suggerito-card");
        $("#selectTuttiRiscontriClona").off("change");
        let me = this;

        function resetCardSuggeriti() {
            $(".clona-suggerito-card").removeClass("selected").css({
                "border": "1px solid #d6dce5",
                "background": "#fff",
                "box-shadow": "none"
            });
        }

        $("#clonaRecordSuggeritiContainer").on("click", ".clona-suggerito-card", function () {
            var index = parseInt($(this).attr("data-index"), 10);
            var selezione = suggeriti[index];

            $("#selectTuttiRiscontriClona").val("");

            resetCardSuggeriti();

            $(this).addClass("selected").css({
                "border": "2px solid #2b5fab",
                "background": "#eef4ff",
                "box-shadow": "0 0 0 1px rgba(43,95,171,0.10)"
            });

            me.salvaSelezioneClonazione({
                tipo: "suggerito",
                item: selezione.item,
                labels: selezione.labels
            });

            me.aggiornaDettaglioSelezione(
                selezione.item,
                "Suggerito: " + selezione.labelCompatta,
                element,
                idKitLavorazione
            );

            //reimpostiamo $("#selectTuttiRiscontriClona") a nessuna selezione
            $("#selectTuttiRiscontriClona").val(-1);
        });

        $("#selectTuttiRiscontriClona").on("change", function () {
            var value = $(this).val();

            if (Array.isArray(value)) {
                value = value[value.length - 1] || "";
            }

            resetCardSuggeriti();

            if (value === "-1") {
                me.salvaSelezioneClonazione(null);
                me.aggiornaDettaglioSelezione(null, null, element, idKitLavorazione);
                return;
            }

            var item = tuttiRiscontri[parseInt(value, 10)];

            me.salvaSelezioneClonazione({
                tipo: "tuttiRiscontri",
                item: item
            });

            me.aggiornaDettaglioSelezione(
                item,
                "Selezionato da tutti i riscontri",
                element,
                idKitLavorazione
            );
        });
    },

    aggiornaDettaglioSelezione(item, origineLabel, element, idKitLavorazione) {
        var $box = $("#clonaRecordDettaglioSelezione");
        $box.empty();
        let me = this;

        if (!item) {
            $box.html("<div style='color:#777; font-size:12px;'>Nessun elemento selezionato.</div>");
            return;
        }

        var html = "";
        html += "<div style='font-size:14px; font-weight:bold; margin-bottom:4px; word-break:break-word;'>" + me.escapeHtml(origineLabel || "Selezione") + "</div>";
        html += "<div style='display:flex; flex-wrap:wrap; gap:10px; font-size:12px; line-height:1.35;'>";

        html += "  <div style='min-width:180px; flex:1 1 180px; word-break:break-word;'>";
        html += "      <div style='margin-bottom:4px;'><b>Promo:</b> " + me.escapeHtml(item.promo || "") + "</div>";
        html += "      <div style='margin-bottom:4px;'><b>Canale:</b> " + me.escapeHtml(item.canale || "") + "</div>";
        html += "  </div>";

        html += "  <div style='min-width:180px; flex:1 1 180px; word-break:break-word;'>";
        html += "      <div style='margin-bottom:4px;'><b>Area:</b> " + me.escapeHtml(item.area || "") + "</div>";
        html += "      <div style='margin-bottom:4px;'><b>Data promo:</b> " + me.formattaData(item.dataPromo) + "</div>";
        html += "  </div>";

        html += "</div>";

        $box.html(html);
    },

    montaFooterDialogClonaRecord(element, idKitLavorazione, allElementGruppo, skipImpaginazione) {
        var $footer = $("#footerClonaRecord");
        $footer.empty();
        let me = this;

        var html = "";
        html += "<div style='height:100%; display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:10px 12px; box-sizing:border-box; border-top:1px solid #ddd; background:#fafafa;'>";
        html += "   <button type='button' id='btnConfermaClonaRecord' class='btn btn-primary' style='display:none;'>Conferma selezione</button>";
        html += "</div>";

        $footer.html(html);

        $("#btnConfermaClonaRecord").off("click").on("click", function () {
            if (!selezioneClonazioneCorrente || !selezioneClonazioneCorrente.item) {
                return;
            }

            me.mostraSecondaSchermataClonazione(element, idKitLavorazione, selezioneClonazioneCorrente, allElementGruppo, skipImpaginazione);
        });
    },

    aggiornaVisibilitaConfermaClonaRecord() {
        if (selezioneClonazioneCorrente && selezioneClonazioneCorrente.item) {
            $("#btnConfermaClonaRecord").show();
        } else {
            $("#btnConfermaClonaRecord").hide();
        }
    },

    formattaData(data) {
        if (!data) return "";

        var d = new Date(data);
        if (isNaN(d.getTime())) return data;

        var gg = ("0" + d.getDate()).slice(-2);
        var mm = ("0" + (d.getMonth() + 1)).slice(-2);
        var yyyy = d.getFullYear();

        return gg + "/" + mm + "/" + yyyy;
    },

    escapeHtml(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    salvaSelezioneClonazione(selezione) {
        selezioneClonazioneCorrente = selezione;
        this.aggiornaVisibilitaConfermaClonaRecord();
    },

    async attivaSchermateReferenza(meccanica, box, page) {

        let me = this;
        console.log("getDnaOfBox da scheda");
        // console.log(Utility);
        // console.log(Utility.getDnaOfBox);

        let dna = Utility.getDnaOfBox(box);
        showLoading("Caricamento scheda...");
        Utility.sleep(10);
        if (dna == null) {
            //Invalida
            console.error("La scheda ref non è più valida");

            this.setInvalidated(true);
            messaggioUtente("Code SRF-2 La scheda ref non è più valida", "error");

            return;

        }

        var schedaRef = this.schedeRefDati;
        //writeDebugMessageForCrash("Scheda ref count: " + schedaRef.length);
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-17 Primario non trovato nella scheda del prodotto", "error");
            console.error("Code SRF-17 Primario non trovato nella scheda del prodotto");
            return;
        }
        var refEditabile = pluginMiddleware.getEditabilitaSchedaRef != null ? pluginMiddleware.getEditabilitaSchedaRef(primario.recordInTracciato) : true;

        let convalidaFirmaRevisione = (
            primario.recordInTracciato["Tracciato.Firma"] == primario.firmaRevisione &&
            primario.firmaRevisione != "" &&
            primario.firmaRevisione != null//Deve essere un singolo per portarsi dietro la firma
        ); //Se è un gruppo è già convalidato

        this.resetInitSchedaRef();
        //writeDebugMessageForCrash("Reset init scheda ref");
        console.log("COMPILO REF");
        var codice = primario.recordInTracciato["Scatto.CodiceGruppo"];
        this.componiTitoloCodice(codice);
        if (codice.includes(",")) {
            $("#sgruppa").show();
        }

        this.preparaInfoIspezioneDelDato(primario.recordInTracciato, primario);

        $("#editReferenza").empty();

        //Inserisco lo spazio per far immettere le info di MISMATCH se ci sono
        $("#editReferenza").append('<div id="mismatchWarningPanel" style="padding:5px;"></div>');

        //I20-981: la descrizione del server si puo' riportare nel box senza passare dal
        //salvataggio, per quando il dato e' gia' a posto a monte e il box e' rimasto indietro.
        //Si offre solo quando le due cose non dicono la stessa cosa.
        //
        //I20-993: il contenuto che riporta viene da compiledFields, cioe' e' la descrizione che
        //il server ha gia' composto per la variante che comanda. Prima il pulsante restava
        //attivo su qualunque linguetta, e stando sulla nazionale applicava la descrizione della
        //ss_sa. Ora lo si offre solo quando si sta sulla variante a cui quel contenuto
        //appartiene: sulle altre si guarda soltanto, e il pulsante non c'e'.
        //I20-995: quando la preanalisi della scheda e' gia' stata fatta, il pulsante si decide
        //da quella invece di rifarne una tutta per se'. Era il costo che tornava a ogni
        //rientro nella schermata di edit: la preanalisi delle segnalazioni si fa una volta per
        //scheda da I20-992, questa no, e ripartiva anche solo tornando dalle foto.
        //
        //Alla prima apertura si continua a chiederlo a descrizioneDisallineata, e non per
        //pigrizia: poco piu' sotto un campo descrizione vuoto viene riempito col contenuto del
        //server, quindi la preanalisi fatta prima e quella fatta dopo non rispondono la stessa
        //cosa. Quella delle segnalazioni gira a schermata costruita, e va lasciata li'.
        const segnalazioniGiaInMemoria = this.segnalazioniInMemoria();
        const campoDescrizioneDelPrimario = this.campoDescrizioneCompilatoDelPrimario(this.schedeRefDati);
        const descrizioneDaAllineare = segnalazioniGiaInMemoria != null && campoDescrizioneDelPrimario != null
            ? this.differenzaDaAllineare(segnalazioniGiaInMemoria, campoDescrizioneDelPrimario.labelName)
            : await this.descrizioneDisallineata(this.schedeRefDati, box);

        if (descrizioneDaAllineare) {
            const bottoneDescrizione = $('<sp-action-button id="applicaDescrizioneDaServer" style="font-size: 12px; margin: 4px 0px 8px 0px;">Applica descrizione da server</sp-action-button>');
            bottoneDescrizione.on("click", function () {
                me.applicaDescrizioneDaServer();
            });
            $("#editReferenza").append(bottoneDescrizione);
        }


        if (codice != $("#elementiArtwork").val()) {
            $("#panelElementiArtwork").empty();
        }



        //da qui in poi inzia la parte che si occupa di compilare la tab di primarie/secondarie
        $("#cambiaPS").empty();


        try {
            //writeDebugMessageForCrash("Inizio try descrizioni regionali e canale");
            //I20-993: al posto delle due caselle, una scheda a linguette per variante, come
            //quella del revisore. Creare e cancellare varianti resta sul revisore: qui si
            //sceglie quale guardare, e si modifica solo quella che comanda, cioe' la piu'
            //specifica valida per questa lavorazione. Sulle altre i campi si bloccano.
            var rowOpzioniRegionaliEArtwork = $('<div class="row" style="justify-content: flex-start; display: flex; flex-wrap: wrap;"></div>');

            var elencoVarianti = primario.recordInTracciato["varianti_descrizione"] || [];
            var areaObjLav = ficoProcess.getAreaLavorazioneCorrente();
            var canaleObjLav = ficoProcess.getCanaleLavorazioneCorrente();
            var areaLav = areaObjLav != null ? areaObjLav.sigla : null;
            var canaleLav = canaleObjLav != null ? canaleObjLav.sigla : null;

            var varianteChePuoiModificare = variantiDescrizione.varianteApplicabile(elencoVarianti, areaLav, canaleLav);
            var varianteMostrata = varianteChePuoiModificare;

            //I20-993: il salvataggio sta in un altro metodo e deve sapere su quale variante si
            //sta scrivendo, altrimenti il server sceglie la prima riga che capita e la modifica
            //finisce sulla nazionale. Vale anche quando la variante e' una sola.
            me.varianteDescrizioneScelta = varianteChePuoiModificare;

            //Blocca o sblocca i campi della scheda. Si agisce anche direttamente sulle textarea
            //e non solo tramite il controller, perche' quello nasce piu' tardi e la prima
            //selezione non deve dipendere da quel tempo. Chi era gia' in sola lettura ci resta:
            //l'agenzia o la revisione possono averlo deciso per conto loro.
            var bloccaCampiScheda = function (bloccare) {
                $("#editReferenza").find("textarea").each(function () {
                    var campo = $(this);

                    if (campo.attr("data-solaletturaoriginale") == null) {
                        campo.attr("data-solaletturaoriginale", campo.prop("readonly") ? "1" : "0");
                    }

                    var originale = campo.attr("data-solaletturaoriginale") === "1";
                    campo.prop("readonly", bloccare || originale);
                    campo.css("opacity", bloccare ? "0.6" : "");
                });

                if (me.editRefFieldController != null) {
                    me.editRefFieldController.solaLettura = bloccare === true;
                }
            };

            //Le linguette servono se c'e' da scegliere fra piu' varianti, oppure se ce n'e' da
            //creare: con la sola nazionale e niente da creare la scheda resta com'era.
            var quanteValgono = variantiDescrizione.variantiApplicabili(elencoVarianti, areaLav, canaleLav).length;
            var quanteSeNePossonoCreare = variantiDescrizione.variantiCreabili(elencoVarianti, areaLav, canaleLav).length;

            if (quanteValgono > 1 || quanteSeNePossonoCreare > 0) {
                var linguette = $('<div id="tabVariantiDescrizione" style="display:flex; flex-wrap:wrap; align-items:flex-end; border-bottom:1px solid #777; margin:6px 0 0 0; width:100%;"></div>');

                //I testi che il box ha all'apertura, cioe' l'impaginato. Si ricordano una volta
                //sola, prima che qualcuno li tocchi: sono quelli che la variante modificabile
                //deve mostrare, ed e' il confronto fra loro e l'archivio a far emergere il
                //disallineamento. Guardando un'altra variante i campi si riempiono col suo dato,
                //e tornando su quella modificabile questi vengono rimessi.
                var testiDellImpaginato = null;

                var ricordaTestiDellImpaginato = function () {
                    if (testiDellImpaginato != null) {
                        return;
                    }

                    testiDellImpaginato = [];
                    $("#editReferenza").find('textarea[labelCorrispondente="descrizione"]').each(function () {
                        testiDellImpaginato.push({ campo: this, valore: $(this).val() });
                    });
                };

                var rimettiTestiDellImpaginato = function () {
                    if (testiDellImpaginato == null) {
                        return;
                    }

                    testiDellImpaginato.forEach(function (voce) { $(voce.campo).val(voce.valore); });
                };

                //Scrive i testi di una variante nei box delle descrizioni, ciascuno nel suo.
                //Il campo dichiara a quale descrizione appartiene con il suo stile di carattere;
                //quando lo stile non si risolve - e succede - si procede in ordine sui campi
                //rimasti, invece di ammucchiare tutto nel primo.
                var scriviVarianteNeiBox = function (variante) {
                    var testi = [variante.descrizione1, variante.descrizione2, variante.descrizione3, variante.descrizione4];
                    var campi = $("#editReferenza").find('textarea[labelCorrispondente="descrizione"]');
                    var assegnati = {};
                    var senzaStile = [];

                    campi.each(function () {
                        var campo = $(this);
                        var universale = pluginMiddleware.getNameStileUniversale(campo.attr("currentcharacterstyle"));
                        var fondamentale = universale != null ? universale.fondamentale : null;
                        var indice = fondamentale != null ? ["descrizione1", "descrizione2", "descrizione3", "descrizione4"].indexOf(fondamentale) : -1;

                        if (indice >= 0 && assegnati[indice] !== true) {
                            assegnati[indice] = true;
                            campo.val(testi[indice] != null ? testi[indice] : "");
                        }
                        else if (indice < 0) {
                            senzaStile.push(campo);
                        }
                    });

                    //I campi che non dicono chi sono prendono le descrizioni non ancora assegnate,
                    //nell'ordine in cui compaiono.
                    var daAssegnare = [];
                    for (var i = 0; i < testi.length; i++) {
                        if (assegnati[i] !== true) {
                            daAssegnare.push(testi[i]);
                        }
                    }

                    senzaStile.forEach(function (campo, posizione) {
                        campo.val(posizione < daAssegnare.length && daAssegnare[posizione] != null ? daAssegnare[posizione] : "");
                    });
                };
                var mostraVariante = function (variante) {
                    varianteMostrata = variante;
                    me.varianteDescrizioneScelta = variante;

                    var etichettaScelta = variantiDescrizione.etichetta(variante);
                    var modificabile = variantiDescrizione.eModificabile(variante, elencoVarianti, areaLav, canaleLav);

                    linguette.find(".linguettaVariante").each(function () {
                        var sua = $(this).attr("data-variante");
                        var attiva = sua === etichettaScelta;
                        $(this).css({
                            "background": attiva ? "#ffffff" : "#4d4c4c",
                            "color": attiva ? "#000000" : "#cccccc",
                            "font-weight": attiva ? "bold" : "normal"
                        });
                    });

                    bloccaCampiScheda(!modificabile);

                    //Il contenuto del pulsante e' quello composto per la variante che comanda:
                    //offrirlo mentre se ne guarda un'altra vorrebbe dire scriverle addosso il
                    //testo sbagliato.
                    //Si mostra solo sulla variante a cui quel contenuto appartiene: il suo
                    //contenuto e' quello composto per lei.
                    if (modificabile) {
                        $("#applicaDescrizioneDaServer").show();
                    }
                    else {
                        $("#applicaDescrizioneDaServer").hide();
                    }

                    ricordaTestiDellImpaginato();

                    //La modificabile mostra l'impaginato, le altre il loro dato d'archivio, e in
                    //entrambi i casi nei box delle descrizioni: e' li' che si leggono.
                    if (modificabile && variante.nuova !== true) {
                        rimettiTestiDellImpaginato();
                    }
                    else {
                        //Una variante appena creata nasce vuota: riempirla con l'impaginato
                        //vorrebbe dire copiarci dentro la descrizione di un'altra variante.
                        scriviVarianteNeiBox(variante);
                    }
                };

                var creaLinguetta = function (variante) {
                    var etichetta = variantiDescrizione.etichetta(variante);
                    var linguetta = $('<div class="linguettaVariante"></div>');
                    linguetta.attr("data-variante", etichetta);
                    linguetta.text(etichetta);
                    linguetta.css({
                        "padding": "3px 12px",
                        "margin-right": "2px",
                        "cursor": "pointer",
                        "border": "1px solid #777",
                        "border-bottom": "none",
                        "border-radius": "4px 4px 0 0",
                        "font-size": "11px",
                        "background": "#4d4c4c",
                        "color": "#cccccc"
                    });
                    linguetta.on("click", function () { mostraVariante(variante); });

                    //I20-993: chiudere una variante la cancella davvero, come l'elimina del
                    //revisore: sparisce di qui e di la'. Per questo si chiede conferma e si
                    //dice per esteso cosa si sta per perdere. La nazionale non ha la crocetta,
                    //e il server rifiuta comunque di eliminarla su richiesta del Plugin.
                    if (variantiDescrizione.siPuoChiudere(variante)) {
                        var crocetta = $('<span title="Elimina questa variante">&#10005;</span>');
                        crocetta.css({ "margin-left": "8px", "cursor": "pointer", "opacity": "0.7" });
                        crocetta.on("click", async function (evento) {
                            evento.stopPropagation();

                            var avviso = $('<div style="display:block;"></div>');
                            avviso.append($('<div style="color:black; font-size:16px;"></div>')
                                .text("Eliminare la descrizione " + etichetta + " di questa referenza?"));
                            avviso.append($('<div style="color:black; font-size:13px; margin-top:6px;"></div>')
                                .text("Viene cancellata anche dal revisore e non si recupera. Resteranno le varianti meno specifiche, e quella che comanda diventera' la prima ancora valida."));

                            if (!(await Utility.confirm(avviso))) {
                                return;
                            }

                            me.eliminaVarianteDescrizione(dna, variante, function () {
                                //Si ricarica la scheda dal server, non la si ridisegna. Ridisegnarla
                                //la rifarebbe con l'elenco di varianti e con compiledFields gia'
                                //scaricati, dove la variante eliminata c'e' ancora e la descrizione
                                //composta e' quella di allora. Ricaricandola arrivano l'elenco
                                //aggiornato, la composizione della variante che comanda adesso, e il
                                //controllo del disallineamento rifatto su quella: e' quel controllo
                                //a decidere se offrire "Applica descrizione da server".
                                me.initSchedaRef(me.refSelected);
                            });
                        });
                        linguetta.append(crocetta);
                    }

                    linguette.append(linguetta);
                };

                variantiDescrizione.variantiApplicabili(elencoVarianti, areaLav, canaleLav).forEach(creaLinguetta);

                //I20-993: il piu' crea una descrizione regionale per questa lavorazione. Sul
                //revisore si crea qualunque combinazione; qui solo quelle che servono al lavoro
                //aperto, e la riga d'archivio nasce al primo salvataggio.
                var disegnaPiu = function () {
                    linguette.find(".creaVariante").remove();

                    var creabili = variantiDescrizione.variantiCreabili(elencoVarianti, areaLav, canaleLav);
                    var nazionale = elencoVarianti.filter(function (v) { return variantiDescrizione.specificita(v) === 0; })[0];

                    if (creabili.length === 0) {
                        return;
                    }

                    var piu = $('<div class="creaVariante" title="Crea una descrizione regionale per questa lavorazione">+</div>');
                    piu.css({
                        "padding": "3px 10px",
                        "margin-left": "4px",
                        "cursor": "pointer",
                        "border": "1px dashed #777",
                        "border-bottom": "none",
                        "border-radius": "4px 4px 0 0",
                        "font-size": "11px",
                        "color": "#cccccc"
                    });

                    //Le possibilita' si mostrano come voci cliccabili accanto al piu'. In UXP
                    //prompt e alert non esistono - nel Plugin non li usa nessuno - e chiamarli
                    //interrompe il gestore senza dire niente: era il motivo per cui il piu' non
                    //faceva nulla.
                    piu.on("click", function () {
                        if (linguette.find(".sceltaVariante").length > 0) {
                            linguette.find(".sceltaVariante").remove();
                            return;
                        }

                        creabili.forEach(function (scelta) {
                            var voce = $('<div class="sceltaVariante"></div>');
                            voce.text(variantiDescrizione.etichetta(scelta));
                            voce.css({
                                "padding": "3px 10px",
                                "margin-left": "4px",
                                "cursor": "pointer",
                                "border": "1px dashed #9ecbff",
                                "border-bottom": "none",
                                "border-radius": "4px 4px 0 0",
                                "font-size": "11px",
                                "color": "#9ecbff"
                            });

                            voce.on("click", function () {
                                linguette.find(".sceltaVariante").remove();

                                //Nasce vuota e sta nell'elenco come le altre: se e' la piu'
                                //specifica diventa lei la modificabile, e salvando la scheda la
                                //riga viene creata in archivio.
                                elencoVarianti.push({
                                    area: scelta.area,
                                    canale: scelta.canale,
                                    specificita: variantiDescrizione.specificita(scelta),
                                    //Nasce con i campi della nazionale, che e' il punto di
                                    //partenza naturale per una variante: si prende da lei e si
                                    //cambia quello che cambia. Si legge dall'elenco e non
                                    //dall'impaginato, cosi' e' davvero la nazionale anche quando
                                    //il box dice altro.
                                    descrizione1: nazionale != null ? nazionale.descrizione1 : "",
                                    descrizione2: nazionale != null ? nazionale.descrizione2 : "",
                                    descrizione3: nazionale != null ? nazionale.descrizione3 : "",
                                    descrizione4: nazionale != null ? nazionale.descrizione4 : "",
                                    nuova: true
                                });

                                var nuova = elencoVarianti[elencoVarianti.length - 1];

                                //Non si ricarica dal server: la riga li' non esiste ancora, e
                                //ricaricando la variante appena creata sparirebbe.
                                creaLinguetta(nuova);
                                disegnaPiu();
                                varianteChePuoiModificare = variantiDescrizione.varianteApplicabile(elencoVarianti, areaLav, canaleLav);
                                linguette.show();
                                mostraVariante(nuova);

                                messaggioUtente("Descrizione " + variantiDescrizione.etichetta(scelta) + " creata: si scrive in archivio salvando la scheda", "success", false, 5);
                            });

                            linguette.append(voce);
                        });
                    });

                    linguette.append(piu);
                };

                rowOpzioniRegionaliEArtwork.append(linguette);

                //Il pulsante viene creato prima delle linguette e finiva sopra di loro. Qui lo si
                //sposta sotto: append di un elemento che esiste gia' lo muove, non lo duplica.
                rowOpzioniRegionaliEArtwork.append($("#applicaDescrizioneDaServer"));

                disegnaPiu();

                //Si parte da quella che comanda, cioe' dallo stato di prima di I20-993.
                setTimeout(function () { mostraVariante(varianteChePuoiModificare); }, 10);
            }

            //se artworkId è definito allora dentro elementiArtwork mettiamo due pulsanti, uno per eliminare l'artwork e uno per selezionarlo
            if (primario.recordInTracciato["artworkId"] != null && primario.recordInTracciato["artworkId"] != "") {
                rowOpzioniRegionaliEArtwork.append('<sp-action-button id="selezionaArtwork" style="color:lightgreen; margin-right:10px; font-size:10px;">Seleziona Artwork</sp-action-button>');
            }

            // if (descrizioneRegionaleCheckbox != null || descrizioneCanaleCheckbox != null) {
            // }
            $("#editReferenza").append(rowOpzioniRegionaliEArtwork);

            //writeDebugMessageForCrash("Scheda ref artworkId: " + primario.recordInTracciato["artworkId"]);

            if (primario.recordInTracciato["artworkId"] != null && primario.recordInTracciato["artworkId"] != "") {
                $("#selezionaArtwork").on("click", async function () {
                    //chiediamo conferma

                    //cerchiamo nella stessa pagina del box se c'è un elemento con label = ad primario.recordInTracciato["artworkId"]
                    //se lo troviamo lo eliminiamo, se non lo troviamo iniziamo a cercare nelle altre pagine partendo prima da quelle limitrofe
                    //ad esempio se siamo a pagina 8 e non lo troviamo cerchiamo prima nella 7 e nella 9, poi nella 6 e nella 10, e così via
                    //page è la pagina indesign dove si trova anche il box, iniziamo a cercare nella pagina corrente



                    let artwork = await schedaArtwork.cercaArtwork(page, primario.recordInTracciato["artworkId"]);
                    console.log("Artwork trovato: " + artwork);
                    if (artwork == null) {
                        //costruiamo il messaggio per il confirm, nel messaggio mettiamo un immagine con src
                        //var imgSrc = olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + primario.recordInTracciato["artworkFotoId"];
                        //poi mettiamo il testo "L'artwork non è stato trovato nell'impaginato, vuoi scollegarlo dai suoi elementi?"

                        var img = $('<img src="' + olimpoIp + 'getThumbNailOnDemand?width=50&guidId=' + primario.recordInTracciato["artworkFotoId"] + '" style="height:100px; margin-right:10px;">');
                        var container = $('<div style="display: block; align-items: center;"></div>');
                        var confirmMessage = $('<div style="display: flex; align-items: center; justify-content:center;"></div>');
                        confirmMessage.append(img);
                        container.append(confirmMessage);
                        container.append('<div><span style="color:black; font-size:16px">L\'artwork non è stato trovato nell\'impaginato, vuoi scollegarlo dai suoi elementi?</span></div>');
                        //mostriamo il confirm
                        if (!(await Utility.confirm(container))) {
                            return;
                        }
                        schedaArtwork.eliminaArtwork(primario.recordInTracciato["artworkId"]);
                        primario.recordInTracciato["artworkId"] = null;
                        primario.recordInTracciato["artworkFotoId"] = null;
                    }
                    else {
                        app.selection = [artwork];
                    }

                });
            }

            //writeDebugMessageForCrash("Inizio ciclo box allPageItems");

            //scarichiamo dal custom la lista di liste schemiDescrizioni
            var schemi = null;
            var listaStili = [];

            if (pluginMiddleware.getCampo("schemiDescrizioni") !== null) {
                schemi = pluginMiddleware.getCampo("schemiDescrizioni");
            }



            var grandezzeBox = pluginMiddleware.getCampo("grandezzeBox");
            for (var $i = 0; $i < box.allPageItems.length; $i++) {

                var item = box.allPageItems[$i];
                //writeDebugMessageForCrash("Box allPageItems item label: " + item.label+". Item numero: "+$i+" di "+box.allPageItems.length);
                if (Utility.parseLabel(item.label) == "descrizione") {

                    let matchFieldData = primario.recordInTracciato.compiledFields.find(f => Utility.parseLabel(f.labelName) == "descrizione");
                    //Posso compilare il campo con i dati che leggo
                    let content = matchFieldData.content;
                    //Parsing del content
                    let contentObj = Utility.parseContent(content);
                    //mettiamoci da parte una lista di tutti gli stili di tutte le row in contentObj post parse
                    let contentObjParsedStiles = [];
                    for (let r = 0; r < contentObj.length; r++) {
                        let itemRow = contentObj[r];
                        if (itemRow.stile != null && itemRow.stile != "" && !contentObjParsedStiles.includes(itemRow.stile)) {
                            let objParsed = {
                                stile: itemRow.stile,
                                content: itemRow.content
                            }
                            contentObjParsedStiles.push(objParsed);
                        }
                    }

                    //se il content è "" allora lo scriviamo con il valore della descrizione trovata nella schedaRef
                    if (item.contents == "" && !item.overflows) {
                        Utility.applicaTagStringToInndTextFrame(item, content, box.geometricBounds);
                    }

                    //I20-995: il campo si legge qui, una volta, a tratti di stile. Prima ogni
                    //carattere veniva chiesto a InDesign due volte - una per la lista degli
                    //stili, una per riempire le textarea - e ogni volta si chiedevano anche lo
                    //stile, il suo nome e il suo gruppo. Si legge dopo il riempimento qui
                    //sopra, altrimenti di un campo vuoto si leggerebbe il vuoto.
                    var trattiDelCampo = Utility.trattiDiStileDelCampo(item);

                    //La stessa normalizzazione di prima, applicata a un carattere per volta:
                    //sul tratto intero riconoscerebbe sequenze lunghe come "<br>" o "\r\n" e
                    //cambierebbe di nascosto il testo che l'operatore vede nel campo.
                    var normalizzaCarattere = function (carattere) {
                        return Utility.replaceAllSpecialCharacters(carattere.toString());
                    };

                    var schemaTrovato = null;
                    var lastStileSchemaInserito = 0;
                    if (schemi != null) {
                        //scorriamo tutta la descrizione e ci salviamo tutti gli stili che troviamo nell'ordine che li troviamo, uno stile può essere presente se intermezzato da uno stile differente
                        //I20-995: i tratti arrivano gia' accorpati per stile, quindi la loro
                        //sequenza di nomi e' esattamente la lista che si costruiva a mano.
                        trattiDescrizione.stiliInOrdine(trattiDelCampo).forEach(function (nomeStile) {
                            listaStili.push(nomeStile);
                        });

                        //adesso scrorriamo ogni lista di schemi presente e la confrontiamo con la lista di stili, se tutti gli stili presenti in lista stili sono presenti in uno schema e con lo stesso ordine, allora abbiamo trovato lo schema corrispondente
                        for (var $j = 0; $j < schemi.length; $j++) {
                            var schema = schemi[$j].schema;
                            //cicliamo la lista di stili e cerchiamo se lo stile è presente in schema, se lòo è ci salviamo da parte l'indice trovato in schema
                            var indice = 0;
                            var found = true;
                            for (var $k = 0; $k < listaStili.length; $k++) {
                                var stile = listaStili[$k];
                                stile = stile.split(".").length > 1 ? stile.split(".")[1] : stile;
                                var trovato = false;
                                for (var $l = indice; $l < schema.length; $l++) {
                                    var regolaSchema = schema[$l].split("$");
                                    if (regolaSchema.length == 1) {
                                        regolaSchema.insert(0, "");
                                    }
                                    if (regolaSchema[1].split(".").length > 1) {
                                        regolaSchema[1] = regolaSchema[1].split(".")[1];
                                    }

                                    if (regolaSchema[0] == "") {
                                        if (regolaSchema[1] == stile) {
                                            trovato = true;
                                            indice = $l;
                                            break;
                                        }
                                    }
                                    else if (regolaSchema[0] == "IN") {
                                        if (stile.includes(regolaSchema[1])) {
                                            trovato = true;
                                            indice = $l;
                                            break;
                                        }
                                    }
                                    else if (regolaSchema[0] == "!IN") {
                                        if (!stile.includes(regolaSchema[1])) {
                                            trovato = true;
                                            indice = $l;
                                            break;
                                        }
                                    }
                                    else if (regolaSchema[0] == "START") {
                                        if (stile.startsWith(regolaSchema[1])) {
                                            trovato = true;
                                            indice = $l;
                                            break;
                                        }
                                    }
                                    else if (regolaSchema[0] == "END") {
                                        if (stile.endsWith(regolaSchema[1])) {
                                            trovato = true;
                                            indice = $l;
                                            break;
                                        }
                                    }
                                }
                                if (!trovato) {
                                    found = false;
                                    break;
                                }
                            }
                            if (found) {
                                //valutiamo se le regole dello schema sono rispettate controllando il primo oggetto di objResult
                                var setRegole = schemi[$j].setRegole;
                                var regoleRispettate = true;
                                if (setRegole != null && setRegole.length > 0) {
                                    for (var $k = 0; $k < setRegole.length; $k++) {
                                        //controlliamo ogni oggetto nel set
                                        var set = setRegole[$k];
                                        regoleRispettate = true;
                                        for (var $l = 0; $l < set.length; $l++) {
                                            var regola = set[$l];
                                            var campo = regola.campo;
                                            var operatore = regola.operatore;
                                            var valore = regola.valore;
                                            if (primario.recordInTracciato[campo] != null) {
                                                //usiamo uno switch per gli operatori, gli operatori sono ==, !=, <, >, <=, >=, IN, !IN, startswith, endswith
                                                switch (operatore) {
                                                    case "==":
                                                        if (primario.recordInTracciato[campo].toString().toLowerCase() != valore.toString().toLowerCase()) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "!=":
                                                        if (primario.recordInTracciato[campo].toString().toLowerCase() == valore.toString().toLowerCase()) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "<":
                                                        if (typeof primario.recordInTracciato[campo] === 'number' && typeof valore === 'number' && primario.recordInTracciato[campo] >= valore) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case ">":
                                                        if (typeof primario.recordInTracciato[campo] === 'number' && typeof valore === 'number' && primario.recordInTracciato[campo] <= valore) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "<=":
                                                        if (typeof primario.recordInTracciato[campo] === 'number' && typeof valore === 'number' && primario.recordInTracciato[campo] > valore) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case ">=":
                                                        if (typeof primario.recordInTracciato[campo] === 'number' && typeof valore === 'number' && primario.recordInTracciato[campo] < valore) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "IN":
                                                        if (primario.recordInTracciato[campo].toString().toLowerCase().indexOf(valore.toString().toLowerCase()) < 0) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "!IN":
                                                        if (primario.recordInTracciato[campo].toString().toLowerCase().indexOf(valore.toString().toLowerCase()) >= 0) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "startswith":
                                                        if (!primario.recordInTracciato[campo].toString().toLowerCase().startsWith(valore.toString().toLowerCase())) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    case "endswith":
                                                        if (!primario.recordInTracciato[campo].toString().toLowerCase().endsWith(valore.toString().toLowerCase())) {
                                                            regoleRispettate = false;
                                                        }
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            }
                                            else {
                                                regoleRispettate = false;
                                                break;
                                            }
                                            if (!regoleRispettate) {
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (regoleRispettate) {
                                    schemaTrovato = schema;
                                    break;
                                }
                                else {
                                    found = false;
                                }
                            }
                        }
                    }
                    var currentCharacterStyle = "";
                    var row = $('<div class="row"></div>');
                    let stringaPerStile = "";
                    //I20-995: un giro per tratto di stile invece che per carattere. Il ramo che
                    //allungava la textarea un carattere alla volta non serve piu': il testo del
                    //tratto si scrive tutto insieme, in fondo al blocco.
                    for (var $j = 0; $j < trattiDelCampo.length; $j++) {
                        let tratto = trattiDelCampo[$j];
                        var characterName = tratto.nome;
                        var nomeCompleto = tratto.nomeCompleto;

                        //Quello che era il ramo "lo stile e' cambiato" vale adesso per ogni
                        //tratto, perche' due tratti di fila con lo stesso stile non esistono.
                        {
                            //cerchiamo in contentObjParsedStiles l'oggetto con stile pari a characterName

                            var stileObj = contentObjParsedStiles.find(f => f.stile == nomeCompleto);
                            var stileInMismatch = stileObj == null;

                            if (currentCharacterStyle != "") {
                                var previousStileObj = contentObjParsedStiles.find(f => f.stile == currentCharacterStyle);
                                var previousStileInMismatch = previousStileObj == null || Utility.replaceAllSpecialCharacters(previousStileObj.content) != Utility.replaceAllSpecialCharacters(stringaPerStile);
                                if (previousStileInMismatch) {
                                    //dobbiamo recuperare la precedente textarea e cambiare label e bordo a rosso
                                    var previousTextarea = row.find('textarea').last();
                                    var previousLabel = row.find('label').last();
                                    previousLabel.css("color", "gold");
                                    previousTextarea.css("border", "2px solid gold");
                                    previousTextarea.addClass("mismatchInImpaginato");
                                }
                            }

                            stringaPerStile = "";

                            if (row.children().length == (grandezzeBox != null && grandezzeBox.bigBoxPerRow != null && grandezzeBox.bigBoxPerRow != "auto" ? grandezzeBox.bigBoxPerRow : 2)) {
                                $("#editReferenza").append(row);
                                row = $('<div class="row"></div>');
                            }
                            //se lo schema non è null si scorre lo schema fino a trovare lo stile corrispondente e inserendo nel frattempo i box vuoti di ogni stile trovato prima di quello attuale, poi ci si salva l'indice a cui si è arrivati
                            if (schemaTrovato != null) {
                                for (var $k = lastStileSchemaInserito; $k < schemaTrovato.length; $k++) {
                                    var elSchema = schemaTrovato[$k].split("$");
                                    if (elSchema.length == 1) {
                                        elSchema.insert(0, "");
                                    }
                                    var characterName = tratto.nome;
                                    var schemaSplitted = elSchema[1].split(".");
                                    if (schemaSplitted.length > 1) {
                                        schemaSplitted = schemaSplitted[1];
                                    }
                                    else {
                                        schemaSplitted = schemaSplitted[0];
                                    }

                                    if (elSchema[0] == "" && schemaSplitted == characterName) {
                                        lastStileSchemaInserito = $k + 1;
                                        break;
                                    }
                                    else if (elSchema[0] == "IN" && characterName.includes(schemaSplitted)) {
                                        lastStileSchemaInserito = $k + 1;
                                        break;
                                    }
                                    else if (elSchema[0] == "!IN" && !characterName.includes(schemaSplitted)) {
                                        lastStileSchemaInserito = $k + 1;
                                        break;
                                    }
                                    else if (elSchema[0] == "START" && characterName.startsWith(schemaSplitted)) {
                                        lastStileSchemaInserito = $k + 1;
                                        break;
                                    }
                                    else {

                                        let nome_schema = schemaSplitted;
                                        if (nome_schema.indexOf("$") >= 0) {
                                            nome_schema = nome_schema.substring(nome_schema.indexOf("$") + 1);
                                        }

                                        var column = $('<div class="column" style="margin-right:' + (grandezzeBox != null && grandezzeBox.marginBetweenBigBox != null && grandezzeBox.marginBetweenBigBox != "auto" ? grandezzeBox.marginBetweenBigBox : "10px") + 'px;"></div>');
                                        var label = '<label style="margin-top: 10px;color:white;">' + nome_schema + '</label><br>';

                                        //mandiamo all'agenzia una riciesta per il controllo del nome schema se è editabile, se la risposta è false la textarea sarà readonly
                                        let isEditable = true;
                                        if (pluginMiddleware.isSchemaEditable != null) {
                                            isEditable = pluginMiddleware.isSchemaEditable(nome_schema);
                                        }

                                        var textarea = $('<textarea ' + (isEditable  && refEditabile ? '' : 'readonly') + ' class="hideble" labelCorrispondente="descrizione" currentCharacterStyle="' + nome_schema + '" class="textArea nonCancellareSeVuoto" name="myTextarea" style="height:' + (grandezzeBox != null && grandezzeBox.bigBoxHeight != null && grandezzeBox.bigBoxHeight != "auto" ? grandezzeBox.bigBoxHeight : '50') + 'px; width:' + (grandezzeBox != null && grandezzeBox.bigBoxWidth != null && grandezzeBox.bigBoxWidth != "auto" ? grandezzeBox.bigBoxWidth : '100') + 'px; background-color:white; color:black;"></textarea><br>');
                                        column.append(label).append(textarea);
                                        row.append(column);
                                        if (row.children().length == (grandezzeBox != null && grandezzeBox.bigBoxPerRow != null && grandezzeBox.bigBoxPerRow != "auto" ? grandezzeBox.bigBoxPerRow : 2)) {
                                            $("#editReferenza").append(row);
                                            row = $('<div class="row"></div>');
                                        }
                                    }
                                }
                            }
                            //Il nome completo, gruppo compreso, lo porta gia' il tratto.
                            currentCharacterStyle = tratto.nomeCompleto;
                            var label = '<label style="margin-top: 10px;color:' + (stileInMismatch ? 'gold' : 'white') + ';">' + currentCharacterStyle + '</label><br>';
                            let isEditable = true;
                            if (pluginMiddleware.isSchemaEditable != null) {
                                isEditable = pluginMiddleware.isSchemaEditable(currentCharacterStyle);
                            }

                            var textarea = $('<textarea ' + (isEditable && refEditabile ? '' : 'readonly') + ' class="hideble" labelCorrispondente="descrizione" currentCharacterStyle="' + currentCharacterStyle + '" class="textArea nonCancellareSeVuoto' + (stileInMismatch ? ' mismatchInImpaginato' : '') + '" name="myTextarea" style="height: ' + (grandezzeBox != null && grandezzeBox.bigBoxHeight != null && grandezzeBox.bigBoxHeight != "auto" ? grandezzeBox.bigBoxHeight : '50') + 'px; width:' + (grandezzeBox != null && grandezzeBox.bigBoxWidth != null && grandezzeBox.bigBoxWidth != "auto" ? grandezzeBox.bigBoxWidth : '100') + 'px; background-color:white; color:black;' + (stileInMismatch ? ' border: 2px solid gold;' : '') + '"></textarea><br>');
                            var column = $('<div class="column" style="margin-right:' + (grandezzeBox != null && grandezzeBox.marginBetweenBigBox != null && grandezzeBox.marginBetweenBigBox != "auto" ? grandezzeBox.marginBetweenBigBox : "10px") + 'px;"></div>').append(label).append(textarea);
                            row.append(column);

                            //Il testo del tratto: quello che si vede e quello che serve al
                            //confronto con il contenuto del server. La normalizzazione passa
                            //carattere per carattere come faceva il ciclo vecchio, e l'a capo
                            //diventa "\n" nella textarea e resta "\r" nel confronto.
                            var testiDelTratto = trattiDescrizione.testiDelTratto(tratto.contenuto, normalizzaCarattere);
                            var currentTextarea = row.find('textarea').last();
                            currentTextarea.val(testiDelTratto.perLaTextarea); // Aggiungi il contenuto alla textarea qui

                            stringaPerStile += testiDelTratto.perIlConfronto;
                        }
                    }

                    if (currentCharacterStyle != "") {
                        var previousStileObj = contentObjParsedStiles.find(f => f.stile == currentCharacterStyle);
                        var previousStileInMismatch = previousStileObj == null || Utility.replaceAllSpecialCharacters(previousStileObj.content) != Utility.replaceAllSpecialCharacters(stringaPerStile);
                        if (previousStileInMismatch) {
                            //dobbiamo recuperare la precedente textarea e cambiare label e bordo a rosso
                            var previousTextarea = row.find('textarea').last();
                            var previousLabel = row.find('label').last();
                            previousLabel.css("color", "gold");
                            previousTextarea.css("border", "2px solid gold");
                            previousTextarea.addClass("mismatchInImpaginato");
                        }
                    }


                    if (row.children().length == (grandezzeBox != null && grandezzeBox.bigBoxPerRow != null && grandezzeBox.bigBoxPerRow != "auto" ? grandezzeBox.bigBoxPerRow : 2)) {
                        $("#editReferenza").append(row);
                        row = $('<div class="row"></div>');
                    }

                    if (schemaTrovato != null) {
                        for (var $k = lastStileSchemaInserito; $k < schemaTrovato.length; $k++) {
                            var elSchema = schemaTrovato[$k].split("$");
                            if (elSchema.length == 1) {
                                elSchema.insert(0, "");
                            }
                            lastStileSchemaInserito++;

                            let nome_schema = schemaTrovato[$k];
                            if (nome_schema.indexOf("$") >= 0) {
                                nome_schema = nome_schema.substring(nome_schema.indexOf("$") + 1);
                            }


                            var column = $('<div class="column" style="margin-right:' + (grandezzeBox != null && grandezzeBox.marginBetweenBigBox != null && grandezzeBox.marginBetweenBigBox != "auto" ? grandezzeBox.marginBetweenBigBox : "10px") + 'px;"></div>');
                            var label = '<label style="margin-top: 10px;color:white;">' + elSchema[1] + '</label><br>';

                            var isEditable = true;
                            if (pluginMiddleware.isSchemaEditable != null) {
                                isEditable = pluginMiddleware.isSchemaEditable(elSchema[1]);
                            }

                            var textarea = $('<textarea ' + (isEditable && refEditabile ? '' : 'readonly') + ' class="hideble" labelCorrispondente="descrizione" currentCharacterStyle="' + nome_schema + '" class="textArea nonCancellareSeVuoto" name="myTextarea" style="height: ' + (grandezzeBox != null && grandezzeBox.bigBoxHeight != null && grandezzeBox.bigBoxHeight != "auto" ? grandezzeBox.bigBoxHeight : '50') + 'px; width:' + (grandezzeBox != null && grandezzeBox.bigBoxWidth != null && grandezzeBox.bigBoxWidth != "auto" ? grandezzeBox.bigBoxWidth : '100') + 'px; background-color:white; color:black;"></textarea><br>');
                            column.append(label).append(textarea);
                            row.append(column);
                            if (row.children().length == (grandezzeBox != null && grandezzeBox.bigBoxPerRow != null && grandezzeBox.bigBoxPerRow != "auto" ? grandezzeBox.bigBoxPerRow : 2)) {
                                $("#editReferenza").append(row);
                                row = $('<div class="row"></div>');
                            }
                        }
                    }

                    // Aggiungi l'ultima riga a #editReferenza, anche se ha solo una colonna                               
                    if (row.children().length > 0) {
                        $("#editReferenza").append(row);
                    }
                    
                    row = $('<div style="display:none;" class="row"></div>');
                    //scorriamo contentObjParsedStiles e cerchiamo gli stili che contengono _$Hidden, per ognuno creiamo un textarea nascosto con label corrispondente al nome dello stile senza $Hidden
                    for (let $j = 0; $j < contentObjParsedStiles.length; $j++) {
                        let stile = contentObjParsedStiles[$j].stile;
                        let content = contentObjParsedStiles[$j].content;
                        if (stile.indexOf("_$Hidden") >= 0) {
                            let nome_stile = stile.replace("_$Hidden", "");
                            let label = '<label style="margin-top: 10px;color:white;">' + nome_stile + '</label><br>';
                            let textarea = $('<textarea labelCorrispondente="descrizione" currentCharacterStyle="' + nome_stile + '" class="textArea nonCancellareSeVuoto" name="myTextarea" style="height: 50px; width: 100%; background-color:white; color:black;">' + content + '</textarea><br>');
                            row.append(label).append(textarea);
                        }
                    }

                    if (row.children().length > 0) {
                        $("#editReferenza").append(row);
                    }
                    var button = $('<sp-action-button id="salvaButton" style="color:lightgreen; margin-right:10px;">Salva modifiche</sp-action-button>');
                    button.on('click', function () {
                        me.salvaModifiche(schedaRef, codice, box, meccanica, page);
                    });

                    $("#pulsantiExtra").empty();
                    $("#pulsantiExtra").append(button);

                    break;
                }
            }

            //I20-993: il Salva deve esserci sempre. Nasceva soltanto dentro il ramo che disegna
            //il campo descrizione del box, quindi su un box senza quel campo non compariva, e
            //si nascondeva anche quando la Tab5 non era visibile. Qui si garantisce che ci sia.
            if ($("#salvaButton").length === 0) {
                var salvaSempre = $('<sp-action-button id="salvaButton" style="color:lightgreen; margin-right:10px;">Salva modifiche</sp-action-button>');
                salvaSempre.on('click', function () {
                    me.salvaModifiche(schedaRef, codice, box, meccanica, page);
                });
                $("#pulsantiExtra").append(salvaSempre);
            }

            $("#salvaButton").css("display", "");

            //writeDebugMessageForCrash("Inizio cambio strutturale");


            if (cambiStrutturaliJs.getCambioStrutturalePath != null && me.mostraAzioniStrutturaliInEdit()) {
                //Implementazioni path di cambio strutturale

                let cambiStrutturali = await cambiStrutturaliJs.getCambioStrutturalePath(primario, box);
                if (cambiStrutturali.length > 0) {
                    //Scansiono groupIndd per capire quali labels ci sono
                    let labInBox = Utility.getAllFieldsInGroup(box);

                    let divCampiOfferta = $('<div id="edit_campi_offerta"></div>');

                    divCampiOfferta.append('<h3 style="color:white;">Azioni sul box</h3>');

                    //let spMenu = $("<select id=\"cmbActCambioStrutturale\"><select>");
                    //spMenu.append($('<option selected></option>').text("Seleziona un'azione").val("0"));
                    let spPicker =
                        $("<sp-picker id=\"cmbActCambioStrutturale\"></sp-picker>");
                    spPicker.append(
                        $('<sp-menu slot="options"></sp-menu>').append($('<sp-menu-item selected selected></sp-menu-item>').text("Seleziona un'azione").val("0"))
                    );

                    let spMenu = spPicker.find("sp-menu");


                    for (let cs = 0; cs < cambiStrutturali.length; cs++) {
                        let obj = cambiStrutturali[cs];

                        let canDo = false;
                        if (obj.campiInddCoinvolti != null && obj.campiInddCoinvolti.length > 0) {
                            //Richiesto filtro campi, condizione di esistenza.
                            //Basta che almeno uno ci sia e si puo fare
                            for (let cs2 = 0; cs2 < obj.campiInddCoinvolti.length; cs2++) {
                                if (labInBox.find(c => Utility.parseLabel(c.label) == Utility.parseLabel(obj.campiInddCoinvolti[cs2].label)) != null) {
                                    canDo = true;
                                    break;
                                }
                            }
                        }
                        else {
                            canDo = true;
                        }

                        if (canDo) {
                            spMenu.append(
                                //$('<option></option>').text(obj.titolo).val(obj.id)
                                $('<sp-menu-item></sp-menu-item>').text(obj.titolo).val(obj.id)
                            );
                        }



                    }

                    //spMenu.on('change', function (e) {
                    spPicker.on('change', function (e) {
                        //let val = e.target.selectedOptions[0]._properties.values().next().value;
                        let val = $(this).val();
                        if (val == "0")
                            return;

                        //$("#azioni_strutturali").append(val);
                        //$("#cmbActCambioStrutturale").val(val);
                        //$("#cmbActCambioStrutturale").val("0");
                        Utility.setPickerValue($("#cmbActCambioStrutturale"), "0", false);

                        let template_panelAzione = '<div id="az_$id" class="panel" style="width: 90%;margin: 0px auto;border: 2px solid #d6d0d0;border-radius: 10px;padding: 10px;margin-bottom: 10px;">'+
                                                '<div class="row" style="margin-bottom: 10px;">'+
                                                '<div class="col" style="font-size: 13px;width:90%;">$tit</div>' +
                                                '<div class="delAzButton" class="col" style="width: 10%;text-align: center;margin-top: -10px;background-color: white;color: black;border-radius: 5px;margin-right: -5px;height: 20px; cursor:pointer;"><div style="margin-top: 3px;">X</div></div>'
                                                '</div></div>';
                        

                        //if ($("#azioni_strutturali").find(".act" + val).length <= 0) {
                        if ($("#azioni_strutturali").find("#az_" + val).length <= 0) {
                            let objCS = cambiStrutturali.find(cs => cs.id == val);
                            
                            let panelAzione = template_panelAzione.replace("$tit", objCS.titolo).replace("$id", objCS.id);
                            let panelAzioneEl = $(panelAzione); 
                            for (let ist = 0; ist < objCS.istruzioni.length; ist++) {
                                console.log(objCS);
                                let istruzione = objCS.istruzioni[ist];
                                let contInstr = $("<div><div>");
                                contInstr.append("<span class=\"act" + val + "\">" + istruzione.field + "</span>");
                                if (istruzione.valore == null) {
                                    //Devo poterlo cambiare liberamente
                                    let currVal = primario.recordInTracciato[Utility.replaceAll(istruzione.field, "$", ".")];
                                    if (currVal == null) {
                                        currVal = "";
                                    }
                                    contInstr.append("<input style=\"width:100px;vertical-align:middle;background-color:#79d4e8;color:black;\" class=\"fieldCambioStrutturale\" type=\"text\" id=\"" + istruzione.field + "\" value=\"" + currVal + "\"></input>");
                                    panelAzioneEl.append('<div class="row" style="display:block;"><div class="col" style="display:block;"><div style="color: white;width:100%">'+istruzione.field +'</div><div  style="width:100%"><input type="text" class="fieldCambioStrutturale singular-inputTextfield" id="'+istruzione.field +'" style="width: 90%; color: black; background-color:white;" value="'+currVal+'"></input></div></div></div>');
                                }
                                else {
                                    if (typeof istruzione.valore === "object") {
                                        //Tendina di scelta
                                        //let cmb = $("<select id=\""+istruzione.field+"\" style=\"vertical-align:middle;\" class=\"fieldCambioStrutturale\"><select>");
                                        let cmb = $("<sp-picker id=\"" + istruzione.field + "\" style=\"vertical-align:middle;\" class=\"fieldCambioStrutturale\"><sp-picker>").append('<sp-menu slot="options"></sp-menu>');
                                        let flagSel = false;
                                        istruzione.valore.forEach(obj => {
                                            cmb.append(
                                                //$('<option></option>').text(obj).val(obj)
                                                $('<sp-menu-item' + (!flagSel ? " selected" : "") + '></sp-menu-item>').text(obj).val(obj)
                                            );
                                            flagSel = true;
                                        });

                                        cmb.val(istruzione.valore[0]);
                                        cmb.on('change', function (e) {
                                            let val = e.target.selectedOptions[0]._properties.values().next().value;
                                            $(this).val(val);
                                        });

                                        contInstr.append(cmb);
                                    }
                                    else {
                                        //Valore assegnato forzato
                                        contInstr.append("<input style=\"width:100px;vertical-align:middle;\" class=\"fieldCambioStrutturale\" type=\"text\" readonly disabled id=\"" + istruzione.field + "\" value=\"" + istruzione.valore + "\"></input>");
                                        panelAzioneEl.append('<div class="row" style="display:block;"><div class="col" style="display:block;"><div style="color: white;width:100%;">'+istruzione.field +'</div><div style="100%"><input type="text" class="fieldCambioStrutturale singular-inputTextfield" id="'+istruzione.field +'" readonly style="width: 90%; color: black; background:#dcdc82;" value="'+istruzione.valore+'"></input></div></div></div>');

                                    }
                                }


                            }


                            //$("#azioni_strutturali").append(contInstr);
                            $("#azioni_strutturali").append(panelAzioneEl);

                            let tester = panelAzioneEl.find(".delAzButton");

                            panelAzioneEl.find(".delAzButton").on('click', function () {
                                console.log("Rimuovo azione strutturale: ");
                                console.log($(this).closest(".panel"));
                                $(this).closest(".panel").remove();
                            });


                        }

                        $("#salvaButton").show();


                        // requestAnimationFrame(() => {
                        //     const $tab = $("#Tab5");
                        //     $tab.scrollTop($tab[0].scrollHeight);
                        // });
                        // const $tab = document.getElementById("Tab5");
                        // $tab.scrollTo({
                        //     top: $tab.scrollHeight,
                        //     behavior: "smooth" // Spesso risolve i problemi di freeze dell'hit-area
                        // });

                        // // Piccolo hack per forzare il refresh degli eventi di clic
                        // $("#Tab5").css("opacity", 0.99);
                        setTimeout(() =>                         
                        $("#Tab5").scrollTop($("#Tab5")[0].scrollHeight - $("#Tab5")[0].clientHeight), 50);


                    });

                    let testataCampiOfferta = $("<div style=\"display:flex;\"></div>");
                    let testataCampiOffertaLeft = $("<div style=\"width:50%;display:flex;\"></div>");
                    let testataCampiOffertaRight = $("<div style=\"width:50%;text-align:right;display:flex;\"></div>");

                    //testataCampiOffertaLeft.append(spMenu);
                    testataCampiOffertaLeft.append(spPicker);


                    if (primario.recordInTracciato["Referenza.Codice"] != primario.recordInTracciato["Scatto.CodiceGruppo"]) {
                        //Se si tratta di un gruppo metto la scelta del estendi a tutto il gruppo o solo primario
                        //let cmbMode = $("<select id=\"cmbTipoSalvataggioStrutturale\"><option selected value=\"tutto\">Per tutto il gruppo</option><option value=\"primario\">Solo il primario</option></select>")
                        let cmbMode = $("<sp-picker id=\"cmbTipoSalvataggioStrutturale\">")
                        cmbMode.on('change', function (e) {
                            let val = e.target.selectedOptions[0]._properties.values().next().value;
                            $(this).val(val);
                        })
                            .append(
                                $("<sp-menu slot=\"options\"></sp-menu>")
                                    // .append("<option selected value=\"tutto\">Per tutto il gruppo</option>")
                                    // .append("<option value=\"primario\">Solo il primario</option></select>")
                                    .append("<sp-menu-item selected value=\"tutto\">Per tutto il gruppo</sp-menu-item>")
                                    .append("<sp-menu-item value=\"primario\">Solo il primario</sp-menu-item>")

                            );



                        testataCampiOffertaRight.append(cmbMode);
                    }

                    let btnReset = $("<sp-action-buttom style=\"background-color: #f58ab2;border: 1px solid black;width: 100px;text-align: center;padding-top: 8px;cursor:pointer;margin-left:15px;\">RESET</sp-action-buttom>")
                        .on('click', function () {

                            $("#azioni_strutturali").empty();
                            me.editRefFieldController.checkStato();
                            
                        });

                    testataCampiOffertaRight.append(btnReset)

                    let btnSalva = $("<sp-action-buttom style=\"background-color: #98dc9b;border: 1px solid black;width: 100px;text-align: center;padding-top: 8px;cursor:pointer;\">SALVA</sp-action-buttom >")
                        .on('click', function () {

                        });
                    //testataCampiOffertaRight.append(btnSalva);


                    testataCampiOfferta.append(testataCampiOffertaLeft);
                    testataCampiOfferta.append(testataCampiOffertaRight);

                    divCampiOfferta.append(testataCampiOfferta);//spMenu);
                    divCampiOfferta.append('<div id="azioni_strutturali" style=\"color:white;margin-top:15px;\"></div>');

                    $("#editReferenza").append(divCampiOfferta);
                }
            }



            setTimeout(function () {

                //writeDebugMessageForCrash("Inizio try descrizioni regionali e canale");
                let descr1InArchivio = primario.recordInTracciato["Descrizioni.Descrizione1"];
                let descr2InArchivio = primario.recordInTracciato["Descrizioni.Descrizione2"];
                let descr3InArchivio = primario.recordInTracciato["Descrizioni.Descrizione3"];
                let descr4InArchivio = primario.recordInTracciato["Descrizioni.Descrizione4"];
                let descrIndd = primario.recordInTracciato["Descrizioni.DescrizioneIndd"];
                if (dna.codice != dna.codice_gruppo) {
                    if (primario.recordInTracciato["descrizione_gruppo"] != null) {
                        descr1InArchivio = primario.recordInTracciato["descrizione_gruppo"]["Descrizioni.Descrizione1"];
                        descr2InArchivio = primario.recordInTracciato["descrizione_gruppo"]["Descrizioni.Descrizione2"];
                        descr3InArchivio = primario.recordInTracciato["descrizione_gruppo"]["Descrizioni.Descrizione3"];
                        descr4InArchivio = primario.recordInTracciato["descrizione_gruppo"]["Descrizioni.Descrizione4"];
                        descrIndd = primario.recordInTracciato["descrizione_gruppo"]["Descrizioni.DescrizioneIndd"];
                    }
                }

                let compiledFields = primario.recordInTracciato.compiledFields;

                me.editRefFieldController = new InputEditController($("#editReferenza"), convalidaFirmaRevisione, [descr1InArchivio, descr2InArchivio, descr3InArchivio, descr4InArchivio, descrIndd], compiledFields);
                //writeDebugMessageForCrash("Fine try descrizioni regionali e canale");
            }, 5);

            //I20-992: la pre analisi del box si fa una volta sola, all'apertura della scheda.
            //Prima ripartiva a ogni ritorno alla schermata di edit - anche solo tornando dalle
            //foto - e su box pesanti l'attesa si ripeteva senza che nulla fosse cambiato.
            //Si aggiorna solo con l'Aggiorna del modal o riaprendo la scheda, che passa da
            //svuotaRef e quindi dimentica.
            if (me.segnalazioniInMemoria() == null) {
                me.memorizzaSegnalazioni(await me.differenzeDatiNelBox(box, schedaRef));
            }

            const segnalazioniDellaScheda = me.segnalazioniInMemoria() || [];
            me.aggiornaPulsanteSegnalazioni();

            //I20-992: proposta una volta per scheda. Si segna prima del setTimeout, perche'
            //quello che conta e' la decisione presa qui: se si segnasse dentro la finestra,
            //due passaggi ravvicinati dalla schermata di edit ne aprirebbero due.
            if (me.deveAprirsiDaSola(segnalazioniDellaScheda, codice)) {
                me.segnaSegnalazioniGiaProposte();
                setTimeout(function () {
                    me.mostraModalSegnalazioni();
                }, 5);
            }


            indesignEvents.setBusy(false);

        }
        catch (e) {
            //messaggioUtente("Errore durante il caricamento delle informazioni in formazione scheda ref: " + e, "error");
            console.log(e);
        }

        $("#cambiaMeccanicaButton").attr("codice", codice);
        $("#cambiaMeccanicaButton").show();

        //writeDebugMessageForCrash("Fine init scheda ref");

        hideLoading();
        onresizeWindow();

    },

    /// Riporta nel box la descrizione come la dice il server, senza toccare il dato: allinea
    /// il box a quello che il Report Integrita' si aspetta di leggerci.
    /// I20-993: elimina una variante di descrizione, cioe' la "chiude". Passa dallo stesso
    /// endpoint del revisore, con sender indd: stessa logica, stesso registro, nessuna seconda
    /// strada per cancellare le stesse righe. La nazionale non arriva mai qui, e comunque il
    /// server la rifiuta.
    eliminaVarianteDescrizione(dna, variante, aEliminazioneAvvenuta) {
        var me = this;

        if (!variantiDescrizione.siPuoChiudere(variante)) {
            messaggioUtente("Code SRF-95 La descrizione nazionale non si puo' eliminare", "warning", false, 4);
            return;
        }

        var eSingola = dna.codice === dna.codice_gruppo;

        //RevisoreController e' un Controller senza ApiController: i parametri complessi non si
        //legano dal corpo JSON ma dal form, ed e' cosi' che li manda il revisore. Mandando JSON
        //il binding non legava niente, la coda restava vuota e il server rispondeva Esito falso
        //senza errore, che e' il default di BoolResult.
        //
        //I campi nulli vanno omessi, non mandati vuoti: una stringa vuota si lega come "" e non
        //come null, e il confronto con la colonna nulla non troverebbe la riga.
        var corpo = "idPromo=0";
        corpo += "&coda[0].Codice=" + encodeURIComponent(eSingola ? dna.codice : "");
        corpo += "&coda[0].CodiceGruppo=" + encodeURIComponent(dna.codice_gruppo != null ? dna.codice_gruppo : "");

        if (variante.area != null && String(variante.area).trim() !== "") {
            corpo += "&coda[0].revRegionale.area=" + encodeURIComponent(variante.area);
        }

        if (variante.canale != null && String(variante.canale).trim() !== "") {
            corpo += "&coda[0].revRegionale.canale=" + encodeURIComponent(variante.canale);
        }

        var xhr = new XMLHttpRequestClient();

        xhr.onload = async function (objResult, parsed) {
            if (!parsed) {
                try { objResult = JSON.parse(objResult); }
                catch (e) {
                    messaggioUtente("Code SRF-96 Eliminazione variante: risposta non leggibile: " + e, "error", false, 5);
                    return;
                }
            }

            if (objResult == null) {
                messaggioUtente("Code SRF-97 Eliminazione variante: il server non ha risposto nulla di leggibile", "error", false, 5);
                return;
            }

            if (objResult.esito === false) {
                var motivo = objResult.error != null && objResult.error !== "" ? objResult.error : "nessun motivo indicato dal server";
                messaggioUtente("Code SRF-97 Il server ha rifiutato l'eliminazione: " + motivo, "error", false, 5);
                return;
            }

            messaggioUtente("Descrizione " + variantiDescrizione.etichetta(variante) + " eliminata", "success", false, 4);

            //Non si ricarica la scheda: la rifarebbe con l'elenco di varianti gia' scaricato, in
            //cui quella appena eliminata c'e' ancora, e la linguetta tornerebbe. L'allineamento
            //lo fa chi ha chiesto l'eliminazione, che quell'elenco ce l'ha in mano.
            if (typeof aEliminazioneAvvenuta === "function") {
                aEliminazioneAvvenuta();
            }
        };

        xhr.onerror = function () {
            messaggioUtente("Code SRF-98 Errore di rete durante l'eliminazione della variante", "error", false, 5);
        };

        xhr.send("Revisore/elimina/0/0/1", corpo, "PUT", "application/x-www-form-urlencoded");
    },

    async applicaDescrizioneDaServer() {
        try {
            const contenuto = this.descrizioneCompilataDelPrimario(this.schedeRefDati);

            if (contenuto == null) {
                messaggioUtente("Code SRF-91 Nessuna descrizione compilata dal server per questa referenza", "warning", false, 4);
                return;
            }

            const box = this.refSelected != null ? this.refSelected.item : null;

            if (box == null || !box.isValid) {
                messaggioUtente("Code SRF-92 Il box non e' piu' valido: descrizione non applicata", "error", false, 4);
                return;
            }

            const campo = Utility.getFieldByLabel("descrizione", box);

            if (campo == null) {
                messaggioUtente("Code SRF-93 Il box non ha un campo descrizione", "warning", false, 4);
                return;
            }

            //Lo stesso passaggio che usa il salvataggio delle modifiche: il contenuto e' gia'
            //nella forma a tag di stile di carattere.
            Utility.applicaTagStringToInndTextFrame(campo, contenuto, box.geometricBounds);
            messaggioUtente("Descrizione allineata al dato del server", "success", false, 3);

            //La schermata di edit legge il box: dopo averlo cambiato va rifatta, altrimenti
            //continuerebbe a mostrare la descrizione di prima.
            //
            //I20-992: e va rifatta anche la pre analisi, che altrimenti resterebbe quella di
            //prima e continuerebbe a contare una segnalazione appena risolta. E' l'eccezione al
            //"una volta sola": non e' un ritorno alla schermata, e' il box che e' cambiato per
            //volonta' dell'operatore, quindi vale come l'Aggiorna della finestra. Quello che
            //non si rimette e' l'apertura automatica: il conto si aggiorna, il segnalino
            //sparisce se non resta altro, ma nessuna finestra torna davanti da sola.
            this.dimenticaSegnalazioni();
            await this.selectSchedaRef(1);
        }
        catch (error) {
            console.error(error);
            messaggioUtente("Code SRF-94 Errore applicando la descrizione dal server: " + error.message, "error", false, 5);
        }
    },

    applicaReimpaginazione(){
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length == 0) {
            messaggioUtente("Code SRF-1 Scheda ref non trovata", "error");
            console.error("Code SRF-1 Scheda ref non trovata");
            return;
        }

        var bounds = this.refSelected.item.geometricBounds;
        //offsettiamoli di 10 punti per evitare problemi di margini troppo stretti
        bounds = [bounds[0] - 10, bounds[1] + 10, bounds[2] - 10, bounds[3] + 10];


        var pagina = null;
        try {
            pagina = this.refSelected.item.parentPage.name;
        } catch { }

        if (pagina == null || pagina === "") {
            messaggioUtente("Code SRF-22 Impossibile recuperare la pagina di destinazione.", "error");
            console.error("Code SRF-22 Impossibile recuperare la pagina di destinazione.");
            return;
        }

        impaginazioneSingoloIndd(schedaRef, pagina, false, null, false, bounds);
    },

    mostraSecondaSchermataClonazione(element, idKitLavorazione, selezioneClonazione, allElementGruppo, skipImpaginazione) {
        let me = this;
        var $body = $("#bodyClonaRecord");
        var $footer = $("#footerClonaRecord");

        if (!selezioneClonazione || !selezioneClonazione.item || !selezioneClonazione.item.Dato) {
            messaggioUtente("Code SRF-23 Sorgente clonazione non valida", "error", false, 4);
            return;
        }

        var itemSelezionato = selezioneClonazione.item;

        if (allElementGruppo && allElementGruppo.length > 0) {
            var idTracciato = itemSelezionato.idTracciato;
            var tuttiHannoSorgenteValida = allElementGruppo.every(el => {
                return el.riscontriInAltriTracciati.tuttiRiscontri.find(r => r.idTracciato == idTracciato && r.Dato) != null;
            });

            if (!tuttiHannoSorgenteValida) {
                messaggioUtente("Code SRF-24 Tutti gli elementi del gruppo devono avere una sorgente di clonazione valida e con lo stesso tracciato", "error", false, 5);
                return;
            }
        }

        var dati = [];

        allElementGruppo.forEach(el => {
            var riscontro = el.riscontriInAltriTracciati.tuttiRiscontri.find(r => r.idTracciato == itemSelezionato.idTracciato);
            if (riscontro && riscontro.Dato) {
                dati.push(riscontro.Dato);
            }
        });

        if (!dati || dati.length === 0) {
            messaggioUtente("Code SRF-25 Nessun dato disponibile per la clonazione", "error", false, 4);
            return;
        }

        var listCampiNonEditabili = [];
        var listCampiEditabiliPrioritari = [];

        try { listCampiNonEditabili = pluginMiddleware.getCampo("listCampiNonEditabili") || []; } catch { }
        try { listCampiEditabiliPrioritari = pluginMiddleware.getCampo("listCampiEditabiliPrioritari") || []; } catch { }

        $body.empty();

        var html = "";
        html += "<div class='clona-seconda-schermata' style='height:100%; display:flex; flex-direction:column; gap:8px; padding:10px; box-sizing:border-box; overflow:hidden;'>";

        html += "  <div style='padding:8px 10px; background:#f5f7fa; border:1px solid #d9e1ea; border-radius:8px; flex:0 0 auto;'>";
        html += "      <div style='font-size:16px; font-weight:bold; margin-bottom:2px;'>Modifica dati da clonare</div>";
        html += "      <div style='font-size:12px; color:#666; line-height:1.3;'>Controlla i campi proposti prima di creare il clone.</div>";
        html += "  </div>";

        html += "  <div style='padding:6px 10px; border:1px solid #dcdcdc; border-radius:8px; background:#fff; flex:0 0 auto;'>";
        html += "      <div style='display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; font-size:11px; line-height:1.2;'>";
        html += "          <div style='color:#666;'><b>Sorgente</b>";
        html += "          <b> Promo: </b> " + me.escapeHtml((itemSelezionato.promo || "") + " ") +
            "          <b> Canale: </b> " + me.escapeHtml((itemSelezionato.canale || "") + " ") +
            "          <b> Area: </b> " + me.escapeHtml((itemSelezionato.area || "") + " ") +
            "          <b> Data: </b> " + me.formattaData(itemSelezionato.dataPromo) + "</div>";
        html += "      </div>";
        html += "  </div>";

        html += "  <div style='padding:8px 10px; border:1px solid #dcdcdc; border-radius:8px; background:#fafafa; flex:0 0 auto;'>";
        html += "      <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Referenza da modificare</div>";
        html += "      <sp-picker id='pickerCodiceClonazione' style='width:100%;'>";
        html += "          <sp-menu slot='options' style='white-space:nowrap;'></sp-menu>";
        html += "      </sp-picker>";
        html += "  </div>";

        html += "  <div id='clonaLabelSpecialeContainer' style='flex:0 0 auto;'></div>";

        html += "  <div id='clonaRecordCampiScrollBox' style='padding:10px; border:1px solid #dcdcdc; border-radius:8px; background:#fff; flex:1 1 auto; overflow:auto; position:relative;'>";
        html += "      <div id='clonaRecordCampiContainer'></div>";
        html += "  </div>";

        html += "</div>";

        $body.html(html);

        me.renderPickerCodiciClonazione(dati);
        me.renderSelectLabelClonazione(dati[0]);
        me.renderCampiClonazione(
            dati,
            listCampiNonEditabili,
            listCampiEditabiliPrioritari,
        );

        $footer.html(
            "<div style='height:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; box-sizing:border-box; border-top:1px solid #ddd; background:#fafafa;'>" +
            "   <button type='button' id='btnIndietroClonaRecord' class='btn btn-secondary'>Indietro</button>" +
            "   <button type='button' id='btnEseguiClonaRecord' class='btn btn-primary' style='display:none;'>Clona record</button>" +
            "</div>"
        );

        $("#btnIndietroClonaRecord").off("click").on("click", function () {
            me.apriEMontaDialogClonaRecord(element, idKitLavorazione, allElementGruppo);
        });

        $("#btnEseguiClonaRecord").off("click").on("click", async function () {
            var esito = me.validaTuttiCampiClonazione(true);

            if (!esito.valido) {
                messaggioUtente("Code SRF-26 Alcuni campi non erano validi e sono stati ripristinati. Controlla i valori prima di procedere.", "warning", false, 5);
                return;
            }

            var datiClonazione = me.costruisciDatiFinaliClonazione(selezioneClonazione.item, dati, skipImpaginazione);

            if (!datiClonazione.ok) {
                messaggioUtente("Code SRF-27 " + datiClonazione.messaggio, "warning", false, 5);
                return;
            }

            var campiPrioritariNonModificati = me.getCampiPrioritariClonazioneNonModificati();
            if (campiPrioritariNonModificati.length > 0) {
                var confermaPromemoria = await me.confirmCampiPrioritariClonazioneNonModificati(campiPrioritariNonModificati);
                if (!confermaPromemoria) {
                    return;
                }
            }

            console.log("Dati finali clonazione:", datiClonazione.payloadFinale);

            me.clonaRecord(
                datiClonazione.payloadFinale.label,
                datiClonazione.payloadFinale.idAddestramento,
                datiClonazione.payloadFinale.pagina,
                datiClonazione.payloadFinale.codiceGruppo,
                datiClonazione.payloadFinale.meta
            );
        });
    },

    async clonaRecord(label, idAddestramento, pagina, codiceGruppo, meta) {
        let me = this;
        var codiceBox = "";
        if (pagina != "0"){
            try {
                codiceBox = me.refSelected.item.label;
            } catch (e) {
                console.error("Errore durante il recupero del codiceBox:", e);
                return;
            }
        }
        indesignEvents.setBusy(true);
        showLoading("Clonazione in corso...");

        // Logica per ricollegare il box
        var xhr = new XMLHttpRequestClient();
        xhr.onload = async (objResult, parsed) => {
            try {
                console.log(objResult);
                if (!parsed) {
                    objResult = JSON.parse(objResult);
                }
                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-28 Ricollegamento fallito: " + objResult.error, "error");
                    console.error("Code SRF-28 Ricollegamento fallito: " + objResult.error);
                }

                Utility.closeAllModal();
                if (pagina != "0"){
                    this.initSchedaRef(this.refSelected);
                }else{
                    hideLoading();
                    if (await Utility.confirm("Clonazione completata con successo. Vuoi impaginare subito l'elemento a pagina corrente?")) {
                        showLoading("Impaginazione in corso...");
                        await impaginaSingolo(codiceGruppo, null);
                    }
                }

                indesignEvents.setBusy(false);
                hideLoading();

            }
            catch (e) {
                indesignEvents.setBusy(false);
                hideLoading();
                messaggioUtente("Code SRF-29 errore generico " + e, "error");
                return;
            }
        }

        xhr.onreadystatechange = function () {
            console.log(xhr);
        };

        xhr.onerror = function () {
            indesignEvents.setBusy(false);
            hideLoading();
            console.log("error");
        };
        //creiamo un formData con codiceGruppo e il nome della pagina a cui si trova il box
        var formData = new FormData();
        var req = {
            idAddestramento: idAddestramento,
            pagina: pagina,
            label: label,
            meta: meta,
            codiceBox: codiceBox
        }
        // formData.append("codice", codice);
        // formData.append("pag", box.parentPage.name);
        // xhr.send("Menabo/inserisciBoxInPromoLavorazioniRecord/" + idKitLavorazione, formData, "PUT");                
        //xhr.send("Menabo/inserisciBoxInPromoLavorazioniRecord/" + idKitLavorazione, formData, "PUT");
        formData.append("req", JSON.stringify(req));
        xhr.send("Menabo/ClonaRecordRicollegato/"+idKitLavorazione, formData, "PUT");

    },

    costruisciDatiFinaliClonazione(selezioneClonazione, dati, skipImpaginazione) {
        let me = this;

        var pickerEl = document.getElementById("selectClonaTracciatoLabel");
        var labelSelezionata = "-1";

        if (pickerEl) {
            labelSelezionata = pickerEl.value || "-1";

            if (labelSelezionata === "-1") {
                var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
                if (menuEl) {
                    labelSelezionata = menuEl.getAttribute("selectedoptions") || "-1";
                }
            }
        }

        if (labelSelezionata == null || labelSelezionata === "-1") {
            return {
                ok: false,
                messaggio: "Devi selezionare una label prima di procedere."
            };
        }

        var idAddestramento = null;
        try {
            idAddestramento = selezioneClonazione.idAddestramento;
        } catch { }

        if (idAddestramento == null) {
            return {
                ok: false,
                messaggio: "Impossibile recuperare l'idAddestramento."
            };
        }

        var pagina = "0";
        if (!skipImpaginazione) {
            try {
                pagina = me.refSelected.item.parentPage.name;
            } catch { }

            if (pagina == null || pagina === "") {
                return {
                    ok: false,
                    messaggio: "Impossibile recuperare la pagina di destinazione."
                };
            }
        }

        var payloadRecord = me.costruisciPayloadClonazione(dati);

        if (!Array.isArray(payloadRecord) || payloadRecord.length === 0) {
            return {
                ok: false,
                messaggio: "Nessun record valido da clonare."
            };
        }

        var codiceGruppo = dati[0]["Scatto.CodiceGruppo"];

        var meta = payloadRecord.map(function (record) {
            return JSON.stringify(record);
        });

        return {
            ok: true,
            payloadFinale: {
                label: labelSelezionata,
                idAddestramento: idAddestramento,
                pagina: pagina,
                codiceGruppo: codiceGruppo,
                meta: meta
            }
        };
    },

    aggiornaVisibilitaInputClonazione() {
        var $scrollBox = $("#clonaRecordCampiScrollBox");
        if ($scrollBox.length === 0) return;

        var scrollEl = $scrollBox[0];
        if (!scrollEl || typeof scrollEl.getBoundingClientRect !== "function") return;

        var containerRect = scrollEl.getBoundingClientRect();

        $scrollBox.find("input[type='text'], textarea").each(function () {
            var el = this;
            if (!el || typeof el.getBoundingClientRect !== "function") return;

            // se il parent è nascosto, nascondi anche l'input
            var parent = el.parentElement;
            if (parent && $(parent).css("display") === "none") {
                $(el).css("visibility", "hidden");
                return;
            }

            var rect = el.getBoundingClientRect();

            var fuoriSopra = rect.bottom < containerRect.top;
            var fuoriSotto = rect.top > containerRect.bottom;
            var fuoriSinistra = rect.right < containerRect.left;
            var fuoriDestra = rect.left > containerRect.right;

            if (fuoriSopra || fuoriSotto || fuoriSinistra || fuoriDestra) {
                $(el).css("visibility", "hidden");
            } else {
                $(el).css("visibility", "visible");
            }
        });
    },

    // renderCampiClonazione(datoOriginale, listCampiNonEditabili, listCampiEditabiliPrioritari, listCampiEreditaDalTracciato) {
    //     let me = this;
    //     var $container = $("#clonaRecordCampiContainer");
    //     $container.empty();

    //     var keys = Object.keys(datoOriginale || {}).sort(function (a, b) {
    //         return a.localeCompare(b, undefined, { sensitivity: "base" });
    //     });

    //     var keysPrioritari = [];
    //     var keysAltri = [];

    //     keys.forEach(function (key) {
    //         if (listCampiNonEditabili.includes(key)) return;
    //         if (key === "Tracciato.Label") return;
    //         if (!me.isCampoPrimitiveEditable(datoOriginale[key])) return;

    //         if (listCampiEditabiliPrioritari.includes(key)) {
    //             keysPrioritari.push(key);
    //         } else {
    //             keysAltri.push(key);
    //         }
    //     });

    //     var html = "";

    //     html += "<div id='clonaLabelSpecialeContainer'></div>";

    //     html += "<div style='margin-bottom:10px;'>";
    //     html += "  <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Campi in evidenza</div>";
    //     html += "  <div id='clonaCampiPrioritari'></div>";
    //     html += "</div>";

    //     html += "<div style='margin-top:8px;'>";
    //     html += "  <button type='button' id='btnToggleAltriCampiClona' class='btn btn-secondary' style='width:100%;'>Mostra altri campi</button>";
    //     html += "  <div id='clonaCampiAltriWrapper' style='display:none; margin-top:10px;'>";
    //     html += "      <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Tutti i campi</div>";
    //     html += "      <div id='clonaCampiAltri'></div>";
    //     html += "  </div>";
    //     html += "</div>";

    //     $container.html(html);

    //     me.renderSelectLabelClonazione(datoOriginale);

    //     keysPrioritari.forEach(function (key) {
    //         $("#clonaCampiPrioritari").append(
    //             me.creaEditorCampoClonazione(key, datoOriginale, listCampiEreditaDalTracciato)
    //         );
    //     });

    //     keysAltri.forEach(function (key) {
    //         $("#clonaCampiAltri").append(
    //             me.creaEditorCampoClonazione(key, datoOriginale, listCampiEreditaDalTracciato)
    //         );
    //     });

    //     $("#btnToggleAltriCampiClona").off("click").on("click", function () {
    //         var $wrap = $("#clonaCampiAltriWrapper");
    //         var visible = $wrap.css("display") !== "none";

    //         if (visible) {
    //             $wrap.css("display", "none");
    //             $(this).text("Mostra altri campi");
    //         } else {
    //             $wrap.css("display", "block");
    //             $(this).text("Nascondi altri campi");
    //         }

    //         setTimeout(function () {
    //             me.aggiornaVisibilitaInputClonazione();
    //         }, 0);
    //     });

    //     $("#clonaRecordCampiContainer")
    //         .off("blur", ".campo-clonazione-input")
    //         .on("blur", ".campo-clonazione-input", function () {
    //             me.validaCampoClonazione($(this), false);
    //         });

    //     var $scrollBox = $("#clonaRecordCampiScrollBox");

    //     $scrollBox.off("scroll.clonaInputVis");
    //     $scrollBox.on("scroll.clonaInputVis", function () {
    //         me.aggiornaVisibilitaInputClonazione();
    //     });

    //     $(window).off("resize.clonaInputVis");
    //     $(window).on("resize.clonaInputVis", function () {
    //         me.aggiornaVisibilitaInputClonazione();
    //     });

    //     setTimeout(function () {
    //         me.aggiornaVisibilitaInputClonazione();
    //     }, 0);
    // },
    
    renderCampiClonazione(dati, listCampiNonEditabili, listCampiEditabiliPrioritari) {
        let me = this;
        var $container = $("#clonaRecordCampiContainer");
        $container.empty();

        if (!Array.isArray(dati) || dati.length === 0) {
            $container.html("<div style='color:#777;'>Nessun dato disponibile.</div>");
            return;
        }

        dati.forEach(function (datoOriginale, index) {
            var codice = (datoOriginale && datoOriginale["Referenza.Codice"] != null) ? String(datoOriginale["Referenza.Codice"]) : ("record_" + index);

            var keys = Object.keys(datoOriginale || {}).sort(function (a, b) {
                return a.localeCompare(b, undefined, { sensitivity: "base" });
            });

            var keysPrioritari = [];
            var keysAltri = [];

            keys.forEach(function (key) {
                if (listCampiNonEditabili.includes(key)) return;
                if (key === "Tracciato.Label") return;
                if (!me.isCampoPrimitiveEditable(datoOriginale[key])) return;

                if (listCampiEditabiliPrioritari.includes(key)) {
                    keysPrioritari.push(key);
                } else {
                    keysAltri.push(key);
                }
            });

            var safeCodice = me.escapeHtmlAttr(codice);
            var html = "";

            html += "<div class='contenitore-codice-clonazione' data-codice='" + safeCodice + "' style='display:none;'>";

            html += "  <div style='margin-bottom:10px;'>";
            html += "      <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Campi in evidenza</div>";
            html += "      <div id='clonaCampiPrioritari_" + safeCodice + "'></div>";
            html += "  </div>";

            html += "  <div style='margin-top:8px;'>";
            html += "      <button type='button' class='btn btn-secondary btnToggleAltriCampiClona' data-codice='" + safeCodice + "' style='width:100%;'>Mostra altri campi</button>";
            html += "      <div id='clonaCampiAltriWrapper_" + safeCodice + "' style='display:none; margin-top:10px;'>";
            html += "          <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Tutti i campi</div>";
            html += "          <div id='clonaCampiAltri_" + safeCodice + "'></div>";
            html += "      </div>";
            html += "  </div>";

            html += "</div>";

            $container.append(html);

            keysPrioritari.forEach(function (key) {
                $("#clonaCampiPrioritari_" + me.escapeSelector(codice)).append(
                    me.creaEditorCampoClonazione(key, datoOriginale, codice, true)
                );
            });

            keysAltri.forEach(function (key) {
                $("#clonaCampiAltri_" + me.escapeSelector(codice)).append(
                    me.creaEditorCampoClonazione(key, datoOriginale, codice)
                );
            });
        });

        $(".btnToggleAltriCampiClona").off("click").on("click", function () {
            var codice = $(this).attr("data-codice");
            var $wrap = $("#clonaCampiAltriWrapper_" + me.escapeSelector(codice));
            var visible = $wrap.css("display") !== "none";

            if (visible) {
                $wrap.css("display", "none");
                $(this).text("Mostra altri campi");
            } else {
                $wrap.css("display", "block");
                $(this).text("Nascondi altri campi");
            }

            setTimeout(function () {
                me.aggiornaVisibilitaInputClonazione();
            }, 0);
        });

        $("#clonaRecordCampiContainer")
            .off("blur", ".campo-clonazione-input")
            .on("blur", ".campo-clonazione-input", function () {
                me.validaCampoClonazione($(this), false);
            });

        var $scrollBox = $("#clonaRecordCampiScrollBox");

        $scrollBox.off("scroll.clonaInputVis");
        $scrollBox.on("scroll.clonaInputVis", function () {
            me.aggiornaVisibilitaInputClonazione();
        });

        $(window).off("resize.clonaInputVis");
        $(window).on("resize.clonaInputVis", function () {
            me.aggiornaVisibilitaInputClonazione();
        });

        var primoCodice = dati[0] && dati[0]["Referenza.Codice"] != null ? String(dati[0]["Referenza.Codice"]) : "record_0";
        me.mostraContainerCodiceClonazione(primoCodice);

        setTimeout(function () {
            me.aggiornaVisibilitaInputClonazione();
        }, 0);
    },

    renderPickerCodiciClonazione(dati) {
        let me = this;

        var pickerEl = document.getElementById("pickerCodiceClonazione");
        if (!pickerEl) return;

        var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
        if (!menuEl) return;

        menuEl.innerHTML = "";

        var primoCodice = null;

        dati.forEach(function (dato, index) {
            var codice = (dato && dato["Referenza.Codice"] != null) ? String(dato["Referenza.Codice"]) : ("record_" + index);

            if (primoCodice == null) {
                primoCodice = codice;
            }

            var item = document.createElement("sp-menu-item");
            item.setAttribute("value", codice);
            item.textContent = codice;

            if (index === 0) {
                item.setAttribute("selected", "");
            }

            menuEl.appendChild(item);
        });

        if (primoCodice == null) return;

        pickerEl.value = primoCodice;
        menuEl.setAttribute("selectedoptions", primoCodice);

        pickerEl.removeEventListener("change", me._onPickerCodiceClonazioneChangeBound || function () { });

        me._onPickerCodiceClonazioneChangeBound = function () {
            var codiceSelezionato = pickerEl.value || menuEl.getAttribute("selectedoptions");
            me.mostraContainerCodiceClonazione(codiceSelezionato);
        };

        pickerEl.addEventListener("change", me._onPickerCodiceClonazioneChangeBound);

        me.mostraContainerCodiceClonazione(primoCodice);
    },

    mostraContainerCodiceClonazione(codiceSelezionato) {
        $(".contenitore-codice-clonazione").css("display", "none");

        $(".contenitore-codice-clonazione").each(function () {
            if ($(this).attr("data-codice") === String(codiceSelezionato)) {
                $(this).css("display", "block");
            }
        });

        let me = this;
        setTimeout(function () {
            me.aggiornaVisibilitaInputClonazione();
        }, 0);
    },

    // renderSelectLabelClonazione(datoOriginale) {
    //     let me = this;
    //     var $container = $("#clonaLabelSpecialeContainer");
    //     $container.empty();

    //     var labelsDisponibili = me.recuperaLabelsDisponibiliDaKit();
    //     var valoreIniziale = "-1";

    //     if (
    //         datoOriginale &&
    //         typeof datoOriginale["Tracciato.Label"] !== "undefined" &&
    //         datoOriginale["Tracciato.Label"] != null
    //     ) {
    //         valoreIniziale = String(datoOriginale["Tracciato.Label"]);
    //     }

    //     var html = "";
    //     html += "<div style='margin-bottom:12px; padding:10px; border:1px solid #dcdcdc; border-radius:8px; background:#fafafa;'>";
    //     html += "  <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Label tracciato</div>";
    //     html += "  <sp-picker id='selectClonaTracciatoLabel' style='width:100%;'>";
    //     html += "      <sp-menu slot='options' style='white-space:nowrap;'>";
    //     html += "          <sp-menu-item value='-1'>Seleziona label</sp-menu-item>";

    //     labelsDisponibili.forEach(function (label) {
    //         html += "      <sp-menu-item value='" + me.escapeHtmlAttr(label) + "'>" + me.escapeHtml(label) + "</sp-menu-item>";
    //     });

    //     html += "      </sp-menu>";
    //     html += "  </sp-picker>";
    //     html += "</div>";

    //     $container.html(html);

    //     var pickerEl = document.getElementById("selectClonaTracciatoLabel");
    //     if (!pickerEl) return;

    //     var valoreFinale = labelsDisponibili.includes(valoreIniziale) ? valoreIniziale : "-1";
    //     pickerEl.value = valoreFinale;

    //     var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
    //     if (menuEl) {
    //         menuEl.setAttribute("selectedoptions", valoreFinale);

    //         var items = menuEl.querySelectorAll("sp-menu-item");
    //         items.forEach(function (item) {
    //             if (item.getAttribute("value") === valoreFinale) {
    //                 item.setAttribute("selected", "");
    //             } else {
    //                 item.removeAttribute("selected");
    //             }
    //         });
    //     }
    // },

    renderSelectLabelClonazione(datoOriginale) {
        let me = this;
        var $container = $("#clonaLabelSpecialeContainer");
        $container.empty();

        var labelsDisponibili = me.recuperaLabelsDisponibiliDaKit();
        var valoreIniziale = "-1";

        if (
            datoOriginale &&
            typeof datoOriginale["Tracciato.Label"] !== "undefined" &&
            datoOriginale["Tracciato.Label"] != null
        ) {
            valoreIniziale = String(datoOriginale["Tracciato.Label"]);
        }

        var html = "";
        html += "<div style='padding:8px 10px; border:1px solid #dcdcdc; border-radius:8px; background:#fafafa;'>";
        html += "  <div style='font-size:13px; font-weight:bold; margin-bottom:4px;'>Label tracciato</div>";
        html += "  <sp-picker id='selectClonaTracciatoLabel' style='width:100%;'>";
        html += "      <sp-menu slot='options' style='white-space:nowrap;'>";
        html += "          <sp-menu-item value='-1'>Seleziona label</sp-menu-item>";

        labelsDisponibili.forEach(function (label) {
            html += "      <sp-menu-item value='" + me.escapeHtmlAttr(label) + "'>" + me.escapeHtml(label) + "</sp-menu-item>";
        });

        html += "      </sp-menu>";
        html += "  </sp-picker>";
        html += "</div>";

        $container.html(html);

        var pickerEl = document.getElementById("selectClonaTracciatoLabel");
        if (!pickerEl) return;

        var valoreFinale = labelsDisponibili.includes(valoreIniziale) ? valoreIniziale : "-1";
        pickerEl.value = valoreFinale;

        var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
        if (menuEl) {
            menuEl.setAttribute("selectedoptions", valoreFinale);

            var items = menuEl.querySelectorAll("sp-menu-item");
            items.forEach(function (item) {
                if (item.getAttribute("value") === valoreFinale) {
                    item.setAttribute("selected", "");
                } else {
                    item.removeAttribute("selected");
                }
            });
        }

        pickerEl.removeEventListener("change", me._onLabelClonazioneChangeBound || function () { });

        me._onLabelClonazioneChangeBound = function () {
            if (menuEl) {
                menuEl.setAttribute("selectedoptions", pickerEl.value || "-1");
            }
            me.aggiornaVisibilitaBottoneClonaRecord();
        };

        pickerEl.addEventListener("change", me._onLabelClonazioneChangeBound);

        //me.aggiornaVisibilitaBottoneClonaRecord();
    },

    recuperaLabelsDisponibiliDaKit() {
        var labels = [];

        try {
            if (
                typeof contenutoKitInLavorazione !== "undefined" &&
                contenutoKitInLavorazione &&
                Array.isArray(contenutoKitInLavorazione.records)
            ) {
                contenutoKitInLavorazione.records.forEach(function (recordKit) {
                    if (!recordKit || !recordKit.recordInTracciato) return;

                    var label = recordKit.recordInTracciato["Tracciato.Label"];
                    if (label == null) return;

                    label = String(label).trim();
                    if (!label) return;

                    if (!labels.includes(label)) {
                        labels.push(label);
                    }
                });
            }
        } catch { }

        labels.sort(function (a, b) {
            return a.localeCompare(b, undefined, { sensitivity: "base" });
        });

        return labels;
    },

    aggiornaVisibilitaBottoneClonaRecord() {
        var $btn = $("#btnEseguiClonaRecord");
        if ($btn.length === 0) return;

        var pickerEl = document.getElementById("selectClonaTracciatoLabel");
        var labelSelezionata = "-1";

        if (pickerEl) {
            labelSelezionata = pickerEl.value || "-1";

            if (labelSelezionata === "-1") {
                var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
                if (menuEl) {
                    labelSelezionata = menuEl.getAttribute("selectedoptions") || "-1";
                }
            }
        }

        if (labelSelezionata && labelSelezionata !== "-1") {
            $btn.show();
        } else {
            $btn.hide();
        }
    },

    // creaEditorCampoClonazione(key, datoOriginale) {
    //     let me = this;

    //     var valoreOriginale = typeof datoOriginale[key] === "undefined" ? null : datoOriginale[key];
    //     var valoreCorrente = valoreOriginale;

    //     var tipoAtteso = me.getTipoCampoClonazione(valoreOriginale);
    //     var inheritedBadge = listCampiEreditaDalTracciato.includes(key)
    //         ? "<span style='font-size:10px; color:#2b5fab; margin-left:6px;'>(ereditato dal tracciato)</span>"
    //         : "";

    //     var $row = $("<div style='display:block; width:100%; margin-bottom:6px;'></div>");

    //     var labelHtml = "";
    //     labelHtml += "<div style='font-size:11px; font-weight:bold; margin-bottom:3px; word-break:break-word; line-height:1.2;'>";
    //     labelHtml += me.escapeHtml(key) + inheritedBadge;
    //     labelHtml += "</div>";

    //     $row.append($(labelHtml));

    //     if (tipoAtteso === "boolean") {
    //         var $checkboxWrap = $("<div style='padding:3px 0;'></div>");
    //         var $checkbox = $(
    //             "<input type='checkbox' class='campo-clonazione-input' " +
    //             "data-key='" + me.escapeHtmlAttr(key) + "' " +
    //             "data-tipo-atteso='boolean' " +
    //             "data-valore-originale='" + me.escapeHtmlAttr(JSON.stringify(!!valoreCorrente)) + "'" +
    //             " />"
    //         );

    //         $checkbox.prop("checked", !!valoreCorrente);
    //         $checkboxWrap.append($checkbox);
    //         $row.append($checkboxWrap);
    //     } else {
    //         var valoreStringa = valoreCorrente == null ? "" : String(valoreCorrente);

    //         var $input = $(
    //             "<input type='text' class='campo-clonazione-input' " +
    //             "style='width:100%; margin: 0px; box-sizing:border-box;' " +
    //             "data-key='" + me.escapeHtmlAttr(key) + "' " +
    //             "data-tipo-atteso='" + me.escapeHtmlAttr(tipoAtteso) + "' " +
    //             "data-valore-originale='" + me.escapeHtmlAttr(JSON.stringify(valoreCorrente)) + "' " +
    //             "value='" + me.escapeHtmlAttr(valoreStringa) + "'" +
    //             " />"
    //         );

    //         $row.append($input);
    //     }

    //     return $row;
    // },

    creaEditorCampoClonazione(key, datoOriginale, codice, isPrioritario = false) {
        let me = this;

        var valoreOriginale = typeof datoOriginale[key] === "undefined" ? null : datoOriginale[key];
        var valoreCorrente = valoreOriginale;
        var attrPrioritario = isPrioritario ? "data-prioritario='true' " : "";

        var tipoAtteso = me.getTipoCampoClonazione(valoreOriginale);
        var $row = $("<div style='display:block; width:100%; margin-bottom:6px;'></div>");

        var labelHtml = "";
        labelHtml += "<div style='font-size:11px; font-weight:bold; margin-bottom:3px; word-break:break-word; line-height:1.2;'>";
        labelHtml += me.escapeHtml(key);
        labelHtml += "</div>";

        $row.append($(labelHtml));

        if (tipoAtteso === "boolean") {
            var $checkboxWrap = $("<div style='padding:3px 0;'></div>");
            var $checkbox = $(
                "<input type='checkbox' class='campo-clonazione-input' " +
                "data-codice='" + me.escapeHtmlAttr(codice) + "' " +
                "data-key='" + me.escapeHtmlAttr(key) + "' " +
                "data-tipo-atteso='boolean' " +
                attrPrioritario +
                "data-valore-originale='" + me.escapeHtmlAttr(JSON.stringify(!!valoreCorrente)) + "'" +
                " />"
            );

            $checkbox.prop("checked", !!valoreCorrente);
            $checkboxWrap.append($checkbox);
            $row.append($checkboxWrap);
        } else {
            var valoreStringa = valoreCorrente == null ? "" : String(valoreCorrente);

            var $input = $(
                "<input type='text' class='campo-clonazione-input' " +
                "style='width:100%; margin:0px; box-sizing:border-box;' " +
                "data-codice='" + me.escapeHtmlAttr(codice) + "' " +
                "data-key='" + me.escapeHtmlAttr(key) + "' " +
                "data-tipo-atteso='" + me.escapeHtmlAttr(tipoAtteso) + "' " +
                attrPrioritario +
                "data-valore-originale='" + me.escapeHtmlAttr(JSON.stringify(valoreCorrente)) + "' " +
                "value='" + me.escapeHtmlAttr(valoreStringa) + "'" +
                " />"
            );

            $row.append($input);
        }

        return $row;
    },

    isCampoPrimitiveEditable(value) {
        if (value == null) return true;

        var t = typeof value;
        if (t === "string" || t === "number" || t === "boolean") return true;

        return false;
    },

    getTipoCampoClonazione(value) {
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return "number";
        return "string";
    },

    validaCampoClonazione($campo, silent) {
        let me = this;

        if (!$campo || $campo.length === 0) {
            return { valido: true };
        }

        var key = $campo.attr("data-key");
        var tipoAtteso = $campo.attr("data-tipo-atteso");
        var valoreOriginaleRaw = $campo.attr("data-valore-originale");
        var valoreOriginale;

        try {
            valoreOriginale = JSON.parse(valoreOriginaleRaw);
        } catch {
            valoreOriginale = null;
        }

        if (tipoAtteso === "boolean") {
            return { valido: true, valore: $campo.is(":checked") };
        }

        var valoreInserito = $campo.val();

        if (tipoAtteso === "number") {
            if (valoreInserito == null || String(valoreInserito).trim() === "" || isNaN(Number(valoreInserito))) {
                $campo.val(valoreOriginale == null ? "" : String(valoreOriginale));

                if (!silent) {
                    messaggioUtente("Code SRF-26 Valore non valido ripristinato per il campo: " + key, "warning", false, 4);
                }

                return { valido: false, valore: valoreOriginale };
            }

            return { valido: true, valore: Number(valoreInserito) };
        }

        return { valido: true, valore: valoreInserito == null ? "" : String(valoreInserito) };
    },

    validaTuttiCampiClonazione(silent) {
        let me = this;
        var valido = true;

        $(".campo-clonazione-input").each(function () {
            var esito = me.validaCampoClonazione($(this), silent);
            if (!esito.valido) {
                valido = false;
            }
        });

        return { valido: valido };
    },

    getCampiPrioritariClonazioneNonModificati() {
        let me = this;
        var result = [];
        var giaInseriti = {};

        $(".campo-clonazione-input[data-prioritario='true']").each(function () {
            var $campo = $(this);
            var key = $campo.attr("data-key") || "";
            var codice = $campo.attr("data-codice") || "";
            var tipoAtteso = $campo.attr("data-tipo-atteso");
            var valoreOriginaleRaw = $campo.attr("data-valore-originale");
            var valoreOriginale;

            try {
                valoreOriginale = JSON.parse(valoreOriginaleRaw);
            } catch {
                valoreOriginale = null;
            }

            var valoreCorrente = null;
            var nonModificato = false;

            if (tipoAtteso === "boolean") {
                valoreCorrente = $campo.is(":checked");
                nonModificato = !!valoreOriginale === valoreCorrente;
            }
            else if (tipoAtteso === "number") {
                valoreCorrente = Number($campo.val());
                nonModificato = Number(valoreOriginale) === valoreCorrente;
            }
            else {
                valoreCorrente = $campo.val();
                var testoOriginale = valoreOriginale == null ? "" : String(valoreOriginale);
                var testoCorrente = valoreCorrente == null ? "" : String(valoreCorrente);
                nonModificato = testoOriginale === testoCorrente;
            }

            if (!nonModificato) {
                return;
            }

            var idCampo = codice + "$" + key;
            if (giaInseriti[idCampo]) {
                return;
            }

            giaInseriti[idCampo] = true;
            result.push({
                codice: codice,
                key: key
            });
        });

        return result;
    },

    async confirmCampiPrioritariClonazioneNonModificati(campi) {
        if (!Array.isArray(campi) || campi.length === 0) {
            return true;
        }

        var maxCampiVisibili = 20;
        var $container = $("<div style='display:flex; flex-direction:column; gap:8px; color:black; font-size:13px; line-height:1.35; width:100%;'></div>");
        $container.append("<div style='font-size:16px; font-weight:bold;'>Campi prioritari non modificati</div>");
        $container.append("<div>Prima di clonare, controlla questi campi in evidenza: risultano ancora uguali ai valori della sorgente.</div>");

        var $lista = $("<div style='max-height:150px; overflow:auto; border:1px solid #ddd; background:#fafafa; padding:8px;'></div>");

        campi.slice(0, maxCampiVisibili).forEach(function (campo) {
            var testo = campo.key || "";
            if (campo.codice) {
                testo = campo.codice + " - " + testo;
            }

            $("<div style='margin-bottom:4px; word-break:break-word;'></div>")
                .text(testo)
                .appendTo($lista);
        });

        if (campi.length > maxCampiVisibili) {
            $("<div style='margin-top:6px; color:#666;'></div>")
                .text("... altri " + (campi.length - maxCampiVisibili) + " campi non modificati")
                .appendTo($lista);
        }

        $container.append($lista);
        $container.append("<div style='font-weight:bold;'>Vuoi procedere comunque con la clonazione?</div>");

        return await Utility.confirm($container);
    },

    // costruisciPayloadClonazione(datoOriginale, listCampiEreditaDalTracciato) {
    //     let me = this;

    //     var payload = $.extend(true, {}, datoOriginale);

    //     $(".campo-clonazione-input").each(function () {
    //         var $campo = $(this);
    //         var key = $campo.attr("data-key");
    //         var tipoAtteso = $campo.attr("data-tipo-atteso");

    //         if (tipoAtteso === "boolean") {
    //             payload[key] = $campo.is(":checked");
    //             return;
    //         }

    //         var value = $campo.val();

    //         if (tipoAtteso === "number") {
    //             payload[key] = Number(value);
    //             return;
    //         }

    //         payload[key] = value;
    //     });

    //     var pickerEl = document.getElementById("selectClonaTracciatoLabel");
    //     var labelSelezionata = "-1";

    //     if (pickerEl) {
    //         labelSelezionata = pickerEl.value || "-1";

    //         if (labelSelezionata === "-1") {
    //             var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
    //             if (menuEl) {
    //                 labelSelezionata = menuEl.getAttribute("selectedoptions") || "-1";
    //             }
    //         }
    //     }

    //     if (labelSelezionata != null && labelSelezionata !== "-1") {
    //         payload["Tracciato.Label"] = labelSelezionata;
    //     }

    //     return payload;
    // },

    costruisciPayloadClonazione(dati) {
        let me = this;
        var payload = [];

        if (!Array.isArray(dati)) return payload;

        var pickerEl = document.getElementById("selectClonaTracciatoLabel");
        var labelSelezionata = "-1";

        if (pickerEl) {
            labelSelezionata = pickerEl.value || "-1";

            if (labelSelezionata === "-1") {
                var menuEl = pickerEl.querySelector("sp-menu[slot='options']");
                if (menuEl) {
                    labelSelezionata = menuEl.getAttribute("selectedoptions") || "-1";
                }
            }
        }

        dati.forEach(function (datoOriginale, index) {
            var codice = (datoOriginale && datoOriginale["Referenza.Codice"] != null)
                ? String(datoOriginale["Referenza.Codice"])
                : ("record_" + index);

            var recordPayload = $.extend(true, {}, datoOriginale);

            $(".campo-clonazione-input[data-codice='" + me.escapeSelector(codice) + "']").each(function () {
                var $campo = $(this);
                var key = $campo.attr("data-key");
                var tipoAtteso = $campo.attr("data-tipo-atteso");

                if (tipoAtteso === "boolean") {
                    recordPayload[key] = $campo.is(":checked");
                    return;
                }

                var value = $campo.val();

                if (tipoAtteso === "number") {
                    recordPayload[key] = Number(value);
                    return;
                }

                recordPayload[key] = value;
            });

            if (labelSelezionata != null && labelSelezionata !== "-1") {
                recordPayload["Tracciato.Label"] = labelSelezionata;
            }

            payload.push(recordPayload);
        });

        return payload;
    },

    escapeHtmlAttr(value) {
        if (value == null) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },

    escapeSelector(value) {
        if (value == null) return "";
        return String(value).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1");
    },

    creaTestoInfo(listItem, opts = {}) {

        // helper: escape HTML per mettere testo dentro tag senza romperli
        function escHtml(s) {
            return String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        // helper: escape per attributi (title, data-*)
        function escAttr(s) {
            return escHtml(s).replace(/\r?\n/g, " "); // title multiline spesso è brutto: lo appiattisco
        }

        // stringify “robusto” per valori complessi
        function stringifySmart(v, opts = {}) {
            const cfg = Object.assign({
                maxLen: 2000,   // limite per evitare title enormi
                indent: 0       // 0 = una riga, >0 = pretty (sconsigliato per title)
            }, opts);

            if (v === null) return "null";
            if (v === undefined) return "undefined";

            const t = typeof v;

            if (t === "string") return v;
            if (t === "number" || t === "boolean" || t === "bigint") return String(v);
            if (t === "symbol") return String(v);
            if (t === "function") return "[Function]";

            try {
                if (v instanceof Date) return isNaN(v.getTime()) ? "Invalid Date" : v.toISOString();
                if (v instanceof Error) return v.stack || v.message || String(v);
            } catch (e) { }

            // Gestione circular + fallback
            const seen = new Set();
            const replacer = (key, val) => {
                if (typeof val === "object" && val !== null) {
                    if (seen.has(val)) return "[Circular]";
                    seen.add(val);
                }
                if (typeof val === "function") return "[Function]";
                if (typeof val === "symbol") return String(val);
                return val;
            };

            let s;
            try {
                s = JSON.stringify(v, replacer, cfg.indent);
                if (s === undefined) s = String(v);
            } catch (e) {
                try { s = String(v); } catch (e2) { s = "[Unstringifiable]"; }
            }

            if (s.length > cfg.maxLen) s = s.slice(0, cfg.maxLen - 1) + "…";
            return s;
        }

        function clampText(full, maxChars) {
            const s = String(full);
            if (s.length <= maxChars) return { shown: s, full: s, truncated: false };
            return { shown: s.slice(0, Math.max(0, maxChars - 2)) + "…", full: s, truncated: true };
        }
        const cfg = Object.assign({
            maxKeyChars: 20,
            maxValueChars: 120,
            keyMinWidthPx: 160,
            keyMaxWidthPx: 400,
            maxFullValueLen: 2000 // limite per title/data-copy
        }, opts);

        let content = "";

        for (let i = 0; i < listItem.length; i++) {
            const item = listItem[i] || {};
            const color = item.color && item.color !== "" ? item.color : null;

            const labelFull = stringifySmart(item.label ?? "", { maxLen: cfg.maxFullValueLen });
            const valueFull = stringifySmart(item.value ?? item.valore ?? "", { maxLen: cfg.maxFullValueLen });

            const labelC = clampText(labelFull, cfg.maxKeyChars);
            const valueC = clampText(valueFull, cfg.maxValueChars);

            const rowBg = i % 2 === 0 ? "background-color: rgba(255,255,255,0.03);" : "";
            //I20-981: su un pannello stretto etichetta e valore non ci stanno affiancati e il
            //valore veniva schiacciato: ora vanno a capo, e il valore puo' spezzarsi.
            const rowStyle = "padding:4px 6px; margin-bottom:2px; line-height:1.5; font-size:13px; display:flex; flex-wrap:wrap; align-items:flex-start;" + rowBg;

            const labelStyle =
                (color ? "color:" + color + ";" : "") +
                "font-weight:600; margin-right:6px; display:inline-block; min-width:" + cfg.keyMinWidthPx + "px; max-width:100%;" +
                "cursor:pointer; user-select:text; border-radius:4px; padding:1px 3px;";

            const valueStyle =
                (color ? "color:" + color + ";" : "") +
                "opacity:0.95; cursor:pointer; user-select:text; border-radius:4px; padding:1px 3px;" +
                "min-width:0; overflow-wrap:anywhere; word-break:break-word;";

            // data-copy = testo completo (quello che copio)
            // title = testo completo (per leggere tutto)
            content +=
                "<div class='row' style=\"" + rowStyle + "\">" +
                "<strong class='tt-copy' " +
                "style=\"" + labelStyle + "\" " +
                "title=\"" + escAttr(labelFull) + "\" " +
                "data-copy=\"" + escAttr(labelFull) + "\">" +
                escHtml(labelC.shown) + ":" +
                "</strong>" +
                "<span class='tt-copy' " +
                "style=\"" + valueStyle + "\" " +
                "title=\"" + escAttr(valueFull) + "\" " +
                "data-copy=\"" + escAttr(valueFull) + "\">" +
                escHtml(valueC.shown) +
                "</span>" +
                "</div>";
        }

        return content;
    },

    scaricaJson() {
        var datoDaScaricare = $("#infoPerLeggiInfoRef").data("datoDaScaricare");
        if (datoDaScaricare != null) {
            var recordInTracciato = datoDaScaricare.recordInTracciato != null ? datoDaScaricare.recordInTracciato : datoDaScaricare;
            var codiceDato = (recordInTracciato["Scatto.CodiceGruppo"] || recordInTracciato["Referenza.Codice"] || "dato").toString().substring(0, 20);
            var fileNameDato = "schedaRef_" + codiceDato + ".json";

            fs.writeFileSync(pathLavorazione + "/" + fileNameDato, JSON.stringify(datoDaScaricare));
            messaggioUtente("File salvato in: " + pathLavorazione + "/" + fileNameDato, "success", false, 0, true, true);
            return;
        }

        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length == 0) {
            messaggioUtente("Code SRF-27 Nessuna scheda referenza caricata", "error", false, 0, true, true);
            return;
        }
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-28 Nessun primario trovato", "error", false, 0, true, true);
            return;
        }

        var codiceGruppo = (primario.recordInTracciato["Scatto.CodiceGruppo"] || "").toString().substring(0, 20);
        var fileName = "schedaRef_" + codiceGruppo + ".json";
        //scriviamo il file
        fs.writeFileSync(pathLavorazione + "/" + fileName, JSON.stringify(primario));

        messaggioUtente("File salvato in: " + pathLavorazione + "/" + fileName, "success", false, 0, true, true);
    },

    bindCopyOnTooltipTextOnce() {
        // evita doppio bind
        if (window.__ttCopyBound) return;
        window.__ttCopyBound = true;

        $(document).on("click", ".tt-copy", function (e) {
            e.preventDefault();
            e.stopPropagation();

            const $el = $(this);
            const textToCopy = $el.attr("data-copy") || "";

            navigator.clipboard.writeText(textToCopy).then(() => {
                const prevBg = $el.css("background-color");
                $el.css("background-color", "rgba(80, 200, 120, 0.25)");
                setTimeout(() => $el.css("background-color", prevBg), 800);
            });
        });
    },

    salvaModifiche(schedaRef, codice, box, meccanica, page) {
        try {
            console.log("Salva modifiche " + codice);

            let me = this;

            //cerchiamo il primario nella schedaRef
            let primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
            if (primario == null) {
                messaggioUtente("Code SRF-28 Nessun primario trovato", "error");
                return;
            }   

            //descrizioneEreditata è un bool che è vero se la ref è un gruppo (codice != codice_gruppo) e descrizione_gruppo non esiste come chiave
            let descrizioneEreditata = (primario.recordInTracciato["Referenza.Codice"] != primario.recordInTracciato["Scatto.CodiceGruppo"]) && !(primario.recordInTracciato.hasOwnProperty("descrizione_gruppo"));

            //I20-996: una variante appena creata e' lo stesso caso, e va scritta per intero. Senza
            //questo i campi non toccati partono come "non toccato", e in creazione non c'e' niente
            //da lasciare com'era: nascerebbero vuoti. Il server se ne difende ereditando dalla
            //nazionale, ma il posto giusto per dirlo e' qui, dove si sa che la variante e' nuova.
            if (this.varianteDescrizioneScelta != null && this.varianteDescrizioneScelta.nuova === true) {
                descrizioneEreditata = true;
            }
            //Chiedo al controller le operazioni che devo fare
            let opResult = this.editRefFieldController.getOperazioniDiSalvataggioDaFare(descrizioneEreditata);
            console.log(opResult);


            if(box == null || box == undefined){
                box = app.selection[0];
            }
            let dna = Utility.getDnaOfBox(box);

            if (dna == null) {
                messaggioUtente("Code SRF-29 DNA non valido", "error");
                return;
            }
            //cerchiamo se c'è la descrizione tra i campi offerta
            let descrizioneCampo = opResult.campi_offerta.find(c => Utility.parseLabel(c.label) == "descrizione");

            //Adesso procedo con Istanta
            //I20-993: si scrive sulla variante su cui si sta, non sulla prima riga che il server
            //trova. Senza questi due campi le modifiche finivano sulla nazionale.
            let varianteScelta = this.varianteDescrizioneScelta;

            let req = {
                codice: dna.codice,
                codice_gruppo: dna.codice_gruppo,
                idLavorazione: idKitLavorazione,
                revisione: opResult.revisione,
                campi_offerta: opResult.campi_offerta,
                area: varianteScelta != null ? varianteScelta.area : null,
                canale: varianteScelta != null ? varianteScelta.canale : null
            };

            //creiamo una funzione richiamabile
            let applicaCambiStrutturali = function () {
                var originFile = readFile(pathLavorazione + "/listaKit" + idKitLavorazione + ".json");
                if (originFile == null) {
                    //currentSelection = null;
                    messaggioUtente("Code SRF-30 ATTENZIONE - La lista tracciato non è stata scaricata", "warning");
                    return;
                }

                let file = originFile.records;

                //scorriamo tutti gli elementi di parentGroup in cerca di da_revisionere e lo mettiamo a visibible false
                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label != null && (item.label == "etichetta_DA REVISIONARE" || item.label == "etichetta_DA CONFERMARE")) {
                        //item.visible = false;
                        item.remove();
                        break;
                    }
                }

                if ($("#azioni_strutturali").find(".fieldCambioStrutturale").length > 0) {
                    //C'è da fare unc cambio strutturale che signficia reimpaginare la ref per cui inutile ricaricare la scheda
                    showLoading("Salvataggio campi offerta...")
                    me.preparaCambioStrutturale();
                }
                else {
                    if (descrizioneCampo != null) {
                        let field = Utility.getFieldByLabel("descrizione", box);

                        //cerchiamo tutte le textArea con labelCorrispondente="descrizione"
                        let descr = "";
                        let campiDescrizione = $("#editReferenza").find('textarea[labelCorrispondente="descrizione"]');
                        //ora scorriamo tutti i campi, currentcharacterstyle contiene lo stile 
                        for (let cd = 0; cd < campiDescrizione.length; cd++) {
                            let campoDesc = $(campiDescrizione[cd]);
                            let stile = campoDesc.attr("currentCharacterStyle");
                            let testo = campoDesc.val();

                            //Applichiamo lo stile
                            descr += "<" + stile + ">" + testo + "</" + stile + ">";
                        }

                        //il testo è in formato <stile>testo</stile><stile>testo2</stile>
                        Utility.applicaTagStringToInndTextFrame(field, descr, box.geometricBounds);
                    }
                    //Ricarico la scheda ref
                    //Probabilmente è necessario verificare lo stato della selezione (Questo se nella sciagurata ipotesi, tra il click di Salva modifiche e la fine dell'operazione l'utente cambia follemente la selezione)
                    me.initSchedaRef(me.refSelected);
                }
            };

            var isEditabile = pluginMiddleware.getEditabilitaSchedaRef ? pluginMiddleware.getEditabilitaSchedaRef(primario.recordInTracciato) : true;
            if(isEditabile){
                if (xhrInProcess != null)
                    xhrInProcess.abort();
    
                xhrInProcess = new XMLHttpRequestClient();
                xhrInProcess.onload = (objResult, parsed) => {
                    try {
                        if (!parsed) {
                            objResult = JSON.parse(objResult);
                        }
                        console.log(objResult);
    
                        //controlliamo se ci sono stati errori
                        if (objResult.esito) {
                            messaggioUtente("SalvaModifiche: Richiesta completata con successo", "success", false, 5);
                            applicaCambiStrutturali();
                        }
                        else {
                            messaggioUtente("Code SRF-31 Errore durante il salvataggio delle modifiche: " + objResult.error, "error", false, 5);
                            return;
                        }
    
    
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-32 Errore generico durante il salvataggio delle modifiche: " + e, "error");
                    }
    
                }
    
                xhrInProcess.onreadystatechange = function () {
                    if (xhrInProcess.readyState == 4) {
                        if (xhrInProcess.status == 200) {
                            //currentSelection = null;
                        } else {
                            //currentSelection = null;
                            //messaggioUtente("SalvaModifiche: Errore durante la richiesta: " + xhr.status, "error");
                        }
                    }
                };
    
                xhrInProcess.onerror = function () {
                    //currentSelection = null;
                    //messaggioUtente("SalvaModifiche: Errore di rete", "error");
                };
    
                console.log(req);
    
                let reqPass = JSON.stringify(req);
                reqPass = encodeURIComponent(reqPass);
                xhrInProcess.send("Revisore/salvaRefFromIndd", "reqStr=" + reqPass, "PUT", "application/x-www-form-urlencoded");
                messaggioUtente("SalvaModifiche: Richiesta inviata", "success", true, 3, true);
            }
            else {
                applicaCambiStrutturali();
            }

        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code SRF-32 Errore generico durante il salvataggio delle modifiche: " + e, "error");
        }
    },
    preparaCambioStrutturale() {

        let listaFields = $("#azioni_strutturali").find(".fieldCambioStrutturale");


        let params = "";
        params += "codiceGruppo=" + encodeURIComponent(this.schedeRefDati[0].recordInTracciato["Scatto.CodiceGruppo"]);
        params += "&idRec=" + encodeURIComponent(this.schedeRefDati[0].idRec);

        let kAz = "azioni[0]";
        if ($("#cmbTipoSalvataggioStrutturale").val() == "primario") {
            params += "&" + kAz + ".codice=" + encodeURIComponent(this.schedeRefDati[0].recordInTracciato["Referenza.Codice"]);
        }

        for (let f = 0; f < listaFields.length; f++) {
            console.log($(listaFields[f]).attr("id") + " = " + $(listaFields[f]).val());
            let kAttr = kAz + ".attributi";//["+attr+"]";
            params += "&" + kAttr + "." + encodeURIComponent($(listaFields[f]).attr("id")) + "=" + encodeURIComponent($(listaFields[f]).val());
        }

        console.log(params);
        this.salvaCambioStrutturaleDo(params);

    },

    //Esiti possibili per il box dopo un salvataggio primarie/secondarie, in ordine di
    //precedenza: se cambia il tipo di box si reimpagina e basta, altrimenti si guarda se il
    //contenuto e' ancora allineato alla scheda.
    ESITI_ALLINEAMENTO_BOX: {
        nessuno: "nessuno",
        reimpagina: "reimpagina",
        proponiAggiornamento: "proponiAggiornamento"
    },

    /*
     * Il primario del gruppo e' cambiato?
     *
     * recordsScheda: i record della scheda come sono adesso, cioe' prima dell'applica.
     * listaSingoli: [{Codice, StatoSelezione}] come li ha appena impostati l'operatore.
     *
     * Senza un primario prima o dopo non si segnala nulla: quei casi hanno gia' i loro
     * controlli e messaggi nell'applica.
     */
    primarioCambiato(recordsScheda, listaSingoli) {
        var esito = { cambiato: false, codicePrecedente: null, codiceNuovo: null };

        var precedente = (recordsScheda || []).find(f => f != null && f.recordInTracciato != null && f.recordInTracciato.StatoSelezione == 1);
        var nuovo = (listaSingoli || []).find(f => f != null && f.StatoSelezione == 1);

        esito.codicePrecedente = precedente != null ? precedente.recordInTracciato["Referenza.Codice"] : null;
        esito.codiceNuovo = nuovo != null ? nuovo.Codice : null;

        if (esito.codicePrecedente == null || esito.codiceNuovo == null) {
            return esito;
        }

        esito.cambiato = String(esito.codicePrecedente) !== String(esito.codiceNuovo);
        return esito;
    },

    /*
     * L'avviso che l'agenzia vuole mostrare quando cambia il primario, "" se non ne ha.
     *
     * E' l'unico pezzo di questo flusso che appartiene all'agenzia: riscaricare la scheda e
     * allineare il box sono comportamenti di tutti. Per Edro serve a dire che l'esempio e'
     * governato dal gruppo e che quindi il cambio di primario non lo tocca.
     *
     * leggiAvviso(recordInTracciato) -> messaggio, e' pluginMiddleware.getAvvisoCambioPrimario;
     * arriva iniettata perche' la decisione resti verificabile senza middleware ne' server.
     * Si valuta su tutti i record della scheda: la provenienza dell'esempio e' del gruppo.
     */
    avvisoCambioPrimario(recordsScheda, listaSingoli, leggiAvviso) {
        if (!schedaRef.primarioCambiato(recordsScheda, listaSingoli).cambiato) {
            return "";
        }

        var regola = leggiAvviso;
        if (regola == null && typeof pluginMiddleware !== "undefined" && pluginMiddleware != null) {
            regola = function (recordInTracciato) { return pluginMiddleware.getAvvisoCambioPrimario(recordInTracciato); };
        }
        if (regola == null) {
            return "";
        }

        for (var i = 0; i < (recordsScheda || []).length; i++) {
            var record = recordsScheda[i];
            if (record == null || record.recordInTracciato == null) {
                continue;
            }

            var messaggio = null;
            try {
                messaggio = regola(record.recordInTracciato);
            }
            catch (e) {
                console.error("Code SRF-46 Avviso di agenzia sul cambio primario non valutato: " + e);
                return "";
            }

            if (messaggio != null && messaggio !== "") {
                return messaggio;
            }
        }

        return "";
    },

    /*
     * Cosa fare del box, confrontando la scheda riscaricata con quello che c'e' in pagina.
     *
     * Il codice del box vince su tutto: se cambia, il box va rifatto e confrontarne il
     * contenuto non avrebbe senso. Senza uno dei due codici non si reimpagina a indovinare.
     */
    esitoAllineamentoBox(codiceBoxPrecedente, codiceBoxNuovo, differenze) {
        var esiti = schedaRef.ESITI_ALLINEAMENTO_BOX;

        var precedente = codiceBoxPrecedente != null ? String(codiceBoxPrecedente).trim() : "";
        var nuovo = codiceBoxNuovo != null ? String(codiceBoxNuovo).trim() : "";

        if (precedente !== "" && nuovo !== "" && precedente !== nuovo) {
            return esiti.reimpagina;
        }

        return (differenze || []).length > 0 ? esiti.proponiAggiornamento : esiti.nessuno;
    },

    //Il codice del box della scheda, letto dal primario o, in mancanza, dal primo record.
    codiceBoxDellaScheda(recordsScheda) {
        var records = recordsScheda || [];
        var record = records.find(f => f != null && f.recordInTracciato != null && f.recordInTracciato.StatoSelezione == 1);

        if (record == null) {
            record = records.find(f => f != null && f.recordInTracciato != null);
        }
        if (record == null) {
            return "";
        }

        var codice = record.recordInTracciato.codiceBox;
        return codice != null ? String(codice) : "";
    },

    /*
     * getSchedaRef con la callback avvolta in una promessa: dentro un flusso async si legge
     * meglio. Scarica soltanto: la navigazione fra le schermate non la tocca nessuno.
     */
    async ricaricaDatiScheda(codiceGruppo, idRec) {
        let me = this;

        return new Promise(function (resolve) {
            try {
                me.getSchedaRef(codiceGruppo, function (errore, scheda) {
                    if (errore != null || scheda == null || scheda.records == null || scheda.records.length === 0) {
                        console.error("Code SRF-47 Riscaricamento della scheda non riuscito: " + errore);
                        resolve(false);
                        return;
                    }

                    me.schedeRefDati = scheda.records;
                    me.idRecordLavorazione = scheda.idRecInLavorazione;
                    resolve(true);
                }, idRec);
            }
            catch (e) {
                console.error("Code SRF-47 Riscaricamento della scheda non riuscito: " + e);
                resolve(false);
            }
        });
    },

    /* ---------- I20-992: le segnalazioni del box nella scheda ref ---------- */

    /// La chiave con cui si riconosce una referenza fra quelle silenziate: il codice gruppo,
    /// cioe' quello che l'operatore si vede scritto nel titolo della scheda.
    chiaveRefPerSilenzio(codice) {
        return codice == null ? "" : String(codice).trim();
    },

    /// Le segnalazioni gia' calcolate per la scheda aperta, oppure null se l'analisi per
    /// questa scheda non e' ancora stata fatta.
    segnalazioniInMemoria() {
        return this.segnalazioniDelBox;
    },

    memorizzaSegnalazioni(differenze) {
        this.segnalazioniDelBox = Array.isArray(differenze) ? differenze : [];
    },

    dimenticaSegnalazioni() {
        this.segnalazioniDelBox = null;
    },

    /// I20-992: la finestra si e' proposta da sola per questa scheda, e non lo rifara'.
    segnaSegnalazioniGiaProposte() {
        this.modalSegnalazioniGiaProposto = true;
    },

    /// I20-992: la scheda che si apre e' un'altra, quindi la finestra puo' proporsi di nuovo.
    /// Sta separato da dimenticaSegnalazioni perche' le due cose non vanno sempre insieme:
    /// applicare la descrizione dal server rifa' l'analisi sul box appena cambiato, ma non e'
    /// una scheda nuova e non deve riaprire niente.
    consentiAperturaAutomatica() {
        this.modalSegnalazioniGiaProposto = false;
    },

    /// C'e' qualcosa da risolvere? E' questo che decide se il pulsante si vede.
    ciSonoSegnalazioniIrrisolte(differenze) {
        return Array.isArray(differenze) && differenze.length > 0;
    },

    refESilenziata(codice) {
        const chiave = this.chiaveRefPerSilenzio(codice);
        return chiave !== "" && this.refConSegnalazioniSilenziate.indexOf(chiave) >= 0;
    },

    /// Se la finestra deve aprirsi da sola all'apertura della scheda. Silenziata quella
    /// referenza, o silenziate tutte, non si apre - ma il pulsante resta, e da li' si riapre
    /// a mano: silenziare vuol dire non essere interrotti, non perdere l'informazione.
    ///
    /// I20-992: non si apre nemmeno se per questa scheda si e' gia' proposta. La schermata di
    /// edit si rifa' a ogni ritorno - dalle foto, dalla struttura, dopo aver applicato la
    /// descrizione dal server - e senza questo controllo l'avviso tornava davanti ogni volta,
    /// anche a chi non aveva chiesto nessun silenzio.
    deveAprirsiDaSola(differenze, codice) {
        if (!this.ciSonoSegnalazioniIrrisolte(differenze)) {
            return false;
        }
        if (this.modalSegnalazioniGiaProposto) {
            return false;
        }
        if (this.segnalazioniSilenziateOvunque) {
            return false;
        }
        return !this.refESilenziata(codice);
    },

    silenziaSegnalazioniDellaRef(codice) {
        const chiave = this.chiaveRefPerSilenzio(codice);
        if (chiave !== "" && !this.refESilenziata(chiave)) {
            this.refConSegnalazioniSilenziate.push(chiave);
        }
    },

    togliSilenzioDellaRef(codice) {
        const chiave = this.chiaveRefPerSilenzio(codice);
        const posizione = this.refConSegnalazioniSilenziate.indexOf(chiave);

        if (posizione >= 0) {
            this.refConSegnalazioniSilenziate.splice(posizione, 1);
        }
    },

    riattivaSegnalazioniOvunque() {
        this.segnalazioniSilenziateOvunque = false;
    },

    /// Come si aprono le caselle del modal per una referenza. Con il silenzio generale acceso
    /// ogni referenza si presenta con entrambe spuntate, perche' e' quello che sta succedendo;
    /// altrimenti conta solo se questa referenza e' stata dichiarata una per una.
    statoCaselleSilenziamento(codice) {
        const tutte = this.segnalazioniSilenziateOvunque === true;

        return {
            questa: tutte || this.refESilenziata(codice),
            tutte: tutte
        };
    },

    /// Registra quello che l'operatore ha dichiarato, alla chiusura del modal.
    ///
    /// Togliere la spunta al generale lo spegne, e restano zitte solo le referenze dichiarate
    /// una per una: e' il motivo per cui una referenza aperta mentre il generale era acceso non
    /// entra nell'elenco, la sua spunta non era una scelta ma il riflesso del generale.
    applicaScelteSilenziamento(codice, questa, tutte) {
        if (tutte === true) {
            this.silenziaSegnalazioniOvunque();
            return;
        }

        this.riattivaSegnalazioniOvunque();

        if (questa === true) {
            this.silenziaSegnalazioniDellaRef(codice);
        }
        else {
            this.togliSilenzioDellaRef(codice);
        }
    },
    silenziaSegnalazioniOvunque() {
        this.segnalazioniSilenziateOvunque = true;
    },

    /// Rimette il silenzio com'era all'avvio del plugin.
    azzeraSilenziamenti() {
        this.refConSegnalazioniSilenziate = [];
        this.segnalazioniSilenziateOvunque = false;
    },

    /// Il codice gruppo della referenza aperta, che e' anche la chiave del silenziamento.
    codiceDellaRefAperta() {
        const primario = (this.schedeRefDati || []).find(f => f != null && f.recordInTracciato != null && f.recordInTracciato.StatoSelezione == 1);
        return primario != null ? primario.recordInTracciato["Scatto.CodiceGruppo"] : null;
    },

    /// Compone il titolo della scheda: il pulsante delle segnalazioni, poi quello per copiare
    /// il codice, poi il codice. Stava scritto uguale in due punti, e il pulsante nuovo
    /// sarebbe comparso in uno e non nell'altro.
    componiTitoloCodice(codice) {
        const testo = codice == null ? "" : String(codice);

        $("#copiaCodiceTitolo").remove();

        const copyButton = $('<img src="images/icon_small_copia.png" style="height: 16px; margin-left:10px; margin-right:10px;" id="copiaCodiceTitolo" codiceGruppo="' + testo + '">');
        copyButton.codice = testo;

        copyButton.on('click', function () {
            navigator.clipboard.writeText(String($(this).attr("codiceGruppo") || ""));
            messaggioUtente("Codice copiato negli appunti", "success", false, 1, true);
            $(this).attr("src", "images/check.png");
            setTimeout(function () {
                copyButton.attr("src", "images/icon_small_copia.png");
            }, 1000);
        });

        //codiceRef e' un h3: dentro ci vanno il segnalino, il copy e il testo. La riga e' flex
        //con gli elementi centrati, perche' vertical-align allinea alla meta' della x-height del
        //testo e non al centro della barra: il numerino restava un po' alto.
        $("#codiceRef").empty();
        $("#codiceRef").css({ "display": "flex", "align-items": "center" });
        $("#codiceRef").append(copyButton);
        $("#codiceRef").append(testo.substring(0, 45) + (testo.length > 45 ? "..." : ""));

        this.aggiornaPulsanteSegnalazioni();
    },

    /// Il segnalino nel titolo della scheda: quante differenze ci sono fra il box e il dato,
    /// e un modo per riaprirle. Sta prima del codice e si vede solo quando c'e' davvero
    /// qualcosa da risolvere.
    ///
    /// La barra #referenza e' alta 25px fisse e l'h3 dentro ha 5px di padding sopra e sotto:
    /// restano 15px. Un componente Spectrum non ci sta, cresce e spinge il codice fuori dal
    /// fondo scuro, che di 25px resta. Quindi uno span alto quanto l'icona della copia, che
    /// in quella riga convive da sempre: e' la misura che la barra tollera.
    aggiornaPulsanteSegnalazioni() {
        try {
            $("#segnalazioniBoxButton").remove();

            const segnalazioni = this.segnalazioniInMemoria();
            if (!this.ciSonoSegnalazioniIrrisolte(segnalazioni)) {
                return;
            }

            const quante = segnalazioni.length;
            const me = this;
            const segnalino = $('<span id="segnalazioniBoxButton"></span>');

            //Il solo numero: il senso lo da' il suggerimento, e la riga resta pulita.
            segnalino.text(String(quante));
            segnalino.css({
                "display": "inline-block",
                "height": "16px",
                "line-height": "16px",
                "padding": "0 5px",
                "font-size": "10px",
                "font-weight": "700",
                "border-radius": "3px",
                "background-color": "#b21d1d",
                "color": "#fff",
                "margin-right": "8px",
                "cursor": "pointer"
            });

            //In UXP elemento.title come proprieta' non crea l'attributo e il suggerimento
            //resta muto: si passa sempre da qui.
            Utility.impostaTooltip(segnalino[0], quante === 1
                ? "1 differenza fra il box e il dato - clicca per rivederla"
                : quante + " differenze fra il box e il dato - clicca per rivederle");

            segnalino.on("click", function () {
                me.mostraModalSegnalazioni();
            });

            $("#codiceRef").prepend(segnalino);
        }
        catch (e) {
            console.error("Code SRF-95 Segnalino delle differenze non aggiornato: " + e);
        }
    },

    /// Riscrive lo stato e l'elenco dentro il modal. Tenuto separato dall'apertura perche' lo
    /// rifa' anche l'Aggiorna, senza riaprire nulla.
    ///
    /// Le righe non sono riquadri: un filetto colorato a sinistra basta a separarle e toglie
    /// dalla finestra una dozzina di bordi che non dicevano niente.
    riempiElencoSegnalazioni(contenitore, intestazione, differenze) {
        contenitore.empty();
        intestazione.empty();

        const risolte = !this.ciSonoSegnalazioniIrrisolte(differenze);
        const colore = risolte ? "#1b7f3b" : "#b21d1d";

        const pallino = $('<span></span>');
        pallino.css({
            "display": "inline-block",
            "width": "8px",
            "height": "8px",
            "border-radius": "50%",
            "background-color": colore,
            "margin-right": "8px",
            "flex": "0 0 auto"
        });

        const testo = $('<span></span>');
        testo.css({ "font-size": "13px", "font-weight": "600", "color": colore });

        if (risolte) {
            testo.text("Tutte le segnalazioni risolte");
            intestazione.append(pallino).append(testo);

            const nota = $('<div>Il box corrisponde al dato.</div>');
            nota.css({ "font-size": "12px", "color": "#767676", "padding": "2px 0" });
            contenitore.append(nota);
            return;
        }

        const quante = differenze.length;
        testo.text(quante === 1
            ? "Riscontrata 1 differenza nel box"
            : "Riscontrate " + quante + " differenze nel box");
        intestazione.append(pallino).append(testo);

        differenze.forEach(diff => {
            const riga = $('<div></div>');
            riga.css({
                "border-left": "2px solid " + colore,
                "padding": "3px 0 3px 8px",
                "margin-bottom": "6px"
            });

            const campo = $('<div></div>');
            campo.text(confronti.etichettaSegnalazione(diff.label));
            campo.css({ "font-size": "12px", "font-weight": "600", "color": "#2c2c2c" });

            const dettaglio = $('<div></div>');
            dettaglio.text(diff.difference == null ? "" : String(diff.difference));
            dettaglio.css({ "font-size": "12px", "color": "#767676" });

            riga.append(campo).append(dettaglio);
            contenitore.append(riga);
        });
    },

    /// Le caselle dell'intestazione: scelte, non azioni. Si leggono quando il popup si chiude,
    /// e fino ad allora non succede niente.
    ///
    /// La seconda compare solo quando la prima e' spuntata: estendere a tutte una cosa che non
    /// si sta facendo nemmeno qui non vuol dire niente, e tenerla sempre in vista costringeva a
    /// leggere due righe per capirne una.
    caselleSilenziamento(codice) {
        const stato = this.statoCaselleSilenziamento(codice);
        const riquadro = $('<div style="display: flex; flex-direction: column; gap: 3px;"></div>');

        const crea = (id, etichetta, spuntata) => {
            const riga = $('<div style="display: flex; align-items: center; gap: 5px;"></div>');
            const casella = $('<input type="checkbox" id="' + id + '">');
            const testo = $('<label for="' + id + '" style="font-size: 11px; color: #2c2c2c; cursor: pointer;"></label>');

            casella.prop("checked", spuntata === true);
            testo.text(etichetta);
            riga.append(casella).append(testo);
            riquadro.append(riga);

            return { riga: riga, casella: casella };
        };

        const questa = crea("segnalazioniSilenziaQuesta", "Non mostrare piu' questo avviso", stato.questa);
        const tutte = crea("segnalazioniSilenziaTutte", "Applica a tutte le segnalazioni", stato.tutte);

        const mostraSeconda = () => {
            const accesa = questa.casella.prop("checked") === true;
            tutte.riga.css("display", accesa ? "flex" : "none");

            //Sparendo non deve lasciarsi dietro una scelta che non si vede piu'.
            if (!accesa) {
                tutte.casella.prop("checked", false);
            }
        };

        questa.casella.on("change", mostraSeconda);
        mostraSeconda();

        return riquadro;
    },

    /// Il lampo: il contenuto sparisce e torna. Il modal e' gia' su fondo bianco, quindi basta
    /// portare a zero l'opacita' e non serve sovrapporre nulla.
    ///
    /// Dura sempre la stessa frazione, non quanto il lavoro: legato alla durata vera, su un box
    /// svelto non si vedrebbe e su uno lento sembrerebbe bloccato. Serve a dire "ho fatto
    /// qualcosa" quando le segnalazioni restano le stesse e nulla cambia a schermo.
    lampeggiaContenuto(contenuto) {
        const DURATA = 250;

        try {
            contenuto.css("opacity", "0");
            setTimeout(function () {
                contenuto.css("opacity", "1");
            }, DURATA);
        }
        catch (e) {
            console.error("Code SRF-98 Lampeggio del contenuto non riuscito: " + e);
            contenuto.css("opacity", "1");
        }
    },

    /// La finestra delle segnalazioni. Si apre da sola all'apertura della scheda quando c'e'
    /// qualcosa da dire e la referenza non e' stata silenziata, e si riapre a mano dal
    /// segnalino nel titolo. Alla chiusura si leggono le caselle e il segnalino si riallinea a
    /// quello che resta.
    async mostraModalSegnalazioni() {
        try {
            const me = this;
            const codice = this.codiceDellaRefAperta();

            const contenuto = $(`
                <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; font-family: Arial, sans-serif; color: #2c2c2c;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
                            <div id="segnalazioniIntestazione" style="display: flex; align-items: center; min-width: 0;"></div>

                            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #767676;">
                                <span>Per correggere i dati nel box usa il pulsante</span>
                                <img src="images/reimpaginaFix.png" alt="Correggi" style="width: 16px; height: 16px; object-fit: contain; vertical-align: middle;" />
                            </div>
                        </div>

                        <div id="segnalazioniAzioni" style="flex: 0 0 auto;"></div>
                    </div>

                    <div id="segnalazioniElenco" style="width: 100%; max-height: 220px; overflow-y: auto; padding-right: 4px; box-sizing: border-box;"></div>
                </div>
            `);

            const intestazione = contenuto.find("#segnalazioniIntestazione");
            const elenco = contenuto.find("#segnalazioniElenco");
            const azioni = contenuto.find("#segnalazioniAzioni");

            this.riempiElencoSegnalazioni(elenco, intestazione, this.segnalazioniInMemoria() || []);

            //Rifa' la pre analisi adesso: e' il modo per vedere l'effetto delle correzioni senza
            //chiudere e riaprire la scheda. Icona, non scritta: sta sulla riga dello stato.
            const aggiorna = $('<img src="images/refresh.png" alt="Aggiorna">');
            aggiorna.css({
                //Alta quanto le due righe della colonna a sinistra messe insieme: lo stato, i
                //10px che le separano e la riga del suggerimento. Le due righe restano dove
                //sono, l'icona le affianca invece di stare sopra una sola.
                "height": "30px",
                "padding": "4px",
                "box-sizing": "content-box",
                "border": "1px solid #d0d0d0",
                "border-radius": "4px",
                "cursor": "pointer",
                "display": "inline-block"
            });
            Utility.impostaTooltip(aggiorna[0], "Rifai il controllo e aggiorna l'elenco");

            aggiorna.on("click", async function () {
                try {
                    me.lampeggiaContenuto(contenuto);

                    const box = me.refSelected != null ? me.refSelected.item : null;
                    me.memorizzaSegnalazioni(await me.differenzeDatiNelBox(box, me.schedeRefDati));
                    me.riempiElencoSegnalazioni(elenco, intestazione, me.segnalazioniInMemoria());
                }
                catch (err) {
                    console.error("Code SRF-96 Aggiornamento delle segnalazioni non riuscito: " + err);
                    messaggioUtente("Code SRF-96 Non e' stato possibile aggiornare le segnalazioni", "error", false, 4);
                    contenuto.css("opacity", "1");
                }
            });
            azioni.append(aggiorna);

            const caselle = this.caselleSilenziamento(codice);

            //Alla chiusura si leggono le scelte dichiarate e il segnalino nel titolo si rifa' i
            //conti: se l'Aggiorna ha trovato tutto risolto, sparisce.
            Utility.popup("Differenze rilevate", contenuto, "lg", function () {
                //Le caselle si leggono dal riquadro che si e' tenuto, non dal documento: quando
                //questo callback parte il popup e' gia' stato rimosso, e un selettore globale
                //non troverebbe piu' niente. Il sottoalbero staccato conserva lo stato.
                me.applicaScelteSilenziamento(
                    codice,
                    caselle.find("#segnalazioniSilenziaQuesta").prop("checked") === true,
                    caselle.find("#segnalazioniSilenziaTutte").prop("checked") === true);

                me.aggiornaPulsanteSegnalazioni();
            }, caselle);
        }
        catch (e) {
            console.error("Code SRF-97 Finestra delle segnalazioni non aperta: " + e);
        }
    },

    /*
     * Le differenze fra i dati della scheda e quello che c'e' nel box, con la stessa pre
     * analisi che gira all'apertura della schermata di edit.
     */
    async differenzeDatiNelBox(box, recordsScheda) {
        try {
            if (box == null || !box.isValid) {
                return [];
            }

            var primario = (recordsScheda || []).find(f => f != null && f.recordInTracciato != null && f.recordInTracciato.StatoSelezione == 1);
            if (primario == null) {
                return [];
            }

            var rec = primario.recordInTracciato;
            var listaFoto = [];

            if (rec.membriGruppoFoto != null) {
                listaFoto = rec.membriGruppoFoto.map(function (membro) {
                    return { nomeFoto: membro.nomeFoto, hash: membro.hash };
                });
            }
            if (rec["Foto.Nome"] != null && rec["Foto.Nome"] !== "") {
                listaFoto.push({ nomeFoto: rec["Foto.Nome"], hash: rec["Foto.Hash"] });
            }

            var preAnalisi = await confronti.confrontoBoxCompiledFieldPreAnalisi(
                box,
                rec.compiledFields,
                rec.deletedFields,
                listaFoto,
                rec["Foto.Extra"],
                rec["Foto.ExtraAuto"],
                true,
                NoRenderElementi.elencoPerSegnalazioni(rec.noRenderElementi, rec.membriGruppoFoto)
            );

            return preAnalisi != null && preAnalisi.differenze != null ? preAnalisi.differenze : [];
        }
        catch (e) {
            console.error("Code SRF-48 Confronto dei dati del box non riuscito: " + e);
            return [];
        }
    },

    /*
     * Allinea il box alla scheda appena riscaricata. Ritorna l'esito applicato, cosi' il
     * chiamante sa se il box e' stato rifatto e deve fermarsi.
     */
    async allineaBoxDopoSalvataggioPS(box, codiceBoxPrecedente) {
        let me = this;
        var esiti = me.ESITI_ALLINEAMENTO_BOX;

        var codiceBoxNuovo = me.codiceBoxDellaScheda(me.schedeRefDati);
        var differenze = [];

        //Se cambia il tipo di box si reimpagina comunque: confrontare i campi di un box che
        //sta per essere rifatto sarebbe tempo speso per niente.
        if (codiceBoxPrecedente == codiceBoxNuovo) {
            differenze = await me.differenzeDatiNelBox(box, me.schedeRefDati);
        }

        var esito = me.esitoAllineamentoBox(codiceBoxPrecedente, codiceBoxNuovo, differenze);

        if (esito === esiti.reimpagina) {
            messaggioUtente("Il tipo di box e' cambiato (" + codiceBoxPrecedente + " -> " + codiceBoxNuovo + "): il box viene reimpaginato.", "warning", false, 10);
            me.applicaReimpaginazione();
            return esito;
        }

        if (esito === esiti.proponiAggiornamento) {
            var aggiorna = await Utility.confirm("I dati del box non sono piu' allineati alla scheda. Aggiorno il box?");
            if (aggiorna) {
                me.applicaReimpaginazione();
                return esito;
            }
        }

        return esiti.nessuno;
    },

    async EditFotoPrimarieSecondarie(box) {
        var messageDelivered = false;
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length < 1) {
            return;
        }
        var codice_gruppo = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"];
        let me = this;
        //L'opzione di rendering non sta sul record del box ma sulle sue foto primarie/secondarie,
        //che il server consegna dentro membriGruppoFoto del primario.
        var primarioDelGruppo = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        var membriGruppoFoto = (primarioDelGruppo != null && primarioDelGruppo.recordInTracciato.membriGruppoFoto != null)
            ? primarioDelGruppo.recordInTracciato.membriGruppoFoto
            : [];
        var noRenderDiCodice = function (cod) {
            var membro = membriGruppoFoto.find(m => m.codRef == cod);
            return membro != null && membro.noRender === true;
        };
        me.resetFotoPS();
        var listFotoImpaginate = [];
        var listRectangles = [];
        for (var i = 0; i < box.allPageItems.length; i++) {
            var item = box.allPageItems[i];
            if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto") || item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto")) {
                var statoSelezione = 0;
                if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")){
                    statoSelezione = 1;
                }
                else if (item.label.startsWith(pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto")){
                    statoSelezione = 2;
                }

                if (item.graphics.length > 0 && item.graphics.item(0).itemLink != null) {
                    //calcoliamo l'hash dell'immagine
                    var res = await Utility.getLinkHash(item);
                    listFotoImpaginate.push({ rectangle: item, imgName: item.graphics.item(0).itemLink.name, statoSelezione: statoSelezione, hash: res.hash, missing: res.missing, mismatch: res.mismatch });
                }
                listRectangles.push(item);
            }
        }
        //chiediamo al custom se ci sono campiExtra da mostrare in schermata editPrimarieSecondarie
        let campiExtra = pluginMiddleware.getCampo("campiExtraEditPrimarieSecondarie") !== null ? pluginMiddleware.getCampo("campiExtraEditPrimarieSecondarie") : [];
        let fotoPrimaria = listFotoImpaginate.find(f => f.statoSelezione == 1);
        for (var obj = 0; obj < schedaRef.length; obj++) {
            var objItem = schedaRef[obj].recordInTracciato;
            var row = $('<div class="row align-items-center imageRow" style="margin-bottom:10px"></div>'); // Crea una nuova riga
            var iconCol = $('<div class="col-1 d-flex align-items-center"></div>');

            var fotoFound = listFotoImpaginate.find(f => f.imgName == objItem["Foto.Nome"]);
            //se la foto è presente (stesso nome) ma diversa da quella attesa
            var fotoInMismatch = fotoFound != null && fotoFound.mismatch ? true : false;
            var fotoNellaCartellaIsMissing = fotoFound != null && fotoFound.missing ? true : false;
            var nomeFoto = fotoFound != null ? fotoFound.imgName : "";

            //var imgSrc = objItem["Foto.Nome"] != "" ? 'images/immaginePresente.png' : 'images/immagineNonPresente.png';
            var imgSrc = objItem["Foto.Nome"] != "" ? olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + objItem["Foto.guidid"] : 'images/immagineNonPresente.png';

            var color = "";
            if (objItem.StatoSelezione != 3) {
                color = objItem.StatoSelezione == 1 ? "blue" : "orange";
            }
            var img = $('<img>', { src: imgSrc, style: "width:50px;" + (color != "" ? "background-color:" + color + ";" : ""), 'data-codice': objItem['Referenza.Codice'] });
            // img.on('click', function () {
            //     var codice = $(this).attr('data-codice');
            //     me.updateImmagine(codice); 
            // });

            var checkboxCol = $('<div class="col-3"></div>'); // Crea la colonna per i checkbox
            var checkBoxCol_r1 = $('<div class="row" style="margin-bottom:10px;"></div>'); // Crea la riga 1 per i checkbox
            var checkBoxCol_r2 = $('<div class="row"></div>'); // Crea la riga 2 per i checkbox
            var checkBoxCol_r2_c = $('<div class="col"></div>'); // Crea la riga 2 per i checkbox
            checkboxCol.append(checkBoxCol_r1);
            checkBoxCol_r2.append(checkBoxCol_r2_c);
            checkboxCol.append(checkBoxCol_r2);

            var textCol = $('<div class="col-8" ></div>'); // Crea la colonna per il testo

            if (objItem["Scatto.CodiceGruppo"].split(",").length > 1) {
                var checkbox1 = $('<input class="primary-check" codice="' + objItem["Referenza.Codice"] + '" type="checkbox"' + (objItem["StatoSelezione"] == 1 ? ' checked ' : ' ') + 'style="vertical-align: middle;">'); // Crea il primo checkbox
                var label1 = $('<label for="checkbox1">P:</label>'); // Crea l'etichetta per il primo checkbox
                var checkbox2 = $('<input class="secondary-check" codice="' + objItem["Referenza.Codice"] + '" type="checkbox" ' + (objItem["StatoSelezione"] == 2 ? ' checked ' : ' ') + ' style="vertical-align: middle;">'); // Crea il secondo checkbox
                var label2 = $('<label for="checkbox2">S:</label>'); // Crea l'etichetta per il secondo checkbox
                //I20-968: l'opzione di rendering non si imposta piu' da qui, ma dal modal noRender.
                var text = $('<span>(' + objItem['Referenza.Codice'] + ') ' + objItem["Descrizioni.Descrizione1"] + '</span>'); // Crea il testo

                // Imposta lo stile
                label1.css({ "font-size": "12px", "color": "lightblue" });
                checkbox1.css("background-color", "blue");
                label2.css({ "font-size": "12px", "color": "yellow", "margin-left": "5px" });
                checkbox2.css("background-color", "yellow");

                text.css({ "font-size": "12px", "color": "white" });

                //checkboxCol.append(label1, checkbox1, label2, checkbox2); // Aggiunge i checkbox alla colonna dei checkbox
                checkBoxCol_r2_c.append(label1, checkbox1, label2, checkbox2, text); // Aggiunge i checkbox alla colonna dei checkbox

                //textCol.append(text); // Aggiunge il testo alla colonna del testo
            }
            else {
                var text = $('<span>(' + objItem['Referenza.Codice'] + ') ' + objItem["Descrizioni.Descrizione1"] + '</span>'); // Crea il testo
                text.css({ "font-size": "12px", "color": "white" });
                //textCol.append(text); // Aggiunge il testo alla colonna del testo
                checkBoxCol_r2_c.append(text)
            }

            //se objItem["Foto.IsMeta"] è true allora mettiamo una piccola icona di metatag con scritto From_Meta
            if (objItem["Foto.IsMeta"]) {
                //non è un'immagine, usiamo un div con angoli arrotondati e bordo colorato di un rosso chiaro
                var metaIcon = $('<div style="width: 65px; height: 20px; border-radius: 10%; background-color: rgba(255, 0, 0, 0.2); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid red;" title="Foto da metatag">From_Meta</div>');
                iconCol.append(metaIcon);

                //aggiungiamo un evento onclick
                metaIcon.on('click', async function () {
                    //mandiamo un confirm (usando il componente usato nel progetto) in cui chiediamo se vogliamo rimuovere il metatag
                    let res = await Utility.confirm("Rimuovere la foto associata a questa lavorazione? Sarà ripristinata la foto da archivio.");
                    if (res) {
                        me.eliminaMetaFoto(objItem["Referenza.Codice"], 1);
                    }
                });
            }
            var btnAttachFoto = $('<button id="btnAttachFoto" data-codice="' + objItem["Referenza.Codice"] + '">Cambia foto</button>'); // Crea il secondo checkbox
            checkBoxCol_r1.append(btnAttachFoto);

            btnAttachFoto.on('click', function () {
                var codice = $(this).attr('data-codice');
                //var validaSoloPerLavorazione = $(this).siblings('.mod-check').is(':checked');
                //me.updateImmagine(codice, 1, validaSoloPerLavorazione);
                me.openModalCambiaFoto(codice)
            });

            row.append(iconCol, checkboxCol, textCol); // Aggiunge le colonne alla riga
            $("#cambiaPS").append(row); // Aggiunge la riga a #cambiaPS

            var rowNomeFoto = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
            var fotoName = objItem["Foto.Nome"] != null ? objItem["Foto.Nome"] : "";
            var textNomeFoto = $('<span>Nome foto: ' + (fotoName !== "" ? fotoName : "nessuna foto") + '</span>');
            textNomeFoto.css({ "font-size": "12px", "color": "white" });

            // icona copia
            var copyIcon = $('<img src="images/copyToClipBoard.png" data-msg="' + fotoName + '" style="width:16px; margin-left:8px; cursor:pointer;" title="Copia nome">');

            copyIcon.on('click', function () {
                let textToCopy = $(this).attr("data-msg");
                navigator.clipboard.writeText(textToCopy).then(() => {
                    $(this).attr("src", "images/check.png");
                    setTimeout(() => {
                        $(this).attr("src", "images/copyToClipBoard.png");
                    }, 1000);
                });
            });

            rowNomeFoto.append(textNomeFoto, copyIcon); // Aggiunge il testo e l'icona alla riga
            textNomeFoto.css({ "font-size": "12px", "color": "white" });
            rowNomeFoto.append(textNomeFoto); // Aggiunge il testo alla riga
            $("#cambiaPS").append(rowNomeFoto); // Aggiunge la riga a #cambiaPS

            //se campiExtra è diverso da null e da [] allora creiamo una nuova riga per ogni campo extra
            //campi extra è un array di oggetti con chiave label e key, label è il testo da mostrare e key è la chiave da cui prendere il valore in objItem
            if (campiExtra != null && campiExtra.length > 0) {
                campiExtra.forEach(campo => {
                    var rowCampoExtra = $('<div class="row align-items-center" style="margin-bottom:10px"></div>'); // Crea una nuova riga
                    var valueCampo = objItem[campo.keyInRecordInTracciato] != null ? objItem[campo.keyInRecordInTracciato] : "";
                    var textCampoExtra = $('<span>' + campo.label + ': ' + (valueCampo !== "" ? valueCampo : "nessun dato") + '</span>');
                    textCampoExtra.css({ "font-size": "12px", "color": "white" });
                    rowCampoExtra.append(textCampoExtra); // Aggiunge il testo alla riga
                    $("#cambiaPS").append(rowCampoExtra); // Aggiunge la riga a #cambiaPS
                });
            }

            var hashMatch = (fotoFound != null && fotoFound.hash != null ? fotoFound.hash.toUpperCase() : null) == (objItem["Foto.Hash"] != null ? objItem["Foto.Hash"].toUpperCase() : null);

            //creiamo una nuova row
            if ((fotoFound == null || fotoInMismatch || fotoNellaCartellaIsMissing || !hashMatch) && objItem.StatoSelezione != 3 && objItem["Foto.Nome"] != "") {
                var rowSyncErrorFoto = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');

                var imgSync = null;
                var errorText = null;
                //controlliamo se la foto è presente nella cartella di lavorazione
                if (fotoFound == null) {
                    var codice = objItem["Referenza.Codice"];
                    var fotoNomeDato = objItem["Foto.Nome"];
                    try {

                        //la foto non è impaginata
                        var fileBuffer = fs.readFileSync(/*pathLavorazione +*/ percorsoLinks + fotoNomeDato);
                        imgSync = $('<img>', { src: "images/impaginazione.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non risulta impaginata, impaginare attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });

                        imgSync.on('click', function () {
                            let result = FotoPlacer.updateFoto(fotoNomeDato, box, null, codice);
                            box = result.box;
                            let fotoImpaginata = result.fotoRectangle;

                            if (fotoPrimaria != null && fotoImpaginata != null) {
                                fotoImpaginata.sendToBack(fotoPrimaria.rectangle);
                            }
                            me.EditFotoPrimarieSecondarie(box);
                        });

                    }
                    catch {
                        imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non è stata trovata nei Links, scaricare l\'immagine attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });
                        imgSync.on('click', function () {


                            avviaSyncPacchettoFoto(2, function () {
                                me.EditFotoPrimarieSecondarie(box);
                            }, [codice]);
                        });
                    }
                }
                else{
    
                    if (fotoNellaCartellaIsMissing) {
                        var codice = objItem["Referenza.Codice"];
                        imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                        errorText = $('<span>Errore: la foto non è presente nella cartella, scaricare l\'immagine attraverso il pulsante adiacente</span>');
                        errorText.css({ "font-size": "14px", "color": "yellow" });
                        imgSync.on('click', function () {
                            avviaSyncPacchettoFoto(2, function () {
                                me.EditFotoPrimarieSecondarie(box);
                            }, [codice]);
                        });
                    }
                    else if (fotoInMismatch || !hashMatch) {
                        var codice = objItem["Referenza.Codice"];
                        var fotoNomeDato = objItem["Foto.Nome"];
                        var fotoRectangle = fotoFound.rectangle;
                        try {
                            //confrontiamo gli hash
                            if(hashMatch){
                                //la foto impaginata è sbagliata, in cartella c'è quella giusta
                                imgSync = $('<img>', { src: "images/impaginazione.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                                errorText = $('<span>Errore: la foto impaginata è da ricollegare, aggiornare l\'immagine</span>');
                                errorText.css({ "font-size": "14px", "color": "yellow" });
    
                                imgSync.on('click', function () {
                                    let result = FotoPlacer.updateFoto(fotoNomeDato, box, fotoRectangle, codice);
                                    box = result.box;
                                    let fotoImpaginata = result.fotoRectangle;
                                    if (fotoPrimaria != null && fotoImpaginata != null) {
                                        fotoImpaginata.sendToBack(fotoPrimaria.rectangle);
                                    }

                                    me.EditFotoPrimarieSecondarie(box);
                                });
                            }
                            else{
                                imgSync = $('<img>', { src: "images/download.png", style: "width:30px; cursor:pointer;", 'data-codice': objItem["Foto.guidid"] });
                                errorText = $('<span>Errore: la foto nei link non corrisponde al server, aggiornare l\'immagine</span>');
                                errorText.css({ "font-size": "14px", "color": "yellow" });
                                imgSync.on('click', function () {
                                    avviaSyncPacchettoFoto(2, function () {
                                        me.EditFotoPrimarieSecondarie(box);
                                    }, [codice]);
                                });
                            }
                        }
                        catch {
                            console.error("Foto in mismatch ma non trovata nei links");
                            messaggioUtente("Code SRF-33 La foto associata a questo elemento è diversa da quella presente nei links, ma non è stata trovata nella cartella dei links, contattare l'assistenza", "error");
                        }
                    }
                    
                }


                var iconSyncCol = $('<div class="col-1 d-flex align-items-center"></div>');
                if (imgSync != null) {
                    iconSyncCol.append(imgSync);
                    rowSyncErrorFoto.append(iconSyncCol);
                }
                var textSyncErrorCol = $('<div class="col-11"></div>');
                //facciamo la colonna con scritto l'errore
                if (errorText != null) {
                    textSyncErrorCol.append(errorText);
                    rowSyncErrorFoto.append(textSyncErrorCol);
                }

                if (rowSyncErrorFoto.children().length > 0) {
                    $("#cambiaPS").append(rowSyncErrorFoto);
                }
            }

            iconCol.append(img);

            if (obj < schedaRef.length - 1) {
                $("#cambiaPS").append('<hr>');
            }
        }

        if (objItem["Scatto.CodiceGruppo"].split(",").length > 1) {
            var confermaButton = $('<sp-action-button id="confermaButton" style="color:lightgreen; margin-right:10px;">Applica</sp-action-button>');
            confermaButton.on('click', function () {
                //Solo i checkbox di selezione: quello di rendering non concorre a primaria/secondaria
                var checkboxes = $("#cambiaPS").find("input.primary-check:checked, input.secondary-check:checked");
                var checkboxesArray = Array.from(checkboxes);
                var listaSingoli = checkboxesArray.map(function (checkbox) {
                    var statoSelezione = $(checkbox).hasClass('primary-check') ? 1 : 2;
                    var cod = $(checkbox).attr('codice');
                    var row = $(checkbox).closest('.imageRow');
                    var imgSrc = row.find('img').attr('src');
                    var hasFoto = imgSrc && imgSrc.trim() !== "" ? true : false;
                    return {
                        Codice: cod,
                        StatoSelezione: statoSelezione,
                        HasFoto: hasFoto
                    };
                });

                //ora aggiungiamo alla lista tutti i checkbox non selezionati e mettiamo lo stato selezione a 3
                var checkboxesNotSelected = $("#cambiaPS").find("input.primary-check:not(:checked), input.secondary-check:not(:checked)");
                var checkboxesNotSelectedArray = Array.from(checkboxesNotSelected);
                var listaSingoliNotSelected = checkboxesNotSelectedArray.map(function (checkbox) {
                    var cod = $(checkbox).attr('codice');
                    var row = $(checkbox).closest('.row');
                    var imgSrc = row.find('img').attr('src');
                    var hasFoto = imgSrc && imgSrc.trim() !== "" ? true : false;
                    return {
                        Codice: cod,
                        StatoSelezione: 3,
                        HasFoto: hasFoto
                    };
                });

                //scorriamo la listaSingoliNotSelected e cerchiamo se c'è un altro elemento con lo stesso codice in listaSingoliNotSelected, se non c'è lo rimuoviamo
                for (var i = listaSingoliNotSelected.length - 1; i >= 0; i--) {
                    if (listaSingoli.filter(f => f.Codice == listaSingoliNotSelected[i].Codice).length == 1) { //vuol dire che è un primario o un secondario
                        //rimuoviamo l'elemento
                        listaSingoliNotSelected.splice(i, 1);
                    }
                }

                //adesso avremo una lista di elementi duplicati, quindi dobbiamo rimuovere il duplicato
                listaSingoliNotSelected = listaSingoliNotSelected.filter((v, i, a) => a.findIndex(t => (t.Codice === v.Codice)) === i);

                listaSingoli = listaSingoli.concat(listaSingoliNotSelected);

                // Controllo per codici duplicati
                var hasDuplicates = listaSingoli.some(function (item, index, array) {
                    return array.filter(function (x) { return x.Codice == item.Codice; }).length > 1;
                });
                if (hasDuplicates) {
                    messaggioUtente("Code SRF-34 Edit P/S: Un codice è stato impostato sia come primario che secondario, correggere prima di procedere", "error");
                    return;
                }

                // Controllo per almeno un primario
                var hasPrimary = listaSingoli.some(function (item) {
                    return item.StatoSelezione == 1;
                });
                if (!hasPrimary) {
                    messaggioUtente("Code SRF-35 Edit P/S: Nessun primario selezionato, impossibile procedere", "error");
                    return;
                }

                // Controllo per più di un primario
                var primaryCount = listaSingoli.filter(function (item) {
                    return item.StatoSelezione == 1;
                }).length;
                if (primaryCount > 1) {
                    messaggioUtente("Code SRF-36 Edit P/S: C'è più di un primario selezionato, correggere prima di procedere", "error");
                    return;
                }

                // Controllo per foto mancante
                var missingFoto = listaSingoli.find(function (item) {
                    return (item.HasFoto == false && item.StatoSelezione != 3);
                });
                if (missingFoto) {
                    messaggioUtente("Code SRF-37 Edit P/S: Nessuna foto per l'elemento " + missingFoto.Codice, "error");
                    return;
                }

                //Vanno letti adesso, sul dato ancora vecchio: fra poco sara' quello nuovo.
                var codiceBoxPrecedente = me.codiceBoxDellaScheda(schedaRef);
                var avvisoCambioPrimario = me.avvisoCambioPrimario(schedaRef, listaSingoli);

                //creiamo un oggetto da mandare al server, composto da una lista di elementi con codice e stato selezione
                //scorriamo la listaRef e confrontiamo lo stato selezione con quello dell'elemento con lo stesso codice in listaSingoli, se non corrisponde creiamo un nuovo elemento da mettere in lista da mandare al server

                var objToSend = {
                    idLavorazione: idKitLavorazione,
                    CodiceGruppo: codice_gruppo,
                    ps: []
                };



                for (var i = 0; i < schedaRef.length; i++) {
                    var objItem = schedaRef[i].recordInTracciato;
                    var cod = objItem["Referenza.Codice"];
                    var item = listaSingoli.find(function (element) {
                        return element.Codice == cod;
                    });
                    if (item == null) {
                        messaggioUtente("Edit P/S: Errore durante il salvataggio delle modifiche: Elemento non trovato", "error");
                        return;
                    }

                    //if (item.StatoSelezione != objItem.StatoSelezione) {
                        //I20-977: il noRender non viaggia piu' di qui. Vive nella sua struttura,
                        //e mandarlo dentro ps lo riscriverebbe nel posto da cui la migrazione dei
                        //meta storici lo ripesca, resuscitando una foto appena riattivata.
                        objToSend.ps.push({
                            codRef: cod,
                            stato: item.StatoSelezione
                        });
                    //}
                }

                //facciamo il formData dell'objectToSend
                var formData = new FormData();
                var idRec = 0;
                try {
                    var dna = Utility.getDnaOfBox(box);
                    if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                        idRec = parseInt(dna.idRec);
                    }
                }
                catch (e) {
                    console.warn("Impossibile recuperare idRec dal box durante Edit P/S", e);
                }
                formData.append("idLavorazione", idKitLavorazione);
                formData.append("CodiceGruppo", codice_gruppo);
                formData.append("idRec", idRec);
                formData.append("ps", JSON.stringify(objToSend.ps));

                const xhr = new XMLHttpRequestClient();
                xhr.onload = async (objResult2, parsed) => {
                    if (!parsed) {
                        try {
                            objResult2 = JSON.parse(objResult2);
                        }
                        catch (e) {
                            messaggioUtente("Code SRF-38 Edit P/S: Errore generico durante il salvataggio delle modifiche: " + e, "error");
                            return;
                        }
                    }
                    console.log("Risposta");
                    if (!objResult2.esito) {
                        messaggioUtente("Code SRF-39 Edit P/S: Errore durante il salvataggio delle modifiche: " + objResult2.error, "error");
                        return;
                    }

                    try {
                        //aggiorniamo il dato in schedaRef
                        var primaria = null;
                        var secondarie = [];
                        for (var i = 0; i < schedaRef.length; i++) {
                            var objItem = schedaRef[i].recordInTracciato;
                            var cod = objItem["Referenza.Codice"];
                            var item = listaSingoli.find(function (element) {
                                return element.Codice == cod;
                            });

                            if (item != null && objToSend.ps.find(f => f.codRef == cod) != null) {
                                //cerchiamo in listfotoimpaginate l'elemento con l'immagine uguale a objItem["Foto.Nome"]
                                objItem.StatoSelezione = item.StatoSelezione;
                                //La scelta sul rendering si legge dove vive davvero, non dal
                                //payload P/S, che non la porta piu'.
                                var noRenderSalvato = noRenderDiCodice(cod);
                                //teniamo allineato il dato locale: la schermata viene ridisegnata da qui
                                var membroLocale = membriGruppoFoto.find(m => m.codRef == cod);
                                if (membroLocale != null) {
                                    membroLocale.noRender = noRenderSalvato;
                                }
                                var fotoFound = listFotoImpaginate.find(f => f.imgName == objItem["Foto.Nome"])
                                let imgRectangle = fotoFound != null ? fotoFound.rectangle : null;
                                //box = me.placeFoto(objItem.StatoSelezione != 3 ? objItem["Foto.Nome"] : null, box, imgRectangle, objItem["Referenza.Codice"], objItem.StatoSelezione);
                                let result = FotoPlacer.updateFoto(objItem.StatoSelezione != 3 ? objItem["Foto.Nome"] : null, box, imgRectangle, objItem["Referenza.Codice"], objItem.StatoSelezione, noRenderSalvato);
                                box = result.box;
                                imgRectangle = result.fotoRectangle;
                                if(objItem.StatoSelezione == 1){
                                    primaria = imgRectangle;
                                }
                                else if(objItem.StatoSelezione == 2){
                                    secondarie.push(imgRectangle);
                                }
                            }
                        }

                        if(secondarie.length > 0){
                            //guardiamo qual'è la secondaria che appare prima in gerarchia del box
                            var firstSecondaria = null;
                            for (var i = 0; i < box.allPageItems.length; i++) {
                                var item = box.allPageItems[i];
                                //se l'item ha lo stesso id di uno degli imgRectangle delle secondarie allora è la firstSecondaria
                                if (secondarie.find(s => s != null && s.id == item.id) != null) {
                                    firstSecondaria = item;
                                    break;
                                }
                            }
    
                            primaria.bringToFront(firstSecondaria);
                        }

                    }
                    catch (ex) {
                        console.error(ex);
                    }

                    //La scheda sul server puo' essere cambiata insieme alle primarie e secondarie:
                    //la si riscarica sempre, ed e' dal dato fresco che si capisce se il box in
                    //pagina e' ancora allineato. Prima si riscaricava solo su richiesta di agenzia.
                    showLoading("Aggiornamento della scheda in corso...");
                    var schedaRicaricata = await me.ricaricaDatiScheda(codice_gruppo, idRec);
                    hideLoading();

                    if (avvisoCambioPrimario !== "") {
                        messaggioUtente(avvisoCambioPrimario, "warning", false, 15);
                    }

                    if (schedaRicaricata) {
                        var esitoAllineamento = await me.allineaBoxDopoSalvataggioPS(box, codiceBoxPrecedente);
                        if (esitoAllineamento !== me.ESITI_ALLINEAMENTO_BOX.nessuno) {
                            //Il box e' stato rifatto: il fix foto e il refresh della lista
                            //lavorerebbero su un box che non c'e' piu'.
                            return;
                        }
                    }

                    //Il fix foto viene dopo: una reimpaginazione rifa' il box e butterebbe via
                    //il fix appena applicato, oltre a chiedere due conferme per un lavoro solo.
                    let res = await Utility.confirm("Modifiche salvate. Applicare il Fix Foto automatico?");
                    if (res) {
                        //applichiamo il fix foto automatico, che consiste nel posizionare tutte le foto primarie e secondarie al posto giusto in base alla meccanica
                        var obs = CssFramework.getSpazioImpaginazione(box);
                        CssFramework.fixFoto(box, obs.candidate, obs.obstacles);
                        messaggioUtente("Fix Foto automatico applicato", "success", false, 3);
                    }


                    //Questa funzione fa un refresh della schermata lista PRIMARIE/SECONDARIE
                    await me.EditFotoPrimarieSecondarie(box);  //serve, non è un loop
                };

                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            messaggioUtente("Edit P/S: Richiesta completata con successo", "success", false, 5);
                        } else {
                            //messaggioUtente("Edit P/S: Errore durante la richiesta: " + xhr.status, "error");
                        }
                    }
                };

                xhr.onerror = function () {
                    //messaggioUtente("Edit P/S: Errore di rete", "error");
                };

                xhr.send("Menabo/modificaPrimarieSecondarie" + "/" + 0, formData, "PUT");
                messaggioUtente("Edit P/S: Richiesta inviata", "success", true, 0, true);

            });
            $("#pulsantiExtra").append(confermaButton);
            if ($("#Tab6").css("display") == "none") {
                confermaButton.css("display", "none");
            }
        }
    },

    impaginaFotoExtra(fotoExtraNome, FotoExtraTipo, box, pathLavorazione, objItem, sigla = null) {
        try{
            if (sigla == null) {
                sigla = fotoExtraNome;
            }
            var nuovoElImpaginato = null;
            if (customAgenzia.impaginazioneFotoExtraCustom != null) {
                nuovoElImpaginato = customAgenzia.impaginazioneFotoExtraCustom(fotoExtraNome, FotoExtraTipo, box, pathLavorazione, objItem, sigla)
            }
            var path = /*pathLavorazione +*/ percorsoLoghi + fotoExtraNome;
            var myPage = box.parentPage;
            var doc = docInLavorazione;
    
            if (nuovoElImpaginato == null) {
    
                nuovoElImpaginato = myPage.rectangles.add(doc.layers.itemByName("InPagina"), LocationOptions.UNKNOWN, box, { geometricBounds: box.geometricBounds })
                nuovoElImpaginato.label = "foto_extra$" + sigla + "$tipo_" + FotoExtraTipo;
                nuovoElImpaginato.place(path);
                nuovoElImpaginato.fit(FitOptions.FRAME_TO_CONTENT);
                nuovoElImpaginato.fillColor = "None";
    
            }
    
    
    
            var oldGroup = box;
            var oldLabel = oldGroup.label;
            var oldItems = oldGroup.pageItems.everyItem().getElements();
            oldGroup.ungroup();
    
            var newItems = oldItems.concat(nuovoElImpaginato);
            var masterGroup = myPage.groups.add(newItems);
            masterGroup.label = oldLabel;
            app.selection = [masterGroup];
            nuovoElImpaginato.bringToFront();
            this.refSelected.item = masterGroup;
    
            this.FotoExtraPanel(masterGroup);
            return masterGroup;
        }
        catch(ex){
            //diciamo che sigla non è stato trovata nella cartella loghi
            console.error(ex);
            messaggioUtente("Code SRF-40 Foto extra "+ fotoExtraNome + " non trovata in " + /*pathLavorazione +*/ percorsoLoghi, "error");
            return false;
        }

    },

    attivaDisattivaFotoExtra(guidId, tipo, nomeFoto, box, attiva, sigla = null) {
        let me = this;

        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-41 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-42 Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-43 Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                let schedaRef = this.schedeRefDati;
                //troviamo il primario
                var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
                if (attiva) {
                    if (schedaRef != null) {
                        for (var i = 0; i < schedaRef.length; i++) {
                            var element = schedaRef[i];
                            var fotoExtraDaAttivare = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == guidId);
                            if (fotoExtraDaAttivare != null) {
                                fotoExtraDaAttivare.attiva = true;
                            }
                        }
                    }
                    //cerchiamo nel box se c'è già una foto con lo stesso nomeFoto e tipo
                    var fotoExtraPresente = null;
                    for (var $box = 0; $box < box.allPageItems.length; $box++) {
                        var item = box.allPageItems[$box];
                        if (item.label.startsWith("foto_extra$" + (sigla == null ? nomeFoto : sigla) + "$tipo_" + tipo)) {
                            fotoExtraPresente = item;
                            break;
                        }
                    }

                    if (fotoExtraPresente == null) {
                        box = this.impaginaFotoExtra(nomeFoto, tipo, box, pathLavorazione, primario.recordInTracciato, sigla);
                    }
                }
                else {
                    let schedaRef = this.schedeRefDati;
                    //troviamo il primario

                    if (schedaRef != null) {
                        for (var i = 0; i < schedaRef.length; i++) {
                            var element = schedaRef[i];
                            var fotoExtraDaDisattivare = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == guidId);
                            if (fotoExtraDaDisattivare != null) {
                                fotoExtraDaDisattivare.attiva = false;
                            }
                        }
                    }

                    me.eliminaFotoNelBox(nomeFoto, tipo, box, sigla);
                }

            }
            catch (e) {
                messaggioUtente("Code SRF-44 Errore generico: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-45 Richiesta completata con successo", "success", false, 1);
                } else {
                }
            }
        };

        xhr.onerror = function () {
            messaggioUtente("Code SRF-46 Errore di rete", "error");
        }
        xhr.send("SyncFoto/attivaDisattivaFotoExtra/" + guidId + "/" + attiva, null, "GET");


    },


    FotoExtraPanel(box) {
        let me = this;
        var schedaRef = this.schedeRefDati;
        me.resetFotoExtra();

        //troviamo il primario in schedaRef
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-47 Nessun elemento primario trovato", "error");
            return;
        }
        var extra = primario.recordInTracciato["Foto.Extra"];
        if (extra != null) {
            for (var $i = 0; $i < this.tipiFotoExtra.length; $i++) {
                var elemento = this.tipiFotoExtra[$i];
                var panel = $('<div class="panel fotoExtraPanel"></div>');
                panel.attr("val", elemento.val);
                var titolo = $('<h3>' + elemento.nome + '</h3>');
                //aggiungiamo lo stile al titolo per far apparire il testo bianco
                titolo.css({ "color": "white" });
                panel.append(titolo);
                $("#FotoExtra").append(panel);
            }

            //adesso riempiamo i panel con i valori di extra.nome_reale che hanno la chiave extra.tipo uguale al val del panel
            for (var $i = 0; $i < extra.length; $i++) {
                //troviamo l'elemento id in ogni elemento di objResult e salviamoli in una unica stringa separata da virgole
                // var idsFoto = "";
                // for (var j = 0; j < schedaRef.length; j++) {
                //     if (schedaRef[j].recordInTracciato["Foto.Extra"].find(f => f.Tipo == extra[$i].Tipo && f.NomeReale == extra[$i].NomeReale) != null) {
                //         idsFoto += schedaRef[j].recordInTracciato["Foto.Extra"].find(f => f.Tipo == extra[$i].Tipo && f.NomeReale == extra[$i].NomeReale).Id;
                //         break;
                //     }
                // }
                //idsFoto = idsFoto.slice(0, -1);

                var elemento = extra[$i];
                //troviamo il panel corrispondente a elemento.tipo cercandolo tramite la classe fotoExtraPanel e l'attr val uguale a elemento.tipo
                var panel = $("#FotoExtra").find(".fotoExtraPanel[val='" + elemento.tipo + "']");
                //creiamo una riga con dentro elemento.nome_reale e l'appendiamo al panel, mettiamo anche un attr alla riga chiamato idFoto e contentente elemento.id
                var row = $('<div class="row align-items-center" nomeFoto="' + elemento.nome + '" idFoto="' + elemento.guidId + '" sigla="' + elemento.sigla + '" style="margin-bottom:10px"></div>');
                var text = $('<span>' + elemento.nome/*nomeReale*/ + '</span>');
                text.css({ "font-size": "12px", "color": "white" });

                //creiamo un checkbox da mettere prima del testo basato sul valore di elemento.attiva
                var checkbox = $('<input type="checkbox" class="checkboxExtra" ' + (elemento.attiva ? "checked" : "") + '>');
                checkbox.on('change', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    //passiamo ad attivaDisattivaFotoExtra l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                    me.attivaDisattivaFotoExtra($(this).parent().attr("idFoto"), $(this).closest(".fotoExtraPanel").attr("val"), $(this).parent().attr("nomeFoto"), box, $(this).is(":checked"), sigla);
                });
                row.append(checkbox);
                row.append(text);
                //prima del nome inseriamo un pulsante con scritto elimina che al click chiama la funzione eliminaFotoExtra passando l'id dell'elemento
                var button = $('<button id="eliminaFotoExtra" style="color:red; width:25px; height:25px;"><img src="images/icon_small_cestino.png" alt="Elimina" style="width:14px;height:14px;"></button>');
                button.on('click', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    //passiamo ad eliminaFoto l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                    me.eliminaFotoExtra($(this).parent().attr("idFoto"), $(this).closest(".fotoExtraPanel").attr("val"), $(this).parent().attr("nomeFoto"), me.refSelected.item, sigla);
                });
                row.append(button);

                //inseriamo un secondo pulsante con icona impaginazione.png che al click chiama la funzione impaginaFotoExtra passando il nome della foto, il tipo, il box e il path di lavorazione
                var impaginaButton = $('<button id="impaginaFotoExtra" style="color:lightgreen; width:25px; height:25px;"><img src="images/impaginaRef.png" alt="Impagina" style="width:14px;height:14px;"></button>');
                impaginaButton.on('click', function () {
                    var sigla = $(this).parent().attr("sigla");
                    if (sigla == "")
                        sigla = null;
                    box = me.impaginaFotoExtra($(this).parent().attr("nomeFoto"), $(this).closest(".fotoExtraPanel").attr("val"), me.refSelected.item, pathLavorazione, primario.recordInTracciato, sigla);
                });
                row.append(impaginaButton);


                //centriamo verticalmente il testo
                row.css("display", "flex");
                row.css("align-items", "center");
                panel.append(row);
            }

            //per ogni panel a cui non è stato aggiunto nessun elemento aggiungiamo una riga con scritto, nessun elemento
            var panels = $("#FotoExtra").find(".fotoExtraPanel");
            for (var $i = 0; $i < panels.length; $i++) {
                var panel = $(panels[$i]);
                if (panel.children().length == 1) {
                    var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                    var text = $('<span>Nessun elemento</span>');
                    text.css({ "font-size": "12px", "color": "white" });
                    row.append(text);
                    panel.append(row);
                }
            }
            //adesso che tutti i panel sono pieni aggiungiamo un pulsante finale per ogni panel con scritto Aggiungi + nome del panel 
            var panels = $("#FotoExtra").find(".fotoExtraPanel");
            for (var $i = 0; $i < panels.length; $i++) {
                var panel = $(panels[$i]);
                var button = $('<button id="aggiungiButton" style="color:lightgreen">Aggiungi ' + this.tipiFotoExtra.find(f => f.val == panel.attr("val")).nome + '</button>');
                //al button aggiungiamo un attr tipo con il valore del panel
                button.attr("tipo", panel.attr("val"));
                button.on('click', function () {
                    //chiamiamo la funzione updateImmagine passando il codice gruppo dell'elemento selezionato e il tipo
                    me.updateImmagine(primario.recordInTracciato["Scatto.CodiceGruppo"], $(this).attr("tipo"), null, null);
                });
                panel.append(button);
                var buttonLink = $('<button id="linkButton" style="color:lightgreen">Link ' + this.tipiFotoExtra.find(f => f.val == panel.attr("val")).nome + ' con immagine a sistema</button>');
                buttonLink.attr("tipo", panel.attr("val"));
                buttonLink.on('click', function () {
                    me.linkLogoBollo($(this).attr("tipo"));
                });
                panel.append(buttonLink);
                
                //e per ogni panel tranne l'ultimo mettiamo una linea divisoria che lo separi da quello sotto
                if ($i < panels.length - 1) {
                    panel.append('<hr>');
                }
            }
        }

        //si crea un nuovo divisorio e un nuovo panel per gli elementi extra auto
        $("#FotoExtra").append('<hr>');
        var panelExtraAuto = $('<div class="panel fotoExtraPanel"></div>');
        panelExtraAuto.attr("val", "extraAuto");
        var titoloExtraAuto = $('<h3>Extra Auto</h3>');
        titoloExtraAuto.css({ "color": "white" });
        panelExtraAuto.append(titoloExtraAuto);
        $("#FotoExtra").append(panelExtraAuto);

        //mettiamo un margine in fondo al panel
        panelExtraAuto.css("margin-bottom", "10px");
        $("#FotoExtra").append('<hr>');
        var fotoExtraAuto = primario.recordInTracciato["Foto.ExtraAuto"];

        if (fotoExtraAuto != null) {
            //foto extra auto è una lista di oggetti composti da una stringa NomeFoto e un bool Escluso, per ogni oggetto si crea una nuova riga con il nome della foto e un pulsante, il pulsante avrà scritto escludi se Escluso è false e includi se è true
            for (var $i = 0; $i < fotoExtraAuto.length; $i++) {
                var elemento = fotoExtraAuto[$i];
                var row = $('<div class="row align-items-center" sigla="' + elemento.sigla + '" nomeFoto="' + elemento.nome + '" escluso="' + elemento.escluso + '" tipo="' + elemento.tipo + '" style="margin-bottom:10px"></div>');
                var text = $('<span>' + elemento.nome + '</span>');
                text.css({ "font-size": "12px", "color": "white" });
                var button = $('<button id="aggiungiButton" style="color:lightgreen">' + (elemento.escluso ? "Includi" : "Escludi") + '</button>');

                button.on('click', function () {
                    //passiamo ad escludiFotoExtraAuto l'id, il val del panel, il nome della foto e il box corrispondente alla current selection
                    me.escludiIncludiFotoExtraAuto($(this).parent().attr("nomeFoto"), $(this).parent().attr("escluso"), box, $(this).parent(), $(this).parent().attr("tipo"), $(this).parent().attr("sigla"));
                });
                row.append(button);
                row.append(text);
                row.css("display", "flex");
                row.css("align-items", "center");
                panelExtraAuto.append(row);
            }

            //se non ci sono elementi extra auto mettiamo una riga con scritto nessun elemento
            if (fotoExtraAuto.length == 0) {
                var row = $('<div class="row align-items-center" style="margin-bottom:10px"></div>');
                var text = $('<span>Nessun elemento</span>');
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text);
                panelExtraAuto.append(row);
            }
        }
    },

    /// I20-980: il nome di un file diviso in radice ed estensione, quest'ultima in minuscolo.
    partiDelNomeFile(nome) {
        var testo = typeof nome === "string" ? nome.trim() : "";
        var punto = testo.lastIndexOf(".");

        if (punto <= 0) {
            return { base: testo, estensione: "" };
        }

        return { base: testo.substring(0, punto), estensione: testo.substring(punto + 1).toLowerCase() };
    },

    /// I20-980: il tipo con cui il pannello sa disegnare questo file, oppure null se non lo sa
    /// disegnare affatto. Un psd e' il caso che capita: il webview non lo rende, e i psd sono
    /// proprio i file a cui diamo la precedenza.
    tipoAnteprimaDi(nome) {
        var mostrabili = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            gif: "image/gif"
        };

        var estensione = this.partiDelNomeFile(nome).estensione;
        return mostrabili[estensione] != null ? mostrabili[estensione] : null;
    },

    /// I20-980: la miniatura che un psd si porta dentro, in byte JPEG, oppure null.
    ///
    /// Il pannello non sa disegnare un psd, ma Photoshop dentro al file ci salva gia' una
    /// piccola JPEG della composizione finale, e quella si puo' mostrare.
    ///
    /// Struttura del file: firma 8BPS, intestazione di 26 byte, blocco del colore (lunghezza
    /// piu' dati), blocco delle risorse (lunghezza piu' voci). Ogni voce comincia con 8BIM,
    /// ha un identificativo, un nome in stile Pascal portato a lunghezza pari e i dati, anche
    /// quelli portati a lunghezza pari. La risorsa 1036 e' la miniatura: 28 byte che la
    /// descrivono e poi la JPEG vera.
    ///
    /// Si legge solo la 1036 e non la 1033, che e' la miniatura delle versioni antiche con
    /// rosso e blu invertiti: mostrarla darebbe una foto dai colori sbagliati.
    ///
    /// La miniatura c'e' se il file e' stato salvato con l'anteprima. Quando manca si torna
    /// null e resta il riquadro che lo dice.
    anteprimaDaPsd(byte) {
        try {
            var dati = byte instanceof Uint8Array ? byte : new Uint8Array(byte);

            //Firma 8BPS.
            if (dati.length < 30 || dati[0] !== 0x38 || dati[1] !== 0x42 || dati[2] !== 0x50 || dati[3] !== 0x53) {
                return null;
            }

            var leggi32 = function (posizione) {
                return (dati[posizione] * 16777216) + (dati[posizione + 1] * 65536) +
                    (dati[posizione + 2] * 256) + dati[posizione + 3];
            };
            var leggi16 = function (posizione) {
                return (dati[posizione] * 256) + dati[posizione + 1];
            };

            var posizione = 26;
            posizione += 4 + leggi32(posizione);

            var fineRisorse = posizione + 4 + leggi32(posizione);
            posizione += 4;

            while (posizione + 12 <= fineRisorse && posizione + 12 <= dati.length) {
                //8BIM: fuori sincrono non si prosegue a tentoni.
                if (dati[posizione] !== 0x38 || dati[posizione + 1] !== 0x42 ||
                    dati[posizione + 2] !== 0x49 || dati[posizione + 3] !== 0x4D) {
                    return null;
                }

                var identificativo = leggi16(posizione + 4);

                var posizioneNome = posizione + 6;
                var saltoNome = 1 + dati[posizioneNome];
                if (saltoNome % 2 !== 0) {
                    saltoNome++;
                }

                var posizioneDimensione = posizioneNome + saltoNome;
                var dimensione = leggi32(posizioneDimensione);
                var posizioneDati = posizioneDimensione + 4;

                if (identificativo === 1036) {
                    if (dimensione <= 28 || posizioneDati + dimensione > dati.length) {
                        return null;
                    }
                    return dati.slice(posizioneDati + 28, posizioneDati + dimensione);
                }

                posizione = posizioneDati + dimensione + (dimensione % 2);
            }

            return null;
        }
        catch (e) {
            console.log("Miniatura del psd non leggibile: " + e);
            return null;
        }
    },

    /// Cosa scrivere al posto dell'immagine quando non si puo' mostrare.
    testoAnteprimaNonDisponibile(nome) {
        var estensione = this.partiDelNomeFile(nome).estensione;
        return estensione === ""
            ? "Anteprima non disponibile"
            : "Anteprima non disponibile per i file " + estensione.toUpperCase();
    },

    /// I20-980: mostra l'anteprima del file scelto, oppure dice perche' non c'e'. Un riquadro
    /// vuoto, o peggio un'immagine rotta, sembrerebbe un guasto del Plugin.
    mostraAnteprimaCaricamento(nomeFile, url, contenuto) {
        //L'indirizzo della miniatura estratta dal psd si butta a ogni scelta nuova: e' roba
        //che vive in memoria finche' qualcuno non la libera.
        if (this.urlAnteprimaPsd) {
            try { URL.revokeObjectURL(this.urlAnteprimaPsd); } catch (e) { }
            this.urlAnteprimaPsd = null;
        }

        var daMostrare = this.tipoAnteprimaDi(nomeFile) != null ? url : null;

        if (daMostrare == null && contenuto != null &&
            this.partiDelNomeFile(nomeFile).estensione === "psd") {
            var miniatura = this.anteprimaDaPsd(contenuto);
            if (miniatura != null) {
                try {
                    this.urlAnteprimaPsd = URL.createObjectURL(new Blob([miniatura], { type: "image/jpeg" }));
                    daMostrare = this.urlAnteprimaPsd;
                }
                catch (e) {
                    console.log("Miniatura del psd non mostrabile: " + e);
                }
            }
        }

        if (daMostrare) {
            $('#imgPreviewUploadFoto').attr('src', daMostrare).show();
            $('#txtAnteprimaNonDisponibile').hide().text('');
            return;
        }

        $('#imgPreviewUploadFoto').attr('src', '').hide();
        $('#txtAnteprimaNonDisponibile').text(this.testoAnteprimaNonDisponibile(nomeFile)).show();
    },

    /// I file della cartella che possono essere la foto di questa referenza: il nome comincia
    /// con il suo codice, seguito da un separatore.
    ///
    /// Il separatore non e' un dettaglio: senza, il codice 6119227 pescherebbe anche
    /// 61192271_1.psd, che e' un altro articolo, e proporremmo la foto sbagliata.
    candidatiPerReferenza(fileInCartella, codiceReferenza) {
        var codice = codiceReferenza != null ? String(codiceReferenza).trim() : "";
        var elenco = Array.isArray(fileInCartella) ? fileInCartella : [];

        if (codice === "") {
            return [];
        }

        return elenco.filter(function (file) {
            if (file == null || typeof file.nome !== "string" || file.nome.indexOf(codice) !== 0) {
                return false;
            }

            var seguito = file.nome.charAt(codice.length);
            //Fine del nome, estensione o separatore: tutto tranne un'altra cifra.
            return seguito === "" || !/[0-9]/.test(seguito);
        });
    },

    /// Fra i candidati vince sempre il psd, e a parita' di formato il piu' recente.
    scegliCandidatoFoto(fileInCartella, codiceReferenza) {
        var me = this;
        var candidati = this.candidatiPerReferenza(fileInCartella, codiceReferenza);

        if (candidati.length === 0) {
            return null;
        }

        var ordinati = candidati.slice().sort(function (a, b) {
            var psdA = me.partiDelNomeFile(a.nome).estensione === "psd";
            var psdB = me.partiDelNomeFile(b.nome).estensione === "psd";

            if (psdA !== psdB) {
                return psdA ? -1 : 1;
            }

            return (b.modificato || 0) - (a.modificato || 0);
        });

        return ordinati[0];
    },

    /// Perche' proporre il candidato invece di aprire subito lo sfoglia, oppure null se non
    /// c'e' motivo. I tre casi sono quelli chiesti dall'operatore, valutati in quest'ordine.
    ///
    /// hashLocale va calcolato solo quando il nome del candidato coincide con quello della
    /// foto del box: leggere un psd da centinaia di megabyte a ogni clic, per gli altri due
    /// casi che si decidono sui soli nomi, sarebbe un costo inutile.
    motivoPropostaFoto(candidato, fotoDelBox, fotoDelServer, hashLocale) {
        if (candidato == null || typeof candidato.nome !== "string" || candidato.nome === "") {
            return null;
        }

        var elencoServer = Array.isArray(fotoDelServer) ? fotoDelServer : [];
        var nomeBox = fotoDelBox != null && fotoDelBox.nome != null ? String(fotoDelBox.nome) : "";
        var maiuscolo = function (testo) { return testo != null ? String(testo).toUpperCase() : ""; };

        //Uno: stesso nome, ma il file in cartella non e' piu' quello impaginato.
        if (nomeBox !== "" && candidato.nome === nomeBox && hashLocale != null && hashLocale !== "") {
            var hashBox = fotoDelBox.hash;
            if (hashBox != null && hashBox !== "" && maiuscolo(hashBox) !== maiuscolo(hashLocale)) {
                return "hashDiverso";
            }
        }

        //Due: il server non conosce questa foto, o il box non ne ha nessuna, ma in cartella c'e'.
        var conosciutaDalServer = nomeBox !== "" && elencoServer.some(function (foto) {
            return foto != null && String(foto.nome) === nomeBox;
        });

        if (nomeBox === "" || !conosciutaDalServer) {
            return "nonSulServer";
        }

        //Tre: in cartella c'e' il psd, sul server no.
        //
        //A fermare la proposta e' solo il psd della stessa foto, non un psd qualsiasi: un altro
        //scatto della stessa referenza salvato in psd non c'entra nulla con quello che
        //l'operatore sta sostituendo, e bloccherebbe la proposta proprio quando serve.
        if (this.partiDelNomeFile(candidato.nome).estensione === "psd") {
            var radiceBox = this.partiDelNomeFile(nomeBox).base.toUpperCase();
            var psdGiaSulServer = elencoServer.some(function (foto) {
                if (foto == null) {
                    return false;
                }
                var parti = schedaRef.partiDelNomeFile(foto.nome);
                return parti.estensione === "psd" && parti.base.toUpperCase() === radiceBox;
            });

            if (!psdGiaSulServer) {
                return "psdSoloInCartella";
            }
        }

        return null;
    },

    /// I20-980: il file della cartella Links che potrebbe essere la foto cercata, proposto
    /// all'operatore prima di aprire lo sfoglia.
    ///
    /// Torna lo stesso oggetto che tornerebbe la scelta dal dialogo, cosi' chi lo riceve non
    /// distingue fra una foto confermata qui e una scelta a mano. Torna null quando non c'e'
    /// niente da proporre, quando l'operatore risponde di no, e ogni volta che qualcosa va
    /// storto: in tutti quei casi si apre lo sfoglia, che e' la strada di sempre.
    async fotoDaProporreDallaCartella(codiceReferenza, fotoDelBox, fotoDelServer) {
        try {
            var urlCartella = this.urlDiPercorso(percorsoLinks);
            if (urlCartella == null) {
                return null;
            }

            var cartella = await fs2.getEntryWithUrl(urlCartella);
            var voci = await cartella.getEntries();
            var fileInCartella = [];

            for (var i = 0; i < voci.length; i++) {
                var voce = voci[i];
                if (!voce.isFile) {
                    continue;
                }

                var quando = 0;
                var quanto = 0;
                try {
                    var dati = await voce.getMetadata();
                    quando = dati != null && dati.dateModified != null ? new Date(dati.dateModified).getTime() : 0;
                    quanto = dati != null && dati.size != null ? dati.size : 0;
                }
                catch (e) {
                    //Senza metadati il file resta candidato, semplicemente non vince per data.
                }

                fileInCartella.push({ nome: voce.name, modificato: quando, dimensione: quanto, voce: voce });
            }

            var candidato = this.scegliCandidatoFoto(fileInCartella, codiceReferenza);
            if (candidato == null) {
                return null;
            }

            var nomeBox = fotoDelBox != null && fotoDelBox.nome != null ? String(fotoDelBox.nome) : "";
            var contenuto = null;
            var hashLocale = null;

            //Il file si legge solo quando serve l'hash, cioe' quando il nome coincide: negli
            //altri casi la decisione si prende sui soli nomi e un psd grosso non va letto.
            if (candidato.nome === nomeBox) {
                contenuto = await candidato.voce.read({ format: uxp.storage.formats.binary });
                hashLocale = cmd.md5ArrayBuffer(new Uint8Array(contenuto));
            }

            var motivo = this.motivoPropostaFoto(candidato, fotoDelBox, fotoDelServer, hashLocale);
            if (motivo == null) {
                return null;
            }

            if (contenuto == null) {
                contenuto = await candidato.voce.read({ format: uxp.storage.formats.binary });
            }

            var conferma = await Utility.confirm(
                this.riquadroPropostaFoto(candidato, contenuto, motivo));

            if (!conferma) {
                return null;
            }

            return {
                nomeFile: candidato.nome,
                file: contenuto,
                filePath: candidato.voce.nativePath
            };
        }
        catch (e) {
            //Nessun intoppo qui deve impedire di caricare una foto a mano.
            console.log("Proposta della foto dalla cartella non riuscita: " + e);
            return null;
        }
    },

    /// Il contenuto del riquadro di proposta: la domanda, cosa si e' trovato e perche'.
    ///
    /// L'anteprima si mostra solo per i formati che il pannello sa disegnare. Un psd non lo
    /// sa disegnare, e proprio il psd e' il formato a cui diamo la precedenza: in quel caso
    /// si mostrano nome, dimensione e data, che sono cio' che serve per riconoscerlo.
    riquadroPropostaFoto(candidato, contenuto, motivo) {
        var spiegazioni = {
            hashDiverso: "Nella cartella di lavorazione c'e' un file con lo stesso nome, ma diverso da quello impaginato.",
            nonSulServer: "Questa foto non risulta su Istanta, ma nella cartella di lavorazione c'e'.",
            psdSoloInCartella: "Nella cartella di lavorazione c'e' il psd, su Istanta no."
        };

        var tipo = this.tipoAnteprimaDi(candidato.nome);

        var riquadro = $('<div style="display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center;"></div>');
        riquadro.append($('<h3 style="margin:0;">E\' questa la foto che stai cercando?</h3>'));
        riquadro.append($('<div style="font-size:11px;"></div>').text(spiegazioni[motivo] || ""));

        //Un psd non si disegna, ma la miniatura che si porta dentro si': e' una JPEG.
        var daMostrare = contenuto;
        if (tipo == null && this.partiDelNomeFile(candidato.nome).estensione === "psd") {
            var miniatura = this.anteprimaDaPsd(contenuto);
            if (miniatura != null) {
                daMostrare = miniatura;
                tipo = "image/jpeg";
            }
        }

        var immagine = null;
        if (tipo != null) {
            try {
                var url = URL.createObjectURL(new Blob([daMostrare], { type: tipo }));
                immagine = $('<img style="max-width:180px; max-height:180px; border:1px solid #ddd;">').attr("src", url);
            }
            catch (e) {
                console.log("Anteprima non costruita: " + e);
            }
        }

        //Un riquadro vuoto sembrerebbe un guasto: meglio dire perche' non c'e' l'immagine.
        riquadro.append(immagine != null ? immagine : $('<div style="min-width:120px; min-height:80px; display:flex; align-items:center; justify-content:center; padding:10px; border:1px dashed #bbb; background:#f8f8f8; color:#777; font-size:11px;"></div>')
            .text(this.testoAnteprimaNonDisponibile(candidato.nome)));

        var descrizione = candidato.nome;
        if (candidato.dimensione) {
            descrizione += "  " + Math.round(candidato.dimensione / 1024) + " KB";
        }
        if (candidato.modificato) {
            descrizione += "  " + new Date(candidato.modificato).toLocaleString();
        }
        riquadro.append($('<div style="font-size:11px; font-weight:bold; word-break:break-all;"></div>').text(descrizione));

        return riquadro;
    },

    /// I20-980: da dove deve aprirsi il dialogo quando si carica una foto nuova.
    ///
    /// Si punta al file della foto attuale dentro la cartella Links della lavorazione, cosi'
    /// chi sostituisce una foto non deve piu' cercarla a mano. Senza il nome si punta alla
    /// sola cartella, e senza cartella non si punta a niente: il dialogo si apre come prima.
    ///
    /// Il separatore si deduce dal percorso ricevuto, perche' su Windows arriva con le barre
    /// rovesciate e su Mac con quelle dritte, e quello di troppo in fondo va tolto.
    percorsoDiPartenzaPerFoto(cartellaLinks, nomeFoto) {
        var cartella = typeof cartellaLinks === "string" ? cartellaLinks.trim() : "";
        if (cartella === "") {
            return null;
        }

        var separatore = cartella.indexOf("\\") >= 0 ? "\\" : "/";
        var base = cartella.replace(/[\\/]+$/, "");
        if (base === "") {
            base = separatore;
        }

        var nome = typeof nomeFoto === "string" ? nomeFoto.trim() : "";
        if (nome === "") {
            return base;
        }

        return base === separatore ? base + nome : base + separatore + nome;
    },

    /// Lo stesso percorso in forma di URL, che e' quello che il file system di UXP accetta.
    /// Un percorso di Windows diventa file:///C:/..., uno di Mac file:///Utenti/...
    urlDiPercorso(percorso) {
        if (typeof percorso !== "string" || percorso.trim() === "") {
            return null;
        }

        var pulito = percorso.trim().replace(/\\/g, "/");
        if (pulito.indexOf("file:") === 0) {
            return pulito;
        }

        return pulito.charAt(0) === "/" ? "file://" + pulito : "file:///" + pulito;
    },

    /// La cartella che contiene il percorso, per ripiegarci quando il file non c'e' piu'.
    cartellaDiPercorso(percorso) {
        if (typeof percorso !== "string") {
            return null;
        }

        var taglio = Math.max(percorso.lastIndexOf("/"), percorso.lastIndexOf("\\"));
        if (taglio <= 0) {
            return null;
        }

        return percorso.substring(0, taglio);
    },

    async openModalCambiaFoto(codice) {
        let me = this;
        var box = this.refSelected.item;

        if (box == null || box.isValid == null || !box.isValid) {
            await Utility.popup(
                "Nessun elemento selezionato",
                "Per cambiare foto è necessario selezionare un elemento in pagina."
            );
            return;
        }

        showLoading("Scaricamento dati...");
        await Utility.sleep(10);

        try {
            getFotoData(codice, async (objResult) => {
                try {
                    objResult.result = JSON.parse(objResult.result);
                }
                catch (e) {
                    messaggioUtente("Code SRF-48 Errore durante il parsing del risultato: " + e, "error");
                    hideLoading();
                    return;
                }

                console.log(objResult);

                var areaObj = ficoProcess.getAreaLavorazioneCorrente();
                if (areaObj == null) {
                    messaggioUtente("Code SRF-49 Area di lavorazione non trovata", "error");
                    hideLoading();
                    return;
                }
                var area = areaObj.sigla;

                var canaleObj = ficoProcess.getCanaleLavorazioneCorrente();
                if (canaleObj == null) {
                    messaggioUtente("Code SRF-50 Canale di lavorazione non trovato", "error");
                    hideLoading();
                    return;
                }
                var canale = canaleObj.sigla;

                await Utility.apriModal('dialogCambiaFoto', 'Cambia foto', true, [], true);

                const $footer = $('#footerCambiaFoto');
                $footer.empty();
                $footer.html(`
    <div style="
        display:flex;
        justify-content:flex-end;
        align-items:center;
        height:100%;
        width:100%;
        padding:10px;
        box-sizing:border-box;
    ">
        <button type="button" id="btnConfermaCambiaFoto" disabled>Conferma</button>
    </div>
`);

                const $body = $('#bodyCambiaFoto');
                $body.empty();

                const fotoList = Array.isArray(objResult.result) ? objResult.result : [];

                var schedaRef = me.schedeRefDati;
                var elementoCercato = schedaRef.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                var fotoAttuale = null;

                if (elementoCercato != null && elementoCercato.recordInTracciato != null) {
                    fotoAttuale = elementoCercato.recordInTracciato["Foto.Id"] || null;
                }

                //I20-980: il nome del file impaginato, per aprire il dialogo di scelta gia'
                //sulla foto che si sta sostituendo.
                var nomeFotoImpaginata = elementoCercato != null && elementoCercato.recordInTracciato != null
                    ? elementoCercato.recordInTracciato["Foto.Nome"]
                    : null;
                var hashFotoImpaginata = elementoCercato != null && elementoCercato.recordInTracciato != null
                    ? elementoCercato.recordInTracciato["Foto.Hash"]
                    : null;

                const state = {
                    selectedUploadFile: null,
                    selectedUploadPreviewUrl: null,
                    selectedRemotePhoto: null,
                    currentActivePhoto: null
                };

                if (fotoAttuale != null) {
                    state.currentActivePhoto = fotoList.find(x =>
                        x.Attiva !== false && x.Id === fotoAttuale
                    ) || null;
                }

                function getScopeLabel(value) {
                    switch (value) {
                        case 'globale':
                            return 'Globale';
                        case 'canale_area':
                            return canale + ' ' + area;
                        case 'canale':
                            return canale;
                        case 'area':
                            return area;
                        case 'solo_lavorazione':
                            return 'Solo lavorazione';
                        default:
                            return 'Globale';
                    }
                }

                function getScopeOptionsHtml() {
                    return `
                    <option value="globale">Globale</option>
                    <option value="canale_area">${canale} ${area}</option>
                    <option value="canale">${canale}</option>
                    <option value="area">${area}</option>
                    <option value="solo_lavorazione">Solo lavorazione</option>
                `;
                }

                function getPhotoScopeValue(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'globale';
                    }
                    if (hasArea && hasCanale) {
                        return 'canale_area';
                    }
                    if (hasCanale) {
                        return 'canale';
                    }
                    if (hasArea) {
                        return 'area';
                    }
                    return 'globale';
                }

                function getPhotoScopeText(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'Globale';
                    }
                    if (hasArea && hasCanale) {
                        return item.Canale + ' ' + item.Area;
                    }
                    if (hasCanale) {
                        return item.Canale;
                    }
                    if (hasArea) {
                        return item.Area;
                    }
                    return '';
                }

                function isSelectableForCurrentContext(item) {
                    const areaOk = (item.Area == null || item.Area === '' || item.Area === area);
                    const canaleOk = (item.Canale == null || item.Canale === '' || item.Canale === canale);
                    return areaOk && canaleOk;
                }

                function getFotoHash(item) {
                    if (item == null) {
                        return '';
                    }

                    return item.Hash || item.hash || item.FileHash || item.fileHash || '';
                }

                function samePhotoName(itemA, itemB) {
                    if (itemA == null || itemB == null) {
                        return false;
                    }

                    const nomeA = itemA.Nome != null ? String(itemA.Nome) : '';
                    const nomeB = itemB.Nome != null ? String(itemB.Nome) : '';

                    return nomeA !== '' &&
                        nomeA === nomeB;
                }

                function hasSamePhotoInCurrentContext(item) {
                    return fotoList.some(x =>
                        x != null &&
                        isSelectableForCurrentContext(x) &&
                        samePhotoName(x, item)
                    );
                }

                function createObjectUrlFromFd(fd) {
                    const fileName = fd.nomeFile || '';
                    const lowerName = fileName.toLowerCase();

                    let mimeType = 'application/octet-stream';
                    if (lowerName.endsWith('.png')) mimeType = 'image/png';
                    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
                    else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
                    else if (lowerName.endsWith('.gif')) mimeType = 'image/gif';
                    else if (lowerName.endsWith('.psd')) mimeType = 'image/vnd.adobe.photoshop';

                    const blob = new Blob([fd.file], { type: mimeType });
                    return URL.createObjectURL(blob);
                }

                function resetState() {
                    if (state.selectedUploadPreviewUrl) {
                        try {
                            URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                        }
                        catch (e) {
                            console.log(e);
                        }
                    }

                    state.selectedUploadFile = null;
                    state.selectedUploadPreviewUrl = null;
                    state.selectedRemotePhoto = null;
                }

                function getScopeSelection() {
                    const selectEl = $('#selectScopeCambiaFoto')[0];
                    let value = 'globale';

                    if (selectEl != null && selectEl.selectedIndex != null && selectEl.selectedIndex >= 0) {
                        value = selectEl.options[selectEl.selectedIndex].value;
                    }

                    return {
                        value: value,
                        area: (value === 'area' || value === 'canale_area') ? area : null,
                        canale: (value === 'canale' || value === 'canale_area') ? canale : null,
                        validaSoloPerLavorazione: value === 'solo_lavorazione'
                    };
                }

                function updateConfirmButtonState() {
                    const enabled = state.selectedUploadFile != null || state.selectedRemotePhoto != null;
                    $('#btnConfermaCambiaFoto').prop('disabled', !enabled);
                }

                function renderBaseLayout() {
                    $body.html(`
        <div id="cambiaFotoWrapper" style="
            display:flex;
            flex-direction:column;
            height:100%;
            max-height:100%;
        ">
            <div id="cambiaFotoTopBar" style="
                flex:0 0 auto;
                padding:0 0 10px 0;
                background:#fff;
                border-bottom:1px solid #ccc;
                margin-bottom:10px;
            ">
                <select id="selectScopeCambiaFoto" style="width:100%; box-sizing:border-box;">
                    ${getScopeOptionsHtml()}
                </select>
            </div>

            <div id="cambiaFotoScrollArea" style="
                flex:1 1 auto;
                overflow-y:auto;
                overflow-x:hidden;
                padding-right:4px;
            ">
                <div id="sectionUploadFoto" style="
                    border:1px solid #ccc;
                    padding:10px;
                    margin-bottom:12px;
                ">
                    <div style="
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        gap:8px;
                        margin-bottom:10px;
                    ">
                        <button type="button" id="btnCaricaFoto">Carica foto</button>
                        <button type="button" id="btnResetFotoScelta" style="display:none;">X</button>
                    </div>

                    <div id="previewUploadFoto" style="
                        display:none;
                        text-align:center;
                    ">
                        <div style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            min-width:90px;
                            min-height:90px;
                            padding:8px;
                            border:1px solid #ddd;
                            background:#f8f8f8;
                        ">
                            <img id="imgPreviewUploadFoto" src="" style="max-width:120px; max-height:120px;">
                            <div id="txtAnteprimaNonDisponibile" style="display:none; color:#777; font-size:11px; text-align:center;"></div>
                        </div>
                        <div id="txtNomeUploadFoto" style="margin-top:6px; font-size:11px; word-break:break-word;"></div>
                    </div>
                </div>

                <div id="separatorOppure" style="
                    text-align:center;
                    margin:10px 0 14px 0;
                    font-weight:bold;
                ">Oppure</div>

                <div id="sectionFotoAttualeWrapper" style="
                    margin-bottom:12px;
                    display:none;
                ">
                    <div style="
                        margin-bottom:8px;
                        font-weight:bold;
                    ">Foto attuale</div>
                    <div id="sectionFotoAttuale"></div>
                </div>

                <div id="sectionFotoEsistenti"></div>

                <div id="sectionFotoDisattivateWrapper" style="
                    margin-top:12px;
                    display:none;
                ">
                    <div style="
                        margin-bottom:8px;
                        font-weight:bold;
                    ">Elementi disattivati</div>
                    <div id="sectionFotoDisattivate"></div>
                </div>

                <div id="sectionAltreFotoWrapper" style="
                    margin-top:12px;
                    display:none;
                ">
                    <button type="button" id="btnToggleAltreFoto">Altre foto</button>
                    <div id="sectionAltreFoto" style="
                        display:none;
                        margin-top:10px;
                    "></div>
                </div>
            </div>
        </div>
    `);

                    setScopeSelection('globale');
                }

                function setScopeSelection(value) {
                    const selectEl = $('#selectScopeCambiaFoto')[0];
                    if (selectEl == null) {
                        return;
                    }

                    for (let i = 0; i < selectEl.options.length; i++) {
                        selectEl.options[i].selected = (selectEl.options[i].value === value);
                    }
                }
                
                function buildPhotoGrid($container, list, options) {
                    $container.empty();

                    options = options || {};

                    const isOtherSection = options.isOtherSection === true;
                    const isDisabledSection = options.isDisabledSection === true;

                    if (!Array.isArray(list) || list.length === 0) {
                        if (isOtherSection || isDisabledSection) {
                            return;
                        }
                        $container.html('<div>Nessuna foto disponibile</div>');
                        return;
                    }

                    for (let i = 0; i < list.length; i += 2) {
                        const $row = $(`
            <div style="
                display:flex;
                width:100%;
                margin-bottom:10px;
            "></div>
        `);

                        var isFromMeta = elementoCercato != null && elementoCercato.recordInTracciato != null
                            ? Boolean(elementoCercato.recordInTracciato["Foto.IsMeta"])
                            : false;
                        for (let j = i; j < i + 2 && j < list.length; j++) {
                            const item = list[j];
                            const selectable = isDisabledSection
                                ? true
                                : (isOtherSection ? !hasSamePhotoInCurrentContext(item) : isSelectableForCurrentContext(item));
                            const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=80&guidId=' + encodeURIComponent(item.GuidId);
                            const scopeText = getPhotoScopeText(item);
                            const contextText = getPhotoContextText(item);
                            //I20-971: data di caricamento della foto. Quando manca o non e'
                            //plausibile il badge non viene disegnato affatto.
                            const dataCaricamento = DataCaricamentoFoto.dataDaMostrare(item);
                            const dataBadgeHtml = dataCaricamento === '' ? '' : `
                                <div style="
                                    margin-top:4px;
                                    font-size:10px;
                                    color:#333;
                                    background:#e8e8e8;
                                    border:1px solid #ccc;
                                    border-radius:10px;
                                    padding:1px 8px;
                                " title="Data di caricamento della foto">${dataCaricamento}</div>
                            `;
                            const isActive = item.Attiva !== false;
                            const isDisabledItem = item.Attiva === false;


                            const isCurrentActivePhoto =
                                state.currentActivePhoto != null &&
                                state.currentActivePhoto.Id === item.Id;

                            let backgroundStyle = '#f8f8f8';
                            let opacityStyle = '1';
                            let cursorStyle = 'pointer';
                            let borderStyle = '1px solid #ccc';
                            let currentBadgeHtml = '';
                            let boxShadowStyle = 'none';

                            if (isCurrentActivePhoto && !isFromMeta) {
                                boxShadowStyle = 'inset 0 0 0 2px #f0a500';
                                currentBadgeHtml = `
                                <div style="
                                    position:absolute;
                                    top:6px;
                                    left:6px;
                                    font-size:10px;
                                    background:#f0a500;
                                    color:#000;
                                    padding:2px 6px;
                                    border-radius:10px;
                                    z-index:2;
                                ">Attuale</div>
                            `;
                            }

                            if (isOtherSection && !selectable) {
                                backgroundStyle = '#ebebeb';
                                opacityStyle = '0.65';
                                cursorStyle = 'default';
                            }

                            if (isDisabledSection || isDisabledItem) {
                                backgroundStyle = '#f3f0e8';
                                opacityStyle = selectable ? '1' : '0.65';
                                cursorStyle = selectable ? 'pointer' : 'default';
                            }

                            const clickClass = selectable ? 'foto-cambiabile' : 'foto-non-selezionabile';
                            const actionSymbol = isActive ? '⊘' : '✕';

                            const $cell = $(`
                <div style="
                    width:50%;
                    box-sizing:border-box;
                    padding:6px;
                ">
                    <div class="foto-item ${clickClass}" style="
                        position:relative;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        padding:8px;
                        min-height:150px;
                        border:${borderStyle};
                        box-shadow:${boxShadowStyle};
                        background:${backgroundStyle};
                        opacity:${opacityStyle};
                        cursor:${cursorStyle};
                    ">
                    ${currentBadgeHtml}
                        <div class="foto-item-action" style="  
                            position:absolute;
                            top:6px;
                            right:6px;
                            width:18px;
                            height:18px;
                            border-radius:50%;
                            border:1px solid #999;
                            display:none;
                            align-items:center;
                            justify-content:center;
                            font-size:10px;
                            line-height:10px;
                            background:#fff;
                            z-index:2;
                        ">${actionSymbol}</div>

                        <div class="foto-item-bg" style="
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            width:100%;
                            min-height:90px;
                            padding:6px;
                            box-sizing:border-box;
                            border-radius:4px;
                        ">
                            <img src="${thumbUrl}" style="
                                max-width:80px;
                                max-height:80px;
                                margin-bottom:0;
                            ">
                        </div>

                        <div style="
                            margin-top:6px;
                            font-size:11px;
                            text-align:center;
                            word-break:break-word;
                            width:100%;
                        ">${item.Nome}</div>

                        ${dataBadgeHtml}

                        <div style="
                            margin-top:4px;
                            font-size:10px;
                            text-align:center;
                            width:100%;
                        ">${contextText}</div>


                    </div>
                </div>
            `);

                            $cell.find('.foto-item').data('fotoData', {
                                Id: item.Id,
                                GuidId: item.GuidId,
                                Nome: item.Nome,
                                Area: item.Area,
                                Canale: item.Canale,
                                Attiva: item.Attiva,
                                scopeValue: getPhotoScopeValue(item),
                                thumbUrl: thumbUrl
                            });

                            $row.append($cell);
                        }

                        if (i + 1 >= list.length) {
                            $row.append(`
                <div style="
                    width:50%;
                    box-sizing:border-box;
                    padding:6px;
                "></div>
            `);
                        }

                        $container.append($row);
                    }
                }

                function renderPhotoSections() {
                    //I20-971: dentro ogni gruppo le foto vanno dalla piu' nuova alla piu' vecchia.
                    let fotoAttiveCompatibili = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        x.Attiva !== false && isSelectableForCurrentContext(x)
                    ));

                    let fotoDisattivateCompatibili = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        x.Attiva === false && isSelectableForCurrentContext(x)
                    ));

                    let fotoAltre = DataCaricamentoFoto.ordinaDallaPiuNuova(fotoList.filter(x =>
                        !isSelectableForCurrentContext(x)
                    ));

                    //La foto in uso si mostra per prima, sopra a tutte le sezioni. Esce dal suo
                    //gruppo per non comparire due volte, ma conserva le opzioni di quel gruppo,
                    //cosi' selezionabilita' e resa restano quelle di prima.
                    const idAttuale = state.currentActivePhoto != null ? state.currentActivePhoto.Id : null;
                    let fotoAttuale = null;
                    let opzioniAttuale = { isOtherSection: false, isDisabledSection: false };

                    const daAttive = DataCaricamentoFoto.estraiAttuale(fotoAttiveCompatibili, idAttuale);
                    if (daAttive.attuale != null) {
                        fotoAttuale = daAttive.attuale;
                        fotoAttiveCompatibili = daAttive.resto;
                    }
                    else {
                        const daDisattivate = DataCaricamentoFoto.estraiAttuale(fotoDisattivateCompatibili, idAttuale);
                        if (daDisattivate.attuale != null) {
                            fotoAttuale = daDisattivate.attuale;
                            fotoDisattivateCompatibili = daDisattivate.resto;
                            opzioniAttuale = { isOtherSection: false, isDisabledSection: true };
                        }
                        else {
                            const daAltre = DataCaricamentoFoto.estraiAttuale(fotoAltre, idAttuale);
                            if (daAltre.attuale != null) {
                                fotoAttuale = daAltre.attuale;
                                fotoAltre = daAltre.resto;
                                opzioniAttuale = { isOtherSection: true, isDisabledSection: false };
                            }
                        }
                    }

                    if (fotoAttuale != null) {
                        $('#sectionFotoAttualeWrapper').show();
                        buildPhotoGrid($('#sectionFotoAttuale'), [fotoAttuale], opzioniAttuale);
                    }
                    else {
                        $('#sectionFotoAttualeWrapper').hide();
                        $('#sectionFotoAttuale').empty();
                    }

                    buildPhotoGrid($('#sectionFotoEsistenti'), fotoAttiveCompatibili, {
                        isOtherSection: false,
                        isDisabledSection: false
                    });

                    buildPhotoGrid($('#sectionFotoDisattivate'), fotoDisattivateCompatibili, {
                        isOtherSection: false,
                        isDisabledSection: true
                    });

                    if (fotoDisattivateCompatibili.length > 0) {
                        $('#sectionFotoDisattivateWrapper').show();
                    } else {
                        $('#sectionFotoDisattivateWrapper').hide();
                        $('#sectionFotoDisattivate').empty();
                    }

                    if (fotoAltre.length > 0) {
                        $('#sectionAltreFotoWrapper').show();
                        buildPhotoGrid($('#sectionAltreFoto'), fotoAltre, {
                            isOtherSection: true,
                            isDisabledSection: false
                        });
                    } else {
                        $('#sectionAltreFotoWrapper').hide();
                        $('#sectionAltreFoto').empty();
                    }
                }

                function getPhotoContextText(item) {
                    const hasArea = item.Area != null && item.Area !== '';
                    const hasCanale = item.Canale != null && item.Canale !== '';

                    if (!hasArea && !hasCanale) {
                        return 'Globale';
                    }
                    if (hasArea && hasCanale) {
                        return item.Canale + ' ' + item.Area;
                    }
                    if (hasCanale) {
                        return item.Canale;
                    }
                    if (hasArea) {
                        return item.Area;
                    }
                    return 'Globale';
                }

                function buildScopeFromSelection() {
                    const value = $('#selectScopeCambiaFoto').val();

                    return {
                        value: value,
                        area: (value === 'area' || value === 'canale_area') ? area : null,
                        canale: (value === 'canale' || value === 'canale_area') ? canale : null,
                        validaSoloPerLavorazione: value === 'solo_lavorazione'
                    };
                }

                function getPhotoSpecificityRank(areaValue, canaleValue) {
                    const hasArea = areaValue != null && areaValue !== '';
                    const hasCanale = canaleValue != null && canaleValue !== '';

                    if (hasArea && hasCanale) return 3;
                    if (hasArea) return 2;
                    if (hasCanale) return 1;
                    return 0;
                }

                function getPhotoSpecificityText(areaValue, canaleValue) {
                    const hasArea = areaValue != null && areaValue !== '';
                    const hasCanale = canaleValue != null && canaleValue !== '';

                    if (hasArea && hasCanale) return (canaleValue + ' ' + areaValue);
                    if (hasArea) return areaValue;
                    if (hasCanale) return canaleValue;
                    return 'Globale';
                }

                function getPhotosThatWillBeDisabled(targetScope) {
                    const targetRank = getPhotoSpecificityRank(targetScope.area, targetScope.canale);
                    const currentRank = state.currentActivePhoto != null
                        ? getPhotoSpecificityRank(state.currentActivePhoto.Area, state.currentActivePhoto.Canale)
                        : null;

                    if (currentRank == null || targetRank >= currentRank) {
                        return [];
                    }

                    return fotoList.filter(item => {
                        if (item.Attiva === false) {
                            return false;
                        }

                        // Escludiamo tutto ciò che appartiene ad altri contesti
                        if (!isSelectableForCurrentContext(item)) {
                            return false;
                        }

                        const itemRank = getPhotoSpecificityRank(item.Area, item.Canale);
                        if (itemRank <= targetRank) {
                            return false;
                        }

                        // Se stiamo scegliendo una foto esistente, quella scelta non va inclusa
                        if (state.selectedRemotePhoto != null && item.Id === state.selectedRemotePhoto.Id) {
                            return false;
                        }

                        return true;
                    });
                }

                function buildDisableWarningConfirmContent(list) {
                    const $root = $(`
        <div style="
            display:flex;
            flex-direction:column;
            width:100%;
            height:100%;
            overflow:hidden;
        "></div>
    `);

                    const $text = $(`
        <div style="margin-bottom:10px;">
            <div style="font-weight:bold; margin-bottom:8px;">
                La foto che verrà impostata è di un grado più basso rispetto a quella attualmente attiva, se procedete le seguenti foto saranno disattivate:
            </div>
        </div>
    `);

                    const $list = $(`
        <div style="
            display:flex;
            flex-direction:column;
            gap:8px;
            max-height:240px;
            overflow:auto;
            border:1px solid #ccc;
            padding:8px;
            box-sizing:border-box;
            width:100%;
        "></div>
    `);

                    const $preview = $(`
        <div id="confirmFotoPreviewLarge" style="
            display:none;
            position:fixed;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);
            background:#fff;
            border:1px solid #999;
            padding:10px;
            z-index:99999;
            box-shadow:0 2px 10px rgba(0,0,0,0.35);
            pointer-events:none;
        ">
            <img src="" style="max-width:300px; max-height:300px; display:block;">
        </div>
    `);

                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=60&guidId=' + encodeURIComponent(item.GuidId);
                        const bigUrl = olimpoIp + 'getThumbNailOnDemand?width=300&guidId=' + encodeURIComponent(item.GuidId);
                        const contextText = getPhotoSpecificityText(item.Area, item.Canale);

                        const $row = $(`
                            <div style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                                width:100%;
                            ">
                                <img src="${thumbUrl}" style="
                                    width:40px;
                                    height:auto;
                                    border:1px solid #ccc;
                                    background:#f8f8f8;
                                    padding:2px;
                                    box-sizing:border-box;
                                    cursor:pointer;
                                ">
                                <div style="display:flex; flex-direction:column; min-width:0;">
                                    <div style="font-size:12px; word-break:break-word;">${item.Nome}</div>
                                    <div style="font-size:10px; opacity:0.8;">${contextText}</div>
                                </div>
                            </div>
                        `);

                        $row.find('img').on('mouseenter', function () {
                            $preview.find('img').attr('src', bigUrl);
                            $preview.css('display', 'block');
                        });

                        $row.find('img').on('mouseleave', function () {
                            $preview.css('display', 'none');
                            $preview.find('img').attr('src', '');
                        });

                        $list.append($row);
                    }

                    $root.append($text);
                    $root.append($list);
                    $root.append($preview);

                    return $root;
                }

                function resetInterface() {
                    resetState();
                    renderBaseLayout();
                    renderPhotoSections();
                    bindUiEvents();
                    updateConfirmButtonState();
                }

                function bindUiEvents() {
                    $('#btnConfermaCambiaFoto').off('click').on('click', async function () {
                        if (state.selectedUploadFile == null && state.selectedRemotePhoto == null) {
                            return;
                        }

                        const scope = getScopeSelection();

                        const fotosToDisable = getPhotosThatWillBeDisabled(scope);
                        if (fotosToDisable.length > 0) {
                            const confirmContent = buildDisableWarningConfirmContent(fotosToDisable);
                            const res = await Utility.confirm(confirmContent);

                            if (!res) {
                                return;
                            }
                        }


                        try {
                            showLoading("Aggiornamento foto...");
                            await Utility.sleep(10);

                            if (state.selectedRemotePhoto != null) {
                                const esito = await me.updateImmagineEsistente(
                                    codice,
                                    scope.area,
                                    scope.canale,
                                    scope.validaSoloPerLavorazione,
                                    state.selectedRemotePhoto.Id,
                                    fotoList
                                );

                                hideLoading();

                                if (esito) {
                                    Utility.closeAllModal();
                                }

                                return;
                            }

                            if (state.selectedUploadFile != null) {
                                await me.updateImmagine(
                                    codice,
                                    1,
                                    scope.area,
                                    scope.canale,
                                    state.selectedUploadFile,
                                    scope.validaSoloPerLavorazione,
                                    fotoList
                                );

                                hideLoading();
                                Utility.closeAllModal();
                                return;
                            }

                            hideLoading();
                        }
                        catch (e) {
                            console.log(e);
                            hideLoading();
                            await Utility.popup(
                                "Errore",
                                "Si è verificato un errore durante l'aggiornamento della foto."
                            );
                        }
                    });

                    $('#btnCaricaFoto').off('click').on('click', async function () {
                        try {
                            //I20-980: prima di mandare l'operatore a cercare, si guarda se nella
                            //cartella Links c'e' gia' il file che sta cercando e glielo si propone.
                            var fd = await me.fotoDaProporreDallaCartella(
                                codice,
                                { nome: nomeFotoImpaginata, hash: hashFotoImpaginata },
                                fotoList.map(function (foto) {
                                    return { nome: foto != null ? foto.Nome : null, hash: getFotoHash(foto) };
                                }));

                            if (fd == null) {
                                //Niente da proporre, oppure l'operatore ha detto di no: si sfoglia,
                                //partendo dalla foto attuale nella cartella della lavorazione.
                                fd = await selectFile(
                                    me.percorsoDiPartenzaPerFoto(percorsoLinks, nomeFotoImpaginata));
                            }
                            if (fd == null) {
                                return;
                            }

                            const lowerName = (fd.nomeFile || '').toLowerCase();
                            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.psd'];
                            const isValidImage = validExtensions.some(ext => lowerName.endsWith(ext));

                            if (!isValidImage || fd.file == null) {
                                await Utility.popup(
                                    "File non valido",
                                    "Seleziona un file immagine valido."
                                );
                                return;
                            }

                            if (state.selectedUploadPreviewUrl) {
                                try {
                                    URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                                }
                                catch (e) {
                                    console.log(e);
                                }
                            }

                            const previewUrl = createObjectUrlFromFd(fd);

                            state.selectedUploadFile = fd;
                            state.selectedUploadPreviewUrl = previewUrl;
                            state.selectedRemotePhoto = null;

                            setScopeSelection('globale');
                            updateConfirmButtonState();

                            me.mostraAnteprimaCaricamento(fd.nomeFile, previewUrl, fd.file);
                            $('#txtNomeUploadFoto').text(fd.nomeFile || '');
                            $('#previewUploadFoto').show();
                            $('#btnResetFotoScelta').show();

                            $('#sectionFotoAttualeWrapper').hide();
                            $('#sectionFotoEsistenti').hide();
                            $('#sectionFotoDisattivateWrapper').hide();
                            $('#sectionAltreFotoWrapper').hide();
                            $('#separatorOppure').hide();

                            $('.foto-item').css('border', '1px solid #ccc');
                            $('.foto-item-bg').css('background', 'transparent');
                        }
                        catch (e) {
                            console.log(e);
                            await Utility.popup(
                                "Errore",
                                "Errore durante il caricamento della foto."
                            );
                        }
                    });

                    $('#btnResetFotoScelta').off('click').on('click', function () {
                        resetInterface();
                    });

                    $('#btnToggleAltreFoto').off('click').on('click', function () {
                        const $section = $('#sectionAltreFoto');
                        const $scrollArea = $('#cambiaFotoScrollArea');
                        const isHidden = $section.css('display') === 'none';

                        if (isHidden) {
                            $section.css('display', 'block');
                            $(this).text('Nascondi altre foto');

                            // piccolo scroll verso il basso per far percepire che è comparso qualcosa
                            setTimeout(function () {
                                const currentScroll = $scrollArea.scrollTop();
                                $scrollArea.scrollTop(currentScroll + 80);
                            }, 30);
                        }
                        else {
                            $section.css('display', 'none');
                            $(this).text('Altre foto');
                        }
                    });

                    $('.foto-cambiabile').off('click').on('click', function () {
                        state.selectedUploadFile = null;
                        if (state.selectedUploadPreviewUrl) {
                            try {
                                URL.revokeObjectURL(state.selectedUploadPreviewUrl);
                            }
                            catch (e) {
                                console.log(e);
                            }
                        }
                        state.selectedUploadPreviewUrl = null;

                        $('#previewUploadFoto').hide();
                        $('#imgPreviewUploadFoto').attr('src', '').show();
                        $('#txtAnteprimaNonDisponibile').hide().text('');
                        $('#txtNomeUploadFoto').text('');
                        $('#btnResetFotoScelta').hide();

                        //La sezione della foto attuale torna visibile solo se ha una scheda:
                        //senza foto in uso non deve comparire un riquadro vuoto.
                        if ($('#sectionFotoAttuale .foto-item').length > 0) {
                            $('#sectionFotoAttualeWrapper').show();
                        }
                        $('#sectionFotoEsistenti').show();
                        $('#sectionFotoDisattivateWrapper').show();
                        if ($('#sectionAltreFoto .foto-item').length > 0) {
                            $('#sectionAltreFotoWrapper').show();
                        }
                        $('#separatorOppure').show();

                        $('.foto-item').css('border', '1px solid #ccc');
                        $('.foto-item-bg').css('background', 'transparent');

                        $(this).css('border', '1px solid #5b9dff');
                        $(this).find('.foto-item-bg').css('background', '#dcecff');

                        const fotoData = $(this).data('fotoData');
                        state.selectedRemotePhoto = fotoData;

                        setScopeSelection(fotoData.scopeValue);
                        updateConfirmButtonState();
                    });
                }

                resetInterface();

                hideLoading();
            });
        }
        catch (e) {
            hideLoading();
        }
    },

    async linkLogoBollo(tipo) {
        let me = this;
        var box = this.refSelected.item;

        if (box == null || box.isValid == null || !box.isValid) {
            await Utility.popup(
                "Nessun elemento selezionato",
                "Per collegare un logo bollo è necessario selezionare un elemento in pagina."
            );
            return;
        }
        showLoading("Scaricamento dati...");
        await Utility.sleep(10);

        getLoghiBolliData((objResult) => {
            hideLoading();

            Utility.apriModal('dialogLinkLogoBollo', 'Seleziona immagine', true, [], true);

            const $body = $('#bodyLinkLogoBollo');
            $body.empty();

            if (!Array.isArray(objResult) || objResult.length === 0) {
                $body.html('<div>Nessuna immagine disponibile</div>');
                return;
            }

            //rimuoviamo da objResult tutti gli elementi con il tipo diverso da quello passato come parametro
            objResult = objResult.filter(item => item.tipo == tipo);

            for (let i = 0; i < objResult.length; i += 2) {


                const $row = $(`
                <div style="
                    display:flex;
                    width:100%;
                    margin-bottom:10px;
                "></div>
            `);

                for (let j = i; j < i + 2 && j < objResult.length; j++) {
                    const item = objResult[j];
                    const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=60&guidId=' + encodeURIComponent(item.id);

                    const $cell = $(`
                    <div class="row-link-logo-bollo" style="
                        width:50%;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        padding:6px;
                        box-sizing:border-box;
                        margin-bottom:5px;
                    ">
                        <img src="${thumbUrl}" style="width:60px; height:auto; margin-bottom:6px;">
                        <button type="button" class="btn-link-logo-bollo">Aggiungi</button>
                    </div>
                `);

                    $cell.data('logoBollo', {
                        id: item.id,
                        fileHash: item.fileHash,
                        fileName: item.fileName,
                        idRef: item.idRef,
                        size: item.size,
                    });

                    $row.append($cell);
                }

                if (i + 1 >= objResult.length) {
                    $row.append(`
                    <div style="
                        width:50%;
                        box-sizing:border-box;
                    "></div>
                `);
                }

                $body.append($row);
            }

            $(document).off('click', '.btn-link-logo-bollo').on('click', '.btn-link-logo-bollo', async function () {
                const $cell = $(this).closest('.row-link-logo-bollo');
                const logoData = $cell.data('logoBollo');

                if (logoData == null) {
                    return;
                }

                const res = await Utility.confirm(`Confermi il collegamento del logo "${logoData.fileName}"?`);
                if (!res) {
                    return;
                }

                var schedaRef = me.schedeRefDati;

                var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
                if (primario == null) {
                    await Utility.popup(
                        "Nessun elemento primario trovato",
                        "Non è stato possibile trovare un elemento primario selezionato."
                    );
                    Utility.closeAllModal();
                    return;
                }

                try {
                    const folder = await fs2.getEntryWithUrl("file://" + /*pathLavorazione +*/ percorsoLoghi);
                    const entries = await folder.getEntries();

                    let fileEntry = null;

                    for (const entry of entries) {
                        if (!entry.isFile) {
                            continue;
                        }

                        if (entry.name === logoData.fileName) {
                            fileEntry = entry;
                            break;
                        }
                    }

                    if (fileEntry == null) {
                        await Utility.popup(
                            "Logo non disponibile",
                            `Il logo "${logoData.fileName}" non è stato scaricato. Effettua una syncFoto e riprova.`
                        );
                        Utility.closeAllModal();
                        return;
                    }

                    const data = await fileEntry.read({ format: uxp.storage.formats.binary });
                    const byteArray = new Uint8Array(data);
                    const localMd5 = cmd.md5ArrayBuffer(byteArray);

                    if (localMd5 !== logoData.fileHash) {
                        await Utility.popup(
                            "Logo non aggiornato",
                            `Il logo "${logoData.fileName}" non è aggiornato. Effettua una syncFoto e riprova.`
                        );
                        Utility.closeAllModal();
                        return;
                    }

                    // QUI POI PROSEGUIRÀ LA LOGICA SUCCESSIVA
                    console.log("Logo trovato e aggiornato:", logoData);

                    var xhr = new XMLHttpRequestClient();
                    xhr.onload = async (objResult, parsed) => {
                        console.log(objResult);
                        if (!parsed) {
                            try {
                                objResult = JSON.parse(objResult);
                            }
                            catch (e) {
                                messaggioUtente("Code SRF-51 Errore durante il parsing della risposta:" + e, "error");
                                return;
                            }
                        }

                        if (objResult.esito != null && !objResult.esito) {
                            messaggioUtente("Code SRF-52 Errore durante il collegamento del logo: " + objResult.error, "error");
                            return;
                        }


                        if (box == null || box.isValid == null || !box.isValid) {
                            messaggioUtente("Code SRF-53 Box selezionato non valido, l'elemento è stato correttamente linkato ma non verrà impaginato", "error");
                            return;
                        }

                        let rebindData = { nome: objResult.nomeReale, tipo: objResult.tipo, guidId: objResult.guidId, attiva: true, puntatore: false, sigla: objResult.pathFoto };
                        me.schedeRefDati.forEach(obj => {
                            obj.recordInTracciato["Foto.Extra"].push(rebindData);
                        });

                        //dobbiamo impaginare il logo 
                        me.impaginaFotoExtra(objResult.nomeReale, parseInt(objResult.tipo), me.refSelected.item, pathLavorazione, primario.recordInTracciato, objResult.pathFoto);


                    }

                    xhr.onreadystatechange = function () {
                        console.log(xhr);
                    };

                    xhr.onerror = function () {
                        console.log("error");
                    };

                    xhr.onNoConnection = async function () {
                    }


                    var formData = new FormData();


                    formData.append("guidId", logoData.id); //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("nomeReale", logoData.fileName) //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("fileHash", logoData.fileHash) //quello va letto dall'elemento della lista che abbiamo scaricato prima
                    formData.append("codiceReferenza", primario.recordInTracciato["Referenza.Codice"]); //quello va letto dalla referenza del primario

                    xhr.send("SyncFoto/linkLogoBollo/", formData, "PUT");

                } catch (ex) {
                    console.error(ex);
                    await Utility.popup(
                        "Errore",
                        "Si è verificato un errore durante il controllo del logo."
                    );
                    Utility.closeAllModal();
                }
            });
        });
    },

    escludiIncludiFotoExtraAuto(nomeFoto, attualmenteEscluso, box, row, tipo, sigla) {
        var schedaRef = this.schedeRefDati;
        let me = this;
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        //attualmenteEscluso è un booleano ma arriva come stringa per cui va fatto prima un cast
        attualmenteEscluso = attualmenteEscluso == "true" ? true : false;
        //se l'esito è positivo cerchiamo nel box un elemento con label uguale a foto_extra$nomeFoto e lo rimuoviamo
        
        if (attualmenteEscluso) {
            
            var box = me.impaginaFotoExtra(nomeFoto, parseInt(tipo), box, pathLavorazione, primario.recordInTracciato, sigla);
            if (box == null) {
                return;
            }
        }
        else {
            for (var i = 0; i < box.allPageItems.length; i++) {
                var el = box.allPageItems[i];
                if (el.label == "foto_extra$" + sigla + "$tipo_" + tipo) {
                    boundsElementToRemove = el.geometricBounds;
                    el.remove();
                    break;
                }
            }
        }
        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-54 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-55 Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-56 Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }
                //modifichiamo il colore del bottone in tomato e la scritta in escluso
                // var button = row.find("button");
                // console.log(button);
                // console.log(button.attr("id"));
                // console.log(row.attr("escluso"));
                // console.log(button.text());
                // button.text(!attualmenteEscluso ? "Includi" : "Escludi");
                // console.log(button.text());
                // row.attr("escluso", !attualmenteEscluso);
                // console.log(row.attr("escluso"));

                //cerchiamo nel primario la foto extra auto con nome uguale a nomeFoto e tipo uguale a tipo e aggiorniamo il suo stato di esclusione
                var fotoExtra = primario.recordInTracciato["Foto.ExtraAuto"].find(f => f.sigla == sigla && f.tipo == tipo);
                if (fotoExtra != null) {
                    fotoExtra.escluso = !attualmenteEscluso;
                }

                me.FotoExtraPanel(box);


            }
            catch (e) {
                messaggioUtente("Code SRF-57 Errore generico: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-58 Richiesta completata con successo", "success", false, 5);
                } else {
                }
            }
        };

        xhr.onerror = function () {
            messaggioUtente("Code SRF-59 Errore di rete", "error");
        }
        //recuperiamo il codice gruppo dell'elemento
        var CodiceGruppo = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1).recordInTracciato["Scatto.CodiceGruppo"];
        var formData = new FormData();
        formData.append("codiceGruppo", CodiceGruppo);
        formData.append("nomeFoto", nomeFoto);
        xhr.send("SyncFoto/escludiIncludiFotoExtraAuto/" + !attualmenteEscluso, formData, "PUT");
        messaggioUtente("Code SRF-60 Richiesta inviata", "success", true, 3, true);
    },

    CambiaStrutturaDato(box) {
        let me = this;
        var schedaRef = this.schedeRefDati;
        //me.resetRefInterface();

        //troviamo il primario in schedaRef
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-61 Nessun elemento primario trovato", "error");
            return;
        }

        showLoading("Preparazione interfaccia");

        let codiceGruppo = primario.recordInTracciato["Scatto.CodiceGruppo"];

        //Setto la tendina con i codici della ref
        //<sp-menu-item selected value="0">Seleziona </sp-menu-item>
        // let menuCodici = $("#cmbCodiceCambioStrutturale").find("sp-menu");
        // menuCodici.empty();
        let menuCodici = $("#cmbCodiceCambioStrutturale").find("sp-menu");
        this.resetCambioStrutturale();

        let codici = codiceGruppo.split(',');

        menuCodici.append("<sp-menu-item value=\"" + codiceGruppo + "\" selected>" + codiceGruppo + "</sp-menu-item>");

        if (codici.length > 1) {

            for (var i = 0; i < codici.length; i++) {
                menuCodici.append("<sp-menu-item value=\"" + codici[i] + "\">" + codici[i] + "</sp-menu-item>");
            }
        }

        if (this.addestramentoCampi == null) {
            //Caricamento dei campi di addestramento
            var xhr = new XMLHttpRequestClient();

            xhr.onload = async (objResult, parsed) => {
                try {
                    if (!parsed) {
                        try {
                            objResult = JSON.parse(objResult);
                        } catch (e) {
                            messaggioUtente("Code SRF-62 Errore durante il parsing della risposta: " + e, "error");
                            return;
                        }
                    }

                    me.addestramentoCampi = objResult.schemaCampiExcels;

                    hideLoading();

                } catch (e) {
                    // Gestione dell'errore e chiamata alla callback con l'errore
                    if (callback) {
                        callback(e, null);
                    }

                    hideLoading();
                }
            };

            xhr.onerror = function (e) {
                // Gestione degli errori di rete e chiamata alla callback con l'errore
                if (callback) {
                    callback(e, null);
                }

                hideLoading();
            };


            xhr.send("Tracciati/getAddestramentoByIdRecordLavorazione/" + this.idRecordLavorazione, null, "GET");
        }
        else {
            hideLoading();
        }

        //Aggiungo pulsante
        if (this.salvaCambioStrutturaleButton == null) {
            this.salvaCambioStrutturaleButton = $('<sp-action-button id="salvaButtonCambioStrutturale" style="color:lightgreen; margin-right:10px;">Salva modifiche</sp-action-button>');
            this.salvaCambioStrutturaleButton.on('click', function () {
                me.salvaCambioStrutturale();
            });
            $("#pulsantiExtra").append(this.salvaCambioStrutturaleButton);
        }
        else {
            this.salvaCambioStrutturaleButton.css("display", "block");
        }

    },
    aggiungiSetDiCambioStrutturale() {
        let me = this;

        let codiceCoinvolto = $("#cmbCodiceCambioStrutturale").val();
        let containerSets = $("#CambioStrutturale");

        let progSetter = containerSets.find(".setterCambioStrtturale").length + 1;

        let containerDivTemplate = "<div style=\"border: 2px solid white;padding: 5px;border-radius: 2%;margin-bottom:10px;\"></div>"

        let newSetRegole = $(containerDivTemplate);
        newSetRegole.attr("class", "setterCambioStrtturale");
        newSetRegole.attr("codice", codiceCoinvolto);
        newSetRegole.attr("id", "setter" + progSetter);
        newSetRegole.append("<h3 style=\"color:white;text-overflow: ellipsis;overflow: hidden;width: 550px;white-space: nowrap;\">" + codiceCoinvolto + "</h3>");

        //Aggiungo record di settaggio campo
        let row = this.aggiungiRigaKeyValCambioStrutturale(newSetRegole);
        // let campiSettaggioCmb=$("<div style=\"width:100%; display:flex;\"><div style=\"width:50%;display:flex;\"><sp-picker id=\"provaID\"><sp-menu slot=\"options\"></sp-menu></sp-picker></div><div style=\"width:45%;display:flex;\"><sp-textfield style=\"width: 45%\"; color: white;\"></sp-textfield></div></div>");
        // let menu = campiSettaggioCmb.find("sp-menu");

        // menu.append("<sp-menu-item value=\"0\" selected>Seleziona chiave</sp-menu-item>");

        // for (var i = 0; i < this.addestramentoCampi.length; i++) {
        //     let itemAddestr = this.addestramentoCampi[i]; 
        //     if (itemAddestr.nomeColonna!=null)
        //     {
        //         menu.append("<sp-menu-item value=\""+itemAddestr.nomeColonna+"\">"+itemAddestr.nomeColonna+"</sp-menu-item>");
        //     }
        // }
        newSetRegole.append(row);

        // campiSettaggioCmb.find("sp-picker").on("change",function(){
        //     schedaRef.leggiCampoAddestramentoDellaRef($(this));
        // });

        let bAddKeyVal = $("<sp-action-button style=\"color:lightgreen;margin-top:10px;\">Aggiungi chiave/valore</sp-action-button>");
        newSetRegole.append(bAddKeyVal);
        bAddKeyVal.on("click", function () {

            let row = me.aggiungiRigaKeyValCambioStrutturale(newSetRegole);
            row.insertBefore($(this));
        });

        containerSets.prepend(newSetRegole);

    },
    aggiungiRigaKeyValCambioStrutturale(container) {
        //Aggiungo record di settaggio campo
        let campiSettaggioCmb = $("<div class=\"keyValPair\" style=\"width:100%; display:flex;\"><div style=\"width:50%;display:flex;\"><sp-picker id=\"provaID\"><sp-menu slot=\"options\"></sp-menu></sp-picker></div><div style=\"width:45%;display:flex;\"><input type=\"text\" style=\"width: 45%; color: white;\"></input></div></div>");
        let menu = campiSettaggioCmb.find("sp-menu");

        menu.append("<sp-menu-item value=\"0\" selected>Seleziona chiave</sp-menu-item>");

        for (var i = 0; i < this.addestramentoCampi.length; i++) {
            let itemAddestr = this.addestramentoCampi[i];
            if (itemAddestr.nomeColonna != null) {
                menu.append("<sp-menu-item value=\"" + itemAddestr.nomeColonna + "\">" + itemAddestr.nomeColonna + "</sp-menu-item>");
            }
        }

        //container.append(campiSettaggioCmb);

        campiSettaggioCmb.find("sp-picker").on("change", function () {
            schedaRef.leggiCampoAddestramentoDellaRef($(this));
        });

        return campiSettaggioCmb;
    },
    onScrollingSetterCambioStrtturale() {
        //Metto invisibili tutti i sp-textfield che superano un certo livello
        let currScroll = $("#Tab13").scrollTop() + 5;

        //console.log("SCROLL -> " + currScroll);

        let containerSets = $("#CambioStrutturale");
        let offsetCalc = 0;
        containerSets.find(".setterCambioStrtturale").each(function () {
            //Check Y
            //let top = $(this).offset().top;
            let myOffset = $(this)[0].offsetTop;

            if (myOffset - currScroll < 0) {
                //Togliere input text
                $(this).find("input").css("display", "none");
            }
            else {
                //Mettere input text
                $(this).find("input").css("display", "block");
            }
        });

    },
    salvaCambioStrutturale() {
        let me = this;

        let containerSets = $("#CambioStrutturale");
        //Raccolgo le info e mando il dato a Istanta 

        //troviamo il primario in schedaRef
        let primario = this.schedeRefDati.find(f => f.recordInTracciato.StatoSelezione == 1);

        showLoading("Salvataggio in corso...");

        let codiceGruppo = primario.recordInTracciato["Scatto.CodiceGruppo"];
        let idRec = getIdRecFromItemRef(primario.recordInTracciato);
        let cambioMetaRequest = { codiceGruppo: codiceGruppo, azioni: [] };

        containerSets.find(".setterCambioStrtturale").each(function () {
            let codice = $(this).attr("codice");

            let azione = cambioMetaRequest.azioni.find(f => f.codice == codice);

            if (azione == null) {
                let isGruppo = codice.split(',').length > 1;
                azione = { codice: (!isGruppo ? codice : null), codiceSottoGruppo: null, attributi: [] };
                cambioMetaRequest.azioni.push(azione);
            }

            let container = $(this);
            let obj = {
                codice: codice,
                campi: []
            };

            container.find(".keyValPair").each(function () {
                let key = $(this).find("sp-picker").val();
                let val = $(this).find("input").val();

                azione.attributi.push({ key: key, val: val });
            });

        });

        console.log(cambioMetaRequest);

        let params = "codiceGruppo=" + encodeURIComponent(cambioMetaRequest.codiceGruppo);
        params += "&idRec=" + encodeURIComponent(idRec);
        for (let a = 0; a < cambioMetaRequest.azioni.length; a++) {
            let azione = cambioMetaRequest.azioni[a];
            let kAz = "azioni[" + a + "]";
            if (azione.codice != null) {
                params += "&" + kAz + ".codice=" + encodeURIComponent(azione.codice);
            }

            for (let attr = 0; attr < azione.attributi.length; attr++) {
                let attributo = azione.attributi[attr];
                let kAttr = kAz + ".attributi";//["+attr+"]";
                //params += "&"+kAttr+".Key=" + encodeURIComponent(attributo.key);
                //params += "&"+kAttr+".Value=" + encodeURIComponent(attributo.val);
                params += "&" + kAttr + "." + attributo.key + "=" + encodeURIComponent(attributo.val);
            }

        }

        console.log(params);
        indesignEvents.setBusy(true);

        this.salvaCambioStrutturaleDo(params);
    },

    salvaCambioStrutturaleDo(params) {
        let me = this;

        var xhr = new XMLHttpRequestClient();

        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code SRF-63 Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }

                if (objResult.esito) {

                    showLoading("Impaginazione della referenza");


                    let box = me.refSelected.item;
                    let bounds = box.geometricBounds;
                    let pagCoinvolta = me.refSelected.pagRef;
                    if (pagCoinvolta == null) {
                        //leggiamo la pagina da me.refSelected.item e la usiamo come pagCoinvolta
                        pagCoinvolta = me.refSelected.item.parentPage;
                        if (pagCoinvolta == null) {
                            throw "Impossibile trovare la pagina, assicurarsi di avere il box in pagina e riprovare";
                        }
                    }
                    //Prendo il primario per l'impaginazione
                    let itemRef = objResult.item;

                    if(itemRef == null){
                        //rimuoviamo dall'impaginato il box
                        if(box != null){
                            box.remove();
                        }
                        hideLoading();
                        indesignEvents.setBusy(false);
                        return;
                    }

                    let meccanica = itemRef["codiceBox"].toString() != "" ? itemRef["codiceBox"].toString() : itemRef["combinazioneAssegnata"].toString();
                    let listElementiNonImpaginati = [];

                    CssFramework.richiediDiScaricareFramework();

                    res = await impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, 1);

                    indesignEvents.setBusy(false);

                    hideLoading();

                    if (me.refSelected.item.isValid) {
                        //me.refSelected.item.remove();
                        await confronti.confrontoBox(me.refSelected.item, res.boxAggiunto);
                    }
                }
                else {
                    messaggioUtente("Code SRF-64 Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    hideLoading();
                    indesignEvents.setBusy(false);
                }



            } catch (e) {
                // Gestione dell'errore e chiamata alla callback con l'errore
                console.error(e);
                hideLoading();
                indesignEvents.setBusy(false);
                //Eseguo la reimpaginazione
            }
        };

        xhr.onerror = function (e) {
            // Gestione degli errori di rete e chiamata alla callback con l'errore
            hideLoading();
            indesignEvents.setBusy(false);
        };

        xhr.send("Menabo/setCambioStrutturale/" + idKitLavorazione + "/0", params, "PUT", "application/x-www-form-urlencoded");
    },

    leggiCampoAddestramentoDellaRef(sender) {
        let campo = sender.val();
        let containerMaster = sender.closest(".setterCambioStrtturale");
        let codice = containerMaster.attr("codice");

        let container = sender.parent().parent();

        //Prendo sempre il primo che trovo tanto in caso di CODICE GRUPPO, voglio unificare il campo ad un unico VALORRE a prescindere
        //Una cosa che andrebbe fatta successivaemente è far vedere quel valore per ogni cod (in consultazione)

        var element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice || f.recordInTracciato["Scatto.CodiceGruppo"] == codice);
        container.find("input").val(element.recordInTracciato[campo]);
    },
    // resetRefInterface(){
    //     //$("#codiceRef").empty();
    //     $("#editReferenza").empty();
    //     $("#cambiaPS").empty();
    //     $("#FotoExtra").empty();
    //     $("#alterazioneGruppo").empty();
    //     $("#gruppiFormati").empty(); 
    //     $("#meccanicaSelezionataText").text("Nessuna");
    //     $("#mastroSelezionataText").text("Nessuna");
    //     this.annullaCambiaMeccanica();
    //     $("#lastRowModificaMeccanica").css("visibility", "hidden");
    //     $("#pulsantiExtra").empty();
    //     $("#gruppiSelezionati").empty();
    //     //var multiSelection = this.multiSelection;
    //     // if(multiSelection != null && multiSelection.length > 0){
    //     //     $("#raggruppaImage").show();
    //     // }
    //     // else{
    //     //     $("#raggruppaImage").hide();
    //     // }
    //     var schedaRef = this.schedeRefDati;
    //     if(schedaRef == null || schedaRef.length == 0){
    //         $("#sgruppa").hide();
    //     }
    //     else{
    //         var codice = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"];
    //         if(!codice.includes(",")){
    //             $("#sgruppa").hide();
    //         }
    //     }
    //     $("#artworkTab").hide();

    //     this.salvaCambioStrutturaleButton=null;
    // },    

    resetRefInterface() {
        this.resetInitSchedaRef();
        this.resetFotoPS();
        this.resetFotoExtra();
        this.resetRaggruppa();
        this.resetCambioStrutturale();
    },

    resetInitSchedaRef() {
        //$("#codiceRef").empty();
        $("#editReferenza").empty();
        $("#meccanicaSelezionataText").text("Nessuna");
        $("#mastroSelezionataText").text("Nessuna");
        $("#pulsantiExtra").empty();

        this.annullaCambiaMeccanica();
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length == 0) {
            $("#sgruppa").hide();
        }
        else {
            var codice = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"];
            if (!codice.includes(",")) {
                $("#sgruppa").hide();
            }
        }

        $("#artworkTab").hide();
        this.salvaCambioStrutturaleButton = null;
    },

    resetFotoPS() {
        $("#cambiaPS").empty();
        $("#pulsantiExtra").empty();

    },

    resetFotoExtra() {
        $("#FotoExtra").empty();
        $("#pulsantiExtra").empty();

    },

    resetRaggruppa() {
        $("#alterazioneGruppo").empty();
        $("#gruppiFormati").empty();
        $("#gruppiSelezionati").empty();
        $("#pulsantiExtra").empty();

    },

    resetCambioStrutturale() {
        let menuCodici = $("#cmbCodiceCambioStrutturale").find("sp-menu");
        menuCodici.empty();
        $("#CambioStrutturale").empty();
    },

    svuotaRef() {
        //se refSelected non è null controlliamo se refSelected.item è valido, se refSelected.boxOriginalBounds non è null ed è un vettore di 4 elementi
        //se entambi i controlli sono positivi, controlliamo se le dimensioni di refSelected.item.geometricBounds sono diverse da refSelected.boxOriginalBounds.
        //Controlliamo width e height non la posizione nello spazio
        //se width e/o height sono diversi è stata fatta una manomissione illegale delle dimensioni del box e va ripristinato
        
        //DISATTIVATO PER TEST (AI GRAFICI DAVA NOIA) FUNZIONANTE NON CANCELLARE.
        // if (this.refSelected != null) {
        //     if (this.refSelected.item != null && this.refSelected.item.isValid) {
        //         if (this.refSelected.boxOriginalBounds != null && Array.isArray(this.refSelected.boxOriginalBounds) && this.refSelected.boxOriginalBounds.length == 4) {
        //             var currentBounds = this.refSelected.item.geometricBounds;
        //             var originalBounds = this.refSelected.boxOriginalBounds;
        //             var currentWidth = currentBounds[3] - currentBounds[1];
        //             var currentHeight = currentBounds[2] - currentBounds[0];
        //             var originalWidth = originalBounds[3] - originalBounds[1];
        //             var originalHeight = originalBounds[2] - originalBounds[0];
        //             if (currentWidth != originalWidth || currentHeight != originalHeight) {
        //                 const top = currentBounds[0];
        //                 const left = currentBounds[1];
        //                 this.refSelected.item.geometricBounds = [
        //                     top,
        //                     left,
        //                     top + originalHeight,
        //                     left + originalWidth
        //                 ];
        //             }
        //         }
        //     }
        // }

        this.refSelected = null;
        this.schedeRefDati = [];
        this.multiSelection = [];
        this.multiSchedeRef = [];
        this.isBusy = false;

        //I20-992: la scheda che si apre e' un'altra, quindi la pre analisi va rifatta e la
        //finestra puo' proporsi di nuovo. Il silenziamento invece resta: dura per la sessione,
        //e riaprire la stessa referenza non deve farlo decadere.
        this.dimenticaSegnalazioni();
        this.consentiAperturaAutomatica();
    },

    annullaCambiaMeccanica() {
        $('#AnnullaRow').hide();
        //$('#ModificaRow').show();
        $("#meccaniche").attr("initialized", "false");
        $("#meccanicaSelezionata").show();
        $("#meccaniche").hide();
    },

    stessoNomeFoto(nomeA, nomeB) {
        if (nomeA == null || nomeB == null) {
            return false;
        }

        return String(nomeA) === String(nomeB);
    },

    fotoInContestoLavorazione(item, area, canale) {
        if (item == null) {
            return false;
        }

        const itemArea = item.Area != null ? item.Area : "";
        const itemCanale = item.Canale != null ? item.Canale : "";
        const areaCorrente = area != null ? area : "";
        const canaleCorrente = canale != null ? canale : "";

        const areaOk = itemArea === "" || itemArea === areaCorrente;
        const canaleOk = itemCanale === "" || itemCanale === canaleCorrente;

        return areaOk && canaleOk;
    },

    getContestoFotoText(item) {
        if (item == null) {
            return "Globale";
        }

        const hasArea = item.Area != null && item.Area !== "";
        const hasCanale = item.Canale != null && item.Canale !== "";

        if (!hasArea && !hasCanale) {
            return "Globale";
        }
        if (hasArea && hasCanale) {
            return item.Canale + " " + item.Area;
        }
        if (hasCanale) {
            return item.Canale;
        }
        if (hasArea) {
            return item.Area;
        }

        return "Globale";
    },

    getRiscontriFotoConNome(nomeFoto, fotoList, area, canale, nomeFotoAttuale) {
        const lista = Array.isArray(fotoList) ? fotoList : [];
        const riscontri = lista.filter(item => item != null && this.stessoNomeFoto(item.Nome, nomeFoto));

        if (
            this.stessoNomeFoto(nomeFoto, nomeFotoAttuale) &&
            !riscontri.some(item => this.fotoInContestoLavorazione(item, area, canale))
        ) {
            riscontri.push({
                Nome: nomeFotoAttuale,
                Area: area,
                Canale: canale,
                Attiva: true
            });
        }

        return riscontri;
    },

    buildMessaggioRiscontriFoto(nomeFoto, riscontri, area, canale) {
        const me = this;
        const contesti = [];
        const includeContestoAttuale = riscontri.some(item => me.fotoInContestoLavorazione(item, area, canale));

        riscontri.forEach(function (item) {
            const contesto = me.getContestoFotoText(item);
            if (!contesti.includes(contesto)) {
                contesti.push(contesto);
            }
        });

        const contestiText = contesti.length > 0 ? contesti.join(", ") : "Globale";
        const prefisso = includeContestoAttuale ? "Nelle lavorazioni" : "Anche nelle lavorazioni";

        return "" +
            "<div style='display:flex; flex-direction:column; gap:10px; width:100%; color:#111; font-size:14px; line-height:1.35;'>" +
            "  <div>Un'immagine con il nome <b>" + me.escapeHtml(nomeFoto) + "</b> è già presente.</div>" +
            "  <div>" + prefisso + ": <b>" + me.escapeHtml(contestiText) + "</b> verrà sostituita l'immagine se si procede alla sostituzione.</div>" +
            "  <div>Scegli se sostituire l'immagine esistente o mantenere entrambe.</div>" +
            "</div>";
    },

    async scegliSostituisciOMantieni(messageHtml) {
        var result = null;
        Utility.nascondiHidebleElements();

        var modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        var dialog = $('<div style="width: 60%; height: 40%; background-color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px; box-sizing:border-box;"></div>');
        var header = $('<div style="display:flex; justify-content:flex-end; align-items:center; width:100%; height:24px; flex:0 0 auto;"></div>');
        var closeButton = $('<button style="width:24px; height:24px; background-color: transparent; color:#111; border:none; cursor:pointer; font-size:18px; line-height:18px;">&times;</button>');
        var messaggio = $('<div style="display: flex; height: calc(80% - 24px); width:100%; overflow:auto;"></div>');
        var contenuto = $('<div style="width:100%;"></div>');
        var pulsanti = $('<div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; height: 20%;"></div>');
        var sostituisci = $('<button style="width: 110px; height: 24px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Sostituisci</button>');
        var mantieni = $('<button style="width: 110px; height: 24px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Mantieni</button>');

        contenuto.html(messageHtml);
        messaggio.append(contenuto);

        modal.click(function (e) {
            e.stopPropagation();
        });

        sostituisci.click(function () {
            result = 1;
            $("#confirmModal").remove();
        });

        mantieni.click(function () {
            result = 2;
            $("#confirmModal").remove();
        });

        closeButton.click(function () {
            result = 0;
            $("#confirmModal").remove();
        });

        header.append(closeButton);
        pulsanti.append(sostituisci);
        pulsanti.append(mantieni);
        dialog.append(header);
        dialog.append(messaggio);
        dialog.append(pulsanti);
        modal.append(dialog);
        $("body").append(modal);

        while (result == null) {
            await Utility.sleep(100);
        }

        Utility.mostraHidebleElements();

        return {
            result: result !== 0,
            hiddenVal: result !== 0 ? result : null
        };
    },

    async richiediMetodoUploadDaRiscontri(nomeFoto, fotoList, area, canale, nomeFotoAttuale) {
        const riscontri = this.getRiscontriFotoConNome(nomeFoto, fotoList, area, canale, nomeFotoAttuale);

        if (riscontri.length === 0) {
            return {
                result: true,
                hiddenVal: 0
            };
        }

        var loadingText = $("#loadingPanel").find("h1").text();
        hideLoading();
        const messageHtml = this.buildMessaggioRiscontriFoto(nomeFoto, riscontri, area, canale);
        const res = await this.scegliSostituisciOMantieni(messageHtml);
        showLoading(loadingText);

        return res;
    },

    async updateImmagine(codice, tipo = 1, area = null, canale = null, fd = null, validaSoloPerLavorazione = false, fotoList = []) {
        try {
            //schedeRefDati = this.schedeRefDati;
            var box = this.refSelected.item;
            let me = this;
            console.log(codice);
            if(fd == null){
                fd = await selectFile();
            }
            if (fd == null) {
                return;
            }

            //hiddenVal 0 è non specificato, 1 è sovrascrivi, 2 è mantieni
            var res = { result: true, hiddenVal: 0 };
            var nomeFotoAttuale = "";
            var FotoImpaginata = null;
            var nomeFotoOld = "";
            var canaleDiInvio = ficoProcess.getCanaleLavorazioneCorrente();
            var tracciatoCanale = canaleDiInvio.sigla;
            var areaDiInvio = ficoProcess.getAreaLavorazioneCorrente();
            var tracciatoArea = areaDiInvio.sigla;

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                if (tipo == 1) {
                    nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                }
                else {
                    var extraGiaPresente = element.recordInTracciato["Foto.Extra"].find(f => f.tipo == tipo && f.NomeReale == fd.nomeFile);
                    if (extraGiaPresente != null) {
                        nomeFotoOld = fd.nomeFile;
                    }
                }
                if (element == null) {
                    messaggioUtente("Code SRF-65 Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto") ) || item.label.startsWith( (pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto") )) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }

                if (!validaSoloPerLavorazione) {
                    res = await me.richiediMetodoUploadDaRiscontri(
                        fd.nomeFile,
                        fotoList,
                        tracciatoArea,
                        tracciatoCanale,
                        nomeFotoAttuale
                    );

                    if (res.result == false) {
                        return;
                    }
                }
            }
            else {
                var primario = this.schedeRefDati.find(f => f.recordInTracciato["StatoSelezione"] == 1);
                if (primario == null) {
                    messaggioUtente("Code SRF-66 Nessun elemento primario trovato", "error");
                    return;
                }
                //se siamo qua è per forza per una foto extra poichè le foto vengono aggiornate solo ai singoli
                var extraGiaPresente = primario.recordInTracciato["Foto.Extra"].find(f => f.tipo == tipo && f.NomeReale == fd.nomeFile);
                if (extraGiaPresente != null) {
                    nomeFotoOld = fd.nomeFile;
                }
            }

            var obj = {
                "nomeFile": fd.nomeFile,
                "file": fd.file,
                "codice": codice,
                "tipo": tipo
            };
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                if (item.label == 'foto_extra$' + fd.nomeFile + '$tipo_' + tipo) {
                    messaggioUtente("Code SRF-67 L'immagine è già presente nel box", "warning", false, 5);
                    return;
                }
            }

            var formData = new FormData();
            formData.append("nomeFile", fd.nomeFile);
            formData.append("file", fd.file);
            formData.append("codice", codice);
            formData.append("tipo", obj.tipo);
            formData.append("area", area);
            formData.append("canale", canale);
            formData.append("tracciatoCanale", tracciatoCanale);
            formData.append("tracciatoArea", tracciatoArea);
            formData.append("idLavorazione", idKitLavorazione);
            if (validaSoloPerLavorazione) {
                formData.append("uploadMethod", 3);
            }
            else {
                formData.append("uploadMethod", res.hiddenVal);
            }
            formData.append("nomeFileOld", nomeFotoOld);
            formData.append("idRec", element != null ? element.idRec : 0);
            console.log(obj);
            messaggioUtente("Code SRF-68: Richiesta inviata", "success", true, 3, true);
            showLoading("Caricamento immagine in corso...");
            indesignEvents.setBusy(true);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code SRF-69: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log("Success");
                    console.log(data);
                    //inserisco nella cartella links la foto

                    //I20-967: l'impaginazione deve partire a scrittura conclusa, altrimenti il file non e'
                    //ancora nella cartella e viene impaginato il segnaposto di foto non trovata.
                    //Il file va scritto col nome deciso dal server: con uploadMethod "mantieni" il server
                    //rinomina la foto, e copiarla col nome locale lascerebbe in cartella la vecchia omonima.
                    var copiaRiuscita = false;
                    try {
                        await scriviFileInCartella(fd.file, /*pathLavorazione +*/ (obj.tipo != 1 ? percorsoLoghi : percorsoLinks), data.nomeReale);
                        copiaRiuscita = true;
                        console.log("fine copia");
                    }
                    catch (e) {
                        console.log("Copia della foto nella cartella fallita: " + e);
                    }

                    if (!copiaRiuscita && obj.tipo == 1) {
                        //La copia locale non e' riuscita: recuperiamo comunque il file dal server prima di impaginare.
                        await assicuraFotoNeiLinks(data.nomeReale, data.guidId);
                    }

                    if (obj.tipo != 1) {
                        //cerchiamo se l'immagine è già presente nel box, se lo è non eseguiamo l'impaginazione
                        let rebindData = { nome: data.nomeReale, tipo: data.tipo, guidId: data.guidId, attiva: true };
                        if (element != null) {
                            element.recordInTracciato["Foto.Extra"].push(rebindData);
                        }
                        else {
                            me.schedeRefDati.forEach(obj => {
                                obj.recordInTracciato["Foto.Extra"].push(rebindData);
                            });
                        }
                        
                        box = me.impaginaFotoExtra(data.nomeReale, obj.tipo, box, pathLavorazione, element != null ? element.recordInTracciato : null, null);
                    }
                    else {

                        //box = me.placeFoto(obj.nomeFile, box, FotoImpaginata, codice);
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            if(element.recordInTracciato.StatoSelezione!=3){
                                //I20-967: si impagina il nome deciso dal server, non quello del file locale:
                                //quando il server rinomina, il nome locale punta alla vecchia foto omonima
                                //rimasta in cartella e sulla pagina resterebbe l'immagine precedente.
                                let result = await impaginaFotoAppenaDisponibile(data.nomeReale, box, FotoImpaginata, codice, element.recordInTracciato.StatoSelezione);
                                box = result.box;
                                FotoImpaginata = result.fotoRectangle;
                            }
                            element.recordInTracciato["Foto.Nome"] = data.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = data.guidId;
                            element.recordInTracciato["Foto.Id"] = data.id;
                            element.recordInTracciato["Foto.Hash"] = data.Hash || data.hash;
                            element.recordInTracciato["Foto.IsMeta"] = validaSoloPerLavorazione;
                        }
                        await me.EditFotoPrimarieSecondarie(box);

                    }
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code SRF-70: Errore generico durante l'upload dell'immagine: " + e, "error");
                }
                finally {
                    hideLoading();
                    indesignEvents.setBusy(false);
                }
            }
            xhr.onreadystatechange = function () { }
            xhr.onerror = function () {
                console.error("Errore di rete durante l'upload dell'immagine");
                messaggioUtente("Code SRF-70.5: Errore di rete durante l'upload dell'immagine", "error");
                hideLoading();
                indesignEvents.setBusy(false);
            }
            xhr.sendFiles("SyncFoto/updateFotoFromIndd" + "/" + 0, formData);
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code SRF-71: Errore generico durante l'upload dell'immagine: " + e, "error");
            hideLoading();
            indesignEvents.setBusy(false);
        }
    },

    async updateImmagineEsistente(codice, area, canale, validaSoloPerLavorazione, id, fotoList = []) {
        try {
            

            var canaleDiInvio = ficoProcess.getCanaleLavorazioneCorrente();
            if (canaleDiInvio == null) {
                messaggioUtente("Code SRF-72 Canale di lavorazione corrente non trovato", "error");
                return false;
            }

            var tracciatoCanale = canaleDiInvio.sigla;

            var areaDiInvio = ficoProcess.getAreaLavorazioneCorrente();
            if (areaDiInvio == null) {
                messaggioUtente("Code SRF-73 Area di lavorazione corrente non trovata", "error");
                return false;
            }

            var tracciatoArea = areaDiInvio.sigla;


            var box = this.refSelected.item;
            let me = this;
            console.log(codice);

            var nomeFotoAttuale = "";
            var FotoImpaginata = null;
            const fotoSelezionata = Array.isArray(fotoList)
                ? fotoList.find(item => item != null && item.Id != null && id != null && String(item.Id) === String(id))
                : null;
            const propaga = fotoSelezionata != null && !me.fotoInContestoLavorazione(fotoSelezionata, tracciatoArea, tracciatoCanale);

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                
                nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                

                if (element == null) {
                    messaggioUtente("Code SRF-74: Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")) || item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto"))) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }
            }

            var formData = new FormData();
            formData.append("Codice", codice != null ? codice : "");
            formData.append("scopeArea", area != null ? area : "");
            formData.append("scopeCanale", canale != null ? canale : "");
            formData.append("tracciatoArea", tracciatoArea != null ? tracciatoArea : "");
            formData.append("tracciatoCanale", tracciatoCanale != null ? tracciatoCanale : "");
            formData.append("Id", id != null ? id : "");
            formData.append("validaSoloPerLavorazione", validaSoloPerLavorazione ? "true" : "false");
            formData.append("idLavorazione", idKitLavorazione);
            formData.append("propaga", propaga ? "true" : "false");


            return await new Promise((resolve) => {
                var xhr = new XMLHttpRequestClient();

                xhr.onload = async (objResult, parsed) => {
                    try {
                        if (!parsed) {
                            try {
                                objResult = JSON.parse(objResult);
                            } catch (e) {
                                messaggioUtente("Code SRF-75: Errore durante il parsing della risposta: " + e, "error");
                                resolve(false);
                                return;
                            }
                        }

                        if (objResult != null && !objResult.esito) {
                            messaggioUtente("Code SRF-76: Errore durante l'aggiornamento della foto esistente: " + objResult.error, "error");
                        }

                        if (box == null || !box.isValid) {
                            messaggioUtente("Code SRF-77: Box non trovato o non valido", "error");
                            resolve(false);
                            return;
                        }

                        //box = me.placeFoto(objResult.nomeReale, box, FotoImpaginata, codice);
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            if (element.recordInTracciato.StatoSelezione != 3) {
                                //I20-967: la foto scelta dall'archivio puo' non essere nei Links. La scarichiamo
                                //qui, prima di impaginarla, cosi' all'operatore non resta nessun passaggio manuale.
                                await assicuraFotoNeiLinks(objResult.nomeReale, objResult.guidId);

                                let result = await impaginaFotoAppenaDisponibile(objResult.nomeReale, box, FotoImpaginata, codice);
                                box = result.box;
                                FotoImpaginata = result.fotoRectangle;
                            }
                            element.recordInTracciato["Foto.Nome"] = objResult.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = objResult.guidId;
                            element.recordInTracciato["Foto.Id"] = objResult.id;
                            element.recordInTracciato["Foto.Hash"] = objResult.Hash || objResult.hash;

                            element.recordInTracciato["Foto.IsMeta"] = validaSoloPerLavorazione;
                        }
                        await me.EditFotoPrimarieSecondarie(box);


                        resolve(true);
                    } catch (e) {
                        console.error(e);
                        resolve(false);
                    }
                };

                xhr.onerror = function (e) {
                    console.error(e);
                    messaggioUtente("Code SRF-78: Errore di rete durante l'aggiornamento della foto esistente", "error");
                    resolve(false);
                };
                

                xhr.send("SyncFoto/updateImmagineEsistente/"+0, formData, "PUT");
            });
        } catch (e) {
            console.error(e);
            messaggioUtente("Code SRF-79: Errore generico durante la preparazione dell'aggiornamento della foto esistente", "error");
            return false;
        }
    },

    async eliminaMetaFoto(codice, tipo = 1) {
        try {
            var box = this.refSelected.item;
            let me = this;
            console.log(codice);

            var nomeFotoAttuale = "";
            var FotoImpaginata = null;

            let element = null;

            if (this.schedeRefDati != null && !codice.includes(",")) { //se il codice è un gruppo stiamo passando una foto extra e non c'è bisogno di questo passaggio
                //troviamo l'elemento in datiRefInEsame con lo stesso codice
                element = this.schedeRefDati.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
                if (tipo == 1) {
                    nomeFotoOld = element.recordInTracciato["Foto.Nome"];
                }

                if (element == null) {
                    messaggioUtente("Code SRF-80: Errore, dissincronia tra la referenza selezionata e quella che si sta provando a modificare", "error");
                    return;
                }
                nomeFotoAttuale = element.recordInTracciato["Foto.Nome"];

                for (var i = 0; i < box.allPageItems.length; i++) {
                    var item = box.allPageItems[i];
                    if (item.label.startsWith((pluginMiddleware.getCampo("nomeFotoPrimaria") !== null ? pluginMiddleware.getCampo("nomeFotoPrimaria") : "foto")) || item.label.startsWith((pluginMiddleware.getCampo("nomeFotoSecondaria") !== null ? pluginMiddleware.getCampo("nomeFotoSecondaria") : "foto"))) {
                        if (item.graphics.item(0).itemLink.name == nomeFotoAttuale) {
                            FotoImpaginata = item;
                            break;
                        }
                    }
                }
            }

            // var formData = new FormData();

            // formData.append("codice", codice);
            // formData.append("tipo", tipo);
            // formData.append("idLavorazione", idKitLavorazione);
            // formData.append("idRec", element != null ? element.idRec : 0);
            var idRec = element != null ? element.idRec : 0;
            messaggioUtente("RimuoviMetaFoto: Richiesta inviata", "success", true, 3, true);
            var xhr = new XMLHttpRequestClient();
            xhr.onload = async (data, parsed) => {
                try {
                    if (data.error != null && data.error != "") {
                        messaggioUtente("Code SRF-83: " + data.error, "error");
                    }
                    if (data.esito == false) {
                        return;
                    }
                    console.log("Success");
                    console.log(data);

                    if (tipo != 1) {

                        //DA DEFINIRE
                    }
                    else {

                        //box = me.placeFoto(data.nomeReale, box, FotoImpaginata, codice);
                        let result = FotoPlacer.updateFoto(data.nomeReale, box, FotoImpaginata, codice);
                        box = result.box;
                        FotoImpaginata = result.fotoRectangle;
                        //agiorniamo il nome della foto in element
                        if (element != null) {
                            element.recordInTracciato["Foto.Nome"] = data.nomeReale;
                            element.recordInTracciato["Foto.guidid"] = data.guidId;
                            element.recordInTracciato["Foto.Id"] = data.id;
                            element.recordInTracciato["Foto.IsMeta"] = false;
                            element.recordInTracciato["Foto.Hash"] = data.hash;
                        }
                        await me.EditFotoPrimarieSecondarie(box);
                    }
                }
                catch (e) {
                    console.log(e);
                    messaggioUtente("Code SRF-81: Errore generico durante l'upload dell'immagine: " + e, "error");
                }
            }
            xhr.onreadystatechange = function () { }
            xhr.onerror = function () { }
            xhr.send("SyncFoto/RimuoviFotoDaMeta" + "/" + codice + "/" + tipo + "/" + idKitLavorazione + "/" + idRec + "/" + 0, null, "GET");
        }
        catch (e) {
            console.log(e);
            messaggioUtente("Code SRF-82: Errore generico durante l'upload dell'immagine: " + e, "error");
        }
    },

    eliminaFotoExtra(idFoto, tipo, nomeFoto, box, sigla = null) {
        //mandiamo la richiesta con xhr
        let me = this;
        let schedaRef = this.schedeRefDati;
        //troviamo il primario
        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);

        var formData = new FormData();
        formData.append("nomeFile", nomeFoto);
        formData.append("codice", primario.recordInTracciato["Scatto.CodiceGruppo"]);
        formData.append("tipo", tipo);
        formData.append("idLavorazione", idKitLavorazione);
        formData.append("guidId", idFoto);

        var xhr = new XMLHttpRequestClient();
        xhr.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        messaggioUtente("Code SRF-84: Errore durante il parsing della risposta: " + e, "error");
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code SRF-85: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    return;
                }

                if (objResult.error != null && objResult.error != "") {
                    messaggioUtente("Code SRF-86: Operazione terminata con successo ma è stato registrato l'errore: " + objResult.error, "warning");
                }

                let schedaRef = this.schedeRefDati;
                //troviamo il primario

                if (schedaRef != null) {
                    for (var i = 0; i < schedaRef.length; i++) {
                        var element = schedaRef[i];
                        var fotoExtraToRemove = element.recordInTracciato["Foto.Extra"].find(f => f.guidId == idFoto);
                        if (fotoExtraToRemove != null) {
                            element.recordInTracciato["Foto.Extra"].splice(element.recordInTracciato["Foto.Extra"].indexOf(fotoExtraToRemove), 1);
                        }
                    }
                }
                //var altriBollini = [];
                me.eliminaFotoNelBox(nomeFoto, tipo, box, sigla);

                //me.FotoExtraPanel();

            }
            catch (e) {
                messaggioUtente("Code SRF-87: Errore generico durante l'eliminazione della foto extra: " + e, "error");
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code SRF-88: Richiesta completata con successo", "success", false, 5);
                } else {
                    //messaggioUtente("eliminaFotoExtra: Errore durante la richiesta: " + xhr.status, "error");
                }
            }
        };

        xhr.onerror = function () {
            //messaggioUtente("eliminaFotoExtra: Errore di rete", "error");
        }

        xhr.send("SyncFoto/RimuoviFoto/" + 0, formData, "PUT");
        messaggioUtente("eliminaFotoExtra: Richiesta inviata", "success", true, 3, true);

    },

    eliminaFotoNelBox(nomeFoto, tipo, box, sigla = null) {

        if (sigla != null) {
            nomeFoto = sigla;
        }

        for (var i = 0; i < box.allPageItems.length; i++) {
            if (box.allPageItems[i].label == "foto_extra$" + nomeFoto + "$tipo_" + tipo) {
                box.allPageItems[i].remove();
            }
        }

        this.FotoExtraPanel(box);
    },

    suddividiGruppo() {
        let me = this;
        //this.resetRefInterface();
        let schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length <= 1) {
            return;
        }
        $("#alterazioneGruppo").empty();
        $("#gruppiFormati").empty();
        //mandiamo la richiesta con xhr per scaricare il codice gruppo    

        var codici = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"].split(",");
        for (var i = 0; i < codici.length; i++) {
            //troviamo l'elemento con il codice corrispondente in objResult
            var objItem = schedaRef.find(function (item) {
                return item.recordInTracciato["Referenza.Codice"] == codici[i];
            });

            var row = $('<div class="row align-items-center" style="margin-bottom:10px" codice="' + codici[i] + '"></div>'); // Crea una nuova riga
            var text = $('<span>(' + codici[i] + ')</span>'); // Crea il testo
            text.css({ "font-size": "12px", "color": "white" });
            //creiamo un checkbox per ogni elemento con la classe "checkboxSgruppa"
            var checkbox = $('<input class="checkboxSgruppa" type="checkbox" codice="' + codici[i] + '" style="vertical-align: middle;">');
            //prima del checkbox controlliamo se l'elemento ha l'immagine e inseriamo l'icona corrispondente
            //var imgSrc = objItem.recordInTracciato["Foto.Nome"] != "" ? 'images/immaginePresente.png' : 'images/immagineNonPresente.png';
            var imgSrc = objItem.recordInTracciato["Foto.Nome"] != "" ? olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + objItem.recordInTracciato["Foto.guidid"] : 'images/immagineNonPresente.png';
            var img = $('<img>', { src: imgSrc, style: "width:50px; cursor:pointer", 'data-codice': objItem.recordInTracciato["Referenza.Codice"] });
            row.append(img, checkbox, text); // Aggiunge il testo alla riga
            $("#alterazioneGruppo").append(row); // Aggiunge la riga a #alterazioneGruppo
        }

        //aggiungiamo un bottono con scritto conferma gruppo, se premuto avvia la chiamata alla funzione formaGruppo
        var confermaButton = $('<sp-action-button id="confermaButtonGruppo" style="color:lightgreen">Conferma gruppo</sp-action-button>');
        confermaButton.on('click', function () {
            me.formaGruppo();
        });
        $("#alterazioneGruppo").append(confermaButton);
        $("#alterazioneGruppo").show();
    },

    // async sincronizzaImmagine(guidId, fotoDaSostituire){
    //     let me = this;
    //     let box = this.refSelected.item;
    //     try {
    //         var xhr = new XMLHttpRequestClient();
    //         xhr.onload = async (data, parsed) => {
    //             try {
    //                 if (data.error != null && data.error != "") {
    //                     messaggioUtente("SincronizzaImmagine: " + data.error, "error");
    //                 }
    //                 if (data.esito == false) {
    //                     return;
    //                 }
    //                 console.log(data);
    //                 var cartella = await fs2.getFolder();
    //                 //creiamo un oggetto contenente due funzioni, onProgress e onComplete
    //                 var objProcess = {

    //                     onComplete: async function ([nomeFile]) {
    //                         box = me.placeFoto(nomeFile, box, fotoDaSostituire, pathLavorazione);
    //                         me.refreshCambiaPS();
    //                     }
    //                 };
    //                 downloadImages([data], objProcess, cartella);

    //             }
    //             catch (e) {
    //                 console.log(e);
    //             }
    //         }

    //         xhr.onreadystatechange = function () {}

    //         xhr.onerror = function () {}

    //         xhr.onNoConnection = async function () {}

    //         xhr.send("SyncFoto/getInfoFoto/"+guidId, null, "GET", null);

    //     }
    //     catch (e) {
    //         console.log(e);
    //         messaggioUtente("SincronizzaImmagine: Errore durante la sincronizzazione dell'immagine: " + e, "error");
    //     }
    // },

    formaGruppo() {
        let me = this;
        //cerchiamo tutti i checkbox con classe checkboxSgruppa e controlliamo quali sono selezionati
        var checkboxes = $("#alterazioneGruppo").find("input[type='checkbox']:checked");
        if (checkboxes.length == 0) {
            return;
        }
        //modifichiamo il testo di #gruppiFormati per far si che mostri un codice gruppo formato dai codici selezionati separati da , con accanto un bottone X per eliminare il gruppo formato
        var codiceGruppo = "";
        var codici = [];
        for (var i = 0; i < checkboxes.length; i++) {
            var codice = $(checkboxes[i]).attr("codice");
            codici.push(codice);
            codiceGruppo += codice + ",";
        }
        codiceGruppo = codiceGruppo.slice(0, -1);
        var row = $('<div class="row align-items-center" style="margin-bottom:10px" codice="' + codiceGruppo + '"></div>'); // Crea una nuova riga
        var text = $('<span>(' + codiceGruppo + ')</span>'); // Crea il testo
        text.css({ "font-size": "12px", "color": "white" });
        var button = $('<button style="color:red">X</button>');
        //il bottone X oltre a rimuovere la riga deve anche chiamare la funzione RipristinaGruppo
        button.on('click', function () {
            me.RipristinaGruppo($(this).parent().attr("codice"));
        });
        row.append(button, text); // Aggiunge il testo alla riga
        $("#gruppiFormati").append(row); // Aggiunge la riga a #gruppiFormati

        //a questo punto togliamo la spunta da tutti i checkbox in #alterazioneGruppo e nascondiamo le righe di quei checkbox
        for (var i = 0; i < checkboxes.length; i++) {
            $(checkboxes[i]).prop("checked", false);
            $(checkboxes[i]).parent().hide();
        }
        //a questo punto se tutti i checkbox sono nascosti aggiungiamo un pulsante a #alterazioneGruppo con scritto "Sgruppa" che se premuto chiama la funzione Sgruppa passandogli 
        //come parametri la lista di codici gruppo formati leggendo da #gruppiFormati i valori di tutti i codici gruppo formati
        //se invece ci sono ancora checkbox visibili nascondiamo il pulsante Sgruppa se presente

        // $("#alterazioneGruppo .row").each(function () {
        //     console.log($(this).attr("style")); // This should print "display: none" for hidden rows
        // });

        var visibleRows = $("#alterazioneGruppo .row").filter(function () {
            return $(this).attr("style").indexOf("display: none") === -1;
        });

        console.log(visibleRows.length);

        if (visibleRows.length == 0) {
            var impostaPSButton = $('<sp-action-button id="ImpostaPS" style="color:lightgreen">Conferma</sp-action-button>');
            impostaPSButton.on('click', function () {
                var codici = [];
                for (var i = 0; i < $("#gruppiFormati").find(".row").length; i++) {
                    codici.push($($("#gruppiFormati").find(".row")[i]).attr("codice"));
                }

                me.Sgruppa(codici);

            });
            $("#alterazioneGruppo").append(impostaPSButton);
            //nascondiamo il pulsante conferma mettendo il suo display a none
            $("#confermaButtonGruppo").hide();
        }
        else {
            $("#ImpostaPS").remove();
            $("#confermaButtonGruppo").show();
        }
    },

    RipristinaGruppo(codice) {
        if (codice == null || codice == "") {
            return;
        }
        //cerchiamo la riga con codice uguale a quello passato come parametro e la rimuoviamo
        $("#gruppiFormati").find(".row[codice='" + codice + "']").remove();
        //facciamo lo split del codiceGruppo ricevuto e poi cerchiamo i checkbox con codice uguale a quelli splittati e li mostriamo
        var codici = codice.split(",");
        for (var i = 0; i < codici.length; i++) {
            $("#alterazioneGruppo").find(".row[codice='" + codici[i] + "']").show();
        }
        $("#ImpostaPS").remove();
        $("#confermaButtonGruppo").show();
    },

    ImpostaPSSottogruppi(codiciGruppi) {
        let me = this;
        let schedaRef = this.schedeRefDati;
        console.log(codiciGruppi);
        //se codici.lenght è uguale a 1 mandiamo un alert e ritorniamo
        if (codiciGruppi.length == 1) {
            messaggioUtente("Code SRF-89: Selezionare almeno due gruppi per poter procedere", "error");
            return;
        }
        // var objResult = JSON.parse(xhr.responseText);
        // console.log(objResult);
        try {
            //svuotiamo #alterazioneGruppo e #gruppiFormati
            $("#alterazioneGruppo").empty();
            $("#gruppiFormati").empty();
            //cambiamo il testo del pulsante sgruppa in torna indietro
            $("#sgruppa").text("Torna indietro");

            //per ogni codiceGruppo inseriamo una riga in #gruppiformati con il codiceGruppo
            //poi in #alterazioneGruppo inseriamo una riga per ogni codice del gruppo con due checkbox uno per primario e uno per secondario
            for (var i = 0; i < codiciGruppi.length; i++) {
                //creiamo un elemento container con il codice del gruppo e classe containerGruppoPerSgruppamento
                var container = $('<div class="containerGruppoPerSgruppamento" codice="' + codiciGruppi[i] + '"></div>');
                var row = $('<div class="row align-items-center" style="margin-bottom:10px" codice="' + codiciGruppi[i] + '"></div>'); // Crea una nuova riga
                var text = $('<span>(' + codiciGruppi[i] + ')</span>'); // Crea il testo
                text.css({ "font-size": "12px", "color": "white" });
                row.append(text); // Aggiunge il testo alla riga
                $("#alterazioneGruppo").append(row); // Aggiunge la riga a #gruppiFormati

                var codici = codiciGruppi[i].split(",");
                for (var j = 0; j < codici.length; j++) {
                    //troviamo nell'objResult l'elemento con codice uguale a codici[j] e prendiamo il valore di StatoSelezione
                    var statoSelezione = schedaRef.find(function (item) {
                        return item.recordInTracciato["Referenza.Codice"] == codici[j];
                    }).StatoSelezione;
                    var row = $('<div class="row align-items-center" style="margin-bottom:10px" codice="' + codici[j] + '"></div>'); // Crea una nuova riga
                    var text = $('<span>(' + codici[j] + ')</span>'); // Crea il testo
                    text.css({ "font-size": "12px", "color": "white" });
                    var checkbox1 = $('<input class="checkboxSgruppa primario" type="checkbox" codice="' + codici[j] + '" style="vertical-align: middle;">');
                    //se lo stato selezione è 1 mettiamo il checkbox1 a checked
                    if (statoSelezione == 1) {
                        checkbox1.prop("checked", true);
                    }
                    var label1 = $('<label for="checkbox1">P:</label>'); // Crea l'etichetta per il primo checkbox

                    var checkbox2 = $('<input class="checkboxSgruppa secondario" type="checkbox" codice="' + codici[j] + '" style="vertical-align: middle;">');
                    //se lo stato selezione è 2 mettiamo il checkbox2 a checked
                    if (statoSelezione == 2) {
                        checkbox2.prop("checked", true);
                    }
                    var label2 = $('<label for="checkbox2">S:</label>'); // Crea l'etichetta per il secondo checkbox

                    label1.css({ "font-size": "12px", "color": "lightblue" });
                    checkbox1.css("background-color", "blue");
                    label2.css({ "font-size": "12px", "color": "yellow" });
                    checkbox2.css("background-color", "yellow");
                    //infine se l'elemento ha una foto mettiamo l'icona con l'immagine prima dei checkbox
                    var single = schedaRef.find(function (item) {
                        return item.recordInTracciato["Referenza.Codice"] == codici[j];
                    });
                    var imgSrc = single.recordInTracciato["Foto.Nome"] != "" ? olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + single.recordInTracciato["Foto.guidid"] : 'images/immagineNonPresente.png';
                    var img = $('<img>', { src: imgSrc, style: "width:50px; cursor:pointer;", 'data-codice': codici[j] });

                    //appediamo i checkbox e i label alla riga
                    row.append(img, checkbox1, label1, checkbox2, label2, text); // Aggiunge il testo alla riga
                    container.append(row);
                    $("#alterazioneGruppo").append(container); // Aggiunge la riga a #alterazioneGruppo
                }

            }

            //appendiamo infine un bottone con scritto conferma modifiche rosso, se premuto chiama la funzione Sgruppa
            var confermaButton = $('<sp-action-button style="color:lightcoral">Conferma modifiche</sp-action-button>');
            confermaButton.on('click', function () {
                me.Sgruppa();
            });
            $("#alterazioneGruppo").append(confermaButton);
        }
        catch (e) {
            messaggioUtente("Code SRF-90 errore generico: " + e, "error");
        }


    },

    Sgruppa(codiciGruppi = []) {

        showLoading("Operazione in corso...");

        let me = this;
        let box = this.refSelected.item;
        let CodiceGruppoOriginale = this.refSelected.codiceGruppo;
        let idRec = 0;
        try {
            var dna = Utility.getDnaOfBox(box);
            if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                idRec = parseInt(dna.idRec);
            }
        }
        catch (e) {
            console.warn("Impossibile recuperare idRec del gruppo originale in Sgruppa", e);
        }
        //cerchiamo tutti i containerGruppoPerSgruppamento e per ognuno di essi cerchiamo i checkbox selezionati
        //se non ci sono checkbox con classe primario selezionati all'interno di un container mandiamo un alert e ritorniamo
        //se ci sono più di un checkbox con classe primario selezionati all'interno di un container mandiamo un alert e ritorniamo

        var objToSend = [];
        console.log(objToSend);
        //mandiamo la richiesta con xhr
        var params = "";
        for (var i = 0; i < codiciGruppi.length; i++) {
            params += "ListaGruppi[" + i + "].CodiceGruppo=" + codiciGruppi[i] + "&";
        }
        params += "originalGroup=" + CodiceGruppoOriginale;
        params += "&idRec=" + encodeURIComponent(idRec);
        console.log(params);


        var xhr = new XMLHttpRequestClient();
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code RSF-91: Errore durante il parsing della risposta: " + e, "error");
                        hideLoading();
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con tre parametri, esito, error e listaGruppi
                if (!objResult.esito) {
                    messaggioUtente("Code RSF-92: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    hideLoading();
                    return;
                }

                //per ogni gruppo formato trovato in objResult.listaGruppi
                for (var i = 0; i < objResult.listaGruppi.length; i++) {
                    var itemRef = objResult.listaGruppi[i];

                    console.log(itemRef);

                    var bounds = box.geometricBounds;
                    var meccanica = itemRef["codiceBox"].toString() != "" ? itemRef["codiceBox"].toString() : itemRef["combinazioneAssegnata"].toString();
                    var pagCoinvolta = me.refSelected.pagRef;
                    if (pagCoinvolta == null) {
                        //leggiamo la pagina da me.refSelected.item e la usiamo come pagCoinvolta
                        pagCoinvolta = me.refSelected.item.parentPage;
                        if (pagCoinvolta == null) {
                            throw "Impossibile trovare la pagina, assicurarsi di avere il box in pagina e riprovare";
                        }
                    }
                    var listElementiNonImpaginati = [];

                    //Il risultato di questa funzione è fatto di una lista di ArticoloInRevisioneKitResult
                    //Non puo essere dato in pasto a impaginaBox  perchè questa funzione si aspetta un Dictionary<>string,object>
                    //Quini la soluzione è adattare il risuiltato di Sgruppa a quello che fa già adesso il Menab/impaginaFromIndesignNew
                    CssFramework.richiediDiScaricareFramework();
                    showLoading("Impaginazione in corso...");
                    res = await impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, 1);
                    trovato = res.trovato;
                    listElementiNonImpaginati = res.listElementiNonImpaginati;
                }

                //rimuoviamo il box originale
                me.refSelected.item.remove();
                me.resetRefSelected();

                indesignEvents.resetLastSelection();

                hideLoading();

            }
            catch (e) {
                messaggioUtente("Code RSF-93: Errore generico durante l'impaginazione: " + e, "error");
                hideLoading();
                console.log(e);
            }
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code RSF-94: Richiesta completata con successo", "success", false, 5);
                } else {
                    //messaggioUtente("Sgruppa: Errore durante la richiesta: " + xhr.status, "error");
                }
            }
        };

        xhr.onerror = function () {
            //messaggioUtente("Sgruppa: Errore di rete", "error");
        };

        xhr.send("Menabo/Sgruppa/" + idKitLavorazione + "/" + 0, params, "PUT", "application/x-www-form-urlencoded");
        messaggioUtente("Sgruppa: Richiesta inviata", "success", true, 3, true);
    },

    async SchermataRaggruppamento() {
        let me = this;
        var multiSchedeRef = this.multiSchedeRef;
        var multiSelection = this.multiSelection;
        var listaCodiciConId = this.getCodiciConIdFromMultiSelection(multiSelection);
        $("#raggruppa").attr("codiciConId", encodeURIComponent(JSON.stringify(listaCodiciConId)));
        $("#gruppiSelezionati").empty();
        //me.resetRefInterface();
        var listaCodiciGruppo = [];
        for (var i = 0; i < multiSelection.length; i++) {
            listaCodiciGruppo.push(multiSelection[i].codiceGruppo);
            var codiceGruppo = multiSelection[i].codiceGruppo;
            //scarichiamo le schedeRefDati per ogni codiceGruppo
            var gruppo = multiSchedeRef.find(f => f[0].recordInTracciato["Scatto.CodiceGruppo"] == codiceGruppo);
            var primario = gruppo.find(f => f.recordInTracciato.StatoSelezione == 1);
            // Puoi ora usare `schedaRef` qui
            //compiliamo la riga con il codiceGruppo e l'immagine
            var row = $('<div class="row align-items-center" style="margin-bottom:10px" codice="' + codiceGruppo + '"></div>'); // Crea una nuova riga
            var text = $('<span>(' + codiceGruppo + ')</span>'); // Crea il testo
            text.css({ "font-size": "12px", "color": "white" });
            //creiamo l'immagine
            var imgSrc = primario.recordInTracciato["Foto.Nome"] != "" ? olimpoIp + "getThumbNailOnDemand?width=50&guidId=" + primario.recordInTracciato["Foto.guidid"] : 'images/immagineNonPresente.png';
            var img = $('<img>', { src: imgSrc, style: "width:50px; cursor:pointer", 'data-codice': codiceGruppo });
            row.append(img, text); // Aggiunge il testo alla riga
            $("#gruppiSelezionati").append(row); // Aggiunge la riga a #raggruppaImage

        }

        hideLoading();
        indesignEvents.setBusy(false);

    },

    getCodiciConIdFromMultiSelection(multiSelection) {
        var lista = [];
        if (!Array.isArray(multiSelection)) {
            return lista;
        }

        for (var i = 0; i < multiSelection.length; i++) {
            var item = multiSelection[i] || {};
            var codice = item.codiceGruppo != null ? item.codiceGruppo.toString() : "";
            if (codice === "") {
                continue;
            }

            var idRec = 0;
            if (item.idRec != null && item.idRec !== "" && !isNaN(parseInt(item.idRec))) {
                idRec = parseInt(item.idRec);
            }
            else if (item.IdRec != null && item.IdRec !== "" && !isNaN(parseInt(item.IdRec))) {
                idRec = parseInt(item.IdRec);
            }
            else if (item.item != null && item.item.isValid) {
                var dna = Utility.getDnaOfBox(item.item);
                if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                    idRec = parseInt(dna.idRec);
                }
            }

            lista.push({ codice: codice, idRec: idRec });
        }

        return lista;
    },

    raggruppa(codiciConIdEncoded = null) {
        showLoading("Operazione in corso...");
        let me = this;

        var listaCodiciConId = [];
        if (codiciConIdEncoded != null && codiciConIdEncoded !== "") {
            try {
                listaCodiciConId = JSON.parse(decodeURIComponent(codiciConIdEncoded));
            }
            catch (e) {
                console.warn("Payload codiciConId non valido, uso fallback da multiSelection");
            }
        }

        var multiSelection = this.multiSelection;
        if (!Array.isArray(listaCodiciConId) || listaCodiciConId.length === 0) {
            listaCodiciConId = this.getCodiciConIdFromMultiSelection(multiSelection);
        }

        if (!Array.isArray(listaCodiciConId) || listaCodiciConId.length === 0) {
            messaggioUtente("Code RSF-95A: Nessun elemento valido da raggruppare", "error");
            hideLoading();
            return;
        }

        console.log(listaCodiciConId);
        let box = multiSelection[0].item;

        var params = "";
        for (var i = 0; i < listaCodiciConId.length; i++) {
            var codice = listaCodiciConId[i] != null && listaCodiciConId[i].codice != null ? listaCodiciConId[i].codice.toString() : "";
            var idRec = listaCodiciConId[i] != null && listaCodiciConId[i].idRec != null && !isNaN(parseInt(listaCodiciConId[i].idRec))
                ? parseInt(listaCodiciConId[i].idRec)
                : 0;

            if (codice === "") {
                continue;
            }

            params += "ListaCodiciConId[" + i + "].codice=" + encodeURIComponent(codice) + "&";
            params += "ListaCodiciConId[" + i + "].idRec=" + encodeURIComponent(idRec) + "&";
        }

        var xhr = new XMLHttpRequestClient();
        xhr.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    } catch (e) {
                        messaggioUtente("Code RSF-95: Errore durante il parsing della risposta: " + e, "error");
                        hideLoading();
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con tre parametri, esito, error e listaGruppi
                if (!objResult.esito) {
                    messaggioUtente("Code RSF-96: Errore durante il salvataggio delle modifiche: " + objResult.error, "error");
                    hideLoading();
                    return;
                }

                //for (var i = 0; i < objResult.listaGruppi.length; i++) {
                //var itemRef = objResult.listaGruppi[i];
                var itemRef = objResult.gruppo;//.listaGruppi[i];

                var bounds = box.geometricBounds;
                var meccanica = itemRef["codiceBox"].toString() != "" ? itemRef["codiceBox"].toString() : itemRef["combinazioneAssegnata"].toString();
                var pagCoinvolta = multiSelection[0].pagRef;
                if (pagCoinvolta == null) {
                    //leggiamo la pagina da me.refSelected.item e la usiamo come pagCoinvolta
                    pagCoinvolta = multiSelection[0].item.parentPage;
                    if (pagCoinvolta == null) {
                        throw "Impossibile trovare la pagina, assicurarsi di avere il box in pagina e riprovare";
                    }
                }
                var listElementiNonImpaginati = [];

                CssFramework.richiediDiScaricareFramework();
                showLoading("Impaginazione in corso...");

                res = await impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, pathLavorazione, listElementiNonImpaginati, 1);
                trovato = res.trovato;
                listElementiNonImpaginati = res.listElementiNonImpaginati;
                //}

                //rimuoviamo il box originale

                //rimuoviamo dalla pagina tutti i gruppi contenuti in multiSelection[].item
                for (var i = multiSelection.length - 1; i >= 0; i--) {
                    multiSelection[i].item.remove();
                }

                me.resetRefSelected();

                indesignEvents.resetLastSelection();

                hideLoading();
            }
            catch (e) {
                messaggioUtente("Code RSF-97: Errore generico durante l'impaginazione: " + e, "error");
                console.log(e);
            }
        };

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    messaggioUtente("Code RSF-98: Richiesta completata con successo", "success", false, 5);
                } else {
                    //messaggioUtente("raggruppa: Errore durante la richiesta: " + xhr.status, "error");
                }
            }
        };

        xhr.onerror = function () {
            //messaggioUtente("raggruppa: Errore di rete", "error");
        }

        xhr.send("Menabo/Raggruppa/" + idKitLavorazione + "/" + 0, params, "PUT", "application/x-www-form-urlencoded");
        messaggioUtente("raggruppa: Richiesta inviata", "success", true, 3, true);

    },

    resetRefSelected() {

        if (this.refSelected != null) {
            if (this.refSelected.item != null && this.refSelected.item.isValid) {
                if (this.refSelected.boxOriginalBounds != null && Array.isArray(this.refSelected.boxOriginalBounds) && this.refSelected.boxOriginalBounds.length == 4) {
                    var currentBounds = this.refSelected.item.geometricBounds;
                    var originalBounds = this.refSelected.boxOriginalBounds;
                    var currentWidth = currentBounds[3] - currentBounds[1];
                    var currentHeight = currentBounds[2] - currentBounds[0];
                    var originalWidth = originalBounds[3] - originalBounds[1];
                    var originalHeight = originalBounds[2] - originalBounds[0];
                    if (currentWidth != originalWidth || currentHeight != originalHeight) {
                        const top = currentBounds[0];
                        const left = currentBounds[1];
                        this.refSelected.item.geometricBounds = [
                            top,
                            left,
                            top + originalHeight,
                            left + originalWidth
                        ];
                    }
                }
            }
        }

        this.refSelected = null;
        this.schedeRefDati = null;
    },

    /// I20-968: elenco di tutti gli elementi del box, ciascuno con il suo interruttore di
    /// rendering. Sostituisce la checkbox NR che stava nella scheda primarie/secondarie.
    apriModalNoRender() {
        let me = this;
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length < 1 || this.refSelected == null) {
            messaggioUtente("Code SRF-50 Nessun box selezionato per l'opzione di rendering", "error");
            return;
        }

        var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
        if (primario == null) {
            messaggioUtente("Code SRF-51 Nessun elemento primario trovato", "error");
            return;
        }

        try {
            this.elementiNoRenderDelBox = this.leggiElementiDelBox(this.refSelected.item, primario);
            this.statoFotoAllApertura = NoRenderElementi.statoDelleFoto(this.elementiNoRenderDelBox);
            //apriModal clona il dialog dentro bodyModal: la lista va disegnata dopo l'apertura,
            //cosi' si scrive nel clone e i gestori dei bottoni restano vivi.
            Utility.apriModal('dialogNoRender', 'Elementi non renderizzati', true, [], true);
            this.disegnaListaNoRender();
        }
        catch (e) {
            //Un modal vuoto non dice niente a chi lo guarda: meglio un errore leggibile.
            console.error("Errore nell'apertura del modal noRender", e);
            messaggioUtente("Code SRF-54 noRender: impossibile leggere gli elementi del box: " + e, "error");
        }
    },

    /// Compone la lista mostrata dal modal: gli elementi vivi nel box uniti a quelli che i meta
    /// danno per messi in noRender ma che dal documento sono spariti.
    leggiElementiDelBox(box, primario) {
        var nomePrimaria = pluginMiddleware.getCampo("nomeFotoPrimaria");
        var nomeSecondaria = pluginMiddleware.getCampo("nomeFotoSecondaria");
        //Gli extra del box stanno in due collezioni: quella dell'operatore e quella
        //piazzata dall'automatismo. Cercarne una sola lascia gli extra automatici senza
        //nome, senza sigla e senza guid, quindi senza miniatura.
        var fotoExtra = primario.recordInTracciato["Foto.Extra"] || [];
        var fotoExtraAuto = primario.recordInTracciato["Foto.ExtraAuto"] || [];
        var membriGruppoFoto = primario.recordInTracciato.membriGruppoFoto || [];
        var vivi = [];

        try {
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                //La label si classifica grezza: Utility.parseLabel troncherebbe al primo $
                //e un simbolo finirebbe fra i campi.
                var classificato = NoRenderElementi.classificaLabel(item.label, nomePrimaria, nomeSecondaria);
                if (classificato == null || classificato.chiave === "") {
                    continue;
                }

                var nome = classificato.chiave;
                var guidId = "";
                var marcatoNelDocumento = false;

                if (classificato.tipo === NoRenderElementi.TIPO_FOTO) {
                    //Per le immagini il campo da mostrare e' il nome della foto.
                    var membro = membriGruppoFoto.find(m => m.codRef == classificato.chiave);
                    if (membro != null && membro.nomeFoto) {
                        nome = membro.nomeFoto;
                    }
                    guidId = this.guidFotoDiRef(classificato.chiave);
                    marcatoNelDocumento = membro != null && membro.noRender === true;
                }
                else if (classificato.tipo === NoRenderElementi.TIPO.logo || classificato.tipo === NoRenderElementi.TIPO.fotoExtra) {
                    //Per i loghi il campo da mostrare e' nome e sigla.
                    var extra = NoRenderElementi.datiExtraDiSigla(classificato.chiave, fotoExtra, fotoExtraAuto);
                    if (extra != null) {
                        nome = extra.nome ? extra.nome : nome;
                        guidId = extra.guidId;
                    }
                }

                vivi.push({ tipo: classificato.tipo, chiave: classificato.chiave, nome: nome, guidId: guidId, noRender: marcatoNelDocumento });
            }
        }
        catch (e) {
            console.error("Impossibile leggere gli elementi del box per il modal noRender", e);
        }

        var marcatiNeiMeta = primario.recordInTracciato.noRenderElementi || [];
        var lista = NoRenderElementi.componiLista(vivi, marcatiNeiMeta);

        //Gli elementi marcati e poi cancellati dal documento non portano il guid nei meta:
        //lo recuperiamo dai dati della ref, cosi' mostrano comunque la loro miniatura.
        for (var e = 0; e < lista.length; e++) {
            if (lista[e].guidId) {
                continue;
            }
            if (lista[e].tipo === NoRenderElementi.TIPO_FOTO) {
                lista[e].guidId = this.guidFotoDiRef(lista[e].chiave);
            }
            else {
                var extraMarcato = NoRenderElementi.datiExtraDiSigla(lista[e].chiave, fotoExtra, fotoExtraAuto);
                if (extraMarcato != null) {
                    lista[e].guidId = extraMarcato.guidId;
                    lista[e].nome = lista[e].nome ? lista[e].nome : extraMarcato.nome;
                }
            }
        }

        //Gli elementi gia' nascosti stanno in cima. L'ordine si fissa qui, che e' il momento
        //dell'apertura: ridisegnando la lista dopo un click l'ordine non cambia piu'.
        return NoRenderElementi.conNascostiInCima(lista);
    },

    /// Guid della foto di una ref del box, per la miniatura del modal noRender.
    guidFotoDiRef(codRef) {
        var schedaRef = this.schedeRefDati || [];
        var voce = schedaRef.find(f => f.recordInTracciato["Referenza.Codice"] == codRef);
        return voce != null && voce.recordInTracciato["Foto.guidid"] ? voce.recordInTracciato["Foto.guidid"] : "";
    },

    disegnaListaNoRender() {
        let me = this;
        var lista = this.elementiNoRenderDelBox || [];
        $("#bodyNoRender").empty();

        //Riquadro dell'ingrandimento, stesso schema del modal di conferma foto: sta sopra
        //a tutto, non intercetta il mouse e mostra la miniatura grande della riga puntata.
        var anteprima = $('<div class="norender-anteprima" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#fff; border:1px solid #999; padding:10px; z-index:99999; box-shadow:0 2px 10px rgba(0,0,0,0.35); pointer-events:none;"><img src="" style="max-width:300px; max-height:300px; display:block;"></div>');
        $("#bodyNoRender").append(anteprima);

        //Il modal ha il fondo bianco: qui non si forza il colore del testo, come fanno
        //gli altri modal. Il bianco delle schede vale nei tab scuri del pannello, non qui.
        if (lista.length == 0) {
            console.log("Modal noRender: nessun elemento trovato nel box selezionato");
            $("#bodyNoRender").append($('<span style="font-size:12px;">Nessun elemento nel box.</span>'));
            return;
        }

        //Quanti elementi sono nascosti, senza doverli contare a occhio nell'elenco.
        $("#bodyNoRender").append(
            $('<div style="font-size:12px; font-weight:600; margin-bottom:10px;"></div>').text(NoRenderElementi.riepilogo(lista)));

        for (var i = 0; i < lista.length; i++) {
            var elemento = lista[i];
            var indirizzoOlimpo = typeof olimpoIp !== "undefined" ? olimpoIp : "";
            var datiRiga = NoRenderElementi.datiRiga(elemento, indirizzoOlimpo);

            var row = $('<div class="row align-items-center" style="margin-bottom:8px; display:flex; align-items:center; padding:4px 6px; border-radius:4px;"></div>');
            //La riga nascosta si distingue a colpo d'occhio: fondo, bordo e nome barrato.
            if (datiRiga.noRender) {
                row.css({ "background-color": "#ececec", "border-left": "3px solid #b00" });
            }

            var bottone = $('<button class="norender-toggle" indice="' + i + '" style="min-width:74px; height:26px; margin-right:8px; border:1px solid #999; border-radius:4px; cursor:pointer; font-size:11px;"></button>');
            //Il bottone dice cosa fa, non come sta: e' l'azione che l'operatore sta per compiere.
            bottone.text(datiRiga.testoBottone);
            bottone.css("background-color", datiRiga.noRender ? "#d8d8d8" : "#f2f2f2");
            bottone.attr("title", datiRiga.noRender ? "Elemento non renderizzato: clicca per farlo tornare visibile" : "Impagina l'elemento ma non renderizzarlo");
            bottone.on('click', function () {
                var indice = parseInt($(this).attr("indice"), 10);
                me.elementiNoRenderDelBox[indice].noRender = !me.elementiNoRenderDelBox[indice].noRender;
                me.disegnaListaNoRender();
            });

            row.append(bottone);

            if (datiRiga.urlMiniatura !== "") {
                //La cornice rende visibile anche una miniatura che non si carica: cosi' si
                //distingue un'immagine assente da una riga senza immagine.
                var miniatura = $('<img src="' + datiRiga.urlMiniatura + '" urlIngrandita="' + datiRiga.urlIngrandita + '" style="width:32px; height:32px; object-fit:contain; margin-right:8px; border:1px solid #ddd; background-color:#fafafa; cursor:zoom-in;">');
                //Attenuata quando l'elemento e' nascosto: e' cosi' che apparira' nel documento.
                miniatura.css("opacity", datiRiga.noRender ? "0.4" : "1");

                //L'indirizzo dell'ingrandimento sta sull'immagine e si legge da li', come
                //l'indice sul bottone: una variabile del ciclo sarebbe condivisa da tutte le
                //righe e mostrerebbe sempre l'ultima immagine.
                miniatura.on('mouseenter', function () {
                    anteprima.find("img").attr("src", $(this).attr("urlIngrandita"));
                    anteprima.css("display", "block");
                });
                miniatura.on('mouseleave', function () {
                    anteprima.css("display", "none");
                    anteprima.find("img").attr("src", "");
                });

                row.append(miniatura);
            }
            else {
                //Campi ed etichette non hanno una miniatura: lo spazio resta per tenere allineate le righe.
                row.append($('<span style="display:inline-block; width:32px; margin-right:8px;"></span>'));
            }

            var testo = $('<span style="font-size:12px;"></span>').text(datiRiga.descrizione);
            if (datiRiga.barrato) {
                testo.css({ "text-decoration": "line-through", "color": "#666" });
            }
            row.append(testo);

            if (datiRiga.etichettaStato !== "") {
                row.append($('<span style="font-size:10px; font-weight:600; color:#b00; margin-left:8px; border:1px solid #b00; border-radius:3px; padding:1px 4px;"></span>')
                    .text(datiRiga.etichettaStato));
            }

            if (!elemento.presente) {
                //Elemento marcato ma non piu' nel documento: resta in elenco per poterlo liberare.
                row.append($('<span style="font-size:11px; color:#777; margin-left:6px;">(non presente nel box)</span>'));
            }

            $("#bodyNoRender").append(row);
        }
    },

    /// Salva l'opzione di rendering del box. Gli elementi viaggiano sul nuovo endpoint, le foto
    /// primarie/secondarie restano sul canale P/S di I20-965: sono due dati distinti.
    salvaNoRender() {
        let me = this;
        var schedaRef = this.schedeRefDati;
        if (schedaRef == null || schedaRef.length < 1) {
            return;
        }

        var codice_gruppo = schedaRef[0].recordInTracciato["Scatto.CodiceGruppo"];
        var lista = this.elementiNoRenderDelBox || [];
        //Le foto viaggiano nella stessa struttura degli altri elementi: una sola chiamata,
        //quindi una sola scrittura sul meta e nessuna corsa fra due salvataggi.
        var elementi = NoRenderElementi.elementiDaSalvare(lista);

        var idRec = 0;
        try {
            var dna = Utility.getDnaOfBox(this.refSelected.item);
            if (dna != null && dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec))) {
                idRec = parseInt(dna.idRec);
            }
        }
        catch (e) {
            console.warn("Impossibile recuperare idRec dal box durante il salvataggio noRender", e);
        }

        var formData = new FormData();
        formData.append("idLavorazione", idKitLavorazione);
        formData.append("CodiceGruppo", codice_gruppo);
        formData.append("idRec", idRec);
        formData.append("elementi", JSON.stringify(elementi));

        const xhr = new XMLHttpRequestClient();
        xhr.onload = async (objResult, parsed) => {
            if (!parsed) {
                try {
                    objResult = JSON.parse(objResult);
                }
                catch (e) {
                    messaggioUtente("Code SRF-52 noRender: errore durante il salvataggio: " + e, "error");
                    return;
                }
            }
            if (objResult != null && objResult.esito === false) {
                messaggioUtente("Code SRF-53 noRender: il server ha rifiutato il salvataggio", "error");
                return;
            }
            messaggioUtente("noRender: modifiche salvate", "success", false, 5);
        };

        xhr.send("Menabo/modificaNoRender" + "/" + 0, formData, "PUT");

        this.aggiornaNoRenderNeiRecord(elementi);
        this.applicaNoRenderAlDocumento();
        this.proponiFixFotoSeServe();
    },

    /// I20-978: nascondere o rimettere una foto cambia quante ne restano da mostrare, e la
    /// loro disposizione nel box va rifatta. Si propone, non si esegue d'ufficio: il fix foto
    /// muove gli elementi, e chi sta lavorando deve poter dire di no.
    async proponiFixFotoSeServe() {
        var box = this.refSelected != null ? this.refSelected.item : null;

        if (box == null || !NoRenderElementi.proporreFixFoto(this.statoFotoAllApertura, this.elementiNoRenderDelBox)) {
            return;
        }

        //Quello appena salvato diventa il nuovo punto di partenza: se l'operatore rifiuta e
        //poi risalva senza toccare le foto, non gli si ripropone la stessa cosa.
        this.statoFotoAllApertura = NoRenderElementi.statoDelleFoto(this.elementiNoRenderDelBox);

        try {
            var procedi = await Utility.confirm("Le foto mostrate nel box sono cambiate. Applicare il Fix Foto automatico?");
            if (!procedi) {
                return;
            }

            var obs = CssFramework.getSpazioImpaginazione(box);
            CssFramework.fixFoto(box, obs.candidate, obs.obstacles);
            messaggioUtente("Fix Foto automatico applicato", "success", false, 3);
        }
        catch (ex) {
            console.error(ex);
            messaggioUtente("Code SRF-55 Fix Foto non applicato: " + ex, "error");
        }
    },

    /// Riporta sui record in memoria quanto appena salvato. La reimpaginazione impagina a
    /// partire da schedeRefDati, che non viene ricaricata dal server: senza questo passaggio
    /// un elemento appena messo in noRender tornerebbe visibile alla prima reimpaginazione.
    aggiornaNoRenderNeiRecord(elementi) {
        var schedaRef = this.schedeRefDati || [];

        for (var i = 0; i < schedaRef.length; i++) {
            var record = schedaRef[i].recordInTracciato;
            if (record == null) {
                continue;
            }

            record.noRenderElementi = elementi;

            //membriGruppoFoto resta allineato: lo legge l'impaginazione della foto e lo
            //consuma chi esporta. La fonte ora e' la struttura unica.
            var membri = record.membriGruppoFoto;
            if (membri == null) {
                continue;
            }
            for (var m = 0; m < membri.length; m++) {
                membri[m].noRender = (elementi || []).some(
                    e => e.tipo === NoRenderElementi.TIPO.foto && e.chiave == membri[m].codRef);
            }
        }
    },

    /// Riflette subito nel documento quanto scelto nel modal, senza attendere una reimpaginazione.
    applicaNoRenderAlDocumento() {
        var box = this.refSelected != null ? this.refSelected.item : null;
        var lista = this.elementiNoRenderDelBox || [];
        if (box == null) {
            return;
        }

        var nomePrimaria = pluginMiddleware.getCampo("nomeFotoPrimaria");
        var nomeSecondaria = pluginMiddleware.getCampo("nomeFotoSecondaria");

        try {
            for (var i = 0; i < box.allPageItems.length; i++) {
                var item = box.allPageItems[i];
                var classificato = NoRenderElementi.classificaLabel(item.label, nomePrimaria, nomeSecondaria);
                if (classificato == null) {
                    continue;
                }
                var scelta = lista.find(e => e.tipo === classificato.tipo && e.chiave === classificato.chiave);
                if (scelta != null) {
                    FotoPlacer.applicaNoRender(item, scelta.noRender === true);
                }
            }
        }
        catch (e) {
            console.error("Impossibile applicare l'opzione di rendering agli elementi del box", e);
        }
    },
    apriModalInfoReferenza() {
        var schedaRef = this.schedeRefDati;
        if (schedaRef != null && schedaRef.length > 0) {
            var primario = schedaRef.find(f => f.recordInTracciato.StatoSelezione == 1);
            if (primario != null) {
                this.preparaInfoIspezioneDelDato(primario.recordInTracciato, primario);
            }
        }

        Utility.apriModal('dialogLeggiInfoRef', 'Info dati referenza', true, [], true);
        this.visibilitaCampiIspezioneDelDato(true);
    },

    apriModalIspezioneDelDato(recordInTracciato, titolo = "Info dati referenza", datoDaScaricare = null) {
        this.preparaInfoIspezioneDelDato(recordInTracciato, datoDaScaricare);
        Utility.apriModal('dialogLeggiInfoRef', titolo, true, [], true);
        this.visibilitaCampiIspezioneDelDato(true);
    },

    preparaInfoIspezioneDelDato(recordInTracciato, datoDaScaricare = null) {
        if (recordInTracciato == null) {
            $("#infoPerLeggiInfoRef").data("infoRapide", "");
            $("#infoPerLeggiInfoRef").data("infoComplete", "");
            $("#infoPerLeggiInfoRef").removeData("datoDaScaricare");
            return;
        }

        //mettiamo il codicebox nel tooltip
        var infoListObjects = [];
        infoListObjects.push({
            label: "Codice Box",
            value: recordInTracciato.codiceBox
        });

        //mettiamo combinazione assegnata se non è null nel tooltip
        if (recordInTracciato.combinazioneAssegnata != null && recordInTracciato.combinazioneAssegnata != "") {
            infoListObjects.push({
                label: "Combinazione Assegnata",
                value: recordInTracciato.combinazioneAssegnata
            })
        }

        infoListObjects.push({
            label: "Versione Tracciato",
            value: recordInTracciato["Tracciato.Versione"]
        });

        infoListObjects.push({
            label: "Nome Xlsx",
            value: recordInTracciato["Tracciato.Xlsx"]
        });

        if (pluginMiddleware.aggiungiInfoRapidaVisioneDelDato != null) {
            let customInfo = pluginMiddleware.aggiungiInfoRapidaVisioneDelDato(recordInTracciato);
            if (customInfo != null && Array.isArray(customInfo)) {
                infoListObjects = infoListObjects.concat(customInfo);
            }
        }

        var content = this.creaTestoInfo(infoListObjects);
        $("#infoPerLeggiInfoRef").data("infoRapide", content);

        //adesso creiamo le info complete che sono composte da tutte le proprietà di recordInTracciato
        var infoCompleteListObjects = Object.keys(recordInTracciato)
            .sort((a, b) => a.localeCompare(b))
            .map(key => ({
                label: key,
                value: recordInTracciato[key]
            }));

        var contentComplete = this.creaTestoInfo(infoCompleteListObjects);
        //Utility.impostaValHiddenVal($("#dialogLeggiInfoRef"), "infoComplete", contentComplete);
        $("#infoPerLeggiInfoRef").data("infoComplete", contentComplete);
        $("#infoPerLeggiInfoRef").data("datoDaScaricare", datoDaScaricare != null ? datoDaScaricare : recordInTracciato);

        this.bindCopyOnTooltipTextOnce();
    },

    visibilitaCampiIspezioneDelDato(informazioniRapide = true) {
        //leggiamo da #dialogLeggiInfoRef il val di infoRapide e infoComplete
        var infoRapide = $("#infoPerLeggiInfoRef").data("infoRapide");
        var infoComplete = $("#infoPerLeggiInfoRef").data("infoComplete");

        //compiliamo bodyIspezionaDatiRef con il valore trovato che è già un testo formattato in html
        var html = informazioniRapide ? infoRapide : infoComplete;

        var $container = $("#bodyIspezionaDatiRef");
        $container.empty();

        // Inserisco barra di ricerca (filtra per chiave e valore)
        var $searchWrap = $("<div style='margin-bottom:8px; display:flex; gap:8px; align-items:center;'></div>");
        $searchWrap.append("<input id='ispezionaSearch' placeholder='Cerca chiave/valore...' style='flex:1;padding:6px;border-radius:4px;background:#222;color:white;border:1px solid #444;'>");
        $searchWrap.append("<sp-action-button id='ispezionaClear' style='color:lightgreen'>Cancella</sp-action-button>");
        $container.append($searchWrap);

        var $contentWrap = $("<div id='ispezionaContent'></div>");

        // Parsing robusto: se l'HTML contiene elementi top-level li utilizziamo quelli come righe,
        // altrimenti splittiamo per <br> o newline per ottenere righe separabili.
        var $parsed = $('<div>').html(html || "");

        if ($parsed.children().length === 0) {
            // fallback: split su <br> o newline
            var parts = (html || "").split(/<br\s*\/?>|\n/);
            parts.forEach(function (p) {
                if (p == null) return;
                var line = p.toString().trim();
                if (line === "") return;
                var $row = $("<div class='ispezione-row' style='padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);'></div>").html(line);
                $contentWrap.append($row);
            });
        } else {
            $parsed.children().each(function () {
                var $el = $(this);
                $el.addClass('ispezione-row');
                $contentWrap.append($el);
            });
        }

        $container.append($contentWrap);

        // Evento di filtro: ricerca sia in chiave sia in valore (testo dell'elemento)
        $(document).off('input', '#ispezionaSearch').on('input', '#ispezionaSearch', function () {
            var term = $(this).val().toLowerCase().trim();
            if (term === "") {
                $contentWrap.find('.ispezione-row').show();
                return;
            }
            $contentWrap.find('.ispezione-row').each(function () {
                var txt = $(this).text().toLowerCase();
                if (txt.indexOf(term) !== -1) $(this).show(); else $(this).hide();
            });
        });

        $(document).off('click', '#ispezionaClear').on('click', '#ispezionaClear', function () {
            $('#ispezionaSearch').val('');
            $('#ispezionaSearch').trigger('input');
        });

        //se informazioniRapide è true vediMenoInspezioneDelDato viene nascosto e viene mostrato vediTuttoInspezioneDelDato e viceversa
        if (informazioniRapide) {
            $("#vediMenoInspezioneDelDato").hide();
            $("#vediTuttoInspezioneDelDato").show();
        } else {
            $("#vediMenoInspezioneDelDato").show();
            $("#vediTuttoInspezioneDelDato").hide();
        }
    }
}

module.exports = schedaRef;
