/*
 * I20-1053: box normale per le ref BENESSERE nella sezione SCELTE DI BENESSERE, nel custom di Edro21.
 *
 * Il server (AgenziaLib, SceltaDiBenessereEdro21) scrive in combinazioneGrafica la meccanica su cui
 * si decide la grafica: la combinazione assegnata, senza "_sdb" per quelle ref. Il Plugin deve
 * stilare il box su quella, altrimenti mette base, colori e testata SDB su un box normale.
 *
 * Il custom di Edro21 fa require('indesign'): la funzione si prende dal sorgente, il resto si
 * controlla sul sorgente come in artistiQualitaEdro21.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const custom = leggiFileDelPlugin("Agenzie/Edro21/custom.js").replace(/\r/g, "");

function meccanicaGrafica() {
    const inizio = custom.indexOf("    meccanicaGrafica(objItem) {");
    assert.notStrictEqual(inizio, -1, "meccanicaGrafica non trovata");
    const fine = custom.indexOf("\n    },\n", inizio);
    const corpo = custom.substring(custom.indexOf("{", inizio) + 1, fine);
    return new Function("objItem", corpo);
}

test("la grafica segue combinazioneGrafica quando il server la manda", () => {
    const meccanica = meccanicaGrafica();

    assert.strictEqual(meccanica({ combinazioneAssegnata: "TP_MM_sdb", combinazioneGrafica: "TP_MM" }), "TP_MM");
    assert.strictEqual(meccanica({ combinazioneAssegnata: "TP_MM_sdb", combinazioneGrafica: "TP_MM_sdb" }), "TP_MM_sdb");
});

test("senza combinazioneGrafica vale la combinazione assegnata, come prima", () => {
    const meccanica = meccanicaGrafica();

    assert.strictEqual(meccanica({ combinazioneAssegnata: "TP_MM_sdb" }), "TP_MM_sdb");
    assert.strictEqual(meccanica({ combinazioneAssegnata: "TP_MM_sdb", combinazioneGrafica: "" }), "TP_MM_sdb");
    assert.strictEqual(meccanica({ combinazioneAssegnata: "TP_MM_sdb", combinazioneGrafica: null }), "TP_MM_sdb");
    assert.strictEqual(meccanica(null), undefined);
});

test("la base e gli stili del box si decidono sulla meccanica grafica", () => {
    //getRefCompiledInBox_Css e parseMeccanica_provvisorioCompiled: tutti i rami _sdb (base_A_SDB,
    //base_P_SDB, colori, boxetto, bagliore) leggono la variabile meccanica.
    assert.match(custom, /getRefCompiledInBox_Css\(objItem[^)]*\) \{[\s\S]*?var meccanica = this\.meccanicaGrafica\(objItem\);/);
    assert.match(custom, /parseMeccanica_provvisorioCompiled\(objRef[^)]*\) \{[\s\S]*?var meccanica = this\.meccanicaGrafica\(objRef\);/);
    assert.doesNotMatch(custom, /var meccanica = obj(Item|Ref)\.combinazioneAssegnata;/);
});
