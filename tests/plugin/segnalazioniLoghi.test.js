/*
 * I20-1068: la preanalisi segnala una volta sola il logo con l'immagine cambiata.
 *
 * Il confronto fra il box e il dato catalogava le foto extra del box per nome di file e cercava
 * ogni foto extra del server con quel nome: un logo con la stessa sigla ma un'immagine nuova
 * usciva due volte, "foto extraAuto mancante nel box: nuova.psd" e "foto extra in piu' nel box
 * originale: vecchia.psd". Ora la catalogazione tiene anche la sigla della label
 * (foto_extra$<sigla>$tipo_<n>), e a sigla uguale con immagine diversa la segnalazione e' una,
 * con i due nomi. Vale per le foto extra automatiche e, per sicurezza, anche per quelle manuali.
 *
 * confronti.js si carica sotto Node: il membro che decide si prova direttamente, il resto sul
 * sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");

const NEL_BOX = [
    { nome: "Logo_BDP_2025.psd", sigla: "Logo_BDP" },
    { nome: "Logo_SDB.psd", sigla: "Logo_SDB" }
];

/* ---- la decisione ---- */

test("stessa sigla e immagine diversa: una sola segnalazione, con i due nomi", () => {
    const foto = { nome: "Logo_BDP_2026.psd", sigla: "Logo_BDP" };

    const esito = confronti.fotoExtraConImmagineCambiata(foto, ["Logo_BDP_2025.psd", "Logo_SDB.psd"], NEL_BOX, "foto extraAuto");

    assert.strictEqual(esito.nomeNelBox, "Logo_BDP_2025.psd");
    assert.strictEqual(esito.differenza.label, "Logo_BDP");
    assert.strictEqual(esito.differenza.difference, "foto extraAuto con immagine diversa da quella del server: nel box Logo_BDP_2025.psd, sul server Logo_BDP_2026.psd");
    //I20-1070: i campi per le azioni della finestra delle differenze stanno in extraLavorazione.test.js.
    assert.strictEqual(esito.differenza.tipo, "immagineExtraCambiata");
});

test("il prefisso distingue le foto extra manuali da quelle automatiche", () => {
    const esito = confronti.fotoExtraConImmagineCambiata({ nome: "Logo_BDP_2026.psd", sigla: "Logo_BDP" }, ["Logo_BDP_2025.psd"], NEL_BOX, "foto extra");

    assert.match(esito.differenza.difference, /^foto extra con immagine diversa/);
});

test("sigla diversa: nessuna unificazione, restano mancante e in piu'", () => {
    const foto = { nome: "Logo_Filiera.psd", sigla: "Logo_filiera" };

    assert.strictEqual(confronti.fotoExtraConImmagineCambiata(foto, ["Logo_BDP_2025.psd", "Logo_SDB.psd"], NEL_BOX, "foto extraAuto"), null);
});

test("un elemento gia' spiegato da un'altra foto non si usa", () => {
    //Il file del box con quella sigla non e' piu' fra i nomi da spiegare.
    const foto = { nome: "Logo_BDP_2026.psd", sigla: "Logo_BDP" };

    assert.strictEqual(confronti.fotoExtraConImmagineCambiata(foto, ["Logo_SDB.psd"], NEL_BOX, "foto extraAuto"), null);
});

test("con due elementi della stessa sigla si prende quello ancora da spiegare", () => {
    const doppi = [
        { nome: "Logo_BDP_2024.psd", sigla: "Logo_BDP" },
        { nome: "Logo_BDP_2025.psd", sigla: "Logo_BDP" }
    ];

    const esito = confronti.fotoExtraConImmagineCambiata({ nome: "Logo_BDP_2026.psd", sigla: "Logo_BDP" }, ["Logo_BDP_2025.psd"], doppi, "foto extraAuto");

    assert.strictEqual(esito.nomeNelBox, "Logo_BDP_2025.psd");
});

test("lo stesso file non e' un'immagine cambiata, e senza sigla non si decide niente", () => {
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "Logo_BDP_2025.psd", sigla: "Logo_BDP" }, ["Logo_BDP_2025.psd"], NEL_BOX, "foto extraAuto"), null);
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "x.psd", sigla: "" }, ["Logo_BDP_2025.psd"], NEL_BOX, "foto extraAuto"), null);
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "x.psd" }, ["Logo_BDP_2025.psd"], NEL_BOX, "foto extraAuto"), null);
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata(null, ["Logo_BDP_2025.psd"], NEL_BOX, "foto extraAuto"), null);
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "x.psd", sigla: "Logo_BDP" }, null, NEL_BOX, "foto extraAuto"), null);
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "x.psd", sigla: "Logo_BDP" }, ["Logo_BDP_2025.psd"], null, "foto extraAuto"), null);
});

/* ---- dove si usa ---- */

test("la catalogazione delle foto extra del box tiene la sigla della label", () => {
    const testo = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");

    assert.match(testo, /let classificato = NoRenderElementi\.classificaLabel\(campo\.label, pluginMiddleware\.getCampo\("nomeFotoPrimaria"\), pluginMiddleware\.getCampo\("nomeFotoSecondaria"\)\);/);
    assert.match(testo, /tipo: "extra",\s*data: nomeFile,\s*sigla: classificato != null \? classificato\.chiave : ""/);
    //I20-1070: accanto a nome e sigla viaggiano anche tipo e tipo_N della label.
    assert.match(testo, /let extraNelBox = risultati\s*\.filter\(x => x\?\.tipo === "extra"\)\s*\.map\(x => \(\{ nome: x\.data, sigla: x\.sigla, tipoElemento: x\.tipoElemento, tipoFoto: x\.tipoFoto \}\)\);/);
});

test("i rami delle foto extra manuali e automatiche chiedono prima se l'immagine e' cambiata", () => {
    const testo = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");
    const inizio = testo.indexOf("async confrontoBoxCompiledFieldPreAnalisi(");
    const corpo = testo.substring(inizio, testo.indexOf("\n    fotoExtraConImmagineCambiata(", inizio));

    //Manuali: prima del "mancante", e il file del box esce dagli "in piu'".
    const manuale = corpo.indexOf('confronti.fotoExtraConImmagineCambiata(foto, listFotoExtraBox1, extraNelBox, "foto extra");');
    const mancanteManuale = corpo.indexOf('"foto extra mancante nel box: "');
    assert.ok(manuale > 0 && manuale < mancanteManuale, "il ramo manuale decide prima di segnalare mancante");

    //Automatiche: nel ramo delle immagini, prima del "mancante".
    const automatica = corpo.indexOf('confronti.fotoExtraConImmagineCambiata(foto, listFotoExtraBox1, extraNelBox, "foto extraAuto");');
    const mancanteAutomatica = corpo.lastIndexOf('"foto extraAuto mancante nel box: " + foto.nome');
    assert.ok(automatica > 0 && automatica < mancanteAutomatica, "il ramo automatico decide prima di segnalare mancante");

    assert.strictEqual((corpo.match(/listFotoExtraBox1 = listFotoExtraBox1\.filter\(f => f != cambiata\.nomeNelBox\);/g) || []).length, 2);
});
