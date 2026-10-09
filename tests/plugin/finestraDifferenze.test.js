/*
 * I20-1075: la finestra Differenze rilevate rifatta.
 *
 * Con le aggiunte degli ultimi task (azioni sulle foto extra, valori nel box e sul server, noRender,
 * descrizione da scegliere) la finestra era diventata un elenco di righe e sezioni tutte uguali.
 * Ora: in cima una riga di riepilogo, poi un riquadro per ogni elemento del box con i suoi problemi,
 * i valori e i pulsanti; sotto, richiudibili, le "Risolte" (foto extra decise e noRender insieme) e
 * le segnalazioni di impaginazione, aperte da sole solo quando non c'e' niente da risolvere.
 *
 * schedaRef.js si carica sotto Node: le regole si provano direttamente, la resa sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

test("le differenze si raggruppano per elemento, nell'ordine in cui arrivano", () => {
    const differenze = [
        { label: "6311123_1_T1.jpg", difference: "foto mancante nel box: 6311123_1_T1.jpg" },
        { label: "descrizione", difference: "contenuto" },
        { label: "6311123_1_T1.jpg", difference: "foto mancante nella cartella di lavorazione: 6311123_1_T1.jpg" },
        null
    ];
    const gruppi = schedaRef.raggruppaPerElemento(differenze);

    assert.deepStrictEqual(gruppi.map(g => g.label), ["6311123_1_T1.jpg", "descrizione"]);
    assert.strictEqual(gruppi[0].differenze.length, 2);
    assert.strictEqual(gruppi[1].differenze[0], differenze[1]);
    assert.deepStrictEqual(schedaRef.raggruppaPerElemento(null), []);
});

test("il problema si legge senza ripetere il nome dell'elemento, che sta nel titolo del riquadro", () => {
    assert.strictEqual(schedaRef.testoDifferenza({ label: "descrizione", difference: "contenuto" }), "Contenuto diverso");
    assert.strictEqual(schedaRef.testoDifferenza({ label: "descrizione", difference: "paragrafo" }), "Stile di paragrafo diverso");
    assert.strictEqual(schedaRef.testoDifferenza({ label: "prezzo", difference: "non presente" }), "Manca nel box");
    assert.strictEqual(schedaRef.testoDifferenza({ label: "x.jpg", difference: "foto mancante nel box: x.jpg" }), "Foto mancante nel box");
    assert.strictEqual(schedaRef.testoDifferenza({ label: "Logo_SDB", difference: "foto extraAuto mancante nel box: Logo_SDB" }), "Foto extraAuto mancante nel box");
    //Quello che non finisce col nome dell'elemento resta intero.
    assert.strictEqual(schedaRef.testoDifferenza({ label: "a", difference: "foto in più nel box: b" }), "Foto in più nel box: b");
    assert.strictEqual(schedaRef.testoDifferenza(null), "");
});

test("la riga di riepilogo dice quanto c'e' da risolvere, quanto e' risolto e le segnalazioni di impaginazione", () => {
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(4, 2, 1), "4 da risolvere · 2 risolte · 1 di impaginazione");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(1, 1, 0), "1 da risolvere · 1 risolta");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(0, 0, 2), "Nessuna differenza fra il box e il dato · 2 di impaginazione");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(0, 3, 0), "Tutte le segnalazioni risolte · 3 risolte");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(0, 0, 0), "Tutte le segnalazioni risolte");
});

test("le sezioni secondarie si aprono da sole solo quando non c'e' niente da risolvere", () => {
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(0), true);
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(3), false);
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(undefined), true);
});

test("la finestra: riquadri per elemento, Risolte e impaginazione richiudibili, nel box e sul server in grassetto", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");

    const elenco = scheda.substring(scheda.indexOf("    riempiElencoSegnalazioni(contenitore"), scheda.indexOf("    testoRiepilogoFinestra("));
    assert.match(elenco, /this\.raggruppaPerElemento\(differenze\)\.forEach\(/);
    assert.match(elenco, /\$\('<div class="riquadroDifferenza"><\/div>'\)/);
    assert.match(elenco, /me\.testoDifferenza\(diff\)/);

    //Le sezioni secondarie passano dalla stessa sezione richiudibile, e ogni apertura riparte da capo.
    assert.match(scheda, /this\.sezioneRichiudibile\(sezione, "risolte", "Risolte", quante\)/);
    assert.match(scheda, /this\.sezioneRichiudibile\(sezione, "impaginazione", "Segnalazioni di impaginazione", voci\.length\)/);
    assert.match(scheda, /this\.sezioniFinestra = \{\};/);

    //Chi ridisegna l'elenco dalla sezione del bollino passa le stesse azioni della finestra.
    assert.match(scheda, /this\.dopoAzioneFinestra = rifaiAnalisi;/);
    assert.match(scheda, /me\.riempiElencoSegnalazioni\(elenco, intestazione, me\.segnalazioniInMemoria\(\) \|\| \[\], me\.vociBollinoInMemoria\(\), me\.dopoAzioneFinestra\);/);

    //I pulsanti piccoli e chiari, tutti dallo stesso posto.
    const pulsante = scheda.substring(scheda.indexOf("    pulsanteFinestra(etichetta, suggerimento) {"), scheda.indexOf("    pulsanteFinestra(etichetta, suggerimento) {") + 700);
    assert.match(pulsante, /"background-color": "#ffffff"/);
    assert.match(scheda, /var pulsante = me\.pulsanteFinestra\(testi\[azione\]\[0\], testi\[azione\]\[1\]\);/);
});
