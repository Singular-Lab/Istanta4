/*
 * I20-1062, lotto 1: il Plugin mostra l'errore che Istanta da' per la scheda del gruppo.
 *
 * Da questo lotto getSchedaRef risponde con un messaggio breve in error (passo e motivo, o tipo e
 * riga) e la traccia completa in dettaglio. Il Plugin deve mostrare il primo e lasciare il secondo
 * alla console. Prima schedaArtwork usava la risposta senza guardarne l'esito: l'errore diventava
 * un TypeError su records[0], poi ATW-3 senza il motivo vero; e SRF-03 e ATW-2 coprivano il motivo
 * dato dal client HTTP con un messaggio generico.
 *
 * schedaRef.js, schedaArtwork.js e indexNew.js fanno require('indesign') e sotto Node non si
 * caricano: si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

test("schedaArtwork guarda l'esito prima di usare i record, e mostra l'errore del server", () => {
    const testo = sorgente("schedaArtwork.js");
    const controllo = testo.indexOf("if (schedaRef == null || schedaRef.esito === false || schedaRef.records == null || schedaRef.records.length == 0) {");
    const primoUso = testo.indexOf("schedaRef.records[0]");

    assert.ok(controllo > 0, "manca il controllo dell'esito");
    assert.ok(primoUso > controllo, "i record si usano solo dopo il controllo");
    assert.match(testo, /messaggioUtente\("Code ATW-14 Gruppo " \+ cod \+ ": " \+ \(schedaRef != null && schedaRef\.error \? schedaRef\.error : "il server non ha restituito record"\), "error"\);/);
});

test("il codice ATW-14 e' usato una volta sola", () => {
    assert.strictEqual((sorgente("schedaArtwork.js").match(/ATW-14\b/g) || []).length, 1);
});

test("SRF-03 e ATW-2 dicono il motivo del client HTTP, se c'e'", () => {
    assert.match(sorgente("schedaRef.js"), /messaggioUtente\("Code SRF-03 Errore generico durante la richiesta" \+ \(motivo \? ": " \+ motivo : ""\), "error"\);/);
    assert.match(sorgente("schedaArtwork.js"), /messaggioUtente\("Code ATW-2 Errore durante la richiesta" \+ \(motivo \? ": " \+ motivo : ""\), "error"\);/);
});

test("il dettaglio del server va in console, il messaggio breve all'operatore", () => {
    assert.match(sorgente("schedaRef.js"), /if \(schedaRef\.dettaglio\) \{\s*console\.error\("Dettaglio dell'errore del server:", schedaRef\.dettaglio\);\s*\}\s*messaggioUtente\("Code SRF-04 Errore sul server durante la richiesta: " \+ schedaRef\.error, "error"\);/);
    assert.match(sorgente("indexNew.js"), /if \(objResult\.dettaglio\) \{\s*console\.error\("Dettaglio dell'errore del server:", objResult\.dettaglio\);\s*\}\s*messaggioUtente\("Code IDX-107 /);
});
