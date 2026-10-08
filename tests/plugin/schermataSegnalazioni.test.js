/*
 * I20-1029, lotto 2: la schermata delle segnalazioni di impaginazione e "Risolvi".
 *
 * Un popup legge i bollini del documento e mostra le segnalazioni per pagina e per box, con "Vai
 * al box", "Risolvi" per una segnalazione e "Risolvi tutte" (con conferma) per il box. Si apre dal
 * pulsante "Segnalazioni" in Menabo' -> Filtri e da sola a fine impaginazione (Volantino, PoP,
 * impaginazione singola), non dopo Fix referenza, non dentro il giro di un libro e non dalle
 * operazioni massive del Report Integrita'.
 *
 * etichetta.js e segnalazioni.js si provano davvero (box finti); di schermata.js si provano le
 * parti pure e si controlla il resto sul sorgente, come di indexNew.js e index.html.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const etichetta = require("../../plugin/segnalazioni/etichetta");
const Segnalazioni = require("../../plugin/segnalazioni/segnalazioni");
const SchermataSegnalazioni = require("../../plugin/segnalazioni/schermata");

//Un box finto con il suo bollino; addBollinoCustom finto che ridisegna l'ovale.
function boxConBollino(voci) {
    const box = { label: "BOX12", allPageItems: [] };
    const aggiungi = (label) => {
        const ovale = { label: label };
        ovale.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== ovale); };
        box.allPageItems.push(ovale);
    };
    box.allPageItems.push({ label: "descrizione$DNA$BOX12$1$2$3", remove() {} });
    if (voci != null) {
        aggiungi(etichetta.scrivi(voci));
    }
    return { box, aggiungi };
}

function conBollinoFinto(fn) {
    const chiamate = [];
    global.Utility = {
        addBollinoCustom(box, testo, colore, gradiente, posizione, bounds, overflow, etichettaBollino) {
            chiamate.push({ colore, etichettaBollino });
            const ovale = { label: etichettaBollino };
            ovale.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== ovale); };
            box.allPageItems.push(ovale);
            return box;
        }
    };
    try {
        fn(chiamate);
    }
    finally {
        delete global.Utility;
    }
}

const DUE = [
    { g: "error", c: "CSF-009", t: "oltre la griglia" },
    { g: "warning", c: "CSF-013", t: "conflitto" }
];

/* ---- Risolvi ---- */

test("senzaVoce toglie solo quella voce, e un indice fuori elenco non toglie niente", () => {
    assert.deepStrictEqual(etichetta.senzaVoce(DUE, 0), [DUE[1]]);
    assert.deepStrictEqual(etichetta.senzaVoce(DUE, 5), DUE);
    assert.deepStrictEqual(etichetta.senzaVoce(null, 0), []);
});

test("risolvere l'errore lascia il warning, e il bollino diventa arancione", () => {
    conBollinoFinto(chiamate => {
        const { box } = boxConBollino(DUE);

        Segnalazioni.risolviVoce(box, 0);

        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ["CSF-013"]);
        assert.strictEqual(chiamate.length, 1);
        assert.strictEqual(chiamate[0].colore, "orange");
        assert.strictEqual(Segnalazioni.bolliniDelBox(box).length, 1);
    });
});

test("risolvere l'ultima segnalazione toglie il bollino", () => {
    conBollinoFinto(chiamate => {
        const { box } = boxConBollino([DUE[1]]);

        Segnalazioni.risolviVoce(box, 0);

        assert.strictEqual(chiamate.length, 0);
        assert.strictEqual(Segnalazioni.bolliniDelBox(box).length, 0);
        assert.strictEqual(box.allPageItems.length, 1, "il resto del box resta");
    });
});

test("un indice che non c'e' non tocca il bollino", () => {
    conBollinoFinto(chiamate => {
        const { box } = boxConBollino(DUE);

        Segnalazioni.risolviVoce(box, 7);
        Segnalazioni.risolviVoce(box, -1);

        assert.strictEqual(chiamate.length, 0);
        assert.strictEqual(Segnalazioni.leggiDalBox(box).length, 2);
    });
});

test("risolvi tutte lascia il box senza bollino", () => {
    const { box } = boxConBollino(DUE);

    Segnalazioni.risolviTutte(box);

    assert.strictEqual(Segnalazioni.bolliniDelBox(box).length, 0);
    assert.deepStrictEqual(Segnalazioni.leggiDalBox(box), []);
});

/* ---- la schermata, parti pure ---- */

test("le letture si raggruppano per pagina, nell'ordine in cui arrivano", () => {
    const lette = [
        { pagina: "5", box: { label: "A" }, voci: [DUE[0]] },
        { pagina: "5", box: { label: "B" }, voci: DUE },
        { pagina: "7", box: { label: "C" }, voci: [DUE[1]] }
    ];

    const pagine = SchermataSegnalazioni.perPagina(lette);

    assert.deepStrictEqual(pagine.map(p => [p.pagina, p.box.map(b => b.box.label)]), [["5", ["A", "B"]], ["7", ["C"]]]);
    assert.deepStrictEqual(SchermataSegnalazioni.conta(lette), { box: 3, segnalazioni: 4 });
    assert.deepStrictEqual(SchermataSegnalazioni.perPagina(null), []);
});

test("i colori della schermata sono quelli del bollino: rosso gli errori, arancione i warning", () => {
    assert.strictEqual(SchermataSegnalazioni.coloreCss("error"), "#c62828");
    assert.strictEqual(SchermataSegnalazioni.coloreCss("warning"), "#ef6c00");
});

test("a fine impaginazione la schermata guarda solo le pagine impaginate", () => {
    //I20-1056: decidono i bollini di quelle pagine, non il report del giro.
    const chiamate = [];
    const apri = SchermataSegnalazioni.apri;
    SchermataSegnalazioni.apri = (opzioni) => { chiamate.push(opzioni); return Promise.resolve(true); };
    try {
        SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [{ codiceGruppo: "1" }] });
        SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [{ codiceGruppo: "1" }] }, []);
        SchermataSegnalazioni.apriSeCiSono(null, [null, ""]);
        assert.strictEqual(chiamate.length, 0);

        SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [] }, ["11", "10"]);
        assert.deepStrictEqual(chiamate, [{ pagine: ["11", "10"], soloSeCiSono: true, aFineImpaginazione: true }]);
    }
    finally {
        SchermataSegnalazioni.apri = apri;
    }
});

test("le pagine di un giro sono quelle del risultato, una volta sola, dal punto di ripartenza", () => {
    const risultato = { result: [{ pag: 11 }, { pag: 10 }, { pag: 11 }, { pag: null }, {}, { pag: "12" }] };
    assert.deepStrictEqual(SchermataSegnalazioni.pagineDelRisultato(risultato), ["11", "10", "12"]);
    assert.deepStrictEqual(SchermataSegnalazioni.pagineDelRisultato(risultato, 1), ["10", "11", "12"]);
    assert.deepStrictEqual(SchermataSegnalazioni.pagineDelRisultato(null), []);
    assert.deepStrictEqual(SchermataSegnalazioni.pagineDelRisultato({ result: "x" }), []);
});

/* ---- I20-1056: una schermata sola, con il caricamento ---- */

//Un jQuery minimo: quanto basta perche' apri costruisca l'elenco.
function conSchermataFinta(prova) {
    const eventi = [];
    const finto = () => {
        const el = { dati: {} };
        el.attr = () => el; el.css = () => el; el.text = () => el; el.append = () => el; el.empty = () => el;
        el.data = (k, v) => { if (v === undefined) { return el.dati[k]; } el.dati[k] = v; return el; };
        el.closest = () => ({ remove: () => eventi.push("chiudi") });
        return el;
    };
    const salva = { $: global.$, Modali: global.Modali, showLoading: global.showLoading, hideLoading: global.hideLoading };
    const originali = { _leggi: SchermataSegnalazioni._leggi, _disegna: SchermataSegnalazioni._disegna };
    global.$ = finto;
    global.Modali = { popup: () => eventi.push("popup") };
    global.showLoading = () => eventi.push("caricamento");
    global.hideLoading = () => eventi.push("fine caricamento");
    SchermataSegnalazioni._disegna = () => eventi.push("disegna");
    return Promise.resolve(prova(eventi)).finally(() => {
        Object.assign(SchermataSegnalazioni, originali);
        Object.keys(salva).forEach(k => { if (salva[k] === undefined) { delete global[k]; } else { global[k] = salva[k]; } });
    });
}

test("click ripetuti: il caricamento, poi una sola schermata", () => conSchermataFinta(async (eventi) => {
    SchermataSegnalazioni._leggi = () => { eventi.push("leggi"); return [{ pagina: "1", box: {}, voci: [{ g: "error", t: "x" }] }]; };

    const prima = SchermataSegnalazioni.apri();
    const seconda = SchermataSegnalazioni.apri();
    const terza = SchermataSegnalazioni.apri();
    const esiti = await Promise.all([prima, seconda, terza]);

    assert.deepStrictEqual(esiti, [false, false, true]);
    assert.strictEqual(eventi.filter(e => e === "popup").length, 1);
    assert.strictEqual(eventi.filter(e => e === "leggi").length, 1);
    //Prima di aprirne una si chiude quella che c'e', e il caricamento si chiude alla fine.
    assert.deepStrictEqual(eventi.slice(eventi.indexOf("leggi")), ["leggi", "chiudi", "disegna", "popup", "fine caricamento"]);
    assert.strictEqual(eventi[0], "caricamento");
}));

test("a fine impaginazione si legge subito, sotto il caricamento dell'impaginazione", () => conSchermataFinta(async (eventi) => {
    SchermataSegnalazioni._leggi = (pagine) => { eventi.push("leggi " + pagine.join(",")); return []; };

    const esito = SchermataSegnalazioni.apri({ pagine: ["10"], soloSeCiSono: true, aFineImpaginazione: true });
    //Prima che chi chiama tolga il suo caricamento: niente attese.
    assert.deepStrictEqual(eventi, ["leggi 10"]);
    //Nessun bollino in quelle pagine: la schermata non si apre.
    assert.strictEqual(await esito, false);
    assert.deepStrictEqual(eventi, ["leggi 10"]);
}));

/* ---- la schermata, sul sorgente ---- */

const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");

test("la schermata legge il documento e offre vai al box, risolvi e risolvi tutte", () => {
    assert.match(schermata, /const documento = SchermataSegnalazioni\._documento\(\);\s*return Array\.isArray\(pagine\) \? Segnalazioni\.leggiPagine\(documento, pagine\) : Segnalazioni\.leggiDocumento\(documento\);/);
    assert.match(schermata, /\.text\("Vai al box"\)/);
    //I20-1044: fra il testo e il clic c'e' lo stile che tiene il pulsante intero.
    assert.match(schermata, /\.text\("Risolvi"\)(?:\.css\([^)]*\))?\.on\('click', \(\) => \{\s*Segnalazioni\.risolviVoce\(lettura\.box, indice\);\s*SchermataSegnalazioni\.riempi\(elenco\);/);
    //I20-1056, lotto 2: il conteggio va accanto al titolo.
    assert.match(schermata, /Modali\.popup\("Segnalazioni di impaginazione", elenco, "xl", SchermataSegnalazioni\.allaChiusura, null, conteggio\)/);
    assert.match(schermata, /\.text\(Array\.isArray\(pagine\) \? "Nessuna segnalazione nelle pagine impaginate\." : "Nessuna segnalazione nel documento\."\)/);
    //I testi entrano come testo, non come HTML.
    //I20-1056, lotto 2: con il dizionario del cliente, sempre come testo.
    assert.match(schermata, /\$\('<span><\/span>'\)\.text\(SchermataSegnalazioni\.traduciTesto\(voce\.t \|\| "", contesto\.traduzioni\)\)/);
});

test("risolvi tutte chiede conferma dentro il popup, non con Modali.confirm che starebbe sotto", () => {
    assert.match(schermata, /\.text\("Sicuro\? "\)/);
    assert.match(schermata, /\.text\("Sì"\)\.on\('click', \(\) => \{\s*Segnalazioni\.risolviTutte\(lettura\.box\);/);
    assert.doesNotMatch(schermata, /Modali\.confirm/);
});

test("vai al box porta alla pagina e seleziona il box, come il Report Integrita'", () => {
    assert.match(schermata, /app\.activeWindow\.activePage = box\.parentPage;\s*\}\s*app\.selection = \[box\];/);
});

/* ---- I20-1044: la schermata col pannello stretto ---- */

test("dei codici del gruppo si vedono i primi due, poi i puntini", () => {
    assert.strictEqual(SchermataSegnalazioni.codiciAbbreviati("6771109,5062150,3104458,4410021"), "6771109, 5062150, …");
    assert.strictEqual(SchermataSegnalazioni.codiciAbbreviati("6771109, 5062150"), "6771109, 5062150");
    assert.strictEqual(SchermataSegnalazioni.codiciAbbreviati("6771109"), "6771109");
    assert.strictEqual(SchermataSegnalazioni.codiciAbbreviati("6771109,5062150,3104458", Infinity), "6771109, 5062150, 3104458");
    assert.strictEqual(SchermataSegnalazioni.codiciAbbreviati(null), "");
});

test("del box si leggono la meccanica, il codice gruppo e l'idRec", () => {
    global.Utility = { getDnaOfBox: () => ({ codice_gruppo: "1,2,3", idRec: "77" }) };
    try {
        assert.deepStrictEqual(SchermataSegnalazioni._datiBox({ label: "BOX12" }), { meccanica: "BOX12", codiceGruppo: "1,2,3", idRec: "77" });
    }
    finally {
        delete global.Utility;
    }
    //Senza DNA leggibile resta la sola meccanica.
    global.Utility = { getDnaOfBox: () => null };
    try {
        assert.deepStrictEqual(SchermataSegnalazioni._datiBox({ label: "BOX1" }), { meccanica: "BOX1", codiceGruppo: "", idRec: null });
    }
    finally {
        delete global.Utility;
    }
});

/* ---- I20-1056, lotto 2: riconoscere il box ---- */

const TRADUZIONI = [
    { label: "campo_offerta", traduzione: "ANZICHè" },
    { label: "campo_offerta_KgL_sconto", traduzione: "PREZZI AL KG/L" },
    { label: "foto_extra$logo_it", traduzione: "LOGO IT" },
    { label: "vuota", traduzione: "  " }
];

test("le etichette citate nelle segnalazioni usano il dizionario del cliente", () => {
    const t = (testo) => SchermataSegnalazioni.traduciTesto(testo, TRADUZIONI);

    assert.strictEqual(t("Code CSF-009: L'elemento con etichetta campo_offerta nel box BOX12"), "Code CSF-009: L'elemento con etichetta ANZICHè (campo_offerta) nel box BOX12");
    //Vince la piu' lunga: campo_offerta e' l'inizio di campo_offerta_KgL_sconto.
    assert.strictEqual(t("campo_offerta_KgL_sconto non dovrebbe toccare campo_offerta."), "PREZZI AL KG/L (campo_offerta_KgL_sconto) non dovrebbe toccare ANZICHè (campo_offerta).");
    //Le etichette con il dollaro, intere.
    assert.strictEqual(t("Conflitto: foto_extra$logo_it non dovrebbe toccare foto_extra$logo_itx"), "Conflitto: LOGO IT (foto_extra$logo_it) non dovrebbe toccare foto_extra$logo_itx");
    //Dentro un'altra parola non si traduce; una traduzione vuota non e' una traduzione.
    assert.strictEqual(t("mycampo_offerta e vuota"), "mycampo_offerta e vuota");
    //Senza dizionario e senza testo, com'era.
    assert.strictEqual(SchermataSegnalazioni.traduciTesto("campo_offerta", []), "campo_offerta");
    assert.strictEqual(SchermataSegnalazioni.traduciTesto(null, TRADUZIONI), "");
});

test("la descrizione del box e' quella del tracciato, unita da |", () => {
    const records = [
        { recordInTracciato: { idRec: 77, "Descrizioni.Descrizione1": "CAFFE'", "Descrizioni.Descrizione2": " ", "Descrizioni.Descrizione3": "250 g" } },
        { recordInTracciato: { idRec: "78", descrizione_gruppo: { "Descrizioni.Descrizione1": "GRUPPO" } } }
    ];
    assert.strictEqual(SchermataSegnalazioni.descrizioneDelRecord(records, "77"), "CAFFE' | 250 g");
    assert.strictEqual(SchermataSegnalazioni.descrizioneDelRecord(records, 78), "GRUPPO");
    assert.strictEqual(SchermataSegnalazioni.descrizioneDelRecord(records, "99"), "");
    assert.strictEqual(SchermataSegnalazioni.descrizioneDelRecord(records, null), "");
    assert.strictEqual(SchermataSegnalazioni.descrizioneDelRecord(null, "77"), "");
});

test("una descrizione lunga si abbrevia con i puntini, e intera va nel suggerimento", () => {
    const lunga = "x".repeat(SchermataSegnalazioni.LUNGHEZZA_DESCRIZIONE + 10);
    assert.strictEqual(SchermataSegnalazioni.abbrevia(lunga), "x".repeat(SchermataSegnalazioni.LUNGHEZZA_DESCRIZIONE) + "…");
    assert.strictEqual(SchermataSegnalazioni.abbrevia("corta"), "corta");
    assert.strictEqual(SchermataSegnalazioni.abbrevia("parola   altra", 9), "parola…");
    assert.match(schermata, /riga\.attr\('title', descrizione\);/);
    assert.match(schermata, /fontSize: '11px', color: '#666'/);
});

test("il conteggio accanto al titolo dice segnalazioni e box", () => {
    const lette = [{ voci: [{}, {}] }, { voci: [{}] }];
    assert.strictEqual(SchermataSegnalazioni.testoConteggio(lette), "3 segnalazioni in 2 box");
    assert.strictEqual(SchermataSegnalazioni.testoConteggio([{ voci: [{}] }]), "1 segnalazione in 1 box");
    assert.strictEqual(SchermataSegnalazioni.testoConteggio([]), "");
    //E si aggiorna a ogni ridisegno, cioe' dopo ogni Risolvi.
    assert.match(schermata, /const conteggio = elenco\.data\('conteggio'\);\s*if \(conteggio != null\) \{\s*conteggio\.text\(SchermataSegnalazioni\.testoConteggio\(lette\)\);/);
});

test("il codice gruppo si copia intero, come testo", async () => {
    const copiati = [];
    await SchermataSegnalazioni.copiaCodice("6771109,5062150,3104458", { writeText: (t) => { copiati.push(t); } });
    await SchermataSegnalazioni.copiaCodice(12345, { writeText: (t) => { copiati.push(t); } });
    assert.deepStrictEqual(copiati, ["6771109,5062150,3104458", "12345"]);
    await assert.rejects(SchermataSegnalazioni.copiaCodice("1", {}));
    assert.match(schermata, /SchermataSegnalazioni\.copiaCodice\(datiBox\.codiceGruppo\)/);
});

test("Modali.popup mette il contenuto accanto al titolo, e senza resta com'era", () => {
    const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");
    assert.match(modali, /async popup\(title, message, taglia = "md", alChiudi = null, contenutoIntestazione = null, accantoAlTitolo = null\) \{/);
    assert.match(modali, /gruppoSinistro\.append\(titleText\)\.append\(accantoAlTitolo\);/);
    assert.match(modali, /else \{\s*titleBar\.append\(titleText\)\.append\(gruppoDestro\);/);
});

test("le pagine sono separate da una testata ben visibile", () => {
    assert.match(schermata, /borderBottom: '2px solid #8ab661', backgroundColor: '#eef7e3'/);
});

test("Vai al box apre la scheda in vista controllata e torna alla schermata", () => {
    const corpo = (inizio) => {
        const da = schermata.indexOf(inizio);
        assert.notStrictEqual(da, -1, inizio);
        return schermata.substring(da, schermata.indexOf("\n    },\n", da));
    };
    const apri = corpo("    vaiAlBox(box, elenco = null) {");
    //Eventi fermi prima di selezionare, schermata staccata, blocco e scheda dal report.
    //(la prima selezione del corpo e' quella del box senza DNA, che seleziona soltanto)
    const fermi = apri.indexOf("SchermataSegnalazioni._eventiFermi(true);");
    const selezioneControllata = apri.indexOf("if (!SchermataSegnalazioni._selezionaBox(box)) {");
    assert.ok(fermi > 0 && selezioneControllata > fermi, "eventi fermi prima della selezione");
    assert.match(apri, /const popup = elenco\.closest\("#popup"\);/);
    assert.match(apri, /popup\.detach\(\);/);
    assert.match(apri, /ReportIntegrita\._applicaBloccoSchedaDalReport\(\);/);
    assert.match(apri, /schedaRef\.apertaDalReport = true;/);
    assert.match(apri, /schedaRef\.initSchedaRef\(ReportIntegrita\._refPerSchedaDalReport\(box, dna\)\);/);
    //Senza DNA si seleziona soltanto.
    assert.match(apri, /if \(dna == null \|\| elenco == null \|\| !schedaDisponibile\) \{\s*const selezionato = SchermataSegnalazioni\._selezionaBox\(box\);/);

    const chiudi = corpo("    chiudiScheda() {");
    assert.match(chiudi, /SchermataSegnalazioni\._schedaAperta = null;/);
    assert.match(chiudi, /ReportIntegrita\._terminaSchedaDalReport\(\);\s*SchermataSegnalazioni\._eventiFermi\(false\);\s*\$\("body"\)\.append\(stato\.popup\);/);
    assert.match(chiudi, /SchermataSegnalazioni\.riempi\(stato\.elenco\);/);
    assert.match(chiudi, /_evidenziaBox\(stato\.elenco, stato\.idRec\)/);

    //La X ha il suo id: quella del report porta al report.
    assert.match(schermata, /\$\('<div id="chiudiSchedaDalleSegnalazioni">✕<\/div>'\)/);
    assert.match(schermata, /"Chiudi la scheda e torna alle segnalazioni"/);
    //Il box rifatto si ritrova come nel report.
    assert.match(schermata, /ReportIntegrita\._resolveBoxByCodiceGruppo\(stato\.record\)/);
    assert.match(schermata, /\.on\('click', \(\) => SchermataSegnalazioni\.vaiAlBox\(lettura\.box, elenco\)\)/);
});

test("restringendo il pannello i testi si stringono e i pulsanti restano dentro", () => {
    //I testi possono scendere sotto la loro parola piu' lunga, e le parole lunghe vanno a capo.
    assert.match(schermata, /_testoCheSiRestringe\(elemento\) \{\s*return elemento\.css\(\{ flex: '1 1 0', minWidth: '0', overflowWrap: 'anywhere', wordBreak: 'break-word' \}\);/);
    assert.match(schermata, /const testo = SchermataSegnalazioni\._testoCheSiRestringe\(\$\('<span><\/span>'\)\);/);
    //L'intestazione va a capo, i pulsanti non si stringono.
    assert.match(schermata, /const testata = \$\('<div><\/div>'\)\.css\(\{ display: 'flex', flexWrap: 'wrap'/);
    assert.match(schermata, /\.text\("Vai al box"\)\.css\(\{ flexShrink: '0' \}\)/);
    assert.match(schermata, /const azioniTutte = \$\('<span><\/span>'\)\.css\(\{ flexShrink: '0' \}\);/);
    assert.match(schermata, /\.text\("Risolvi"\)\.css\(\{ flexShrink: '0' \}\)/);
});

/* ---- dove si apre ---- */

test("il pulsante Segnalazioni sta in Menabo' -> Filtri, accanto a Impagina", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const impagina = html.indexOf('<sp-action-button id="bOpt2Advanced"');
    const pulsante = html.indexOf('<sp-action-button id="segnalazioniImpaginazioneButton"');

    assert.ok(impagina >= 0 && pulsante > impagina && pulsante - impagina < 600);
    assert.match(html, /onclick="SchermataSegnalazioni\.apri\(\)"><span>Segnalazioni<\/span>/);
});

test("si apre da sola a fine impaginazione di Volantino, PoP e singola, ma non dopo il fix ne' dentro un libro", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    assert.match(indexNew, /const SchermataSegnalazioni = require\('\.\/segnalazioni\/schermata'\);/);
    //Volantino: dopo il report, solo se si impagina.
    assert.match(indexNew, /stampaSegnalazioni\(reportImpaginazioneObj\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(impagina\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj, SchermataSegnalazioni\.pagineDelRisultato\(objResult\)\);/);
    //PoP: report e schermata, fuori dal giro di un libro.
    assert.match(indexNew, /if \(!\(jobImpaginazioneLibro\.stato == 1 && jobImpaginazioneLibro\.queue\.length > 0\)\) \{\s*stampaSegnalazioni\(reportImpaginazioneObj\);\s*\/\/[^\n]*\n\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj, SchermataSegnalazioni\.pagineDelRisultato\(objResult, restartFromIndexPoP\)\);/);
    //Singola: solo fuori dalle operazioni massive.
    //I20-1056: solo se si impagina un box nuovo, e solo per la sua pagina.
    assert.match(indexNew, /if\(!massiveOperation\)\{\s*stampaSegnalazioni\(reportImpaginazioneObj\);\s*rimuoviSimboli\(\);[\s\S]{0,700}?if \(apriSegnalazioni\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj, \[String\(pagina\)\]\);/);

    //I20-1056: rifare un box non la apre: Reimpagina della scheda (anche dal riallineamento) e
    //Report Integrita' passano apriSegnalazioni = false.
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /impaginazioneSingoloIndd\(schedaRef, pagina, false, null, false, bounds, false, false\);/);
    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    assert.match(report, /impaginazioneSingoloIndd\(gruppoRecords, paginaObj\.nomePagina, applicaImpaginazioni, undefined, false, null, false, false\)/);
    assert.match(report, /null,\s*true,\s*false \/\/I20-1056/);

    //Fix referenza: il report si', la schermata no.
    const fix = indexNew.substring(indexNew.indexOf("async function fixRefImpaginata("));
    const fineFix = fix.substring(0, fix.indexOf("\n}\n"));
    assert.match(fineFix, /stampaSegnalazioni\(reportObj\);/);
    assert.doesNotMatch(fineFix, /SchermataSegnalazioni/);

    //Tre aperture automatiche, non di piu'.
    assert.strictEqual((indexNew.match(/SchermataSegnalazioni\.apriSeCiSono\(/g) || []).length, 3);
});

test("a fine Volantino la schermata si apre a Menabo' ridisegnato, o le caselle Ordine nuove le restano sopra", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const ridisegno = indexNew.indexOf("await filtriJs.visualizzaHomePageFiltri()");
    const apertura = indexNew.indexOf("if (impagina) {\n                        SchermataSegnalazioni.apriSeCiSono(");

    assert.ok(ridisegno >= 0, "il ridisegno del Menabo' si aspetta");
    assert.ok(apertura > ridisegno, "e viene prima dell'apertura della schermata");
    assert.doesNotMatch(indexNew, /^\s*filtriJs\.visualizzaHomePageFiltri\(\);/m);
});

test("togliere la schermata di attesa non riaccende i controlli nascosti da un popup aperto", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const hideLoading = indexNew.substring(indexNew.indexOf("function hideLoading() {"));
    const corpo = hideLoading.substring(0, hideLoading.indexOf("\n}\n"));

    //Volantino e PoP chiamano hideLoading nel finally dopo aver aperto la schermata, la singola
    //lo chiama chi l'ha lanciata: senza la guardia le caselle Ordine tornavano sopra il popup.
    assert.match(corpo, /if \(\$\("#popup"\)\.length === 0\) \{\s*Modali\.mostraHidebleElements\(\);\s*\}/);
    assert.strictEqual((corpo.match(/mostraHidebleElements/g) || []).length, 1);
});

/* ---- lotto 3: il badge di pagina del tracciato ---- */

//Due box con bollino e DNA, uno di un'altra referenza, uno senza DNA leggibile.
const LETTE = [
    { pagina: "3", box: { dna: { idRec: "101" } }, voci: [{ g: "warning", c: "CSF-013", t: "a" }, { g: "error", c: "CSF-009", t: "b" }] },
    { pagina: "3", box: { dna: { idRec: "202" } }, voci: [{ g: "warning", c: "CSF-013", t: "c" }] },
    { pagina: "4", box: { dna: null }, voci: [{ g: "error", c: "CSF-009", t: "d" }] }
];
const dnaFinto = (box) => box.dna;

test("le segnalazioni si riassumono per idRec: gravita' peggiore, quante sono e quanti errori", () => {
    const riepilogo = Segnalazioni.riepilogoPerRecord(LETTE, dnaFinto);

    assert.deepStrictEqual(riepilogo, {
        "101": { gravita: "error", segnalazioni: 2, errori: 1 },
        "202": { gravita: "warning", segnalazioni: 1, errori: 0 }
    });
    assert.deepStrictEqual(Segnalazioni.riepilogoPerRecord(null, dnaFinto), {});
});

test("una referenza in due box prende il box peggiore e la somma delle segnalazioni", () => {
    const lette = [
        { box: { dna: { idRec: "7" } }, voci: [{ g: "warning", t: "a" }] },
        { box: { dna: { idRec: "7" } }, voci: [{ g: "error", t: "b" }] }
    ];

    assert.deepStrictEqual(Segnalazioni.riepilogoPerRecord(lette, dnaFinto)["7"], { gravita: "error", segnalazioni: 2, errori: 1 });
});

test("l'idRec del DNA (testo) e quello del tracciato (numero) danno la stessa chiave", () => {
    assert.strictEqual(Segnalazioni.chiaveRecord("101"), "101");
    assert.strictEqual(Segnalazioni.chiaveRecord(101), "101");
    assert.strictEqual(Segnalazioni.chiaveRecord("abc"), null);
    assert.strictEqual(Segnalazioni.chiaveRecord(null), null);
});

test("un DNA che non si legge non ferma il riepilogo", () => {
    const lette = [{ box: {}, voci: [{ g: "error", t: "a" }] }, LETTE[1]];
    const dnaCheSiRompe = (box) => { if (box.dna == null) { throw new Error("box non valido"); } return box.dna; };

    assert.deepStrictEqual(Object.keys(Segnalazioni.riepilogoPerRecord(lette, dnaCheSiRompe)), ["202"]);
});

test("il suggerimento del badge dice quante segnalazioni e quanti errori", () => {
    assert.strictEqual(SchermataSegnalazioni.testoRiepilogo({ gravita: "error", segnalazioni: 2, errori: 1 }), "2 segnalazioni di impaginazione (1 errore)");
    assert.strictEqual(SchermataSegnalazioni.testoRiepilogo({ gravita: "error", segnalazioni: 3, errori: 3 }), "3 segnalazioni di impaginazione (3 errori)");
    assert.strictEqual(SchermataSegnalazioni.testoRiepilogo({ gravita: "warning", segnalazioni: 1, errori: 0 }), "1 segnalazione di impaginazione");
    assert.strictEqual(SchermataSegnalazioni.testoRiepilogo(null), "");
});

test("chiudendo la schermata i badge del tracciato si ricolorano, e sotto Node non succede niente", () => {
    let chiamate = 0;
    SchermataSegnalazioni.allaChiusura();
    global.aggiornaBadgeSegnalazioniTracciato = () => { chiamate++; };
    try {
        SchermataSegnalazioni.allaChiusura();
        assert.strictEqual(chiamate, 1);
    }
    finally {
        delete global.aggiornaBadgeSegnalazioniTracciato;
    }
});

test("il tracciato legge le segnalazioni una volta per ridisegno e colora il badge con esse", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    //Una lettura per ridisegno, passata a ogni riga.
    assert.match(indexNew, /const riepilogoSegnalazioni = riepilogoSegnalazioniTracciato\(\);[\s\S]{0,200}?creaElementoTracciato\(record, first, riepilogoSegnalazioni\)/);
    //I20-1043: la lettura passa da Segnalazioni.riepilogoTracciato, che la riusa per qualche secondo.
    assert.match(indexNew, /return Segnalazioni\.riepilogoTracciato\(documento\);/);

    //Il badge: classe e idRec per ricolorarlo, colore e suggerimento dal riepilogo, blu senza.
    const crea = indexNew.substring(indexNew.indexOf("function creaElementoTracciato("));
    assert.match(crea, /backgroundColor: COLORE_BADGE_TRACCIATO,/);
    assert.match(crea, /\$badge\.addClass\("badge-pagina-tracciato"\);/);
    assert.match(crea, /\$badge\.attr\("idRec", chiaveRecord\);/);
    assert.match(crea, /coloraBadgeTracciato\(\$badge, /);
    assert.match(indexNew, /const COLORE_BADGE_TRACCIATO = "rgb\(45,140,235\)";/);
    assert.match(indexNew, /SchermataSegnalazioni\.coloreCss\(riepilogo\.gravita\) : COLORE_BADGE_TRACCIATO/);

    //Ricolorare senza ridisegnare: i badge gia' disegnati, per idRec.
    assert.match(indexNew, /function aggiornaBadgeSegnalazioniTracciato\(\) \{[\s\S]{0,200}?\$\("#ElementiTracciato \.badge-pagina-tracciato"\)\.each/);
});
