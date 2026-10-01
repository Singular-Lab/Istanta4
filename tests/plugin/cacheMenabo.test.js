/*
 * I20-1028: nel Menabo', scheda Filtri, la casella "Utilizza cache se disponibile" e' spuntata
 * di default. L'operatore la vede e la toglie quando vuole un'elaborazione fresca del kit.
 *
 * Delle due caselle con quel testo in index.html conta cacheCheckAdvanced: e' l'unica che
 * indexNew.js legge. Spuntata vuol dire noCache = false nelle chiamate di Conteggio e Impagina a
 * Menabo/ImpaginaFromInDesignNew. Il Plugin non si carica sotto Node: si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function casella(html, id) {
    const trovata = html.match(new RegExp('<input[^>]*\\bid="' + id + '"[^>]*>'));
    assert.ok(trovata, "manca la casella " + id);
    return trovata[0];
}

test("la casella della cache nella scheda Filtri e' spuntata di default", () => {
    const html = leggiFileDelPlugin("index.html");

    assert.match(casella(html, "cacheCheckAdvanced"), /type="checkbox"/);
    assert.match(casella(html, "cacheCheckAdvanced"), /\schecked(\s|>|=)/);
});

test("Conteggio e Impagina chiedono di non usare la cache solo se la casella e' tolta", () => {
    const sorgente = leggiFileDelPlugin("indexNew.js");

    assert.match(sorgente, /var noCacheCheck = !\(\$\("#cacheCheckAdvanced"\)\.is\(":checked"\)\);/);
    const invii = sorgente.replace(/\r/g, "").split("\n")
        .filter(riga => /\.send\("Menabo\/ImpaginaFromInDesignNew\/"/.test(riga));
    assert.ok(invii.length >= 1, "manca la chiamata a ImpaginaFromInDesignNew");
    for (const riga of invii) {
        assert.match(riga, /\+ "\/" \+ noCacheCheck,/, riga.trim());
    }
});
