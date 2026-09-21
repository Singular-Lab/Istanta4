/*
 * I20-980: da dove si apre il dialogo quando si carica una foto nuova.
 *
 * Premendo "Carica foto" nel modal di cambio foto, il dialogo si apriva dove il sistema si
 * era fermato l'ultima volta e l'operatore doveva ritrovare a mano la cartella Links della
 * lavorazione. Ora si parte dal file della foto che si sta sostituendo.
 *
 * Le funzioni sotto test sono membri di plugin/schedaRef.js e non toccano InDesign: compongono
 * un percorso e lo traducono in URL, che e' la forma che il file system di UXP accetta.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const schedaRef = require("../../plugin/schedaRef");

function sorgentePlugin(nomeFile) {
    return fs.readFileSync(path.join(__dirname, "..", "..", "plugin", nomeFile), "utf8");
}

/* ---- il percorso da cui partire ---- */

test("si punta alla foto attuale dentro la cartella Links", () => {
    assert.strictEqual(
        schedaRef.percorsoDiPartenzaPerFoto("/Volumi/Lavorazioni/A2515/Links/", "6119227_1_T5.psd"),
        "/Volumi/Lavorazioni/A2515/Links/6119227_1_T5.psd");
});

// Su Windows il percorso della lavorazione arriva con le barre rovesciate.
test("il separatore e' quello del percorso ricevuto", () => {
    assert.strictEqual(
        schedaRef.percorsoDiPartenzaPerFoto("C:\\Lavorazioni\\A2515\\Links", "foto.psd"),
        "C:\\Lavorazioni\\A2515\\Links\\foto.psd");
});

test("una barra di troppo in fondo non diventa doppia", () => {
    assert.strictEqual(
        schedaRef.percorsoDiPartenzaPerFoto("/Links//", "foto.psd"), "/Links/foto.psd");
    assert.strictEqual(
        schedaRef.percorsoDiPartenzaPerFoto("C:\\Links\\\\", "foto.psd"), "C:\\Links\\foto.psd");
});

// Un box senza foto impaginata: si apre comunque la cartella giusta, ed e' gia' un guadagno.
test("senza nome foto si punta alla sola cartella", () => {
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto("/Volumi/Lav/Links/", null), "/Volumi/Lav/Links");
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto("/Volumi/Lav/Links", "   "), "/Volumi/Lav/Links");
});

// Lavorazione senza pathLinks: non si punta a niente e il dialogo si apre come prima.
test("senza cartella non si punta a niente", () => {
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto("", "foto.psd"), null);
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto(null, "foto.psd"), null);
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto(undefined, undefined), null);
});

test("la cartella radice resta percorribile", () => {
    assert.strictEqual(schedaRef.percorsoDiPartenzaPerFoto("/", "foto.psd"), "/foto.psd");
});

/* ---- la traduzione in URL ---- */

test("un percorso di Mac diventa un URL con tre barre", () => {
    assert.strictEqual(
        schedaRef.urlDiPercorso("/Volumi/Lav/Links/foto.psd"), "file:///Volumi/Lav/Links/foto.psd");
});

test("un percorso di Windows perde le barre rovesciate", () => {
    assert.strictEqual(
        schedaRef.urlDiPercorso("C:\\Lav\\Links\\foto.psd"), "file:///C:/Lav/Links/foto.psd");
});

test("un URL gia' pronto non viene ritradotto", () => {
    assert.strictEqual(schedaRef.urlDiPercorso("file:///gia/pronto.psd"), "file:///gia/pronto.psd");
});

test("senza percorso non c'e' URL", () => {
    assert.strictEqual(schedaRef.urlDiPercorso(null), null);
    assert.strictEqual(schedaRef.urlDiPercorso("   "), null);
    assert.strictEqual(schedaRef.urlDiPercorso(42), null);
});

/* ---- la cartella su cui ripiegare ---- */

test("dal file si risale alla sua cartella", () => {
    assert.strictEqual(schedaRef.cartellaDiPercorso("/Volumi/Lav/Links/foto.psd"), "/Volumi/Lav/Links");
    assert.strictEqual(schedaRef.cartellaDiPercorso("C:\\Lav\\Links\\foto.psd"), "C:\\Lav\\Links");
});

test("da un nome senza cartella non si risale a niente", () => {
    assert.strictEqual(schedaRef.cartellaDiPercorso("foto.psd"), null);
    assert.strictEqual(schedaRef.cartellaDiPercorso("/foto.psd"), null);
    assert.strictEqual(schedaRef.cartellaDiPercorso(null), null);
});

/* ---- come il Plugin le usa ---- */

test("il pulsante Carica foto parte dalla foto attuale nella cartella Links", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    assert.ok(sorgente.includes("me.percorsoDiPartenzaPerFoto(percorsoLinks, nomeFotoImpaginata)"),
        "il punto di partenza arriva dalla cartella della lavorazione e dal file impaginato");
    assert.ok(sorgente.includes("elementoCercato.recordInTracciato[\"Foto.Nome\"]"),
        "il nome del file si legge dal record del box");
});

// Il dialogo deve aprirsi comunque: una cartella sparita o un file rinominato non possono
// impedire di scegliere una foto a mano.
test("un punto di partenza che non si risolve non blocca la scelta del file", () => {
    const sorgente = sorgentePlugin("indexNew.js");

    const inizio = sorgente.indexOf("async function puntoDiAperturaFile(percorso) {");
    assert.ok(inizio > 0, "la risoluzione del punto di apertura deve esistere");

    const blocco = sorgente.slice(inizio, sorgente.indexOf("async function selectFile(", inizio));

    assert.strictEqual((blocco.match(/getEntryWithUrl/g) || []).length, 2,
        "si prova prima il file e poi la cartella che lo contiene");
    assert.ok((blocco.match(/catch/g) || []).length >= 2,
        "entrambi i tentativi vanno protetti: un percorso perso non deve arrivare al chiamante");
    assert.ok((blocco.match(/return undefined;/g) || []).length >= 2,
        "in ogni caso perso si torna alle opzioni vuote, cioe' al dialogo di sempre");
});
