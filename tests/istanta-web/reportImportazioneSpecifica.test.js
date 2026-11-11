/*
 * TASK-c4fdc17b: il report dell'importazione (Leggi report, promo.js consultaReport) allineato alla specifica
 * importazione-etichette-versioni.
 *
 * - Filtri per colonna: su ogni colonna l'operatore sceglie quali valori vedere; i filtri di piu' colonne valgono
 *   insieme, e insieme al filtro per stato e alla ricerca (Promo.rigaVisibile). Prima stato e ricerca si
 *   escludevano.
 * - L'etichetta del tracciato e' una colonna del core (la scrive il server in ogni riga, anche nelle uscite); la
 *   natura dello scatto (di gruppo o singolo) c'e' se l'agenzia la chiede: Edro21.
 * - Il CSV delle righe visibili ha le colonne del report e, per ogni campo alterato, il valore precedente e
 *   quello attuale (Promo.csvDelReport).
 * - Edro21 non ha la tendina delle azioni dirette ne' l'importazione "Salva".
 * - Un "Salva e fai report" senza report (prima versione dell'etichetta) finisce come un "Salva".
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Promo = require('../../Istanta/wwwroot/js/promo.js');

const radice = path.join(__dirname, '..', '..', 'Istanta');
const promo = fs.readFileSync(path.join(radice, 'wwwroot', 'js', 'promo.js'), 'utf8').replace(/\r/g, '');
const taskManager = fs.readFileSync(path.join(radice, 'wwwroot', 'js', 'taskManager.js'), 'utf8').replace(/\r/g, '');

/// Il valore che torna un metodo senza parametri dell'agenzia.js di un cliente.
function dallAgenzia(cliente, metodo) {
    const testo = fs.readFileSync(path.join(radice, 'ScriptAgenzia', cliente, 'agenzia.js'), 'utf8').replace(/\r/g, '');
    const trovato = testo.match(new RegExp('\\n    ' + metodo + '\\(\\) \\{\\n([\\s\\S]*?)\\n    \\}\\n'));
    return trovato == null ? undefined : new Function(trovato[1])();
}

/// Un report con referenze di due canali, in volantino e fuori volantino, come quello dello scenario.
function report() {
    const items = [
        { 'Referenza.Codice': '100', AC: 'SSA', EtichettaTracciato: 'VOL', tipo_volantino: 'V - Volantino', versione: 2, prezzo_offerta: '2,49', Alterazioni: { prezzo_offerta: '2,99' } },
        { 'Referenza.Codice': '101', AC: 'SSA', EtichettaTracciato: 'VOL', tipo_volantino: 'F - Fuori volantino', versione: 2 },
        { 'Referenza.Codice': '102', AC: 'CNA', EtichettaTracciato: 'VOL', tipo_volantino: 'V - Volantino', versione: 1 },
        { 'Referenza.Codice': '103', AC: 'SSA', EtichettaTracciato: 'VOL', tipo_volantino: 'V - Volantino', versione: -1 }
    ];
    const core = Promo.colonneCoreDelReport([], true);
    return { items, core, righe: Promo.righeDelReport(items, core, ['tipo_volantino']) };
}

const codici = righe => righe.map(r => r.codice);

/* ---- filtri ---- */

test('filtri sovrapposti: canale SS e "V - Volantino" mostrano solo le referenze del canale SS in volantino', () => {
    const { righe } = report();
    const filtri = { stato: null, testo: '', colonne: { AC: ['SSA'], tipo_volantino: ['V - Volantino'] } };
    assert.deepStrictEqual(codici(righe.filter(r => Promo.rigaVisibile(r, filtri))), ['100', '103']);
});

test('stato, ricerca e filtri delle colonne valgono insieme', () => {
    const { righe } = report();
    const visibili = filtri => codici(righe.filter(r => Promo.rigaVisibile(r, filtri)));

    assert.deepStrictEqual(visibili({ stato: '2', testo: '', colonne: {} }), ['100']);
    assert.deepStrictEqual(visibili({ stato: null, testo: '10', colonne: { AC: ['SSA'] } }), ['100', '101', '103']);
    assert.deepStrictEqual(visibili({ stato: '4', testo: '103', colonne: { tipo_volantino: ['V - Volantino'] } }), ['103']);
    assert.deepStrictEqual(visibili({ stato: '4', testo: '100', colonne: {} }), []);
    //Senza filtri si vede tutto.
    assert.deepStrictEqual(visibili({ stato: null, testo: '', colonne: {} }), ['100', '101', '102', '103']);
});

test('ogni colonna offre i suoi valori presenti, una volta ciascuno', () => {
    const { righe } = report();
    assert.deepStrictEqual(Promo.valoriDellaColonna(righe, 'AC'), ['CNA', 'SSA']);
    assert.deepStrictEqual(Promo.valoriDellaColonna(righe, 'tipo_volantino'), ['F - Fuori volantino', 'V - Volantino']);
});

test('stato e ricerca non si escludono piu\': la pagina tiene un solo insieme di filtri', () => {
    assert.match(promo, /searchReportTable = function \(stato\) \{[\s\S]*?this\.filtriReport\.testo = \$\("#searchInput"\)\.val\(\) \|\| "";\s*this\.applicaFiltriReport\(\);/);
    assert.match(promo, /applicaFiltriReport\(\) \{[\s\S]*?Promo\.rigaVisibile\(riga, me\.filtriReport\)/);
    assert.match(promo, /class="btn btn-sm btn-light py-0 px-1 ms-1 btnFiltroColonna"/);
});

/* ---- etichetta e natura dello scatto ---- */

test('ogni riga riporta l\'etichetta del tracciato, anche quelle delle referenze uscite', () => {
    const { righe } = report();
    assert.deepStrictEqual(righe.map(r => r.valori.EtichettaTracciato), ['VOL', 'VOL', 'VOL', 'VOL']);
    assert.strictEqual(righe[3].stato, 4);
});

test('natura dello scatto: due referenze con lo stesso codice gruppo sono di gruppo, quella col proprio codice e\' singola', () => {
    const nature = Promo.naturaDelloScatto([
        { 'Referenza.Codice': '200', 'Scatto.CodiceGruppo': '200', AC: 'SSA' },
        { 'Referenza.Codice': '201', 'Scatto.CodiceGruppo': '200', AC: 'SSA' },
        { 'Referenza.Codice': '300', 'Scatto.CodiceGruppo': '300', AC: 'SSA' }
    ]);
    assert.deepStrictEqual(nature, ['Gruppo', 'Gruppo', 'Singolo']);
    //Lo stesso codice gruppo in un altro area/canale e' un altro scatto.
    assert.deepStrictEqual(Promo.naturaDelloScatto([
        { 'Referenza.Codice': '300', 'Scatto.CodiceGruppo': '300', AC: 'SSA' },
        { 'Referenza.Codice': '300', 'Scatto.CodiceGruppo': '300', AC: 'CNA' }
    ]), ['Singolo', 'Singolo']);
});

test('la natura dello scatto la chiede Edro21; Coop e Famila no', () => {
    assert.strictEqual(dallAgenzia('edro21', 'getNaturaScattoNelReport'), true);
    assert.strictEqual(dallAgenzia('coopfi', 'getNaturaScattoNelReport'), undefined);
    assert.strictEqual(dallAgenzia('famila', 'getNaturaScattoNelReport'), undefined);
    assert.match(promo, /this\.agenzia\.getNaturaScattoNelReport != null && this\.agenzia\.getNaturaScattoNelReport\(\) === true\);/);
});

/* ---- CSV ---- */

test('il CSV delle righe filtrate per canale SS: per il prezzo cambiato il campo, il valore precedente e quello attuale', () => {
    const { righe, core } = report();
    const visibili = righe.filter(r => Promo.rigaVisibile(r, { stato: null, testo: '', colonne: { AC: ['SSA'] } }));
    const csv = Promo.csvDelReport(visibili, core, ['tipo_volantino']);
    const linee = csv.trimEnd().split('\r\n');

    assert.strictEqual(linee[0], 'Area/canale;Codice;Etichetta;Scatto;tipo_volantino;Campo;Prima;Dopo');
    assert.strictEqual(linee.length, 4);
    assert.ok(linee.every(l => !l.startsWith('CNA')), 'solo le righe del canale SS');
    assert.ok(linee.includes('SSA;100;VOL;Singolo;V - Volantino;prezzo_offerta;2,99;2,49'), csv);
    assert.ok(linee.includes('SSA;101;VOL;Singolo;F - Fuori volantino;;;'), csv);
});

test('nel CSV un valore con il separatore o le virgolette resta una cella sola', () => {
    const righe = Promo.righeDelReport([{ 'Referenza.Codice': '1', AC: 'A', descrizione: 'mele; pere "bio"', versione: 2 }], Promo.colonneCoreDelReport(['Alterazioni']), ['descrizione']);
    const csv = Promo.csvDelReport(righe, Promo.colonneCoreDelReport(['Alterazioni']), ['descrizione']);
    assert.strictEqual(csv.split('\r\n')[1], 'A;1;;"mele; pere ""bio""";;;');
});

test('il CSV si scarica dalle righe visibili, in UTF-8 con BOM', () => {
    assert.match(promo, /let visibili = me\.reportCorrente\.righe\.filter\(r => Promo\.rigaVisibile\(r, me\.filtriReport\)\);/);
    assert.match(promo, /new Blob\(\["\\ufeff" \+ testo\], \{ type: "text\/csv;charset=utf-8" \}\)/);
    assert.match(promo, /id="btnCsvReport" value="Scarica CSV"/);
});

/* ---- opzioni per cliente ---- */

test('Edro21 non ha la tendina delle azioni dirette ne\' "Salva"; gli altri clienti si', () => {
    assert.strictEqual(dallAgenzia('edro21', 'nascondiAzioniDiretteReport'), true);
    assert.deepStrictEqual(dallAgenzia('edro21', 'getOpzioniImportazioneEscluse'), [1]);
    assert.strictEqual(dallAgenzia('coopfi', 'nascondiAzioniDiretteReport'), undefined);

    const edro = Promo.htmlOpzioniImportazione([1]);
    assert.doesNotMatch(edro, />Salva</);
    assert.match(edro, /<option selected value="2">Solo report<\/option><option value="3">Salva e fai report<\/option>/);
    assert.strictEqual(Promo.htmlOpzioniImportazione([]), '<option value="1">Salva</option><option selected value="2">Solo report</option><option value="3">Salva e fai report</option>');
});

test('la scelta d\'importazione della riga e quella massiva usano le stesse opzioni; il report senza azioni dirette non ha la tendina', () => {
    assert.strictEqual((promo.match(/Promo\.htmlOpzioniImportazione\(me\.opzioniImportazioneEscluse\(\)\)/g) || []).length, 2);
    assert.doesNotMatch(promo, /<option value=\\?"1\\?">Salva<\/option>/);
    assert.match(promo, /let azioniHTML = !conAzioniDirette \? "" : `/);
    assert.match(promo, /if \(conAzioniDirette\) \{\s*tblRows \+= `<td><input type="checkbox"/);
});

test('l\'importazione massiva ricorda la scelta fatta, non sempre "Salva e fai report"', () => {
    assert.match(promo, /me\.codaProcessi\["act_" \+ id_attivita\] = \{ id_attivita, persistent: _persistenzaMassiva == "true", askReport: _reportMassivo == "true", idPromo: id \};/);
    assert.doesNotMatch(promo, /persistent: true, askReport: true \}/);
});

/* ---- prima versione: come un "Salva" ---- */

test('senza report da leggere la riga si chiude come dopo un "Salva", senza "Leggi report"', () => {
    const salvaEReport = { askReport: true, persistent: true };
    assert.deepStrictEqual(Promo.esitoFineImportazione(salvaEReport, 6, false), { leggiReport: false, chiudiRiga: true });
    assert.deepStrictEqual(Promo.esitoFineImportazione(salvaEReport, 6, true), { leggiReport: true, chiudiRiga: false });
    //Prima della versione nuova del server haReport non arriva: si mostra come prima.
    assert.deepStrictEqual(Promo.esitoFineImportazione(salvaEReport, 6, undefined), { leggiReport: true, chiudiRiga: false });
    assert.deepStrictEqual(Promo.esitoFineImportazione({ askReport: false, persistent: true }, 6, false), { leggiReport: false, chiudiRiga: true });
    assert.deepStrictEqual(Promo.esitoFineImportazione(salvaEReport, 7, true), { leggiReport: false, chiudiRiga: false });
});

test('la pagina riceve dallo stato dell\'attivita\' se c\'e\' un report', () => {
    assert.match(taskManager, /f\.onAttivitaChageStatus\(attivita\.id, attivita\.stato, attivita\.haReport\);/);
    assert.match(promo, /onAttivitaChageStatus\(id_attivita, stato, haReport\) \{/);
    assert.match(promo, /let esito = Promo\.esitoFineImportazione\(details, stato, haReport\);\s*if \(esito\.leggiReport\) \{/);
});
