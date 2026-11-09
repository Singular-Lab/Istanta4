/*
 * I20-1212: a sync finito la pagina chiede a Istanta di scegliere la foto in uscita di ogni articolo
 * (SyncFoto/ConsolidaSelezione) sul pacchetto intero.
 *
 * La pagina sincronizza solo le righe selezionabili (mai le "gia' selezionata") e a blocchi di 20:
 * nessun blocco vede tutte le foto di un articolo. L'elenco della scansione segue lo stato dei blocchi,
 * e alla fine parte una chiamata sola con i soli campi che servono.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const SyncFoto = require('../../Istanta/wwwroot/js/syncfoto.js');

const SCANSIONE = () => [
    { filename: '1001297_1_AD.jpeg', stato: 11, id: 6, idArticolo: 1633, tipo: 0, md5: 'a', idRecView: '1_a', details: 'lungo' },
    { filename: '1001297_1_T5.png', stato: 11, id: 7, idArticolo: 1633, tipo: 0, md5: 'b', idRecView: '2_b' },
    { filename: '1001297_1_T5.psd', stato: 8, id: 8, idArticolo: 1633, tipo: 0, md5: 'c', idRecView: '3_c' },
    { filename: 'sconosciuta.jpg', stato: 9, id: 0, idArticolo: 0, tipo: 0, md5: 'd', idRecView: '4_d' }
];

test('a ConsolidaSelezione vanno le sole foto abbinate a un articolo, nell\'ordine, con i soli campi che servono', () => {
    assert.deepStrictEqual(SyncFoto.fileDaConsolidare(SCANSIONE()), [
        { filename: '1001297_1_AD.jpeg', stato: 11, id: 6, idArticolo: 1633, tipo: 0 },
        { filename: '1001297_1_T5.png', stato: 11, id: 7, idArticolo: 1633, tipo: 0 },
        { filename: '1001297_1_T5.psd', stato: 8, id: 8, idArticolo: 1633, tipo: 0 }
    ]);
    assert.deepStrictEqual(SyncFoto.fileDaConsolidare(null), []);
});

test('lo stato e l\'id dati da un blocco tornano sulla riga della scansione', () => {
    const scansione = SCANSIONE();
    //Una foto nuova: il server le da' l'id della riga creata.
    scansione[1].stato = 6; scansione[1].id = 0;

    assert.strictEqual(SyncFoto.aggiornaFileDellaScansione(scansione, { idRecView: '2_b', stato: 1, id: 42 }), true);
    assert.strictEqual(scansione[1].stato, 1);
    assert.strictEqual(scansione[1].id, 42);
    assert.strictEqual(SyncFoto.aggiornaFileDellaScansione(scansione, { idRecView: 'nessuna', stato: 1, id: 1 }), false);
});

function conPaginaFinta(prova) {
    const salvati = { Call: global.Call, showLoading: global.showLoading, mostraMessaggio: global.mostraMessaggio, console: console.error };
    const chiamate = [];
    const messaggi = [];
    let risposta = 'ok';
    global.Call = { do: (ctrl, azione, metodo, obj, me, ok, ko) => { chiamate.push({ ctrl, azione, metodo, obj }); risposta === 'ok' ? ok({ consolidate: 1 }) : ko({ info: { status: 500 } }); } };
    global.showLoading = () => { };
    global.mostraMessaggio = (testo, tipo) => messaggi.push({ testo, tipo });
    console.error = () => { };
    try {
        prova({ chiamate, messaggi, fallisci: () => { risposta = 'ko'; } });
    }
    finally {
        global.Call = salvati.Call; global.showLoading = salvati.showLoading; global.mostraMessaggio = salvati.mostraMessaggio; console.error = salvati.console;
    }
}

test('a fine sync parte una chiamata sola a ConsolidaSelezione, poi la fine della pagina', () => {
    conPaginaFinta(({ chiamate, messaggi }) => {
        const pagina = Object.create(SyncFoto.prototype);
        let finita = 0;

        pagina.consolidaSelezione(SCANSIONE(), () => finita++);

        assert.strictEqual(chiamate.length, 1);
        assert.deepStrictEqual([chiamate[0].ctrl, chiamate[0].azione, chiamate[0].metodo], ['SyncFoto', 'ConsolidaSelezione', 'PUT']);
        assert.strictEqual(chiamate[0].obj.files.length, 3);
        assert.strictEqual(finita, 1);
        assert.deepStrictEqual(messaggi, []);
    });
});

test('se ConsolidaSelezione non riesce la pagina finisce lo stesso e lo dice', () => {
    conPaginaFinta(({ messaggi, fallisci }) => {
        fallisci();
        const pagina = Object.create(SyncFoto.prototype);
        let finita = 0;

        pagina.consolidaSelezione(SCANSIONE(), () => finita++);

        assert.strictEqual(finita, 1);
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /Foto sincronizzate, ma non è stato possibile scegliere la foto in uscita/);
    });
});

test('senza foto abbinate a un articolo non si chiama il server', () => {
    conPaginaFinta(({ chiamate }) => {
        const pagina = Object.create(SyncFoto.prototype);
        let finita = 0;

        pagina.consolidaSelezione([{ filename: 'x.jpg', stato: 9, idArticolo: 0 }], () => finita++);

        assert.strictEqual(chiamate.length, 0);
        assert.strictEqual(finita, 1);
    });
});

test('syncZip, finiti i blocchi, consolida l\'elenco della scansione e ogni blocco lo aggiorna', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'js', 'syncfoto.js'), 'utf8').replace(/\r/g, '');
    const syncZip = sorgente.substring(sorgente.indexOf('    syncZip(from, count) {'), sorgente.indexOf('    consolidaSelezione(files, fine) {'));

    assert.match(syncZip, /SyncFoto\.aggiornaFileDellaScansione\(me\.syncOp\.files, item\);/);
    assert.match(syncZip, /this\.consolidaSelezione\(this\.syncOp\.files, \(\) => this\.fineSync\(\)\);/);
});
