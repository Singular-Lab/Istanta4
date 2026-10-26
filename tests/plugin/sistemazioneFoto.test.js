/*
 * I20-1009: la sistemazione delle foto e' uscita da CssFramework.js e vive in
 * plugin/sistemazioneFoto/. Qui si prova che la divisione tiene.
 *
 * Tre cose. La parte pura, spazioLibero.js, si carica sotto Node senza nessun aiuto: e' il
 * guadagno vero dell'operazione. CssFramework tiene tre rimandi - getSpazioImpaginazione,
 * fixFoto, safeFitToContent - perche' le agenzie li chiamano da li', e i rimandi arrivano
 * davvero al modulo. E il core non chiama piu' la sistemazione delle foto passando da
 * CssFramework: chi scrive codice nuovo deve trovare un solo modo di farlo.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

//I membri che sono usciti da CssFramework. Tre restano come rimandi.
const SPOSTATI_IN_SISTEMAZIONE_FOTO = [
    "calcoloDistanziamentoFoto", "getSpazioImpaginazione", "calcolaSpazioLibero", "trovaBase",
    "segnalaBaseMancante", "codiceGruppoDelBox", "ripristinaFit", "ripristinaOstacoli", "getObstacles",
    "safeFitToContent", "fixFoto", "eseguiFixFoto", "scalaDellaFoto", "normalizzaScalaDelleFoto",
    "getRaggruppamentoFoto", "approachOne", "getVertex", "getRealBoundsOfFoto"
];
const SPOSTATI_IN_SPAZIO_LIBERO = [
    "generateCandidateRects", "refineRects", "intersectRect", "removeDuplicateRects",
    "removeRectsToSmall", "reduceResult"
];
const RIMANDI = ["getSpazioImpaginazione", "fixFoto", "safeFitToContent"];

function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

/* ---- la parte pura ---- */

test("spazioLibero si carica sotto Node senza sostituire niente", () => {
    const spazioLibero = require("../../plugin/sistemazioneFoto/spazioLibero.js");

    for (const membro of SPOSTATI_IN_SPAZIO_LIBERO) {
        assert.strictEqual(typeof spazioLibero[membro], "function", membro);
    }
    assert.doesNotMatch(senzaCommenti(leggiFileDelPlugin("sistemazioneFoto/spazioLibero.js")), /require\(/);
});

test("spazioLibero non legge la globale customAgenzia: il margine gli arriva come parametro", () => {
    const spazioLibero = require("../../plugin/sistemazioneFoto/spazioLibero.js");
    const ostacolo = [{ x: 40, y: 30, width: 20, height: 20 }];

    const predefinito = spazioLibero.generateCandidateRects(100, 80, ostacolo, 0);
    const senzaMargine = spazioLibero.generateCandidateRects(100, 80, ostacolo, 0, [0, 0, 0, 0]);

    assert.doesNotMatch(senzaCommenti(leggiFileDelPlugin("sistemazioneFoto/spazioLibero.js")), /customAgenzia/);
    //Il margine predefinito e' negativo, [-2,-2,-2,-2]: restringe i candidati di 2 per lato.
    const sopraPredefinito = predefinito.find(r => r.direction === "sopra");
    const sopraSenzaMargine = senzaMargine.find(r => r.direction === "sopra");
    assert.strictEqual(sopraSenzaMargine.width - sopraPredefinito.width, 4);
});

/* ---- i rimandi di CssFramework ---- */

function caricaConStub() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return {};
        }
        return originale.apply(this, arguments);
    };
    try {
        return {
            CssFramework: require("../../plugin/CssFramework.js"),
            SistemazioneFoto: require("../../plugin/sistemazioneFoto/sistemazioneFoto.js")
        };
    }
    finally {
        Module._load = originale;
    }
}

test("i rimandi di CssFramework arrivano al modulo, con gli stessi argomenti e lo stesso risultato", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();

    for (const membro of RIMANDI) {
        const vero = SistemazioneFoto[membro];
        const ricevuti = [];
        SistemazioneFoto[membro] = function (...argomenti) {
            ricevuti.push(argomenti);
            return "risposta di " + membro;
        };
        try {
            const risposta = CssFramework[membro]("a", "b", "c", "d");
            assert.strictEqual(risposta, "risposta di " + membro);
            assert.strictEqual(ricevuti.length, 1, membro);
            assert.strictEqual(ricevuti[0][0], "a", membro);
        }
        finally {
            SistemazioneFoto[membro] = vero;
        }
    }
});

test("fixFoto chiamato dal rimando senza projection lo passa come false", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const vero = SistemazioneFoto.fixFoto;
    let ricevuto = null;
    SistemazioneFoto.fixFoto = (box, candidati, ostacoli, projection) => { ricevuto = projection; };
    try {
        CssFramework.fixFoto("box", [], []);
    }
    finally {
        SistemazioneFoto.fixFoto = vero;
    }
    assert.strictEqual(ricevuto, false);
});

test("in CssFramework restano solo i tre rimandi: gli altri membri spostati non ci sono piu'", () => {
    const { CssFramework } = caricaConStub();

    for (const membro of [...SPOSTATI_IN_SISTEMAZIONE_FOTO, ...SPOSTATI_IN_SPAZIO_LIBERO]) {
        if (RIMANDI.includes(membro)) {
            continue;
        }
        assert.strictEqual(CssFramework[membro], undefined, membro + " e' ancora in CssFramework");
    }
});

/* ---- chi chiama ---- */

//Le agenzie restano libere di passare da CssFramework: e' per loro che i rimandi esistono.
//custom.js in radice e' la copia montata di un'agenzia.
test("il core non chiama piu' la sistemazione delle foto passando da CssFramework", () => {
    const trovate = [];
    for (const relativo of fileDelPlugin()) {
        if (relativo === "custom.js") {
            continue;
        }
        const righe = senzaCommenti(leggiFileDelPlugin(relativo)).split("\n");
        for (const riga of righe) {
            for (const membro of SPOSTATI_IN_SISTEMAZIONE_FOTO.concat(SPOSTATI_IN_SPAZIO_LIBERO)) {
                if (new RegExp("\\bCssFramework\\." + membro + "\\b").test(riga)) {
                    trovate.push(relativo + ": " + riga.trim());
                }
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

//CssFramework carica sistemazioneFoto in testa. Se sistemazioneFoto facesse lo stesso con
//CssFramework, il require reciproco troverebbe CssFramework ancora vuoto.
test("sistemazioneFoto chiede CssFramework solo al momento della chiamata", () => {
    const testo = senzaCommenti(leggiFileDelPlugin("sistemazioneFoto/sistemazioneFoto.js"));
    const richieste = testo.match(/require\(['"]\.\.\/CssFramework['"]\)/g) || [];

    assert.strictEqual(richieste.length, 1);
    assert.match(testo, /function cssFramework\(\) \{\s*return require\(['"]\.\.\/CssFramework['"]\);\s*\}/);
});

//I20-1009: dentro eseguiFixFoto una variabile locale si chiamava sceltaSpazio, come il modulo
//importato in testa. Nel blocco la variabile nascondeva il modulo, e il fix foto si rompeva con un
//ReferenceError al primo uso. Qui si cerca in tutto il Plugin una variabile locale con il nome di
//un modulo che lo stesso file importa con require.
//
//Nessun caso ammesso. C'era "var schedaRef = schedeRefs[i];" in applicaConfronto di indexNew.js,
//che nascondeva il modulo schedaRef importato li'; con I20-1014 applicaConfronto e' passata in
//reportIntegrita/reportIntegrita.js, che schedaRef non lo importa: la variabile non nasconde piu'
//niente. Un caso nuovo va aggiunto qui solo se qualcuno lo decide.
const NASCONDIMENTI_AMMESSI = [];

function moduliImportati(testo) {
    const moduli = new Set();
    for (const riga of testo.split("\n")) {
        const semplice = riga.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(/);
        if (semplice) {
            moduli.add(semplice[1]);
        }
        const destrutturato = riga.match(/^(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(/);
        if (destrutturato) {
            for (const parte of destrutturato[1].split(",")) {
                const nome = parte.split(":").pop().trim();
                if (nome) {
                    moduli.add(nome);
                }
            }
        }
    }
    return moduli;
}

function nascondimenti(relativo, testo) {
    const moduli = moduliImportati(testo);
    const trovati = [];
    for (const riga of testo.split("\n")) {
        if (!/^\s/.test(riga) || /^\s*\/\//.test(riga)) {
            continue;
        }
        for (const m of riga.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g)) {
            if (moduli.has(m[1]) &&
                !NASCONDIMENTI_AMMESSI.some(a => a.file === relativo && riga.trim() === a.riga)) {
                trovati.push(relativo + ": " + riga.trim());
            }
        }
    }
    return trovati;
}

test("nessuna variabile locale ha il nome di un modulo importato dallo stesso file", () => {
    const trovati = [];
    for (const relativo of fileDelPlugin()) {
        trovati.push(...nascondimenti(relativo, leggiFileDelPlugin(relativo).replace(/\r/g, "")));
    }
    assert.deepStrictEqual(trovati, []);
});

test("il controllo riconosce davvero una variabile che nasconde un modulo", () => {
    const finto = [
        "const sceltaSpazio = require('./sceltaSpazio');",
        "function fixFoto() {",
        "    let sceltaSpazio = sceltaSpazio.scegli([]);",
        "}"
    ].join("\n");

    assert.deepStrictEqual(nascondimenti("finto.js", finto), ["finto.js: let sceltaSpazio = sceltaSpazio.scegli([]);"]);
});

test("ogni caso ammesso c'e' ancora: se sparisce, va tolto anche dall'elenco", () => {
    for (const ammesso of NASCONDIMENTI_AMMESSI) {
        const righe = leggiFileDelPlugin(ammesso.file).replace(/\r/g, "").split("\n").map(r => r.trim());
        assert.ok(righe.includes(ammesso.riga), ammesso.file + ": " + ammesso.riga);
    }
});
