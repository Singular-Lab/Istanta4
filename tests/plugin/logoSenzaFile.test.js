/*
 * I20-1140: un logo senza file non ferma l'impaginazione del box.
 *
 * Il registro del Plugin del 26/10/2026 (Patate dolci, 7052588): ogni reimpaginazione si fermava con
 * IDX-55 "Impossibile trovare il file .../Loghi/boll_CORRETTO_EDRO21.psd". I loghi automatici si
 * mettono uno dopo l'altro in un blocco solo: il bollino era il secondo, e la sua eccezione lasciava
 * fuori tutti quelli dopo - la bandiera italiana e il logo attributo italiano - e il raggruppamento.
 * Ora FotoPlacer.piazzaFotoExtraAuto salta il logo senza file: toglie il riquadro vuoto, avvisa con
 * FPL-01 e restituisce null; impaginaBox scarta i null prima di raggruppare, e fa lo stesso con le
 * foto extra manuali.
 *
 * fotoPlacer.js fa require('indesign'): qui il modulo e' uno stub, e documento, pagina e box sono
 * finti. Il giro di impaginaBox si controlla sul sorgente.
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
        return {
            FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame", PROPORTIONALLY: "proportionally" },
            LocationOptions: { UNKNOWN: "unknown" }
        };
    }
    return caricaOriginale.apply(this, arguments);
};
let FotoPlacer;
try {
    FotoPlacer = require("../../plugin/reperimentoFoto/fotoPlacer.js");
}
finally {
    Module._load = caricaOriginale;
}

/* ---- l'ambiente finto ---- */

const MANCANTE = "boll_CORRETTO_EDRO21.psd";
let messaggi = [];
let riquadri = [];

/// Il documento: posare un file che non c'e' lancia, come InDesign.
function documento() {
    const pagina = {
        place(percorso) {
            if (percorso.endsWith(MANCANTE)) {
                throw new Error("Impossibile trovare il file \"" + percorso + "\"");
            }
            return [{ isValid: true, label: "", duplicate() { return simbolo(); } }];
        },
        allPageItems: []
    };
    return {
        pages: { item: () => pagina },
        layers: { itemByName: (nome) => ({ nome }) }
    };
}

function simbolo() {
    return { isValid: true, label: "", move() { }, bringToFront() { } };
}

function box() {
    const pagina = {
        rectangles: {
            add() {
                const riquadro = {
                    label: "", rimosso: false, adattamenti: [],
                    place(percorso) {
                        if (percorso.endsWith(MANCANTE)) {
                            throw new Error("Impossibile trovare il file \"" + percorso + "\"");
                        }
                        this.file = percorso;
                    },
                    fit(tipo) { this.adattamenti.push(tipo); },
                    remove() { this.rimosso = true; }
                };
                riquadri.push(riquadro);
                return riquadro;
            }
        }
    };
    return { parentPage: pagina, geometricBounds: [0, 0, 80, 100], visibleBounds: [0, 0, 80, 100] };
}

test.beforeEach(() => {
    messaggi = [];
    riquadri = [];
    global.percorsoLoghi = "/lavorazione/Links/Loghi/";
    global.cacheLoghi = {};
    global.pluginMiddleware = { getFitTypeLogo: () => "contentToFrame" };
    global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
});

test.after(() => {
    ["percorsoLoghi", "cacheLoghi", "pluginMiddleware", "messaggioUtente"].forEach(nome => delete global[nome]);
});

/* ---- il logo ---- */

test("un logo con il file si piazza come prima", () => {
    const extra = { nome: "LOGO_filiera.psd", sigla: "LOGO_filiera", tipo: 3 };

    const elemento = FotoPlacer.piazzaFotoExtraAuto(extra, box(), {}, documento());

    assert.ok(elemento != null);
    assert.strictEqual(elemento.label, "foto_extra$LOGO_filiera$tipo_3");
    assert.strictEqual(elemento.file, "/lavorazione/Links/Loghi/LOGO_filiera.psd");
    assert.strictEqual(extra.referenceTo, elemento);
    assert.deepStrictEqual(messaggi, []);
});

test("un logo senza file: nessun riquadro vuoto, avviso FPL-01 con il nome del file, null", () => {
    const extra = { nome: MANCANTE, sigla: "CORRETTO_EDRO", tipo: 3 };
    const avvisi = [];
    const warnOriginale = console.warn;
    console.warn = (...parti) => avvisi.push(parti.map(String).join(" "));
    let elemento;
    try {
        elemento = FotoPlacer.piazzaFotoExtraAuto(extra, box(), {}, documento());
    }
    finally {
        console.warn = warnOriginale;
    }

    assert.strictEqual(elemento, null);
    assert.strictEqual(riquadri.length, 1);
    assert.strictEqual(riquadri[0].rimosso, true, "il riquadro creato per il logo e' stato tolto");
    assert.strictEqual(extra.referenceTo, undefined);
    assert.strictEqual(messaggi.length, 1);
    assert.strictEqual(messaggi[0].stile, "warning");
    assert.match(messaggi[0].testo, /^Code FPL-01 Logo boll_CORRETTO_EDRO21\.psd non trovato nella cartella dei loghi/);
    assert.ok(avvisi.some(a => a.startsWith("Code FPL-01")));
});

test("i loghi dopo quello senza file si piazzano lo stesso: il caso di Patate dolci", () => {
    const loghi = ["LOGO_filiera.psd", MANCANTE, "conad_saporiideePQ.psd", "LOGO_bandiera_italiana.psd"]
        .map(nome => ({ nome, sigla: nome.replace(".psd", ""), tipo: 3 }));
    const doc = documento();
    const scatola = box();

    const piazzati = loghi.map(extra => FotoPlacer.piazzaFotoExtraAuto(extra, scatola, {}, doc)).filter(el => el != null);

    assert.deepStrictEqual(piazzati.map(el => el.label), [
        "foto_extra$LOGO_filiera$tipo_3", "foto_extra$conad_saporiideePQ$tipo_3", "foto_extra$LOGO_bandiera_italiana$tipo_3"
    ]);
    assert.strictEqual(messaggi.length, 1);
});

test("un idms senza file: null e avviso, nessun simbolo in cache", () => {
    const extra = { nome: "boll_CORRETTO_EDRO21.psd".replace(".psd", ".idms"), sigla: "CORRETTO_EDRO", tipo: 3 };
    const doc = documento();
    doc.pages.item().place = () => { throw new Error("Impossibile trovare il file"); };

    const elemento = FotoPlacer.piazzaFotoExtraAuto(extra, box(), {}, doc);

    assert.strictEqual(elemento, null);
    assert.strictEqual(global.cacheLoghi.CORRETTO_EDRO, undefined);
    assert.match(messaggi[0].testo, /^Code FPL-01 Logo boll_CORRETTO_EDRO21\.idms/);
});

/* ---- l'impaginazione, sul sorgente ---- */

test("impaginaBox scarta i loghi senza elemento prima di raggruppare, e salta la foto extra manuale senza file", () => {
    const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    //I loghi automatici passano ancora da FotoPlacer (vedi sovrastrutture.test.js)...
    const piazza = sorgente.indexOf('elementiDaGruppare.push(FotoPlacer.piazzaFotoExtraAuto(itemRef["Foto.ExtraAuto"][ij], boxImpaginato, pagCoinvolta, doc));');
    //...e i null spariscono prima del gruppo.
    const filtro = sorgente.indexOf("elementiDaGruppare = elementiDaGruppare.filter(el => el != null);");
    const gruppo = sorgente.indexOf("if (elementiDaGruppare.length > 0) {", filtro);
    assert.ok(piazza > 0 && filtro > piazza && gruppo > filtro, "ordine: piazzamento, filtro, raggruppamento");
    assert.match(sorgente, /let elementiDaGruppare = \[\];/);

    //Foto extra manuali: senza file il riquadro esce dal gruppo e dalla pagina, e si passa alla prossima.
    assert.match(sorgente, /try \{\s*rect\.place\(path\);\s*\}\s*catch \(errLogo\) \{\s*elementiDaGruppare\.pop\(\);\s*try \{\s*rect\.remove\(\);\s*\}\s*catch \(errRimozione\) \{[^}]*\}\s*FotoPlacer\.avvisaLogoSenzaFile\(nome, errLogo\);\s*continue;\s*\}/);
});
