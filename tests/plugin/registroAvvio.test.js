/*
 * TASK-9d0fffc9: il registro dell'avvio del Plugin.
 *
 * Su una postazione il Plugin restava su "Avvio del plugin in corso..." senza lasciare traccia.
 * Ora ogni passo dell'avvio va nel log della giornata in logs, nello stesso formato di
 * messaggioUtente; finche' logs non c'e' resta in memoria e si scrive appena c'e'. Se dopo 30
 * secondi l'avvio non e' concluso si registra dove si e' fermato e, senza logs, le righe vanno in
 * un log apposito nella cartella del documento, con il nome della macchina. Senza documento resta
 * la console.
 *
 * registroAvvio.js non richiede InDesign: si carica davvero e gira su un disco e un orologio finti.
 * Il resto si controlla sul sorgente di indexNew.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const RegistroAvvio = require("../../plugin/registroAvvio.js");

//26 novembre 2026, 9:05:03 ora locale.
const INIZIO = new Date(2026, 10, 26, 9, 5, 3).getTime();

//Un disco finto: i file scritti, per percorso. Le cartelle che non esistono fanno fallire.
function disco(cartelle = []) {
    const d = { file: {}, scritture: [] };
    d.fs = {
        readFileSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(d.file, p)) {
                throw new Error("ENOENT " + p);
            }
            return d.file[p];
        },
        writeFileSync: (p, testo) => {
            const cartella = p.substring(0, p.lastIndexOf("/"));
            if (cartelle.indexOf(cartella) < 0) {
                throw new Error("ENOENT " + cartella);
            }
            d.file[p] = String(testo);
            d.scritture.push(p);
        }
    };
    d.json = (p) => JSON.parse(d.file[p]);
    return d;
}

//Un registro con orologio, cartelle e console finti: si cambiano dal test mentre l'avvio va avanti.
function registro(d, opzioni = {}) {
    const amb = {
        adesso: INIZIO,
        logs: opzioni.logs || "",
        documento: opzioni.documento || "",
        righe: [],
        stato: opzioni.stato || { isOnline: false }
    };
    amb.registro = RegistroAvvio.crea({
        ora: () => amb.adesso,
        fs: d.fs,
        console: { log: (t) => amb.righe.push(t), error: (t) => amb.righe.push(t) },
        macchina: () => "iMac di Grafica",
        cartellaLog: () => amb.logs,
        cartellaDocumento: () => amb.documento,
        stato: () => amb.stato
    });
    return amb;
}

const LOG_DEL_GIORNO = "/doc/logs/Marco_iMac_ab12cd34ef/log_26-11-2026.txt";

/* ---- le righe ---- */

test("ogni passo ha il formato dei messaggi del log, col tempo trascorso dall'inizio", () => {
    const amb = registro(disco());
    amb.adesso += 1234;
    const voce = amb.registro.passo("Controllo connessione: richiesta a www.google.com");

    assert.deepStrictEqual(voce, {
        data: "26/11/2026",
        orario: "09:05:04",
        macchina: "iMac di Grafica",
        stile: "info",
        msg: "Avvio +1234 ms: Controllo connessione: richiesta a www.google.com"
    });
    assert.deepStrictEqual(amb.righe, ["[Avvio] Avvio +1234 ms: Controllo connessione: richiesta a www.google.com"]);
});

test("i dettagli seguono il passo, e lo stile si sceglie", () => {
    const amb = registro(disco());
    const voce = amb.registro.passo("Sessione Istanta: errore", "timeout", "warning");
    assert.strictEqual(voce.msg, "Avvio +0 ms: Sessione Istanta: errore - timeout");
    assert.strictEqual(voce.stile, "warning");
});

test("un errore non gestito si registra col suo stack, solo durante l'avvio", () => {
    const amb = registro(disco());
    const errore = new Error("wrapper is null");
    const voce = amb.registro.errore(errore, "error");
    assert.strictEqual(voce.stile, "error");
    assert.match(voce.msg, /Errore non gestito \(error\): wrapper is null - Error: wrapper is null/);

    amb.registro.concludi("pannello di lavoro");
    assert.strictEqual(amb.registro.errore(new Error("dopo")), null);
});

/* ---- dove si scrive ---- */

test("con logs le righe vanno nel log della giornata, accanto ai messaggi che ci sono gia'", () => {
    const d = disco(["/doc/logs/Marco_iMac_ab12cd34ef"]);
    d.file[LOG_DEL_GIORNO] = JSON.stringify([{ msg: "messaggio di prima" }]);
    const amb = registro(d, { logs: "/doc/logs/Marco_iMac_ab12cd34ef/" });

    amb.registro.passo("Pannello caricato");

    assert.deepStrictEqual(d.json(LOG_DEL_GIORNO).map(v => v.msg), ["messaggio di prima", "Avvio +0 ms: Pannello caricato"]);
});

test("finche' logs non c'e' le righe restano in memoria, poi si scrivono tutte in ordine", () => {
    const d = disco(["/doc/logs/Marco_iMac_ab12cd34ef"]);
    const amb = registro(d);

    amb.registro.passo("Pannello caricato");
    amb.adesso += 10;
    amb.registro.passo("app di InDesign presente");
    assert.deepStrictEqual(d.scritture, []);

    amb.logs = "/doc/logs/Marco_iMac_ab12cd34ef/";
    assert.strictEqual(amb.registro.scarica(), true);
    amb.adesso += 10;
    amb.registro.passo("Documento letto");

    assert.deepStrictEqual(d.json(LOG_DEL_GIORNO).map(v => v.msg),
        ["Avvio +0 ms: Pannello caricato", "Avvio +10 ms: app di InDesign presente", "Avvio +20 ms: Documento letto"]);
});

test("una scrittura che non riesce non perde le righe: si riprova la volta dopo", () => {
    const d = disco([]);
    const amb = registro(d, { logs: "/doc/logs/Marco_iMac_ab12cd34ef/" });
    amb.registro.passo("Pannello caricato");
    assert.strictEqual(amb.registro.scarica(), false);

    d.fs.writeFileSync = (p, testo) => { d.file[p] = String(testo); };
    amb.registro.passo("app di InDesign presente");
    assert.strictEqual(d.json(LOG_DEL_GIORNO).length, 2);
});

/* ---- l'avvio fermo ---- */

test("prima di 30 secondi l'avvio non e' fermo", () => {
    const amb = registro(disco(), { documento: "/doc" });
    amb.registro.passo("Controllo connessione: richiesta a www.google.com");
    amb.adesso += 29999;
    assert.strictEqual(amb.registro.controllaBlocco(), null);
    assert.strictEqual(amb.registro.bloccato, false);
});

test("fermo senza logs: passi e blocco nel log apposito della cartella del documento, una volta sola", () => {
    const d = disco(["/doc"]);
    const amb = registro(d, { documento: "/doc/", stato: { isOnline: false, controlloInCorso: true } });
    amb.registro.passo("Pannello caricato");
    amb.adesso += 5000;
    amb.registro.passo("Controllo connessione: richiesta a www.google.com");
    amb.adesso += 25000;

    const testo = amb.registro.controllaBlocco();

    assert.strictEqual(testo, "Fermo a: Controllo connessione: richiesta a www.google.com da 25 s");
    const apposito = "/doc/logAvvio_iMac-di-Grafica_26-11-2026.txt";
    const voci = d.json(apposito);
    assert.deepStrictEqual(voci.map(v => v.stile), ["info", "info", "error"]);
    assert.strictEqual(voci[2].msg, "Avvio +30000 ms: Avvio non concluso dopo 30 s; ultimo passo: Controllo connessione: " +
        "richiesta a www.google.com (da 25 s) - {\"isOnline\":false,\"controlloInCorso\":true}");

    //Il blocco si registra una volta; il testo per l'operatore continua a contare.
    amb.adesso += 5000;
    assert.strictEqual(amb.registro.controllaBlocco(), "Fermo a: Controllo connessione: richiesta a www.google.com da 30 s");
    assert.strictEqual(d.json(apposito).length, 3);
});

test("fermo con logs: il blocco va nel log della giornata, non nel log apposito", () => {
    const d = disco(["/doc", "/doc/logs/Marco_iMac_ab12cd34ef"]);
    const amb = registro(d, { documento: "/doc", logs: "/doc/logs/Marco_iMac_ab12cd34ef/" });
    amb.registro.passo("Pannello caricato");
    amb.adesso += 31000;
    amb.registro.controllaBlocco();

    assert.strictEqual(d.json(LOG_DEL_GIORNO).length, 2);
    assert.deepStrictEqual(Object.keys(d.file), [LOG_DEL_GIORNO]);
});

test("fermo senza documento: non si scrive niente, ma l'operatore vede dove si e' fermato", () => {
    const d = disco(["/doc"]);
    const amb = registro(d);
    amb.registro.passo("Ciclo degli eventi: primo giro");
    amb.adesso += 40000;

    assert.strictEqual(amb.registro.controllaBlocco(), "Fermo a: Ciclo degli eventi: primo giro da 40 s");
    assert.deepStrictEqual(d.scritture, []);
    assert.ok(amb.righe.some(r => /Avvio non concluso dopo 40 s/.test(r)));
});

test("ad avvio concluso la vigilanza tace, e un passo chiesto apposta si scrive ancora", () => {
    const d = disco(["/doc/logs/Marco_iMac_ab12cd34ef"]);
    const amb = registro(d, { logs: "/doc/logs/Marco_iMac_ab12cd34ef/" });
    amb.registro.concludi("modulo di accesso mostrato");
    amb.registro.concludi("di nuovo");
    amb.adesso += 60000;

    assert.strictEqual(amb.registro.controllaBlocco(), null);
    assert.strictEqual(amb.registro.testoBlocco(), null);
    amb.registro.passo("Evento OFFLINE", "connessione persa", "warning");
    assert.deepStrictEqual(d.json(LOG_DEL_GIORNO).map(v => v.msg),
        ["Avvio +0 ms: Avvio concluso: modulo di accesso mostrato", "Avvio +60000 ms: Evento OFFLINE - connessione persa"]);
});

test("lo stato illeggibile non ferma la registrazione del blocco", () => {
    const amb = registro(disco());
    amb.registro.passo("Pannello caricato");
    const crea = RegistroAvvio.crea({ ora: () => amb.adesso, console: { log() { }, error() { } }, stato: () => { throw new Error("x"); } });
    amb.adesso += 31000;
    crea.passo("inizio");
    assert.ok(crea.controllaBlocco() != null);
});

test("il nome del log apposito porta la macchina ripulita e il giorno", () => {
    assert.strictEqual(RegistroAvvio.nomeLogApposito("iMac di Grafica/2", new Date(2026, 0, 5)), "logAvvio_iMac-di-Grafica-2_5-1-2026.txt");
    assert.strictEqual(RegistroAvvio.nomeLogApposito("", new Date(2026, 0, 5)), "logAvvio_macchina_5-1-2026.txt");
});

/* ---- indexNew.js, sul sorgente ---- */

const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function corpoFunzione(intestazione) {
    const inizio = indice.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return indice.substring(inizio, indice.indexOf("\n}\n", inizio) + 2);
}

test("il registro nasce subito dopo il controllo di app, prima di ogni altro modulo", () => {
    const registro = indice.indexOf("const registroAvvio = RegistroAvvio.crea({");
    const controllo = indice.indexOf("if (!AvvioPannello.controlla({");
    const uxp = indice.indexOf("const uxp = require('uxp');");
    //I20-1045: prima del controllo di app non si carica niente (avvioPannello.test.js).
    assert.ok(controllo > 0 && controllo < registro && registro < uxp);
    assert.match(indice, /window\.addEventListener\("error", function \(evento\) \{\s*registroAvvio\.errore\(/);
    assert.match(indice, /window\.addEventListener\("unhandledrejection", function \(evento\) \{\s*registroAvvio\.errore\(/);
});

test("i passi dell'avvio ci sono tutti, in ordine nel sorgente", () => {
    const passi = ['registroAvvio.passo("Pannello caricato"', 'registroAvvio.passo("app di InDesign presente");',
        'registroAvvio.passo("Configurazione del cliente caricata"', 'registroAvvio.passo("Moduli del Plugin caricati")',
        'registroAvvio.passo("Ciclo degli eventi creato")', 'registroAvvio.passo("Schermata di avvio mostrata")'];
    let ultimo = -1;
    for (const passo of passi) {
        const dove = indice.indexOf(passo);
        assert.ok(dove > ultimo, passo);
        ultimo = dove;
    }
});

test("cambio di stato: offline all'avvio mostra il messaggio, gli altri rami concludono l'avvio", () => {
    const cambio = corpoFunzione("async function cambioDiStatoDelSistema()");
    assert.match(cambio, /registroAvvio\.passo\("Cambio di stato del sistema"/);
    assert.match(cambio, /if \(!registroAvvio\.concluso\)\s*\{\s*showLoading\(MESSAGGIO_AVVIO_SENZA_INTERNET\);/);
    assert.match(cambio, /if \(istantaState == IstantaState\.NotLogged\)\s*\{\s*registroAvvio\.concludi\("modulo di accesso mostrato"\);/);
    assert.match(cambio, /await initDocumentInLavorazione\(\);\s*if \(docInLavorazione==null\)\s*await initLibroInLavorazione\(\);\s*registroAvvio\.concludi\("pannello di lavoro"/);
    assert.match(cambio, /registroAvvio\.concludi\("Istanta non disponibile"/);
    assert.match(indice, /const MESSAGGIO_AVVIO_SENZA_INTERNET = "Nessuna connessione a internet \(www\.google\.com non risponde\)\. Riprovo ogni 10 secondi\.";/);
});

test("le righe rimaste in memoria si scrivono appena le cartelle di sistema sono pronte", () => {
    const prepara = corpoFunzione("async function preparaCartelleDiSistema(base)");
    assert.match(prepara, /SingularPath = cartelle\.SingularPath;\s*\/\/[^\n]*\n\s*registroAvvio\.scarica\(\);/);
});

test("la vigilanza gira ogni 5 secondi finche' l'avvio non e' concluso e scrive sotto il messaggio", () => {
    const vigilanza = indice.substring(indice.indexOf("var vigilanzaAvvio = setInterval("));
    assert.match(vigilanza, /if \(registroAvvio\.concluso\) \{\s*clearInterval\(vigilanzaAvvio\);/);
    assert.match(vigilanza, /var testo = registroAvvio\.controllaBlocco\(\);/);
    assert.match(vigilanza, /\$\("#loadingPanel"\)\.find\("\.loadingSopra"\)\.text\(testo\)\.show\(\);/);
    assert.match(vigilanza, /\}, 5000\);/);
});

test("lo stato per il blocco legge ogni campo da solo", () => {
    const stato = corpoFunzione("function statoDelCicloPerAvvio()");
    for (const campo of ["appPresente", "isOnline", "istanta", "documento", "cartellaLog", "controlloInCorso", "controlloInCorsoDaMs", "occupato"]) {
        assert.match(stato, new RegExp('leggi\\("' + campo + '"'), campo);
    }
    assert.match(stato, /catch \(e\) \{\s*stato\[nome\] = "non leggibile: " \+ e;/);
});

test("i passi dell'avvio, riletti con Leggi log, sono grigi e non rossi", () => {
    const console = corpoFunzione("function writeFileInConsole(logMessage)");
    assert.match(console, /else if \(style == "info"\) \{\s*color = "dimgray";/);
});
