/*
 * I20-973: ordine con cui compaiono i tracciati di una promo.
 *
 * Il modulo sotto test e' Istanta/wwwroot/js/ordinamentoTracciati.js. Il comportamento che
 * conta e' doppio: i tracciati appena importati devono stare in cima, e quelli arrivati con
 * la stessa importazione devono restare nell'ordine per sigla stabilito prima, altrimenti
 * l'elenco smette di essere leggibile per canale e area.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ordinamentoTracciati = require('../../Istanta/wwwroot/js/ordinamentoTracciati');

const radice = path.join(__dirname, '..', '..');

function sorgente(percorso) {
    return fs.readFileSync(path.join(radice, percorso), 'utf8');
}

const IMPORTAZIONI = [
    { id: 1, dataCaricamento: '2026-09-01T10:00:00' },
    { id: 2, dataCaricamento: '2026-09-15T09:30:00' },
    { id: 3, dataCaricamento: '2026-09-15T18:45:00' }
];

function tracciato(sigla, idImportazione) {
    return { id: sigla + idImportazione, sigla: sigla, idImportazione: idImportazione };
}

function sigle(lista) {
    return lista.map(t => t.sigla + '/' + t.idImportazione);
}

test('i tracciati appena importati stanno in cima', () => {
    const lista = [tracciato('SCTO', 1), tracciato('SCTO', 3), tracciato('SCTO', 2)];

    assert.deepStrictEqual(
        sigle(ordinamentoTracciati.dalPiuRecente(lista, IMPORTAZIONI)),
        ['SCTO/3', 'SCTO/2', 'SCTO/1']);
});

// Un file importato genera piu' tracciati insieme: fra quelli la data non distingue nulla,
// e deve sopravvivere l'ordine per sigla che agenzia.js ha appena stabilito.
test('a parita\' di importazione resta l\'ordine per sigla', () => {
    const lista = [
        tracciato('SCTO', 1), tracciato('SSTO', 1),
        tracciato('SCSP', 2), tracciato('SSSP', 2)
    ];

    assert.deepStrictEqual(
        sigle(ordinamentoTracciati.dalPiuRecente(lista, IMPORTAZIONI)),
        ['SCSP/2', 'SSSP/2', 'SCTO/1', 'SSTO/1']);
});

test('nello stesso giorno conta anche l\'ora', () => {
    const lista = [tracciato('SCTO', 2), tracciato('SCTO', 3)];

    assert.deepStrictEqual(
        sigle(ordinamentoTracciati.dalPiuRecente(lista, IMPORTAZIONI)),
        ['SCTO/3', 'SCTO/2']);
});

// Data ignota vuol dire posto prevedibile in fondo, non un confronto inventato.
test('un tracciato senza importazione conosciuta finisce in fondo', () => {
    const lista = [tracciato('SCTO', 99), tracciato('SCTO', 1), tracciato('SCTO', 3)];

    assert.deepStrictEqual(
        sigle(ordinamentoTracciati.dalPiuRecente(lista, IMPORTAZIONI)),
        ['SCTO/3', 'SCTO/1', 'SCTO/99']);
});

test('una data assente o illeggibile vale come ignota', () => {
    const importazioni = [
        { id: 1, dataCaricamento: '2026-09-01T10:00:00' },
        { id: 2, dataCaricamento: '' },
        { id: 3, dataCaricamento: 'non una data' },
        { id: 4 }
    ];

    assert.strictEqual(ordinamentoTracciati.istanteDiCaricamento(tracciato('SCTO', 2), importazioni), null);
    assert.strictEqual(ordinamentoTracciati.istanteDiCaricamento(tracciato('SCTO', 3), importazioni), null);
    assert.strictEqual(ordinamentoTracciati.istanteDiCaricamento(tracciato('SCTO', 4), importazioni), null);
    assert.ok(ordinamentoTracciati.istanteDiCaricamento(tracciato('SCTO', 1), importazioni) > 0);
});

// Senza importazioni la pagina deve continuare a disegnare l'elenco.
test('senza importazioni l\'elenco resta quello che era', () => {
    const lista = [tracciato('SCTO', 1), tracciato('SSTO', 2)];

    assert.deepStrictEqual(sigle(ordinamentoTracciati.dalPiuRecente(lista, null)), ['SCTO/1', 'SSTO/2']);
    assert.deepStrictEqual(sigle(ordinamentoTracciati.dalPiuRecente(lista, [])), ['SCTO/1', 'SSTO/2']);
    assert.strictEqual(ordinamentoTracciati.dalPiuRecente(null, IMPORTAZIONI), null);
    assert.deepStrictEqual(ordinamentoTracciati.dalPiuRecente([], IMPORTAZIONI), []);
});

test('l\'elenco ricevuto non viene toccato', () => {
    const lista = [tracciato('SCTO', 1), tracciato('SCTO', 3)];
    const copia = lista.slice();

    ordinamentoTracciati.dalPiuRecente(lista, IMPORTAZIONI);

    assert.deepStrictEqual(lista, copia);
});

test('il server puo\' scrivere i nomi con l\'iniziale maiuscola', () => {
    const lista = [{ sigla: 'SCTO', IdImportazione: 1 }, { sigla: 'SCTO', IdImportazione: 3 }];
    const importazioni = [
        { Id: 1, DataCaricamento: '2026-09-01T10:00:00' },
        { Id: 3, DataCaricamento: '2026-09-15T18:45:00' }
    ];

    const ordinati = ordinamentoTracciati.dalPiuRecente(lista, importazioni);

    assert.deepStrictEqual(ordinati.map(t => t.IdImportazione), [3, 1]);
});

/* ---- come la pagina usa il modulo ---- */

// L'ordine per data si vede solo se arriva dopo quello per sigla: invertendo i due passaggi
// la sigla tornerebbe a comandare e la modifica sarebbe invisibile.
test('la pagina ordina per data dopo aver ordinato per sigla', () => {
    const promo = sorgente('Istanta/wwwroot/js/promo.js');

    const perSigla = promo.indexOf('applicaSchemaDiOrdinamentoTracciati(item.promoTracciatis, "sigla")');
    const perData = promo.indexOf('ordinamentoTracciati.dalPiuRecente(item.promoTracciatis, item.promoImportazionis)');

    assert.ok(perSigla > 0, 'l\'ordinamento per sigla deve restare');
    assert.ok(perData > 0, 'la pagina deve ordinare i tracciati per data');
    assert.ok(perData > perSigla, 'la data deve essere applicata dopo la sigla');
});

// Il modulo arriva da uno script a parte, caricato dal layout, che e' una view compilata
// nell'assembly: pubblicando i soli file statici si ottiene un promo.js nuovo con un layout
// vecchio, e senza guardia la pagina perdeva l'intero elenco invece di una riga d'ordine.
test('senza il modulo l\'elenco si disegna comunque', () => {
    const promo = sorgente('Istanta/wwwroot/js/promo.js');

    const guardia = promo.indexOf('typeof ordinamentoTracciati !== "undefined"');
    const chiamata = promo.indexOf('ordinamentoTracciati.dalPiuRecente(');

    assert.ok(guardia > 0, 'l\'uso del modulo deve essere protetto');
    assert.ok(guardia < chiamata, 'la protezione deve precedere la chiamata');
    assert.ok(chiamata - guardia < 200, 'la chiamata deve stare dentro la protezione');
});

test('il layout carica il modulo prima di promo.js', () => {
    const layout = sorgente('Istanta/Views/Shared/_Layout.cshtml');

    const modulo = layout.indexOf('js/ordinamentoTracciati.js');
    const pagina = layout.indexOf('js/promo.js');

    assert.ok(modulo > 0, 'senza il tag lo script non esiste nella pagina');
    assert.ok(modulo < pagina, 'promo.js lo usa mentre disegna, deve essere gia\' caricato');
});
