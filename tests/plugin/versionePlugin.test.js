/*
 * I20-987: il Plugin installato deve essere quello pubblicato per il cliente.
 *
 * Lavorare con una versione diversa da quella del server vuol dire lavorare con regole diverse,
 * e i guai che ne nascono non si vedono subito: si scoprono a impaginato fatto. Qui si prova la
 * regola che decide quando fermare il lavoro, e soprattutto quando non fermarlo.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const VersionePlugin = require("../../plugin/versionePlugin.js");

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, "..", "..", percorso), "utf8");
}

/* ---- il confronto ---- */

test("versioni uguali, si lavora", () => {
    assert.strictEqual(VersionePlugin.confronta("1.6.7", "1.6.7"), VersionePlugin.ESITO.allineata);
    assert.strictEqual(VersionePlugin.siPuoLavorare(VersionePlugin.ESITO.allineata), true);
});

test("versioni diverse, si blocca", () => {
    assert.strictEqual(VersionePlugin.confronta("1.6.6", "1.6.7"), VersionePlugin.ESITO.disallineata);
    assert.strictEqual(VersionePlugin.siPuoLavorare(VersionePlugin.ESITO.disallineata), false);
});

// Vale anche al contrario: avere una versione piu' avanti di quella pubblicata e' un
// disallineamento come un altro, perche' il server parla con quella pubblicata.
test("anche una versione piu' avanti e' un disallineamento", () => {
    assert.strictEqual(VersionePlugin.confronta("1.7.0", "1.6.7"), VersionePlugin.ESITO.disallineata);
});

test("uno spazio di troppo non e' una versione diversa", () => {
    assert.strictEqual(VersionePlugin.confronta(" 1.6.7 ", "1.6.7"), VersionePlugin.ESITO.allineata);
});

/* ---- quando non si sa ---- */

// Il controllo gira a ogni avvio: se bloccasse anche quando il server non risponde, un
// disservizio di rete fermerebbe il lavoro di tutte le agenzie per un guasto che non e' loro.
// Non sapere e sapere che sono diverse sono due cose diverse.
test("se la versione pubblicata non si legge, non si blocca", () => {
    assert.strictEqual(VersionePlugin.confronta("1.6.7", ""), VersionePlugin.ESITO.nonVerificabile);
    assert.strictEqual(VersionePlugin.confronta("1.6.7", null), VersionePlugin.ESITO.nonVerificabile);
    assert.strictEqual(VersionePlugin.confronta("1.6.7", undefined), VersionePlugin.ESITO.nonVerificabile);
    assert.strictEqual(VersionePlugin.siPuoLavorare(VersionePlugin.ESITO.nonVerificabile), true);
});

test("se manca la versione installata, non si blocca lo stesso", () => {
    assert.strictEqual(VersionePlugin.confronta(null, "1.6.7"), VersionePlugin.ESITO.nonVerificabile);
});

/* ---- cosa legge chi impagina ---- */

test("il messaggio dice le due versioni e cosa fare", () => {
    const avviso = VersionePlugin.messaggioDisallineamento("1.6.6", "1.6.7");

    assert.ok(avviso.titolo.length > 0);
    assert.ok(avviso.dettaglio.includes("1.6.6") && avviso.dettaglio.includes("1.6.7"),
        "senza le due versioni non si capisce se aggiornare o se si e' andati avanti troppo");
    assert.ok(avviso.dettaglio.toLowerCase().includes("scarica"), "e si dice cosa fare");
    assert.ok(!avviso.dettaglio.includes("undefined"));
});

/* ---- guardie su dove sta il controllo ---- */

test("il controllo parte a login fatto, non prima", () => {
    const js = sorgente("plugin/indexNew.js");
    const login = js.indexOf("indesignEvents.EVENT_USER_LOGGED");
    const chiamata = js.indexOf("controllaVersionePubblicata();", login);
    const fineHandler = js.indexOf("indesignEvents.addEventListener", login + 10);

    assert.ok(chiamata > login && chiamata < fineHandler,
        "prima del login il server non si sa nemmeno se risponde");
});

test("il blocco mostra davvero il pannello", () => {
    const js = sorgente("plugin/indexNew.js");
    const inizio = js.indexOf("function bloccaPerVersioneDisallineata(");
    const funzione = js.slice(inizio, js.indexOf("function checkForLoghiCore", inizio));

    //Il pannello esiste da prima ma nessuno lo mostrava: impostarne il testo non basta.
    assert.ok(funzione.includes('$("#istantaDownAlert").css("display", "flex")'),
        "senza questa riga il pannello resta invisibile come negli altri casi");
});

test("la versione pubblicata si chiede al server con l'endpoint dedicato", () => {
    const js = sorgente("plugin/indexNew.js");
    const cs = sorgente("Istanta/Controllers/LoginController.cs");

    assert.ok(js.includes('xhr.send("LoginController/getVersionePluginPubblicata"'));
    assert.ok(cs.includes('[Route("LoginController/getVersionePluginPubblicata")]'));
});

// Due letture dello stesso manifest prenderebbero strade diverse alla prima modifica: e' lo
// stesso genere di doppione che aveva fatto perdere il codice della foto in I20-986.
test("la lettura del manifest pubblicato e' una sola", () => {
    const cs = sorgente("Istanta/Controllers/LoginController.cs");

    assert.strictEqual((cs.match(/plugin\/\{k\}\/manifest\.json/g) || []).length, 1);
    assert.strictEqual((cs.match(/manifestPluginPubblicato\(\)/g) || []).length, 3,
        "definita una volta e usata dai due endpoint");
});


/* ---- I20-987: come si vede il blocco ---- */

// Il riquadro aveva larghezza e altezza al cento per cento insieme a un margine, quindi sbordava
// fuori dal pannello, e un riempimento superiore che spingeva il testo in basso: il centramento
// era dichiarato ma non si vedeva.
test('il riquadro di blocco copre il pannello e tiene il testo al centro', () => {
    const html = sorgente('plugin/index.html');
    const inizio = html.indexOf('<div id="istantaDownAlert"');
    const riquadro = html.slice(inizio, html.indexOf('</div>', html.indexOf('<h3', inizio)));

    assert.ok(riquadro.includes('margin: 0'), 'un margine su un elemento al cento per cento lo fa sbordare');
    assert.ok(!riquadro.includes('padding-top: 200px'), 'spingeva il testo in basso invece di centrarlo');
    assert.ok(riquadro.includes('justify-content: center') && riquadro.includes('align-items: center'));
    assert.ok(riquadro.includes('flex-direction: column'), 'titolo e dettaglio stanno uno sotto l\'altro');
    assert.ok(riquadro.includes('top: 0') && riquadro.includes('left: 0'),
        'senza un punto di partenza il riquadro non copre quello che deve coprire');
});
