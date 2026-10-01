/*
 * I20-1026: sovrastrutture, condizioni sulla ref e sulla forma del box, regola nascondi.
 *
 * La logica sta in plugin/cssFramework/sovrastrutture.js, che si carica sotto Node e si prova
 * chiamandola. CssFramework.js richiede InDesign e non si carica: i suoi membri nuovi -
 * applicaNascondi, la mappa senza gli elementi nascosti, le condizioni, la distanza dell'ancora -
 * si estraggono dal sorgente e si eseguono su un box finto. Il resto si controlla sul sorgente.
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

    assert.deepStrictEqual(box.allineamenti.map(a => a.nomeGruppo), ["Campi_DX", "Loghi_SX", "Payoff"]);
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
    for (const chiave of ["ridimensionamenti", "postRidimensionamenti", "segnalazioniConflitti", "duplicazioni", "ordiniZ", "nascondi"]) {
        assert.ok(Array.isArray(voce[chiave]), chiave);
    }
});

test("fusione: il DB del kit non viene toccato", () => {
    const db = dbDiProva();
    const prima = JSON.stringify(db);
    sovrastrutture.fondiNelDB(db, "BOX1", [{ allineamenti: [{ nomeGruppo: "Loghi_SX" }], nascondi: [{ nomeGruppo: "x", elementi: ["a"] }] }]);
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

/* ---- la regola nascondi: la decisione ---- */

test("regoleNascondi: la regola piu' specifica sostituisce l'omonima", () => {
    const regole = sovrastrutture.regoleNascondi([
        { nascondi: [{ nomeGruppo: "a", da: "default" }, { nomeGruppo: "b" }] },
        null,
        { nascondi: [{ nomeGruppo: "a", da: "box" }] }
    ]);
    assert.deepStrictEqual(regole.map(r => r.nomeGruppo + (r.da || "")), ["abox", "b"]);
});

test("esitoNascondi: condizione vera nasconde, falsa mostra, l'operatore vince", () => {
    assert.strictEqual(sovrastrutture.esitoNascondi([false, true], false), "nascondi");
    assert.strictEqual(sovrastrutture.esitoNascondi([false], false), "mostra");
    assert.strictEqual(sovrastrutture.esitoNascondi([false], true), null);
    assert.strictEqual(sovrastrutture.esitoNascondi([true], true), "nascondi");
    assert.strictEqual(sovrastrutture.esitoNascondi([], false), null);
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
    }
};

function framework() {
    const sorgente = leggi("CssFramework.js");
    const membri = ["boundsDellaForma", "applicaNascondi", "elementoNascostoDalCss", "creaMappaturaBoxOriginale",
        "checkCondition", "checkSetCondition", "checkAllConditions", "makeRegexFromGroupName", "parseGroupSpec", "distanzaDellAncora"]
        .map(nome => membro(sorgente, nome));
    const fabbrica = new Function("sovrastrutture", "NoRenderElementi", "cssComposizioneBox", "Utility",
        "return { boundsFormaCorrente: null, nascostiCss: null,\n" + membri.join(",\n") + "\n};");
    return fabbrica(sovrastrutture, NoRenderElementi, cssComposizioneBox, UtilityFinta);
}

let prossimoId = 1;
function elemento(label, visibile = true) {
    return { id: prossimoId++, label, visible: visibile, isValid: true, geometricBounds: [0, 0, 10, 10] };
}

const VERTICALE = "foto_extra$parmigiano_testo_2mod_verticale$tipo_3";
const ORIZZONTALE = "foto_extra$parmigiano_testo_2mod_orizzontale$tipo_3";
const CARATTERISTICHE = "foto_extra$Parmigiano_caratteristiche$tipo_3";

function boxFinto(larghezza, altezza, etichette) {
    return {
        label: "BOX1",
        isValid: true,
        geometricBounds: bounds(larghezza, altezza),
        allPageItems: etichette.map(e => typeof e === "string" ? elemento(e) : e)
    };
}

function regoleParmigiano() {
    const forma = forme => [{ setCondizioni: [{ formaBoxCondition: [{ forme }] }] }];
    return [{
        nomiBox: ["BOX1"],
        nascondi: [
            { nomeGruppo: "verticale", elementi: ["*parmigiano_testo_2mod_verticale*"], listSetCondizioni: forma(["largo", "standard"]) },
            { nomeGruppo: "orizzontale", elementi: ["*parmigiano_testo_2mod_orizzontale*"], listSetCondizioni: forma(["alto", "standard"]) },
            { nomeGruppo: "caratteristiche", elementi: ["*Parmigiano_caratteristiche*"], listSetCondizioni: forma(["standard"]) }
        ]
    }];
}

function visibili(box) {
    return Object.fromEntries(box.allPageItems.map(i => [i.label, i.visible]));
}

test("nascondi: in un box largo si vede il testo orizzontale, non il verticale", () => {
    const css = framework();
    const box = boxFinto(200, 100, [VERTICALE, ORIZZONTALE, CARATTERISTICHE, "descrizione"]);
    css.boundsFormaCorrente = box.geometricBounds;

    css.applicaNascondi(box, regoleParmigiano(), null, {});

    assert.deepStrictEqual(visibili(box), { [VERTICALE]: false, [ORIZZONTALE]: true, [CARATTERISTICHE]: true, descrizione: true });
});

test("nascondi: in un box alto il contrario, in uno standard nessuno dei tre", () => {
    const css = framework();
    const alto = boxFinto(100, 200, [VERTICALE, ORIZZONTALE, CARATTERISTICHE]);
    css.boundsFormaCorrente = alto.geometricBounds;
    css.applicaNascondi(alto, regoleParmigiano(), null, {});
    assert.deepStrictEqual(visibili(alto), { [VERTICALE]: true, [ORIZZONTALE]: false, [CARATTERISTICHE]: true });

    const standard = boxFinto(100, 100, [VERTICALE, ORIZZONTALE, CARATTERISTICHE]);
    css.boundsFormaCorrente = standard.geometricBounds;
    css.applicaNascondi(standard, regoleParmigiano(), null, {});
    assert.deepStrictEqual(visibili(standard), { [VERTICALE]: false, [ORIZZONTALE]: false, [CARATTERISTICHE]: false });
});

test("nascondi: quando il box cambia forma, l'elemento nascosto torna", () => {
    //E' il motivo per cui si nasconde invece di cancellare: l'operatore ridimensiona e rifa' il fix.
    const css = framework();
    const box = boxFinto(200, 100, [VERTICALE, ORIZZONTALE]);
    css.boundsFormaCorrente = box.geometricBounds;
    css.applicaNascondi(box, regoleParmigiano(), null, {});
    assert.strictEqual(box.allPageItems[0].visible, false);

    css.boundsFormaCorrente = bounds(100, 200);
    css.applicaNascondi(box, regoleParmigiano(), null, {});
    assert.deepStrictEqual(visibili(box), { [VERTICALE]: true, [ORIZZONTALE]: false });
});

test("nascondi: un elemento che l'operatore ha messo in noRender non si rimostra", () => {
    const css = framework();
    const box = boxFinto(200, 100, [VERTICALE, elemento(ORIZZONTALE, false)]);
    css.boundsFormaCorrente = box.geometricBounds;
    const itemRef = { noRenderElementi: [{ tipo: NoRenderElementi.TIPO.logo, chiave: "parmigiano_testo_2mod_orizzontale" }] };

    css.applicaNascondi(box, regoleParmigiano(), null, itemRef);

    assert.deepStrictEqual(visibili(box), { [VERTICALE]: false, [ORIZZONTALE]: false });
});

test("nascondi: un elemento che nessuna regola nomina resta com'e'", () => {
    const css = framework();
    const box = boxFinto(200, 100, [elemento("foto_extra$Logo_SDB$tipo_3", false), VERTICALE]);
    css.boundsFormaCorrente = box.geometricBounds;
    css.applicaNascondi(box, regoleParmigiano(), null, {});
    assert.strictEqual(box.allPageItems[0].visible, false);
});

test("nascondi: gli elementi nascosti restano fuori dalla mappa delle regole", () => {
    const css = framework();
    const box = boxFinto(200, 100, [VERTICALE, ORIZZONTALE, "descrizione"]);
    css.boundsFormaCorrente = box.geometricBounds;
    css.applicaNascondi(box, regoleParmigiano(), null, {});

    const mappa = css.creaMappaturaBoxOriginale(box, []);
    assert.deepStrictEqual(Object.keys(mappa).sort(), [ORIZZONTALE, "descrizione"].sort());
});

test("nascondi: le regole del kit di default valgono anche loro", () => {
    const css = framework();
    const box = boxFinto(200, 100, [VERTICALE]);
    css.boundsFormaCorrente = box.geometricBounds;
    const regole = regoleParmigiano();
    regole[0].nomiBox = [];
    css.applicaNascondi(box, null, regole, {});
    assert.strictEqual(box.allPageItems[0].visible, false);
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

test("le quattro letture delle regole fondono le sovrastrutture, il ridimensionamento nasconde", () => {
    const sorgente = leggi("CssFramework.js");
    assert.strictEqual((sorgente.match(/DB = me\.applicaSovrastrutture\(DB, fileModifiche, box, itemRef\);/g) || []).length, 4);
    assert.strictEqual((sorgente.match(/me\.applicaNascondi\(box, DB, DBDef, itemRef\);/g) || []).length, 2);
    //La fusione viene prima del contesto: le operazioni dopo il fix foto la ereditano.
    const allineamento = sorgente.substring(sorgente.indexOf("    applicaAllineamentoCss("), sorgente.indexOf("    allineamenti(box, boundsBoxImpaginato"));
    for (const ramo of allineamento.split("me.memorizzaContestoCss(").slice(0, -1)) {
        assert.match(ramo.slice(-1200), /me\.applicaSovrastrutture\(DB, fileModifiche, box, itemRef\);/);
    }
});

test("followGroup usa la distanza dell'ancora, non piu' i soli mm", () => {
    const sorgente = leggi("CssFramework.js");
    const follow = membro(sorgente, "followGroup");
    assert.match(follow, /var distanza = this\.distanzaDellAncora\(anchor, gruppoBounds, direction\);/);
    assert.doesNotMatch(follow, /anchor\.distance/);
});

test("il modal noRender della scheda ripete la regola nascondi", () => {
    const scheda = leggi("schedaRef.js");
    const corpo = scheda.substring(scheda.indexOf("    applicaNoRenderAlDocumento() {"), scheda.indexOf("    apriModalInfoReferenza() {"));
    assert.match(corpo, /CssFramework\.riapplicaNascondi\(box, primario != null \? primario\.recordInTracciato : null\);/);
});
