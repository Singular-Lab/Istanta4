/*
 * I20-985: dove va la foto caricata dalla scheda articolo.
 *
 * Caricando una foto si sceglie la destinazione, area e canale, come si fa nel Plugin. Le coppie
 * possibili non sono tutte quelle immaginabili: sono le righe della tabella di Settings, dove
 * area e canale compaiono gia' abbinati. Qui si provano le regole che decidono cosa si puo'
 * scegliere, cosa si manda al server e quando l'archiviazione e' permessa.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Archivio = require('../../Istanta/wwwroot/js/archivio.js');
const paginaFinta = require('./paginaFinta.js');

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

/* Le voci del menu dei canali come le rende la vista: ogni canale porta le aree con cui in
   tabella compare abbinato. */
const CANALI = [
    { valore: 'GDO', etichetta: 'GDO', aree: ['NORD', 'CENTRO'] },
    { valore: 'DISCOUNT', etichetta: 'Discount', aree: ['NORD'] },
    { valore: 'HORECA', etichetta: 'Horeca', aree: ['SUD'] }
];

/* ---- cosa si puo' scegliere ---- */

test('scegliendo un\'area restano i canali che con quell\'area esistono', () => {
    assert.deepStrictEqual(Archivio.canaliPerArea(CANALI, 'NORD').map(c => c.valore), ['GDO', 'DISCOUNT']);
    assert.deepStrictEqual(Archivio.canaliPerArea(CANALI, 'SUD').map(c => c.valore), ['HORECA']);
});

// Un'area che in tabella non ha canali non deve offrirne: meglio un menu vuoto che una coppia
// che nel resto del sistema non esiste.
test('un\'area senza canali abbinati non ne offre', () => {
    assert.deepStrictEqual(Archivio.canaliPerArea(CANALI, 'ISOLE'), []);
});

test('senza un\'area a restringere restano tutti i canali', () => {
    assert.deepStrictEqual(Archivio.canaliPerArea(CANALI, '*').map(c => c.valore), ['GDO', 'DISCOUNT', 'HORECA']);
    assert.deepStrictEqual(Archivio.canaliPerArea(CANALI, '').map(c => c.valore), ['GDO', 'DISCOUNT', 'HORECA']);
});

test('un elenco che non arriva non fa cadere il menu', () => {
    assert.deepStrictEqual(Archivio.canaliPerArea(null, 'NORD'), []);
});

/* ---- cosa si manda al server ---- */

test('la destinazione scelta arriva come area e canale', () => {
    assert.deepStrictEqual(Archivio.destinazioneFotoArticolo('NORD', 'GDO'), { area: 'NORD', canale: 'GDO' });
});

// "Vale per tutte" si manda vuoto: e' come il sistema tratta gia' le foto buone ovunque, e la
// regola di precedenza del server sceglie la piu' specifica quando ce n'e' una.
test('la scelta globale si manda vuota, non con una parola', () => {
    assert.deepStrictEqual(Archivio.destinazioneFotoArticolo('*', '*'), { area: '', canale: '' });
    assert.deepStrictEqual(Archivio.destinazioneFotoArticolo('NORD', '*'), { area: 'NORD', canale: '' });
    assert.deepStrictEqual(Archivio.destinazioneFotoArticolo('*', 'GDO'), { area: '', canale: 'GDO' });
});

test('una scelta a meta\' non e\' una destinazione', () => {
    assert.strictEqual(Archivio.destinazioneFotoArticolo('', 'GDO'), null);
    assert.strictEqual(Archivio.destinazioneFotoArticolo('NORD', ''), null);
    assert.strictEqual(Archivio.destinazioneFotoArticolo(undefined, undefined), null);
});

test('la destinazione entra nei dati del caricamento', () => {
    const dati = Archivio.datiNuovaFotoArticolo('6119227', 'scatto.psd', { area: 'NORD', canale: 'GDO' });

    assert.strictEqual(dati.area, 'NORD');
    assert.strictEqual(dati.canale, 'GDO');
    assert.strictEqual(dati.archiviaSenzaSelezionare, true, 'caricarla non vuol dire volerla in uso');
});

/* ---- quando si puo' archiviare ---- */

test('senza file o senza destinazione non si archivia', () => {
    assert.strictEqual(Archivio.siPuoConfermareFotoArticolo({ name: 'x.psd' }, 'NORD', 'GDO'), true);
    assert.strictEqual(Archivio.siPuoConfermareFotoArticolo(null, 'NORD', 'GDO'), false);
    assert.strictEqual(Archivio.siPuoConfermareFotoArticolo({ name: 'x.psd' }, '', 'GDO'), false);
    assert.strictEqual(Archivio.siPuoConfermareFotoArticolo({ name: 'x.psd' }, 'NORD', ''), false);
});

// La guardia non sta solo nel pulsante spento: il pulsante e' una comodita', la regola deve
// valere anche se qualcuno lo riaccende da fuori.
test('la conferma non parte se la destinazione non e\' stata scelta', () => {
    const finta = paginaFinta();
    const precedenti = { $: global.$, Call: global.Call, showLoading: global.showLoading, FormData: global.FormData };
    let partenze = 0;

    global.$ = finta;
    global.showLoading = function () { };
    global.FormData = function () { this.append = function () { }; };
    global.Call = { doWithUpload() { partenze++; } };

    try {
        const scheda = Object.create(Archivio.prototype);
        scheda.fileNuovaFotoArticolo = { name: 'scatto.psd' };

        scheda.ConfermaFotoArticolo();
        assert.strictEqual(partenze, 0, 'senza area e canale non si scrive niente in archivio');

        finta('#areaNuovaFotoArticolo').val('NORD');
        finta('#canaleNuovaFotoArticolo').val('GDO');
        scheda.ConfermaFotoArticolo();
        assert.strictEqual(partenze, 1, 'scelta la destinazione, il caricamento parte');
    }
    finally {
        global.$ = precedenti.$;
        global.Call = precedenti.Call;
        global.showLoading = precedenti.showLoading;
        global.FormData = precedenti.FormData;
    }
});

/* ---- come la vista offre la scelta ---- */

test('i due menu stanno accanto alla scelta del file', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    assert.ok(vista.includes('id="areaNuovaFotoArticolo"') && vista.includes('id="canaleNuovaFotoArticolo"'));
    assert.ok(vista.includes('data-azione="destinazioneFotoArticolo"'),
        'i gestori inline la policy della pagina li blocca');
    assert.ok(vista.includes('id="confermaNuovaFotoArticolo" disabled'),
        'si parte col pulsante spento, perche\' la destinazione va scelta');
    assert.ok(vista.includes('data-aree="@areeDelCanale"'),
        'ogni canale porta le aree con cui e\' abbinato, altrimenti non si puo\' filtrare');
});

// Le coppie valide sono quelle della tabella di Settings: se la scheda se le costruisse da sola
// offrirebbe destinazioni che nel resto del sistema non esistono.
test('le coppie arrivano dalla tabella di Settings, non da un elenco a parte', () => {
    const controller = sorgente('Istanta/Controllers/SchedaArticoloController.cs');

    assert.ok(controller.includes('new ExternalSourceClass(path_external_source).getAree().source'),
        'la sorgente e\' la stessa della pagina Aree/Canali');
    assert.ok(controller.includes('ViewBag.combinazioniAreaCanale'), 'la vista le riceve dal controller');
    assert.ok(controller.includes('catch (Exception ex)'),
        'se la sorgente non si legge la scheda deve aprirsi lo stesso');
});
