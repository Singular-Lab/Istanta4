/*
 * I20-1071: una differenza di contenuto si legge, con il valore nel box e quello del dato.
 *
 * La preanalisi confrontava il testo del campo con il contenuto del dato e diceva solo
 * "contenuto": per capire cosa fosse cambiato l'operatore doveva andare a guardare. Ora la
 * differenza porta i due valori, leggibili senza i tag di stile, e la finestra della scheda ref
 * e il Report Integrita' li mostrano; un valore lungo e' abbreviato con i puntini e il testo
 * intero sta nel suggerimento.
 *
 * confronti.js si carica sotto Node: le due funzioni si provano direttamente, le finestre sul
 * sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- il testo leggibile ---- */

test("il contenuto del dato si legge senza i tag di stile", () => {
    const dato = "<DICITURA_Rep_21>Reparto Surgelati</DICITURA_Rep_21><A.DES_descr_nome_SC>Barattolino  Delizie</A.DES_descr_nome_SC><A.DES_descr_gr_SC>500 g</A.DES_descr_gr_SC>";

    assert.strictEqual(confronti.testoLeggibile(dato), "Reparto Surgelati Barattolino Delizie 500 g");
});

test("i tratti nascosti non ci sono, <br> e i ritorni a capo diventano uno spazio", () => {
    assert.strictEqual(confronti.testoLeggibile("<A.X_$Hidden>codice interno</A.X_$Hidden><A.DES>Barattolino<br>Delizie</A.DES>"), "Barattolino Delizie");
    assert.strictEqual(confronti.testoLeggibile("prima riga\r\nseconda riga terza"), "prima riga seconda riga terza");
    //I caratteri di controllo di InDesign (fine stile annidato, rientro) non si vedono.
    assert.strictEqual(confronti.testoLeggibile("al kg\u0003da € 21,75"), "al kg da € 21,75");
});

test("un campo del box, che tag non ne ha, resta com'e' a meno degli spazi", () => {
    assert.strictEqual(confronti.testoLeggibile("  al kg da € 21,75  a € 17,32 "), "al kg da € 21,75 a € 17,32");
    assert.strictEqual(confronti.testoLeggibile(null), "");
    assert.strictEqual(confronti.testoLeggibile(""), "");
    assert.strictEqual(confronti.testoLeggibile(12), "12");
});

/* ---- i valori di una differenza ---- */

test("una differenza senza valori non ne ha, una con valori li porta interi e brevi", () => {
    assert.strictEqual(confronti.valoriDifferenza({ label: "x", difference: "non presente" }), null);
    assert.strictEqual(confronti.valoriDifferenza(null), null);

    const valori = confronti.valoriDifferenza({ label: "descrizione", difference: "contenuto", valoreLocale: "panna cotta", valoreServer: "panna cotta variegata" });
    assert.deepStrictEqual(valori, {
        locale: { intero: "panna cotta", breve: "panna cotta", abbreviato: false },
        server: { intero: "panna cotta variegata", breve: "panna cotta variegata", abbreviato: false }
    });
});

test("un valore lungo si abbrevia con i puntini e l'intero resta per il suggerimento", () => {
    const lungo = "Barattolino Delizie panna cotta variegato al gusto mou con granella di croccante di mandorle";
    const valori = confronti.valoriDifferenza({ difference: "contenuto", valoreLocale: lungo, valoreServer: "" }, 30);

    assert.strictEqual(valori.locale.abbreviato, true);
    assert.strictEqual(valori.locale.breve, "Barattolino Delizie panna cot…");
    assert.ok(valori.locale.breve.length <= 30);
    assert.strictEqual(valori.locale.intero, lungo);
    //Un valore vuoto resta vuoto: lo dira' la riga.
    assert.deepStrictEqual(valori.server, { intero: "", breve: "", abbreviato: false });
    //Esattamente al limite non si abbrevia.
    assert.strictEqual(confronti.valoriDifferenza({ valoreLocale: "a".repeat(30), valoreServer: null }, 30).locale.abbreviato, false);
});

/* ---- dove nascono e dove si mostrano ---- */

test("la preanalisi allega i due valori alle differenze di contenuto e di paragrafo", () => {
    const testo = sorgente("confronti.js");
    const corpo = testo.substring(testo.indexOf("async confrontoBoxCompiledFieldPreAnalisi("), testo.indexOf("//cataloghiamo le foto presenti nel box1"));

    //Campi con stile di paragrafo e campi con stili di carattere: tutte e due le strade.
    assert.strictEqual((corpo.match(/difference: "contenuto",\s*valoreLocale: confronti\.testoLeggibile\(campoBox1\.contents\), valoreServer: confronti\.testoLeggibile\(compiledField\.content\)/g) || []).length, 2);
    assert.match(corpo, /difference: "paragrafo",\s*valoreLocale: campoBox1\.paragraphs\.item\(0\)\.appliedParagraphStyle\.name, valoreServer: \(stile != null && stile\.isValid \? stile\.name : compiledField\.paragraphName\)/);
    //Nessun "contenuto" rimasto senza valori.
    assert.strictEqual((corpo.match(/difference: "contenuto" \}/g) || []).length, 0);
});

test("la finestra della scheda e il report mostrano i valori, col testo intero nel suggerimento", () => {
    const scheda = sorgente("schedaRef.js");
    //I20-1075: nel riquadro dell'elemento i valori stanno sotto il problema.
    //TASK-4b0592eb: i pulsanti sulla riga del problema, nella sua testata, non sotto i valori.
    assert.match(scheda, /testata\.append\(sinistra\);\s*riga\.append\(testata\);\s*\/\/I20-1071[^\n]*\n\s*me\.aggiungiValoriDifferenza\(riga, diff\);\s*\/\/I20-1070[^\n]*\n\s*me\.aggiungiAzioniDifferenza\(riga, diff, dopoAzione\);/);
    assert.match(scheda, /const testata = \$\('<div class="testataDifferenza"><\/div>'\);\s*testata\.css\(\{ "display": "flex", "align-items": "flex-start", "gap": "8px" \}\);/);
    //A sinistra il titolo (sulla prima differenza) e il problema, che vanno a capo; il titolo non sta piu' sopra la testata.
    assert.match(scheda, /sinistra\.css\(\{ "flex": "1 1 auto", "min-width": "0" \}\);\s*if \(indice === 0\) \{\s*sinistra\.append\(titolo\);\s*\}\s*sinistra\.append\(problema\);/);
    assert.doesNotMatch(scheda, /riquadro\.append\(titolo\);/);
    const azioni = scheda.substring(scheda.indexOf("    aggiungiAzioniDifferenza(riga, diff, dopoAzione) {"), scheda.indexOf("    spegniSceltaDelBox("));
    assert.match(azioni, /var testata = riga\.children\("\.testataDifferenza"\)\.first\(\);/);
    assert.match(azioni, /\(testata\.length > 0 \? testata : riga\)\.append\(barra\);/);
    //A destra i pulsanti in colonna, vicini, con lo spazio che chiedono e senza il margine nativo.
    assert.match(azioni, /if \(testata\.length > 0\) \{\s*barra\.css\(\{ "display": "flex", "flex-direction": "column", "align-items": "stretch", "gap": "4px", "flex": "0 0 auto" \}\);/);
    assert.match(azioni, /if \(testata\.length > 0\) \{\s*barra\.children\(\)\.css\("margin", "0"\);\s*\}/);
    assert.doesNotMatch(azioni, /^\s*riga\.append\(barra\);/m);
    const membroScheda = scheda.substring(scheda.indexOf("    aggiungiValoriDifferenza(riga, diff) {"), scheda.indexOf("/* ---------- I20-1070"));
    assert.match(membroScheda, /const valori = confronti\.valoriDifferenza\(diff\);/);
    //TASK-4b0592eb: box e server in due colonne, con gli a capo; le etichette dei meta restano in grassetto.
    assert.match(membroScheda, /if \(valoriMeta\.length === 0\) \{\s*this\.aggiungiColonneBoxServer\(riga, confronti\.righeAConfronto\(diff\)\);\s*return;/);
    assert.match(membroScheda, /etichetta\.css\(\{ "font-weight": "700"/);
    //I valori partono dallo stesso punto: le etichette stanno in una colonna di larghezza fissa.
    assert.match(membroScheda, /etichetta\.css\(\{ "font-weight": "700", "color": "#2c2c2c", "flex": "0 0 76px" \}\);/);
    assert.match(membroScheda, /valore\.css\(\{ "flex": "1 1 auto", "min-width": "0" \}\);/);
    assert.match(membroScheda, /if \(coppia\[1\]\.abbreviato\) \{\s*Tooltip\.impostaTooltip\(valore\[0\], coppia\[1\]\.intero\);/);
    assert.doesNotMatch(membroScheda, /\.title\s*=/);

    const pannelli = sorgente("reportIntegrita/pannelli.js");
    assert.match(pannelli, /diffRow\.textContent = diff\?\.difference \|\| "-";\s*\}\s*\/\/I20-1071[^\n]*\n\s*this\.aggiungiValoriDifferenzaNelReport\(diffRow, diff\);/);
    const membroReport = pannelli.substring(pannelli.indexOf("    aggiungiValoriDifferenzaNelReport(riga, diff) {"), pannelli.indexOf("    _crRiquadroConfronto(differenze) {"));
    assert.match(membroReport, /const valori = confronti\.valoriDifferenza\(diff\);/);
    assert.match(membroReport, /if \(coppia\[1\]\.abbreviato\) \{\s*Tooltip\.impostaTooltip\(valore, coppia\[1\]\.intero\);/);
    assert.doesNotMatch(membroReport, /\.title\s*=/);
});

/* ---- TASK-4b0592eb: box e server in colonne, con gli a capo ---- */

test("i valori a righe tengono gli a capo del box e del dato, senza tag", () => {
    //Il box: ritorni di paragrafo e a capo forzati di InDesign.
    assert.deepStrictEqual(confronti.righeLeggibili("Mele melinda\r250g\u2028a conf."), ["Mele melinda", "250g", "a conf."]);
    assert.deepStrictEqual(confronti.righeLeggibili("Mele melinda\n250g"), ["Mele melinda", "250g"]);
    //Il dato: i <br>, i tag tolti, i tratti nascosti fuori, gli spazi compattati, niente righe vuote.
    assert.deepStrictEqual(
        confronti.righeLeggibili("<A.DES_descr_nome>Mele   melinda</A.DES_descr_nome><br><A.X_$Hidden>interno</A.X_$Hidden><A.DES_descr_gr>250g a conf.</A.DES_descr_gr><br/>"),
        ["Mele melinda", "250g a conf."]);
    assert.deepStrictEqual(confronti.righeLeggibili(""), []);
    assert.deepStrictEqual(confronti.righeLeggibili(null), []);
});

test("in colonne le righe del box e del server si affiancano una per una", () => {
    const diff = { label: "descrizione", difference: "contenuto", valoreLocale: "Mele melinda 250g a conf.", valoreServer: "Mele melinda 250g a conf.",
        righeLocale: ["Mele melinda", "250g", "a conf."], righeServer: ["Mele melinda", "250g a conf."] };
    assert.deepStrictEqual(confronti.righeAConfronto(diff), [["Mele melinda", "Mele melinda"], ["250g", "250g a conf."], ["a conf.", ""]]);
});

test("in colonne una differenza senza righe sta su una riga, e un valore vuoto si dice", () => {
    assert.deepStrictEqual(confronti.righeAConfronto({ difference: "paragrafo", valoreLocale: "DES_A", valoreServer: "DES_B" }), [["DES_A", "DES_B"]]);
    assert.deepStrictEqual(confronti.righeAConfronto({ difference: "contenuto", valoreLocale: "", valoreServer: "x", righeLocale: [], righeServer: ["x"] }), [["(vuoto)", "x"]]);
    assert.strictEqual(confronti.righeAConfronto({ difference: "non presente" }), null);
    assert.strictEqual(confronti.righeAConfronto(null), null);
});

test("le differenze di contenuto portano le righe, per le colonne della finestra", () => {
    const corpo = sorgente("confronti.js").replace(/\r/g, "");
    assert.strictEqual((corpo.match(/righeLocale: confronti\.righeLeggibili\(campoBox1\.contents\), righeServer: confronti\.righeLeggibili\(compiledField\.content\)/g) || []).length, 2);
});

test("la finestra della scheda mette Box e Server in due colonne, e un testo lungo va a capo senza puntini", () => {
    const scheda = sorgente("schedaRef.js").replace(/\r/g, "");
    const colonne = scheda.substring(scheda.indexOf("    aggiungiColonneBoxServer(riga, righe) {"), scheda.indexOf("/* ---------- I20-1070"));
    assert.match(colonne, /colonne\.append\(rigaDiColonne\("Box:", "Server:", true\)\);/);
    assert.match(colonne, /righe\.forEach\(function \(coppia\) \{\s*colonne\.append\(rigaDiColonne\(coppia\[0\], coppia\[1\], false\)\);/);
    assert.match(colonne, /"white-space": "normal", "overflow-wrap": "anywhere"/);
    assert.doesNotMatch(colonne, /…|abbreviato/);
});

test("l'anteprima del server: a ogni casella il testo del suo stile, nell'ordine, vuoto se il server non lo compone", () => {
    const server = "<A.DES_descr_nome>Kaki</A.DES_descr_nome><A.DES_descr_marca>CONAD<br>Percorso Qualità</A.DES_descr_marca>" +
        "<A.DES_descr_tipo>Origine Italia</A.DES_descr_tipo><A.DES_descr_gr_$Hidden>al kg</A.DES_descr_gr_$Hidden>";
    assert.deepStrictEqual(
        confronti.testiDelServerPerCaselle(["A.DES_descr_nome", "DES_descr_marca", "A.DES_descr_tipo", "A.DES_descr_gr"], server),
        ["Kaki", "CONAD\nPercorso Qualità", "Origine Italia", ""]);
    //Lo stesso stile due volte: la seconda casella prende il secondo blocco, la terza niente.
    assert.deepStrictEqual(
        confronti.testiDelServerPerCaselle(["A.T", "A.T", "A.T"], "<A.T>uno</A.T><A.B>marca</A.B><A.T>due</A.T>"),
        ["uno", "due", ""]);
    assert.deepStrictEqual(confronti.testiDelServerPerCaselle(["A.T"], null), [""]);
    assert.deepStrictEqual(confronti.testiDelServerPerCaselle(null, "<A.T>uno</A.T>"), []);
});
