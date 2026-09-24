/*
 * I20-936: la ricerca della lavorazione del documento attivo.
 *
 * Il caso segnalato: chi non ha i permessi per creare una lavorazione se la fa mandare da un
 * collega e la mette nella cartella, ma il plugin continua a dire che il documento non e'
 * valido finche' non lo si chiude e riapre. Il pulsante di rilettura rifa' questa ricerca, e
 * qui si verifica che la stessa chiamata risponda diversamente prima e dopo l'arrivo del file.
 *
 * La sequenza vera vive in indexNew.js e ficoProcess.js, che richiedono InDesign e non si
 * caricano sotto Node: qui c'e' solo la decisione.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const lavorazioneDelDocumento = require('../../plugin/lavorazioneDelDocumento');

const VOLANTINO = 'SS_TO_10-09-26.indd';

function voce(nomeFile, id) {
    return { file: nomeFile, id: id, details: { meta: '{"titolo":"Kit di prova"}' } };
}

test('la lavorazione del documento attivo viene trovata', () => {
    const contenuto = [voce('altro.indd', 10), voce(VOLANTINO, 42)];

    const trovata = lavorazioneDelDocumento.trovaLavorazione(contenuto, VOLANTINO);

    assert.notStrictEqual(trovata, null);
    assert.strictEqual(trovata.id, 42);
});

test('il file che non c\'e\' non e\' un errore, e\' una lavorazione da aspettare', () => {
    //readFile restituisce null quando lavorazioni.json non esiste ancora nella cartella.
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(null, VOLANTINO), null);
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(undefined, VOLANTINO), null);
});

test('un file che elenca altri documenti non vale per questo', () => {
    const contenuto = [voce('altro.indd', 10), voce('terzo.indd', 11)];

    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(contenuto, VOLANTINO), null);
});

test('la stessa ricerca cambia risposta quando la lavorazione arriva nella cartella', () => {
    //E\' il caso della segnalazione: prima il collega non l\'ha ancora mandata, poi si', e la
    //rilettura deve accorgersene senza che il plugin venga chiuso e riaperto.
    const primaDellInvio = [voce('altro.indd', 10)];
    const dopoLInvio = [voce('altro.indd', 10), voce(VOLANTINO, 77)];

    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(primaDellInvio, VOLANTINO), null);

    const trovata = lavorazioneDelDocumento.trovaLavorazione(dopoLInvio, VOLANTINO);
    assert.notStrictEqual(trovata, null);
    assert.strictEqual(trovata.id, 77);
});

test('una lista vuota non trova niente', () => {
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione([], VOLANTINO), null);
});

test('le voci rotte non fanno saltare la ricerca', () => {
    //Il file lo scrivono altri e puo\' arrivare con voci incomplete: la ricerca deve comunque
    //trovare quella buona invece di fallire e mostrare un blocco che non si capisce.
    const contenuto = [null, {}, { file: null }, voce(VOLANTINO, 5)];

    const trovata = lavorazioneDelDocumento.trovaLavorazione(contenuto, VOLANTINO);

    assert.notStrictEqual(trovata, null);
    assert.strictEqual(trovata.id, 5);
});

test('un contenuto che non e\' una lista non viene interpretato', () => {
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione({ file: VOLANTINO }, VOLANTINO), null);
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione('testo', VOLANTINO), null);
});

test('senza il nome del documento non si cerca', () => {
    const contenuto = [voce(VOLANTINO, 42)];

    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(contenuto, null), null);
    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(contenuto, ''), null);
});

test('con piu\' voci per lo stesso documento vale la prima, come prima di I20-936', () => {
    const contenuto = [voce(VOLANTINO, 1), voce(VOLANTINO, 2)];

    assert.strictEqual(lavorazioneDelDocumento.trovaLavorazione(contenuto, VOLANTINO).id, 1);
});
