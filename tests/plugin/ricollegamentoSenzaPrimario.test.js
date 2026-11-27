/*
 * I20-1279: il Sync massivo foto (ricollegaFotoMassivo) e il riquadro dei messaggi.
 * - Il box di un gruppo che nella lista del kit non ha il primario si salta con un errore (IDX-155,
 *   che dice se il gruppo non c'e' piu' o se c'e' senza primario) e il ricollegamento prosegue con
 *   gli altri box. Prima il primo di questi box fermava tutto.
 * - Alla fine un solo messaggio: verde senza errori, rosso con il numero degli errori (IDX-209); con
 *   un errore che interrompe, un solo IDX-162 con il nome del file di esito. Prima "File di esito
 *   creato" usciva dopo l'errore, rosso anche lui, e nel riquadro lo copriva.
 * - Nel riquadro in cima al pannello i messaggi "info" sono grigi, non rossi, e le parole lunghe
 *   (un nome di file) vanno a capo invece di uscire dal riquadro.
 *
 * Le regole stanno in ricollegaEsiti.js e si provano davvero; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");
const RicollegaEsiti = require("../../plugin/ricollegaEsiti.js");

const FILE = "EsitoRicollegamentoFoto_SS_LA_05-11-26_IS2_2026-11-27_09-00-09.json";

/* ---- le regole ---- */

test("il gruppo che non e' piu' nella lista del kit: errore IDX-155 che lo dice, box saltato", () => {
    assert.strictEqual(RicollegaEsiti.messaggioGruppoSenzaPrimario("6512221", 0),
        "Code IDX-155 Il gruppo 6512221 non e' piu' nella lista del kit: il suo box e' stato saltato.");
});

test("il gruppo nella lista senza un record primario: errore IDX-155 che lo dice, box saltato", () => {
    assert.strictEqual(RicollegaEsiti.messaggioGruppoSenzaPrimario("6512221", 3),
        "Code IDX-155 Il gruppo 6512221 non ha un record primario nella lista del kit: il suo box e' stato saltato.");
});

test("senza errori il messaggio finale e' verde e dice il file di esito", () => {
    assert.deepStrictEqual(RicollegaEsiti.messaggioFineRicollegamento(0, FILE),
        { testo: "Ricollegamento foto completato. Esito in: " + FILE, tipo: "success" });
});

test("con errori il messaggio finale e' rosso e dice quanti", () => {
    assert.deepStrictEqual(RicollegaEsiti.messaggioFineRicollegamento(1, FILE),
        { testo: "Code IDX-209 Ricollegamento foto finito con 1 errore (vedi la console). Esito in: " + FILE, tipo: "error" });
    assert.deepStrictEqual(RicollegaEsiti.messaggioFineRicollegamento(3, FILE),
        { testo: "Code IDX-209 Ricollegamento foto finito con 3 errori (vedi la console). Esito in: " + FILE, tipo: "error" });
});

/* ---- dove si applicano ---- */

const reperimento = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
const inizioMassivo = reperimento.indexOf("    async ricollegaFotoMassivo(");
const fineMassivo = reperimento.indexOf("\n    },\n", inizioMassivo);
const massivo = reperimento.substring(inizioMassivo, fineMassivo);

test("il box senza primario si salta con l'errore nel file di esito, senza fermare il ricollegamento", () => {
    assert.ok(inizioMassivo > 0, "manca ricollegaFotoMassivo");
    const ramo = massivo.match(/if \(primario == null\) \{[\s\S]*?\n {28}\}/);
    assert.ok(ramo, "manca il controllo del primario");
    assert.match(ramo[0], /let erroreGruppo = RicollegaEsiti\.messaggioGruppoSenzaPrimario\(item\.codiceGruppo, recs\.length\);/);
    assert.match(ramo[0], /messaggioUtente\(erroreGruppo, "error"\);/);
    assert.match(ramo[0], /fileEsito\.error\.push\(erroreGruppo\);/);
    assert.match(ramo[0], /continue;/);
    assert.doesNotMatch(ramo[0], /throw/);
});

test("alla fine un solo messaggio, dalla regola, con il numero degli errori", () => {
    assert.match(massivo, /let fine = RicollegaEsiti\.messaggioFineRicollegamento\(fileEsito\.error\.length, fileName\);\s*messaggioUtente\(fine\.testo, fine\.tipo\);/);
    //"File di esito creato" non esce piu' da solo, dopo l'errore che copriva.
    assert.doesNotMatch(massivo, /File di esito creato/);
});

test("un errore che interrompe da' un solo IDX-162, con il file di esito", () => {
    const errori = massivo.match(/messaggioUtente\("Code IDX-162[^\n]*/g) || [];
    assert.strictEqual(errori.length, 2, "i due catch del ricollegamento");
    errori.forEach(riga => {
        assert.match(riga, /\+ e \+ "\. " \+ RicollegaEsiti\.testoFileEsito\(fileName\), "error"\);$/);
    });
});

test("IDX-209 e' usato una volta sola nel Plugin", () => {
    const { fileDelPlugin } = require("./fileDelPlugin");
    const occorrenze = fileDelPlugin().reduce((n, f) => n + (leggiFileDelPlugin(f).match(/IDX-209\b/g) || []).length, 0);
    assert.strictEqual(occorrenze, 1);
});

/* ---- il riquadro in cima al pannello ---- */

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
const inizioRiquadro = indexNew.indexOf("async function messaggioUtente(");
const riquadro = indexNew.substring(inizioRiquadro, indexNew.indexOf("\n}\n", inizioRiquadro));

test("nel riquadro un messaggio info e' grigio, come in console", () => {
    assert.match(riquadro, /else if \(style == "info"\) \{\s*color = "dimgray";/);
});

test("nel riquadro le parole lunghe vanno a capo e non escono", () => {
    const h4 = riquadro.match(/<h4 style="([^"]*)"><\/h4>/);
    assert.ok(h4, "manca il testo del riquadro");
    assert.match(h4[1], /overflow-wrap: anywhere;/);
    assert.match(h4[1], /word-break: break-word;/);
    assert.match(h4[1], /min-width: 0;/);
});

/* ---- la finestra del Sync massivo foto ---- */

const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
const modali = leggiFileDelPlugin("modali/modali.js").replace(/\r/g, "");

function membro(sorgente, intestazione) {
    const inizio = sorgente.indexOf(intestazione);
    assert.ok(inizio >= 0, intestazione + " non trovata: il test va aggiornato");
    return sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
}

test("il pulsante della scheda apre la finestra compatta con il titolo Sync massivo foto", () => {
    assert.match(html, /onclick="Modali\.apriModalCompatta\('dialogSyncFotoMassivo','Sync massivo foto'\);">Sync massivo foto<\/sp-action-button>/);
    assert.doesNotMatch(html, /apriModal\('dialogSyncFotoMassivo','Impagina'\)/);
});

test("la finestra compatta e' alta quanto il contenuto; ogni altra apriModal torna alla misura di sempre", () => {
    const apri = membro(modali, "    apriModal(modalId, titolo,");
    assert.match(apri, /this\.misuraFinestraPrincipale\(false\);/);
    //Prima di mettere il contenuto: la finestra parte sempre dalla misura di sempre.
    assert.ok(apri.indexOf("this.misuraFinestraPrincipale(false);") < apri.indexOf('$("#bodyModal").append(dialog);'));

    const compatta = membro(modali, "    apriModalCompatta(modalId, titolo,");
    assert.ok(compatta.indexOf("this.apriModal(") >= 0);
    assert.ok(compatta.indexOf("this.apriModal(") < compatta.indexOf("this.misuraFinestraPrincipale(true);"));

    const misura = membro(modali, "    misuraFinestraPrincipale(compatta){");
    assert.match(misura, /var riquadro = \$\("#overlayModal"\)\.find\("#riquadroModal"\);/);
    assert.match(misura, /riquadro\.css\("height", compatta \? "auto" : "80%"\);/);
    assert.match(misura, /riquadro\.css\("max-height", compatta \? "80%" : "none"\);/);
    assert.match(misura, /riquadro\.find\("#headerModal"\)\.css\("height", compatta \? "auto" : "5%"\);/);
    assert.match(misura, /riquadro\.find\("#bodyModal"\)\.css\("height", compatta \? "auto" : "95%"\);/);

    //La misura di sempre e' quella scritta in index.html.
    assert.match(html, /<div id="riquadroModal"\s+style="background-color: white; width: 80%; height: 80%;/);
});

test("la finestra ha le due caselle con gli id che legge Avvia Sync, senza descrizione e senza spazio vuoto", () => {
    const inizio = html.indexOf('<div id="dialogSyncFotoMassivo"');
    assert.ok(inizio >= 0, "manca dialogSyncFotoMassivo");
    const finestra = html.substring(inizio, html.indexOf("\n</div>", inizio));
    assert.match(finestra, /<input type="checkbox" id="ricollegaFotoPresentiModificate" onclick="toggleAdvancedMode\(this\.checked\)">/);
    assert.match(finestra, />Ricollega anche le foto già presenti che sono cambiate</);
    assert.match(finestra, /<input type="checkbox" id="advancedMode">/);
    assert.match(finestra, />Modalità avanzata: togli le foto rimosse e impagina quelle nuove</);
    assert.match(finestra, /ReperimentoFoto\.ricollegaFotoMassivo\(\$\('#ricollegaFotoPresentiModificate'\)\.is\(':checked'\), \$\('#advancedMode'\)\.is\(':checked'\)\)/);
    assert.doesNotMatch(finestra, /console\.log/);
    assert.doesNotMatch(finestra, /height: 90%/);
    //La descrizione sta nella scheda Sync Foto, non qui.
    assert.doesNotMatch(finestra, /ricollega quelle che non corrispondono/);
});
