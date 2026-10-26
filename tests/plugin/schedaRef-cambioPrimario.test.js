/*
 * I20-976: cosa succede quando cambia il primario di un gruppo nella scheda ref.
 *
 * Dopo un salvataggio primarie/secondarie il Plugin riscarica sempre la scheda e da li'
 * decide se il box in pagina va rifatto (codice del box cambiato), se proporne
 * l'aggiornamento (dati non piu' allineati) o se non fare nulla. L'agenzia contribuisce
 * solo un avviso.
 *
 * Le funzioni sotto test sono membri di plugin/schedaRef.js: non toccano InDesign e la
 * regola di agenzia arriva iniettata, quindi non serve ne' il middleware ne' il server.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const schedaRef = require('../../plugin/schedaRef.js');

const ESITI = schedaRef.ESITI_ALLINEAMENTO_BOX;

function record(codice, statoSelezione, provenienzaEsempio, codiceBox) {
    const recordInTracciato = {
        'Referenza.Codice': codice,
        'Scatto.CodiceGruppo': 'A,B,C',
        StatoSelezione: statoSelezione
    };
    if (provenienzaEsempio !== undefined) {
        recordInTracciato.provenienzaEsempio = provenienzaEsempio;
    }
    if (codiceBox !== undefined) {
        recordInTracciato.codiceBox = codiceBox;
    }
    return { recordInTracciato: recordInTracciato };
}

//L'avviso di agenzia di Edro, come lo restituirebbe il middleware.
function avvisoEdro(recordInTracciato) {
    return recordInTracciato.provenienzaEsempio === 'Gruppo'
        ? 'L\'esempio è del Gruppo: cambiare il primario non lo modifica.'
        : null;
}

test('il primario cambia quando il codice selezionato non e\' piu\' quello di prima', () => {
    const scheda = [record('A', 1), record('B', 2)];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    const esito = schedaRef.primarioCambiato(scheda, applicati);

    assert.ok(esito.cambiato);
    assert.strictEqual(esito.codicePrecedente, 'A');
    assert.strictEqual(esito.codiceNuovo, 'B');
});

test('riconfermare lo stesso primario non e\' un cambio', () => {
    const scheda = [record('A', 1), record('B', 2)];
    const applicati = [{ Codice: 'A', StatoSelezione: 1 }, { Codice: 'B', StatoSelezione: 3 }];

    assert.ok(!schedaRef.primarioCambiato(scheda, applicati).cambiato);
});

test('senza un primario prima o dopo non si segnala nulla', () => {
    //Questi casi hanno gia' i loro controlli nell'applica: qui non si aggiunge rumore.
    const senzaPrimarioPrima = schedaRef.primarioCambiato([record('A', 2)], [{ Codice: 'A', StatoSelezione: 1 }]);
    assert.ok(!senzaPrimarioPrima.cambiato);
    assert.strictEqual(senzaPrimarioPrima.codicePrecedente, null);

    const senzaPrimarioDopo = schedaRef.primarioCambiato([record('A', 1)], [{ Codice: 'A', StatoSelezione: 3 }]);
    assert.ok(!senzaPrimarioDopo.cambiato);
    assert.strictEqual(senzaPrimarioDopo.codiceNuovo, null);

    assert.ok(!schedaRef.primarioCambiato(null, null).cambiato);
    assert.ok(!schedaRef.primarioCambiato([], []).cambiato);
});

test('il codice si confronta come testo: 00123 e 123 non sono lo stesso primario', () => {
    const esito = schedaRef.primarioCambiato([record('00123', 1)], [{ Codice: 123, StatoSelezione: 1 }]);

    assert.ok(esito.cambiato);
});

test('esempio dal gruppo: l\'agenzia vuole avvisare', () => {
    const scheda = [record('A', 1, 'Gruppo'), record('B', 2, 'Gruppo')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.match(schedaRef.avvisoCambioPrimario(scheda, applicati, avvisoEdro), /Gruppo/);
});

test('esempio dal primario: nessun avviso, ci pensa il comportamento core', () => {
    //Il core riscarica la scheda e si accorge da se' che la descrizione e' cambiata.
    const scheda = [record('A', 1, 'Primario'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.avvisoCambioPrimario(scheda, applicati, avvisoEdro), '');
});

test('senza regola di agenzia non c\'e\' avviso', () => {
    const scheda = [record('A', 1, 'Gruppo'), record('B', 2, 'Gruppo')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.avvisoCambioPrimario(scheda, applicati, () => null), '');
    //Nessuna regola iniettata e nessun middleware: come le agenzie che non la configurano.
    assert.strictEqual(schedaRef.avvisoCambioPrimario(scheda, applicati, null), '');
});

test('se il primario non cambia la regola non viene nemmeno interrogata', () => {
    const scheda = [record('A', 1, 'Gruppo')];
    let interrogata = false;

    const avviso = schedaRef.avvisoCambioPrimario(scheda, [{ Codice: 'A', StatoSelezione: 1 }], () => {
        interrogata = true;
        return 'messaggio';
    });

    assert.strictEqual(avviso, '');
    assert.ok(!interrogata);
});

test('se la regola esplode non si blocca il salvataggio, che e\' gia\' avvenuto', () => {
    const scheda = [record('A', 1, 'Gruppo'), record('B', 2, 'Gruppo')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.avvisoCambioPrimario(scheda, applicati, () => { throw new Error('regola rotta'); }), '');
});

test('i record senza dato non fanno saltare la valutazione', () => {
    const scheda = [null, { recordInTracciato: null }, record('A', 1, 'Gruppo'), record('B', 2, 'Gruppo')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.match(schedaRef.avvisoCambioPrimario(scheda, applicati, avvisoEdro), /Gruppo/);
});

test('codice del box cambiato: si reimpagina, e vince su qualunque differenza', () => {
    assert.strictEqual(schedaRef.esitoAllineamentoBox('BOX41', 'BOX9', []), ESITI.reimpagina);
    assert.strictEqual(
        schedaRef.esitoAllineamentoBox('BOX41', 'BOX9', [{ label: 'descrizione', difference: 'contenuto' }]),
        ESITI.reimpagina);
});

test('stesso codice ma dati diversi: si propone di aggiornare il box', () => {
    const differenze = [{ label: 'descrizione', difference: 'contenuto' }];

    assert.strictEqual(schedaRef.esitoAllineamentoBox('BOX41', 'BOX41', differenze), ESITI.proponiAggiornamento);
});

test('stesso codice e nessuna differenza: non si fa nulla', () => {
    assert.strictEqual(schedaRef.esitoAllineamentoBox('BOX41', 'BOX41', []), ESITI.nessuno);
    assert.strictEqual(schedaRef.esitoAllineamentoBox('BOX41', 'BOX41', null), ESITI.nessuno);
});

test('senza uno dei due codici non si reimpagina a indovinare', () => {
    //Un codice mancante vuol dire dato incompleto, non box cambiato.
    assert.strictEqual(schedaRef.esitoAllineamentoBox('', 'BOX9', []), ESITI.nessuno);
    assert.strictEqual(schedaRef.esitoAllineamentoBox('BOX41', null, []), ESITI.nessuno);
    assert.strictEqual(schedaRef.esitoAllineamentoBox(null, null, []), ESITI.nessuno);
    //Ma le differenze restano da segnalare.
    assert.strictEqual(
        schedaRef.esitoAllineamentoBox('', 'BOX9', [{ label: 'x', difference: 'contenuto' }]),
        ESITI.proponiAggiornamento);
});

test('gli spazi attorno al codice del box non contano', () => {
    assert.strictEqual(schedaRef.esitoAllineamentoBox(' BOX41 ', 'BOX41', []), ESITI.nessuno);
});

test('il codice del box si legge dal primario, o dal primo record se manca', () => {
    const scheda = [record('A', 2, undefined, 'BOX9'), record('B', 1, undefined, 'BOX41')];
    assert.strictEqual(schedaRef.codiceBoxDellaScheda(scheda), 'BOX41');

    const senzaPrimario = [record('A', 2, undefined, 'BOX9')];
    assert.strictEqual(schedaRef.codiceBoxDellaScheda(senzaPrimario), 'BOX9');

    assert.strictEqual(schedaRef.codiceBoxDellaScheda([record('A', 1)]), '');
    assert.strictEqual(schedaRef.codiceBoxDellaScheda([]), '');
    assert.strictEqual(schedaRef.codiceBoxDellaScheda(null), '');
});
