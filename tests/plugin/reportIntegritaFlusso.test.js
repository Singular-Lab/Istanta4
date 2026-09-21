/*
 * I20-981 (Lotto 1): la forma del flusso del Report Integrita'.
 *
 * indexNew.js, confronti.js, events.js e utility.js fanno require('indesign') e sotto Node
 * non si caricano: quello che si puo' verificare qui e' che le scelte di struttura restino in
 * piedi. Sono le stesse che facevano fallire il report quando la lista andava scaricata, o che
 * gli facevano scandire il documento intero una volta per box.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');

function sorgente(nome) {
    return fs.readFileSync(path.join(cartellaPlugin, nome), 'utf8');
}

//Il sorgente senza commenti: i nomi citati in un commento non sono codice.
function senzaCommenti(testo) {
    return testo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const indexNew = sorgente('indexNew.js');
const confronti = sorgente('confronti.js');
const events = sorgente('events.js');
const utility = sorgente('utility.js');
const indexHtml = sorgente('index.html');

//Il corpo di una funzione di primo livello di indexNew.js, isolato contando le graffe.
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

const avvio = corpoFunzione(indexNew, 'async function avviaReportIntegrita(');
const applicaConfronto = corpoFunzione(indexNew, 'async function applicaConfronto(');
const preAnalisiBoxMappato = corpoFunzione(indexNew, 'async function preAnalisiBoxMappato(');
const boxDellElementoMappa = corpoFunzione(indexNew, 'function boxDellElementoMappa(');

test('la lista e la mappatura sono attese, non piu\' sondate a cicli', () => {
    //Il difetto: il report partiva dentro la callback del download e la mappatura veniva
    //raccolta con due cicli di attesa identici da sessanta secondi.
    assert.match(avvio, /await Promise\.all\(\[attesaMappa, attesaLista\]\)/);
    assert.match(avvio, /scaricaContenutoKitAsync\(/);

    assert.doesNotMatch(avvio, /while \(mappa == null/);
    assert.doesNotMatch(avvio, /counter--/);

    //Il download attende davvero: la Promise si risolve in onload e fallisce su onerror.
    const wrapper = corpoFunzione(indexNew, 'function scaricaContenutoKitAsync(');
    assert.match(wrapper, /resolve\(objResult\)/);
    assert.match(wrapper, /reject\(/);
    assert.match(indexNew, /function scaricaContenutoKit\(idKit, noCacheValue = null, callback = null, skipMostraTracciato = false, onErrore = null\)/);
});

test('il rifacimento del tracciato non gira piu\' in mezzo al report', () => {
    //leggiContenutoKit rifa' il tracciato, e con lui la riga del bottone appena premuto:
    //stava nello stesso try della callback e un suo errore impediva l'avvio del report.
    const scarica = corpoFunzione(indexNew, 'function scaricaContenutoKit(');
    const posLeggi = scarica.indexOf('leggiContenutoKit(idKit, skipMostraTracciato)');
    const posCallback = scarica.indexOf('callback(objResult)');

    assert.ok(posLeggi > 0 && posCallback > 0);
    assert.ok(posLeggi < posCallback, 'la lettura precede la callback');
    assert.match(scarica, /catch \(exUi\)/, 'la lettura ha il suo catch e non travolge la callback');

    //E nel flusso del report il tracciato si rinfresca alla fine, solo se la lista e' cambiata.
    assert.match(avvio, /if \(listaScaricata\) \{[\s\S]*?await mostraTracciato\(\)/);
});

test('ogni passo del report ha un esito dichiarato', () => {
    ['IDX-84', 'IDX-85', 'IDX-86', 'IDX-166'].forEach(codice => {
        assert.ok(avvio.includes(codice), `manca il codice ${codice} nel flusso del report`);
    });

    //Qualunque cosa accada, loading e busy non restano accesi per sbaglio.
    assert.match(avvio, /finally \{[\s\S]*hideLoading\(\)/);
    assert.match(avvio, /if \(!confronti\.reportIntegritaAperto\(\)\) \{[\s\S]*?setBusy\(false\)/);
});

test('il fix senza report non e\' piu\' offerto', () => {
    assert.ok(indexNew.includes('{ value: "report_confronto", label: "Report integrità" }'));
    assert.ok(!indexNew.includes('label: "Fix integrità"'), 'il picker offre ancora il fix senza report');

    //Con lui sono spariti i due rami che il report non usava: i bollini in pagina e il
    //recupero delle schede dal server.
    assert.match(indexNew, /async function applicaConfronto\(mappa\) \{/);
    assert.doesNotMatch(applicaConfronto, /getSchedeRefsMassivo/);
    assert.doesNotMatch(applicaConfronto, /addBollinoCustom/);
    assert.doesNotMatch(applicaConfronto, /richiediDiScaricareFramework/);
});

test('la preanalisi usa il box che la mappa ha gia\' in mano', () => {
    //Prima passava da impaginazioneSingoloIndd: per ogni box, tutte le pagine del documento
    //materializzate, una page.select() e una scansione di allPageItems.
    assert.match(applicaConfronto, /await preAnalisiBoxMappato\(schedaRef\.records, elMappa\)/);
    assert.doesNotMatch(applicaConfronto, /impaginazioneSingoloIndd/);

    assert.match(preAnalisiBoxMappato, /confrontoBoxCompiledFieldPreAnalisi/);
    assert.doesNotMatch(preAnalisiBoxMappato, /page\.select\(\)/);

    //Il riferimento della mappa viene prima delle ricerche, che restano come ripiego.
    const posRef = boxDellElementoMappa.indexOf('elementoMappa.ref.isValid');
    const posRicerca = boxDellElementoMappa.indexOf('_findBoxInExpectedPage');
    const posDocumento = boxDellElementoMappa.indexOf('_findBoxInDocument');
    const posCodiceGruppo = boxDellElementoMappa.indexOf('_findBoxByCodiceGruppoInPage');

    assert.ok(posRef > 0 && posRicerca > posRef, 'la mappa deve venire prima della ricerca');
    assert.ok(posDocumento > posRicerca, 'prima la pagina attesa, poi tutto il documento');
    assert.ok(posCodiceGruppo > posDocumento, 'per codice gruppo si cerca solo alla fine');
});

test('impaginazioneSingoloIndd impagina e non fa altro', () => {
    assert.match(indexNew, /async function impaginazioneSingoloIndd\(records, pagina, cercaInPaginaPerConfronto, mappaPagina, massiveOperation = false, bounds = null, richiederRicollegamento = false\) \{/);

    //I parametri morti non devono tornare da nessuna parte: chi li passasse per posizione
    //finirebbe per impaginare con i bounds sbagliati.
    ['indexNew.js', 'confronti.js', 'schedaRef.js', 'griglia.js', 'filtri.js'].forEach(nome => {
        const codice = senzaCommenti(sorgente(nome));
        assert.ok(!codice.includes('getPreAnalisi'), `getPreAnalisi e\' ricomparso in ${nome}`);
        assert.ok(!codice.includes('elementoMappaTarget'), `elementoMappaTarget e\' ricomparso in ${nome}`);
    });

    //I dati del primario si leggono in un posto solo.
    assert.match(indexNew, /var datiPrimario = datiPrimarioPerConfronto\(records\)/);
    assert.match(preAnalisiBoxMappato, /datiPrimarioPerConfronto\(records\)/);
});

test('il report si chiude quando cambia il documento, senza chiedere', () => {
    //Il controllo deve stare prima del cancello isBusy: il report tiene isBusy per se', e
    //oltre quel return il ciclo non si accorgeva piu' di nulla.
    const posControllo = events.indexOf('await me.controllaChiusuraReportIntegrita()');
    const posBusy = events.indexOf('if (me.isBusy){');

    assert.ok(posControllo > 0, 'manca il controllo di chiusura nel ciclo degli eventi');
    assert.ok(posControllo < posBusy, 'il controllo deve precedere il cancello isBusy');

    const controllo = corpoFunzione(events, 'async controllaChiusuraReportIntegrita()');
    assert.match(controllo, /reportIntegritaAvvio\.deveChiudereReport/);
    assert.match(controllo, /confronti\.chiudiReportIntegrita/);
    //Non deve chiedere conferma: la domanda resta sulla chiusura fatta a mano.
    assert.doesNotMatch(controllo, /Utility\.confirm/);

    //Chi chiude, chiude passando da un punto solo, cosi' busy e stato restano coerenti.
    const chiusura = corpoFunzione(confronti, 'chiudiReportIntegrita(motivo = null) {');
    assert.match(chiusura, /_reportIntegritaAperto = false/);
    assert.match(chiusura, /setBusy\(false\)/);
    assert.match(chiusura, /Utility\.chiudiModal\(\)/);

    assert.match(indexHtml, /confronti\.chiudiReportIntegrita\(\)/);
    assert.match(confronti, /this\._documentoDelReport = typeof indesignEvents/);
});

test('l\'hash di una foto si ricalcola solo se la foto e\' cambiata', () => {
    const getLinkHash = corpoFunzione(utility, 'async getLinkHash(rectangle) {');

    const posCache = getLinkHash.indexOf('cacheHashFoto.ottieni(chiaveCache)');
    const posLettura = getLinkHash.indexOf('fileEntry.read(');
    const posMemorizza = getLinkHash.indexOf('cacheHashFoto.memorizza(');

    assert.ok(posCache > 0, 'getLinkHash non consulta la cache');
    assert.ok(posCache < posLettura, 'il file si legge solo se la cache non risponde');
    assert.ok(posMemorizza > posLettura);

    //La chiave porta dentro l'impronta del file: percorso e metadati.
    assert.match(getLinkHash, /cacheHashFoto\.chiave\(filePath, await fileEntry\.getMetadata\(\)\)/);
    //Lo stato del link non si mette in cache: si rilegge sempre.
    assert.match(getLinkHash, /if \(link\.status\.toString\(\) == "LINK_OUT_OF_DATE"\)/);
});
