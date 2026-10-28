/*
 * I20-1063, lotto 3: Foto extra sulla selezione multipla.
 *
 * Con piu' box selezionati la schermata Foto extra elenca le extra di tutti i box, riconosciute per
 * chiave (sigla o nome) e tipo come nella scheda di un box: prima quelle presenti in tutti, poi le
 * altre con "in X box su N", e lo stato misto quando sono attive in alcuni box e no in altri (escluse
 * o incluse, per le automatiche). Attiva, Disattiva, Elimina, Includi ed Escludi agiscono su tutti i
 * box che hanno l'extra, lasciando stare quelli dove la governa una decisione per la lavorazione.
 * Link non propone quello che c'e' gia' in tutti i box e aggiunge solo ai box a cui manca.
 *
 * Il modulo e' reperimentoFoto/fotoExtraPiuBox.js, mescolato in schedaRef come schedaFoto: le parti
 * pure si chiamano direttamente, le operazioni con il server e il documento sostituiti.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const schedaRef = require('../../plugin/schedaRef');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');
const leggi = (nome) => fs.readFileSync(path.join(cartellaPlugin, nome), 'utf8').replace(/\r/g, '');

const extra = (sigla, tipo, attiva, guidId = sigla + "-guid") => ({ nome: sigla + ".psd", sigla: sigla, tipo: tipo, guidId: guidId, attiva: attiva });
const auto = (sigla, tipo, escluso) => ({ nome: sigla + ".psd", sigla: sigla, tipo: tipo, escluso: escluso });
//Una decisione per la lavorazione su un logo (tipo elemento 2) o una foto extra (3).
const decisione = (sigla, tipoFoto) => ({ sigla: sigla, tipo: tipoFoto == 3 ? 2 : 3, azione: 3 });

/* ---- le righe ---- */

test("le extra si riconoscono per sigla e tipo: prima quelle in tutti i box, poi per numero di box", () => {
    const righe = schedaRef.righeFotoExtraPiuBox([
        { elementi: [extra("BIO", 3, true), extra("DOP", 3, true), extra("BIO", 2, true)], decisioni: [] },
        { elementi: [extra("DOP", 3, false), extra("BIO", 3, true)], decisioni: [] },
        { elementi: [extra("BIO", 3, true, "altro-guid")], decisioni: [] }
    ], "attiva");

    assert.deepStrictEqual(righe.map(r => [r.id, r.box.length, r.stato, r.inTuttiIBox]), [
        ["3:BIO", 3, "si", true],
        ["3:DOP", 2, "misto", false],
        ["2:BIO", 1, "si", false]
    ]);
    //Ogni box tiene la sua extra: il guid cambia da referenza a referenza.
    assert.deepStrictEqual(righe[0].box.map(x => x.elemento.guidId), ["BIO-guid", "BIO-guid", "altro-guid"]);
    assert.strictEqual(righe[1].totaleBox, 3);
});

test("un'extra caricata a mano senza sigla si riconosce dal nome del file", () => {
    const senzaSigla = { nome: "bollino.png", sigla: null, tipo: 2, guidId: "g", attiva: true };
    const righe = schedaRef.righeFotoExtraPiuBox([
        { elementi: [senzaSigla], decisioni: [] },
        { elementi: [Object.assign({}, senzaSigla, { sigla: "null" })], decisioni: [] }
    ], "attiva");

    assert.deepStrictEqual(righe.map(r => [r.id, r.box.length]), [["2:bollino.png", 2]]);
});

test("lo stato guarda solo i box senza decisione per la lavorazione", () => {
    const righe = schedaRef.righeFotoExtraPiuBox([
        { elementi: [extra("BIO", 3, false)], decisioni: [decisione("BIO", 3)] },
        { elementi: [extra("BIO", 3, true)], decisioni: [] },
        { elementi: [extra("SDB", 3, true)], decisioni: [decisione("SDB", 3)] }
    ], "attiva");

    const bio = righe.find(r => r.id === "3:BIO");
    assert.strictEqual(bio.stato, "si");
    assert.strictEqual(bio.conDecisione, 1);
    //Governata solo da decisioni: nessuno stato e nessun pulsante.
    const sdb = righe.find(r => r.id === "3:SDB");
    assert.strictEqual(sdb.stato, null);
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(sdb, false), []);
});

test("le extra automatiche usano lo stato escluso, con Includi ed Escludi", () => {
    const [mista] = schedaRef.righeFotoExtraPiuBox([
        { elementi: [auto("SDB", 3, true)], decisioni: [] },
        { elementi: [auto("SDB", 3, false)], decisioni: [] }
    ], "escluso");

    assert.strictEqual(mista.stato, "misto");
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(mista, true).map(p => p.azione), ["includi", "escludi"]);
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(Object.assign({}, mista, { stato: "si" }), true).map(p => p.azione), ["includi"]);
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(Object.assign({}, mista, { stato: "no" }), true).map(p => p.azione), ["escludi"]);
});

test("le extra hanno Attiva o Disattiva in tutti secondo lo stato, tutti e due se mista, ed Elimina da tutti", () => {
    const riga = (stato) => ({ stato: stato });
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(riga("si"), false).map(p => p.azione), ["disattiva", "elimina"]);
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(riga("no"), false).map(p => p.azione), ["attiva", "elimina"]);
    assert.deepStrictEqual(schedaRef.pulsantiRigaFotoExtra(riga("misto"), false).map(p => [p.azione, p.testo]),
        [["attiva", "Attiva in tutti"], ["disattiva", "Disattiva in tutti"], ["elimina", "Elimina da tutti"]]);
});

/* ---- il Link ---- */

test("il Link non propone le immagini gia' in tutti i box, e per le altre dice a quali box mancano", () => {
    const archivio = [
        { id: "1", fileName: "BIO.psd", tipo: 3 },
        { id: "2", fileName: "DOP.psd", tipo: 3 },
        { id: "3", fileName: "IGP.psd", tipo: 3 },
        { id: "4", fileName: "BOLLO.psd", tipo: 2 }
    ];
    const presenti = [["BIO.psd", "DOP.psd"], ["BIO.psd"], ["BIO", "BIO.psd"]];

    const elenco = schedaRef.elencoLinkPiuBox(archivio, 3, presenti);

    assert.deepStrictEqual(elenco.map(v => [v.item.fileName, v.mancaIn, v.giaIn]), [
        ["DOP.psd", [1, 2], 1],
        ["IGP.psd", [0, 1, 2], 0]
    ]);
});

/* ---- le operazioni ---- */

//Sostituisce membri di schedaRef e globali per la durata di una prova.
async function conSostituti(membri, globali, prova) {
    const originaliMembri = {};
    const originaliGlobali = {};
    Object.keys(membri).forEach(k => { originaliMembri[k] = schedaRef[k]; schedaRef[k] = membri[k]; });
    Object.keys(globali).forEach(k => { originaliGlobali[k] = global[k]; global[k] = globali[k]; });
    try {
        await prova();
    }
    finally {
        Object.keys(originaliMembri).forEach(k => { schedaRef[k] = originaliMembri[k]; });
        Object.keys(originaliGlobali).forEach(k => { global[k] = originaliGlobali[k]; });
    }
}

const globaliDiServizio = (messaggi) => ({
    indesignEvents: { setBusy: () => { } },
    showLoading: () => { },
    hideLoading: () => { },
    messaggioUtente: (testo, tipo) => messaggi.push([testo, tipo])
});

function boxDellaSelezione(codice) {
    return {
        dettaglio: { codiceGruppo: codice, idRec: "7", item: { nome: "box" + codice } },
        records: [{ idRec: 7, recordInTracciato: { "Referenza.Codice": codice, "Scatto.CodiceGruppo": codice, StatoSelezione: 1 } }]
    };
}

test("Disattiva in tutti cambia solo i box attivi senza decisione, riepiloga e torna su Foto extra", async () => {
    const boxes = [boxDellaSelezione("A"), boxDellaSelezione("B"), boxDellaSelezione("C")];
    const riga = {
        nome: "BIO.psd",
        box: [
            { indice: 0, elemento: extra("BIO", 3, true), decisione: null },
            { indice: 1, elemento: extra("BIO", 3, false), decisione: null },
            { indice: 2, elemento: extra("BIO", 3, true), decisione: decisione("BIO", 3) }
        ]
    };
    const chiamate = [];
    const messaggi = [];
    let riselezionati = null;

    await conSostituti({
        boxSelezioneMultipla: boxes,
        attivaFotoExtraDelBox: async (b, elemento, attiva) => { chiamate.push([b.dettaglio.codiceGruppo, attiva]); },
        selezionaBoxDellaSelezioneMultipla: (items) => { riselezionati = items.map(i => i.nome); },
        riapriFotoExtraPiuBox: false
    }, globaliDiServizio(messaggi), async () => {
        await schedaRef.azioneRigaFotoExtraPiuBox(riga, "disattiva");
        assert.strictEqual(schedaRef.riapriFotoExtraPiuBox, true);
    });

    //B e' gia' disattivata, C la governa una decisione per la lavorazione.
    assert.deepStrictEqual(chiamate, [["A", false]]);
    assert.deepStrictEqual(messaggi, [["Code SRF-146 Foto extra disattivata: 1 box su 1", "success"]]);
    assert.deepStrictEqual(riselezionati, ["boxA", "boxB", "boxC"]);
});

test("un box che non riesce non ferma gli altri, e il riepilogo lo dice", async () => {
    const boxes = [boxDellaSelezione("A"), boxDellaSelezione("B")];
    const riga = {
        nome: "SDB.psd",
        box: [
            { indice: 0, elemento: auto("SDB", 3, false), decisione: null },
            { indice: 1, elemento: auto("SDB", 3, false), decisione: null }
        ]
    };
    const chiamate = [];
    const messaggi = [];

    await conSostituti({
        boxSelezioneMultipla: boxes,
        escludiExtraAutoDelBox: async (b) => {
            chiamate.push(b.dettaglio.codiceGruppo);
            if (b.dettaglio.codiceGruppo === "A") {
                throw new Error("rete assente");
            }
        },
        selezionaBoxDellaSelezioneMultipla: () => { }
    }, globaliDiServizio(messaggi), async () => {
        await schedaRef.azioneRigaFotoExtraPiuBox(riga, "escludi");
    });

    assert.deepStrictEqual(chiamate, ["A", "B"]);
    assert.deepStrictEqual(messaggi, [["Code SRF-147 Extra automatica esclusa: 1 box su 2. Non riusciti: A (rete assente)", "warning"]]);
});

test("Elimina da tutti chiede conferma con l'elenco dei box, e senza conferma non fa niente", async () => {
    const boxes = [boxDellaSelezione("A"), boxDellaSelezione("B")];
    const riga = { nome: "BIO.psd", box: [{ indice: 0, elemento: extra("BIO", 3, true), decisione: null }, { indice: 1, elemento: extra("BIO", 3, true), decisione: null }] };
    const chiamate = [];
    let titoloConferma = null;
    let vociConferma = null;

    await conSostituti({
        boxSelezioneMultipla: boxes,
        eliminaFotoExtraDelBox: async (b) => { chiamate.push(b.dettaglio.codiceGruppo); },
        selezionaBoxDellaSelezioneMultipla: () => { }
    }, Object.assign(globaliDiServizio([]), {
        Modali: Object.assign({}, require('../../plugin/modali/modali'), {
            confermaSuPiuBox: async (titolo, voci) => { titoloConferma = titolo; vociConferma = voci; return false; }
        })
    }), async () => {
        await schedaRef.azioneRigaFotoExtraPiuBox(riga, "elimina");
    });

    assert.strictEqual(titoloConferma, "Eliminare BIO.psd da questi 2 box?");
    assert.deepStrictEqual(vociConferma.map(v => v.codice), ["A", "B"]);
    assert.deepStrictEqual(chiamate, []);
});

test("attivare un'extra la rimette nel box se manca, e aggiorna tutti i record del box", async () => {
    const b = boxDellaSelezione("A");
    const elemento = extra("BIO", 3, false);
    b.records.push({ idRec: 8, recordInTracciato: { "Foto.Extra": [Object.assign({}, elemento)] } });
    b.records[0].recordInTracciato["Foto.Extra"] = [Object.assign({}, elemento)];
    const richieste = [];
    const impaginati = [];

    await conSostituti({
        richiestaFotoExtra: async (url) => { richieste.push(url); return { esito: true }; },
        extraNelBox: () => false,
        impaginaExtraNelBox: (box, nome, tipo, sigla) => { impaginati.push([nome, tipo, sigla]); }
    }, {}, async () => {
        await schedaRef.attivaFotoExtraDelBox(b, elemento, true);
    });

    assert.deepStrictEqual(richieste, ["SyncFoto/attivaDisattivaFotoExtra/BIO-guid/true"]);
    assert.deepStrictEqual(b.records.map(r => r.recordInTracciato["Foto.Extra"][0].attiva), [true, true]);
    assert.deepStrictEqual(impaginati, [["BIO.psd", 3, "BIO"]]);
});

test("una decisione solo per questa lavorazione va al box giusto, poi nel box e nei record", async () => {
    const b = boxDellaSelezione("A");
    let destinazione = null;
    let voceSalvata = null;
    const impaginati = [];
    const applicati = [];

    await conSostituti({
        salvaExtraLavorazione: async (richiesta, dest) => { destinazione = dest; voceSalvata = richiesta.voce; return true; },
        impaginaExtraNelBox: (box, nome, tipo, sigla) => { impaginati.push([nome, tipo, sigla]); },
        applicaExtraLavorazioneAiRecord: (records, voce) => { applicati.push([records[0].recordInTracciato["Scatto.CodiceGruppo"], voce.sigla]); }
    }, {}, async () => {
        await schedaRef.decisioneSoloQuiDelBox(b, "bollino.png", 2, 1);
    });

    assert.deepStrictEqual(destinazione, { codiceGruppo: "A", idRec: 7 });
    assert.strictEqual(voceSalvata.ambito, 1);
    assert.strictEqual(voceSalvata.azione, schedaRef.AZIONE_EXTRA.aggiungi);
    assert.deepStrictEqual(impaginati, [["bollino.png", 2, "bollino.png"]]);
    assert.deepStrictEqual(applicati, [["A", "bollino.png"]]);
});

/* ---- dove si aggancia ---- */

test("con piu' box Foto extra apre la schermata per tutti, e impaginaFotoExtra non ripunta una scheda di un box", () => {
    const scheda = leggi('schedaRef.js');
    assert.match(scheda, /if \(enumSchede == 3 && this\.inSelezioneMultipla\) \{\n\s*await me\.FotoExtraPanelPiuBox\(\);\n\s*return;/);
    assert.match(scheda, /Object\.assign\(schedaRef, require\('\.\/reperimentoFoto\/fotoExtraPiuBox'\)\);/);
    //Dopo un'operazione la scheda riletta torna su Foto extra.
    assert.match(scheda, /if \(riapriFotoExtra && stato === stati\.impaginati\) \{[\s\S]*?jsIndexControls\.openTab\(null, "Tab7"\);[\s\S]*?await me\.FotoExtraPanelPiuBox\(\);/);

    const foto = leggi('reperimentoFoto/schedaFoto.js');
    const impagina = foto.substring(foto.indexOf("    impaginaFotoExtra("), foto.indexOf("    attivaDisattivaFotoExtra("));
    assert.match(impagina, /if \(this\.inSelezioneMultipla\) \{\n\s*return masterGroup;\n\s*\}\n\s*app\.selection = \[masterGroup\];\n\s*this\.refSelected\.item = masterGroup;/);
});
