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
    assert.match(schermata, /const documento = SchermataSegnalazioni\._documento\(\);\s*const lette = Array\.isArray\(pagine\) \? Segnalazioni\.leggiPagine\(documento, pagine\) : Segnalazioni\.leggiDocumento\(documento\);/);
    assert.match(schermata, /\.text\("Vai al box"\)/);
    //I20-1044: fra il testo e il clic c'e' lo stile che tiene il pulsante intero.
    //I20-1056, lotto 4: la riga e' condivisa con la scheda ref; nella schermata alCambio rifa' l'elenco.
    //I20-1138: prima di ridisegnare il box rifatto si segue, e alCambio riceve quello aggiornato.
    assert.match(schermata, /\.text\("Risolvi"\)(?:\.css\([^)]*\))?\.on\('click', \(\) => \{[\s\S]{0,200}?const dopo = Segnalazioni\.risolviVoce\(box, indice\);[\s\S]{0,120}?alCambio\(dopo\);/);
    assert.match(schermata, /const ridisegna = \(\) => SchermataSegnalazioni\.riempi\(elenco\);/);
    //I20-1056, lotto 2: il conteggio va accanto al titolo.
    //I20-1116: il titolo e' una costante, la stessa del popup e della colonna della vista affiancata.
    assert.strictEqual(SchermataSegnalazioni.TITOLO, "Segnalazioni di impaginazione");
    assert.match(schermata, /Modali\.popup\(SchermataSegnalazioni\.TITOLO, elenco, "xl", SchermataSegnalazioni\.allaChiusura, null, conteggio\)/);
    assert.match(schermata, /\.text\(Array\.isArray\(pagine\) \? "Nessuna segnalazione nelle pagine impaginate\." : "Nessuna segnalazione nel documento\."\)/);
    //I testi entrano come testo, non come HTML.
    //I20-1056, lotto 2: con il dizionario del cliente, sempre come testo.
    assert.match(schermata, /\$\('<span><\/span>'\)\.text\(SchermataSegnalazioni\.traduciTesto\(voce\.t \|\| "", contesto\.traduzioni\)\)/);
});

test("risolvi tutte chiede conferma dentro il popup, non con Modali.confirm che starebbe sotto", () => {
    assert.match(schermata, /\.text\("Sicuro\? "\)/);
    assert.match(schermata, /\.text\("Sì"\)\.on\('click', \(\) => \{\s*Segnalazioni\.risolviTutte\(box\);\s*alCambio\(\);/);
    assert.doesNotMatch(schermata, /Modali\.confirm\(/);
    //I20-1126: l'unica domanda di Modali e' quella per disattivare le segnalazioni: confirmCustom sta
    //sopra la schermata (Modali.LIVELLO_CONFERMA, I20-1085).
    assert.strictEqual((schermata.match(/Modali\.confirmCustom\(/g) || []).length, 1);
    assert.match(schermata, /async chiediDisattivazione\(elenco = null\) \{\s*const risposta = await Modali\.confirmCustom\(/);
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
    //I20-1126: con le segnalazioni disattivate il conteggio resta vuoto (provato con _disegna piu' sotto).
    assert.match(schermata, /const conteggio = elenco\.data\('conteggio'\);\s*if \(conteggio != null\) \{\s*conteggio\.text\(disattivate \? "" : SchermataSegnalazioni\.testoConteggio\(lette\)\);/);
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

test("togliere la schermata di attesa non riaccende niente sopra un popup aperto", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const hideLoading = indexNew.substring(indexNew.indexOf("function hideLoading() {"));
    const corpo = hideLoading.substring(0, hideLoading.indexOf("\n}\n"));

    //Volantino e PoP chiamano hideLoading nel finally dopo aver aperto la schermata, la singola
    //lo chiama chi l'ha lanciata: in I20-1029 le caselle Ordine tornavano sopra il popup perche'
    //hideLoading le riaccendeva. Da I20-1123 le caselle stanno a riposo e nessuno le spegne:
    //hideLoading toglie l'attesa e basta.
    assert.match(corpo, /^function hideLoading\(\) \{\s*\$\("#loadingPanel"\)\.hide\(\);\s*$/);
    const showLoading = indexNew.substring(indexNew.indexOf("function showLoading(msg)"), indexNew.indexOf("function hideLoading() {"));
    assert.match(showLoading, /CampiARiposo\.tuttiARiposo\(\);/);
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

/* ---- I20-1056, lotto 3: l'icona del menabo' ---- */

const lettura = (pagina, ...gravita) => ({ pagina: pagina, box: {}, voci: gravita.map(g => ({ g: g, t: "x" })) });

test("l'ultimo controllo tiene i numeri pagina per pagina", () => {
    SchermataSegnalazioni._ultimoControllo = null;

    //Tutto il documento: un errore in pagina 3, due warning in pagina 5.
    SchermataSegnalazioni.registraControllo("id:1", [lettura("3", "error"), lettura("5", "warning"), lettura("5", "warning")]);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:1"), { segnalazioni: 3, errori: 1, gravita: "error", controllato: true });

    //Si rifa' la pagina 5 e i warning spariscono: solo quella pagina cambia, a zero.
    SchermataSegnalazioni.registraControllo("id:1", [], ["5"]);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:1"), { segnalazioni: 1, errori: 1, gravita: "error", controllato: true });

    //Si risolve l'errore in pagina 3.
    SchermataSegnalazioni.registraControllo("id:1", [], ["3"]);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:1"), { segnalazioni: 0, errori: 0, gravita: null, controllato: true });

    //Una pagina con soli warning: arancione.
    SchermataSegnalazioni.registraControllo("id:1", [lettura("7", "warning")], ["7"]);
    assert.strictEqual(SchermataSegnalazioni.riepilogoControllo("id:1").gravita, "warning");
});

test("una lettura completa sostituisce tutto, e un altro documento riparte da zero", () => {
    SchermataSegnalazioni._ultimoControllo = null;
    SchermataSegnalazioni.registraControllo("id:1", [lettura("3", "error"), lettura("4", "warning")]);
    SchermataSegnalazioni.registraControllo("id:1", [lettura("9", "warning")]);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:1"), { segnalazioni: 1, errori: 0, gravita: "warning", controllato: true });

    //Il controllo e' di un altro documento: per questo non c'e' niente, e non e' controllato.
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:2"), { segnalazioni: 0, errori: 0, gravita: null, controllato: false });
    SchermataSegnalazioni.registraControllo("id:2", [lettura("1", "error")], ["1"]);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:2"), { segnalazioni: 1, errori: 1, gravita: "error", controllato: true });
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoControllo("id:1"), { segnalazioni: 0, errori: 0, gravita: null, controllato: false });
    //Senza documento non c'e' controllo.
    assert.strictEqual(SchermataSegnalazioni.riepilogoControllo(null).controllato, false);
    SchermataSegnalazioni._ultimoControllo = null;
});

test("il suggerimento dell'icona dice quante e quanti errori; a zero non c'e'", () => {
    assert.strictEqual(SchermataSegnalazioni.testoIcona({ segnalazioni: 3, errori: 1 }), "3 segnalazioni irrisolte (1 errore) all'ultimo controllo");
    assert.strictEqual(SchermataSegnalazioni.testoIcona({ segnalazioni: 1, errori: 0 }), "1 segnalazione irrisolta all'ultimo controllo");
    assert.strictEqual(SchermataSegnalazioni.testoIcona({ segnalazioni: 0, errori: 0 }), "");
    //Nascosta a zero, colorata con la gravita' peggiore.
    assert.match(schermata, /if \(riepilogo\.segnalazioni === 0\) \{\s*icona\.text\(""\)\.attr\('title', ""\)\.css\(\{ display: 'none' \}\);/);
    assert.match(schermata, /backgroundColor: SchermataSegnalazioni\.coloreCss\(riepilogo\.gravita\)/);
});

test("ogni lettura dei bollini e' un controllo che aggiorna l'icona", () => {
    assert.match(schermata, /SchermataSegnalazioni\.registraControllo\(Segnalazioni\._chiaveDocumento\(documento\), lette, pagine\);\s*SchermataSegnalazioni\.aggiornaIcona\(\);/);

    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    //Dopo un Reimpagina: la sola pagina del box, senza schermata.
    assert.match(indexNew, /if \(apriSegnalazioni\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj, \[String\(pagina\)\]\);\s*\}\s*else \{\s*\/\/[^\n]*\n\s*SchermataSegnalazioni\.controllaPagine\(\[String\(pagina\)\]\);/);
    //All'apertura del documento: tutto, dopo i percorsi.
    assert.match(indexNew, /checkForLoghiCore\(\);\s*\/\/[^\n]*\n\s*SchermataSegnalazioni\.controllaDocumento\(\);/);
});

test("nel menabo' i pulsanti stanno su una riga senza che il testo sbordi, e c'e' l'icona", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const riga = html.substring(html.indexOf('<div class="row" id="comandiInterfacciaAdvanced"'), html.indexOf('<div id="filtriBody"'));
    for (const id of ["bOpt1Advanced", "bOpt2Advanced", "segnalazioniImpaginazioneButton"]) {
        assert.match(riga, new RegExp('id="' + id + '"[^>]*style="[^"]*flex-shrink: 0; white-space: nowrap;'), id);
    }
    assert.match(riga, /<span id="iconaSegnalazioniImpaginazione" style="display: none;/);
    //La casella della cache non prende piu' tutta la riga.
    assert.doesNotMatch(riga, /<div style="width: 100%; align-items: center; display: flex;">/);
    assert.match(riga, /<div style="flex: 1 1 auto; min-width: 0;/);
});

/* ---- I20-1056, lotto 5: Report Integrita' e ottimizzazioni ---- */

test("l'avviso prima del report dice quante segnalazioni, in quanti box e quanti errori", () => {
    assert.strictEqual(SchermataSegnalazioni.testoAvvisoReport([]), "");
    assert.strictEqual(SchermataSegnalazioni.testoAvvisoReport([{ pagina: "1", box: {}, voci: [] }]), "");
    assert.strictEqual(SchermataSegnalazioni.testoAvvisoReport([{ pagina: "1", box: {}, voci: [DUE[1]] }]),
        "Nel documento c'è 1 segnalazione di impaginazione irrisolta in 1 box.");
    assert.strictEqual(SchermataSegnalazioni.testoAvvisoReport([
        { pagina: "1", box: {}, voci: DUE },
        { pagina: "2", box: {}, voci: [DUE[1]] }
    ]), "Nel documento ci sono 3 segnalazioni di impaginazione irrisolte in 2 box (1 errore).");
});

test("il riepilogo delle voci di un box: quante, quanti errori, la gravita' peggiore", () => {
    assert.strictEqual(SchermataSegnalazioni.riepilogoVoci([]), null);
    assert.strictEqual(SchermataSegnalazioni.riepilogoVoci(null), null);
    assert.deepStrictEqual(SchermataSegnalazioni.riepilogoVoci(DUE), {
        segnalazioni: 2, errori: 1, gravita: "error",
        voci: [{ g: "error", c: "CSF-009", t: "oltre la griglia" }, { g: "warning", c: "CSF-013", t: "conflitto" }]
    });
    assert.strictEqual(SchermataSegnalazioni.riepilogoVoci([DUE[1]]).gravita, "warning");
});

test("i numeri vanno ai record del report per id del box, e un box che nel report non c'e' non entra", () => {
    const cambiato = { inddId: 101, elementoMappa: { refId: 101, idRec: 7 } };
    const uscito = { inddId: 102, elementoMappa: { refId: 102, idRec: 8 } };
    const pulito = { inddId: 103, elementoMappa: { refId: 103, idRec: 9 }, segnalazioniImpaginazione: { segnalazioni: 4 } };
    const records = [cambiato, uscito, pulito];
    const dnaLetti = [];

    const quanti = SchermataSegnalazioni.assegnaAiRecord(records, [
        { pagina: "1", box: { id: 101 }, voci: DUE },
        { pagina: "1", box: { id: 102 }, voci: [DUE[1]] },
        { pagina: "2", box: { id: 999 }, voci: DUE }
    ], (box) => { dnaLetti.push(box.id); return { idRec: "55" }; });

    assert.strictEqual(quanti, 2);
    assert.strictEqual(cambiato.segnalazioniImpaginazione.segnalazioni, 2);
    assert.strictEqual(cambiato.segnalazioniImpaginazione.gravita, "error");
    assert.strictEqual(uscito.segnalazioniImpaginazione.segnalazioni, 1);
    assert.strictEqual(uscito.segnalazioniImpaginazione.gravita, "warning");
    //Il numero salvato prima non vale piu': il box non ha piu' bollini.
    assert.strictEqual(pulito.segnalazioniImpaginazione, undefined);
    //Il DNA si legge solo per il box che per id non si e' trovato, e non aggiunge record.
    assert.deepStrictEqual(dnaLetti, [999]);
    assert.strictEqual(records.length, 3);
});

test("se l'id del box non torna (report riaperto, bollino ridisegnato) il record si trova per idRec", () => {
    const record = { inddId: 101, elementoMappa: { refId: 101, idRec: 7 } };

    SchermataSegnalazioni.assegnaAiRecord([record], [{ pagina: "1", box: { id: 500 }, voci: [DUE[0]] }], () => ({ idRec: "7" }));

    assert.strictEqual(record.segnalazioniImpaginazione.segnalazioni, 1);
});

test("senza lettura i numeri si tolgono tutti, e un DNA che non si legge non ferma niente", () => {
    const record = { inddId: 101, elementoMappa: { idRec: 7 }, segnalazioniImpaginazione: { segnalazioni: 3 } };
    assert.strictEqual(SchermataSegnalazioni.assegnaAiRecord([record], []), 0);
    assert.strictEqual(record.segnalazioniImpaginazione, undefined);

    assert.strictEqual(SchermataSegnalazioni.assegnaAiRecord([record], [{ pagina: "1", box: { id: 5 }, voci: DUE }],
        () => { throw new Error("box non valido"); }), 0);
});

test("il suggerimento del numero sul record elenca le voci con il dizionario del cliente", () => {
    const testo = SchermataSegnalazioni.testoSegnalazioniDelRecord(
        SchermataSegnalazioni.riepilogoVoci([{ g: "error", c: "CSF-009", t: "campo_offerta oltre la griglia" }, DUE[1]]),
        [{ label: "campo_offerta", traduzione: "ANZICHE'" }]);
    assert.match(testo, /^2 segnalazioni di impaginazione irrisolte:/);
    assert.match(testo, /• CSF-009 ANZICHE' \(campo_offerta\) oltre la griglia/);
    assert.match(testo, /• CSF-013 conflitto$/);
    assert.strictEqual(SchermataSegnalazioni.testoSegnalazioniDelRecord(null, []), "");
});

test("la schermata aperta con una lettura gia' fatta non rilegge e non mostra il caricamento", () => conSchermataFinta(async (eventi) => {
    SchermataSegnalazioni._leggi = () => { eventi.push("leggi"); return []; };

    const esito = await SchermataSegnalazioni.apri({ lette: [{ pagina: "1", box: {}, voci: DUE }] });

    assert.strictEqual(esito, true);
    assert.deepStrictEqual(eventi, ["chiudi", "disegna", "popup"]);
}));

test("una lettura che non riesce e' null per il report, una lista vuota per gli altri", () => {
    const salvaDocumento = SchermataSegnalazioni._documento;
    const salvaErrore = console.error;
    SchermataSegnalazioni._documento = () => { throw new Error("documento chiuso"); };
    console.error = () => {};
    try {
        assert.strictEqual(SchermataSegnalazioni.letturaControllata(null), null);
        assert.deepStrictEqual(SchermataSegnalazioni._leggi(null), []);
    }
    finally {
        SchermataSegnalazioni._documento = salvaDocumento;
        console.error = salvaErrore;
    }
});

test("i bollini del box si cercano leggendo l'elenco degli elementi una volta sola", () => {
    const { box } = boxConBollino(DUE);
    const elementi = box.allPageItems;
    let letture = 0;
    const contato = { label: box.label, get allPageItems() { letture++; return elementi; } };

    assert.strictEqual(Segnalazioni.bolliniDelBox(contato).length, 1);
    assert.strictEqual(letture, 1);
    assert.deepStrictEqual(Segnalazioni.bolliniDelBox(null), []);
});

test("anche il DNA del box legge l'elenco degli elementi una volta sola", () => {
    const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");
    const corpo = utility.substring(utility.indexOf("getDnaOfBox: function (box) {"), utility.indexOf("getBoxFromElementOfBox("));
    assert.match(corpo, /var elementi = box\.allPageItems;\s*for \(var i = 0; i < elementi\.length; i\+\+\) \{\s*var item = elementi\[i\];/);
    assert.strictEqual((corpo.match(/box\.allPageItems/g) || []).length, 1);
});

/* ---- I20-1056, lotto 5: il Report Integrita', sul sorgente ---- */

const flussoReport = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
const pannelliReport = leggiFileDelPlugin("reportIntegrita/pannelli.js").replace(/\r/g, "");

test("l'avviso delle segnalazioni viene prima di tutto, anche della domanda Riapri / Nuovo", () => {
    const avvio = flussoReport.substring(flussoReport.indexOf("async avviaReportIntegrita("), flussoReport.indexOf("async avvisoSegnalazioniPrimaDelReport("));
    const avviso = avvio.indexOf("await ReportIntegrita.avvisoSegnalazioniPrimaDelReport();");
    assert.ok(avviso > 0);
    assert.ok(avviso < avvio.indexOf("leggiReportIntegritaLocale(idKit)"));
    //Vai: si va alle segnalazioni e il report non parte. Annulla: il report non parte.
    assert.match(avvio, /if \(avviso\.azione === "vai"\) \{\s*await ReportIntegrita\.vaiASegnalazioniDalReport\(avviso\.lette\);\s*return;\s*\}\s*if \(avviso\.azione !== "procedi"\) \{\s*return;\s*\}/);
    //Riapri e report nuovo usano la stessa lettura per i numeri.
    assert.match(avvio, /ReportIntegrita\.assegnaSegnalazioniAlReport\(reportLocale\.report, avviso\.lette\);\s*ReportIntegrita\.compilaReportConfronto\(reportLocale\.report,/);
    assert.match(avvio, /await ReportIntegrita\.applicaConfronto\(mappa, avviso\.lette, versioniPrecedenti\);/);
    assert.match(flussoReport, /ReportIntegrita\.assegnaSegnalazioniAlReport\(reportObj, letteSegnalazioni\);\s*ReportIntegrita\.compilaReportConfronto\(reportObj\);/);
});

test("l'avviso rilegge il documento e offre Vai a segnalazioni, Procedi comunque e Annulla, in quest'ordine", () => {
    const avviso = flussoReport.substring(flussoReport.indexOf("async avvisoSegnalazioniPrimaDelReport("), flussoReport.indexOf("async vaiASegnalazioniDalReport("));
    assert.match(avviso, /SchermataSegnalazioni\.letturaControllata\(null\)/);
    assert.match(avviso, /Code IDX-176/);
    assert.match(avviso, /if \(testo === ""\) \{\s*return \{ azione: "procedi", lette \};/);
    const vai = avviso.indexOf('label: "Vai a segnalazioni"');
    const procedi = avviso.indexOf('label: "Procedi comunque"');
    const annulla = avviso.indexOf('label: "Annulla"');
    assert.ok(vai > 0 && vai < procedi && procedi < annulla);
});

test("Vai a segnalazioni apre il menabo' e poi la schermata con la lettura gia' fatta", () => {
    const vai = flussoReport.substring(flussoReport.indexOf("async vaiASegnalazioniDalReport("), flussoReport.indexOf("assegnaSegnalazioniAlReport(report, lette) {"));
    assert.match(vai, /jsIndexControls\.changeImage\(\$\("#menaboTab"\)\);/);
    assert.match(vai, /await filtriJs\.visualizzaHomePageFiltri\(\);/);
    assert.match(vai, /await SchermataSegnalazioni\.apri\(\{ lette \}\);/);
});

test("il numero si vede accanto al codice dei Cambiati e degli Eliminati, e si rilegge chiudendo la scheda", () => {
    assert.strictEqual((pannelliReport.match(/left\.appendChild\(this\._conSegnalazioniImpaginazione\(codice, item\)\);/g) || []).length, 2);
    assert.match(pannelliReport, /numero\.style\.backgroundColor = SchermataSegnalazioni\.coloreCss\(riepilogo\.gravita\);/);
    //Il ricontrollo dopo la scheda rilegge il box prima di chiedere il dato al server.
    const ricontrollo = flussoReport.substring(flussoReport.indexOf("async _ricontrollaReferenzaDopoScheda("));
    assert.ok(ricontrollo.indexOf("this._aggiornaSegnalazioniDelRecord(record, box);") > 0);
    assert.ok(ricontrollo.indexOf("this._aggiornaSegnalazioniDelRecord(record, box);") < ricontrollo.indexOf("this._leggiSchedaRefAggiornata("));
    //Nella vista whitelist il numero e' quello del report.
    assert.match(flussoReport, /filtered\.segnalazioniImpaginazione = reportRecord\.segnalazioniImpaginazione;/);
});

/* ---- I20-1116: il segnalino delle segnalazioni nella testata ---- */

//Un jQuery finto per il segnalino e l'icona: gli elementi per selettore, con quello che
//aggiornaIcona usa (text, css, attr). Registra l'ultimo stato di ciascuno.
function testataFinta() {
    const elemento = () => {
        const el = { length: 1, testo: "", stile: {}, attributi: {} };
        el.text = (t) => { el.testo = t; return el; };
        el.css = (s) => { Object.assign(el.stile, s); return el; };
        el.attr = (n, v) => { el.attributi[n] = v; return el; };
        return el;
    };
    const elementi = {
        "#segnalinoSegnalazioni": elemento(),
        "#testoSegnalinoSegnalazioni": elemento(),
        "#iconaSegnalazioniImpaginazione": elemento()
    };
    return { elementi, $: (sel) => elementi[sel] || { length: 0 } };
}

function conTestata(documento, fn) {
    const testata = testataFinta();
    const prima = { $: global.$, docInLavorazione: global.docInLavorazione };
    global.$ = testata.$;
    global.docInLavorazione = documento;
    try {
        fn(testata.elementi);
    }
    finally {
        global.$ = prima.$;
        global.docInLavorazione = prima.docInLavorazione;
        SchermataSegnalazioni._ultimoControllo = null;
    }
}

test("I20-1116: il segnalino dice quante segnalazioni, col colore della piu' grave", () => {
    const stato = SchermataSegnalazioni.statoSegnalino({ segnalazioni: 3, errori: 1, gravita: "error" });
    assert.strictEqual(stato.visibile, true);
    assert.strictEqual(stato.testo, "3 segnalazioni");
    assert.strictEqual(stato.colore, "#c62828");
    assert.strictEqual(stato.suggerimento, "3 segnalazioni irrisolte (1 errore) all'ultimo controllo: clicca per aprire le segnalazioni");

    const soloWarning = SchermataSegnalazioni.statoSegnalino({ segnalazioni: 1, errori: 0, gravita: "warning" });
    assert.strictEqual(soloWarning.testo, "1 segnalazione");
    assert.strictEqual(soloWarning.colore, "#ef6c00");
});

test("I20-1126: senza segnalazioni il segnalino e' verde, \"Nessuna segnalazione\"; senza controllo non si vede", () => {
    const nessuna = SchermataSegnalazioni.statoSegnalino({ segnalazioni: 0, errori: 0, gravita: null, controllato: true });
    assert.strictEqual(nessuna.visibile, true);
    assert.strictEqual(nessuna.testo, "Nessuna segnalazione");
    assert.strictEqual(nessuna.colore, "#2e7d32");
    assert.match(nessuna.suggerimento, /clicca per aprire le segnalazioni/);
    //Nessun documento, o un documento non ancora controllato: lo zero non dice niente.
    assert.strictEqual(SchermataSegnalazioni.statoSegnalino({ segnalazioni: 0, errori: 0, gravita: null, controllato: false }).visibile, false);
    assert.strictEqual(SchermataSegnalazioni.statoSegnalino(null).visibile, false);
});

test("I20-1126: con le segnalazioni disattivate il segnalino e' grigio, anche se ce ne sono", () => {
    [0, 3].forEach(quante => {
        const stato = SchermataSegnalazioni.statoSegnalino({ segnalazioni: quante, errori: 0, gravita: quante > 0 ? "warning" : null, controllato: true }, true);
        assert.strictEqual(stato.visibile, true);
        assert.strictEqual(stato.testo, "Segnalazioni disattivate");
        assert.strictEqual(stato.colore, "#9e9e9e");
        assert.match(stato.suggerimento, /riattivarle/);
    });
    //Senza controllo resta nascosto comunque.
    assert.strictEqual(SchermataSegnalazioni.statoSegnalino({ segnalazioni: 0, controllato: false }, true).visibile, false);
});

test("I20-1116: l'icona del menabo' e il segnalino si aggiornano insieme; senza segnalazioni l'icona sparisce e il segnalino diventa verde", () => {
    conTestata({ id: 7 }, (el) => {
        SchermataSegnalazioni.registraControllo("id:7", [lettura("3", "error"), lettura("5", "warning")]);
        SchermataSegnalazioni.aggiornaIcona();
        assert.strictEqual(el["#segnalinoSegnalazioni"].stile.display, "flex");
        assert.strictEqual(el["#testoSegnalinoSegnalazioni"].testo, "2 segnalazioni");
        assert.strictEqual(el["#testoSegnalinoSegnalazioni"].stile.backgroundColor, "#c62828");
        assert.strictEqual(el["#iconaSegnalazioniImpaginazione"].testo, "2");

        //Tutto risolto: le pagine rilette a zero. I20-1126: il segnalino resta, verde; l'icona sparisce.
        SchermataSegnalazioni.registraControllo("id:7", [], ["3", "5"]);
        SchermataSegnalazioni.aggiornaIcona();
        assert.strictEqual(el["#segnalinoSegnalazioni"].stile.display, "flex");
        assert.strictEqual(el["#testoSegnalinoSegnalazioni"].testo, "Nessuna segnalazione");
        assert.strictEqual(el["#testoSegnalinoSegnalazioni"].stile.backgroundColor, "#2e7d32");
        assert.strictEqual(el["#iconaSegnalazioniImpaginazione"].stile.display, "none");
    });
});

test("I20-1116: con un altro documento il segnalino del documento controllato non resta", () => {
    conTestata({ id: 8 }, (el) => {
        SchermataSegnalazioni.registraControllo("id:7", [lettura("3", "error")]);
        SchermataSegnalazioni.aggiornaIcona();
        assert.strictEqual(el["#segnalinoSegnalazioni"].stile.display, "none");
    });
});

test("I20-1116: il clic sul segnalino apre tutto il documento, non con la scheda in vista controllata", async () => {
    const apri = SchermataSegnalazioni.apri;
    const prima = global.indesignEvents;
    const aperture = [];
    SchermataSegnalazioni.apri = (opzioni) => { aperture.push(opzioni); return Promise.resolve(true); };
    try {
        global.indesignEvents = { vistaControllataAperta: () => false };
        assert.strictEqual(await SchermataSegnalazioni.apriDalSegnalino(), true);
        //Senza opzioni: tutto il documento, col caricamento, come dal pulsante del menabo'.
        assert.deepStrictEqual(aperture, [undefined]);

        global.indesignEvents = { vistaControllataAperta: () => true };
        assert.strictEqual(await SchermataSegnalazioni.apriDalSegnalino(), false);
        assert.strictEqual(aperture.length, 1);
    }
    finally {
        SchermataSegnalazioni.apri = apri;
        global.indesignEvents = prima;
    }
});

test("I20-1116: il segnalino sta in fondo alla riga delle linguette, centrato con loro, nascosto finche' non ci sono segnalazioni", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    //Sotto il nome del kit non c'e' piu': #kitSelezionato e' tornato vuoto come prima.
    const kit = html.substring(html.indexOf('<div id="kitSelezionato"'), html.indexOf('<div class="row" id="messaggiUtente"'));
    assert.doesNotMatch(kit, /segnalinoSegnalazioni/);
    //Nella riga delle linguette, dopo la barra.
    const righe = html.substring(html.indexOf("<!-- Qui inserisco il tab -->"), html.indexOf('<div class="row subMenuTabs"'));
    assert.ok(righe.indexOf('id="barraTab"') < righe.indexOf('id="appoggioSegnalino"'));
    //L'appoggio e' largo zero, spinto a destra e alto quanto la riga: la testata non si allunga.
    assert.match(righe, /<div id="appoggioSegnalino" style="position: relative; width: 0px; margin-left: auto; align-self: stretch;">/);
    //Fisso con right 0: al bordo del pannello lo aggancia il motore grafico. Alto quanto le linguette,
    //con il testo centrato: allineato a Home, Menabo', Utility.
    assert.match(righe, /<div id="segnalinoSegnalazioni" style="display: none; position: fixed; right: 0px; height: 27px; align-items: center;[^"]*"\s*onclick="SchermataSegnalazioni\.apriDalSegnalino\(\)">\s*<span id="testoSegnalinoSegnalazioni"/);
    //Esce dal bordo destro e lo avvolge: arrotondato a sinistra, piega scura a destra, niente parte piatta a sinistra.
    const testo = righe.substring(righe.indexOf('<span id="testoSegnalinoSegnalazioni"'));
    assert.match(testo, /border-right: 3px solid rgba\(0, 0, 0, 0\.35\); border-radius: 8px 0 0 8px;/);
    assert.doesNotMatch(testo.substring(0, testo.indexOf(">")), /border-left/);
    //La testata e' fissa: il segnalino e' dentro, quindi resta visibile cambiando sezione.
    const intestazione = html.substring(html.indexOf('<div id="header"'), html.indexOf('<div class="row subMenuTabs"'));
    assert.match(html.substring(html.indexOf('<div id="header"'), html.indexOf('<div id="header"') + 200), /position: fixed;/);
    assert.match(intestazione, /id="segnalinoSegnalazioni"/);
});

//Lo z-index nello stile in linea di un elemento di index.html; senza z-index vale 0.
function zIndexInIndex(html, id) {
    const inizio = html.indexOf('id="' + id + '"');
    assert.ok(inizio >= 0, "manca #" + id);
    const stile = html.substring(inizio).match(/style="([^"]*)"/);
    const z = stile ? stile[1].match(/z-index:\s*(\d+)/) : null;
    return z ? Number(z[1]) : 0;
}

test("I20-1128: il riquadro dei messaggi sta sopra il segnalino, ma sotto finestre e caricamenti", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const messaggi = zIndexInIndex(html, "messaggiUtente");
    //Entrambi fissi nella testata: senza z-index vinceva il segnalino, che viene dopo nel documento.
    assert.ok(messaggi > zIndexInIndex(html, "segnalinoSegnalazioni"));
    //Non sale sopra cio' che prima lo copriva.
    for (const id of ["narrow", "loginPanel", "overlayModal", "loadingPanel", "istantaDownAlert"]) {
        assert.ok(messaggi < zIndexInIndex(html, id), "#messaggiUtente sopra #" + id);
    }
});

test("I20-1116: cambiando documento o restando senza, il segnalino si riallinea", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indexNew, /docInLavorazione = args\[0\];[\s\S]{0,400}\$\("#nomeKitInLavorazione"\)\.text\(""\);\s*\/\/I20-1116[^\n]*\n\s*SchermataSegnalazioni\.aggiornaIcona\(\);\s*await initDocumentInLavorazione\(\);/);
    assert.match(indexNew, /docInLavorazione = null;\s*\$\("#nomeKitInLavorazione"\)\.text\(""\);\s*\/\/I20-1116[^\n]*\n\s*SchermataSegnalazioni\.aggiornaIcona\(\);/);
});

/* ---- I20-1116, lotto 2: la vista affiancata a pannello largo ---- */

//I20-1121: soglia, misure e confinamento delle barre sono passati in vistaAffiancata.js, comuni
//al Report Integrita' (vistaAffiancata.test.js). Qui resta la scelta della schermata.
test("I20-1121: la schermata e' una colonna da 924 px di pannello, ma non accanto a un'altra colonna", () => {
    const VistaAffiancata = require("../../plugin/vistaAffiancata");
    const prima = { larghezza: VistaAffiancata.larghezzaPannello, $: global.$, colonne: VistaAffiancata._colonne };
    let larghezza = 924;
    let reportAperto = false;
    VistaAffiancata.larghezzaPannello = () => larghezza;
    VistaAffiancata._colonne = ["colonnaSegnalazioni", "colonnaReportIntegrita"];
    global.$ = (sel) => ({ length: sel === "#colonnaReportIntegrita" && reportAperto ? 1 : 0 });
    try {
        assert.strictEqual(SchermataSegnalazioni.formaSchermata(), "colonna");
        larghezza = 923;
        assert.strictEqual(SchermataSegnalazioni.formaSchermata(), "popup");
        //Il report affiancato ha la precedenza: le segnalazioni si aprono come popup.
        larghezza = 1600;
        reportAperto = true;
        assert.strictEqual(SchermataSegnalazioni.formaSchermata(), "popup");
        reportAperto = false;
        assert.strictEqual(SchermataSegnalazioni.formaSchermata(), "colonna");
    }
    finally {
        VistaAffiancata.larghezzaPannello = prima.larghezza;
        VistaAffiancata._colonne = prima.colonne;
        global.$ = prima.$;
    }
});

test("I20-1116 lotto 2: Vai al box dalla colonna seleziona il box, senza vista controllata", () => {
    const seleziona = SchermataSegnalazioni._selezionaBox;
    const prima = { $: global.$, ReportIntegrita: global.ReportIntegrita };
    const selezionati = [];
    const blocchi = [];
    SchermataSegnalazioni._selezionaBox = (box) => { selezionati.push(box); return true; };
    //Con la colonna aperta conta solo questo: elenco.closest, in UXP, non la riconosceva.
    global.$ = (sel) => ({ length: sel === "#colonnaSegnalazioni" ? 1 : 0 });
    global.ReportIntegrita = { _applicaBloccoSchedaDalReport: () => blocchi.push(true) };
    try {
        const box = { label: "BOX12" };
        const elenco = { closest: () => ({ length: 0 }) };
        assert.strictEqual(SchermataSegnalazioni.vaiAlBox(box, elenco), true);
        assert.deepStrictEqual(selezionati, [box]);
        //Niente vista controllata: menu al loro posto, nessuna scheda "aperta dalle segnalazioni".
        assert.strictEqual(blocchi.length, 0);
        assert.strictEqual(SchermataSegnalazioni._schedaAperta, null);
    }
    finally {
        SchermataSegnalazioni._selezionaBox = seleziona;
        global.$ = prima.$;
        global.ReportIntegrita = prima.ReportIntegrita;
    }
});

test("I20-1116: Vai al box centra la vista sul box selezionato, senza cambiare lo zoom", () => {
    const prima = global.app;
    const zoom = [];
    const finestra = { activePage: null };
    Object.defineProperty(finestra, "zoomPercentage", { get: () => 75, set: (v) => zoom.push(v) });
    global.app = { activeWindow: finestra, selection: [] };
    try {
        const pagina = { name: "4" };
        const box = { parentPage: pagina };
        assert.strictEqual(SchermataSegnalazioni._selezionaBox(box), true);
        assert.strictEqual(finestra.activePage, pagina);
        assert.deepStrictEqual(global.app.selection, [box]);
        assert.deepStrictEqual(zoom, [75]);
    }
    finally {
        global.app = prima;
    }
});

test("I20-1116: se il centraggio non riesce la selezione resta", () => {
    const finestra = {};
    Object.defineProperty(finestra, "zoomPercentage", { get: () => { throw new Error("nessuna vista"); } });
    const errore = console.error;
    console.error = () => {};
    try {
        assert.strictEqual(SchermataSegnalazioni.centraSullaSelezione(finestra), false);
        assert.strictEqual(SchermataSegnalazioni.centraSullaSelezione(null), false);
    }
    finally {
        console.error = errore;
    }
});

test("I20-1116 lotto 2: la colonna si apre a pannello largo, si rilegge e segue il pannello", () => {
    //apri sceglie la forma dalla larghezza del pannello.
    assert.match(schermataLotto2(), /if \(SchermataSegnalazioni\.formaSchermata\(\) === "colonna"\) \{\s*SchermataSegnalazioni\._apriColonna\(elenco\);\s*return true;\s*\}/);
    //Dopo un controllo da fuori (risoluzione dalla scheda, Reimpagina, documento aperto) la colonna si rilegge.
    assert.match(schermataLotto2(), /controllaPagine\(pagine\) \{[\s\S]*?SchermataSegnalazioni\._leggi\(pagine\);\s*SchermataSegnalazioni\._rileggiColonna\(\);/);
    assert.match(schermataLotto2(), /controllaDocumento\(\) \{\s*SchermataSegnalazioni\._leggi\(null\);\s*SchermataSegnalazioni\._rileggiColonna\(\);/);
    //Chi apre una schermata nuova chiude anche la colonna.
    assert.match(schermataLotto2(), /chiudiAperta\(\) \{[\s\S]*?SchermataSegnalazioni\.chiudiColonna\(false\);\s*\}/);
    //I20-1121: il guscio della colonna (titolo, conteggio accanto, X) lo fa vistaAffiancata.js; fra
    //titolo e conteggio il margine vero sta li' (vistaAffiancata.test.js).
    assert.match(schermataLotto2(), /VistaAffiancata\.creaColonna\(\{\s*id: SchermataSegnalazioni\.ID_COLONNA,\s*titolo: SchermataSegnalazioni\.TITOLO,\s*accantoAlTitolo: elenco\.data\('conteggio'\),/);

    //Il ciclo degli eventi guarda anche la larghezza del pannello; onresizeWindow adatta la vista.
    const eventi = leggiFileDelPlugin("events.js").replace(/\r/g, "");
    assert.match(eventi, /VistaAffiancata\.larghezzaPannello\(\) != lastPannelloDimension\)\)\{\s*onresizeWindow\(\);/);
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    //I20-1121: prima il report, che ha la precedenza sulla colonna, poi le segnalazioni.
    assert.match(indexNew, /function onresizeWindow\(\)\{\s*try\{\s*setTimeout\(function \(\) \{\s*\/\/I20-1116[^\n]*\n\s*lastPannelloDimension = VistaAffiancata\.larghezzaPannello\(\);\s*\/\/I20-1121[^\n]*\n\s*ReportIntegrita\.adattaVista\(\);\s*SchermataSegnalazioni\.adattaVista\(\);/);
});

function schermataLotto2() {
    return leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
}

test("I20-1116: il segnalino resta agganciato al bordo, all'altezza delle linguette; nella vista affiancata contro la colonna", () => {
    const VistaAffiancata = require("../../plugin/vistaAffiancata");
    const prima = { document: global.document, $: global.$, log: console.log, colonne: VistaAffiancata._colonne };
    const segnalino = { style: { right: "0px" }, offsetWidth: 110 };
    let riga = { top: 70, right: 487, height: 27 };
    let colonnaAperta = false;
    //I20-1121: contro qualunque colonna aperta, anche quella del Report Integrita'.
    let colonna = "#colonnaSegnalazioni";
    VistaAffiancata._colonne = ["colonnaSegnalazioni", "colonnaReportIntegrita"];
    global.document = { getElementById: (id) => ({ appoggioSegnalino: { getBoundingClientRect: () => riga }, segnalinoSegnalazioni: segnalino })[id] || null };
    global.$ = (sel) => ({ length: sel === colonna && colonnaAperta ? 1 : 0 });
    console.log = () => {};
    try {
        //Al bordo del pannello, senza calcoli, e all'altezza della riga delle linguette.
        SchermataSegnalazioni.allineaSegnalino();
        assert.strictEqual(segnalino.style.right, "0px");
        assert.strictEqual(segnalino.style.left, "auto");
        assert.strictEqual(segnalino.style.top, "70px");
        //Vista affiancata: finisce dove comincia la colonna (532).
        colonnaAperta = true;
        SchermataSegnalazioni.allineaSegnalino();
        assert.strictEqual(segnalino.style.right, "auto");
        assert.strictEqual(segnalino.style.left, "422px");
        colonna = "#colonnaReportIntegrita";
        segnalino.style.left = "auto";
        SchermataSegnalazioni.allineaSegnalino();
        assert.strictEqual(segnalino.style.left, "422px");
        colonna = "#colonnaSegnalazioni";
        //Chiusa la colonna torna al bordo.
        colonnaAperta = false;
        SchermataSegnalazioni.allineaSegnalino();
        assert.strictEqual(segnalino.style.right, "0px");
        assert.strictEqual(segnalino.style.left, "auto");
        //Senza misure l'altezza resta quella di prima, e il segnalino resta al bordo.
        riga = { top: 0, right: 0, height: 0 };
        SchermataSegnalazioni.allineaSegnalino();
        assert.strictEqual(segnalino.style.top, "70px");
        assert.strictEqual(segnalino.style.right, "0px");
    }
    finally {
        global.document = prima.document;
        global.$ = prima.$;
        console.log = prima.log;
        VistaAffiancata._colonne = prima.colonne;
    }
});

/* ---- I20-1126: disattivare le segnalazioni per la lavorazione ---- */

/// Le globali di indexNew per la voce della lavorazione, finte: una voce sola, in memoria.
function conLavorazione(voceIniziale, fn) {
    const salvate = [];
    const messaggi = [];
    const prima = {
        docInLavorazione: global.docInLavorazione, pathLavorazione: global.pathLavorazione, idMacchina: global.idMacchina,
        libroDelDocumentoInLavorazione: global.libroDelDocumentoInLavorazione, Utility: global.Utility,
        messaggioUtente: global.messaggioUtente, $: global.$
    };
    //La voce sta "nel file" come testo: ogni lettura ne da' una copia, e il salvataggio la unisce a
    //quella del file con Object.assign, come Utility.voceLavorazione e salvaVoceLavorazione veri.
    let nelFile = voceIniziale == null ? null : JSON.stringify(voceIniziale);
    const voce = () => nelFile == null ? null : JSON.parse(nelFile);
    global.docInLavorazione = { name: "VOL_P2623.indd", id: 9 };
    global.pathLavorazione = "/lavorazioni/";
    global.idMacchina = () => "sm2_test";
    global.libroDelDocumentoInLavorazione = () => null;
    global.Utility = {
        voceLavorazione: () => voce(),
        salvaVoceLavorazione: (base, macchina, v) => {
            salvate.push(JSON.parse(JSON.stringify(v)));
            const salvata = Object.assign(voce() || {}, v);
            nelFile = JSON.stringify(salvata);
            return salvata;
        }
    };
    global.messaggioUtente = (testo) => messaggi.push(testo);
    global.$ = () => ({ length: 0 });
    SchermataSegnalazioni._disattivateInMemoria = null;
    const ripristina = () => {
        Object.keys(prima).forEach(k => { if (prima[k] === undefined) { delete global[k]; } else { global[k] = prima[k]; } });
        SchermataSegnalazioni._disattivateInMemoria = null;
    };
    let esito;
    try {
        esito = fn({ salvate, messaggi, voce });
    }
    catch (e) {
        ripristina();
        throw e;
    }
    //Una prova asincrona: le globali si rimettono quando ha finito, non al primo await.
    if (esito != null && typeof esito.then === "function") {
        return esito.finally(ripristina);
    }
    ripristina();
    return esito;
}

test("I20-1126: la scelta sta nella voce della lavorazione, e si legge da li'", () => {
    assert.strictEqual(SchermataSegnalazioni.disattivateNellaVoce(null), false);
    assert.strictEqual(SchermataSegnalazioni.disattivateNellaVoce({ file: "a.indd" }), false);
    assert.strictEqual(SchermataSegnalazioni.disattivateNellaVoce({ file: "a.indd", segnalazioniDisattivate: true }), true);

    conLavorazione({ file: "VOL_P2623.indd", id: 3227 }, (lav) => {
        assert.strictEqual(SchermataSegnalazioni.disattivate(), false);

        assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(true), true);
        assert.deepStrictEqual(lav.salvate, [{ file: "VOL_P2623.indd", id: 3227, segnalazioniDisattivate: true }]);
        assert.strictEqual(SchermataSegnalazioni.disattivate(), true);

        //Riattivare scrive false: un campo tolto, unito alla voce del file, resterebbe true.
        assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(false), true);
        assert.deepStrictEqual(lav.salvate[1], { file: "VOL_P2623.indd", id: 3227, segnalazioniDisattivate: false });
        assert.deepStrictEqual(lav.voce(), { file: "VOL_P2623.indd", id: 3227, segnalazioniDisattivate: false });
        assert.strictEqual(SchermataSegnalazioni.disattivate(), false);
    });

    //Una voce rimasta con true dal primo giro di I20-1126 si riattiva lo stesso.
    conLavorazione({ file: "VOL_P2623.indd", id: 3227, segnalazioniDisattivate: true }, (lav) => {
        assert.strictEqual(SchermataSegnalazioni.disattivate(), true);
        assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(false), true);
        assert.strictEqual(lav.voce().segnalazioniDisattivate, false);
        assert.strictEqual(SchermataSegnalazioni.disattivate(), false);
    });
});

test("I20-1126: disattivare nasconde i bollini del documento, riattivare li mostra; senza lavorazione non si toccano", () => {
    const prima = Segnalazioni.mostraBolliniDelDocumento;
    const chiamate = [];
    Segnalazioni.mostraBolliniDelDocumento = (documento, visibili) => { chiamate.push([documento.name, visibili]); return 1; };
    try {
        conLavorazione({ file: "VOL_P2623.indd" }, () => {
            assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(true), true);
            assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(false), true);
        });
        assert.deepStrictEqual(chiamate, [["VOL_P2623.indd", false], ["VOL_P2623.indd", true]]);

        conLavorazione(null, () => {
            assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(true), false);
        });
        assert.strictEqual(chiamate.length, 2);
    }
    finally {
        Segnalazioni.mostraBolliniDelDocumento = prima;
    }
});

test("I20-1126: senza lavorazione non si disattiva niente, e l'operatore lo sa", () => {
    conLavorazione(null, (lav) => {
        assert.strictEqual(SchermataSegnalazioni.impostaDisattivate(true), false);
        assert.deepStrictEqual(lav.salvate, []);
        assert.match(lav.messaggi[0], /Code SGN-12/);
        assert.strictEqual(SchermataSegnalazioni.disattivate(), false);
    });
});

test("I20-1126: disattivate, la schermata non si apre da sola a fine impaginazione", async () => {
    const apri = SchermataSegnalazioni.apri;
    const aperture = [];
    SchermataSegnalazioni.apri = (opzioni) => { aperture.push(opzioni); return Promise.resolve(true); };
    try {
        await conLavorazione({ file: "VOL_P2623.indd", segnalazioniDisattivate: true }, async () => {
            assert.strictEqual(await SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [] }, ["11"]), false);
        });
        assert.deepStrictEqual(aperture, []);
        await conLavorazione({ file: "VOL_P2623.indd" }, async () => {
            assert.strictEqual(await SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [] }, ["11"]), true);
        });
        assert.strictEqual(aperture.length, 1);
    }
    finally {
        SchermataSegnalazioni.apri = apri;
    }
});

test("I20-1126: le tre scelte: Disattiva, Risolvi tutto e disattiva, Annulla", async () => {
    const prima = { Modali: global.Modali, risolvi: SchermataSegnalazioni.risolviTuttoIlDocumento, allaChiusura: SchermataSegnalazioni.allaChiusura };
    const domande = [];
    let risposta = null;
    let risolti = 0;
    global.Modali = { confirmCustom: async (...argomenti) => { domande.push(argomenti); return risposta; } };
    SchermataSegnalazioni.risolviTuttoIlDocumento = () => { risolti++; return 4; };
    SchermataSegnalazioni.allaChiusura = () => {};
    try {
        await conLavorazione({ file: "VOL_P2623.indd" }, async (lav) => {
            //Le tre scelte, in quest'ordine (Annulla la aggiunge confirmCustom per ultima).
            risposta = { result: false, hiddenVal: null };
            assert.strictEqual(await SchermataSegnalazioni.chiediDisattivazione(), null);
            assert.deepStrictEqual(domande[0].slice(1), ["Disattiva", "disattiva", "Risolvi tutto e disattiva", "risolvi"]);
            assert.strictEqual(risolti, 0);
            assert.deepStrictEqual(lav.salvate, []);

            risposta = { result: true, hiddenVal: "disattiva" };
            assert.strictEqual(await SchermataSegnalazioni.chiediDisattivazione(), "disattiva");
            assert.strictEqual(risolti, 0);
            assert.strictEqual(lav.voce().segnalazioniDisattivate, true);
        });
        await conLavorazione({ file: "VOL_P2623.indd" }, async (lav) => {
            risposta = { result: true, hiddenVal: "risolvi" };
            assert.strictEqual(await SchermataSegnalazioni.chiediDisattivazione(), "risolvi");
            assert.strictEqual(risolti, 1);
            assert.strictEqual(lav.voce().segnalazioniDisattivate, true);
        });
    }
    finally {
        global.Modali = prima.Modali;
        SchermataSegnalazioni.risolviTuttoIlDocumento = prima.risolvi;
        SchermataSegnalazioni.allaChiusura = prima.allaChiusura;
    }
});

/// Un elemento jQuery finto, quanto basta a _disegna: tiene figli, testo e dati.
function elementoFinto(html = "") {
    const el = {
        html, figli: [], testo: "", dati: {},
        css() { return el; }, attr() { return el; }, on() { return el; },
        text(t) { if (t === undefined) { return el.testo; } el.testo = t; return el; },
        append(figlio) { el.figli.push(figlio); return el; },
        empty() { el.figli = []; return el; },
        data(chiave, valore) { if (valore === undefined) { return el.dati[chiave]; } el.dati[chiave] = valore; return el; }
    };
    return el;
}

test("I20-1126: disattivate, la schermata mostra solo la barra con Riattiva; riattivate, torna l'elenco", () => {
    const prima = { blocco: SchermataSegnalazioni._bloccoBox, traduzioni: SchermataSegnalazioni._traduzioni, records: SchermataSegnalazioni._recordsDellaLavorazione };
    SchermataSegnalazioni._bloccoBox = (lettura) => elementoFinto("box " + lettura.box.nome);
    SchermataSegnalazioni._traduzioni = () => ({});
    SchermataSegnalazioni._recordsDellaLavorazione = () => [];
    //Il documento ha ancora i suoi bollini: disattivare non li toglie.
    const lette = [{ pagina: "3", box: { nome: "A" }, voci: [{}] }, { pagina: "5", box: { nome: "B" }, voci: [{}, {}] }];
    const disegna = () => {
        const elenco = elementoFinto();
        const conteggio = elementoFinto();
        elenco.data('conteggio', conteggio);
        SchermataSegnalazioni._disegna(elenco, lette, null);
        return { elenco, conteggio };
    };
    const testi = (el) => [el.testo].concat(el.figli.flatMap(testi)).filter(t => t !== "");
    try {
        conLavorazione({ file: "VOL_P2623.indd", segnalazioniDisattivate: true }, () => {
            global.$ = (html) => elementoFinto(html);
            const { elenco, conteggio } = disegna();
            assert.strictEqual(elenco.figli.length, 1);
            assert.deepStrictEqual(testi(elenco.figli[0]), ["Segnalazioni disattivate per questa lavorazione", "Riattiva segnalazioni"]);
            assert.strictEqual(conteggio.testo, "");
        });
        conLavorazione({ file: "VOL_P2623.indd", segnalazioniDisattivate: false }, () => {
            global.$ = (html) => elementoFinto(html);
            const { elenco, conteggio } = disegna();
            assert.deepStrictEqual(testi(elenco.figli[0]), ["Disattiva segnalazioni"]);
            assert.deepStrictEqual(elenco.figli.slice(1).map(f => f.testo || f.html), ["Pagina 3", "box A", "Pagina 5", "box B"]);
            assert.strictEqual(conteggio.testo, "3 segnalazioni in 2 box");
        });
    }
    finally {
        SchermataSegnalazioni._bloccoBox = prima.blocco;
        SchermataSegnalazioni._traduzioni = prima.traduzioni;
        SchermataSegnalazioni._recordsDellaLavorazione = prima.records;
    }
});

test("I20-1126: Risolvi tutto toglie il bollino da ogni box del documento", () => {
    const prima = { leggi: Segnalazioni.leggiDocumento, risolvi: Segnalazioni.risolviTutte, err: console.error };
    const tolti = [];
    const boxA = { nome: "A" }, boxB = { nome: "B" }, boxRotto = { nome: "rotto" };
    Segnalazioni.leggiDocumento = () => [{ pagina: "3", box: boxA, voci: [] }, { pagina: "5", box: boxB, voci: [] }, { pagina: "6", box: boxRotto, voci: [] }];
    Segnalazioni.risolviTutte = (box) => { if (box === boxRotto) { throw new Error("box tolto"); } tolti.push(box.nome); };
    console.error = () => {};
    try {
        assert.strictEqual(SchermataSegnalazioni.risolviTuttoIlDocumento(), 2);
        assert.deepStrictEqual(tolti, ["A", "B"]);
    }
    finally {
        Segnalazioni.leggiDocumento = prima.leggi;
        Segnalazioni.risolviTutte = prima.risolvi;
        console.error = prima.err;
    }
});

test("I20-1126: disattivate, l'impaginazione non scrive bollini e il Report Integrita' non avvisa", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indexNew.indexOf("function finalizzaSegnalazioni(");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));
    assert.match(corpo, /if \(boxImpaginato != null && segnalazioni\.length > 0 && !SchermataSegnalazioni\.disattivate\(\)\) \{\s*boxImpaginato = Segnalazioni\.applicaAlBox\(/);
    //Il report del giro resta: le segnalazioni si contano lo stesso.
    assert.match(corpo, /reportImpaginazioneObj\.segnalazioni\.push\(/);

    const report = leggiFileDelPlugin("reportIntegrita/reportIntegrita.js").replace(/\r/g, "");
    const avviso = report.substring(report.indexOf("async avvisoSegnalazioniPrimaDelReport("), report.indexOf("async vaiASegnalazioniDalReport("));
    assert.match(avviso, /if \(SchermataSegnalazioni\.disattivate\(\)\) \{\s*return \{ azione: "procedi", lette \};\s*\}\s*const testo = SchermataSegnalazioni\.testoAvvisoReport\(lette\);/);

    //E la schermata offre sempre, in cima, di disattivarle o riattivarle.
    const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
    assert.match(schermata, /elenco\.empty\(\);\s*\/\/I20-1126[^\n]*\n\s*elenco\.append\(SchermataSegnalazioni\._barraDisattivazione\(elenco\)\);/);
});

/* ---- I20-1138: "Risolvi" non chiude la schermata ---- */

//"Risolvi" con altre segnalazioni nel box ridisegna il bollino, e il disegno rifa' il gruppo del box:
//il gruppo nuovo ha un altro id. Col box selezionato il ciclo degli eventi lo prendeva per una ref
//appena scelta e chiudeva tutte le finestre, compresa la schermata delle segnalazioni.

function conGlobali(globali, fn) {
    const prima = {};
    Object.keys(globali).forEach(k => { prima[k] = global[k]; global[k] = globali[k]; });
    try {
        return fn();
    }
    finally {
        Object.keys(globali).forEach(k => { if (prima[k] === undefined) { delete global[k]; } else { global[k] = prima[k]; } });
    }
}

const boxFinto = (id, valido = true) => ({ id: id, isValid: valido });

test("il box selezionato e' quello solo nella selezione di InDesign", () => {
    const box = boxFinto(10);
    conGlobali({ app: { selection: [boxFinto(10)] } }, () => assert.strictEqual(SchermataSegnalazioni.eSelezionato(box), true));
    conGlobali({ app: { selection: [boxFinto(11)] } }, () => assert.strictEqual(SchermataSegnalazioni.eSelezionato(box), false));
    conGlobali({ app: { selection: [boxFinto(10), boxFinto(11)] } }, () => assert.strictEqual(SchermataSegnalazioni.eSelezionato(box), false));
    conGlobali({ app: { selection: [] } }, () => assert.strictEqual(SchermataSegnalazioni.eSelezionato(box), false));
    conGlobali({ app: { selection: [boxFinto(10)] } }, () => assert.strictEqual(SchermataSegnalazioni.eSelezionato(null), false));
});

test("il box rigruppato e selezionato si fa seguire dalla scheda, che lo seleziona e lo fa accettare", () => {
    const seguiti = [];
    const prima = boxFinto(10);
    const dopo = boxFinto(20);
    conGlobali({ schedaRef: { seguiBoxRicostruito(box) { seguiti.push(box); return true; } } }, () => {
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(prima, dopo, true), true);
    });
    assert.deepStrictEqual(seguiti, [dopo]);
});

test("senza la scheda il box nuovo si seleziona e il ciclo degli eventi lo accetta come gia' visto", () => {
    const selezionati = [];
    const accettati = [];
    const dopo = boxFinto(20);
    conGlobali({
        schedaRef: undefined,
        Utility: { selezionaBox(box) { selezionati.push(box); return true; } },
        indesignEvents: { accettaSelezione(ids) { accettati.push(ids); return true; } }
    }, () => {
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(boxFinto(10), dopo, true), true);
    });
    assert.deepStrictEqual(selezionati, [dopo]);
    assert.deepStrictEqual(accettati, [[20]]);
});

test("un box non selezionato, non rifatto o non valido non tocca la selezione", () => {
    const seguiti = [];
    const prima = boxFinto(10);
    conGlobali({ schedaRef: { seguiBoxRicostruito(box) { seguiti.push(box); return true; } } }, () => {
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(prima, boxFinto(20), false), false);
        //"Risolvi" sull'ultima segnalazione toglie il bollino: il box resta lo stesso.
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(prima, prima, true), false);
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(prima, boxFinto(20, false), true), false);
        assert.strictEqual(SchermataSegnalazioni.seguiBoxRigruppato(prima, null, true), false);
    });
    assert.deepStrictEqual(seguiti, []);
});

test("\"Risolvi\" guarda la selezione prima di risolvere, segue il box e passa il box nuovo a chi ridisegna", () => {
    const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
    assert.match(schermata, /text\("Risolvi"\)[\s\S]{0,200}?const eraSelezionato = SchermataSegnalazioni\.eSelezionato\(box\);\s*const dopo = Segnalazioni\.risolviVoce\(box, indice\);\s*SchermataSegnalazioni\.seguiBoxRigruppato\(box, dopo, eraSelezionato\);\s*alCambio\(dopo\);/);
});

test("la scheda ref rilegge le segnalazioni dal box che \"Risolvi\" le passa, e lo segue", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /SchermataSegnalazioni\.elencoVociDelBox\(box, voci, function \(dopo\) \{\s*const attuale = dopo != null && dopo\.isValid \? dopo : box;[\s\S]{0,300}?me\.refSelected\.item = attuale;[\s\S]{0,40}?me\.leggiVociBollino\(attuale\);/);
    assert.match(scheda, /SchermataSegnalazioni\.controllaPagine\(\[attuale\.parentPage\.name\]\);/);
});
