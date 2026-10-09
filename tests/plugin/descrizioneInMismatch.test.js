/*
 * I20-1075: la descrizione in mismatch si sistema dalla finestra delle differenze.
 *
 * Sotto "descrizione / contenuto" la finestra mostra il testo nel box e quello del server (I20-1071).
 * Da li' l'operatore sceglie quale e' giusto: "Scegli quella del server" fa quello che fa "Applica
 * descrizione da server" e poi rifa' la finestra; "Scegli quella del box" salva la descrizione del box
 * nel dato, come il Salva modifiche della scheda ma mandandola per intero.
 *
 * schedaRef.js si carica sotto Node: le decisioni si provano direttamente, il resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

const CONTENUTO = { label: "descrizione", difference: "contenuto", valoreLocale: "Lonza dissossata di suino", valoreServer: "Arista dissossata di suino" };

function conScheda(compiledFields, prova) {
    const salva = schedaRef.schedeRefDati;
    schedaRef.schedeRefDati = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: compiledFields } }];
    try {
        prova();
    }
    finally {
        schedaRef.schedeRefDati = salva;
    }
}

const DESCRIZIONE = [{ labelName: "descrizione", content: "<DES_descr_nome>Arista dissossata di suino</DES_descr_nome>" }];

test("sulla differenza di contenuto della descrizione si sceglie fra box e server", () => conScheda(DESCRIZIONE, () => {
    //Prima quella del server, poi quella del box, come le ha chieste l'operatore.
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(CONTENUTO), ["descrizioneServer", "descrizioneBox"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(Object.assign({}, CONTENUTO, { label: "Descrizione" })), ["descrizioneServer", "descrizioneBox"]);
}));

test("non sul paragrafo, non su altri campi, non senza la descrizione del server", () => {
    conScheda(DESCRIZIONE, () => {
        assert.deepStrictEqual(schedaRef.azioniPerDifferenza(Object.assign({}, CONTENUTO, { difference: "paragrafo" })), []);
        assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "campo_offerta", difference: "contenuto" }), []);
    });
    conScheda([], () => {
        assert.deepStrictEqual(schedaRef.azioniPerDifferenza(CONTENUTO), []);
    });
});

test("scegli quella del box: si chiude la finestra e si salva la scheda con la descrizione per intero", () => {
    const eventi = [];
    const salvaGlobali = { $: global.$, messaggioUtente: global.messaggioUtente };
    global.$ = (selettore) => ({ length: 1, trigger: (evento) => eventi.push(selettore + " " + evento) });
    global.messaggioUtente = () => {};
    try {
        assert.strictEqual(schedaRef.tieniDescrizioneDelBox(), true);
        assert.deepStrictEqual(eventi, ["#popupCloseButton click", "#salvaButton click"]);
        assert.strictEqual(schedaRef.salvaConDescrizioneDelBox, true);
    }
    finally {
        schedaRef.salvaConDescrizioneDelBox = false;
        Object.keys(salvaGlobali).forEach(k => { if (salvaGlobali[k] === undefined) { delete global[k]; } else { global[k] = salvaGlobali[k]; } });
    }
});

test("senza il pulsante di salvataggio non si fa niente, e lo si dice", () => {
    const messaggi = [];
    const salvaGlobali = { $: global.$, messaggioUtente: global.messaggioUtente };
    global.$ = () => ({ length: 0, trigger: () => { throw new Error("niente da premere"); } });
    global.messaggioUtente = (testo) => messaggi.push(testo);
    try {
        assert.strictEqual(schedaRef.tieniDescrizioneDelBox(), false);
        assert.match(messaggi[0], /^Code SRF-108 /);
        assert.notStrictEqual(schedaRef.salvaConDescrizioneDelBox, true);
    }
    finally {
        Object.keys(salvaGlobali).forEach(k => { if (salvaGlobali[k] === undefined) { delete global[k]; } else { global[k] = salvaGlobali[k]; } });
    }
});

test("il salvataggio manda la descrizione per intero solo quando lo chiede la finestra, e una volta sola", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const salva = scheda.substring(scheda.indexOf("    salvaModifiche(schedaRef, codice, box, meccanica, page) {"), scheda.indexOf("//Chiedo al controller le operazioni che devo fare"));
    //Si legge e si spegne prima di ogni uscita anticipata.
    assert.match(salva, /salvaModifiche\(schedaRef, codice, box, meccanica, page\) \{\s*(\/\/[^\n]*\n\s*)*const descrizioneDelBox = this\.salvaConDescrizioneDelBox === true;\s*this\.salvaConDescrizioneDelBox = false;\s*try \{/);
    assert.match(scheda, /this\.editRefFieldController\.getOperazioniDiSalvataggioDaFare\(descrizioneEreditata \|\| descrizioneDelBox\);/);
});

test("scegli quella del server applica la descrizione del server, rinasconde i controlli nativi e rifa' la finestra", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    //Il pannello di modifica si ricostruisce con caselle nuove, che in UXP starebbero sopra la finestra.
    assert.match(scheda, /else if \(azione === "descrizioneServer"\) \{\s*await me\.applicaDescrizioneDaServer\(\);\s*(\/\/[^\n]*\n\s*)*if \(\$\("#popup"\)\.length > 0\) \{\s*Modali\.nascondiHidebleElements\(\);\s*\}\s*if \(typeof dopoAzione === "function"\) \{\s*await dopoAzione\(\);\s*\}\s*\}\s*else if \(azione === "descrizioneBox"\) \{\s*me\.tieniDescrizioneDelBox\(\);\s*\}/);
    assert.match(scheda, /descrizioneServer: \["Scegli quella del server", /);
    assert.match(scheda, /descrizioneBox: \["Scegli quella del box", /);
});
