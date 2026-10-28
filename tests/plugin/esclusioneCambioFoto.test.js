/*
 * Le regole che tolgono alcune foto dalle proposte della schermata Cambia foto.
 *
 * Il comportamento e' del core: prima di mostrare l'elenco, la schermata applica le regole del
 * cliente, che stanno nel SourceCustomPlugin e si leggono con
 * pluginMiddleware.getRegoleEsclusioneCambioFoto. Senza regole l'elenco e' quello di prima. Edro21
 * toglie un jpg, jpeg o png quando c'e' la stessa foto in psd; la foto impostata per la referenza
 * resta anche se ha il gemello psd, e sparisce solo quando non e' piu' quella impostata.
 *
 * schedaRef.js si carica sotto Node, e la regola si chiama direttamente; pluginMiddleware.js no, e
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

const EDRO21 = [{ estensioni: ["jpg", "jpeg", "png"], seEsisteEstensione: ["psd"], mantieniSelezionata: true }];
const foto = (id, nome) => ({ Id: id, Nome: nome });
const nomi = (elenco) => elenco.map(f => f.Nome);

test("un jpg o un png con lo stesso nome in psd non si propone; il psd resta", () => {
    const elenco = [foto(1, "123.jpg"), foto(2, "123.psd"), foto(3, "456.png"), foto(4, "456.psd"), foto(5, "789.jpeg"), foto(6, "789.psd")];

    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, null)), ["123.psd", "456.psd", "789.psd"]);
});

test("la foto impostata per la referenza resta anche col gemello psd, per Id o per nome", () => {
    const elenco = [foto(1, "123.jpg"), foto(2, "123.psd"), foto(3, "456.png"), foto(4, "456.psd")];

    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, { id: 1, nome: null })), ["123.jpg", "123.psd", "456.psd"]);
    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, { id: null, nome: "456.png" })), ["123.psd", "456.png", "456.psd"]);
    //L'Id del dato puo' arrivare come testo.
    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, { id: "3", nome: null })), ["123.psd", "456.png", "456.psd"]);
});

test("senza gemello psd, con nomi diversi o senza regole, l'elenco non cambia", () => {
    const elenco = [foto(1, "123.jpg"), foto(2, "124.psd"), foto(3, "456.png"), foto(4, "senzaestensione")];

    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, null)), ["123.jpg", "124.psd", "456.png", "senzaestensione"]);
    assert.strictEqual(schedaRef.fotoProponibiliNelCambioFoto(elenco, [], null), elenco);
    assert.strictEqual(schedaRef.fotoProponibiliNelCambioFoto(elenco, null, null), elenco);
});

test("nome ed estensione si confrontano senza maiuscole", () => {
    const elenco = [foto(1, "Pasta_500.JPG"), foto(2, "pasta_500.Psd")];

    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, EDRO21, null)), ["pasta_500.Psd"]);
});

test("una regola senza seEsisteEstensione toglie sempre quelle estensioni, e mantieniSelezionata falso toglie anche la selezionata", () => {
    const elenco = [foto(1, "a.png"), foto(2, "b.jpg"), foto(3, "b.psd")];

    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, [{ estensioni: ["png"], seEsisteEstensione: [], mantieniSelezionata: true }], null)), ["b.jpg", "b.psd"]);
    assert.deepStrictEqual(nomi(schedaRef.fotoProponibiliNelCambioFoto(elenco, [{ estensioni: ["jpg"], seEsisteEstensione: ["psd"], mantieniSelezionata: false }], { id: 2 })), ["a.png", "b.psd"]);
});

/* ---- la lettura delle regole e l'aggancio ---- */

function getterDelleRegole() {
    const middleware = leggi('pluginMiddleware.js');
    const corpo = middleware.match(/getRegoleEsclusioneCambioFoto\(\) \{[\s\S]*?\n    \}/);
    assert.ok(corpo, "getRegoleEsclusioneCambioFoto non trovata in pluginMiddleware.js");
    const sorgente = corpo[0].replace(/^getRegoleEsclusioneCambioFoto\(\) \{\s*let me = this;/, "").replace(/\n    \}$/, "");
    return new Function("me", sorgente);
}

test("pluginMiddleware legge le regole del cliente, le ripulisce, e senza chiave non ne da' nessuna", () => {
    const leggiRegole = getterDelleRegole();

    assert.deepStrictEqual(leggiRegole({ callCustom: false, customPluginDB: {} }), []);
    assert.deepStrictEqual(leggiRegole({ callCustom: false, customPluginDB: { regoleEsclusioneCambioFoto: "psd" } }), []);
    assert.deepStrictEqual(leggiRegole({
        callCustom: false,
        customPluginDB: {
            regoleEsclusioneCambioFoto: [
                { estensioni: [" .JPG ", "png", ""], seEsisteEstensione: [".PSD"] },
                { estensioni: [], seEsisteEstensione: ["psd"] },
                null
            ]
        }
    }), [{ estensioni: ["jpg", "png"], seEsisteEstensione: ["psd"], mantieniSelezionata: true }]);
});

test("la schermata Cambia foto applica le regole prima di mostrare l'elenco, con la foto della referenza", () => {
    const sorgente = leggi('reperimentoFoto/schedaFoto.js');
    const schermata = sorgente.substring(sorgente.indexOf("    async openModalCambiaFoto(codice) {"), sorgente.indexOf("const state = {"));
    assert.match(schermata, /let fotoList = Array\.isArray\(objResult\.result\) \? objResult\.result : \[\];/);
    assert.match(schermata, /fotoList = me\.fotoProponibiliNelCambioFoto\(fotoList, pluginMiddleware\.getRegoleEsclusioneCambioFoto\(\), \{ id: fotoAttuale, nome: nomeFotoImpaginata \}\);/);
});
