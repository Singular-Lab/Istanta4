/*
 * I20-1140: il testo dei loghi idms confrontato col dato.
 *
 * Il logo attributo italiano di Edro21 e' un idms che porta sotto la bandiera un testo ricavato dalla
 * descrizione ("prodotto<br>italiano" in logo_attributo_it). Il confronto del box guardava solo se il
 * logo c'era: cambiando la descrizione il testo restava quello vecchio senza nessuna differenza, e il
 * Salva della scheda non proponeva di aggiornare il box. Ora il plugin di agenzia dichiara in
 * loghiConTesto quali loghi hanno un testo e da quale campo del dato; il core lo confronta.
 *
 * confronti.js si carica sotto Node: le funzioni che decidono si provano direttamente, il ramo della
 * preanalisi sul sorgente. pluginMiddleware no: il getter si prende dal sorgente e si esegue con un
 * middleware finto, come in descrizioniInSolaLettura.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");

const LOGO = { nome: "logo_attributo_it.idms", sigla: "logo_attributo_it", tipo: 3 };
const EDRO = [{ sigla: "logo_attributo_it", keyInRecordInTracciato: "logo_attributo_it" }];

/// Un logo idms come lo vede InDesign: un gruppo col suo riquadro di testo. InDesign va a capo con \r.
function logoNelBox(contenuto) {
    return { textFrames: { length: 1, item: () => ({ contents: contenuto }) } };
}

/* ---- il confronto del testo ---- */

test("testo del logo uguale al dato: nessuna differenza, anche con maiuscole e a capo di InDesign", () => {
    const record = { logo_attributo_it: "prodotto<br>italiano" };

    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox("PRODOTTO\ritaliano"), record, EDRO), null);
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox(" prodotto  \r italiano\r"), record, EDRO), null);
});

test("descrizione cambiata: il testo del logo e' una differenza, con i due testi", () => {
    const record = { logo_attributo_it: "origine<br>italiana" };

    const differenza = confronti.differenzaTestoLogo(LOGO, logoNelBox("prodotto\ritaliano"), record, EDRO);

    assert.deepStrictEqual(differenza, {
        label: "logo_attributo_it",
        difference: "testo del logo logo_attributo_it diverso dal dato: nel box \"prodotto / italiano\", nel dato \"origine / italiana\""
    });
});

test("un logo non dichiarato con testo si confronta solo per la presenza", () => {
    const record = { logo_attributo_it: "origine<br>italiana", LOGO_filiera: "qualcosa" };
    const filiera = { nome: "LOGO_filiera.idms", sigla: "LOGO_filiera", tipo: 3 };

    assert.strictEqual(confronti.differenzaTestoLogo(filiera, logoNelBox("altro"), record, EDRO), null);
    //Agenzia che non dichiara niente.
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox("prodotto\ritaliano"), record, []), null);
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox("prodotto\ritaliano"), record, null), null);
});

test("senza il testo nel dato, senza record o senza riquadro di testo non si decide niente", () => {
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox("prodotto\ritaliano"), {}, EDRO), null);
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, logoNelBox("prodotto\ritaliano"), null, EDRO), null);
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, { textFrames: { length: 0, item: () => null } }, { logo_attributo_it: "x" }, EDRO), null);
    assert.strictEqual(confronti.differenzaTestoLogo(LOGO, null, { logo_attributo_it: "x" }, EDRO), null);
    assert.strictEqual(confronti.differenzaTestoLogo({ nome: "x.idms" }, logoNelBox("y"), { logo_attributo_it: "x" }, EDRO), null);
});

test("il testo del logo si legge dal suo primo riquadro, o dal riquadro stesso; un errore di InDesign da' null", () => {
    assert.strictEqual(confronti.testoDelLogoNelBox(logoNelBox("prodotto\ritaliano")), "prodotto\ritaliano");
    assert.strictEqual(confronti.testoDelLogoNelBox({ contents: "solo riquadro" }), "solo riquadro");
    assert.strictEqual(confronti.testoDelLogoNelBox({ textFrames: { length: 1, item: () => { throw new Error("oggetto non valido"); } } }), null);
});

test("la forma confrontabile: <br> e ritorni a capo uguali, righe vuote e spazi in piu' tolti, minuscolo", () => {
    assert.strictEqual(confronti.testoLogoConfrontabile("Prodotto<br/>ITALIANO"), "prodotto\nitaliano");
    assert.strictEqual(confronti.testoLogoConfrontabile("prodotto\r\n\r\n  italiano  "), "prodotto\nitaliano");
    assert.strictEqual(confronti.testoLogoConfrontabile(null), "");
});

/* ---- la preanalisi, sul sorgente ---- */

test("nel ramo degli idms extra auto il testo si controlla sul logo presente e non escluso", () => {
    const testo = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");
    const inizio = testo.indexOf("async confrontoBoxCompiledFieldPreAnalisi(");
    const corpo = testo.substring(inizio, testo.indexOf("\n    fotoExtraConImmagineCambiata(", inizio));

    assert.match(corpo, /var loghiConTesto = typeof pluginMiddleware !== "undefined" && pluginMiddleware != null && typeof pluginMiddleware\.getLoghiConTesto === "function"\s*\? pluginMiddleware\.getLoghiConTesto\(\)\s*: \[\];\s*fotoExtraAuto\.forEach\(/);
    assert.match(corpo, /if \(foto\.escluso\) \{\s*differenze\.push\(\{ label: foto\.sigla, difference: "foto extraAuto esclusa ma presente nel box: " \+ foto\.sigla \}\);\s*\}\s*else \{\s*(\/\/[^\n]*\n\s*)*let testoDiverso = confronti\.differenzaTestoLogo\(foto, campoBox1, itemRef, loghiConTesto\);\s*if \(testoDiverso != null\) \{\s*differenze\.push\(testoDiverso\);\s*\}\s*\}/);
});

/* ---- il middleware ---- */

//Il corpo di getLoghiConTesto, eseguito con un middleware finto al posto di this.
function getLoghiConTesto() {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    getLoghiConTesto() {");
    assert.notStrictEqual(inizio, -1, "getLoghiConTesto non trovata in pluginMiddleware.js");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return new Function(sorgente.substring(sorgente.indexOf("{", inizio) + 1, fine));
}

test("il middleware da' i loghi con testo dichiarati dall'agenzia, e tralascia le voci incomplete", () => {
    const getter = getLoghiConTesto();
    const voci = EDRO.concat([null, { sigla: "", keyInRecordInTracciato: "x" }, { sigla: "LOGO_x" }, { sigla: 3, keyInRecordInTracciato: "y" }]);

    assert.deepStrictEqual(getter.call({ callCustom: false, customPluginDB: { loghiConTesto: voci } }), EDRO);
});

test("senza la voce nella configurazione, o con una configurazione non valida, nessun logo con testo", () => {
    const getter = getLoghiConTesto();

    assert.deepStrictEqual(getter.call({ callCustom: false, customPluginDB: {} }), []);
    assert.deepStrictEqual(getter.call({ callCustom: false, customPluginDB: null }), []);
    assert.deepStrictEqual(getter.call({ callCustom: false, customPluginDB: { loghiConTesto: "logo_attributo_it" } }), []);
    //Col custom.js di agenzia senza la funzione: nessuno.
    assert.deepStrictEqual(getter.call({ callCustom: true, customPluginDB: { loghiConTesto: EDRO } }), []);
});
