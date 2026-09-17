/*
 * I20-972: stato di revisione di una riga del revisore.
 *
 * Il modulo sotto test e' Istanta/wwwroot/js/statoRevisione.js, la regola unica con cui il
 * contatore, la ripartizione fra le schede e la resa delle righe decidono se una riga e'
 * revisionata. Il caso che ha fatto nascere il modulo: FirmaGarantita vuota ("garante
 * valutato, non garantisce") deve valere da revisionare, la sigla deve valere revisionato.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const statoRevisione = require('../../Istanta/wwwroot/js/statoRevisione');

const FIRMA = 'Tracciato.Firma';

function riga(firmaRevisione, firmaRecord, firmaGarantita) {
    const recordInTracciato = { [FIRMA]: firmaRecord };
    if (firmaGarantita !== undefined) {
        recordInTracciato.FirmaGarantita = firmaGarantita;
    }
    return {
        recordRevisionato: firmaRevisione === null ? null : { firmaTracciato: firmaRevisione },
        recordInTracciato: recordInTracciato
    };
}

test('firma garantita con una sigla: revisionato, anche se la firma del record e\' diversa', () => {
    assert.ok(statoRevisione.eRevisionato(riga('F1', 'F2', 'SC'), FIRMA));
});

test('firma garantita vuota: il garante e\' stato valutato ma non garantisce, resta da revisionare', () => {
    //E' il caso che il vecchio contatore saltava con "== null".
    assert.ok(!statoRevisione.eRevisionato(riga('F1', 'F2', ''), FIRMA));
    assert.ok(!statoRevisione.firmaGarantitaSpecificata(riga('F1', 'F2', '')));
});

test('senza garante, revisionato se e solo se la firma coincide', () => {
    assert.ok(statoRevisione.eRevisionato(riga('F1', 'F1'), FIRMA));
    assert.ok(!statoRevisione.eRevisionato(riga('F1', 'F2'), FIRMA));
});

test('senza revisione e\' da revisionare, qualunque cosa dica il garante', () => {
    assert.ok(!statoRevisione.eRevisionato(riga(null, 'F1'), FIRMA));
    assert.ok(!statoRevisione.eRevisionato(riga(null, 'F1', 'SC'), FIRMA));
});

test('una revisione senza firma non coincide con nulla', () => {
    assert.ok(!statoRevisione.eRevisionato(riga(undefined, 'F1'), FIRMA));
    const senzaFirma = { recordRevisionato: { firmaTracciato: null }, recordInTracciato: { [FIRMA]: null } };
    assert.ok(!statoRevisione.eRevisionato(senzaFirma, FIRMA));
});

test('righe incomplete non fanno saltare la regola', () => {
    assert.ok(!statoRevisione.eRevisionato(null, FIRMA));
    assert.ok(!statoRevisione.eRevisionato({ recordRevisionato: { firmaTracciato: 'F1' }, recordInTracciato: null }, FIRMA));
    assert.ok(!statoRevisione.firmaGarantitaSpecificata(null));
});

test('senza chiave esplicita si usa quella della pagina, o il suo valore predefinito', () => {
    //In Node keyTracciatoFirma non esiste: vale il predefinito, che e' la chiave usata dal server.
    assert.strictEqual(statoRevisione.chiaveFirmaTracciato(undefined), 'Tracciato.Firma');
    assert.strictEqual(statoRevisione.chiaveFirmaTracciato('Altra.Chiave'), 'Altra.Chiave');
    assert.ok(statoRevisione.eRevisionato(riga('F1', 'F1')));
});
