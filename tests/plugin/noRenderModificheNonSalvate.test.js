/*
 * I20-1105: la schermata noRender non fa perdere modifiche in silenzio, e il suo Salva si vede.
 *
 * Prima la X della finestra chiamava Modali.chiudiModal, che chiudeva subito: gli elementi cambiati
 * e non salvati si perdevano senza avviso. E il Salva era un pulsante di sistema senza stile, in
 * basso a sinistra, simile ai pulsanti grigi degli elementi.
 *
 * Ora la X passa da Modali.chiudiModalDallaX: se la finestra ha registrato un controllo e il
 * controllo dice che c'e' qualcosa da perdere, chiede "Esci senza salvare" o "Annulla". Le
 * chiusure fatte dal codice restano immediate.
 *
 * modali.js si carica sotto Node con jQuery finto; schedaRef.js e index.html si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const Modali = require("../../plugin/modali/modali.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- la X ---- */

//Sostituisce chiudiModal e confirmCustom per vedere cosa fa la X senza una pagina vera.
async function premiLaX(controllo, risposta) {
    const salvati = { chiudiModal: Modali.chiudiModal, confirmCustom: Modali.confirmCustom };
    const visto = { chiusa: false, domande: [] };
    Modali.chiudiModal = function () { visto.chiusa = true; this.controlloPrimaDiChiudere = null; };
    Modali.confirmCustom = async function (messaggio, primo) {
        visto.domande.push({ messaggio, primo });
        return { result: risposta, hiddenVal: null };
    };
    try {
        Modali.controlloPrimaDiChiudere = null;
        Modali.impostaControlloPrimaDiChiudere(controllo);
        visto.esito = await Modali.chiudiModalDallaX();
    }
    finally {
        Modali.chiudiModal = salvati.chiudiModal;
        Modali.confirmCustom = salvati.confirmCustom;
        Modali.controlloPrimaDiChiudere = null;
    }
    return visto;
}

test("senza controllo la X chiude come prima, senza domande", async () => {
    const visto = await premiLaX(null, false);
    assert.strictEqual(visto.chiusa, true);
    assert.deepStrictEqual(visto.domande, []);
});

test("con niente da perdere la X chiude senza domande", async () => {
    const visto = await premiLaX(() => null, false);
    assert.strictEqual(visto.chiusa, true);
    assert.deepStrictEqual(visto.domande, []);
});

test("con modifiche non salvate la X chiede, e Annulla lascia la finestra aperta", async () => {
    const visto = await premiLaX(() => "Ci sono modifiche al noRender non salvate (1 elemento). Uscire senza salvare?", false);
    assert.strictEqual(visto.chiusa, false);
    assert.strictEqual(visto.esito, false);
    assert.deepStrictEqual(visto.domande, [{ messaggio: "Ci sono modifiche al noRender non salvate (1 elemento). Uscire senza salvare?", primo: "Esci senza salvare" }]);
});

test("con modifiche non salvate, Esci senza salvare chiude", async () => {
    const visto = await premiLaX(() => "Ci sono modifiche.", true);
    assert.strictEqual(visto.chiusa, true);
    assert.strictEqual(visto.esito, true);
});

test("un controllo rotto non impedisce di chiudere", async () => {
    const errore = console.error;
    console.error = () => {};
    try {
        const visto = await premiLaX(() => { throw new Error("rotto"); }, false);
        assert.strictEqual(visto.chiusa, true);
    }
    finally {
        console.error = errore;
    }
});

test("il controllo e' della finestra che lo registra: apriModal e chiudiModal lo azzerano", () => {
    const modali = sorgente("modali/modali.js");
    const apri = modali.substring(modali.indexOf("    apriModal(modalId"), modali.indexOf("    apriModalCustom("));
    assert.match(apri, /this\.controlloPrimaDiChiudere = null;/);
    const chiudi = modali.substring(modali.indexOf("    chiudiModal(){"));
    assert.match(chiudi, /^\s*chiudiModal\(\)\{\s*(\/\/[^\n]*\n\s*)*this\.controlloPrimaDiChiudere = null;/);
});

/* ---- la schermata noRender ---- */

test("la X della finestra principale passa dal controllo", () => {
    const html = sorgente("index.html");
    assert.match(html, /<button id="closeModal" onclick="Modali\.chiudiModalDallaX\(\)"/);
    assert.doesNotMatch(html, /<button id="closeModal" onclick="Modali\.chiudiModal\(\)"/);
});

test("la schermata noRender registra il controllo dopo averla aperta, e la fotografia del salvato", () => {
    const scheda = sorgente("schedaRef.js");
    const apri = scheda.substring(scheda.indexOf("    apriModalNoRender() {"), scheda.indexOf("    leggiElementiDelBox(box, primario) {"));
    const fotografia = apri.indexOf("this.statoNoRenderSalvato = NoRenderElementi.statoDiRendering(this.elementiNoRenderDelBox);");
    const apertura = apri.indexOf("Modali.apriModal('dialogNoRender'");
    const controllo = apri.indexOf("Modali.impostaControlloPrimaDiChiudere(function () {");
    assert.ok(fotografia > 0 && apertura > fotografia && controllo > apertura, "fotografia, apertura, poi il controllo");
    assert.match(apri, /return me\.avvisoModificheNoRender\(\);/);
});

test("il salvato si aggiorna solo quando Istanta registra il salvataggio", () => {
    const scheda = sorgente("schedaRef.js");
    const salva = scheda.substring(scheda.indexOf("    salvaNoRender() {"), scheda.indexOf("    inviaNoRender(elementi) {"));
    assert.match(salva, /var statoInviato = NoRenderElementi\.statoDiRendering\(lista\);/);
    assert.match(salva, /if \(registrato\) \{\s*me\.statoNoRenderSalvato = statoInviato;/);
});

test("l'avviso conta gli elementi cambiati, e senza modifiche non c'e'", () => {
    const scheda = sorgente("schedaRef.js");
    const avviso = scheda.substring(scheda.indexOf("    avvisoModificheNoRender() {"), scheda.indexOf("    salvaNoRender() {"));
    assert.match(avviso, /NoRenderElementi\.modificheNonSalvate\(this\.elementiNoRenderDelBox, this\.statoNoRenderSalvato\)/);
    assert.match(avviso, /if \(diverse === 0\) \{\s*return null;\s*\}/);
    assert.match(avviso, /Uscire senza salvare\?/);
});

function dialogoNoRender() {
    const html = sorgente("index.html");
    return html.substring(html.indexOf('<div id="dialogNoRender"'), html.indexOf('<div id="dialogLinkLogoBollo"'));
}

test("il Salva della schermata noRender si distingue: verde, a pillola, a destra", () => {
    const dialogo = dialogoNoRender();
    //Un riquadro cliccabile e non un button: in UXP il button ignora il colore di sfondo e restava grigio.
    assert.doesNotMatch(dialogo, /<button id="salvaNoRender"/);
    const salva = dialogo.match(/<div id="salvaNoRender" role="button"[\s\S]*?<\/div>/)[0];
    assert.match(salva, /background-color: #28a745;/);
    assert.match(salva, /border-radius: 16px;/);
    assert.match(salva, /color: white;/);
    assert.match(salva, /onclick="schedaRef\.salvaNoRender\(\);">Salva modifiche<\/div>/);
    assert.match(dialogo, /<div style="display: flex; justify-content: flex-end;/);
});

test("nella schermata noRender scorre solo la lista, e solo se serve", () => {
    const dialogo = dialogoNoRender();
    assert.match(dialogo, /^<div id="dialogNoRender" myname="dialogNoRender"\s*style="overflow: hidden;/);
    assert.match(dialogo, /<div id="listaNoRender" style="overflow-y: auto;">/);
    assert.doesNotMatch(dialogo, /overflow: scroll/);

    //L'altezza in pixel della lista si fissa dopo averla disegnata nel clone aperto.
    const scheda = sorgente("schedaRef.js");
    const apri = scheda.substring(scheda.indexOf("    apriModalNoRender() {"), scheda.indexOf("    leggiElementiDelBox(box, primario) {"));
    assert.ok(apri.indexOf("this.fissaAltezzaListaNoRender();") > apri.indexOf("this.disegnaListaNoRender();"));
    const fissa = scheda.substring(scheda.indexOf("    fissaAltezzaListaNoRender() {"), scheda.indexOf("    avvisoModificheNoRender() {"));
    assert.match(fissa, /\$\("#overlayModal"\)\.find\("#listaNoRender"\)\[0\]/);
    assert.match(fissa, /altezza = AltezzaScorrimento\.fissaAltezza\(contenitore, lista, \{ margine: 56 \}\);/);
    assert.match(scheda, /const AltezzaScorrimento = require\('\.\/altezzaScorrimento'\);/);
});

test("subito dopo l'apertura le misure non ci sono: l'altezza si riprova, e senza si torna allo scorrimento della finestra", () => {
    //Provato in UXP: chiamata subito dopo apriModal l'altezza restava vuota e la lista tagliata;
    //chiamata a finestra aperta fissava 402px.
    const scheda = sorgente("schedaRef.js");
    const fissa = scheda.substring(scheda.indexOf("    fissaAltezzaListaNoRender(tentativo = 0) {"), scheda.indexOf("    avvisoModificheNoRender() {"));
    assert.match(fissa, /if \(altezza != null\) \{\s*return altezza;\s*\}/);
    assert.match(fissa, /if \(tentativo < 20\) \{\s*setTimeout\(function \(\) \{\s*me\.fissaAltezzaListaNoRender\(tentativo \+ 1\);\s*\}, 50\);/);
    assert.match(fissa, /\$\("#overlayModal"\)\.find\("#dialogNoRender"\)\.css\("overflow", "auto"\);/);
});

test("il ripiego avviene davvero: senza misure, dopo i tentativi la finestra torna a scorrere", async () => {
    //schedaRef.js non si carica sotto Node (require('indesign')): si prova la stessa funzione,
    //presa dal sorgente, con jQuery e AltezzaScorrimento finti.
    const scheda = sorgente("schedaRef.js");
    const inizio = scheda.indexOf("    fissaAltezzaListaNoRender(tentativo = 0) {");
    const corpo = scheda.substring(scheda.indexOf("{", inizio) + 1, scheda.indexOf("\n    },\n", inizio));
    const css = [];
    const $ = () => ({ find: () => Object.assign([undefined], { css: (k, v) => css.push(k + ":" + v) }) });
    const AltezzaScorrimento = { fissaAltezza: () => null };
    const oggetto = {};
    oggetto.fissaAltezzaListaNoRender = new Function("$", "AltezzaScorrimento", "setTimeout", "console",
        "return function (tentativo = 0) {" + corpo + "};")($, AltezzaScorrimento, (f) => f(), { error() {}, warn() {} });

    assert.strictEqual(oggetto.fissaAltezzaListaNoRender(), null);
    assert.deepStrictEqual(css, ["overflow:auto"]);
});
