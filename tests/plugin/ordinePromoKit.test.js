/*
 * I20-1115: nel menu "Seleziona Kit" le ultime promo create stanno in alto.
 *
 * Tracciati/getPromoAperte restituisce le promo aperte senza ordine, e il Plugin le metteva nel menu
 * cosi' com'erano: le piu' vecchie in alto, e per arrivare alle ultime bisognava scorrere. Ora
 * FicoProcess.ordinaPromoPerKit le ordina per data di creazione in Istanta (dataRegistrazione), dalla
 * piu' recente; a parita' prima l'id piu' alto. Vale per tutti i clienti: ficoProcess.js e' codice
 * comune del Plugin. Il server non cambia, perche' lo stesso elenco serve alla pagina web delle promo.
 *
 * ficoProcess.js fa require('indesign'): la funzione si prende dal sorgente e si esegue sotto Node;
 * refreshPromo si esegue con jQuery finto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("ficoProcess.js").replace(/\r/g, "");

function membro(intestazione) {
    const inizio = sorgente.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return sorgente.substring(inizio + 4, fine + "\n    }".length);
}

//Un FicoProcess con le sole due funzioni di questo task, e i globali che usano.
function ficoCon(ambiente) {
    const nomi = Object.keys(ambiente);
    const corpo = "return {\n" + membro("ordinaPromoPerKit: function (lista) {") + ",\n" + membro("refreshPromo: async function () {") + "\n};";
    return new Function(...nomi, corpo)(...nomi.map(n => ambiente[n]));
}

const fico = ficoCon({ $: null, messaggioUtente: () => { }, console: console });

function promo(id, nome, data) {
    return { id: id, nomePromo: nome, guidID: "g" + id, dataRegistrazione: data };
}

test("le promo vanno dalla piu' recente alla meno recente per data di creazione", () => {
    const lista = [
        promo(10, "PE2617_18_MIPREMIO_13_08_26", "2026-07-20T09:00:00"),
        promo(31, "A2622_SC_16-10-26", "2026-10-01T10:00:00"),
        promo(40, "LP2623_LAZIO_05-11-26", "2026-10-15T08:30:00")
    ];
    assert.deepStrictEqual(fico.ordinaPromoPerKit(lista).map(p => p.nomePromo),
        ["LP2623_LAZIO_05-11-26", "A2622_SC_16-10-26", "PE2617_18_MIPREMIO_13_08_26"]);
});

test("a parita' di data viene prima quella creata dopo, cioe' con l'id piu' alto", () => {
    const stessa = "2026-10-01T10:00:00";
    const lista = [promo(31, "A2622_SC_16-10-26", stessa), promo(32, "A2622_SC_16-10-26_SOS", stessa)];
    assert.deepStrictEqual(fico.ordinaPromoPerKit(lista).map(p => p.id), [32, 31]);
});

test("le promo senza data vanno in fondo", () => {
    const lista = [promo(5, "senza data", null), promo(6, "con data", "2026-10-01T10:00:00"), promo(7, "data rotta", "non e' una data")];
    assert.deepStrictEqual(fico.ordinaPromoPerKit(lista).map(p => p.id), [6, 7, 5]);
});

test("si lavora su una copia, e una risposta che non e' un elenco da' un elenco vuoto", () => {
    const lista = [promo(1, "vecchia", "2026-01-01T00:00:00"), promo(2, "nuova", "2026-10-01T00:00:00")];
    fico.ordinaPromoPerKit(lista);
    assert.deepStrictEqual(lista.map(p => p.id), [1, 2]);
    assert.deepStrictEqual(fico.ordinaPromoPerKit("System.Exception: ..."), []);
    assert.deepStrictEqual(fico.ordinaPromoPerKit(null), []);
});

test("il menu Seleziona Kit si riempie con le promo ordinate, sotto \"Seleziona una promo\"", async () => {
    const voci = [];
    const menu = {
        empty: () => { voci.length = 0; },
        append: (html) => { voci.push(html); },
        off: () => menu,
        on: () => menu
    };
    const $ = () => ({ find: () => menu });
    const conMenu = ficoCon({ $: $, messaggioUtente: () => { }, console: console });
    conMenu.requestFicoData = async () => [
        promo(10, "PE2617_18_MIPREMIO_13_08_26", "2026-07-20T09:00:00"),
        promo(40, "LP2623_LAZIO_05-11-26", "2026-10-15T08:30:00")
    ];
    conMenu.refreshFormati = async () => { };

    await conMenu.refreshPromo();

    assert.match(voci[0], /Seleziona una promo/);
    assert.match(voci[1], /LP2623_LAZIO_05-11-26/);
    assert.match(voci[2], /PE2617_18_MIPREMIO_13_08_26/);
    assert.deepStrictEqual(conMenu.listaPromoAperte.map(p => p.id), [40, 10]);
});
