/*
 * I20-1007: i moduli piccoli del Plugin sono andati dove sta il loro concetto.
 *
 * barraScorrimento.js e dissolvenza.js stanno in reportIntegrita/, accanto a pannelli.js che li
 * usa; i tre moduli puri del motore CSS stanno in cssFramework/, senza il prefisso css;
 * trattiDescrizione.js e' diventato una parte di testoTag.js, che si carica sotto Node.
 * Qui si prova che i vecchi file non ci sono piu', che nessuno li chiede, e che ogni require
 * relativo del Plugin trova il suo file.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const CARTELLA_PLUGIN = path.join(__dirname, "..", "..", "plugin");

const SPOSTATI = {
    "barraScorrimento.js": "reportIntegrita/barraScorrimento.js",
    "dissolvenza.js": "reportIntegrita/dissolvenza.js",
    "cssComposizioneBox.js": "cssFramework/composizioneBox.js",
    "cssRegoleConflitti.js": "cssFramework/regoleConflitti.js",
    "cssSequenzaOperazioni.js": "cssFramework/sequenzaOperazioni.js",
    "trattiDescrizione.js": "testoTag.js"
};

//Il sorgente senza commenti, di riga e a blocco.
function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

//I file che possono fare require: il core e le agenzie, che si montano in radice.
function fileConRequire() {
    const agenzie = fs.readdirSync(path.join(CARTELLA_PLUGIN, "Agenzie"))
        .map(nome => "Agenzie/" + nome + "/custom.js")
        .filter(relativo => fs.existsSync(path.join(CARTELLA_PLUGIN, relativo)));
    return fileDelPlugin().map(relativo => ({ relativo, cartella: path.dirname(relativo) }))
        .concat(agenzie.map(relativo => ({ relativo, cartella: "." })));
}

test("i vecchi file non ci sono piu', e i nuovi si'", () => {
    for (const [vecchio, nuovo] of Object.entries(SPOSTATI)) {
        assert.ok(!fs.existsSync(path.join(CARTELLA_PLUGIN, vecchio)), vecchio + " e' ancora in radice");
        assert.ok(fs.existsSync(path.join(CARTELLA_PLUGIN, nuovo)), nuovo);
    }
});

//Un require che non trova il file in UXP ferma il caricamento del pannello, e sotto Node si
//vedrebbe solo se un test caricasse proprio quel file. Qui si guardano tutti.
test("ogni require relativo del Plugin trova il suo file", () => {
    const mancanti = [];

    for (const { relativo, cartella } of fileConRequire()) {
        const codice = senzaCommenti(leggiFileDelPlugin(relativo));
        for (const m of codice.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
            const base = path.join(CARTELLA_PLUGIN, cartella, m[1]);
            const trovato = [base, base + ".js", base + ".json", path.join(base, "index.js")]
                .some(candidato => fs.existsSync(candidato) && fs.statSync(candidato).isFile());
            if (!trovato) {
                mancanti.push(relativo + ": " + m[0]);
            }
        }
    }
    assert.deepStrictEqual(mancanti, []);
});

test("i moduli spostati si caricano sotto Node, senza require('indesign')", () => {
    for (const nuovo of Object.values(SPOSTATI)) {
        const modulo = require(path.join(CARTELLA_PLUGIN, nuovo));
        assert.ok(modulo != null && Object.keys(modulo).length > 0, nuovo);
        const testa = senzaCommenti(leggiFileDelPlugin(nuovo)).split("\n").filter(riga => /^\S/.test(riga)).join("\n");
        assert.doesNotMatch(testa, /^(const|let|var)\b.*require\(['"]indesign['"]\)/m, nuovo);
    }
});

//trattiDescrizione e' diventato una parte di TestoTag: stesse funzioni, chiamate col suo nome.
test("i tratti di stile sono membri di TestoTag, e la scheda li chiama cosi'", () => {
    const TestoTag = require(path.join(CARTELLA_PLUGIN, "testoTag.js"));
    for (const nome of ["nomeCompletoStile", "accorpa", "stiliInOrdine", "testiDelTratto"]) {
        assert.strictEqual(typeof TestoTag[nome], "function", nome);
    }
    assert.strictEqual(TestoTag.nomeCompletoStile("Prezzo", "A"), "A.Prezzo");

    const scheda = senzaCommenti(leggiFileDelPlugin("schedaRef.js"));
    assert.match(scheda, /^const TestoTag = require\('\.\/testoTag'\);$/m);
    assert.match(scheda, /TestoTag\.stiliInOrdine\(/);
    assert.match(scheda, /TestoTag\.testiDelTratto\(/);

    const testoTag = senzaCommenti(leggiFileDelPlugin("testoTag.js"));
    assert.match(testoTag, /TestoTag\.nomeCompletoStile\(nome, gruppo\)/);
    assert.match(testoTag, /return TestoTag\.accorpa\(tratti\);/);
});

test("nessuno chiama piu' trattiDescrizione per nome", () => {
    const trovate = [];
    for (const { relativo } of fileConRequire()) {
        for (const riga of senzaCommenti(leggiFileDelPlugin(relativo)).split("\n")) {
            if (/\btrattiDescrizione\b/.test(riga)) {
                trovate.push(relativo + ": " + riga.trim());
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});
