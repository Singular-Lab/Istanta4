/*
 * La ricerca nel registro delle sincronizzazioni rifiutata dal server.
 *
 * SyncFoto/ricercaNelRegistro risponde 400 con { error: codice }: "not_more_40" se l'intervallo
 * supera i 40 giorni, "a_maggiore_di_da" se la data finale precede l'iniziale, "Date not valid"
 * se ne manca una, e lo stack trace per un errore imprevisto. Call.do mette quel codice in
 * err.message, ma la pagina leggeva err.message.error e l'alert diceva "undefined".
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const SyncFoto = require('../../Istanta/wwwroot/js/syncfoto.js');

/* L'oggetto che Call.do passa alla callback d'errore (call.js). */
function rifiuto(codice) {
    return { info: { status: 400 }, error: 'error', message: codice };
}

function senzaConsole(prova) {
    const originale = console.error;
    console.error = () => { };
    try { return prova(); } finally { console.error = originale; }
}

test('oltre 40 giorni si spiega il limite', () => {
    assert.strictEqual(SyncFoto.messaggioRicercaRegistroNonRiuscita(rifiuto('not_more_40')),
        "Si possono cercare al massimo 40 giorni alla volta: restringi l'intervallo di date.");
});

test('data finale precedente a quella iniziale', () => {
    assert.strictEqual(SyncFoto.messaggioRicercaRegistroNonRiuscita(rifiuto('a_maggiore_di_da')),
        "La data finale è precedente a quella iniziale: correggi l'intervallo.");
});

test('data mancante', () => {
    assert.strictEqual(SyncFoto.messaggioRicercaRegistroNonRiuscita(rifiuto('Date not valid')),
        'Indica sia la data di inizio sia quella di fine.');
});

test('un errore imprevisto non mostra lo stack trace', () => {
    const testo = senzaConsole(() => SyncFoto.messaggioRicercaRegistroNonRiuscita(
        rifiuto('System.InvalidOperationException: ...\n   at Istanta.Controllers.SyncFotoController.ricercaNelRegistro')));

    assert.strictEqual(testo, 'Non è stato possibile cercare nel registro. Riprova più tardi.');
});

test('senza risposta del server il messaggio e\' comunque leggibile', () => {
    const testo = senzaConsole(() => SyncFoto.messaggioRicercaRegistroNonRiuscita(undefined));

    assert.doesNotMatch(testo, /undefined/);
});

/* ---- dal pulsante Cerca ---- */

test('dalla pagina, un intervallo troppo lungo mostra il limite e non "undefined"', () => {
    const visto = { alert: [], richiesta: null, caricamentoChiuso: false };
    const globali = {
        $: () => ({ empty() { } }),
        showLoading: () => { },
        hideLoading: () => { visto.caricamentoChiuso = true; },
        alert: (t) => visto.alert.push(t),
        Call: {
            do(controller, indirizzo, metodo, parametri, sender, ok, ko) {
                visto.richiesta = { controller, indirizzo, metodo, parametri };
                ko(rifiuto('not_more_40'));
            }
        }
    };
    const prima = {};
    for (const k of Object.keys(globali)) { prima[k] = global[k]; global[k] = globali[k]; }
    try {
        const filtro = { nomeCartella: '', dataDa: '2026-08-01', dataA: '2026-09-30' };
        SyncFoto.prototype.cercaNelRegistro.call({}, filtro);

        assert.deepStrictEqual(visto.richiesta,
            { controller: 'SyncFoto', indirizzo: 'ricercaNelRegistro', metodo: 'POST', parametri: filtro });
        assert.deepStrictEqual(visto.alert,
            ["Si possono cercare al massimo 40 giorni alla volta: restringi l'intervallo di date."]);
        assert.ok(visto.caricamentoChiuso, 'il caricamento deve chiudersi');
    } finally {
        for (const k of Object.keys(prima)) { global[k] = prima[k]; }
    }
});
