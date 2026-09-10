const cambiStrutturali = {
    cambiStrutturaliDB: [],

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

    _matchRegola(record, regola, dbItems) {
        const isBox = regola.isBox ?? regola.IsBox ?? false;
        //se isBox è true, cerchiamo il campo tra dbItems (che rappresentano i campi presenti nella box) invece che direttamente nel record
        var valoreCampo = null;
        var campo = null;
        var operatore = Number(regola.operatore ?? regola.Operatore);
        var expectedValue = regola.value ?? regola.Value;    
        if (isBox) {
            var obj = dbItems.find(item => Utility.parseLabel(item.label) === regola.campo);
            //se item è un textFrame allora prendiamo il suo contenuto testuale per la valutazione della regola
            var valoreCampo = null;
            if(obj && obj.item.constructorName === "textFrame") {
                valoreCampo = obj.item.contents;
            }
            campo = obj != null;
        }
        else {
            valoreCampo = this._getNestedValue(record, regola.campo);
            campo = record[regola.campo] != null;

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

    _getNestedValue(obj, path) {

        return obj[path];
        // if (!obj || !path) return undefined;

        // const parts = path.split(".");
        // let current = obj;

        // for (const part of parts) {
        //     if (current == null) return undefined;
        //     current = current[part];
        // }

        // return current;
    },

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
            labelELementCorreggo: struttura.labelElementCorreggo ?? null
        };
    },

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