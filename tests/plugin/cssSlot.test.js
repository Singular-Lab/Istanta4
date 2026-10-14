/*
 * I20-1102: il gruppo di allineamento a slot.
 *
 * Nel PoP di Coop i loghi vanno nei riquadri del modello slot_logo1, slot_logo2, slot_logo3, in
 * quest'ordine: il primo logo in slot_logo1, il secondo in slot_logo2, il terzo in slot_logo3. Un
 * gruppo a livelli non lo sa fare: impila da un'ancora. Il gruppo dichiara i suoi slot, i loghi
 * presenti vanno uno per riquadro nell'ordine di priorita' dei livelli, centro su centro e, in
 * modalita' posizioneEDimensione, con la misura del riquadro; poi vale il fit finale. I riquadri si
 * tolgono tutti, anche vuoti; i loghi in piu' vanno in alto a destra e il bollino lo dice. Un box
 * senza nessuno dei riquadri si allinea a livelli, come prima.
 *
 * cssFramework/slot.js e' puro; CssFramework.js si carica con un modulo indesign finto, come in
 * tracciaBaseGruppo.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const cssSlot = require("../../plugin/cssFramework/slot.js");

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

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r\n/g, "\n");
}

const corrisponde = (etichetta, chiave) => new RegExp("^" + etichetta.split("*").map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(chiave);

/* ---- il piano ---- */

test("i loghi presenti seguono la priorita' dei livelli, tutti quelli che corrispondono, una volta sola", () => {
    const livelli = [
        { livello: 2, elementi: ["*logo_igp*"] },
        { livello: 1, elementi: ["*logo_dop*", "*logo_d*"] },
        { livello: 3, elementi: ["*conad*"] }
    ];
    const presenti = [{ chiave: "foto_extra$logo_igp$tipo_2" }, { chiave: "foto_extra$conad_a$tipo_2" }, { chiave: "foto_extra$logo_dop$tipo_2" }, { chiave: "foto_extra$conad_b$tipo_2" }];

    assert.deepStrictEqual(cssSlot.elementiInOrdine(livelli, presenti, corrisponde).map(e => e.chiave),
        ["foto_extra$logo_dop$tipo_2", "foto_extra$logo_igp$tipo_2", "foto_extra$conad_a$tipo_2", "foto_extra$conad_b$tipo_2"]);
    assert.deepStrictEqual(cssSlot.elementiInOrdine(null, presenti, corrisponde), []);
});

const SLOT = [{ nome: "slot_logo1", bounds: [10, 80, 20, 90] }, { nome: "slot_logo2", bounds: [30, 80, 40, 90] }, { nome: "slot_logo3", bounds: [50, 80, 60, 90] }];
const BOX = [0, 0, 100, 100];

test("posizione e dimensione: ogni logo prende il suo slot, nell'ordine delle cornici", () => {
    const piano = cssSlot.pianifica(SLOT, [{ chiave: "a", bounds: [0, 0, 4, 6] }, { chiave: "b", bounds: [0, 0, 8, 8] }], "posizioneEDimensione", BOX);

    assert.deepStrictEqual(piano.assegnati, [
        { chiave: "a", slot: "slot_logo1", bounds: [10, 80, 20, 90] },
        { chiave: "b", slot: "slot_logo2", bounds: [30, 80, 40, 90] }
    ]);
    assert.deepStrictEqual(piano.inEccesso, []);
});

test("solo posizione: il logo tiene la sua misura e il suo centro va sul centro dello slot", () => {
    const piano = cssSlot.pianifica(SLOT.slice(0, 1), [{ chiave: "a", bounds: [0, 0, 4, 6] }], "posizione", BOX);

    assert.deepStrictEqual(piano.assegnati[0].bounds, [13, 82, 17, 88]);
    assert.deepStrictEqual(cssSlot.centro(piano.assegnati[0].bounds), cssSlot.centro(SLOT[0].bounds));
});

test("i loghi in piu' degli slot vanno in alto a destra nel box, con la loro misura, uno sotto l'altro", () => {
    const loghi = ["a", "b", "c", "d", "e"].map(c => ({ chiave: c, bounds: [0, 0, 5, 7] }));
    const piano = cssSlot.pianifica(SLOT, loghi, "posizioneEDimensione", BOX);

    assert.deepStrictEqual(piano.assegnati.map(a => a.chiave), ["a", "b", "c"]);
    assert.deepStrictEqual(piano.inEccesso, [{ chiave: "d", bounds: [0, 93, 5, 100] }, { chiave: "e", bounds: [5, 93, 10, 100] }]);
});

test("i riquadri da togliere: quelli dichiarati, o le cornici; e i bounds per la mappa del box", () => {
    assert.deepStrictEqual(cssSlot.corniciDaRimuovere({ cornici: ["slot_logo1"], corniciDaRimuovere: ["slot_logo*"] }), ["slot_logo*"]);
    assert.deepStrictEqual(cssSlot.corniciDaRimuovere({ cornici: ["slot_logo1", "slot_logo2"] }), ["slot_logo1", "slot_logo2"]);
    assert.deepStrictEqual(cssSlot.corniciDaRimuovere(null), []);
    assert.deepStrictEqual(cssSlot.boundsRelativi([105, 210, 130, 260], [100, 200, 150, 250]), [5, 10, 30, 50]);
});

/* ---- nel CssFramework ---- */

function elemento(label, bounds, opzioni = {}) {
    const el = {
        label: label,
        _bounds: bounds.slice(),
        isValid: true,
        visible: opzioni.visible !== false,
        rimosso: false,
        get geometricBounds() { return this._bounds.slice(); },
        set geometricBounds(b) { this._bounds = b.slice(); },
        move(_a, by) { this._bounds = [this._bounds[0] + by[1], this._bounds[1] + by[0], this._bounds[2] + by[1], this._bounds[3] + by[0]]; },
        remove() { this.rimosso = true; this.isValid = false; }
    };
    return el;
}

function conGlobali(prova) {
    const salvate = { Utility: global.Utility, addSegnalazione: global.addSegnalazione };
    const segnalazioni = [];
    //Come Utility.parseLabel: le etichette foto_extra restano intere, le altre si tagliano al primo $.
    global.Utility = { parseLabel: (l) => String(l).startsWith("foto_extra") ? String(l) : String(l).split("$")[0] };
    global.addSegnalazione = (msg, tipo, priorita, bollino, impostazioni, chiave) => segnalazioni.push({ msg, tipo, impostazioni, chiave });
    try {
        return prova(segnalazioni);
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

const GRUPPO = {
    nomeGruppo: "Loghi",
    gruppoEtichette: ["*logo_dop*", "*logo_igp*", "*conad*", "*bio*"],
    ordinamentoLivelli: [{ livello: 1, elementi: ["*logo_dop*"] }, { livello: 2, elementi: ["*logo_igp*"] }, { livello: 3, elementi: ["*conad*"] }, { livello: 4, elementi: ["*bio*"] }],
    slot: { cornici: ["slot_logo1", "slot_logo2", "slot_logo3"], modalita: "posizioneEDimensione", corniciDaRimuovere: ["slot_logo*"] }
};

function boxConElementi(elementi) {
    return { geometricBounds: [0, 0, 100, 100], allPageItems: elementi, label: "BOX_test" };
}

function eseguiSlot(elementi, gruppo = GRUPPO) {
    const box = boxConElementi(elementi);
    const mappa = CssFramework.creaMappaturaBoxOriginale(box, []);
    const gruppoElementi = [];
    gruppo.gruppoEtichette.forEach(etichetta => {
        const regex = CssFramework.makeRegexFromGroupName(etichetta);
        Object.keys(mappa).forEach(k => { if (regex.test(k)) { gruppoElementi.push(mappa[k]); } });
    });
    return { esito: CssFramework.allineaASlot(box, JSON.parse(JSON.stringify(gruppo)), gruppoElementi, mappa, null), mappa: mappa };
}

test("i loghi vanno nei riquadri in ordine di priorita', con la misura del riquadro, e i riquadri si tolgono tutti", () => conGlobali((segnalazioni) => {
    const igp = elemento("foto_extra$logo_igp$tipo_2", [0, 0, 100, 100]);
    const dop = elemento("foto_extra$logo_dop$tipo_2", [0, 0, 100, 100]);
    const cornici = [elemento("slot_logo1", [40, 70, 50, 90]), elemento("slot_logo2", [55, 70, 65, 90]), elemento("slot_logo3", [25, 70, 35, 90]), elemento("slot_logoGrande", [30, 5, 70, 30])];

    const { esito, mappa } = eseguiSlot([igp, dop].concat(cornici));

    assert.strictEqual(esito, true);
    assert.deepStrictEqual(dop.geometricBounds, [40, 70, 50, 90]);
    assert.deepStrictEqual(igp.geometricBounds, [55, 70, 65, 90]);
    assert.ok(cornici.every(c => c.rimosso), "tutti i riquadri, anche slot_logo3 e slot_logoGrande rimasti vuoti");
    assert.ok(["slot_logo1", "slot_logo2", "slot_logo3", "slot_logoGrande"].every(k => mappa[k].eliminato));
    assert.deepStrictEqual(mappa["foto_extra$logo_dop$tipo_2"].bounds, [40, 70, 50, 90]);
    assert.deepStrictEqual(segnalazioni, []);
}));

test("solo posizione: il logo tiene la sua misura, centro su centro", () => conGlobali(() => {
    const dop = elemento("foto_extra$logo_dop$tipo_2", [0, 0, 10, 20]);
    const gruppo = JSON.parse(JSON.stringify(GRUPPO));
    gruppo.slot.modalita = "posizione";

    eseguiSlot([dop, elemento("slot_logo1", [40, 70, 50, 90])], gruppo);

    //Stessa misura dello slot: coincide con lui.
    assert.deepStrictEqual(dop.geometricBounds, [40, 70, 50, 90]);
    const conMisuraDiversa = elemento("foto_extra$logo_dop$tipo_2", [0, 0, 4, 6]);
    eseguiSlot([conMisuraDiversa, elemento("slot_logo1", [40, 70, 50, 90])], gruppo);
    assert.deepStrictEqual(conMisuraDiversa.geometricBounds, [43, 77, 47, 83]);
}));

test("i loghi in piu' vanno in alto a destra e il bollino lo dice con il nome del gruppo; un logo nascosto non prende slot", () => conGlobali((segnalazioni) => {
    const loghi = [elemento("foto_extra$logo_dop$tipo_2", [0, 0, 10, 10]), elemento("foto_extra$logo_igp$tipo_2", [0, 0, 10, 10]),
        elemento("foto_extra$conad$tipo_2", [0, 0, 10, 10]), elemento("foto_extra$bio$tipo_2", [0, 0, 6, 8]),
        elemento("foto_extra$bio_spento$tipo_2", [0, 0, 6, 8], { visible: false })];

    eseguiSlot(loghi.concat([elemento("slot_logo1", [40, 70, 50, 90]), elemento("slot_logo2", [55, 70, 65, 90]), elemento("slot_logo3", [25, 70, 35, 90])]));

    assert.deepStrictEqual(loghi[3].geometricBounds, [0, 92, 6, 100]);
    assert.deepStrictEqual(loghi[4].geometricBounds, [0, 0, 6, 8], "il logo nascosto resta dov'e'");
    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].msg, /^Code CSF-24 Gruppo Loghi: 4 elementi per 3 slot, foto_extra\$bio\$tipo_2 in alto a destra nel box$/);
    assert.strictEqual(segnalazioni[0].tipo, "warning");
}));

test("un riquadro che manca si salta; senza nessun riquadro il gruppo non tocca niente e torna ai livelli", () => conGlobali(() => {
    const dop = elemento("foto_extra$logo_dop$tipo_2", [0, 0, 10, 10]);
    const igp = elemento("foto_extra$logo_igp$tipo_2", [0, 0, 10, 10]);
    eseguiSlot([dop, igp, elemento("slot_logo2", [55, 70, 65, 90]), elemento("slot_logo3", [25, 70, 35, 90])]);
    assert.deepStrictEqual(dop.geometricBounds, [55, 70, 65, 90]);
    assert.deepStrictEqual(igp.geometricBounds, [25, 70, 35, 90]);

    const solo = elemento("foto_extra$logo_dop$tipo_2", [0, 0, 10, 10]);
    const { esito } = eseguiSlot([solo]);
    assert.strictEqual(esito, false);
    assert.deepStrictEqual(solo.geometricBounds, [0, 0, 10, 10]);
}));

test("nel ciclo degli allineamenti il gruppo a slot viene prima dei livelli, con il suo fit finale", () => {
    const css = sorgente("plugin/CssFramework.js");
    assert.match(css, /const cssSlot = require\('\.\/cssFramework\/slot'\);/);
    assert.match(css, /if \(allineamentoSingolo\.slot != null && this\.allineaASlot\(box, allineamentoSingolo, gruppoElementi, mappaBoxOriginale, itemRef\)\) \{\s*if \(allineamentoSingolo\.finalFit && allineamentoSingolo\.finalFit\.length > 0\) \{\s*this\.finalFit\(mappaBoxOriginale, allineamentoSingolo\.finalFit\);\s*\}\s*box = this\.fixOverflowFromBox\(boundsBoxImpaginato, box, mappaBoxOriginale\);\s*continue;\s*\}\s*let listGruppoAllineamento = this\.AllineamentoInternoGruppo\(/);
});

test("nel PoP di Coop i gruppi Loghi riempiono slot_logo1, slot_logo2, slot_logo3 e tolgono tutti gli slot; il volantino resta a livelli", () => {
    const kit = JSON.parse(sorgente("Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json")).dbRidimensionamentiAllineamenti.modificheCssPerKit;
    const gruppi = (k) => k.operazioniPerBox.flatMap(op => (op.allineamenti || []).filter(a => a.nomeGruppo === "Loghi"));

    const pop = kit.filter(k => k.kit.kitTipoLavorazioniValide.includes(2)).flatMap(gruppi);
    assert.strictEqual(pop.length, 2);
    pop.forEach(g => assert.deepStrictEqual(g.slot, { cornici: ["slot_logo1", "slot_logo2", "slot_logo3"], modalita: "posizioneEDimensione", corniciDaRimuovere: ["slot_logo*"] }));

    const volantino = kit.filter(k => k.kit.kitTipoLavorazioniValide.includes(1)).flatMap(gruppi);
    assert.ok(volantino.length > 0 && volantino.every(g => g.slot === undefined));
});
