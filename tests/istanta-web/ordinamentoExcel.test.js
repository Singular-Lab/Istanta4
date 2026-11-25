/*
 * I20-1269: la sezione Excel della pagina Ordinamento. Si carica un Excel, si sceglie l'addestramento
 * lista e si associa ogni campo del primo elemento dello schema a una colonna, a %PROG% o a %NOW%.
 * "Genera" resta spento finche' manca un'associazione o il file; lo schema generato da Istanta va nella
 * sezione Source senza essere salvato (sourceEditor.impostaValore), e si salva con il Salva di sempre.
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

// Un jQuery finto: ogni selettore ha il suo stato (valore, html, disabled).
function jQueryFinto() {
    const elementi = {};
    const $ = (sel) => {
        const e = elementi[sel] || (elementi[sel] = { valore: '', html: '', disabled: null });
        const api = {
            val(v) { if (v === undefined) return e.valore; e.valore = v; return api; },
            html(h) { if (h === undefined) return e.html; e.html = h; return api; },
            prop(nome, v) { if (nome === 'disabled') e.disabled = v; return api; },
            empty() { e.html = ''; return api; },
            on() { return api; },
            each() { return api; },
            attr() { return ''; }
        };
        return api;
    };
    return { $, elementi };
}

function pagina({ risposta, conFile = true }) {
    const { $, elementi } = jQueryFinto();
    const chiamate = [];
    const editor = { valori: [] };
    let sourceAperto = 0;
    const contesto = {
        console: { log() {}, error() {}, warn() {} },
        $,
        document: { getElementById: () => ({ files: conFile ? [{ name: 'ordinamento.xlsx' }] : [] }) },
        showLoading() {},
        hideLoading() {},
        convertBase64: async () => 'data:application/vnd.ms-excel;base64,QUJD',
        exSourceEditor: { impostaValore: (t) => editor.valori.push(t) },
        menuSource: () => { sourceAperto++; },
        Call: {
            doWithLargePayload(controller, indirizzo, metodo, parametri, mittente, callback) {
                chiamate.push({ controller, indirizzo, metodo, parametri });
                callback(risposta, mittente);
            }
        }
    };
    vm.createContext(contesto);
    vm.runInContext(leggi('Istanta/wwwroot/js/ordinamento.js') + '\nthis.OrdinamentoExcel = OrdinamentoExcel;', contesto);
    const sezione = new contesto.OrdinamentoExcel();
    return { sezione, chiamate, editor, elementi, sourceAperti: () => sourceAperto };
}

const PROPOSTA = () => ({
    chiaveElenco: 'source',
    campi: ['Gruppo', 'Indice'],
    colonne: ['Gruppo'],
    mappatura: { Gruppo: 'Gruppo', Indice: '' }
});

test('Genera resta spento finche\' un campo non ha l\'associazione', () => {
    const { sezione, elementi } = pagina({ risposta: null });
    sezione.proposta = PROPOSTA();

    sezione.aggiornaGenera();
    assert.strictEqual(elementi['#btnGeneraOrdinamento'].disabled, true);

    sezione.proposta.mappatura.Indice = '%PROG%';
    sezione.aggiornaGenera();
    assert.strictEqual(elementi['#btnGeneraOrdinamento'].disabled, false);
});

test('Genera resta spento senza il file', () => {
    const { sezione, elementi } = pagina({ risposta: null, conFile: false });
    sezione.proposta = PROPOSTA();
    sezione.proposta.mappatura.Indice = '%NOW%';

    sezione.aggiornaGenera();

    assert.strictEqual(elementi['#btnGeneraOrdinamento'].disabled, true);
});

test('lo schema generato va nella sezione Source e non si salva', async () => {
    const { sezione, chiamate, editor, sourceAperti } = pagina({ risposta: { esito: true, jsoncode: '{"source":[]}', elementi: 3 } });
    sezione.source = { source: [{ Gruppo: 'A', Indice: 1 }] };
    sezione.proposta = PROPOSTA();
    sezione.proposta.mappatura.Indice = '%PROG%';

    await sezione.genera();

    assert.strictEqual(chiamate.length, 1);
    assert.strictEqual(chiamate[0].controller, 'MenaboSettings');
    assert.strictEqual(chiamate[0].indirizzo, 'generaOrdinamentoDaExcel');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(chiamate[0].parametri.mappatura)), { Gruppo: 'Gruppo', Indice: '%PROG%' });
    assert.strictEqual(chiamate[0].parametri.filename, 'ordinamento.xlsx');
    // nessuna chiamata di salvataggio: solo l'editor riempito e la sezione Source aperta
    assert.ok(!chiamate.some(c => c.indirizzo === 'salvaSourceJsonCode'));
    assert.deepStrictEqual(editor.valori, ['{"source":[]}']);
    assert.strictEqual(sourceAperti(), 1);
});

test('un errore di Istanta si mostra e la sezione Source non si tocca', async () => {
    const { sezione, editor, elementi, sourceAperti } = pagina({ risposta: { esito: false, error: 'Nel file manca la colonna GRUPPO (Gruppo).' } });
    sezione.source = { source: [{ Gruppo: 'A', Indice: 1 }] };
    sezione.proposta = PROPOSTA();
    sezione.proposta.mappatura.Indice = '%PROG%';

    await sezione.genera();

    assert.match(elementi['#esitoOrdinamentoExcel'].html, /manca la colonna GRUPPO/);
    assert.deepStrictEqual(editor.valori, []);
    assert.strictEqual(sourceAperti(), 0);
});

test('la tendina di ogni campo ha la voce Formula e la casella per scriverla', () => {
    const { sezione, elementi } = pagina({ risposta: null });
    sezione.proposta = PROPOSTA();

    sezione.disegnaMappatura();

    const html = elementi['#mappaturaOrdinamento'].html;
    assert.match(html, /<option value="__formula__">ƒ Formula…<\/option>/);
    assert.match(html, /class="form-control form-control-sm mt-1 txtFormula" data-campo="Indice"/);
    // l'aiuto spiega le colonne tra quadre, con le virgolette protette
    assert.match(html, /\[Food\]=&quot;X&quot;/);
    assert.match(html, /nome dato in Training/);
});

test('una formula conta solo se dopo l\'uguale c\'e\' qualcosa', () => {
    const { sezione, elementi } = pagina({ risposta: null });
    sezione.proposta = PROPOSTA();

    sezione.impostaFormula('Indice', '=');
    assert.strictEqual(elementi['#btnGeneraOrdinamento'].disabled, true);

    sezione.impostaFormula('Indice', '=SE([GRUPPO]="A";1;2)');
    assert.strictEqual(elementi['#btnGeneraOrdinamento'].disabled, false);
    assert.strictEqual(sezione.proposta.mappatura.Indice, '=SE([GRUPPO]="A";1;2)');
});

test('la formula parte verso Istanta nella mappatura, cosi\' com\'e\'', async () => {
    const { sezione, chiamate } = pagina({ risposta: { esito: true, jsoncode: '{"source":[]}', elementi: 1 } });
    sezione.source = { source: [{ Gruppo: 'A', Indice: 1 }] };
    sezione.proposta = PROPOSTA();
    sezione.impostaFormula('Indice', '=[GRUPPO]&"-1"');

    await sezione.genera();

    assert.strictEqual(chiamate[0].parametri.mappatura.Indice, '=[GRUPPO]&"-1"');
});

/* ---- sourceEditor.impostaValore ---- */

function editorSorgente() {
    const contesto = { console: { log() {}, error() {}, warn() {} }, require: { config() {} }, showLoading() {}, hideLoading() {} };
    vm.createContext(contesto);
    vm.runInContext(leggi('Istanta/wwwroot/js/sourceEditor.js') + '\nthis.ExternalSourceEditor = ExternalSourceEditor;', contesto);
    return new contesto.ExternalSourceEditor();
}

test('impostaValore sostituisce il testo dell\'editor aperto, o lo tiene per quando si apre', () => {
    const chiuso = editorSorgente();
    chiuso.impostaValore('{"lista":[]}');
    assert.strictEqual(chiuso.valoreIniziale, '{"lista":[]}');

    const aperto = editorSorgente();
    let valore = null;
    aperto.editorInstance = { setValue: (t) => { valore = t; } };
    aperto.impostaValore('{"lista":[1]}');
    assert.strictEqual(valore, '{"lista":[1]}');
});

test('la pagina Ordinamento ha la sezione Excel accanto a Visual e Source', () => {
    const vista = leggi('Istanta/Views/MenaboSettings/Ordinamento.cshtml');
    assert.match(vista, /id="aMenuExcel"/);
    assert.match(vista, /id="contentExcel"/);
    assert.match(vista, /id="fileOrdinamentoExcel"[^>]*accept="\.xls,\.xlsx"/);
    assert.match(vista, /function menuExcel\(\)[\s\S]*ordinamentoExcel\.apri\(\)/);
    // ordinamento.js lo carica il layout in asincrono: la classe si usa solo all'apertura della scheda,
    // altrimenti la vista va in errore prima e la tendina degli addestramenti resta vuota
    assert.match(vista, /let ordinamentoExcel = null;/);
    assert.match(vista, /function menuExcel\(\)[\s\S]*new OrdinamentoExcel\(\)[\s\S]*ordinamentoExcel\.apri\(\)/);
    assert.strictEqual((vista.match(/new OrdinamentoExcel\(\)/g) || []).length, 1);
    // passando a Visual o Source la sezione Excel si nasconde
    assert.match(vista, /function menuVisual\(\)[\s\S]*?contentExcel"\)\.style\.display = "none"/);
    assert.match(vista, /function menuSource\(\)[\s\S]*?contentExcel"\)\.style\.display = "none"/);
});
