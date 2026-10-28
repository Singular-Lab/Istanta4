/*
 * I20-1063: la scheda di piu' box selezionati insieme.
 *
 * Prima, selezionando piu' box, si apriva solo Raggruppa e restava in piedi la scheda del box
 * selezionato prima: Fix ed Elimina agivano sul primo box della selezione, le altre voci su
 * nessuno. Ora c'e' una scheda della selezione multipla: titolo "Selezione multipla", l'elenco
 * dei box, le azioni sul box che valgono per tutti (le altre disattivate), Elimina e Reimpagina su
 * tutti i box, il Ricollega quando sono tutti da ricollegare; descrizioni, segnalazioni, Fix,
 * Info, No render, Foto P/S, Foto extra, Sgruppa e Struttura non ci sono.
 *
 * Le decisioni stanno in membri puri di schedaRef.js e cambiStrutturali.js, che si caricano sotto
 * Node e si chiamano direttamente. Il markup e i punti di indexNew.js ed events.js, che sotto Node
 * non si caricano, si controllano sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

//Nel Plugin le label sono decorate con "$"; parseLabel tiene la parte prima.
global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const cambiStrutturali = require('../../plugin/cambiStrutturali');
const schedaRef = require('../../plugin/schedaRef');
const Modali = require('../../plugin/modali/modali');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');
const leggi = (nome) => fs.readFileSync(path.join(cartellaPlugin, nome), 'utf8').replace(/\r/g, '');

//Una riga di scheda come arriva da Menabo/getSchedeRefs.
function record(codice, codiceGruppo, campi = {}, primario = true, idRec = 10) {
    return {
        idRec: idRec,
        recordInTracciato: Object.assign({
            "Referenza.Codice": codice,
            "Scatto.CodiceGruppo": codiceGruppo,
            StatoSelezione: primario ? 1 : 2
        }, campi)
    };
}

//Un'azione come la restituisce getCambioStrutturalePath per un box.
function azione(id, titolo, opzioniValide = ["tutto", "primario"], istruzioni = [], campiInddCoinvolti = []) {
    return { id: id, titolo: titolo, opzioniValide: opzioniValide, istruzioni: istruzioni, campiInddCoinvolti: campiInddCoinvolti };
}

/* ---- le azioni sul box della selezione ---- */

test("un'azione e' comune se la ammettono tutti i box, e si riconosce dal titolo, non dall'id", () => {
    const voci = cambiStrutturali.azioniDellaSelezione([
        [azione(1, "Forza sconto"), azione(2, "Forza B&F")],
        [azione(1, "Forza B&F"), azione(2, "Forza sconto")],
        [azione(1, "Forza sconto")]
    ]);

    assert.deepStrictEqual(voci.map(v => [v.titolo, v.comune]), [["Forza sconto", true], ["Forza B&F", false]]);
    //Per ogni box la sua azione, null dove manca: i valori delle istruzioni sono quelli del box.
    assert.deepStrictEqual(voci[0].azioniPerBox.map(a => a.id), [1, 2, 1]);
    assert.deepStrictEqual(voci[1].azioniPerBox.map(a => a == null ? null : a.id), [2, 1, null]);
});

test("le opzioni gruppo/primario di un'azione sono quelle valide in tutti i box che la hanno", () => {
    const voci = cambiStrutturali.azioniDellaSelezione([
        [azione(1, "Forza sconto", ["tutto", "primario"])],
        [azione(1, "Forza sconto", ["tutto"])]
    ]);

    assert.deepStrictEqual(voci[0].opzioniValide, ["tutto"]);
});

test("senza box o senza azioni non c'e' niente da offrire", () => {
    assert.deepStrictEqual(cambiStrutturali.azioniDellaSelezione([]), []);
    assert.deepStrictEqual(cambiStrutturali.azioniDellaSelezione([[], []]), []);
    assert.deepStrictEqual(cambiStrutturali.azioniDellaSelezione(null), []);
});

test("un'azione che dichiara i campi InDesign vuole almeno uno di quei campi nel box", () => {
    const conCampi = azione(1, "Forza sconto", undefined, [], [{ label: "box_sconto" }, { label: "txt_sconto" }]);

    assert.strictEqual(cambiStrutturali.azioneConCampiNelBox(conCampi, ["descrizione", "txt_sconto"]), true);
    assert.strictEqual(cambiStrutturali.azioneConCampiNelBox(conCampi, ["descrizione"]), false);
    assert.strictEqual(cambiStrutturali.azioneConCampiNelBox(azione(2, "Senza campi"), []), true);
});

test("la scheda di un box usa lo stesso controllo dei campi della selezione multipla", () => {
    const sorgente = leggi('schedaRef.js');
    assert.match(sorgente, /let canDo = cambiStrutturaliJs\.azioneConCampiNelBox\(obj, etichetteNelBox\);/);
});

/* ---- lo stato dei box selezionati ---- */

test("box tutti impaginati, tutti da ricollegare o misti, dal codice di errore delle schede", () => {
    const stati = schedaRef.STATI_SELEZIONE_MULTIPLA;
    const impaginato = { records: [record("1", "1")], errorCode: 0 };
    const daRicollegare = { records: [], errorCode: 8, error: "Articolo non trovato" };

    assert.strictEqual(schedaRef.statoDellaSelezioneMultipla([impaginato, impaginato]), stati.impaginati);
    assert.strictEqual(schedaRef.statoDellaSelezioneMultipla([daRicollegare, daRicollegare]), stati.daRicollegare);
    assert.strictEqual(schedaRef.statoDellaSelezioneMultipla([impaginato, daRicollegare]), stati.misti);
});

test("una scheda che non si e' potuta leggere, o nessuna scheda, non apre la selezione", () => {
    const stati = schedaRef.STATI_SELEZIONE_MULTIPLA;
    const impaginato = { records: [record("1", "1")], errorCode: 0 };
    const illeggibile = { records: [], errorCode: 0, error: "sessione scaduta" };

    assert.strictEqual(schedaRef.statoDellaSelezioneMultipla([impaginato, illeggibile]), stati.nonLeggibili);
    assert.strictEqual(schedaRef.statoDellaSelezioneMultipla([]), stati.nonLeggibili);
});

/* ---- l'elenco dei box ---- */

test("la voce di un box ha il codice gruppo e la descrizione del primario", () => {
    const voce = schedaRef.voceDellaSelezioneMultipla({ codiceGruppo: "4525860" }, [
        record("4525860", "4525860", { "Descrizioni.Descrizione1": "PASTA BARILLA", "Descrizioni.Descrizione2": " gr 500 " })
    ]);

    assert.deepStrictEqual(voce, { codice: "4525860", descrizione: "PASTA BARILLA gr 500" });
});

test("in un gruppo la descrizione e' quella di gruppo, se il gruppo ne ha una", () => {
    const records = [
        record("2", "1,2", { "Descrizioni.Descrizione1": "SECONDARIO" }, false),
        record("1", "1,2", { "Descrizioni.Descrizione1": "PRIMARIO", descrizione_gruppo: { "Descrizioni.Descrizione1": "LINEA PASTA" } })
    ];

    assert.deepStrictEqual(schedaRef.voceDellaSelezioneMultipla({ codiceGruppo: "1,2" }, records), { codice: "1,2", descrizione: "LINEA PASTA" });
});

test("un box da ricollegare compare col suo codice e senza descrizione", () => {
    assert.deepStrictEqual(schedaRef.voceDellaSelezioneMultipla({ codiceGruppo: "999" }, []), { codice: "999", descrizione: "" });
});

/* ---- il riepilogo delle operazioni box per box ---- */

test("il riepilogo dice quanti box sono riusciti e, per quelli no, il motivo", () => {
    const a = { codice: "A" };
    const b = { codice: "B" };

    assert.deepStrictEqual(schedaRef.riepilogoSelezioneMultipla("Box reimpaginati", [{ voce: a, ok: true }, { voce: b, ok: true }]),
        { tipo: "success", testo: "Box reimpaginati: 2 box su 2" });

    const misto = schedaRef.riepilogoSelezioneMultipla("Box reimpaginati", [{ voce: a, ok: true }, { voce: b, ok: false, motivo: "pagina non trovata" }]);
    assert.strictEqual(misto.tipo, "warning");
    assert.strictEqual(misto.testo, "Box reimpaginati: 1 box su 2. Non riusciti: B (pagina non trovata)");

    assert.strictEqual(schedaRef.riepilogoSelezioneMultipla("Box reimpaginati", [{ voce: a, ok: false }]).tipo, "error");
});

/* ---- i parametri delle azioni per ogni box ---- */

test("ogni box manda il suo codice gruppo e il suo record, con i valori scelti dall'operatore", () => {
    const istruzioni = [
        { field: "Box$Formato", valore: null },
        { field: "Box$Tipo", valore: ["A", "B"] },
        { field: "Box$Fisso", valore: "PROPRIO" }
    ];
    const params = schedaRef.parametriAzioniDelBox(
        [record("123", "123", {}, true, 77)],
        [azione(1, "Forza", undefined, istruzioni)],
        { "Box$Formato": "B&F", "Box$Tipo": "B" },
        "tutto");

    assert.strictEqual(params,
        "codiceGruppo=123&idRec=77" +
        "&azioni[0].attributi.Box%24Formato=B%26F" +
        "&azioni[0].attributi.Box%24Tipo=B" +
        "&azioni[0].attributi.Box%24Fisso=PROPRIO");
});

test("\"solo il primario\" indica il codice solo per un gruppo", () => {
    const gruppo = [record("1", "1,2", {}, true, 5), record("2", "1,2", {}, false, 6)];
    const singolo = [record("3", "3", {}, true, 7)];

    assert.match(schedaRef.parametriAzioniDelBox(gruppo, [], {}, "primario"), /&azioni\[0\]\.codice=1$/);
    assert.doesNotMatch(schedaRef.parametriAzioniDelBox(singolo, [], {}, "primario"), /azioni\[0\]\.codice/);
    assert.doesNotMatch(schedaRef.parametriAzioniDelBox(gruppo, [], {}, "tutto"), /azioni\[0\]\.codice/);
});

/* ---- le voci che la selezione multipla non offre ---- */

//Un jQuery minimo sugli elementi del pannello: abbastanza per attr, removeAttr ed each; lo stile
//in linea sta in style, come nel DOM.
function finestraConVoci(voci) {
    const elementi = voci.map(v => ({ attributi: Object.assign({}, v.attributi), style: { display: v.display || "" } }));
    const avvolgi = (lista) => ({
        each(fn) { lista.forEach(el => fn.call(el)); return this; },
        attr(nome, valore) {
            if (valore === undefined) { return lista.length > 0 ? lista[0].attributi[nome] : undefined; }
            lista.forEach(el => { el.attributi[nome] = valore; });
            return this;
        },
        removeAttr(nome) { lista.forEach(el => { delete el.attributi[nome]; }); return this; }
    });
    const $ = (selettore) => {
        if (typeof selettore !== 'string') {
            return avvolgi([selettore]);
        }
        const m = /^\[data-selezione-multipla="(\w+)"\]$/.exec(selettore);
        return avvolgi(m ? elementi.filter(el => el.attributi["data-selezione-multipla"] === m[1]) : []);
    };
    return { $, elementi };
}

test("la selezione multipla nasconde le voci segnate; uscendo tornano com'erano, Sgruppa no", () => {
    const { $, elementi } = finestraConVoci([
        { attributi: { tab: "Tab6", "data-selezione-multipla": "nascosta" } },
        { attributi: { id: "sgruppa", "data-selezione-multipla": "nascosta" } },
        //Un contenitore del piede: e' flex, e flex deve tornare.
        { attributi: { "data-selezione-multipla": "nascosta" }, display: "flex" }
    ]);
    const prima = global.$;
    global.$ = $;
    try {
        schedaRef.impostaVociSelezioneMultipla(true);
        //Due selezioni multiple di fila: la seconda non deve tenere da parte "none".
        schedaRef.impostaVociSelezioneMultipla(true);
        assert.strictEqual(schedaRef.inSelezioneMultipla, true);
        assert.deepStrictEqual(elementi.map(e => e.style.display), ["none", "none", "none"]);

        schedaRef.impostaVociSelezioneMultipla(false);
        assert.strictEqual(schedaRef.inSelezioneMultipla, false);
        //Sgruppa lo rimostra la scheda di un box, e solo per un gruppo.
        assert.deepStrictEqual(elementi.map(e => e.style.display), ["", "none", "flex"]);
        assert.ok(elementi.every(e => e.attributi["data-display-prima"] === undefined));
    }
    finally {
        global.$ = prima;
    }
});

test("nel markup sono segnate le voci che la selezione multipla non offre, e solo quelle", () => {
    const html = leggi('index.html');

    const voci = (html.match(/<img[^>]*data-selezione-multipla="nascosta"[^>]*>/g) || []).map(t => (/tab="(\w+)"/.exec(t) || [])[1]);
    assert.deepStrictEqual(voci, ["Tab6", "Tab7", "Tab8", "Tab13"]);

    //Nel piede si nascondono i contenitori di Fix, Info e No render, cosi' Elimina e Reimpagina
    //restano vicini.
    const contenitori = [];
    const re = /<div[^>]*data-selezione-multipla="nascosta"[^>]*>\s*<img([^>]*)>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        contenitori.push(m[1]);
    }
    assert.strictEqual(contenitori.length, 3);
    assert.ok(contenitori.some(t => t.includes("fixRefImpaginata()")));
    assert.ok(contenitori.some(t => t.includes('id="infoRefImg"')));
    assert.ok(contenitori.some(t => t.includes('id="noRenderRefImg"')));

    //Edit, Elimina e Reimpagina restano.
    assert.ok(!/SubMenu_Edit_active\.png"[^>]*data-selezione-multipla/.test(html));
    assert.ok(!/data-selezione-multipla="nascosta"[^>]*>\s*<img[^>]*rimuoviRefImpaginata/.test(html));
    assert.ok(!/data-selezione-multipla="nascosta"[^>]*>\s*<img[^>]*applicaReimpaginazione/.test(html));
});

test("le schede della selezione multipla si chiedono come quella di un box, con gli idRec allineati ai codici", () => {
    const indexNew = leggi('indexNew.js');
    const inizio = indexNew.indexOf("async function getSchedeRefsMassivo(");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));
    //false come getSchedaRef: con true un box da ricollegare tornava con i suoi record.
    assert.match(corpo, /xhr\.send\("Menabo\/getSchedeRefs\/" \+ idKitLavorazione \+ "\/" \+ false, formData, "PUT"\);/);
    assert.match(corpo, /idRecs\.map\(id => id == null \|\| isNaN\(parseInt\(id\)\) \? 0 : parseInt\(id\)\)\.join\("-"\)/);
});

/* ---- Elimina, Reimpagina e la selezione ---- */

test("i codici da eliminare dal tracciato sono quelli di tutti i box, non solo del primo", () => {
    assert.deepStrictEqual(Modali.codiciDaEliminare(["1,2", "3", " 2 ", null]), ["1", "2", "3"]);
    assert.deepStrictEqual(Modali.codiciDaEliminare(null), []);
});

test("Elimina con piu' box selezionati li rimuove tutti, e la conferma li elenca", () => {
    const indexNew = leggi('indexNew.js');
    assert.match(indexNew, /if \(listaCodiciConId\.length == 0 && schedaRef\.inSelezioneMultipla\) \{/);
    assert.match(indexNew, /itemsDaRimuovere\.push\(boxDaRimuovere\(boxSelezionato\)\);/);
    assert.match(indexNew, /Modali\.confirmRimozioneRef\(codiciGruppo, vociSelezioneMultipla\)/);
    assert.match(indexNew, /Modali\.confermaSuPiuBox\("Procedere alla rimozione dall'impaginato di questi "/);
});

test("Reimpagina con piu' box selezionati li rifa' tutti", () => {
    const sorgente = leggi('schedaRef.js');
    assert.match(sorgente, /async applicaReimpaginazione\(\)\{\n(\s*\/\/[^\n]*\n)*\s*this\.boxReimpaginato = null;\n\s*\/\/I20-1063[^\n]*\n\s*if \(this\.inSelezioneMultipla\) \{\n\s*return await this\.reimpaginaSelezioneMultipla\(\);/);
    assert.match(sorgente, /await Modali\.confermaSuPiuBox\("Reimpaginare questi "/);
});

test("la selezione multipla passa idRec e misure di ogni box, come la selezione di un box", () => {
    const events = leggi('events.js');
    const inizio = events.indexOf("me.lastSelectionDetails.push({");
    assert.notStrictEqual(inizio, -1);
    const dettaglio = events.substring(inizio, events.indexOf("});", inizio));
    assert.match(dettaglio, /idRec: dna\.idRec/);
    assert.match(dettaglio, /boxOriginalBounds: potentialRef\.geometricBounds/);
});

test("una scheda di un box ancora in arrivo non copre la selezione arrivata dopo", () => {
    const sorgente = leggi('schedaRef.js');
    assert.match(sorgente, /if \(me\.refSelected !== ref\) \{\n\s*console\.warn\("Scheda ref di una selezione non piu' attuale"\);/);
    //E la scheda di un box chiude la selezione multipla.
    assert.match(sorgente, /this\.svuotaRef\(\);\n\s*\/\/I20-1063[^\n]*\n\s*this\.esciDaSelezioneMultipla\(\);/);
});

test("Raggruppa compare solo con tutti i box impaginati, mai prima di saperlo", () => {
    const sorgente = leggi('schedaRef.js');
    const init = sorgente.substring(sorgente.indexOf("    async initMultiSchedaRef(refs) {"), sorgente.indexOf("    /* ---- I20-1063: la scheda della selezione multipla ---- */"));
    //All'inizio si nasconde quello della selezione di prima, e qui non si mostra piu'.
    assert.match(init, /\$\("#raggruppaImage"\)\.hide\(\);/);
    assert.doesNotMatch(init, /\$\("#raggruppaImage"\)\.show\(\)/);
    assert.doesNotMatch(init, /SchermataRaggruppamento\(\)/);

    const mostra = sorgente.substring(sorgente.indexOf("    async mostraSchedaMultipla() {"), sorgente.indexOf("    componiTitoloSelezioneMultipla(quanti) {"));
    assert.strictEqual((mostra.match(/\$\("#raggruppaImage"\)\.show\(\)/g) || []).length, 1);
    assert.match(mostra, /if \(stato === stati\.impaginati\) \{\n\s*\$\("#raggruppaImage"\)\.show\(\);[\s\S]*?me\.SchermataRaggruppamento\(\);\n\s*\}\n\s*else \{\n\s*\$\("#raggruppaImage"\)\.hide\(\);/);
    //Box misti o non leggibili: avviso, niente Raggruppa, e il pannello torna alla home.
    const ramoNonApre = mostra.substring(mostra.indexOf("if (stato === stati.misti || stato === stati.nonLeggibili) {"), mostra.indexOf("return;"));
    assert.match(ramoNonApre, /\$\("#raggruppaImage"\)\.hide\(\);/);
    assert.match(ramoNonApre, /jsIndexControls\.changeSubMenu\(\$\("#homeImage"\)\.attr\("subTab"\)\);/);
});

test("il pulsante della scheda sta contro il bordo destro del piede", () => {
    const html = leggi('index.html');
    assert.match(html, /<div id="pulsantiExtra" style="[^"]*margin-left: auto;[^"]*">/);
});

/* ---- niente scorrimento orizzontale ---- */

//Un jQuery finto per costruire elementi: stile, attributi, testo e figli.
function jQueryCostruttore() {
    const crea = () => {
        const el = { stile: {}, attributi: {}, testo: "", figli: [] };
        const w = {
            el,
            css(nome, valore) {
                if (typeof nome === 'object') { Object.assign(el.stile, nome); }
                else { el.stile[nome] = valore; }
                return w;
            },
            attr(nome, valore) { el.attributi[nome] = valore; return w; },
            text(t) { el.testo = t; return w; },
            append(figlio) { el.figli.push(figlio.el); return w; }
        };
        return w;
    };
    return () => crea();
}

test("l'elenco dei box non si allarga: codice e descrizione lunghi restano su una riga coi puntini", () => {
    const prima = global.$;
    global.$ = jQueryCostruttore();
    try {
        const codiceLungo = Array.from({ length: 40 }, (_, i) => String(4525860 + i)).join(",");
        const descrizioneLunga = "PASTA DI SEMOLA DI GRANO DURO ".repeat(10).trim();
        const elenco = Modali.elencoBox([{ codice: codiceLungo, descrizione: descrizioneLunga }], false).el;

        assert.strictEqual(elenco.stile["max-width"], "100%");
        assert.strictEqual(elenco.stile["overflow"], "hidden");

        const riga = elenco.figli[0];
        assert.strictEqual(riga.stile["overflow"], "hidden");
        const [codice, descrizione] = riga.figli;
        for (const [testo, atteso] of [[codice, codiceLungo], [descrizione, descrizioneLunga]]) {
            assert.strictEqual(testo.testo, atteso);
            assert.strictEqual(testo.stile["white-space"], "nowrap");
            assert.strictEqual(testo.stile["text-overflow"], "ellipsis");
            assert.strictEqual(testo.stile["overflow"], "hidden");
            assert.strictEqual(testo.stile["max-width"], "100%");
            //Il testo intero resta nel suggerimento.
            assert.strictEqual(testo.attributi["title"], atteso);
        }
    }
    finally {
        global.$ = prima;
    }
});

test("le conferme di Elimina e Reimpagina su piu' box non scorrono in orizzontale", () => {
    const modali = leggi('modali/modali.js');
    assert.match(modali, /async confermaSuPiuBox\(titolo, voci\) \{[\s\S]*?\$\('<div style="[^"]*overflow-x: hidden;[^"]*"><\/div>'\);/);
    const eliminazione = leggi('modali/eliminazione.js');
    assert.match(eliminazione, /height: 75%;\n\s*overflow: auto;\n\s*overflow-x: hidden;/);
});

/* ---- versioni precedenti selezionate insieme ---- */

test("nella selezione multipla le versioni precedenti si riconoscono come per un box solo", () => {
    const events = leggi('events.js');
    const inizio = events.indexOf("me.lastSelectionDetails.push({");
    const dettaglio = events.substring(inizio, events.indexOf("});", inizio));
    assert.match(dettaglio, /versionePrecedente: VersionePrecedente\.eVersionePrecedente\(potentialRef\)/);
});

test("tutte versioni precedenti: Riporta in pagina; insieme a box in pagina: avviso; nessuna: scheda multipla", () => {
    const events = leggi('events.js');
    const ramo = events.substring(events.indexOf("let versioniPrecedenti = me.lastSelectionDetails.filter("), events.indexOf("else if(refInvalidCounted == 1){"));
    assert.match(ramo, /if \(versioniPrecedenti === me\.lastSelectionDetails\.length\) \{\n\s*me\.fireEvent\(me\.EVENT_NEW_VERSIONE_PRECEDENTE_SELECTED, me\.lastSelectionDetails\);/);
    assert.match(ramo, /else if \(versioniPrecedenti > 0\) \{\n\s*me\.fireEvent\(me\.EVENT_NEW_MULTIREF_VERSIONI_MISTE_SELECTED, me\.lastSelectionDetails\);/);
    assert.match(ramo, /else \{\n\s*me\.fireEvent\(me\.EVENT_NEW_MULTIREF_SELECTED, me\.lastSelectionDetails\);/);
});

test("Riporta in pagina con piu' versioni precedenti le riporta tutte e le lascia selezionate", () => {
    const indexNew = leggi('indexNew.js');
    const ascolto = indexNew.substring(indexNew.indexOf("indesignEvents.EVENT_NEW_VERSIONE_PRECEDENTE_SELECTED, async function"), indexNew.indexOf("function riportaVersionePrecedenteInPagina(box)"));
    assert.match(ascolto, /if \(args\.length > 1\) \{[\s\S]*?buttonText: "Riporta in pagina",\n\s*buttonCallback: function \(\) \{ riportaVersioniPrecedentiInPagina\(boxVersioni\); \}/);

    const riporta = indexNew.substring(indexNew.indexOf("function riportaVersioniPrecedentiInPagina(boxes) {"), indexNew.indexOf("indesignEvents.EVENT_NEW_MULTIREF_SELECTED"));
    assert.match(riporta, /VersionePrecedente\.riportaInPagina\(box, docInLavorazione\);\n\s*riportati\.push\(box\);/);
    assert.match(riporta, /indesignEvents\.resetLastSelection\(\);\n\s*app\.selection = riportati;/);
});

test("versioni precedenti e box in pagina insieme: niente scheda, niente Raggruppa, e l'avviso", () => {
    const indexNew = leggi('indexNew.js');
    const inizio = indexNew.indexOf("indesignEvents.EVENT_NEW_MULTIREF_VERSIONI_MISTE_SELECTED, async function");
    assert.notStrictEqual(inizio, -1);
    const ascolto = indexNew.substring(inizio, indexNew.indexOf("\n});", inizio));
    assert.match(ascolto, /schedaRef\.resetRefInterface\(\);/);
    assert.match(ascolto, /\$\("#refImage"\)\.hide\(\);\n\s*\$\("#raggruppaImage"\)\.hide\(\);/);
    assert.match(ascolto, /Code IDX-197 /);
    assert.doesNotMatch(ascolto, /initSchedaRef|initMultiSchedaRef/);
});
