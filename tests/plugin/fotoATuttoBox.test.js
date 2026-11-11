/*
 * TASK-99de57d1: nel volantino di Coop il BOX_STD di una referenza FRESCHISSIMI ha la foto a tutto
 * box: la cornice della foto primaria prende le misure della base, senza ostacoli, e l'immagine e'
 * larga quanto la cornice, in proporzione, centrata in verticale (puo' uscire sopra e sotto).
 *
 * Non e' una sovrastruttura: le regole del fix foto (fixFoto nel CssFramework) possono avere regole
 * condizionali, con una condizione sulla referenza (etichette, campi) e sulla lavorazione, che valgono
 * prima dei valori della loro sezione. Il modo nuovo e' "aTuttoBox", con adattamentoImmagine
 * "larghezza" o "altezza"; gli stessi due adattamenti sono i fit 4 e 5 del CssFramework.
 *
 * Qui: la condizione, la combinazione delle regole, il calcolo dell'adattamento, la foto a tutto
 * box su un box finto, la decisione all'impaginazione, i dati veri di Coop e chi passa la referenza.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame", PROPORTIONALLY: "proportionally" } };
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

const RADICE = path.join(__dirname, "..", "..");

global.Utility = { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };
global.pluginMiddleware = { getCampo: () => null };
global.messaggioUtente = () => {};
global.addSegnalazione = () => {};

let lavorazione = null;
global.ficoProcess = {
    getAreaLavorazioneCorrente: () => (lavorazione ? { sigla: lavorazione.area } : null),
    getCanaleLavorazioneCorrente: () => (lavorazione ? { sigla: lavorazione.canale } : null),
    getTipoLavorazioneCorrente: () => (lavorazione ? lavorazione.tipo : null),
    getFormatoLavorazioneCorrente: () => (lavorazione ? { codice: lavorazione.formato } : null)
};

function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

const FRESCHISSIMA = { allEtichette: ["IS_LINEA_NO", "FRESCHISSIMI"], codice_settore: "58", codice_reparto: "02" };
const NORMALE = { allEtichette: ["JOLLY"], codice_settore: "12", codice_reparto: "01" };

/* ---- la condizione ---- */

test("la condizione vuole tutte le etichette, senza distinguere maiuscole", () => {
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["freschissimi"] }, FRESCHISSIMA, 1), true);
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["FRESCHISSIMI", "JOLLY"] }, FRESCHISSIMA, 1), false);
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["FRESCHISSIMI"] }, NORMALE, 1), false);
    //Un'etichetta che la contiene non basta: si confronta l'etichetta intera.
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["FRESCHI"] }, FRESCHISSIMA, 1), false);
});

test("la condizione guarda anche i campi e il tipo di lavorazione", () => {
    assert.strictEqual(SistemazioneFoto.condizioneVera({ campi: [{ campo: "codice_settore", contiene: "58" }] }, FRESCHISSIMA, 1), true);
    assert.strictEqual(SistemazioneFoto.condizioneVera({ campi: [{ campo: "codice_settore", contiene: "58" }, { campo: "codice_reparto", contiene: "01" }] }, FRESCHISSIMA, 1), false);
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["FRESCHISSIMI"], lavorazioni: [1] }, FRESCHISSIMA, 1), true);
    assert.strictEqual(SistemazioneFoto.condizioneVera({ etichette: ["FRESCHISSIMI"], lavorazioni: [1] }, FRESCHISSIMA, 2), false);
});

test("senza referenza nessuna regola condizionale vale", () => {
    assert.strictEqual(SistemazioneFoto.condizioneVera({ lavorazioni: [1] }, null, 1), false);
    assert.strictEqual(SistemazioneFoto.condizioneVera({}, null, 1), false);
});

/* ---- le regole nella configurazione ---- */

const REGOLA = { quando: { etichette: ["FRESCHISSIMI"], lavorazioni: [1] }, modo: "aTuttoBox", adattamentoImmagine: "larghezza" };

test("una regola vera vale prima dei valori della sua sezione, una falsa non conta", () => {
    const voci = [{ fixFoto: { modo: "semplice", marginiFoto: [1, 1], condizionali: [REGOLA] } }];

    const vera = SistemazioneFoto.risolviConfigurazione(voci, FRESCHISSIMA, 1);
    assert.strictEqual(vera.modo, "aTuttoBox");
    assert.strictEqual(vera.adattamentoImmagine, "larghezza");
    assert.deepStrictEqual(vera.marginiFoto, [1, 1]);

    const falsa = SistemazioneFoto.risolviConfigurazione(voci, NORMALE, 1);
    assert.strictEqual(falsa.modo, "semplice");
    assert.strictEqual(falsa.adattamentoImmagine, null);

    const senzaReferenza = SistemazioneFoto.risolviConfigurazione(voci);
    assert.strictEqual(senzaReferenza.modo, "semplice");
});

test("una regola di una sezione piu' debole non scavalca il valore di una sezione piu' forte", () => {
    const voci = [{ fixFoto: { modo: "nessuno" } }, { fixFoto: { condizionali: [REGOLA] } }];

    const cfg = SistemazioneFoto.risolviConfigurazione(voci, FRESCHISSIMA, 1);

    assert.strictEqual(cfg.modo, "nessuno");
    //Ma porta i valori che la sezione piu' forte non dice.
    assert.strictEqual(cfg.adattamentoImmagine, "larghezza");
});

/* ---- l'adattamento dell'immagine ---- */

test("alla larghezza: un'immagine 1:1 in una cornice 80x40 e' 80x80 e sporge di 20 sopra e sotto", () => {
    const cornice = [10, 5, 50, 85];
    assert.deepStrictEqual(SistemazioneFoto.boundsImmagineAdattata(cornice, [0, 0, 30, 30], "larghezza"), [-10, 5, 70, 85]);
});

test("alla larghezza: un'immagine 4:1 in una cornice 80x40 e' 80x20, centrata in verticale", () => {
    const cornice = [10, 5, 50, 85];
    assert.deepStrictEqual(SistemazioneFoto.boundsImmagineAdattata(cornice, [100, 100, 110, 140], "larghezza"), [20, 5, 40, 85]);
});

test("all'altezza: un'immagine 1:1 in una cornice 40x80 e' 80x80 e sporge di 20 a sinistra e a destra", () => {
    const cornice = [0, 0, 80, 40];
    assert.deepStrictEqual(SistemazioneFoto.boundsImmagineAdattata(cornice, [0, 0, 10, 10], "altezza"), [0, -20, 80, 60]);
});

test("misure non valide o adattamento sconosciuto: nessun calcolo", () => {
    assert.strictEqual(SistemazioneFoto.boundsImmagineAdattata([0, 0, 0, 40], [0, 0, 10, 10], "larghezza"), null);
    assert.strictEqual(SistemazioneFoto.boundsImmagineAdattata([0, 0, 40, 40], [0, 0, 10, 10], "riempi"), null);
    assert.strictEqual(SistemazioneFoto.boundsImmagineAdattata(null, [0, 0, 10, 10], "larghezza"), null);
});

test("i fit 4 e 5 del CssFramework sono la larghezza e l'altezza", () => {
    assert.strictEqual(CssFramework.enumFitOperation(4), "FILL_WIDTH_CENTERED");
    assert.strictEqual(CssFramework.enumFitOperation(5), "FILL_HEIGHT_CENTERED");
    assert.strictEqual(CssFramework.enumFitOperation(6), null);
});

/* ---- la foto a tutto box su un box finto ---- */

function elemento(label, bounds, extra = {}) {
    let misure = [...bounds];
    return Object.assign({
        label,
        isValid: true,
        visible: true,
        get geometricBounds() { return [...misure]; },
        set geometricBounds(valore) { misure = [...valore]; }
    }, extra);
}

function boxFreschissimi() {
    const immagine = elemento("bitmap", [20, 20, 40, 40]);
    const cornice = elemento("immagine$123", [10, 10, 30, 50], {
        graphics: { length: 1, item: () => immagine },
        fit: () => { throw new Error("niente fit di InDesign con un adattamento dichiarato"); }
    });
    const base = elemento("base", [0, 0, 60, 100]);
    const prezzo = elemento("prezzo_promo", [5, 70, 20, 95]);
    return {
        cornice, immagine, base,
        box: { label: "BOX_STD", allPageItems: [base, cornice, prezzo], rectangles: { length: 1, item: () => cornice } }
    };
}

test("a tutto box la cornice prende la base, senza ostacoli, e l'immagine e' larga quanto lei", () => {
    const { box, cornice, immagine } = boxFreschissimi();
    const vero = SistemazioneFoto.fotoDelFix;
    SistemazioneFoto.fotoDelFix = (b) => [b.allPageItems[1]];
    try {
        SistemazioneFoto.fotoATuttoBox(box, { adattamentoImmagine: "larghezza" });
    }
    finally {
        SistemazioneFoto.fotoDelFix = vero;
    }

    assert.deepStrictEqual(cornice.geometricBounds, [0, 0, 60, 100]);
    //Immagine quadrata, cornice 100x60: 100x100, centrata, 20 fuori sopra e sotto.
    assert.deepStrictEqual(immagine.geometricBounds, [-20, 0, 80, 100]);
});

/* ---- la decisione all'impaginazione ---- */

function decisioneVera(cfg, tipo) {
    const chiamate = [];
    const veri = {
        configurazione: SistemazioneFoto.configurazione,
        fotoATuttoBox: SistemazioneFoto.fotoATuttoBox,
        getSpazioImpaginazione: SistemazioneFoto.getSpazioImpaginazione,
        fixFoto: SistemazioneFoto.fixFoto
    };
    let referenzaVista;
    SistemazioneFoto.configurazione = function () { referenzaVista = this.referenzaInCorso; return Object.assign(SistemazioneFoto.configurazionePredefinita(), cfg); };
    SistemazioneFoto.fotoATuttoBox = () => { chiamate.push("aTuttoBox"); };
    SistemazioneFoto.getSpazioImpaginazione = () => ({ candidate: [], obstacles: [] });
    SistemazioneFoto.fixFoto = () => { chiamate.push("plugin"); };
    try {
        SistemazioneFoto.sistemaFotoAllImpaginazione({ label: "BOX_STD" }, FRESCHISSIMA, tipo, () => { chiamate.push("agenzia"); });
    }
    finally {
        Object.assign(SistemazioneFoto, veri);
    }
    return { chiamate, referenzaVista, dopo: SistemazioneFoto.referenzaInCorso };
}

test("all'impaginazione il modo aTuttoBox mette la foto a tutto box, con la referenza del box", () => {
    const esito = decisioneVera({ modo: "aTuttoBox", lavorazioni: [1] }, 1);
    assert.deepStrictEqual(esito.chiamate, ["aTuttoBox"]);
    assert.strictEqual(esito.referenzaVista, FRESCHISSIMA);
    //Finito il fix la referenza non resta appesa.
    assert.strictEqual(esito.dopo, null);
});

test("all'impaginazione gli altri modi fanno come prima", () => {
    assert.deepStrictEqual(decisioneVera({ modo: "automatico", lavorazioni: [1] }, 1).chiamate, ["agenzia"]);
    assert.deepStrictEqual(decisioneVera({ modo: "semplice", lavorazioni: [1] }, 1).chiamate, ["plugin"]);
    assert.deepStrictEqual(decisioneVera({ modo: "nessuno", lavorazioni: [1] }, 1).chiamate, []);
    assert.deepStrictEqual(decisioneVera({ modo: "aTuttoBox", lavorazioni: [1] }, 2).chiamate, []);
});

/* ---- i dati di Coop ---- */

function configurazioneCoop(etichettaBox, referenza, tipo) {
    CssFramework.regoleScaricate = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta", "wwwroot", "external_source", "Coopfi", "SourceFrameworkCss.json"), "utf8")).dbRidimensionamentiAllineamenti;
    CssFramework.contestoCss = null;
    lavorazione = { area: "A", canale: "C", tipo, formato: tipo == 2 ? "A7" : "F" };
    return CssFramework.getConfigurazioneFixFoto({ label: etichettaBox }, referenza);
}

test("Coop: nel volantino il BOX_STD di una referenza FRESCHISSIMI ha la foto a tutto box, larga quanto la cornice", () => {
    for (const area of ["A", "B", "A-", "Z"]) {
        CssFramework.regoleScaricate = null;
        const cfg = configurazioneCoop("BOX_STD", FRESCHISSIMA, 1);
        lavorazione.area = area;
        const conArea = CssFramework.getConfigurazioneFixFoto({ label: "BOX_STD" }, FRESCHISSIMA);
        for (const c of [cfg, conArea]) {
            assert.strictEqual(c.modo, "aTuttoBox", area);
            assert.strictEqual(c.adattamentoImmagine, "larghezza", area);
        }
    }
});

test("Coop: senza l'etichetta, in un altro box, nel PoP o senza referenza resta il fix di prima", () => {
    for (const [box, referenza, tipo] of [["BOX_STD", NORMALE, 1], ["BOX_LINEA", FRESCHISSIMA, 1], ["BOX_STD", FRESCHISSIMA, 2], ["BOX_STD", null, 1]]) {
        const cfg = configurazioneCoop(box, referenza, tipo);
        assert.strictEqual(cfg.modo, "automatico", box + " " + tipo);
        assert.strictEqual(cfg.adattamentoImmagine, null, box + " " + tipo);
        assert.deepStrictEqual(cfg.lavorazioni, [1, 2]);
    }
});

/* ---- chi passa la referenza ---- */

test("il Fix foto manuale e la proposta dopo Foto P/S passano la referenza del box", () => {
    const indexNew = senzaCommenti(leggiFileDelPlugin("indexNew.js"));
    assert.match(indexNew, /buttonText: "Fix foto",\s*buttonCallback: async function \(\) \{[\s\S]*?var referenza = await referenzaDelBox\(currentElement\);\s*SistemazioneFoto\.sistemaFotoDelBox\(currentElement, referenza\);/);

    const schedaFoto = senzaCommenti(leggiFileDelPlugin("reperimentoFoto/schedaFoto.js"));
    assert.match(schedaFoto, /var referenza = await referenzaDelBox\(box\);\s*SistemazioneFoto\.sistemaFotoDelBox\(box, referenza\);/);
    assert.doesNotMatch(schedaFoto, /SistemazioneFoto\.fixFoto\(box, obs\.candidate, obs\.obstacles\)/);
});

test("la referenza del box viene dal suo DNA, dalle schede gia' scaricate o da Istanta", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indexNew.indexOf("async function referenzaDelBox(box) {");
    assert.ok(inizio > 0);
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\nfunction getSchedaRefAsync", inizio));
    assert.match(corpo, /var dna = Utility\.getDnaOfBox\(box\);/);
    assert.match(corpo, /schedaRef\.schedeRefDati\.find\(/);
    assert.match(corpo, /return await getSchedaRefAsync\(schedaRef, codiceGruppo, idRec != null \? idRec : 0\);/);
    assert.match(corpo, /catch \(e\) \{\s*console\.error\("Code IDX-202:/);
});
