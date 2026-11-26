/*
 * TASK-0c931089: il conteggio e le referenze escluse separati per documento, come i filtri.
 *
 * Quando l'agenzia separa i filtri per documento (controlloNomeFileFiltri, oggi Edro21), i filtri
 * stanno in Filtri<documento>.json. Il conteggio e le referenze escluse invece erano uno per tutti i
 * documenti della cartella: due volantini nella stessa cartella si sovrascrivevano il conteggio. Ora
 * seguono la stessa regola dei filtri: listaRefConteggio<documento>.json e
 * listaRefEscluse<documento>.json con il flag, il file unico di prima senza. La prima volta che il
 * documento non ha il suo file, nasce come copia di quello unico, che resta.
 *
 * utility.js fa require('indesign'): le funzioni si prendono dal sorgente e girano su un disco
 * finto, come in lavorazioniPerMacchina.test.js. Il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const ID = "mac-mini-di-sm2_k3F9a2Lp0Q";
const DATI = "/doc/SingularData/" + ID;

const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = utility.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = utility.indexOf("\n    },\n", inizio);
    return utility.substring(inizio, fine + "\n    }".length);
}

function costanti() {
    const inizio = utility.indexOf("    CARTELLA_LOGS:");
    const fine = utility.indexOf("\n", utility.indexOf("    NOME_FILE_LAVORAZIONI:"));
    return utility.substring(inizio, fine).replace(/,\s*$/, "");
}

//Un disco finto: la cartella dei dati con i suoi file. Le scritture aggiornano l'elenco.
function disco(file = {}) {
    const d = { file: Object.assign({}, file), scritture: [] };
    const nomi = () => Object.keys(d.file).filter(p => p.startsWith(DATI + "/")).map(p => p.substring(DATI.length + 1));
    d.fs = {
        readdirSync: (p) => {
            if (p !== DATI) {
                throw new Error("ENOTDIR " + p);
            }
            return nomi();
        },
        readFileSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(d.file, p)) {
                throw new Error("ENOENT " + p);
            }
            return d.file[p];
        },
        writeFileSync: (p, contenuto) => {
            d.file[p] = String(contenuto);
            d.scritture.push(p);
        }
    };
    return d;
}

//Utility con le funzioni dei file di lavoro, su un documento e con il flag dell'agenzia.
function utilityCon(d, documento, perDocumento) {
    const membri = ["_senzaBarraFinale(", "_vociDellaCartella(", "nomeUtenteInDesign(", "nomeCartellaPostazione(",
        "cartellaDatiMacchina(", "cartellaDati(", "percorsoDati(", "suffissoFileDocumento(", "_suffissoDocumentoInLavorazione(",
        "_percorsoPerDocumento(", "percorsoFiltri(", "percorsoConteggio(", "percorsoRefEscluse(", "eFileListaKit(",
        "nomeFileReportIntegrita(", "nomeFileWhitelistIntegrita(", "fileDiLavoro("].map(corpoMembro);
    const fabbrica = new Function("SingularPath", "pathLavorazione", "idMacchina", "require", "pluginMiddleware", "docInLavorazione", "console",
        "const Utility = ({\n" + costanti() + ",\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    const errori = [];
    const u = fabbrica(DATI, "/doc", () => ID, (nome) => {
        assert.strictEqual(nome, "fs");
        return d.fs;
    }, { getCampo: (campo) => campo === "controlloNomeFileFiltri" ? perDocumento : null },
    documento == null ? null : { name: documento }, { error: (t) => errori.push(t), log: () => { } });
    u.errori = errori;
    return u;
}

/* ---- il nome del file ---- */

test("con il flag dei filtri, conteggio ed escluse prendono il nome del documento, come i filtri", () => {
    const u = utilityCon(disco(), "Volantino_12.indd", true);
    assert.strictEqual(u.percorsoFiltri(), DATI + "/FiltriVolantino_12.json");
    assert.strictEqual(u.percorsoConteggio(), DATI + "/listaRefConteggioVolantino_12.json");
    assert.strictEqual(u.percorsoRefEscluse(), DATI + "/listaRefEscluseVolantino_12.json");
});

test("senza il flag i file restano uno per tutti i documenti, come prima", () => {
    for (const flag of [false, null, undefined]) {
        const d = disco({ [DATI + "/listaRefConteggio.json"]: "[1]" });
        const u = utilityCon(d, "Volantino_12.indd", flag);
        assert.strictEqual(u.percorsoFiltri(), DATI + "/Filtri.json");
        assert.strictEqual(u.percorsoConteggio(), DATI + "/listaRefConteggio.json");
        assert.strictEqual(u.percorsoRefEscluse(), DATI + "/listaRefEscluse.json");
        assert.deepStrictEqual(d.scritture, []);
    }
});

test("due documenti nella stessa cartella hanno ognuno il suo conteggio", () => {
    const d = disco();
    const a = utilityCon(d, "A.indd", true).percorsoConteggio();
    const b = utilityCon(d, "B.indd", true).percorsoConteggio();
    assert.notStrictEqual(a, b);
    assert.strictEqual(a, DATI + "/listaRefConteggioA.json");
    assert.strictEqual(b, DATI + "/listaRefConteggioB.json");
});

test("solo l'ultima estensione si toglie dal nome del documento", () => {
    const u = utilityCon(disco(), "Coop.12.2026.indd", true);
    assert.strictEqual(u.suffissoFileDocumento("Coop.12.2026.indd", true), "Coop.12.2026");
    assert.strictEqual(u.suffissoFileDocumento("Coop.indd", false), "");
    assert.strictEqual(u.suffissoFileDocumento(null, true), "");
});

/* ---- il passaggio dal file unico ---- */

test("la prima volta il file del documento nasce dal file unico, che resta", () => {
    const d = disco({ [DATI + "/listaRefEscluse.json"]: "[\"esclusa\"]", [DATI + "/listaRefConteggio.json"]: "[\"contata\"]" });
    const u = utilityCon(d, "A.indd", true);

    assert.strictEqual(u.percorsoRefEscluse(), DATI + "/listaRefEscluseA.json");
    assert.strictEqual(d.file[DATI + "/listaRefEscluseA.json"], "[\"esclusa\"]");
    assert.strictEqual(u.percorsoConteggio(), DATI + "/listaRefConteggioA.json");
    assert.strictEqual(d.file[DATI + "/listaRefConteggioA.json"], "[\"contata\"]");
    assert.strictEqual(d.file[DATI + "/listaRefEscluse.json"], "[\"esclusa\"]");
});

test("il file del documento che c'e' gia' non si sovrascrive col file unico", () => {
    const d = disco({ [DATI + "/listaRefEscluse.json"]: "[\"vecchia\"]", [DATI + "/listaRefEscluseA.json"]: "[\"mia\"]" });
    utilityCon(d, "A.indd", true).percorsoRefEscluse();
    assert.strictEqual(d.file[DATI + "/listaRefEscluseA.json"], "[\"mia\"]");
    assert.deepStrictEqual(d.scritture, []);
});

test("senza file unico non si crea niente, e un errore di copia non ferma la lettura", () => {
    const d = disco();
    assert.strictEqual(utilityCon(d, "A.indd", true).percorsoConteggio(), DATI + "/listaRefConteggioA.json");
    assert.deepStrictEqual(d.scritture, []);

    const rotto = disco({ [DATI + "/listaRefConteggio.json"]: "[1]" });
    rotto.fs.writeFileSync = () => { throw new Error("disco pieno"); };
    const u = utilityCon(rotto, "A.indd", true);
    assert.strictEqual(u.percorsoConteggio(), DATI + "/listaRefConteggioA.json");
    assert.strictEqual(u.errori.length, 1);
});

/* ---- la copia da un'altra postazione ---- */

test("i file di lavoro da copiare comprendono conteggio ed escluse del documento", () => {
    const d = disco({
        [DATI + "/listaRefConteggioA.json"]: "[]", [DATI + "/listaRefEscluseA.json"]: "[]",
        [DATI + "/listaRefConteggioB.json"]: "[]", [DATI + "/FiltriA.json"]: "[]"
    });
    const nomi = utilityCon(d, "A.indd", true).fileDiLavoro(DATI, 7, "A.indd").sort();
    assert.deepStrictEqual(nomi, ["FiltriA.json", "listaRefConteggioA.json", "listaRefEscluseA.json"]);
});

/* ---- chi usa cosa, sul sorgente ---- */

test("nessuno legge o scrive piu' conteggio ed escluse col nome fisso", () => {
    for (const file of ["griglia.js", "filtri.js", "indexNew.js"]) {
        const codice = leggiFileDelPlugin(file);
        assert.doesNotMatch(codice, /percorsoDati\("listaRefConteggio\.json"\)/, file);
        assert.doesNotMatch(codice, /percorsoDati\("listaRefEscluse\.json"\)/, file);
    }
    const griglia = leggiFileDelPlugin("griglia.js");
    assert.match(griglia, /Utility\.percorsoConteggio\(\)/);
    assert.match(griglia, /Utility\.percorsoRefEscluse\(\)/);
});

test("i filtri usano la stessa regola di conteggio ed escluse", () => {
    const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
    assert.match(filtri, /getNomeFileFiltriJson\(\)\{\s*return Utility\.percorsoFiltri\(\);\s*\}/);
});
