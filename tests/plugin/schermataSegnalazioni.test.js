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

test("a fine impaginazione la schermata si apre solo se il giro ha prodotto segnalazioni", () => {
    let aperture = 0;
    const apri = SchermataSegnalazioni.apri;
    SchermataSegnalazioni.apri = () => { aperture++; };
    try {
        SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [] });
        SchermataSegnalazioni.apriSeCiSono(null);
        SchermataSegnalazioni.apriSeCiSono({});
        assert.strictEqual(aperture, 0);

        SchermataSegnalazioni.apriSeCiSono({ segnalazioni: [{ codiceGruppo: "1" }] });
        assert.strictEqual(aperture, 1);
    }
    finally {
        SchermataSegnalazioni.apri = apri;
    }
});

/* ---- la schermata, sul sorgente ---- */

const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");

test("la schermata legge il documento e offre vai al box, risolvi e risolvi tutte", () => {
    assert.match(schermata, /Segnalazioni\.leggiDocumento\(SchermataSegnalazioni\._documento\(\)\)/);
    assert.match(schermata, /\.text\("Vai al box"\)/);
    assert.match(schermata, /\.text\("Risolvi"\)\.on\('click', \(\) => \{\s*Segnalazioni\.risolviVoce\(lettura\.box, indice\);\s*SchermataSegnalazioni\.riempi\(elenco\);/);
    assert.match(schermata, /Modali\.popup\("Segnalazioni di impaginazione", elenco, "xl", SchermataSegnalazioni\.allaChiusura\)/);
    assert.match(schermata, /\.text\("Nessuna segnalazione nel documento\."\)/);
    //I testi entrano come testo, non come HTML.
    assert.match(schermata, /\$\('<span><\/span>'\)\.text\(voce\.t \|\| ""\)/);
});

test("risolvi tutte chiede conferma dentro il popup, non con Modali.confirm che starebbe sotto", () => {
    assert.match(schermata, /\.text\("Sicuro\? "\)/);
    assert.match(schermata, /\.text\("Sì"\)\.on\('click', \(\) => \{\s*Segnalazioni\.risolviTutte\(lettura\.box\);/);
    assert.doesNotMatch(schermata, /Modali\.confirm/);
});

test("vai al box porta alla pagina e seleziona il box, come il Report Integrita'", () => {
    assert.match(schermata, /app\.activeWindow\.activePage = box\.parentPage;\s*\}\s*app\.selection = \[box\];/);
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
    assert.match(indexNew, /stampaSegnalazioni\(reportImpaginazioneObj\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(impagina\) \{\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj\);/);
    //PoP: report e schermata, fuori dal giro di un libro.
    assert.match(indexNew, /if \(!\(jobImpaginazioneLibro\.stato == 1 && jobImpaginazioneLibro\.queue\.length > 0\)\) \{\s*stampaSegnalazioni\(reportImpaginazioneObj\);\s*SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj\);/);
    //Singola: solo fuori dalle operazioni massive.
    assert.match(indexNew, /if\(!massiveOperation\)\{\s*stampaSegnalazioni\(reportImpaginazioneObj\);\s*rimuoviSimboli\(\);[\s\S]{0,300}?SchermataSegnalazioni\.apriSeCiSono\(reportImpaginazioneObj\);/);

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
