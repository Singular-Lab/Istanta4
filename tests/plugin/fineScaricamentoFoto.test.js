/*
 * I20-1027: alla fine dello scaricamento del pacchetto foto l'operatore deve accorgersi che e'
 * finito. La finestra mostra un pulsante Fine, e solo alla fine vera: il sync completo scarica le
 * foto e poi, da solo, loghi e bolli, e fra le due fasi non deve dire "Operazione completata".
 *
 * La decisione vive in plugin/reperimentoFoto/fineScaricamento.js, senza dipendenze da InDesign, e
 * si prova qui. reperimentoFoto.js e index.html, che la applicano, non si caricano sotto Node: di
 * loro si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const fineScaricamento = require("../../plugin/reperimentoFoto/fineScaricamento");

const { modi, esiti, messaggi } = fineScaricamento;

/* ---- la regola ---- */

test("finite le foto del sync completo il processo non e' finito: niente Fine", () => {
    const stato = fineScaricamento.statoAlTermine(modi.pacchettoFoto, esiti.completato);

    assert.strictEqual(stato.concluso, false);
    assert.strictEqual(stato.mostraFine, false);
});

test("fra foto e loghi il messaggio non dice che l'operazione e' completata", () => {
    const stato = fineScaricamento.statoAlTermine(modi.pacchettoFoto, esiti.completato);

    assert.doesNotMatch(stato.messaggio, /complet/i);
    assert.match(stato.messaggio, /loghi/i);
});

test("finiti loghi e bolli il processo e' finito: Operazione completata e Fine", () => {
    const stato = fineScaricamento.statoAlTermine(modi.loghiBolli, esiti.completato);

    assert.deepStrictEqual(stato, { concluso: true, messaggio: messaggi.completata, mostraFine: true });
});

test("lo scaricamento di una lista di codici, dalla scheda, finisce con Fine", () => {
    const stato = fineScaricamento.statoAlTermine(modi.listaCodici, esiti.completato);

    assert.deepStrictEqual(stato, { concluso: true, messaggio: messaggi.completata, mostraFine: true });
});

test("un errore chiude il processo in ogni modo, e la finestra ha Fine per uscire", () => {
    for (const modo of [modi.pacchettoFoto, modi.loghiBolli, modi.listaCodici]) {
        const stato = fineScaricamento.statoAlTermine(modo, esiti.nonRiuscito);

        assert.strictEqual(stato.concluso, true, "modo " + modo);
        assert.strictEqual(stato.mostraFine, true, "modo " + modo);
        assert.strictEqual(stato.messaggio, messaggi.nonRiuscito, "modo " + modo);
    }
});

test("un errore non si annuncia come completato", () => {
    assert.doesNotMatch(messaggi.nonRiuscito, /complet/i);
});

test("un modo sconosciuto mostra Fine senza promettere che sia andato tutto bene", () => {
    const stato = fineScaricamento.statoAlTermine(7, esiti.completato);

    assert.strictEqual(stato.mostraFine, true);
    assert.doesNotMatch(stato.messaggio, /complet/i);
});

test("i modi sono quelli di avviaSyncPacchettoFoto", () => {
    assert.deepStrictEqual(modi, { pacchettoFoto: 0, loghiBolli: 1, listaCodici: 2 });
});

/* ---- dove la regola si applica ---- */

//Il modello della finestra in index.html: da <div id="dialogSyncPacchettoFoto" fino al div
//successivo di primo livello.
function modelloFinestra() {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const inizio = html.indexOf('<div id="dialogSyncPacchettoFoto"');
    assert.ok(inizio >= 0, "manca il modello dialogSyncPacchettoFoto");
    const fine = html.indexOf("\n</div>", inizio);
    return html.substring(inizio, fine);
}

test("il modello della finestra ha il pulsante Fine, nascosto, che chiude la finestra", () => {
    const pulsante = modelloFinestra().match(/<button id="fineSyncPacchettoFoto"[^>]*>([^<]*)<\/button>/);

    assert.ok(pulsante, "manca il pulsante fineSyncPacchettoFoto");
    assert.strictEqual(pulsante[1].trim(), "Fine");
    assert.match(pulsante[0], /display:\s*none/);
    assert.match(pulsante[0], /onclick="Modali\.chiudiModalCustom\('DownloadFoto'\)"/);
});

test("il pulsante sta nella parte dello scaricamento, non fra i pulsanti di avvio", () => {
    const modello = modelloFinestra();

    assert.ok(modello.indexOf('id="fineSyncPacchettoFoto"') > modello.indexOf('id="bodySyncPacchettoFoto"'));
});

test("Fine si tocca solo dentro la finestra aperta, mai nel modello di index.html", () => {
    //Un $("#fineSyncPacchettoFoto") globale, a finestra chiusa, troverebbe il modello: Fine
    //resterebbe visibile e comparirebbe gia' all'apertura successiva.
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js");
    const usi = sorgente.match(/[^\n]*#fineSyncPacchettoFoto[^\n]*/g) || [];

    assert.ok(usi.length >= 2, "Fine va nascosto all'avvio e mostrato alla fine");
    for (const riga of usi) {
        assert.match(riga, /\.find\("#fineSyncPacchettoFoto"\)/, riga.trim());
    }
    assert.doesNotMatch(sorgente, /\$\(\s*["']#fineSyncPacchettoFoto/);
});

test("la fine nella finestra passa dalla regola, per ognuno dei tre modi, con l'id dell'operazione", () => {
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js");

    assert.match(sorgente, /require\('\.\/fineScaricamento'\)/);
    assert.match(sorgente, /fineScaricamento\.statoAlTermine\(modo, esito\)/);
    for (const modo of [0, 1, 2]) {
        assert.match(sorgente, new RegExp("mostraFineScaricamento\\(" + modo + ", fineScaricamento\\.esiti\\.completato, codiceSyncFoto"), "modo " + modo);
        assert.match(sorgente, new RegExp("mostraFineScaricamento\\(" + modo + ", fineScaricamento\\.esiti\\.nonRiuscito, codiceSyncFoto"), "modo " + modo);
    }
});

test("alla fine vera l'operazione esce da syncFotoInCorso, anche sulle strade d'errore", () => {
    //Senza, dopo un errore apriSchermataSyncPacchettoFoto trovava l'id e rimostrava la finestra
    //chiusa e vuota invece di avviarne una nuova.
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    mostraFineScaricamento(modo, esito, idOperazione = null) {");
    assert.ok(inizio >= 0, "manca mostraFineScaricamento");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    assert.match(corpo, /if \(stato\.concluso && idOperazione != null\) \{\s*syncFotoInCorso = syncFotoInCorso\.filter\(id => id !== idOperazione\);/);
});
