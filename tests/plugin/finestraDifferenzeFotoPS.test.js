/*
 * I20-1199: dalla finestra Differenze rilevate della scheda ref si passa direttamente a Foto P/S.
 *
 * Quasi tutte le differenze da risolvere sono sulle foto primarie e secondarie, e per sceglierle
 * bisognava chiudere la finestra e cliccare Foto P/S nel sottomenu. Ora il riquadro di ogni foto
 * mancante, non corrispondente o in piu' nel box ha "Vai a Foto P/S", prima delle altre azioni: la
 * finestra si chiude con la sua X e la scheda passa a Foto P/S. Le foto extra hanno le loro azioni, la
 * foto da ricollegare si ricollega dalla finestra e quella assente dalla cartella si sincronizza: su
 * queste il pulsante non c'e'.
 *
 * confronti.js e schedaRef.js si caricano sotto Node: le diciture vengono dalla preanalisi vera, e il
 * passaggio si prova con jQuery e il sottomenu finti.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");
const schedaRef = require("../../plugin/schedaRef.js");

const FOTO = { nomeFoto: "4526859_1_T5.psd", hash: "ABC" };
const NEI_LINKS = "/Volumes/lavorazioni/P2622/Links/4526859_1_T5.psd";

//Le differenze dello screenshot della issue, con le diciture di confronti.js.
const MANCANTE = { label: "6149843_1_T5.psd", difference: "foto mancante nel box: 6149843_1_T5.psd", tipo: "mancante", tipoElemento: "foto", chiave: "6149843_1_T5.psd" };
const NON_CORRISPONDENTE = confronti.segnalazioniFotoCollegata(FOTO, { missing: false, mismatch: true, hash: "DEF" }, false, NEI_LINKS)[0];
const IN_PIU = { label: "fotoNoFound.png", difference: "foto in più nel box: fotoNoFound.png" };

test("le foto primarie e secondarie da scegliere portano a Foto P/S", () => {
    assert.strictEqual(NON_CORRISPONDENTE.difference, "foto non corrispondente nel box: 4526859_1_T5.psd");
    assert.strictEqual(schedaRef.portaAFotoPS(MANCANTE), true);
    assert.strictEqual(schedaRef.portaAFotoPS(NON_CORRISPONDENTE), true);
    assert.strictEqual(schedaRef.portaAFotoPS(IN_PIU), true);
});

test("foto extra, collegamenti rotti, cartella di lavorazione e campi di testo non portano a Foto P/S", () => {
    const daRicollegare = confronti.segnalazioniFotoCollegata(FOTO, { missing: true, mismatch: false, hash: null }, true, NEI_LINKS)[0];
    const assenteDallaCartella = confronti.segnalazioniFotoCollegata(FOTO, { missing: true, mismatch: false, hash: null }, false, NEI_LINKS)[0];
    assert.strictEqual(daRicollegare.tipo, "linkRotto");
    assert.match(assenteDallaCartella.difference, /^foto mancante nella cartella di lavorazione/);

    [
        daRicollegare,
        assenteDallaCartella,
        { label: "Logo_SDB.png", difference: "foto extra mancante nel box: Logo_SDB.png", tipo: "extraMancante", sigla: "SDB" },
        { label: "SDB", difference: "foto extraAuto mancante nel box: SDB", tipo: "extraMancante", sigla: "SDB" },
        { label: "Logo_SDB.png", difference: "foto extra in più nel box originale: Logo_SDB.png", tipo: "extraInPiu", sigla: "SDB" },
        { label: "descrizione", difference: "contenuto" },
        { label: "prezzo", difference: "non presente", tipo: "mancante" },
        { label: "x" },
        null
    ].forEach(diff => assert.strictEqual(schedaRef.portaAFotoPS(diff), false, JSON.stringify(diff)));
});

test("Vai a Foto P/S chiude la finestra e apre la voce Foto P/S della scheda", async () => {
    const fatti = [];
    const voce = { tab: "Tab6" };
    const salvate = { $: global.$, jsIndexControls: global.jsIndexControls };
    const scheda = { chiudi: schedaRef.chiudiFinestraDifferenze, seleziona: schedaRef.selectSchedaRef };
    global.$ = selettore => ({ find: dentro => { fatti.push("cerca " + selettore + " " + dentro); return voce; } });
    global.jsIndexControls = {
        openTab: (evento, tab) => fatti.push("apri " + tab),
        changeImage: chi => fatti.push(chi === voce ? "accendi Foto P/S" : "accendi altro")
    };
    schedaRef.chiudiFinestraDifferenze = () => { fatti.push("chiudi finestra"); return true; };
    schedaRef.selectSchedaRef = async n => { fatti.push("scheda " + n); };
    try {
        await schedaRef.vaiAFotoPS();
    }
    finally {
        schedaRef.chiudiFinestraDifferenze = scheda.chiudi;
        schedaRef.selectSchedaRef = scheda.seleziona;
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
    assert.deepStrictEqual(fatti, [
        "chiudi finestra",
        'cerca .subTab5 img[tab="Tab6"]',
        "apri Tab6",
        "accendi Foto P/S",
        "scheda 2"
    ]);
});

test("il pulsante sta prima delle altre azioni della riga e lancia il passaggio", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const funzione = scheda.substring(scheda.indexOf("    aggiungiAzioniDifferenza(riga, diff, dopoAzione) {"),
                                      scheda.indexOf("    /* ---------- I20-1088: i meta dei testi del box da verificare ---------- */"));
    assert.match(funzione, /var azioni = \(this\.portaAFotoPS\(diff\) \? \["fotoPS"\] : \[\]\)\.concat\(this\.azioniPerDifferenza\(diff\)\);/);
    assert.match(funzione, /fotoPS: \["Vai a Foto P\/S", /);
    assert.match(funzione, /if \(azione === "fotoPS"\) \{\s*await me\.vaiAFotoPS\(\);\s*\}/);
    //Le decisioni sulla differenza restano quelle di prima: il passaggio non e' una di loro.
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(IN_PIU), []);
});
