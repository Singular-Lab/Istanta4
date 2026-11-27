/*
 * I20-1279: la finestra "Scaricamento pacchetto foto" del Plugin ha la casella "Sovrascrivi foto
 * gia' presenti", non spuntata ogni volta che si apre.
 * - Non spuntata, come sempre: le foto identiche gia' in Links (stesso md5) non si riscaricano, quelle
 *   con lo stesso nome e contenuto diverso si riscrivono, quelle che mancano si scaricano.
 * - Spuntata: "Avvia sync completo" riscarica e riscrive in Links tutte le foto del pacchetto gia'
 *   presenti, anche identiche.
 * Vale solo per le foto in Links del sync completo: non per foto extra, loghi e bolli nella cartella
 * Loghi, non per "Avvia sync loghi", non per il pacchetto scaricato dall'impaginazione massiva.
 *
 * scaricamento.js si carica sotto Node con InDesign e uxp finti, come in scaricamentoErroriOlimpo;
 * il resto (index.html, reperimentoFoto.js) si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

global.uxp = { storage: { localFileSystem: {}, formats: { binary: "binary" } } };

function caricaScaricamento() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return { core: {} };
        }
        return originale.apply(this, arguments);
    };
    try {
        return require("../../plugin/reperimentoFoto/scaricamento.js");
    }
    finally {
        Module._load = originale;
    }
}

const scaricamentoFoto = caricaScaricamento();

const VECCHIO = [0x38, 0x42, 0x50, 0x53, 1, 1, 1, 1, 1, 1];
const NUOVO = [0x38, 0x42, 0x50, 0x53, 2, 2, 2, 2, 2, 2];

function buffer(byte) {
    return Uint8Array.from(byte).buffer;
}

function md5(byte) {
    return scaricamentoFoto.md5ArrayBuffer(Uint8Array.from(byte));
}

/// Una cartella Links con i file dati ({ nome: byte }) che si ricorda i file scritti.
function cartellaFinta(presenti) {
    const scritti = {};
    const voce = nome => ({ isFile: true, name: nome, async read() { return buffer(presenti[nome]); } });
    return {
        scritti,
        async getEntry(nome) {
            if (!(nome in presenti)) {
                throw new Error("non c'e'");
            }
            return voce(nome);
        },
        async getEntries() { return Object.keys(presenti).map(voce); },
        async createFile(nome) {
            return { async write(byte) { scritti[nome] = Array.from(byte); } };
        }
    };
}

/// Scarica le foto richieste ({ nome, byte } come le ha l'archivio) nella cartella con i file
/// presenti; restituisce i file scritti e gli indirizzi chiesti a Olimpo.
async function scarica(richieste, presenti, opzioni) {
    const cartella = cartellaFinta(presenti);
    const chiesti = [];
    const perId = {};
    richieste.forEach((r, i) => { perId["id" + i] = r.byte; });
    const prima = { fetch: global.fetch, messaggioUtente: global.messaggioUtente, abortedSyncFoto: global.abortedSyncFoto, olimpoIp: global.olimpoIp, log: console.log, err: console.error };
    global.olimpoIp = "http://olimpo.prova/olimpo/foto/";
    global.fetch = async url => {
        chiesti.push(url);
        const id = new URL(url).searchParams.get("id");
        return { status: 200, async arrayBuffer() { return buffer(perId[id]); } };
    };
    global.messaggioUtente = () => {};
    global.abortedSyncFoto = [];
    console.log = () => {};
    console.error = () => {};
    try {
        const lista = richieste.map((r, i) => ({ id: "id" + i, fileName: r.nome, size: r.byte.length, fileHash: md5(r.byte) }));
        if (opzioni === undefined) {
            await scaricamentoFoto.downloadImages(lista, null, cartella, 1);
        }
        else {
            await scaricamentoFoto.downloadImages(lista, null, cartella, 1, opzioni);
        }
    }
    finally {
        global.fetch = prima.fetch;
        global.messaggioUtente = prima.messaggioUtente;
        global.abortedSyncFoto = prima.abortedSyncFoto;
        global.olimpoIp = prima.olimpoIp;
        console.log = prima.log;
        console.error = prima.err;
    }
    return { scritti: cartella.scritti, chiesti };
}

/* ---- la regola ---- */

test("si sovrascrive solo con sovrascriviPresenti a true", () => {
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti({ sovrascriviPresenti: true }), true);
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti({ sovrascriviPresenti: false }), false);
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti({ sovrascriviPresenti: "true" }), false);
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti({}), false);
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti(null), false);
    assert.strictEqual(scaricamentoFoto.sovrascriviPresenti(undefined), false);
});

/* ---- lo scaricamento ---- */

test("senza la casella una foto identica gia' presente non si riscarica", async () => {
    for (const opzioni of [undefined, {}, { sovrascriviPresenti: false }]) {
        const { scritti, chiesti } = await scarica([{ nome: "6771109_1_AD.psd", byte: VECCHIO }], { "6771109_1_AD.psd": VECCHIO }, opzioni);
        assert.deepStrictEqual(scritti, {}, JSON.stringify(opzioni));
        assert.deepStrictEqual(chiesti, [], JSON.stringify(opzioni));
    }
});

test("senza la casella una foto con lo stesso nome e contenuto diverso si riscrive", async () => {
    const { scritti } = await scarica([{ nome: "6771109_1_AD.psd", byte: NUOVO }], { "6771109_1_AD.psd": VECCHIO }, { sovrascriviPresenti: false });
    assert.deepStrictEqual(scritti["6771109_1_AD.psd"], NUOVO);
});

test("con la casella anche la foto identica gia' presente si riscarica e si riscrive", async () => {
    const { scritti, chiesti } = await scarica([{ nome: "6771109_1_AD.psd", byte: VECCHIO }], { "6771109_1_AD.psd": VECCHIO }, { sovrascriviPresenti: true });
    assert.strictEqual(chiesti.length, 1);
    assert.deepStrictEqual(scritti["6771109_1_AD.psd"], VECCHIO);
});

test("con la casella si riscrivono tutte le presenti, identiche o no, e si scaricano le mancanti", async () => {
    const richieste = [
        { nome: "identica.psd", byte: VECCHIO },
        { nome: "cambiata.psd", byte: NUOVO },
        { nome: "mancante.psd", byte: NUOVO }
    ];
    const { scritti } = await scarica(richieste, { "identica.psd": VECCHIO, "cambiata.psd": VECCHIO }, { sovrascriviPresenti: true });
    assert.deepStrictEqual(Object.keys(scritti).sort(), ["cambiata.psd", "identica.psd", "mancante.psd"]);
    assert.deepStrictEqual(scritti["cambiata.psd"], NUOVO);
});

test("una foto che manca si scarica, con o senza la casella", async () => {
    for (const opzioni of [{ sovrascriviPresenti: false }, { sovrascriviPresenti: true }]) {
        const { scritti } = await scarica([{ nome: "2699490.png", byte: NUOVO }], {}, opzioni);
        assert.deepStrictEqual(scritti["2699490.png"], NUOVO, JSON.stringify(opzioni));
    }
});

/* ---- la finestra ---- */

//Il modello della finestra in index.html: da <div id="dialogSyncPacchettoFoto" fino al div
//successivo di primo livello (come in fineScaricamentoFoto.test.js).
function modelloFinestra() {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const inizio = html.indexOf('<div id="dialogSyncPacchettoFoto"');
    assert.ok(inizio >= 0, "manca il modello dialogSyncPacchettoFoto");
    return html.substring(inizio, html.indexOf("\n</div>", inizio));
}

test("la casella sta sotto Avvia sync completo, prima di Avvia sync loghi, e nel modello non e' spuntata", () => {
    const modello = modelloFinestra();
    const casella = modello.match(/<input type="checkbox" id="sovrascriviFotoPresenti"[^>]*>/);
    assert.ok(casella, "manca la casella sovrascriviFotoPresenti");
    assert.doesNotMatch(casella[0], /checked/);
    assert.match(modello, /<label for="sovrascriviFotoPresenti"[^>]*>Sovrascrivi foto già presenti<\/label>/);

    const completo = modello.indexOf('onclick="ReperimentoFoto.avviaSyncCompletoDallaFinestra()">Avvia sync completo</button>');
    const loghi = modello.indexOf('onclick="ReperimentoFoto.avviaSyncPacchettoFoto(1)">Avvia sync loghi</button>');
    const posizione = modello.indexOf('id="sovrascriviFotoPresenti"');
    assert.ok(completo > 0 && loghi > 0);
    assert.ok(completo < posizione && posizione < loghi);
    //I pulsanti d'avvio vengono prima della parte dello scaricamento.
    assert.ok(loghi < modello.indexOf('id="bodySyncPacchettoFoto"'));
});

test("la casella si legge nella finestra aperta, mai nel modello, e va al modo 0", () => {
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    avviaSyncCompletoDallaFinestra() {");
    assert.ok(inizio >= 0, "manca avviaSyncCompletoDallaFinestra");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
    assert.match(corpo, /\$\("#overlayModalDownloadFoto"\)\.find\("#sovrascriviFotoPresenti"\)\.is\(":checked"\)/);
    assert.match(corpo, /ReperimentoFoto\.avviaSyncPacchettoFoto\(0, null, \[\], \{ sovrascriviPresenti: sovrascrivi \}\)/);
    assert.doesNotMatch(sorgente, /\$\(\s*["']#sovrascriviFotoPresenti/);
});

test("la scelta arriva solo alle foto in Links del sync completo", () => {
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
    const chiamate = sorgente.match(/downloadImages\([^\n]*/g) || [];
    const conOpzione = chiamate.filter(c => c.includes("sovrascriviPresenti"));
    assert.deepStrictEqual(conOpzione, [
        "downloadImages(pacchetto.foto, objProcess, folder, codiceSyncFoto, { sovrascriviPresenti: opzioni != null && opzioni.sovrascriviPresenti === true });"
    ]);
    //Foto extra e loghi nella cartella Loghi si scaricano come sempre.
    assert.ok(chiamate.includes("downloadImages(extra, processoExtra, cartellaLoghi, idOperazione);"));
    assert.ok(chiamate.includes("downloadImages(data, objProcess, folder, codiceSyncFotoMode1);"));
});

test("l'impaginazione massiva scarica il pacchetto senza la scelta della casella", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const avvii = indexNew.match(/ReperimentoFoto\.avviaSyncPacchettoFoto\(0[^\n]*/g) || [];
    assert.deepStrictEqual(avvii, ["ReperimentoFoto.avviaSyncPacchettoFoto(0, function(){"]);
});

/* ---- la scheda Sync Foto ---- */

test("la scheda Sync Foto ha un paragrafo per pulsante, con titolo e descrizione, nell'ordine", () => {
    const html = leggiFileDelPlugin("index.html").replace(/\r/g, "");
    const inizio = html.indexOf('<div id="pulsantiSyncFoto"');
    assert.ok(inizio >= 0, "manca il contenitore dei pulsanti della scheda Sync Foto");
    const scheda = html.substring(inizio, html.indexOf('id="syncRimaste"', inizio));
    const paragrafi = scheda.split('<div class="paragrafoSyncFoto"').slice(1);
    assert.strictEqual(paragrafi.length, 2);

    const attesi = [
        { titolo: "Scarica pacchetto foto", descrizione: /Sovrascrivi foto già presenti/, pulsante: /id="ScaricaPacchettoFoto"[\s\S]*onclick="ReperimentoFoto\.apriSchermataSyncPacchettoFoto\(0\)">Scarica Pacchetto Foto</ },
        { titolo: "Sync massivo foto", descrizione: /ricollega quelle che non corrispondono/, pulsante: /id="SyncFotoMassivo"[\s\S]*onclick="Modali\.apriModalCompatta\('dialogSyncFotoMassivo','Sync massivo foto'\);">Sync massivo foto</ }
    ];
    paragrafi.forEach((paragrafo, i) => {
        const testi = [...paragrafo.matchAll(/<p [^>]*>([^<]*)<\/p>/g)].map(m => m[1]);
        assert.strictEqual(testi[0], attesi[i].titolo);
        assert.match(testi[1], attesi[i].descrizione);
        assert.match(paragrafo, attesi[i].pulsante);
        //Il pulsante viene dopo il titolo e la descrizione.
        assert.ok(paragrafo.indexOf("<sp-action-button") > paragrafo.lastIndexOf("</p>"));
    });
    //Niente piu' righe orizzontali fra i pulsanti.
    assert.doesNotMatch(scheda, /<hr>/);
});
