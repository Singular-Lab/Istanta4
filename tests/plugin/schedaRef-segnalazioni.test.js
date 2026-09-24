/*
 * I20-992: le segnalazioni del box nella scheda ref.
 *
 * Il modal e il pulsante vivono nel DOM e non si verificano qui. Quello che si verifica sono
 * le decisioni: quando la finestra si apre da sola, quando il pulsante si vede, e soprattutto
 * che la pre analisi non riparta a ogni ritorno alla schermata di edit mentre il silenziamento,
 * al contrario, sopravvive alla riapertura della scheda.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const schedaRef = require('../../plugin/schedaRef.js');

const UNA_DIFFERENZA = [{ label: 'campo_offerta', difference: 'contenuto' }];
const DUE_DIFFERENZE = [
    { label: 'campo_offerta', difference: 'contenuto' },
    { label: 'descrizione', difference: 'paragrafo' }
];

function pulisci() {
    schedaRef.dimenticaSegnalazioni();
    schedaRef.azzeraSilenziamenti();
}

test('la pre analisi si fa una volta sola e poi si rilegge', () => {
    pulisci();

    //null vuol dire "per questa scheda non e' ancora stata fatta": e' il segnale con cui la
    //schermata di edit decide se calcolare o riusare.
    assert.strictEqual(schedaRef.segnalazioniInMemoria(), null);

    schedaRef.memorizzaSegnalazioni(DUE_DIFFERENZE);
    assert.strictEqual(schedaRef.segnalazioniInMemoria().length, 2);

    //Tornare alla schermata di edit non ricalcola: trova gia' qualcosa e non e' piu' null.
    assert.notStrictEqual(schedaRef.segnalazioniInMemoria(), null);
});

test('una scheda senza differenze resta una scheda analizzata, non una da analizzare', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni([]);

    //Il caso limite che conta: se l'assenza di differenze si confondesse con "non ancora
    //fatta", la pre analisi ripartirebbe a ogni ritorno proprio sui box a posto.
    assert.deepStrictEqual(schedaRef.segnalazioniInMemoria(), []);
    assert.notStrictEqual(schedaRef.segnalazioniInMemoria(), null);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(schedaRef.segnalazioniInMemoria()), false);
});

test('il pulsante si vede solo quando c\'e\' qualcosa da risolvere', () => {
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(UNA_DIFFERENZA), true);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte([]), false);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(null), false);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(undefined), false);
});

test('senza silenziamenti la finestra si apre da sola', () => {
    pulisci();

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), true);
    assert.strictEqual(schedaRef.deveAprirsiDaSola([], '5329719'), false);
});

test('silenziare una referenza zittisce quella e non le altre', () => {
    pulisci();
    schedaRef.silenziaSegnalazioniDellaRef('5329719');

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), false);
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5365965'), true);
});

test('silenziare tutte le referenze le zittisce anche mai viste prima', () => {
    pulisci();
    schedaRef.silenziaSegnalazioniOvunque();

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), false);
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, 'mai vista'), false);
});

test('il silenziamento non nasconde le segnalazioni, toglie solo l\'interruzione', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);
    schedaRef.silenziaSegnalazioniOvunque();

    //La finestra non si apre da sola, ma il pulsante resta: da li' l'operatore le riapre
    //quando vuole. Silenziare vuol dire non essere interrotti, non perdere l'informazione.
    assert.strictEqual(schedaRef.deveAprirsiDaSola(schedaRef.segnalazioniInMemoria(), '5329719'), false);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(schedaRef.segnalazioniInMemoria()), true);
});

test('riaprire la scheda rifa\' l\'analisi ma non ridà voce alle segnalazioni silenziate', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);
    schedaRef.silenziaSegnalazioniDellaRef('5329719');

    //svuotaRef gira all'inizio di ogni apertura di scheda.
    schedaRef.svuotaRef();

    //L'analisi va rifatta: la scheda aperta e' un'altra, o la stessa ricaricata.
    assert.strictEqual(schedaRef.segnalazioniInMemoria(), null);

    //Il silenzio invece dura per la sessione: se decadesse qui, riaprire la referenza
    //rimetterebbe in mezzo la finestra che l'operatore aveva appena chiuso.
    assert.strictEqual(schedaRef.refESilenziata('5329719'), true);
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), false);
});

test('la chiave del silenziamento tollera spazi e assenze', () => {
    pulisci();
    schedaRef.silenziaSegnalazioniDellaRef('  5329719  ');

    assert.strictEqual(schedaRef.refESilenziata('5329719'), true);
    assert.strictEqual(schedaRef.chiaveRefPerSilenzio(null), '');
    assert.strictEqual(schedaRef.chiaveRefPerSilenzio(undefined), '');

    //Una referenza senza codice non si puo' silenziare: non avrebbe una chiave con cui
    //riconoscerla, e zittirebbe per sbaglio tutte quelle senza codice.
    pulisci();
    schedaRef.silenziaSegnalazioniDellaRef(null);
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, null), true);
});

test('lo stesso codice silenziato due volte non si accumula', () => {
    pulisci();
    schedaRef.silenziaSegnalazioniDellaRef('5329719');
    schedaRef.silenziaSegnalazioniDellaRef('5329719');

    assert.strictEqual(schedaRef.refConSegnalazioniSilenziate.length, 1);
});

test('azzerare i silenziamenti rimette tutto come all\'avvio del plugin', () => {
    pulisci();
    schedaRef.silenziaSegnalazioniDellaRef('5329719');
    schedaRef.silenziaSegnalazioniOvunque();

    schedaRef.azzeraSilenziamenti();

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), true);
    assert.strictEqual(schedaRef.segnalazioniSilenziateOvunque, false);
});
