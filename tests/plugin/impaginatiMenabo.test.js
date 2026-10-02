/*
 * I20-1031: nella griglia del Menabo' (scheda Filtri) una colonna "Impaginate" dice, pagina per
 * pagina, quanti box risultano impaginati secondo Istanta (Menabo/getListaImpaginati, una
 * presenza per box). Serve a confrontare il dato con quello che si vede in pagina: box da
 * ricollegare, o cancellati a mano mentre il dato li da' ancora impaginati.
 *
 * filtri.js e utility.js non si caricano sotto Node. La funzione che raggruppa per pagina e'
 * pura: la si estrae dal sorgente e la si prova davvero; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

//Il corpo di un membro dell'oggetto: dall'intestazione alla chiusura "    }," a quattro spazi.
function corpoMembro(sorgente, intestazione) {
    const inizio = sorgente.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovato: il test va aggiornato");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    assert.notStrictEqual(fine, -1, intestazione + " senza fine");
    return sorgente.substring(inizio, fine);
}

//impaginatiPerPagina e' pura: la si ricostruisce dal sorgente e la si chiama.
const impaginatiPerPagina = (function () {
    const membro = corpoMembro(filtri, "    impaginatiPerPagina(lista) {");
    const corpo = membro.substring(membro.indexOf("{") + 1);
    return new Function("lista", corpo);
})();

/* ---- il raggruppamento per pagina ---- */

test("le presenze si raggruppano per pagina, una per box", () => {
    const lista = [
        { codiceGruppo: "A", idRec: 1, nomePagina: "5" },
        { codiceGruppo: "B", idRec: 2, nomePagina: "5" },
        { codiceGruppo: "A", idRec: 3, nomePagina: "7" }
    ];

    const perPagina = impaginatiPerPagina(lista);

    assert.deepStrictEqual(Object.keys(perPagina).sort(), ["5", "7"]);
    assert.strictEqual(perPagina["5"].length, 2);
    assert.strictEqual(perPagina["7"].length, 1);
    assert.strictEqual(perPagina["7"][0].idRec, 3);
});

test("lo stesso codice in due box della stessa pagina conta due volte", () => {
    const perPagina = impaginatiPerPagina([
        { codiceGruppo: "A", idRec: 1, nomePagina: "3" },
        { codiceGruppo: "A", idRec: 2, nomePagina: "3" }
    ]);

    assert.strictEqual(perPagina["3"].length, 2);
});

test("la pagina numerica e quella testuale sono la stessa riga", () => {
    const perPagina = impaginatiPerPagina([
        { codiceGruppo: "A", idRec: 1, nomePagina: 9 },
        { codiceGruppo: "B", idRec: 2, nomePagina: "9" }
    ]);

    assert.strictEqual(perPagina["9"].length, 2);
});

test("le voci senza pagina, nulle o non valide si scartano", () => {
    const perPagina = impaginatiPerPagina([
        null,
        { codiceGruppo: "A", idRec: 1, nomePagina: "" },
        { codiceGruppo: "B", idRec: 2, nomePagina: null },
        { codiceGruppo: "C", idRec: 3 },
        { codiceGruppo: "D", idRec: 4, nomePagina: "2" }
    ]);

    assert.deepStrictEqual(Object.keys(perPagina), ["2"]);
});

test("una lista vuota, null o non lista non da' pagine", () => {
    assert.deepStrictEqual(impaginatiPerPagina([]), {});
    assert.deepStrictEqual(impaginatiPerPagina(null), {});
    assert.deepStrictEqual(impaginatiPerPagina({ nomePagina: "1" }), {});
});

/* ---- la colonna nella griglia ---- */

test("l'intestazione ha Impaginate subito dopo N. ref, le altre colonne restano come prima e la somma e' 110", () => {
    const inizio = filtri.indexOf("        const headers = [");
    const fine = filtri.indexOf("        ];", inizio);
    const intestazioni = [...filtri.substring(inizio, fine).matchAll(/\{ text: '([^']+)', width: '(\d+)%' \}/g)]
        .map(m => ({ testo: m[1], larghezza: Number(m[2]) }));

    const testi = intestazioni.map(h => h.testo);
    assert.strictEqual(testi.indexOf("Impaginate"), testi.indexOf("N. ref") + 1);
    assert.deepStrictEqual(intestazioni.map(h => h.larghezza), [10, 10, 10, 10, 10, 10, 10, 13, 13, 14]);
    //Piu' di 100: la griglia e' larga quanto le colonne e scorre con la barra.
    assert.strictEqual(intestazioni.reduce((somma, h) => somma + h.larghezza, 0), 110);
});

test("nelle righe della griglia le colonne non si sono strette", () => {
    const inizio = filtri.indexOf("        // adesso in pagina creeremo un header con i seguenti campi");
    const fine = filtri.indexOf("            righeGriglia.append(row);", inizio);
    const griglia = filtri.substring(inizio, fine);

    assert.doesNotMatch(griglia, /width: '(9|12)%'/);
    assert.match(corpoMembro(filtri, "    cellaImpaginati(impaginatiPerPagina, nomePagina) {"), /width: '10%'/);
});

test("gli impaginati si chiedono una volta per ridisegno, prima delle righe", () => {
    const inizio = filtri.indexOf("    async visualizzaHomePageFiltri(){");
    const fine = filtri.indexOf("            righeGriglia.append(row);", inizio);
    const corpo = filtri.substring(inizio, fine);

    const chiamata = "await Utility.getListaCodiciImpaginati({ nullSeFallisce: true });";
    assert.strictEqual(corpo.split(chiamata).length - 1, 1);
    assert.ok(corpo.indexOf(chiamata) < corpo.indexOf("const row = $('<div></div>')"), "la chiamata va prima del ciclo delle righe");
    assert.match(corpo, /listaImpaginati != null \? filtri\.impaginatiPerPagina\(listaImpaginati\) : null/);
});

test("la cella Impaginate sta fra N. ref e Ref. Avanzate", () => {
    const inizio = filtri.indexOf("            //nella quinta colonna mettiamo il numero di riferimenti conteggiati");
    const cella = filtri.indexOf("row.append(filtri.cellaImpaginati(impaginatiPerPagina, pagine[i].name));", inizio);
    const avanzate = filtri.indexOf("            //nella sesta colonna", inizio);

    assert.ok(inizio >= 0 && cella > inizio && avanzate > cella);
});

test("la cella dice ? se Istanta non ha risposto, Nessuna se non ce ne sono, altrimenti il numero cliccabile", () => {
    const cella = corpoMembro(filtri, "    cellaImpaginati(impaginatiPerPagina, nomePagina) {");

    assert.match(cella, /if \(impaginatiPerPagina == null\) \{[\s\S]*?\.text\('\?'\)/);
    assert.match(cella, /\.text\('Nessuna'\)/);
    assert.match(cella, /\.text\('' \+ impaginati\.length\)/);
    assert.match(cella, /\.on\('click', \(\) => filtri\.mostraImpaginatiPagina\(nomePagina, impaginati\)\)/);
});

test("l'elenco del popup mette i codici come testo, non come html", () => {
    const elenco = corpoMembro(filtri, "    mostraImpaginatiPagina(nomePagina, impaginati) {");

    assert.match(elenco, /\.text\(testo\)/);
    assert.doesNotMatch(elenco, /\.html\(/);
    assert.match(elenco, /Modali\.popup\(/);
});

/* ---- la barra orizzontale della griglia ---- */

//Replica di quella dei Nuovi (reportIntegrita/pannelli.js) e della Home (indexNew.js): stessi
//controlli che reportIntegritaFlusso.test.js fa sulla barra dei Nuovi, piu' quelli della griglia.

test("intestazione e righe sono larghe quanto le colonne, dentro involucri che le tagliano", () => {
    assert.match(filtri, /const intestazioneVisibile = \$\('<div><\/div>'\)\.css\(\{ marginRight: '5px', width: '97%', overflow: 'hidden' \}\);/);
    assert.match(filtri, /attr\('id', 'filtriIntestazioneGriglia'\)\.css\(\{backgroundColor: 'blue', display: 'flex', width: '110%'\}\)/);
    assert.match(filtri, /const righeVisibili = \$\('<div><\/div>'\)\.css\(\{ marginRight: '5px', width: '99%', overflow: 'hidden' \}\);/);
    assert.match(filtri, /attr\('id', 'filtriRigheGriglia'\)\.css\(\{ width: '110%' \}\)/);
    //Le righe entrano nell'involucro interno, che sta dentro #filtriBodyGriglia: la barra verticale non si sposta.
    assert.match(filtri, /bodyDiv\.append\(righeVisibili\);/);
    assert.match(filtri, /righeGriglia\.append\(row\);/);
    assert.doesNotMatch(filtri, /bodyDiv\.append\(row\);/);
});

test("la barra funziona anche senza trascinamento, come quella dei Nuovi", () => {
    const barra = corpoMembro(filtri, "    _crBarraScorrimentoGriglia(state) {");

    assert.match(barra, /indietro\.addEventListener\("click"/);
    assert.match(barra, /avanti\.addEventListener\("click"/);
    assert.match(barra, /traccia\.addEventListener\("click"/);
    assert.match(barra, /cursore\.addEventListener\("mousedown"/);
    assert.match(barra, /barraScorrimento\.spostamentoDaClic/);
    //La griglia si ridisegna a ogni cambio di filtro: lo spostamento non si azzera.
    assert.doesNotMatch(barra, /state\.spostamento = 0/);
    assert.match(filtri, /const barraScorrimento = require\('\.\/reportIntegrita\/barraScorrimento'\);/);
    assert.match(filtri, /PASSO_SCORRIMENTO_GRIGLIA: 160,/);
});

test("scorrere sposta intestazione e righe dello stesso margine, dentro i limiti", () => {
    const scorri = corpoMembro(filtri, "    _scorriGriglia(state, spostamento) {");

    assert.match(scorri, /barraScorrimento\.limitaSpostamento/);
    assert.match(scorri, /righe\.style\.marginLeft = "-" \+ state\.spostamento \+ "px"/);
    assert.match(scorri, /intestazione\.style\.marginLeft = "-" \+ state\.spostamento \+ "px"/);

    //Il contenuto e' la larghezza calcolata delle colonne, come state.larghezzaTotale del Report:
    //misurata subito dopo averla scritta, UXP dava ancora quella vecchia e la barra restava nascosta.
    const misure = corpoMembro(filtri, "    _misureScorrimentoGriglia(state) {");
    assert.match(misure, /contenuto = state\?\.larghezzaTotale \|\| righe\?\.scrollWidth \|\| 0;/);
    assert.match(misure, /righe\?\.parentNode\?\.clientWidth/);
    assert.match(corpoMembro(filtri, "    _applicaLarghezzeGriglia(intestazione, righe) {"),
        /filtri\.statoBarraGriglia\.larghezzaTotale = larghezze\.reduce\(/);
});

test("il trascinamento si ascolta sul documento, una volta sola", () => {
    const trascinamento = corpoMembro(filtri, "    _abilitaTrascinamentoBarraGriglia() {");

    assert.match(trascinamento, /if \(filtri\._trascinamentoBarraGrigliaAttivo\) \{\s*return;/);
    assert.match(trascinamento, /\$\(document\)\.on\("mousemove"/);
    assert.match(trascinamento, /\$\(document\)\.on\("mouseup"/);
    assert.match(trascinamento, /barraScorrimento\.spostamentoDaTrascinamento/);
});

test("la barra nasce sotto la griglia e, dopo il ridisegno, la griglia torna dove dice lo spostamento", () => {
    const inizio = filtri.indexOf("    async visualizzaHomePageFiltri(){");
    const corpo = filtri.substring(inizio, filtri.indexOf("\n    },\n", inizio));

    const corpoGriglia = corpo.indexOf("$('#filtriBody').append(bodyDiv);");
    const barra = corpo.indexOf("$('#filtriBody').append(filtri._crBarraScorrimentoGriglia(filtri.statoBarraGriglia));");
    const righe = corpo.indexOf("righeGriglia.append(row);");
    const scorri = corpo.indexOf("filtri._scorriGriglia(filtri.statoBarraGriglia, filtri.statoBarraGriglia.spostamento || 0);");

    assert.ok(corpoGriglia >= 0 && barra > corpoGriglia, "la barra va sotto la griglia");
    assert.ok(righe >= 0 && scorri > righe, "lo spostamento si riapplica dopo le righe");
});

test("l'altezza della griglia lascia posto alla barra, quando la barra si vede", () => {
    const altezza = corpoMembro(filtri, "    altezzaBarraGriglia() {");
    assert.match(altezza, /barra == null \|\| barra\.style\.display === "none"\) \{\s*return 0;/);

    const indexNew = leggiFileDelPlugin("indexNew.js");
    assert.match(indexNew, /\$\("#filtriBodyGriglia"\)\.css\("height", "" \+ \(altezzaResRef - 10 - altezzaHeaderFiltri - filtriJs\.altezzaBarraGriglia\(\)\) \+ "px"\);/);
});

/* ---- le colonne in pixel ---- */

//In UXP una larghezza in percentuale oltre il 100% non allarga la griglia, e le celle flex si
//restringono: in collaudo le colonne restavano strette e la barra non compariva. Le larghezze si
//scrivono in pixel, su ogni cella, e le celle non si restringono.
const larghezzeColonneGriglia = (function () {
    const membro = corpoMembro(filtri, "    larghezzeColonneGriglia(visibile, minimi) {");
    return new Function("visibile", "minimi", membro.substring(membro.indexOf("{") + 1));
})();

//I minimi dopo il collaudo: 10 px in meno per colonna rispetto ai primi.
const MINIMI = [50, 50, 60, 80, 50, 110, 90, 110, 110, 120];

test("su un pannello stretto le colonne restano ai minimi, e superano lo spazio: la barra serve", () => {
    const larghezze = larghezzeColonneGriglia(499, MINIMI);

    assert.deepStrictEqual(larghezze, MINIMI);
    assert.strictEqual(larghezze.reduce((a, b) => a + b, 0), 830);
});

test("su un pannello largo le colonne si allargano fino a riempirlo esattamente: la barra non serve", () => {
    const larghezze = larghezzeColonneGriglia(1000, MINIMI);

    assert.strictEqual(larghezze.reduce((a, b) => a + b, 0), 1000);
    larghezze.forEach((larghezza, c) => assert.ok(larghezza >= MINIMI[c], "colonna " + c + " sotto il minimo"));
});

test("quando lo spazio e' esattamente la somma dei minimi, restano i minimi", () => {
    assert.deepStrictEqual(larghezzeColonneGriglia(830, MINIMI), MINIMI);
});

test("i minimi sono quelli del collaudo, 10 px in meno dei primi", () => {
    assert.match(filtri, /MINIMI_COLONNE_GRIGLIA: \[50, 50, 60, 80, 50, 110, 90, 110, 110, 120\],/);
    assert.doesNotMatch(filtri, /PERCENTUALI_COLONNE_GRIGLIA/);
    assert.match(corpoMembro(filtri, "    _applicaLarghezzeGriglia(intestazione, righe) {"),
        /filtri\.larghezzeColonneGriglia\(righe\.parentNode\.clientWidth, filtri\.MINIMI_COLONNE_GRIGLIA\)/);
});

test("senza una larghezza visibile non si scrive niente", () => {
    assert.strictEqual(larghezzeColonneGriglia(0, MINIMI), null);
    assert.strictEqual(larghezzeColonneGriglia(undefined, MINIMI), null);
    assert.strictEqual(larghezzeColonneGriglia(500, null), null);
    assert.strictEqual(larghezzeColonneGriglia(500, []), null);
});

test("al ridimensionamento del pannello la griglia si ricalcola, come la lista della Home", () => {
    const aggiorna = corpoMembro(filtri, "    aggiornaBarraGriglia() {");
    assert.match(aggiorna, /filtri\._applicaLarghezzeGriglia\(document\.getElementById\("filtriIntestazioneGriglia"\), righe\);/);
    assert.match(aggiorna, /filtri\._scorriGriglia\(filtri\.statoBarraGriglia, filtri\.statoBarraGriglia\.spostamento \|\| 0\);/);

    //In onresizeWindow, prima di dare l'altezza alla griglia: l'altezza dipende da se la barra si vede.
    const indexNew = leggiFileDelPlugin("indexNew.js");
    const ricalcolo = indexNew.indexOf("filtriJs.aggiornaBarraGriglia();");
    const altezza = indexNew.indexOf('$("#filtriBodyGriglia").css("height"');
    assert.ok(ricalcolo >= 0 && altezza > ricalcolo);
});

test("ogni cella riceve i suoi pixel e non si restringe, intestazione compresa", () => {
    const applica = corpoMembro(filtri, "    _applicaLarghezzeGriglia(intestazione, righe) {");

    assert.match(applica, /width: larghezze\[c\] \+ "px", minWidth: larghezze\[c\] \+ "px", maxWidth: larghezze\[c\] \+ "px", flexShrink: "0"/);
    assert.match(applica, /\$\(righe\)\.css\(\{ width: totale \}\);/);
    assert.match(applica, /applicaAllaRiga\(intestazione\);/);
});

test("dopo il ridisegno prima le larghezze in pixel, poi lo spostamento", () => {
    const inizio = filtri.indexOf("    async visualizzaHomePageFiltri(){");
    const corpo = filtri.substring(inizio, filtri.indexOf("\n    },\n", inizio));

    const larghezze = corpo.indexOf('filtri._applicaLarghezzeGriglia(document.getElementById("filtriIntestazioneGriglia"), document.getElementById("filtriRigheGriglia"));');
    const scorri = corpo.indexOf("filtri._scorriGriglia(filtri.statoBarraGriglia, filtri.statoBarraGriglia.spostamento || 0);");
    assert.ok(larghezze >= 0 && scorri > larghezze);
});

/* ---- utility.getListaCodiciImpaginati ---- */

test("con nullSeFallisce la chiamata fallita restituisce null; senza, come prima, una lista vuota", () => {
    const inizio = utility.indexOf("    async getListaCodiciImpaginati(opzioni = {}){");
    assert.ok(inizio >= 0, "manca l'opzione");
    const corpo = utility.substring(inizio, utility.indexOf("\n    },\n", inizio));

    //Errore e tempo scaduto: i due casi in cui oggi tornava [].
    assert.strictEqual(corpo.split("return opzioni.nullSeFallisce ? null : [];").length - 1, 2);
    //Chi la chiama senza opzioni - la ricerca dei filtri, il tracciato della Home - non cambia.
    assert.match(leggiFileDelPlugin("filtri.js"), /let listImpaginati = await Utility\.getListaCodiciImpaginati\(\);/);
});
