/*
 * I20-1092: il revisore di Edro21 non si apriva.
 *
 * Il server costruiva la lista tenendo ogni ref singola una volta sola per area e canale, senza
 * guardare il gruppo: una ref che stava in due gruppi nella stessa area e canale entrava solo col
 * primo, e il secondo gruppo (6322946,6322965,6429946,6430002) arrivava senza nessuna ref.
 * renderRecordRevisione, non trovando le ref, restituiva undefined; caricaPagina lo passava a
 * compilaBoxConInformazioniCustom di Edro21, e il TypeError fermava il caricamento dell'intera pagina.
 *
 * Il server ora tiene la ref per gruppo, area e canale (RevisoreController, provato in C#). Qui:
 * un elemento che non si puo' disegnare si salta con l'errore in console, per i casi futuri; la
 * modalita' sottogruppi non rompe senza un elemento del gruppo; e il contatore del client conta una
 * ref una volta sola anche quando compare sotto due gruppi.
 *
 * revisore.js e statoRevisione.js si caricano sotto Node; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");
const statoRevisione = require("../../Istanta/wwwroot/js/statoRevisione.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

const GRUPPO = "6322946,6322965,6429946,6430002";

/* ---- l'elemento che non si puo' disegnare ---- */

test("si disegna solo un elemento jQuery: undefined, null e oggetti vuoti no", () => {
    assert.strictEqual(Revisore.elementoDisegnabile(undefined), false);
    assert.strictEqual(Revisore.elementoDisegnabile(null), false);
    assert.strictEqual(Revisore.elementoDisegnabile({}), false);
    assert.strictEqual(Revisore.elementoDisegnabile({ find: () => [] }), true);
});

test("l'errore in console dice cosa si e' saltato, con il codice e il perche'", () => {
    const gruppo = { isGruppo: true, recordInTracciato: { "Scatto.CodiceGruppo": GRUPPO } };
    assert.strictEqual(Revisore.testoElementoNonDisegnabile(gruppo),
        "Code REV-01 Revisore: elemento non disegnabile, saltato - gruppo " + GRUPPO + ": nella lista non c'e' nessuna sua ref");

    const sottogruppo = { isGruppo: true, recordInTracciato: { "Scatto.CodiceGruppo": GRUPPO, "Scatto.CodiceSottogruppo": "6322946,6322965" } };
    assert.match(Revisore.testoElementoNonDisegnabile(sottogruppo, true), /gruppo 6322946,6322965:/);

    assert.match(Revisore.testoElementoNonDisegnabile({ isGruppo: false, recordInTracciato: null }), /ref \(senza codice\): record senza dati del tracciato/);
    assert.match(Revisore.testoElementoNonDisegnabile(null), /^Code REV-01 /);
});

test("caricaPagina salta l'elemento non disegnabile prima di passarlo all'agenzia, e lo scrive in console", () => {
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js");
    const inizio = revisore.indexOf("    caricaPagina(indice, list) {");
    const carica = revisore.substring(inizio, revisore.indexOf("\n    }\n", inizio));
    assert.match(carica,
        /let htmlItem = renderRecordRevisione\([^\n]*\);\s*(\/\/[^\n]*\n\s*)*if \(!Revisore\.elementoDisegnabile\(htmlItem\)\) \{\s*console\.error\(Revisore\.testoElementoNonDisegnabile\(dataItem, revInstance\.modalitaSottogruppi\)\);\s*continue;\s*\}\s*if \(this\.agenzia\.compilaBoxConInformazioniCustom != null\) \{/);
});

test("in modalita' sottogruppi il gruppo senza un suo elemento non rompe piu'", () => {
    const componenti = sorgente("Istanta/wwwroot/js/components.js");
    assert.match(componenti, /htmlItem\.find\("#CodPrimario"\)\.val\(elementoGruppo != null \? elementoGruppo\.recordInTracciato\.PrimarioGruppo : ""\);/);
    assert.match(componenti, /htmlItem\.find\("#CodSecondari"\)\.val\(elementoGruppo != null \? elementoGruppo\.recordInTracciato\.SecondariGruppo : ""\);/);
});

/* ---- il conteggio ---- */

function contatore(lista) {
    const salvate = { $: global.$, keyScattoCodiceGruppo: global.keyScattoCodiceGruppo, keyRefCodice: global.keyRefCodice, statoRevisione: global.statoRevisione };
    let html = "";
    global.$ = (selettore) => {
        if (typeof selettore === "string" && selettore.startsWith("<div class=\"counter-placeholder\"")) {
            html = selettore;
        }
        return { length: 0, remove: () => {}, css: () => {}, append: () => {} };
    };
    global.keyScattoCodiceGruppo = "Scatto.CodiceGruppo";
    global.keyRefCodice = "Referenza.Codice";
    global.statoRevisione = statoRevisione;
    try {
        Revisore.prototype.creaEAggiornaRevisioniCounter.call({}, lista);
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
    return Number(html.match(/<span class="counter-text">(\d+)<\/span>/)[1]);
}

function ref(codice, gruppo) {
    return { isGruppo: false, recordRevisionato: null, recordInTracciato: { "Referenza.Codice": codice, "Scatto.CodiceGruppo": gruppo } };
}

test("una ref che compare sotto due gruppi si conta una volta sola, anche nel contatore della pagina", () => {
    const lista = [
        { isGruppo: true, recordRevisionato: null, recordInTracciato: { "Scatto.CodiceGruppo": GRUPPO } },
        ref("6322946", GRUPPO),
        ref("6322946", "6322946,7000001"),
        ref("6322965", GRUPPO)
    ];
    //Il gruppo, 6322946 e 6322965: tre da revisionare, non quattro.
    assert.strictEqual(contatore(lista), 3);
});

test("il conteggio del server resta per codici distinti", () => {
    const controller = sorgente("Istanta/Controllers/RevisoreController.cs");
    const inizio = controller.indexOf("[Route(\"Revisore/getConteggio\")]");
    const conteggio = controller.substring(inizio, inizio + 12000);
    assert.match(conteggio, /var codici = lista\s*\.Select\(x => x\.Codice\)\s*\.Distinct\(\)/);
    assert.match(conteggio, /var codiciGruppo = lista\.Where\(x=>x\.CodGruppo != x\.Codice\)\s*\.Select\(x => x\.CodGruppo\)\s*\.Distinct\(\)/);
});
