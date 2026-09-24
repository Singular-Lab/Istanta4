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
    schedaRef.consentiAperturaAutomatica();
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


/* ---- I20-992: come si presentano e si registrano le caselle del modal ---- */

test('senza silenziamenti le caselle si aprono vuote', () => {
    pulisci();

    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('5329719'), { questa: false, tutte: false });
});

test('una referenza dichiarata si riapre con la sua casella spuntata', () => {
    pulisci();
    schedaRef.applicaScelteSilenziamento('5329719', true, false);

    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('5329719'), { questa: true, tutte: false });

    //Le altre no: la dichiarazione vale per quella referenza e basta.
    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('5365965'), { questa: false, tutte: false });
});

test('con il generale acceso qualunque referenza si apre con entrambe spuntate', () => {
    pulisci();
    schedaRef.applicaScelteSilenziamento('5329719', true, true);

    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('5329719'), { questa: true, tutte: true });
    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('mai vista'), { questa: true, tutte: true });
});

test('togliendo il generale restano zitte solo le referenze dichiarate una per una', () => {
    // E' lo scenario descritto dall'operatore, ed e' il motivo per cui una referenza aperta
    // mentre il generale era acceso non entra nell'elenco: la sua spunta non era una scelta,
    // era il riflesso del generale.
    pulisci();

    schedaRef.applicaScelteSilenziamento('dichiarata', true, false);   // dichiarata a mano
    schedaRef.applicaScelteSilenziamento('altra', true, true);         // da qui si accende il generale

    // Una terza referenza si apre con entrambe spuntate, e l'operatore le toglie.
    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('terza'), { questa: true, tutte: true });
    schedaRef.applicaScelteSilenziamento('terza', false, false);

    assert.strictEqual(schedaRef.refESilenziata('dichiarata'), true, 'la dichiarata sopravvive');
    assert.strictEqual(schedaRef.refESilenziata('altra'), false, 'chi ha solo acceso il generale no');
    assert.strictEqual(schedaRef.refESilenziata('terza'), false);
    assert.strictEqual(schedaRef.segnalazioniSilenziateOvunque, false);
});

test('chiudere lasciando spuntata la prima dichiara la referenza e spegne il generale', () => {
    pulisci();
    schedaRef.applicaScelteSilenziamento('prima', true, true);

    //Dalla seconda si toglie il generale ma si lascia la propria: quella diventa una scelta.
    schedaRef.applicaScelteSilenziamento('seconda', true, false);

    assert.strictEqual(schedaRef.segnalazioniSilenziateOvunque, false);
    assert.strictEqual(schedaRef.refESilenziata('seconda'), true);
    assert.strictEqual(schedaRef.refESilenziata('prima'), false);
});

test('togliere la spunta a una referenza dichiarata la fa tornare a parlare', () => {
    pulisci();
    schedaRef.applicaScelteSilenziamento('5329719', true, false);
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), false);

    schedaRef.applicaScelteSilenziamento('5329719', false, false);

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), true);
    assert.strictEqual(schedaRef.refConSegnalazioniSilenziate.length, 0);
});

test('togliere il silenzio a una referenza che non ce l\'aveva non fa danni', () => {
    pulisci();
    schedaRef.applicaScelteSilenziamento('5329719', true, false);

    schedaRef.togliSilenzioDellaRef('mai dichiarata');
    schedaRef.togliSilenzioDellaRef(null);

    assert.strictEqual(schedaRef.refESilenziata('5329719'), true);
    assert.strictEqual(schedaRef.refConSegnalazioniSilenziate.length, 1);
});

/*
 * I20-992, secondo giro: la finestra si proponeva da sola a ogni ritorno alla schermata di
 * edit. La pre analisi, quella, si faceva gia' una volta sola - ma l'avviso tornava davanti
 * ogni volta che si cliccava EDIT o si applicava la descrizione dal server.
 */

test('la finestra si propone una volta sola per scheda, anche senza silenziamenti', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), true);

    schedaRef.segnaSegnalazioniGiaProposte();

    //Tornare alla schermata di edit - dalle foto, dalla struttura - non la ripropone.
    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), false);

    //Ma l'informazione non si perde: il segnalino resta, e da li' si riapre a mano.
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(schedaRef.segnalazioniInMemoria()), true);
});

test('riaprire la scheda ripropone la finestra', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);
    schedaRef.segnaSegnalazioniGiaProposte();

    //svuotaRef gira all'inizio di ogni apertura di scheda: quella che si apre e' un'altra.
    schedaRef.svuotaRef();

    assert.strictEqual(schedaRef.deveAprirsiDaSola(UNA_DIFFERENZA, '5329719'), true);
});

test('rifare la pre analisi non ripropone la finestra da sola', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(DUE_DIFFERENZE);
    schedaRef.segnaSegnalazioniGiaProposte();

    //E' quello che fa applicaDescrizioneDaServer: il box e' cambiato per volonta' dell'operatore,
    //l'analisi va rifatta, ma non e' una scheda nuova. Se qui la finestra tornasse davanti,
    //risolvere una segnalazione verrebbe punito con un altro avviso.
    schedaRef.dimenticaSegnalazioni();
    assert.strictEqual(schedaRef.segnalazioniInMemoria(), null);

    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);

    assert.strictEqual(schedaRef.deveAprirsiDaSola(schedaRef.segnalazioniInMemoria(), '5329719'), false);
    assert.strictEqual(schedaRef.segnalazioniInMemoria().length, 1);
});

test('risolto tutto, non si propone niente e il segnalino sparisce', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);
    schedaRef.segnaSegnalazioniGiaProposte();

    //Il caso in cui applicare la descrizione dal server risolve l'ultima differenza rimasta.
    schedaRef.dimenticaSegnalazioni();
    schedaRef.memorizzaSegnalazioni([]);

    assert.strictEqual(schedaRef.deveAprirsiDaSola(schedaRef.segnalazioniInMemoria(), '5329719'), false);
    assert.strictEqual(schedaRef.ciSonoSegnalazioniIrrisolte(schedaRef.segnalazioniInMemoria()), false);
});

test('la proposta gia\' fatta non si porta dietro un silenziamento', () => {
    pulisci();
    schedaRef.memorizzaSegnalazioni(UNA_DIFFERENZA);
    schedaRef.segnaSegnalazioniGiaProposte();

    //Non essere interrotti due volte per la stessa scheda non e' aver chiesto il silenzio:
    //le caselle del modal devono restare vuote, altrimenti riaprendolo a mano l'operatore si
    //troverebbe spuntato qualcosa che non ha mai scelto.
    assert.strictEqual(schedaRef.refESilenziata('5329719'), false);
    assert.deepStrictEqual(schedaRef.statoCaselleSilenziamento('5329719'), { questa: false, tutte: false });
});
