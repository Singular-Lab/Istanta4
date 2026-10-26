/*
 * I20-1017: la compilazione automatica dei campi del kit non aveva mai funzionato.
 *
 * autoCompilazioneCampiKit dovrebbe ricavare dal nome del documento promo, canale, area e
 * formato, riempire le quattro tendine della scelta kit e, se le trova tutte, far partire la
 * ricerca. I motivi per cui non succedeva erano quattro: il risultato del decoder si buttava via,
 * i nomi dei campi letti non erano quelli restituiti, al decoder arrivava il solo nome del file
 * invece del percorso, e le tendine confrontano il guidID mentre il decoder da' nomi e sigle.
 *
 * Secondo giro: il metodo principale legge tutto dal nome del file, <NOME PROMO>_<CANALE><AREA>
 * (decodificaNomeFileConPromo); il primo metodo, con la promo nel nome della cartella, resta
 * come riserva.
 *
 * indexNew.js e custom.js fanno require('indesign') e sotto Node non si caricano: le funzioni si
 * estraggono dal sorgente e si eseguono. I due decoder sono quelli veri dell'archivio di Edro21.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cartellaPlugin = path.join(__dirname, '..', '..', 'plugin');
const indexNew = fs.readFileSync(path.join(cartellaPlugin, 'indexNew.js'), 'utf8');
const customEdro = fs.readFileSync(path.join(cartellaPlugin, 'Agenzie', 'Edro21', 'custom.js'), 'utf8');

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

const percorsoCompletoDocumento = new Function('return ' + corpoFunzione(indexNew, 'function percorsoCompletoDocumento('))();
const opzioniKitDaNomeFile = new Function('return ' + corpoFunzione(indexNew, 'function opzioniKitDaNomeFile('))();
//Il decoder e' un metodo di customAgenzia: lo si rende una funzione, con il require di Node per 'os'.
const decodificaNomeFile = new Function('require', 'return function ' + corpoFunzione(customEdro, 'decodificaNomeFile(fullPath)'))(require);
const decodificaNomeFileConPromo = new Function('return function ' + corpoFunzione(customEdro, 'decodificaNomeFileConPromo(nomeFile, nomiPromo, codiciFormato)'))();
const sceltaKitCompleta = new Function('return ' + corpoFunzione(indexNew, 'function sceltaKitCompleta('))();

/* ---- elenchi finti, come quelli di ficoProcess ---- */

const CANALE_SC = { guidID: 'c-sc', sigla: 'SC' };
const CANALE_SS = { guidID: 'c-ss', sigla: 'SS' };
const AREA_TO = { guidID: 'a-to', sigla: 'TO' };
const AREA_FI = { guidID: 'a-fi', sigla: 'FI' };
const canali = [CANALE_SC, CANALE_SS];
const aree = [AREA_TO, AREA_FI];
const formati = [
    { guidID: 'f-vol', titolo: 'Volantino', codice: 'VOL' },
    { guidID: 'f-a4f2', titolo: 'A4 Flusso 2', codice: 'A4_FLUSSO2' }
];
const promoAperte = [
    { guidID: 'p-2515', nomePromo: 'A2515_SC_27-06-25', promoTracciatis: [{ guidCanale: 'c-sc', guidArea: 'a-to' }] },
    { guidID: 'p-2621', nomePromo: 'P2621_08-10-26', promoTracciatis: [{ guidCanale: 'c-ss', guidArea: 'a-fi' }] }
];

const opzioni = decodificato => opzioniKitDaNomeFile(decodificato, promoAperte, canali, aree, formati);

/* ---- il percorso che riceve il decoder ---- */

test('il decoder riceve il percorso completo, cartella e nome del file', () => {
    assert.strictEqual(percorsoCompletoDocumento('/Users/op/Lavori/A2515_SC_27-06-25', 'VOL_SCTO_prova.indd'),
        '/Users/op/Lavori/A2515_SC_27-06-25/VOL_SCTO_prova.indd');
    assert.strictEqual(percorsoCompletoDocumento('/Users/op/Lavori/A2515_SC_27-06-25/', 'VOL_SCTO_prova.indd'),
        '/Users/op/Lavori/A2515_SC_27-06-25/VOL_SCTO_prova.indd');
    //Su Windows la cartella ha le barre rovesciate, e il separatore si adegua.
    assert.strictEqual(percorsoCompletoDocumento('C:\\Lavori\\A2515', 'VOL_SCTO_prova.indd'), 'C:\\Lavori\\A2515\\VOL_SCTO_prova.indd');
});

test('senza cartella o senza nome non si costruisce un percorso', () => {
    assert.strictEqual(percorsoCompletoDocumento('', 'VOL_SCTO.indd'), null);
    assert.strictEqual(percorsoCompletoDocumento('/Users/op', ''), null);
    assert.strictEqual(percorsoCompletoDocumento(null, null), null);
});

/* ---- dal nome del file alle quattro opzioni, con il decoder vero ---- */

test('un file nominato secondo le regole di Edro21 da\' le quattro opzioni', () => {
    const decodificato = decodificaNomeFile('/Users/op/Lavori/A2515_SC_27-06-25/VOL_SCTO_prova.indd');

    assert.deepStrictEqual(decodificato, { nomePromo: 'A2515_SC_27-06-25', siglaFormato: 'VOL', siglaCanale: 'SC', siglaArea: 'TO' });
    assert.deepStrictEqual(opzioni(decodificato), { guidPromo: 'p-2515', guidCanale: 'c-sc', guidArea: 'a-to', guidFormato: 'f-vol' });
});

test('il formato A4 FLUSSO2, che il decoder tratta a parte, si trova anche lui', () => {
    const decodificato = decodificaNomeFile('/Users/op/Lavori/A2515_SC_27-06-25/A4_FLUSSO2_SCTO_prova.indd');

    assert.strictEqual(opzioni(decodificato).guidFormato, 'f-a4f2');
});

/* ---- quello che non si trova resta vuoto ---- */

test('una cartella che non e\' una promo aperta non seleziona promo, canale e area', () => {
    const scelte = opzioni(decodificaNomeFile('/Users/op/x task 580/VOL_SCTO_prova.indd'));

    assert.strictEqual(scelte.guidPromo, null);
    assert.strictEqual(scelte.guidCanale, null);
    assert.strictEqual(scelte.guidArea, null);
    //Il formato non dipende dalla promo.
    assert.strictEqual(scelte.guidFormato, 'f-vol');
});

//La tendina di canale e area mostra solo quelli della promo: una sigla di un'altra non vale.
test('canale e area che la promo non ha non vengono selezionati', () => {
    const scelte = opzioni({ nomePromo: 'A2515_SC_27-06-25', siglaFormato: 'VOL', siglaCanale: 'SS', siglaArea: 'FI' });

    assert.strictEqual(scelte.guidPromo, 'p-2515');
    assert.strictEqual(scelte.guidCanale, null);
    assert.strictEqual(scelte.guidArea, null);
});

test('un formato sconosciuto non seleziona niente', () => {
    assert.strictEqual(opzioni({ nomePromo: 'A2515_SC_27-06-25', siglaFormato: 'XYZ', siglaCanale: 'SC', siglaArea: 'TO' }).guidFormato, null);
});

test('senza decodifica, o con elenchi mancanti, non si seleziona niente e non si rompe nulla', () => {
    const vuote = { guidPromo: null, guidCanale: null, guidArea: null, guidFormato: null };

    assert.deepStrictEqual(opzioni(null), vuote);
    assert.deepStrictEqual(opzioniKitDaNomeFile({ nomePromo: 'A2515_SC_27-06-25', siglaFormato: 'VOL' }, null, null, null, null), vuote);
    assert.deepStrictEqual(opzioni({}), vuote);
});

/* ---- come la funzione usa tutto questo ---- */

test('autoCompilazioneCampiKit passa il percorso al decoder e ne usa il risultato', () => {
    const corpo = corpoFunzione(indexNew, 'async function autoCompilazioneCampiKit(');

    assert.match(corpo, /var percorso = percorsoCompletoDocumento\(pathLavorazione, docInLavorazione\.name\);/);
    assert.match(corpo, /var decodificato = customAgenzia\.decodificaNomeFile\(percorso\);/);
    assert.match(corpo, /var elenchi = \[ficoProcess\.listaPromoAperte, ficoProcess\.sourceCanali, ficoProcess\.sourceAree, ficoProcess\.sourceFormati\];/);
    assert.match(corpo, /scelte = opzioniKitDaNomeFile\(decodificato, elenchi\[0\], elenchi\[1\], elenchi\[2\], elenchi\[3\]\);/);
    //Il difetto originale: la chiamata senza assegnazione.
    assert.doesNotMatch(corpo, /^\s*customAgenzia\.decodificaNomeFile\(docInLavorazione\.name\);/m);
});

test('dopo la promo si riempiono canale e area, e la ricerca parte solo con tutti e quattro', () => {
    const corpo = corpoFunzione(indexNew, 'async function autoCompilazioneCampiKit(');

    assert.match(corpo, /Menu\.setPickerValue\(\$\("#kitPromoCmb"\), scelte\.guidPromo, false\);[\s\S]*?kitPromoCmb_changed\(\);[\s\S]*?Menu\.setPickerValue\(\$\("#kitCanaliCmb"\)/);
    assert.match(corpo, /if \(sceltaKitCompleta\(scelte\)\) \{\s*ficoProcess\.cercaKit\(/);
});

test('i clienti senza nessuno dei due decoder escono subito, e un errore non ferma l\'apertura', () => {
    const corpo = corpoFunzione(indexNew, 'async function autoCompilazioneCampiKit(');

    assert.match(corpo, /if \(docInLavorazione == null \|\|\s*\(customAgenzia\.decodificaNomeFileConPromo == null && customAgenzia\.decodificaNomeFile == null\)\) \{\s*return;\s*\}/);
    //Ogni metodo ha il suo try: se il principale fallisce si prova la riserva.
    assert.strictEqual((corpo.match(/catch \(e\) \{\s*console\.warn\(/g) || []).length, 2);
});

/* ---- secondo giro: il metodo principale, tutto dal nome del file ---- */

const nomiPromo = ['A2515_SC_27-06-25', 'P2611_vol_21-05-26', 'PE2613_14_MIPREMIO_18-06-26_2', 'P2621_VOL_08-10-26', 'PE2613_14'];
const codiciFormato = ['VOL', 'WEB', 'Manifesti_70/100', 'POP', 'VOL_SC', 'A4_FLUSSO2'];
const dalNome = nome => decodificaNomeFileConPromo(nome, nomiPromo, codiciFormato);

test('dal nome del file si ricavano promo, formato, canale e area, senza guardare la cartella', () => {
    assert.deepStrictEqual(dalNome('P2621_VOL_08-10-26_SSTO.indd'),
        { nomePromo: 'P2621_VOL_08-10-26', siglaFormato: 'VOL', siglaCanale: 'SS', siglaArea: 'TO' });
});

test('dopo canale e area si puo\' aggiungere altro, e senza .indd vale lo stesso', () => {
    assert.deepStrictEqual(dalNome('P2621_VOL_08-10-26_SSTO_v2.indd'),
        { nomePromo: 'P2621_VOL_08-10-26', siglaFormato: 'VOL', siglaCanale: 'SS', siglaArea: 'TO' });
    assert.strictEqual(dalNome('P2621_VOL_08-10-26_SSTO').siglaArea, 'TO');
});

//I nomi delle promo hanno anch'essi dei _: si confrontano interi, e vince il piu' lungo.
test('fra due promo che vanno bene vince quella dal nome piu\' lungo', () => {
    assert.strictEqual(dalNome('PE2613_14_MIPREMIO_18-06-26_2_SSTO.indd').nomePromo, 'PE2613_14_MIPREMIO_18-06-26_2');
    assert.strictEqual(dalNome('PE2613_14_SSTO.indd').nomePromo, 'PE2613_14');
});

test('il formato si riconosce anche in minuscolo, e un codice con il _ si trova intero', () => {
    assert.strictEqual(dalNome('P2611_vol_21-05-26_SCTO.indd').siglaFormato, 'VOL');
    assert.strictEqual(decodificaNomeFileConPromo('X_A4_FLUSSO2_01-01-26_SCTO.indd', ['X_A4_FLUSSO2_01-01-26'], codiciFormato).siglaFormato, 'A4_FLUSSO2');
    //VOL_SC contiene VOL: vince il codice piu' lungo.
    assert.strictEqual(decodificaNomeFileConPromo('Y_VOL_SC_01-01-26_SCTO.indd', ['Y_VOL_SC_01-01-26'], codiciFormato).siglaFormato, 'VOL_SC');
});

test('canale e area scritti in minuscolo valgono come le sigle', () => {
    const d = dalNome('P2621_VOL_08-10-26_ssto.indd');
    assert.strictEqual(d.siglaCanale, 'SS');
    assert.strictEqual(d.siglaArea, 'TO');
});

test('una promo senza formato nel nome, o un nome senza promo aperta, lasciano i vuoti', () => {
    assert.strictEqual(dalNome('A2515_SC_27-06-25_SCTO.indd').siglaFormato, null);
    assert.deepStrictEqual(dalNome('VOL_SSTO_prova.indd'), { nomePromo: null, siglaFormato: null, siglaCanale: null, siglaArea: null });
    assert.deepStrictEqual(dalNome(''), { nomePromo: null, siglaFormato: null, siglaCanale: null, siglaArea: null });
    //Il nome deve proseguire dopo la promo con un _: il solo nome della promo non da' canale e area.
    assert.strictEqual(dalNome('P2621_VOL_08-10-26.indd').nomePromo, null);
});

test('il metodo principale basta solo se trova tutte e quattro le opzioni', () => {
    const promo = [{ guidID: 'p-2621', nomePromo: 'P2621_VOL_08-10-26', promoTracciatis: [{ guidCanale: 'c-ss', guidArea: 'a-to' }] }];
    const aree2 = [{ guidID: 'a-to', sigla: 'TO' }];
    const scelte = opzioniKitDaNomeFile(dalNome('P2621_VOL_08-10-26_SSTO.indd'), promo, canali, aree2, formati);

    assert.deepStrictEqual(scelte, { guidPromo: 'p-2621', guidCanale: 'c-ss', guidArea: 'a-to', guidFormato: 'f-vol' });
    assert.strictEqual(sceltaKitCompleta(scelte), true);
    assert.strictEqual(sceltaKitCompleta(Object.assign({}, scelte, { guidArea: null })), false);
    assert.strictEqual(sceltaKitCompleta(null), false);
});

test('prima il metodo principale; la riserva solo se il principale non le ha trovate tutte', () => {
    const corpo = corpoFunzione(indexNew, 'async function autoCompilazioneCampiKit(');

    const principale = corpo.indexOf('customAgenzia.decodificaNomeFileConPromo(docInLavorazione.name, nomiPromo, codiciFormato)');
    const riserva = corpo.indexOf('customAgenzia.decodificaNomeFile(percorso)');
    assert.ok(principale > 0 && riserva > principale);
    assert.match(corpo, /if \(sceltaKitCompleta\(scelteDalNome\)\) \{\s*scelte = scelteDalNome;\s*\}/);
    assert.match(corpo, /if \(scelte == null && customAgenzia\.decodificaNomeFile != null\) \{/);
});
