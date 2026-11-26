/*
 * I20-1275: gli errori del Plugin uscivano interrotti.
 *
 * - Il riquadro in cima al pannello (messaggioUtente) tagliava ogni messaggio oltre i 200
 *   caratteri e ci aggiungeva "...".
 * - La console di Utility (writeFileInConsole) metteva il testo come HTML: un'eccezione con
 *   dentro un "<" ("Unexpected token < in JSON") perdeva il resto.
 * - Il pulsante di copia aveva il testo in msg="...", e la copia si fermava al primo doppio apice.
 *
 * Ora il messaggio esce intero, come testo, nella console, nel log e nella copia.
 *
 * I20-1276: il riquadro in cima al pannello invece resta breve, come prima della I20-1275: taglia a
 * 200 caratteri con "...", senza barra di scorrimento. "In utility" voleva dire la console della
 * scheda Utility, non tutto il Plugin.
 *
 * indexNew.js non si carica sotto Node: si controlla il sorgente, come per gli altri test della
 * console (contestoLavorazioneMessaggi, consoleBoxImpaginazione).
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

const messaggioUtente = corpoFunzione("async function messaggioUtente(msg, style, loading = false, tempo = 0, dontWriteInLogs = false, modal = false) {");
const scritturaConsole = corpoFunzione("function writeFileInConsole(logMessage) {");

/* ---- riquadro in cima al pannello ---- */

test("il riquadro taglia a 200 caratteri con i puntini, su una copia: msg resta intero", () => {
    assert.match(messaggioUtente, /var testoRiquadro = String\(msg\);\s*if \(testoRiquadro\.length > 200\) \{\s*testoRiquadro = testoRiquadro\.substring\(0, 200\) \+ "\.\.\.";\s*\}/);
    //msg non si accorcia: e' quello della console, del log e della copia.
    assert.doesNotMatch(messaggioUtente, /msg = msg\.(substring|slice|substr)\(/);
});

test("il riquadro mette il testo tagliato come testo, non dentro l'HTML", () => {
    const riquadro = messaggioUtente.substring(messaggioUtente.indexOf('var html = \'<div class="row" id="messaggioUtente"'));
    const html = riquadro.substring(0, riquadro.indexOf(";\n"));
    assert.doesNotMatch(html, /\+ msg \+/, "il testo non va concatenato nel markup");
    assert.match(riquadro, /contenitoreMessaggi\(modal\)\.append\(html\);\s*\$\("#messaggioUtente h4"\)\.text\(testoRiquadro\);/);
});

test("il riquadro non ha la barra di scorrimento", () => {
    const riquadro = messaggioUtente.substring(messaggioUtente.indexOf('var html = \'<div class="row" id="messaggioUtente"'));
    const html = riquadro.substring(0, riquadro.indexOf(";\n"));
    assert.doesNotMatch(html, /max-height/);
    assert.doesNotMatch(html, /overflow-y/);
});

test("la console riceve il messaggio intero, non quello del riquadro", () => {
    //logMessage.msg si compone prima del riquadro, con il msg arrivato alla funzione.
    assert.ok(messaggioUtente.indexOf("msg: msg") < messaggioUtente.indexOf("writeFileInConsole(logMessage);"));
    assert.ok(messaggioUtente.indexOf("writeFileInConsole(logMessage);") < messaggioUtente.indexOf("var html = "));
});

/* ---- console di Utility ---- */

test("la console mette il messaggio come testo", () => {
    assert.match(scritturaConsole, /var messaggio = \$\('<span style="flex-grow: 1;[^']*"><\/span>'\)\.text\(String\(msg\)\);/);
    assert.doesNotMatch(scritturaConsole, /'<span style="flex-grow: 1;[^']*">' \+ msg/);
});

test("il pulsante di copia ha il messaggio intero, anche con i doppi apici", () => {
    assert.doesNotMatch(scritturaConsole, /msg="' \+ msg/);
    assert.match(scritturaConsole, /copyButton\.attr\("msg", String\(msg\)\);/);
    //Con canale, area o box il copiato resta il messaggio piu' il contesto fra parentesi.
    assert.match(scritturaConsole, /copyButton\.attr\("msg", msg \+ " \[" \+ contestoCopia \+ "\]"\);/);
});

test("nessun punto della console accorcia il messaggio", () => {
    assert.doesNotMatch(scritturaConsole, /msg\.(substring|slice|substr)\(/);
});
