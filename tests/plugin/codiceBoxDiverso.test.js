/*
 * I20-1081: il box impaginato di un tipo diverso da quello del dato.
 *
 * Il box nel documento ha per label il codice del box modello da cui e' nato; il dato chiede il
 * suo codiceBox (o, se vuoto, la combinazione assegnata). Nessuno li confrontava: un box del tipo
 * sbagliato restava li', e Fix e la reimpaginazione singola si fermavano perche' la preanalisi non
 * trovava differenze. Ora la preanalisi lo segnala, per primo, per tutti i clienti. Non si sceglie
 * niente: si risolve reimpaginando con il dato. Ed e' grave, quindi molto visibile: riquadro rosso
 * in cima alla finestra, avviso all'apertura della scheda anche con le segnalazioni silenziate,
 * riga rossa nel Report Integrita'.
 *
 * confronti.js, schedaRef.js e avvio.js si caricano sotto Node; il resto si prova sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");
const schedaRef = require("../../plugin/schedaRef.js");
const avvio = require("../../plugin/reportIntegrita/avvio.js");

const BOX7_CONTRO_BOX14 = { label: "Tipo di box", difference: "diverso fra box e dato", tipo: "codiceBox", valoreLocale: "BOX7", valoreServer: "BOX14" };

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    const ripristina = () => Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    let esito;
    try {
        esito = prova();
    }
    catch (e) {
        ripristina();
        throw e;
    }
    if (esito != null && typeof esito.then === "function") {
        return esito.finally(ripristina);
    }
    ripristina();
    return esito;
}

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- le regole ---- */

test("il codice che il dato chiede: codiceBox, o la combinazione assegnata se e' vuoto", () => {
    assert.strictEqual(confronti.codiceBoxAtteso({ codiceBox: "BOX14", combinazioneAssegnata: "BOX7" }), "BOX14");
    assert.strictEqual(confronti.codiceBoxAtteso({ codiceBox: "", combinazioneAssegnata: "BOX7" }), "BOX7");
    assert.strictEqual(confronti.codiceBoxAtteso({ codiceBox: "  ", combinazioneAssegnata: " BOX7 " }), "BOX7");
    assert.strictEqual(confronti.codiceBoxAtteso({ codiceBox: null }), "");
    assert.strictEqual(confronti.codiceBoxAtteso({}), "");
    assert.strictEqual(confronti.codiceBoxAtteso(null), "");
});

test("box e dato diversi danno la differenza, con i due codici", () => {
    assert.deepStrictEqual(confronti.differenzaCodiceBox("BOX7", { codiceBox: "BOX14" }), BOX7_CONTRO_BOX14);
    //Coop: il codice con la sua variante resta un codice diverso.
    assert.deepStrictEqual(confronti.differenzaCodiceBox("BOX_STD", { codiceBox: "BOX_STD_LINEA" }).valoreServer, "BOX_STD_LINEA");
});

test("codici uguali, o un codice che manca, non danno niente", () => {
    assert.strictEqual(confronti.differenzaCodiceBox("BOX7", { codiceBox: "BOX7" }), null);
    assert.strictEqual(confronti.differenzaCodiceBox(" BOX7 ", { codiceBox: "BOX7 " }), null);
    assert.strictEqual(confronti.differenzaCodiceBox("BOX7", { codiceBox: "", combinazioneAssegnata: "BOX7" }), null);
    //Senza label sul box (raggruppato a mano) o senza codice nel dato non si segnala a indovinare.
    assert.strictEqual(confronti.differenzaCodiceBox("", { codiceBox: "BOX7" }), null);
    assert.strictEqual(confronti.differenzaCodiceBox(null, { codiceBox: "BOX7" }), null);
    assert.strictEqual(confronti.differenzaCodiceBox("BOX7", {}), null);
    assert.strictEqual(confronti.differenzaCodiceBox("BOX7", null), null);
});

test("e' la sola differenza grave", () => {
    assert.strictEqual(confronti.eDifferenzaGrave(BOX7_CONTRO_BOX14), true);
    assert.strictEqual(confronti.eDifferenzaGrave({ label: "prezzo", difference: "contenuto" }), false);
    assert.strictEqual(confronti.eDifferenzaGrave({ label: "x", difference: "non presente", tipo: "mancante" }), false);
    assert.strictEqual(confronti.eDifferenzaGrave(null), false);
});

/* ---- la preanalisi ---- */

function preanalisi(labelDelBox, itemRef, compiledFields = []) {
    return conGlobali({
        pluginMiddleware: { getCampo: () => null },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false }
    }, () => confronti.confrontoBoxCompiledFieldPreAnalisi({ label: labelDelBox, allPageItems: [] },
        compiledFields, [], [], null, null, false, null, itemRef));
}

test("la preanalisi segnala il box di un altro tipo, per primo", async () => {
    const esito = await preanalisi("BOX7", { codiceBox: "BOX14" }, [{ labelName: "prezzo", paragraphName: "PREZ", content: "1,99" }]);
    assert.deepStrictEqual(esito.errors, []);
    assert.strictEqual(esito.differenze.length, 2);
    assert.deepStrictEqual(esito.differenze[0], BOX7_CONTRO_BOX14);
    assert.strictEqual(esito.differenze[1].difference, "non presente");
});

test("la preanalisi non segnala niente con lo stesso box, o senza il record", async () => {
    assert.deepStrictEqual((await preanalisi("BOX7", { codiceBox: "BOX7" })).differenze, []);
    assert.deepStrictEqual((await preanalisi("BOX7", { codiceBox: "", combinazioneAssegnata: "BOX7" })).differenze, []);
    //Il controllo della sola descrizione non passa il record.
    assert.deepStrictEqual((await preanalisi("BOX7", null)).differenze, []);
});

test("con il box di un altro tipo, Fix e la reimpaginazione singola non si fermano piu'", () => {
    //impaginazioneSingoloIndd lascia il box com'e' solo con zero differenze: ora ce n'e' una.
    const index = sorgente("indexNew.js");
    assert.match(index, /confrontoBoxCompiledFieldPreAnalisi\(originalBox,[^;]*tracciatoPrimario\);\s*\n\s*if \(preAnalisi != null && preAnalisi\.differenze\.length == 0\)/);
    //E nel Report la referenza va fra le cambiate.
    assert.strictEqual(avvio.categoriaRecordRicontrollato({ differenze: [BOX7_CONTRO_BOX14], errors: [] }, false), "recordCambiati");
});

/* ---- la scheda ---- */

test("nella scheda non ha pulsanti di scelta e si legge chiaro", () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(BOX7_CONTRO_BOX14), []);
    assert.strictEqual(schedaRef.testoDifferenza(BOX7_CONTRO_BOX14), "Diverso fra box e dato");
    assert.deepStrictEqual(schedaRef.raggruppaPerElemento([BOX7_CONTRO_BOX14]).map(g => g.label), ["Tipo di box"]);
});

function conStatoFinestra(stato, prova) {
    const campi = ["modalSegnalazioniGiaProposto", "segnalazioniSilenziateOvunque", "refConSegnalazioniSilenziate"];
    const salvato = {};
    campi.forEach(c => { salvato[c] = schedaRef[c]; });
    Object.assign(schedaRef, stato);
    try {
        return conGlobali({ confronti: confronti }, prova);
    }
    finally {
        Object.assign(schedaRef, salvato);
    }
}

test("la finestra si apre da sola per il box di un altro tipo anche con le segnalazioni silenziate", () => {
    conStatoFinestra({ modalSegnalazioniGiaProposto: false, segnalazioniSilenziateOvunque: true, refConSegnalazioniSilenziate: [] }, () => {
        assert.strictEqual(schedaRef.deveAprirsiDaSola([BOX7_CONTRO_BOX14], "123"), true);
        //Le altre differenze col silenzio restano zitte, come prima.
        assert.strictEqual(schedaRef.deveAprirsiDaSola([{ label: "prezzo", difference: "contenuto" }], "123"), false);
    });
    conStatoFinestra({ modalSegnalazioniGiaProposto: false, segnalazioniSilenziateOvunque: false, refConSegnalazioniSilenziate: ["123"] }, () => {
        assert.strictEqual(schedaRef.deveAprirsiDaSola([BOX7_CONTRO_BOX14], "123"), true);
    });
});

test("ma una volta sola per scheda, come le altre", () => {
    conStatoFinestra({ modalSegnalazioniGiaProposto: true, segnalazioniSilenziateOvunque: false, refConSegnalazioniSilenziate: [] }, () => {
        assert.strictEqual(schedaRef.deveAprirsiDaSola([BOX7_CONTRO_BOX14], "123"), false);
    });
});

test("all'apertura della scheda l'avviso rosso dice i due box e come risolvere", () => conGlobali({ confronti: confronti }, () => {
    const testo = schedaRef.testoAvvisoDifferenzeGravi([{ label: "prezzo", difference: "contenuto" }, BOX7_CONTRO_BOX14]);
    assert.match(testo, /^Code SRF-111 /);
    assert.match(testo, /BOX7/);
    assert.match(testo, /BOX14/);
    assert.match(testo, /Reimpagina/);
    assert.strictEqual(schedaRef.testoAvvisoDifferenzeGravi([{ label: "prezzo", difference: "contenuto" }]), "");
    assert.strictEqual(schedaRef.testoAvvisoDifferenzeGravi(null), "");

    const messaggi = [];
    conGlobali({ messaggioUtente: (testoMessaggio, stile) => messaggi.push([testoMessaggio, stile]) }, () => {
        schedaRef.avvisaDifferenzeGravi([BOX7_CONTRO_BOX14]);
        schedaRef.avvisaDifferenzeGravi([]);
    });
    assert.strictEqual(messaggi.length, 1);
    assert.strictEqual(messaggi[0][1], "error");
}));

test("senza il motore di confronto la scheda non vede differenze gravi e non si rompe", () => conGlobali({ confronti: undefined }, () => {
    delete global.confronti;
    assert.strictEqual(schedaRef.differenzaGrave(BOX7_CONTRO_BOX14), false);
    assert.strictEqual(schedaRef.ciSonoDifferenzeGravi([BOX7_CONTRO_BOX14]), false);
}));

test("la finestra mette il box di un altro tipo in un riquadro rosso, col segnale e il modo di risolverlo", () => {
    const scheda = sorgente("schedaRef.js");
    const elenco = scheda.substring(scheda.indexOf("    riempiElencoSegnalazioni(contenitore"), scheda.indexOf("    testoRiepilogoFinestra("));
    assert.match(elenco, /const grave = gruppo\.differenze\.some\(d => me\.differenzaGrave\(d\)\);/);
    assert.match(elenco, /riquadro\.css\(grave \? me\.STILE_RIQUADRO_GRAVE :/);
    assert.match(elenco, /\(grave \? "⚠ " : ""\)/);
    assert.match(elenco, /if \(grave\) \{\s*const comeRisolvere = \$\('<div><\/div>'\)\.text\(me\.TESTO_RISOLVI_GRAVE\);/);
    assert.strictEqual(schedaRef.STILE_RIQUADRO_GRAVE["background-color"], "#fdecea");
    assert.match(schedaRef.TESTO_RISOLVI_GRAVE, /Reimpagina/);

    //All'apertura: l'avviso, dopo la preanalisi e prima della finestra.
    const apertura = scheda.indexOf("const segnalazioniDellaScheda = me.segnalazioniInMemoria() || [];");
    const avviso = scheda.indexOf("me.avvisaDifferenzeGravi(segnalazioniDellaScheda);");
    const finestra = scheda.indexOf("if (me.deveAprirsiDaSola(segnalazioniDellaScheda, codice, me.vociBollinoInMemoria())) {");
    assert.ok(apertura > 0 && avviso > apertura && finestra > avviso);
});

/* ---- il Report Integrita' ---- */

//pannelli.js si prova sul sorgente: il membro si estrae e si esegue con un documento finto.
function evidenziaDelReport() {
    const testo = leggiFileDelPlugin("reportIntegrita/pannelli.js");
    const intestazione = "    _evidenziaDifferenzaGrave(riga, diff) {";
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, "_evidenziaDifferenzaGrave non trovata");
    let livello = 0;
    let fine = -1;
    for (let i = inizio; i < testo.length && fine < 0; i++) {
        if (testo[i] === "{") { livello++; }
        else if (testo[i] === "}") { livello--; if (livello === 0) { fine = i + 1; } }
    }
    return new Function("confronti", "document", "return ({\n" + testo.substring(inizio, fine) + "\n});");
}

function elementoFinto() {
    const el = { style: {}, figli: [], textContent: "" };
    el.appendChild = (figlio) => { el.figli.push(figlio); return figlio; };
    el.insertBefore = (figlio, prima) => { el.figli.splice(Math.max(0, el.figli.indexOf(prima)), 0, figlio); return figlio; };
    Object.defineProperty(el, "firstChild", { get: () => el.figli[0] });
    return el;
}

test("nel Report la riga del box di un altro tipo e' rossa, col segnale e il modo di risolverla", () => {
    const documento = { createElement: () => elementoFinto(), createTextNode: (t) => ({ testo: t }) };
    const report = evidenziaDelReport()(confronti, documento);

    const riga = elementoFinto();
    riga.appendChild({ testo: "Tipo di box: diverso fra box e dato" });
    assert.strictEqual(report._evidenziaDifferenzaGrave(riga, BOX7_CONTRO_BOX14), true);
    assert.strictEqual(riga.style.backgroundColor, "#fdecea");
    assert.strictEqual(riga.style.color, "#b21d1d");
    assert.strictEqual(riga.figli[0].testo, "⚠ ");
    assert.match(riga.figli[riga.figli.length - 1].textContent, /Fix/);

    //Le altre righe restano come sono.
    const altra = elementoFinto();
    assert.strictEqual(report._evidenziaDifferenzaGrave(altra, { label: "prezzo", difference: "contenuto" }), false);
    assert.deepStrictEqual(altra.style, {});
    assert.deepStrictEqual(altra.figli, []);
});

test("il Report evidenzia ogni riga delle segnalazioni di integrita'", () => {
    const pannelli = sorgente("reportIntegrita/pannelli.js");
    assert.match(pannelli, /this\._evidenziaDifferenzaGrave\(diffRow, diff\);\s*diffList\.appendChild\(diffRow\);/);
});
