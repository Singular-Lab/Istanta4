/*
 * I20-1030: nella Home la rotella del mouse non faceva scorrere la lista dei tracciati. In UXP la
 * rotella scorre solo un contenitore con un'altezza vera, e #Tab1Viewport la prendeva dal flex:
 * cresceva quanto tutte le righe e non aveva niente da scorrere. Ora la sua altezza e' lo spazio
 * libero in #contenitoreTab, ricalcolato da onResizeTab1Tracciato.
 *
 * Le misure delle prove fatte in console sul pannello: la lista comincia a 241 px dall'alto del
 * contenitore, il contenitore e' alto 489, e 238 px di altezza fanno scorrere la rotella.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const AltezzaScorrimento = require("../../plugin/altezzaScorrimento");

//Un contenitore finto: in cima al pannello a 120 px, alto 489, scorso di scrollTop.
function contenitore({ altezza = 489, scorso = 0, top = 120 } = {}) {
    return {
        clientHeight: altezza,
        scrollTop: scorso,
        getBoundingClientRect: () => ({ top: top, width: 600, height: altezza })
    };
}

//Un elemento finto che sullo schermo comincia a "top": quando il contenitore e' scorso, sale.
function elemento({ top = 361, larghezza = 580 } = {}) {
    return {
        style: {},
        getBoundingClientRect: () => ({ top: top, width: larghezza, height: 17263 })
    };
}

test("i numeri della prova in console: inizio a 241, contenitore di 489, altezza 238", () => {
    const c = contenitore();
    const v = elemento({ top: 120 + 241 });

    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(c, v), 238);
});

test("fissaAltezza scrive l'altezza in pixel sull'elemento", () => {
    const v = elemento({ top: 120 + 241 });

    assert.strictEqual(AltezzaScorrimento.fissaAltezza(contenitore(), v), 238);
    assert.strictEqual(v.style.height, "238px");
});

test("con il contenitore gia' scorso l'altezza non cambia, e il contenitore non si sposta", () => {
    //Scorso di 100: sullo schermo l'elemento e' salito di 100.
    const c = contenitore({ scorso: 100 });
    const v = elemento({ top: 120 + 241 - 100 });

    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(c, v), 238);
    assert.strictEqual(c.scrollTop, 100);
});

test("l'altezza dipende dallo spazio, non da quanto e' lunga la lista", () => {
    const corta = { style: {}, getBoundingClientRect: () => ({ top: 361, width: 580, height: 40 }) };
    const lunga = { style: {}, getBoundingClientRect: () => ({ top: 361, width: 580, height: 17263 }) };

    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), corta), 238);
    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), lunga), 238);
});

test("se i filtri crescono la lista si accorcia, e se crescono troppo resta il minimo", () => {
    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), elemento({ top: 120 + 300 })), 179);
    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), elemento({ top: 120 + 450 })), AltezzaScorrimento.MINIMO);
    assert.strictEqual(AltezzaScorrimento.MINIMO, 120);
});

test("margine e minimo si possono cambiare", () => {
    const v = elemento({ top: 120 + 241 });

    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), v, { margine: 0 }), 248);
    assert.strictEqual(AltezzaScorrimento.altezzaDisponibile(contenitore(), elemento({ top: 120 + 480 }), { minimo: 50 }), 50);
});

test("se manca il contenitore o l'elemento non si tocca niente", () => {
    const v = elemento();

    assert.strictEqual(AltezzaScorrimento.fissaAltezza(null, v), null);
    assert.strictEqual(AltezzaScorrimento.fissaAltezza(contenitore(), null), null);
    assert.deepStrictEqual(v.style, {});
});

test("con la scheda nascosta le misure sono zero: nessuna altezza e lo stile resta com'era", () => {
    const nascosto = elemento({ larghezza: 0 });
    nascosto.style.height = "238px";

    assert.strictEqual(AltezzaScorrimento.fissaAltezza(contenitore(), nascosto), null);
    assert.strictEqual(nascosto.style.height, "238px");
    assert.strictEqual(AltezzaScorrimento.fissaAltezza(contenitore({ altezza: 0 }), elemento()), null);
});

test("se le misure non si possono leggere non si tocca niente", () => {
    const rotto = { style: {}, getBoundingClientRect: () => { throw new Error("non impaginato"); } };

    assert.strictEqual(AltezzaScorrimento.fissaAltezza(contenitore(), rotto), null);
    assert.deepStrictEqual(rotto.style, {});
});

test("il modulo non dipende da InDesign", () => {
    assert.doesNotMatch(leggiFileDelPlugin("altezzaScorrimento.js"), /require\(['"]indesign['"]\)/);
});

test("onResizeTab1Tracciato fissa l'altezza della lista prima di tutto il resto", () => {
    const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    assert.match(sorgente, /const AltezzaScorrimento = require\('\.\/altezzaScorrimento'\);/);

    const inizio = sorgente.indexOf("function onResizeTab1Tracciato(){");
    assert.ok(inizio >= 0, "manca onResizeTab1Tracciato");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n}\n", inizio));

    const chiamata = 'AltezzaScorrimento.fissaAltezza(document.getElementById("contenitoreTab"), document.getElementById("Tab1Viewport"));';
    assert.ok(corpo.includes(chiamata), "manca la chiamata a fissaAltezza");
    //Prima delle uscite anticipate: deve valere anche quando la funzione esce presto.
    assert.ok(corpo.indexOf(chiamata) < corpo.indexOf("return;"), "fissaAltezza va prima delle uscite anticipate");
});
