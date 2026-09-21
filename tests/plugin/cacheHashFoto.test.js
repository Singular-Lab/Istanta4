/*
 * I20-981 (Lotto 1): la memoria degli hash md5 delle foto.
 *
 * Il punto delicato non e' il risparmio, e' che la cache non deve mai restituire l'hash di
 * una foto che nel frattempo e' cambiata: la chiave comprende dimensione e data di modifica,
 * e se una delle due cambia la voce vecchia non viene piu' trovata.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const cache = require('../../plugin/cacheHashFoto');

function metadata(size, modifica) {
    return { size: size, dateModified: modifica };
}

test('la stessa foto immutata riusa l\'hash', () => {
    cache.svuota();

    const quando = new Date(2026, 8, 21, 9, 0, 0);
    const chiave = cache.chiave('/foto/prodotto.jpg', metadata(120345, quando));

    assert.strictEqual(cache.ottieni(chiave), null, 'la prima volta non c\'e\' nulla');

    cache.memorizza(chiave, 'abc123');

    const stessaChiave = cache.chiave('/foto/prodotto.jpg', metadata(120345, new Date(quando.getTime())));
    assert.strictEqual(stessaChiave, chiave);
    assert.strictEqual(cache.ottieni(stessaChiave), 'abc123');
});

test('una foto sostituita non riusa l\'hash vecchio', () => {
    cache.svuota();

    const chiave = cache.chiave('/foto/prodotto.jpg', metadata(120345, new Date(2026, 8, 21, 9, 0, 0)));
    cache.memorizza(chiave, 'abc123');

    //Stesso percorso, stessa dimensione, ma il file e' stato riscritto.
    const dopoModifica = cache.chiave('/foto/prodotto.jpg', metadata(120345, new Date(2026, 8, 21, 9, 30, 0)));
    assert.notStrictEqual(dopoModifica, chiave);
    assert.strictEqual(cache.ottieni(dopoModifica), null);

    //Stessa data, ma il file ha un'altra dimensione.
    const altraDimensione = cache.chiave('/foto/prodotto.jpg', metadata(999, new Date(2026, 8, 21, 9, 0, 0)));
    assert.strictEqual(cache.ottieni(altraDimensione), null);
});

test('due foto diverse non si confondono', () => {
    cache.svuota();

    const quando = new Date(2026, 8, 21, 9, 0, 0);
    const prima = cache.chiave('/foto/a.jpg', metadata(100, quando));
    const seconda = cache.chiave('/foto/b.jpg', metadata(100, quando));

    cache.memorizza(prima, 'hashA');

    assert.strictEqual(cache.ottieni(prima), 'hashA');
    assert.strictEqual(cache.ottieni(seconda), null);
});

test('senza impronta del file non si mette in cache', () => {
    cache.svuota();

    assert.strictEqual(cache.chiave(null, metadata(1, new Date())), null);
    assert.strictEqual(cache.chiave('', metadata(1, new Date())), null);
    assert.strictEqual(cache.chiave('/foto/a.jpg', null), null);
    assert.strictEqual(cache.chiave('/foto/a.jpg', { size: null, dateModified: new Date() }), null);
    assert.strictEqual(cache.chiave('/foto/a.jpg', { size: 10, dateModified: null }), null);

    //Una chiave nulla non legge e non scrive: il chiamante calcola l'hash e non lo conserva.
    assert.strictEqual(cache.ottieni(null), null);
    cache.memorizza(null, 'hash');
    assert.strictEqual(cache.statistiche().voci, 0);
});

test('la data di creazione basta se manca quella di modifica', () => {
    cache.svuota();

    const chiave = cache.chiave('/foto/a.jpg', { size: 10, dateCreated: new Date(2026, 0, 1) });
    assert.notStrictEqual(chiave, null);
});

test('i contatori raccontano se la cache e\' servita', () => {
    cache.svuota();

    const chiave = cache.chiave('/foto/a.jpg', metadata(10, new Date(2026, 0, 1)));

    cache.ottieni(chiave);
    cache.memorizza(chiave, 'hash');
    cache.ottieni(chiave);
    cache.ottieni(chiave);

    assert.deepStrictEqual(cache.statistiche(), { voci: 1, richieste: 3, risposte: 2 });

    cache.svuota();
    assert.deepStrictEqual(cache.statistiche(), { voci: 0, richieste: 0, risposte: 0 });
});
