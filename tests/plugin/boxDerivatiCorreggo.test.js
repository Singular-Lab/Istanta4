/*
 * I20-1257: i box derivati verso Correggo4 e ritorno.
 *
 * Un box derivato ha lo stesso codice, codice gruppo e idRec del suo originale. L'esportazione dice
 * per ogni box chi e' (idRec, idLavRec, derivato e, per un derivato, l'originale), cosi' Correggo4 li
 * distingue. Al ritorno, una correzione su un derivato non si approva e non si applica (sul derivato si
 * mettono solo note); le correzioni dell'originale e quelle del derivato non finiscono nello stesso box;
 * e quando un box corretto ha dei derivati nel documento il Plugin lo dice (DRV-06), senza rifarli.
 *
 * Esecuzione: node --test tests/plugin/boxDerivatiCorreggo.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DnaBox = require("../../plugin/dnaBox.js");
const BoxDerivati = require("../../plugin/boxDerivati.js");
const correggo = require("../../plugin/reportIntegrita/sezioneCorreggo.js");

const RADICE = path.join(__dirname, "..", "..");
const { SCELTA, TIPO } = correggo;
const COOP = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json"), "utf8")).correzioniCorreggo;

function sorgente(relativo) {
    return fs.readFileSync(path.join(RADICE, relativo), "utf8").replace(/\r/g, "");
}

/* ---- l'esportazione ---- */

test("l'identita' per Correggo di un box originale non ha l'originale", () => {
    assert.deepStrictEqual(DnaBox.identitaPerCorreggo({ codice_gruppo: "G1", idRec: "10", idLavRec: 0 }),
        { idRec: 10, idLavRec: 0, derivato: false, originale: null });
});

test("l'identita' per Correggo di un derivato porta il suo idLavRec e l'originale", () => {
    assert.deepStrictEqual(DnaBox.identitaPerCorreggo({ codice_gruppo: "G1", idRec: "10", idLavRec: 55 }),
        { idRec: 10, idLavRec: 55, derivato: true, originale: { codiceGruppo: "G1", idRec: 10 } });
});

test("un box senza DNA leggibile vale come originale", () => {
    assert.deepStrictEqual(DnaBox.identitaPerCorreggo(null), { idRec: 0, idLavRec: 0, derivato: false, originale: null });
});

test("l'esportazione verso Correggo mette l'identita' del box in itemRefStringfied", () => {
    const fico = sorgente("plugin/ficoProcess.js");
    assert.ok(fico.includes("const DnaBox = require('./dnaBox');"));
    const posIdentita = fico.indexOf('objToStringy["Correggo.Box"] = DnaBox.identitaPerCorreggo(dna);');
    const posStringa = fico.indexOf("data.itemRefStringfied = JSON.stringify(objToStringy);");
    assert.ok(posIdentita > 0, "l'identita' del box non e' esportata");
    assert.ok(posIdentita < posStringa, "l'identita' va messa prima di serializzare itemRefStringfied");
});

/* ---- il ritorno: correzioni sul derivato ---- */

const box = (basecode, pagina, idLavRec) => ({
    basecode: basecode, labelBox: basecode, pagina: pagina, autore: "Marta Marketing", tipoAutore: "Marketing",
    idRec: 10, idLavRec: idLavRec, derivato: idLavRec > 0
});

function correzioniSulDerivato() {
    return [
        Object.assign({ id: "nota:1", tipo: "nota", testo: "storto" }, box("8001", 7, 55)),
        Object.assign({ id: "edit:2:offerta", tipo: "edit", parte: "offerta", campi: { prezzo_promo: "3.90" } }, box("8001", 7, 55)),
        Object.assign({ id: "timbro:3", tipo: "timbro", simbolo: "_4_2_alkg", nomeTimbro: "Al kg" }, box("8001", 7, 55))
    ];
}

test("sul derivato la nota si decide, le correzioni no e dicono perche'", () => {
    const voci = correggo.importa(correzioniSulDerivato(), COOP, true);

    const nota = voci.find(v => v.tipo === TIPO.nota);
    assert.strictEqual(nota.approvabile, true);
    assert.notStrictEqual(nota.suDerivato, true);

    const altre = voci.filter(v => v.tipo !== TIPO.nota);
    assert.ok(altre.length >= 2);
    altre.forEach(v => {
        assert.strictEqual(v.suDerivato, true);
        assert.strictEqual(v.approvabile, false);
        assert.strictEqual(v.scelta, SCELTA.nessuna, "una correzione automatica su un derivato non arriva su Approva");
        assert.ok(v.testo.startsWith(correggo.MOTIVO_DERIVATO));
        assert.strictEqual(correggo.scegli(v, SCELTA.approva, true), false);
    });
    assert.ok(correggo.MOTIVO_DERIVATO.includes("box originale"));
});

test("la nota approvata sul derivato si chiude senza toccare l'impaginato", () => {
    const voci = correggo.importa(correzioniSulDerivato(), COOP, true);
    voci.forEach(v => correggo.scegli(v, SCELTA.approva, true));

    const piano = correggo.pianoDellaConferma(voci);
    assert.deepStrictEqual(piano.box, []);
    assert.deepStrictEqual(piano.senzaLavoro.map(v => v.idCorrezione), ["nota:1"]);
});

test("originale e derivato con lo stesso codice nella stessa pagina sono due box del piano", () => {
    const voceDi = (idLavRec) => ({ chiave: "k" + idLavRec, tipo: TIPO.prezzi, scelta: SCELTA.approva, basecode: "8001", pagina: 3, idLavRec: idLavRec, campi: {} });
    const piano = correggo.pianoDellaConferma([voceDi(0), voceDi(55)]);
    assert.deepStrictEqual(piano.box.map(p => p.idLavRec).sort(), [0, 55]);
});

test("la conferma non applica una correzione del derivato e cerca solo l'originale", () => {
    const report = sorgente("plugin/reportIntegrita/reportIntegrita.js");
    const inizio = report.indexOf("async _applicaCorrezioniAlBox(p, esiti, motivi, derivati = null) {");
    assert.ok(inizio > 0);
    const corpo = report.slice(inizio, report.indexOf("_applicaFotoCorreggo", inizio));
    const fermo = corpo.indexOf("if (DnaBox.idValido(p.idLavRec) > 0) {");
    const ricerca = corpo.indexOf("this._resolveBoxByCodiceGruppo({ codiceGruppo: p.basecode, numeroPagina: p.pagina, elementoMappa: { idLavRec: 0 } })");
    assert.ok(fermo > 0 && ricerca > fermo, "il fermo del derivato va prima della ricerca del box");
    assert.ok(corpo.includes("fallisce(p.voci, sezioneCorreggo.MOTIVO_DERIVATO);"));
});

/* ---- i derivati del box corretto: solo l'avviso ---- */

test("l'avviso DRV-06 dopo le correzioni dice quanti derivati e dove", () => {
    const testo = BoxDerivati.testoAvvisoDerivati([{ pagina: "7" }, { pagina: "9" }], "I box corretti da Correggo hanno");
    assert.strictEqual(testo, "Code DRV-06 I box corretti da Correggo hanno 2 derivati nel documento, a pagina 7, 9: vanno reimpaginati per prendere il dato nuovo.");
    assert.strictEqual(BoxDerivati.testoAvvisoDerivati([]), null);
    // la scheda continua a dirlo come prima
    assert.ok(BoxDerivati.testoAvvisoDerivati([{ pagina: "7" }]).startsWith("Code DRV-06 Questo box ha 1 derivato"));
});

test("la conferma avvisa dei derivati dei box rifatti e non li rifa'", () => {
    const report = sorgente("plugin/reportIntegrita/reportIntegrita.js");
    assert.ok(report.includes("const BoxDerivati = require('../boxDerivati');"));
    assert.ok(report.includes("await this._applicaCorrezioniAlBox(p, esiti, motivi, derivati);"));
    assert.ok(report.includes("BoxDerivati.derivatiNelDocumento(docInLavorazione, p.basecode, idRec, Utility.getDnaOfBox)"));
    assert.ok(report.includes('BoxDerivati.testoAvvisoDerivati(derivati, "I box corretti da Correggo hanno")'));
    const inizio = report.indexOf("const segnaDerivati = () => {");
    const corpo = report.slice(inizio, report.indexOf("_applicaFotoCorreggo", inizio));
    assert.ok(!/rifaiBox\([^)]*derivat/.test(corpo), "i derivati non si rifanno da soli");
});
