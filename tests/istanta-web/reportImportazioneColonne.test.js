/*
 * TASK-110bdfa0: le colonne del report dell'importazione (Leggi report, promo.js consultaReport).
 *
 * Le colonne del core - Area/canale, Codice, Alterazioni - sono un elenco con il nome del campo nel dato, e
 * l'agenzia puo' escluderne alcune per nome (getColonneCoreEscluseReport nel suo agenzia.js). Coop esclude le
 * Alterazioni e chiede tema, settore, reparto e Referenza.Ean (getParametriReport). Escludere una colonna non
 * cambia il calcolo: stato, colori e conteggi restano. La ricerca e le azioni dirette leggono codice e
 * area/canale dalla riga, non dalla posizione della cella, che cambia quando una colonna manca.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Promo = require('../../Istanta/wwwroot/js/promo.js');

const radice = path.join(__dirname, '..', '..', 'Istanta');
const promo = fs.readFileSync(path.join(radice, 'wwwroot', 'js', 'promo.js'), 'utf8').replace(/\r/g, '');

/// Il valore che torna un metodo senza parametri dell'agenzia.js di un cliente.
function dallAgenzia(cliente, metodo) {
    const testo = fs.readFileSync(path.join(radice, 'ScriptAgenzia', cliente, 'agenzia.js'), 'utf8').replace(/\r/g, '');
    const trovato = testo.match(new RegExp('\\n    ' + metodo + '\\(\\) \\{\\n([\\s\\S]*?)\\n    \\}\\n'));
    return trovato == null ? undefined : new Function(trovato[1])();
}

const ITEM = { 'AC': 'SS-A', 'Referenza.Codice': '3191029', tema: 'JOLLY', settore: 'ortofrutta' };

test('senza esclusioni le colonne del core sono Area/canale, Codice, Alterazioni ed Etichetta', () => {
    //TASK-c4fdc17b: l'etichetta del tracciato e' una colonna del core; la natura dello scatto solo se chiesta.
    assert.deepStrictEqual(Promo.colonneCoreDelReport([]).map(c => c.titolo), ['Area/canale', 'Codice', 'Alterazioni', 'Etichetta']);
    assert.deepStrictEqual(Promo.colonneCoreDelReport(undefined).map(c => c.nome), ['AC', 'Referenza.Codice', 'Alterazioni', 'EtichettaTracciato']);
    assert.deepStrictEqual(Promo.colonneCoreDelReport([], true).map(c => c.titolo), ['Area/canale', 'Codice', 'Alterazioni', 'Etichetta', 'Scatto']);
});

test('una colonna del core esclusa per nome non c\'e\', le altre restano nel loro ordine', () => {
    assert.deepStrictEqual(Promo.colonneCoreDelReport(['Alterazioni']).map(c => c.nome), ['AC', 'Referenza.Codice', 'EtichettaTracciato']);
    assert.deepStrictEqual(Promo.colonneCoreDelReport(['AC']).map(c => c.nome), ['Referenza.Codice', 'Alterazioni', 'EtichettaTracciato']);
    //Un nome che non e' del core non toglie niente.
    assert.strictEqual(Promo.colonneCoreDelReport(['segmento']).length, 4);
});

test('le celle del core: il campo della colonna, e per le Alterazioni l\'elenco dei campi cambiati', () => {
    const [ac, codice, alterazioni] = Promo.colonneCoreDelReport([]);
    assert.strictEqual(Promo.cellaCoreDelReport(ac, ITEM, []), '<td>SS-A</td>');
    assert.strictEqual(Promo.cellaCoreDelReport(codice, ITEM, []), '<td>3191029</td>');
    assert.strictEqual(Promo.cellaCoreDelReport(alterazioni, ITEM, ['tema', 'prezzo_promo']), '<td>tema<br>prezzo_promo</td>');
    assert.strictEqual(Promo.cellaCoreDelReport(alterazioni, ITEM, []), '<td></td>');
    assert.strictEqual(Promo.cellaCoreDelReport(codice, {}, []), '<td></td>');
});

test('Coop: Area/canale, Codice, Etichetta, poi tema, settore, reparto e Referenza.Ean; niente Alterazioni e segmento', () => {
    const core = Promo.colonneCoreDelReport(dallAgenzia('coopfi', 'getColonneCoreEscluseReport')).map(c => c.titolo);
    const cliente = dallAgenzia('coopfi', 'getParametriReport');
    assert.deepStrictEqual(core.concat(cliente), ['Area/canale', 'Codice', 'Etichetta', 'tema', 'settore', 'reparto', 'Referenza.Ean']);
});

test('Edro21 non esclude niente e vede il report come prima', () => {
    assert.strictEqual(dallAgenzia('edro21', 'getColonneCoreEscluseReport'), undefined);
    assert.deepStrictEqual(dallAgenzia('edro21', 'getParametriReport'), ['segmento', 'reparto', 'Referenza.Ean']);
});

/* ---- il report usa le colonne del core e la riga porta codice e area/canale ---- */

const inizio = promo.indexOf('    consultaReport(id_attivita, id_promo) {');
const report = promo.substring(inizio, promo.indexOf('\n    consultaErrorReport(', inizio) > 0 ? promo.indexOf('\n    consultaErrorReport(', inizio) : promo.length);

test('intestazione e celle vengono dalle colonne del core, meno quelle che l\'agenzia esclude', () => {
    //TASK-c4fdc17b: con la natura dello scatto se l'agenzia la chiede; le celle dal testo di righeDelReport.
    assert.match(report, /let colonneCore = Promo\.colonneCoreDelReport\(this\.agenzia\.getColonneCoreEscluseReport != null \? this\.agenzia\.getColonneCoreEscluseReport\(\) : \[\],/);
    assert.match(report, /colonneCore\.forEach\(colonna => \{\s*tblRows \+= colonna\.nome == "Alterazioni" \? Promo\.cellaCoreDelReport\(colonna, item, riga\.alterate\)/);
    assert.match(report, /\$\{colonneCore\.map\(colonna => intestazione\(colonna\.nome, colonna\.titolo\)\)\.join\(""\)\}/);
    assert.doesNotMatch(report, /<th>Alterazioni<\/th>/);
    //Lo stato e il colore delle righe cambiate non dipendono dalla colonna Alterazioni.
    const righe = Promo.righeDelReport([{ 'Referenza.Codice': '1', AC: 'A', versione: 2, Alterazioni: { tema: 'X' } }], Promo.colonneCoreDelReport(['Alterazioni']), []);
    assert.strictEqual(righe[0].stato, 2);
    assert.match(report, /let sfondi = \{ 1: "white", 2: "#ebcbcb", 3: "#ceebcb", 4: "orange" \};/);
});

test('ricerca e azioni dirette leggono codice e area/canale dalla riga, non dalla posizione della cella', () => {
    assert.match(report, /data-codice="\$\{Promo\.html\(riga\.codice\)\}" data-ac="\$\{Promo\.html\(riga\.ac\)\}"/);
    assert.doesNotMatch(promo, /row\.find\("td"\)\.eq\(/);
    //TASK-c4fdc17b: la ricerca sta in Promo.rigaVisibile, su codice e area/canale della riga.
    assert.strictEqual(Promo.rigaVisibile({ stato: 1, codice: '3191029', ac: 'SS-A', valori: {} }, { testo: 'ss-a' }), true);
    assert.strictEqual(Promo.rigaVisibile({ stato: 1, codice: '3191029', ac: 'SS-A', valori: {} }, { testo: '3191' }), true);
    assert.strictEqual((promo.match(/let codiceRef = row\.attr\("data-codice"\);/g) || []).length, 2);
});
