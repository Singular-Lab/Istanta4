/*
 * I20-1033: un errore come IDX-25 (OutOfMemory in Edro21.ordinaLista) compariva nella console
 * di Utility senza dire su quale lavorazione era avvenuto. Ora ogni messaggio della console e del
 * file di log riporta canale e area della lavorazione aperta: "Canale CN · Area TO". Il
 * riquadro in cima al pannello resta com'era.
 *
 * indexNew.js non si carica sotto Node. contestoLavorazioneMessaggio e' pura: la si estrae dal
 * sorgente e la si prova davvero; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

//Il corpo di una funzione di primo livello: dall'intestazione alla prima "}" a inizio riga.
function corpoFunzione(intestazione) {
    const inizio = sorgente.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata: il test va aggiornato");
    const fine = sorgente.indexOf("\n}\n", inizio);
    return sorgente.substring(inizio, fine);
}

const contestoLavorazioneMessaggio = (function () {
    const corpo = corpoFunzione("function contestoLavorazioneMessaggio(canale, area) {");
    return new Function("canale", "area", corpo.substring(corpo.indexOf("{") + 1));
})();

/* ---- la riga di canale e area ---- */

test("canale e area si scrivono come li legge l'operatore", () => {
    assert.strictEqual(contestoLavorazioneMessaggio({ sigla: "CN" }, { sigla: "TO" }), "Canale CN · Area TO");
});

test("se manca uno dei due resta l'altro", () => {
    assert.strictEqual(contestoLavorazioneMessaggio({ sigla: "CN" }, 0), "Canale CN");
    assert.strictEqual(contestoLavorazioneMessaggio(null, { sigla: "TO" }), "Area TO");
});

test("senza canale e area non c'e' niente da scrivere", () => {
    //I getter di ficoProcess restituiscono 0 quando la lavorazione non ha i dettagli.
    assert.strictEqual(contestoLavorazioneMessaggio(0, 0), null);
    assert.strictEqual(contestoLavorazioneMessaggio(null, undefined), null);
    assert.strictEqual(contestoLavorazioneMessaggio({ sigla: "" }, {}), null);
});

/* ---- dove si applica ---- */

test("senza una lavorazione aperta non si usa il contesto rimasto dalla lavorazione di prima", () => {
    const corrente = corpoFunzione("function contestoLavorazioneCorrente() {");

    assert.match(corrente, /if \(!idKitLavorazione\) \{\s*return null;/);
    assert.match(corrente, /contestoLavorazioneMessaggio\(ficoProcess\.getCanaleLavorazioneCorrente\(\), ficoProcess\.getAreaLavorazioneCorrente\(\)\)/);
    //Un messaggio non deve perdersi per colpa del suo contesto.
    assert.match(corrente, /catch \(e\) \{\s*return null;/);
});

test("ogni messaggio porta canale e area alla console e al file di log, non al riquadro in alto", () => {
    const messaggio = corpoFunzione("async function messaggioUtente(msg, style, loading = false, tempo = 0, dontWriteInLogs = false, modal = false) {");

    const contesto = messaggio.indexOf("var lavorazioneMessaggio = contestoLavorazioneCorrente();");
    const campo = messaggio.indexOf("logMessage.lavorazione = lavorazioneMessaggio;");
    const verso = messaggio.indexOf("writeFileInConsole(logMessage);");
    const file = messaggio.indexOf("appendToFile(logFile, logMessage)");
    assert.ok(contesto >= 0 && campo > contesto && verso > campo && file > campo, "il contesto va nel logMessage prima della console e del file");

    //Tutti gli stili, non solo gli errori: nessuna condizione sullo stile intorno al contesto.
    assert.doesNotMatch(messaggio.substring(contesto - 200, campo), /style ==/);

    //Il riquadro in alto lo compone msg: il contesto non ci entra.
    const riquadro = messaggio.substring(messaggio.indexOf('var html = \'<div class="row" id="messaggioUtente"'));
    assert.doesNotMatch(riquadro.substring(0, 400), /lavorazione/);
});

test("in console canale e area stanno sotto il testo, come testo e non come HTML, e si copiano", () => {
    const scritturaConsole = corpoFunzione("function writeFileInConsole(logMessage) {");

    assert.match(scritturaConsole, /if \(logMessage\.lavorazione\) \{\s*messaggio\.append\(\$\('<div class="lavorazioneMessaggio"[^']*'\)\.text\(logMessage\.lavorazione\)\);/);
    assert.match(scritturaConsole, /copyButton\.attr\("msg", msg \+ " \[" \+ logMessage\.lavorazione \+ "\]"\);/);
});

test("lo stesso messaggio da due lavorazioni diverse non si raggruppa", () => {
    const scritturaConsole = corpoFunzione("function writeFileInConsole(logMessage) {");

    assert.match(scritturaConsole, /if \(lastMessage === messaggio\.text\(\)\) \{/);
    assert.doesNotMatch(scritturaConsole, /if \(lastMessage === msg\) \{/);
});
