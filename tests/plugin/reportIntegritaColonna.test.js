/*
 * I20-1121: il Report Integrita' affiancato.
 *
 * Con il pannello largo almeno 924 px il report non e' piu' una finestra che copre il Plugin: e' una
 * colonna a destra (vistaAffiancata.js) e a sinistra si lavora, con gli eventi accesi. "Trova" porta
 * sul box senza vista controllata: la scheda si apre a sinistra come per qualunque box e il report
 * resta aperto. La riga si ricontrolla quando l'operatore lascia il box (due vigilanze), preme Trova
 * su un'altra riga, preme "Ricontrolla box" o il pannello si stringe sotto la soglia. Una colonna
 * alla volta, e il report ha la precedenza sulle segnalazioni.
 *
 * Il report si carica sotto Node con InDesign finto (come in reportIntegrita.test.js) e le globali
 * di indexNew finte; quello che costruisce l'interfaccia si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const avvio = require("../../plugin/reportIntegrita/avvio.js");
const VistaAffiancata = require("../../plugin/vistaAffiancata");

//L'app di InDesign finta: il report la prende al caricamento, la selezione la cambiano i test.
const appFinta = { selection: [], activeWindow: {} };

function caricaReport() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return { app: appFinta };
        }
        return originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/reportIntegrita/reportIntegrita.js");
    }
    finally {
        Module._load = originale;
    }
}

const ReportIntegrita = caricaReport();

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio));
}

/// Sostituisce per la durata di fn i membri indicati (sul report o sulle globali) e li rimette.
async function conSostituti(oggetto, sostituti, fn) {
    const prima = {};
    Object.keys(sostituti).forEach(k => { prima[k] = { c: Object.prototype.hasOwnProperty.call(oggetto, k), v: oggetto[k] }; oggetto[k] = sostituti[k]; });
    try {
        return await fn();
    }
    finally {
        Object.keys(prima).forEach(k => { if (prima[k].c) { oggetto[k] = prima[k].v; } else { delete oggetto[k]; } });
    }
}

/// Lo stato del report da aperto, nella forma data; il resto torna com'era a fine test.
function statoReport(forma) {
    return {
        _reportIntegritaAperto: true,
        _documentoDelReport: "doc.indd",
        _formaReport: forma,
        _boxSeguito: null,
        _schedaDalReport: null,
        _azioneReportInCorso: false,
        _adattaDopoAzione: false,
        _tracciaScheda: () => {}
    };
}

/// Le globali di indexNew che il report usa, finte.
function globaliFinte(registro) {
    return {
        indesignEvents: { setBusy: (b) => registro.push("busy:" + b), vistaControllataAperta: () => false },
        schedaRef: { isBusy: false, serveRiaggancioDalReport: (box) => box == null || box.isValid !== true },
        Modali: { chiudiModal: () => registro.push("chiudiModal") },
        SchermataSegnalazioni: { allineaSegnalino: () => {}, chiudiColonna: () => registro.push("chiudiColonnaSegnalazioni"), centraSullaSelezione: () => true },
        document: { getElementById: () => null },
        showLoading: () => {},
        hideLoading: () => {},
        messaggioUtente: () => {}
    };
}

/* ---- le regole pure ---- */

test("la riga del box seguito si ricontrolla dopo due vigilanze di fila fuori dal box", () => {
    const prima = avvio.contoAbbandono(0, false, false);
    assert.deepStrictEqual(prima, { conto: 1, ricontrolla: false });
    assert.deepStrictEqual(avvio.contoAbbandono(prima.conto, false, false), { conto: 2, ricontrolla: true });
    //Tornare sul box rimette il conto a zero.
    assert.deepStrictEqual(avvio.contoAbbandono(1, true, false), { conto: 0, ricontrolla: false });
    assert.deepStrictEqual(avvio.contoAbbandono(undefined, false, false), { conto: 1, ricontrolla: false });
    //Mentre si lavora non si conta: Reimpagina rifa' il box e per un momento non e' selezionato.
    assert.deepStrictEqual(avvio.contoAbbandono(1, false, true), { conto: 0, ricontrolla: false });
});

test("sul box vuol dire selezionare il box o qualcosa che ci sta dentro", () => {
    const gruppo = { id: 42, parent: { id: 1, parent: null } };
    const cornice = { id: 7, parent: gruppo };
    const testo = { parentTextFrames: [cornice] };

    assert.strictEqual(avvio.selezioneSulBox([gruppo], 42), true);
    assert.strictEqual(avvio.selezioneSulBox([cornice], 42), true);
    //Il cursore nel testo di una cornice del box: si risale dalla cornice.
    assert.strictEqual(avvio.selezioneSulBox([testo], 42), true);
    //Anche in una selezione di piu' oggetti.
    assert.strictEqual(avvio.selezioneSulBox([{ id: 99, parent: null }, cornice], 42), true);

    //Altrove, niente selezionato, o il box non c'e' piu'.
    assert.strictEqual(avvio.selezioneSulBox([{ id: 8, parent: { id: 9, parent: null } }], 42), false);
    assert.strictEqual(avvio.selezioneSulBox([], 42), false);
    assert.strictEqual(avvio.selezioneSulBox(null, 42), false);
    assert.strictEqual(avvio.selezioneSulBox([gruppo], null), false);

    //Un oggetto che non risponde non rompe la vigilanza: semplicemente non e' il box.
    const rotto = {};
    Object.defineProperty(rotto, "id", { get: () => { throw new Error("oggetto non valido"); } });
    Object.defineProperty(rotto, "parent", { get: () => { throw new Error("oggetto non valido"); } });
    assert.strictEqual(avvio.selezioneSulBox([rotto], 42), false);
    //La risalita ha un limite: un genitore circolare non la fa girare per sempre.
    const circolare = { id: 5 };
    circolare.parent = circolare;
    assert.strictEqual(avvio.selezioneSulBox([circolare], 42), false);
});

/* ---- gli eventi accanto al report ---- */

test("affiancato, un'azione del report ferma gli eventi finche' lavora, anche se fallisce", async () => {
    const registro = [];
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, statoReport("colonna"), async () => {
        const esito = await ReportIntegrita._conEventiFermi(async () => {
            assert.deepStrictEqual(registro, ["busy:true"]);
            return 5;
        });
        assert.strictEqual(esito, 5);
        assert.deepStrictEqual(registro, ["busy:true", "busy:false"]);

        registro.length = 0;
        await assert.rejects(ReportIntegrita._conEventiFermi(async () => { throw new Error("rotta"); }));
        assert.deepStrictEqual(registro, ["busy:true", "busy:false"]);
    }));
});

test("nel popup le azioni non toccano gli eventi: li ferma gia' il report aperto", async () => {
    const registro = [];
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, statoReport("popup"), async () => {
        await ReportIntegrita._conEventiFermi(async () => {});
        assert.deepStrictEqual(registro, []);
    }));
});

/* ---- Trova e il box seguito ---- */

test("affiancato, Trova segue il box invece di aprire la vista controllata", async () => {
    const registro = [];
    const seguiti = [];
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _seguiBoxDalReport: async (id, payload) => seguiti.push([id, payload]),
        _findElemento: () => { throw new Error("la vista controllata non deve partire"); }
    }, async () => {
        const payload = { record: { codiceGruppo: "1" } };
        await ReportIntegrita._apriSchedaDalReport("p1", payload);
        assert.deepStrictEqual(seguiti, [["p1", payload]]);
        //Il report resta aperto.
        assert.deepStrictEqual(registro, []);
        assert.strictEqual(ReportIntegrita._schedaDalReport, null);
    }));
});

test("Trova porta sul box e lo segue; il box seguito prima si ricontrolla per primo", async () => {
    const registro = [];
    const ricontrolli = [];
    const intervalli = [];
    const box = { id: 42, isValid: true };
    const record = { codiceGruppo: "100" };
    await conSostituti(global, {
        ...globaliFinte(registro),
        Utility: { getDnaOfBox: () => ({ codice: "100", codice_gruppo: "100", idRec: 7 }) },
        setInterval: (fn, ms) => { intervalli.push(ms); return "timer"; },
        clearInterval: () => {}
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: { codiceGruppo: "50" }, box: { id: 9, isValid: true }, timer: null, vigilanzeFuori: 0 },
        _ricontrollaBoxSeguito: async (motivo) => { ricontrolli.push(motivo); ReportIntegrita._boxSeguito = null; },
        _categoriaDelRecord: () => "recordCambiati",
        _findElemento: () => { registro.push("trova"); return box; },
        _descriviBox: () => null,
        _descriviRecord: () => null,
        _mostraRicontrollaBox: (v) => registro.push("ricontrollaBox:" + v)
    }, async () => {
        await ReportIntegrita._seguiBoxDalReport("p2", { record });

        assert.deepStrictEqual(ricontrolli, ["altro trova"]);
        assert.deepStrictEqual(registro, ["trova", "ricontrollaBox:true"]);
        const stato = ReportIntegrita._boxSeguito;
        assert.strictEqual(stato.box, box);
        assert.strictEqual(stato.record, record);
        assert.strictEqual(stato.codiceGruppo, "100");
        assert.strictEqual(stato.idRec, 7);
        assert.strictEqual(stato.vigilanzeFuori, 0);
        assert.deepStrictEqual(intervalli, [ReportIntegrita.INTERVALLO_VIGILANZA_SCHEDA]);
    }));
});

test("Trova su una riga che il ricontrollo ha tolto dal report non porta da nessuna parte", async () => {
    const registro = [];
    let categoria = "recordCambiati";
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box: null, timer: null },
        _ricontrollaBoxSeguito: async () => { ReportIntegrita._boxSeguito = null; categoria = null; },
        _categoriaDelRecord: () => categoria,
        _findElemento: () => { registro.push("trova"); return null; }
    }, async () => {
        await ReportIntegrita._seguiBoxDalReport("p3", { record: {} });
        assert.deepStrictEqual(registro, []);
    }));
});

test("la vigilanza ricontrolla la riga quando l'operatore lascia il box, non prima", async () => {
    const registro = [];
    const ricontrolli = [];
    const box = { id: 42, isValid: true };
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box, timer: null, vigilanzeFuori: 0 },
        _ricontrollaBoxSeguito: (motivo) => ricontrolli.push(motivo),
        _descriviBox: () => null
    }, async () => {
        //Dentro il box (il testo di una sua cornice): niente.
        appFinta.selection = [{ parentTextFrames: [{ id: 7, parent: box }] }];
        ReportIntegrita._vigilaBoxSeguito();
        ReportIntegrita._vigilaBoxSeguito();
        assert.deepStrictEqual(ricontrolli, []);

        //Fuori: la prima vigilanza conta, la seconda ricontrolla.
        appFinta.selection = [];
        ReportIntegrita._vigilaBoxSeguito();
        assert.deepStrictEqual(ricontrolli, []);
        ReportIntegrita._vigilaBoxSeguito();
        assert.deepStrictEqual(ricontrolli, ["box lasciato"]);
    }));
    appFinta.selection = [];
});

test("mentre il report o la scheda lavorano la vigilanza non conta", async () => {
    const registro = [];
    const ricontrolli = [];
    const globali = globaliFinte(registro);
    await conSostituti(global, globali, () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box: { id: 42, isValid: true }, timer: null, vigilanzeFuori: 1 },
        _ricontrollaBoxSeguito: (motivo) => ricontrolli.push(motivo)
    }, async () => {
        appFinta.selection = [];
        ReportIntegrita._azioneReportInCorso = true;
        ReportIntegrita._vigilaBoxSeguito();
        ReportIntegrita._vigilaBoxSeguito();
        ReportIntegrita._azioneReportInCorso = false;
        globali.schedaRef.isBusy = true;
        ReportIntegrita._vigilaBoxSeguito();
        assert.deepStrictEqual(ricontrolli, []);
        assert.strictEqual(ReportIntegrita._boxSeguito.vigilanzeFuori, 0);
    }));
});

test("il box rifatto da Reimpagina si ritrova per codice gruppo; se non c'e' piu' l'operatore non ci puo' essere", async () => {
    const registro = [];
    const nuovo = { id: 77, isValid: true };
    let trovato = nuovo;
    await conSostituti(global, globaliFinte(registro), () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _resolveBoxByCodiceGruppo: () => trovato
    }, async () => {
        const stato = { record: {}, box: { id: 42, isValid: false } };
        assert.strictEqual(ReportIntegrita._idDelBoxSeguito(stato), 77);
        assert.strictEqual(stato.box, nuovo);

        trovato = null;
        assert.strictEqual(ReportIntegrita._idDelBoxSeguito({ record: {}, box: { isValid: false } }), null);
    }));
});

test("il ricontrollo del box seguito applica il piano al report aperto, senza riaprirlo", async () => {
    const registro = [];
    const piano = { record: {} };
    let restituito = piano;
    await conSostituti(global, {
        ...globaliFinte(registro),
        clearInterval: (t) => registro.push("clear:" + t)
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box: { id: 42 }, timer: "t1", vigilanzeFuori: 2 },
        _ricontrollaReferenzaDopoScheda: async (stato) => { registro.push("ricontrolla"); return restituito; },
        _applicaPianoRicontrollo: async (p) => registro.push(p === piano ? "applica" : "applica?"),
        _riapriReportDopoScheda: () => registro.push("riapri"),
        _mostraRicontrollaBox: (v) => registro.push("ricontrollaBox:" + v),
        _descriviBox: () => null,
        _descriviRecord: () => null
    }, async () => {
        await ReportIntegrita._ricontrollaBoxSeguito("pulsante");
        assert.deepStrictEqual(registro, ["clear:t1", "ricontrollaBox:false", "ricontrolla", "applica"]);
        assert.strictEqual(ReportIntegrita._boxSeguito, null);
        assert.strictEqual(ReportIntegrita._azioneReportInCorso, false);

        //Senza piano (whitelist, scheda non riletta) il report resta com'era.
        registro.length = 0;
        restituito = null;
        ReportIntegrita._boxSeguito = { record: {}, box: { id: 42 }, timer: null };
        await ReportIntegrita._ricontrollaBoxSeguito("pulsante");
        assert.deepStrictEqual(registro, ["ricontrollaBox:false", "ricontrolla"]);

        //Senza box seguito non c'e' niente da ricontrollare.
        registro.length = 0;
        await ReportIntegrita._ricontrollaBoxSeguito("pulsante");
        assert.deepStrictEqual(registro, ["ricontrollaBox:false"]);
    }));
});

/* ---- chiusura e larghezza del pannello ---- */

test("affiancato, la X toglie la colonna, non la finestra, e non tocca gli eventi; il box seguito non si ricontrolla", async () => {
    const registro = [];
    const aperte = new Set(["#colonnaReportIntegrita"]);
    await conSostituti(global, {
        ...globaliFinte(registro),
        $: (sel) => ({ length: aperte.has(sel) ? 1 : 0, remove: () => aperte.delete(sel) }),
        clearInterval: () => registro.push("clear")
    }, () => conSostituti(VistaAffiancata, {
        _colonne: ["colonnaReportIntegrita"],
        _confina: (c) => registro.push("confina:" + c)
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box: {}, timer: "t" },
        _ricontrollaBoxSeguito: () => registro.push("ricontrollo")
    }, async () => {
        assert.strictEqual(ReportIntegrita.chiudiReportIntegrita(), true);
        assert.strictEqual(aperte.size, 0);
        assert.deepStrictEqual(registro, ["clear", "confina:false"]);
        assert.strictEqual(ReportIntegrita._boxSeguito, null);
        assert.strictEqual(ReportIntegrita._formaReport, null);
        assert.strictEqual(ReportIntegrita.reportIntegritaAperto(), false);
    })));
});

test("nel popup la chiusura resta quella di prima: finestra chiusa ed eventi liberati", async () => {
    const registro = [];
    await conSostituti(global, {
        ...globaliFinte(registro),
        $: () => ({ length: 0, remove: () => {} })
    }, () => conSostituti(ReportIntegrita, statoReport("popup"), async () => {
        assert.strictEqual(ReportIntegrita.chiudiReportIntegrita(), true);
        assert.deepStrictEqual(registro, ["chiudiModal", "busy:false"]);
    }));
});

test("stringendo il pannello sotto la soglia la riga seguita si ricontrolla, poi il report torna popup", async () => {
    const registro = [];
    let larghezza = 600;
    await conSostituti(global, globaliFinte(registro), () => conSostituti(VistaAffiancata, {
        larghezzaPannello: () => larghezza
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("colonna"),
        _boxSeguito: { record: {}, box: {}, timer: null },
        _ricontrollaBoxSeguito: async (motivo) => { registro.push("ricontrollo:" + motivo); ReportIntegrita._boxSeguito = null; },
        _saveCurrentReportAndWhitelist: () => registro.push("salva"),
        _refreshConfrontoReportUi: () => registro.push("ridisegna")
    }, async () => {
        await ReportIntegrita.adattaVista();
        assert.deepStrictEqual(registro, ["ricontrollo:pannello stretto", "salva", "ridisegna"]);

        //Con la forma gia' giusta non si ridisegna niente.
        registro.length = 0;
        larghezza = 1200;
        await ReportIntegrita.adattaVista();
        assert.deepStrictEqual(registro, []);
    })));
});

test("allargando il pannello il popup diventa colonna; mentre un'azione lavora si aspetta che finisca", async () => {
    const registro = [];
    await conSostituti(global, globaliFinte(registro), () => conSostituti(VistaAffiancata, {
        larghezzaPannello: () => 1200
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("popup"),
        _saveCurrentReportAndWhitelist: () => registro.push("salva"),
        _refreshConfrontoReportUi: () => registro.push("ridisegna")
    }, async () => {
        ReportIntegrita._azioneReportInCorso = true;
        await ReportIntegrita.adattaVista();
        assert.deepStrictEqual(registro, []);
        assert.strictEqual(ReportIntegrita._adattaDopoAzione, true);

        ReportIntegrita._azioneReportInCorso = false;
        await ReportIntegrita.adattaVista();
        assert.deepStrictEqual(registro, ["salva", "ridisegna"]);
    })));
});

test("con la scheda in vista controllata, o a report chiuso, la larghezza non cambia niente", async () => {
    const registro = [];
    await conSostituti(global, globaliFinte(registro), () => conSostituti(VistaAffiancata, {
        larghezzaPannello: () => 1200
    }, () => conSostituti(ReportIntegrita, {
        ...statoReport("popup"),
        _schedaDalReport: { box: {} },
        _refreshConfrontoReportUi: () => registro.push("ridisegna")
    }, async () => {
        await ReportIntegrita.adattaVista();
        ReportIntegrita._schedaDalReport = null;
        ReportIntegrita._reportIntegritaAperto = false;
        await ReportIntegrita.adattaVista();
        assert.deepStrictEqual(registro, []);
    })));
});

/* ---- sul sorgente: l'interfaccia ---- */

const report = sorgente("reportIntegrita/reportIntegrita.js");
const pannelli = sorgente("reportIntegrita/pannelli.js");

test("il report sceglie la forma dalla larghezza del pannello, e nella colonna usa id suoi", () => {
    const compila = corpoMembro(report, "    compilaReportConfronto(report, options = {}) {");
    assert.match(compila, /const affiancato = VistaAffiancata\.forma\(VistaAffiancata\.larghezzaPannello\(\)\) === "colonna";/);
    assert.match(compila, /if \(affiancato\) \{\s*this\._apriColonnaReport\(\);\s*\}/);
    //Il popup di sempre, che ferma gli eventi.
    assert.match(compila, /indesignEvents\.setBusy\(true\);\s*\}\s*Modali\.apriModal\("dialogConfrontoReport"/);
    //Le copie della testata del popup restano nel documento: nella colonna gli id sono altri.
    assert.match(compila, /document\.getElementById\(affiancato \? this\.ID_AZIONI_COLONNA : "pulsantiTestataConfronto"\)/);
    assert.match(compila, /affiancato \? "scaricaReportConfrontoCsvColonna" : "scaricaReportConfrontoCsv"/);
    assert.match(compila, /affiancato \? "cartellaReportConfrontoCsvColonna" : "cartellaReportConfrontoCsv"/);
    assert.match(compila, /document\.getElementById\(affiancato \? this\.ID_CORPO_COLONNA : "bodyConfrontoReport"\)/);
    //Il suggerimento della cartella si aggiorna su tutti e due i pulsanti.
    const titolo = corpoMembro(pannelli, "    _aggiornaTitoloCartellaCsv() {");
    assert.match(titolo, /\["cartellaReportConfrontoCsv", "cartellaReportConfrontoCsvColonna"\]/);
});

test("la colonna del report: una alla volta, eventi accesi, X con la domanda di sempre", () => {
    const apri = corpoMembro(report, "    _apriColonnaReport() {");
    //Le segnalazioni affiancate lasciano il posto al report.
    assert.match(apri, /SchermataSegnalazioni\.chiudiColonna\(true\)/);
    //Dal popup: finestra chiusa ed eventi liberati.
    assert.match(apri, /if \(this\._formaReport === "popup"\) \{[\s\S]*?Modali\.chiudiModal\(\);[\s\S]*?indesignEvents\.setBusy\(false\);/);
    assert.match(apri, /VistaAffiancata\.creaColonna\(\{[\s\S]*?id: this\.ID_COLONNA,[\s\S]*?scorre: false,/);
    assert.match(apri, /this\._ricontrollaBoxSeguito\("pulsante"\)/);
    //La X chiede come quella del popup (index.html).
    const domanda = "Sicuro di voler interrompere il processo di controllo integrità?";
    assert.ok(apri.includes("Modali.confirm('" + domanda + "')"));
    assert.ok(sorgente("index.html").includes("Modali.confirm('" + domanda + "')"));
});

test("le azioni del report e i pulsanti che lavorano sul documento fermano gli eventi", () => {
    const azione = corpoMembro(report, "    async _onConfrontoAction(ev, action) {");
    assert.match(azione, /await this\._conEventiFermi\(\(\) => this\._eseguiAzioneConfronto\(action, payloadId, payload\)\)/);
    assert.match(pannelli, /this\._conEventiFermi\(\(\) => this\._eliminaTuttiUsciti\(records\)\)/);
    assert.match(pannelli, /await this\._conEventiFermi\(\(\) => this\._impaginaTuttiNuoviInCoda\(\)\)/);
    assert.match(pannelli, /await this\._conEventiFermi\(\(\) => this\._impaginaNuovoSingolo\(rowData, input\)\)/);
    //I controlli nativi del report si spengono sotto i popup, che nella vista affiancata li coprono.
    assert.strictEqual((pannelli.match(/\.classList\.add\("hideble"\)/g) || []).length, 6);
});

test("un report nuovo prende il posto di quello affiancato, e affiancato non tiene il busy", () => {
    const avvia = corpoMembro(report, "    async avviaReportIntegrita(idKit = null) {");
    assert.match(avvia, /if \(ReportIntegrita\.reportAffiancato\(\)\) \{\s*ReportIntegrita\.chiudiReportIntegrita\(\);\s*\}\s*try \{/);
    assert.match(avvia, /if \(!ReportIntegrita\.reportIntegritaAperto\(\) \|\| ReportIntegrita\.reportAffiancato\(\)\) \{\s*indesignEvents\.setBusy\(false\);/);
});

test("il ricontrollo rilegge la scheda anche se il pannello l'ha gia' invalidata", () => {
    //Lasciato il box, EVENT_NO_REF_SELECTED invalida la scheda: senza questo la rilettura falliva.
    const rilettura = corpoMembro(report, "    _leggiSchedaRefAggiornata(codiceGruppo, idRec) {");
    assert.match(rilettura, /\}, idRec, true\);/);
    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /getSchedaRef\(codiceGruppo, callback, idRec = 0, ignoraInvalidazione = false\) \{/);
    assert.match(scheda, /if \(me\.isInvalidated && !ignoraInvalidazione\) \{\s*console\.warn\("La scheda ref non è più valida"\);/);
});

test("all'allargarsi del pannello si adatta prima il report, poi le segnalazioni", () => {
    const indexNew = sorgente("indexNew.js");
    assert.match(indexNew, /lastPannelloDimension = VistaAffiancata\.larghezzaPannello\(\);\s*\/\/I20-1121[^\n]*\n\s*ReportIntegrita\.adattaVista\(\);\s*SchermataSegnalazioni\.adattaVista\(\);/);
});
