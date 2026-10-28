/*
 * Pagina attiva e selezione dopo l'impaginazione di un box.
 *
 * Impaginare un box selezionava sempre la pagina di destinazione: Page.select() la porta in vista
 * anche quando l'operatore ci sta gia' lavorando ingrandito, e la vista salta al centro della
 * pagina. Ora la pagina si attiva solo se non e' gia' quella attiva (Utility.attivaPaginaSeDiversa).
 * E dopo una reimpaginazione - Reimpagina box, la reimpaginazione proposta al cambio di primarie e
 * secondarie, un'azione sul box, il Fix del Report Integrita' - il box nuovo resta selezionato:
 * confrontoBox restituisce il box che sopravvive, impaginazioneSingoloIndd lo riporta in boxFinale,
 * e chi rifa' la referenza lo seleziona (Utility.selezionaBox).
 *
 * utility.js e indexNew.js non si caricano sotto Node: tutto si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio));
}

function corpoFunzione(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n}\n", inizio));
}

//Le righe di codice, senza quelle commentate: un select citato in un commento non e' codice.
function senzaCommenti(testo) {
    return testo.split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

test("la pagina si attiva solo se non e' gia' quella attiva, e senza finestra si seleziona come prima", () => {
    const utility = sorgente("utility.js");
    const attiva = corpoMembro(utility, "    attivaPaginaSeDiversa(pagina) {");
    assert.match(attiva, /const attiva = finestra != null \? finestra\.activePage : null;/);
    assert.match(attiva, /String\(attiva\.name\) === String\(pagina\.name\)/);
    //Pagina gia' attiva: si esce senza select.
    assert.match(attiva, /=== String\(pagina\.name\)\) \{\s*return false;/);
    //Altrimenti, o senza finestra, si seleziona.
    assert.match(attiva, /pagina\.select\(\);\s*return true;/);

    const seleziona = corpoMembro(utility, "    selezionaBox(box) {");
    assert.match(seleziona, /if \(box != null && box\.isValid\) \{\s*app\.selection = \[box\];\s*return true;/);
});

test("l'impaginazione non seleziona piu' la pagina direttamente", () => {
    const indexNew = sorgente("indexNew.js");
    const singola = senzaCommenti(corpoFunzione(indexNew, "async function impaginazioneSingoloIndd("));
    assert.match(singola, /Utility\.attivaPaginaSeDiversa\(page\);/);
    assert.doesNotMatch(singola, /\bpage\.select\(\)/);

    const conteggia = senzaCommenti(corpoFunzione(indexNew, "async function _conteggiaImpaginaConContesto("));
    assert.match(conteggia, /Utility\.attivaPaginaSeDiversa\(pagCoinvolta\);/);
    assert.doesNotMatch(conteggia, /\bpagCoinvolta\.select\(\)/);
});

test("confrontoBox dice quale box resta, in tutti e tre i rami, e l'impaginazione lo riporta in boxFinale", () => {
    const confronti = sorgente("confronti.js");
    const confronto = corpoMembro(confronti, "    async confrontoBox(box1, box2, forzaReimpaginazione = false){");
    assert.match(confronto, /let boxFinale = null;/);
    //Stessa label e si tiene il duplicato del vecchio: e' lui il box finale.
    assert.match(confronto, /boxFinale = box1Duplicate;\s*box2\.remove\(\);/);
    //Negli altri due rami sopravvive il nuovo.
    assert.strictEqual((confronto.match(/boxFinale = box2;\s*box2\.select\(\);/g) || []).length, 2);
    assert.match(confronto, /return \{ boxFinale: boxFinale \};/);
    assert.match(confronto, /catch \(error\) \{\s*console\.error\(error\);\s*return \{ boxFinale: null \};/);

    const indexNew = sorgente("indexNew.js");
    const singola = corpoFunzione(indexNew, "async function impaginazioneSingoloIndd(");
    assert.match(singola, /box\.boxFinale = box\.boxAggiunto;/);
    assert.match(singola, /const esitoConfronto = await confronti\.confrontoBox\(originalBox, box\.boxAggiunto\);\s*if \(esitoConfronto != null && esitoConfronto\.boxFinale != null\) \{\s*box\.boxFinale = esitoConfronto\.boxFinale;/);
});

test("Reimpagina box attende l'impaginazione e seleziona il box nuovo; il cambio di primarie la attende", () => {
    const scheda = sorgente("schedaRef.js");
    const reimpagina = corpoMembro(scheda, "    async applicaReimpaginazione(){");
    //I20-1063: il box si rifa' in rifaiBox, che usa anche il Reimpagina della selezione multipla.
    assert.match(reimpagina, /esito = await this\.rifaiBox\(schedaRef, this\.refSelected\.item\);/);
    const rifai = corpoMembro(scheda, "    async rifaiBox(schedaRef, boxPrecedente) {");
    assert.match(rifai, /var esito = await impaginazioneSingoloIndd\(schedaRef, pagina, false, null, false, bounds, false, false\);/);
    assert.match(reimpagina, /Utility\.selezionaBox\(esito != null \? \(esito\.boxFinale \|\| esito\.boxAggiunto\) : null\);/);

    const allinea = corpoMembro(scheda, "    async allineaBoxDopoSalvataggioPS(box, codiceBoxPrecedente) {");
    assert.strictEqual((allinea.match(/await me\.applicaReimpaginazione\(\);/g) || []).length, 2);
    assert.doesNotMatch(allinea, /[^t] me\.applicaReimpaginazione\(\);/);
});

test("l'azione sul box e il Fix del report lasciano selezionato il box che resta in pagina", () => {
    const scheda = sorgente("schedaRef.js");
    const cambio = corpoMembro(scheda, "    salvaCambioStrutturaleDo(params) {");
    assert.match(cambio, /var esitoConfronto = await confronti\.confrontoBox\(me\.refSelected\.item, res\.boxAggiunto\);/);
    assert.match(cambio, /Utility\.selezionaBox\(esitoConfronto != null && esitoConfronto\.boxFinale != null \? esitoConfronto\.boxFinale : res\.boxAggiunto\);/);

    const report = sorgente("reportIntegrita/reportIntegrita.js");
    const fix = corpoMembro(report, "    async _fixElemento(payloadId, payload) {");
    const rianalisi = fix.indexOf("await this._ricontrollaReferenzaDopoScheda(");
    const selezione = fix.indexOf("Utility.selezionaBox(boxNuovo);");
    assert.ok(rianalisi > 0 && selezione > rianalisi, "la selezione viene dopo la rianalisi");
});
