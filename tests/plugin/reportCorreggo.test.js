/*
 * I20-1221: la sezione Correggo del Report Integrita' (plugin/reportIntegrita/sezioneCorreggo.js).
 *
 * Le correzioni di Correggo4 si aprono in voci: le automatiche (prezzi, foto, loghi, timbri con una
 * regola del cliente) arrivano su Approva, le altre (note, descrizioni, azioni sul box) senza
 * scelta. Elimina lo approva solo un superAdmin, e prima di applicare si chiede quante referenze
 * si eliminano. In Correggo4 si chiude una correzione solo se tutte le sue voci sono state
 * approvate e applicate: le rifiutate e quelle senza scelta restano aperte.
 *
 * Esecuzione: node --test tests/plugin/reportCorreggo.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const correggo = require("../../plugin/reportIntegrita/sezioneCorreggo.js");

const RADICE = path.join(__dirname, "..", "..");
const { SCELTA, TIPO } = correggo;

/// Le regole di Coop come stanno nel suo SourceCustomPlugin.
const COOP = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json"), "utf8")).correzioniCorreggo;

/// Le correzioni come le restituisce Correggo4 (Plugin/Correzioni), in camelCase.
function correzioni() {
    const box = (basecode, pagina) => ({ basecode: basecode, labelBox: "BOX_STD_" + basecode, pagina: pagina, autore: "Carla Category", tipoAutore: "Category" });
    return [
        Object.assign({ id: "nota:12", tipo: "nota", testo: "sgruppare" }, box("8001", 3)),
        Object.assign({ id: "timbro:7", tipo: "timbro", simbolo: "_4_2_alkg", nomeTimbro: "Al kg" }, box("8001", 3)),
        Object.assign({ id: "timbro:8", tipo: "timbro", simbolo: "_2_2_star", nomeTimbro: "Star" }, box("8001", 3)),
        Object.assign({
            id: "edit:31:offerta", tipo: "edit", parte: "offerta",
            campi: { prezzo_promo: "3.90" },
            azioni: [{ id: 2, titolo: "Cambia sconto", campi: { txt_sconto: "30" } }]
        }, box("8001", 3)),
        Object.assign({
            id: "edit:31:descrizione", tipo: "edit", parte: "descrizione",
            descrizione: "<DESCRIZIONE_TITOLO>Mela golden</DESCRIZIONE_TITOLO>FORCED_LINE_BREAK<DESCRIZIONE_GRAMMATURA>1 kg</DESCRIZIONE_GRAMMATURA>",
            foto: [{ codice: "8001", guidId: "foto-8001", nomeFile: "8001_1.psd", stato: 2 }],
            loghi: [{ codice: "BIO", guidId: "logo-bio", nomeFile: "bio.png", stato: 4 }, { codice: "DOP", guidId: "logo-dop", nomeFile: "dop.png", stato: 5 }]
        }, box("8001", 3)),
        Object.assign({ id: "timbro:9", tipo: "timbro", simbolo: "_1_2_elimina", nomeTimbro: "Elimina" }, box("8002", 3)),
        Object.assign({ id: "timbro:10", tipo: "timbro", simbolo: "_1_1_fvol", nomeTimbro: "Fuori volantino" }, box("8003", 4))
    ];
}

function voce(voci, idCorrezione, tipo) {
    return voci.find(v => v.idCorrezione === idCorrezione && v.tipo === tipo);
}

/* ---- import: automatiche e da decidere ---- */

test("le automatiche arrivano approvate, note, descrizioni e azioni sul box senza scelta", () => {
    const voci = correggo.importa(correzioni(), COOP, true);

    const scelte = Object.fromEntries(voci.map(v => [v.idCorrezione + " " + v.tipo, v.scelta]));
    assert.deepStrictEqual(scelte, {
        "nota:12 nota": SCELTA.nessuna,
        "timbro:7 timbro": SCELTA.approva,
        "timbro:8 timbro": SCELTA.nessuna,
        "edit:31:offerta prezzi": SCELTA.approva,
        "edit:31:offerta azione": SCELTA.nessuna,
        "edit:31:descrizione descrizione": SCELTA.nessuna,
        "edit:31:descrizione foto": SCELTA.approva,
        "edit:31:descrizione loghi": SCELTA.approva,
        "timbro:9 timbro": SCELTA.approva,
        "timbro:10 timbro": SCELTA.approva
    });
});

test("ogni voce dice che cosa propone, come il report correzioni di Correggo4", () => {
    const voci = correggo.importa(correzioni(), COOP, true);

    assert.strictEqual(voce(voci, "nota:12", TIPO.nota).testo, "Nota: sgruppare");
    assert.strictEqual(voce(voci, "timbro:7", TIPO.timbro).testo, "Timbro: Al kg");
    assert.strictEqual(voce(voci, "edit:31:offerta", TIPO.prezzi).testo, "Prezzo cambiato in: Prezzo promo: 3.90");
    assert.strictEqual(voce(voci, "edit:31:offerta", TIPO.azione).testo, "Azione: Cambia sconto (30)");
    assert.strictEqual(voce(voci, "edit:31:descrizione", TIPO.descrizione).testo, "Descrizione modificata in: Mela golden / 1 kg");
    assert.strictEqual(voce(voci, "edit:31:descrizione", TIPO.foto).testo, "Foto cambiata in: 8001 secondaria");
    assert.strictEqual(voce(voci, "edit:31:descrizione", TIPO.loghi).testo, "Logo inserito: BIO; Logo rimosso: DOP");
});

test("i timbri di Coop prendono l'azione e il valore del cliente; un timbro senza regola no", () => {
    const voci = correggo.importa(correzioni(), COOP, true);

    const alkg = voce(voci, "timbro:7", TIPO.timbro);
    assert.strictEqual(alkg.idAzione, 3);
    assert.deepStrictEqual(alkg.valori, { force_infopack: "al kg" });
    assert.strictEqual(voce(voci, "timbro:10", TIPO.timbro).idAzione, 27);
    assert.strictEqual(voce(voci, "timbro:9", TIPO.timbro).eliminaRef, true);
    const star = voce(voci, "timbro:8", TIPO.timbro);
    assert.strictEqual(star.automatica, false);
    assert.strictEqual(star.idAzione, null);
});

test("senza la configurazione del cliente il Report Correggo e' spento e nessun timbro e' automatico", () => {
    assert.strictEqual(correggo.configurazione(null), null);
    assert.strictEqual(correggo.configurazione({ abilitato: false, timbri: COOP.timbri }), null);
    const voci = correggo.importa(correzioni(), null, true);
    assert.ok(voci.filter(v => v.tipo === TIPO.timbro).every(v => v.scelta === SCELTA.nessuna));
});

test("Edro21 non ha il Report Correggo", () => {
    const edro = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"), "utf8"));
    assert.strictEqual(correggo.configurazione(edro.correzioniCorreggo), null);
});

/* ---- Elimina ---- */

test("Elimina lo approva solo un superAdmin", () => {
    const voci = correggo.importa(correzioni(), COOP, false);
    const elimina = voce(voci, "timbro:9", TIPO.timbro);

    assert.strictEqual(elimina.scelta, SCELTA.nessuna);
    assert.strictEqual(elimina.approvabile, false);
    assert.strictEqual(correggo.scegli(elimina, SCELTA.approva, false), false);
    assert.strictEqual(elimina.scelta, SCELTA.nessuna);
    //Rifiutarla si puo'.
    assert.strictEqual(correggo.scegli(elimina, SCELTA.rifiuta, false), true);
    assert.strictEqual(elimina.scelta, SCELTA.rifiuta);
});

test("prima della conferma si chiede quante referenze si eliminano", () => {
    const voci = correggo.importa(correzioni(), COOP, true);
    assert.strictEqual(correggo.domandaEliminazione(voci), "Verra' eliminata 1 ref. Confermi?");

    const altra = Object.assign({}, voce(voci, "timbro:9", TIPO.timbro), { chiave: "timbro:11|timbro|0", idCorrezione: "timbro:11", basecode: "8004" });
    assert.strictEqual(correggo.domandaEliminazione(voci.concat([altra])), "Verranno eliminate 2 ref. Confermi?");

    correggo.scegli(voce(voci, "timbro:9", TIPO.timbro), SCELTA.rifiuta, true);
    assert.strictEqual(correggo.domandaEliminazione(voci), null);
});

test("la conferma chiede la domanda prima di applicare qualunque correzione", () => {
    const testo = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const inizio = testo.indexOf("async confermaCorrezioniCorreggo() {");
    const domanda = testo.indexOf("sezioneCorreggo.domandaEliminazione(voci)", inizio);
    const annulla = testo.indexOf("!(await Modali.confirm(domanda))", inizio);
    const applica = testo.indexOf("this._applicaCorrezioniAlBox(", inizio);
    assert.ok(inizio > 0 && domanda > inizio && annulla > domanda && applica > annulla);
});

/* ---- piano della conferma ---- */

test("il piano raccoglie per box le voci approvate; le rifiutate e quelle senza scelta restano fuori", () => {
    const voci = correggo.importa(correzioni(), COOP, true);
    correggo.scegli(voce(voci, "edit:31:offerta", TIPO.azione), SCELTA.approva, true);
    correggo.scegli(voce(voci, "edit:31:descrizione", TIPO.loghi), SCELTA.rifiuta, true);
    correggo.scegli(voce(voci, "nota:12", TIPO.nota), SCELTA.approva, true);

    const piano = correggo.pianoDellaConferma(voci);

    const b8001 = piano.box.find(b => b.basecode === "8001");
    assert.deepStrictEqual(b8001.prezzi, { prezzo_promo: "3.90" });
    assert.deepStrictEqual(b8001.azioni.map(a => a.idAzione != null ? a.idAzione : a.titolo), [3, "Cambia sconto"]);
    assert.strictEqual(b8001.descrizione, null);
    assert.strictEqual(b8001.foto.length, 1);
    assert.deepStrictEqual(b8001.loghiAggiunti, []);
    assert.strictEqual(b8001.elimina, false);
    assert.strictEqual(piano.box.find(b => b.basecode === "8002").elimina, true);
    assert.deepStrictEqual(piano.box.find(b => b.basecode === "8003").azioni.map(a => a.idAzione), [27]);
    //La nota approvata non cambia l'impaginato: l'ha gestita l'operatore.
    assert.deepStrictEqual(piano.senzaLavoro.map(v => v.idCorrezione), ["nota:12"]);
});

test("in Correggo4 si chiude una correzione solo se tutte le sue voci sono approvate e applicate", () => {
    const voci = correggo.importa(correzioni(), COOP, true);
    const tutteApplicate = Object.fromEntries(voci.map(v => [v.chiave, true]));

    //edit:31:offerta ha l'azione senza scelta, edit:31:descrizione la descrizione: restano aperte.
    assert.deepStrictEqual(correggo.correzioniDaChiudere(voci, tutteApplicate).sort(),
        ["timbro:10", "timbro:7", "timbro:9"]);

    correggo.scegli(voce(voci, "edit:31:offerta", TIPO.azione), SCELTA.approva, true);
    correggo.scegli(voce(voci, "nota:12", TIPO.nota), SCELTA.rifiuta, true);
    const esiti = Object.assign({}, tutteApplicate, { [voce(voci, "timbro:10", TIPO.timbro).chiave]: false });
    assert.deepStrictEqual(correggo.correzioniDaChiudere(voci, esiti).sort(),
        ["edit:31:offerta", "timbro:7", "timbro:9"]);
});

test("il riepilogo conta applicate, non riuscite, rifiutate, senza scelta e chiuse", () => {
    const voci = correggo.importa(correzioni(), COOP, true);
    correggo.scegli(voce(voci, "nota:12", TIPO.nota), SCELTA.rifiuta, true);
    const esiti = Object.fromEntries(voci.filter(v => v.scelta === SCELTA.approva).map(v => [v.chiave, v.idCorrezione !== "timbro:10"]));

    const r = correggo.riepilogo(voci, esiti, ["timbro:7"]);

    assert.strictEqual(r.testo, "Correzioni di Correggo: 5 applicate, 1 non riuscite, 1 rifiutate, 3 senza scelta, 1 chiuse in Correggo4.");
    assert.strictEqual(r.tipo, "warning");
});

/* ---- dalle voci alle richieste ---- */

test("i prezzi diventano un'azione a valori fissi con il $ al posto del punto", () => {
    assert.deepStrictEqual(correggo.azioneDeiPrezzi({ prezzo_promo: "3.90", "Descrizioni.Peso": "500" }), {
        titolo: "Prezzi da Correggo",
        istruzioni: [{ field: "prezzo_promo", valore: "3.90" }, { field: "Descrizioni$Peso", valore: "500" }]
    });
    assert.strictEqual(correggo.azioneDeiPrezzi({}), null);
});

test("l'azione si trova per id (timbri) o per titolo (Edit avanzato), e i valori per istruzione", () => {
    const strutture = [{ id: 3, titolo: "Cambia prezzo info pack" }, { id: 27, titolo: "Metti fuori volantino" }];

    assert.strictEqual(correggo.strutturaDellAzione(strutture, { idAzione: 27 }).titolo, "Metti fuori volantino");
    assert.strictEqual(correggo.strutturaDellAzione(strutture, { titolo: " cambia PREZZO info pack " }).id, 3);
    assert.strictEqual(correggo.strutturaDellAzione(strutture, { titolo: "Inesistente" }), null);

    const istruzioni = [{ field: "force_infopack", valore: null }, { field: "Referenza$InVolantino", valore: "false" }];
    assert.deepStrictEqual(correggo.valoriPerIstruzioni(istruzioni, { force_infopack: "al kg", "Referenza.InVolantino": "false" }),
        { force_infopack: "al kg", "Referenza$InVolantino": "false" });
});

test("primarie e secondarie: lo stato proposto per le referenze del gruppo, null se non cambia niente", () => {
    const records = [
        { recordInTracciato: { "Referenza.Codice": "8001", StatoSelezione: 1, "Foto.guidid": "foto-8001" } },
        { recordInTracciato: { "Referenza.Codice": "8005", StatoSelezione: 3, "Foto.guidid": "foto-8005" } }
    ];

    assert.deepStrictEqual(correggo.primarieSecondarie(records, [{ codice: "8005", stato: 2 }, { codice: "9999", stato: 1 }]),
        [{ codRef: "8001", stato: 1 }, { codRef: "8005", stato: 2 }]);
    assert.strictEqual(correggo.primarieSecondarie(records, [{ codice: "8001", stato: 1 }]), null);
    //Solo un file diverso va cambiato in archivio.
    assert.deepStrictEqual(correggo.fotoDaCambiare(records, [{ codice: "8001", guidid: "foto-nuova" }, { codice: "8005", guidid: "foto-8005" }])
        .map(f => f.codice), ["8001"]);
});

/* ---- dove sta nel Plugin ---- */

test("la parte pura si carica sotto Node senza InDesign", () => {
    assert.doesNotMatch(leggiFileDelPlugin("reportIntegrita/sezioneCorreggo.js"), /require\(['"]indesign['"]\)/);
});

test("la linguetta Correggo c'e' solo per il cliente che la abilita", () => {
    const testo = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    assert.match(testo, /const correggoPanel = this\.correggoAbilitato\(\) \? this\._buildPanelCorreggo\(\) : null;/);
    assert.match(testo, /pluginMiddleware\.getCampo\("correzioniCorreggo"\)/);
    const pannelli = leggiFileDelPlugin("reportIntegrita/pannelli.js").replace(/\r/g, "");
    assert.match(pannelli, /btnImporta\.textContent = "Importa correzioni";/);
    assert.match(pannelli, /btnConferma\.textContent = "Conferma correzioni";/);
});

test("Elimina passa da rimuoviRefImpaginata con l'eliminazione gia' confermata", () => {
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    assert.match(report, /rimuoviRefImpaginata\(\[\{ codice: p\.basecode, idRec: idRec \}\], true, \{ eliminaDaTracciato: true, boxes: \[box\] \}\)/);
    const index = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(index, /async function rimuoviRefImpaginata\(listaCodiciConId = \[\], mantieniBusyEsterno = false, eliminazioneConfermata = null\)/);
    assert.match(index, /var eliminaDaTracciato = eliminazioneConfermata != null && eliminazioneConfermata\.eliminaDaTracciato === true;/);
});

test("la descrizione approvata diventa il meta del box indicato", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /salvaTestiDalBox\(richiesta, destinazione = null\)/);
    assert.match(scheda, /formData\.append\("CodiceGruppo", destinazione != null \? destinazione\.codiceGruppo : schedaRef\[0\]/);
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    assert.match(report, /azione: schedaRef\.AZIONE_TESTO_DAL_BOX\.crea,/);
});
