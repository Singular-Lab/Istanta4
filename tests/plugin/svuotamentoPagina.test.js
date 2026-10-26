/*
 * I20-1040: lo svuotamento di pagina non deve cancellare in silenzio.
 *
 * Una referenza spostata a mano in un'altra pagina restava, per la pre-analisi delle sole pagine
 * da svuotare, "presente solo sul server": la sync la ignorava e Menabo/SvuotaPagina ne cancellava
 * il record. Le referenze in pagina ma non registrate sul server si toglievano senza chiedere.
 * La domanda del ramo d'errore non si aspettava, Annulla in confirmCustom non finiva mai, e lo
 * svuotamento non aspettava il server.
 *
 * TASK-19c18841: una finestra sola con «Sincronizza e svuota» e Annulla, al posto delle tre di
 * I20-1040; per ogni referenza descrizione, info, Trova, pagine e autore. L'intervallo di pagine
 * si legge una volta sola, e uno non valido ferma tutto: il 26/10/2026 "13-11" (o simile) aveva
 * fatto sincronizzare tutto il documento e svuotare niente, con "Svuotamento completato".
 *
 * Classificazione, righe della finestra, intervallo ed esito dello svuotamento si provano davvero;
 * il resto sul sorgente.
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
const confronti = require("../../plugin/confronti.js");
const SvuotamentoPagina = require("../../plugin/svuotamentoPagina.js");

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
    assert.deepStrictEqual(r.nonImpaginate, []);
    assert.deepStrictEqual(r.nonRegistrate, []);
});

test("una referenza che il documento non ha da nessuna parte e' non impaginata: si mostra, e il record si cancella", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "2617525", idRec: 321 }] }];

    const conMappa = ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [] }), ["3"]);
    assert.deepStrictEqual(conMappa.spostate, []);
    assert.deepStrictEqual(conMappa.nonImpaginate, [{ codice: "2617525", idRec: 321, paginaServer: "3" }]);
    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["3"]).nonImpaginate, [{ codice: "2617525", idRec: 321, paginaServer: "3" }]);
});

test("spostata in un'altra pagina che si svuota anche lei non e' ne' spostata ne' non impaginata: la mostra l'altra pagina", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "1", idRec: 1 }] }];
    const doc = documento({ "4": [{ codice: "1", idRec: 1 }] });

    const r = ReportIntegrita.classificaPerSvuotamento(preAnalisi, doc, [3, 4]);
    assert.deepStrictEqual(r.spostate, []);
    assert.deepStrictEqual(r.nonImpaginate, []);
});

test("con l'idRec da entrambe le parti conta anche quello: lo stesso codice in due record", () => {
    const preAnalisi = [{ nomePagina: "3", codiciPresentiSoloSulServerConId: [{ codice: "7", idRec: 10 }] }];

    const altroRecord = ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [{ codice: "7", idRec: 11 }] }), ["3"]);
    assert.deepStrictEqual(altroRecord.spostate, []);
    assert.strictEqual(altroRecord.nonImpaginate.length, 1);
    assert.strictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, documento({ "5": [{ codice: "7", idRec: 0 }] }), ["3"]).spostate.length, 1);
});

test("le referenze in pagina ma non registrate sul server vanno mostrate, con la loro pagina", () => {
    const preAnalisi = [
        { nomePagina: "3", codiciNonImpaginatiSulServerConId: [{ codice: "6096504", idRec: 789 }] },
        { nomePagina: "4", codiciNonImpaginatiSulServer: ["111"] }
    ];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["3", "4"]).nonRegistrate, [
        { codice: "6096504", idRec: 789, pagina: "3" },
        { codice: "111", idRec: 0, pagina: "4" }
    ]);
});

test("una referenza portata nella pagina da svuotare, ma registrata altrove, va mostrata", () => {
    //Il caso del collaudo: registrata a pagina 3, spostata a pagina 2, si svuota pagina 2.
    const preAnalisi = [{ nomePagina: "2", codiciImpaginatiAPaginaDifferenteConId: [{ codice: "6593680", idRec: 456 }] }];

    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(preAnalisi, null, ["2"]).registrateAltrove, [{ codice: "6593680", idRec: 456, pagina: "2" }]);
});

test("le liste di soli codici valgono quando manca quella con l'idRec, come sul server", () => {
    assert.deepStrictEqual(ReportIntegrita._codiciConId([], ["a", "", null]), [{ codice: "a", idRec: 0 }]);
    assert.deepStrictEqual(ReportIntegrita._codiciConId([{ codice: "b", idRec: "5" }], ["a"]), [{ codice: "b", idRec: 5 }]);
    assert.deepStrictEqual(ReportIntegrita._codiciConId(null, null), []);
    assert.deepStrictEqual(ReportIntegrita.classificaPerSvuotamento(null, null, null), { spostate: [], nonImpaginate: [], nonRegistrate: [], registrateAltrove: [] });
});

/* ---- l'intervallo di pagine ---- */

test("l'intervallo di pagine: pagine singole, intervalli, spazi, senza ripetizioni", () => {
    assert.deepStrictEqual(confronti.pagineDellIntervallo("1,3-5"), { pagine: [1, 3, 4, 5], errore: null });
    assert.deepStrictEqual(confronti.pagineDellIntervallo(" 11 - 13 "), { pagine: [11, 12, 13], errore: null });
    assert.deepStrictEqual(confronti.pagineDellIntervallo("3,3-4"), { pagine: [3, 4], errore: null });
    assert.deepStrictEqual(confronti.pagineDellIntervallo(7), { pagine: [7], errore: null });
});

test("un intervallo al contrario, con due trattini, vuoto o non numerico non e' nessuna pagina: e' un errore", () => {
    for (const testo of ["13-11", "11--13", "11-12-13", "", "  ", null, "3a", "3,", "-3"]) {
        const letto = confronti.pagineDellIntervallo(testo);
        assert.deepStrictEqual(letto.pagine, [], String(testo));
        assert.ok(typeof letto.errore === "string" && letto.errore !== "", String(testo));
    }
    assert.match(confronti.pagineDellIntervallo("2,13-11").errore, /'13-11'/);
});

test("la mappa con pagine non valide si ferma invece di mappare tutto il documento", () => {
    const sorgente = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");
    const corpo = sorgente.substring(sorgente.indexOf("async mappaturaImpaginato("), sorgente.indexOf("semplificazioneMappaImpaginato(mappa){"));

    assert.match(corpo, /const letto = this\.pagineDellIntervallo\(pag\);\s*if \(letto\.errore != null\) \{\s*messaggioUtente\("Code CNF-003[^\n]*\n\s*return;\s*\}\s*pagine = letto\.pagine;/);
    assert.doesNotMatch(corpo, /pagineRangeSplit/);
});

/* ---- le righe della finestra ---- */

const stessa = ReportIntegrita._stessaReferenza;

const impaginati = [
    { codiceGruppo: "6593680", idRec: 456, nomePagina: "3", idAutore: 4, nomeAutore: "mrossi", autoreReport: false },
    { codiceGruppo: "2617525", idRec: 321, nomePagina: "3", idAutore: -9, nomeAutore: "lbianchi", autoreReport: true },
    { codiceGruppo: "777", idRec: 70, nomePagina: "7", idAutore: 4, nomeAutore: "mrossi", autoreReport: false }
];

const records = [
    { recordInTracciato: { idRec: 456, "Scatto.CodiceGruppo": "6593680", "Descrizioni.Descrizione1": "Latte intero", "Descrizioni.Descrizione2": "1 litro" } },
    { recordInTracciato: { idRec: 70, "Scatto.CodiceGruppo": "777", "Descrizioni.Descrizione1": "Biscotti" } },
    { recordInTracciato: { idRec: 88, "Scatto.CodiceGruppo": "888", "Descrizioni.Descrizione1": "Pasta" } }
];

test("una spostata: pagine, autore, descrizione, Trova e cosa succede", () => {
    const [riga] = SvuotamentoPagina.righe({ spostate: [{ codice: "6593680", idRec: 456, paginaServer: "3", paginaDocumento: "5" }] }, impaginati, records, stessa);

    assert.strictEqual(riga.tipo, "spostata");
    assert.strictEqual(riga.paginaServer, "3");
    assert.strictEqual(riga.paginaDocumento, "5");
    assert.strictEqual(riga.autore, "mrossi");
    assert.strictEqual(riga.descrizione, "Latte intero | 1 litro");
    assert.strictEqual(riga.trovabile, true);
    assert.strictEqual(riga.dettagli, "Server: pag. 3 · Impaginato: pag. 5 · Autore: mrossi");
    assert.strictEqual(riga.esito, "Resta a pagina 5: il server viene aggiornato");
});

test("una non impaginata non si trova, e dice che esce dal server; l'autore del report dice chi l'ha avviato", () => {
    const [riga] = SvuotamentoPagina.righe({ nonImpaginate: [{ codice: "2617525", idRec: 321, paginaServer: "3" }] }, impaginati, records, stessa);

    assert.strictEqual(riga.paginaDocumento, null);
    assert.strictEqual(riga.trovabile, false);
    assert.strictEqual(riga.autore, "Report Integrità, avviato da lbianchi");
    assert.strictEqual(riga.dettagli, "Server: pag. 3 · Impaginato: nessuna pagina · Autore: Report Integrità, avviato da lbianchi");
    assert.strictEqual(riga.esito, "Non è nel documento: esce dal server");
    //Non e' nella lista scaricata: niente record, la finestra mostra l'avviso.
    assert.strictEqual(riga.record, null);
    assert.strictEqual(riga.descrizione, "");
});

test("una registrata altrove prende la pagina del server dalla lista degli impaginati", () => {
    const [riga] = SvuotamentoPagina.righe({ registrateAltrove: [{ codice: "777", idRec: 70, pagina: "2" }] }, impaginati, records, stessa);

    assert.strictEqual(riga.paginaServer, "7");
    assert.strictEqual(riga.paginaDocumento, "2");
    assert.strictEqual(riga.dettagli, "Server: pag. 7 · Impaginato: pag. 2 · Autore: mrossi");
    assert.strictEqual(riga.esito, "Viene tolto con pagina 2");

    const senzaLista = SvuotamentoPagina.righe({ registrateAltrove: [{ codice: "777", idRec: 70, pagina: "2" }] }, null, records, stessa)[0];
    assert.strictEqual(senzaLista.paginaServer, null);
    assert.strictEqual(senzaLista.autore, "");
    assert.strictEqual(senzaLista.dettagli, "Server: altra pagina · Impaginato: pag. 2");
});

test("una non registrata non ha autore ne' pagina sul server, anche se il codice compare fra gli impaginati", () => {
    const [riga] = SvuotamentoPagina.righe({ nonRegistrate: [{ codice: "6593680", idRec: 0, pagina: "3" }] }, impaginati, records, stessa);

    assert.strictEqual(riga.autore, "");
    assert.strictEqual(riga.dettagli, "Server: non registrato · Impaginato: pag. 3");
    assert.strictEqual(riga.esito, "Non registrato sul server: viene tolto con pagina 3");
    //Senza idRec il record si trova dal codice gruppo.
    assert.strictEqual(riga.descrizione, "Latte intero | 1 litro");
});

test("le righe vanno nell'ordine spostate, non impaginate, registrate altrove, non registrate", () => {
    const righe = SvuotamentoPagina.righe({
        nonRegistrate: [{ codice: "d", idRec: 0, pagina: "3" }],
        registrateAltrove: [{ codice: "c", idRec: 0, pagina: "3" }],
        nonImpaginate: [{ codice: "b", idRec: 0, paginaServer: "3" }],
        spostate: [{ codice: "a", idRec: 0, paginaServer: "3", paginaDocumento: "5" }]
    }, [], [], stessa);

    assert.deepStrictEqual(righe.map(r => r.codice), ["a", "b", "c", "d"]);
    assert.deepStrictEqual(SvuotamentoPagina.righe(null, null, null, stessa), []);
});

test("l'introduzione nomina la pagina o le pagine da svuotare", () => {
    assert.strictEqual(SvuotamentoPagina.testoIntroduzione([3]), "Prima di svuotare pagina 3: questi box non corrispondono fra impaginato e server.");
    assert.strictEqual(SvuotamentoPagina.testoIntroduzione([11, 12]), "Prima di svuotare le pagine 11, 12: questi box non corrispondono fra impaginato e server.");
});

/* ---- la finestra, sul sorgente ---- */

const modulo = leggiFileDelPlugin("svuotamentoPagina.js").replace(/\r/g, "");

test("una finestra sola, con «Sincronizza e svuota» e Annulla", () => {
    assert.strictEqual(SvuotamentoPagina.TESTO_SINCRONIZZA, "Sincronizza e svuota");
    const chiamate = modulo.match(/Modali\.confirmCustom\(/g) || [];
    assert.strictEqual(chiamate.length, 1);
    assert.match(modulo, /Modali\.confirmCustom\(contenuto, SvuotamentoPagina\.TESTO_SINCRONIZZA, "sincronizza"\)/);

    const indexNew = leggiFileDelPlugin("indexNew.js");
    assert.doesNotMatch(indexNew, /Svuota comunque|Mantieni nel documento|Rimuovi insieme alla pagina/);
    assert.doesNotMatch(indexNew, /function decisioniPrimaDelloSvuotamento\(/);
});

test("con la finestra aperta gli eventi sono fermi, e prima di farli ripartire la selezione e' gia' vista", () => {
    const decidi = modulo.substring(modulo.indexOf("async decidi("));

    assert.match(decidi, /indesignEvents\.setBusy\(true\);\s*let scelta = null;\s*try \{\s*scelta = await Modali\.confirmCustom\(/);
    assert.match(decidi, /finally \{[^}]*?Tooltip\.nascondiTooltip\(\);\s*\$\("#confrontoInfoOverlay"\)\.remove\(\);\s*SvuotamentoPagina\._accettaSelezioneCorrente\(\);\s*indesignEvents\.setBusy\(false\);\s*\}/);
});

test("Trova seleziona il box e lo da' per visto, senza aprire la scheda ne' chiudere la finestra", () => {
    const trova = modulo.substring(modulo.indexOf("    trova(riga) {"), modulo.indexOf("    _accettaSelezioneCorrente() {"));

    assert.match(trova, /gruppiConDnaSulLivello\(docInLavorazione, "InPagina", Utility\.getDnaOfBox, \[String\(riga\.paginaDocumento\)\]\)/);
    assert.match(trova, /app\.selection = \[box\];[\s\S]*indesignEvents\.accettaSelezione\(\[box\.id\]\);/);
    assert.doesNotMatch(trova, /closeAllModal|initSchedaRef|chiudiModal/);
});

test("le info si aprono sopra la finestra, e la riga fuori lista mostra l'avviso invece della descrizione", () => {
    const info = modulo.substring(modulo.indexOf("    apriInfo(riga) {"), modulo.indexOf("    trova(riga) {"));
    assert.match(info, /schedaRef\.preparaInfoIspezioneDelDato\(riga\.record, riga\.record\);\s*ReportIntegrita\._apriOverlayInfoReport\("Info dati referenza"\);\s*\$\("#confrontoInfoOverlay"\)\.css\("z-index", String\(Modali\.LIVELLO_CONFERMA \+ 1\)\);/);

    assert.strictEqual(SvuotamentoPagina.AVVISO_FUORI_LISTA, "Referenza non presente in lista scaricata");
    const contenuto = modulo.substring(modulo.indexOf("    contenuto(righe, pagine, azioni) {"), modulo.indexOf("    _icona("));
    assert.match(contenuto, /else \{\s*blocco\.append\(\$\('<div><\/div>'\)\.text\(SvuotamentoPagina\.AVVISO_FUORI_LISTA\)/);
    //I valori entrano come testo, non come HTML.
    assert.doesNotMatch(contenuto, /\.html\(/);
});

test("il nostro suggerimento si spegne al clic delle icone e alla chiusura, e la descrizione non usa title", () => {
    const icona = modulo.substring(modulo.indexOf("    _icona("), modulo.indexOf("    apriInfo(riga) {"));
    //I clic dentro la conferma non arrivano a document, dove Tooltip spegne il riquadro.
    assert.match(icona, /img\.addEventListener\("click", \(\) => \{\s*try \{\s*Tooltip\.nascondiTooltip\(\);\s*alClic\(\);/);
    assert.match(icona, /Tooltip\.impostaTooltip\(img, titolo\);/);

    const contenuto = modulo.substring(modulo.indexOf("    contenuto(righe, pagine, azioni) {"), modulo.indexOf("    _icona("));
    assert.match(contenuto, /Tooltip\.impostaTooltip\(descrizione\[0\], riga\.descrizione\);/);
    assert.doesNotMatch(modulo, /attr\(\{?\s*"?title|setAttribute\("title"|\.title = /);
});

test("le icone stanno lontane dalla barra di scorrimento", () => {
    const contenuto = modulo.substring(modulo.indexOf("    contenuto(righe, pagine, azioni) {"), modulo.indexOf("    _icona("));
    assert.match(contenuto, /const contenitore = \$\('<div><\/div>'\)\.css\(\{ fontSize: '12px', color: 'black', paddingRight: '10px' \}\);/);
});

test("i campi delle pagine di Svuota e Bolli sono input bluastri come quelli dei filtri, leggibili anche mentre si scrive", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    for (const id of ["pagineRangeSvuotatura", "pagineRangeAttivaDisattivaBolli"]) {
        const campo = html.match(new RegExp('<(input|sp-textfield)[^>]*id="' + id + '"[^>]*>'));
        assert.ok(campo != null, id);
        assert.strictEqual(campo[1], "input", id);
        assert.match(campo[0], /type="text"/, id);
        assert.match(campo[0], /color: lightblue;/, id);
        //Ingombro e corpo dello sp-textfield di prima.
        assert.match(campo[0], /width: 192px; height: 32px; font-size: 14px;/, id);
    }
});

test("se il documento non si legge non si decide niente: ogni spostata passerebbe per non impaginata", () => {
    const decidi = modulo.substring(modulo.indexOf("async decidi("));
    assert.match(decidi, /if \(mappaDocumento == null\) \{\s*messaggioUtente\("Code SVP-04[^\n]*\n\s*return false;/);
    //Fermarsi per un errore gia' detto non e' un Annulla: niente "Svuotamento annullato" a coprirlo.
    assert.match(selezione, /if \(decisioni === false\) \{\s*return;\s*\}\s*if \(decisioni == null\) \{\s*messaggioUtente\("Code IDX-171/);
});

/* ---- svuota pagina, sul sorgente ---- */

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
const selezione = indexNew.substring(indexNew.indexOf("async function selectionModalSvuota(mode){"), indexNew.indexOf("/// IMPAGINAZIONE. Svuota l'intero menabo'"));
const svuotaFn = indexNew.substring(indexNew.indexOf("async function svuotaPaginaByPageName("), indexNew.indexOf("function boxConDnaDellaPagina("));

test("l'intervallo si legge una volta sola: se non vale ci si ferma prima di tutto, con la finestra aperta", () => {
    assert.match(selezione, /var letto = confronti\.pagineDellIntervallo\(\$\("#pagineRangeSvuotatura"\)\.val\(\)\);\s*if \(letto\.errore != null\) \{\s*messaggioUtente\("Code IDX-127[^\n]*\n\s*hideLoading\(\);\s*return;\s*\}\s*let pagine = letto\.pagine;\s*var pagineRange = pagine\.join\(","\);\s*Modali\.chiudiModal\(\);/);
    assert.doesNotMatch(selezione, /pagineRangeSplit/);
});

test("un errore a meta' svuotamento si dice", () => {
    assert.match(selezione, /try \{\s*await svuotaPagineDecise\(pagine, pagineRange\);\s*\}\s*catch \(e\) \{\s*console\.error\(e\);\s*messaggioUtente\("Code IDX-195/);
});

test("la domanda del ramo d'errore si aspetta", () => {
    assert.match(selezione, /if \(await Modali\.confirm\("Errore durante l'analisi delle pagine/);
    assert.doesNotMatch(indexNew, /if \(Modali\.confirm\(/);
});

test("la finestra viene prima di sync e svuotamento, e Annulla ferma tutto", () => {
    const decisioni = selezione.indexOf("var decisioni = await SvuotamentoPagina.decidi(preAnalisi, pagine);");
    const sync = selezione.indexOf("var esitoSync = await ReportIntegrita.syncImpaginatoConServer(mappa, preAnalisi);");
    assert.ok(decisioni >= 0 && sync > decisioni);
    assert.match(selezione, /if \(decisioni == null\) \{\s*messaggioUtente\("Code IDX-171 Svuotamento annullato"/);
});

test("se una sync non e' confermata non si svuota", () => {
    assert.match(selezione, /if \(esitoSync !== "Completed"\) \{\s*messaggioUtente\("Code IDX-196[^\n]*\n\s*return;/);
    assert.match(selezione, /if \(decisioni\.spostate\.length > 0\) \{\s*var esitoSpostate = await ReportIntegrita\.syncImpaginatoConServer\(null, \{ resultPaginas: preAnalisiPerSpostate\(decisioni\.spostate\) \}\);\s*if \(esitoSpostate !== "Completed"\) \{\s*messaggioUtente\("Code IDX-172/);
    assert.match(selezione, /await svuotaPagineConEsito\(pagine\);\s*\}\s*$/);
});

test("svuotare una pagina aspetta il server, dice se la pagina e' vuota davvero e non guarda la pagina selezionata", () => {
    assert.match(svuotaFn, /^async function svuotaPaginaByPageName\(pageName\) \{/);
    assert.match(svuotaFn, /while \(!finito\) \{/);
    assert.match(svuotaFn, /Code IDX-173/);
    assert.match(svuotaFn, /var rimasti = boxConDnaDellaPagina\(page\)\.length;\s*if \(rimasti > 0\) \{\s*messaggioUtente\("Code IDX-193[^\n]*\n\s*return;\s*\}\s*svuotata = true;/);
    assert.match(svuotaFn, /return svuotata;/);
    assert.doesNotMatch(svuotaFn, /pagSelected|daMantenere/);
});

test("«Svuotamento completato» solo se tutte le pagine sono state svuotate", async () => {
    const corpo = indexNew.substring(indexNew.indexOf("async function svuotaPagineConEsito("), indexNew.indexOf("/// Quando l'operatore sceglie la promo, riempie le due tendine"));
    const messaggi = [];
    const crea = (esiti) => new Function("svuotaPaginaByPageName", "messaggioUtente", corpo + "\nreturn svuotaPagineConEsito;")(
        async (pagina) => esiti[pagina],
        (testo, stile) => messaggi.push({ testo, stile }));

    assert.deepStrictEqual(await crea({ 11: true, 12: true })([11, 12]), []);
    assert.deepStrictEqual(messaggi.pop(), { testo: "Svuotamento completato: pagine 11, 12", stile: "success" });

    assert.deepStrictEqual(await crea({ 11: true, 12: false, 13: false })([11, 12, 13]), [12, 13]);
    const errore = messaggi.pop();
    assert.strictEqual(errore.stile, "error");
    assert.match(errore.testo, /^Code IDX-194 Svuotamento non completato: le pagine 12, 13 non sono state svuotate/);
    assert.ok(!messaggi.some(m => /Svuotamento completato/.test(m.testo)));

    await crea({ 3: false })([3]);
    assert.match(messaggi.pop().testo, /la pagina 3 non e' stata svuotata/);
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

const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");

test("confirmCustom finisce anche con Annulla", () => {
    const corpo = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));

    assert.match(corpo, /annulla\.click\(function\(\)\{\s*objRes\.result = false;\s*risposto = true;/);
    assert.match(corpo, /while\(!risposto\)\{/);
    assert.doesNotMatch(corpo, /while\(objRes\.hiddenVal == null\)/);
});

test("confirmCustom e confirm valgono come Annulla se la finestra la toglie qualcun altro", () => {
    const custom = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));
    assert.match(custom, /while\(!risposto\)\{\s*if \(document\.getElementById\(idMessaggio\) == null\) \{\s*objRes\.result = false;\s*objRes\.hiddenVal = null;\s*break;\s*\}/);

    const confirm = modali.substring(modali.indexOf("async confirm (message){"), modali.indexOf("closeAllModal(){"));
    assert.match(confirm, /while\(result == null\)\{\s*if \(document\.getElementById\(idMessaggio\) == null\) \{\s*return false;\s*\}/);
    //Si guarda nella pagina, non il genitore del primo elemento di un oggetto jQuery creato da testo.
    assert.doesNotMatch(modali, /modal\.parent\(\)/);
});

test("confirmCustom ha il piede fisso: l'altezza del messaggio viene dal pannello e si scrive sull'elemento della pagina", () => {
    const Modali = require("../../plugin/modali/modali.js");
    const corpo = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));
    //Il codice, senza i commenti che raccontano il difetto.
    const codice = corpo.split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");

    //Il pannello misurato il 26/10/2026: 628 px, riquadro 535, piede 50.
    assert.strictEqual(Modali.ALTEZZA_PIEDE_CONFERMA, 50);
    assert.strictEqual(Modali.altezzaMassimaMessaggio(628), 453);
    assert.strictEqual(Modali.altezzaMassimaMessaggio(0), Modali.altezzaMassimaMessaggio(600));
    assert.strictEqual(Modali.altezzaMassimaMessaggio(100), 60);

    //Un id nuovo per ogni conferma, per ritrovare il messaggio nella pagina.
    assert.notStrictEqual(Modali.nuovoIdMessaggio(), Modali.nuovoIdMessaggio());
    assert.match(codice, /var idMessaggio = Modali\.nuovoIdMessaggio\(\);\s*var messaggio = \$\('<div id="' \+ idMessaggio \+ '"/);

    assert.match(codice, /height: ' \+ Modali\.ALTEZZA_PIEDE_CONFERMA \+ 'px; box-sizing: border-box;/);
    assert.match(codice, /var elMessaggio = document\.getElementById\(idMessaggio\);\s*if \(elMessaggio != null\) \{\s*elMessaggio\.style\.flex = "0 0 auto";\s*elMessaggio\.style\.overflowY = "auto";\s*elMessaggio\.style\.maxHeight = massimo \+ "px";/);
    //Se l'altezza massima non bastasse, quella fissa, sull'elemento della pagina.
    assert.match(codice, /var el = document\.getElementById\(idMessaggio\);\s*if \(el != null && el\.scrollHeight > massimo\) \{\s*el\.style\.height = massimo \+ "px";\s*altezzaFissata = true;/);
    //Mai sul primo elemento di un oggetto jQuery creato da testo, ne' con .css di jQuery.
    assert.doesNotMatch(codice, /(messaggio|modal|pulsanti|dialog)\[0\]/);
    assert.doesNotMatch(codice, /messaggio\.css\(\{ (max-?[Hh]eight|height)/);
});

test("confirmCustom accetta un elemento e, se il messaggio non ci sta, lo fa scorrere", () => {
    const corpo = modali.substring(modali.indexOf("async confirmCustom ("), modali.indexOf("apriModal(modalId"));

    assert.match(corpo, /if \(message instanceof jQuery \|\| message instanceof Element\) \{\s*messaggio\.append\(message\);/);
    //In UXP scorre solo un contenitore con un'altezza in pixel. TASK-19c18841: un'altezza massima,
    //scritta sullo stile dell'elemento della pagina.
    assert.match(corpo, /elMessaggio\.style\.flex = "0 0 auto";\s*elMessaggio\.style\.overflowY = "auto";\s*elMessaggio\.style\.maxHeight = /);
});

test("la sync dice Fallita quando il server rifiuta, invece di Completed, e dice al server se a spostare e' il report", () => {
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const corpo = report.substring(report.indexOf("async syncImpaginatoConServer("), report.indexOf("    percorsoFileReport("));

    assert.match(corpo, /Code CNF-010[^\n]*\n\s*stato = "Fallita";\s*return;/);
    assert.match(corpo, /if \(stato === "Fallita"\) \{\s*return stato;\s*\}\s*stato = "Completed";/);
    assert.match(corpo, /if \(origine != null\) \{\s*formData\.append\("origine", origine\);/);
    assert.match(report, /ReportIntegrita\.syncImpaginatoConServer\(mappa, preAnalisiMismatchNumeriPagina, true, "report"\)/);
});

/* ---- lato server ---- */

const controller = fs.readFileSync(path.join(__dirname, "..", "..", "Istanta", "Controllers", "MenaboController.cs"), "utf8").replace(/\r/g, "");

test("lato server una pagina in errore lascia falso l'esito della pre-analisi", () => {
    const corpo = controller.substring(controller.indexOf("public async Task<IActionResult> PreAnalisiMismatch("), controller.indexOf("Menabo/syncImpaginatoConServer/"));

    assert.match(corpo, /if \(res\.errors\.Count == 0\)\s*\{\s*res\.esito = true;\s*\}/);
    assert.doesNotMatch(corpo, /\n\s*res\.esito = true;\n\s*esitoPagina\.nomePagina/);
});

test("lato server ogni cambio di pagina di un box impaginato passa da PortaAPagina, che ne aggiorna l'autore", () => {
    //Gli unici record gia' esistenti a cui si cambia la pagina: sync, impaginaSingolo con bypass,
    //ricollegaBox. Fuori da PortaAPagina nessuno assegna piu' la pagina a mano.
    const inizioPorta = controller.indexOf("public static bool PortaAPagina(");
    const finePorta = controller.indexOf("\n        }\n", inizioPorta);
    assert.ok(inizioPorta > 0 && finePorta > inizioPorta);
    const fuoriDaPorta = controller.substring(0, inizioPorta) + controller.substring(finePorta);
    assert.doesNotMatch(fuoriDaPorta, /\n\s*(record|recordDaCambiarePagina|giaImpaginato|plr)\.Pagina = /);
    assert.match(controller, /PortaAPagina\(record, Byte\.Parse\(paginaMappa\.nomePagina!\), AutoreSpostamenti\);/);
    assert.match(controller, /PortaAPagina\(recordDaCambiarePagina, byte\.Parse\(pag\.nomePagina!\), AutoreSpostamenti\);/);
    assert.match(controller, /PortaAPagina\(giaImpaginato, richiesta\.pagina, \(\) => id_utente\);/);
    assert.match(controller, /PortaAPagina\(plr, request\.elementoDaRicollegare\.pag, IdUtenteDellaSessione\);/);
    //Con origine "report" l'autore e' il report, avviato dall'utente della sessione.
    assert.match(controller, /autoreSpostamenti = origine == "report" \? AutoreDelReport\(idUtente\) : idUtente;/);
});
