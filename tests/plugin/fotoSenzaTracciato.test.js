/*
 * Foto senza tracciato di ritaglio nella sistemazione delle foto.
 *
 * Il fix foto misura una foto dal suo tracciato di ritaglio. Con la rilevazione dei bordi spenta
 * nella policy del cliente (Coop: clippingPath false) il tracciato e' solo quello salvato nel file,
 * e un JPG che non ne ha risultava 0x0: il rapporto d'aspetto diventava NaN, le misure del gruppo
 * [NaN, NaN, NaN, NaN], e il fix foto usciva con "Nessun candidato trovato per le foto" lasciando le
 * foto sovrapposte (PoP Coop, gruppo 7793827,7793828,7793838,7793839,8150068: due foto su tre senza
 * tracciato). Ora si ripiega sull'immagine visibile nel riquadro, poi sul riquadro; il box riceve
 * CSF-26 con le foto senza tracciato, e una misura che resta non numerica da' CSF-27.
 *
 * sistemazioneFoto.js fa require('indesign'): qui il modulo e' uno stub, e box e foto sono finti,
 * come in spazioFotoRobusto.test.js.
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
try {
    CssFramework = require("../../plugin/CssFramework.js");
    SistemazioneFoto = require("../../plugin/sistemazioneFoto/sistemazioneFoto.js");
}
finally {
    Module._load = caricaOriginale;
}

/* ---- l'ambiente finto ---- */

let messaggi = [];
let segnalazioni = [];

global.customAgenzia = {};
global.Utility = {
    parseLabel: (label) => (label == null ? "" : String(label)),
    getDnaOfBox: () => ({ codice_gruppo: "7793827,7793828,7793838" })
};
global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
global.addSegnalazione = (testo, stile) => segnalazioni.push({ testo, stile });
global.pluginMiddleware = { getCampo: () => null };
CssFramework.controllaSegnalazioniConflittiPendenti = function () { };

test.beforeEach(() => {
    messaggi = [];
    segnalazioni = [];
});

let prossimoId = 1;

function elemento(label, bounds, altro = {}) {
    let misure = [...bounds];
    const el = {
        id: prossimoId++,
        label,
        constructorName: "Rectangle",
        isValid: true,
        visible: true,
        get geometricBounds() { return [...misure]; },
        set geometricBounds(valore) { misure = [...valore]; }
    };
    return Object.assign(el, altro);
}

function vuota() {
    return { length: 0, item: () => null };
}

//Una foto col riquadro e l'immagine posata. Con tracciato, il tracciato e' il rettangolo
//dell'immagine; senza, InDesign non da' nessun tracciato.
function foto(label, riquadro, immagine, conTracciato) {
    const percorso = [[immagine[1], immagine[0]], [immagine[3], immagine[0]], [immagine[3], immagine[2]], [immagine[1], immagine[2]]];
    const grafica = {
        horizontalScale: 100,
        geometricBounds: immagine,
        clippingPath: {
            paths: conTracciato
                ? { length: 1, item: () => ({ entirePath: percorso }) }
                : { length: 0, item: () => null }
        }
    };
    return elemento(label, riquadro, {
        fitFatti: 0,
        fit() { this.fitFatti++; },
        images: { length: 1, item: () => grafica },
        epss: vuota(),
        pdfs: vuota(),
        graphics: vuota()
    });
}

//Il box: la base, una fascia alta occupata (il prezzo, a tutta larghezza) e le foto. Senza ostacoli
//il calcolo dello spazio libero non produce candidati, e nei box veri un ostacolo c'e' sempre.
function box(elementi, foto) {
    return {
        label: "BOX_ESCLUSIVA_SOCI",
        allPageItems: [elemento("box_prezzo", [0, 0, 20, 100])].concat(elementi),
        geometricBounds: [0, 0, 80, 100],
        rectangles: { length: foto.length, item: (k) => foto[k] }
    };
}

/* ---- la misura di una foto ---- */

test("con il tracciato la foto si misura sul tracciato, come prima", () => {
    const misura = SistemazioneFoto.ingombroDellaFoto([{ vertx: [10, 40, 25], verty: [5, 20, 30] }], [0, 0, 50, 50], [0, 0, 50, 50], [0, 0]);

    assert.deepStrictEqual(misura, { bounds: [5, 10, 30, 40], origine: "tracciato" });
});

test("senza tracciato si usa l'immagine visibile nel riquadro: la primaria del caso Coop", () => {
    const misura = SistemazioneFoto.ingombroDellaFoto([{ vertx: [], verty: [] }], [43.8, -305, 197.3, -151.5], [13, -305, 228, -151.5], [0, 0]);

    assert.deepStrictEqual(misura, { bounds: [43.8, -305, 197.3, -151.5], origine: "immagine" });
});

test("un'immagine piu' grande del riquadro conta solo per la parte che si vede", () => {
    const misura = SistemazioneFoto.ingombroDellaFoto([], [-10, -10, 90, 60], [0, 0, 50, 40], [0, 0]);

    assert.deepStrictEqual(misura, { bounds: [0, 0, 50, 40], origine: "immagine" });
});

test("senza immagine, o con un'immagine fuori dal riquadro, si usa il riquadro", () => {
    assert.deepStrictEqual(SistemazioneFoto.ingombroDellaFoto([], null, [0, 0, 50, 40], [0, 0]), { bounds: [0, 0, 50, 40], origine: "riquadro" });
    assert.deepStrictEqual(SistemazioneFoto.ingombroDellaFoto([], [100, 100, 120, 130], [0, 0, 50, 40], [0, 0]), { bounds: [0, 0, 50, 40], origine: "riquadro" });
});

test("il padding della foto vale anche nel ripiego", () => {
    assert.deepStrictEqual(SistemazioneFoto.ingombroDellaFoto([], [10, 10, 30, 40], [0, 0, 50, 50], [2, 3]).bounds, [8, 7, 32, 43]);
});

test("se nemmeno il riquadro e' una misura, la misura e' NaN e lo si sa", () => {
    const misura = SistemazioneFoto.ingombroDellaFoto([], null, null, [0, 0]);

    assert.strictEqual(misura.origine, "nessuna");
    assert.ok(misura.bounds.every(n => Number.isNaN(n)));
});

test("getRealBoundsOfFoto su una foto senza tracciato da' l'immagine nel riquadro, non 0x0", () => {
    const f = foto("immagine$7793827", [13, -305, 228, -151.5], [43.8, -305, 197.3, -151.5], false);
    const esito = {};

    assert.deepStrictEqual(SistemazioneFoto.getRealBoundsOfFoto(f, [0, 0], esito), [43.8, -305, 197.3, -151.5]);
    assert.strictEqual(esito.origine, "immagine");
});

/* ---- il fix foto, fino in fondo ---- */

//I20-1137: dal 26/10/2026 (ee718fe) la CSF-26 non e' piu' una segnalazione del box, per scelta: resta
//solo l'avviso nella console del Plugin, con le foto senza tracciato.
test("tre foto, due senza tracciato: vengono disposte e la console dice quali non hanno tracciato", () => {
    //Le tre foto posate una sull'altra, sfalsate di 5, come le lascia l'impaginazione.
    const primaria = foto("immagine$7793827", [10, 10, 40, 40], [12, 10, 38, 40], false);
    const seconda = foto("foto_secondaria$7793838", [15, 15, 45, 45], [17, 15, 43, 45], true);
    const terza = foto("foto_secondaria$7793828", [20, 20, 50, 50], [22, 20, 48, 50], false);
    const scatola = box([elemento("base", [0, 0, 80, 100]), primaria, seconda, terza], [primaria, seconda, terza]);

    const avvisi = [];
    const warnOriginale = console.warn;
    console.warn = (...parti) => avvisi.push(parti.map(String).join(" "));
    let area;
    try {
        const spazio = SistemazioneFoto.getSpazioImpaginazione(scatola);
        area = SistemazioneFoto.fixFoto(scatola, spazio.candidate, spazio.obstacles);
    }
    finally {
        console.warn = warnOriginale;
    }

    assert.ok(area > 0, "il fix foto ha disposto il gruppo");
    for (const f of [primaria, seconda, terza]) {
        assert.ok(f.geometricBounds.every(n => Number.isFinite(n)), f.label + ": " + f.geometricBounds);
        assert.strictEqual(f.fitFatti, 1, f.label + " adattata al nuovo riquadro");
    }
    //Non restano sovrapposte come prima: gli angoli in alto a sinistra sono tutti diversi.
    const angoli = new Set([primaria, seconda, terza].map(f => f.geometricBounds.slice(0, 2).map(n => n.toFixed(2)).join(";")));
    assert.strictEqual(angoli.size, 3);

    //Nessuna segnalazione nel box per le foto senza tracciato.
    assert.deepStrictEqual(segnalazioni.filter(s => s.testo.includes("CSF-26")), []);
    //L'avviso in console, una volta, con le due foto senza tracciato e non quella che ce l'ha.
    const csf26 = avvisi.filter(a => a.startsWith("Code CSF-26"));
    assert.strictEqual(csf26.length, 1);
    assert.match(csf26[0], /immagine\$7793827/);
    assert.match(csf26[0], /foto_secondaria\$7793828/);
    assert.doesNotMatch(csf26[0], /7793838/);
    assert.deepStrictEqual(messaggi.filter(m => m.testo.includes("CSF-27")), []);
});

test("con tutte le foto col tracciato non c'e' nessuna segnalazione in piu'", () => {
    const primaria = foto("immagine$1", [10, 10, 40, 40], [12, 10, 38, 40], true);
    const seconda = foto("foto_secondaria$2", [15, 15, 45, 45], [17, 15, 43, 45], true);
    const scatola = box([elemento("base", [0, 0, 80, 100]), primaria, seconda], [primaria, seconda]);

    const spazio = SistemazioneFoto.getSpazioImpaginazione(scatola);
    SistemazioneFoto.fixFoto(scatola, spazio.candidate, spazio.obstacles);

    assert.deepStrictEqual(segnalazioni.filter(s => s.testo.includes("CSF-26")), []);
});

test("una misura che non e' un numero: le foto restano dove sono e arriva CSF-27", () => {
    const primaria = foto("immagine$1", [10, 10, 40, 40], [12, 10, 38, 40], true);
    const seconda = foto("foto_secondaria$2", [15, 15, 45, 45], [17, 15, 43, 45], true);
    const scatola = box([elemento("base", [0, 0, 80, 100]), primaria, seconda], [primaria, seconda]);

    const spazio = SistemazioneFoto.getSpazioImpaginazione(scatola);
    const vera = SistemazioneFoto.getRealBoundsOfFoto;
    SistemazioneFoto.getRealBoundsOfFoto = (img) => (img === seconda ? [NaN, NaN, NaN, NaN] : img.geometricBounds);
    try {
        SistemazioneFoto.fixFoto(scatola, spazio.candidate, spazio.obstacles);
    }
    finally {
        SistemazioneFoto.getRealBoundsOfFoto = vera;
    }

    assert.deepStrictEqual(primaria.geometricBounds, [10, 10, 40, 40]);
    assert.deepStrictEqual(seconda.geometricBounds, [15, 15, 45, 45]);
    assert.strictEqual(primaria.fitFatti + seconda.fitFatti, 0);
    assert.strictEqual(messaggi.filter(m => m.testo.startsWith("Code CSF-27")).length, 1);
    assert.strictEqual(segnalazioni.filter(s => s.testo.startsWith("Code CSF-27")).length, 1);
});
