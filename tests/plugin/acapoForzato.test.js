/*
 * I20-1233: l'a capo forzato nei campi del box.
 *
 * Leggendo un campo, il Plugin scrive l'a capo forzato di InDesign come la parola FORCED_LINE_BREAK
 * (componiStringTagFromInndTextFrame): cosi' arriva al server e cosi' torna. Scrivendo il campo
 * (applicaTagStringToInndTextFrame, la strada di tutte le scritture del testo nel box) la parola
 * restava tale, e nel volantino usciva «MELE GOLDENFORCED_LINE_BREAKMELIND». Ora ogni pezzo di testo
 * passa da TestoTag.testoDaScrivere, con la tabella dei caratteri speciali di Utility.
 *
 * Esecuzione: node --test tests/plugin/acapoForzato.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

//utility.js chiede InDesign: sotto Node gli si da' un finto, la tabella dei caratteri e' JavaScript.
function caricaUtility() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign" || richiesta === "uxp") {
            return { app: {}, SpecialCharacters: {}, FitOptions: {} };
        }
        return originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/utility.js").Utility;
    }
    finally {
        Module._load = originale;
    }
}

globalThis.Utility = caricaUtility();
const TestoTag = require("../../plugin/testoTag.js");

test("I20-1233: la parola FORCED_LINE_BREAK si scrive come a capo", () => {
    assert.strictEqual(TestoTag.testoDaScrivere("MELE GOLDENFORCED_LINE_BREAKMELIND"), "MELE GOLDEN\nMELIND");
    assert.strictEqual(TestoTag.testoDaScrivere("FORCED_LINE_BREAKconf. da 550 g"), "\nconf. da 550 g");
});

test("I20-1233: anche gli altri caratteri speciali letti come parole tornano caratteri", () => {
    assert.strictEqual(TestoTag.testoDaScrivere("DOUBLE_LEFT_QUOTEBioDOUBLE_RIGHT_QUOTE"), "\"Bio\"");
    assert.strictEqual(TestoTag.testoDaScrivere("4DEGREE_SYMBOL"), "4°");
    assert.strictEqual(TestoTag.testoDaScrivere("testo normale"), "testo normale");
    assert.strictEqual(TestoTag.testoDaScrivere(null), "");
});

test("I20-1233: applicaTagStringToInndTextFrame scrive il testo passato da testoDaScrivere", () => {
    const sorgente = leggiFileDelPlugin("testoTag.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("applicaTagStringToInndTextFrame: function");
    const testo = sorgente.indexOf('if (tok.type === "text") {', inizio);
    assert.ok(inizio > 0 && testo > inizio);
    assert.match(sorgente.slice(testo, testo + 600), /let txt = TestoTag\.testoDaScrivere\(tok\.value\);/);
    //e il testo scritto nel campo e' quello costruito da quei pezzi
    assert.ok(sorgente.indexOf("tf.contents = built.fullText;", testo) > testo);
});
