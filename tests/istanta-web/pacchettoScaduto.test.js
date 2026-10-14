/*
 * Pulizia estrazioni: riscaricare dal registro delle sincronizzazioni un pacchetto gia' eliminato.
 *
 * La pulizia notturna elimina i pacchetti foto dopo il periodo di conservazione, e
 * SyncFoto/downloadPacchettoFoto risponde 410 { error: "pacchetto_scaduto" }. La pagina deve dire
 * semplicemente che il pacchetto e' scaduto: niente dettagli tecnici e niente "Confermi download
 * del file undefined?", che era quello che succedeva senza gestione dell'errore.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const SyncFoto = require('../../Istanta/wwwroot/js/syncfoto.js');

/* Call.do passa alla callback d'errore il codice del server in message (call.js). */
const SCADUTO = { error: 'error', message: 'pacchetto_scaduto' };

test('il pacchetto scaduto ha il suo messaggio', () => {
    const testo = SyncFoto.messaggioDownloadNonRiuscito(SCADUTO);

    assert.match(testo, /scaduto/);
    assert.match(testo, /non si può più scaricare/);
});

test('gli altri errori non mostrano i dettagli tecnici', () => {
    const erroreOriginale = console.error;
    console.error = () => { };
    try {
        const testo = SyncFoto.messaggioDownloadNonRiuscito({
            error: 'error',
            message: 'System.IO.FileNotFoundException: Could not find file /data/estrazioni/x/1.jpg\n   at ...'
        });

        assert.doesNotMatch(testo, /Exception|estrazioni/);
        assert.doesNotMatch(testo, /scaduto/);
    } finally {
        console.error = erroreOriginale;
    }
});

/* ---- dal pulsante del registro ---- */

function registroFinto() {
    const record = {
        css: () => 'flex',
        attr: (nome) => (nome === 'ziporigindir' ? '01_09_2026_10_00_00_aaa' : undefined),
        find: () => ({ text: () => '1234.jpg' })
    };
    const contenitore = { find: () => ({ each(fn) { fn.call(record); } }) };
    const corpo = { find: () => contenitore };
    const voce = { attr: () => '01_09_2026_10_00_00_aaa' };
    const riga = { find: () => ({ val: () => '0' }) };

    return {
        closest(selettore) {
            if (selettore === '.accordion-body') { return corpo; }
            if (selettore === '.accordion-item') { return voce; }
            return riga;
        }
    };
}

function conPagina(rispostaServer, prova) {
    const visto = { alert: [], confirm: [], chiamate: [] };
    const globali = {
        $: (x) => x,
        showLoading: () => { },
        hideLoading: () => { visto.nascosto = true; },
        alert: (t) => visto.alert.push(t),
        confirm: (t) => { visto.confirm.push(t); return false; },
        Call: {
            do(controller, indirizzo, metodo, parametri, sender, ok, ko) {
                visto.chiamate.push({ controller, indirizzo, parametri });
                rispostaServer(ok, ko, sender);
            }
        }
    };
    const prima = {};
    for (const k of Object.keys(globali)) { prima[k] = global[k]; global[k] = globali[k]; }
    try {
        prova(visto);
    } finally {
        for (const k of Object.keys(prima)) { global[k] = prima[k]; }
    }
    return visto;
}

test('dal registro, un pacchetto scaduto dice solo che e\' scaduto e non propone il download', () => {
    conPagina((ok, ko) => ko(SCADUTO), (visto) => {
        SyncFoto.prototype.downloadFilesDaRegistro.call({}, registroFinto());

        assert.strictEqual(visto.chiamate.length, 1);
        assert.strictEqual(visto.chiamate[0].indirizzo, 'downloadPacchettoFoto');
        assert.deepStrictEqual(visto.chiamate[0].parametri.files,
            [{ zipDirOrigin: '01_09_2026_10_00_00_aaa', filename: '1234.jpg' }]);
        assert.deepStrictEqual(visto.confirm, []);
        assert.strictEqual(visto.alert.length, 1);
        assert.match(visto.alert[0], /scaduto/);
        assert.ok(visto.nascosto, 'il caricamento deve chiudersi');
    });
});

test('dal registro, un pacchetto ancora presente propone il download come prima', () => {
    conPagina((ok, ko, sender) => ok({ fileName: 'pacchetto_TUTTE.zip', url: '/exported_files/pacchetto_TUTTE.zip' }, sender), (visto) => {
        SyncFoto.prototype.downloadFilesDaRegistro.call({ downloadFile: () => { } }, registroFinto());

        assert.deepStrictEqual(visto.confirm, ['Confermi download del file pacchetto_TUTTE.zip?']);
    });
});
