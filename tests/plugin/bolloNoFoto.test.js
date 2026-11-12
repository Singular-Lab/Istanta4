/*
 * I20-1231: il segnaposto delle referenze senza foto e' il bollo "nofoto" dell'archivio Loghi e bolli.
 *
 * Il cliente aveva cambiato in archivio il file del nofoto (NoFoto.psd) e il Plugin continuava a
 * cercare nofoto.png. Il nome letto da Istanta stava dentro pluginMiddleware.customPluginDB, che
 * ficoProcess.scaricaFicoData azzera e riscarica a ogni cambio di documento: il nome si perdeva e
 * restava il file incorporato. Un errore di rete, poi, arrivava come "nome" del file. E il
 * ricollegamento riconosceva il segnaposto solo con i nomi fissi nofoto.png e fotoNoFound.png.
 *
 * pluginMiddleware, ReperimentoFoto e FotoPlacer si caricano sotto Node togliendo di mezzo
 * require('indesign'); il riquadro di InDesign e le globali del Plugin si fingono.
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
        return { FitOptions: { PROPORTIONALLY: "proporzionale" }, LocationOptions: {}, app: {}, ExportFormat: {} };
    }
    return caricaOriginale.apply(this, arguments);
};
let pluginMiddleware, ReperimentoFoto, FotoPlacer, XMLHttpRequestClient;
try {
    pluginMiddleware = require("../../plugin/pluginMiddleware.js");
    ReperimentoFoto = require("../../plugin/reperimentoFoto/reperimentoFoto.js");
    FotoPlacer = require("../../plugin/reperimentoFoto/fotoPlacer.js");
    XMLHttpRequestClient = require("../../plugin/XMLHttpRequestClient.js");
}
finally {
    Module._load = caricaOriginale;
}

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

//Il middleware come lo usa un cliente con la configurazione dal server (callCustom false).
function middlewareDaServer() {
    pluginMiddleware.callCustom = false;
    pluginMiddleware.customPluginDB = { cambiStrutturali: [] };
    pluginMiddleware.bolliDiRipiego = { nomeNoFoto: "", fotoNotFound: "" };
}

//La risposta di Istanta a LoghiBolli/getBySigla, o un errore di rete.
function conRisposta(risposta, prova) {
    const sendVero = XMLHttpRequestClient.prototype.send;
    const richieste = [];
    XMLHttpRequestClient.prototype.send = function (url) {
        richieste.push(url);
        if (risposta === "rete") {
            this.onerror({ type: "error" });
        }
        else {
            this.onload(typeof risposta === "function" ? risposta(url) : risposta, true);
        }
    };
    try {
        //Il client crea l'XMLHttpRequest nel costruttore: in Node non c'e', ne basta uno vuoto.
        return conGlobali({ XMLHttpRequest: class { } }, () => prova(richieste));
    }
    finally {
        XMLHttpRequestClient.prototype.send = sendVero;
    }
}

/* ---- il nome resta dopo la ricarica della configurazione ---- */

test("il bollo nofoto dell'archivio resta dopo che la configurazione del cliente si ricarica", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");
    pluginMiddleware.setBolloFOTONOFOUND("FotoNonTrovata.psd");

    //Quello che fa ficoProcess.scaricaFicoData portando davanti un altro documento.
    pluginMiddleware.customPluginDB = null;
    pluginMiddleware.customPluginDB = { cambiStrutturali: [] };

    assert.strictEqual(pluginMiddleware.nomeNoFoto(), "NoFoto.psd");
    assert.strictEqual(pluginMiddleware.nomeFotoNonTrovata(), "FotoNonTrovata.psd");
});

test("il nome arrivato mentre la configurazione si sta ricaricando non va perso", () => {
    middlewareDaServer();
    pluginMiddleware.customPluginDB = null;
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");
    pluginMiddleware.customPluginDB = { cambiStrutturali: [] };

    assert.strictEqual(pluginMiddleware.nomeNoFoto(), "NoFoto.psd");
});

test("senza il bollo in archivio restano i file incorporati", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("");
    pluginMiddleware.setBolloFOTONOFOUND("   ");

    assert.strictEqual(pluginMiddleware.nomeNoFoto(), "nofoto.png");
    assert.strictEqual(pluginMiddleware.nomeFotoNonTrovata(), "fotoNoFound.png");
});

test("un errore passato come nome non diventa il file del segnaposto", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO({ type: "error" });
    pluginMiddleware.setBolloFOTONOFOUND(new Error("rete"));

    assert.strictEqual(pluginMiddleware.nomeNoFoto(), "nofoto.png");
    assert.strictEqual(pluginMiddleware.nomeFotoNonTrovata(), "fotoNoFound.png");
});

/* ---- riconoscere il segnaposto ---- */

test("il segnaposto si riconosce dal bollo dell'archivio e dai file incorporati, senza maiuscole", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");

    assert.strictEqual(pluginMiddleware.eSegnapostoFoto("NoFoto.psd"), true);
    assert.strictEqual(pluginMiddleware.eSegnapostoFoto("nofoto.psd"), true);
    assert.strictEqual(pluginMiddleware.eSegnapostoFoto("nofoto.png"), true);
    assert.strictEqual(pluginMiddleware.eSegnapostoFoto("FOTONOFOUND.PNG"), true);
});

test("una foto vera, un nome vuoto o mancante non sono segnaposto", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");

    assert.strictEqual(pluginMiddleware.eSegnapostoFoto("680443_1_AD.psd"), false);
    assert.strictEqual(pluginMiddleware.eSegnapostoFoto(""), false);
    assert.strictEqual(pluginMiddleware.eSegnapostoFoto(null), false);
});

/* ---- la lettura da Istanta ---- */

test("i due bolli si leggono da Istanta e arrivano al middleware", () => {
    middlewareDaServer();
    const nomi = { nofoto: "NoFoto.psd", fotonofound: "FotoNonTrovata.psd" };
    conGlobali({ pluginMiddleware }, () => {
        conRisposta(url => ({ esito: true, item: { nome: nomi[url.split("/").pop()] } }), (richieste) => {
            ReperimentoFoto.caricaBolliDiRipiego();
            assert.deepStrictEqual(richieste, ["LoghiBolli/getBySigla/nofoto", "LoghiBolli/getBySigla/fotonofound"]);
        });
    });

    assert.strictEqual(pluginMiddleware.nomeNoFoto(), "NoFoto.psd");
    assert.strictEqual(pluginMiddleware.nomeFotoNonTrovata(), "FotoNonTrovata.psd");
});

test("un errore di rete va al ramo d'errore e lascia i file incorporati", () => {
    middlewareDaServer();
    const errore = console.error;
    console.error = () => {};
    try {
        let nomeRicevuto = null;
        let erroreRicevuto = null;
        conRisposta("rete", () => {
            ReperimentoFoto.getBolloNOFOTO(n => { nomeRicevuto = n; }, e => { erroreRicevuto = e; });
        });
        assert.strictEqual(nomeRicevuto, null);
        assert.ok(String(erroreRicevuto).includes("rete"));

        conGlobali({ pluginMiddleware }, () => {
            conRisposta("rete", () => ReperimentoFoto.caricaBolliDiRipiego());
        });
        assert.strictEqual(pluginMiddleware.nomeNoFoto(), "nofoto.png");
    }
    finally {
        console.error = errore;
    }
});

test("un bollo che l'archivio non ha va al ramo d'errore", () => {
    let nomeRicevuto = null;
    let erroreRicevuto = null;
    conRisposta({ esito: false, error: "not_found" }, () => {
        ReperimentoFoto.getBolloNOFOTO(n => { nomeRicevuto = n; }, e => { erroreRicevuto = e; });
    });
    assert.strictEqual(nomeRicevuto, null);
    assert.strictEqual(erroreRicevuto, "not_found");
});

/* ---- l'impaginazione del segnaposto ---- */

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

function conInDesign(prova) {
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
        }, prova);
    }
    finally {
        FotoPlacer.marginiDellaFoto = margini;
        console.error = errore;
        console.log = log;
    }
}

test("una referenza senza foto riceve il bollo nofoto dell'archivio, anche dopo la ricarica", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");
    pluginMiddleware.customPluginDB = null;
    pluginMiddleware.customPluginDB = { cambiStrutturali: [] };

    conInDesign(() => {
        const r = riquadro(["/lav/Loghi/NoFoto.psd", "/lav/Loghi/nofoto.png"]);
        const avviso = FotoPlacer.placeFoto("", r);
        assert.strictEqual(avviso, "");
        assert.deepStrictEqual(r.piazzati, ["/lav/Loghi/NoFoto.psd"]);
    });
});

test("senza il file del segnaposto nei Loghi il riquadro dice quale file manca", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloNOFOTO("NoFoto.psd");

    conInDesign(() => {
        const r = riquadro([]);
        const avviso = FotoPlacer.placeFoto("", r);
        assert.strictEqual(avviso, "Nofoto non trovato: NoFoto.psd");
        assert.strictEqual(r.testi[0].contents, "Nofoto non trovato: NoFoto.psd");
    });
});

test("una foto che non si trova riceve il bollo fotonofound dell'archivio", () => {
    middlewareDaServer();
    pluginMiddleware.setBolloFOTONOFOUND("FotoNonTrovata.psd");

    conInDesign(() => {
        const r = riquadro(["/lav/Loghi/FotoNonTrovata.psd"]);
        const avviso = FotoPlacer.placeFoto("680443_1_AD.psd", r);
        assert.strictEqual(avviso, "Foto non trovata, è stata inserita FotoNonTrovata.psd");
        assert.deepStrictEqual(r.piazzati, ["/lav/Loghi/FotoNonTrovata.psd"]);
    });
});

/* ---- sul sorgente: chi rilegge i bolli e chi riconosce il segnaposto ---- */

test("i bolli si rileggono dopo ogni ricarica della configurazione del cliente", () => {
    const sorgente = leggiFileDelPlugin("ficoProcess.js");
    const ricarica = sorgente.indexOf("await pluginMiddleware.getCustomPlugin();");
    const rilettura = sorgente.indexOf("ReperimentoFoto.caricaBolliDiRipiego();", ricarica);
    assert.ok(ricarica > 0, "scaricaFicoData ricarica la configurazione");
    assert.ok(rilettura > ricarica && rilettura - ricarica < 600, "subito dopo rilegge i bolli");
});

test("il ricollegamento e il confronto non usano piu' i nomi fissi del segnaposto", () => {
    const ricollega = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js");
    assert.ok(!/nomeFoto\s*[!=]=\s*"nofoto\.png"/.test(ricollega));
    assert.ok(!/nomeFoto\s*[!=]=\s*"fotoNoFound\.png"/.test(ricollega));
    assert.ok(ricollega.includes("pluginMiddleware.eSegnapostoFoto(foto.nomeFoto)"));

    const confronto = leggiFileDelPlugin("confronti.js");
    assert.ok(confronto.includes("pluginMiddleware.eSegnapostoFoto(foto.nomeFoto)"));
    assert.ok(!confronto.includes('getCampo("nomeNoFoto")'));
});
