/*
 * I20-974: regole di segnalazione conflitti del CSS framework.
 *
 * Il modulo sotto test e' plugin/cssFramework/regoleConflitti.js (fino a I20-1007 cssRegoleConflitti.js), che legge le regole senza toccare
 * InDesign. Due cose vanno protette: che le forme di regola gia' in uso continuino a valere
 * esattamente come prima, e che la scelta fra riquadro dell'oggetto e testo reale arrivi
 * fino al controllo, perche' e' li' che nascevano le segnalazioni inutili.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cssRegoleConflitti = require('../../plugin/cssFramework/regoleConflitti');

const radice = path.join(__dirname, '..', '..');

function sorgente(percorso) {
    return fs.readFileSync(path.join(radice, percorso), 'utf8');
}

test('una regola a due lati separa gli elementi dei due lati', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['descrizione']);
    assert.deepStrictEqual(regola.latoB, ['*foto_extra*']);
});

test('una regola a un lato solo vale come "questi non si tocchino fra loro"', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['*foto_extra*']);
    assert.deepStrictEqual(regola.latoB, []);
});

test('il lato scritto per secondo, da solo, diventa comunque il primo', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['*foto_extra*']);
    assert.deepStrictEqual(regola.latoB, []);
});

test('piu\' etichette sullo stesso lato si separano per virgola', () => {
    const regola = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione, prezzo ', '*foto_extra*'] });

    assert.deepStrictEqual(regola.latoA, ['descrizione', 'prezzo']);
});

// Il punto della modifica: senza questa scelta il contatto si misura sul riquadro
// dell'oggetto, che per un campo di testo e' molto piu' largo del testo che contiene.
test('la scelta dei bounds arriva nella regola', () => {
    const suTesto = cssRegoleConflitti.normalizzaRegola({
        segnalazioni: ['descrizione', '*foto_extra*'],
        useTextBounds: true
    });
    const suRiquadro = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.strictEqual(suTesto.useTextBounds, true);
    assert.strictEqual(suRiquadro.useTextBounds, false);
});

test('una regola scritta come coppia di stringhe resta valida e misura sul riquadro', () => {
    const regole = cssRegoleConflitti.getListaRegole(['descrizione', '*foto_extra*']);

    assert.strictEqual(regole.length, 1);
    assert.deepStrictEqual(regole[0].latoA, ['descrizione']);
    assert.deepStrictEqual(regole[0].latoB, ['*foto_extra*']);
    assert.strictEqual(regole[0].useTextBounds, false);
});

test('un elenco di regole le legge tutte', () => {
    const regole = cssRegoleConflitti.getListaRegole([
        { segnalazioni: ['*foto_extra*'] },
        { segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true }
    ]);

    assert.strictEqual(regole.length, 2);
    assert.strictEqual(regole[0].useTextBounds, false);
    assert.strictEqual(regole[1].useTextBounds, true);
});

test('regole assenti o vuote non producono controlli', () => {
    assert.deepStrictEqual(cssRegoleConflitti.getListaRegole(null), []);
    assert.deepStrictEqual(cssRegoleConflitti.getListaRegole([]), []);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola(null), null);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola({ segnalazioni: [] }), null);
    assert.strictEqual(cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['', ''] }), null);
});

// La stessa coppia di lati misurata in due modi diversi e' un controllo diverso: se la
// chiave non lo distinguesse, la seconda regola verrebbe scartata come duplicato.
test('la chiave distingue le regole anche per la scelta dei bounds', () => {
    const suTesto = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true });
    const suRiquadro = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['descrizione', '*foto_extra*'] });

    assert.notStrictEqual(cssRegoleConflitti.chiaveRegola(suTesto), cssRegoleConflitti.chiaveRegola(suRiquadro));
});

// Senza questo passaggio l'opzione resterebbe un dato che nessuno guarda.
test('il controllo passa la scelta dei bounds al confronto fra elementi', () => {
    const framework = sorgente('plugin/CssFramework.js');
    const inizio = framework.indexOf('controllaSegnalazioniConflittiPendenti(box) {');
    const blocco = framework.slice(inizio, inizio + 2500);

    const chiamate = blocco.match(/elementsTouching\([^)]*\)/g) || [];

    assert.strictEqual(chiamate.length, 2, 'il controllo confronta gli elementi in due punti');
    assert.ok(
        chiamate.every(c => c.includes('regola.useTextBounds')),
        'entrambi i confronti devono usare la scelta dichiarata nella regola');
});

// La regola chiesta dalla issue, sul cliente indicato.
test('Edro21 chiede che la descrizione non tocchi le foto extra, misurando il testo', () => {
    const config = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json'));

    const regole = [];
    (function cerca(nodo) {
        if (Array.isArray(nodo)) {
            nodo.forEach(cerca);
            return;
        }
        if (nodo && typeof nodo === 'object') {
            if (Array.isArray(nodo.segnalazioniConflitti)) {
                regole.push(...nodo.segnalazioniConflitti);
            }
            Object.values(nodo).forEach(cerca);
        }
    })(config);

    // Produzione ha allargato il primo pattern a '*descrizione*' (I20-989): la regola e' la stessa,
    // cambia solo quanto pesca. Cio' che non deve cambiare e' la misura sul testo.
    const descrizione = regole.filter(r =>
        Array.isArray(r.segnalazioni) &&
        (r.segnalazioni[0] === 'descrizione' || r.segnalazioni[0] === '*descrizione*') &&
        r.segnalazioni[1] === '*foto_extra*');

    assert.ok(descrizione.length > 0, 'la regola deve esistere nella configurazione di Edro21');
    assert.ok(descrizione.every(r => r.useTextBounds === true),
        'va misurata sul testo reale, altrimenti torna a segnalare il riquadro vuoto');
});

/* ---- geometria del contatto, con i numeri del collaudo su BOX1 di Edro ----
 * Convenzione InDesign: [alto, sinistra, basso, destra].
 */

// Rettangoli del collaudo: la descrizione misurata come rettangolo unico e la foto extra.
const descrizioneRettangoloUnico = [149.16, 70.26, 186.7, 101.8];
const fotoExtra = [148, 36.5, 162.99, 71.38];

test('con il rettangolo unico i due elementi risultano in contatto', () => {
    // E' la situazione che segnalava: si sovrappongono per 1.12 punti in orizzontale.
    assert.strictEqual(
        cssRegoleConflitti.rettangoliInContatto(descrizioneRettangoloUnico, fotoExtra),
        true);
});

test('due elementi che si sfiorano al bordo non si toccano', () => {
    // La foto finisce esattamente dove comincia il testo: nessuna sovrapposizione.
    const testoAccostato = [149.16, 71.38, 186.7, 101.8];

    assert.strictEqual(cssRegoleConflitti.rettangoliInContatto(testoAccostato, fotoExtra), false);
});

test('la riga che sta accanto alla foto decide, non quella lunga piu' + "' in basso", () => {
    // Prima riga corta, nella fascia verticale della foto, che comincia oltre il suo bordo.
    const rigaCorta = [150, 74, 158, 88];
    // Riga lunga piu' in basso: e' lei che allargava il rettangolo unico fino a 70.26.
    const rigaLunga = [168, 70.26, 178, 101.8];

    assert.strictEqual(
        cssRegoleConflitti.contattoConLeRighe(fotoExtra, [rigaCorta, rigaLunga], descrizioneRettangoloUnico),
        false,
        'nessuna riga tocca la foto: non e\' un conflitto');
});

test('se una riga tocca davvero la foto il conflitto resta', () => {
    const rigaCheTocca = [150, 70.26, 158, 101.8];
    const rigaLontana = [168, 74, 178, 101.8];

    assert.strictEqual(
        cssRegoleConflitti.contattoConLeRighe(fotoExtra, [rigaCheTocca, rigaLontana], descrizioneRettangoloUnico),
        true);
});

test('lo spazio fra due righe non e\' testo', () => {
    // Foto stretta infilata fra la prima e la seconda riga.
    const fotoFraLeRighe = [159, 74, 167, 90];
    const prima = [150, 70, 158, 101];
    const seconda = [168, 70, 176, 101];

    assert.strictEqual(
        cssRegoleConflitti.contattoConLeRighe(fotoFraLeRighe, [prima, seconda], [150, 70, 176, 101]),
        false);
});

test('senza righe leggibili si torna al rettangolo unico', () => {
    // Un campo senza righe non permette una misura precisa: meglio il comportamento di prima
    // che un silenzio arbitrario.
    assert.strictEqual(
        cssRegoleConflitti.contattoConLeRighe(fotoExtra, [], descrizioneRettangoloUnico),
        true);
});

test('rettangoli malformati non producono contatti inventati', () => {
    assert.strictEqual(cssRegoleConflitti.rettangoliInContatto(null, fotoExtra), false);
    assert.strictEqual(cssRegoleConflitti.rettangoliInContatto([1, 2], fotoExtra), false);
});

test('il confronto sul testo passa dalle righe reali', () => {
    const framework = sorgente('plugin/CssFramework.js');
    const inizio = framework.indexOf('elementsTouching(item1, item2, useTextBounds = false, useContornoImmagini = false, contorni = null) {');
    assert.ok(inizio > 0, 'elementsTouching non trovata');
    const blocco = framework.slice(inizio, inizio + 2000);

    assert.ok(blocco.includes('righeDiTesto('),
        'con la misura sul testo si confrontano le righe, non il rettangolo che le ingloba');
    assert.ok(blocco.includes('cssRegoleConflitti.rettangoliInContatto('),
        'la sovrapposizione fra rettangoli vive nel modulo verificabile');
});

/* ---- altezza della riga, dal collaudo del 18 settembre ----
 * La riga 7 della descrizione risultava [150.06, 80.21, 163.59, 110.15]: 13.5 punti di
 * altezza per una riga sola, perche' al rettangolo veniva sommato anche il corpo del
 * carattere oltre all'ascent. Quello spazio bianco sopra il testo toccava la foto extra.
 */

test('la riga e\' alta quanto il testo, non un\'interlinea di piu\'', () => {
    // Valori compatibili con la riga del collaudo: base 161.1, ascent 5.6, descent 2.49.
    const riga = cssRegoleConflitti.rettangoloDiRiga(161.1, 5.6, 2.49, 80.21, 110.15);

    assert.deepStrictEqual(riga.map(v => Math.round(v * 100) / 100), [155.5, 80.21, 163.59, 110.15]);
    assert.ok(riga[2] - riga[0] < 9, 'una riga non puo\' essere alta come due');
});

test('con la riga giusta la foto del collaudo non tocca piu\' il testo', () => {
    const fotoDelCollaudo = [138, 46.5, 152.99, 81.38];
    const rigaGonfiata = [150.06, 80.21, 163.59, 110.15];
    const rigaReale = cssRegoleConflitti.rettangoloDiRiga(161.1, 5.6, 2.49, 80.21, 110.15);

    assert.strictEqual(
        cssRegoleConflitti.rettangoliInContatto(rigaGonfiata, fotoDelCollaudo), true,
        'con lo spazio bianco in cima il contatto risultava');
    assert.strictEqual(
        cssRegoleConflitti.rettangoliInContatto(rigaReale, fotoDelCollaudo), false,
        'con l\'altezza reale del testo la foto resta sopra la riga');
});

test('il rettangolo della riga non usa il corpo del carattere', () => {
    const framework = sorgente('plugin/CssFramework.js');
    const inizio = framework.indexOf('righeDiTesto(item) {');
    const blocco = framework.slice(inizio, inizio + 1200);

    assert.ok(blocco.includes('cssRegoleConflitti.rettangoloDiRiga('),
        'la geometria della riga vive nel modulo verificabile');
    assert.ok(!blocco.includes('pointSize'),
        'il corpo del carattere non entra nell\'altezza della riga');
});

/* ---- TASK-652c4a82: in BOX7 di Edro21 conta la descrizione, non il gruppo col BIS ----
 * '*descrizione*' prendeva anche gruppo_descrizione_BIS: un gruppo non ha righe di testo, e il
 * controllo lo misurava col riquadro intero, BIS compreso, segnalando CSF-013 anche col testo
 * della descrizione libero. Il motivo era stato allargato per l'etichetta col DNA
 * (descrizione$DNA$...), ma il controllo la riduce gia' a "descrizione" con parseLabel prima di
 * confrontarla: basta il nome esatto.
 */

//Un membro di un oggetto del Plugin, isolato contando le graffe, dal file che sotto Node non si carica.
function membroDalSorgente(percorso, intestazione) {
    const testo = sorgente(percorso);
    const inizio = testo.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + ' non trovata in ' + percorso + ': il test va aggiornato');
    let livello = 0;
    for (let i = inizio; i < testo.length; i++) {
        if (testo[i] === '{') { livello++; }
        else if (testo[i] === '}') { livello--; if (livello === 0) { return testo.substring(inizio, i + 1); } }
    }
    assert.fail(intestazione + ' non delimitata');
}

//makeRegexFromGroupName di CssFramework e parseLabel di utility.js, come sono scritte davvero.
//Il CssFramework ne ha anche una copia commentata piu' in alto: si prende la definizione, a inizio riga.
const motivoDelCss = new Function('return ({' + membroDalSorgente('plugin/CssFramework.js', '\n    makeRegexFromGroupName(groupName) {') + '});')();
const parseLabelVera = new Function('pluginMiddleware', 'return ({' + membroDalSorgente('plugin/utility.js', 'parseLabel(label){') + '});')({ getCampo: () => null });

//Le etichette che una regola prende, come in getElementiSegnalazioniConflitti: label passata da parseLabel.
function prende(lato, etichetta) {
    const label = parseLabelVera.parseLabel(etichetta);
    return lato.some(motivo => motivoDelCss.makeRegexFromGroupName(motivo).test(label));
}

test('Edro21: la regola coi loghi prende la descrizione, anche col DNA, e non il gruppo del BIS', () => {
    const config = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json'));
    const regole = [];
    (function cerca(nodo) {
        if (Array.isArray(nodo)) { nodo.forEach(cerca); return; }
        if (nodo && typeof nodo === 'object') {
            if (Array.isArray(nodo.segnalazioniConflitti)) {
                regole.push(...cssRegoleConflitti.getListaRegole(nodo.segnalazioniConflitti));
            }
            Object.values(nodo).forEach(cerca);
        }
    })(config);

    const coiLoghi = regole.filter(r => r.latoB.includes('*foto_extra*'));
    //Una per kit: SC e SS/CN/CY.
    assert.strictEqual(coiLoghi.length, 2);
    coiLoghi.forEach(function (regola) {
        assert.strictEqual(regola.useTextBounds, true);
        assert.ok(prende(regola.latoA, 'descrizione'));
        //Il campo che porta il DNA del box.
        assert.ok(prende(regola.latoA, 'descrizione$DNA$BOX7$4960868$4960839,4960868$382329'));
        assert.ok(!prende(regola.latoA, 'gruppo_descrizione_BIS'), 'il gruppo del BIS si misurerebbe col riquadro intero');
        assert.ok(!prende(regola.latoA, 'BIS'));
        //I loghi restano presi: le foto extra tengono l'etichetta intera.
        assert.ok(prende(regola.latoB, 'foto_extra$Logo_SDB$tipo_1'));
    });
});

/* ---- I20-1178: le misure del contatto nel registro del Plugin ---- */

//Il box della issue, misurato in InDesign: logo TERRITORIO in alto a destra, descrizione col
//riquadro che sale sul logo di 1 mm e la prima riga di testo 6 mm piu' in basso.
const LOGO_TERRITORIO = [150, 328.86, 164.48, 343.33];
const DESCRIZIONE_PANNA = {
    rettangolo: [163.45, 312.33, 188.45, 344.33],
    righe: [
        [170.60, 326.98, 174.13, 342.73],
        [174.13, 329.35, 177.66, 342.73],
        [177.66, 320.86, 181.19, 342.73],
        [181.19, 333.71, 184.71, 342.73],
        [184.50, 332.78, 188.03, 342.73]
    ],
    testi: ["Panna fresca \n", "da montare\n", "Centrale del latte \n", "di Roma\n", "250 ml"]
};

test('il riquadro che sale sul logo non e\' un contatto: nessuna misura', () => {
    const logo = { rettangolo: LOGO_TERRITORIO, righe: [], testi: [] };

    assert.strictEqual(cssRegoleConflitti.descriviContatto(DESCRIZIONE_PANNA, logo), '');
});

test('una riga sul logo: il messaggio dice quale, con le sue parole e le misure', () => {
    //Il logo abbassato fin dentro la seconda riga.
    const logo = { rettangolo: [160, 328.86, 175, 343.33], righe: [], testi: [] };

    const misure = cssRegoleConflitti.descriviContatto(DESCRIZIONE_PANNA, logo);

    assert.strictEqual(misure,
        'Misure in mm [alto, sinistra, basso, destra]: riga 1 \u00ABPanna fresca\u00BB [170.60, 326.98, 174.13, 342.73] ' +
        'tocca riquadro [160.00, 328.86, 175.00, 343.33].');
});

test('senza righe le misure sono quelle dei due riquadri', () => {
    const a = { rettangolo: [0, 0, 10, 10], righe: [], testi: [] };
    const b = { rettangolo: [5, 5, 15, 15], righe: [], testi: [] };

    assert.strictEqual(cssRegoleConflitti.descriviContatto(a, b),
        'Misure in mm [alto, sinistra, basso, destra]: riquadro [0.00, 0.00, 10.00, 10.00] tocca riquadro [5.00, 5.00, 15.00, 15.00].');
});

test('una riga senza parole leggibili si nomina col solo numero', () => {
    const a = { rettangolo: [0, 0, 20, 20], righe: [[0, 0, 5, 20]], testi: [] };
    const b = { rettangolo: [1, 1, 3, 3], righe: [], testi: [] };

    assert.match(cssRegoleConflitti.descriviContatto(a, b), /: riga 1 \[0\.00, 0\.00, 5\.00, 20\.00\] tocca riquadro/);
});

test('la CSF-013 porta le misure nel registro, non nel bollino', () => {
    const css = sorgente('plugin/CssFramework.js').replace(/\r/g, '');
    const corpo = css.substring(css.indexOf('    segnalaConflittoElementi(box, elementoA, elementoB, pendente, useTextBounds = false, useContornoImmagini = false, contorni = null) {'));
    const segnala = corpo.substring(0, corpo.indexOf('\n    },\n'));

    assert.match(segnala, /var misure = this\.misureContatto\(elementoA\.item, elementoB\.item, useTextBounds, useContornoImmagini, contorni\);/);
    assert.match(segnala, /messaggioUtente\(misure != "" \? msg \+ " " \+ misure : msg, "warning"\);/);
    //Il bollino ha il testo di sempre; dal secondo giro di I20-1178 porta anche i dati per rimisurarla.
    assert.match(segnala, /addSegnalazione\(msg, "warning", 2, true, \["CSF-013", "yellow"\], null, cssRegoleConflitti\.datiDiVerifica\(elementoA\.label, elementoB\.label, useTextBounds, useContornoImmagini\)\);/);
    //Le misure si prendono come il controllo prende il contatto: stessa scelta dei bounds, e
    //(I20-1208) dello stesso modo di misurare le immagini.
    assert.strictEqual((css.match(/this\.segnalaConflittoElementi\([^)]*, pendente, regola\.useTextBounds, regola\.useContornoImmagini, contorni\);/g) || []).length, 2);
});

test('il noRender del record si applica prima del controllo dei conflitti', () => {
    //Il controllo salta gli elementi nascosti: se il noRender arrivasse dopo, un elemento
    //destinato a sparire farebbe nascere una CSF-013 che nel box finito non si vede.
    const index = sorgente('plugin/indexNew.js').replace(/\r/g, '');
    const inizio = index.indexOf('async function callAllOperationFixBox(');
    const funzione = index.substring(inizio, index.indexOf('\n}\n', inizio));

    const noRender = funzione.indexOf('applicaNoRenderAgliElementiDelBox(boxImpaginato, itemRef.noRenderElementi);');
    const controllo = funzione.indexOf('CssFramework.controllaSegnalazioniConflittiPendenti(boxImpaginato);');
    assert.ok(noRender > 0, 'il noRender non si applica in callAllOperationFixBox');
    assert.ok(controllo > noRender, 'il controllo dei conflitti viene prima del noRender');
    assert.ok(funzione.indexOf('SistemazioneFoto.fixFoto(') < noRender, 'il noRender deve venire dopo la sistemazione delle foto');
    //Dal ricalcolo della griglia arriva senza record.
    assert.match(funzione, /if \(itemRef != null\) \{\s*applicaNoRenderAgliElementiDelBox/);
});

/* ---- I20-1178, secondo giro: le CSF-013 del bollino si rimisurano dalla scheda ref ---- */

const TESTO_CSF013 = 'Code CSF-013: Conflitto tra elementi nel box BOX1: descrizione non dovrebbe toccare foto_extra$TERRITORIO_LA VOL$tipo_3.';

test('i dati di verifica sono le due etichette e il modo di misura', () => {
    assert.deepStrictEqual(cssRegoleConflitti.datiDiVerifica('descrizione', 'foto_extra$X$tipo_3', true),
        { a: 'descrizione', b: 'foto_extra$X$tipo_3', tb: true });
    assert.strictEqual(cssRegoleConflitti.datiDiVerifica('a', 'b', undefined).tb, false);
});

test('una CSF-013 nuova si rimisura con i dati salvati nella voce', () => {
    const voce = { g: 'warning', c: 'CSF-013', t: TESTO_CSF013, v: { a: 'descrizione', b: 'foto_extra$TERRITORIO_LA VOL$tipo_3', tb: true } };

    assert.deepStrictEqual(cssRegoleConflitti.voceDiConflitto(voce),
        { a: 'descrizione', b: 'foto_extra$TERRITORIO_LA VOL$tipo_3', useTextBounds: true });
});

test('una CSF-013 scritta prima: le etichette dal testo, anche con spazi e $, il modo di misura da cercare', () => {
    const voce = { g: 'warning', c: 'CSF-013', t: TESTO_CSF013 };

    assert.deepStrictEqual(cssRegoleConflitti.voceDiConflitto(voce),
        { a: 'descrizione', b: 'foto_extra$TERRITORIO_LA VOL$tipo_3', useTextBounds: null });
});

test('le altre segnalazioni e i testi che non si leggono non sono conflitti da rimisurare', () => {
    assert.strictEqual(cssRegoleConflitti.voceDiConflitto({ g: 'error', c: 'CSF-009', t: 'Code CSF-009: L\'elemento eccede' }), null);
    //Bollino vecchio: spesso il solo codice.
    assert.strictEqual(cssRegoleConflitti.voceDiConflitto({ g: 'warning', c: 'CSF-013', t: 'CSF-013', vecchio: true }), null);
    assert.strictEqual(cssRegoleConflitti.voceDiConflitto(null), null);
});

//Il confronto del CSS: "*foto_extra*" diventa /^.*foto_extra.*$/.
function corrispondeComeIlCss(motivo, etichetta) {
    const regex = '^' + motivo.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$';
    return new RegExp(regex).test(etichetta);
}

test('il modo di misura si prende dalla regola che riguarda la coppia, nei due versi', () => {
    const regole = cssRegoleConflitti.getListaRegole([
        { segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true },
        { segnalazioni: ['foto_extra*tipo_3'], useTextBounds: false }
    ]);
    const logo = 'foto_extra$TERRITORIO_LA VOL$tipo_3';

    assert.strictEqual(cssRegoleConflitti.modoDiMisura(regole, 'descrizione', logo, corrispondeComeIlCss), true);
    assert.strictEqual(cssRegoleConflitti.modoDiMisura(regole, logo, 'descrizione', corrispondeComeIlCss), true);
    //La regola a un lato solo: due loghi fra loro, sui riquadri.
    assert.strictEqual(cssRegoleConflitti.modoDiMisura(regole, logo, 'foto_extra$conad_cpq$tipo_3', corrispondeComeIlCss), false);
    //Nessuna regola riguarda la coppia.
    assert.strictEqual(cssRegoleConflitti.modoDiMisura(regole, 'descrizione', 'prezzo_offerta', corrispondeComeIlCss), null);
    assert.strictEqual(cssRegoleConflitti.modoDiMisura(null, 'descrizione', logo, corrispondeComeIlCss), null);
});

test('se due regole riguardano la coppia e una misura sui riquadri, vale il riquadro', () => {
    const regole = cssRegoleConflitti.getListaRegole([
        { segnalazioni: ['descrizione', '*foto_extra*'], useTextBounds: true },
        { segnalazioni: ['descrizione', '*TERRITORIO*'], useTextBounds: false }
    ]);

    assert.strictEqual(cssRegoleConflitti.modoDiMisura(regole, 'descrizione', 'foto_extra$TERRITORIO_LA VOL$tipo_3', corrispondeComeIlCss), false);
});

test('la voce del bollino porta i dati di verifica solo se la segnalazione li ha', () => {
    const etichetta = require('../../plugin/segnalazioni/etichetta');
    const v = { a: 'descrizione', b: 'foto_extra$X$tipo_3', tb: true };

    assert.deepStrictEqual(etichetta.daSegnalazione({ msg: TESTO_CSF013, typeMessage: 'warning', verifica: v }),
        { g: 'warning', c: 'CSF-013', t: TESTO_CSF013, v: v });
    assert.deepStrictEqual(etichetta.daSegnalazione({ msg: 'Code CSF-009: x', typeMessage: 'error' }),
        { g: 'error', c: 'CSF-009', t: 'Code CSF-009: x' });
    //Il campo arriva da addSegnalazione, come ultimo parametro facoltativo.
    const index = sorgente('plugin/indexNew.js').replace(/\r/g, '');
    assert.match(index, /function addSegnalazione\(msg, [^)]*, key = null, verifica = null\) \{/);
    assert.match(index, /if \(verifica != null\) \{\s*segnalazione\.verifica = verifica;\s*\}/);
});

/* ---- il ricontrollo su un box finto ---- */

function caricaCssFramework() {
    const Module = require('node:module');
    const originale = Module._load;
    //I20-1208: lo scontorno sul canale alfa si chiede con l'enumerazione di InDesign.
    Module._load = function (richiesta) {
        return richiesta === 'indesign' ? { ClippingPathType: { NONE: 'NONE', ALPHA_CHANNEL: 'ALPHA_CHANNEL' } } : originale.apply(this, arguments);
    };
    try {
        return require('../../plugin/CssFramework.js');
    }
    finally {
        Module._load = originale;
    }
}

const etichettaBollino = require('../../plugin/segnalazioni/etichetta');

//Un box con due riquadri e un bollino con le voci date. remove toglie davvero, e addBollinoCustom
//(finto) ridisegna il bollino nello stesso box.
function boxConBollino(descrizione, logo, voci) {
    const box = { label: 'BOX1', isValid: true, id: 1, allPageItems: [], ovals: null };
    let id = 10;
    const elemento = (label, bounds) => {
        const el = { id: id++, label: label, constructorName: 'Rectangle', isValid: true, visible: true, parent: null, geometricBounds: bounds };
        el.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== el); };
        box.allPageItems.push(el);
        return el;
    };
    elemento('descrizione', descrizione);
    elemento('foto_extra$TERRITORIO_LA VOL$tipo_3', logo);
    elemento(etichettaBollino.scrivi(voci), [0, 0, 5, 5]);
    return box;
}

function conAmbienteFinto(fn) {
    const salvati = { Utility: global.Utility, messaggioUtente: global.messaggioUtente, readFile: global.readFile };
    const messaggi = [];
    global.Utility = {
        parseLabel: label => String(label == null ? '' : label),
        eUnClone: () => false,
        percorsoDati: nome => '/dati/' + nome,
        addBollinoCustom(box, testo, colore, gradiente, posizione, bounds, overflow, etichetta) {
            const ovale = { id: 99, label: etichetta, isValid: true, visible: true, parent: null, geometricBounds: [0, 0, 5, 5] };
            ovale.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== ovale); };
            box.allPageItems.push(ovale);
            return box;
        }
    };
    global.messaggioUtente = (testo, stile) => messaggi.push({ testo, stile });
    global.readFile = () => null;
    try {
        fn(caricaCssFramework(), messaggi);
    }
    finally {
        Object.keys(salvati).forEach(k => { if (salvati[k] === undefined) { delete global[k]; } else { global[k] = salvati[k]; } });
    }
}

const VOCE_CON_DATI = { g: 'warning', c: 'CSF-013', t: TESTO_CSF013, v: { a: 'descrizione', b: 'foto_extra$TERRITORIO_LA VOL$tipo_3', tb: false } };
const ALTRA_VOCE = { g: 'warning', c: 'CSF-26', t: 'Code CSF-26: Foto senza tracciato' };

test('una CSF-013 il cui contatto non c\'e\' piu\' si toglie, e il registro lo dice', () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxConBollino([170, 312, 188, 344], [150, 328, 164, 343], [VOCE_CON_DATI, ALTRA_VOCE]);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(box).map(v => v.c), ['CSF-26']);
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /^Code CSF-28: Segnalazione CSF-013 tolta dal box BOX1: descrizione e foto_extra\$TERRITORIO_LA VOL\$tipo_3 non si toccano piu'\. Misure in mm/);
    });
});

test('una CSF-013 ancora vera resta nel bollino', () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const box = boxConBollino([160, 312, 188, 344], [150, 328, 164, 343], [VOCE_CON_DATI]);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(box).map(v => v.c), ['CSF-013']);
        assert.strictEqual(messaggi.length, 0);
    });
});

test('una CSF-013 scritta prima, senza regole da cui sapere come misurare, resta', () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const voceVecchia = { g: 'warning', c: 'CSF-013', t: TESTO_CSF013 };
        const box = boxConBollino([170, 312, 188, 344], [150, 328, 164, 343], [voceVecchia]);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(box).map(v => v.c), ['CSF-013']);
        assert.strictEqual(messaggi.length, 0);
    });
});

test('tolta l\'ultima segnalazione, il box resta senza bollino', () => {
    conAmbienteFinto((CssFramework) => {
        const box = boxConBollino([170, 312, 188, 344], [150, 328, 164, 343], [VOCE_CON_DATI]);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.strictEqual(Segnalazioni().bolliniDelBox(box).length, 0);
        assert.strictEqual(box.allPageItems.length, 2);
    });
});

function Segnalazioni() {
    return require('../../plugin/segnalazioni/segnalazioni');
}

test('la scheda ref rimisura le CSF-013 prima di leggere il bollino, e segue il box rigruppato', () => {
    const scheda = sorgente('plugin/schedaRef.js').replace(/\r/g, '');

    const apertura = scheda.substring(scheda.indexOf('    async attivaSchermateReferenza('));
    const ricontrollo = apertura.indexOf('box = me.ricontrollaConflittiDelBollino(box);');
    const lettura = apertura.indexOf('me.leggiVociBollino(box);');
    assert.ok(ricontrollo > 0 && lettura > ricontrollo, 'il ricontrollo deve venire prima della lettura del bollino');

    const corpo = scheda.substring(scheda.indexOf('    ricontrollaConflittiDelBollino(box) {'));
    const funzione = corpo.substring(0, corpo.indexOf('\n    },\n'));
    assert.match(funzione, /const eraSelezionato = SchermataSegnalazioni\.eSelezionato\(box\);\s*const dopo = CssFramework\.ricontrollaConflittiDelBox\(box\);/);
    assert.match(funzione, /this\.refSelected\.item = dopo;/);
    assert.match(funzione, /SchermataSegnalazioni\.seguiBoxRigruppato\(box, dopo, eraSelezionato\);/);
});

/* ---- I20-1208: i loghi misurati sul contorno della parte non trasparente ----
 * Nel BOX12 di Edro21 le cornici di conad_piacersi e di Logo_SDB si sovrapponevano, ma i loghi no:
 * Logo_SDB.psd ha il 5% di margine trasparente per lato. Con useContornoImmagini la regola misura
 * le immagini sul contorno che InDesign ricava dal canale alfa della trasparenza. Le misure sono
 * quelle lette in InDesign con la sonda del task sul logo SDB: cornice [232.5, 433.5, 243.08, 474.82],
 * contorno [235.94, 435.3, 243.08, 472.7].
 */

const CORNICE_SDB = [232.5, 433.5, 243.08, 474.82];
//Il contorno del disegno di SDB come entirePath di InDesign: punti [x, y].
const TRACCIATO_SDB = [[435.3, 235.94], [472.7, 235.94], [472.7, 243.08], [435.3, 243.08]];

test('I20-1208: la regola dice se misurare le immagini sul contorno, e senza dirlo resta sulla cornice', () => {
    const conContorno = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['foto_extra*tipo_3'], useContornoImmagini: true });
    const senza = cssRegoleConflitti.normalizzaRegola({ segnalazioni: ['foto_extra*tipo_3'] });

    assert.strictEqual(conContorno.useContornoImmagini, true);
    assert.strictEqual(senza.useContornoImmagini, false);
    assert.strictEqual(cssRegoleConflitti.getListaRegole(['descrizione', '*foto_extra*'])[0].useContornoImmagini, false);
    assert.notStrictEqual(cssRegoleConflitti.chiaveRegola(conContorno), cssRegoleConflitti.chiaveRegola(senza));
    //La chiave delle regole di sempre non cambia.
    assert.strictEqual(cssRegoleConflitti.chiaveRegola(senza), 'foto_extra*tipo_3||geom');
});

test('I20-1208: la CSF-013 misurata sul contorno lo porta nei dati di verifica, e la rimisura lo ritrova', () => {
    assert.deepStrictEqual(cssRegoleConflitti.datiDiVerifica('a', 'b', false, true), { a: 'a', b: 'b', tb: false, ci: true });
    assert.deepStrictEqual(cssRegoleConflitti.datiDiVerifica('a', 'b', false, false), { a: 'a', b: 'b', tb: false });

    const voce = { g: 'warning', c: 'CSF-013', t: TESTO_CSF013, v: { a: 'x', b: 'y', tb: false, ci: true } };
    assert.deepStrictEqual(cssRegoleConflitti.voceDiConflitto(voce), { a: 'x', b: 'y', useTextBounds: false, useContornoImmagini: true });
});

test('I20-1208: il canale della trasparenza si riconosce dal nome, altrimenti vale il primo', () => {
    assert.strictEqual(cssRegoleConflitti.canaleDellaTrasparenza(['Trasparenza']), 'Trasparenza');
    assert.strictEqual(cssRegoleConflitti.canaleDellaTrasparenza(['Alfa 1', 'Transparency']), 'Transparency');
    assert.strictEqual(cssRegoleConflitti.canaleDellaTrasparenza(['Alfa 1']), 'Alfa 1');
    assert.strictEqual(cssRegoleConflitti.canaleDellaTrasparenza([]), null);
    assert.strictEqual(cssRegoleConflitti.canaleDellaTrasparenza(undefined), null);
});

test('I20-1208: un tracciato con curve diventa segmenti che seguono la pancia della curva', () => {
    //Due ancoraggi con le maniglie tirate in alto: la curva sale sopra la retta fra i due.
    const curva = [[[0, 0], [0, 10], [0, 0]], [[10, 0], [10, 10], [10, 0]]];
    const vertici = cssRegoleConflitti.verticiDelTracciato(curva);

    assert.ok(vertici.length > 2);
    assert.ok(Math.min(...vertici.map(p => p[1])) < 10, 'i punti della curva stanno sopra gli ancoraggi');
    //Un tracciato di soli segmenti resta i suoi punti.
    assert.deepStrictEqual(cssRegoleConflitti.verticiDelTracciato(TRACCIATO_SDB), TRACCIATO_SDB);
});

test('I20-1208: del contorno conta solo quello che la cornice lascia vedere', () => {
    const poligoni = cssRegoleConflitti.poligoniDelContorno([[[0, 0], [20, 0], [20, 10], [0, 10]]], [0, 0, 10, 15]);

    assert.strictEqual(poligoni.length, 1);
    assert.deepStrictEqual(cssRegoleConflitti.riquadroDeiPoligoni(poligoni), [0, 0, 10, 15]);
    //Un tracciato tutto fuori dalla cornice non lascia niente.
    assert.deepStrictEqual(cssRegoleConflitti.poligoniDelContorno([[[30, 0], [40, 0], [40, 10]]], [0, 0, 10, 15]), []);
});

test('I20-1208: cornici sovrapposte, disegni accanto: nessun contatto; disegni sovrapposti: contatto', () => {
    const sdb = cssRegoleConflitti.poligoniDelContorno([TRACCIATO_SDB], CORNICE_SDB);
    //Piacersi non ha margini laterali: il suo disegno comincia dove comincia la sua cornice.
    const piacersiAccanto = [cssRegoleConflitti.poligonoDelRettangolo([232.5, 472.9, 245, 500])];
    const piacersiSopra = [cssRegoleConflitti.poligonoDelRettangolo([232.5, 471, 245, 500])];

    assert.ok(cssRegoleConflitti.rettangoliInContatto(CORNICE_SDB, [232.5, 472.9, 245, 500]), 'le cornici si sovrappongono');
    assert.strictEqual(cssRegoleConflitti.poligoniInContatto(sdb, piacersiAccanto), false);
    assert.strictEqual(cssRegoleConflitti.poligoniInContatto(sdb, piacersiSopra), true);
});

test('I20-1208: il contatto fra forme guarda la forma, non il rettangolo che la contiene', () => {
    //Una L e un quadrato nel suo angolo vuoto: i rettangoli si sovrappongono, le forme no.
    const elle = [[[0, 0], [2, 0], [2, 8], [10, 8], [10, 10], [0, 10]]];
    const nellAngolo = [cssRegoleConflitti.poligonoDelRettangolo([1, 4, 6, 9])];
    const dentro = [cssRegoleConflitti.poligonoDelRettangolo([8.5, 0.5, 9.5, 1.5])];

    assert.strictEqual(cssRegoleConflitti.poligoniInContatto(elle, nellAngolo), false);
    assert.strictEqual(cssRegoleConflitti.poligoniInContatto(elle, dentro), true, 'una forma dentro l\'altra le tocca');
    assert.strictEqual(cssRegoleConflitti.poligoniInContatto([], dentro), false);
});

//Un logo finto come lo vede il Plugin: la cornice e un'immagine il cui scontorno, finche' non lo si
//mette sul canale alfa, non ha tracciati. Tiene conto di com'e' rimasto lo scontorno.
function logoFinto(id, label, cornice, tracciato, canali = ['Trasparenza']) {
    const scontorno = {
        clippingType: 'NONE',
        appliedPathName: '',
        alphaChannelPathNames: canali,
        impostazioni: [],
        set properties(p) {
            this.impostazioni.push(p);
            this.clippingType = 'ALPHA_CHANNEL';
            this.appliedPathName = p.appliedPathName;
        },
        get paths() {
            const tracciati = this.clippingType === 'NONE' ? [] : [tracciato];
            return { length: tracciati.length, item: k => ({ entirePath: tracciati[k] }) };
        }
    };
    return {
        id, label, constructorName: 'Rectangle', isValid: true, visible: true, parent: null,
        geometricBounds: cornice, allGraphics: [{ clippingPath: scontorno }], scontorno
    };
}

const CORNICE_PIACERSI = [232.5, 472.9, 245, 500];
const TRACCIATO_PIACERSI = [[472.9, 232.5], [500, 232.5], [500, 241], [472.9, 241]];

test('I20-1208: con il contorno i due loghi del BOX12 non si toccano, e lo scontorno torna com\'era', () => {
    conAmbienteFinto((CssFramework) => {
        const sdb = logoFinto(1, 'foto_extra$Logo_SDB$tipo_3', CORNICE_SDB, TRACCIATO_SDB);
        const piacersi = logoFinto(2, 'foto_extra$conad_piacersi$tipo_3', CORNICE_PIACERSI, TRACCIATO_PIACERSI);

        assert.strictEqual(CssFramework.elementsTouching(sdb, piacersi, false, true, {}), false);
        assert.strictEqual(sdb.scontorno.clippingType, 'NONE');
        assert.deepStrictEqual(sdb.scontorno.impostazioni[0], { clippingType: 'ALPHA_CHANNEL', appliedPathName: 'Trasparenza' });
        //Senza l'opzione si misura la cornice, come prima: e le cornici si toccano.
        assert.strictEqual(CssFramework.elementsTouching(sdb, piacersi, false), true);
    });
});

test('I20-1208: un\'immagine senza canale alfa, o un testo, si misura come prima', () => {
    conAmbienteFinto((CssFramework) => {
        const senzaCanale = logoFinto(1, 'foto_extra$A$tipo_3', CORNICE_SDB, TRACCIATO_SDB, []);
        const piacersi = logoFinto(2, 'foto_extra$conad_piacersi$tipo_3', CORNICE_PIACERSI, TRACCIATO_PIACERSI);

        assert.strictEqual(CssFramework.contornoVisibileImmagine(senzaCanale), null);
        assert.strictEqual(senzaCanale.scontorno.impostazioni.length, 0, 'lo scontorno non si tocca');
        assert.strictEqual(CssFramework.elementsTouching(senzaCanale, piacersi, false, true, {}), true, 'vale la cornice');
        assert.strictEqual(CssFramework.contornoVisibileImmagine({ id: 3, isValid: true, constructorName: 'TextFrame' }), null);
    });
});

test('I20-1208: il contorno di un logo si legge una volta sola per controllo', () => {
    conAmbienteFinto((CssFramework) => {
        const sdb = logoFinto(1, 'foto_extra$Logo_SDB$tipo_3', CORNICE_SDB, TRACCIATO_SDB);
        const contorni = {};

        CssFramework.contornoVisibileImmagine(sdb, contorni);
        CssFramework.contornoVisibileImmagine(sdb, contorni);

        assert.strictEqual(sdb.scontorno.impostazioni.length, 1);
    });
});

test('I20-1208: aprendo la scheda ref una CSF-013 fra due loghi che si toccano solo nelle cornici si toglie', () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const sdb = logoFinto(11, 'foto_extra$Logo_SDB$tipo_3', CORNICE_SDB, TRACCIATO_SDB);
        const piacersi = logoFinto(12, 'foto_extra$conad_piacersi$tipo_3', CORNICE_PIACERSI, TRACCIATO_PIACERSI);
        const voce = {
            g: 'warning', c: 'CSF-013',
            t: 'Code CSF-013: Conflitto tra elementi nel box BOX12: foto_extra$conad_piacersi$tipo_3 non dovrebbe toccare foto_extra$Logo_SDB$tipo_3.',
            v: { a: 'foto_extra$conad_piacersi$tipo_3', b: 'foto_extra$Logo_SDB$tipo_3', tb: false, ci: true }
        };
        const box = { label: 'BOX12', isValid: true, id: 1, allPageItems: [sdb, piacersi], ovals: null };
        const bollino = { id: 20, label: etichettaBollino.scrivi([voce]), constructorName: 'Rectangle', isValid: true, visible: true, parent: null, geometricBounds: [0, 0, 5, 5] };
        bollino.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== bollino); };
        box.allPageItems.push(bollino);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.strictEqual(Segnalazioni().bolliniDelBox(box).length, 0);
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /^Code CSF-28: .* non si toccano piu'\. Misure in mm .*\(contorno\)/);
    });
});

test('I20-1208: aprendo la scheda ref la stessa CSF-013 misurata sulle cornici resta', () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const sdb = logoFinto(11, 'foto_extra$Logo_SDB$tipo_3', CORNICE_SDB, TRACCIATO_SDB);
        const piacersi = logoFinto(12, 'foto_extra$conad_piacersi$tipo_3', CORNICE_PIACERSI, TRACCIATO_PIACERSI);
        const voce = {
            g: 'warning', c: 'CSF-013',
            t: 'Code CSF-013: Conflitto tra elementi nel box BOX12: foto_extra$conad_piacersi$tipo_3 non dovrebbe toccare foto_extra$Logo_SDB$tipo_3.',
            v: { a: 'foto_extra$conad_piacersi$tipo_3', b: 'foto_extra$Logo_SDB$tipo_3', tb: false }
        };
        const box = { label: 'BOX12', isValid: true, id: 1, allPageItems: [sdb, piacersi], ovals: null };
        const bollino = { id: 20, label: etichettaBollino.scrivi([voce]), constructorName: 'Rectangle', isValid: true, visible: true, parent: null, geometricBounds: [0, 0, 5, 5] };
        box.allPageItems.push(bollino);

        CssFramework.ricontrollaConflittiDelBox(box);

        assert.deepStrictEqual(Segnalazioni().leggiDalBox(box).map(v => v.c), ['CSF-013']);
        assert.strictEqual(messaggi.length, 0);
        assert.strictEqual(sdb.scontorno.impostazioni.length, 0, 'senza ci lo scontorno non si tocca');
    });
});

test('I20-1208: Edro21 misura sul contorno i loghi tipo_3 fra loro, nei due kit volantino', () => {
    const config = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json'));
    const kitVolantino = config.dbRidimensionamentiAllineamenti.modificheCssPerKit
        .filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));
    assert.strictEqual(kitVolantino.length, 2);

    for (const kit of kitVolantino) {
        const voce = kit.operazioniPerBox.find(op => Array.isArray(op.nomiBox) && op.nomiBox.length === 0);
        const regole = cssRegoleConflitti.getListaRegole(voce.segnalazioniConflitti);
        const loghi = regole.filter(r => r.latoA.length === 1 && r.latoA[0] === 'foto_extra*tipo_3' && r.latoB.length === 0);
        assert.strictEqual(loghi.length, 1);
        assert.strictEqual(loghi[0].useContornoImmagini, true);
        assert.strictEqual(loghi[0].useTextBounds, false);
        //La descrizione contro le foto extra resta misurata come prima.
        assert.ok(regole.filter(r => r.latoB.includes('*foto_extra*')).every(r => r.useContornoImmagini === false));
    }
});
