/*
 * I20-1109: il Fix referenza chiede prima di toccare il documento, e con Annulla non tocca niente.
 *
 * Prima fixRefImpaginata riportava il box alle dimensioni originali per leggere dove stavano gli
 * elementi interni, e lo rimetteva com'era, prima della domanda: l'operatore vedeva il box cambiare
 * e la domanda arrivare in ritardo. Dopo la domanda gli elementi interni si spostavano anche con
 * Annulla. La mappa delle posizioni si leggeva dalla selezione invece che dal box: selezionando un
 * elemento interno gli altri risultavano aggiunti illegalmente (IDX-45/46). Senza selezione si
 * finiva nell'errore generico IDX-50.
 *
 * indexNew.js fa require('indesign') e non si carica sotto Node: la funzione si prende dal sorgente
 * e si esegue con un InDesign finto che registra, in ordine, domanda, caricamento e modifiche.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function corpoDi(firma) {
    const inizio = indexNew.indexOf(firma);
    assert.ok(inizio >= 0, "manca " + firma);
    return indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio) + 2);
}

class Spread { }

//Un elemento di pagina: ogni cambio di dimensione o posizione finisce nel registro.
function elemento(registro, nome, bounds, proprieta = {}) {
    let attuali = bounds;
    return Object.assign({
        nome: nome,
        label: "",
        id: nome,
        get geometricBounds() { return attuali; },
        set geometricBounds(nuovi) { registro.push("modifica " + nome); attuali = nuovi; }
    }, proprieta);
}

//Un box di due elementi, allargato dall'operatore: originale 100x100, ora 100x150.
function scena(selezione, risposta) {
    const registro = [];
    const messaggi = [];
    const testo = elemento(registro, "testo", [10, 10, 40, 90], { label: "Descrizione" });
    const prezzo = elemento(registro, "prezzo", [50, 10, 90, 90], { id: 77 });
    const box = elemento(registro, "box", [0, 0, 100, 150], { parent: new Spread(), allPageItems: [testo, prezzo] });
    testo.parent = box;
    prezzo.parent = box;

    const ambiente = {
        app: { selection: selezione === "box" ? [box] : selezione === "interno" ? [testo] : [] },
        Utility: {
            getBoxFromElementOfBox: (el) => { let b = el; while (b.parent.constructor.name != "Spread") b = b.parent; return b; },
            getDnaOfBox: () => ({ codice_gruppo: "6322946", idRec: "10" }),
            parseLabel: (l) => l
        },
        schedaRef: {
            schedeRefDati: [{ recordInTracciato: { "Scatto.CodiceGruppo": "6322946", StatoSelezione: 1, idRec: 10 } }],
            refSelected: { boxOriginalBounds: [0, 0, 100, 100] }
        },
        getIdRecFromItemRef: (r) => r.idRec,
        Modali: { confirm: async () => { registro.push("domanda"); return risposta; } },
        indesignEvents: { setBusy: () => { } },
        showLoading: () => registro.push("caricamento"),
        hideLoading: () => registro.push("fine caricamento"),
        CssFramework: { richiediDiScaricareFramework: () => { } },
        getSchedaRefAsync: async () => { throw new Error("non serve: la scheda e' gia' aperta"); },
        Segnalazioni: { togliDalBox: (b) => b },
        callAllOperationFixBox: async (b, bounds) => { registro.push("rifacimento " + b.nome + " " + bounds.join(",")); return b; },
        finalizzaSegnalazioni: (r, c, b) => b,
        stampaSegnalazioni: () => { },
        messaggioUtente: (testoMessaggio) => messaggi.push(testoMessaggio),
        segnalazioniBoxImpaginato: [],
        securityCounter: 0,
        console: { error: () => { }, log: () => { } }
    };
    const nomi = Object.keys(ambiente);
    const fix = new Function(...nomi, corpoDi("async function fixRefImpaginata(") + "\nreturn fixRefImpaginata;")(...nomi.map(n => ambiente[n]));
    return { fix, registro, messaggi, box };
}

test("con Annulla il documento resta com'e': niente ridimensionamenti, niente spostamenti, niente rifacimento", async () => {
    const { fix, registro, messaggi, box } = scena("box", false);

    await fix();

    assert.deepStrictEqual(registro, ["domanda"]);
    assert.deepStrictEqual(box.geometricBounds, [0, 0, 100, 150]);
    assert.deepStrictEqual(messaggi, []);
});

test("la domanda arriva prima di qualunque modifica, poi il caricamento, poi il lavoro", async () => {
    const { fix, registro, messaggi, box } = scena("box", true);

    await fix();

    assert.strictEqual(registro[0], "domanda");
    assert.strictEqual(registro[1], "caricamento");
    //Il ridimensionamento di prova e il ripristino del box, gli elementi alle posizioni lette, il rifacimento.
    assert.deepStrictEqual(registro.slice(2), [
        "modifica box", "modifica box", "modifica testo", "modifica prezzo",
        "rifacimento box 0,0,100,150", "fine caricamento"
    ]);
    assert.deepStrictEqual(box.geometricBounds, [0, 0, 100, 150]);
    assert.deepStrictEqual(messaggi, ["Code IDX-49 fixRef: Operazione completata con successo"]);
});

test("selezionando un elemento interno si lavora sul box intero, senza falsi elementi aggiunti", async () => {
    const { fix, registro, messaggi } = scena("interno", true);

    await fix();

    assert.ok(!messaggi.some(m => /IDX-4[56]/.test(m)), "nessun IDX-45/46: " + messaggi.join(" | "));
    assert.ok(registro.includes("rifacimento box 0,0,100,150"));
    assert.deepStrictEqual(messaggi, ["Code IDX-49 fixRef: Operazione completata con successo"]);
});

test("senza selezione dice di selezionare un box e non tocca il documento", async () => {
    const { fix, registro, messaggi } = scena("niente", true);

    await fix();

    assert.deepStrictEqual(registro, []);
    assert.deepStrictEqual(messaggi, ["Code IDX-42 fixRef: nessun box selezionato, seleziona il box da sistemare"]);
});
