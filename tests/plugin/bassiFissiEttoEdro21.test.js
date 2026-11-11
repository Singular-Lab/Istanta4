/*
 * I20-1229: il box Bassi & Fissi (BOX41) di Edro21 con la meccanica all'etto.
 *
 * rect_etto e sy_etto si ancorano in basso a destra ed evitano la traccia del bordo della base;
 * il gruppo del prezzo (Campi_DX) si mette alla loro sinistra seguendo sy_etto e evita anche lui
 * la traccia. Ma lo misurava sul testo (useTextBounds): il testo del prezzo stava dentro, il fondo
 * rosso di prezzo_offerta_gruppo no, e restava sulla traccia gialla 1,76 mm piu' in basso di
 * rect_etto. Senza etto lo stesso gruppo misura il riquadro e sta dentro. Ora anche con l'etto.
 *
 * Le misure sono quelle della traccia su file del Plugin (Rifai box sul BOX41, 11/11/2026).
 *
 * Esecuzione: node --test tests/plugin/bassiFissiEttoEdro21.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const RADICE = path.join(__dirname, "..", "..");

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

const regole = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json"), "utf8"));
const kitVolantino = regole.dbRidimensionamentiAllineamenti.modificheCssPerKit
    .filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));

function box41(kit) {
    const trovati = kit.operazioniPerBox.filter(o => (o.nomiBox || []).includes("BOX41"));
    assert.strictEqual(trovati.length, 1, "un solo BOX41 per kit");
    return trovati[0];
}

//Le due varianti del gruppo prezzo: quella che segue sy_etto (con l'etto) e quella senza.
function campiDX(kit, conEtto) {
    return box41(kit).allineamenti.filter(a => a.nomeGruppo === "Campi_DX" &&
        (a.followAnchor || []).some(f => (f.nomiGruppiSeguiti || []).includes("sy_etto")) === conEtto);
}

test("i due kit volantino di Edro21 hanno il BOX41", () => {
    assert.strictEqual(kitVolantino.length, 2);
    kitVolantino.forEach(box41);
});

test("con l'etto il gruppo prezzo evita la traccia misurando il riquadro, come senza etto", () => {
    for (const kit of kitVolantino) {
        const canali = kit.kit.canaliValidi.join(",");
        for (const conEtto of [true, false]) {
            const gruppi = campiDX(kit, conEtto);
            assert.strictEqual(gruppi.length, 1, "un Campi_DX " + (conEtto ? "con" : "senza") + " etto, canali " + canali);
            assert.ok(gruppi[0].gruppoEtichette.includes("prezzo_offerta_gruppo"));
            assert.strictEqual(gruppi[0].evitaTracciaAllineamento.evitaTracciaBase, true);
            assert.strictEqual(gruppi[0].evitaTracciaAllineamento.useTextBounds, false,
                "il fondo del prezzo deve stare dentro la traccia, canali " + canali);
        }
    }
});

test("rect_etto e sy_etto restano ancorati in basso a destra e misurati come prima", () => {
    for (const kit of kitVolantino) {
        for (const nome of ["Rect_etto_All", "sy_etto_All"]) {
            const gruppo = box41(kit).allineamenti.find(a => a.nomeGruppo === nome);
            assert.ok(gruppo, nome);
            assert.strictEqual(gruppo.staticAnchor[0].xAnchor.allineaAlLato, 1);
            assert.strictEqual(gruppo.staticAnchor[0].yAnchor.allineaAlLato, 1);
            assert.deepStrictEqual(gruppo.evitaTracciaAllineamento, { evitaTracciaBase: true, useTextBounds: true, distance: 0 });
        }
    }
});

/* ---- con le misure della traccia ---- */

//Base 34..112,4 x 83..149 mm, traccia di 5 pt interna (1,7639 mm).
const INSET = 5 * 0.352777778;
const INTERNO = [34 + INSET, 83 + INSET, 112.4 - INSET, 149 - INSET];
//Campi_DX non ha ancora statica: evita la traccia da tutti i lati.
const TUTTI = { x: { inizio: true, fine: true }, y: { inizio: true, fine: true } };
//prezzo_offerta_gruppo dopo l'aggancio a sy_etto: il riquadro (con il fondo) e il solo testo.
const PREZZO_RIQUADRO = [98.364, 110.942, 112.4, 141.942];
const PREZZO_TESTO = [98.364, 121.974, 110.496, 141.942];
//rect_etto dopo Rect_etto_All.
const RECT_ETTO_BASSO = 110.636;

test("misurato sul riquadro, il prezzo sale di una traccia e finisce a filo di rect_etto", () => {
    const spostamento = CssFramework.spostamentoTracciaBase([PREZZO_RIQUADRO], INTERNO, TUTTI);
    assert.strictEqual(spostamento[0], 0);
    assert.ok(Math.abs(spostamento[1] + INSET) < 0.001, "sale di " + (-spostamento[1]));
    assert.ok(Math.abs(PREZZO_RIQUADRO[2] + spostamento[1] - RECT_ETTO_BASSO) < 0.001);
});

test("prima: misurato sul testo non si spostava e il fondo restava sulla traccia", () => {
    assert.deepStrictEqual(CssFramework.spostamentoTracciaBase([PREZZO_TESTO], INTERNO, TUTTI), [0, 0]);
    assert.ok(PREZZO_RIQUADRO[2] > INTERNO[2]);
});
