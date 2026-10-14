/*
 * Stili di carattere che non esistono nel documento.
 *
 * Nel PoP Coop la descrizione usciva con gli stili spostati ("mele go" titolo, "lden" brand...) con
 * il dato giusto: portava i tag _SP del Superprezzi, che il documento PoP non ha. TestoTag.parseStile
 * chiedeva lo stile per nome e InDesign restituisce comunque un oggetto, non valido ma non nullo;
 * applicaTagStringToInndTextFrame lo assegnava, l'errore finiva in un catch muto e restava la
 * formattazione del segnaposto del riquadro.
 *
 * Ora parseStile dice null per uno stile non valido, e il tratto prende lo stile nessuno con una
 * segnalazione TTG-01 sul box. parseStile si prova con un documento finto; l'applicazione ai tratti
 * parla con InDesign e si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const TestoTag = require(path.join(__dirname, "..", "..", "plugin", "testoTag.js"));

//Un documento finto: gli stili elencati esistono, gli altri tornano non validi, come in InDesign.
function documento(esistenti) {
    const stile = nome => ({ name: nome, isValid: esistenti.includes(nome) });
    return {
        paragraphStyles: { item: stile },
        characterStyles: { item: stile },
        paragraphStyleGroups: { length: 1, item: () => ({ name: "A", paragraphStyles: { item: stile } }) },
        characterStyleGroups: { length: 1, item: () => ({ name: "A", characterStyles: { item: stile } }) }
    };
}

function conDocumento(esistenti, prova) {
    const prima = global.docInLavorazione;
    global.docInLavorazione = documento(esistenti);
    try {
        prova();
    }
    finally {
        global.docInLavorazione = prima;
    }
}

test("uno stile che il documento non ha e' null, uno che ha e' lo stile", () => {
    conDocumento(["DESCRIZIONE_TITOLO", "PREZZO"], () => {
        assert.strictEqual(TestoTag.parseStile("DESCRIZIONE_TITOLO_SP"), null);
        assert.deepStrictEqual(TestoTag.parseStile("DESCRIZIONE_TITOLO"), { name: "DESCRIZIONE_TITOLO", isValid: true });
        assert.strictEqual(TestoTag.parseStile("A.MANCANTE", true), null);
        assert.deepStrictEqual(TestoTag.parseStile("A.PREZZO", true), { name: "PREZZO", isValid: true });
    });
});

test("il tratto con uno stile mancante prende lo stile nessuno e il box riceve la segnalazione TTG-01", () => {
    const testo = leggiFileDelPlugin("testoTag.js").replace(/\r/g, "");
    const inizio = testo.indexOf("applicaTagStringToInndTextFrame: function");
    const corpo = testo.substring(inizio, testo.indexOf("getDefaultOverflowDirection(tf){", inizio));

    assert.match(corpo, /let st = this\.parseStile\(seg\.styleName, false\);\s*if \(!st\) \{\s*if \(stiliMancanti\.indexOf\(seg\.styleName\) < 0\) \{\s*stiliMancanti\.push\(seg\.styleName\);\s*\}\s*st = nessCharStyle;\s*\}/);
    assert.ok(corpo.indexOf("if (!st) continue;") < 0, "lo stile mancante non si salta piu'");
    const segnalazione = corpo.indexOf("addSegnalazione(\"Code TTG-01 Stili di carattere non trovati nel documento: \" + stiliMancanti.join(\", \")");
    assert.ok(segnalazione > corpo.indexOf("tf.characters.itemByRange(from, to).appliedCharacterStyle = st;"));
    assert.ok(corpo.indexOf("\"warning\", 2, true, [\"TTG-01\", \"orange\"]") > segnalazione);
});
