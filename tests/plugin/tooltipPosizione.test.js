/*
 * I20-981: dove viene ancorato il riquadro di un tooltip.
 *
 * Il pannello del plugin e' stretto e spesso basso: il rischio vero non e' sbagliare di
 * qualche pixel, e' che il suggerimento esca dal pannello e non si legga. La regola non
 * guarda mai quanto e' grande il riquadro, perche' in UXP quella misura non e' attendibile:
 * usa il rettangolo dell'elemento e i limiti massimi che imponiamo noi.
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
    const a = tooltip.ancoraggioTooltip(elemento(50, 100, 80, 25), finestra, 260);

    assert.strictEqual(a.left, 50);
    assert.strictEqual(a.top, 100 + 25 + tooltip.DISTANZA);
    assert.strictEqual(a.bottom, undefined, 'con top non si ancora anche il fondo');
    assert.strictEqual(a.maxWidth, 260);
});

test('se sotto non c\'e\' spazio il riquadro si ancora col fondo', () => {
    //Ancorando il bordo inferiore al bordo superiore dell'elemento, il riquadro cresce verso
    //l'alto: quanto sia alto non serve saperlo, ed e' il punto di tutta la regola.
    const a = tooltip.ancoraggioTooltip(elemento(50, 580, 80, 15), finestra, 260);

    assert.strictEqual(a.top, undefined);
    assert.strictEqual(a.bottom, 600 - (580 - tooltip.DISTANZA));
    //E lo spazio concesso e' quello che c'e' davvero sopra.
    assert.strictEqual(a.maxHeight, 580 - tooltip.DISTANZA - tooltip.BORDO);
});

test('vicino al bordo destro il riquadro arretra', () => {
    const a = tooltip.ancoraggioTooltip(elemento(380, 100, 20, 25), finestra, 260);

    assert.strictEqual(a.left, 400 - tooltip.BORDO - 260);
    assert.ok(a.left + a.maxWidth <= 400 - tooltip.BORDO);
});

test('in un pannello stretto il riquadro si restringe, non esce', () => {
    const stretto = { width: 200, height: 400 };
    const a = tooltip.ancoraggioTooltip(elemento(150, 100, 30, 25), stretto, 260);

    assert.ok(a.maxWidth <= 200 - (tooltip.BORDO * 2));
    assert.ok(a.left >= tooltip.BORDO);
    assert.ok(a.left + a.maxWidth <= 200 - tooltip.BORDO);
});

test('misure mancanti non mandano il riquadro fuori schermo', () => {
    //In UXP le misure possono non arrivare: meglio un riquadro in alto a sinistra che uno a NaN.
    const a = tooltip.ancoraggioTooltip({}, {}, null);

    assert.strictEqual(Number.isNaN(a.left), false);
    assert.strictEqual(Number.isNaN(a.top != null ? a.top : a.bottom), false);
    assert.ok(a.left >= tooltip.BORDO);
    assert.ok(a.maxWidth > 0 && a.maxHeight > 0);

    const b = tooltip.ancoraggioTooltip(null, null, null);
    assert.ok(b.maxWidth > 0);
});

test('i limiti di larghezza e altezza restano dentro il pannello', () => {
    assert.strictEqual(tooltip.larghezzaMassima({ width: 400 }), 400 - (tooltip.BORDO * 2));
    assert.strictEqual(tooltip.larghezzaMassima({ width: 40 }), 80);
    assert.strictEqual(tooltip.altezzaMassima({ height: 200 }), 200 - (tooltip.BORDO * 2));
    assert.strictEqual(tooltip.altezzaMassima({ height: 20 }), tooltip.ALTEZZA_MINIMA);
});

test('il riquadro non supera mai i limiti del pannello', () => {
    //La garanzia che conta: qualunque elemento, in qualunque punto, di qualunque pannello, il
    //riquadro resta dentro. Vale per lo spazio concesso, che e' il massimo che il riquadro
    //puo' occupare: piu' piccolo puo' essere, piu' grande no.
    const pannelli = [{ width: 300, height: 200 }, { width: 420, height: 700 }, { width: 240, height: 120 }];

    pannelli.forEach(pannello => {
        for (let x = 0; x <= pannello.width; x += 10) {
            for (let y = 0; y <= pannello.height; y += 10) {
                const a = tooltip.ancoraggioTooltip(elemento(x, y, 26, 25), pannello, 260);

                assert.ok(a.left >= 0, `esce a sinistra a ${x},${y}`);
                assert.ok(a.left + a.maxWidth <= pannello.width,
                    `esce a destra a ${x},${y} (${a.left} + ${a.maxWidth} > ${pannello.width})`);

                if (a.top != null) {
                    assert.ok(a.top >= 0, `esce in alto a ${x},${y}`);
                    assert.ok(a.top + a.maxHeight <= pannello.height,
                        `esce in basso a ${x},${y} (${a.top} + ${a.maxHeight} > ${pannello.height})`);
                }
                else {
                    //Ancorato col fondo: il bordo alto del riquadro e' finestra - bottom - altezza.
                    const altoRiquadro = pannello.height - a.bottom - a.maxHeight;
                    assert.ok(altoRiquadro >= 0, `esce in alto a ${x},${y} (${altoRiquadro})`);
                    assert.ok(a.bottom >= 0, `esce in basso a ${x},${y}`);
                }
            }
        }
    });
});
