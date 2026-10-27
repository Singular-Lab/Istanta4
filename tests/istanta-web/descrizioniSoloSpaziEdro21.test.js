/*
 * TASK-e9620c69: Edro21 vuole vuote le descrizioni fatte solo di spazi e a capo quando si salva dal revisore
 * web o dalla pagina Archivio. Dal Plugin no: un a capo messo dalla scheda ref si perde se l'articolo si
 * salva poi da qui, ed e' voluto.
 *
 * Il revisore e l'Archivio passano le revisioni all'agenzia prima di mandarle a Revisore/salva
 * (IAgenzia.preparaRevisioniDaSalvare, che di norma non cambia niente); lo script di Edro21 svuota
 * Descrizione1-4 quando non hanno altro che spazi e a capo. Coop resta com'era (scriptAgenziaCoop.test.js).
 *
 * Gli script dell'agenzia non esportano niente: si caricano in un contesto vm, come nella pagina, dopo
 * IAgenzia.js.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");
const Archivio = require("../../Istanta/wwwroot/js/archivio.js");

const radice = path.join(__dirname, "..", "..", "Istanta");
const leggi = (relativo) => fs.readFileSync(path.join(radice, relativo), "utf8").replace(/^﻿/, "");

/// IAgenzia e l'Agenzia del cliente, caricate come le carica la pagina.
function classiDellAgenzia(cliente) {
    const contesto = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
    return vm.runInContext(leggi("wwwroot/js/IAgenzia.js") + "\n" + leggi(path.join("ScriptAgenzia", cliente, "agenzia.js")) +
        "\n;({ IAgenzia: IAgenzia, Agenzia: Agenzia });", contesto);
}

const edro21 = classiDellAgenzia("edro21");
const prepara = (revisioni) => edro21.Agenzia.prototype.preparaRevisioniDaSalvare.call({}, revisioni);

test("Edro21: una descrizione fatta solo di spazi o a capo si salva vuota", () => {
    const [preparata] = prepara([{
        Codice: "6714445",
        Descrizione1: "Salame Ungherese",
        Descrizione2: " ",
        Descrizione3: "\n",
        Descrizione4: "\r\n  \n\t",
    }]);
    assert.strictEqual(preparata.Descrizione1, "Salame Ungherese");
    assert.strictEqual(preparata.Descrizione2, "");
    assert.strictEqual(preparata.Descrizione3, "");
    assert.strictEqual(preparata.Descrizione4, "");
    //Anche lo spazio che non va a capo.
    assert.strictEqual(prepara([{ Descrizione3: " " }])[0].Descrizione3, "");
});

test("Edro21: il testo vero parte com'e', spazi e a capo compresi", () => {
    const [preparata] = prepara([{ Descrizione1: " Salame Ungherese ", Descrizione2: "Fiorucci\n", Descrizione3: "", Descrizione4: null }]);
    assert.strictEqual(preparata.Descrizione1, " Salame Ungherese ");
    assert.strictEqual(preparata.Descrizione2, "Fiorucci\n");
    assert.strictEqual(preparata.Descrizione3, "");
    assert.strictEqual(preparata.Descrizione4, null);
});

test("Edro21: DescrizioneIndd e gli altri campi non si toccano, per le schede singole e per i gruppi", () => {
    const singola = { Codice: "1", Descrizione3: "\n", DescrizioneIndd: "\n", Peso: "0.5", Um: " ", Extra: { nota: { type: "string", content: " " } } };
    const gruppo = { CodiceGruppo: "1,2", Descrizione4: "  ", IsSottogruppo: false, revRegionale: { canale: null, area: null, custom: null } };

    //Gli oggetti nascono nel contesto vm, con un altro Object: si confrontano i campi.
    const [preparataSingola, preparatoGruppo] = JSON.parse(JSON.stringify(prepara([singola, gruppo])));

    assert.deepStrictEqual(preparataSingola, { Codice: "1", Descrizione3: "", DescrizioneIndd: "\n", Peso: "0.5", Um: " ", Extra: { nota: { type: "string", content: " " } } });
    assert.deepStrictEqual(preparatoGruppo, { CodiceGruppo: "1,2", Descrizione4: "", IsSottogruppo: false, revRegionale: { canale: null, area: null, custom: null } });
    //Le revisioni di partenza restano com'erano: si mandano copie.
    assert.strictEqual(singola.Descrizione3, "\n");
    assert.deepStrictEqual(prepara(null), null);
});

test("di norma, nelle altre agenzie, le revisioni partono come sono", () => {
    const revisioni = [{ Descrizione3: "\n" }];
    assert.strictEqual(edro21.IAgenzia.prototype.preparaRevisioniDaSalvare.call({}, revisioni), revisioni);
    //Coop non ha la regola: eredita quella di IAgenzia.
    const coop = classiDellAgenzia("coopfi");
    assert.strictEqual(coop.Agenzia.prototype.preparaRevisioniDaSalvare, coop.IAgenzia.prototype.preparaRevisioniDaSalvare);
});

for (const [nome, Classe] of [["revisore", Revisore], ["Archivio", Archivio]]) {
    test(nome + ": le revisioni passano dall'agenzia, e senza un'agenzia che risponde bene partono come sono", () => {
        const revisioni = [{ Descrizione3: "\n" }];
        const pagina = Object.create(Classe.prototype);

        pagina.agenzia = { preparaRevisioniDaSalvare: (r) => r.map(x => Object.assign({}, x, { Descrizione3: "" })) };
        assert.deepStrictEqual(pagina.preparaRevisioniDaSalvare(revisioni), [{ Descrizione3: "" }]);

        for (const agenzia of [null, {}, { preparaRevisioniDaSalvare: () => "non una lista" }, { preparaRevisioniDaSalvare: () => { throw new Error("guasto"); } }]) {
            pagina.agenzia = agenzia;
            const erroreConsole = console.error;
            console.error = () => {};
            try {
                assert.strictEqual(pagina.preparaRevisioniDaSalvare(revisioni), revisioni);
            }
            finally {
                console.error = erroreConsole;
            }
        }
    });
}

test("Archivio: l'agenzia si crea alla prima volta, se nella pagina c'e'", () => {
    const pagina = Object.create(Archivio.prototype);
    assert.strictEqual(pagina.preparaRevisioniDaSalvare([{ Descrizione1: " " }])[0].Descrizione1, " ");
    assert.strictEqual(pagina.agenzia, null);

    global.Agenzia = edro21.Agenzia;
    try {
        const altra = Object.create(Archivio.prototype);
        assert.strictEqual(altra.preparaRevisioniDaSalvare([{ Descrizione1: " " }])[0].Descrizione1, "");
        assert.ok(altra.agenzia instanceof edro21.Agenzia);
    }
    finally {
        delete global.Agenzia;
    }
});

test("revisore e Archivio preparano le revisioni prima di chiamare Revisore/salva", () => {
    for (const file of ["wwwroot/js/revisore.js", "wwwroot/js/archivio.js"]) {
        const sorgente = leggi(file).replace(/\r/g, "");
        const inizio = sorgente.indexOf("    salvaFunction(listAct, callback, senderButton) {");
        const chiamata = sorgente.indexOf("Call.do(\"Revisore\", \"salva/\"", inizio);
        const preparazione = sorgente.indexOf("listAct = this.preparaRevisioniDaSalvare(listAct);", inizio);
        assert.ok(inizio >= 0 && preparazione > inizio && preparazione < chiamata, file);
    }
});
