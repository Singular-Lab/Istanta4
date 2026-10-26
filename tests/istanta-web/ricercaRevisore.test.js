/*
 * I20-1111: il filtro di ricerca del revisore trova quello che l'operatore legge.
 *
 * Senza "Cerca in archivio" Nome, Brand, Tipo-Gusto e Grammatura si cercavano solo nella descrizione
 * grezza del tracciato (colonna sinistra), mentre l'operatore scrive quella revisionata (colonna
 * destra); un tracciato senza Descrizione3/4, come quello Coop, non trovava mai niente su Tipo-Gusto e
 * Grammatura. Il Segmento si leggeva da recordInTracciato.Referenza.Segmento, che non esiste: le chiavi
 * del record sono piatte. Con "Cerca in archivio", dentro un gruppo, Brand, Tipo-Gusto, Grammatura e
 * Segmento si leggevano sul gruppo invece che sul suo articolo.
 *
 * Il record di prova e' quello visto nella console del revisore Coop (caffe' 7825864).
 *
 * revisore.js si carica sotto Node (module.exports); cercaProdotto usa jQuery e si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");

const sorgente = fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "wwwroot", "js", "revisore.js"), "utf8").replace(/\r/g, "");

function caffe() {
    return {
        isGruppo: false,
        label: "main",
        recordInTracciato: {
            "Referenza.Codice": "7825864",
            "Scatto.CodiceGruppo": "7825864,7941124,8154002",
            "Descrizioni.Descrizione1": "30 CPS RISTRETTO INT 11 L'OR",
            "Descrizioni.Descrizione2": "L'OR",
            "segmento": "NESPRESSO"
        },
        recordRevisionato: {
            descrizione1: "CAFFÈ IN CAPSULE ESPRESSO L'OR",
            descrizione2: "L'OR ESPRESSO",
            descrizione3: "x30 - 156 g - compatibili Nespresso - ristretto",
            descrizione4: ""
        }
    };
}

function trova(record, campi) {
    return Revisore.corrispondeAiCampiDellaRicerca(record, campi.nome || "", campi.brand || "", campi.tipoGusto || "", campi.grammatura || "", campi.segmento || "");
}

/* ---- dove si cerca ---- */

test("il Nome si trova in quello che l'operatore legge, la revisione, senza badare alle maiuscole", () => {
    assert.strictEqual(trova(caffe(), { nome: "caffè" }), true);
    assert.strictEqual(trova(caffe(), { nome: "CAPSULE" }), true);
});

test("il Nome si trova anche nella descrizione del tracciato, come prima", () => {
    assert.strictEqual(trova(caffe(), { nome: "ristretto" }), true);
});

test("Tipo-Gusto e Grammatura trovano anche se il tracciato non ha Descrizione3 e Descrizione4", () => {
    assert.strictEqual(trova(caffe(), { tipoGusto: "x30" }), true);
    const conGrammatura = caffe();
    conGrammatura.recordRevisionato.descrizione4 = "156 g";
    assert.strictEqual(trova(conGrammatura, { grammatura: "156" }), true);
});

test("il Segmento si legge dove sta davvero: nel tracciato, nella chiave di Referenza o nell'archivio", () => {
    assert.strictEqual(trova(caffe(), { segmento: "nespresso" }), true);

    const daReferenza = caffe();
    delete daReferenza.recordInTracciato["segmento"];
    daReferenza.recordInTracciato["Referenza.Segmento"] = "CAFFE";
    assert.strictEqual(trova(daReferenza, { segmento: "caffe" }), true);

    const dallArchivio = caffe();
    delete dallArchivio.recordInTracciato["segmento"];
    dallArchivio.recordRevisionato.idArticoloNavigation = { segmento: "ESPRESSO" };
    assert.strictEqual(trova(dallArchivio, { segmento: "espresso" }), true);
});

test("i campi vuoti non filtrano, anche senza revisione", () => {
    assert.strictEqual(trova(caffe(), {}), true);
    const senzaRevisione = caffe();
    senzaRevisione.recordRevisionato = null;
    assert.strictEqual(trova(senzaRevisione, {}), true);
    assert.strictEqual(trova(senzaRevisione, { nome: "ristretto" }), true);
});

/* ---- quando non si trova ---- */

test("una parola che non c'e' ne' nella revisione ne' nel tracciato non trova niente", () => {
    assert.strictEqual(trova(caffe(), { nome: "biscotti" }), false);
    assert.strictEqual(trova(caffe(), { segmento: "surgelati" }), false);
    const senzaNiente = caffe();
    delete senzaNiente.recordInTracciato["segmento"];
    assert.strictEqual(trova(senzaNiente, { segmento: "nespresso" }), false);
});

test("con piu' campi compilati devono corrispondere tutti", () => {
    assert.strictEqual(trova(caffe(), { nome: "caffè", brand: "l'or" }), true);
    assert.strictEqual(trova(caffe(), { nome: "caffè", brand: "lavazza" }), false);
});

/* ---- dove si usa ---- */

function corpoCercaProdotto() {
    const inizio = sorgente.indexOf("    cercaProdotto(label, codice, nome, brand, tipo_gusto, grammatura, segmento) {");
    assert.ok(inizio >= 0, "manca cercaProdotto");
    return sorgente.substring(inizio, sorgente.indexOf("\n    }\n", inizio));
}

test("senza archivio i tre punti della ricerca usano la stessa regola, e non resta la chiave di segmento sbagliata", () => {
    const corpo = corpoCercaProdotto();
    const usi = corpo.match(/else if \(!Revisore\.corrispondeAiCampiDellaRicerca\((item2|item), nome, brand, tipo_gusto, grammatura, segmento\)\) \{/g) || [];
    assert.strictEqual(usi.length, 3);
    //Nel codice della ricerca: il commento di corrispondeAiCampiDellaRicerca la nomina per spiegare il difetto.
    assert.doesNotMatch(corpo, /recordInTracciato\.Referenza\.Segmento/);
    assert.doesNotMatch(corpo, /recordInTracciato\[keyDescr[1-4]\]/);
});

test("in archivio, dentro un gruppo, tutti i campi si leggono sull'articolo del gruppo", () => {
    const corpo = corpoCercaProdotto();
    const inizio = corpo.indexOf("childsElement.forEach(function (item2) {\n                        let childIgnorato = false;");
    assert.ok(inizio > 0, "manca il ciclo dei figli dell'archivio");
    const figli = corpo.substring(inizio, corpo.indexOf("if (!childIgnorato) {", inizio));
    assert.doesNotMatch(figli, /\bitem\.recordRevisionato/);
    ["descrizione1", "descrizione2", "descrizione3", "descrizione4"].forEach(function (campo) {
        assert.match(figli, new RegExp("item2\\.recordRevisionato\\." + campo + " != null"));
    });
    assert.match(figli, /item2\.recordRevisionato\.idArticoloNavigation\.segmento/);
});
