/*
 * I20-985: l'anteprima dei file che il browser non disegna da solo.
 *
 * Un psd il browser non lo apre, ma Photoshop ci lascia dentro una miniatura in jpeg fra le
 * risorse immagine. Qui si prova la lettura di quella miniatura su psd costruiti a mano, dove
 * si sa esattamente cosa deve uscire, e si controlla che un file malandato non faccia danni:
 * l'anteprima e' un di piu', non deve mai far cadere la pagina.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const AnteprimaPsd = require('../../Istanta/wwwroot/js/anteprimaPsd.js');
const Archivio = require('../../Istanta/wwwroot/js/archivio.js');

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

/* Un psd finto, col minimo che serve: intestazione, blocco colori vuoto e le risorse chieste.
   Ogni risorsa e' 8BIM, identificativo, nome vuoto, dimensione e dati; la miniatura porta 28
   byte di descrizione prima dei byte dell'immagine. */
function psdConRisorse(risorse) {
    const intestazione = Buffer.alloc(26);
    intestazione.write('8BPS', 0, 'ascii');

    const coloreVuoto = Buffer.alloc(4); // lunghezza zero

    const pezzi = risorse.map(r => {
        const testa = Buffer.alloc(12);
        testa.write('8BIM', 0, 'ascii');
        testa.writeUInt16BE(r.id, 4);
        testa.writeUInt8(0, 6);          // nome vuoto
        testa.writeUInt8(0, 7);          // riempimento per arrivare a lunghezza pari
        testa.writeUInt32BE(r.dati.length, 8);

        const coda = r.dati.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
        return Buffer.concat([testa, r.dati, coda]);
    });

    const corpo = Buffer.concat(pezzi);
    const lunghezza = Buffer.alloc(4);
    lunghezza.writeUInt32BE(corpo.length, 0);

    return new Uint8Array(Buffer.concat([intestazione, coloreVuoto, lunghezza, corpo]));
}

function miniatura(byteJpeg) {
    return Buffer.concat([Buffer.alloc(28), Buffer.from(byteJpeg)]);
}

const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9];

/* ---- la miniatura dentro al psd ---- */

test('la miniatura si tira fuori dal psd', () => {
    const psd = psdConRisorse([{ id: 1036, dati: miniatura(JPEG) }]);

    assert.deepStrictEqual(Array.from(AnteprimaPsd.miniaturaJpeg(psd)), JPEG);
});

// La 1033 porta la stessa immagine ma col rosso e il blu scambiati: usarla darebbe un'anteprima
// dai colori sbagliati, che e' peggio che non averla.
test('la risorsa coi colori scambiati non si usa', () => {
    const psd = psdConRisorse([{ id: 1033, dati: miniatura(JPEG) }]);

    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(psd), null);
});

test('la miniatura si trova anche dopo altre risorse', () => {
    const psd = psdConRisorse([
        { id: 1005, dati: Buffer.alloc(16, 7) },
        { id: 1039, dati: Buffer.alloc(9, 3) },   // dimensione dispari: va saltata col riempimento
        { id: 1036, dati: miniatura(JPEG) }
    ]);

    assert.deepStrictEqual(Array.from(AnteprimaPsd.miniaturaJpeg(psd)), JPEG);
});

test('un psd senza miniatura lo dice, non inventa', () => {
    const psd = psdConRisorse([{ id: 1005, dati: Buffer.alloc(16, 7) }]);

    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(psd), null);
});

test('quello che non e\' un psd non si prova nemmeno a leggere', () => {
    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(new Uint8Array([0xFF, 0xD8, 0xFF])), null);
    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(new Uint8Array(0)), null);
});

// Se si legge solo la testa del file la miniatura puo' restare fuori: meglio niente anteprima
// che byte presi a caso e mostrati come immagine.
test('una miniatura tagliata a meta\' non viene mostrata', () => {
    const psd = psdConRisorse([{ id: 1036, dati: miniatura(JPEG) }]);

    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(psd.slice(0, psd.length - 4)), null);
});

test('un file rovinato non fa cadere la pagina', () => {
    const psd = psdConRisorse([{ id: 1036, dati: miniatura(JPEG) }]);
    psd[34] = 0x00; // la firma 8BIM della prima risorsa non e' piu' tale

    assert.strictEqual(AnteprimaPsd.miniaturaJpeg(psd), null);
});

/* ---- come arriva all'immagine ---- */

// La policy della pagina ammette gli indirizzi self, Olimpo e data: un indirizzo blob verrebbe
// rifiutato, ed e' il difetto che aveva reso invisibile l'anteprima.
test('la miniatura diventa un indirizzo che la policy ammette', () => {
    const psd = psdConRisorse([{ id: 1036, dati: miniatura(JPEG) }]);
    const indirizzo = AnteprimaPsd.indirizzoMiniatura(psd);

    assert.ok(indirizzo.startsWith('data:image/jpeg;base64,'));
    assert.deepStrictEqual(
        Array.from(Buffer.from(indirizzo.split(',')[1], 'base64')), JPEG);
});

test('senza miniatura non si costruisce nessun indirizzo', () => {
    assert.strictEqual(AnteprimaPsd.indirizzoMiniatura(psdConRisorse([])), null);
});

/* ---- le regole dell'anteprima nella scheda ---- */

test('il psd e\' l\'unico formato trattato a parte', () => {
    assert.strictEqual(Archivio.eUnPsd('scatto.psd'), true);
    assert.strictEqual(Archivio.eUnPsd('scatto.PSD'), true);
    assert.strictEqual(Archivio.eUnPsd('scatto.psb'), true);
    assert.strictEqual(Archivio.eUnPsd('scatto.jpg'), false);
    assert.strictEqual(Archivio.eUnPsd(null), false);
});

test('l\'anteprima si rimpicciolisce tenendo le proporzioni', () => {
    assert.deepStrictEqual(Archivio.misureRimpicciolite(4000, 3000, 300), { larghezza: 300, altezza: 225 });
    assert.deepStrictEqual(Archivio.misureRimpicciolite(3000, 4000, 300), { larghezza: 225, altezza: 300 });
});

// Ingrandire una foto piccola la sgranerebbe soltanto.
test('una foto piu\' piccola del riquadro resta com\'e\'', () => {
    assert.deepStrictEqual(Archivio.misureRimpicciolite(100, 80, 300), { larghezza: 100, altezza: 80 });
});

test('misure assurde non producono un\'anteprima', () => {
    assert.deepStrictEqual(Archivio.misureRimpicciolite(0, 100, 300), { larghezza: 0, altezza: 0 });
    assert.deepStrictEqual(Archivio.misureRimpicciolite(100, 100, 0), { larghezza: 0, altezza: 0 });
});

// Un tiff da trecento megabyte, letto tutto, diventerebbe quattrocento di testo in memoria.
test('un file enorme non si legge per intero', () => {
    assert.strictEqual(Archivio.siPuoLeggereTutto(5 * 1024 * 1024), true);
    assert.strictEqual(Archivio.siPuoLeggereTutto(300 * 1024 * 1024), false);
    assert.strictEqual(Archivio.siPuoLeggereTutto(0), false);
});

/* ---- guardie sul codice ---- */

test('del psd si legge solo la testa, non tutto il file', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');
    const inizio = js.indexOf('AnteprimaDalPsd(file) {');
    const metodo = js.slice(inizio, js.indexOf('AnteprimaDisegnataDalBrowser(file) {', inizio));

    assert.ok(metodo.includes('file.slice(0, Archivio.TESTA_PSD)'),
        'un psd da centinaia di megabyte non va caricato in memoria per un quadratino');
    assert.ok(!metodo.includes('readAsDataURL'), 'leggerlo tutto sarebbe la cosa che si vuole evitare');
});

// Decidere dall'estensione vuol dire indovinare in anticipo cosa il browser di turno sa aprire:
// il tiff, per esempio, Safari lo disegna. Si prova, e si scrive il messaggio solo se fallisce.
test('e\' il browser a dire se sa disegnare il file', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    assert.ok(js.includes('createImageBitmap(file)'), 'si chiede al browser di decodificarlo');
    assert.ok(js.includes('elemento.onerror = function () {'),
        'se il disegno fallisce lo si scopre dall\'immagine, non dall\'estensione');
    assert.ok(!/URL\.createObjectURL/.test(js),
        'un indirizzo blob la policy della pagina lo rifiuta');
});

test('le foto non selezionate stanno in una tendina chiusa', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    assert.ok(vista.includes('data-bs-target="#altreFotoArticolo"'), 'serve il comando che la apre');
    assert.ok(vista.includes('id="altreFotoArticolo"') && vista.includes('class="collapse mt-2"'),
        'il contenuto nasce chiuso, altrimenti la tendina non serve a niente');
    assert.ok(vista.includes('Altre foto non selezionate (@altreFotoArticolo.Count)'),
        'quante sono si legge senza doverla aprire');
    const inizio = vista.indexOf('id="altreFotoArticolo"');
    const tendina = vista.slice(inizio, vista.indexOf('I20-985: da qui si archivia', inizio));
    assert.ok(!tendina.includes('onclick='),
        'i gestori inline la policy della pagina li blocca: si usano i data attributi');
});
