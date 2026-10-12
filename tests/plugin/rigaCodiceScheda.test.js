/*
 * I20-1087: la riga del codice nella scheda ref, con la X del Report Integrita'.
 *
 * Nella barra #referenza ci sono il segnalino delle differenze, il pulsante copia e il codice
 * gruppo; nella scheda aperta da Trova del report, a destra, anche la X di chiusura. Il codice era
 * tagliato a 45 caratteri fissi e nessun elemento era protetto dal restringimento: con un codice
 * lungo e la X il primo a cedere era il segnalino, che spariva, e con lui il modo di riaprire la
 * finestra delle differenze. Ora segnalino, copia e X non si restringono; si restringe solo il
 * codice, nel suo span, tagliato se non ci sta, con l'intero nel suggerimento e nel copia.
 *
 * La resa vera si vede solo in InDesign: qui si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

function corpo(testo, intestazione, fine) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return testo.substring(inizio, testo.indexOf(fine, inizio + intestazione.length));
}

test("il codice sta in uno span suo, l'unico che si restringe e si taglia", () => {
    const titolo = corpo(sorgente("schedaRef.js"), "    componiTitoloCodice(codice) {", "\n    aggiornaPulsanteSegnalazioni() {");
    assert.match(titolo, /const codiceVisibile = \$\('<span id="testoCodiceTitolo"><\/span>'\)\.text\(testo\.substring\(0, 45\) \+ \(testo\.length > 45 \? "\.\.\." : ""\)\);/);
    assert.match(titolo, /codiceVisibile\.css\(\{ "flex": "1 1 auto", "min-width": "0", "overflow": "hidden", "white-space": "nowrap", "text-overflow": "ellipsis" \}\);/);
    //Il titolo intero si restringe dentro la barra, invece di spingere fuori la X.
    assert.match(titolo, /\$\("#codiceRef"\)\.css\(\{ "display": "flex", "align-items": "center", "flex": "1 1 auto", "min-width": "0", "overflow": "hidden" \}\);/);
    //Il testo non va piu' direttamente nell'h3.
    assert.doesNotMatch(titolo, /\$\("#codiceRef"\)\.append\(testo\.substring/);
});

test("il codice intero resta nel suggerimento e nel copia", () => {
    const titolo = corpo(sorgente("schedaRef.js"), "    componiTitoloCodice(codice) {", "\n    aggiornaPulsanteSegnalazioni() {");
    assert.match(titolo, /if \(testo !== ""\) \{\s*Tooltip\.impostaTooltip\(codiceVisibile\[0\], testo\);\s*\}/);
    assert.match(titolo, /codiceGruppo="' \+ testo \+ '"/);
    assert.match(titolo, /navigator\.clipboard\.writeText\(String\(\$\(this\)\.attr\("codiceGruppo"\) \|\| ""\)\);/);
});

test("il copia e il segnalino non si restringono mai", () => {
    const scheda = sorgente("schedaRef.js");
    const titolo = corpo(scheda, "    componiTitoloCodice(codice) {", "\n    aggiornaPulsanteSegnalazioni() {");
    assert.match(titolo, /id="copiaCodiceTitolo"/);
    assert.match(titolo, /<img src="images\/icon_small_copia\.png" style="[^"]*flex: 0 0 auto;[^"]*" id="copiaCodiceTitolo"/);

    const segnalino = corpo(scheda, "    aggiornaPulsanteSegnalazioni() {", "\n    },\n");
    assert.match(segnalino, /segnalino\.css\(\{[\s\S]*?"flex": "0 0 auto"\s*\}\);/);
    //Resta il primo della riga, prima del copia e del codice.
    assert.match(segnalino, /\$\("#codiceRef"\)\.prepend\(segnalino\);/);
});

test("la X della scheda aperta dal report non si restringe mai", () => {
    const chiusura = corpo(sorgente("reportIntegrita/pannelli.js"), "    _crChiusuraSchedaDalReport() {", "\n    },\n");
    assert.match(chiusura, /bottone\.css\("flex", "0 0 auto"\);/);
    assert.ok(chiusura.indexOf('bottone.css("flex", "0 0 auto");') < chiusura.indexOf("testata.append(bottone);"));
});
