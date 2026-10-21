/*
 * I20-1121: la vista affiancata del pannello, comune alle segnalazioni e al Report Integrita'.
 *
 * Con il pannello largo almeno 924 px (misurati dall'operatore: il Plugin a 524 e una colonna
 * accanto) una schermata si apre come colonna fissa a destra e il Plugin resta a sinistra, largo
 * 524. Le regole erano nate in segnalazioni/schermata.js (I20-1116, soglia 1048) e sono passate in
 * plugin/vistaAffiancata.js: questi controlli vengono da schermataSegnalazioni.test.js.
 *
 * vistaAffiancata.js si carica sotto Node; jQuery e document si fingono.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const VistaAffiancata = require("../../plugin/vistaAffiancata");

test("da 924 px di pannello si affianca, sotto resta il popup", () => {
    assert.strictEqual(VistaAffiancata.SOGLIA, 924);
    assert.strictEqual(VistaAffiancata.forma(524), "popup");
    assert.strictEqual(VistaAffiancata.forma(923), "popup");
    assert.strictEqual(VistaAffiancata.forma(924), "colonna");
    assert.strictEqual(VistaAffiancata.forma(1600), "colonna");
    //Senza misura (0) resta il popup di sempre.
    assert.strictEqual(VistaAffiancata.forma(0), "popup");
    //La colonna comincia dopo il Plugin di sinistra e il margine del corpo.
    assert.strictEqual(VistaAffiancata.inizioColonna(), 532);
});

test("la larghezza del pannello e' quella del documento: in UXP window.innerWidth non c'e'", () => {
    const prima = { window: global.window, document: global.document };
    global.window = {};
    global.document = { documentElement: { clientWidth: 924 }, body: { clientWidth: 908 } };
    try {
        assert.strictEqual(VistaAffiancata.larghezzaPannello(), 924);
        global.window = { innerWidth: 1000 };
        assert.strictEqual(VistaAffiancata.larghezzaPannello(), 1000);
        global.window = {};
        global.document = { documentElement: { clientWidth: 0 }, body: null };
        assert.strictEqual(VistaAffiancata.larghezzaPannello(), 0);
    }
    finally {
        global.window = prima.window;
        global.document = prima.document;
    }
});

test("a sinistra le barre fisse prendono la larghezza minima del pannello", () => {
    assert.deepStrictEqual(VistaAffiancata.confinamenti(), [
        { selettore: "#wrapper", larghezza: 524 },
        { selettore: "#header", larghezza: 524 },
        { selettore: "#footerRef", larghezza: 524 },
        { selettore: "#footer", larghezza: 514 },
        { selettore: "#messaggiUtente", larghezza: 498 }
    ]);
});

test("chiusa l'ultima colonna le barre tornano alla larghezza di prima", () => {
    const elementi = {};
    VistaAffiancata.confinamenti().forEach(voce => { elementi[voce.selettore] = { style: { width: "100%" } }; });
    elementi["#messaggiUtente"].style.width = "95%";
    const prima = global.document;
    global.document = { querySelector: (sel) => elementi[sel] || null };
    try {
        VistaAffiancata._confina(true);
        assert.strictEqual(elementi["#header"].style.width, "524px");
        assert.strictEqual(elementi["#footer"].style.width, "514px");
        //Una seconda volta non cambia la larghezza da rimettere.
        VistaAffiancata._confina(true);
        VistaAffiancata._confina(false);
        assert.strictEqual(elementi["#header"].style.width, "100%");
        assert.strictEqual(elementi["#wrapper"].style.width, "100%");
        assert.strictEqual(elementi["#messaggiUtente"].style.width, "95%");
    }
    finally {
        global.document = prima;
        VistaAffiancata._confinati = null;
    }
});

test("il Plugin torna a tutta larghezza solo quando non resta nessuna colonna aperta", () => {
    const prima = { $: global.$, colonne: VistaAffiancata._colonne, confina: VistaAffiancata._confina };
    const aperte = new Set(["#colonnaSegnalazioni", "#colonnaReportIntegrita"]);
    const confinamenti = [];
    VistaAffiancata._colonne = ["colonnaSegnalazioni", "colonnaReportIntegrita"];
    VistaAffiancata._confina = (confina) => confinamenti.push(confina);
    global.$ = (sel) => ({ length: aperte.has(sel) ? 1 : 0, remove: () => aperte.delete(sel) });
    try {
        assert.strictEqual(VistaAffiancata.colonnaAperta(), true);
        assert.strictEqual(VistaAffiancata.altraColonnaAperta("colonnaSegnalazioni"), true);

        assert.strictEqual(VistaAffiancata.togliColonna("colonnaSegnalazioni"), true);
        //Resta il report: a sinistra si resta confinati.
        assert.deepStrictEqual(confinamenti, []);
        assert.strictEqual(VistaAffiancata.altraColonnaAperta("colonnaReportIntegrita"), false);
        assert.strictEqual(VistaAffiancata.colonnaAperta("colonnaReportIntegrita"), true);

        assert.strictEqual(VistaAffiancata.togliColonna("colonnaReportIntegrita"), true);
        assert.deepStrictEqual(confinamenti, [false]);
        assert.strictEqual(VistaAffiancata.colonnaAperta(), false);
        //Una colonna che non c'e' non si toglie due volte.
        assert.strictEqual(VistaAffiancata.togliColonna("colonnaReportIntegrita"), false);
    }
    finally {
        global.$ = prima.$;
        VistaAffiancata._colonne = prima.colonne;
        VistaAffiancata._confina = prima.confina;
    }
});

test("il guscio della colonna: fissa a destra, titolo e conteggio staccati da un margine, X che chiama alChiudi", () => {
    const codice = leggiFileDelPlugin("vistaAffiancata.js").replace(/\r/g, "");
    assert.match(codice, /position: 'fixed', top: '0px', bottom: '0px', right: '0px', left: VistaAffiancata\.inizioColonna\(\) \+ 'px'/);
    //UXP ignora gap: fra titolo e conteggio un margine vero.
    assert.match(codice, /\.text\(opzioni\.titolo \|\| ""\)\.css\(\{[^}]*marginRight: '10px' \}\)/);
    assert.match(codice, /opzioni\.alChiudi\(\);/);
    assert.match(codice, /VistaAffiancata\._confina\(true\);\s*return \{ colonna: colonna, testata: testata, corpo: corpo \};/);
    //Non dipende da InDesign: si carica sotto Node. (L'intestazione lo cita: si guarda il codice.)
    assert.doesNotMatch(codice.replace(/\/\*[\s\S]*?\*\//g, ""), /require\(['"]indesign['"]\)/);
});

test("segnalazioni e report usano la stessa vista affiancata, e il ciclo degli eventi guarda il pannello", () => {
    const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
    assert.match(schermata, /const VistaAffiancata = require\('\.\.\/vistaAffiancata'\);/);
    //Niente piu' soglie e misure proprie.
    assert.doesNotMatch(schermata, /SOGLIA_AFFIANCATA|LARGHEZZA_SINISTRA|_confinaPannello/);

    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    assert.match(report, /const VistaAffiancata = require\('\.\.\/vistaAffiancata'\);/);

    const eventi = leggiFileDelPlugin("events.js").replace(/\r/g, "");
    assert.match(eventi, /VistaAffiancata\.larghezzaPannello\(\) != lastPannelloDimension\)\)\{\s*onresizeWindow\(\);/);
});
