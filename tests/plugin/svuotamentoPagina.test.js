/*
 * I20-1040: lo svuotamento di pagina non deve cancellare in silenzio.
 *
 * Una referenza spostata a mano in un'altra pagina restava, per la pre-analisi delle sole pagine
 * da svuotare, "presente solo sul server": la sync la ignorava e Menabo/SvuotaPagina ne cancellava
 * il record. Le referenze in pagina ma non registrate sul server si toglievano senza chiedere.
 * La domanda del ramo d'errore non si aspettava, Annulla in confirmCustom non finiva mai, e lo
 * svuotamento non aspettava il server.
 *
 * ReportIntegrita.classificaPerSvuotamento si prova davvero; il resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

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

//La mappa semplificata del documento, come la fa confronti.semplificazioneMappaImpaginato.
function documento(pagine) {
    return { listRefPerPagina: Object.keys(pagine).map(nome => ({ nomePagina: nome, codiciConId: pagine[nome] })) };
}

/* ---- la classificazione ---- */

test("una referenza registrata a pagina 3 ma presente a pagina 5 e' spostata", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "6593680", idRec: 456 }] }];
    const doc = documento({ "3": [], "5": [{ codice: "6593680", idRec: 456 }] });

    const r = ReportIntegrita.classificaPerSvuotamento(preAnalisi, doc, ["3"]);

    assert.deepStrictEqual(r.spostate, [{ codice: "6593680", idRec: 456, paginaServer: "3", paginaDocumento: "5" }]);
    assert.deepStrictEqual(r.nonRegistrate, []);
});

test("una referenza che non c'e' piu' da nessuna parte non e' spostata: il record si cancella", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "2617525", idRec: 321 }] }];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [] }), ["3"]).spostate, []);
    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["3"]).spostate, []);
});

test("spostata in un'altra pagina che si svuota anche lei non e' una domanda", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "1", idRec: 1 }] }];
    const doc = documento({ "4": [{ codice: "1", idRec: 1 }] });

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, doc, [3, 4]).spostate, []);
});

test("con l'idRec da entrambe le parti conta anche quello: lo stesso codice in due record", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "7", idRec: 10 }] }];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [{ codice: "7", idRec: 11 }] }), ["3"]).spostate, []);
    assert.strictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [{ codice: "7", idRec: 0 }] }), ["3"]).spostate.length, 1);
});

test("le referenze in pagina ma non registrate sul server vanno chieste, con la loro pagina", () => {
    const preAnalisi = [
        { nomePagina: "3", codiciNonImpaginatiSulServerConId: [{ codice: "6096504", idRec: 789 }] },
        { nomePagina: "4", codiciNonImpaginatiSulServer: ["111"] }
    ];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["3", "4"]).nonRegistrate, [
        { codice: "6096504", idRec: 789, pagina: "3" },
        { codice: "111", idRec: 0, pagina: "4" }
    ]);
});

test("una referenza portata nella pagina da svuotare, ma registrata altrove, va chiesta", () => {
    //Il caso del collaudo: registrata a pagina 3, spostata a pagina 2, si svuota pagina 2.
    const preAnalisi = [{ nomePagina: "2", codiciImpaginatiAPaginaDifferenteConId: [{ codice: "6593680", idRec: 456 }] }];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["2"]).registrateAltrove, [{ codice: "6593680", idRec: 456, pagina: "2" }]);
});

test("le mantenute registrate altrove escono dalla sync di prima dello svuotamento, il resto no", () => {
    const preAnalisi = [{
        nomePagina: "2",
        codiciImpaginatiAPaginaDifferenteConId: [{ codice: "1", idRec: 10 }, { codice: "2", idRec: 20 }],
        codiciImpaginatiAPaginaDifferente: ["1", "2"],
        codiciPresentiSoloSulServerConId: [{ codice: "9", idRec: 90 }]
    }];

    const copia = ReportIntegrita.preAnalisiSenza(preAnalisi, [{ codice: "1", idRec: 10, pagina: "2" }]);

    assert.deepStrictEqual(copia[0].codiciImpaginatiAPaginaDifferenteConId, [{ codice: "2", idRec: 20 }]);
    assert.deepStrictEqual(copia[0].codiciImpaginatiAPaginaDifferente, ["2"]);
    assert.deepStrictEqual(copia[0].codiciPresentiSoloSulServerConId, [{ codice: "9", idRec: 90 }]);
    assert.strictEqual(preAnalisi[0].codiciImpaginatiAPaginaDifferenteConId.length, 2, "la pre-analisi ricevuta non cambia");
});

test("le liste di soli codici valgono quando manca quella con l'idRec, come sul server", () => {
    assert.deepStrictEqual(ReportIntegrita._codiciConId([], ["a", "", null]), [{ codice: "a", idRec: 0 }]);
    assert.deepStrictEqual(ReportIntegrita._codiciConId([{ codice: "b", idRec: "5" }], ["a"]), [{ codice: "b", idRec: 5 }]);
    assert.deepStrictEqual(ReportIntegrita._codiciConId(null, null), []);
    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(null, null, null), { spostate: [], nonRegistrate: [], registrateAltrove: [] });
});

/* ---- svuota pagina, sul sorgente ---- */

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
const selezione = indexNew.substring(indexNew.indexOf("async function selectionModalSvuota(mode){"));
const svuotaFn = indexNew.substring(indexNew.indexOf("async function svuotaPaginaByPageName("));

test("la domanda del ramo d'errore si aspetta", () => {
    assert.match(selezione, /if \(await Modali\.confirm\("Errore durante l'analisi delle pagine/);
    assert.doesNotMatch(indexNew, /if \(Modali\.confirm\(/);
});

test("le decisioni vengono prima di sync e svuotamento, e Annulla ferma tutto", () => {
    const decisioni = selezione.indexOf("var decisioni = await decisioniPrimaDelloSvuotamento(preAnalisi, pagine);");
    const sync = selezione.indexOf("await ReportIntegrita.syncImpaginatoConServer(mappa, preAnalisiDaSincronizzare);");
    assert.ok(decisioni >= 0 && sync > decisioni);
    assert.match(selezione, /if \(decisioni == null\) \{\s*messaggioUtente\("Code IDX-171 Svuotamento annullato"/);
});

test("le spostate passano alla loro pagina, e se il server non conferma non si svuota", () => {
    assert.match(selezione, /if \(decisioni\.aggiornaSpostate\) \{\s*var esitoSpostate = await ReportIntegrita\.syncImpaginatoConServer\(null, \{ resultPaginas: preAnalisiPerSpostate\(decisioni\.spostate\) \}\);\s*if \(esitoSpostate !== "Completed"\) \{\s*messaggioUtente\("Code IDX-172/);
    assert.match(selezione, /await svuotaPaginaByPageName\(page, decisioni\.daMantenere\.filter\(m => m\.pagina == page\.toString\(\)\)\);/);
});

test("le due finestre usano le parole approvate", () => {
    const fn = indexNew.substring(indexNew.indexOf("async function decisioniPrimaDelloSvuotamento("));
    assert.match(fn, /"Aggiorna la pagina e svuota", "aggiorna", "Svuota comunque", "svuota"/);
    assert.match(fn, /"Rimuovi insieme alla pagina", "rimuovi", "Mantieni nel documento", "mantieni"/);
    //La mappa di tutto il documento solo se servono le spostate.
    assert.match(fn, /if \(ciSonoSoloSulServer\) \{[\s\S]{0,200}?confronti\.mappaturaImpaginato\(null, false, true\)/);
    //Il messaggio e' un elemento a testo normale, con i valori inseriti come testo.
    assert.match(fn, /Modali\.confirmCustom\(\s*messaggioSvuotamento\(/);
    const messaggio = indexNew.substring(indexNew.indexOf("function messaggioSvuotamento("), indexNew.indexOf("async function decisioniPrimaDelloSvuotamento("));
    assert.match(messaggio, /\.text\("• " \+ riga\)/);
    assert.doesNotMatch(messaggio, /\.html\(/);
});

test("le mantenute registrate altrove passano alla loro pagina dopo lo svuotamento di quella pagina", () => {
    const fn = indexNew.substring(indexNew.indexOf("async function decisioniPrimaDelloSvuotamento("));
    assert.match(fn, /"Le seguenti referenze si trovano in una pagina da svuotare, ma risultano registrate su un'altra pagina:"/);
    assert.match(fn, /decisioni\.mantenuteRegistrateAltrove = daDecidere\.registrateAltrove;/);

    //Fuori dalla sync di prima, dentro una sync per pagina subito dopo lo svuotamento.
    assert.match(selezione, /ReportIntegrita\.preAnalisiSenza\(preAnalisi\.resultPaginas, decisioni\.mantenuteRegistrateAltrove\)/);
    assert.match(selezione, /var ordine = pagine\.filter\(conMantenute\)\.concat\(pagine\.filter\(page => !conMantenute\(page\)\)\);/);
    assert.match(selezione, /await svuotaPaginaByPageName\(page, [^\n]*\);\s*var daRegistrare = decisioni\.mantenuteRegistrateAltrove\.filter\(m => m\.pagina == page\.toString\(\)\);[\s\S]{0,400}?syncImpaginatoConServer\(null, \{\s*resultPaginas: preAnalisiPerSpostate\(/);
});

test("svuotare una pagina aspetta il server e salta le referenze da mantenere", () => {
    assert.match(svuotaFn, /^async function svuotaPaginaByPageName\(pageName, daMantenere = \[\]\) \{/);
    assert.match(svuotaFn, /daMantenere\.some\(m => ReportIntegrita\._stessaReferenza\(m, codiceBox\)\)\) \{\s*continue;/);
    assert.match(svuotaFn, /while \(!finito\) \{/);
    assert.match(svuotaFn, /Code IDX-173/);
});

test("preAnalisiPerSpostate mette ogni spostata fra le impaginate a pagina differente della sua pagina", () => {
    const corpo = indexNew.substring(indexNew.indexOf("function preAnalisiPerSpostate("), indexNew.indexOf("/// Esegue lo svuotamento scelto nella finestra"));
    const preAnalisiPerSpostate = new Function(corpo + "\nreturn preAnalisiPerSpostate;")();

    assert.deepStrictEqual(preAnalisiPerSpostate([
        { codice: "1", idRec: 1, paginaServer: "3", paginaDocumento: "5" },
        { codice: "2", idRec: 2, paginaServer: "3", paginaDocumento: "5" },
        { codice: "3", idRec: 0, paginaServer: "4", paginaDocumento: "6" }
    ]), [
        { nomePagina: "5", codiciImpaginatiAPaginaDifferente: ["1", "2"], codiciImpaginatiAPaginaDifferenteConId: [{ codice: "1", idRec: 1 }, { codice: "2", idRec: 2 }] },
        { nomePagina: "6", codiciImpaginatiAPaginaDifferente: ["3"], codiciImpaginatiAPaginaDifferenteConId: [{ codice: "3", idRec: 0 }] }
    ]);
});

/* ---- i pezzi condivisi ---- */

test("confirmCustom finisce anche con Annulla", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    const corpo = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));

    assert.match(corpo, /annulla\.click\(function\(\)\{\s*objRes\.result = false;\s*risposto = true;/);
    assert.match(corpo, /while\(!risposto\)\{/);
    assert.doesNotMatch(corpo, /while\(objRes\.hiddenVal == null\)/);
});

test("confirmCustom accetta un elemento e, se il messaggio non ci sta, lo fa scorrere", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    const corpo = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));

    assert.match(corpo, /if \(message instanceof jQuery \|\| message instanceof Element\) \{\s*messaggio\.append\(message\);/);
    //In UXP scorre solo un contenitore con un'altezza in pixel.
    assert.match(corpo, /messaggio\.css\(\{ height: spazio \+ "px", flex: "0 0 auto", overflowY: "auto" \}\)/);
});

test("la sync dice Fallita quando il server rifiuta, invece di Completed", () => {
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const corpo = report.substring(report.indexOf("async syncImpaginatoConServer("), report.indexOf("    percorsoFileReport("));

    assert.match(corpo, /Code CNF-010[^\n]*\n\s*stato = "Fallita";\s*return;/);
    assert.match(corpo, /if \(stato === "Fallita"\) \{\s*return stato;\s*\}\s*stato = "Completed";/);
});

test("lato server una pagina in errore lascia falso l'esito della pre-analisi", () => {
    const controller = fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "Controllers", "MenaboController.cs"), "utf8").replace(/\r/g, "");
    const corpo = controller.substring(controller.indexOf("public async Task<IActionResult> PreAnalisiMismatch("), controller.indexOf("Menabo/syncImpaginatoConServer/"));

    assert.match(corpo, /if \(res\.errors\.Count == 0\)\s*\{\s*res\.esito = true;\s*\}/);
    assert.doesNotMatch(corpo, /\n\s*res\.esito = true;\n\s*esitoPagina\.nomePagina/);
});
