/*
 * I20-1066: gli indirizzi del server nella voce di lavorazioni.json.
 *
 * La voce di una lavorazione non ricordava con quale Istanta e quale Olimpo era nata: un Plugin
 * montato con l'ipconfig di un altro cliente (o di test) la apriva e ci lavorava sopra. Ora la voce
 * nasce con gli indirizzi dell'ipconfig montato, e all'apertura del documento il Plugin li
 * confronta con quelli attuali: diversi, si blocca con un errore; una voce di prima, senza
 * indirizzi, riceve quelli attuali e non blocca.
 *
 * configurazioneCliente.js si carica sotto Node; ficoProcess.js e indexNew.js vogliono InDesign e
 * si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const ConfigurazioneCliente = require("../../plugin/configurazioneCliente.js");

const EDRO = ConfigurazioneCliente.indirizziServer("https://istanta.istantademo.it/edro21_istanta4/", "https://olimpo.istantademo.it/edro21/");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- le regole ---- */

test("gli indirizzi si salvano come li dice l'ipconfig", () => {
    assert.deepStrictEqual(ConfigurazioneCliente.indirizziServer("http://a/", "http://b"), { istanta: "http://a/", olimpo: "http://b" });
    assert.deepStrictEqual(ConfigurazioneCliente.indirizziServer(null, undefined), { istanta: "", olimpo: "" });
});

test("gli stessi indirizzi combaciano, anche con la barra in fondo, gli spazi o le maiuscole diversi", () => {
    assert.strictEqual(ConfigurazioneCliente.confrontaIndirizzi(EDRO, EDRO).esito, "uguali");
    const scritti = { istanta: " HTTPS://istanta.istantademo.it/edro21_istanta4 ", olimpo: "https://olimpo.istantademo.it/edro21//" };
    assert.deepStrictEqual(ConfigurazioneCliente.confrontaIndirizzi(scritti, EDRO), { esito: "uguali", diversi: [] });
});

test("un Istanta diverso blocca, e si dice quale con i due valori", () => {
    const coop = ConfigurazioneCliente.indirizziServer("https://istanta.coop.it/", EDRO.olimpo);
    const confronto = ConfigurazioneCliente.confrontaIndirizzi(coop, EDRO);
    assert.strictEqual(confronto.esito, "diversi");
    assert.deepStrictEqual(confronto.diversi, [{ nome: "Istanta", registrato: "https://istanta.coop.it/", attuale: EDRO.istanta }]);
});

test("anche un Olimpo diverso blocca", () => {
    const altro = ConfigurazioneCliente.indirizziServer(EDRO.istanta, "http://192.168.1.10/olimpo/");
    const confronto = ConfigurazioneCliente.confrontaIndirizzi(altro, EDRO);
    assert.strictEqual(confronto.esito, "diversi");
    assert.deepStrictEqual(confronto.diversi.map(d => d.nome), ["Olimpo"]);
});

test("una voce di prima, senza indirizzi, non blocca", () => {
    assert.deepStrictEqual(ConfigurazioneCliente.confrontaIndirizzi(undefined, EDRO), { esito: "mancanti", diversi: [] });
    assert.deepStrictEqual(ConfigurazioneCliente.confrontaIndirizzi(null, EDRO), { esito: "mancanti", diversi: [] });
    assert.deepStrictEqual(ConfigurazioneCliente.confrontaIndirizzi({ istanta: "", olimpo: " " }, EDRO), { esito: "mancanti", diversi: [] });
});

test("l'errore dice gli indirizzi della lavorazione, quelli del Plugin e cosa fare", () => {
    const testo = ConfigurazioneCliente.testoIndirizziDiversi([{ nome: "Istanta", registrato: "https://istanta.coop.it/", attuale: EDRO.istanta }]);
    assert.match(testo, /Istanta: lavorazione https:\/\/istanta\.coop\.it\/ - Plugin https:\/\/istanta\.istantademo\.it\/edro21_istanta4\//);
    assert.match(testo, /monta-cliente\.sh/);
    assert.match(testo, /ricaricare il Plugin/);
    assert.match(ConfigurazioneCliente.testoIndirizziDiversi([{ nome: "Olimpo", registrato: "", attuale: "x" }]), /Olimpo: lavorazione \(vuoto\) - Plugin x/);
});

/* ---- dove si usano ---- */

test("ogni voce nuova di lavorazioni.json nasce con gli indirizzi dell'ipconfig montato", () => {
    const fico = sorgente("ficoProcess.js");
    const voci = fico.match(/let voce = \{[^\n]*\};/g) || [];
    //lavoraKit (lavorazione locale o nuova) e lavoraKitMassivo (gli stessi due casi per il libro).
    assert.strictEqual(voci.length, 4);
    voci.forEach(v => assert.match(v, /ip: ?ConfigurazioneCliente\.indirizziServer\(istantaIp, olimpoIp\)/, v));
});

test("all'apertura del documento il controllo viene prima di aprire la lavorazione", () => {
    const index = sorgente("indexNew.js");
    const inizio = index.indexOf("async function initDocumentInLavorazione()");
    const init = index.substring(inizio, index.indexOf("\n}\n", inizio));
    const controllo = init.indexOf("if (!verificaIndirizziDellaLavorazione()) {");
    assert.ok(controllo > 0);
    assert.match(init, /if \(!verificaIndirizziDellaLavorazione\(\)\) \{\s*return null;\s*\}/);
    assert.ok(controllo < init.indexOf("customAgenzia.setLavorazione();"));
    assert.ok(controllo < init.indexOf("leggiContenutoKit(idKitLavorazione);"));
});

test("diversi blocca a tutta pagina; mancanti registra quelli attuali; un controllo fallito non blocca", () => {
    const index = sorgente("indexNew.js");
    const inizio = index.indexOf("function verificaIndirizziDellaLavorazione() {");
    const verifica = index.substring(inizio, index.indexOf("\n}\n", inizio));
    assert.match(verifica, /const confronto = ConfigurazioneCliente\.confrontaIndirizzi\(voce\.ip, attuali\);/);
    assert.match(verifica, /if \(confronto\.esito === "mancanti"\) \{\s*voce\.ip = attuali;\s*Utility\.salvaVoceLavorazione\(pathLavorazione, idMacchina\(\), voce\);\s*return true;\s*\}/);
    assert.match(verifica, /bloccaPerIndirizziDiversi\(ConfigurazioneCliente\.testoIndirizziDiversi\(confronto\.diversi\)\);\s*return false;/);
    assert.match(verifica, /catch \(e\) \{\s*console\.error\("Code IDX-178 [^"]*" \+ e\);\s*return true;/);

    const blocco = index.substring(index.indexOf("function bloccaPerIndirizziDiversi(dettaglio) {"));
    assert.match(blocco, /\$\("#istantaDownAlert"\)\.css\("display", "flex"\);/);
});
