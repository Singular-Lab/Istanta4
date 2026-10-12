/*
 * I20-1084: il salvataggio della descrizione dalla scheda ref decide dal contenuto.
 *
 * Una correzione della descrizione e' arrivata al server solo al secondo Salva modifiche: il
 * Plugin mandava una descrizione fondamentale col suo testo solo se il campo aveva ricevuto un
 * evento input, altrimenti "<untouched>", e con due tratti dello stesso stile vinceva l'ultimo
 * nell'ordine del pannello. Ora ogni descrizione si confronta con l'archivio, senza spazi e a capo
 * come il controllo di mismatch: uguale parte "<untouched>", diversa parte col testo. Con due
 * tratti con del testo per la stessa descrizione il salvataggio non parte, e nella finestra delle
 * differenze "Scegli quella del box" resta spento e dice perche'.
 *
 * InputEditController.js e schedaRef.js si caricano sotto Node; jQuery, la configurazione e
 * InDesign si fingono.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");
const InputEditController = require("../../plugin/InputEditController.js");
const schedaRef = require("../../plugin/schedaRef.js");

const NON_TOCCATO = "<untouched>";

//Gli stili universali di Coop: chi porta a quale descrizione fondamentale.
const UNIVERSALI = {
    DESCRIZIONE_TITOLO: { nome: "DESCRIZIONE_TITOLO", fondamentale: "descrizione1" },
    DESCRIZIONE_BRAND: { nome: "DESCRIZIONE_BRAND", fondamentale: "descrizione2" },
    DESCRIZIONE_TIPO: { nome: "DESCRIZIONE_TIPO", fondamentale: "descrizione3" },
    DESCRIZIONE_GRAMMATURA: { nome: "DESCRIZIONE_GRAMMATURA", fondamentale: "descrizione4" }
};

const ARCHIVIO = ["INSALATA DI MARE", "Coop", "condita", "300 g"];

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

//Un campo della scheda: stile, testo, e se ha ricevuto una modifica o e' un tratto nascosto.
function campo(stile, testo, opzioni = {}) {
    return { stile: stile, testo: testo, modificato: opzioni.modificato === true, nascosto: opzioni.nascosto === true };
}

//jQuery finto: sugli elementi della scheda attr, hasClass e val; sui selettori il pulsante e le
//azioni strutturali, con il display del pulsante registrato.
function jQueryFinto(pulsante, azioniStrutturali = 0) {
    return function (el) {
        if (el === "#salvaButton") {
            return { css: (nome, valore) => { if (nome === "display") { pulsante.display.push(valore); } } };
        }
        if (el === "#azioni_strutturali") {
            return { children: () => ({ length: azioniStrutturali }) };
        }
        return {
            attr: (nome) => nome === "currentcharacterstyle" ? el.stile : (nome === "trattonascosto" ? (el.nascosto ? "1" : undefined) : undefined),
            hasClass: (classe) => classe === "textModified" && el.modificato,
            val: () => el.testo
        };
    };
}

function globaliDellaScheda(pulsante, azioniStrutturali) {
    return {
        confronti: confronti,
        pluginMiddleware: {
            getCampo: () => null,
            getStiliBruciaturaDescrizione: () => ["MAX_PEZZI"],
            getNameStileUniversale: (s) => UNIVERSALI[s] || null
        },
        Utility: { parseLabel: (l) => String(l == null ? "" : l).split("$")[0] },
        messaggioUtente: () => {},
        $: jQueryFinto(pulsante || { display: [] }, azioniStrutturali)
    };
}

function controller(campi, stato = {}) {
    const c = Object.create(InputEditController.prototype);
    c.datasource = { descrizione: { modificato: stato.modificato === true, lista: campi } };
    c.descrInArchivio = stato.archivio || ARCHIVIO.slice();
    c.convalidaFirma = stato.convalidaFirma !== false;
    c.inMismatch = stato.inMismatch === true;
    c.solaLettura = stato.solaLettura === true;
    return c;
}

function salvataggio(campi, stato = {}, forzato = false) {
    return conGlobali(globaliDellaScheda(), () => controller(campi, stato).getOperazioniDiSalvataggioDaFare(forzato));
}

function descrizioni(operazioni) {
    const r = operazioni.revisione;
    return [r.descrizione1, r.descrizione2, r.descrizione3, r.descrizione4];
}

const QUATTRO_UGUALI = () => [
    campo("DESCRIZIONE_TITOLO", "INSALATA DI MARE"),
    campo("DESCRIZIONE_BRAND", "Coop"),
    campo("DESCRIZIONE_TIPO", "condita"),
    campo("DESCRIZIONE_GRAMMATURA", "300 g")
];

/* ---- dal contenuto, non dagli eventi ---- */

test("un testo cambiato parte al primo salvataggio, anche se il campo non ha registrato la modifica", () => {
    const campi = QUATTRO_UGUALI();
    campi[2].testo = "condita al limone";
    campi[3].testo = "250 g";

    const operazioni = salvataggio(campi);

    assert.deepStrictEqual(descrizioni(operazioni), [NON_TOCCATO, NON_TOCCATO, "condita al limone", "250 g"]);
    assert.deepStrictEqual(operazioni.trattiRipetuti, []);
});

test("un a capo o uno spazio in piu' non sono una modifica, nemmeno con il campo segnato come modificato", () => {
    const campi = QUATTRO_UGUALI();
    campi[0] = campo("DESCRIZIONE_TITOLO", "INSALATA\nDI  MARE ", { modificato: true });

    const operazioni = salvataggio(campi, { modificato: true });

    assert.deepStrictEqual(descrizioni(operazioni), [NON_TOCCATO, NON_TOCCATO, NON_TOCCATO, NON_TOCCATO]);
    //La copia InDesign della descrizione resta quella del box, a capo compreso.
    assert.match(operazioni.revisione.valoreInddSoloFondamentali, /<DESCRIZIONE_TITOLO>INSALATA\nDI {2}MARE <\/DESCRIZIONE_TITOLO>/);
});

test("niente di cambiato e firma convalidata: la descrizione non si manda", () => {
    const operazioni = salvataggio(QUATTRO_UGUALI());

    assert.deepStrictEqual(descrizioni(operazioni), [undefined, undefined, undefined, undefined]);
    assert.strictEqual(operazioni.revisione.valore, "");
});

test("in mismatch le descrizioni uguali all'archivio partono non toccate, le diverse col testo", () => {
    const campi = QUATTRO_UGUALI();
    campi[1].testo = "Fior fiore";

    const operazioni = salvataggio(campi, { inMismatch: true });

    assert.deepStrictEqual(descrizioni(operazioni), [NON_TOCCATO, "Fior fiore", NON_TOCCATO, NON_TOCCATO]);
});

test("descrizione ereditata, variante nuova o scelta del box: tutte col loro testo, come prima", () => {
    const operazioni = salvataggio(QUATTRO_UGUALI(), {}, true);

    assert.deepStrictEqual(descrizioni(operazioni), ARCHIVIO);
});

test("una descrizione svuotata parte vuota, e una che nel box non c'e' non si manda", () => {
    const campi = [campo("DESCRIZIONE_TITOLO", "INSALATA DI MARE"), campo("DESCRIZIONE_BRAND", " ")];

    const operazioni = salvataggio(campi);

    assert.deepStrictEqual(descrizioni(operazioni), [NON_TOCCATO, " ", undefined, undefined]);
});

/* ---- i tratti ripetuti ---- */

//La descrizione della issue: GRAMMATURA e TIPO due volte, tutti con del testo.
const CON_RIPETUTI = () => [
    campo("DESCRIZIONE_TITOLO", "INSALATA DI MARE"),
    campo("DESCRIZIONE_BRAND", "Coop"),
    campo("DESCRIZIONE_GRAMMATURA", "300 g"),
    campo("DESCRIZIONE_TIPO", "condita"),
    campo("DESCRIZIONE_GRAMMATURA", "sgocciolato 200 g"),
    campo("DESCRIZIONE_TIPO", "con olio di semi")
];

test("due tratti con del testo per la stessa descrizione: si dice quali, e quelle descrizioni non partono", () => {
    const operazioni = salvataggio(CON_RIPETUTI(), { modificato: true });

    assert.deepStrictEqual(operazioni.trattiRipetuti, [
        { fondamentale: "descrizione3", stili: ["DESCRIZIONE_TIPO"] },
        { fondamentale: "descrizione4", stili: ["DESCRIZIONE_GRAMMATURA"] }
    ]);
    assert.strictEqual(operazioni.revisione.descrizione3, undefined);
    assert.strictEqual(operazioni.revisione.descrizione4, undefined);
    assert.strictEqual(InputEditController.nomiDeiTrattiRipetuti(operazioni.trattiRipetuti), "DESCRIZIONE_TIPO, DESCRIZIONE_GRAMMATURA");
});

test("con i tratti ripetuti si ferma anche la scelta del box, che manda tutto", () => {
    const operazioni = salvataggio(CON_RIPETUTI(), {}, true);

    assert.strictEqual(operazioni.trattiRipetuti.length, 2);
    assert.strictEqual(operazioni.revisione.descrizione3, undefined);
});

test("il rimedio: i secondi tratti svuotati e il loro testo nel primo TIPO, e il salvataggio parte", () => {
    const campi = CON_RIPETUTI();
    campi[3].testo = "condita sgocciolato 200 g con olio di semi";
    campi[4].testo = "";
    campi[5].testo = "";

    const operazioni = salvataggio(campi);

    assert.deepStrictEqual(operazioni.trattiRipetuti, []);
    assert.deepStrictEqual(descrizioni(operazioni), [NON_TOCCATO, NON_TOCCATO, "condita sgocciolato 200 g con olio di semi", NON_TOCCATO]);
});

test("i campi vuoti che lo schema aggiunge non sono ripetuti, e la descrizione la da' quello col testo", () => {
    const campi = [
        campo("DESCRIZIONE_TITOLO", "INSALATA DI MARE"),
        campo("DESCRIZIONE_BRAND", ""),
        campo("DESCRIZIONE_TIPO", "condita"),
        campo("DESCRIZIONE_BRAND", "Fior fiore")
    ];

    const operazioni = salvataggio(campi);

    assert.deepStrictEqual(operazioni.trattiRipetuti, []);
    assert.strictEqual(operazioni.revisione.descrizione2, "Fior fiore");
});

test("i tratti nascosti e le bruciature non contano fra i ripetuti", () => {
    const voci = [
        { stile: "DESCRIZIONE_TIPO", fondamentale: "descrizione3", valore: "condita" },
        { stile: "DESCRIZIONE_TIPO", fondamentale: "descrizione3", valore: "testo nascosto", nascosto: true },
        { stile: "MAX_PEZZI", fondamentale: "descrizione3", valore: "MAX 4 PEZZI", bruciatura: true },
        { stile: "SENZA_FONDAMENTALE", fondamentale: null, valore: "x" },
        { stile: "SENZA_FONDAMENTALE", fondamentale: null, valore: "y" }
    ];

    assert.deepStrictEqual(conGlobali(globaliDellaScheda(), () => InputEditController.trattiRipetuti(voci)), []);
});

test("due stili diversi per la stessa descrizione sono ripetuti, e si nominano tutti e due", () => {
    const voci = [
        { stile: "DESCRIZIONE_TIPO", fondamentale: "descrizione3", valore: "condita" },
        { stile: "DESCRIZIONE_TIPO_BOLD", fondamentale: "descrizione3", valore: "al limone" }
    ];

    const ripetuti = conGlobali(globaliDellaScheda(), () => InputEditController.trattiRipetuti(voci));

    assert.strictEqual(InputEditController.nomiDeiTrattiRipetuti(ripetuti), "DESCRIZIONE_TIPO / DESCRIZIONE_TIPO_BOLD");
});

/* ---- quello che resta alla regola di prima ---- */

test("un tratto nascosto da solo segue la regola di prima: non toccato, se non in mismatch", () => {
    const campi = [campo("DESCRIZIONE_TITOLO", "INSALATA DI MARE"), campo("DESCRIZIONE_BRAND", "Coop nascosto", { nascosto: true })];

    assert.strictEqual(salvataggio(campi, { convalidaFirma: false }).revisione.descrizione2, NON_TOCCATO);
    assert.strictEqual(salvataggio(campi, { inMismatch: true }).revisione.descrizione2, "Coop nascosto");
});

test("in sola lettura i testi di un'altra variante non sono una modifica", () => {
    const campi = QUATTRO_UGUALI();
    campi[2].testo = "testo della variante di area";

    conGlobali(globaliDellaScheda(), () => {
        const c = controller(campi, { solaLettura: true, convalidaFirma: false });
        assert.strictEqual(c.descrizioneDiversaDallArchivio(), false);
        assert.strictEqual(c.getOperazioniDiSalvataggioDaFare(false).revisione.descrizione3, NON_TOCCATO);
    });
});

test("le bruciature restano fuori dal salvataggio come prima", () => {
    const campi = QUATTRO_UGUALI().concat([campo("MAX_PEZZI", "\nMAX 4 PEZZI PER CARTA SOCIO")]);
    campi[0].testo = "INSALATA DI MARE CONDITA";

    const operazioni = salvataggio(campi);

    assert.strictEqual(operazioni.revisione.descrizione1, "INSALATA DI MARE CONDITA");
    assert.doesNotMatch(operazioni.revisione.valoreIndd, /MAX/);
});

/* ---- il pulsante Salva modifiche ---- */

function displayDopoCheckStato(campi, stato = {}, azioniStrutturali = 0) {
    const pulsante = { display: [] };
    conGlobali(globaliDellaScheda(pulsante, azioniStrutturali), () => controller(campi, stato).checkStato());
    return pulsante.display[pulsante.display.length - 1];
}

test("il pulsante compare quando un testo e' diverso dall'archivio, anche senza evento", () => {
    const campi = QUATTRO_UGUALI();
    assert.strictEqual(displayDopoCheckStato(campi), "none");

    campi[3].testo = "250 g";
    assert.strictEqual(displayDopoCheckStato(campi), "block");
    //E con i tratti ripetuti, per sentirsi dire perche' non si puo' salvare.
    assert.strictEqual(displayDopoCheckStato(CON_RIPETUTI()), "block");
});

test("il pulsante si vede ancora in tutti i casi in cui si vedeva", () => {
    const uguali = QUATTRO_UGUALI();
    //Un campo modificato, una firma da convalidare, un mismatch, un'azione strutturale.
    assert.strictEqual(displayDopoCheckStato(uguali, { modificato: true }), "block");
    assert.strictEqual(displayDopoCheckStato(uguali, { convalidaFirma: false }), "block");
    assert.strictEqual(displayDopoCheckStato(uguali, { inMismatch: true }), "block");
    assert.strictEqual(displayDopoCheckStato(uguali, {}, 1), "block");
});

test("anche l'uscita dal campo conta come modifica, non solo la digitazione", () => {
    const sorgente = leggiFileDelPlugin("InputEditController.js").replace(/\r/g, "");
    assert.match(sorgente, /el\.on\('input change', function \(event\) \{/);
    //La decisione su descrizione1-4 la prende decidiFondamentali, non l'ultimo campo modificato.
    assert.doesNotMatch(sorgente, /if \(textModified \|\| this\.inMismatch \|\| descrizioneEreditata\)/);
});

/* ---- dove si usa nella scheda ---- */

test("Salva modifiche si ferma prima di chiamare il server se ci sono tratti ripetuti", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const salva = scheda.substring(scheda.indexOf("    salvaModifiche(schedaRef, codice, box, meccanica, page) {"), scheda.indexOf("xhrSalva.send(\"Revisore/salvaRefFromIndd\""));

    assert.match(salva, /console\.log\(opResult\);\s*(\/\/[^\n]*\n\s*)*if \(Array\.isArray\(opResult\.trattiRipetuti\) && opResult\.trattiRipetuti\.length > 0\) \{\s*messaggioUtente\("Code SRF-115 " \+ this\.motivoTrattiRipetuti\(opResult\.trattiRipetuti\) \+ " Non e' stato salvato niente\.", "warning", false, 8\);\s*return;\s*\}/);
    //Il tratto nascosto si dichiara, perche' il salvataggio lo lasci alla regola di prima.
    assert.match(scheda, /\$\('<textarea labelCorrispondente="descrizione" trattonascosto="1" currentCharacterStyle="' \+ nome_stile \+ '"/);
});

test("il messaggio dice gli stili ripetuti e il rimedio", () => {
    const motivo = schedaRef.motivoTrattiRipetuti([{ fondamentale: "descrizione4", stili: ["DESCRIZIONE_GRAMMATURA"] }]);

    assert.strictEqual(motivo, "La descrizione del box ha piu' tratti dello stesso stile (DESCRIZIONE_GRAMMATURA): unisci i testi in un solo tratto per stile, oppure usa \"Scegli quella del server\".");
});

test("i ripetuti del pannello li dice il controller della scheda, e senza controller non ce ne sono", () => {
    const prima = schedaRef.editRefFieldController;
    try {
        schedaRef.editRefFieldController = null;
        assert.deepStrictEqual(schedaRef.trattiRipetutiNelPannello(), []);
        schedaRef.editRefFieldController = { trattiRipetutiDellaDescrizione: () => [{ fondamentale: "descrizione3", stili: ["DESCRIZIONE_TIPO"] }] };
        assert.strictEqual(schedaRef.trattiRipetutiNelPannello().length, 1);
    }
    finally {
        schedaRef.editRefFieldController = prima;
    }
});

test("nella finestra \"Scegli quella del box\" resta spento, col motivo nel suggerimento e nell'avviso al clic", () => {
    const suggerimenti = [];
    const stile = {};
    const attributi = {};
    let clic = null;
    const pulsante = {
        0: { nome: "pulsante" },
        css: (valori) => Object.assign(stile, valori),
        attr: (nome, valore) => { attributi[nome] = valore; },
        on: (evento, fn) => { assert.strictEqual(evento, "click"); clic = fn; }
    };
    const aggiunti = [];
    const riga = {
        find: (selettore) => ({ length: aggiunti.filter(a => a.classe === selettore).length }),
        append: (el) => aggiunti.push(el)
    };
    const jq = (html) => {
        const el = { classe: "." + /class="([^"]+)"/.exec(html)[1], testo: null };
        el.text = (t) => { el.testo = t; return el; };
        el.css = () => el;
        return el;
    };
    const ripetuti = [{ fondamentale: "descrizione3", stili: ["DESCRIZIONE_TIPO"] }];

    conGlobali({ $: jq, Tooltip: { impostaTooltip: (el, testo) => suggerimenti.push([el, testo]) } }, () => {
        schedaRef.spegniSceltaDelBox(pulsante, riga, ripetuti);
        assert.strictEqual(stile.opacity, "0.5");
        assert.strictEqual(attributi["data-spento"], "1");
        assert.deepStrictEqual(suggerimenti, [[pulsante[0], schedaRef.motivoTrattiRipetuti(ripetuti)]]);

        clic();
        clic();
        assert.strictEqual(aggiunti.length, 1, "l'avviso compare una volta sola");
        assert.strictEqual(aggiunti[0].classe, ".avvisoTrattiRipetuti");
        assert.match(aggiunti[0].testo, /DESCRIZIONE_TIPO/);
    });
});

test("solo \"Scegli quella del box\" si spegne, e senza il suo click di salvataggio", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /var pulsante = me\.pulsanteFinestra\(testi\[azione\]\[0\], testi\[azione\]\[1\]\);\s*(\/\/[^\n]*\n\s*)*var ripetuti = azione === "descrizioneBox" \? me\.trattiRipetutiNelPannello\(\) : \[\];\s*if \(ripetuti\.length > 0\) \{\s*me\.spegniSceltaDelBox\(pulsante, riga, ripetuti\);\s*barra\.append\(pulsante\);\s*return;\s*\}\s*pulsante\.on\("click", async function \(\) \{/);
});
