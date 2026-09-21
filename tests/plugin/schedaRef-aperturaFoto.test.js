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

/* ---- la foto proposta dalla cartella di lavorazione ---- */

// Prima di mandare l'operatore a sfogliare si guarda se nella cartella Links c'e' gia' il
// file che sta cercando. I casi sono tre, decisi dall'operatore: stesso nome ma contenuto
// diverso, foto che il server non conosce, e psd presente solo in cartella.

function file(nome, modificato, dimensione) {
    return { nome: nome, modificato: modificato, dimensione: dimensione || 0 };
}

test("il nome si divide in radice ed estensione, in minuscolo", () => {
    assert.deepStrictEqual(schedaRef.partiDelNomeFile("6119227_1_T5.PSD"), { base: "6119227_1_T5", estensione: "psd" });
    assert.deepStrictEqual(schedaRef.partiDelNomeFile("senza_estensione"), { base: "senza_estensione", estensione: "" });
    assert.deepStrictEqual(schedaRef.partiDelNomeFile(null), { base: "", estensione: "" });
});

test("sono candidati i file che portano il codice della referenza in testa", () => {
    const cartella = [
        file("6119227_1_T5.psd", 1),
        file("6119227.jpg", 2),
        file("altro_6119227.psd", 3),
        file("7000000_1.psd", 4)
    ];

    assert.deepStrictEqual(
        schedaRef.candidatiPerReferenza(cartella, "6119227").map(f => f.nome),
        ["6119227_1_T5.psd", "6119227.jpg"]);
});

// Senza questo vincolo il codice 6119227 pescherebbe le foto di 61192271, che e' un altro
// articolo, e la proposta sarebbe sbagliata proprio dove sembra giusta.
test("una cifra dopo il codice vuol dire un altro articolo", () => {
    const cartella = [file("61192271_1.psd", 1), file("6119227_1.psd", 2)];

    assert.deepStrictEqual(
        schedaRef.candidatiPerReferenza(cartella, "6119227").map(f => f.nome), ["6119227_1.psd"]);
});

test("senza codice o senza cartella non ci sono candidati", () => {
    assert.deepStrictEqual(schedaRef.candidatiPerReferenza([file("a.psd", 1)], ""), []);
    assert.deepStrictEqual(schedaRef.candidatiPerReferenza(null, "6119227"), []);
    assert.strictEqual(schedaRef.scegliCandidatoFoto([], "6119227"), null);
});

test("fra i candidati vince il psd anche se e' il piu' vecchio", () => {
    const cartella = [file("6119227_a.jpg", 100), file("6119227_b.psd", 1)];

    assert.strictEqual(schedaRef.scegliCandidatoFoto(cartella, "6119227").nome, "6119227_b.psd");
});

test("fra due psd vince il piu' recente", () => {
    const cartella = [file("6119227_vecchio.psd", 10), file("6119227_nuovo.psd", 99)];

    assert.strictEqual(schedaRef.scegliCandidatoFoto(cartella, "6119227").nome, "6119227_nuovo.psd");
});

test("senza psd vince il piu' recente fra gli altri", () => {
    const cartella = [file("6119227_a.jpg", 10), file("6119227_b.png", 99), file("6119227_c.gif", 50)];

    assert.strictEqual(schedaRef.scegliCandidatoFoto(cartella, "6119227").nome, "6119227_b.png");
});

/* i tre motivi per proporre */

test("stesso nome ma contenuto diverso da quello impaginato", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.psd", hash: "AAA" },
            [{ nome: "6119227_1.psd", hash: "AAA" }],
            "BBB"),
        "hashDiverso");
});

test("il maiuscolo dell'hash non fa differenza", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.psd", hash: "abc123" },
            [{ nome: "6119227_1.psd", hash: "abc123" }],
            "ABC123"),
        null);
});

test("la foto del box che il server non conosce", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_vecchia.jpg", hash: "AAA" },
            [{ nome: "6119227_altra.jpg", hash: "BBB" }],
            null),
        "nonSulServer");
});

test("il box senza nessuna foto e la cartella che ne ha una", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(file("6119227_1.psd", 1), null, [], null),
        "nonSulServer");
});

test("il psd c'e' in cartella e non sul server", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }],
            null),
        "psdSoloInCartella");
});

test("se il server ha gia' il psd non si propone niente", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }, { nome: "6119227_2.psd", hash: "CCC" }],
            null),
        null);
});

// Il caso normale: la foto impaginata e' quella giusta e il server la conosce. Chiedere
// qui vorrebbe dire disturbare l'operatore a ogni clic.
test("quando e' tutto in ordine non si propone niente", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.jpg", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }],
            "AAA"),
        null);
});

test("senza candidato non c'e' motivo", () => {
    assert.strictEqual(schedaRef.motivoPropostaFoto(null, { nome: "a.jpg", hash: "A" }, [], null), null);
});

/* ---- come il Plugin la usa ---- */

test("si propone prima di aprire lo sfoglia, e si sfoglia se la proposta non c'e'", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    const proposta = sorgente.indexOf("me.fotoDaProporreDallaCartella(");
    const sfoglia = sorgente.indexOf("fd = await selectFile(", proposta);

    assert.ok(proposta > 0, "la proposta deve esistere");
    assert.ok(sfoglia > proposta, "lo sfoglia resta la strada quando non si propone o si dice di no");
    assert.ok(sorgente.slice(proposta, sfoglia).includes("if (fd == null) {"),
        "si sfoglia solo se dalla proposta non e' uscito niente");
});

test("l'hash si calcola solo quando il nome coincide", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    const inizio = sorgente.indexOf("async fotoDaProporreDallaCartella(");
    const blocco = sorgente.slice(inizio, sorgente.indexOf("riquadroPropostaFoto(candidato", inizio));

    const guardia = blocco.indexOf("if (candidato.nome === nomeBox) {");
    const calcolo = blocco.indexOf("cmd.md5ArrayBuffer(");

    assert.ok(guardia > 0 && calcolo > guardia && calcolo - guardia < 400,
        "leggere un psd da centinaia di megabyte quando non serve l'hash sarebbe un costo inutile");
});
