/*
 * Crescita orizzontale agganciata dei campi in overflow.
 *
 * TestoTag allarga il riquadro al box, scrive il testo, lo adatta al contenuto e rimette le misure
 * originali nelle direzioni in cui il campo non puo' crescere. In verticale c'era un aggancio (alto,
 * basso, centro), in orizzontale no: un prezzo piu' largo del riquadro restava dove l'aveva lasciato
 * l'adattamento, non dal bordo del modello. Ora la direzione w di campiSoggettiAOverflow aggancia:
 * "right" tiene il bordo sinistro e cresce verso destra, "left" il contrario. Una voce con
 * tipiLavorazione vale solo in quelle lavorazioni (1 volantino, 2 PoP): per Coop, prezzo_promo cresce
 * verso destra nel solo PoP.
 *
 * TestoTag si carica sotto Node; di pluginMiddleware si prendono i membri dal sorgente, come in
 * noRenderContenitori.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const TestoTag = require(path.join(__dirname, "..", "..", "plugin", "testoTag.js"));

/* ---- l'aggancio ---- */

test("con 'right' il bordo sinistro resta quello del modello e il campo cresce verso destra", () => {
    //Modello [alto, sinistra, basso, destra]; dopo l'adattamento il prezzo e' largo 60 e sta altrove.
    assert.deepStrictEqual(TestoTag.boundsOrizzontaliDopoOverflow([10, 20, 30, 60], [10, 5, 30, 65], "right"), [20, 80]);
});

test("con 'left' resta fermo il bordo destro e il campo cresce verso sinistra", () => {
    assert.deepStrictEqual(TestoTag.boundsOrizzontaliDopoOverflow([10, 20, 30, 60], [10, 5, 30, 65], "left"), [0, 60]);
});

test("senza aggancio non cambia niente", () => {
    assert.strictEqual(TestoTag.boundsOrizzontaliDopoOverflow([10, 20, 30, 60], [10, 5, 30, 65], ""), null);
    assert.strictEqual(TestoTag.boundsOrizzontaliDopoOverflow([10, 20, 30, 60], [10, 5, 30, 65], undefined), null);
});

test("TestoTag aggancia solo quando il campo e' cresciuto, e porta l'aggancio dalla configurazione", () => {
    const testo = leggiFileDelPlugin("testoTag.js").replace(/\r/g, "");
    const inizio = testo.indexOf("applicaTagStringToInndTextFrame: function");
    const corpo = testo.substring(inizio, testo.indexOf("getDefaultOverflowDirection(tf){", inizio));

    assert.match(corpo, /overflowDirection\.ancoraOrizzontale = overflowDirectionCustom\.ancoraOrizzontale \|\| "";/);
    const ripristino = corpo.indexOf("if (larghezzaOriginale > larghezzaNuova) {");
    const aggancio = corpo.indexOf("this.boundsOrizzontaliDopoOverflow(tfBounds, tf.geometricBounds, overflowDirection.ancoraOrizzontale)");
    assert.ok(ripristino > 0 && aggancio > ripristino, "l'aggancio sta nel ramo del campo cresciuto");
    //Prima del controllo che riporta il campo dentro il box.
    assert.ok(aggancio < corpo.indexOf("if (tf.visibleBounds[3] > boxBounds[3] + 0.05) {"));
});

/* ---- la configurazione, con il tipo di lavorazione ---- */

//I membri di pluginMiddleware che servono, presi dal sorgente vero.
function membro(testo, firma) {
    const inizio = testo.indexOf("    " + firma);
    assert.notStrictEqual(inizio, -1, firma + " non trovata");
    let livello = 0;
    for (let i = testo.indexOf("{", inizio); i < testo.length; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}") { livello--; if (livello === 0) { return testo.substring(inizio, i + 1); } }
    }
    throw new Error(firma + " senza fine");
}

function middleware(campiSoggettiAOverflow, tipoLavorazione) {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "pluginMiddleware.js"), "utf8").replace(/\r/g, "");
    const membri = ["getOverflowDirection(tf) {", "voceDiOverflowValida(voce, tipoLavorazione) {", "tipoLavorazioneCorrente() {", "getDefaultOverflowDirection() {"]
        .map(f => membro(testo, f)).join(",\n");
    const ficoProcess = tipoLavorazione === undefined ? undefined : { getTipoLavorazioneCorrente: () => tipoLavorazione };
    const Utility = { parseLabel: (label) => String(label).split("$")[0] };
    const oggetto = new Function("ficoProcess", "Utility", "return ({\n" + membri + "\n});")(ficoProcess, Utility);
    return Object.assign(oggetto, { callCustom: false, customPluginDB: { defaultDirectionOverflow: 2, campiSoggettiAOverflow } });
}

const COOP = [
    { label: "descrizione", h: "top", w: "", amountH: 2.15, amountW: 1.0 },
    { label: "prezzo_promo", h: "", w: "right", amountH: 0, amountW: 0, tipiLavorazione: [2] }
];

test("nel PoP prezzo_promo cresce in orizzontale, agganciato a destra", () => {
    assert.deepStrictEqual(middleware(COOP, 2).getOverflowDirection({ label: "prezzo_promo$123" }), { vertical: false, horizontal: true, ancoraOrizzontale: "right" });
});

test("nel volantino la voce limitata al PoP non vale: il prezzo fa come prima", () => {
    assert.deepStrictEqual(middleware(COOP, 1).getOverflowDirection({ label: "prezzo_promo" }), { vertical: false, horizontal: true });
});

test("con il tipo di lavorazione sconosciuto vale solo una voce senza tipi", () => {
    assert.deepStrictEqual(middleware(COOP, undefined).getOverflowDirection({ label: "prezzo_promo" }), { vertical: false, horizontal: true });
    assert.deepStrictEqual(middleware(COOP, undefined).getOverflowDirection({ label: "descrizione" }), { vertical: true, horizontal: false, ancoraOrizzontale: "" });
});

test("una voce senza tipi vale in ogni lavorazione", () => {
    for (const tipo of [1, 2]) {
        assert.deepStrictEqual(middleware(COOP, tipo).getOverflowDirection({ label: "descrizione" }), { vertical: true, horizontal: false, ancoraOrizzontale: "" });
    }
});

test("la configurazione di Coop porta la voce del prezzo per il solo PoP", () => {
    const coop = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Coopfi", "SourceCustomPlugin.json"), "utf8"));
    const prezzo = coop.campiSoggettiAOverflow.find(v => v.label === "prezzo_promo");

    assert.ok(prezzo, "manca la voce di prezzo_promo");
    assert.strictEqual(prezzo.w, "right");
    assert.deepStrictEqual(prezzo.tipiLavorazione, [2]);
});
