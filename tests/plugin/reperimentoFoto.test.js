/*
 * I20-1015: procurarsi la foto giusta vive in plugin/reperimentoFoto/. Qui si prova che la
 * divisione tiene.
 *
 * Il concetto era sparso su sette file. Ora la parte foto della scheda sta in schedaFoto.js,
 * mescolata in schedaRef - un oggetto solo, un solo this -; le operazioni su disco e server in
 * reperimentoFoto.js; lo scaricamento in scaricamento.js (ex cmd.js); FotoPlacer in fotoPlacer.js,
 * riesportato da utility.js per chi lo prende da li'; e le tre regole pure accanto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const DA_INDEXNEW = ["apriSchermataSyncPacchettoFoto", "fotoPresenteNeiLinks", "scriviFileInCartella",
    "impaginaFotoAppenaDisponibile", "getInfoFotoDalServer", "scaricaFotoSingolaNeiLinks",
    "assicuraFotoNeiLinks", "avviaSyncPacchettoFoto", "abortSyncPacchettoFotoFunction", "getFotoData",
    "ricollegaFotoMassivo"];
const DA_UTILITY = ["getBolloNOFOTO", "getBolloFOTONOFOUND", "getNomeFotoLogoBolloBySigla", "getLinkHash"];

//Il sorgente senza commenti, di riga e a blocco.
function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
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

/* ---- la parte foto della scheda ---- */

test("la parte foto e' mescolata nella scheda: stessi membri, stesso oggetto", () => {
    const schedaRef = require("../../plugin/schedaRef.js");
    const schedaFoto = require("../../plugin/reperimentoFoto/schedaFoto.js");

    assert.ok(Object.keys(schedaFoto).length >= 36);
    for (const nome of Object.keys(schedaFoto)) {
        assert.strictEqual(schedaRef[nome], schedaFoto[nome], nome);
    }
});

test("scheda e parte foto non definiscono lo stesso membro due volte", () => {
    const scheda = membriDelFile(leggiFileDelPlugin("schedaRef.js"));
    const foto = membriDelFile(leggiFileDelPlugin("reperimentoFoto/schedaFoto.js"));

    assert.deepStrictEqual([...foto].filter(n => scheda.has(n)), []);
});

//In schedaRef.js il nome del modulo era la costante del file; in schedaFoto.js non c'e'. Una
//chiamata schedaRef.metodo(...) li' dentro in UXP funzionerebbe per caso, grazie alla globale di
//indexNew, e sotto Node si romperebbe. Le variabili locali che si chiamano schedaRef - l'elenco dei
//record - vanno bene.
test("schedaFoto non chiama la scheda per nome: usa this", () => {
    const schedaRef = require("../../plugin/schedaRef.js");
    const metodi = new Set(Object.keys(schedaRef).filter(n => typeof schedaRef[n] === "function"));
    const trovate = [];

    for (const riga of senzaCommenti(leggiFileDelPlugin("reperimentoFoto/schedaFoto.js")).split("\n")) {
        for (const m of riga.matchAll(/(?<![\w.$])schedaRef\.([A-Za-z_$][\w$]*)\s*\(/g)) {
            if (metodi.has(m[1])) {
                trovate.push(riga.trim());
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

/* ---- le operazioni ---- */

test("reperimentoFoto.js ha le undici funzioni di indexNew e i quattro membri di Utility", () => {
    const membri = membriDelFile(leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js"));

    for (const nome of [...DA_INDEXNEW, ...DA_UTILITY]) {
        assert.ok(membri.has(nome), nome);
    }
});

test("indexNew non definisce piu' le funzioni foto, e utility non ha piu' i bolli e getLinkHash", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js");
    for (const nome of DA_INDEXNEW) {
        assert.doesNotMatch(indexNew, new RegExp("^(async )?function " + nome + "\\(", "m"), nome);
    }

    const utility = membriDelFile(leggiFileDelPlugin("utility.js"));
    for (const nome of DA_UTILITY) {
        assert.ok(!utility.has(nome), nome + " e' ancora in utility.js");
    }
});

test("nessun file chiama piu' le funzioni foto come globali, ne' come membri di Utility", () => {
    const trovate = [];
    for (const relativo of fileDelPlugin().concat(["index.html"])) {
        const righe = senzaCommenti(leggiFileDelPlugin(relativo)).split("\n");
        for (const riga of righe) {
            if (/^ {4}(?:async\s+)?[a-zA-Z_$][\w$]*\s*\(/.test(riga)) {
                continue;
            }
            for (const nome of DA_INDEXNEW) {
                if (new RegExp("(?<![\\w.$])" + nome + "\\(").test(riga)) {
                    trovate.push(relativo + ": " + riga.trim());
                }
            }
            for (const nome of DA_UTILITY) {
                if (new RegExp("\\bUtility\\." + nome + "\\b").test(riga)) {
                    trovate.push(relativo + ": " + riga.trim());
                }
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

//La regola di CssFramework, qui sulle operazioni: un membro chiamato senza this, o senza
//ReperimentoFoto davanti, non esiste come funzione globale e lancia ReferenceError. Vale di piu'
//per le undici funzioni arrivate da indexNew.js, dove si chiamavano proprio cosi'.
test("in reperimentoFoto.js nessun membro viene chiamato come una globale", () => {
    const testo = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
    const membri = membriDelFile(testo);
    const locali = new Set([...testo.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)].map(m => m[1]));
    const trovate = [];

    testo.split("\n").forEach((riga, numero) => {
        const spoglia = riga.trim();
        if (spoglia.startsWith("//") || spoglia.startsWith("*") || /^ {4}(?:async\s+)?[a-zA-Z_$][\w$]*\s*[:(]/.test(riga)) {
            return;
        }
        for (const m of riga.matchAll(/(?<![\w.$])([a-zA-Z_$][\w$]*)\s*\(/g)) {
            if (membri.has(m[1]) && !locali.has(m[1])) {
                trovate.push((numero + 1) + "  " + spoglia);
            }
        }
    });
    assert.deepStrictEqual(trovate, []);
});

/* ---- scaricamento e FotoPlacer ---- */

test("cmd.js e' diventato scaricamento.js, e nessuno lo chiama piu' cmd", () => {
    const nomi = fileDelPlugin();
    assert.ok(!nomi.includes("cmd.js"));
    assert.ok(nomi.includes("reperimentoFoto/scaricamento.js"));

    const trovate = [];
    for (const relativo of nomi) {
        for (const riga of senzaCommenti(leggiFileDelPlugin(relativo)).split("\n")) {
            if (/(?<![\w.$])cmd\.[A-Za-z_]/.test(riga) || /require\(['"]\.\/cmd['"]\)/.test(riga)) {
                trovate.push(relativo + ": " + riga.trim());
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
    assert.match(leggiFileDelPlugin("indexNew.js"), /const scaricamentoFoto = require\('\.\/reperimentoFoto\/scaricamento'\);/);
});

//Le agenzie (Agenzie/*/custom.js) e il core prendono FotoPlacer con require('./utility'): deve
//continuare a dare lo stesso oggetto.
test("utility.js riesporta FotoPlacer da reperimentoFoto/", () => {
    const utility = senzaCommenti(leggiFileDelPlugin("utility.js"));

    assert.match(utility, /const FotoPlacer = require\('\.\/reperimentoFoto\/fotoPlacer'\);/);
    assert.match(utility, /module\.exports\.FotoPlacer = FotoPlacer;/);
    assert.doesNotMatch(utility, /const FotoPlacer\s*=\s*\{/);

    const fotoPlacer = membriDelFile(leggiFileDelPlugin("reperimentoFoto/fotoPlacer.js"));
    for (const nome of ["placeFoto", "applicaNoRender", "updateFoto"]) {
        assert.ok(fotoPlacer.has(nome), nome);
    }
});

/* ---- le regole pure ---- */

test("le tre regole pure si caricano sotto Node senza aiuti", () => {
    for (const nome of ["autoSync", "cacheHash", "dataCaricamento"]) {
        const modulo = require("../../plugin/reperimentoFoto/" + nome + ".js");
        assert.ok(modulo != null && Object.keys(modulo).length > 0, nome);
        assert.doesNotMatch(senzaCommenti(leggiFileDelPlugin("reperimentoFoto/" + nome + ".js")), /require\(['"]indesign['"]\)/, nome);
    }
});

test("le funzioni foto non compaiono mai nude, nemmeno passate come valore", () => {
    assert.deepStrictEqual(nomiNudi([...DA_INDEXNEW, ...DA_UTILITY]), []);
});

test("il controllo riconosce davvero un nome passato come valore", () => {
    const finto = "var esito = f({ infoFoto: getInfoFotoDalServer, testo: \"getInfoFotoDalServer\" });";
    assert.match(soloCodice(finto), /infoFoto: getInfoFotoDalServer/);
    assert.doesNotMatch(soloCodice(finto), /"getInfoFotoDalServer"/);
});
