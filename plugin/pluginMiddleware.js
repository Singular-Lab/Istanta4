const FicoProcess = require("./ficoProcess");

const pluginMiddleware = {

    callCustom: true,
    customPluginDB: null,

    async getCustomPlugin() {
        let me = this;
        me.callCustom = customAgenzia.callCustom != null ? customAgenzia.callCustom : true;
        if(me.callCustom){
            return;
        }
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequestClient();

            xhr.onload = (objResult, parsed) => {
                try {
                    if (!parsed) {
                        try {
                            objResult = JSON.parse(objResult);
                        } catch (e) {
                            messaggioUtente("Code PMW-001: Errore durante il parsing della risposta di lettura dei dati plugin di agenzia: " + objResult, "error", false, 5, true);
                            reject(e);
                            return;
                        }
                    }

                    console.log(objResult);
                    me.customPluginDB = objResult;
                    //impostiamo il valore dei cambiStrutturaliDB
                    cambiStrutturaliJs.cambiStrutturaliDB = objResult.cambiStrutturali || [];
                    resolve(objResult);
                }
                catch (e) {
                    messaggioUtente("Code PMW-002: Errore generico durante la lettura dei dati plugin di agenzia: " + e, "error", false, 5, true);
                    reject(e);
                }
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    if (xhr.status != 200) {
                        hideLoading();
                        indesignEvents.setBusy(false);
                        reject(new Error("Code PMW-003: Errore HTTP durante la lettura dei dati plugin di agenzia: " + xhr.status));
                    }
                }
            };

            xhr.onerror = function () {
                messaggioUtente("Code PMW-004: Errore di rete durante la lettura dei dati plugin di agenzia", "error", false, 5, true);
                hideLoading();
                indesignEvents.setBusy(false);
                reject(new Error("Code PMW-004: Errore di rete durante la lettura dei dati plugin di agenzia"));
            };

            xhr.send("CustomPlugin/getCustomPlugin", null, "GET");
        });
    },

    getCampo(nomeCampo){
        let me = this;
        if (me.callCustom) {
            if (typeof customAgenzia !== 'undefined') {
                return customAgenzia[nomeCampo] != null ? customAgenzia[nomeCampo] : null;
            } else {
                return null;
            }
        }
        return me.customPluginDB?.[nomeCampo] || null;
    },

    requiresIngombro(itemRef) {
        let me = this;
        if (me.callCustom) {
            if (typeof customAgenzia !== 'undefined' && typeof customAgenzia.requiresIngombro === 'function') {
                return customAgenzia.requiresIngombro(itemRef);
            } else {
                return null;
            }
        }
        const rules = me.customPluginDB.requiresIngombriConteggio || [];

        for (const ruleSet of rules) {
            if (me.valutaBlocchiRegole(itemRef, ruleSet.regole)) {
                return ruleSet.result || [""];
            }
        }

        return [""];
    },

    getInfoExtra(itemRef) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getInfoExtra === "function") {
                return customAgenzia.getInfoExtra(itemRef);
            } else {
                return null;
            }
        }

        const commands = me.customPluginDB?.infoExtraCommands || [];

        let string = "\n";

        for (const command of commands) {
            if (me.valutaBlocchiRegole(itemRef, command.regole)) {
                string += me.replacePlaceholders(command.text, itemRef);
            }
        }

        return string;
    },

    replacePlaceholders(text, itemRef) {
        let me = this;

        if (text === undefined || text === null) {
            return "";
        }

        return String(text).replace(/\{([^}]+)\}/g, (match, key) => {
            const value = me.getValueByPath(itemRef, key);

            if (value === undefined || value === null) {
                return "";
            }

            return value;
        });
    },

    getEtichette(itemRef, listaEtichette) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getEtichette === "function") {
                return customAgenzia.getEtichette(itemRef, listaEtichette);
            } else {
                return null;
            }
        }

        const commands = me.customPluginDB?.etichetteCommands || [];

        for (const command of commands) {
            if (me.valutaBlocchiRegole(itemRef, command.regole)) {
                switch (command.operazione){
                    case 0: //set
                        return command.etichette || [];
                    case 1: //append
                    case 3:
                        listaEtichette = (listaEtichette || []).concat(command.etichette || []);
                        break;
                    case 2: //remove
                    case 4:
                        listaEtichette = (listaEtichette || []).filter(e => !(command.etichette || []).includes(e));
                        break;
                    default:
                        messaggioUtente("Operazione non gestita: " + command.operazione, "error", false, 5, true);
                        break;
                }
            }
        }

        return listaEtichette;
    },

    isSchemaEditable(nomeStile) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.isSchemaEditable === "function") {
                return customAgenzia.isSchemaEditable(nomeStile);
            } else {
                return null;
            }
        }

        const schemasNotEditable = me.customPluginDB?.schemasNotEditable || [];

        for (const schema of schemasNotEditable) {
            if (nomeStile && nomeStile.includes(schema)) {
                return false;
            }
        }

        return true;
    },

    getFitTypeLogo(nomeLogo, tipo) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getFitTypeLogo === "function") {
                return customAgenzia.getFitTypeLogo(nomeLogo, tipo);
            } else {
                return null;
            }
        }

        const rules = me.customPluginDB?.fitTypeLogos || [];

        const context = {
            nomeLogo: nomeLogo,
            tipoLogo: tipo
        };

        for (const rule of rules) {
            if (me.valutaBlocchiRegole(context, rule.regole)) {
                return me.toFitOptions(rule.tipoFit);
            }
        }

        return null;
    },

    toFitOptions(tipoFit) {
        let me = this;

        if (tipoFit === undefined || tipoFit === null || tipoFit === "") {
            return null;
        }

        switch (Number(tipoFit)) {
            case 0:
                return FitOptions.FRAME_TO_CONTENT;

            case 1:
                return FitOptions.CONTENT_TO_FRAME;

            case 2:
                return FitOptions.PROPORTIONALLY;

            case 3:
                return FitOptions.FILL_PROPORTIONALLY;

            default:
                return null;
        }
    },

    getOverflowsInstruction(field) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getOverflowsInstruction === "function") {
                return customAgenzia.getOverflowsInstruction(field);
            } else {
                return null;
            }
        }

        const overflowInstructions = me.customPluginDB?.campiSoggettiAOverflow || [];
        const overflowInstruction = overflowInstructions.find(c => Utility.parseLabel(c.label) == Utility.parseLabel(field.label));

        if (overflowInstruction == null) {
            return null;
        }

        gbBKP = field.geometricBounds;

        const amountH = overflowInstruction.amountH != null
            ? Number(overflowInstruction.amountH)
            : 3;

        const amountW = overflowInstruction.amountW != null
            ? Number(overflowInstruction.amountW)
            : 3;

        const result = [0, 0, 0, 0];

        if (overflowInstruction.w == "left") {
            result[1] = -amountW;
        }
        else if (overflowInstruction.w == "right") {
            result[3] = amountW;
        }

        if (overflowInstruction.h == "top") {
            result[0] = -amountH;
        }
        else if (overflowInstruction.h == "bottom") {
            result[2] = amountH;
        }

        return result;
    },

    getColonneTracciatoIntestazione() {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getColonneTracciatoIntestazione === "function") {
                return customAgenzia.getColonneTracciatoIntestazione();
            } else {
                return null;
            }
        }

        return me.customPluginDB?.colonneTracciato || [];
    },

    getRegoleApplicazioneDNA(recordInTracciato) {
        let me = this;

        const rules = me.customPluginDB?.regoleApplicazioneDNA || [];
        const codiceBoxRecord = me.normalize(recordInTracciato?.codiceBox);
        const meccanicaRecord = me.normalize(recordInTracciato?.meccanicaAssegnata ?? recordInTracciato?.combinazioneAssegnata);

        const matchList = (values, actualValue) => {
            if (!Array.isArray(values) || values.length === 0) {
                return true;
            }

            return values.some(value => me.normalize(value) === actualValue);
        };

        for (const rule of rules) {
            if (!rule) {
                continue;
            }

            const codiceBoxMatch = matchList(rule.codiceBox, codiceBoxRecord);
            const meccanicaMatch = matchList(rule.meccanicaAssegnata, meccanicaRecord);

            if (codiceBoxMatch && meccanicaMatch) {
                return Array.isArray(rule.campiDNA) ? rule.campiDNA : ["base"];
            }
        }

        return ["base"];
    },

    aggiungiInfoRapidaVisioneDelDato(recordInTracciato) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.aggiungiInfoRapidaVisioneDelDato === "function") {
                return customAgenzia.aggiungiInfoRapidaVisioneDelDato(recordInTracciato);
            } else {
                return null;
            }
        }

        const infoRapide = me.customPluginDB?.infoRapide || [];
        const infoListObjects = [];

        for (const info of infoRapide) {
            infoListObjects.push({
                label: info.label,
                value: me.getValueByPath(recordInTracciato, info.keyInRecordInTracciato)
            });
        }

        return infoListObjects;
    },

    getOverflowDirection(tf) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getOverflowDirection === "function") {
                return customAgenzia.getOverflowDirection(tf);
            } else {
                return null;
            }
        }

        const overflowInstructions = me.customPluginDB?.campiSoggettiAOverflow || [];
        const labelTf = Utility.parseLabel(tf.label);

        const found = overflowInstructions.find(o => Utility.parseLabel(o.label) === labelTf);

        if (found) {
            return {
                vertical: !!found.h,
                horizontal: !!found.w
            };
        }

        return me.getDefaultOverflowDirection();
    },

    getDefaultOverflowDirection() {
        let me = this;

        const defaultDirection = Number(me.customPluginDB?.defaultDirectionOverflow || 2);

        if (defaultDirection === 1) {
            return {
                vertical: true,
                horizontal: false
            };
        }

        if (defaultDirection === 2) {
            return {
                vertical: false,
                horizontal: true
            };
        }

        return {
            vertical: false,
            horizontal: true
        };
    },

    getEditabilitaSchedaRef(itemRef) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getEditabilitaSchedaRef === "function") {
                return customAgenzia.getEditabilitaSchedaRef(itemRef);
            } else {
                return null;
            }
        }

        const rules = me.customPluginDB?.editSchedaRefRules || [];

        for (const rule of rules) {
            if (me.valutaBlocchiRegole(itemRef, rule.setRegole)) {
                return rule.valido;
            }
        }

        return true;
    },

    getSuffissoLavorazione(listaRefImpaginate) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getSuffissoLavorazione === "function") {
                return customAgenzia.getSuffissoLavorazione(listaRefImpaginate);
            } else {
                return null;
            }
        }

        if (!listaRefImpaginate || listaRefImpaginate.length == 0) {
            return "";
        }

        const itemRef = listaRefImpaginate[0];
        const rulesSet = me.customPluginDB?.suffissiLavorazioneRules;

        if (!rulesSet || !rulesSet.rules) {
            return "";
        }

        const context = me.buildCustomContext(itemRef, rulesSet.contextKeys);

        for (const rule of rulesSet.rules) {
            if (me.valutaBlocchiRegole(context, rule.regole)) {
                return rule.result;
            }
        }

        return "";
    },

    getDeclinazioneMeccanica(itemRef) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getDeclinazioneMeccanica === "function") {
                return customAgenzia.getDeclinazioneMeccanica(itemRef);
            } else {
                // Istanta4: prima si restituiva null qui. Il chiamante (indexNew.js,
                // impaginaBox) lo concatena a "meccaniche" per formare il nome del
                // master spread da cercare: "meccaniche" + null diventa la stringa
                // "meccanichenull", che non esiste in nessun documento -> ogni box
                // di un cliente senza questo metodo falliva con "Meccanica non
                // trovata". "" e' il default corretto: master spread "meccaniche"
                // senza declinazione, che e' la convenzione di chi non ne ha bisogno.
                return "";
            }
        }

        const rulesSet = me.customPluginDB?.declinazioneMeccanicaRules;

        if (!rulesSet || !rulesSet.rules) {
            return "";
        }

        const context = me.buildCustomContext(itemRef, rulesSet.contextKeys);

        for (const rule of rulesSet.rules) {
            if (me.valutaBlocchiRegole(context, rule.regole)) {
                return rule.result;
            }
        }

        return rulesSet.defaultValue != null ? rulesSet.defaultValue : "";
    },

    buildCustomContext(itemRef, contextKeys) {
        let me = this;

        const canaleObj = ficoProcess.getCanaleLavorazioneCorrente();
        const areaObj = ficoProcess.getAreaLavorazioneCorrente();

        const context = {
            itemRef: itemRef,
            canale: canaleObj || {},
            area: areaObj || {}
        };

        const keys = contextKeys || [];

        for (const contextKey of keys) {
            const alias = contextKey.alias;
            const key = contextKey.key;
            const source = contextKey.source;

            if (!alias || !key || !source) {
                continue;
            }

            if (source === "Context.Tracciato") {
                context[alias] = Utility.cercaChiaveContesto(key, itemRef["Context.Tracciato"]);
            }
            else if (source === "itemRef") {
                context[alias] = me.getValueByPath(itemRef, key);
            }
            else if (source === "canale") {
                context[alias] = me.getValueByPath(context.canale, key);
            }
            else if (source === "area") {
                context[alias] = me.getValueByPath(context.area, key);
            }
        }

        return context;
    },

    getNameStileUniversale(stile) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.getNameStileUniversale === "function") {
                return customAgenzia.getNameStileUniversale(stile);
            } else {
                return null;
            }
        }

        const listaStiliUniversali = me.customPluginDB?.listaStiliUniversali || [];

        for (let i = 0; i < listaStiliUniversali.length; i++) {
            const stileUniversale = listaStiliUniversali[i];

            if (!stileUniversale || !stileUniversale.rule) {
                continue;
            }

            if (stileUniversale.rule.indexOf("IN$") >= 0) {
                const ruleValue = stileUniversale.rule.replace("IN$", "");

                if (stile && stile.indexOf(ruleValue) >= 0) {
                    return stileUniversale;
                }
            }
        }

        return null;
    },

    setBolloNOFOTO(name) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.setBolloNOFOTO === "function") {
                return customAgenzia.setBolloNOFOTO(name);
            } else {
                return null;
            }
        }

        if (!me.customPluginDB) {
            return null;
        }

        me.customPluginDB.nomeNoFoto = name;
    },

    setBolloFOTONOFOUND(name) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined" && typeof customAgenzia.setBolloFOTONOFOUND === "function") {
                return customAgenzia.setBolloFOTONOFOUND(name);
            } else {
                return null;
            }
        }

        if (!me.customPluginDB) {
            return null;
        }

        me.customPluginDB.fotoNotFound = name;
    },

    applicaSchemaDiOrdinamentoConPesi(_lista, field, chiaveSchema) {
        let me = this;

        if (me.callCustom) {
            if (typeof customAgenzia !== "undefined") {
                if(chiaveSchema == "aree" && typeof customAgenzia.applicaSchemaDiOrdinamentoAree === "function"){
                    return customAgenzia.applicaSchemaDiOrdinamentoAree(_lista, field);
                }
                else if (chiaveSchema == "canali" && typeof customAgenzia.applicaSchemaDiOrdinamentoCanali === "function"){
                    return customAgenzia.applicaSchemaDiOrdinamentoCanali(_lista, field);
                }
            } else {
                return null;
            }
        }

        const schemi = me.customPluginDB?.schemiOrdinamentoConPesi || [];
        const schema = schemi.find(s => s.titolo === chiaveSchema);

        if (!schema) {
            return _lista;
        }

        const gerarchia = schema.gerarchia || [];
        const regex = schema.regex ? new RegExp(schema.regex) : null;

        const getPeso = function (text) {
            if (text === undefined || text === null) {
                return 9999;
            }

            const value = String(text);

            if (regex) {
                const match = value.match(regex);

                if (!match) {
                    return 9999;
                }

                const matchedValue = match[1] || match[0];
                const base = gerarchia.indexOf(matchedValue);

                return base === -1 ? 9999 : base;
            }

            const base = gerarchia.indexOf(value);
            return base === -1 ? 9999 : base;
        };

        const sorted = _lista.sort(function (a, b) {
            const valueA = field == "" ? a : a[field];
            const valueB = field == "" ? b : b[field];

            const pesoA = getPeso(valueA);
            const pesoB = getPeso(valueB);

            return pesoA - pesoB;
        });

        return sorted;
    },

    getLibreria() {
        let me = this;

        if (me.callCustom) {
            return null;
        }

        const rulesSet = me.customPluginDB?.regoleLibrerie;

        if (!rulesSet || rulesSet.length === 0) {
            return null;
        }

        //ruleset è una lista di
//         public class AgenziaCustomPlugin_LibreriaIndd {
//             public int ordine { get; set; }
            // public List<string> canale { get; set; } = new List < string > (); //una lista vuota indica che va bene qualsiasi canale
            // public List < string > area { get; set; } = new List < string > (); //una lista vuota indica che va bene qualsiasi area
            // public List < FicoContextField > context { get; set; }
            // public List < string > nomePromo { get; set; } = new List < string > (); //una lista vuota indica che non ci sono controlli sul nome promo
            // public List < string > formati { get; set; } = new List < string > (); //una lista vuota indica che non ci sono controlli sul nome promo
            // public List < int > tipoLavorazione { get; set; } = new List < int > (); //una lista vuota indica che non ci sono controlli sul tipoLavorazione
            // public List < string > nomeLibreria { get; set; } = new List < string > (); //la lista non può essere vuota
        // }

        //il primo passo è ordinarla
        const sortedRules = rulesSet.sort((a, b) => a.ordine - b.ordine);

        var promoContext = [];
        var titolo = "";
        var canale = ficoProcess.getCanaleLavorazioneCorrente();
        var siglaCanale = canale ? canale.sigla : "";
        var area = ficoProcess.getAreaLavorazioneCorrente();
        var siglaArea = area ? area.sigla : "";
        var metaLavorazione = ficoProcess.metaLavorazioneCorrente;
        if (metaLavorazione) {
            var meta = metaLavorazione.meta;
            if (meta) {
                promoContext = meta.context || [];
                titolo = meta.titolo || "";
            }
        }
        //il risultato sarà 1 o 2
        var tipoLavorazione = ficoProcess.getTipoLavorazioneCorrente();

        //leggiamo il formato delle pagine di indd
        const doc = app.activeDocument;
        const pageWidth = doc.documentPreferences.pageWidth;
        const pageHeight = doc.documentPreferences.pageHeight;
        
        var libreria = null;
        //adesso cerchiamo la prima che regola che fa match
        //per ogni campo abbiamo una lista di valori, se anche solo uno di questi valori matcha allora la regola è soddisfatta. E' soddisfatta anche se la lista è vuota.
        //nomePromo è leggermente diverso e invece che fare un confronto preciso cerchiamo se è incluso dentro il titolo della promo
        //quando un campo è stato trovato prendiamo il suo nomeLibreria
        for (const rule of sortedRules) {
            const canaleMatch = !rule.canale || rule.canale.length === 0 || rule.canale.some(c => c === siglaCanale);
            const areaMatch = !rule.area || rule.area.length === 0 || rule.area.some(a => a === siglaArea);
            const contextMatch = !rule.context || rule.context.length === 0 
            || rule.context.every(ctx => promoContext.some(pc => pc.nome_field === ctx.nome_field && pc.user_value === ctx.user_value));
            const formatoMatch = !rule.formati || rule.formati.length === 0 || rule.formati.some(f => {
                const parts = f.split("x");
                if (parts.length != 2) {
                    return false;
                }
                const width = Number(parts[0]);
                const height = Number(parts[1]);
                return (Math.abs(pageWidth - width) <= 1 && Math.abs(pageHeight - height) <= 1) || (Math.abs(pageWidth - height) <= 1 && Math.abs(pageHeight - width) <= 1);
            });
            const promoMatch = !rule.nomePromo || rule.nomePromo.length === 0 || rule.nomePromo.some(np => titolo.indexOf(np) >= 0);
            const tipoLavorazioneMatch = !rule.tipoLavorazione || rule.tipoLavorazione.length === 0 || rule.tipoLavorazione.some(tl => tl === tipoLavorazione);

            if (canaleMatch && areaMatch && contextMatch && formatoMatch && promoMatch && tipoLavorazioneMatch) {
                libreria = rule.nomeLibreria;
                break;
            }
        }

        //se libreria è ancora null allora prendiamo il valore di default
        if (libreria == null) {
            //nessuna regola ha matchato
            return null;
        }

        var openedLib = app.libraries.everyItem().getElements();
        //adesso cerchiamo la prima libreria valida in lista e la restituiamo
        for (const lib of libreria) {
            //lib è il nome della libreria da cercare
            var libName = lib;

            const found = openedLib.find(l => {
                const openedName = typeof l.name === "string" ? l.name.split("$")[0] : l.name;
                return openedName === libName;
            });
            if (found && found.isValid) {
                return found;
            }
        }

        //la libreria indicata non è stata trovata tra quelle aperte, restituiamo un errore che indica che la libreria indicata non è stata trovata tra quelle aperte
        //messaggioUtente("Code PMW-005: Nessuna delle librerie richieste per questa lavorazione (" + libreria.join(", ") + ") è stata trovata tra quelle aperte. Verificare che la libreria sia aperta in InDesign e che il nome sia corretto.", "error");
        throw new Error("Code PMW-005: Nessuna delle librerie richieste per questa lavorazione (" + libreria.join(", ") + ") è stata trovata tra quelle aperte. Verificare che la libreria sia aperta in InDesign e che il nome sia corretto.");

    },

    getTemplateFiltri() {
        return this.customPluginDB?.templateFiltro || [];
    },


    //*funzioni di lettura regole
    //#region valutazione regole e istruzioni

    valutaBlocchiRegole(itemRef, blocchiRegole) {
        let me = this;

        if (!blocchiRegole || blocchiRegole.length === 0) {
            return true;
        }

        return blocchiRegole.every(blocco => me.valutaBloccoRegole(itemRef, blocco));
    },

    valutaBloccoRegole(itemRef, blocco) {
        let me = this;

        if (!blocco) {
            return true;
        }

        const regole = blocco.regole || [];
        const regoleAnnidate = blocco.regoleAnnidate || [];

        const regoleValide = regole.every(regola => me.valutaRegolaCondizione(itemRef, regola));
        const annidateValide = regoleAnnidate.every(bloccoAnnidato => me.valutaBloccoRegole(itemRef, bloccoAnnidato));

        return regoleValide && annidateValide;
    },

    valutaRegolaCondizione(itemRef, regola) {
        let me = this;

        const campo = regola.campo;
        const operatore = regola.operatore;
        const expectedValue = regola.value;

        const actualValue = me.getValueByPath(itemRef, campo);

        switch (operatore) {
            case 0: // Equals
                return me.normalize(actualValue) === me.normalize(expectedValue);

            case 1: // NotEquals
                return me.normalize(actualValue) !== me.normalize(expectedValue);

            case 2: // Contains
                return me.normalize(actualValue).indexOf(me.normalize(expectedValue)) >= 0;

            case 3: // NotContains
                return me.normalize(actualValue).indexOf(me.normalize(expectedValue)) < 0;

            case 4: // In
                return me.isIn(actualValue, expectedValue);

            case 5: // NotIn
                return !me.isIn(actualValue, expectedValue);

            case 6: // Exist
                return actualValue !== undefined && actualValue !== null && actualValue !== "";

            case 7: // NotExist
                return actualValue === undefined || actualValue === null || actualValue === "";

            default:
                console.warn("Operatore non gestito:", operatore, regola);
                return false;
        }
    },

    getValueByPath(source, path) {
        let me = this;

        if (!source || !path) {
            return null;
        }

        if (source[path] !== undefined) {
            return source[path];
        }

        const parts = path.split(".");
        let current = source;

        for (const part of parts) {
            if (current === undefined || current === null) {
                return null;
            }

            current = current[part];
        }

        return current;
    },

    normalize(value) {
        let me = this;

        if (value === undefined || value === null) {
            return "";
        }

        return String(value).toLowerCase().trim();
    },

    isIn(actualValue, expectedValue) {
        let me = this;

        const actual = me.normalize(actualValue);

        if (Array.isArray(expectedValue)) {
            return expectedValue
                .map(x => me.normalize(x))
                .includes(actual);
        }

        if (typeof expectedValue === "string" && expectedValue.indexOf("||") >= 0) {
            return expectedValue
                .split("||")
                .map(x => me.normalize(x))
                .includes(actual);
        }

        if (Array.isArray(actualValue)) {
            const expected = me.normalize(expectedValue);

            return actualValue
                .map(x => me.normalize(x))
                .includes(expected);
        }

        return actual.indexOf(me.normalize(expectedValue)) >= 0;
    },




    //#endregion
}

module.exports = pluginMiddleware;
