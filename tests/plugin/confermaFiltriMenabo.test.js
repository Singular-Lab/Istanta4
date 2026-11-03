/*
 * I20-1187: un filtro tolto dal Menabò, dopo Conferma, tornava alla riapertura della pagina.
 *
 * apriModal mette nella finestra una copia di #dialogFiltri e il modello resta in index.html: gli id
 * esistono due volte. A finestra chiusa $('#bodyFiltri') e' il modello, e i filtri ancora in
 * caricamento finivano li'; salvaFiltri raccoglieva '#bodyFiltri .filtro', cioe' anche quelli del
 * modello, e li salvava a ogni Conferma. Sul PC che riproduceva, in console: un filtro nel modello,
 * uno trovato dal selettore globale, nessuno nella finestra.
 *
 * Ora apertura, aggiunta, frecce e Conferma lavorano sul #bodyFiltri della finestra aperta, e
 * l'apertura smette di caricare se la finestra si chiude. Il codice costruisce l'interfaccia con
 * jQuery dentro UXP: si controlla il sorgente, come per gli altri pezzi di filtri.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");

function corpo(firma, fine) {
    const inizio = filtri.indexOf(firma);
    assert.ok(inizio >= 0, "manca " + firma);
    return filtri.substring(inizio, filtri.indexOf(fine, inizio + firma.length));
}

const apriFiltriPagina = corpo("    async apriFiltriPagina(pagina, scrollTop = 0) {", "\n    corpoFiltriAperto() {");
const addNewFiltro = corpo("    async addNewFiltro(filtro = null, alternativeBody = null, hideButtonsForTracciato = false, hideNarrow = false) {", "\n    addCriterio(");
const salvaFiltri = corpo("    salvaFiltri(){", "\n    getNomeFileFiltriJson(){");

/// Il codice eseguito, senza i commenti: quelli spiegano anche il selettore di prima.
function senzaCommenti(testo) {
    return testo.split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

test("il corpo dei filtri e' quello della finestra aperta, non il primo #bodyFiltri del documento", () => {
    assert.match(filtri, /corpoFiltriAperto\(\) \{\s*return \$\('#overlayModal'\)\.find\('#bodyFiltri'\)\.first\(\);\s*\}/);
    assert.match(filtri, /corpoFiltriAncoraAperto\(corpoFiltri\) \{\s*return corpoFiltri != null && corpoFiltri\.length > 0 && corpoFiltri\[0\] === this\.corpoFiltriAperto\(\)\[0\];\s*\}/);
});

test("la Conferma salva solo i filtri della finestra aperta", () => {
    assert.match(salvaFiltri, /this\.corpoFiltriAperto\(\)\.children\('\.filtro'\)\.each\(function \(\) \{/);
});

test("nessun selettore globale prende piu' i filtri anche dal modello nascosto", () => {
    assert.doesNotMatch(senzaCommenti(filtri), /\$\('#bodyFiltri \.filtro'\)/);
});

test("l'apertura svuota e riempie il corpo della finestra appena aperta", () => {
    const apertura = apriFiltriPagina.indexOf("Modali.apriModal('dialogFiltri'");
    const corpoPreso = apriFiltriPagina.indexOf("const corpoFiltri = me.corpoFiltriAperto();");
    assert.ok(apertura >= 0 && corpoPreso > apertura, "il corpo si prende dopo aver aperto la finestra");
    assert.match(apriFiltriPagina, /corpoFiltri\.empty\(\);/);
    assert.match(apriFiltriPagina, /await me\.addNewFiltro\(filtro, corpoFiltri\);/);
    assert.doesNotMatch(senzaCommenti(apriFiltriPagina), /\$\('#bodyFiltri'\)/);
});

test("chiusa la finestra mentre i filtri si caricano, quelli che restano non vanno nel modello", () => {
    const controllo = apriFiltriPagina.indexOf("if (!me.corpoFiltriAncoraAperto(corpoFiltri)) {");
    const aggiunta = apriFiltriPagina.indexOf("await me.addNewFiltro(filtro, corpoFiltri);");
    assert.ok(controllo >= 0 && aggiunta > controllo, "il controllo viene prima di ogni filtro aggiunto");
    assert.match(apriFiltriPagina.substring(controllo), /^if \(!me\.corpoFiltriAncoraAperto\(corpoFiltri\)\) \{\s*return;\s*\}/);
});

test("un filtro nuovo senza corpo indicato va nella finestra aperta; il tracciato della Home resta nel suo", () => {
    assert.match(addNewFiltro, /if\(alternativeBody != null\)\{\s*alternativeBody\.append\(newFiltroDiv\);\s*\}\s*else\{\s*\/\/[^\n]*\n\s*this\.corpoFiltriAperto\(\)\.append\(newFiltroDiv\);\s*\}/);
});

test("le frecce spostano il filtro fra quelli del suo stesso corpo", () => {
    const frecce = addNewFiltro.match(/const allFilters = [^;]+;/g) || [];
    assert.strictEqual(frecce.length, 2);
    frecce.forEach(riga => assert.strictEqual(riga, "const allFilters = newFiltroDiv.parent().children('.filtro');"));
});
