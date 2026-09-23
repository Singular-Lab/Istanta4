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

/* ---- quando il salvataggio non riesce ---- */

// Call.do, sull'errore, richiama lo stesso callback passando un oggetto invece della lista.
// Andando dritti su forEach l'eccezione fermava tutto prima di hideLoading: la pagina restava
// a girare per sempre e il motivo del rifiuto, che il server manda nel corpo, non si vedeva.
test('un salvataggio rifiutato chiude il caricamento e dice perche\'', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    const inizio = js.indexOf('salvaFunction(listAct, callback, senderButton) {');
    const metodo = js.slice(inizio, js.indexOf('EliminaFotoExtra(button) {', inizio));

    const guardia = metodo.indexOf('!Array.isArray(result)');
    const scorrimento = metodo.indexOf('result.forEach(');

    assert.ok(guardia > 0, 'senza guardia un errore diventa un TypeError');
    assert.ok(guardia < scorrimento, 'la guardia deve venire prima di scorrere la lista');

    const dentroGuardia = metodo.slice(guardia, scorrimento);
    assert.ok(dentroGuardia.includes('hideLoading();'),
        'il caricamento va chiuso, altrimenti la pagina resta appesa');
    assert.ok(dentroGuardia.includes('result.message || result.error'),
        'il motivo lo manda il server: va mostrato, non buttato');
});

/* ---- I20-985: archiviare altre foto del prodotto ---- */

// Caricare una foto dalla scheda articolo non vuol dire volerla in uso: senza dirlo al server,
// il caricamento la sceglie come primaria e spegne quella di adesso.
test('la foto nuova del prodotto si archivia senza selezionarla', () => {
    const dati = Archivio.datiNuovaFotoArticolo('6119227', 'scatto_nuovo.psd');

    assert.strictEqual(dati.codice, '6119227');
    assert.strictEqual(dati.tipo, 1, 'tipo 1 e\' la foto del prodotto');
    assert.strictEqual(dati.nomeFile, 'scatto_nuovo.psd');
    assert.strictEqual(dati.archiviaSenzaSelezionare, true);
    assert.strictEqual(dati.idLavorazione, 0, 'dalla scheda non si sta lavorando a un volantino');
});

// L'elenco fisso di estensioni non c'e' piu': decideva in anticipo cosa il browser sa aprire e
// sbagliava per difetto, per esempio sul tiff, che Safari disegna. Quello che resta a parte e' il
// psd, perche' li' l'immagine va estratta prima. Le regole nuove stanno in anteprimaPsd.test.js.
test('non si decide piu\' dall\'estensione cosa e\' mostrabile', () => {
    assert.strictEqual(typeof Archivio.tipoAnteprimaDi, 'undefined');
    assert.strictEqual(typeof Archivio.eUnPsd, 'function');
});

test('si vede cosa si sta per archiviare prima di scrivere', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    assert.ok(vista.includes('data-azione="aggiungiFotoArticolo"'), 'serve il comando per iniziare');
    assert.ok(vista.includes('data-azione="confermaFotoArticolo"') && vista.includes('data-azione="annullaFotoArticolo"'),
        'l\'anteprima si conferma o si annulla');

    const inizio = js.indexOf('AnteprimaFotoArticolo(campo) {');
    const anteprima = js.slice(inizio, js.indexOf('AnnullaFotoArticolo() {', inizio));

    assert.ok(!anteprima.includes('Call.doWithUpload'),
        'guardare non deve scrivere: il caricamento parte solo dalla conferma');
    assert.ok(js.indexOf('Call.doWithUpload("SyncFoto", "updateFotoFromIndd/0"', js.indexOf('ConfermaFotoArticolo() {')) > 0,
        'il caricamento sta nella conferma');
});

// Le miniature arrivano da Olimpo con la sola larghezza fissata: senza un riquadro di misura
// fissa ogni scheda veniva alta in modo diverso.
test('le foto del prodotto stanno in un riquadro quadrato, senza tagli', () => {
    const vista = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const css = sorgente('Istanta/wwwroot/css/site.css');

    assert.strictEqual((vista.match(/riquadroFotoArticolo/g) || []).length >= 2, true,
        'la primaria e le altre foto devono stare nello stesso riquadro');

    const regola = css.slice(css.indexOf('.riquadroFotoArticolo {'));
    assert.ok(/width:\s*150px/.test(regola) && /height:\s*150px/.test(regola), 'il riquadro e\' quadrato');
    assert.ok(regola.includes('object-fit: contain'), 'l\'immagine ci sta dentro per intero');
    assert.ok(!regola.includes('object-fit: cover'), 'cover taglierebbe i lati dello scatto');
});

// L'anteprima non si vedeva in nessun formato: era costruita con URL.createObjectURL, che
// produce un indirizzo blob, e la policy di sicurezza della pagina non ammette blob fra le
// immagini. Un indirizzo data la policy lo accetta gia'.
test('l\'anteprima usa un indirizzo che la policy della pagina ammette', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');
    const inizio = js.indexOf('AnteprimaFotoArticolo(campo) {');
    const anteprima = js.slice(inizio, js.indexOf('AnnullaFotoArticolo() {', inizio));

    assert.ok(anteprima.includes('readAsDataURL'), 'l\'anteprima si legge come indirizzo data');
    assert.ok(!/URL\.createObjectURL/.test(anteprima),
        'un indirizzo blob la policy lo rifiuta: l\'immagine non comparirebbe');

    const policy = sorgente('Istanta/Program.cs');
    const direttiva = policy.slice(policy.indexOf('img-src'), policy.indexOf('img-src') + 200);
    assert.ok(direttiva.includes('data:'), 'la policy ammette gli indirizzi data');
    assert.ok(!direttiva.includes('blob:'),
        'finche\' blob non e\' ammesso, l\'anteprima non puo\' tornare a createObjectURL');
});
