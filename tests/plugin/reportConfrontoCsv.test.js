/*
 * I20-981 (Lotto 2): le regole del csv del Report Integrita'.
 *
 * Il csv e' quello che l'operatore apre in Excel per decidere cosa sistemare: il nome deve
 * dire a che volantino si riferisce, l'ordine deve seguire l'impaginato e i valori non devono
 * rompersi sul punto e virgola.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const csv = require('../../plugin/reportConfrontoCsv');

test('il progressivo riprende dal numero piu\' alto della cartella', () => {
    assert.strictEqual(csv.prossimoProgressivo([]), 1);
    assert.strictEqual(csv.prossimoProgressivo(null), 1);
    assert.strictEqual(csv.prossimoProgressivo(['ConfR_1_kit_21-09-2026_1615.csv']), 2);

    //Con un buco in mezzo non si riusa un numero gia' visto.
    assert.strictEqual(csv.prossimoProgressivo([
        'ConfR_1_kit_21-09-2026_1615.csv',
        'ConfR_3_kit_21-09-2026_1620.csv'
    ]), 4);

    //Quello che non e' un report non conta.
    assert.strictEqual(csv.prossimoProgressivo([
        'reportConfronto_293_20260901_092033.csv',
        'appunti.txt',
        'ConfR_senzanumero_kit.csv'
    ]), 1);
});

test('il nome del file dice kit, data e ora', () => {
    const quando = new Date(2026, 8, 21, 16, 15, 0);

    assert.strictEqual(
        csv.nomeFileReport(1, 'P2611_vol_21-05-26 SS-SA', quando),
        'ConfR_1_P2611_vol_21-05-26 SS-SA_21-09-2026_1615.csv');

    //Ore e minuti a due cifre.
    assert.strictEqual(
        csv.nomeFileReport(12, 'kit', new Date(2026, 0, 2, 9, 5, 0)),
        'ConfR_12_kit_02-01-2026_0905.csv');
});

test('il titolo del kit non puo\' rompere il nome del file', () => {
    const quando = new Date(2026, 8, 21, 16, 15, 0);

    assert.strictEqual(
        csv.nomeFileReport(1, 'VOL/PROSSIMITA: SS*TO?', quando),
        'ConfR_1_VOL_PROSSIMITA_ SS_TO__21-09-2026_1615.csv');

    //Senza titolo il file resta comunque riconoscibile.
    assert.strictEqual(csv.nomeFileReport(1, '', quando), 'ConfR_1_kit_21-09-2026_1615.csv');
    assert.strictEqual(csv.nomeFileReport(1, null, quando), 'ConfR_1_kit_21-09-2026_1615.csv');
    assert.strictEqual(csv.nomeFileReport(1, '   ', quando), 'ConfR_1_kit_21-09-2026_1615.csv');
});

test('la descrizione unisce i campi con la barra', () => {
    const record = {
        'Descrizioni.Descrizione1': 'Pasta di semola',
        'Descrizioni.Descrizione2': 'Barilla',
        'Descrizioni.Descrizione3': '',
        'Descrizioni.Descrizione4': '500 g'
    };

    assert.strictEqual(csv.descrizioneComposta(record), 'Pasta di semola | Barilla | 500 g');
    assert.strictEqual(csv.descrizioneComposta({}), '');
    assert.strictEqual(csv.descrizioneComposta(null), '');

    //Il gruppo, quando c'e', vince sul record.
    assert.strictEqual(
        csv.descrizioneComposta({ 'Descrizioni.Descrizione1': 'singolo', descrizione_gruppo: { 'Descrizioni.Descrizione1': 'gruppo' } }),
        'gruppo');
});

test('il reparto porta la sigla fra parentesi', () => {
    assert.strictEqual(csv.repartoDelRecord({ reparto: 12, sigla_reparto: 'OF' }), '12 (OF)');
    //Senza sigla resta il reparto, senza reparto resta la sigla, senza niente e' vuoto.
    assert.strictEqual(csv.repartoDelRecord({ reparto: 12 }), '12');
    assert.strictEqual(csv.repartoDelRecord({ sigla_reparto: 'EX' }), 'EX');
    assert.strictEqual(csv.repartoDelRecord({}), '');
    assert.strictEqual(csv.repartoDelRecord(null), '');
});

test('etichetta e versione del tracciato arrivano nel csv', () => {
    const dati = csv.datiRecordPerCsv({
        'Tracciato.Label': 'SS_TO',
        'Tracciato.Versione': 3,
        reparto: 7,
        sigla_reparto: 'PE',
        'Descrizioni.Descrizione1': 'Mele'
    });

    assert.deepStrictEqual(dati, {
        etichetta: 'SS_TO',
        versione: '3',
        reparto: '7 (PE)',
        descrizione: 'Mele'
    });

    assert.deepStrictEqual(csv.datiRecordPerCsv(null), {
        etichetta: '', versione: '', reparto: '', descrizione: ''
    });
});

test('le righe seguono l\'impaginato, non il tipo di segnalazione', () => {
    const voci = [
        { stato: 'Nuovo', pagina: '' },
        { stato: 'Cambiato', pagina: '10' },
        { stato: 'Eliminato', pagina: '2' },
        { stato: 'Errore', pagina: '10' },
        { stato: 'Cambiato', pagina: 'Copertina' },
        { stato: 'Cambiato', pagina: '2' }
    ];

    const ordinate = csv.ordinaPerPagina(voci).map(v => v.stato + '@' + (v.pagina || '-'));

    assert.deepStrictEqual(ordinate, [
        'Eliminato@2',
        'Cambiato@2',
        'Cambiato@10',
        'Errore@10',
        'Cambiato@Copertina',
        'Nuovo@-'
    ]);
});

test('il punto e virgola dentro un valore non sposta le colonne', () => {
    assert.strictEqual(csv.campoCsv('Mele; pere'), '"Mele; pere"');
    assert.strictEqual(csv.campoCsv('dice "cosi"'), '"dice ""cosi"""');
    assert.strictEqual(csv.campoCsv('prima\nseconda'), '"prima\nseconda"');
    assert.strictEqual(csv.campoCsv('semplice'), 'semplice');
    assert.strictEqual(csv.campoCsv(null), '');
    assert.strictEqual(csv.campoCsv(0), '0');
});

test('il csv completo ha intestazioni, BOM e righe CRLF', () => {
    const testo = csv.componiCsv([
        {
            stato: 'Cambiato', pagina: '3', codiceGruppo: '123,456', etichetta: 'SS_TO',
            versione: '2', reparto: '7 (PE)', descrizione: 'Mele | Val Venosta',
            campo: 'prezzo_offerta', dettaglio: 'contenuto'
        }
    ]);

    assert.ok(testo.startsWith('﻿'), 'senza BOM Excel sbaglia le accentate');

    const righe = testo.split('\r\n');
    assert.strictEqual(righe[0], '﻿Stato;Pagina;Codice gruppo;Etichetta tracciato;Versione tracciato;Reparto;Descrizione;Campo;Dettaglio;Campi osservati');
    //La virgola dei codici gruppo non va virgolettata: il separatore e' il punto e virgola.
    //L'ultima colonna raccoglie i cambiamenti sui campi osservati: qui non ce ne sono.
    assert.strictEqual(righe[1], 'Cambiato;3;123,456;SS_TO;2;7 (PE);Mele | Val Venosta;prezzo_offerta;contenuto;');
    assert.strictEqual(righe[2], '', 'il file finisce con un a capo');

    //La colonna RefId non c'e' piu' e "Tipo" si chiama "Stato".
    assert.ok(!csv.INTESTAZIONI.includes('RefId'));
    assert.ok(!csv.INTESTAZIONI.includes('Tipo'));

    //I cambiamenti sui campi osservati stanno in coda, in una colonna sola.
    assert.strictEqual(csv.INTESTAZIONI[csv.INTESTAZIONI.length - 1], 'Campi osservati');
    const conConfronto = csv.componiCsv([{ stato: 'Nuovo', pagina: '', codiceGruppo: 'A', confronto: 'Tema: Bio \u2192 Base' }]);
    assert.ok(conConfronto.split('\r\n')[1].endsWith(';Tema: Bio \u2192 Base'));
});

test('i byte del csv sono utf8, accentate comprese', () => {
    //Il difetto: il csv salvato mostrava le accentate come segni che non c'entravano nulla.
    const testo = '﻿Stato;Descrizione\r\nCambiato;Caffè è più buono\r\n';
    const bytes = csv.bytesUtf8(testo);

    assert.ok(bytes instanceof Uint8Array);
    assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(testo, 'utf8'));

    //Il BOM esce come i tre byte che Excel si aspetta.
    assert.deepStrictEqual([bytes[0], bytes[1], bytes[2]], [0xef, 0xbb, 0xbf]);
});

test('anche i caratteri fuori dal piano base sopravvivono', () => {
    const testo = 'simbolo \u{1F600} e greco π';
    assert.deepStrictEqual(Buffer.from(csv.bytesUtf8(testo)), Buffer.from(testo, 'utf8'));
    assert.deepStrictEqual(Buffer.from(csv.bytesUtf8('')), Buffer.from('', 'utf8'));
    assert.deepStrictEqual(Buffer.from(csv.bytesUtf8(null)), Buffer.from('', 'utf8'));
});

test('la codifica utf8 regge anche senza TextEncoder', () => {
    //UXP non garantisce TextEncoder: il ripiego scritto a mano deve dare gli stessi byte.
    const salvato = globalThis.TextEncoder;
    delete globalThis.TextEncoder;
    delete require.cache[require.resolve('../../plugin/reportConfrontoCsv')];

    try {
        const senzaEncoder = require('../../plugin/reportConfrontoCsv');
        const testo = '﻿Caffè è più buono; costa 1€\r\nemoji \u{1F600}\r\n';

        assert.deepStrictEqual(
            Buffer.from(senzaEncoder.bytesUtf8(testo)),
            Buffer.from(testo, 'utf8'));
    }
    finally {
        globalThis.TextEncoder = salvato;
        delete require.cache[require.resolve('../../plugin/reportConfrontoCsv')];
    }
});

