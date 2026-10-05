/*
 * I20-1035: la barra di scorrimento orizzontale della lista dei tracciati della Home.
 *
 * E' la replica della barra dei Nuovi del Report Integrita' (reportIntegrita/pannelli.js,
 * I20-981), in indexNew.js accanto alle funzioni che costruiscono la lista. In UXP la lista non
 * scorre in orizzontale in nessun modo nativo: la tabella si sposta con un margin-left negativo e
 * la barra la disegna il Plugin, con i conti di reportIntegrita/barraScorrimento.js.
 *
 * indexNew.js non si carica sotto Node: si controlla il sorgente, con gli stessi controlli che
 * reportIntegritaFlusso.test.js fa sulla barra dei Nuovi, piu' quelli che servono alla Home.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

//Il corpo di una funzione di primo livello: dall'intestazione alla prima riga "}" a inizio riga.
function corpoFunzione(intestazione) {
    const inizio = sorgente.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata: il test va aggiornato");
    const fine = sorgente.indexOf("\n}\n", inizio);
    assert.notStrictEqual(fine, -1, intestazione + " senza fine");
    return sorgente.substring(inizio, fine);
}

test("i conti della barra sono quelli del Report Integrita'", () => {
    assert.match(sorgente, /const barraScorrimento = require\('\.\/reportIntegrita\/barraScorrimento'\);/);
    assert.match(sorgente, /const PASSO_SCORRIMENTO_TRACCIATO = 160;/);
});

test("la barra funziona anche senza trascinamento, come quella dei Nuovi", () => {
    //Frecce e clic sulla traccia usano solo "click": se il trascinamento non arrivasse, la
    //tabella si scorre lo stesso.
    const barra = corpoFunzione("function crBarraScorrimentoTracciato(state) {");

    assert.match(barra, /indietro\.addEventListener\("click"/);
    assert.match(barra, /avanti\.addEventListener\("click"/);
    assert.match(barra, /traccia\.addEventListener\("click"/);
    assert.match(barra, /cursore\.addEventListener\("mousedown"/);
    assert.match(barra, /PASSO_SCORRIMENTO_TRACCIATO/);

    //I conti stanno nel modulo verificato, non qui.
    assert.match(barra, /barraScorrimento\.spostamentoDaClic/);
});

test("scorrere sposta #Tab1Table con un margine negativo, dentro i limiti", () => {
    const scorri = corpoFunzione("function scorriTracciato(state, spostamento) {");

    assert.match(scorri, /document\.getElementById\("Tab1Table"\)/);
    assert.match(scorri, /barraScorrimento\.limitaSpostamento/);
    assert.match(scorri, /table\.style\.marginLeft = "-" \+ state\.spostamento \+ "px"/);
    assert.match(scorri, /aggiornaCursoreTracciato\(state, misure\)/);
});

test("le misure si leggono al momento, dalla tabella e dalla lista che la taglia", () => {
    const misure = corpoFunzione("function misureScorrimentoTracciato(state) {");

    assert.match(misure, /document\.getElementById\("Tab1Table"\)\?\.scrollWidth/);
    assert.match(misure, /document\.getElementById\("Tab1Viewport"\)\?\.clientWidth/);
    assert.match(misure, /clientWidth/);
});

test("il cursore e la comparsa della barra vengono da barraScorrimento", () => {
    const cursore = corpoFunzione("function aggiornaCursoreTracciato(state, misure) {");

    assert.match(cursore, /barraScorrimento\.serveLaBarra/);
    assert.match(cursore, /barraScorrimento\.geometriaCursore/);
    assert.match(cursore, /state\.barra\.style\.display = \(m\.visibile > 0 && !serve\) \? "none" : "flex"/);
});

test("il trascinamento si ascolta sul documento, una volta sola", () => {
    const trascinamento = corpoFunzione("function abilitaTrascinamentoBarraTracciato() {");

    assert.match(trascinamento, /if \(trascinamentoBarraTracciatoAttivo\) \{\s*return;/);
    assert.match(trascinamento, /\$\(document\)\.on\("mousemove"/);
    assert.match(trascinamento, /\$\(document\)\.on\("mouseup"/);
    assert.match(trascinamento, /barraScorrimento\.spostamentoDaTrascinamento/);
});

test("la barra nasce una volta, subito sotto la lista", () => {
    const assicura = corpoFunzione("function assicuraBarraScorrimentoTracciato() {");

    assert.match(assicura, /document\.getElementById\("Tab1Viewport"\)/);
    assert.match(assicura, /document\.getElementById\("barraScorrimentoTracciato"\) == null/);
    assert.match(assicura, /\$\(lista\)\.after\(crBarraScorrimentoTracciato\(state\)\)/);
    assert.match(corpoFunzione("function crBarraScorrimentoTracciato(state) {"), /barra\.id = "barraScorrimentoTracciato";/);
});

test("dopo ogni ricostruzione della lista la tabella torna dove dice lo spostamento", () => {
    const aggiorna = corpoFunzione("async function aggiornaTracciatoPostRicerca(resRicerca) {");

    const righe = aggiorna.indexOf("$body.append(frag);");
    const barra = aggiorna.indexOf("assicuraBarraScorrimentoTracciato();");
    const scorri = aggiorna.indexOf("scorriTracciato(statoBarra,");
    assert.ok(righe >= 0 && barra > righe && scorri > barra, "prima le righe, poi la barra, poi lo spostamento");
});

test("al ridimensionamento: altezza, barra, altezza, prima delle uscite anticipate", () => {
    const resize = corpoFunzione("function onResizeTab1Tracciato(){");
    const altezza = "AltezzaScorrimento.fissaAltezza(contenitoreTab, listaTracciato, { margine: AltezzaScorrimento.MARGINE + altezzaBarraScorrimentoTracciato() });";

    const prima = resize.indexOf(altezza);
    const barra = resize.indexOf("scorriTracciato(statoBarraTracciato, statoBarraTracciato.spostamento || 0);");
    const dopo = resize.indexOf(altezza, prima + 1);

    assert.ok(prima >= 0 && barra > prima && dopo > barra, "altezza, barra, altezza: in quest'ordine");
    assert.ok(dopo < resize.indexOf("return;"), "prima delle uscite anticipate");
});

test("l'altezza della barra conta solo quando la barra si vede", () => {
    const altezza = corpoFunzione("function altezzaBarraScorrimentoTracciato() {");

    assert.match(altezza, /barra == null \|\| barra\.style\.display === "none"\) \{\s*return 0;/);
    assert.match(altezza, /getBoundingClientRect\(\)\.height/);
});

test("la barra dei Nuovi del Report Integrita', il modello, c'e' ancora", () => {
    //Se un giorno cambiasse, questa replica va riallineata: e' scritto anche nella documentazione.
    const pannelli = leggiFileDelPlugin("reportIntegrita/pannelli.js");

    assert.match(pannelli, /_crBarraScorrimentoNuovi\(state\) \{/);
    assert.match(pannelli, /PASSO_SCORRIMENTO: 160,/);
});

//I20-1043: la lista mostrava anche la barra orizzontale nativa, subito sopra la nostra. In UXP non
//scorre (vedi sopra): era un doppione. In orizzontale si taglia, in verticale resta la rotella.
test("la lista non ha la barra orizzontale nativa, e in verticale scorre ancora", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");

    const regola = html.substring(html.indexOf("#Tab1Viewport {"), html.indexOf("}", html.indexOf("#Tab1Viewport {")));
    assert.match(regola, /overflow-x: hidden;/);
    assert.match(regola, /overflow-y: auto;/);
    assert.doesNotMatch(regola, /(^|\s)overflow: /);

    const tag = html.match(/<div id="Tab1Viewport" style="([^"]*)">/);
    assert.ok(tag, "manca #Tab1Viewport");
    assert.match(tag[1], /overflow-x:\s*hidden;/);
    assert.match(tag[1], /overflow-y:\s*auto;/);
    assert.doesNotMatch(tag[1], /(^|[;\s])overflow:/);
});
