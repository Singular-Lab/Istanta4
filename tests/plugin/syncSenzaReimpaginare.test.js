/*
 * I20-1067: il Report Integrita' non reimpagina i box mentre sincronizza i numeri di pagina.
 *
 * Costruendo il report, il Plugin sincronizza la mappa del documento col server
 * (syncImpaginatoConServer con impaginaETogliDaImpaginato). Il server registra i box che sono nel
 * documento ma non risultano sul server e li restituisce; il Plugin li passava all'impaginazione
 * singola, che con una differenza (un logo mancante) rifaceva il box e, col confronto, lasciava il
 * vecchio sfalsato di 10 punti: prima ancora di vedere il report. Ora un gruppo gia' nella mappa
 * del documento non si impagina: registrato lo e' gia', e le differenze le mostra il report.
 *
 * avvio.js si carica sotto Node; la sincronizzazione si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const avvio = require("../../plugin/reportIntegrita/avvio.js");

function gruppo(codiceGruppo, idRec, primario = true) {
    return [{ idRec: idRec, recordInTracciato: { "Scatto.CodiceGruppo": codiceGruppo, StatoSelezione: primario ? 1 : 2 } }];
}

const MAPPA = {
    "3": [{ codiceGruppo: "4569074", idRec: 120 }, { codiceGruppo: "3150596,3150599", idRec: 121 }],
    "4": [{ codiceGruppo: "777", idRec: 0 }]
};

test("un gruppo che la mappa del documento ha gia', con lo stesso idRec, non si rifa'", () => {
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 120), MAPPA), true);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("3150596,3150599", 121), MAPPA), true);
});

test("lo stesso codice con un altro idRec e' un'altra referenza", () => {
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 999), MAPPA), false);
});

test("se l'idRec manca da una delle due parti basta il codice gruppo", () => {
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 0), MAPPA), true);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("777", 55), MAPPA), true);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", undefined), MAPPA), true);
});

test("un gruppo che il documento non ha, o senza mappa, si impagina come prima", () => {
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("123456", 1), MAPPA), false);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 120), null), false);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 120), {}), false);
    assert.strictEqual(avvio.gruppoGiaNellaMappa([], MAPPA), false);
    assert.strictEqual(avvio.gruppoGiaNellaMappa(null, MAPPA), false);
    assert.strictEqual(avvio.gruppoGiaNellaMappa([{ recordInTracciato: {} }], MAPPA), false);
});

test("senza un primario conta il primo record del gruppo", () => {
    assert.strictEqual(avvio.gruppoGiaNellaMappa(gruppo("4569074", 120, false), MAPPA), true);
});

test("la sincronizzazione del report salta i box gia' nel documento prima di impaginare", () => {
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const corpo = report.substring(report.indexOf("async syncImpaginatoConServer("), report.indexOf("    percorsoFileReport("));
    assert.match(corpo,
        /let gruppoRecords = paginaObj\.records\[j\];\s*(\/\/[^\n]*\n\s*)*if \(reportIntegritaAvvio\.gruppoGiaNellaMappa\(gruppoRecords, mappa\)\) \{\s*continue;\s*\}\s*var box = await impaginazioneSingoloIndd\(gruppoRecords,/);
    //Saltare non e' un errore: CNF-012 resta solo per un'impaginazione tentata e fallita.
    const salto = corpo.indexOf("gruppoGiaNellaMappa");
    assert.ok(salto > 0 && salto < corpo.indexOf("Code CNF-012"));
});
