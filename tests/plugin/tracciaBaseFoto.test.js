/*
 * I20-1058: il fix foto lascia libera la traccia della base.
 *
 * Lo spazio per le foto si cercava sui bordi geometrici della base, che stanno sul tracciato: con
 * una traccia al centro meta' dello spessore cadeva nello spazio libero, e nei box Edro21, dove il
 * paddingBox e' azzerato, il fondo della foto finiva sul bordo verde.
 *
 * Ora CssFramework.insetTracciaBase dice quanto la traccia entra nella base - lo stesso calcolo
 * dell'evita traccia dei gruppi di allineamento - e calcolaSpazioLibero cerca lo spazio dentro
 * quel bordo. Il paddingBox del cliente vale dal bordo interno; senza traccia non cambia niente.
 *
 * sistemazioneFoto.js e CssFramework.js si caricano con un modulo indesign finto, come in
 * spazioFotoRobusto.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame" } };
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
let SistemazioneFoto;
let spazioLibero;
try {
    CssFramework = require("../../plugin/CssFramework.js");
    SistemazioneFoto = require("../../plugin/sistemazioneFoto/sistemazioneFoto.js");
    spazioLibero = require("../../plugin/sistemazioneFoto/spazioLibero.js");
}
finally {
    Module._load = caricaOriginale;
}

global.Utility = { parseLabel: (label) => (label == null ? "" : String(label)), getDnaOfBox: () => ({ codice_gruppo: "4058817" }) };
global.messaggioUtente = () => {};
global.addSegnalazione = () => {};
global.customAgenzia = {};

const MM_PER_PT = 0.352777778;
const EPS = 0.000001;

//La base: 100 x 80 mm, con la traccia indicata in mm e il suo allineamento.
function base(tracciaMm, allineamento = "INSIDE_ALIGNMENT") {
    return {
        isValid: true,
        geometricBounds: [0, 0, 80, 100],
        strokeWeight: tracciaMm / MM_PER_PT,
        strokeAlignment: { toString: () => allineamento }
    };
}

const BOX = { label: "BOX1" };
const OSTACOLO = { x: 40, y: 30, width: 20, height: 20, label: "prezzo" };

function spazio(laBase, paddingBox) {
    global.customAgenzia = { paddingBox };
    try {
        return SistemazioneFoto.calcolaSpazioLibero(BOX, laBase, [Object.assign({}, OSTACOLO)]);
    }
    finally {
        global.customAgenzia = {};
    }
}

function geometria(rettangoli) {
    return rettangoli.map(r => [r.x, r.y, r.width, r.height].map(v => v.toFixed(4)).join("|")).sort();
}

function tuttiDentro(rettangoli, margine) {
    return rettangoli.every(r => r.x >= margine - EPS && r.y >= margine - EPS &&
        r.x + r.width <= 100 - margine + EPS && r.y + r.height <= 80 - margine + EPS);
}

/* ---- quanto entra la traccia ---- */

test("una traccia di 2 pt entra di meta' al centro, di tutta all'interno, per niente all'esterno", () => {
    const due = (allineamento) => CssFramework.insetTracciaBase({ isValid: true, strokeWeight: 2, strokeAlignment: allineamento });
    assert.ok(Math.abs(due("CENTER_ALIGNMENT") - MM_PER_PT) < EPS);
    assert.ok(Math.abs(due("INSIDE_ALIGNMENT") - 2 * MM_PER_PT) < EPS);
    assert.strictEqual(due("OUTSIDE_ALIGNMENT"), 0);
});

test("se l'allineamento non si legge vale meta' dello spessore", () => {
    const illeggibile = { isValid: true, strokeWeight: 2, get strokeAlignment() { throw new Error("no"); } };
    assert.ok(Math.abs(CssFramework.insetTracciaBase(illeggibile) - MM_PER_PT) < EPS);
});

test("senza traccia o senza base valida vale zero", () => {
    assert.strictEqual(CssFramework.insetTracciaBase(null), 0);
    assert.strictEqual(CssFramework.insetTracciaBase({ isValid: false, strokeWeight: 2, strokeAlignment: "CENTER_ALIGNMENT" }), 0);
    assert.strictEqual(CssFramework.insetTracciaBase({ isValid: true, strokeWeight: 0, strokeAlignment: "CENTER_ALIGNMENT" }), 0);
    assert.strictEqual(CssFramework.insetTracciaBase({ isValid: true, strokeAlignment: "CENTER_ALIGNMENT" }), 0);
});

/* ---- lo spazio per le foto ---- */

test("con una traccia interna di 10 mm nessuno spazio entra nella traccia, e si parte dal suo bordo", () => {
    const { candidate } = spazio(base(10), [0, 0, 0, 0]);

    assert.ok(candidate.length > 0);
    assert.ok(tuttiDentro(candidate, 10), "uno spazio entra nella traccia: " + geometria(candidate));
    //A sinistra del prezzo: dal bordo interno della traccia fino al prezzo, alto quanto l'interno.
    assert.ok(geometria(candidate).includes("10.0000|10.0000|30.0000|60.0000"), geometria(candidate).join("; "));
});

test("il paddingBox del cliente si aggiunge dal bordo interno della traccia", () => {
    const { candidate } = spazio(base(10), [-2, -2, -2, -2]);

    assert.ok(tuttiDentro(candidate, 12), "uno spazio entra nel margine: " + geometria(candidate));
    assert.ok(geometria(candidate).includes("12.0000|12.0000|26.0000|56.0000"), geometria(candidate).join("; "));
});

test("con la traccia al centro lo spazio si ritira di meta' spessore", () => {
    const { candidate } = spazio(base(4, "CENTER_ALIGNMENT"), [0, 0, 0, 0]);

    assert.ok(tuttiDentro(candidate, 2), geometria(candidate).join("; "));
    assert.ok(geometria(candidate).includes("2.0000|2.0000|38.0000|76.0000"), geometria(candidate).join("; "));
});

test("una base senza traccia da' gli spazi di sempre", () => {
    const senza = { isValid: true, geometricBounds: [0, 0, 80, 100], strokeWeight: 0 };
    const { candidate } = spazio(senza, [0, 0, 0, 0]);

    const ostacoli = [Object.assign({}, OSTACOLO)];
    const diSempre = spazioLibero.refineRects(ostacoli, spazioLibero.generateCandidateRects(100, 80, ostacoli, 0, [0, 0, 0, 0]), 100, 80, 0);
    assert.deepStrictEqual(geometria(candidate), geometria(diSempre));
});

test("gli ostacoli restituiti sono quelli ricevuti, alle loro misure", () => {
    const ricevuti = [Object.assign({}, OSTACOLO)];
    const risultato = SistemazioneFoto.calcolaSpazioLibero(BOX, base(10), ricevuti);

    assert.strictEqual(risultato.obstacles, ricevuti);
    assert.deepStrictEqual(ricevuti[0], OSTACOLO);
});
