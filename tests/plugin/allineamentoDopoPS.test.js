/*
 * I20-1132: il box allineato dopo il salvataggio di primarie e secondarie.
 *
 * Cambiando primaria con una foto diversa, updateFoto sgruppa e rigruppa il box: il gruppo di
 * prima sparisce e la selezione si perde. Il ciclo di controllo della selezione (events.js), non
 * sospeso durante il salvataggio, vedeva "nessuna ref selezionata", invalidava la scheda e il
 * riscaricamento (SRF-47) non partiva: niente confronto, niente proposta di reimpaginazione.
 *
 * Ora il salvataggio tiene il ciclo sospeso, e dopo le foto la scheda e la selezione seguono il
 * box ricostruito, che il ciclo accetta come selezione corrente. schedaFoto.js si carica sotto
 * Node; events.js no, e accettaSelezione si prende dal sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaFoto = require("../../plugin/reperimentoFoto/schedaFoto.js");

/* ---- seguiBoxRicostruito ---- */

function conFinti(fn) {
    const chiamate = { selezionati: [], accettati: [] };
    global.Utility = { selezionaBox(box) { chiamate.selezionati.push(box); return true; } };
    global.indesignEvents = { accettaSelezione(ids) { chiamate.accettati.push(ids); return true; } };
    try {
        return fn(chiamate);
    }
    finally {
        delete global.Utility;
        delete global.indesignEvents;
    }
}

test("il box ricostruito diventa quello della scheda, viene riselezionato e accettato dal ciclo", () => {
    conFinti(chiamate => {
        const vecchio = { id: 10, isValid: false };
        const nuovo = { id: 11, isValid: true };
        const scheda = { refSelected: { item: vecchio } };

        const esito = schedaFoto.seguiBoxRicostruito.call(scheda, nuovo);

        assert.strictEqual(esito, true);
        assert.strictEqual(scheda.refSelected.item, nuovo);
        assert.deepStrictEqual(chiamate.selezionati, [nuovo]);
        assert.deepStrictEqual(chiamate.accettati, [[11]]);
    });
});

test("senza box, o con un box non valido, non si tocca niente", () => {
    conFinti(chiamate => {
        const vecchio = { id: 10, isValid: true };
        const scheda = { refSelected: { item: vecchio } };

        assert.strictEqual(schedaFoto.seguiBoxRicostruito.call(scheda, null), false);
        assert.strictEqual(schedaFoto.seguiBoxRicostruito.call(scheda, { id: 12, isValid: false }), false);
        assert.strictEqual(scheda.refSelected.item, vecchio);
        assert.deepStrictEqual(chiamate.selezionati, []);
        assert.deepStrictEqual(chiamate.accettati, []);
    });
});

test("senza una scheda aperta il box si seleziona lo stesso", () => {
    conFinti(chiamate => {
        const nuovo = { id: 11, isValid: true };

        assert.strictEqual(schedaFoto.seguiBoxRicostruito.call({ refSelected: null }, nuovo), true);
        assert.deepStrictEqual(chiamate.selezionati, [nuovo]);
    });
});

/* ---- accettaSelezione ---- */

function accettaSelezione() {
    const sorgente = leggiFileDelPlugin("events.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    accettaSelezione(ids){");
    assert.notStrictEqual(inizio, -1, "accettaSelezione non trovata in events.js");
    const fine = sorgente.indexOf("\n    }\n", inizio);
    return new Function("ids", sorgente.substring(sorgente.indexOf("{", inizio) + 1, fine));
}

test("gli id accettati diventano la selezione validata, ordinati, e la selezione non valida si azzera", () => {
    const accetta = accettaSelezione();
    const ciclo = { lastSelectionID: [1], lastSelectionIDValidated: [1], lastInvalidSelectionID: [7], timestampInizioSelezione: 0 };

    assert.strictEqual(accetta.call(ciclo, [30, 11]), true);

    assert.deepStrictEqual(ciclo.lastSelectionID, [11, 30]);
    assert.deepStrictEqual(ciclo.lastSelectionIDValidated, [11, 30]);
    assert.deepStrictEqual(ciclo.lastInvalidSelectionID, []);
    assert.ok(ciclo.timestampInizioSelezione > 0);
    //Due copie: il ciclo riassegna lastSelectionID senza toccare la validata.
    assert.notStrictEqual(ciclo.lastSelectionID, ciclo.lastSelectionIDValidated);
});

test("senza id validi il ciclo resta com'era", () => {
    const accetta = accettaSelezione();
    for (const ids of [null, [], [null], "11", { length: 1 }]) {
        const ciclo = { lastSelectionID: [1], lastSelectionIDValidated: [1], lastInvalidSelectionID: [7], timestampInizioSelezione: 0 };
        assert.strictEqual(accetta.call(ciclo, ids), false, JSON.stringify(ids));
        assert.deepStrictEqual(ciclo.lastSelectionID, [1]);
        assert.deepStrictEqual(ciclo.lastInvalidSelectionID, [7]);
    }
});

/* ---- il salvataggio ---- */

test("il salvataggio di primarie e secondarie tiene il ciclo sospeso e segue il box prima di riscaricare la scheda", () => {
    const sorgente = leggiFileDelPlugin("reperimentoFoto/schedaFoto.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("xhr.onload = async (objResult2, parsed) => {");
    assert.notStrictEqual(inizio, -1);
    const fine = sorgente.indexOf('xhr.send("Menabo/modificaPrimarieSecondarie"', inizio);
    assert.notStrictEqual(fine, -1);
    const gestore = sorgente.substring(inizio, fine);

    //Il busy all'ingresso e il rilascio in finally, prima della chiusura del gestore.
    assert.match(gestore, /^xhr\.onload = async \(objResult2, parsed\) => \{\s*(\/\/[^\n]*\n\s*)*indesignEvents\.setBusy\(true\);\s*try \{/);
    assert.match(gestore, /\}\s*finally \{\s*indesignEvents\.setBusy\(false\);\s*\}\s*\};\s*xhr\.onreadystatechange/);
    //Il box ricostruito si segue dopo le foto e prima del riscaricamento della scheda.
    const segui = gestore.indexOf("me.seguiBoxRicostruito(box);");
    const riscarica = gestore.indexOf("await me.ricaricaDatiScheda(codice_gruppo, idRec);");
    const foto = gestore.lastIndexOf("FotoPlacer.updateFoto(", riscarica);
    assert.ok(foto > 0 && segui > foto && riscarica > segui, "ordine: updateFoto, seguiBoxRicostruito, ricaricaDatiScheda");
    //L'allineamento al box riscaricato resta quello di prima.
    assert.match(gestore, /var esitoAllineamento = await me\.allineaBoxDopoSalvataggioPS\(box, codiceBoxPrecedente\);/);
});
