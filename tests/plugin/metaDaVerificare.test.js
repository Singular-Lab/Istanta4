/*
 * I20-1088: i meta dei testi del box da verificare.
 *
 * Quando l'operatore tiene il testo del box per un campo (I20-1077), il server registra un meta con
 * il valore originale (il contenuto che componeva allora) e la versione del record. Il meta vale
 * finche' esiste; con il record il server restituisce, sotto testiDalBox, il suo stato: il testo,
 * il valore originale e la versione registrati, il contenuto che compone ora e la versione attuale.
 * Il Plugin lo segnala da verificare se il server compone altro o se il record ha cambiato
 * versione (la lista ricaricata), salvo che il cliente spenga il controllo di versione. Si vede
 * nella finestra delle differenze della scheda, con "Aggiorna meta" e "Usa quella del server", e
 * fra i cambiati del Report Integrita', senza azioni proprie.
 *
 * confronti.js e schedaRef.js si caricano sotto Node: le decisioni si provano direttamente, il
 * resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const confronti = require("../../plugin/confronti.js");
const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", "plugin", relativo), "utf8").replace(/\r\n/g, "\n");
}

function stato(modifiche) {
    return Object.assign({
        label: "prezzo_info_pack",
        contenuto: "cad.",
        contenutoServer: "a conf.",
        versione: 3,
        contenutoServerAttuale: "a conf.",
        versioneAttuale: 3,
        allineato: false
    }, modifiche);
}

/* ---- quali meta sono da verificare ---- */

test("un meta il cui valore originale non e' piu' quello che il server compone e' da verificare", () => {
    const differenze = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenutoServerAttuale: "al kg" })] }, false);

    assert.strictEqual(differenze.length, 1);
    const diff = differenze[0];
    assert.strictEqual(diff.tipo, "metaDaVerificare");
    assert.strictEqual(diff.origine, "meta");
    assert.strictEqual(diff.motivo, "valore");
    assert.strictEqual(diff.label, "prezzo_info_pack");
    assert.strictEqual(diff.campo, "prezzo_info_pack");
    assert.strictEqual(diff.contenutoMeta, "cad.");
    assert.strictEqual(diff.contenutoServer, "a conf.");
    assert.strictEqual(diff.contenutoServerAttuale, "al kg");
    assert.match(diff.difference, /^meta da verificare/);
});

test("la lista ricaricata con lo stesso valore fa verificare il meta, salvo che il cliente spenga la versione", () => {
    const record = { testiDalBox: [stato({ versioneAttuale: 4 })] };

    const differenze = confronti.differenzeDeiMeta(record, false);
    assert.strictEqual(differenze.length, 1);
    assert.strictEqual(differenze[0].motivo, "versione");
    assert.match(differenze[0].difference, /versione 3, ora 4/);

    assert.deepStrictEqual(confronti.differenzeDeiMeta(record, true), []);
});

test("il valore cambiato si segnala anche quando il cliente spegne la versione", () => {
    const differenze = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenutoServerAttuale: "al kg", versioneAttuale: 4 })] }, true);

    assert.strictEqual(differenze.length, 1);
    assert.strictEqual(differenze[0].motivo, "valore");
});

test("un meta registrato prima, senza versione, si controlla solo sul valore", () => {
    assert.deepStrictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato({ versione: null, versioneAttuale: 4 })] }, false), []);
    assert.strictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato({ versione: undefined, contenutoServerAttuale: "al kg" })] }, false).length, 1);
});

test("un meta al passo, uno allineato o un record senza meta non danno niente", () => {
    assert.deepStrictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato()] }, false), []);
    assert.deepStrictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato({ allineato: true, contenutoServerAttuale: "cad." })] }, false), []);
    assert.deepStrictEqual(confronti.differenzeDeiMeta({ testiDalBox: [null, stato({ label: "" })] }, false), []);
    assert.deepStrictEqual(confronti.differenzeDeiMeta({}, false), []);
    assert.deepStrictEqual(confronti.differenzeDeiMeta(null, false), []);
});

test("la label e' quella del campo nella finestra, e il campo intero va al server", () => {
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ label: "prezzo_continuo$KgL", contenutoServerAttuale: "x" })] }, false)[0];

    assert.strictEqual(diff.label, "prezzo_continuo");
    assert.strictEqual(diff.campo, "prezzo_continuo$KgL");
});

test("il controllo di versione lo spegne solo la configurazione del cliente", () => {
    const salva = global.pluginMiddleware;
    try {
        delete global.pluginMiddleware;
        assert.strictEqual(confronti.ignoraVersioneMeta(), false);
        global.pluginMiddleware = { getIgnoraVersioneMeta: () => true };
        assert.strictEqual(confronti.ignoraVersioneMeta(), true);
        //Senza secondo argomento differenzeDeiMeta chiede al cliente.
        assert.deepStrictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato({ versioneAttuale: 4 })] }), []);
        global.pluginMiddleware = { getIgnoraVersioneMeta: () => false };
        assert.strictEqual(confronti.differenzeDeiMeta({ testiDalBox: [stato({ versioneAttuale: 4 })] }).length, 1);
    }
    finally {
        if (salva === undefined) {
            delete global.pluginMiddleware;
        }
        else {
            global.pluginMiddleware = salva;
        }
    }
});

test("i tre valori del meta sono leggibili, senza tag, e quelli lunghi si abbreviano", () => {
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenuto: "<PREZ_A>invece di </PREZ_A><PREZ_B>cad.</PREZ_B>", contenutoServerAttuale: "x".repeat(40) })] }, false)[0];

    const valori = confronti.valoriDelMeta(diff, 30);
    assert.deepStrictEqual(valori.map(v => v.etichetta), ["Nel meta", "Originale", "Sul server"]);
    assert.strictEqual(valori[0].intero, "invece di cad.");
    assert.strictEqual(valori[1].breve, "a conf.");
    assert.strictEqual(valori[2].abbreviato, true);
    assert.strictEqual(valori[2].intero.length, 40);

    assert.deepStrictEqual(confronti.valoriDelMeta({ label: "x", difference: "contenuto", valoreLocale: "a", valoreServer: "b" }), []);
    assert.deepStrictEqual(confronti.valoriDelMeta(null), []);
});

/* ---- la finestra delle differenze della scheda ---- */

test("su un meta da verificare si aggiorna o si usa il server: toglierlo e basta non e' fra le azioni", () => {
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenutoServerAttuale: "al kg" })] }, false)[0];

    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(diff), ["aggiornaMeta", "metaServer"]);
    const testo = sorgente("schedaRef.js");
    assert.match(testo, /aggiornaMeta: \["Aggiorna meta", /);
    assert.match(testo, /metaServer: \["Usa quella del server", /);
});

test("la richiesta al server: Aggiorna porta il contenuto di adesso, Rimuovi solo il campo", () => {
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ label: "prezzo_continuo$KgL", contenutoServerAttuale: "al kg" })] }, false)[0];

    assert.deepStrictEqual(schedaRef.richiestaTestiDalBox(diff, schedaRef.AZIONE_TESTO_DAL_BOX.aggiorna),
        { voci: [{ label: "prezzo_continuo$KgL", azione: 1, contenutoServer: "al kg" }] });
    assert.deepStrictEqual(schedaRef.richiestaTestiDalBox(diff, schedaRef.AZIONE_TESTO_DAL_BOX.rimuovi),
        { voci: [{ label: "prezzo_continuo$KgL", azione: 2 }] });
    assert.strictEqual(schedaRef.richiestaTestiDalBox({ label: "prezzo_info_pack", difference: "contenuto" }, 1), null);
    assert.strictEqual(schedaRef.richiestaTestiDalBox(null, 1), null);
});

function conStub(stub, prova) {
    const salvaMembri = {};
    Object.keys(stub).forEach(k => { salvaMembri[k] = schedaRef[k]; schedaRef[k] = stub[k]; });
    const salvaGlobali = { $: global.$, messaggioUtente: global.messaggioUtente, Modali: global.Modali };
    global.$ = () => ({ length: 0 });
    global.messaggioUtente = () => { };
    global.Modali = { nascondiHidebleElements: () => { } };
    return Promise.resolve(prova()).finally(() => {
        Object.keys(salvaMembri).forEach(k => { schedaRef[k] = salvaMembri[k]; });
        Object.keys(salvaGlobali).forEach(k => {
            if (salvaGlobali[k] === undefined) {
                delete global[k];
            }
            else {
                global[k] = salvaGlobali[k];
            }
        });
    });
}

test("Aggiorna meta registra, riscarica la scheda e rifa' l'analisi, senza toccare il box", () => {
    const eventi = [];
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenutoServerAttuale: "al kg" })] }, false)[0];
    return conStub({
        salvaTestiDalBox: async (richiesta) => { eventi.push("server:" + richiesta.voci[0].azione); return true; },
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; },
        applicaCampoDaServer: async () => { eventi.push("box"); }
    }, async () => {
        assert.strictEqual(await schedaRef.aggiornaMetaDelTesto(diff, async () => { eventi.push("analisi"); }), true);
        assert.deepStrictEqual(eventi, ["server:1", "riscarica", "analisi"]);
    });
});

test("Usa quella del server toglie il meta, riscarica e solo dopo riscrive il campo del box", () => {
    const eventi = [];
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ label: "prezzo_continuo$KgL", contenutoServerAttuale: "al kg" })] }, false)[0];
    return conStub({
        salvaTestiDalBox: async (richiesta) => { eventi.push("server:" + richiesta.voci[0].azione); return true; },
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; },
        applicaCampoDaServer: async (d) => { eventi.push("box:" + d.label + ":" + d.difference); }
    }, async () => {
        assert.strictEqual(await schedaRef.usaServerAlPostoDelMeta(diff, async () => { eventi.push("analisi"); }), true);
        assert.deepStrictEqual(eventi, ["server:2", "riscarica", "box:prezzo_continuo:contenuto", "analisi"]);
    });
});

test("se il server non registra, la scheda non si riscarica e il box non cambia", () => {
    const eventi = [];
    const diff = confronti.differenzeDeiMeta({ testiDalBox: [stato({ contenutoServerAttuale: "al kg" })] }, false)[0];
    return conStub({
        salvaTestiDalBox: async () => false,
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; },
        applicaCampoDaServer: async () => { eventi.push("box"); }
    }, async () => {
        assert.strictEqual(await schedaRef.usaServerAlPostoDelMeta(diff, async () => { eventi.push("analisi"); }), false);
        assert.strictEqual(await schedaRef.aggiornaMetaDelTesto(diff, async () => { eventi.push("analisi"); }), false);
        assert.deepStrictEqual(eventi, []);
    });
});

test("la finestra conta i meta fra le differenze e il salvataggio manda il record del box", () => {
    const testo = sorgente("schedaRef.js");
    assert.match(testo, /return differenze\.concat\(confronti\.differenzeDeiMeta\(rec\)\);/);
    assert.match(testo, /xhr\.send\("Menabo\/modificaTestiDalBox\/0", formData, "PUT"\);/);
    assert.match(testo, /req\.idRec = this\.idRecDelBoxAperto\(\);/);
    //I tre valori del meta sotto la riga, al posto di box e server.
    const membro = testo.substring(testo.indexOf("    aggiungiValoriDifferenza(riga, diff) {"), testo.indexOf("/* ---------- I20-1070"));
    assert.match(membro, /const valoriMeta = confronti\.valoriDelMeta\(diff\);/);
});

/* ---- il Report Integrita' ---- */

test("nel Report i meta fanno del record un cambiato, in un riquadro loro e senza Fix", () => {
    const flusso = sorgente("reportIntegrita/reportIntegrita.js");
    const preAnalisi = flusso.substring(flusso.indexOf("    async preAnalisiBoxMappato(records, elementoMappa, boxGiaTrovato = null) {"), flusso.indexOf("    nomiPagineDelDocumento() {"));
    assert.match(preAnalisi, /var differenzeMeta = confronti\.differenzeDeiMeta\(dati\.tracciatoPrimario\);/);
    assert.match(preAnalisi, /preAnalisi\.differenze = \(preAnalisi\.differenze \|\| \[\]\)\.concat\(differenzeMeta\);/);

    const pannelli = sorgente("reportIntegrita/pannelli.js");
    //Il Fix si offre solo per le segnalazioni di integrita', che non comprendono i meta.
    assert.match(pannelli, /const segnalazioniIntegrita = tutteLeDifferenze\.filter\(d => d\?\.origine !== "confronto" && d\?\.origine !== "meta"\);/);
    assert.match(pannelli, /if \(segnalazioniIntegrita\.length > 0\) \{\s*actions\.appendChild\(btnFix\);/);
    assert.match(pannelli, /diffList\.appendChild\(this\._crRiquadroMeta\(differenzeMeta\)\);/);
    //Nessuna azione nuova sulla riga: il meta si risolve dalla scheda.
    const riquadro = pannelli.substring(pannelli.indexOf("    _crRiquadroMeta(differenze) {"), pannelli.indexOf("    _crRow(stato = null) {"));
    assert.doesNotMatch(riquadro, /button|_onConfrontoAction|addEventListener/);
    assert.doesNotMatch(flusso, /case "aggiornaMeta"/);
});

/* ---- il cliente e le foto ---- */

function middlewareVero(customPluginDB, callCustom = false, customAgenzia = undefined) {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "pluginMiddleware.js"), "utf8");
    const inizio = testo.indexOf("    getIgnoraVersioneMeta() {");
    assert.notStrictEqual(inizio, -1, "getIgnoraVersioneMeta non trovata");
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < testo.length && fine < 0; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}") { livello--; if (livello === 0) { fine = i + 1; } }
    }
    const membro = new Function("customAgenzia", "return ({\n" + testo.substring(inizio, fine) + "\n});")(customAgenzia);
    return Object.assign(membro, { callCustom: callCustom, customPluginDB: customPluginDB });
}

test("ignorare la versione lo dice la configurazione del server; senza, la versione si controlla", () => {
    assert.strictEqual(middlewareVero({ ignoraVersioneMeta: true }).getIgnoraVersioneMeta(), true);
    assert.strictEqual(middlewareVero({ ignoraVersioneMeta: false }).getIgnoraVersioneMeta(), false);
    assert.strictEqual(middlewareVero({}).getIgnoraVersioneMeta(), false);
    assert.strictEqual(middlewareVero(null).getIgnoraVersioneMeta(), false);
    assert.strictEqual(middlewareVero({ ignoraVersioneMeta: "si" }).getIgnoraVersioneMeta(), false);
    assert.strictEqual(middlewareVero(null, true, { ignoraVersioneMeta: true }).getIgnoraVersioneMeta(), true);
});

test("le foto mandano il record del box, perche' il meta vada nella riga di questa impaginazione", () => {
    const testo = sorgente("reperimentoFoto/schedaFoto.js");
    const aggiorna = testo.substring(testo.indexOf("    async updateImmagineEsistente("), testo.indexOf("xhr.send(\"SyncFoto/updateImmagineEsistente/\""));
    assert.match(aggiorna, /formData\.append\("idRec", me\.idRecDelBoxAperto\(\)\);/);
    const elimina = testo.substring(testo.indexOf("    eliminaFotoExtra(idFoto, tipo, nomeFoto, box, sigla = null) {"), testo.indexOf("xhr.send(\"SyncFoto/RimuoviFoto/\""));
    assert.match(elimina, /formData\.append\("idRec", me\.idRecDelBoxAperto\(\)\);/);
});
