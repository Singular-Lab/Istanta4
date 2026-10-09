/*
 * I20-1079: le bruciature della descrizione, solo per Coop.
 *
 * Coop accoda alla descrizione la bruciatura "MAX 4 PEZZI PER CARTA SOCIO", con uno stile suo
 * (MAX_PEZZI e varianti), e le azioni sul box la aggiungono o la tolgono. Non e' descrizione: il
 * Plugin la confrontava con la descrizione del server e segnalava una differenza che non c'era, e
 * "Scegli quella del box" la mandava al server come descrizione. Ora gli stili delle bruciature li
 * dichiara la configurazione del cliente (stiliBruciaturaDescrizione), il confronto e il salvataggio
 * della descrizione li lasciano fuori, e chi non li dichiara (Edro21) resta com'era.
 *
 * confronti.js e InputEditController.js si caricano sotto Node; InDesign, jQuery e la
 * configurazione si fingono.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const confronti = require("../../plugin/confronti.js");
const InputEditController = require("../../plugin/InputEditController.js");

const COOP = ["MAX_PEZZI"];

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    const ripristina = () => Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    let esito;
    try {
        esito = prova();
    }
    catch (e) {
        ripristina();
        throw e;
    }
    if (esito != null && typeof esito.then === "function") {
        return esito.finally(ripristina);
    }
    ripristina();
    return esito;
}

function middleware(stili) {
    return { getCampo: () => null, getStiliBruciaturaDescrizione: () => stili };
}

/* ---- le regole ---- */

test("uno stile di bruciatura e' uno che comincia con quelli dichiarati, e senza dichiarati non ce ne sono", () => {
    ["MAX_PEZZI", "MAX_PEZZI_SOCI_DOPPIA", "MAX_PEZZI_SPENDIPUNTI", "MAX_PEZZI_ESCLUSIVA_SOCI", "MAX_PEZZI_LINEA"]
        .forEach(stile => assert.strictEqual(confronti.eStileBruciatura(stile, COOP), true, stile));
    assert.strictEqual(confronti.eStileBruciatura("DESCRIZIONE_TIPO", COOP), false);
    assert.strictEqual(confronti.eStileBruciatura("", COOP), false);
    assert.strictEqual(confronti.eStileBruciatura("MAX_PEZZI", []), false);
    assert.strictEqual(confronti.eStileBruciatura("MAX_PEZZI", null), false);
});

test("il contenuto del server perde i blocchi di bruciatura, e solo quelli", () => {
    const server = "<DESCRIZIONE_TITOLO>INSALATA DI MARE</DESCRIZIONE_TITOLO><DESCRIZIONE_GRAMMATURA> 300 g - in olio</DESCRIZIONE_GRAMMATURA>"
        + "<MAX_PEZZI_SOCI_DOPPIA>\nMAX 4 PEZZI PER CARTA SOCIO</MAX_PEZZI_SOCI_DOPPIA>";
    assert.strictEqual(confronti.senzaBruciature(server, COOP),
        "<DESCRIZIONE_TITOLO>INSALATA DI MARE</DESCRIZIONE_TITOLO><DESCRIZIONE_GRAMMATURA> 300 g - in olio</DESCRIZIONE_GRAMMATURA>");
    assert.strictEqual(confronti.senzaBruciature(server, []), server);
    assert.strictEqual(confronti.senzaBruciature(null, COOP), null);
});

test("i tratti del box perdono quelli di bruciatura", () => {
    const tratti = [{ nome: "DESCRIZIONE_TITOLO", contenuto: "A" }, { nome: "MAX_PEZZI", contenuto: "B" }];
    assert.deepStrictEqual(confronti.trattiSenzaBruciature(tratti, COOP).map(t => t.nome), ["DESCRIZIONE_TITOLO"]);
    assert.strictEqual(confronti.trattiSenzaBruciature(tratti, []), tratti);
});

test("le bruciature valgono per la descrizione e per chi le dichiara", () => conGlobali({ pluginMiddleware: middleware(COOP) }, () => {
    assert.deepStrictEqual(confronti.stiliBruciaturaDelCampo("descrizione"), COOP);
    assert.deepStrictEqual(confronti.stiliBruciaturaDelCampo("Descrizione$X"), COOP);
    assert.deepStrictEqual(confronti.stiliBruciaturaDelCampo("txt_sconto"), []);
    global.pluginMiddleware = middleware([]);
    assert.deepStrictEqual(confronti.stiliBruciaturaDelCampo("descrizione"), []);
    delete global.pluginMiddleware;
    assert.deepStrictEqual(confronti.stiliBruciaturaDelCampo("descrizione"), []);
}));

/* ---- la preanalisi ---- */

const SERVER = "<DESCRIZIONE_TITOLO>INSALATA DI MARE</DESCRIZIONE_TITOLO><DESCRIZIONE_GRAMMATURA> 300 g - in olio</DESCRIZIONE_GRAMMATURA>";

//Il box della ref 4860195: la descrizione e, a capo, la bruciatura con il suo stile.
function boxConDescrizione(tratti) {
    return {
        allPageItems: [{
            isValid: true,
            label: "descrizione",
            constructorName: "TextFrame",
            contents: tratti.map(t => t.contenuto).join(""),
            tratti: tratti
        }]
    };
}

const CON_BRUCIATURA = [
    { nome: "DESCRIZIONE_TITOLO", contenuto: "INSALATA DI MARE" },
    { nome: "DESCRIZIONE_GRAMMATURA", contenuto: " 300 g - in olio\n" },
    { nome: "MAX_PEZZI", contenuto: "MAX 4 PEZZI PER CARTA SOCIO" }
];

function preanalisi(stili, tratti, contenutoServer) {
    return conGlobali({
        pluginMiddleware: middleware(stili),
        TestoTag: { trattiDiStileDelCampo: (campo) => campo.tratti, parseStile: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => confronti.confrontoBoxCompiledFieldPreAnalisi(boxConDescrizione(tratti),
        [{ labelName: "descrizione", paragraphName: "", content: contenutoServer }], [], [], null, null, false));
}

test("Coop: la bruciatura nel box non fa differenza con la descrizione del server", async () => {
    const esito = await preanalisi(COOP, CON_BRUCIATURA, SERVER);
    assert.deepStrictEqual(esito.errors, []);
    assert.deepStrictEqual(esito.differenze, []);
});

test("Coop: nemmeno la bruciatura che c'e' solo sul server", async () => {
    const tratti = CON_BRUCIATURA.slice(0, 2);
    const esito = await preanalisi(COOP, tratti, SERVER + "<MAX_PEZZI>\nMAX 2 PEZZI PER CARTA SOCIO</MAX_PEZZI>");
    assert.deepStrictEqual(esito.differenze, []);
});

test("Coop: una descrizione davvero diversa si segnala, con i valori senza la bruciatura", async () => {
    const tratti = [{ nome: "DESCRIZIONE_TITOLO", contenuto: "INSALATA DI MARE" }, { nome: "DESCRIZIONE_GRAMMATURA", contenuto: " 250 g\n" }, CON_BRUCIATURA[2]];
    const esito = await preanalisi(COOP, tratti, SERVER);
    assert.strictEqual(esito.differenze.length, 1);
    assert.strictEqual(esito.differenze[0].difference, "contenuto");
    assert.strictEqual(esito.differenze[0].valoreLocale, "INSALATA DI MARE 250 g");
    assert.strictEqual(esito.differenze[0].valoreServer, "INSALATA DI MARE 300 g - in olio");
});

test("Edro21 e chi non dichiara bruciature: la descrizione si confronta tutta, come prima", async () => {
    const esito = await preanalisi([], CON_BRUCIATURA, SERVER);
    assert.strictEqual(esito.differenze.length, 1);
    assert.match(esito.differenze[0].valoreLocale, /MAX 4 PEZZI PER CARTA SOCIO$/);
});

/* ---- il salvataggio della descrizione ---- */

//I tre campi della descrizione del pannello, come li legge jQuery.
const CAMPI_PANNELLO = [
    { stile: "DESCRIZIONE_TITOLO", testo: "INSALATA DI MARE" },
    { stile: "DESCRIZIONE_GRAMMATURA", testo: " 300 g - in olio" },
    { stile: "MAX_PEZZI", testo: "\nMAX 4 PEZZI PER CARTA SOCIO" }
];

function operazioniDiSalvataggio(stili) {
    const universali = {
        DESCRIZIONE_TITOLO: { nome: "DESCRIZIONE_TITOLO", fondamentale: "descrizione1" },
        DESCRIZIONE_GRAMMATURA: { nome: "DESCRIZIONE_GRAMMATURA", fondamentale: "descrizione4" }
    };
    return conGlobali({
        confronti: confronti,
        pluginMiddleware: Object.assign(middleware(stili), { getNameStileUniversale: (s) => universali[s] || null }),
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0] },
        $: (el) => ({ attr: (nome) => (nome === "currentcharacterstyle" ? el.stile : undefined), hasClass: () => false, val: () => el.testo })
    }, () => {
        const controller = Object.create(InputEditController.prototype);
        controller.datasource = { descrizione: { modificato: false, lista: CAMPI_PANNELLO } };
        controller.convalidaFirma = true;
        controller.inMismatch = false;
        //Come "Scegli quella del box": la descrizione per intero.
        return controller.getOperazioniDiSalvataggioDaFare(true);
    });
}

test("Coop: scegliendo la descrizione del box la bruciatura non parte come descrizione", () => {
    const operazioni = operazioniDiSalvataggio(COOP);
    assert.strictEqual(operazioni.revisione.descrizione1, "INSALATA DI MARE");
    assert.strictEqual(operazioni.revisione.descrizione4, " 300 g - in olio");
    assert.strictEqual(operazioni.revisione.valore, "INSALATA DI MARE 300 g - in olio");
    assert.doesNotMatch(operazioni.revisione.valoreIndd, /MAX/);
    const descrizione = operazioni.campi_offerta.find(c => c.label === "descrizione");
    assert.strictEqual(descrizione.valore, "INSALATA DI MARE 300 g - in olio");
    assert.doesNotMatch(descrizione.valoreIndd, /MAX/);
});

test("Edro21 e chi non dichiara bruciature: il salvataggio resta com'era", () => {
    const operazioni = operazioniDiSalvataggio([]);
    assert.match(operazioni.revisione.valore, /MAX 4 PEZZI PER CARTA SOCIO$/);
    assert.match(operazioni.revisione.valoreIndd, /<MAX_PEZZI>/);
});

/* ---- la configurazione ---- */

function sourceCustomPlugin(cliente) {
    const file = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", cliente, "SourceCustomPlugin.json");
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

test("solo Coop dichiara le bruciature", () => {
    assert.deepStrictEqual(sourceCustomPlugin("Coopfi").stiliBruciaturaDescrizione, ["MAX_PEZZI"]);
    assert.strictEqual(sourceCustomPlugin("Edro21").stiliBruciaturaDescrizione, undefined);
});

/* ---- la configurazione letta dal Plugin ---- */

//pluginMiddleware.js non si carica sotto Node (ficoProcess vuole InDesign): il membro si estrae dal
//sorgente e si esegue davvero, come in contestoPromoLibreria.test.js.
function middlewareVero(customPluginDB, callCustom = false, customAgenzia = undefined) {
    const sorgente = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "pluginMiddleware.js"), "utf8");
    const intestazione = "    getStiliBruciaturaDescrizione() {";
    const inizio = sorgente.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, "getStiliBruciaturaDescrizione non trovata");
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < sorgente.length && fine < 0; i++) {
        if (sorgente[i] === "{") { livello++; }
        else if (sorgente[i] === "}") { livello--; if (livello === 0) { fine = i + 1; } }
    }
    const fabbrica = new Function("customAgenzia", "return ({\n" + sorgente.substring(inizio, fine) + "\n});");
    const membro = fabbrica(customAgenzia);
    return Object.assign(membro, { callCustom: callCustom, customPluginDB: customPluginDB, getCampo: () => null });
}

test("il Plugin legge le bruciature dalla configurazione di Coop, e da quella di Edro21 nessuna", () => {
    assert.deepStrictEqual(middlewareVero(sourceCustomPlugin("Coopfi")).getStiliBruciaturaDescrizione(), ["MAX_PEZZI"]);
    assert.deepStrictEqual(middlewareVero(sourceCustomPlugin("Edro21")).getStiliBruciaturaDescrizione(), []);
    //Configurazione non ancora scaricata o chiave di tipo sbagliato: nessuna bruciatura.
    assert.deepStrictEqual(middlewareVero(null).getStiliBruciaturaDescrizione(), []);
    assert.deepStrictEqual(middlewareVero({ stiliBruciaturaDescrizione: "MAX_PEZZI" }).getStiliBruciaturaDescrizione(), []);
    //Con il custom.js al comando vale il suo elenco, se c'e'.
    assert.deepStrictEqual(middlewareVero(null, true, { stiliBruciaturaDescrizione: ["MAX_PEZZI"] }).getStiliBruciaturaDescrizione(), ["MAX_PEZZI"]);
    assert.deepStrictEqual(middlewareVero(null, true, {}).getStiliBruciaturaDescrizione(), []);
});

test("tutte le bruciature che AgenziaLib accoda alla descrizione di Coop sono riconosciute, e niente altro", () => {
    const coopfi = fs.readFileSync(path.join(__dirname, "..", "..", "AgenziaLib", "Coopfi.cs"), "utf8");
    const accodate = [...coopfi.matchAll(/descrizione \+= \$"<([A-Za-z_]+)>\\n" \+ specialDescr_max_pezzi_accodato_a_descrizione/g)].map(m => m[1]);
    assert.ok(accodate.length >= 5, "le bruciature di Coopfi.cs non si trovano piu': il test va aggiornato");
    const stili = sourceCustomPlugin("Coopfi").stiliBruciaturaDescrizione;
    accodate.forEach(stile => assert.strictEqual(confronti.eStileBruciatura(stile, stili), true, stile));

    //La descrizione vera resta descrizione: gli stili universali e le altre aggiunte di Coop.
    sourceCustomPlugin("Coopfi").listaStiliUniversali.forEach(u => assert.strictEqual(confronti.eStileBruciatura(u.nome, stili), false, u.nome));
    ["DESCRIZIONE_LINEA", "DESCRIZIONE_PREZZO_SP"].forEach(stile => assert.strictEqual(confronti.eStileBruciatura(stile, stili), false, stile));
});

test("Coop con la configurazione vera: la ref 4860195 non ha differenze di descrizione", async () => {
    const esito = await conGlobali({
        pluginMiddleware: middlewareVero(sourceCustomPlugin("Coopfi")),
        TestoTag: { trattiDiStileDelCampo: (campo) => campo.tratti, parseStile: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => confronti.confrontoBoxCompiledFieldPreAnalisi(boxConDescrizione(CON_BRUCIATURA),
        [{ labelName: "descrizione", paragraphName: "", content: SERVER }], [], [], null, null, false));
    assert.deepStrictEqual(esito.errors, []);
    assert.deepStrictEqual(esito.differenze, []);
});

/* ---- i casi al limite ---- */

test("Coop: bruciature diverse fra box e server non fanno differenza", async () => {
    const esito = await preanalisi(COOP, CON_BRUCIATURA, SERVER + "<MAX_PEZZI_SPENDIPUNTI>\nMAX 2 PEZZI PER CARTA SOCIO</MAX_PEZZI_SPENDIPUNTI>");
    assert.deepStrictEqual(esito.differenze, []);
});

test("Coop: la bruciatura si toglie anche se sta in mezzo alla descrizione", async () => {
    const tratti = [CON_BRUCIATURA[0], { nome: "MAX_PEZZI", contenuto: " MAX 4 PEZZI " }, CON_BRUCIATURA[1]];
    const server = "<DESCRIZIONE_TITOLO>INSALATA DI MARE</DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 4 PEZZI</MAX_PEZZI><DESCRIZIONE_GRAMMATURA> 300 g - in olio</DESCRIZIONE_GRAMMATURA>";
    assert.deepStrictEqual((await preanalisi(COOP, tratti, server)).differenze, []);
    assert.deepStrictEqual((await preanalisi(COOP, tratti, SERVER)).differenze, []);
});

test("Coop: la parola MAX dentro la descrizione resta descrizione", async () => {
    const tratti = [{ nome: "DESCRIZIONE_TITOLO", contenuto: "MAX FRUTTA" }, CON_BRUCIATURA[2]];
    assert.deepStrictEqual((await preanalisi(COOP, tratti, "<DESCRIZIONE_TITOLO>MAX FRUTTA</DESCRIZIONE_TITOLO>")).differenze, []);
    const diversa = await preanalisi(COOP, tratti, "<DESCRIZIONE_TITOLO>MAXI FRUTTA</DESCRIZIONE_TITOLO>");
    assert.strictEqual(diversa.differenze.length, 1);
    assert.strictEqual(diversa.differenze[0].valoreLocale, "MAX FRUTTA");
});

test("Coop: un box con la sola bruciatura e il server senza descrizione non fanno differenza", async () => {
    const esito = await preanalisi(COOP, [CON_BRUCIATURA[2]], "");
    assert.deepStrictEqual(esito.differenze, []);
});

test("Coop: un campo che non e' la descrizione si confronta tutto, anche con lo stile di bruciatura", async () => {
    const esito = await conGlobali({
        pluginMiddleware: middleware(COOP),
        TestoTag: { trattiDiStileDelCampo: (campo) => campo.tratti, parseStile: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => {
        const box = boxConDescrizione([{ nome: "MAX_PEZZI", contenuto: "MAX 4 PEZZI" }]);
        box.allPageItems[0].label = "bollino";
        return confronti.confrontoBoxCompiledFieldPreAnalisi(box,
            [{ labelName: "bollino", paragraphName: "", content: "<MAX_PEZZI>MAX 2 PEZZI</MAX_PEZZI>" }], [], [], null, null, false);
    });
    assert.strictEqual(esito.differenze.length, 1);
    assert.strictEqual(esito.differenze[0].label, "bollino");
});

test("Coop: nel salvataggio la bruciatura si salta solo nella descrizione", () => {
    const operazioni = conGlobali({
        confronti: confronti,
        pluginMiddleware: Object.assign(middleware(COOP), { getNameStileUniversale: () => null }),
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0] },
        $: (el) => ({ attr: (nome) => (nome === "currentcharacterstyle" ? el.stile : undefined), hasClass: () => false, val: () => el.testo })
    }, () => {
        const controller = Object.create(InputEditController.prototype);
        controller.datasource = { bollino: { modificato: true, lista: [{ stile: "MAX_PEZZI", testo: "MAX 2 PEZZI" }] } };
        controller.convalidaFirma = true;
        controller.inMismatch = false;
        return controller.getOperazioniDiSalvataggioDaFare(false);
    });
    const bollino = operazioni.campi_offerta.find(c => c.label === "bollino");
    assert.strictEqual(bollino.valore, "MAX 2 PEZZI");
});

test("il controllo dei tratti di bruciatura non si rompe senza il motore di confronto", () => conGlobali({ confronti: undefined }, () => {
    delete global.confronti;
    const controller = Object.create(InputEditController.prototype);
    assert.strictEqual(controller.eTrattoDiBruciatura("descrizione", "MAX_PEZZI"), false);
}));

/* ---- il ripiego sul custom.js di Coop ---- */

//custom.js vuole InDesign e non si carica sotto Node: la dichiarazione si legge dal sorgente.
function stiliDelCustom(cliente) {
    const sorgente = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "Agenzie", cliente, "custom.js"), "utf8");
    const trovata = sorgente.match(/^\s*stiliBruciaturaDescrizione:\s*(\[[^\]]*\])\s*,/m);
    return trovata ? JSON.parse(trovata[1]) : undefined;
}

test("il server non aggiornato non manda le bruciature: vale il custom.js di Coop", () => {
    const coop = { stiliBruciaturaDescrizione: stiliDelCustom("Coopfi") };
    //Il SourceCustomPlugin di un Istanta senza I20-1079: la chiave non c'e'.
    const vecchioServer = Object.assign({}, sourceCustomPlugin("Coopfi"));
    delete vecchioServer.stiliBruciaturaDescrizione;
    assert.deepStrictEqual(middlewareVero(vecchioServer, false, coop).getStiliBruciaturaDescrizione(), ["MAX_PEZZI"]);
    //Senza configurazione scaricata vale lo stesso.
    assert.deepStrictEqual(middlewareVero(null, false, coop).getStiliBruciaturaDescrizione(), ["MAX_PEZZI"]);
});

test("il server aggiornato comanda sul custom.js", () => {
    const coop = { stiliBruciaturaDescrizione: ["MAX_PEZZI"] };
    assert.deepStrictEqual(middlewareVero({ stiliBruciaturaDescrizione: [] }, false, coop).getStiliBruciaturaDescrizione(), []);
    assert.deepStrictEqual(middlewareVero({ stiliBruciaturaDescrizione: ["ALTRO"] }, false, coop).getStiliBruciaturaDescrizione(), ["ALTRO"]);
});

test("solo il custom.js di Coop dichiara le bruciature, uguali a quelle del suo SourceCustomPlugin", () => {
    assert.deepStrictEqual(stiliDelCustom("Coopfi"), sourceCustomPlugin("Coopfi").stiliBruciaturaDescrizione);
    fs.readdirSync(path.join(__dirname, "..", "..", "plugin", "Agenzie"), { withFileTypes: true })
        .filter(voce => voce.isDirectory() && voce.name !== "Coopfi"
            && fs.existsSync(path.join(__dirname, "..", "..", "plugin", "Agenzie", voce.name, "custom.js")))
        .forEach(voce => assert.strictEqual(stiliDelCustom(voce.name), undefined, voce.name));
});

test("Edro21 col server non aggiornato: nessuna bruciatura, la descrizione si confronta tutta", async () => {
    const vecchioServer = Object.assign({}, sourceCustomPlugin("Edro21"));
    delete vecchioServer.stiliBruciaturaDescrizione;
    const edro = middlewareVero(vecchioServer, false, {});
    assert.deepStrictEqual(edro.getStiliBruciaturaDescrizione(), []);
    const esito = await conGlobali({
        pluginMiddleware: edro,
        TestoTag: { trattiDiStileDelCampo: (campo) => campo.tratti, parseStile: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => confronti.confrontoBoxCompiledFieldPreAnalisi(boxConDescrizione(CON_BRUCIATURA),
        [{ labelName: "descrizione", paragraphName: "", content: SERVER }], [], [], null, null, false));
    assert.strictEqual(esito.differenze.length, 1);
});

test("Coop col server non aggiornato: la ref 4860195 non ha differenze di descrizione", async () => {
    const vecchioServer = Object.assign({}, sourceCustomPlugin("Coopfi"));
    delete vecchioServer.stiliBruciaturaDescrizione;
    const esito = await conGlobali({
        pluginMiddleware: middlewareVero(vecchioServer, false, { stiliBruciaturaDescrizione: stiliDelCustom("Coopfi") }),
        TestoTag: { trattiDiStileDelCampo: (campo) => campo.tratti, parseStile: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => confronti.confrontoBoxCompiledFieldPreAnalisi(boxConDescrizione(CON_BRUCIATURA),
        [{ labelName: "descrizione", paragraphName: "", content: SERVER }], [], [], null, null, false));
    assert.deepStrictEqual(esito.errors, []);
    assert.deepStrictEqual(esito.differenze, []);
});
