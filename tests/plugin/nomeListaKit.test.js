/*
 * I20-1034: la lista del kit porta davanti canale e area della lavorazione.
 *
 * Il file era sempre listaKit<id>.json, e in una cartella con piu' lavorazioni non si capiva quale
 * fosse quale. Ora si scrive CN_TO_listaKit<id>.json, con le sole sigle che ci sono, e si legge
 * riconoscendo il file da come finisce: i file scaricati prima, senza sigle, restano leggibili.
 * Il nome lo sa un punto solo, utility.js: i tredici punti che lo costruivano a mano passano da li'.
 *
 * utility.js fa require('indesign'): le funzioni si prendono dal sorgente e si costruiscono con i
 * globali del Plugin passati da fuori, come in contestoPromoLibreria.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = sorgente.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return sorgente.substring(inizio, fine + "\n    }".length);
}

//Utility con le sole funzioni della lista del kit, e i globali del Plugin che usano.
function utilityCon(ambiente) {
    const membri = ["nomeFileListaKit(", "eFileListaKit(", "_sigleListaKit(", "percorsoNuovaListaKit(", "percorsoListaKit("].map(corpoMembro);
    const fabbrica = new Function("pathLavorazione", "idKitLavorazione", "ficoProcess", "require",
        "const Utility = ({\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    return fabbrica(
        ambiente.pathLavorazione || "/lavorazione",
        ambiente.idKitLavorazione,
        ambiente.ficoProcess,
        (nome) => {
            assert.strictEqual(nome, "fs");
            return { readdirSync: () => { if (ambiente.cartella == null) { throw new Error("cartella non leggibile"); } return ambiente.cartella; } };
        });
}

const CN_TO = {
    getCanaleLavorazioneCorrente: () => ({ sigla: "CN" }),
    getAreaLavorazioneCorrente: () => ({ sigla: "TO" })
};

/* ---- il nome ---- */

test("il nome porta davanti canale e area, e solo le sigle che ci sono", () => {
    const Utility = utilityCon({});

    assert.strictEqual(Utility.nomeFileListaKit(302, "CN", "TO"), "CN_TO_listaKit302.json");
    assert.strictEqual(Utility.nomeFileListaKit(302, "CN", null), "CN_listaKit302.json");
    assert.strictEqual(Utility.nomeFileListaKit(302, 0, "TO"), "TO_listaKit302.json");
    assert.strictEqual(Utility.nomeFileListaKit(302, null, " "), "listaKit302.json");
});

test("la lista di un kit si riconosce da come finisce, con o senza sigle", () => {
    const Utility = utilityCon({});

    assert.ok(Utility.eFileListaKit("listaKit302.json", 302));
    assert.ok(Utility.eFileListaKit("CN_TO_listaKit302.json", 302));
    assert.ok(Utility.eFileListaKit("SS_TO_listaKit302.json", "302"));
    //Un altro kit che finisce con le stesse cifre non e' questo.
    assert.ok(!Utility.eFileListaKit("listaKit1302.json", 302));
    assert.ok(!Utility.eFileListaKit("CN_TO_listaKit3021.json", 302));
    assert.ok(!Utility.eFileListaKit("listaRefConteggio.json", 302));
});

/* ---- scrivere e leggere ---- */

test("si scrive col nome della lavorazione aperta, senza sigle per un altro kit", () => {
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: CN_TO }).percorsoNuovaListaKit(302), "/lavorazione/CN_TO_listaKit302.json");
    assert.strictEqual(utilityCon({ idKitLavorazione: 301, ficoProcess: CN_TO }).percorsoNuovaListaKit(302), "/lavorazione/listaKit302.json");
    //Senza i dettagli di canale e area, ficoProcess restituisce 0.
    const senzaDettagli = { getCanaleLavorazioneCorrente: () => 0, getAreaLavorazioneCorrente: () => 0 };
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: senzaDettagli }).percorsoNuovaListaKit(302), "/lavorazione/listaKit302.json");
});

test("si legge il file col nome atteso, e se manca quello che finisce come lui", () => {
    const cartella = ["listaKit301.json", "listaKit302.json", "CN_TO_listaKit302.json", "lavorazioni.json"];
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: CN_TO, cartella }).percorsoListaKit(302), "/lavorazione/CN_TO_listaKit302.json");

    //Le liste scaricate prima, senza sigle, restano leggibili.
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: CN_TO, cartella: ["listaKit302.json"] }).percorsoListaKit(302), "/lavorazione/listaKit302.json");
    //E una lista con le sigle si trova anche quando le sigle non si conoscono.
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: null, cartella: ["SS_TO_listaKit302.json"] }).percorsoListaKit(302), "/lavorazione/SS_TO_listaKit302.json");
});

test("senza file, o con la cartella che non si legge, il nome atteso dira' non trovato", () => {
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: CN_TO, cartella: ["listaKit1302.json"] }).percorsoListaKit(302), "/lavorazione/CN_TO_listaKit302.json");
    assert.strictEqual(utilityCon({ idKitLavorazione: 302, ficoProcess: CN_TO, cartella: null }).percorsoListaKit(302), "/lavorazione/CN_TO_listaKit302.json");
});

/* ---- chi lo usa ---- */

test("nessun file del Plugin costruisce piu' il nome a mano", () => {
    for (const file of fileDelPlugin()) {
        const testo = leggiFileDelPlugin(file).replace(/\r/g, "")
            .split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
        assert.doesNotMatch(testo, /\/listaKit" *\+/, file);
    }
});

test("lo scaricamento scrive col nome nuovo, le letture passano dal punto unico", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indexNew, /var filePath = Utility\.percorsoNuovaListaKit\(idKit\);\s*\/\/aggiungiamo a objResult/);
    assert.match(indexNew, /let filePath = Utility\.percorsoListaKit\(idKit\);/);

    const conteggi = { "ficoProcess.js": 4, "filtri.js": 2, "pluginMiddleware.js": 1, "schedaRef.js": 1, "reportIntegrita/reportIntegrita.js": 4 };
    for (const file of Object.keys(conteggi)) {
        const usi = (leggiFileDelPlugin(file).match(/Utility\.percorsoListaKit\(/g) || []).length;
        assert.ok(usi >= conteggi[file], file + ": " + usi);
    }

    //Il messaggio dice il nome che il Plugin cerca.
    assert.match(leggiFileDelPlugin("ficoProcess.js"), /"Code FIP-05 Errore: File " \+ Utility\.percorsoListaKit\(idKitLavorazione\)\.split\("\/"\)\.pop\(\) \+ " non trovato"/);
});
