/*
 * I20-1282: il suggerimento che resta acceso dopo che il suo elemento e' sparito.
 *
 * Nella finestra delle differenze l'operatore clicca "Scegli quella del server": la riga risolta
 * lascia il posto a "Tutte le segnalazioni risolte" e il pulsante sparisce sotto il mouse fermo.
 * Un elemento tolto dal pannello non manda mouseleave, e il suggerimento "Il campo nel box
 * riprende il testo del server, con i suoi stili" restava acceso fino a ricaricare il Plugin.
 *
 * Ora, finche' un suggerimento e' acceso, Tooltip guarda il suo elemento: se non c'e' piu', o
 * non si vede, lo nasconde; nascondiTooltip ferma il controllo.
 *
 * tooltip.js si carica sotto Node; document e' finto, i timer sono quelli finti di node:test.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const Tooltip = require("../../plugin/tooltip/tooltip.js");

/* ---- l'ambiente finto ---- */

const nelPannello = new Set();

global.document = {
    body: { contains: (elemento) => nelPannello.has(elemento) }
};

/// Un elemento del pannello con le sue misure: larghezza e altezza zero = non si vede.
function elemento(larghezza = 120, altezza = 24) {
    const el = {
        misure: { width: larghezza, height: altezza },
        getBoundingClientRect() { return { left: 10, top: 10, width: this.misure.width, height: this.misure.height }; }
    };
    nelPannello.add(el);
    return el;
}

/// Il suggerimento acceso sull'elemento, come lo lascia _mostraTooltip.
function accendi(el, mock) {
    //Node 20.5 vuole l'elenco, dal 20.11 (la CI usa 22 e 26) un oggetto con apis.
    try {
        mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
    }
    catch (err) {
        mock.timers.enable(["setInterval", "setTimeout"]);
    }
    Tooltip._riquadroTooltip = { style: { display: "block", visibility: "visible" } };
    Tooltip._sorvegliaAncora(el);
}

function acceso() {
    return Tooltip._riquadroTooltip.style.display === "block" && Tooltip._riquadroTooltip.style.visibility === "visible";
}

function spegni(mock) {
    Tooltip.nascondiTooltip();
    mock.timers.reset();
    nelPannello.clear();
}

/* ---- quando sparisce ---- */

test("il pulsante tolto dal pannello: il suggerimento sparisce al controllo successivo, senza muovere il mouse", (t) => {
    const pulsante = elemento();
    accendi(pulsante, t.mock);
    try {
        t.mock.timers.tick(Tooltip.INTERVALLO_CONTROLLO_ANCORA);
        assert.ok(acceso(), "finche' il pulsante c'e' il suggerimento resta");

        //la riga risolta lascia il posto a "Tutte le segnalazioni risolte"
        nelPannello.delete(pulsante);
        t.mock.timers.tick(Tooltip.INTERVALLO_CONTROLLO_ANCORA);

        assert.strictEqual(acceso(), false);
        assert.strictEqual(Tooltip._ancoraTooltip, null);
        assert.strictEqual(Tooltip._controlloAncora, null, "spento il suggerimento, il controllo si ferma");
    }
    finally {
        spegni(t.mock);
    }
});

test("l'elemento che non si vede piu' (finestra chiusa): il suggerimento sparisce", (t) => {
    const pulsante = elemento();
    accendi(pulsante, t.mock);
    try {
        pulsante.misure = { width: 0, height: 0 };
        t.mock.timers.tick(Tooltip.INTERVALLO_CONTROLLO_ANCORA);

        assert.strictEqual(acceso(), false);
    }
    finally {
        spegni(t.mock);
    }
});

/* ---- quando resta ---- */

test("l'elemento presente e visibile, anche un pulsante spento: il suggerimento resta", (t) => {
    const spento = elemento();
    spento.disabled = true;
    accendi(spento, t.mock);
    try {
        t.mock.timers.tick(Tooltip.INTERVALLO_CONTROLLO_ANCORA * 10);

        assert.ok(acceso());
        assert.strictEqual(Tooltip._ancoraTooltip, spento);
    }
    finally {
        spegni(t.mock);
    }
});

test("se l'elemento non si misura, basta che ci sia", () => {
    const senzaMisure = {};
    nelPannello.add(senzaMisure);
    try {
        assert.strictEqual(Tooltip._ancoraAncoraVisibile(senzaMisure), true);
        assert.strictEqual(Tooltip._ancoraAncoraVisibile(null), false);
        assert.strictEqual(Tooltip._ancoraAncoraVisibile({ getBoundingClientRect() { throw new Error("rotto"); } }), false);
    }
    finally {
        nelPannello.clear();
    }
});

/* ---- il controllo si ferma ---- */

test("nascondiTooltip ferma il controllo, e un nuovo suggerimento ne avvia uno solo", (t) => {
    const primo = elemento();
    const secondo = elemento();
    accendi(primo, t.mock);
    try {
        const controlloDelPrimo = Tooltip._controlloAncora;
        Tooltip._sorvegliaAncora(secondo);
        assert.notStrictEqual(Tooltip._controlloAncora, controlloDelPrimo);
        assert.strictEqual(Tooltip._ancoraTooltip, secondo);

        //Il primo sparisce: conta solo l'elemento del suggerimento acceso adesso.
        nelPannello.delete(primo);
        t.mock.timers.tick(Tooltip.INTERVALLO_CONTROLLO_ANCORA);
        assert.ok(acceso());

        Tooltip.nascondiTooltip();
        assert.strictEqual(Tooltip._controlloAncora, null);
        assert.strictEqual(acceso(), false);
    }
    finally {
        spegni(t.mock);
    }
});

test("_mostraTooltip avvia il controllo sull'elemento appena acceso il riquadro", () => {
    const sorgente = leggiFileDelPlugin("tooltip/tooltip.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    _mostraTooltip(elemento, testo) {");
    const mostra = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    assert.match(mostra, /riquadro\.style\.display = "block";\s*this\._sorvegliaAncora\(elemento\);/);
});
