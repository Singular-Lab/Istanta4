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
    assert.deepStrictEqual(box4.allineamenti, [conGruppo(generale)]);
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

/* ---- il fix foto custom di Edro21 ---- */

/// Il corpo di un membro dell'oggetto customAgenzia, isolato contando le graffe.
function corpoFunzione(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata: il test va aggiornato");
    let livello = 0;
    let aperta = false;
    for (let i = inizio; i < testo.length; i++) {
        if (testo[i] === "{") { livello++; aperta = true; }
        else if (testo[i] === "}") { livello--; }
        if (aperta && livello === 0) {
            return testo.substring(inizio, i + 1);
        }
    }
    assert.fail("corpo di " + intestazione + " non delimitato");
}

const gruppoDellaDescrizione = new Function("return function " + corpoFunzione(customEdro, "gruppoDellaDescrizione(etichettaBox, etichette) {"))();
const setCustomFixFoto = corpoFunzione(customEdro, "setCustomFixFoto(box){");

test("il fix foto sposta il gruppo della descrizione: quello del BIS nel BOX7, quello del sottocosto nel BOX4", () => {
    assert.strictEqual(gruppoDellaDescrizione("BOX4", ["base", "gruppo_descrizione_sottocosto", "descrizione", "SOTTOCOSTO", "prezzo_offerta"]), "gruppo_descrizione_sottocosto");
    assert.strictEqual(gruppoDellaDescrizione("BOX7", ["gruppo_descrizione_BIS", "descrizione", "BIS"]), "gruppo_descrizione_BIS");
    //Il BOX4 del canale SC non ha il gruppo: resta la descrizione.
    assert.strictEqual(gruppoDellaDescrizione("BOX4", ["base", "descrizione", "prezzo_offerta"]), null);
    //Gli altri box non hanno un gruppo della descrizione, anche se un'etichetta gli somiglia.
    assert.strictEqual(gruppoDellaDescrizione("BOX1", ["gruppo_descrizione_sottocosto", "descrizione"]), null);
    assert.strictEqual(gruppoDellaDescrizione("BOX7", ["gruppo_descrizione_sottocosto"]), null);
    assert.strictEqual(gruppoDellaDescrizione("BOX4", null), null);
});

test("il fix foto custom usa il gruppo della descrizione per la scelta e per la descrizione da stringere", () => {
    assert.match(setCustomFixFoto, /var gruppoDescrizione = this\.gruppoDellaDescrizione\(box\.label, etichetteDelBox\);/);
    assert.match(setCustomFixFoto, /if \(gruppoDescrizione != null\) \{\s*if \(etichetta == gruppoDescrizione\) \{\s*descrizione = item;/);
    //Senza gruppo la descrizione, tranne nel BOX7 come prima.
    assert.match(setCustomFixFoto, /else if \(etichetta == "descrizione" && box\.label != "BOX7"\) \{\s*descrizione = item;/);
    //Dentro il gruppo si stringe la descrizione, con l'etichetta come la scrivono i modelli: minuscola.
    assert.match(setCustomFixFoto, /if \(gruppoDescrizione != null && descrizione\.allPageItems != null\)/);
    assert.match(setCustomFixFoto, /Utility\.parseLabel\(itemDescrizioneNelGruppo\.label\) == "descrizione"/);
    assert.ok(!/== "Descrizione"/.test(setCustomFixFoto), "la descrizione nel gruppo si chiama descrizione, minuscola");
    assert.ok(!/gruppo_descrizione_BIS" && box\.label == "BOX7"/.test(setCustomFixFoto));
});
