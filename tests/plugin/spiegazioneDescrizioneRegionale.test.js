/*
 * I20-1110: la spiegazione del "+" delle descrizioni regionali si legge.
 *
 * Era il title del "+": il Tooltip del Plugin lo disegnava in un riquadro sotto il "+", sopra i
 * campi della descrizione, e in UXP i campi di testo stanno sopra a tutto: lo coprivano e
 * "Crea una descrizione regionale per questa lavorazione" non si leggeva. Ora e' una riga fra le
 * linguette e i campi, accesa al passaggio del mouse sul "+". La X che elimina una variante aveva
 * lo stesso problema: perde il suggerimento, la conferma al clic dice gia' cosa elimina.
 *
 * schedaRef.js richiede InDesign e non si carica sotto Node: si controlla il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");

//La parte delle linguette delle varianti, dalla barra fino all'aggancio nella riga della scheda.
const linguette = scheda.substring(
    scheda.indexOf('var linguette = $(\'<div id="tabVariantiDescrizione"'),
    scheda.indexOf("rowOpzioniRegionaliEArtwork.append($(\"#applicaDescrizioneDaServer\"));"));

const disegnaPiu = linguette.substring(linguette.indexOf("var disegnaPiu = function () {"), linguette.indexOf("linguette.append(piu);"));

test("il piu' e la X delle varianti non hanno piu' un suggerimento che finisce sotto i campi", () => {
    assert.match(linguette, /var piu = \$\('<div class="creaVariante">\+<\/div>'\);/);
    assert.match(linguette, /var crocetta = \$\('<span>&#10005;<\/span>'\);/);
    assert.doesNotMatch(linguette, /title="Crea una descrizione regionale per questa lavorazione"/);
    assert.doesNotMatch(linguette, /title="Elimina questa variante"/);
});

test("la spiegazione e' una riga nascosta, nella pagina e non sovrapposta, fra le linguette e i campi", () => {
    const riga = linguette.match(/var spiegazioneCreaVariante = \$\('(<div class="spiegazioneCreaVariante"[^']*<\/div>)'\);/);
    assert.ok(riga, "manca la riga di spiegazione");
    assert.match(riga[1], /style="display:none; width:100%;/);
    assert.match(riga[1], />Crea una descrizione regionale per questa lavorazione<\/div>$/);
    assert.doesNotMatch(riga[1], /position:\s*(absolute|fixed)/);

    //Subito dopo le linguette, prima dei pulsanti della descrizione e quindi dei campi: il pezzo
    //guardato finisce dove si aggancia "Applica descrizione da server".
    assert.match(linguette, /rowOpzioniRegionaliEArtwork\.append\(linguette\);\s*rowOpzioniRegionaliEArtwork\.append\(spiegazioneCreaVariante\);/);
    assert.ok(scheda.indexOf("rowOpzioniRegionaliEArtwork.append(spiegazioneCreaVariante);")
        < scheda.indexOf("rowOpzioniRegionaliEArtwork.append($(\"#applicaDescrizioneDaServer\"));"));
});

test("il passaggio del mouse sul piu' accende la spiegazione, l'uscita la spegne", () => {
    assert.match(disegnaPiu, /piu\.on\("mouseenter", function \(\) \{\s*spiegazioneCreaVariante\.show\(\);\s*\}\);/);
    assert.match(disegnaPiu, /piu\.on\("mouseleave", function \(\) \{\s*spiegazioneCreaVariante\.hide\(\);\s*\}\);/);
});

test("ridisegnando o togliendo il piu' la spiegazione si spegne, prima di qualunque uscita", () => {
    const inizio = disegnaPiu.indexOf('linguette.find(".creaVariante").remove();');
    const spegne = disegnaPiu.indexOf("spiegazioneCreaVariante.hide();");
    const senzaCreabili = disegnaPiu.indexOf("if (creabili.length === 0) {");
    assert.ok(inizio > 0 && spegne > inizio && spegne < senzaCreabili, "si spegne subito, anche quando non c'e' piu' niente da creare");
});
