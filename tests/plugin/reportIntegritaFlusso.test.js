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

//La scheda si carica sotto Node: le sue regole si provano chiamandole, non leggendole.
const schedaRef = require('../../plugin/schedaRef.js');

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

test('il riquadro si misura sul pannello del plugin, non sulla finestra', () => {
    //I20-981: window.innerWidth in UXP non e' il pannello, e su quelle misure il riquadro
    //usciva dai bordi e il testo lungo non andava a capo dove doveva.
    const utility = sorgente('utility.js');
    const dimensioni = corpoFunzione(utility, '_dimensioniPannello() {');

    const posWrapper = dimensioni.indexOf('getElementById("wrapper")');
    const posWindow = dimensioni.indexOf('window.innerWidth');

    assert.ok(posWrapper > 0, 'il pannello non si misura piu\' da #wrapper');
    assert.ok(posWindow > posWrapper, 'window resta l\'ultimo ripiego, non il primo');

    //I limiti del riquadro vengono dall'ancoraggio e finiscono in stile: sono loro a rendere
    //vera la premessa del calcolo, cioe' che il riquadro non sia mai piu' grande del previsto.
    const mostra = corpoFunzione(utility, '_mostraTooltip(elemento, testo) {');
    assert.match(mostra, /tooltipPosizione\.ancoraggioTooltip\(/);
    assert.match(mostra, /maxWidth = ancoraggio\.maxWidth/);
    assert.match(mostra, /maxHeight = ancoraggio\.maxHeight/);
});

test('il riquadro non viene mai misurato', () => {
    //E' il difetto che si e' ripresentato tre volte: in UXP la misura del riquadro, appena
    //gli si cambia il testo, restituisce le dimensioni del testo precedente, e passando da un
    //elemento all'altro il riquadro usciva spostato di quella differenza. Ora nessuno lo
    //misura: si guardano il rettangolo dell'elemento e i limiti che imponiamo noi.
    const utility = sorgente('utility.js');
    const mostra = corpoFunzione(utility, '_mostraTooltip(elemento, testo) {');

    assert.match(mostra, /elemento\.getBoundingClientRect\(\)/);
    assert.doesNotMatch(mostra, /riquadro\.getBoundingClientRect/);
    assert.doesNotMatch(mostra, /riquadro\.offsetWidth/);
    assert.doesNotMatch(mostra, /riquadro\.offsetHeight/);

    //Uno solo dei due ancoraggi verticali, e l'altro rimesso ad auto: se restasse quello di
    //prima il riquadro si stirerebbe fra i due bordi.
    assert.match(mostra, /riquadro\.style\.bottom = "auto"/);
    assert.match(mostra, /riquadro\.style\.top = "auto"/);

    //Chi nasconde il riquadro dimentica anche l'elemento.
    const nascondi = corpoFunzione(utility, 'nascondiTooltip() {');
    assert.match(nascondi, /this\._ancoraTooltip = null/);
    assert.match(nascondi, /visibility = "hidden"/);
});

/* I20-981 (Lotto 3): l'interfaccia del report. */

test('i pulsanti che non facevano nulla non ci sono piu\'', () => {
    //"Fix all" e "Fix massivo" aprivano una conferma e dietro avevano un TODO: un pulsante
    //che promette un'azione inesistente e' peggio di un pulsante che manca.
    const codice = senzaCommenti(confronti);

    assert.ok(!codice.includes('"Fix all"'), 'Fix all e\' tornato');
    assert.ok(!codice.includes('"Fix massivo"'), 'Fix massivo e\' tornato');
    assert.ok(!codice.includes('btnFixAll'));
    assert.ok(!codice.includes('btnFixMassivo'));

    //Il piede resta vuoto e nascosto: lo spazio va all'elenco.
    assert.match(confronti, /footer\.style\.display = "none"/);

    //Il fix della singola segnalazione invece resta.
    assert.match(confronti, /_crIconButton\("Fix", "images\/fix\.png"\)/);
});

test('le linguette contano quello che i pannelli mostrano', () => {
    const compila = corpoFunzione(confronti, 'compilaReportConfronto(report, options = {}) {');

    //I pannelli si costruiscono prima, perche' il conteggio dei nuovi viene dal loro stato.
    const posPannelli = compila.indexOf('this._buildPanelCambiati(recordsCambiati)');
    const posConteggi = compila.indexOf('reportConteggi.conteggiVisibili');
    const posLinguette = compila.indexOf('reportConteggi.etichettaLinguetta("Cambiati"');

    assert.ok(posPannelli > 0 && posConteggi > posPannelli, 'i conteggi vengono dopo i pannelli');
    assert.ok(posLinguette > posConteggi);

    //Si contano le liste mostrate, non il report intero: in vista whitelist sono diverse.
    assert.match(compila, /conteggiVisibili\(\s*recordsCambiati,\s*recordsUsciti,\s*this\._confrontoNuoviState\?\.rowsOriginal\)/);
    assert.match(compila, /const recordsCambiati = this\._getCurrentReportRecords\("recordCambiati"\)/);
});

test('il codice del gruppo si copia con un clic', () => {
    const crea = corpoFunzione(confronti, '_crCodiceGruppo(codiceGruppo) {');
    assert.match(crea, /addEventListener\("click", \(\) => this\.copiaCodiceGruppo\(testo\)\)/);
    assert.match(crea, /Clicca per copiare i codici del gruppo/);

    //writeText vuole una stringa: l'oggetto usato altrove nel plugin copia "[object Object]".
    const copia = corpoFunzione(confronti, 'copiaCodiceGruppo(codiceGruppo) {');
    assert.match(copia, /navigator\.clipboard\.writeText\(testo\)/);
    assert.doesNotMatch(copia, /writeText\(\{/);

    //Entrambi gli elenchi con i codici passano di li'.
    const occorrenze = (confronti.match(/this\._crCodiceGruppo\(item\.codiceGruppo\)/g) || []).length;
    assert.strictEqual(occorrenze, 2, 'cambiati ed eliminati devono usare lo stesso elemento');
});

test('i dialoghi si adattano invece di sbordare', () => {
    const utility = sorgente('utility.js');

    //Niente piu' altezze fisse nei due dialoghi che il report usa: il riquadro cresce col
    //messaggio e il testo scorre. (Utility.popup ha misure fisse ma scorre al suo interno,
    //quindi non fa uscire nulla e resta com'e'.)
    const confirm = corpoFunzione(utility, 'async confirm (message){');
    const confirmCustom = corpoFunzione(utility, 'async confirmCustom (message, bottoneConfirm1Text, hiddenVal1=null, bottoneConfirm2Text = null, hiddenVal2 = null){');

    [confirm, confirmCustom].forEach(dialogo => {
        assert.doesNotMatch(dialogo, /width: 60%; height: 40%/);
        assert.doesNotMatch(dialogo, /display: flex; height: 80%"/);
        //I pulsanti vanno a capo invece di uscire di lato.
        assert.match(dialogo, /flex-wrap: wrap/);
        assert.match(dialogo, /min-width: 88px/);
        assert.match(dialogo, /overflow: auto/);
    });

    const treAzioni = corpoFunzione(confronti, 'async _confirmTreAzioniReport(message, actions) {');
    assert.match(treAzioni, /flex-wrap:wrap/);
    assert.doesNotMatch(treAzioni, /min-width:90px/);
});

test('le righe portano il colore del loro stato', () => {
    assert.match(confronti, /COLORI_STATO: \{/);
    assert.match(confronti, /this\._crRow\("cambiato"\)/);
    assert.match(confronti, /this\._crRow\("uscito"\)/);

    const riga = corpoFunzione(confronti, '_crRow(stato = null) {');
    assert.match(riga, /borderLeft = "4px solid " \+ \(this\.COLORI_STATO\[stato\] \|\| "#444"\)/);
});

/* I20-981 (Lotto 3, collaudo): le correzioni nate dal collaudo. */

test('la finestra delle info ha misure sue, non "inset"', () => {
    //Era l'unico overlay del plugin a usare inset: senza misure esplicite si stringeva sul
    //contenuto, da cui la finestra ridotta a una colonna e lo scorrimento incompleto.
    const overlay = senzaCommenti(corpoFunzione(confronti, '_apriOverlayInfoReport(titolo) {'));

    assert.doesNotMatch(overlay, /inset: 0/);
    assert.match(overlay, /position: fixed; top: 0; left: 0; width: 100%; height: 100%/);
    assert.match(overlay, /max-height: 86%/);
    //Il corpo resta quello che scorre.
    assert.match(overlay, /id="confrontoInfoBody" style="flex:1 1 auto; min-height:0; overflow:auto/);

    //E le righe dell'informazione vanno a capo invece di schiacciare il valore.
    const schedaRef = sorgente('schedaRef.js');
    assert.match(schedaRef, /display:flex; flex-wrap:wrap; align-items:flex-start/);
});

test('"Elimina tutti" elimina davvero, e chiede prima', () => {
    const elimina = corpoFunzione(confronti, 'async _eliminaTuttiUsciti(records) {');

    //Una conferma sola, con scritto quanti box e che non si torna indietro.
    assert.match(elimina, /_confirmReportAction\(\s*"massive"/);
    assert.match(elimina, /L'operazione non si annulla/);
    assert.match(elimina, /if \(!ok\) \{[\s\S]*?return;/);

    //Il ciclo usa lo stesso riferimento del singolo, e un box gia' sparito non e' un errore.
    assert.match(elimina, /this\._resolveBoxFromRecord\(record\)/);
    assert.match(elimina, /box\.remove\(\)/);
    assert.match(elimina, /nonTrovati\+\+/);

    //Un solo salvataggio e un solo rinfresco alla fine, non uno per record.
    assert.strictEqual((elimina.match(/_refreshConfrontoReportUi\(\)/g) || []).length, 1);
    assert.strictEqual((elimina.match(/_saveCurrentReportAndWhitelist\(\)/g) || []).length, 1);

    //E il pulsante ci e' collegato, senza piu' il TODO.
    assert.match(confronti, /btnDeleteAll\.addEventListener\("click", \(\) => this\._eliminaTuttiUsciti\(records\)\)/);
    assert.ok(!senzaCommenti(confronti).includes('TODO: Elimina tutti'));
});

test('i messaggi compaiono davanti al modal', () => {
    //Il parametro modal esisteva da sempre ma nessuna chiamata del report lo passava: i
    //messaggi finivano nel contenitore della schermata principale, sotto all'overlay.
    const scelta = corpoFunzione(indexNew, 'function contenitoreMessaggi(modal) {');

    assert.match(scelta, /\$\("\.overlayModal"\)\.filter/);
    assert.match(scelta, /messaggiUtenteModal/);
    //Niente :visible: in UXP le misure su cui si basa non sono affidabili.
    assert.doesNotMatch(scelta, /:visible/);

    assert.match(indexNew, /contenitoreMessaggi\(modal\)\.append\(html\)/);
});

test('la copia negli appunti passa una stringa, in tutto il plugin', () => {
    //writeText vuole una stringa: con un oggetto si copia "[object Object]", e nessuno se ne
    //accorge finche' non prova a incollare.
    ['griglia.js', 'schedaRef.js', 'confronti.js', 'indexNew.js', 'filtri.js'].forEach(nome => {
        const codice = sorgente(nome);
        assert.ok(!codice.includes("writeText({"), `${nome} copia ancora un oggetto`);
    });

    assert.match(sorgente('griglia.js'), /writeText\(String\(\$\(this\)\.attr\("codiceGruppo"\) \|\| ""\)\)/);
    assert.strictEqual((sorgente('schedaRef.js').match(/writeText\(String\(\$\(this\)\.attr\("codiceGruppo"\) \|\| ""\)\)/g) || []).length, 2);
});

/* I20-981 (Lotto 4a): le differenze sui campi osservati. */

test('le differenze di confronto diventano segnalazioni della referenza', () => {
    //Vivono nella scheda Cambiati insieme alle segnalazioni di integrita', cosi' l'operatore
    //ha sotto mano i pulsanti che gia' conosce: trova, risolvi, whitelist, info.
    const applica = corpoFunzione(indexNew, 'async function applicaConfronto(');

    assert.match(applica, /reportConfronti\.confrontoConSeStessa\(lista\.records, campiOsservati\)/);
    assert.match(applica, /reportConfronti\.indicizzaPerPresenza/);
    assert.match(applica, /reportConfronti\.differenzePerPresenza\(\s*differenzeConfronto, codiceGruppo, idRecScheda\)/);
    //Marcate, cosi' si distinguono da quelle dell'analisi di integrita'.
    assert.match(applica, /origine: "confronto"/);
});

test('nella riga le due cose restano separate, e il Fix vale solo per l\'integrita\'', () => {
    const pannello = corpoFunzione(confronti, '_buildPanelCambiati(records) {');

    assert.match(pannello, /const segnalazioniIntegrita = tutteLeDifferenze\.filter\(d => d\?\.origine !== "confronto"\)/);
    assert.match(pannello, /const differenzeConfronto = tutteLeDifferenze\.filter\(d => d\?\.origine === "confronto"\)/);
    assert.match(pannello, /this\._crRiquadroConfronto\(differenzeConfronto\)/);

    //Il Fix rifa' il box: senza segnalazioni di integrita' non c'e' niente da rifare.
    assert.match(pannello, /if \(segnalazioniIntegrita\.length > 0\) \{\s*\n\s*actions\.appendChild\(btnFix\);/);

    //Gli altri pulsanti restano disponibili comunque.
    assert.match(pannello, /actions\.appendChild\(btnResolve\)/);
    assert.match(pannello, /actions\.appendChild\(btnWhitelist\)/);

    const riquadro = corpoFunzione(confronti, '_crRiquadroConfronto(differenze) {');
    assert.match(riquadro, /Campi osservati \(confronto\)/);
    assert.match(riquadro, /COLORI_STATO\.differente/);
});

test('anche le referenze nuove dicono cosa e\' cambiato', () => {
    //Una referenza non ancora impaginata puo' avere campi osservati cambiati, ed e' proprio
    //quello che serve sapere prima di decidere dove metterla.
    const estrai = corpoFunzione(confronti, '_estraiNuoviDaLista(report, listaTracciato) {');
    assert.match(estrai, /reportConfronti\.differenzePerPresenza\(/);
    assert.match(estrai, /confronto: confrontoRiga != null \? reportConfronti\.testoDifferenze/);

    //E la tabella ha la sua colonna, in fondo a destra: serve quando serve, e non deve rubare
    //spazio a codice e descrizione.
    const tabella = corpoFunzione(confronti, '_renderNuoviTable() {');
    assert.match(tabella, /const colonnaConfronto = \{\s*\n\s*key: "confronto"/);
    assert.match(tabella, /const colonne = \[\.\.\.colonneBase, \.\.\.colonneExtraFiltrate, colonnaConfronto\]/);
});

test('la tabella dei nuovi ha una larghezza vera, e quindi scorre', () => {
    const pannello = corpoFunzione(confronti, '_buildPanelNuovi(report) {');

    //Lo scorrimento laterale non e' piu' del contenitore: in UXP non funziona in nessun modo
    //nativo. Lo fa la barra disegnata dal plugin, spostando la tabella.
    assert.match(pannello, /tableScroll\.style\.overflowX = "hidden"/);
    assert.match(pannello, /tableScroll\.style\.overflowY = "scroll"/);
    assert.match(pannello, /this\._crBarraScorrimentoNuovi\(this\._confrontoNuoviState\)/);

    //La larghezza in pixel resta: e' quella che dice alla barra quanto c'e' da scorrere.
    //Conta le sole colonne dei dati, perche' quella dei pulsanti non si sposta.
    const render = corpoFunzione(confronti, '_renderNuoviTable() {');
    assert.match(render, /const larghezzaTotale = this\._larghezzaTotaleColonne\(colonneDati\)/);
    assert.match(render, /state\.table\.style\.width = larghezzaTotale \+ "px"/);
    assert.match(render, /state\.headerRow\.style\.width = larghezzaTotale \+ "px"/);
    assert.doesNotMatch(senzaCommenti(pannello), /fit-content/);
    //Dopo ogni ridisegno tabella e cursore tornano in accordo.
    assert.match(render, /this\._scorriNuovi\(state, state\.spostamento \|\| 0\)/);

    //Position sticky non si usa: in UXP non viene ignorato, toglie la cella dal flusso e manda
    //la colonna fuori dal riquadro. Il ritorno sarebbe una schermata rotta, non un pareggio.
    const codice = senzaCommenti(confronti);
    assert.ok(!codice.includes('sticky'), 'sticky e\' tornato: in UXP rompe la tabella');
});

test('i pulsanti dei nuovi stanno in una colonna che non si sposta', () => {
    //Due colonne dentro l'unico contenitore che scorre in verticale: cosi' scorrono insieme
    //per costruzione, senza dover sincronizzare niente.
    const pannello = corpoFunzione(confronti, '_buildPanelNuovi(report) {');
    assert.match(pannello, /divisione\.style\.flexDirection = "row"/);
    assert.match(pannello, /divisione\.appendChild\(colonnaAzioni\)/);
    assert.match(pannello, /divisione\.appendChild\(areaDati\)/);
    assert.match(pannello, /tableScroll\.appendChild\(divisione\)/);

    //Lo spostamento laterale e' confinato all'area dei dati: quello che esce resta nascosto.
    assert.match(pannello, /areaDati\.style\.overflow = "hidden"/);
    assert.match(pannello, /areaDati\.appendChild\(table\)/);

    //La tabella che si sposta contiene le sole colonne dei dati; i pulsanti hanno la loro.
    const render = corpoFunzione(confronti, '_renderNuoviTable() {');
    assert.match(render, /const colonneDati = colonne\.filter\(col => col\.key !== "__azione__"\)/);
    assert.match(render, /state\.headerAzioni\.appendChild\(this\._crNuoviHeaderCell\(colonnaAzione\)\)/);
    assert.match(render, /state\.bodyAzioni\.appendChild\(this\._crNuoviActionCell\(state\.rowsCurrent\[i\]\)\)/);
    assert.match(render, /this\._crNuoviDataRow\(state\.rowsCurrent\[i\], colonneDati\)/);

    //La riga dei dati non costruisce piu' i pulsanti, altrimenti comparirebbero due volte.
    const riga = corpoFunzione(confronti, '_crNuoviDataRow(rowData, colonne) {');
    assert.doesNotMatch(riga, /this\._crNuoviActionCell/);

    //La parte visibile che interessa alla barra e' quella dei dati, non tutto il contenitore.
    const misure = corpoFunzione(confronti, '_misureScorrimentoNuovi(state) {');
    assert.match(misure, /areaDati/);

    //Le due colonne restano appaiate solo se le altezze restano imposte.
    const cella = corpoFunzione(confronti, '_crNuoviActionCell(rowData) {');
    assert.match(cella, /cell\.style\.minHeight = "42px"/);
    assert.match(cella, /cell\.style\.maxHeight = "42px"/);
});

test('la barra di scorrimento funziona anche senza trascinamento', () => {
    //Frecce e clic sulla traccia usano solo "click", che nel plugin funziona di sicuro: se il
    //trascinamento non arrivasse, la tabella si scorre lo stesso.
    const barra = corpoFunzione(confronti, '_crBarraScorrimentoNuovi(state) {');

    assert.match(barra, /indietro\.addEventListener\("click"/);
    assert.match(barra, /avanti\.addEventListener\("click"/);
    assert.match(barra, /traccia\.addEventListener\("click"/);
    assert.match(barra, /cursore\.addEventListener\("mousedown"/);

    //I conti stanno nel modulo verificato, non qui.
    assert.match(barra, /barraScorrimento\.spostamentoDaClic/);

    const scorri = corpoFunzione(confronti, '_scorriNuovi(state, spostamento) {');
    assert.match(scorri, /barraScorrimento\.limitaSpostamento/);
    assert.match(scorri, /state\.table\.style\.marginLeft = "-" \+ state\.spostamento \+ "px"/);

    //Le misure si leggono al momento dell'uso: alla costruzione il pannello non e' impaginato.
    const misure = corpoFunzione(confronti, '_misureScorrimentoNuovi(state) {');
    assert.match(misure, /clientWidth/);

    //Il trascinamento si ascolta sul documento, non sul cursore: il mouse ne esce subito.
    const trascinamento = corpoFunzione(confronti, '_abilitaTrascinamentoBarra() {');
    assert.match(trascinamento, /\$\(document\)\.on\("mousemove"/);
    assert.match(trascinamento, /\$\(document\)\.on\("mouseup"/);
});

test('nel csv i cambiamenti di confronto stanno in una colonna sola', () => {
    const build = corpoFunzione(confronti, '_buildReportConfrontoCsv(report) {');

    //Una colonna per referenza, non righe in piu'.
    assert.match(build, /confronto: confronto/);
    assert.doesNotMatch(build, /stato: "Differente"/);
    //Le segnalazioni di confronto non si ripetono anche fra le differenze.
    assert.match(build, /const differenze = tutte\.filter\(d => d\?\.origine !== "confronto"\)/);

    const testo = corpoFunzione(confronti, '_testoConfrontoDelRecord(record) {');
    assert.match(testo, /filter\(d => d\?\.origine === "confronto"\)/);
});

test('la scheda Confronti resta in attesa del confronto con altre liste', () => {
    const pannello = corpoFunzione(confronti, '_buildPanelConfronti() {');

    assert.match(pannello, /Nessuna lista di confronto selezionata/);
    //E dice dove sono finite le differenze con se stessa, per non farle cercare.
    assert.match(pannello, /scheda Cambiati/);

    //La linguetta non conta piu' nulla: il conteggio dei differenti e' confluito nei Cambiati.
    const compila = corpoFunzione(confronti, 'compilaReportConfronto(report, options = {}) {');
    assert.doesNotMatch(compila, /etichettaLinguetta\("Differenti"/);
    assert.match(compila, /this\._crTabButton\("Confronti", false, "Confronti"\)/);
});

test('il Trova apre la scheda referenza vera, non una sua copia', () => {
    const azione = corpoFunzione(confronti, '_eseguiAzioneConfronto(action, payloadId, payload) {');
    assert.match(azione, /case "find":\s*\n\s*await this\._apriSchedaDalReport\(payloadId, payload\)/);

    const apri = corpoFunzione(confronti, '_apriSchedaDalReport(payloadId, payload) {');

    //Prima porta l'operatore sul box, come faceva il Trova di prima.
    assert.match(apri, /const box = this\._findElemento\(payload\)/);

    //Poi chiude il report e apre la scheda dallo stesso punto da cui la apre l'evento di
    //selezione: e' quello che garantisce un flusso solo.
    assert.match(apri, /Utility\.chiudiModal\(\)/);
    assert.match(apri, /schedaRef\.initSchedaRef\(this\._refPerSchedaDalReport\(box, dna\)\)/);

    //La ref la compone il modulo verificato, non questo file.
    const ref = corpoFunzione(confronti, '_refPerSchedaDalReport(box, dna) {');
    assert.match(ref, /schedaRef\.refDalBoxPerReport\(box, dna/);

    //Nessuna copia della scheda: il report non ricostruisce i suoi pannelli.
    const codice = senzaCommenti(confronti);
    assert.ok(!codice.includes('editReferenza'), 'la scheda non si ridisegna dentro il report');
});

test('dalla scheda aperta dal report non si scappa', () => {
    const blocco = corpoFunzione(confronti, '_applicaBloccoSchedaDalReport() {');

    //Le voci nascoste sono quelle dichiarate nella scheda, non una lista scritta qui.
    assert.match(blocco, /schedaRef\.DAL_REPORT_VOCI_BARRA_NASCOSTE/);
    assert.match(blocco, /schedaRef\.DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE/);

    //Gli eventi restano fermi: la scheda li libera uscendo da diversi suoi flussi, quindi il
    //blocco va riaffermato, non solo impostato all'apertura.
    assert.match(blocco, /indesignEvents\.setBusy\(true\)/);

    const vigila = corpoFunzione(confronti, '_vigilaSchedaDalReport() {');
    assert.match(vigila, /this\._applicaBloccoSchedaDalReport\(\)/);
    assert.match(vigila, /schedaRef\.serveRiaggancioDalReport\(stato\.box\)/);

    //Si esce solo dalla X: sgruppamenti e raggruppamenti deselezionano e riselezionano il box,
    //e una deselezione non vuol dire che l'operatore ha finito.
    const chiusura = corpoFunzione(confronti, '_crChiusuraSchedaDalReport() {');
    assert.match(chiusura, /bottone\.on\("click", \(\) => this\._chiudiSchedaDalReport\(\)\)/);
});

test('il box rifatto non lascia la scheda appesa al box morto', () => {
    //Reimpagina e cambi strutturali creano un box nuovo: con gli eventi fermi nessuno ripunta
    //la scheda, e allora la ripunta il report.
    const riaggancio = corpoFunzione(confronti, '_riagganciaSchedaDalReport() {');
    assert.match(riaggancio, /this\._resolveBoxByCodiceGruppo\(stato\.record\)/);
    assert.match(riaggancio, /schedaRef\.initSchedaRef\(this\._refPerSchedaDalReport\(box, dna\)\)/);

    //Se il box non si ritrova, la scheda si chiude e il report si aggiorna.
    assert.match(riaggancio, /this\._chiudiSchedaDalReport\(\)/);
});

test('chiudendo la scheda la referenza si ricontrolla da sola', () => {
    const chiudi = corpoFunzione(confronti, '_chiudiSchedaDalReport() {');

    //Una volta sola: la X si puo' premere due volte e il riaggancio puo' arrivarci insieme.
    assert.match(chiudi, /this\._schedaDalReport = null/);
    assert.match(chiudi, /clearInterval\(stato\.timer\)/);
    assert.match(chiudi, /await this\._ricontrollaReferenzaDopoScheda\(stato\)/);
    assert.match(chiudi, /this\._riapriReportDopoScheda\(\)/);

    const ricontrollo = corpoFunzione(confronti, '_ricontrollaReferenzaDopoScheda(stato) {');

    //La scheda si rilegge dal server: i record con cui il report e' nato sono di prima che
    //l'operatore ci mettesse mano.
    assert.match(ricontrollo, /await this\._leggiSchedaRefAggiornata\(stato\.codiceGruppo, stato\.idRec\)/);
    //La preanalisi e' quella del report, sul box che abbiamo in mano, che puo' essere nuovo.
    assert.match(ricontrollo, /await preAnalisiBoxMappato\(records, record\.elementoMappa, box\)/);
    //Le decisioni stanno nel modulo verificato.
    assert.match(ricontrollo, /reportIntegritaAvvio\.differenzeDopoRicontrollo\(/);
    assert.match(ricontrollo, /reportIntegritaAvvio\.esitoChiusuraScheda\(/);
    //Rifare tutto il report costerebbe quanto aprirlo: qui si tocca una referenza sola.
    assert.doesNotMatch(ricontrollo, /mappaturaImpaginato|syncImpaginatoConServer/);

    //Dalla whitelist non si ricontrolla: quelle segnalazioni sono parcheggiate apposta, e il
    //record non sta nemmeno negli elenchi del report.
    assert.match(ricontrollo, /state\.activeList === "whitelist"/);

    //Il box puo' essere un altro: chi lo cerchera' domani deve trovare questo.
    const riferimenti = corpoFunzione(confronti, '_aggiornaRiferimentiBox(record, box) {');
    assert.match(riferimenti, /record\.inddId = box\.id/);
    assert.match(riferimenti, /record\.elementoMappa\.refId = box\.id/);
});

test('il report che si chiude sotto la scheda non lascia l\'interfaccia bloccata', () => {
    //Al cambio di documento il report si chiude da solo: se l'operatore era dentro la scheda,
    //la barra deve tornare navigabile.
    const chiudiReport = corpoFunzione(confronti, 'chiudiReportIntegrita(motivo = null) {');
    assert.match(chiudiReport, /this\._schedaDalReport != null/);
    assert.match(chiudiReport, /this\._terminaSchedaDalReport\(\)/);

    const termina = corpoFunzione(confronti, '_terminaSchedaDalReport() {');
    assert.match(termina, /\$\("#chiudiSchedaDalReport"\)\.remove\(\)/);
    assert.match(termina, /\$\("#homeImage"\)\.show\(\)/);
});

test('il ricontrollo giudica col dato del server e allinea la lista', () => {
    const ricontrollo = corpoFunzione(confronti, '_ricontrollaReferenzaDopoScheda(stato) {');

    //Il dato riletto e' la verita': sistemando una segnalazione l'operatore allinea il box al
    //server, e una lista rimasta indietro farebbe giudicare il box con un dato che non c'e'
    //piu'.
    assert.match(ricontrollo, /await this\._leggiSchedaRefAggiornata\(stato\.codiceGruppo, stato\.idRec\)/);
    assert.match(ricontrollo, /this\._aggiornaListaKitConRecordFreschi\(records\)/);

    //La preanalisi si rifa' per intero: dice tutto quello che c'e', non solo quello che se ne va.
    assert.match(ricontrollo, /await preAnalisiBoxMappato\(records, record\.elementoMappa, box\)/);
    assert.match(ricontrollo, /reportIntegritaAvvio\.esitoChiusuraScheda\(/);

    //Non applica niente da se': torna il piano, perche' prima si fa vedere cosa se ne va.
    assert.match(ricontrollo, /applica: \(\) =>/);
    assert.match(ricontrollo, /chiaviRisolte/);

    //Una segnalazione che sparisce senza che nessuno abbia toccato niente va spiegata, non
    //subita: la diagnostica confronta il dato del server con quello della lista.
    const diagnostica = corpoFunzione(confronti, '_diagnosticaRicontrollo(record, recordsFreschi, chiaviPrima, preAnalisi) {');
    assert.match(diagnostica, /compiledFields/);
    assert.match(diagnostica, /campi diversi fra server e lista/);

    //La lista si riscrive sul disco e la copia in memoria la segue, altrimenti i Nuovi e il
    //tracciato mostrerebbero il dato vecchio fino al prossimo download.
    const lista = corpoFunzione(confronti, '_aggiornaListaKitConRecordFreschi(recordsFreschi) {');
    assert.match(lista, /reportIntegritaAvvio\.sostituisciRecordNellaLista\(lista\.records, recordsFreschi\)/);
    assert.match(lista, /fs\.writeFileSync\(percorso, JSON\.stringify\(lista\)\)/);
    assert.match(lista, /contenutoKitInLavorazione = lista/);
});

test('una segnalazione che se ne va lo fa vedere', () => {
    const dissolvi = corpoFunzione(confronti, '_dissolviElementi(elementi) {');

    //L'opacita' si scrive a passi e non si legge mai: in UXP una misura appena scritta non e'
    //affidabile, e delle animazioni di jQuery nel plugin non c'e' un uso vivo.
    assert.match(dissolvi, /el\.style\.opacity = String\(opacita\)/);
    assert.match(dissolvi, /setInterval/);
    assert.doesNotMatch(dissolvi, /fadeOut|\.animate\(/);

    //Tutte le azioni che tolgono una riga la fanno prima sfumare.
    ['_resolveSegnalazione(payloadId, payload) {',
     '_mandaInWhitelist(payloadId, payload) {',
     '_ripristinaDaWhitelist(payloadId, payload) {',
     '_deleteElemento(payloadId, payload) {',
     '_fixElemento(payloadId, payload) {'].forEach(firma => {
        const corpo = corpoFunzione(confronti, firma);
        assert.match(corpo, /await this\._dissolviRiga\(payloadId\)/, firma + ' deve dissolvere la riga');
    });

    //I pulsanti delle righe sono immagini: disabled non esiste e pointer-events in UXP non e'
    //verificabile, quindi il blocco vero e' un interruttore, che non dipende dallo stile.
    const azione = corpoFunzione(confronti, '_onConfrontoAction(ev, action) {');
    assert.match(azione, /if \(this\.azioneReportInCorso\(\)\)/);
    assert.match(azione, /this\._azioneReportInCorso = true/);
    assert.match(azione, /this\._azioneReportInCorso = false/);

    //Alla chiusura della scheda si vede andare via quello che e' stato risolto, e solo dopo lo
    //stato cambia.
    const chiudi = corpoFunzione(confronti, '_chiudiSchedaDalReport() {');
    assert.match(chiudi, /this\._riapriReportDopoScheda\(\)[\s\S]*await this\._mostraSegnalazioniRisolte\(piano\)[\s\S]*piano\.applica\(\)/);
});

test('dalla scheda aperta dal report non si rifa la struttura del gruppo', () => {
    //Le azioni strutturali della schermata di edit non si offrono a chi e' venuto a sistemare
    //una segnalazione. La scheda normale resta com'e'.
    assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), true);

    schedaRef.apertaDalReport = true;
    assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), false);
    schedaRef.apertaDalReport = false;

    const sorgenteScheda = sorgente('schedaRef.js');
    assert.match(sorgenteScheda, /getCambioStrutturalePath != null && me\.mostraAzioniStrutturaliInEdit\(\)/);

    //L'interruttore lo accende il report, non la scheda.
    const apri = corpoFunzione(confronti, '_apriSchedaDalReport(payloadId, payload) {');
    assert.match(apri, /schedaRef\.apertaDalReport = true/);
    const termina = corpoFunzione(confronti, '_terminaSchedaDalReport() {');
    assert.match(termina, /schedaRef\.apertaDalReport = false/);
});

test('la descrizione applicata si vede anche in edit', () => {
    const sorgenteScheda = sorgente('schedaRef.js');

    //Il pulsante compare solo se box e server non dicono la stessa cosa, e il giudizio lo da'
    //la stessa preanalisi del report, sul solo campo della descrizione.
    assert.match(sorgenteScheda, /if \(await this\.descrizioneDisallineata\(this\.schedeRefDati, box\)\)/);
    assert.match(sorgenteScheda, /confronti\.confrontoBoxCompiledFieldPreAnalisi\(\s*\n\s*box,\s*\n\s*\[campo\]/);

    //La schermata di edit legge il box: dopo averlo cambiato va rifatta, altrimenti mostra
    //ancora la descrizione di prima.
    const applica = corpoFunzione(sorgenteScheda, 'applicaDescrizioneDaServer() {');
    assert.match(applica, /Utility\.applicaTagStringToInndTextFrame\(campo, contenuto, box\.geometricBounds\)/);
    assert.match(applica, /await this\.selectSchedaRef\(1\)/);
});

test('un ricontrollo che non decide non scrive niente', () => {
    const ricontrollo = corpoFunzione(confronti, '_ricontrollaReferenzaDopoScheda(stato) {');

    //L'esito tiene conto degli errori dell'analisi e dell'assenza di dati da confrontare.
    assert.match(ricontrollo, /nienteDaConfrontare: !reportIntegritaAvvio\.ciSonoDatiDaConfrontare\(dati\)/);
    assert.match(ricontrollo, /this\._avvisaRicontrolloNonRiuscito\(esito\.motivo\)/);

    //Niente si dissolve se niente e' stato risolto davvero.
    assert.match(ricontrollo, /esito\.azione === "invariato"\s*\n\s*\? \[\]/);

    //Nel caso invariato non si sovrascrivono l'analisi del record, i suoi dati e la lista.
    const applica = ricontrollo.slice(ricontrollo.indexOf('applica: () =>'));
    const uscita = applica.indexOf('if (esito.azione === "invariato")');
    assert.ok(uscita >= 0, 'il caso invariato deve uscire prima di scrivere');
    assert.ok(applica.indexOf('record.preAnalisi = preAnalisi') > uscita,
        "l'analisi del record non si scrive prima di sapere se vale");
    assert.ok(applica.indexOf('this._aggiornaListaKitConRecordFreschi(records)') > uscita,
        'la lista del kit non si riscrive con un dato non verificato');

    //Prima di dire che il box non c'e' piu' lo si cerca come lo cerca il Trova.
    assert.match(ricontrollo, /box = this\._resolveBoxFromRecord\(record\)/);

    //La diagnostica riporta anche gli errori dell'analisi: sono la spiegazione del caso.
    const diagnostica = corpoFunzione(confronti, '_diagnosticaRicontrollo(record, recordsFreschi, chiaviPrima, preAnalisi) {');
    assert.match(diagnostica, /errori dell'analisi/);
});

test('il box della scheda dal report se lo tiene il report', () => {
    //La selezione dell'operatore va e viene, e la scheda svuotandosi perde il suo riferimento:
    //se il ricontrollo dipendesse da loro, una deselezione basterebbe a impedirlo.
    const apri = corpoFunzione(confronti, '_apriSchedaDalReport(payloadId, payload) {');
    assert.match(apri, /\n\s+box,\s/);

    const vigila = corpoFunzione(confronti, '_vigilaSchedaDalReport() {');
    assert.match(vigila, /schedaRef\.serveRiaggancioDalReport\(stato\.box\)/);

    const riaggancio = corpoFunzione(confronti, '_riagganciaSchedaDalReport() {');
    assert.match(riaggancio, /stato\.box = box/);

    const ricontrollo = corpoFunzione(confronti, '_ricontrollaReferenzaDopoScheda(stato) {');
    assert.match(ricontrollo, /let box = schedaRef\.serveRiaggancioDalReport\(stato\.box\) \? null : stato\.box/);

    //Quello che conta e' se il riferimento e' ancora valido, e lo si chiede al box.
    const codice = senzaCommenti(confronti);
    assert.ok(!codice.includes('schedaRef.refSelected'),
        'il report non deve leggere il box dalla scheda');
    assert.ok(!/=\s*app\.selection/.test(codice),
        'il report non deve leggere il box dalla selezione');
});
