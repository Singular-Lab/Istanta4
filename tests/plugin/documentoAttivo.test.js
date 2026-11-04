/*
 * TASK-325cdb29: Cmd+N durante l'impaginazione.
 *
 * L'operatore, durante un'impaginazione, ha creato un documento con Cmd+N e il Plugin non e' piu'
 * ripartito. Su un documento mai salvato fullName lancia ("Non esiste un nome completo per i
 * documenti non salvati"): il ciclo degli eventi lo leggeva a ogni giro, finiva nel catch, e non si
 * accorgeva piu' di niente finche' quel documento stava davanti. Ora il documento si riconosce
 * anche senza percorso (InddEvents.identitaDocumento), un documento non salvato non cerca una
 * lavorazione, e a ogni box l'impaginazione rimette davanti il suo documento
 * (InddEvents.riportaDavanti).
 *
 * events.js si carica sotto Node con indesign e i moduli che richiede vuoti; indexNew.js si
 * controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const MODULI_VUOTI = new Set(["indesign", "./XMLHttpRequestClient", "./utility", "./schedaRef", "./logger", "./versionePrecedente"]);
const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (MODULI_VUOTI.has(richiesta)) {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let InddEvents;
try {
    InddEvents = require("../../plugin/events.js");
}
finally {
    Module._load = caricaOriginale;
}

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpoFunzione(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n}\n", inizio));
}

//Come in InDesign: su un documento salvato fullName e' una Promise (verificato in console UXP).
function salvato(id, percorso) {
    return {
        id,
        name: percorso.split("/").pop(),
        isValid: true,
        get fullName() {
            return Promise.resolve({ nativePath: percorso });
        }
    };
}

function nonSalvato(id, nome) {
    return {
        id,
        name: nome,
        isValid: true,
        get fullName() {
            throw new Error("Non esiste un nome completo per i documenti non salvati.");
        }
    };
}

function applicazione(documenti, attivo) {
    return { documents: documenti, activeDocument: attivo };
}

/* ---- chi e' il documento ---- */

test("un documento salvato si riconosce dal percorso, aspettando fullName", async () => {
    //Senza await il percorso era undefined: il documento aperto all'avvio non si riconosceva mai e
    //il Plugin diceva "Nessun documento aperto".
    assert.strictEqual(await InddEvents.identitaDocumento(salvato(1, "/Lavori/CN_TO_05-11-26.indd")), "/Lavori/CN_TO_05-11-26.indd");
    assert.strictEqual(await InddEvents.documentoNonSalvato(salvato(1, "/Lavori/CN_TO_05-11-26.indd")), false);
});

test("un documento mai salvato si riconosce dal nome, senza lanciare", async () => {
    assert.strictEqual(await InddEvents.identitaDocumento(nonSalvato(2, "Senza titolo-1")), "non salvato:Senza titolo-1");
    assert.strictEqual(await InddEvents.documentoNonSalvato(nonSalvato(2, "Senza titolo-1")), true);
});

test("anche un fullName che fallisce in modo asincrono vale come non salvato", async () => {
    const respinto = { id: 4, name: "Senza titolo-3", get fullName() { return Promise.reject(new Error("Non esiste un nome completo")); } };
    assert.strictEqual(await InddEvents.identitaDocumento(respinto), "non salvato:Senza titolo-3");
});

test("due documenti non salvati restano distinti", async () => {
    assert.notStrictEqual(await InddEvents.identitaDocumento(nonSalvato(2, "Senza titolo-1")), await InddEvents.identitaDocumento(nonSalvato(3, "Senza titolo-2")));
});

test("senza documento non c'e' identita'", async () => {
    assert.strictEqual(await InddEvents.identitaDocumento(null), null);
    assert.strictEqual(await InddEvents.documentoNonSalvato(null), false);
});

test("un documento che non risponde nemmeno col nome non fa lanciare", async () => {
    const rotto = { get fullName() { throw new Error("invalid"); }, get name() { throw new Error("invalid"); } };
    assert.strictEqual(await InddEvents.identitaDocumento(rotto), "non salvato:");
});

/* ---- rimettere davanti il documento del lavoro ---- */

test("con il documento del lavoro gia' davanti non cambia niente", () => {
    const lav = salvato(1, "/Lavori/CN_TO_05-11-26.indd");
    //Stesso documento, oggetto diverso: si confronta per id.
    const app = applicazione([lav], salvato(1, "/Lavori/CN_TO_05-11-26.indd"));
    const prima = app.activeDocument;
    assert.strictEqual(InddEvents.riportaDavanti(lav, app), false);
    assert.strictEqual(app.activeDocument, prima);
});

test("dopo Cmd+N il documento del lavoro torna davanti", () => {
    const lav = salvato(1, "/Lavori/CN_TO_05-11-26.indd");
    const nuovo = nonSalvato(2, "Senza titolo-1");
    const app = applicazione([nuovo, lav], nuovo);
    assert.strictEqual(InddEvents.riportaDavanti(lav, app), true);
    assert.strictEqual(app.activeDocument, lav);
});

test("senza documento valido, o senza documenti aperti, non si fa niente", () => {
    const nuovo = nonSalvato(2, "Senza titolo-1");
    const app = applicazione([nuovo], nuovo);
    assert.strictEqual(InddEvents.riportaDavanti(null, app), false);
    assert.strictEqual(InddEvents.riportaDavanti({ id: 1, isValid: false }, app), false);
    assert.strictEqual(InddEvents.riportaDavanti(salvato(1, "/a.indd"), applicazione([], null)), false);
    assert.strictEqual(app.activeDocument, nuovo);
});

test("se InDesign rifiuta il cambio non si lancia", () => {
    const lav = salvato(1, "/Lavori/CN_TO_05-11-26.indd");
    const nuovo = nonSalvato(2, "Senza titolo-1");
    const app = {
        documents: [nuovo, lav],
        get activeDocument() { return nuovo; },
        set activeDocument(d) { throw new Error("rifiutato"); }
    };
    const avvisi = console.warn;
    console.warn = () => {};
    try {
        assert.strictEqual(InddEvents.riportaDavanti(lav, app), false);
    }
    finally {
        console.warn = avvisi;
    }
});

/* ---- dove si usa ---- */

test("il ciclo degli eventi e il controllo del Report non leggono piu' fullName direttamente", () => {
    const eventi = sorgente("events.js");
    assert.doesNotMatch(eventi, /app\.activeDocument\.fullName/);
    assert.match(eventi, /var identita = await InddEvents\.identitaDocumento\(app\.activeDocument\);\s*if \(me\.lastActiveDocument != identita\) \{\s*me\.lastActiveDocument = identita;/);
    assert.match(eventi, /documentoAttuale = await InddEvents\.identitaDocumento\(app\.activeDocument\);/);
    //Nessuno la usa senza aspettarla: senza await il confronto vedrebbe una Promise.
    assert.doesNotMatch(eventi.replace(/await InddEvents\.identitaDocumento\(/g, "").replace(/static async identitaDocumento\(/, ""), /identitaDocumento\(/);
});

test("un documento non salvato non cerca la lavorazione e lo dice", () => {
    const init = corpoFunzione(sorgente("indexNew.js"), "async function initDocumentInLavorazione()");
    const controllo = init.indexOf("if (await InddEvents.documentoNonSalvato(docInLavorazione))");
    assert.ok(controllo > 0);
    assert.ok(controllo < init.indexOf("await docInLavorazione.filePath"));
    const ramo = init.substring(controllo, init.indexOf("return null;", controllo));
    assert.match(ramo, /azzeraCartelleDiSistema\(\);/);
    assert.match(ramo, /setNarrow\(/);
});

test("ogni box impaginato rimette davanti il documento dell'operazione", () => {
    const impagina = corpoFunzione(sorgente("indexNew.js"), "async function impaginaBox(meccanica, pagCoinvolta, bounds, itemRef, ...altri) {");
    assert.match(impagina, /var docDelBox = altri\[6\] != null \? altri\[6\] : docInLavorazione;/);
    assert.match(impagina, /if \(InddEvents\.riportaDavanti\(docDelBox, app\)\) \{\s*messaggioUtente\("Code IDX-199 /);
    //Prima del corpo del box.
    assert.ok(impagina.indexOf("InddEvents.riportaDavanti(") < impagina.indexOf("await impaginaBoxNelContesto("));
});
