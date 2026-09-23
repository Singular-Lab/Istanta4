/*
 * I20-981 (Lotto 4a): i conti della dissolvenza delle righe del report.
 *
 * In UXP opacity si scrive ma non si ridisegna: il tracciato del collaudo lo ha mostrato. Si
 * attenua allora l'alfa dei colori, che UXP ridisegna. Qui si provano i conti, senza DOM.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const dissolvenza = require('../../plugin/dissolvenza.js');

test('i passi vanno da pieno a zero, radi abbastanza per UXP', () => {
    const passi = dissolvenza.numeroDiPassi();
    assert.strictEqual(passi, 10);
    //Passi troppo fitti non lasciano al motore il tempo di ridisegnare.
    assert.ok(dissolvenza.PASSO_MS >= 50, 'il passo deve dare respiro al motore');

    assert.strictEqual(dissolvenza.alfaAlPasso(0, passi), 1);
    assert.strictEqual(dissolvenza.alfaAlPasso(5, passi), 0.5);
    assert.strictEqual(dissolvenza.alfaAlPasso(passi, passi), 0);
    //Oltre l'ultimo passo non si va sotto zero, e senza passi si e' gia' a zero.
    assert.strictEqual(dissolvenza.alfaAlPasso(passi + 3, passi), 0);
    assert.strictEqual(dissolvenza.alfaAlPasso(1, 0), 0);
});

test('i colori del motore si leggono in tutte le forme che puo\' dare', () => {
    assert.deepStrictEqual(dissolvenza.analizzaColore('rgb(17, 17, 17)'), { r: 17, g: 17, b: 17, a: 1 });
    assert.deepStrictEqual(dissolvenza.analizzaColore('rgba(255, 0, 0, 0.5)'), { r: 255, g: 0, b: 0, a: 0.5 });
    assert.deepStrictEqual(dissolvenza.analizzaColore('#d66a00'), { r: 214, g: 106, b: 0, a: 1 });
    assert.deepStrictEqual(dissolvenza.analizzaColore('#FFF'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepStrictEqual(dissolvenza.analizzaColore('#00000080').a.toFixed(2), '0.50');

    //Quello che non e' un colore pieno non si attenua: non c'e' niente da vedere sfumare.
    assert.strictEqual(dissolvenza.analizzaColore('transparent'), null);
    assert.strictEqual(dissolvenza.analizzaColore('rgba(0, 0, 0, 0)'), null);
    assert.strictEqual(dissolvenza.analizzaColore(''), null);
    assert.strictEqual(dissolvenza.analizzaColore(null), null);
    assert.strictEqual(dissolvenza.analizzaColore('inherit'), null);
});

test('l\'alfa si riduce dal livello di partenza, non da uno pieno', () => {
    const pieno = dissolvenza.analizzaColore('rgb(17, 17, 17)');
    assert.strictEqual(dissolvenza.coloreConAlfa(pieno, 0.5), 'rgba(17, 17, 17, 0.500)');
    assert.strictEqual(dissolvenza.coloreConAlfa(pieno, 0), 'rgba(17, 17, 17, 0.000)');

    //Un colore gia' semitrasparente sfuma dal suo livello: a meta' strada e' a un quarto.
    const mezzo = dissolvenza.analizzaColore('rgba(0, 0, 0, 0.5)');
    assert.strictEqual(dissolvenza.coloreConAlfa(mezzo, 0.5), 'rgba(0, 0, 0, 0.250)');

    assert.strictEqual(dissolvenza.coloreConAlfa(null, 0.5), null);
});

test('le immagini si spengono a meta\' strada', () => {
    //Le immagini non hanno un colore da attenuare: restano finche' il resto e' ancora
    //leggibile, poi se ne vanno insieme a lui.
    assert.strictEqual(dissolvenza.immaginiSpente(1), false);
    assert.strictEqual(dissolvenza.immaginiSpente(0.5), false);
    assert.strictEqual(dissolvenza.immaginiSpente(0.4), true);
    assert.strictEqual(dissolvenza.immaginiSpente(0), true);
});
