/*
 * I20-1206: l'icona di copia accanto al codice nel revisore.
 *
 * La copia usava solo navigator.clipboard, che il browser da' alle pagine https o di localhost.
 * Istanta si apre in http (anche con un numero IP): li' navigator.clipboard non c'e', il clic andava
 * in errore prima di cambiare l'icona e non si copiava niente, in locale e in produzione. Ora, senza
 * navigator.clipboard o se rifiuta, si copia da un campo nascosto con il comando "copia" del browser.
 * L'icona diventa la spunta solo se la copia e' riuscita.
 *
 * revisore.js si carica sotto Node (module.exports); navigator e document sono finti.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");

/// Un document con il comando "copia": ricorda cosa e' stato selezionato e copiato.
function documentFinto(copiaRiesce = true) {
    const fatto = { copiato: null, campiRimasti: 0 };
    const body = {
        figli: [],
        appendChild(el) { this.figli.push(el); },
        removeChild(el) { this.figli = this.figli.filter(f => f !== el); },
    };
    let selezionato = null;
    const doc = {
        body,
        createElement() {
            const el = { value: "", style: {}, setAttribute() { }, select() { selezionato = el; } };
            return el;
        },
        execCommand(comando) {
            if (comando !== "copy" || !copiaRiesce) return false;
            fatto.copiato = selezionato ? selezionato.value : null;
            return true;
        },
    };
    fatto.doc = doc;
    Object.defineProperty(fatto, "campiRimasti", { get: () => body.figli.length });
    return fatto;
}

test("pagina https: si copia con navigator.clipboard", async () => {
    const scritti = [];
    const nav = { clipboard: { writeText: async (t) => { scritti.push(t); } } };
    const doc = documentFinto();

    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", nav, doc.doc), true);
    assert.deepStrictEqual(scritti, ["7858239"]);
    assert.strictEqual(doc.copiato, null);
});

test("pagina http senza navigator.clipboard: si copia dal campo nascosto, che poi sparisce", async () => {
    const doc = documentFinto();

    assert.strictEqual(await Revisore.copiaNegliAppunti("3351920,3353090,4576139", {}, doc.doc), true);
    assert.strictEqual(doc.copiato, "3351920,3353090,4576139");
    assert.strictEqual(doc.campiRimasti, 0);

    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", undefined, doc.doc), true);
    assert.strictEqual(doc.copiato, "7858239");
});

test("navigator.clipboard che rifiuta o va in errore: si ripiega sul campo nascosto", async () => {
    const rifiuta = { clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) } };
    const doc = documentFinto();
    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", rifiuta, doc.doc), true);
    assert.strictEqual(doc.copiato, "7858239");

    const lancia = { clipboard: { writeText: () => { throw new Error("x"); } } };
    const doc2 = documentFinto();
    assert.strictEqual(await Revisore.copiaNegliAppunti("2950653", lancia, doc2.doc), true);
    assert.strictEqual(doc2.copiato, "2950653");
});

test("copia impossibile: l'esito e' non riuscita, cosi' niente spunta", async () => {
    const doc = documentFinto(false);
    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", {}, doc.doc), false);
    assert.strictEqual(doc.campiRimasti, 0);

    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", {}, null), false);
    assert.strictEqual(await Revisore.copiaNegliAppunti("7858239", {}, { body: {} }), false);
});

test("l'icona: spunta solo se copiato, altrimenti l'avviso", async () => {
    const classi = new Set(["fas", "fa-copy"]);
    const icona = {
        closest() { return { attr: () => "false", find: () => ({ text: () => "6210007" }) }; },
        removeClass(c) { classi.delete(c); return this; },
        addClass(c) { classi.add(c); return this; },
    };
    const avvisi = [];
    const salvati = { alert: global.alert, setTimeout: global.setTimeout };
    global.alert = (m) => avvisi.push(m);
    global.setTimeout = () => 0;
    try {
        const riuscita = Object.create(Revisore.prototype);
        riuscita.copyToClipboard = () => Promise.resolve(true);
        riuscita.copyCodice(icona);
        await new Promise(r => setImmediate(r));
        assert.ok(classi.has("fa-check"));
        assert.deepStrictEqual(avvisi, []);

        classi.clear(); classi.add("fa-copy");
        const fallita = Object.create(Revisore.prototype);
        fallita.copyToClipboard = () => Promise.resolve(false);
        fallita.copyCodice(icona);
        await new Promise(r => setImmediate(r));
        assert.ok(!classi.has("fa-check"));
        assert.strictEqual(avvisi.length, 1);
        assert.ok(avvisi[0].includes("6210007"));
    }
    finally {
        global.alert = salvati.alert;
        global.setTimeout = salvati.setTimeout;
    }
});
