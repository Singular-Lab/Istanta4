/*
 * I20-1005: le funzioni delle schede del pannello esistono in una copia sola.
 *
 * index.html ne teneva una sua, che chiamavano i click, e jsIndexControls.js un'altra, che
 * chiamava il codice: gia' divergenti. Le differenze servivano solo al click - ridisegnare il
 * tracciato entrando in home, caricare la home dei filtri entrando nel menabo' - e il codice
 * non deve farle, perche' EVENT_NO_REF_SELECTED torna alla home a ogni deselezione. Qui si
 * prova che la copia e' una, che il markup passa di li', e che le azioni del click partono
 * solo quando il click e' dell'operatore.
 *
 * Il modulo usa $, document e onresizeWindow come globali, come fa il resto del Plugin: qui
 * le mette il test, con un jQuery finto che sa solo quello che il modulo gli chiede.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, "..", "..", percorso), "utf8");
}

/* ---- il DOM finto ---- */

//Un elemento: stile, attributi, dati. Basta a css, attr e data.
function elemento(attributi = {}, dati = {}, stile = {}) {
    return { attributi, dati, stile: Object.assign({ display: "block" }, stile) };
}

//Un sottomenu' per classe (".subTab7") con le sue immagini, e i pulsanti per id.
let sottomenu = {};
let pulsanti = {};

function insieme(elementi) {
    return {
        length: elementi.length,
        css(nome, valore) {
            if (valore === undefined) {
                return elementi.length > 0 ? elementi[0].stile[nome] : undefined;
            }
            elementi.forEach(el => el.stile[nome] = valore);
            return this;
        },
        attr(nome) {
            return elementi.length > 0 ? elementi[0].attributi[nome] : undefined;
        },
        data(nome) {
            return elementi.length > 0 ? elementi[0].dati[nome] : undefined;
        },
        find(selettore) {
            if (selettore === "img") {
                return insieme(elementi.flatMap(el => el.immagini || []));
            }
            return insieme(Object.values(sottomenu));
        },
        each(fn) {
            for (const el of elementi) {
                if (fn.call(el) === false) {
                    break;
                }
            }
            return this;
        }
    };
}

global.$ = (chi) => {
    if (typeof chi !== "string") {
        return chi && chi.length !== undefined && chi.css ? chi : insieme([chi]);
    }
    if (chi.startsWith(".sub") && chi !== ".subMenuTabs") {
        return insieme(sottomenu[chi] ? [sottomenu[chi]] : []);
    }
    if (chi.startsWith("#")) {
        pulsanti[chi] = pulsanti[chi] || elemento();
        return insieme([pulsanti[chi]]);
    }
    return insieme([{ stile: {}, attributi: {}, dati: {} }]);
};

//Le schede rispondono a "tabcontent"; a "tablinks" rispondono i pulsanti, che hanno className.
let schede = {};
let linguette = [];
global.document = {
    getElementsByClassName: (classe) => classe === "tablinks" ? linguette : Object.values(schede),
    getElementById: (id) => {
        schede[id] = schede[id] || { style: {}, parentNode: { style: {} } };
        return schede[id];
    }
};

let ridimensionamenti = 0;
global.onresizeWindow = () => ridimensionamenti++;

const jsIndexControls = require("../../plugin/jsIndexControls.js");

//changeImage lavora sul src delle immagini e ha le sue regole: qui interessa solo che
//changeSubMenu la chiami sull'immagine che ha aperto. La si osserva al posto di eseguirla.
const changeImageVera = jsIndexControls.changeImage;
let immaginiAccese = [];

test.beforeEach(() => {
    sottomenu = {};
    pulsanti = {};
    schede = {};
    linguette = [{ className: "tablinks active" }, { className: "tablinks" }];
    ridimensionamenti = 0;
    immaginiAccese = [];
    jsIndexControls.changeImage = (immagine) => immaginiAccese.push(immagine.attr("tab"));
});

test.afterEach(() => {
    jsIndexControls.changeImage = changeImageVera;
});

/* ---- openTab ---- */

test("openTab mostra la scheda chiesta e nasconde le altre", () => {
    jsIndexControls.openTab(null, "Tab2");
    jsIndexControls.openTab(null, "Tab4");

    assert.strictEqual(schede.Tab4.style.display, "block");
    assert.strictEqual(schede.Tab2.style.display, "none");
    assert.deepStrictEqual(linguette.map(l => l.className), ["tablinks", "tablinks"]);
    assert.strictEqual(ridimensionamenti, 2);
});

test("openTab esegue functionToCall dopo aver mostrato la scheda", () => {
    let visibileQuandoChiamata = null;
    jsIndexControls.openTab(null, "filtriTab", () => {
        visibileQuandoChiamata = schede.filtriTab.style.display;
    });

    assert.strictEqual(visibileQuandoChiamata, "block");
});

test("openTab senza functionToCall, o con qualcosa che non e' una funzione, non fallisce", () => {
    jsIndexControls.openTab(null, "Tab1");
    jsIndexControls.openTab(null, "Tab1", undefined);
    jsIndexControls.openTab(null, "Tab1", Promise.resolve());

    assert.strictEqual(schede.Tab1.style.display, "block");
});

test("Tab5 mostra Salva, Tab6 mostra Conferma", () => {
    jsIndexControls.openTab(null, "Tab5");
    assert.strictEqual(pulsanti["#salvaButton"].stile.display, "block");
    assert.strictEqual(pulsanti["#confermaButton"].stile.display, "none");

    jsIndexControls.openTab(null, "Tab6");
    assert.strictEqual(pulsanti["#salvaButton"].stile.display, "none");
    assert.strictEqual(pulsanti["#confermaButton"].stile.display, "block");
});

test("Tab7, Tab8 e Tab13 nascondono Salva e Conferma", () => {
    for (const tab of ["Tab7", "Tab8", "Tab13"]) {
        jsIndexControls.openTab(null, "Tab5");
        jsIndexControls.openTab(null, tab);

        assert.strictEqual(pulsanti["#salvaButton"].stile.display, "none", tab);
        assert.strictEqual(pulsanti["#confermaButton"].stile.display, "none", tab);
    }
});

//Il case Tab8 finiva dentro Tab13: innocuo finche' le due istruzioni erano uguali.
test("ogni case dello switch di openTab chiude col suo break", () => {
    const testo = sorgente("plugin/jsIndexControls.js").replace(/\r/g, "");
    const corpo = testo.slice(testo.indexOf("switch (tabName)"), testo.indexOf("default:"));
    const casi = corpo.split(/\n\s*case /).slice(1);

    assert.ok(casi.length >= 5);
    for (const caso of casi) {
        assert.match(caso.trim(), /break;$/, "case " + caso.split(":")[0]);
    }
});

/* ---- changeSubMenu: le azioni del click solo al click ---- */

//Il sottomenu' della home: la prima immagine visibile e' "Consulta tracciato", col suo
//data-method che ridisegna il tracciato.
function sottomenuHome(chiamate) {
    jsIndexControls.metodiDaMarkup["mostraTracciato"] = () => chiamate.push("mostraTracciato");
    const nascosta = elemento({ tab: "TabNascosta", src: "a.png" }, {}, { display: "none" });
    const tracciato = elemento({ tab: "Tab1", src: "b.png" }, { method: "mostraTracciato" });
    const altra = elemento({ tab: "Tab2", src: "c.png" });
    sottomenu[".subTab7"] = Object.assign(elemento(), { immagini: [nascosta, tracciato, altra] });
}

test("dal click dell'operatore si apre la prima sottoscheda visibile e parte il suo data-method", () => {
    const chiamate = [];
    sottomenuHome(chiamate);

    jsIndexControls.changeSubMenu("Tab7", true);

    assert.strictEqual(schede.Tab1.style.display, "block");
    assert.strictEqual(schede.TabNascosta, undefined);
    assert.deepStrictEqual(immaginiAccese, ["Tab1"]);
    assert.deepStrictEqual(chiamate, ["mostraTracciato"]);
});

//E' il caso di EVENT_NO_REF_SELECTED: a ogni deselezione si torna alla home, e ridisegnare
//il tracciato ogni volta non si deve.
test("dal codice si apre la sottoscheda ma il data-method non parte", () => {
    const chiamate = [];
    sottomenuHome(chiamate);

    jsIndexControls.changeSubMenu("Tab7");

    assert.strictEqual(schede.Tab1.style.display, "block");
    assert.deepStrictEqual(chiamate, []);
});

test("un data-method non registrato non fa niente e non da' errore", () => {
    const immagine = elemento({ tab: "Tab4", src: "d.png" }, { method: "nonEsiste.daNessunaParte" });
    sottomenu[".subTab1"] = Object.assign(elemento(), { immagini: [immagine] });

    jsIndexControls.changeSubMenu("Tab1", true);

    assert.strictEqual(schede.Tab4.style.display, "block");
    assert.strictEqual(jsIndexControls.metodoDaMarkup("nonEsiste.daNessunaParte"), null);
    assert.strictEqual(jsIndexControls.metodoDaMarkup("toString"), null);
});

/* ---- la copia e' una sola ---- */

const FUNZIONI_DEI_TAB = ["openTab", "openTabTracciato", "changeImage", "clearSubmenu", "changeSubMenu", "findOpenedTab"];

test("index.html non definisce piu' nessuna funzione dei tab", () => {
    const html = sorgente("plugin/index.html");
    for (const nome of FUNZIONI_DEI_TAB) {
        assert.doesNotMatch(html, new RegExp("function\\s+" + nome + "\\s*\\("), nome);
    }
    assert.doesNotMatch(html, /functionMap/);
});

test("nel markup ogni chiamata alle funzioni dei tab passa da jsIndexControls", () => {
    const html = sorgente("plugin/index.html");
    const gestori = html.match(/on\w+="[^"]*"/g) || [];
    let trovate = 0;

    for (const gestore of gestori) {
        for (const nome of FUNZIONI_DEI_TAB) {
            const chiamate = gestore.match(new RegExp("[\\w.]*\\b" + nome + "\\(", "g")) || [];
            for (const chiamata of chiamate) {
                trovate++;
                assert.strictEqual(chiamata, "jsIndexControls." + nome + "(", gestore);
            }
        }
    }
    assert.ok(trovate > 20, "trovate solo " + trovate + " chiamate");
});

test("ogni data-method del markup e' registrato in jsIndexControls", () => {
    const html = sorgente("plugin/index.html");
    const metodi = [...html.matchAll(/data-method="([^"]+)"/g)].map(m => m[1]);

    assert.ok(metodi.includes("mostraTracciato"));
    assert.ok(metodi.includes("filtriJs.visualizzaHomePageFiltri"));
    for (const metodo of metodi) {
        assert.ok(Object.prototype.hasOwnProperty.call(jsIndexControls.metodiDaMarkup, metodo), metodo);
    }
});

//I click della barra sono dell'operatore: devono dirlo a changeSubMenu.
test("i click della barra chiamano changeSubMenu come operatore", () => {
    const html = sorgente("plugin/index.html");
    const chiamate = html.match(/jsIndexControls\.changeSubMenu\([^)]*\)/g) || [];

    assert.strictEqual(chiamate.length, 7);
    for (const chiamata of chiamate) {
        assert.match(chiamata, /, true\)$/, chiamata);
    }
});

//Il codice invece non lo dice mai: e' la differenza che deve restare.
test("il codice non chiama mai changeSubMenu come operatore", () => {
    //I20-1014: le chiamate del Report Integrita' stanno in reportIntegrita/, non piu' in confronti.js.
    for (const file of ["plugin/indexNew.js", "plugin/reportIntegrita/reportIntegrita.js", "plugin/schedaArtwork.js", "plugin/schedaRef.js"]) {
        const chiamate = sorgente(file).match(/jsIndexControls\.changeSubMenu\([^;]*;/g) || [];
        assert.ok(chiamate.length > 0, file);
        for (const chiamata of chiamate) {
            assert.doesNotMatch(chiamata, /true\)\s*;$/, file + ": " + chiamata);
        }
    }
});

test("il codice non chiama piu' l'openTab globale", () => {
    const testo = sorgente("plugin/indexNew.js");
    const nude = (testo.match(/^[^\/\n]*[^.\w]openTab\(/gm) || []);

    assert.deepStrictEqual(nude, []);
});
