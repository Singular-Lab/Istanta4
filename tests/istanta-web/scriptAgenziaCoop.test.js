/*
 * I20-1107: il revisore web di Coop come la produzione l'ha sempre visto.
 *
 * Fino a I20-997 la pagina caricava js/agenzia.js alla radice, che in tutte le installazioni era la
 * copia dello script di Edro21. Da I20-997 il server serve l'archivio del cliente montato, e per Coop
 * questo era un archivio vecchio, mai usato in produzione: etichette di Descrizione2 e Descrizione3
 * scambiate ("Tipo" sul marchio, "Brand" sul tipo) e senza molte funzioni del revisore. L'archivio
 * Coop e' tornato la copia di quello di Edro21.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

function archivio(cliente) {
    return fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "ScriptAgenzia", cliente, "agenzia.js"), "utf8").replace(/\r/g, "");
}

test("nella scheda di revisione Coop il marchio e' Brand e il tipo e' Tipo/Gusto", () => {
    const coop = archivio("coopfi");
    const inizio = coop.indexOf("    setRecord_revisioneArticolo(htmlItem) {");
    const metodo = coop.substring(inizio, coop.indexOf("\n    }\n", inizio));
    const attese = { 1: "Nome", 2: "Brand", 3: "Tipo/Gusto", 4: "Grammatura" };

    //I campi della revisione (#DescrizioneN) e quelli del tracciato (#DescrizioneNTracciato).
    const revisione = {};
    const tracciato = {};
    for (const m of metodo.matchAll(/descr([1-4])(T?)\.parent\(\)\.find\("\.form-label"\)\.text\("([^"]+)"\);/g)) {
        (m[2] === "T" ? tracciato : revisione)[m[1]] = m[3];
    }
    assert.deepStrictEqual(revisione, attese);
    assert.deepStrictEqual(tracciato, attese);
});

test("l'archivio Coop ha tutte le funzioni dello script di Edro21", () => {
    const funzioni = (testo) => new Set([...testo.matchAll(/^    ([A-Za-z_]+)\(/gm)].map(m => m[1]));
    const coop = funzioni(archivio("coopfi"));
    const mancanti = [...funzioni(archivio("edro21"))].filter(f => !coop.has(f));
    assert.deepStrictEqual(mancanti, []);
});

test("l'archivio Coop e' la copia di quello di Edro21, intestazione a parte", () => {
    //Se uno dei due cambia, il test lo dice: allinearli o separarli diventa una scelta, non una dimenticanza.
    const senzaIntestazione = (testo) => testo.replace(/^\uFEFF?(\/\/[^\n]*\n)+/, "");
    assert.strictEqual(senzaIntestazione(archivio("coopfi")), senzaIntestazione(archivio("edro21")));
    assert.match(archivio("coopfi"), /^\uFEFF?\/\/Coopfi\n\/\/I20-1107: copia di edro21\/agenzia\.js/);
});
