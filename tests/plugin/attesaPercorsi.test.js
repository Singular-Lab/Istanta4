/*
 * I20-1016: all'apertura di un documento il Plugin aspetta i quattro percorsi di sistema.
 *
 * La riga era "while (await !checkPercorsi())": await applicato alla NEGAZIONE della promise,
 * che vale sempre false. Il ciclo non girava mai e si tirava dritto senza percorsi; e siccome
 * la promise non veniva attesa, un errore dentro checkPercorsi non arrivava a nessuno.
 *
 * indexNew.js non si carica sotto Node: qui si guarda il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");

const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(nome) {
    return leggiFileDelPlugin(nome).replace(/\r/g, "");
}

//Il corpo di una funzione di primo livello: dalla sua dichiarazione alla successiva.
function corpoDi(testo, nome) {
    const inizio = testo.indexOf("async function " + nome + "(");
    assert.ok(inizio >= 0, nome + " non trovata");
    const fine = testo.indexOf("\nasync function ", inizio + 1);
    const fineSincrona = testo.indexOf("\nfunction ", inizio + 1);
    const candidati = [fine, fineSincrona].filter(i => i > 0);
    return testo.slice(inizio, candidati.length > 0 ? Math.min(...candidati) : testo.length);
}

//Le righe di codice, senza quelle commentate.
function righeDiCodice(testo) {
    return testo.split("\n").filter(riga => !/^\s*\/\//.test(riga));
}

//initLibroInLavorazione e' rimasta com'era su richiesta: e' l'unica eccezione ammessa, e
//la si nomina qui perche' nessun'altra ci si aggiunga senza che qualcuno lo decida.
const ECCEZIONI_AMMESSE = [
    { file: "indexNew.js", riga: "let _resTest = await !checkPercorsi(/*_itemTrovati[0]*/);" }
];

test("nel Plugin nessun await e' applicato a una negazione", () => {
    //I20-1009: anche nelle sottocartelle dei concetti, non solo in radice.
    const file = fileDelPlugin();
    assert.ok(file.length > 20);
    assert.ok(file.some(nome => nome.includes("/")), "le sottocartelle vanno guardate");

    const trovati = [];
    for (const nome of file) {
        for (const riga of righeDiCodice(sorgente(nome))) {
            if (/\bawait\s*!/.test(riga) &&
                !ECCEZIONI_AMMESSE.some(e => e.file === nome && riga.trim() === e.riga)) {
                trovati.push(nome + ": " + riga.trim());
            }
        }
    }
    assert.deepStrictEqual(trovati, []);
});

test("l'eccezione del libro c'e' ancora: se sparisce, va tolta anche dall'elenco", () => {
    const righe = righeDiCodice(sorgente("indexNew.js")).map(r => r.trim());
    for (const eccezione of ECCEZIONI_AMMESSE) {
        assert.ok(righe.includes(eccezione.riga), eccezione.riga);
    }
});

test("initDocumentInLavorazione aspetta il risultato di checkPercorsi", () => {
    const corpo = righeDiCodice(corpoDi(sorgente("indexNew.js"), "initDocumentInLavorazione")).join("\n");

    assert.match(corpo, /while \(docInLavorazione === docAtteso && !\(await checkPercorsi\(\)\)\) \{\s*await Utility\.sleep\(1000\);\s*\}/);
});

test("l'attesa si interrompe se cambia il documento, e allora non si prosegue", () => {
    const corpo = righeDiCodice(corpoDi(sorgente("indexNew.js"), "initDocumentInLavorazione")).join("\n");

    const memorizza = corpo.indexOf("const docAtteso = docInLavorazione;");
    const ciclo = corpo.indexOf("while (docInLavorazione === docAtteso");
    const uscita = corpo.search(/if \(docInLavorazione !== docAtteso\) \{\s*(\/\/[^\n]*\s*)?return;/);
    const loghi = corpo.indexOf("checkForLoghiCore();");

    assert.ok(memorizza >= 0 && memorizza < ciclo, "docAtteso va preso prima del ciclo");
    assert.ok(uscita > ciclo, "l'uscita va dopo il ciclo");
    assert.ok(loghi > uscita, "checkForLoghiCore va dopo l'uscita");
});

test("un errore di checkPercorsi arriva all'operatore come IDX-167", () => {
    const corpo = righeDiCodice(corpoDi(sorgente("indexNew.js"), "initDocumentInLavorazione")).join("\n");

    const prova = corpo.indexOf("try {", corpo.indexOf("const docAtteso"));
    const ciclo = corpo.indexOf("while (docInLavorazione === docAtteso");
    const cattura = corpo.indexOf("catch (e) {", ciclo);

    assert.ok(prova >= 0 && prova < ciclo, "il ciclo sta dentro il try");
    assert.ok(cattura > ciclo);
    assert.match(corpo.slice(cattura, cattura + 600), /messaggioUtente\("Code IDX-167 [^"]*" \+ e, "error"\)/);
});

test("il codice IDX-167 e' usato una volta sola", () => {
    const occorrenze = sorgente("indexNew.js").match(/Code IDX-167\b/g) || [];
    assert.strictEqual(occorrenze.length, 1);
});
