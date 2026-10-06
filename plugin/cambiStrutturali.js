/// I20-1002: quali cambi strutturali si applicano a una referenza.
///
/// Il server manda un elenco di strutture, ognuna con una condizione e delle istruzioni. Questo
/// modulo scorre l'elenco, verifica le condizioni contro il record della referenza e contro i
/// campi presenti nel box, e restituisce le azioni applicabili. Lo usano schedaRef.js nella
/// schermata di edit e ficoProcess.js.
///
/// cambiStrutturaliDB e' cache e stato insieme, e lo riempiono in due: questo modulo quando lo
/// trova vuoto, e pluginMiddleware.js dalla risposta di inizializzazione.

const cambiStrutturali = {
    cambiStrutturaliDB: [],

    /// I20-1049: a chi si applica un'azione in un gruppo. "tutto" e' tutto il gruppo, "primario"
    /// il solo primario: gli stessi valori della tendina della scheda ref, nel suo ordine.
    OPZIONI_GRUPPO: ["tutto", "primario"],

    /// Scarica l'elenco delle strutture da Menabo/getCambioStrutturale e lo memorizza.
    async getCambioStrutturale() {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequestClient();

            xhr.onload = (objResult, parsed) => {
                try {
                    if (!parsed) {
                        try {
                            objResult = JSON.parse(objResult);
                        } catch (e) {
                            messaggioUtente("Code CST-001: Errore durante il parsing della risposta di lettura schemi di cambio strutturale: " + objResult, "error");
                            reject(e);
                            return;
                        }
                    }

                    console.log(objResult);
                    this.cambiStrutturaliDB = objResult;
                    resolve(objResult);
                }
                catch (e) {
                    messaggioUtente("Code CST-002: Errore generico durante la lettura degli schemi di cambio strutturale: " + e, "error");
                    reject(e);
                }
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.status != 200) {
                        hideLoading();
                        indesignEvents.setBusy(false);
                        reject(new Error("Code CST-004: Errore HTTP lettura degli schemi di cambio strutturale: " + xhr.status));
                    }
                }
            };

            xhr.onerror = function () {
                messaggioUtente("Code CST-003: Errore di rete lettura degli schemi di cambio strutturale", "error");
                hideLoading();
                indesignEvents.setBusy(false);
                reject(new Error("Code CST-003: Errore di rete lettura degli schemi di cambio strutturale"));
            };

            xhr.send("Menabo/getCambioStrutturale", null, "GET");
        });
    },

    /// Le azioni applicabili a questa referenza in questo box, numerate da 1.
    /// Se l'elenco non e' ancora stato caricato lo chiede al server.
    async getCambioStrutturalePath(itemRef, box) {
        let strutture = this.cambiStrutturaliDB || [];
     

        if (!strutture || strutture.length === 0) {
            try {
                strutture = await this.getCambioStrutturale();
            } catch (e) {
                messaggioUtente("Code CST-005: Impossibile recuperare i cambi strutturali", "error");
                return [];
            }
        }

        const record = itemRef?.recordInTracciato || {};
        const result = [];
        let progressiveId = 1;
        let dbItems = Utility.getAllFieldsInGroup(box);


        for (const struttura of strutture) {
            if (this._matchCambioStrutturale(record, struttura.condizione, dbItems)) {
                result.push(this._mapCambioStrutturaleToLegacy(struttura, record, progressiveId));
                progressiveId++;
            }
        }

        return result;
    },

    /// Se almeno una delle condizioni e' soddisfatta. Le condizioni sono in OR fra loro, le
    /// regole dentro una condizione sono in AND. Una condizione senza regole vale sempre.
    _matchCambioStrutturale(record, condizioneRoot, dbItems) {
        if (!condizioneRoot || !Array.isArray(condizioneRoot) || condizioneRoot.length === 0) {
            return true;
        }
        for (var i = 0; i < condizioneRoot.length; i++) {
            var condizione = condizioneRoot[i];
            if (!condizione || !Array.isArray(condizione.regole) || condizione.regole.length === 0) {
                return true;
            }

            //condizione è già un insieme di regole unite da &&
            if (this.checkCondizione(record, condizione, dbItems)) {
                return true;
            }
        }

        return false;
    },

    /// Tutte le regole della condizione, piu' le eventuali regole annidate.
    checkCondizione(record, condizione, dbItems) {
        for (const regola of condizione.regole) {
            if (!this._matchRegola(record, regola, dbItems)) {
                return false;
            }
        }

        if(condizione.regoleAnnidate && Array.isArray(condizione.regoleAnnidate) && condizione.regoleAnnidate.length > 0) {
            return this._matchCambioStrutturale(record, condizione.regoleAnnidate, dbItems);
        }

        return true;
    },

    /// Una singola regola. Con isBox il valore si legge dal campo presente nel box - e solo da
    /// una casella di testo, le altre non hanno un contenuto da confrontare - altrimenti dal
    /// record. Gli operatori sono numeri che arrivano dal server: 0 Equals, 1 NotEquals,
    /// 2 Contains, 3 NotContains, 4 In, 5 NotIn, 6 Exist, 7 NotExist.
    _matchRegola(record, regola, dbItems) {
        const isBox = regola.isBox ?? regola.IsBox ?? false;
        //se isBox è true, cerchiamo il campo tra dbItems (che rappresentano i campi presenti nella box) invece che direttamente nel record
        var valoreCampo = null;
        var campo = null;
        var operatore = Number(regola.operatore ?? regola.Operatore);
        var expectedValue = regola.value ?? regola.Value;    
        if (isBox) {
            var obj = dbItems.find(item => Utility.parseLabel(item.label) === regola.campo);
            //se item è un TextFrame allora prendiamo il suo contenuto testuale per la valutazione della regola
            //I20-1002: la maiuscola conta. constructorName vale "TextFrame", come ovunque nel Plugin,
            //e qui c'era scritto "textFrame": il confronto non era mai vero, valoreCampo restava null
            //e _equals, _contains e _in tornano tutti false su null. Le regole isBox sul contenuto di
            //un campo fallivano sempre; reggevano solo Exist e NotExist, che guardano la presenza.
            if(obj && obj.item.constructorName === "TextFrame") {
                valoreCampo = obj.item.contents;
            }
            campo = obj != null;
        }
        else {
            valoreCampo = this._getNestedValue(record, regola.campo);
            //I20-1002: la presenza si legge con la stessa funzione del valore. Prima era una
            //lettura diretta, quindi su un campo annidato il valore si trovava ed Exist diceva
            //che non c'era.
            campo = this._getNestedValue(record, regola.campo) != null;

            //se il valoreCampo è di tipo boolean e expetedValue è un stringa "true" o "false"
            if ((operatore == 0 || operatore == 1) && typeof valoreCampo === "boolean" && typeof expectedValue === "string") {
                if (expectedValue.toLowerCase() !== "true" && expectedValue.toLowerCase() !== "false") {
                    messaggioUtente(`Code CST-006: Valore atteso per il campo ${regola.campo} non valido: ${expectedValue}. Deve essere "true" o "false".`, "error");
                    return false;
                }
                expectedValue = expectedValue.toLowerCase() === "true";
            }
        }
        
        switch (operatore) {
            case 0: // OperatoreCondizione.Equals
                return this._equals(valoreCampo, expectedValue);

            case 1: // OperatoreCondizione.NotEquals
                return !this._equals(valoreCampo, expectedValue);

            case 2: // OperatoreCondizione.Contains
                return this._contains(valoreCampo, expectedValue);

            case 3: // OperatoreCondizione.NotContains
                return !this._contains(valoreCampo, expectedValue);

            case 4: // OperatoreCondizione.In
                return this._in(valoreCampo, expectedValue);

            case 5: // OperatoreCondizione.NotIn
                return !this._in(valoreCampo, expectedValue);

            case 6: // OperatoreCondizione.Exist
                return campo;

            case 7: // OperatoreCondizione.NotExist
                return !campo;
            default:
                return false;
        }
    },

    /// Il valore di un campo del record, anche annidato: "Scatto.CodiceGruppo" scende di un
    /// livello. Prima prova la chiave letterale, perche' un campo puo' contenere il punto nel
    /// nome, e solo se non c'e' spezza il percorso.
    ///
    /// I20-1002: il corpo che scendeva era commentato e restava la sola lettura diretta, quindi
    /// il nome mentiva e una regola su un campo annidato non trovava niente. Nessun cliente ne
    /// usa oggi - verificato su Coopfi, Edro21 e Famila - percio' rimetterlo in funzione non
    /// cambia il comportamento di nessuno, e toglie una trappola per chi scrivera' la prossima
    /// regola.
    ///
    /// DA UNIFICARE (vedi il task di divisione dei file): pluginMiddleware.getValueByPath fa
    /// esattamente questo, con lo stesso ordine dei due tentativi. Sono due copie della stessa
    /// funzione. Non si uniscono oggi perche' pluginMiddleware.js e utility.js richiedono
    /// InDesign e sotto Node non si caricano: importarli da qui farebbe perdere il test di
    /// questo modulo. Serve un modulo puro che entrambi possano importare.
    _getNestedValue(obj, path) {
        if (!obj || !path) {
            return undefined;
        }

        if (obj[path] !== undefined) {
            return obj[path];
        }

        const parts = String(path).split(".");
        let current = obj;

        for (const part of parts) {
            if (current == null) {
                return undefined;
            }
            current = current[part];
        }

        return current;
    },

    /// I tre confronti - _equals, _contains, _in - non distinguono maiuscole da minuscole e
    /// sono tutti falsi su un valore assente. E' il motivo per cui una regola sbagliata non da'
    /// errore: risponde "no" come se la condizione non fosse soddisfatta.
    _equals(currentValue, expectedValue) {
        if (currentValue == null) return false;
        return String(currentValue).toLowerCase() === String(expectedValue).toLowerCase();
    },

    _contains(currentValue, expectedValue) {
        if (currentValue == null) return false;
        return String(currentValue).toLowerCase().indexOf(String(expectedValue).toLowerCase()) >= 0;
    },

    _in(currentValue, expectedValue) {
        if (currentValue == null) return false;

        if (Array.isArray(currentValue)) {
            return currentValue.some(x => String(x).toLowerCase() === String(expectedValue).toLowerCase());
        }

        return String(currentValue).toLowerCase().indexOf(String(expectedValue).toLowerCase()) >= 0;
    },

    /// Traduce una struttura del server nella forma che si aspetta la schermata di edit.
    _mapCambioStrutturaleToLegacy(struttura, record, id) {
        return {
            id: id,
            titolo: struttura.titolo,
            istruzioni: (struttura.istruzioni || []).map(istr => ({
                field: istr.field,
                valore: this._resolveIstruzioneValue(istr, record),
                primary: Boolean(istr.primary)
            })),
            campiInddCoinvolti: (struttura.campiInddCoinvolti || []).map(campo => ({
                label: Utility.parseLabel(campo.label),
                item: campo.item ?? null
            })),
            labelELementCorreggo: struttura.labelElementCorreggo ?? null,
            opzioniValide: this._opzioniValide(struttura)
        };
    },

    /// I20-1049: le opzioni valide di una struttura del server, nell'ordine della tendina. Una
    /// struttura che non le dichiara, o ne dichiara solo di sconosciute, le ammette tutte: e' il
    /// comportamento di prima, e resta quello dei clienti che non le configurano.
    _opzioniValide(struttura) {
        const dichiarate = struttura?.opzioniValide ?? struttura?.OpzioniValide;
        const nomi = Array.isArray(dichiarate) ? dichiarate.map(o => String(o).trim().toLowerCase()) : [];
        const valide = this.OPZIONI_GRUPPO.filter(o => nomi.includes(o));
        return valide.length > 0 ? valide : this.OPZIONI_GRUPPO.slice();
    },

    /// I20-1049: le opzioni valide per tutte le azioni scelte insieme, perche' al salvataggio
    /// l'opzione e' una sola. Senza azioni non ce n'e' nessuna, e la tendina non si mostra; con
    /// una sola si applica quella senza chiederla; vuota se due azioni non ne hanno in comune.
    opzioniComuni(azioni) {
        if (!Array.isArray(azioni) || azioni.length === 0) {
            return [];
        }
        return this.OPZIONI_GRUPPO.filter(o =>
            azioni.every(a => (Array.isArray(a?.opzioniValide) ? a.opzioniValide : this.OPZIONI_GRUPPO).includes(o)));
    },

    /// Il valore di un'istruzione secondo la sua operazione: 0 Set scrive il valore,
    /// 1 AppendText lo accoda a quello che c'e', 2 RemoveText lo toglie e ripulisce i bordi.
    _resolveIstruzioneValue(istruzione, record) {
        const operazione = Number(istruzione.operazione);

        switch (operazione) {
            case 0: { // TipoOperazione.Set
                return istruzione.valore;
            }

            case 1: { // TipoOperazione.AppendText
                const currentValue = this._getNestedValue(record, istruzione.field) ?? "";
                return String(currentValue) + String(istruzione.valore ?? "");
            }

            case 2: { // TipoOperazione.RemoveText
                const currentValue = this._getNestedValue(record, istruzione.field) ?? "";
                return String(currentValue).replaceAll(String(istruzione.valore ?? ""), "").trim();
            }

            default:
                return istruzione.valore;
        }
    },
}

module.exports = cambiStrutturali;