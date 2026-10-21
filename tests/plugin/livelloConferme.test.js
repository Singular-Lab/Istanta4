/*
 * I20-1085: le domande all'operatore davanti a tutte le finestre.
 *
 * Dalla finestra "Differenze rilevate" (un Modali.popup, z-index 9000) "Escludi per questa
 * lavorazione" chiede "Solo volantino / Tutto" con Modali.confirmCustom, che stava a z-index 5000:
 * la domanda nasceva dietro la finestra. Ora confirm e confirmCustom stanno a un livello unico,
 * Modali.LIVELLO_CONFERMA, sopra ogni finestra del Plugin e sotto soltanto i suggerimenti.
 *
 * E dopo la risposta i controlli nativi del pannello (gli .hideble, che in UXP stanno sopra a tutto)
 * si riaccendono solo se non resta aperto un popup: altrimenti finirebbero sopra la finestra da cui
 * la domanda e' partita. Li riaccende la X del popup.
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

/* ---- i controlli del pannello dopo la risposta ---- */

function jQueryFinto(popupAperti, riaccesi) {
    return (selettore) => {
        if (selettore === "#popup") {
            return { length: popupAperti };
        }
        if (selettore === ".hideble[hidden]") {
            return { each: (fn) => fn.call({ nome: "casella" }) };
        }
        //this dentro each: l'elemento da riaccendere.
        return {
            css: () => riaccesi.push(selettore && selettore.nome),
            removeAttr: () => {}
        };
    };
}

function conJQuery(finto, prova) {
    const salvato = global.$;
    global.$ = finto;
    try {
        return prova();
    }
    finally {
        if (salvato === undefined) { delete global.$; } else { global.$ = salvato; }
    }
}

test("dopo la risposta, con la finestra delle differenze ancora aperta, i controlli restano nascosti", () => {
    const riaccesi = [];
    conJQuery(jQueryFinto(1, riaccesi), () => {
        assert.strictEqual(Modali.dopoLaDomanda(), false);
    });
    assert.deepStrictEqual(riaccesi, []);
});

test("dopo la risposta, senza finestre aperte, i controlli si riaccendono come prima", () => {
    const riaccesi = [];
    conJQuery(jQueryFinto(0, riaccesi), () => {
        assert.strictEqual(Modali.dopoLaDomanda(), true);
    });
    assert.deepStrictEqual(riaccesi, ["casella"]);
});

test("confirm e confirmCustom riaccendono i controlli solo passando da dopoLaDomanda", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    const conferma = modali.substring(modali.indexOf("    async confirm (message){"), modali.indexOf("    closeAllModal(){"));
    const personalizzata = modali.substring(modali.indexOf("    async confirmCustom ("));
    assert.doesNotMatch(conferma, /this\.mostraHidebleElements\(\)/);
    assert.strictEqual((conferma.match(/this\.dopoLaDomanda\(\);/g) || []).length, 2);
    assert.match(personalizzata, /while\(!risposto\)\{\s*await delay\(100\);\s*\}\s*this\.dopoLaDomanda\(\);\s*return objRes;/);
});
