/*
 * I20-1106 (Lotto 2): la pagina Pulizia liste del menu Confronti.
 *
 * Qui si verificano le parti che decidono qualcosa senza pagina: le categorie di una riga, la
 * visibilita' con i contatori spenti, l'ordine (manuali prima), i contatori, cosa scelgono i
 * pulsanti di selezione (mai gli impaginati, mai le righe nascoste), i testi delle conferme e
 * il riassunto. Per l'eliminazione, che gira solo nella pagina, si controlla il sorgente nel
 * punto in cui decide: due conferme prima della chiamata al server.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PuliziaListe = require('../../Istanta/wwwroot/js/puliziaListe.js');
const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'js', 'puliziaListe.js'), 'utf8');

//Il corpo di un membro, isolato contando le graffe a partire dalla sua intestazione.
function corpoMembro(testo, intestazione) {
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, `${intestazione} non trovata: il test va aggiornato`);

    let livello = 0;
    let aperta = false;
    for (let i = inizio; i < testo.length; i++) {
        if (testo[i] === '{') { livello++; aperta = true; }
        else if (testo[i] === '}') { livello--; }
        if (aperta && livello === 0) {
            return testo.substring(inizio, i + 1);
        }
    }
    assert.fail(`${intestazione}: corpo non chiuso`);
}

function riga(id, codice, manuale, impaginato, versione) {
    return { id: id, codice: codice, manuale: !!manuale, impaginato: !!impaginato, versione: versione || 1, motivoImpaginato: impaginato ? 'impaginato in una lavorazione' : '' };
}

const tutteAccese = { manuale: true, daLista: true, impaginato: true };

/* ---- categorie e visibilita' ---- */

test('una riga e\' manuale o da lista, e in piu\' impaginata se lo e\'', () => {
    assert.deepStrictEqual(PuliziaListe.categorie(riga(1, 'A', true, false)), ['manuale']);
    assert.deepStrictEqual(PuliziaListe.categorie(riga(2, 'B', false, true)), ['daLista', 'impaginato']);
});

test('una riga resta visibile finche\' almeno una delle sue categorie e\' accesa', () => {
    const manualeImpaginata = riga(1, 'A', true, true);

    assert.strictEqual(PuliziaListe.visibile(manualeImpaginata, { manuale: false, daLista: true, impaginato: true }), true);
    assert.strictEqual(PuliziaListe.visibile(manualeImpaginata, { manuale: true, daLista: true, impaginato: false }), true);
    assert.strictEqual(PuliziaListe.visibile(manualeImpaginata, { manuale: false, daLista: true, impaginato: false }), false);
    //Una categoria mai toccata vale accesa.
    assert.strictEqual(PuliziaListe.visibile(riga(2, 'B', false, false), {}), true);
});

/* ---- ordine e contatori ---- */

test('l\'ordine mette i manuali prima, poi il codice, poi la versione piu\' alta, senza toccare l\'originale', () => {
    const ricevute = [riga(1, '200', false, false, 1), riga(2, '100', true, false, 1), riga(3, '050', false, false, 1), riga(4, '050', false, false, 2), riga(5, '300', true, false, 1)];
    const copia = ricevute.slice();

    const ordinate = PuliziaListe.ordina(ricevute);

    assert.deepStrictEqual(ordinate.map(r => r.id), [2, 5, 4, 3, 1]);
    assert.deepStrictEqual(ricevute, copia);
    assert.deepStrictEqual(PuliziaListe.ordina(null), []);
});

test('i contatori contano le categorie sull\'intero report e i visualizzati con le categorie accese', () => {
    const righe = [riga(1, 'A', true, false), riga(2, 'B', true, true), riga(3, 'C', false, false), riga(4, 'D', false, false), riga(5, 'E', false, true)];

    assert.deepStrictEqual(PuliziaListe.conta(righe, tutteAccese), { manuali: 2, daLista: 3, impaginati: 2, visualizzati: 5 });
    //Spenti i manuali: resta la 2 perche' e' anche impaginata, e l'impaginato e' acceso.
    assert.deepStrictEqual(PuliziaListe.conta(righe, { manuale: false, daLista: true, impaginato: true }), { manuali: 2, daLista: 3, impaginati: 2, visualizzati: 4 });
    //Spenti manuali e impaginati: restano le tre da lista, anche la 5 che e' impaginata, perche'
    //basta una categoria accesa; sparisce la 2, manuale e impaginata, che le ha spente tutte e due.
    assert.deepStrictEqual(PuliziaListe.conta(righe, { manuale: false, daLista: true, impaginato: false }), { manuali: 2, daLista: 3, impaginati: 2, visualizzati: 3 });
    assert.deepStrictEqual(PuliziaListe.conta(righe, { manuale: true, daLista: false, impaginato: false }), { manuali: 2, daLista: 3, impaginati: 2, visualizzati: 2 });
    assert.deepStrictEqual(PuliziaListe.conta([], tutteAccese), { manuali: 0, daLista: 0, impaginati: 0, visualizzati: 0 });
});

/* ---- le selezioni ---- */

test('i pulsanti di selezione non scelgono mai gli impaginati ne\' le righe nascoste', () => {
    const righe = [riga(1, 'A', true, false), riga(2, 'B', true, true), riga(3, 'C', false, false), riga(4, 'D', false, true), riga(5, 'E', false, false)];

    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'tutti', tutteAccese), [1, 3, 5]);
    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'manuali', tutteAccese), [1]);
    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'daLista', tutteAccese), [3, 5]);
    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'nessuno', tutteAccese), []);
    //Con i manuali spenti, "tutti" non prende la 1.
    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'tutti', { manuale: false }), [3, 5]);
    assert.deepStrictEqual(PuliziaListe.idSelezionabili(righe, 'boh', tutteAccese), []);
});

/* ---- conferme e riassunto ---- */

test('le conferme dicono quanti record, da quale lista, che si eliminano dal tracciato e che prima c\'e\' il backup', () => {
    const prima = PuliziaListe.testoConfermaEliminazione(4, 'lista.xlsx');
    assert.ok(prima.includes('4 record'));
    assert.ok(prima.includes('lista.xlsx'));
    assert.ok(prima.includes('eliminati dal tracciato'));
    assert.ok(prima.includes('backup'));

    const seconda = PuliziaListe.testoSecondaConfermaEliminazione(4);
    assert.ok(seconda.includes('definitivamente'));
    assert.ok(seconda.includes('4 record'));
});

test('il riassunto riporta gli eliminati, il backup e chi e\' rimasto con il motivo', () => {
    const righe = PuliziaListe.riassuntoEliminazione({
        esito: true, eliminati: 3, idBackup: 12,
        saltati: [{ id: 9, codice: '101', motivo: 'impaginato in una lavorazione' }, { id: 77, codice: '', motivo: 'non e\' fra i record della promo' }]
    });

    assert.deepStrictEqual(righe, [
        'Eliminati 3 record dal tracciato.',
        'Backup dei record dei tracciati fatto prima dell\'eliminazione: n. 12.',
        'Non eliminato 101: impaginato in una lavorazione.',
        'Non eliminato id 77: non e\' fra i record della promo.'
    ]);
    assert.deepStrictEqual(PuliziaListe.riassuntoEliminazione({ esito: true }), ['Eliminati 0 record dal tracciato.']);
});

test('esc protegge il testo messo nella pagina', () => {
    assert.strictEqual(PuliziaListe.esc('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
    assert.strictEqual(PuliziaListe.esc(null), '');
});

/* ---- la pagina, nel sorgente ---- */

test('l\'eliminazione chiede due conferme prima di chiamare il server, e non parte senza selezione', () => {
    const elimina = corpoMembro(sorgente, 'elimina() {');
    const chiamata = elimina.indexOf('Call.doWithLargePayload("Confronti", "puliziaListeElimina", "PUT"');
    assert.notStrictEqual(chiamata, -1);
    const conferme = elimina.substring(0, chiamata).match(/if \(!confirm\(/g) || [];
    assert.strictEqual(conferme.length, 2);
    assert.ok(elimina.indexOf('if (ids.length === 0) return;') < elimina.indexOf('confirm('));
});

test('la richiesta del report porta canale e area solo se scelti, e il titolo descrive il filtro', () => {
    assert.deepStrictEqual(PuliziaListe.richiestaReport(7, 12, '', ''), { idPromo: 7, idImportazione: 12, guidCanale: null, guidArea: null });
    assert.deepStrictEqual(PuliziaListe.richiestaReport(7, 12, 'C1', null), { idPromo: 7, idImportazione: 12, guidCanale: 'C1', guidArea: null });
    assert.deepStrictEqual(PuliziaListe.richiestaReport(7, 12, '', 'A1'), { idPromo: 7, idImportazione: 12, guidCanale: null, guidArea: 'A1' });
    assert.deepStrictEqual(PuliziaListe.richiestaReport(7, 12, 'C1', 'A1'), { idPromo: 7, idImportazione: 12, guidCanale: 'C1', guidArea: 'A1' });

    assert.strictEqual(PuliziaListe.descriviFiltro('', ''), '');
    assert.strictEqual(PuliziaListe.descriviFiltro('SS', ''), 'canale SS');
    assert.strictEqual(PuliziaListe.descriviFiltro('', 'Toscana'), 'area Toscana');
    assert.strictEqual(PuliziaListe.descriviFiltro('SS', 'Toscana'), 'canale SS, area Toscana');
});

test('il report si chiede al server con promo, lista e filtro, e il pulsante ELIMINA resta spento senza selezione', () => {
    const report = corpoMembro(sorgente, 'avviaReport() {');
    assert.ok(report.includes('PuliziaListe.richiestaReport(me.idPromo, me.idImportazione, me.guidCanale, me.guidArea)'));
    assert.ok(report.includes('Call.doWithLargePayload("Confronti", "puliziaListeReport", "PUT", richiesta'));

    const pulsanti = corpoMembro(sorgente, 'aggiornaPulsanti() {');
    assert.ok(pulsanti.includes('$("#btnElimina").prop("disabled", quanti === 0)'));
});

test('gli impaginati nel report non hanno la casella e mostrano l\'avviso', () => {
    const render = corpoMembro(sorgente, 'render() {');
    assert.ok(render.includes("r.impaginato ? \"\" : \"<input type='checkbox' class='chkRiga'"));
    assert.ok(render.includes('non eliminabile'));
});
