/*
 * I20-1239: la tendina "Filtro Tracciato/Promo" della sincronizzazione foto.
 *
 * Il layout carica gli script uno dopo l'altro e lancia la pagina solo alla fine: fino ad allora
 * la pagina si vede sotto il "loading". La tendina era visibile nel markup e la nascondeva solo
 * syncfoto.js, quindi per un cliente che la nasconde (Edro21) compariva e poi spariva.
 * Ora parte nascosta e la mostra il costruttore di SyncFoto, solo se l'agenzia non la nasconde:
 * la vede Coopfi, non Edro21 e Famila.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SyncFoto = require('../../Istanta/wwwroot/js/syncfoto.js');

const VISTA = path.join(__dirname, '../../Istanta/Views/SyncFoto/Index.cshtml');

test('nella pagina la tendina Filtro Tracciato/Promo parte nascosta', () => {
    const html = fs.readFileSync(VISTA, 'utf8');
    const select = html.match(/<select[^>]*id="cmbFiltroTracciato"[^>]*>/);
    assert.ok(select, 'la tendina cmbFiltroTracciato non e\' nella vista');
    assert.match(select[0], /style="[^"]*display\s*:\s*none/);
});

//Il costruttore di SyncFoto con un'agenzia finta e un jQuery che registra solo il display impostato.
function displayDopoIlCostruttore(nascondiFiltro) {
    const salvati = { $: global.$, Agenzia: global.Agenzia };
    const display = {};
    global.$ = (selettore) => ({
        css: (prop, valore) => { if (prop === 'display') { display[selettore] = valore; } }
    });
    global.Agenzia = class { nascondiFiltroTracciatiInSyncFoto() { return nascondiFiltro; } };
    try {
        new SyncFoto();
        return display['#cmbFiltroTracciato'];
    } finally {
        global.$ = salvati.$;
        global.Agenzia = salvati.Agenzia;
    }
}

test('con un\'agenzia che nasconde il filtro la tendina resta nascosta', () => {
    assert.strictEqual(displayDopoIlCostruttore(true), 'none');
});

test('con un\'agenzia che usa il filtro la tendina compare a pagina caricata', () => {
    assert.strictEqual(displayDopoIlCostruttore(false), 'block');
});

//Cosa dice lo script di agenzia di un cliente: true se nasconde il filtro.
function nascondeIlFiltro(cliente) {
    const testo = fs.readFileSync(path.join(__dirname, '../../Istanta/ScriptAgenzia', cliente, 'agenzia.js'), 'utf8').replace(/\r/g, '');
    const m = testo.match(/\n    nascondiFiltroTracciatiInSyncFoto\(\) \{\n        return (true|false);/);
    assert.ok(m, 'nascondiFiltroTracciatiInSyncFoto non trovata nello script di ' + cliente);
    return m[1] === 'true';
}

test('Coopfi vede il filtro, Edro21 e Famila no', () => {
    assert.strictEqual(nascondeIlFiltro('coopfi'), false);
    assert.strictEqual(nascondeIlFiltro('edro21'), true);
    assert.strictEqual(nascondeIlFiltro('famila'), true);
});
