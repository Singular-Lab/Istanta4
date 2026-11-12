/*
 * Il criterio data e ora dei filtri del tracciato e del Menabo'.
 *
 * Coop filtra per la data di modifica delle referenze (l'ultima importazione che le ha cambiate), e
 * li' conta l'ora: un campo dei filtri dichiarato con isData e conOrario chiede, accanto al
 * calendario, l'orario OO:MM (parte da 01:00) e confronta al minuto, senza i secondi. I campi data
 * senza orario (Edro21: data_da, data_a) restano come prima: solo il giorno.
 *
 * I conti (orario, data e ora, confronto al minuto) si eseguono; l'interfaccia, costruita con jQuery
 * e i campi di UXP, si controlla sul sorgente come negli altri test di filtri.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let filtri;
try {
    filtri = require("../../plugin/filtri.js");
}
finally {
    Module._load = caricaOriginale;
}
const Menu = require("../../plugin/menu.js");

const sorgenteFiltri = leggiFileDelPlugin("filtri.js").replace(/\r/g, "");
const sorgenteMenu = leggiFileDelPlugin("menu.js").replace(/\r/g, "");

/* ---- l'orario ---- */

test("l'orario di partenza e' 01:00", () => {
    assert.strictEqual(Menu.ORARIO_PREDEFINITO, "01:00");
});

test("un orario si legge come OO:MM, anche con una cifra o con il punto", () => {
    assert.strictEqual(Menu.orarioValido("10:00"), "10:00");
    assert.strictEqual(Menu.orarioValido("9:05"), "09:05");
    assert.strictEqual(Menu.orarioValido(" 9.30 "), "09:30");
});

test("un orario che non esiste non vale", () => {
    for (const sbagliato of ["24:00", "10:60", "10", "abc", "", null, undefined, "10:5"]) {
        assert.strictEqual(Menu.orarioValido(sbagliato), null, String(sbagliato));
    }
});

test("le frecce spostano ore o minuti e girano su mezzanotte e sull'ora", () => {
    assert.strictEqual(Menu.spostaOrario("01:00", "ore", 1), "02:00");
    assert.strictEqual(Menu.spostaOrario("23:15", "ore", 1), "00:15");
    assert.strictEqual(Menu.spostaOrario("00:15", "ore", -1), "23:15");
    assert.strictEqual(Menu.spostaOrario("10:59", "minuti", 1), "10:00");
    assert.strictEqual(Menu.spostaOrario("10:00", "minuti", -1), "10:59");
    //Da un orario non valido si parte da quello predefinito.
    assert.strictEqual(Menu.spostaOrario("xx", "ore", 1), "02:00");
});

test("data e orario di un valore, con i secondi tolti e anche in forma ISO", () => {
    assert.deepStrictEqual(Menu.separaDataOra("12/11/2026 10:00"), { data: "12/11/2026", orario: "10:00" });
    assert.deepStrictEqual(Menu.separaDataOra("12/11/2026 10:00:45"), { data: "12/11/2026", orario: "10:00" });
    assert.deepStrictEqual(Menu.separaDataOra("12/11/2026"), { data: "12/11/2026", orario: null });
    assert.deepStrictEqual(Menu.separaDataOra("2026-11-12T14:05:59"), { data: "12/11/2026", orario: "14:05" });
    assert.deepStrictEqual(Menu.separaDataOra(""), { data: "", orario: null });
    assert.deepStrictEqual(Menu.separaDataOra("non una data"), { data: "", orario: null });
});

/* ---- il confronto al minuto ---- */

test("solo un campo con isData e conOrario e' una data con orario", () => {
    assert.strictEqual(filtri.campoConOrario({ campoAssociato: "Tracciato.DataModifica", isData: true, conOrario: true }), true);
    assert.strictEqual(filtri.campoConOrario({ campoAssociato: "data_da", isData: true }), false);
    assert.strictEqual(filtri.campoConOrario(null), false);
});

test("maggiore o uguale a un giorno alle 10:00 trova la referenza delle 14:05 e non quella delle 09:30", () => {
    const criterio = filtri.minutoConfrontabile("12/11/2026 10:00");
    assert.ok(filtri.minutoConfrontabile("12/11/2026 14:05") >= criterio);
    assert.ok(filtri.minutoConfrontabile("12/11/2026 09:30") < criterio);
});

test("i secondi non contano: 10:00:45 e' uguale a 10:00", () => {
    assert.strictEqual(filtri.minutoConfrontabile("12/11/2026 10:00:45"), filtri.minutoConfrontabile("12/11/2026 10:00"));
});

test("un valore che non e' una data non e' confrontabile, uno senza orario vale la mezzanotte", () => {
    assert.strictEqual(filtri.minutoConfrontabile(""), null);
    assert.strictEqual(filtri.minutoConfrontabile(undefined), null);
    assert.strictEqual(filtri.minutoConfrontabile("12/11/2026"), filtri.minutoConfrontabile("12/11/2026 00:00"));
});

test("la ricerca confronta al minuto i campi con orario e al giorno gli altri", () => {
    const ricerca = sorgenteFiltri.substring(sorgenteFiltri.indexOf("    async ricercaFiltro(filtro){"), sorgenteFiltri.indexOf("\n    async scorriFiltri("));
    assert.match(ricerca, /const confrontaData = campoData && filtri\.campoConOrario\(campoAssociato\)\s*\? \(v\) => filtri\.minutoConfrontabile\(v\)\s*: parseItalianComparable;/);
    assert.match(ricerca, /const recordDateValue = confrontaData\(recordValore\);\s*const filterDateValue = confrontaData\(valore\);/);
    assert.match(ricerca, /foundInArray = recordValore\.some\(v => confrontaData\(v\) === valoreData\);/);
    //Il riconoscimento dei campi data non cambia (vedi il commento sopra ricercaFiltro).
    assert.match(ricerca, /return normalized === 'data'\s*\|\| normalized === 'date'\s*\|\| normalized === 'datetime'\s*\|\| normalized === 'dataora';/);
    //Il confronto al giorno resta quello di prima.
    assert.match(ricerca, /return Date\.UTC\(year, month - 1, day\);/);
});

/* ---- il criterio ---- */

const addCriterio = sorgenteFiltri.substring(sorgenteFiltri.indexOf("    addCriterio(body, criterio = null, isTracciato = false) {"), sorgenteFiltri.indexOf("    creaPickerTemplateFiltro("));

test("scelta la chiave, ricaricato o incollato un criterio, il campo data sa se ha l'orario", () => {
    assert.match(addCriterio, /showDatePickerForCampo\(criterioCorrente, '', filtri\.campoConOrario\(campoAssociato\)\);/);
    assert.match(addCriterio, /showDatePickerForCampo\(criterioHtml\.closest\('\.criterio'\), criterio\.valore, filtri\.campoConOrario\(campoAssociato\)\);/);
    assert.match(addCriterio, /showDatePickerForCampo\(criterioHtml, criterioHtml\.find\('\.filtro-valore-hidden'\)\.val\(\), filtri\.campoConOrario\(campoFinale\)\);/);
});

test("il campo data si rifa' quando la chiave passa fra data e data con orario", () => {
    assert.match(addCriterio, /if \(dateContainer\.length && \(dateContainer\.attr\('data-con-orario'\) === '1'\) !== conOrario\) \{\s*dateContainer\.remove\(\);/);
    assert.match(addCriterio, /if \(conOrario\) \{\s*placeholder\.attr\('con-orario', ''\);\s*\}/);
});

test("il criterio con orario salva 'GG/MM/AAAA OO:MM' e lo ricarica senza far partire la ricerca", () => {
    assert.match(addCriterio, /valoreInput\.val\(conOrario \? pickedDate : toItalianDate\(pickedDate\)\);/);
    assert.match(addCriterio, /nodo\.impostaValore\(safeValue\);/);
});

/* ---- il componente ---- */

const registra = sorgenteMenu.substring(sorgenteMenu.indexOf("    registerDateMenuPicker(rootNode = null) {"));

test("la casella dell'orario c'e' solo con con-orario e parte da 01:00", () => {
    assert.match(registra, /const conOrario = placeholder\.hasAttribute\('con-orario'\);/);
    assert.match(registra, /let ultimoOrarioValido = Menu\.orarioValido\(placeholder\.getAttribute\('orario'\)\) \|\| Menu\.ORARIO_PREDEFINITO;/);
    assert.match(registra, /if \(inputOrario\) \{\s*controls\.appendChild\(inputOrario\);\s*\}/);
});

test("il valore con l'orario e' vuoto finche' non c'e' la data", () => {
    assert.match(registra, /return inputDate\.value \? inputDate\.value \+ ' ' \+ ultimoOrarioValido : '';/);
});

test("un orario non valido torna all'ultimo valido e il change della casella non arriva al criterio", () => {
    assert.match(registra, /if \(orario == null\) \{\s*inputOrario\.value = ultimoOrarioValido;\s*return;\s*\}/);
    assert.match(registra, /inputOrario\.addEventListener\('change', function \(e\) \{\s*e\.stopPropagation\(\);/);
});
