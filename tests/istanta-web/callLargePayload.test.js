/*
 * TASK-c0dd1af9: Call.doWithLargePayload manda i parametri in JSON nel corpo. Lo usano anche il sync foto
 * per AnteprimaSync e ConsolidaSelezione: come form, oltre le 1024 foto il server non leggeva l'elenco.
 *
 * - Con callbackError un errore HTTP o di rete arriva li', con { info, error, message } come in Call.do.
 * - Senza callbackError arriva a callback come { info, error: "unknown" }, come sempre per i chiamanti di oggi.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const Call = require('../../Istanta/wwwroot/js/call.js');

function conAjaxFinto(risposta, prova) {
    const salvati = { $: global.$, radice: global.getWebAppRootFolder, log: console.log };
    const richieste = [];
    global.getWebAppRootFolder = () => '';
    global.$ = { ajax(opzioni) { richieste.push(opzioni); risposta(opzioni); } };
    console.log = () => { };
    try {
        prova(richieste);
    }
    finally {
        global.$ = salvati.$;
        global.getWebAppRootFolder = salvati.radice;
        console.log = salvati.log;
    }
}

test('i parametri partono in JSON nel corpo, anche con 1500 elementi', () => {
    conAjaxFinto(o => o.success({ esiti: [] }), (richieste) => {
        const files = [];
        for (let i = 0; i < 1500; i++) {
            files.push({ filename: `${i}.psd`, stato: 6, id: 0, idArticolo: i + 1, tipo: 1 });
        }
        let ricevuto = null;

        Call.doWithLargePayload('SyncFoto', 'ConsolidaSelezione', 'PUT', { files }, null, r => { ricevuto = r; });

        assert.strictEqual(richieste.length, 1);
        assert.strictEqual(richieste[0].url, '/SyncFoto/ConsolidaSelezione');
        assert.strictEqual(richieste[0].type, 'PUT');
        assert.match(richieste[0].contentType, /^application\/json/);
        assert.strictEqual(JSON.parse(richieste[0].data).files.length, 1500);
        assert.deepStrictEqual(ricevuto, { esiti: [] });
    });
});

test('con callbackError un errore del server arriva li\', con il messaggio del server', () => {
    conAjaxFinto(o => o.error({ status: 500, responseJSON: { error: 'Selezione delle foto in uscita non riuscita' } }, 'error'), () => {
        let ok = 0;
        let errore = null;

        Call.doWithLargePayload('SyncFoto', 'ConsolidaSelezione', 'PUT', { files: [] }, null, () => ok++, e => { errore = e; });

        assert.strictEqual(ok, 0);
        assert.strictEqual(errore.error, 'error');
        assert.strictEqual(errore.message, 'Selezione delle foto in uscita non riuscita');
        assert.strictEqual(errore.info.status, 500);
    });
});

test('con callbackError un errore senza messaggio dice il codice, o la connessione', () => {
    conAjaxFinto(o => o.error({ status: 500 }, 'error'), () => {
        let errore = null;
        Call.doWithLargePayload('SyncFoto', 'AnteprimaSync', 'PUT', { files: [] }, null, () => { }, e => { errore = e; });
        assert.strictEqual(errore.message, "Errore 500, impossibile portare a termine l'operazione!");
    });
    conAjaxFinto(o => o.error({ status: 0 }, 'error'), () => {
        let errore = null;
        Call.doWithLargePayload('SyncFoto', 'AnteprimaSync', 'PUT', { files: [] }, null, () => { }, e => { errore = e; });
        assert.match(errore.message, /problemi con la connessione/);
    });
});

test('senza callbackError l\'errore arriva a callback come sempre', () => {
    conAjaxFinto(o => o.error({ status: 500 }, 'error'), () => {
        let ricevuto = null;

        Call.doWithLargePayload('PromoBackup', 'crea', 'PUT', { idPromo: 1 }, null, r => { ricevuto = r; });

        assert.strictEqual(ricevuto.error, 'unknown');
        assert.strictEqual(ricevuto.info.status, 500);
    });
});
