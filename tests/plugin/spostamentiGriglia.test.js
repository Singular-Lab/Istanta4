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

test("I20-1281: l'avviso escluso dal cliente non va nel riquadro dei messaggi, ma arriva comunque ad addSegnalazione", () => {
    azzera();
    const chiesti = [];
    //Il cliente esclude i loghi; addSegnalazione (qui finta) fa il suo filtro per il bollino.
    global.avvisoEsclusoDalCliente = (msg) => { chiesti.push(msg); return msg.includes("foto_extra"); };
    try {
        const logo = elemento("foto_extra$logo_senzalattosio$tipo_2", [10, -5, 30, 20]);
        const foto = elemento("foto_secondaria$7086743", [60, 10, 105, 40]);
        const b = box("BOX_STD", [logo, foto]);

        CssFramework.fixOverflowFromBox(GRIGLIA, b);
        CssFramework.controllaSpostamentiGrigliaPendenti(b);

        assert.strictEqual(chiesti.length, 2);
        assert.deepStrictEqual(messaggi.map(m => m.testo), segnalazioni.filter(s => !s.testo.includes("foto_extra")).map(s => s.testo));
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /^Code CSF-008: Elemento foto_secondaria nel box BOX_STD/);
        assert.strictEqual(segnalazioni.length, 2);
        assert.ok(segnalazioni.some(s => /^Code CSF-008: Elemento foto_extra nel box BOX_STD spostato verso destra/.test(s.testo)), JSON.stringify(segnalazioni));
    }
    finally {
        delete global.avvisoEsclusoDalCliente;
    }
});

test("I20-1281: se il controllo delle esclusioni fallisce, il riquadro mostra l'avviso come prima", () => {
    azzera();
    global.avvisoEsclusoDalCliente = () => { throw new Error("rotto"); };
    try {
        const foto = elemento("foto_secondaria$7086743", [60, 10, 105, 40]);
        const b = box("BOX1", [foto]);

        CssFramework.fixOverflowFromBox(GRIGLIA, b);
        CssFramework.controllaSpostamentiGrigliaPendenti(b);

        assert.strictEqual(messaggi.length, 1);
        assert.strictEqual(segnalazioni.length, 1);
    }
    finally {
        delete global.avvisoEsclusoDalCliente;
    }
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
    //I20-1235: la descrizione si segnala solo se finisce sopra un altro elemento: qui il prezzo.
    const prezzo = elemento("prezzo", [25, 45, 40, 60]);
    const b = box("BOX1", [descrizione, prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [10, 40, 30, 100]);
    assert.ok(segnalazioni.some(s => /CSF-008: Elemento descrizione nel box BOX1 spostato verso sinistra/.test(s.testo)));
});

/* ---- le caselle di testo dentro un gruppo ---- */

//Una casella di testo il cui testo, su una riga allineata a sinistra e senza margini interni, e'
//largo larghezzaTesto: va in overflow se il riquadro e' piu' stretto, come InDesign la vede dopo
//che il riquadro e' cambiato. Le righe dicono dove il testo comincia e finisce.
function casella(label, bounds, larghezzaTesto) {
    const c = elemento(label, bounds, { overflows: false });
    Object.defineProperty(c, "properties", {
        get() {
            const b = c.geometricBounds;
            return { parentStory: {}, textFramePreferences: {}, contents: "testo", overflows: b[3] - b[1] < larghezzaTesto };
        }
    });
    c.textFramePreferences = { insetSpacing: [0, 0, 0, 0] };
    c.lines = {
        everyItem: () => ({
            getElements: () => [{ horizontalOffset: c.geometricBounds[1], endHorizontalOffset: c.geometricBounds[1] + larghezzaTesto }]
        })
    };
    return c;
}

//Un gruppo InDesign: i bounds sono quelli dei figli, lo spostamento li sposta tutti.
function gruppo(label, figli) {
    return {
        id: prossimoId++,
        label,
        visible: true,
        isValid: true,
        properties: {},
        allPageItems: figli,
        get geometricBounds() {
            return [Math.min(...figli.map(f => f.geometricBounds[0])), Math.min(...figli.map(f => f.geometricBounds[1])),
                Math.max(...figli.map(f => f.geometricBounds[2])), Math.max(...figli.map(f => f.geometricBounds[3]))];
        },
        move(_, spostamento) { figli.forEach(f => f.move(undefined, spostamento)); }
    };
}

//Il caso del collaudo, PoP Coop: il prezzo cresciuto verso destra e "al kg" in una casella quasi
//vuota che esce dal box.
const BOX_PREZZO = [-10, 10, 410, 307];

test("un gruppo che rientra stringendo la casella quasi vuota non si sposta, non si rimpicciolisce e non si segnala", () => {
    azzera();
    const prezzo = casella("prezzo_promo", [48, 27.25, 141.75, 267.97], 240);
    const infoPack = casella("prezzo_info_pack", [121.14, 273.17, 141.75, 332.07], 20);
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [prezzo, infoPack])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(infoPack.geometricBounds, [121.14, 273.17, 141.75, 307]);
    assert.deepStrictEqual(prezzo.geometricBounds, [48, 27.25, 141.75, 267.97]);
    assert.strictEqual(prezzo.properties.overflows, false);
    assert.deepStrictEqual(messaggi, [], "niente CSF-009");
    assert.deepStrictEqual(segnalazioni, []);
});

test("una casella del gruppo che il suo testo riempie gia' torna com'era e il gruppo si sposta come prima", () => {
    azzera();
    //Un prezzo piu' corto, che lascia al gruppo lo spazio per rientrare spostandosi.
    const prezzo = casella("prezzo_promo", [48, 40, 141.75, 267.97], 220);
    const infoPack = casella("prezzo_info_pack", [121.14, 273.17, 141.75, 332.07], 58.8);
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [prezzo, infoPack])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    //Spostato di 25,07 mm verso sinistra, larghezze intatte.
    assert.ok(Math.abs(infoPack.geometricBounds[3] - 307) < 1e-9);
    assert.ok(Math.abs((infoPack.geometricBounds[3] - infoPack.geometricBounds[1]) - 58.9) < 1e-9);
    assert.ok(Math.abs(prezzo.geometricBounds[1] - (40 - 25.07)) < 1e-9);
    assert.ok(segnalazioni.some(s => /CSF-008: Elemento gruppo_prezzo nel box BOX_STD spostato verso sinistra/.test(s.testo)));
});

test("una casella che non entra fino al bordo si stringe fino alla fine del testo: il gruppo si sposta solo del resto", () => {
    azzera();
    //Il collaudo: "al kg" a corpo 50 e' largo 43,02 mm; fino al bordo ne restano 33,83. La casella
    //si stringe a 273,17 + 43,02 + 0,5 di respiro = 316,69 e il gruppo si sposta di 9,69 mm.
    const prezzo = casella("prezzo_promo", [48, 27.25, 141.75, 267.97], 240);
    const infoPack = casella("prezzo_info_pack", [121.14, 273.17, 141.75, 332.07], 43.02);
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [prezzo, infoPack])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.ok(Math.abs((infoPack.geometricBounds[3] - infoPack.geometricBounds[1]) - 43.52) < 1e-9);
    assert.ok(Math.abs(infoPack.geometricBounds[3] - 307) < 1e-9);
    assert.strictEqual(infoPack.properties.overflows, false);
    assert.ok(Math.abs(prezzo.geometricBounds[1] - (27.25 - 9.69)) < 1e-9);
    assert.ok(Math.abs((prezzo.geometricBounds[3] - prezzo.geometricBounds[1]) - (267.97 - 27.25)) < 1e-9);
    assert.strictEqual(prezzo.properties.overflows, false);
    assert.ok(!messaggi.some(m => /CSF-009/.test(m.testo)), "niente CSF-009");
    assert.ok(segnalazioni.some(s => /CSF-008: Elemento gruppo_prezzo nel box BOX_STD spostato verso sinistra/.test(s.testo)));
});

test("sui lati alto e basso la casella si stringe di quanto il testo consente e il gruppo si sposta del resto", () => {
    azzera();
    const infoPack = casella("prezzo_info_pack", [395, 273.17, 420, 300], 20);
    Object.defineProperty(infoPack, "properties", { get: () => ({ parentStory: {}, textFramePreferences: {}, contents: "testo", overflows: infoPack.geometricBounds[2] - infoPack.geometricBounds[0] < 20 }) });
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [infoPack])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);

    //Esce di 10 mm dal fondo: stretta fino a 410 andrebbe in overflow, ma alta 20 ci sta ancora.
    //Si stringe di 5, fino a 415, e il gruppo sale solo dei 5 che restano.
    assert.ok(Math.abs(infoPack.geometricBounds[0] - 390) < 1e-9);
    assert.ok(Math.abs(infoPack.geometricBounds[2] - 410) < 1e-9);
    assert.strictEqual(infoPack.properties.overflows, false);
});

test("la casella stretta resta stretta anche se non basta: lo spostamento si accorcia", () => {
    azzera();
    //Il kg si stringe fino a 307; il prezzo, che stretto andrebbe in overflow, esce di 8 mm: il
    //gruppo si sposta di 8 mm e non dei 33 che sporgeva il kg.
    const prezzo = casella("prezzo_promo", [48, 27.25, 141.75, 315], 287.75);
    const infoPack = casella("prezzo_info_pack", [121.14, 300, 141.75, 340], 5);
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [prezzo, infoPack])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);

    assert.ok(Math.abs(infoPack.geometricBounds[1] - 292) < 1e-9);
    assert.ok(Math.abs(infoPack.geometricBounds[3] - 299) < 1e-9);
    assert.ok(Math.abs(prezzo.geometricBounds[1] - 19.25) < 1e-9);
    assert.ok(Math.abs(prezzo.geometricBounds[3] - 307) < 1e-9);
    assert.strictEqual(prezzo.properties.overflows, false);
});

test("nel gruppo non si toccano le caselle invisibili, quelle dentro il box e quello che non e' testo", () => {
    azzera();
    const prezzo = casella("prezzo_promo", [48, 40, 141.75, 267.97], 10);
    const nascosta = casella("prezzo_info_pack", [121.14, 273.17, 141.75, 332.07], 10);
    nascosta.visible = false;
    const logo = elemento("logo", [100, 280, 120, 320]);
    const b = box("BOX_STD", [gruppo("gruppo_prezzo", [prezzo, nascosta, logo])]);

    CssFramework.fixOverflowFromBox(BOX_PREZZO, b);

    //Nessuna casella da stringere: il gruppo si sposta tutto, di 25,07 mm.
    assert.ok(Math.abs((prezzo.geometricBounds[3] - prezzo.geometricBounds[1]) - (267.97 - 40)) < 1e-9);
    assert.ok(Math.abs((nascosta.geometricBounds[3] - nascosta.geometricBounds[1]) - 58.9) < 1e-9);
    assert.ok(Math.abs((logo.geometricBounds[3] - logo.geometricBounds[1]) - 40) < 1e-9);
    assert.ok(Math.abs(nascosta.geometricBounds[3] - 307) < 1e-9);
});

test("un gruppo senza figli leggibili si sposta come prima", () => {
    azzera();
    const g = elemento("gruppo_prezzo", [10, 70, 20, 104]);
    g.allPageItems = undefined;
    const b = box("BOX1", [g]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);

    assert.deepStrictEqual(g.geometricBounds, [10, 66, 20, 100]);
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

/* ---- la riduzione parziale sui lati alto e basso ---- */

//Una casella di testo che va in overflow se e' piu' bassa di altezzaTesto: e' cosi' che InDesign
//la vede dopo che il bordo alto o basso e' cambiato.
function casellaAlta(label, bounds, altezzaTesto) {
    const c = elemento(label, bounds, { overflows: false });
    Object.defineProperty(c, "properties", {
        get() {
            const b = c.geometricBounds;
            return { parentStory: {}, textFramePreferences: {}, contents: "testo", overflows: b[2] - b[0] < altezzaTesto };
        }
    });
    return c;
}

test("dal lato alto una casella si stringe di quanto il testo consente e scende del resto", () => {
    azzera();
    //Alta 23 con il testo che ne occupa 15, sporge di 9.25 dal bordo alto.
    const descrizione = casellaAlta("descrizione", [-9.25, 50, 13.75, 80], 15);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);

    //Il bordo alto scende fin dove il testo resta senza overflow, con un quarto di millimetro di
    //tolleranza; la casella si sposta solo del resto e finisce sul bordo.
    assert.ok(Math.abs(descrizione.geometricBounds[0]) < 1e-9);
    const altezza = descrizione.geometricBounds[2] - descrizione.geometricBounds[0];
    assert.ok(altezza >= 15 && altezza < 15.25, "altezza " + altezza);
    assert.strictEqual(descrizione.properties.overflows, false);
});

test("se nessuna riduzione ci sta la casella torna com'era e si sposta tutta", () => {
    azzera();
    const descrizione = casellaAlta("descrizione", [-9.25, 50, 13.75, 80], 23);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);

    assert.deepStrictEqual(descrizione.geometricBounds, [0, 50, 23, 80]);
});

test("dopo il ridimensionamento le caselle non si stringono: si spostano intere, anche dentro un gruppo", () => {
    azzera();
    //La stessa descrizione che potrebbe stringersi di 8: con stringiCaselle false conserva i suoi
    //23 e scende di tutti i 9.25. Al collaudo veniva ridotta benche', composta la colonna, ci
    //sarebbe stata: quanto spazio ha un campo lo sanno solo gli allineamenti.
    const descrizione = casellaAlta("descrizione", [-9.25, 50, 13.75, 80], 15);
    const bis = elemento("BIS", [13.75, 70, 19.25, 80]);
    const b = box("BOX7", [gruppo("gruppo_descrizione_BIS", [descrizione, bis])]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b, null, null, false);

    assert.deepStrictEqual(descrizione.geometricBounds, [0, 50, 23, 80]);
    assert.deepStrictEqual(bis.geometricBounds, [23, 70, 28.5, 80]);
});

/* ---- chi si sposta con il responsabile: il gruppo di allineamento ---- */

function mappaDi(elementi) {
    const mappa = {};
    for (const el of elementi) {
        mappa[Utility.parseLabel(el.label)] = { item: el, label: Utility.parseLabel(el.label), bounds: el.geometricBounds, eliminato: false };
    }
    return mappa;
}

const LOGHI = [{ nomeGruppo: "Loghi", gruppoEtichette: ["logo*"] }];

test("con il responsabile si sposta intero il gruppo di allineamento, se resta dentro la griglia", () => {
    azzera();
    const logo1 = elemento("logo_bio", [-3, 10, 7, 30]);
    const logo2 = elemento("logo_igp", [10, 10, 20, 30]);
    const prezzo = elemento("prezzo", [80, 10, 95, 30]);
    const b = box("BOX1", [logo1, logo2, prezzo]);
    const mappa = mappaDi([logo1, logo2, prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b, mappa, LOGHI);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    //I due loghi scendono di 3 insieme, nella stessa disposizione; il prezzo non e' del gruppo.
    assert.deepStrictEqual(logo1.geometricBounds, [0, 10, 10, 30]);
    assert.deepStrictEqual(logo2.geometricBounds, [13, 10, 23, 30]);
    assert.deepStrictEqual(prezzo.geometricBounds, [80, 10, 95, 30]);
    //La mappa segue tutti e due.
    assert.deepStrictEqual(mappa.logo_bio.bounds, [0, 10, 10, 30]);
    assert.deepStrictEqual(mappa.logo_igp.bounds, [13, 10, 23, 30]);
    assert.deepStrictEqual(mappa.prezzo.bounds, [80, 10, 95, 30]);
    //Si segnala il solo responsabile.
    assert.strictEqual(segnalazioni.filter(s => /CSF-008/.test(s.testo)).length, 1);
    assert.ok(segnalazioni.some(s => /Elemento logo_bio nel box BOX1 spostato verso il basso/.test(s.testo)));
});

test("se il gruppo intero uscirebbe dal lato opposto si sposta il solo responsabile e l'ancora resta ferma", () => {
    azzera();
    const logo1 = elemento("logo_bio", [-3, 10, 7, 30]);
    const logo2 = elemento("logo_igp", [92, 10, 100, 30]);
    const b = box("BOX1", [logo1, logo2]);
    const mappa = mappaDi([logo1, logo2]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b, mappa, LOGHI);

    assert.deepStrictEqual(logo1.geometricBounds, [0, 10, 10, 30]);
    assert.deepStrictEqual(logo2.geometricBounds, [92, 10, 100, 30]);
    assert.deepStrictEqual(mappa.logo_igp.bounds, [92, 10, 100, 30]);
});

test("un gruppo di allineamento con il solo responsabile, o che non lo nomina, non cambia niente", () => {
    azzera();
    const logo1 = elemento("logo_bio", [-3, 10, 7, 30]);
    const prezzo = elemento("prezzo", [10, 10, 20, 30]);
    const b = box("BOX1", [logo1, prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b, null, [{ nomeGruppo: "Prezzi", gruppoEtichette: ["prezzo"] }, { nomeGruppo: "Loghi", gruppoEtichette: ["logo_bio"] }]);

    assert.deepStrictEqual(logo1.geometricBounds, [0, 10, 10, 30]);
    assert.deepStrictEqual(prezzo.geometricBounds, [10, 10, 20, 30]);
});

test("il BOX7 di Edro21: il gruppo InDesign scende intero, con il BIS sotto la descrizione, e Campi_DX resta fermo", () => {
    azzera();
    //I numeri del collaudo del 22 ottobre 2026, dopo lo spostamento lineare di -12: il gruppo
    //sporge dal bordo alto della cella di 9.25, la descrizione non si puo' stringere (il testo la
    //riempie), il campo sconto di Campi_DX sta gia' sul fondo della cella.
    const cella = [29, 10, 87, 73.67];
    const descrizione = casellaAlta("descrizione", [19.75, 41.67, 42.75, 73.67], 23);
    const bis = elemento("BIS", [42.75, 62.07, 48.25, 72.07]);
    const gruppoDescrizione = gruppo("gruppo_descrizione_BIS", [descrizione, bis]);
    const mMM = elemento("M_MM", [57.69, 41.67, 62.7, 73.67]);
    const sconto = elemento("campo_offerta_KgL_sconto", [82.7, 41.67, 87, 73.67]);
    const b = box("BOX7", [gruppoDescrizione, mMM, sconto]);
    const mappa = mappaDi([gruppoDescrizione, descrizione, bis, mMM, sconto]);
    const campiDX = [{ nomeGruppo: "Campi_DX", gruppoEtichette: ["gruppo_descrizione_BIS", "prezzo_offerta_gruppo", "campo_offerta_KgL_sconto", "LBL_Titolari", "M_MM", "PezzConf_NM"] }];

    CssFramework.fixOverflowFromBox(cella, b, mappa, campiDX);

    //Campi_DX intero uscirebbe dal fondo: scende il solo gruppo, descrizione e BIS insieme.
    assert.deepStrictEqual(descrizione.geometricBounds, [29, 41.67, 52, 73.67]);
    assert.deepStrictEqual(bis.geometricBounds, [52, 62.07, 57.5, 72.07]);
    assert.deepStrictEqual(mMM.geometricBounds, [57.69, 41.67, 62.7, 73.67]);
    assert.deepStrictEqual(sconto.geometricBounds, [82.7, 41.67, 87, 73.67]);
    //La mappa segue il gruppo e i suoi figli, non gli altri.
    assert.deepStrictEqual(mappa.gruppo_descrizione_BIS.bounds, [29, 41.67, 57.5, 73.67]);
    assert.deepStrictEqual(mappa.descrizione.bounds, [29, 41.67, 52, 73.67]);
    assert.deepStrictEqual(mappa.BIS.bounds, [52, 62.07, 57.5, 72.07]);
    assert.deepStrictEqual(mappa.M_MM.bounds, [57.69, 41.67, 62.7, 73.67]);
});

/* ---- i gruppi di allineamento del box ---- */

test("i gruppi del box vengono dalla gerarchia: quello del kit scavalca l'omonimo di default, l'ordine decide", () => {
    const DB = [
        { nomiBox: ["BOX7"], allineamenti: [{ nomeGruppo: "Campi_DX", ordine: 5, gruppoEtichette: ["gruppo_descrizione_BIS", "M_MM"], listSetCondizioni: null }] },
        { nomiBox: [], allineamenti: [
            { nomeGruppo: "Campi_DX", ordine: 1, gruppoEtichette: ["descrizione"], listSetCondizioni: null },
            { nomeGruppo: "Loghi", ordine: 2, gruppoEtichette: ["logo*"], listSetCondizioni: null }
        ] }
    ];
    const gruppi = CssFramework.gruppiDiAllineamentoDelBox({ label: "BOX7" }, {}, {}, DB, null);
    assert.deepStrictEqual(gruppi.map(g => g.nomeGruppo + ":" + g.gruppoEtichette.join(",")), ["Loghi:logo*", "Campi_DX:gruppo_descrizione_BIS,M_MM"]);
    //Senza regole per il box ne' un default non c'e' niente da spostare insieme.
    assert.strictEqual(CssFramework.gruppiDiAllineamentoDelBox({ label: "BOX9" }, {}, {}, [{ nomiBox: ["BOX7"], allineamenti: [] }], null), null);
});

test("allineamenti usa la stessa selezione e passa al rientro il gruppo appena composto", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r\n/g, "\n");
    const inizio = sorgente.indexOf("\n    allineamenti(");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
    assert.match(corpo, /var listAllineamenti = this\.gruppiDiAllineamentoDelBox\(box, mappaBoxOriginale, itemRef, DBallineamenti, DBDefault\) \|\| \[\];/);
    assert.strictEqual((corpo.match(/this\.fixOverflowFromBox\(boundsBoxImpaginato, box, mappaBoxOriginale, \[allineamentoSingolo\]\);/g) || []).length, 2);
    assert.doesNotMatch(corpo, /listAllineamenti\.push/);
});

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

/* ---- TASK-b4b2614f: chi una regola di allineamento riposiziona non si segnala ----
 * Il controllo di fine box segnala chi ha ancora i bounds della correzione. Nel BOX6 di Edro21
 * rect_etto e sy_etto, allargati dal ridimensionamento, rientravano sul bordo destro e basso e le
 * regole Rect_etto_All e sy_etto_All li ancoravano proprio li': stessi bounds, e tre CSF-008 su
 * elementi al loro posto. Ora una regola che posiziona un elemento su un asse toglie la sua
 * annotazione su quell'asse; se lo rimette fuori, il rientro che la segue lo annota di nuovo.
 */

//L'ancora di Rect_etto_All e sy_etto_All: bordo destro e bordo basso del box, a 0%.
const ANCORA_AL_BORDO = [{
    xAnchor: { distance: "0%", applyToSingleLevels: false, allineaAlLato: 1, allineaLato: 1 },
    yAnchor: { distance: "0%", applyToSingleLevels: false, allineaAlLato: 1, allineaLato: 1 },
    listSetCondizioni: null
}];

test("un elemento rientrato e poi ancorato dalla sua regola allo stesso bordo non si segnala", () => {
    azzera();
    //rect_etto allargato esce a destra; rientra sul bordo destro, gia' sul bordo basso.
    const rect = elemento("rect_etto", [85, 70, 100, 110]);
    const b = box("BOX6", [rect]);
    b.geometricBounds = [...GRIGLIA];

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    assert.deepStrictEqual(rect.geometricBounds, [85, 60, 100, 100]);

    //La regola lo ancora al bordo destro e basso: resta esattamente dov'e'.
    const assi = CssFramework.followStaticAnchor(b, [{ elementi: [{ item: rect }], livelloEliminato: false }], ANCORA_AL_BORDO, {}, {}, { x: false, y: false });
    assert.deepStrictEqual(assi, { x: true, y: true });
    assert.deepStrictEqual(rect.geometricBounds, [85, 60, 100, 100], "stessi bounds della correzione: e' il caso che segnalava");

    CssFramework.scartaSpostamentiRicollocati([{ item: rect }], assi, "Rect_etto_All");
    CssFramework.controllaSpostamentiGrigliaPendenti(b);
    assert.deepStrictEqual(messaggi, []);
    assert.deepStrictEqual(segnalazioni, []);
});

test("se la regola allinea solo l'altro asse lo spostamento resta da segnalare", () => {
    azzera();
    //sy_etto esce in basso e rientra verso l'alto; una regola lo allinea solo in orizzontale.
    const sy = elemento("sy_etto", [90, 40, 108, 60]);
    const b = box("BOX6", [sy]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.scartaSpostamentiRicollocati([{ item: sy }], { x: true, y: false }, "Solo_X");
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].testo, /^Code CSF-008: Elemento sy_etto nel box BOX6 spostato verso l'alto/);
});

test("se la regola rimette fuori l'elemento, il rientro successivo si segnala", () => {
    azzera();
    const rect = elemento("rect_etto", [85, 70, 100, 110]);
    const b = box("BOX6", [rect]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.scartaSpostamentiRicollocati([{ item: rect }], { x: true, y: true }, "Rect_etto_All");
    //la regola lo porta di nuovo fuori, e il rientro che la segue lo riporta dentro
    rect.move(undefined, [15, 0]);
    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].testo, /^Code CSF-008: Elemento rect_etto nel box BOX6 spostato verso sinistra/);
});

test("la regola toglie solo le annotazioni dei suoi elementi", () => {
    azzera();
    const rect = elemento("rect_etto", [85, 70, 100, 110]);
    const foto = elemento("immagine$1", [10, 80, 40, 115]);
    const b = box("BOX6", [rect, foto]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.scartaSpostamentiRicollocati([{ item: rect }], { x: true, y: true }, "Rect_etto_All");
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.length, 1);
    assert.match(segnalazioni[0].testo, /Elemento immagine nel box BOX6/);
    //Assi non dati, o nessuno allineato: niente da togliere.
    azzera();
    CssFramework.fixOverflowFromBox(GRIGLIA, box("BOX6", [elemento("rect_etto", [85, 70, 100, 110])]));
    CssFramework.scartaSpostamentiRicollocati([], { x: true, y: true });
    CssFramework.scartaSpostamentiRicollocati(null, true);
    assert.strictEqual(CssFramework.spostamentiGrigliaPendenti.spostamenti.length, 1);
});

test("allineamenti toglie le annotazioni dopo le ancore e prima del rientro della regola", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r\n/g, "\n");
    const inizio = sorgente.indexOf("\n    allineamenti(");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    //Ramo a livelli: dopo l'ancora statica, prima del fixOverflowFromBox della regola.
    const ancora = corpo.indexOf("allineamentiRiusciti = this.followStaticAnchor(");
    const scarto = corpo.indexOf("this.scartaSpostamentiRicollocati(gruppoElementi, allineamentiRiusciti, allineamentoSingolo.nomeGruppo);");
    const rientro = corpo.lastIndexOf("box = this.fixOverflowFromBox(boundsBoxImpaginato, box, mappaBoxOriginale, [allineamentoSingolo]);");
    assert.ok(ancora > 0 && scarto > ancora && rientro > scarto);

    //Ramo a slot: lo fa allineaASlot quando ha piazzato gli elementi, su tutti e due gli assi, e il
    //ciclo chiama il rientro della regola dopo di lei.
    const inizioSlot = sorgente.indexOf("\n    allineaASlot(");
    const slot = sorgente.substring(inizioSlot, sorgente.indexOf("\n    },\n", inizioSlot));
    assert.match(slot, /this\.scartaSpostamentiRicollocati\(gruppoElementi, \{ x: true, y: true \}, allineamento\.nomeGruppo\);\s*return true;\s*$/);
    assert.ok(corpo.indexOf("this.allineaASlot(") < corpo.indexOf("box = this.fixOverflowFromBox(boundsBoxImpaginato, box, mappaBoxOriginale, [allineamentoSingolo]);"));
});

/* ---- I20-1235: "Descrizione spostata" segue la regola di CSF-008 ---- */

const DESCRIZIONE_SPOSTATA = "Descrizione spostata poichè uscita dai limiti del box";

test("I20-1235: una descrizione ricollocata in verticale da una regola non lascia nessuna segnalazione", () => {
    azzera();
    //Nel CY Lazio la descrizione sporgeva dal bordo alto e il rientro la tirava giu'.
    const descrizione = elemento("descrizione", [-5, 50, 20, 100]);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    assert.deepStrictEqual(descrizione.geometricBounds, [0, 50, 25, 100]);
    assert.deepStrictEqual(segnalazioni, [], "niente durante i passaggi: prima \"Descrizione spostata\" si scriveva qui");

    //la regola di allineamento la posiziona in verticale, dentro il box
    CssFramework.scartaSpostamentiRicollocati([descrizione], { x: false, y: true }, "Descrizione_All");
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni, []);
    assert.deepStrictEqual(messaggi, []);
});

test("I20-1235: una descrizione rimasta forzata dopo piu' rientri ha \"Descrizione spostata\" e CSF-008, una volta ciascuna", () => {
    azzera();
    const chiavi = [];
    const originale = global.addSegnalazione;
    global.addSegnalazione = (testo, stile, priorita, bollino, impostazioni, key) => { chiavi.push(key || null); originale(testo, stile, priorita, bollino, impostazioni); };
    try {
        const descrizione = elemento("descrizione", [-5, 50, 20, 100]);
        //il logo su cui finisce la descrizione riportata dentro
        const logo = elemento("logo", [20, 60, 35, 70]);
        const b = box("BOX1", [descrizione, logo]);

        CssFramework.fixOverflowFromBox(GRIGLIA, b);
        //l'ultima regola la rimette oltre il bordo alto, e il rientro la riporta giu'
        descrizione.move(undefined, [0, -4]);
        CssFramework.scartaSpostamentiRicollocati([descrizione], { x: false, y: true }, "Descrizione_All");
        CssFramework.fixOverflowFromBox(GRIGLIA, b);
        assert.deepStrictEqual(segnalazioni, []);

        CssFramework.controllaSpostamentiGrigliaPendenti(b);

        assert.deepStrictEqual(segnalazioni.map(s => s.testo.startsWith("Code CSF-008") ? "CSF-008" : s.testo), [DESCRIZIONE_SPOSTATA, "CSF-008"]);
        assert.deepStrictEqual(segnalazioni[0].impostazioni, [DESCRIZIONE_SPOSTATA, "orange"]);
        assert.match(segnalazioni[1].testo, /Elemento descrizione nel box BOX1 spostato verso il basso/);
        //la stessa chiave di prima, che la tiene unica nel bollino
        assert.strictEqual(chiavi[0], "descrizione_spostata");
    }
    finally {
        global.addSegnalazione = originale;
    }
});

test("I20-1235: due spostamenti della descrizione rimasti a fine box danno un solo \"Descrizione spostata\"", () => {
    azzera();
    //Due annotazioni della descrizione nella sua posizione finale, verso il basso e verso sinistra, e il
    //logo sotto il testo. (Spostata su due lati nello stesso passaggio, la prima annotazione si scarta:
    //il secondo spostamento cambia la posizione.)
    const descrizione = elemento("descrizione", [0, 45, 25, 100]);
    const logo = elemento("logo", [20, 60, 35, 70]);
    const b = box("BOX1", [descrizione, logo]);
    const annotazione = (direzione) => ({ itemKey: String(descrizione.id), item: descrizione, label: "descrizione", direzione, bounds: descrizione.geometricBounds });
    CssFramework.spostamentiGrigliaPendenti = { boxKey: String(b.id), boxLabel: "BOX1", spostamenti: [annotazione("verso il basso"), annotazione("verso sinistra")] };

    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.strictEqual(segnalazioni.filter(s => s.testo === DESCRIZIONE_SPOSTATA).length, 1);
    assert.strictEqual(segnalazioni.filter(s => /^Code CSF-008/.test(s.testo)).length, 2);
});

test("I20-1235: un altro elemento spostato non porta \"Descrizione spostata\"", () => {
    azzera();
    const prezzo = elemento("prezzo", [-5, 10, 10, 20]);
    const b = box("BOX1", [prezzo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni.map(s => /^Code CSF-008/.test(s.testo)), [true]);
});

test("I20-1235: prima del ridimensionamento chi sporge rientra ma non si segnala", () => {
    azzera();
    const descrizione = elemento("descrizione", [-5, 50, 20, 100]);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b, null, null, true, false);
    assert.deepStrictEqual(descrizione.geometricBounds, [0, 50, 25, 100]);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni, []);
    assert.deepStrictEqual(messaggi, []);
});

test("I20-1235: il primo controllo di callAllOperationFixBox, prima del ridimensionamento, non annota", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const corpo = indexNew.substring(indexNew.indexOf("async function callAllOperationFixBox("), indexNew.indexOf("CssFramework.applicaRidimensionamentoCss("));
    assert.match(corpo, /CssFramework\.fixOverflowFromBox\(boxImpaginato\.geometricBounds, boxImpaginato, null, null, true, false\);/);
    const css = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");
    const fix = css.substring(css.indexOf("    fixOverflowFromBox("), css.indexOf("    isTextFrame(item) {"));
    assert.doesNotMatch(fix, /addSegnalazione\("Descrizione spostata/, "si scrive solo a fine box");
});

/* ---- I20-1235: per la descrizione decide il testo, non la casella ---- */

//Una casella con il testo appoggiato in basso, alto altezzaTesto, letto dalle righe come in InDesign
//(linea di base, ascendente, discendente). Come nel BOX1 del CY Lazio, InDesign la da' in overset
//appena la si accorcia: la riduzione non toglie niente.
function casellaConTestoInBasso(label, bounds, altezzaTesto) {
    const c = elemento(label, bounds, { overflows: false });
    const altezzaIniziale = bounds[2] - bounds[0];
    Object.defineProperty(c, "properties", {
        get() {
            const b = c.geometricBounds;
            return { parentStory: {}, textFramePreferences: {}, contents: "testo", overflows: b[2] - b[0] < altezzaIniziale - 1e-9 };
        }
    });
    c.textFramePreferences = { insetSpacing: [0, 0, 0, 0] };
    c.lines = {
        everyItem: () => ({
            getElements: () => {
                const b = c.geometricBounds;
                return [{ baseline: b[2] - 1, ascent: altezzaTesto - 1, descent: 1, horizontalOffset: b[1] + 1, endHorizontalOffset: b[3] - 1 }];
            }
        })
    };
    return c;
}

test("I20-1235: la casella della descrizione esce di 19 mm ma il testo e' dentro: non si sposta e non si segnala", () => {
    azzera();
    //42 mm di casella su una cella di 100, con 23 mm di testo in basso: il testo comincia a 0.
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 23);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [-19, 50, 23, 80]);
    //niente CSF-009 per la parte vuota: e la casella non e' stata rimpicciolita (non ha resize)
    assert.deepStrictEqual(messaggi, []);
    assert.deepStrictEqual(segnalazioni, []);
});

test("I20-1235: il testo della descrizione esce di 3 mm e finisce sul logo: si sposta di 3 e si segnala una volta", () => {
    azzera();
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 26);
    //come il CONAD del Golosi: il testo riportato dentro ci finisce sopra
    const logo = elemento("logo", [24, 60, 35, 70]);
    const b = box("BOX1", [descrizione, logo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [-16, 50, 26, 80]);
    assert.deepStrictEqual(segnalazioni.map(s => s.testo.startsWith("Code CSF-008") ? "CSF-008" : s.testo), [DESCRIZIONE_SPOSTATA, "CSF-008"]);
});

test("I20-1235: il testo della descrizione esce di mezzo millimetro: rientra ma non si segnala", () => {
    azzera();
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 23.5);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [-18.5, 50, 23.5, 80]);
    assert.deepStrictEqual(segnalazioni, []);
});

test("I20-1235: un'altra casella di testo si sposta ancora tutta, come prima", () => {
    azzera();
    const nome = casellaConTestoInBasso("nome_prodotto", [-19, 50, 23, 80], 23);
    const b = box("BOX1", [nome]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(nome.geometricBounds, [0, 50, 42, 80]);
    assert.deepStrictEqual(segnalazioni.map(s => /^Code CSF-008: Elemento nome_prodotto/.test(s.testo)), [true]);
});

test("I20-1235: senza righe leggibili la descrizione si comporta come prima", () => {
    azzera();
    const descrizione = elemento("descrizione", [-5, 50, 20, 100]);
    const b = box("BOX1", [descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);

    assert.deepStrictEqual(descrizione.geometricBounds, [0, 50, 25, 100]);
});

test("I20-1235: le righe si leggono anche dall'elemento generico che InDesign da' nell'elenco del box", () => {
    azzera();
    //box.pageItems.item(i) da' un elemento senza righe: le ha solo quello risolto con getElements().
    const vera = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 23);
    const generico = elemento("descrizione", [-19, 50, 23, 80], { overflows: false });
    Object.defineProperty(generico, "geometricBounds", { get: () => vera.geometricBounds, set: (b) => { vera.geometricBounds = b; } });
    Object.defineProperty(generico, "properties", { get: () => vera.properties });
    generico.move = (...a) => vera.move(...a);
    generico.getElements = () => [vera];
    const b = box("BOX1", [generico]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    //il testo e' dentro: niente spostamento e niente segnalazioni, come per la casella vera
    assert.deepStrictEqual(vera.geometricBounds, [-19, 50, 23, 80]);
    assert.deepStrictEqual(segnalazioni, []);
});

/* ---- I20-1235: la descrizione spostata si segnala solo se copre un altro elemento ---- */

test("I20-1235: descrizione spostata che non copre niente, come il CIF: nessuna segnalazione", () => {
    azzera();
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 26);
    //"Solo titolari" sotto il testo riportato dentro, che arriva a 26: un contatto di 0,05 mm non conta
    const titolari = elemento("LBL_Titolari", [25.95, 50, 32, 80]);
    const b = box("BOX1", [descrizione, titolari]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(descrizione.geometricBounds, [-16, 50, 26, 80], "lo spostamento c'e' comunque");
    assert.deepStrictEqual(segnalazioni, []);
    assert.deepStrictEqual(messaggi, []);
});

test("I20-1235: uno sfondo che contiene tutto il testo della descrizione non conta", () => {
    azzera();
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 26);
    const sfondo = elemento("sfondo", [0, 0, 100, 100]);
    const b = box("BOX1", [sfondo, descrizione]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni, []);
});

test("I20-1235: un elemento nascosto sotto la descrizione non conta", () => {
    azzera();
    const descrizione = casellaConTestoInBasso("descrizione", [-19, 50, 23, 80], 26);
    const logo = elemento("logo", [24, 60, 35, 70]);
    logo.visible = false;
    const b = box("BOX1", [descrizione, logo]);

    CssFramework.fixOverflowFromBox(GRIGLIA, b);
    CssFramework.controllaSpostamentiGrigliaPendenti(b);

    assert.deepStrictEqual(segnalazioni, []);
});

test("I20-1235: una descrizione con il testo appoggiato al bordo destro della cella non ha CSF-009", () => {
    azzera();
    //come il CIF: casella sul bordo destro della cella, testo allineato a destra fino al bordo della casella
    const descrizione = casellaConTestoInBasso("descrizione", [30, 50, 60, 100], 20);
    descrizione.lines = {
        everyItem: () => ({
            getElements: () => {
                const b = descrizione.geometricBounds;
                return [{ baseline: b[2] - 1, ascent: 19, descent: 1, horizontalOffset: b[1] + 5, endHorizontalOffset: b[3] }];
            }
        })
    };
    const b = box("BOX1", [descrizione]);

    //senza il limite della casella il mezzo millimetro di respiro portava il testo a 100,5: CSF-009, e
    //qui il rimpicciolimento chiamerebbe resize, che l'elemento finto non ha
    CssFramework.fixOverflowFromBox(GRIGLIA, b);

    assert.deepStrictEqual(messaggi, []);
    assert.deepStrictEqual(segnalazioni, []);
    assert.deepStrictEqual(CssFramework.boundsDelTesto(descrizione)[3], 100);
});

/* ---- I20-1244: CSF-009 non si segnala piu' ---- */

//Un elemento piu' grande della griglia: gli spostamenti non bastano e si rimpicciolisce. resize
//annota il fattore e scala attorno al centro, come CENTER_ANCHOR in InDesign.
function elementoRimpicciolibile(label, bounds) {
    const e = elemento(label, bounds);
    e.ridimensionamenti = [];
    e.resize = (spazio, ancora, metodo, [fx, fy]) => {
        e.ridimensionamenti.push([fx, fy]);
        const [y1, x1, y2, x2] = e.geometricBounds;
        const cy = (y1 + y2) / 2, cx = (x1 + x2) / 2, h = (y2 - y1) * fy / 2, w = (x2 - x1) * fx / 2;
        e.geometricBounds = [cy - h, cx - w, cy + h, cx + w];
    };
    return e;
}

function conCostantiResize(prova) {
    const prima = { CoordinateSpaces: global.CoordinateSpaces, AnchorPoint: global.AnchorPoint, ResizeMethods: global.ResizeMethods };
    global.CoordinateSpaces = { INNER_COORDINATES: "inner" };
    global.AnchorPoint = { CENTER_ANCHOR: "center" };
    global.ResizeMethods = { MULTIPLYING_CURRENT_DIMENSIONS_BY: "multiply" };
    try {
        prova();
    }
    finally {
        Object.assign(global, prima);
    }
}

test("I20-1244: la foto piu' grande della griglia si rimpicciolisce senza CSF-009", () => {
    conCostantiResize(() => {
        azzera();
        CssFramework.etichetteSegnalate = [];
        //come il minestrone del CY: la foto prodotto, prima del fix foto, sporge dalla cella
        const foto = elementoRimpicciolibile("immagine$2421798", [-10, 10, 110, 40]);
        const b = box("BOX41", [foto]);

        CssFramework.fixOverflowFromBox(GRIGLIA, b);

        assert.deepStrictEqual(foto.ridimensionamenti, [[100 / 120, 100 / 120]], "il rimpicciolimento resta");
        assert.ok(messaggi.every(m => !/CSF-009/.test(m.testo)), "niente CSF-009 nella console di Utility");
        assert.ok(segnalazioni.every(s => !/CSF-009/.test(s.testo)), "niente CSF-009 nel bollino");
    });
});

test("I20-1244: anche un testo o un logo troppo grandi si rimpiccioliscono senza CSF-009, una volta sola", () => {
    conCostantiResize(() => {
        azzera();
        CssFramework.etichetteSegnalate = [];
        const logo = elementoRimpicciolibile("logo_conad", [10, -20, 30, 130]);
        const b = box("BOX7", [logo]);

        CssFramework.fixOverflowFromBox(GRIGLIA, b);
        //un passaggio successivo dello stesso box non lo rimpicciolisce di nuovo
        CssFramework.fixOverflowFromBox(GRIGLIA, b);

        assert.strictEqual(logo.ridimensionamenti.length, 1);
        assert.deepStrictEqual(messaggi, []);
        assert.deepStrictEqual(segnalazioni, []);
    });
});

test("I20-1244: il codice non scrive piu' la CSF-009 ne' nel bollino ne' nella console", () => {
    const css = leggiFileDelPlugin("CssFramework.js");
    assert.doesNotMatch(css, /addSegnalazione\([^;]*CSF-009/);
    assert.doesNotMatch(css, /messaggioUtente\([^;]*CSF-009/);
});
