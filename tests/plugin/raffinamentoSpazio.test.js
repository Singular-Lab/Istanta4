/*
 * I20-1011: il raffinamento dello spazio per le foto finisce sempre, e se una guardia lo
 * ferma lo si viene a sapere.
 *
 * refineRects spezza ogni candidato sugli ostacoli che lo attraversano. Ogni pezzo porta in
 * obstacleRefs l'ostacolo che l'ha spezzato e su quello non viene piu' spezzato, quindi il
 * ciclo finisce in al piu' ostacoli + 1 giri: la guardia e' quel numero. Prima era a mille
 * giri, non poteva scattare, e se l'avesse fatto nessuno l'avrebbe saputo.
 *
 * CssFramework.js fa require('indesign') e sotto Node non si carica: qui il modulo viene
 * sostituito da un oggetto vuoto, solo durante il require. refineRects e le funzioni che usa
 * sono calcolo puro e non ne toccano niente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

global.customAgenzia = null;

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}

/* ---- strumenti ---- */

const LARGHEZZA = 100;
const ALTEZZA = 80;

//Generatore ripetibile: le configurazioni "casuali" sono sempre le stesse.
function generatore(seme) {
    let stato = seme;
    return () => (stato = (stato * 16807) % 2147483647) / 2147483647;
}

function ostacoliCasuali(quanti, casuale) {
    const ostacoli = [];
    for (let i = 0; i < quanti; i++) {
        const width = 5 + casuale() * 35;
        const height = 4 + casuale() * 25;
        ostacoli.push({ x: casuale() * (LARGHEZZA - width), y: casuale() * (ALTEZZA - height), width, height });
    }
    return ostacoli;
}

function raffina(ostacoli) {
    const candidati = CssFramework.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0);
    const esito = {};
    const risultato = CssFramework.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0, esito);
    return { risultato, esito };
}

function siSovrappongono(a, b) {
    const margine = 0.0001;
    return a.x < b.x + b.width - margine && a.x + a.width > b.x + margine &&
        a.y < b.y + b.height - margine && a.y + a.height > b.y + margine;
}

function verificaConvergenza(ostacoli, descrizione) {
    const { risultato, esito } = raffina(ostacoli);

    assert.strictEqual(esito.interrotto, false, descrizione);
    assert.strictEqual(esito.ostacoli, ostacoli.length, descrizione);
    assert.ok(esito.iterazioni <= ostacoli.length + 1, descrizione + ": " + esito.iterazioni + " iterazioni");
    for (const r of risultato) {
        for (const o of ostacoli) {
            assert.ok(!siSovrappongono(r, o), descrizione + ": un rettangolo libero copre un ostacolo");
        }
    }
    return { risultato, esito };
}

/* ---- la convergenza ---- */

test("senza ostacoli il ciclo gira una volta e finisce", () => {
    const { esito } = verificaConvergenza([], "nessun ostacolo");
    assert.strictEqual(esito.iterazioni, 1);
});

test("un ostacolo al centro lascia libero lo spazio intorno", () => {
    const { risultato } = verificaConvergenza([{ x: 40, y: 30, width: 20, height: 20 }], "un ostacolo");
    assert.ok(risultato.length > 0);
});

test("ostacoli sovrapposti convergono", () => {
    verificaConvergenza([
        { x: 10, y: 10, width: 40, height: 30 },
        { x: 30, y: 20, width: 40, height: 30 },
        { x: 20, y: 5, width: 10, height: 60 }
    ], "sovrapposti");
});

test("un ostacolo che copre tutto non lascia spazio", () => {
    const { risultato } = verificaConvergenza([{ x: 0, y: 0, width: LARGHEZZA, height: ALTEZZA }], "copre tutto");
    assert.deepStrictEqual(risultato, []);
});

test("configurazioni casuali da 1 a 8 ostacoli: mai piu' di ostacoli + 1 giri", () => {
    const casuale = generatore(7);
    for (let quanti = 1; quanti <= 8; quanti++) {
        for (let prova = 0; prova < 25; prova++) {
            verificaConvergenza(ostacoliCasuali(quanti, casuale), quanti + " ostacoli, prova " + prova);
        }
    }
});

/* ---- la guardia ---- */

//Se la regola che garantisce la fine viene rotta, il ciclo non deve girare a vuoto: si ferma
//al limite e lo dice. Per romperla servono due cose insieme, perche' refineRects la difende da
//se': un intersectRect che restituisce il rettangolo intatto, e un obstacleRefs che non
//riconosce mai l'ostacolo gia' visto.
test("se la convergenza viene rotta, la guardia ferma il ciclo e lo segnala", () => {
    const intersectRectVera = CssFramework.intersectRect;
    const includesVera = Array.prototype.includes;
    const ostacoli = [{ x: 40, y: 30, width: 20, height: 20 }, { x: 10, y: 10, width: 10, height: 10 }];
    const esito = {};
    try {
        CssFramework.intersectRect = (rect) => [{ ...rect }];
        Array.prototype.includes = () => false;
        CssFramework.refineRects(ostacoli, [{ x: 0, y: 0, width: 100, height: 80, direction: "sopra", obstacleRefs: [] }],
            LARGHEZZA, ALTEZZA, 0, esito);
    }
    finally {
        Array.prototype.includes = includesVera;
        CssFramework.intersectRect = intersectRectVera;
    }

    assert.strictEqual(esito.interrotto, true);
    assert.strictEqual(esito.iterazioni, ostacoli.length + 1);
});

test("esito e' facoltativo: senza, refineRects risponde come prima", () => {
    const ostacoli = [{ x: 40, y: 30, width: 20, height: 20 }];
    const candidati = CssFramework.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0);
    const risultato = CssFramework.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0);

    assert.ok(Array.isArray(risultato) && risultato.length > 0);
});

/* ---- il risultato non cambia ---- */

//La versione di refineRects di prima di I20-1011, ciclo compreso, con i suoi limiti. Sui box
//reali la guardia non scattava, quindi i rettangoli devono essere gli stessi.
function refineRectsPrima(obstacles, contours, boxWidth, boxHeight, tolerance = 0) {
    let currentRects = [...contours];
    let changed = true;
    let emergencycounter = 0;
    let emergencyLimit = 10000000;
    while (changed && emergencycounter < 1000 && currentRects.length < emergencyLimit) {
        changed = false;
        const newRects = [];
        for (const rect of currentRects) {
            let collided = false;
            for (const obs of obstacles) {
                if (rect.obstacleRefs.includes(obs)) continue;
                const collides =
                    rect.x < obs.x + obs.width &&
                    rect.x + rect.width > obs.x &&
                    rect.y < obs.y + obs.height &&
                    rect.y + rect.height > obs.y;
                if (collides) {
                    collided = true;
                    const inter = CssFramework.intersectRect(rect, obs, tolerance);
                    if (inter.length > 0) {
                        for (const r of inter) {
                            newRects.push({ ...r, direction: rect.direction, obstacleRefs: [...rect.obstacleRefs, obs] });
                        }
                        changed = true;
                    }
                }
            }
            if (!collided) {
                newRects.push(rect);
            }
        }
        currentRects = CssFramework.removeDuplicateRects(newRects);
        emergencycounter++;
    }
    let cleanedRects = CssFramework.removeDuplicateRects(currentRects);
    cleanedRects = CssFramework.removeRectsToSmall(cleanedRects, boxWidth / 4, boxHeight / 4);
    return CssFramework.reduceResult(cleanedRects);
}

function forma(rettangoli) {
    return rettangoli.map(r => [r.x, r.y, r.width, r.height, r.direction].join("|"));
}

test("sugli stessi dati i rettangoli sono quelli di prima", () => {
    const casuale = generatore(11);
    for (let quanti = 0; quanti <= 7; quanti++) {
        for (let prova = 0; prova < 15; prova++) {
            const ostacoli = ostacoliCasuali(quanti, casuale);
            const adesso = raffina(ostacoli).risultato;
            const prima = refineRectsPrima(ostacoli, CssFramework.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0), LARGHEZZA, ALTEZZA, 0);

            assert.deepStrictEqual(forma(adesso), forma(prima), quanti + " ostacoli, prova " + prova);
        }
    }
});

/* ---- chi chiama ---- */

//I20-1010: il calcolo dopo la ricerca della base sta in calcolaSpazioLibero, che
//getSpazioImpaginazione chiama.
test("getSpazioImpaginazione passa l'esito e avvisa con CSF-18 se il calcolo e' interrotto", () => {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "CssFramework.js"), "utf8").replace(/\r/g, "");
    const ingresso = testo.slice(testo.indexOf("    getSpazioImpaginazione(box) {"), testo.indexOf("    calcolaSpazioLibero(box, base, obs) {"));
    assert.match(ingresso, /return this\.calcolaSpazioLibero\(box, base, obs\);/);
    const inizio = testo.indexOf("    calcolaSpazioLibero(box, base, obs) {");
    const corpo = testo.slice(inizio, testo.indexOf("\n    },", inizio));

    assert.match(corpo, /this\.refineRects\(obs, candidate, baseWidth, baseHeight, 0, esito\)/);
    assert.match(corpo, /if \(esito\.interrotto\) \{[\s\S]*console\.warn\([\s\S]*messaggioUtente\("Code CSF-18: /);
});

test("il codice CSF-18 e' usato una volta sola in tutto il Plugin", () => {
    const cartella = path.join(__dirname, "..", "..", "plugin");
    let occorrenze = 0;
    for (const nome of fs.readdirSync(cartella).filter(n => n.endsWith(".js"))) {
        occorrenze += (fs.readFileSync(path.join(cartella, nome), "utf8").match(/\bCSF-0?18\b/g) || []).length;
    }
    assert.strictEqual(occorrenze, 1);
});
