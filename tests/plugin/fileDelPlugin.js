/*
 * I20-1009: i file .js del core del Plugin, sottocartelle comprese.
 *
 * Dal I20-1009 un concetto del Plugin puo' vivere in una cartella sua (plugin/sistemazioneFoto/),
 * e i test che cercano qualcosa in tutto il Plugin - un codice messaggio usato una volta sola, un
 * await applicato a una negazione - devono guardarci dentro. Prima leggevano la sola radice.
 *
 * Restano fuori le cartelle che non sono codice del core: js/ (jQuery), Agenzie/ (le copie per
 * cliente, montate in radice da monta-cliente.sh), Receiver/, images/ e stili/.
 *
 * Non e' un test: il nome non finisce in .test.js, quindi node --test non lo esegue.
 */

const fs = require("node:fs");
const path = require("node:path");

const CARTELLA_PLUGIN = path.join(__dirname, "..", "..", "plugin");
const CARTELLE_ESCLUSE = new Set(["js", "Agenzie", "Receiver", "images", "stili", "node_modules"]);

/// I percorsi relativi a plugin/, con "/" come separatore: "indexNew.js",
/// "sistemazioneFoto/spazioLibero.js".
function fileDelPlugin(cartella = CARTELLA_PLUGIN, prefisso = "") {
    const trovati = [];
    for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
        if (voce.isDirectory()) {
            if (!CARTELLE_ESCLUSE.has(voce.name)) {
                trovati.push(...fileDelPlugin(path.join(cartella, voce.name), prefisso + voce.name + "/"));
            }
        }
        else if (voce.name.endsWith(".js")) {
            trovati.push(prefisso + voce.name);
        }
    }
    return trovati;
}

/// Il testo di un file del Plugin, dato il percorso relativo a plugin/.
function leggiFileDelPlugin(relativo) {
    return fs.readFileSync(path.join(CARTELLA_PLUGIN, relativo), "utf8");
}

module.exports = { CARTELLA_PLUGIN, fileDelPlugin, leggiFileDelPlugin };
