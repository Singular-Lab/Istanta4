/*
 * TASK-5370a489: nel BOX4 di Edro21 dei canali SS, CN e CY la descrizione sta nel gruppo
 * gruppo_descrizione_sottocosto con la scritta SOTTOCOSTO, e deve comportarsi come la descrizione e il
 * BIS in gruppo_descrizione_BIS del BOX7, fix foto custom compreso.
 *
 * Il BIS vive tutto nella configurazione e nel custom.js di Edro21: nel kit SS/CN/CY il BOX7 ha regole
 * sue (ridimensionamento con descrizione e BIS, Campi_DX col gruppo al posto della descrizione) e il fix
 * foto sposta il gruppo. Il BOX4 usava le regole generali, e Campi_DX, che vede anche gli elementi dentro
 * i gruppi, avrebbe allineato la descrizione da sola. Ora il BOX4 ha le sue, fatte allo stesso modo.
 *
 * Si leggono le regole vere di Edro21 e la scelta dei gruppi di allineamento la fa CssFramework vero.
 * custom.js fa require('indesign') e sotto Node non si carica: la funzione nuova, pura, si isola dal
 * sorgente, e il resto del fix foto si controlla sul sorgente.
 *
 * I20-1240: il fix foto non sta piu' nel custom.js ma nella sequenza del fix foto del CssFramework di
 * Edro21: il gruppo da spostare lo sceglie la regola della fase descrizioneInBasso, e la scelta la fa
 * ancora CssFramework vero.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}
global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]), eUnClone: () => false };

const radice = path.join(__dirname, "..", "..");
const cssEdro = JSON.parse(fs.readFileSync(path.join(radice, "Istanta", "wwwroot", "external_source", "Edro21", "SourceFrameworkCss.json"), "utf8"));
const customEdro = fs.readFileSync(path.join(radice, "plugin", "Agenzie", "Edro21", "custom.js"), "utf8").replace(/\r/g, "");

const kitDelVolantino = (canale) => cssEdro.dbRidimensionamentiAllineamenti.modificheCssPerKit
    .find(k => k.kit.canaliValidi.includes(canale) && k.kit.kitTipoLavorazioniValide.includes(1));
const kitSsCnCy = kitDelVolantino("CN");
const kitSc = kitDelVolantino("SC");
const regoleDelBox = (kit, nomeBox) => kit.operazioniPerBox.find(op => nomeBox == null ? op.nomiBox.length === 0 : op.nomiBox.includes(nomeBox));

const conGruppo = (testo) => JSON.parse(JSON.stringify(testo).replace(/"descrizione"/g, "\"gruppo_descrizione_sottocosto\""));

test("lo stesso kit vale per SS, CN e CY, e un altro per SC", () => {
    assert.strictEqual(kitDelVolantino("SS"), kitSsCnCy);
    assert.strictEqual(kitDelVolantino("CY"), kitSsCnCy);
    assert.notStrictEqual(kitSc, kitSsCnCy);
});

test("nel kit SS/CN/CY il BOX4 ridimensiona SOTTOCOSTO insieme alla descrizione, come il BOX7 fa col BIS", () => {
    const generale = regoleDelBox(kitSsCnCy, null).ridimensionamenti.find(r => r.gruppoEtichette.includes("descrizione"));
    const box4 = regoleDelBox(kitSsCnCy, "BOX4");
    assert.ok(box4, "il BOX4 non ha regole sue nel kit SS/CN/CY");

    const atteso = JSON.parse(JSON.stringify(generale));
    atteso.gruppoEtichette.push("SOTTOCOSTO");
    assert.deepStrictEqual(box4.ridimensionamenti, [atteso]);
    //Nel BOX7 il BIS sta nella stessa regola della descrizione.
    assert.ok(regoleDelBox(kitSsCnCy, "BOX7").ridimensionamenti.some(r => r.gruppoEtichette.includes("descrizione") && r.gruppoEtichette.includes("BIS")));
});

test("nel kit SS/CN/CY il Campi_DX del BOX4 allinea il gruppo al posto della descrizione, come il BOX7 col BIS", () => {
    const generale = regoleDelBox(kitSsCnCy, null).allineamenti.find(a => a.nomeGruppo === "Campi_DX");
    const box4 = regoleDelBox(kitSsCnCy, "BOX4");
    //I20-1240: le regole della fase descrizioneInBasso del fix foto stanno a parte (fixFoto.sequenza):
    //fra le regole di sempre il BOX4 ha solo il suo Campi_DX.
    assert.deepStrictEqual(box4.allineamenti.filter(a => !a.fase), [conGruppo(generale)]);
    assert.ok(box4.allineamenti.filter(a => a.fase).every(a => a.fase === "descrizioneInBasso" && a.nomeGruppo === "descrizioneInBasso"));
    //Il resto del BOX4 resta quello generale: nessun'altra regola sua.
    for (const sezione of ["postRidimensionamenti", "segnalazioniConflitti", "duplicazioni", "ordiniZ", "disattiva"]) {
        assert.deepStrictEqual(box4[sezione], [], sezione);
    }
    assert.strictEqual(box4.sceltaSpazioFoto, null);
    assert.strictEqual(box4.estensioniFoto, null);
});

test("CssFramework da' al BOX4 il suo Campi_DX col gruppo, e agli altri box quello generale", () => {
    const db = kitSsCnCy.operazioniPerBox;
    const campiDx = (nomeBox) => CssFramework.gruppiDiAllineamentoDelBox({ label: nomeBox }, {}, {}, db, null)
        .filter(g => g.nomeGruppo === "Campi_DX");

    const box4 = campiDx("BOX4");
    assert.strictEqual(box4.length, 1);
    assert.ok(box4[0].gruppoEtichette.includes("gruppo_descrizione_sottocosto"));
    assert.ok(!box4[0].gruppoEtichette.includes("descrizione"));

    const box1 = campiDx("BOX1");
    assert.strictEqual(box1.length, 1);
    assert.ok(box1[0].gruppoEtichette.includes("descrizione"));
});

test("la sovrastruttura del Parmigiano allinea il gruppo del sottocosto accanto a quello del BIS, in tutti e due i kit", () => {
    //Come il gruppo del BIS: la regola del Parmigiano elenca ogni elemento che un Campi_DX dei kit del volantino
    //puo' avere (parmigianoEdro21.test.js). Nel kit SC il gruppo non c'e', e la voce non trova niente.
    const etichette = (kit) => kit.sovrastrutture[0].operazioni.allineamenti.find(a => a.nomeGruppo === "Parmigiano_Prezzi_Payoff").gruppoEtichette;
    for (const kit of [kitSsCnCy, kitSc]) {
        const lista = etichette(kit);
        assert.strictEqual(lista.indexOf("gruppo_descrizione_sottocosto"), lista.indexOf("gruppo_descrizione_BIS") + 1);
    }
});

test("nel kit SC il BOX4 non ha regole sue e niente si ridimensiona col SOTTOCOSTO", () => {
    assert.strictEqual(regoleDelBox(kitSc, "BOX4"), undefined);
    assert.ok(!JSON.stringify(kitSc.operazioniPerBox).includes("gruppo_descrizione_sottocosto"));
    assert.ok(!JSON.stringify(kitSc).includes("\"SOTTOCOSTO\""));
});

/* ---- il fix foto di Edro21 ---- */

//I20-1240: il fix foto di Edro21 non sta piu' nel custom (setCustomFixFoto, gruppoDellaDescrizione): la
//sequenza del fix foto nel CssFramework prova la variante descrizioneInBasso, e la regola con quella fase
//sposta il gruppo della descrizione dove c'e', altrimenti la descrizione.
const cssSequenzaOperazioni = require("../../plugin/cssFramework/sequenzaOperazioni.js");

/// Le etichette che la regola della fase descrizioneInBasso sposta in un box del kit, con gli elementi dati.
function spostatiInBasso(kit, nomeBox, etichette) {
    cssSequenzaOperazioni.registraFasiDelFile(cssEdro.dbRidimensionamentiAllineamenti);
    const DB = cssSequenzaOperazioni.filtraDBPerMomento(kit.operazioniPerBox, "descrizioneInBasso");
    const mappa = {};
    (etichette || []).forEach(e => { mappa[e] = { item: {}, label: e, eliminato: false }; });
    return (CssFramework.gruppiDiAllineamentoDelBox({ label: nomeBox }, mappa, null, DB, null) || [])
        .map(regola => regola.gruppoEtichette);
}

//TASK-9bf94d47: la configurazione del fix foto di Edro21 dal CssFramework, come la legge il Plugin fuori
//dal contesto: la sezione fixFoto generale delle regole scaricate. I20-1240: con la sua sequenza.
function datiFixFoto(etichettaBox) {
    CssFramework.regoleScaricate = cssEdro.dbRidimensionamentiAllineamenti;
    CssFramework.contestoCss = null;
    return CssFramework.getConfigurazioneFixFoto({ label: etichettaBox });
}

function varianteInBasso(etichettaBox) {
    return datiFixFoto(etichettaBox).sequenza.find(p => p.tipo === "simulazioni").varianti.find(v => v.nome === "descrizioneInBasso");
}

test("il fix foto sposta il gruppo della descrizione: quello del BIS nel BOX7, quello del sottocosto nel BOX4", () => {
    assert.deepStrictEqual(spostatiInBasso(kitSsCnCy, "BOX4", ["base", "gruppo_descrizione_sottocosto", "descrizione", "SOTTOCOSTO", "prezzo_offerta"]), [["gruppo_descrizione_sottocosto"]]);
    for (const kit of [kitSsCnCy, kitSc]) {
        assert.deepStrictEqual(spostatiInBasso(kit, "BOX7", ["gruppo_descrizione_BIS", "descrizione", "BIS"]), [["gruppo_descrizione_BIS"]]);
    }
    //Il BOX4 senza il gruppo, e quello del canale SC che non ce l'ha: resta la descrizione.
    assert.deepStrictEqual(spostatiInBasso(kitSsCnCy, "BOX4", ["base", "descrizione", "prezzo_offerta"]), [["descrizione"]]);
    assert.deepStrictEqual(spostatiInBasso(kitSc, "BOX4", ["base", "descrizione", "prezzo_offerta"]), [["descrizione"]]);
    //Gli altri box spostano la descrizione, anche se un'etichetta somiglia a un gruppo.
    assert.deepStrictEqual(spostatiInBasso(kitSsCnCy, "BOX1", ["gruppo_descrizione_sottocosto", "descrizione"]), [["descrizione"]]);
});

test("nel BOX7 la descrizione non si sposta da sola: la variante si prova solo col gruppo del BIS", () => {
    const box7 = varianteInBasso("BOX7");
    assert.deepStrictEqual(box7.listSetCondizioni[0].setCondizioni[0].elementiDaTrovare, ["gruppo_descrizione_BIS"]);
    assert.deepStrictEqual(varianteInBasso("BOX4").listSetCondizioni[0].setCondizioni[0].elementiDaTrovare, ["descrizione"]);
    assert.deepStrictEqual(varianteInBasso("BOX1").listSetCondizioni[0].setCondizioni[0].elementiDaTrovare, ["descrizione"]);
    //Mai col logo antibiotici, in nessun box, come prima.
    for (const box of ["BOX1", "BOX4", "BOX7"]) {
        assert.deepStrictEqual(varianteInBasso(box).listSetCondizioni[0].setCondizioni[0].elementiDaNonTrovare, ["*LOGO_carneS_USOdiANTIBIOTICI*"], box);
    }
});

test("la variante si scarta se il testo del gruppo o della descrizione trabocca o tocca un logo, con le etichette minuscole dei modelli", () => {
    assert.deepStrictEqual(varianteInBasso("BOX7").scartaSe.overflow, ["gruppo_descrizione_BIS"]);
    assert.deepStrictEqual(varianteInBasso("BOX4").scartaSe.overflow, ["descrizione", "gruppo_descrizione_sottocosto"]);
    assert.deepStrictEqual(varianteInBasso("BOX1").scartaSe.overflow, ["descrizione"]);
    assert.ok(!/"Descrizione"/.test(JSON.stringify(cssEdro.dbRidimensionamentiAllineamenti.fixFoto)), "la descrizione si chiama descrizione, minuscola");
    //Un gruppo trabocca se trabocca una sua casella di testo: motivoScarto guarda dentro il gruppo.
    const sistemazione = fs.readFileSync(path.join(radice, "plugin", "sistemazioneFoto", "sistemazioneFoto.js"), "utf8").replace(/\r/g, "");
    assert.match(sistemazione, /var traboccano = conEtichette\(scartaSe\.overflow\)\.filter\(item => testiDi\(item\)\.some\(t => t\.overflows\)\);/);
    assert.doesNotMatch(customEdro, /setCustomFixFoto\(box\)\{|gruppoDellaDescrizione\(gruppo, etichette\)/);
});

/* ---- I20-1180: il tag quantitativi non copre il testo della descrizione ---- */

test("nei due kit del volantino la descrizione si stacca dal tag quantitativi, anche nel BOX4 col gruppo", () => {
    const cssEvitaElementiTesto = require("../../plugin/cssFramework/evitaElementiTesto");
    for (const kit of [kitSsCnCy, kitSc]) {
        //La regola sta nella voce di default del kit: vale per ogni box, BOX4 compreso.
        const regole = cssEvitaElementiTesto.regoleDelBox([regoleDelBox(kit, "BOX4"), regoleDelBox(kit, null)]);
        assert.deepStrictEqual(regole, [{ testi: ["descrizione"], elementi: ["quantitativi"], margine: 1 }]);
    }
});

test("se la descrizione non si stacca, la CSF-013 fra quantitativi e descrizione misurata sul testo lo dice", () => {
    for (const kit of [kitSsCnCy, kitSc]) {
        const regole = CssFramework.regoleConflittiDelBox("BOX4", kit.operazioniPerBox, null);
        const delTag = regole.filter(r => r.latoA.includes("quantitativi") && r.latoB.includes("descrizione"));
        assert.strictEqual(delTag.length, 1);
        assert.strictEqual(delTag[0].useTextBounds, true);
    }
});
