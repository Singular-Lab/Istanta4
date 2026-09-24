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

test('chiudendo la piu\' specifica comanda quella sotto', () => {
    // E' il caso della segnalazione: nazionale, ss, ss_sa; chiudo ss_sa e modifico ss.
    const elenco = [NAZ, CANALE_SS, { area: 'TO', canale: 'SS', chiusa: true }];

    const applicabile = varianti.varianteApplicabile(elenco, 'TO', 'SS');

    assert.strictEqual(varianti.specificita(applicabile), 1);
    assert.strictEqual(varianti.eModificabile(CANALE_SS, elenco, 'TO', 'SS'), true);
});

test('le chiuse restano visibili, per poterle riaprire', () => {
    const chiusa = { area: 'TO', canale: 'SS', chiusa: true };
    const elenco = [NAZ, chiusa];

    // Fuori dalla scala...
    assert.strictEqual(varianti.variantiApplicabili(elenco, 'TO', 'SS').length, 1);
    // ...ma ancora fra le linguette.
    assert.strictEqual(varianti.variantiDaMostrare(elenco, 'TO', 'SS').length, 2);
});

test('chiudendo tutte le specifiche si torna alla nazionale', () => {
    const elenco = [
        NAZ,
        { area: null, canale: 'SS', chiusa: true },
        { area: 'TO', canale: 'SS', chiusa: true }
    ];

    assert.strictEqual(varianti.specificita(varianti.varianteApplicabile(elenco, 'TO', 'SS')), 0);
});

test('la nazionale non si chiude nemmeno se arriva marcata', () => {
    // Sotto di lei non c'e' niente su cui ricadere: resterebbe un gruppo senza nessuna
    // variante modificabile.
    const nazionaleMarcata = { area: null, canale: null, chiusa: true };

    assert.strictEqual(varianti.eChiusa(nazionaleMarcata), false);
    assert.strictEqual(varianti.varianteApplicabile([nazionaleMarcata], 'TO', 'SS'), nazionaleMarcata);
});

test('una variante chiusa non e\' modificabile', () => {
    const chiusa = { area: 'TO', canale: 'SS', chiusa: true };
    const elenco = [NAZ, chiusa];

    assert.strictEqual(varianti.eModificabile(chiusa, elenco, 'TO', 'SS'), false);
});
