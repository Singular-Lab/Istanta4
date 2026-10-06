/*
 * I20-1002: le regole di cambio strutturale che guardano il contenuto di un campo del box.
 *
 * Il confronto sul tipo dell'oggetto InDesign era scritto "textFrame", mentre constructorName
 * vale "TextFrame": non era mai vero, il valore del campo restava null, e siccome _equals,
 * _contains e _in tornano tutti false su null, ogni regola isBox sul contenuto falliva in
 * silenzio. Reggevano solo Exist e NotExist, che guardano la presenza dell'oggetto e non quello
 * che c'e' scritto dentro.
 *
 * Il modulo usa Utility.parseLabel senza importarla, come fa il resto del Plugin: qui la
 * globale la mette il test, cosi' cambiStrutturali si carica sotto Node senza InDesign.
 *
 * Esecuzione: node --test tests/plugin/cambiStrutturali.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

//Nel Plugin le label sono decorate; qui basta l'identita', il decoro non e' oggetto del test.
global.Utility = { parseLabel: (label) => label };

const cambiStrutturali = require('../../plugin/cambiStrutturali');

//Un campo del box come lo restituisce Utility.getAllFieldsInGroup: la label per ritrovarlo e
//l'oggetto InDesign, di cui contano il tipo e il contenuto.
function campoTesto(label, contenuto) {
    return { label: label, item: { constructorName: 'TextFrame', contents: contenuto } };
}

function regolaSulBox(campo, operatore, valore) {
    return { isBox: true, campo: campo, operatore: operatore, value: valore };
}

const EQUALS = 0;
const NOT_EQUALS = 1;
const CONTAINS = 2;
const IN = 4;
const EXIST = 6;

test('una regola Equals legge il contenuto della casella di testo', () => {
    const campi = [campoTesto('prezzo', '4,99')];

    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('prezzo', EQUALS, '4,99'), campi), true);
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('prezzo', EQUALS, '9,99'), campi), false);
});

test('Contains e In guardano dentro al testo, non solo la presenza del campo', () => {
    const campi = [campoTesto('descrizione', 'Mozzarella di bufala campana')];

    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('descrizione', CONTAINS, 'bufala'), campi), true);
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('descrizione', CONTAINS, 'pecora'), campi), false);
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('descrizione', IN, 'campana'), campi), true);
});

test('NotEquals nega il confronto sul contenuto invece di essere sempre vero', () => {
    const campi = [campoTesto('prezzo', '4,99')];

    //Prima della correzione questa tornava sempre true: il valore era null, _equals dava false
    //e la negazione lo ribaltava. Una regola "diverso da" che non guarda niente e' peggio di
    //una che non c'e', perche' sembra funzionare.
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('prezzo', NOT_EQUALS, '4,99'), campi), false);
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('prezzo', NOT_EQUALS, '9,99'), campi), true);
});

test('il confronto non e\' sensibile alle maiuscole, come per i campi del record', () => {
    const campi = [campoTesto('marca', 'Barilla')];

    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('marca', EQUALS, 'barilla'), campi), true);
});

test('un campo che non e\' una casella di testo non ha contenuto da confrontare', () => {
    //Un rettangolo con dentro una foto esiste, ma non ha un testo: la regola sul contenuto
    //deve dire di no, non inventarsi un valore.
    const campi = [{ label: 'foto', item: { constructorName: 'Rectangle' } }];

    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('foto', EQUALS, 'qualcosa'), campi), false);
    //Exist pero' continua a vederlo: guarda se il campo c'e', non cosa contiene.
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('foto', EXIST, null), campi), true);
});

test('un campo assente non soddisfa la regola sul contenuto', () => {
    const campi = [campoTesto('prezzo', '4,99')];

    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('sconto', EQUALS, '10'), campi), false);
    assert.strictEqual(cambiStrutturali._matchRegola({}, regolaSulBox('sconto', EXIST, null), campi), false);
});

test('un campo annidato si legge scendendo nel percorso', () => {
    //I20-1002: _getNestedValue tornava sempre obj[path], quindi una regola su "Scatto.Codice"
    //non trovava niente. Nessun cliente usa oggi campi col punto, ma la trappola c'era.
    const record = { Scatto: { CodiceGruppo: 'ABC' }, semplice: 'x' };

    assert.strictEqual(cambiStrutturali._getNestedValue(record, 'Scatto.CodiceGruppo'), 'ABC');
    assert.strictEqual(cambiStrutturali._getNestedValue(record, 'semplice'), 'x');
    assert.strictEqual(cambiStrutturali._getNestedValue(record, 'Scatto.NonCe'), undefined);
    assert.strictEqual(cambiStrutturali._getNestedValue(record, 'non.esiste.affatto'), undefined);
});

test('la chiave letterale vince sul percorso, se esiste', () => {
    //Un campo puo' avere il punto nel nome: in quel caso comanda la chiave cosi' com'e'.
    const record = { 'a.b': 'letterale', a: { b: 'annidato' } };

    assert.strictEqual(cambiStrutturali._getNestedValue(record, 'a.b'), 'letterale');
});

test('Exist vede un campo annidato come lo vede il confronto sul valore', () => {
    //Prima la presenza si leggeva direttamente: il valore si trovava ed Exist diceva di no.
    const record = { Scatto: { CodiceGruppo: 'ABC' } };

    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'Scatto.CodiceGruppo', operatore: EXIST }, []), true);
    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'Scatto.NonCe', operatore: EXIST }, []), false);
});

test('le regole sul record continuano a funzionare come prima', () => {
    const record = { codice: 'ABC123', promozionale: true };

    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'codice', operatore: EQUALS, value: 'abc123' }, []), true);
    //Il booleano del record si confronta con la stringa "true" che arriva dal server.
    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'promozionale', operatore: EQUALS, value: 'true' }, []), true);
    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'promozionale', operatore: EQUALS, value: 'false' }, []), false);
});

/* ---- I20-1049: opzioni gruppo/primario dichiarate dall'azione ---- */

const fs = require('node:fs');
const path = require('node:path');
const { leggiFileDelPlugin } = require('./fileDelPlugin');

function struttura(opzioni) {
    const s = { titolo: 'Azione', istruzioni: [], campiInddCoinvolti: [] };
    if (opzioni !== undefined) {
        s.opzioniValide = opzioni;
    }
    return s;
}

test('le opzioni dichiarate arrivano alla scheda, nell\'ordine della tendina', () => {
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura(['tutto']), {}, 1).opzioniValide, ['tutto']);
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura(['primario', 'tutto']), {}, 1).opzioniValide, ['tutto', 'primario']);
    //Maiuscole e spazi non contano; il nome col maiuscolo, come nel JSON, vale lo stesso.
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy({ OpzioniValide: [' Primario '] }, {}, 1).opzioniValide, ['primario']);
});

test('un\'azione che non dichiara opzioni, o ne dichiara di sconosciute, le ammette tutte', () => {
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura(), {}, 1).opzioniValide, ['tutto', 'primario']);
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura([]), {}, 1).opzioniValide, ['tutto', 'primario']);
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura(['gruppo']), {}, 1).opzioniValide, ['tutto', 'primario']);
    assert.deepStrictEqual(cambiStrutturali._mapCambioStrutturaleToLegacy(struttura(null), {}, 1).opzioniValide, ['tutto', 'primario']);
});

test('senza azioni scelte non c\'e\' nessuna opzione, e la tendina non si mostra', () => {
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([]), []);
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni(null), []);
});

test('le opzioni valide per piu\' azioni sono quelle che hanno in comune', () => {
    const tutte = { opzioniValide: ['tutto', 'primario'] };
    const soloGruppo = { opzioniValide: ['tutto'] };
    const soloPrimario = { opzioniValide: ['primario'] };

    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([tutte]), ['tutto', 'primario']);
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([soloGruppo]), ['tutto']);
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([tutte, soloPrimario]), ['primario']);
    //Incompatibili: la scheda non lascia aggiungere la seconda.
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([soloGruppo, soloPrimario]), []);
    //Un'azione costruita senza la mappatura vale come se le ammettesse tutte.
    assert.deepStrictEqual(cambiStrutturali.opzioniComuni([{}, soloGruppo]), ['tutto']);
});

test('in Edro21 ogni azione sul box vale solo per tutto il gruppo', () => {
    const percorso = path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'external_source', 'Edro21', 'SourceCustomPlugin.json');
    const azioni = JSON.parse(fs.readFileSync(percorso, 'utf8').replace(/^﻿/, '')).cambiStrutturali;

    assert.ok(azioni.length > 0);
    for (const azione of azioni) {
        assert.deepStrictEqual(azione.OpzioniValide, ['tutto'], azione.Titolo);
        assert.deepStrictEqual(cambiStrutturali.opzioniComuni([cambiStrutturali._mapCambioStrutturaleToLegacy(azione, {}, 1)]), ['tutto']);
    }
});

test('la scheda mostra la tendina solo quando serve e salva con l\'opzione implicita', () => {
    const scheda = leggiFileDelPlugin('schedaRef.js').replace(/\r/g, '');

    //La tendina nasce nascosta e la mostra solo un gruppo con piu' di un'opzione.
    assert.match(scheda, /<sp-picker id=\\"cmbTipoSalvataggioStrutturale\\" style=\\"display:none;\\">/);
    assert.match(scheda, /\$\("#cmbTipoSalvataggioStrutturale"\)\.css\("display", this\.azioniDiGruppo && opzioni\.length > 1 \? "" : "none"\);/);
    //Si ricalcola quando un'azione si aggiunge, si toglie, o si svuota tutto con RESET.
    assert.strictEqual((scheda.match(/me\.aggiornaTendinaOpzioniStrutturali\(\);/g) || []).length, 3);
    //Un'azione senza opzioni in comune con quelle gia' scelte non si aggiunge.
    assert.match(scheda, /opzioniComuni\(me\.azioniStrutturaliAggiunte\(\)\.concat\(\[objCS\]\)\)\.length == 0\) \{\s*messaggioUtente\("Code SRF-99/);
    //Il salvataggio non legge piu' la tendina direttamente.
    assert.match(scheda, /if \(this\.opzioneAzioniStrutturali\(\) == "primario"\) \{/);
    assert.doesNotMatch(scheda, /if \(\$\("#cmbTipoSalvataggioStrutturale"\)\.val\(\) == "primario"\)/);
});
