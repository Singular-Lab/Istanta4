/*
 * I20-971: data di caricamento mostrata sulle foto della schermata di cambio foto.
 *
 * Il modulo sotto test e' plugin/dataCaricamentoFoto.js, scritto senza dipendenze da
 * UXP/InDesign proprio per poter essere verificato qui.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DataCaricamentoFoto = require("../../plugin/dataCaricamentoFoto");

const cartellaPlugin = path.join(__dirname, "..", "..", "plugin");

function sorgente(nomeFile) {
    return fs.readFileSync(path.join(cartellaPlugin, nomeFile), "utf8");
}

test("una data valida si legge come giorno, mese e anno", () => {
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento("2026-09-17T14:32:11"), "17/09/2026");
});

test("giorno e mese portano lo zero davanti", () => {
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento("2026-01-05T00:00:00"), "05/01/2026");
});

test("un oggetto Date va bene quanto una stringa", () => {
    assert.strictEqual(
        DataCaricamentoFoto.formattaDataCaricamento(new Date(2026, 8, 17)),
        "17/09/2026");
});

test("una data assente non produce testo", () => {
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento(null), "");
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento(undefined), "");
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento(""), "");
});

test("una data non interpretabile non produce testo", () => {
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento("non una data"), "");
});

// Le righe piu' vecchie dell'archivio possono avere il valore di default della colonna:
// un badge con scritto 01/01/0001 sarebbe peggio di nessun badge.
test("una data non plausibile non produce testo", () => {
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento("0001-01-01T00:00:00"), "");
    assert.strictEqual(DataCaricamentoFoto.formattaDataCaricamento("1899-12-30T00:00:00"), "");
});

test("la foto mostra la data di inserimento", () => {
    const foto = { DataInserimento: "2026-09-17T10:00:00", DataModifica: "2026-09-20T10:00:00" };

    assert.strictEqual(DataCaricamentoFoto.dataDaMostrare(foto), "17/09/2026");
});

test("senza data di inserimento si ripiega su quella di modifica", () => {
    assert.strictEqual(
        DataCaricamentoFoto.dataDaMostrare({ DataInserimento: null, DataModifica: "2026-09-20T10:00:00" }),
        "20/09/2026");
    assert.strictEqual(
        DataCaricamentoFoto.dataDaMostrare({ DataInserimento: "0001-01-01T00:00:00", DataModifica: "2026-09-20T10:00:00" }),
        "20/09/2026");
});

test("una foto senza date non mostra alcun badge", () => {
    assert.strictEqual(DataCaricamentoFoto.dataDaMostrare({ Nome: "foto.psd" }), "");
    assert.strictEqual(DataCaricamentoFoto.dataDaMostrare(null), "");
});

// Senza la data nella proiezione del server il badge resterebbe vuoto per sempre, e
// nessun test del Plugin se ne accorgerebbe: la CI non esegue l'endpoint.
test("il server espone la data nell'elenco delle foto", () => {
    const controller = fs.readFileSync(
        path.join(__dirname, "..", "..", "Istanta", "Controllers", "SchedaArticoloController.cs"), "utf8");
    const inizio = controller.indexOf("getAllFotoDByCodice");
    const blocco = controller.slice(inizio, inizio + 1500);

    assert.ok(blocco.includes("DataInserimento = s.DataInserimento"),
        "la data di caricamento deve arrivare al Plugin");
});

test("la schermata di cambio foto disegna il badge", () => {
    const schedaRef = sorgente("schedaRef.js");

    assert.ok(schedaRef.includes("require('./dataCaricamentoFoto')"),
        "il modulo va caricato come gli altri del Plugin");
    assert.ok(schedaRef.includes("DataCaricamentoFoto.dataDaMostrare(item)"),
        "ogni foto della griglia deve calcolare la propria data");
    assert.ok(schedaRef.includes("${dataBadgeHtml}"),
        "il badge va inserito nella scheda della foto");
});
