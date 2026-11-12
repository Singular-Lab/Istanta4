/*
 * Attivare o disattivare una foto extra dalla schermata Foto Extra del Plugin.
 *
 * Il server cercava la foto extra solo per GUID e cambiava la prima riga che trovava: lo stesso logo
 * collegato a piu' articoli ha lo stesso GUID, quindi poteva cambiare quello di un altro articolo, e
 * di un gruppo ne cambiava una referenza sola. Ora il Plugin manda anche il codice gruppo del box, e
 * il server cambia l'extra su tutte le sue referenze e su nessun altro articolo.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

//Come in fotoExtraPiuBox.test.js: schedaRef lo legge al caricamento.
global.Utility = global.Utility || { parseLabel: (label) => (label == null ? "" : String(label).split("$")[0]) };

const schedaRef = require('../../plugin/schedaRef');

function leggi(relativo) {
    return fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', relativo), 'utf8').replace(/\r/g, '');
}

const record = (codice, codiceGruppo, stato) => ({ recordInTracciato: { "Referenza.Codice": codice, "Scatto.CodiceGruppo": codiceGruppo, StatoSelezione: stato } });

test("l'indirizzo porta il codice gruppo del box, letto dalla primaria", () => {
    const records = [record("456", "123,456", 2), record("123", "123,456", 1)];

    assert.strictEqual(schedaRef.indirizzoAttivaFotoExtra("G1", true, records),
        "SyncFoto/attivaDisattivaFotoExtra/G1/true?codice=123%2C456");
});

test("una referenza singola manda il suo codice", () => {
    assert.strictEqual(schedaRef.indirizzoAttivaFotoExtra("G1", false, [record("6119227", "6119227", 1)]),
        "SyncFoto/attivaDisattivaFotoExtra/G1/false?codice=6119227");
});

test("senza una primaria vale il primo record del box", () => {
    assert.strictEqual(schedaRef.indirizzoAttivaFotoExtra("G1", true, [record("789", "789", 0)]),
        "SyncFoto/attivaDisattivaFotoExtra/G1/true?codice=789");
});

test("la scheda di un box e la selezione di piu' box usano lo stesso indirizzo", () => {
    const foto = leggi('reperimentoFoto/schedaFoto.js');
    const piuBox = leggi('reperimentoFoto/fotoExtraPiuBox.js');

    assert.ok(foto.includes('xhr.send(me.indirizzoAttivaFotoExtra(guidId, attiva, me.schedeRefDati), null, "GET");'));
    assert.ok(piuBox.includes('this.indirizzoAttivaFotoExtra(elemento.guidId, attiva, b.records)'));
    assert.ok(!foto.includes('"SyncFoto/attivaDisattivaFotoExtra/" + guidId + "/" + attiva, null'),
        'senza codice il server cambierebbe la prima riga trovata');
});
