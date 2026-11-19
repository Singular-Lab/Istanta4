/*
 * TASK-a6f5fa47: dopo un'azione sul box il confronto (confronti.confrontoBox) tiene il box di prima e
 * ci scrive il testo del box nuovo. Prima scriveva il solo testo, copiava gli stili di carattere dei
 * soli caratteri visibili nel riquadro di prima e controllava l'overflow prima di cambiare lo stile di
 * paragrafo: con "Forza reparto in descrizione" di Edro21 l'ultima riga della descrizione usciva, con
 * lo stile sbagliato. Ora il testo si duplica dalla storia del box nuovo con la sua formattazione, e
 * l'overflow si guarda quando testo e stile sono definitivi.
 *
 * Esecuzione: node --test tests/plugin/confrontoTestoCampo.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const { leggiFileDelPlugin } = require('./fileDelPlugin');

const confronti = require('../../plugin/confronti');

const AT_BEGINNING = 'AT_BEGINNING';

/// Una storia finta: paragrafi con stile e testo, caratteri con il loro stile. visibili e' quanti
/// caratteri stanno nel riquadro: i caratteri del riquadro sono solo quelli, quelli della storia tutti.
function storia(paragrafi, opzioni = {}) {
    const s = {
        _paragrafi: paragrafi.map(p => ({ appliedParagraphStyle: { name: p.stile }, contents: p.testo })),
        _caratteri: [],
        duplicazioni: [],
        get contents() { return this._paragrafi.map(p => p.contents).join('\r'); },
        set contents(testo) {
            //Come InDesign: il testo nuovo prende lo stile del punto d'inserimento, cioe' del primo paragrafo.
            const stile = this._paragrafi.length > 0 ? this._paragrafi[0].appliedParagraphStyle : { name: 'NormalParagraphStyle' };
            this._paragrafi = testo === '' ? [] : testo.split('\r').map(t => ({ appliedParagraphStyle: stile, contents: t }));
            this._caratteri = Array.from(testo).map(() => ({ appliedCharacterStyle: { name: 'insertion' } }));
        },
        get paragraphs() { const lista = this._paragrafi; return { length: lista.length, item: i => lista[i] }; },
        get characters() { const lista = this._caratteri; return { length: lista.length, item: i => lista[i] }; },
        texts: { item: () => ({
            duplicate: (posizione, riferimento) => {
                if (opzioni.duplicateLancia) {
                    throw new Error('duplicate non supportato');
                }
                s.duplicazioni.push(posizione);
                riferimento._paragrafi = s._paragrafi.map(p => ({ appliedParagraphStyle: p.appliedParagraphStyle, contents: p.contents }));
                riferimento._caratteri = s._caratteri.map(c => ({ appliedCharacterStyle: c.appliedCharacterStyle }));
            }
        }) }
    };
    s._caratteri = Array.from(s.contents).map((_, i) => ({ appliedCharacterStyle: { name: (opzioni.stileCarattere || (() => 'Nessuno'))(i) } }));
    return s;
}

/// La descrizione del box nuovo con il reparto forzato di Edro21: riga del reparto nel suo stile.
function descrizioneNuova(opzioni) {
    return storia([
        { stile: 'DIC_Reparto_31', testo: 'PANE E PASTICCERIA' },
        { stile: 'DES_descr_nome', testo: 'Biscotti al burro' },
        { stile: 'DES_descr_nome', testo: 'gr 350' }
    ], Object.assign({ stileCarattere: i => (i < 18 ? 'DICITURA_Reparto' : 'DES_nome') }, opzioni));
}

function riquadro(s, label = 'descrizione') {
    return { label: label, parentStory: s };
}

test('il testo del box nuovo si duplica con la sua formattazione nella storia del box vecchio', () => {
    const nuova = descrizioneNuova();
    const vecchia = storia([{ stile: 'DES_descr_nome', testo: 'Biscotti al burro gr 350' }]);

    const duplicato = confronti.copiaTestoDelCampo(riquadro(vecchia), riquadro(nuova), AT_BEGINNING);

    assert.strictEqual(duplicato, true);
    assert.deepStrictEqual(nuova.duplicazioni, [AT_BEGINNING]);
    assert.strictEqual(vecchia.contents, nuova.contents);
    assert.deepStrictEqual(vecchia._paragrafi.map(p => p.appliedParagraphStyle.name), ['DIC_Reparto_31', 'DES_descr_nome', 'DES_descr_nome']);
    //Tutti i caratteri, anche l'ultimo, quello che prima finiva in overflow con lo stile sbagliato.
    assert.strictEqual(vecchia.characters.item(vecchia.characters.length - 1).appliedCharacterStyle.name, 'DES_nome');
    assert.strictEqual(vecchia.characters.item(0).appliedCharacterStyle.name, 'DICITURA_Reparto');
});

test('se duplicare non riesce si copiano testo e stili di ogni paragrafo e di ogni carattere della storia', () => {
    const nuova = descrizioneNuova({ duplicateLancia: true });
    const vecchia = storia([{ stile: 'DES_descr_nome', testo: 'Biscotti al burro gr 350' }]);
    const errori = [];
    const consoleError = console.error;
    console.error = (...a) => errori.push(a.join(' '));
    try {
        assert.strictEqual(confronti.copiaTestoDelCampo(riquadro(vecchia), riquadro(nuova), AT_BEGINNING), false);
    }
    finally {
        console.error = consoleError;
    }

    assert.strictEqual(vecchia.contents, nuova.contents);
    assert.deepStrictEqual(vecchia._paragrafi.map(p => p.appliedParagraphStyle.name), ['DIC_Reparto_31', 'DES_descr_nome', 'DES_descr_nome']);
    assert.deepStrictEqual(vecchia._caratteri.map(c => c.appliedCharacterStyle.name), nuova._caratteri.map(c => c.appliedCharacterStyle.name));
    assert.ok(errori.some(e => e.includes('Code CNF-002')), 'il ripiego si dice in console');
});

test("l'ultimo paragrafo prende lo stile del box nuovo anche se il duplicato non lo porta", () => {
    const nuova = descrizioneNuova();
    const vecchia = storia([{ stile: 'DES_descr_nome', testo: 'x' }]);
    //Un duplicate che lascia all'ultimo paragrafo lo stile che c'era.
    nuova.texts.item = () => ({ duplicate: (posizione, riferimento) => {
        riferimento._paragrafi = nuova._paragrafi.map((p, i, tutti) => ({ appliedParagraphStyle: i == tutti.length - 1 ? { name: 'DES_vecchio' } : p.appliedParagraphStyle, contents: p.contents }));
    } });

    confronti.copiaTestoDelCampo(riquadro(vecchia), riquadro(nuova), AT_BEGINNING);

    assert.strictEqual(vecchia._paragrafi[2].appliedParagraphStyle.name, 'DES_descr_nome');
});

test('una casella ancora in overflow prende le misure del box nuovo, una che ci sta no', () => {
    const nuovo = { geometricBounds: [10, 20, 40, 80] };
    const inOverflow = { overflows: true, geometricBounds: [10, 20, 30, 80] };
    const ciSta = { overflows: false, geometricBounds: [12, 22, 32, 82] };

    assert.strictEqual(confronti.misureDelNuovoSeInOverflow(inOverflow, nuovo), true);
    assert.deepStrictEqual(inOverflow.geometricBounds, [10, 20, 40, 80]);
    assert.strictEqual(confronti.misureDelNuovoSeInOverflow(ciSta, nuovo), false);
    assert.deepStrictEqual(ciSta.geometricBounds, [12, 22, 32, 82]);
});

test("confrontoBox copia il testo con la formattazione e guarda l'overflow dopo lo stile di paragrafo", () => {
    const sorgente = leggiFileDelPlugin('confronti.js').replace(/\r/g, '');
    const inizio = sorgente.indexOf('    async confrontoBox(box1, box2, forzaReimpaginazione = false){');
    const fine = sorgente.indexOf('    copiaTestoDelCampo(campo, campoNuovo, inizio = null) {');
    assert.ok(inizio > 0 && fine > inizio);
    const confronto = sorgente.substring(inizio, fine);

    assert.match(confronto, /if \(campo\.contents != campoBox2\.contents\) \{[\s\S]*?confronti\.copiaTestoDelCampo\(campo, campoBox2\);/);
    //Niente piu' copia degli stili sui soli caratteri del riquadro.
    assert.doesNotMatch(confronto, /campo\.characters\.item\(c\)\.appliedCharacterStyle/);
    assert.doesNotMatch(confronto, /if \(campo\.overflows\)/);
    const stile = confronto.indexOf('campo.paragraphs.item(0).appliedParagraphStyle = campoBox2.paragraphs.item(0).appliedParagraphStyle;');
    const overflow = confronto.indexOf('confronti.misureDelNuovoSeInOverflow(campo, campoBox2);');
    assert.ok(stile > 0 && overflow > stile, "l'overflow si guarda dopo lo stile di paragrafo");
});
