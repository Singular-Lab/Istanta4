/*
 * I20-1051: quando la scheda ref chiede all'operatore di convalidare la firma.
 *
 * La chiede quando la firma della revisione non e' quella del tracciato. Una ref disattivata
 * nel Plugin (regola "plugin" o "entrambi" in disattivazioneRefRules) non si modifica e non si
 * salva: per lei niente messaggio "Convalidare firma" e niente pulsante giallo.
 *
 * L'editabilita' arriva gia' decisa dal middleware, che sotto Node non si carica: qui si prova
 * solo la decisione di schedaRef.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const schedaRef = require('../../plugin/schedaRef.js');

function primario(firmaTracciato, firmaRevisione) {
    return {
        recordInTracciato: { 'Tracciato.Firma': firmaTracciato, StatoSelezione: 1 },
        firmaRevisione: firmaRevisione
    };
}

test('una ref modificabile con la firma del tracciato non chiede la convalida', () => {
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F1', 'F1'), true), false);
});

test('una ref modificabile con la firma diversa o assente chiede la convalida', () => {
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F2', 'F1'), true), true);
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('', ''), true), true);
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F1', null), true), true);
});

test('una ref disattivata nel Plugin non chiede la convalida anche con la firma diversa', () => {
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F2', 'F1'), false), false);
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F1', null), false), false);
});

test('senza risposta sull\'editabilita\' la scheda e\' in sola lettura e non chiede la convalida', () => {
    //Con callCustom e senza la funzione di agenzia il middleware restituisce null: i campi
    //diventano readonly, quindi anche qui vale come non modificabile.
    assert.strictEqual(schedaRef.richiedeConvalidaFirma(primario('F2', 'F1'), null), false);
});
