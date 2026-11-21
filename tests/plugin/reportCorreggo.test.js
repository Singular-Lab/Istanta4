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
    correggo.scegli(voce(voci, "edit:31:descrizione", TIPO.descrizione), SCELTA.approva, true);

    const piano = correggo.pianoDellaConferma(voci);

    const b8001 = piano.box.find(b => b.basecode === "8001");
    assert.deepStrictEqual(b8001.prezzi, { prezzo_promo: "3.90" });
    assert.deepStrictEqual(b8001.azioni.map(a => a.idAzione != null ? a.idAzione : a.titolo), [3, "Cambia sconto"]);
    //I20-1233: la descrizione approvata non arriva al box.
    assert.ok(!("descrizione" in b8001));
    assert.ok(!b8001.voci.some(v => v.tipo === TIPO.descrizione));
    assert.strictEqual(b8001.foto.length, 1);
    assert.deepStrictEqual(b8001.loghiAggiunti, []);
    assert.strictEqual(b8001.elimina, false);
    assert.strictEqual(piano.box.find(b => b.basecode === "8002").elimina, true);
    assert.deepStrictEqual(piano.box.find(b => b.basecode === "8003").azioni.map(a => a.idAzione), [27]);
    //La nota e la descrizione approvate non cambiano l'impaginato: le ha gestite l'operatore.
    assert.deepStrictEqual(piano.senzaLavoro.map(v => v.idCorrezione + " " + v.tipo), ["nota:12 nota", "edit:31:descrizione descrizione"]);
});

test("I20-1233: la descrizione arriva per conoscenza e, approvata, si chiude senza toccare il box", () => {
    const voci = correggo.importa(correzioni().filter(c => c.id === "edit:31:descrizione"), COOP, true);
    const descrizione = voce(voci, "edit:31:descrizione", TIPO.descrizione);
    assert.strictEqual(descrizione.soloInformativa, true);
    assert.strictEqual(descrizione.scelta, SCELTA.nessuna);
    //Foto e loghi della stessa correzione invece cambiano il box.
    assert.strictEqual(voce(voci, "edit:31:descrizione", TIPO.foto).soloInformativa, undefined);

    correggo.scegli(descrizione, SCELTA.approva, true);
    const piano = correggo.pianoDellaConferma(voci);
    assert.deepStrictEqual(piano.box[0].voci.map(v => v.tipo), [TIPO.foto, TIPO.loghi]);
    assert.deepStrictEqual(piano.senzaLavoro.map(v => v.tipo), [TIPO.descrizione]);

    const esiti = Object.fromEntries(voci.map(v => [v.chiave, true]));
    assert.deepStrictEqual(correggo.correzioniDaChiudere(voci, esiti), ["edit:31:descrizione"]);
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

test("I20-1233: la conferma non scrive la descrizione nella referenza", () => {
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const inizio = report.indexOf("async _applicaCorrezioniAlBox(");
    const fine = report.indexOf("async _applicaFotoCorreggo(", inizio);
    assert.ok(inizio > 0 && fine > inizio);
    const applica = report.substring(inizio, fine);
    assert.doesNotMatch(applica, /salvaTestiDalBox/);
    assert.doesNotMatch(applica, /p\.descrizione/);
});

test("I20-1233: con rifai il cambio strutturale non impagina e non confronta, rifa' il box chi lo chiede", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /cambioStrutturaleSulBox\(params, dettaglio, rifai = null\) \{/);
    const inizio = scheda.indexOf("cambioStrutturaleSulBox(params, dettaglio, rifai = null) {");
    const conRifai = scheda.indexOf("if (typeof rifai === \"function\") {", inizio);
    const impagina = scheda.indexOf("await impaginaBox(", inizio);
    const confronto = scheda.indexOf("confronti.confrontoBox(", inizio);
    //Il ramo di rifai viene prima di impaginaBox e del confronto, ed esce con resolve.
    assert.ok(conRifai > inizio && conRifai < impagina && impagina < confronto);
    const ramo = scheda.substring(conRifai, impagina);
    assert.match(ramo, /const boxRifatto = await rifai\(\);/);
    assert.match(ramo, /resolve\(\{ box: boxRifatto \}\);\s*return;/);
    //Il ramo della referenza uscita dal volantino resta prima di rifai: un FVOL non rifa' il box.
    const uscita = scheda.indexOf("await FuoriVolantino.aggiornaDopoUscita(params);", inizio);
    assert.ok(uscita > inizio && uscita < conRifai);
});

/* ---- I20-1233: gli scambi del menabo' avanzato ---- */

function scambi() {
    const scambio = (idVoce, basecode, destinazione, aMano) => ({
        id: "timone:" + idVoce, tipo: "timone", basecode: basecode, labelBox: "BOX_STD_" + basecode, pagina: 3,
        autore: "Mario Marketing", tipoAutore: "Marketing", codice: basecode,
        basecodeDestinazione: destinazione, labelBoxDestinazione: destinazione ? "BOX_STD_" + destinazione : "",
        daSistemareAMano: aMano || null,
        boundsDestinazione: aMano ? null : [10, 20, 60, 120]
    });
    return [
        scambio(41, "8001", "8005"),
        scambio(45, "8005", "8001"),
        Object.assign(scambio(51, "9001", "9002"), { pagina: 5 }),
        Object.assign(scambio(53, "9003", "9003"), { pagina: 5 }),
        Object.assign(scambio(52, "9002", "", "pagina 5 con la griglia 3x3 scelta nel menabò avanzato: da sistemare a mano"), { pagina: 5 })
    ];
}

test("I20-1233: uno scambio diventa una voce da decidere, con il box di destinazione", () => {
    const voci = correggo.importa(scambi(), COOP, true);

    const v = voce(voci, "timone:41", TIPO.scambio);
    assert.strictEqual(v.testo, "Menabò avanzato: 8001 va al posto di 8005");
    assert.strictEqual(v.basecode, "8001");
    assert.strictEqual(v.basecodeDestinazione, "8005");
    assert.deepStrictEqual(v.boundsDestinazione, [10, 20, 60, 120]);
    assert.strictEqual(v.automatica, false);
    assert.strictEqual(v.scelta, SCELTA.nessuna);
    assert.strictEqual(v.approvabile, true);
    assert.strictEqual(v.autore, "Mario Marketing");
});

test("I20-1233: uno scambio da sistemare a mano non si approva, neanche da superAdmin", () => {
    const voci = correggo.importa(scambi(), COOP, true);

    const v = voce(voci, "timone:52", TIPO.scambio);
    assert.strictEqual(v.testo, "Menabò avanzato: 9002 spostata, pagina 5 con la griglia 3x3 scelta nel menabò avanzato: da sistemare a mano");
    assert.strictEqual(v.approvabile, false);
    assert.strictEqual(correggo.scegli(v, SCELTA.approva, true), false);
    assert.strictEqual(v.scelta, SCELTA.nessuna);
    //Rifiutarlo si puo'.
    assert.strictEqual(correggo.scegli(v, SCELTA.rifiuta, true), true);
});

test("I20-1233: una referenza rimessa nella sua casella torna al suo posto", () => {
    const voci = correggo.importa(scambi(), COOP, true);

    const v = voce(voci, "timone:53", TIPO.scambio);
    assert.strictEqual(v.testo, "Menabò avanzato: 9003 torna al suo posto");
    assert.strictEqual(v.approvabile, true);
});

test("I20-1233: uno scambio senza il rettangolo di destinazione non si approva", () => {
    const senza = scambi().slice(0, 1).map(c => Object.assign(c, { boundsDestinazione: null }));
    const v = voce(correggo.importa(senza, COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(v.approvabile, false);
});

test("I20-1233: il piano mette gli scambi approvati a parte, per pagina, fuori dai box", () => {
    const voci = correggo.importa(scambi().concat(correzioni()), COOP, true);
    voci.filter(v => v.tipo === TIPO.scambio).forEach(v => correggo.scegli(v, SCELTA.approva, true));

    const piano = correggo.pianoDellaConferma(voci);

    assert.deepStrictEqual(piano.scambi.map(p => [p.pagina, p.voci.map(v => v.idCorrezione)]),
        [[3, ["timone:41", "timone:45"]], [5, ["timone:51", "timone:53"]]]);
    assert.ok(!piano.box.some(b => b.voci.some(v => v.tipo === TIPO.scambio)));
    assert.ok(!piano.senzaLavoro.some(v => v.tipo === TIPO.scambio));
});

test("I20-1233: si mandano a Correggo4 gli scambi applicati, non quelli falliti", () => {
    const voci = correggo.importa(scambi(), COOP, true);
    voci.forEach(v => correggo.scegli(v, SCELTA.approva, true));
    const esiti = {
        [voce(voci, "timone:41", TIPO.scambio).chiave]: true,
        [voce(voci, "timone:45", TIPO.scambio).chiave]: true,
        [voce(voci, "timone:51", TIPO.scambio).chiave]: false
    };

    assert.deepStrictEqual(correggo.correzioniDaChiudere(voci, esiti).sort(), ["timone:41", "timone:45"]);
});

test("I20-1233: lo scambio si rifa' con rifaiBox nel rettangolo di destinazione", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /async rifaiBox\(schedaRef, boxPrecedente, boundsDestinazione = null\) \{/);
    assert.match(scheda, /var bounds = boundsDestinazione != null \? boundsDestinazione : boxPrecedente\.geometricBounds;/);
    //Il box di prima va da parte dopo aver letto la posizione, come prima.
    const inizio = scheda.indexOf("async rifaiBox(schedaRef, boxPrecedente, boundsDestinazione = null) {");
    assert.ok(scheda.indexOf("var bounds = ", inizio) < scheda.indexOf("VersionePrecedente.mettiDaParte(boxPrecedente", inizio));
});

test("I20-1233: una referenza allargata dice su quante caselle", () => {
    const larga = Object.assign(scambi()[0], { basecodeDestinazione: "8001", colonne: 2, righe: 1 });
    const v = voce(correggo.importa([larga], COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(v.testo, "Menabò avanzato: 8001 allargata su 2×1 caselle");
    assert.strictEqual(v.colonne, 2);
    assert.strictEqual(v.approvabile, true);
});

test("I20-1233: uno scambio gia' al suo posto arriva approvato e non si cambia", () => {
    const v = voce(correggo.importa(scambi(), COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(correggo.segnaGiaAlSuoPosto(v), true);
    assert.strictEqual(v.scelta, SCELTA.approva);
    assert.strictEqual(v.testo, "Menabò avanzato: 8001 è già al suo posto");
    assert.strictEqual(correggo.scegli(v, SCELTA.rifiuta, true), false);
    assert.strictEqual(v.scelta, SCELTA.approva);
});

test("I20-1233: su una pagina ridisegnata lo scambio va nella casella, non al posto di un box", () => {
    const nella = Object.assign(scambi()[0], { basecodeDestinazione: "", labelBoxDestinazione: "", casella: 5 });
    const larga = Object.assign(scambi()[1], { basecodeDestinazione: "", labelBoxDestinazione: "", casella: 1, colonne: 3 });
    const voci = correggo.importa([nella, larga], COOP, true);

    assert.strictEqual(voce(voci, "timone:41", TIPO.scambio).testo, "Menabò avanzato: 8001 va nella casella 5");
    assert.strictEqual(voce(voci, "timone:45", TIPO.scambio).testo, "Menabò avanzato: 8005 allargata su 3×1 caselle dalla casella 1");
    assert.ok(voci.every(v => v.approvabile === true));
});

test("I20-1233: un raggruppamento del menabò avanzato dice quali box unisce e dove", () => {
    const gruppo = Object.assign(scambi()[0], {
        basecodeDestinazione: "8001", casella: 1,
        unisci: [{ basecode: "8002", labelBox: "BOX_STD_8002", pagina: 3 }], codici: ["8001", "8002"]
    });
    const v = voce(correggo.importa([gruppo], COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(v.testo, "Menabò avanzato: unisce 8001 e 8002 in un box, nella casella 1");
    assert.deepStrictEqual(v.unisci, [{ basecode: "8002", labelBox: "BOX_STD_8002", pagina: 3, codici: [] }]);
    assert.deepStrictEqual(v.codici, ["8001", "8002"]);
    assert.strictEqual(v.approvabile, true);
});

test("I20-1233: un raggruppamento che prende solo una parte di una linea non si approva", () => {
    const motivo = "il gruppo della casella 1 di pagina 3 prende solo una parte del box 8003 (8003 resta fuori): da sistemare a mano";
    const gruppo = Object.assign(scambi()[0], {
        basecodeDestinazione: "8001", casella: 1, daSistemareAMano: motivo, boundsDestinazione: null,
        unisci: [{ basecode: "8003", labelBox: "BOX_LINEA_8003", pagina: 3 }], codici: ["8001", "8013"]
    });
    const v = voce(correggo.importa([gruppo], COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(v.testo, "Menabò avanzato: gruppo di 8001 e 8003: " + motivo);
    assert.strictEqual(v.approvabile, false);
});

test("I20-1233: il Raggruppa della selezione multipla e quello del Report Correggo sono la stessa funzione", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /raggruppaBox\(listaCodiciConId, pagina, bounds, boxDaTogliere\) \{/);
    assert.match(scheda, /me\.raggruppaBox\(listaCodiciConId, pagCoinvolta, box\.geometricBounds, multiSelection\.map\(m => m\.item\)\)/);
    const inizio = scheda.indexOf("raggruppaBox(listaCodiciConId, pagina, bounds, boxDaTogliere) {");
    assert.ok(scheda.indexOf("Menabo/Raggruppa/", inizio) > inizio);
    //Il box nuovo si impagina prima di togliere quelli raggruppati.
    assert.ok(scheda.indexOf("await impaginaBox(meccanica, pagina, bounds, itemRef", inizio) < scheda.indexOf("daTogliere.remove()", inizio));
});

test("I20-1233: lo scambio porta le referenze che servono allo sgruppa", () => {
    const staccata = Object.assign(scambi()[0], { codici: ["8002"], codiciDelBox: ["8002"], codiciTimone: ["8001", "8002", "8003"] });
    const v = voce(correggo.importa([staccata], COOP, true), "timone:41", TIPO.scambio);

    assert.deepStrictEqual(v.codici, ["8002"]);
    assert.deepStrictEqual(v.codiciDelBox, ["8002"]);
    assert.deepStrictEqual(v.codiciTimone, ["8001", "8002", "8003"]);
});

test("I20-1233: lo sgruppa del menabò resta a mano: lo Sgruppa della scheda ref non cambia", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.ok(!scheda.includes("sgruppaBox("));
    const staccata = Object.assign(scambi()[0], { codici: ["8002"], codiciDelBox: ["8002"], codiciTimone: ["8001", "8002"] });
    const v = voce(correggo.importa([staccata], COOP, true), "timone:41", TIPO.scambio);

    assert.strictEqual(correggo.segnaDaSistemareAMano(v, "staccata nel menabò dal gruppo 8001,8002: lo sgruppa va fatto a mano"), true);
    assert.strictEqual(v.approvabile, false);
    assert.strictEqual(v.scelta, SCELTA.nessuna);
    assert.strictEqual(v.testo, "Menabò avanzato: 8001, staccata nel menabò dal gruppo 8001,8002: lo sgruppa va fatto a mano");
    assert.strictEqual(correggo.scegli(v, SCELTA.approva, true), false);
});

test("I20-1233: il Report Correggo si divide nelle sezioni di Correggo4, nel loro ordine", () => {
    const voci = [
        { idCorrezione: "timone:41", pagina: 3 },
        { idCorrezione: "edit:7:prezzi", pagina: 2 },
        { idCorrezione: "nota:5", pagina: 4 },
        { idCorrezione: "timone:45", pagina: 3 },
        { idCorrezione: "nota:6", pagina: 1 }
    ];

    const sezioni = correggo.perSezione(voci);

    assert.deepStrictEqual(sezioni.map(s => s.titolo), ["Note", "Edit avanzato", "Menabò avanzato"]);
    assert.deepStrictEqual(sezioni[0].voci.map(v => v.idCorrezione), ["nota:5", "nota:6"]);
    assert.deepStrictEqual(sezioni[2].voci.map(v => v.idCorrezione), ["timone:41", "timone:45"]);
    //Timbri non c'e': nessuna voce.
    assert.ok(!sezioni.some(s => s.titolo === "Timbri"));
});

test("I20-1233: la testata del box nel Report Correggo non si stringe sotto la riga", () => {
    const pannelli = leggiFileDelPlugin("reportIntegrita/pannelli.js").replace(/\r/g, "");
    const inizio = pannelli.indexOf("    _crTestataBoxCorreggo(voce) {");
    const fine = pannelli.indexOf("    _crRigaCorreggo(voce) {", inizio);
    assert.ok(pannelli.slice(inizio, fine).includes('testata.style.flexShrink = "0";'));
    assert.ok(pannelli.includes("sezioneCorreggo.perSezione(voci).forEach("));
});

test("I20-1233: nella riga del Report Correggo un codice gruppo lungo va a capo dopo le virgole", () => {
    const pannelli = leggiFileDelPlugin("reportIntegrita/pannelli.js").replace(/\r/g, "");
    const inizio = pannelli.indexOf("    _crRigaCorreggo(voce) {");
    const corpo = pannelli.slice(inizio, pannelli.indexOf("const info = document.createElement", inizio));
    assert.ok(corpo.includes('testo.style.overflowWrap = "anywhere";'));
    assert.ok(corpo.includes('.replace(/(\\d{5}),(?=\\d{5})/g, "$1, ")'));
    //La stessa sostituzione della riga: solo fra due codici, non nei prezzi.
    const sostituisci = (t) => t.replace(/(\d{5}),(?=\d{5})/g, "$1, ");
    assert.strictEqual(sostituisci("Menabò avanzato: 8167717 va al posto di 4016102,6638200,7200444"),
        "Menabò avanzato: 8167717 va al posto di 4016102, 6638200, 7200444");
    assert.strictEqual(sostituisci("Nota: prezzo 3,62, grazie"), "Nota: prezzo 3,62, grazie");
});

test("I20-1233: le rifiutate stanno nella sezione Rifiutati, in fondo", () => {
    const voci = [
        { idCorrezione: "nota:5", scelta: SCELTA.rifiuta },
        { idCorrezione: "timone:41", scelta: SCELTA.nessuna },
        { idCorrezione: "timone:45", scelta: SCELTA.rifiuta }
    ];

    const sezioni = correggo.perSezione(voci);

    assert.deepStrictEqual(sezioni.map(s => s.titolo), ["Menabò avanzato", "Rifiutati"]);
    assert.deepStrictEqual(sezioni[1].voci.map(v => v.idCorrezione), ["nota:5", "timone:45"]);
});

test("I20-1233: un rifiuto si ricorda finché la correzione non cambia", () => {
    const prima = correggo.importa(scambi(), COOP, true);
    const v = voce(prima, "timone:41", TIPO.scambio);
    correggo.applicaRifiuti(prima, []);
    correggo.scegli(v, SCELTA.rifiuta, true);
    let rifiutate = correggo.aggiornaRifiuti([], v);
    assert.strictEqual(rifiutate.length, 1);

    //Importazione successiva, stessa correzione: torna rifiutata.
    const dopo = correggo.applicaRifiuti(correggo.importa(scambi(), COOP, true), rifiutate);
    assert.strictEqual(voce(dopo, "timone:41", TIPO.scambio).scelta, SCELTA.rifiuta);
    assert.notStrictEqual(voce(dopo, "timone:45", TIPO.scambio).scelta, SCELTA.rifiuta);

    //Il Marketing la cambia: torna da decidere.
    const cambiate = scambi();
    cambiate[0].basecodeDestinazione = "8003";
    const nuove = correggo.applicaRifiuti(correggo.importa(cambiate, COOP, true), rifiutate);
    assert.notStrictEqual(voce(nuove, "timone:41", TIPO.scambio).scelta, SCELTA.rifiuta);

    //Tolto il rifiuto, la firma esce dall'elenco.
    const w = voce(dopo, "timone:41", TIPO.scambio);
    correggo.scegli(w, SCELTA.nessuna, true);
    rifiutate = correggo.aggiornaRifiuti(rifiutate, w);
    assert.deepStrictEqual(rifiutate, []);
});
