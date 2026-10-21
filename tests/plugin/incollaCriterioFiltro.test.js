/*
 * I20-1118: copia e incolla di un criterio nei filtri di impaginazione.
 *
 * Incollando un criterio copiato (Reparto = OF) il Plugin ricopiava la chiave ma non il valore:
 * la tendina restava su "Seleziona valore", la descrizione diceva "sigla_reparto è uguale a" e i
 * conteggi erano a zero. L'incolla faceva scattare il cambio della chiave, che svuota il valore e
 * lancia la ricerca quando il valore non c'e' ancora, poi reimpostava i campi a modo suo e non
 * rifaceva la ricerca.
 *
 * Ora l'incolla passa da applicaCriterio, la stessa strada dei criteri salvati, e poi rifa' la
 * ricerca. addCriterio costruisce l'interfaccia con jQuery e i picker di UXP: si controlla il
 * sorgente, come per gli altri pezzi di filtri.js che non si eseguono sotto Node.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
const addCriterio = filtri.substring(filtri.indexOf("    addCriterio(body, criterio = null, isTracciato = false) {"));
const incolla = addCriterio.substring(addCriterio.indexOf("if (isPaste) {"), addCriterio.indexOf("// Copia il criterio includendo chiave hidden e valore tendina"));

test("l'incolla applica chiave, operatore e valore della copia come un criterio salvato, poi rifa' la ricerca", () => {
    assert.match(incolla, /applicaCriterio\(\{\s*chiave: criterioCopia\.chiaveHidden \|\| criterioCopia\.chiave,\s*operatore: criterioCopia\.operatore,\s*valore: criterioCopia\.valore\s*\}\);/);
    const applica = incolla.indexOf("applicaCriterio(");
    const ricerca = incolla.indexOf("await me.ricercaFiltro(criterioHtml.closest('.filtro'))");
    assert.ok(applica > 0 && ricerca > applica, "la ricerca parte dopo che il criterio e' stato applicato");
    assert.match(incolla, /if \(isTracciato\) \{\s*aggiornaTracciatoPostRicerca\(resRicerca\);\s*\}/);
});

test("i criteri salvati passano dalla stessa applicaCriterio", () => {
    assert.match(addCriterio, /const applicaCriterio = \(criterio\) => \{/);
    assert.match(addCriterio, /if\(criterio != null\)\{\s*\/\/[^\n]*\n\s*applicaCriterio\(criterio\);\s*\}/);
    //La tendina del valore si riempie e si seleziona dentro applicaCriterio, come per i salvati.
    const applica = addCriterio.substring(addCriterio.indexOf("const applicaCriterio = (criterio) => {"), addCriterio.indexOf("applicaCriterio(criterio);"));
    assert.match(applica, /Menu\.setPickerValue\(filtroValore, criterio\.valore, false\);/);
    assert.match(applica, /\.find\('\.filtro-valore-hidden'\)\.val\(criterio\.valore\);/);
});

test("l'incolla non fa piu' scattare il cambio della chiave e non aspetta che si sistemi", () => {
    assert.doesNotMatch(incolla, /trigger\('change'\)/);
    assert.doesNotMatch(incolla, /Utility\.sleep/);
});

test("senza un criterio copiato resta l'avviso", () => {
    assert.match(incolla, /\} else \{\s*Modali\.popup\('Errore', 'Nessun criterio copiato trovato\.'\);\s*\}/);
});

test("la copia salva ancora chiave nascosta, operatore e valore: le copie fatte prima si incollano", () => {
    const copia = addCriterio.substring(addCriterio.indexOf("// Copia il criterio includendo chiave hidden e valore tendina"));
    assert.match(copia, /chiaveHidden: chiaveHidden,\s*operatore: operatore,\s*valore: valoreHidden,/);
    assert.match(copia, /localStorage\.setItem\('criterioCopia', JSON\.stringify\(criterioDaCopiare\)\);/);
});

test("un cambio della chiave che non la cambia non svuota il criterio: UXP lo manda anche dopo l'incolla", () => {
    const cambio = addCriterio.substring(addCriterio.indexOf("const pickerRawValue = String($(this).val() || '').trim();"), addCriterio.indexOf("if (selectedValue === 'Valore Libero') {"));
    assert.match(cambio, /const chiaveAttuale = String\(chiaveHidden\.val\(\) \|\| ''\)\.trim\(\);/);
    assert.match(cambio, /if \(selectedValue !== '' && selectedValue === chiaveAttuale\) \{\s*return;\s*\}/);
    //Il controllo sta prima di tutto cio' che svuota il valore o ricarica la tendina.
    const gestore = addCriterio.substring(addCriterio.indexOf("const pickerRawValue = String($(this).val() || '').trim();"));
    assert.ok(gestore.indexOf("selectedValue === chiaveAttuale") < gestore.indexOf("valoreInput.val('');"));
});
