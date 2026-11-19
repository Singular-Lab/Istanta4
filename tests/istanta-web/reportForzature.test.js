/*
 * I20-1247: il report dell'importazione segnala i campi che la lista aggiornerebbe ma che una forzatura
 * (un cambio strutturale bloccato) trattiene. Il dato della referenza non cambia; la riga conta fra le
 * cambiate, il campo compare fra le alterazioni con "(forzato)", la cella del cliente ha il suo colore e
 * il tooltip con i due valori, e il CSV ha una riga con la colonna Forzatura.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const Promo = require('../../Istanta/wwwroot/js/promo.js');

const FORZATA = {
    'Referenza.Codice': '200', AC: 'SSA', EtichettaTracciato: 'VOL', versione: 3,
    distintivita: ' benessere', prezzo_promo: '1,49',
    Alterazioni: { prezzo_promo: '1,99' },
    Forzature: { distintivita: 'premium' }
};
const SOLO_FORZATA = {
    'Referenza.Codice': '201', AC: 'SSA', EtichettaTracciato: 'VOL', versione: 3,
    tema: 'JOLLY', Alterazioni: {}, Forzature: { tema: 'SPRINT' }
};
const INALTERATA = { 'Referenza.Codice': '202', AC: 'SSA', EtichettaTracciato: 'VOL', versione: 3, Alterazioni: {} };

test('una referenza con una sola forzatura trattenuta conta fra le cambiate', () => {
    const righe = Promo.righeDelReport([SOLO_FORZATA, INALTERATA], Promo.colonneCoreDelReport([]), ['tema']);

    assert.strictEqual(righe[0].stato, 2);
    assert.deepStrictEqual(righe[0].alterate, []);
    assert.deepStrictEqual(righe[0].forzate, ['tema']);
    assert.strictEqual(righe[0].valori.Alterazioni, 'tema (forzato)');
    assert.strictEqual(righe[1].stato, 1);
    assert.deepStrictEqual(righe[1].forzate, []);
});

test('la colonna Alterazioni elenca prima i campi cambiati, poi quelli forzati', () => {
    const alterazioni = Promo.colonneCoreDelReport([]).find(c => c.nome == 'Alterazioni');

    assert.strictEqual(Promo.cellaCoreDelReport(alterazioni, FORZATA, ['prezzo_promo'], ['distintivita']), '<td>prezzo_promo<br>distintivita (forzato)</td>');
    //Chi la chiama senza forzati, come prima.
    assert.strictEqual(Promo.cellaCoreDelReport(alterazioni, FORZATA, ['prezzo_promo']), '<td>prezzo_promo</td>');
});

test('la cella di un campo forzato dice il valore che resta e quello della lista', () => {
    assert.strictEqual(Promo.forzaturaDellaCella(FORZATA, 'distintivita'), 'Forzato: resta  benessere, la lista porta premium');
    assert.strictEqual(Promo.forzaturaDellaCella(FORZATA, 'prezzo_promo'), null);
    assert.strictEqual(Promo.forzaturaDellaCella(INALTERATA, 'tema'), null);
});

test('nel CSV il campo forzato ha Prima il valore che resta, Dopo quello della lista e Forzatura trattenuta', () => {
    const core = Promo.colonneCoreDelReport([]);
    const csv = Promo.csvDelReport(Promo.righeDelReport([FORZATA, INALTERATA], core, []), core, []);
    const linee = csv.trimEnd().split('\r\n');

    assert.strictEqual(linee[0], 'Area/canale;Codice;Etichetta;Campo;Prima;Dopo;Forzatura');
    assert.deepStrictEqual(linee.slice(1), [
        'SSA;200;VOL;prezzo_promo;1,99;1,49;',
        'SSA;200;VOL;distintivita; benessere;premium;trattenuta',
        'SSA;202;VOL;;;;'
    ]);
});
