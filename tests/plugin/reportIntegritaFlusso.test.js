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

    //Le graffe dentro le tonde non contano: un parametro con valore predefinito {}
    //chiuderebbe il conteggio prima ancora di entrare nel corpo.
    let tonde = 0;
    let livello = 0;
    let aperta = false;

    for (let i = inizio; i < testo.length; i++) {
        const c = testo[i];

        if (c === '(') { tonde++; continue; }
        if (c === ')') { tonde--; continue; }
        if (tonde > 0) { continue; }

        if (c === '{') { livello++; aperta = true; }
        else if (c === '}') { livello--; }

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

/* I20-981 (Lotto 2): il csv nasce col report, va dove dice l'operatore e non si rompe. */

test('il csv si scrive quando nasce un report, non quando se ne riapre uno', () => {
    //Unico punto di creazione: applicaConfronto, subito dopo l'apertura del report.
    assert.match(applicaConfronto, /await confronti\.scaricaReportConfrontoCsv\(reportObj, \{ automatico: true \}\)/);

    //La riapertura e il rinfresco dell'interfaccia non devono produrre altri file.
    const riapertura = avvio.substring(avvio.indexOf('azioneReport === "open"'), avvio.indexOf('//2.'));
    assert.doesNotMatch(riapertura, /scaricaReportConfrontoCsv/);

    //Nell'apertura del report il csv compare solo come gesto dell'operatore (il pulsante in
    //testata), mai come scrittura automatica.
    const compila = corpoFunzione(confronti, 'compilaReportConfronto(report, options = {}) {');
    assert.doesNotMatch(compila, /^\s*await this\.scaricaReportConfrontoCsv/m);
    assert.match(compila, /onclick = async \(\) => await this\.scaricaReportConfrontoCsv/);
});

test('il csv si scrive in byte utf8', () => {
    //Scritto come stringa da fs, il file usciva con le accentate rotte.
    const scrittura = corpoFunzione(confronti, 'async _scriviTestoUtf8(cartella, nomeFile, testo) {');

    assert.match(scrittura, /createFile\(nomeFile, \{ overwrite: true \}\)/);
    //I byte li calcoliamo noi: scritta come stringa, l'accentata dipendeva da chi la leggeva.
    assert.match(scrittura, /reportConfrontoCsv\.bytesUtf8\(testo\)/);
    assert.match(scrittura, /format: require\("uxp"\)\.storage\.formats\.binary/);

    const scarica = corpoFunzione(confronti, 'async scaricaReportConfrontoCsv(report, opzioni = {}) {');
    assert.match(scarica, /_scriviTestoUtf8/);
    assert.doesNotMatch(scarica, /fs\.writeFileSync/);
});

test('la cartella dei csv si cambia dalla schermata del report', () => {
    const scelta = corpoFunzione(confronti, 'async scegliCartellaCsvReport() {');

    assert.match(scelta, /fs2\.getFolder\(\)/);
    //Il csv di questo confronto viene riscritto nella nuova cartella e tolto dalla vecchia.
    assert.match(scelta, /scaricaReportConfrontoCsv\(report, \{ automatico: true \}\)/);
    assert.match(scelta, /this\._eliminaFile\(precedente\)/);

    //Il suggerimento del pulsantino dice dove stanno andando i csv, e il testo del pulsante
    //non cambia: cambiarlo spostava la testata a ogni scelta.
    const titolo = corpoFunzione(confronti, '_aggiornaTitoloCartellaCsv() {');
    assert.match(titolo, /Utility\.impostaTooltip\(bottone, "Scegli cartella\. Attualmente impostata: "/);
    assert.doesNotMatch(titolo, /textContent/);

    //La memoria dura quanto il codice del plugin: e' un campo del modulo, non un file.
    assert.match(confronti, /_cartellaCsvSessione: null/);
});

test('il csv e l\'interfaccia usano la stessa descrizione composta', () => {
    const descrizione = corpoFunzione(confronti, '_getDescrizioneNuovo(item) {');
    assert.match(descrizione, /reportConfrontoCsv\.descrizioneComposta\(item\)/);

    //Le regole del csv stanno nel modulo, non piu' sparse in confronti.js.
    const build = corpoFunzione(confronti, '_buildReportConfrontoCsv(report) {');
    assert.match(build, /reportConfrontoCsv\.componiCsv\(voci\)/);
    assert.match(build, /reportConfrontoCsv\.datiRecordPerCsv\(raw\)/);
});

test('i title del plugin si vedono, tutti', () => {
    //In UXP l'attributo title non mostra nulla: il riquadro lo disegna il plugin, e lo fa per
    //qualunque elemento con un title, anche per quelli creati dopo l'avvio.
    const utility = sorgente('utility.js');
    const abilita = corpoFunzione(utility, 'abilitaTooltipGlobali() {');

    //Il gestore ascolta sia il nostro attributo sia i title rimasti in giro.
    assert.match(abilita, /\$\(document\)\.on\("mouseenter", "\[" \+ this\.ATTRIBUTO_TOOLTIP \+ "\], \[title\]"/);
    assert.match(abilita, /\$\(document\)\.on\("mouseleave", "\[" \+ this\.ATTRIBUTO_TOOLTIP \+ "\], \[title\]"/);
    assert.match(abilita, /me\._testoDelTooltip\(this\)/);

    //Acceso una volta sola, all'avvio del plugin.
    assert.match(indexNew, /Utility\.abilitaTooltipGlobali\(\);/);
    assert.match(abilita, /if \(this\._tooltipGlobaliAttivi\)/);

    //Il riquadro usa la classe gia' prevista in index.html.
    const crea = corpoFunzione(utility, '_creaRiquadroTooltip() {');
    assert.match(crea, /className = "jq-tooltip"/);
    assert.match(indexHtml, /\.jq-tooltip \{/);

    //Il vecchio title viene portato via al primo passaggio del mouse, cosi' InDesign non
    //mostra il suo suggerimento sopra al nostro.
    const testo = corpoFunzione(utility, '_testoDelTooltip(elemento) {');
    assert.match(testo, /getAttribute\("title"\)/);
    assert.match(testo, /this\.impostaTooltip\(elemento, titolo\)/);

    //Un suggerimento si da' scrivendo l'attributo: la proprieta' .title in UXP non lo crea,
    //ed e' per questo che i pulsanti del report erano muti.
    const imposta = corpoFunzione(utility, 'impostaTooltip(elemento, testo) {');
    assert.match(imposta, /setAttribute\(this\.ATTRIBUTO_TOOLTIP, pulito\)/);
    assert.match(imposta, /removeAttribute\("title"\)/);

    //E in confronti.js non deve restare nessun .title =, altrimenti il prossimo pulsante
    //aggiunto nasce muto senza che nessuno se ne accorga.
    assert.doesNotMatch(senzaCommenti(confronti), /\.title\s*=/);
});
