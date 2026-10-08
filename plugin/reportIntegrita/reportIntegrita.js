/// I20-1014: il Report Integrita' - il confronto fra quello che c'e' nel documento InDesign e
/// quello che dice il server, e tutto quello che l'operatore ci fa sopra.
///
/// Il concetto sta in questa cartella:
///   reportIntegrita.js   questo: il flusso. Avvio, sync col server, file del report e della
///                        whitelist, azioni sulle segnalazioni, la scheda aperta dal report, il
///                        csv, le liste da confrontare, l'impaginazione dei nuovi
///   pannelli.js          l'interfaccia: i pannelli, le righe, lo scorrimento, la dissolvenza
///   avvio.js             le soglie e le decisioni: quando parte, quando smette di valere   puro
///   sezioneConfronti.js  la sezione Confronti: cosa e' cambiato nei campi osservati        puro
///   csv.js               il csv: nome del file, ordine delle righe, virgolettatura        puro
///   conteggi.js          i numeri sulle linguette                                         puro
///
/// Flusso e pannelli sono un oggetto solo: pannelli.js si mescola qui sotto con Object.assign,
/// quindi a runtime c'e' un solo this, come quando stavano insieme in confronti.js. La
/// divisione e' di file, non di stato.
///
/// Prima era sparso su otto file: confronti.js, indexNew.js (avviaReportIntegrita,
/// applicaConfronto e le funzioni che usavano solo loro), events.js (la regola di chiusura) e i
/// quattro moduli puri in radice. Restano fuori, di proposito:
///   - il motore di confronto, in plugin/confronti.js: lo usano anche altri;
///   - datiPrimarioPerConfronto, in indexNew.js: la usa anche la reimpaginazione;
///   - i membri di schedaRef che dicono come si comporta la scheda aperta dal report
///     (apertaDalReport, DAL_REPORT_VOCI_*...): sono stato della scheda, il report li imposta.
///
/// indexNew.js dichiara ReportIntegrita; events.js e index.html lo usano da li'. Usa come
/// globali quelle di indexNew (idKitLavorazione, pathLavorazione, messaggioUtente, showLoading,
/// scaricaContenutoKitAsync, datiPrimarioPerConfronto, ...), come faceva confronti.js.

const confronti = require('../confronti');
const XMLHttpRequestClient = require('../XMLHttpRequestClient');
const { app, PDFExportOptions, CompressionQuality } = require('indesign');
const fs = require('fs');
const NoRenderElementi = require('../noRenderElementi');
const reportIntegritaAvvio = require('./avvio');
const reportConfrontoCsv = require('./csv');
const reportConteggi = require('./conteggi');
const reportConfronti = require('./sezioneConfronti');
//I20-1036: le statistiche della cache degli hash, scritte nel log a fine confronto. Fino a I20-1015
//cacheHashFoto era una globale di indexNew; da li' e' uscita insieme a reperimentoFoto, e senza
//questo require il confronto finiva in un ReferenceError (IDX-41) proprio prima di mostrare il
//report. E' lo stesso file di reperimentoFoto.js, quindi lo stesso oggetto e gli stessi contatori.
const cacheHashFoto = require('../reperimentoFoto/cacheHash');

const ReportIntegrita = {
    /// Cerca le referenze finite su una pagina diversa da quella prevista.
    async preAnalisiMismatchNumeriPagina(rangePagine, mappa) {

        //se rangePagine è null allora rangePagine diventa tutte le pagine del documento
        if (rangePagine == null || rangePagine == "") {
            rangePagine = "";
            for (let i = 0; i < docInLavorazione.pages.length; i++) {
                let pagina = docInLavorazione.pages.item(i);
                if (i == 0) {
                    rangePagine += pagina.name;
                }
                else {
                    rangePagine += "," + pagina.name;
                }
            }
        }

        if (mappa == null) {
            mappa = await confronti.mappaturaImpaginato(rangePagine, false, true);
        }
        //il server si aspetta una lista di {
        //  string nomePagina: "1",
        //  List<string>: codici: []
        //}
        //leggiamo la mappa e per ogni pagina creiamo l'oggetto con nomePagina e codici (leggendo i codiciGruppo)
        var lista = confronti.semplificazioneMappaImpaginato(mappa);

        var formData = new FormData();
        formData.append("lista", JSON.stringify(lista));

        var res = null;
        var annullata = false;

        xhrInProcess = new XMLHttpRequestClient();
        xhrInProcess.descrizione = "Confronto preliminare del Report Integrita'";
        xhrInProcess.onload = (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        console.error("preAnalisiMismatchNumeriPagina: Errore durante il parsing della risposta JSON: " + e, "error");
                        messaggioUtente("Code CNF-005: Errore durante il parsing della risposta di preanalisi Mismatch numerica: " + e, "error");
                        inProcess = false;
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    if(objResult.errors && objResult.errors.length > 0){
                    messaggioUtente("Code CNF-006: Errore durante la preanalisi Mismatch numerica: " + objResult.errors.join(", "), "error");
                    }
                    else{
                        messaggioUtente("Code CNF-006.5: Errore indefinito durante la preanalisi Mismatch numerica", "error");
                    }
                    res = objResult;
                    return;
                }
                res = objResult;
            }
            catch (e) {
                messaggioUtente("Code CNF-007: Errore durante la preanalisi Mismatch numerica: " + e, "error");
            }
        };


        xhrInProcess.onreadystatechange = function () {
            if (xhrInProcess.readyState == 4) {
                if (xhrInProcess.status == 200) {
                } else {
                }
            }
        };

        xhrInProcess.onerror = function () {
            messaggioUtente("Code CNF-008: Errore di connessione al server durante la preanalisi", "error");
        }

        //I20-1004: annullata, non arrivera' piu' niente. Il messaggio l'ha gia' dato abort.
        xhrInProcess.onabort = function () {
            annullata = true;
        }

        xhrInProcess.send("Menabo/PreAnalisiMismatch/"+idKitLavorazione, formData, "PUT");

        var securityCounter = 0;
        while (res == null && !annullata) {
            if (securityCounter > 600) {
                messaggioUtente("Code CNF-009: Timeout durante la preanalisi", "error");
                hideLoading();
                break;
            }else{
                securityCounter++;
                await Utility.sleep(100);
            }
        }

        return res;
    },

    /// Confronta la mappa dell'impaginato coi dati del server e puo'
    /// restituire i record da reimpaginare, pagina per pagina.
    async syncImpaginatoConServer(mappa = null, preAnalisi, applicaImpaginazioni = false){

        var lista = null;
        if (mappa != null){
            lista = confronti.semplificazioneMappaImpaginato(mappa);
        }


        var formData = new FormData();
        formData.append("preAnalisi", JSON.stringify(preAnalisi.resultPaginas));
        if (lista != null) {
            formData.append("mappa", JSON.stringify(lista));
        }

        var stato = null;
        var annullata = false;

        xhrInProcess = new XMLHttpRequestClient();
        xhrInProcess.descrizione = "Allineamento del Report Integrita' con il server";
        xhrInProcess.onload = async (objResult, parsed) => {
            try {
                if (!parsed) {
                    try {
                        objResult = JSON.parse(objResult);
                    }
                    catch (e) {
                        console.error("syncImpaginatoConServer: Errore durante il parsing della risposta JSON: " + e, "error");
                        messaggioUtente("Code CNF-011: Errore durante il parsing della risposta JSON: " + e, "error");
                        inProcess = false;
                        stato = "Fallita";
                        return;
                    }
                }
                console.log(objResult);
                //mi dovrebbe tornare un oggetto con due parametri, esito, error
                if (!objResult.esito) {
                    messaggioUtente("Code CNF-010: Errore durante la sincronizzazione dell'impaginato: " + objResult.error, "error");
                    stato = "Fallita";
                    return;
                }

                stato = "InProgress";
                //per objresult.recordsPerPagina, che è una lista di oggetti con nomePagina e List<List<record>> records
                //chiamiamo la funzione impaginazioneSingoloIndd(records, nomePagina) per ogni pagina
                if (objResult.recordsPerPagina && objResult.recordsPerPagina.length > 0) {
                    for (let i = 0; i < objResult.recordsPerPagina.length; i++) {
                        let paginaObj = objResult.recordsPerPagina[i];
                        if (paginaObj.records && paginaObj.records.length > 0) {
                            for (let j = 0; j < paginaObj.records.length; j++) {
                                let gruppoRecords = paginaObj.records[j];
                                var box = await impaginazioneSingoloIndd(gruppoRecords, paginaObj.nomePagina, applicaImpaginazioni, undefined, false, null, false, false);//I20-1056: niente schermata a ogni box

                                if (box == null) {
                                    messaggioUtente("Code CNF-012: Errore durante l'impaginazione della pagina " + paginaObj.nomePagina, "error");
                                }
                            }
                        }
                    }
                }

                stato = "Completed";

            }
            catch (e) {
                console.error(e);
                messaggioUtente("Code CNF-013: Errore generico durante la sincronizzazione dell'impaginato: " + e, "error");
                //Prima lo stato restava "InProgress" e l'attesa sotto non finiva.
                stato = "Fallita";
            }
        };


        xhrInProcess.onreadystatechange = function () {
            if (xhrInProcess.readyState == 4) {
                if (xhrInProcess.status == 200) {
                } else {
                }
            }
        };

        xhrInProcess.onerror = function () {
            messaggioUtente("Code CNF-014: Errore di connessione al server durante la sincronizzazione dell'impaginato", "error");
            stato = "Fallita";
        }

        //I20-1004: annullata, non arrivera' piu' niente. Il messaggio l'ha gia' dato abort.
        xhrInProcess.onabort = function () {
            annullata = true;
        }

        xhrInProcess.send("Menabo/syncImpaginatoConServer/"+idKitLavorazione+"/"+applicaImpaginazioni, formData, "PUT");

        var securityCounter = 0;
        while (stato == null && !annullata) {
            if (securityCounter > 100) {
                messaggioUtente("Code CNF-015: Timeout durante la sincronizzazione dell'impaginato", "error");
                break;
            }
            securityCounter++;
            await Utility.sleep(100);
        }

        //I20-1004: sotto, qualunque cosa succeda, lo stato diventa "Completed". Una sync
        //annullata non e' completata: il chiamante deve fermarsi.
        if (annullata) {
            return null;
        }

        while (stato == "InProgress") {
            await Utility.sleep(100);
        }

        //I20-1040: "Fallita" se il server ha rifiutato o la risposta non si e' letta, cosi'
        //chi deve fermarsi lo sa (lo svuotamento). Il Report Integrita' controlla solo null e
        //prosegue come prima, ma senza piu' aspettare il timeout.
        if (stato === "Fallita") {
            return stato;
        }

        stato = "Completed";

        return stato;
    },

    /// I20-1040: prima di svuotare delle pagine, le referenze su cui l'operatore deve decidere.
    ///
    /// resultPaginas e' la pre-analisi (Menabo/PreAnalisiMismatch) delle sole pagine da svuotare;
    /// listaDocumento la mappa di tutto il documento ridotta da semplificazioneMappaImpaginato,
    /// o null se non serve; pagineDaSvuotare i nomi delle pagine.
    ///
    ///   spostate       il server le ha in una pagina da svuotare, ma nel documento stanno in
    ///                  un'altra pagina, che non si svuota: { codice, idRec, paginaServer,
    ///                  paginaDocumento }. Senza intervento lo svuotamento ne cancellerebbe il
    ///                  record, e resterebbero in pagina come non impaginate.
    ///   nonRegistrate  stanno in una pagina da svuotare ma il server non le ha impaginate:
    ///                  { codice, idRec, pagina }.
    ///   registrateAltrove  stanno in una pagina da svuotare ma il server le ha impaginate su
    ///                  un'altra pagina, perche' l'operatore le ha portate li': { codice, idRec,
    ///                  pagina }. Svuotando senza chiedere sparivano dal documento e dal server.
    ///
    /// Le referenze che il server ha ma che nel documento non ci sono piu' da nessuna parte non
    /// entrano: sono state tolte a mano, e il loro record si cancella con lo svuotamento.
    classificaPerSvuotamento(resultPaginas, listaDocumento, pagineDaSvuotare) {
        const daSvuotare = (Array.isArray(pagineDaSvuotare) ? pagineDaSvuotare : []).map(p => String(p));
        const pagineDocumento = listaDocumento != null && Array.isArray(listaDocumento.listRefPerPagina)
            ? listaDocumento.listRefPerPagina
            : [];
        const spostate = [];
        const nonRegistrate = [];
        const registrateAltrove = [];

        (Array.isArray(resultPaginas) ? resultPaginas : []).forEach(pagina => {
            if (pagina == null) {
                return;
            }
            const nomePagina = String(pagina.nomePagina);

            ReportIntegrita._codiciConId(pagina.codiciPresentiSoloSulServerConId, pagina.codiciPresentiSoloSulServer).forEach(codice => {
                const dove = pagineDocumento.find(p => p != null
                    && daSvuotare.indexOf(String(p.nomePagina)) < 0
                    && ReportIntegrita._codiciConId(p.codiciConId, p.codici).some(c => ReportIntegrita._stessaReferenza(c, codice)));
                if (dove != null) {
                    spostate.push({ codice: codice.codice, idRec: codice.idRec, paginaServer: nomePagina, paginaDocumento: String(dove.nomePagina) });
                }
            });

            ReportIntegrita._codiciConId(pagina.codiciNonImpaginatiSulServerConId, pagina.codiciNonImpaginatiSulServer).forEach(codice => {
                nonRegistrate.push({ codice: codice.codice, idRec: codice.idRec, pagina: nomePagina });
            });

            ReportIntegrita._codiciConId(pagina.codiciImpaginatiAPaginaDifferenteConId, pagina.codiciImpaginatiAPaginaDifferente).forEach(codice => {
                registrateAltrove.push({ codice: codice.codice, idRec: codice.idRec, pagina: nomePagina });
            });
        });

        return { spostate: spostate, nonRegistrate: nonRegistrate, registrateAltrove: registrateAltrove };
    },

    /// I20-1040: la pre-analisi senza le referenze indicate fra le "impaginate a pagina
    /// differente". Sono quelle che l'operatore mantiene nella pagina che svuota: portarle a quella
    /// pagina prima dello svuotamento vorrebbe dire farle cancellare da Menabo/SvuotaPagina. Si
    /// portano dopo. Restituisce una copia, la pre-analisi ricevuta non cambia.
    preAnalisiSenza(resultPaginas, referenze) {
        const daTogliere = Array.isArray(referenze) ? referenze : [];
        const resta = (codice) => !daTogliere.some(r => ReportIntegrita._stessaReferenza(r, codice));
        return (Array.isArray(resultPaginas) ? resultPaginas : []).map(pagina => {
            if (pagina == null) {
                return pagina;
            }
            const copia = Object.assign({}, pagina);
            copia.codiciImpaginatiAPaginaDifferenteConId = ReportIntegrita._codiciConId(pagina.codiciImpaginatiAPaginaDifferenteConId, null).filter(resta);
            copia.codiciImpaginatiAPaginaDifferente = (Array.isArray(pagina.codiciImpaginatiAPaginaDifferente) ? pagina.codiciImpaginatiAPaginaDifferente : [])
                .filter(c => resta({ codice: String(c), idRec: 0 }) || copia.codiciImpaginatiAPaginaDifferenteConId.some(k => k.codice === String(c)));
            return copia;
        });
    },

    /// Una lista di codici della pre-analisi come { codice, idRec }: quella con l'idRec se c'e',
    /// altrimenti quella di soli codici, con idRec 0. Come NormalizzaListaConFallback del server.
    _codiciConId(listaConId, listaCodici) {
        const conId = (Array.isArray(listaConId) ? listaConId : [])
            .filter(c => c != null && c.codice != null && String(c.codice) !== "")
            .map(c => ({ codice: String(c.codice), idRec: !isNaN(parseInt(c.idRec)) ? parseInt(c.idRec) : 0 }));
        if (conId.length > 0) {
            return conId;
        }
        return (Array.isArray(listaCodici) ? listaCodici : [])
            .filter(c => c != null && String(c) !== "")
            .map(c => ({ codice: String(c), idRec: 0 }));
    },

    /// Due codici sono la stessa referenza se il codice e' uguale e, quando entrambi hanno
    /// l'idRec, anche quello: lo stesso codice puo' stare in due record del tracciato.
    _stessaReferenza(a, b) {
        if (a == null || b == null || String(a.codice).toLowerCase() !== String(b.codice).toLowerCase()) {
            return false;
        }
        return !(a.idRec > 0 && b.idRec > 0) || a.idRec === b.idRec;
    },

    percorsoFileReport(idKit = null) {
        const kit = idKit != null ? idKit : (typeof idKitLavorazione !== "undefined" ? idKitLavorazione : "kit");
        return pathLavorazione + "/reportIntegrita_" + kit + ".json";
    },

    _getWhitelistIntegritaFilePath(idKit = null) {
        const kit = idKit != null ? idKit : (typeof idKitLavorazione !== "undefined" ? idKitLavorazione : "kit");
        return pathLavorazione + "/whitelistIntegrita_" + kit + ".json";
    },

    _formatReportDate(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (isNaN(date.getTime())) {
            return "";
        }

        const pad = (value) => value < 10 ? "0" + value : String(value);
        return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear()
            + ", " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    },

    _cloneForReportStorage(value) {
        try {
            return JSON.parse(JSON.stringify(value, (key, val) => {
                if (key === "ref" || key === "element" || key === "item") {
                    return null;
                }

                if (typeof val === "function") {
                    return undefined;
                }

                return val;
            }));
        } catch (err) {
            console.error("Errore durante la serializzazione del report integrità:", err);
            return value;
        }
    },

    _normalizeReportIntegritaWrapper(data) {
        if (!data) return null;

        if (data.report) {
            data.report.recordCambiati = data.report.recordCambiati || [];
            data.report.recordUsciti = data.report.recordUsciti || [];
            data.report.recordConErrori = data.report.recordConErrori || [];
            data.report.recordGiusti = data.report.recordGiusti || [];
            data.report.recordNuoviRisolti = data.report.recordNuoviRisolti || [];
            data.uiPrefs = data.uiPrefs || {};
            return data;
        }

        data.recordCambiati = data.recordCambiati || [];
        data.recordUsciti = data.recordUsciti || [];
        data.recordConErrori = data.recordConErrori || [];
        data.recordGiusti = data.recordGiusti || [];
        data.recordNuoviRisolti = data.recordNuoviRisolti || [];

        const createdAt = new Date().toISOString();
        return {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            createdAt,
            createdAtLabel: this._formatReportDate(createdAt),
            report: data,
            uiPrefs: {}
        };
    },

    /// Il report vive in un file JSON nella cartella di lavorazione.
    /// ATTENZIONE: indexNew ricostruisce a mano lo stesso percorso quando
    /// percorsoFileReport non risponde. Il nome del file e' scritto in due posti, ed e'
    /// uno dei motivi per cui il report andrebbe raccolto in un modulo suo.
    leggiReportIntegritaLocale(idKit = null) {
        try {
            const filePath = this.percorsoFileReport(idKit);
            let data = readFile(filePath);
            if (typeof data === "string") {
                data = JSON.parse(data);
            }

            const wrapper = this._normalizeReportIntegritaWrapper(data);
            if (wrapper) {
                wrapper.filePath = filePath;
            }
            return wrapper;
        } catch (err) {
            console.error("Errore lettura report integrità locale:", err);
            return null;
        }
    },

    salvaReportIntegritaLocale(report, options = {}) {
        const createdAt = options.createdAt || new Date().toISOString();
        const wrapper = {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            createdAt,
            createdAtLabel: this._formatReportDate(createdAt),
            report: this._cloneForReportStorage(report || {}),
            uiPrefs: this._cloneForReportStorage(options.uiPrefs || {})
        };

        const filePath = this.percorsoFileReport();
        fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2));
        return wrapper;
    },

    eliminaReportIntegritaLocale(idKit = null) {
        try {
            const filePath = this.percorsoFileReport(idKit);
            fs.unlinkSync(filePath);
        } catch (err) {

        }
    },

    _getEmptyWhitelistIntegrita() {
        return {
            schemaVersion: 1,
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : null,
            recordCambiati: [],
            recordUsciti: []
        };
    },

    leggiWhitelistIntegritaLocale() {
        try {
            const filePath = this._getWhitelistIntegritaFilePath();

            let data = readFile(filePath);
            if(data == null){
                return this._getEmptyWhitelistIntegrita();
            }
            if (typeof data === "string") {
                data = JSON.parse(data);
            }

            data = data || {};
            data.recordCambiati = data.recordCambiati || [];
            data.recordUsciti = data.recordUsciti || [];
            return data;
        } catch (err) {
            return this._getEmptyWhitelistIntegrita();
        }
    },

    salvaWhitelistIntegritaLocale(whitelist) {
        const data = Object.assign(this._getEmptyWhitelistIntegrita(), whitelist || {});
        fs.writeFileSync(this._getWhitelistIntegritaFilePath(), JSON.stringify(this._cloneForReportStorage(data), null, 2));
        return data;
    },

    /// Cosa fare quando un report e' gia' aperto: riusarlo, chiedere
    /// all'operatore o rifarlo. Le soglie orarie stanno in reportIntegritaAvvio.js, che e'
    /// verificabile; qui resta il dialogo con l'operatore.
    async richiediAzioneReportIntegritaEsistente(wrapper) {
        //I20-981: le soglie (oltre quattro ore si rifa' senza chiedere, oltre due la data va
        //in evidenza) stanno in reportIntegritaAvvio, dove si possono verificare.
        const createdAt = wrapper?.createdAt || wrapper?.createdAtLabel;
        const decisione = reportIntegritaAvvio.decidiReportEsistente(createdAt);

        if (!decisione.chiedi) {
            return "new";
        }

        const oldStyle = decisione.vecchio ? "color:#b00020;font-weight:700;" : "color:#111;";
        const message = "Esiste già un report integrità creato in data "
            + "<span style=\"" + oldStyle + "\">" + this._formatReportDate(decisione.data) + "</span>.";

        return await this._confirmTreAzioniReport(message, [
            { value: "open", label: "Riapri", color: "#007bff" },
            { value: "new", label: "Nuovo report", color: "#007bff" },
            { value: "cancel", label: "Annulla", color: "#dc3545" }
        ]);
    },

    //I20-981: il report resta aperto su un documento preciso e tiene isBusy per se'.
    //Chi lo chiude, a mano o perche' il documento e' cambiato, passa da qui: cosi' lo stato,
    //il busy e le finestre restano coerenti.
    _reportIntegritaAperto: false,

    _documentoDelReport: "",

    reportIntegritaAperto() {
        return this._reportIntegritaAperto === true;
    },

    documentoDelReport() {
        return this._documentoDelReport || "";
    },

    chiudiReportIntegrita(motivo = null) {
        if (!this.reportIntegritaAperto()) {
            return false;
        }

        //Il report puo' chiudersi mentre l'operatore sta nella scheda di una sua referenza
        //(succede al cambio di documento): la scheda va smontata, ma senza ricontrollare
        //niente, perche' il report a cui il ricontrollo servirebbe non c'e' piu'.
        if (this._schedaDalReport != null) {
            const schedaAperta = this._schedaDalReport;
            this._schedaDalReport = null;

            if (schedaAperta.timer != null) {
                clearInterval(schedaAperta.timer);
            }

            this._terminaSchedaDalReport();
        }

        this._reportIntegritaAperto = false;
        this._documentoDelReport = "";

        try {
            $("#confrontoInfoOverlay").remove();
            Modali.chiudiModal();
        }
        catch (err) {
            console.error("Errore durante la chiusura del report integrità:", err);
        }

        if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
            indesignEvents.setBusy(false);
        }

        if (motivo != null) {
            messaggioUtente("Report integrità chiuso: " + motivo, "warning", false, 6);
        }

        return true;
    },


    //I20-981 (Lotto 4a): la scheda referenza aperta dal report. Non e' una copia della scheda:
    //e' la scheda vera, mostrata al posto del report. Una copia avrebbe voluto dire duplicare
    //il markup di index.html e i suoi id, cioe' due schede destinate ad allontanarsi; e in
    //ogni caso i modal della scheda (info, noRender, cambia foto) svuotano #bodyModal, che e'
    //dove vive il report: sotto la scheda il report non sopravvivrebbe comunque. Percio' il
    //report si chiude e si riapre dal suo stato, che e' in memoria e su disco.,

    //Ogni quanto si controlla che la scheda sia ancora agganciata al suo box e che la
    //navigazione resti bloccata. La scheda si ridisegna da sola e diversi suoi flussi
    //liberano gli eventi uscendo: il blocco va riaffermato, non solo impostato.
    /// Ogni quanto si controlla se la scheda aperta dal report e' stata
    /// chiusa, per rifare il confronto su quella referenza.
    INTERVALLO_VIGILANZA_SCHEDA: 600,

    //Oltre questo tempo la rilettura della scheda dal server si considera persa: meglio
    //lasciare il report com'era che restare appesi con il caricamento davanti.
    /// Oltre questa attesa si smette di aspettare la rilettura della scheda.
    /// getSchedaRef non ha un modo di essere fermata: la risposta tardiva si lascia cadere, ma
    /// l'operatore non deve restare fermo.
    ATTESA_MASSIMA_RILETTURA_SCHEDA: 20000,

    schedaDalReportAperta() {
        return this._schedaDalReport != null;
    },

    //I20-981: il tracciato di quello che la scheda aperta dal report fa davvero. Il collaudo
    //vede il risultato ma non il percorso, e senza il percorso si tira a indovinare: qui ogni
    //passo lascia una riga in logs/schedaDalReport.log nella cartella di lavorazione, oltre
    //che in console. Non puo' mai fermare il flusso: se non riesce a scrivere, tace.
    FILE_TRACCIATO_SCHEDA: "/logs/schedaDalReport.log",

    _tracciaScheda(evento, dati) {
        try {
            const riga = "[" + new Date().toISOString() + "] " + evento +
                (dati != null ? " | " + JSON.stringify(dati) : "");

            console.log("SchedaDalReport " + riga);

            const percorso = pathLavorazione + this.FILE_TRACCIATO_SCHEDA;
            let contenuto = "";

            try {
                contenuto = fs.readFileSync(percorso, "utf8") || "";
            }
            catch (err) {
                contenuto = "";
            }

            fs.writeFileSync(percorso, contenuto + riga + "\n");
        }
        catch (err) {
            console.error("Tracciato della scheda non scritto:", err);
        }
    },

    _descriviBox(box) {
        try {
            if (box == null) {
                return { presente: false };
            }

            return {
                presente: true,
                valido: box.isValid === true,
                id: box.isValid ? box.id : null,
                pagina: box.isValid && box.parentPage != null ? box.parentPage.name : null
            };
        }
        catch (err) {
            return { presente: true, valido: false, errore: String(err) };
        }
    },

    _descriviRecord(record) {
        try {
            const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
            return {
                codiceGruppo: record?.codiceGruppo || null,
                inddId: record?.inddId ?? null,
                refIdMappa: record?.elementoMappa?.refId ?? null,
                numeroPagina: record?.numeroPagina ?? null,
                duplicato: record?.duplicateInfo != null,
                recordsScheda: Array.isArray(record?.schedaRef?.records) ? record.schedaRef.records.length : null,
                differenze: differenze.map(d => (d?.label || "") + ": " + (d?.difference || "") + (d?.origine ? " [" + d.origine + "]" : "")),
                errori: Array.isArray(record?.preAnalisi?.errors) ? record.preAnalisi.errors : []
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    _descriviDatiConfronto(records) {
        try {
            const dati = typeof datiPrimarioPerConfronto === "function" ? datiPrimarioPerConfronto(records) : null;
            if (dati == null) {
                return { primario: false, records: (records || []).length };
            }

            return {
                primario: true,
                records: (records || []).length,
                sottogruppo: dati.primario?.sottogruppo != null,
                compiledFields: (dati.compiledFields || []).map(c => c?.labelName),
                deletedFields: (dati.deletedFields || []).length,
                listaFoto: (dati.listaFoto || []).map(f => f?.nomeFoto),
                fotoExtra: (dati.fotoExtra || []).length,
                fotoExtraAuto: (dati.fotoExtraAuto || []).length,
                noRender: (dati.tracciatoPrimario?.noRenderElementi || []).length
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    /// Il Trova: prima porta l'operatore sul box, poi gli apre la scheda di quella referenza
    /// al posto del report.
    async _apriSchedaDalReport(payloadId, payload) {
        if (this._schedaDalReport != null) {
            return;
        }

        const box = this._findElemento(payload);
        if (box == null) {
            return;
        }

        const dna = Utility.getDnaOfBox(box);
        if (dna == null) {
            messaggioUtente("Code CNF-70 Il box non ha un dna leggibile: la scheda non si puo' aprire", "error", false, 5);
            return;
        }

        const record = payload?.record?._fullReportRecord || payload?.record;

        this._schedaDalReport = {
            payloadId,
            payload,
            record,
            //Il box lo teniamo noi: la selezione dell'operatore va e viene, e anche la scheda
            //la puo' perdere svuotandosi. Quello che conta e' se questo riferimento e' ancora
            //valido, e quello si chiede al box, non a chi lo ha selezionato.
            box,
            codiceGruppo: dna.codice_gruppo,
            idRec: dna.idRec,
            timer: null,
            riaggancioInCorso: false
        };

        this._tracciaScheda("apertura", {
            payloadId,
            tipo: payload?.tipo || null,
            recordVisibileEraFiltrato: payload?.record?._fullReportRecord != null,
            record: this._descriviRecord(record),
            box: this._descriviBox(box),
            dna: { codice: dna.codice, codiceGruppo: dna.codice_gruppo, idRec: dna.idRec },
            report: this._dimensioniReport()
        });

        //Il report si chiude qui: il suo stato resta in _confrontoReportState e lo si riapre
        //alla X. chiudiModal rimette visibile la schermata principale, che e' dove sta la
        //scheda.
        Modali.chiudiModal();

        $("#refImage").show();
        this._crChiusuraSchedaDalReport();
        this._applicaBloccoSchedaDalReport();

        showLoading("Caricamento scheda REF");
        //La scheda deve sapere da dove arriva: le azioni strutturali della schermata di edit
        //non si offrono a chi e' venuto qui a sistemare una segnalazione.
        schedaRef.apertaDalReport = true;
        schedaRef.setInvalidated(false);
        schedaRef.initSchedaRef(this._refPerSchedaDalReport(box, dna));

        //initSchedaRef libera gli eventi uscendo: da qui in avanti devono restare fermi, e il
        //vigilante li riafferma ad ogni giro.
        this._applicaBloccoSchedaDalReport();
        this._schedaDalReport.timer = setInterval(
            () => this._vigilaSchedaDalReport(), this.INTERVALLO_VIGILANZA_SCHEDA);
    },

    _refPerSchedaDalReport(box, dna) {
        let pagina = -1;
        let paginaRef = null;
        let bounds = null;

        try {
            paginaRef = box.parentPage;
            pagina = paginaRef == null ? -1 : parseInt(paginaRef.name);
            bounds = box.geometricBounds;
        }
        catch (err) {
            console.error("Pagina o dimensioni del box non leggibili:", err);
        }

        return schedaRef.refDalBoxPerReport(box, dna, { pagina, paginaRef, bounds });
    },

    /// La barra resta sulla sola referenza e gli eventi restano fermi. Si riapplica ad ogni
    /// giro perche' la scheda, ridisegnandosi, rimette in piedi quello che le appartiene.
    _applicaBloccoSchedaDalReport() {
        try {
            schedaRef.DAL_REPORT_VOCI_BARRA_NASCOSTE.forEach(id => $("#" + id).hide());
            schedaRef.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE.forEach(
                tab => $(".subTab5").find('img[tab="' + tab + '"]').hide());

            if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
                indesignEvents.setBusy(true);
            }
        }
        catch (err) {
            console.error("Blocco della navigazione non applicato:", err);
        }
    },

    _vigilaSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        this._applicaBloccoSchedaDalReport();

        if (stato.riaggancioInCorso) {
            return;
        }

        if (!schedaRef.serveRiaggancioDalReport(stato.box)) {
            return;
        }

        stato.riaggancioInCorso = true;
        this._riagganciaSchedaDalReport();
    },

    /// Reimpagina e cambi strutturali rifanno il box: con gli eventi fermi nessuno ripunta la
    /// scheda, e allora la ripuntiamo noi, cercando il box nuovo per codice gruppo.
    _riagganciaSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        const box = this._resolveBoxByCodiceGruppo(stato.record);
        const dna = box != null ? Utility.getDnaOfBox(box) : null;

        this._tracciaScheda("riaggancio", {
            boxPrecedente: this._descriviBox(stato.box),
            boxNuovo: this._descriviBox(box),
            dnaLetto: dna != null
        });

        if (box == null || dna == null) {
            messaggioUtente("Code CNF-71 Il box non e' piu' in pagina: la scheda si chiude e il report si aggiorna", "warning", false, 6);
            stato.riaggancioInCorso = false;
            this._chiudiSchedaDalReport();
            return;
        }

        try {
            app.selection = [box];
        }
        catch (err) {
            console.error("Errore selezione del box rifatto:", err);
        }

        //Una scheda morta a meta' resta occupata, e occupata rifiuterebbe di ripartire.
        schedaRef.setBusy(false);
        schedaRef.setInvalidated(false);

        stato.box = box;

        showLoading("Ricarico la scheda sul box rifatto");
        schedaRef.initSchedaRef(this._refPerSchedaDalReport(box, dna));

        stato.riaggancioInCorso = false;
        this._applicaBloccoSchedaDalReport();
    },

    /// La chiusura: si ricontrolla la referenza, perche' l'operatore puo' averne risolto le
    /// segnalazioni standoci dentro, e si torna al report aggiornato.
    async _chiudiSchedaDalReport() {
        const stato = this._schedaDalReport;
        if (stato == null) {
            return;
        }

        //Una volta sola: la X si puo' premere due volte, e il riaggancio puo' arrivarci nello
        //stesso momento.
        this._schedaDalReport = null;
        if (stato.timer != null) {
            clearInterval(stato.timer);
        }

        showLoading("Aggiorno la referenza nel report...");

        this._tracciaScheda("chiusura:inizio", {
            box: this._descriviBox(stato.box),
            record: this._descriviRecord(stato.record),
            report: this._dimensioniReport()
        });

        let piano = null;

        try {
            piano = await this._ricontrollaReferenzaDopoScheda(stato);
        }
        catch (err) {
            console.error("Ricontrollo della referenza non riuscito:", err);
            this._tracciaScheda("chiusura:eccezione", { errore: String(err), stack: err?.stack || null });
            messaggioUtente("Code CNF-72 Ricontrollo della referenza non riuscito: il report resta com'era", "error", false, 6);
        }

        this._terminaSchedaDalReport();
        hideLoading();

        //Il report torna con la referenza ancora al suo posto: quello che il ricontrollo ha
        //trovato risolto lo si vede andare via, non lo si trova gia' sparito.
        this._riapriReportDopoScheda();
        this._tracciaScheda("chiusura:reportRiaperto", { report: this._dimensioniReport(), pianoPresente: piano != null });

        if (piano == null) {
            return;
        }

        this._azioneReportInCorso = true;

        try {
            await this._mostraSegnalazioniRisolte(piano);
            const prima = this._dimensioniReport();
            piano.applica();
            this._tracciaScheda("chiusura:applicato", {
                prima,
                dopo: this._dimensioniReport(),
                record: this._descriviRecord(piano.record)
            });
            this._saveCurrentReportAndWhitelist();
            this._refreshConfrontoReportUi();
            this._tracciaScheda("chiusura:vista", this._descriviRigaDelRecord(piano.record));

            //Il ridisegno riparte dall'alto: la riga, anche restando al suo posto, puo' essere
            //finita fuori dallo schermo, e una riga che non si vede sembra sparita. Se il record
            //e' ancora in un elenco visibile, lo si riporta sotto gli occhi e lo si evidenzia.
            const categoriaFinale = this._categoriaDelRecord(piano.record);
            if (categoriaFinale === "recordCambiati" || categoriaFinale === "recordUsciti") {
                this._evidenziaRigaDelRecord(piano.record);
            }
        }
        catch (err) {
            console.error("Aggiornamento del report dopo la scheda non riuscito:", err);
            this._tracciaScheda("chiusura:eccezioneApplicazione", { errore: String(err), stack: err?.stack || null });
        }
        finally {
            this._azioneReportInCorso = false;
        }
    },

    /// La riga del record dopo che il report si e' ridisegnato: i payload sono altri, quindi
    /// si cerca per record, non per identificativo.
    _payloadIdDelRecord(record) {
        if (record == null || this._confrontoReportStore == null) {
            return null;
        }

        let trovato = null;

        this._confrontoReportStore.forEach((payload, id) => {
            if (trovato != null) {
                return;
            }

            const candidato = payload?.record?._fullReportRecord || payload?.record;
            if (candidato === record || this._sameReportRecord(candidato, record)) {
                trovato = id;
            }
        });

        return trovato;
    },

    _terminaSchedaDalReport() {
        try {
            $("#chiudiSchedaDalReport").remove();
            $("#referenza").css("display", "");
            $("#referenza").css("justify-content", "");

            schedaRef.apertaDalReport = false;
            schedaRef.setInvalidated(true);
            schedaRef.svuotaRef();
            schedaRef.resetRefInterface();

            //L'interfaccia torna come quando non c'e' niente di selezionato: e' lo stato che il
            //plugin conosce gia', non uno nuovo inventato qui.
            $("#homeImage").show();
            $("#menaboTab").show();
            $("#utilityImage").show();
            $("#refImage").hide();
            $("#raggruppaImage").hide();
            $("#grigliaTab").hide();
            schedaRef.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE.forEach(
                tab => $(".subTab5").find('img[tab="' + tab + '"]').show());

            jsIndexControls.changeSubMenu($("#homeImage").attr("subTab"));
            jsIndexControls.changeImage($("#homeImage"));
        }
        catch (err) {
            console.error("Chiusura della scheda dal report non completata:", err);
        }
    },

    _riapriReportDopoScheda() {
        const state = this._confrontoReportState;
        if (state == null) {
            return;
        }

        this._saveCurrentReportAndWhitelist();

        this.compilaReportConfronto(state.report, {
            wrapper: {
                createdAt: state.createdAt,
                createdAtLabel: state.createdAtLabel,
                report: state.report,
                uiPrefs: state.uiPrefs
            },
            skipSave: true,
            activeList: state.activeList,
            activeTab: state.activeTab
        });
    },

    /// Il ricontrollo di una sola referenza alla chiusura della scheda. La scheda si rilegge
    /// dal server e quel dato diventa la verita': sistemando una segnalazione l'operatore
    /// allinea il box al server, e se la lista restasse indietro il report continuerebbe a
    /// giudicare il box con un dato che non e' piu' quello vero. Per questo il record riletto
    /// prende il posto di quello in lista, e la preanalisi si rifa' per intero: dice tutto
    /// quello che c'e', non solo quello che se ne va.
    /// Non applica niente: torna il piano, cosi' chi chiama puo' far vedere le segnalazioni
    /// che se ne stanno andando prima che se ne vadano davvero.
    /// Quando l'operatore chiude la scheda di una referenza aperta dal
    /// report, si rifa' il confronto solo su quella e si aggiorna la riga, invece di rifare
    /// tutto il report. Le regole di cosa resta da segnalare stanno in reportIntegritaAvvio.js.
    async _ricontrollaReferenzaDopoScheda(stato) {
        const state = this._confrontoReportState;
        const record = stato?.record;

        if (state == null || record == null) {
            return null;
        }

        //Nella whitelist le segnalazioni stanno parcheggiate apposta: ricontrollarle da qui
        //vorrebbe dire rimettere in circolo quello che l'operatore ha messo da parte, e per
        //giunta in un elenco, quello del report, dove quel record non sta.
        if (state.activeList === "whitelist") {
            this._tracciaScheda("ricontrollo:saltato", { motivo: "vista whitelist" });
            return null;
        }

        //Il box e' quello che ci siamo tenuti aprendo la scheda, o quello su cui l'abbiamo
        //riagganciata: non lo si chiede alla selezione, che nel frattempo l'operatore puo'
        //aver spostata, ne' alla scheda, che svuotandosi lo perde.
        let box = schedaRef.serveRiaggancioDalReport(stato.box) ? null : stato.box;
        let viaDelBox = box != null ? "memoria" : null;

        if (box == null) {
            //Prima di dire che non c'e' piu' lo si cerca come lo cerca il Trova: per id e poi
            //per codice gruppo. Dichiararlo sparito costa al record l'uscita dal report.
            box = this._resolveBoxFromRecord(record);
            viaDelBox = box != null ? "ricerca" : "nessuno";
        }

        this._tracciaScheda("ricontrollo:box", { via: viaDelBox, box: this._descriviBox(box) });

        if (box == null) {
            //Il box non c'e' piu': la referenza esce dal report e ricompare fra le Nuove, che
            //si calcolano per differenza da chi nel report c'e' gia'.
            return {
                record,
                chiaviRisolte: this._chiaviSegnalazioniDelRecord(record),
                applica: () => this._rimuoviRecordDalReport(record)
            };
        }

        //I20-1056, lotto 5: il numero di segnalazioni si rilegge dal box prima di tutto il resto,
        //cosi' resta giusto anche se il ricontrollo del dato non riesce.
        this._aggiornaSegnalazioniDelRecord(record, box);

        const records = await this._leggiSchedaRefAggiornata(stato.codiceGruppo, stato.idRec);

        this._tracciaScheda("ricontrollo:schedaRiletta", {
            richiesta: { codiceGruppo: stato.codiceGruppo, idRec: stato.idRec },
            dalServer: this._descriviDatiConfronto(records),
            dellaLista: this._descriviDatiConfronto(record?.schedaRef?.records)
        });

        if (records == null || records.length === 0) {
            messaggioUtente("Code CNF-73 Scheda della referenza non riletta: il report resta com'era", "warning", false, 6);
            return null;
        }

        const preAnalisi = await ReportIntegrita.preAnalisiBoxMappato(records, record.elementoMappa, box);

        this._tracciaScheda("ricontrollo:preanalisi", {
            nulla: preAnalisi == null,
            differenze: (preAnalisi?.differenze || []).map(d => (d?.label || "") + ": " + (d?.difference || "")),
            errori: preAnalisi?.errors || []
        });

        if (preAnalisi == null) {
            messaggioUtente("Code CNF-74 Referenza non ricontrollata: il report resta com'era", "warning", false, 6);
            return null;
        }

        preAnalisi.differenze = reportIntegritaAvvio.differenzeDopoRicontrollo(
            preAnalisi.differenze,
            reportIntegritaAvvio.differenzeDiConfronto(record),
            record.duplicateInfo);

        const chiaviPrima = this._chiaviSegnalazioniDelRecord(record);
        const chiaviDopo = new Set(preAnalisi.differenze.map(d => this._getSegnalazioneKey(d)));

        this._diagnosticaRicontrollo(record, records, chiaviPrima, preAnalisi);

        //Il dato riletto puo' non avere niente da confrontare: allora lo zero differenze non
        //dice "a posto", dice "non ho guardato".
        const dati = typeof datiPrimarioPerConfronto === "function"
            ? datiPrimarioPerConfronto(records)
            : null;

        const esito = reportIntegritaAvvio.esitoChiusuraScheda({
            boxPresente: true,
            preAnalisi,
            haDuplicato: record.duplicateInfo != null,
            nienteDaConfrontare: !reportIntegritaAvvio.ciSonoDatiDaConfrontare(dati)
        });

        if (esito.azione === "invariato") {
            this._avvisaRicontrolloNonRiuscito(esito.motivo);
        }

        //Si fa vedere andare via solo cio' che si e' visto risolvere davvero.
        const chiaviRisolte = esito.azione === "invariato"
            ? []
            : chiaviPrima.filter(chiave => !chiaviDopo.has(chiave));

        this._tracciaScheda("ricontrollo:esito", {
            esito,
            chiaviPrima,
            chiaviDopo: Array.from(chiaviDopo),
            chiaviRisolte
        });

        return {
            record,
            chiaviRisolte,
            applica: () => {
                //Il riferimento al box si aggiorna comunque: quello lo abbiamo in mano.
                this._aggiornaRiferimentiBox(record, box);

                //Di quello che non abbiamo potuto verificare non si scrive niente: ne' l'analisi
                //del record, ne' i suoi dati, ne' la lista del kit.
                if (esito.azione === "invariato") {
                    return;
                }

                record.schedaRef = { records };
                record.preAnalisi = preAnalisi;
                this._aggiornaListaKitConRecordFreschi(records);

                //Se il record resta nella stessa categoria non lo si tocca: togliere e
                //rimettere lo manderebbe in fondo al suo gruppo di pagina, e l'operatore, che lo
                //cercherebbe dov'era, lo darebbe per sparito. E' successo.
                const categoriaAttuale = this._categoriaDelRecord(record);

                if (esito.azione === "sposta" && esito.categoria === categoriaAttuale) {
                    this._tracciaScheda("report:recordAggiornatoInPosto", { categoria: categoriaAttuale });
                }
                else {
                    this._rimuoviRecordDalReport(record);

                    if (esito.azione === "sposta" && esito.categoria != null) {
                        const state2 = this._confrontoReportState;
                        if (state2 != null && state2.report != null) {
                            state2.report[esito.categoria] = state2.report[esito.categoria] || [];
                            state2.report[esito.categoria].push(record);
                        }
                    }
                }

                this._removeConfrontoPayload(stato.payloadId);
            }
        };
    },

    /// Quando il ricontrollo non decide, l'operatore deve sapere perche': altrimenti crede di
    /// aver sistemato qualcosa e il report, restando fermo, sembra rotto.
    _avvisaRicontrolloNonRiuscito(motivo) {
        if (motivo === "errori") {
            messaggioUtente("Code CNF-75 Il ricontrollo della referenza e' andato in errore: il report resta com'era", "warning", false, 6);
            return;
        }

        if (motivo === "nienteDaConfrontare") {
            messaggioUtente("Code CNF-76 Il dato riletto non ha campi da confrontare: il report resta com'era", "warning", false, 6);
        }
    },

    _chiaviSegnalazioniDelRecord(record) {
        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
        return differenze.map(diff => this._getSegnalazioneKey(diff));
    },

    /// Una segnalazione che se ne va senza che l'operatore abbia fatto niente e' un fatto da
    /// spiegare, non da subire: qui si scrive cosa ha risposto il server rispetto a cosa
    /// diceva la lista, cosi' il collaudo dice come stanno le cose invece di farmele indovinare.
    _diagnosticaRicontrollo(record, recordsFreschi, chiaviPrima, preAnalisi) {
        try {
            const campiDaGuardare = ["compiledFields", "deletedFields", "Foto.Nome", "Foto.Hash", "Foto.Extra", "Foto.ExtraAuto", "membriGruppoFoto"];

            const primarioFresco = (recordsFreschi || []).find(r => r?.recordInTracciato?.StatoSelezione == 1);
            const primarioLista = (record?.schedaRef?.records || []).find(r => r?.recordInTracciato?.StatoSelezione == 1);

            const tracciatoFresco = primarioFresco?.sottogruppo || primarioFresco?.recordInTracciato || {};
            const tracciatoLista = primarioLista?.sottogruppo || primarioLista?.recordInTracciato || {};

            const diversi = campiDaGuardare.filter(campo => {
                try {
                    return JSON.stringify(tracciatoFresco[campo]) !== JSON.stringify(tracciatoLista[campo]);
                }
                catch (err) {
                    return true;
                }
            });

            const differenzeDopo = preAnalisi != null ? preAnalisi.differenze || [] : [];
            const erroriAnalisi = preAnalisi != null ? preAnalisi.errors || [] : [];

            console.log("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                ": segnalazioni prima " + chiaviPrima.length + ", dopo " + differenzeDopo.length +
                "; errori dell'analisi " + erroriAnalisi.length +
                "; record dal server " + (recordsFreschi || []).length +
                "; campi diversi fra server e lista: " + (diversi.length > 0 ? diversi.join(", ") : "nessuno"));

            if (erroriAnalisi.length > 0) {
                console.warn("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                    ": l'analisi e' finita in errore, il report non si tocca. " + erroriAnalisi.join(" | "));
            }

            if (diversi.length === 0 && differenzeDopo.length < chiaviPrima.length) {
                console.warn("Ricontrollo referenza " + (record?.codiceGruppo || "") +
                    ": segnalazioni risolte con dato identico a quello della lista. Il box e' cambiato, oppure il confronto non e' lo stesso del report.");
            }
        }
        catch (err) {
            console.error("Diagnostica del ricontrollo non riuscita:", err);
        }
    },

    /// Il dato riletto sostituisce quello della lista del kit: da qui in poi il resto del
    /// report, l'elenco dei Nuovi e il prossimo Fix guardano lo stesso dato che ha deciso il
    /// ricontrollo.
    _aggiornaListaKitConRecordFreschi(recordsFreschi) {
        try {
            const percorso = Utility.percorsoListaKit(idKitLavorazione);
            const lista = readFile(percorso);

            if (lista == null || !Array.isArray(lista.records)) {
                console.warn("Lista del kit non aggiornata: file non leggibile o senza record");
                return false;
            }

            const esito = reportIntegritaAvvio.sostituisciRecordNellaLista(lista.records, recordsFreschi);

            if (esito.sostituiti === 0) {
                console.warn("Lista del kit non aggiornata: nessun record corrispondente");
                return false;
            }

            lista.records = esito.records;
            fs.writeFileSync(percorso, JSON.stringify(lista));

            //La copia in memoria deve seguire il file, altrimenti l'elenco dei Nuovi e il
            //tracciato continuerebbero a mostrare il dato vecchio fino al prossimo download.
            if (this._confrontoReportState != null) {
                this._confrontoReportState.listaKit = lista;
            }

            try {
                contenutoKitInLavorazione = lista;
            }
            catch (err) {
                console.error("Copia in memoria della lista non aggiornata:", err);
            }

            console.log("Lista del kit aggiornata dal server: " + esito.sostituiti + " record");
            return true;
        }
        catch (err) {
            console.error("Lista del kit non aggiornata:", err);
            return false;
        }
    },

    /// L'elenco del report in cui il record sta adesso, o null se non sta in nessuno.
    _categoriaDelRecord(record) {
        const report = this._confrontoReportState?.report;
        if (report == null || record == null) {
            return null;
        }

        const target = record._fullReportRecord || record;
        const categorie = ["recordCambiati", "recordUsciti", "recordConErrori", "recordGiusti", "recordNuoviRisolti"];

        for (let i = 0; i < categorie.length; i++) {
            const elenco = report[categorie[i]];
            if (Array.isArray(elenco) && elenco.some(item => this._sameReportRecord(item, target))) {
                return categorie[i];
            }
        }

        return null;
    },

    _rimuoviRecordDalReport(record) {
        const state = this._confrontoReportState;
        if (state == null || state.report == null) {
            return;
        }

        const tolti = {};

        ["recordCambiati", "recordUsciti", "recordConErrori", "recordGiusti", "recordNuoviRisolti"]
            .forEach(chiave => {
                tolti[chiave] = this._removeRecordFromArray(state.report[chiave], record) ? 1 : 0;
            });

        this._tracciaScheda("report:recordTolto", { tolti });
    },

    /// Il box puo' essere un altro rispetto a quello con cui il report e' nato: chi lo cerchera'
    /// domani deve trovare questo.
    _aggiornaRiferimentiBox(record, box) {
        try {
            record.inddId = box.id;

            if (record.elementoMappa != null) {
                record.elementoMappa.refId = box.id;
            }

            const pagina = box.parentPage != null ? box.parentPage.name : null;
            if (pagina != null) {
                record.numeroPagina = pagina;

                if (record.elementoMappa != null) {
                    record.elementoMappa.pagina = pagina;
                    record.elementoMappa.paginaAttuale = pagina;
                }
            }
        }
        catch (err) {
            console.error("Riferimenti del box non aggiornati:", err);
        }
    },

    /// La scheda si rilegge dal server per quella sola referenza: i record con cui il report e'
    /// nato sono di prima che l'operatore ci mettesse mano.
    _leggiSchedaRefAggiornata(codiceGruppo, idRec) {
        return new Promise(resolve => {
            let risposto = false;

            const rispondi = (valore) => {
                if (risposto) {
                    return;
                }
                risposto = true;
                resolve(valore);
            };

            //getSchedaRef non si puo' fermare: la richiesta tardiva la si lascia cadere, ma
            //l'attesa non deve tenere fermo l'operatore.
            setTimeout(() => rispondi(null), this.ATTESA_MASSIMA_RILETTURA_SCHEDA);

            try {
                schedaRef.getSchedaRef(codiceGruppo, (errore, risultato) => {
                    if (errore != null || risultato == null || (risultato.error != null && risultato.error !== "")) {
                        console.error("Rilettura della scheda non riuscita:", errore || risultato?.error);
                        rispondi(null);
                        return;
                    }

                    rispondi(risultato.records || null);
                }, idRec);
            }
            catch (err) {
                console.error("Rilettura della scheda non partita:", err);
                rispondi(null);
            }
        });
    },

    /// Compone il report di confronto fra due liste. Le regole del csv - nome
    /// del file, ordine delle righe, virgolettatura - stanno in reportConfrontoCsv.js.
    compilaReportConfronto(report, options = {}) {
        const wrapper = this._normalizeReportIntegritaWrapper(options.wrapper || null);
        const createdAt = options.createdAt || wrapper?.createdAt || new Date().toISOString();
        const activeTab = options.activeTab != null ? options.activeTab : (this._confrontoReportState?.activeTab || 0);
        const activeList = options.activeList || this._confrontoReportState?.activeList || "report";
        const uiPrefs = options.uiPrefs || wrapper?.uiPrefs || this._confrontoReportState?.uiPrefs || {};
        const pendingScrollToDuplicateInstanceId = options.pendingScrollToDuplicateInstanceId || this._confrontoReportState?.pendingScrollToDuplicateInstanceId || "";
        const pendingScrollRecordType = options.pendingScrollRecordType || this._confrontoReportState?.pendingScrollRecordType || "";
        const reportData = wrapper?.report || report || {};

        reportData.recordCambiati = reportData.recordCambiati || [];
        reportData.recordUsciti = reportData.recordUsciti || [];
        reportData.recordConErrori = reportData.recordConErrori || [];
        reportData.recordGiusti = reportData.recordGiusti || [];
        reportData.recordNuoviRisolti = reportData.recordNuoviRisolti || [];

        const savedWrapper = options.skipSave
            ? (wrapper || { createdAt, createdAtLabel: this._formatReportDate(createdAt), report: reportData, uiPrefs })
            : this.salvaReportIntegritaLocale(reportData, { createdAt, uiPrefs });

        this._confrontoReportState = {
            report: reportData,
            createdAt: savedWrapper.createdAt || createdAt,
            createdAtLabel: savedWrapper.createdAtLabel || this._formatReportDate(createdAt),
            activeTab,
            activeList,
            uiPrefs: savedWrapper.uiPrefs || uiPrefs,
            whitelist: this.leggiWhitelistIntegritaLocale(),
            pendingScrollToDuplicateInstanceId,
            pendingScrollRecordType
        };

        this.salvaWhitelistIntegritaLocale(this._confrontoReportState.whitelist);

        if (typeof indesignEvents !== "undefined" && indesignEvents?.setBusy) {
            indesignEvents.setBusy(true);
        }

        Modali.apriModal("dialogConfrontoReport", "Report Confronto", false, ["pulsantiTestataConfronto"]);

        //Il documento su cui questo report vale: se l'operatore ne apre un altro, il report
        //si chiude da solo (il controllo sta in events.js).
        this._reportIntegritaAperto = true;
        this._documentoDelReport = typeof indesignEvents !== "undefined" && indesignEvents != null
            ? (indesignEvents.lastActiveDocument || "")
            : "";

        const headerActions = document.getElementById("pulsantiTestataConfronto");
        if (headerActions) {
            let btnScaricaCsv = document.getElementById("scaricaReportConfrontoCsv");
            if (!btnScaricaCsv) {
                btnScaricaCsv = document.createElement("button");
                btnScaricaCsv.id = "scaricaReportConfrontoCsv";
                btnScaricaCsv.type = "button";
                btnScaricaCsv.textContent = "Scarica CSV";
                Tooltip.impostaTooltip(btnScaricaCsv, "Scarica il report confronto in formato CSV");
                btnScaricaCsv.style.height = "25px";
                btnScaricaCsv.style.cursor = "pointer";
                btnScaricaCsv.style.marginRight = "8px";

                const closeButton = document.getElementById("closeModalConfronto");
                if (closeButton) {
                    headerActions.insertBefore(btnScaricaCsv, closeButton);
                } else {
                    headerActions.appendChild(btnScaricaCsv);
                }
            }

            Tooltip.impostaTooltip(btnScaricaCsv, "Scarica il report confronto in formato CSV");
            btnScaricaCsv.onclick = async () => await this.scaricaReportConfrontoCsv(this._confrontoReportState?.report || reportData);

            //I20-981: il pulsantino accanto cambia la cartella dei csv. Il title dice dove
            //stanno andando adesso, cosi' non serve aprire il selettore per saperlo.
            let btnCartellaCsv = document.getElementById("cartellaReportConfrontoCsv");
            if (!btnCartellaCsv) {
                btnCartellaCsv = document.createElement("button");
                btnCartellaCsv.id = "cartellaReportConfrontoCsv";
                btnCartellaCsv.type = "button";
                btnCartellaCsv.textContent = "...";
                btnCartellaCsv.style.height = "25px";
                btnCartellaCsv.style.width = "26px";
                btnCartellaCsv.style.padding = "0";
                btnCartellaCsv.style.cursor = "pointer";
                btnCartellaCsv.style.marginRight = "8px";

                btnScaricaCsv.parentNode.insertBefore(btnCartellaCsv, btnScaricaCsv.nextSibling);
            }

            btnCartellaCsv.onclick = async () => await this.scegliCartellaCsvReport();
            this._aggiornaTitoloCartellaCsv();
        }

        const body = document.getElementById("bodyConfrontoReport");
        if (!body) {
            console.error("Elemento #bodyConfrontoReport non trovato");
            return;
        }

        //I20-981: via il piede del report. Conteneva solo "Fix massivo", che dietro aveva un
        //TODO e non faceva nulla: un pulsante che promette un'azione inesistente e' peggio di
        //un pulsante che manca. Lo spazio recuperato va all'elenco, che su questo pannello
        //conta piu' di tutto.
        const footer = document.getElementById("footerConfrontoReport");
        if (footer) {
            footer.innerHTML = "";
            footer.style.display = "none";
        }

        // Store runtime per recuperare i dati reali al click dei pulsanti
        this._confrontoReportStore = new Map();
        this._confrontoReportCounter = 0;

        body.innerHTML = "";
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.height = "100%";
        body.style.minHeight = "0";
        body.style.overflow = "hidden";

        const metaBar = document.createElement("div");
        metaBar.textContent = "Report creato il " + (this._confrontoReportState.createdAtLabel || this._formatReportDate(this._confrontoReportState.createdAt));
        metaBar.style.flexShrink = "0";
        metaBar.style.fontSize = "12px";
        metaBar.style.fontWeight = "600";
        metaBar.style.padding = "0 0 6px 0";

        const tabsRoot = this._crTabRoot();

        //I20-981: i pannelli si costruiscono per primi, perche' le linguette portano il
        //conteggio di cio' che i pannelli mostrano davvero. In vista whitelist le liste sono
        //altre, e un numero preso dal report intero direbbe il falso.
        //I20-981: le differenze sui campi osservati servono ai nuovi e al csv, quindi si
        //calcolano prima dei pannelli e restano indicizzate per presenza.
        this._confrontoReportState.confronti = this._calcolaConfronti();
        this._indiceConfronti = reportConfronti.indicizzaPerPresenza(this._confrontoReportState.confronti.voci);
        //I20-981 (Lotto 4b): se una lista di confronto e' stata scelta in questa sessione, il
        //confronto si rifa' sulla lista corrente di adesso, che puo' essere cambiata.
        this._vociConfrontoListe = this._calcolaConfrontoAltraLista();

        const recordsCambiati = this._getCurrentReportRecords("recordCambiati");
        const recordsUsciti = this._getCurrentReportRecords("recordUsciti");

        const changedPanel = this._buildPanelCambiati(recordsCambiati);
        const removedPanel = this._buildPanelEliminati(recordsUsciti);
        const confrontiPanel = this._buildPanelConfronti();

        const newPanel = this._buildPanelNuovi(this._confrontoReportState.report);

        const conteggi = reportConteggi.conteggiVisibili(
            recordsCambiati,
            recordsUsciti,
            this._confrontoNuoviState?.rowsOriginal);

        const changedTab = this._crTabButton(reportConteggi.etichettaLinguetta("Cambiati", conteggi.cambiati), true, "Cambiati");
        const removedTab = this._crTabButton(reportConteggi.etichettaLinguetta("Eliminati", conteggi.eliminati), false, "Eliminati");
        const newTab = this._crTabButton(reportConteggi.etichettaLinguetta("Nuovi", conteggi.nuovi), false, "Nuovi");
        const confrontiTab = this._crTabButton(
            this._listaConfronto == null
                ? "Confronti"
                : reportConteggi.etichettaLinguetta("Confronti", this._vociConfrontoFiltrate().length),
            false, "Confronti");
        if (this._confrontoListeUi != null) {
            this._confrontoListeUi.tab = confrontiTab;
        }

        const panels = [
            { button: changedTab, panel: changedPanel },
            { button: removedTab, panel: removedPanel },
            { button: newTab, panel: newPanel },
            { button: confrontiTab, panel: confrontiPanel }
        ];

        const activateTab = (activeIndex) => {
            if (this._confrontoReportState) {
                this._confrontoReportState.activeTab = activeIndex;
            }
            panels.forEach((entry, index) => {
                const isActive = index === activeIndex;
                entry.button.classList.toggle("is-active", isActive);
                entry.button.style.opacity = isActive ? "1" : "0.7";
                entry.button.style.fontWeight = isActive ? "700" : "400";
                entry.panel.style.display = isActive ? "flex" : "none";
            });
        };

        changedTab.addEventListener("click", () => activateTab(0));
        removedTab.addEventListener("click", () => activateTab(1));
        newTab.addEventListener("click", () => activateTab(2));
        confrontiTab.addEventListener("click", () => activateTab(3));

        tabsRoot.header.appendChild(changedTab);
        tabsRoot.header.appendChild(removedTab);
        tabsRoot.header.appendChild(newTab);
        tabsRoot.header.appendChild(confrontiTab);

        tabsRoot.content.appendChild(changedPanel);
        tabsRoot.content.appendChild(removedPanel);
        tabsRoot.content.appendChild(newPanel);
        tabsRoot.content.appendChild(confrontiPanel);

        body.appendChild(metaBar);
        body.appendChild(tabsRoot.root);

        activateTab(activeTab);
        this._restorePendingReportScroll();
    },

    //I20-981: il csv del report.
    //Il salvataggio ora avviene da solo quando nasce un report nuovo (automatico = true) e
    //resta disponibile a mano dalla testata. La cartella di destinazione puo' essere cambiata
    //dalla schermata del report: vale per la sessione del codice del plugin, un reload di UXP
    //la riporta alla cartella di esportazione.
    _cartellaCsvSessione: null,

    _csvDelReportCorrente: null,

    async scaricaReportConfrontoCsv(report, opzioni = {}) {
        const automatico = opzioni.automatico === true;

        try {
            const cartella = this.cartellaCsvReport();
            const testo = this._buildReportConfrontoCsv(report);
            const nomeFile = await this._nomeFileReportCsv(cartella);

            const filePath = await this._scriviTestoUtf8(cartella, nomeFile, testo);
            this._csvDelReportCorrente = filePath;

            messaggioUtente((automatico ? "Report confronto salvato in CSV: " : "Report confronto scaricato in CSV: ") + filePath, "success", false, 10);
            return filePath;
        } catch (err) {
            console.error("Errore durante lo scaricamento del report CSV:", err);
            messaggioUtente("Code CNF-020: Errore durante lo scaricamento del report CSV: " + (err?.message || err), "error", false, 10);
            return null;
        }
    },

    /// La cartella dove finiscono i csv: quella scelta per questa sessione, altrimenti la
    /// cartella di esportazione configurata nei percorsi di sistema.
    cartellaCsvReport() {
        const scelta = this._cartellaCsvSessione;
        const cartella = scelta != null && scelta !== ""
            ? String(scelta)
            : (typeof percorsoEsportazione !== "undefined" ? String(percorsoEsportazione || "") : "");

        if (!cartella) {
            throw new Error("cartella di export non configurata");
        }

        return cartella.endsWith("/") ? cartella : cartella + "/";
    },

    /// Il selettore di cartella dalla schermata del report. Cambiando cartella il csv di
    /// questo confronto viene riscritto subito la' dentro e tolto da dove stava: cosi' il
    /// report e il suo csv restano nello stesso posto.
    async scegliCartellaCsvReport() {
        try {
            const cartella = await fs2.getFolder();
            if (!cartella) {
                return null;
            }

            let attuale = "";
            try {
                attuale = this.cartellaCsvReport();
            }
            catch (errCartella) {
                attuale = "";
            }

            const scelta = String(cartella.nativePath || "");
            if (attuale !== "" && (scelta === attuale || scelta + "/" === attuale)) {
                //Stessa cartella: non c'e' niente da spostare e non serve un file in piu'.
                this._aggiornaTitoloCartellaCsv();
                return this._cartellaCsvSessione;
            }

            const precedente = this._csvDelReportCorrente;
            this._cartellaCsvSessione = scelta;

            const report = this._confrontoReportState?.report;
            if (report != null) {
                const nuovoPercorso = await this.scaricaReportConfrontoCsv(report, { automatico: true });

                if (nuovoPercorso != null && precedente != null && precedente !== nuovoPercorso) {
                    this._eliminaFile(precedente);
                }
            }

            this._aggiornaTitoloCartellaCsv();
            return this._cartellaCsvSessione;
        }
        catch (err) {
            console.error("Errore durante la scelta della cartella dei csv:", err);
            messaggioUtente("Code CNF-021: Errore durante la scelta della cartella dei csv: " + (err?.message || err), "error", false, 10);
            return null;
        }
    },

    /// Il nome del prossimo csv in quella cartella. Il progressivo guarda i file gia' presenti
    /// la' dentro, quindi cambiando cartella riparte da quello che la nuova cartella contiene.
    async _nomeFileReportCsv(cartella) {
        const titolo = this._titoloKitPerCsv();
        const dataReport = new Date(this._confrontoReportState?.createdAt || Date.now());
        const progressivo = reportConfrontoCsv.prossimoProgressivo(await this._nomiFileNellaCartella(cartella));

        return reportConfrontoCsv.nomeFileReport(progressivo, titolo, dataReport);
    },

    /// Il titolo del kit come lo mostra la testata del plugin: e' quello che dice all'operatore
    /// a che volantino si riferisce il csv.
    _titoloKitPerCsv() {
        try {
            const meta = ficoProcess?.metaLavorazioneCorrente?.meta;
            if (meta != null && meta.titolo) {
                return String(meta.titolo);
            }
        }
        catch (err) {
            console.warn("Titolo del kit non disponibile per il nome del csv:", err);
        }

        return typeof idKitLavorazione !== "undefined" ? String(idKitLavorazione || "kit") : "kit";
    },

    async _nomiFileNellaCartella(cartella) {
        try {
            const percorso = cartella.endsWith("/") ? cartella.slice(0, -1) : cartella;
            const entry = await fs2.getEntryWithUrl("file://" + percorso);
            const voci = await entry.getEntries();

            return (voci || []).filter(v => v.isFile).map(v => v.name);
        }
        catch (err) {
            //Cartella non leggibile: il csv si scrive lo stesso, il progressivo riparte da uno.
            console.warn("Cartella dei csv non leggibile, progressivo da capo:", err);
            return [];
        }
    },

    /// I20-981: il csv si scrive in byte utf8, non come stringa.
    /// Scritto come stringa, il file usciva con le accentate rotte: l'operatore apriva il csv
    /// e al posto di "è" trovava segni che non c'entravano nulla, perche' l'interpretazione
    /// della stringa non era piu' nelle nostre mani. I byte li calcola reportConfrontoCsv e
    /// il BOM in testa dice a Excel come leggerli.
    async _scriviTestoUtf8(cartella, nomeFile, testo) {
        const percorso = cartella.endsWith("/") ? cartella.slice(0, -1) : cartella;
        const entry = await fs2.getEntryWithUrl("file://" + percorso);
        const file = await entry.createFile(nomeFile, { overwrite: true });

        const bytes = reportConfrontoCsv.bytesUtf8(testo);
        await file.write(bytes, { format: require("uxp").storage.formats.binary });

        return cartella + nomeFile;
    },

    _eliminaFile(percorso) {
        try {
            fs.unlinkSync(percorso);
        }
        catch (err) {
            console.warn("Il csv precedente non e' stato rimosso:", percorso, err);
        }
    },

    _buildReportConfrontoCsv(report) {
        const voci = [];

        const aggiungi = (stato, records, dettagliDelRecord) => {
            (records || []).forEach(record => {
                const raw = this._getReportRecordRaw(record);
                const dati = reportConfrontoCsv.datiRecordPerCsv(raw);
                const dettagli = dettagliDelRecord(record) || [{ campo: "", dettaglio: "" }];

                //I20-981: i cambiamenti sui campi osservati stanno tutti in una colonna sola,
                //ripetuta su ogni riga della referenza: in Excel si filtra "non vuota".
                const confronto = this._testoConfrontoDelRecord(record);

                dettagli.forEach(dettaglio => {
                    voci.push({
                        stato: stato,
                        pagina: this._getReportRecordPage(record),
                        codiceGruppo: record?.codiceGruppo || "",
                        etichetta: dati.etichetta,
                        versione: dati.versione,
                        reparto: dati.reparto,
                        descrizione: dati.descrizione,
                        campo: dettaglio?.campo || "",
                        dettaglio: dettaglio?.dettaglio || "",
                        confronto: confronto
                    });
                });
            });
        };

        aggiungi("Cambiato", report?.recordCambiati, (record) => {
            const tutte = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
            //Le differenze sui campi osservati hanno la loro colonna: qui restano le
            //segnalazioni dell'analisi di integrita', altrimenti si leggerebbero due volte.
            const differenze = tutte.filter(d => d?.origine !== "confronto");

            if (differenze.length === 0) {
                return [{ campo: "", dettaglio: tutte.length > 0 ? "" : "Differenza non specificata" }];
            }

            return differenze.map(diff => ({
                campo: this.etichettaSegnalazione(diff?.label),
                dettaglio: diff?.difference || ""
            }));
        });

        aggiungi("Eliminato", report?.recordUsciti, () => {
            return [{ campo: "", dettaglio: "Presente in impaginato ma non nel tracciato" }];
        });

        aggiungi("Errore", report?.recordConErrori, (record) => {
            const errors = Array.isArray(record?.preAnalisi?.errors) ? record.preAnalisi.errors : [];
            if (errors.length === 0) {
                return [{ campo: "", dettaglio: "Errore non specificato" }];
            }

            return errors.map(error => ({ campo: "", dettaglio: error }));
        });

        //I nuovi non hanno una pagina: nel documento non ci sono ancora, e in coda ci vanno.
        this._getReportNuoviRows(report).forEach(row => {
            const dati = reportConfrontoCsv.datiRecordPerCsv(row.raw);

            voci.push({
                stato: "Nuovo",
                pagina: "",
                codiceGruppo: row.codiceGruppo || "",
                etichetta: dati.etichetta,
                versione: dati.versione,
                reparto: dati.reparto,
                descrizione: row.descrizione || dati.descrizione,
                campo: "",
                dettaglio: "Presente nel tracciato ma non in impaginato",
                confronto: row.confronto || ""
            });
        });

        return reportConfrontoCsv.componiCsv(voci);
    },

    //I20-981: la lista del kit si legge una volta sola per ogni apertura del report.
    //La leggevano il pannello dei nuovi e il csv, ognuno per conto suo, e su un volantino sono
    //parecchi megabyte di json; adesso la sezione Confronti sarebbe stata la terza.
    _leggiListaKitLocale() {
        const stato = this._confrontoReportState;

        if (stato != null && stato.listaKit !== undefined) {
            return stato.listaKit;
        }

        let lista = readFile(Utility.percorsoListaKit(idKitLavorazione));

        if (typeof lista === "string") {
            try {
                lista = JSON.parse(lista);
            }
            catch (err) {
                console.error("Errore parse listaKit:", err);
                lista = null;
            }
        }

        if (stato != null) {
            stato.listaKit = lista;
        }

        return lista;
    },

    /// I record della lista del kit, o un elenco vuoto se la lista non c'e'.
    _recordsListaKit() {
        const lista = this._leggiListaKitLocale();

        if (Array.isArray(lista)) {
            return lista;
        }

        return Array.isArray(lista?.records) ? lista.records : [];
    },

    _getReportNuoviRows(report) {
        const listaTracciato = this._leggiListaKitLocale();

        return this._estraiNuoviDaLista(report, listaTracciato);
    },

    /// I cambiamenti sui campi osservati di una referenza, in una riga sola per il csv.
    _testoConfrontoDelRecord(record) {
        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];

        return differenze
            .filter(d => d?.origine === "confronto")
            .map(d => (d.label || "") + ": " + (d.difference || ""))
            .join(" | ");
    },

    _getReportRecordRaw(record) {
        if (Array.isArray(record?.schedaRef?.records) && record.schedaRef.records.length > 0) {
            return record.schedaRef.records[0]?.recordInTracciato || null;
        }

        return record?.recordInTracciato || record?.raw || null;
    },

    _getReportRecordPage(record) {
        return record?.numeroPagina ?? record?.elementoMappa?.numeroPagina ?? record?.elementoMappa?.pagina ?? "";
    },

    _getReportRecordRefId(record) {
        return record?.inddId
            ?? record?.refId
            ?? record?.duplicateInfo?.refId
            ?? record?.elementoMappa?.refId
            ?? record?.elementoMappa?.idRec
            ?? "";
    },

    _getCurrentReportRecords(key) {
        const state = this._confrontoReportState;
        if (!state) return [];

        if (state.activeList === "whitelist") {
            return this._applyReportToWhitelistRecords(state.report?.[key] || [], state.whitelist?.[key] || [], key);
        }

        return this._applyWhitelistToReportRecords(state.report?.[key] || [], state.whitelist?.[key] || [], key);
    },

    _applyReportToWhitelistRecords(records, whitelistRecords, key) {
        const result = [];

        (whitelistRecords || []).forEach(whitelistRecord => {
            const reportRecord = (records || []).find(item => this._sameReportRecord(item, whitelistRecord));
            if (!reportRecord) {
                return;
            }

            const reportSegnalazioni = this._getRecordSegnalazioni(reportRecord, key);
            const reportKeys = new Set(reportSegnalazioni.map(item => item.key));
            const whitelistSegnalazioni = this._getRecordSegnalazioni(whitelistRecord, key);
            const segnalazioniAncoraPresenti = whitelistSegnalazioni.filter(item => reportKeys.has(item.key));

            if (segnalazioniAncoraPresenti.length === 0) {
                return;
            }

            const filtered = this._cloneForReportStorage(whitelistRecord);
            filtered._fullWhitelistRecord = whitelistRecord;
            filtered._fullReportRecord = reportRecord;
            filtered.elementoMappa = reportRecord.elementoMappa || filtered.elementoMappa;
            filtered.numeroPagina = reportRecord.numeroPagina ?? filtered.numeroPagina;
            filtered.elementoPaginaMappa = reportRecord.elementoPaginaMappa || filtered.elementoPaginaMappa;
            filtered.schedaRef = reportRecord.schedaRef || filtered.schedaRef;
            //I20-1056, lotto 5: il numero di segnalazioni e' quello del report, non quello salvato.
            filtered.segnalazioniImpaginazione = reportRecord.segnalazioniImpaginazione;

            if (key === "recordCambiati") {
                filtered.preAnalisi = filtered.preAnalisi || {};
                filtered.preAnalisi.differenze = segnalazioniAncoraPresenti.map(item => item.value);
            }

            result.push(filtered);
        });

        return result;
    },

    _applyWhitelistToReportRecords(records, whitelistRecords, key) {
        const result = [];

        (records || []).forEach(record => {
            const whitelistRecord = (whitelistRecords || []).find(item => this._sameReportRecord(item, record));
            if (!whitelistRecord) {
                result.push(record);
                return;
            }

            const reportSegnalazioni = this._getRecordSegnalazioni(record, key);
            const whitelistSegnalazioni = this._getRecordSegnalazioni(whitelistRecord, key);
            const whitelistKeys = new Set(whitelistSegnalazioni.map(item => item.key));
            const segnalazioniVisibili = reportSegnalazioni.filter(item => !whitelistKeys.has(item.key));

            if (segnalazioniVisibili.length === 0) {
                return;
            }

            const filtered = this._cloneForReportStorage(record);
            filtered._fullReportRecord = record;
            filtered._hasWhitelistOtherSegnalazioni = true;

            if (key === "recordCambiati") {
                filtered.preAnalisi = filtered.preAnalisi || {};
                filtered.preAnalisi.differenze = segnalazioniVisibili.map(item => item.value);
            }

            result.push(filtered);
        });

        return result;
    },

    _getRecordSegnalazioni(record, key) {
        if (key === "recordUsciti") {
            return [{
                key: "uscito",
                value: { label: "", difference: "Presente in impaginato ma non nel tracciato" }
            }];
        }

        const differenze = Array.isArray(record?.preAnalisi?.differenze) ? record.preAnalisi.differenze : [];
        return differenze.map(diff => ({
            key: this._getSegnalazioneKey(diff),
            value: diff
        }));
    },

    _getSegnalazioneKey(diff) {
        return JSON.stringify({
            label: String(diff?.label || "").trim(),
            difference: String(diff?.difference || "").trim()
        });
    },

    _getDuplicateInfo(record) {
        return record?.duplicateInfo || record?.elementoMappa?.duplicateInfo || null;
    },

    _getDuplicateActiveRecords(duplicateKey, options = {}) {
        const includeWhitelist = options.includeWhitelist !== false;
        const includeReport = options.includeReport !== false;
        const state = this._confrontoReportState;
        if (!state || !duplicateKey) return [];

        const result = [];
        const collect = (records, key, listMode) => {
            (records || []).forEach(record => {
                const info = this._getDuplicateInfo(record);
                if (!info || info.key !== duplicateKey) return;
                result.push({ record, key, listMode });
            });
        };

        if (includeReport) {
            collect(this._applyWhitelistToReportRecords(state.report?.recordCambiati || [], state.whitelist?.recordCambiati || [], "recordCambiati"), "recordCambiati", "report");
            collect(this._applyWhitelistToReportRecords(state.report?.recordUsciti || [], state.whitelist?.recordUsciti || [], "recordUsciti"), "recordUsciti", "report");
        }

        if (includeWhitelist) {
            collect(this._applyReportToWhitelistRecords(state.report?.recordCambiati || [], state.whitelist?.recordCambiati || [], "recordCambiati"), "recordCambiati", "whitelist");
            collect(this._applyReportToWhitelistRecords(state.report?.recordUsciti || [], state.whitelist?.recordUsciti || [], "recordUsciti"), "recordUsciti", "whitelist");
        }

        result.sort((a, b) => {
            const ia = Number(this._getDuplicateInfo(a.record)?.index || 0);
            const ib = Number(this._getDuplicateInfo(b.record)?.index || 0);
            return ia - ib;
        });

        return result;
    },

    _getDuplicateResolvedCount(record) {
        const info = this._getDuplicateInfo(record);
        if (!info) return 0;

        const total = Number(info.total || 0);
        const activeCount = this._getDuplicateActiveRecords(info.key, { includeWhitelist: true }).length;
        return Math.max(0, total - activeCount);
    },

    _getRecordIdentity(record) {
        const codiceGruppo = String(record?.codiceGruppo || record?.elementoMappa?.codiceGruppo || "").trim();
        const idRec = record?.elementoMappa?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.IdRec
            ?? null;
        const refId = record?.elementoMappa?.refId ?? "";
        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? "";
        const duplicateInstanceId = record?.duplicateInfo?.instanceId || record?.elementoMappa?.duplicateInfo?.instanceId || "";

        return {
            codiceGruppo,
            idRec: idRec == null || isNaN(parseInt(idRec)) ? "" : String(parseInt(idRec)),
            refId: String(refId || ""),
            pagina: String(pagina || ""),
            duplicateInstanceId: String(duplicateInstanceId || "")
        };
    },

    _sameReportRecord(a, b) {
        const ia = this._getRecordIdentity(a);
        const ib = this._getRecordIdentity(b);

        if (ia.duplicateInstanceId || ib.duplicateInstanceId) {
            return ia.duplicateInstanceId !== "" && ia.duplicateInstanceId === ib.duplicateInstanceId;
        }

        if (ia.codiceGruppo !== ib.codiceGruppo) return false;
        if (ia.idRec !== ib.idRec) return false;

        if (ia.refId || ib.refId) {
            return ia.refId !== "" && ia.refId === ib.refId;
        }

        if (ia.idRec || ib.idRec) {
            return true;
        }

        return ia.pagina === ib.pagina;
    },

    _removeRecordFromArray(arr, record) {
        const list = arr || [];
        const target = record?._fullReportRecord || record;
        const index = list.findIndex(item => this._sameReportRecord(item, target));
        if (index >= 0) {
            list.splice(index, 1);
            return true;
        }
        return false;
    },

    _saveCurrentReportAndWhitelist() {
        const state = this._confrontoReportState;
        if (!state) return;

        //Il salvataggio e' sincrono e il file e' grosso: quanto costa lo dice il tracciato.
        const inizioSalvataggio = Date.now();
        try {
            this._salvaReportEWhitelist(state);
        }
        finally {
            this._tracciaScheda("report:salvato", { ms: Date.now() - inizioSalvataggio });
        }
    },

    _salvaReportEWhitelist(state) {
        const saved = this.salvaReportIntegritaLocale(state.report, {
            createdAt: state.createdAt,
            uiPrefs: state.uiPrefs || {}
        });

        state.createdAt = saved.createdAt;
        state.createdAtLabel = saved.createdAtLabel;
        state.uiPrefs = saved.uiPrefs || state.uiPrefs || {};
        state.whitelist = this.salvaWhitelistIntegritaLocale(state.whitelist || this._getEmptyWhitelistIntegrita());
    },

    _ricostruisciReport(state) {
        this.compilaReportConfronto(state.report, {
            createdAt: state.createdAt,
            activeTab: state.activeTab,
            activeList: state.activeList,
            uiPrefs: state.uiPrefs,
            skipSave: true,
            wrapper: {
                createdAt: state.createdAt,
                createdAtLabel: state.createdAtLabel,
                report: state.report,
                uiPrefs: state.uiPrefs
            }
        });
    },

    _getReportCategoryFromTipo(tipo) {
        if (tipo === "uscito") return "recordUsciti";
        return "recordCambiati";
    },

    _getReportRecordRawForInfo(record) {
        const raw = this._getReportRecordRaw(record);
        if (raw) return raw;

        return {
            "Scatto.CodiceGruppo": record?.codiceGruppo || record?.elementoMappa?.codiceGruppo || "",
            "Pagina": this._getReportRecordPage(record),
            "RefId": this._getReportRecordRefId(record)
        };
    },

    _getConfrontoVisibilityFilter() {
        return this._confrontoVisibilityFilter || "visible";
    },

    /// Mentre una riga sta sparendo non si accetta nessun'altra azione del report. I pulsanti
    /// delle righe sono immagini, non bottoni: disabled non esiste e pointer-events in UXP non
    /// e' verificabile, quindi il blocco vero e' questo interruttore, che non dipende da come
    /// il motore tratta lo stile.
    azioneReportInCorso() {
        return this._azioneReportInCorso === true;
    },

    async _onConfrontoAction(ev, action) {
        //Mentre una riga sta sparendo non si accetta altro: un secondo clic lavorerebbe su un
        //record che sta gia' uscendo dal report.
        if (this.azioneReportInCorso()) {
            return;
        }

        const payloadId = ev.currentTarget?.dataset?.payloadId;
        const payload = this._getConfrontoPayload(payloadId);

        if (!payload) {
            console.warn("Payload non trovato:", payloadId);
            return;
        }

        this._azioneReportInCorso = true;

        try {
            await this._eseguiAzioneConfronto(action, payloadId, payload);
        }
        finally {
            this._azioneReportInCorso = false;
        }
    },

    async _eseguiAzioneConfronto(action, payloadId, payload) {
        switch (action) {
            case "find":
                await this._apriSchedaDalReport(payloadId, payload);
                break;

            case "info":
                this._openInfoReportRecord(payload.record);
                break;

            case "fix":
                this._findElemento(payload);
                await this._fixElemento(payloadId, payload);
                break;

            case "resolve":
                await this._resolveSegnalazione(payloadId, payload);
                break;

            case "whitelist":
                await this._mandaInWhitelist(payloadId, payload);
                break;

            case "restoreWhitelist":
                await this._ripristinaDaWhitelist(payloadId, payload);
                break;

            case "delete":
                await this._deleteElemento(payloadId, payload);
                break;
        }
    },

    async _resolveSegnalazione(payloadId, payload) {
        const ok = await this._confirmReportAction("resolve", "Risolvi questa segnalazione?");
        if (!ok) return;

        const state = this._confrontoReportState;
        if (!state) return;

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordRisolto = payload.record;
        const duplicateInfo = this._getDuplicateInfo(recordRisolto);

        await this._dissolviRiga(payloadId);

        this._removeRecordFromArray(state.report?.[key], recordRisolto);
        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();

        if (duplicateInfo) {
            const altreIstanze = this._getDuplicateActiveRecords(duplicateInfo.key, { includeWhitelist: false });
            if (altreIstanze.length > 0) {
                const vaiAllaProssima = await Modali.confirm("Ci sono altre istanze non risolte di questo box duplicato. Vuoi andare alla prossima?");
                if (vaiAllaProssima) {
                    this._goToNextDuplicate(recordRisolto, key, false);
                }
            }
        }
    },

    async _mandaInWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        await this._dissolviRiga(payloadId);

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordDaSpostare = payload?.record?._fullReportRecord || payload.record;
        state.whitelist = state.whitelist || this._getEmptyWhitelistIntegrita();
        state.whitelist[key] = state.whitelist[key] || [];

        this._removeRecordFromArray(state.whitelist[key], recordDaSpostare);
        state.whitelist[key].push(this._cloneForReportStorage(recordDaSpostare));

        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();
    },

    async _ripristinaDaWhitelist(payloadId, payload) {
        const state = this._confrontoReportState;
        if (!state) return;

        await this._dissolviRiga(payloadId);

        const key = this._getReportCategoryFromTipo(payload?.tipo);
        const recordDaRipristinare = payload?.record?._fullReportRecord || payload.record;
        const recordWhitelistVisibile = payload.record;
        state.report[key] = state.report[key] || [];

        if (!state.report[key].some(item => this._sameReportRecord(item, recordDaRipristinare))) {
            state.report[key].push(this._cloneForReportStorage(recordDaRipristinare));
        }

        this._removeSegnalazioniFromWhitelistRecord(state.whitelist?.[key], recordWhitelistVisibile, key);
        this._removeConfrontoPayload(payloadId);
        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();
    },

    _removeSegnalazioniFromWhitelistRecord(arr, visibleRecord, key) {
        const list = arr || [];
        const targetRecord = visibleRecord?._fullWhitelistRecord || visibleRecord;
        const index = list.findIndex(item => this._sameReportRecord(item, targetRecord));
        if (index < 0) {
            return false;
        }

        if (key === "recordUsciti") {
            list.splice(index, 1);
            return true;
        }

        const visibleKeys = new Set(this._getRecordSegnalazioni(visibleRecord, key).map(item => item.key));
        const target = list[index];
        const differenze = Array.isArray(target?.preAnalisi?.differenze) ? target.preAnalisi.differenze : [];
        target.preAnalisi = target.preAnalisi || {};
        target.preAnalisi.differenze = differenze.filter(diff => !visibleKeys.has(this._getSegnalazioneKey(diff)));

        if (target.preAnalisi.differenze.length === 0) {
            list.splice(index, 1);
        }

        return true;
    },

    _findElemento(payload) {
        const record = payload?.record;
        const box = this._resolveBoxFromRecord(record);

        if (!box) {
            messaggioUtente("Impossibile trovare l'elemento nel documento il riferimento potrebbe essere stato perso", "warning", false, 5);
            console.warn("Elemento non trovato");
            return null;
        }

        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
        } catch (err) {
            console.error("Errore selezione:", err);
        }

        return box;
    },

    _resolveBoxFromRecord(record) {
        const isDuplicato = !!this._getDuplicateInfo(record);
        const boxById = this._resolveBoxByInddId(record);
        if (boxById) {
            return boxById;
        }

        if (isDuplicato) {
            messaggioUtente("Il riferimento InDesign dell'istanza duplicata non è più valido. La ricerca proverà a selezionare la prima istanza trovata per codice gruppo.", "warning", false, 5, false, true);
        }

        return this._resolveBoxByCodiceGruppo(record);
    },

    _resolveBoxByInddId(record) {
        const refId = this._getRecordInddId(record);
        if (refId == null) {
            return null;
        }

        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? record?.elementoMappa?.numeroPagina ?? null;
        return this._findBoxByInddId(refId, pagina);
    },

    _getRecordInddId(record) {
        const refId = record?.duplicateInfo?.refId
            ?? record?.elementoMappa?.duplicateInfo?.refId
            ?? record?.inddId
            ?? record?.refId
            ?? record?.elementoMappa?.refId
            ?? null;

        if (refId == null || refId === "") {
            return null;
        }

        const parsed = Number(refId);
        return Number.isNaN(parsed) ? refId : parsed;
    },

    _findBoxByInddId(refId, pageName = null) {
        const matchesId = (item) => {
            try {
                return item && item.isValid && item.id === refId;
            } catch (e) {
                return false;
            }
        };

        const page = this._getDocumentPageByName(pageName);
        const boxInPage = this._findItemInCollection(page?.allPageItems, matchesId);
        if (boxInPage) {
            return boxInPage;
        }

        try {
            return this._findItemInCollection(app.activeDocument?.allPageItems, matchesId);
        } catch (err) {
            console.error("Errore ricerca box per id InDesign:", err);
            return null;
        }
    },

    _resolveBoxByCodiceGruppo(record) {
        const codiceGruppo = this._getRecordCodiceGruppo(record);
        if (!codiceGruppo) {
            return null;
        }

        const idRec = this._getRecordIdRec(record);
        const pagina = record?.numeroPagina ?? record?.elementoMappa?.pagina ?? record?.elementoMappa?.numeroPagina ?? null;

        const boxInPage = this._findBoxByCodiceGruppoInPage(codiceGruppo, idRec, pagina);
        if (boxInPage) {
            return boxInPage;
        }

        return this._findBoxByCodiceGruppoInDocument(codiceGruppo, idRec);
    },

    _getRecordCodiceGruppo(record) {
        return String(record?.codiceGruppo
            || record?.elementoMappa?.codiceGruppo
            || record?.schedaRef?.records?.[0]?.recordInTracciato?.["Scatto.CodiceGruppo"]
            || "").trim();
    },

    _getRecordIdRec(record) {
        const idRec = record?.elementoMappa?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.idRec
            ?? record?.schedaRef?.records?.[0]?.recordInTracciato?.IdRec
            ?? null;

        if (idRec == null || idRec === "" || isNaN(parseInt(idRec))) {
            return null;
        }

        return parseInt(idRec);
    },

    _findBoxByCodiceGruppoInPage(codiceGruppo, idRec, pageName) {
        const page = this._getDocumentPageByName(pageName);
        if (!page) {
            return null;
        }

        return this._findBoxByCodiceGruppoInGroups(page.groups, codiceGruppo, idRec);
    },

    _findBoxByCodiceGruppoInDocument(codiceGruppo, idRec) {
        try {
            const doc = app.activeDocument;
            for (let i = 0; i < doc.pages.length; i++) {
                const page = doc.pages.item(i);
                const box = this._findBoxByCodiceGruppoInGroups(page.groups, codiceGruppo, idRec);
                if (box) {
                    return box;
                }
            }
        } catch (err) {
            console.error("Errore ricerca box per codice gruppo:", err);
        }

        return null;
    },

    _findBoxByCodiceGruppoInGroups(groups, codiceGruppo, idRec) {
        return this._findItemInCollection(groups, (group) => {
            try {
                if (!group || !group.isValid) {
                    return false;
                }

                const dna = Utility.getDnaOfBox(group);
                if (!dna || String(dna.codice_gruppo || "").trim() !== codiceGruppo) {
                    return false;
                }

                if (idRec != null) {
                    const dnaIdRec = dna.idRec != null && dna.idRec !== "" && !isNaN(parseInt(dna.idRec)) ? parseInt(dna.idRec) : null;
                    if (dnaIdRec != null && dnaIdRec !== idRec) {
                        return false;
                    }
                }

                return true;
            } catch (err) {
                return false;
            }
        });
    },

    _getDocumentPageByName(pageName) {
        if (pageName == null || pageName === "") {
            return null;
        }

        try {
            const page = app.activeDocument.pages.itemByName(String(pageName));
            return page && page.isValid ? page : null;
        } catch (err) {
            return null;
        }
    },

    _findItemInCollection(collection, predicate) {
        if (!collection) {
            return null;
        }

        try {
            const length = collection.length;
            for (let i = 0; i < length; i++) {
                const item = typeof collection.item === "function" ? collection.item(i) : collection[i];
                if (predicate(item)) {
                    return item;
                }
            }
        } catch (err) {
            console.error("Errore scansione collezione InDesign:", err);
        }

        return null;
    },

    async _deleteElemento(payloadId, payload) {
        const record = payload?.record;
        const box = this._resolveBoxFromRecord(record);

        if (!box) {
            console.warn("Riferimento box mancante, impossibile eliminare");
            return;
        }

        try {
            if (!box.isValid) {
                console.warn("Il riferimento al box non è più valido");
                return;
            }

            box.remove();

            await this._dissolviRiga(payloadId);

            const key = this._getReportCategoryFromTipo(payload?.tipo);
            this._removeRecordFromArray(this._confrontoReportState?.report?.[key], record);
            this._removeConfrontoPayload(payloadId);
            this._saveCurrentReportAndWhitelist();
            this._refreshConfrontoReportUi();

        } catch (err) {
            console.error("Errore durante eliminazione box:", err);
        }
    },

    //I20-981: l'eliminazione di tutti i box usciti, che prima era un pulsante con dietro un
    //TODO. Toglie dal documento gli stessi box che il singolo "Elimina" toglie uno per uno:
    //una conferma sola all'inizio, con scritto quanti sono, e un solo rinfresco alla fine.
    //Un box gia' sparito dal documento non e' un errore: e' il caso di chi ha fatto pulizia a
    //mano prima di aprire il report, e nel riepilogo si conta a parte.
    async _eliminaTuttiUsciti(records) {
        const elenco = Array.isArray(records) ? records.slice() : [];

        if (elenco.length === 0) {
            messaggioUtente("Nessun elemento da eliminare", "warning", false, 3);
            return;
        }

        const ok = await this._confirmReportAction(
            "massive",
            "Eliminare dal documento " + elenco.length + " box segnalati come usciti dal tracciato? L'operazione non si annulla.");

        if (!ok) {
            return;
        }

        let eliminati = 0;
        let nonTrovati = 0;
        let errori = 0;

        for (let i = 0; i < elenco.length; i++) {
            const record = elenco[i];

            try {
                const box = this._resolveBoxFromRecord(record);

                if (!box || !box.isValid) {
                    nonTrovati++;
                    continue;
                }

                box.remove();
                this._removeRecordFromArray(this._confrontoReportState?.report?.recordUsciti, record);
                eliminati++;
            }
            catch (err) {
                console.error("Errore durante l'eliminazione massiva del box:", err);
                errori++;
            }
        }

        this._saveCurrentReportAndWhitelist();
        this._refreshConfrontoReportUi();

        let riepilogo = "Eliminati " + eliminati + " box su " + elenco.length;
        if (nonTrovati > 0) {
            riepilogo += ", " + nonTrovati + " non piu' in pagina";
        }
        if (errori > 0) {
            riepilogo += ", " + errori + " con errori (vedi console)";
        }

        messaggioUtente("Code CNF-023: " + riepilogo, errori > 0 ? "warning" : "success", false, 8);
    },

    async _fixElemento(payloadId, payload) {
        const ok = await this._confirmReportAction("fixSingle", "Procedere con il fix di questa segnalazione?");
        if (!ok) return;

        const record = payload?.record;
        const schedaRecords = record?.schedaRef?.records;
        const numeroPagina = record?.numeroPagina;
        const elementoPaginaMappa = record?.elementoPaginaMappa;

        if (!schedaRecords) {
            console.warn("Fix impossibile: schedaRef.records mancante");
            return;
        }

        if (numeroPagina == null) {
            console.warn("Fix impossibile: numeroPagina mancante");
            return;
        }

        if (!elementoPaginaMappa) {
            console.warn("Fix impossibile: elementoPaginaMappa mancante");
            return;
        }

        try {
            var box = await impaginazioneSingoloIndd(
                schedaRecords,
                numeroPagina,
                true,
                elementoPaginaMappa,
                true
            );

            rimuoviSimboli();


            if (box != null){
                await this._dissolviRiga(payloadId);

                const key = this._getReportCategoryFromTipo(payload?.tipo);
                this._removeRecordFromArray(this._confrontoReportState?.report?.[key], record);
                this._removeConfrontoPayload(payloadId);
                this._saveCurrentReportAndWhitelist();
                this._refreshConfrontoReportUi();
            }
            console.log("Fix completato", payload);

        } catch (err) {
            console.error("Errore durante il fix:", err);
        }
    },

    _storeConfrontoPayload(payload) {
        const id = `confronto_${++this._confrontoReportCounter}`;
        this._confrontoReportStore.set(id, payload);
        return id;
    },

    _removeConfrontoPayload(payloadId) {
        if (!this._confrontoReportStore) return;
        this._confrontoReportStore.delete(payloadId);
    },

    _getConfrontoPayload(id) {
        if (!this._confrontoReportStore) return null;
        return this._confrontoReportStore.get(id) || null;
    },

    _groupByPage(records) {
        const map = new Map();

        (records || []).forEach(item => {
            const page = String(item?.numeroPagina ?? item?.elementoMappa?.pagina ?? "?");
            if (!map.has(page)) {
                map.set(page, []);
            }
            map.get(page).push(item);
        });

        return [...map.entries()]
            .sort((a, b) => {
                const na = parseInt(a[0], 10);
                const nb = parseInt(b[0], 10);
                if (Number.isNaN(na) || Number.isNaN(nb)) {
                    return String(a[0]).localeCompare(String(b[0]));
                }
                return na - nb;
            })
            .map(([page, items]) => ({ page, items }));
    },

    //I20-981 (Lotto 4a): la sezione Confronti, nella modalita' che si apre per prima.
    //Confronta la lista con se stessa: per i campi che l'agenzia tiene d'occhio, mostra cosa
    //aveva la referenza prima e cosa ha adesso. Evidenzia e basta, non propone correzioni: a
    //decidere se la referenza va spostata di pagina e' l'operatore.
    //I20-991: le label che l'agenzia ha dichiarato illeggibili per chi lavora, con il nome
    //da mostrare al loro posto. Chi non dichiara nulla vede le label come sempre.
    traduzioniLabelSegnalazioni() {
        try {
            const traduzioni = pluginMiddleware.getCampo("traduzioniLabelSegnalazioni");
            return Array.isArray(traduzioni) ? traduzioni : [];
        }
        catch (err) {
            console.error("Traduzioni delle label non disponibili:", err);
            return [];
        }
    },

    //Il nome della label come va letto: la regola sta in reportIntegritaAvvio, qui si porta
    //solo il dato dell'agenzia. Pubblico perche' lo usa anche il popup della pre analisi
    //all'apertura della scheda ref, che di suo non legge il SourceCustomPlugin.
    etichettaSegnalazione(label) {
        return reportIntegritaAvvio.etichettaSegnalazione(label, this.traduzioniLabelSegnalazioni());
    },

    campiOsservatiConfronto() {
        try {
            const campi = pluginMiddleware.getCampo("campiOsservatiConfronto");
            return Array.isArray(campi) ? campi : [];
        }
        catch (err) {
            console.error("Campi osservati per il confronto non disponibili:", err);
            return [];
        }
    },

    _calcolaConfronti() {
        const campi = this.campiOsservatiConfronto();

        if (campi.length === 0) {
            return { campi: campi, voci: [] };
        }

        return {
            campi: campi,
            voci: reportConfronti.confrontoConSeStessa(this._recordsListaKit(), campi)
        };
    },

    //I20-981 (Lotto 4b): il confronto con un'altra lista della stessa promo. La lista si
    //sceglie fra le lavorazioni sorelle, chieste al server, o si apre da un json locale; resta
    //in memoria per la sessione del plugin. Il confronto vero sta in reportConfronti.js, il
    //csv in reportConfrontoCsv.js: qui c'e' solo la scheda, con i suoi filtri.
    _listaConfronto: null,

    _lavorazioniSorelle: null,

    _filtroConfronto: null,

    _vociConfrontoListe: null,

    filtroConfrontoCorrente() {
        if (this._filtroConfronto == null) {
            this._filtroConfronto = {
                presenza: reportConfronti.FILTRO_PRESENZA.tutte,
                canali: { osservato: true, compilato: true },
                campi: null
            };
        }
        return this._filtroConfronto;
    },

    /// Le voci del confronto, complete: e' il filtro a decidere cosa si vede.
    _calcolaConfrontoAltraLista() {
        if (this._listaConfronto == null) {
            return [];
        }

        try {
            return reportConfronti.confrontoConAltraLista(
                this._recordsListaKit(),
                this._listaConfronto.records,
                this.campiOsservatiConfronto());
        }
        catch (err) {
            console.error("Confronto con l'altra lista non calcolato:", err);
            return [];
        }
    },

    _vociConfrontoFiltrate() {
        return reportConfronti.filtraVociConfronto(this._vociConfrontoListe || [], this.filtroConfrontoCorrente());
    },

    _descriviListaConfronto(lista) {
        return reportConfrontoCsv.descriviLista(lista);
    },

    _identitaListaCorrente() {
        return Object.assign({
            titolo: this._titoloKitPerCsv(),
            idKit: typeof idKitLavorazione !== "undefined" ? idKitLavorazione : ""
        }, reportConfronti.identitaTracciato(this._recordsListaKit()));
    },

    /// Le lavorazioni della stessa promo, chieste al server una volta per sessione.
    async _lavorazioniDellaPromo() {
        if (this._lavorazioniSorelle != null) {
            return this._lavorazioniSorelle;
        }

        try {
            const risposta = await ficoProcess.requestFicoData("Menabo/getLavorazioniDellaPromo/" + idKitLavorazione);
            if (risposta != null && risposta.esito === true && Array.isArray(risposta.lavorazioni)) {
                this._lavorazioniSorelle = risposta;
                return risposta;
            }
            console.warn("Elenco delle lavorazioni della promo non disponibile:", risposta?.error);
            return null;
        }
        catch (err) {
            console.error("Elenco delle lavorazioni della promo non letto:", err);
            return null;
        }
    },

    async _scaricaListaConfrontoScelta() {
        const ui = this._confrontoListeUi;
        const id = ui != null && ui.pickerLavorazioni != null ? String(ui.pickerLavorazioni.value || "") : "";

        if (id === "") {
            messaggioUtente("Scegli prima una lavorazione della promo", "warning", false, 4);
            return;
        }

        const sorelle = this._lavorazioniSorelle;
        const scelta = sorelle != null ? sorelle.lavorazioni.find(l => String(l.id) === id) : null;
        const titolo = scelta != null ? scelta.titolo : "Lavorazione " + id;

        //Il download puo' pesare: lo si dice, e si mostra il caricamento finche' dura.
        messaggioUtente("Scarico la lista di \"" + titolo + "\": puo' richiedere qualche secondo", "warning", false, 6);
        showLoading("Scaricamento lista di confronto...");

        try {
            const lista = await ficoProcess.requestFicoData(
                "Menabo/getListaTracciatoNew2/" + id + "/" + (typeof noCache !== "undefined" ? noCache : true));
            const records = reportConfronti.recordsDellaLista(lista);

            if (records == null || (lista != null && lista.esito === false)) {
                messaggioUtente("Code CNF-80 La lista della lavorazione " + id + " non e' arrivata: " + (lista?.error || "risposta non valida"), "error", false, 8);
                return;
            }

            this._impostaListaConfronto({ origine: "scaricata", idKit: Number(id), titolo, records });
        }
        catch (err) {
            console.error("Lista di confronto non scaricata:", err);
            messaggioUtente("Code CNF-81 Lista di confronto non scaricata: " + (err?.message || err), "error", false, 8);
        }
        finally {
            hideLoading();
        }
    },

    async _apriListaConfrontoLocale() {
        try {
            const file = await fs2.getFileForOpening();
            if (!file) {
                return;
            }

            if (!String(file.name || "").toLowerCase().endsWith(".json")) {
                messaggioUtente("Code CNF-82 Il file scelto non e' un json", "error", false, 5);
                return;
            }

            showLoading("Lettura della lista...");
            let lista = null;
            try {
                lista = JSON.parse(await file.read());
            }
            catch (err) {
                messaggioUtente("Code CNF-83 Il file non si legge come json: " + (err?.message || err), "error", false, 6);
                return;
            }
            finally {
                hideLoading();
            }

            const records = reportConfronti.recordsDellaLista(lista);
            if (records == null) {
                messaggioUtente("Code CNF-84 Il file non e' una lista del kit: manca l'elenco dei record", "error", false, 6);
                return;
            }

            //La promo non si legge dal contenuto: la si verifica dall'idKit, contro l'elenco
            //delle lavorazioni della promo. Se non si puo' verificare, decide l'operatore.
            const idKit = lista != null && lista.idKit != null ? Number(lista.idKit) : null;
            const sorelle = await this._lavorazioniDellaPromo();
            let titolo = String(file.name || "lista locale");

            if (sorelle == null) {
                const procedi = await Modali.confirm("Non riesco a verificare che la lista sia della stessa promo (elenco delle lavorazioni non disponibile). Vuoi confrontarla comunque?");
                if (!procedi) {
                    return;
                }
            }
            else {
                const sorella = idKit != null ? sorelle.lavorazioni.find(l => Number(l.id) === idKit) : null;
                if (sorella == null) {
                    const procedi = await Modali.confirm("La lista " + (idKit != null ? "della lavorazione " + idKit : "scelta") + " non risulta della stessa promo. Il confronto fra promo diverse non ha senso: vuoi procedere comunque?");
                    if (!procedi) {
                        return;
                    }
                }
                else {
                    titolo = sorella.titolo + " - " + file.name;
                }
            }

            this._impostaListaConfronto({ origine: "locale", idKit: idKit, titolo, records });
        }
        catch (err) {
            console.error("Lista di confronto locale non aperta:", err);
            messaggioUtente("Code CNF-85 Lista di confronto non aperta: " + (err?.message || err), "error", false, 8);
        }
    },

    /// La lista scelta diventa quella del confronto, per tutta la sessione del plugin: si
    /// ricalcolano le voci, si azzera il filtro sui campi (i campi disponibili sono altri) e
    /// si ridisegna la scheda.
    _impostaListaConfronto(lista) {
        this._listaConfronto = Object.assign({}, lista, reportConfronti.identitaTracciato(lista.records), { sceltaIl: new Date() });
        this._vociConfrontoListe = this._calcolaConfrontoAltraLista();
        this.filtroConfrontoCorrente().campi = null;
        this._ridisegnaConfrontoListe();

        const voci = this._vociConfrontoFiltrate();
        messaggioUtente("Lista di confronto pronta: " + this._listaConfronto.primari + " referenze, " + voci.length + " voci con differenze", "success", false, 6);
    },

    async _scaricaCsvConfrontoListe() {
        if (this._listaConfronto == null) {
            messaggioUtente("Scegli prima una lista di confronto", "warning", false, 4);
            return;
        }

        try {
            const cartella = this.cartellaCsvReport();
            const nomeFile = reportConfrontoCsv.conSuffissoConfronto(await this._nomeFileReportCsv(cartella));
            const voci = this._vociConfrontoFiltrate();

            const testo = reportConfrontoCsv.componiCsvConfronto({
                corrente: this._identitaListaCorrente(),
                altra: this._listaConfronto,
                filtri: reportConfronti.descriviFiltro(this.filtroConfrontoCorrente(), reportConfronti.campiDisponibili(this._vociConfrontoListe || []))
            }, voci);

            const filePath = await this._scriviTestoUtf8(cartella, nomeFile, testo);
            messaggioUtente("Confronto fra liste scaricato in CSV: " + filePath, "success", false, 10);
        }
        catch (err) {
            console.error("Csv del confronto non scritto:", err);
            messaggioUtente("Code CNF-86 Csv del confronto non scritto: " + (err?.message || err), "error", false, 8);
        }
    },

    async _impaginaTuttiNuoviInCoda() {
        const state = this._confrontoNuoviState;
        if (!state) {
            console.error("Stato nuovi non disponibile.");
            return;
        }

        // if (!app.libraries || app.libraries.length === 0) {
        //     console.error("Nessuna libreria caricata.");
        //     return;
        // }

        // if (app.libraries.length > 1) {
        //     console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
        //     return;
        // }

        if (!state.libreriaCorrente || !state.libreriaCorrente.isValid) {
            console.error("Libreria selezionata non valida.");
            return;
        }

        const libraryAssets = this._getSelectedLibraryAssetNuovi();
        if (!libraryAssets || libraryAssets.length === 0) {
            console.error("Nessun asset compatibile trovato per la griglia selezionata.");
            return;
        }

        let queue = [...(state.rowsCurrent || [])];
        if (!queue.length) {
            console.log("Nessun nuovo elemento da impaginare.");
            return;
        }

        const totale = queue.length;
        let completati = 0;
        const startedAt = Date.now();

        try {
            await this._updateMassiveLoadingNuovi(completati, totale, startedAt);

            while (queue.length > 0) {
                const nuovaPagina = this._createPageAtEnd();
                if (!nuovaPagina) {
                    console.error("Impossibile creare una nuova pagina in coda al documento.");
                    return;
                }

                const assetScelto = this._chooseLibraryAssetForPage(libraryAssets, nuovaPagina);
                if (!assetScelto) {
                    console.error("Impossibile determinare la variante corretta della griglia per la pagina:", nuovaPagina?.name);
                    return;
                }

                const griglia = await this._placeSelectedGridAssetOnPage(assetScelto, nuovaPagina, "GRIGLIA");
                if (!griglia) {
                    console.error("Impossibile piazzare la griglia sulla pagina:", nuovaPagina?.name);
                    return;
                }

                const boxInGriglia = this._getValidGridBoxes(griglia);
                if (!boxInGriglia.length) {
                    console.error("La griglia piazzata non contiene box validi.");
                    return;
                }

                const impaginatiInQuestaPagina = [];
                const paginaNome = String(nuovaPagina.name || "").trim();

                for (let i = 0; i < boxInGriglia.length; i++) {
                    if (queue.length === 0) break;

                    const rowData = queue.shift();
                    const box = boxInGriglia[i];
                    const boxBounds = this._getBoundsFromPageItem(box);

                    if (!boxBounds) {
                        console.error("Impossibile leggere i bounds del box:", box);
                        completati++;
                        await this._updateMassiveLoadingNuovi(completati, totale, startedAt);
                        continue;
                    }

                    const records = [{
                        recordInTracciato: rowData.raw
                    }];

                    try {
                        await impaginazioneSingoloIndd(
                            records,
                            paginaNome,
                            false,
                            null,
                            true,
                            boxBounds,
                            true
                        );

                        impaginatiInQuestaPagina.push(rowData);

                    } catch (err) {
                        console.error("Errore durante impaginazione massiva del record:", rowData, err);
                    }

                    completati++;
                    await this._updateMassiveLoadingNuovi(completati, totale, startedAt);
                }

                rimuoviSimboli();


                for (let i = 0; i < impaginatiInQuestaPagina.length; i++) {
                    this._removeNuovoRowData(impaginatiInQuestaPagina[i], false);
                }

                try {
                    griglia.remove();
                } catch (err) {
                    console.error("Errore rimozione griglia dopo impaginazione:", err);
                }

                this._renderNuoviTable();
                queue = [...(this._confrontoNuoviState?.rowsCurrent || [])];
            }

        } finally {
            hideLoading();
        }
    },

    _createPageAtEnd() {
        try {
            const doc = app.activeDocument;
            return doc.pages.add(LocationOptions.AT_END);
        } catch (err) {
            console.error("Errore creazione pagina in fondo al documento:", err);
            return null;
        }
    },

    _chooseLibraryAssetForPage(assets, pagina) {
        if (!assets || !assets.length || !pagina) return null;

        const pageName = String(pagina.name || "").trim();
        const pageNum = parseInt(pageName, 10);

        const isRightPage = !Number.isNaN(pageNum) ? (pageNum % 2 !== 0) : true;
        const suffixWanted = isRightPage ? "_DX" : "_SX";

        let fallback = null;

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const name = String(asset?.name || "").trim();

            if (!name) continue;
            if (!fallback) fallback = asset;

            if (name.toUpperCase().endsWith(suffixWanted)) {
                return asset;
            }
        }

        return fallback;
    },

    async _placeSelectedGridAssetOnPage(asset, pagina, nomeLayer = "GRIGLIA") {
        if (!asset || !pagina) return null;

        try {
            const doc = app.activeDocument;
            let layer = null;

            try {
                layer = doc.layers.itemByName(nomeLayer);
                if (layer && !layer.isValid) layer = null;
            } catch (e) {
                layer = null;
            }

            if (!layer) {
                console.error("Layer non trovato:", nomeLayer);
                return null;
            }

            let grigliaObj = asset.placeAsset(docInLavorazione)[0];
            var offsetPag = 0;
            var wPage = pagina.bounds[3] - pagina.bounds[1];
            if (parseInt(pagina.name) % 2 != 0 && parseInt(pagina.name) > 1) {
                offsetPag += wPage;
            }
            grigliaObj.move([offsetPag, 0]);

            return grigliaObj;

        } catch (err) {
            console.error("Errore piazzamento griglia:", err);
            return null;
        }
    },

    _getValidGridBoxes(griglia) {
        const boxInGriglia = [];

        try {
            if (!griglia || !griglia.groups) return boxInGriglia;

            for (let iG = 0; iG < griglia.groups.length; iG++) {
                const gruppo = griglia.groups.item(iG);
                const label = String(gruppo?.label || "").trim();

                if (!label) continue;
                if (!label.toLowerCase().startsWith("box_")) continue;

                boxInGriglia.push(gruppo);
            }

            boxInGriglia.sort((a, b) => {
                const labelA = String(a?.label || "");
                const labelB = String(b?.label || "");

                const numA = parseInt(labelA.split("_")[1], 10);
                const numB = parseInt(labelB.split("_")[1], 10);

                const safeA = Number.isNaN(numA) ? 999999 : numA;
                const safeB = Number.isNaN(numB) ? 999999 : numB;

                return safeA - safeB;
            });

        } catch (err) {
            console.error("Errore lettura box griglia:", err);
        }

        return boxInGriglia;
    },

    _getBoundsFromPageItem(item) {
        if (!item) return null;

        try {
            if (item.geometricBounds && item.geometricBounds.length === 4) {
                return item.geometricBounds;
            }
        } catch (err) {
            console.error("Errore lettura geometricBounds:", err);
        }

        return null;
    },

    _normalizeLibraryGridName(nome) {
        const value = String(nome || "").trim();
        if (!value) return "";

        return value.replace(/_(DX|SX)$/i, "");
    },

    _getSelectedLibraryAssetNuovi() {
        const state = this._confrontoNuoviState;
        if (!state) return [];

        // if (!app.libraries || app.libraries.length === 0) {
        //     console.error("Nessuna libreria caricata.");
        //     return [];
        // }

        // if (app.libraries.length > 1) {
        //     console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
        //     return [];
        // }

        if (!state.libreriaCorrente || state.libreriaCorrente.isValid === false) {
            console.error("Libreria corrente non valida.");
            return [];
        }

        const selectedName = state.pickerLibreria?.value || state.selectedLibraryItemName || "";
        if (!selectedName) return [];

        const matches = [];

        for (let i = 0; i < state.elementiLibreria.length; i++) {
            const asset = state.elementiLibreria[i];
            const assetName = String(asset?.name || "").trim();
            if (!assetName) continue;

            const normalized = this._normalizeLibraryGridName(assetName);
            if (normalized === String(selectedName)) {
                matches.push(asset);
            }
        }

        return matches;
    },

    _estraiNuoviDaLista(report, listaTracciato) {
        const codiciPresenti = new Set();

        const addCodici = (arr) => {
            (arr || []).forEach(item => {
                const codice = String(item?.codiceGruppo || "").trim();
                if (codice) {
                    codiciPresenti.add(codice);
                }
            });
        };

        addCodici(report?.recordCambiati);
        addCodici(report?.recordUsciti);
        addCodici(report?.recordGiusti);
        addCodici(report?.recordConErrori);
        addCodici(report?.recordNuoviRisolti);

        let lista = [];
        if (Array.isArray(listaTracciato)) {
            lista = listaTracciato;
        } else if (Array.isArray(listaTracciato?.records)) {
            lista = listaTracciato.records;
        }

        const result = [];

        for (let i = 0; i < lista.length; i++) {
            const item = lista[i].recordInTracciato;
            if (Number(item?.StatoSelezione) !== 1) continue;

            const codiceGruppo = String(item["Scatto.CodiceGruppo"] || "").trim();
            if (!codiceGruppo) continue;

            if (codiciPresenti.has(codiceGruppo)) continue;

            //I20-981: anche una referenza non ancora impaginata puo' avere campi osservati
            //cambiati, ed e' un'informazione che serve prima di decidere dove metterla.
            const confrontoRiga = reportConfronti.differenzePerPresenza(
                this._indiceConfronti, codiceGruppo, reportConfronti.idRecDelRecord(item));

            result.push({
                raw: item,
                originalIndex: i,
                codiceGruppo,
                descrizione: this._getDescrizioneNuovo(item),
                confronto: confrontoRiga != null ? reportConfronti.testoDifferenze(confrontoRiga.differenze) : ""
            });
        }

        return result;
    },

    //I20-981: una sola descrizione composta per il csv, per la tabella dei nuovi e per le
    //info, con la barra al posto del trattino: due separatori diversi fra schermo e file
    //sarebbero una trappola per chi confronta l'uno con l'altro.
    _getDescrizioneNuovo(item) {
        return reportConfrontoCsv.descrizioneComposta(item);
    },

    async _impaginaNuovoSingolo(rowData, inputEl = null) {
        if (!rowData || !rowData.raw) {
            console.error("Impaginazione singolo nuovo: rowData non valido");
            return;
        }

        let pagina = "";

        if (inputEl && inputEl.value != null) {
            pagina = String(inputEl.value).trim();
        }

        if (!pagina) {
            let paginaCorrente = "";

            try {
                paginaCorrente = pagSelected;
            } catch (err) {
                console.error("Impossibile leggere la pagina corrente di InDesign:", err);
            }

            if (!paginaCorrente) {
                console.error("Nessuna pagina specificata e impossibile determinare la pagina corrente.");
                return;
            }

            const conferma = await Modali.confirm(
                "Non hai specificato una pagina. La referenza verrà impaginata nella pagina corrente: " + paginaCorrente + ". Continuare?"
            );

            if (!conferma) {
                return;
            }

            pagina = paginaCorrente;
        }

        const records =[{
           recordInTracciato : rowData.raw
        }];
            

        try {
            await impaginazioneSingoloIndd(
                records,
                pagina,
                false,
                null,
                false,
                null,
                true,
                false //I20-1056: dal Report Integrita' niente schermata delle segnalazioni
            );

            this._removeNuovoRowData(rowData);
        } catch (err) {
            console.error("Errore durante impaginazioneSingoloIndd:", err);
        }
    },

    _removeNuovoRowData(rowData, rerender = true) {
        const state = this._confrontoNuoviState;
        if (!state || !rowData) return;

        const sameRow = (item) => {
            if (!item) return false;

            if (item === rowData) return true;

            if (item.originalIndex != null && rowData.originalIndex != null) {
                return item.originalIndex === rowData.originalIndex;
            }

            if (item.raw && rowData.raw) {
                return item.raw === rowData.raw;
            }

            return false;
        };

        state.rowsOriginal = (state.rowsOriginal || []).filter(item => !sameRow(item));
        state.rowsCurrent = (state.rowsCurrent || []).filter(item => !sameRow(item));

        if (rerender) {
            this._renderNuoviTable();
        }
    },

    //I20-981: il box di cui la mappa dell'impaginato ha gia' il riferimento.
    //La mappa tiene il gruppo InDesign in `ref`: si usa quello. Si torna a cercarlo solo se il
    //riferimento non e' piu' valido, perche' il sync dei numeri di pagina puo' aver rifatto il
    //box; in quel caso si ripetono, nell'ordine, le ricerche che faceva prima
    //impaginazioneSingoloIndd: per id nella pagina attesa, per id in tutto il documento, per
    //codice gruppo fra i gruppi della pagina.
    /// I20-981: il box di cui la mappa dell'impaginato ha gia' il riferimento.
    ///
    /// La mappa tiene il gruppo InDesign in `ref`: si usa quello. Si torna a cercarlo solo se
    /// il riferimento non e' piu' valido, perche' il sync dei numeri di pagina puo' aver rifatto
    /// il box; in quel caso si ripetono, nell'ordine, le ricerche che faceva prima
    /// impaginazioneSingoloIndd: per id nella pagina attesa, per id in tutto il documento, per
    /// codice gruppo fra i gruppi della pagina.
    ///
    /// L'ordine non e' casuale: va dalla ricerca piu' stretta alla piu' larga, perche' ognuna
    /// costa piu' della precedente.
    boxDellElementoMappa(elementoMappa) {
        if (elementoMappa == null) {
            return null;
        }

        try {
            if (elementoMappa.ref != null && elementoMappa.ref.isValid) {
                return elementoMappa.ref;
            }
        }
        catch (e) {
            //Riferimento morto: si cerca.
        }

        var box = Utility._findBoxInExpectedPage(elementoMappa.refId, elementoMappa.pagina);

        if (box == null) {
            box = Utility._findBoxInDocument(elementoMappa.refId);
        }

        if (box == null) {
            box = ReportIntegrita._findBoxByCodiceGruppoInPage(elementoMappa.codiceGruppo, elementoMappa.idRec, elementoMappa.pagina);
        }

        return box;
    },

    //I20-981: la preanalisi di un box che la mappa ha gia' trovato.
    //Il Report Integrita' passava da impaginazioneSingoloIndd solo per arrivare qui, e per ogni
    //box pagava la materializzazione di tutte le pagine del documento
    //(pages.everyItem().getElements()), una page.select() e una ricerca dentro page.allPageItems
    //o, peggio, dentro doc.allPageItems: tutte cose che la mappa aveva gia' risolto. La
    //preanalisi non impagina nulla, quindi della pagina non ha bisogno.
    //Il box si puo' passare gia' trovato: chi richiude la scheda referenza aperta dal report ce
    //l'ha in mano, e puo' essere un box rifatto, che nell'elemento di mappa non c'e' ancora.
    /// I20-981: la preanalisi di un box che la mappa ha gia' trovato.
    ///
    /// Il Report Integrita' passava da impaginazioneSingoloIndd solo per arrivare qui, e per
    /// ogni box pagava la materializzazione di tutte le pagine del documento
    /// (pages.everyItem().getElements()), una page.select() e una ricerca dentro
    /// page.allPageItems o, peggio, dentro doc.allPageItems: tutte cose che la mappa aveva gia'
    /// risolto. La preanalisi non impagina nulla, quindi della pagina non ha bisogno.
    ///
    /// Il box si puo' passare gia' trovato: chi richiude la scheda referenza aperta dal report
    /// ce l'ha in mano, e puo' essere un box rifatto, che nell'elemento di mappa non c'e'
    /// ancora.
    ///
    /// Senza primario non si confronta niente, e nel report non e' un errore da mostrare
    /// all'operatore: il box finisce fra quelli senza analisi.
    async preAnalisiBoxMappato(records, elementoMappa, boxGiaTrovato = null) {
        var dati = datiPrimarioPerConfronto(records);
        if (dati == null) {
            //Nessun primario nel gruppo: senza di lui non c'e' nulla da confrontare. Nel report
            //non e' un errore da mostrare all'operatore, il box finira' fra quelli senza analisi.
            console.warn("Preanalisi confronto: nessun elemento primario nel gruppo");
            return null;
        }

        var box = boxGiaTrovato != null ? boxGiaTrovato : ReportIntegrita.boxDellElementoMappa(elementoMappa);
        if (box == null) {
            return null;
        }

        return await confronti.confrontoBoxCompiledFieldPreAnalisi(
            box,
            dati.compiledFields,
            dati.deletedFields,
            dati.listaFoto,
            dati.fotoExtra,
            dati.fotoExtraAuto,
            true,
            NoRenderElementi.elencoPerSegnalazioni(dati.tracciatoPrimario.noRenderElementi, dati.tracciatoPrimario.membriGruppoFoto),
            dati.tracciatoPrimario);
    },

    //I nomi delle pagine del documento in lavorazione, nell'ordine in cui stanno nel documento.
    /// I nomi delle pagine del documento in lavorazione, nell'ordine in cui stanno nel
    /// documento. Elenco vuoto se non c'e' un documento aperto.
    ///
    /// Si usano i nomi e non i numeri perche' in InDesign le due cose non coincidono: una
    /// sezione puo' far ripartire la numerazione, e il nome e' quello che l'operatore legge.
    nomiPagineDelDocumento() {
        var nomi = [];

        if (docInLavorazione == null) {
            return nomi;
        }

        for (var i = 0; i < docInLavorazione.pages.length; i++) {
            nomi.push(docInLavorazione.pages.item(i).name);
        }

        return nomi;
    },

    //I20-981: la sequenza del Report Integrita', tutta in un posto e tutta attesa.
    //Prima viveva dentro il gestore del bottone "Avvia": la lista si scaricava con una callback
    //il cui esito nessuno controllava, la mappatura dell'impaginato partiva in parallelo e veniva
    //raccolta con due cicli di attesa identici da sessanta secondi, e in mezzo al report girava
    //il rifacimento del tracciato, che ricostruisce anche la riga del bottone appena premuto.
    //Quando la lista andava scaricata, il report spesso non si apriva e l'operatore doveva
    //richiederlo: qui ogni passo e' atteso e ogni errore ha un codice.
    /// La sequenza di avvio: guarda se ce n'e' uno aperto, decide con le soglie
    /// di reportIntegritaAvvio.js se riusarlo o rifarlo, compone l'intervallo di pagine.
    /// Le decisioni stanno nel modulo puro, qui resta la sequenza.
    async avviaReportIntegrita(idKit = null) {
        if (idKit == null) {
            idKit = idKitLavorazione;
        }

        const inizio = Date.now();
        let listaScaricata = false;

        try {
            //0. I20-1056, lotto 5: prima di tutto, anche di riaprire un report, le segnalazioni di
            //impaginazione rimaste nel documento. Si rilegge il documento: l'ultimo controllo in
            //memoria puo' dire cose che nel frattempo l'operatore ha gia' sistemato.
            const avviso = await ReportIntegrita.avvisoSegnalazioniPrimaDelReport();

            if (avviso.azione === "vai") {
                await ReportIntegrita.vaiASegnalazioniDalReport(avviso.lette);
                return;
            }

            if (avviso.azione !== "procedi") {
                return;
            }

            //1. Un report gia' salvato si puo' riaprire, se non e' troppo vecchio.
            const reportLocale = ReportIntegrita.leggiReportIntegritaLocale(idKit);
            if (reportLocale != null) {
                const azioneReport = await ReportIntegrita.richiediAzioneReportIntegritaEsistente(reportLocale);

                if (azioneReport === "cancel") {
                    return;
                }

                if (azioneReport === "open") {
                    //I20-1056, lotto 5: i numeri accanto ai record sono quelli di adesso, non quelli
                    //salvati con il report.
                    ReportIntegrita.assegnaSegnalazioniAlReport(reportLocale.report, avviso.lette);
                    ReportIntegrita.compilaReportConfronto(reportLocale.report, {
                        wrapper: reportLocale,
                        skipSave: true,
                        activeList: "report",
                        activeTab: 0
                    });
                    return;
                }
            }

            //2. La lista: quella scaricata da meno di un'ora si puo' riusare, se l'operatore vuole.
            const listaLocale = readFile(Utility.percorsoListaKit(idKit));
            let usaListaLocale = reportIntegritaAvvio.listaERecente(
                listaLocale != null ? listaLocale["DataScaricamento"] : null);

            if (usaListaLocale) {
                const res = await Modali.confirmCustom(
                    "La lista degli elementi è stata scaricata meno di un'ora fa, vuoi utilizzare la lista recente?",
                    "Usa lista",
                    "1",
                    "Riscarica",
                    "2"
                );

                if (res.hiddenVal == "2") {
                    usaListaLocale = false;
                }
                else if (res.hiddenVal != "1") {
                    return;
                }
            }

            indesignEvents.setBusy(true);
            showLoading("Calcolo pagine in corso...");
            await Utility.sleep(100);

            //3. Mappatura dell'impaginato e, se serve, download della lista: in parallelo come
            //prima, ma attesi entrambi. Se uno dei due fallisce il report si ferma dicendolo,
            //invece di restare appeso al timeout.
            const rangePagine = reportIntegritaAvvio.componiRangePagine(ReportIntegrita.nomiPagineDelDocumento());
            console.log("Range pagine: " + rangePagine);

            const attesaMappa = confronti.mappaturaImpaginato(rangePagine, false, false);
            const attesaLista = usaListaLocale
                ? Promise.resolve(null)
                : scaricaContenutoKitAsync(idKit, true, true);

            const esiti = await Promise.all([attesaMappa, attesaLista]);
            const mappa = esiti[0];
            listaScaricata = !usaListaLocale;

            if (mappa == null) {
                messaggioUtente("Code IDX-84 Mappatura dell'impaginato non riuscita: report annullato.", "error", false, 10);
                return;
            }

            //4. I numeri di pagina: preanalisi e sync col server.
            showLoading("Inizio sync numeri di pagina...");
            await Utility.sleep(10);

            const preAnalisiMismatchNumeriPagina = await ReportIntegrita.preAnalisiMismatchNumeriPagina(rangePagine, mappa);
            if (preAnalisiMismatchNumeriPagina == null) {
                messaggioUtente("Code IDX-85 PreAnalisi di confronto fallita", "error", false, 10);
                return;
            }

            const statoRes = await ReportIntegrita.syncImpaginatoConServer(mappa, preAnalisiMismatchNumeriPagina, true);
            if (statoRes == null) {
                messaggioUtente("Code IDX-86 Sync con server fallita", "error", false, 10);
                return;
            }

            messaggioUtente("Code IDX-87 Sync pagine con server completata con successo", "success", false, 2);

            //5. Il confronto box per box e l'apertura del report.
            showLoading("Inizio confronto box...");
            await Utility.sleep(100);
            await ReportIntegrita.applicaConfronto(mappa, avviso.lette);

            console.log("Report integrità: sequenza completa in " + ((Date.now() - inizio) / 1000).toFixed(1) + " s");
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code IDX-166 Errore durante il report integrità: " + e, "error", false, 10);
        }
        finally {
            hideLoading();

            //Il report aperto tiene il busy per se': lo libera la sua chiusura.
            if (!ReportIntegrita.reportIntegritaAperto()) {
                indesignEvents.setBusy(false);
            }

            //Il tracciato si rinfresca alla fine, e solo se la lista e' cambiata: prima girava in
            //mezzo al report e ne rifaceva l'interfaccia sotto i piedi.
            if (listaScaricata) {
                try {
                    await mostraTracciato();
                }
                catch (exUi) {
                    console.error("Errore durante il rinfresco del tracciato dopo il report:", exUi);
                }
            }
        }
    },

    /// I20-1056, lotto 5: l'avviso delle segnalazioni di impaginazione prima del report. Rilegge i
    /// bollini di tutto il documento (90-400 ms misurati, piu' i 100 per far comparire il
    /// caricamento: il tempo va in console) e, se ce ne sono, chiede all'operatore cosa fare.
    /// Torna { azione: "procedi" | "vai" | "annulla", lette }. Se la lettura non riesce si procede
    /// senza numeri, dicendolo: non si puo' affermare che il documento sia pulito.
    async avvisoSegnalazioniPrimaDelReport() {
        let lette = null;
        showLoading("Controllo delle segnalazioni...");
        try {
            await Utility.sleep(100);
            const inizio = Date.now();
            lette = SchermataSegnalazioni.letturaControllata(null);
            console.log("Report integrità: controllo delle segnalazioni in " + (Date.now() - inizio) + " ms");
        }
        finally {
            hideLoading();
        }

        if (lette == null) {
            messaggioUtente("Code IDX-176 Segnalazioni di impaginazione non controllate: il report prosegue senza", "warning", false, 6);
            return { azione: "procedi", lette: null };
        }

        const testo = SchermataSegnalazioni.testoAvvisoReport(lette);
        if (testo === "") {
            return { azione: "procedi", lette };
        }

        //L'ordine dei pulsanti e' quello scelto dall'operatore: prima l'azione suggerita.
        const azione = await this._confirmTreAzioniReport(testo
            + "<br><span style=\"font-weight:normal;\">Conviene sistemarle prima del report integrità.</span>", [
            { value: "vai", label: "Vai a segnalazioni", color: "#007bff", tooltip: "Annulla il report e apre la schermata delle segnalazioni nel menabò" },
            { value: "procedi", label: "Procedi comunque", color: "#6c757d", tooltip: "Fa il report integrità senza sistemare le segnalazioni" },
            { value: "annulla", label: "Annulla", color: "#dc3545" }
        ]);
        return { azione, lette };
    },

    /// I20-1056, lotto 5: "Vai a segnalazioni" dall'avviso: il report non parte, si apre il menabo'
    /// come dal suo pulsante e poi la schermata di tutto il documento, con la lettura appena fatta.
    /// I filtri del menabo' si aspettano: hanno un loro caricamento, che coprirebbe la schermata.
    async vaiASegnalazioniDalReport(lette) {
        try {
            jsIndexControls.changeImage($("#menaboTab"));
            jsIndexControls.changeSubMenu($("#menaboTab").attr("subTab"));
            await filtriJs.visualizzaHomePageFiltri();
        }
        catch (err) {
            console.error("Menabo' non aperto dall'avviso delle segnalazioni:", err);
        }
        await SchermataSegnalazioni.apri({ lette });
    },

    /// I20-1056, lotto 5: i numeri di segnalazioni accanto ai record dei pannelli Cambiati ed
    /// Eliminati, dalla lettura dell'avviso. Solo quei record: nessuno entra nel report per le sole
    /// segnalazioni. Senza lettura (non riuscita) si tolgono anche quelli salvati, che sarebbero
    /// vecchi.
    assegnaSegnalazioniAlReport(report, lette) {
        if (report == null) {
            return;
        }
        try {
            const records = [].concat(report.recordCambiati || [], report.recordUsciti || []);
            const conSegnalazioni = SchermataSegnalazioni.assegnaAiRecord(records, Array.isArray(lette) ? lette : []);
            console.log("Report integrità: " + conSegnalazioni + " record con segnalazioni di impaginazione");
        }
        catch (err) {
            console.error("Segnalazioni non assegnate ai record del report:", err);
        }
    },

    /// I20-1056, lotto 5: alla chiusura della scheda aperta dal report, il numero del record si
    /// rilegge dal suo box: nella scheda le segnalazioni si possono risolvere.
    _aggiornaSegnalazioniDelRecord(record, box) {
        try {
            const riepilogo = SchermataSegnalazioni.riepilogoVoci(Segnalazioni.leggiDalBox(box));
            if (riepilogo != null) {
                record.segnalazioniImpaginazione = riepilogo;
            }
            else {
                delete record.segnalazioniImpaginazione;
            }
        }
        catch (err) {
            console.error("Segnalazioni del record non rilette:", err);
        }
    },

    //I20-981: il confronto del Report Integrita', box per box.
    //Prima questa funzione serviva due flussi: il report e il "Fix integrità" senza report.
    //Il secondo e' stato rimosso dal picker su richiesta, e con lui sono spariti il ramo che
    //metteva i bollini in pagina e quello che scaricava le schede dal server
    //(getSchedeRefsMassivo), che nel report non si e' mai usato. Resta il confronto sulla lista
    //locale, che il chiamante ha appena verificato o riscaricato.
    /// Applica il confronto alla mappa dell'impaginato, appoggiandosi a
    /// reportConfronti.js per le differenze sui campi osservati dall'agenzia. 359 righe.
    /// I20-1056, lotto 5: letteSegnalazioni e' la lettura dei bollini fatta all'avvio, che da' i
    /// numeri accanto ai record; null se non e' riuscita.
    async applicaConfronto(mappa, letteSegnalazioni = null) {
        console.log(mappa);
        showLoading("Controllo dei box in pagina per ricerca differenze...");
        await Utility.sleep(10);
        //la mappa ha una struttura:
        //1: (3) [{…}, {…}, {…}]
        //dove la chiave è il numero di pagina, dentro tutte le ref a quella pagina
        //una ref ha poi struttura:
        // bounds: (4)[33.999999999999524, 4.9999981350347795, 112.39999999999935, 70.99999813503479]
        // codice: "5329719"
        // codiceGruppo: "5329719,5365965,5365999,5633416,6344292,6927108,6927146"
        // foto: (3)[{… }, {… }, {… }]
        // infoDescrizione: null
        // match: false
        // pagina: "1"
        // paginaAttuale: "1"
        // puntoCentrale: (2)[37.99999813503478, 73.19999999999945]
        // ref: { }
        // refId: 3466160
        // stato: 1

        indesignEvents.setBusy(true);

        const inizioConfronto = Date.now();

        //I20-981: due indici costruiti una volta sola. Prima, per ogni box in pagina, si
        //riscorreva tutta la mappa e si rifiltrava tutta la lista del kit: su un volantino sono
        //centinaia di box per migliaia di record, e il lavoro cresceva col quadrato.
        var boxPerCodiceGruppo = {};
        for (var key in mappa) {
            var listaRefPagina = mappa[key];
            for (var i = 0; i < listaRefPagina.length; i++) {
                var refPagina = listaRefPagina[i];
                var cgPagina = refPagina.codiceGruppo != null ? refPagina.codiceGruppo.toString() : "";

                if (boxPerCodiceGruppo[cgPagina] == null) {
                    boxPerCodiceGruppo[cgPagina] = [];
                }

                boxPerCodiceGruppo[cgPagina].push({
                    elMappa: refPagina,
                    elementoPaginaMappa: listaRefPagina,
                    numeroPagina: key.toString()
                });
            }
        }

        //Le presenze da confrontare: codice gruppo e idRec insieme, perche' lo stesso codice puo'
        //comparire piu' volte con idRec diversi (flusso-impaginazione-indesign, identita' della
        //presenza impaginata).
        var presenze = [];
        var presenzeViste = {};
        for (var key in mappa) {
            var listaRef = mappa[key];
            for (var i = 0; i < listaRef.length; i++) {
                var ref = listaRef[i];
                var idRecNorm = null;
                if (ref.idRec != null && ref.idRec !== "" && !isNaN(parseInt(ref.idRec))) {
                    idRecNorm = parseInt(ref.idRec);
                }

                var chiavePresenza = (ref.codiceGruppo != null ? ref.codiceGruppo : "") + "|" + (idRecNorm != null ? idRecNorm : "");
                if (presenzeViste[chiavePresenza]) {
                    continue;
                }

                presenzeViste[chiavePresenza] = true;
                presenze.push({ codiceGruppo: ref.codiceGruppo, idRec: idRecNorm });
            }
        }

        if (presenze.length == 0) {
            messaggioUtente("Code IDX-40 Confronto: Nessun elemento trovato in pagina", "warning");
            hideLoading();
            indesignEvents.setBusy(false);
            return;
        }

        //recuperiamo dalla lista scaricata le schedeRefs con i codici gruppo presenti in pagina
        var lista = readFile(Utility.percorsoListaKit(idKitLavorazione));
        if (lista == null || lista.records == null) {
            messaggioUtente("Code IDX-165 Confronto: lista del kit non disponibile in locale", "error", false, 10);
            hideLoading();
            indesignEvents.setBusy(false);
            return;
        }

        var recordsPerCodiceGruppo = {};
        for (var i = 0; i < lista.records.length; i++) {
            var recordLista = lista.records[i];
            var cgRecord = recordLista.recordInTracciato["Scatto.CodiceGruppo"] != null
                ? recordLista.recordInTracciato["Scatto.CodiceGruppo"].toString()
                : "";

            if (recordsPerCodiceGruppo[cgRecord] == null) {
                recordsPerCodiceGruppo[cgRecord] = [];
            }

            recordsPerCodiceGruppo[cgRecord].push(recordLista);
        }

        //I20-981: le differenze sui campi osservati dall'agenzia si calcolano una volta sola, su
        //tutta la lista, e si agganciano poi alla presenza giusta. Non cambiano l'aspetto del box,
        //quindi l'analisi di integrita' non le vede: e' l'unico posto dove l'operatore le incontra.
        var differenzeConfronto = {};
        try {
            const campiOsservati = ReportIntegrita.campiOsservatiConfronto();
            if (campiOsservati.length > 0) {
                differenzeConfronto = reportConfronti.indicizzaPerPresenza(
                    reportConfronti.confrontoConSeStessa(lista.records, campiOsservati));
            }
        }
        catch (exConfronto) {
            console.error("Differenze sui campi osservati non calcolate:", exConfronto);
        }

        var schedeRefs = [];
        for (var i = 0; i < presenze.length; i++) {
            var presenza = presenze[i];
            var candidati = recordsPerCodiceGruppo[presenza.codiceGruppo] || [];

            schedeRefs.push({
                records: candidati.filter(r => {
                    if (presenza.idRec == null) {
                        return true;
                    }

                    return getIdRecFromItemRef(r.recordInTracciato) === presenza.idRec;
                })
            });
        }

        await impaginaSingoliConfrontati(schedeRefs);

        async function impaginaSingoliConfrontati(schedeRefs){
            try {
                console.log("Schede refs recuperate per confronto:");
                console.log(schedeRefs);

                if (schedeRefs != null && schedeRefs.length > 0) {
                    var reportObj ={
                        recordCambiati: [],
                        recordUsciti: [],
                        recordConErrori: [],
                        recordGiusti: [],
                        errori : []
                    }

                    var duplicateGroups = {};
                    for (var keyDup in mappa) {
                        var listaDup = mappa[keyDup] || [];
                        for (var d = 0; d < listaDup.length; d++) {
                            var refDup = listaDup[d];
                            var idRecDup = refDup.idRec != null && !isNaN(parseInt(refDup.idRec)) ? parseInt(refDup.idRec) : "";
                            var dupKey = [refDup.codiceGruppo || "", idRecDup].join("|");
                            if (duplicateGroups[dupKey] == null) {
                                duplicateGroups[dupKey] = [];
                            }
                            duplicateGroups[dupKey].push(refDup);
                        }
                    }

                    for (var dupKey in duplicateGroups) {
                        var gruppoDup = duplicateGroups[dupKey];
                        if (gruppoDup.length <= 1) {
                            continue;
                        }

                        for (var gd = 0; gd < gruppoDup.length; gd++) {
                            gruppoDup[gd].duplicateInfo = {
                                key: dupKey,
                                total: gruppoDup.length,
                                index: gd + 1,
                                refId: gruppoDup[gd].refId != null ? gruppoDup[gd].refId : "",
                                instanceId: dupKey + "|" + (gruppoDup[gd].refId != null ? gruppoDup[gd].refId : "") + "|" + (gd + 1)
                            };
                        }
                    }

                    for (var i = 0; i < schedeRefs.length; i++) {
                        var schedaRef = schedeRefs[i];

                        if (schedaRef.records == null || schedaRef.records.length == 0) {
                            //la seguente scheda ref ha riportato un errore o warning. Probabilmente la ref non esiste più nel tracciato
                            //a causa di un cambio di lista.
                            continue;
                        }


                        var codiceGruppo = schedaRef.records[0].recordInTracciato["Scatto.CodiceGruppo"].toString();
                        var idRecScheda = getIdRecFromItemRef(schedaRef.records[0].recordInTracciato);

                        var elementiDaAnalizzare = (boxPerCodiceGruppo[codiceGruppo] || []).filter(candidato => {
                            var idRecRef = candidato.elMappa.idRec != null && !isNaN(parseInt(candidato.elMappa.idRec))
                                ? parseInt(candidato.elMappa.idRec)
                                : null;

                            if (idRecScheda != null && idRecRef != null && idRecRef !== idRecScheda) {
                                return false;
                            }

                            return true;
                        });

                        if (elementiDaAnalizzare.length === 0) {
                            console.log("Mismatch tra schedeRef e mappa durante il confronto per il codice gruppo: " + codiceGruppo);
                        }

                        for (var em = 0; em < elementiDaAnalizzare.length; em++) {
                            var matchMappa = elementiDaAnalizzare[em];
                            var elMappa = matchMappa.elMappa;
                            var elementoPaginaMappa = matchMappa.elementoPaginaMappa;
                            var numeroPagina = matchMappa.numeroPagina;

                            elMappa.match = true;

                            var resAnalisi = null;
                            if (elementoPaginaMappa != null && numeroPagina != null) {
                                console.log("Preanalisi ref confronto per codice gruppo: " + codiceGruppo + " a pagina " + numeroPagina);
                                resAnalisi = await ReportIntegrita.preAnalisiBoxMappato(schedaRef.records, elMappa);
                            }

                            //Le differenze sui campi osservati diventano segnalazioni della
                            //referenza, marcate con l'origine: nella riga stanno in un riquadro
                            //loro, e il Fix non si offre per quelle, perche' in pagina non c'e'
                            //niente da rifare.
                            var confrontoPresenza = reportConfronti.differenzePerPresenza(
                                differenzeConfronto, codiceGruppo, idRecScheda);

                            if (confrontoPresenza != null && confrontoPresenza.differenze.length > 0) {
                                if (resAnalisi == null) {
                                    resAnalisi = { differenze: [], errors: [] };
                                }

                                resAnalisi.differenze = resAnalisi.differenze || [];

                                confrontoPresenza.differenze.forEach(function (d) {
                                    resAnalisi.differenze.push({
                                        label: d.etichetta,
                                        difference: (d.prima || "(vuoto)") + " \u2192 " + (d.adesso || "(vuoto)"),
                                        origine: "confronto"
                                    });
                                });
                            }

                            var recordReport = {
                                elementoMappa: elMappa,
                                inddId: elMappa.refId != null ? elMappa.refId : null,
                                codiceGruppo: codiceGruppo,
                                schedaRef: schedaRef,
                                preAnalisi: resAnalisi,
                                numeroPagina: numeroPagina,
                                elementoPaginaMappa: elementoPaginaMappa
                            }

                            if (elMappa.duplicateInfo != null) {
                                recordReport.duplicateInfo = {
                                    key: elMappa.duplicateInfo.key,
                                    total: elMappa.duplicateInfo.total,
                                    index: elMappa.duplicateInfo.index,
                                    refId: elMappa.duplicateInfo.refId,
                                    instanceId: elMappa.duplicateInfo.instanceId,
                                    resolvedCount: 0
                                };
                            }

                            if (recordReport.duplicateInfo != null) {
                                if (resAnalisi == null) {
                                    resAnalisi = { differenze: [], errors: [] };
                                    recordReport.preAnalisi = resAnalisi;
                                }

                                resAnalisi.differenze = resAnalisi.differenze || [];
                                resAnalisi.differenze.push({
                                    label: "Duplicato",
                                    difference: "box duplicato: istanza " + recordReport.duplicateInfo.index + " di " + recordReport.duplicateInfo.total
                                });
                            }

                            if (recordReport.duplicateInfo != null) {
                                reportObj.recordCambiati.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.errors.length > 0) {
                                reportObj.recordConErrori.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.differenze.length > 0) {
                                reportObj.recordCambiati.push(recordReport);
                            }
                            else if (resAnalisi != null && resAnalisi.differenze.length == 0) {
                                reportObj.recordGiusti.push(recordReport);
                            }
                        }
                    }

                    //adesso scorriamo tutte le ref in mappa e vediamo quali non sono state processate (match = false)
                    for (var key in mappa) {
                        var listaRef = mappa[key];
                        for (var i = 0; i < listaRef.length; i++) {
                            var ref = listaRef[i];
                            if (!ref.match) {
                                //lo aggiungiamo ai record usciti
                                var recordUscito = {
                                    elementoMappa: ref,
                                    inddId: ref.refId != null ? ref.refId : null,
                                    codiceGruppo: ref.codiceGruppo,
                                    schedaRef: null,
                                    preAnalisi: null,
                                    numeroPagina: key,
                                    elementoPaginaMappa: listaRef
                                };

                                if (ref.duplicateInfo != null) {
                                    recordUscito.duplicateInfo = {
                                        key: ref.duplicateInfo.key,
                                        total: ref.duplicateInfo.total,
                                        index: ref.duplicateInfo.index,
                                        refId: ref.duplicateInfo.refId,
                                        instanceId: ref.duplicateInfo.instanceId,
                                        resolvedCount: 0
                                    };
                                }

                                reportObj.recordUsciti.push(recordUscito);
                            }
                        }
                    }


                    hideLoading();
                    console.log(reportObj);

                    var statisticheHash = cacheHashFoto.statistiche();
                    console.log("Report integrità: confronto di " + schedeRefs.length + " presenze in "
                        + ((Date.now() - inizioConfronto) / 1000).toFixed(1) + " s"
                        + " (hash foto: " + statisticheHash.richieste + " richiesti, "
                        + statisticheHash.risposte + " riusati dalla cache)");

                    var reportFilePath = ReportIntegrita.percorsoFileReport(idKitLavorazione);
                    messaggioUtente("Report confronto creato con successo: " + reportFilePath, "success", false, 10);
                    ReportIntegrita.assegnaSegnalazioniAlReport(reportObj, letteSegnalazioni);
                    ReportIntegrita.compilaReportConfronto(reportObj);

                    //I20-981: il csv nasce da solo insieme al report. Solo qui, che e' l'unico
                    //posto dove un report viene creato: riaprire un report gia' fatto o rinfrescare
                    //l'interfaccia non deve produrre altri file.
                    await ReportIntegrita.scaricaReportConfrontoCsv(reportObj, { automatico: true });
                }
            }
            catch (ex) {
                console.error(ex);
                messaggioUtente("Code IDX-41 Errore generico durante l'impaginazione del confronto: " + ex.toString(), "error");
                hideLoading();
                indesignEvents.setBusy(false);
            }
        }
    },

    /// La regola di chiusura: un report aperto descrive un documento preciso, e se l'operatore
    /// passa a un altro file, o li chiude tutti, va chiuso senza chiedere niente.
    /// I20-1014: la decisione stava in events.js, che ora si limita a chiamare questa a
    /// intervalli col documento attivo; il "quando" e' deveChiudereReport di avvio.js.
    chiudiSeNonValePiu(documentoAttuale) {
        if (!this.reportIntegritaAperto()) {
            return false;
        }
        if (reportIntegritaAvvio.deveChiudereReport(this.documentoDelReport(), documentoAttuale)) {
            this.chiudiReportIntegrita("il documento non e' piu' quello del report");
            return true;
        }
        return false;
    },
};

//L'interfaccia sta in pannelli.js, ma e' lo stesso oggetto: vedi l'intestazione.
Object.assign(ReportIntegrita, require('./pannelli'));

module.exports = ReportIntegrita;
