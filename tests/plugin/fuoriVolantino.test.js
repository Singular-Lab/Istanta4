/*
 * La voce "Fuori vol" del tracciato e la rimessa in volantino (plugin/fuoriVolantino.js).
 *
 * I fuori volantino arrivano con la lista del kit, nella sezione fuoriVolantino, raccolti
 * dall'esportazione dell'agenzia nel punto in cui li esclude. Se una regola del cliente vale ancora
 * (Coop: il tema con "fuori depliant"), prima di rimettere in volantino si correggono i suoi campi;
 * Salva si attiva solo se sono cambiati e la regola non vale piu'. Dopo, nella lista del kit si
 * aggiorna solo il gruppo.
 *
 * Esecuzione: node --test tests/plugin/fuoriVolantino.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leggiFileDelPlugin } = require('./fileDelPlugin');

global.Utility = global.Utility || { parseLabel: (label) => label };

const FuoriVolantino = require('../../plugin/fuoriVolantino');

/// Le chiavi come le manda il server (camelCase), dal JSON del cliente scritto in PascalCase.
function inCamelCase(valore) {
    if (Array.isArray(valore)) {
        return valore.map(inCamelCase);
    }
    if (valore != null && typeof valore === 'object') {
        const risultato = {};
        Object.keys(valore).forEach(k => { risultato[k.charAt(0).toLowerCase() + k.slice(1)] = inCamelCase(valore[k]); });
        return risultato;
    }
    return valore;
}

function configurazione(cliente) {
    const percorso = path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'external_source', cliente, 'SourceCustomPlugin.json');
    return inCamelCase(JSON.parse(fs.readFileSync(percorso, 'utf8').replace(/^﻿/, ''))).fuoriVolantinoInTracciato;
}

function articolo(codice, gruppo, extra = {}, label = 'VOL', idRec = null) {
    return {
        label: label,
        recordInTracciato: Object.assign({ 'Referenza.Codice': codice, 'Scatto.CodiceGruppo': gruppo, idRec: idRec, StatoSelezione: 1 }, extra)
    };
}

/* ---- la regola di Coop ---- */

//Gli stessi casi di StatoVolantinoTests.Coop_decide_dal_tema (Coopfi.InVolantinoDaTema): la regola
//del Plugin deve dire fuori volantino esattamente quando lo dice l'agenzia.
const CASI_TEMA = [
    ['FUORI DEPLIANT', false],
    ['SPRINT fuori depliant', false],
    ['Fuori Depliant - ortofrutta', false],
    ['SPRINT', true],
    ['', true],
];

test('la regola di Coop vale esattamente quando Coopfi.InVolantinoDaTema dice fuori volantino', () => {
    const regole = configurazione('Coopfi').regole;
    for (const [tema, inVolantino] of CASI_TEMA) {
        assert.strictEqual(FuoriVolantino.regolaCheVale({ tema: tema }, regole) == null, inVolantino, tema);
    }
    assert.strictEqual(FuoriVolantino.regolaCheVale({}, regole), null, 'senza tema non vale');
});

test('Coop abilita Fuori vol e corregge il tema; Edro21 e Famila no', () => {
    const coop = configurazione('Coopfi');
    assert.strictEqual(coop.abilitato, true);
    assert.deepStrictEqual(coop.regole.map(r => r.campi), [['tema']]);
    assert.strictEqual(configurazione('Edro21'), undefined);
    assert.strictEqual(configurazione('Famila'), undefined);
});

test('una regola senza condizione non vale mai', () => {
    assert.strictEqual(FuoriVolantino.regolaCheVale({ tema: 'x' }, [{ titolo: 't', condizione: [], campi: ['tema'] }]), null);
    assert.strictEqual(FuoriVolantino.regolaCheVale({ tema: 'x' }, null), null);
});

/* ---- Salva ---- */

test('Salva si attiva solo se il campo e\' cambiato e la regola non vale piu\'', () => {
    const regola = configurazione('Coopfi').regole[0];
    const record = { tema: 'SPRINT fuori depliant' };
    assert.strictEqual(FuoriVolantino.salvaAttivo(record, regola, { tema: 'SPRINT fuori depliant' }), false, 'non cambiato');
    assert.strictEqual(FuoriVolantino.salvaAttivo(record, regola, { tema: 'SPRINT Fuori Depliant' }), false, 'cambiato ma ancora fuori');
    assert.strictEqual(FuoriVolantino.salvaAttivo(record, regola, { tema: 'SPRINT' }), true);
    assert.strictEqual(FuoriVolantino.salvaAttivo(record, regola, { tema: '' }), true);
});

/* ---- scelta rapida ---- */

test('la scelta rapida offre i valori del campo nei record in volantino della lista, o niente senza lista', () => {
    const lista = {
        records: [articolo('1', '1', { tema: 'SPRINT' }), articolo('2', '2', { tema: 'JOLLY' }), articolo('3', '3', { tema: 'SPRINT' }), articolo('4', '4', { tema: ' ' })],
        fuoriVolantino: [articolo('5', '5', { tema: 'fuori depliant' })]
    };
    assert.deepStrictEqual(FuoriVolantino.valoriDelCampo(lista, 'tema'), ['JOLLY', 'SPRINT']);
    assert.strictEqual(FuoriVolantino.valoriDelCampo(null, 'tema'), null);
});

/* ---- righe, gruppi misti, parametri ---- */

test('le righe sono i primari della sezione, nell\'ordine della sezione', () => {
    const lista = { fuoriVolantino: [articolo('1', '1,2', { StatoSelezione: 1 }), articolo('2', '1,2', { StatoSelezione: 2 }), articolo('3', '3', { StatoSelezione: 3 })] };
    const righe = FuoriVolantino.righe(lista);
    assert.deepStrictEqual(righe.map(r => r.recordInTracciato['Referenza.Codice']), ['1', '3']);
    assert.deepStrictEqual(righe.map(r => r.index), [0, 2]);
    assert.deepStrictEqual(FuoriVolantino.righe({ records: [] }), [], 'lista senza sezione');
});

test('il gruppo misto si riconosce da label e codice gruppo, come li elenca il server', () => {
    const lista = { gruppiMisti: ['VOL|1,2'] };
    assert.strictEqual(FuoriVolantino.eGruppoMisto(articolo('1', '1,2'), lista), true);
    assert.strictEqual(FuoriVolantino.eGruppoMisto(articolo('1', '1,2', {}, 'POP'), lista), false);
    assert.strictEqual(FuoriVolantino.eGruppoMisto(articolo('1', '1,2'), {}), false);
});

test('i parametri portano il record e i campi col punto scritto $', () => {
    assert.strictEqual(FuoriVolantino.parametri(77, {}), 'idRec=77');
    assert.strictEqual(FuoriVolantino.parametri(77, { tema: 'SPRINT & co', 'Descrizioni.Peso': '1' }),
        'idRec=77&attributi.tema=SPRINT%20%26%20co&attributi.Descrizioni%24Peso=1');
});

test('codice gruppo e record si leggono dai parametri di un\'azione sul box', () => {
    assert.deepStrictEqual(FuoriVolantino.daParametri('codiceGruppo=1%2C2&idRec=77&azioni[0].attributi.Referenza%24InVolantino=false'), { codiceGruppo: '1,2', idRec: 77 });
    assert.deepStrictEqual(FuoriVolantino.daParametri('azioni[0].attributi.tema=x'), { codiceGruppo: null, idRec: null });
});

/* ---- aggiornamento del solo gruppo ---- */

test('rimesso in volantino, il gruppo passa fra i record con label e posizione di prima', () => {
    const fuori = [
        articolo('1', '1,2', { IndiceOrdinamento: 20, ordered: true }, 'VOL', 1),
        articolo('2', '1,2', { IndiceOrdinamento: 20, ordered: true, StatoSelezione: 2 }, 'VOL', 2),
        articolo('9', '9', { IndiceOrdinamento: 5 }, 'VOL', 9),
    ];
    const lista = {
        records: [articolo('5', '5', { IndiceOrdinamento: 10 }, 'VOL', 5), articolo('7', '7', { IndiceOrdinamento: 30 }, 'VOL', 7)],
        fuoriVolantino: fuori,
        gruppiMisti: ['VOL|1,2', 'VOL|8,9']
    };
    //La scheda del server: niente label, l'indice d'ordinamento dell'importazione.
    const scheda = {
        records: [
            { recordInTracciato: { 'Referenza.Codice': '1', 'Scatto.CodiceGruppo': '1,2', idRec: 1, IndiceOrdinamento: 9999 } },
            { recordInTracciato: { 'Referenza.Codice': '2', 'Scatto.CodiceGruppo': '1,2', idRec: 2, IndiceOrdinamento: 9999 } },
        ],
        fuoriVolantino: []
    };

    FuoriVolantino.aggiornaGruppo(lista, fuori[0], scheda);

    assert.deepStrictEqual(lista.records.map(a => a.recordInTracciato['Referenza.Codice']), ['5', '1', '2', '7']);
    assert.deepStrictEqual(lista.fuoriVolantino.map(a => a.recordInTracciato['Referenza.Codice']), ['9']);
    assert.ok(lista.records.filter(a => a.recordInTracciato['Scatto.CodiceGruppo'] === '1,2').every(a => a.label === 'VOL' && a.recordInTracciato.IndiceOrdinamento === 20 && a.recordInTracciato.ordered === true));
    assert.deepStrictEqual(lista.gruppiMisti, ['VOL|8,9']);
});

test('mandato fuori da un\'azione sul box, il gruppo passa nella sezione dei fuori volantino', () => {
    const dentro = articolo('3', '3', { IndiceOrdinamento: 10 }, 'VOL', 3);
    const lista = { records: [dentro, articolo('4', '4', { IndiceOrdinamento: 20 }, 'VOL', 4)], fuoriVolantino: [] };
    const scheda = { records: [], fuoriVolantino: [{ label: 'VOL', recordInTracciato: { 'Referenza.Codice': '3', 'Scatto.CodiceGruppo': '3', idRec: 3, 'Referenza.InVolantino': 'false' } }] };

    FuoriVolantino.aggiornaGruppo(lista, dentro, scheda);

    assert.deepStrictEqual(lista.records.map(a => a.recordInTracciato['Referenza.Codice']), ['4']);
    assert.deepStrictEqual(lista.fuoriVolantino.map(a => a.recordInTracciato['Referenza.Codice']), ['3']);
    assert.strictEqual(lista.fuoriVolantino[0].recordInTracciato.IndiceOrdinamento, 10);
});

/* ---- la configurazione nel middleware ---- */

function middlewareVero(customPluginDB, callCustom = false, customAgenzia = undefined) {
    const testo = leggiFileDelPlugin('pluginMiddleware.js');
    const inizio = testo.indexOf('    getFuoriVolantinoInTracciato() {');
    assert.notStrictEqual(inizio, -1, 'getFuoriVolantinoInTracciato non trovata');
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < testo.length && fine < 0; i++) {
        if (testo[i] === '{') { livello++; }
        else if (testo[i] === '}') { livello--; if (livello === 0) { fine = i + 1; } }
    }
    const membro = new Function('customAgenzia', 'return ({\n' + testo.substring(inizio, fine) + '\n});')(customAgenzia);
    return Object.assign(membro, { callCustom: callCustom, customPluginDB: customPluginDB });
}

test('Fuori vol e\' spento senza configurazione, acceso solo con abilitato vero', () => {
    const regole = [{ titolo: 't', condizione: [], campi: ['tema'] }];
    assert.deepStrictEqual(middlewareVero({ fuoriVolantinoInTracciato: { abilitato: true, regole: regole } }).getFuoriVolantinoInTracciato(), { abilitato: true, regole: regole });
    assert.deepStrictEqual(middlewareVero({}).getFuoriVolantinoInTracciato(), { abilitato: false, regole: [] });
    assert.deepStrictEqual(middlewareVero(null).getFuoriVolantinoInTracciato(), { abilitato: false, regole: [] });
    assert.deepStrictEqual(middlewareVero({ fuoriVolantinoInTracciato: { abilitato: 'si' } }).getFuoriVolantinoInTracciato(), { abilitato: false, regole: [] });
    assert.deepStrictEqual(middlewareVero(null, true, { fuoriVolantinoInTracciato: { abilitato: true } }).getFuoriVolantinoInTracciato(), { abilitato: true, regole: [] });
});

/* ---- dove si usa ---- */

test('la tendina offre Fuori vol solo se l\'agenzia lo dichiara e sceglierla toglie i criteri', () => {
    const filtri = leggiFileDelPlugin('filtri.js').replace(/\r/g, '');
    assert.match(filtri, /pluginMiddleware\.getFuoriVolantinoInTracciato\(\)\.abilitato\s*\?\s*\$\('<sp-menu-item><\/sp-menu-item>'\)\.text\('Fuori vol'\)\.val\(FuoriVolantino\.VISUALIZZAZIONE\)/);
    assert.match(filtri, /if \(selectedValue === FuoriVolantino\.VISUALIZZAZIONE\) \{\s*newFiltroDiv\.find\('\.criterio'\)\.remove\(\);\s*\}/);
    //La ricerca con i criteri lavora sulla sezione dei fuori volantino, senza impaginati.
    assert.match(filtri, /if \(filtro\.find\('\.filtro-visualizzazione'\)\.val\(\) === FuoriVolantino\.VISUALIZZAZIONE\) \{[\s\S]*?listaTracciato = \{ records: fuori \|\| \[\] \};\s*listImpaginati = \[\];/);
});

test('il tracciato mostra i fuori volantino col pulsante Rimetti al posto di Impagina', () => {
    const indexNew = leggiFileDelPlugin('indexNew.js').replace(/\r/g, '');
    assert.match(indexNew, /\} else if \(val === FuoriVolantino\.VISUALIZZAZIONE\) \{\s*\/\/[^\n]*\n\s*recordsDaMostrare = FuoriVolantino\.righe\(contenutoKitInLavorazione\);/);
    assert.match(indexNew, /\} else if \(val === FuoriVolantino\.VISUALIZZAZIONE\) \{\s*\/\/[^\n]*\n\s*tutti = !resRicerca\.criteriValidati\s*\? \(resRicerca\.listaCompleta \|\| \[\]\)\s*: \[\]\.concat\(resRicerca\.impaginati \|\| \[\], resRicerca\.nonImpaginati \|\| \[\]\);/);
    assert.match(indexNew, /listaFuoriVolantinoInRidisegno = val === FuoriVolantino\.VISUALIZZAZIONE \? contenutoKitInLavorazione : null;/);
    assert.match(indexNew, /function creaElementoTracciato\(obj, isFirst, riepilogoSegnalazioni = \{\}\) \{\s*const listaFuoriVolantino = listaFuoriVolantinoInRidisegno;/);
    assert.match(indexNew, /if \(listaFuoriVolantino != null\) \{\s*\/\/[^\n]*\n\s*\$cell\.append\(FuoriVolantino\.pulsante\(obj, \$row, FuoriVolantino\.eGruppoMisto\(obj, listaFuoriVolantino\)\)\);\s*\} else if \(obj\.paginaImpaginazione\) \{/);
});

test('un\'azione sul box che manda il gruppo fuori volantino aggiorna la lista, in tutti e due i percorsi', () => {
    const scheda = leggiFileDelPlugin('schedaRef.js').replace(/\r/g, '');
    const volte = scheda.split('await FuoriVolantino.aggiornaDopoUscita(params);').length - 1;
    assert.strictEqual(volte, 2);
});
