/*
 * I20-1004: XMLHttpRequestClient.abort() deve fermare la richiesta in volo.
 *
 * Il costruttore creava this.xhr, ma send ne creava un altro, locale, ed era quello a partire:
 * abort() fermava un oggetto che non aveva mai inviato niente, e la risposta arrivava comunque.
 * Qui si prova che l'abort raggiunge la richiesta vera, che da quel momento la richiesta tace,
 * e che l'operatore viene avvisato di cosa e' stato annullato e perche'.
 *
 * Il modulo usa XMLHttpRequest, istantaIp, messaggioUtente e noLoginCallback come globali, come
 * fa il resto del Plugin: qui le mette il test. L'XMLHttpRequest finto segue lo standard nel
 * punto che conta: abort() su una richiesta in volo porta subito lo stato a 4, con status 0, e
 * lo annuncia con un cambio di stato prima ancora di tornare.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

class XhrFinto {
    static create = [];

    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.response = null;
        this.responseText = "";
        this.abortita = false;
        this.intestazioni = {};
        XhrFinto.create.push(this);
    }

    open(method, url) {
        this.method = method;
        this.url = url;
        this.readyState = 1;
    }

    setRequestHeader(nome, valore) {
        this.intestazioni[nome] = valore;
    }

    send(corpo) {
        this.corpo = corpo;
        this.inviata = true;
    }

    abort() {
        this.abortita = true;
        if (this.readyState > 0 && this.readyState < 4 && this.inviata) {
            this.readyState = 4;
            this.status = 0;
            this.onreadystatechange && this.onreadystatechange();
        }
        this.readyState = 0;
    }

    //La risposta del server, quando arriva.
    rispondi(status, testo) {
        this.readyState = 4;
        this.status = status;
        this.responseText = testo;
        this.response = testo;
        this.onreadystatechange && this.onreadystatechange();
        this.onload && this.onload();
    }

    cadeLaRete() {
        this.readyState = 4;
        this.status = 0;
        this.onreadystatechange && this.onreadystatechange();
        this.onerror && this.onerror();
    }

    scade() {
        this.readyState = 4;
        this.status = 0;
        this.onreadystatechange && this.onreadystatechange();
        this.ontimeout && this.ontimeout({});
    }
}

let messaggi = [];
let loginScaduti = 0;

global.XMLHttpRequest = XhrFinto;
global.istantaIp = "http://istanta/";
global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
global.noLoginCallback = () => loginScaduti++;

const XMLHttpRequestClient = require("../../plugin/XMLHttpRequestClient.js");

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, "..", "..", percorso), "utf8");
}

//Un client coi gestori che contano quante volte vengono chiamati.
function clientOsservato() {
    const client = new XMLHttpRequestClient();
    const visti = { onload: [], onerror: [], onabort: [], stati: [] };
    client.onload = (risultato, parsed) => visti.onload.push({ risultato, parsed });
    client.onerror = (errore) => visti.onerror.push(errore);
    client.onabort = (motivo) => visti.onabort.push(motivo);
    client.onreadystatechange = () => visti.stati.push({ readyState: client.readyState, status: client.status });
    return { client, visti };
}

function ultimaRichiesta() {
    return XhrFinto.create[XhrFinto.create.length - 1];
}

test.beforeEach(() => {
    XhrFinto.create = [];
    messaggi = [];
    loginScaduti = 0;
});

/* ---- il difetto ---- */

test("abort ferma la richiesta che e' partita davvero", () => {
    const { client } = clientOsservato();
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");

    const partita = ultimaRichiesta();
    assert.strictEqual(partita.inviata, true);

    client.abort("Cambio documento attivo");

    assert.strictEqual(partita.abortita, true);
});

test("la risposta che arriva dopo l'abort non raggiunge nessuno", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");
    const partita = ultimaRichiesta();

    client.abort("Cambio documento attivo");
    partita.rispondi(200, JSON.stringify({ lista: [1, 2, 3] }));

    assert.deepStrictEqual(visti.onload, []);
    assert.deepStrictEqual(visti.onerror, []);
});

//Lo stato 4 con status 0 che l'annullamento produce da se' e' quello che faceva scrivere ai
//gestori "Errore durante la richiesta: 0" (IDX-29, IDX-38): non deve arrivare.
test("il cambio di stato prodotto dall'annullamento non arriva al gestore", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/ImpaginaFromInDesignNew/1/false/0", "a=1", "PUT", "application/x-www-form-urlencoded");

    client.abort("Nuovo conteggio avviato");

    assert.deepStrictEqual(visti.stati, []);
});

test("anche un errore di rete dopo l'abort resta muto", () => {
    const { client, visti } = clientOsservato();
    let senzaRete = 0;
    client.onNoConnection = () => senzaRete++;
    client.send("Menabo/getListaImpaginati/1", null, "GET");
    const partita = ultimaRichiesta();

    client.abort("Nessun documento aperto");
    partita.cadeLaRete();

    assert.deepStrictEqual(visti.onerror, []);
    assert.strictEqual(senzaRete, 0);
});

/* ---- l'avviso all'operatore ---- */

test("l'operatore legge cosa e' stato annullato e perche'", () => {
    const { client } = clientOsservato();
    client.descrizione = "Scaricamento lista";
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");

    client.abort("Cambio documento attivo");

    assert.strictEqual(messaggi.length, 1);
    assert.strictEqual(messaggi[0].testo, "Code HRC-02: Scaricamento lista annullato a causa di: Cambio documento attivo");
    assert.strictEqual(messaggi[0].stile, "warning");
});

test("senza descrizione il messaggio dice almeno quale chiamata", () => {
    const { client } = clientOsservato();
    client.send("Menabo/getListaImpaginati/7", null, "GET");

    client.abort("Nessun documento aperto");

    assert.strictEqual(messaggi[0].testo, "Code HRC-02: Invio al server (Menabo/getListaImpaginati/7) annullato a causa di: Nessun documento aperto");
});

test("senza motivo il messaggio non inventa una causa", () => {
    const { client } = clientOsservato();
    client.descrizione = "Scaricamento lista";
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");

    client.abort();

    assert.strictEqual(messaggi[0].testo, "Code HRC-02: Scaricamento lista annullato");
});

/* ---- onabort: chi aspettava lo viene a sapere ---- */

test("onabort riceve il motivo, una volta sola", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");

    client.abort("Nuovo scaricamento della lista");
    client.abort("Cambio documento attivo");

    assert.deepStrictEqual(visti.onabort, ["Nuovo scaricamento della lista"]);
    assert.strictEqual(messaggi.length, 1);
});

/* ---- quando non c'e' niente da fermare ---- */

test("abort prima di qualsiasi send non fa niente e non avvisa", () => {
    const { client, visti } = clientOsservato();

    client.abort("Cambio documento attivo");

    assert.deepStrictEqual(visti.onabort, []);
    assert.deepStrictEqual(messaggi, []);
});

test("abort su una richiesta gia' conclusa non fa niente e non avvisa", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");
    ultimaRichiesta().rispondi(200, JSON.stringify({ ok: true }));

    client.abort("Nuovo scaricamento della lista");

    assert.strictEqual(visti.onload.length, 1);
    assert.deepStrictEqual(visti.onabort, []);
    assert.deepStrictEqual(messaggi, []);
});

test("abort su una richiesta scaduta non fa niente e non avvisa", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/getListaTracciatoNew2/1/0", null, "GET");
    ultimaRichiesta().scade();

    client.abort("Nuovo scaricamento della lista");

    assert.deepStrictEqual(visti.onerror, ["timeout"]);
    assert.deepStrictEqual(visti.onabort, []);
});

//Una stessa istanza puo' fare piu' send: abort deve fermare l'ultima partita.
test("con piu' send sulla stessa istanza abort ferma l'ultima", () => {
    const { client } = clientOsservato();
    client.send("Menabo/a", null, "GET");
    const prima = ultimaRichiesta();
    prima.rispondi(200, "{}");
    client.send("Menabo/b", null, "GET");
    const seconda = ultimaRichiesta();

    client.abort("Cambio documento attivo");

    assert.strictEqual(seconda.abortita, true);
    assert.strictEqual(prima.abortita, false);
});

/* ---- il percorso normale non cambia ---- */

test("risposta JSON: onload con l'oggetto", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/x", null, "GET");
    ultimaRichiesta().rispondi(200, JSON.stringify({ esito: true }));

    assert.deepStrictEqual(visti.onload, [{ risultato: { esito: true }, parsed: true }]);
});

test("risposta non JSON: onload col testo", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/x", null, "GET");
    ultimaRichiesta().rispondi(200, "ciao");

    assert.deepStrictEqual(visti.onload, [{ risultato: "ciao", parsed: false }]);
});

test("sessione scaduta: noLoginCallback e non onload", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/x", null, "GET");
    ultimaRichiesta().rispondi(200, JSON.stringify({ error: "no_login" }));

    assert.strictEqual(loginScaduti, 1);
    assert.deepStrictEqual(visti.onload, []);
});

test("stato diverso da 200: messaggio HRC-01 e onerror", () => {
    const { client, visti } = clientOsservato();
    client.send("Menabo/x", null, "GET");
    ultimaRichiesta().rispondi(500, JSON.stringify({ error: "guasto" }));

    assert.deepStrictEqual(visti.onerror, ["guasto"]);
    assert.match(messaggi[0].testo, /^Code HRC-01/);
});

test("il timeout arriva a onerror", () => {
    const { client, visti } = clientOsservato();
    client.timeout = 5000;
    client.send("Menabo/x", null, "GET");
    const partita = ultimaRichiesta();

    assert.strictEqual(partita.timeout, 5000);
    partita.scade();

    assert.deepStrictEqual(visti.onerror, ["timeout"]);
});

/* ---- i chiamanti ---- */

//Ognuno dei sei abort dice perche' annulla: e' il motivo che l'operatore legge.
test("ogni abort su xhrInProcess dice il suo motivo", () => {
    for (const file of ["plugin/indexNew.js", "plugin/schedaRef.js"]) {
        const chiamate = sorgente(file).match(/xhrInProcess\.abort\([^)]*\)/g) || [];
        assert.ok(chiamate.length > 0, file);
        for (const chiamata of chiamate) {
            assert.notStrictEqual(chiamata, "xhrInProcess.abort()", file + ": " + chiamata);
        }
    }
});

//Il salvataggio della scheda non deve poter essere annullato da altri: il server salverebbe
//lo stesso e i cambi strutturali non arriverebbero al documento.
test("il salvataggio della scheda ref non passa da xhrInProcess", () => {
    const testo = sorgente("plugin/schedaRef.js");
    const invio = testo.indexOf('.send("Revisore/salvaRefFromIndd"');
    assert.ok(invio > 0);

    const riga = testo.slice(testo.lastIndexOf("\n", invio) + 1, invio);
    assert.match(riga, /xhrSalva$/);
});

test("lo scaricamento della lista avvisa chi lo aspetta quando viene annullato", () => {
    const testo = sorgente("plugin/indexNew.js");
    const inizio = testo.indexOf("function scaricaContenutoKit(");
    const fine = testo.indexOf("function scaricaContenutoKitAsync(");
    const corpo = testo.slice(inizio, fine);

    assert.match(corpo, /xhrInProcess\.onabort = function \(motivo\)/);
    assert.match(corpo, /onErrore\("annullato a causa di: " \+ motivo\)/);
});

//I20-1004, collaudo: col cambio di documento durante lo scaricamento il pannello "Scaricamento
//lista..." restava acceso e bloccava il Plugin. Lo spegneva la risposta, che non arriva piu'.
test("lo scaricamento annullato spegne il suo caricamento, e il nuovo lo accende dopo l'abort", () => {
    const testo = sorgente("plugin/indexNew.js");
    const inizio = testo.indexOf("function scaricaContenutoKit(");
    const fine = testo.indexOf("function scaricaContenutoKitAsync(");
    const corpo = testo.slice(inizio, fine);

    const gestore = corpo.slice(corpo.indexOf("xhrInProcess.onabort = function (motivo)"));
    assert.match(gestore.slice(0, gestore.indexOf("\n    }")), /hideLoading\(\);/);

    const annullo = corpo.indexOf('xhrInProcess.abort("Nuovo scaricamento della lista")');
    const accendo = corpo.indexOf('showLoading("Scaricamento lista...")');
    assert.ok(annullo > 0 && accendo > 0);
    assert.ok(annullo < accendo, "l'abort deve venire prima di showLoading");
});
