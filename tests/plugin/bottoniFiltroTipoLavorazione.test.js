/*
 * I due bottoni grossi del pannello secondo il tipo di lavorazione.
 *
 * Nel volantino ci sono Conteggio, a sinistra, e Impagina, a destra. Nel PoP il bottone di destra
 * e' nascosto e quello di sinistra impagina: initDocumentInLavorazione lo chiamava Impagina, ma
 * alla fine di ogni operazione setFiltroButtonsDefaultMarkup rimetteva sempre Conteggio, e nel PoP
 * il bottone cambiava nome dopo ogni impaginazione. Ora la funzione guarda il tipo di lavorazione,
 * e initDocumentInLavorazione usa la stessa.
 *
 * La funzione si prende dal sorgente vero, come in overflowOrizzontaleAgganciato.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

//Una funzione di primo livello del sorgente, dalla firma alla graffa che la chiude.
function funzione(firma) {
    const inizio = sorgente.indexOf("\n" + firma);
    assert.notStrictEqual(inizio, -1, firma + " non trovata");
    let livello = 0;
    for (let i = sorgente.indexOf("{", inizio); i < sorgente.length; i++) {
        if (sorgente[i] === "{") { livello++; }
        else if (sorgente[i] === "}") { livello--; if (livello === 0) { return sorgente.substring(inizio + 1, i + 1); } }
    }
    throw new Error(firma + " senza fine");
}

const getFiltroButtonMarkup = new Function("return " + funzione("function getFiltroButtonMarkup(iconName, label) {"))();

//I bottoni dopo setFiltroButtonsDefaultMarkup, con il tipo di lavorazione dato.
function bottoniDopoIlRipristino(ficoProcess) {
    const bOpt1 = { innerHTML: "Elaborazione..." };
    const bOpt2 = { innerHTML: "Elaborazione..." };
    const ripristina = new Function("bOpt1", "bOpt2", "ficoProcess", "getFiltroButtonMarkup",
        "return " + funzione("function setFiltroButtonsDefaultMarkup() {"))(bOpt1, bOpt2, ficoProcess, getFiltroButtonMarkup);
    ripristina();
    return { sinistro: bOpt1.innerHTML, destro: bOpt2.innerHTML };
}

const lavorazione = (tipo) => ({ getTipoLavorazioneCorrente: () => tipo });

test("nel PoP il bottone di sinistra torna Impagina, non Conteggio", () => {
    const bottoni = bottoniDopoIlRipristino(lavorazione(2));

    assert.strictEqual(bottoni.sinistro, getFiltroButtonMarkup("impagina.png", "Impagina"));
    assert.doesNotMatch(bottoni.sinistro, /Conteggio/);
});

test("nel volantino i bottoni tornano Conteggio e Impagina", () => {
    const bottoni = bottoniDopoIlRipristino(lavorazione(1));

    assert.strictEqual(bottoni.sinistro, getFiltroButtonMarkup("conteggio.png", "Conteggio"));
    assert.strictEqual(bottoni.destro, getFiltroButtonMarkup("impagina.png", "Impagina"));
});

test("se il tipo di lavorazione non si legge, i bottoni sono quelli del volantino", () => {
    const bottoni = bottoniDopoIlRipristino({ getTipoLavorazioneCorrente: () => { throw new Error("nessuna lavorazione"); } });

    assert.strictEqual(bottoni.sinistro, getFiltroButtonMarkup("conteggio.png", "Conteggio"));
});

test("initDocumentInLavorazione usa la stessa funzione e non scrive piu' le etichette per conto suo", () => {
    const corpo = funzione("async function initDocumentInLavorazione()");

    assert.match(corpo, /setFiltroButtonsDefaultMarkup\(\);/);
    assert.doesNotMatch(corpo, /#bOpt1Advanced"\)\.html\(/);
    //Dopo lo show/hide dei bottoni per il tipo di lavorazione.
    assert.ok(corpo.indexOf("setFiltroButtonsDefaultMarkup();") > corpo.indexOf('$("#bOpt2Advanced").show();'));
});
