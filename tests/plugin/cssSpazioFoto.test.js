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

test('col criterio centrato uno spazio che attraversa il centro viene usato solo nella sua parte simmetrica', () => {
    //Spazio libero da x 20 a x 90: le foto centrate li' starebbero in 55, non in 50.
    const sbilanciato = { x: 20, y: 0, width: 70, height: 40 };

    const scelta = cssSpazioFoto.scegli([sbilanciato], gruppoFoto, {
        modo: 'centrato',
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);

    //Il gruppo e' alto: comanda l'altezza, quindi la parte simmetrica non costa nulla in area.
    assert.strictEqual(scelta.candidato.x + scelta.candidato.width / 2, 50);
    assert.strictEqual(scelta.candidato.x, 20);
    assert.strictEqual(scelta.candidato.width, 60);
    assert.strictEqual(scelta.candidato.derivatoDa, sbilanciato);
});

test('la parte simmetrica di uno spazio non attraversa mai la tolleranza al contrario', () => {
    //Colonna a destra che parte dal centro: e' il caso della foto col lato sinistro a meta' box.
    const colonnaDestra = { x: 50, y: 0, width: 50, height: 100 };
    //Fascia larga sopra a un ostacolo basso: attraversa il centro ma e' bassa.
    const fasciaAlta = { x: 0, y: 0, width: 100, height: 30 };

    //Con tolleranza 0.7 la fascia (30 di altezza contro 100) non basta: resta la colonna.
    const stretta = cssSpazioFoto.scegli([colonnaDestra, fasciaAlta], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(stretta.candidato, colonnaDestra);

    //Abbassando la soglia si accetta la foto piccola pur di averla al centro.
    const larga = cssSpazioFoto.scegli([colonnaDestra, fasciaAlta], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.05,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(larga.candidato.x + larga.candidato.width / 2, 50);
});

test('la parte centrata esiste solo per gli spazi che attraversano il centro', () => {
    assert.strictEqual(cssSpazioFoto.parteCentrata({ x: 50, y: 0, width: 50, height: 100 }, 100, 100, 'x'), null);
    assert.strictEqual(cssSpazioFoto.parteCentrata({ x: 0, y: 0, width: 50, height: 100 }, 100, 100, 'x'), null);
    //Gia' simmetrico: nessuna variante da aggiungere.
    assert.strictEqual(cssSpazioFoto.parteCentrata({ x: 30, y: 0, width: 40, height: 100 }, 100, 100, 'x'), null);

    const suDueAssi = cssSpazioFoto.parteCentrata({ x: 10, y: 20, width: 80, height: 70 }, 100, 100, 'xy');
    assert.deepStrictEqual([suDueAssi.x, suDueAssi.y, suDueAssi.width, suDueAssi.height], [10, 20, 80, 60]);
});

test('senza criterio centrato nessuna parte simmetrica entra in gioco', () => {
    const sbilanciato = { x: 20, y: 0, width: 70, height: 40 };
    const scelta = cssSpazioFoto.scegli([sbilanciato], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, sbilanciato);
});

test('la descrizione per il log dice cosa c\'era e cosa si e\' scelto', () => {
    const scelta = cssSpazioFoto.scegli([centrale, laterale], gruppoFoto, { modo: 'centrato', asseCentratura: 'x' }, larghezzaBase, altezzaBase);
    const testo = cssSpazioFoto.descriviScelta([centrale, laterale], scelta, { modo: 'centrato', asseCentratura: 'x' }, larghezzaBase, altezzaBase);

    assert.match(testo, /modo centrato/);
    assert.match(testo, /candidati \[x30 y30 40x40; x60 y27 40x46\]/);
    assert.match(testo, /scelto x30 y30 40x40/);
    assert.match(cssSpazioFoto.descriviScelta([], null, null, 100, 100), /scelto nessuno/);
});

test('le estensioni tolgono spazio ai candidati lato per lato, senza scalare con la foto', () => {
    const candidato = { x: 10, y: 20, width: 50, height: 60, direction: 'sopra' };

    const ristretti = cssSpazioFoto.restringiCandidati([candidato], { alto: 1, sinistra: 2, basso: 3, destra: 4 });

    assert.strictEqual(ristretti.length, 1);
    assert.deepStrictEqual(
        [ristretti[0].x, ristretti[0].y, ristretti[0].width, ristretti[0].height],
        [12, 21, 44, 56]);
    assert.strictEqual(ristretti[0].derivatoDa, candidato);
    assert.strictEqual(ristretti[0].direction, 'sopra');
});

test('con l\'ombra sotto la foto viene piu\' bassa di quanto sporge l\'ombra e il suo lato basso resta libero', () => {
    //Spazio 40 x 40, foto alta: comanda l'altezza. Con 3 di estensione sotto la foto puo' essere alta 37.
    const ristretti = cssSpazioFoto.restringiCandidati([centrale], { basso: 3 });
    const scelta = cssSpazioFoto.scegli(ristretti, gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato.height, 37);
    //Il bordo basso dello spazio ristretto lascia esattamente i 3 mm all'ombra.
    assert.strictEqual(scelta.candidato.y + scelta.candidato.height, centrale.y + centrale.height - 3);
});

test('senza estensioni i candidati sono gli stessi oggetti di prima', () => {
    const candidati = [centrale, laterale];

    assert.strictEqual(cssSpazioFoto.restringiCandidati(candidati, null), candidati);
    assert.strictEqual(cssSpazioFoto.restringiCandidati(candidati, { alto: 0, basso: 0 }), candidati);
    assert.strictEqual(cssSpazioFoto.restringiCandidati(candidati, { basso: 'niente' }), candidati);
});

test('uno spazio che non regge le estensioni sparisce dalla scelta', () => {
    const basso = { x: 0, y: 0, width: 40, height: 5 };
    const ristretti = cssSpazioFoto.restringiCandidati([basso, centrale], { basso: 6 });

    assert.strictEqual(ristretti.length, 1);
    assert.strictEqual(ristretti[0].derivatoDa, centrale);
});

test('le estensioni negative o non numeriche valgono zero', () => {
    assert.deepStrictEqual(
        cssSpazioFoto.normalizzaEstensioni({ alto: -2, sinistra: 'x', basso: '2.5', destra: null }),
        { alto: 0, sinistra: 0, basso: 2.5, destra: 0 });
    assert.deepStrictEqual(cssSpazioFoto.normalizzaEstensioni(null), { alto: 0, sinistra: 0, basso: 0, destra: 0 });
});

test('la descrizione per il log riporta le estensioni quando ci sono', () => {
    const conEstensioni = cssSpazioFoto.descriviScelta([centrale], null, null, 100, 100, { basso: 3 });
    assert.match(conEstensioni, /estensioni alto 0 sinistra 0 basso 3 destra 0/);

    const senza = cssSpazioFoto.descriviScelta([centrale], null, null, 100, 100, null);
    assert.doesNotMatch(senza, /estensioni/);
});

/* ---- I20-978: le foto tornano tutte alla stessa scala ---- */

// Il fix foto conserva le proporzioni fra le foto e scala il gruppo. Basta che giri una
// volta senza una foto, perche' l'operatore l'ha nascosta, e le rimaste vengono ingrandite:
// riattivando quella nascosta, che nessuno ha toccato, la proporzione non vuol dire piu'
// niente e la foto tornata visibile resta piccola.
test("una foto rimasta indietro viene riportata alla scala della primaria", () => {
    assert.deepStrictEqual(cssSpazioFoto.fattoriDiNormalizzazione([120, 60]), [1, 2]);
});

test("dove le scale sono gia' uguali non cambia nulla", () => {
    assert.deepStrictEqual(cssSpazioFoto.fattoriDiNormalizzazione([80, 80, 80]), [1, 1, 1]);
});

test("la prima foto e' il riferimento e non si muove", () => {
    const fattori = cssSpazioFoto.fattoriDiNormalizzazione([50, 100, 25]);

    assert.strictEqual(fattori[0], 1);
    assert.deepStrictEqual(fattori, [1, 0.5, 2]);
});

// Una foto vuota, o con la scala illeggibile, non si tocca: non sappiamo a che scala sia.
test("le scale illeggibili lasciano la foto com'e'", () => {
    assert.deepStrictEqual(
        cssSpazioFoto.fattoriDiNormalizzazione([100, null, undefined, 0, -30, NaN, Infinity, "50"]),
        [1, 1, 1, 1, 1, 1, 1, 1]);
});

test("se il riferimento non si legge, comanda la prima scala utilizzabile", () => {
    assert.deepStrictEqual(cssSpazioFoto.fattoriDiNormalizzazione([null, 90, 45]), [1, 1, 2]);
});

test("senza foto non si rompe nulla", () => {
    assert.deepStrictEqual(cssSpazioFoto.fattoriDiNormalizzazione([]), []);
    assert.deepStrictEqual(cssSpazioFoto.fattoriDiNormalizzazione(null), []);
});

test("il fix foto normalizza prima di disporre le foto", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const sorgente = fs.readFileSync(
        path.join(__dirname, "..", "..", "plugin", "CssFramework.js"), "utf8");

    const normalizza = sorgente.indexOf("this.normalizzaScalaDelleFoto(fotos);");
    const raggruppa = sorgente.indexOf("this.getRaggruppamentoFoto(fotos, distanzFoto)");

    assert.ok(normalizza > 0, "la normalizzazione deve esistere");
    assert.ok(normalizza < raggruppa,
        "normalizzare dopo aver raggruppato non servirebbe: le proporzioni sono gia' state usate");
});
