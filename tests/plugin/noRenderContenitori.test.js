/*
 * Contenitori del noRender: in Coop togliere lo sconto vuol dire togliere il gruppo box_sconto
 * (sconto, txt_sconto, sconto_base), ma la preanalisi confronta solo i campi compilati e segnalava
 * l'assenza di txt_sconto. L'operatore lo metteva in noRender e nel POP, che eredita i meta, usciva
 * il box_sconto senza il numero.
 *
 * L'agenzia dichiara nel SourceCustomPlugin il contenitore di un campo (contenitoriNoRender:
 * {"txt_sconto": "box_sconto"}). Se mancano campo e contenitore l'assenza e' del contenitore, ed e'
 * lui che va in noRender; un campo in noRender nasconde anche il suo contenitore, cosi' valgono i
 * meta gia' salvati con il solo txt_sconto. Senza la chiave non cambia niente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const NoRenderElementi = require("../../plugin/noRenderElementi.js");

const TIPO = NoRenderElementi.TIPO;
const COOP = { txt_sconto: "box_sconto" };

//I campi assenti come li classifica la preanalisi.
const TXT_SCONTO = NoRenderElementi.classificaLabel("txt_sconto");
const DESCRIZIONE2 = NoRenderElementi.classificaLabel("descrizione2");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- il contenitore di un campo ---- */

test("il contenitore di un campo e' quello dichiarato, altrimenti nessuno", () => {
    assert.strictEqual(NoRenderElementi.contenitoreDi("txt_sconto", COOP), "box_sconto");
    assert.strictEqual(NoRenderElementi.contenitoreDi("descrizione2", COOP), "");
    assert.strictEqual(NoRenderElementi.contenitoreDi("txt_sconto", null), "");
    assert.strictEqual(NoRenderElementi.contenitoreDi("txt_sconto", { txt_sconto: 3 }), "");
});

/* ---- l'applicazione: un campo in noRender nasconde anche il contenitore ---- */

test("un campo in noRender porta con se' il suo contenitore", () => {
    const lista = NoRenderElementi.conContenitori([{ tipo: TIPO.campo, chiave: "txt_sconto", nome: "txt_sconto" }], COOP);

    assert.ok(NoRenderElementi.inNoRender(lista, TIPO.campo, "txt_sconto"));
    assert.ok(NoRenderElementi.inNoRender(lista, TIPO.campo, "box_sconto"));
    assert.strictEqual(lista.length, 2);
});

test("il contenitore gia' in noRender non si ripete", () => {
    const marcati = [{ tipo: TIPO.campo, chiave: "box_sconto" }, { tipo: TIPO.campo, chiave: "txt_sconto" }];

    assert.strictEqual(NoRenderElementi.conContenitori(marcati, COOP).length, 2);
});

test("senza contenitori, o per elementi che non sono campi, la lista resta quella", () => {
    const marcati = [{ tipo: TIPO.campo, chiave: "txt_sconto" }, { tipo: TIPO.logo, chiave: "txt_sconto" }];

    assert.deepStrictEqual(NoRenderElementi.conContenitori(marcati, {}), marcati);
    assert.deepStrictEqual(NoRenderElementi.conContenitori([{ tipo: TIPO.logo, chiave: "txt_sconto" }], COOP), [{ tipo: TIPO.logo, chiave: "txt_sconto" }]);
    assert.deepStrictEqual(NoRenderElementi.conContenitori(null, COOP), []);
});

/* ---- la segnalazione: manca il gruppo intero ---- */

test("se mancano campo e contenitore l'assenza e' del contenitore, e va lui in noRender", () => {
    const contenitore = NoRenderElementi.contenitoreAssente(TXT_SCONTO, COOP, () => false);
    assert.strictEqual(contenitore, "box_sconto");

    //La preanalisi segnala il contenitore come segnalerebbe il campo: stessa assenza, altra chiave.
    const classificato = NoRenderElementi.classificaLabel(contenitore);
    const assenza = { label: contenitore, difference: "non presente", tipo: "mancante", tipoElemento: classificato.tipo, chiave: classificato.chiave };
    assert.deepStrictEqual(NoRenderElementi.elementoDaAssenza(assenza, []), { tipo: TIPO.campo, chiave: "box_sconto", nome: "box_sconto" });
});

test("se il contenitore c'e' manca davvero solo il campo", () => {
    assert.strictEqual(NoRenderElementi.contenitoreAssente(TXT_SCONTO, COOP, etichetta => etichetta === "box_sconto"), "");
});

test("un campo senza contenitore, o un elemento che non e' un campo, resta com'e'", () => {
    assert.strictEqual(NoRenderElementi.contenitoreAssente(DESCRIZIONE2, COOP, () => false), "");
    assert.strictEqual(NoRenderElementi.contenitoreAssente(TXT_SCONTO, {}, () => false), "");
    assert.strictEqual(NoRenderElementi.contenitoreAssente({ tipo: TIPO.etichetta, chiave: "txt_sconto" }, COOP, () => false), "");
    assert.strictEqual(NoRenderElementi.contenitoreAssente(null, COOP, () => false), "");
});

test("con il solo txt_sconto in noRender, salvato prima, il gruppo mancante e' gia' risolto", () => {
    const vecchioMeta = NoRenderElementi.conContenitori([{ tipo: TIPO.campo, chiave: "txt_sconto" }], COOP);
    const contenitore = NoRenderElementi.contenitoreAssente(TXT_SCONTO, COOP, () => false);

    assert.strictEqual(NoRenderElementi.daSegnalareComeMancante(vecchioMeta, TIPO.campo, contenitore), false);
});

/* ---- la configurazione ---- */

function middlewareVero(customPluginDB, callCustom = false, customAgenzia = undefined) {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "pluginMiddleware.js"), "utf8");
    const inizio = testo.indexOf("    getContenitoriNoRender() {");
    assert.notStrictEqual(inizio, -1, "getContenitoriNoRender non trovata");
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < testo.length && fine < 0; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}") { livello--; if (livello === 0) { fine = i + 1; } }
    }
    const membro = new Function("customAgenzia", "return ({\n" + testo.substring(inizio, fine) + "\n});")(customAgenzia);
    return Object.assign(membro, { callCustom: callCustom, customPluginDB: customPluginDB });
}

test("i contenitori li dice la configurazione del cliente; senza, nessuno", () => {
    assert.deepStrictEqual(middlewareVero({ contenitoriNoRender: { txt_sconto: "box_sconto" } }).getContenitoriNoRender(), { txt_sconto: "box_sconto" });
    assert.deepStrictEqual(middlewareVero({}).getContenitoriNoRender(), {});
    assert.deepStrictEqual(middlewareVero(null).getContenitoriNoRender(), {});
    assert.deepStrictEqual(middlewareVero({ contenitoriNoRender: ["box_sconto"] }).getContenitoriNoRender(), {});
    assert.deepStrictEqual(middlewareVero({ contenitoriNoRender: { txt_sconto: "", altro: 2, campo: "gruppo" } }).getContenitoriNoRender(), { campo: "gruppo" });
    assert.deepStrictEqual(middlewareVero(null, true, { contenitoriNoRender: { txt_sconto: "box_sconto" } }).getContenitoriNoRender(), { txt_sconto: "box_sconto" });
});

/* ---- dove si usa ---- */

test("la preanalisi estende il noRender e porta l'assenza al contenitore prima di decidere se segnalarla", () => {
    const testo = sorgente("confronti.js");
    const preanalisi = testo.substring(testo.indexOf("async confrontoBoxCompiledFieldPreAnalisi("), testo.indexOf("async mappaturaImpaginato("));

    const estende = preanalisi.indexOf("elementiNoRender = NoRenderElementi.conContenitori(elementiNoRender, contenitori);");
    assert.ok(estende > 0);
    assert.ok(estende < preanalisi.indexOf("compiledFields.forEach(compiledField => {"));
    const porta = preanalisi.indexOf("classificatoCampo = NoRenderElementi.classificaLabel(contenitoreAssente);");
    assert.ok(porta > preanalisi.indexOf("NoRenderElementi.contenitoreAssente(classificatoCampo, contenitori,"));
    assert.ok(porta < preanalisi.indexOf("var assenzaCampo = { label: labelCampo,"));
});

test("l'impaginazione nasconde anche i contenitori dei campi in noRender", () => {
    const testo = sorgente("indexNew.js");
    const inizio = testo.indexOf("function applicaNoRenderAgliElementiDelBox(box, elementiNoRender) {");
    const corpo = testo.substring(inizio, testo.indexOf("\n}\n", inizio));

    const estende = corpo.indexOf("elementiNoRender = NoRenderElementi.conContenitori(elementiNoRender, pluginMiddleware.getContenitoriNoRender());");
    assert.ok(estende > 0);
    assert.ok(estende < corpo.indexOf("for (var i = 0; i < box.allPageItems.length; i++)"));
});
