/*
 * I20-1206: impaginare il record appena clonato.
 *
 * Istanta salva il clone con il codice gruppo dei soli codici clonati. Un codice che nella promo
 * vecchia era in un gruppo di 17 diventava un singolo, ma il Plugin lo impaginava con il gruppo del
 * record d'origine: IDX-90, "Gruppo ... non trovato in PromoLavorazioniRecords". Ora Istanta
 * restituisce il codice gruppo del clone e il Plugin impagina con quello. Dopo un errore (SRF-28) il
 * Plugin non dice piu' "Clonazione completata con successo" e non propone di impaginare.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");

const schedaRef = require("../../plugin/schedaRef.js");
//Lo stesso modulo che schedaRef.js prende con require: la richiesta si finge sul suo send.
const XMLHttpRequestClient = require("../../plugin/XMLHttpRequestClient.js");

const GRUPPO_D_ORIGINE = "3351920,3353090,4576139,7858239";

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
async function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return await prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

/// Esegue clonaRecord dalla ricerca per codice (pagina "0") con la risposta di Istanta data, e
/// restituisce cosa e' successo: domande, impaginazioni, messaggi.
async function clonaConRisposta(risposta, confermaImpaginazione = true) {
    const fatto = { domande: [], impaginati: [], messaggi: [] };
    let onloadInCorso = null;

    const sendVero = XMLHttpRequestClient.prototype.send;
    XMLHttpRequestClient.prototype.send = function () { onloadInCorso = this.onload(risposta, true); };

    await conGlobali({
        XMLHttpRequest: class { },
        idKitLavorazione: 3232,
        indesignEvents: { setBusy() { } },
        showLoading() { },
        hideLoading() { },
        messaggioUtente(testo, tipo) { fatto.messaggi.push({ testo, tipo }); },
        Modali: {
            closeAllModal() { },
            async confirm(testo) { fatto.domande.push(testo); return confermaImpaginazione; },
        },
        async impaginaSingolo(codice) { fatto.impaginati.push(codice); },
        console: { log() { }, error() { }, warn() { } },
    }, async () => {
        try {
            await schedaRef.clonaRecord("V1", 12, "0", GRUPPO_D_ORIGINE, ["{}"]);
            await onloadInCorso;
        }
        finally {
            XMLHttpRequestClient.prototype.send = sendVero;
        }
    });

    return fatto;
}

/* ---- il codice gruppo ---- */

test("si impagina con il codice gruppo che Istanta ha dato al clone", () => {
    assert.strictEqual(schedaRef.codiceGruppoDelClone({ esito: true, codiceGruppo: "7858239" }, GRUPPO_D_ORIGINE), "7858239");
    assert.strictEqual(schedaRef.codiceGruppoDelClone({ codiceGruppo: " 7858239 " }, GRUPPO_D_ORIGINE), "7858239");
});

test("con un'Istanta che non restituisce il codice gruppo resta quello di prima", () => {
    assert.strictEqual(schedaRef.codiceGruppoDelClone({ esito: true }, GRUPPO_D_ORIGINE), GRUPPO_D_ORIGINE);
    assert.strictEqual(schedaRef.codiceGruppoDelClone({ codiceGruppo: null }, GRUPPO_D_ORIGINE), GRUPPO_D_ORIGINE);
    assert.strictEqual(schedaRef.codiceGruppoDelClone({ codiceGruppo: "  " }, GRUPPO_D_ORIGINE), GRUPPO_D_ORIGINE);
    assert.strictEqual(schedaRef.codiceGruppoDelClone(null, GRUPPO_D_ORIGINE), GRUPPO_D_ORIGINE);
});

/* ---- la clonazione dalla ricerca per codice ---- */

test("un codice che nella promo vecchia era in gruppo si impagina come singolo", async () => {
    const fatto = await clonaConRisposta({ esito: true, error: "", codiceGruppo: "7858239" });

    assert.strictEqual(fatto.domande.length, 1);
    assert.deepStrictEqual(fatto.impaginati, ["7858239"]);
    assert.deepStrictEqual(fatto.messaggi, []);
});

test("rispondendo no alla domanda non si impagina", async () => {
    const fatto = await clonaConRisposta({ esito: true, error: "", codiceGruppo: "7858239" }, false);

    assert.strictEqual(fatto.domande.length, 1);
    assert.deepStrictEqual(fatto.impaginati, []);
});

test("dopo un errore niente 'completata con successo' e niente impaginazione", async () => {
    const fatto = await clonaConRisposta({ esito: false, error: "Impossibile procedere, il codice7858239 che è stato cercato di clonare si trova già nel tracciato" });

    assert.deepStrictEqual(fatto.domande, []);
    assert.deepStrictEqual(fatto.impaginati, []);
    assert.strictEqual(fatto.messaggi.length, 1);
    assert.strictEqual(fatto.messaggi[0].tipo, "error");
    assert.ok(fatto.messaggi[0].testo.startsWith("Code SRF-28"));
});
