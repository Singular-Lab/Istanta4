/// La voce "Fuori vol" del tracciato: le referenze che l'esportazione del volantino esclude perche'
/// fuori volantino, e il pulsante che le rimette in volantino.
///
/// I fuori volantino arrivano con la lista del kit, nella sezione fuoriVolantino, raccolti
/// dall'esportazione dell'agenzia nel punto stesso in cui li esclude: sono esattamente quelli.
/// Un gruppo e' tutto dentro o tutto fuori; quelli misti sono dati corrotti e il server li
/// elenca in gruppiMisti (label|codice gruppo).
///
/// Rimettere in volantino: se una regola del cliente dichiarata nella configurazione del Plugin
/// vale ancora per il record (Coop: il tema con "fuori depliant"), prima si correggono i suoi
/// campi in una finestra; poi il server mette il campo core in volantino su tutto il gruppo. Nella
/// lista del kit si aggiorna solo quel gruppo, con il suo dato nuovo, senza riscaricarla.
///
/// La parte pura (regole, Salva, valori, aggiornamento della lista) si carica anche sotto Node per
/// i test; il resto usa le globali del Plugin (indexNew.js) solo quando viene chiamato.
const cambiStrutturali = require('./cambiStrutturali');

const CHIAVE_INDICE = "IndiceOrdinamento";

const FuoriVolantino = {
    VISUALIZZAZIONE: "fuori_vol",

    /* ---- parte pura ---- */

    /// La sezione dei fuori volantino della lista del kit; null se la lista e' stata scaricata
    /// prima che esistesse.
    sezione(lista) {
        return lista != null && Array.isArray(lista.fuoriVolantino) ? lista.fuoriVolantino : null;
    },

    idRec(articolo) {
        const rec = articolo != null ? (articolo.recordInTracciato || {}) : {};
        const id = rec.idRec != null ? rec.idRec : (articolo != null ? articolo.idRec : null);
        return id != null ? parseInt(id) : null;
    },

    /// Una riga per gruppo, col primario, come le altre voci del tracciato (ricercaFiltro).
    eRiga(articolo) {
        const rec = articolo != null ? (articolo.recordInTracciato || {}) : {};
        return rec["Referenza.Codice"] == rec["Scatto.CodiceGruppo"] || rec["StatoSelezione"] == 1;
    },

    /// Le righe della sezione senza criteri, con l'indice per l'ordine del tracciato.
    righe(lista) {
        const sezione = this.sezione(lista) || [];
        return sezione
            .map((articolo, indice) => { articolo.index = indice; return articolo; })
            .filter(articolo => this.eRiga(articolo));
    },

    chiaveGruppo(articolo) {
        const rec = articolo != null ? (articolo.recordInTracciato || {}) : {};
        return String(articolo != null && articolo.label != null ? articolo.label : "") + "|" + String(rec["Scatto.CodiceGruppo"] || "");
    },

    eGruppoMisto(articolo, lista) {
        return lista != null && Array.isArray(lista.gruppiMisti) && lista.gruppiMisti.includes(this.chiaveGruppo(articolo));
    },

    /// La prima regola del cliente che vale per il record, o null. Una regola senza condizione non
    /// vale mai: altrimenti ogni referenza fuori volantino passerebbe dalla finestra.
    regolaCheVale(record, regole) {
        return (regole || []).find(regola =>
            regola != null && Array.isArray(regola.condizione) && regola.condizione.length > 0 &&
            cambiStrutturali._matchCambioStrutturale(record || {}, regola.condizione, [])) || null;
    },

    /// Salva si attiva solo se almeno un campo e' cambiato e la regola, con i valori nuovi, non vale
    /// piu': altrimenti la referenza tornerebbe in volantino col tema che dice ancora fuori depliant.
    salvaAttivo(record, regola, valori) {
        const campi = regola != null && Array.isArray(regola.campi) ? regola.campi : [];
        const cambiato = campi.some(campo => String(valori[campo] ?? "") !== String((record || {})[campo] ?? ""));
        if (!cambiato) {
            return false;
        }
        return this.regolaCheVale(Object.assign({}, record, valori), [regola]) == null;
    },

    /// I valori del campo nei record in volantino della lista del kit, per la scelta rapida; null
    /// se la lista non c'e'.
    valoriDelCampo(lista, campo) {
        if (lista == null || !Array.isArray(lista.records)) {
            return null;
        }
        const valori = new Set();
        lista.records.forEach(articolo => {
            const valore = (articolo.recordInTracciato || {})[campo];
            if (valore != null && String(valore).trim() !== "") {
                valori.add(String(valore));
            }
        });
        return Array.from(valori).sort((a, b) => a.localeCompare(b));
    },

    /// I parametri della rimessa in volantino: il record e i campi corretti, col punto scritto "$"
    /// come nelle azioni sul box.
    parametri(idRec, valori) {
        let parametri = "idRec=" + encodeURIComponent(idRec);
        Object.keys(valori || {}).forEach(campo => {
            parametri += "&attributi." + encodeURIComponent(String(campo).split(".").join("$")) + "=" + encodeURIComponent(valori[campo] ?? "");
        });
        return parametri;
    },

    /// Sostituisce nella lista del kit i record del gruppo con quelli arrivati dal server (la scheda
    /// del gruppo dopo l'esportazione): quelli in volantino vanno fra i record, gli esclusi nella
    /// sezione dei fuori volantino. Tengono label e posizione della versione di prima, che la scheda
    /// non porta: l'ordine del tracciato lo calcola solo lo scarico della lista.
    aggiornaGruppo(lista, vecchio, scheda) {
        const chiave = this.chiaveGruppo(vecchio);
        const dentro = (scheda && scheda.records) || [];
        const fuori = (scheda && scheda.fuoriVolantino) || [];
        const idNuovi = new Set(dentro.concat(fuori).map(a => this.idRec(a)));
        const precedenti = new Map();

        const togli = (elenco) => (elenco || []).filter(articolo => {
            if (this.chiaveGruppo(articolo) === chiave || idNuovi.has(this.idRec(articolo))) {
                precedenti.set(this.idRec(articolo), articolo);
                return false;
            }
            return true;
        });
        lista.records = togli(lista.records);
        lista.fuoriVolantino = togli(this.sezione(lista));

        const prepara = (articolo) => {
            const prima = precedenti.get(this.idRec(articolo));
            articolo.label = articolo.label != null ? articolo.label : (prima != null ? prima.label : vecchio.label);
            if (prima != null && prima.recordInTracciato != null && articolo.recordInTracciato != null) {
                articolo.recordInTracciato[CHIAVE_INDICE] = prima.recordInTracciato[CHIAVE_INDICE];
                articolo.recordInTracciato.ordered = prima.recordInTracciato.ordered;
            }
            return articolo;
        };
        dentro.map(prepara).forEach(articolo => this._inserisci(lista.records, articolo));
        fuori.map(prepara).forEach(articolo => this._inserisci(lista.fuoriVolantino, articolo));

        if (Array.isArray(lista.gruppiMisti)) {
            lista.gruppiMisti = lista.gruppiMisti.filter(k => k !== chiave);
        }
        return lista;
    },

    /// Dopo l'ultimo record con un indice d'ordinamento non maggiore del suo.
    _inserisci(elenco, articolo) {
        const indice = Number((articolo.recordInTracciato || {})[CHIAVE_INDICE]);
        let posizione = elenco.length;
        if (!isNaN(indice)) {
            const dopo = elenco.findIndex(a => Number((a.recordInTracciato || {})[CHIAVE_INDICE]) > indice);
            if (dopo >= 0) {
                posizione = dopo;
            }
        }
        elenco.splice(posizione, 0, articolo);
    },

    /* ---- interfaccia e server ---- */

    /// Il pulsante della riga al posto di Impagina. Su un gruppo misto non si attiva e dice perche'.
    pulsante(articolo, $riga, misto) {
        const me = this;
        //La colonna della pagina e' stretta: la spiegazione sta nel suggerimento.
        const $pulsante = $('<button></button>').addClass("rimetti-in-volantino").text("Rimetti").css({
            "font-size": "10px",
            "padding": "1px 4px",
            "white-space": "nowrap",
            "cursor": misto ? "not-allowed" : "pointer"
        });
        if (misto) {
            $pulsante.prop("disabled", true);
            this._suggerimento($pulsante, "Dato corrotto: il gruppo ha referenze in volantino e altre fuori. Va sistemato prima di rimetterlo in volantino.");
            $riga.css("background-color", "#fde2e2");
            return $pulsante;
        }
        this._suggerimento($pulsante, "Rimette in volantino il gruppo");
        $pulsante.on("click", async function () {
            if ($pulsante.attr("data-incorso") === "1") {
                return;
            }
            $pulsante.attr("data-incorso", "1");
            try {
                await me.rimetti(articolo, $riga);
            }
            finally {
                $pulsante.attr("data-incorso", "0");
            }
        });
        return $pulsante;
    },

    async rimetti(articolo, $riga) {
        const record = articolo.recordInTracciato || {};
        const idRec = this.idRec(articolo);
        const codiceGruppo = record["Scatto.CodiceGruppo"];
        const lista = readFile(Utility.percorsoListaKit(idKitLavorazione));

        if (this.eGruppoMisto(articolo, lista)) {
            messaggioUtente("Code FVL-01 Il gruppo " + codiceGruppo + " ha referenze in volantino e altre fuori: e' un dato corrotto, va sistemato prima di rimetterlo in volantino", "error", false, 8);
            return;
        }

        let valori = {};
        const regola = this.regolaCheVale(record, pluginMiddleware.getFuoriVolantinoInTracciato().regole);
        if (regola != null) {
            valori = await this.chiediCampi(record, regola, lista);
            if (valori == null) {
                return;
            }
        }

        showLoading("Rimetto in volantino");
        indesignEvents.setBusy(true);
        try {
            const salvato = await this._chiama("Menabo/rimettiInVolantino/" + idKitLavorazione, this.parametri(idRec, valori), "rimessa in volantino");
            if (!salvato.ok || salvato.risultato == null || salvato.risultato.esito === false) {
                const motivo = salvato.ok ? (salvato.risultato && salvato.risultato.error) : salvato.motivo;
                messaggioUtente("Code FVL-02 Gruppo " + codiceGruppo + " non rimesso in volantino: " + motivo, "error", false, 10);
                if (salvato.ok && salvato.risultato && salvato.risultato.dettaglio) {
                    console.error(salvato.risultato.dettaglio);
                }
                return;
            }
            await this.aggiornaInLista(codiceGruppo, idRec, articolo);
            $riga.remove();
        }
        finally {
            hideLoading();
            indesignEvents.setBusy(false);
        }

        messaggioUtente("Gruppo " + codiceGruppo + " rimesso in volantino", "success", false, 4);
        await this.chiediImpaginazione(record, codiceGruppo, idRec);
    },

    /// Rilegge dal server il gruppo dopo l'esportazione e lo sposta nella sezione giusta della lista
    /// del kit, su disco e in memoria. Con una lista di prima della sezione dei fuori volantino non
    /// tocca niente: va riscaricata.
    async aggiornaInLista(codiceGruppo, idRec, vecchio = null) {
        const percorso = Utility.percorsoListaKit(idKitLavorazione);
        const lista = readFile(percorso);
        if (lista == null || this.sezione(lista) == null) {
            return false;
        }
        if (vecchio == null) {
            vecchio = (lista.records || []).concat(this.sezione(lista)).find(a => this.idRec(a) === parseInt(idRec))
                || { label: null, recordInTracciato: { "Scatto.CodiceGruppo": codiceGruppo, idRec: idRec } };
        }

        const scheda = await this._chiama("Menabo/getSchedaRef/" + idKitLavorazione + "/true/Advanced",
            "codiceGruppo=" + encodeURIComponent(codiceGruppo) + "&idRec=" + encodeURIComponent(idRec), "aggiornamento del gruppo nella lista");
        if (!scheda.ok || scheda.risultato == null || scheda.risultato.esito === false) {
            const motivo = scheda.ok ? (scheda.risultato && scheda.risultato.error) : scheda.motivo;
            messaggioUtente("Code FVL-03 Lista del kit non aggiornata per il gruppo " + codiceGruppo + ": " + motivo + ". Riscarica la lista dalla Home", "warning", false, 10);
            return false;
        }

        this.aggiornaGruppo(lista, vecchio, scheda.risultato);
        require('fs').writeFileSync(percorso, JSON.stringify(lista));
        contenutoKitInLavorazione = lista;
        return true;
    },

    /// Codice gruppo e record dai parametri di un'azione sul box (codiceGruppo=...&idRec=...).
    daParametri(parametri) {
        const valore = (nome) => {
            const trovato = String(parametri || "").split("&").map(p => p.split("=")).find(p => p[0] === nome);
            return trovato != null && trovato.length > 1 ? decodeURIComponent(trovato[1].replace(/\+/g, " ")) : null;
        };
        const idRec = parseInt(valore("idRec"));
        return { codiceGruppo: valore("codiceGruppo"), idRec: isNaN(idRec) ? null : idRec };
    },

    /// Dopo un'azione sul box che ha mandato il gruppo fuori volantino. Non ferma l'azione: se non
    /// riesce lo dice, e la lista si sistema riscaricandola.
    async aggiornaDopoUscita(parametri) {
        try {
            const { codiceGruppo, idRec } = this.daParametri(parametri);
            if (codiceGruppo == null || idRec == null) {
                return;
            }
            await this.aggiornaInLista(codiceGruppo, idRec);
        }
        catch (e) {
            console.error(e);
            messaggioUtente("Code FVL-04 Lista del kit non aggiornata dopo l'uscita dal volantino: " + (e && e.message ? e.message : e) + ". Riscarica la lista dalla Home", "warning", false, 8);
        }
    },

    async chiediImpaginazione(record, codiceGruppo, idRec) {
        const pagina = await getPaginaImpaginazioneCorrente();
        if (pagina == null) {
            messaggioUtente("Code FVL-05 Gruppo rimesso in volantino, ma pagina corrente non rilevata: impaginalo dalla lista", "warning", false, 6);
            return;
        }
        if (!(await confermaImpaginazioneDaTracciato(record, pagina))) {
            return;
        }
        await impaginaSingolo(codiceGruppo, pagina, false, idRec);
        const filtro = $("#areaFiltriEffettiva");
        await aggiornaTracciatoPostRicerca(await filtriJs.ricercaFiltro(filtro));
    },

    /// La finestra dei campi della regola: compilati col valore attuale, una scelta rapida fra i
    /// valori della lista del kit, Salva attivo solo se i campi sono cambiati e la regola non vale
    /// piu'. Risolve con i valori, o con null se si chiude senza salvare.
    chiediCampi(record, regola, lista) {
        const me = this;
        return new Promise(resolve => {
            let risolto = false;
            const fine = (valore) => {
                if (!risolto) {
                    risolto = true;
                    resolve(valore);
                }
            };
            const valori = {};
            const caselle = {};
            //Uno per uno, con un tag solo ciascuno: in UXP un blocco di HTML non diventa elementi.
            const contenuto = $('<div></div>').css({ "width": "100%", "display": "flex", "flex-direction": "column", "gap": "8px", "font-size": "12px", "color": "#2c2c2c" });
            contenuto.append($('<div></div>').text("Il gruppo " + (record["Scatto.CodiceGruppo"] || "") + " e' fuori volantino per la regola \"" + (regola.titolo || "") + "\": correggi i campi per rimetterlo in volantino."));

            const avviso = $('<div></div>').css({ "color": "#b21d1d", "display": "none" }).text("Con questi valori la regola vale ancora: la referenza resterebbe fuori volantino.");
            const salva = $('<button></button>').text("Salva").prop("disabled", true);
            const annulla = $('<button></button>').text("Annulla");

            const aggiorna = function () {
                (regola.campi || []).forEach(campo => { valori[campo] = String(caselle[campo].val() ?? ""); });
                const attivo = me.salvaAttivo(record, regola, valori);
                const cambiato = (regola.campi || []).some(campo => valori[campo] !== String(record[campo] ?? ""));
                salva.prop("disabled", !attivo);
                avviso.css("display", cambiato && !attivo ? "block" : "none");
            };

            (regola.campi || []).forEach(campo => {
                const blocco = $('<div></div>').css({ "display": "flex", "flex-direction": "column", "gap": "4px" });
                blocco.append($('<div></div>').text(campo).css({ "font-weight": "700" }));
                const casella = $('<input type="text" style="width: 100%; box-sizing: border-box; background-color: white; color: black;"></input>');
                casella.val(String(record[campo] ?? ""));
                casella.on("input change", aggiorna);
                caselle[campo] = casella;
                blocco.append(casella);

                const valoriLista = me.valoriDelCampo(lista, campo);
                if (valoriLista == null) {
                    blocco.append($('<div></div>').text("Lista kit non scaricata").css({ "color": "#767676" }));
                }
                else {
                    const scelta = $('<select style="width: 100%;"></select>');
                    scelta.append($('<option></option>').attr("value", "").text("Scegli un valore della lista..."));
                    valoriLista.forEach(valore => scelta.append($('<option></option>').attr("value", valore).text(valore)));
                    scelta.on("change", function () {
                        if (scelta.val() !== "") {
                            casella.val(scelta.val());
                            aggiorna();
                        }
                    });
                    blocco.append(scelta);
                }
                contenuto.append(blocco);
            });

            const azioni = $('<div></div>').css({ "display": "flex", "gap": "6px", "justify-content": "flex-end", "border-top": "1px solid #ddd", "padding-top": "8px" });
            azioni.append(annulla).append(salva);
            contenuto.append(avviso).append(azioni);

            salva.on("click", function () {
                aggiorna();
                if (!me.salvaAttivo(record, regola, valori)) {
                    return;
                }
                fine(Object.assign({}, valori));
                $("#popupCloseButton").trigger("click");
            });
            annulla.on("click", function () {
                fine(null);
                $("#popupCloseButton").trigger("click");
            });

            aggiorna();
            //Modali.popup non ritorna: la risposta arriva da Salva, Annulla o dalla chiusura.
            Modali.popup("Rimetti in volantino", contenuto, "md", function () { fine(null); });
        });
    },

    _suggerimento($elemento, testo) {
        $elemento.attr("title", testo);
        if (typeof Tooltip !== "undefined" && Tooltip != null && typeof Tooltip.impostaTooltip === "function") {
            Tooltip.impostaTooltip($elemento[0], testo);
        }
    },

    /// Una chiamata PUT al server che si risolve sempre: { ok, risultato } o { ok:false, motivo }.
    _chiama(url, parametri, descrizione) {
        const XMLHttpRequestClient = require('./XMLHttpRequestClient');
        return new Promise(resolve => {
            const xhr = new XMLHttpRequestClient();
            xhr.descrizione = descrizione;
            xhr.onload = (risultato) => resolve({ ok: true, risultato: risultato });
            xhr.onerror = (motivo) => resolve({ ok: false, motivo: XMLHttpRequestClient.testoErrore(motivo) });
            xhr.onabort = (motivo) => resolve({ ok: false, motivo: motivo || "richiesta annullata" });
            xhr.send(url, parametri, "PUT", "application/x-www-form-urlencoded");
        });
    },
};

module.exports = FuoriVolantino;
