/*
 * I20-1200: le segnalazioni di impaginazione decise dal cliente.
 *
 * Dopo un sync andato male capita che la foto di una referenza Edro21 arrivi in jpg invece che in
 * psd: Istanta prende la foto piu' recente senza guardare il formato, e dato e box sono d'accordo,
 * quindi nessuna differenza la mostra. Il plugin di agenzia ora puo' dichiarare segnalazioni
 * personalizzate (campo, testo che il valore deve contenere, gravita', testo), lette da
 * pluginMiddleware; impaginaBox le valuta sul nome della foto primaria e di ogni secondaria e le
 * scrive nel bollino del box. Edro21 segnala le foto il cui nome non contiene ".psd".
 *
 * pluginMiddleware.js non si carica sotto Node: i due metodi si prendono dal sorgente e si provano
 * su un middleware finto con la configurazione vera di Edro21. impaginaBox si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const RADICE = path.join(__dirname, "..", "..");
const customEdro21 = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"), "utf8"));

/// Un metodo di pluginMiddleware com'e' nel sorgente, dalla sua firma alla chiusura.
function metodo(sorgente, firma) {
    const inizio = sorgente.indexOf("    " + firma + " {");
    assert.ok(inizio >= 0, firma + " non trovato in pluginMiddleware.js: il test va aggiornato");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return sorgente.substring(inizio, fine) + "\n    }";
}

/// Un middleware finto con i due metodi veri e la configurazione data.
function middleware(configurazione) {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const me = new Function("return {" + metodo(sorgente, "getSegnalazioniPersonalizzate()") + ",\n" +
        metodo(sorgente, "segnalazioniPersonalizzate(campo, valore)") + "};")();
    me.callCustom = false;
    me.customPluginDB = configurazione;
    return me;
}

const edro21 = middleware(customEdro21);

test("Edro21 segnala la foto primaria o secondaria che non e' un psd", () => {
    const segnalazioni = edro21.segnalazioniPersonalizzate("nomeFoto", "6149843_1_T5.jpg");
    assert.strictEqual(segnalazioni.length, 1);
    assert.strictEqual(segnalazioni[0].gravita, "warning");
    assert.match(segnalazioni[0].testo, /^Code PSD-01 /);
    assert.ok(segnalazioni[0].testo.includes("6149843_1_T5.jpg"), segnalazioni[0].testo);
    assert.ok(!segnalazioni[0].testo.includes("{valore}"));

    //Le maiuscole non contano, in un senso e nell'altro.
    assert.strictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", "4526859_1_T5.JPG").length, 1);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", "6149843_1_T5.psd"), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", "6149843_1_T5.PSD"), []);
});

test("la referenza senza foto e gli altri campi non si segnalano", () => {
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", ""), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", "   "), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", null), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("nomeLogo", "Logo_SDB.png"), []);
});

test("un cliente senza segnalazioni personalizzate non ne riceve", () => {
    assert.deepStrictEqual(middleware({}).segnalazioniPersonalizzate("nomeFoto", "123.jpg"), []);
    assert.deepStrictEqual(middleware({ segnalazioniPersonalizzate: null }).segnalazioniPersonalizzate("nomeFoto", "123.jpg"), []);
    assert.deepStrictEqual(middleware(null).segnalazioniPersonalizzate("nomeFoto", "123.jpg"), []);
});

test("le regole incomplete non valgono; senza codice il testo resta com'e', error solo se lo dice", () => {
    const me = middleware({
        segnalazioniPersonalizzate: [
            { campo: "nomeFoto", deveContenere: "", testo: "senza condizione" },
            { campo: "", deveContenere: ".psd", testo: "senza campo" },
            { campo: "nomeFoto", deveContenere: ".psd" },
            null,
            { campo: "nomeFoto", deveContenere: ".tif", gravita: "ERROR", testo: "{valore} non e' un tif, {valore}" },
            { campo: "nomeFoto", deveContenere: ".psd", gravita: "grave", testo: "non psd" }
        ]
    });
    assert.deepStrictEqual(me.getSegnalazioniPersonalizzate().map(r => r.gravita), ["error", "warning"]);
    assert.deepStrictEqual(me.segnalazioniPersonalizzate("nomeFoto", "123.jpg"), [
        { testo: "123.jpg non e' un tif, 123.jpg", gravita: "error" },
        { testo: "non psd", gravita: "warning" }
    ]);
});

test("impaginaBox valuta le segnalazioni sulla primaria e su ogni secondaria, senza poter fermare la foto", () => {
    const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const aiuto = indice.substring(indice.indexOf("function segnalazioniPersonalizzateFoto(nomeFoto) {"),
                                   indice.indexOf("function finalizzaSegnalazioni("));
    assert.match(aiuto, /try \{\s*pluginMiddleware\.segnalazioniPersonalizzate\("nomeFoto", nomeFoto\)\.forEach\(s => addSegnalazione\(s\.testo, s\.gravita, 2, true\)\);\s*\}\s*catch/);

    assert.match(indice, /FotoPlacer\.applicaNoRender\(photo, elemento\.noRender\);\n\s*segnalazioniPersonalizzateFoto\(nomeFoto\);/);
    assert.match(indice, /FotoPlacer\.applicaNoRender\(field, membroPrimaria != null && membroPrimaria\.noRender\);\n\s*segnalazioniPersonalizzateFoto\(nomeFoto\);/);
});

/* ---- I20-1248: segnalazioni sui campi del record compilati ---- */

test("I20-1248: Edro21 segnala la note category compilata, con il valore, come avviso", () => {
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("note_category", "NO FOTO AMBIENTATA"), [
        { testo: "Code NCT-01 Ci sono note category: NO FOTO AMBIENTATA", gravita: "warning" }
    ]);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("note_category", ""), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("note_category", "   "), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("note_category", null), []);
    assert.deepStrictEqual(edro21.segnalazioniPersonalizzate("note_category", undefined), []);
    //La regola delle foto resta com'era.
    assert.strictEqual(edro21.segnalazioniPersonalizzate("nomeFoto", "6149843_1_T5.jpg").length, 1);
});

test("I20-1248: quando compilato non vuole deveContenere; ogni altro quando vale non contiene", () => {
    const me = middleware({
        segnalazioniPersonalizzate: [
            { campo: "note", quando: "COMPILATO", testo: "nota {valore}" },
            { campo: "note", quando: "compilato" },
            { campo: "note", quando: "boh", testo: "senza condizione" },
            { campo: "note", quando: "boh", deveContenere: "ok", testo: "non ok" }
        ]
    });
    assert.deepStrictEqual(me.getSegnalazioniPersonalizzate().map(r => r.quando), ["compilato", ""]);
    assert.deepStrictEqual(me.segnalazioniPersonalizzate("note", "da vedere"), [
        { testo: "nota da vedere", gravita: "warning" },
        { testo: "non ok", gravita: "warning" }
    ]);
    assert.deepStrictEqual(me.segnalazioniPersonalizzate("note", "ok"), [{ testo: "nota ok", gravita: "warning" }]);
});

test("I20-1248: impaginaBox valuta i campi del record del primario prima di chiudere le segnalazioni, senza le foto", () => {
    const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const aiuto = indice.substring(indice.indexOf("function segnalazioniPersonalizzateDelRecord(itemRef) {"),
                                   indice.indexOf("function finalizzaSegnalazioni("));
    assert.match(aiuto, /\.filter\(c => c !== "nomeFoto"\)/);
    assert.match(aiuto, /pluginMiddleware\.segnalazioniPersonalizzate\(campo, itemRef\[campo\]\)\.forEach\(s => addSegnalazione\(s\.testo, s\.gravita, 2, true\)\)/);
    assert.match(aiuto, /catch \(e\) \{\s*console\.error\("Code IDX-205 /);
    assert.match(indice, /segnalazioniPersonalizzateDelRecord\(itemRef\);\s*boxImpaginato =finalizzaSegnalazioni\(reportImpaginazioneObj, itemRef\["Scatto\.CodiceGruppo"\], boxImpaginato\);/);
});

test("I20-1248: Edro21 dichiara il filtro Note category con NCT-01", () => {
    const filtri = middlewareFiltri(customEdro21).getFiltriSegnalazioni();
    assert.strictEqual(filtri[1].nome, "Note category");
    assert.deepStrictEqual(filtri[1].condizioni, [{ codice: "NCT-01", testoContiene: "" }]);
});

/* ---- I20-1211: i filtri della schermata delle segnalazioni decisi dal cliente ---- */

/// Un middleware finto con il solo getFiltriSegnalazioni vero.
function middlewareFiltri(configurazione, custom = null) {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const me = new Function("customAgenzia", "return {" + metodo(sorgente, "getFiltriSegnalazioni()") + "};")(custom);
    me.callCustom = custom != null;
    me.customPluginDB = configurazione;
    return me;
}

test("I20-1211: Edro21 dichiara il filtro Solo foto, con CSF-013 e CSF-008 solo sulle foto e la FNF-01 (I20-1263)", () => {
    const filtri = middlewareFiltri(customEdro21).getFiltriSegnalazioni();

    //I20-1248: dopo Solo foto c'e' Note category.
    assert.strictEqual(filtri.length, 2);
    assert.strictEqual(filtri[0].nome, "Solo foto");
    assert.deepStrictEqual(filtri[0].condizioni, [
        { codice: "PSD-01", testoContiene: "" },
        { codice: "CSF-12", testoContiene: "" },
        { codice: "CSF-27", testoContiene: "" },
        { codice: "CSF-19", testoContiene: "" },
        { codice: "CSF-013", testoContiene: "foto" },
        { codice: "CSF-008", testoContiene: "foto" },
        //I20-1263: la foto non trovata.
        { codice: "FNF-01", testoContiene: "" }
    ]);
});

test("I20-1211: un cliente senza filtri non ne ha, e i filtri incompleti non valgono", () => {
    assert.deepStrictEqual(middlewareFiltri({}).getFiltriSegnalazioni(), []);
    assert.deepStrictEqual(middlewareFiltri(null).getFiltriSegnalazioni(), []);
    assert.deepStrictEqual(middlewareFiltri({ filtriSegnalazioni: "Solo foto" }).getFiltriSegnalazioni(), []);
    assert.deepStrictEqual(middlewareFiltri({
        filtriSegnalazioni: [
            { nome: "", condizioni: [{ codice: "PSD-01" }] },
            { nome: "Senza condizioni", condizioni: [] },
            { nome: "Condizioni senza codice", condizioni: [{ codice: " ", testoContiene: "foto" }, null] },
            null,
            { nome: " Loghi ", condizioni: [{ codice: "CSF-013", testoContiene: " foto_extra " }] }
        ]
    }).getFiltriSegnalazioni(), [{ nome: "Loghi", condizioni: [{ codice: "CSF-013", testoContiene: "foto_extra" }] }]);
});

test("I20-1211: un cliente che usa il custom.js li dichiara li'", () => {
    const filtri = middlewareFiltri(null, { filtriSegnalazioni: [{ nome: "Solo foto", condizioni: [{ codice: "PSD-01" }] }] }).getFiltriSegnalazioni();
    assert.deepStrictEqual(filtri, [{ nome: "Solo foto", condizioni: [{ codice: "PSD-01", testoContiene: "" }] }]);
});
