/*
 * I20-1026: sovrastrutture, condizioni sulla ref e sulla forma del box, regola nascondi.
 *
 * La logica sta in plugin/cssFramework/sovrastrutture.js, che si carica sotto Node e si prova
 * chiamandola. CssFramework.js richiede InDesign e non si carica: i suoi membri nuovi - la regola
 * disattiva, le condizioni, la distanza dell'ancora - si estraggono dal sorgente e si eseguono su
 * un box finto. Il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CARTELLA_PLUGIN = path.join(__dirname, "..", "..", "plugin");
const sovrastrutture = require("../../plugin/cssFramework/sovrastrutture.js");
const NoRenderElementi = require("../../plugin/noRenderElementi.js");
const cssComposizioneBox = require("../../plugin/cssFramework/composizioneBox.js");

function leggi(relativo) {
    return fs.readFileSync(path.join(CARTELLA_PLUGIN, relativo), "utf8").replace(/\r/g, "");
}

/* ---- la forma del box ---- */

//Bounds InDesign: [y1, x1, y2, x2].
function bounds(larghezza, altezza) {
    return [10, 20, 10 + altezza, 20 + larghezza];
}

test("la forma: largo, alto, standard col rapporto 1.6", () => {
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(160, 100)), "largo");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(100, 160)), "alto");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(159, 100)), "standard");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(100, 159)), "standard");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(100, 100)), "standard");
});

test("la forma: un rapporto dichiarato vale al posto di 1.6", () => {
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(120, 100), 1.2), "largo");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(120, 100), 2), "standard");
    assert.strictEqual(sovrastrutture.formaDelBox(bounds(160, 100), 0), "largo");
});

test("la forma: bounds mancanti o senza misure valgono standard", () => {
    assert.strictEqual(sovrastrutture.formaDelBox(null), "standard");
    assert.strictEqual(sovrastrutture.formaDelBox([1, 2]), "standard");
    assert.strictEqual(sovrastrutture.formaDelBox([0, 0, 0, 50]), "standard");
});

test("formaBoxCondition: basta una delle forme, e di una delle voci", () => {
    const largo = bounds(200, 100);
    assert.strictEqual(sovrastrutture.formaBoxConditionVera(largo, [{ forme: ["largo", "standard"] }]), true);
    assert.strictEqual(sovrastrutture.formaBoxConditionVera(largo, [{ forme: ["alto"] }]), false);
    assert.strictEqual(sovrastrutture.formaBoxConditionVera(largo, [{ forme: ["alto"] }, { forme: ["LARGO"] }]), true);
    assert.strictEqual(sovrastrutture.formaBoxConditionVera(largo, [{ forme: [] }]), false);
    assert.strictEqual(sovrastrutture.formaBoxConditionVera(largo, []), true);
});

/* ---- la condizione sulla ref ---- */

const PARMIGIANO = [{ campo: "Descrizioni.Descrizione1", contiene: "Parmigiano Reggiano" }];

test("refCondition: contiene senza distinguere maiuscole, a capo e <br>", () => {
    for (const descrizione of ["PARMIGIANO REGGIANO DOP", "parmigiano reggiano", "Parmigiano<br>Reggiano", "Parmigiano\r\nReggiano"]) {
        assert.strictEqual(sovrastrutture.refConditionVera({ "Descrizioni.Descrizione1": descrizione }, PARMIGIANO), true, descrizione);
    }
    assert.strictEqual(sovrastrutture.refConditionVera({ "Descrizioni.Descrizione1": "Grana Padano" }, PARMIGIANO), false);
    assert.strictEqual(sovrastrutture.refConditionVera({}, PARMIGIANO), false);
});

test("refCondition: per un gruppo vale la descrizione del gruppo", () => {
    const gruppo = {
        "Descrizioni.Descrizione1": "Grana Padano",
        descrizione_gruppo: { "Descrizioni.Descrizione1": "Parmigiano Reggiano DOP" }
    };
    assert.strictEqual(sovrastrutture.refConditionVera(gruppo, PARMIGIANO), true);
});

test("refCondition: senza ref nessuna condizione e' vera, senza condizioni si'", () => {
    //Il ritracciamento della griglia rifa' il fix senza ref.
    assert.strictEqual(sovrastrutture.refConditionVera(null, PARMIGIANO), false);
    assert.strictEqual(sovrastrutture.refConditionVera(null, []), true);
    assert.strictEqual(sovrastrutture.refConditionVera({ a: "x" }, [{ campo: "a", contiene: "" }]), false);
});

/* ---- la fusione nel DB ---- */

function dbDiProva() {
    return [
        { nomiBox: [], allineamenti: [{ nomeGruppo: "Loghi_DX" }], ridimensionamenti: [{ gruppoEtichette: ["foto_extra*"] }] },
        { nomiBox: ["BOX1"], allineamenti: [{ nomeGruppo: "Campi_DX" }, { nomeGruppo: "Loghi_SX", segno: "box" }], ridimensionamenti: [{ gruppoEtichette: ["base*"] }], postRidimensionamenti: [] }
    ];
}

test("fusione: una regola con un nomeGruppo nuovo si aggiunge, una omonima sostituisce", () => {
    const fuso = sovrastrutture.fondiNelDB(dbDiProva(), "BOX1", [{
        allineamenti: [{ nomeGruppo: "Payoff" }, { nomeGruppo: "Loghi_SX", segno: "sovrastruttura" }]
    }]);
    const box = fuso.find(v => v.nomiBox.includes("BOX1"));

    assert.deepStrictEqual(box.allineamenti.map(a => a.nomeGruppo).sort(), ["Campi_DX", "Loghi_SX", "Payoff"]);
    assert.strictEqual(box.allineamenti.find(a => a.nomeGruppo === "Loghi_SX").segno, "sovrastruttura");
    //Le regole generali restano quelle di prima.
    assert.deepStrictEqual(fuso[0], dbDiProva()[0]);
});

test("fusione: i ridimensionamenti della sovrastruttura vanno in testa", () => {
    //Il motore prende il primo ridimensionamento che corrisponde all'etichetta.
    const fuso = sovrastrutture.fondiNelDB(dbDiProva(), "BOX1", [{ ridimensionamenti: [{ gruppoEtichette: ["*Parmigiano*"] }] }]);
    const box = fuso.find(v => v.nomiBox.includes("BOX1"));
    assert.deepStrictEqual(box.ridimensionamenti.map(r => r.gruppoEtichette[0]), ["*Parmigiano*", "base*"]);
});

test("fusione: un box senza regole sue riceve una voce completa", () => {
    const fuso = sovrastrutture.fondiNelDB(dbDiProva(), "BOX9", [{ allineamenti: [{ nomeGruppo: "Payoff" }] }]);
    const voce = fuso.find(v => v.nomiBox.includes("BOX9"));

    assert.strictEqual(fuso.length, 3);
    assert.deepStrictEqual(voce.allineamenti.map(a => a.nomeGruppo), ["Payoff"]);
    for (const chiave of ["ridimensionamenti", "postRidimensionamenti", "segnalazioniConflitti", "duplicazioni", "ordiniZ", "disattiva"]) {
        assert.ok(Array.isArray(voce[chiave]), chiave);
    }
});

test("fusione: il DB del kit non viene toccato", () => {
    const db = dbDiProva();
    const prima = JSON.stringify(db);
    sovrastrutture.fondiNelDB(db, "BOX1", [{ allineamenti: [{ nomeGruppo: "Loghi_SX" }], disattiva: [{ nomeGruppo: "x", elementi: ["a"] }] }]);
    assert.strictEqual(JSON.stringify(db), prima);
});

test("fusione: senza sovrastrutture attive il DB e' lo stesso", () => {
    const db = dbDiProva();
    assert.strictEqual(sovrastrutture.fondiNelDB(db, "BOX1", []), db);
    assert.strictEqual(sovrastrutture.fondiNelDB(null, "BOX1", [{}]), null);
});

test("fusione: fra due sovrastrutture attive l'ultima vince sul nome", () => {
    const fuso = sovrastrutture.fondiNelDB(dbDiProva(), "BOX1", [
        { allineamenti: [{ nomeGruppo: "Payoff", da: "prima" }] },
        { allineamenti: [{ nomeGruppo: "Payoff", da: "seconda" }] }
    ]);
    const box = fuso.find(v => v.nomiBox.includes("BOX1"));
    assert.strictEqual(box.allineamenti.filter(a => a.nomeGruppo === "Payoff").length, 1);
    assert.strictEqual(box.allineamenti.find(a => a.nomeGruppo === "Payoff").da, "seconda");
});

/* ---- la regola disattiva: la decisione ---- */

test("regoleDisattiva: la regola piu' specifica sostituisce l'omonima", () => {
    const regole = sovrastrutture.regoleDisattiva([
        { disattiva: [{ nomeGruppo: "a", da: "default" }, { nomeGruppo: "b" }] },
        null,
        { disattiva: [{ nomeGruppo: "a", da: "box" }] }
    ]);
    assert.deepStrictEqual(regole.map(r => r.nomeGruppo + (r.da || "")).sort(), ["abox", "b"]);
});

//Il dato esprime varianti alternative dello stesso gruppo con piu' regole omonime e condizioni
//opposte: Loghi_DX di Edro21, con e senza Conad. Una sovrastruttura che le ridefinisce deve
//tenerle tutte e due, e togliere quelle del box.
test("fusione: piu' regole con lo stesso nomeGruppo si tengono tutte", () => {
    const fuso = sovrastrutture.fondiNelDB(dbDiProva(), "BOX1", [{
        allineamenti: [{ nomeGruppo: "Loghi_SX", variante: 1 }, { nomeGruppo: "Loghi_SX", variante: 2 }]
    }]);
    const box = fuso.find(v => v.nomiBox.includes("BOX1"));
    const loghi = box.allineamenti.filter(a => a.nomeGruppo === "Loghi_SX");

    assert.deepStrictEqual(loghi.map(a => a.variante), [1, 2]);
    assert.ok(box.allineamenti.some(a => a.nomeGruppo === "Campi_DX"));

    const regole = sovrastrutture.regoleDisattiva([
        { disattiva: [{ nomeGruppo: "a", da: "default" }] },
        { disattiva: [{ nomeGruppo: "a", da: "uno" }, { nomeGruppo: "a", da: "due" }] }
    ]);
    assert.deepStrictEqual(regole.map(r => r.da), ["uno", "due"]);
});

const VERTICALE = "foto_extra$parmigiano_testo_2mod_verticale$tipo_3";
const ORIZZONTALE = "foto_extra$parmigiano_testo_2mod_orizzontale$tipo_3";
const CARATTERISTICHE = "foto_extra$Parmigiano_caratteristiche$tipo_3";
const PAYOFF = "foto_extra$Parmigiano_payoff$tipo_3";

//Le voci di Foto.ExtraAuto di una ref Parmigiano, come le scrive il server.
function vociParmigiano(escluse = []) {
    return ["Parmigiano_payoff", "Parmigiano_caratteristiche", "parmigiano_testo_2mod_verticale", "parmigiano_testo_2mod_orizzontale"]
        .map(sigla => ({ sigla, tipo: 3, nome: sigla + (sigla.indexOf("testo") > 0 ? ".idms" : ".psd"), escluso: escluse.includes(sigla) }));
}

//makeRegexFromGroupName quanto basta: l'asterisco vale qualunque cosa.
const regexDi = gruppo => new RegExp("^" + gruppo.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

test("esitoDisattiva: basta una regola vera, solo regole false attivano, nessuna regola lascia com'e'", () => {
    const valutate = [
        { espressioni: [regexDi("*parmigiano_testo_2mod_verticale*")], vera: true },
        { espressioni: [regexDi("*parmigiano_testo_2mod_orizzontale*")], vera: false },
        { espressioni: [regexDi("*Parmigiano_caratteristiche*")], vera: false },
        { espressioni: [regexDi("*Parmigiano_caratteristiche*")], vera: true }
    ];
    const esito = sovrastrutture.esitoDisattiva(vociParmigiano(), valutate);

    assert.deepStrictEqual([...esito.disattivati].sort(), ["Parmigiano_caratteristiche", "parmigiano_testo_2mod_verticale"]);
    assert.deepStrictEqual([...esito.attivati], ["parmigiano_testo_2mod_orizzontale"]);
    //Il payoff non lo nomina nessuno.
    assert.ok(!esito.disattivati.has("Parmigiano_payoff") && !esito.attivati.has("Parmigiano_payoff"));
});

test("labelFotoExtraAuto: la label con cui il Plugin mette il logo nel box", () => {
    assert.strictEqual(sovrastrutture.labelFotoExtraAuto({ sigla: "Parmigiano_payoff", tipo: 3 }), PAYOFF);
});

/* ---- CssFramework: i membri nuovi, eseguiti su un box finto ---- */

//Il corpo di un membro di primo livello dell'oggetto, contando le graffe.
function membro(sorgente, nome) {
    const inizio = sorgente.indexOf("\n    " + nome + "(");
    assert.notStrictEqual(inizio, -1, nome + " non trovato in CssFramework.js");
    const apertura = sorgente.indexOf("{", inizio);
    let livello = 0;
    for (let i = apertura; i < sorgente.length; i++) {
        if (sorgente[i] === "{") livello++;
        else if (sorgente[i] === "}") {
            livello--;
            if (livello === 0) {
                return sorgente.substring(inizio + 5, i + 1);
            }
        }
    }
    assert.fail(nome + " non delimitato");
}

//Utility.parseLabel per quello che serve qui: le foto extra tengono la label intera.
const UtilityFinta = {
    parseLabel(label) {
        return label.indexOf("foto_extra") === 0 ? label : label.split("$")[0];
    },
    //I20-1065: le regole si leggono dalla cartella dei dati della postazione; readFile qui e' finto.
    percorsoDati(nome) {
        return "/lavorazione/SingularData/mac/" + nome;
    }
};

//Le regole Parmigiano come stanno nella copia locale: un kit, una voce generale, una sovrastruttura.
function fileRegole() {
    const forma = forme => [{ setCondizioni: [{ formaBoxCondition: [{ forme }] }] }];
    return {
        modificheCssPerKit: [{
            kit: { areeValide: [], canaliValidi: ["SC"], kitTipoLavorazioniValide: [1], kitFormatiValidi: null },
            operazioniPerBox: [{ nomiBox: [], allineamenti: [] }],
            sovrastrutture: [{
                nome: "Parmigiano Reggiano",
                listSetCondizioni: [{ setCondizioni: [{ refCondition: PARMIGIANO }] }],
                operazioni: {
                    disattiva: [
                        { nomeGruppo: "verticale", elementi: ["*parmigiano_testo_2mod_verticale*"], listSetCondizioni: forma(["largo", "standard"]) },
                        { nomeGruppo: "orizzontale", elementi: ["*parmigiano_testo_2mod_orizzontale*"], listSetCondizioni: forma(["alto", "standard"]) },
                        { nomeGruppo: "caratteristiche", elementi: ["*Parmigiano_caratteristiche*"], listSetCondizioni: forma(["standard"]) }
                    ]
                }
            }]
        }]
    };
}

function framework(regole = fileRegole()) {
    const sorgente = leggi("CssFramework.js");
    const membri = ["boundsDellaForma", "applicaSovrastrutture", "kitDelleRegole", "disattivatiDallaForma", "applicaDisattivazioni",
        "creaMappaturaBoxOriginale", "checkCondition", "checkSetCondition", "checkAllConditions", "makeRegexFromGroupName",
        "parseGroupSpec", "distanzaDellAncora"]
        .map(nome => membro(sorgente, nome));
    const ficoProcess = {
        getAreaLavorazioneCorrente: () => ({ sigla: "TO" }),
        getCanaleLavorazioneCorrente: () => ({ sigla: "SC" }),
        getTipoLavorazioneCorrente: () => 1,
        getFormatoLavorazioneCorrente: () => ({ codice: "VOL" })
    };
    const piazzati = [];
    const FotoPlacerFinto = {
        piazzaFotoExtraAuto(extra, box) {
            const nuovo = elemento(sovrastrutture.labelFotoExtraAuto(extra));
            piazzati.push(nuovo.label);
            return nuovo;
        }
    };
    const fabbrica = new Function("sovrastrutture", "cssComposizioneBox", "Utility", "ficoProcess", "readFile", "pathLavorazione", "FotoPlacer",
        "return { boundsFormaCorrente: null,\n" + membri.join(",\n") + "\n};");
    const css = fabbrica(sovrastrutture, cssComposizioneBox, UtilityFinta, ficoProcess, () => regole, "/lavorazione", FotoPlacerFinto);
    css.piazzati = piazzati;
    return css;
}

let prossimoId = 1;
function elemento(label, visibile = true) {
    const el = { id: prossimoId++, label, visible: visibile, isValid: true, geometricBounds: [0, 0, 10, 10] };
    el.remove = () => { el.isValid = false; el.rimosso = true; };
    return el;
}

//Un gruppo InDesign finto: allPageItems, pageItems, ungroup, e la pagina che ne crea uno nuovo.
function boxFinto(larghezza, altezza, etichette) {
    const box = {
        label: "BOX1",
        isValid: true,
        geometricBounds: bounds(larghezza, altezza),
        elementi: etichette.map(e => typeof e === "string" ? elemento(e) : e)
    };
    Object.defineProperty(box, "allPageItems", { get: () => box.elementi.filter(e => e.isValid) });
    box.pageItems = { everyItem: () => ({ getElements: () => box.elementi.filter(e => e.isValid) }) };
    box.ungroup = () => { box.isValid = false; };
    box.parentPage = {
        groups: {
            add(elementi) {
                const nuovo = boxFinto(larghezza, altezza, elementi);
                nuovo.rifatto = true;
                return nuovo;
            }
        }
    };
    return box;
}

const REF = { "Descrizioni.Descrizione1": "PARMIGIANO REGGIANO DOP" };
function ref(escluse = []) {
    return Object.assign({ "Foto.ExtraAuto": vociParmigiano(escluse) }, REF);
}

function etichette(box) {
    return box.allPageItems.map(i => i.label).sort();
}

test("disattivatiDallaForma: standard, alto e largo", () => {
    const css = framework();
    const caso = (larghezza, altezza) => {
        const esito = css.disattivatiDallaForma(boxFinto(larghezza, altezza, []), ref(), bounds(larghezza, altezza));
        return [...esito.disattivati].sort();
    };
    assert.deepStrictEqual(caso(100, 100), ["Parmigiano_caratteristiche", "parmigiano_testo_2mod_orizzontale", "parmigiano_testo_2mod_verticale"]);
    assert.deepStrictEqual(caso(100, 160), ["parmigiano_testo_2mod_orizzontale"]);
    assert.deepStrictEqual(caso(160, 100), ["parmigiano_testo_2mod_verticale"]);
});

test("disattivatiDallaForma: la forma si misura sui bounds dati, non sul box", () => {
    //All'impaginazione e' la cella della griglia, al fix sono le misure nuove.
    const css = framework();
    const esito = css.disattivatiDallaForma(boxFinto(100, 100, []), ref(), bounds(200, 100));
    assert.deepStrictEqual([...esito.disattivati], ["parmigiano_testo_2mod_verticale"]);
});

test("disattivatiDallaForma: senza ref Parmigiano, senza regole o senza loghi non disattiva niente", () => {
    const css = framework();
    const vuoto = esito => esito.disattivati.size + esito.attivati.size;
    assert.strictEqual(vuoto(css.disattivatiDallaForma(boxFinto(100, 100, []), { "Descrizioni.Descrizione1": "Grana Padano", "Foto.ExtraAuto": vociParmigiano() })), 0);
    assert.strictEqual(vuoto(css.disattivatiDallaForma(boxFinto(100, 100, []), null)), 0);
    assert.strictEqual(vuoto(framework(null).disattivatiDallaForma(boxFinto(100, 100, []), ref())), 0);
    assert.strictEqual(vuoto(css.disattivatiDallaForma(boxFinto(100, 100, []), Object.assign({ "Foto.ExtraAuto": [] }, REF))), 0);
});

test("applicaDisattivazioni: un box che diventa largo perde il verticale e riceve orizzontale e caratteristiche", () => {
    const css = framework();
    //Il box era alto: dentro payoff, caratteristiche e testo verticale.
    const box = boxFinto(160, 100, [PAYOFF, CARATTERISTICHE, VERTICALE, "descrizione"]);

    const nuovo = css.applicaDisattivazioni(box, ref(), bounds(160, 100));

    assert.strictEqual(nuovo.rifatto, true);
    assert.strictEqual(nuovo.label, "BOX1");
    assert.deepStrictEqual(etichette(nuovo), [CARATTERISTICHE, PAYOFF, ORIZZONTALE, "descrizione"].sort());
    assert.deepStrictEqual(css.piazzati, [ORIZZONTALE]);
});

test("applicaDisattivazioni: un box che torna standard tiene solo il payoff, e non rifa' il gruppo", () => {
    const css = framework();
    const box = boxFinto(100, 100, [PAYOFF, CARATTERISTICHE, ORIZZONTALE, "descrizione"]);

    const nuovo = css.applicaDisattivazioni(box, ref(), bounds(100, 100));

    //Togliere non chiede di rifare il gruppo: e' lo stesso box.
    assert.strictEqual(nuovo, box);
    assert.deepStrictEqual(etichette(nuovo), [PAYOFF, "descrizione"].sort());
    assert.deepStrictEqual(css.piazzati, []);
});

test("applicaDisattivazioni: un logo escluso dall'operatore non torna", () => {
    const css = framework();
    const box = boxFinto(100, 160, [PAYOFF]);

    const nuovo = css.applicaDisattivazioni(box, ref(["Parmigiano_caratteristiche"]), bounds(100, 160));

    assert.deepStrictEqual(css.piazzati, [VERTICALE]);
    assert.ok(!etichette(nuovo).includes(CARATTERISTICHE));
});

test("applicaDisattivazioni: con il box gia' nella sua forma non cambia niente", () => {
    const css = framework();
    const box = boxFinto(100, 160, [PAYOFF, CARATTERISTICHE, VERTICALE]);
    assert.strictEqual(css.applicaDisattivazioni(box, ref(), bounds(100, 160)), box);
    assert.deepStrictEqual(css.piazzati, []);
});

test("le condizioni di forma e di ref passano da checkCondition", () => {
    const css = framework();
    const box = boxFinto(200, 100, []);
    css.boundsFormaCorrente = box.geometricBounds;
    const itemRef = { "Descrizioni.Descrizione1": "Parmigiano Reggiano" };

    assert.strictEqual(css.checkCondition({}, itemRef, { refCondition: PARMIGIANO, formaBoxCondition: [{ forme: ["largo"] }] }, box), true);
    assert.strictEqual(css.checkCondition({}, itemRef, { formaBoxCondition: [{ forme: ["alto"] }] }, box), false);
    assert.strictEqual(css.checkCondition({}, {}, { refCondition: PARMIGIANO }, box), false);
});

test("la distanza dell'ancora: i mm, piu' la percentuale del gruppo seguito", () => {
    const css = framework();
    const foto = [100, 50, 140, 90]; //40 di altezza, 40 di larghezza
    assert.strictEqual(css.distanzaDellAncora({ distance: 2 }, foto, "y"), 2);
    assert.strictEqual(css.distanzaDellAncora({ distance: 2, distancePercentuale: 25 }, foto, "y"), 12);
    assert.strictEqual(css.distanzaDellAncora({ distance: 0, distancePercentuale: 50 }, [0, 0, 10, 60], "x"), 30);
    assert.strictEqual(css.distanzaDellAncora({ distance: 1, distancePercentuale: null }, foto, "x"), 1);
});

/* ---- dove il motore le usa: sul sorgente ---- */

test("le quattro letture delle regole fondono le sovrastrutture", () => {
    const sorgente = leggi("CssFramework.js");
    assert.strictEqual((sorgente.match(/DB = me\.applicaSovrastrutture\(DB, fileModifiche, box, itemRef\);/g) || []).length, 4);
    //La fusione viene prima del contesto: le operazioni dopo il fix foto la ereditano.
    const allineamento = sorgente.substring(sorgente.indexOf("    applicaAllineamentoCss("), sorgente.indexOf("    allineamenti(box, boundsBoxImpaginato"));
    for (const ramo of allineamento.split("me.memorizzaContestoCss(").slice(0, -1)) {
        assert.match(ramo.slice(-1200), /me\.applicaSovrastrutture\(DB, fileModifiche, box, itemRef\);/);
    }
});

//La regola nascondi del primo collaudo e' stata sostituita: un elemento invisibile restava nel
//gruppo e ne allargava l'ingombro, e tenerlo fuori dalla mappa interrompeva il ridimensionamento.
test("della regola nascondi non resta niente: nessun elemento si tiene fuori dalla mappa", () => {
    for (const relativo of ["CssFramework.js", "schedaRef.js", "sistemazioneFoto/sistemazioneFoto.js", "indexNew.js", "cssFramework/sovrastrutture.js"]) {
        const testo = leggi(relativo);
        for (const nome of ["applicaNascondi", "riapplicaNascondi", "elementoNascostoDalCss", "nascostiCss", "regoleNascondi", "esitoNascondi"]) {
            assert.ok(!testo.includes(nome), nome + " in " + relativo);
        }
    }
});

test("followGroup usa la distanza dell'ancora, non piu' i soli mm", () => {
    const sorgente = leggi("CssFramework.js");
    const follow = membro(sorgente, "followGroup");
    assert.match(follow, /var distanza = this\.distanzaDellAncora\(anchor, gruppoBounds, direction\);/);
    assert.doesNotMatch(follow, /anchor\.distance/);
});

test("fixOverflowFromBox non costringe nel box un elemento invisibile", () => {
    const sorgente = leggi("CssFramework.js");
    const fabbrica = new Function("Utility", "messaggioUtente",
        "return {\n" + membro(sorgente, "fixOverflowFromBox") + ",\nisTextFrame() { return false; }\n};");
    const messaggi = [];
    const css = fabbrica(Object.assign({ eUnClone: () => false }, UtilityFinta), testo => messaggi.push(testo));
    const spostamenti = [];
    const fuori = { label: VERTICALE, visible: false, geometricBounds: [0, -50, 10, 300], move: () => spostamenti.push("mosso") };
    const box = { label: "BOX1", pageItems: { length: 1, item: () => fuori } };

    css.fixOverflowFromBox([0, 0, 100, 100], box);

    assert.deepStrictEqual(spostamenti, []);
    assert.deepStrictEqual(fuori.geometricBounds, [0, -50, 10, 300]);
    assert.deepStrictEqual(messaggi, []);
    //I due giri della funzione: il primo riporta dentro, il secondo segnala CSF-009 e rimpicciolisce.
    const corpo = membro(sorgente, "fixOverflowFromBox");
    assert.strictEqual((corpo.match(/if \(pageItem\.visible === false\) \{\s*continue;\s*\}/g) || []).length, 2);
});

test("al fix la regola disattiva viene dopo il ridimensionamento e prima di post ridimensionamenti e allineamenti, nei due rami", () => {
    //Un logo tolto o rimesso prima di applicaRidimensionamento ne cambierebbe la geometria di
    //partenza: in collaudo la base finiva fuori posto e i campi sovrapposti.
    const sorgente = leggi("CssFramework.js");
    const inizio = sorgente.indexOf("async applicaRidimensionamentoCss(");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    applicaAllineamentoCss(", inizio));
    const passi = [/me\.applicaRidimensionamento\(box, boxInGrigliaBounds, mappaBoxOriginale, itemRef, DB, DBDef\);/g,
        /box = me\.applicaDisattivazioni\(box, itemRef, boxInGrigliaBounds\);/g,
        /mappaBoxOriginale = me\.creaMappaturaBoxOriginale\(box, prefissiDerivati\);\n\s*if ?\(garbageKey ?!= ?null\)/g,
        /me\.applicaPostRidimensionamento\(box, mappaBoxOriginale, itemRef, DB, DBDef\);/g]
        .map(re => [...corpo.matchAll(re)].map(m => m.index));
    //Due rami, con e senza download: in ciascuno i quattro passi in quest'ordine.
    passi.forEach(posizioni => assert.strictEqual(posizioni.length, 2));
    for (let ramo = 0; ramo < 2; ramo++) {
        for (let passo = 1; passo < passi.length; passo++) {
            assert.ok(passi[passo - 1][ramo] < passi[passo][ramo], "ramo " + ramo + ", passo " + passo);
        }
    }
    //Fuori dal blocco della modalita' 1, che esce subito dopo il ridimensionamento.
    const modalita1 = [...corpo.matchAll(/if \(modalitaOperazioni == 1\) \{/g)].map(m => m.index);
    for (let ramo = 0; ramo < 2; ramo++) {
        assert.ok(modalita1[ramo] < passi[1][ramo]);
    }
    //Il box che torna, magari un gruppo nuovo, arriva nel risultato.
    assert.strictEqual((corpo.match(/mappaBoxOriginale: mappaBoxOriginale,\s*box ?: box\s*\}/g) || []).length, 2);
});

test("callAllOperationFixBox non applica piu' la regola disattiva in apertura, e lavora sul box del ridimensionamento", () => {
    const indexNew = leggi("indexNew.js");
    const inizio = indexNew.indexOf("async function callAllOperationFixBox(");
    const corpo = indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio));
    assert.doesNotMatch(corpo, /applicaDisattivazioni/);
    assert.match(corpo, /^    CssFramework\.fixOverflowFromBox\(boxImpaginato\.geometricBounds, boxImpaginato\);/m);
    assert.match(corpo, /boxImpaginato = res\.box;/);
});

/* ---- il ridimensionamento misura dall'angolo della cella ---- */

//applicaRidimensionamento estratta dal sorgente, con i soli collaboratori che servono a un box
//senza condizioni ne' fit finali. applyOverflowFix e' una globale del Plugin: qui non fa niente.
function motoreRidimensionamento() {
    const sorgente = leggi("CssFramework.js");
    const membri = ["applicaRidimensionamento", "enumAxisResizeMode", "makeRegexFromGroupName", "creaMappaturaBoxOriginale"]
        .map(nome => membro(sorgente, nome));
    const fabbrica = new Function("Utility", "cssComposizioneBox", "applyOverflowFix",
        "return { etichetteSegnalate: [], getItemContained: () => [], finalFit: () => {}, checkAllConditions: () => true,\n" + membri.join(",\n") + "\n};");
    return fabbrica(UtilityFinta, cssComposizioneBox, () => {});
}

function elementoPosizionato(label, geometricBounds) {
    return { label, geometricBounds: geometricBounds.slice(), visible: true, isValid: true, parent: { constructorName: "Spread" } };
}

function boxPosizionato(geometricBounds, elementi) {
    return { label: "BOX1", geometricBounds: geometricBounds.slice(), allPageItems: elementi };
}

//Le regole di Edro21 che contano qui: base e foto proporzionali, descrizione e payoff con lo
//spostamento lineare (Parmigiano_fondo), piu' un'etichetta in alto che con lo spostamento uscirebbe.
const REGOLE_RIDIMENSIONAMENTO = [{
    nomiBox: ["BOX1"],
    ridimensionamenti: [
        { gruppoEtichette: ["base*", "immagine*"], ridimensionamento: { x: 0, y: 0 }, listSetCondizioni: null, finalFit: null },
        { gruppoEtichette: ["descrizione", "*Parmigiano_payoff*", "etichetta_alta"], ridimensionamento: { x: 2, y: 2 }, listSetCondizioni: null, finalFit: null }
    ]
}];

const arrotonda = bounds => bounds.map(v => Number(v.toFixed(2)));

test("al fix con il bordo alto spostato, gli elementi si misurano dall'angolo della cella e la mappa resta coerente", () => {
    //I numeri del collaudo: box alto [141.20..302.00], cella standard [223.60..302.00], stesso fondo.
    const base = elementoPosizionato("base", [141.2, 75.75, 302, 141]);
    const foto = elementoPosizionato("immagine$6147585", [181.77, 75.75, 229.42, 141]);
    const descrizione = elementoPosizionato("descrizione", [254.46, 109, 279.46, 141]);
    const payoff = elementoPosizionato("foto_extra$Parmigiano_payoff$tipo_3", [288.13, 76.75, 301, 102.91]);
    const etichetta = elementoPosizionato("etichetta_alta", [141.2, 75.75, 151.2, 90]);
    const box = boxPosizionato([141.2, 75.75, 302, 141], [base, foto, descrizione, payoff, etichetta]);
    const cella = [223.6, 75.75, 302, 141];
    const motore = motoreRidimensionamento();
    const mappa = motore.creaMappaturaBoxOriginale(box, []);

    motore.applicaRidimensionamento(box, cella, mappa, {}, REGOLE_RIDIMENSIONAMENTO, null);

    //La base riempie la cella; la foto scala in proporzione dentro la cella.
    assert.deepStrictEqual(arrotonda(base.geometricBounds), [223.6, 75.75, 302, 141]);
    assert.deepStrictEqual(arrotonda(foto.geometricBounds), [243.38, 75.75, 266.61, 141]);
    //Descrizione e payoff seguono il fondo, che non si e' mosso: restano dove erano.
    assert.deepStrictEqual(arrotonda(descrizione.geometricBounds), [254.46, 109, 279.46, 141]);
    assert.deepStrictEqual(arrotonda(payoff.geometricBounds), [288.13, 76.75, 301, 102.91]);
    //L'etichetta in alto con lo spostamento uscirebbe dalla cella: rientra sul bordo alto.
    assert.deepStrictEqual(arrotonda(etichetta.geometricBounds), [223.6, 75.75, 233.6, 90]);
    //Niente sopra la cella: fixOverflowFromBox non avra' nulla da spostare.
    for (const el of box.allPageItems) {
        assert.ok(el.geometricBounds[0] >= cella[0] - 0.001 && el.geometricBounds[2] <= cella[2] + 0.001, el.label);
    }
    //La mappa dice le stesse posizioni, misurate dall'angolo della cella: anche per chi e' rientrato.
    for (const [el, chiave] of [[base, "base"], [foto, "immagine"], [descrizione, "descrizione"], [payoff, payoff.label], [etichetta, "etichetta_alta"]]) {
        const rel = mappa[chiave].bounds;
        assert.deepStrictEqual(arrotonda([cella[0] + rel[0], cella[1] + rel[1], cella[0] + rel[2], cella[1] + rel[3]]), arrotonda(el.geometricBounds), chiave);
    }
});

test("con l'angolo invariato il ridimensionamento da' le posizioni di sempre", () => {
    //Bordo basso tirato su: la cella parte dall'angolo del box, come all'impaginazione.
    const base = elementoPosizionato("base", [141.2, 75.75, 302, 141]);
    const descrizione = elementoPosizionato("descrizione", [254.46, 109, 279.46, 141]);
    const box = boxPosizionato([141.2, 75.75, 302, 141], [base, descrizione]);
    const motore = motoreRidimensionamento();
    const mappa = motore.creaMappaturaBoxOriginale(box, []);

    motore.applicaRidimensionamento(box, [141.2, 75.75, 219.6, 141], mappa, {}, REGOLE_RIDIMENSIONAMENTO, null);

    assert.deepStrictEqual(arrotonda(base.geometricBounds), [141.2, 75.75, 219.6, 141]);
    //Spostamento lineare di -82.40, come faceva il move di prima.
    assert.deepStrictEqual(arrotonda(descrizione.geometricBounds), [172.06, 109, 197.06, 141]);
});

test("all'impaginazione i loghi disattivati non si piazzano, e il piazzamento e' quello di FotoPlacer", () => {
    const indexNew = leggi("indexNew.js");
    assert.match(indexNew, /var disattivatiDallaForma = CssFramework\.disattivatiDallaForma\(boxImpaginato, itemRef, bounds\)\.disattivati;/);
    assert.match(indexNew, /if \(disattivatiDallaForma\.has\(itemRef\["Foto\.ExtraAuto"\]\[ij\]\.sigla\)\) \{\s*continue;\s*\}/);
    assert.match(indexNew, /elementiDaGruppare\.push\(FotoPlacer\.piazzaFotoExtraAuto\(itemRef\["Foto\.ExtraAuto"\]\[ij\], boxImpaginato, pagCoinvolta, doc\)\);/);
    //Il vecchio piazzamento in linea non c'e' piu'.
    assert.doesNotMatch(indexNew, /itemRef\["Foto\.ExtraAuto"\]\[ij\]\.referenceTo = rect;/);
});

test("il Report Integrita' non segnala come mancante un logo disattivato per la forma", () => {
    const confronti = leggi("confronti.js");
    assert.match(confronti, /async confrontoBoxCompiledFieldPreAnalisi\(box1, compiledFields, deletedFields, listFoto, fotoExtra, fotoExtraAuto, checkMD5 = true, elementiNoRender = null, itemRef = null\)/);
    assert.match(confronti, /CssFramework\.disattivatiDallaForma\(box1, itemRef, box1\.geometricBounds\)\.disattivati/);
    assert.match(confronti, /if \(disattivatiDallaForma\.has\(foto\.sigla\)\) \{/);
    //I chiamanti che passano i loghi passano anche la ref.
    assert.match(leggi("indexNew.js"), /elencoPerSegnalazioni\(tracciatoPrimario\.noRenderElementi, tracciatoPrimario\.membriGruppoFoto\), tracciatoPrimario\);/);
    assert.match(leggi("schedaRef.js"), /elencoPerSegnalazioni\(rec\.noRenderElementi, rec\.membriGruppoFoto\),\s*rec\s*\);/);
    assert.match(leggi("reportIntegrita/reportIntegrita.js"), /membriGruppoFoto\),\s*dati\.tracciatoPrimario\);/);
});
