/*
 * I20-1230: il pacchetto foto porta solo primarie e secondarie. In Foto P/S, rendendo primaria o
 * secondaria una referenza la cui foto non e' nei Links, Applica la scarica e la impagina da sola
 * (schedaFoto.impaginaFotoPs, come Cambia foto con assicuraFotoNeiLinks). Con la foto gia' nei
 * Links, o per una referenza non selezionata, l'impaginazione e' quella di prima.
 *
 * Esecuzione: node --test tests/plugin/fotoPsScaricaDaSola.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

/// Le globali che impaginaFotoPs usa, finte, con il registro delle chiamate.
function ambiente({ nei_links = [], scaricabile = true } = {}) {
    const chiamate = [];
    const presenti = new Set(nei_links);
    global.ReperimentoFoto = {
        fotoPresenteNeiLinks(nome) {
            chiamate.push(["presente", nome]);
            return presenti.has(nome);
        },
        async assicuraFotoNeiLinks(nome, guid) {
            chiamate.push(["scarica", nome, guid]);
            if (scaricabile) {
                presenti.add(nome);
            }
            return scaricabile;
        },
        async impaginaFotoAppenaDisponibile(nome, box, rettangolo, codice, stato, noRender) {
            chiamate.push(["impagina con nuovo tentativo", nome, codice, stato, noRender]);
            return { box: box, fotoRectangle: "riquadro di " + nome };
        }
    };
    global.FotoPlacer = {
        updateFoto(nome, box, rettangolo, codice, stato, noRender) {
            chiamate.push(["impagina", nome, codice, stato, noRender]);
            return { box: box, fotoRectangle: "riquadro di " + nome };
        }
    };
    global.showLoading = () => chiamate.push(["attesa"]);
    global.hideLoading = () => chiamate.push(["fine attesa"]);
    global.messaggioUtente = (testo, tipo) => chiamate.push(["messaggio", tipo, testo]);
    return chiamate;
}

function referenza(codice, stato, nome) {
    return { "Referenza.Codice": codice, StatoSelezione: stato, "Foto.Nome": nome, "Foto.guidid": "guid-" + codice };
}

const BOX = { label: "BOX_STD" };

test("una secondaria la cui foto non e' nei Links si scarica e poi si impagina", async () => {
    const chiamate = ambiente();

    const esito = await schedaRef.impaginaFotoPs(referenza("101", 2, "101_1.psd"), BOX, null, false);

    assert.deepStrictEqual(chiamate.filter(c => c[0] != "attesa" && c[0] != "fine attesa"), [
        ["presente", "101_1.psd"],
        ["scarica", "101_1.psd", "guid-101"],
        ["impagina con nuovo tentativo", "101_1.psd", "101", 2, false]
    ]);
    assert.strictEqual(esito.fotoRectangle, "riquadro di 101_1.psd");
    assert.strictEqual(esito.box, BOX);
    //L'attesa si chiude anche dopo lo scaricamento.
    assert.ok(chiamate.findIndex(c => c[0] == "fine attesa") > chiamate.findIndex(c => c[0] == "scarica"));
});

test("con la foto gia' nei Links si impagina come prima, senza scaricare", async () => {
    const chiamate = ambiente({ nei_links: ["100_1.psd"] });

    await schedaRef.impaginaFotoPs(referenza("100", 1, "100_1.psd"), BOX, "riquadro", true);

    assert.deepStrictEqual(chiamate, [
        ["presente", "100_1.psd"],
        ["impagina", "100_1.psd", "100", 1, true]
    ]);
});

test("una referenza non selezionata non scarica niente: il box perde la sua foto come prima", async () => {
    const chiamate = ambiente();

    await schedaRef.impaginaFotoPs(referenza("102", 3, "102_1.psd"), BOX, "riquadro", false);

    assert.deepStrictEqual(chiamate, [["impagina", null, "102", 3, false]]);
});

test("se la foto non arriva l'operatore lo sa, e il box si impagina come prima", async () => {
    const chiamate = ambiente({ scaricabile: false });

    await schedaRef.impaginaFotoPs(referenza("104", 2, "104_1.psd"), BOX, null, false);

    const messaggio = chiamate.find(c => c[0] == "messaggio");
    assert.ok(messaggio, "nessun messaggio all'operatore");
    assert.strictEqual(messaggio[1], "warning");
    assert.match(messaggio[2], /SRF-153.*104_1\.psd/);
    assert.ok(chiamate.some(c => c[0] == "impagina con nuovo tentativo"));
});

test("Applica di Foto P/S impagina passando da impaginaFotoPs", () => {
    const testo = leggiFileDelPlugin("reperimentoFoto/schedaFoto.js").replace(/\r/g, "");
    assert.match(testo, /let result = await me\.impaginaFotoPs\(objItem, box, imgRectangle, noRenderSalvato\);/);
    assert.doesNotMatch(testo, /let result = FotoPlacer\.updateFoto\(objItem\.StatoSelezione != 3/);
});

/* ---- collegamento rotto con il file gia' nei Links ---- */

test("con il collegamento rotto e il file nei Links la riga propone di ricollegare", () => {
    ambiente({ nei_links: ["3173545_1_T5.psd"] });

    const riga = schedaRef.rigaFotoCollegamentoRotto("3173545_1_T5.psd");

    assert.strictEqual(riga.azione, "ricollega");
    assert.match(riga.testo, /nella cartella Links ma il box non la trova, ricollegarla/);
});

test("con il collegamento rotto e senza file nei Links la riga propone di scaricare, come prima", () => {
    ambiente();

    for (const nome of ["3173545_1_T5.psd", "", null]) {
        const riga = schedaRef.rigaFotoCollegamentoRotto(nome);
        assert.strictEqual(riga.azione, "scarica");
        assert.strictEqual(riga.testo, "Errore: la foto non è presente nella cartella, scaricare l'immagine attraverso il pulsante adiacente");
    }
});

test("il ramo del collegamento rotto di Foto P/S passa da rigaFotoCollegamentoRotto e ricollega senza scaricare", () => {
    const testo = leggiFileDelPlugin("reperimentoFoto/schedaFoto.js").replace(/\r/g, "");
    const inizio = testo.indexOf("if (fotoNellaCartellaIsMissing) {");
    const fine = testo.indexOf("else if (fotoInMismatch || !hashMatch) {", inizio);
    assert.ok(inizio > 0 && fine > inizio);
    const ramo = testo.substring(inizio, fine);
    assert.match(ramo, /me\.rigaFotoCollegamentoRotto\(fotoNomeDato\)/);
    const ricollega = ramo.substring(ramo.indexOf('if (rigaRotto.azione == "ricollega") {'), ramo.indexOf("else {", ramo.indexOf('if (rigaRotto.azione == "ricollega") {')));
    assert.match(ricollega, /FotoPlacer\.updateFoto\(fotoNomeDato, box, fotoRectangle, codice\)/);
    assert.doesNotMatch(ricollega, /avviaSyncPacchettoFoto/);
});
