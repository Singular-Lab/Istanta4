/*
 * I20-1013: eliminare una referenza dal tracciato sul server chiede di scrivere ELIMINA.
 *
 * Oggi rimuoviRefImpaginata elimina dal tracciato solo se l'utente e' superAdmin e alza la
 * spunta nel dialogo di rimozione. Con I20-1013 serve anche una seconda conferma, in cui si
 * scrive a mano la parola ELIMINA. E' l'unica strada del Plugin che cancella un dato sul server,
 * quindi qui si verifica soprattutto che nel dubbio NON si elimini.
 *
 * I20-1012: le conferme stanno in modali/eliminazione.js, mescolate in Modali, che si carica
 * sotto Node. Le parti pure (la parola, il controllo, il riepilogo) si chiamano direttamente; per
 * i dialoghi, che girano solo dentro InDesign, si controlla il sorgente nei punti in cui si
 * decide se eliminare.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');
const utility = fs.readFileSync(path.join(cartellaPlugin, 'modali', 'eliminazione.js'), 'utf8');
const Modali = require('../../plugin/modali/modali');
const indexNew = fs.readFileSync(path.join(cartellaPlugin, 'indexNew.js'), 'utf8');

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
    assert.fail(`corpo di ${intestazione} non delimitato`);
}

//La parola come e' scritta davvero nel sorgente, e come la vede il modulo caricato.
const parola = (utility.match(/PAROLA_ELIMINAZIONE: "([^"]*)"/) || [])[1];

/* ---- la parola ---- */

test('la parola da scrivere e\' ELIMINA', () => {
    assert.strictEqual(parola, 'ELIMINA');
    assert.strictEqual(Modali.PAROLA_ELIMINAZIONE, 'ELIMINA');
});

test('vale solo la parola esatta, anche con spazi ai bordi', () => {
    assert.strictEqual(Modali.parolaEliminazioneCorretta('ELIMINA'), true);
    assert.strictEqual(Modali.parolaEliminazioneCorretta('  ELIMINA  '), true);
    assert.strictEqual(Modali.parolaEliminazioneCorretta('ELIMINA\n'), true);
});

//La fatica di scriverla in maiuscolo e' parte della difesa: il minuscolo non vale.
test('minuscole, parole a meta\' o in piu\' non valgono', () => {
    for (const testo of ['elimina', 'Elimina', 'ELIMIN', 'ELIMINAA', 'ELIMINA ORA', 'E LIMINA', 'ELIMINO']) {
        assert.strictEqual(Modali.parolaEliminazioneCorretta(testo), false, testo);
    }
});

test('un campo vuoto o un valore che non e\' testo non valgono', () => {
    for (const testo of ['', '   ', null, undefined, 0, true, ['ELIMINA'], { valore: 'ELIMINA' }]) {
        assert.strictEqual(Modali.parolaEliminazioneCorretta(testo), false, String(testo));
    }
});

/* ---- cosa dice il dialogo ---- */

test('il riepilogo dice quanti codici, quali, e che si cancella il dato sul server', () => {
    const r = Modali.riepilogoEliminazione(['3150596', '3150599']);

    assert.match(r.avviso, /2 codici gruppo/);
    assert.match(r.avviso, /tracciato sul server/);
    assert.match(r.avviso, /non solo tolto dall'impaginato/);
    assert.deepStrictEqual(r.codici, ['3150596', '3150599']);
    assert.match(r.istruzione, /ELIMINA/);
});

test('con un codice solo il riepilogo usa il singolare', () => {
    assert.match(Modali.riepilogoEliminazione(['3150596']).avviso, /1 codice gruppo /);
});

test('codici vuoti o mancanti non compaiono nel riepilogo', () => {
    assert.deepStrictEqual(Modali.riepilogoEliminazione([' 3150596 ', '', null, '  ']).codici, ['3150596']);
    assert.deepStrictEqual(Modali.riepilogoEliminazione(null).codici, []);
    assert.deepStrictEqual(Modali.riepilogoEliminazione('3150596').codici, []);
});

/* ---- nel dubbio non si elimina: i punti in cui si decide ---- */

const secondaConferma = corpoMembro(utility, 'async confirmParolaEliminazione(');
const primaConferma = corpoMembro(utility, 'async confirmRimozioneRef(');

test('la seconda conferma si chiede solo se la spunta e\' alzata', () => {
    const clic = corpoMembro(primaConferma, 'conferma.on("click"');

    assert.match(clic, /var eliminare = \$\("#chkEliminaDaTracciato"\)\.prop\("checked"\) === true;/);
    //Senza spunta: solo rimozione dall'impaginato, senza seconda conferma.
    assert.match(clic, /if \(!eliminare\) \{[\s\S]*?eliminaDaTracciato: false,[\s\S]*?return;\s*\}/);
    assert.match(clic, /\(await modali\(\)\.confirmParolaEliminazione\(codici\)\) === true/);
});

test('eliminaDaTracciato diventa vero solo dopo la parola confermata', () => {
    //Nel file c'e' un solo punto che lo mette a true, ed e' dopo la seconda conferma.
    const punti = utility.match(/eliminaDaTracciato: true/g) || [];
    assert.strictEqual(punti.length, 1);
    assert.match(primaConferma, /result = parolaConfermata\s*\?\s*\{ confermato: true, eliminaDaTracciato: true, codici: codici \}\s*:\s*\{ confermato: false, eliminaDaTracciato: false, codici: \[\] \};/);
});

test('un errore nella seconda conferma vale come no', () => {
    const clic = corpoMembro(primaConferma, 'conferma.on("click"');
    assert.match(clic, /catch \(e\) \{[\s\S]*?parolaConfermata = false;/);

    assert.match(secondaConferma, /catch \(e\) \{[\s\S]*?return false;\s*\}/);
});

test('la seconda conferma ricontrolla la parola al momento di confermare', () => {
    const conferma = corpoMembro(secondaConferma, 'var confermaSeValida = function');

    //Il controllo viene prima di tutto il resto, e solo dopo si da' l'assenso.
    assert.match(conferma, /^var confermaSeValida = function \(\) \{\s*if \(!modali\(\)\.parolaEliminazioneCorretta\(messaggio\.find\("#txtParolaElimina"\)\.val\(\)\)\) \{\s*return;\s*\}\s*esito = true;/);
    //Pulsante e Invio passano entrambi dal controllo.
    assert.match(secondaConferma, /elimina\.on\("click", confermaSeValida\);/);
    assert.match(secondaConferma, /if \(e\.key === "Enter" \|\| e\.keyCode === 13\) \{\s*confermaSeValida\(\);/);
    //E restituisce vero solo se l'assenso c'e' davvero.
    assert.match(secondaConferma, /return esito === true;/);
});

test('senza codici la seconda conferma non si apre e restituisce no', () => {
    assert.match(secondaConferma, /if \(testi\.codici\.length === 0\) \{[\s\S]*?return false;\s*\}/);
});

test('rimuoviRefImpaginata elimina dal tracciato solo con l\'esito della conferma', () => {
    const rimozione = corpoMembro(indexNew, 'async function rimuoviRefImpaginata(');

    //L'unica assegnazione a true e' dentro il ramo della conferma del superAdmin.
    assert.strictEqual((rimozione.match(/eliminaDaTracciato = true/g) || []).length, 1);
    assert.match(rimozione, /if \(!resConfirm\.confermato\) \{\s*return;\s*\}\s*if \(resConfirm\.eliminaDaTracciato\) \{[\s\S]*?eliminaDaTracciato = true;/);
    assert.match(rimozione, /xhr\.send\("Menabo\/rimuoviRefImpaginata\/" \+ idKitLavorazione \+ "\/" \+ eliminaDaTracciato/);
});
