/*
 * I20-1025: reimpaginando un box di Edro21 la foto cambiava dimensione e posizione.
 *
 * Due cause. Tutti i box tranne il BOX41 sceglievano lo spazio con l'area massima, e due spazi
 * quasi uguali si scambiavano per pochi millimetri. E il fix foto di Edro21, che prova il box in
 * due disposizioni (la descrizione dov'e', o spostata in basso), teneva quella con l'area
 * maggiore: Math.floor(area1) >= Math.floor(area2), con NaN quando una prova non trovava posto.
 *
 * Ora la preferenza del box - la sua, o quella della voce di default del kit - decide anche fra
 * le due disposizioni: entro la tolleranza vince la foto piu' centrata.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const sceltaSpazio = require("../../plugin/sistemazioneFoto/sceltaSpazio.js");

function caricaConStub() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return {};
        }
        return originale.apply(this, arguments);
    };
    try {
        return {
            CssFramework: require("../../plugin/CssFramework.js"),
            SistemazioneFoto: require("../../plugin/sistemazioneFoto/sistemazioneFoto.js")
        };
    }
    finally {
        Module._load = originale;
    }
}

const CENTRATO = { modo: "centrato", tolleranzaArea: 0.7, asseCentratura: "xy" };

/* ---- la scelta fra due disposizioni ---- */

test("con l'area massima vince la seconda solo se e' piu' grande, come prima", () => {
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 100.4 }, { area: 100.9 }, null), "prima");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 100 }, { area: 120 }, null), "seconda");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 120 }, { area: 100 }, { modo: "areaMassima" }), "prima");
});

test("col criterio centrato, entro la tolleranza vince la foto piu' centrata anche se piu' piccola", () => {
    const prima = { area: 1000, distanzaDalCentro: 12 };
    const seconda = { area: 800, distanzaDalCentro: 2 };

    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, CENTRATO), "seconda");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(seconda, prima, CENTRATO), "prima");
});

test("fuori tolleranza vince di nuovo l'area: una foto molto piu' piccola non basta a centrarsi", () => {
    const prima = { area: 1000, distanzaDalCentro: 12 };
    const seconda = { area: 600, distanzaDalCentro: 0 };

    assert.strictEqual(sceltaSpazio.preferisciDisposizione(prima, seconda, CENTRATO), "prima");
});

test("a pari centratura, entro mezzo millimetro, decide l'area e a parita' resta la prima", () => {
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 900, distanzaDalCentro: 3.2 }, { area: 1000, distanzaDalCentro: 3 }, CENTRATO), "seconda");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 1000, distanzaDalCentro: 3 }, { area: 1000.4, distanzaDalCentro: 2.8 }, CENTRATO), "prima");
});

test("una disposizione senza posto per le foto non vince mai, e senza nessuna resta la prima", () => {
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 500, distanzaDalCentro: 9 }, null, CENTRATO), "prima");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(null, { area: 500, distanzaDalCentro: 9 }, CENTRATO), "seconda");
    assert.strictEqual(sceltaSpazio.preferisciDisposizione(undefined, undefined, null), "prima");
    //Prima un'area undefined dava NaN, e il confronto sceglieva sempre la seconda.
    assert.strictEqual(sceltaSpazio.preferisciDisposizione({ area: 500 }, { area: undefined }, null), "prima");
});

/* ---- la preferenza del box ---- */

test("un box senza preferenza sua prende quella della voce di default del kit, il BOX41 tiene la sua", () => {
    const { CssFramework } = caricaConStub();
    const box41 = { modo: "centrato", tolleranzaArea: 0.7, asseCentratura: "x" };
    const precedente = CssFramework.contestoCss;
    CssFramework.contestoCss = {
        DBallineamenti: [
            { nomiBox: [], sceltaSpazioFoto: CENTRATO },
            { nomiBox: ["BOX41"], sceltaSpazioFoto: box41 },
            { nomiBox: ["BOX1"] }
        ],
        DBDefault: []
    };
    try {
        assert.strictEqual(CssFramework.getSceltaSpazioFoto({ label: "BOX41" }), box41);
        assert.strictEqual(CssFramework.getSceltaSpazioFoto({ label: "BOX1" }), CENTRATO);
        //Anche un box che il kit non nomina.
        assert.strictEqual(CssFramework.getSceltaSpazioFoto({ label: "BOX99" }), CENTRATO);

        //Senza voce di default con la preferenza, resta l'area massima come prima.
        CssFramework.contestoCss.DBallineamenti[0] = { nomiBox: [] };
        assert.strictEqual(CssFramework.getSceltaSpazioFoto({ label: "BOX1" }), null);
    }
    finally {
        CssFramework.contestoCss = precedente;
    }
});

test("la prova del fix foto restituisce area e distanza dal centro, o null senza posto", () => {
    const { SistemazioneFoto } = caricaConStub();
    const vero = SistemazioneFoto.fixFoto;
    try {
        SistemazioneFoto.fixFoto = function (box, candidati, ostacoli, projection) {
            assert.strictEqual(projection, true);
            this.ultimaProiezione = candidati.length > 0 ? { area: 42, distanzaDalCentro: 1.5 } : null;
            return candidati.length > 0 ? 42 : undefined;
        };
        assert.deepStrictEqual(SistemazioneFoto.proiezioneFixFoto({}, [{}], []), { area: 42, distanzaDalCentro: 1.5 });
        assert.strictEqual(SistemazioneFoto.proiezioneFixFoto({}, [], []), null);
    }
    finally {
        SistemazioneFoto.fixFoto = vero;
    }

    const sorgente = leggiFileDelPlugin("sistemazioneFoto/sistemazioneFoto.js").replace(/\r/g, "");
    assert.match(sorgente, /this\.ultimaProiezione = \{\s*area: areaFinale,\s*distanzaDalCentro: sceltaSpazio\.distanzaDalCentro\(bestCandidate, larghezzaBase, altezzaBase, sceltaSpazio\.normalizzaPreferenza\(preferenzaSpazio\)\.asseCentratura\)/);
});

/* ---- Edro21 ---- */

test("il fix foto di Edro21 sceglie la disposizione con la preferenza del box, non solo con l'area", () => {
    const custom = leggiFileDelPlugin("Agenzie/Edro21/custom.js").replace(/\r/g, "");
    const fn = custom.substring(custom.indexOf("    setCustomFixFoto(box){"));

    assert.match(fn, /var prova1 = CssFramework\.proiezioneFixFoto\(box, res1\.candidate, res1\.obstacles\);/);
    assert.match(fn, /var prova2 = CssFramework\.proiezioneFixFoto\(box, res2\.candidate, res2\.obstacles\);/);
    assert.match(fn, /if \(CssFramework\.preferisciDisposizioneFoto\(box, prova1, prova2\) === "prima"\) \{\s*descrizione\.geometricBounds = oldBounds;/);
    assert.doesNotMatch(fn.substring(0, fn.indexOf("\n    },\n")), /Math\.floor\(area1\)/);
});

test("nel volantino di Edro21 la voce di default dei kit centra le foto su xy, il BOX41 resta su x", () => {
    const percorso = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceFrameworkCss.json");
    const kits = JSON.parse(fs.readFileSync(percorso, "utf8")).dbRidimensionamentiAllineamenti.modificheCssPerKit;

    const volantino = kits.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));
    assert.ok(volantino.length > 0);
    for (const kit of volantino) {
        const predefinita = kit.operazioniPerBox.find(op => op.nomiBox.length === 0);
        assert.deepStrictEqual(predefinita.sceltaSpazioFoto, CENTRATO);
        const box41 = kit.operazioniPerBox.find(op => op.nomiBox.includes("BOX41"));
        assert.strictEqual(box41.sceltaSpazioFoto.asseCentratura, "x");
    }

    //Il PoP non passa dal fix foto di Edro21: niente preferenze.
    const pop = kits.filter(k => !(k.kit.kitTipoLavorazioniValide || []).includes(1));
    for (const kit of pop) {
        assert.ok(kit.operazioniPerBox.every(op => op.sceltaSpazioFoto == null));
    }
});
