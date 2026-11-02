/*
 * I20-1177: nel volantino di Edro21 il logo Filiera Controllata finiva sotto la foto.
 *
 * Il fix foto non tratta da ostacolo le foto extra (foto_extra*), tranne quelle che il cliente
 * elenca in exceptionElementsToIgnoreFixFoto. Edro21 elencava "*Logo_filiera*", ma il confronto
 * (makeRegexFromGroupName) distingue le maiuscole e la sigla del logo e' LOGO_filiera: il logo
 * restava spazio libero e la foto ci si allargava sopra.
 *
 * Qui le liste si leggono dal custom di Edro21 come sono scritte, e passano da getObstacles. In
 * piu' ogni voce delle eccezioni deve trovare almeno una sigla dei loghi di Edro21, cosi' un altro
 * errore di maiuscole non passa in silenzio.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame" } };
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
let SistemazioneFoto;
try {
    CssFramework = require("../../plugin/CssFramework.js");
    SistemazioneFoto = require("../../plugin/sistemazioneFoto/sistemazioneFoto.js");
}
finally {
    Module._load = caricaOriginale;
}

const RADICE = path.join(__dirname, "..", "..");

//Una lista di custom.js di Edro21 come la scrive il file, commenti esclusi.
function listaDelCustom(nome) {
    const custom = fs.readFileSync(path.join(RADICE, "plugin", "Agenzie", "Edro21", "custom.js"), "utf8").replace(/\r/g, "");
    const inizio = custom.indexOf(nome + ":");
    assert.ok(inizio >= 0, nome);
    const corpo = custom.substring(inizio, custom.indexOf("]", inizio));
    const senzaCommenti = corpo.split("\n").map(riga => riga.replace(/\/\/.*$/, "")).join("\n");
    return [...senzaCommenti.matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

const ECCEZIONI = listaDelCustom("exceptionElementsToIgnoreFixFoto");
const DA_IGNORARE = listaDelCustom("ignoreElementsFixFoto");

global.customAgenzia = { exceptionElementsToIgnoreFixFoto: ECCEZIONI, ignoreElementsFixFoto: DA_IGNORARE };
//Come Utility.parseLabel per le foto extra: l'etichetta resta intera.
global.Utility = { parseLabel: (label) => (label == null ? "" : String(label)) };
global.messaggioUtente = () => {};
global.addSegnalazione = () => {};

let prossimoId = 1;

function elemento(label, bounds) {
    let misure = [...bounds];
    return {
        id: prossimoId++,
        label,
        constructorName: "Rectangle",
        isValid: true,
        get geometricBounds() { return [...misure]; },
        set geometricBounds(valore) { misure = [...valore]; }
    };
}

//Il box dell'albume della issue, in piccolo: CONAD Percorso Qualita' in alto a destra, la filiera
//sotto di lui, la foto a sinistra e la bandiera in basso.
function boxAlbume() {
    return {
        label: "BOX1",
        allPageItems: [
            elemento("base", [0, 0, 80, 100]),
            elemento("foto_extra$conad_cpq$tipo_3", [2, 38, 12, 98]),
            elemento("foto_extra$LOGO_filiera$tipo_3", [14, 40, 22, 98]),
            elemento("foto_extra$LOGO_bandiera_italiana$tipo_3", [70, 2, 78, 12]),
            elemento("immagine", [15, 10, 75, 50])
        ],
        geometricBounds: [0, 0, 80, 100],
        rectangles: { length: 0, item: () => null }
    };
}

test("nel custom di Edro21 il logo filiera e' fra le eccezioni con la sua sigla", () => {
    assert.ok(ECCEZIONI.includes("*LOGO_filiera*"));
    assert.ok(!ECCEZIONI.includes("*Logo_filiera*"));
});

test("il logo filiera fa da ostacolo al fix foto di Edro21, come il CONAD Percorso Qualita'", () => {
    const ostacoli = SistemazioneFoto.getObstacles(boxAlbume()).map(o => o.label);

    assert.ok(ostacoli.includes("foto_extra$LOGO_filiera$tipo_3"), ostacoli.join(", "));
    assert.ok(ostacoli.includes("foto_extra$conad_cpq$tipo_3"), ostacoli.join(", "));
});

test("un logo che Edro21 non elenca resta fuori dagli ostacoli, e cosi' la foto", () => {
    const ostacoli = SistemazioneFoto.getObstacles(boxAlbume()).map(o => o.label);

    assert.ok(!ostacoli.includes("foto_extra$LOGO_bandiera_italiana$tipo_3"), ostacoli.join(", "));
    assert.ok(!ostacoli.includes("immagine"), ostacoli.join(", "));
    assert.ok(!ostacoli.includes("base"), ostacoli.join(", "));
});

test("ogni eccezione del fix foto di Edro21 trova almeno un logo, maiuscole comprese", () => {
    const loghi = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta", "wwwroot", "external_source", "Edro21", "SourceLoghiBolli.json"), "utf8").replace(/^﻿/, ""));
    const sigle = new Set();
    (function raccogli(nodo) {
        if (Array.isArray(nodo)) {
            nodo.forEach(raccogli);
        }
        else if (nodo && typeof nodo === "object") {
            for (const [chiave, valore] of Object.entries(nodo)) {
                if (chiave.toLowerCase() === "sigla" && typeof valore === "string") {
                    sigle.add(valore);
                }
                raccogli(valore);
            }
        }
    })(loghi);
    assert.ok(sigle.size > 0);

    const senzaLogo = ECCEZIONI.filter(e => {
        const regola = CssFramework.makeRegexFromGroupName(e);
        return ![...sigle].some(s => regola.test("foto_extra$" + s + "$tipo_3"));
    });
    assert.deepStrictEqual(senzaLogo, []);
});
