/*
 * I20-1082: le decisioni sulle foto extra solo per questa lavorazione, anche dalla scheda Foto Extra.
 *
 * Fino a I20-1072 si prendevano solo dalla finestra delle differenze (tieni l'immagine del box,
 * tienila solo per questa lavorazione, escludila per questa lavorazione) e dalla scheda Foto Extra
 * si potevano soltanto togliere. Ora la scheda ha "Escludi solo qui" sulle righe, e Link e Aggiungi
 * chiedono prima se valgono per tutte le lavorazioni (l'anagrafica, come sempre) o solo per questa:
 * in quel caso il file va nella cartella Loghi e nel box, e si registra la decisione della
 * lavorazione, senza toccare anagrafica e Olimpo. Le extra caricate a mano, che non hanno sigla,
 * si riconoscono dal nome del file.
 *
 * schedaRef.js (con schedaFoto.js mescolato dentro) si carica sotto Node; InDesign e le globali
 * del Plugin si fingono, e il resto si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");
const NoRenderElementi = require("../../plugin/noRenderElementi.js");

const LOGO = NoRenderElementi.TIPO.logo;
const FOTO_EXTRA = NoRenderElementi.TIPO.fotoExtra;

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
async function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return await prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

//Metodi della scheda sostituiti per la durata di una prova.
async function conMetodi(metodi, prova) {
    const salvati = {};
    Object.keys(metodi).forEach(k => { salvati[k] = schedaRef[k]; schedaRef[k] = metodi[k]; });
    try {
        return await prova();
    }
    finally {
        Object.assign(schedaRef, salvati);
    }
}

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- la chiave ---- */

test("la chiave di una foto extra e' la sigla, o il nome del file per quelle caricate a mano", () => {
    assert.strictEqual(schedaRef.chiaveExtra({ sigla: "Logo_SDB", nome: "Logo_SDB.psd" }), "Logo_SDB");
    assert.strictEqual(schedaRef.chiaveExtra({ sigla: "", nome: "bollino.png" }), "bollino.png");
    //La riga della scheda porta la sigla come attributo: null diventa la parola "null".
    assert.strictEqual(schedaRef.chiaveExtra({ sigla: "null", nome: "bollino.png" }), "bollino.png");
    assert.strictEqual(schedaRef.chiaveExtra({ sigla: null, nome: "bollino.png" }), "bollino.png");
    assert.strictEqual(schedaRef.chiaveExtra({}), "");
    assert.strictEqual(schedaRef.chiaveExtra(null), "");
});

test("una decisione riconosce l'extra manuale dalla sigla o, se non ce l'ha, dal nome", () => {
    assert.strictEqual(schedaRef.stessaExtraManuale({ sigla: "payoff", nome: "x.psd" }, "payoff"), true);
    assert.strictEqual(schedaRef.stessaExtraManuale({ sigla: "payoff", nome: "x.psd" }, "x.psd"), false);
    assert.strictEqual(schedaRef.stessaExtraManuale({ sigla: "", nome: "x.psd" }, "x.psd"), true);
    assert.strictEqual(schedaRef.stessaExtraManuale({ sigla: "", nome: "x.psd" }, ""), false);
    assert.strictEqual(schedaRef.stessaExtraManuale(null, "x.psd"), false);
});

test("l'esclusione di un'extra caricata a mano si vede subito nei record in memoria", () => {
    const records = [{ recordInTracciato: { "Foto.Extra": [{ sigla: "", nome: "bollino.png", attiva: true }, { sigla: "payoff", nome: "bollino.png", attiva: true }] } }];
    schedaRef.applicaExtraLavorazioneAiRecord(records, { tipo: FOTO_EXTRA, sigla: "bollino.png", azione: 3, nome: null, nomeServer: "bollino.png", tipoFoto: 2 });
    assert.strictEqual(records[0].recordInTracciato["Foto.Extra"][0].attiva, false);
    assert.strictEqual(records[0].recordInTracciato["Foto.Extra"][1].attiva, true);
    assert.strictEqual(records[0].recordInTracciato.extraLavorazione.length, 1);
});

/* ---- le richieste ---- */

test("Escludi solo qui e' la stessa decisione dell'esclusione dalla finestra delle differenze", () => {
    assert.deepStrictEqual(schedaRef.richiestaEscludiSoloQui({ sigla: "Logo_SDB", nome: "Logo_SDB.psd" }, 3),
        { rimuovi: false, voce: { tipo: LOGO, sigla: "Logo_SDB", azione: 3, nome: null, nomeServer: "Logo_SDB.psd", tipoFoto: 3 } });
    assert.deepStrictEqual(schedaRef.richiestaEscludiSoloQui({ sigla: "", nome: "bollino.png" }, "2").voce,
        { tipo: FOTO_EXTRA, sigla: "bollino.png", azione: 3, nome: null, nomeServer: "bollino.png", tipoFoto: 2 });
    assert.strictEqual(schedaRef.richiestaEscludiSoloQui({ sigla: "", nome: "" }, 2), null);
});

test("Link e Carica solo qui sono la stessa decisione di tienila solo per questa lavorazione, con chiave il file", () => {
    assert.deepStrictEqual(schedaRef.richiestaAggiungiSoloQui("bollino.png", "2"),
        { rimuovi: false, voce: { tipo: FOTO_EXTRA, sigla: "bollino.png", azione: 2, nome: "bollino.png", nomeServer: null, tipoFoto: 2 } });
    assert.strictEqual(schedaRef.richiestaAggiungiSoloQui("Logo_X.psd", 3).voce.tipo, LOGO);
    assert.strictEqual(schedaRef.richiestaAggiungiSoloQui("", 3), null);
    assert.strictEqual(schedaRef.richiestaAggiungiSoloQui(null, 3), null);
});

test("Link e Aggiungi chiedono per chi valgono; Annulla non fa niente", async () => {
    const chiamate = [];
    const risposte = [{ result: true, hiddenVal: "lavorazione" }, { result: true, hiddenVal: "tutte" }, { result: false, hiddenVal: null }];
    await conGlobali({ Modali: { confirmCustom: async (...argomenti) => { chiamate.push(argomenti); return risposte.shift(); } } }, async () => {
        assert.strictEqual(await schedaRef.sceltaAmbitoAzioneExtra(), "lavorazione");
        assert.strictEqual(await schedaRef.sceltaAmbitoAzioneExtra(), "tutte");
        assert.strictEqual(await schedaRef.sceltaAmbitoAzioneExtra(), null);
    });
    assert.deepStrictEqual(chiamate[0].slice(1), ["Per tutte le lavorazioni", "tutte", "Solo per questa lavorazione", "lavorazione"]);
});

/* ---- la registrazione ---- */

function finteDellaScheda(eventi, esitoServer = true) {
    return {
        salvaExtraLavorazione: async (richiesta) => { eventi.push("server " + richiesta.voce.sigla); return esitoServer; },
        applicaExtraLavorazioneAiRecord: (records, voce) => { eventi.push("record " + voce.sigla); },
        FotoExtraPanel: () => { eventi.push("pannello"); },
        differenzeDatiNelBox: async () => { eventi.push("preanalisi"); return []; },
        memorizzaSegnalazioni: () => { eventi.push("segnalazioni"); },
        aggiornaPulsanteSegnalazioni: () => { eventi.push("segnalino"); }
    };
}

test("la decisione prima si registra sul server, poi cambia il box e la scheda", async () => {
    const eventi = [];
    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(finteDellaScheda(eventi), async () => {
        const esito = await schedaRef.registraDecisioneExtraDallaScheda(schedaRef.richiestaAggiungiSoloQui("bollino.png", 2), {}, () => { eventi.push("box"); return null; });
        assert.strictEqual(esito, true);
    }));
    assert.deepStrictEqual(eventi, ["server bollino.png", "box", "record bollino.png", "pannello", "preanalisi", "segnalazioni", "segnalino"]);
});

test("se il server non la registra, il box e la scheda restano come sono", async () => {
    const eventi = [];
    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(finteDellaScheda(eventi, false), async () => {
        assert.strictEqual(await schedaRef.registraDecisioneExtraDallaScheda(schedaRef.richiestaAggiungiSoloQui("bollino.png", 2), {}, () => { eventi.push("box"); }), false);
    }));
    assert.deepStrictEqual(eventi, ["server bollino.png"]);
});

test("senza una chiave non si registra niente, e lo si dice", async () => {
    const messaggi = [];
    const eventi = [];
    await conGlobali({ messaggioUtente: (testo) => messaggi.push(testo) }, () => conMetodi(finteDellaScheda(eventi), async () => {
        assert.strictEqual(await schedaRef.registraDecisioneExtraDallaScheda(null, {}), false);
    }));
    assert.deepStrictEqual(eventi, []);
    assert.match(messaggi[0], /^Code SRF-112 /);
});

/* ---- Carica solo qui ---- */

function boxFinto(labels = []) {
    return { allPageItems: labels.map(l => ({ label: l })) };
}

test("Carica solo qui: il file va nei Loghi, si registra come decisione e si mette nel box", async () => {
    const scritti = [];
    const registrate = [];
    const impaginate = [];
    await conGlobali({
        selectFile: async () => ({ nomeFile: "bollino.png", file: "bytes" }),
        ReperimentoFoto: { scriviFileInCartella: async (file, cartella, nome) => { scritti.push([file, cartella, nome]); } },
        percorsoLoghi: "/Loghi/",
        pathLavorazione: "/lav/",
        messaggioUtente: () => {}
    }, () => conMetodi({
        schedeRefDati: [{ recordInTracciato: { StatoSelezione: 1 } }],
        impaginaFotoExtra: (...argomenti) => { impaginate.push(argomenti); return null; },
        registraDecisioneExtraDallaScheda: async (richiesta, box, sulBox) => { registrate.push(richiesta); sulBox(); return true; }
    }, async () => {
        assert.strictEqual(await schedaRef.caricaExtraSoloPerLavorazione("2", boxFinto()), true);
    }));
    assert.deepStrictEqual(scritti, [["bytes", "/Loghi/", "bollino.png"]]);
    assert.deepStrictEqual(registrate[0].voce, { tipo: FOTO_EXTRA, sigla: "bollino.png", azione: 2, nome: "bollino.png", nomeServer: null, tipoFoto: 2 });
    //Nel box con la chiave della decisione, cosi' la label e il meta si riconoscono.
    assert.strictEqual(impaginate[0][0], "bollino.png");
    assert.strictEqual(impaginate[0][1], 2);
    assert.strictEqual(impaginate[0][5], "bollino.png");
});

test("Carica solo qui: un file gia' nel box, o nessun file scelto, non fanno niente", async () => {
    const scritti = [];
    const finte = {
        ReperimentoFoto: { scriviFileInCartella: async () => { scritti.push(1); } },
        percorsoLoghi: "/Loghi/",
        messaggioUtente: () => {}
    };
    await conGlobali(Object.assign({ selectFile: async () => ({ nomeFile: "bollino.png", file: "bytes" }) }, finte), async () => {
        assert.strictEqual(await schedaRef.caricaExtraSoloPerLavorazione(2, boxFinto(["foto_extra$bollino.png$tipo_2"])), false);
    });
    await conGlobali(Object.assign({ selectFile: async () => null }, finte), async () => {
        assert.strictEqual(await schedaRef.caricaExtraSoloPerLavorazione(2, boxFinto()), false);
    });
    assert.deepStrictEqual(scritti, []);
});

test("Carica solo qui: se il file non si scrive nei Loghi non si registra niente", async () => {
    const messaggi = [];
    const registrate = [];
    await conGlobali({
        selectFile: async () => ({ nomeFile: "bollino.png", file: "bytes" }),
        ReperimentoFoto: { scriviFileInCartella: async () => { throw new Error("disco pieno"); } },
        percorsoLoghi: "/Loghi/",
        messaggioUtente: (testo) => messaggi.push(testo)
    }, () => conMetodi({ registraDecisioneExtraDallaScheda: async (richiesta) => { registrate.push(richiesta); return true; } }, async () => {
        assert.strictEqual(await schedaRef.caricaExtraSoloPerLavorazione(2, boxFinto()), false);
    }));
    assert.deepStrictEqual(registrate, []);
    assert.match(messaggi[0], /^Code SRF-113 /);
});

/* ---- la scheda Foto Extra ---- */

test("la scheda Foto Extra offre Escludi solo qui e chiede per chi valgono Link e Aggiungi", () => {
    const testo = sorgente("reperimentoFoto/schedaFoto.js");
    const inizio = testo.indexOf("    FotoExtraPanel(box) {");
    const pannello = testo.substring(inizio, testo.indexOf("\n    async updateImmagine(", inizio));

    //Manuali: senza decisione e attive, Escludi solo qui.
    assert.match(pannello, /else if \(elemento\.attiva\) \{\s*row\.append\(me\.pulsanteEscludiSoloQui\(elemento, elemento\.tipo, box\)\);/);
    //Automatiche: senza decisione e incluse, Escludi solo qui accanto a Escludi/Includi.
    assert.match(pannello, /if \(decisione == null && !elemento\.escluso\) \{\s*row\.append\(me\.pulsanteEscludiSoloQui\(elemento, elemento\.tipo, box\)\);/);
    //Aggiungi: prima la scelta; solo per questa lavorazione carica senza anagrafica.
    assert.match(pannello, /var ambito = await me\.sceltaAmbitoAzioneExtra\(\);\s*if \(ambito == null\) \{\s*return;\s*\}\s*if \(ambito === me\.AMBITO_AZIONE_EXTRA\.lavorazione\) \{\s*await me\.caricaExtraSoloPerLavorazione\(tipoPanel, me\.refSelected\.item\);\s*return;\s*\}\s*(\/\/[^\n]*\n\s*)*me\.updateImmagine\(/);
    //Link: la scelta passa a linkLogoBollo.
    assert.match(pannello, /me\.linkLogoBollo\(tipoPanel, ambito === me\.AMBITO_AZIONE_EXTRA\.lavorazione\);/);
});

test("Link solo qui non collega il logo all'anagrafica: registra la decisione e lo mette nel box", () => {
    const testo = sorgente("reperimentoFoto/schedaFoto.js");
    const inizio = testo.indexOf("    async linkLogoBollo(tipo, soloPerLavorazione = false) {");
    assert.notStrictEqual(inizio, -1);
    const link = testo.substring(inizio, testo.indexOf("\n    impaginaFotoExtra(", inizio));
    //Il ramo sta dopo i controlli sul file nei Loghi e prima della chiamata al server.
    const controlli = link.indexOf("if (localMd5 !== logoData.fileHash) {");
    const ramo = link.indexOf("if (soloPerLavorazione) {");
    const server = link.indexOf('xhr.send("SyncFoto/linkLogoBollo/"');
    assert.ok(controlli > 0 && ramo > controlli && server > ramo);
    assert.match(link, /if \(soloPerLavorazione\) \{\s*Modali\.closeAllModal\(\);\s*await me\.registraDecisioneExtraDallaScheda\(me\.richiestaAggiungiSoloQui\(logoData\.fileName, tipo\), box, function \(\) \{\s*return me\.impaginaFotoExtra\(logoData\.fileName, parseInt\(tipo\), box, pathLavorazione, primario\.recordInTracciato, logoData\.fileName\);\s*\}\);\s*return;\s*\}/);
});

/* ---- I20-1082, lotto 2: solo volantino o tutto ---- */

const fs = require("fs");
const path = require("path");

//pluginMiddleware.js non si carica sotto Node: il membro si estrae dal sorgente e si esegue davvero.
function middlewareVero(customPluginDB, callCustom = false, customAgenzia = undefined) {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "pluginMiddleware.js"), "utf8");
    const inizio = testo.indexOf("    getChiediAmbitoDecisioniLavorazione() {");
    assert.notStrictEqual(inizio, -1, "getChiediAmbitoDecisioniLavorazione non trovata");
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < testo.length && fine < 0; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}") { livello--; if (livello === 0) { fine = i + 1; } }
    }
    const membro = new Function("customAgenzia", "return ({\n" + testo.substring(inizio, fine) + "\n});")(customAgenzia);
    return Object.assign(membro, { callCustom: callCustom, customPluginDB: customPluginDB });
}

function sourceCustomPlugin(cliente) {
    const file = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", cliente, "SourceCustomPlugin.json");
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function dichiaratoNelCustom(cliente) {
    const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "Agenzie", cliente, "custom.js"), "utf8");
    const trovata = testo.match(/^\s*chiediAmbitoDecisioniLavorazione:\s*(true|false)\s*,/m);
    return trovata ? trovata[1] === "true" : undefined;
}

test("chiedere l'ambito lo dice la configurazione del server; se non lo manda, il custom.js", () => {
    assert.strictEqual(middlewareVero(sourceCustomPlugin("Coopfi")).getChiediAmbitoDecisioniLavorazione(), true);
    assert.strictEqual(middlewareVero(sourceCustomPlugin("Edro21")).getChiediAmbitoDecisioniLavorazione(), false);
    //Il server comanda anche quando dice di no.
    assert.strictEqual(middlewareVero({ chiediAmbitoDecisioniLavorazione: false }, false, { chiediAmbitoDecisioniLavorazione: true }).getChiediAmbitoDecisioniLavorazione(), false);
    //Istanta non ancora aggiornata: la chiave non arriva e vale il custom.js di Coop.
    assert.strictEqual(middlewareVero({}, false, { chiediAmbitoDecisioniLavorazione: true }).getChiediAmbitoDecisioniLavorazione(), true);
    assert.strictEqual(middlewareVero(null, false, {}).getChiediAmbitoDecisioniLavorazione(), false);
    assert.strictEqual(middlewareVero(null, true, { chiediAmbitoDecisioniLavorazione: true }).getChiediAmbitoDecisioniLavorazione(), true);
});

test("solo Coop chiede l'ambito, nel SourceCustomPlugin e nel custom.js", () => {
    assert.strictEqual(sourceCustomPlugin("Coopfi").chiediAmbitoDecisioniLavorazione, true);
    assert.strictEqual(dichiaratoNelCustom("Coopfi"), true);
    fs.readdirSync(path.join(__dirname, "..", "..", "plugin", "Agenzie"), { withFileTypes: true })
        .filter(voce => voce.isDirectory() && voce.name !== "Coopfi"
            && fs.existsSync(path.join(__dirname, "..", "..", "plugin", "Agenzie", voce.name, "custom.js")))
        .forEach(voce => assert.strictEqual(dichiaratoNelCustom(voce.name), undefined, voce.name));
});

function ambiente(chiedi, tipoLavorazione, risposta) {
    const domande = [];
    return {
        domande: domande,
        globali: {
            pluginMiddleware: { getChiediAmbitoDecisioniLavorazione: () => chiedi },
            ficoProcess: { getTipoLavorazioneCorrente: () => tipoLavorazione },
            Modali: { confirmCustom: async (...argomenti) => { domande.push(argomenti); return risposta; } }
        }
    };
}

test("Coop, in un volantino: si chiede solo volantino o tutto", async () => {
    const solo = ambiente(true, 1, { result: true, hiddenVal: 1 });
    await conGlobali(solo.globali, async () => assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), 1));
    assert.deepStrictEqual(solo.domande[0], ["Vale solo per il volantino o anche per i POP?", "Solo volantino", 1, "Tutto (volantino e POP)", 0]);

    const tutto = ambiente(true, 1, { result: true, hiddenVal: 0 });
    await conGlobali(tutto.globali, async () => assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), 0));

    const annulla = ambiente(true, 1, { result: false, hiddenVal: null });
    await conGlobali(annulla.globali, async () => assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), null));
});

test("chi non lo dichiara, o un POP, non chiede niente e vale per tutto", async () => {
    const altri = ambiente(false, 1, null);
    await conGlobali(altri.globali, async () => assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), 0));
    assert.deepStrictEqual(altri.domande, []);

    const pop = ambiente(true, 2, null);
    await conGlobali(pop.globali, async () => assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), 0));
    assert.deepStrictEqual(pop.domande, []);

    await conGlobali({ pluginMiddleware: undefined }, async () => {
        delete global.pluginMiddleware;
        assert.strictEqual(await schedaRef.chiediAmbitoDecisione(), 0);
    });
});

test("dalla finestra delle differenze la decisione porta l'ambito scelto, e Annulla non la registra", async () => {
    const mandate = [];
    const metodi = {
        salvaExtraLavorazione: async (richiesta) => { mandate.push(richiesta); return true; },
        copiaFileDelBoxInLoghi: () => true,
        applicaExtraLavorazioneAiRecord: () => {}
    };
    const diff = { label: "Logo_SDB", difference: "...", tipo: "extraMancante", famiglia: "extraAuto", sigla: "Logo_SDB", tipoElemento: LOGO, nome: "Logo_SDB.psd" };

    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(Object.assign({ chiediAmbitoDecisione: async () => 1 }, metodi), async () => {
        assert.strictEqual(await schedaRef.eseguiAzioneExtra(diff, "escludiLavorazione", null), true);
    }));
    assert.strictEqual(mandate[0].voce.ambito, 1);

    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(Object.assign({ chiediAmbitoDecisione: async () => null }, metodi), async () => {
        assert.strictEqual(await schedaRef.eseguiAzioneExtra(diff, "escludiLavorazione", null), false);
    }));
    assert.strictEqual(mandate.length, 1);
});

test("dalla scheda Foto Extra la decisione porta l'ambito scelto, e Annulla non la registra", async () => {
    const eventi = [];
    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(Object.assign(finteDellaScheda(eventi), { chiediAmbitoDecisione: async () => 1 }), async () => {
        const richiesta = schedaRef.richiestaEscludiSoloQui({ sigla: "Logo_SDB", nome: "Logo_SDB.psd" }, 3);
        assert.strictEqual(await schedaRef.registraDecisioneExtraDallaScheda(richiesta, {}), true);
        assert.strictEqual(richiesta.voce.ambito, 1);
    }));

    const annullati = [];
    await conGlobali({ messaggioUtente: () => {} }, () => conMetodi(Object.assign(finteDellaScheda(annullati), { chiediAmbitoDecisione: async () => null }), async () => {
        assert.strictEqual(await schedaRef.registraDecisioneExtraDallaScheda(schedaRef.richiestaAggiungiSoloQui("bollino.png", 2), {}, () => { annullati.push("box"); }), false);
    }));
    assert.deepStrictEqual(annullati, []);
});

test("una decisione solo volantino lo dice accanto alla foto e nella finestra", () => {
    assert.strictEqual(schedaRef.etichettaDecisioneExtra({ azione: 3, ambito: 1 }), "esclusa per questa lavorazione (solo volantino)");
    assert.strictEqual(schedaRef.etichettaDecisioneExtra({ azione: 3, ambito: 0 }), "esclusa per questa lavorazione");
    assert.strictEqual(schedaRef.etichettaDecisioneExtra({ azione: 2 }), "solo per questa lavorazione");
    assert.strictEqual(schedaRef.descriviExtraLavorazione({ sigla: "Logo_SDB", azione: 3, ambito: 1 }), "Logo_SDB: esclusa per questa lavorazione (solo volantino)");
    assert.strictEqual(schedaRef.descriviExtraLavorazione({ sigla: "Logo_SDB", azione: 3 }), "Logo_SDB: esclusa per questa lavorazione");
});
