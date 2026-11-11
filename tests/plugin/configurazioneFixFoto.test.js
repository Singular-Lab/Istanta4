/*
 * TASK-9bf94d47: la configurazione del fix foto non sta piu' nei custom.js delle agenzie ma nel
 * CssFramework del cliente (SourceFrameworkCss.json).
 *
 * Dove: una sezione fixFoto generale del file, accanto a modificheCssPerKit, che vale per ogni
 * lavorazione anche senza un kit (i canali SeD, Fid e PT di Edro21 non ne hanno), con le scelte per
 * box in perBox; e una sezione fixFoto nelle voci dei kit, per chi vuole un valore diverso in un kit.
 * Ogni valore lo decide la prima voce che lo dice: box nel kit, box nel kit di default, default del
 * kit, default del kit di default, perBox della generale, generale; altrimenti il default del Plugin.
 *
 * Qui: la regola con cui le voci si combinano (SistemazioneFoto.risolviConfigurazione), la scelta
 * delle voci con e senza contesto del CSS (CssFramework.getConfigurazioneFixFoto), che i dati
 * portati nei JSON siano quelli che stavano nei custom.js, e che nessuno li legga piu' da li'.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame", PROPORTIONALLY: "proportionally" } };
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
let SistemazioneFoto;
let FotoPlacer;
try {
    CssFramework = require("../../plugin/CssFramework.js");
    SistemazioneFoto = require("../../plugin/sistemazioneFoto/sistemazioneFoto.js");
    FotoPlacer = require("../../plugin/reperimentoFoto/fotoPlacer.js");
}
finally {
    Module._load = caricaOriginale;
}

const RADICE = path.join(__dirname, "..", "..");

function regoleDi(cliente) {
    const percorso = path.join(RADICE, "Istanta", "wwwroot", "external_source", cliente, "SourceFrameworkCss.json");
    return JSON.parse(fs.readFileSync(percorso, "utf8")).dbRidimensionamentiAllineamenti;
}

function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

//La lavorazione corrente, come la chiede kitDelleRegole.
let lavorazione = null;
global.ficoProcess = {
    getAreaLavorazioneCorrente: () => (lavorazione ? { sigla: lavorazione.area } : null),
    getCanaleLavorazioneCorrente: () => (lavorazione ? { sigla: lavorazione.canale } : null),
    getTipoLavorazioneCorrente: () => (lavorazione ? lavorazione.tipo : null),
    getFormatoLavorazioneCorrente: () => (lavorazione ? { codice: lavorazione.formato } : null)
};

//Le regole scaricate del cliente e la lavorazione, senza contesto del CSS: come al Fix foto premuto
//prima di ogni impaginazione.
function conRegole(cliente, lav) {
    CssFramework.regoleScaricate = regoleDi(cliente);
    CssFramework.contestoCss = null;
    lavorazione = lav;
}

function configurazione(etichettaBox) {
    return CssFramework.getConfigurazioneFixFoto(etichettaBox == null ? null : { label: etichettaBox });
}

//Il modo in cui l'impaginazione tratta il box, come lo decidono indexNew e reperimentoFoto.
function decisione(cfg, tipoLavorazione, haFixDellAgenzia) {
    if (!cfg.lavorazioni.includes(tipoLavorazione) || cfg.modo == "nessuno") {
        return "nessuno";
    }
    return cfg.modo != "semplice" && haFixDellAgenzia ? "agenzia" : "plugin";
}

/* ---- la regola con cui si combinano le voci ---- */

test("senza voci valgono i default del Plugin", () => {
    const cfg = SistemazioneFoto.risolviConfigurazione([]);

    assert.deepStrictEqual(cfg.lavorazioni, [1]);
    assert.strictEqual(cfg.modo, "automatico");
    assert.deepStrictEqual(cfg.distanziamento, SistemazioneFoto.calcoloDistanziamentoFoto);
    assert.deepStrictEqual(cfg.elementiIgnorati, []);
    assert.deepStrictEqual(cfg.eccezioniIgnorati, []);
    assert.deepStrictEqual(cfg.marginiElementi, []);
    //null: il margine dalla base lo decide spazioLibero.
    assert.strictEqual(cfg.marginiBox, null);
    assert.deepStrictEqual(cfg.marginiFoto, [0, 0]);
    assert.deepStrictEqual(cfg.agenzia, {});
});

test("ogni valore lo decide la prima voce che lo dice, anche i dati dell'agenzia chiave per chiave", () => {
    const delBox = { fixFoto: { marginiFoto: [2, 2], agenzia: { gruppoDescrizione: "gruppo_del_box" } } };
    const senzaSezione = { nomiBox: [] };
    const generale = {
        fixFoto: {
            marginiFoto: [1, 1], eccezioniIgnorati: ["*logo*"], lavorazioni: [1, 2],
            agenzia: { gruppoDescrizione: "gruppo_generale", descrizioneAllineataA: ["prezzo_offerta"] }
        }
    };

    const cfg = SistemazioneFoto.risolviConfigurazione([delBox, null, senzaSezione, generale]);

    assert.deepStrictEqual(cfg.marginiFoto, [2, 2]);
    assert.deepStrictEqual(cfg.eccezioniIgnorati, ["*logo*"]);
    assert.deepStrictEqual(cfg.lavorazioni, [1, 2]);
    assert.deepStrictEqual(cfg.agenzia, { gruppoDescrizione: "gruppo_del_box", descrizioneAllineataA: ["prezzo_offerta"] });
    //Un valore null nella voce piu' forte non copre quello di sotto.
    const conNull = SistemazioneFoto.risolviConfigurazione([{ fixFoto: { marginiFoto: null } }, generale]);
    assert.deepStrictEqual(conNull.marginiFoto, [1, 1]);
});

test("un intervallo di distanziamento senza fine nel JSON (null) diventa Infinity", () => {
    const cfg = SistemazioneFoto.risolviConfigurazione([{
        fixFoto: {
            distanziamento: [{ foto: 2, percDistFoto: [
                { percDistanceXFoto: [0.5], percDistanceYFoto: [-0.25], startRangeRatioCondition: 0, endRangeRatioCondition: 3 },
                { percDistanceXFoto: [0.55], percDistanceYFoto: [-0.05], startRangeRatioCondition: 3, endRangeRatioCondition: null }
            ] }]
        }
    }]);

    assert.strictEqual(cfg.distanziamento[0].percDistFoto[0].endRangeRatioCondition, 3);
    assert.strictEqual(cfg.distanziamento[0].percDistFoto[1].endRangeRatioCondition, Infinity);
});

test("il distanziamento di un box non cambia quello di default del Plugin", () => {
    const prima = JSON.stringify(SistemazioneFoto.calcoloDistanziamentoFoto);
    SistemazioneFoto.risolviConfigurazione([{ fixFoto: { distanziamento: [{ foto: 1, percDistFoto: [] }] } }]);
    assert.strictEqual(JSON.stringify(SistemazioneFoto.calcoloDistanziamentoFoto), prima);
});

/* ---- quali voci: contesto, regole scaricate, sezione generale ---- */

test("all'impaginazione, con il contesto dello stesso box, valgono le voci del contesto", () => {
    conRegole("Coopfi", null);
    CssFramework.contestoCss = {
        etichettaBox: "BOX_LINEA",
        DBallineamenti: [{ nomiBox: ["BOX_LINEA"], fixFoto: { marginiFoto: [3, 3] } }],
        DBDefault: null
    };

    assert.deepStrictEqual(configurazione("BOX_LINEA").marginiFoto, [3, 3]);
    //Il resto viene dalla sezione generale delle regole scaricate.
    assert.deepStrictEqual(configurazione("BOX_LINEA").lavorazioni, [1, 2]);
    //Il contesto di un altro box non vale.
    assert.deepStrictEqual(configurazione("BOX_JOLLY").marginiFoto, [0, 0]);
});

test("una voce del kit sostituisce il valore della sezione generale", () => {
    const regole = regoleDi("Coopfi");
    regole.modificheCssPerKit[0].operazioniPerBox.find(v => v.nomiBox.length === 0).fixFoto = { lavorazioni: [1] };
    CssFramework.regoleScaricate = regole;
    CssFramework.contestoCss = null;
    lavorazione = { area: "Z", canale: "C", tipo: 1, formato: "F" };

    assert.deepStrictEqual(configurazione("BOX_STD").lavorazioni, [1]);
    assert.deepStrictEqual(configurazione("BOX_STD").elementiIgnorati, ["sconto", "txt_sconto", "sconto_base", "sfondo"]);
});

test("il Fix foto prima di ogni impaginazione, senza contesto ne' lavorazione, usa la sezione generale", () => {
    conRegole("Edro21", null);

    assert.ok(configurazione("BOX1").eccezioniIgnorati.includes("*LOGO_filiera*"));
    assert.deepStrictEqual(configurazione("BOX1").marginiFoto, [1, 1]);
    assert.strictEqual(configurazione("BOX40").modo, "nessuno");
});

test("se il kit non si trova vale comunque la sezione generale", () => {
    conRegole("Edro21", null);
    const vero = global.ficoProcess;
    global.ficoProcess = { getAreaLavorazioneCorrente: () => { throw new Error("nessuna lavorazione"); } };
    const errori = console.error;
    console.error = () => {};
    try {
        assert.deepStrictEqual(configurazione("BOX1").marginiFoto, [1, 1]);
    }
    finally {
        global.ficoProcess = vero;
        console.error = errori;
    }
});

test("senza regole scaricate e senza copia valgono i default del Plugin", () => {
    CssFramework.regoleScaricate = null;
    CssFramework.contestoCss = null;

    const cfg = configurazione("BOX1");

    assert.deepStrictEqual(cfg.marginiFoto, [0, 0]);
    assert.deepStrictEqual(cfg.eccezioniIgnorati, []);
});

/* ---- i dati che stavano nei custom.js ---- */

//Il distanziamento come lo scriveva il custom.js di Coop.fi, copiato da Famila.
const DISTANZIAMENTO_COOP = [
    { foto: 1, percDistFoto: [{ percDistanceXFoto: [], percDistanceYFoto: [], startRangeRatioCondition: 0, endRangeRatioCondition: Infinity }] },
    { foto: 2, percDistFoto: [{ percDistanceXFoto: [0.5], percDistanceYFoto: [-0.25], startRangeRatioCondition: 0, endRangeRatioCondition: Infinity }] },
    { foto: 3, percDistFoto: [{ percDistanceXFoto: [0.5, -1.05], percDistanceYFoto: [-0.3, 0], startRangeRatioCondition: 0, endRangeRatioCondition: Infinity }] }
];

const DISTANZIAMENTO_EDRO = [
    { foto: 1, percDistFoto: [{ percDistanceXFoto: [], percDistanceYFoto: [], startRangeRatioCondition: 0, endRangeRatioCondition: Infinity }] },
    { foto: 2, percDistFoto: [
        { percDistanceXFoto: [0.5], percDistanceYFoto: [-0.25], startRangeRatioCondition: 0, endRangeRatioCondition: 3 },
        { percDistanceXFoto: [0.55], percDistanceYFoto: [-0.05], startRangeRatioCondition: 3, endRangeRatioCondition: Infinity }
    ] },
    { foto: 3, percDistFoto: [
        { percDistanceXFoto: [0.3, -0.3], percDistanceYFoto: [-0.5, -0.5], startRangeRatioCondition: 0, endRangeRatioCondition: 0.4 },
        { percDistanceXFoto: [0.5, -1.05], percDistanceYFoto: [-0.3, 0], startRangeRatioCondition: 0.4, endRangeRatioCondition: 1.5 },
        { percDistanceXFoto: [0.4, -0.6], percDistanceYFoto: [-0.1, -0.1], startRangeRatioCondition: 1.5, endRangeRatioCondition: Infinity }
    ] }
];

for (const cliente of ["Coopfi", "Famila"]) {
    test(cliente + ": fix in volantino e PoP, con il distanziamento e gli elementi ignorati di prima", () => {
        const lavorazioni = cliente === "Coopfi"
            ? [{ area: "A", canale: "C", tipo: 1, formato: "F" }, { area: "B", canale: "C", tipo: 1, formato: "F" }, { area: "A-", canale: "C", tipo: 1, formato: "F" },
                { area: "A", canale: "C", tipo: 2, formato: "A7" }, { area: "A", canale: "C", tipo: 2, formato: "A3" }]
            : [{ area: "X", canale: "FAMS", tipo: 1, formato: "F" }, { area: "X", canale: "ALTRO", tipo: 1, formato: "F" }, { area: "X", canale: "ALTRO", tipo: 2, formato: "F" }];
        for (const lav of lavorazioni) {
            conRegole(cliente, lav);
            const cfg = configurazione("BOX_STD");
            const dove = JSON.stringify(lav);

            assert.deepStrictEqual(cfg.distanziamento, DISTANZIAMENTO_COOP, dove);
            assert.deepStrictEqual(cfg.elementiIgnorati, ["sconto", "txt_sconto", "sconto_base", "sfondo"], dove);
            assert.deepStrictEqual(cfg.eccezioniIgnorati, [], dove);
            assert.deepStrictEqual(cfg.marginiFoto, [0, 0], dove);
            assert.strictEqual(cfg.marginiBox, null, dove);
            //Senza un fix dell'agenzia: quello del Plugin, in volantino e PoP.
            assert.strictEqual(decisione(cfg, lav.tipo, false), "plugin", dove);
        }
    });
}

test("Edro21: in ogni canale, anche senza kit, il fix ha gli ostacoli, i margini e il distanziamento di prima", () => {
    for (const canale of ["SC", "SS", "CN", "CY", "SeD", "Fid", "PT"]) {
        conRegole("Edro21", { area: "EM", canale, tipo: 1, formato: "F" });
        const cfg = configurazione("BOX1");

        assert.deepStrictEqual(cfg.distanziamento, DISTANZIAMENTO_EDRO, canale);
        assert.deepStrictEqual(cfg.elementiIgnorati, ["*fondo*", "*soggetto_IT*", "parentesi_BeF", "sy_ombra"], canale);
        assert.strictEqual(cfg.eccezioniIgnorati.length, 22, canale);
        for (const logo of ["*cpq*", "*LOGO_filiera*", "*conad_armomia*", "*Parmigiano_caratteristiche*"]) {
            assert.ok(cfg.eccezioniIgnorati.includes(logo), canale + " " + logo);
        }
        assert.deepStrictEqual(cfg.marginiElementi.map(m => m.label), ["campo_offerta_KgL_sconto", "prezzo_offerta_gruppo", "descrizione"], canale);
        assert.deepStrictEqual(cfg.marginiBox, [0, 0, 0, 0], canale);
        assert.deepStrictEqual(cfg.marginiFoto, [1, 1], canale);
        assert.deepStrictEqual(cfg.agenzia.descrizioneAllineataA,
            ["sy_euro", "sy_-", "sy_%", "sconto_fid", "prezzo_offerta", "campo_offerta_KgL_sconto", "campo_offerta", "prezzo_offerta_etto", "rect_etto", "LBL_Titolari"], canale);
        assert.deepStrictEqual(cfg.agenzia.elementiSottoDescrizione, ["PIEDE_Titolari*"], canale);
        assert.deepStrictEqual(cfg.agenzia.elementiCheBloccanoDescrizione, ["*LOGO_carneS_USOdiANTIBIOTICI*"], canale);
    }
});

test("Edro21: il BOX40 senza fix, BOX14, BOX11 e BOX41 con quello del Plugin, gli altri con quello di Edro21, e il PoP senza fix", () => {
    for (const canale of ["SC", "SS", "SeD"]) {
        conRegole("Edro21", { area: "EM", canale, tipo: 1, formato: "F" });
        assert.strictEqual(decisione(configurazione("BOX40"), 1, true), "nessuno", canale);
        for (const box of ["BOX14", "BOX11", "BOX41"]) {
            assert.strictEqual(decisione(configurazione(box), 1, true), "plugin", canale + " " + box);
        }
        for (const box of ["BOX1", "BOX6", "BOX7", "BOX4", "BOX12"]) {
            assert.strictEqual(decisione(configurazione(box), 1, true), "agenzia", canale + " " + box);
        }
    }
    conRegole("Edro21", { area: "EM", canale: "SC", tipo: 2, formato: "F" });
    assert.strictEqual(decisione(configurazione("BOX1_PoP"), 2, true), "nessuno");
});

test("Edro21: il gruppo della descrizione nel BOX7 e nel BOX4, e nel BOX7 la descrizione non si sposta da sola", () => {
    conRegole("Edro21", { area: "EM", canale: "SC", tipo: 1, formato: "F" });

    assert.deepStrictEqual(configurazione("BOX7").agenzia.gruppoDescrizione, "gruppo_descrizione_BIS");
    assert.strictEqual(configurazione("BOX7").agenzia.spostaDescrizioneSenzaGruppo, false);
    assert.deepStrictEqual(configurazione("BOX4").agenzia.gruppoDescrizione, "gruppo_descrizione_sottocosto");
    assert.strictEqual(configurazione("BOX4").agenzia.spostaDescrizioneSenzaGruppo, undefined);
    assert.strictEqual(configurazione("BOX1").agenzia.gruppoDescrizione, undefined);
});

/* ---- i margini della foto al piazzamento ---- */

test("al piazzamento la foto prende i margini del fix del suo box, il gruppo piu' esterno", () => {
    conRegole("Edro21", { area: "EM", canale: "SC", tipo: 1, formato: "F" });
    const pagina = { constructorName: "Page" };
    const box = { constructorName: "Group", label: "BOX1", parent: pagina };
    const sottogruppo = { constructorName: "Group", label: "gruppo_foto", parent: box };

    assert.deepStrictEqual(FotoPlacer.marginiDellaFoto({ parent: sottogruppo }), [1, 1]);
    assert.deepStrictEqual(FotoPlacer.marginiDellaFoto({ parent: pagina }), [1, 1]);

    //Margini zero: niente da togliere e rimettere, come quando il custom.js non li diceva.
    conRegole("Coopfi", { area: "A", canale: "C", tipo: 1, formato: "F" });
    assert.strictEqual(FotoPlacer.marginiDellaFoto({ parent: box }), null);
});

/* ---- nessuno li legge piu' dai custom.js ---- */

const CHIAVI_SPOSTATE = ["fixFotoLavorazioni", "calcoloDistanziamentoFoto", "ignoreElementsFixFoto",
    "exceptionElementsToIgnoreFixFoto", "customPadding", "paddingBox", "paddingFoto"];

test("i custom.js delle agenzie non contengono piu' i dati del fix foto", () => {
    for (const cliente of ["Coopfi", "Edro21", "Famila"]) {
        const custom = senzaCommenti(fs.readFileSync(path.join(RADICE, "plugin", "Agenzie", cliente, "custom.js"), "utf8"));
        for (const chiave of CHIAVI_SPOSTATE) {
            assert.doesNotMatch(custom, new RegExp("\\b" + chiave + "\\b"), cliente + ": " + chiave);
        }
    }
});

//Il corpo di un membro dell'oggetto customAgenzia, isolato contando le graffe.
function corpoFunzione(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata: il test va aggiornato");
    let livello = 0;
    for (let i = testo.indexOf("{", inizio); i < testo.length; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}" && --livello === 0) { return testo.substring(inizio, i + 1); }
    }
    assert.fail("corpo di " + intestazione + " non delimitato");
}

test("il fix foto di Edro21 non scrive piu' nel codice box, gruppi ed elementi: li legge dalla configurazione", () => {
    const custom = senzaCommenti(fs.readFileSync(path.join(RADICE, "plugin", "Agenzie", "Edro21", "custom.js"), "utf8"));
    const fix = ["setCustomFixFoto(box){", "gruppoDellaDescrizione(gruppo, etichette) {", "descrizioneTraLoghi(box, descrizione) {"]
        .map(intestazione => corpoFunzione(custom, intestazione)).join("\n");

    assert.doesNotMatch(fix, /"BOX\d+"|"gruppo_descrizione_|"PIEDE_Titolari"|LOGO_carneS_USOdiANTIBIOTICI|"LBL_Titolari"|"sy_euro"|getTipoLavorazioneCorrente/);
    assert.match(fix, /var datiFix = CssFramework\.getConfigurazioneFixFoto\(box\)\.agenzia;/);
    assert.match(fix, /CssFramework\.getConfigurazioneFixFoto\(box\)\.eccezioniIgnorati/);
});

test("il core non legge piu' i dati del fix foto da customAgenzia", () => {
    for (const file of ["sistemazioneFoto/sistemazioneFoto.js", "reperimentoFoto/fotoPlacer.js", "indexNew.js", "reperimentoFoto/reperimentoFoto.js"]) {
        const sorgente = senzaCommenti(leggiFileDelPlugin(file));
        for (const chiave of CHIAVI_SPOSTATE) {
            assert.doesNotMatch(sorgente, new RegExp("customAgenzia\\." + chiave + "\\b"), file + ": " + chiave);
        }
    }
});

test("all'impaginazione lavorazioni e modo del box decidono se e quale fix fare", () => {
    //TASK-99de57d1: la decisione sta in SistemazioneFoto.sistemaFotoAllImpaginazione (provata in
    //fotoATuttoBox.test.js); i due punti dell'impaginazione le passano la referenza e il fix dell'agenzia.
    const indexNew = senzaCommenti(leggiFileDelPlugin("indexNew.js"));
    assert.match(indexNew, /boxImpaginato = SistemazioneFoto\.sistemaFotoAllImpaginazione\(boxImpaginato, itemRef, tipoLavorazione, fixFotoDellAgenzia\(\)\);/);
    const reperimento = senzaCommenti(leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js"));
    assert.match(reperimento, /var referenzaFixFoto = await referenzaDelBox\(boxImpaginato\);\s*boxImpaginato = SistemazioneFoto\.sistemaFotoAllImpaginazione\(boxImpaginato, referenzaFixFoto,\s*ficoProcess\.getTipoLavorazioneCorrente\(\), fixFotoDellAgenzia\(\)\);/);
    assert.match(indexNew, /return customAgenzia\.setCustomFixFoto != null \? function \(box\) \{ return customAgenzia\.setCustomFixFoto\(box\); \} : null;/);
});
