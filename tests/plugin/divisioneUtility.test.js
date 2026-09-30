/*
 * I20-1012: utility.js e' stato diviso. Qui si prova che la divisione tiene.
 *
 * Ne sono uscite quattro famiglie, ciascuna con un oggetto suo che indexNew.js dichiara come
 * globale: Modali (modali/modali.js, con le conferme di eliminazione di modali/eliminazione.js
 * mescolate dentro), Tooltip (tooltip/tooltip.js, con posizione.js accanto), Menu (menu.js) e
 * TestoTag (testoTag.js). In Utility resta quello che le agenzie chiamano per nome.
 *
 * utility.js fa require('indesign') e sotto Node non si carica; i quattro oggetti nuovi si'.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const CARTELLA_PLUGIN = path.join(__dirname, "..", "..", "plugin");

const USCITI = {
    Modali: ["isElementVisible", "nascondiHidebleElements", "mostraHidebleElements", "confirm",
        "closeAllModal", "popup", "confirmCustom", "apriModal", "apriModalCustom", "chiudiModalCustom",
        "chiudiModal", "confirmRimozioneRef", "PAROLA_ELIMINAZIONE", "parolaEliminazioneCorretta",
        "riepilogoEliminazione", "confirmParolaEliminazione", "confirmRimozioneRefNonTrovata"],
    Tooltip: ["_tooltipGlobaliAttivi", "_riquadroTooltip", "_timerTooltip", "_ancoraTooltip",
        "RITARDO_TOOLTIP", "ATTRIBUTO_TOOLTIP", "LARGHEZZA_TOOLTIP", "abilitaTooltipGlobali",
        "_testoDelTooltip", "impostaTooltip", "nascondiTooltip", "_mostraTooltip",
        "_creaRiquadroTooltip", "_dimensioniPannello"],
    Menu: ["creaFloatingMenu", "chiudiFloatingMenu", "registerDateMenuPicker", "setPickerValue",
        "setPickerWidthHack"],
    TestoTag: ["parseContent", "componiStringTagFromInndTextFrame", "applicaTagStringToInndTextFrame",
        "getDefaultOverflowDirection", "applyNeastedStyles", "trattiDiStileDelCampo", "trimDescrizione",
        "parseStile", "parseObjStile"]
};
const FILE = {
    Modali: "modali/modali.js",
    Tooltip: "tooltip/tooltip.js",
    Menu: "menu.js",
    TestoTag: "testoTag.js"
};

function carica(nome) {
    return require(path.join(CARTELLA_PLUGIN, FILE[nome]));
}

//Il sorgente senza commenti, di riga e a blocco.
function senzaCommenti(testo) {
    return testo.replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

//I membri di primo livello di un file fatto come oggetto: quattro spazi di rientro.
function membriDelFile(testo) {
    const membri = new Set();
    for (const riga of testo.replace(/\r/g, "").split("\n")) {
        const m = riga.match(/^ {4}(?:async\s+)?([a-zA-Z_$][\w$]*)\s*[:(]/);
        if (m) {
            membri.add(m[1]);
        }
    }
    return membri;
}

//Tutti i file che possono chiamare Utility: il core, index.html e le agenzie.
function fileChiamanti() {
    const agenzie = fs.readdirSync(path.join(CARTELLA_PLUGIN, "Agenzie"))
        .map(nome => "Agenzie/" + nome + "/custom.js")
        .filter(relativo => fs.existsSync(path.join(CARTELLA_PLUGIN, relativo)));
    return fileDelPlugin().concat(["index.html"], agenzie);
}

/* ---- gli oggetti ---- */

test("i quattro oggetti hanno i membri usciti, e utility.js non li definisce piu'", () => {
    const utility = membriDelFile(leggiFileDelPlugin("utility.js"));

    for (const [nome, membri] of Object.entries(USCITI)) {
        const oggetto = carica(nome);
        for (const membro of membri) {
            assert.ok(membro in oggetto, nome + "." + membro);
            assert.ok(!utility.has(membro), membro + " e' ancora in utility.js");
        }
    }
});

test("utility.js tiene i membri che usano le agenzie", () => {
    const utility = membriDelFile(leggiFileDelPlugin("utility.js"));

    for (const nome of ["parseLabel", "getFieldByLabel", "setCampoDNA", "getDnaOfBox",
        "cercaChiaveContesto", "applyObjectStyle", "sleep"]) {
        assert.ok(utility.has(nome), nome);
    }
});

//Due file, un oggetto: le conferme di eliminazione sono Modali.X come le altre.
test("Modali mescola le conferme di eliminazione: stesse funzioni, stesso oggetto", () => {
    const Modali = carica("Modali");
    const eliminazione = require(path.join(CARTELLA_PLUGIN, "modali", "eliminazione.js"));

    assert.ok(Object.keys(eliminazione).length >= 6);
    for (const nome of Object.keys(eliminazione)) {
        assert.strictEqual(Modali[nome], eliminazione[nome], nome);
    }
    assert.deepStrictEqual(Object.keys(eliminazione).filter(n => membriDelFile(leggiFileDelPlugin("modali/modali.js")).has(n)), []);
});

//In eliminazione.js il nome Modali non c'e': una chiamata Modali.X li' dentro funzionerebbe in
//UXP per caso, grazie alla globale di indexNew, e sotto Node si romperebbe. E' la trappola di
//I20-1015, con schedaRef dentro schedaFoto.js.
test("eliminazione.js non chiama Modali per nome: passa da modali()", () => {
    const testo = senzaCommenti(leggiFileDelPlugin("modali/eliminazione.js"));

    assert.doesNotMatch(testo, /(?<![\w.$])(Modali|Utility)\./);
    assert.match(testo, /function modali\(\) \{ return require\('\.\/modali'\); \}/);
});

test("i quattro file si caricano sotto Node, senza require('indesign') in testa", () => {
    for (const relativo of [...Object.values(FILE), "modali/eliminazione.js", "tooltip/posizione.js"]) {
        const testa = senzaCommenti(leggiFileDelPlugin(relativo)).split("\n")
            .filter(riga => /^\S/.test(riga)).join("\n");
        assert.doesNotMatch(testa, /^(const|let|var)\b.*require\(['"]indesign['"]\)/m, relativo);
    }
    //testoTag.js le costanti di InDesign le chiede al momento, dentro le due funzioni che le usano.
    const testoTag = senzaCommenti(leggiFileDelPlugin("testoTag.js"));
    assert.match(testoTag, /function indesign\(\) \{ return require\('indesign'\); \}/);
    assert.match(testoTag, /const \{ FitOptions \} = indesign\(\);/);
    assert.match(testoTag, /const \{ NestedStyleDelimiters \} = indesign\(\);/);
});

test("indexNew dichiara i quattro oggetti come globali, subito dopo Utility", () => {
    const indexNew = senzaCommenti(leggiFileDelPlugin("indexNew.js"));

    assert.match(indexNew, /const \{Utility, FotoPlacer\} = require\('\.\/utility'\);\s*const Modali = require\('\.\/modali\/modali'\);\s*const Tooltip = require\('\.\/tooltip\/tooltip'\);\s*const Menu = require\('\.\/menu'\);\s*const TestoTag = require\('\.\/testoTag'\);/);
});

/* ---- i chiamanti ---- */

//Anche passato come valore, senza parentesi: e' la lezione di I20-1015.
test("nessun file chiama piu' come Utility.X un membro uscito", () => {
    const usciti = Object.values(USCITI).flat();
    const trovate = [];

    for (const relativo of fileChiamanti()) {
        for (const riga of senzaCommenti(leggiFileDelPlugin(relativo)).split("\n")) {
            for (const m of riga.matchAll(/\bUtility\.([A-Za-z_$][\w$]*)/g)) {
                if (usciti.includes(m[1])) {
                    trovate.push(relativo + ": " + riga.trim());
                }
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

//Il controllo che manca a una rinomina fatta a mano: ogni nome davanti al punto esiste davvero
//nell'oggetto. Vale per le agenzie, che chiamano Utility.X per nome.
test("ogni Modali.X, Tooltip.X, Menu.X, TestoTag.X e Utility.X del Plugin esiste", () => {
    const oggetti = {
        Modali: carica("Modali"),
        Tooltip: carica("Tooltip"),
        Menu: carica("Menu"),
        TestoTag: carica("TestoTag"),
        Utility: Object.fromEntries([...membriDelFile(leggiFileDelPlugin("utility.js"))].map(n => [n, true]))
    };
    const mancanti = [];

    for (const relativo of fileChiamanti()) {
        for (const riga of senzaCommenti(leggiFileDelPlugin(relativo)).split("\n")) {
            for (const m of riga.matchAll(/(?<![\w.$])(Modali|Tooltip|Menu|TestoTag|Utility)\.([A-Za-z_$][\w$]*)/g)) {
                if (!(m[2] in oggetti[m[1]])) {
                    mancanti.push(relativo + ": " + m[0]);
                }
            }
        }
    }
    assert.deepStrictEqual(mancanti, []);
});

//Dentro un oggetto uscito, this e me sono l'oggetto stesso: un membro rimasto in Utility li'
//non c'e' piu'.
test("dentro i quattro file, this.X e me.X sono membri dello stesso oggetto", () => {
    const utility = membriDelFile(leggiFileDelPlugin("utility.js"));
    const trovate = [];

    for (const [nome, relativo] of [...Object.entries(FILE), ["Modali", "modali/eliminazione.js"]]) {
        const oggetto = carica(nome);
        for (const m of senzaCommenti(leggiFileDelPlugin(relativo)).matchAll(/\b(?:this|me|modali\(\))\.([A-Za-z_$][\w$]*)/g)) {
            if (utility.has(m[1]) && !(m[1] in oggetto)) {
                trovate.push(relativo + ": " + m[0]);
            }
        }
    }
    assert.deepStrictEqual(trovate, []);
});

/* ---- i comportamenti che ora si possono provare ---- */

test("TestoTag.trimDescrizione toglie spazi e a capo, anche in mezzo", () => {
    const TestoTag = carica("TestoTag");

    assert.strictEqual(TestoTag.trimDescrizione("  Pasta di\r\n semola  "), "Pastadisemola");
    assert.strictEqual(TestoTag.trimDescrizione("abc"), "abc");
});

//I20-1012: prima scriveva nel log una riga per ogni carattere del testo.
test("TestoTag.parseContent scompone il testo nei suoi tag, senza scrivere nel log", () => {
    const TestoTag = carica("TestoTag");
    const prima = { Utility: global.Utility, log: console.log };
    const scritte = [];
    global.Utility = { replaceAllSpecialCharacters: testo => testo };
    console.log = (...parti) => { scritte.push(parti.join(" ")); };

    try {
        assert.deepStrictEqual(TestoTag.parseContent("senza tag"), [{ stile: "", content: "senza tag" }]);
        assert.deepStrictEqual(TestoTag.parseContent("<A>ciao</A>\n<B>mondo</B>"), [
            { stile: "A", content: "ciao\n" },
            { stile: "B", content: "mondo" }
        ]);
        assert.deepStrictEqual(TestoTag.parseContent("<A>ciao"), [{ stile: "A", content: "No found end of tag A" }]);
        assert.deepStrictEqual(scritte, []);
    }
    finally {
        global.Utility = prima.Utility;
        console.log = prima.log;
    }
});

//Un elemento finto con gli attributi, come quelli di UXP.
function elementoFinto(attributi = {}) {
    const valori = { ...attributi };
    return {
        valori,
        getAttribute: nome => (nome in valori ? valori[nome] : null),
        setAttribute: (nome, valore) => { valori[nome] = String(valore); },
        removeAttribute: nome => { delete valori[nome]; }
    };
}

test("Tooltip.impostaTooltip scrive l'attributo e toglie il title", () => {
    const Tooltip = carica("Tooltip");
    const elemento = elementoFinto({ title: "vecchio" });

    Tooltip.impostaTooltip(elemento, "  Scegli cartella  ");
    assert.deepStrictEqual(elemento.valori, { "data-tooltip": "Scegli cartella" });

    Tooltip.impostaTooltip(elemento, "   ");
    assert.deepStrictEqual(elemento.valori, {});

    //Un elemento che non c'e' non si rompe.
    Tooltip.impostaTooltip(null, "testo");
});

test("Tooltip._testoDelTooltip trasloca il title sull'attributo nostro", () => {
    const Tooltip = carica("Tooltip");
    const elemento = elementoFinto({ title: "Salva" });

    assert.strictEqual(Tooltip._testoDelTooltip(elemento), "Salva");
    assert.deepStrictEqual(elemento.valori, { "data-tooltip": "Salva" });
    assert.strictEqual(Tooltip._testoDelTooltip(elemento), "Salva");
});

test("Tooltip.nascondiTooltip ferma il timer e nasconde il riquadro", () => {
    const Tooltip = carica("Tooltip");
    let partito = false;
    const riquadro = { style: { display: "block", visibility: "visible" } };

    Tooltip._timerTooltip = setTimeout(() => { partito = true; }, 5);
    Tooltip._riquadroTooltip = riquadro;
    Tooltip.nascondiTooltip();

    assert.strictEqual(Tooltip._timerTooltip, null);
    assert.deepStrictEqual(riquadro.style, { display: "none", visibility: "hidden" });
    Tooltip._riquadroTooltip = null;

    return new Promise(fatto => setTimeout(() => {
        assert.strictEqual(partito, false);
        fatto();
    }, 20));
});

//Un documento finto con un gruppo di stili, come lo vede parseStile.
function documentoFinto() {
    const stile = nome => ({ name: nome });
    const gruppo = (nome, chiave) => ({ name: nome, [chiave]: { item: stile } });
    return {
        paragraphStyles: { item: stile },
        characterStyles: { item: stile },
        objectStyles: { item: stile },
        paragraphStyleGroups: { length: 1, item: () => gruppo("A", "paragraphStyles") },
        characterStyleGroups: { length: 1, item: () => gruppo("A", "characterStyles") },
        objectStyleGroups: { length: 1, item: () => gruppo("A", "objectStyles") }
    };
}

//I20-1012: stileSplitted era scritta senza dichiararla, e finiva fra le globali del Plugin.
test("TestoTag.parseStile e parseObjStile trovano lo stile, e non lasciano globali", () => {
    const TestoTag = carica("TestoTag");
    const prima = global.docInLavorazione;
    global.docInLavorazione = documentoFinto();

    try {
        assert.deepStrictEqual(TestoTag.parseStile("Prezzo"), { name: "Prezzo" });
        assert.deepStrictEqual(TestoTag.parseStile("A.Prezzo", true), { name: "Prezzo" });
        assert.strictEqual(TestoTag.parseStile("B.Prezzo"), null);
        assert.deepStrictEqual(TestoTag.parseObjStile("A.Cornice"), { name: "Cornice" });
        assert.ok(!("stileSplitted" in global));
    }
    finally {
        global.docInLavorazione = prima;
    }
});

/* ---- quello che e' andato altrove ---- */

//Traduce gli operatori dei filtri in parole, e la usa solo refreshNarrow.
test("getLetturaFacilitataDellaParola sta in filtri.js, e la chiama filtri.X", () => {
    assert.ok(!membriDelFile(leggiFileDelPlugin("utility.js")).has("getLetturaFacilitataDellaParola"));

    const filtri = senzaCommenti(leggiFileDelPlugin("filtri.js"));
    assert.match(filtri, /^ {4}getLetturaFacilitataDellaParola\(parola\)$/m);
    assert.strictEqual((filtri.match(/filtri\.getLetturaFacilitataDellaParola\(operatore\)/g) || []).length, 2);
    assert.doesNotMatch(filtri, /Utility\.getLetturaFacilitataDellaParola/);
});
