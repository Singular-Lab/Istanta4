/*
 * I20-1253: eliminare una foto del prodotto dalla Scheda articolo.
 *
 * Chi caricava una foto sbagliata non poteva tornare indietro. Ora ogni foto non in uso ha Elimina,
 * che chiede sempre conferma e, se la foto e' stata selezionata meno di un mese fa, lo dice con la
 * data. La primaria e le foto in uso non hanno il pulsante (le regole sono in EliminazioneFoto.cs,
 * provate in C#), e il server rifiuta comunque di eliminarle.
 *
 * archivio.js si carica sotto Node; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Archivio = require("../../Istanta/wwwroot/js/archivio.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

function tratto(testo, inizio, fine) {
    const da = testo.indexOf(inizio);
    assert.ok(da >= 0, "manca " + inizio);
    const a = testo.indexOf(fine, da + inizio.length);
    assert.ok(a > da, "manca " + fine + " dopo " + inizio);
    return testo.substring(da, a);
}

/* ---- la conferma ---- */

test("la conferma dice sempre il nome della foto e che non si torna indietro", () => {
    const testo = Archivio.testoConfermaEliminazioneFoto("6934648_sbagliata.jpg", "");

    assert.ok(testo.startsWith("Eliminare la foto 6934648_sbagliata.jpg?"));
    assert.ok(testo.endsWith("L'eliminazione non si puo' annullare."));
    assert.ok(!testo.includes("meno di un mese"));
});

test("una foto selezionata meno di un mese fa lo dice nella conferma, con la data", () => {
    const testo = Archivio.testoConfermaEliminazioneFoto("6934648_1_AD.jpg", "13/11/2026 09:15");

    assert.ok(testo.includes("Attenzione: questa foto e' stata selezionata il 13/11/2026 09:15, meno di un mese fa."));
    assert.ok(testo.startsWith("Eliminare la foto 6934648_1_AD.jpg?"));
});

test("senza data, o con la data vuota, niente avviso", () => {
    assert.ok(!Archivio.testoConfermaEliminazioneFoto("a.jpg", undefined).includes("Attenzione"));
    assert.ok(!Archivio.testoConfermaEliminazioneFoto("a.jpg", null).includes("Attenzione"));
    assert.ok(!Archivio.testoConfermaEliminazioneFoto("a.jpg", "   ").includes("Attenzione"));
});

/* ---- i punti del codice ---- */

test("Elimina chiede conferma, chiama DeleteFoto con il codice e dice il motivo di un rifiuto", () => {
    const archivio = sorgente("Istanta/wwwroot/js/archivio.js");
    const elimina = tratto(archivio, "    EliminaFotoArticolo(button) {", "    static testoConfermaEliminazioneFoto(");

    assert.match(archivio, /pagina\.on\("click", "\[data-azione='eliminaFotoArticolo'\]", function \(\) \{\s*ME\.EliminaFotoArticolo\(\$\(this\)\);/);
    assert.match(elimina, /if \(!confirm\(testo\)\) \{\s*return;\s*\}/);
    //La conferma viene prima della chiamata.
    assert.ok(elimina.indexOf("confirm(testo)") < elimina.indexOf("Call.do("));
    assert.match(elimina, /Call\.do\("SchedaArticolo", "DeleteFoto\/" \+ idFoto, "POST", \{ codice: Archivio\.codiceDellaSezioneFoto\(\) \}/);
    assert.match(elimina, /alert\("Foto non eliminata: "/);
    assert.match(elimina, /ME\.DopoModificaFoto\(\);/);
});

test("nella vista Elimina non c'e' sulla primaria, e sulle altre foto solo se non in uso", () => {
    const vista = sorgente("Istanta/Views/Shared/_GestioneFoto.cshtml");
    const primaria = tratto(vista, "@if (fotoPrimaria != null)", "Altre foto non selezionate");
    const altre = tratto(vista, "@foreach (var foto in altreFotoArticolo)", "</figure>");

    assert.doesNotMatch(primaria, /eliminaFotoArticolo/);
    assert.match(altre, /@if \(!Istanta\.Utility\.EliminazioneFoto\.InUso\(foto, Model\.Foto\)\)/);
    assert.match(altre, /data-azione="eliminaFotoArticolo"\s+data-idfoto="@foto\.Id" data-nome="@foto\.NomeReale"/);
    assert.match(altre, /data-selezionata-il="@\(selezionataDiRecente \? Istanta\.Utility\.DateFoto\.Data\(foto\.DataModifica\) : ""\)"/);
});
