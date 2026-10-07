/*
 * I20-1011: il raffinamento dello spazio per le foto finisce sempre, e se una guardia lo
 * ferma lo si viene a sapere.
 *
 * refineRects spezza ogni candidato sugli ostacoli che lo attraversano. Ogni pezzo porta in
 * obstacleRefs l'ostacolo che l'ha spezzato e su quello non viene piu' spezzato, quindi il
 * ciclo finisce in al piu' ostacoli + 1 giri: la guardia e' quel numero. Prima era a mille
 * giri, non poteva scattare, e se l'avesse fatto nessuno l'avrebbe saputo.
 *
 * I20-1060: ora refineRects toglie gli ostacoli uno alla volta e tiene i rettangoli liberi piu'
 * grandi: fa un giro per ostacolo e la guardia sta sul numero di rettangoli. I risultati sono
 * cambiati di proposito - prima lo spazio accanto a un ostacolo piccolo in un angolo non
 * nasceva mai - e si confrontano con un calcolo a forza bruta di tutti i rettangoli liberi
 * massimi della base.
 *
 * I20-1009: refineRects e le funzioni che usa stanno in plugin/sistemazioneFoto/spazioLibero.js,
 * che non tocca InDesign e si carica sotto Node cosi' com'e'. Prima stavano in CssFramework.js,
 * e questo test doveva sostituire il modulo indesign per poterlo caricare.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const spazioLibero = require("../../plugin/sistemazioneFoto/spazioLibero.js");

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
    const candidati = spazioLibero.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0);
    const esito = {};
    const risultato = spazioLibero.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0, esito);
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

test("senza ostacoli non c'e' nessun giro, e nessun candidato", () => {
    const { risultato, esito } = verificaConvergenza([], "nessun ostacolo");
    assert.strictEqual(esito.iterazioni, 0);
    assert.deepStrictEqual(risultato, []);
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

//I20-1060: il calcolo fa un giro per ostacolo e finisce sempre; la guardia sta sui rettangoli.
//Oltre limiteRettangoli si ferma dopo l'ostacolo che li ha fatti crescere, e lo dice.
test("oltre il limite di rettangoli il calcolo si ferma e lo segnala", () => {
    const limiteVero = spazioLibero.limiteRettangoli;
    const ostacoli = [{ x: 40, y: 30, width: 20, height: 20 }, { x: 10, y: 10, width: 10, height: 10 }];
    const esito = {};
    try {
        spazioLibero.limiteRettangoli = 1;
        spazioLibero.refineRects(ostacoli, [{ x: 0, y: 0, width: 100, height: 80, direction: "sopra", obstacleRefs: [] }],
            LARGHEZZA, ALTEZZA, 0, esito);
    }
    finally {
        spazioLibero.limiteRettangoli = limiteVero;
    }

    assert.strictEqual(esito.interrotto, true);
    assert.strictEqual(esito.iterazioni, 1);
});

test("con il limite vero i box reali non lo raggiungono", () => {
    const { esito } = raffina(ostacoliCasuali(8, generatore(3)));
    assert.strictEqual(esito.interrotto, false);
});

test("esito e' facoltativo: senza, refineRects risponde come prima", () => {
    const ostacoli = [{ x: 40, y: 30, width: 20, height: 20 }];
    const candidati = spazioLibero.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0);
    const risultato = spazioLibero.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0);

    assert.ok(Array.isArray(risultato) && risultato.length > 0);
});

/* ---- i rettangoli liberi massimi ---- */

const ZERO = [0, 0, 0, 0];
const EPS = 0.0001;

//Tutti i rettangoli liberi massimi della base, a forza bruta: i lati possibili sono i bordi
//della base e degli ostacoli; un rettangolo libero e' massimo se nessun lato si puo' spostare
//in fuori, perche' sta sul bordo della base o tocca un ostacolo.
function massimiAForzaBruta(ostacoli, larghezza, altezza) {
    const dentro = (v, max) => Math.min(Math.max(v, 0), max);
    const xs = [...new Set([0, larghezza, ...ostacoli.flatMap(o => [dentro(o.x, larghezza), dentro(o.x + o.width, larghezza)])])].sort((a, b) => a - b);
    const ys = [...new Set([0, altezza, ...ostacoli.flatMap(o => [dentro(o.y, altezza), dentro(o.y + o.height, altezza)])])].sort((a, b) => a - b);
    const libero = r => !ostacoli.some(o => siSovrappongono(r, o));
    const sovrapponeY = (o, r) => o.y < r.y + r.height - EPS && o.y + o.height > r.y + EPS;
    const sovrapponeX = (o, r) => o.x < r.x + r.width - EPS && o.x + o.width > r.x + EPS;
    const massimo = r =>
        (r.x <= EPS || ostacoli.some(o => o.x < r.x && o.x + o.width >= r.x - EPS && sovrapponeY(o, r))) &&
        (r.x + r.width >= larghezza - EPS || ostacoli.some(o => o.x + o.width > r.x + r.width && o.x <= r.x + r.width + EPS && sovrapponeY(o, r))) &&
        (r.y <= EPS || ostacoli.some(o => o.y < r.y && o.y + o.height >= r.y - EPS && sovrapponeX(o, r))) &&
        (r.y + r.height >= altezza - EPS || ostacoli.some(o => o.y + o.height > r.y + r.height && o.y <= r.y + r.height + EPS && sovrapponeX(o, r)));

    const trovati = [];
    for (let a = 0; a < xs.length; a++) {
        for (let b = a + 1; b < xs.length; b++) {
            for (let c = 0; c < ys.length; c++) {
                for (let d = c + 1; d < ys.length; d++) {
                    const r = { x: xs[a], y: ys[c], width: xs[b] - xs[a], height: ys[d] - ys[c] };
                    if (libero(r) && massimo(r)) {
                        trovati.push(r);
                    }
                }
            }
        }
    }
    return trovati;
}

function chiave(r) {
    return [r.x, r.y, r.width, r.height].map(v => v.toFixed(4)).join("|");
}

test("i candidati sono tutti e soli i rettangoli liberi massimi abbastanza grandi", () => {
    const casuale = generatore(11);
    for (let quanti = 1; quanti <= 7; quanti++) {
        for (let prova = 0; prova < 15; prova++) {
            const ostacoli = ostacoliCasuali(quanti, casuale);
            const candidati = spazioLibero.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0, ZERO);
            const trovati = spazioLibero.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0);
            const attesi = massimiAForzaBruta(ostacoli, LARGHEZZA, ALTEZZA)
                .filter(r => r.width > LARGHEZZA / 4 - EPS && r.height > ALTEZZA / 4 - EPS);

            assert.deepStrictEqual(trovati.map(chiave).sort(), attesi.map(chiave).sort(), quanti + " ostacoli, prova " + prova);
        }
    }
});

//Da solo l'ostacolo nell'angolo non basta: lo spazio alla sua destra si perdeva quando un altro
//ostacolo, piu' a destra, lo attraversava, come la colonna dei prezzi nel box Edro21.
test("un ostacolo piccolo nell'angolo lascia lo spazio alla sua destra alto quanto la base", () => {
    const ostacoli = [{ x: 0, y: 0, width: 10, height: 10 }, { x: 80, y: 10, width: 20, height: 30 }];
    const candidati = spazioLibero.generateCandidateRects(LARGHEZZA, ALTEZZA, ostacoli, 0, ZERO);
    const trovati = spazioLibero.refineRects(ostacoli, candidati, LARGHEZZA, ALTEZZA, 0).map(chiave);

    assert.ok(trovati.includes(chiave({ x: 10, y: 0, width: 70, height: 80 })), "manca lo spazio a destra dell'angolo: " + trovati);
    assert.ok(trovati.includes(chiave({ x: 0, y: 10, width: 80, height: 70 })), "manca lo spazio sotto l'angolo: " + trovati);
    assert.deepStrictEqual(trovati.length, 3, "nessun candidato contenuto in un altro: " + trovati);
});

//Gli ostacoli del BOX1 Edro21 della issue, in millimetri dalla base: un ovale 10x10 in alto a
//sinistra, i testi del Parmigiano in basso, la colonna dei prezzi a destra.
const BOX1_EDRO21 = [
    [0, 0, 10, 10], [29.1, 42.0, 69.7, 7.9], [2.8, 38.6, 26.2, 12.9], [103.7, 48.7, 27.0, 3.8],
    [114.0, 42.2, 16.7, 6.5], [105.1, 29.7, 25.6, 12.6], [122.9, 34.9, 7.8, 5.8], [105.1, 32.9, 4.5, 7.2],
    [109.9, 29.7, 12.7, 12.6], [122.6, 27.5, 8.0, 2.2], [111.7, 16.7, 19.3, 9.4], [104.7, 6.5, 26.0, 18.5]
].map(([x, y, width, height]) => ({ x, y, width, height }));

test("BOX1 Edro21: lo spazio a destra dell'ovale, fino ai testi del Parmigiano, e' fra i candidati", () => {
    const candidati = spazioLibero.generateCandidateRects(132.5, 54.2, BOX1_EDRO21, 0, ZERO);
    const esito = {};
    const trovati = spazioLibero.refineRects(BOX1_EDRO21, candidati, 132.5, 54.2, 0, esito);

    assert.ok(trovati.some(r => Math.abs(r.x - 10) < EPS && Math.abs(r.y) < EPS &&
        Math.abs(r.width - 94.7) < EPS && Math.abs(r.height - 38.6) < EPS),
        "manca 94.7x38.6 in x10 y0: " + trovati.map(chiave).join("; "));
    //Prima, a ostacoli tutti insieme, i rettangoli erano circa 900.
    assert.ok(esito.rettangoli < 200, esito.rettangoli + " rettangoli");
});

test("50 ostacoli restano sotto il limite e in tempi brevi", () => {
    const ostacoli = ostacoliCasuali(50, generatore(5));
    const inizio = Date.now();
    const { esito } = raffina(ostacoli);

    assert.strictEqual(esito.interrotto, false);
    assert.ok(esito.rettangoli < 5000, esito.rettangoli + " rettangoli");
    assert.ok(Date.now() - inizio < 2000, (Date.now() - inizio) + " ms");
});

/* ---- chi chiama ---- */

//I20-1010: il calcolo dopo la ricerca della base sta in calcolaSpazioLibero, che
//getSpazioImpaginazione chiama. I20-1009: tutti e due stanno in sistemazioneFoto.js.
test("getSpazioImpaginazione passa l'esito e avvisa con CSF-18 se il calcolo e' interrotto", () => {
    const testo = leggiFileDelPlugin("sistemazioneFoto/sistemazioneFoto.js").replace(/\r/g, "");
    const ingresso = testo.slice(testo.indexOf("    getSpazioImpaginazione(box) {"), testo.indexOf("    calcolaSpazioLibero(box, base, obs) {"));
    assert.match(ingresso, /return this\.calcolaSpazioLibero\(box, base, obs\);/);
    const inizio = testo.indexOf("    calcolaSpazioLibero(box, base, obs) {");
    const corpo = testo.slice(inizio, testo.indexOf("\n    },", inizio));

    assert.match(corpo, /spazioLibero\.refineRects\(obs, candidate, baseWidth, baseHeight, 0, esito\)/);
    assert.match(corpo, /if \(esito\.interrotto\) \{[\s\S]*console\.warn\([\s\S]*messaggioUtente\("Code CSF-18: /);
});

test("il codice CSF-18 e' usato una volta sola in tutto il Plugin", () => {
    let occorrenze = 0;
    for (const relativo of fileDelPlugin()) {
        occorrenze += (leggiFileDelPlugin(relativo).match(/\bCSF-0?18\b/g) || []).length;
    }
    assert.strictEqual(occorrenze, 1);
});
