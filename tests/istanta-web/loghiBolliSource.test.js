/*
 * I20-1136: la pagina Loghi e bolli ha la vista Source, come Aree/Canali: l'archivio si scrive (o si
 * incolla da un altro Istanta) in JSON e si salva con LoghiBolli/salvaSourceJsonCode. L'editor e'
 * quello di sempre (sourceEditor.js), che ora passa l'esito del salvataggio a chi glielo chiede.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function leggi(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8').replace(/^﻿/, '').replace(/\r/g, '');
}

// sourceEditor.js e' uno script del browser: si carica in un contesto con un editor, Call e le
// funzioni di attesa finte. markers sono gli errori che Monaco segnala nell'editor.
function editorFinto({ valore, markers = [], risposta }) {
    const chiamate = [];
    const contesto = {
        console: { log() {}, error() {}, warn() {} },
        require: { config() {} },
        showLoading() {},
        hideLoading() {},
        monaco: { editor: { getModelMarkers: () => markers } },
        Call: {
            doWithLargePayload(controller, indirizzo, metodo, parametri, mittente, callback) {
                chiamate.push({ controller, indirizzo, metodo, parametri });
                callback(risposta, mittente);
            }
        }
    };
    vm.createContext(contesto);
    vm.runInContext(leggi('Istanta/wwwroot/js/sourceEditor.js') + '\nthis.ExternalSourceEditor = ExternalSourceEditor;', contesto);
    const editor = new contesto.ExternalSourceEditor();
    editor.sourceUri = 'SourceLoghiBolli';
    editor.editorInstance = { getModel: () => ({ uri: 'x' }), getValue: () => valore };
    return { editor, chiamate };
}

/* ---- il salvataggio dell'editor ---- */

test('il salvataggio manda il sorgente minificato al controller della pagina e passa l\'esito', () => {
    const { editor, chiamate } = editorFinto({ valore: '{\n  "source": []\n}', risposta: { esito: true } });
    let esito = null;

    editor.save('LoghiBolli', r => { esito = r; });

    assert.strictEqual(chiamate.length, 1);
    assert.strictEqual(chiamate[0].controller, 'LoghiBolli');
    assert.strictEqual(chiamate[0].indirizzo, 'salvaSourceJsonCode');
    assert.strictEqual(chiamate[0].metodo, 'PUT');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(chiamate[0].parametri)), { jsoncode: '{"source":[]}', origin: 'SourceLoghiBolli' });
    assert.deepStrictEqual(esito, { esito: true });
});

test('un rifiuto del server arriva a chi aspetta l\'esito', () => {
    const { editor } = editorFinto({ valore: '{"loghi":[]}', risposta: { esito: false, error: 'senza source' } });
    let esito = null;

    editor.save('LoghiBolli', r => { esito = r; });

    assert.deepStrictEqual(esito, { esito: false, error: 'senza source' });
});

test('con errori nell\'editor non si salva, e chi aspetta l\'esito lo sa', () => {
    const { editor, chiamate } = editorFinto({ valore: '{"source": [', markers: [{ message: 'errore' }] });
    let esito = null;

    editor.save('LoghiBolli', r => { esito = r; });

    assert.strictEqual(chiamate.length, 0);
    assert.strictEqual(esito.esito, false);
    assert.match(esito.error, /errori/);
});

test('senza chi aspetta l\'esito il salvataggio e\' quello di prima', () => {
    const { editor, chiamate } = editorFinto({ valore: '{"aree":[]}', risposta: { esito: true } });

    assert.doesNotThrow(() => editor.save('ACPV'));
    assert.strictEqual(chiamate[0].controller, 'ACPV');

    const conErrori = editorFinto({ valore: '{', markers: [{}] });
    assert.doesNotThrow(() => conErrori.editor.save('ACPV'));
});

/* ---- la pagina ---- */

test('la pagina Loghi e bolli ha le viste Visual e Source, con l\'editor sull\'archivio SourceLoghiBolli', () => {
    const pagina = leggi('Istanta/Views/SyncFoto/LoghiBolli.cshtml');

    assert.match(pagina, /id="aMenuVisual"[^>]*>Visual</);
    assert.match(pagina, /id="aMenuSource"[^>]*>Source</);
    assert.match(pagina, /<div id="containerSource"[^>]*style="display:none;"[\s\S]*?id="btnSourceSave"[\s\S]*?<div id="editor"><\/div>/);
    assert.match(pagina, /<div class="container" id="contentVisual">\s*<div class="row" id="headerResult">/);
    assert.match(pagina, /src="~\/js\/sourceEditor\.js"/);
    assert.match(pagina, /monaco-editor@latest\/min\/vs\/loader\.js/);
    assert.match(pagina, /exSourceEditor\.init\("SourceLoghiBolli"\);/);
});

test('salvando dal sorgente la pagina dice l\'esito e ricarica l\'elenco', () => {
    const pagina = leggi('Istanta/Views/SyncFoto/LoghiBolli.cshtml');

    assert.match(pagina, /exSourceEditor\.save\("LoghiBolli", function \(result\) \{\s*if \(result != null && result\.esito\) \{\s*mostraMessaggio\("Archivio loghi e bolli salvato\.", "success"\);[\s\S]*?loghiBolliInstance\.get\(\);\s*\}\s*else \{\s*mostraMessaggio\("Salvataggio non riuscito: "/);
});
