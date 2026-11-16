/*
 * Le foto extra dei gruppi nel Plugin.
 *
 * Un gruppo ha una foto extra solo se tutte le sue referenze la hanno. Il box di un gruppo impagina le
 * foto extra comuni (Foto.ExtraGruppo, scritte da Istanta); quelle presenti solo su alcune referenze
 * (Foto.ExtraParziali) non escono, il box riceve l'avviso FEX-01 con "Vai a Foto extra", e in Foto extra
 * si estendono a tutte le referenze o si eliminano. Collega scrive su tutte le referenze del gruppo.
 * Una referenza impaginata da sola tiene le sue Foto.Extra.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FotoExtraGruppo = require('../../plugin/reperimentoFoto/fotoExtraGruppo');

const leggi = (nome) => fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', nome), 'utf8').replace(/\r/g, '');

const extra = (guid, attiva = true) => ({ guidId: guid, nome: guid + ".ai", sigla: guid, tipo: 3, attiva: attiva });
const record = (codice, stato, lista) => ({ recordInTracciato: { "Referenza.Codice": codice, "Scatto.CodiceGruppo": "A,B,C", StatoSelezione: stato, "Foto.Extra": lista } });

/* ---- quali foto extra ha il box ---- */

test("il box di un gruppo ha le foto extra del gruppo, una referenza sola le sue", () => {
    const delGruppo = { "Foto.Extra": [extra("LOGO"), extra("BIO")], "Foto.ExtraGruppo": [extra("LOGO")] };
    const singola = { "Foto.Extra": [extra("LOGO"), extra("BIO")] };

    assert.deepStrictEqual(FotoExtraGruppo.fotoExtraDelBox(delGruppo).map(e => e.guidId), ["LOGO"]);
    assert.deepStrictEqual(FotoExtraGruppo.fotoExtraDelBox(singola).map(e => e.guidId), ["LOGO", "BIO"]);
    assert.strictEqual(FotoExtraGruppo.fotoExtraDelBox(null), null);
    assert.deepStrictEqual(FotoExtraGruppo.parzialiDelBox(singola), []);
});

test("comuni e parziali dai record in memoria, nell'ordine della primaria", () => {
    const calcolo = FotoExtraGruppo.comuniEParziali([
        record("B", 2, [extra("BIO"), extra("LOGO")]),
        record("A", 1, [extra("LOGO"), extra("BIO")]),
        record("C", 0, [extra("LOGO", false)])
    ]);

    assert.deepStrictEqual(calcolo.comuni.map(e => [e.guidId, e.attiva]), [["LOGO", false]], "attiva solo se lo e' su tutte");
    const bio = calcolo.parziali[0];
    assert.deepStrictEqual([bio.guidId, bio.presenti, bio.totale, bio.codiciSenza], ["BIO", 2, 3, ["C"]]);
});

test("una referenza sola non ha parziali", () => {
    const calcolo = FotoExtraGruppo.comuniEParziali([record("A", 1, [extra("LOGO")])]);
    assert.deepStrictEqual(calcolo.comuni.map(e => e.guidId), ["LOGO"]);
    assert.deepStrictEqual(calcolo.parziali, []);
});

test("estendere e togliere aggiornano i record in memoria", () => {
    const records = [record("A", 1, [extra("LOGO"), extra("BIO")]), record("B", 2, [extra("LOGO")])];
    FotoExtraGruppo.estendiInMemoria(records, extra("BIO"));
    assert.deepStrictEqual(records.map(r => r.recordInTracciato["Foto.Extra"].length), [2, 2], "nessun doppione su chi la aveva");

    FotoExtraGruppo.togliInMemoria(records, "BIO");
    assert.deepStrictEqual(records.map(r => r.recordInTracciato["Foto.Extra"].map(e => e.guidId)), [["LOGO"], ["LOGO"]]);
});

test("le foto extra del gruppo in memoria si riscrivono solo sui dati di un gruppo", () => {
    const records = [record("A", 1, [extra("LOGO")]), record("B", 2, [extra("LOGO")])];
    records[0].recordInTracciato["Foto.ExtraGruppo"] = [];
    FotoExtraGruppo.scriviInMemoria(records, { comuni: [extra("LOGO")], parziali: [] });

    assert.deepStrictEqual(records[0].recordInTracciato["Foto.ExtraGruppo"].map(e => e.guidId), ["LOGO"]);
    assert.strictEqual(records[1].recordInTracciato["Foto.ExtraGruppo"], undefined);
});

/* ---- la segnalazione ---- */

test("FEX-01 dice cosa, su quante referenze, che non e' uscita e dove si risolve", () => {
    const s = FotoExtraGruppo.segnalazione(Object.assign(extra("BIO"), { presenti: 4, totale: 6 }));

    assert.strictEqual(s.msg, "Code FEX-01: Logo BIO presente solo su 4/6 referenze del gruppo: non impaginato. Si risolve in Foto extra");
    assert.strictEqual(s.typeMessage, "warning");
    assert.strictEqual(s.key, "FEX-01$BIO");
    assert.deepStrictEqual(s.verifica, { fotoExtraParziale: "BIO" });
    //Il codice si legge dal testo come gli altri: i filtri del cliente lo vedono.
    assert.match(s.msg, /\b([A-Z]{2,4}-\d+(?:\.\d+)?)\b/);
});

test("risolta la parziale, la sua voce esce dal bollino e le altre restano", () => {
    const voci = [{ c: "FEX-01", v: { fotoExtraParziale: "BIO" } }, { c: "FEX-01", v: { fotoExtraParziale: "LOGO" } }, { c: "CSF-30" }];
    assert.deepStrictEqual(FotoExtraGruppo.vociSenzaParziale(voci, "BIO").map(v => v.v ? v.v.fotoExtraParziale : v.c), ["LOGO", "CSF-30"]);
});

/* ---- dove si usa ---- */

test("l'impaginazione mette le foto extra del gruppo e segnala le parziali; il fix le rimette", () => {
    const indexNew = leggi('indexNew.js');

    assert.match(indexNew, /const fotoExtraDelBox = FotoExtraGruppo\.fotoExtraDelBox\(itemRef\);\s*FotoExtraGruppo\.parzialiDelBox\(itemRef\)\.forEach\(parziale => \{\s*const s = FotoExtraGruppo\.segnalazione\(parziale\);\s*addSegnalazione\(s\.msg, s\.typeMessage, 2, true, null, s\.key, s\.verifica\);/);
    assert.ok(indexNew.includes("fotoExtra: FotoExtraGruppo.fotoExtraDelBox(tracciatoPrimario),"));
    assert.ok(!indexNew.includes('itemRef["Foto.Extra"]'), "il box di un gruppo non deve piu' leggere le Foto.Extra della primaria");

    const fix = indexNew.slice(indexNew.indexOf("async function fixRefImpaginata("));
    assert.ok(fix.startsWith("async function fixRefImpaginata(domandaGiaFatta = false) {"));
    assert.ok(fix.includes('var confirmRes = domandaGiaFatta === true || await Modali.confirm("Ridimensionare il box alle dimensioni desiderate");'));
    assert.ok(fix.indexOf("FotoExtraGruppo.parzialiDelBox(datiRef)") > fix.indexOf("callAllOperationFixBox(boxImpaginato, bounds, datiRef)"));
});

test("Collega scrive su tutte le referenze del gruppo, dal box e dalla selezione multipla", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');
    const piuBox = leggi('reperimentoFoto/fotoExtraPiuBox.js');

    assert.ok(foto.includes('formData.append("codiceReferenza", primario.recordInTracciato["Scatto.CodiceGruppo"]);'));
    assert.ok(piuBox.includes('formData.append("codiceReferenza", primario.recordInTracciato["Scatto.CodiceGruppo"]);'));
    assert.ok(!foto.includes('formData.append("codiceReferenza", primario.recordInTracciato["Referenza.Codice"])'));
    assert.ok(!piuBox.includes('formData.append("codiceReferenza", primario.recordInTracciato["Referenza.Codice"])'));
});

test("la schermata Foto extra del gruppo mostra le comuni e le parziali con Elimina ed Estendi", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');

    assert.ok(foto.includes("var extraDelGruppo = FotoExtraGruppo.eDiGruppo(datoDelBox) ? FotoExtraGruppo.comuniEParziali(schedaRef) : null;"));
    assert.ok(foto.includes('var extra = extraDelGruppo != null ? extraDelGruppo.comuni : primario.recordInTracciato["Foto.Extra"];'));
    assert.ok(foto.includes("$(\"#FotoExtra\").append(me.pannelloExtraParziali(extraDelGruppo.parziali, box));"));

    const pannello = foto.slice(foto.indexOf("    pannelloExtraParziali(parziali, box) {"), foto.indexOf("    async estendiFotoExtra(parziale, box) {"));
    assert.ok(pannello.includes('.text(parziale.presenti + "/" + parziale.totale)'));
    assert.ok(pannello.includes("me.eliminaFotoExtraParziale(parziale, box);") && pannello.includes("me.estendiFotoExtra(parziale, box);"));
});

test("Estendi: il server, il box, la domanda del fix e via l'avviso", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');
    const estendi = foto.slice(foto.indexOf("    async estendiFotoExtra(parziale, box) {"), foto.indexOf("    async eliminaFotoExtraParziale(parziale, box) {"));

    const passi = [
        'await me.richiestaFotoExtra("SyncFoto/EstendiFotoExtra/0", formData, "PUT", false, true);',
        "FotoExtraGruppo.estendiInMemoria(me.schedeRefDati, parziale);",
        "box = FotoExtraGruppo.togliSegnalazioneParziale(box, parziale.guidId);",
        "me.impaginaFotoExtra(parziale.nome, parseInt(parziale.tipo), box, pathLavorazione, primario.recordInTracciato, sigla);",
        'Eseguire il fix della referenza?',
        "await fixRefImpaginata(true);"
    ];
    let da = 0;
    for (const passo of passi) {
        const dove = estendi.indexOf(passo, da);
        assert.ok(dove >= da, "manca o e' fuori ordine: " + passo);
        da = dove;
    }
    assert.ok(estendi.includes('formData.append("codice", primario.recordInTracciato["Scatto.CodiceGruppo"]);'));

    const elimina = foto.slice(foto.indexOf("    async eliminaFotoExtraParziale(parziale, box) {"), foto.indexOf("    impaginaFotoExtra("));
    assert.ok(elimina.includes('await me.richiestaFotoExtra("SyncFoto/RimuoviFoto/0", formData, "PUT", false, true);'));
    assert.ok(elimina.includes("FotoExtraGruppo.togliSegnalazioneParziale(box, parziale.guidId)"));
});

test("la selezione multipla e le differenze usano le foto extra del gruppo", () => {
    const piuBox = leggi('reperimentoFoto/fotoExtraPiuBox.js');
    const scheda = leggi('schedaRef.js');

    assert.ok(piuBox.includes('const elementi = campo === "Foto.Extra" && FotoExtraGruppo.eDiGruppo(datoDelBox)'));
    assert.ok(scheda.includes("FotoExtraGruppo.fotoExtraDelBox(primario.sottogruppo || rec),"));
    assert.ok(scheda.includes("var fotoExtra = FotoExtraGruppo.fotoExtraDelBox(primario.sottogruppo || primario.recordInTracciato) || [];"));
    //Le decisioni della lavorazione valgono anche sulle foto extra del gruppo, come in Istanta.
    assert.ok(scheda.includes('manuali = (manuali || []).concat(rec["Foto.ExtraGruppo"]);'));
});

test("l'avviso FEX-01 ha Vai a Foto extra, nella scheda e dalla schermata", () => {
    const schermata = leggi('segnalazioni/schermata.js');
    const scheda = leggi('schedaRef.js');

    assert.match(schermata, /if \(voce\.v != null && voce\.v\.fotoExtraParziale\) \{\s*riga\.append\(\$\('<button type="button"><\/button>'\)\.text\("Vai a Foto extra"\)/);
    assert.ok(schermata.includes("contesto.inScheda = true;"));
    assert.ok(schermata.includes("schedaRef.apriSuFotoExtra = true;"));
    assert.ok(scheda.includes("if (me.apriSuFotoExtra === true) {"));
    assert.match(scheda, /async vaiAFotoExtra\(\) \{[\s\S]*?jsIndexControls\.openTab\(null, "Tab7"\);[\s\S]*?await this\.selectSchedaRef\(3\);/);
});

/* ---- i collegamenti a un logo non piu' nell'archivio Loghi/Bolli ---- */

test("i collegamenti non piu' a sistema del box, uno per GUID con le referenze che lo hanno", () => {
    const conNonASistema = (codice, lista) => ({ recordInTracciato: { "Referenza.Codice": codice, "Foto.ExtraNonASistema": lista } });
    const records = [
        conNonASistema("A", [Object.assign(extra("VECCHIO"), { puntatore: true })]),
        conNonASistema("B", [Object.assign(extra("VECCHIO"), { puntatore: true }), Object.assign(extra("ALTRO"), { puntatore: true })]),
        { recordInTracciato: { "Referenza.Codice": "C" } }
    ];

    const voci = FotoExtraGruppo.nonASistemaDelBox(records);
    assert.deepStrictEqual(voci.map(v => [v.guidId, v.codici]), [["VECCHIO", ["A", "B"]], ["ALTRO", ["B"]]]);
    assert.deepStrictEqual(FotoExtraGruppo.nonASistemaDelBox(null), []);

    FotoExtraGruppo.togliNonASistemaInMemoria(records, "VECCHIO");
    assert.deepStrictEqual(FotoExtraGruppo.nonASistemaDelBox(records).map(v => v.guidId), ["ALTRO"]);
});

test("la schermata Foto extra mostra i non piu' a sistema senza immagine, con Elimina su tutte le referenze", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');

    assert.ok(foto.includes("var nonASistema = FotoExtraGruppo.nonASistemaDelBox(schedaRef);"));
    assert.ok(foto.includes('$("#FotoExtra").append(me.pannelloNonASistema(nonASistema, box));'));
    const pannello = foto.slice(foto.indexOf("    pannelloNonASistema(nonASistema, box) {"), foto.indexOf("    async eliminaNonASistema(voce, box) {"));
    assert.ok(pannello.includes("Non più a sistema") && !pannello.includes("<img"));
    const elimina = foto.slice(foto.indexOf("    async eliminaNonASistema(voce, box) {"), foto.indexOf("    async eliminaFotoExtraParziale("));
    assert.ok(elimina.includes('formData.append("codice", primario.recordInTracciato["Scatto.CodiceGruppo"]);'));
    assert.ok(elimina.includes('await me.richiestaFotoExtra("SyncFoto/RimuoviFoto/0", formData, "PUT", false, true);'));
    assert.ok(elimina.indexOf("FotoExtraGruppo.togliNonASistemaInMemoria(me.schedeRefDati, voce.guidId);") > elimina.indexOf("RimuoviFoto"));
});

/* ---- Escludi/Includi di un'extra automatica che il server non salva ---- */

test("Escludi non salvato: il box resta come voluto, la schermata lo segue e l'operatore lo sa", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');
    const escludi = foto.slice(foto.indexOf("    escludiIncludiFotoExtraAuto(nomeFoto, attualmenteEscluso, box, row, tipo, sigla) {"), foto.indexOf("    resetFotoPS() {"));

    //Ogni via d'errore passa da nonSalvata, che allinea la schermata al box e avvisa.
    assert.ok(escludi.includes('nonSalvata("Code SRF-55 " + objResult.error);'));
    assert.ok(escludi.includes('nonSalvata("Code SRF-59 errore di rete");'));
    assert.ok(escludi.includes('nonSalvata("Code SRF-57 " + e);'));
    assert.match(escludi, /var nonSalvata = function \(motivo\) \{\s*allineaAlBox\(\);/);
    assert.match(escludi, /var allineaAlBox = function \(\) \{[\s\S]*?fotoExtra\.escluso = !attualmenteEscluso;[\s\S]*?me\.FotoExtraPanel\(box\);/);

    assert.ok(foto.includes('return (escludi ? "Esclusa" : "Inclusa") + " solo nel box: su Istanta non è salvata, alla prossima impaginazione torna com\'era (" + motivo + ")";'));
});

test("Escludi nella selezione multipla: i record seguono il box anche se il server non salva", () => {
    const piuBox = leggi('reperimentoFoto/fotoExtraPiuBox.js');
    const escludi = piuBox.slice(piuBox.indexOf("    async escludiExtraAutoDelBox(b, elemento, escludi) {"), piuBox.indexOf("    async decisioneSoloQuiDelBox("));

    assert.ok(escludi.indexOf("auto.escluso = escludi;") < escludi.indexOf("escludiIncludiFotoExtraAuto/"));
    assert.ok(escludi.includes("throw new Error(this.testoSceltaNonSalvata(escludi, e.message));"));
});

test("Aggiungi solo qui nella selezione multipla carica il file prima di scriverlo e di registrare", () => {
    const piuBox = leggi('reperimentoFoto/fotoExtraPiuBox.js');

    const carica = piuBox.indexOf("guidId = await me.caricaFileSoloPerLavorazione(fd);");
    assert.ok(carica > 0 && carica < piuBox.indexOf("await ReperimentoFoto.scriviFileInCartella(fd.file, percorsoLoghi, fd.nomeFile);"));
    assert.ok(piuBox.includes("await me.decisioneSoloQuiDelBox(b, fd.nomeFile, tipo, ambito, guidId);"));
});
