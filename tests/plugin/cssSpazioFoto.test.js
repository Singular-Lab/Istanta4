/*
 * Scelta dello spazio in cui finiscono le foto del box.
 *
 * Il modulo sotto test e' plugin/cssSpazioFoto.js. Due cose vanno protette: che il criterio
 * storico (vince lo spazio piu' ampio) resti identico dove nessuno chiede altro, e che il
 * criterio centrato non diventi una scusa per rimpicciolire le foto oltre misura.
 *
 * I candidati sono in coordinate relative alla base del box: x, y, width, height.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const cssSpazioFoto = require('../../plugin/cssSpazioFoto');

//Base larga 100 e alta 100: il centro e' in 50,50.
const larghezzaBase = 100;
const altezzaBase = 100;

//Gruppo foto verticale, alto 20 e largo 10, come il cartone di latte del collaudo.
//Bounds InDesign: [y1, x1, y2, x2].
const gruppoFoto = [0, 0, 20, 10];

//Spazio centrale: 40 x 40, centro in 50,50. Il gruppo ci sta alto 40 e largo 20.
const centrale = { x: 30, y: 30, width: 40, height: 40 };
//Spazio laterale un po' piu' alto: 40 x 46, centro in 80,50. Area maggiore ma scentrato.
const laterale = { x: 60, y: 27, width: 40, height: 46 };
//Spazio laterale molto piu' grande: qui la foto ci deve andare comunque.
const lateraleGrande = { x: 40, y: 0, width: 60, height: 100 };

test('senza preferenze vince lo spazio piu\' ampio, come e\' sempre stato', () => {
    const scelta = cssSpazioFoto.scegli([centrale, laterale], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, laterale);
});

test('col criterio centrato qualche millimetro in meno vale la centratura', () => {
    //E' il caso del cartone di latte: 6 di altezza in piu' non giustificano finire di lato.
    const scelta = cssSpazioFoto.scegli([centrale, laterale], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, centrale);
});

test('uno spazio laterale davvero piu\' grande vince anche col criterio centrato', () => {
    const scelta = cssSpazioFoto.scegli([centrale, lateraleGrande], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, lateraleGrande);
});

test('la tolleranza decide dove sta il confine, ed e\' un dato del cliente', () => {
    const candidati = [centrale, laterale];

    //Con una tolleranza stretta l'area del laterale non basta a essere scartata.
    const stretta = cssSpazioFoto.scegli(candidati, gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.99,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(stretta.candidato, laterale);

    //Con una tolleranza larga si accetta la perdita e si resta al centro.
    const larga = cssSpazioFoto.scegli(candidati, gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.5,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(larga.candidato, centrale);
});

test('l\'asse di centratura distingue lo scentramento che conta da quello che non conta', () => {
    //Stessa area: uno scentrato in orizzontale, l'altro in verticale.
    const scentratoX = { x: 0, y: 30, width: 40, height: 40 };
    const scentratoY = { x: 30, y: 0, width: 40, height: 40 };

    const suX = cssSpazioFoto.scegli([scentratoX, scentratoY], gruppoFoto, {
        modo: 'centrato',
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(suX.candidato, scentratoY);

    const suY = cssSpazioFoto.scegli([scentratoX, scentratoY], gruppoFoto, {
        modo: 'centrato',
        asseCentratura: 'y'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(suY.candidato, scentratoX);
});

test('il lato che si esaurisce per primo e\' quello che comanda il ridimensionamento', () => {
    //Gruppo largo 20 e alto 10 dentro uno spazio 30 x 30: comanda la larghezza.
    const gruppoLargo = [0, 0, 10, 20];
    const scelta = cssSpazioFoto.scegli([{ x: 0, y: 0, width: 30, height: 30 }], gruppoLargo, null, larghezzaBase, altezzaBase);

    assert.ok(scelta.useXaxisForReference);
    assert.strictEqual(scelta.area, 15 * 30);

    //Gruppo alto: comanda l'altezza.
    const gruppoAlto = [0, 0, 20, 10];
    const sceltaAlta = cssSpazioFoto.scegli([{ x: 0, y: 0, width: 30, height: 30 }], gruppoAlto, null, larghezzaBase, altezzaBase);

    assert.ok(!sceltaAlta.useXaxisForReference);
    assert.strictEqual(sceltaAlta.area, 15 * 30);
});

test('uno spazio che non puo\' contenere il gruppo non viene scelto', () => {
    //Il gruppo si riduce in proporzione, quindi uno spazio schiacciato ospita comunque
    //una versione piccola: cio' che non passa e' lo spazio senza misure.
    const degenere = { x: 0, y: 0, width: 0, height: 40 };
    const scelta = cssSpazioFoto.scegli([degenere], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta, null);
});

test('senza candidati non si sceglie nulla e il chiamante lo vede', () => {
    assert.strictEqual(cssSpazioFoto.scegli([], gruppoFoto, null, larghezzaBase, altezzaBase), null);
    assert.strictEqual(cssSpazioFoto.scegli(null, gruppoFoto, null, larghezzaBase, altezzaBase), null);
});

test('una tolleranza assurda non blocca le foto', () => {
    //Sopra 1 nessuno spazio sarebbe ammesso: viene riportata a 1, che vale "solo a pari area".
    const preferenza = cssSpazioFoto.normalizzaPreferenza({ modo: 'centrato', tolleranzaArea: 5 });
    assert.strictEqual(preferenza.tolleranzaArea, 1);

    const zero = cssSpazioFoto.normalizzaPreferenza({ modo: 'centrato', tolleranzaArea: 0 });
    assert.strictEqual(zero.tolleranzaArea, cssSpazioFoto.tolleranzaPredefinita);

    const scelta = cssSpazioFoto.scegli([centrale, laterale], gruppoFoto, { modo: 'centrato', tolleranzaArea: 5 }, larghezzaBase, altezzaBase);
    assert.strictEqual(scelta.candidato, laterale);
});

test('un modo sconosciuto ricade sul criterio di sempre', () => {
    const preferenza = cssSpazioFoto.normalizzaPreferenza({ modo: 'quelloBello' });

    assert.strictEqual(preferenza.modo, 'areaMassima');
    assert.strictEqual(preferenza.asseCentratura, 'xy');
});

test('a pari area vince il primo spazio, come faceva il confronto originale', () => {
    const primo = { x: 0, y: 0, width: 40, height: 40 };
    const secondo = { x: 60, y: 0, width: 40, height: 40 };
    const scelta = cssSpazioFoto.scegli([primo, secondo], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, primo);
});
