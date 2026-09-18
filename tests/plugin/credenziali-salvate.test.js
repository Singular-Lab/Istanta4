/*
 * I20-956: credenziali ricordate fra un avvio e l'altro del Plugin.
 *
 * Il modulo sotto test e' plugin/credenzialiSalvate.js. L'archivio si passa da fuori, quindi
 * qui si usa un doppio e non serve ne' UXP ne' il Portachiavi del sistema.
 *
 * Due cose vanno protette sopra le altre: che nessun guasto dell'archivio impedisca di fare
 * il login a mano, e che dimenticare le credenziali significhi dimenticarle davvero.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const credenzialiSalvate = require('../../plugin/credenzialiSalvate');

const radice = path.join(__dirname, '..', '..');

function sorgente(percorso) {
    return fs.readFileSync(path.join(radice, percorso), 'utf8');
}

/// Archivio finto, con lo stesso contratto di secureStorage.
function archivio({ rompiSuScrittura = false, rompiSuLettura = false } = {}) {
    const dati = new Map();

    return {
        dati,
        async setItem(chiave, valore) {
            if (rompiSuScrittura) {
                throw new Error('archivio non disponibile');
            }
            dati.set(chiave, valore);
        },
        async getItem(chiave) {
            if (rompiSuLettura) {
                throw new Error('archivio non disponibile');
            }
            return dati.has(chiave) ? dati.get(chiave) : null;
        },
        async removeItem(chiave) {
            dati.delete(chiave);
        }
    };
}

test('le credenziali salvate si rileggono', async () => {
    const credenziali = credenzialiSalvate.crea(archivio());

    assert.strictEqual(await credenziali.salva('mario', 'segreta'), true);

    assert.deepStrictEqual(await credenziali.leggi(), { username: 'mario', password: 'segreta' });
});

test('senza nulla di salvato non si legge nulla', async () => {
    const credenziali = credenzialiSalvate.crea(archivio());

    assert.strictEqual(await credenziali.leggi(), null);
});

// Uscire deve uscire davvero: se restasse mezza credenziale, il prossimo avvio
// ritenterebbe l'accesso.
test('dimenticare cancella entrambe le parti', async () => {
    const finto = archivio();
    const credenziali = credenzialiSalvate.crea(finto);

    await credenziali.salva('mario', 'segreta');
    await credenziali.dimentica();

    assert.strictEqual(await credenziali.leggi(), null);
    assert.strictEqual(finto.dati.size, 0);
});

test('una credenziale a meta\' non viene salvata', async () => {
    const credenziali = credenzialiSalvate.crea(archivio());

    assert.strictEqual(await credenziali.salva('mario', ''), false);
    assert.strictEqual(await credenziali.salva('', 'segreta'), false);
    assert.strictEqual(await credenziali.salva(null, null), false);
    assert.strictEqual(await credenziali.leggi(), null);
});

// Il Plugin deve restare utilizzabile anche dove l'archivio cifrato non c'e': in quel caso
// si fa il login a mano, come prima, invece di scrivere la password su disco.
test('senza archivio il Plugin non si rompe e non ricorda nulla', async () => {
    const credenziali = credenzialiSalvate.crea(null);

    assert.strictEqual(credenziali.disponibile(), false);
    assert.strictEqual(await credenziali.salva('mario', 'segreta'), false);
    assert.strictEqual(await credenziali.leggi(), null);
    assert.strictEqual(await credenziali.dimentica(), false);
});

test('un archivio che fallisce non impedisce il login', async () => {
    const inScrittura = credenzialiSalvate.crea(archivio({ rompiSuScrittura: true }));
    const inLettura = credenzialiSalvate.crea(archivio({ rompiSuLettura: true }));

    assert.strictEqual(await inScrittura.salva('mario', 'segreta'), false);
    assert.strictEqual(await inLettura.leggi(), null);
});

// secureStorage restituisce sequenze di byte: vanno riportate a testo, e un valore
// illeggibile non deve diventare una credenziale fasulla.
test('i valori tornano leggibili qualunque forma abbiano', () => {
    assert.strictEqual(credenzialiSalvate.aTesto('mario'), 'mario');
    assert.strictEqual(credenzialiSalvate.aTesto(new Uint8Array([109, 97, 114, 105, 111])), 'mario');
    assert.strictEqual(credenzialiSalvate.aTesto(null), '');
    assert.strictEqual(credenzialiSalvate.aTesto(undefined), '');
});

test('una coppia e\' utilizzabile solo se completa', () => {
    assert.strictEqual(credenzialiSalvate.coppiaUtilizzabile('mario', 'segreta'), true);
    assert.strictEqual(credenzialiSalvate.coppiaUtilizzabile('mario', ''), false);
    assert.strictEqual(credenzialiSalvate.coppiaUtilizzabile('', 'segreta'), false);
    assert.strictEqual(credenzialiSalvate.coppiaUtilizzabile(null, undefined), false);
});

/* ---- come il Plugin usa il modulo ---- */

test('il salvataggio avviene solo se l\'operatore lo ha chiesto', () => {
    const plugin = sorgente('plugin/indexNew.js');

    assert.ok(plugin.includes('async function login(username, password, ricordami = false)'),
        'la scelta della casella arriva alla funzione di login');
    assert.ok(plugin.includes('await credenzialiSalvate.salva(username, password);'),
        'si salva dopo un login riuscito');
    assert.ok(plugin.includes('await credenzialiSalvate.dimentica();'),
        'si dimentica quando la casella non e\' spuntata');
});

test('la casella non e\' spuntata per difetto', () => {
    const form = sorgente('plugin/index.html');
    const riga = form.split('\n').find(l => l.includes('id="ricordami"'));

    assert.ok(riga, 'la casella deve esistere nel form di login');
    assert.ok(!riga.includes('checked'),
        'ricordare le credenziali deve essere una scelta, non un comportamento che si subisce');
});

test('il logout dimentica le credenziali', () => {
    const plugin = sorgente('plugin/indexNew.js');
    const inizio = plugin.indexOf('async function logout(){');
    const blocco = plugin.slice(inizio, inizio + 2500);

    assert.ok(blocco.includes('await credenzialiSalvate.dimentica();'),
        'altrimenti il comando non farebbe uscire davvero');
});

test('l\'accesso automatico si tenta una volta sola', () => {
    const plugin = sorgente('plugin/indexNew.js');

    assert.ok(plugin.includes('var accessoAutomaticoTentato = false;'));
    assert.ok(plugin.includes('accessoAutomaticoTentato = true;'),
        'un accesso fallito non deve ripetersi a ogni richiamo del form');
});
