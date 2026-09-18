/*
 * I20-974: regole di segnalazione conflitti del CSS framework.
 *
 * Il modulo sotto test e' plugin/cssRegoleConflitti.js, che legge le regole senza toccare
 * InDesign. Due cose vanno protette: che le forme di regola gia' in uso continuino a valere
 * esattamente come prima, e che la scelta fra riquadro dell'oggetto e testo reale arrivi
 * fino al controllo, perche' e' li' che nascevano le segnalazioni inutili.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cssRegoleConflitti = require('../../plugin/cssRegoleConflitti');

const radice = path.join(__dirname, '..', '..');

function sorgente(percorso) {
    return fs.readFileSync(path.join(radice, percorso), 'utf8');
}

test('una regola a due lati separa gli elementi dei due lati', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['descrizione']);
    assert.deepStrictEqual(regola.latoB, ['*foto_extra*']);
});

test('una regola a un lato solo vale come "questi non si tocchino fra loro"', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['*foto_extra*']);
    assert.deepStrictEqual(regola.latoB, []);
});

test('il lato scritto per secondo, da solo, diventa comunque il primo', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['*foto_extra*']);
    assert.deepStrictEqual(regola.latoB, []);
});

test('piu\' etichette sullo stesso lato si separano per virgola', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione, prezzo ', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['descrizione', 'prezzo']);
});

// Il punto della modifica: senza questa scelta il contatto si misura sul riquadro
// dell'oggetto, che per un campo di testo e' molto piu' largo del testo che contiene.
test('la scelta dei bounds arriva nella regola', () => {
    const suTesto = cssRegoleConflitti.normalizzaRegola({
        segnalazioni: ['descrizione', '*foto_extra*'],
        useTextBounds: true
    });
    const suRiquadro = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.strictEqual(suTesto.useTextBounds, true);
    assert.strictEqual(suRiquadro.useTextBounds, false);
});

test('una regola scritta come coppia di stringhe resta valida e misura sul riquadro', () => {
    const regole = cssRegoleConflitti.getListaRegole(['descrizione', '*foto_extra*']);

    assert.strictEqual(regole.length, 1);
    assert.deepStrictEqual(regole[0].latoA, ['descrizione']);
    assert.deepStrictEqual(regole[0].latoB, ['*foto_extra*']);
    assert.strictEqual(regole[0].useTextBounds, false);
});

test('un elenco di regole le legge tutte', () => {
    const regole = cssRegoleConflitti.getListaRegole([
        { segnalazioni: ['*foto_extra*'] },
        { segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true }
    ]);

    assert.strictEqual(regole.length, 2);
    assert.strictEqual(regole[0].useTextBounds, false);
    assert.strictEqual(regole[1].useTextBounds, true);
});

test('regole assenti o vuote non producono controlli', () => {
    assert.deepStrictEqual(cssRegoleConflitti.getListaRegole(null), []);
    assert.deepStrictEqual(cssRegoleConflitti.getListaRegole([]), []);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola(null), null);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola({ segnalazioni: [] }), null);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['', ''] }), null);
});

// La stessa coppia di lati misurata in due modi diversi e' un controllo diverso: se la
// chiave non lo distinguesse, la seconda regola verrebbe scartata come duplicato.
test('la chiave distingue le regole anche per la scelta dei bounds', () => {
    const suTesto = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true });
    const suRiquadro = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.notStrictEqual(cssRegoleConflitti.chiaveRegola(suTesto), cssRegoleConflitti.chiaveRegola(suRiquadro));
});

// Senza questo passaggio l'opzione resterebbe un dato che nessuno guarda.
test('il controllo passa la scelta dei bounds al confronto fra elementi', () => {
    const framework = sorgente('plugin/CssFramework.js');
    const inizio = framework.indexOf('controllaSegnalazioniConflittiPendenti(box) {');
    const blocco = framework.slice(inizio, inizio + 2500);

    const chiamate = blocco.match(/elementsTouching\([^)]*\)/g) || [];

    assert.strictEqual(chiamate.length, 2, 'il controllo confronta gli elementi in due punti');
    assert.ok(
        chiamate.every(c => c.includes('regola.useTextBounds')),
        'entrambi i confronti devono usare la scelta dichiarata nella regola');
});

// La regola chiesta dalla issue, sul cliente indicato.
test('Edro21 chiede che la descrizione non tocchi le foto extra, misurando il testo', () => {
    const config = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json'));

    const regole = [];
    (function cerca(nodo) {
        if (Array.isArray(nodo)) {
            nodo.forEach(cerca);
            return;
        }
        if (nodo && typeof nodo === 'object') {
            if (Array.isArray(nodo.segnalazioniConflitti)) {
                regole.push(...nodo.segnalazioniConflitti);
            }
            Object.values(nodo).forEach(cerca);
        }
    })(config);

    const descrizione = regole.filter(r =>
        Array.isArray(r.segnalazioni) &&
        r.segnalazioni[0] === 'descrizione' &&
        r.segnalazioni[1] === '*foto_extra*');

    assert.ok(descrizione.length > 0, 'la regola deve esistere nella configurazione di Edro21');
    assert.ok(descrizione.every(r => r.useTextBounds === true),
        'va misurata sul testo reale, altrimenti torna a segnalare il riquadro vuoto');
});

// Una segnalazione giusta e una sbagliata, dall'esterno, si somigliano: cambia solo cosa
// e' stato misurato. La diagnostica lo rende visibile in console.
test('la segnalazione dichiara su quali rettangoli e\' stata decisa', () => {
    const framework = sorgente('plugin/CssFramework.js');

    assert.ok(framework.includes('tracciaConfrontoConflitto('),
        'deve esistere la diagnostica del confronto');
    assert.ok(framework.includes('CSF-013 diagnostica'),
        'la riga di console va riconosciuta a colpo d\'occhio insieme al codice della segnalazione');

    const inizio = framework.indexOf('controllaSegnalazioniConflittiPendenti(box) {');
    const blocco = framework.slice(inizio, inizio + 2500);
    const segnalazioni = blocco.match(/segnalaConflittoElementi\([^)]*\)/g) || [];

    assert.strictEqual(segnalazioni.length, 2, 'i punti che segnalano sono due');
    assert.ok(segnalazioni.every(c => c.includes('regola.useTextBounds')),
        'entrambi devono dire quale misura hanno usato, altrimenti la diagnostica mente');
});
