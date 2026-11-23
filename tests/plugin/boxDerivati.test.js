/*
 * TASK-22d7fad2, lotto 2a: l'identita' di un box derivato nel Plugin.
 *
 * Un box derivato e' una seconda impaginazione dello stesso record, con una riga propria su
 * Istanta: ha lo stesso codice, lo stesso codice gruppo e lo stesso idRec dell'originale. Per
 * distinguerlo, nel DNA lo slot dell'idRec diventa idRec*idLavRec, dove idLavRec e' l'Id di quella
 * riga. Chi legge il DNA ne ricava l'idRec pulito, come prima, e l'idLavRec a parte; il marcatore
 * resta quando il box viene rifatto o ricollegato; e ogni richiesta che porta l'idRec del box
 * porta anche l'idLavRec, altrimenti la decisione finirebbe sulla riga dell'originale.
 *
 * dnaBox.js e' puro e schedaRef.js si carica sotto Node; utility.js, indexNew.js e schedaFoto.js
 * no, e si provano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DnaBox = require("../../plugin/dnaBox.js");
const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

function occorrenze(testo, cercato) {
    return testo.split(cercato).length - 1;
}

/* ---- lo slot dell'idRec ---- */

test("lo slot di un box normale e' il solo idRec, com'era", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot("123"), { idRec: "123", idLavRec: 0 });
});

test("lo slot di un derivato da' l'idRec pulito e l'idLavRec a parte", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot("123*456"), { idRec: "123", idLavRec: 456 });
    //L'idRec pulito e' quello che i lettori di prima si aspettano.
    assert.strictEqual(parseInt(DnaBox.leggiSlot("123*456").idRec), 123);
});

test("uno slot vuoto, assente o con un idLavRec che non e' un numero non e' un derivato", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot(""), { idRec: "", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot(undefined), { idRec: undefined, idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot(null), { idRec: null, idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*abc"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*0"), { idRec: "123", idLavRec: 0 });
    assert.deepStrictEqual(DnaBox.leggiSlot("123*-4"), { idRec: "123", idLavRec: 0 });
});

test("lo slot si scrive col solo idRec per un box normale e con idRec*idLavRec per un derivato", () => {
    assert.strictEqual(DnaBox.scriviSlot(123, undefined), "123");
    assert.strictEqual(DnaBox.scriviSlot(123, 0), "123");
    assert.strictEqual(DnaBox.scriviSlot("123", null), "123");
    assert.strictEqual(DnaBox.scriviSlot(123, 456), "123*456");
    assert.strictEqual(DnaBox.scriviSlot("123", "456"), "123*456");
});

test("scrivere e rileggere lo slot riporta gli stessi valori", () => {
    assert.deepStrictEqual(DnaBox.leggiSlot(DnaBox.scriviSlot(123, 456)), { idRec: "123", idLavRec: 456 });
    assert.deepStrictEqual(DnaBox.leggiSlot(DnaBox.scriviSlot(123, 0)), { idRec: "123", idLavRec: 0 });
});

test("l'idLavRec di un dna, di un record o di un riferimento al box: 0 se non e' un derivato", () => {
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: 456 }), 456);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: "456" }), 456);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123" }), 0);
    assert.strictEqual(DnaBox.idLavRecDi({ idRec: "123", idLavRec: 0 }), 0);
    assert.strictEqual(DnaBox.idLavRecDi(null), 0);
    assert.strictEqual(DnaBox.eDerivato({ idLavRec: 456 }), true);
    assert.strictEqual(DnaBox.eDerivato({ idRec: "123" }), false);
});

test("cambiando l'idRec nella label del DNA l'idLavRec del derivato resta", () => {
    assert.strictEqual(DnaBox.labelConIdRec("descrizione$DNA$BOX1$111$111,222$123*456", 5, 999), "descrizione$DNA$BOX1$111$111,222$999*456");
    assert.strictEqual(DnaBox.labelConIdRec("descrizione$DNA$BOX1$111$111,222$123", 5, 999), "descrizione$DNA$BOX1$111$111,222$999");
    //Il formato vecchio, con lo slot in quarta posizione.
    assert.strictEqual(DnaBox.labelConIdRec("base$BOX1$111$111,222$123", 4, 999), "base$BOX1$111$111,222$999");
    //Una label senza lo slot non si tocca.
    assert.strictEqual(DnaBox.labelConIdRec("base$BOX1$111", 4, 999), null);
});

/* ---- lettura e scrittura del DNA ---- */

test("getDnaOfBox legge lo slot con DnaBox, nel formato nuovo e in quello vecchio", () => {
    const utility = sorgente("plugin/utility.js");

    assert.ok(utility.includes("const DnaBox = require('./dnaBox');"));
    assert.ok(utility.includes("var slot = DnaBox.leggiSlot(parts[5]);"));
    assert.ok(utility.includes("idRec: slot.idRec,\n                    idLavRec: slot.idLavRec,"));
    assert.ok(utility.includes("idRec: DnaBox.leggiSlot(partiBase[4]).idRec,\n            idLavRec: DnaBox.leggiSlot(partiBase[4]).idLavRec,"));
    //Nessuno legge piu' lo slot grezzo.
    assert.ok(!utility.includes("idRec: parts[5],"));
    assert.ok(!utility.includes("idRec: partiBase[4],"));
});

test("setCampoDNA scrive lo slot composto quando il record porta l'idLavRec", () => {
    const utility = sorgente("plugin/utility.js");

    assert.ok(utility.includes('itemRef["Scatto.CodiceGruppo"] + "$" + DnaBox.scriviSlot(itemRef["idRec"], itemRef["idLavRec"]);'));
    assert.ok(!utility.includes('itemRef["Scatto.CodiceGruppo"] + "$" + itemRef["idRec"];'));
});

//Il box rifatto (Reimpagina, Fix, riallineamento) nasce dai record della scheda: e' Istanta a
//mettere l'idLavRec in quelli della scheda di un derivato.
test("i record della scheda di un derivato portano l'idLavRec", () => {
    const menabo = sorgente("Istanta/Controllers/MenaboController.cs");

    assert.ok(menabo.includes('record.recordInTracciato["idLavRec"] = derivato.Id;'));
});

/* ---- il ricollegamento ---- */

test("dopo un ricollegamento il dna del derivato prende il nuovo idRec e tiene l'idLavRec", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123*456" };
    const dna = { idRec: "123", idLavRec: 456, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 999), true);

    assert.strictEqual(dna.idRec, "999");
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$999*456");
});

test("dopo un ricollegamento il dna di un box normale resta com'era prima di questo lavoro", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123" };
    const dna = { idRec: "123", idLavRec: 0, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 999), true);
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$999");

    const vecchio = { label: "base$BOX1$111$111,222$123" };
    assert.strictEqual(schedaRef.scriviIdRecNelDna({ idRec: "123", oldBoxFormat: true, item: vecchio }, 999), true);
    assert.strictEqual(vecchio.label, "base$BOX1$111$111,222$999");
});

test("se l'idRec scelto e' quello del box il dna non si tocca, derivato compreso", () => {
    const campo = { label: "descrizione$DNA$BOX1$111$111,222$123*456" };
    const dna = { idRec: "123", idLavRec: 456, oldBoxFormat: false, item: campo };

    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 123), false);
    assert.strictEqual(schedaRef.scriviIdRecNelDna(dna, 0), false);
    assert.strictEqual(campo.label, "descrizione$DNA$BOX1$111$111,222$123*456");
});

test("la richiesta di ricollegamento porta l'idLavRec del box", () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(scheda.includes("var idLavRec = DnaBox.idLavRecDi(dna);"));
    assert.ok(scheda.includes("idRec: idRec,\n                idLavRec: idLavRec,\n                pag: nomePagina,"));
});

/* ---- il box aperto ---- */

function conBoxAperto(dna, azione) {
    const utilityPrima = global.Utility;
    const selezionePrima = schedaRef.refSelected;
    global.Utility = { getDnaOfBox: () => dna };
    schedaRef.refSelected = { item: {} };
    try {
        return azione();
    }
    finally {
        global.Utility = utilityPrima;
        schedaRef.refSelected = selezionePrima;
    }
}

test("l'idLavRec del box aperto e' quello del suo DNA, 0 per un box normale o senza box", () => {
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 456 }, () => schedaRef.idLavRecDelBoxAperto()), 456);
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 0 }, () => schedaRef.idLavRecDelBoxAperto()), 0);
    assert.strictEqual(conBoxAperto(null, () => schedaRef.idLavRecDelBoxAperto()), 0);

    const selezionePrima = schedaRef.refSelected;
    schedaRef.refSelected = null;
    try {
        assert.strictEqual(schedaRef.idLavRecDelBoxAperto(), 0);
    }
    finally {
        schedaRef.refSelected = selezionePrima;
    }
});

test("l'idRec del box aperto di un derivato e' l'idRec pulito", () => {
    assert.strictEqual(conBoxAperto({ idRec: "123", idLavRec: 456 }, () => schedaRef.idRecDelBoxAperto()), 123);
});

/* ---- le richieste a Istanta ---- */

test("la scheda di un box si chiede con il suo idLavRec", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const index = sorgente("plugin/indexNew.js");
    const eventi = sorgente("plugin/events.js");

    assert.ok(scheda.includes("getSchedaRef(codiceGruppo, callback, idRec = 0, ignoraInvalidazione = false, idLavRec = 0) {"));
    assert.ok(scheda.includes('formData.append("idRec", idRec);\n        formData.append("idLavRec", DnaBox.idValido(idLavRec));'));
    //La scheda del box selezionato, la rilettura dopo una decisione, la referenza del box.
    assert.ok(scheda.includes("}, me.refSelected.idRec, false, me.refSelected.idLavRec);"));
    assert.ok(scheda.includes("async ricaricaDatiScheda(codiceGruppo, idRec, idLavRec = 0) {"));
    assert.ok(scheda.includes("}, idRec, false, idLavRec);"));
    assert.strictEqual(occorrenze(scheda, "this.ricaricaDatiScheda(codice, this.idRecDelBoxAperto(), this.idLavRecDelBoxAperto());"), 2);
    assert.ok(scheda.includes("me.ricaricaDatiScheda(codiceGruppo, idRec, me.idLavRecDelBoxAperto());"));
    assert.ok(index.includes("function getSchedaRefAsync(schedaRef, codiceGruppo, idRec = 0, idLavRec = 0) {"));
    assert.strictEqual(occorrenze(index, "DnaBox.idLavRecDi(dna)));"), 2);
    //La selezione porta l'idLavRec del box, e due box con lo stesso idRec non sono la stessa selezione.
    assert.strictEqual(occorrenze(eventi, "idRec: dna.idRec,\n"), occorrenze(eventi, "idLavRec: dna.idLavRec,\n"));
    assert.ok(eventi.includes("(me.lastSelectionDetails[0].idLavRec || 0) == (dna.idLavRec || 0)) {"));
});

test("le decisioni sul box portano l'idLavRec: foto extra, testi del box, noRender, primarie e secondarie", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");
    const decisione = 'formData.append("idRec", destinazione != null ? destinazione.idRec : me.idRecDelBoxAperto());\n';
    const conDerivato = decisione + '            formData.append("idLavRec", destinazione != null ? DnaBox.idLavRecDi(destinazione) : me.idLavRecDelBoxAperto());\n';

    assert.strictEqual(occorrenze(scheda, decisione), 3);
    assert.strictEqual(occorrenze(scheda, conDerivato), 3);
    assert.ok(foto.includes('formData.append("idRec", idRec);\n                formData.append("idLavRec", idLavRec);\n                formData.append("ps", JSON.stringify(objToSend.ps));'));
    assert.ok(foto.includes("me.ricaricaDatiScheda(codice_gruppo, idRec, idLavRec);"));
});

test("ogni richiesta sulle foto che porta l'idRec del box aperto porta anche l'idLavRec", () => {
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");

    assert.strictEqual(occorrenze(foto, 'formData.append("idRec", me.idRecDelBoxAperto());\n'), 4);
    assert.strictEqual(occorrenze(foto, 'formData.append("idLavRec", me.idLavRecDelBoxAperto());\n'), 5);
    assert.ok(foto.includes('"/" + idRec + "/" + 0 + "?idLavRec=" + me.idLavRecDelBoxAperto(), null, "GET");'));
});

//Rimuovendo un derivato senza idLavRec Istanta toglierebbe l'originale, che ha lo stesso idRec.
test("la rimozione di un box porta il suo idLavRec, da tutte le strade", () => {
    const index = sorgente("plugin/indexNew.js");

    assert.strictEqual(occorrenze(index, "listaCodiciConIdDaInviare.push("), 3);
    assert.ok(index.includes("idRec: idRecSelezionato, idLavRec: DnaBox.idLavRecDi(dnaSelezionato) });"));
    assert.ok(index.includes("idRec: idRecInput, idLavRec: DnaBox.idLavRecDi(itemCodiceConId) });"));
    assert.ok(index.includes("idRec: idRec, idLavRec: DnaBox.idLavRecDi(dna) });"));
    assert.ok(index.includes('params += "ListaCodiciConId[" + i + "].idLavRec=" + encodeURIComponent(DnaBox.idLavRecDi(listaCodiciConIdDaInviare[i])) + "&";'));
});

test("il cambio di pagina di un box porta il suo idLavRec", () => {
    const index = sorgente("plugin/indexNew.js");

    assert.ok(index.includes("async function impaginaSingolo(codice, pagina, byPassBloccoGiaImpaginato = false, idRec = null, idLavRec = 0) {"));
    assert.ok(index.includes('formData.append("idRec", idRecNorm);\n    formData.append("idLavRec", DnaBox.idValido(idLavRec));'));
});

//Da un derivato Istanta rifiuta revisione, azioni sul box e sgruppa: perche' possa farlo, la
//richiesta deve dire che il box e' un derivato.
test("revisione, azioni sul box e sgruppa dicono a Istanta se il box e' un derivato", () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(scheda.includes("req.idRec = this.idRecDelBoxAperto();\n            req.idLavRec = this.idLavRecDelBoxAperto();"));
    assert.ok(scheda.includes('params += "&idLavRec=" + encodeURIComponent(this.idLavRecDelBoxAperto());'));
    assert.strictEqual(occorrenze(scheda, 'params += "&idLavRec=" + encodeURIComponent(me.idLavRecDelBoxAperto());'), 2);
});

/* ==== lotto 2b: il documento confrontato con Istanta ====
 *
 * Tutto cio' che guarda piu' box insieme li riconosceva per codice gruppo e idRec, e un derivato
 * li ha uguali all'originale. Con un derivato a pagina 7 la sincronizzazione spostava l'originale
 * a pagina 7, lo svuotamento lo dava per spostato, e il Report Integrita' li segnava duplicati.
 * Ora la chiave comprende l'idLavRec: 0, o niente, per chi non e' un derivato.
 */

const Module = require("node:module");

function caricaReport() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return { app: {} };
        }
        return originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/reportIntegrita/reportIntegrita.js");
    }
    finally {
        Module._load = originale;
    }
}

const ReportIntegrita = caricaReport();
const confronti = require("../../plugin/confronti.js");
const SvuotamentoPagina = require("../../plugin/svuotamentoPagina.js");
const VersionePrecedente = require("../../plugin/versionePrecedente.js");
const reportIntegritaAvvio = require("../../plugin/reportIntegrita/avvio.js");
const Segnalazioni = require("../../plugin/segnalazioni/segnalazioni.js");

//Il corpo di una funzione o di un membro del sorgente, da "inizio" fino a "fine" escluso.
function tratto(testo, inizio, fine) {
    const da = testo.indexOf(inizio);
    assert.notStrictEqual(da, -1, inizio + " non trovato");
    const a = testo.indexOf(fine, da + inizio.length);
    assert.notStrictEqual(a, -1, fine + " non trovato");
    return testo.substring(da, a);
}

/* ---- la mappa del documento ---- */

test("la mappa semplificata tiene distinti l'originale e il suo derivato, e non raddoppia lo stesso box", () => {
    const lista = confronti.semplificazioneMappaImpaginato({
        "3": [{ codiceGruppo: "A", idRec: 10, idLavRec: 0 }, { codiceGruppo: "A", idRec: 10, idLavRec: 55 }],
        "7": [{ codiceGruppo: "A", idRec: 10, idLavRec: 55 }, { codiceGruppo: "A", idRec: 10, idLavRec: 55 }, { codiceGruppo: "B", idRec: 20 }]
    });

    assert.deepStrictEqual(lista.listRefPerPagina, [
        { nomePagina: "3", codiciConId: [{ codice: "A", idRec: 10 }, { codice: "A", idRec: 10, idLavRec: 55 }] },
        { nomePagina: "7", codiciConId: [{ codice: "A", idRec: 10, idLavRec: 55 }, { codice: "B", idRec: 20 }] }
    ]);
});

test("ogni voce della mappa del documento porta l'idLavRec letto dal DNA", () => {
    const sorgenteConfronti = sorgente("plugin/confronti.js");
    //Le due forme della mappa dell'impaginato e quella delle versioni precedenti.
    assert.strictEqual(occorrenze(sorgenteConfronti, "idLavRec: DnaBox.idLavRecDi(dna),"), 3);
});

/* ---- la stessa referenza ---- */

test("un derivato e' la stessa referenza solo di se stesso", () => {
    const stessa = ReportIntegrita._stessaReferenza;
    const originale = { codice: "A", idRec: 10 };
    const derivato = { codice: "A", idRec: 10, idLavRec: 55 };

    assert.strictEqual(stessa(originale, derivato), false);
    assert.strictEqual(stessa(derivato, originale), false);
    assert.strictEqual(stessa(derivato, { codice: "A", idRec: 10, idLavRec: 55 }), true);
    assert.strictEqual(stessa(derivato, { codice: "A", idRec: 10, idLavRec: 56 }), false);
    //Fra box che non sono derivati vale la regola di prima.
    assert.strictEqual(stessa(originale, { codice: "a", idRec: 0 }), true);
    assert.strictEqual(stessa(originale, { codice: "A", idRec: 11 }), false);
    assert.strictEqual(stessa(originale, { codice: "A", idRec: 10, idLavRec: 0 }), true);
});

test("le liste della pre-analisi tengono l'idLavRec solo per i derivati", () => {
    assert.deepStrictEqual(
        ReportIntegrita._codiciConId([{ codice: "A", idRec: "10", idLavRec: 55 }, { codice: "A", idRec: 10, idLavRec: 0 }], null),
        [{ codice: "A", idRec: 10, idLavRec: 55 }, { codice: "A", idRec: 10 }]);
});

/* ---- lo svuotamento ---- */

function documento(pagine) {
    return { listRefPerPagina: Object.keys(pagine).map(nome => ({ nomePagina: nome, codiciConId: pagine[nome] })) };
}

test("svuotando la pagina dell'originale, il derivato su un'altra pagina non lo fa passare per spostato", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "A", idRec: 10 }] }];
    const doc = documento({ "7": [{ codice: "A", idRec: 10, idLavRec: 55 }] });

    const r = ReportIntegrita.classificaPerSvuotamento(preAnalisi, doc, ["3"]);

    assert.deepStrictEqual(r.spostate, []);
    assert.deepStrictEqual(r.nonImpaginate, [{ codice: "A", idRec: 10, paginaServer: "3" }]);
});

test("un derivato registrato in una pagina da svuotare ma presente in un'altra e' spostato, col suo idLavRec", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "A", idRec: 10, idLavRec: 55 }] }];
    const doc = documento({ "3": [{ codice: "A", idRec: 10 }], "7": [{ codice: "A", idRec: 10, idLavRec: 55 }] });

    const r = ReportIntegrita.classificaPerSvuotamento(preAnalisi, doc, ["3"]);

    assert.deepStrictEqual(r.spostate, [{ codice: "A", idRec: 10, paginaServer: "3", paginaDocumento: "7", idLavRec: 55 }]);
    assert.deepStrictEqual(r.nonImpaginate, []);
});

test("la riga di un derivato nella finestra dello svuotamento prende autore e pagina dalla sua riga su Istanta", () => {
    const impaginati = [
        { codiceGruppo: "A", idRec: 10, idLavRec: 0, nomePagina: "3", nomeAutore: "anna" },
        { codiceGruppo: "A", idRec: 10, idLavRec: 55, nomePagina: "9", nomeAutore: "bruno" }
    ];
    const records = [{ recordInTracciato: { "Scatto.CodiceGruppo": "A", idRec: 10 } }];
    const stessa = ReportIntegrita._stessaReferenza;

    const delDerivato = { codice: "A", idRec: 10, idLavRec: 55 };
    assert.strictEqual(SvuotamentoPagina.impaginatoDi(impaginati, delDerivato, stessa).nomeAutore, "bruno");
    assert.strictEqual(SvuotamentoPagina.impaginatoDi(impaginati, { codice: "A", idRec: 10 }, stessa).nomeAutore, "anna");
    //Il record del tracciato e' lo stesso per l'originale e per il derivato.
    assert.strictEqual(SvuotamentoPagina.recordDi(records, delDerivato, stessa), records[0].recordInTracciato);

    const [riga] = SvuotamentoPagina.righe({ registrateAltrove: [{ codice: "A", idRec: 10, idLavRec: 55, pagina: "7" }] }, impaginati, records, stessa);
    assert.strictEqual(riga.idLavRec, 55);
    assert.strictEqual(riga.paginaServer, "9");
    const [normale] = SvuotamentoPagina.righe({ registrateAltrove: [{ codice: "A", idRec: 10, pagina: "7" }] }, impaginati, records, stessa);
    assert.ok(!("idLavRec" in normale));
    assert.strictEqual(normale.paginaServer, "3");
});

test("la finestra dello svuotamento chiede a Istanta anche i derivati e trova il box col suo idLavRec", () => {
    const svuotamento = sorgente("plugin/svuotamentoPagina.js");
    assert.ok(svuotamento.includes("await Utility.getListaCodiciImpaginati({ nullSeFallisce: true, conDerivati: true });"));
    assert.ok(svuotamento.includes("idRec: parseInt(c.dna.idRec) || 0, idLavRec: c.dna.idLavRec }, riga));"));
});

test("la registrazione delle spostate porta l'idLavRec del derivato", () => {
    const index = sorgente("plugin/indexNew.js");
    const corpo = tratto(index, "function preAnalisiPerSpostate(", "/// Esegue lo svuotamento scelto nella finestra");
    const preAnalisiPerSpostate = new Function(corpo + "\nreturn preAnalisiPerSpostate;")();

    assert.deepStrictEqual(preAnalisiPerSpostate([
        { codice: "A", idRec: 10, idLavRec: 55, paginaServer: "3", paginaDocumento: "7" },
        { codice: "B", idRec: 20, paginaServer: "3", paginaDocumento: "7" }
    ]), [{
        nomePagina: "7",
        codiciImpaginatiAPaginaDifferente: ["A", "B"],
        codiciImpaginatiAPaginaDifferenteConId: [{ codice: "A", idRec: 10, idLavRec: 55 }, { codice: "B", idRec: 20 }]
    }]);
});

/* ---- le versioni precedenti ---- */

test("il clone di un derivato e' la presenza del derivato, non dell'originale", () => {
    assert.strictEqual(VersionePrecedente.stessaPresenza("A", "10", "A", 10), true);
    assert.strictEqual(VersionePrecedente.stessaPresenza("A", "10", "A", 10, 55, 0), false);
    assert.strictEqual(VersionePrecedente.stessaPresenza("A", "10", "A", 10, 55, 55), true);
    assert.strictEqual(VersionePrecedente.stessaPresenza("A", "10", "A", 10, undefined, 0), true);

    assert.strictEqual(reportIntegritaAvvio.chiavePresenza("A", 10), "A|10");
    assert.strictEqual(reportIntegritaAvvio.chiavePresenza("A", 10, 0), "A|10");
    assert.strictEqual(reportIntegritaAvvio.chiavePresenza("A", 10, 55), "A|10|55");

    //In pagina c'e' solo l'originale: il clone del derivato non ha il suo box, va riportato.
    const mappa = { "3": [{ codiceGruppo: "A", idRec: 10, idLavRec: 0 }] };
    const versioni = { "7": [{ codiceGruppo: "A", idRec: 10, idLavRec: 55 }], "3": [{ codiceGruppo: "A", idRec: 10, idLavRec: 0 }] };
    const classi = reportIntegritaAvvio.classificaVersioniPrecedenti(versioni, mappa);
    assert.deepStrictEqual(classi.daRiportare.map(v => v.pagina), ["7"]);
    assert.deepStrictEqual(classi.daEliminare.map(v => v.pagina), ["3"]);
});

test("il box di una presenza si cerca anche per idLavRec", () => {
    const versione = sorgente("plugin/versionePrecedente.js");
    assert.strictEqual(occorrenze(versione, "this.stessaPresenza(c.dna.codice_gruppo, c.dna.idRec, codiceGruppo, idRec, c.dna.idLavRec, idLavRec)"), 2);

    const report = sorgente("plugin/reportIntegrita/reportIntegrita.js");
    const inGruppi = tratto(report, "    _findBoxByCodiceGruppoInGroups(groups, codiceGruppo, idRec, idLavRec = 0) {", "    _getDocumentPageByName(");
    assert.ok(inGruppi.includes("if (DnaBox.idLavRecDi(dna) !== DnaBox.idValido(idLavRec)) {\n                    return false;"));
    assert.ok(report.includes("const boxInPage = this._findBoxByCodiceGruppoInPage(codiceGruppo, idRec, pagina, idLavRec);"));
    assert.ok(report.includes("return this._findBoxByCodiceGruppoInDocument(codiceGruppo, idRec, idLavRec);"));
});

/* ---- il Report Integrita' ---- */

test("la sincronizzazione non da' per presente l'originale quando nel documento c'e' solo il derivato", () => {
    const records = [{ idRec: 10, recordInTracciato: { "Scatto.CodiceGruppo": "A", StatoSelezione: 1 } }];

    assert.strictEqual(reportIntegritaAvvio.gruppoGiaNellaMappa(records, { "7": [{ codiceGruppo: "A", idRec: 10, idLavRec: 55 }] }), false);
    assert.strictEqual(reportIntegritaAvvio.gruppoGiaNellaMappa(records, { "7": [{ codiceGruppo: "A", idRec: 10, idLavRec: 0 }] }), true);
    assert.strictEqual(reportIntegritaAvvio.gruppoGiaNellaMappa(records, { "7": [{ codiceGruppo: "A", idRec: 10 }] }), true);
});

test("i derivati che Istanta non registra piu' si leggono dalla pre-analisi", () => {
    const preAnalisi = {
        resultPaginas: [
            { nomePagina: "3", codiciNonImpaginatiSulServerConId: [{ codice: "A", idRec: 10, idLavRec: 55 }, { codice: "B", idRec: 20, idLavRec: 0 }] },
            { nomePagina: "4", codiciNonImpaginatiSulServerConId: [{ codice: "A", idRec: 10, idLavRec: 55 }, { codice: "C", idRec: 30, idLavRec: 77 }] },
            { nomePagina: "5" }
        ]
    };
    assert.deepStrictEqual(reportIntegritaAvvio.derivatiNonRegistrati(preAnalisi), [55, 77]);
    assert.deepStrictEqual(reportIntegritaAvvio.derivatiNonRegistrati(null), []);
});

test("due righe del report sono la stessa solo se anche l'idLavRec coincide", () => {
    const originale = { codiceGruppo: "A", elementoMappa: { idRec: 10, idLavRec: 0 } };
    const derivato = { codiceGruppo: "A", elementoMappa: { idRec: 10, idLavRec: 55 } };

    assert.strictEqual(ReportIntegrita._sameReportRecord(originale, derivato), false);
    assert.strictEqual(ReportIntegrita._sameReportRecord(derivato, { codiceGruppo: "A", elementoMappa: { idRec: 10, idLavRec: 55 } }), true);
    assert.strictEqual(ReportIntegrita._sameReportRecord(originale, { codiceGruppo: "A", elementoMappa: { idRec: 10 } }), true);
    assert.strictEqual(ReportIntegrita._idLavRecDelRecord(derivato), 55);
    assert.strictEqual(ReportIntegrita._idLavRecDelRecord(originale, { idLavRec: 55 }), 55);
    assert.strictEqual(ReportIntegrita._idLavRecDelRecord(originale), 0);
});

test("nel confronto originale e derivato non sono duplicati, e il derivato si giudica con la sua scheda", () => {
    const report = sorgente("plugin/reportIntegrita/reportIntegrita.js");
    const confronto = tratto(report, "    async applicaConfronto(mappa, letteSegnalazioni = null, versioniPrecedenti = null, derivatiRimossi = null) {", "    /// La regola di chiusura:");

    //La presenza e la chiave dei duplicati comprendono l'idLavRec: due copie dello stesso derivato restano duplicati.
    assert.ok(confronto.includes('presenze.push({ codiceGruppo: ref.codiceGruppo, idRec: idRecNorm, idLavRec: idLavRecNorm });'));
    assert.ok(confronto.includes('if (DnaBox.idLavRecDi(refDup) > 0) {\n                                dupKey += "|" + DnaBox.idLavRecDi(refDup);'));
    //La scheda del derivato arriva da Istanta, non dalla lista del kit, che ha i meta dell'originale.
    assert.ok(confronto.includes("recordsDerivato = await ReportIntegrita._leggiSchedaRefAggiornata(presenza.codiceGruppo, presenza.idRec != null ? presenza.idRec : 0, presenza.idLavRec);"));
    //Quello che Istanta non registra piu' non si legge: resta senza scheda, fra i box da eliminare.
    assert.ok(confronto.includes("if ((derivatiRimossi || []).indexOf(presenza.idLavRec) < 0) {"));
    assert.ok(confronto.includes("schedeRefs.push({ records: recordsDerivato || [], idLavRec: presenza.idLavRec });"));
    //Ogni scheda si confronta coi soli box che le corrispondono.
    assert.ok(confronto.includes("return DnaBox.idLavRecDi(candidato.elMappa) === DnaBox.idLavRecDi(schedaRef);"));

    assert.ok(report.includes("await ReportIntegrita.applicaConfronto(mappa, avviso.lette, versioniPrecedenti, reportIntegritaAvvio.derivatiNonRegistrati(preAnalisiMismatchNumeriPagina));"));
    assert.strictEqual(occorrenze(report, "}, idRec, true, idLavRec);"), 2);
});

/* ---- le segnalazioni ---- */

test("la chiave di un box nelle segnalazioni distingue il derivato dall'originale", () => {
    assert.strictEqual(Segnalazioni.chiaveBox("10", 0), "10");
    assert.strictEqual(Segnalazioni.chiaveBox(10, undefined), "10");
    assert.strictEqual(Segnalazioni.chiaveBox("10", 55), "10*55");
    assert.strictEqual(Segnalazioni.chiaveBox(null, 55), null);

    const schermata = sorgente("plugin/segnalazioni/schermata.js");
    assert.ok(schermata.includes("const chiave = Segnalazioni.chiaveBox(datiBox.idRec, datiBox.idLavRec);"));
    assert.ok(schermata.includes("const trovati = perIdRec.get(Segnalazioni.chiaveBox(dna != null ? dna.idRec : null, dna != null ? dna.idLavRec : 0));"));
});

/* ---- il Menabo' e il tracciato ---- */

test("il conteggio del Menabo' comprende i derivati; \"gia' impaginato\" resta sui soli originali", () => {
    const utility = sorgente("plugin/utility.js");
    assert.ok(utility.includes('xhrInProcess.send("Menabo/getListaImpaginati/" + idKitLavorazione + (opzioni.conDerivati ? "?conDerivati=true" : ""), null, "GET");'));

    const filtri = sorgente("plugin/filtri.js");
    const griglia = tratto(filtri, "    async visualizzaHomePageFiltri(){", "            righeGriglia.append(row);");
    assert.ok(griglia.includes("await Utility.getListaCodiciImpaginati({ nullSeFallisce: true, conDerivati: true });"));
    assert.ok(filtri.includes('(elemento.derivato ? " - derivato" : "")'));
    const ricerca = tratto(filtri, "    async impaginatiPerRicerca(", "    impaginatiPerPagina(lista) {");
    assert.ok(ricerca.includes("await Utility.getListaCodiciImpaginati({ nullSeFallisce: true });"));
});

test("i filtri impaginati e da impaginare del tracciato guardano l'idRec delle voci", () => {
    const index = sorgente("plugin/indexNew.js");
    const corpo = tratto(index, "function idRecImpaginati(", "function idRecDelRecordDelTracciato(");
    const idRecImpaginati = new Function(corpo + "\nreturn idRecImpaginati;")();

    const impaginati = idRecImpaginati([{ codiceGruppo: "A", idRec: 10, nomePagina: "3" }, null, { codiceGruppo: "B", idRec: 20, nomePagina: "4" }]);
    assert.strictEqual(impaginati.has(10), true);
    assert.strictEqual(impaginati.has(20), true);
    assert.strictEqual(impaginati.has(30), false);
    assert.strictEqual(idRecImpaginati(null).size, 0);

    //Prima: listImpaginati.includes(idRec), su un elenco di oggetti, non trovava mai niente.
    assert.ok(!index.includes("listImpaginati.includes("));
    assert.ok(index.includes("impaginati.has(r.recordInTracciato.idRec)"));
    assert.ok(index.includes("!impaginati.has(r.recordInTracciato.idRec)"));
});

test("dal tracciato si trova il box originale, non un suo derivato", () => {
    const index = sorgente("plugin/indexNew.js");
    const trova = tratto(index, "async function trovaRecord(", "        if(alternativeMatch != null){");

    assert.ok(trova.includes("if (DnaBox.idLavRecDi(dna) > 0) {\n                    continue;"));
    assert.ok(trova.includes("if (dna.codice_gruppo == codice && dna.idRec == idRec) {"));
    assert.ok(!index.includes("dna.id_rec =="));
    //La pagina trovata e' il suo nome, come nel ripiego: prima era l'indice.
    assert.ok(trova.includes("page: page.name"));
});

/* ---- l'esportazione ---- */

test("l'esportazione scrive pagina e posizione su una copia del record, una per box", () => {
    const fico = sorgente("plugin/ficoProcess.js");
    const corpo = tratto(fico, "    copiaPerIlBox: function (record) {", "    processExport:async function (page, file)");
    const copiaPerIlBox = new Function("return {" + corpo.replace(/,\s*$/, "") + "}.copiaPerIlBox;")();

    const record = { idRec: 10, recordInTracciato: { "Referenza.Codice": "A", "View.pag": 3 } };
    const copia = copiaPerIlBox(record);
    copia.recordInTracciato["View.pag"] = 7;

    assert.strictEqual(record.recordInTracciato["View.pag"], 3);
    assert.strictEqual(copia.idRec, 10);
    assert.strictEqual(copia.recordInTracciato["Referenza.Codice"], "A");
    assert.strictEqual(copiaPerIlBox(null), null);

    const esporta = tratto(fico, "    processExport:async function (page, file)", "    processCorreggoExport:");
    assert.ok(esporta.includes("var element = this.copiaPerIlBox(elementoLista);"));
});

/* ---- la selezione multipla ---- */

test("le voci della selezione multipla portano l'idLavRec dei soli derivati", () => {
    const lista = schedaRef.getCodiciConIdFromMultiSelection([
        { codiceGruppo: "A", idRec: 10 },
        { codiceGruppo: "A", idRec: 10, idLavRec: 55 },
        { codiceGruppo: "B", idRec: "20", idLavRec: 0 }
    ]);

    assert.deepStrictEqual(lista, [{ codice: "A", idRec: 10 }, { codice: "A", idRec: 10, idLavRec: 55 }, { codice: "B", idRec: 20 }]);
    assert.strictEqual(schedaRef.idLavRecDelDettaglio(null), 0);
    assert.strictEqual(schedaRef.idLavRecDelDettaglio({ idLavRec: "55" }), 55);
});

test("le azioni sul box di un derivato dicono a Istanta che e' un derivato", () => {
    const record = (idLavRec) => [{
        idRec: 77,
        recordInTracciato: Object.assign({ "Referenza.Codice": "123", "Scatto.CodiceGruppo": "123", StatoSelezione: 1 }, idLavRec != null ? { idLavRec: idLavRec } : {})
    }];

    assert.strictEqual(schedaRef.parametriAzioniDelBox(record(55), [], {}, "tutto"), "codiceGruppo=123&idRec=77&idLavRec=55");
    assert.strictEqual(schedaRef.parametriAzioniDelBox(record(null), [], {}, "tutto"), "codiceGruppo=123&idRec=77");
});

test("schede, Raggruppa, No render e Foto extra della selezione multipla portano l'idLavRec", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const index = sorgente("plugin/indexNew.js");
    const fotoExtra = sorgente("plugin/reperimentoFoto/fotoExtraPiuBox.js");

    assert.ok(scheda.includes("listaIdLavRec.push(me.idLavRecDelDettaglio(refs[i]));"));
    assert.ok(scheda.includes("                me.mostraSchedaMultipla();\n            }, listaIdLavRec);"));
    assert.ok(index.includes("async function getSchedeRefsMassivo(codiciGruppi, idRecs, callback, idsLavRec = null) {"));
    assert.ok(index.includes('formData.append("idsLavRec", idsLavRec.map(id => DnaBox.idValido(id)).join("-"));'));
    assert.ok(scheda.includes('params += "ListaCodiciConId[" + i + "].idLavRec=" + encodeURIComponent(DnaBox.idLavRecDi(listaCodiciConId[i])) + "&";'));
    assert.ok(scheda.includes("const registrato = await me.inviaNoRender(elementi, destinazione);"));
    assert.ok(fotoExtra.includes("if (conId.idLavRec > 0) {\n            destinazione.idLavRec = conId.idLavRec;"));
});

/* ---- l'artwork ---- */

test("l'artwork prende il box originale del codice, e il derivato solo se e' l'unico", () => {
    const artwork = sorgente("plugin/schedaArtwork.js");
    const corpo = tratto(artwork, "    boxDelCodice(codice, idRec = null)", "    getIdRecByCodice(codice)");
    const oggetto = new Function("Utility", "return {" + corpo.replace(/,\s*$/, "") + "};");

    const gruppo = (nome, dna) => ({ nome: nome, dna: dna, constructor: { name: "Group" } });
    const derivato = gruppo("derivato", { codice_gruppo: "A", idRec: "10", idLavRec: 55 });
    const originale = gruppo("originale", { codice_gruppo: "A", idRec: "10", idLavRec: 0 });
    const altro = gruppo("altro", { codice_gruppo: "B", idRec: "20", idLavRec: 0 });
    const pagina = (elementi) => ({ existingArtwork: { parentPage: { allPageItems: elementi } } });
    const cerca = (elementi, codice, idRec) => Object.assign(oggetto({ getDnaOfBox: (g) => g.dna }), pagina(elementi)).boxDelCodice(codice, idRec);

    assert.strictEqual(cerca([derivato, altro, originale], "A").item.nome, "originale");
    assert.strictEqual(cerca([derivato, altro], "A").item.nome, "derivato");
    assert.strictEqual(cerca([derivato, originale], "A", 11), null);
    assert.strictEqual(cerca([altro], "A"), null);

    assert.ok(artwork.includes('formData.append("idLavRec", parseInt(idLavRec));'));
    assert.ok(artwork.includes("this.idLavRecs = this.codici.map(cod => this.getIdLavRecByCodice(cod));"));
});
