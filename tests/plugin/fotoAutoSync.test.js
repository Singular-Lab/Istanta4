/*
 * I20-967: scaricamento e impaginazione automatici al cambio foto.
 *
 * Il modulo sotto test e' plugin/fotoAutoSync.js, scritto senza dipendenze da UXP/InDesign
 * proprio per poter essere verificato qui. Le operazioni concrete sono sostituite da doppi.
 *
 * Esecuzione: node --test tests/plugin
 */

const test = require('node:test');
const assert = require('node:assert');

const fotoAutoSync = require('../../plugin/fotoAutoSync');

function operazioni({ presenze = [], info = null, erroreInfo = null, erroreDownload = null } = {}) {
    const chiamate = { fotoPresente: [], infoFoto: [], scarica: [] };
    let indicePresenza = 0;

    return {
        chiamate,
        deps: {
            fotoPresente: async function (nomeFoto) {
                chiamate.fotoPresente.push(nomeFoto);
                const risposta = presenze[indicePresenza];
                if (indicePresenza < presenze.length - 1) {
                    indicePresenza++;
                }
                return risposta === true;
            },
            infoFoto: async function (guidId) {
                chiamate.infoFoto.push(guidId);
                if (erroreInfo != null) {
                    throw new Error(erroreInfo);
                }
                return info;
            },
            scarica: async function (recordFoto) {
                chiamate.scarica.push(recordFoto);
                if (erroreDownload != null) {
                    throw new Error(erroreDownload);
                }
            }
        }
    };
}

test('la foto gia\' nei Links viene impaginata senza scaricare nulla', async () => {
    const op = operazioni({ presenze: [true] });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, true);
    assert.strictEqual(esito.scaricata, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.giaPresente);
    assert.deepStrictEqual(op.chiamate.infoFoto, []);
    assert.deepStrictEqual(op.chiamate.scarica, []);
});

test('la foto assente viene chiesta per guid e scaricata, poi risulta disponibile', async () => {
    const record = { id: 'olimpo-9', fileName: '123456.psd', size: 1024, fileHash: 'abc' };
    const op = operazioni({ presenze: [false, true], info: record });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, true);
    assert.strictEqual(esito.scaricata, true);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.scaricata);
    assert.deepStrictEqual(op.chiamate.infoFoto, ['guid-1']);
    assert.deepStrictEqual(op.chiamate.scarica, [record]);
    //La disponibilita' viene riverificata sul filesystem, non dedotta dal download.
    assert.strictEqual(op.chiamate.fotoPresente.length, 2);
});

test('senza guid non si tenta alcun recupero e si torna al flusso manuale', async () => {
    const op = operazioni({ presenze: [false] });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', '', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.guidMancante);
    assert.deepStrictEqual(op.chiamate.infoFoto, []);
    assert.deepStrictEqual(op.chiamate.scarica, []);
});

test('senza nome foto non si tocca il filesystem', async () => {
    const op = operazioni({ presenze: [true] });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.nomeMancante);
    assert.deepStrictEqual(op.chiamate.fotoPresente, []);
});

test('se il server non risolve la foto non si scarica e non si solleva eccezione', async () => {
    const op = operazioni({ presenze: [false], info: null });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.infoNonRecuperata);
    assert.deepStrictEqual(op.chiamate.scarica, []);
});

test('un errore nella richiesta delle info non propaga verso l\'impaginazione', async () => {
    const op = operazioni({ presenze: [false], erroreInfo: 'rete non disponibile' });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.infoNonRecuperata);
    assert.deepStrictEqual(op.chiamate.scarica, []);
});

test('un download fallito lascia impaginare col comportamento precedente', async () => {
    const record = { id: 'olimpo-9', fileName: '123456.psd', size: 1024, fileHash: 'abc' };
    const op = operazioni({ presenze: [false], info: record, erroreDownload: 'timeout' });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.downloadFallito);
});

test('un download concluso ma senza file in cartella non viene dato per riuscito', async () => {
    const record = { id: 'olimpo-9', fileName: '123456.psd', size: 1024, fileHash: 'abc' };
    const op = operazioni({ presenze: [false, false], info: record });

    const esito = await fotoAutoSync.assicuraFotoNeiLinks('123456.psd', 'guid-1', op.deps);

    assert.strictEqual(esito.presente, false);
    assert.strictEqual(esito.scaricata, false);
    assert.strictEqual(esito.motivo, fotoAutoSync.esiti.fotoAncoraAssente);
});
