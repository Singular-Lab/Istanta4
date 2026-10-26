/*
 * I20-1124: la versione precedente di un box rifatto in pagina.
 *
 * Il nuovo prende la posizione del vecchio su InPagina; il vecchio resta sopra per il confronto,
 * scostato di dieci punti, al 60%, sul livello cloneVecchioImpaginato, che non si stampa. Vale per
 * le azioni sul box e per Reimpagina box, che prima lasciava il vecchio al suo posto e metteva il
 * nuovo scostato sopra. Selezionare un clone non apre la scheda: solo "Riporta in pagina". Il
 * Report Integrita' scansiona il livello: i cloni con il box in pagina sono da eliminare, col
 * contrassegno "Clone"; quelli senza stanno fra i modificati con Trova, Torna in pagina ed
 * Elimina, e Torna in pagina ricollega la referenza se il server non la considera impaginata, poi
 * rianalizza il box senza rifare il report. Il Fix del report e' un Reimpagina con rianalisi.
 *
 * versionePrecedente.js, avvio.js, csv.js e ricollegaEsiti.js sono puri; il report si carica con
 * l'app di InDesign finta; il resto si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

//InDesign finto: a chi chiede "indesign" si danno l'app e le LocationOptions.
const appFinta = { selection: [], activeWindow: {} };
const LOCATION = { before: "PRIMA" };
const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { app: appFinta, LocationOptions: LOCATION };
    }
    return caricaOriginale.apply(this, arguments);
};

const VersionePrecedente = require("../../plugin/versionePrecedente.js");
const avvio = require("../../plugin/reportIntegrita/avvio.js");
const csv = require("../../plugin/reportIntegrita/csv.js");
const RicollegaEsiti = require("../../plugin/ricollegaEsiti.js");
const ReportIntegrita = require("../../plugin/reportIntegrita/reportIntegrita.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio));
}

async function conSostituti(oggetto, sostituti, fn) {
    const prima = {};
    Object.keys(sostituti).forEach(k => { prima[k] = { c: Object.prototype.hasOwnProperty.call(oggetto, k), v: oggetto[k] }; oggetto[k] = sostituti[k]; });
    try {
        return await fn();
    }
    finally {
        Object.keys(prima).forEach(k => { if (prima[k].c) { oggetto[k] = prima[k].v; } else { delete oggetto[k]; } });
    }
}

/* ---- il documento finto ---- */

function documentoFinto() {
    const livelli = {};
    const doc = {
        layers: {
            itemByName: (nome) => livelli[nome] || { name: nome, isValid: false },
            add: ({ name }) => {
                const livello = { name, isValid: true, printable: true, mosse: [], move(dove, riferimento) { this.mosse.push([dove, riferimento.name]); } };
                livelli[name] = livello;
                return livello;
            }
        },
        pages: { length: 0, item: (i) => doc._pagine[i] },
        _pagine: []
    };
    doc.layers.add({ name: "InPagina" });
    doc.aggiungiPagina = function (nome, gruppi) {
        const pagina = { name: nome, groups: { length: gruppi.length, item: (i) => gruppi[i] } };
        gruppi.forEach(g => { g.parentPage = pagina; });
        doc._pagine.push(pagina);
        doc.pages.length = doc._pagine.length;
        return pagina;
    };
    return doc;
}

let prossimoId = 100;
function boxFinto(doc, livello, dna) {
    return {
        id: prossimoId++,
        isValid: true,
        posizione: [50, 20],
        geometricBounds: [20, 50, 120, 150],
        itemLayer: doc.layers.itemByName(livello),
        transparencySettings: { blendingSettings: { opacity: 100 } },
        dna: dna || null,
        move(_, delta) { this.posizione = [this.posizione[0] + delta[0], this.posizione[1] + delta[1]]; }
    };
}

const leggiDna = (gruppo) => gruppo.dna;

/* ---- il modulo ---- */

test("mettere da parte: scostato in alto a destra, al 60%, sul livello non stampabile creato sopra InPagina", () => {
    const doc = documentoFinto();
    const box = boxFinto(doc, "InPagina");

    VersionePrecedente.mettiDaParte(box, doc);

    assert.deepStrictEqual(box.posizione, [60, 10]);
    assert.strictEqual(box.itemLayer.name, "cloneVecchioImpaginato");
    assert.strictEqual(box.itemLayer.printable, false);
    assert.deepStrictEqual(box.itemLayer.mosse, [["PRIMA", "InPagina"]]);
    assert.strictEqual(box.transparencySettings.blendingSettings.opacity, 60);
    assert.strictEqual(VersionePrecedente.eVersionePrecedente(box), true);
});

test("il livello gia' esistente si riusa e si rende non stampabile, senza spostarlo di nuovo", () => {
    const doc = documentoFinto();
    const esistente = doc.layers.add({ name: "cloneVecchioImpaginato" });
    esistente.printable = true;

    const livello = VersionePrecedente.livello(doc);

    assert.strictEqual(livello, esistente);
    assert.strictEqual(livello.printable, false);
    assert.deepStrictEqual(livello.mosse, []);
});

test("riportare in pagina: su InPagina, dov'era, opaco", () => {
    const doc = documentoFinto();
    const box = boxFinto(doc, "InPagina");
    VersionePrecedente.mettiDaParte(box, doc);

    VersionePrecedente.riportaInPagina(box, doc);

    assert.deepStrictEqual(box.posizione, [50, 20]);
    assert.strictEqual(box.itemLayer.name, "InPagina");
    assert.strictEqual(box.transparencySettings.blendingSettings.opacity, 100);
    assert.strictEqual(VersionePrecedente.eVersionePrecedente(box), false);
    assert.strictEqual(VersionePrecedente.eVersionePrecedente(null), false);
});

test("la stessa presenza e' codice gruppo e idRec, vuoto compreso", () => {
    assert.strictEqual(VersionePrecedente.stessaPresenza("680443", 12, "680443", "12"), true);
    assert.strictEqual(VersionePrecedente.stessaPresenza("680443", null, "680443", ""), true);
    assert.strictEqual(VersionePrecedente.stessaPresenza("680443", 12, "680443", 13), false);
    assert.strictEqual(VersionePrecedente.stessaPresenza("680443", null, "680444", null), false);
});

test("il box in pagina e la versione precedente di una presenza si cercano per livello, in tutte le pagine", () => {
    const doc = documentoFinto();
    VersionePrecedente.livello(doc);
    const inPagina = boxFinto(doc, "InPagina", { codice_gruppo: "680443", idRec: "12" });
    const clone = boxFinto(doc, "cloneVecchioImpaginato", { codice_gruppo: "680443", idRec: "12" });
    const altro = boxFinto(doc, "InPagina", { codice_gruppo: "999", idRec: "1" });
    const senzaDna = boxFinto(doc, "cloneVecchioImpaginato", null);
    doc.aggiungiPagina("3", [altro, senzaDna]);
    doc.aggiungiPagina("7", [clone, inPagina]);

    assert.strictEqual(VersionePrecedente.boxInPaginaPer(doc, "680443", 12, leggiDna), inPagina);
    assert.strictEqual(VersionePrecedente.versionePrecedenteDi(doc, "680443", 12, leggiDna), clone);
    assert.strictEqual(VersionePrecedente.boxInPaginaPer(doc, "680443", 13, leggiDna), null);
    assert.strictEqual(VersionePrecedente.versionePrecedenteDi(doc, "999", 1, leggiDna), null);

    const trovati = VersionePrecedente.gruppiConDnaSulLivello(doc, "cloneVecchioImpaginato", leggiDna);
    assert.deepStrictEqual(trovati.map(t => [t.gruppo, t.pagina]), [[clone, "7"]]);
    assert.deepStrictEqual(VersionePrecedente.gruppiConDnaSulLivello(doc, "InPagina", leggiDna, ["3"]).map(t => t.gruppo), [altro]);
});

/* ---- le decisioni del report ---- */

const MAPPA = { "3": [{ codiceGruppo: "680443", idRec: 12 }], "5": [{ codiceGruppo: "111", idRec: null }] };

test("un clone con il suo box in pagina, in qualunque pagina, e' da eliminare; senza e' da riportare", () => {
    const versioni = {
        "7": [{ refId: 1, codiceGruppo: "680443", idRec: 12 }, { refId: 2, codiceGruppo: "680443", idRec: 13 }],
        "5": [{ refId: 3, codiceGruppo: "111", idRec: null }]
    };
    const esito = avvio.classificaVersioniPrecedenti(versioni, MAPPA);

    //Le pagine si scorrono nell'ordine delle chiavi: la 5 prima della 7.
    assert.deepStrictEqual(esito.daEliminare.map(v => [v.elemento.refId, v.pagina]), [[3, "5"], [1, "7"]]);
    assert.deepStrictEqual(esito.daRiportare.map(v => [v.elemento.refId, v.pagina]), [[2, "7"]]);
    assert.strictEqual(esito.daEliminare[1].elementiPagina, versioni["7"]);
    assert.deepStrictEqual(avvio.classificaVersioniPrecedenti(null, MAPPA), { daEliminare: [], daRiportare: [] });
});

test("il record di una versione precedente: fra gli eliminati senza segnalazioni, fra i modificati con quella che dice cosa fare", () => {
    const voce = { elemento: { refId: 9, codiceGruppo: "680443", idRec: 13 }, pagina: "7", elementiPagina: [] };

    const daEliminare = avvio.recordVersionePrecedente(voce, true);
    assert.strictEqual(daEliminare.versionePrecedente, true);
    assert.strictEqual(daEliminare.inddId, 9);
    assert.strictEqual(daEliminare.preAnalisi, null);
    assert.strictEqual(daEliminare.numeroPagina, "7");

    const daRiportare = avvio.recordVersionePrecedente(voce, false);
    assert.deepStrictEqual(daRiportare.preAnalisi.differenze.map(d => d.label), ["Versione precedente"]);
    assert.strictEqual(avvio.eRecordVersionePrecedente(daRiportare), true);
    assert.strictEqual(avvio.eRecordVersionePrecedente({ codiceGruppo: "1" }), false);
    assert.strictEqual(avvio.eRecordVersionePrecedente(null), false);
});

test("nel csv la versione precedente porta il contrassegno Clone accanto allo stato", () => {
    assert.strictEqual(csv.statoVoce("Eliminato", true), "Eliminato (Clone)");
    assert.strictEqual(csv.statoVoce("Cambiato", false), "Cambiato");
    assert.strictEqual(csv.statoVoce("Cambiato", undefined), "Cambiato");
});

test("l'esito di una risposta di ricollegamento, per chi la attende senza scheda", () => {
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 2 }], idRecSelezionato: 44 }).esito, "ricollegato");
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 2 }], idRecSelezionato: 44 }).idRecSelezionato, 44);
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 1 }] }).esito, "ricollegato");
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 7 }] }).esito, "clonazione");
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 5 }] }).esito, "errore");
    assert.match(RicollegaEsiti.esitoDellaRisposta({ error: "boom", codici: [] }).messaggio, /boom/);
    assert.match(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 1, error: "non mio" }] }).messaggio, /non mio/);
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta(null).esito, "errore");
    //Gli avvisi dei singoli esiti si riportano, come fa la scheda.
    assert.strictEqual(RicollegaEsiti.esitoDellaRisposta({ codici: [{ stato: 1 }] }).messaggi.length, 1);
});

/* ---- Torna in pagina dal report: il flusso con tutto finto ---- */

function recordClone(doc, box) {
    return avvio.recordVersionePrecedente({ elemento: { ref: box, refId: box.id, codiceGruppo: "680443", idRec: 12 }, pagina: "7", elementiPagina: [] }, false);
}

test("Torna in pagina: il box torna su InPagina, si ricollega se il server non lo considera impaginato, poi si rianalizza e il csv si riscrive", async () => {
    const doc = documentoFinto();
    const box = boxFinto(doc, "InPagina", { codice_gruppo: "680443", idRec: "12" });
    VersionePrecedente.mettiDaParte(box, doc);
    const record = recordClone(doc, box);
    const eventi = [];
    const stato = { report: { recordCambiati: [record], recordUsciti: [], recordConErrori: [], recordGiusti: [] } };

    await conSostituti(global, { docInLavorazione: doc, Utility: { getDnaOfBox: leggiDna }, messaggioUtente: (t) => eventi.push("msg:" + t.substring(0, 12)) }, () =>
        conSostituti(ReportIntegrita, {
            _confrontoReportState: stato,
            _resolveBoxFromRecord: () => box,
            _leggiSchedaRefConStato: async () => { eventi.push("lettura"); return { records: null, nonImpaginata: true }; },
            _ricollegaDalReport: async () => { eventi.push("ricollega"); return { esito: "ricollegato", messaggi: [] }; },
            _ricontrollaReferenzaDopoScheda: async (s) => { eventi.push("ricontrollo:" + s.codiceGruppo + ":" + s.idRec); return { record: s.record, chiaviRisolte: [], applica: () => eventi.push("applica") }; },
            _applicaPianoRicontrollo: async (piano) => { piano.applica(); },
            _riscriviCsvDelReport: async () => { eventi.push("csv"); },
            _saveCurrentReportAndWhitelist: () => eventi.push("salva"),
            _refreshConfrontoReportUi: () => eventi.push("ridisegna")
        }, () => ReportIntegrita._tornaInPaginaVersionePrecedente("p1", { tipo: "cambiato", record })));

    assert.strictEqual(box.itemLayer.name, "InPagina");
    assert.strictEqual(box.transparencySettings.blendingSettings.opacity, 100);
    assert.deepStrictEqual(box.posizione, [50, 20]);
    assert.strictEqual(record.versionePrecedente, false);
    assert.deepStrictEqual(eventi, ["lettura", "ricollega", "ricontrollo:680443:12", "applica", "csv"]);
});

test("Torna in pagina con la referenza gia' impaginata: nessun ricollegamento; se il ricollegamento fallisce la riga resta e lo si dice", async () => {
    const doc = documentoFinto();
    const box = boxFinto(doc, "InPagina", { codice_gruppo: "680443", idRec: "12" });
    VersionePrecedente.mettiDaParte(box, doc);
    const record = recordClone(doc, box);
    const eventi = [];
    const base = {
        _confrontoReportState: { report: { recordCambiati: [record], recordUsciti: [], recordConErrori: [], recordGiusti: [] } },
        _resolveBoxFromRecord: () => box,
        _ricollegaDalReport: async () => { eventi.push("ricollega"); return { esito: "errore", messaggio: "no", messaggi: [] }; },
        _ricontrollaReferenzaDopoScheda: async () => { eventi.push("ricontrollo"); return null; },
        _aggiornaRiferimentiBox: () => eventi.push("riferimenti"),
        _riscriviCsvDelReport: async () => { eventi.push("csv"); },
        _saveCurrentReportAndWhitelist: () => eventi.push("salva"),
        _refreshConfrontoReportUi: () => eventi.push("ridisegna")
    };
    const messaggi = [];
    const globali = { docInLavorazione: doc, Utility: { getDnaOfBox: leggiDna }, messaggioUtente: (t) => messaggi.push(t) };

    await conSostituti(global, globali, () => conSostituti(ReportIntegrita, Object.assign({}, base, {
        _leggiSchedaRefConStato: async () => ({ records: [{}], nonImpaginata: false })
    }), () => ReportIntegrita._tornaInPaginaVersionePrecedente("p1", { tipo: "cambiato", record })));
    assert.deepStrictEqual(eventi, ["ricontrollo", "riferimenti", "salva", "ridisegna", "csv"]);

    eventi.length = 0;
    VersionePrecedente.mettiDaParte(box, doc);
    await conSostituti(global, globali, () => conSostituti(ReportIntegrita, Object.assign({}, base, {
        _leggiSchedaRefConStato: async () => ({ records: null, nonImpaginata: true })
    }), () => ReportIntegrita._tornaInPaginaVersionePrecedente("p1", { tipo: "cambiato", record })));
    assert.deepStrictEqual(eventi, ["ricollega", "riferimenti", "salva", "ridisegna", "csv"]);
    assert.ok(messaggi.some(m => /CNF-93/.test(m)));
    assert.strictEqual(box.itemLayer.name, "InPagina");
});

test("la versione precedente tenuta da un Fix entra fra i box da eliminare, una volta sola", () => {
    const doc = documentoFinto();
    VersionePrecedente.livello(doc);
    const clone = boxFinto(doc, "cloneVecchioImpaginato", { codice: "680443", codice_gruppo: "680443", idRec: "12" });
    doc.aggiungiPagina("7", [clone]);
    const stato = { report: { recordCambiati: [], recordUsciti: [], recordConErrori: [], recordGiusti: [] } };

    conSostituti(global, { docInLavorazione: doc, Utility: { getDnaOfBox: leggiDna } }, () =>
        conSostituti(ReportIntegrita, { _confrontoReportState: stato }, () => {
            assert.strictEqual(ReportIntegrita._aggiungiVersionePrecedenteTenuta("680443", 12), true);
            assert.strictEqual(ReportIntegrita._aggiungiVersionePrecedenteTenuta("680443", 12), false);
            assert.strictEqual(ReportIntegrita._aggiungiVersionePrecedenteTenuta("999", 1), false);
        }));

    assert.strictEqual(stato.report.recordUsciti.length, 1);
    assert.strictEqual(stato.report.recordUsciti[0].versionePrecedente, true);
    assert.strictEqual(stato.report.recordUsciti[0].inddId, clone.id);
    assert.strictEqual(stato.report.recordUsciti[0].numeroPagina, "7");
});

test("il report nasce con le versioni precedenti classificate", () => {
    const reportObj = { recordCambiati: [], recordUsciti: [], recordConErrori: [], recordGiusti: [] };
    const versioni = { "7": [{ refId: 1, codiceGruppo: "680443", idRec: 12 }, { refId: 2, codiceGruppo: "680443", idRec: 13 }] };

    ReportIntegrita.aggiungiVersioniPrecedenti(reportObj, versioni, MAPPA);

    assert.deepStrictEqual(reportObj.recordUsciti.map(r => r.inddId), [1]);
    assert.deepStrictEqual(reportObj.recordCambiati.map(r => r.inddId), [2]);
    assert.ok(reportObj.recordCambiati.every(r => r.versionePrecedente === true));
});

/* ---- il sorgente ---- */

test("azione sul box e Reimpagina box mettono da parte il vecchio allo stesso modo, e il nuovo esce in posizione", () => {
    const confronti = sorgente("confronti.js");
    assert.match(confronti, /VersionePrecedente\.mettiDaParte\(box1, docInLavorazione\)/);
    assert.doesNotMatch(confronti, /layers\.add\(\{ name: "cloneVecchioImpaginato" \}\)/);
    assert.match(confronti, /mappaturaVersioniPrecedenti\(nomiPagine = null\) \{/);

    const scheda = sorgente("schedaRef.js");
    const reimpagina = corpoMembro(scheda, "    async applicaReimpaginazione(){");
    assert.match(reimpagina, /var bounds = boxPrecedente\.geometricBounds;/);
    assert.doesNotMatch(reimpagina, /bounds\[0\] - 10/);
    const daParte = reimpagina.indexOf("VersionePrecedente.mettiDaParte(boxPrecedente, docInLavorazione)");
    const impagina = reimpagina.indexOf("impaginazioneSingoloIndd(schedaRef, pagina, false, null, false, bounds, false, false)");
    assert.ok(daParte > 0 && impagina > daParte, "il vecchio va da parte prima di impaginare il nuovo");
});

test("selezionare una versione precedente non apre la scheda: solo Riporta in pagina", () => {
    const eventi = sorgente("events.js");
    assert.match(eventi, /EVENT_NEW_VERSIONE_PRECEDENTE_SELECTED = "newVersionePrecedenteSelected"/);
    const ramo = eventi.substring(eventi.indexOf("if (is_ref && VersionePrecedente.eVersionePrecedente(el))"), eventi.indexOf("else if (is_ref) {"));
    assert.match(ramo, /me\.fireEvent\(me\.EVENT_NEW_VERSIONE_PRECEDENTE_SELECTED, me\.lastSelectionDetails\)/);
    //Una volta per selezione: la vigilanza passa di qui a ogni giro.
    assert.match(ramo, /idInDesign == el\.id/);

    const indexNew = sorgente("indexNew.js");
    const ascolto = indexNew.substring(indexNew.indexOf("indesignEvents.EVENT_NEW_VERSIONE_PRECEDENTE_SELECTED, async function"), indexNew.indexOf("function riportaVersionePrecedenteInPagina(box)"));
    assert.match(ascolto, /schedaRef\.svuotaRef\(\)/);
    assert.match(ascolto, /buttonText: "Riporta in pagina"/);
    assert.doesNotMatch(ascolto, /initSchedaRef/);
    const riporta = indexNew.substring(indexNew.indexOf("function riportaVersionePrecedenteInPagina(box)"), indexNew.indexOf("indesignEvents.EVENT_NEW_MULTIREF_SELECTED"));
    assert.match(riporta, /VersionePrecedente\.riportaInPagina\(box, docInLavorazione\)/);
    assert.match(riporta, /indesignEvents\.resetLastSelection\(\)/);
    assert.doesNotMatch(riporta, /rimuoviRefImpaginata|ricollega/);
});

test("nel report i cloni hanno il contrassegno e le tre sole azioni, Trova seleziona e basta, il Fix e' un Reimpagina con rianalisi", () => {
    const pannelli = sorgente("reportIntegrita/pannelli.js");
    const cambiati = corpoMembro(pannelli, "    _buildPanelCambiati(records) {");
    assert.match(cambiati, /_crIconButton\("Reimpagina box", "images\/reimpaginaFix\.png"\)/);
    assert.match(cambiati, /_crIconButton\("Torna in pagina", "images\/ImpaginaRef\.png"\)/);
    const inizioRamo = cambiati.indexOf('const btnTorna = this._crIconButton("Torna in pagina"');
    const ramoClone = cambiati.substring(inizioRamo, cambiati.indexOf("else {", inizioRamo));
    assert.match(ramoClone, /_onConfrontoAction\(ev, "tornaInPagina"\)/);
    assert.doesNotMatch(ramoClone, /btnFix|btnResolve|btnWhitelist|btnInfo/);
    assert.match(cambiati, /codice\.appendChild\(this\._crContrassegnoClone\(\)\)/);

    const eliminati = corpoMembro(pannelli, "    _buildPanelEliminati(records) {");
    assert.match(eliminati, /codice\.appendChild\(this\._crContrassegnoClone\(\)\)/);
    const contrassegno = corpoMembro(pannelli, "    _crContrassegnoClone() {");
    assert.match(contrassegno, /textContent = "Clone"/);
    assert.match(contrassegno, /Tooltip\.impostaTooltip\(contrassegno/);

    const report = sorgente("reportIntegrita/reportIntegrita.js");
    const apri = corpoMembro(report, "    async _apriSchedaDalReport(payloadId, payload) {");
    assert.match(apri, /if \(reportIntegritaAvvio\.eRecordVersionePrecedente\(payload\?\.record\)\) \{\s*this\._findElemento\(payload\);\s*return;/);
    const azione = corpoMembro(report, "    async _eseguiAzioneConfronto(action, payloadId, payload) {");
    assert.match(azione, /case "tornaInPagina":\s*await this\._tornaInPaginaVersionePrecedente\(payloadId, payload\)/);

    const fix = corpoMembro(report, "    async _fixElemento(payloadId, payload) {");
    assert.match(fix, /VersionePrecedente\.boxInPaginaPer\(docInLavorazione, codiceGruppo, idRec, Utility\.getDnaOfBox\)/);
    assert.match(fix, /await this\._ricontrollaReferenzaDopoScheda\(\{ record, box: boxNuovo, codiceGruppo, idRec, payloadId \}\)/);
    assert.match(fix, /this\._aggiungiVersionePrecedenteTenuta\(codiceGruppo, idRec\)/);
    assert.match(fix, /await this\._riscriviCsvDelReport\(\)/);

    const avvia = report.substring(report.indexOf("async avviaReportIntegrita("), report.indexOf("async avvisoSegnalazioniPrimaDelReport("));
    assert.match(avvia, /confronti\.mappaturaVersioniPrecedenti\(ReportIntegrita\.nomiPagineDelDocumento\(\)\)/);
    const applica = report.substring(report.indexOf("async applicaConfronto("), report.indexOf("chiudiSeNonValePiu(documentoAttuale) {"));
    assert.match(applica, /ReportIntegrita\.aggiungiVersioniPrecedenti\(reportObj, versioniPrecedenti, mappa\)/);

    //Il csv si riscrive nello stesso file: nessun file nuovo (I20-981).
    const csvRiscritto = corpoMembro(report, "    async _riscriviCsvDelReport() {");
    assert.match(csvRiscritto, /this\._csvDelReportCorrente/);
    assert.doesNotMatch(csvRiscritto, /_nomeFileReportCsv/);
    assert.match(report, /reportConfrontoCsv\.statoVoce\(stato, record\?\.versionePrecedente === true\)/);
});

test("il ricollegamento atteso dal report usa la stessa richiesta della scheda", () => {
    const scheda = sorgente("schedaRef.js");
    const ricollega = corpoMembro(scheda, "    async ricollegaBoxImpaginato(box, externalCall = false, codiceGruppo = null) {");
    assert.match(ricollega, /this\.richiestaDiRicollegamento\(box, dna, codiceGruppo\)/);
    assert.doesNotMatch(ricollega, /ficoProcess\.getCanaleLavorazioneCorrente/);
    const atteso = corpoMembro(scheda, "    ricollegaBoxImpaginatoAttendendo(box) {");
    assert.match(atteso, /me\.richiestaDiRicollegamento\(box, dna, dna\.codice_gruppo\)/);
    assert.match(atteso, /RicollegaEsiti\.esitoDellaRisposta\(objResult\)/);
    assert.match(atteso, /xhr\.send\("Menabo\/ricollegaBox", richiesta\.formData, "PUT"\)/);
    assert.doesNotMatch(atteso, /Modali\.confirm|showLoading|initSchedaRef/);

    const report = sorgente("reportIntegrita/reportIntegrita.js");
    const dalReport = corpoMembro(report, "    async _ricollegaDalReport(box) {");
    assert.match(dalReport, /schedaRef\.ricollegaBoxImpaginatoAttendendo\(box\)/);
    assert.match(dalReport, /Promise\.race/);
    const lettura = corpoMembro(report, "    _leggiSchedaRefConStato(codiceGruppo, idRec) {");
    assert.match(lettura, /risultato\.errorCode == 8/);
});
