/*
 * TASK-10858197: la pagina di sincronizzazione delle foto.
 *
 * - Un caricamento non riuscito si dice e non lancia la scansione: prima UploadFileZip rispondeva con
 *   un errore che la pagina ignorava, e la scansione di un pacchetto inesistente restava in attesa.
 * - Una scansione non riuscita non lancia il sync diretto.
 * - Con "Esegui Sync diretto" il pulsante si chiama "Scan & Sync".
 * - Il report ha la colonna "Dopo il sync", nascondibile, con l'esito chiesto a SyncFoto/AnteprimaSync.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SyncFoto = require('../../Istanta/wwwroot/js/syncfoto.js');

const radice = path.join(__dirname, '..', '..', 'Istanta');
const sorgente = fs.readFileSync(path.join(radice, 'wwwroot', 'js', 'syncfoto.js'), 'utf8').replace(/\r/g, '');
const vista = fs.readFileSync(path.join(radice, 'Views', 'SyncFoto', 'Index.cshtml'), 'utf8').replace(/\r/g, '');

test('il pulsante di avvio si chiama "Scan & Sync" con il sync diretto, "Scan" senza', () => {
    assert.strictEqual(SyncFoto.testoPulsanteScan(true), 'Scan & Sync');
    assert.strictEqual(SyncFoto.testoPulsanteScan(false), 'Scan');
    //All'apertura e a ogni clic sulla spunta.
    assert.match(vista, /\$\("#btnCreaZip"\)\.text\(SyncFoto\.testoPulsanteScan\(\$\("#ChBypassCheck"\)\.prop\("checked"\)\)\);/);
    assert.match(vista, /\$\("#ChBypassCheck"\)\.on\("click", function\(\)\{[\s\S]*?\$\("#btnCreaZip"\)\.text\(SyncFoto\.testoPulsanteScan\(\$\(this\)\.prop\('checked'\)\)\);/);
});

test('un caricamento con errore, o senza il pacchetto salvato, si dice', () => {
    assert.strictEqual(SyncFoto.erroreDelCaricamento({ filename: '09_11_2026_x', error: '' }), null);
    assert.strictEqual(SyncFoto.erroreDelCaricamento({ filename: '', error: 'Non è stato possibile salvare il pacchetto sul server' }),
        'Caricamento del pacchetto non riuscito: Non è stato possibile salvare il pacchetto sul server');
    assert.match(SyncFoto.erroreDelCaricamento({ filename: '', error: '' }), /non ha restituito il pacchetto salvato/);
    assert.match(SyncFoto.erroreDelCaricamento(null), /risposta non valida/);
});

test('con un caricamento non riuscito la scansione non parte', () => {
    const onload = sorgente.substring(sorgente.indexOf('var obj = JSON.parse(xhr.response);'), sorgente.indexOf('fileImpacchettato.response = obj;'));
    assert.match(onload, /let erroreCaricamento = SyncFoto\.erroreDelCaricamento\(obj\);\s*if \(erroreCaricamento != null\) \{[\s\S]*?hideLoading\(\);\s*mostraMessaggio\(erroreCaricamento, "danger"\);\s*return;/);
});

test('con una scansione non riuscita il sync diretto non parte', () => {
    assert.match(sorgente, /mostraMessaggio\(result\.error, "danger"\);\s*\/\/TASK-10858197[^\n]*\n\s*hideLoading\(\);\s*return;\s*\}\s*if \(me\.firstJob\) \{/);
});

test('all\'anteprima vanno le righe nell\'ordine, con i soli campi che servono e se partiranno', () => {
    const righe = [
        { rec: { filename: 'a.jpeg', stato: 11, id: 6, idArticolo: 1633, tipo: 0, md5: 'x', details: 'lungo' }, sincronizza: true },
        { rec: { filename: 'a.png', stato: 8, id: 7, idArticolo: 1633, tipo: 0 }, sincronizza: false }
    ];
    assert.deepStrictEqual(SyncFoto.fotoPerAnteprima(righe), [
        { filename: 'a.jpeg', stato: 11, id: 6, idArticolo: 1633, tipo: 0, sincronizza: true },
        { filename: 'a.png', stato: 8, id: 7, idArticolo: 1633, tipo: 0, sincronizza: false }
    ]);
});

test('l\'anteprima si chiede dopo il report e quando cambiano spunte, sovrascrittura e filtro', () => {
    assert.match(sorgente, /SyncFoto\.applicaColonnaDopoSync\(SyncFoto\.colonnaDopoSyncVisibile\(\)\);\s*me\.aggiornaAnteprima\(true\);/);
    for (const evento of ['#chAll', '#ChOverwrite', '#cmbFiltroStato']) {
        const blocco = vista.substring(vista.indexOf(`$("${evento}").on("change"`));
        assert.match(blocco.substring(0, blocco.indexOf('});')), /syncInstance\.aggiornaAnteprima\(\);/, evento);
    }
    assert.match(vista, /\$\("#tblResult"\)\.on\("change", "#chSync", function\(\)\{\s*syncInstance\.aggiornaAnteprima\(\);/);
    //Come startSyncZip: parte la riga selezionata, spuntata, visibile, abilitata e non ancora sincronizzata.
    const anteprima = sorgente.substring(sorgente.indexOf('    aggiornaAnteprima(subito = false) {'), sorgente.indexOf('    consolidaSelezione(files, fine) {'));
    assert.match(anteprima, /riga\.attr\("selezionato"\) == "1" && riga\.attr\("synced"\) != "1"\s*&& riga\.css\("display"\) != "none" && ch\.is\(":checked"\) && !ch\.is\(":disabled"\)/);
    //TASK-c0dd1af9: in JSON, come form oltre le 1024 foto il server non leggeva l'elenco.
    assert.match(anteprima, /Call\.doWithLargePayload\("SyncFoto", "AnteprimaSync", "PUT", \{ files: SyncFoto\.fotoPerAnteprima\(righe\) \}/);
    assert.match(anteprima, /me\._timerAnteprima = setTimeout\(esegui, 300\);/);
});

test('il report ha le colonne "Prima del sync" e "Dopo il sync", e la seconda si nasconde', () => {
    assert.match(vista, /<th scope="col" style="width:25%;">Prima del sync<\/th>\s*<th scope="col" class="colDopoSync" style="width:20%;">Dopo il sync<\/th>/);
    assert.match(vista, /<td class="colDopoSync"><span id="lab_dopo"><\/span><\/td>/);

    const salvati = { $: global.$, localStorage: global.localStorage };
    const css = []; const testi = []; const memoria = {};
    global.$ = (sel) => ({
        css: (k, v) => css.push([sel, k, v]),
        text: (t) => testi.push([sel, t])
    });
    global.localStorage = { getItem: (k) => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = v; } };
    try {
        assert.strictEqual(SyncFoto.colonnaDopoSyncVisibile(), true);
        SyncFoto.mostraColonnaDopoSync(false);
        assert.deepStrictEqual(css.pop(), ['.colDopoSync', 'display', 'none']);
        assert.deepStrictEqual(testi.pop(), ['#btnColonnaDopoSync', 'Mostra esito dopo il sync']);
        assert.strictEqual(SyncFoto.colonnaDopoSyncVisibile(), false);
        SyncFoto.mostraColonnaDopoSync(true);
        assert.deepStrictEqual(css.pop(), ['.colDopoSync', 'display', '']);
        assert.strictEqual(SyncFoto.colonnaDopoSyncVisibile(), true);

        //Senza memoria del browser la colonna si vede.
        global.localStorage = { getItem: () => { throw new Error('bloccata'); }, setItem: () => { throw new Error('bloccata'); } };
        assert.strictEqual(SyncFoto.colonnaDopoSyncVisibile(), true);
        SyncFoto.mostraColonnaDopoSync(false);
    }
    finally {
        global.$ = salvati.$;
        if (salvati.localStorage === undefined) { delete global.localStorage; } else { global.localStorage = salvati.localStorage; }
    }
});

test('i comandi del report stanno insieme a destra, alla stessa altezza', () => {
    const intestazione = vista.substring(vista.indexOf('<div class="row align-items-center" id="headerResult"'), vista.indexOf('<div class="row" id="countResult"'));
    const comandi = intestazione.substring(intestazione.indexOf('<div class="col d-flex justify-content-end align-items-center gap-2 p-2">'));
    assert.ok(comandi.length > 0 && comandi.indexOf('justify-content-end') >= 0, 'il gruppo a destra');
    for (const id of ['cmbFiltroStato', 'btnColonnaDopoSync', 'btnDownloadPerStato', 'btnDownloadPerPP']) {
        assert.ok(comandi.indexOf(`id="${id}"`) >= 0, id + ' nel gruppo a destra');
    }
    assert.match(comandi, /<select id="cmbFiltroStato" class="form-select form-select-sm w-auto">/);
    assert.match(comandi, /<button id="btnDownloadPerStato" class="btn btn-sm btn-primary">/);
});

test('TASK-c0dd1af9: all\'anteprima vanno anche 1500 foto, e un id mancante parte come 0', () => {
    const righe = [];
    for (let i = 0; i < 1500; i++) {
        righe.push({ rec: { filename: `${7000000 + i}_1_T1.psd`, stato: 6, id: i == 0 ? null : 0, idArticolo: 15000 + i, tipo: 1 }, sincronizza: true });
    }
    const foto = SyncFoto.fotoPerAnteprima(righe);
    assert.strictEqual(foto.length, 1500);
    assert.deepStrictEqual(foto[0], { filename: '7000000_1_T1.psd', stato: 6, id: 0, idArticolo: 15000, tipo: 1, sincronizza: true });
});
