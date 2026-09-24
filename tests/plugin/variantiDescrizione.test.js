/*
 * I20-993: quale variante di descrizione comanda, e cosa resta chiudendo una schermata.
 *
 * La scala e' NAZ, CANALE, AREA, AREA con CANALE. Il server manda l'elenco delle varianti che
 * esistono per la referenza; quale si applichi dipende dalla lavorazione aperta, e questa e' la
 * parte che decide. schedaRef.js non si carica sotto Node, quindi qui c'e' solo la regola.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const varianti = require('../../plugin/variantiDescrizione');

const NAZ = { area: null, canale: null };
const CANALE_SS = { area: null, canale: 'SS' };
const AREA_TO = { area: 'TO', canale: null };
const AREA_CANALE = { area: 'TO', canale: 'SS' };

test('la scala va dalla nazionale alla piu\' specifica', () => {
    assert.strictEqual(varianti.specificita(NAZ), 0);
    assert.strictEqual(varianti.specificita(CANALE_SS), 1);
    assert.strictEqual(varianti.specificita(AREA_TO), 2);
    assert.strictEqual(varianti.specificita(AREA_CANALE), 3);
});

test('la nazionale vale per qualunque lavorazione', () => {
    // Non dice niente su area e canale, quindi non puo' contraddire nessuna lavorazione.
    assert.strictEqual(varianti.siApplica(NAZ, 'TO', 'SS'), true);
    assert.strictEqual(varianti.siApplica(NAZ, 'MI', 'SA'), true);
    assert.strictEqual(varianti.siApplica(NAZ, null, null), true);
});

test('una variante di un\'altra area non vale per questa lavorazione', () => {
    assert.strictEqual(varianti.siApplica(AREA_TO, 'MI', 'SS'), false);
    assert.strictEqual(varianti.siApplica(CANALE_SS, 'TO', 'SA'), false);
    assert.strictEqual(varianti.siApplica(AREA_CANALE, 'TO', 'SA'), false);
});

test('comanda la piu\' specifica fra quelle che valgono', () => {
    const elenco = [NAZ, CANALE_SS, AREA_TO, AREA_CANALE];

    const applicabile = varianti.varianteApplicabile(elenco, 'TO', 'SS');

    assert.strictEqual(applicabile.area, 'TO');
    assert.strictEqual(applicabile.canale, 'SS');
});

test('le varianti di altre zone non comandano, anche se piu\' specifiche', () => {
    // C'e' una area+canale, ma e' di un'altra area: comanda il canale, che invece vale.
    const elenco = [NAZ, CANALE_SS, { area: 'MI', canale: 'SS' }];

    const applicabile = varianti.varianteApplicabile(elenco, 'TO', 'SS');

    assert.strictEqual(applicabile.canale, 'SS');
    assert.strictEqual(applicabile.area, null);
});

test('con la sola nazionale comanda la nazionale', () => {
    // E' lo stato di oggi sul Plugin, che mostra solo quella.
    const applicabile = varianti.varianteApplicabile([NAZ], 'TO', 'SS');

    assert.strictEqual(varianti.specificita(applicabile), 0);
});

test('senza varianti non comanda nessuno', () => {
    assert.strictEqual(varianti.varianteApplicabile([], 'TO', 'SS'), null);
    assert.strictEqual(varianti.varianteApplicabile(null, 'TO', 'SS'), null);
});

test('solo quella che comanda e\' modificabile, le altre no', () => {
    const elenco = [NAZ, CANALE_SS, AREA_CANALE];

    assert.strictEqual(varianti.eModificabile(AREA_CANALE, elenco, 'TO', 'SS'), true);
    assert.strictEqual(varianti.eModificabile(CANALE_SS, elenco, 'TO', 'SS'), false);
    assert.strictEqual(varianti.eModificabile(NAZ, elenco, 'TO', 'SS'), false);
});

test('chiudendo una schermata si scende di un gradino', () => {
    const elenco = [NAZ, CANALE_SS, AREA_CANALE];

    const dopo = varianti.varianteDopoChiusura(elenco, AREA_CANALE, 'TO', 'SS');

    assert.strictEqual(varianti.specificita(dopo), 1);
    assert.strictEqual(dopo.canale, 'SS');
});

test('si scende fino alla nazionale e non oltre', () => {
    const elenco = [NAZ, CANALE_SS];

    const dopoCanale = varianti.varianteDopoChiusura(elenco, CANALE_SS, 'TO', 'SS');
    assert.strictEqual(varianti.specificita(dopoCanale), 0);

    // Sotto la nazionale non c'e' niente: chiudere quella non lascia nessuna schermata.
    assert.strictEqual(varianti.varianteDopoChiusura(elenco, NAZ, 'TO', 'SS'), null);
});

test('la discesa salta le varianti che non valgono per questa lavorazione', () => {
    const elenco = [NAZ, { area: 'MI', canale: null }, AREA_CANALE];

    const dopo = varianti.varianteDopoChiusura(elenco, AREA_CANALE, 'TO', 'SS');

    // L'area MI sta in mezzo per specificita' ma non vale qui: si scende alla nazionale.
    assert.strictEqual(varianti.specificita(dopo), 0);
});

test('le stringhe vuote valgono come nazionale', () => {
    // L'archivio a volte scrive "" invece di null.
    const vuota = { area: '', canale: '   ' };

    assert.strictEqual(varianti.specificita(vuota), 0);
    assert.strictEqual(varianti.siApplica(vuota, 'TO', 'SS'), true);
});

test('l\'etichetta nomina la variante come la legge chi impagina', () => {
    assert.strictEqual(varianti.etichetta(NAZ), 'Nazionale');
    assert.strictEqual(varianti.etichetta(CANALE_SS), 'SS');
    assert.strictEqual(varianti.etichetta(AREA_TO), 'TO');
    assert.strictEqual(varianti.etichetta(AREA_CANALE), 'SS TO');
});

test('la nazionale non si chiude, le altre si\'', () => {
    // Chiudere la nazionale lascerebbe il gruppo senza niente su cui ricadere. Il server fa
    // rispettare la stessa regola anche se da qui ci si distraesse.
    assert.strictEqual(varianti.siPuoChiudere(NAZ), false);
    assert.strictEqual(varianti.siPuoChiudere({ area: '', canale: '  ' }), false);
    assert.strictEqual(varianti.siPuoChiudere(CANALE_SS), true);
    assert.strictEqual(varianti.siPuoChiudere(AREA_TO), true);
    assert.strictEqual(varianti.siPuoChiudere(AREA_CANALE), true);
});
