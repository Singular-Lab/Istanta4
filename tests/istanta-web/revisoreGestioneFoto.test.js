/*
 * Le foto della Scheda articolo aperte dal revisore.
 *
 * Ogni riga del revisore, referenza o gruppo, ha un pulsante che apre in una finestra la sezione
 * delle foto della Scheda articolo (Views/Shared/_GestioneFoto.cshtml, servita da
 * SchedaArticolo/GestioneFoto). Una referenza ha foto del prodotto e foto extra; un gruppo, che una
 * scheda articolo non ce l'ha, le sole foto extra comuni a tutte le referenze. Le azioni sono quelle
 * della scheda (archivio.js) e agiscono sul codice della sezione: nel revisore, dopo una modifica,
 * si ricarica la finestra e non la pagina.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Archivio = require('../../Istanta/wwwroot/js/archivio.js');

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8').replace(/\r/g, '');
}

/* ---- il codice delle azioni ---- */

test('la riga di una referenza apre le sue foto, quella di un gruppo le foto del gruppo', () => {
    assert.strictEqual(Archivio.codiceDellaRigaRevisore(false, '6119227', '6119227'), '6119227');
    assert.strictEqual(Archivio.codiceDellaRigaRevisore(true, '', '123,456,789'), '123,456,789',
        'un gruppo non ha un codice di referenza: si usa il codice gruppo intero');
    assert.strictEqual(Archivio.codiceDellaRigaRevisore(true, undefined, undefined), '');
});

test('attiva e disattiva dicono al server su quali referenze', () => {
    assert.strictEqual(Archivio.indirizzoAttivaFotoExtra('G1', true, '123,456'),
        'attivaDisattivaFotoExtra/G1/true?codice=123%2C456');
    assert.strictEqual(Archivio.indirizzoAttivaFotoExtra('G1', false, '6119227'),
        'attivaDisattivaFotoExtra/G1/false?codice=6119227');
});

test('le azioni della sezione usano il suo codice, non il campo Codice della scheda', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    for (const metodo of ['SalvaDestinazioneFoto(gruppo) {', 'ConfermaFotoArticolo() {', 'CaricaNuovaFotoExtra(campo) {',
        'collegaImmagineScelta(immagine, tipo) {', 'AttivaDisattivaFotoExtra(casella) {', 'EliminaFotoExtra(button) {', 'AggiornaPrimario(guidId) {']) {
        const inizio = js.indexOf(metodo);
        assert.ok(inizio > 0, 'manca ' + metodo);
        const corpo = js.slice(inizio, js.indexOf('\n    }\n', inizio));
        assert.ok(!corpo.includes('$("#Codice")'), metodo + ' legge ancora il campo Codice, che nel revisore non c\'e\'');
        assert.ok(!corpo.includes('location.reload()'), metodo + ' ricaricherebbe tutto il revisore');
    }

    const dopo = js.slice(js.indexOf('DopoModificaFoto() {'), js.indexOf('AggiungiFotoArticolo() {'));
    assert.match(dopo, /attr\("data-in-finestra"\) === "true"\) \{\s*this\.RicaricaGestioneFoto\(\);\s*return;\s*\}\s*location\.reload\(\);/,
        'nel revisore si ricarica la finestra, nella scheda la pagina come prima');
});

// L'id fotoExtra era ripetuto su ogni riquadro: $("#fotoExtra") ne restituiva solo il primo, e il
// catalogo proponeva da collegare immagini che l'articolo aveva gia'.
test('le foto extra della sezione si leggono tutte, per classe', () => {
    const js = sorgente('Istanta/wwwroot/js/archivio.js');
    const parziale = sorgente('Istanta/Views/Shared/_GestioneFoto.cshtml');

    assert.ok(!js.includes('$("#fotoExtra")') && !js.includes("find('#fotoExtra')"));
    assert.ok(js.includes('find(".fotoExtraDati")') && js.includes("find('.fotoExtraDati')"));
    assert.ok(parziale.includes('<input type="hidden" class="fotoExtraDati" data='));
    assert.ok(!parziale.includes('id="fotoExtra"'));
});

/* ---- la sezione condivisa ---- */

test('la scheda articolo e il revisore usano la stessa sezione delle foto', () => {
    const scheda = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const controller = sorgente('Istanta/Controllers/SchedaArticoloController.cs');

    assert.ok(scheda.includes('@await Html.PartialAsync("_GestioneFoto", (Istanta.Models.GestioneFoto)ViewBag.GestioneFoto)'));
    assert.ok(!scheda.includes('data-azione="aggiungiFotoExtra"'), 'le sezioni non devono restare anche nella scheda');
    assert.ok(controller.includes('[Route("SchedaArticolo/GestioneFoto")]'));
    assert.ok((controller.match(/PartialView\("_GestioneFoto", sezione\)/g) || []).length >= 2);
});

test('un gruppo ha solo le foto extra, e lo dice', () => {
    const parziale = sorgente('Istanta/Views/Shared/_GestioneFoto.cshtml');

    assert.ok(parziale.includes('data-codice-foto="@Model.Codice"'), 'le azioni leggono da qui il codice');
    const prodotto = parziale.indexOf('<div class="sezioneFotoProdotto">');
    const condizione = parziale.lastIndexOf('@if (!Model.Gruppo)', prodotto);
    assert.ok(condizione > 0 && prodotto > condizione, 'le foto del prodotto solo per una referenza');
    assert.ok(parziale.includes('le foto extra comuni a tutte'), 'il gruppo spiega cosa sta guardando');
    assert.ok(parziale.includes('Model.CodiciSenzaArticolo'), 'una referenza non in archivio si segnala');
});

// Nel revisore la sezione e' gia' in una finestra: un'altra finestra sopra Bootstrap non la gestisce bene.
test('il catalogo da collegare si apre dentro la sezione, con Indietro', () => {
    const parziale = sorgente('Istanta/Views/Shared/_GestioneFoto.cshtml');
    const scheda = sorgente('Istanta/Views/SchedaArticolo/Index.cshtml');
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    assert.ok(parziale.includes('class="pannelloCollegaFotoExtra" style="display:none"'));
    assert.ok(parziale.includes('data-azione="chiudiCollegaFotoExtra"'));
    assert.ok(js.includes("[data-azione='chiudiCollegaFotoExtra']"));
    assert.ok(!scheda.includes('collegaFotoExtraModal') && !js.includes('collegaFotoExtraModal'));
});

/* ---- il revisore ---- */

test('ogni riga del revisore ha il pulsante delle foto', () => {
    const vista = sorgente('Istanta/Views/Revisore/Index.cshtml');
    const inizio = vista.indexOf('<template id ="template">');
    const riga = vista.slice(inizio, vista.indexOf('</template>', inizio));

    const pulsante = riga.match(/<i class='([^']*)' data-azione="apriGestioneFoto"/);
    assert.ok(pulsante, 'il pulsante sta nella riga usata da referenze e gruppi');
    assert.ok(!pulsante[1].split(' ').includes('fas'), 'nella riga .fas copia il codice');
});

test('il pulsante apre la finestra delle foto, anche sull\'intestazione costruita dal revisore', () => {
    const vista = sorgente('Istanta/Views/Revisore/Index.cshtml');
    const js = sorgente('Istanta/wwwroot/js/archivio.js');

    assert.ok(vista.includes('id="gestioneFotoModal"') && vista.includes('id="gestioneFotoBody"'));
    const avvio = vista.slice(vista.indexOf('function documentReady()'));
    assert.ok(avvio.indexOf('ArchivioItem = new Archivio();') < avvio.indexOf('ArchivioItem.collegaGestioneFotoRevisore();'));
    assert.ok(avvio.includes('ArchivioItem.collegaGestoriSchedaArticolo();'), 'le azioni della sezione sono quelle della scheda');

    //Sul documento: l'intestazione di un gruppo non dichiarato in lista non passa dai gestori delle righe.
    assert.ok(js.includes('pagina.on("click", "[data-azione=\'apriGestioneFoto\']"'));
    assert.ok(js.includes('"SchedaArticolo/GestioneFoto?codice=" + encodeURIComponent(codice || "")'));
});
