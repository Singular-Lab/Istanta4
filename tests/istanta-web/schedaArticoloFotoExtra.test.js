/*
 * I20-983: aggiungere foto extra dalla scheda articolo.
 *
 * Nella pagina le foto extra ora stanno in quattro sezioni per tipo, come nel pannello del
 * Plugin, e ogni sezione permette di caricarne una nuova o di collegare un'immagine gia' a
 * sistema. Qui si verificano le parti che decidono qualcosa: quali foto vanno in una sezione,
 * quali immagini del catalogo si possono ancora collegare, e cosa si manda al server.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Archivio = require('../../Istanta/wwwroot/js/archivio.js');

const BOLLINO = 2, LOGO = 3, AMBIENTATA = 4, SFONDO = 5;

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

function foto(nome, tipo, guid) {
    return { NomeReale: nome, Tipo: tipo, GuidId: guid || ('guid-' + nome) };
}

/* ---- quali foto stanno in una sezione ---- */

test('ogni sezione prende le foto del suo tipo', () => {
    const fotoArticolo = [
        foto('bollo_bio.psd', BOLLINO),
        foto('logo_filiera.psd', LOGO),
        foto('ambientata_1.jpg', AMBIENTATA),
        foto('sfondo.jpg', SFONDO)
    ];

    assert.deepStrictEqual(
        Archivio.fotoExtraDelTipo(fotoArticolo, LOGO).map(f => f.NomeReale), ['logo_filiera.psd']);
    assert.deepStrictEqual(
        Archivio.fotoExtraDelTipo(fotoArticolo, BOLLINO).map(f => f.NomeReale), ['bollo_bio.psd']);
});

// Dello stesso file possono esistere piu' versioni sul database: in elenco ne va una sola.
test('le versioni dello stesso file non si moltiplicano in elenco', () => {
    const fotoArticolo = [
        foto('bollo_bio.psd', BOLLINO, 'guid-vecchio'),
        foto('bollo_bio.psd', BOLLINO, 'guid-nuovo'),
        foto('bollo_altro.psd', BOLLINO)
    ];

    const elenco = Archivio.fotoExtraDelTipo(fotoArticolo, BOLLINO);

    assert.strictEqual(elenco.length, 2);
    assert.strictEqual(elenco[0].GuidId, 'guid-vecchio');
});

test('il tipo arriva come numero o come stringa, e vale lo stesso', () => {
    const fotoArticolo = [{ NomeReale: 'logo.psd', Tipo: '3', GuidId: 'g' }];

    assert.strictEqual(Archivio.fotoExtraDelTipo(fotoArticolo, LOGO).length, 1);
});

test('una sezione senza foto e\' semplicemente vuota', () => {
    assert.deepStrictEqual(Archivio.fotoExtraDelTipo([foto('logo.psd', LOGO)], SFONDO), []);
    assert.deepStrictEqual(Archivio.fotoExtraDelTipo(null, LOGO), []);
});

/* ---- quali immagini del catalogo si possono collegare ---- */

test('il catalogo si filtra sul tipo che si sta collegando', () => {
    const catalogo = [
        { guidId: 'a', nome: 'bollo.psd', tipo: BOLLINO },
        { guidId: 'b', nome: 'logo.psd', tipo: LOGO }
    ];

    assert.deepStrictEqual(
        Archivio.catalogoCollegabile(catalogo, LOGO, []).map(i => i.guidId), ['b']);
});

// Il server rifiuta di collegare un'immagine gia' associata: mostrarla farebbe sbagliare
// l'operatore e gli darebbe un errore al posto di un risultato.
test('le immagini gia\' associate all\'articolo non si ripropongono', () => {
    const catalogo = [
        { guidId: 'a', nome: 'logo_uno.psd', tipo: LOGO },
        { guidId: 'b', nome: 'logo_due.psd', tipo: LOGO }
    ];
    const gia = [foto('logo_uno.psd', LOGO, 'a')];

    assert.deepStrictEqual(
        Archivio.catalogoCollegabile(catalogo, LOGO, gia).map(i => i.guidId), ['b']);
});

test('un catalogo assente non fa saltare la finestra', () => {
    assert.deepStrictEqual(Archivio.catalogoCollegabile(null, LOGO, []), []);
    assert.deepStrictEqual(Archivio.catalogoCollegabile([{ guidId: 'a', tipo: LOGO }], LOGO, null).length, 1);
});

/* ---- cosa si manda per caricare una foto nuova ---- */

// Dalla scheda articolo non si sta lavorando a un volantino: il server tocca la lavorazione
// solo quando quel numero non e' zero, e l'area e il canale vuoti fanno valere la foto per
// tutti, come fa il Plugin per le extra.
test('il caricamento non parla di lavorazioni', () => {
    const dati = Archivio.datiNuovaFotoExtra('6119227', LOGO, 'logo_nuovo.psd');

    assert.strictEqual(dati.codice, '6119227');
    assert.strictEqual(dati.tipo, LOGO);
    assert.strictEqual(dati.nomeFile, 'logo_nuovo.psd');
    assert.strictEqual(dati.idLavorazione, 0);
    assert.strictEqual(dati.idRec, 0);
    assert.strictEqual(dati.uploadMethod, 0);
    assert.ok(!('area' in dati) && !('canale' in dati), 'area e canale restano fuori, cioe\' vuoti');
});

test('il tipo viaggia come numero anche se arriva dall\'attributo di un elemento', () => {
    assert.strictEqual(Archivio.datiNuovaFotoExtra('6119227', '4', 'amb.jpg').tipo, AMBIENTATA);
});

/* ---- come la pagina e' costruita ---- */

test('la pagina ha le quattro sezioni con i loro due pulsanti', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    for (const tipo of ['Bollino', 'Logo', 'Ambientata', 'Sfondo']) {
        assert.ok(vista.includes('IstantaLib.TipoFoto.' + tipo), 'manca la sezione ' + tipo);
    }

    assert.ok(vista.includes('data-azione="aggiungiFotoExtra" data-tipo="@tipoExtra.Val"'),
        'ogni sezione deve poter caricare un file nuovo');
    assert.ok(vista.includes('data-azione="collegaFotoExtra" data-tipo="@tipoExtra.Val"'),
        'ogni sezione deve poter collegare un\'immagine a sistema');
});

// Era disegnata gia' spuntata o no, quindi diceva il vero, ma cliccarla non faceva niente:
// al ricaricamento tornava com'era.
test('la casella Attiva ora chiama il server', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    assert.ok(vista.includes('data-azione="attivaFotoExtra"'),
        'senza gestore la casella resta un comando finto');
    assert.ok(js.includes('"attivaDisattivaFotoExtra/" + guidId + "/" + attiva'),
        'e\' l\'endpoint che usa anche il Plugin');
    assert.ok(js.includes('casella.prop("checked", !attiva);'),
        'se il server rifiuta, la casella deve tornare com\'era invece di mentire');
});


/* ---- i gestori e la policy di sicurezza della pagina ---- */

// La pagina dichiara script-src con il nonce e senza unsafe-inline: in quel caso il browser
// rifiuta i gestori scritti come attributo, e i pulsanti non fanno niente. Valeva gia' per
// Seleziona, Elimina, Salva e Cronologia, che erano inerti da sempre.
test('nel markup della scheda articolo non restano gestori inline', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    //I blocchi commentati non arrivano al browser e non contano.
    const attivo = vista.replace(/@\*[\s\S]*?\*@/g, '');

    assert.strictEqual((attivo.match(/onclick=/g) || []).length, 0,
        'un onclick nel markup e\' un pulsante che non fara\' niente');
    assert.strictEqual((attivo.match(/onchange=/g) || []).length, 0,
        'lo stesso vale per onchange');
});

test('ogni azione della pagina ha il suo aggancio da JavaScript', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    const azioni = [...vista.matchAll(/data-azione="([a-zA-Z]+)"/g)].map(t => t[1]);
    assert.ok(azioni.length >= 8, 'le azioni della pagina devono essere dichiarate sugli elementi');

    for (const azione of new Set(azioni)) {
        assert.ok(js.includes("[data-azione='" + azione + "']"),
            'azione senza gestore agganciato: ' + azione);
    }
});

test('gli agganci partono all\'apertura della pagina', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');

    const creazione = vista.indexOf('ArchivioItem = new Archivio();');
    const aggancio = vista.indexOf('ArchivioItem.collegaGestoriSchedaArticolo();');

    assert.ok(creazione > 0 && aggancio > creazione,
        'prima si crea l\'oggetto, poi gli si chiede di agganciare i gestori');
});
