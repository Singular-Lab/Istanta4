/*
 * I20-1113: una regola di allineamento del CssFramework puo' spostare i suoi elementi come un
 * blocco unico, senza ricomporli per livelli.
 *
 * Ogni regola passava da AllineamentoInternoGruppo, che reimpila gli elementi livello per livello
 * prima di applicare ancore e agganci: non c'era modo di spostare un insieme di campi gia' disposto
 * (la colonna dei prezzi di un box) tenendone la disposizione. Con "bloccoUnico": true la regola
 * prende gli elementi dove sono (CssFramework.gruppoInBlocco) e ancore, agganci ed evita traccia li
 * spostano tutti della stessa quantita'. E' un'opzione generale del motore, per qualunque gruppo di
 * campi e per tutti i clienti; le regole che non la dichiarano restano come prima.
 *
 * CssFramework.js fa require('indesign'): si carica con un indesign vuoto; Utility e' un globale
 * del Plugin e qui se ne da' uno finto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}

const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");

function conUtility(fn) {
    const prima = global.Utility;
    global.Utility = { parseLabel: (l) => String(l).toUpperCase() };
    try {
        return fn();
    }
    finally {
        global.Utility = prima;
    }
}

//Un elemento della mappa del box: bounds relativi al box (non usati dal blocco) e l'oggetto InDesign
//con i bounds assoluti, quelli che le ancore spostano.
function elemento(label, assoluti, eliminato = false) {
    return { label: label, bounds: [0, 0, 1, 1], eliminato: eliminato, item: { geometricBounds: assoluti } };
}

test("il blocco ha un livello solo con gli elementi presenti, dove sono, e il loro ingombro", () => {
    const prezzo = elemento("prezzo_offerta_gruppo", [150, 60, 170, 95]);
    const sconto = elemento("sconto_effettivo_grande", [135, 70, 148, 95]);
    const descrizione = elemento("descrizione", [110, 55, 132, 95]);

    const livelli = conUtility(() => CssFramework.gruppoInBlocco([descrizione, sconto, prezzo]));

    assert.strictEqual(livelli.length, 1);
    const blocco = livelli[0];
    assert.deepStrictEqual(blocco.bounds, [110, 55, 170, 95]);
    assert.deepStrictEqual(blocco.elementi.map(e => e.label), ["DESCRIZIONE", "SCONTO_EFFETTIVO_GRANDE", "PREZZO_OFFERTA_GRUPPO"]);
    assert.deepStrictEqual(blocco.elementi.map(e => e.bounds), [[110, 55, 132, 95], [135, 70, 148, 95], [150, 60, 170, 95]]);
    assert.strictEqual(blocco.livelloEliminato, false);
    assert.deepStrictEqual(blocco.elementiEliminati, []);
});

test("non si tocca niente: i bounds degli oggetti restano quelli, il blocco ne tiene una copia", () => {
    const prezzo = elemento("prezzo_offerta_gruppo", [150, 60, 170, 95]);
    const blocco = conUtility(() => CssFramework.gruppoInBlocco([prezzo]))[0];

    blocco.elementi[0].bounds[0] = 999;
    assert.deepStrictEqual(prezzo.item.geometricBounds, [150, 60, 170, 95]);
    assert.strictEqual(blocco.elementi[0].item, prezzo.item);
});

test("gli elementi eliminati non entrano, e uno preso da due etichette conta una volta", () => {
    const prezzo = elemento("prezzo_offerta_gruppo", [150, 60, 170, 95]);
    const eliminato = elemento("campo_offerta", [10, 10, 300, 300], true);

    const blocco = conUtility(() => CssFramework.gruppoInBlocco([prezzo, eliminato, prezzo]))[0];

    assert.strictEqual(blocco.elementi.length, 1);
    assert.deepStrictEqual(blocco.bounds, [150, 60, 170, 95]);
});

test("senza elementi nessun livello: la regola non sposta niente", () => {
    assert.deepStrictEqual(conUtility(() => CssFramework.gruppoInBlocco([])), []);
    assert.deepStrictEqual(conUtility(() => CssFramework.gruppoInBlocco(null)), []);
    assert.deepStrictEqual(conUtility(() => CssFramework.gruppoInBlocco([elemento("x", [0, 0, 1, 1], true)])), []);
});

test("solo con bloccoUnico vero la regola usa il blocco: le altre si ricompongono per livelli come prima", () => {
    const scelta = sorgente.match(/let listGruppoAllineamento = allineamentoSingolo\.bloccoUnico === true\s*\?\s*this\.gruppoInBlocco\(gruppoElementi\)\s*:\s*this\.AllineamentoInternoGruppo\(/);
    assert.ok(scelta, "il ciclo degli allineamenti non sceglie fra blocco e livelli");

    //Dopo la scelta, ancore, agganci ed evita traccia lavorano sullo stesso elenco di livelli.
    const dopo = sorgente.substring(scelta.index);
    assert.match(dopo, /this\.FollowAnchorGruppo\(mappaBoxOriginale, listGruppoAllineamento,/);
    assert.match(dopo, /this\.followStaticAnchor\(box, listGruppoAllineamento,/);
    assert.match(dopo, /this\.fixCollisioneTracciaBase\(box, listGruppoAllineamento,/);
});

test("ancore e agganci spostano ogni elemento del livello della stessa quantita'", () => {
    //Il motivo per cui il blocco si muove intero: followGroup calcola uno spostamento solo e lo
    //applica a tutti gli elementi di tutti i livelli.
    const segui = sorgente.substring(sorgente.indexOf("    followGroup("), sorgente.indexOf("    followStaticAnchor("));
    assert.match(segui, /spostamentoDaApplicare = spostamento;/);
    assert.match(segui, /for \(var g = 0; g < gruppoAllineamento\.length; g\+\+\) \{[\s\S]*?for \(var e = 0; e < gruppo\.elementi\.length; e\+\+\)/);
});
