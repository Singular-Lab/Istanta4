/*
 * I20-1074: uscire dalla scheda aperta in vista controllata.
 *
 * Dal Report Integrita' (e dalla schermata delle segnalazioni) "Vai al box" apre la scheda ref in
 * vista controllata: home, menabo' e utility nascoste, eventi di InDesign fermi con isBusy. Ma molte
 * funzioni rimettono isBusy a false, e la vigilanza della scheda lo riafferma solo ogni 600 ms: una
 * deselezione caduta in mezzo mandava il Plugin alla home con le tre icone ancora nascoste.
 *
 * Ora il ciclo degli eventi tace finche' la vista controllata e' aperta, e deselezionare il box vale
 * come la X: lo decide la vigilanza, dopo due giri di fila senza selezione (Reimpagina rifa' il box
 * e per un momento non e' selezionato), mai mentre la scheda lavora.
 *
 * avvio.js si carica sotto Node; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const avvio = require("../../plugin/reportIntegrita/avvio.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio));
}

/* ---- la regola ---- */

test("la scheda si chiude dopo due vigilanze di fila senza selezione", () => {
    assert.strictEqual(avvio.VIGILANZE_DESELEZIONE, 2);

    const prima = avvio.contoDeselezione(0, 0, false);
    assert.deepStrictEqual(prima, { conto: 1, chiudi: false });
    assert.deepStrictEqual(avvio.contoDeselezione(prima.conto, 0, false), { conto: 2, chiudi: true });
});

test("una selezione in mezzo rimette il conto a zero", () => {
    assert.deepStrictEqual(avvio.contoDeselezione(1, 1, false), { conto: 0, chiudi: false });
    assert.deepStrictEqual(avvio.contoDeselezione(0, 3, false), { conto: 0, chiudi: false });
    assert.deepStrictEqual(avvio.contoDeselezione(undefined, 0, false), { conto: 1, chiudi: false });
});

test("mentre la scheda lavora o si riaggancia non si conta: il box rifatto non e' una deselezione", () => {
    assert.deepStrictEqual(avvio.contoDeselezione(1, 0, true), { conto: 0, chiudi: false });
    //Finita la pausa, servono di nuovo due giri.
    assert.deepStrictEqual(avvio.contoDeselezione(0, 0, false), { conto: 1, chiudi: false });
});

/* ---- dove si applica ---- */

test("con la vista controllata aperta il ciclo degli eventi tace, dopo il cancello isBusy", () => {
    const events = sorgente("events.js");
    const busy = events.indexOf("if (me.isBusy){");
    const vista = events.indexOf("if (me.vistaControllataAperta()) {");
    assert.ok(busy > 0 && vista > busy);
    //Il controllo che chiude il report al cambio di documento resta prima di tutti e due.
    assert.ok(events.indexOf("await me.controllaChiusuraReportIntegrita()") < busy);

    //In events.js i metodi sono di una classe: finiscono senza virgola.
    const inizioMetodo = events.indexOf("    vistaControllataAperta()");
    const metodo = events.substring(inizioMetodo, events.indexOf("\n    }\n", inizioMetodo));
    assert.match(metodo, /ReportIntegrita\.schedaDalReportAperta\(\)/);
    assert.match(metodo, /SchermataSegnalazioni\._schedaAperta != null/);
});

test("la vigilanza della scheda dal report chiude come la X quando il box e' deselezionato", () => {
    const report = sorgente("reportIntegrita/reportIntegrita.js");
    const vigila = corpoMembro(report, "    _vigilaSchedaDalReport() {");
    assert.match(vigila, /if \(!schedaRef\.serveRiaggancioDalReport\(stato\.box\)\) \{[\s\S]*?if \(this\._deselezionatoDaChiudere\(stato\)\) \{[\s\S]*?this\._chiudiSchedaDalReport\(\);/);

    const decide = corpoMembro(report, "    _deselezionatoDaChiudere(stato) {");
    assert.match(decide, /reportIntegritaAvvio\.contoDeselezione\(stato\.vigilanzeSenzaSelezione, this\._quantiSelezionati\(\), schedaRef\.isBusy === true\)/);
    //Se la selezione non si legge, la scheda resta aperta.
    assert.match(corpoMembro(report, "    _quantiSelezionati() {"), /catch \(err\) \{\s*return 1;/);
});

test("anche la scheda aperta dalle segnalazioni si chiude deselezionando il box", () => {
    const schermata = sorgente("segnalazioni/schermata.js");
    const vigila = corpoMembro(schermata, "    _vigilaScheda() {");
    assert.match(vigila, /if \(!schedaRef\.serveRiaggancioDalReport\(stato\.box\)\) \{[\s\S]*?if \(ReportIntegrita\._deselezionatoDaChiudere\(stato\)\) \{\s*SchermataSegnalazioni\.chiudiScheda\(\);/);
});
