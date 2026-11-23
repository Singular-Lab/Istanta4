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
    //Lotto 3: piu' tre, per le chiamate che Istanta rifiuta da un derivato (collega, estendi, extra auto).
    assert.strictEqual(occorrenze(foto, 'formData.append("idLavRec", me.idLavRecDelBoxAperto());\n'), 8);
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

/* ==== lotto 3: creare un derivato e riconoscerlo nella scheda ====
 *
 * Il derivato nasce su richiesta, a una pagina indicata dall'operatore: dal Reimpagina box, con
 * la spunta "Impagina come derivato", o dal tracciato, quando l'originale e' registrato a una
 * pagina che il documento non ha. Una pagina che non va bene si dice dentro la finestra, senza
 * registrare niente. Nella scheda di un derivato revisione, azioni sul box, Struttura e Sgruppa
 * non si offrono.
 */

const BoxDerivati = require("../../plugin/boxDerivati.js");

//Sostituisce delle proprieta' per la durata di una funzione, anche asincrona, e le rimette.
async function conSostituti(oggetto, sostituti, funzione) {
    const prima = {};
    Object.keys(sostituti).forEach(k => { prima[k] = Object.prototype.hasOwnProperty.call(oggetto, k) ? { v: oggetto[k] } : null; oggetto[k] = sostituti[k]; });
    try {
        return await funzione();
    }
    finally {
        Object.keys(sostituti).forEach(k => { if (prima[k] != null) { oggetto[k] = prima[k].v; } else { delete oggetto[k]; } });
    }
}

//Un documento finto: { "3": [dna, ...] } con i box sul livello InPagina.
function documentoFinto(pagine) {
    const nomi = Object.keys(pagine);
    return {
        pages: {
            length: nomi.length,
            item: (i) => ({
                name: nomi[i],
                groups: {
                    length: pagine[nomi[i]].length,
                    item: (g) => ({ dna: pagine[nomi[i]][g], itemLayer: { name: pagine[nomi[i]][g].livello || "InPagina" } })
                }
            })
        }
    };
}

/* ---- le regole ---- */

test("un derivato si puo' creare solo nel Volantino e mai da un altro derivato", () => {
    assert.strictEqual(BoxDerivati.puoDerivare(1, 0), true);
    assert.strictEqual(BoxDerivati.puoDerivare("1", undefined), true);
    assert.strictEqual(BoxDerivati.puoDerivare(2, 0), false);
    assert.strictEqual(BoxDerivati.puoDerivare(null, 0), false);
    assert.strictEqual(BoxDerivati.puoDerivare(1, 55), false);
});

test("le pagine del documento si descrivono a tratti", () => {
    assert.strictEqual(BoxDerivati.descriviPagine(["1", "2", "3", "4", "5", "6", "7", "8"]), "1-8");
    assert.strictEqual(BoxDerivati.descriviPagine(["3", "1", "2", "7", "9", "10"]), "1-3, 7, 9-10");
    assert.strictEqual(BoxDerivati.descriviPagine(["1", "A"]), "1, A");
    assert.strictEqual(BoxDerivati.descriviPagine(null), "");
    assert.deepStrictEqual(BoxDerivati.nomiPagine(documentoFinto({ "1": [], "2": [] })), ["1", "2"]);
    assert.deepStrictEqual(BoxDerivati.nomiPagine(null), []);
});

test("la pagina del derivato va bene solo se e' una pagina del documento", () => {
    const pagine = ["1", "2", "3", "4", "5", "6", "7", "8"];

    assert.deepStrictEqual(BoxDerivati.validaPagina(" 7 ", pagine), { pagina: 7 });
    assert.deepStrictEqual(BoxDerivati.validaPagina(3, pagine), { pagina: 3 });
    assert.deepStrictEqual(BoxDerivati.validaPagina("", pagine), { errore: "Indica la pagina in cui impaginare il derivato." });
    assert.deepStrictEqual(BoxDerivati.validaPagina(null, pagine), { errore: "Indica la pagina in cui impaginare il derivato." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("sette", pagine), { errore: "\"sette\" non e' un numero di pagina." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("7.5", pagine), { errore: "\"7.5\" non e' un numero di pagina." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("0", pagine), { errore: "La pagina deve essere fra 1 e 255." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("300", pagine), { errore: "La pagina deve essere fra 1 e 255." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("12", pagine), { errore: "La pagina 12 non e' in questo documento (pagine: 1-8)." });
    assert.deepStrictEqual(BoxDerivati.validaPagina("12", []), { errore: "La pagina 12 non e' in questo documento." });

    assert.strictEqual(BoxDerivati.paginaNelDocumento(7, pagine), true);
    assert.strictEqual(BoxDerivati.paginaNelDocumento("12", pagine), false);
    assert.strictEqual(BoxDerivati.paginaNelDocumento(null, pagine), false);
});

test("la richiesta di creazione porta lavorazione, codice gruppo, record, box di partenza e pagina", () => {
    assert.deepStrictEqual(
        BoxDerivati.richiestaDiCreazione(1193, { codiceGruppo: "7938749,7951882", idRec: "100", idLavRec: 0, pagina: 7 }),
        { idLavorazione: 1193, codiceGruppo: "7938749,7951882", idRec: 100, idLavRec: 0, pagina: 7 });
    //Da un derivato l'idLavRec parte lo stesso: e' Istanta che rifiuta, con il motivo.
    assert.strictEqual(BoxDerivati.richiestaDiCreazione(1, { codiceGruppo: "A", idRec: 10, idLavRec: 55, pagina: 2 }).idLavRec, 55);

    const sorgenteDerivati = sorgente("plugin/boxDerivati.js");
    assert.ok(sorgenteDerivati.includes('xhr.send("Menabo/creaDerivato", formData, "PUT");'));
});

/* ---- i derivati di un record nel documento ---- */

test("i derivati di un record nel documento sono i soli box col suo codice, il suo idRec e un idLavRec", () => {
    const doc = documentoFinto({
        "3": [{ codice_gruppo: "A", idRec: "10", idLavRec: 0 }],
        "5": [{ codice_gruppo: "A", idRec: "10", idLavRec: 55 }, { codice_gruppo: "B", idRec: "20", idLavRec: 60 }],
        "7": [{ codice_gruppo: "A", idRec: "10", idLavRec: 56 }, { codice_gruppo: "A", idRec: "11", idLavRec: 57 },
            { codice_gruppo: "A", idRec: "10", idLavRec: 58, livello: "cloneVecchioImpaginato" }]
    });

    const trovati = BoxDerivati.derivatiNelDocumento(doc, "A", 10, (g) => g.dna);
    assert.deepStrictEqual(trovati.map(d => [d.pagina, d.idLavRec]), [["5", 55], ["7", 56]]);
    assert.deepStrictEqual(BoxDerivati.derivatiNelDocumento(doc, "C", 30, (g) => g.dna), []);
});

test("l'avviso dei derivati dice quanti sono e a quali pagine", () => {
    assert.strictEqual(BoxDerivati.testoAvvisoDerivati([]), null);
    assert.strictEqual(BoxDerivati.testoAvvisoDerivati(null), null);
    assert.strictEqual(BoxDerivati.testoAvvisoDerivati([{ pagina: "7", idLavRec: 55 }]),
        "Code DRV-06 Questo box ha 1 derivato nel documento, a pagina 7: va reimpaginato per prendere il dato nuovo.");
    assert.strictEqual(BoxDerivati.testoAvvisoDerivati([{ pagina: "5" }, { pagina: "7" }, { pagina: "7" }]),
        "Code DRV-06 Questo box ha 3 derivati nel documento, a pagina 5, 7: vanno reimpaginati per prendere il dato nuovo.");
});

test("dopo una modifica dall'originale si avvisa dei suoi derivati, e solo dall'originale", async () => {
    const doc = documentoFinto({
        "3": [{ codice_gruppo: "A", idRec: "10", idLavRec: 0 }],
        "7": [{ codice_gruppo: "A", idRec: "10", idLavRec: 55 }]
    });
    const messaggi = [];
    const globali = { docInLavorazione: doc, Utility: { getDnaOfBox: (g) => g.dna }, messaggioUtente: (testo, tipo) => messaggi.push([testo, tipo]) };

    await conSostituti(global, globali, async () => {
        await conSostituti(schedaRef, { inSelezioneMultipla: false, refSelected: { item: { dna: { codice_gruppo: "A", idRec: "10", idLavRec: 0 } } } }, async () => {
            schedaRef.avvisaDerivatiDelBoxAperto();
        });
        assert.strictEqual(messaggi.length, 1);
        assert.strictEqual(messaggi[0][1], "warning");
        assert.ok(messaggi[0][0].includes("1 derivato nel documento, a pagina 7"));

        //Dal derivato stesso, o senza derivati, niente avviso.
        await conSostituti(schedaRef, { inSelezioneMultipla: false, refSelected: { item: { dna: { codice_gruppo: "A", idRec: "10", idLavRec: 55 } } } }, async () => {
            schedaRef.avvisaDerivatiDelBoxAperto();
        });
        await conSostituti(schedaRef, { inSelezioneMultipla: false, refSelected: { item: { dna: { codice_gruppo: "B", idRec: "20", idLavRec: 0 } } } }, async () => {
            schedaRef.avvisaDerivatiDelBoxAperto();
        });
        assert.strictEqual(messaggi.length, 1);
    });

    const scheda = sorgente("plugin/schedaRef.js");
    assert.ok(scheda.includes('messaggioUtente("SalvaModifiche: Richiesta completata con successo", "success", false, 5);\n                            this.avvisaDerivatiDelBoxAperto();'));
    assert.ok(scheda.includes("if (objResult.esito) {\n                    //TASK-22d7fad2: il dato del record e' cambiato: i derivati vanno reimpaginati.\n                    me.avvisaDerivatiDelBoxAperto();"));
});

/* ---- la creazione ---- */

function globaliDellaCreazione(eventi, impaginazione) {
    return {
        idKitLavorazione: 1193,
        docInLavorazione: {},
        schedaRef: schedaRef,
        indesignEvents: { setBusy: (v) => eventi.push("busy:" + v) },
        showLoading: () => { },
        hideLoading: () => { },
        messaggioUtente: (testo, tipo) => eventi.push(tipo + ":" + testo.substring(0, 11)),
        getSchedaRefAsync: async (scheda, codice, idRec, idLavRec) => { eventi.push("scheda:" + codice + ":" + idRec + ":" + idLavRec); return { records: [{ idRec: idRec }] }; },
        assicuraLivelloInPagina: () => eventi.push("livello"),
        impaginazioneSingoloIndd: async (records, pagina) => { eventi.push("impagina:" + pagina); return impaginazione(); },
        rimuoviRefImpaginata: async (lista) => { eventi.push("togli:" + JSON.stringify(lista)); }
    };
}

test("il derivato si registra, poi si impagina con la sua scheda alla pagina chiesta", async () => {
    const eventi = [];
    const box = { isValid: true };
    const registra = async (dati) => { eventi.push("registra:" + dati.codiceGruppo + ":" + dati.idRec + ":" + dati.pagina); return { esito: true, idLavRec: 900, idRec: 100, pagina: 7 }; };

    const esito = await conSostituti(global, globaliDellaCreazione(eventi, () => ({ boxAggiunto: box })), () =>
        conSostituti(BoxDerivati, { registra: registra }, () =>
            BoxDerivati.creaEImpagina({ codiceGruppo: "A", idRec: 100, idLavRec: 0, pagina: 7 })));

    assert.strictEqual(esito, box);
    assert.deepStrictEqual(eventi, ["busy:true", "registra:A:100:7", "scheda:A:100:900", "livello", "impagina:7", "success:Code DRV-02", "busy:false"]);
});

test("se Istanta rifiuta il derivato non si impagina niente e non c'e' niente da togliere", async () => {
    const eventi = [];
    const registra = async () => ({ esito: false, error: "creaDerivato, creazione del derivato: la pagina 0 non e' valida." });

    const esito = await conSostituti(global, globaliDellaCreazione(eventi, () => null), () =>
        conSostituti(BoxDerivati, { registra: registra }, () =>
            BoxDerivati.creaEImpagina({ codiceGruppo: "A", idRec: 100, idLavRec: 0, pagina: 7 })));

    assert.strictEqual(esito, null);
    assert.deepStrictEqual(eventi, ["busy:true", "error:Code DRV-01", "busy:false"]);
});

test("se il box del derivato non nasce, la sua registrazione si toglie con il suo idLavRec", async () => {
    const eventi = [];
    const registra = async () => ({ esito: true, idLavRec: 900, idRec: 100, pagina: 7 });

    const esito = await conSostituti(global, globaliDellaCreazione(eventi, () => undefined), () =>
        conSostituti(BoxDerivati, { registra: registra }, () =>
            BoxDerivati.creaEImpagina({ codiceGruppo: "A", idRec: 100, idLavRec: 0, pagina: 7 })));

    assert.strictEqual(esito, null);
    assert.deepStrictEqual(eventi, ["busy:true", "scheda:A:100:900", "livello", "impagina:7", "error:Code DRV-03",
        'togli:[{"codice":"A","idRec":100,"idLavRec":900}]', "busy:false"]);
});

/* ---- le finestre ---- */

test("la conferma del Reimpagina offre la spunta solo quando si puo' derivare", async () => {
    const viste = [];
    await conSostituti(BoxDerivati, { chiedi: async (config) => { viste.push(config); return { azione: "annulla", pagina: null }; } }, async () => {
        await BoxDerivati.chiediReimpagina({ codiceGruppo: "A", descrizione: "PASTA 500 g", eDerivato: false, puoDerivare: true, nomiPagine: ["1", "2"] });
        await BoxDerivati.chiediReimpagina({ codiceGruppo: "A", descrizione: "", eDerivato: true, puoDerivare: false, nomiPagine: ["1", "2"] });
    });

    assert.strictEqual(viste[0].titolo, "Reimpaginare il box A?");
    assert.deepStrictEqual(viste[0].righe, ["PASTA 500 g"]);
    assert.deepStrictEqual(viste[0].derivato, { conSpunta: true, testo: "Impagina come derivato" });
    assert.deepStrictEqual(viste[0].pulsanti.map(p => [p.testo, p.azione, p.pagina]), [["Annulla", "annulla", false], ["Reimpagina", "reimpagina", "conSpunta"]]);
    assert.strictEqual(viste[1].derivato, null);
    assert.deepStrictEqual(viste[1].righe, ["Questo box e' un derivato: viene rifatto con i suoi meta."]);
});

test("dal tracciato, per una pagina che il documento non ha, si offre il derivato e la rimozione resta con l'avviso", async () => {
    const viste = [];
    await conSostituti(BoxDerivati, { chiedi: async (config) => { viste.push(config); return { azione: "annulla", pagina: null }; } }, async () => {
        await BoxDerivati.chiediPerPaginaAssente({ codice: "A", idRec: 10, paginaRegistrata: "12", nomiPagine: ["1", "2", "3"], puoDerivare: true });
        await BoxDerivati.chiediPerPaginaAssente({ codice: "A", idRec: 10, paginaRegistrata: "12", nomiPagine: ["1", "2", "3"], puoDerivare: false });
    });

    assert.strictEqual(viste[0].titolo, "Elemento a una pagina non presente in questo documento");
    assert.deepStrictEqual(viste[0].righe, ["Codice: A", "Id record: 10", "Pagina registrata: 12", "Pagine di questo documento: 1-3"]);
    assert.ok(viste[0].avviso.includes("toglie dall'impaginato un elemento che sta a pagina 12, non presente in questo documento"));
    assert.strictEqual(viste[0].derivato.conSpunta, false);
    assert.deepStrictEqual(viste[0].pulsanti.map(p => [p.testo, p.azione, p.pagina]),
        [["Annulla", "annulla", false], ["Rimuovi dal server", "rimuovi", false], ["Impagina derivato", "derivato", "sempre"]]);
    //Fuori dal Volantino il derivato non si offre; la rimozione, con il suo avviso, si'.
    assert.strictEqual(viste[1].derivato, null);
    assert.deepStrictEqual(viste[1].pulsanti.map(p => p.azione), ["annulla", "rimuovi"]);
    assert.ok(viste[1].avviso.includes("non presente in questo documento"));
});

test("una pagina che non va bene si dice nella finestra, che resta aperta", () => {
    const sorgenteDerivati = sorgente("plugin/boxDerivati.js");
    const premi = tratto(sorgenteDerivati, "            const premi = function (pulsante) {", "            (config.pulsanti || []).forEach(pulsante => {");

    assert.ok(premi.includes("const valida = BoxDerivati.validaPagina(campo != null ? nellaFinestra(\"txtPaginaDerivato\").val() : \"\", config.nomiPagine);"));
    assert.ok(/if \(valida\.errore\) \{\s*(\/\/[^\n]*\n\s*)*nellaFinestra\("erroreDerivato"\)\.css\("display", "block"\)\.text\(valida\.errore\);\s*return;/.test(premi));
    //Con la spunta attiva il pulsante di conferma vale "derivato".
    assert.ok(premi.includes('esito = { azione: pulsante.pagina === "conSpunta" ? "derivato" : pulsante.azione, pagina: valida.pagina };'));
    //Chiusa da fuori vale Annulla, e non resta appesa.
    assert.ok(sorgenteDerivati.includes('if ($("#derivatoModal").length === 0) {\n                    esito = { azione: "annulla", pagina: null };'));
});

/* ---- il Reimpagina della scheda ---- */

test("l'icona Reimpagina chiede conferma: senza spunta rifa' il box, con la spunta crea il derivato", async () => {
    const eventi = [];
    const globali = { docInLavorazione: documentoFinto({ "1": [], "2": [] }), ficoProcess: { getTipoLavorazioneCorrente: () => 1 }, Utility: { getDnaOfBox: (g) => g.dna } };
    const record = [{ idRec: 10, recordInTracciato: { "Referenza.Codice": "A", "Scatto.CodiceGruppo": "A", StatoSelezione: 1, "Descrizioni.Descrizione1": "PASTA" } }];
    const scheda = (idLavRec) => ({
        inSelezioneMultipla: false,
        schedeRefDati: record,
        refSelected: { codiceGruppo: "A", idRec: 10, item: { dna: { codice_gruppo: "A", idRec: "10", idLavRec: idLavRec } } },
        applicaReimpaginazione: async () => { eventi.push("rifai"); return "rifatto"; }
    });
    const risposte = [{ azione: "reimpagina", pagina: null }, { azione: "derivato", pagina: 2 }, { azione: "annulla", pagina: null }, { azione: "reimpagina", pagina: null }];
    const chieste = [];

    await conSostituti(global, globali, () =>
        conSostituti(BoxDerivati, {
            chiediReimpagina: async (dati) => { chieste.push(dati); return risposte.shift(); },
            creaEImpagina: async (dati) => { eventi.push("derivato:" + JSON.stringify(dati)); return "nuovo"; }
        }, async () => {
            await conSostituti(schedaRef, scheda(0), async () => {
                assert.strictEqual(await schedaRef.chiediReimpaginazione(), "rifatto");
                assert.strictEqual(await schedaRef.chiediReimpaginazione(), "nuovo");
                assert.strictEqual(await schedaRef.chiediReimpaginazione(), null);
            });
            //Da un derivato la spunta non si offre, e si rifa' quel derivato.
            await conSostituti(schedaRef, scheda(55), async () => {
                assert.strictEqual(await schedaRef.chiediReimpaginazione(), "rifatto");
            });
            //Con piu' box la conferma e' quella della selezione multipla.
            await conSostituti(schedaRef, Object.assign(scheda(0), { inSelezioneMultipla: true }), async () => {
                assert.strictEqual(await schedaRef.chiediReimpaginazione(), "rifatto");
            });
        }));

    assert.deepStrictEqual(eventi, ["rifai", 'derivato:{"codiceGruppo":"A","idRec":10,"idLavRec":0,"pagina":2}', "rifai", "rifai"]);
    assert.strictEqual(chieste.length, 4);
    assert.deepStrictEqual([chieste[0].codiceGruppo, chieste[0].descrizione, chieste[0].puoDerivare, chieste[0].eDerivato], ["A", "PASTA", true, false]);
    assert.deepStrictEqual(chieste[0].nomiPagine, ["1", "2"]);
    assert.deepStrictEqual([chieste[3].puoDerivare, chieste[3].eDerivato], [false, true]);
});

/* ---- la scheda di un derivato ---- */

test("le azioni sul box non si offrono da un derivato, ne' con un derivato nella selezione", async () => {
    await conSostituti(global, { Utility: { getDnaOfBox: (g) => g.dna } }, async () => {
        await conSostituti(schedaRef, { inSelezioneMultipla: false, refSelected: { item: { dna: { idRec: "10", idLavRec: 0 } } } }, async () => {
            assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), true);
        });
        await conSostituti(schedaRef, { inSelezioneMultipla: false, refSelected: { item: { dna: { idRec: "10", idLavRec: 55 } } } }, async () => {
            assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), false);
        });
        const normale = { dettaglio: { codiceGruppo: "A", idRec: 10 }, records: [] };
        const derivato = { dettaglio: { codiceGruppo: "A", idRec: 10, idLavRec: 55 }, records: [] };
        await conSostituti(schedaRef, { inSelezioneMultipla: true, boxSelezioneMultipla: [normale, normale] }, async () => {
            assert.strictEqual(schedaRef.selezioneConDerivati(), false);
            assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), true);
        });
        await conSostituti(schedaRef, { inSelezioneMultipla: true, boxSelezioneMultipla: [normale, derivato] }, async () => {
            assert.strictEqual(schedaRef.selezioneConDerivati(), true);
            assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), false);
            //Nell'elenco il derivato si riconosce.
            assert.deepStrictEqual(schedaRef.vociSelezioneMultipla().map(v => v.descrizione), ["", "[derivato]"]);
        });
    });
});

test("la scheda di un derivato nasce in sola lettura, senza Salva, Sgruppa e Struttura, e lo dice", () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(scheda.includes("var schedaDiDerivato = me.idLavRecDelBoxAperto() > 0;\n        if (schedaDiDerivato) {\n            refEditabile = false;"));
    assert.ok(scheda.includes("this.segnaSchedaDiDerivato(schedaDiDerivato);\n        if (codice.includes(\",\") && !schedaDiDerivato) {\n            $(\"#sgruppa\").show();"));
    assert.ok(scheda.includes("if (schedaDiDerivato) {\n                $(\"#salvaButton\").remove();"));
    assert.ok(scheda.includes("if (schedaDiDerivato) {\n                    me.editRefFieldController.solaLettura = true;"));
    assert.ok(scheda.includes('.text(me.TESTO_SCHEDA_DERIVATO));'));
    //Il Salva non parte da un derivato nemmeno da codice (la finestra delle differenze).
    const salva = tratto(scheda, "    salvaModifiche(schedaRef, codice, box, meccanica, page) {", "//Chiedo al controller le operazioni che devo fare");
    assert.ok(/if \(me\.idLavRecDelBoxAperto\(\) > 0\) \{\s*messaggioUtente\("Code SRF-167[^\n]*\n\s*return;/.test(salva));
    //Il contrassegno nel titolo e la voce Struttura.
    const segna = tratto(scheda, "    segnaSchedaDiDerivato(eDerivato) {", "    avvisaDerivatiDelBoxAperto() {");
    assert.ok(segna.includes('.text("DERIVATO")'));
    assert.ok(/if \(eDerivato\) \{[\s\S]*?voceStruttura\.hide\(\);\s*\}\s*else if \(!this\.inVistaControllata\(\)\) \{\s*voceStruttura\.show\(\);/.test(segna));
});

/* ---- il tracciato ---- */

test("dal tracciato una pagina che il documento non ha non passa per un box sparito", () => {
    const index = sorgente("plugin/indexNew.js");
    const ricerca = tratto(index, "async function trovaRecord(", "        messaggioUtente(\"Code IDX-104");
    const assente = ricerca.indexOf("!BoxDerivati.paginaNelDocumento(paginaAttesa, nomiPagineDocumento)");
    const sparito = ricerca.indexOf("await Modali.confirmRimozioneRefNonTrovata({");

    assert.ok(assente > 0 && assente < sparito, "la pagina assente si riconosce prima della finestra del box non trovato");
    assert.ok(ricerca.includes("puoDerivare: BoxDerivati.puoDerivare(ficoProcess.getTipoLavorazioneCorrente(), 0)"));
    assert.ok(ricerca.includes("await BoxDerivati.creaEImpagina({ codiceGruppo: codice, idRec: idRecNorm, idLavRec: 0, pagina: sceltaPaginaAssente.pagina });"));
    //La rimozione resta possibile, e toglie l'originale: la voce non porta idLavRec.
    assert.ok(/if \(sceltaPaginaAssente\.azione === "rimuovi"\) \{\s*messaggioUtente\("Code IDX-102[^\n]*\n\s*await rimuoviRefImpaginata\(\[\{ codice: codice, idRec: idRecNorm \}\]\);/.test(ricerca));
    assert.ok(index.includes("const BoxDerivati = require('./boxDerivati');"));
});

//Misurato in console il 23/11/2026: in UXP il riferimento tenuto a un input da quando e' stato
//creato non ne riflette lo stato (this.checked true, riferimento undefined). Con la spunta letta
//dal riferimento il campo della pagina non compariva e "Reimpagina" rifaceva il box senza
//chiedere la pagina.
test("la finestra legge spunta e pagina dall'evento e dalla finestra, mai dal riferimento tenuto", () => {
    const sorgenteDerivati = sorgente("plugin/boxDerivati.js");
    const finestra = tratto(sorgenteDerivati, "    async chiedi(config) {", "    chiediReimpagina(dati) {");

    assert.ok(finestra.includes('const nellaFinestra = (id) => $("#derivatoModal").find("#" + id);'));
    assert.ok(finestra.includes('const spuntaAttiva = () => nellaFinestra("chkImpaginaComeDerivato").prop("checked") === true;'));
    //Il gestore della spunta guarda la casella dell'evento, e mostra la riga ritrovandola.
    assert.ok(/spunta\.on\("change", function \(evento\) \{\s*const casella = evento != null && evento\.target != null \? evento\.target : this;\s*const attiva = casella\.checked === true;\s*nellaFinestra\("rigaPaginaDerivato"\)\.css\("display", attiva \? "flex" : "none"\);/.test(finestra));
    //Al clic la spunta si rilegge: spuntata e senza pagina, la finestra si ferma sull'errore.
    assert.ok(finestra.includes("const conSpunta = spunta != null && spuntaAttiva();"));
    //Nessuna lettura di stato dai riferimenti.
    assert.ok(!finestra.includes('spunta.prop("checked")'));
    assert.ok(!finestra.includes("campo.val()"));
});

/* ---- collaudo del 23/11/2026: la descrizione sul derivato ---- */

test("sul derivato la descrizione del box non si revisiona: si usa quella del server o la si mette nel meta", () => {
    const scheda = sorgente("plugin/schedaRef.js");
    const scelte = tratto(scheda, "        if (this.eDescrizioneInMismatch(diff)) {", "        //I20-1077: e cosi' su ogni altro campo di testo");

    const derivato = scelte.indexOf('if (this.idLavRecDelBoxAperto() > 0) {\n                return ["descrizioneServer", "impostaMetaDescrizione"];');
    const normale = scelte.indexOf("this.sceltaDelBoxPerLaDescrizione(this.dovePortaLaDescrizioneDelBox())");
    assert.ok(derivato > 0 && derivato < normale, "il derivato si decide prima della scelta per dove sta la differenza");
    //Con il meta gia' impostato valgono le scelte del meta, anche sul derivato.
    assert.ok(scelte.indexOf('return ["usaMetaDescrizione", "aggiornaMetaDescrizione"];') < derivato);
});

test("con la descrizione nel meta il banner del mismatch non si mostra", () => {
    const meta = sorgente("plugin/metaDelBox.js");
    const stato = tratto(meta, "    applicaStatoMetaDescrizione() {", "    aggiornaPulsantiMetaDescrizione() {");

    assert.ok(/if \(conMeta\) \{[\s\S]*?\$\("#mismatchWarningPanel"\)\.empty\(\)\.css\("background-color", ""\);\s*\}/.test(stato));
    //Senza meta il banner resta: lo scrive il controller, e questa funzione non lo tocca.
    assert.strictEqual(occorrenze(stato, "#mismatchWarningPanel"), 1);
});

/* ---- collaudo del 23/11/2026: selezione multipla, foto e finestra degli ambiti ---- */

test("una selezione multipla con un derivato non si apre, e dice quale box", () => {
    assert.strictEqual(schedaRef.testoDerivatiInSelezioneMultipla(["7938749"]),
        "Code SRF-168 Il box 7938749 e' un derivato e non puo' essere alterato con una multi selezione");
    assert.strictEqual(schedaRef.testoDerivatiInSelezioneMultipla(["A", "B"]),
        "Code SRF-168 I box A; B sono derivati e non possono essere alterati con una multi selezione");

    const scheda = sorgente("plugin/schedaRef.js");
    const mostra = tratto(scheda, "    async mostraSchedaMultipla() {", "    componiTitoloSelezioneMultipla(quanti) {");
    const blocco = mostra.indexOf("if (derivatiSelezionati.length > 0) {");
    const misti = mostra.indexOf("if (stato === stati.misti || stato === stati.nonLeggibili) {");
    const raggruppa = mostra.indexOf('$("#raggruppaImage").show()');
    assert.ok(blocco > 0 && blocco < misti && blocco < raggruppa, "il derivato ferma la selezione prima di ogni altra cosa");
    //Come per i box misti: niente scheda, niente Raggruppa, e il pannello torna alla home.
    assert.ok(/if \(derivatiSelezionati\.length > 0\) \{\s*me\.impostaVociSelezioneMultipla\(false\);\s*\$\("#refImage"\)\.hide\(\);\s*\$\("#raggruppaImage"\)\.hide\(\);\s*messaggioUtente\(me\.testoDerivatiInSelezioneMultipla\([^\n]*\n\s*jsIndexControls\.changeSubMenu\(\$\("#homeImage"\)\.attr\("subTab"\)\);\s*jsIndexControls\.changeImage\(\$\("#homeImage"\)\);\s*return;/.test(mostra));
});

test("da un derivato la foto si cambia solo per questa lavorazione", () => {
    const lista = { "Foto.Origine": "tracciato", "Foto.NomeDaTracciato": "pasta" };
    const config = { cambioSoloPerLavorazione: true };

    assert.deepStrictEqual(schedaRef.ambitoDelCambioFoto(null, null, 55),
        { soloLavorazione: true, avviso: "Box derivato: la foto si cambia solo per questa lavorazione." });
    //Per gli altri box vale la regola della lista, com'era.
    assert.deepStrictEqual(schedaRef.ambitoDelCambioFoto(null, null, 0), { soloLavorazione: false, avviso: null });
    assert.strictEqual(schedaRef.ambitoDelCambioFoto(lista, config, 0).soloLavorazione, true);

    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");
    assert.ok(foto.includes("pluginMiddleware.getFotoDaTracciato(),\n                    me.idLavRecDelBoxAperto());"));
});

test("da un derivato le foto extra chiedono l'ambito con la sola scelta di questa lavorazione", async () => {
    const chieste = [];
    const Modali = { confirmCustom: async (...argomenti) => { chieste.push(argomenti); return { result: true, hiddenVal: argomenti[2] }; } };

    await conSostituti(global, { Modali: Modali, Utility: { getDnaOfBox: (g) => g.dna } }, async () => {
        await conSostituti(schedaRef, { refSelected: { item: { dna: { idRec: "10", idLavRec: 55 } } } }, async () => {
            assert.strictEqual(await schedaRef.sceltaAmbitoAzioneExtra(), "lavorazione");
        });
        await conSostituti(schedaRef, { refSelected: { item: { dna: { idRec: "10", idLavRec: 0 } } } }, async () => {
            await schedaRef.sceltaAmbitoAzioneExtra();
        });
    });

    assert.deepStrictEqual(chieste[0], ["Per quali lavorazioni vale?", "Solo per questa lavorazione", "lavorazione"]);
    assert.deepStrictEqual(chieste[1], ["Per quali lavorazioni vale?", "Per tutte le lavorazioni", "tutte", "Solo per questa lavorazione", "lavorazione"]);
});

test("da un derivato le foto extra dell'articolo non si attivano, non si disattivano e non si eliminano", () => {
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");

    assert.ok(foto.includes("var soloMeta = me.idLavRecDelBoxAperto() > 0;"));
    assert.ok(foto.includes("if (!soloMeta) {\n                    row.append(checkbox);"));
    assert.ok(/me\.eliminaFotoExtra\([^\n]*\n\s*\}\);\s*if \(!soloMeta\) \{\s*row\.append\(button\);/.test(foto));
    //Escludi solo qui, che va nei meta, resta.
    assert.ok(foto.includes("row.append(me.pulsanteEscludiSoloQui(elemento, elemento.tipo, box));"));
    //Extra auto: Escludi e Includi valgono per l'articolo.
    assert.ok(/if \(decisione != null \|\| !\(me\.idLavRecDelBoxAperto\(\) > 0\)\) \{\s*row\.append\(button\);/.test(foto));
    //Parziali e non piu' a sistema: Elimina ed Estendi non si offrono.
    const parziali = tratto(foto, "    pannelloExtraParziali(parziali, box) {", "    /// Estendi:");
    assert.ok(/if \(me\.idLavRecDelBoxAperto\(\) > 0\) \{\s*panel\.append\(riga\);\s*return;\s*\}\s*riga\.append\(elimina\);/.test(parziali));
    assert.ok(foto.includes("if (!(me.idLavRecDelBoxAperto() > 0)) {\n                riga.append(elimina);"));
    assert.ok(foto.includes(".text(me.TESTO_FOTO_EXTRA_DERIVATO));"));
});

//Collaudo: dopo "Imposta come meta" dalla finestra delle differenze restavano banner, bordi gialli
//e icone del server di prima, finche' non si riapriva la scheda.
test("messo il meta della descrizione dalla finestra delle differenze, la scheda si ridisegna", async () => {
    const scheda = sorgente("plugin/schedaRef.js");

    assert.ok(/if \(azione === "impostaMetaDescrizione"\) \{\s*if \(await me\.impostaDescrizioneComeMeta\(\)\) \{\s*await me\.ridisegnaSchedaDopoIlMeta\(\);/.test(scheda));
    assert.ok(/else if \(azione === "aggiornaMetaDescrizione"\) \{\s*if \(await me\.aggiornaMetaDescrizioneColBox\(\)\) \{\s*await me\.ridisegnaSchedaDopoIlMeta\(\);/.test(scheda));

    const eventi = [];
    await conSostituti(global, { CampiARiposo: { giro: () => eventi.push("riposo") } }, () =>
        conSostituti(schedaRef, {
            dimenticaSegnalazioni: () => eventi.push("dimentica"),
            selectSchedaRef: async (quale) => { eventi.push("ridisegna:" + quale); }
        }, () => schedaRef.ridisegnaSchedaDopoIlMeta()));
    assert.strictEqual(eventi[0], "dimentica");
    assert.strictEqual(eventi[1], "ridisegna:1");
});

//Collaudo: con la sola voce "Solo lavorazione" la tendina restava vuota, e il cambio partiva globale.
test("l'ambito del cambio foto limitato alla lavorazione non dipende da cosa mostra la tendina", () => {
    assert.strictEqual(schedaRef.ambitoScelto(null, true), "solo_lavorazione");
    assert.strictEqual(schedaRef.ambitoScelto("", true), "solo_lavorazione");
    assert.strictEqual(schedaRef.ambitoScelto("globale", true), "solo_lavorazione");
    //Senza limite vale la tendina, e una tendina senza selezione resta "globale" com'era.
    assert.strictEqual(schedaRef.ambitoScelto("canale_area", false), "canale_area");
    assert.strictEqual(schedaRef.ambitoScelto(null, false), "globale");

    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");
    assert.ok(foto.includes("value = me.ambitoScelto(value, fotoDallaLista.soloLavorazione);"));
    assert.ok(foto.includes("const value = me.ambitoScelto($('#selectScopeCambiaFoto').val(), fotoDallaLista.soloLavorazione);"));
    //La tendina non resta senza selezione quando "Globale" non e' fra le voci.
    assert.ok(/if \(!trovata && selectEl\.options\.length > 0\) \{\s*selectEl\.options\[0\]\.selected = true;\s*selectEl\.selectedIndex = 0;/.test(foto));
});

test("la conferma a due scelte dalle etichette lunghe ha il piede su due righe, con Annulla dentro", () => {
    const Modali = require("../../plugin/modali/modali.js");

    //Una scelta sola, o due corte: una riga, come prima.
    assert.strictEqual(Modali.righePiedeConferma("Sincronizza", null), 1);
    assert.strictEqual(Modali.righePiedeConferma("Solo volantino", "Tutto"), 1);
    assert.strictEqual(Modali.righePiedeConferma("Per tutte le lavorazioni", "Solo per questa lavorazione"), 2);
    assert.strictEqual(Modali.altezzaPiedeConferma(1), 50);
    assert.strictEqual(Modali.altezzaPiedeConferma(2), 84);
    //Il messaggio lascia il posto alla seconda riga; con una riga l'altezza e' quella di prima.
    assert.strictEqual(Modali.altezzaMassimaMessaggio(628), 453);
    assert.strictEqual(Modali.altezzaMassimaMessaggio(628, 1), 453);
    assert.strictEqual(Modali.altezzaMassimaMessaggio(628, 2), 419);

    const codice = sorgente("plugin/modali/modali.js");
    assert.ok(codice.includes("var righePiede = Modali.righePiedeConferma(bottoneConfirm1Text, bottoneConfirm2Text);"));
    assert.ok(/if \(righePiede === 2\) \{\s*pulsanti\.append\(\$\('<div style="flex-basis: 100%; height: 0;"><\/div>'\)\);\s*\}\s*pulsanti\.append\(annulla\);/.test(codice));
});

/* ---- la protezione lato Istanta ---- */

//Le chiamate delle foto che cambiano il dato dell'articolo dicono da quale box partono, cosi'
//Istanta le rifiuta da un derivato anche se il Plugin le lasciasse passare.
test("le chiamate delle foto che cambiano l'articolo portano l'idLavRec del box", async () => {
    const foto = sorgente("plugin/reperimentoFoto/schedaFoto.js");

    assert.ok(/formData\.append\("idLavRec", me\.idLavRecDelBoxAperto\(\)\);\s*xhr\.send\("SyncFoto\/linkLogoBollo\/", formData, "PUT"\);/.test(foto));
    assert.ok(/formData\.append\("idLavRec", me\.idLavRecDelBoxAperto\(\)\);\s*try \{\s*showLoading\("Estendo "/.test(foto));
    assert.ok(/formData\.append\("idLavRec", me\.idLavRecDelBoxAperto\(\)\);\s*xhr\.send\("SyncFoto\/escludiIncludiFotoExtraAuto\/"/.test(foto));
    //Le tre eliminazioni lo portavano gia' dal lotto 2a.
    assert.strictEqual(occorrenze(foto, 'formData.append("idLavRec", me.idLavRecDelBoxAperto());\n        try {\n            await me.richiestaFotoExtra("SyncFoto/RimuoviFoto/0"'), 2);

    //L'attiva/disattiva lo mette nell'indirizzo, e solo per un derivato: per gli altri resta com'era.
    const records = [{ recordInTracciato: { "Scatto.CodiceGruppo": "A", StatoSelezione: 1 } }];
    const nomeUrl = Object.keys(schedaRef).find(k => typeof schedaRef[k] === "function" && String(schedaRef[k]).includes('"SyncFoto/attivaDisattivaFotoExtra/" + guidId'));
    assert.ok(nomeUrl != null, "la funzione dell'indirizzo c'e'");
    await conSostituti(global, { Utility: { getDnaOfBox: (g) => g.dna } }, async () => {
        await conSostituti(schedaRef, { refSelected: { item: { dna: { idRec: "10", idLavRec: 55 } } } }, async () => {
            assert.ok(schedaRef[nomeUrl]("G1", true, records).endsWith("?codice=A&idLavRec=55"));
        });
        await conSostituti(schedaRef, { refSelected: { item: { dna: { idRec: "10", idLavRec: 0 } } } }, async () => {
            assert.ok(schedaRef[nomeUrl]("G1", true, records).endsWith("?codice=A"));
        });
    });
});
