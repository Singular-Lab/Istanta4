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

// Le foto vanno dalla piu' nuova alla piu' vecchia, per data di caricamento.
test("le foto si ordinano dalla piu' nuova alla piu' vecchia", () => {
    const lista = [
        { Nome: "vecchia.psd", DataInserimento: "2024-03-01T10:00:00" },
        { Nome: "nuova.psd", DataInserimento: "2026-09-10T10:00:00" },
        { Nome: "media.psd", DataInserimento: "2025-06-15T10:00:00" }
    ];

    const ordinata = DataCaricamentoFoto.ordinaDallaPiuNuova(lista);

    assert.deepStrictEqual(ordinata.map(f => f.Nome), ["nuova.psd", "media.psd", "vecchia.psd"]);
});

test("senza data di inserimento l'ordinamento usa quella di modifica", () => {
    const lista = [
        { Nome: "a.psd", DataInserimento: null, DataModifica: "2024-01-01T10:00:00" },
        { Nome: "b.psd", DataInserimento: null, DataModifica: "2026-01-01T10:00:00" }
    ];

    assert.deepStrictEqual(
        DataCaricamentoFoto.ordinaDallaPiuNuova(lista).map(f => f.Nome),
        ["b.psd", "a.psd"]);
});

test("le foto senza data finiscono in fondo, nell'ordine in cui sono arrivate", () => {
    const lista = [
        { Nome: "senzaData1.psd" },
        { Nome: "datata.psd", DataInserimento: "2025-05-05T10:00:00" },
        { Nome: "senzaData2.psd", DataInserimento: "0001-01-01T00:00:00" }
    ];

    assert.deepStrictEqual(
        DataCaricamentoFoto.ordinaDallaPiuNuova(lista).map(f => f.Nome),
        ["datata.psd", "senzaData1.psd", "senzaData2.psd"]);
});

test("a parita' di data l'ordine di partenza non cambia", () => {
    const lista = [
        { Nome: "prima.psd", DataInserimento: "2026-02-02T09:00:00" },
        { Nome: "seconda.psd", DataInserimento: "2026-02-02T09:00:00" },
        { Nome: "terza.psd", DataInserimento: "2026-02-02T09:00:00" }
    ];

    assert.deepStrictEqual(
        DataCaricamentoFoto.ordinaDallaPiuNuova(lista).map(f => f.Nome),
        ["prima.psd", "seconda.psd", "terza.psd"]);
});

test("l'ordinamento non altera la lista ricevuta", () => {
    const lista = [
        { Nome: "vecchia.psd", DataInserimento: "2024-03-01T10:00:00" },
        { Nome: "nuova.psd", DataInserimento: "2026-09-10T10:00:00" }
    ];

    DataCaricamentoFoto.ordinaDallaPiuNuova(lista);

    assert.strictEqual(lista[0].Nome, "vecchia.psd");
});

// La foto in uso si mostra in cima a tutta la schermata, e una sola volta.
test("la foto attuale esce dalla sua lista", () => {
    const lista = [
        { Id: 1, Nome: "a.psd" },
        { Id: 2, Nome: "attuale.psd" },
        { Id: 3, Nome: "c.psd" }
    ];

    const esito = DataCaricamentoFoto.estraiAttuale(lista, 2);

    assert.strictEqual(esito.attuale.Nome, "attuale.psd");
    assert.deepStrictEqual(esito.resto.map(f => f.Nome), ["a.psd", "c.psd"]);
});

test("senza foto attuale la lista resta intatta", () => {
    const lista = [{ Id: 1, Nome: "a.psd" }, { Id: 2, Nome: "b.psd" }];

    assert.strictEqual(DataCaricamentoFoto.estraiAttuale(lista, null).attuale, null);
    assert.deepStrictEqual(DataCaricamentoFoto.estraiAttuale(lista, null).resto.map(f => f.Nome), ["a.psd", "b.psd"]);
    assert.strictEqual(DataCaricamentoFoto.estraiAttuale(lista, 99).attuale, null);
    assert.deepStrictEqual(DataCaricamentoFoto.estraiAttuale(lista, 99).resto.length, 2);
});

test("la schermata disegna la foto attuale prima delle altre sezioni", () => {
    const schedaRef = sorgente("schedaRef.js");

    const sezioneAttuale = schedaRef.indexOf('<div id="sectionFotoAttualeWrapper"');
    const sezioneEsistenti = schedaRef.indexOf('<div id="sectionFotoEsistenti"></div>');

    assert.ok(sezioneAttuale > 0 && sezioneEsistenti > 0);
    assert.ok(sezioneAttuale < sezioneEsistenti, "la foto attuale va in cima a tutta la schermata");
    assert.ok(schedaRef.includes("DataCaricamentoFoto.estraiAttuale("),
        "la foto attuale va estratta dal suo gruppo per non comparire due volte");
    assert.ok(schedaRef.includes("DataCaricamentoFoto.ordinaDallaPiuNuova("),
        "le liste vanno ordinate dalla piu' nuova");
});

test("caricando un file dal disco sparisce anche la sezione della foto attuale", () => {
    const schedaRef = sorgente("schedaRef.js");
    const ramoUpload = schedaRef.indexOf("$('#sectionFotoEsistenti').hide();");
    const blocco = schedaRef.slice(ramoUpload - 400, ramoUpload + 200);

    assert.ok(blocco.includes("$('#sectionFotoAttualeWrapper').hide();"),
        "altrimenti resterebbe l'unica sezione visibile sotto l'anteprima del file");
});
