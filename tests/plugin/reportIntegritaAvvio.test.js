/*
 * I20-981 (Lotto 1): le regole di avvio del Report Integrita'.
 *
 * Il difetto segnalato era che, quando la lista va scaricata, il report non parte piu'.
 * La sequenza vera vive in indexNew.js e non si carica sotto Node; qui si verificano le
 * decisioni che la guidano, che prima stavano inline nel gestore del bottone.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const avvio = require('../../plugin/reportIntegritaAvvio');

const adesso = new Date(2026, 8, 21, 12, 0, 0); //21/09/2026 12:00:00

test('la data italiana scritta dal plugin si rilegge', () => {
    const data = avvio.leggiDataItaliana('21/09/2026, 09:20:33');

    assert.notStrictEqual(data, null);
    assert.strictEqual(data.getFullYear(), 2026);
    assert.strictEqual(data.getMonth(), 8);
    assert.strictEqual(data.getDate(), 21);
    assert.strictEqual(data.getHours(), 9);
    assert.strictEqual(data.getMinutes(), 20);
    assert.strictEqual(data.getSeconds(), 33);

    //Senza virgola, come la scrivono alcuni runtime.
    assert.notStrictEqual(avvio.leggiDataItaliana('21/09/2026 09:20:33'), null);
});

test('una data non leggibile non viene inventata', () => {
    assert.strictEqual(avvio.leggiDataItaliana(null), null);
    assert.strictEqual(avvio.leggiDataItaliana(''), null);
    assert.strictEqual(avvio.leggiDataItaliana('Mai scaricato'), null);
    assert.strictEqual(avvio.leggiDataItaliana('21/09/26, 09:20:33'), null, 'anno a due cifre');
    //Date farebbe scorrere il 31 febbraio al primo marzo.
    assert.strictEqual(avvio.leggiDataItaliana('31/02/2026, 10:00:00'), null);
});

test('la lista e\' recente solo dentro l\'ora', () => {
    assert.strictEqual(avvio.listaERecente('21/09/2026, 11:30:00', adesso), true);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 11:00:01', adesso), true);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 10:59:00', adesso), false);
    assert.strictEqual(avvio.listaERecente('20/09/2026, 11:30:00', adesso), false);
});

test('una lista senza data o con data nel futuro si riscarica', () => {
    //Il lato sicuro: meglio un download in piu' che un confronto su una lista di eta' ignota.
    assert.strictEqual(avvio.listaERecente(null, adesso), false);
    assert.strictEqual(avvio.listaERecente('Mai scaricato', adesso), false);
    assert.strictEqual(avvio.listaERecente('21/09/2026, 13:00:00', adesso), false);
});

test('il report esistente si chiede solo entro le quattro ore', () => {
    const dueOreFa = new Date(2026, 8, 21, 10, 0, 0).toISOString();
    const treOreFa = new Date(2026, 8, 21, 9, 0, 0).toISOString();
    const cinqueOreFa = new Date(2026, 8, 21, 7, 0, 0).toISOString();

    const recente = avvio.decidiReportEsistente(new Date(2026, 8, 21, 11, 30, 0).toISOString(), adesso);
    assert.strictEqual(recente.chiedi, true);
    assert.strictEqual(recente.vecchio, false);

    //Esattamente due ore: si chiede ancora senza evidenziare.
    assert.deepStrictEqual(
        { chiedi: avvio.decidiReportEsistente(dueOreFa, adesso).chiedi, vecchio: avvio.decidiReportEsistente(dueOreFa, adesso).vecchio },
        { chiedi: true, vecchio: false });

    const vecchio = avvio.decidiReportEsistente(treOreFa, adesso);
    assert.strictEqual(vecchio.chiedi, true);
    assert.strictEqual(vecchio.vecchio, true, 'oltre due ore la data va in evidenza');

    const scaduto = avvio.decidiReportEsistente(cinqueOreFa, adesso);
    assert.strictEqual(scaduto.chiedi, false, 'oltre quattro ore si rifa senza chiedere');
});

test('un report senza data valida non blocca l\'operatore', () => {
    assert.strictEqual(avvio.decidiReportEsistente(null, adesso).chiedi, false);
    assert.strictEqual(avvio.decidiReportEsistente('', adesso).chiedi, false);
    assert.strictEqual(avvio.decidiReportEsistente('non una data', adesso).chiedi, false);
});

test('il range di pagine tiene solo i nomi numerici', () => {
    assert.strictEqual(avvio.componiRangePagine(['1', '2', '3']), '1,2,3');
    assert.strictEqual(avvio.componiRangePagine(['I', '1', 'Copertina', '2']), '1,2');
    assert.strictEqual(avvio.componiRangePagine([]), '');
    assert.strictEqual(avvio.componiRangePagine(null), '');
});

test('il report si chiude quando cambia il documento sotto', () => {
    const doc = '/Volumi/Lavori/vol_21-05-26.indd';

    assert.strictEqual(avvio.deveChiudereReport(doc, doc), false);
    assert.strictEqual(avvio.deveChiudereReport(doc, '/Volumi/Lavori/altro.indd'), true);
    //Nessun documento aperto: il report non si puo' piu' verificare, quindi si chiude.
    assert.strictEqual(avvio.deveChiudereReport(doc, null), true);
    assert.strictEqual(avvio.deveChiudereReport(doc, ''), true);
    //Se non sappiamo su cosa e' nato, non si chiude niente.
    assert.strictEqual(avvio.deveChiudereReport(null, doc), false);
    assert.strictEqual(avvio.deveChiudereReport('', doc), false);
});

test('dopo la scheda il record torna dove gli spetta', () => {
    //La stessa classificazione con cui il report nasce: un record ricontrollato e uno appena
    //analizzato devono finire nello stesso posto a parita' di esito.
    assert.strictEqual(
        avvio.categoriaRecordRicontrollato({ differenze: [], errors: [] }, false), 'recordGiusti');
    assert.strictEqual(
        avvio.categoriaRecordRicontrollato({ differenze: [{ label: 'Descrizione' }], errors: [] }, false), 'recordCambiati');
    assert.strictEqual(
        avvio.categoriaRecordRicontrollato({ differenze: [], errors: ['rotto'] }, false), 'recordConErrori');
    //Un box duplicato resta una segnalazione anche quando il resto e' a posto.
    assert.strictEqual(
        avvio.categoriaRecordRicontrollato({ differenze: [], errors: [] }, true), 'recordCambiati');
});

test('il box che non c\'e\' piu\' fa tornare la referenza fra le nuove', () => {
    //I nuovi si calcolano per differenza da chi nel report c'e' gia': basta che il record esca
    //dal report perche' la referenza ricompaia fra le nuove.
    const eliminato = avvio.esitoChiusuraScheda({ boxPresente: false, preAnalisi: null });
    assert.strictEqual(eliminato.azione, 'rimuovi');

    //Senza preanalisi non sappiamo niente di nuovo: dichiarare risolto quello che non abbiamo
    //controllato sarebbe peggio che lasciare il report com'era.
    const nonRicontrollato = avvio.esitoChiusuraScheda({ boxPresente: true, preAnalisi: null });
    assert.strictEqual(nonRicontrollato.azione, 'invariato');

    const risolto = avvio.esitoChiusuraScheda({
        boxPresente: true,
        preAnalisi: { differenze: [], errors: [] }
    });
    assert.strictEqual(risolto.azione, 'sposta');
    assert.strictEqual(risolto.categoria, 'recordGiusti');
});

test('le differenze di confronto sopravvivono al ricontrollo del box', () => {
    const record = {
        preAnalisi: {
            differenze: [
                { label: 'Descrizione', difference: 'vecchia -> nuova' },
                { label: 'tema', difference: 'Pasqua → Natale', origine: 'confronto' }
            ]
        }
    };

    //Il confronto guarda il dato della lista, non il box: il ricontrollo del box non lo puo'
    //vedere, e quindi va riportato com'era.
    const confronto = avvio.differenzeDiConfronto(record);
    assert.strictEqual(confronto.length, 1);
    assert.strictEqual(confronto[0].label, 'tema');

    const unite = avvio.differenzeDopoRicontrollo(
        [{ label: 'Foto', difference: 'mancante' }], confronto, null);

    assert.deepStrictEqual(unite.map(d => d.label), ['Foto', 'tema']);

    //Le vecchie segnalazioni di confronto non devono entrare due volte se arrivano gia' fra
    //quelle di integrita'.
    const senzaDoppioni = avvio.differenzeDopoRicontrollo(
        record.preAnalisi.differenze, confronto, null);
    assert.deepStrictEqual(senzaDoppioni.map(d => d.label), ['Descrizione', 'tema']);

    //Il duplicato si riscrive in fondo, come alla costruzione del report.
    const conDuplicato = avvio.differenzeDopoRicontrollo([], [], { index: 2, total: 3 });
    assert.strictEqual(conDuplicato.length, 1);
    assert.strictEqual(conDuplicato[0].label, 'Duplicato');
    assert.match(conDuplicato[0].difference, /istanza 2 di 3/);
});

test('il dato riletto dal server prende il posto di quello in lista', () => {
    const lista = [
        { idRec: 11, label: 'riga di lista', recordInTracciato: { 'Referenza.Codice': 'A', descr: 'vecchia' } },
        { idRec: 22, recordInTracciato: { 'Referenza.Codice': 'B', descr: 'altra' } }
    ];

    const esito = avvio.sostituisciRecordNellaLista(lista, [
        { idRec: 11, recordInTracciato: { 'Referenza.Codice': 'A', descr: 'nuova' } }
    ]);

    assert.strictEqual(esito.sostituiti, 1);
    assert.strictEqual(esito.records[0].recordInTracciato.descr, 'nuova');
    //La scheda non restituisce tutte le chiavi che la lista ha: quelle non si perdono.
    assert.strictEqual(esito.records[0].label, 'riga di lista');
    //Gli altri record non si toccano.
    assert.strictEqual(esito.records[1].recordInTracciato.descr, 'altra');

    //Senza idRec ci si aggancia al codice della referenza.
    const perCodice = avvio.sostituisciRecordNellaLista(
        [{ recordInTracciato: { 'Referenza.Codice': 'C', descr: 'vecchia' } }],
        [{ recordInTracciato: { 'Referenza.Codice': 'C', descr: 'nuova' } }]);
    assert.strictEqual(perCodice.sostituiti, 1);

    //Un record che nella lista non c'e' non si aggiunge: e' la lista a dire quali referenze
    //sono nel kit, e non e' questo il posto per cambiarlo.
    const estraneo = avvio.sostituisciRecordNellaLista(lista, [
        { idRec: 99, recordInTracciato: { 'Referenza.Codice': 'Z' } }
    ]);
    assert.strictEqual(estraneo.sostituiti, 0);
    assert.strictEqual(estraneo.records.length, 2);
});

test('il ricontrollo non tocca il report se non ha potuto confrontare', () => {
    //La preanalisi non rilancia: in caso di eccezione mette il messaggio negli errori e torna
    //le differenze raccolte fino a li', che possono essere zero. Quello zero non e' la prova
    //che le segnalazioni siano risolte, ed e' il caso che si presenta proprio quando il box e'
    //stato manomesso a mano, cioe' quando i problemi sono aumentati, non diminuiti.
    const inErrore = avvio.esitoChiusuraScheda({
        boxPresente: true,
        preAnalisi: { differenze: [], errors: ['Errore durante la pre analisi: qualcosa'] }
    });
    assert.strictEqual(inErrore.azione, 'invariato');
    assert.strictEqual(inErrore.motivo, 'errori');

    //Un record classificato per errore finirebbe fra quelli con errori, che il report non
    //mostra in nessuna scheda: sparirebbe dalla vista senza essere stato risolto.
    assert.strictEqual(
        avvio.categoriaRecordRicontrollato({ differenze: [], errors: ['rotto'] }, false), 'recordConErrori');

    //Niente da confrontare non vuol dire tutto a posto.
    const senzaDati = avvio.esitoChiusuraScheda({
        boxPresente: true,
        preAnalisi: { differenze: [], errors: [] },
        nienteDaConfrontare: true
    });
    assert.strictEqual(senzaDati.azione, 'invariato');
    assert.strictEqual(senzaDati.motivo, 'nienteDaConfrontare');

    //Con dati veri e analisi pulita si decide, come prima.
    assert.strictEqual(avvio.esitoChiusuraScheda({
        boxPresente: true,
        preAnalisi: { differenze: [], errors: [] }
    }).azione, 'sposta');
});

test('si riconosce quando non c\'e\' niente da confrontare', () => {
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare(null), false);
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare({}), false);
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare(
        { compiledFields: [], listaFoto: [], fotoExtra: [], fotoExtraAuto: [] }), false);

    //Basta una cosa sola da guardare perche' il confronto abbia un senso.
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare({ compiledFields: [{ labelName: 'descrizione' }] }), true);
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare({ listaFoto: [{ nomeFoto: 'a.psd' }] }), true);
    assert.strictEqual(avvio.ciSonoDatiDaConfrontare({ fotoExtraAuto: [{ nome: 'bollo' }] }), true);
});
