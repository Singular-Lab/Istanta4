/*
 * TASK-9d0fffc9: il Plugin fermo su "Avvio del plugin in corso..." senza internet.
 *
 * Il ciclo degli eventi parte offline e controlla la connessione chiedendo www.google.com. OFFLINE
 * si emetteva solo passando da online a offline: senza internet fin dall'avvio non arrivava nessun
 * evento, e la schermata di avvio restava per sempre. Inoltre la richiesta a Google non aveva un
 * tempo massimo: se restava appesa, il controllo non ripartiva piu'. Ora il primo esito si comunica
 * sempre, e Google ha TEMPO_MASSIMO_PING_MS per rispondere.
 *
 * events.js si carica sotto Node con indesign e i moduli che richiede vuoti, come in
 * documentoAttivo.test.js; i metodi si provano davvero su un'istanza senza costruttore (che
 * farebbe partire il ciclo). fetch e i timer sono finti.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const MODULI_VUOTI = new Set(["indesign", "./XMLHttpRequestClient", "./utility", "./schedaRef", "./logger", "./versionePrecedente"]);
const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (MODULI_VUOTI.has(richiesta)) {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let InddEvents;
try {
    InddEvents = require("../../plugin/events.js");
}
finally {
    Module._load = caricaOriginale;
}

global.IstantaState = { None: 0, Logged: 1, NotLogged: 2, IstantaDown: 3 };

//Un ciclo degli eventi senza costruttore, con i campi che servono e gli eventi registrati.
function ciclo() {
    const c = Object.create(InddEvents.prototype);
    Object.assign(c, {
        EVENT_ONLINE: "online", EVENT_OFFLINE: "offline", EVENT_USER_LOGGED: "logged",
        EVENT_USER_NOT_LOGGED: "notLogged", EVENT_ISTANTA_DOWN: "istantaDown",
        isOnline: false, istantaState: IstantaState.None, primoStatoEmesso: false,
        checkStatusInProcess: false, inizioControlloStato: null, usciteRegistrate: {},
        TEMPO_MASSIMO_PING_MS: 8000
    });
    c.eventi = [];
    c.fireEvent = (nome) => c.eventi.push(nome);
    c.sessioni = 0;
    c.checkSession = () => { c.sessioni++; };
    return c;
}

//Il registro dell'avvio di indexNew.js, finto: raccoglie i passi.
function conRegistro(concluso = false) {
    const passi = [];
    global.registroAvvio = { concluso, passo: (testo, dettagli, stile) => passi.push({ testo, dettagli, stile }) };
    return passi;
}

//I timer finti: setTimeout registra, scatta() fa partire quelli in attesa.
function timerFinti() {
    const attesi = [];
    const originali = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
    global.setTimeout = (f, ms) => { const t = { f, ms, annullato: false }; attesi.push(t); return t; };
    global.clearTimeout = (t) => { if (t) { t.annullato = true; } };
    return {
        attesi,
        scatta: () => attesi.filter(t => !t.annullato).forEach(t => { t.annullato = true; t.f(); }),
        ripristina: () => Object.assign(global, originali)
    };
}

//Una fetch finta che si risolve a comando.
function fetchFinta() {
    const f = { chiamate: [] };
    global.fetch = (url) => new Promise((risolvi, rifiuta) => f.chiamate.push({ url, risolvi, rifiuta }));
    return f;
}

const attendiPromesse = () => new Promise(r => setImmediate(r));

/* ---- il primo esito ---- */

test("il primo esito offline si comunica: e' quello che toglie l'avvio senza internet", () => {
    const passi = conRegistro();
    const c = ciclo();

    c.checkStatusResonse(false, IstantaState.None, c);

    assert.deepStrictEqual(c.eventi, ["offline"]);
    assert.strictEqual(c.isOnline, false);
    assert.deepStrictEqual(passi.map(p => p.testo), ["Evento OFFLINE"]);
    assert.strictEqual(passi[0].dettagli, "primo esito del controllo");
});

test("offline dopo offline non si ripete", () => {
    conRegistro();
    const c = ciclo();
    c.checkStatusResonse(false, IstantaState.None, c);
    c.checkStatusResonse(false, IstantaState.None, c);
    c.checkStatusResonse(false, IstantaState.None, c);
    assert.deepStrictEqual(c.eventi, ["offline"]);
});

test("quando la connessione torna arriva ONLINE, e poi lo stato della sessione", () => {
    const passi = conRegistro(true);
    const c = ciclo();
    c.checkStatusResonse(false, IstantaState.None, c);
    c.checkStatusResonse(true, IstantaState.NotLogged, c);

    assert.deepStrictEqual(c.eventi, ["offline", "online", "notLogged"]);
    //Anche ad avvio concluso i cambi di connessione e di sessione vanno nel registro: sono rari.
    assert.deepStrictEqual(passi.map(p => p.testo), ["Evento OFFLINE", "Evento ONLINE", "Evento sessione: utente non collegato"]);
    assert.strictEqual(passi[1].dettagli, "connessione tornata");
});

test("online fin dall'inizio: come prima, ONLINE e la sessione", () => {
    conRegistro();
    const c = ciclo();
    c.checkStatusResonse(true, IstantaState.Logged, c, [{ esito: true }]);
    c.checkStatusResonse(true, IstantaState.Logged, c, [{ esito: true }]);
    assert.deepStrictEqual(c.eventi, ["online", "logged"]);
});

test("online e poi offline: OFFLINE una volta, come prima", () => {
    conRegistro();
    const c = ciclo();
    c.checkStatusResonse(true, IstantaState.Logged, c);
    c.checkStatusResonse(false, IstantaState.None, c);
    c.checkStatusResonse(false, IstantaState.None, c);
    assert.deepStrictEqual(c.eventi, ["online", "logged", "offline"]);
});

/* ---- il tempo massimo di Google ---- */

test("Google che non risponde entro il tempo massimo vale offline, e il controllo dopo puo' partire", async () => {
    const passi = conRegistro();
    const timer = timerFinti();
    const rete = fetchFinta();
    try {
        const c = ciclo();
        const esiti = [];
        c.checkStatus((conn, login) => esiti.push([conn, login]));

        assert.strictEqual(rete.chiamate[0].url, "https://www.google.com");
        assert.strictEqual(c.checkStatusInProcess, true);
        assert.strictEqual(timer.attesi[0].ms, 8000);

        timer.scatta();

        assert.deepStrictEqual(esiti, [[false, IstantaState.None]]);
        assert.strictEqual(c.checkStatusInProcess, false);
        assert.ok(passi.some(p => /www\.google\.com non ha risposto entro 8000 ms/.test(p.testo)), passi.map(p => p.testo).join("; "));

        //La risposta che arriva tardi si ignora: niente sessione, niente secondo esito.
        rete.chiamate[0].risolvi({ ok: true, status: 200 });
        await attendiPromesse();
        assert.deepStrictEqual(esiti, [[false, IstantaState.None]]);
        assert.strictEqual(c.sessioni, 0);
        assert.ok(passi.some(p => /arrivata dopo il tempo massimo, ignorata/.test(p.testo)));
    }
    finally {
        timer.ripristina();
    }
});

test("Google che risponde in tempo passa alla sessione e annulla la scadenza", async () => {
    const passi = conRegistro();
    const timer = timerFinti();
    const rete = fetchFinta();
    try {
        const c = ciclo();
        const esiti = [];
        c.checkStatus((conn, login) => esiti.push([conn, login]));
        rete.chiamate[0].risolvi({ ok: true, status: 200 });
        await attendiPromesse();

        assert.strictEqual(c.sessioni, 1);
        assert.strictEqual(timer.attesi[0].annullato, true);
        timer.scatta();
        assert.deepStrictEqual(esiti, []);
        assert.deepStrictEqual(passi.map(p => p.testo), ["Controllo connessione: richiesta a www.google.com",
            "Controllo connessione: www.google.com risponde"]);
    }
    finally {
        timer.ripristina();
    }
});

test("Google irraggiungibile o con un errore HTTP vale offline, con il motivo nel registro", async () => {
    const passi = conRegistro();
    const timer = timerFinti();
    const rete = fetchFinta();
    try {
        const c = ciclo();
        const esiti = [];
        c.checkStatus((conn) => esiti.push(conn));
        rete.chiamate[0].rifiuta(new Error("Network request failed"));
        await attendiPromesse();
        c.checkStatus((conn) => esiti.push(conn));
        rete.chiamate[1].risolvi({ ok: false, status: 503 });
        await attendiPromesse();

        assert.deepStrictEqual(esiti, [false, false]);
        assert.strictEqual(c.checkStatusInProcess, false);
        assert.ok(passi.some(p => p.testo === "Controllo connessione: www.google.com non raggiungibile: Network request failed"));
        assert.ok(passi.some(p => p.testo === "Controllo connessione: www.google.com ha risposto con lo stato 503"));
    }
    finally {
        timer.ripristina();
    }
});

test("ad avvio concluso il controllo ogni 10 secondi non scrive nel registro", async () => {
    const passi = conRegistro(true);
    const timer = timerFinti();
    const rete = fetchFinta();
    try {
        const c = ciclo();
        c.checkStatus(() => { });
        rete.chiamate[0].risolvi({ ok: true, status: 200 });
        await attendiPromesse();
        assert.deepStrictEqual(passi, []);
    }
    finally {
        timer.ripristina();
    }
});

test("senza registro (fuori dal Plugin) il ciclo non si ferma", () => {
    delete global.registroAvvio;
    const c = ciclo();
    c.checkStatusResonse(false, IstantaState.None, c);
    assert.deepStrictEqual(c.eventi, ["offline"]);
});

/* ---- il ciclo, sul sorgente ---- */

const eventi = leggiFileDelPlugin("events.js").replace(/\r/g, "");

test("il ciclo registra il primo giro e ogni uscita anticipata, una volta per motivo", () => {
    assert.match(eventi, /if \(!me\.primoGiroRegistrato\) \{\s*me\.primoGiroRegistrato = true;\s*me\.passoAvvio\("Ciclo degli eventi: primo giro"\);/);
    assert.match(eventi, /if \(me\.asleep\) \{\s*me\.uscitaAvvio\("pannello sospeso \(asleep\)"\);\s*return;/);
    assert.match(eventi, /me\.uscitaAvvio\("app di InDesign assente \(I20-1045\)"\);/);
    assert.match(eventi, /if \(me\.isBusy\)\{\s*\/\/[^\n]*\n\s*me\.uscitaAvvio\("Plugin occupato \(isBusy\)"\);\s*return;/);
    assert.match(eventi, /console\.log\("INTERVAL ERROR " \+ err\);\s*\/\/[^\n]*\n\s*me\.uscitaAvvio\("errore: "/);
});

test("un'uscita anticipata si registra una volta sola", () => {
    const passi = conRegistro();
    const c = ciclo();
    c.uscitaAvvio("Plugin occupato (isBusy)");
    c.uscitaAvvio("Plugin occupato (isBusy)");
    c.uscitaAvvio("errore: x");
    assert.deepStrictEqual(passi.map(p => p.testo), ["Ciclo degli eventi: giro interrotto, Plugin occupato (isBusy)",
        "Ciclo degli eventi: giro interrotto, errore: x"]);
});

test("la sessione di Istanta registra richiesta ed esito", () => {
    const sessione = eventi.substring(eventi.indexOf("    checkSession(callback) {"));
    for (const testo of ["Sessione Istanta: richiesta LoginController/getSession", "Sessione Istanta: utente collegato",
        "Sessione Istanta: utente non collegato", "Sessione Istanta: errore", "Sessione Istanta: nessuna risposta entro 7 s"]) {
        assert.ok(sessione.indexOf('me.passoAvvio("' + testo + '"') >= 0 || sessione.indexOf('this.passoAvvio("' + testo + '"') >= 0, testo);
    }
});
