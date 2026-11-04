/*
 * TASK-60aaf10d: la foto della lista nella schermata Cambia foto.
 *
 * Per Edro21 la foto da impaginare e' quella del tracciato (NOME_FOTO). Il server scrive nel record
 * da dove viene la foto (Foto.Origine) e quale indica la lista (Foto.NomeDaTracciato); con la
 * configurazione del cliente (fotoDaTracciato.cambioSoloPerLavorazione) la schermata offre il cambio
 * solo per questa lavorazione e dice all'operatore da dove viene la foto. Senza foto nella lista, o
 * senza la configurazione, tutti gli ambiti come prima. La scelta porta al server il nome della
 * lista, perche' decada quando una lista nuova ne indica un altro.
 *
 * schedaRef.js si carica sotto Node, e le regole si chiamano direttamente; pluginMiddleware.js no, e
 * della sua lettura si isola il getter dal sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const schedaRef = require('../../plugin/schedaRef');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');
const leggi = (nome) => fs.readFileSync(path.join(cartellaPlugin, nome), 'utf8').replace(/\r/g, '');

const EDRO21 = { cambioSoloPerLavorazione: true };
const record = (origine, nomeLista) => ({ "Foto.Origine": origine, "Foto.NomeDaTracciato": nomeLista });

test("la foto della lista si cambia solo per questa lavorazione, e la schermata lo dice", () => {
    const esito = schedaRef.cambioFotoDallaLista(record("tracciato", "323456_1_AD"), EDRO21);

    assert.strictEqual(esito.soloLavorazione, true);
    assert.strictEqual(esito.avviso, "Foto della lista (323456_1_AD): si può cambiare solo per questa lavorazione.");
});

test("una foto scelta per la lavorazione dice quale foto indica la lista", () => {
    const esito = schedaRef.cambioFotoDallaLista(record("lavorazione", "323456_1_AD"), EDRO21);

    assert.strictEqual(esito.soloLavorazione, true);
    assert.strictEqual(esito.avviso, "Foto scelta solo per questa lavorazione. La lista indica 323456_1_AD.");
});

test("senza foto nella lista, o con la foto della lista non trovata, tutti gli ambiti", () => {
    const nessuno = { soloLavorazione: false, avviso: null };

    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(record("archivio", ""), EDRO21), nessuno);
    //La lista la indica ma in archivio non c'e': il server ha scelto come oggi.
    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(record("archivio", "323456_1_AD"), EDRO21), nessuno);
    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(record("tracciato", "  "), EDRO21), nessuno);
    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(null, EDRO21), nessuno);
});

test("un cliente senza configurazione, o che non limita il cambio, ha tutti gli ambiti", () => {
    const nessuno = { soloLavorazione: false, avviso: null };

    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(record("tracciato", "323456_1_AD"), null), nessuno);
    assert.deepStrictEqual(schedaRef.cambioFotoDallaLista(record("tracciato", "323456_1_AD"), { cambioSoloPerLavorazione: false }), nessuno);
});

test("il nome della lista da mandare con la scelta, vuoto quando non c'e'", () => {
    assert.strictEqual(schedaRef.nomeFotoDellaLista({ recordInTracciato: { "Foto.NomeDaTracciato": " 323456_1_AD " } }), "323456_1_AD");
    assert.strictEqual(schedaRef.nomeFotoDellaLista({ recordInTracciato: {} }), "");
    assert.strictEqual(schedaRef.nomeFotoDellaLista(null), "");
});

function getterDellaConfigurazione() {
    const middleware = leggi('pluginMiddleware.js');
    const corpo = middleware.match(/getFotoDaTracciato\(\) \{[\s\S]*?\n    \}/);
    assert.ok(corpo, "getFotoDaTracciato non trovata in pluginMiddleware.js");
    const sorgente = corpo[0].replace(/^getFotoDaTracciato\(\) \{\s*let me = this;/, "").replace(/\n    \}$/, "");
    return new Function("me", sorgente);
}

test("pluginMiddleware legge la configurazione del cliente, e senza chiave non ne da' nessuna", () => {
    const leggiConfigurazione = getterDellaConfigurazione();

    assert.strictEqual(leggiConfigurazione({ callCustom: false, customPluginDB: {} }), null);
    assert.strictEqual(leggiConfigurazione({ callCustom: false, customPluginDB: { fotoDaTracciato: [] } }), null);
    assert.deepStrictEqual(leggiConfigurazione({ callCustom: false, customPluginDB: { fotoDaTracciato: { campi: ["nome_foto"], cambioSoloPerLavorazione: true } } }), { cambioSoloPerLavorazione: true });
    assert.deepStrictEqual(leggiConfigurazione({ callCustom: false, customPluginDB: { fotoDaTracciato: {} } }), { cambioSoloPerLavorazione: false });
});

test("la schermata Cambia foto usa la regola, e le due richieste mandano il nome della lista", () => {
    const schermata = leggi('reperimentoFoto/schedaFoto.js');

    assert.match(schermata, /const fotoDallaLista = me\.cambioFotoDallaLista\(/);
    assert.match(schermata, /if \(fotoDallaLista\.soloLavorazione\) \{\n\s*return `<option value="solo_lavorazione">Solo lavorazione<\/option>`;/);
    //L'avviso si scrive come testo, non come HTML.
    assert.match(schermata, /\$\('#avvisoFotoDallaLista'\)\.text\(fotoDallaLista\.avviso\);/);
    assert.strictEqual((schermata.match(/formData\.append\("nomeFotoTracciato", (me|this)\.nomeFotoDellaLista\(element\)\);/g) || []).length, 2);
});
