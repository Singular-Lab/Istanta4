/*
 * I20-1018: il log di crash non veniva mai scritto.
 *
 * writeDebugMessageForCrash scriveva in pathLavorazione + percorsoLogs, ma percorsoLogs e' gia'
 * assoluto dopo impostaPercorsiDiSistema: il Debuglog non compariva, e la scrittura fallita
 * mostrava l'IDX-98 "cartella logs assente" con la cartella al suo posto. Togliere e basta la
 * concatenazione non bastava: aprendo una lavorazione nuova si scrive nel log quando percorsoLogs
 * vale ancora "/Logs/", relativo alla lavorazione. La cartella la dice ora cartellaDeiLog, per
 * writeDebugMessageForCrash e per messaggioUtente.
 *
 * indexNew.js fa require('indesign') e sotto Node non si carica: la funzione si estrae dal
 * sorgente e si esegue con i valori delle variabili che legge.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexNew = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'indexNew.js'), 'utf8');

//Il corpo di una funzione, isolato contando le graffe a partire dalla sua intestazione.
function corpoFunzione(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, `${intestazione} non trovata: il test va aggiornato`);

    let livello = 0;
    let aperta = false;
    for (let i = inizio; i < testo.length; i++) {
        if (testo[i] === '{') { livello++; aperta = true; }
        else if (testo[i] === '}') { livello--; }
        if (aperta && livello === 0) {
            return testo.substring(inizio, i + 1);
        }
    }
    assert.fail(`corpo di ${intestazione} non delimitato`);
}

//Il valore di partenza come e' scritto davvero, per non ripeterlo a mano qui.
const defaultPercorsoLogs = (indexNew.match(/let defaultPercorsoLogs = "([^"]*)";/) || [])[1];

//cartellaDeiLog con le variabili che legge date da fuori.
const corpo = corpoFunzione(indexNew, 'function cartellaDeiLog()');
const crea = new Function('percorsoLogs', 'defaultPercorsoLogs', 'pathLavorazione', corpo + '\nreturn cartellaDeiLog();');
const cartella = (percorsoLogs, pathLavorazione) => crea(percorsoLogs, defaultPercorsoLogs, pathLavorazione);

const LAVORAZIONE = '/Users/operatore/Lavori/Promo_42';

test('il valore di partenza e\' la cartella Logs dentro la lavorazione', () => {
    assert.strictEqual(defaultPercorsoLogs, '/Logs/');
});

//Il caso della issue: percorsoLogs assoluto, da lavorazioni.json o dal default gia' completato.
test('un percorso assoluto si usa com\'e\', senza metterci davanti la lavorazione', () => {
    assert.strictEqual(cartella('/Users/operatore/Lavori/Promo_42/Logs/', LAVORAZIONE), '/Users/operatore/Lavori/Promo_42/Logs/');
    assert.strictEqual(cartella('/Volumes/Condivisa/Logs/', LAVORAZIONE), '/Volumes/Condivisa/Logs/');
});

//Aprendo una lavorazione nuova si scrive nel log prima che percorsoLogs diventi assoluto.
test('il valore di partenza viene completato con la cartella della lavorazione', () => {
    assert.strictEqual(cartella('/Logs/', LAVORAZIONE), LAVORAZIONE + '/Logs/');
});

//Vuoto vuol dire cartella assente: li' l'IDX-98 e' vero, e non si deve inventare un percorso.
test('una cartella dei log assente resta assente', () => {
    assert.strictEqual(cartella('', LAVORAZIONE), '');
});

test('writeDebugMessageForCrash e messaggioUtente chiedono la cartella a cartellaDeiLog', () => {
    const crash = corpoFunzione(indexNew, 'function writeDebugMessageForCrash(msg)');
    const messaggio = corpoFunzione(indexNew, 'async function messaggioUtente(');

    assert.match(crash, /var logPath = cartellaDeiLog\(\);/);
    assert.match(messaggio, /var logPath = cartellaDeiLog\(\);/);
});

test('fuori da cartellaDeiLog nessuno concatena piu\' lavorazione e cartella dei log', () => {
    //Si guarda il codice, non i commenti che raccontano il difetto.
    const codice = indexNew.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
    const occorrenze = codice.match(/pathLavorazione \+ percorsoLogs/g) || [];

    assert.strictEqual(occorrenze.length, 1);
    assert.match(corpo, /pathLavorazione \+ percorsoLogs/);
});
