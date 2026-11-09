/*
 * TASK-c6c5107d: la margherita B&F del BOX41 di Edro21 (margherita_BeF) segue la sua cornice.
 *
 * margherita_BeF e' un elemento fisso del modello del BOX41. Il BOX41 non ha regole di
 * ridimensionamento per lei: vale il gruppo della voce di default, con le etichette e LBL_Titolari,
 * che nel kit SS/CN/CY la sposta in orizzontale (spostamento lineare). Il ridimensionamento scrive i
 * geometricBounds della cornice, e in InDesign questo sposta la sola cornice: l'immagine restava
 * nella posizione del modello, decentrata e in parte fuori. Ora il gruppo chiede il fit del contenuto
 * alla cornice della sola margherita, in tutti e due i kit del volantino.
 *
 * Si prova sul SourceFrameworkCss vero di Edro21 e con CssFramework.finalFit vero, caricato sotto
 * Node con un indesign finto che porta solo FitOptions.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const FitOptions = { FRAME_TO_CONTENT: "FRAME_TO_CONTENT", CONTENT_TO_FRAME: "CONTENT_TO_FRAME", PROPORTIONALLY: "PROPORTIONALLY", FILL_PROPORTIONALLY: "FILL_PROPORTIONALLY" };

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: FitOptions };
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}

const FILE_CSS = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceFrameworkCss.json");
const css = JSON.parse(fs.readFileSync(FILE_CSS, "utf8").replace(/^﻿/, ""));

/// Il gruppo di ridimensionamento che prende margherita_BeF, come lo cerca il ridimensionamento:
/// prima fra le regole del BOX41, poi fra quelle della voce di default (nomiBox vuoto).
function gruppiDellaMargherita() {
    const prende = (gruppo) => gruppo.gruppoEtichette.some(etichetta => CssFramework.makeRegexFromGroupName(etichetta).test("margherita_BeF"));
    return css.dbRidimensionamentiAllineamenti.modificheCssPerKit
        .filter(kit => kit.operazioniPerBox.some(op => op.nomiBox.includes("BOX41")))
        .map(kit => {
            const box41 = kit.operazioniPerBox.find(op => op.nomiBox.includes("BOX41"));
            const predefinita = kit.operazioniPerBox.find(op => op.nomiBox.length === 0);
            return {
                canali: kit.kit.canaliValidi,
                delBox41: box41.ridimensionamenti.find(prende),
                gruppo: predefinita.ridimensionamenti.find(prende)
            };
        });
}

test("in tutti e due i kit il gruppo che prende margherita_BeF ne chiede il fit del contenuto alla cornice", () => {
    const kit = gruppiDellaMargherita();

    //I due kit del volantino.
    assert.deepStrictEqual(kit.map(k => k.canali), [["SC"], ["SS", "CN", "CY"]]);
    kit.forEach(k => {
        //Il BOX41 non ha una regola sua: vale quella della voce di default.
        assert.strictEqual(k.delBox41, undefined);
        assert.deepStrictEqual(k.gruppo.gruppoEtichette, ["etichetta_*", "LBL_Titolari", "margherita_BeF"]);
        assert.deepStrictEqual(k.gruppo.finalFit, [{ nomiElementi: ["margherita_BeF"], fit: [1] }]);
    });
    //Nel kit SS/CN/CY la margherita si sposta in orizzontale: e' li' che la cornice lasciava indietro l'immagine.
    assert.strictEqual(CssFramework.enumAxisResizeMode(kit[1].gruppo.ridimensionamento.x), "spostamento_lineare");
    assert.strictEqual(CssFramework.enumFitOperation(1), "CONTENT_TO_FRAME");
});

test("il fit dichiarato adatta il contenuto della margherita alla cornice, e non le etichette del gruppo", () => {
    const chiamate = [];
    const elemento = (nome) => ({ name: nome, fit: (opzione) => chiamate.push([nome, opzione]) });
    const mappa = {
        margherita_BeF: { item: elemento("margherita_BeF"), eliminato: false },
        etichetta_1: { item: elemento("etichetta_1"), eliminato: false },
        LBL_Titolari: { item: elemento("LBL_Titolari"), eliminato: false }
    };

    CssFramework.finalFit(mappa, gruppiDellaMargherita()[1].gruppo.finalFit);

    assert.deepStrictEqual(chiamate, [["margherita_BeF", "CONTENT_TO_FRAME"]]);
});

test("senza la margherita nel box (tolta da AgenziaLib) non si adatta niente", () => {
    const chiamate = [];
    const mappa = {
        margherita_BeF: { item: { name: "margherita_BeF", fit: () => chiamate.push("margherita_BeF") }, eliminato: true },
        LBL_Titolari: { item: { name: "LBL_Titolari", fit: () => chiamate.push("LBL_Titolari") }, eliminato: false }
    };

    CssFramework.finalFit(mappa, gruppiDellaMargherita()[0].gruppo.finalFit);

    assert.deepStrictEqual(chiamate, []);
});

test("il ridimensionamento applica il finalFit del gruppo all'elemento appena spostato, se e' fra quelli elencati", () => {
    const sorgente = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "CssFramework.js"), "utf8").replace(/\r/g, "");
    assert.match(sorgente, /if\(ridimensionamentoElemento\.finalFit && ridimensionamentoElemento\.finalFit\.length > 0\)\{[\s\S]*?listFitToDo\.push\(fit\);[\s\S]*?this\.finalFit\(mappaBoxOriginale, listFitToDo\);/);
});
