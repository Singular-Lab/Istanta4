/*
 * Info pack del PoP Coop: "a conf." accanto al prezzo, a 5,2 mm dal testo di prezzo_promo.
 *
 * La regola prezzo_info_pack_FIX seguiva prezzo_promo*. Per makeRegexFromGroupName l'asterisco
 * vale qualunque coda, quindi il gruppo seguito prendeva anche prezzo_promo_kgl e i suoi bounds
 * finivano dove finisce il prezzo al kg: l'info pack usciva dal box e fixOverflowFromBox riportava
 * dentro tutto gruppo_prezzo, prezzo compreso. Ora l'ancora segue il solo prezzo_promo.
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

function ancoraInfoPackDelPoP() {
    const kit = JSON.parse(fs.readFileSync(FILE_CSS, "utf8")).dbRidimensionamentiAllineamenti.modificheCssPerKit;
    const pop = kit.find(k => k.kit.kitTipoLavorazioniValide.length == 1 && k.kit.kitTipoLavorazioniValide[0] == 2);
    const generica = pop.operazioniPerBox.find(o => o.nomiBox.length == 0);
    return generica.allineamenti.find(a => a.nomeGruppo == "prezzo_info_pack_FIX").followAnchor[0];
}

function seguiti(ancora, etichetta) {
    return ancora.nomiGruppiSeguiti.some(nome => CssFramework.makeRegexFromGroupName(nome).test(etichetta));
}

test("con l'asterisco il gruppo seguito prende anche il prezzo al kg", () => {
    const vecchia = { nomiGruppiSeguiti: ["prezzo_promo*"] };

    assert.ok(seguiti(vecchia, "prezzo_promo"));
    assert.ok(seguiti(vecchia, "prezzo_promo_kgl"));
});

test("l'info pack del PoP segue il solo prezzo_promo", () => {
    const ancora = ancoraInfoPackDelPoP();

    assert.ok(seguiti(ancora, "prezzo_promo"));
    assert.ok(!seguiti(ancora, "prezzo_promo_kgl"));
    assert.ok(!seguiti(ancora, "prezzo_promo_SOCI"));
    assert.strictEqual(ancora.xAnchor.distance, -5.2);
});
