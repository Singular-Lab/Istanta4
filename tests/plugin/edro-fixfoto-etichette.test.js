/*
 * I20-979: il fix foto custom di Edro allineava la descrizione all'elemento sbagliato.
 *
 * Causa: setCustomFixFoto confrontava l'etichetta grezza degli elementi, ma
 * Utility.setCampoDNA appende "$DNA$..." al primo campo visibile fra quelli configurati
 * nelle regoleApplicazioneDNA del cliente. Per Edro in quella lista ci sono prezzo_offerta,
 * sconto_fid e descrizione: il campo che porta il DNA non corrispondeva piu' al confronto e
 * spariva dal calcolo, lasciando che fosse il solo sy_euro a decidere dove finiva la
 * descrizione.
 *
 * custom.js fa require('indesign') e sotto Node non si carica, quindi la funzione non e'
 * eseguibile qui: si verifica la premessa della correzione sull'implementazione vera di
 * parseLabel, e che nella funzione non siano rimasti confronti sull'etichetta grezza.
 *
 * I20-1240: setCustomFixFoto non c'e' piu'. La descrizione la porta in basso la regola
 * descrizioneInBasso del CssFramework di Edro21, che segue i prezzi con il motore degli
 * allineamenti: il motore cerca gli elementi nella mappa del box, le cui chiavi sono le etichette
 * normalizzate. Si verifica quello, al posto della funzione.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');

function sorgente(percorsoRelativo) {
    return fs.readFileSync(path.join(cartellaPlugin, percorsoRelativo), 'utf8');
}

//Il file del cliente montato in plugin/custom.js non e' versionato: quello che vale, ed e'
//l'unico presente in CI, e' l'archivio da cui monta-cliente.sh lo copia.
const customEdro = sorgente(path.join('Agenzie', 'Edro21', 'custom.js'));

//parseLabel come e' scritta davvero in utility.js, che non si puo' richiedere sotto Node.
function caricaParseLabel() {
    const testo = sorgente('utility.js');
    const corpo = testo.match(/parseLabel\(label\)\{[\s\S]*?\n {4}\}/);
    assert.ok(corpo, 'parseLabel non trovata in utility.js: il test va aggiornato');

    return new Function('pluginMiddleware', 'return function ' + corpo[0])({ getCampo: () => null });
}

//Il corpo di un membro dell'oggetto customAgenzia, isolato contando le graffe.
function corpoFunzione(testo, intestazione) {
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

//I20-1240: la regola del CssFramework di Edro21 che porta la descrizione a sinistra dei prezzi.
const cssEdro = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'external_source', 'Edro21', 'SourceFrameworkCss.json'),
    'utf8'));
function regoleDescrizioneInBasso() {
    return cssEdro.dbRidimensionamentiAllineamenti.modificheCssPerKit
        .flatMap(kit => kit.operazioniPerBox)
        .flatMap(voce => voce.allineamenti || [])
        .filter(regola => regola.nomeGruppo === 'descrizioneInBasso');
}

test('l\'etichetta che porta il DNA si riduce al nome del campo', () => {
    //E' la premessa della correzione: se parseLabel smettesse di tagliare il DNA, il fix
    //foto di Edro tornerebbe a non riconoscere prezzo_offerta.
    const parseLabel = caricaParseLabel();

    assert.strictEqual(
        parseLabel('prezzo_offerta$DNA$BOX1$6119227$6119227,6119231$382329'),
        'prezzo_offerta');
    assert.strictEqual(parseLabel('descrizione$DNA$BOX1$6119227$6119227$1'), 'descrizione');
    assert.strictEqual(parseLabel('sconto_fid$DNA$BOX1$1$1$1'), 'sconto_fid');
    //Senza DNA resta identica, e le foto restano intere: hanno il codice nel suffisso.
    assert.strictEqual(parseLabel('sy_euro'), 'sy_euro');
    assert.strictEqual(parseLabel('immagine$3150596'), 'immagine$3150596');
});

test('il DNA viene appeso col separatore che parseLabel taglia', () => {
    //Lega il produttore al consumatore: se setCampoDNA cambiasse formato, qui si vede.
    const utility = sorgente('utility.js');

    assert.match(utility, /field\.label \+= "\$DNA\$"/);
});

test('il fix foto di Edro confronta l\'etichetta normalizzata, non quella grezza', () => {
    //La riga che ha causato la segnalazione: getElements.some(el => item.label == el).
    //I20-1240: i prezzi da seguire li cerca il motore nella mappa del box, con le etichette normalizzate,
    //e gli scarti delle varianti confrontano anche loro l'etichetta normalizzata.
    const css = sorgente('CssFramework.js').replace(/\r/g, '');
    const mappa = corpoFunzione(css, 'creaMappaturaBoxOriginale(box, prefissiDerivati) {');
    assert.match(mappa, /: Utility\.parseLabel\(item\.label\);/);
    assert.match(mappa, /mappaElementi\[chiaveElemento\] = \{/);

    const sistemazione = sorgente(path.join('sistemazioneFoto', 'sistemazioneFoto.js')).replace(/\r/g, '');
    const scarto = corpoFunzione(sistemazione, 'motivoScarto(box, scartaSe, annotazioniPrima = null) {');
    //l'etichetta si normalizza una volta per elemento, e i confronti usano quella
    assert.match(scarto, /letti\.push\(\{ item: item, etichetta: Utility\.parseLabel\(label\), visibile: null \}\);/);
    assert.match(scarto, /regole\.some\(r => r\.test\(l\.etichetta\)\)/);

    //Nessun confronto esatto sull'etichetta grezza deve sopravvivere negli scarti:
    //ognuno di quelli e' un campo che sparisce quando gli capita addosso il DNA.
    const confrontiGrezzi = scarto.match(/item\.label\s*[=!]=\s*"/g) || [];
    assert.deepStrictEqual(confrontiGrezzi, []);
    assert.doesNotMatch(customEdro, /setCustomFixFoto\(box\)\{/);
});

test('i campi che possono portare il DNA sono quelli cercati dal fix foto', () => {
    //Se qualcuno aggiungesse a getElements un campo candidato al DNA, senza normalizzare
    //l'etichetta il difetto tornerebbe: questo test tiene insieme le due liste.
    const sorgenteEdro = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', '..', 'Istanta', 'wwwroot', 'external_source', 'Edro21', 'SourceCustomPlugin.json'),
        'utf8'));

    const campiDNA = (sorgenteEdro.regoleApplicazioneDNA || [])
        .flatMap(regola => regola.campiDNA || []);

    assert.ok(campiDNA.includes('prezzo_offerta'), 'prezzo_offerta non e\' piu\' candidato DNA');
    assert.ok(campiDNA.includes('descrizione'), 'descrizione non e\' piu\' candidata DNA');

    //I campi del fix foto che sono anche candidati DNA: sono quelli che il difetto colpiva.
    //I20-1240: sono gli elementi che la regola descrizioneInBasso segue sull'asse x, in ogni box.
    const regole = regoleDescrizioneInBasso();
    assert.ok(regole.length > 0, 'nessuna regola descrizioneInBasso nel CssFramework di Edro21');
    const getElements = regole[0].followAnchor.find(a => a.xAnchor != null).nomiGruppiSeguiti;
    regole.forEach(regola => assert.deepStrictEqual(regola.followAnchor.find(a => a.xAnchor != null).nomiGruppiSeguiti, getElements));

    const esposti = getElements.filter(campo => campiDNA.includes(campo));
    assert.ok(esposti.length > 0, 'nessun campo in comune: il test non sta piu\' verificando nulla');
    assert.ok(esposti.includes('prezzo_offerta'));
});
