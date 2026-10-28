/*
 * Le date di inserimento e modifica delle foto nella pagina Archivio.
 *
 * Nei Dettagli di ogni articolo la foto di ogni ambito (generica e area/canale) mostra sotto il
 * nome quando e' stata inserita e modificata; la miniatura della lista le ha nel suggerimento. Le
 * scrive il server (Istanta.Utility.DateFoto, provata in DateFotoTests.cs); qui si prova che dopo
 * "Carica foto" la pagina le aggiorna con quelle che Archivio/caricaFotoManuale restituisce.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const Archivio = require('../../Istanta/wwwroot/js/archivio.js');

//Un elemento finto: tiene testo, attributi, classi e stile.
function elemento(attributi = {}) {
    const el = {
        testo: "", attributi: Object.assign({}, attributi), classi: new Set(), stile: {},
        text(t) { if (t === undefined) { return el.testo; } el.testo = t; return el; },
        attr(n, v) { if (v === undefined) { return el.attributi[n]; } el.attributi[n] = v; return el; },
        removeAttr(n) { delete el.attributi[n]; return el; },
        addClass(c) { c.split(" ").forEach(x => el.classi.add(x)); return el; },
        removeClass(c) { c.split(" ").forEach(x => el.classi.delete(x)); return el; },
        css() { return el; },
        hide() { return el; },
        show() { return el; },
        remove() { return el; },
        val() { return el; }
    };
    return el;
}

test("dopo Carica foto la riga mostra nome e date della foto nuova, e la miniatura della lista le ha nel suggerimento", () => {
    const nome = elemento();
    const date = elemento();
    date.testo = "Inserita il 01/01/2020 10:00";
    const contenuti = { ".foto-archivio-nome": nome, ".foto-archivio-date": date, ".foto-archivio-thumb": elemento(), ".foto-archivio-errore": elemento(), ".foto-archivio-badge-ereditata": elemento() };
    const wrapper = Object.assign(elemento({ "data-codice": "123", "data-id-articolo": "9", "data-area": "", "data-canale": "" }), {
        find: (sel) => contenuti[sel] || elemento()
    });
    const input = Object.assign(elemento(), { closest: () => wrapper });
    const miniatura = elemento();
    const badge = elemento();
    const riga = { find: (sel) => sel === "td:first img" ? miniatura : badge };

    let callback = null;
    const prima = { $: global.$, Call: global.Call, showLoading: global.showLoading, hideLoading: global.hideLoading };
    global.$ = () => riga;
    global.Call = { doWithUpload: (controller, azione, metodo, fd, sender, cb) => { callback = cb; } };
    global.showLoading = () => { };
    global.hideLoading = () => { };
    try {
        Archivio.prototype.caricaFotoManuale.call(Object.create(Archivio.prototype), input, { name: "123.psd" });
        callback({ esito: true, nomeReale: "123.psd", date: "Inserita il 28/10/2026 16:50", nFoto: 2, thumbnail: "http://olimpo/foto/getThumbNailOnDemand?width=88&guidId=g" });
    }
    finally {
        Object.assign(global, prima);
    }

    assert.strictEqual(nome.testo, "123.psd");
    assert.strictEqual(date.testo, "Inserita il 28/10/2026 16:50");
    assert.strictEqual(miniatura.attributi.title, "123.psd\nInserita il 28/10/2026 16:50");
});
