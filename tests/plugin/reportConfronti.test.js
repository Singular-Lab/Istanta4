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

//I20-981 (Lotto 4b): il confronto fra la lista corrente e un'altra lista della stessa promo.

function primario(codice, valori, compilati) {
    const dato = Object.assign({ StatoSelezione: 1, 'Scatto.CodiceGruppo': codice }, valori);
    if (compilati) {
        dato.compiledFields = compilati.map(([labelName, content]) => ({ labelName, content, paragraphName: '' }));
    }
    return { recordInTracciato: dato };
}

test('le due liste si accoppiano per codice gruppo, sui primari', () => {
    //Fra lavorazioni l'idRec cambia: lo stesso prodotto ha id diversi nelle due liste, e
    //accoppiarsi per idRec direbbe che niente e' in comune.
    const corrente = [
        primario('1', { idRec: 10, tema: 'Bio' }),
        primario('2', { idRec: 11, tema: 'Base' }),
        { recordInTracciato: { StatoSelezione: 2, 'Scatto.CodiceGruppo': '9', tema: 'secondaria' } }
    ];
    const altra = [
        primario('1', { idRec: 77, tema: 'Natale' }),
        primario('3', { idRec: 78, tema: 'Base' })
    ];

    const voci = confronti.confrontoConAltraLista(corrente, altra, campi);

    assert.deepStrictEqual(voci.map(v => v.codiceGruppo + ':' + v.presenza),
        ['1:entrambe', '2:soloCorrente', '3:soloAltra']);
    //Le secondarie non entrano: in pagina ci va il primario, e il gruppo si impagina da li'.
    assert.ok(!voci.some(v => v.codiceGruppo === '9'));

    const inComune = voci[0];
    assert.strictEqual(inComune.differenze.length, 1);
    assert.deepStrictEqual(inComune.differenze[0], {
        canale: 'osservato', campo: 'tema', etichetta: 'Tema', corrente: 'Bio', altra: 'Natale'
    });
});

test('i campi compilati viaggiano su un canale loro', () => {
    const corrente = [primario('1', { tema: 'Bio' }, [['descrizione', '<a>Mele</a>'], ['prezzo_offerta', '1,99']])];
    const altra = [primario('1', { tema: 'Bio' }, [['descrizione', '<a>Pere</a>'], ['prezzo_offerta', '1,99'], ['sconto_fid', '10%']])];

    const voci = confronti.confrontoConAltraLista(corrente, altra, campi);
    const differenze = voci[0].differenze;

    //Il tema e' uguale, il prezzo e' uguale: restano la descrizione, diversa, e lo sconto, che
    //una lista ha e l'altra no. Il lato mancante si legge vuoto, non "null".
    assert.deepStrictEqual(differenze.map(d => d.canale + ':' + d.campo), ['compilato:descrizione', 'compilato:sconto_fid']);
    assert.strictEqual(differenze[0].corrente, '<a>Mele</a>');
    assert.strictEqual(differenze[0].altra, '<a>Pere</a>');
    assert.strictEqual(differenze[1].corrente, '');
    assert.strictEqual(differenze[1].altra, '10%');
});

test('una referenza in comune senza differenze resta nelle voci e la toglie il filtro', () => {
    //Le voci dicono tutto quello che c'e'; e' il filtro a decidere cosa si vede. Cosi' spegnere un
    //canale o un campo puo' far sparire una referenza, e riaccenderlo la fa tornare.
    const corrente = [primario('1', { tema: 'Bio' }, [['descrizione', 'A']]), primario('2', { tema: 'X' })];
    const altra = [primario('1', { tema: 'Bio' }, [['descrizione', 'B']]), primario('2', { tema: 'X' })];

    const voci = confronti.confrontoConAltraLista(corrente, altra, campi);
    assert.strictEqual(voci.length, 2);

    const tutte = confronti.filtraVociConfronto(voci, {});
    assert.deepStrictEqual(tutte.map(v => v.codiceGruppo), ['1']);

    const senzaCompilati = confronti.filtraVociConfronto(voci, { canali: { compilato: false } });
    assert.deepStrictEqual(senzaCompilati, []);
});

test('il filtro sui campi tiene solo quelli scelti, il filtro sulle presenze separa comuni e solitarie', () => {
    const corrente = [
        primario('1', { tema: 'Bio', ruolo: 'A' }, [['descrizione', 'x']]),
        primario('2', { tema: 'Base' })
    ];
    const altra = [
        primario('1', { tema: 'Natale', ruolo: 'B' }, [['descrizione', 'y']]),
        primario('3', { tema: 'Base' })
    ];
    const voci = confronti.confrontoConAltraLista(corrente, altra, campi);

    //Solo il tema: come tenere una colonna sola in un foglio di calcolo.
    const soloTema = confronti.filtraVociConfronto(voci, { campi: ['tema'] });
    assert.deepStrictEqual(soloTema[0].differenze.map(d => d.campo), ['tema']);
    //Le solitarie restano anche col filtro sui campi: la loro notizia e' la presenza.
    assert.deepStrictEqual(soloTema.map(v => v.codiceGruppo), ['1', '2', '3']);

    const comuni = confronti.filtraVociConfronto(voci, { presenza: 'comuni' });
    assert.deepStrictEqual(comuni.map(v => v.codiceGruppo), ['1']);

    const solitarie = confronti.filtraVociConfronto(voci, { presenza: 'soloUna' });
    assert.deepStrictEqual(solitarie.map(v => v.codiceGruppo), ['2', '3']);

    //I campi offerti al filtro sono quelli che hanno qualcosa da mostrare, osservati prima.
    assert.deepStrictEqual(confronti.campiDisponibili(voci).map(c => c.canale + ':' + c.campo),
        ['osservato:tema', 'osservato:ruolo', 'compilato:descrizione']);
});

test('l\'identita\' di una lista e i nomi per l\'operatore', () => {
    const records = [primario('1', { 'Tracciato.Label': 'main', 'Tracciato.Versione': 2 }), primario('2', {})];
    assert.deepStrictEqual(confronti.identitaTracciato(records), { etichettaTracciato: 'main', versioneTracciato: '2', primari: 2 });
    assert.deepStrictEqual(confronti.identitaTracciato([]), { etichettaTracciato: '', versioneTracciato: '', primari: 0 });

    assert.strictEqual(confronti.descriviPresenza('entrambe'), 'Diversa');
    assert.strictEqual(confronti.descriviPresenza('soloCorrente'), 'Solo lista corrente');
    assert.strictEqual(confronti.descriviPresenza('soloAltra'), 'Solo altra lista');
    assert.strictEqual(confronti.descriviCanale('compilato'), 'Campo compilato');
    assert.strictEqual(confronti.descriviCanale('osservato'), 'Campo osservato');
});

test('una lista si riconosce in tutte e due le forme, e il filtro si racconta', () => {
    assert.deepStrictEqual(confronti.recordsDellaLista([1, 2]), [1, 2]);
    assert.deepStrictEqual(confronti.recordsDellaLista({ records: [1] }), [1]);
    //Un json qualsiasi non e' una lista: meglio dirlo che confrontare il nulla.
    assert.strictEqual(confronti.recordsDellaLista({ altro: 1 }), null);
    assert.strictEqual(confronti.recordsDellaLista(null), null);

    assert.strictEqual(confronti.descriviFiltro({}), 'presenze: tutte; canali: osservati, compilati; campi: tutti');
    assert.strictEqual(
        confronti.descriviFiltro({ presenza: 'comuni', canali: { compilato: false }, campi: ['tema'] },
            [{ canale: 'osservato', campo: 'tema', etichetta: 'Tema' }]),
        'presenze: solo in comune; canali: osservati; campi: Tema');
    assert.strictEqual(confronti.descriviFiltro({ presenza: 'soloUna', canali: { osservato: false, compilato: false }, campi: [] }),
        'presenze: solo in una lista; canali: nessuno; campi: nessuno');
});
