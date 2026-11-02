/*
 * I20-1181: nella scheda Filtri del Menabo' comparivano due barre verticali, quella della griglia
 * e quella di #contenitoreTab. La traccia sul pannello: contenitore di 489 px, griglia che comincia
 * a 66, alta 418, e sotto la barra orizzontale di 32 px; in tutto 516 px. L'altezza della griglia
 * era stata calcolata con la barra appena creata, che misurava ancora 0: la griglia era alta quanto
 * la barra in piu'.
 *
 * Corretto quello, all'apertura le due barre c'erano ancora: la griglia nasceva sempre di 400 px, e
 * per un attimo la scheda era di 498 px in 489.
 *
 * Ora filtri.adattaAltezzaGriglia da' alla griglia lo spazio che resta dalla sua cima al fondo del
 * contenitore, meno la barra (contata 32 px finche' non si misura), e lo riprova mentre il pannello
 * si assesta; la griglia nasce col minimo o con l'altezza di prima, e crescendo non sborda. Si prova
 * con un documento finto e un orologio finto; filtri.js si carica con un modulo indesign finto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let filtri;
try {
    filtri = require("../../plugin/filtri.js");
}
finally {
    Module._load = caricaOriginale;
}

const AltezzaScorrimento = require("../../plugin/altezzaScorrimento");

//setTimeout a mano: avanza(ms) esegue i timer scaduti, nell'ordine, anche quelli che nascono dentro.
function orologio() {
    let adesso = 0;
    const timer = [];
    return {
        programmati: 0,
        setTimeout(funzione, ritardo) {
            this.programmati++;
            timer.push({ quando: adesso + ritardo, funzione });
        },
        avanza(ms) {
            const fine = adesso + ms;
            for (;;) {
                timer.sort((a, b) => a.quando - b.quando);
                if (timer.length === 0 || timer[0].quando > fine) {
                    break;
                }
                const t = timer.shift();
                adesso = t.quando;
                t.funzione();
            }
            adesso = fine;
        }
    };
}

//Il pannello della traccia: #contenitoreTab a 120 px dall'alto, alto 489; la griglia comincia 66 px
//sotto (pulsanti 36, intestazione 30); la barra orizzontale e' alta 32 ma puo' misurare ancora 0.
function pannello({ larghezzaGriglia = 499, altezzaBarra = 0 } = {}) {
    const contenitore = {
        clientHeight: 489,
        scrollTop: 0,
        getBoundingClientRect: () => ({ top: 120, width: 523, height: 489 })
    };
    const griglia = {
        style: { height: "418px" },
        getBoundingClientRect: () => ({ top: 120 + 66, width: larghezzaGriglia, height: parseFloat(griglia.style.height) })
    };
    const barra = {
        altezza: altezzaBarra,
        style: { display: "flex" },
        getBoundingClientRect: () => ({ top: 0, width: 499, height: barra.altezza })
    };

    global.document = {
        getElementById: (id) => ({ contenitoreTab: contenitore, filtriBodyGriglia: griglia })[id] || null
    };
    filtri.statoBarraGriglia.barra = barra;
    return { contenitore, griglia, barra };
}

//Quanto occupano griglia e barra, dalla cima del contenitore: deve restarci dentro.
function fondo(p) {
    return 66 + parseFloat(p.griglia.style.height) + p.barra.altezza;
}

test("con la barra che misura gia' 32, griglia e barra stanno nel contenitore, col margine", () => {
    const tempo = orologio();
    const p = pannello({ altezzaBarra: 32 });

    assert.strictEqual(filtri.adattaAltezzaGriglia(tempo), 489 - 66 - AltezzaScorrimento.MARGINE - 32);
    assert.strictEqual(p.griglia.style.height, "381px");
    assert.strictEqual(489 - fondo(p), AltezzaScorrimento.MARGINE);
});

test("la barra appena creata misura 0: prima di ogni misura vale l'altezza prevista, e la griglia ci sta subito", () => {
    const tempo = orologio();
    const p = pannello({ altezzaBarra: 0 });
    filtri.statoBarraGriglia.altezzaMisurata = 0;

    filtri.adattaAltezzaGriglia(tempo);

    //Contarla 0 dava 413 px, e la scheda sbordava di quanto e' alta la barra.
    assert.strictEqual(filtri.altezzaBarraGriglia(), filtri.ALTEZZA_BARRA_GRIGLIA_PREVISTA);
    assert.strictEqual(p.griglia.style.height, "381px");
    p.barra.altezza = 32;
    assert.ok(fondo(p) <= 489, "griglia e barra stanno in #contenitoreTab gia' al primo calcolo");
});

test("la barra che torna a misurare 0 vale l'ultima altezza misurata", () => {
    const p = pannello({ altezzaBarra: 28 });

    assert.strictEqual(filtri.altezzaBarraGriglia(), 28);
    p.barra.altezza = 0;
    assert.strictEqual(filtri.altezzaBarraGriglia(), 28);
});

test("l'altezza prevista e' quella misurata nella traccia", () => {
    assert.strictEqual(filtri.ALTEZZA_BARRA_GRIGLIA_PREVISTA, 32);
});

test("se una riprova trova misure diverse, l'altezza si corregge", () => {
    const tempo = orologio();
    const p = pannello({ altezzaBarra: 32 });

    filtri.adattaAltezzaGriglia(tempo);
    assert.strictEqual(p.griglia.style.height, "381px");

    //Il pannello si assesta con una barra piu' alta: la riprova le lascia il suo posto.
    p.barra.altezza = 40;
    tempo.avanza(filtri.RITARDO_ALTEZZA_GRIGLIA_MS);

    assert.strictEqual(p.griglia.style.height, "373px");
    assert.ok(fondo(p) <= 489);
    assert.ok(filtri.RITARDO_ALTEZZA_GRIGLIA_MS * filtri.RIPROVE_ALTEZZA_GRIGLIA >= 300, "le riprove arrivano almeno a 300 ms, come nella traccia");
});

/* ---- l'altezza con cui nasce la griglia ---- */

test("al primo disegno la griglia nasce col minimo, mai piu' alta dello spazio", () => {
    assert.strictEqual(filtri.altezzaInizialeGriglia(null), AltezzaScorrimento.MINIMO + "px");
    assert.strictEqual(filtri.altezzaInizialeGriglia({ style: { height: "" } }), AltezzaScorrimento.MINIMO + "px");
    assert.ok(AltezzaScorrimento.MINIMO < 381);
});

test("al ridisegno la griglia nasce con l'altezza che aveva, e non lampeggia", () => {
    assert.strictEqual(filtri.altezzaInizialeGriglia({ style: { height: "381px" } }), "381px");
    assert.strictEqual(filtri.altezzaInizialeGriglia({ style: { height: "380.6px" } }), "380px");
});

test("la griglia non nasce piu' con 400 px fissi", () => {
    const sorgente = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("const bodyDiv = $('<div></div>').attr('id', 'filtriBodyGriglia').css({");
    assert.ok(inizio >= 0, "creazione della griglia non trovata: il test va aggiornato");
    const creazione = sorgente.substring(inizio, sorgente.indexOf("});", inizio));

    assert.match(creazione, /height: altezzaIniziale,/);
    assert.doesNotMatch(creazione, /400px/);
    //L'altezza di prima si legge prima di svuotare #filtriBody, che porta via la griglia.
    const lettura = sorgente.indexOf('const altezzaIniziale = filtri.altezzaInizialeGriglia(document.getElementById("filtriBodyGriglia"));');
    const svuota = sorgente.indexOf("$('#filtriBody').empty();", lettura);
    assert.ok(lettura >= 0 && svuota > lettura);
});

test("le riprove finiscono: non resta un timer che gira per sempre", () => {
    const tempo = orologio();
    pannello({ altezzaBarra: 32 });

    filtri.adattaAltezzaGriglia(tempo);
    tempo.avanza(10000);

    assert.strictEqual(tempo.programmati, filtri.RIPROVE_ALTEZZA_GRIGLIA);
});

test("con la barra nascosta, perche' le colonne ci stanno, la griglia prende anche il suo spazio", () => {
    const tempo = orologio();
    const p = pannello({ altezzaBarra: 32 });
    p.barra.style.display = "none";

    filtri.adattaAltezzaGriglia(tempo);

    assert.strictEqual(p.griglia.style.height, (489 - 66 - AltezzaScorrimento.MARGINE) + "px");
});

test("con la scheda nascosta non si scrive niente e non si riprova", () => {
    const tempo = orologio();
    const p = pannello({ larghezzaGriglia: 0, altezzaBarra: 32 });

    assert.strictEqual(filtri.adattaAltezzaGriglia(tempo), null);
    assert.strictEqual(p.griglia.style.height, "418px");
    assert.strictEqual(tempo.programmati, 0);
});

/* ---- #wrapper ---- */

//La terza traccia: con le righe nella griglia #wrapper diceva 1338 px di contenuto su 628, la cima
//della griglia (186) piu' le sue righe (1152), e con overflow auto mostrava la sua barra verticale.
test("#wrapper non scorre: le righe della griglia non gli fanno comparire una barra", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const tag = html.match(/<div id="wrapper"[^>]*>/);
    assert.ok(tag, "#wrapper non trovato: il test va aggiornato");

    const stile = tag[0].match(/style="([^"]*)"/)[1];
    assert.match(stile, /overflow: hidden;/);
    //Lo stile in linea vince sulla classe .wrapper, che ha overflow auto.
    assert.match(tag[0], /class="wrapper"/);
});

test("onresizeWindow non calcola piu' l'altezza della griglia per sottrazione", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indexNew.indexOf("function onresizeWindow(){");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));

    assert.match(corpo, /filtriJs\.adattaAltezzaGriglia\(\);/);
    assert.doesNotMatch(corpo, /\$\("#filtriBodyGriglia"\)\.css\("height"/);
    assert.doesNotMatch(corpo, /altezzaHeaderFiltri/);
});
