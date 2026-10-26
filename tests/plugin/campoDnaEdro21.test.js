/*
 * TASK-80446016: in Edro21 paghi_3_sc e paghi_3_sc_EURprima entrano nella graduatoria dei campi
 * che ricevono il DNA del box, subito prima di descrizione.
 *
 * La graduatoria e' regoleApplicazioneDNA nel SourceCustomPlugin di Edro21: la legge
 * pluginMiddleware.getRegoleApplicazioneDNA e la applica Utility.setCampoDNA, che appende
 * "$DNA$..." al primo campo visibile della lista presente nel box. Un box senza campi di prezzo
 * ma con paghi_3_sc portava il DNA sulla descrizione; ora lo porta paghi_3_sc.
 *
 * pluginMiddleware.js e utility.js non si caricano sotto Node (require('indesign')): le funzioni
 * si estraggono dal sorgente e si eseguono davvero sul JSON vero del cliente, come in
 * contestoPromoLibreria.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const radice = path.join(__dirname, '..', '..');

function sorgente(percorsoRelativo) {
    return fs.readFileSync(path.join(radice, percorsoRelativo), 'utf8');
}

//Il corpo di un membro di un oggetto del Plugin, isolato contando le graffe.
function corpoMembro(testo, intestazione) {
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

const middleware = sorgente(path.join('plugin', 'pluginMiddleware.js'));
const utility = sorgente(path.join('plugin', 'utility.js'));

//Riletto a ogni uso: setCampoDNA aggiunge "base" in coda alla lista che riceve.
function sourceCustomPluginEdro() {
    return JSON.parse(sorgente(path.join('Istanta', 'wwwroot', 'external_source', 'Edro21', 'SourceCustomPlugin.json'))
        .replace(/^﻿/, ''));
}

function middlewareEdro() {
    const membri = new Function('return ({\n' + [
        corpoMembro(middleware, 'normalize(value) {'),
        corpoMembro(middleware, 'getRegoleApplicazioneDNA(recordInTracciato) {')
    ].join(',\n') + '\n});')();

    return Object.assign(membri, { customPluginDB: sourceCustomPluginEdro() });
}

//getFieldByLabel e setCampoDNA come sono scritte in utility.js. setCampoDNA chiede il campo
//senza parseLabel, quindi Utility.parseLabel non viene mai chiamata.
function utilityVera() {
    return new Function('Utility', 'return ({\n' + [
        corpoMembro(utility, 'getFieldByLabel:function(label, box, parseLabel = true)'),
        corpoMembro(utility, 'setCampoDNA(listCampiDNA, box, itemRef) {')
    ].join(',\n') + '\n});')({ parseLabel: () => assert.fail('parseLabel non attesa') });
}

const itemRef = { 'Referenza.Codice': '6119227', 'Scatto.CodiceGruppo': '6119227,6119231', idRec: 382329 };
const DNA = '$DNA$BOX1$6119227$6119227,6119231$382329';

//Un box finto con i campi indicati, nell'ordine dato; i nomi in nascosti sono campi non visibili.
function box(etichette, nascosti = []) {
    return {
        label: 'BOX1',
        isValid: true,
        allPageItems: etichette.map(etichetta => ({
            label: etichetta,
            isValid: true,
            visible: !nascosti.includes(etichetta)
        }))
    };
}

//Impagina il DNA come fa indexNew.js e restituisce le etichette che lo portano.
function assegnaDna(boxFinto) {
    const campiDNA = middlewareEdro().getRegoleApplicazioneDNA({ codiceBox: 'BOX1', meccanicaAssegnata: 'NM' });
    utilityVera().setCampoDNA(campiDNA, boxFinto, itemRef);

    return boxFinto.allPageItems.filter(campo => campo.label.includes('$DNA$')).map(campo => campo.label);
}

test('paghi_3_sc e paghi_3_sc_EURprima stanno subito prima di descrizione, per ogni box', () => {
    const campiDNA = middlewareEdro().getRegoleApplicazioneDNA({ codiceBox: 'BOX7', meccanicaAssegnata: 'NM' });

    assert.deepStrictEqual(campiDNA, [
        'sconto_norm',
        'sconto_fid',
        'prezzo_offerta',
        'prezzo_offerta_EURprima',
        'prezzo_offerta_etto',
        'prezzo_offerta_etto_EURprima',
        'prezzo_offerta_KgL',
        'prezzo_offerta_KgL_EURprima',
        'prezzo_offerta_secondo_EURprima',
        'paghi_3_sc',
        'paghi_3_sc_EURprima',
        'descrizione'
    ]);
});

test('senza campi di prezzo il DNA va su paghi_3_sc, non sulla descrizione', () => {
    //La descrizione e' prima nel box: decide la graduatoria, non l'ordine degli elementi.
    assert.deepStrictEqual(
        assegnaDna(box(['descrizione', 'paghi_3_sc_EURprima', 'paghi_3_sc'])),
        ['paghi_3_sc' + DNA]);
});

test('con paghi_3_sc nascosto il DNA va su paghi_3_sc_EURprima', () => {
    assert.deepStrictEqual(
        assegnaDna(box(['descrizione', 'paghi_3_sc', 'paghi_3_sc_EURprima'], ['paghi_3_sc'])),
        ['paghi_3_sc_EURprima' + DNA]);
});

test('senza paghi_3_sc visibili il DNA resta sulla descrizione', () => {
    assert.deepStrictEqual(
        assegnaDna(box(['descrizione', 'paghi_3_sc', 'paghi_3_sc_EURprima'], ['paghi_3_sc', 'paghi_3_sc_EURprima'])),
        ['descrizione' + DNA]);
    assert.deepStrictEqual(assegnaDna(box(['descrizione', 'sy_euro'])), ['descrizione' + DNA]);
});

test('un campo di prezzo piu\' in alto in graduatoria resta davanti a paghi_3_sc', () => {
    assert.deepStrictEqual(
        assegnaDna(box(['paghi_3_sc', 'descrizione', 'prezzo_offerta_secondo_EURprima'])),
        ['prezzo_offerta_secondo_EURprima' + DNA]);
    assert.deepStrictEqual(
        assegnaDna(box(['paghi_3_sc', 'prezzo_offerta', 'descrizione'])),
        ['prezzo_offerta' + DNA]);
});
