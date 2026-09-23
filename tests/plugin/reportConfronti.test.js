/*
 * I20-981 (Lotto 4a): il confronto della lista con se stessa.
 *
 * Istanta tiene il valore precedente di un campo nella chiave "Alterazioni" del record. Qui si
 * verifica che si guardino solo i campi che l'agenzia dichiara, che una differenza di tipo non
 * venga scambiata per una differenza di valore, e che un record senza alterazioni non produca
 * segnalazioni: un falso "differente" manderebbe l'operatore a controllare una pagina che va
 * benissimo com'e'.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const confronti = require('../../plugin/reportConfronti');

const campi = [
    { label: 'Data validita\' da', keyInRecordInTracciato: 'data_da' },
    { label: 'Tema', keyInRecordInTracciato: 'tema' },
    { label: 'Ruolo', keyInRecordInTracciato: 'ruolo' }
];

function record(valori, alterazioni) {
    return Object.assign({ StatoSelezione: 1, 'Scatto.CodiceGruppo': '123' }, valori, { Alterazioni: alterazioni });
}

test('un campo osservato che e\' cambiato diventa una differenza', () => {
    const r = record({ data_da: '10/09/2026', tema: 'Bio' }, { data_da: '03/09/2026' });

    const differenze = confronti.differenzeDelRecord(r, campi);

    assert.strictEqual(differenze.length, 1);
    assert.deepStrictEqual(differenze[0], {
        campo: 'data_da',
        etichetta: 'Data validita\' da',
        prima: '03/09/2026',
        adesso: '10/09/2026'
    });
});

test('i campi che l\'agenzia non osserva restano fuori', () => {
    //prezzo_offerta e' cambiato, ma non e' nell'elenco: lo guarda gia' l'analisi di integrita'.
    const r = record({ data_da: '10/09/2026', prezzo_offerta: '1,99' }, { prezzo_offerta: '2,49' });

    assert.deepStrictEqual(confronti.differenzeDelRecord(r, campi), []);
});

test('senza alterazioni non c\'e\' niente da segnalare', () => {
    assert.deepStrictEqual(confronti.differenzeDelRecord(record({ tema: 'Bio' }, null), campi), []);
    assert.deepStrictEqual(confronti.differenzeDelRecord(record({ tema: 'Bio' }, {}), campi), []);
    assert.deepStrictEqual(confronti.differenzeDelRecord(null, campi), []);
    assert.deepStrictEqual(confronti.differenzeDelRecord(record({ tema: 'Bio' }, { tema: 'Bio' }), null), []);
});

test('una differenza di tipo non e\' una differenza', () => {
    //Il tracciato porta lo stesso valore a volte come numero e a volte come stringa: mandare
    //l'operatore a controllare per questo sarebbe solo rumore.
    const r = record({ ruolo: 3 }, { ruolo: '3' });
    assert.deepStrictEqual(confronti.differenzeDelRecord(r, campi), []);

    const conSpazi = record({ tema: ' Bio ' }, { tema: 'Bio' });
    assert.deepStrictEqual(confronti.differenzeDelRecord(conSpazi, campi), []);
});

test('un valore sparito o comparso si legge senza "null"', () => {
    const sparito = record({ tema: null }, { tema: 'Bio' });
    const differenze = confronti.differenzeDelRecord(sparito, campi);

    assert.strictEqual(differenze.length, 1);
    assert.strictEqual(differenze[0].prima, 'Bio');
    assert.strictEqual(differenze[0].adesso, '', 'un campo svuotato non deve leggersi "null"');
});

test('la lista restituisce solo i primari con differenze, in ordine', () => {
    const lista = [
        { recordInTracciato: record({ 'Scatto.CodiceGruppo': 'A', tema: 'Bio' }, { tema: 'Base' }) },
        { recordInTracciato: record({ 'Scatto.CodiceGruppo': 'B', tema: 'Bio' }, {}) },
        { recordInTracciato: Object.assign(record({ 'Scatto.CodiceGruppo': 'C', tema: 'Bio' }, { tema: 'Base' }), { StatoSelezione: 2 }) },
        { recordInTracciato: record({ 'Scatto.CodiceGruppo': 'D', ruolo: 'X' }, { ruolo: 'Y' }) }
    ];

    const esito = confronti.confrontoConSeStessa(lista, campi);

    assert.deepStrictEqual(esito.map(v => v.codiceGruppo), ['A', 'D'], 'B non ha differenze, C non e\' primario');
    assert.strictEqual(esito[0].differenze[0].etichetta, 'Tema');
});

test('la lista vuota o malformata non fa cadere la sezione', () => {
    assert.deepStrictEqual(confronti.confrontoConSeStessa(null, campi), []);
    assert.deepStrictEqual(confronti.confrontoConSeStessa([], campi), []);
    assert.deepStrictEqual(confronti.confrontoConSeStessa([null, {}], campi), []);
});
