/*
 * I20-981 (Lotto 1): le regole di avvio del Report Integrita'.
 *
 * Il difetto segnalato era che, quando la lista va scaricata, il report non parte piu'.
 * La sequenza vera vive in indexNew.js e non si carica sotto Node; qui si verificano le
 * decisioni che la guidano, che prima stavano inline nel gestore del bottone.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const avvio = require('../../plugin/reportIntegritaAvvio');

const adesso = new Date(2026, 8, 21, 12, 0, 0); //21/09/2026 12:00:00

test('la data italiana scritta dal plugin si rilegge', () => {
    const data = avvio.leggiDataItaliana('21/09/2026, 09:20:33');

    assert.notStrictEqual(data, null);
    assert.strictEqual(data.getFullYear(), 2026);
    assert.strictEqual(data.getMonth(), 8);
    assert.strictEqual(data.getDate(), 21);
    assert.strictEqual(data.getHours(), 9);
    assert.strictEqual(data.getMinutes(), 20);
    assert.strictEqual(data.getSeconds(), 33);

    //Senza virgola, come la scrivono alcuni runtime.
    assert.notStrictEqual(avvio.leggiDataItaliana('21/09/2026 09:20:33'), null);
});

test('una data non leggibile non viene inventata', () => {
    assert.strictEqual(avvio.leggiDataItaliana(null), null);
    assert.strictEqual(avvio.leggiDataItaliana(''), null);
    assert.strictEqual(avvio.leggiDataItaliana('Mai scaricato'), null);
    assert.strictEqual(avvio.leggiDataItaliana('21/09/26, 09:20:33'), null, 'anno a due cifre');
    //Date farebbe scorrere il 31 febbraio al primo marzo.
    assert.strictEqual(avvio.leggiDataItaliana('31/02/2026, 10:00:00'), null);
});

test('la lista e\' recente solo dentro l\'ora', () => {
    assert.strictEqual(avvio.listaERecente('21/09/2026, 11:30:00', adesso), true);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 11:00:01', adesso), true);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 10:59:00', adesso), false);
    assert.strictEqual(avvio.listaERecente('20/09/2026, 11:30:00', adesso), false);
});

test('una lista senza data o con data nel futuro si riscarica', () => {
    //Il lato sicuro: meglio un download in piu' che un confronto su una lista di eta' ignota.
    assert.strictEqual(avvio.listaERecente(null, adesso), false);
    assert.strictEqual(avvio.listaERecente('Mai scaricato', adesso), false);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 13:00:00', adesso), false);
});

test('il report esistente si chiede solo entro le quattro ore', () => {
    const dueOreFa = new Date(2026, 8, 21, 10, 0, 0).toISOString();
    const treOreFa = new Date(2026, 8, 21, 9, 0, 0).toISOString();
    const cinqueOreFa = new Date(2026, 8, 21, 7, 0, 0).toISOString();

    const recente = avvio.decidiReportEsistente(new Date(2026, 8, 21, 11, 30, 0).toISOString(), adesso);
    assert.strictEqual(recente.chiedi, true);
    assert.strictEqual(recente.vecchio, false);

    //Esattamente due ore: si chiede ancora senza evidenziare.
    assert.deepStrictEqual(
        { chiedi: avvio.decidiReportEsistente(dueOreFa, adesso).chiedi, vecchio: avvio.decidiReportEsistente(dueOreFa, adesso).vecchio },
        { chiedi: true, vecchio: false });

    const vecchio = avvio.decidiReportEsistente(treOreFa, adesso);
    assert.strictEqual(vecchio.chiedi, true);
    assert.strictEqual(vecchio.vecchio, true, 'oltre due ore la data va in evidenza');

    const scaduto = avvio.decidiReportEsistente(cinqueOreFa, adesso);
    assert.strictEqual(scaduto.chiedi, false, 'oltre quattro ore si rifa senza chiedere');
});

test('un report senza data valida non blocca l\'operatore', () => {
    assert.strictEqual(avvio.decidiReportEsistente(null, adesso).chiedi, false);
    assert.strictEqual(avvio.decidiReportEsistente('', adesso).chiedi, false);
    assert.strictEqual(avvio.decidiReportEsistente('non una data', adesso).chiedi, false);
});

test('il range di pagine tiene solo i nomi numerici', () => {
    assert.strictEqual(avvio.componiRangePagine(['1', '2', '3']), '1,2,3');
    assert.strictEqual(avvio.componiRangePagine(['I', '1', 'Copertina', '2']), '1,2');
    assert.strictEqual(avvio.componiRangePagine([]), '');
    assert.strictEqual(avvio.componiRangePagine(null), '');
});

test('il report si chiude quando cambia il documento sotto', () => {
    const doc = '/Volumi/Lavori/vol_21-05-26.indd';

    assert.strictEqual(avvio.deveChiudereReport(doc, doc), false);
    assert.strictEqual(avvio.deveChiudereReport(doc, '/Volumi/Lavori/altro.indd'), true);
    //Nessun documento aperto: il report non si puo' piu' verificare, quindi si chiude.
    assert.strictEqual(avvio.deveChiudereReport(doc, null), true);
    assert.strictEqual(avvio.deveChiudereReport(doc, ''), true);
    //Se non sappiamo su cosa e' nato, non si chiude niente.
    assert.strictEqual(avvio.deveChiudereReport(null, doc), false);
    assert.strictEqual(avvio.deveChiudereReport('', doc), false);
});
