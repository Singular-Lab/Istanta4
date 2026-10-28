/*
 * I20-1069, gruppo 2: le azioni sul box mostrano il motivo che da' Istanta, e niente lo copre.
 *
 * Prima: dopo un errore dell'impaginazione singola il Plugin aspettava venti secondi e aggiungeva
 * IDX-94 "Timeout", che copriva il messaggio vero; Edit P/S diceva "Richiesta completata con
 * successo" per ogni risposta 200, anche con il salvataggio fallito, e senza risposta non diceva
 * niente; noRender, ricollegamento e cambio strutturale, senza risposta, tacevano; SRF-53 non diceva
 * il motivo; e la traccia del server non arrivava in console.
 *
 * indexNew.js, schedaRef.js e schedaFoto.js fanno require('indesign') e sotto Node non si caricano:
 * si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function tratto(testo, inizio, fine) {
    const da = testo.indexOf(inizio);
    assert.ok(da >= 0, "manca " + inizio);
    const a = testo.indexOf(fine, da + inizio.length);
    assert.ok(a > da, "manca " + fine + " dopo " + inizio);
    return testo.substring(da, a);
}

const DETTAGLIO = /if \((objResult2?|objResult)\.dettaglio\) \{\s*console\.error\("Dettaglio dell'errore del server:", (objResult2?|objResult)\.dettaglio\);\s*\}/;

/* ---- impaginazione singola ---- */

test("l'impaginazione singola smette di aspettare anche quando il server risponde con un errore", () => {
    const funzione = tratto(sorgente("indexNew.js"), "async function impaginaSingolo(", "\n}\n");

    //Ogni uscita della richiesta segna la fine: onload (nel finally), stato diverso da 200, onerror.
    assert.match(funzione, /finally \{\s*finito = true;/);
    assert.match(funzione, /\} else \{\s*finito = true;/);
    assert.match(funzione, /xhr\.onerror = function \(motivo\) \{\s*finito = true;/);
    //L'attesa guarda finito, e il timeout solo se la richiesta non e' finita davvero.
    assert.match(funzione, /while\(!finito && securityCounter < 200\)\{/);
    assert.match(funzione, /if\(!finito\)\{\s*messaggioUtente\("Code IDX-94 /);
    assert.doesNotMatch(funzione, /while\(!res /);
});

test("IDX-90 scrive in console la traccia del server, e l'avviso della scheda si mostra", () => {
    const funzione = tratto(sorgente("indexNew.js"), "async function impaginaSingolo(", "\n}\n");
    const errore = tratto(funzione, "if(!objResult.esito){", "messaggioUtente(\"Code IDX-90 ");
    assert.match(errore, DETTAGLIO);
    assert.match(funzione, /messaggioUtente\("Code IDX-183 Impaginazione singolo: " \+ objResult\.warn, "warning"\);/);
});

/* ---- primarie e secondarie ---- */

test("Edit P/S conferma il successo solo con le primarie e secondarie registrate", () => {
    const schedaFoto = sorgente("reperimentoFoto/schedaFoto.js");
    const risposta = tratto(schedaFoto, "if (!objResult2.esito) {", "//aggiorniamo il dato in schedaRef");

    const errore = risposta.indexOf("messaggioUtente(\"Code SRF-39 ");
    const successo = risposta.indexOf("messaggioUtente(\"Edit P/S: Richiesta completata con successo\", \"success\", false, 5);");
    assert.ok(errore > 0 && successo > errore, "la conferma dopo il controllo dell'esito");
    assert.match(risposta, DETTAGLIO);
    //Non piu' anche nel cambio di stato, dove compariva per ogni risposta 200: la conferma e' una sola.
    assert.strictEqual(schedaFoto.split("Edit P/S: Richiesta completata con successo").length - 1, 1);
});

test("Edit P/S senza risposta lo dice", () => {
    assert.match(sorgente("reperimentoFoto/schedaFoto.js"),
        /xhr\.onerror = function \(motivo\) \{\s*messaggioUtente\("Code SRF-124 Edit P\/S: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);
});

/* ---- noRender, ricollegamento, cambio strutturale ---- */

test("il noRender rifiutato dice il motivo, e senza risposta lo dice", () => {
    const invia = tratto(sorgente("schedaRef.js"), "    inviaNoRender(elementi, destinazione = null) {", "xhr.send(\"Menabo/modificaNoRender/0\"");
    assert.match(invia, /messaggioUtente\("Code SRF-53 noRender: il server ha rifiutato il salvataggio" \+ \(objResult\.error \? ": " \+ objResult\.error : ""\), "error"\);/);
    assert.match(invia, DETTAGLIO);
    assert.match(invia, /xhr\.onerror = function \(motivo\) \{\s*messaggioUtente\("Code SRF-125 noRender: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);\s*resolve\(false\);/);
});

test("il ricollegamento senza risposta lo dice, e il suo errore porta la traccia in console", () => {
    const schedaRef = sorgente("schedaRef.js");
    const ricollega = tratto(schedaRef, "messaggioUtente(\"Code SRF-13 Ricollegamento fallito: \"", "xhr.send(\"Menabo/ricollegaBox\"");
    assert.match(ricollega, DETTAGLIO);
    assert.match(ricollega, /xhr\.onerror = function \(motivo\) \{[\s\S]*?messaggioUtente\("Code SRF-126 Ricollegamento: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);
    assert.doesNotMatch(ricollega, /console\.log\("error"\);/);
});

test("il cambio strutturale dice l'errore anche quando il box non si rifa' o il server non risponde", () => {
    const cambio = tratto(sorgente("schedaRef.js"), "messaggioUtente(\"Code SRF-64 ", "xhr.send(\"Menabo/setCambioStrutturale/\"");
    assert.match(cambio, /messaggioUtente\("Code SRF-127 Cambio strutturale: il box non e' stato reimpaginato: " \+ \(e && e\.message \? e\.message : e\), "error"\);/);
    assert.match(cambio, /xhr\.onerror = function \(motivo\) \{[\s\S]*?messaggioUtente\("Code SRF-128 Cambio strutturale: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);

    const schedaRef = sorgente("schedaRef.js");
    const errore = tratto(schedaRef, "messaggioUtente(\"Code SRF-64 ", "hideLoading();");
    assert.match(errore, DETTAGLIO);
});
