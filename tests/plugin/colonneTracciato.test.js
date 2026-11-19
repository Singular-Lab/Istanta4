/*
 * TASK-ff931e6d: le colonne della lista del tracciato nella Home del Plugin (plugin/colonneTracciato.js):
 * colonne nascoste dal menu del click destro, tranne Pag e Codice; ordinamento a tre stati su una colonna
 * alla volta; larghezze che riempiono il pannello, prima a chi ha il testo tagliato, poi in parti uguali;
 * descrizione e colonne dichiarate dal cliente su piu' righe, fino a 5.
 *
 * Esecuzione: node --test tests/plugin/colonneTracciato.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const ColonneTracciato = require("../../plugin/colonneTracciato");

const PAG = { nome: "Pag", chiaveDato: "__pagina__", width: 40 };
const CODICE = { nome: "Codice", chiaveDato: "codice", width: 50 };
const DESCRIZIONE = { nome: "Descrizione", chiaveDato: "descrizione", width: 120 };
const SEZIONE = { nome: "Sezione", chiaveDato: "sezione", width: 100 };
const TEMA = { nome: "Tema", chiaveDato: "tema", width: 60 };
const NOTE = { nome: "Note category", chiaveDato: "note_category", width: 120, righeMassime: 5 };
const COLONNE = [PAG, CODICE, DESCRIZIONE, SEZIONE, TEMA, NOTE];

/// Il testo di una cella come lo legge indexNew (testoCellaTracciato), su righe di prova piatte.
const testo = (riga, colonna) => riga[colonna.chiaveDato] ?? "";

test.beforeEach(() => ColonneTracciato.azzera());

/* ---- colonne visibili ---- */

test("Pag e Codice non si nascondono; le altre si nascondono e tornano", () => {
    assert.strictEqual(ColonneTracciato.nascondibile(PAG), false);
    assert.strictEqual(ColonneTracciato.nascondibile(CODICE), false);
    assert.strictEqual(ColonneTracciato.nascondibile({ chiaveDato: "Codice" }), false, "senza maiuscole");
    assert.strictEqual(ColonneTracciato.nascondibile(TEMA), true);

    assert.strictEqual(ColonneTracciato.cambiaVisibilita(CODICE, false), false);
    assert.strictEqual(ColonneTracciato.cambiaVisibilita(TEMA, false), true);
    assert.deepStrictEqual(ColonneTracciato.colonneVisibili(COLONNE).map(c => c.nome), ["Pag", "Codice", "Descrizione", "Sezione", "Note category"]);
    //Due volte la stessa cosa: niente da cambiare.
    assert.strictEqual(ColonneTracciato.cambiaVisibilita(TEMA, false), false);

    assert.strictEqual(ColonneTracciato.cambiaVisibilita(TEMA, true), true);
    assert.deepStrictEqual(ColonneTracciato.colonneVisibili(COLONNE), COLONNE);
});

test("all'apertura del pannello tutte le colonne si vedono e nessuna e' ordinata", () => {
    ColonneTracciato.cambiaVisibilita(TEMA, false);
    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    ColonneTracciato.azzera();
    assert.deepStrictEqual(ColonneTracciato.colonneVisibili(COLONNE), COLONNE);
    assert.strictEqual(ColonneTracciato.stato.ordinamento, null);
});

/* ---- ordinamento ---- */

test("il clic sull'icona: crescente, decrescente, di nuovo l'ordine di prima", () => {
    assert.strictEqual(ColonneTracciato.simboloOrdinamento(SEZIONE), "⇅");
    assert.deepStrictEqual(ColonneTracciato.cliccaOrdinamento(SEZIONE), { chiave: "sezione", verso: "crescente" });
    assert.strictEqual(ColonneTracciato.simboloOrdinamento(SEZIONE), "▲");
    assert.deepStrictEqual(ColonneTracciato.cliccaOrdinamento(SEZIONE), { chiave: "sezione", verso: "decrescente" });
    assert.strictEqual(ColonneTracciato.simboloOrdinamento(SEZIONE), "▼");
    assert.strictEqual(ColonneTracciato.cliccaOrdinamento(SEZIONE), null);
    assert.strictEqual(ColonneTracciato.simboloOrdinamento(SEZIONE), "⇅");
});

test("una colonna alla volta: ordinarne un'altra riporta la prima all'ordine di prima", () => {
    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    assert.deepStrictEqual(ColonneTracciato.cliccaOrdinamento(TEMA), { chiave: "tema", verso: "crescente" });
    assert.strictEqual(ColonneTracciato.simboloOrdinamento(SEZIONE), "⇅");
});

test("nascondere la colonna ordinata toglie l'ordinamento; nasconderne un'altra no", () => {
    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    ColonneTracciato.cambiaVisibilita(TEMA, false);
    assert.deepStrictEqual(ColonneTracciato.stato.ordinamento, { chiave: "sezione", verso: "crescente" });
    ColonneTracciato.cambiaVisibilita(SEZIONE, false);
    assert.strictEqual(ColonneTracciato.stato.ordinamento, null);
});

test("le righe si ordinano in ordine naturale, senza maiuscole, con i vuoti in fondo e l'ordine di prima a parita'", () => {
    const righe = [
        { id: 1, sezione: "b" }, { id: 2, sezione: "" }, { id: 3, sezione: "10" },
        { id: 4, sezione: "A" }, { id: 5, sezione: "9" }, { id: 6, sezione: "a" }, { id: 7 }
    ];
    //Senza ordinamento restano come sono, e la lista data non cambia.
    assert.deepStrictEqual(ColonneTracciato.ordina(righe, COLONNE, testo).map(r => r.id), [1, 2, 3, 4, 5, 6, 7]);

    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    assert.deepStrictEqual(ColonneTracciato.ordina(righe, COLONNE, testo).map(r => r.id), [5, 3, 4, 6, 1, 2, 7]);
    ColonneTracciato.cliccaOrdinamento(SEZIONE);
    assert.deepStrictEqual(ColonneTracciato.ordina(righe, COLONNE, testo).map(r => r.id), [1, 4, 6, 3, 5, 2, 7]);
    assert.deepStrictEqual(righe.map(r => r.id), [1, 2, 3, 4, 5, 6, 7]);
});

test("la pagina si ordina come numero; una colonna ordinata ma non fra quelle date non ordina", () => {
    const righe = [{ id: 1, __pagina__: "12" }, { id: 2, __pagina__: "" }, { id: 3, __pagina__: "3" }];
    ColonneTracciato.cliccaOrdinamento(PAG);
    assert.deepStrictEqual(ColonneTracciato.ordina(righe, COLONNE, testo).map(r => r.id), [3, 1, 2]);
    assert.deepStrictEqual(ColonneTracciato.ordina(righe, [CODICE], testo).map(r => r.id), [1, 2, 3]);
});

/* ---- righe ---- */

test("la descrizione va a capo fino a 5 righe, le altre colonne quante ne dichiara il cliente", () => {
    assert.strictEqual(ColonneTracciato.righeMassime(DESCRIZIONE), 5);
    assert.strictEqual(ColonneTracciato.righeMassime(NOTE), 5);
    assert.strictEqual(ColonneTracciato.righeMassime(SEZIONE), 0);
    assert.strictEqual(ColonneTracciato.righeMassime({ chiaveDato: "x", righeMassime: "3" }), 3);
    assert.strictEqual(ColonneTracciato.righeMassime({ chiaveDato: "x", righeMassime: -1 }), 0);
    assert.strictEqual(ColonneTracciato.altezzaMassima(5), 5 * 15 + 16);
});

/* ---- larghezze ---- */

test("una colonna non e' mai piu' stretta della sua intestazione, nome in grassetto e frecce", () => {
    //Nome a 7 px per carattere, 16 per le frecce, 20 di padding.
    assert.strictEqual(ColonneTracciato.minimo({ nome: "Tipo tema", width: 60 }), 9 * 7 + 16 + 20);
    assert.strictEqual(ColonneTracciato.minimo({ nome: "Tema", width: 60 }), 64);
    assert.strictEqual(ColonneTracciato.minimo({ nome: "Ruolo", width: 60 }), 71);
    assert.strictEqual(ColonneTracciato.minimo(PAG), 57);
    //Se la larghezza configurata basta, resta quella.
    assert.strictEqual(ColonneTracciato.minimo(SEZIONE), 100);
    assert.strictEqual(ColonneTracciato.minimo(DESCRIZIONE), 120);
});

test("il fabbisogno: il testo piu' lungo intero, o in 4 righe se la colonna va a capo; mai sotto la larghezza minima", () => {
    const righe = [{ sezione: "TANTE ALTRE OFFERTE", descrizione: "x".repeat(80), tema: "A", codice: "3650461,3650462,3650463" }];
    //19 caratteri a 6 px piu' 20 di padding.
    assert.strictEqual(ColonneTracciato.fabbisogno(SEZIONE, righe, testo), 19 * 6 + 20);
    //80 caratteri in 4 righe: 120 px piu' 20 di padding.
    assert.strictEqual(ColonneTracciato.fabbisogno(DESCRIZIONE, righe, testo), 140);
    assert.strictEqual(ColonneTracciato.fabbisogno(TEMA, righe, testo), 64);
    assert.strictEqual(ColonneTracciato.fabbisogno(SEZIONE, [], testo), 100);
});

test("Pag e Codice non hanno priorita' di spazio: a loro basta la larghezza minima", () => {
    const righe = [{ __pagina__: "12", codice: "3650461,3650462,3650463" }];
    assert.strictEqual(ColonneTracciato.fabbisogno(PAG, righe, testo), ColonneTracciato.minimo(PAG));
    assert.strictEqual(ColonneTracciato.fabbisogno(CODICE, righe, testo), ColonneTracciato.minimo(CODICE));
});

//Colonne senza nome, perche' i minimi siano le larghezze configurate.
const A = { nome: "", chiaveDato: "a", width: 40 };
const B = { nome: "", chiaveDato: "b", width: 50 };
const C = { nome: "", chiaveDato: "c", width: 100 };

test("sotto la somma delle larghezze minime restano quelle: la lista scorre", () => {
    const colonne = [A, B, C];
    assert.deepStrictEqual(ColonneTracciato.larghezze(colonne, 120, [40, 90, 200]), [40, 50, 100]);
    assert.deepStrictEqual(ColonneTracciato.larghezze(colonne, 190, [40, 90, 200]), [40, 50, 100]);
    assert.deepStrictEqual(ColonneTracciato.larghezze(colonne, 0, [40, 90, 200]), [40, 50, 100]);
});

test("lo spazio in piu' va prima a chi ha il testo tagliato, in proporzione al bisogno", () => {
    //Bisogni: Codice 40, Sezione 120; 80 px in piu': un quarto e tre quarti.
    assert.deepStrictEqual(ColonneTracciato.larghezze([A, B, C], 270, [40, 90, 220]), [40, 70, 160]);
});

test("quando i testi si vedono tutti, quello che avanza si divide in parti uguali", () => {
    //Bisogni 40 + 120 = 160; 300 px in piu': 140 avanzano, 46,67 a testa, in pixel interi.
    const larghezze = ColonneTracciato.larghezze([A, B, C], 490, [40, 90, 220]);
    assert.deepStrictEqual(larghezze, [86, 136, 266]);
    assert.ok(larghezze.reduce((s, l) => s + l, 0) <= 490, "mai oltre lo spazio");
    //Senza bisogni, tutto in parti uguali.
    assert.deepStrictEqual(ColonneTracciato.larghezze([A, B], 150, [40, 50]), [70, 80]);
});

test("le larghezze minime contano l'intestazione: Tipo tema non scende sotto i 99 px", () => {
    const tipoTema = { nome: "Tipo tema", chiaveDato: "tipo_tema", width: 60 };
    assert.deepStrictEqual(ColonneTracciato.larghezze([A, tipoTema], 100, [40, 60]), [40, 99]);
});

/* ---- indexNew ---- */

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
const corpo = (firma) => {
    const inizio = indexNew.indexOf(firma);
    assert.ok(inizio >= 0, firma + " non trovata");
    return indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));
};

test("il ridisegno calcola colonne visibili, ordine e larghezze una volta, poi l'intestazione", () => {
    const aggiorna = corpo("async function aggiornaTracciatoPostRicerca(resRicerca) {");
    assert.match(aggiorna, /ultimaRicercaTracciato = resRicerca;/);
    const colonne = aggiorna.indexOf("colonneTracciatoInRidisegno = ColonneTracciato.colonneVisibili(getTracciatoColumns());");
    const ordine = aggiorna.indexOf("recordsDaMostrare = ColonneTracciato.ordina(recordsDaMostrare, colonneTracciatoInRidisegno, testoCellaTracciato);");
    const larghezze = aggiorna.indexOf("larghezzeTracciatoInRidisegno = ColonneTracciato.larghezze(colonneTracciatoInRidisegno, larghezzaListaTracciato(), fabbisogniTracciatoInRidisegno);");
    const intestazione = aggiorna.indexOf("$body.before(renderIntestazioneTracciato());");
    const righe = aggiorna.indexOf("creaElementoTracciato(record, first, riepilogoSegnalazioni)");
    assert.ok(colonne > 0 && ordine > colonne && larghezze > ordine && intestazione > larghezze && righe > intestazione);
});

test("intestazione e righe usano le colonne visibili e le larghezze del ridisegno", () => {
    const intestazione = corpo("function renderIntestazioneTracciato() {");
    assert.match(intestazione, /const columns = colonneTracciatoInRidisegno \|\| ColonneTracciato\.colonneVisibili\(getTracciatoColumns\(\)\);/);
    assert.match(intestazione, /applicaLarghezzaCella\(\$cell, larghezzaColonnaTracciato\(col, indice\)\);/);
    assert.match(intestazione, /ColonneTracciato\.cliccaOrdinamento\(col\);\s*ridisegnaTracciato\(\);/);
    assert.match(intestazione, /\$header\.on\("contextmenu", function \(e\) \{\s*apriMenuColonneTracciato\(e\);/);

    const riga = corpo("function creaElementoTracciato(obj, isFirst, riepilogoSegnalazioni = {}) {");
    assert.match(riga, /const columns = colonneTracciatoInRidisegno \|\| ColonneTracciato\.colonneVisibili\(getTracciatoColumns\(\)\);/);
    assert.match(riga, /applicaLarghezzaCella\(\$cell, larghezzaColonnaTracciato\(col, indice\)\);/);
    assert.doesNotMatch(riga, /\$cell\.css\("width", "300px"\);/);
    assert.match(riga, /applicaRigheMassime\(\$cell, ColonneTracciato\.righeMassime\(col\)\);/);
});

test("il menu del click destro e' quello dei filtri, con Pag e Codice disattivate", () => {
    const menu = corpo("function apriMenuColonneTracciato(e) {");
    assert.match(menu, /Menu\.creaFloatingMenu\(\{/);
    assert.match(menu, /if \(!ColonneTracciato\.nascondibile\(col\)\) \{\s*\$casella\.prop\("disabled", true\);/);
    assert.match(menu, /if \(ColonneTracciato\.cambiaVisibilita\(col, spuntata\)\) \{\s*ridisegnaTracciato\(\);/);
});

test("al ridimensionamento le colonne seguono la larghezza nuova prima della barra", () => {
    const resize = corpo("function onResizeTab1Tracciato(){");
    const ridistribuisci = resize.indexOf("ridistribuisciLarghezzeTracciato();");
    const barra = resize.indexOf("scorriTracciato(statoBarraTracciato, statoBarraTracciato.spostamento || 0);");
    assert.ok(ridistribuisci > 0 && barra > ridistribuisci);
});

test("Edro21 mostra la note category su 5 righe", () => {
    const percorso = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceCustomPlugin.json");
    const colonne = JSON.parse(fs.readFileSync(percorso, "utf8").replace(/^﻿/, "")).colonneTracciato;
    const note = colonne.find(c => c.chiaveDato === "note_category");
    assert.strictEqual(note.righeMassime, 5);
    assert.ok(colonne.filter(c => c !== note).every(c => c.righeMassime == null), "le altre colonne come prima");
});
