/*
 * Foto extra nella sincronizzazione delle foto.
 *
 * L'impaginazione piazza le foto extra di una ref (loghi, bollini, ambientate caricati sulla ref)
 * dalla cartella Loghi, ma la sincronizzazione scaricava solo le foto del prodotto, in Links, e
 * l'archivio Loghi/Bolli. Ora il server da' anche le foto extra, col loro tipo, e il pacchetto
 * completo (modo 0) e la lista di codici (modo 2) le scaricano in Loghi prima delle foto. La sync
 * loghi (modo 1), l'unica che parte prima di un'impaginazione massiva senza pacchetto completo,
 * passa la lavorazione aperta e il server le aggiunge all'archivio Loghi/Bolli.
 *
 * dividiPacchettoPerCartella e' pura e si prova qui: reperimentoFoto.js si carica sotto Node
 * togliendo di mezzo require('indesign'). Lo scaricamento parla con il disco e si prova sul sorgente.
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
let ReperimentoFoto;
try {
    ReperimentoFoto = require("../../plugin/reperimentoFoto/reperimentoFoto.js");
}
finally {
    Module._load = caricaOriginale;
}

/* ---- la divisione per cartella ---- */

test("le foto extra vanno in Loghi, le foto del prodotto in Links", () => {
    const prodotto = { id: "g1", fileName: "123.psd", tipo: 0 };
    const vecchia = { id: "g2", fileName: "456.psd" };
    const conTipoFoto = { id: "g3", fileName: "789.psd", tipo: 1 };
    const logo = { id: "g4", fileName: "logo_cliente.ai", tipo: 3 };
    const bollino = { id: "g5", fileName: "bollino.psd", tipo: 2 };
    const ambientata = { id: "g6", fileName: "ambientata.jpg", tipo: 4 };

    const pacchetto = ReperimentoFoto.dividiPacchettoPerCartella([prodotto, vecchia, logo, null, conTipoFoto, bollino, ambientata]);

    assert.deepStrictEqual(pacchetto.foto, [prodotto, vecchia, conTipoFoto]);
    assert.deepStrictEqual(pacchetto.extra, [logo, bollino, ambientata]);
});

test("senza foto extra, come da un server che non le manda, resta tutto in Links", () => {
    const lista = [{ id: "g1", fileName: "123.psd", tipo: 0 }, { id: "g2", fileName: "456.psd", tipo: 0 }];

    assert.deepStrictEqual(ReperimentoFoto.dividiPacchettoPerCartella(lista), { foto: lista, extra: [] });
});

test("una risposta che non e' una lista resta intera fra le foto, e fallisce come prima", () => {
    const errore = { esito: false, error: "Olimpo non risponde" };

    assert.deepStrictEqual(ReperimentoFoto.dividiPacchettoPerCartella(errore), { foto: errore, extra: [] });
    assert.deepStrictEqual(ReperimentoFoto.dividiPacchettoPerCartella(null), { foto: null, extra: [] });
});

/* ---- dove si applica ---- */

function sorgente() {
    return leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
}

test("le foto extra si scaricano nella cartella Loghi, senza dare la fine dell'operazione", () => {
    const testo = sorgente();
    const inizio = testo.indexOf("    async scaricaFotoExtraNeiLoghi(");
    const corpo = testo.substring(inizio, testo.indexOf("\n    },", inizio));

    assert.ok(inizio > 0, "manca scaricaFotoExtraNeiLoghi");
    assert.match(corpo, /fs2\.getEntryWithUrl\("file:\/\/" \+ \/\*pathLavorazione \+\*\/ percorsoLoghi\)/);
    assert.match(corpo, /onComplete: null/);
    assert.match(corpo, /annullata = true;/);
    assert.match(corpo, /await scaricamentoFoto\.downloadImages\(extra, processoExtra, cartellaLoghi, idOperazione\);/);
});

test("pacchetto completo e lista di codici: prima le foto extra in Loghi, le foto solo se non annullato", () => {
    const testo = sorgente();
    const casi = [
        ["pacchetto", "data", "codiceSyncFoto"],
        ["pacchettoCodici", "data.lista", "codiceSyncFotoMode2"]
    ];

    for (const [variabile, risposta, codice] of casi) {
        const divisione = testo.indexOf("var " + variabile + " = ReperimentoFoto.dividiPacchettoPerCartella(" + risposta + ");");
        const extra = testo.indexOf("if (!await ReperimentoFoto.scaricaFotoExtraNeiLoghi(" + variabile + ".extra, objProcess, " + codice + ")) {");
        const foto = testo.indexOf("await scaricamentoFoto.downloadImages(" + variabile + ".foto, objProcess, folder, " + codice + ");");

        assert.ok(divisione > 0, variabile);
        assert.ok(extra > divisione, variabile);
        assert.ok(foto > extra, variabile);
    }
    //Le foto non passano piu' intere allo scaricamento nei Links.
    assert.ok(testo.indexOf("downloadImages(data, objProcess, folder, codiceSyncFoto)") < 0);
    assert.ok(testo.indexOf("downloadImages(data.lista, objProcess, folder, codiceSyncFotoMode2)") < 0);
});

/* ---- la sync loghi ---- */

test("la sync loghi passa la lavorazione aperta, per avere anche le foto extra delle sue ref", () => {
    const testo = sorgente();

    assert.match(testo, /var parametriLoghi = idKitLavorazione \? "\?id_lavorazione=" \+ idKitLavorazione : "";\n\s*xhr\.send\("SyncFoto\/getPacchettoLoghiBolliAsContract" \+ parametriLoghi, null, "GET", null\);/);
    assert.ok(testo.indexOf('xhr.send("SyncFoto/getPacchettoLoghiBolliAsContract", null, "GET", null);') < 0);
});

test("l'elenco dei loghi della scheda resta il solo archivio: nessuna lavorazione passata", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indexNew.indexOf("function getLoghiBolliData(callback) {");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));

    assert.ok(inizio > 0, "manca getLoghiBolliData");
    assert.match(corpo, /xhr\.send\("SyncFoto\/getPacchettoLoghiBolliAsContract", null, "GET", null\);/);
});
