/*
 * I20-1075: la finestra Differenze rilevate rifatta.
 *
 * Con le aggiunte degli ultimi task (azioni sulle foto extra, valori nel box e sul server, noRender,
 * descrizione da scegliere) la finestra era diventata un elenco di righe e sezioni tutte uguali.
 * Ora: in cima una riga di riepilogo, poi un riquadro per ogni elemento del box con i suoi problemi,
 * i valori e i pulsanti; sotto, richiudibile, la sezione delle segnalazioni di impaginazione,
 * aperta da sola solo quando non c'e' niente da risolvere. I20-1089: le "Risolte" (foto extra
 * decise e noRender) sono uscite dalla finestra: sono meta del box.
 *
 * schedaRef.js si carica sotto Node: le regole si provano direttamente, la resa sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");
const confronti = require("../../plugin/confronti.js");

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

test("la riga di riepilogo dice quanto c'e' da risolvere e le segnalazioni di impaginazione", () => {
    //I20-1089: le risolte non si contano piu' qui: sono meta del box.
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(4, 1), "4 da risolvere · 1 di impaginazione");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(1, 0), "1 da risolvere");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(0, 2), "Nessuna differenza fra il box e il dato · 2 di impaginazione");
    assert.strictEqual(schedaRef.testoRiepilogoFinestra(0, 0), "Tutte le segnalazioni risolte");
});

test("le sezioni secondarie si aprono da sole solo quando non c'e' niente da risolvere", () => {
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(0), true);
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(3), false);
    assert.strictEqual(schedaRef.sezioneApertaAllInizio(undefined), true);
});

test("la finestra: riquadri per elemento, impaginazione richiudibile, nel box e sul server in grassetto", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");

    const elenco = scheda.substring(scheda.indexOf("    riempiElencoSegnalazioni(contenitore"), scheda.indexOf("    testoRiepilogoFinestra("));
    assert.match(elenco, /this\.raggruppaPerElemento\(differenze\)\.forEach\(/);
    assert.match(elenco, /\$\('<div class="riquadroDifferenza"><\/div>'\)/);
    assert.match(elenco, /me\.testoDifferenza\(diff\)/);

    //La sezione secondaria passa dalla sezione richiudibile, e ogni apertura riparte da capo.
    //I20-1089: la sezione Risolte non c'e' piu'.
    assert.doesNotMatch(scheda, /this\.sezioneRichiudibile\(sezione, "risolte"/);
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

/* ---- le foto del dato, una volta ciascuna ---- */

//La primaria viaggia dentro membriGruppoFoto (statoSelezione 1) e sta anche in Foto.Nome: presa da
//tutti e due i posti, ogni sua segnalazione (non corrispondente, mancante nella cartella) usciva
//doppia nella finestra.
test("la foto della primaria si confronta una volta sola, anche se sta fra i membri e come foto della referenza", () => {
    const record = {
        "Foto.Nome": "680443_1_AD.psd", "Foto.Hash": "aa",
        membriGruppoFoto: [{ codRef: "680443", nomeFoto: "680443_1_AD.psd", statoSelezione: 1, hash: "aa" }]
    };
    assert.deepStrictEqual(confronti.fotoDelDatoDaConfrontare(record), [{ nomeFoto: "680443_1_AD.psd", hash: "aa" }]);
});

test("in un gruppo restano le secondarie e la primaria, senza ripetizioni e senza le non selezionate", () => {
    const record = {
        "Foto.Nome": "p.psd", "Foto.Hash": "p",
        membriGruppoFoto: [
            { nomeFoto: "p.psd", statoSelezione: 1, hash: "p" },
            { nomeFoto: "s1.psd", statoSelezione: 2, hash: "s1" },
            { nomeFoto: "s2.psd", statoSelezione: "2", hash: "s2" },
            { nomeFoto: "n.psd", statoSelezione: 0, hash: "n" },
            null
        ]
    };
    assert.deepStrictEqual(confronti.fotoDelDatoDaConfrontare(record).map(f => f.nomeFoto), ["s1.psd", "s2.psd", "p.psd"]);
});

test("senza membri o senza foto della referenza la lista ha solo quello che c'e'", () => {
    assert.deepStrictEqual(confronti.fotoDelDatoDaConfrontare({ "Foto.Nome": "p.psd", "Foto.Hash": "p" }), [{ nomeFoto: "p.psd", hash: "p" }]);
    assert.deepStrictEqual(
        confronti.fotoDelDatoDaConfrontare({ "Foto.Nome": "", membriGruppoFoto: [{ nomeFoto: "s.psd", statoSelezione: 2, hash: "s" }, { nomeFoto: "", statoSelezione: 2 }] }),
        [{ nomeFoto: "s.psd", hash: "s" }]);
    assert.deepStrictEqual(confronti.fotoDelDatoDaConfrontare({}), []);
    assert.deepStrictEqual(confronti.fotoDelDatoDaConfrontare(null), []);
});

test("la pre analisi della scheda passa al confronto quella lista, e non i membri uno per uno", async () => {
    const record = {
        StatoSelezione: 1, compiledFields: [], deletedFields: [], noRenderElementi: null,
        "Foto.Nome": "680443_1_AD.psd", "Foto.Hash": "aa",
        membriGruppoFoto: [
            { nomeFoto: "680443_1_AD.psd", statoSelezione: 1, hash: "aa" },
            { nomeFoto: "s.psd", statoSelezione: 2, hash: "s" }
        ]
    };
    const ricevute = [];
    const salvato = global.confronti;
    global.confronti = {
        fotoDelDatoDaConfrontare: confronti.fotoDelDatoDaConfrontare,
        confrontoBoxCompiledFieldPreAnalisi: async (box, campi, eliminati, listaFoto) => {
            ricevute.push(listaFoto);
            return { differenze: [], risolteNoRender: [] };
        },
        differenzeDeiMeta: () => []
    };
    try {
        await schedaRef.differenzeDatiNelBox({ isValid: true }, [{ recordInTracciato: record }]);
    }
    finally {
        if (salvato === undefined) { delete global.confronti; } else { global.confronti = salvato; }
    }
    assert.deepStrictEqual(ricevute, [[{ nomeFoto: "s.psd", hash: "s" }, { nomeFoto: "680443_1_AD.psd", hash: "aa" }]]);
});
