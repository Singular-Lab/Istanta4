/*
 * I20-1202: le caselle P e S della scheda Foto P/S.
 *
 * Prima P e S erano due caselle indipendenti: la stessa foto poteva essere P e S, piu' foto
 * potevano essere P, e gli errori arrivavano solo con Applica, nella riga dei messaggi. Ora a ogni
 * clic la scheda si riallinea alla regola: una foto non e' mai P e S insieme, il gruppo ha al piu'
 * una P e spuntandola altrove la vecchia P diventa S. Applica senza P apre una finestra e non salva.
 *
 * La regola (selezionePsDopoClic) si chiama sotto Node attraverso schedaRef, come in
 * esclusioneCambioFoto.test.js; il collegamento alle caselle e il popup si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const schedaRef = require('../../plugin/schedaRef');

const P = 1, S = 2, NESSUNA = 3;
//Il gruppo dello screenshot della issue.
const gruppo = () => ({ "7167423": P, "7167387": S, "7167391": S });

test("spuntando S su una foto che era P, la P si toglie", () => {
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(gruppo(), "7167423", "S", true),
        { "7167423": S, "7167387": S, "7167391": S });
});

test("spuntando P su un'altra foto, la vecchia P diventa S", () => {
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(gruppo(), "7167387", "P", true),
        { "7167423": S, "7167387": P, "7167391": S });
});

test("spuntando P su una foto senza P ne' S, la sua S non c'e' e la vecchia P diventa S", () => {
    const stati = { "7167423": P, "7167387": NESSUNA, "7167391": S };
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(stati, 7167387, "P", true),
        { "7167423": S, "7167387": P, "7167391": S });
});

test("togliendo una spunta la foto non e' piu' ne' P ne' S", () => {
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(gruppo(), "7167423", "P", false),
        { "7167423": NESSUNA, "7167387": S, "7167391": S });
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(gruppo(), "7167387", "S", false),
        { "7167423": P, "7167387": NESSUNA, "7167391": S });
    //Togliere una spunta che non c'era non cambia lo stato della foto.
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(gruppo(), "7167423", "S", false), gruppo());
});

test("un codice che non e' del gruppo non cambia niente, e gli stati ricevuti restano com'erano", () => {
    const stati = gruppo();
    assert.deepStrictEqual(schedaRef.selezionePsDopoClic(stati, "999", "P", true), gruppo());
    schedaRef.selezionePsDopoClic(stati, "7167387", "P", true);
    assert.deepStrictEqual(stati, gruppo());
});

const schermata = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'reperimentoFoto', 'schedaFoto.js'), 'utf8').replace(/\r/g, '');

test("le caselle P e S si riallineano alla regola a ogni clic", () => {
    assert.match(schermata, /\$\("#cambiaPS"\)\.find\("input\.primary-check, input\.secondary-check"\)\.on\('change', function \(\) \{/);
    assert.match(schermata, /var nuovi = me\.selezionePsDopoClic\(stati, \$\(cliccata\)\.attr\('codice'\),/);
});

test("Applica senza P apre una finestra e non salva", () => {
    const controllo = schermata.substring(schermata.indexOf("if (!hasPrimary) {"), schermata.indexOf("// Controllo per più di un primario"));
    assert.match(controllo, /Modali\.popup\("Foto primaria mancante", "Imposta una foto P prima di applicare/);
    assert.match(controllo, /return;/);
    //Il popup non ritorna mai: non si aspetta.
    assert.doesNotMatch(controllo, /await Modali\.popup/);
});
