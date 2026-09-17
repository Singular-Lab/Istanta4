/*
 * I20-967: scaricamento e impaginazione automatici al cambio foto.
 *
 * Il modulo sotto test e' plugin/fotoAutoSync.js, scritto senza dipendenze da UXP/InDesign
 * proprio per poter essere verificato qui. Le operazioni concrete sono sostituite da doppi.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
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

/*
 * impaginaConRitentativo: un file appena scaricato puo' non essere ancora visibile a
 * InDesign quando parte il place, e al suo posto finisce il segnaposto.
 */
function impaginazione(esiti) {
    const chiamate = { impagina: 0, attesa: 0 };
    return {
        chiamate,
        deps: {
            impagina: async function () {
                const esito = esiti[Math.min(chiamate.impagina, esiti.length - 1)];
                chiamate.impagina++;
                return esito;
            },
            attendi: async function () {
                chiamate.attesa++;
            }
        }
    };
}

test('impaginazione riuscita al primo colpo: nessuna attesa e nessun secondo tentativo', async () => {
    const op = impaginazione([{ box: 'box', fotoRectangle: 'rect', warning: '' }]);

    const esito = await fotoAutoSync.impaginaConRitentativo(op.deps);

    assert.strictEqual(esito.fotoRectangle, 'rect');
    assert.strictEqual(esito.ritentata, undefined);
    assert.strictEqual(op.chiamate.impagina, 1);
    assert.strictEqual(op.chiamate.attesa, 0);
});

test('se il primo place cade sul segnaposto si attende e si ritenta una volta', async () => {
    const op = impaginazione([
        { box: 'box', fotoRectangle: 'rect', warning: 'Foto non trovata, e\' stata inserita fotoNoFound.png' },
        { box: 'box', fotoRectangle: 'rect', warning: '' }
    ]);

    const esito = await fotoAutoSync.impaginaConRitentativo(op.deps);

    assert.strictEqual(esito.warning, '');
    assert.strictEqual(esito.ritentata, true);
    assert.strictEqual(op.chiamate.impagina, 2);
    assert.strictEqual(op.chiamate.attesa, 1);
});

test('il ritentativo e\' uno solo: se fallisce ancora si restituisce l\'esito con il warning', async () => {
    const op = impaginazione([{ box: 'box', fotoRectangle: 'rect', warning: 'Foto non trovata' }]);

    const esito = await fotoAutoSync.impaginaConRitentativo(op.deps);

    assert.strictEqual(esito.warning, 'Foto non trovata');
    assert.strictEqual(esito.ritentata, true);
    assert.strictEqual(op.chiamate.impagina, 2);
    assert.strictEqual(op.chiamate.attesa, 1);
});

test('la rimozione della foto non viene scambiata per un fallimento', async () => {
    //updateFoto con nomeFoto null rimuove il rectangle e torna senza warning.
    const op = impaginazione([{ box: 'box', fotoRectangle: null, warning: '' }]);

    const esito = await fotoAutoSync.impaginaConRitentativo(op.deps);

    assert.strictEqual(esito.fotoRectangle, null);
    assert.strictEqual(op.chiamate.impagina, 1);
    assert.strictEqual(op.chiamate.attesa, 0);
});
