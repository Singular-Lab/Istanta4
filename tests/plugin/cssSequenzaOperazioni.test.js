/*
 * Momento di esecuzione delle regole del framework CSS.
 *
 * Il modulo sotto test e' plugin/cssSequenzaOperazioni.js: decide quali regole appartengono
 * a quale momento, e consegna al motore un DB gia' filtrato. Il vincolo piu' importante e'
 * che a dati invariati non cambi nulla, perche' ogni regola gia' scritta e' senza fase.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const cssSequenzaOperazioni = require('../../plugin/cssSequenzaOperazioni');

function dbDiProva() {
    return [
        {
            nomiBox: ['BOX41'],
            ridimensionamenti: [{ nomeGruppo: 'base' }, { nomeGruppo: 'foto_tardive', fase: 'dopoFixFoto' }],
            postRidimensionamenti: [{ nomeGruppo: 'boxetto' }],
            allineamenti: [
                { nomeGruppo: 'descr_All' },
                { nomeGruppo: 'ombre_alle_foto', fase: 'dopoFixFoto' }
            ],
            duplicazioni: [{ nomeGruppo: 'ombra_per_foto' }],
            ordiniZ: [{ nomeGruppo: 'ombre_dietro' }],
            segnalazioniConflitti: []
        },
        {
            nomiBox: [],
            ridimensionamenti: [],
            postRidimensionamenti: [],
            allineamenti: [{ nomeGruppo: 'default_All' }]
        }
    ];
}

test('una regola senza fase appartiene al momento standard', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(undefined), 'standard');
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(null), 'standard');
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(''), 'standard');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ nomeGruppo: 'x' }, 'standard'));
});

test('una fase scritta male non fa sparire la regola: resta nel momento standard', () => {
    //Un refuso nel dato del cliente non deve tradursi in un allineamento che non avviene mai.
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('dopoFixfotoo'), 'standard');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ fase: 'dopoFixfotoo' }, 'standard'));
});

test('la fase e\' riconosciuta a prescindere da maiuscole e minuscole', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('DOPOFIXFOTO'), 'dopoFixFoto');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ fase: 'dopofixfoto' }, 'dopoFixFoto'));
});

test('il momento standard porta con se\' tutte e sole le regole di sempre', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'standard');

    assert.deepStrictEqual(filtrato[0].ridimensionamenti.map(r => r.nomeGruppo), ['base']);
    assert.deepStrictEqual(filtrato[0].postRidimensionamenti.map(r => r.nomeGruppo), ['boxetto']);
    assert.deepStrictEqual(filtrato[0].allineamenti.map(r => r.nomeGruppo), ['descr_All']);
    assert.deepStrictEqual(filtrato[1].allineamenti.map(r => r.nomeGruppo), ['default_All']);
});

test('il momento dopoFixFoto porta solo le regole che lo hanno chiesto', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'dopoFixFoto');

    assert.deepStrictEqual(filtrato[0].ridimensionamenti.map(r => r.nomeGruppo), ['foto_tardive']);
    assert.deepStrictEqual(filtrato[0].postRidimensionamenti, []);
    assert.deepStrictEqual(filtrato[0].allineamenti.map(r => r.nomeGruppo), ['ombre_alle_foto']);
    assert.deepStrictEqual(filtrato[1].allineamenti, []);
});

test('duplicazioni e ordiniZ restano fuori dal filtro: il box si ricompone in ogni momento', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'dopoFixFoto');

    assert.strictEqual(filtrato[0].duplicazioni.length, 1);
    assert.strictEqual(filtrato[0].ordiniZ.length, 1);
    //Quello che non c'entra con i momenti viene ricopiato tale e quale.
    assert.deepStrictEqual(filtrato[0].nomiBox, ['BOX41']);
    assert.deepStrictEqual(filtrato[0].segnalazioniConflitti, []);
});

test('il DB originale non viene toccato: e\' lo stesso oggetto per tutti i box', () => {
    const db = dbDiProva();
    cssSequenzaOperazioni.filtraDBPerMomento(db, 'dopoFixFoto');

    assert.strictEqual(db[0].allineamenti.length, 2);
    assert.strictEqual(db[0].ridimensionamenti.length, 2);
});

test('un DB assente resta assente e non fa saltare il filtro', () => {
    assert.strictEqual(cssSequenzaOperazioni.filtraDBPerMomento(null, 'standard'), null);
    assert.deepStrictEqual(cssSequenzaOperazioni.filtraDBPerMomento([], 'standard'), []);
});

test('si sa in anticipo se in un momento c\'e\' qualcosa da fare', () => {
    //Serve a non pagare un giro di operazioni a vuoto su ogni box quando nessuno usa il momento.
    assert.ok(cssSequenzaOperazioni.esistonoRegole(dbDiProva(), 'dopoFixFoto'));
    assert.ok(!cssSequenzaOperazioni.esistonoRegole(dbDiProva()[1] ? [dbDiProva()[1]] : [], 'dopoFixFoto'));
    assert.ok(!cssSequenzaOperazioni.esistonoRegole(null, 'dopoFixFoto'));
});

test('i momenti sono dichiarati in ordine di esecuzione', () => {
    assert.deepStrictEqual(cssSequenzaOperazioni.momenti, ['standard', 'dopoFixFoto']);
});
