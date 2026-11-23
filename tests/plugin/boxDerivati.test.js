/*
 * TASK-22d7fad2, lotto 2a: l'identita' di un box derivato nel Plugin.
 *
 * Un box derivato e' una seconda impaginazione dello stesso record, con una riga propria su
 * Istanta: ha lo stesso codice, lo stesso codice gruppo e lo stesso idRec dell'originale. Per
 * distinguerlo, nel DNA lo slot dell'idRec diventa idRec*idLavRec, dove idLavRec e' l'Id di quella
 * riga. Chi legge il DNA ne ricava l'idRec pulito, come prima, e l'idLavRec a parte; il marcatore
 * resta quando il box viene rifatto o ricollegato; e ogni richiesta che porta l'idRec del box
 * porta anche l'idLavRec, altrimenti la decisione finirebbe sulla riga dell'originale.
 *
 * dnaBox.js e' puro e schedaRef.js si carica sotto Node; utility.js, indexNew.js e schedaFoto.js
 * no, e si provano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DnaBox = require("../../plugin/dnaBox.js");
const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

function occorrenze(testo, cercato) {
    return testo.split(cercato).length - 1;
}

/* ---- lo slot dell'idRec ---- */

test("lo slot di un box normale e' il solo idRec, com'era", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot("123"), { idRec: "123", idLavRec: 0 });
});

test("lo slot di un derivato da' l'idRec pulito e l'idLavRec a parte", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot("123*456"), { idRec: "123", idLavRec: 456 });
    //L'idRec pulito e' quello che i lettori di prima si aspettano.
    assert.strictEqual(parseInt(DnaBox.leggiSlot("123*456").idRec), 123);
});

test("uno slot vuoto, assente o con un idLavRec che non e' un numero non e' un derivato", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot(""), { idRec: "", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot(undefined), { idRec: undefined, idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot(null), { idRec: null, idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*abc"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*0"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*-4"), { idRec: "123", idLavRec: 0 });
});

test("lo slot si scrive col solo idRec per un box normale e con idRec*idLavRec per un derivato", () => {
    assert.strictEqual(DnaBox.scriviSlot(123, undefined), "123");
    assert.strictEqual(DnaBox.scriviSlot(123, 0), "123");
    assert.strictEqual(DnaBox.scriviSlot("123", null), "123");
    assert.strictEqual(DnaBox.scriviSlot(123, 456), "123*456");
    assert.strictEqual(DnaBox.scriviSlot("123", "456"), "123*456");
});

test("scrivere e rileggere lo slot riporta gli stessi valori", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot(DnaBox.scriviSlot(123, 456)), { idRec: "123", idLavRec: 456 });
    assert.deepStrictEqual(DnaBox.leggiSlot(DnaBox.scriviSlot(123, 0)), { idRec: "123", idLavRec: 0 });
});

test("l'idLavRec di un dna, di un record o di un riferimento al box: 0 se non e' un derivato", () => {
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: 456 }), 456);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: "456" }), 456);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123" }), 0);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: 0 }), 0);
    assert.strictEqual(DnaBox.idLavRecDi(null), 0);
    assert.strictEqual(DnaBox.eDerivato({ idLavRec: 456 }), true);
    assert.strictEqual(DnaBox.eDerivato({ idRec: "123" }), false);
});

test("cambiando l'idRec nella label del DNA l'idLavRec del derivato resta", () => {
    assert.strictEqual(DnaBox.labelConIdRec("descrizione$DNA$BOX1$111$111,222$123*456", 5, 999), "descrizione$DNA$BOX1$111$111,222$999*456");
    assert.strictEqual(DnaBox.labelConIdRec("descrizione$DNA$BOX1$111$111,222$123", 5, 999), "descrizione$DNA$BOX1$111$111,222$999");
    //Il formato vecchio, con lo slot in quarta posizione.
    assert.strictEqual(DnaBox.labelConIdRec("base$BOX1$111$111,222$123", 4, 999), "base$BOX1$111$111,222$999");
    //Una label senza lo slot non si tocca.
    assert.strictEqual(DnaBox.labelConIdRec("base$BOX1$111", 4, 999), null);
});

/* ---- lettura e scrittura del DNA ---- */

test("getDnaOfBox legge lo slot con DnaBox, nel formato nuovo e in quello vecchio", () => {
    const utility = sorgente("plugin/utility.js");

    assert.ok(utility.includes("const DnaBox = require('./dnaBox');"));
    assert.ok(utility.includes("var slot = DnaBox.leggiSlot(parts[5]);"));
    assert.ok(utility.includes("idRec: slot.idRec,\n                    idLavRec: slot.idLavRec,"));
    assert.ok(utility.includes("idRec: DnaBox.leggiSlot(partiBase[4]).idRec,\n            idLavRec: DnaBox.leggiSlot(partiBase[4]).idLavRec,"));
    //Nessuno legge piu' lo slot grezzo.
    assert.ok(!utility.includes("idRec: parts[5],"));
    assert.ok(!utility.includes("idRec: partiBase[4],"));
});

test("setCampoDNA scrive lo slot composto quando il record porta l'idLavRec", () => {
    const utility = sorgente("plugin/utility.js");

    assert.ok(utility.includes('itemRef["Scatto.CodiceGruppo"] + "$" + DnaBox.scriviSlot(itemRef["idRec"], itemRef["idLavRec"]);'));
    assert.ok(!utility.includes('itemRef["Scatto.CodiceGruppo"] + "$" + itemRef["idRec"];'));
});

//Il box rifatto (Reimpagina, Fix, riallineamento) nasce dai record della scheda: e' Istanta a
//mettere l'idLavRec in quelli della scheda di un derivato.
test("i record della scheda di un derivato portano l'idLavRec", () => {
    const menabo = sorgente("Istanta/Controllers/MenaboController.cs");

    assert.ok(menabo.includes('record.recordInTracciato["idLavRec"] = derivato.Id;'));
});

/* ---- il ricollegamento ---- */

test("dopo un ricollegamento il dna del derivato prende il nuovo idRec e tiene l'idLavRec", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123*456" };
    const dna = { idRec: "123", idLavRec: 456, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 999), true);

    assert.strictEqual(dna.idRec, "999");
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$999*456");
});

test("dopo un ricollegamento il dna di un box normale resta com'era prima di questo lavoro", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123" };
    const dna = { idRec: "123", idLavRec: 0, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 999), true);
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$999");

    const vecchio = { label: "base$BOX1$111$111,222$123" };
    assert.strictEqual(schedaRef.scriviIdRecNelDna({ idRec: "123", oldBoxFormat: true, item: vecchio }, 999), true);
    assert.strictEqual(vecchio.label, "base$BOX1$111$111,222$999");
});

test("se l'idRec scelto e' quello del box il dna non si tocca, derivato compreso", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123*456" };
    const dna = { idRec: "123", idLavRec: 456, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 123), false);
    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 0), false);
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$123*456");
});

test("la richiesta di ricollegamento porta l'idLavRec del box", () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(scheda.includes("var idLavRec = DnaBox.idLavRecDi(dna);"));
    assert.ok(scheda.includes("idRec: idRec,\n                idLavRec: idLavRec,\n                pag: nomePagina,"));
});

/* ---- il box aperto ---- */

function conBoxAperto(dna, azione) {
    const utilityPrima = global.Utility;
    const selezionePrima = schedaRef.refSelected;
    global.Utility = { getDnaOfBox: () => dna };
    schedaRef.refSelected = { item: {} };
    try {
        return azione();
    }
    finally {
        global.Utility = utilityPrima;
        schedaRef.refSelected = selezionePrima;
    }
}

test("l'idLavRec del box aperto e' quello del suo DNA, 0 per un box normale o senza box", () => {
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 456 }, () => schedaRef.idLavRecDelBoxAperto()), 456);
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 0 }, () => schedaRef.idLavRecDelBoxAperto()), 0);
    assert.strictEqual(conBoxAperto(null, () => schedaRef.idLavRecDelBoxAperto()), 0);

    const selezionePrima = schedaRef.refSelected;
    schedaRef.refSelected = null;
    try {
        assert.strictEqual(schedaRef.idLavRecDelBoxAperto(), 0);
    }
    finally {
        schedaRef.refSelected = selezionePrima;
    }
});

test("l'idRec del box aperto di un derivato e' l'idRec pulito", () => {
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 456 }, () => schedaRef.idRecDelBoxAperto()), 123);
});

/* ---- le richieste a Istanta ---- */

test("la scheda di un box si chiede con il suo idLavRec", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const index = sorgente("plugin/indexNew.js");
    const eventi = sorgente("plugin/events.js");

    assert.ok(scheda.includes("getSchedaRef(codiceGruppo, callback, idRec = 0, ignoraInvalidazione = false, idLavRec = 0) {"));
    assert.ok(scheda.includes('formData.append("idRec", idRec);\n        formData.append("idLavRec", DnaBox.idValido(idLavRec));'));
    //La scheda del box selezionato, la rilettura dopo una decisione, la referenza del box.
    assert.ok(scheda.includes("}, me.refSelected.idRec, false, me.refSelected.idLavRec);"));
    assert.ok(scheda.includes("async ricaricaDatiScheda(codiceGruppo, idRec, idLavRec = 0) {"));
    assert.ok(scheda.includes("}, idRec, false, idLavRec);"));
    assert.strictEqual(occorrenze(scheda, "this.ricaricaDatiScheda(codice, this.idRecDelBoxAperto(), this.idLavRecDelBoxAperto());"), 2);
    assert.ok(scheda.includes("me.ricaricaDatiScheda(codiceGruppo, idRec, me.idLavRecDelBoxAperto());"));
    assert.ok(index.includes("function getSchedaRefAsync(schedaRef, codiceGruppo, idRec = 0, idLavRec = 0) {"));
    assert.strictEqual(occorrenze(index, "DnaBox.idLavRecDi(dna)));"), 2);
    //La selezione porta l'idLavRec del box, e due box con lo stesso idRec non sono la stessa selezione.
    assert.strictEqual(occorrenze(eventi, "idRec: dna.idRec,\n"), occorrenze(eventi, "idLavRec: dna.idLavRec,\n"));
    assert.ok(eventi.includes("(me.lastSelectionDetails[0].idLavRec || 0) == (dna.idLavRec || 0)) {"));
});

test("le decisioni sul box portano l'idLavRec: foto extra, testi del box, noRender, primarie e secondarie", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");
    const decisione = 'formData.append("idRec", destinazione != null ? destinazione.idRec : me.idRecDelBoxAperto());\n';
    const conDerivato = decisione + '            formData.append("idLavRec", destinazione != null ? DnaBox.idLavRecDi(destinazione) : me.idLavRecDelBoxAperto());\n';

    assert.strictEqual(occorrenze(scheda, decisione), 3);
    assert.strictEqual(occorrenze(scheda, conDerivato), 3);
    assert.ok(foto.includes('formData.append("idRec", idRec);\n                formData.append("idLavRec", idLavRec);\n                formData.append("ps", JSON.stringify(objToSend.ps));'));
    assert.ok(foto.includes("me.ricaricaDatiScheda(codice_gruppo, idRec, idLavRec);"));
});

test("ogni richiesta sulle foto che porta l'idRec del box aperto porta anche l'idLavRec", () => {
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");

    assert.strictEqual(occorrenze(foto, 'formData.append("idRec", me.idRecDelBoxAperto());\n'), 4);
    assert.strictEqual(occorrenze(foto, 'formData.append("idLavRec", me.idLavRecDelBoxAperto());\n'), 5);
    assert.ok(foto.includes('"/" + idRec + "/" + 0 + "?idLavRec=" + me.idLavRecDelBoxAperto(), null, "GET");'));
});

//Rimuovendo un derivato senza idLavRec Istanta toglierebbe l'originale, che ha lo stesso idRec.
test("la rimozione di un box porta il suo idLavRec, da tutte le strade", () => {
    const index = sorgente("plugin/indexNew.js");

    assert.strictEqual(occorrenze(index, "listaCodiciConIdDaInviare.push("), 3);
    assert.ok(index.includes("idRec: idRecSelezionato, idLavRec: DnaBox.idLavRecDi(dnaSelezionato) });"));
    assert.ok(index.includes("idRec: idRecInput, idLavRec: DnaBox.idLavRecDi(itemCodiceConId) });"));
    assert.ok(index.includes("idRec: idRec, idLavRec: DnaBox.idLavRecDi(dna) });"));
    assert.ok(index.includes('params += "ListaCodiciConId[" + i + "].idLavRec=" + encodeURIComponent(DnaBox.idLavRecDi(listaCodiciConIdDaInviare[i])) + "&";'));
});

test("il cambio di pagina di un box porta il suo idLavRec", () => {
    const index = sorgente("plugin/indexNew.js");

    assert.ok(index.includes("async function impaginaSingolo(codice, pagina, byPassBloccoGiaImpaginato = false, idRec = null, idLavRec = 0) {"));
    assert.ok(index.includes('formData.append("idRec", idRecNorm);\n    formData.append("idLavRec", DnaBox.idValido(idLavRec));'));
});

//Da un derivato Istanta rifiuta revisione, azioni sul box e sgruppa: perche' possa farlo, la
//richiesta deve dire che il box e' un derivato.
test("revisione, azioni sul box e sgruppa dicono a Istanta se il box e' un derivato", () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(scheda.includes("req.idRec = this.idRecDelBoxAperto();\n            req.idLavRec = this.idLavRecDelBoxAperto();"));
    assert.ok(scheda.includes('params += "&idLavRec=" + encodeURIComponent(this.idLavRecDelBoxAperto());'));
    assert.strictEqual(occorrenze(scheda, 'params += "&idLavRec=" + encodeURIComponent(me.idLavRecDelBoxAperto());'), 2);
});
