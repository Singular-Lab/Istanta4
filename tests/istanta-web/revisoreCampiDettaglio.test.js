/*
 * I20-984: i campi editabili del blocco di dettaglio nella scheda del revisore.
 *
 * La libreria sotto esame e' Istanta/ScriptAgenzia/edro21/agenzia.js. Dopo I20-997 gli archivi
 * per cliente stanno fuori da wwwroot - non sono piu' serviti staticamente, li legge il server -
 * e non esiste piu' nessuna copia in radice da montare.
 *
 * "Note per impaginato" e i campi editabili della sua zona non partecipavano al rilevamento
 * delle modifiche: niente bordo rosso e niente "salva in gruppo". Il motivo e' che il controllo
 * dei campi custom guarda solo gli elementi con l'attributo chiave, che quelli non hanno,
 * perche' non vivono negli extra della revisione ma nel dato del tracciato.
 *
 * Ora quei campi dichiarano la loro chiave sul tracciato, si ricordano il valore di partenza e,
 * al salvataggio di gruppo, partono verso la loro destinazione: ma solo se sono cambiati.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Revisore = require('../../Istanta/wwwroot/js/revisore.js');

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

/* ---- e' cambiato? ---- */

test('un testo diverso da quello di partenza e\' una modifica', () => {
    assert.ok(Revisore.valoreCampoCambiato('nuova nota', 'vecchia nota'));
    assert.ok(!Revisore.valoreCampoCambiato('stessa nota', 'stessa nota'));
});

// Un campo mai riempito e uno svuotato sono la stessa cosa per chi legge il dato.
test('il nulla e la stringa vuota valgono uguale', () => {
    assert.ok(!Revisore.valoreCampoCambiato('', null));
    assert.ok(!Revisore.valoreCampoCambiato(null, ''));
    assert.ok(!Revisore.valoreCampoCambiato(undefined, ''));
    assert.ok(Revisore.valoreCampoCambiato('qualcosa', null));
    assert.ok(Revisore.valoreCampoCambiato('', 'c\'era qualcosa'));
});

test('gli spazi contano, perche\' finiscono nel dato', () => {
    assert.ok(Revisore.valoreCampoCambiato('nota ', 'nota'));
});

/* ---- cosa si manda ---- */

test('si mandano solo i campi cambiati', () => {
    const campi = [
        { codice: '111', chiave: 'noteImpaginato', valore: 'nuova', originale: 'vecchia' },
        { codice: '222', chiave: 'noteImpaginato', valore: 'ferma', originale: 'ferma' }
    ];

    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare(campi),
        [{ codice: '111', chiave: 'noteImpaginato', valore: 'nuova' }]);
});

// Il salvataggio di gruppo scorre piu' schede e puo' incontrare lo stesso campo dello stesso
// gruppo piu' volte: mandarlo due volte sarebbe due scritture per una modifica.
test('lo stesso campo dello stesso codice si manda una volta sola', () => {
    const campi = [
        { codice: '111,222', chiave: 'noteImpaginato', valore: 'nuova', originale: 'vecchia' },
        { codice: '111,222', chiave: 'noteImpaginato', valore: 'nuova', originale: 'vecchia' }
    ];

    assert.strictEqual(Revisore.campiTracciatoDaSalvare(campi).length, 1);
});

test('lo stesso campo di codici diversi si manda per ognuno', () => {
    const campi = [
        { codice: '111', chiave: 'noteImpaginato', valore: 'nuova', originale: '' },
        { codice: '222', chiave: 'noteImpaginato', valore: 'nuova', originale: '' }
    ];

    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare(campi).map(c => c.codice), ['111', '222']);
});

test('un campo senza chiave o senza codice non si manda', () => {
    const campi = [
        { codice: '111', chiave: '', valore: 'x', originale: '' },
        { codice: '', chiave: 'noteImpaginato', valore: 'x', originale: '' },
        null
    ];

    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare(campi), []);
});

test('senza campi non si manda niente', () => {
    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare([]), []);
    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare(null), []);
});

test('il valore parte come testo, anche quando arriva vuoto', () => {
    const campi = [{ codice: '111', chiave: 'noteImpaginato', valore: null, originale: 'c\'era' }];

    assert.deepStrictEqual(Revisore.campiTracciatoDaSalvare(campi),
        [{ codice: '111', chiave: 'noteImpaginato', valore: '' }]);
});

/* ---- come la pagina li tratta ---- */

// La nota esiste nelle librerie di piu' clienti: la modifica non e' di uno solo.
test('ogni cliente che ha il campo ne dichiara la chiave sul tracciato', () => {
    const clienti = ['edro21', 'famila', 'pac', 'trea'];

    for (const cliente of clienti) {
        const agenzia = sorgente('Istanta/ScriptAgenzia/' + cliente + '/agenzia.js');

        assert.ok(agenzia.includes('id="NoteImpaginato"'),
            'il caso va aggiornato se ' + cliente + ' non ha piu\' quel campo');
        assert.ok(agenzia.includes('campoTracciato="noteImpaginato"'),
            'senza chiave dichiarata, in ' + cliente + ' nessuno sa dove va salvato');
    }
});

// Alcuni clienti non implementano nemmeno il controllo dei campi custom: se la regola stesse
// li', da loro non succederebbe niente.
test('il rilevamento sta nel revisore, non nelle librerie di agenzia', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    assert.ok(revisore.includes('controlChangeCampiTracciato(box) {'),
        'la regola deve valere per tutti i clienti');
    assert.ok(revisore.includes('$(document).on("input", "[campoTracciato]"'),
        'senza ascolto il bordo rosso non compare mai, e l\'ascolto vale per i campi di tutti');

    for (const cliente of ['edro21', 'famila', 'pac', 'trea']) {
        const agenzia = sorgente('Istanta/ScriptAgenzia/' + cliente + '/agenzia.js');
        assert.ok(!agenzia.includes('controlChangeCampiTracciato'),
            'la regola non va duplicata in ' + cliente);
    }
});

// Il valore di partenza e' quello del record, da cui la scheda e' stata riempita: non si
// conserva da nessun'altra parte, e il salvataggio lo aggiorna.
test('il valore di partenza si legge dal record', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('controlChangeCampiTracciato(box) {');
    const metodo = revisore.slice(inizio, revisore.indexOf('recordDellaScheda(scheda) {', inizio));

    assert.ok(metodo.includes('record.recordInTracciato[chiave]'),
        'la chiave dichiarata sul campo e\' anche la chiave nel record');
});

// La casella del salva in gruppo sta sulla scheda: cercandola nel container piu' vicino non si
// spuntava niente, il pulsante compariva e il salvataggio non trovava schede selezionate.
test('la casella si cerca sulla scheda quando il contenitore vicino non ce l\'ha', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('changeBorderAndSave(box) {');
    const metodo = revisore.slice(inizio, revisore.indexOf('undoBorder(box) {', inizio));

    assert.ok(metodo.includes('.checkbox-salva-gruppo").length === 0'),
        'serve accorgersi che li\' la casella non c\'e\'');
    assert.ok(metodo.includes('.content.active'),
        'si prende quella della linguetta aperta, che e\' quella che l\'operatore guarda');
});

// Chi lavora su una scheda a meta' elenco si ritrovava all'inizio della pagina.
test('il salvataggio non riporta piu\' in cima alla pagina', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('salvaTuttoRevisioni(callback) {');
    const metodo = revisore.slice(inizio, revisore.indexOf('salvaFunction(listAct, callback, senderButton) {', inizio));

    assert.ok(!metodo.includes('scrollToTop = true'),
        'nessun salvataggio deve piu\' chiedere il salto in cima');
});

// La domanda "vale per tutti i tracciati" compariva una volta per campo: con piu' schede
// selezionate diventava un mitragliamento.
test('la conferma sui tracciati si chiede una volta sola', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('salvaTuttoRevisioni(callback) {');
    const metodo = revisore.slice(inizio, revisore.indexOf('salvaFunction(listAct, callback, senderButton) {', inizio));

    assert.strictEqual((metodo.match(/confirm\(/g) || []).length, 1,
        'una domanda per tutto il salvataggio, non una per campo');
    assert.ok(metodo.includes('me.inviaCampoInDatoTracciato('),
        'l\'invio deve saltare la domanda, che e\' gia\' stata fatta');
    assert.ok(metodo.includes('this.salvaFunction(listAct, callback, null);'),
        'le descrizioni si salvano comunque');
});

test('il salvataggio del singolo campo continua a chiedere conferma', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('salvaCampoInDatoTracciato(key, value, codice) {');
    const metodo = revisore.slice(inizio, revisore.indexOf('inviaCampoInDatoTracciato(key, value, codice) {', inizio));

    assert.ok(metodo.includes('confirm('), 'il pulsante Salva del campo non cambia comportamento');
    assert.ok(metodo.includes('this.inviaCampoInDatoTracciato('), 'e poi passa dall\'invio comune');
});
