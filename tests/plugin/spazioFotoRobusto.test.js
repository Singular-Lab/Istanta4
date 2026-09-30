/*
 * I20-1010: lo spazio per le foto non si rompe e non lascia il box toccato a meta'.
 *
 * Due cose. La base mancante: getSpazioImpaginazione e getObstacles la davano per scontata, e
 * senza base il Plugin si rompeva con un TypeError dopo aver gia' fatto il fit ai testi del
 * box. Ora si avvisa (CSF-19) e si ferma quel box soltanto.
 *
 * E il fit dei testi: getObstacles stringe i testi sul loro contenuto e fixFoto li rimette alle
 * misure di prima, ma solo se ci arriva. Un errore a meta', un'uscita anticipata di fixFoto,
 * un testo che prende il fit e non diventa ostacolo, due elementi con la stessa label: in tutti
 * questi casi un testo restava ristretto, o finiva alle misure di un altro. Ora torna sempre
 * com'era.
 *
 * CssFramework.js fa require('indesign') e sotto Node non si carica: qui il modulo e' sostituito
 * da uno stub che da' solo FitOptions, e il box e i suoi elementi sono finti.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { FitOptions: { FRAME_TO_CONTENT: "frameToContent", CONTENT_TO_FRAME: "contentToFrame" } };
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

/* ---- l'ambiente finto ---- */

let messaggi = [];
let segnalazioni = [];

global.customAgenzia = {};
global.Utility = {
    parseLabel: (label) => (label == null ? "" : String(label)),
    getDnaOfBox: () => ({ codice_gruppo: "4058817" })
};
global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
global.addSegnalazione = (testo, stile) => segnalazioni.push({ testo, stile });

let prossimoId = 1;

//Un elemento con le sue misure. geometricBounds si legge e si scrive come in InDesign: in
//lettura torna una copia, in scrittura sostituisce.
function elemento(label, bounds, altro = {}) {
    let misure = [...bounds];
    const el = {
        id: prossimoId++,
        label,
        constructorName: "Rectangle",
        isValid: true,
        get geometricBounds() { return [...misure]; },
        set geometricBounds(valore) { misure = [...valore]; }
    };
    return Object.assign(el, altro);
}

//Un testo il cui contenuto e' alto 5 meno del riquadro: il fit lo adatta al contenuto, e
//rifarlo non cambia niente, come in InDesign. Una riga sola, cosi' safeFitToContent non passa
//dal restringimento orizzontale, che qui non interessa.
function testo(label, bounds, altro = {}) {
    const altezzaContenuto = bounds[2] - bounds[0] - 5;
    const t = elemento(label, bounds, {
        constructorName: "TextFrame",
        overflows: false,
        rotationAngle: 0,
        fitFatti: 0,
        lines: { length: 1, item: () => ({ baseline: 10 }) },
        fit() {
            this.fitFatti++;
            const b = this.geometricBounds;
            this.geometricBounds = [b[0], b[1], b[0] + altezzaContenuto, b[3]];
        },
        move() {}
    });
    return Object.assign(t, altro);
}

function base() {
    return elemento("base", [0, 0, 80, 100]);
}

function box(elementi, label = "BOX1") {
    return {
        label,
        allPageItems: elementi,
        geometricBounds: [0, 0, 80, 100],
        rectangles: { length: 0, item: () => null }
    };
}

let controlliConflitti = [];
CssFramework.controllaSegnalazioniConflittiPendenti = function (b) {
    //Si fotografano le misure dei testi nel momento del controllo.
    controlliConflitti.push(b.allPageItems.filter(e => e.constructorName === "TextFrame").map(e => e.geometricBounds));
};

test.beforeEach(() => {
    messaggi = [];
    segnalazioni = [];
    controlliConflitti = [];
});

/* ---- la base ---- */

test("trovaBase trova la base anche se non e' il primo elemento", () => {
    const b = base();
    const scatola = box([testo("prezzo", [10, 10, 30, 40]), b]);

    assert.strictEqual(CssFramework.trovaBase(scatola), b);
});

test("trovaBase torna null se la base non c'e'", () => {
    assert.strictEqual(CssFramework.trovaBase(box([testo("prezzo", [10, 10, 30, 40])])), null);
});

test("senza base getSpazioImpaginazione avvisa una volta, torna spazio vuoto e non tocca i testi", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const scatola = box([prezzo, elemento("basetta_rinominata", [0, 0, 80, 100], { label: "sfondo" })], "BOX41");

    const risultato = CssFramework.getSpazioImpaginazione(scatola);

    assert.deepStrictEqual(risultato, { candidate: [], obstacles: [] });
    assert.strictEqual(prezzo.fitFatti, 0);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
    assert.strictEqual(messaggi.length, 1);
    assert.match(messaggi[0].testo, /^Code CSF-19: Nel box BOX41 con codice gruppo 4058817 manca la base/);
    assert.strictEqual(messaggi[0].stile, "warning");
    assert.strictEqual(segnalazioni.length, 1);
});

test("senza base getObstacles, chiamata da sola, avvisa e non trova ostacoli", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);

    assert.deepStrictEqual(CssFramework.getObstacles(box([prezzo])), []);
    assert.strictEqual(prezzo.fitFatti, 0);
    assert.match(messaggi[0].testo, /^Code CSF-19: /);
});

//Scelta A dell'operatore: si ferma quel box, non l'operazione. fixFoto con lo spazio vuoto
//non sposta niente e non si rompe.
test("lo spazio vuoto passato a fixFoto non rompe niente", () => {
    const scatola = box([testo("prezzo", [10, 10, 30, 40])]);
    const risultato = CssFramework.getSpazioImpaginazione(scatola);

    assert.doesNotThrow(() => CssFramework.fixFoto(scatola, risultato.candidate, risultato.obstacles));
});

/* ---- il fit torna sempre indietro ---- */

test("con la base, il percorso normale: il testo prende il fit e fixFoto lo rimette", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const scatola = box([base(), prezzo]);

    const risultato = CssFramework.getSpazioImpaginazione(scatola);

    assert.strictEqual(risultato.obstacles.length, 1);
    assert.ok(risultato.candidate.length > 0);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 25, 40], "durante il calcolo il testo e' stretto");

    CssFramework.fixFoto(scatola, risultato.candidate, risultato.obstacles);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
    assert.deepStrictEqual(messaggi, []);
});

test("un errore dentro safeFitToContent dopo il fit lascia il testo com'era", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40], { move() { throw new Error("move non riuscito"); } });

    assert.throws(() => CssFramework.safeFitToContent(prezzo), /move non riuscito/);
    assert.strictEqual(prezzo.fitFatti, 1);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
});

test("un errore a meta' di getObstacles rimette tutti i testi che avevano preso il fit", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const descrizione = testo("descrizione", [40, 10, 60, 90]);
    const guasto = elemento("marchio", [5, 60, 20, 90]);
    Object.defineProperty(guasto, "isValid", { get() { throw new Error("elemento non piu' valido"); } });
    const scatola = box([base(), prezzo, descrizione, guasto]);

    assert.throws(() => CssFramework.getObstacles(scatola), /elemento non piu' valido/);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
    assert.deepStrictEqual(descrizione.geometricBounds, [40, 10, 60, 90]);
});

test("un errore dopo getObstacles, nel raffinamento, rimette gli ostacoli", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const scatola = box([base(), prezzo]);
    const vera = CssFramework.refineRects;
    CssFramework.refineRects = () => { throw new Error("raffinamento rotto"); };
    try {
        assert.throws(() => CssFramework.getSpazioImpaginazione(scatola), /raffinamento rotto/);
    }
    finally {
        CssFramework.refineRects = vera;
    }
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
});

test("un testo senza label prende il fit ma non e' un ostacolo: torna subito com'era", () => {
    const anonimo = testo("", [10, 10, 30, 40]);
    const scatola = box([base(), anonimo]);

    const ostacoli = CssFramework.getObstacles(scatola);

    assert.strictEqual(anonimo.fitFatti, 1, "il primo ciclo lo stringe, il secondo lo scarta");
    assert.deepStrictEqual(ostacoli, []);
    assert.deepStrictEqual(anonimo.geometricBounds, [10, 10, 30, 40]);
});

test("due elementi con la stessa label tornano ciascuno alle proprie misure", () => {
    const primo = testo("prezzo", [10, 10, 30, 40]);
    const secondo = testo("prezzo", [45, 50, 70, 95]);
    const scatola = box([base(), primo, secondo]);

    const ostacoli = CssFramework.getObstacles(scatola);
    assert.strictEqual(ostacoli.length, 2);
    CssFramework.ripristinaOstacoli(ostacoli);

    assert.deepStrictEqual(primo.geometricBounds, [10, 10, 30, 40]);
    assert.deepStrictEqual(secondo.geometricBounds, [45, 50, 70, 95]);
});

test("fixFoto senza foto rimette i testi prima del controllo dei conflitti", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const scatola = box([base(), prezzo]);
    const risultato = CssFramework.getSpazioImpaginazione(scatola);

    const area = CssFramework.fixFoto(scatola, risultato.candidate, risultato.obstacles);

    assert.strictEqual(area, 0);
    assert.deepStrictEqual(controlliConflitti, [[[10, 10, 30, 40]]], "il controllo vede il testo alle misure vere");
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
});

test("se fixFoto va in errore i testi tornano comunque com'erano", () => {
    const prezzo = testo("prezzo", [10, 10, 30, 40]);
    const scatola = box([base(), prezzo]);
    const risultato = CssFramework.getSpazioImpaginazione(scatola);
    const vera = CssFramework.eseguiFixFoto;
    CssFramework.eseguiFixFoto = () => { throw new Error("fix foto rotto"); };
    try {
        assert.throws(() => CssFramework.fixFoto(scatola, risultato.candidate, risultato.obstacles), /fix foto rotto/);
    }
    finally {
        CssFramework.eseguiFixFoto = vera;
    }
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 30, 40]);
});

/* ---- nel sorgente ---- */

function sorgente() {
    return fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "CssFramework.js"), "utf8").replace(/\r/g, "");
}

test("la base si cerca in un punto solo", () => {
    const ricerche = sorgente().match(/startsWith\("base"\)/g) || [];
    assert.strictEqual(ricerche.length, 1);
});

test("nelle uscite anticipate di fixFoto il ripristino viene prima del controllo dei conflitti", () => {
    const testoFile = sorgente();
    const inizio = testoFile.indexOf("    eseguiFixFoto(box, candidateRects, obstacles, projection) {");
    const corpo = testoFile.slice(inizio, testoFile.indexOf("\n    },", inizio));
    const controlli = [...corpo.matchAll(/this\.controllaSegnalazioniConflittiPendenti\(box\)/g)].map(m => m.index);

    assert.ok(controlli.length >= 4);
    for (const posizione of controlli) {
        const prima = corpo.lastIndexOf("this.ripristinaOstacoli(obstacles);", posizione);
        const precedenteControllo = Math.max(...controlli.filter(c => c < posizione), -1);
        assert.ok(prima > precedenteControllo, "manca il ripristino prima del controllo alla posizione " + posizione);
    }
});

test("il messaggio CSF-19 e' scritto una volta sola in tutto il Plugin", () => {
    const cartella = path.join(__dirname, "..", "..", "plugin");
    let occorrenze = 0;
    for (const nome of fs.readdirSync(cartella).filter(n => n.endsWith(".js"))) {
        occorrenze += (fs.readFileSync(path.join(cartella, nome), "utf8").match(/"Code CSF-0?19\b/g) || []).length;
    }
    assert.strictEqual(occorrenze, 1);
});
