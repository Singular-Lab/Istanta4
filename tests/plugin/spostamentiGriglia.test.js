/*
 * I20-1042: la segnalazione CSF-008, elemento spostato per rientrare nei limiti della griglia.
 *
 * fixOverflowFromBox gira molte volte per box - dopo il ridimensionamento e dopo ogni regola di
 * allineamento - e solo dopo arrivano il fix foto e le regole dopoFixFoto, che ricollocano gli
 * elementi. CSF-008 partiva subito, quindi parlava anche di posizioni intermedie: l'operatore
 * andava a vedere il box e non trovava niente. Ora lo spostamento si annota e si segnala a fine
 * box, solo se l'elemento e' rimasto dove la correzione l'ha messo, e la segnalazione va nel
 * bollino con il nome del box.
 *
 * Nello stesso giro: due dei quattro lati aggiornavano la mappa del box sull'asse sbagliato, e
 * un terzo calcolava lo spostamento dopo averlo fatto, cioe' zero.
 *
 * CssFramework.js si carica con un modulo indesign finto, come in spazioFotoRobusto.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

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

/* ---- l'ambiente finto ---- */

let messaggi = [];
let segnalazioni = [];

global.Utility = {
    parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]),
    eUnClone: () => false
};
global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
global.addSegnalazione = (testo, stile, priorita, bollino, impostazioni) => segnalazioni.push({ testo, stile, impostazioni });

let prossimoId = 1;

//Un elemento con le sue misure. move(undefined, [dx, dy]) sposta come in InDesign; le proprieta'
//di testo ci sono solo per le caselle di testo, che e' come isTextFrame le riconosce.
function elemento(label, bounds, testo = null) {
    let misure = [...bounds];
    return {
        id: prossimoId++,
        label,
        visible: true,
        isValid: true,
        parent: null,
        properties: testo == null ? {} : { parentStory: {}, textFramePreferences: {}, contents: "testo", overflows: testo.overflows },
        get geometricBounds() { return [...misure]; },
        set geometricBounds(nuovi) { misure = [...nuovi]; },
        move(_, [dx, dy]) { misure = [misure[0] + dy, misure[1] + dx, misure[2] + dy, misure[3] + dx]; }
    };
}

function box(label, elementi) {
    return {
        id: prossimoId++,
        label,
        pageItems: { length: elementi.length, item: (i) => elementi[i] },
        allPageItems: elementi
    };
}

//La griglia del box: 100 x 100 a partire dall'origine.
const GRIGLIA = [0, 0, 100, 100];

function azzera() {
    messaggi = [];
    segnalazioni = [];
    CssFramework.spostamentiGrigliaPendenti = null;
}

/* ---- quando si segnala ---- */

test("un elemento spostato e poi ricollocato non si segnala", () => {
    azzera();
    const foto = elemento("foto_secondaria$7086743", [60, 10, 105, 40]);
    const b = box("BOX1", [foto]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    assert.deepStrictEqual(foto.geometricBounds, [55, 10, 100, 40]);
    assert.deepStrictEqual(messaggi, [], "niente banner durante i passaggi intermedi");

    //il fix foto la mette altrove
    foto.move(undefined, [20, -30]);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(messaggi, []);
    assert.deepStrictEqual(segnalazioni, []);
});

test("un elemento rimasto dove la correzione l'ha messo si segnala, nel bollino e con il box", () => {
    azzera();
    const foto = elemento("foto_secondaria$7086743", [60, 10, 105, 40]);
    const b = box("BOX1", [foto]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(messaggi.length, 1);
    assert.strictEqual(messaggi[0].stile, "warning");
    assert.match(messaggi[0].testo, /^Code CSF-008: Elemento foto_secondaria nel box BOX1 spostato verso l'alto/);
    assert.strictEqual(segnalazioni.length, 1);
    assert.strictEqual(segnalazioni[0].testo, messaggi[0].testo);
    assert.strictEqual(segnalazioni[0].stile, "warning");
    assert.deepStrictEqual(segnalazioni[0].impostazioni, ["CSF-008", "orange"]);
});

test("lo stesso spostamento ripetuto in piu' passaggi si segnala una volta", () => {
    azzera();
    const prezzo = elemento("prezzo", [10, 90, 20, 104]);
    const b = box("BOX1", [prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    //una regola di allineamento lo rimanda fuori, il passaggio dopo lo riporta dentro
    prezzo.move(undefined, [3, 0]);
    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].testo, /spostato verso sinistra/);
});

test("le annotazioni si consumano: il controllo successivo non ripete la segnalazione", () => {
    azzera();
    const prezzo = elemento("prezzo", [-5, 10, 10, 20]);
    const b = box("BOX1", [prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].testo, /spostato verso il basso/);
});

test("sotto 1 mm l'elemento rientra ma non si segnala", () => {
    azzera();
    const logo = elemento("logo", [10, -0.5, 20, 10]);
    const b = box("BOX1", [logo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(logo.geometricBounds, [10, 0, 20, 10.5]);
    assert.deepStrictEqual(segnalazioni, []);
});

test("un elemento nascosto dopo lo spostamento non si segnala", () => {
    azzera();
    const logo = elemento("logo", [10, -5, 20, 10]);
    const b = box("BOX1", [logo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    logo.visible = false;
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni, []);
});

test("le annotazioni di un box interrotto non arrivano nel box successivo", () => {
    azzera();
    const fotoA = elemento("immagine", [-5, 10, 30, 40]);
    const boxA = box("MECCANICA", [fotoA]);
    CssFramework.fixOverflowFromBox(GRIGLIA, boxA);
    //qui l'impaginazione di A si interrompe: il controllo finale non arriva

    //un box con la stessa meccanica e un elemento che non esce
    const fotoB = elemento("immagine", [10, 10, 30, 40]);
    const boxB = box("MECCANICA", [fotoB]);
    CssFramework.fixOverflowFromBox(GRIGLIA, boxB);
    CssFramework.controllaSpostamentiGrigliaPendenti(boxB);

    assert.deepStrictEqual(segnalazioni, []);
});

/* ---- le caselle di testo ---- */

test("una casella di testo che si puo' stringere senza overflow non si sposta e non si segnala", () => {
    azzera();
    const descrizione = elemento("descrizione", [10, 50, 30, 110], { overflows: false });
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [10, 50, 30, 100]);
    assert.deepStrictEqual(segnalazioni, []);
});

test("una casella di testo che stretta andrebbe in overflow si sposta e si segnala", () => {
    azzera();
    const descrizione = elemento("descrizione", [10, 50, 30, 110], { overflows: true });
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [10, 40, 30, 100]);
    assert.ok(segnalazioni.some(s => /CSF-008: Elemento descrizione nel box BOX1 spostato verso sinistra/.test(s.testo)));
});

/* ---- la mappa del box ---- */

//Per ogni lato: dove sta l'elemento, di quanto si sposta, su quali indici della mappa.
const LATI = [
    { nome: "sopra", bounds: [-4, 10, 20, 30], movimento: 4, indici: [0, 2] },
    { nome: "sinistra", bounds: [10, -4, 20, 30], movimento: 4, indici: [1, 3] },
    { nome: "sotto", bounds: [80, 10, 104, 30], movimento: -4, indici: [0, 2] },
    { nome: "destra", bounds: [10, 70, 20, 104], movimento: -4, indici: [1, 3] }
];

for (const lato of LATI) {
    test("uscito da " + lato.nome + ": la mappa si aggiorna sull'asse dello spostamento", () => {
        azzera();
        const logo = elemento("logo", lato.bounds);
        const b = box("BOX1", [logo]);
        const mappa = { logo: { bounds: [10, 20, 30, 40] } };

        CssFramework.fixOverflowFromBox(GRIGLIA, b, mappa);

        const attesi = [10, 20, 30, 40];
        for (const indice of lato.indici) {
            attesi[indice] += lato.movimento;
        }
        assert.deepStrictEqual(mappa.logo.bounds, attesi);
    });
}

/* ---- dove si chiama ---- */

test("il controllo di fine box viene dopo il fix foto e le regole dopoFixFoto", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js");
    const inizio = indexNew.indexOf("async function callAllOperationFixBox(");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\nfunction ", inizio));

    const dopoFixFoto = corpo.indexOf("CssFramework.applicaOperazioniDopoFixFoto(");
    const controllo = corpo.indexOf("CssFramework.controllaSpostamentiGrigliaPendenti(boxImpaginato);");
    assert.ok(dopoFixFoto > 0);
    assert.ok(controllo > dopoFixFoto);
});

test("fixOverflowFromBox non manda piu' CSF-008 da se'", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js");
    const inizio = sorgente.indexOf("\n    fixOverflowFromBox(");
    const fine = sorgente.indexOf("\n    isTextFrame(", inizio);
    assert.ok(inizio > 0 && fine > inizio);
    assert.doesNotMatch(sorgente.substring(inizio, fine), /CSF-008/);
    assert.strictEqual((sorgente.match(/Code CSF-008/g) || []).length, 1);
});
