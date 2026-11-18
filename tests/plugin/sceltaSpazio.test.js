/*
 * Scelta dello spazio in cui finiscono le foto del box.
 *
 * Il modulo sotto test e' plugin/sistemazioneFoto/sceltaSpazio.js, che fino a I20-1009 si
 * chiamava sceltaSpazio.js e stava in plugin/. Due cose vanno protette: che il criterio
 * storico (vince lo spazio piu' ampio) resti identico dove nessuno chiede altro, e che il
 * criterio centrato non diventi una scusa per rimpicciolire le foto oltre misura.
 *
 * I candidati sono in coordinate relative alla base del box: x, y, width, height.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const sceltaSpazio = require('../../plugin/sistemazioneFoto/sceltaSpazio');

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
    const scelta = sceltaSpazio.scegli([centrale, laterale], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, laterale);
});

test('col criterio centrato qualche millimetro in meno vale la centratura', () => {
    //E' il caso del cartone di latte: 6 di altezza in piu' non giustificano finire di lato.
    const scelta = sceltaSpazio.scegli([centrale, laterale], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, centrale);
});

test('uno spazio laterale davvero piu\' grande vince anche col criterio centrato', () => {
    const scelta = sceltaSpazio.scegli([centrale, lateraleGrande], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, lateraleGrande);
});

test('la tolleranza decide dove sta il confine, ed e\' un dato del cliente', () => {
    const candidati = [centrale, laterale];

    //Con una tolleranza stretta l'area del laterale non basta a essere scartata.
    const stretta = sceltaSpazio.scegli(candidati, gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.99,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(stretta.candidato, laterale);

    //Con una tolleranza larga si accetta la perdita e si resta al centro.
    const larga = sceltaSpazio.scegli(candidati, gruppoFoto, {
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

    const suX = sceltaSpazio.scegli([scentratoX, scentratoY], gruppoFoto, {
        modo: 'centrato',
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(suX.candidato, scentratoY);

    const suY = sceltaSpazio.scegli([scentratoX, scentratoY], gruppoFoto, {
        modo: 'centrato',
        asseCentratura: 'y'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(suY.candidato, scentratoX);
});

test('il lato che si esaurisce per primo e\' quello che comanda il ridimensionamento', () => {
    //Gruppo largo 20 e alto 10 dentro uno spazio 30 x 30: comanda la larghezza.
    const gruppoLargo = [0, 0, 10, 20];
    const scelta = sceltaSpazio.scegli([{ x: 0, y: 0, width: 30, height: 30 }], gruppoLargo, null, larghezzaBase, altezzaBase);

    assert.ok(scelta.useXaxisForReference);
    assert.strictEqual(scelta.area, 15 * 30);

    //Gruppo alto: comanda l'altezza.
    const gruppoAlto = [0, 0, 20, 10];
    const sceltaAlta = sceltaSpazio.scegli([{ x: 0, y: 0, width: 30, height: 30 }], gruppoAlto, null, larghezzaBase, altezzaBase);

    assert.ok(!sceltaAlta.useXaxisForReference);
    assert.strictEqual(sceltaAlta.area, 15 * 30);
});

test('uno spazio che non puo\' contenere il gruppo non viene scelto', () => {
    //Il gruppo si riduce in proporzione, quindi uno spazio schiacciato ospita comunque
    //una versione piccola: cio' che non passa e' lo spazio senza misure.
    const degenere = { x: 0, y: 0, width: 0, height: 40 };
    const scelta = sceltaSpazio.scegli([degenere], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta, null);
});

test('senza candidati non si sceglie nulla e il chiamante lo vede', () => {
    assert.strictEqual(sceltaSpazio.scegli([], gruppoFoto, null, larghezzaBase, altezzaBase), null);
    assert.strictEqual(sceltaSpazio.scegli(null, gruppoFoto, null, larghezzaBase, altezzaBase), null);
});

test('una tolleranza assurda non blocca le foto', () => {
    //Sopra 1 nessuno spazio sarebbe ammesso: viene riportata a 1, che vale "solo a pari area".
    const preferenza = sceltaSpazio.normalizzaPreferenza({ modo: 'centrato', tolleranzaArea: 5 });
    assert.strictEqual(preferenza.tolleranzaArea, 1);

    const zero = sceltaSpazio.normalizzaPreferenza({ modo: 'centrato', tolleranzaArea: 0 });
    assert.strictEqual(zero.tolleranzaArea, sceltaSpazio.tolleranzaPredefinita);

    const scelta = sceltaSpazio.scegli([centrale, laterale], gruppoFoto, { modo: 'centrato', tolleranzaArea: 5 }, larghezzaBase, altezzaBase);
    assert.strictEqual(scelta.candidato, laterale);
});

test('un modo sconosciuto ricade sul criterio di sempre', () => {
    const preferenza = sceltaSpazio.normalizzaPreferenza({ modo: 'quelloBello' });

    assert.strictEqual(preferenza.modo, 'areaMassima');
    assert.strictEqual(preferenza.asseCentratura, 'xy');
});

test('a pari area vince il primo spazio, come faceva il confronto originale', () => {
    const primo = { x: 0, y: 0, width: 40, height: 40 };
    const secondo = { x: 60, y: 0, width: 40, height: 40 };
    const scelta = sceltaSpazio.scegli([primo, secondo], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, primo);
});

test('col criterio centrato uno spazio che attraversa il centro viene usato solo nella sua parte simmetrica', () => {
    //Spazio libero da x 20 a x 90: le foto centrate li' starebbero in 55, non in 50.
    const sbilanciato = { x: 20, y: 0, width: 70, height: 40 };

    const scelta = sceltaSpazio.scegli([sbilanciato], gruppoFoto, {
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
    const stretta = sceltaSpazio.scegli([colonnaDestra, fasciaAlta], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.7,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(stretta.candidato, colonnaDestra);

    //Abbassando la soglia si accetta la foto piccola pur di averla al centro.
    const larga = sceltaSpazio.scegli([colonnaDestra, fasciaAlta], gruppoFoto, {
        modo: 'centrato',
        tolleranzaArea: 0.05,
        asseCentratura: 'x'
    }, larghezzaBase, altezzaBase);
    assert.strictEqual(larga.candidato.x + larga.candidato.width / 2, 50);
});

test('la parte centrata esiste solo per gli spazi che attraversano il centro', () => {
    assert.strictEqual(sceltaSpazio.parteCentrata({ x: 50, y: 0, width: 50, height: 100 }, 100, 100, 'x'), null);
    assert.strictEqual(sceltaSpazio.parteCentrata({ x: 0, y: 0, width: 50, height: 100 }, 100, 100, 'x'), null);
    //Gia' simmetrico: nessuna variante da aggiungere.
    assert.strictEqual(sceltaSpazio.parteCentrata({ x: 30, y: 0, width: 40, height: 100 }, 100, 100, 'x'), null);

    const suDueAssi = sceltaSpazio.parteCentrata({ x: 10, y: 20, width: 80, height: 70 }, 100, 100, 'xy');
    assert.deepStrictEqual([suDueAssi.x, suDueAssi.y, suDueAssi.width, suDueAssi.height], [10, 20, 80, 60]);
});

test('senza criterio centrato nessuna parte simmetrica entra in gioco', () => {
    const sbilanciato = { x: 20, y: 0, width: 70, height: 40 };
    const scelta = sceltaSpazio.scegli([sbilanciato], gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato, sbilanciato);
});

test('la descrizione per il log dice cosa c\'era e cosa si e\' scelto', () => {
    const scelta = sceltaSpazio.scegli([centrale, laterale], gruppoFoto, { modo: 'centrato', asseCentratura: 'x' }, larghezzaBase, altezzaBase);
    const testo = sceltaSpazio.descriviScelta([centrale, laterale], scelta, { modo: 'centrato', asseCentratura: 'x' }, larghezzaBase, altezzaBase);

    assert.match(testo, /modo centrato/);
    assert.match(testo, /candidati \[x30 y30 40x40; x60 y27 40x46\]/);
    assert.match(testo, /scelto x30 y30 40x40/);
    assert.match(sceltaSpazio.descriviScelta([], null, null, 100, 100), /scelto nessuno/);
});

test('le estensioni tolgono spazio ai candidati lato per lato, senza scalare con la foto', () => {
    const candidato = { x: 10, y: 20, width: 50, height: 60, direction: 'sopra' };

    const ristretti = sceltaSpazio.restringiCandidati([candidato], { alto: 1, sinistra: 2, basso: 3, destra: 4 });

    assert.strictEqual(ristretti.length, 1);
    assert.deepStrictEqual(
        [ristretti[0].x, ristretti[0].y, ristretti[0].width, ristretti[0].height],
        [12, 21, 44, 56]);
    assert.strictEqual(ristretti[0].derivatoDa, candidato);
    assert.strictEqual(ristretti[0].direction, 'sopra');
});

test('con l\'ombra sotto la foto viene piu\' bassa di quanto sporge l\'ombra e il suo lato basso resta libero', () => {
    //Spazio 40 x 40, foto alta: comanda l'altezza. Con 3 di estensione sotto la foto puo' essere alta 37.
    const ristretti = sceltaSpazio.restringiCandidati([centrale], { basso: 3 });
    const scelta = sceltaSpazio.scegli(ristretti, gruppoFoto, null, larghezzaBase, altezzaBase);

    assert.strictEqual(scelta.candidato.height, 37);
    //Il bordo basso dello spazio ristretto lascia esattamente i 3 mm all'ombra.
    assert.strictEqual(scelta.candidato.y + scelta.candidato.height, centrale.y + centrale.height - 3);
});

test('senza estensioni i candidati sono gli stessi oggetti di prima', () => {
    const candidati = [centrale, laterale];

    assert.strictEqual(sceltaSpazio.restringiCandidati(candidati, null), candidati);
    assert.strictEqual(sceltaSpazio.restringiCandidati(candidati, { alto: 0, basso: 0 }), candidati);
    assert.strictEqual(sceltaSpazio.restringiCandidati(candidati, { basso: 'niente' }), candidati);
});

test('uno spazio che non regge le estensioni sparisce dalla scelta', () => {
    const basso = { x: 0, y: 0, width: 40, height: 5 };
    const ristretti = sceltaSpazio.restringiCandidati([basso, centrale], { basso: 6 });

    assert.strictEqual(ristretti.length, 1);
    assert.strictEqual(ristretti[0].derivatoDa, centrale);
});

test('le estensioni negative o non numeriche valgono zero', () => {
    assert.deepStrictEqual(
        sceltaSpazio.normalizzaEstensioni({ alto: -2, sinistra: 'x', basso: '2.5', destra: null }),
        { alto: 0, sinistra: 0, basso: 2.5, destra: 0 });
    assert.deepStrictEqual(sceltaSpazio.normalizzaEstensioni(null), { alto: 0, sinistra: 0, basso: 0, destra: 0 });
});

test('la descrizione per il log riporta le estensioni quando ci sono', () => {
    const conEstensioni = sceltaSpazio.descriviScelta([centrale], null, null, 100, 100, { basso: 3 });
    assert.match(conEstensioni, /estensioni alto 0 sinistra 0 basso 3 destra 0/);

    const senza = sceltaSpazio.descriviScelta([centrale], null, null, 100, 100, null);
    assert.doesNotMatch(senza, /estensioni/);
});

/* ---- I20-978: le foto tornano tutte alla stessa scala ---- */

// Il fix foto conserva le proporzioni fra le foto e scala il gruppo. Basta che giri una
// volta senza una foto, perche' l'operatore l'ha nascosta, e le rimaste vengono ingrandite:
// riattivando quella nascosta, che nessuno ha toccato, la proporzione non vuol dire piu'
// niente e la foto tornata visibile resta piccola.
test("una foto rimasta indietro viene riportata alla scala della primaria", () => {
    assert.deepStrictEqual(sceltaSpazio.fattoriDiNormalizzazione([120, 60]), [1, 2]);
});

test("dove le scale sono gia' uguali non cambia nulla", () => {
    assert.deepStrictEqual(sceltaSpazio.fattoriDiNormalizzazione([80, 80, 80]), [1, 1, 1]);
});

test("la prima foto e' il riferimento e non si muove", () => {
    const fattori = sceltaSpazio.fattoriDiNormalizzazione([50, 100, 25]);

    assert.strictEqual(fattori[0], 1);
    assert.deepStrictEqual(fattori, [1, 0.5, 2]);
});

// Una foto vuota, o con la scala illeggibile, non si tocca: non sappiamo a che scala sia.
test("le scale illeggibili lasciano la foto com'e'", () => {
    assert.deepStrictEqual(
        sceltaSpazio.fattoriDiNormalizzazione([100, null, undefined, 0, -30, NaN, Infinity, "50"]),
        [1, 1, 1, 1, 1, 1, 1, 1]);
});

test("se il riferimento non si legge, comanda la prima scala utilizzabile", () => {
    assert.deepStrictEqual(sceltaSpazio.fattoriDiNormalizzazione([null, 90, 45]), [1, 1, 2]);
});

test("senza foto non si rompe nulla", () => {
    assert.deepStrictEqual(sceltaSpazio.fattoriDiNormalizzazione([]), []);
    assert.deepStrictEqual(sceltaSpazio.fattoriDiNormalizzazione(null), []);
});

test("il fix foto normalizza prima di disporre le foto", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    //I20-1009: il fix foto sta in sistemazioneFoto.js, non piu' in CssFramework.js.
    const sorgente = fs.readFileSync(
        path.join(__dirname, "..", "..", "plugin", "sistemazioneFoto", "sistemazioneFoto.js"), "utf8");

    const normalizza = sorgente.indexOf("this.normalizzaScalaDelleFoto(fotos);");
    const raggruppa = sorgente.indexOf("this.getRaggruppamentoFoto(fotos, distanzFoto)");

    assert.ok(normalizza > 0, "la normalizzazione deve esistere");
    assert.ok(normalizza < raggruppa,
        "normalizzare dopo aver raggruppato non servirebbe: le proporzioni sono gia' state usate");
});

/*
 * I20-1240: fra le due disposizioni del box di Edro21 (descrizione sopra il prezzo, oppure a
 * sinistra del prezzo in basso), a parita' di foto, vince quella col vuoto piu' grande piu' piccolo.
 * Le misure sono quelle del documento della issue ("Scelta del layout del modulo"), in pixel dello
 * screenshot, relative al modulo: base 1673 x 1666.
 */
const BASE_L = 1673;
const BASE_H = 1666;
//Immagine al centro, descrizione e prezzo sul fondo: la disposizione da scegliere.
const TESTI_IN_BASSO = [
    { x: 0, y: 320, width: 1673, height: 568 },   //immagine
    { x: 357, y: 1025, width: 820, height: 641 }, //descrizione
    { x: 904, y: 1190, width: 769, height: 380 }, //prezzo
    { x: 853, y: 1570, width: 820, height: 96 }   //prezzo al kg
];
//Immagine in alto, descrizione sopra il prezzo nella colonna destra: lascia il blocco vuoto in basso a sinistra.
const TESTI_A_LATO = [
    { x: 0, y: 79, width: 1673, height: 567 },
    { x: 853, y: 550, width: 820, height: 640 },
    { x: 904, y: 1190, width: 769, height: 380 },
    { x: 853, y: 1570, width: 820, height: 96 }
];
const SPAREGGIO = { modo: 'centrato', tolleranzaArea: 0.7, asseCentratura: 'x', spareggio: 'vuotoMinore' };

test('I20-1240: il vuoto piu\' grande e la meta\' bassa occupata, sulle misure del documento', () => {
    const inBasso = sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_IN_BASSO);
    const aLato = sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_A_LATO);

    //La fascia sopra l'immagine, 1673 x 320: il 19,2%.
    assert.deepStrictEqual(inBasso.rettangolo, { x: 0, y: 0, width: 1673, height: 320 });
    assert.strictEqual(inBasso.quota.toFixed(3), '0.192');
    assert.strictEqual(inBasso.metaBassaOccupata.toFixed(3), '0.613');

    //Il blocco in basso a sinistra, 853 x 1020: il 31,2%.
    assert.deepStrictEqual(aLato.rettangolo, { x: 0, y: 646, width: 853, height: 1020 });
    assert.strictEqual(aLato.quota.toFixed(3), '0.312');
    assert.strictEqual(aLato.metaBassaOccupata.toFixed(3), '0.476');
});

test('I20-1240: gli ingombri fuori dalla base non contano, e una base vuota e\' tutta vuota', () => {
    const vuota = sceltaSpazio.vuotoMaggiore(100, 50, []);
    assert.strictEqual(vuota.quota, 1);
    assert.strictEqual(vuota.metaBassaOccupata, 0);

    //Un ingombro che sborda a destra conta solo per la parte dentro.
    const sborda = sceltaSpazio.vuotoMaggiore(100, 50, [{ x: 80, y: 0, width: 40, height: 50 }]);
    assert.deepStrictEqual(sborda.rettangolo, { x: 0, y: 0, width: 80, height: 50 });

    assert.strictEqual(sceltaSpazio.vuotoMaggiore(0, 50, []), null);
});

test('I20-1240: a parita\' di foto vince la disposizione col vuoto piu\' piccolo (box della pancetta)', () => {
    //Stessa foto e stessa centratura nelle due disposizioni: oggi restava la prima.
    const prima = { area: 950000, distanzaDalCentro: 0, vuoto: sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_A_LATO) };
    const seconda = { area: 950000, distanzaDalCentro: 0, vuoto: sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_IN_BASSO) };

    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, SPAREGGIO), 'seconda');
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(seconda, prima, SPAREGGIO), 'prima');
    //Foto che differiscono entro il 2% valgono pari.
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, Object.assign({}, seconda, { area: 935000 }), SPAREGGIO), 'seconda');
});

test('I20-1240: se le foto non sono pari decide la foto, come prima', () => {
    const vuotoGrande = sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_A_LATO);
    const vuotoPiccolo = sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_IN_BASSO);

    //Con la descrizione spostata la foto e' piu' piccola del 10%: resta la prima, foto piu' grande.
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(
        { area: 1000, distanzaDalCentro: 0, vuoto: vuotoGrande },
        { area: 900, distanzaDalCentro: 0, vuoto: vuotoPiccolo }, SPAREGGIO), 'prima');

    //La seconda e' piu' centrata: vince lei anche se lascia piu' vuoto.
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(
        { area: 1000, distanzaDalCentro: 5, vuoto: vuotoPiccolo },
        { area: 1000, distanzaDalCentro: 1, vuoto: vuotoGrande }, SPAREGGIO), 'seconda');
});

test('I20-1240: con vuoti quasi uguali decide la meta\' bassa piu\' occupata', () => {
    const prima = { area: 1000, distanzaDalCentro: 0, vuoto: { quota: 0.200, metaBassaOccupata: 0.50 } };
    const seconda = { area: 1000, distanzaDalCentro: 0, vuoto: { quota: 0.215, metaBassaOccupata: 0.60 } };
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, SPAREGGIO), 'seconda');

    //Pari anche la meta' bassa: decide la foto come sempre, a pari area resta la prima.
    const pari = { area: 1000, distanzaDalCentro: 0, vuoto: { quota: 0.21, metaBassaOccupata: 0.505 } };
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, pari, SPAREGGIO), 'prima');
});

test('I20-1240: senza lo spareggio, o senza le misure del vuoto, la scelta e\' quella di sempre', () => {
    const prima = { area: 1000, distanzaDalCentro: 0, vuoto: sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_A_LATO) };
    const seconda = { area: 1000, distanzaDalCentro: 0, vuoto: sceltaSpazio.vuotoMaggiore(BASE_L, BASE_H, TESTI_IN_BASSO) };

    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, { modo: 'centrato', tolleranzaArea: 0.7, asseCentratura: 'x' }), 'prima');
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, null), 'prima');
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 1000, distanzaDalCentro: 0 }, { area: 1000, distanzaDalCentro: 0 }, SPAREGGIO), 'prima');
    assert.strictEqual(sceltaSpazio.normalizzaPreferenza({ spareggio: 'altro' }).spareggio, null);
    assert.strictEqual(sceltaSpazio.normalizzaPreferenza({ spareggio: 'VUOTOMINORE' }).spareggio, 'vuotoMinore');
});

test('I20-1240: il CssFramework di Edro21 chiede lo spareggio sul vuoto in ogni preferenza delle foto', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const css = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'external_source', 'Edro21', 'SourceFrameworkCss.json'), 'utf8').replace(/^﻿/, ''));

    const preferenze = [];
    (function cerca(nodo) {
        if (Array.isArray(nodo)) { nodo.forEach(cerca); return; }
        if (nodo == null || typeof nodo !== 'object') { return; }
        if (nodo.sceltaSpazioFoto != null) { preferenze.push(nodo.sceltaSpazioFoto); }
        Object.values(nodo).forEach(cerca);
    })(css);

    assert.ok(preferenze.length > 0);
    preferenze.forEach(p => assert.strictEqual(sceltaSpazio.normalizzaPreferenza(p).spareggio, 'vuotoMinore'));
});

test('I20-1240: la prova del fix misura il vuoto solo se il box chiede lo spareggio', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'sistemazioneFoto', 'sistemazioneFoto.js'), 'utf8');
    assert.match(sorgente, /if \(sceltaSpazio\.normalizzaPreferenza\(preferenzaSpazio\)\.spareggio === sceltaSpazio\.vuotoMinore\) \{\s*this\.ultimaProiezione\.vuoto = this\.vuotoDellaDisposizione\(larghezzaBase, altezzaBase, obstacles, absoluteBounds\);/);
});

/* ---- I20-1240: la scelta fra le varianti delle simulazioni del fix foto ---- */

test('I20-1240: fra piu\' varianti vince la migliore con le regole di sempre', () => {
    const centrato = { modo: 'centrato', tolleranzaArea: 0.7, asseCentratura: 'xy' };
    const prove = [
        { area: 1000, distanzaDalCentro: 12 },
        { area: 900, distanzaDalCentro: 6 },
        { area: 850, distanzaDalCentro: 1 }
    ];

    assert.strictEqual(sceltaSpazio.migliorDisposizione(prove, centrato), 2);
    //con l'area massima vince la piu' grande
    assert.strictEqual(sceltaSpazio.migliorDisposizione(prove, null), 0);
});

test('I20-1240: a parita\' vince la variante che viene prima', () => {
    const prove = [{ area: 500 }, { area: 500.4 }, { area: 500 }];

    assert.strictEqual(sceltaSpazio.migliorDisposizione(prove, null), 0);
});

test('I20-1240: le varianti scartate o senza posto per le foto non vincono', () => {
    assert.strictEqual(sceltaSpazio.migliorDisposizione([null, { area: 0 }, { area: 300 }], null), 2);
    assert.strictEqual(sceltaSpazio.migliorDisposizione([null, null], null), -1);
    assert.strictEqual(sceltaSpazio.migliorDisposizione([], null), -1);
    assert.strictEqual(sceltaSpazio.migliorDisposizione(null, null), -1);
});

test('I20-1240: con due varianti la scelta e\' quella fra due disposizioni, spareggio compreso', () => {
    const preferenza = { modo: 'centrato', tolleranzaArea: 0.7, asseCentratura: 'xy', spareggio: 'vuotoMinore' };
    const lato = { area: 1000, distanzaDalCentro: 3, vuoto: { quota: 0.312, metaBassaOccupata: 0.476 } };
    const basso = { area: 1000, distanzaDalCentro: 3, vuoto: { quota: 0.192, metaBassaOccupata: 0.613 } };

    assert.strictEqual(sceltaSpazio.migliorDisposizione([lato, basso], preferenza),
        sceltaSpazio.preferisciDisposizione(lato, basso, preferenza) === 'seconda' ? 1 : 0);
    assert.strictEqual(sceltaSpazio.migliorDisposizione([lato, basso], preferenza), 1);
});

test('I20-1240: due rettangoli si toccano solo se si sovrappongono, non sul bordo', () => {
    assert.strictEqual(sceltaSpazio.rettangoliSiToccano([0, 0, 10, 10], [5, 5, 15, 15]), true);
    assert.strictEqual(sceltaSpazio.rettangoliSiToccano([0, 0, 10, 10], [10, 0, 20, 10]), false);
    assert.strictEqual(sceltaSpazio.rettangoliSiToccano([0, 0, 10, 10], [20, 20, 30, 30]), false);
    assert.strictEqual(sceltaSpazio.rettangoliSiToccano(null, [0, 0, 1, 1]), false);
});


test('I20-1240: un elemento sta dentro la base anche col centesimo di millimetro di InDesign', () => {
    assert.strictEqual(sceltaSpazio.rettangoloDentro([1, 1, 9, 9], [0, 0, 10, 10]), true);
    assert.strictEqual(sceltaSpazio.rettangoloDentro([-0.005, 0, 10.005, 10], [0, 0, 10, 10]), true);
    assert.strictEqual(sceltaSpazio.rettangoloDentro([0, -2, 10, 8], [0, 0, 10, 10]), false);
});
