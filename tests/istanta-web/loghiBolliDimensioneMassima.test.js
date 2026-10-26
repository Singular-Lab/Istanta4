/*
 * TASK-8d8f5604: limite esplicito di 50 MB per loghi, bolli e sfondi.
 *
 * Oltre circa 28,6 MB il caricamento falliva senza spiegazione: in Release valeva il limite
 * predefinito di Kestrel e la pagina riceveva solo "uknown". Ora la pagina ferma il file oltre i
 * 50 MB appena viene scelto, e se arriva comunque al server la risposta (413 o 200 con esito
 * negativo) porta il codice FILE_TROPPO_GRANDE e un messaggio che Call.doWithUpload passa alla pagina.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LoghiBolli = require('../../Istanta/wwwroot/js/loghibolli.js');
const Call = require('../../Istanta/wwwroot/js/call.js');

const MB = 1024 * 1024;
const LIMITE = 50 * MB;

// Basta nome e peso: validaFile non legge il contenuto, e un File vero da 50 MB e' inutile.
function file(nome, size) {
    return { name: nome, size: size };
}

const loghi = new LoghiBolli();

/* ---- il controllo della pagina ---- */

test('il limite della pagina e\' 50 MB', () => {
    assert.strictEqual(LoghiBolli.DIMENSIONE_MASSIMA_BYTE, LIMITE);
});

test('un file di esattamente 50 MB passa', () => {
    assert.deepStrictEqual(loghi.validaFile(file('limite.psd', LIMITE)), []);
});

test('un file da 40 MB passa', () => {
    assert.deepStrictEqual(loghi.validaFile(file('logo.psd', 40 * MB)), []);
});

test('un byte oltre i 50 MB e\' rifiutato, con nome, peso e limite', () => {
    const errori = loghi.validaFile(file('enorme.psd', LIMITE + 1));

    assert.strictEqual(errori.length, 1);
    assert.match(errori[0], /enorme\.psd/);
    assert.match(errori[0], /50,0 MB/);
    assert.match(errori[0], /limite per loghi e bolli e' 50 MB/);
});

test('il peso si scrive in MB con un decimale e la virgola', () => {
    assert.strictEqual(LoghiBolli.inMegabyte(Math.round(63.2 * MB)), '63,2 MB');
});

test('il file vuoto resta un errore a parte, non di dimensione', () => {
    const errori = loghi.validaFile(file('rotto.png', 0));

    assert.strictEqual(errori.length, 1);
    assert.match(errori[0], /vuoto/);
});

test('nel caricamento multiplo il file troppo grande resta fuori dal riepilogo e si dice perche', () => {
    const scelta = LoghiBolli.righeDaFile([file('bio.png', 2 * MB), file('enorme.psd', 63 * MB)], loghi.validaFile);

    assert.deepStrictEqual(scelta.righe.map(r => r.file.name), ['bio.png']);
    assert.strictEqual(scelta.scartati.length, 1);
    assert.match(scelta.scartati[0], /enorme\.psd/);
});

test('la riga del riepilogo con un file troppo grande non si invia', () => {
    const riga = { chiave: 'r1', file: file('enorme.psd', 63 * MB), sigla: 'BIO', tipo: '3', errori: [] };
    const errori = loghi.erroriRiepilogo([riga], []);

    assert.ok(errori.r1.some(e => /limite per loghi e bolli/.test(e)));
});

// La sostituzione dell'immagine di un logo esistente passa da validaFile appena si sceglie il file.
test('la sostituzione dell\'immagine controlla il file alla scelta', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'js', 'loghibolli.js'), 'utf8');
    const corpo = js.slice(js.indexOf('fileDaSostituireSelezionato(sender) {'), js.indexOf('nuovoFile(sender) {'));

    assert.ok(corpo.includes('this.validaFile(file)'));
    assert.ok(corpo.includes('sender.val("")'));
});

/* ---- la risposta del server arriva alla pagina ---- */

const RIFIUTO_413 = {
    esito: false,
    error: "Il file caricato e' troppo grande (63,2 MB): il limite per loghi e bolli e' 50 MB.",
    codice: 'FILE_TROPPO_GRANDE',
    limiteByte: LIMITE,
};

test('su un 413 con JSON doWithUpload passa esito, messaggio e codice del server', () => {
    const risposta = Call.rispostaDiErroreUpload({ status: 413, responseJSON: RIFIUTO_413 });

    assert.strictEqual(risposta.esito, false);
    assert.strictEqual(risposta.codice, 'FILE_TROPPO_GRANDE');
    assert.strictEqual(risposta.limiteByte, LIMITE);
    assert.strictEqual(risposta.error, RIFIUTO_413.error);
    assert.strictEqual(risposta.info.status, 413);
    assert.strictEqual(LoghiBolli.messaggioRifiuto(risposta), RIFIUTO_413.error);
});

test('senza JSON, o con un JSON senza error, resta "uknown" come prima', () => {
    assert.deepStrictEqual(Call.rispostaDiErroreUpload({ status: 0 }).error, 'uknown');
    assert.deepStrictEqual(Call.rispostaDiErroreUpload({ status: 500, responseText: '<html>' }).error, 'uknown');
    assert.deepStrictEqual(Call.rispostaDiErroreUpload({ status: 500, responseJSON: { error: '' } }).error, 'uknown');
    assert.deepStrictEqual(Call.rispostaDiErroreUpload({ status: 500, responseJSON: ['x'] }).error, 'uknown');
    assert.strictEqual(LoghiBolli.messaggioRifiuto(Call.rispostaDiErroreUpload({ status: 0 })), 'Salvataggio non riuscito.');
});

test('doWithUpload consegna al chiamante il rifiuto del server', () => {
    const vecchioDollaro = global.$;
    const vecchiaRadice = global.getWebAppRootFolder;
    global.getWebAppRootFolder = () => '';
    global.$ = { ajax(opzioni) { opzioni.error({ status: 413, responseJSON: RIFIUTO_413 }); } };

    try {
        let ricevuto = null;
        Call.doWithUpload('LoghiBolli', 'salva', 'POST', {}, null, r => { ricevuto = r; });

        assert.strictEqual(ricevuto.codice, 'FILE_TROPPO_GRANDE');
        assert.strictEqual(ricevuto.error, RIFIUTO_413.error);
    }
    finally {
        global.$ = vecchioDollaro;
        global.getWebAppRootFolder = vecchiaRadice;
    }
});
