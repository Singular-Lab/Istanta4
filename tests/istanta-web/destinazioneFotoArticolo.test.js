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
    assert.ok(vista.includes('data-canali=\\"{testo(canaliDellArea)}\\"'),
        'ogni area porta i canali con cui e\' attiva, altrimenti non si puo\' filtrare');

    //Chi restringe deve venire prima di chi viene ristretto, o il filtro non serve a niente.
    assert.ok(vista.indexOf('id="canaleNuovaFotoArticolo"') < vista.indexOf('id="areaNuovaFotoArticolo"'),
        'prima il canale, poi l\'area');
});

// Si parte gia' su una destinazione buona: chi carica senza pensarci archivia una foto valida
// ovunque, che e' cio' che la scheda faceva da sempre.
test('i menu partono su tutti i canali e tutte le aree', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    assert.ok(vista.includes('<option value="*" selected>Tutti i canali</option>'));
    assert.ok(vista.includes('<option value="*" selected>Tutte le aree</option>'));
    assert.ok(!vista.includes('>Scegli...</option>'), 'non c\'e\' piu\' una voce da scegliere');
    assert.ok(!vista.includes('id="confermaNuovaFotoArticolo" disabled'),
        'con una destinazione gia\' valida il pulsante non deve nascere spento');
});

// L'etichetta deve restare col suo menu: andando a capo, un\'etichetta separata finirebbe sopra
// al menu sbagliato e si sceglierebbe l'area credendo di scegliere il canale.
test('ogni etichetta sta in gruppo col suo menu', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    for (const nome of ['canaleNuovaFotoArticolo', 'areaNuovaFotoArticolo']) {
        const etichetta = vista.indexOf('for="' + nome + '"');
        const menu = vista.indexOf('id="' + nome + '"');
        const inMezzo = vista.slice(etichetta, menu);

        assert.ok(etichetta > 0 && menu > etichetta, 'l\'etichetta viene prima del suo menu');
        assert.ok(!inMezzo.includes('</div>'),
            'fra etichetta e menu non ci sta una chiusura: starebbero in gruppi diversi');
    }
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

    assert.ok(vista.includes('<option value=\\"{testo(a.sigla)}\\"'), 'l\'area si manda come sigla');
    assert.ok(vista.includes('<option value=\\"{testo(c.sigla)}\\"'), 'il canale si manda come sigla');
    assert.ok(!vista.includes('{testo(a.guidID)}') && !vista.includes('{testo(c.guidID)}'),
        'l\'identificativo darebbe una foto di un\'area inesistente');
    assert.ok(vista.includes('System.Net.WebUtility.HtmlEncode'),
        'sigle e nomi arrivano da una sorgente esterna: vanno codificati prima di finire nella pagina');
});


/* ---- I20-985: cambiare dove vale una foto gia' in archivio ---- */

test('c\'e\' qualcosa da salvare solo se la destinazione e\' cambiata davvero', () => {
    const registrata = { area: 'SA', canale: 'GDO' };

    assert.strictEqual(Archivio.destinazioneCambiata(registrata, { area: 'EM', canale: 'GDO' }), true);
    assert.strictEqual(Archivio.destinazioneCambiata(registrata, { area: 'SA', canale: 'FIDELITY' }), true);
    assert.strictEqual(Archivio.destinazioneCambiata(registrata, { area: 'SA', canale: 'GDO' }), false,
        'un menu toccato e rimesso com\'era non e\' una modifica in sospeso');
    assert.strictEqual(Archivio.destinazioneCambiata(null, { area: 'SA', canale: 'GDO' }), false);
});

test('la foto in uso e quelle in elenco hanno i due menu e il salva', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    //Una volta per la primaria e una per ogni foto dell'elenco.
    assert.ok(vista.includes('@destinazioneDiUnaFoto(fotoPrimaria.Id, fotoPrimaria.Area, fotoPrimaria.Canale)'));
    assert.ok(vista.includes('@destinazioneDiUnaFoto(foto.Id, foto.Area, foto.Canale)'));
    assert.ok(vista.includes('data-azione=""salvaDestinazioneFoto""'),
        'si scrive premendo Salva, non al tocco del menu');
    assert.ok(vista.includes('salvaDestinazioneFoto"" data-azione=""salvaDestinazioneFoto"" disabled'),
        'il pulsante nasce spento: senza modifiche non c\'e\' niente da salvare');
});

// Il pericolo e' scrivere sulla riga sbagliata: dello stesso file possono esistere piu' righe, una
// per destinazione, e allora il GuidId non basta a dire quale si sta cambiando.
test('la foto da cambiare si indica per identificativo di riga', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');
    const controller = sorgente('Istanta/Controllers/SchedaArticoloController.cs');

    const inizio = js.indexOf('SalvaDestinazioneFoto(gruppo) {');
    const metodo = js.slice(inizio, js.indexOf('ConfermaFotoArticolo() {', inizio));

    assert.ok(metodo.includes('idFoto: gruppo.attr("data-idfoto")'));
    assert.ok(!metodo.includes('guidId'), 'per GuidId si cambierebbe una riga a caso');
    assert.ok(controller.includes('f.Id == idFoto'), 'anche il server cerca per identificativo di riga');
});

// Cambiare destinazione non e' selezionare: l'endpoint del Plugin, oltre alla destinazione, mette
// la foto in uso come primaria, e su una foto dell'elenco vorrebbe dire promuoverla.
test('cambiare destinazione non mette la foto in uso', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');
    const controller = sorgente('Istanta/Controllers/SchedaArticoloController.cs');

    assert.ok(js.includes('Call.do("SchedaArticolo", "AggiornaDestinazioneFoto"'),
        'si usa l\'endpoint dedicato');
    assert.ok(!js.includes('updateImmagineEsistente'), 'quello del Plugin promuoverebbe la foto');

    const inizio = controller.indexOf('AggiornaDestinazioneFoto(');
    const azione = controller.slice(inizio);

    assert.ok(!azione.includes('StatoSelezione') && !azione.includes('Attiva'),
        'si scrivono solo area e canale, niente stato di selezione');
});
