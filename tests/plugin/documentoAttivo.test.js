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

/* ---- TASK-16def236: documento chiuso durante l'impaginazione ---- */
//L'operatore chiude il documento (Cmd+W) mentre il Plugin impagina: la schermata di attesa restava
//su "Leggo i filtri per l'impaginazione" e il Plugin occupato per sempre.

test("un documento chiuso si riconosce senza lanciare", () => {
    assert.strictEqual(InddEvents.documentoChiuso(salvato(1, "/Lavori/CN_TO_05-11-26.indd")), false);
    assert.strictEqual(InddEvents.documentoChiuso({ id: 1, isValid: false }), true);
    assert.strictEqual(InddEvents.documentoChiuso(null), true);
    assert.strictEqual(InddEvents.documentoChiuso({ get isValid() { throw new Error("Object is invalid"); } }), true);
});

test("il messaggio di documento chiuso ha il codice, il nome e il lavoro fermato", () => {
    assert.strictEqual(InddEvents.messaggioDocumentoChiuso("CN_TO_05-11-26.indd", true),
        "Code IDX-201 Il documento CN_TO_05-11-26.indd è stato chiuso durante l'impaginazione: l'impaginazione si è fermata");
    assert.strictEqual(InddEvents.messaggioDocumentoChiuso("CN_TO_05-11-26.indd", false),
        "Code IDX-201 Il documento CN_TO_05-11-26.indd è stato chiuso durante il conteggio: il conteggio si è fermato");
    //Senza nome il messaggio resta leggibile.
    assert.strictEqual(InddEvents.messaggioDocumentoChiuso("", true),
        "Code IDX-201 Il documento è stato chiuso durante l'impaginazione: l'impaginazione si è fermata");
});

test("l'impaginazione si ferma solo se il documento e' chiuso", () => {
    assert.doesNotThrow(() => InddEvents.fermaSeDocumentoChiuso(salvato(1, "/a.indd"), "a.indd"));
    assert.throws(() => InddEvents.fermaSeDocumentoChiuso({ isValid: false }, "a.indd"), /^Error: Code IDX-201 Il documento a\.indd è stato chiuso/);
});

test("le letture del documento dopo \"Leggo i filtri\" stanno dentro il try", () => {
    const motore = corpoFunzione(sorgente("indexNew.js"), "async function _conteggiaImpaginaConContesto(");
    const leggo = motore.indexOf("showLoading(impagina ? \"Leggo i filtri per l'impaginazione\"");
    assert.ok(leggo > 0);
    const prova = motore.indexOf("try {", leggo);
    assert.ok(prova > leggo);
    //Il Plugin si dichiara occupato e legge le pagine solo dentro il try, il cui catch toglie l'attesa.
    assert.ok(prova < motore.indexOf("indesignEvents.setBusy(true);", leggo));
    assert.ok(prova < motore.indexOf("docInLavorazione.pages.everyItem()", leggo));
});

test("ogni pagina e ogni box del motore controllano prima il documento", () => {
    const motore = corpoFunzione(sorgente("indexNew.js"), "async function _conteggiaImpaginaConContesto(");
    const box = motore.match(/[^\n]*\n[^\n]*res = await impaginaBox\(/g);
    assert.strictEqual(box.length, 3);
    box.forEach(b => assert.match(b, /InddEvents\.fermaSeDocumentoChiuso\(docInLavorazione, nomeDocumentoImpaginazione\);/));
    //Uno per ogni box, uno per le pagine del volantino e uno per quelle del PoP.
    assert.strictEqual(motore.split("InddEvents.fermaSeDocumentoChiuso(").length - 1, 5);
});

test("i catch del motore dicono che il documento e' stato chiuso", () => {
    const motore = corpoFunzione(sorgente("indexNew.js"), "async function _conteggiaImpaginaConContesto(");
    //IDX-27 del volantino e i tre IDX-32 (volantino, risposta del PoP, PoP).
    const avvisi = motore.match(/if \(InddEvents\.documentoChiuso\(docInLavorazione\)\) \{\s*messaggioUtente\(InddEvents\.messaggioDocumentoChiuso\(nomeDocumentoImpaginazione, impagina\), "warning"\);\s*\}\s*else (if \(!\(ex != null && ex\.giaSegnalato === true\)\) \{\s*messaggioUtente\("Code IDX-27|\{\s*messaggioUtente\("Code IDX-32)/g);
    assert.strictEqual(avvisi.length, 4);
    //Il nome si legge all'avvio, prima che il documento si possa chiudere.
    assert.ok(motore.indexOf("nomeDocumentoImpaginazione = docInLavorazione.name;") < motore.indexOf("showLoading("));
});

test("a documento chiuso la schermata delle segnalazioni non si apre sul documento rimasto davanti", () => {
    const motore = corpoFunzione(sorgente("indexNew.js"), "async function _conteggiaImpaginaConContesto(");
    //Volantino e PoP: le due aperture automatiche del motore.
    assert.strictEqual((motore.match(/SchermataSegnalazioni\.apriSeCiSono\(/g) || []).length, 2);
    assert.match(motore, /if \(impagina && !InddEvents\.documentoChiuso\(docInLavorazione\)\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(/);
    assert.match(motore, /if \(!InddEvents\.documentoChiuso\(docInLavorazione\)\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj, SchermataSegnalazioni\.pagineDelRisultato\(objResult, restartFromIndexPoP\)\);/);
});

/* ---- I20-1210: il nome del documento sopra "Impaginazione di pagina: N" ---- */

//showLoading del pannello, eseguita con un $ finto che ricorda testo e visibilita' di ogni elemento.
function attesaFinta() {
    const elementi = {};
    const elemento = nome => elementi[nome] || (elementi[nome] = {
        testo: null,
        visibile: null,
        text(t) { this.testo = t; return this; },
        show() { this.visibile = true; return this; },
        hide() { this.visibile = false; return this; }
    });
    const $ = selettore => ({
        show() { elemento(selettore).show(); return this; },
        find: figlio => elemento(selettore + " " + figlio)
    });
    const showLoading = new Function("$", "CampiARiposo",
        corpoFunzione(sorgente("indexNew.js"), "function showLoading(") + "\n}\nreturn showLoading;")($, { tuttiARiposo() { } });
    return { showLoading, sopra: () => elemento("#loadingPanel .loadingSopra"), titolo: () => elemento("#loadingPanel h1") };
}

test("I20-1210: durante l'impaginazione il nome del documento sta sopra la pagina in corso", () => {
    const attesa = attesaFinta();

    attesa.showLoading("Impaginazione di pagina: 9", "P2624_VOL_19-11-26_SSSA.indd");

    assert.strictEqual(attesa.titolo().testo, "Impaginazione di pagina: 9");
    assert.strictEqual(attesa.sopra().testo, "P2624_VOL_19-11-26_SSSA.indd");
    assert.strictEqual(attesa.sopra().visibile, true);
});

test("I20-1210: le altre attese non mostrano il nome, nemmeno dopo un'impaginazione", () => {
    const attesa = attesaFinta();

    attesa.showLoading("Impaginazione di pagina: 9", "P2624_VOL_19-11-26_SSSA.indd");
    attesa.showLoading("Scaricamento lista...");

    assert.strictEqual(attesa.titolo().testo, "Scaricamento lista...");
    assert.strictEqual(attesa.sopra().testo, "");
    assert.strictEqual(attesa.sopra().visibile, false);

    //Un documento chiuso prima di leggerne il nome: niente riga vuota sopra il messaggio.
    attesa.showLoading("Impaginazione di pagina: 3", "");
    assert.strictEqual(attesa.sopra().visibile, false);
});

test("I20-1210: le due attese dell'impaginazione passano il nome del documento, e il pannello ha la riga", () => {
    const motore = corpoFunzione(sorgente("indexNew.js"), "async function _conteggiaImpaginaConContesto(");
    const pagina = motore.match(/showLoading\("Impaginazione di pagina: " \+ filtroResult\.pag[^)]*\)/g);

    assert.strictEqual(pagina.length, 2);
    pagina.forEach(p => assert.strictEqual(p, 'showLoading("Impaginazione di pagina: " + filtroResult.pag, nomeDocumentoImpaginazione)'));

    const html = sorgente("index.html");
    const pannello = html.substring(html.indexOf('<div id="loadingPanel"'), html.indexOf("</div>", html.indexOf('<div id="loadingPanel"')));
    assert.ok(pannello.indexOf('class="loadingSopra"') > 0 && pannello.indexOf('class="loadingSopra"') < pannello.indexOf("<h1>"),
        "la riga del nome sta sopra il messaggio");
});
