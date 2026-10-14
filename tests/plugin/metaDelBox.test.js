/*
 * I20-1089: i meta del box e la loro interfaccia.
 *
 * L'icona blu accanto al segnalino della scheda dice quanti meta ha il box e apre la finestra: per
 * ogni meta il campo, il valore originale e quello modificato. Solo i testi dei campi compilati si
 * tolgono da qui; primarie/secondarie, foto, foto extra decise per la lavorazione ed elementi in
 * noRender si mostrano soltanto. Un meta da verificare porta alle segnalazioni. Da qui si applica
 * un meta nuovo, partendo dal testo del box; rimozioni e meta nuovi si salvano tutti insieme, con
 * una richiesta, e il box si reimpagina.
 *
 * metaDelBox.js e' mescolato in schedaRef.js, che si carica sotto Node: le regole si provano
 * direttamente, il resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", "plugin", relativo), "utf8").replace(/\r\n/g, "\n");
}

function testo(modifiche) {
    return Object.assign({
        label: "prezzo_info_pack", contenuto: "cad.", contenutoServer: "a conf.", versione: 3,
        contenutoServerAttuale: "a conf.", versioneAttuale: 3, allineato: false
    }, modifiche);
}

const CAMPI = [
    { labelName: "descrizione", content: "<DES>Arista</DES>" },
    { labelName: "prezzo_info_pack", content: "a conf." },
    { labelName: "prezzo_continuo$KgL", content: "<PREZ_A>invece di € 1,89 </PREZ_A>" },
    { labelName: "prezzo_continuo$KgL", content: "doppione" },
    { labelName: "foto_senza_testo", content: null }
];

function scheda(primario, altri = []) {
    return [{ recordInTracciato: Object.assign({ StatoSelezione: 1 }, primario) }].concat(altri.map(a => ({ recordInTracciato: a })));
}

/* ---- l'elenco dei meta ---- */

test("tutti i tipi di meta del box, con originale e modificato; solo i testi si rimuovono", () => {
    const records = scheda({
        testiDalBox: [testo()],
        extraLavorazione: [{ tipo: 2, sigla: "Logo_BDP", azione: 3 }],
        noRenderElementi: [{ tipo: 1, chiave: "descrizione2", nome: "descrizione2" }],
        metaFoto: [{ tipo: "selezione", codRef: "123", originale: "2", modificato: "1", ereditata: false }]
    }, [
        { StatoSelezione: 2, metaFoto: [{ tipo: "foto", codRef: "124", originale: "124_1.jpg", modificato: "124_2.jpg", ereditata: true }] }
    ]);

    const voci = schedaRef.vociMetaDelBox(records, false);

    assert.deepStrictEqual(voci.map(v => v.tipo), ["testo", "selezione", "foto", "extra", "noRender"]);
    assert.deepStrictEqual(voci.map(v => v.rimovibile), [true, false, false, false, false]);
    assert.strictEqual(voci[0].etichetta, "prezzo_info_pack");
    assert.strictEqual(voci[0].originale, "a conf.");
    assert.strictEqual(voci[0].modificato, "cad.");
    assert.strictEqual(voci[1].originale, "secondaria");
    assert.strictEqual(voci[1].modificato, "primaria");
    assert.strictEqual(voci[2].ereditata, true);
    assert.strictEqual(voci[2].modificato, "124_2.jpg");
    assert.strictEqual(voci[3].originale, "come nel dato");
    assert.strictEqual(voci[4].modificato, "in noRender");
    assert.strictEqual(schedaRef.numeroMetaDelBox(records), 5);
});

test("un meta del testo da verificare si riconosce, e quello allineato non si conta", () => {
    const records = scheda({ testiDalBox: [testo({ contenutoServerAttuale: "al kg" }), testo({ label: "prezzo_continuo$KgL", allineato: true })] });

    const voci = schedaRef.vociMetaDelBox(records, false);
    assert.strictEqual(voci.length, 1);
    assert.strictEqual(voci[0].daVerificare, true);
    assert.strictEqual(schedaRef.vociMetaDelBox(scheda({ testiDalBox: [testo()] }), false)[0].daVerificare, false);
});

test("senza primario o senza meta l'elenco e' vuoto", () => {
    assert.deepStrictEqual(schedaRef.vociMetaDelBox([], false), []);
    assert.deepStrictEqual(schedaRef.vociMetaDelBox(null, false), []);
    assert.deepStrictEqual(schedaRef.vociMetaDelBox([{ recordInTracciato: { StatoSelezione: 2, testiDalBox: [testo()] } }], false), []);
    assert.strictEqual(schedaRef.numeroMetaDelBox(scheda({})), 0);
});

/* ---- il meta nuovo ---- */

test("un meta nuovo si applica sui campi con un testo e senza meta, descrizione compresa (I20-1090), uno per campo", () => {
    const campi = schedaRef.campiPerNuovoMeta(scheda({ compiledFields: CAMPI, testiDalBox: [testo({ label: "PREZZO_INFO_PACK" })] }));

    assert.deepStrictEqual(campi.map(c => c.labelName), ["descrizione", "prezzo_continuo$KgL"]);
    //Con il meta della descrizione, la descrizione non si propone piu'.
    assert.deepStrictEqual(schedaRef.campiPerNuovoMeta(scheda({ compiledFields: CAMPI, testiDalBox: [testo({ label: "descrizione" })] })).map(c => c.labelName),
        ["prezzo_info_pack", "prezzo_continuo$KgL"]);
    assert.deepStrictEqual(schedaRef.campiPerNuovoMeta(scheda({})), []);
});

test("le modifiche in sospeso vanno al server in una richiesta sola", () => {
    const richiesta = schedaRef.richiestaModificheMeta(["prezzo_info_pack"], [{ campo: "prezzo_continuo$KgL", contenuto: "<PREZ_A>cad.</PREZ_A>", contenutoServer: "<PREZ_A>a conf.</PREZ_A>" }]);

    assert.deepStrictEqual(richiesta, {
        voci: [
            { label: "prezzo_info_pack", azione: 2 },
            { label: "prezzo_continuo$KgL", azione: 3, contenuto: "<PREZ_A>cad.</PREZ_A>", contenutoServer: "<PREZ_A>a conf.</PREZ_A>" }
        ]
    });
    assert.strictEqual(schedaRef.richiestaModificheMeta([], []), null);
    assert.strictEqual(schedaRef.richiestaModificheMeta(null, [{ campo: "" }]), null);
});

function conStub(stub, prova) {
    const salva = {};
    Object.keys(stub).forEach(k => { salva[k] = schedaRef[k]; schedaRef[k] = stub[k]; });
    const salvaMessaggio = global.messaggioUtente;
    global.messaggioUtente = () => { };
    return Promise.resolve(prova()).finally(() => {
        Object.keys(salva).forEach(k => { schedaRef[k] = salva[k]; });
        if (salvaMessaggio === undefined) {
            delete global.messaggioUtente;
        }
        else {
            global.messaggioUtente = salvaMessaggio;
        }
    });
}

test("Salva manda la richiesta, riscarica la scheda e reimpagina il box una volta", () => {
    const eventi = [];
    return conStub({
        salvaTestiDalBox: async (r) => { eventi.push("server:" + r.voci.length); return true; },
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; },
        applicaReimpaginazione: () => { eventi.push("reimpagina"); }
    }, async () => {
        assert.strictEqual(await schedaRef.salvaModificheMeta({ voci: [{ label: "x", azione: 2 }, { label: "y", azione: 2 }] }), true);
        assert.deepStrictEqual(eventi, ["server:2", "riscarica", "reimpagina"]);
    });
});

test("senza modifiche, o se il server non registra, non si riscarica e non si reimpagina", () => {
    const eventi = [];
    return conStub({
        salvaTestiDalBox: async () => false,
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; },
        applicaReimpaginazione: () => { eventi.push("reimpagina"); }
    }, async () => {
        assert.strictEqual(await schedaRef.salvaModificheMeta(null), false);
        assert.strictEqual(await schedaRef.salvaModificheMeta({ voci: [{ label: "x", azione: 2 }] }), false);
        assert.deepStrictEqual(eventi, []);
    });
});

/* ---- la finestra e l'icona ---- */

test("la finestra: Rimuovi solo sui testi, Vai a Segnalazioni sui meta da verificare, Salva solo con modifiche", () => {
    const meta = sorgente("metaDelBox.js");
    const finestra = meta.substring(meta.indexOf("    mostraFinestraMeta() {"), meta.indexOf("/* ---------- I20-1090"));

    assert.match(finestra, /if \(voce\.daVerificare\) \{[\s\S]*?me\.pulsanteFinestra\("Vai a Segnalazioni"/);
    assert.match(finestra, /\$\("#popupCloseButton"\)\.trigger\("click"\);\s*await me\.mostraModalSegnalazioni\(\);/);
    assert.match(finestra, /if \(voce\.rimovibile\) \{[\s\S]*?"Rimuovi meta"/);
    assert.match(finestra, /salva\.prop\("disabled", daRimuovere\.size === 0 && daCreare\.length === 0\);/);
    //Chiudere con la X non manda niente: la richiesta parte solo da Salva.
    assert.strictEqual((finestra.match(/salvaModificheMeta\(/g) || []).length, 1);
    assert.match(finestra, /Modali\.popup\("Meta del box", contenuto, "lg"\);/);
    //Il meta nuovo parte dal testo del box, nella forma del campo compilato.
    assert.match(meta, /return this\.testoDalBoxPerIlServer\(campoCompilato, campo\.contents, TestoTag\.componiStringTagFromInndTextFrame\(campo\)\);/);
});

test("l'icona blu dei meta sta nella riga del codice, alta come il segnalino, e c'e' anche senza meta", () => {
    const meta = sorgente("metaDelBox.js");
    const icona = meta.substring(meta.indexOf("    aggiornaIconaMeta() {"), meta.indexOf("    testoPerNuovoMeta(campoCompilato) {"));

    assert.match(icona, /\$\("#metaBoxButton"\)\.remove\(\);/);
    assert.match(icona, /icona\.text\(quanti > 0 \? String\(quanti\) : ""\);/);
    assert.match(icona, /"height": "16px"/);
    assert.match(icona, /"flex": "0 0 auto"/);
    assert.match(icona, /\$\("#codiceRef"\)\.prepend\(icona\);/);
    assert.doesNotMatch(icona, /if \(quanti === 0\) \{\s*return/);

    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /Object\.assign\(schedaRef, require\('\.\/metaDelBox'\)\);/);
});
