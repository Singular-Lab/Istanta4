/*
 * I20-1241: nella finestra dei filtri di una pagina del Menabo' un valore lungo (per esempio il tema
 * "PROMO SOCI ESCLUSIVA RICORR.NATALE (UFI+TDM+A)") restava tagliato anche allargando il pannello:
 * la finestra si allargava, ma la tendina del valore restava di 200px, e con lei il suo menu, che
 * tagliava le voci.
 *
 * Ora nel Menabo' la tendina del valore, e il campo del valore libero che compare al suo posto,
 * prendono lo spazio libero della riga (flexGrow). La base resta di 200px: a pannello stretto la
 * riga e' quella di prima, e setPickerWidthHack la allarga ancora al passaggio del mouse leggendo
 * minWidth e maxWidth della tendina. Nel Consulta Tracciato non cambia niente.
 *
 * addCriterio costruisce l'interfaccia con jQuery e i picker di UXP: si controlla il sorgente, come
 * per gli altri pezzi di filtri.js che non si eseguono sotto Node. La prova vera e' in InDesign.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const filtri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
const addCriterio = filtri.substring(filtri.indexOf("    addCriterio(body, criterio = null, isTracciato = false) {"), filtri.indexOf("    creaPickerTemplateFiltro("));

//La costruzione di un elemento della riga: dalla sua classe fino all'elemento successivo.
function elemento(classe) {
    const inizio = addCriterio.indexOf(".addClass('" + classe + "')");
    assert.notStrictEqual(inizio, -1, classe + " non trovato: il test va aggiornato");
    return addCriterio.substring(inizio, addCriterio.indexOf(".on(", inizio));
}

test("nel Menabo' la tendina del valore prende lo spazio libero della riga, nel tracciato no", () => {
    assert.match(elemento("filtro-valore-tendina"), /\.css\(\{ width: '200px', flexGrow: \(isTracciato \? '0' : '1'\),/);
});

test("anche il valore libero prende lo spazio libero nel Menabo' e resta com'era nel tracciato", () => {
    assert.match(elemento("filtro-valore-hidden"), /\.css\(\{ width: \(isTracciato\?'200px':'30%'\), flexGrow: \(isTracciato \? '0' : '1'\),/);
});

test("la tendina del valore tiene minWidth e maxWidth: a pannello stretto si allarga ancora al passaggio del mouse", () => {
    const inizio = addCriterio.indexOf(".addClass('filtro-valore-tendina')");
    const costruzione = addCriterio.substring(addCriterio.lastIndexOf("$('<sp-picker", inizio), inizio);
    assert.match(costruzione, /\$\('<sp-picker maxWidth="300px" minWidth="200px"><\/sp-picker>'\)/);
    assert.match(addCriterio, /if \(!isTracciato\)\{\s*criterioHtml\.find\("sp-picker"\)\.each\(function\(\)\{\s*Menu\.setPickerWidthHack\(\$\(this\)\);/);
});

test("chiave e operatore non cambiano larghezza", () => {
    assert.match(elemento("filtro-chiave"), /\.css\(\{ width: '200px', marginRight: '10px', fontSize:'10px' \}\)/);
    assert.match(elemento("filtro-operatore"), /\.css\(\{ width: '100px', marginRight: '10px' \}\)/);
});
