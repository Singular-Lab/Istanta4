/*
 * I20-1018: il log di crash non veniva mai scritto.
 *
 * writeDebugMessageForCrash scriveva in pathLavorazione + percorsoLogs, ma percorsoLogs e' gia'
 * assoluto dopo impostaPercorsiDiSistema: il Debuglog non compariva, e la scrittura fallita
 * mostrava l'IDX-98 "cartella logs assente" con la cartella al suo posto. Togliere e basta la
 * concatenazione non bastava: aprendo una lavorazione nuova si scrive nel log quando percorsoLogs
 * vale ancora "/Logs/", relativo alla lavorazione. La cartella la dice ora cartellaDeiLog, per
 * writeDebugMessageForCrash e per messaggioUtente.
 *
 * I20-1065: la cartella dei log e' logs sotto quella del documento, creata dal Plugin all'apertura
 * (logPath). Finche' non c'e' i messaggi vanno a video e in console, non su file.
 *
 * indexNew.js fa require('indesign') e sotto Node non si carica: la funzione si estrae dal
 * sorgente e si esegue con i valori delle variabili che legge.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexNew = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'indexNew.js'), 'utf8');

//Il corpo di una funzione, isolato contando le graffe a partire dalla sua intestazione.
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

//I20-1065: cartellaDeiLog con logPath dato da fuori. La cartella logs la crea il Plugin
//all'apertura (preparaCartelleDiSistema): la scelta dell'operatore e il valore relativo "/Logs/"
//non ci sono piu'.
const corpo = corpoFunzione(indexNew, 'function cartellaDeiLog()');
const crea = new Function('logPath', corpo + '\nreturn cartellaDeiLog();');

test('la cartella dei log e\' logs sotto il documento, come l\'ha preparata il Plugin', () => {
    assert.strictEqual(crea('/Users/operatore/Lavori/Promo_42/logs/'), '/Users/operatore/Lavori/Promo_42/logs/');
});

//Prima che le cartelle siano pronte non c'e' un posto dove scrivere, e non si inventa.
test('finche\' le cartelle non sono pronte la cartella dei log e\' vuota', () => {
    assert.strictEqual(crea(''), '');
    assert.strictEqual(crea(undefined), '');
});

test('writeDebugMessageForCrash e messaggioUtente chiedono la cartella a cartellaDeiLog, e senza non scrivono', () => {
    const crash = corpoFunzione(indexNew, 'function writeDebugMessageForCrash(msg)');
    const messaggio = corpoFunzione(indexNew, 'async function messaggioUtente(');

    assert.match(crash, /var cartellaLog = cartellaDeiLog\(\);\s*if \(cartellaLog === ""\) \{\s*return;\s*\}/);
    assert.match(messaggio, /var cartellaLog = cartellaDeiLog\(\);/);
    //Il messaggio va comunque a video e in console: solo il file aspetta la cartella. Senza
    //questo controllo il primo messaggio diceva "cartella logs assente" e poi non piu'.
    assert.match(messaggio, /if \(!dontWriteInLogs && cartellaLog !== ""\) \{/);
});

test('nessuno usa piu\' i percorsi dei log e dell\'esportazione scelti dall\'operatore', () => {
    const { fileDelPlugin, leggiFileDelPlugin } = require('./fileDelPlugin');
    for (const file of fileDelPlugin()) {
        const codice = leggiFileDelPlugin(file).split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
        assert.doesNotMatch(codice, /\bpercorsoLogs\b|\bdefaultPercorsoLogs\b|\bpercorsoEsportazione\b|\bpercorsoLavorazioni\b/, file);
    }
});

/* ---- I20-1038: la riga di log dice da quale macchina viene, e IDX-27 dice dove e' scattato ---- */

//Estrae una funzione di indexNew.js per nome, con le parentesi bilanciate.
function estrai(nome) {
    const inizio = indexNew.indexOf('\nfunction ' + nome + '(');
    assert.notStrictEqual(inizio, -1, nome + ' non trovata');
    const apertura = indexNew.indexOf('{', inizio);
    let livello = 0;
    for (let i = apertura; i < indexNew.length; i++) {
        if (indexNew[i] === '{') livello++;
        else if (indexNew[i] === '}' && --livello === 0) return indexNew.substring(inizio + 1, i + 1);
    }
    throw new Error('parentesi non bilanciate in ' + nome);
}

const nomeMacchina = new Function('require', 'var nomeMacchinaCache = null;\n' + estrai('nomeMacchina') + '\nreturn nomeMacchina;')(() => { throw new Error('niente os'); });

test('il nome della macchina viene da hostname, poi dall\'utente, poi dalla home', () => {
    assert.strictEqual(nomeMacchina({ hostname: () => 'macstudio06.local' }), 'macstudio06.local');
    assert.strictEqual(nomeMacchina({ hostname: () => { throw new Error('no'); }, userInfo: () => ({ username: 'elisa' }) }), 'elisa');
    assert.strictEqual(nomeMacchina({ hostname: () => '', userInfo: () => { throw new Error('no'); }, homedir: () => '/Users/macstudio11/' }), 'macstudio11');
});

test('senza nessuna informazione il nome e\' "sconosciuta", senza mai un errore', () => {
    assert.strictEqual(nomeMacchina({}), 'sconosciuta');
    //Senza il modulo os (il require finto lancia) vale lo stesso.
    assert.strictEqual(nomeMacchina(), 'sconosciuta');
});

test('tutte e due le righe di log portano il campo macchina', () => {
    const scrittori = ['async function messaggioUtente(', 'function writeDebugMessageForCrash('];
    for (const intestazione of scrittori) {
        const corpo = corpoFunzione(indexNew, intestazione);
        assert.match(corpo, /orario: [^\n]*\n\s*macchina: nomeMacchina\(\),/, intestazione);
    }
});

const contestoErroreFiltro = new Function(estrai('contestoErroreFiltro') + '\nreturn contestoErroreFiltro;')();

test('il contesto di IDX-27: pagina e ref quando ci sono, altrimenti lo dice', () => {
    assert.strictEqual(contestoErroreFiltro(null, null), 'prima del primo risultato');
    assert.strictEqual(contestoErroreFiltro({ pag: 12 }, null), 'pagina 12');
    assert.strictEqual(contestoErroreFiltro({ pag: 12 }, { 'Scatto.CodiceGruppo': 6147585, 'Descrizioni.Descrizione1': 'PARMIGIANO REGGIANO DOP' }),
        'pagina 12, ref 6147585 (PARMIGIANO REGGIANO DOP)');
    //Una ref strana non fa saltare il catch che lo chiama.
    assert.strictEqual(contestoErroreFiltro({ pag: 3 }, Object.create(null, { 'Scatto.CodiceGruppo': { get() { throw new Error('boom'); } } })), 'pagina 3');
});

test('il catch IDX-27 usa il contesto senza stack, tace gli errori gia\' segnalati, e la ref si azzera a ogni pagina nei due rami', () => {
    assert.match(indexNew, /if \(!\(ex != null && ex\.giaSegnalato === true\)\) \{\s*messaggioUtente\("Code IDX-27 Filtro: Errore durante l'elaborazione del filtro \(Deb1\) \[" \+ contestoErrore \+ "\]: " \+ ex, "error"\);/);
    assert.match(indexNew, /logContent \+= "Errore durante l'elaborazione del filtro \[" \+ contestoErrore \+ "\]: " \+ ex\.toString\(\) \+ "\\n" \+ \(ex != null && ex\.stack != null \? ex\.stack \+ "\\n" : ""\);/);
    assert.strictEqual((indexNew.match(/itemRef = null; \/\/I20-1038/g) || []).length, 2);
});

/* ---- I20-1038: la griglia dalla libreria, con l'errore rivolto a chi fa le librerie ---- */

//Una libreria InDesign finta: itemByName restituisce un riferimento non valido se il nome manca,
//come fa InDesign; everyItem().getElements() elenca gli asset, doppioni compresi.
function libreriaFinta(nomiAsset) {
    return {
        name: 'Griglie_IS2_EDRO_PL_',
        assets: {
            itemByName: nome => ({ name: nome, isValid: nomiAsset.includes(nome) }),
            everyItem: () => ({ getElements: () => nomiAsset.map(n => ({ name: n, isValid: true })) })
        }
    };
}

function caricaGrigliaDallaLibreria() {
    const messaggi = [];
    const fn = new Function('messaggioUtente', estrai('grigliaDallaLibreria') + '\nreturn grigliaDallaLibreria;')((msg, stile) => messaggi.push({ msg, stile }));
    return { fn, messaggi };
}

test('la griglia si prende con il lato, altrimenti senza, in silenzio se la libreria e\' a posto', () => {
    const { fn, messaggi } = caricaGrigliaDallaLibreria();
    assert.strictEqual(fn(libreriaFinta(['4x4_CN_SX', '4x4_CN_DX']), '4x4_CN', '_DX', 1).name, '4x4_CN_DX');
    assert.strictEqual(fn(libreriaFinta(['4x4_CN']), '4x4_CN', '_DX', 1).name, '4x4_CN');
    assert.deepStrictEqual(messaggi, []);
});

test('il caso di produzione: due 4x4_CN_SX e nessun _DX', () => {
    const { fn, messaggi } = caricaGrigliaDallaLibreria();
    //Pagina 1, lato DX: manca, e lo si dice a chi fa le librerie, poi ci si ferma.
    assert.throws(() => fn(libreriaFinta(['4x4_CN_SX', '4x4_CN_SX']), '4x4_CN', '_DX', 1), err => {
        assert.strictEqual(err.giaSegnalato, true);
        assert.match(err.message, /^Code IDX-169 Filtro: nella libreria 'Griglie_IS2_EDRO_PL_' manca la griglia '4x4_CN_DX' \(cercata anche come '4x4_CN'\), richiesta dal server per la pagina 1\./);
        return true;
    });
    assert.strictEqual(messaggi.length, 1);
    assert.strictEqual(messaggi[0].stile, 'error');
    assert.match(messaggi[0].msg, /la libreria va completata con l'asset mancante/);
    //Pagina 2, lato SX: c'e', ma e' doppia: avviso e si va avanti con la prima.
    assert.strictEqual(fn(libreriaFinta(['4x4_CN_SX', '4x4_CN_SX']), '4x4_CN', '_SX', 2).name, '4x4_CN_SX');
    assert.strictEqual(messaggi.length, 2);
    assert.strictEqual(messaggi[1].stile, 'warning');
    assert.match(messaggi[1].msg, /^Code IDX-170 Filtro: nella libreria 'Griglie_IS2_EDRO_PL_' ci sono 2 asset chiamati '4x4_CN_SX'/);
});

test('i rami di impaginazione e conteggio passano dalla stessa ricerca', () => {
    assert.strictEqual((indexNew.match(/var grigliaTemplate = grigliaDallaLibreria\(libreria, nome_griglia, suffix, filtroResult\.pag\);\r?\n\s*grigliaTemplate = grigliaTemplate\.placeAsset\(docInLavorazione\)\[0\];/g) || []).length, 2);
    assert.doesNotMatch(indexNew, /IDX-168/);
});
