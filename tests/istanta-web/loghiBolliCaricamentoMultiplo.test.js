/*
 * I20-1008: caricare piu' loghi e bolli in una volta sola.
 *
 * Dalla pagina Loghi e bolli ora si scelgono piu' file insieme; per ognuno un riepilogo chiede
 * sigla e tipo, e al salvataggio i file partono uno alla volta verso lo stesso LoghiBolli/salva
 * di prima. Qui si verificano le parti che decidono qualcosa: quali file entrano nel riepilogo,
 * quando il riepilogo si puo' inviare, cosa si manda, cosa resta dopo un rifiuto e l'anteprima
 * del psd prima dell'invio.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LoghiBolli = require('../../Istanta/wwwroot/js/loghibolli.js');
const Archivio = require('../../Istanta/wwwroot/js/archivio.js');
const AnteprimaPsd = require('../../Istanta/wwwroot/js/anteprimaPsd.js');

const BOLLINO = '2', LOGO = '3', SFONDO = '5';

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

function file(nome, contenuto) {
    return new File([contenuto === undefined ? 'x' : contenuto], nome);
}

function riga(chiave, sigla, tipo, nome) {
    return { chiave: chiave, file: file(nome || (chiave + '.png')), sigla: sigla, tipo: tipo, errori: [] };
}

const loghi = new LoghiBolli();

/* ---- quali file entrano nel riepilogo ---- */

test('ogni file scelto diventa una riga, con sigla e tipo da scegliere', () => {
    const scelta = LoghiBolli.righeDaFile([file('bio.png'), file('dop.psd'), file('sfondo.jpg')], loghi.validaFile);

    assert.deepStrictEqual(scelta.righe.map(r => r.file.name), ['bio.png', 'dop.psd', 'sfondo.jpg']);
    assert.ok(scelta.righe.every(r => r.sigla === '' && r.tipo === '0'));
    assert.strictEqual(new Set(scelta.righe.map(r => r.chiave)).size, 3);
    assert.deepStrictEqual(scelta.scartati, []);
});

// Il file vuoto e' un caricamento andato storto: non entra, e si dice quale era.
test('il file vuoto resta fuori dal riepilogo e si dice perche', () => {
    const scelta = LoghiBolli.righeDaFile([file('bio.png'), file('rotto.png', '')], loghi.validaFile);

    assert.deepStrictEqual(scelta.righe.map(r => r.file.name), ['bio.png']);
    assert.strictEqual(scelta.scartati.length, 1);
    assert.match(scelta.scartati[0], /rotto\.png/);
});

test('annullare la scelta non produce righe', () => {
    const scelta = LoghiBolli.righeDaFile([], loghi.validaFile);

    assert.deepStrictEqual(scelta.righe, []);
    assert.deepStrictEqual(scelta.scartati, []);
});

/* ---- quando il riepilogo si puo' inviare ---- */

test('un riepilogo compilato non ha errori', () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', 'dop', BOLLINO), riga('c', 'fondo', SFONDO)];

    assert.deepStrictEqual(loghi.erroriRiepilogo(righe, ['igp']), {});
});

test('sigla mancante e tipo non scelto si segnalano sulla loro riga', () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', '   ', LOGO), riga('c', 'dop', '0')];

    const errori = loghi.erroriRiepilogo(righe, []);

    assert.deepStrictEqual(Object.keys(errori).sort(), ['b', 'c']);
    assert.match(errori.b.join(' '), /sigla/i);
    assert.match(errori.c.join(' '), /tipo/i);
});

// Il Plugin prende il primo logo con quella sigla: il secondo non si vedrebbe mai.
test('una sigla gia a sistema non si ricarica', () => {
    const errori = loghi.erroriRiepilogo([riga('a', ' bio ', LOGO)], ['bio', 'dop']);

    assert.match(errori.a.join(' '), /gia' usata/);
});

test('la stessa sigla su due righe del caricamento si segnala su entrambe', () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', 'bio', BOLLINO), riga('c', 'dop', LOGO)];

    const errori = loghi.erroriRiepilogo(righe, []);

    assert.deepStrictEqual(Object.keys(errori).sort(), ['a', 'b']);
    assert.match(errori.a.join(' '), /ripetuta/);
});

// Il Plugin confronta le sigle lettera per lettera (I20-990): per lui sono due loghi diversi.
test('sigle che differiscono per le maiuscole non sono doppioni', () => {
    const righe = [riga('a', 'conad_saporiPQ', LOGO), riga('b', 'conad_saporipq', LOGO)];

    assert.deepStrictEqual(loghi.erroriRiepilogo(righe, []), {});
});

/* ---- cosa si manda ---- */

test('il modulo e quello di un logo nuovo, con la sigla senza spazi ai bordi', () => {
    const r = riga('a', '  bio ', LOGO, 'bio.png');

    const fd = LoghiBolli.formDataNuovo(r);

    assert.strictEqual(fd.get('id'), '');
    assert.strictEqual(fd.get('sigla'), 'bio');
    assert.strictEqual(fd.get('tipo'), LOGO);
    assert.strictEqual(fd.get('file').name, 'bio.png');
});

test('i file partono uno alla volta, nell ordine del riepilogo', async () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', 'dop', BOLLINO), riga('c', 'igp', LOGO)];
    const inviati = [];
    let inVolo = 0, massimo = 0;

    const esiti = await LoghiBolli.inviaInSequenza(righe, async r => {
        inVolo++;
        massimo = Math.max(massimo, inVolo);
        await new Promise(fatto => setTimeout(fatto, 5));
        inviati.push(r.sigla);
        inVolo--;
        return { esito: true };
    });

    assert.deepStrictEqual(inviati, ['bio', 'dop', 'igp']);
    assert.strictEqual(massimo, 1);
    assert.ok(esiti.every(e => e.riuscito));
});

/* ---- cosa resta dopo un rifiuto ---- */

test('un rifiuto a meta non ferma gli altri, e nel riepilogo resta solo quello', async () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', 'dop', BOLLINO), riga('c', 'igp', LOGO)];

    const esiti = await LoghiBolli.inviaInSequenza(righe, async r =>
        r.chiave === 'b'
            ? { esito: false, error: "Caricamento dell'immagine su Olimpo non riuscito: formato" }
            : { esito: true });

    const rimaste = LoghiBolli.righeRimaste(esiti);

    assert.deepStrictEqual(esiti.map(e => e.riuscito), [true, false, true]);
    assert.deepStrictEqual(rimaste.map(r => r.chiave), ['b']);
    assert.deepStrictEqual(rimaste[0].errori, ["Caricamento dell'immagine su Olimpo non riuscito: formato"]);
});

test('una richiesta che non arriva o che solleva un errore conta come rifiuto', async () => {
    const righe = [riga('a', 'bio', LOGO), riga('b', 'dop', LOGO)];

    const esiti = await LoghiBolli.inviaInSequenza(righe, async r => {
        if (r.chiave === 'a')
            return { info: {}, error: 'uknown' };   // quello che passa Call.doWithUpload
        throw new Error('rete');
    });

    assert.deepStrictEqual(esiti.map(e => e.riuscito), [false, false]);
    assert.strictEqual(esiti[0].errore, 'Salvataggio non riuscito.');
    assert.match(esiti[1].errore, /rete/);
});

/* ---- l'anteprima prima dell'invio ---- */

// Un FileReader quanto basta: nel browser c'e', in Node no.
class LettoreFinto {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(b => { this.result = b; this.onload(); }, () => this.onerror());
    }
}

function psdConMiniatura(byteJpeg) {
    const intestazione = Buffer.alloc(26);
    intestazione.write('8BPS', 0, 'ascii');

    const dati = Buffer.concat([Buffer.alloc(28), Buffer.from(byteJpeg)]);
    const testa = Buffer.alloc(12);
    testa.write('8BIM', 0, 'ascii');
    testa.writeUInt16BE(1036, 4);
    testa.writeUInt32BE(dati.length, 8);
    const coda = dati.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
    const corpo = Buffer.concat([testa, dati, coda]);

    const lunghezza = Buffer.alloc(4);
    lunghezza.writeUInt32BE(corpo.length, 0);

    return Buffer.concat([intestazione, Buffer.alloc(4), lunghezza, corpo]);
}

const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9];

test('del psd si mostra la miniatura che ci ha lasciato Photoshop, come indirizzo data', async () => {
    global.Archivio = Archivio;
    global.AnteprimaPsd = AnteprimaPsd;
    global.FileReader = LettoreFinto;
    try {
        const indirizzo = await LoghiBolli.indirizzoAnteprima(file('bollo_bio.psd', psdConMiniatura(JPEG)));

        assert.strictEqual(indirizzo, 'data:image/jpeg;base64,' + Buffer.from(JPEG).toString('base64'));
    }
    finally {
        delete global.Archivio;
        delete global.AnteprimaPsd;
        delete global.FileReader;
    }
});

// Senza anteprima resta l'icona: il caricamento non deve fermarsi per questo.
test('un psd senza miniatura non ha anteprima, e non solleva errori', async () => {
    global.Archivio = Archivio;
    global.AnteprimaPsd = AnteprimaPsd;
    global.FileReader = LettoreFinto;
    try {
        assert.strictEqual(await LoghiBolli.indirizzoAnteprima(file('rotto.psd', 'non sono un psd')), null);
    }
    finally {
        delete global.Archivio;
        delete global.AnteprimaPsd;
        delete global.FileReader;
    }
});

/* ---- la pagina ---- */

test('la pagina sceglie piu file insieme e ha il riepilogo col suo salvataggio', () => {
    const pagina = sorgente('Istanta/Views/SyncFoto/LoghiBolli.cshtml');

    assert.match(pagina, /<input type="file" id="fileNew" multiple/);
    assert.match(pagina, /id="riepilogoLoghiModal"/);
    assert.match(pagina, /id="btnSalvaRiepilogo"/);
    for (const classe of ['anteprimaRiepilogo', 'siglaRiepilogo', 'tipoRiepilogo', 'rimuoviRiepilogo'])
        assert.match(pagina, new RegExp('class="[^"]*' + classe));
    // La vecchia riga a inserimento singolo non c'e' piu': un solo modo di aggiungere.
    assert.doesNotMatch(pagina, /id="siglaNew"/);
});

// La policy della pagina rifiuta i blob: un'anteprima fatta cosi' resterebbe vuota.
test('l anteprima non usa indirizzi blob', () => {
    assert.doesNotMatch(sorgente('Istanta/wwwroot/js/loghibolli.js'), /createObjectURL/);
});
