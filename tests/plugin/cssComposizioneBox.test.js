/*
 * I20-970: duplicazione di elementi e ordine di sovrapposizione dentro un box.
 *
 * Il modulo sotto test e' plugin/cssFramework/composizioneBox.js (fino a I20-1007 cssComposizioneBox.js), che calcola il piano senza toccare
 * InDesign. La corrispondenza per etichetta viene iniettata: qui si usa la stessa semantica
 * con l'asterisco di CssFramework.makeRegexFromGroupName.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const cssComposizioneBox = require('../../plugin/cssFramework/composizioneBox');

function corrisponde(etichetta, spec) {
    const escaped = String(spec).replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/\*/g, '.*') + '$').test(etichetta);
}

//Bounds InDesign: [y1, x1, y2, x2].
const foto = { etichetta: 'immagine$3150596', bounds: [10, 20, 50, 60] };   // 40 di lato
const fotoSecondaria = { etichetta: 'foto_secondaria$3150599', bounds: [10, 70, 30, 90] };
const ombra = { etichetta: 'sy_ombra', bounds: [0, 0, 6, 100] };            // alta 6, larga 100
const parentesi = { etichetta: 'parentesi_BeF', bounds: [5, 5, 55, 95] };

test('l\'ombra prende la larghezza della foto e il centro sul suo lato basso', () => {
    const bounds = cssComposizioneBox.boundsCopia(ombra.bounds, foto.bounds, {
        larghezza: 'bersaglio',
        ancoraX: 'centro',
        ancoraY: 'centroSuLatoBasso'
    });

    //Larga quanto la foto, da x 20 a x 60.
    assert.strictEqual(bounds[1], 20);
    assert.strictEqual(bounds[3], 60);
    //Alta come l'originale, 6.
    assert.strictEqual(bounds[2] - bounds[0], 6);
    //Centro verticale sul lato basso della foto: 50 = (47 + 53) / 2.
    assert.strictEqual((bounds[0] + bounds[2]) / 2, 50);
    //Meta' sopra il bordo, meta' sotto.
    assert.strictEqual(bounds[0], 47);
    assert.strictEqual(bounds[2], 53);
});

test('senza adattamenti la copia conserva le misure della sorgente ed e\' centrata sul bersaglio', () => {
    const bounds = cssComposizioneBox.boundsCopia(ombra.bounds, foto.bounds, null);

    assert.strictEqual(bounds[3] - bounds[1], 100);
    assert.strictEqual(bounds[2] - bounds[0], 6);
    assert.strictEqual((bounds[1] + bounds[3]) / 2, 40);
    assert.strictEqual((bounds[0] + bounds[2]) / 2, 30);
});

test('gli offset spostano la copia dopo l\'ancoraggio', () => {
    const bounds = cssComposizioneBox.boundsCopia(ombra.bounds, foto.bounds, {
        larghezza: 'bersaglio',
        ancoraY: 'centroSuLatoBasso',
        offsetX: 2,
        offsetY: -1
    });

    assert.strictEqual(bounds[1], 22);
    assert.strictEqual(bounds[3], 62);
    assert.strictEqual(bounds[0], 46);
    assert.strictEqual(bounds[2], 52);
});

test('le ancore su un bordo appoggiano la copia a quel bordo', () => {
    const sinistraAlto = cssComposizioneBox.boundsCopia([0, 0, 4, 10], foto.bounds, { ancoraX: 'sinistra', ancoraY: 'alto' });
    assert.strictEqual(sinistraAlto[1], 20);
    assert.strictEqual(sinistraAlto[0], 10);

    const destraBasso = cssComposizioneBox.boundsCopia([0, 0, 4, 10], foto.bounds, { ancoraX: 'destra', ancoraY: 'basso' });
    assert.strictEqual(destraBasso[3], 60);
    assert.strictEqual(destraBasso[2], 50);
});

test('la copia eredita il suffisso del bersaglio, cosi\' l\'etichetta e\' univoca e appaiata', () => {
    assert.strictEqual(cssComposizioneBox.etichettaCopia('sy_ombra', 'immagine$3150596', 0), 'sy_ombra$3150596');
    //Bersaglio senza suffisso: si usa la posizione, mai due etichette uguali.
    assert.strictEqual(cssComposizioneBox.etichettaCopia('sy_ombra', 'immagine', 0), 'sy_ombra$1');
    assert.strictEqual(cssComposizioneBox.etichettaCopia('sy_ombra', 'immagine', 1), 'sy_ombra$2');
});

test('una sorgente e due foto producono due copie, e la sorgente spaiata viene rimossa', () => {
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['immagine*', 'foto_secondaria*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso' }
    }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, fotoSecondaria, ombra, parentesi], corrisponde);

    assert.deepStrictEqual(piano.copie.map(c => c.etichetta), ['sy_ombra$3150596', 'sy_ombra$3150599']);
    assert.deepStrictEqual(piano.copie.map(c => c.etichettaBersaglio), ['immagine$3150596', 'foto_secondaria$3150599']);
    assert.deepStrictEqual(piano.copie.map(c => c.etichettaModello), ['sy_ombra', 'sy_ombra']);
    assert.deepStrictEqual(piano.rimozioni, ['sy_ombra']);
    assert.deepStrictEqual(piano.aggiornamenti, []);
    //Ogni copia e' larga quanto la propria foto.
    assert.strictEqual(piano.copie[0].bounds[3] - piano.copie[0].bounds[1], 40);
    assert.strictEqual(piano.copie[1].bounds[3] - piano.copie[1].bounds[1], 20);
});

test('al secondo passaggio le copie vengono aggiornate, non ricreate', () => {
    //Stato dopo il primo passaggio: la sorgente non c'e' piu', la copia si', e la foto si e' spostata.
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['immagine*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso' }
    }];
    const copiaEsistente = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };
    const fotoSpostata = { etichetta: 'immagine$3150596', bounds: [30, 100, 70, 140] };

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [fotoSpostata, copiaEsistente], corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.rimozioni, []);
    const aggiornamento = piano.aggiornamenti[0];
    assert.strictEqual(aggiornamento.etichetta, 'sy_ombra$3150596');
    //Segue la foto nella nuova posizione, conservando la propria altezza.
    assert.strictEqual(aggiornamento.bounds[1], 100);
    assert.strictEqual(aggiornamento.bounds[3], 140);
    assert.strictEqual((aggiornamento.bounds[0] + aggiornamento.bounds[2]) / 2, 70);
    assert.strictEqual(aggiornamento.bounds[2] - aggiornamento.bounds[0], 6);
});

test('senza piu\' la sorgente una foto nuova prende la copia come modello', () => {
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['immagine*', 'foto_secondaria*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso' }
    }];
    const copiaEsistente = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, fotoSecondaria, copiaEsistente], corrisponde);

    assert.deepStrictEqual(piano.copie.map(c => c.etichetta), ['sy_ombra$3150599']);
    assert.deepStrictEqual(piano.copie.map(c => c.etichettaModello), ['sy_ombra$3150596']);
    assert.deepStrictEqual(piano.aggiornamenti.map(a => a.etichetta), ['sy_ombra$3150596']);
    assert.deepStrictEqual(piano.rimozioni, []);
});

test('sparisce solo la copia il cui bersaglio non esiste piu\'', () => {
    const regole = [{ etichettaSorgente: 'sy_ombra', bersagli: ['immagine*'] }];
    const copiaViva = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };
    const copiaOrfana = { etichetta: 'sy_ombra$3159999', bounds: [47, 20, 53, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, copiaViva, copiaOrfana], corrisponde);

    assert.deepStrictEqual(piano.rimozioni, ['sy_ombra$3159999']);
    assert.deepStrictEqual(piano.aggiornamenti.map(a => a.etichetta), ['sy_ombra$3150596']);
});

test('senza sorgente e senza copie non si inventa nulla', () => {
    const regole = [{ etichettaSorgente: 'sy_ombra', bersagli: ['immagine*'] }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, parentesi], corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.aggiornamenti, []);
    assert.deepStrictEqual(piano.rimozioni, []);
});

test('con mantieniSorgente la sorgente resta nel box', () => {
    const regole = [{ etichettaSorgente: 'sy_ombra', bersagli: ['immagine*'], mantieniSorgente: true }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, ombra], corrisponde);

    assert.deepStrictEqual(piano.rimozioni, []);
    assert.strictEqual(piano.copie.length, 1);
});

test('senza bersagli non si rimuove la sorgente: resterebbe il box senza ombra', () => {
    const regole = [{ etichettaSorgente: 'sy_ombra', bersagli: ['immagine*'] }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [ombra, parentesi], corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.rimozioni, []);
});

test('ombre e parentesi vanno dietro alle immagini', () => {
    const regole = [{
        etichette: ['sy_ombra*', 'parentesi_BeF'],
        posizione: 'dietro',
        rispettoA: ['immagine*', 'foto_secondaria*']
    }];
    const copiaOmbra = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };

    const operazioni = cssComposizioneBox.pianificaOrdineZ(regole, [foto, fotoSecondaria, copiaOmbra, parentesi], corrisponde);

    assert.deepStrictEqual(operazioni.map(o => o.etichetta), ['sy_ombra$3150596', 'parentesi_BeF']);
    assert.ok(operazioni.every(o => o.posizione === 'dietro'));
    assert.deepStrictEqual(operazioni[0].riferimenti, ['immagine$3150596', 'foto_secondaria$3150599']);
});

test('un elemento che e\' anche riferimento non viene spostato rispetto a se stesso', () => {
    const regole = [{ etichette: ['immagine*'], posizione: 'dietro', rispettoA: ['immagine*'] }];

    const operazioni = cssComposizioneBox.pianificaOrdineZ(regole, [foto], corrisponde);

    assert.deepStrictEqual(operazioni, []);
});

test('lo stesso elemento non viene spostato due volte anche se piu\' regole lo riguardano', () => {
    const regole = [
        { etichette: ['sy_ombra*'], posizione: 'dietro', rispettoA: ['immagine*'] },
        { etichette: ['sy_ombra$3150596'], posizione: 'davanti', rispettoA: [] }
    ];
    const copiaOmbra = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };

    const operazioni = cssComposizioneBox.pianificaOrdineZ(regole, [foto, copiaOmbra], corrisponde);

    assert.strictEqual(operazioni.length, 1);
    assert.strictEqual(operazioni[0].posizione, 'dietro');
});

test('senza riferimenti l\'elemento va in fondo al box e lo si vede dal piano', () => {
    const regole = [{ etichette: ['parentesi_BeF'], posizione: 'dietro' }];

    const operazioni = cssComposizioneBox.pianificaOrdineZ(regole, [foto, parentesi], corrisponde);

    assert.deepStrictEqual(operazioni, [{ etichetta: 'parentesi_BeF', posizione: 'dietro', riferimenti: [] }]);
});

test('il piano porta con se\' il fit del contenuto: il riquadro allargato non allarga il grafico', () => {
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['immagine*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso', fitContenuto: 'riquadro' }
    }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, ombra], corrisponde);

    assert.strictEqual(piano.copie[0].fitContenuto, 'riquadro');
});

test('senza adattamenti il contenuto non viene toccato', () => {
    const regole = [{ etichettaSorgente: 'sy_ombra', bersagli: ['immagine*'] }];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, ombra], corrisponde);

    assert.strictEqual(piano.copie[0].fitContenuto, null);
});

test('anche gli aggiornamenti portano il fit: la foto puo\' aver cambiato larghezza', () => {
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['immagine*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', fitContenuto: 'riquadro' }
    }];
    const copiaEsistente = { etichetta: 'sy_ombra$3150596', bounds: [47, 20, 53, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [foto, copiaEsistente], corrisponde);

    assert.strictEqual(piano.aggiornamenti[0].fitContenuto, 'riquadro');
});

test('due foto secondarie omonime prima del $ ricevono ognuna la propria ombra', () => {
    //Le secondarie condividono l'etichetta fino al $: e' il suffisso del bersaglio a tenere
    //appaiata ogni ombra alla propria foto, non la posizione nell'elenco.
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['foto_secondaria*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso' }
    }];
    const primaSecondaria = { etichetta: 'foto_secondaria$111', bounds: [10, 0, 30, 20] };
    const secondaSecondaria = { etichetta: 'foto_secondaria$222', bounds: [40, 50, 90, 130] };

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, [primaSecondaria, secondaSecondaria, ombra], corrisponde);

    assert.deepStrictEqual(piano.copie.map(c => c.etichetta), ['sy_ombra$111', 'sy_ombra$222']);
    //Ogni ombra prende le misure e la posizione dalla propria foto, non da quella accanto.
    assert.strictEqual(piano.copie[0].bounds[3] - piano.copie[0].bounds[1], 20);
    assert.strictEqual((piano.copie[0].bounds[0] + piano.copie[0].bounds[2]) / 2, 30);
    assert.strictEqual(piano.copie[1].bounds[3] - piano.copie[1].bounds[1], 80);
    assert.strictEqual((piano.copie[1].bounds[0] + piano.copie[1].bounds[2]) / 2, 90);
});

test('a ogni passaggio ogni ombra ritrova la propria foto anche se le foto si sono scambiate di posto', () => {
    const regole = [{
        etichettaSorgente: 'sy_ombra',
        bersagli: ['foto_secondaria*'],
        adattaAlBersaglio: { larghezza: 'bersaglio', ancoraY: 'centroSuLatoBasso' }
    }];
    //Dopo la sistemazione delle foto la $222 e' finita a sinistra e la $111 a destra.
    const elementi = [
        { etichetta: 'foto_secondaria$222', bounds: [0, 0, 20, 40] },
        { etichetta: 'foto_secondaria$111', bounds: [0, 60, 10, 80] },
        { etichetta: 'sy_ombra$111', bounds: [27, 0, 33, 20] },
        { etichetta: 'sy_ombra$222', bounds: [87, 50, 93, 130] }
    ];

    const piano = cssComposizioneBox.pianificaDuplicazioni(regole, elementi, corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.rimozioni, []);
    const perLaPrima = piano.aggiornamenti.find(a => a.etichetta === 'sy_ombra$111');
    const perLaSeconda = piano.aggiornamenti.find(a => a.etichetta === 'sy_ombra$222');
    assert.strictEqual(perLaPrima.etichettaBersaglio, 'foto_secondaria$111');
    assert.strictEqual(perLaSeconda.etichettaBersaglio, 'foto_secondaria$222');
    //La $111 e' quella a destra, larga 20: la sua ombra la segue li'.
    assert.strictEqual(perLaPrima.bounds[1], 60);
    assert.strictEqual(perLaPrima.bounds[3], 80);
    assert.strictEqual(perLaSeconda.bounds[1], 0);
    assert.strictEqual(perLaSeconda.bounds[3], 40);
});

test('le etichette delle copie si riconoscono dai prefissi delle regole', () => {
    //Serve alla mappa degli elementi del box: senza, due copie collasserebbero sulla stessa
    //chiave perche' altrove l'etichetta viene tagliata al $.
    const prefissi = cssComposizioneBox.prefissiDerivati([
        { etichettaSorgente: 'sy_ombra' },
        { etichettaSorgente: 'sy_ombra' },
        { etichettaSorgente: '' },
        null
    ]);

    assert.deepStrictEqual(prefissi, ['sy_ombra$']);
    assert.ok(cssComposizioneBox.etichettaDerivata('sy_ombra$3150596', prefissi));
    assert.ok(cssComposizioneBox.etichettaDerivata('sy_ombra$111', prefissi));
    //La sorgente non e' una copia, e nemmeno il prefisso senza suffisso.
    assert.ok(!cssComposizioneBox.etichettaDerivata('sy_ombra', prefissi));
    assert.ok(!cssComposizioneBox.etichettaDerivata('sy_ombra$', prefissi));
    //Un elemento che non c'entra resta fuori.
    assert.ok(!cssComposizioneBox.etichettaDerivata('immagine$3150596', prefissi));
    assert.ok(!cssComposizioneBox.etichettaDerivata('sy_ombra$1', []));
});

test('senza regole di duplicazione non esiste nessuna etichetta derivata', () => {
    assert.deepStrictEqual(cssComposizioneBox.prefissiDerivati(null), []);
    assert.deepStrictEqual(cssComposizioneBox.prefissiDerivati([]), []);
    assert.ok(!cssComposizioneBox.etichettaDerivata('sy_ombra$1', null));
    assert.ok(!cssComposizioneBox.etichettaDerivata(null, ['sy_ombra$']));
});

/* ---- I20-1022: la copia della primaria nei box BIS ---- */

//La regola di BOX7 in SourceFrameworkCss di Edro21: si duplica la primaria, e la copia si chiama
//foto_secondaria$...$clone, cosi' il fix foto la conta e le segnalazioni la riconoscono.
const regolaCopiaBis = {
    nomeGruppo: 'copia_foto_BIS',
    etichettaSorgente: 'immagine*',
    bersagli: ['immagine*'],
    etichettaCopia: 'foto_secondaria',
    marcaClone: true,
    adattaAlBersaglio: null,
    mantieniSorgente: true,
    aggiornaCopie: false
};

test('la primaria si duplica in una foto_secondaria marcata come clone', () => {
    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaCopiaBis], [foto, parentesi], corrisponde);

    assert.strictEqual(piano.copie.length, 1);
    const copia = piano.copie[0];
    assert.strictEqual(copia.etichetta, 'foto_secondaria$3150596$clone');
    assert.strictEqual(copia.etichettaModello, 'immagine$3150596');
    assert.strictEqual(copia.etichettaBersaglio, 'immagine$3150596');
    //Stesse misure e stessa posizione della primaria: a disporle ci pensa il fix foto.
    assert.deepStrictEqual(copia.bounds, foto.bounds);
    //La primaria resta.
    assert.deepStrictEqual(piano.rimozioni, []);
});

test('al passaggio dopo il fix foto il clone resta dove il fix foto l\'ha messo', () => {
    const primariaSpostata = { etichetta: 'immagine$3150596', bounds: [30, 0, 70, 40] };
    const cloneSistemato = { etichetta: 'foto_secondaria$3150596$clone', bounds: [20, 20, 60, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaCopiaBis], [primariaSpostata, cloneSistemato], corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.aggiornamenti, []);
    assert.deepStrictEqual(piano.rimozioni, []);
});

test('senza aggiornaCopie false il clone verrebbe riportato sulla primaria', () => {
    const regola = Object.assign({}, regolaCopiaBis, { aggiornaCopie: undefined });
    const primariaSpostata = { etichetta: 'immagine$3150596', bounds: [30, 0, 70, 40] };
    const cloneSistemato = { etichetta: 'foto_secondaria$3150596$clone', bounds: [20, 20, 60, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni([regola], [primariaSpostata, cloneSistemato], corrisponde);

    assert.deepStrictEqual(piano.aggiornamenti.map(a => a.bounds), [[30, 0, 70, 40]]);
});

test('una foto_secondaria vera non viene scambiata per un clone da togliere', () => {
    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaCopiaBis], [foto, fotoSecondaria], corrisponde);

    assert.ok(!piano.rimozioni.includes('foto_secondaria$3150599'));
    assert.ok(!piano.aggiornamenti.some(a => a.etichetta === 'foto_secondaria$3150599'));
});

test('se la primaria sparisce se ne va anche il suo clone', () => {
    const cloneOrfano = { etichetta: 'foto_secondaria$3150596$clone', bounds: [10, 20, 50, 60] };

    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaCopiaBis], [cloneOrfano, parentesi], corrisponde);

    assert.deepStrictEqual(piano.copie, []);
    assert.deepStrictEqual(piano.rimozioni, ['foto_secondaria$3150596$clone']);
});

//BOX41: l'ombra del clone prendeva lo stesso nome di quella della primaria, e al passaggio
//dopo il fix foto tutte e due le correzioni finivano sulla prima delle due.
test('l\'ombra del clone ha un nome suo, diverso da quello dell\'ombra della primaria', () => {
    const regolaOmbra = { etichettaSorgente: 'sy_ombra', bersagli: ['immagine*', 'foto_secondaria*'] };
    const clone = { etichetta: 'foto_secondaria$3150596$clone', bounds: [10, 40, 50, 80] };

    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaOmbra], [foto, clone, ombra], corrisponde);

    assert.deepStrictEqual(piano.copie.map(c => c.etichetta), ['sy_ombra$3150596', 'sy_ombra$3150596$clone']);
});

test('le regole di sempre, senza i campi nuovi, si comportano come prima', () => {
    const regolaOmbra = { etichettaSorgente: 'sy_ombra', bersagli: ['immagine*', 'foto_secondaria*'] };

    const piano = cssComposizioneBox.pianificaDuplicazioni([regolaOmbra], [foto, fotoSecondaria, ombra], corrisponde);

    assert.deepStrictEqual(piano.copie.map(c => c.etichetta), ['sy_ombra$3150596', 'sy_ombra$3150599']);
    assert.deepStrictEqual(piano.rimozioni, ['sy_ombra']);
    assert.deepStrictEqual(cssComposizioneBox.prefissiDerivati([regolaOmbra]), ['sy_ombra$']);
});

test('il prefisso delle copie di una regola con etichettaCopia e\' quello della copia', () => {
    assert.deepStrictEqual(cssComposizioneBox.prefissiDerivati([regolaCopiaBis]), ['foto_secondaria$']);
    assert.strictEqual(cssComposizioneBox.etichettaBaseCopia({ etichettaSorgente: 'immagine*' }), 'immagine');
});

test('il clone si riconosce dal segno in fondo all\'etichetta', () => {
    assert.ok(cssComposizioneBox.eUnClone('foto_secondaria$3150596$clone'));
    assert.ok(!cssComposizioneBox.eUnClone('foto_secondaria$3150596'));
    assert.ok(!cssComposizioneBox.eUnClone('immagine$3150596'));
    assert.ok(!cssComposizioneBox.eUnClone('$clone'));
    assert.ok(!cssComposizioneBox.eUnClone(''));
    assert.ok(!cssComposizioneBox.eUnClone(null));
});

//Le tre segnalazioni che il clone farebbe scattare senza motivo. Le funzioni girano dentro
//InDesign e qui non si possono eseguire: si controlla che il clone venga scartato.
test('conflitti, fuori griglia e confronto col server ignorano il clone', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const leggi = nome => fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', nome), 'utf8');

    const framework = leggi('CssFramework.js');
    assert.match(framework, /var pageItem = box\.pageItems\.item\(i\);\s*\/\/I20-1022[^\n]*\s*if \(Utility\.eUnClone\(pageItem\.label\)\) \{\s*continue;/);
    assert.match(framework, /if \(Utility\.eUnClone\(item\.label\)\) \{\s*continue;\s*\}\s*var label = Utility\.parseLabel\(item\.label\);/);
    assert.match(leggi('confronti.js'), /if \(Utility\.eUnClone\(campo\.label\)\) return null;/);
    assert.match(leggi('utility.js'), /eUnClone\(label\) \{\s*return cssComposizioneBox\.eUnClone\(label\);/);
});
