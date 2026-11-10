/*
 * I20-1216: copia e incolla di tutti i filtri di una pagina del Menabo', e i prodotti sotto ogni filtro.
 *
 * Si copiava un criterio alla volta: per i jolly Coop, una pagina con tanti filtri di un codice
 * ciascuno, rifarli in un'altra promo voleva dire riscriverli tutti. Ora Copia filtri mette i filtri
 * della finestra nel localStorage del Plugin (che resta cambiando documento) e Incolla filtri li
 * aggiunge in coda a quelli della pagina aperta, anche di un'altra promo, senza salvare: si salva con
 * Conferma.
 *
 * Con tanti filtri simili non si capiva a quale prodotto corrispondesse ciascuno: sotto ogni filtro
 * ora ci sono i prodotti che trova, i primi tre in vista e gli altri dietro "+ altri N".
 *
 * Le parti senza interfaccia si eseguono, con filtri.js caricato da un modulo indesign finto come in
 * ricercaTestoFiltri; quelle che costruiscono l'interfaccia con jQuery si controllano nel sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let filtri;
try {
    filtri = require("../../plugin/filtri.js");
}
finally {
    Module._load = caricaOriginale;
}

const sorgente = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
const indexHtml = leggiFileDelPlugin("index.html").replace(/\r/g, "");

function corpo(firma, fine) {
    const inizio = sorgente.indexOf(firma);
    assert.ok(inizio >= 0, "manca " + firma);
    return sorgente.substring(inizio, sorgente.indexOf(fine, inizio + firma.length));
}

/* ---- dati di prova ---- */

/// Un record della lista del kit: un singolo (codice referenza = codice gruppo) o un gruppo.
function record(codice, descrizione1, descrizione2, index, gruppo = null) {
    const r = {
        "Scatto.CodiceGruppo": codice,
        "Referenza.Codice": gruppo ? "R" + codice : codice,
        "Descrizioni.Descrizione1": descrizione1,
        "Descrizioni.Descrizione2": descrizione2
    };
    if (gruppo) {
        r.descrizione_gruppo = gruppo;
    }
    return { recordInTracciato: r, index: index };
}

/// I filtri di una pagina di jolly, uno per codice, come li legge la finestra.
function filtriJolly(quanti) {
    const elenco = [];
    for (let i = 0; i < quanti; i++) {
        elenco.push({ limite: 1, ordine: i + 1, criteri: [{ chiave: "Scatto.CodiceGruppo", operatore: "=", valore: String(9000 + i) }] });
    }
    return elenco;
}

/* ---- copia e incolla ---- */

test("i filtri copiati si incollano con gli stessi limiti, criteri e ordine", () => {
    const letti = [
        { limite: 3, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "JOLLY" }, { chiave: "sigla_reparto", operatore: "!=", valore: "OF" }] },
        { limite: 0, ordine: 2, criteri: [{ chiave: "Scatto.CodiceGruppo", operatore: "=", valore: "9001||9002" }] }
    ];
    const testo = JSON.stringify(filtri.confezionaCopiaFiltri(letti, "2"));
    const incollati = filtri.filtriDaIncollare(testo);
    assert.deepStrictEqual(incollati, letti);
});

test("quindici jolly copiati tornano tutti, nell'ordine della finestra", () => {
    const letti = filtriJolly(15);
    const incollati = filtri.filtriDaIncollare(JSON.stringify(filtri.confezionaCopiaFiltri(letti, 2)));
    assert.strictEqual(incollati.length, 15);
    assert.deepStrictEqual(incollati.map(f => f.criteri[0].valore), letti.map(f => f.criteri[0].valore));
});

test("la copia ricorda la pagina di partenza, come testo", () => {
    assert.strictEqual(filtri.confezionaCopiaFiltri(filtriJolly(1), 4).pagina, "4");
    assert.strictEqual(filtri.confezionaCopiaFiltri(filtriJolly(1)).pagina, null);
});

test("la copia non porta con se' altro che limite, ordine e criteri", () => {
    const letti = [{ limite: 2, ordine: 1, extra: "x", criteri: [{ chiave: "tema", operatore: "=", valore: "SPRINT", interfaccia: "<div>" }] }];
    const copia = filtri.confezionaCopiaFiltri(letti, "1");
    assert.deepStrictEqual(copia.filtri, [{ limite: 2, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "SPRINT" }] }]);
});

test("senza una copia, o con una copia rovinata, non c'e' niente da incollare", () => {
    assert.deepStrictEqual(filtri.filtriDaIncollare(null), []);
    assert.deepStrictEqual(filtri.filtriDaIncollare(""), []);
    assert.deepStrictEqual(filtri.filtriDaIncollare("{non e' json"), []);
    assert.deepStrictEqual(filtri.filtriDaIncollare("null"), []);
    assert.deepStrictEqual(filtri.filtriDaIncollare(JSON.stringify({ pagina: "1" })), []);
});

test("restano fuori i criteri senza chiave o senza operatore, e i filtri che restano vuoti", () => {
    const testo = JSON.stringify({
        filtri: [
            { limite: 1, ordine: 1, criteri: [{ chiave: "", operatore: "=", valore: "A" }, { chiave: "tema", operatore: null, valore: "B" }] },
            { limite: 2, ordine: 2, criteri: [{ chiave: "tema", operatore: "=", valore: "C" }, { chiave: "", operatore: "=", valore: "D" }] },
            null,
            { limite: 1, ordine: 3 }
        ]
    });
    assert.deepStrictEqual(filtri.filtriDaIncollare(testo), [{ limite: 2, ordine: 2, criteri: [{ chiave: "tema", operatore: "=", valore: "C" }] }]);
});

test("un limite che non e' un numero diventa 0, e un valore mancante diventa vuoto", () => {
    const testo = JSON.stringify({ filtri: [{ limite: null, criteri: [{ chiave: "tema", operatore: "=" }] }] });
    assert.deepStrictEqual(filtri.filtriDaIncollare(testo), [{ limite: 0, ordine: 1, criteri: [{ chiave: "tema", operatore: "=", valore: "" }] }]);
});

test("Copia filtri legge la finestra come la Conferma e salva nel localStorage del Plugin", () => {
    const copia = corpo("    copiaFiltri() {", "\n    async incollaFiltri() {");
    assert.match(copia, /const letti = this\.leggiFiltriFinestra\(\);/);
    assert.match(copia, /localStorage\.setItem\(filtri\.CHIAVE_COPIA_FILTRI, JSON\.stringify\(filtri\.confezionaCopiaFiltri\(letti,/);
    //Una finestra senza filtri non cancella quelli copiati prima.
    assert.ok(copia.indexOf("if (letti.length === 0) {") < copia.indexOf("localStorage.setItem("));
    assert.strictEqual(filtri.CHIAVE_COPIA_FILTRI, "filtriCopia");
});

test("Incolla filtri aggiunge in coda dalla strada dei filtri salvati, e non salva", () => {
    const incolla = corpo("    async incollaFiltri() {", "\n    righeProdottiFiltro(");
    assert.match(incolla, /filtri\.filtriDaIncollare\(testo\)/);
    assert.match(incolla, /await this\.addNewFiltro\(filtro, corpoFiltri\);/);
    assert.match(incolla, /if \(!this\.corpoFiltriAncoraAperto\(corpoFiltri\)\) \{\s*return;\s*\}/);
    assert.match(incolla, /Modali\.popup\('Errore', 'Nessun filtro copiato da incollare\.'\);/);
    assert.doesNotMatch(incolla, /salvaFiltri|writeFileSync|\.empty\(\)/);
});

test("la Conferma legge i filtri da leggiFiltriFinestra, solo dalla finestra aperta", () => {
    const salva = corpo("    salvaFiltri(){", "\n    leggiFiltriFinestra() {");
    assert.match(salva, /const filtri_arr = this\.leggiFiltriFinestra\(\);/);
    const leggi = corpo("    leggiFiltriFinestra() {", "\n    getNomeFileFiltriJson(){");
    assert.match(leggi, /this\.corpoFiltriAperto\(\)\.children\('\.filtro'\)\.each\(function \(\) \{/);
    assert.match(leggi, /return filtri_arr;/);
});

test("Copia filtri e Incolla filtri stanno nelle Opzioni avanzate della finestra dei filtri", () => {
    const avanzate = indexHtml.substring(indexHtml.indexOf('<div id="advancedOptionsFiltro"'), indexHtml.indexOf('<img src="images/sbloccaPaginaGrande.png" id="lockIcon"'));
    assert.match(avanzate, /onclick="filtriJs\.copiaFiltri\(\)">Copia filtri<\/button>/);
    assert.match(avanzate, /onclick="filtriJs\.incollaFiltri\(\)">Incolla filtri<\/button>/);
});

test("la barra in basso resta di tre pulsanti, cosi' Conferma non esce dal pannello", () => {
    const inizio = indexHtml.indexOf('<div id="buttonsFiltri"');
    const barra = indexHtml.substring(inizio, indexHtml.indexOf("</div>", inizio));
    assert.deepStrictEqual(barra.match(/<button id="[^"]+"/g), ['<button id="addFiltro"', '<button id="blocca/sbloccaPagina"', '<button id="confermaFiltri"']);
});

//Al 25% la terza riga restava tagliata sotto le prime due (prova dell'operatore): serve un terzo della finestra.
test("con le Opzioni avanzate aperte le tre righe hanno il 33% e l'elenco dei filtri il 57%", () => {
    assert.match(indexHtml, /<div id="advancedOptionsFiltro" style="height: 33%;/);
    const pulsante = indexHtml.substring(indexHtml.indexOf('<button name="advancedOptionFiltro"'), indexHtml.indexOf(">Opzioni avanzate</button>"));
    assert.match(pulsante, /\$\('#lockIcon'\)\.css\('height', '67%'\);\s*\$\('#bodyFiltri'\)\.css\('height', '57%'\);/);
    //Chiuse, le altezze tornano quelle di prima.
    assert.match(pulsante, /\$\('#lockIcon'\)\.css\('height', '100%'\);\s*\$\('#bodyFiltri'\)\.css\('height', '90%'\);/);
});

/* ---- prodotti sotto il filtro ---- */

test("un jolly mostra il suo prodotto, con codice e descrizione", () => {
    const righe = filtri.righeProdottiFiltro([record("9001", "Biscotti frollini", "500 g", 4)], []);
    assert.deepStrictEqual(righe, [{ codice: "9001", descrizione: "Biscotti frollini 500 g", impaginato: false, pagina: null }]);
    assert.strictEqual(filtri.testoProdottoFiltro(righe[0]), "9001: Biscotti frollini 500 g");
});

test("impaginati e non stanno insieme nell'ordine della lista, e gli impaginati dicono la pagina", () => {
    const impaginato = record("9002", "Pasta", null, 1);
    impaginato.paginaImpaginazione = "5";
    const righe = filtri.righeProdottiFiltro([record("9003", "Olio", "", 7), record("9001", "Caffe'", undefined, 0)], [impaginato]);
    assert.deepStrictEqual(righe.map(r => r.codice), ["9001", "9002", "9003"]);
    assert.strictEqual(filtri.testoProdottoFiltro(righe[1]), "9002: Pasta (pag. 5)");
    assert.strictEqual(filtri.testoProdottoFiltro(righe[2]), "9003: Olio");
});

test("un gruppo mostra la descrizione del gruppo, come i popup dei conteggi", () => {
    const gruppo = record("9001,9002", "Referenza singola", null, 0, { "Descrizioni.Descrizione1": "Yogurt assortiti", "Descrizioni.Descrizione2": "4 x 125 g" });
    assert.strictEqual(filtri.righeProdottiFiltro([gruppo], [])[0].descrizione, "Yogurt assortiti 4 x 125 g");
});

test("un impaginato senza pagina nota dice solo che e' impaginato", () => {
    const righe = filtri.righeProdottiFiltro([], [record("9001", "Riso", null, 0)]);
    assert.strictEqual(filtri.testoProdottoFiltro(righe[0]), "9001: Riso (impaginato)");
});

test("senza prodotti l'elenco e' vuoto", () => {
    assert.deepStrictEqual(filtri.righeProdottiFiltro([], []), []);
    assert.deepStrictEqual(filtri.righeProdottiFiltro(undefined, undefined), []);
});

test("si vedono i primi tre prodotti, gli altri dietro \"+ altri N\" che si apre e si richiude", () => {
    assert.strictEqual(filtri.PRODOTTI_VISIBILI_FILTRO, 3);
    assert.strictEqual(filtri.etichettaAltriProdotti(5, false), "+ altri 5");
    assert.strictEqual(filtri.etichettaAltriProdotti(5, true), "- nascondi");

    const mostra = corpo("    mostraProdottiFiltro(filtro, righe) {", "\n    bloccaSblocca(){");
    assert.match(mostra, /righe\.slice\(0, visibili\)/);
    assert.match(mostra, /const altri = righe\.slice\(visibili\);/);
    assert.match(mostra, /\.text\('Nessun prodotto'\)/);
    assert.match(mostra, /nascosti\.css\('display', aperti \? 'none' : 'block'\);/);
    assert.match(mostra, /voce\.text\(filtri\.etichettaAltriProdotti\(altri\.length, !aperti\)\);/);
});

test("il riquadro dei prodotti c'e' solo nella finestra del Menabo', e la ricerca lo riempie", () => {
    const addNewFiltro = corpo("    async addNewFiltro(filtro = null, alternativeBody = null, hideButtonsForTracciato = false, hideNarrow = false) {", "\n    addCriterio(");
    assert.match(addNewFiltro, /if \(!hideButtonsForTracciato\) \{\s*newFiltroDiv\.append\(\s*\$\('<div><\/div>'\)\s*\.addClass\('filtro-prodotti'\)/);
    const ricerca = corpo("    async ricercaFiltro(filtro){", "\n    async scorriFiltri(");
    assert.match(ricerca, /filtri\.mostraProdottiFiltro\(filtro, filtri\.righeProdottiFiltro\(risultati, risultatiImpaginati\)\);/);
    //Si aggiorna insieme ai conteggi, prima che la ricerca restituisca il risultato.
    assert.ok(ricerca.indexOf("filtri.mostraProdottiFiltro(") > ricerca.indexOf("'Elementi totali: '"));
    assert.ok(ricerca.indexOf("filtri.mostraProdottiFiltro(") < ricerca.indexOf("return objRes;"));
});
