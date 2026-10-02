/*
 * I20-1029, lotto 1: le segnalazioni di impaginazione stanno tutte nel bollino del box.
 *
 * Prima il bollino portava come testo una sola segnalazione, la prima con applicaBollino, mandata
 * apposta in overflow, e le altre si perdevano. Ora il bollino e' vuoto, colorato con la gravita'
 * peggiore, e la sua etichetta le contiene tutte: segnalazioni$ seguito da un JSON. Un box rifatto
 * sostituisce il bollino invece di aggiungerne un altro.
 *
 * plugin/segnalazioni/etichetta.js e segnalazioni.js si caricano sotto Node: si provano davvero,
 * il secondo con box finti. indexNew.js, CssFramework.js e utility.js si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const etichetta = require("../../plugin/segnalazioni/etichetta");
const Segnalazioni = require("../../plugin/segnalazioni/segnalazioni");

/* ---- il formato dell'etichetta ---- */

test("la gravita' viene dal typeMessage di addSegnalazione", () => {
    assert.strictEqual(etichetta.gravita("error"), "error");
    assert.strictEqual(etichetta.gravita("Error"), "error");
    assert.strictEqual(etichetta.gravita("warning"), "warning");
    assert.strictEqual(etichetta.gravita("Notifica"), "notifica");
    assert.strictEqual(etichetta.gravita(null), "notifica");
});

test("il codice si prende dal testo, se c'e'", () => {
    assert.strictEqual(etichetta.codice("Code CSF-009: L'elemento con etichetta descrizione ..."), "CSF-009");
    assert.strictEqual(etichetta.codice("IDX-57.5 Errore generico durante l'impaginazione del box"), "IDX-57.5");
    assert.strictEqual(etichetta.codice("Descrizione spostata poichè uscita dai limiti del box"), null);
});

test("scritte e rilette, le voci tornano uguali, anche con $, apici e due punti nel testo", () => {
    const voci = [
        { g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra immagine$123 e \"prezzo\": 2 mm" },
        { g: "error", c: "CSF-009", t: "Code CSF-009: L'elemento con etichetta descrizione eccede" }
    ];

    const scritta = etichetta.scrivi(voci);
    assert.ok(scritta.startsWith("segnalazioni$"));
    //Rilette dalla piu' grave alla meno grave.
    assert.deepStrictEqual(etichetta.leggi(scritta), [voci[1], voci[0]]);
});

test("a parita' di gravita' resta l'ordine di arrivo", () => {
    const voci = [
        { g: "warning", c: null, t: "prima" },
        { g: "warning", c: null, t: "seconda" },
        { g: "error", c: null, t: "errore" }
    ];

    assert.deepStrictEqual(etichetta.ordina(voci).map(v => v.t), ["errore", "prima", "seconda"]);
});

test("un'etichetta che non e' di segnalazioni non si legge come tale", () => {
    assert.strictEqual(etichetta.leggi("descrizione$DNA$BOX7$123$456$7"), null);
    assert.strictEqual(etichetta.leggi(""), null);
    assert.strictEqual(etichetta.leggi(null), null);
    assert.strictEqual(etichetta.eDiSegnalazioni("segnalazioni$[]"), true);
});

test("un'etichetta di segnalazioni rovinata si legge come vuota, non come assente", () => {
    assert.deepStrictEqual(etichetta.leggi("segnalazioni${non e' json"), []);
    assert.deepStrictEqual(etichetta.leggi("segnalazioni$\"testo\""), []);
});

test("il colore e' quello della gravita' peggiore: rosso gli errori, arancione i warning", () => {
    assert.strictEqual(etichetta.gravitaPeggiore([{ g: "warning" }, { g: "error" }]), "error");
    assert.strictEqual(etichetta.gravitaPeggiore([{ g: "notifica" }, { g: "warning" }]), "warning");
    assert.strictEqual(etichetta.gravitaPeggiore([]), null);

    assert.strictEqual(etichetta.colore("error"), "red");
    assert.strictEqual(etichetta.colore("warning"), "orange");
    //CSF-013 era giallo: ora e' un warning come gli altri.
    assert.notStrictEqual(etichetta.colore("warning"), "yellow");
});

test("una segnalazione di addSegnalazione diventa una voce dell'etichetta", () => {
    assert.deepStrictEqual(
        etichetta.daSegnalazione({ msg: "Code CSF-013: Conflitto tra elementi", typeMessage: "warning", priority: 2 }),
        { g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra elementi" });
});

test("la stessa segnalazione non entra due volte: stessa chiave o stesso testo", () => {
    const raccolte = [{ msg: "Descrizione spostata", key: "descrizione_spostata" }, { msg: "Code CSF-009: x", key: null }];

    assert.strictEqual(etichetta.giaPresente(raccolte, { msg: "altro testo", key: "descrizione_spostata" }), true);
    assert.strictEqual(etichetta.giaPresente(raccolte, { msg: "Code CSF-009: x", key: null }), true);
    assert.strictEqual(etichetta.giaPresente(raccolte, { msg: "Code CSF-013: y", key: null }), false);
    assert.strictEqual(etichetta.giaPresente([], { msg: "a" }), false);
});

/* ---- il bollino nel documento, con box finti ---- */

//Un box finto: gli elementi, uno dei quali puo' essere il bollino; remove li toglie davvero.
function boxFinto(etichette) {
    const box = { label: "BOX7", allPageItems: [] };
    etichette.forEach(label => {
        const elemento = { label: label, rimosso: false };
        elemento.remove = function () { elemento.rimosso = true; box.allPageItems = box.allPageItems.filter(e => e !== elemento); };
        box.allPageItems.push(elemento);
    });
    return box;
}

//addBollinoCustom finto: ricorda come e' stato chiamato e aggiunge l'ovale con l'etichetta.
function conBollinoFinto(fn) {
    const chiamate = [];
    global.Utility = {
        addBollinoCustom(box, testo, colore, gradiente, posizione, bounds, overflow, etichettaBollino) {
            chiamate.push({ testo, colore, posizione, overflow, etichettaBollino });
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

test("il bollino e' vuoto, del colore della gravita' peggiore, con tutte le voci nell'etichetta", () => {
    conBollinoFinto(chiamate => {
        const box = boxFinto(["descrizione$DNA$BOX7$1$2$3"]);
        const voci = [{ g: "warning", c: "CSF-013", t: "conflitto" }, { g: "error", c: "CSF-009", t: "oltre la griglia" }];

        const restituito = Segnalazioni.applicaAlBox(box, voci);

        assert.strictEqual(restituito, box);
        assert.strictEqual(chiamate.length, 1);
        assert.strictEqual(chiamate[0].testo, "");
        assert.strictEqual(chiamate[0].colore, "red");
        assert.strictEqual(chiamate[0].posizione, Segnalazioni.POSIZIONE_BOLLINO);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ["CSF-009", "CSF-013"]);
    });
});

test("un box che ha gia' il bollino lo sostituisce, non ne aggiunge un altro", () => {
    conBollinoFinto(() => {
        const box = boxFinto(["descrizione$DNA$BOX7$1$2$3", etichetta.scrivi([{ g: "error", c: "CSF-009", t: "vecchia" }])]);

        Segnalazioni.applicaAlBox(box, [{ g: "warning", c: "CSF-013", t: "nuova" }]);

        assert.strictEqual(Segnalazioni.bolliniDelBox(box).length, 1);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.t), ["nuova"]);
    });
});

test("senza voci il bollino non si tocca: la seconda chiusura del box arriva vuota", () => {
    conBollinoFinto(chiamate => {
        const bollino = etichetta.scrivi([{ g: "error", c: "CSF-009", t: "resta" }]);
        const box = boxFinto([bollino]);

        Segnalazioni.applicaAlBox(box, []);

        assert.strictEqual(chiamate.length, 0);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.t), ["resta"]);
        assert.strictEqual(Segnalazioni.applicaAlBox(null, [{ g: "error", t: "x" }]), null);
    });
});

test("togliere il bollino lascia gli altri elementi del box", () => {
    const box = boxFinto(["descrizione$DNA$BOX7$1$2$3", "immagine$123", etichetta.scrivi([{ g: "error", t: "x" }])]);

    Segnalazioni.togliDalBox(box);

    assert.deepStrictEqual(box.allPageItems.map(e => e.label), ["descrizione$DNA$BOX7$1$2$3", "immagine$123"]);
});

test("dal documento si leggono le segnalazioni pagina per pagina, con il box che le contiene", () => {
    //Lotto 2: la lettura guarda gli ovali dei gruppi della pagina, non tutti gli elementi.
    //Le collezioni di InDesign hanno length e item(i): il documento finto le imita.
    const collezione = (elementi) => ({ length: elementi.length, item: (i) => elementi[i] });
    const box5 = { label: "BOX7", ovals: collezione([{ label: "logo" }, { label: etichetta.scrivi([{ g: "error", c: "CSF-009", t: "a" }]) }]), groups: collezione([]) };
    const box6 = { label: "BOX1", ovals: collezione([]), groups: collezione([]) };
    //Un box finito dentro un altro gruppo: il bollino e' un livello sotto.
    const interno = { label: "BOX2", ovals: collezione([{ label: etichetta.scrivi([{ g: "warning", c: null, t: "b" }]) }]), groups: collezione([]) };
    const raggruppato = { label: "", ovals: collezione([]), groups: collezione([interno]) };
    const documento = {
        pages: collezione([
            { name: "5", groups: collezione([box5]) },
            { name: "6", groups: collezione([box6]) },
            { name: "7", groups: collezione([raggruppato]) }
        ])
    };

    const lette = Segnalazioni.leggiDocumento(documento);

    assert.deepStrictEqual(lette.map(l => [l.pagina, l.box.label, l.voci.map(v => v.t)]), [["5", "BOX7", ["a"]], ["7", "BOX2", ["b"]]]);
    assert.deepStrictEqual(Segnalazioni.leggiDocumento(null), []);
});

test("la lettura del documento non scorre tutti gli elementi delle pagine", () => {
    //Misurato in console: 6339 ms scorrendo tutti gli elementi, 90 ms con i soli ovali dei gruppi.
    const corpo = leggiFileDelPlugin("segnalazioni/segnalazioni.js").replace(/\r/g, "");
    const inizio = corpo.indexOf("    leggiDocumento(documento) {");
    const lettura = corpo.substring(inizio, corpo.indexOf("\n    },\n", inizio));

    assert.doesNotMatch(lettura, /allPageItems/);
    assert.match(lettura, /elenco\(pagina\.groups\)/);
});

/* ---- lotto 4: i bollini di prima del I20-1029 ---- */

const collezioneDi = (elementi) => ({ length: elementi.length, item: (i) => elementi[i] });

//Un bollino vecchio come lo lasciava addBollinoCustom: ovale senza etichetta, colore, e un
//riquadro che mostra solo l'inizio della storia (misurato in console: "CSF-013 (Testo ").
function ovaleVecchio(testo, colore) {
    return {
        label: "",
        fillColor: { name: colore },
        textFrames: collezioneDi([{ contents: testo.substring(0, 15), parentStory: { contents: testo } }])
    };
}

//Un gruppo finto con ovali figli diretti (bollini e grafica) e tutti gli elementi; remove li toglie
//da entrambi, come in InDesign.
function gruppoFinto(ovali, altri = []) {
    const box = { label: "BOX1", _ovali: ovali.slice(), allPageItems: ovali.concat(altri) };
    Object.defineProperty(box, "ovals", { get: () => collezioneDi(box._ovali) });
    box.allPageItems.forEach(elemento => {
        elemento.remove = function () {
            elemento.rimosso = true;
            box._ovali = box._ovali.filter(e => e !== elemento);
            box.allPageItems = box.allPageItems.filter(e => e !== elemento);
        };
    });
    return box;
}

const SUFFISSO = " (Testo per mandare in overflow)";

test("la gravita' di un bollino vecchio viene dal colore: rosso errore, arancione e giallo warning", () => {
    assert.strictEqual(etichetta.gravitaDaColore("Red"), "error");
    assert.strictEqual(etichetta.gravitaDaColore("Orange"), "warning");
    assert.strictEqual(etichetta.gravitaDaColore("Yellow"), "warning");
    assert.strictEqual(etichetta.gravitaDaColore("Blue"), "notifica");
    assert.strictEqual(etichetta.gravitaDaColore(null), "notifica");
});

test("il testo di un bollino vecchio perde il pezzo per l'overflow, e Dif non e' una segnalazione", () => {
    assert.deepStrictEqual(etichetta.daBollinoVecchio("CSF-013" + SUFFISSO, "Yellow"), { g: "warning", c: "CSF-013", t: "CSF-013", vecchio: true });
    assert.deepStrictEqual(etichetta.daBollinoVecchio("Descrizione spostata poichè uscita dai limiti del box" + SUFFISSO, "Orange"),
        { g: "warning", c: null, t: "Descrizione spostata poichè uscita dai limiti del box", vecchio: true });
    assert.strictEqual(etichetta.daBollinoVecchio("Dif", "Orange"), null);
    assert.strictEqual(etichetta.daBollinoVecchio("  ", "Red"), null);
});

test("i doppioni si contano una volta sola", () => {
    const voce = { g: "warning", c: "CSF-013", t: "CSF-013", vecchio: true };
    assert.deepStrictEqual(etichetta.senzaDoppioni([voce, { ...voce }, { g: "error", c: "CSF-013", t: "CSF-013" }]).length, 2);
    assert.deepStrictEqual(etichetta.senzaDoppioni(null), []);
});

test("un box legge insieme il bollino nuovo e quelli vecchi: prima il nuovo, i vecchi uguali una volta", () => {
    const nuovo = { label: etichetta.scrivi([{ g: "error", c: "CSF-009", t: "oltre" }]) };
    const box = gruppoFinto([ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), nuovo, ovaleVecchio("CSF-013" + SUFFISSO, "Yellow")]);

    assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => [v.c, !!v.vecchio]), [["CSF-009", false], ["CSF-013", true]]);
    assert.strictEqual(Segnalazioni.bolliniVecchiDelBox(box).length, 2);
});

test("gli ovali della grafica non sono bollini vecchi: con etichetta, senza testo, o dentro il box", () => {
    const logo = { label: "logo", textFrames: collezioneDi([{ parentStory: { contents: "1+1" } }]), fillColor: { name: "Red" } };
    const tondo = { label: "", textFrames: collezioneDi([]), fillColor: { name: "Red" } };
    const rotto = { label: "", get textFrames() { throw new Error("oggetto non valido"); } };
    const interno = ovaleVecchio("CSF-009" + SUFFISSO, "Red");
    //interno sta fra tutti gli elementi ma non fra gli ovali figli diretti del gruppo.
    const box = gruppoFinto([logo, tondo, rotto], [interno]);

    assert.deepStrictEqual(Segnalazioni.leggiDalBox(box), []);
    Segnalazioni.togliDalBox(box);
    assert.ok(!logo.rimosso && !tondo.rimosso && !interno.rimosso);
});

test("rifare o fixare il box toglie anche i bollini vecchi, e lascia il resto", () => {
    const dna = { label: "descrizione$DNA$BOX1$1$2$3" };
    const vecchi = [ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), ovaleVecchio("Descrizione spostata" + SUFFISSO, "Orange")];
    const box = gruppoFinto(vecchi.concat([{ label: etichetta.scrivi([{ g: "error", t: "x" }]) }]), [dna]);

    Segnalazioni.togliDalBox(box);

    assert.deepStrictEqual(box.allPageItems, [dna]);
    assert.deepStrictEqual(Segnalazioni.leggiDalBox(box), []);
});

test("risolvere su un box con bollini vecchi lo porta a un solo bollino nuovo", () => {
    conBollinoFinto(chiamate => {
        const box = gruppoFinto([ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), ovaleVecchio("Descrizione spostata" + SUFFISSO, "Orange")]);

        Segnalazioni.risolviVoce(box, 0);

        assert.strictEqual(Segnalazioni.bolliniVecchiDelBox(box).length, 0);
        assert.strictEqual(chiamate.length, 1);
        assert.strictEqual(chiamate[0].colore, "orange");
        assert.deepStrictEqual(etichetta.leggi(chiamate[0].etichettaBollino).map(v => [v.t, v.vecchio]), [["Descrizione spostata", true]]);
    });
});

test("risolvere l'ultima segnalazione vecchia lascia il box senza bollini", () => {
    conBollinoFinto(chiamate => {
        const box = gruppoFinto([ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), ovaleVecchio("CSF-013" + SUFFISSO, "Yellow")]);

        Segnalazioni.risolviVoce(box, 0);

        assert.strictEqual(chiamate.length, 0);
        assert.strictEqual(Segnalazioni.bolliniVecchiDelBox(box).length, 0, "i doppioni se ne vanno insieme");
    });
});

test("dal documento i bollini vecchi si leggono con i nuovi, una voce per box, nello stesso ordine del box", () => {
    const nuovo = { label: etichetta.scrivi([{ g: "error", c: "CSF-009", t: "oltre" }]) };
    const misto = { label: "BOX12", ovals: collezioneDi([ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), nuovo]), groups: collezioneDi([]) };
    const soloVecchi = { label: "BOX1", ovals: collezioneDi([ovaleVecchio("CSF-013" + SUFFISSO, "Yellow"), ovaleVecchio("CSF-013" + SUFFISSO, "Yellow")]), groups: collezioneDi([]) };
    const confronto = { label: "BOX3", ovals: collezioneDi([ovaleVecchio("Dif", "Orange")]), groups: collezioneDi([]) };
    const documento = { pages: collezioneDi([{ name: "1", groups: collezioneDi([misto, soloVecchi, confronto]) }]) };

    const lette = Segnalazioni.leggiDocumento(documento);

    assert.deepStrictEqual(lette.map(l => [l.box.label, l.voci.map(v => v.c)]), [["BOX12", ["CSF-009", "CSF-013"]], ["BOX1", ["CSF-013"]]]);
});

test("nella schermata le segnalazioni vecchie si riconoscono", () => {
    const schermata = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");

    assert.match(schermata, /if \(voce\.vecchio\) \{\s*testo\.append\(\$\('<span><\/span>'\)\.text\(" \(bollino vecchio\)"\)/);
});

/* ---- dove si applica ---- */

test("i moduli nuovi non dipendono da InDesign", () => {
    for (const file of ["segnalazioni/etichetta.js", "segnalazioni/segnalazioni.js"]) {
        assert.doesNotMatch(leggiFileDelPlugin(file), /require\(['"]indesign['"]\)/, file);
    }
});

test("finalizzaSegnalazioni scrive tutte le segnalazioni nel bollino, non piu' solo la prima", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indexNew.indexOf("function finalizzaSegnalazioni(");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));

    assert.match(corpo, /Segnalazioni\.applicaAlBox\(boxImpaginato, segnalazioni\.map\(s => etichettaSegnalazioni\.daSegnalazione\(s\)\)\)/);
    assert.doesNotMatch(corpo, /Testo per mandare in overflow/);
    assert.doesNotMatch(corpo, /break;/);
    assert.match(corpo, /segnalazioniBoxImpaginato = \[\];/);
});

test("le segnalazioni partono vuote per ogni box, e un box rifatto perde il bollino vecchio", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    const impagina = indexNew.substring(indexNew.indexOf("async function impaginaBox("));
    assert.ok(impagina.indexOf("segnalazioniBoxImpaginato = [];") < impagina.indexOf("var trovato = false;"));

    const fix = indexNew.indexOf("segnalazioniBoxImpaginato = [];\n                boxImpaginato = Segnalazioni.togliDalBox(boxImpaginato);");
    const css = indexNew.indexOf("boxImpaginato = await callAllOperationFixBox(boxImpaginato, bounds, datiRef);");
    assert.ok(fix >= 0 && css > fix, "il bollino si toglie prima di rifare il box");

    assert.match(indexNew, /if \(etichettaSegnalazioni\.giaPresente\(segnalazioniBoxImpaginato, segnalazione\)\) \{\s*return;/);
});

test("descrizione spostata non disegna piu' un bollino suo", () => {
    const css = leggiFileDelPlugin("CssFramework.js");

    assert.doesNotMatch(css, /addBollinoCustom\(box, "Descrizione spostata/);
    assert.match(css, /addSegnalazione\("Descrizione spostata poichè uscita dai limiti del box"/);
});

test("addBollinoCustom mette l'etichetta sull'ovale, e senza etichetta resta come prima", () => {
    const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

    assert.match(utility, /addBollinoCustom\(box, text, colorString, colorGradient, positionEnum = 1, customBoundsRelativeToBox = null, overflowControls = true, etichettaBollino = null\)\{/);
    assert.match(utility, /if \(etichettaBollino != null\) \{\s*bollino\.label = etichettaBollino;/);
});
