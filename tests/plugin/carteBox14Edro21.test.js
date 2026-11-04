/*
 * TASK-d4976be3: le carte fedelta' del BOX14 di Edro21 (LBL_Carte) si adattano al loro riquadro.
 *
 * LBL_Carte e' un riquadro che contiene il gruppo delle carte. Il CssFramework lo spostava soltanto
 * (spostamento lineare) e non ne adattava mai il contenuto: a fine impaginazione le carte potevano
 * restare fuori dal box, invisibili, e andavano sistemate a mano. Ora il gruppo di allineamento
 * Campi_DX del BOX14 chiede, dopo aver disposto i campi, il fit proporzionale di LBL_Carte, in
 * tutti e due i kit del volantino (SC e SS/CN/CY).
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

function campiDxDelBox14() {
    //Il kit del POP (tipo lavorazione 2) non ha il BOX14: li' le mini collection vanno nel BOX3_PoP.
    return css.dbRidimensionamentiAllineamenti.modificheCssPerKit
        .filter(kit => kit.operazioniPerBox.some(op => op.nomiBox.includes("BOX14")))
        .map(kit => {
        const operazioni = kit.operazioniPerBox.find(op => op.nomiBox.includes("BOX14"));
        return {
            canali: kit.kit.canaliValidi,
            gruppo: operazioni.allineamenti.find(al => al.nomeGruppo === "Campi_DX")
        };
    });
}

test("in tutti e due i kit il gruppo Campi_DX del BOX14 adatta LBL_Carte proporzionalmente", () => {
    const kit = campiDxDelBox14();

    //I due kit del volantino.
    assert.deepStrictEqual(kit.map(k => k.canali), [["SC"], ["SS", "CN", "CY"]]);
    kit.forEach(k => {
        assert.ok(k.gruppo.gruppoEtichette.includes("LBL_Carte"));
        assert.deepStrictEqual(k.gruppo.finalFit, [{ nomiElementi: ["LBL_Carte"], fit: [2] }]);
    });
    assert.strictEqual(CssFramework.enumFitOperation(2), "PROPORTIONALLY");
});

test("il fit dichiarato adatta proporzionalmente il riquadro delle carte, e solo quello", () => {
    const chiamate = [];
    const elemento = (nome) => ({ name: nome, fit: (opzione) => chiamate.push([nome, opzione]) });
    const mappa = {
        LBL_Carte: { item: elemento("LBL_Carte"), eliminato: false },
        campo_offerta: { item: elemento("campo_offerta"), eliminato: false }
    };

    CssFramework.finalFit(mappa, campiDxDelBox14()[1].gruppo.finalFit);

    assert.deepStrictEqual(chiamate, [["LBL_Carte", "PROPORTIONALLY"]]);
});

test("senza LBL_Carte nel box (carte cancellate dal dato) non si adatta niente", () => {
    const chiamate = [];
    const mappa = {
        LBL_Carte: { item: { name: "LBL_Carte", fit: () => chiamate.push("LBL_Carte") }, eliminato: true }
    };

    CssFramework.finalFit(mappa, campiDxDelBox14()[0].gruppo.finalFit);

    assert.deepStrictEqual(chiamate, []);
});
