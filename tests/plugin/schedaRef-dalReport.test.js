/*
 * I20-981 (Lotto 4a): la scheda referenza aperta dal Report Integrita'.
 *
 * Dal report il pulsante Trova porta a questa scheda, che e' la scheda vera mostrata al posto
 * del report: non una copia, perche' una copia vorrebbe dire duplicare il markup di
 * index.html e i suoi id. Quello che cambia e' solo cosa resta raggiungibile, e che il box
 * puo' essere rifatto sotto i piedi mentre gli eventi del plugin sono fermi.
 *
 * Le funzioni sotto test sono membri di plugin/schedaRef.js: non toccano InDesign ne' il DOM.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const schedaRef = require('../../plugin/schedaRef.js');

test('dalla scheda aperta dal report non si naviga altrove', () => {
    const barra = schedaRef.DAL_REPORT_VOCI_BARRA_NASCOSTE;

    //Gli eventi del plugin restano fermi mentre la scheda e' aperta dal report: tutto quello
    //che non e' la referenza non sarebbe governato da nessuno, e quindi non si raggiunge.
    ['homeImage', 'menaboTab', 'grigliaTab', 'utilityImage', 'artworkTab', 'raggruppaImage']
        .forEach(voce => assert.ok(barra.includes(voce), voce + ' deve restare fuori'));

    //Sgruppa (Tab8) e Struttura (Tab13) cambiano la composizione del gruppo: da qui non e'
    //quello che si viene a fare. I cambi strutturali proposti dalla schermata di edit ci
    //arrivano per conto loro e restano raggiungibili.
    assert.deepStrictEqual(schedaRef.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE, ['Tab8', 'Tab13']);
});

test('la ref composta dal box ha la stessa forma di quella dell\'evento di selezione', () => {
    const box = { nome: 'box finto' };
    const pagina = { name: '7' };
    const dna = { codice: '5329719', codice_gruppo: '5329719,5365965', idRec: '412' };

    const ref = schedaRef.refDalBoxPerReport(box, dna, {
        pagina: 7,
        paginaRef: pagina,
        bounds: [0, 0, 10, 10]
    });

    //Da initSchedaRef in poi il flusso deve essere uno solo: la scheda non deve poter
    //distinguere se arriva dal report o da una selezione.
    assert.strictEqual(ref.item, box);
    assert.strictEqual(ref.pag, 7);
    assert.strictEqual(ref.pagRef, pagina);
    assert.strictEqual(ref.codice, '5329719');
    assert.strictEqual(ref.codiceGruppo, '5329719,5365965');
    assert.strictEqual(ref.idRec, '412');
    assert.deepStrictEqual(ref.boxOriginalBounds, [0, 0, 10, 10]);

    //Senza box o senza dna non c'e' scheda da aprire.
    assert.strictEqual(schedaRef.refDalBoxPerReport(null, dna, {}), null);
    assert.strictEqual(schedaRef.refDalBoxPerReport(box, null, {}), null);

    //Pagina e dimensioni possono non essere leggibili: la scheda si apre lo stesso.
    const senzaContesto = schedaRef.refDalBoxPerReport(box, dna, null);
    assert.strictEqual(senzaContesto.pag, -1);
    assert.strictEqual(senzaContesto.pagRef, null);
    assert.strictEqual(senzaContesto.boxOriginalBounds, null);
});

test('il box rifatto si riconosce e la scheda ci si riaggancia', () => {
    //Reimpagina e cambi strutturali creano un box nuovo e il vecchio decade: con gli eventi
    //fermi nessuno ripunta la scheda da solo.
    assert.strictEqual(schedaRef.serveRiaggancioDalReport({ isValid: true }), false);
    assert.strictEqual(schedaRef.serveRiaggancioDalReport({ isValid: false }), true);
    assert.strictEqual(schedaRef.serveRiaggancioDalReport(null), true);
    assert.strictEqual(schedaRef.serveRiaggancioDalReport(undefined), true);

    //Un box che non risponde nemmeno su isValid e' un box perso, non un box buono.
    const boxCheEsplode = { get isValid() { throw new Error('oggetto non piu valido'); } };
    assert.strictEqual(schedaRef.serveRiaggancioDalReport(boxCheEsplode), true);
});

test('la descrizione del server e\' quella con cui il report giudica il box', () => {
    const compilato = { labelName: 'descrizione', paragraphName: '', content: '<DES_nome>Mele Giga</DES_nome>' };
    const records = [
        { recordInTracciato: { StatoSelezione: 2, compiledFields: [{ labelName: 'descrizione', content: 'secondaria' }] } },
        { recordInTracciato: { StatoSelezione: 1, compiledFields: [compilato, { labelName: 'prezzo_offerta', content: '1,99' }] } }
    ];

    //Si prende la descrizione del primario, non quella di un componente qualsiasi del gruppo.
    assert.strictEqual(schedaRef.descrizioneCompilataDelPrimario(records), compilato.content);

    //La regola del sottogruppo e' la stessa della preanalisi: se c'e', comanda lui, altrimenti
    //il box verrebbe allineato a un dato diverso da quello con cui viene giudicato.
    const conSottogruppo = [{
        recordInTracciato: { StatoSelezione: 1, compiledFields: [compilato] },
        sottogruppo: { compiledFields: [{ labelName: 'descrizione', content: '<DES_nome>Dal sottogruppo</DES_nome>' }] }
    }];
    assert.strictEqual(
        schedaRef.descrizioneCompilataDelPrimario(conSottogruppo), '<DES_nome>Dal sottogruppo</DES_nome>');

    //Senza primario, senza campo o senza contenuto non c'e' niente da applicare, e il pulsante
    //non deve nemmeno comparire.
    assert.strictEqual(schedaRef.descrizioneCompilataDelPrimario([]), null);
    assert.strictEqual(schedaRef.descrizioneCompilataDelPrimario(null), null);
    assert.strictEqual(schedaRef.descrizioneCompilataDelPrimario(
        [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: 'prezzo_offerta', content: '1,99' }] } }]), null);
    assert.strictEqual(schedaRef.descrizioneCompilataDelPrimario(
        [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: 'descrizione', content: '' }] } }]), null);
});
