/*
 * TASK-4ed03027: l'icona di info del Plugin era un PNG di 18x18 pixel, mostrato a 24 px nella scheda
 * ref (48 pixel reali su uno schermo Retina) e a 30 px nel Report Integrita': ingrandita, era sgranata.
 * Una sorgente molto piu' grande (144x144) non bastava: UXP la rimpicciolisce senza smussare e perde
 * l'antialiasing. Ora e' disegnata a 48x48, i pixel reali dei 24 px della scheda ref, con l'antialiasing
 * gia' calcolato. Ogni punto che la usa ne fissa la misura, quindi cambia solo la nitidezza.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/// Larghezza, altezza e tipo di colore dall'intestazione IHDR del PNG.
function misurePng(percorso) {
    const dati = fs.readFileSync(percorso);
    assert.deepStrictEqual([...dati.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "non e' un PNG");
    assert.strictEqual(dati.subarray(12, 16).toString("ascii"), "IHDR");
    return { larghezza: dati.readUInt32BE(16), altezza: dati.readUInt32BE(20), tipoColore: dati[25] };
}

test("l'icona di info e' quadrata, con la trasparenza, e abbastanza grande da restare nitida", () => {
    const icona = misurePng(path.join(__dirname, "..", "..", "plugin", "images", "info.png"));
    assert.strictEqual(icona.larghezza, icona.altezza);
    //La scheda ref la mostra a 24 px: almeno il doppio, per gli schermi Retina.
    assert.ok(icona.larghezza >= 48, icona.larghezza + " px");
    //RGBA: fuori dal cerchio e' trasparente, come prima.
    assert.strictEqual(icona.tipoColore, 6);
});
