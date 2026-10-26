/*
 * I20-1041: i tracciati di origine di una referenza nel revisore.
 *
 * La funzione sotto esame e' raggruppaOriginiXls in Istanta/wwwroot/js/components.js. Il server
 * manda una origine per ogni area/canale, e la stessa referenza importata da due tracciati che
 * coprono cinque aree ciascuno arriva come dieci origini. Il revisore mostrava "XLS (10)" e dieci
 * righe con due soli nomi di file ripetuti: al cliente interessa da quali file arriva, quindi si
 * raggruppa per file e il numero conta i file.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const { raggruppaOriginiXls } = require('../../Istanta/wwwroot/js/components.js');

const FILE_CN = '01_PROMO_Export per agenzie_26CNNA023_2026-09-30_11.40.45.xlsx';
const FILE_SS = '01_PROMO_Export per agenzie_26SSNA023_2026-09-30_11.38.56.xlsx';

function origine(area, canale, xlsx) {
    return { area: area, canale: canale, xlsx: xlsx };
}

// Il caso dello screenshot della issue.
test('dieci aree/canali su due file danno due gruppi, nell\'ordine di arrivo', () => {
    const origini = [
        origine('TO', 'CN', FILE_CN), origine('SA', 'CN', FILE_CN), origine('EM', 'CN', FILE_CN),
        origine('LI', 'CN', FILE_CN), origine('PI', 'CN', FILE_CN),
        origine('EM', 'SS', FILE_SS), origine('LI', 'SS', FILE_SS), origine('PI', 'SS', FILE_SS),
        origine('SA', 'SS', FILE_SS), origine('TO', 'SS', FILE_SS)
    ];

    assert.deepStrictEqual(raggruppaOriginiXls(origini), [
        { xlsx: FILE_CN, areeCanali: ['TO / CN', 'SA / CN', 'EM / CN', 'LI / CN', 'PI / CN'] },
        { xlsx: FILE_SS, areeCanali: ['EM / SS', 'LI / SS', 'PI / SS', 'SA / SS', 'TO / SS'] }
    ]);
});

test('i file non devono essere consecutivi per finire nello stesso gruppo', () => {
    const gruppi = raggruppaOriginiXls([
        origine('TO', 'CN', FILE_CN), origine('TO', 'SS', FILE_SS), origine('SA', 'CN', FILE_CN)
    ]);

    assert.deepStrictEqual(gruppi.map(g => g.xlsx), [FILE_CN, FILE_SS]);
    assert.deepStrictEqual(gruppi[0].areeCanali, ['TO / CN', 'SA / CN']);
});

// Il revisore, con un gruppo solo, scrive il nome del file invece del bottone.
test('un file solo in piu\' aree e\' un gruppo solo', () => {
    const gruppi = raggruppaOriginiXls([origine('TO', 'CN', FILE_CN), origine('SA', 'CN', FILE_CN)]);

    assert.strictEqual(gruppi.length, 1);
    assert.strictEqual(gruppi[0].xlsx, FILE_CN);
});

test('la stessa area/canale ripetuta nello stesso file si elenca una volta', () => {
    const gruppi = raggruppaOriginiXls([origine('TO', 'CN', FILE_CN), origine('TO', 'CN', FILE_CN)]);

    assert.deepStrictEqual(gruppi[0].areeCanali, ['TO / CN']);
});

test('area o canale vuoti: resta la parte che c\'e\', o niente', () => {
    const gruppi = raggruppaOriginiXls([
        origine('TO', '', FILE_CN), origine('', 'SS', FILE_CN), origine(null, null, FILE_CN)
    ]);

    assert.deepStrictEqual(gruppi[0].areeCanali, ['TO', 'SS']);
});

test('le origini senza nome file stanno insieme, con il nome vuoto', () => {
    const gruppi = raggruppaOriginiXls([
        origine('TO', 'CN', ''), origine('SA', 'CN', null), origine('EM', 'CN', undefined), origine('LI', 'CN', FILE_CN)
    ]);

    assert.deepStrictEqual(gruppi, [
        { xlsx: '', areeCanali: ['TO / CN', 'SA / CN', 'EM / CN'] },
        { xlsx: FILE_CN, areeCanali: ['LI / CN'] }
    ]);
});

test('nessuna origine: nessun gruppo', () => {
    assert.deepStrictEqual(raggruppaOriginiXls([]), []);
    assert.deepStrictEqual(raggruppaOriginiXls(null), []);
    assert.deepStrictEqual(raggruppaOriginiXls(undefined), []);
});
