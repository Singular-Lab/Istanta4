/*
 * I20-1054: il gruppo di allineamento che evita la traccia della base.
 *
 * Con evitaTracciaBase, fixCollisioneTracciaBase spostava tutto il gruppo per tenerlo dentro il
 * bordo della base, da qualunque lato lo toccasse. Nel box Edro21 dello screenshot della issue la
 * colonna di destra (Campi_DX: dal basso i prezzi, sopra LBL_Titolari e in cima la descrizione) e'
 * ancorata in basso a destra ed e' piu' alta dello spazio: la descrizione toccava la traccia in
 * alto, il gruppo scendeva, i prezzi uscivano dal fondo e fixOverflowFromBox li riportava dentro
 * uno per uno, accavallati.
 *
 * Ora il gruppo si sposta ancora tutto insieme, ma solo dai lati a cui e' ancorato: ancorato in
 * basso a destra evita solo la traccia in basso e a destra. Al centro, senza ancora statica o con
 * l'asse allineato seguendo un altro gruppo, evita tutti e due i lati, come prima.
 *
 * CssFramework.js si carica con un modulo indesign finto, come in spazioFotoRobusto.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}

//Lo spazio dentro la traccia: [top, left, bottom, right].
const INTERNO = [10, 10, 110, 90];

const TUTTI = { x: { inizio: true, fine: true }, y: { inizio: true, fine: true } };
const BASSO_DESTRA = { x: { inizio: false, fine: true }, y: { inizio: false, fine: true } };
const ALTO_SINISTRA = { x: { inizio: true, fine: false }, y: { inizio: true, fine: false } };

//La colonna dello screenshot: dal basso tre prezzi, sopra la descrizione che esce di 15 mm in alto.
const COLONNA = [[-5, 50, 40, 85], [40, 50, 70, 85], [70, 50, 90, 85], [90, 50, 110, 85]];

/* ---- lo spostamento ---- */

test("la colonna ancorata in basso a destra che tocca la traccia in alto non si muove", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase(COLONNA, INTERNO, BASSO_DESTRA), [0, 0]);
});

test("prima scendeva: con tutti i lati la stessa colonna si sposta di 15 in basso", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase(COLONNA, INTERNO, TUTTI), [0, 15]);
});

test("ancorato in basso e oltre la traccia in basso: il gruppo sale", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[60, 20, 115, 40]], INTERNO, BASSO_DESTRA), [0, -5]);
});

test("ancorato in alto: scende se tocca in alto, resta fermo se tocca in basso", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[5, 20, 40, 40]], INTERNO, ALTO_SINISTRA), [0, 5]);
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[60, 20, 115, 40]], INTERNO, ALTO_SINISTRA), [0, 0]);
});

test("sull'asse X vale lo stesso: ancorato a destra evita solo la destra", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[20, 70, 40, 95]], INTERNO, BASSO_DESTRA), [-5, 0]);
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[20, 5, 40, 30]], INTERNO, BASSO_DESTRA), [0, 0]);
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[20, 5, 40, 30]], INTERNO, ALTO_SINISTRA), [5, 0]);
});

test("un gruppo gia' dentro non si muove", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([[20, 20, 40, 40]], INTERNO, TUTTI), [0, 0]);
});

/* ---- i lati dall'ancora ---- */

function ancora(x, y, condizioni = null) {
    return {
        xAnchor: x == null ? null : { distance: "0%", allineaAlLato: x, allineaLato: x },
        yAnchor: y == null ? null : { distance: "0%", allineaAlLato: y, allineaLato: y },
        listSetCondizioni: condizioni
    };
}

const NESSUNO = { x: false, y: false };

test("Campi_DX, ancorato in basso a destra: si evitano solo basso e destra", () => {
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(1, 1)], NESSUNO), BASSO_DESTRA);
});

test("ancorato in alto a sinistra, o senza lato: solo alto e sinistra", () => {
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(0, 0)], NESSUNO), ALTO_SINISTRA);
    const senzaLato = { xAnchor: { distance: "0%" }, yAnchor: { distance: "0%" }, listSetCondizioni: null };
    assert.deepStrictEqual(CssFramework.latiTracciaBase([senzaLato], NESSUNO), ALTO_SINISTRA);
});

test("al centro, senza ancora statica o con l'asse seguito: tutti e due i lati, come prima", () => {
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(2, 2)], NESSUNO), TUTTI);
    assert.deepStrictEqual(CssFramework.latiTracciaBase(null, NESSUNO), TUTTI);
    assert.deepStrictEqual(CssFramework.latiTracciaBase([], NESSUNO), TUTTI);
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(1, 1)], { x: true, y: false }),
        { x: { inizio: true, fine: true }, y: { inizio: false, fine: true } });
});

test("un asse senza ancora statica resta con tutti e due i lati", () => {
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(null, 1)], NESSUNO),
        { x: { inizio: true, fine: true }, y: { inizio: false, fine: true } });
});

test("si usa la prima ancora con le condizioni valide, come followStaticAnchor", () => {
    const condizioni = [{ setCondizioni: [] }];
    const ancore = [ancora(0, 0, condizioni), ancora(1, 1)];

    assert.deepStrictEqual(CssFramework.latiTracciaBase(ancore, NESSUNO, () => false), BASSO_DESTRA);
    assert.deepStrictEqual(CssFramework.latiTracciaBase(ancore, NESSUNO, () => true), ALTO_SINISTRA);
    assert.deepStrictEqual(CssFramework.latiTracciaBase([ancora(1, 1, condizioni)], NESSUNO, () => false), TUTTI);
});

/* ---- l'applicazione ---- */

//Un elemento che si muove come in InDesign: move(undefined, [dx, dy]).
function elemento(bounds) {
    let misure = [...bounds];
    return {
        isValid: true,
        get geometricBounds() { return [...misure]; },
        move(_, [dx, dy]) { misure = [misure[0] + dy, misure[1] + dx, misure[2] + dy, misure[3] + dx]; }
    };
}

function conBaseFinta(prova) {
    //La base: da 0 a 120 in verticale, da 0 a 100 in orizzontale, traccia di 2 pt al centro.
    const base = { isValid: true, strokeWeight: 2, strokeAlignment: "CENTER_ALIGNMENT", geometricBounds: [0, 0, 120, 100] };
    const precedente = global.Utility;
    global.Utility = { getFieldByLabel: () => base };
    try {
        prova(1 * 0.352777778);
    }
    finally {
        global.Utility = precedente;
    }
}

test("fixCollisioneTracciaBase con la colonna dello screenshot: nessun elemento si muove", () => {
    conBaseFinta((inset) => {
        const colonna = [elemento([-5, 50, 40, 85]), elemento([40, 50, 80, 85]), elemento([80, 50, 120 - inset, 85])];
        const gruppo = [{ elementi: colonna.map(item => ({ item })) }];

        CssFramework.fixCollisioneTracciaBase({}, gruppo, { useTextBounds: false, distance: 0 }, BASSO_DESTRA);

        assert.deepStrictEqual(colonna.map(el => el.geometricBounds),
            [[-5, 50, 40, 85], [40, 50, 80, 85], [80, 50, 120 - inset, 85]]);
    });
});

test("fixCollisioneTracciaBase senza lati si comporta come prima e sposta tutto il gruppo", () => {
    conBaseFinta((inset) => {
        const a = elemento([-5, 50, 40, 85]);
        const b = elemento([40, 50, 80, 85]);

        CssFramework.fixCollisioneTracciaBase({}, [{ elementi: [{ item: a }, { item: b }] }], { useTextBounds: false, distance: 0 });

        assert.ok(Math.abs(a.geometricBounds[0] - inset) < 1e-9);
        assert.ok(Math.abs(b.geometricBounds[0] - (45 + inset)) < 1e-9);
    });
});

test("allineamenti legge i lati prima di applicare l'ancora statica e li passa all'evita traccia", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("\n    allineamenti(box, boundsBoxImpaginato");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    FollowAnchorGruppo(", inizio));

    const lati = corpo.indexOf("let latiTracciaBase = this.latiTracciaBase(allineamentoSingolo.staticAnchor, allineamentiRiusciti,");
    const statica = corpo.indexOf("allineamentiRiusciti = this.followStaticAnchor(");
    assert.ok(lati > 0 && statica > lati, "i lati si leggono prima dell'ancora statica");
    assert.match(corpo, /this\.fixCollisioneTracciaBase\(box, listGruppoAllineamento, allineamentoSingolo\.evitaTracciaAllineamento, latiTracciaBase\);/);
});
