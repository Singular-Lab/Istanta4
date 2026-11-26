/*
 * I20-1278: sotto i parametri di ogni azione sul box c'e' il parametro "confronto".
 * - true: il box rifatto si confronta con quello di prima, come sempre (il vecchio tiene le
 *   posizioni e prende testi e stili);
 * - false, in almeno un'azione: niente confronto. Resta il box rifatto com'e' e quello di prima va
 *   da parte come versione precedente (confrontoBox con forzaReimpaginazione).
 * La tendina parte dal campo Confronto che l'azione dichiara nel plugin di agenzia (true se non lo
 * dichiara) e l'operatore la cambia per quella volta. Vale nella scheda di un box e nella selezione
 * multipla, e il parametro non va a Istanta: non e' un campo del record.
 *
 * schedaRef.js non si carica sotto Node: la regola sta in cambiStrutturali.js e si prova davvero,
 * il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");
const CambiStrutturali = require("../../plugin/cambiStrutturali");

const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
const confronti = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");
const RADICE = path.join(__dirname, "..", "..");

//Il corpo di un membro dell'oggetto: dall'intestazione alla prima "    }," a inizio riga.
function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata: il test va aggiornato");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio));
}

/* ---- la regola ---- */

test("il parametro si chiama confronto, con i valori true e false", () => {
    assert.strictEqual(CambiStrutturali.PARAMETRO_CONFRONTO, "confronto");
    assert.deepStrictEqual(CambiStrutturali.VALORI_CONFRONTO, ["true", "false"]);
});

test("il confronto si salta se almeno un'azione ha confronto a false", () => {
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare(["true"]), false);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare(["false"]), true);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare(["true", "false"]), true);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare(["true", "true"]), false);
});

test("senza azioni, o con valori che non si leggono, il confronto si fa", () => {
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare([]), false);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare(null), false);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare([undefined, null, ""]), false);
    assert.strictEqual(CambiStrutturali.confrontoDaSaltare([" FALSE "]), true);
});

/* ---- il valore dell'azione nel plugin di agenzia ---- */

test("la tendina parte dal campo Confronto dell'azione, true se non c'e'", () => {
    assert.strictEqual(CambiStrutturali.confrontoDiBase({ Confronto: true }), "true");
    assert.strictEqual(CambiStrutturali.confrontoDiBase({ Confronto: false }), "false");
    //Come arriva dal server (camelCase) e come lo scrive la mappa delle azioni.
    assert.strictEqual(CambiStrutturali.confrontoDiBase({ confronto: false }), "false");
    assert.strictEqual(CambiStrutturali.confrontoDiBase({ confronto: "false" }), "false");
    assert.strictEqual(CambiStrutturali.confrontoDiBase({}), "true");
    assert.strictEqual(CambiStrutturali.confrontoDiBase(null), "true");
    assert.strictEqual(CambiStrutturali.confrontoDiBase({ confronto: "boh" }), "true");
});

test("l'azione mappata per la scheda porta il suo confronto", () => {
    const globali = { Utility: global.Utility };
    global.Utility = { parseLabel: l => l };
    try {
        const senza = CambiStrutturali._mapCambioStrutturaleToLegacy({ titolo: "Forza a sconto linea", istruzioni: [], confronto: false }, {}, 1);
        const conConfronto = CambiStrutturali._mapCambioStrutturaleToLegacy({ titolo: "Forza reparto in descrizione", istruzioni: [] }, {}, 2);
        assert.strictEqual(senza.confronto, "false");
        assert.strictEqual(conConfronto.confronto, "true");
    }
    finally {
        if (globali.Utility === undefined) { delete global.Utility; } else { global.Utility = globali.Utility; }
    }
});

test("nei plugin di agenzia ogni azione sul box dichiara Confronto: true, tranne Forza a sconto linea di Edro21", () => {
    for (const cliente of ["Edro21", "Coopfi", "Famila"]) {
        const custom = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source", cliente, "SourceCustomPlugin.json"), "utf8"));
        assert.ok(custom.cambiStrutturali.length > 0, cliente + " ha azioni sul box");
        custom.cambiStrutturali.forEach(a => {
            //Forzare lo sconto linea cambia la disposizione del box: di solito si tiene il box rifatto.
            const senzaConfronto = cliente === "Edro21" && a.Id === 9;
            assert.strictEqual(a.Confronto, !senzaConfronto, cliente + ": " + a.Titolo);
        });
    }
    const edro21 = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"), "utf8"));
    assert.strictEqual(edro21.cambiStrutturali.find(a => a.Id === 9).Titolo, "Forza a sconto linea");
    //Togliere la forzatura si confronta, come le altre.
    assert.strictEqual(edro21.cambiStrutturali.find(a => a.Id === 10).Confronto, true);
});

/* ---- la riga sotto i parametri ---- */

test("la riga confronto e' una tendina true/false che parte dal valore dell'azione, senza la classe dei campi dell'azione", () => {
    const riga = corpoMembro(scheda, "    rigaConfrontoAzione(classe, valoreDiBase) {");
    assert.match(riga, /const diBase = CambiStrutturali\.confrontoDiBase\(\{ confronto: valoreDiBase \}\);/);
    assert.match(riga, /const nome = CambiStrutturali\.PARAMETRO_CONFRONTO;/);
    assert.match(riga, /CambiStrutturali\.VALORI_CONFRONTO\.forEach\(v => \{/);
    assert.match(riga, /\(v === diBase \? " selected" : ""\)/);
    //Il valore sta in data-valore: in UXP il valore di un sp-picker non si scrive con .val().
    assert.match(riga, /tendina\.attr\("data-valore", diBase\);/);
    assert.doesNotMatch(riga, /tendina\.val\(/);
    assert.match(riga, /tendina\.addClass\(classe\);/);
    //Le classi dei campi che vanno a Istanta non ci sono.
    assert.doesNotMatch(riga, /fieldCambioStrutturale/);

    const lettura = corpoMembro(scheda, "    confrontoDaSaltare(contenitore, classe) {");
    assert.match(lettura, /\.map\(el => \$\(el\)\.attr\("data-valore"\)\)/);
});

test("nella scheda di un box ogni azione aggiunta ha la riga confronto sotto i parametri, dal valore dell'azione", () => {
    const aggiunta = scheda.indexOf('panelAzioneEl.append(me.rigaConfrontoAzione("confrontoAzioneBox", objCS.confronto));');
    assert.ok(aggiunta > 0, "la riga confronto non c'e' nel pannello dell'azione");
    //Dopo i parametri dell'azione e prima che il pannello vada fra le azioni.
    const parametri = scheda.lastIndexOf("for (let ist = 0; ist < objCS.istruzioni.length; ist++) {", aggiunta);
    assert.ok(parametri > 0 && parametri < aggiunta);
    assert.ok(aggiunta < scheda.indexOf('$("#azioni_strutturali").append(panelAzioneEl);', parametri));
});

test("nella selezione multipla ogni azione aggiunta ha la riga confronto sotto i parametri, dal valore dell'azione", () => {
    const aggiungi = corpoMembro(scheda, "    aggiungiAzioneSelezioneMultipla(indice) {");
    assert.match(aggiungi, /const confrontoDiBase = CambiStrutturali\.confrontoDaSaltare\(azioniDeiBox\.map\(a => a\.confronto\)\) \? "false" : "true";/);
    const riga = aggiungi.indexOf('pannello.append(me.rigaConfrontoAzione("confrontoAzioneBoxMultipla", confrontoDiBase));');
    assert.ok(riga > aggiungi.indexOf("(azioniDeiBox[0].istruzioni || []).forEach("));
    assert.ok(riga < aggiungi.indexOf('$("#azioni_strutturali_multiple").append(pannello);'));
});

/* ---- il confronto ---- */

test("scheda di un box: confronto a false rifa' il box senza confronto, e confronto non va fra gli attributi", () => {
    const prepara = corpoMembro(scheda, "    preparaCambioStrutturale() {");
    assert.match(prepara, /this\.salvaCambioStrutturaleDo\(params, this\.confrontoDaSaltare\("#azioni_strutturali", "confrontoAzioneBox"\)\);/);
    //Gli attributi sono solo i campi dell'azione.
    assert.match(prepara, /let listaFields = \$\("#azioni_strutturali"\)\.find\("\.fieldCambioStrutturale"\);/);

    const salva = corpoMembro(scheda, "    salvaCambioStrutturaleDo(params, saltaConfronto = false) {");
    assert.match(salva, /confronti\.confrontoBox\(me\.refSelected\.item, res\.boxAggiunto, saltaConfronto === true\);/);
});

test("selezione multipla: confronto a false vale per ogni box, e confronto non va fra gli attributi", () => {
    const applica = corpoMembro(scheda, "    async applicaAzioniSelezioneMultipla() {");
    assert.match(applica, /const saltaConfronto = me\.confrontoDaSaltare\("#azioni_strutturali_multiple", "confrontoAzioneBoxMultipla"\);/);
    assert.match(applica, /me\.cambioStrutturaleSulBox\(params, b\.dettaglio, null, saltaConfronto\)/);
    assert.match(applica, /\.find\("\.fieldCambioStrutturaleMultipla"\)/);

    const cambio = corpoMembro(scheda, "    cambioStrutturaleSulBox(params, dettaglio, rifai = null, saltaConfronto = false) {");
    assert.match(cambio, /confronti\.confrontoBox\(boxPrecedente, finale, saltaConfronto === true\);/);
});

test("senza confronto confrontoBox tiene il box rifatto e mette da parte quello di prima", () => {
    const confronto = corpoMembro(confronti, "    async confrontoBox(box1, box2, forzaReimpaginazione = false){");
    //Il ramo del confronto vale solo senza forzaReimpaginazione.
    assert.match(confronto, /if \(box1Duplicate\.label == box2\.label && !forzaReimpaginazione\) \{/);
    //Nell'altro ramo resta il box rifatto, e il duplicato del vecchio se ne va.
    assert.match(confronto, /else\{\s*\/\/[^\n]*\n\s*boxFinale = box2;\s*box2\.select\(\);\s*box1Duplicate\.remove\(\);/);
    //Il vecchio, non rimosso, va da parte come versione precedente.
    assert.match(confronto, /if \(!box1Rimosso\) \{[\s\S]*?VersionePrecedente\.mettiDaParte\(box1, docInLavorazione\);/);
});
