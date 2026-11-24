/*
 * I20-1263: la foto che non si trova diventa una segnalazione nel bollino del box.
 *
 * Quando il file di una foto primaria o secondaria non c'e', FotoPlacer.placeFoto mette al suo posto
 * il segnaposto fotonofound dell'archivio Loghi e bolli e restituisce un avviso, che impaginaBox
 * lasciava cadere: il box usciva col segnaposto e senza nessuna segnalazione. Ora impaginaBox passa
 * l'avviso a FotoPlacer.segnalazioneFotoNonTrovata, che ne fa la FNF-01 (un avviso, arancione, come
 * la PSD-01); per Edro21 la FNF-01 cade nel filtro "Solo foto" e nella schermata ha il pallino viola.
 * La referenza senza foto, che prende il nofoto, non si segnala.
 *
 * FotoPlacer e pluginMiddleware si caricano sotto Node togliendo di mezzo require('indesign'), come
 * in bolloNoFoto.test.js; impaginaBox si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { PROPORTIONALLY: "proporzionale" }, LocationOptions: {}, app: {}, ExportFormat: {} };
    }
    return caricaOriginale.apply(this, arguments);
};
let pluginMiddleware, FotoPlacer;
try {
    pluginMiddleware = require("../../plugin/pluginMiddleware.js");
    FotoPlacer = require("../../plugin/reperimentoFoto/fotoPlacer.js");
}
finally {
    Module._load = caricaOriginale;
}
const etichetta = require("../../plugin/segnalazioni/etichetta");
const SchermataSegnalazioni = require("../../plugin/segnalazioni/schermata");

const RADICE = path.join(__dirname, "..", "..");
const FILTRI_EDRO21 = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"), "utf8")).filtriSegnalazioni;
const SOLO_FOTO = FILTRI_EDRO21.find(f => f.nome === "Solo foto");

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = Object.prototype.hasOwnProperty.call(global, k) ? global[k] : undefined; global[k] = globali[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

//Il cliente con la configurazione dal server e il bollo fotonofound dell'archivio.
function middlewareConSegnaposto(nome) {
    pluginMiddleware.callCustom = false;
    pluginMiddleware.customPluginDB = { cambiStrutturali: [] };
    pluginMiddleware.bolliDiRipiego = { nomeNoFoto: "", fotoNotFound: nome };
}

//Un riquadro foto finto: place() riesce solo per i file che "ci sono".
function riquadro(fileEsistenti) {
    const r = {
        piazzati: [],
        testi: [],
        parent: null,
        geometricBounds: [0, 0, 100, 100],
        place(percorso) {
            if (!fileEsistenti.includes(percorso)) {
                throw new Error("file non trovato");
            }
            r.piazzati.push(percorso);
        },
        fit() {},
        textFrames: { add() { const t = {}; r.testi.push(t); return t; } }
    };
    return r;
}

//Impagina la foto nel riquadro e restituisce la segnalazione che ne nasce, come fa impaginaBox.
function impagina(nomeFoto, fileEsistenti) {
    const margini = FotoPlacer.marginiDellaFoto;
    FotoPlacer.marginiDellaFoto = () => null;
    const errore = console.error;
    const log = console.log;
    console.error = () => {};
    console.log = () => {};
    try {
        return conGlobali({
            pluginMiddleware,
            percorsoLinks: "/lav/Links/",
            percorsoLoghi: "/lav/Loghi/",
            docInLavorazione: { colors: { itemByName: () => ({ isValid: true }), add: () => ({}) } },
            ColorModel: { process: "process" }
        }, () => {
            const r = riquadro(fileEsistenti);
            const avviso = FotoPlacer.placeFoto(nomeFoto, r);
            return { riquadro: r, segnalazione: FotoPlacer.segnalazioneFotoNonTrovata(nomeFoto, avviso) };
        });
    }
    finally {
        FotoPlacer.marginiDellaFoto = margini;
        console.error = errore;
        console.log = log;
    }
}

//La voce che finisce nell'etichetta del bollino, come la scrive addSegnalazione.
function voceDelBollino(segnalazione) {
    return etichetta.daSegnalazione({ msg: segnalazione.testo, typeMessage: segnalazione.gravita });
}

/* ---- quando nasce la segnalazione ---- */

test("una foto che non si trova: c'e' il segnaposto e il bollino ha un avviso FNF-01 che la nomina", () => {
    middlewareConSegnaposto("FotoNonTrovata.psd");
    const esito = impagina("680443_1_AD.psd", ["/lav/Loghi/FotoNonTrovata.psd", "/lav/Loghi/fotoNoFound.png"]);

    assert.deepStrictEqual(esito.riquadro.piazzati, ["/lav/Loghi/FotoNonTrovata.psd"]);
    assert.ok(esito.segnalazione != null, "la foto mancante si segnala");
    assert.strictEqual(esito.segnalazione.gravita, "warning");
    assert.match(esito.segnalazione.testo, /^Code FNF-01 /);
    assert.ok(esito.segnalazione.testo.includes("680443_1_AD.psd"), esito.segnalazione.testo);
    assert.ok(esito.segnalazione.testo.includes("FotoNonTrovata.psd"), esito.segnalazione.testo);

    const voce = voceDelBollino(esito.segnalazione);
    assert.strictEqual(voce.g, "warning", "avviso: bollino arancione");
    assert.strictEqual(voce.c, "FNF-01");
});

test("se manca anche il segnaposto la FNF-01 lo dice", () => {
    middlewareConSegnaposto("FotoNonTrovata.psd");
    const esito = impagina("680443_1_AD.psd", []);

    assert.deepStrictEqual(esito.riquadro.piazzati, []);
    assert.ok(esito.segnalazione != null);
    assert.match(esito.segnalazione.testo, /^Code FNF-01 /);
    assert.ok(esito.segnalazione.testo.includes("680443_1_AD.psd"), esito.segnalazione.testo);
    assert.ok(esito.segnalazione.testo.includes("manca anche il segnaposto FotoNonTrovata.psd"), esito.segnalazione.testo);
    assert.strictEqual(voceDelBollino(esito.segnalazione).c, "FNF-01");
});

test("la foto trovata e la referenza senza foto non si segnalano", () => {
    middlewareConSegnaposto("FotoNonTrovata.psd");
    const trovata = impagina("680443_1_AD.psd", ["/lav/Links/680443_1_AD.psd"]);
    assert.deepStrictEqual(trovata.riquadro.piazzati, ["/lav/Links/680443_1_AD.psd"]);
    assert.strictEqual(trovata.segnalazione, null);

    //La referenza senza foto prende il nofoto; anche quando il nofoto manca non e' una foto non trovata.
    assert.strictEqual(impagina("", ["/lav/Loghi/nofoto.png"]).segnalazione, null);
    assert.strictEqual(impagina("", []).segnalazione, null);
    assert.strictEqual(impagina(null, []).segnalazione, null);
});

test("senza l'avviso di placeFoto non c'e' segnalazione", () => {
    middlewareConSegnaposto("");
    conGlobali({ pluginMiddleware }, () => {
        assert.strictEqual(FotoPlacer.segnalazioneFotoNonTrovata("680443_1_AD.psd", ""), null);
        assert.strictEqual(FotoPlacer.segnalazioneFotoNonTrovata("680443_1_AD.psd", undefined), null);
        //Senza bollo in archivio vale il segnaposto incorporato.
        const s = FotoPlacer.segnalazioneFotoNonTrovata("680443_1_AD.psd", FotoPlacer.AVVISO_SEGNAPOSTO_INSERITO + "fotoNoFound.png");
        assert.ok(s.testo.includes("fotoNoFound.png"), s.testo);
    });
});

/* ---- Edro21: nel filtro "Solo foto" ---- */

test("per Edro21 la FNF-01 cade nel filtro Solo foto, con il pallino viola", () => {
    middlewareConSegnaposto("FotoNonTrovata.psd");
    const voce = voceDelBollino(impagina("680443_1_AD.psd", ["/lav/Loghi/FotoNonTrovata.psd"]).segnalazione);

    assert.ok(SOLO_FOTO != null, "Edro21 dichiara il filtro Solo foto");
    assert.strictEqual(SchermataSegnalazioni.voceNelFiltro(voce, SOLO_FOTO), true);
    assert.strictEqual(SchermataSegnalazioni.voceDeiFiltri(voce, FILTRI_EDRO21), true);
    //Il filtro Note category non la prende.
    assert.strictEqual(SchermataSegnalazioni.voceNelFiltro(voce, FILTRI_EDRO21.find(f => f.nome === "Note category")), false);
    //Un cliente senza filtri non la vede viola.
    assert.strictEqual(SchermataSegnalazioni.voceDeiFiltri(voce, []), false);
});

/* ---- sul sorgente: impaginaBox la scrive per primaria e secondarie ---- */

test("impaginaBox passa l'avviso di placeFoto alla segnalazione, per la primaria e per le secondarie", () => {
    const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    const secondaria = sorgente.indexOf("var avvisoFoto = FotoPlacer.placeFoto(nomeFoto, photo);");
    assert.ok(secondaria > 0, "l'avviso della secondaria si tiene");
    assert.ok(sorgente.indexOf("segnalazioneFotoNonTrovata(nomeFoto, avvisoFoto);", secondaria) > secondaria);

    const primaria = sorgente.indexOf("var avvisoPrimaria = FotoPlacer.placeFoto(nomeFoto, field);");
    assert.ok(primaria > 0, "l'avviso della primaria si tiene");
    assert.ok(sorgente.indexOf("segnalazioneFotoNonTrovata(nomeFoto, avvisoPrimaria);", primaria) > primaria);

    //Nessun placeFoto in impaginaBox che lasci cadere l'avviso.
    assert.doesNotMatch(sorgente, /^\s*FotoPlacer\.placeFoto\(/m);

    //La funzione aggiunge al bollino con addSegnalazione, e non lancia.
    const funzione = sorgente.substring(sorgente.indexOf("function segnalazioneFotoNonTrovata(nomeFoto, avviso) {"));
    const corpo = funzione.substring(0, funzione.indexOf("\n}\n"));
    assert.match(corpo, /FotoPlacer\.segnalazioneFotoNonTrovata\(nomeFoto, avviso\)/);
    assert.match(corpo, /addSegnalazione\(segnalazione\.testo, segnalazione\.gravita, 2, true\)/);
    assert.match(corpo, /catch \(e\)/);
});
