/*
 * I20-981: dove finisce il riquadro di un tooltip.
 *
 * Il pannello del plugin e' stretto e spesso alto poco: il rischio vero non e' sbagliare di
 * qualche pixel, e' che il suggerimento esca dal pannello e non si legga.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const tooltip = require('../../plugin/tooltipPosizione');

const finestra = { width: 400, height: 600 };

function elemento(left, top, width, height) {
    return { left, top, width, height, right: left + width, bottom: top + height };
}

test('il testo vuoto non merita un riquadro', () => {
    assert.strictEqual(tooltip.testoTooltip(null), null);
    assert.strictEqual(tooltip.testoTooltip(''), null);
    assert.strictEqual(tooltip.testoTooltip('   '), null);
    assert.strictEqual(tooltip.testoTooltip('  Scarica CSV  '), 'Scarica CSV');
});

test('di norma il riquadro sta sotto l\'elemento, allineato a sinistra', () => {
    const posizione = tooltip.posizioneTooltip(elemento(50, 100, 80, 25), { width: 200, height: 40 }, finestra);

    assert.deepStrictEqual(posizione, { left: 50, top: 100 + 25 + tooltip.DISTANZA });
});

test('se sotto non ci sta, il riquadro va sopra', () => {
    //Elemento in fondo al pannello: sotto restano pochi pixel.
    const posizione = tooltip.posizioneTooltip(elemento(50, 560, 80, 25), { width: 200, height: 40 }, finestra);

    assert.strictEqual(posizione.top, 560 - tooltip.DISTANZA - 40);
});

test('se non ci sta ne\' sotto ne\' sopra resta dentro il pannello', () => {
    //Riquadro piu' alto del pannello: si attacca al bordo alto invece di sparire.
    const posizione = tooltip.posizioneTooltip(elemento(50, 500, 80, 25), { width: 200, height: 590 }, finestra);

    assert.strictEqual(posizione.top, tooltip.BORDO);
});

test('il riquadro non sborda a destra', () => {
    const posizione = tooltip.posizioneTooltip(elemento(330, 100, 60, 25), { width: 200, height: 40 }, finestra);

    assert.strictEqual(posizione.left, 400 - tooltip.BORDO - 200);
    assert.ok(posizione.left + 200 <= 400 - tooltip.BORDO);
});

test('e non sborda nemmeno a sinistra', () => {
    //Riquadro piu' largo del pannello: parte dal bordo, il testo va a capo.
    const posizione = tooltip.posizioneTooltip(elemento(10, 100, 60, 25), { width: 500, height: 40 }, finestra);

    assert.strictEqual(posizione.left, tooltip.BORDO);
});

test('misure mancanti non mandano il riquadro fuori schermo', () => {
    //In UXP le misure possono non arrivare: meglio un riquadro in alto a sinistra che uno a NaN.
    const posizione = tooltip.posizioneTooltip({}, {}, {});

    assert.strictEqual(Number.isNaN(posizione.left), false);
    assert.strictEqual(Number.isNaN(posizione.top), false);
    assert.ok(posizione.left >= tooltip.BORDO);
    assert.ok(posizione.top >= 0);

    assert.strictEqual(Number.isNaN(tooltip.posizioneTooltip(null, null, null).top), false);
});

test('la larghezza massima tiene il riquadro dentro il pannello', () => {
    assert.strictEqual(tooltip.larghezzaMassima({ width: 400 }), 400 - (tooltip.BORDO * 2));
    //Pannello ridotto al minimo: si smette di stringere, altrimenti non si legge piu' nulla.
    assert.strictEqual(tooltip.larghezzaMassima({ width: 40 }), 80);
    assert.strictEqual(tooltip.larghezzaMassima(null), 800 - (tooltip.BORDO * 2));
});

test('il riquadro non supera mai i limiti del pannello', () => {
    //La garanzia che mancava: qualunque elemento, qualunque testo, il riquadro resta dentro.
    //Il pannello del plugin puo' essere stretto e basso, ed e' li' che il difetto si vedeva.
    const pannelli = [{ width: 300, height: 200 }, { width: 420, height: 700 }, { width: 240, height: 120 }];
    const testi = ['Fix', 'Scegli cartella. Attualmente impostata: /Volumi/Lavori/Volantini/Export/', 'x'.repeat(400)];

    pannelli.forEach(pannello => {
        const larghezzaConsentita = tooltip.larghezzaMassima(pannello);
        const altezzaConsentita = tooltip.altezzaMassima(pannello);

        testi.forEach(testo => {
            const stima = tooltip.dimensioniStimate(testo, larghezzaConsentita);
            const riquadro = {
                width: Math.min(stima.width, larghezzaConsentita),
                height: Math.min(stima.height, altezzaConsentita)
            };

            for (let x = 0; x <= pannello.width; x += 20) {
                for (let y = 0; y <= pannello.height; y += 20) {
                    const posizione = tooltip.posizioneTooltip(elemento(x, y, 26, 25), riquadro, pannello);

                    assert.ok(posizione.left >= 0, `esce a sinistra a ${x},${y}`);
                    assert.ok(posizione.top >= 0, `esce in alto a ${x},${y}`);
                    assert.ok(posizione.left + riquadro.width <= pannello.width,
                        `esce a destra a ${x},${y} (${posizione.left} + ${riquadro.width} > ${pannello.width})`);
                    assert.ok(posizione.top + riquadro.height <= pannello.height,
                        `esce in basso a ${x},${y} (${posizione.top} + ${riquadro.height} > ${pannello.height})`);
                }
            }
        });
    });
});

test('la stima delle dimensioni non lascia mai un riquadro a zero', () => {
    //Serve quando UXP non sa dire quanto e' grande il riquadro: calcolare la posizione su
    //misure nulle vuol dire trattarlo come un punto, ed e' cosi' che finiva oltre il bordo.
    const corto = tooltip.dimensioniStimate('Fix', 300);
    assert.ok(corto.width > 0 && corto.height > 0);
    assert.ok(corto.width <= 300);

    //Un testo lungo va a capo: piu' alto, mai piu' largo del consentito.
    const lungo = tooltip.dimensioniStimate('x'.repeat(300), 300);
    assert.ok(lungo.width <= 300);
    assert.ok(lungo.height > corto.height);

    //Gli a capo espliciti contano come righe.
    const conACapo = tooltip.dimensioniStimate('prima\nseconda\nterza', 300);
    assert.ok(conACapo.height > corto.height);

    assert.ok(tooltip.dimensioniStimate('', 300).height > 0);
    assert.ok(tooltip.dimensioniStimate(null, null).width > 0);
});

test('l\'altezza massima tiene il riquadro dentro un pannello basso', () => {
    assert.strictEqual(tooltip.altezzaMassima({ height: 200 }), 200 - (tooltip.BORDO * 2));
    assert.strictEqual(tooltip.altezzaMassima({ height: 20 }), 40);
    assert.strictEqual(tooltip.altezzaMassima(null), 600 - (tooltip.BORDO * 2));
});
