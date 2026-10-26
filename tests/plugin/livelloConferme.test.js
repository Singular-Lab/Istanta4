/*
 * I20-1085: le domande all'operatore davanti a tutte le finestre.
 *
 * Dalla finestra "Differenze rilevate" (un Modali.popup, z-index 9000) "Escludi per questa
 * lavorazione" chiede "Solo volantino / Tutto" con Modali.confirmCustom, che stava a z-index 5000:
 * la domanda nasceva dietro la finestra. Ora confirm e confirmCustom stanno a un livello unico,
 * Modali.LIVELLO_CONFERMA, sopra ogni finestra del Plugin e sotto soltanto i suggerimenti.
 *
 * I campi di testo del pannello, che in UXP stanno sopra a tutto, fino a I20-1123 si spegnevano
 * (.hideble) e dopo la risposta si riaccendevano solo se non restava aperto un popup (dopoLaDomanda).
 * Da I20-1123 stanno a riposo come testo HTML (campiARiposo.js): la domanda li copre senza
 * spegnerli, e aprendosi rimette a riposo solo il campo in cui l'operatore sta scrivendo.
 *
 * modali.js si carica sotto Node, con jQuery finto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const Modali = require("../../plugin/modali/modali.js");

const CARTELLA_PLUGIN = path.join(__dirname, "..", "..", "plugin");
const TOOLTIP = 2147483647;

//Tutti i file del Plugin che possono dare uno z-index: html, css e js, fuori da node_modules.
function fileDelPluginConStili(cartella = CARTELLA_PLUGIN) {
    let elenco = [];
    for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
        if (voce.name === "node_modules" || voce.name.startsWith(".")) {
            continue;
        }
        const percorso = path.join(cartella, voce.name);
        if (voce.isDirectory()) {
            elenco = elenco.concat(fileDelPluginConStili(percorso));
        }
        else if (/\.(js|html|css)$/.test(voce.name)) {
            elenco.push(percorso);
        }
    }
    return elenco;
}

test("le domande stanno sopra ogni finestra del Plugin, e sotto soltanto i suggerimenti", () => {
    const livelli = [];
    for (const file of fileDelPluginConStili()) {
        const testo = fs.readFileSync(file, "utf8");
        for (const m of testo.matchAll(/z-?index["']?\s*[:,=]\s*["']?(\d+)/gi)) {
            livelli.push({ valore: Number(m[1]), file: path.relative(CARTELLA_PLUGIN, file) });
        }
    }
    assert.ok(livelli.length > 10, "z-index non trovati: il test va aggiornato");

    const sopra = livelli.filter(l => l.valore >= Modali.LIVELLO_CONFERMA && l.valore !== TOOLTIP);
    assert.deepStrictEqual(sopra, [], "finestre sopra le domande");
    assert.ok(Modali.LIVELLO_CONFERMA < TOOLTIP);
    //In particolare sopra la finestra delle differenze e i dialoghi a tutto schermo.
    assert.ok(Modali.LIVELLO_CONFERMA > 9000 && Modali.LIVELLO_CONFERMA > 9999999);
});

test("confirm e confirmCustom usano tutte e due il livello delle domande, e nessuna sta piu' a 5000", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    const confermaModale = modali.match(/<div id="confirmModal" style="[^"]*"/g) || [];
    assert.strictEqual(confermaModale.length, 2);
    confermaModale.forEach(m => assert.match(m, /z-index: ' \+ Modali\.LIVELLO_CONFERMA \+ ';/));
    assert.doesNotMatch(modali, /z-index: 5000/);
});

/* ---- i campi del pannello sotto le domande (I20-1123) ---- */

test("le domande non spengono e non riaccendono i campi: rimettono a riposo quello in cui si scrive", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    const conferma = modali.substring(modali.indexOf("    async confirm (message){"), modali.indexOf("    closeAllModal(){"));
    const personalizzata = modali.substring(modali.indexOf("    async confirmCustom ("), modali.indexOf("    apriModal(modalId"));

    [conferma, personalizzata].forEach(domanda => {
        assert.match(domanda, /CampiARiposo\.tuttiARiposo\(\);/);
        assert.doesNotMatch(domanda, /HidebleElements|dopoLaDomanda/);
    });
    //Dopo la risposta non c'e' niente da riaccendere: si risponde e basta. TASK-19c18841: nell'attesa
    //ci sono solo il controllo della finestra tolta da altri, che vale come Annulla, e l'altezza
    //fissa del messaggio se il contenuto supera la massima.
    assert.match(personalizzata, /while\(!risposto\)\{\s*if \(document\.getElementById\(idMessaggio\) == null\) \{\s*objRes\.result = false;\s*objRes\.hiddenVal = null;\s*break;\s*\}\s*fissaSeServe\(\);\s*await delay\(100\);\s*\}\s*return objRes;/);
    assert.match(conferma, /while\(result == null\)\{\s*if \(document\.getElementById\(idMessaggio\) == null\) \{\s*return false;\s*\}\s*await delay\(100\);\s*\}\s*return result;/);

    //Gli strumenti di .hideble non ci sono piu'.
    ["dopoLaDomanda", "nascondiHidebleElements", "mostraHidebleElements", "isElementVisible"].forEach(nome => {
        assert.strictEqual(Modali[nome], undefined, nome);
    });
});

test("le domande rimettono a riposo il campo in cui si scrive, prima di aprirsi", () => {
    const CampiARiposo = require("../../plugin/campiARiposo.js");
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    //E' lo stesso modulo che il Plugin avvia: le modali lo prendono con require.
    assert.match(modali, /const CampiARiposo = require\('\.\.\/campiARiposo'\);/);
    assert.strictEqual(typeof CampiARiposo.tuttiARiposo, "function");
    //Anche le finestre e il popup.
    ["    async popup(title", "    apriModal(modalId", "    apriModalCustom(modalId"].forEach(inizio => {
        const corpo = modali.substring(modali.indexOf(inizio), modali.indexOf("\n    },\n", modali.indexOf(inizio)));
        assert.match(corpo, /CampiARiposo\.tuttiARiposo\(\);/, inizio);
    });
});
