/*
 * I20-986: i difetti del ricollegamento, quello del box e quello massivo delle foto.
 *
 * Le regole che decidono cosa dire all'operatore e dove mettere una foto nuova stanno in un
 * modulo a parte, che non tocca InDesign e gira sotto il test runner di Node. Quello che invece
 * vive dentro a funzioni enormi si controlla sul sorgente, ma solo per le condizioni che, se
 * cambiassero, farebbero tornare esattamente il difetto corretto.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RicollegaEsiti = require("../../plugin/ricollegaEsiti.js");

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, "..", "..", percorso), "utf8");
}

/* ---- dove mettere una foto che va creata ---- */

// Era il difetto piu' netto: l'elemento veniva letto prima di essere dichiarato, e il ramo senza
// foto esistente, cioe' proprio quello di chi ne sta creando una, sollevava un errore.
test("senza una foto gia' nel box le misure si prendono dal gruppo", () => {
    assert.deepStrictEqual(
        RicollegaEsiti.boundsNuovaFoto(null, [10, 20, 30, 40]), [15, 25, 35, 45]);
});

test("con una foto gia' nel box si parte da quella", () => {
    assert.deepStrictEqual(
        RicollegaEsiti.boundsNuovaFoto([1, 2, 3, 4], [10, 20, 30, 40]), [6, 7, 8, 9]);
});

test("senza misure da nessuna parte non si inventa una posizione", () => {
    assert.strictEqual(RicollegaEsiti.boundsNuovaFoto(null, null), null);
    assert.strictEqual(RicollegaEsiti.boundsNuovaFoto([1, 2], [3]), null);
    assert.strictEqual(RicollegaEsiti.boundsNuovaFoto(null, [1, 2, "x", 4]), null);
});

/* ---- cosa si dice all'operatore ---- */

// Il difetto: il server scriveva l'errore dentro al singolo elemento e chi chiamava guardava solo
// quello generale, quindi un ricollegamento fallito passava per riuscito.
test("l'errore del singolo elemento diventa un messaggio", () => {
    const avviso = RicollegaEsiti.messaggioPerElemento({
        stato: RicollegaEsiti.STATO.autoImpaginato,
        error: "Non trovato in tracciato."
    });

    assert.strictEqual(avviso.tipo, "error");
    assert.ok(avviso.testo.includes("Non trovato in tracciato."));
});

test("un ricollegamento riuscito non dice niente", () => {
    assert.strictEqual(RicollegaEsiti.messaggioPerElemento(
        { stato: RicollegaEsiti.STATO.autoImpaginato, error: "" }), null);
});

test("la referenza gia' impaginata si segnala come avviso", () => {
    const avviso = RicollegaEsiti.messaggioPerElemento({ stato: RicollegaEsiti.STATO.giaImpaginato });

    assert.strictEqual(avviso.tipo, "warning");
    assert.ok(avviso.testo.includes("già impaginata"));
});

// Il cambio di forma lasciava il box non impaginato senza dire niente, ed era indistinguibile da
// un successo: adesso si dice in che forma il codice e' gia' in lavorazione.
test("il cambio di forma si spiega, con i codici", () => {
    const avviso = RicollegaEsiti.messaggioPerElemento({
        stato: RicollegaEsiti.STATO.cambioDiForma,
        codiciPresenti: ["6119227,6119231"],
        codiciNonEsistenti: ["6119999"]
    });

    assert.strictEqual(avviso.tipo, "warning");
    assert.ok(avviso.testo.includes("6119227,6119231"), "si dice dov'e' finito");
    assert.ok(avviso.testo.includes("6119999"), "e cosa invece non c'e'");
    assert.ok(avviso.testo.toLowerCase().includes("non effettuato"), "e che non e' stato ricollegato");
});

test("il cambio di forma si spiega anche senza liste", () => {
    const avviso = RicollegaEsiti.messaggioPerElemento({ stato: RicollegaEsiti.STATO.cambioDiForma });

    assert.ok(avviso.testo.length > 0);
    assert.ok(!avviso.testo.includes("undefined"));
});

test("la referenza inesistente resta un errore", () => {
    assert.strictEqual(
        RicollegaEsiti.messaggioPerElemento({ stato: RicollegaEsiti.STATO.inesistente }).tipo, "error");
    assert.strictEqual(RicollegaEsiti.messaggioPerElemento(null), null);
});

/* ---- i messaggi del ricollegamento foto ---- */

// I messaggi leggevano un campo che negli oggetti mappati non esiste: l'operatore si trovava
// scritto "del codice: undefined", che non gli dice quale foto guardare.
test("il codice della foto si legge dal campo giusto", () => {
    const testo = RicollegaEsiti.messaggioDatoManomesso("6119227", { codiceFoto: "6119231", codice: undefined });

    assert.ok(testo.includes("6119231"));
    assert.ok(!testo.includes("undefined"));
});

test("senza codice si dice che non e' indicato, non undefined", () => {
    const testo = RicollegaEsiti.messaggioDatoManomesso("6119227", { nomeFoto: "scatto.psd" });

    assert.ok(!testo.includes("undefined"));
    assert.ok(testo.includes("non indicato"));
});

test("la secondaria sparita dal tracciato viene detta", () => {
    const testo = RicollegaEsiti.messaggioSecondariaSparita("6119227", { codiceFoto: "6119231" });

    assert.ok(testo.includes("6119231") && testo.includes("6119227"));
});

/* ---- il rapporto di esito ---- */

// I rapporti d'errore si sovrascrivevano fra loro, perche' solo quello riuscito portava l'istante:
// di due tentativi andati male restava solo l'ultimo, cioe' proprio quando il rapporto serve.
test("il nome del rapporto porta sempre l'istante", () => {
    const primo = RicollegaEsiti.nomeFileEsito("volantino.indd", new Date("2026-09-23T10:00:00Z"));
    const secondo = RicollegaEsiti.nomeFileEsito("volantino.indd", new Date("2026-09-23T10:05:00Z"));

    assert.notStrictEqual(primo, secondo, "due tentativi non devono sovrascriversi");
    assert.ok(primo.startsWith("EsitoRicollegamentoFoto_volantino_"));
    assert.ok(primo.endsWith(".json"));
    assert.ok(!primo.includes(":"), "i due punti non si possono usare nei nomi di file");
});

/* ---- guardie sui punti che non si possono estrarre ---- */

test("l'elemento da creare si legge prima di usarlo", () => {
    const js = sorgente("plugin/indexNew.js");
    const dichiarazione = js.indexOf("let item = elementiDaCreare[i];");
    const uso = js.indexOf("RicollegaEsiti.boundsNuovaFoto(", dichiarazione - 2000);

    assert.ok(dichiarazione > 0, "la dichiarazione c'e'");
    assert.ok(dichiarazione < uso, "e viene prima dell'uso, altrimenti torna l'errore di partenza");
});

test("il rapporto e' visibile anche a chi gestisce gli errori", () => {
    const js = sorgente("plugin/indexNew.js");
    const inizio = js.indexOf("async function ricollegaFotoMassivo");
    const funzione = js.slice(inizio, js.indexOf("function clickOnSleepAwake", inizio));

    const dichiarazione = funzione.indexOf("let fileEsito = {");
    const primoTry = funzione.indexOf("try{");

    assert.ok(dichiarazione > 0 && primoTry > 0);
    assert.ok(dichiarazione < primoTry,
        "dichiarato dentro al try, il blocco degli errori falliva a sua volta e la rotella restava accesa");
});

test("il box fuori pagina ha un messaggio suo", () => {
    const js = sorgente("plugin/schedaRef.js");
    const inizio = js.indexOf("async ricollegaBoxImpaginato(");
    //La funzione chiama gestisciRichiestaClonazione prima che sia definita: il confine e' la
    //definizione, riconoscibile dal rientro, non la prima occorrenza del nome.
    const funzione = js.slice(inizio, js.indexOf("\n    gestisciRichiestaClonazione(", inizio));

    assert.ok(funzione.includes("Code SRF-18"), "si dice cosa e' successo e cosa fare");
    assert.ok(!funzione.includes("box.parentPage.name"),
        "chiedere il nome della pagina senza guardare se c'e' faceva fallire tutto con l'errore generico");
});

test("l'esito di ogni elemento arriva all'operatore", () => {
    const js = sorgente("plugin/schedaRef.js");

    assert.ok(js.includes("RicollegaEsiti.messaggioPerElemento(allElementGruppo[iEsito])"),
        "si guardano tutti gli elementi, non solo il primo");
});

/* ---- guardie sul server ---- */

test("la pagina forzata viene salvata", () => {
    const cs = sorgente("Istanta/Controllers/MenaboController.cs");
    const inizio = cs.indexOf("public async Task<IActionResult> ricollegaBox(");
    const azione = cs.slice(inizio, cs.indexOf("public class InddObjImpostazionePrimarieSecondarieRequest", inizio));

    assert.ok(azione.includes("plr.Pagina = request.elementoDaRicollegare.pag;"));
    assert.ok(azione.includes("SaveChangesAsync()"),
        "senza salvataggio la pagina cambiava solo in memoria e la risposta la dava per fatta");
});

test("la lavorazione si controlla prima di leggerla", () => {
    const cs = sorgente("Istanta/Controllers/MenaboController.cs");
    const inizio = cs.indexOf("public async Task<IActionResult> ricollegaBox(");
    const azione = cs.slice(inizio, inizio + 4000);

    const controllo = azione.indexOf("if (pl == null)");
    const lettura = azione.indexOf("pl.Meta!");

    assert.ok(controllo > 0 && lettura > 0);
    assert.ok(controllo < lettura, "letta prima del controllo, la lavorazione inesistente dava un errore di riferimento nullo");
    assert.ok(azione.includes("promo_inesistente"), "anche la promo puo' mancare e piu' avanti se ne legge l'identificativo");
});

test("all'operatore arriva il motivo, non lo stack trace", () => {
    const cs = sorgente("Istanta/Controllers/MenaboController.cs");
    const inizio = cs.indexOf("public async Task<IActionResult> ricollegaBox(");
    const azione = cs.slice(inizio, cs.indexOf("public class InddObjImpostazionePrimarieSecondarieRequest", inizio));

    assert.ok(azione.includes("result.error = ex.Message;"));
    assert.ok(!azione.includes("result.error = ex.ToString();"));
    assert.ok(azione.includes("_logger?.LogError(ex"), "il dettaglio non si perde, va nel registro");
});
