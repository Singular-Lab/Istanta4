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

// A fermare la proposta e' solo il psd della stessa foto. Un altro scatto della stessa
// referenza salvato in psd non c'entra con quello che si sta sostituendo, e bloccarla li'
// vorrebbe dire perdere il caso proprio quando serve.
test("se il server ha gia' quel psd non si propone niente", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }, { nome: "6119227_1.psd", hash: "CCC" }],
            null),
        null);
});

test("il psd di un altro scatto non ferma la proposta", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.psd", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }, { nome: "6119227_2.psd", hash: "CCC" }],
            null),
        "psdSoloInCartella");
});

test("il confronto dei nomi non si perde sulle maiuscole", () => {
    assert.strictEqual(
        schedaRef.motivoPropostaFoto(
            file("6119227_1.PSD", 1),
            { nome: "6119227_1.jpg", hash: "AAA" },
            [{ nome: "6119227_1.jpg", hash: "AAA" }, { nome: "6119227_1.Psd", hash: "CCC" }],
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

/* ---- quando l'anteprima non si puo' mostrare ---- */

// Il pannello non sa disegnare i psd, che sono proprio i file a cui diamo la precedenza. Un
// riquadro vuoto, o un'immagine rotta, sembrerebbe un guasto: si dice perche' non c'e'.
test("il pannello sa disegnare solo alcuni formati", () => {
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.jpg"), "image/jpeg");
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.JPEG"), "image/jpeg");
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.png"), "image/png");
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.webp"), "image/webp");
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.gif"), "image/gif");
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.psd"), null);
    assert.strictEqual(schedaRef.tipoAnteprimaDi("foto.tif"), null);
    assert.strictEqual(schedaRef.tipoAnteprimaDi("senza_estensione"), null);
});

test("il testo sostitutivo dice di che formato si tratta", () => {
    assert.strictEqual(schedaRef.testoAnteprimaNonDisponibile("6119227_1.psd"),
        "Anteprima non disponibile per i file PSD");
    assert.strictEqual(schedaRef.testoAnteprimaNonDisponibile("senza_estensione"),
        "Anteprima non disponibile");
});

test("il riquadro sostitutivo esiste nel markup e viene governato in tutti i punti", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    assert.ok(sorgente.includes('id="txtAnteprimaNonDisponibile"'),
        "il riquadro sostitutivo deve stare accanto all'immagine");
    assert.ok(sorgente.includes("me.mostraAnteprimaCaricamento(fd.nomeFile"),
        "l'anteprima del file scelto passa di li'");
    assert.ok(!sorgente.includes("$('#imgPreviewUploadFoto').attr('src', previewUrl);"),
        "l'immagine non va piu' impostata alla cieca");

    const ripristino = sorgente.indexOf("$('#previewUploadFoto').hide();");
    assert.ok(sorgente.slice(ripristino, ripristino + 400).includes("$('#txtAnteprimaNonDisponibile').hide()"),
        "il ripristino deve pulire anche il riquadro sostitutivo");
});

/* ---- la miniatura che il psd si porta dentro ---- */

// Il pannello non disegna i psd, ma Photoshop dentro al file salva gia' una piccola JPEG
// della composizione: quella si puo' mostrare. Qui si costruiscono psd finti, con la stessa
// struttura dei veri, per verificare che venga ritrovata.

function psdFinto(risorse) {
    const testa = [0x38, 0x42, 0x50, 0x53, 0, 1];            // 8BPS + versione
    while (testa.length < 26) testa.push(0);                  // resto dell'intestazione
    const colore = [0, 0, 0, 0];                              // blocco del colore vuoto
    const lunghezza = risorse.length;
    const dimensione = [
        (lunghezza >> 24) & 255, (lunghezza >> 16) & 255, (lunghezza >> 8) & 255, lunghezza & 255];

    return new Uint8Array([].concat(testa, colore, dimensione, risorse));
}

function risorsa(id, dati, nome) {
    const testa = [0x38, 0x42, 0x49, 0x4D, (id >> 8) & 255, id & 255];
    const nomeBytes = nome ? [nome.length].concat([...nome].map(c => c.charCodeAt(0))) : [0];
    if (nomeBytes.length % 2 !== 0) nomeBytes.push(0);

    const lunghezza = dati.length;
    const dimensione = [
        (lunghezza >> 24) & 255, (lunghezza >> 16) & 255, (lunghezza >> 8) & 255, lunghezza & 255];
    const coda = lunghezza % 2 === 0 ? [] : [0];

    return [].concat(testa, nomeBytes, dimensione, dati, coda);
}

// I primi 28 byte della risorsa descrivono la miniatura, il resto e' la JPEG.
function miniatura(jpeg) {
    return new Array(28).fill(0).concat(jpeg);
}

const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 0xFF, 0xD9];

test("la miniatura si ritrova dentro il psd", () => {
    const file = psdFinto(risorsa(1036, miniatura(JPEG)));

    assert.deepStrictEqual(Array.from(schedaRef.anteprimaDaPsd(file)), JPEG);
});

test("le risorse che vengono prima non fanno perdere la strada", () => {
    const file = psdFinto([].concat(
        risorsa(1005, [1, 2, 3, 4]),
        risorsa(1039, [9], "profilo"),
        risorsa(1036, miniatura(JPEG))));

    assert.deepStrictEqual(Array.from(schedaRef.anteprimaDaPsd(file)), JPEG);
});

// La 1033 e' la miniatura delle versioni antiche, con rosso e blu invertiti: mostrarla
// darebbe una foto dai colori sbagliati, meglio dire che non c'e'.
test("la miniatura vecchia con i colori invertiti non si usa", () => {
    const file = psdFinto(risorsa(1033, miniatura(JPEG)));

    assert.strictEqual(schedaRef.anteprimaDaPsd(file), null);
});

test("un psd senza miniatura torna niente", () => {
    const file = psdFinto(risorsa(1005, [1, 2, 3, 4]));

    assert.strictEqual(schedaRef.anteprimaDaPsd(file), null);
});

test("quello che non e' un psd non si prova nemmeno a leggere", () => {
    assert.strictEqual(schedaRef.anteprimaDaPsd(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3])), null);
    assert.strictEqual(schedaRef.anteprimaDaPsd(new Uint8Array(0)), null);
});

// Un file troncato a meta' non deve far esplodere il modal.
test("un psd tagliato non fa danni", () => {
    const intero = psdFinto(risorsa(1036, miniatura(JPEG)));

    assert.strictEqual(schedaRef.anteprimaDaPsd(intero.slice(0, intero.length - 4)), null);
    assert.strictEqual(schedaRef.anteprimaDaPsd(intero.slice(0, 20)), null);
});

test("il riquadro di proposta e l'anteprima di caricamento provano la miniatura", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    const usi = (sorgente.match(/this\.anteprimaDaPsd\(/g) || []).length;
    assert.strictEqual(usi, 2, "la miniatura serve in tutti e due i punti dove si mostra una foto");
});
