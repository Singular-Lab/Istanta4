/*
 * I20-1108: impaginando, se il documento non ha il livello InPagina, il Plugin lo crea e ci sposta
 * le meccaniche della mastro.
 *
 * Prima il livello arrivava solo dal modello del documento: se mancava, rendere attivo o usare
 * layers.itemByName("InPagina") dava un errore di InDesign e l'impaginazione si fermava. Ma il
 * livello porta anche le meccaniche (impaginaBox cerca i modelli dei box solo fra i gruppi di
 * InPagina nelle mastro "meccaniche"): creato vuoto, ogni box usciva con "Meccanica non trovata"
 * (prova dell'operatore con il livello rinominato in _InPagina). Ora assicuraLivelloInPagina lo
 * crea e ci sposta le meccaniche (IDX-187, IDX-189 per quelle che non si spostano); se non ci sono
 * meccaniche non crea niente e ferma l'impaginazione (IDX-190). Se il livello c'e' lo usa e basta.
 *
 * indexNew.js fa require('indesign') e non si carica sotto Node: la funzione si prende dal sorgente
 * e si esegue con un documento finto; i punti di chiamata si controllano sul sorgente.
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

//Una collezione InDesign: length e item(i).
function collezione(elementi) {
    return { length: elementi.length, item: (i) => elementi[i] };
}

//Un gruppo di una mastro sul livello indicato; se bloccato, cambiarne il livello da' errore come in InDesign.
function gruppo(label, livello, bloccato = false) {
    let suLivello = livello;
    return {
        label: label,
        get itemLayer() { return suLivello; },
        set itemLayer(nuovo) {
            if (bloccato) throw new Error("Il livello e' bloccato");
            suLivello = nuovo;
        }
    };
}

//Un documento con i livelli e le mastro indicati: itemByName restituisce un oggetto non valido se il
//livello manca, come InDesign; add mette il livello nuovo in cima.
function documentoFinto(nomiLivelli, mastro = []) {
    const livelli = nomiLivelli.map(n => ({ name: n, isValid: true }));
    return {
        livelli: livelli,
        livello: (nome) => livelli.find(l => l.name === nome),
        layers: {
            itemByName: (nome) => livelli.find(l => l.name === nome) || { name: nome, isValid: false },
            add: (proprieta) => {
                const livello = { name: proprieta.name, isValid: true };
                livelli.unshift(livello);
                return livello;
            }
        },
        masterSpreads: collezione(mastro.map(m => ({ baseName: m.nome, groups: collezione(m.gruppi) })))
    };
}

function assicuraLivello() {
    const messaggi = [];
    const sorgente = corpoDi("function assicuraLivelloInPagina(");
    const funzione = new Function("messaggioUtente", sorgente + "\nreturn assicuraLivelloInPagina;")(
        (testo, stile) => messaggi.push({ testo, stile }));
    return { funzione, messaggi };
}

/* ---- il livello e le meccaniche ---- */

test("con il livello InPagina gia' presente lo usa: niente livelli nuovi, niente spostamenti, niente avvisi", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["GRIGLIA", "InPagina", "Livello 1"]);
    const altrove = gruppo("BOX_STD", doc.livello("Livello 1"));
    doc.masterSpreads = collezione([{ baseName: "meccaniche", groups: collezione([altrove]) }]);

    const livello = funzione(doc);

    assert.strictEqual(livello, doc.livello("InPagina"));
    assert.strictEqual(doc.livelli.filter(l => l.name === "InPagina").length, 1);
    assert.strictEqual(altrove.itemLayer.name, "Livello 1");
    assert.deepStrictEqual(messaggi, []);
});

test("senza InPagina il Plugin lo crea in cima e ci sposta le meccaniche, come nella prova con _InPagina", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["GRIGLIA", "_InPagina"]);
    const vecchio = doc.livello("_InPagina");
    const sprint = gruppo("BOX_SPRINT", vecchio);
    const jolly = gruppo("BOX_JOLLY", vecchio);
    const std = gruppo("BOX_STD", vecchio);
    doc.masterSpreads = collezione([{ baseName: "meccaniche", groups: collezione([sprint, jolly, std]) }]);

    const livello = funzione(doc);

    assert.strictEqual(livello.name, "InPagina");
    assert.deepStrictEqual(doc.livelli.map(l => l.name), ["InPagina", "GRIGLIA", "_InPagina"]);
    assert.deepStrictEqual([sprint, jolly, std].map(g => g.itemLayer), [livello, livello, livello]);
    assert.deepStrictEqual(messaggi, [{ testo: "Code IDX-187 Il documento non aveva il livello InPagina: e' stato creato e ci sono state spostate 3 meccaniche dalla pagina mastro", stile: "warning" }]);
});

test("si spostano solo le meccaniche: gruppi con etichetta delle mastro meccaniche e delle loro declinazioni", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["Livello 1"]);
    const l1 = doc.livello("Livello 1");
    const meccanica = gruppo("BOX_STD", l1);
    const senzaEtichetta = gruppo("", l1);
    const declinata = gruppo("BOX_POP", l1);
    const altraMastro = gruppo("TESTATA", l1);

    doc.masterSpreads = collezione([
        { baseName: "Meccaniche", groups: collezione([meccanica, senzaEtichetta]) },
        { baseName: "meccaniche_pop", groups: collezione([declinata]) },
        { baseName: "Pagina", groups: collezione([altraMastro]) }
    ]);

    const livello = funzione(doc);

    assert.strictEqual(meccanica.itemLayer, livello);
    assert.strictEqual(declinata.itemLayer, livello);
    assert.strictEqual(senzaEtichetta.itemLayer, l1);
    assert.strictEqual(altraMastro.itemLayer, l1);
    assert.match(messaggi[0].testo, /spostate 2 meccaniche/);
});

test("una meccanica che non si sposta non ferma le altre, e la console la nomina", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["Livello 1", "Bloccato"]);
    const libera = gruppo("BOX_STD", doc.livello("Livello 1"));
    const bloccata = gruppo("BOX_JOLLY", doc.livello("Bloccato"), true);
    doc.masterSpreads = collezione([{ baseName: "meccaniche", groups: collezione([bloccata, libera]) }]);

    const livello = funzione(doc);

    assert.strictEqual(libera.itemLayer, livello);
    assert.strictEqual(bloccata.itemLayer.name, "Bloccato");
    assert.deepStrictEqual(messaggi.map(m => m.stile), ["warning", "warning"]);
    assert.match(messaggi[0].testo, /^Code IDX-187 .*spostate 1 meccaniche/);
    assert.strictEqual(messaggi[1].testo, "Code IDX-189 Queste meccaniche non si sono potute spostare sul livello InPagina (livello bloccato?): BOX_JOLLY");
});

test("senza meccaniche non crea il livello e ferma l'impaginazione dicendolo", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["Livello 1"], [{ nome: "Pagina", gruppi: [gruppo("TESTATA", null)] }]);

    assert.strictEqual(funzione(doc), null);
    assert.deepStrictEqual(doc.livelli.map(l => l.name), ["Livello 1"]);
    assert.deepStrictEqual(messaggi, [{ testo: "Code IDX-190 Il documento non ha il livello InPagina e nella pagina mastro meccaniche non ci sono meccaniche: l'impaginazione si ferma, va sistemato il documento", stile: "error" }]);
});

test("una seconda impaginazione sullo stesso documento non crea doppioni e non sposta di nuovo", () => {
    const { funzione, messaggi } = assicuraLivello();
    const doc = documentoFinto(["Livello 1"]);
    doc.masterSpreads = collezione([{ baseName: "meccaniche", groups: collezione([gruppo("BOX_STD", doc.livello("Livello 1"))]) }]);

    funzione(doc);
    funzione(doc);

    assert.strictEqual(doc.livelli.filter(l => l.name === "InPagina").length, 1);
    assert.strictEqual(messaggi.length, 1);
});

/* ---- dove si chiama ---- */

test("l'impaginazione delle pagine prepara il livello solo impaginando, prima di usarlo, e si ferma se non si puo'", () => {
    const corpo = corpoDi("async function _conteggiaImpaginaConContesto(");
    const chiamata = corpo.indexOf("assicuraLivelloInPagina(docInLavorazione)");
    assert.ok(chiamata > 0, "manca la chiamata");
    assert.match(corpo, /if \(impagina\) \{\s*try \{\s*if \(assicuraLivelloInPagina\(docInLavorazione\) == null\) \{\s*hideLoading\(\);\s*cbkEnd\?\.\("error"\);\s*return;\s*\}\s*\}\s*catch \(ex\) \{\s*messaggioUtente\("Code IDX-188 Impossibile creare il livello InPagina nel documento: " \+ ex\.message, "Error", false, 5\);\s*hideLoading\(\);\s*cbkEnd\?\.\("error"\);\s*return;/);

    //Prima di volantino e PoP, e prima di ogni uso del livello.
    assert.ok(chiamata < corpo.indexOf("if (tipo_lavorazione_corrente== 1) {"));
    assert.ok(chiamata < corpo.indexOf('docInLavorazione.layers.itemByName("InPagina")'));
});

test("l'impaginazione di un singolo box prepara il livello prima di impaginare, e si ferma se non si puo'", () => {
    const corpo = corpoDi("async function impaginaSingolo(");
    assert.match(corpo, /if \(assicuraLivelloInPagina\(docInLavorazione\) == null\) \{\s*return;\s*\}\s*var box = await impaginazioneSingoloIndd\(objResult\.records, pagina\);/);
});

test("le meccaniche spostate sono quelle che impaginaBox cerca: gruppi di InPagina nelle mastro meccaniche", () => {
    const corpo = corpoDi("async function impaginaBoxNelContesto(");
    assert.match(corpo, /var nomeMasterSpread = "meccaniche"\+declinazioneMeccanica;/);
    assert.match(corpo, /if \(masterSpread\.groups\.item\(j\)\.itemLayer\.name != "InPagina"\) \{\s*continue;/);
    assert.match(corpo, /boxMeccanica\.label == meccanica/);
});
