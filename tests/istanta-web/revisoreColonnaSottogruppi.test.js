/*
 * I20-982: la colonna di sinistra del revisore in modalita' sottogruppi.
 *
 * In quella modalita' la colonna del tracciato viene sostituita da un riepilogo. Prima portava
 * i campi del gruppo padre e poi una scheda per ogni singolo del gruppo: quei dati l'operatore
 * li ha gia' sotto gli occhi nelle righe del sottogruppo, e allungavano la colonna fino a
 * nascondere quello che conta. Ora resta il solo gruppo padre, con la sua intestazione.
 *
 * Sotto test c'e' la lettura dei campi, che non tocca il browser: vale il valore revisionato
 * quando c'e', altrimenti quello del tracciato. Il resto del metodo costruisce HTML e si
 * verifica sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const Revisore = require('../../Istanta/wwwroot/js/revisore.js');

const CHIAVI = {
    descrizione1: "Descrizioni.Descrizione1",
    descrizione2: "Descrizioni.Descrizione2",
    descrizione3: "Descrizioni.Descrizione3",
    descrizione4: "Descrizioni.Descrizione4",
    um: "Descrizioni.Um",
    peso: "Descrizioni.Peso"
};

function sorgente(percorso) {
    return fs.readFileSync(path.join(__dirname, '..', '..', percorso), 'utf8');
}

test('quando la revisione c\'e\', comanda lei', () => {
    const record = {
        recordRevisionato: { descrizione1: "Rivisto", descrizione2: "Anche questo", um: "KG", peso: 1.5 },
        recordInTracciato: {
            "Descrizioni.Descrizione1": "Dal tracciato",
            "Descrizioni.Descrizione2": "Dal tracciato 2",
            "Descrizioni.Um": "PZ",
            "Descrizioni.Peso": 9
        }
    };

    const campi = Revisore.campiPerLaColonna(record, CHIAVI);

    assert.strictEqual(campi.descrizione1, "Rivisto");
    assert.strictEqual(campi.descrizione2, "Anche questo");
    assert.strictEqual(campi.um, "KG");
    assert.strictEqual(campi.peso, 1.5);
});

test('senza revisione si mostra il tracciato', () => {
    const record = {
        recordRevisionato: null,
        recordInTracciato: { "Descrizioni.Descrizione1": "Dal tracciato", "Descrizioni.Peso": 3 }
    };

    const campi = Revisore.campiPerLaColonna(record, CHIAVI);

    assert.strictEqual(campi.descrizione1, "Dal tracciato");
    assert.strictEqual(campi.peso, 3);
});

// Una revisione che ha toccato un campo solo non deve svuotare gli altri.
test('la revisione parziale lascia il tracciato sugli altri campi', () => {
    const record = {
        recordRevisionato: { descrizione1: "Rivisto" },
        recordInTracciato: {
            "Descrizioni.Descrizione1": "Vecchio",
            "Descrizioni.Descrizione2": "Resta questo",
            "Descrizioni.Um": "PZ"
        }
    };

    const campi = Revisore.campiPerLaColonna(record, CHIAVI);

    assert.strictEqual(campi.descrizione1, "Rivisto");
    assert.strictEqual(campi.descrizione2, "Resta questo");
    assert.strictEqual(campi.um, "PZ");
});

test('dove non c\'e\' niente si mostra il vuoto, non undefined', () => {
    const campi = Revisore.campiPerLaColonna({ recordRevisionato: null, recordInTracciato: {} }, CHIAVI);

    assert.deepStrictEqual(campi, {
        descrizione1: "", descrizione2: "", descrizione3: "", descrizione4: "", um: "", peso: ""
    });
});

test('un record mancante non fa saltare la colonna', () => {
    assert.deepStrictEqual(Revisore.campiPerLaColonna(null, CHIAVI), {
        descrizione1: "", descrizione2: "", descrizione3: "", descrizione4: "", um: "", peso: ""
    });
    assert.strictEqual(Revisore.campiPerLaColonna({ recordInTracciato: { a: 1 } }, null).descrizione1, "");
});

/* ---- come la pagina costruisce la colonna ---- */

test('in modalita\' sottogruppi la colonna porta solo il gruppo padre', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('sostituisciColonnaSinistraGruppo() {');
    const metodo = revisore.slice(inizio, revisore.indexOf('copiaValoriNelGruppo(', inizio));

    const ramoSottogruppi = metodo.indexOf('if (revInstance.modalitaSottogruppi) {');
    const ramoAltro = metodo.indexOf('else {', ramoSottogruppi);
    const cicloSuiSingoli = metodo.indexOf('elementsOfGroup.forEach(');

    assert.ok(ramoSottogruppi > 0, 'il ramo della modalita\' sottogruppi deve esistere');
    assert.ok(cicloSuiSingoli > ramoAltro,
        'le schede dei singoli restano solo fuori dalla modalita\' sottogruppi');
});

test('la colonna si presenta con la sua intestazione', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    assert.ok(revisore.includes('Campi revisionati gruppo padre'),
        'senza intestazione non si capisce che cosa sia quella colonna');
});

// Il gruppo con il tracciato non compilato, fuori dalla modalita' sottogruppi, continua a
// mostrare le schede dei singoli: e' l'unico posto dove quei dati si vedono.
test('il gruppo senza tracciato compilato non perde le schede dei singoli', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('sostituisciColonnaSinistraGruppo() {');
    const metodo = revisore.slice(inizio, revisore.indexOf('copiaValoriNelGruppo(', inizio));

    assert.ok(metodo.includes('if (!tracciatoCompilato || revInstance.modalitaSottogruppi) {'),
        'la condizione di ingresso resta quella di prima');
    assert.ok(metodo.includes('elementsOfGroup.forEach('),
        'il ciclo sui singoli deve esistere ancora, per quel caso');
});

/* ---- il codice lungo nel riquadro ---- */

// Il codice del gruppo padre e' l'elenco delle referenze separate da virgola: nel riquadro non
// ci sta, e scritto per intero sfonda la colonna.
test('il codice lungo si tronca con i puntini e resta leggibile per intero', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('static riempiSchedaColonna(');
    const metodo = revisore.slice(inizio, revisore.indexOf('sostituisciColonnaSinistraGruppo() {', inizio));

    assert.ok(metodo.includes('"text-overflow": "ellipsis"'), 'i puntini li mette il browser');
    assert.ok(metodo.includes('"white-space": "nowrap"') && metodo.includes('"overflow": "hidden"'),
        'senza queste due il testo va a capo invece di troncarsi');
    assert.ok(metodo.includes('.attr("title", testoCodice)'),
        'il valore intero deve restare leggibile passandoci sopra');
    assert.ok(!/\.substring\(|\.slice\(0/.test(metodo),
        'il taglio a caratteri fissi non sa quanto spazio c\'e\' e taglierebbe a caso');
});

/* ---- il campo Descrizione1 che si adatta al testo ---- */

const schedaAltezza = (contenuto, riga, righe, spazio) =>
    Revisore.altezzaCampoDescrizione(contenuto, riga, righe, spazio);

// Il template fissa il campo a 40 pixel: una descrizione lunga si legge solo scorrendo dentro
// una finestrella alta una riga e mezza. Ora il campo cresce col testo, ma non oltre tre
// righe, altrimenti una descrizione lunga spingerebbe fuori vista il resto della colonna.
test('un testo corto lascia il campo basso', () => {
    assert.strictEqual(schedaAltezza(24, 16, 3, 8), 24);
});

test('un testo lungo si ferma a tre righe', () => {
    assert.strictEqual(schedaAltezza(500, 16, 3, 8), 56);
});

test('il testo che sta esatto in tre righe non viene tagliato', () => {
    assert.strictEqual(schedaAltezza(56, 16, 3, 8), 56);
});

test('lo spazio interno del campo si somma al tetto, non si perde', () => {
    assert.strictEqual(schedaAltezza(500, 16, 3, 0), 48);
    assert.strictEqual(schedaAltezza(500, 16, 3, 12), 60);
});

test('le righe frazionarie si arrotondano per eccesso, cosi\' la terza ci sta tutta', () => {
    assert.strictEqual(schedaAltezza(500, 16.5, 3, 0), 50);
});

// Misure illeggibili: meglio lasciare il campo com'e' che dargli un'altezza inventata.
test('senza misure valide non si tocca il campo', () => {
    assert.strictEqual(schedaAltezza(0, 16, 3, 8), null);
    assert.strictEqual(schedaAltezza(100, 0, 3, 8), null);
    assert.strictEqual(schedaAltezza(100, 16, 0, 8), null);
    assert.strictEqual(schedaAltezza(NaN, 16, 3, 8), null);
    assert.strictEqual(schedaAltezza(100, NaN, 3, 8), null);
});

test('uno spazio interno assurdo vale zero invece di rompere il calcolo', () => {
    assert.strictEqual(schedaAltezza(500, 16, 3, NaN), 48);
    assert.strictEqual(schedaAltezza(500, 16, 3, -10), 48);
});

test('l\'adattamento avviene dopo che la scheda e\' nella pagina', () => {
    const revisore = sorgente('Istanta/wwwroot/js/revisore.js');

    const inizio = revisore.indexOf('sostituisciColonnaSinistraGruppo() {');
    const metodo = revisore.slice(inizio, revisore.indexOf('copiaValoriNelGruppo(', inizio));

    const adattamenti = (metodo.match(/Revisore\.adattaDescrizioneAlTesto\(/g) || []).length;
    assert.strictEqual(adattamenti, 2, 'vale per la scheda del padre e per quelle dei singoli');

    const primoAdattamento = metodo.indexOf('Revisore.adattaDescrizioneAlTesto(');
    const primoAppend = metodo.indexOf('.dettaglioGruppo").append(htmlItem)');
    assert.ok(primoAppend > 0 && primoAppend < primoAdattamento,
        'prima dell\'inserimento nella pagina l\'altezza del contenuto non e\' misurabile');
});
