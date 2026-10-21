/*
 * I20-1104: i messaggi della console nati impaginando un box dicono da quale box vengono, e "Trova"
 * ci porta.
 *
 * Prima un errore o un avviso dell'impaginazione (CssFramework, sistemazione foto, campi, loghi)
 * finiva nella console senza dire il box: bisognava cercarlo a mano. Ora impaginaBox e' un involucro
 * che imposta il contesto del box per tutta l'impaginazione (un punto solo, non chiamata per
 * chiamata), messaggioUtente lo legge, e la console mostra gruppo, pagina e Trova.
 *
 * indexNew.js fa require('indesign') e non si carica sotto Node: le funzioni nuove si prendono dal
 * sorgente e si eseguono con box e documenti finti; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function corpoDi(firma) {
    const inizio = indexNew.indexOf(firma);
    assert.ok(inizio >= 0, "manca " + firma);
    return indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio) + 2);
}

//La funzione presa dal sorgente, eseguibile: le globali che usa si passano per nome.
function funzione(nome, globali = {}) {
    const sorgente = corpoDi("function " + nome + "(");
    const nomi = Object.keys(globali);
    return new Function(...nomi, sorgente + "\nreturn " + nome + ";")(...nomi.map(n => globali[n]));
}

function boxFinto(id, pagina) {
    return { id: id, isValid: true, parentPage: pagina != null ? { name: pagina } : null };
}

/* ---- il riferimento al box ---- */

const riferimentoBoxDelMessaggio = funzione("riferimentoBoxDelMessaggio");

test("fuori dall'impaginazione un messaggio non ha box", () => {
    assert.strictEqual(riferimentoBoxDelMessaggio(null), null);
});

test("il riferimento legge il box di adesso: rifatto durante l'impaginazione, l'id e' quello nuovo", () => {
    let box = boxFinto(101, "4");
    const contesto = { codiceGruppo: "6322946,6322965", pagina: "4", documento: "volantino.indd", leggiBox: () => box };

    assert.deepStrictEqual(riferimentoBoxDelMessaggio(contesto), { codiceGruppo: "6322946,6322965", idBox: 101, pagina: "4", documento: "volantino.indd" });
    box = boxFinto(205, "4");
    assert.strictEqual(riferimentoBoxDelMessaggio(contesto).idBox, 205);
});

test("prima che il box esista, o se non si legge, restano gruppo e pagina dell'impaginazione", () => {
    const senzaBox = { codiceGruppo: "6322946", pagina: "7", documento: "v.indd", leggiBox: null };
    assert.deepStrictEqual(riferimentoBoxDelMessaggio(senzaBox), { codiceGruppo: "6322946", idBox: null, pagina: "7", documento: "v.indd" });

    const rotto = { codiceGruppo: "6322946", pagina: "7", documento: "v.indd", leggiBox: () => { throw new Error("box non valido"); } };
    assert.strictEqual(riferimentoBoxDelMessaggio(rotto).idBox, null);

    const nonValido = { codiceGruppo: "6322946", pagina: "7", documento: "v.indd", leggiBox: () => ({ id: 9, isValid: false }) };
    assert.strictEqual(riferimentoBoxDelMessaggio(nonValido).idBox, null);
});

test("la pagina e' quella del box, se si legge", () => {
    const contesto = { codiceGruppo: "1", pagina: "4", documento: "v.indd", leggiBox: () => boxFinto(3, "5") };
    assert.strictEqual(riferimentoBoxDelMessaggio(contesto).pagina, "5");
});

/* ---- il testo nella console ---- */

const testoBoxDelMessaggio = funzione("testoBoxDelMessaggio");

test("la console dice gruppo e pagina, e niente per i messaggi senza box", () => {
    assert.strictEqual(testoBoxDelMessaggio({ codiceGruppo: "6322946,6322965", pagina: "4" }), "Gruppo 6322946,6322965 · pag. 4");
    assert.strictEqual(testoBoxDelMessaggio({ codiceGruppo: "6322946", pagina: null }), "Gruppo 6322946");
    assert.strictEqual(testoBoxDelMessaggio(undefined), "");
    assert.strictEqual(testoBoxDelMessaggio({ codiceGruppo: "" }), "");
});

/* ---- Trova ---- */

const cercaBoxDelMessaggio = funzione("cercaBoxDelMessaggio");

function documentoFinto(nome, elementi) {
    return {
        name: nome,
        pageItems: { itemByID: (id) => elementi.find(e => e.id === id && e.primoLivello) || { isValid: false } },
        allPageItems: elementi
    };
}

test("Trova trova il box per id, anche fra gli elementi annidati", () => {
    const box = Object.assign(boxFinto(101, "4"), { primoLivello: true });
    const annidato = boxFinto(300, "6");
    const doc = documentoFinto("volantino.indd", [box, annidato]);

    assert.deepStrictEqual(cercaBoxDelMessaggio({ idBox: 101, documento: "volantino.indd" }, doc), { esito: "trovato", box: box });
    assert.strictEqual(cercaBoxDelMessaggio({ idBox: 300, documento: "volantino.indd" }, doc).box, annidato);
});

test("un box rifatto o cancellato non c'e' piu', e Trova lo dice", () => {
    const doc = documentoFinto("volantino.indd", [Object.assign(boxFinto(205, "4"), { primoLivello: true })]);
    assert.deepStrictEqual(cercaBoxDelMessaggio({ idBox: 101, documento: "volantino.indd" }, doc), { esito: "assente" });
    assert.deepStrictEqual(cercaBoxDelMessaggio({ idBox: null }, doc), { esito: "assente" });
});

test("un messaggio di un altro documento, o senza documento aperto, non cerca nel posto sbagliato", () => {
    const doc = documentoFinto("pop.indd", [Object.assign(boxFinto(101, "1"), { primoLivello: true })]);
    assert.deepStrictEqual(cercaBoxDelMessaggio({ idBox: 101, documento: "volantino.indd" }, doc), { esito: "altroDocumento" });
    assert.deepStrictEqual(cercaBoxDelMessaggio({ idBox: 101, documento: "volantino.indd" }, null), { esito: "nessunDocumento" });
});

test("Trova porta al box come le segnalazioni, e per gli altri casi dice perche' no", () => {
    const trova = corpoDi("function trovaBoxDelMessaggio(");
    assert.match(trova, /if \(trovato\.esito === "trovato"\) \{\s*SchermataSegnalazioni\._selezionaBox\(trovato\.box\);/);
    assert.match(trova, /Code IDX-184 /);
    assert.match(trova, /Code IDX-185 /);
    assert.match(trova, /Code IDX-186 Il box del gruppo " \+ gruppo \+ " non c'e' piu' nel documento: e' stato rifatto o cancellato/);
});

/* ---- un punto solo ---- */

test("impaginaBox imposta il contesto per tutta l'impaginazione e lo rimette com'era in ogni caso", () => {
    const involucro = corpoDi("async function impaginaBox(");
    assert.match(involucro, /var contestoPrecedente = contestoBoxInImpaginazione;\s*contestoBoxInImpaginazione = contestoDelBox\(itemRef, pagCoinvolta, altri\[6\]\);/);
    assert.match(involucro, /try \{\s*return await impaginaBoxNelContesto\(meccanica, pagCoinvolta, bounds, itemRef, \.\.\.altri\);\s*\}\s*finally \{\s*contestoBoxInImpaginazione = contestoPrecedente;\s*\}/);

    //altri[6] e' docOperazione: i parametri del corpo dopo itemRef.
    const firma = indexNew.match(/async function impaginaBoxNelContesto\(meccanica, pagCoinvolta, bounds, itemRef, ([^)]*)\)/)[1].split(",").map(p => p.trim().split(" ")[0]);
    assert.strictEqual(firma[6], "docOperazione");
});

test("il corpo dice al contesto come leggere il box appena ha la sua variabile", () => {
    const corpo = corpoDi("async function impaginaBoxNelContesto(");
    const variabile = corpo.indexOf("var boxImpaginato = null;");
    const lettura = corpo.indexOf("if (contestoBoxInImpaginazione != null) contestoBoxInImpaginazione.leggiBox = function () { return boxImpaginato; };");
    assert.ok(variabile > 0 && lettura > variabile);
});

test("messaggioUtente aggiunge il box al messaggio della console e del log", () => {
    const messaggio = corpoDi("async function messaggioUtente(");
    const riferimento = messaggio.indexOf("var boxDelMessaggio = riferimentoBoxDelMessaggio(contestoBoxInImpaginazione);");
    const console = messaggio.indexOf("writeFileInConsole(logMessage);");
    assert.ok(riferimento > 0 && console > riferimento, "il box si aggiunge prima di scrivere console e log");
    assert.match(messaggio, /if \(boxDelMessaggio != null\) \{\s*logMessage\.box = boxDelMessaggio;\s*\}/);
});

test("la console mostra gruppo, pagina e Trova, e il copia se li porta dietro", () => {
    const scrivi = corpoDi("function writeFileInConsole(");
    assert.match(scrivi, /var testoBox = testoBoxDelMessaggio\(logMessage\.box\);/);
    assert.match(scrivi, /if \(logMessage\.box\.idBox != null\) \{/);
    assert.match(scrivi, />Trova<\/span>'\)\s*\.on\('click', function \(\) \{\s*trovaBoxDelMessaggio\(riferimentoBox\);/);
    assert.match(scrivi, /copyButton\.attr\("msg", msg \+ " \[" \+ contestoCopia \+ "\]"\);/);
});

test("Trova si vede: un riquadro col bordo bianco staccato dal testo, non una parola sottolineata (I20-1114)", () => {
    const scrivi = corpoDi("function writeFileInConsole(");
    const trova = scrivi.match(/<span class="trovaBoxMessaggio"[^>]*>Trova<\/span>/);
    assert.ok(trova, "manca il Trova");
    assert.match(trova[0], /role="button"/);
    assert.match(trova[0], /border: 1px solid white;/);
    assert.match(trova[0], /border-radius: 4px;/);
    assert.match(trova[0], /margin-left: 6px;/);
    assert.match(trova[0], /padding: 1px 8px;/);
    assert.doesNotMatch(trova[0], /text-decoration: underline/);
});
