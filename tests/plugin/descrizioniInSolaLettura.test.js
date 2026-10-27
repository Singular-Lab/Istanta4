/*
 * I20-1132: descrizioni fondamentali in sola lettura su regola dell'agenzia.
 *
 * Il plugin di agenzia dichiara in descrizioniInSolaLettura, per una fondamentale, una regola sul
 * record e una nota; quando la regola vale la scheda ref mostra la casella readonly con la nota e
 * il salvataggio manda quella descrizione come non toccata. Il core non sa perche': per Edro21 e'
 * la grammatura presa dalla confezione primaria (grammatura_da_confezione nel record).
 *
 * InputEditController e schedaRef si caricano sotto Node; pluginMiddleware no, e il getter si prende
 * dal sorgente e si esegue con un middleware finto. Del resto si legge il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const InputEditController = require("../../plugin/InputEditController.js");
const schedaRef = require("../../plugin/schedaRef.js");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const NON_TOCCATO = "<untouched>";

/* ---- il salvataggio ---- */

const archivio = ["BISCOTTI", "CONAD", "petit, per latte", "conf. 6 x 1 l", ""];

function voce(fondamentale, valore, modificato = false, nascosto = false) {
    return { stile: "DES_" + fondamentale, fondamentale, valore, modificato, nascosto };
}

test("la fondamentale in sola lettura parte come non toccata anche se il box differisce dall'archivio", () => {
    //Descrizione3 corretta dall'operatore; la grammatura del box e' ancora quella di prima della
    //reimpaginazione, diversa dall'archivio.
    const voci = [voce("descrizione1", "BISCOTTI"), voce("descrizione2", "CONAD"), voce("descrizione3", "petit, per il latte", true), voce("descrizione4", "1 l")];

    const decise = InputEditController.decidiFondamentali(voci, archivio, { nonToccare: ["descrizione4"] });

    assert.strictEqual(decise.valori.descrizione3, "petit, per il latte");
    assert.strictEqual(decise.valori.descrizione4, NON_TOCCATO);
    assert.deepStrictEqual(decise.cambiati, ["descrizione3"]);
});

test("senza nonToccare la stessa grammatura partirebbe, come prima", () => {
    const voci = [voce("descrizione3", "petit, per il latte", true), voce("descrizione4", "1 l")];

    const decise = InputEditController.decidiFondamentali(voci, archivio);

    assert.strictEqual(decise.valori.descrizione4, "1 l");
    assert.deepStrictEqual(decise.cambiati, ["descrizione3", "descrizione4"]);
});

test("i tratti ripetuti di una fondamentale in sola lettura non fermano il salvataggio", () => {
    const voci = [voce("descrizione4", "1 l"), { stile: "DES_Grammatura_2", fondamentale: "descrizione4", valore: "conf. 6 x 1 l", modificato: false, nascosto: false }];

    const senza = InputEditController.decidiFondamentali(voci, archivio);
    assert.strictEqual(senza.ripetuti.length, 1);

    const con = InputEditController.decidiFondamentali(voci, archivio, { nonToccare: ["descrizione4"] });
    assert.deepStrictEqual(con.ripetuti, []);
    assert.strictEqual(con.valori.descrizione4, NON_TOCCATO);
});

test("nonToccare malformato o vuoto non cambia niente", () => {
    const voci = [voce("descrizione4", "1 l")];
    for (const nonToccare of [undefined, null, "descrizione4", {}, []]) {
        const decise = InputEditController.decidiFondamentali(voci, archivio, { nonToccare });
        assert.strictEqual(decise.valori.descrizione4, "1 l");
    }
});

test("il controller riceve le fondamentali in sola lettura alla nascita e le passa al salvataggio e al confronto con l'archivio", () => {
    const sorgente = leggiFileDelPlugin("InputEditController.js").replace(/\r/g, "");
    assert.match(sorgente, /^\s*fondamentaliInSolaLettura = \[\];/m);
    //I20-1143: dopo, i testi composti dal server.
    assert.match(sorgente, /constructor\(container, convalidaFirma, descrInArchivio, compiledFields = null, fondamentaliInSolaLettura = \[\](, testiComposti = null)?\) \{/);
    assert.match(sorgente, /this\.fondamentaliInSolaLettura = Array\.isArray\(fondamentaliInSolaLettura\) \? fondamentaliInSolaLettura : \[\];/);
    assert.match(sorgente, /decidiFondamentali\(voci, this\.descrInArchivio, \{ nonToccare: this\.fondamentaliInSolaLettura(, composto: this\.testiComposti)? \}\)/);
    assert.match(sorgente, /\{ forzato: descrizioneEreditata, inMismatch: this\.inMismatch, solaLettura: this\.solaLettura, nonToccare: this\.fondamentaliInSolaLettura(, composto: this\.testiComposti)? \}/);
});

/* ---- la scheda ---- */

test("la voce di sola lettura si trova per fondamentale, con la nota, altrimenti null", () => {
    const descrizioni = [{ fondamentale: "descrizione4", nota: "Grammatura della confezione 32711vv2" }, { fondamentale: "descrizione2" }];

    assert.deepStrictEqual(schedaRef.descrizioneInSolaLettura(descrizioni, "descrizione4"), { fondamentale: "descrizione4", nota: "Grammatura della confezione 32711vv2" });
    assert.deepStrictEqual(schedaRef.descrizioneInSolaLettura(descrizioni, "descrizione2"), { fondamentale: "descrizione2", nota: "" });
    assert.strictEqual(schedaRef.descrizioneInSolaLettura(descrizioni, "descrizione1"), null);
    assert.strictEqual(schedaRef.descrizioneInSolaLettura(descrizioni, null), null);
    assert.strictEqual(schedaRef.descrizioneInSolaLettura([], "descrizione4"), null);
    assert.strictEqual(schedaRef.descrizioneInSolaLettura(null, "descrizione4"), null);
});

test("la casella in sola lettura si attenua e la sua nota va da parte, una per fondamentale", () => {
    const opacita = [];
    const textarea = { css(nome, valore) { opacita.push(nome + "=" + valore); return this; } };
    const scheda = {};
    const voce = { fondamentale: "descrizione4", nota: "Grammatura della confezione 32711vv2" };

    assert.strictEqual(schedaRef.segnaCasellaInSolaLettura.call(scheda, textarea, null), false);
    assert.deepStrictEqual(opacita, []);

    assert.strictEqual(schedaRef.segnaCasellaInSolaLettura.call(scheda, textarea, voce), true);
    //Lo stesso tratto in due caselle: una sola nota.
    assert.strictEqual(schedaRef.segnaCasellaInSolaLettura.call(scheda, textarea, voce), true);
    assert.strictEqual(schedaRef.segnaCasellaInSolaLettura.call(scheda, null, { fondamentale: "descrizione2", nota: "" }), true);

    assert.deepStrictEqual(opacita, ["opacity=0.6", "opacity=0.6"]);
    assert.deepStrictEqual(scheda.noteSolaLetturaDaMostrare, [voce]);
});

test("la schermata di modifica chiede le descrizioni in sola lettura una volta e le applica a ogni casella", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");

    assert.match(sorgente, /var descrizioniInSolaLettura = pluginMiddleware\.getDescrizioniInSolaLettura != null \? \(pluginMiddleware\.getDescrizioniInSolaLettura\(primario\.recordInTracciato\) \|\| \[\]\) : \[\];/);
    //Le tre caselle: schema, tratto del box, schema senza tratto.
    for (const stile of ["nome_schema", "currentCharacterStyle", "elSchema\\[1\\]"]) {
        assert.match(sorgente, new RegExp("var notaSolaLettura = me\\.notaDescrizioneInSolaLettura\\(descrizioniInSolaLettura, " + stile + "\\);\\s*if \\(notaSolaLettura != null\\) \\{\\s*isEditable = false;\\s*\\}"));
    }
    //La nota non sta nella colonna: la casella si attenua e la nota va nella riga sotto i campi.
    assert.strictEqual((sorgente.match(/me\.segnaCasellaInSolaLettura\(textarea, notaSolaLettura\);/g) || []).length, 3);
    assert.ok(!/column\.append\(me\.elementoNotaSolaLettura/.test(sorgente), "la nota non deve stare nella colonna");
    assert.match(sorgente, /\$\("#editReferenza"\)\.append\(row\);\s*\}\s*\/\/[^\n]*\n\s*me\.mostraNoteSolaLettura\(descrizioniAlterate\);\s*var button = \$\('<sp-action-button id="salvaButton"/);
    assert.match(sorgente, /me\.noteSolaLetturaDaMostrare = \[\];/);
    assert.match(sorgente, /me\.editRefFieldController = new InputEditController\([^\n]*compiledFields, descrizioniInSolaLettura\.map\(function \(d\) \{ return d\.fondamentale; \}\)(, me\.testiCompostiDelPrimario\(me\.schedeRefDati\))?\);/);
    //La casella nasce readonly quando isEditable e' falso, com'era.
    assert.ok((sorgente.match(/\(isEditable\s*&& refEditabile \? '' : 'readonly'\)/g) || []).length >= 3);
});

/* ---- il middleware ---- */

//Il corpo di getDescrizioniInSolaLettura, eseguito con un middleware finto al posto di this.
function getDescrizioniInSolaLettura() {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    getDescrizioniInSolaLettura(itemRef) {");
    assert.notStrictEqual(inizio, -1, "getDescrizioniInSolaLettura non trovata in pluginMiddleware.js");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    const corpo = sorgente.substring(sorgente.indexOf("{", inizio) + 1, fine);
    return new Function("itemRef", corpo);
}

function middlewareFinto(regole) {
    return {
        callCustom: false,
        customPluginDB: { descrizioniInSolaLettura: regole },
        //La regola vale se il record porta tutti i campi delle regole con un valore non vuoto.
        valutaBlocchiRegole(itemRef, blocchi) {
            return (blocchi || []).every(b => (b.regole || []).every(r => itemRef[r.campo] != null && itemRef[r.campo] !== ""));
        },
        replacePlaceholders(testo, itemRef) {
            return String(testo == null ? "" : testo).replace(/\{([^}]+)\}/g, (m, k) => itemRef[k] == null ? "" : String(itemRef[k]));
        }
    };
}

const regolaEdro = { fondamentale: "descrizione4", nota: "Grammatura della confezione {grammatura_da_confezione}", setRegole: [{ regole: [{ campo: "grammatura_da_confezione", operatore: 6 }] }] };

test("la regola che vale da' la fondamentale con la nota risolta sul record", () => {
    const getter = getDescrizioniInSolaLettura();

    const valide = getter.call(middlewareFinto([regolaEdro]), { grammatura_da_confezione: "32711vv2" });

    assert.deepStrictEqual(valide, [{ fondamentale: "descrizione4", nota: "Grammatura della confezione 32711vv2" }]);
});

test("la regola che non vale, una lista non valida o una voce senza fondamentale non danno niente", () => {
    const getter = getDescrizioniInSolaLettura();

    assert.deepStrictEqual(getter.call(middlewareFinto([regolaEdro]), { "Referenza.Codice": "32711" }), []);
    assert.deepStrictEqual(getter.call(middlewareFinto(null), { grammatura_da_confezione: "32711vv2" }), []);
    assert.deepStrictEqual(getter.call(middlewareFinto("descrizione4"), { grammatura_da_confezione: "32711vv2" }), []);
    assert.deepStrictEqual(getter.call(middlewareFinto([{ nota: "senza fondamentale" }, null]), { grammatura_da_confezione: "32711vv2" }), []);
});

test("una voce senza regole vale sempre, e per fondamentale conta la prima che vale", () => {
    const getter = getDescrizioniInSolaLettura();
    const regole = [{ fondamentale: "descrizione2", nota: "sempre" }, regolaEdro, { fondamentale: "descrizione4", nota: "seconda", setRegole: [] }];

    const valide = getter.call(middlewareFinto(regole), { grammatura_da_confezione: "32711vv2" });

    assert.deepStrictEqual(valide, [{ fondamentale: "descrizione2", nota: "sempre" }, { fondamentale: "descrizione4", nota: "Grammatura della confezione 32711vv2" }]);
});

test("con callCustom decide il custom dell'agenzia, se lo espone", () => {
    const getter = getDescrizioniInSolaLettura();
    global.customAgenzia = { getDescrizioniInSolaLettura: () => [{ fondamentale: "descrizione1", nota: "dal custom" }] };
    try {
        assert.deepStrictEqual(getter.call({ callCustom: true }, {}), [{ fondamentale: "descrizione1", nota: "dal custom" }]);
        global.customAgenzia = {};
        assert.deepStrictEqual(getter.call({ callCustom: true }, {}), []);
    }
    finally {
        delete global.customAgenzia;
    }
});

/* ---- il dato di Edro21 ---- */

test("il SourceCustomPlugin di Edro21 dichiara la grammatura in sola lettura quando il record porta grammatura_da_confezione", () => {
    const percorso = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceCustomPlugin.json");
    const sorgente = JSON.parse(fs.readFileSync(percorso, "utf8"));

    assert.strictEqual(sorgente.descrizioniInSolaLettura.length, 1);
    const voce = sorgente.descrizioniInSolaLettura[0];
    assert.strictEqual(voce.fondamentale, "descrizione4");
    assert.match(voce.nota, /\{grammatura_da_confezione\}/);
    assert.match(voce.nota, /revisore/);
    const regola = voce.setRegole[0].Regole[0];
    assert.strictEqual(regola.Campo, "grammatura_da_confezione");
    assert.strictEqual(regola.Operatore, 6);
});
