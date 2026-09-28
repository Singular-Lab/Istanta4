/*
 * I20-1002: dentro CssFramework, un membro va chiamato con this.
 *
 * CssFramework e' un oggetto solo, e le sue funzioni sono membri. Chiamarne una senza this.
 * non e' un dettaglio di stile: quel nome non esiste come funzione globale, quindi la riga
 * lancia ReferenceError. Se poi la funzione e' avvolta in un try/catch - e nel file quasi
 * tutte lo sono - l'errore viene inghiottito e chi chiama riceve un false che nessuno guarda.
 *
 * E' successo due volte, per anni, senza che nessuno se ne accorgesse:
 *
 *  - la catena MAIN_fixFoto, trapiantata dal vecchio fotoFix.js dove quelle funzioni erano
 *    globali del file. Non ha mai funzionato; e' stata cancellata in I20-1002 perche' la
 *    chiamavano solo agenzie deprecate.
 *  - reflowTextFrameAvoidConflicts, 1.230 righe che mandano a capo la descrizione per non
 *    farla sovrapporre agli altri elementi: una sola chiamata senza this., nel preambolo,
 *    e il reflow non e' mai avvenuto. Corretta in I20-1002.
 *
 * Il file non ha "use strict", che avrebbe fatto emergere subito le assegnazioni implicite ma
 * non queste chiamate. Questo test guarda il sorgente come testo, perche' CssFramework.js
 * richiede InDesign e sotto Node non si carica: e' l'unico modo di tenere la regola.
 *
 * Esecuzione: node --test tests/plugin/cssFrameworkChiamateMembri.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PERCORSO = path.join(__dirname, '..', '..', 'plugin', 'CssFramework.js');

//Nomi che somigliano a una chiamata ma sono parole del linguaggio o oggetti del runtime.
const NON_SONO_MEMBRI = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new',
    'String', 'Number', 'Math', 'Array', 'Object', 'RegExp', 'Date', 'JSON', 'Boolean',
    'Error', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'decodeURI', 'encodeURI'
]);

function leggiSorgente() {
    return fs.readFileSync(PERCORSO, 'utf8');
}

/// I membri di primo livello dell'oggetto: stanno a quattro spazi di rientro, come
/// "    nomeMembro(" oppure "    nomeMembro:".
///
/// L'async va riconosciuto: "    async nomeMembro(" e' un membro come gli altri, e senza
/// questo ramo il controllo lo ignorerebbe - cioe' non segnalerebbe una sua chiamata
/// sbagliata. La prima versione di questo test aveva proprio questo buco.
function membriDellOggetto(sorgente) {
    const membri = new Set();
    for (const riga of sorgente.split('\n')) {
        const m = riga.match(/^ {4}(?:async\s+)?([a-zA-Z_][\w]*)\s*[:(]/);
        if (m) membri.add(m[1]);
    }
    return membri;
}

/// Le funzioni dichiarate dentro al file con "function nome(": quelle si chiamano senza this,
/// ed e' giusto cosi'.
function funzioniLocali(sorgente) {
    const locali = new Set();
    for (const m of sorgente.matchAll(/function\s+([a-zA-Z_][\w]*)\s*\(/g)) {
        locali.add(m[1]);
    }
    return locali;
}

/// Le chiamate a un membro scritte senza this. e senza CssFramework. davanti.
function chiamateSenzaThis(sorgente) {
    const membri = membriDellOggetto(sorgente);
    const locali = funzioniLocali(sorgente);
    const trovate = [];

    const righe = sorgente.split('\n');
    for (let i = 0; i < righe.length; i++) {
        const riga = righe[i];
        const spoglia = riga.trim();
        //I commenti non eseguono niente.
        if (spoglia.startsWith('//') || spoglia.startsWith('*') || spoglia.startsWith('/*')) continue;
        //La definizione del membro non e' una chiamata a se stesso.
        if (/^ {4}(?:async\s+)?[a-zA-Z_][\w]*\s*[:(]/.test(riga)) continue;

        for (const m of riga.matchAll(/(?<![\w.])([a-zA-Z_][\w]*)\s*\(/g)) {
            const nome = m[1];
            if (!membri.has(nome)) continue;
            if (locali.has(nome)) continue;
            if (NON_SONO_MEMBRI.has(nome)) continue;
            trovate.push({ riga: i + 1, nome, testo: spoglia });
        }
    }
    return trovate;
}

test('nessun membro di CssFramework viene chiamato senza this.', () => {
    const trovate = chiamateSenzaThis(leggiSorgente());

    const elenco = trovate
        .map(t => `  CssFramework.js:${t.riga}  ${t.nome}()  ->  ${t.testo}`)
        .join('\n');

    assert.strictEqual(trovate.length, 0,
        'Questi nomi sono membri dell\'oggetto e senza this. lanciano ReferenceError a ' +
        'runtime, dove quasi sempre un try/catch li nasconde:\n' + elenco);
});

test('il controllo riconosce davvero una chiamata senza this.', () => {
    //Senza questa prova, un test che passa non direbbe niente: potrebbe passare perche' non
    //trova mai nulla. Qui si verifica che il difetto, se c'e', venga visto.
    const finto = [
        'const CssFramework =',
        '{',
        '    faQualcosa(x) {',
        '        return x;',
        '    },',
        '',
        '    chiamante() {',
        '        return faQualcosa(1);',
        '    },',
        '}'
    ].join('\n');

    const trovate = chiamateSenzaThis(finto);

    assert.strictEqual(trovate.length, 1);
    assert.strictEqual(trovate[0].nome, 'faQualcosa');
    assert.strictEqual(trovate[0].riga, 8);
});

test('con this. davanti, la stessa chiamata non viene segnalata', () => {
    const finto = [
        'const CssFramework =',
        '{',
        '    faQualcosa(x) {',
        '        return x;',
        '    },',
        '',
        '    chiamante() {',
        '        return this.faQualcosa(1);',
        '    },',
        '}'
    ].join('\n');

    assert.deepStrictEqual(chiamateSenzaThis(finto), []);
});

test('un membro async e\' un membro come gli altri', () => {
    //Il buco della prima versione: "async nome(" non veniva riconosciuto come membro, quindi
    //una sua chiamata senza this. sarebbe passata inosservata.
    const finto = [
        'const CssFramework =',
        '{',
        '    async faQualcosa(x) {',
        '        return x;',
        '    },',
        '',
        '    chiamante() {',
        '        return faQualcosa(1);',
        '    },',
        '}'
    ].join('\n');

    const trovate = chiamateSenzaThis(finto);

    assert.strictEqual(trovate.length, 1);
    assert.strictEqual(trovate[0].nome, 'faQualcosa');
});

test('le funzioni locali dichiarate nel file non sono segnalate', () => {
    //Dentro reflowTextFrameAvoidConflicts ce ne sono una trentina: si chiamano senza this
    //ed e' corretto, perche' sono dichiarate li' dentro.
    const finto = [
        'const CssFramework =',
        '{',
        '    aiuto(x) { return x; },',
        '',
        '    grande() {',
        '        function aiuto(y) { return y + 1; }',
        '        return aiuto(1);',
        '    },',
        '}'
    ].join('\n');

    assert.deepStrictEqual(chiamateSenzaThis(finto), []);
});
