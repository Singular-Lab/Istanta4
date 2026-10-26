/*
 * I20-1024: la scheda Visual di Confronti > Parametri confronto.
 *
 * Modifica campiDiControllo di SourceConfronto.json, cioe' i campi che il confronto fra liste
 * mostra prima e dopo. Qui si verificano le parti che decidono qualcosa: cosa si legge dal file,
 * quando l'elenco si puo' salvare, e che il file salvato non perda quello che la scheda non
 * mostra (rules, altre chiavi).
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ParametriConfronto = require('../../Istanta/wwwroot/js/parametriConfronto.js');

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

/* ---- cosa si legge dal file ---- */

test('si leggono i campi di controllo del file, come quello di Edro21', () => {
    const edro = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceConfronto.json'));

    assert.deepStrictEqual(ParametriConfronto.campiDaRadice(edro), [{ nome: 'tema', rules: [] }]);
});

test('un file vuoto o senza campiDiControllo da\' un elenco vuoto', () => {
    assert.deepStrictEqual(ParametriConfronto.campiDaRadice({}), []);
    assert.deepStrictEqual(ParametriConfronto.campiDaRadice(null), []);
    assert.deepStrictEqual(ParametriConfronto.campiDaRadice({ campiDiControllo: null }), []);
});

test('modificare i campi letti non tocca il file letto', () => {
    const radice = { campiDiControllo: [{ nome: 'tema', rules: ['x'] }] };
    const campi = ParametriConfronto.campiDaRadice(radice);

    campi[0].nome = 'altro';
    campi[0].rules.push('y');

    assert.strictEqual(radice.campiDiControllo[0].nome, 'tema');
    assert.deepStrictEqual(radice.campiDiControllo[0].rules, ['x']);
});

/* ---- quando si puo' salvare ---- */

test('un elenco di nomi diversi e non vuoti si puo\' salvare', () => {
    assert.deepStrictEqual(ParametriConfronto.valida([{ nome: 'tema' }, { nome: 'prezzo_offerta' }]), []);
    assert.deepStrictEqual(ParametriConfronto.valida([]), []);
});

test('un nome vuoto o di soli spazi si segnala sulla sua riga', () => {
    const errori = ParametriConfronto.valida([{ nome: 'tema' }, { nome: '   ' }, { nome: '' }]);

    assert.deepStrictEqual(errori.map(e => e.indice), [1, 2]);
    assert.match(errori[0].messaggio, /obbligatorio/);
});

//Due righe uguali darebbero due volte le stesse colonne nel confronto.
test('lo stesso nome due volte si segnala sulla seconda, anche con spazi diversi', () => {
    const errori = ParametriConfronto.valida([{ nome: 'tema' }, { nome: 'prezzo' }, { nome: ' tema ' }]);

    assert.deepStrictEqual(errori.map(e => e.indice), [2]);
    assert.match(errori[0].messaggio, /riga 1/);
});

/* ---- cosa si salva ---- */

test('si salva il file con i campi nuovi, senza spazi ai bordi', () => {
    const salvata = ParametriConfronto.radiceDaSalvare({ campiDiControllo: [] },
        [{ nome: ' tema ', rules: [] }, { nome: 'prezzo_offerta' }]);

    assert.deepStrictEqual(salvata, {
        campiDiControllo: [{ nome: 'tema', rules: [] }, { nome: 'prezzo_offerta', rules: [] }]
    });
});

//rules nessuno la usa ancora, ma e' nel file: la scheda non deve cancellarla.
test('le rules di ogni campo e le altre chiavi del file restano com\'erano', () => {
    const radice = { versione: 3, campiDiControllo: [{ nome: 'tema', rules: ['r1', 'r2'] }] };
    const campi = ParametriConfronto.campiDaRadice(radice);
    campi.push({ nome: 'prezzo', rules: [] });

    const salvata = ParametriConfronto.radiceDaSalvare(radice, campi);

    assert.strictEqual(salvata.versione, 3);
    assert.deepStrictEqual(salvata.campiDiControllo[0], { nome: 'tema', rules: ['r1', 'r2'] });
    assert.deepStrictEqual(salvata.campiDiControllo[1], { nome: 'prezzo', rules: [] });
    //La radice letta non viene modificata dal salvataggio.
    assert.strictEqual(radice.campiDiControllo.length, 1);
});

test('togliere tutti i campi salva un elenco vuoto, non un file vuoto', () => {
    const salvata = ParametriConfronto.radiceDaSalvare({ campiDiControllo: [{ nome: 'tema', rules: [] }] }, []);

    assert.deepStrictEqual(salvata, { campiDiControllo: [] });
});

test('il file salvato si rilegge uguale', () => {
    const campi = [{ nome: 'tema', rules: [] }, { nome: 'prezzo_offerta', rules: ['a'] }];
    const json = JSON.stringify(ParametriConfronto.radiceDaSalvare({}, campi));

    assert.deepStrictEqual(ParametriConfronto.campiDaRadice(JSON.parse(json)), campi);
});

/* ---- la pagina ---- */

test('la scheda Visual non e\' piu\' un segnaposto e usa la classe nuova', () => {
    const pagina = sorgente('Istanta/Views/Confronti/Settings.cshtml');

    assert.doesNotMatch(pagina, /Nessuna interfaccia implementata/);
    assert.match(pagina, /<div id="parametriConfrontoBody"><\/div>/);
    assert.match(pagina, /src="~\/js\/parametriConfronto\.js\?v=\d+"/);
    assert.match(pagina, /new ParametriConfronto\("parametriConfrontoBody"/);
});

test('salva con lo stesso endpoint e lo stesso file della scheda Source', () => {
    const script = sorgente('Istanta/wwwroot/js/parametriConfronto.js');

    assert.match(script, /Call\.doWithLargePayload\('Confronti', 'salvaSourceJsonCode', 'PUT',\s*\{ jsoncode: json, origin: 'SourceConfronto' \}/);
    assert.match(script, /'\/SourceConfronto\.json\?v1\.'/);
});
