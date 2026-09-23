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

/* Le voci del menu delle aree come le rende la vista: ogni area porta i canali con cui in
   tabella e' attiva. Si sceglie prima il canale, come nella matrice, dove i canali sono le
   righe. Le aree qui sotto seguono un caso vero: SA ha tutto tranne petstore, EM ha tutto
   tranne petstore, fidelity e sapori. */
const AREE = [
    { valore: 'SA', etichetta: 'SA', canali: ['GDO', 'FIDELITY', 'SAPORI'] },
    { valore: 'EM', etichetta: 'EM', canali: ['GDO'] },
    { valore: 'PET', etichetta: 'PET', canali: ['PETSTORE'] }
];

/* ---- cosa si puo' scegliere ---- */

test('scelto il canale restano le aree che con quel canale sono attive', () => {
    assert.deepStrictEqual(Archivio.areePerCanale(AREE, 'GDO').map(a => a.valore), ['SA', 'EM']);
    assert.deepStrictEqual(Archivio.areePerCanale(AREE, 'FIDELITY').map(a => a.valore), ['SA']);
});

// Petstore non e' attivo ne' su SA ne' su EM: quelle aree non devono comparire, altrimenti si
// archivierebbe in una coppia che in tabella e' spenta.
test('un canale non attivo su un\'area non la offre', () => {
    assert.deepStrictEqual(Archivio.areePerCanale(AREE, 'PETSTORE').map(a => a.valore), ['PET']);
});

test('senza un canale a restringere restano tutte le aree', () => {
    assert.deepStrictEqual(Archivio.areePerCanale(AREE, '*').map(a => a.valore), ['SA', 'EM', 'PET']);
    assert.deepStrictEqual(Archivio.areePerCanale(AREE, '').map(a => a.valore), ['SA', 'EM', 'PET']);
});

test('un elenco che non arriva non fa cadere il menu', () => {
    assert.deepStrictEqual(Archivio.areePerCanale(null, 'GDO'), []);
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

test('i due menu stanno accanto alla scelta del file, prima il canale', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    assert.ok(vista.includes('data-azione="destinazioneFotoArticolo"'),
        'i gestori inline la policy della pagina li blocca');
    assert.ok(vista.includes('id="confermaNuovaFotoArticolo" disabled'),
        'si parte col pulsante spento, perche\' la destinazione va scelta');
    assert.ok(vista.includes('data-canali="@canaliDellArea"'),
        'ogni area porta i canali con cui e\' attiva, altrimenti non si puo\' filtrare');

    //Chi restringe deve venire prima di chi viene ristretto, o il filtro non serve a niente.
    assert.ok(vista.indexOf('id="canaleNuovaFotoArticolo"') < vista.indexOf('id="areaNuovaFotoArticolo"'),
        'prima il canale, poi l\'area');
});

// Aree, canali e coppie ammesse sono quelli di Settings, voce Aree e Canali, cioe' la sorgente
// ACPV che disegna quella pagina. Un elenco costruito altrove offrirebbe destinazioni che nel
// resto del sistema non esistono, ed e' l'errore in cui ero gia' caduto leggendo SourceAree.
test('aree e canali arrivano dalla stessa sorgente della pagina Aree/Canali', () => {
    const controller = sorgente('Istanta/Controllers/SchedaArticoloController.cs');
    const vista = sorgente('Istanta/Views/Aree/Index.cshtml');

    assert.ok(vista.includes("mostra(\"ACPV\")"), 'la pagina di Settings disegna la sorgente ACPV');
    assert.ok(controller.includes('SingletonConfiguration.DBACPV'), 'la scheda legge la stessa');
    assert.ok(!controller.includes('getAree().source'), 'SourceAree e\' un\'altra tabella');
    assert.ok(controller.includes('acpv.combinazioni.Where(c => c.enabled)'),
        'valgono solo le coppie attive: quelle spente sono state tolte apposta');
    assert.ok(controller.includes('catch (Exception ex)'),
        'se la sorgente non si legge la scheda deve aprirsi lo stesso');
});

test('nei menu si mostrano le sigle, che sono cio\' che il server scrive', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    assert.ok(vista.includes('<option value="@area.sigla"'), 'l\'area si manda come sigla');
    assert.ok(vista.includes('<option value="@canale.sigla"'), 'il canale si manda come sigla');
    assert.ok(!vista.includes('value="@area.guidID"') && !vista.includes('value="@canale.guidID"'),
        'l\'identificativo darebbe una foto di un\'area inesistente');
});
