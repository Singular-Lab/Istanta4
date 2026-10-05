/*
 * I20-1043: la ricerca del tracciato mentre si scrive nel campo di testo del filtro.
 *
 * Partiva a ogni tasto, e ogni giro costava circa 1,1 s a pannello bloccato: 100 ms per la lista
 * degli impaginati chiesta al server, 300-400 ms per rileggere i bollini nel documento, il resto
 * per ridisegnare. Scrivendo a velocita' normale i giri si accodavano, fino a sei insieme, e la
 * lista si aggiornava secondi dopo (misurati in console durante I20-1043).
 *
 * Ora la ricerca parte quando l'operatore smette di scrivere, il risultato di una ricerca
 * superata non si disegna, e impaginati e bollini si riusano per qualche secondo.
 *
 * filtri.js si carica con un modulo indesign finto, come CssFramework.js in spazioFotoRobusto.
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
let filtri;
try {
    filtri = require("../../plugin/filtri.js");
}
finally {
    Module._load = caricaOriginale;
}
const Segnalazioni = require("../../plugin/segnalazioni/segnalazioni.js");

/* ---- un orologio finto ---- */

//setTimeout e clearTimeout a mano: avanza(ms) esegue i timer scaduti, nell'ordine.
function orologio() {
    let adesso = 0;
    let prossimo = 1;
    const timer = new Map();
    return {
        setTimeout(funzione, ritardo) {
            const id = prossimo++;
            timer.set(id, { quando: adesso + ritardo, funzione });
            return id;
        },
        clearTimeout(id) {
            timer.delete(id);
        },
        avanza(ms) {
            adesso += ms;
            for (const [id, t] of [...timer.entries()].sort((a, b) => a[1].quando - b[1].quando)) {
                if (t.quando <= adesso) {
                    timer.delete(id);
                    t.funzione();
                }
            }
        }
    };
}

/* ---- l'attesa ---- */

test("scrivendo di seguito parte una sola ricerca, alla pausa", () => {
    const tempo = orologio();
    const campo = {};
    const eseguite = [];

    filtri.programmaRicercaTesto(campo, () => eseguite.push("m"), tempo);
    tempo.avanza(100);
    filtri.programmaRicercaTesto(campo, () => eseguite.push("me"), tempo);
    tempo.avanza(100);
    filtri.programmaRicercaTesto(campo, () => eseguite.push("mel"), tempo);
    tempo.avanza(filtri.RITARDO_RICERCA_TESTO_MS - 1);
    assert.deepStrictEqual(eseguite, [], "prima della pausa non parte niente");

    tempo.avanza(1);
    assert.deepStrictEqual(eseguite, ["mel"]);
});

test("una ricerca superata mentre e' in corso non deve disegnare", () => {
    const tempo = orologio();
    const campo = {};
    let primaValida = null;

    filtri.programmaRicercaTesto(campo, (eAncoraValida) => { primaValida = eAncoraValida; }, tempo);
    tempo.avanza(filtri.RITARDO_RICERCA_TESTO_MS);
    assert.strictEqual(primaValida(), true, "finche' nessuno scrive e' l'ultima");

    //l'operatore scrive ancora mentre la prima aspetta il server
    filtri.programmaRicercaTesto(campo, () => {}, tempo);
    assert.strictEqual(primaValida(), false);
});

test("due campi diversi non si annullano a vicenda", () => {
    const tempo = orologio();
    const eseguite = [];

    filtri.programmaRicercaTesto({ nome: "a" }, () => eseguite.push("a"), tempo);
    filtri.programmaRicercaTesto({ nome: "b" }, () => eseguite.push("b"), tempo);
    tempo.avanza(filtri.RITARDO_RICERCA_TESTO_MS);

    assert.deepStrictEqual(eseguite.sort(), ["a", "b"]);
});

/* ---- gli impaginati ---- */

function impaginatiFinti(risposte) {
    const chiamate = [];
    global.Utility = {
        getListaCodiciImpaginati: async (opzioni) => {
            chiamate.push(opzioni);
            return risposte.length > 0 ? risposte.shift() : ["sempre"];
        }
    };
    filtri._impaginatiInMemoria = null;
    global.idKitLavorazione = 3227;
    return chiamate;
}

test("la lista degli impaginati si riusa per qualche secondo, poi si richiede", async () => {
    const chiamate = impaginatiFinti([["a"], ["b"]]);

    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1000), ["a"]);
    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1000 + filtri.RIUSO_IMPAGINATI_MS - 1), ["a"]);
    assert.strictEqual(chiamate.length, 1, "una sola richiesta al server dentro la finestra");

    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1000 + filtri.RIUSO_IMPAGINATI_MS), ["b"]);
    assert.strictEqual(chiamate.length, 2);
    assert.deepStrictEqual(chiamate[0], { nullSeFallisce: true });
});

test("cambiato il kit, la lista si richiede", async () => {
    const chiamate = impaginatiFinti([["kit 3227"], ["kit 4000"]]);

    await filtri.impaginatiPerRicerca(1000);
    global.idKitLavorazione = 4000;
    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1001), ["kit 4000"]);
    assert.strictEqual(chiamate.length, 2);
});

test("una richiesta fallita da' una lista vuota, come prima, e non si tiene", async () => {
    const chiamate = impaginatiFinti([null, ["arrivata"]]);

    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1000), []);
    assert.deepStrictEqual(await filtri.impaginatiPerRicerca(1001), ["arrivata"], "la ricerca dopo ci riprova");
    assert.strictEqual(chiamate.length, 2);
});

/* ---- i bollini ---- */

//Un documento senza pagine: leggiDocumento restituisce una lista vuota. Si conta quante volte
//lo si legge.
function letturaContata() {
    const vera = Segnalazioni.leggiDocumento;
    const conteggio = { letture: 0 };
    Segnalazioni.leggiDocumento = function (documento) {
        conteggio.letture++;
        return vera.call(Segnalazioni, documento);
    };
    conteggio.ripristina = () => { Segnalazioni.leggiDocumento = vera; };
    Segnalazioni.invalidaRiepilogoTracciato();
    return conteggio;
}

test("il riepilogo dei bollini si riusa per qualche secondo, poi si rilegge", () => {
    const conteggio = letturaContata();
    try {
        const documento = { id: 7, pages: [] };
        Segnalazioni.riepilogoTracciato(documento, 1000);
        Segnalazioni.riepilogoTracciato(documento, 1000 + Segnalazioni.RIUSO_RIEPILOGO_MS - 1);
        assert.strictEqual(conteggio.letture, 1);

        Segnalazioni.riepilogoTracciato(documento, 1000 + Segnalazioni.RIUSO_RIEPILOGO_MS);
        assert.strictEqual(conteggio.letture, 2);
    }
    finally {
        conteggio.ripristina();
    }
});

test("lo stesso documento letto da due oggetti diversi si riconosce dall'id", () => {
    const conteggio = letturaContata();
    try {
        Segnalazioni.riepilogoTracciato({ id: 7, pages: [] }, 1000);
        Segnalazioni.riepilogoTracciato({ id: 7, pages: [] }, 1001);
        assert.strictEqual(conteggio.letture, 1);

        Segnalazioni.riepilogoTracciato({ id: 8, pages: [] }, 1002);
        assert.strictEqual(conteggio.letture, 2, "un altro documento si legge");
    }
    finally {
        conteggio.ripristina();
    }
});

test("chi cambia i bollini invalida il riepilogo", () => {
    const conteggio = letturaContata();
    try {
        const documento = { id: 7, pages: [] };
        Segnalazioni.riepilogoTracciato(documento, 1000);

        //togliDalBox e' il passaggio di ogni scrittura: applicaAlBox, i due Risolvi, il box rifatto
        Segnalazioni.togliDalBox({ allPageItems: [], ovals: [] });
        Segnalazioni.riepilogoTracciato(documento, 1001);
        assert.strictEqual(conteggio.letture, 2);

        Segnalazioni.invalidaRiepilogoTracciato();
        Segnalazioni.riepilogoTracciato(documento, 1002);
        assert.strictEqual(conteggio.letture, 3);
    }
    finally {
        conteggio.ripristina();
    }
});

/* ---- dove si chiama ---- */

test("il campo di testo del filtro cerca alla pausa e non disegna una ricerca superata", () => {
    const sorgente = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
    const campo = sorgente.indexOf(".addClass('filtro-valore-hidden hideble')");
    assert.ok(campo > 0);
    const gestore = sorgente.substring(campo, sorgente.indexOf("$('<button></button>')", campo));

    assert.match(gestore, /me\.programmaRicercaTesto\(campo, async function \(eAncoraValida\) \{/);
    assert.match(gestore, /if\(isTracciato && eAncoraValida\(\)\)\{\s*await aggiornaTracciatoPostRicerca\(resRicerca\);/);
});

test("la ricerca riusa gli impaginati e il tracciato il riepilogo, la chiusura della schermata no", () => {
    const filtriJs = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
    const ricerca = filtriJs.substring(filtriJs.indexOf("    async ricercaFiltro(filtro){"));
    assert.match(ricerca, /let listImpaginati = await filtri\.impaginatiPerRicerca\(\);/);

    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indexNew, /function riepilogoSegnalazioniTracciato\(\) \{[\s\S]{0,400}?return Segnalazioni\.riepilogoTracciato\(documento\);/);
    assert.match(indexNew, /function aggiornaBadgeSegnalazioniTracciato\(\) \{\s*Segnalazioni\.invalidaRiepilogoTracciato\(\);\s*const riepilogo = riepilogoSegnalazioniTracciato\(\);/);
});
