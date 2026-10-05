/*
 * I20-1003: il Plugin sceglieva la libreria sbagliata, e quindi le griglie sbagliate.
 *
 * Il contesto della promo si leggeva da ficoProcess.metaLavorazioneCorrente.meta.context, cioe'
 * dal FicoRuntimeKit che arriva da Fidelity dentro PromoLavorazioni.Meta. Quel campo non lo
 * riempie nessuno e resta vuoto, e con la lista vuota la condizione rule.context.every(...) e'
 * falsa per definizione: le regole delle librerie che hanno un contesto non matchavano mai e si
 * scivolava sulla regola generica. Nella configurazione Edro21 sono le regole 5 (tema MC) e 6
 * (tema BB) a saltare, e al loro posto rispondevano la 7 o la 8.
 *
 * pluginMiddleware.js fa require('./ficoProcess') che fa require('indesign'), e sotto Node non si
 * carica. Le funzioni si estraggono dal sorgente e si eseguono davvero, come gia' fa
 * edro-fixfoto-etichette.test.js con parseLabel: quello che si prova qui sono le regole, non la
 * presenza di una riga.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const sorgente = fs.readFileSync(
    path.join(__dirname, '..', '..', 'plugin', 'pluginMiddleware.js'), 'utf8');

//Il corpo di un membro dell'oggetto pluginMiddleware, isolato contando le graffe.
function corpoMembro(intestazione) {
    const inizio = sorgente.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, `${intestazione} non trovata: il test va aggiornato`);

    let livello = 0;
    let aperta = false;

    for (let i = inizio; i < sorgente.length; i++) {
        if (sorgente[i] === '{') { livello++; aperta = true; }
        else if (sorgente[i] === '}') { livello--; }
        if (aperta && livello === 0) {
            return sorgente.substring(inizio, i + 1);
        }
    }

    assert.fail(`corpo di ${intestazione} non delimitato`);
}

//Le funzioni di lettura del contesto come sono scritte davvero, con i globali del Plugin
//passati da fuori: sotto Node non esistono, nel Plugin li dichiara indexNew.js.
function caricaLettore(ambiente) {
    const membri = [
        corpoMembro('stessoValoreContesto(primo, secondo) {'),
        corpoMembro('contestoPromoDelRecord(record) {'),
        corpoMembro('recordsDellaLavorazione() {'),
        corpoMembro('contestoPromoDellaLavorazione() {')
    ];

    const fabbrica = new Function(
        'contenutoKitInLavorazione', 'readFile', 'pathLavorazione', 'idKitLavorazione',
        'ficoProcess', 'console', 'Utility',
        'return ({\n' + membri.join(',\n') + '\n});');

    return fabbrica(
        ambiente.contenutoKitInLavorazione,
        ambiente.readFile || (() => null),
        ambiente.pathLavorazione || '/lavorazione',
        ambiente.idKitLavorazione || 0,
        ambiente.ficoProcess || null,
        { warn() { }, error() { }, log() { } },
        //I20-1034: il nome della lista lo sa Utility.percorsoListaKit, con canale e area davanti.
        ambiente.Utility || { percorsoListaKit: (idKit) => (ambiente.pathLavorazione || '/lavorazione') + '/CN_TO_listaKit' + idKit + '.json' });
}

//La condizione che decide se una regola di libreria si applica, presa dal sorgente di
//getLibreria: e' il punto esatto dove il difetto si manifestava.
function caricaContextMatch() {
    const inizio = sorgente.indexOf('const contextMatch =');
    assert.notStrictEqual(inizio, -1, 'contextMatch non trovata: il test va aggiornato');

    const fine = sorgente.indexOf(';', inizio);
    assert.notStrictEqual(fine, -1, 'contextMatch non delimitata');

    const istruzione = sorgente.substring(inizio, fine + 1);

    return new Function('rule', 'promoContext', 'me', istruzione + '\nreturn contextMatch;');
}

//La regola 6 di Edro21: e' quella che la cliente si aspettava e che non veniva mai scelta.
const regolaBB = {
    ordine: 6,
    canale: ['SC', 'SS', 'CN', 'CY'],
    area: [],
    context: [{ nome_field: 'tema', user_value: 'BB' }],
    nomePromo: [],
    formati: [],
    tipoLavorazione: [1],
    nomeLibreria: ['Griglie_IS2_EDRO_MP_']
};

function record(contesto) {
    return { recordInTracciato: { 'Context.Promo': contesto } };
}

test('due valori di contesto coincidono a meno di spazi e di maiuscole', () => {
    const lettore = caricaLettore({});

    assert.strictEqual(lettore.stessoValoreContesto('BB', 'bb'), true);
    assert.strictEqual(lettore.stessoValoreContesto(' BB ', 'bb'), true);
    assert.strictEqual(lettore.stessoValoreContesto('tema', 'Tema'), true);
    assert.strictEqual(lettore.stessoValoreContesto('BB', 'MC'), false);

    //Un valore che non c'e' non deve diventare uguale a un valore che c'e'.
    assert.strictEqual(lettore.stessoValoreContesto(null, 'BB'), false);
});

test('Context.Promo si legge sia come lista sia come stringa json', () => {
    const lettore = caricaLettore({});

    const atteso = [{ nome_field: 'tema', user_value: 'BB' }];

    assert.deepStrictEqual(lettore.contestoPromoDelRecord(record(atteso)), atteso);

    //I record clonati da Menabo/ClonaRecordRicollegato portano la stringa della colonna
    //Context della promo cosi' com'e': senza questa lettura il difetto resterebbe su di loro.
    assert.deepStrictEqual(
        lettore.contestoPromoDelRecord(record(JSON.stringify(atteso))), atteso);
});

test('un Context.Promo assente o illeggibile non fa saltare la scelta della libreria', () => {
    const lettore = caricaLettore({});

    assert.deepStrictEqual(lettore.contestoPromoDelRecord(null), []);
    assert.deepStrictEqual(lettore.contestoPromoDelRecord({}), []);
    assert.deepStrictEqual(lettore.contestoPromoDelRecord(record(null)), []);
    assert.deepStrictEqual(lettore.contestoPromoDelRecord(record('non e json')), []);
    assert.deepStrictEqual(lettore.contestoPromoDelRecord(record({ tema: 'BB' })), []);
});

test('il contesto della lavorazione e\' quello del primo record che ce l\'ha', () => {
    const contesto = [{ nome_field: 'tema', user_value: 'BB' }];

    const lettore = caricaLettore({
        contenutoKitInLavorazione: {
            records: [record(null), record([]), record(contesto), record([{ nome_field: 'tema', user_value: 'MC' }])]
        }
    });

    assert.deepStrictEqual(lettore.contestoPromoDellaLavorazione(), contesto);
});

test('senza lista in memoria il contesto si legge dal file dell\'ultimo scaricamento', () => {
    const contesto = [{ nome_field: 'tema', user_value: 'MC' }];
    const letti = [];

    const lettore = caricaLettore({
        idKitLavorazione: 42,
        pathLavorazione: '/lavorazione',
        readFile: (percorso) => {
            letti.push(percorso);
            return { records: [record(contesto)] };
        }
    });

    assert.deepStrictEqual(lettore.contestoPromoDellaLavorazione(), contesto);
    assert.deepStrictEqual(letti, ['/lavorazione/CN_TO_listaKit42.json']);
});

test('senza record il contesto torna a leggersi dal meta della lavorazione', () => {
    const contesto = [{ nome_field: 'tema', user_value: 'BB' }];

    const lettore = caricaLettore({
        ficoProcess: { metaLavorazioneCorrente: { meta: { context: contesto } } }
    });

    assert.deepStrictEqual(lettore.contestoPromoDellaLavorazione(), contesto);
});

test('senza record e senza meta il contesto e\' vuoto, non un errore', () => {
    assert.deepStrictEqual(caricaLettore({}).contestoPromoDellaLavorazione(), []);
    assert.deepStrictEqual(
        caricaLettore({ ficoProcess: { metaLavorazioneCorrente: null } })
            .contestoPromoDellaLavorazione(), []);
});

test('la regola del tema BB si applica anche se la promo e\' stata salvata come bb', () => {
    const contextMatch = caricaContextMatch();
    const lettore = caricaLettore({});

    //Il difetto segnalato: contesto fornito, regola presente, libreria sbagliata.
    assert.strictEqual(
        contextMatch(regolaBB, [{ nome_field: 'tema', user_value: 'BB' }], lettore), true);

    assert.strictEqual(
        contextMatch(regolaBB, [{ nome_field: 'Tema', user_value: ' bb ' }], lettore), true);
});

test('la regola del tema BB non si applica a un altro tema o a un contesto vuoto', () => {
    const contextMatch = caricaContextMatch();
    const lettore = caricaLettore({});

    assert.strictEqual(
        contextMatch(regolaBB, [{ nome_field: 'tema', user_value: 'MC' }], lettore), false);

    //E' il comportamento di prima della correzione: con il contesto vuoto la regola salta.
    //Resta giusto che salti, ma il contesto vuoto non deve piu' essere la normalita'.
    assert.strictEqual(contextMatch(regolaBB, [], lettore), false);
});

test('una regola senza contesto si applica comunque', () => {
    const contextMatch = caricaContextMatch();
    const lettore = caricaLettore({});

    const regolaGenerica = { canale: ['SS'], area: [], context: [] };

    assert.strictEqual(contextMatch(regolaGenerica, [], lettore), true);
    assert.strictEqual(contextMatch({ canale: ['SS'] }, [], lettore), true);
});
