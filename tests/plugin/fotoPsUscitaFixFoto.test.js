/*
 * I20-1205: altri miglioramenti della scheda Foto P/S.
 *
 * 1. Uscita senza Applica. Le spunte P e S stanno solo nelle caselle: cambiando schermata si
 *    perdevano senza avviso, e l'operatore poteva credere di averle salvate. Ora, con caselle diverse
 *    da quelle salvate, il Plugin chiede "Modifiche non applicate, sei sicuro/a di voler uscire dalla
 *    schermata?" sia quando si cambia voce dal menu' del pannello (jsIndexControls.clicVoce) sia
 *    quando la selezione di InDesign lascia il box (il ciclo degli eventi chiede alla guardia, la
 *    scheda trattiene il box). Le spunte non applicate sopravvivono anche al ridisegno della scheda
 *    dopo Cambia foto.
 * 2. Fix Foto oltre la configurazione. Il fix ha una disposizione solo per i numeri di foto della
 *    configurazione del cliente (1, 2 e 3 per Coop, Edro21 e Famila): con una foto in piu' usciva
 *    senza fare niente lasciando CSF-12 nella riga dei messaggi. Ora, invece della domanda, una
 *    finestra dice di sistemare le foto a mano.
 *
 * Le regole pure si chiamano sotto Node (selezioneFoto, schedaRef, jsIndexControls, InddEvents con
 * indesign finto); i collegamenti nel markup e nel ciclo si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const selezioneFoto = require("../../plugin/sistemazioneFoto/selezioneFoto");
const schedaRef = require("../../plugin/schedaRef");
const jsIndexControls = require("../../plugin/jsIndexControls");

//events.js si carica con indesign finto: la sua app e' quella del test.
const appFinta = { selection: [] };
const MODULI_VUOTI = new Set(["./XMLHttpRequestClient", "./utility", "./schedaRef", "./logger", "./versionePrecedente"]);
const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return { app: appFinta };
    }
    if (MODULI_VUOTI.has(richiesta)) {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let InddEvents;
try {
    InddEvents = require("../../plugin/events.js");
}
finally {
    Module._load = caricaOriginale;
}

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

const P = 1, S = 2, NESSUNA = 3;
const CONFIGURAZIONE_FINO_A_TRE = [{ foto: 1 }, { foto: 2 }, { foto: 3 }];
const DOMANDA = "Modifiche non applicate, sei sicuro/a di voler uscire dalla schermata?";

/* ---- 2. le foto del fix e l'avviso "a mano" ---- */

test("il fix prende le foto primarie in testa e salta quelle invisibili e gli altri elementi", () => {
    const primaria = { label: "immagine$1" };
    const secondaria = { label: "foto_secondaria$2" };
    const nascosta = { label: "foto_secondaria$3", visible: false };
    const prezzo = { label: "prezzo" };
    const conf = { etichetta: (label) => label.split("$")[0] };

    assert.deepStrictEqual(selezioneFoto.fotoDelFix([secondaria, nascosta, prezzo, primaria], conf), [primaria, secondaria]);
    assert.deepStrictEqual(selezioneFoto.fotoDelFix(null, conf), []);
});

test("il fix riconosce le foto con i nomi del plugin di agenzia", () => {
    const primaria = { label: "fotoP" };
    const secondaria = { label: "fotoS1" };
    const conf = { nomeFotoPrimaria: "fotoP", nomeFotoSecondaria: "fotoS" };

    assert.deepStrictEqual(selezioneFoto.fotoDelFix([secondaria, primaria, { label: "immagine" }], conf), [primaria, secondaria]);
});

test("con quattro foto e la configurazione fino a tre, le foto vanno sistemate a mano", () => {
    assert.strictEqual(selezioneFoto.avvisoFotoAMano(4, CONFIGURAZIONE_FINO_A_TRE),
        "Il box ha 4 foto: il Fix Foto automatico ne sistema fino a 3. Sistema le foto a mano.");
});

test("con un numero di foto previsto il fix si propone come prima", () => {
    assert.strictEqual(selezioneFoto.avvisoFotoAMano(3, CONFIGURAZIONE_FINO_A_TRE), null);
    assert.strictEqual(selezioneFoto.avvisoFotoAMano(1, CONFIGURAZIONE_FINO_A_TRE), null);
});

test("senza foto non c'e' niente da dire", () => {
    assert.strictEqual(selezioneFoto.avvisoFotoAMano(0, CONFIGURAZIONE_FINO_A_TRE), null);
});

test("il massimo viene dalla configurazione del cliente, non e' un tre scritto nel codice", () => {
    const finoAQuattro = CONFIGURAZIONE_FINO_A_TRE.concat([{ foto: 4 }]);
    assert.strictEqual(selezioneFoto.fotoMassimeDelFix(finoAQuattro), 4);
    assert.strictEqual(selezioneFoto.avvisoFotoAMano(4, finoAQuattro), null);
    assert.match(selezioneFoto.avvisoFotoAMano(5, finoAQuattro), /ne sistema fino a 4\./);
    assert.strictEqual(selezioneFoto.fotoMassimeDelFix(null), 0);
});

/// La scheda con i globali finti di proponiFixFoto: cosa ha chiesto e cosa ha fatto.
function provaProponiFixFoto(avviso, risposta) {
    const fatto = { popup: [], domande: [], fix: 0 };
    global.SistemazioneFoto = {
        avvisoFotoAMano: () => avviso,
        getSpazioImpaginazione: () => ({ candidate: [], obstacles: [] }),
        fixFoto: () => { fatto.fix++; },
    };
    global.Modali = {
        popup: (titolo, testo) => { fatto.popup.push([titolo, testo]); },
        confirm: async (domanda) => { fatto.domande.push(domanda); return risposta; },
    };
    global.messaggioUtente = () => { };
    return fatto;
}

test("oltre la configurazione niente domanda sul Fix Foto: la finestra dice di sistemarle a mano", async () => {
    const testo = "Il box ha 4 foto: il Fix Foto automatico ne sistema fino a 3. Sistema le foto a mano.";
    const fatto = provaProponiFixFoto(testo, true);

    assert.strictEqual(await schedaRef.proponiFixFoto({}, "Modifiche salvate. Applicare il Fix Foto automatico?"), false);
    assert.deepStrictEqual(fatto.popup, [["Foto da sistemare a mano", testo]]);
    assert.deepStrictEqual(fatto.domande, []);
    assert.strictEqual(fatto.fix, 0);
});

test("con un numero di foto previsto si chiede, e il fix parte solo con il si'", async () => {
    let fatto = provaProponiFixFoto(null, true);
    assert.strictEqual(await schedaRef.proponiFixFoto({}, "Modifiche salvate. Applicare il Fix Foto automatico?"), true);
    assert.deepStrictEqual(fatto.domande, ["Modifiche salvate. Applicare il Fix Foto automatico?"]);
    assert.strictEqual(fatto.fix, 1);

    fatto = provaProponiFixFoto(null, false);
    assert.strictEqual(await schedaRef.proponiFixFoto({}, "Modifiche salvate. Applicare il Fix Foto automatico?"), false);
    assert.strictEqual(fatto.fix, 0);
    assert.deepStrictEqual(fatto.popup, []);
});

test("dopo Applica e dopo il salvataggio del noRender il fix si propone passando dal controllo", () => {
    const schermata = sorgente("reperimentoFoto/schedaFoto.js");
    assert.match(schermata, /await me\.proponiFixFoto\(box, "Modifiche salvate\. Applicare il Fix Foto automatico\?"\);/);
    assert.match(schermata, /await this\.proponiFixFoto\(box, "Le foto mostrate nel box sono cambiate\. Applicare il Fix Foto automatico\?"\);/);
    //Nessuna domanda sul fix fuori da proponiFixFoto.
    assert.strictEqual((schermata.match(/Modali\.confirm\(domanda\)/g) || []).length, 1);
    assert.doesNotMatch(schermata, /Modali\.confirm\("[^"]*Fix Foto automatico/);
});

test("le foto si contano come le dispone il fix", () => {
    const motore = sorgente("sistemazioneFoto/sistemazioneFoto.js");
    assert.match(motore, /return selezioneFoto\.avvisoFotoAMano\(this\.fotoDelFix\(box\)\.length, this\.configurazioneDistanziamento\(\)\);/);
    assert.match(motore, /var listFoto = this\.fotoDelFix\(box\);/);
});

/* ---- 1. le spunte non applicate ---- */

test("caselle diverse da quelle salvate sono modifiche non applicate", () => {
    const salvati = { "7167423": P, "7167387": S };
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate(salvati, { "7167423": S, "7167387": P }), 2);
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate(salvati, { "7167423": P, "7167387": NESSUNA }), 1);
});

test("caselle rimesse com'erano non sono modifiche", () => {
    const salvati = { "7167423": P, "7167387": S };
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate(salvati, { "7167423": P, "7167387": S }), 0);
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate(null, {}), 0);
});

test("un codice che il salvato non conosce conta come nessuna spunta", () => {
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate({}, { "7167391": NESSUNA }), 0);
    assert.strictEqual(schedaRef.modificheFotoPsNonApplicate({}, { "7167391": S }), 1);
});

test("lo stato salvato di un record e' P, S o nessuna", () => {
    assert.strictEqual(schedaRef.statoFotoPsDelRecord({ StatoSelezione: 1 }), P);
    assert.strictEqual(schedaRef.statoFotoPsDelRecord({ StatoSelezione: "2" }), S);
    assert.strictEqual(schedaRef.statoFotoPsDelRecord({ StatoSelezione: 3 }), NESSUNA);
    assert.strictEqual(schedaRef.statoFotoPsDelRecord({ StatoSelezione: 0 }), NESSUNA);
    assert.strictEqual(schedaRef.statoFotoPsDelRecord(null), NESSUNA);
});

test("la domanda e' quella chiesta dalla issue", () => {
    assert.strictEqual(schedaRef.TESTO_MODIFICHE_FOTO_PS, DOMANDA);
});

test("le spunte non applicate si leggono prima di svuotare la scheda e si rimettono dopo", () => {
    const schermata = sorgente("reperimentoFoto/schedaFoto.js");
    const corpo = schermata.substring(schermata.indexOf("async EditFotoPrimarieSecondarie(box) {"));
    const lettura = corpo.indexOf("var spunteInSospeso = me.fotoPsInSospeso(codice_gruppo);");
    const svuota = corpo.indexOf("me.resetFotoPS();");
    const rimette = corpo.indexOf("me.impostaCaselleFotoPs(spunteInSospeso);");
    const collega = corpo.indexOf(".on('change', function () {");
    assert.ok(lettura > 0 && lettura < svuota, "vanno lette prima di svuotare la scheda");
    assert.ok(rimette > svuota && rimette < collega, "vanno rimesse prima di collegare le caselle");
    //Dopo Applica le spunte registrate diventano quelle salvate.
    assert.match(corpo, /messaggioUtente\("Edit P\/S: Richiesta completata con successo", "success", false, 5\);[\s\S]{0,400}me\.fotoPsMostrate = \{ codiceGruppo: codice_gruppo, salvati: me\.statiFotoPsDelleCaselle\(\) \};/);
});

/* ---- il menu' del pannello ---- */

/// jsIndexControls con i globali finti: una scheda aperta, la risposta alla domanda.
function provaMenu(schedaAperta, risposta) {
    const fatto = { domande: [] };
    global.document = { getElementById: (id) => (id === schedaAperta ? { style: { display: "block" } } : { style: { display: "none" } }) };
    global.Modali = { confirm: async (domanda) => { fatto.domande.push(domanda); return risposta; } };
    return fatto;
}

test("senza guardia la voce del menu' parte subito, senza domande", async () => {
    const fatto = provaMenu("Tab6", false);
    jsIndexControls.impostaGuardiaUscita(null);
    let eseguita = false;
    jsIndexControls.clicVoce("Tab7", () => { eseguita = true; });
    assert.strictEqual(eseguita, true, "deve partire subito, come prima");
    assert.deepStrictEqual(fatto.domande, []);
});

test("con modifiche non applicate, rispondendo no la voce non parte e le spunte restano", async () => {
    const fatto = provaMenu("Tab6", false);
    let scartate = 0;
    jsIndexControls.impostaGuardiaUscita(() => DOMANDA, () => { scartate++; });
    let eseguita = false;
    assert.strictEqual(await jsIndexControls.clicVoce("Tab7", () => { eseguita = true; }), false);
    assert.deepStrictEqual(fatto.domande, [DOMANDA]);
    assert.strictEqual(eseguita, false);
    assert.strictEqual(scartate, 0);
});

test("con modifiche non applicate, rispondendo si' le modifiche si scartano e la voce parte", async () => {
    provaMenu("Tab6", true);
    const ordine = [];
    jsIndexControls.impostaGuardiaUscita(() => DOMANDA, () => { ordine.push("scarta"); });
    assert.strictEqual(await jsIndexControls.clicVoce(null, () => { ordine.push("voce"); }), true);
    assert.deepStrictEqual(ordine, ["scarta", "voce"]);
});

test("ricliccare la scheda gia' aperta non e' un'uscita", async () => {
    const fatto = provaMenu("Tab6", false);
    jsIndexControls.impostaGuardiaUscita(() => DOMANDA);
    let eseguita = false;
    jsIndexControls.clicVoce("Tab6", () => { eseguita = true; });
    assert.strictEqual(eseguita, true);
    assert.deepStrictEqual(fatto.domande, []);
});

test("una guardia che si rompe non blocca il menu'", () => {
    provaMenu("Tab6", false);
    jsIndexControls.impostaGuardiaUscita(() => { throw new Error("rotta"); });
    let eseguita = false;
    jsIndexControls.clicVoce("Tab7", () => { eseguita = true; });
    assert.strictEqual(eseguita, true);
    jsIndexControls.impostaGuardiaUscita(null);
});

test("le voci della scheda ref e i pulsanti della barra passano da clicVoce, con la loro azione di prima", () => {
    const html = sorgente("index.html");
    const voci = [["Tab5", 1], ["Tab6", 2], ["Tab7", 3], ["Tab8", 4], ["Tab13", 5]];
    for (const [tab, scheda] of voci) {
        assert.ok(html.includes(`onclick="jsIndexControls.clicVoce('${tab}', () => { jsIndexControls.openTab(event, '${tab}'), jsIndexControls.changeImage($(this)), selectSchedaRef(${scheda}) })"`), tab);
    }
    for (const sottomenu of ["Tab7", "Tab5", "Tab10", "Tab1", "TabGriglia", "Tab12", "Tab9"]) {
        assert.ok(html.includes(`onclick="jsIndexControls.clicVoce(null, () => { jsIndexControls.changeImage($(this)), jsIndexControls.changeSubMenu('${sottomenu}', true) })"`), sottomenu);
    }
});

test("indexNew registra la scheda Foto P/S come guardia del menu' e della selezione", () => {
    const index = sorgente("indexNew.js");
    assert.match(index, /indesignEvents\.impostaGuardiaSelezione\(\(\) => schedaRef\.trattieniSelezionePerFotoPs\(\)\);/);
    assert.match(index, /jsIndexControls\.impostaGuardiaUscita\(\(\) => schedaRef\.avvisoModificheFotoPs\(\), \(\) => schedaRef\.scartaModificheFotoPs\(\)\);/);
});

/* ---- la selezione di InDesign ---- */

test("il ciclo chiede alla guardia solo quando la selezione e' cambiata", async () => {
    let chiamate = 0;
    const eventi = { guardiaSelezione: async () => { chiamate++; return true; }, lastSelectionID: [7] };

    appFinta.selection = [{ id: 7 }];
    assert.strictEqual(await InddEvents.prototype.selezioneTrattenuta.call(eventi), false);
    assert.strictEqual(chiamate, 0);

    appFinta.selection = [{ id: 9 }];
    assert.strictEqual(await InddEvents.prototype.selezioneTrattenuta.call(eventi), true);
    appFinta.selection = [];
    assert.strictEqual(await InddEvents.prototype.selezioneTrattenuta.call(eventi), true);
    assert.strictEqual(chiamate, 2);
});

test("senza guardia, o con una guardia rotta, il ciclo va avanti", async () => {
    appFinta.selection = [{ id: 9 }];
    assert.strictEqual(await InddEvents.prototype.selezioneTrattenuta.call({ guardiaSelezione: null, lastSelectionID: [7] }), false);
    const rotta = { guardiaSelezione: async () => { throw new Error("rotta"); }, lastSelectionID: [7] };
    assert.strictEqual(await InddEvents.prototype.selezioneTrattenuta.call(rotta), false);
});

test("il ciclo chiede alla guardia dopo la vista controllata e prima di leggere la selezione", () => {
    const eventi = sorgente("events.js");
    const vista = eventi.indexOf("if (me.vistaControllataAperta()) {");
    const guardia = eventi.indexOf("if (await me.selezioneTrattenuta()) {");
    const selezione = eventi.indexOf("let newIDSelection = [];");
    assert.ok(vista > 0 && guardia > vista && guardia < selezione);
});

/// La scheda con i globali finti di trattieniSelezionePerFotoPs: il box 7 e l'operatore che clicca altrove.
function provaSelezione(avviso, risposta, riselezionato = true) {
    const fatto = { domande: [], scartate: 0, accettate: [], occupato: [] };
    const box = { id: 7, isValid: true };
    const scheda = Object.create(schedaRef);
    scheda.refSelected = { item: box };
    scheda.avvisoModificheFotoPs = () => avviso;
    scheda.scartaModificheFotoPs = () => { fatto.scartate++; };
    scheda.riselezionaBox = (b) => {
        if (riselezionato) {
            global.app.selection = [b];
        }
        return riselezionato;
    };
    global.app = { selection: [{ id: 9 }] };
    global.indesignEvents = {
        setBusy: (b) => { fatto.occupato.push(b); },
        accettaSelezione: (ids) => { fatto.accettate.push(ids); },
    };
    global.Modali = { confirm: async (domanda) => { fatto.domande.push(domanda); return risposta; } };
    return { scheda, fatto, box };
}

test("cliccando fuori dal box con spunte non applicate, il box resta selezionato finche' non si risponde", async () => {
    const { scheda, fatto, box } = provaSelezione(DOMANDA, false);
    assert.strictEqual(await scheda.trattieniSelezionePerFotoPs(), true);
    assert.deepStrictEqual(fatto.domande, [DOMANDA]);
    assert.deepStrictEqual(global.app.selection, [box]);
    assert.deepStrictEqual(fatto.accettate, [[7]]);
    assert.strictEqual(fatto.scartate, 0);
    assert.deepStrictEqual(fatto.occupato, [true, false]);
});

test("uscendo, le spunte si scartano e la selezione va dove l'operatore aveva cliccato", async () => {
    const { scheda, fatto } = provaSelezione(DOMANDA, true);
    assert.strictEqual(await scheda.trattieniSelezionePerFotoPs(), true);
    assert.strictEqual(fatto.scartate, 1);
    assert.deepStrictEqual(global.app.selection, [{ id: 9 }]);
    assert.deepStrictEqual(fatto.occupato, [true, false]);
});

test("uscendo verso il vuoto, la selezione si toglie", async () => {
    const { scheda } = provaSelezione(DOMANDA, true);
    global.app.selection = [];
    assert.strictEqual(await scheda.trattieniSelezionePerFotoPs(), true);
    assert.strictEqual(global.app.selection, null);
});

test("senza spunte non applicate, o con il box che non si riseleziona, la selezione va come prima", async () => {
    let prova = provaSelezione(null, true);
    assert.strictEqual(await prova.scheda.trattieniSelezionePerFotoPs(), false);
    assert.deepStrictEqual(prova.fatto.domande, []);

    prova = provaSelezione(DOMANDA, true, false);
    assert.strictEqual(await prova.scheda.trattieniSelezionePerFotoPs(), false);
    assert.deepStrictEqual(prova.fatto.domande, []);
    assert.deepStrictEqual(prova.fatto.occupato, []);
});
