/// I20-1014: l'interfaccia del Report Integrita' - i pannelli Cambiati, Eliminati, Nuovi e
/// Confronti, le righe, i pulsanti, lo scorrimento della lista dei nuovi, la dissolvenza delle
/// righe risolte, i colori.
///
/// Non e' un modulo a se': reportIntegrita.js lo mescola nel suo oggetto con Object.assign, e
/// ogni this qui dentro e' ReportIntegrita. Per questo questi membri possono usare quelli del
/// flusso, e viceversa, come quando stavano insieme in confronti.js. Da qui si chiama il
/// flusso con this, mai con ReportIntegrita: questo file non lo importa.
///
/// Sta qui cio' che disegna o aggiorna il pannello; il flusso, i file e le azioni stanno in
/// reportIntegrita.js. La divisione e' descritta in
/// sorgenti/documentazione/plugin/reportIntegrita/README.md.

const { app, PDFExportOptions, CompressionQuality } = require('indesign');
const reportConteggi = require('./conteggi');
const reportConfronti = require('./sezioneConfronti');
const barraScorrimento = require('../barraScorrimento');
const dissolvenza = require('../dissolvenza');

const pannelli = {
    async _confirmTreAzioniReport(message, actions) {
        let result = null;
        Utility.nascondiHidebleElements();

        const modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        //I20-981: tre pulsanti da novanta pixel non stavano in un riquadro largo il 60% del
        //pannello e uscivano di lato. Ora il riquadro e' largo quasi quanto il pannello e i
        //pulsanti vanno a capo.
        const dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        const body = $('<div style="flex:1 1 auto; min-height:0; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const buttons = $('<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; flex:0 0 auto; padding-top:12px;"></div>');

        actions.forEach(action => {
            const btn = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:' + action.color + '; color:white; border:none; border-radius:5px; cursor:pointer;">' + action.label + '</button>');
            btn.attr("title", action.tooltip || action.label);
            btn.on("click", function () {
                result = action.value;
                $("#confirmModal").remove();
            });
            buttons.append(btn);
        });

        modal.click(function (e) {
            e.stopPropagation();
        });

        dialog.append(body);
        dialog.append(buttons);
        modal.append(dialog);
        $("body").append(modal);

        while (result == null) {
            await Utility.sleep(100);
        }

        Utility.mostraHidebleElements();
        return result;
    },

    /// Porta la riga del record nella parte visibile dell'elenco e la evidenzia per un attimo,
    /// con lo stesso gesto che il report usa per i duplicati. Il primo tentativo aspetta: in
    /// UXP le misure lette subito dopo aver costruito l'interfaccia non sono attendibili.
    _evidenziaRigaDelRecord(record, tentativi = 5) {
        setTimeout(() => {
            try {
                const riga = this._rigaDelPayload(this._payloadIdDelRecord(record));

                if (riga == null) {
                    if (tentativi > 0) {
                        this._evidenziaRigaDelRecord(record, tentativi - 1);
                    }
                    return;
                }

                this._scrollReportRowIntoView(riga);
            }
            catch (err) {
                console.error("Riga del record non evidenziata:", err);
            }
        }, 80);
    },

    /// Dove sta la riga del record nella vista, dopo il ridisegno: c'e', in che pagina, a che
    /// posizione, ed e' visibile? E' l'ultimo anello: il dato puo' essere giusto e la vista no.
    _descriviRigaDelRecord(record) {
        try {
            const payloadId = this._payloadIdDelRecord(record);
            const riga = this._rigaDelPayload(payloadId);

            if (riga == null) {
                return { rigaTrovata: false, payloadId };
            }

            const pagina = riga.dataset?.pageNumber || null;
            const righeDellaPagina = document.querySelectorAll(
                '[data-page-number="' + pagina + '"][data-record-type="' + (riga.dataset?.recordType || "") + '"][data-payload-id]');

            let posizione = -1;
            for (let i = 0; i < righeDellaPagina.length; i++) {
                if (righeDellaPagina[i] === riga) {
                    posizione = i + 1;
                    break;
                }
            }

            return {
                rigaTrovata: true,
                payloadId,
                pagina,
                posizioneNellaPagina: posizione + " di " + righeDellaPagina.length,
                display: riga.style.display || "",
                opacita: riga.style.opacity || "",
                categoriaNelReport: this._categoriaDelRecord(record)
            };
        }
        catch (err) {
            return { errore: String(err) };
        }
    },

    _dimensioniReport() {
        const report = this._confrontoReportState?.report;
        if (report == null) {
            return null;
        }

        const conta = (chiave) => Array.isArray(report[chiave]) ? report[chiave].length : 0;
        return {
            cambiati: conta("recordCambiati"),
            usciti: conta("recordUsciti"),
            conErrori: conta("recordConErrori"),
            giusti: conta("recordGiusti"),
            nuoviRisolti: conta("recordNuoviRisolti"),
            lista: this._confrontoReportState?.activeList || null
        };
    },

    /// La X: l'unica via d'uscita. Deselezionare non chiude niente, perche' sgruppamenti e
    /// raggruppamenti deselezionano e riselezionano il box senza che l'operatore abbia finito.
    _crChiusuraSchedaDalReport() {
        $("#chiudiSchedaDalReport").remove();

        const testata = $("#referenza");
        testata.css("display", "flex");
        testata.css("align-items", "center");
        testata.css("justify-content", "space-between");

        const bottone = $('<div id="chiudiSchedaDalReport">✕</div>');
        bottone.css("color", "white");
        bottone.css("cursor", "pointer");
        bottone.css("padding", "0px 10px");
        bottone.css("font-size", "14px");
        bottone.on("click", () => this._chiudiSchedaDalReport());

        testata.append(bottone);

        const elemento = document.getElementById("chiudiSchedaDalReport");
        if (elemento != null) {
            Utility.impostaTooltip(elemento, "Chiudi la scheda e torna al report");
        }
    },

    /// Fa vedere le segnalazioni che il ricontrollo ha trovato risolte: se non ne resta
    /// nessuna se ne va la riga intera, altrimenti se ne vanno solo quelle.
    async _mostraSegnalazioniRisolte(piano) {
        const risolte = piano?.chiaviRisolte || [];
        if (piano?.record == null || risolte.length === 0) {
            return;
        }

        const riga = this._rigaDelPayload(this._payloadIdDelRecord(piano.record));
        if (riga == null) {
            return;
        }

        const restanti = this._chiaviSegnalazioniDelRecord(piano.record)
            .filter(chiave => risolte.indexOf(chiave) < 0);

        if (restanti.length === 0) {
            await this._dissolviElementi(riga);
            this._rimuoviDallaVista([riga]);
            await this._lasciaRidisegnare();
            return;
        }

        const elementi = [];

        try {
            const nodi = riga.querySelectorAll("[data-segnalazione-key]");
            for (let i = 0; i < nodi.length; i++) {
                if (risolte.indexOf(nodi[i].dataset.segnalazioneKey) >= 0) {
                    elementi.push(nodi[i]);
                }
            }
        }
        catch (err) {
            console.error("Segnalazioni risolte non trovate nella riga:", err);
        }

        await this._dissolviElementi(elementi);
        this._rimuoviDallaVista(elementi);
        await this._lasciaRidisegnare();
    },

    /// Gli elementi sfumati escono dalla vista senza aspettare il ridisegno, che arriva dopo
    /// il salvataggio e li avrebbe tolti comunque.
    _rimuoviDallaVista(elementi) {
        (elementi || []).forEach(el => {
            try {
                if (el != null && el.parentNode != null) {
                    el.parentNode.removeChild(el);
                }
            }
            catch (err) {
                //Un elemento gia' tolto dal ridisegno non e' un errore.
            }
        });
    },

    //I20-981: il percorso completo della cartella dei csv vive nel suggerimento del pulsante.
    _aggiornaTitoloCartellaCsv() {
        const bottone = document.getElementById("cartellaReportConfrontoCsv");
        if (bottone == null) {
            return;
        }

        let cartella = "";
        try {
            cartella = this.cartellaCsvReport();
        }
        catch (err) {
            cartella = "";
        }

        //Il testo del pulsante non cambia: cambiarlo spostava tutta la testata a ogni scelta,
        //e una cartella dal nome lungo non ci stava comunque. Il percorso sta nel suggerimento.
        Utility.impostaTooltip(bottone, "Scegli cartella. Attualmente impostata: "
            + (cartella !== "" ? cartella : "nessuna (configura i percorsi di sistema)"));
    },

    _crDuplicateControl(record, reportKey) {
        const info = this._getDuplicateInfo(record);
        if (!info || Number(info.total || 0) <= 1) {
            return null;
        }

        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.alignItems = "center";
        root.style.gap = "6px";
        root.style.margin = "4px 0";
        root.style.padding = "6px 8px";
        root.style.fontSize = "12px";
        root.style.fontWeight = "800";
        root.style.color = "#7a1f00";
        root.style.backgroundColor = "#ffe1b8";
        root.style.border = "2px solid #d66a00";
        root.style.borderRadius = "4px";
        root.style.boxSizing = "border-box";
        root.style.width = "fit-content";
        root.style.maxWidth = "100%";

        const resolvedCount = this._getDuplicateResolvedCount(record);
        const label = document.createElement("span");
        label.textContent = "BOX DUPLICATO " + info.index + "/" + info.total + (resolvedCount > 0 ? " - " + resolvedCount + " segnalazioni risolte" : "");
        label.style.whiteSpace = "normal";
        label.style.overflowWrap = "anywhere";

        const next = this._crButton(">");
        Utility.impostaTooltip(next, "Vai alla prossima istanza duplicata");
        next.style.minWidth = "24px";
        next.style.minHeight = "22px";
        next.style.padding = "2px 6px";
        next.addEventListener("click", () => this._goToNextDuplicate(record, reportKey, true));

        root.appendChild(label);
        root.appendChild(next);
        return root;
    },

    _styleDuplicateRow(row) {
        if (!row) return;

        row.style.border = "2px solid #d66a00";
        row.style.backgroundColor = "#fff7ec";
        row.style.boxShadow = "inset 4px 0 0 #d66a00";
    },

    _goToNextDuplicate(record, reportKey, includeWhitelist = true) {
        const info = this._getDuplicateInfo(record);
        if (!info) return false;

        const records = this._getDuplicateActiveRecords(info.key, { includeWhitelist });
        if (records.length <= 1) {
            messaggioUtente("Non ci sono altre istanze non risolte per questo duplicato.", "warning", false, 3);
            return false;
        }

        const currentId = info.instanceId;
        let currentIndex = records.findIndex(item => this._getDuplicateInfo(item.record)?.instanceId === currentId);
        if (currentIndex < 0) {
            currentIndex = -1;
        }

        const next = records[(currentIndex + 1) % records.length];
        if (!next) return false;

        const state = this._confrontoReportState;
        const nextInfo = this._getDuplicateInfo(next.record);
        const nextRecordType = next.key === "recordUsciti" ? "uscito" : "cambiato";
        if (state) {
            state.activeList = next.listMode;
            state.activeTab = nextRecordType === "uscito" ? 1 : 0;
            state.pendingScrollToDuplicateInstanceId = nextInfo?.instanceId || "";
            state.pendingScrollRecordType = nextRecordType;
            this._refreshConfrontoReportUi();
        }

        setTimeout(() => {
            this._findElemento({ record: next.record });
            if (nextInfo?.instanceId) {
                setTimeout(() => {
                    const row = this._findReportRowByDuplicateInstanceId(nextInfo.instanceId, nextRecordType);
                    if (row) {
                        this._scrollReportRowIntoView(row);
                    }
                }, 80);
            }
        }, 50);
        return true;
    },

    _restorePendingReportScroll() {
        const state = this._confrontoReportState;
        const instanceId = state?.pendingScrollToDuplicateInstanceId;
        if (!instanceId) return;

        const attemptScroll = (remainingAttempts) => {
            const currentState = this._confrontoReportState;
            const targetInstanceId = currentState?.pendingScrollToDuplicateInstanceId;
            if (!targetInstanceId) return;

            const row = this._findReportRowByDuplicateInstanceId(targetInstanceId, currentState.pendingScrollRecordType);
            if (!row) {
                if (remainingAttempts > 0) {
                    setTimeout(() => attemptScroll(remainingAttempts - 1), 60);
                } else {
                    currentState.pendingScrollToDuplicateInstanceId = "";
                    currentState.pendingScrollRecordType = "";
                }
                return;
            }

            this._scrollReportRowIntoView(row);
            currentState.pendingScrollToDuplicateInstanceId = "";
            currentState.pendingScrollRecordType = "";
        };

        setTimeout(() => attemptScroll(5), 0);
    },

    _findReportRowByDuplicateInstanceId(instanceId, recordType = "") {
        const rows = document.querySelectorAll("[data-duplicate-instance-id]");
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row?.dataset?.duplicateInstanceId !== instanceId) continue;
            if (recordType && row?.dataset?.recordType !== recordType) continue;
            return row;
        }

        return null;
    },

    _scrollReportRowIntoView(row) {
        if (!row) return;

        const scrollContainer = this._getReportScrollContainer(row);
        if (!scrollContainer) return;

        let targetTop = row.offsetTop || 0;
        try {
            const rowRect = row.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            targetTop = scrollContainer.scrollTop + rowRect.top - containerRect.top - 12;
        } catch (err) {
            let current = row;
            targetTop = 0;
            while (current && current !== scrollContainer) {
                targetTop += current.offsetTop || 0;
                current = current.offsetParent;
            }
            targetTop -= 12;
        }

        targetTop = Math.max(0, targetTop);
        scrollContainer.scrollTop = targetTop;

        if (typeof $ !== "undefined") {
            try {
                $(scrollContainer).scrollTop(targetTop);
            } catch (err) {
                // UXP a volte espone solo lo scrollTop nativo.
            }
        }

        const oldOutline = row.style.outline;
        row.style.outline = "3px solid #d66a00";
        setTimeout(() => {
            row.style.outline = oldOutline || "";
        }, 1200);
    },

    _getReportScrollContainer(row) {
        let current = row?.parentElement || null;
        while (current) {
            const overflowY = current.style?.overflowY || "";
            if (overflowY === "scroll" || overflowY === "auto") {
                return current;
            }
            if (current.clientHeight > 0 && current.scrollHeight > current.clientHeight) {
                return current;
            }
            current = current.parentElement;
        }

        return document.getElementById("bodyConfrontoReport") || document.getElementById("bodyModal");
    },

    _refreshConfrontoReportUi() {
        const state = this._confrontoReportState;
        if (!state) return;

        //Il ridisegno rifa' tutto l'elenco: quanto costa lo dice il tracciato.
        const inizioRidisegno = Date.now();
        try {
            this._ricostruisciReport(state);
        }
        finally {
            this._tracciaScheda("report:ridisegnato", { ms: Date.now() - inizioRidisegno });
        }
    },

    _setReportListMode(value) {
        const state = this._confrontoReportState;
        if (!state) return;

        state.activeList = value === "whitelist" ? "whitelist" : "report";
        this._refreshConfrontoReportUi();
    },

    _crReportListPicker() {
        const picker = document.createElement("sp-picker");
        picker.style.minWidth = "150px";

        const menu = document.createElement("sp-menu");
        menu.setAttribute("slot", "options");

        const itemReport = document.createElement("sp-menu-item");
        itemReport.value = "report";
        itemReport.textContent = "Segnalazioni";

        const itemWhitelist = document.createElement("sp-menu-item");
        itemWhitelist.value = "whitelist";
        itemWhitelist.textContent = "Whitelist";

        if ((this._confrontoReportState?.activeList || "report") === "whitelist") {
            itemWhitelist.setAttribute("selected", "selected");
        } else {
            itemReport.setAttribute("selected", "selected");
        }

        menu.appendChild(itemReport);
        menu.appendChild(itemWhitelist);
        picker.appendChild(menu);

        picker.addEventListener("change", (ev) => {
            this._setReportListMode(ev.target.value || "report");
        });

        return picker;
    },

    _openInfoReportRecord(record) {
        const raw = this._getReportRecordRawForInfo(record);
        if (!raw) {
            console.warn("Info non disponibili per la segnalazione:", record);
            return;
        }

        if (typeof schedaRef !== "undefined" && schedaRef?.preparaInfoIspezioneDelDato) {
            schedaRef.preparaInfoIspezioneDelDato(raw, raw);
            this._apriOverlayInfoReport("Info dati referenza");
        } else {
            console.log("Info dati referenza:", raw);
        }
    },

    _apriOverlayInfoReport(titolo) {
        $("#confrontoInfoOverlay").remove();

        //I20-981: questo era l'unico overlay del plugin che usava "inset: 0" per occupare lo
        //schermo; gli altri dieci scrivono top, left, width e height per esteso. Senza quelle
        //misure il riquadro si stringeva sul contenuto: da li' la finestra ridotta a una
        //colonna e lo scorrimento che non arrivava in fondo, perche' il corpo calcolava la
        //propria altezza dentro un riquadro che non ne aveva una.
        const overlay = $('<div id="confrontoInfoOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999999; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box;"></div>');
        const dialog = $('<div style="width: 92%; max-width: 720px; height: 86%; max-height: 86%; background: #fff; color: #111; display: flex; flex-direction: column; border-radius: 4px; box-shadow: 0 8px 28px rgba(0,0,0,0.35); overflow: hidden; box-sizing: border-box;"></div>');
        const header = $('<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-bottom:1px solid #ccc; flex:0 0 auto;"></div>');
        const title = $('<div style="font-weight:700;"></div>').text(titolo || "Info dati referenza");
        const close = $('<button type="button" style="height:26px; min-width:32px; cursor:pointer;">&times;</button>');
        const body = $('<div id="confrontoInfoBody" style="flex:1 1 auto; min-height:0; overflow:auto; padding:10px;"></div>');
        const footer = $('<div style="display:flex; flex-wrap:wrap; gap:8px; padding:8px 10px; border-top:1px solid #ccc; flex:0 0 auto;"></div>');
        const btnVediTutto = $('<button type="button" style="height:26px;">Vedi tutto</button>');
        const btnVediMeno = $('<button type="button" style="height:26px; display:none;">Vedi meno</button>');
        const btnScarica = $('<button type="button" style="height:26px;">Scarica dato</button>');
        close.attr("title", "Chiudi info");
        btnVediTutto.attr("title", "Mostra tutte le informazioni del record");
        btnVediMeno.attr("title", "Mostra solo le informazioni principali del record");
        btnScarica.attr("title", "Scarica le informazioni del record");

        const render = (informazioniRapide) => {
            const infoRapide = $("#infoPerLeggiInfoRef").data("infoRapide");
            const infoComplete = $("#infoPerLeggiInfoRef").data("infoComplete");
            body.html(informazioniRapide ? (infoRapide || "") : (infoComplete || ""));
            btnVediTutto.css("display", informazioniRapide ? "block" : "none");
            btnVediMeno.css("display", informazioniRapide ? "none" : "block");
        };

        close.on("click", () => overlay.remove());
        overlay.on("click", (ev) => {
            if (ev.target === overlay[0]) {
                overlay.remove();
            }
        });
        btnVediTutto.on("click", () => render(false));
        btnVediMeno.on("click", () => render(true));
        btnScarica.on("click", () => {
            if (typeof schedaRef !== "undefined" && schedaRef?.scaricaJson) {
                schedaRef.scaricaJson();
            }
        });

        header.append(title, close);
        footer.append(btnVediTutto, btnVediMeno, btnScarica);
        dialog.append(header, body, footer);
        overlay.append(dialog);
        $("body").append(overlay);
        render(true);
    },

    async _confirmReportAction(kind, message) {
        const state = this._confrontoReportState;
        const prefs = state?.uiPrefs || {};

        if (kind === "fixSingle" && prefs.skipConfirmFixSingle) return true;
        if (kind === "resolve" && prefs.skipConfirmResolve) return true;

        const withSkip = kind === "fixSingle" || kind === "resolve";
        if (!withSkip) {
            return await Utility.confirm(message);
        }

        const res = await this._confirmConNonChiedere(message);
        if (res.result && res.dontAsk && state) {
            if (kind === "fixSingle") {
                state.uiPrefs.skipConfirmFixSingle = true;
            }
            if (kind === "resolve") {
                state.uiPrefs.skipConfirmResolve = true;
            }
            this._saveCurrentReportAndWhitelist();
        }

        return res.result;
    },

    async _confirmConNonChiedere(message) {
        let result = null;
        let dontAsk = false;
        Utility.nascondiHidebleElements();

        const modal = $('<div id="confirmModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 5000; display: flex; justify-content: center; align-items: center; padding: 10px;"></div>');
        const dialog = $('<div style="width: 92%; max-width: 460px; min-width: 200px; max-height: 88%; background-color: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; padding: 14px; box-sizing: border-box; border-radius: 6px;"></div>');
        const body = $('<div style="flex:1 1 auto; min-height:0; overflow:auto;"><h3 style="margin-top:0;">' + message + '</h3></div>');
        const chkWrap = $('<label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-top:8px;"><input type="checkbox"><span>Non chiedere di nuovo per questo report</span></label>');
        const buttons = $('<div style="display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; flex:0 0 auto; padding-top:12px;"></div>');
        const ok = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">Conferma</button>');
        const cancel = $('<button style="min-width:88px; height:26px; padding:0 10px; background-color:#dc3545; color:white; border:none; border-radius:5px; cursor:pointer;">Annulla</button>');
        ok.attr("title", "Conferma operazione");
        cancel.attr("title", "Annulla operazione");

        ok.on("click", function () {
            result = true;
            dontAsk = chkWrap.find("input").prop("checked") === true;
            $("#confirmModal").remove();
        });

        cancel.on("click", function () {
            result = false;
            $("#confirmModal").remove();
        });

        modal.click(function (e) {
            e.stopPropagation();
        });

        body.append(chkWrap);
        buttons.append(ok, cancel);
        dialog.append(body, buttons);
        modal.append(dialog);
        $("body").append(modal);

        while (result == null) {
            await Utility.sleep(100);
        }

        Utility.mostraHidebleElements();
        return { result, dontAsk };
    },

    /// E' il capofila dei pannelli: _buildPanelCambiati,
    /// _buildPanelEliminati e _buildPanelNuovi seguono lo stesso schema - intestazione con il
    /// conteggio, righe raggruppate per pagina, azioni per riga - e i _refresh*, _toggle*,
    /// _apri* che seguono nel file li governano.
    /// Sono duecento membri privati per 5.621 righe: lo schema conta piu' del dettaglio.
    _buildPanelCambiati(records) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent();

        //I20-981: via "Fix all", come "Fix massivo" dietro non aveva nulla. Il fix per singola
        //segnalazione resta, ed e' l'unico che abbia mai davvero sistemato qualcosa.
        const picker = this._crReportListPicker();
        topbar.appendChild(picker);

        const grouped = this._groupByPage(records);

        if (grouped.length === 0) {
            content.appendChild(this._crEmptyState("Nessun elemento cambiato"));
        } else {
            grouped.forEach(group => {
                if (!group.items.length) return;

                content.appendChild(this._crPageHeader(group.page, "cambiato"));
                content.appendChild(this._crPageHiddenNotice(group.page, "cambiato"));

                group.items.forEach(item => {
                    const payloadId = this._storeConfrontoPayload({
                        tipo: "cambiato",
                        record: item,
                        elementoMappa: item.elementoMappa || null,
                        refId: item?.elementoMappa?.refId || null,
                        schedaRecords: item?.schedaRef?.records || null,
                        numeroPagina: item?.numeroPagina ?? item?.elementoMappa?.numeroPagina ?? null,
                        elementoPaginaMappa: item?.elementoPaginaMappa || null,
                        hidden: false
                    });


                    const row = this._crRow("cambiato");
                    row.dataset.payloadId = payloadId;
                    row.dataset.pageNumber = String(group.page);
                    row.dataset.recordType = "cambiato";
                    const duplicateInfo = this._getDuplicateInfo(item);
                    if (duplicateInfo) {
                        if (duplicateInfo.instanceId) {
                            row.dataset.duplicateInstanceId = duplicateInfo.instanceId;
                        }
                        if (duplicateInfo.key) {
                            row.dataset.duplicateKey = duplicateInfo.key;
                        }
                        this._styleDuplicateRow(row);
                    }

                    const left = document.createElement("div");
                    left.style.display = "flex";
                    left.style.flexDirection = "column";
                    left.style.flex = "1 1 auto";
                    left.style.minWidth = "0";
                    left.style.overflow = "hidden";
                    left.style.gap = "4px";

                    const codice = this._crCodiceGruppo(item.codiceGruppo);

                    const diffList = document.createElement("div");
                    diffList.style.display = "flex";
                    diffList.style.flexDirection = "column";
                    diffList.style.gap = "2px";
                    diffList.style.minWidth = "0";
                    diffList.style.width = "100%";

                    //I20-981: nella stessa riga convivono due cose diverse. Le segnalazioni
                    //dell'analisi di integrita' dicono che il box in pagina non corrisponde al
                    //dato; le differenze sui campi osservati dicono che e' cambiato qualcosa
                    //che non tocca il box ma puo' cambiare la pagina in cui va. Si vedono
                    //separate perche' chiedono all'operatore due decisioni diverse.
                    const tutteLeDifferenze = Array.isArray(item?.preAnalisi?.differenze) ? item.preAnalisi.differenze : [];
                    const segnalazioniIntegrita = tutteLeDifferenze.filter(d => d?.origine !== "confronto");
                    const differenzeConfronto = tutteLeDifferenze.filter(d => d?.origine === "confronto");

                    const differenze = segnalazioniIntegrita;
                    if (tutteLeDifferenze.length === 0) {
                        const emptyDiff = document.createElement("div");
                        emptyDiff.textContent = "Nessuna differenza rilevata";
                        emptyDiff.style.opacity = "0.7";
                        emptyDiff.style.minWidth = "0";
                        emptyDiff.style.whiteSpace = "normal";
                        emptyDiff.style.overflowWrap = "anywhere";
                        diffList.appendChild(emptyDiff);
                    } else {
                        differenze.forEach(diff => {
                            const diffRow = document.createElement("div");
                            //I20-981: il nome del campo in grassetto e il resto normale: in un
                            //elenco di differenze e' il campo che si cerca con l'occhio.
                            if (diff?.label) {
                                const campo = document.createElement("span");
                                campo.textContent = this.etichettaSegnalazione(diff.label);
                                campo.style.fontWeight = "600";
                                diffRow.appendChild(campo);
                                diffRow.appendChild(document.createTextNode(": " + (diff?.difference || "")));
                            }
                            else {
                                diffRow.textContent = diff?.difference || "-";
                            }
                            //La chiave della segnalazione resta attaccata alla riga: serve per
                            //far vedere quale se ne sta andando dopo un ricontrollo.
                            diffRow.dataset.segnalazioneKey = this._getSegnalazioneKey(diff);
                            diffRow.style.fontSize = "11px";
                            diffRow.style.lineHeight = "1.3";
                            diffRow.style.whiteSpace = "normal";
                            diffRow.style.wordBreak = "break-word";
                            diffRow.style.overflowWrap = "anywhere";
                            diffRow.style.minWidth = "0";
                            diffList.appendChild(diffRow);
                        });
                    }

                    if (differenzeConfronto.length > 0) {
                        diffList.appendChild(this._crRiquadroConfronto(differenzeConfronto));
                    }

                    if (item?._hasWhitelistOtherSegnalazioni) {
                        const whitelistNotice = document.createElement("div");
                        whitelistNotice.textContent = "(Altre segnalazioni presenti in whitelist)";
                        whitelistNotice.style.fontSize = "11px";
                        whitelistNotice.style.fontStyle = "italic";
                        whitelistNotice.style.opacity = "0.75";
                        whitelistNotice.style.marginTop = "2px";
                        whitelistNotice.style.whiteSpace = "normal";
                        diffList.appendChild(whitelistNotice);
                    }

                    const duplicateControl = this._crDuplicateControl(item, "recordCambiati");
                    left.appendChild(codice);
                    if (duplicateControl) {
                        left.appendChild(duplicateControl);
                    }
                    left.appendChild(diffList);

                    const actions = document.createElement("div");
                    actions.style.display = "flex";
                    actions.style.flexShrink = "0";
                    //Su un pannello stretto i pulsanti vanno a capo invece di ridurre il testo
                    //della riga a due lettere.
                    actions.style.flexWrap = "wrap";
                    actions.style.justifyContent = "flex-end";
                    actions.style.maxWidth = "50%";
                    actions.style.alignItems = "flex-start";
                    actions.style.alignSelf = "flex-start";
                    actions.style.gap = "6px";

                    const btnFix = this._crIconButton("Fix", "images/fix.png");
                    const btnResolve = this._crIconButton("Risolvi segnalazione", "images/risolviSegnalazioni.png");
                    const btnWhitelist = this._confrontoReportState?.activeList === "whitelist"
                        ? this._crIconButton("Ripristina segnalazione", "images/rimuoviWhitelist.png")
                        : this._crIconButton("Manda in whitelist", "images/whitelist.png");
                    const btnFind = this._crIconButton("Trova", "images/leggiLog.png");
                    const btnInfo = this._crIconButton("Info", "images/info.png");

                    btnFix.dataset.payloadId = payloadId;
                    btnResolve.dataset.payloadId = payloadId;
                    btnWhitelist.dataset.payloadId = payloadId;
                    btnFind.dataset.payloadId = payloadId;
                    btnInfo.dataset.payloadId = payloadId;

                    btnFix.addEventListener("click", (ev) => this._onConfrontoAction(ev, "fix"));
                    btnResolve.addEventListener("click", (ev) => this._onConfrontoAction(ev, "resolve"));
                    btnWhitelist.addEventListener("click", (ev) => this._onConfrontoAction(ev, this._confrontoReportState?.activeList === "whitelist" ? "restoreWhitelist" : "whitelist"));
                    btnFind.addEventListener("click", (ev) => this._onConfrontoAction(ev, "find"));
                    btnInfo.addEventListener("click", (ev) => this._onConfrontoAction(ev, "info"));

                    if (this._confrontoReportState?.activeList !== "whitelist") {
                        //Il Fix rifa' il box a partire dal dato: con sole differenze sui campi
                        //osservati in pagina non c'e' niente da rifare, e offrirlo sarebbe un
                        //invito a rimettere mano a un box che va bene com'e'.
                        if (segnalazioniIntegrita.length > 0) {
                            actions.appendChild(btnFix);
                        }
                        actions.appendChild(btnResolve);
                    }
                    actions.appendChild(btnWhitelist);
                    actions.appendChild(btnFind);
                    actions.appendChild(btnInfo);

                    row.appendChild(left);
                    row.appendChild(actions);
                    content.appendChild(row);
                });
            });
        }

        this._confrontoCambiatiContent = content;

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    _buildPanelEliminati(records) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();
        const content = this._crScrollableContent(true);

        const btnDeleteAll = this._crButton("Elimina tutti");
        const picker = this._crReportListPicker();
        if (this._confrontoReportState?.activeList !== "whitelist") {
            topbar.appendChild(btnDeleteAll);
        }
        topbar.appendChild(picker);

        const grouped = this._groupByPage(records);

        if (grouped.length === 0) {
            content.appendChild(this._crEmptyState("Nessun elemento eliminato"));
        } else {
            grouped.forEach(group => {
                if (!group.items.length) return;

                content.appendChild(this._crPageHeader(group.page, "uscito"));

                group.items.forEach(item => {

                    const payloadId = this._storeConfrontoPayload({
                        tipo: "uscito",
                        record: item,
                        elementoMappa: item.elementoMappa || null,
                        refId: item?.elementoMappa?.refId || null,
                        schedaRecords: item?.schedaRef?.records || null,
                        numeroPagina: item?.numeroPagina ?? item?.elementoMappa?.numeroPagina ?? null,
                        elementoPaginaMappa: item?.elementoPaginaMappa || null,
                        hidden: false
                    });

                    const row = this._crRow("uscito");
                    row.dataset.payloadId = payloadId;
                    row.dataset.pageNumber = String(group.page);
                    row.dataset.recordType = "uscito";
                    const duplicateInfo = this._getDuplicateInfo(item);
                    if (duplicateInfo) {
                        if (duplicateInfo.instanceId) {
                            row.dataset.duplicateInstanceId = duplicateInfo.instanceId;
                        }
                        if (duplicateInfo.key) {
                            row.dataset.duplicateKey = duplicateInfo.key;
                        }
                        this._styleDuplicateRow(row);
                    }

                    const codice = this._crCodiceGruppo(item.codiceGruppo);
                    codice.style.flex = "1 1 auto";

                    const left = document.createElement("div");
                    left.style.display = "flex";
                    left.style.flexDirection = "column";
                    left.style.flex = "1 1 auto";
                    left.style.minWidth = "0";
                    left.style.gap = "4px";

                    left.appendChild(codice);

                    const duplicateControl = this._crDuplicateControl(item, "recordUsciti");
                    if (duplicateControl) {
                        left.appendChild(duplicateControl);
                    }

                    const actions = document.createElement("div");
                    actions.style.display = "flex";
                    actions.style.flexShrink = "0";
                    actions.style.flexWrap = "wrap";
                    actions.style.justifyContent = "flex-end";
                    actions.style.maxWidth = "50%";
                    actions.style.alignItems = "center";
                    actions.style.gap = "6px";

                    const btnFind = this._crIconButton("Trova", "images/leggiLog.png");
                    const btnDelete = this._crIconButton("Elimina", "images/icon_small_cestino.png");
                    const btnResolve = this._crIconButton("Risolvi segnalazione", "images/risolviSegnalazioni.png");
                    const btnWhitelist = this._confrontoReportState?.activeList === "whitelist"
                        ? this._crIconButton("Ripristina segnalazione", "images/rimuoviWhitelist.png")
                        : this._crIconButton("Manda in whitelist", "images/whitelist.png");
                    const btnInfo = this._crIconButton("Info", "images/info.png");

                    btnFind.dataset.payloadId = payloadId;
                    btnDelete.dataset.payloadId = payloadId;
                    btnResolve.dataset.payloadId = payloadId;
                    btnWhitelist.dataset.payloadId = payloadId;
                    btnInfo.dataset.payloadId = payloadId;

                    btnFind.addEventListener("click", (ev) => this._onConfrontoAction(ev, "find"));
                    btnDelete.addEventListener("click", (ev) => this._onConfrontoAction(ev, "delete"));
                    btnResolve.addEventListener("click", (ev) => this._onConfrontoAction(ev, "resolve"));
                    btnWhitelist.addEventListener("click", (ev) => this._onConfrontoAction(ev, this._confrontoReportState?.activeList === "whitelist" ? "restoreWhitelist" : "whitelist"));
                    btnInfo.addEventListener("click", (ev) => this._onConfrontoAction(ev, "info"));

                    if (this._confrontoReportState?.activeList !== "whitelist") {
                        actions.appendChild(btnDelete);
                        actions.appendChild(btnResolve);
                    }
                    actions.appendChild(btnWhitelist);
                    actions.appendChild(btnFind);
                    actions.appendChild(btnInfo);

                    row.appendChild(left);
                    row.appendChild(actions);
                    content.appendChild(row);
                });
            });
        }

        btnDeleteAll.addEventListener("click", () => this._eliminaTuttiUsciti(records));

        panel.appendChild(topbar);
        panel.appendChild(content);
        return panel;
    },

    //I20-981: una segnalazione che se ne va lo deve far vedere. In UXP la proprieta' opacity
    //si scrive e si rilegge ma non si ridisegna: il tracciato del collaudo ha mostrato dieci
    //passi accettati dal motore senza che a schermo cambiasse niente. I colori invece si
    //ridisegnano, e il plugin lo sa gia' dal lampo verde della copia e dal bordo arancione dei
    //duplicati. La dissolvenza quindi porta a zero l'alfa dei colori di testo, sfondo e bordi,
    //e spegne le immagini a meta' strada. I conti stanno in dissolvenza.js.,

    PROPRIETA_COLORE_DA_ATTENUARE: ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],

    /// I bersagli della dissolvenza: l'elemento e tutti i suoi discendenti, ciascuno con i
    /// colori che il motore gli attribuisce adesso. Si leggono una volta sola, all'inizio: da
    /// li' in poi si scrive soltanto.
    _bersagliDissolvenza(radice) {
        const bersagli = [];
        const elementi = [radice];

        try {
            const figli = radice.querySelectorAll("*");
            for (let i = 0; i < figli.length; i++) {
                elementi.push(figli[i]);
            }
        }
        catch (err) {
            console.error("Discendenti della riga non letti:", err);
        }

        //Il colore del testo il motore spesso non lo dice: per gli elementi che lo ereditano
        //getComputedStyle torna una forma che non e' un colore. Si prende allora quello scritto
        //sull'antenato piu' vicino che ne ha uno, e in mancanza il grigio scuro del report.
        //Senza questo le scritte delle segnalazioni restavano ferme mentre il resto sfumava.
        const coloreTestoDiBase = this._coloreTestoDegliAntenati(radice) || dissolvenza.COLORE_TESTO_DI_BASE;
        let colorePrimoTestoLetto = null;

        elementi.forEach(el => {
            const bersaglio = { el, colori: {}, immagine: false };

            try {
                bersaglio.immagine = String(el.tagName || "").toUpperCase() === "IMG";
            }
            catch (err) {
                bersaglio.immagine = false;
            }

            let calcolato = null;
            try {
                calcolato = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
            }
            catch (err) {
                calcolato = null;
            }

            this.PROPRIETA_COLORE_DA_ATTENUARE.forEach(proprieta => {
                let testo = null;
                try {
                    //Prima lo stile scritto, che e' quello che il plugin controlla; poi quello
                    //calcolato, per i colori che arrivano dai fogli di stile.
                    testo = (el.style && el.style[proprieta]) || (calcolato != null ? calcolato[proprieta] : null);
                }
                catch (err) {
                    testo = null;
                }

                const colore = dissolvenza.analizzaColore(testo);
                if (colore != null) {
                    bersaglio.colori[proprieta] = colore;
                }
                else if (proprieta === "color" && colorePrimoTestoLetto == null && testo != null && testo !== "") {
                    colorePrimoTestoLetto = String(testo);
                }
            });

            if (bersaglio.colori.color == null && !bersaglio.immagine) {
                bersaglio.colori.color = coloreTestoDiBase;
            }

            bersagli.push(bersaglio);
        });

        //Com'e' fatto il colore che il motore restituisce e che non riconosco: la prossima
        //lettura del tracciato dira' se c'e' una forma da imparare.
        this._ultimoColoreNonRiconosciuto = colorePrimoTestoLetto;

        return bersagli;
    },

    /// Il colore di testo scritto sull'antenato piu' vicino, dentro il report.
    _coloreTestoDegliAntenati(elemento) {
        let corrente = elemento;
        let passi = 0;

        while (corrente != null && passi < 12) {
            try {
                const colore = dissolvenza.analizzaColore(corrente.style ? corrente.style.color : null);
                if (colore != null) {
                    return colore;
                }
                corrente = corrente.parentElement;
            }
            catch (err) {
                return null;
            }
            passi++;
        }

        return null;
    },

    _applicaPassoDissolvenza(bersagli, alfa) {
        let scritture = 0;

        bersagli.forEach(bersaglio => {
            const el = bersaglio.el;

            Object.keys(bersaglio.colori).forEach(proprieta => {
                try {
                    el.style[proprieta] = dissolvenza.coloreConAlfa(bersaglio.colori[proprieta], alfa);
                    scritture++;
                }
                catch (err) {
                    //Un elemento tolto dall'interfaccia mentre sfuma non e' un errore.
                }
            });

            if (bersaglio.immagine && dissolvenza.immaginiSpente(alfa)) {
                try {
                    el.style.visibility = "hidden";
                }
                catch (err) {
                    //Come sopra.
                }
            }

            //Si scrive anche l'opacita': non costa niente, e il giorno che UXP la ridisegnera'
            //la dissolvenza sara' completa anche sulle immagini.
            try {
                el.style.opacity = String(alfa);
            }
            catch (err) {
                //Come sopra.
            }
        });

        return scritture;
    },

    _dissolviElementi(elementi) {
        const lista = (Array.isArray(elementi) ? elementi : [elementi]).filter(el => el != null);

        return new Promise(resolve => {
            if (lista.length === 0) {
                resolve(false);
                return;
            }

            lista.forEach(el => this._spegniInterazione(el));

            let bersagli = [];
            lista.forEach(el => {
                bersagli = bersagli.concat(this._bersagliDissolvenza(el));
            });

            const conColore = bersagli.filter(b => Object.keys(b.colori).length > 0).length;
            const immagini = bersagli.filter(b => b.immagine).length;

            const passi = dissolvenza.numeroDiPassi();
            let passo = 0;
            const inizio = Date.now();
            let scritture = 0;

            const timer = setInterval(() => {
                passo++;
                const alfa = dissolvenza.alfaAlPasso(passo, passi);
                scritture += this._applicaPassoDissolvenza(bersagli, alfa);

                if (passo >= passi) {
                    clearInterval(timer);

                    this._tracciaScheda("dissolvenza", {
                        elementi: lista.length,
                        primo: lista[0] != null ? (lista[0].tagName || "") + (lista[0].dataset?.payloadId ? "#" + lista[0].dataset.payloadId : "") : null,
                        bersagli: bersagli.length,
                        conColore,
                        immagini,
                        passi,
                        durataMs: Date.now() - inizio,
                        scritture,
                        coloreDelPrimo: bersagli[0] != null ? bersagli[0].colori : null,
                        coloreNonRiconosciuto: this._ultimoColoreNonRiconosciuto || null,
                        letturaFinale: this._leggiOpacita(lista[0])
                    });

                    resolve(true);
                }
            }, dissolvenza.PASSO_MS);
        });
    },

    /// Com'e' l'opacita' di un elemento secondo il motore: quella scritta nello stile e, se il
    /// motore la espone, quella calcolata. Se le due divergono, o la calcolata manca, il valore
    /// non e' arrivato a schermo.
    _leggiOpacita(elemento) {
        if (elemento == null) {
            return null;
        }

        let calcolata = null;
        try {
            calcolata = typeof getComputedStyle === "function" ? getComputedStyle(elemento).opacity : "n/d";
        }
        catch (err) {
            calcolata = "errore";
        }

        let scritta = null;
        try {
            scritta = elemento.style.opacity;
        }
        catch (err) {
            scritta = "errore";
        }

        return scritta + "/" + calcolata;
    },

    _spegniInterazione(elemento) {
        try {
            elemento.style.pointerEvents = "none";
            elemento.style.cursor = "default";

            const figli = elemento.querySelectorAll("img, button, sp-action-button, sp-button, input");
            for (let i = 0; i < figli.length; i++) {
                figli[i].style.pointerEvents = "none";
                figli[i].style.cursor = "default";

                if (figli[i].tagName !== "IMG") {
                    figli[i].disabled = true;
                }
            }
        }
        catch (err) {
            console.error("Interazione non disattivata durante la dissolvenza:", err);
        }
    },

    _rigaDelPayload(payloadId) {
        if (!payloadId) {
            return null;
        }

        try {
            return document.querySelector('[data-payload-id="' + payloadId + '"]');
        }
        catch (err) {
            console.error("Riga della segnalazione non trovata:", err);
            return null;
        }
    },

    /// La riga se ne va sotto gli occhi dell'operatore, e solo dopo cambia lo stato. Se la riga
    /// non si trova, il lavoro si fa lo stesso: l'effetto e' un di piu', non una condizione.
    async _dissolviRiga(payloadId) {
        const riga = this._rigaDelPayload(payloadId);
        if (riga == null) {
            this._tracciaScheda("dissolvenza:rigaNonTrovata", { payloadId });
            return false;
        }

        const esito = await this._dissolviElementi(riga);

        //Sfumata, la riga se ne va subito. Dopo vengono il salvataggio del report, che e' un
        //file grosso, e il ridisegno di tutto l'elenco: se la riga restasse li' sbiancata ad
        //aspettarli, fra la dissolvenza e la sparizione ci sarebbe un istante di vuoto.
        this._removeConfrontoRow(payloadId);
        await this._lasciaRidisegnare();

        return esito;
    },

    //Quanto si aspetta perche' UXP porti a schermo una rimozione prima che parta del lavoro
    //sincrono. Un solo giro del ciclo degli eventi non basta: il ridisegno arriva al confine
    //del fotogramma, e con zero millisecondi il lavoro pesante lo scavalca.
    ATTESA_RIDISEGNO_MS: 40,

    /// Cede il passo al motore. UXP ridisegna solo quando il ciclo degli eventi e' libero:
    /// togliere un elemento e subito dopo salvare un file da undici megabyte e ricostruire
    /// l'elenco vuol dire che l'elemento tolto resta a schermo finche' tutto quello non e'
    /// finito. E' il divario che si vedeva fra la dissolvenza e la sparizione.
    _lasciaRidisegnare() {
        return new Promise(resolve => setTimeout(resolve, this.ATTESA_RIDISEGNO_MS));
    },

    _refreshCambiatiVisibility() {
        const filter = this._getConfrontoVisibilityFilter();
        const $content = $(this._confrontoCambiatiContent);
        const $rows = $content.find('[data-record-type="cambiato"][data-payload-id]');

        $rows.each((index, el) => {
            const payloadId = el.dataset.payloadId;
            const payload = this._getConfrontoPayload(payloadId);

            if (!payload) {
                $(el).hide();
                return;
            }

            const isHidden = !!payload.hidden;

            let mustShow = false;
            if (filter === "visible") {
                mustShow = !isHidden;
            } else if (filter === "hidden") {
                mustShow = isHidden;
            } else {
                mustShow = true;
            }

            if (mustShow) {
                $(el).css("display", "flex");
            } else {
                $(el).hide();
            }
        });

        this._refreshCambiatiPageHeaders();
    },

    _crPageHiddenNotice(pageNumber, recordType) {
        const el = document.createElement("div");
        el.textContent = "Ci sono elementi nascosti dalle attuali impostazioni di visualizzazione";
        el.dataset.pageHiddenNotice = "true";
        el.dataset.pageNumber = String(pageNumber);
        el.dataset.recordType = recordType;

        el.style.display = "none";
        el.style.padding = "8px";
        el.style.border = "1px dashed #666";
        el.style.borderRadius = "4px";
        el.style.opacity = "0.8";
        el.style.fontSize = "11px";
        el.style.flexShrink = "0";

        return el;
    },

    _refreshCambiatiPageHeaders() {
        const $content = $(this._confrontoCambiatiContent);
        const filter = this._getConfrontoVisibilityFilter();

        const $headers = $content.find('[data-page-header="true"][data-record-type="cambiato"]');

        $headers.each((index, headerEl) => {
            const pageNumber = headerEl.dataset.pageNumber;

            const $header = $(headerEl);
            const $notice = $content.find(
                `[data-page-hidden-notice="true"][data-record-type="cambiato"][data-page-number="${pageNumber}"]`
            ).first();

            const $rows = $content.find(
                `[data-record-type="cambiato"][data-page-number="${pageNumber}"][data-payload-id]`
            );

            let totalRows = 0;
            let visibleRows = 0;
            let hiddenRows = 0;
            let shownRows = 0;

            $rows.each((i, rowEl) => {
                totalRows++;
                const payloadId = rowEl.dataset.payloadId;
                const payload = this._getConfrontoPayload(payloadId);

                if (!payload) {
                    return;
                }

                const isHidden = !!payload.hidden;
                if (isHidden) hiddenRows++;
                else visibleRows++;

                const isCurrentlyShown = rowEl.style.display !== "none";
                if (isCurrentlyShown) shownRows++;
            });

            if (totalRows === 0) {
                $header.hide();
                $notice.hide();
                return;
            }

            let showNotice = false;

            if (filter === "visible" && hiddenRows > 0 && shownRows === 0) {
                showNotice = true;
            }

            if (filter === "hidden" && visibleRows > 0 && shownRows === 0) {
                showNotice = true;
            }

            if (shownRows > 0 || showNotice) {
                $header.show();
            } else {
                $header.hide();
            }

            if (showNotice) {
                $notice.show();
            } else {
                $notice.hide();
            }
        });
    },

    _removeConfrontoRow(payloadId) {
        const row = document.querySelector(`[data-payload-id="${payloadId}"]`);
        if (!row) return;

        const pageNumber = row.dataset.pageNumber;
        const recordType = row.dataset.recordType;

        row.remove();

        if (!pageNumber || !recordType) return;

        const remainingRows = document.querySelectorAll(
            `[data-page-number="${pageNumber}"][data-record-type="${recordType}"][data-payload-id]`
        );

        if (remainingRows.length === 0) {
            const pageHeader = document.querySelector(
                `[data-page-header="true"][data-page-number="${pageNumber}"][data-record-type="${recordType}"]`
            );
            if (pageHeader) {
                pageHeader.remove();
            }
        }

        this._refreshCambiatiVisibility();
    },

    _truncate(text, maxLen) {
        const value = String(text ?? "");
        if (value.length <= maxLen) return value;
        return value.slice(0, maxLen) + "...";
    },

    _crTabRoot() {
        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.flex = "1 1 auto";
        root.style.minHeight = "0";
        root.style.height = "100%";
        root.style.overflow = "hidden";
        root.style.boxSizing = "border-box";

        const header = document.createElement("div");
        header.style.display = "flex";
        //I20-981: quattro linguette con il conteggio non stanno su una riga sola in un pannello
        //stretto: vanno a capo invece di uscire.
        header.style.flexWrap = "wrap";
        header.style.rowGap = "4px";
        header.style.gap = "6px";
        header.style.padding = "0 0 8px 0";
        header.style.flexShrink = "0";
        header.style.boxSizing = "border-box";
        header.style.backgroundColor = "#e0eef4";


        const content = document.createElement("div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.flex = "1 1 auto";
        content.style.minHeight = "0";
        content.style.overflow = "hidden";
        //content.style.paddingTop = "8px";
        content.style.boxSizing = "border-box";

        root.appendChild(header);
        root.appendChild(content);

        return { root, header, content };
    },

    //Il nome semplice serve al suggerimento: sull'etichetta c'e' anche il conteggio, e
    //"Mostra cambiati (12)" si leggerebbe male.
    _crTabButton(label, active = false, nomeSemplice = null) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.type = "button";
        Utility.impostaTooltip(btn, "Mostra " + String(nomeSemplice || label || "").toLowerCase());
        btn.style.padding = "6px 10px";
        btn.style.border = "1px solid #666";
        btn.style.borderRadius = "4px";
        btn.style.cursor = "pointer";
        btn.style.opacity = active ? "1" : "0.7";
        btn.style.fontWeight = active ? "700" : "400";
        return btn;
    },

    _crPanel() {
        const panel = document.createElement("div");
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.flex = "1 1 auto";
        panel.style.minHeight = "0";
        panel.style.height = "100%";
        panel.style.overflow = "hidden";
        panel.style.boxSizing = "border-box";
        return panel;
    },

    _stylePanelForReportListMode(panel) {
        if (!panel) return;

        if (this._confrontoReportState?.activeList === "whitelist") {
            panel.style.backgroundColor = "#fff4d8";
            panel.style.padding = "6px";
        }
    },

    _crTabTopbar() {
        const topbar = document.createElement("div");
        topbar.style.display = "flex";
        topbar.style.alignItems = "center";
        topbar.style.gap = "8px";
        topbar.style.padding = "8px 0";
        topbar.style.borderBottom = "1px solid #555";
        topbar.style.flexShrink = "0";
        topbar.style.boxSizing = "border-box";
        topbar.style.width = "100%";
        return topbar;
    },

    _crScrollableContent() {
        const content = document.createElement("div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "6px";
        content.style.flex = "1 1 auto";
        content.style.minHeight = "0";
        content.style.minWidth = "0";
        content.style.overflowY = "scroll";
        content.style.overflowX = "hidden";
        content.style.padding = "8px 0";
        content.id = "confrontoContent";

        return content;
    },

    _crPageHeader(pageNumber, recordType) {
        const el = document.createElement("div");
        el.textContent = `Pagina ${pageNumber}`;
        el.dataset.pageHeader = "true";
        el.dataset.pageNumber = String(pageNumber);
        el.dataset.recordType = recordType;
        el.style.fontWeight = "700";
        el.style.fontSize = "12px";
        el.style.letterSpacing = "0.4px";
        el.style.textTransform = "uppercase";
        el.style.padding = "6px 8px";
        el.style.marginTop = "10px";
        el.style.marginBottom = "2px";
        el.style.borderBottom = "2px solid #8ab661";
        el.style.flexShrink = "0";
        el.style.backgroundColor = "#eef7e3";
        return el;
    },

    //I20-981: il codice gruppo si copia con un clic.
    //Un codice gruppo e' l'elenco dei membri separati da virgola: copiato cosi' com'e' si
    //incolla nella ricerca del revisore, che e' il motivo per cui serve.
    _crCodiceGruppo(codiceGruppo) {
        const testo = String(codiceGruppo == null ? "" : codiceGruppo);

        const elemento = document.createElement("div");
        elemento.textContent = this._truncate(testo || "-", 20);
        elemento.style.fontWeight = "600";
        elemento.style.whiteSpace = "nowrap";
        elemento.style.overflow = "hidden";
        elemento.style.textOverflow = "ellipsis";
        elemento.style.minWidth = "0";

        if (testo === "") {
            return elemento;
        }

        Utility.impostaTooltip(elemento, "Clicca per copiare i codici del gruppo: " + testo);
        elemento.style.cursor = "pointer";
        elemento.style.textDecoration = "underline dotted";

        elemento.addEventListener("click", () => this.copiaCodiceGruppo(testo));

        return elemento;
    },

    copiaCodiceGruppo(codiceGruppo) {
        const testo = String(codiceGruppo == null ? "" : codiceGruppo);
        if (testo === "") {
            return;
        }

        try {
            //writeText vuole una stringa: passargli un oggetto, come si fa in qualche altro
            //punto del plugin, finisce per copiare "[object Object]".
            navigator.clipboard.writeText(testo);
            messaggioUtente("Codici del gruppo copiati negli appunti", "success", false, 2);
        }
        catch (err) {
            console.error("Errore durante la copia del codice gruppo:", err);
            messaggioUtente("Code CNF-022: Non e' stato possibile copiare i codici del gruppo", "error", false, 6);
        }
    },

    //I20-981: una riga porta sul fianco il colore del suo stato.
    //Scorrendo un elenco lungo il colore dice a che categoria appartiene la riga senza doverla
    //leggere: e' la differenza fra cercare e vedere.
    COLORI_STATO: {
        cambiato: "#e0a800",
        uscito: "#c0392b",
        nuovo: "#2e7d32",
        differente: "#1565c0"
    },

    //I20-981: il riquadro che raccoglie le differenze sui campi osservati dentro una riga.
    //Sta staccato dalle segnalazioni di integrita' e porta il colore dei confronti, cosi' si
    //capisce a colpo d'occhio che parla di un'altra cosa.
    _crRiquadroConfronto(differenze) {
        const riquadro = document.createElement("div");
        riquadro.style.marginTop = "6px";
        riquadro.style.padding = "4px 6px";
        riquadro.style.borderLeft = "3px solid " + this.COLORI_STATO.differente;
        riquadro.style.backgroundColor = "#eef3fb";
        riquadro.style.borderRadius = "3px";
        riquadro.style.minWidth = "0";

        const titolo = document.createElement("div");
        titolo.textContent = "Campi osservati (confronto)";
        titolo.style.fontSize = "10px";
        titolo.style.fontWeight = "700";
        titolo.style.letterSpacing = "0.3px";
        titolo.style.textTransform = "uppercase";
        titolo.style.color = this.COLORI_STATO.differente;
        titolo.style.marginBottom = "2px";
        Utility.impostaTooltip(titolo, "Campi che non cambiano il box ma che decidono a che pagina va la referenza");
        riquadro.appendChild(titolo);

        (differenze || []).forEach(differenza => {
            const riga = document.createElement("div");
            riga.style.fontSize = "11px";
            riga.style.lineHeight = "1.3";
            riga.style.whiteSpace = "normal";
            riga.style.overflowWrap = "anywhere";
            riga.style.minWidth = "0";

            const campo = document.createElement("span");
            campo.textContent = differenza?.label || "";
            campo.style.fontWeight = "600";
            riga.appendChild(campo);
            riga.appendChild(document.createTextNode(": " + (differenza?.difference || "")));

            riquadro.appendChild(riga);
        });

        return riquadro;
    },

    _crRow(stato = null) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexDirection = "row";
        row.style.alignItems = "start";
        row.style.gap = "10px";
        row.style.padding = "8px";
        row.style.border = "1px solid #444";
        row.style.borderLeft = "4px solid " + (this.COLORI_STATO[stato] || "#444");
        row.style.borderRadius = "4px";
        row.style.boxSizing = "border-box";
        row.style.width = "100%";

        // QUESTO è il punto importante
        row.style.flexShrink = "0";
        row.style.flexGrow = "0";
        row.style.flexBasis = "auto";

        return row;
    },

    _crButton(label, iconPath = null) {
        const btn = document.createElement("button");
        btn.type = "button";
        Utility.impostaTooltip(btn, label);
        btn.style.cursor = "pointer";
        btn.style.padding = "4px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.minWidth = "28px";
        btn.style.minHeight = "28px";
        btn.style.boxSizing = "border-box";

        if (iconPath) {
            const img = document.createElement("img");
            img.src = iconPath;
            img.alt = label;
            Utility.impostaTooltip(img, label);
            img.style.height = "16px";
            img.style.width = "auto";
            img.style.display = "block";
            Utility.impostaTooltip(btn, label);
            btn.appendChild(img);
        } else {
            btn.textContent = label;
            btn.style.padding = "4px 8px";
        }

        return btn;
    },

    _crEmptyState(text) {
        const el = document.createElement("div");
        el.textContent = text;
        el.style.padding = "12px 8px";
        el.style.opacity = "0.7";
        return el;
    },

    _crIconButton(label, iconPath) {
        const img = document.createElement("img");

        img.src = iconPath;
        img.alt = label;
        Utility.impostaTooltip(img, label);
        img.onerror = () => {
            if (iconPath.indexOf("risolviSegnalazioni.png") >= 0) img.src = "images/check.png";
            else if (iconPath.indexOf("whitelist.png") >= 0) img.src = "images/wake.png";
            else if (iconPath.indexOf("rimuoviWhitelist.png") >= 0) img.src = "images/sleep.png";
        };

        //img.style.width = "50px";
        img.style.height = "30px";
        img.style.padding = "4px";
        img.style.boxSizing = "content-box";

        img.style.border = "1px solid #666";
        img.style.borderRadius = "4px";
        img.style.cursor = "pointer";
        //img.style.background = "#827f7f";

        img.style.display = "inline-block";
        img.style.userSelect = "none";

        return img;
    },

    _confrontoListeUi: null,

    _buildPanelConfronti() {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);

        const topbar = this._crTabTopbar();
        topbar.style.flexWrap = "wrap";

        const pickerLavorazioni = document.createElement("sp-picker");
        pickerLavorazioni.style.minWidth = "220px";
        const menuLavorazioni = document.createElement("sp-menu");
        menuLavorazioni.setAttribute("slot", "options");
        pickerLavorazioni.appendChild(menuLavorazioni);
        Utility.impostaTooltip(pickerLavorazioni, "Le lavorazioni della stessa promo: da una di queste si scarica la lista da confrontare");

        const btnScarica = this._crButton("Scarica lista");
        Utility.impostaTooltip(btnScarica, "Scarica la lista della lavorazione scelta e confrontala con quella corrente");
        const btnLocale = this._crButton("Apri json locale");
        Utility.impostaTooltip(btnLocale, "Confronta con una lista salvata in un file listaKit json");
        const btnCsv = this._crButton("Scarica CSV confronto");
        Utility.impostaTooltip(btnCsv, "Scarica in csv le righe del confronto, con i filtri attivi");

        topbar.appendChild(pickerLavorazioni);
        topbar.appendChild(btnScarica);
        topbar.appendChild(btnLocale);
        topbar.appendChild(btnCsv);

        //I filtri: presenze, canali, campi. Alla maniera di un foglio di calcolo: si spegne
        //quello che non si vuole vedere, e si riaccende.
        const filtro = this.filtroConfrontoCorrente();

        const barraFiltri = document.createElement("div");
        barraFiltri.style.display = "flex";
        barraFiltri.style.flexWrap = "wrap";
        barraFiltri.style.alignItems = "center";
        barraFiltri.style.gap = "10px";
        barraFiltri.style.padding = "6px 0";
        barraFiltri.style.borderBottom = "1px solid #555";
        barraFiltri.style.flexShrink = "0";
        barraFiltri.style.fontSize = "11px";

        const pickerPresenza = this._crPickerPresenza(filtro.presenza);
        pickerPresenza.addEventListener("change", (ev) => {
            this.filtroConfrontoCorrente().presenza = ev.target.value || reportConfronti.FILTRO_PRESENZA.tutte;
            this._ridisegnaConfrontoListe();
        });

        const interruttoreOsservati = this._crInterruttore("Campi osservati", filtro.canali.osservato !== false, (acceso) => {
            this.filtroConfrontoCorrente().canali.osservato = acceso;
            this._ridisegnaConfrontoListe();
        });
        const interruttoreCompilati = this._crInterruttore("Campi compilati", filtro.canali.compilato !== false, (acceso) => {
            this.filtroConfrontoCorrente().canali.compilato = acceso;
            this._ridisegnaConfrontoListe();
        });

        const btnCampi = this._crButton("Campi...");
        Utility.impostaTooltip(btnCampi, "Scegli quali campi vedere");

        const pannelloCampi = document.createElement("div");
        pannelloCampi.style.display = "none";
        pannelloCampi.style.flexWrap = "wrap";
        pannelloCampi.style.gap = "8px 14px";
        pannelloCampi.style.padding = "6px 8px";
        pannelloCampi.style.borderBottom = "1px solid #555";
        pannelloCampi.style.flexShrink = "0";
        pannelloCampi.style.fontSize = "11px";

        btnCampi.addEventListener("click", () => {
            pannelloCampi.style.display = pannelloCampi.style.display === "none" ? "flex" : "none";
        });

        barraFiltri.appendChild(pickerPresenza);
        barraFiltri.appendChild(interruttoreOsservati);
        barraFiltri.appendChild(interruttoreCompilati);
        barraFiltri.appendChild(btnCampi);

        const content = this._crScrollableContent();

        panel.appendChild(topbar);
        panel.appendChild(barraFiltri);
        panel.appendChild(pannelloCampi);
        panel.appendChild(content);

        this._confrontoListeUi = {
            pickerLavorazioni,
            menuLavorazioni,
            btnScarica,
            btnLocale,
            btnCsv,
            pickerPresenza,
            pannelloCampi,
            content,
            tab: null
        };

        btnScarica.addEventListener("click", () => this._scaricaListaConfrontoScelta());
        btnLocale.addEventListener("click", () => this._apriListaConfrontoLocale());
        btnCsv.addEventListener("click", () => this._scaricaCsvConfrontoListe());

        this._riempiPickerLavorazioni();
        this._ridisegnaConfrontoListe();

        return panel;
    },

    _crPickerPresenza(valore) {
        const picker = document.createElement("sp-picker");
        picker.style.minWidth = "170px";
        const menu = document.createElement("sp-menu");
        menu.setAttribute("slot", "options");

        [
            { valore: reportConfronti.FILTRO_PRESENZA.tutte, testo: "Tutte le referenze" },
            { valore: reportConfronti.FILTRO_PRESENZA.comuni, testo: "Solo in comune" },
            { valore: reportConfronti.FILTRO_PRESENZA.soloUna, testo: "Solo in una lista" }
        ].forEach(voce => {
            const item = document.createElement("sp-menu-item");
            item.value = voce.valore;
            item.textContent = voce.testo;
            if (voce.valore === valore) {
                item.setAttribute("selected", "selected");
            }
            menu.appendChild(item);
        });

        picker.appendChild(menu);
        Utility.impostaTooltip(picker, "Quali referenze vedere: tutte, solo quelle in comune alle due liste, solo quelle presenti in una sola");
        return picker;
    },

    _crInterruttore(testo, acceso, alCambio) {
        const etichetta = document.createElement("label");
        etichetta.style.display = "flex";
        etichetta.style.alignItems = "center";
        etichetta.style.gap = "4px";
        etichetta.style.cursor = "pointer";
        etichetta.style.whiteSpace = "nowrap";

        const casella = document.createElement("input");
        casella.type = "checkbox";
        casella.checked = acceso === true;
        casella.addEventListener("change", () => alCambio(casella.checked === true));

        etichetta.appendChild(casella);
        etichetta.appendChild(document.createTextNode(testo));
        return etichetta;
    },

    /// Il pannello dei campi: una casella per ogni campo che ha qualcosa da mostrare, per
    /// canale, con "tutti" e "nessuno". Un campo spento non si vede in nessuna riga.
    _riempiPannelloCampi() {
        const ui = this._confrontoListeUi;
        if (ui == null || ui.pannelloCampi == null) {
            return;
        }

        const pannello = ui.pannelloCampi;
        pannello.innerHTML = "";

        const disponibili = reportConfronti.campiDisponibili(this._vociConfrontoListe || []);
        const filtro = this.filtroConfrontoCorrente();

        if (disponibili.length === 0) {
            const vuoto = document.createElement("div");
            vuoto.textContent = "Nessun campo con differenze";
            vuoto.style.opacity = "0.7";
            pannello.appendChild(vuoto);
            return;
        }

        const accesi = new Set(filtro.campi == null ? disponibili.map(c => String(c.campo)) : filtro.campi.map(String));

        const applica = () => {
            //Tutti accesi vale "nessun filtro": cosi' un campo nuovo, la prossima volta, entra.
            filtro.campi = accesi.size === disponibili.length ? null : Array.from(accesi);
            this._ridisegnaConfrontoListe(false);
        };

        const comandi = document.createElement("div");
        comandi.style.display = "flex";
        comandi.style.gap = "6px";
        comandi.style.width = "100%";

        const btnTutti = this._crButton("Tutti");
        btnTutti.addEventListener("click", () => {
            disponibili.forEach(c => accesi.add(String(c.campo)));
            applica();
            this._riempiPannelloCampi();
        });
        const btnNessuno = this._crButton("Nessuno");
        btnNessuno.addEventListener("click", () => {
            accesi.clear();
            applica();
            this._riempiPannelloCampi();
        });
        comandi.appendChild(btnTutti);
        comandi.appendChild(btnNessuno);
        pannello.appendChild(comandi);

        [reportConfronti.CANALE.osservato, reportConfronti.CANALE.compilato].forEach(canale => {
            const delCanale = disponibili.filter(c => c.canale === canale);
            if (delCanale.length === 0) {
                return;
            }

            const gruppo = document.createElement("div");
            gruppo.style.display = "flex";
            gruppo.style.flexWrap = "wrap";
            gruppo.style.gap = "6px 14px";
            gruppo.style.width = "100%";

            const titolo = document.createElement("div");
            titolo.textContent = reportConfronti.descriviCanale(canale) + ":";
            titolo.style.fontWeight = "700";
            titolo.style.width = "100%";
            gruppo.appendChild(titolo);

            delCanale.forEach(campo => {
                gruppo.appendChild(this._crInterruttore(campo.etichetta || campo.campo, accesi.has(String(campo.campo)), (acceso) => {
                    if (acceso) {
                        accesi.add(String(campo.campo));
                    }
                    else {
                        accesi.delete(String(campo.campo));
                    }
                    applica();
                }));
            });

            pannello.appendChild(gruppo);
        });
    },

    /// Ridisegna la sola scheda Confronti: cambiare un filtro non deve rifare tutto il report.
    _ridisegnaConfrontoListe(anchePannelloCampi = true) {
        const ui = this._confrontoListeUi;
        if (ui == null || ui.content == null) {
            return;
        }

        if (anchePannelloCampi) {
            this._riempiPannelloCampi();
        }

        const content = ui.content;
        content.innerHTML = "";

        const voci = this._vociConfrontoFiltrate();

        if (ui.tab != null) {
            ui.tab.textContent = this._listaConfronto == null
                ? "Confronti"
                : reportConteggi.etichettaLinguetta("Confronti", voci.length);
        }

        if (this._listaConfronto == null) {
            content.appendChild(this._crEmptyState("Nessuna lista di confronto selezionata"));

            const nota = document.createElement("div");
            nota.textContent = "Scegli una lavorazione della stessa promo e scarica la sua lista, oppure apri un listaKit json. "
                + "Le differenze della lista con se stessa stanno nella scheda Cambiati, nel riquadro \"Campi osservati\".";
            nota.style.padding = "0 8px 12px 8px";
            nota.style.fontSize = "11px";
            nota.style.opacity = "0.8";
            nota.style.whiteSpace = "normal";
            content.appendChild(nota);
            return;
        }

        content.appendChild(this._crIdentitaConfronto());

        if (voci.length === 0) {
            content.appendChild(this._crEmptyState("Nessuna differenza con i filtri scelti"));
            return;
        }

        voci.forEach(voce => content.appendChild(this._crRigaConfrontoListe(voce)));
    },

    /// Cosa si sta confrontando con cosa: sopra l'elenco, sempre visibile.
    _crIdentitaConfronto() {
        const riga = document.createElement("div");
        riga.style.padding = "4px 8px 8px 8px";
        riga.style.fontSize = "11px";
        riga.style.whiteSpace = "normal";
        riga.style.overflowWrap = "anywhere";
        riga.style.borderBottom = "1px solid #ccc";
        riga.style.marginBottom = "4px";
        riga.style.width = "100%";
        riga.style.boxSizing = "border-box";
        //Come per le righe del report: dentro una colonna flex, in UXP, un figlio senza queste
        //tre regole viene schiacciato e finisce sopra il vicino. Qui l'intestazione si
        //sovrapponeva alla prima riga dei risultati, e non si leggeva nessuna delle due.
        riga.style.flexShrink = "0";
        riga.style.flexGrow = "0";
        riga.style.flexBasis = "auto";

        const corrente = document.createElement("div");
        corrente.appendChild(this._crEtichettaForte("Lista corrente: "));
        corrente.appendChild(document.createTextNode(this._descriviListaConfronto(this._identitaListaCorrente())));

        const altra = document.createElement("div");
        altra.appendChild(this._crEtichettaForte("Altra lista: "));
        altra.appendChild(document.createTextNode(this._descriviListaConfronto(this._listaConfronto)));

        const filtro = document.createElement("div");
        filtro.style.opacity = "0.8";
        filtro.textContent = "Filtri: " + reportConfronti.descriviFiltro(
            this.filtroConfrontoCorrente(), reportConfronti.campiDisponibili(this._vociConfrontoListe || []));

        riga.appendChild(corrente);
        riga.appendChild(altra);
        riga.appendChild(filtro);
        return riga;
    },

    _crEtichettaForte(testo) {
        const span = document.createElement("span");
        span.textContent = testo;
        span.style.fontWeight = "700";
        return span;
    },

    _crRigaConfrontoListe(voce) {
        const row = this._crRow("differente");
        row.dataset.codiceGruppo = voce.codiceGruppo;

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.flexDirection = "column";
        left.style.gap = "4px";
        left.style.flex = "1 1 auto";
        left.style.minWidth = "0";
        left.style.overflow = "hidden";

        const testata = document.createElement("div");
        testata.style.display = "flex";
        testata.style.alignItems = "center";
        testata.style.gap = "8px";
        testata.style.minWidth = "0";
        testata.appendChild(this._crCodiceGruppo(voce.codiceGruppo));

        const stato = document.createElement("span");
        stato.textContent = reportConfronti.descriviPresenza(voce.presenza);
        stato.style.fontSize = "10px";
        stato.style.fontWeight = "700";
        stato.style.padding = "1px 6px";
        stato.style.borderRadius = "10px";
        stato.style.backgroundColor = voce.presenza === reportConfronti.PRESENZA.entrambe ? "#eef3fb" : "#fbeeee";
        stato.style.whiteSpace = "nowrap";
        testata.appendChild(stato);
        left.appendChild(testata);

        const descrizione = document.createElement("div");
        descrizione.textContent = this._getDescrizioneNuovo(voce.rawCorrente || voce.rawAltra || {}) || "";
        descrizione.style.fontSize = "11px";
        descrizione.style.whiteSpace = "normal";
        descrizione.style.overflowWrap = "anywhere";
        left.appendChild(descrizione);

        (voce.differenze || []).forEach(d => {
            const riga = document.createElement("div");
            riga.style.fontSize = "11px";
            riga.style.lineHeight = "1.3";
            riga.style.whiteSpace = "normal";
            riga.style.overflowWrap = "anywhere";
            riga.dataset.canale = d.canale;
            riga.dataset.campo = d.campo;

            const canale = document.createElement("span");
            canale.textContent = d.canale === reportConfronti.CANALE.compilato ? "compilato" : "osservato";
            canale.style.fontSize = "9px";
            canale.style.opacity = "0.7";
            canale.style.marginRight = "6px";
            riga.appendChild(canale);

            const campo = document.createElement("span");
            campo.textContent = d.etichetta || d.campo;
            campo.style.fontWeight = "600";
            riga.appendChild(campo);

            riga.appendChild(document.createTextNode(": " + (d.corrente || "(vuoto)") + " ↔ " + (d.altra || "(vuoto)")));
            Utility.impostaTooltip(riga, "Lista corrente: " + (d.corrente || "(vuoto)") + "\nAltra lista: " + (d.altra || "(vuoto)"));
            left.appendChild(riga);
        });

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.flexShrink = "0";
        actions.style.alignItems = "flex-start";
        actions.style.gap = "6px";

        //La referenza che sta nella lista corrente puo' essere in pagina: la si cerca come fa il
        //report. Quella che sta solo nell'altra lista in questo documento non c'e'.
        if (voce.presenza !== reportConfronti.PRESENZA.soloAltra) {
            const btnFind = this._crIconButton("Trova", "images/leggiLog.png");
            btnFind.addEventListener("click", () => {
                this._findElemento({ record: { codiceGruppo: voce.codiceGruppo } });
            });
            actions.appendChild(btnFind);
        }

        const btnInfo = this._crIconButton("Info", "images/info.png");
        btnInfo.addEventListener("click", () => {
            this._openInfoReportRecord({ raw: voce.rawCorrente || voce.rawAltra, codiceGruppo: voce.codiceGruppo });
        });
        actions.appendChild(btnInfo);

        row.appendChild(left);
        row.appendChild(actions);
        return row;
    },

    async _riempiPickerLavorazioni() {
        const ui = this._confrontoListeUi;
        if (ui == null || ui.menuLavorazioni == null) {
            return;
        }

        const menu = ui.menuLavorazioni;
        menu.innerHTML = "";

        const primo = document.createElement("sp-menu-item");
        primo.value = "";
        primo.textContent = "Scegli una lavorazione della promo";
        primo.setAttribute("selected", "selected");
        menu.appendChild(primo);

        const risposta = await this._lavorazioniDellaPromo();

        if (risposta == null) {
            const voce = document.createElement("sp-menu-item");
            voce.value = "";
            voce.textContent = "Elenco non disponibile";
            voce.setAttribute("disabled", "disabled");
            menu.appendChild(voce);
            return;
        }

        risposta.lavorazioni.filter(l => l.corrente !== true).forEach(l => {
            const voce = document.createElement("sp-menu-item");
            voce.value = String(l.id);
            voce.textContent = l.titolo + " (" + l.id + ", " + this._dataBreve(l.registerDate) + ")";
            menu.appendChild(voce);
        });
    },

    _dataBreve(valore) {
        try {
            const data = new Date(valore);
            return isNaN(data.getTime()) ? "" : data.toLocaleDateString("it-IT");
        }
        catch (err) {
            return "";
        }
    },

    _buildPanelNuovi(report) {
        const panel = this._crPanel();
        this._stylePanelForReportListMode(panel);
        const topbar = this._crTabTopbar();

        const btnImpaginaTutti = this._crButton("Impagina in coda");
        Utility.impostaTooltip(btnImpaginaTutti, "Impagina tutto in coda al documento");

        const pickerLibreria = document.createElement("sp-picker");
        pickerLibreria.style.minWidth = "220px";

        const menuLibreria = document.createElement("sp-menu");
        menuLibreria.setAttribute("slot", "options");
        pickerLibreria.appendChild(menuLibreria);

        const btnRefreshLibreria = this._crIconButton("Refresh libreria", "images/refresh.png");

        topbar.appendChild(btnImpaginaTutti);
        topbar.appendChild(pickerLibreria);
        topbar.appendChild(btnRefreshLibreria);

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.flex = "1 1 auto";
        wrapper.style.minHeight = "0";
        wrapper.style.minWidth = "0";
        wrapper.style.overflow = "hidden";

        const tableScroll = document.createElement("div");
        tableScroll.style.flex = "1 1 auto";
        tableScroll.style.minHeight = "0";
        tableScroll.style.minWidth = "0";
        //I20-981: in orizzontale questo contenitore non scorre, in nessun modo nativo: ne' con
        //"auto", ne' con "scroll", nemmeno dando alla tabella una larghezza vera in pixel. Lo
        //scorrimento laterale lo fa la barra qui sotto, spostando la tabella; qui resta il solo
        //scorrimento verticale, che invece funziona ed e' quello della rotella.
        tableScroll.style.overflowX = "hidden";
        tableScroll.style.overflowY = "scroll";
        tableScroll.style.border = "1px solid #555";
        tableScroll.style.borderRadius = "4px";

        //I20-981: la tabella e' divisa in due colonne dentro l'unico contenitore che scorre in
        //verticale: a sinistra i pulsanti di impaginazione, a larghezza fissa, che restano
        //fermi; a destra i dati, che sono i soli a spostarsi di lato. Stando nello stesso
        //contenitore le due colonne scorrono insieme in verticale per costruzione, e le righe
        //restano appaiate grazie alle altezze fisse gia' in uso: 42px la riga, 34px
        //l'intestazione.
        const divisione = document.createElement("div");
        divisione.style.display = "flex";
        divisione.style.flexDirection = "row";
        divisione.style.alignItems = "flex-start";
        divisione.style.minWidth = "100%";

        const colonnaAzioni = document.createElement("div");
        colonnaAzioni.style.display = "flex";
        colonnaAzioni.style.flexDirection = "column";
        colonnaAzioni.style.flexShrink = "0";
        colonnaAzioni.style.borderRight = "2px solid #bbb";

        const headerAzioni = document.createElement("div");
        headerAzioni.style.display = "flex";
        headerAzioni.style.flexShrink = "0";

        const bodyAzioni = document.createElement("div");
        bodyAzioni.style.display = "flex";
        bodyAzioni.style.flexDirection = "column";

        colonnaAzioni.appendChild(headerAzioni);
        colonnaAzioni.appendChild(bodyAzioni);

        //L'area dei dati e' la finestra dello scorrimento laterale: quello che esce di qui
        //resta nascosto, e la sua larghezza e' la misura che dice alla barra quanto si vede.
        const areaDati = document.createElement("div");
        areaDati.style.flex = "1 1 auto";
        areaDati.style.minWidth = "0";
        areaDati.style.overflow = "hidden";

        //I20-981: la larghezza della tabella dei dati si dichiara in pixel, sommando le
        //colonne. Era scritta "fit-content", e senza una larghezza vera non c'e' nulla da
        //scorrere: la tabella si schiaccia nello spazio disponibile. Il minWidth al 100%
        //serve per il caso opposto, poche colonne in un pannello largo, dove la tabella deve
        //comunque riempire il riquadro.
        const table = document.createElement("div");
        table.style.display = "flex";
        table.style.flexDirection = "column";
        table.style.alignItems = "flex-start";
        table.style.minWidth = "100%";

        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.flexShrink = "0";
        headerRow.style.minWidth = "100%";

        const body = document.createElement("div");
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.minWidth = "100%";

        table.appendChild(headerRow);
        table.appendChild(body);
        areaDati.appendChild(table);
        divisione.appendChild(colonnaAzioni);
        divisione.appendChild(areaDati);
        tableScroll.appendChild(divisione);
        wrapper.appendChild(tableScroll);

        panel.appendChild(topbar);
        panel.appendChild(wrapper);

        const listaTracciato = this._leggiListaKitLocale();

        const colonneExtra = (pluginMiddleware?.getColonneTracciatoIntestazione?.() || []).map(col => ({
            nome: col?.nome || col?.name || col?.label || col?.chiaveDato || "",
            chiaveDato: col?.chiaveDato || col?.key || "",
            percColonna: Number(col?.percColonna || col?.width || 50)
        }));

        const rowsOriginal = this._confrontoReportState?.activeList === "whitelist"
            ? []
            : this._estraiNuoviDaLista(report, listaTracciato);

        this._confrontoNuoviState = {
            report,
            rowsOriginal,
            rowsCurrent: [...rowsOriginal],
            body,
            headerRow,
            table,
            tableScroll,
            areaDati,
            colonnaAzioni,
            headerAzioni,
            bodyAzioni,
            colonneExtra,
            sortKey: null,
            sortDirection: null,

            pickerLibreria,
            menuLibreria,
            btnRefreshLibreria,
            libreriaCorrente: null,
            elementiLibreria: []
        };

        wrapper.appendChild(this._crBarraScorrimentoNuovi(this._confrontoNuoviState));

        this._renderNuoviTable();
        this._refreshPickerLibreriaNuovi();

        btnRefreshLibreria.addEventListener("click", () => {
            this._refreshPickerLibreriaNuovi();
        });

        pickerLibreria.addEventListener("change", () => {
            const state = this._confrontoNuoviState;
            if (!state) return;
            state.selectedLibraryItemName = pickerLibreria.value || null;
        });

        btnImpaginaTutti.addEventListener("click", async () => {
            try {
                const ok = await this._confirmReportAction("massive", "Impaginare tutti i nuovi elementi in coda al documento?");
                if (ok) {
                    await this._impaginaTuttiNuoviInCoda();
                }
            } catch (err) {
                console.error("Errore impaginazione massiva nuovi:", err);
            }
        });

        return panel;
    },

    _formatSecondsToHuman(seconds) {
        const s = Math.max(0, Math.round(seconds));

        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;

        if (hh > 0) {
            return `${hh}h ${mm}m ${ss}s`;
        }

        if (mm > 0) {
            return `${mm}m ${ss}s`;
        }

        return `${ss}s`;
    },

    async _updateMassiveLoadingNuovi(completati, totale, startedAt, sampleCount = 5) {
        let msg = `Impaginazione nuovi in corso... ${completati}/${totale}`;

        if (completati > 0) {
            const elapsedSec = (Date.now() - startedAt) / 1000;
            const baseCount = Math.min(completati, sampleCount);

            if (baseCount > 0) {
                const avgSec = elapsedSec / completati;
                const remaining = Math.max(0, totale - completati);
                const etaSec = avgSec * remaining;

                msg += `\nTempo trascorso: ${this._formatSecondsToHuman(elapsedSec)}`;
                msg += `\nTempo stimato rimanente: ${this._formatSecondsToHuman(etaSec)}`;
            }
        }

        showLoading(msg);
        await Utility.sleep(1);
    },

    _appendPickerPlaceholder(menu, label) {
        const item = document.createElement("sp-menu-item");
        item.value = "";
        item.textContent = label;
        item.setAttribute("selected", "selected");
        menu.appendChild(item);
    },

    _refreshPickerLibreriaNuovi() {
        const state = this._confrontoNuoviState;
        if (!state || !state.menuLibreria || !state.pickerLibreria) return;

        const menu = state.menuLibreria;
        const picker = state.pickerLibreria;

        menu.innerHTML = "";
        state.libreriaCorrente = null;
        state.elementiLibreria = [];
        state.selectedLibraryItemName = null;

        try {
            var libreria = null;
            try {
                libreria = pluginMiddleware.getLibreria();
            } catch (errLib) {
                console.warn("Libreria configurata non disponibile, uso fallback:", errLib);
                libreria = null;
            }
            if (libreria == null || !libreria.isValid) {
                if (!app.libraries || app.libraries.length === 0) {
                    console.error("Nessuna libreria caricata.");
                    this._appendPickerPlaceholder(menu, "Nessuna libreria");
                    return;
                }

                if (app.libraries.length > 1) {
                    console.error("Sono presenti più librerie caricate. Deve essercene una sola.");
                    this._appendPickerPlaceholder(menu, "Troppe librerie");
                    return;
                }

                var nomeLibreria = "";
                if (nomeLibreria == null) {
                    nomeLibreria = pluginMiddleware.getCampo("nomeLibreriaIndd");
                }
                if (ficoProcess.getTipoLavorazioneCorrente() == 1 && app.libraries.length == 0) {
                    if (nomeLibreria) {
                        messaggioUtente("Code IDX-11 Filtro: Non è stata caricata la libreria " + nomeLibreria, "Error", false, 5);
                    }
                    else {
                        messaggioUtente("Code IDX-12 Filtro: Non è stata caricata nessuna libreria", "Error", false, 5);
                    }
                    hideLoading();

                    cbkEnd?.("error");

                    return;
                }
                else if (nomeLibreria) {
                    //cerchiamo una libreria che abbia nel nome quello specificato
                    // for (var i = 0; i < app.libraries.length; i++) {
                    //     var lib = app.libraries.item(i);
                    //     if (lib.name && lib.name.indexOf(nomeLibreria) === 0) {
                    //         libreria = lib;
                    //         break;
                    //     }
                    // }
                    libreria = app.libraries.itemByName(nomeLibreria);
                }
                else if (app.libraries.length == 1) {
                    libreria = app.libraries.item(0);
                }

                if (libreria == null || !libreria.isValid) {
                    if (nomeLibreria) {
                        messaggioUtente("Code IDX-13 Filtro: Non è stata trovata la libreria " + nomeLibreria, "Error", false, 5);
                    }
                    else if (app.libraries.length > 1) {
                        messaggioUtente("Code IDX-14 Filtro: Sono caricate librerie multiple, chiudere tutte le librerie eccetto quella di impaginazione prima di procedere", "Error", false, 5);
                    }
                    else {
                        messaggioUtente("Code IDX-15 Filtro: Non è stata trovata la libreria", "Error", false, 5);
                    }
                    hideLoading();
                    cbkEnd?.("error");
                    return;
                }
            }

            state.libreriaCorrente = libreria;

            const nomiBaseUnici = new Set();
            let foundAny = false;

            for (let i = 0; i < libreria.assets.length; i++) {
                const asset = libreria.assets.item(i);
                const nomeCompleto = String(asset?.name || "").trim();
                if (!nomeCompleto) continue;

                foundAny = true;
                state.elementiLibreria.push(asset);

                const nomeBase = this._normalizeLibraryGridName(nomeCompleto);
                if (!nomeBase) continue;

                if (nomiBaseUnici.has(nomeBase)) continue;
                nomiBaseUnici.add(nomeBase);

                const item = document.createElement("sp-menu-item");
                item.value = nomeBase;
                item.textContent = nomeBase;

                if (nomiBaseUnici.size === 1) {
                    item.setAttribute("selected", "selected");
                    state.selectedLibraryItemName = nomeBase;
                }

                menu.appendChild(item);
            }

            if (!foundAny) {
                console.error("La libreria è presente ma non contiene elementi.");
                this._appendPickerPlaceholder(menu, "Libreria vuota");
                return;
            }

            if (nomiBaseUnici.size === 0) {
                console.error("La libreria non contiene griglie valide.");
                this._appendPickerPlaceholder(menu, "Nessuna griglia valida");
                return;
            }

            picker.value = state.selectedLibraryItemName || "";

        } catch (err) {
            console.error("Errore durante il refresh della libreria:", err);
            this._appendPickerPlaceholder(menu, "Errore libreria");
        }
    },

    _renderNuoviTable() {
        const state = this._confrontoNuoviState;
        if (!state) return;

        state.headerRow.innerHTML = "";
        state.body.innerHTML = "";

        if (state.headerAzioni != null) state.headerAzioni.innerHTML = "";
        if (state.bodyAzioni != null) state.bodyAzioni.innerHTML = "";

        const colonneBase = [
            {
                key: "__azione__",
                label: "Imp.",
                perc: 55,
                minPx: 130,
                sortable: false
            },
            {
                key: "codiceGruppo",
                label: "Codice gruppo",
                perc: 70,
                minPx: 140,
                sortable: true
            },
            {
                key: "descrizione",
                label: "Descrizione",
                perc: 120,
                minPx: 240,
                sortable: true,
                small: true
            }
        ];

        //I20-981: i campi osservati stanno in fondo a destra: servono quando servono, e non
        //devono rubare spazio a codice e descrizione, che si leggono sempre.
        const colonnaConfronto = {
            key: "confronto",
            label: "Campi osservati",
            perc: 130,
            minPx: 260,
            sortable: true,
            small: true
        };

        const colonneExtra = (state.colonneExtra || []).map(col => ({
            key: col.chiaveDato,
            label: col.nome,
            perc: Number(col.percColonna || 50),
            minPx: Math.max(90, Math.round((Number(col.percColonna || 50) / 50) * 90)),
            sortable: true
        }));

        //rimuoviamo aventuali colonneExtra con chiave codice, descrizione o codiceGruppo se ci sono, per evitare duplicati
        const colonneExtraFiltrate = colonneExtra.filter(col => {
            const key = col.key.toLowerCase();
            return key !== "codicegruppo" && key !== "descrizione" && key !== "codice" && key !== "confronto";
        });

        const colonne = [...colonneBase, ...colonneExtraFiltrate, colonnaConfronto];
        state.colonneRender = colonne;

        //La colonna dei pulsanti sta fuori dallo scorrimento: la larghezza da scorrere e'
        //quella dei soli dati, ed e' la sola che la barra deve conoscere.
        const colonnaAzione = colonne.find(col => col.key === "__azione__");
        const colonneDati = colonne.filter(col => col.key !== "__azione__");

        const larghezzaTotale = this._larghezzaTotaleColonne(colonneDati);
        state.larghezzaTotale = larghezzaTotale;

        if (state.table != null) {
            state.table.style.width = larghezzaTotale + "px";
        }
        state.headerRow.style.width = larghezzaTotale + "px";
        state.body.style.width = larghezzaTotale + "px";

        if (state.headerAzioni != null && colonnaAzione != null) {
            state.headerAzioni.appendChild(this._crNuoviHeaderCell(colonnaAzione));
        }

        for (let i = 0; i < colonneDati.length; i++) {
            state.headerRow.appendChild(this._crNuoviHeaderCell(colonneDati[i]));
        }

        if (!state.rowsCurrent.length) {
            const empty = document.createElement("div");
            empty.textContent = "Nessun nuovo elemento trovato";
            empty.style.padding = "12px 8px";
            empty.style.opacity = "0.7";
            state.body.appendChild(empty);
            return;
        }

        for (let i = 0; i < state.rowsCurrent.length; i++) {
            if (state.bodyAzioni != null) {
                state.bodyAzioni.appendChild(this._crNuoviActionCell(state.rowsCurrent[i]));
            }

            state.body.appendChild(this._crNuoviDataRow(state.rowsCurrent[i], colonneDati));
        }

        //Le colonne possono essere cambiate: si riporta la tabella dove dice lo spostamento e
        //si rimette il cursore in accordo.
        this._scorriNuovi(state, state.spostamento || 0);
    },

    //I20-981: la barra di scorrimento orizzontale della tabella dei nuovi, disegnata da noi.
    //In UXP quel contenitore non scorre in orizzontale in nessun modo nativo, cosi' la tabella
    //viene spostata con un margine negativo e la barra la mettiamo qui sotto, sempre visibile.
    //Le frecce e il clic sulla traccia bastano da soli: se il trascinamento del cursore non
    //funzionasse, la tabella si scorre comunque.
    PASSO_SCORRIMENTO: 160,

    _crBarraScorrimentoNuovi(state) {
        const barra = document.createElement("div");
        barra.style.display = "flex";
        barra.style.alignItems = "center";
        barra.style.gap = "4px";
        barra.style.flexShrink = "0";
        barra.style.padding = "4px 0 0 0";

        const indietro = this._crFrecciaScorrimento("‹", "Sposta la tabella verso sinistra");
        const avanti = this._crFrecciaScorrimento("›", "Sposta la tabella verso destra");

        const traccia = document.createElement("div");
        traccia.style.position = "relative";
        traccia.style.flex = "1 1 auto";
        traccia.style.height = "12px";
        traccia.style.minWidth = "0";
        traccia.style.backgroundColor = "#e6e6e6";
        traccia.style.borderRadius = "6px";
        traccia.style.cursor = "pointer";
        Utility.impostaTooltip(traccia, "Clicca o trascina per scorrere le colonne");

        const cursore = document.createElement("div");
        cursore.style.position = "absolute";
        cursore.style.top = "0";
        cursore.style.left = "0";
        cursore.style.height = "12px";
        cursore.style.width = "40px";
        cursore.style.backgroundColor = "#8a8a8a";
        cursore.style.borderRadius = "6px";
        cursore.style.cursor = "grab";

        traccia.appendChild(cursore);

        barra.appendChild(indietro);
        barra.appendChild(traccia);
        barra.appendChild(avanti);

        state.barra = barra;
        state.traccia = traccia;
        state.cursore = cursore;
        state.spostamento = 0;

        indietro.addEventListener("click", () => this._scorriNuovi(state, state.spostamento - this.PASSO_SCORRIMENTO));
        avanti.addEventListener("click", () => this._scorriNuovi(state, state.spostamento + this.PASSO_SCORRIMENTO));

        traccia.addEventListener("click", (evento) => {
            //Il clic sul cursore lo prende il cursore: qui arriva solo il clic sulla traccia.
            if (evento?.target === cursore) {
                return;
            }

            const misure = this._misureScorrimentoNuovi(state);
            const posizione = this._posizioneNellaTraccia(evento, traccia);

            this._scorriNuovi(state, barraScorrimento.spostamentoDaClic(
                posizione, misure.contenuto, misure.visibile, misure.traccia));
        });

        //Terzo strato: il trascinamento. Se questi eventi non arrivano, restano frecce e traccia.
        cursore.addEventListener("mousedown", (evento) => {
            const misure = this._misureScorrimentoNuovi(state);

            state.trascinamento = {
                partenzaX: evento?.clientX || 0,
                spostamentoIniziale: state.spostamento,
                misure: misure
            };

            cursore.style.cursor = "grabbing";
        });

        this._abilitaTrascinamentoBarra();

        return barra;
    },

    _crFrecciaScorrimento(simbolo, descrizione) {
        const freccia = document.createElement("button");
        freccia.type = "button";
        freccia.textContent = simbolo;
        freccia.style.height = "16px";
        freccia.style.minWidth = "18px";
        freccia.style.padding = "0";
        freccia.style.lineHeight = "1";
        freccia.style.cursor = "pointer";
        freccia.style.flexShrink = "0";
        Utility.impostaTooltip(freccia, descrizione);
        return freccia;
    },

    /// Il trascinamento si ascolta una volta sola sul documento: il mouse esce dal cursore
    /// quasi subito, e se ascoltassimo solo lui il movimento si perderebbe.
    _abilitaTrascinamentoBarra() {
        if (this._trascinamentoBarraAttivo) {
            return;
        }

        this._trascinamentoBarraAttivo = true;
        const me = this;

        $(document).on("mousemove", function (evento) {
            const state = me._confrontoNuoviState;
            if (state == null || state.trascinamento == null) {
                return;
            }

            const misure = state.trascinamento.misure;
            const pixel = (evento?.clientX || 0) - state.trascinamento.partenzaX;

            me._scorriNuovi(state, barraScorrimento.spostamentoDaTrascinamento(
                state.trascinamento.spostamentoIniziale, pixel,
                misure.contenuto, misure.visibile, misure.traccia));
        });

        $(document).on("mouseup", function () {
            const state = me._confrontoNuoviState;
            if (state == null || state.trascinamento == null) {
                return;
            }

            state.trascinamento = null;
            if (state.cursore != null) {
                state.cursore.style.cursor = "grab";
            }
        });
    },

    /// Le misure si leggono adesso, non alla costruzione: quando il pannello nasce non e'
    /// ancora impaginato e tornerebbero zero.
    _misureScorrimentoNuovi(state) {
        let visibile = 0;
        let traccia = 0;

        try {
            visibile = (state?.areaDati || state?.tableScroll)?.clientWidth || 0;
            traccia = state?.traccia?.clientWidth || 0;
        }
        catch (err) {
            console.error("Misure della barra non disponibili:", err);
        }

        return {
            contenuto: state?.larghezzaTotale || 0,
            visibile: visibile,
            traccia: traccia
        };
    },

    _posizioneNellaTraccia(evento, traccia) {
        try {
            const rettangolo = traccia.getBoundingClientRect();
            return (evento?.clientX || 0) - (rettangolo?.left || 0);
        }
        catch (err) {
            return 0;
        }
    },

    /// Sposta la tabella e aggiorna il cursore.
    _scorriNuovi(state, spostamento) {
        if (state == null || state.table == null) {
            return;
        }

        const misure = this._misureScorrimentoNuovi(state);

        state.spostamento = barraScorrimento.limitaSpostamento(spostamento, misure.contenuto, misure.visibile);
        state.table.style.marginLeft = "-" + state.spostamento + "px";

        this._aggiornaCursoreNuovi(state, misure);
    },

    _aggiornaCursoreNuovi(state, misure) {
        if (state == null || state.cursore == null) {
            return;
        }

        const m = misure || this._misureScorrimentoNuovi(state);
        const serve = barraScorrimento.serveLaBarra(m.contenuto, m.visibile);

        if (state.barra != null) {
            //Se le colonne ci stanno tutte, la barra non ha niente da fare e sparisce.
            //Finche' le misure non sono disponibili la si lascia, altrimenti lampeggerebbe.
            state.barra.style.display = (m.visibile > 0 && !serve) ? "none" : "flex";
        }

        const geometria = barraScorrimento.geometriaCursore(
            state.spostamento, m.contenuto, m.visibile, m.traccia);

        state.cursore.style.width = geometria.larghezza + "px";
        state.cursore.style.left = geometria.sinistra + "px";
    },

    _crNuoviHeaderCell(col) {
        const state = this._confrontoNuoviState;

        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.padding = "8px";
        cell.style.minHeight = "34px";
        cell.style.maxHeight = "34px";
        cell.style.fontWeight = "700";
        cell.style.borderRight = "1px solid #ddd";
        cell.style.overflow = "hidden";
        cell.style.whiteSpace = "nowrap";
        cell.style.textOverflow = "ellipsis";
        cell.style.width = this._calcNuoviColumnWidth(col);
        cell.style.minWidth = this._calcNuoviColumnWidth(col);


        let label = col.label;
        if (col.sortable && state.sortKey === col.key) {
            if (state.sortDirection === "asc") label += " ▲";
            else if (state.sortDirection === "desc") label += " ▼";
        }

        cell.textContent = label;
        Utility.impostaTooltip(cell, col.label);

        if (col.sortable) {
            cell.style.cursor = "pointer";
            cell.addEventListener("click", () => {
                this._toggleNuoviSort(col.key);
            });
        }

        return cell;
    },

    _crNuoviDataRow(rowData, colonne) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.flexShrink = "0";
        row.style.minHeight = "42px";
        row.style.maxHeight = "42px";
        row.style.borderBottom = "1px solid #eee";
        row.style.width = (this._confrontoNuoviState?.larghezzaTotale || 0) + "px";
        row.style.minWidth = "100%";

        for (let i = 0; i < colonne.length; i++) {
            const col = colonne[i];

            //I pulsanti non stanno qui: sono nella colonna fissa di sinistra, che non si
            //sposta di lato.
            if (col.key === "__azione__") {
                continue;
            }

            let value = "";
            if (col.key === "codiceGruppo") {
                value = rowData.codiceGruppo || "";
            } else if (col.key === "descrizione") {
                value = rowData.descrizione || "";
            } else if (col.key === "confronto") {
                value = rowData.confronto || "";
            } else {
                const rawVal = this._getRawValueForNuoviColumn(rowData?.raw, col.key);
                value = rawVal == null ? "" : String(rawVal);
            }

            row.appendChild(this._crNuoviTextCell(value, col, !!col.small));
        }

        return row;
    },

    _crNuoviActionCell(rowData) {
        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.gap = "6px";
        cell.style.padding = "6px 8px";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.width = "130px";
        cell.style.minWidth = "130px";
        cell.style.borderBottom = "1px solid #eee";
        //I20-981: i pulsanti restano fermi mentre i campi scorrono perche' questa cella sta
        //nella colonna di sinistra, fuori dalla tabella che si sposta. Con position sticky non
        //funzionava: in UXP non viene ignorato, toglie la cella dal flusso e manda la colonna
        //fuori dal riquadro.
        cell.style.backgroundColor = "#ffffff";
        cell.style.minHeight = "42px";
        cell.style.maxHeight = "42px";

        const btn = this._crButton("Imp.");
        Utility.impostaTooltip(btn, "Impagina questo nuovo record");
        btn.style.padding = "4px 6px";
        btn.style.minWidth = "0";
        btn.style.fontSize = "10px";
        btn.style.lineHeight = "1";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 3;
        input.placeholder = "Pag";
        input.style.width = "36px";
        input.style.minWidth = "36px";
        input.style.textAlign = "center";

        btn.addEventListener("click", async () => {
            try {
                await this._impaginaNuovoSingolo(rowData, input);
            } catch (err) {
                console.error("Errore impaginazione nuovo singolo:", rowData, err);
            }
        });

        const btnInfo = this._crIconButton("Info", "images/info.png");
        btnInfo.style.height = "22px";
        btnInfo.addEventListener("click", () => {
            this._openInfoReportRecord({ raw: rowData.raw, codiceGruppo: rowData.codiceGruppo });
        });

        cell.appendChild(btn);
        cell.appendChild(input);
        cell.appendChild(btnInfo);

        return cell;
    },

    _crNuoviTextCell(value, col, small = false) {
        const cell = document.createElement("div");
        cell.style.display = "flex";
        cell.style.alignItems = "center";
        cell.style.boxSizing = "border-box";
        cell.style.flexShrink = "0";
        cell.style.padding = "6px 8px";
        cell.style.borderRight = "1px solid #eee";
        cell.style.width = this._calcNuoviColumnWidth(col);
        cell.style.minWidth = this._calcNuoviColumnWidth(col);
        cell.style.minHeight = "42px";
        cell.style.maxHeight = "42px";
        cell.style.overflow = "hidden";
        cell.style.cursor = "pointer";

        const text = document.createElement("div");
        text.textContent = value || "";
        Utility.impostaTooltip(text, value || "");
        text.style.width = "100%";
        text.style.overflow = "hidden";
        text.style.whiteSpace = "nowrap";
        text.style.textOverflow = "ellipsis";
        text.style.lineHeight = "1.2";
        text.style.fontSize = small ? "11px" : "12px";

        Utility.impostaTooltip(cell, value || "");

        cell.addEventListener("click", () => {
            navigator.clipboard.writeText(String(value || "")).then(() => {
                const oldBg = cell.style.backgroundColor;
                cell.style.backgroundColor = "#dff0d8";
                setTimeout(() => {
                    cell.style.backgroundColor = oldBg || "";
                }, 700);
            }).catch(err => {
                console.error("Errore copia clipboard:", err);
            });
        });

        cell.appendChild(text);
        return cell;
    },

    _getRawValueForNuoviColumn(raw, key) {
        if (!raw || !key) return "";

        if (raw[key] != null) {
            return raw[key];
        }

        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "codice") {
            return raw["Referenza.Codice"] ?? raw.codice ?? "";
        }

        if (lowerKey === "descrizione") {
            return this._getDescrizioneNuovo(raw);
        }

        const match = Object.keys(raw).find(k => k.toLowerCase() === lowerKey);
        return match ? raw[match] : "";
    },

    /// La larghezza della tabella, in pixel: la somma delle colonne.
    /// Serve perche' il contenitore abbia qualcosa da scorrere in orizzontale.
    _larghezzaTotaleColonne(colonne) {
        return (colonne || []).reduce((somma, col) => {
            const larghezza = parseInt(this._calcNuoviColumnWidth(col), 10);
            return somma + (isNaN(larghezza) ? 0 : larghezza);
        }, 0);
    },

    _calcNuoviColumnWidth(col) {
        const perc = Number(col?.perc || 50);
        const minPx = Number(col?.minPx || 90);
        const proportionalPx = Math.round((perc / 50) * 90);
        return `${Math.max(minPx, proportionalPx)}px`;
    },

    _toggleNuoviSort(key) {
        const state = this._confrontoNuoviState;
        if (!state) return;

        if (state.sortKey !== key) {
            state.sortKey = key;
            state.sortDirection = "asc";
        } else if (state.sortDirection === "asc") {
            state.sortDirection = "desc";
        } else if (state.sortDirection === "desc") {
            state.sortKey = null;
            state.sortDirection = null;
        } else {
            state.sortDirection = "asc";
        }

        state.rowsCurrent = [...state.rowsOriginal];

        if (state.sortKey && state.sortDirection) {
            const dir = state.sortDirection === "asc" ? 1 : -1;
            const sortKey = state.sortKey;

            state.rowsCurrent.sort((a, b) => {
                let va = "";
                let vb = "";

                if (sortKey === "codiceGruppo") {
                    va = a.codiceGruppo || "";
                    vb = b.codiceGruppo || "";
                } else if (sortKey === "descrizione") {
                    va = a.descrizione || "";
                    vb = b.descrizione || "";
                } else {
                    va = a?.raw?.[sortKey] != null ? String(a.raw[sortKey]) : "";
                    vb = b?.raw?.[sortKey] != null ? String(b.raw[sortKey]) : "";
                }

                return va.localeCompare(vb, undefined, {
                    numeric: true,
                    sensitivity: "base"
                }) * dir;
            });
        }

        this._renderNuoviTable();
    },
};

module.exports = pannelli;
