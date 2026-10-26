/*
 * I20-1069, gruppo 1: impaginazione e lista del kit mostrano il motivo che da' Istanta.
 *
 * Prima scaricaContenutoKit scriveva nel file listaKit qualunque risposta, anche quella d'errore:
 * il tracciato si svuotava e il motivo non lo vedeva nessuno. E IDX-30, IDX-39 e IDX-93 dicevano
 * "Errore di rete" anche quando Istanta aveva risposto spiegando il motivo, coprendo HRC-01.
 *
 * XMLHttpRequestClient si carica sotto Node; indexNew.js fa require('indesign') e non si carica:
 * per lui si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const XMLHttpRequestClient = require("../../plugin/XMLHttpRequestClient.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function tratto(testo, inizio, fine) {
    const da = testo.indexOf(inizio);
    assert.ok(da >= 0, "manca " + inizio);
    const a = testo.indexOf(fine, da + inizio.length);
    assert.ok(a > da, "manca " + fine + " dopo " + inizio);
    return testo.substring(da, a);
}

/* ---- il motivo di una richiesta fallita ---- */

test("errore di rete solo quando Istanta non ha risposto", () => {
    assert.strictEqual(XMLHttpRequestClient.testoErrore(0), "Istanta non risponde (errore di rete)");
    assert.strictEqual(XMLHttpRequestClient.testoErrore("0"), "Istanta non risponde (errore di rete)");
    assert.strictEqual(XMLHttpRequestClient.testoErrore(null), "Istanta non risponde (errore di rete)");
    assert.strictEqual(XMLHttpRequestClient.testoErrore(undefined), "Istanta non risponde (errore di rete)");
});

test("il motivo scritto dal server passa cosi' com'e'", () => {
    const motivo = "ImpaginaFromInDesignNew, lettura della sessione: la sessione di Istanta e' scaduta: rifare l'accesso al Plugin.";
    assert.strictEqual(XMLHttpRequestClient.testoErrore(motivo), motivo);
});

test("timeout e stato HTTP senza motivo si dicono per quello che sono", () => {
    assert.strictEqual(XMLHttpRequestClient.testoErrore("timeout"), "Istanta non ha risposto in tempo (timeout)");
    assert.strictEqual(XMLHttpRequestClient.testoErrore(500), "Istanta ha risposto con lo stato 500");
});

test("IDX-30, IDX-39 e IDX-93 mostrano il motivo, e nessuno dice piu' solo Errore di rete", () => {
    const indexNew = sorgente("indexNew.js");
    assert.match(indexNew, /xhrInProcess\.onerror = function \(motivo\) \{\s*messaggioUtente\("Code IDX-30 Filtro: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);
    assert.match(indexNew, /xhrInProcess\.onerror = function \(motivo\) \{\s*messaggioUtente\("Code IDX-39 Filtro: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);
    //Dal gruppo 2 l'onerror di IDX-93 segna anche la fine dell'attesa (finito = true) prima del messaggio.
    assert.match(indexNew, /xhr\.onerror = function \(motivo\) \{\s*(finito = true;\s*)?messaggioUtente\("Code IDX-93 Impaginazione singolo: richiesta non riuscita: " \+ XMLHttpRequestClient\.testoErrore\(motivo\), "error"\);/);
    assert.doesNotMatch(indexNew, /"Code IDX-(30|39|93) [^"]*Errore di rete"/);
});

/* ---- la lista del kit ---- */

test("una risposta d'errore non si salva come lista: si mostra il motivo e lo si dice a chi aspetta", () => {
    const scarica = tratto(sorgente("indexNew.js"), "function scaricaContenutoKit(", "function scaricaContenutoKitAsync(");
    const controllo = scarica.indexOf("if (objResult == null || objResult.esito === false) {");
    const scrittura = scarica.indexOf("fs.writeFileSync(filePath, JSON.stringify(objResult));");

    assert.ok(controllo > 0, "manca il controllo dell'esito");
    assert.ok(scrittura > controllo, "il file si scrive solo dopo il controllo");

    const ramoErrore = scarica.substring(controllo, scrittura);
    assert.match(ramoErrore, /messaggioUtente\("Code IDX-180 Lista del kit non scaricata, resta quella di prima: " \+ motivo, "error"\);/);
    assert.match(ramoErrore, /console\.error\("Dettaglio dell'errore del server:", objResult\.dettaglio\);/);
    assert.match(ramoErrore, /onErrore\(motivo\);\s*\}\s*return;/);
    //La lista di prima resta: in questo ramo non si scrive e non si rilegge niente.
    assert.doesNotMatch(ramoErrore, /writeFileSync|leggiContenutoKit/);
});

test("la lista arrivata con record non completati mostra l'avviso del server", () => {
    const scarica = tratto(sorgente("indexNew.js"), "function scaricaContenutoKit(", "function scaricaContenutoKitAsync(");
    assert.match(scarica, /if \(objResult\.warn\) \{\s*console\.warn\("Avviso del server sulla lista del kit:", objResult\.warn\);\s*messaggioUtente\("Code IDX-181 Lista del kit scaricata, ma con " \+ objResult\.warn, "warning"\);/);
});

/* ---- l'impaginazione ---- */

test("conteggio e impaginazione scrivono in console la traccia del server e mostrano l'avviso della lista", () => {
    const indexNew = sorgente("indexNew.js");
    for (const codice of ["IDX-25", "IDX-34"]) {
        const prima = new RegExp("if \\(objResult\\.dettaglio\\) \\{\\s*console\\.error\\(\"Dettaglio dell'errore del server:\", objResult\\.dettaglio\\);\\s*\\}\\s*messaggioUtente\\(\"Code " + codice + " ");
        assert.match(indexNew, prima, codice + " senza il dettaglio in console");
    }
    assert.match(indexNew, /messaggioUtente\("Code IDX-182 Filtro: la lista del kit ha " \+ objResult\.warn, "warning"\);/);
});
