/*
 * I20-1180: nel BOX4 sottocosto di Edro21 il tag "N° PEZZI DISPONIBILI" (quantitativi) copriva la
 * prima riga della descrizione. Il contorna testo di InDesign dentro il box non agisce (provato in
 * InDesign), quindi il Plugin restringe il riquadro del testo dal lato dell'elemento: regola
 * evitaElementiTesto del CssFramework.
 *
 * Si prova il modulo puro (plugin/cssFramework/evitaElementiTesto.js) e poi
 * CssFramework.applicaEvitaElementiTesto su box finti, con un testo che va a capo da solo quando il
 * riquadro si stringe e va in overflow quando le righe non ci stanno. In fondo, sul sorgente, dove
 * gira nell'impaginazione del box.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const cssEvitaElementiTesto = require("../../plugin/cssFramework/evitaElementiTesto");

/* ---- il modulo puro ---- */

test("una regola senza testi o senza elementi non serve, il margine manca o vale zero", () => {
    assert.strictEqual(cssEvitaElementiTesto.normalizzaRegola({ testi: [], elementi: ["quantitativi"] }), null);
    assert.strictEqual(cssEvitaElementiTesto.normalizzaRegola({ testi: ["descrizione"] }), null);
    assert.strictEqual(cssEvitaElementiTesto.normalizzaRegola(null), null);
    assert.deepStrictEqual(cssEvitaElementiTesto.normalizzaRegola({ testi: ["descrizione"], elementi: [" quantitativi ", ""] }),
        { testi: ["descrizione"], elementi: ["quantitativi"], margine: 0 });
    assert.strictEqual(cssEvitaElementiTesto.normalizzaRegola({ testi: ["d"], elementi: ["q"], margine: "1.5" }).margine, 1.5);
    assert.strictEqual(cssEvitaElementiTesto.normalizzaRegola({ testi: ["d"], elementi: ["q"], margine: -2 }).margine, 0);
});

test("le regole del box si sommano dalle sue voci, una volta sola", () => {
    const regola = { testi: ["descrizione"], elementi: ["quantitativi"], margine: 1 };
    const regole = cssEvitaElementiTesto.regoleDelBox([
        { nomiBox: ["BOX4"], evitaElementiTesto: [{ testi: ["prezzo"], elementi: ["logo"] }] },
        { nomiBox: [], evitaElementiTesto: [regola] },
        //Il kit di default puo' essere lo stesso della lavorazione: la regola non si raddoppia.
        { nomiBox: [], evitaElementiTesto: [regola] },
        null,
        { nomiBox: [] }
    ]);

    assert.deepStrictEqual(regole, [
        { testi: ["prezzo"], elementi: ["logo"], margine: 0 },
        { testi: ["descrizione"], elementi: ["quantitativi"], margine: 1 }
    ]);
});

test("il riquadro si restringe dal lato dell'elemento", () => {
    //Elemento a sinistra: si sposta il bordo sinistro.
    assert.deepStrictEqual(cssEvitaElementiTesto.riquadroRistretto([20, 10, 30, 60], [9, -1, 23, 26]), [20, 26, 30, 60]);
    //Elemento a destra: si sposta il bordo destro.
    assert.deepStrictEqual(cssEvitaElementiTesto.riquadroRistretto([20, 10, 30, 60], [9, 50, 23, 70]), [20, 10, 30, 50]);
    //Se resta meno della larghezza minima non c'e' riquadro.
    assert.strictEqual(cssEvitaElementiTesto.riquadroRistretto([20, 10, 30, 60], [9, -1, 23, 57]), null);
});

test("le altezze da provare salgono di un passo fino al bordo alto del box", () => {
    assert.deepStrictEqual(cssEvitaElementiTesto.altezzeDiProva(20, 16.5), [19, 18, 17, 16.5]);
    assert.deepStrictEqual(cssEvitaElementiTesto.altezzeDiProva(20, 20), []);
    assert.deepStrictEqual(cssEvitaElementiTesto.altezzeDiProva(20, 25), []);
});

/* ---- sul documento, con box finti ---- */

function caricaCssFramework() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        return richiesta === "indesign" ? {} : originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/CssFramework.js");
    }
    finally {
        Module._load = originale;
    }
}

const CssFramework = caricaCssFramework();

let messaggi = [];
global.Utility = { parseLabel: label => String(label == null ? "" : label), eUnClone: () => false };
global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });

let prossimoId = 1;

function elemento(label, bounds, altro = {}) {
    return Object.assign({ id: prossimoId++, label, constructorName: "Rectangle", isValid: true, visible: true, parent: null, geometricBounds: bounds }, altro);
}

//Un testo allineato a destra lungo "lunghezza" mm su una riga sola, alto "riga" mm per riga: le
//righe le compone il riquadro di adesso, e va in overflow se non ci stanno in altezza.
function testo(label, bounds, lunghezza, riga = 5) {
    let misure = bounds.slice();
    const t = elemento(label, bounds, { constructorName: "TextFrame" });
    Object.defineProperty(t, "geometricBounds", { get: () => misure.slice(), set: v => { misure = v.slice(); } });
    const quanteRighe = () => Math.ceil(lunghezza / (misure[3] - misure[1]));
    Object.defineProperty(t, "overflows", { get: () => quanteRighe() * riga > misure[2] - misure[0] + 1e-9 });
    t.lines = {
        everyItem: () => ({
            getElements: () => {
                const righe = [];
                const larghezza = misure[3] - misure[1];
                let resto = lunghezza;
                for (let i = 0; i < quanteRighe(); i++) {
                    const questa = Math.min(resto, larghezza);
                    resto -= questa;
                    //Ascent fino alla cima della riga, descent di 1 mm: la riga occupa la sua fascia.
                    righe.push({ baseline: misure[0] + (i + 1) * riga - 1, ascent: riga - 1, descent: 1, horizontalOffset: misure[3] - questa, endHorizontalOffset: misure[3] });
                }
                return righe;
            }
        })
    };
    return t;
}

const REGOLA = { testi: ["descrizione"], elementi: ["quantitativi"], margine: 1 };

function boxConContesto(elementi, altoBox = 0) {
    const box = { label: "BOX4", isValid: true, id: 1, geometricBounds: [altoBox, 0, 40, 100], allPageItems: elementi };
    CssFramework.contestoCss = { etichettaBox: "BOX4", DBallineamenti: [{ nomiBox: [], evitaElementiTesto: [REGOLA] }], DBDefault: null };
    return box;
}

test.beforeEach(() => {
    messaggi = [];
});

test("la descrizione che tocca il tag si stringe a destra di lui e, se serve, sale", () => {
    //Due righe: la prima, lunga quanto il riquadro, passa sotto il tag.
    const descrizione = testo("descrizione", [20, 10, 30, 60], 80);
    const box = boxConContesto([elemento("quantitativi", [10, 0, 22, 25]), descrizione]);

    CssFramework.applicaEvitaElementiTesto(box);

    //Bordo sinistro oltre il tag col margine (25 + 1); larga 34 il testo prende tre righe, 15 mm:
    //il bordo alto sale da 20 a 15.
    assert.deepStrictEqual(descrizione.geometricBounds, [15, 26, 30, 60]);
    assert.strictEqual(descrizione.overflows, false);
    assert.strictEqual(messaggi.length, 0);
});

test("se ristretta ci sta gia', la descrizione non sale", () => {
    const descrizione = testo("descrizione", [15, 10, 30, 60], 80);
    const box = boxConContesto([elemento("quantitativi", [10, 0, 17, 25]), descrizione]);

    CssFramework.applicaEvitaElementiTesto(box);

    assert.deepStrictEqual(descrizione.geometricBounds, [15, 26, 30, 60]);
});

test("una descrizione che non tocca il tag resta com'era", () => {
    const descrizione = testo("descrizione", [20, 40, 30, 90], 40);
    const box = boxConContesto([elemento("quantitativi", [10, 0, 22, 25]), descrizione]);

    CssFramework.applicaEvitaElementiTesto(box);

    assert.deepStrictEqual(descrizione.geometricBounds, [20, 40, 30, 90]);
});

test("se ristretta non ci sta nemmeno salendo fino al bordo del box, torna com'era e il registro lo dice", () => {
    const descrizione = testo("descrizione", [20, 10, 30, 60], 80);
    //Il box comincia a 18: si sale al massimo di 2 mm, e servirebbero 5.
    const box = boxConContesto([elemento("quantitativi", [18, 0, 22, 25]), descrizione], 18);

    CssFramework.applicaEvitaElementiTesto(box);

    assert.deepStrictEqual(descrizione.geometricBounds, [20, 10, 30, 60]);
    assert.strictEqual(messaggi.length, 1);
    assert.match(messaggi[0].testo, /^Code CSF-29: Nel box BOX4 descrizione non si e' potuto staccare da quantitativi: il testo ristretto non ci sta nel box\. Misure in mm/);
    assert.strictEqual(messaggi[0].stile, "warning");
});

test("un tag nascosto non conta", () => {
    const descrizione = testo("descrizione", [20, 10, 30, 60], 80);
    const box = boxConContesto([elemento("quantitativi", [10, 0, 22, 25], { visible: false }), descrizione]);

    CssFramework.applicaEvitaElementiTesto(box);

    assert.deepStrictEqual(descrizione.geometricBounds, [20, 10, 30, 60]);
});

test("senza la regola nel contesto del box non si tocca niente", () => {
    const descrizione = testo("descrizione", [20, 10, 30, 60], 80);
    const box = boxConContesto([elemento("quantitativi", [10, 0, 22, 25]), descrizione]);
    //Il contesto e' dell'ultimo box a cui si e' applicato il CSS: qui un altro.
    CssFramework.contestoCss.etichettaBox = "BOX1";

    CssFramework.applicaEvitaElementiTesto(box);

    assert.deepStrictEqual(descrizione.geometricBounds, [20, 10, 30, 60]);
});

/* ---- dove gira ---- */

test("nell'impaginazione del box si stacca dopo il noRender e prima del controllo dei conflitti", () => {
    const index = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "indexNew.js"), "utf8").replace(/\r/g, "");
    const inizio = index.indexOf("async function callAllOperationFixBox(");
    const funzione = index.substring(inizio, index.indexOf("\n}\n", inizio));

    const noRender = funzione.indexOf("applicaNoRenderAgliElementiDelBox(boxImpaginato, itemRef.noRenderElementi);");
    const stacca = funzione.indexOf("boxImpaginato = CssFramework.applicaEvitaElementiTesto(boxImpaginato);");
    const conflitti = funzione.indexOf("CssFramework.controllaSegnalazioniConflittiPendenti(boxImpaginato);");
    assert.ok(noRender > 0 && stacca > noRender && conflitti > stacca, "ordine: noRender, evitaElementiTesto, conflitti");
});
