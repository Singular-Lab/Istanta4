/*
 * I20-1014: il Report Integrita' vive in plugin/reportIntegrita/, e confronti.js e' rimasto il
 * motore di confronto. Qui si prova che la divisione tiene.
 *
 * Il report era sparso su otto file. Ora il flusso sta in reportIntegrita.js, l'interfaccia in
 * pannelli.js - mescolata nello stesso oggetto, un solo this - e le quattro regole pure accanto.
 * confronti.js tiene i cinque membri che usano anche il cambio strutturale, la reimpaginazione,
 * la scheda e la griglia.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const MOTORE = ["confrontoBox", "confrontoBoxCompiledFieldPreAnalisi", "mappaturaImpaginato",
    "semplificazioneMappaImpaginato", "decodeSpecialCharacters"];
const DA_INDEXNEW = ["avviaReportIntegrita", "applicaConfronto", "preAnalisiBoxMappato",
    "nomiPagineDelDocumento", "boxDellElementoMappa"];
const FILE_DEL_REPORT = ["reportIntegrita/reportIntegrita.js", "reportIntegrita/pannelli.js"];

//Il sorgente senza commenti, di riga e a blocco: i nomi citati in un commento non sono codice.
function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

function caricaConStub() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return { app: {} };
        }
        return originale.apply(this, arguments);
    };
    try {
        return {
            confronti: require("../../plugin/confronti.js"),
            ReportIntegrita: require("../../plugin/reportIntegrita/reportIntegrita.js"),
            pannelli: require("../../plugin/reportIntegrita/pannelli.js")
        };
    }
    finally {
        Module._load = originale;
    }
}

//I membri di primo livello di un file fatto come oggetto: quattro spazi di rientro.
function membriDelFile(testo) {
    const membri = new Set();
    for (const riga of testo.replace(/\r/g, "").split("\n")) {
        const m = riga.match(/^ {4}(?:async\s+)?([a-zA-Z_$][\w$]*)\s*[:(]/);
        if (m) {
            membri.add(m[1]);
        }
    }
    return membri;
}

//Il sorgente senza commenti e senza stringhe: un nome dentro un messaggio non e' codice.
function soloCodice(testo) {
    return senzaCommenti(testo.replace(/<!--[\s\S]*?-->/g, ""))
        .replace(/`(?:\\.|[^`\\])*`/g, "``")
        .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
        .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

//I20-1015: le funzioni diventate membri si chiamano col nome dell'oggetto anche quando si
//passano come valore. Nel ponte, "infoFoto: getInfoFotoDalServer" era rimasto cosi': in UXP la
//globale non c'e' piu', e al primo cambio foto con la foto mancante partiva un ReferenceError.
function nomiNudi(nomi) {
    const trovati = [];
    for (const relativo of fileDelPlugin().concat(["index.html"])) {
        soloCodice(leggiFileDelPlugin(relativo)).split("\n").forEach(riga => {
            for (const nome of nomi) {
                if (new RegExp("^\\s*(async\\s+)?" + nome + "\\s*[:(]").test(riga)) {
                    continue;
                }
                if (new RegExp("(?<![\\w.$])" + nome + "\\b").test(riga)) {
                    trovati.push(relativo + ": " + riga.trim());
                }
            }
        });
    }
    return trovati;
}

/* ---- le due meta' ---- */

test("confronti.js e' rimasto il motore: cinque membri, nessuno del report", () => {
    const { confronti } = caricaConStub();
    assert.deepStrictEqual(Object.keys(confronti).sort(), [...MOTORE].sort());
});

test("il report e' un oggetto solo: i pannelli ci sono mescolati dentro", () => {
    const { ReportIntegrita, pannelli } = caricaConStub();

    for (const nome of Object.keys(pannelli)) {
        assert.strictEqual(ReportIntegrita[nome], pannelli[nome], nome);
    }
    for (const nome of [...DA_INDEXNEW, "chiudiSeNonValePiu", "percorsoFileReport", "etichettaSegnalazione"]) {
        assert.strictEqual(typeof ReportIntegrita[nome], "function", nome);
    }
    for (const nome of MOTORE) {
        assert.strictEqual(ReportIntegrita[nome], undefined, nome + " e' del motore, non del report");
    }
});

test("flusso e pannelli non definiscono lo stesso membro due volte", () => {
    const flusso = membriDelFile(leggiFileDelPlugin(FILE_DEL_REPORT[0]));
    const pannelli = membriDelFile(leggiFileDelPlugin(FILE_DEL_REPORT[1]));

    assert.deepStrictEqual([...flusso].filter(n => pannelli.has(n)), []);
});

test("pannelli.js chiama il flusso con this, e non importa il report", () => {
    const testo = senzaCommenti(leggiFileDelPlugin(FILE_DEL_REPORT[1]));

    assert.doesNotMatch(testo, /\bReportIntegrita\./);
    assert.doesNotMatch(testo, /require\(['"]\.\/reportIntegrita['"]\)/);
});

//La regola di CssFramework, qui sui due file insieme: un membro chiamato senza this non esiste
//come funzione globale e lancia ReferenceError. Vale di piu' per le cinque funzioni arrivate da
//indexNew.js, dove si chiamavano proprio cosi'.
test("nel report nessun membro viene chiamato senza this", () => {
    const testi = FILE_DEL_REPORT.map(f => leggiFileDelPlugin(f).replace(/\r/g, ""));
    const membri = new Set();
    testi.forEach(t => membriDelFile(t).forEach(m => membri.add(m)));
    const trovate = [];

    testi.forEach((testo, indice) => {
        const locali = new Set([...testo.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)].map(m => m[1]));
        testo.split("\n").forEach((riga, numero) => {
            const spoglia = riga.trim();
            if (spoglia.startsWith("//") || spoglia.startsWith("*") || /^ {4}(?:async\s+)?[a-zA-Z_$][\w$]*\s*[:(]/.test(riga)) {
                return;
            }
            for (const m of riga.matchAll(/(?<![\w.$])([a-zA-Z_$][\w$]*)\s*\(/g)) {
                if (membri.has(m[1]) && !locali.has(m[1])) {
                    trovate.push(FILE_DEL_REPORT[indice] + ":" + (numero + 1) + "  " + spoglia);
                }
            }
        });
    });
    assert.deepStrictEqual(trovate, []);
});

/* ---- chi chiama ---- */

test("il core non chiama piu' il report passando da confronti", () => {
    const { ReportIntegrita } = caricaConStub();
    const delReport = new Set(Object.keys(ReportIntegrita));
    const trovate = [];

    for (const relativo of fileDelPlugin().concat(["index.html"])) {
        const righe = senzaCommenti(leggiFileDelPlugin(relativo)).split("\n");
        for (const riga of righe) {
            for (const m of riga.matchAll(/(?<![\w.])confronti\.([A-Za-z_$][\w$]*)/g)) {
                if (delReport.has(m[1])) {
                    trovate.push(relativo + ": " + riga.trim());
                }
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

test("indexNew non definisce piu' le funzioni del report", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js");

    for (const nome of DA_INDEXNEW) {
        assert.doesNotMatch(indexNew, new RegExp("^(async )?function " + nome + "\\(", "m"), nome);
    }
});

test("events guarda a intervalli, ma a decidere la chiusura e' il report", () => {
    const events = senzaCommenti(leggiFileDelPlugin("events.js"));

    assert.match(events, /ReportIntegrita\.chiudiSeNonValePiu\(documentoAttuale\)/);
    assert.doesNotMatch(events, /deveChiudereReport/);
});

//Il sintomo che dava la misura del problema: indexNew ricostruiva a mano il percorso del file
//del report, come ripiego se il metodo privato di confronti non rispondeva.
test("il nome del file del report e' scritto in un posto solo", () => {
    let occorrenze = 0;
    for (const relativo of fileDelPlugin()) {
        //I20-1065: il nome sta in utility.js (nomeFileReportIntegrita), senza la barra: la cartella
        //la mette percorsoDati.
        occorrenze += (senzaCommenti(leggiFileDelPlugin(relativo)).match(/["']\/?reportIntegrita_["']/g) || []).length;
    }
    assert.strictEqual(occorrenze, 1);
    assert.doesNotMatch(leggiFileDelPlugin("reportIntegrita/reportIntegrita.js"), /_getReportIntegritaFilePath/);
});

test("le quattro regole pure si caricano sotto Node senza aiuti", () => {
    for (const nome of ["avvio", "sezioneConfronti", "csv", "conteggi"]) {
        const modulo = require("../../plugin/reportIntegrita/" + nome + ".js");
        assert.ok(Object.keys(modulo).length > 0, nome);
        assert.doesNotMatch(senzaCommenti(leggiFileDelPlugin("reportIntegrita/" + nome + ".js")), /require\(['"]indesign['"]\)/, nome);
    }
});

test("le funzioni arrivate da indexNew non compaiono mai nude, nemmeno passate come valore", () => {
    assert.deepStrictEqual(nomiNudi(DA_INDEXNEW), []);
});
