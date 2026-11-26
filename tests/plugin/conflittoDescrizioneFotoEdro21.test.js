/*
 * I20-1276: dopo "Forza a sconto linea" la riga "REPARTO SURGELATI" della descrizione finiva sopra
 * la foto del prodotto, e il bollino non diceva niente.
 *
 * Due cause:
 * - le regole di conflitto di Edro21 vietavano alla descrizione di toccare i loghi (*foto_extra*),
 *   non le foto del prodotto (immagine$..., foto_secondaria$...);
 * - dopo un'azione sul box, confronti.confrontoBox porta testi e stili del box rifatto nel box
 *   vecchio, che tiene le foto dove stavano. Il controllo dei conflitti aveva misurato il box rifatto,
 *   che poi si butta: quello che resta in pagina non lo misurava nessuno.
 *
 * Ora la regola c'e', e dopo il confronto CssFramework.segnalazioniDopoConfronto da' al box che resta
 * il bollino del box rifatto, con le CSF-013 misurate su di lui: una gia' nel bollino non si ripete, una
 * non piu' vera si toglie, le altre si aggiungono.
 *
 * Secondo giro: il bollino ("segnalazioni$[...]") si abbinava come un campo. Con un bollino in tutti e
 * due i box restava quello vecchio: togliendo la forzatura del reparto restava la CSF-013 di prima,
 * tolta poi dalla scheda ref (CSF-28). Senza bollino nel box rifatto quello vecchio si buttava: "a volte".
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const cssRegoleConflitti = require("../../plugin/cssFramework/regoleConflitti");
const sovrastrutture = require("../../plugin/cssFramework/sovrastrutture");
const etichettaBollino = require("../../plugin/segnalazioni/etichetta");
const SchermataSegnalazioni = require("../../plugin/segnalazioni/schermata");

const RADICE = path.join(__dirname, "..", "..");
const sorgente = relativo => fs.readFileSync(path.join(RADICE, relativo), "utf8").replace(/\r/g, "");

const CSS_EDRO21 = JSON.parse(sorgente("Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json"));
const KIT_VOLANTINO = CSS_EDRO21.dbRidimensionamentiAllineamenti.modificheCssPerKit
    .filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));
const FILTRI_EDRO21 = JSON.parse(sorgente("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json")).filtriSegnalazioni;

const voceDiDefault = kit => kit.operazioniPerBox.find(op => Array.isArray(op.nomiBox) && op.nomiBox.length === 0);
const eRegolaDescrizioneFoto = r => r != null && Array.isArray(r.segnalazioni)
    && r.segnalazioni[0] === "descrizione" && r.segnalazioni[1] === "immagine*, foto_secondaria*";

//makeRegexFromGroupName del CssFramework, presa dal sorgente.
function membroDalSorgente(relativo, intestazione) {
    const testo = sorgente(relativo);
    const inizio = testo.indexOf(intestazione);
    assert.ok(inizio >= 0, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf("\n    },\n", inizio) + 6);
}
const motivoDelCss = new Function("return ({" + membroDalSorgente("plugin/CssFramework.js", "\n    makeRegexFromGroupName(groupName) {") + "});")();
const corrisponde = (motivo, etichetta) => motivoDelCss.makeRegexFromGroupName(motivo).test(etichetta);

/* ---- la regola nella configurazione di Edro21 ---- */

test("nei kit del volantino di Edro21 la descrizione non deve toccare le foto del prodotto, misurata sul testo", () => {
    assert.ok(KIT_VOLANTINO.length >= 2, "i kit del volantino di Edro21");
    KIT_VOLANTINO.forEach((kit, i) => {
        const regole = voceDiDefault(kit).segnalazioniConflitti.filter(eRegolaDescrizioneFoto);
        assert.strictEqual(regole.length, 1, "kit " + i + ": una regola descrizione / foto del prodotto");
        assert.strictEqual(regole[0].useTextBounds, true, "kit " + i + ": si misura il testo, non il riquadro");
    });
});

test("la regola prende la primaria e le secondarie, non i loghi ne' gli altri elementi", () => {
    const regola = cssRegoleConflitti.normalizzaRegola(voceDiDefault(KIT_VOLANTINO[0]).segnalazioniConflitti.find(eRegolaDescrizioneFoto));
    const prende = etichetta => regola.latoB.some(motivo => corrisponde(motivo, etichetta));

    assert.deepStrictEqual(regola.latoA, ["descrizione"]);
    assert.strictEqual(prende("immagine$6322946"), true);
    assert.strictEqual(prende("foto_secondaria$6322965"), true);
    assert.strictEqual(prende("foto_extra$Logo_BDP$tipo_3"), false);
    assert.strictEqual(prende("descrizione"), false);
    assert.strictEqual(prende("prezzo_offerta"), false);
});

test("la regola resta anche con la sovrastruttura Sconto linea", () => {
    KIT_VOLANTINO.forEach(kit => {
        const scontoLinea = kit.sovrastrutture.find(s => s.nome === "Sconto linea");
        assert.ok(scontoLinea, "la sovrastruttura Sconto linea");
        const fusa = sovrastrutture.fondiOperazioni(voceDiDefault(kit), scontoLinea.operazioni);
        assert.strictEqual(fusa.segnalazioniConflitti.filter(eRegolaDescrizioneFoto).length, 1);
    });
});

test("la nuova CSF-013 compare con il filtro Solo foto", () => {
    const soloFoto = FILTRI_EDRO21.find(f => f.nome === "Solo foto");
    const voce = { g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra elementi nel box BOX1: descrizione non dovrebbe toccare immagine$6322946." };

    assert.strictEqual(SchermataSegnalazioni.voceNelFiltro(voce, soloFoto), true);
    //Quella con un logo, come prima.
    assert.strictEqual(SchermataSegnalazioni.voceNelFiltro({ g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra elementi nel box BOX1: descrizione non dovrebbe toccare foto_extra$Logo$tipo_3." }, soloFoto), true);
    //Una CSF-013 fra descrizione e prezzo no.
    assert.strictEqual(SchermataSegnalazioni.voceNelFiltro({ g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra elementi nel box BOX1: descrizione non dovrebbe toccare prezzo_offerta." }, soloFoto), false);
});

/* ---- il controllo dopo il confronto del box ---- */

test("il confronto da' al box che resta il bollino del box rifatto, misurato, prima di restituirlo", () => {
    const confronti = sorgente("plugin/confronti.js");
    const inizio = confronti.indexOf("    async confrontoBox(box1, box2, forzaReimpaginazione = false){");
    const corpo = confronti.substring(inizio, confronti.indexOf("\n    },\n", inizio));

    //Le segnalazioni del box rifatto si leggono prima che il box rifatto se ne vada.
    const lettura = corpo.indexOf("const vociDelRifatto = Segnalazioni.leggiDalBox(box2);");
    assert.ok(lettura > 0, "le segnalazioni del box rifatto non si leggono");
    assert.ok(lettura < corpo.indexOf("box2.remove();"));

    //Il bollino non e' un campo: ne' comune ne' esclusivo, in tutti e due i box.
    assert.match(corpo, /const nonBollino = campo => campo\.isValid && !etichettaSegnalazioni\.eDiSegnalazioni\(campo\.label\);/);
    assert.match(corpo, /let box2campi = box2\.allPageItems\.filter\(nonBollino\);/);
    assert.match(corpo, /let box1campi = box1Duplicate\.allPageItems\.filter\(nonBollino\);/);

    const controllo = corpo.indexOf("boxFinale = CssFramework.segnalazioniDopoConfronto(boxFinale, vociDelRifatto);");
    assert.ok(controllo > 0, "confrontoBox non chiama segnalazioniDopoConfronto");
    assert.ok(controllo > corpo.indexOf("VersionePrecedente.mettiDaParte(box1, docInLavorazione);"), "dopo aver messo da parte il box vecchio");
    assert.ok(controllo < corpo.indexOf("return { boxFinale: boxFinale };"), "prima di restituire il box");
    assert.match(corpo, /if \(boxFinale != null && boxFinale\.isValid\) \{\s*boxFinale = CssFramework\.segnalazioniDopoConfronto\(boxFinale, vociDelRifatto\);/);
});

function caricaCssFramework() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        return richiesta === "indesign" ? {} : originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/CssFramework.js");
    }
    finally {
        Module._load = originale;
    }
}

function Segnalazioni() {
    return require("../../plugin/segnalazioni/segnalazioni");
}

//Un box con descrizione, foto primaria, un logo e, se ci sono voci, il bollino. remove toglie davvero, e
//addBollinoCustom (finto) ridisegna il bollino nello stesso box.
function boxDiProva(descrizione, foto, voci) {
    const box = { label: "BOX1", isValid: true, id: 1, allPageItems: [] };
    let id = 10;
    const elemento = (label, bounds) => {
        const el = { id: id++, label: label, constructorName: "Rectangle", isValid: true, visible: true, parent: null, geometricBounds: bounds };
        el.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== el); };
        box.allPageItems.push(el);
        return el;
    };
    elemento("descrizione", descrizione);
    elemento("immagine$6322946", foto);
    elemento("foto_extra$Logo_BDP$tipo_3", [0, 80, 10, 90]);
    if (voci.length > 0) {
        elemento(etichettaBollino.scrivi(voci), [0, 0, 5, 5]);
    }
    return box;
}

const REGOLE_EDRO21 = cssRegoleConflitti.getListaRegole(voceDiDefault(KIT_VOLANTINO[0]).segnalazioniConflitti);

function conAmbienteFinto(fn, altreGlobali = {}) {
    const globali = Object.assign({
        Utility: {
            parseLabel: label => String(label == null ? "" : label),
            eUnClone: () => false,
            percorsoDati: nome => "/dati/" + nome,
            addBollinoCustom(box, testo, colore, gradiente, posizione, bounds, overflow, etichetta) {
                const ovale = { id: 99, label: etichetta, isValid: true, visible: true, parent: null, geometricBounds: [0, 0, 5, 5] };
                ovale.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== ovale); };
                box.allPageItems.push(ovale);
                return box;
            }
        },
        messaggioUtente: null,
        readFile: () => null
    }, altreGlobali);
    const messaggi = [];
    globali.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });

    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = Object.prototype.hasOwnProperty.call(global, k) ? global[k] : undefined; global[k] = globali[k]; });
    const CssFramework = caricaCssFramework();
    const regoleOriginali = CssFramework.regoleConflittiDallaCopia;
    //La copia delle regole (allineamenti.json) e' quella di Edro21: le regole del kit del volantino.
    CssFramework.regoleConflittiDallaCopia = () => REGOLE_EDRO21;
    try {
        fn(CssFramework, messaggi);
    }
    finally {
        CssFramework.regoleConflittiDallaCopia = regoleOriginali;
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

const DESCRIZIONE = [60, 10, 80, 50];
const FOTO_SOTTO_LA_DESCRIZIONE = [20, 5, 65, 45];
const FOTO_LONTANA = [20, 5, 50, 45];
const TESTO = "Code CSF-013: Conflitto tra elementi nel box BOX1: descrizione non dovrebbe toccare immagine$6322946.";

//vecchie: il bollino del box rimasto in pagina (quello di prima dell'azione); rifatto: le voci del box rifatto.
const dopoConfronto = (CssFramework, box, rifatto) => CssFramework.segnalazioniDopoConfronto(box, rifatto);
const CSF013 = { g: "warning", c: "CSF-013", t: TESTO, v: { a: "descrizione", b: "immagine$6322946", tb: true } };
const CSF26 = { g: "warning", c: "CSF-26", t: "Code CSF-26: Foto senza tracciato" };

test("la descrizione sopra la foto, senza segnalazione: la CSF-013 entra nel bollino e nel registro", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, []);

        const dopo = dopoConfronto(CssFramework, box, []);

        const voci = Segnalazioni().leggiDalBox(dopo);
        assert.strictEqual(voci.length, 1);
        assert.strictEqual(voci[0].c, "CSF-013");
        assert.strictEqual(voci[0].t, TESTO);
        //Con i dati per rimisurarla all'apertura della scheda ref.
        assert.deepStrictEqual(cssRegoleConflitti.voceDiConflitto(voci[0]), { a: "descrizione", b: "immagine$6322946", useTextBounds: true });
        assert.strictEqual(messaggi.length, 1);
        assert.strictEqual(messaggi[0].stile, "warning");
        assert.ok(messaggi[0].testo.startsWith(TESTO));
    });
});

test("la CSF-013 del box rifatto ancora vera resta una volta sola, senza messaggi", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        //Il box rimasto aveva gia' la stessa CSF-013 nel bollino vecchio.
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, [CSF013]);

        const dopo = dopoConfronto(CssFramework, box, [CSF013]);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(dopo).map(v => v.t), [TESTO]);
        assert.strictEqual(Segnalazioni().bolliniDelBox(dopo).length, 1, "un bollino solo");
        assert.strictEqual(messaggi.length, 0);
    });
});

test("anche scritta con le etichette al contrario, o senza i dati di verifica, e' la stessa CSF-013", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const alContrario = { g: "warning", c: "CSF-013", t: "Code CSF-013: Conflitto tra elementi nel box BOX1: immagine$6322946 non dovrebbe toccare descrizione." };
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, []);

        const dopo = dopoConfronto(CssFramework, box, [alContrario]);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 1);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("forzatura tolta: la CSF-013 del bollino vecchio non resta se descrizione e foto non si toccano", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        //Il caso dello screenshot: descrizione da 68,60 mm, foto fino a 67,76.
        const box = boxDiProva([68.60, 93.41, 94.00, 121.10], [47.83, 84.09, 67.76, 119.84], [CSF013]);

        const dopo = dopoConfronto(CssFramework, box, [CSF26]);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(dopo).map(v => v.c), ["CSF-26"]);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("una CSF-013 del box rifatto che sul box rimasto non e' vera si toglie, senza messaggi", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_LONTANA, []);

        const dopo = dopoConfronto(CssFramework, box, [CSF013]);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 0);
        assert.strictEqual(Segnalazioni().bolliniDelBox(dopo).length, 0);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("il bollino e' quello del box rifatto: le segnalazioni vecchie non restano", () => {
    conAmbienteFinto((CssFramework) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_LONTANA, [CSF26]);

        const dopo = dopoConfronto(CssFramework, box, []);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 0);
        assert.strictEqual(Segnalazioni().bolliniDelBox(dopo).length, 0);
    });
});

test("le altre segnalazioni del box rifatto restano, e la CSF-013 che manca si aggiunge", () => {
    conAmbienteFinto((CssFramework) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, []);

        const dopo = dopoConfronto(CssFramework, box, [CSF26]);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(dopo).map(v => v.c), ["CSF-26", "CSF-013"]);
    });
});

test("una descrizione che non tocca la foto non fa nascere niente", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_LONTANA, []);

        const dopo = dopoConfronto(CssFramework, box, []);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 0);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("con le segnalazioni disattivate non si aggiunge niente, e il bollino vecchio se ne va", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, [CSF26]);

        const dopo = dopoConfronto(CssFramework, box, []);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 0);
        assert.strictEqual(messaggi.length, 0);
    }, { SchermataSegnalazioni: { disattivate: () => true } });
});

test("cio' che il cliente esclude non entra nel bollino", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxDiProva(DESCRIZIONE, FOTO_SOTTO_LA_DESCRIZIONE, []);

        const dopo = dopoConfronto(CssFramework, box, []);

        assert.strictEqual(Segnalazioni().leggiDalBox(dopo).length, 0);
        assert.strictEqual(messaggi.length, 0);
    }, { segnalazioneEsclusaDalCliente: s => /immagine\$/.test(s.msg) });
});
