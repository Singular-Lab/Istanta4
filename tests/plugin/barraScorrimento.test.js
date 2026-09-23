/*
 * I20-981: i conti della barra di scorrimento disegnata dal plugin.
 *
 * In UXP la tabella dei nuovi non scorre in orizzontale in nessun modo nativo, quindi la
 * tabella viene spostata a mano. Qui si verifica la parte che sbaglierebbe in silenzio: il
 * cursore deve restare dentro la traccia, gli estremi devono essere raggiungibili davvero, e
 * un clic deve portare dove ci si aspetta.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const barra = require('../../plugin/barraScorrimento');

//Un caso realistico: tabella larga 1200, riquadro 400, traccia 380.
const CONTENUTO = 1200;
const VISIBILE = 400;
const TRACCIA = 380;

test('si scorre solo quello che non ci sta', () => {
    assert.strictEqual(barra.scorrimentoMassimo(CONTENUTO, VISIBILE), 800);
    assert.strictEqual(barra.scorrimentoMassimo(300, 400), 0, 'se ci sta tutto non si scorre');
    assert.strictEqual(barra.serveLaBarra(CONTENUTO, VISIBILE), true);
    assert.strictEqual(barra.serveLaBarra(300, 400), false, 'senza niente da scorrere la barra non serve');
});

test('lo spostamento non esce dai limiti', () => {
    assert.strictEqual(barra.limitaSpostamento(-50, CONTENUTO, VISIBILE), 0);
    assert.strictEqual(barra.limitaSpostamento(5000, CONTENUTO, VISIBILE), 800);
    assert.strictEqual(barra.limitaSpostamento(250, CONTENUTO, VISIBILE), 250);
    //Senza niente da scorrere si resta a zero, qualunque cosa arrivi.
    assert.strictEqual(barra.limitaSpostamento(100, 300, 400), 0);
});

test('il cursore racconta quanta parte si vede, e resta dentro la traccia', () => {
    const inizio = barra.geometriaCursore(0, CONTENUTO, VISIBILE, TRACCIA);
    //Si vede un terzo del contenuto: il cursore occupa circa un terzo della traccia.
    assert.ok(Math.abs(inizio.larghezza - TRACCIA / 3) <= 2, `larghezza inattesa: ${inizio.larghezza}`);
    assert.strictEqual(inizio.sinistra, 0);

    const fine = barra.geometriaCursore(800, CONTENUTO, VISIBILE, TRACCIA);
    assert.strictEqual(fine.sinistra + fine.larghezza, TRACCIA, 'in fondo il cursore tocca il bordo destro');

    const meta = barra.geometriaCursore(400, CONTENUTO, VISIBILE, TRACCIA);
    assert.ok(meta.sinistra > inizio.sinistra && meta.sinistra < fine.sinistra);
});

test('con tantissime colonne il cursore resta afferrabile', () => {
    //Contenuto enorme: la proporzione darebbe pochi pixel, e il cursore non si prenderebbe piu'.
    const g = barra.geometriaCursore(0, 20000, 300, 300);
    assert.ok(g.larghezza >= barra.CURSORE_MINIMO, `cursore troppo stretto: ${g.larghezza}`);
    assert.ok(g.larghezza <= 300);
});

test('un clic sulla traccia porta dove si e\' cliccato', () => {
    assert.strictEqual(barra.spostamentoDaClic(0, CONTENUTO, VISIBILE, TRACCIA), 0);
    assert.strictEqual(barra.spostamentoDaClic(TRACCIA, CONTENUTO, VISIBILE, TRACCIA), 800, 'in fondo alla traccia si arriva in fondo');

    const meta = barra.spostamentoDaClic(TRACCIA / 2, CONTENUTO, VISIBILE, TRACCIA);
    assert.ok(Math.abs(meta - 400) <= 8, `a meta' traccia ci si aspetta meta' scorrimento, non ${meta}`);
});

test('il trascinamento sposta in proporzione, e si ferma agli estremi', () => {
    const daFermo = barra.spostamentoDaTrascinamento(0, 0, CONTENUTO, VISIBILE, TRACCIA);
    assert.strictEqual(daFermo, 0);

    //Trascinare il cursore per tutto lo spazio disponibile porta in fondo.
    const cursore = barra.geometriaCursore(0, CONTENUTO, VISIBILE, TRACCIA).larghezza;
    const tutto = barra.spostamentoDaTrascinamento(0, TRACCIA - cursore, CONTENUTO, VISIBILE, TRACCIA);
    assert.strictEqual(tutto, 800);

    //All'indietro oltre l'inizio si resta a zero.
    assert.strictEqual(barra.spostamentoDaTrascinamento(100, -9999, CONTENUTO, VISIBILE, TRACCIA), 0);
    assert.strictEqual(barra.spostamentoDaTrascinamento(700, 9999, CONTENUTO, VISIBILE, TRACCIA), 800);
});

test('misure assurde non producono numeri assurdi', () => {
    //In UXP una misura puo' tornare zero o non tornare affatto: meglio una barra ferma che una
    //tabella spinta a coordinate senza senso.
    [
        barra.geometriaCursore(0, 0, 0, 0),
        barra.geometriaCursore(null, null, null, null),
        barra.geometriaCursore(100, undefined, undefined, undefined)
    ].forEach(g => {
        assert.ok(!Number.isNaN(g.larghezza) && !Number.isNaN(g.sinistra));
        assert.ok(g.sinistra >= 0);
    });

    assert.strictEqual(barra.spostamentoDaClic(null, null, null, null), 0);
    assert.strictEqual(barra.spostamentoDaTrascinamento(null, null, null, null, null), 0);
    assert.strictEqual(barra.serveLaBarra(null, null), false);
});
