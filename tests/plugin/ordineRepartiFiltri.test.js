/*
 * I20-1198: nella tendina dei valori di un criterio dei filtri del Menabò i reparti di Edro21
 * uscivano nell'ordine in cui comparivano nella lista, e il pesce (PE) finiva dopo la cura casa
 * invece che subito dopo la carne (CA). Ora filtri.js applica lo schema di ordinamento che il plugin
 * di agenzia dichiara col nome del campo, e Edro21 dichiara «sigla_reparto» con l'ordine
 * merceologico del suo SourceOrdinamentoLista.
 *
 * L'ordinamento si prova eseguendo applicaSchemaDiOrdinamentoConPesi di pluginMiddleware, preso dal
 * sorgente perche' il modulo intero non si carica sotto Node; la tendina si controlla nel sorgente
 * di filtri.js, come per gli altri pezzi che usano jQuery e i picker di UXP.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const RADICE = path.join(__dirname, "..", "..");
const leggi = relativo => fs.readFileSync(path.join(RADICE, relativo), "utf8").replace(/\r/g, "");

const ORDINE = ["OF", "CA", "PE", "FO", "GA", "LS", "SG", "DAL", "BV", "CP", "PC", "EX"];

const customEdro21 = JSON.parse(leggi("Istanta/wwwroot/external_source/Edro21/SourceCustomPlugin.json"));
const schemaReparti = (customEdro21.schemiOrdinamentoConPesi || []).filter(s => s.titolo === "sigla_reparto");

//applicaSchemaDiOrdinamentoConPesi com'e' in pluginMiddleware.js, su un middleware finto con la
//configurazione di Edro21.
function ordinatore(schemi) {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    applicaSchemaDiOrdinamentoConPesi(_lista, field, chiaveSchema) {");
    assert.ok(inizio >= 0, "applicaSchemaDiOrdinamentoConPesi non trovata: il test va aggiornato");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    const metodo = sorgente.substring(inizio, fine) + "\n    }";
    const middleware = new Function("return {" + metodo + "};")();
    middleware.callCustom = false;
    middleware.customPluginDB = { schemiOrdinamentoConPesi: schemi };
    return lista => middleware.applicaSchemaDiOrdinamentoConPesi(lista.slice(), "", "sigla_reparto");
}

test("Edro21 dichiara l'ordine dei reparti, con il pesce subito dopo la carne", () => {
    assert.strictEqual(schemaReparti.length, 1);
    assert.deepStrictEqual(schemaReparti[0].gerarchia, ORDINE);
    assert.strictEqual(ORDINE.indexOf("PE"), ORDINE.indexOf("CA") + 1);
    assert.strictEqual(schemaReparti[0].regex, "^(" + ORDINE.join("|") + ")$");
});

test("l'ordine contiene ogni sigla di reparto che AgenziaLib assegna in Edro21", () => {
    const edro21 = leggi("AgenziaLib/Edro21.cs");
    const sigle = new Set([...edro21.matchAll(/keySiglaReparto\] = "([A-Z]+)";/g)].map(m => m[1]));
    assert.ok(sigle.size >= 10, "sigle trovate in Edro21.cs: " + [...sigle].join(","));
    sigle.forEach(s => assert.ok(ORDINE.includes(s), s + " manca dall'ordine dei reparti"));
});

test("l'ordine e' quello merceologico della lista di Edro21", () => {
    //il primo reparto di ogni gruppo nel SourceOrdinamentoLista, col suo POP_<sigla>
    const lista = JSON.parse(leggi("Istanta/wwwroot/external_source/Edro21/SourceOrdinamentoLista.json")).source;
    const visti = [];
    lista.slice().sort((a, b) => a.GlobalIndice - b.GlobalIndice).forEach(x => {
        const m = /POP_([A-Z]+)/.exec(x.Gruppo || "");
        if (m && !visti.includes(m[1])) visti.push(m[1]);
    });
    assert.deepStrictEqual(visti, ORDINE);
});

test("la tendina dei reparti mette PE dopo CA e lascia in fondo chi lo schema non conosce", () => {
    const ordina = ordinatore(customEdro21.schemiOrdinamentoConPesi);
    //l'ordine dell'allegato della issue: PE dopo PC
    assert.deepStrictEqual(ordina(["CA", "SG", "DAL", "BV", "CP", "PC", "PE", "EX"]),
        ["CA", "PE", "SG", "DAL", "BV", "CP", "PC", "EX"]);
    assert.deepStrictEqual(ordina(["EX", "", "XY", "PE", "OF"]), ["OF", "PE", "EX", "", "XY"]);
});

test("senza lo schema del campo la tendina resta nell'ordine della lista", () => {
    const ordina = ordinatore([]);
    assert.deepStrictEqual(ordina(["CA", "SG", "PE"]), ["CA", "SG", "PE"]);
});

test("filtri.js applica lo schema col nome del campo a ogni tendina che non sia delle etichette", () => {
    const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
    const funzione = filtri.substring(filtri.indexOf("    trovaValoriPerTendinaValueDelFiltro(chiave, scope = null){"),
                                      filtri.indexOf("    /// Scrive i filtri in Filtri.json"));
    assert.match(funzione, /else \{[\s\S]*?valoriTrovatiArray = pluginMiddleware\.applicaSchemaDiOrdinamentoConPesi\(valoriTrovatiArray, "", chiave\) \|\| valoriTrovatiArray;\s*\}/);
    assert.match(funzione, /return valoriTrovatiArray;/);
});
