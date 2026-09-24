/*
 * I20-995: i tratti di stile di un campo descrizione.
 *
 * Qui si verifica che leggere il campo a tratti dia quello che prima si otteneva leggendolo
 * carattere per carattere: gli stessi stili nello stesso ordine, lo stesso testo nelle
 * textarea, e le stesse asimmetrie del codice vecchio dove ce n'erano.
 *
 * Esecuzione: node --test tests/plugin/trattiDescrizione.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const tratti = require('../../plugin/trattiDescrizione.js');

//La normalizzazione vera sostituisce anche sequenze lunghe: qui ne basta una che si comporti
//allo stesso modo, per vedere che venga applicata a un carattere per volta e non al tratto.
function normalizzaFinta(testo) {
    return String(testo).split('<br>').join('\n').split('’').join("'");
}

test('il nome dello stile porta il gruppo solo quando il gruppo c\'e\'', () => {
    assert.strictEqual(tratti.nomeCompletoStile('DES_nome', 'A'), 'A.DES_nome');
    assert.strictEqual(tratti.nomeCompletoStile('DES_nome', null), 'DES_nome');
    assert.strictEqual(tratti.nomeCompletoStile('DES_nome', ''), 'DES_nome');
    assert.strictEqual(tratti.nomeCompletoStile(null, 'A'), 'A.');
});

test('i tratti consecutivi con lo stesso stile diventano uno', () => {
    //InDesign spezza i tratti anche dove cambia solo un attributo locale - un corpo, un colore.
    //Senza l'accorpamento lo stesso stile aprirebbe due textarea.
    const uniti = tratti.accorpa([
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'Barattolino ' },
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'Delizie' },
        { nome: 'marca', nomeCompleto: 'A.marca', contenuto: 'Sammontana' }
    ]);

    assert.strictEqual(uniti.length, 2);
    assert.strictEqual(uniti[0].nomeCompleto, 'A.nome');
    assert.strictEqual(uniti[0].contenuto, 'Barattolino Delizie');
    assert.strictEqual(uniti[1].contenuto, 'Sammontana');
});

test('lo stesso stile che torna piu' + ' avanti resta un tratto a se\'', () => {
    const uniti = tratti.accorpa([
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'uno' },
        { nome: 'marca', nomeCompleto: 'A.marca', contenuto: 'due' },
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'tre' }
    ]);

    assert.strictEqual(uniti.length, 3);
    assert.deepStrictEqual(tratti.stiliInOrdine(uniti), ['A.nome', 'A.marca', 'A.nome']);
});

test('un tratto senza testo non conta', () => {
    const uniti = tratti.accorpa([
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'uno' },
        { nome: 'vuoto', nomeCompleto: 'A.vuoto', contenuto: '' },
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'due' }
    ]);

    //Il tratto vuoto non esiste per la scheda, quindi i due pezzi di A.nome si ritrovano
    //vicini e diventano uno: e' quello che vedeva il ciclo per carattere, che sui caratteri
    //di un tratto vuoto non passava mai.
    assert.strictEqual(uniti.length, 1);
    assert.strictEqual(uniti[0].contenuto, 'unodue');
});

test('l\'accorpamento tiene il primo e l\'ultimo pezzo di origine', () => {
    const uniti = tratti.accorpa([
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'uno', origine: 'pezzo1' },
        { nome: 'nome', nomeCompleto: 'A.nome', contenuto: 'due', origine: 'pezzo2' }
    ]);

    //Serve a chi deve risalire alla riga in cui il tratto finisce: e' l'ultimo pezzo, non il
    //primo, come faceva il ciclo che aggiornava a ogni carattere.
    assert.strictEqual(uniti[0].origine, 'pezzo1');
    assert.strictEqual(uniti[0].ultimaOrigine, 'pezzo2');
});

test('niente tratti, niente stili', () => {
    assert.deepStrictEqual(tratti.accorpa([]), []);
    assert.deepStrictEqual(tratti.accorpa(null), []);
    assert.deepStrictEqual(tratti.stiliInOrdine([]), []);
});

test('l\'a capo si vede come a capo e si confronta come ritorno a capo', () => {
    const testi = tratti.testiDelTratto('uno\rdue', normalizzaFinta);

    assert.strictEqual(testi.perLaTextarea, 'uno\ndue');
    assert.strictEqual(testi.perIlConfronto, 'uno\rdue');
});

test('sul primo carattere del tratto l\'a capo resta com\'era', () => {
    //Il codice vecchio guardava l'a capo solo dal secondo carattere in poi. Cambiarlo adesso
    //vorrebbe dire cambiare di nascosto il contenuto di un campo, quindi l'asimmetria resta.
    const testi = tratti.testiDelTratto('\rdue', normalizzaFinta);

    assert.strictEqual(testi.perLaTextarea, '\rdue');
    assert.strictEqual(testi.perIlConfronto, '\rdue');
});

test('la normalizzazione passa un carattere per volta', () => {
    //Applicata al tratto intero riconoscerebbe "<br>" e lo trasformerebbe in un a capo: un
    //carattere per volta quella sequenza non si vede mai, ed e' cosi' che si comportava il
    //ciclo vecchio.
    const testi = tratti.testiDelTratto('a<br>b', normalizzaFinta);

    assert.strictEqual(testi.perLaTextarea, 'a<br>b');

    //Le sostituzioni da un carattere invece scattano, come prima.
    const conApostrofo = tratti.testiDelTratto('l’uovo', normalizzaFinta);
    assert.strictEqual(conApostrofo.perLaTextarea, "l'uovo");
    assert.strictEqual(conApostrofo.perIlConfronto, "l'uovo");
});

test('un tratto vuoto non produce testo, e senza normalizzazione il testo passa intero', () => {
    assert.deepStrictEqual(tratti.testiDelTratto('', normalizzaFinta), { perLaTextarea: '', perIlConfronto: '' });
    assert.deepStrictEqual(tratti.testiDelTratto(null, normalizzaFinta), { perLaTextarea: '', perIlConfronto: '' });
    assert.deepStrictEqual(tratti.testiDelTratto('ab', null), { perLaTextarea: 'ab', perIlConfronto: 'ab' });
});
