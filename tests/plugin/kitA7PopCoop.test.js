/*
 * Il kit del CssFramework per il PoP Coop A7.
 *
 * Il PoP aveva un solo kit, senza formato, che valeva per tutti i formati. Ora l'A7 ha un kit suo
 * (kitFormatiValidi ["A7"]). Il Plugin prende il primo kit valido per tipo di lavorazione e formato,
 * e il kit senza formato vale anche per l'A7: il kit A7 deve stare prima. Qui si prova la scelta con
 * kitDelleRegole sulla configurazione vera di Coop.
 *
 * CssFramework.js si carica con un modulo indesign finto, come in spostamentiGriglia.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
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

const FILE_CSS = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Coopfi", "SourceFrameworkCss.json");
const file = JSON.parse(fs.readFileSync(FILE_CSS, "utf8")).dbRidimensionamentiAllineamenti;

//La lavorazione corrente: PoP o volantino, con area, canale e formato.
function lavorazione(tipo, formato) {
    global.ficoProcess = {
        getAreaLavorazioneCorrente: () => ({ sigla: "A" }),
        getCanaleLavorazioneCorrente: () => ({ sigla: "SC" }),
        getTipoLavorazioneCorrente: () => tipo,
        getFormatoLavorazioneCorrente: () => ({ codice: formato })
    };
}

test("nel PoP A7 si usa il kit dell'A7", () => {
    lavorazione(2, "A7");
    const scelto = CssFramework.kitDelleRegole(file);

    assert.deepStrictEqual(scelto.fileModifiche.kit.kitFormatiValidi, ["A7"]);
    assert.strictEqual(scelto.fileModificheDef, scelto.fileModifiche);
});

test("nel PoP A3 orizzontale e verticale si usa ancora il kit PoP senza formato", () => {
    for (const formato of ["A3_ORIZZONTALI", "A3_VERTICALI"]) {
        lavorazione(2, formato);
        const scelto = CssFramework.kitDelleRegole(file);

        assert.deepStrictEqual(scelto.fileModifiche.kit.kitTipoLavorazioniValide, [2], formato);
        assert.deepStrictEqual(scelto.fileModifiche.kit.kitFormatiValidi, [], formato);
    }
});

test("il volantino non prende mai il kit dell'A7", () => {
    lavorazione(1, "A7");
    const scelto = CssFramework.kitDelleRegole(file);

    assert.ok(!scelto.fileModifiche.kit.kitTipoLavorazioniValide.includes(2));
});
