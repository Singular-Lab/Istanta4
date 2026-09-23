/*
 * I20-981 (Lotto 3): i conteggi sulle linguette del report.
 *
 * Il rischio vero non e' sbagliare a contare, e' contare la lista sbagliata: in vista
 * whitelist i pannelli mostrano altre liste, e il numero deve seguire quello che si vede.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const conteggi = require('../../plugin/reportConteggi');

test('si contano gli elementi delle liste mostrate', () => {
    const c = conteggi.conteggiVisibili([1, 2, 3], [4], [5, 6]);

    assert.deepStrictEqual(c, { cambiati: 3, eliminati: 1, nuovi: 2 });
});

test('liste mancanti valgono zero, non rompono la testata', () => {
    assert.deepStrictEqual(conteggi.conteggiVisibili(null, undefined, []), { cambiati: 0, eliminati: 0, nuovi: 0 });
    assert.strictEqual(conteggi.conteggio(null), 0);
    assert.strictEqual(conteggi.conteggio('non una lista'), 0);
});

test('l\'etichetta porta il numero fra parentesi', () => {
    assert.strictEqual(conteggi.etichettaLinguetta('Cambiati', 12), 'Cambiati (12)');
    //Lo zero si scrive: sapere che non c'e' niente vale quanto sapere quanto c'e'.
    assert.strictEqual(conteggi.etichettaLinguetta('Eliminati', 0), 'Eliminati (0)');
});

test('senza numero resta il nome soltanto', () => {
    assert.strictEqual(conteggi.etichettaLinguetta('Nuovi', null), 'Nuovi');
    assert.strictEqual(conteggi.etichettaLinguetta('Nuovi', undefined), 'Nuovi');
    assert.strictEqual(conteggi.etichettaLinguetta('Nuovi', 'molti'), 'Nuovi');
    assert.strictEqual(conteggi.etichettaLinguetta(null, 3), ' (3)');
});
