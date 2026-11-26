/*
 * I20-1275: gli errori del Plugin uscivano interrotti.
 *
 * - Il riquadro in cima al pannello (messaggioUtente) tagliava ogni messaggio oltre i 200
 *   caratteri e ci aggiungeva "...".
 * - La console di Utility (writeFileInConsole) metteva il testo come HTML: un'eccezione con
 *   dentro un "<" ("Unexpected token < in JSON") perdeva il resto.
 * - Il pulsante di copia aveva il testo in msg="...", e la copia si fermava al primo doppio apice.
 *
 * Ora il messaggio esce intero, come testo, e il riquadro si scorre quando e' troppo alto.
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

test("il riquadro non taglia il messaggio e non aggiunge i puntini", () => {
    assert.doesNotMatch(messaggioUtente, /msg\.substring\(/);
    assert.doesNotMatch(messaggioUtente, /msg\.slice\(/);
    assert.doesNotMatch(messaggioUtente, /msg = msg[^;]*"\.\.\."/);
    assert.doesNotMatch(messaggioUtente, /msg\.length > \d+/);
});

test("il riquadro mette il messaggio come testo, non dentro l'HTML", () => {
    const riquadro = messaggioUtente.substring(messaggioUtente.indexOf('var html = \'<div class="row" id="messaggioUtente"'));
    const html = riquadro.substring(0, riquadro.indexOf(";\n"));
    assert.doesNotMatch(html, /\+ msg \+/, "il testo non va concatenato nel markup");
    assert.match(riquadro, /contenitoreMessaggi\(modal\)\.append\(html\);\s*\$\("#messaggioUtente h4"\)\.text\(String\(msg\)\);/);
});

test("un messaggio troppo alto si scorre dentro il riquadro, che resta basso", () => {
    const riquadro = messaggioUtente.substring(messaggioUtente.indexOf('var html = \'<div class="row" id="messaggioUtente"'));
    const html = riquadro.substring(0, riquadro.indexOf(";\n"));
    assert.match(html, /max-height: 120px; overflow-y: auto;/);
    //Una riga lunga senza spazi (un percorso, un URL) va a capo invece di uscire dal riquadro.
    assert.match(html, /overflow-wrap: break-word;/);
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
