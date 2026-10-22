/*
 * I20-1125: un errore di Olimpo non diventa un file nella lavorazione.
 *
 * In una lavorazione nuova i 121 loghi scaricati erano tutti la risposta d'errore di Olimpo
 * ({"error":"Error getting path for id ...","status":500}) con il nome del .psd, completata di zeri
 * fino alla misura attesa: InDesign non li impaginava e nessuno lo diceva. downloadImages ora
 * controlla ogni pezzo (stato 200/206 e byte attesi), non scrive il file che non e' arrivato giusto
 * e alla fine avvisa l'operatore.
 *
 * scaricamento.js si carica sotto Node con InDesign e uxp finti; fetch, cartella e messaggioUtente
 * sono finti.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

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

const ERRORE_OLIMPO = '{"error":"Error getting path for id 44ae0f0d-9e20-4678-b0e1-9ab7bda7f16c","timestamp":"2026-10-22T09:35:15.458Z","status":500}';

/// Una cartella vuota che si ricorda i file scritti.
function cartellaFinta() {
    const scritti = {};
    return {
        scritti,
        async getEntry() { throw new Error("non c'e'"); },
        async getEntries() { return []; },
        async createFile(nome) {
            return { async write(byte) { scritti[nome] = Array.from(byte); } };
        }
    };
}

function risposta(stato, testoOByte) {
    const byte = typeof testoOByte === "string" ? new TextEncoder().encode(testoOByte) : Uint8Array.from(testoOByte);
    return { status: stato, async arrayBuffer() { return byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength); } };
}

/// Scarica un file di 10 byte con il fetch dato; restituisce i file scritti e i messaggi.
async function scarica(fetchFinto) {
    const cartella = cartellaFinta();
    const messaggi = [];
    const prima = { fetch: global.fetch, messaggioUtente: global.messaggioUtente, abortedSyncFoto: global.abortedSyncFoto, olimpoIp: global.olimpoIp, log: console.log, err: console.error };
    //Nel Plugin e' una globale di indexNew.js: l'indirizzo dell'Olimpo dell'ipconfig montato.
    global.olimpoIp = "http://olimpo.prova/olimpo/foto/";
    global.fetch = fetchFinto;
    global.messaggioUtente = (testo) => messaggi.push(testo);
    global.abortedSyncFoto = [];
    console.log = () => {};
    console.error = () => {};
    try {
        await scaricamentoFoto.downloadImages(
            [{ id: "44ae0f0d", fileName: "LOGO_bandiera_italiana.psd", size: 10, fileHash: "x" }],
            null, cartella, 1);
    }
    finally {
        global.fetch = prima.fetch;
        global.messaggioUtente = prima.messaggioUtente;
        global.abortedSyncFoto = prima.abortedSyncFoto;
        global.olimpoIp = prima.olimpoIp;
        console.log = prima.log;
        console.error = prima.err;
    }
    return { scritti: cartella.scritti, messaggi };
}

/* ---- le regole ---- */

test("un pezzo va bene solo con 200 o 206 e i byte chiesti", () => {
    assert.strictEqual(scaricamentoFoto.problemaDelPezzo(200, 10, 10), null);
    assert.strictEqual(scaricamentoFoto.problemaDelPezzo(206, 10, 10), null);
    assert.match(scaricamentoFoto.problemaDelPezzo(500, 10, 10), /500/);
    assert.match(scaricamentoFoto.problemaDelPezzo(404, 0, 10), /404/);
    //L'errore di Olimpo puo' arrivare anche con un 200: la misura lo tradisce.
    assert.match(scaricamentoFoto.problemaDelPezzo(200, 129, 1800528), /129 byte invece di 1800528/);
});

test("il testo della risposta si mostra se e' testo, non se e' un pezzo di file", () => {
    assert.strictEqual(scaricamentoFoto.testoDellaRisposta(new TextEncoder().encode(ERRORE_OLIMPO), 400), ERRORE_OLIMPO);
    assert.strictEqual(scaricamentoFoto.testoDellaRisposta(Uint8Array.from([0x38, 0x42, 0x50, 0x53, 0x00, 0x01, 0xff, 0xfe, 0x03])), "");
});

test("l'avviso dice quanti file mancano e il primo motivo; senza mancanze niente avviso", () => {
    assert.strictEqual(scaricamentoFoto.avvisoNonScaricati([]), null);
    const avviso = scaricamentoFoto.avvisoNonScaricati([
        { nome: "LOGO_bandiera_italiana.psd", motivo: "Olimpo ha risposto 500" },
        { nome: "LOGO_filiera.psd", motivo: "Olimpo ha risposto 500" }
    ]);
    assert.match(avviso, /^Code SCF-01 2 file non scaricati/);
    assert.match(avviso, /LOGO_bandiera_italiana\.psd: Olimpo ha risposto 500/);
});

/* ---- lo scaricamento ---- */

test("l'errore di Olimpo non diventa il logo, e l'operatore lo sa", async () => {
    const { scritti, messaggi } = await scarica(async () => risposta(500, ERRORE_OLIMPO));
    assert.deepStrictEqual(scritti, {});
    assert.strictEqual(messaggi.length, 1);
    assert.match(messaggi[0], /Code SCF-01 1 file non scaricati/);
    assert.match(messaggi[0], /Error getting path for id 44ae0f0d/);
});

test("lo stesso errore mandato con un 200 non si scrive lo stesso", async () => {
    const { scritti } = await scarica(async () => risposta(200, '{"error":"x"}'));
    assert.deepStrictEqual(scritti, {});
});

test("un file arrivato intero si scrive com'e', senza avvisi", async () => {
    const byte = [0x38, 0x42, 0x50, 0x53, 1, 2, 3, 4, 5, 6];
    const { scritti, messaggi } = await scarica(async () => risposta(200, byte));
    assert.deepStrictEqual(scritti["LOGO_bandiera_italiana.psd"], byte);
    assert.deepStrictEqual(messaggi, []);
});

test("un pezzo che non arriva lascerebbe un buco di zeri: il file non si scrive", async () => {
    const { scritti, messaggi } = await scarica(async () => { throw new Error("rete giu'"); });
    assert.deepStrictEqual(scritti, {});
    assert.match(messaggi[0], /scaricamento interrotto: rete giu'/);
});
