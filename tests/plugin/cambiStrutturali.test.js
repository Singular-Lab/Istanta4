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

test('le regole sul record continuano a funzionare come prima', () => {
    const record = { codice: 'ABC123', promozionale: true };

    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'codice', operatore: EQUALS, value: 'abc123' }, []), true);
    //Il booleano del record si confronta con la stringa "true" che arriva dal server.
    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'promozionale', operatore: EQUALS, value: 'true' }, []), true);
    assert.strictEqual(cambiStrutturali._matchRegola(record, { campo: 'promozionale', operatore: EQUALS, value: 'false' }, []), false);
});
