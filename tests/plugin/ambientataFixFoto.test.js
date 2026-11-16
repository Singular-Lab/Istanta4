/*
 * I20-1236: la foto ambientata.
 *
 * Un'ambientata (foto extra di tipo 4, foto_extra$<sigla>$tipo_4, automatica o aggiunta a mano) entrava
 * in un riquadro grande quanto il box e nessuno la sistemava: copriva foto e testi, e Reimpagina box o
 * Fix referenza rifacevano lo stesso. Le regole dell'operatore: l'ambientata prende la percentuale di
 * ingrandimento della foto primaria, sta in primo piano e puo' sovrapporsi agli altri elementi. Il fix
 * foto la dispone con la confezione come prima foto della cascata (con Edro21, per due foto, la seconda
 * va a destra e in alto: ambientata in basso a sinistra, confezione in alto a destra), alla stessa
 * scala. Se la configurazione non ha una disposizione per quel numero di foto, il fix sistema le sole
 * foto del prodotto e l'ambientata va alla scala della primaria in basso a sinistra dello spazio scelto.
 *
 * La decisione (chi e' un'ambientata, dove va) sta in selezioneFoto.js, pura; di sistemazioneFoto.js,
 * che chiede InDesign, si legge il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");

const selezioneFoto = require("../../plugin/sistemazioneFoto/selezioneFoto.js");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

test("I20-1236: e' un'ambientata solo la foto extra di tipo 4", () => {
    assert.strictEqual(selezioneFoto.eAmbientata("foto_extra$134116_amb$tipo_4"), true);
    assert.strictEqual(selezioneFoto.eAmbientata("X_foto_extra$134116_amb$tipo_4"), true);
    assert.strictEqual(selezioneFoto.eAmbientata("foto_extra$134116_amb$tipo_4$DNA$x"), true);
    //loghi, bollini, sfondi e foto del prodotto no
    assert.strictEqual(selezioneFoto.eAmbientata("foto_extra$Logo_BDP$tipo_3"), false);
    assert.strictEqual(selezioneFoto.eAmbientata("foto_extra$bollino$tipo_2"), false);
    assert.strictEqual(selezioneFoto.eAmbientata("foto_extra$x$tipo_40"), false);
    assert.strictEqual(selezioneFoto.eAmbientata("sfondo$sfondo_bdp$tipo_5"), false);
    assert.strictEqual(selezioneFoto.eAmbientata("immagine$134116"), false);
    assert.strictEqual(selezioneFoto.eAmbientata(""), false);
    assert.strictEqual(selezioneFoto.eAmbientata(null), false);
});

test("I20-1236: le ambientate del box sono quelle visibili, nel loro ordine", () => {
    const amb1 = { label: "foto_extra$1_amb$tipo_4" };
    const nascosta = { label: "foto_extra$2_amb$tipo_4", visible: false };
    const amb3 = { label: "foto_extra$3_amb$tipo_4", visible: true };
    const elementi = [{ label: "immagine$1" }, amb1, { label: "foto_extra$logo$tipo_3" }, nascosta, null, amb3];

    assert.deepStrictEqual(selezioneFoto.ambientateDelBox(elementi), [amb1, amb3]);
    assert.deepStrictEqual(selezioneFoto.ambientateDelBox(null), []);
});

test("I20-1236: lo spazio delle foto e' il candidato scelto, spostato sull'angolo della base", () => {
    //la base del box comincia a (100, 20); il fix ha scelto lo spazio 60 x 40 a (5, 10) dentro la base
    const bounds = selezioneFoto.boundsSpazioFoto([100, 20, 200, 120], { x: 5, y: 10, width: 60, height: 40 });

    assert.deepStrictEqual(bounds, [110, 25, 150, 85]);
});

test("I20-1236: senza misure valide lo spazio delle foto non c'e'", () => {
    assert.strictEqual(selezioneFoto.boundsSpazioFoto(null, { x: 0, y: 0, width: 10, height: 10 }), null);
    assert.strictEqual(selezioneFoto.boundsSpazioFoto([0, 0, 10, 10], null), null);
    assert.strictEqual(selezioneFoto.boundsSpazioFoto([0, 0, 10, 10], { x: 0, y: 0, width: 0, height: 10 }), null);
    assert.strictEqual(selezioneFoto.boundsSpazioFoto([0, 0, 10, 10], { x: "a", y: 0, width: 5, height: 10 }), null);
});

/* ---- le foto del fix con le ambientate ---- */

//come la configurazione di Edro21: disposizioni per 1, 2 e 3 foto
const DISTANZIAMENTO = [{ foto: 1 }, { foto: 2 }, { foto: 3 }];

test("I20-1236: con una disposizione per il totale, le ambientate entrano nel fix come prime foto", () => {
    const confezione = { label: "immagine$134116" };
    const ambientata = { label: "foto_extra$134116_amb$tipo_4" };

    assert.deepStrictEqual(selezioneFoto.fotoConAmbientate([confezione], [ambientata], DISTANZIAMENTO),
        { lista: [ambientata, confezione], ambientateNelFix: true });
});

test("I20-1236: senza una disposizione per il totale restano le sole foto del prodotto", () => {
    const prodotto = [{ label: "immagine$1" }, { label: "immagine2$2" }, { label: "immagine2$3" }];
    const ambientata = { label: "foto_extra$1_amb$tipo_4" };

    //tre foto del prodotto e un'ambientata fanno quattro: Edro21 non ha una disposizione per quattro
    assert.deepStrictEqual(selezioneFoto.fotoConAmbientate(prodotto, [ambientata], DISTANZIAMENTO),
        { lista: prodotto, ambientateNelFix: false });
    assert.deepStrictEqual(selezioneFoto.fotoConAmbientate([prodotto[0]], [ambientata], null),
        { lista: [prodotto[0]], ambientateNelFix: false });
});

test("I20-1236: senza ambientate o senza foto del prodotto il fix non cambia", () => {
    const confezione = { label: "immagine$1" };
    const ambientata = { label: "foto_extra$1_amb$tipo_4" };

    assert.deepStrictEqual(selezioneFoto.fotoConAmbientate([confezione], [], DISTANZIAMENTO),
        { lista: [confezione], ambientateNelFix: false });
    //un box con la sola ambientata non ha una foto da cui prendere la scala: resta com'e'
    assert.deepStrictEqual(selezioneFoto.fotoConAmbientate([], [ambientata], DISTANZIAMENTO),
        { lista: [], ambientateNelFix: false });
});

/* ---- dove va l'ambientata ---- */

//la base va da (100, 20) a (200, 120); lo spazio delle foto e' 60 x 40 a (5, 10) dentro la base,
//cioe' [110, 25, 150, 85]
const BASE = [100, 20, 200, 120];
const SPAZIO = { x: 5, y: 10, width: 60, height: 40 };

test("I20-1236: l'ambientata va con l'angolo in basso a sinistra su quello dello spazio delle foto", () => {
    assert.deepStrictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 30, 20), [130, 25, 150, 55]);
    //puo' essere piu' grande dello spazio: sporge verso l'alto e a destra, sugli altri elementi
    assert.deepStrictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 80, 45), [105, 25, 150, 105]);
});

test("I20-1236: l'ambientata che uscirebbe dalla base si sposta quanto basta, senza cambiare misura", () => {
    //larga 100: da 25 finirebbe a 125, oltre il bordo destro (120): si sposta a sinistra
    assert.deepStrictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 100, 20), [130, 20, 150, 120]);
    //alta 60: da 150 salirebbe a 90, sopra il bordo alto (100): si sposta in basso
    assert.deepStrictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 30, 60), [100, 25, 160, 55]);
});

test("I20-1236: l'ambientata piu' grande della base resta sull'angolo in basso a sinistra della base", () => {
    assert.deepStrictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 150, 130), [70, 20, 200, 170]);
});

test("I20-1236: senza misure valide l'ambientata non ha una posizione", () => {
    assert.strictEqual(selezioneFoto.boundsAmbientata(BASE, null, 30, 20), null);
    assert.strictEqual(selezioneFoto.boundsAmbientata([100, 20], SPAZIO, 30, 20), null);
    assert.strictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 0, 20), null);
    assert.strictEqual(selezioneFoto.boundsAmbientata(BASE, SPAZIO, 30, NaN), null);
});

/* ---- il fix foto, sul sorgente ---- */

const sistemazione = leggiFileDelPlugin("sistemazioneFoto/sistemazioneFoto.js").replace(/\r/g, "");

test("I20-1236: il fix foto mette le ambientate nella lista prima di misurare le foto", () => {
    const corpo = sistemazione.substring(sistemazione.indexOf("    eseguiFixFoto(box, candidateRects, obstacles, projection) {"), sistemazione.indexOf("    ambientateDelBox(box) {"));
    const lista = corpo.indexOf("var conAmbientate = selezioneFoto.fotoConAmbientate(listFoto, this.ambientateDelBox(box), configurazione.distanziamento);");
    const sostituita = corpo.indexOf("listFoto = conAmbientate.lista;");
    const misura = corpo.indexOf("let boundsFoto = this.getRealBoundsOfFoto(foto, paddingFoto, esitoMisura);");

    assert.ok(lista > 0 && sostituita > lista, "la lista con le ambientate sostituisce quella delle sole foto del prodotto");
    assert.ok(misura > sostituita, "prima della misura, cosi' anche la proiezione le conta");
});

test("I20-1236: dopo aver applicato le foto, le ambientate disposte vanno in primo piano, le altre si sistemano a parte", () => {
    const corpo = sistemazione.substring(sistemazione.indexOf("    eseguiFixFoto(box, candidateRects, obstacles, projection) {"), sistemazione.indexOf("    ambientateDelBox(box) {"));
    const applica = corpo.indexOf("if (!projection) { //se true non applichiamo i bounds alle foto");
    const primoPiano = corpo.indexOf("if (conAmbientate.ambientateNelFix) {\n                this.ambientateInPrimoPiano(fotos.map(f => f.object));\n            }");
    const ripiego = corpo.indexOf("else {\n                this.sistemaAmbientate(box, base, bestCandidate, fotos.map(f => f.object));\n            }");
    const conflitti = corpo.lastIndexOf("cssFramework().controllaSegnalazioniConflittiPendenti(box);");

    assert.ok(applica > 0 && primoPiano > applica, "dentro il ramo che applica le foto, non nella proiezione");
    assert.ok(ripiego > primoPiano, "senza disposizione per le ambientate, il ripiego");
    assert.ok(ripiego < conflitti, "prima del controllo dei conflitti, che deve vedere la posizione finale");

    const inPrimoPiano = sistemazione.substring(sistemazione.indexOf("    ambientateInPrimoPiano(foto) {"), sistemazione.indexOf("    sistemaAmbientate(box, base, candidato, fotoDelProdotto) {"));
    assert.match(inPrimoPiano, /if \(selezioneFoto\.eAmbientata\(String\(foto\[i\]\.label\)\)\) \{\s*foto\[i\]\.bringToFront\(\);/);
});

test("I20-1236: nel ripiego l'ambientata prende la scala della foto primaria e va in primo piano", () => {
    const corpo = sistemazione.substring(sistemazione.indexOf("    sistemaAmbientate(box, base, candidato, fotoDelProdotto) {"), sistemazione.indexOf("    graficaDellaFoto(rect) {"));

    //la primaria e' la prima foto del fix (fotoDelFix mette le primarie in testa)
    assert.match(corpo, /var scala = this\.scalaXYDellaFoto\(fotoDelProdotto\[0\]\);/);
    assert.match(corpo, /grafica\.horizontalScale = scala\.orizzontale;\s*grafica\.verticalScale = scala\.verticale;\s*ambientata\.fit\(FitOptions\.FRAME_TO_CONTENT\);/);
    assert.match(corpo, /selezioneFoto\.boundsAmbientata\(base\.geometricBounds, candidato,/);
    //si sposta senza ridimensionare: la scala resta quella della primaria
    assert.match(corpo, /ambientata\.move\(undefined, \[bounds\[1\] - attuali\[1\], bounds\[0\] - attuali\[0\]\]\);/);
    assert.doesNotMatch(corpo, /ambientata\.geometricBounds = /);
    //in primo piano, non dietro la confezione ne' in fondo al box
    assert.match(corpo, /ambientata\.bringToFront\(\);/);
    assert.doesNotMatch(corpo, /bringToFront\(ambientata\)/);
    assert.doesNotMatch(corpo, /sendToBack/);
});

test("I20-1236: la scala si legge orizzontale e verticale, e una scala non valida non si usa", () => {
    const corpo = sistemazione.substring(sistemazione.indexOf("    scalaXYDellaFoto(rect) {"), sistemazione.indexOf("    scalaDellaFoto(rect) {"));

    assert.match(corpo, /var orizzontale = grafica\.horizontalScale;\s*var verticale = grafica\.verticalScale;/);
    assert.match(corpo, /!\(orizzontale > 0\) \|\| !\(verticale > 0\)\) \{\s*return null;/);
});
