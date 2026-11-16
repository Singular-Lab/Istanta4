/*
 * La referenza di un box per i fix: la primaria attuale del suo gruppo.
 *
 * Il DNA del box porta l'idRec della primaria al momento dell'impaginazione. Dopo un cambio di
 * primaria da Foto P/S quell'idRec e' di una referenza non piu' primaria: il fix cercava "la primaria
 * con quell'idRec", non la trovava e ripiegava sull'intera risposta di getSchedaRef. Le regole sulla
 * referenza (FRESCHISSIMI a tutto box di Coop, regole CSS) non valevano fino al Reimpagina.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { leggiFileDelPlugin } = require('./fileDelPlugin');

const schedaRef = require('../../plugin/schedaRef.js');

//Un gruppo di tre referenze impaginato con la primaria 101 (noFoto), poi primaria la 102.
const scheda = (idRec, codice, stato, etichette = []) => ({
    IdRec: idRec,
    recordInTracciato: { idRec: idRec, "Referenza.Codice": codice, "Scatto.CodiceGruppo": "A,B,C", StatoSelezione: stato, allEtichette: etichette }
});
const dopoIlCambio = () => [scheda(101, "A", 3), scheda(102, "B", 1, ["FRESCHISSIMI"]), scheda(103, "C", 3)];

test("dopo il cambio di primaria la referenza del box e' la primaria nuova", () => {
    const primaria = schedaRef.primariaDelBox(dopoIlCambio(), "A,B,C", "101");

    assert.strictEqual(primaria["Referenza.Codice"], "B");
    assert.deepStrictEqual(primaria.allEtichette, ["FRESCHISSIMI"]);
});

test("senza cambio, e senza idRec nel DNA, e' la primaria del gruppo", () => {
    const schede = [scheda(101, "A", 1), scheda(102, "B", 3)];
    assert.strictEqual(schedaRef.primariaDelBox(schede, "A,B,C", 101)["Referenza.Codice"], "A");
    assert.strictEqual(schedaRef.primariaDelBox(schede, "A,B,C", null)["Referenza.Codice"], "A");
    assert.strictEqual(schedaRef.primariaDelBox(schede, "A,B,C", "")["Referenza.Codice"], "A");
});

test("le schede di un'altra impaginazione dello stesso gruppo non valgono", () => {
    //Lo stesso gruppo impaginato anche nei soci: altri record, altri idRec.
    assert.strictEqual(schedaRef.primariaDelBox(dopoIlCambio(), "A,B,C", 201), null);
    assert.strictEqual(schedaRef.primariaDelBox(dopoIlCambio(), "X,Y", 101), null);
    assert.strictEqual(schedaRef.primariaDelBox(null, "A,B,C", 101), null);
});

test("l'idRec si legge anche dalla scheda, non solo dal record", () => {
    const schede = dopoIlCambio().map(s => ({ IdRec: s.IdRec, recordInTracciato: Object.assign({}, s.recordInTracciato, { idRec: undefined }) }));
    assert.strictEqual(schedaRef.primariaDelBox(schede, "A,B,C", 101)["Referenza.Codice"], "B");
});

test("dalla risposta di Istanta si prende il record primario, con le sue etichette", () => {
    const risposta = { esito: true, records: dopoIlCambio() };

    const primaria = schedaRef.primariaDellaRisposta(risposta);

    assert.strictEqual(primaria["Referenza.Codice"], "B");
    assert.deepStrictEqual(primaria.allEtichette, ["FRESCHISSIMI"]);
    assert.strictEqual(schedaRef.primariaDellaRisposta({ esito: false, error: "x" }), null);
    assert.strictEqual(schedaRef.primariaDellaRisposta({ records: [scheda(101, "A", 3)] }), null);
    assert.strictEqual(schedaRef.primariaDellaRisposta(null), null);
});

test("referenzaDelBox e il Fix referenza usano la stessa ricerca, e la riserva da' il record", () => {
    const indexNew = leggiFileDelPlugin('indexNew.js').replace(/\r/g, '');
    const referenza = indexNew.substring(indexNew.indexOf("async function referenzaDelBox(box) {"), indexNew.indexOf("\nfunction getSchedaRefAsync"));
    assert.match(referenza, /schedaRef\.primariaDelBox\(schedaRef\.schedeRefDati, codiceGruppo, idRec\)/);
    assert.match(referenza, /return schedaRef\.primariaDellaRisposta\(await getSchedaRefAsync\(/);

    const fix = indexNew.substring(indexNew.indexOf("async function fixRefImpaginata("), indexNew.indexOf("async function referenzaDelBox(box) {"));
    assert.match(fix, /if \(schedaRef\.primariaDelBox\(schedaRef\.schedeRefDati, codiceGruppo, idRec\) != null\) \{\s*originalBounds = schedaRef\.refSelected\.boxOriginalBounds;/);
    assert.match(fix, /datiRef = schedaRef\.primariaDelBox\(schedaRef\.schedeRefDati, codiceGruppo, idRec\);\s*if \(datiRef == null\) \{\s*datiRef = schedaRef\.primariaDellaRisposta\(await getSchedaRefAsync\(schedaRef, codiceGruppo, idRec\)\);/);
    assert.match(fix, /throw new Error\("la referenza primaria del box non si trova"\);/);
    assert.doesNotMatch(fix + referenza, /getIdRecFromItemRef\(s\.recordInTracciato\) === idRec/);
});
