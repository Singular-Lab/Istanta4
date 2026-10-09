/*
 * I20-1077: la scelta fra il testo del box e quello del server, su tutti i campi di testo.
 *
 * I20-1075 l'aveva portata sulla descrizione. Qui vale per ogni campo di testo con il contenuto
 * diverso (prezzo_info_pack "cad." / "a conf.", prezzo_continuo...). "Scegli quella del server"
 * riscrive il campo nel box; "Scegli quella del box" e' il Salva modifiche della scheda con in piu'
 * il testo del campo letto dal box (testiDalBox): il server lo registra nella lavorazione e lo
 * rimette nel campo compilato finche' il suo dato resta quello del momento della scelta.
 *
 * schedaRef.js si carica sotto Node: le decisioni si provano direttamente, il resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

const CAMPI = [
    { labelName: "descrizione", paragraphName: "", content: "<DES>Arista</DES>" },
    { labelName: "prezzo_info_pack", paragraphName: "PREZ_info", content: "a conf." },
    { labelName: "prezzo_continuo$KgL", paragraphName: "", content: "<PREZ_A>invece di € 1,89 </PREZ_A><PREZ_B>a conf.</PREZ_B>" }
];

function conScheda(prova) {
    const salva = { schedeRefDati: schedaRef.schedeRefDati, Utility: global.Utility };
    schedaRef.schedeRefDati = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: CAMPI } }];
    global.Utility = Object.assign({}, global.Utility, { parseLabel: (l) => String(l == null ? "" : l).split("$")[0] });
    try {
        return prova();
    }
    finally {
        schedaRef.schedeRefDati = salva.schedeRefDati;
        if (salva.Utility === undefined) {
            delete global.Utility;
        }
        else {
            global.Utility = salva.Utility;
        }
    }
}

test("ogni campo di testo con il contenuto diverso offre server e box; la descrizione resta com'era", () => conScheda(() => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "prezzo_info_pack", difference: "contenuto" }), ["testoServer", "testoBox"]);
    //La preanalisi scrive anche il labelName intero, per i campi a stili di carattere.
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "prezzo_continuo$KgL", difference: "contenuto" }), ["testoServer", "testoBox"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "prezzo_continuo", difference: "contenuto" }), ["testoServer", "testoBox"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "descrizione", difference: "contenuto" }), ["descrizioneServer", "descrizioneBox"]);
}));

test("niente scelta sul paragrafo, sui campi che il server non compone, sulle foto", () => conScheda(() => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "prezzo_info_pack", difference: "paragrafo" }), []);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "campo_sconosciuto", difference: "contenuto" }), []);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "6311123_1_T1.jpg", difference: "foto mancante nella cartella di lavorazione: 6311123_1_T1.jpg" }), []);
    assert.strictEqual(schedaRef.campoTestoInMismatch({ label: "descrizione", difference: "contenuto" }), null);
}));

test("il testo del box si manda nella forma del campo compilato", () => {
    //Stile di paragrafo: il testo semplice, con gli a capo come <br>.
    assert.strictEqual(schedaRef.testoDalBoxPerIlServer(CAMPI[1], "cad.\rcon iva", "<X>cad.</X>"), "cad.<br>con iva");
    //Stili di carattere: la stringa con i tag.
    assert.strictEqual(schedaRef.testoDalBoxPerIlServer(CAMPI[2], "invece di € 1,89 cad.", "<PREZ_A>invece di € 1,89 </PREZ_A><PREZ_B>cad.</PREZ_B>"),
        "<PREZ_A>invece di € 1,89 </PREZ_A><PREZ_B>cad.</PREZ_B>");
});

test("scegli quella del box: si chiude la finestra e si salva la scheda con il testo del campo e il dato di adesso", () => conScheda(() => {
    const eventi = [];
    const salvaGlobali = { $: global.$, messaggioUtente: global.messaggioUtente };
    const campoNelBox = { contents: "cad.", characters: { length: 0, item: () => null } };
    global.$ = (selettore) => ({ length: 1, trigger: (evento) => eventi.push(selettore + " " + evento) });
    global.messaggioUtente = () => {};
    global.Utility.getFieldByLabel = (label) => (label === "prezzo_info_pack" ? campoNelBox : null);
    const salvaRef = schedaRef.refSelected;
    const salvaPrima = schedaRef.salvaModificheDellaScheda;
    schedaRef.refSelected = { item: { isValid: true } };
    //Il salvataggio una volta sola, senza premere il pulsante (partiva due volte: SRF-01).
    schedaRef.salvaModificheDellaScheda = () => eventi.push("salvataggio della scheda");
    try {
        assert.strictEqual(schedaRef.tieniTestoDelBox({ label: "prezzo_info_pack", difference: "contenuto" }), true);
        assert.deepStrictEqual(eventi, ["#popupCloseButton click", "salvataggio della scheda"]);
        assert.deepStrictEqual(schedaRef.testiDalBoxDaSalvare, [{ label: "prezzo_info_pack", contenuto: "cad.", contenutoServer: "a conf." }]);
    }
    finally {
        schedaRef.testiDalBoxDaSalvare = null;
        schedaRef.refSelected = salvaRef;
        schedaRef.salvaModificheDellaScheda = salvaPrima;
        Object.keys(salvaGlobali).forEach(k => { if (salvaGlobali[k] === undefined) { delete global[k]; } else { global[k] = salvaGlobali[k]; } });
    }
}));

test("il salvataggio porta i testi del box una volta sola, e il server riscritto si rifa' come per la descrizione", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = scheda.indexOf("    salvaModifiche(schedaRef, codice, box, meccanica, page) {");
    const salva = scheda.substring(inizio, scheda.indexOf("    try {", inizio));
    assert.match(salva, /const testiDalBox = Array\.isArray\(this\.testiDalBoxDaSalvare\) \? this\.testiDalBoxDaSalvare : \[\];\s*this\.testiDalBoxDaSalvare = null;/);
    assert.match(scheda, /if \(testiDalBox\.length > 0\) \{\s*req\.testiDalBox = testiDalBox;\s*\}/);

    assert.match(scheda, /else if \(azione === "testoServer"\) \{\s*await me\.applicaCampoDaServer\(diff\);[\s\S]*?Modali\.nascondiHidebleElements\(\);[\s\S]*?await dopoAzione\(\);[\s\S]*?\}\s*else if \(azione === "testoBox"\) \{\s*me\.tieniTestoDelBox\(diff\);\s*\}/);
    const applica = scheda.substring(scheda.indexOf("    async applicaCampoDaServer(diff) {"), scheda.indexOf("    tieniTestoDelBox(diff) {"));
    assert.match(applica, /TestoTag\.applicaTagStringToInndTextFrame\(campo, campoCompilato\.content, box\.geometricBounds\);/);
    assert.match(applica, /this\.dimenticaSegnalazioni\(\);\s*await this\.selectSchedaRef\(1\);/);
});
