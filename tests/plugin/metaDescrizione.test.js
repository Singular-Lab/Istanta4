/*
 * I20-1090: la descrizione e i meta.
 *
 * Sulla riga della descrizione, nella finestra delle differenze, oltre a "Usa quella del server" c'e'
 * una sola scelta per il box, secondo dove sta la differenza: nelle quattro descrizioni fondamentali
 * si revisiona ("Revisiona con valore del box"), negli altri tratti si mette la descrizione nel meta
 * ("Imposta come meta"), in entrambi tutte e due le cose ("Revisiona e imposta nei meta": prima la
 * revisione, poi il meta con il valore originale composto dopo la revisione). Con i tratti ripetuti
 * ogni scelta che revisiona e' spenta, meta compreso. Con un meta della descrizione gia' presente
 * si usa il meta o lo si aggiorna, e nella schermata di modifica i campi della descrizione sono in
 * sola lettura: il Salva manda le Azioni sul box ma non la descrizione.
 *
 * confronti.js, testoTag.js, InputEditController.js e schedaRef.js si caricano sotto Node; jQuery,
 * la configurazione e InDesign si fingono.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const confronti = require("../../plugin/confronti.js");
const TestoTag = require("../../plugin/testoTag.js");
const InputEditController = require("../../plugin/InputEditController.js");
const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", "plugin", relativo), "utf8").replace(/\r\n/g, "\n");
}

const FONDAMENTALI = { DESCRIZIONE_TITOLO: "descrizione1", DESCRIZIONE_BRAND: "descrizione2", DESCRIZIONE_TIPO: "descrizione3", DESCRIZIONE_GRAMMATURA: "descrizione4" };
const fondamentaleDi = (stile) => FONDAMENTALI[stile] || null;

const SERVER = [
    { stile: "A.DESCRIZIONE_TITOLO", content: "Arista " },
    { stile: "A.DESCRIZIONE_GRAMMATURA", content: "al kg" },
    { stile: "MAX_PEZZI", content: "MAX 4 PEZZI" },
    { stile: "NOTE_$Hidden", content: "nascosto" }
];

function box(titolo, maxPezzi) {
    return [
        { nome: "DESCRIZIONE_TITOLO", nomeCompleto: "A.DESCRIZIONE_TITOLO", contenuto: titolo },
        { nome: "DESCRIZIONE_GRAMMATURA", nomeCompleto: "A.DESCRIZIONE_GRAMMATURA", contenuto: "al\rkg" },
        { nome: "MAX_PEZZI", nomeCompleto: "MAX_PEZZI", contenuto: maxPezzi }
    ];
}

/* ---- dove sta la differenza ---- */

test("la differenza nelle sole descrizioni fondamentali, nei soli altri tratti, in entrambi", () => {
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(box("Lonza", "MAX 4 PEZZI"), SERVER, fondamentaleDi), { fondamentali: true, altri: false });
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(box("Arista", "MAX 2 PEZZI"), SERVER, fondamentaleDi), { fondamentali: false, altri: true });
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(box("Lonza", "MAX 2 PEZZI"), SERVER, fondamentaleDi), { fondamentali: true, altri: true });
});

test("spazi, a capo, <br>, gruppo dello stile e tratti nascosti del server non fanno differenza", () => {
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(box(" Arista", "MAX 4<br>PEZZI"), SERVER, fondamentaleDi), { fondamentali: false, altri: false });
    //Un tratto in piu' che non e' una fondamentale e' una differenza degli altri tratti.
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(box("Arista", "MAX 4 PEZZI").concat([{ nome: "PROMO", contenuto: "-30%" }]), SERVER, fondamentaleDi),
        { fondamentali: false, altri: true });
    assert.deepStrictEqual(confronti.dovePortaLaDescrizione(null, null, null), { fondamentali: false, altri: false });
});

test("la descrizione del box per il meta ha i nomi completi degli stili, come il campo compilato", () => {
    assert.strictEqual(TestoTag.stringaConTagDeiTratti([{ nome: "DESCRIZIONE_TITOLO", nomeCompleto: "A.DESCRIZIONE_TITOLO", contenuto: "Lonza " }, { nome: "MAX_PEZZI", contenuto: "MAX 4" }, { nome: "", contenuto: "!" }]),
        "<A.DESCRIZIONE_TITOLO>Lonza </A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 4</MAX_PEZZI>!");
    assert.strictEqual(TestoTag.stringaConTagDeiTratti(null), "");
});

/* ---- le scelte sulla riga della descrizione ---- */

const DESCRIZIONE = { label: "descrizione", difference: "contenuto" };

function conScheda(record, stub, prova) {
    const salva = { schedeRefDati: schedaRef.schedeRefDati };
    Object.keys(stub).forEach(k => { salva[k] = schedaRef[k]; schedaRef[k] = stub[k]; });
    schedaRef.schedeRefDati = [{ recordInTracciato: Object.assign({ StatoSelezione: 1, compiledFields: [{ labelName: "descrizione", content: "<A.DESCRIZIONE_TITOLO>Arista</A.DESCRIZIONE_TITOLO>" }] }, record) }];
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

test("la scelta del box dipende da dove sta la differenza; se non si riconosce, il meta", () => {
    assert.strictEqual(schedaRef.sceltaDelBoxPerLaDescrizione({ fondamentali: true, altri: false }), "descrizioneBox");
    assert.strictEqual(schedaRef.sceltaDelBoxPerLaDescrizione({ fondamentali: false, altri: true }), "impostaMetaDescrizione");
    assert.strictEqual(schedaRef.sceltaDelBoxPerLaDescrizione({ fondamentali: true, altri: true }), "revisionaEMeta");
    assert.strictEqual(schedaRef.sceltaDelBoxPerLaDescrizione({ fondamentali: false, altri: false }), "impostaMetaDescrizione");
    assert.strictEqual(schedaRef.sceltaDelBoxPerLaDescrizione(null), "impostaMetaDescrizione");
});

test("sulla riga, il server e una sola scelta per il box; con il meta della descrizione, usa o aggiorna il meta", () => {
    return conScheda({}, { dovePortaLaDescrizioneDelBox: () => ({ fondamentali: true, altri: true }) }, () => {
        assert.deepStrictEqual(schedaRef.azioniPerDifferenza(DESCRIZIONE), ["descrizioneServer", "revisionaEMeta"]);
    }).then(() => conScheda({ testiDalBox: [{ label: "descrizione", contenuto: "x", contenutoServer: "y", contenutoServerAttuale: "y" }] },
        { dovePortaLaDescrizioneDelBox: () => ({ fondamentali: true, altri: false }) }, () => {
            assert.deepStrictEqual(schedaRef.azioniPerDifferenza(DESCRIZIONE), ["usaMetaDescrizione", "aggiornaMetaDescrizione"]);
        }));
});

test("le etichette, e il blocco dei tratti ripetuti vale per ogni scelta che revisiona", () => {
    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /descrizioneBox: \["Revisiona con valore del box", /);
    assert.match(scheda, /impostaMetaDescrizione: \["Imposta come meta", /);
    assert.match(scheda, /revisionaEMeta: \["Revisiona e imposta nei meta", /);
    assert.match(scheda, /usaMetaDescrizione: \["Usa quella del meta", /);
    assert.match(scheda, /aggiornaMetaDescrizione: \["Aggiorna il meta con il box", /);
    assert.match(scheda, /var ripetuti = \(azione === "descrizioneBox" \|\| azione === "revisionaEMeta"\) \? me\.trattiRipetutiNelPannello\(\) : \[\];/);
    assert.match(scheda, /else if \(azione === "revisionaEMeta"\) \{\s*me\.tieniDescrizioneDelBox\(true\);\s*\}/);
});

test("lo stato del meta della descrizione, non quello allineato ne' degli altri campi", () => {
    const records = (stati) => [{ recordInTracciato: { StatoSelezione: 1, testiDalBox: stati } }];
    assert.strictEqual(schedaRef.statoMetaDescrizione(records([{ label: "Descrizione", contenuto: "x" }])).contenuto, "x");
    assert.strictEqual(schedaRef.statoMetaDescrizione(records([{ label: "descrizione", contenuto: "x", allineato: true }])), null);
    assert.strictEqual(schedaRef.statoMetaDescrizione(records([{ label: "prezzo_info_pack", contenuto: "x" }])), null);
    assert.strictEqual(schedaRef.statoMetaDescrizione([]), null);
});

/* ---- revisione e meta ---- */

test("Revisiona e imposta nei meta prende il testo del box subito, e il salvataggio lo usa solo a revisione salvata", () => {
    const eventi = [];
    const salvaGlobali = { $: global.$ };
    global.$ = (selettore) => ({ trigger: (evento) => eventi.push(selettore + " " + evento) });
    return conScheda({}, {
        salvaModificheDellaScheda: () => eventi.push("salvataggio"),
        testoDescrizioneDelBoxPerMeta: () => "<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO>"
    }, () => {
        assert.strictEqual(schedaRef.tieniDescrizioneDelBox(true), true);
        assert.strictEqual(schedaRef.metaDescrizioneDaImpostare, "<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO>");
        schedaRef.tieniDescrizioneDelBox();
        assert.strictEqual(schedaRef.metaDescrizioneDaImpostare, null);
        assert.deepStrictEqual(eventi, ["#popupCloseButton click", "salvataggio", "#popupCloseButton click", "salvataggio"]);

        const salva = sorgente("schedaRef.js");
        //Con i tratti ripetuti il salvataggio si ferma prima della richiesta: niente revisione e niente meta.
        assert.ok(salva.indexOf("Code SRF-115") < salva.indexOf("await this.metaDescrizioneDopoLaRevisione(metaDescrizioneDopo);"));
        assert.match(salva, /if \(objResult\.esito\) \{[\s\S]*?if \(metaDescrizioneDopo != null\) \{\s*await this\.metaDescrizioneDopoLaRevisione\(metaDescrizioneDopo\);\s*\}\s*applicaCambiStrutturali\(\);/);
    }).finally(() => {
        schedaRef.salvaConDescrizioneDelBox = false;
        schedaRef.metaDescrizioneDaImpostare = null;
        if (salvaGlobali.$ === undefined) {
            delete global.$;
        }
        else {
            global.$ = salvaGlobali.$;
        }
    });
});

test("dopo la revisione il meta prende come originale la descrizione composta di nuovo; se coincide col box, niente meta", () => {
    const richieste = [];
    const dopo = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: "descrizione", content: "<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 4</MAX_PEZZI>" }] } }];
    return conScheda({}, {
        riscaricaDopoIlMeta: async () => { schedaRef.schedeRefDati = dopo; return true; },
        salvaTestiDalBox: async (r) => { richieste.push(r); return true; }
    }, async () => {
        assert.strictEqual(await schedaRef.metaDescrizioneDopoLaRevisione("<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 2</MAX_PEZZI>"), true);
        assert.deepStrictEqual(richieste, [{ voci: [{ label: "descrizione", azione: 3, contenuto: "<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 2</MAX_PEZZI>",
            contenutoServer: "<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 4</MAX_PEZZI>" }] }]);

        assert.strictEqual(await schedaRef.metaDescrizioneDopoLaRevisione("<A.DESCRIZIONE_TITOLO>Lonza</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 4</MAX_PEZZI>"), true);
        assert.strictEqual(richieste.length, 1);
        assert.strictEqual(await schedaRef.metaDescrizioneDopoLaRevisione(null), false);
    });
});

/* ---- il meta della descrizione ---- */

test("Imposta come meta: la descrizione del box con originale quella del server, poi la scheda si riscarica", () => {
    const eventi = [];
    return conScheda({}, {
        testoDescrizioneDelBoxPerMeta: () => "<A.DESCRIZIONE_TITOLO>Arista</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 2</MAX_PEZZI>",
        salvaTestiDalBox: async (r) => { eventi.push(r.voci[0]); return true; },
        riscaricaDopoIlMeta: async () => { eventi.push("riscarica"); return true; }
    }, async () => {
        assert.strictEqual(await schedaRef.impostaDescrizioneComeMeta(), true);
        assert.deepStrictEqual(eventi, [{ label: "descrizione", azione: 3, contenuto: "<A.DESCRIZIONE_TITOLO>Arista</A.DESCRIZIONE_TITOLO><MAX_PEZZI>MAX 2</MAX_PEZZI>",
            contenutoServer: "<A.DESCRIZIONE_TITOLO>Arista</A.DESCRIZIONE_TITOLO>" }, "riscarica"]);
    });
});

test("Aggiorna porta il meta al box con l'originale di adesso; Rimuovi passa dal salvataggio dei meta, che reimpagina", () => {
    const eventi = [];
    const stato = { label: "descrizione", contenuto: "vecchio", contenutoServer: "a", contenutoServerAttuale: "b" };
    return conScheda({ testiDalBox: [stato] }, {
        testoDescrizioneDelBoxPerMeta: () => "nuovo",
        salvaTestiDalBox: async (r) => { eventi.push(r.voci[0]); return true; },
        riscaricaDopoIlMeta: async () => true,
        salvaModificheMeta: async (r) => { eventi.push(r); return true; }
    }, async () => {
        assert.strictEqual(await schedaRef.aggiornaMetaDescrizioneColBox(), true);
        assert.strictEqual(await schedaRef.rimuoviMetaDescrizione(), true);
        assert.deepStrictEqual(eventi, [{ label: "descrizione", azione: 3, contenuto: "nuovo", contenutoServer: "b" }, { voci: [{ label: "descrizione", azione: 2 }] }]);
    });
});

test("Usa quella del server su un meta della descrizione da verificare riscrive la descrizione con i suoi stili", () => {
    const eventi = [];
    const salvaGlobali = { $: global.$, Modali: global.Modali };
    global.$ = () => ({ length: 0 });
    global.Modali = { nascondiHidebleElements: () => { } };
    return conScheda({}, {
        salvaTestiDalBox: async () => true,
        riscaricaDopoIlMeta: async () => true,
        applicaDescrizioneDaServer: async () => { eventi.push("descrizione"); },
        applicaCampoDaServer: async () => { eventi.push("campo"); }
    }, async () => {
        await schedaRef.usaServerAlPostoDelMeta({ tipo: "metaDaVerificare", label: "descrizione", campo: "descrizione", contenutoServerAttuale: "x" }, null);
        assert.deepStrictEqual(eventi, ["descrizione"]);
    }).finally(() => {
        Object.keys(salvaGlobali).forEach(k => { if (salvaGlobali[k] === undefined) { delete global[k]; } else { global[k] = salvaGlobali[k]; } });
    });
});

/* ---- la schermata di modifica ---- */

const UNIVERSALI = { DESCRIZIONE_TITOLO: { nome: "DESCRIZIONE_TITOLO", fondamentale: "descrizione1" } };

function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

function controller(nelMeta, pulsante) {
    const c = Object.create(InputEditController.prototype);
    const campo = { stile: "DESCRIZIONE_TITOLO", testo: "Lonza", modificato: false };
    c.datasource = { descrizione: { modificato: false, lista: [campo] } };
    c.descrInArchivio = ["Arista", "", "", ""];
    c.convalidaFirma = false;
    c.inMismatch = true;
    c.solaLettura = false;
    c.descrizioneNelMeta = nelMeta;
    const globali = {
        pluginMiddleware: { getCampo: () => null, getNameStileUniversale: (s) => UNIVERSALI[s] || null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0] },
        messaggioUtente: () => { },
        $: function (el) {
            if (el === "#salvaButton") {
                return { css: (nome, valore) => { if (nome === "display") { pulsante.push(valore); } } };
            }
            if (el === "#azioni_strutturali") {
                return { children: () => ({ length: 0 }) };
            }
            return {
                attr: (nome) => nome === "currentcharacterstyle" ? el.stile : undefined,
                hasClass: (classe) => classe === "textModified" && el.modificato,
                val: () => el.testo
            };
        }
    };
    return { c: c, globali: globali };
}

test("con la descrizione nei meta il salvataggio non manda la descrizione e il Salva non si accende per lei", () => {
    const pulsante = [];
    const { c, globali } = controller(true, pulsante);
    conGlobali(globali, () => {
        const operazioni = c.getOperazioniDiSalvataggioDaFare(true);
        assert.strictEqual(operazioni.revisione.valore, "");
        assert.strictEqual(operazioni.revisione.descrizione1, undefined);
        assert.deepStrictEqual(operazioni.trattiRipetuti, []);
        assert.strictEqual(c.descrizioneDiversaDallArchivio(), false);
        c.checkStato();
        assert.deepStrictEqual(pulsante, ["none"]);
    });

    //Senza meta, la stessa scheda revisiona.
    const altro = controller(false, []);
    conGlobali(altro.globali, () => {
        assert.strictEqual(altro.c.getOperazioniDiSalvataggioDaFare(true).revisione.descrizione1, "Lonza");
        assert.strictEqual(altro.c.descrizioneModificata(), false);
    });
});

test("la schermata di modifica: pulsanti del meta accanto a quello del server, campi in sola lettura col meta", () => {
    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /\$\("#editReferenza"\)\.append\(\$\('<div id="metaDescrizioneScheda"/);
    assert.match(scheda, /rowOpzioniRegionaliEArtwork\.append\(\$\("#applicaDescrizioneDaServer"\)\);\s*rowOpzioniRegionaliEArtwork\.append\(\$\("#metaDescrizioneScheda"\)\);/);
    assert.match(scheda, /me\.editRefFieldController = new InputEditController\([^\n]*\n\s*(\/\/[^\n]*\n\s*)*me\.applicaStatoMetaDescrizione\(\);/);
    assert.match(scheda, /campo\.prop\("readonly", bloccare \|\| originale \|\| nelMeta\);/);

    const meta = sorgente("metaDelBox.js");
    const pulsanti = meta.substring(meta.indexOf("    aggiornaPulsantiMetaDescrizione() {"));
    assert.match(pulsanti, /if \(this\.descrizioneDaAllineareNellaScheda === true && !modificata\) \{\s*aggiungi\("Applica descrizione del box nel meta"/);
    assert.match(pulsanti, /aggiungi\("Rimuovi descrizione nel meta"/);
    assert.match(pulsanti, /if \(testo != null && testo !== String\(stato\.contenuto == null \? "" : stato\.contenuto\)\) \{\s*aggiungi\("Aggiorna descrizione nel meta"/);
    //Il pulsante del meta segue le modifiche dei campi.
    assert.match(meta, /controller\.dopoModifica = function \(\) \{\s*me\.aggiornaPulsantiMetaDescrizione\(\);\s*\};/);
    assert.match(sorgente("InputEditController.js"), /if \(typeof me\.dopoModifica === "function"\) \{\s*me\.dopoModifica\(\);\s*\}/);
});
