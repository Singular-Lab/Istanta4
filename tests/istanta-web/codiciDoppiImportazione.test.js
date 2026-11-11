/*
 * TASK-f434bd2f: un'importazione con lo stesso codice piu' volte con la stessa etichetta, nello stesso canale
 * e nella stessa area, si ferma prima di salvare (attivita' in stato 8) e la pagina Tracciati mostra un
 * avviso bloccante in rosso: "Annulla" (verde, consigliato) scarta l'importazione, "Continua" (rosso) la
 * rilancia con ignoraDoppioni, che non chiede piu'.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Promo = require('../../Istanta/wwwroot/js/promo.js');

const radice = path.join(__dirname, '..', '..', 'Istanta');
const vista = fs.readFileSync(path.join(radice, 'Views', 'Tracciati', 'Index.cshtml'), 'utf8').replace(/\r/g, '');
const taskManager = fs.readFileSync(path.join(radice, 'wwwroot', 'js', 'taskManager.js'), 'utf8').replace(/\r/g, '');

test('il testo dice che la lista e\' sbagliata e raggruppa i codici per etichetta, canale e area', () => {
    const testo = Promo.testoAvvisoCodiciDoppi([
        { codice: '3191029', label: 'main', canale: 'UFI', area: 'B1' },
        { codice: '4000001', label: 'main', canale: 'UFI', area: 'B1' },
        { codice: '5000002', label: 'main', canale: 'TDM', area: 'A' }
    ]);

    assert.match(testo, /La lista è sbagliata/);
    assert.match(testo, /I prodotti <strong>3191029, 4000001<\/strong> appaiono più volte in lista con etichetta <strong>main<\/strong>, canale <strong>UFI<\/strong> e area <strong>B1<\/strong>/);
    assert.match(testo, /I prodotti <strong>5000002<\/strong> appaiono più volte in lista con etichetta <strong>main<\/strong>, canale <strong>TDM<\/strong> e area <strong>A<\/strong>/);
    assert.strictEqual((testo.match(/<li>/g) || []).length, 2);
});

test('i valori della lista non diventano HTML', () => {
    const testo = Promo.testoAvvisoCodiciDoppi([{ codice: '<b>1</b>', label: 'a&b', canale: 'UFI', area: 'B1' }]);

    assert.doesNotMatch(testo, /<b>1<\/b>/);
    assert.match(testo, /&lt;b&gt;1&lt;\/b&gt;/);
    assert.match(testo, /a&amp;b/);
});

test('Continua rilancia con ignoraDoppioni, la conferma normale resta com\'era', () => {
    assert.strictEqual(Promo.indirizzoConferma(12, true, false, true), 'attivita/confermaAttivitaByUtente/12/true/false?ignoraDoppioni=true');
    assert.strictEqual(Promo.indirizzoConferma(12, false, true, false), 'attivita/confermaAttivitaByUtente/12/false/true');
});

test('il modal e\' bloccante e rosso, Annulla verde e consigliato, Continua rosso', () => {
    const inizio = vista.indexOf('<div class="modal" id="AvvisoCodiciDoppi"');
    const modal = vista.substring(inizio, vista.indexOf('<div class="modal" id="ReportErrorsAttivita"'));

    assert.ok(inizio > 0);
    assert.match(modal, /data-bs-backdrop="static" data-bs-keyboard="false"/);
    assert.doesNotMatch(modal, /btn-close/);
    assert.match(modal, /<div class="modal-header bg-danger text-white">/);
    assert.match(modal, /<small class="text-success fw-bold">Consigliato<\/small>\s*<button type="button" class="btn btn-success" id="btnAnnullaCodiciDoppi">Annulla<\/button>/);
    assert.match(modal, /<button type="button" class="btn btn-danger" id="btnContinuaCodiciDoppi">Continua<\/button>/);
    assert.ok(modal.indexOf('btnAnnullaCodiciDoppi') < modal.indexOf('btnContinuaCodiciDoppi'));
});

test('la pagina reagisce all\'attivita\' ferma in stato 8', () => {
    assert.match(taskManager, /if \(attivita\.stato == 6 \|\| attivita\.stato == 7 \|\| attivita\.stato == 8 \|\| attivita\.stato == 9\) \{/);
});

/* ---------- Annulla e Continua, con una pagina e un server finti ---------- */

function conPaginaFinta(codici, prova) {
    const salvati = { $: global.$, Call: global.Call, hideLoading: global.hideLoading, showLoading: global.showLoading, taskManager: global.taskManager, console: console.error };
    const chiamate = [];
    const gestori = {};
    const stato = { modal: [], corpo: '', attributi: {}, badgeTolto: false };
    const elemento = (id) => {
        const api = {
            find: (sel) => elemento(sel),
            html: (h) => { stato.corpo = h; return api; },
            off: () => api,
            on: (evento, f) => { gestori[id] = f; return api; },
            modal: (azione) => { stato.modal.push(azione); return api; },
            attr: (nome, valore) => { if (valore === undefined) { return stato.attributi[nome]; } stato.attributi[nome] = valore; return api; },
            remove: () => { if (id === '#badgeCodiciDoppi') { stato.badgeTolto = true; } return api; },
            closest: () => api,
            val: () => '3',
            prop: () => api,
            css: () => api,
            parent: () => api,
            each: () => api,
            prepend: () => api
        };
        return api;
    };
    global.$ = (sel) => elemento(sel);
    global.hideLoading = () => { };
    global.showLoading = () => { };
    global.taskManager = { Add: () => { } };
    console.error = () => { };
    global.Call = {
        do: (ctrl, indirizzo, metodo, obj, me, ok) => {
            chiamate.push(ctrl + '/' + indirizzo);
            if (indirizzo.startsWith('codiciDoppiAttivita/')) { ok(codici, me); }
            else { ok({ esito: true }, me); }
        }
    };
    try {
        const pagina = Object.create(Promo.prototype);
        pagina.codaProcessi = {};
        prova({ pagina, chiamate, gestori, stato });
    }
    finally {
        global.$ = salvati.$; global.Call = salvati.Call; global.hideLoading = salvati.hideLoading; global.showLoading = salvati.showLoading; global.taskManager = salvati.taskManager; console.error = salvati.console;
    }
}

const DOPPI = [{ codice: '3191029', label: 'main', canale: 'UFI', area: 'B1' }];

test('l\'avviso legge i codici dell\'attivita\' e si apre', () => {
    conPaginaFinta(DOPPI, ({ pagina, chiamate, stato }) => {
        pagina.mostraAvvisoCodiciDoppi(42);

        assert.deepStrictEqual(chiamate, ['Tracciati/codiciDoppiAttivita/42']);
        assert.match(stato.corpo, /3191029/);
        assert.deepStrictEqual(stato.modal, ['show']);
    });
});

test('Annulla chiude l\'avviso e scarta l\'importazione', () => {
    conPaginaFinta(DOPPI, ({ pagina, chiamate, gestori, stato }) => {
        pagina.mostraAvvisoCodiciDoppi(42);
        gestori['#btnAnnullaCodiciDoppi']();

        assert.deepStrictEqual(stato.modal, ['show', 'hide']);
        assert.strictEqual(chiamate[1], 'api/attivita/scartaAttivitaByUtente/42');
        assert.strictEqual(chiamate.length, 2);
    });
});

test('Continua chiude l\'avviso e rilancia con la modalita\' della riga e ignoraDoppioni', () => {
    conPaginaFinta(DOPPI, ({ pagina, chiamate, gestori, stato }) => {
        pagina.mostraAvvisoCodiciDoppi(42);
        gestori['#btnContinuaCodiciDoppi']();

        assert.deepStrictEqual(stato.modal, ['show', 'hide']);
        //Nella riga e' scelto "Salva e fai report" (3).
        assert.strictEqual(chiamate[1], 'api/attivita/confermaAttivitaByUtente/42/true/true?ignoraDoppioni=true');
        assert.strictEqual(stato.attributi.codici_doppi, '0');
        assert.ok(stato.badgeTolto);
    });
});

test('Importa su una riga ferma per codici doppi apre l\'avviso invece di rilanciare', () => {
    conPaginaFinta(DOPPI, ({ pagina, chiamate, stato }) => {
        stato.attributi.codici_doppi = '1';
        pagina.eseguiAttivitaPending(42, global.$('#btnAttivitaImport'));

        assert.deepStrictEqual(chiamate, ['Tracciati/codiciDoppiAttivita/42']);
        assert.deepStrictEqual(stato.modal, ['show']);
    });
});

test('se l\'attivita\' non e\' piu\' ferma per codici doppi, Importa rilancia senza avviso', () => {
    conPaginaFinta([], ({ pagina, chiamate, stato }) => {
        stato.attributi.codici_doppi = '1';
        pagina.eseguiAttivitaPending(42, global.$('#btnAttivitaImport'));

        assert.deepStrictEqual(chiamate, ['Tracciati/codiciDoppiAttivita/42', 'api/attivita/confermaAttivitaByUtente/42/true/true?ignoraDoppioni=true']);
        assert.deepStrictEqual(stato.modal, []);
    });
});
