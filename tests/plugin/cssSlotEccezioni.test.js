/*
 * Eccezioni del gruppo a slot.
 *
 * Il gruppo a slot aveva una modalita' sola per tutti gli elementi e allineava sempre al centro. Ora
 * puo' dichiarare eccezioni: per gli elementi che nominano, sotto le loro condizioni, una modalita'
 * e un allineamento orizzontale propri. Con "destra" l'elemento e' centrato in verticale e il suo
 * bordo destro va su quello dello slot. Nel PoP Coop: FiorFiore, Banco del Gusto e Origine Italia
 * con la loro misura, a destra nei box delle meccaniche verticali, al centro negli altri.
 *
 * slot.js e' puro e si prova qui; allineaASlot parla con InDesign e si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const cssSlot = require("../../plugin/cssFramework/slot.js");

const corrisponde = (etichetta, chiave) => new RegExp("^" + etichetta.split("*").map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(chiave);

const SLOT = [10, 80, 30, 120];

/* ---- dove va un elemento nello slot ---- */

test("a destra: centro verticale e bordo destro sullo slot, con la sua misura", () => {
    //Un logo largo 90,949 e alto 27,502 in uno slot largo 40 e alto 20: sporge a sinistra.
    const bounds = cssSlot.boundsNelloSlot([0, 0, 27.502, 90.949], SLOT, "posizione", "destra");

    assert.strictEqual(bounds[3], 120);
    assert.ok(Math.abs((bounds[0] + bounds[2]) / 2 - 20) < 1e-9);
    assert.ok(Math.abs((bounds[3] - bounds[1]) - 90.949) < 1e-9);
    assert.ok(Math.abs((bounds[2] - bounds[0]) - 27.502) < 1e-9);
});

test("a sinistra il bordo sinistro, al centro come prima", () => {
    assert.deepStrictEqual(cssSlot.boundsNelloSlot([0, 0, 10, 20], SLOT, "posizione", "sinistra"), [15, 80, 25, 100]);
    assert.deepStrictEqual(cssSlot.boundsNelloSlot([0, 0, 10, 20], SLOT, "posizione", "centro"), [15, 90, 25, 110]);
    assert.deepStrictEqual(cssSlot.boundsNelloSlot([0, 0, 10, 20], SLOT, "posizione"), [15, 90, 25, 110]);
});

test("con la misura dello slot l'allineamento non conta", () => {
    assert.deepStrictEqual(cssSlot.boundsNelloSlot([0, 0, 10, 20], SLOT, "posizioneEDimensione", "destra"), SLOT);
});

/* ---- il piano con gli elementi eccezione ---- */

test("nel piano l'elemento eccezione tiene la sua misura a destra, gli altri prendono lo slot", () => {
    const cornici = [{ nome: "slot_logo1", bounds: [10, 80, 30, 120] }, { nome: "slot_logo2", bounds: [40, 80, 60, 120] }];
    const elementi = [
        { chiave: "foto_extra$Logo_FiorFiore$tipo_3", bounds: [0, 0, 27.502, 90.949], modalita: "posizione", allineamentoOrizzontale: "destra" },
        { chiave: "foto_extra$logo_dop$tipo_3", bounds: [0, 0, 5, 5] }
    ];

    const piano = cssSlot.pianifica(cornici, elementi, "posizioneEDimensione", [0, 0, 100, 140]);

    assert.strictEqual(piano.assegnati[0].bounds[3], 120);
    assert.ok(Math.abs((piano.assegnati[0].bounds[3] - piano.assegnati[0].bounds[1]) - 90.949) < 1e-9);
    assert.deepStrictEqual(piano.assegnati[1].bounds, [40, 80, 60, 120]);
    assert.strictEqual(cssSlot.modalitaDi(elementi[0], "posizioneEDimensione"), "posizione");
    assert.strictEqual(cssSlot.modalitaDi(elementi[1], "posizioneEDimensione"), "posizioneEDimensione");
});

/* ---- la scelta dell'eccezione ---- */

const ECCEZIONI = [
    { elementi: ["*Logo_FiorFiore*"], modalita: "posizione", allineamentoOrizzontale: "destra", listSetCondizioni: ["verticale"] },
    { elementi: ["*Logo_FiorFiore*"], modalita: "posizione", allineamentoOrizzontale: "centro", listSetCondizioni: [] }
];

test("vale la prima eccezione che nomina l'elemento e le cui condizioni sono vere", () => {
    const veroInVerticale = (condizioni) => condizioni.length === 0 || condizioni.includes("verticale");
    const falsoInVerticale = (condizioni) => condizioni.length === 0;

    assert.strictEqual(cssSlot.eccezioneDi(ECCEZIONI, "foto_extra$Logo_FiorFiore$tipo_3", corrisponde, veroInVerticale).allineamentoOrizzontale, "destra");
    assert.strictEqual(cssSlot.eccezioneDi(ECCEZIONI, "foto_extra$Logo_FiorFiore$tipo_3", corrisponde, falsoInVerticale).allineamentoOrizzontale, "centro");
});

test("un elemento che nessuna eccezione nomina, o un gruppo senza eccezioni, non ne ha", () => {
    assert.strictEqual(cssSlot.eccezioneDi(ECCEZIONI, "foto_extra$logo_dop$tipo_3", corrisponde, () => true), null);
    assert.strictEqual(cssSlot.eccezioneDi(undefined, "foto_extra$Logo_FiorFiore$tipo_3", corrisponde, () => true), null);
    assert.strictEqual(cssSlot.eccezioneDi([], "foto_extra$Logo_FiorFiore$tipo_3", corrisponde, () => true), null);
});

/* ---- dove si applica ---- */

test("allineaASlot sceglie l'eccezione con le condizioni del CssFramework e ridimensiona solo chi prende lo slot", () => {
    const testo = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");
    const inizio = testo.indexOf("    allineaASlot(");
    const corpo = testo.substring(inizio, testo.indexOf("\n    },", inizio));

    assert.match(corpo, /cssSlot\.eccezioneDi\(slot\.eccezioni, elemento\.chiave,/);
    assert.match(corpo, /listSetCondizioni => this\.checkAllConditions\(mappaBoxOriginale, itemRef, listSetCondizioni, box\)/);
    assert.match(corpo, /piazza\(a\.chiave, a\.bounds, modalitaPerElemento\.get\(a\.chiave\) === cssSlot\.MODALITA_POSIZIONE_E_DIMENSIONE\)/);
    assert.ok(corpo.indexOf("cssSlot.eccezioneDi(") < corpo.indexOf("cssSlot.pianifica("), "le eccezioni prima del piano");
});

test("nella configurazione di Coop le eccezioni riconoscono i tre loghi, e solo loro", () => {
    const css = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Coopfi", "SourceFrameworkCss.json"), "utf8"));
    const pop = css.dbRidimensionamentiAllineamenti.modificheCssPerKit.find(k => k.kit.kitTipoLavorazioniValide.length == 1 && k.kit.kitTipoLavorazioniValide[0] == 2);
    const slot = pop.operazioniPerBox.find(o => o.nomiBox.length == 0).allineamenti.find(a => a.nomeGruppo == "Loghi").slot;

    const sempre = () => true;
    for (const chiave of ["foto_extra$Logo_FiorFiore$tipo_3", "foto_extra$fiorfiore.psd$tipo_3", "foto_extra$Logo_BancodelGusto$tipo_3", "foto_extra$Logo_OrigineItalia$tipo_3", "foto_extra$Origine_Italia-logo.psd$tipo_3"]) {
        assert.strictEqual(cssSlot.eccezioneDi(slot.eccezioni, chiave, corrisponde, sempre).allineamentoOrizzontale, "destra", chiave);
        assert.strictEqual(cssSlot.eccezioneDi(slot.eccezioni, chiave, corrisponde, c => c.length === 0).allineamentoOrizzontale, "centro", chiave);
    }
    assert.strictEqual(cssSlot.eccezioneDi(slot.eccezioni, "foto_extra$logo_dop$tipo_3", corrisponde, sempre), null);
});
