/*
 * I20-976: cosa succede quando cambia il primario di un gruppo nella scheda ref.
 *
 * Le due funzioni sotto test sono membri di plugin/schedaRef.js: non toccano InDesign, si
 * limitano a confrontare lo stato della scheda con i checkbox applicati e a chiedere alla
 * regola di agenzia cosa fare. La regola arriva iniettata, quindi qui non serve ne' il
 * middleware ne' il dato del server.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const schedaRef = require('../../plugin/schedaRef.js');

const AZIONI = schedaRef.AZIONI_CAMBIO_PRIMARIO;

function record(codice, statoSelezione, provenienzaEsempio) {
    const recordInTracciato = {
        'Referenza.Codice': codice,
        'Scatto.CodiceGruppo': 'A,B,C',
        StatoSelezione: statoSelezione
    };
    if (provenienzaEsempio !== undefined) {
        recordInTracciato.provenienzaEsempio = provenienzaEsempio;
    }
    return { recordInTracciato: recordInTracciato };
}

//La regola di agenzia di Edro, riscritta qui come la applicherebbe il middleware.
function regolaEdro(recordInTracciato) {
    const provenienza = recordInTracciato.provenienzaEsempio;
    if (provenienza === 'Primario') {
        return { azione: 'ricarica', messaggio: '' };
    }
    if (provenienza === 'Gruppo') {
        return { azione: 'avviso', messaggio: 'L\'esempio è del Gruppo: cambiare il primario non lo modifica.' };
    }
    return null;
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

test('esempio dal primario: la scheda va riscaricata', () => {
    const scheda = [record('A', 1, 'Primario'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    const esito = schedaRef.azioneCambioPrimario(scheda, applicati, regolaEdro);

    assert.strictEqual(esito.azione, AZIONI.ricarica);
    assert.strictEqual(esito.codicePrecedente, 'A');
    assert.strictEqual(esito.codiceNuovo, 'B');
    //La regola non porta un testo: vale il predefinito del Plugin.
    assert.strictEqual(esito.messaggio, schedaRef.MESSAGGIO_RICARICA_PREDEFINITO);
});

test('esempio dal gruppo: solo l\'avviso, con il testo della regola', () => {
    const scheda = [record('A', 1, 'Gruppo'), record('B', 2, 'Gruppo')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    const esito = schedaRef.azioneCambioPrimario(scheda, applicati, regolaEdro);

    assert.strictEqual(esito.azione, AZIONI.avviso);
    assert.match(esito.messaggio, /Gruppo/);
});

test('senza esempio non succede nulla, come per le agenzie che non hanno la regola', () => {
    const scheda = [record('A', 1), record('B', 2)];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, regolaEdro).azione, AZIONI.nessuna);
    //Nessuna regola iniettata e nessun middleware: comportamento di sempre.
    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, null).azione, AZIONI.nessuna);
});

test('se il primario non cambia la regola non viene nemmeno interrogata', () => {
    const scheda = [record('A', 1, 'Primario')];
    let interrogata = false;

    const esito = schedaRef.azioneCambioPrimario(scheda, [{ Codice: 'A', StatoSelezione: 1 }], () => {
        interrogata = true;
        return { azione: 'ricarica' };
    });

    assert.strictEqual(esito.azione, AZIONI.nessuna);
    assert.ok(!interrogata);
});

test('a record discordi la ricarica vince sull\'avviso', () => {
    //Riscaricare risolve anche cio' che l'avviso si limiterebbe a segnalare.
    const scheda = [record('A', 1, 'Gruppo'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, regolaEdro).azione, AZIONI.ricarica);
});

test('un\'azione sconosciuta non blocca e non inventa comportamenti', () => {
    const scheda = [record('A', 1, 'Primario'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, () => ({ azione: 'teletrasporto' })).azione, AZIONI.nessuna);
    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, () => null).azione, AZIONI.nessuna);
    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, () => ({})).azione, AZIONI.nessuna);
});

test('se la regola esplode non si blocca il salvataggio, che e\' gia\' avvenuto', () => {
    const scheda = [record('A', 1, 'Primario'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    const esito = schedaRef.azioneCambioPrimario(scheda, applicati, () => { throw new Error('regola rotta'); });

    assert.strictEqual(esito.azione, AZIONI.nessuna);
});

test('i record senza dato non fanno saltare la valutazione', () => {
    const scheda = [null, { recordInTracciato: null }, record('A', 1, 'Primario'), record('B', 2, 'Primario')];
    const applicati = [{ Codice: 'A', StatoSelezione: 2 }, { Codice: 'B', StatoSelezione: 1 }];

    assert.strictEqual(schedaRef.azioneCambioPrimario(scheda, applicati, regolaEdro).azione, AZIONI.ricarica);
});
