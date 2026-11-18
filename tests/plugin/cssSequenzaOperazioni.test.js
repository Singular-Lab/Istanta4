/*
 * Momento di esecuzione delle regole del framework CSS.
 *
 * Il modulo sotto test e' plugin/cssFramework/sequenzaOperazioni.js (fino a I20-1007 cssSequenzaOperazioni.js): decide quali regole appartengono
 * a quale momento, e consegna al motore un DB gia' filtrato. Il vincolo piu' importante e'
 * che a dati invariati non cambi nulla, perche' ogni regola gia' scritta e' senza fase.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const cssSequenzaOperazioni = require('../../plugin/cssFramework/sequenzaOperazioni');

function dbDiProva() {
    return [
        {
            nomiBox: ['BOX41'],
            ridimensionamenti: [{ nomeGruppo: 'base' }, { nomeGruppo: 'foto_tardive', fase: 'dopoFixFoto' }],
            postRidimensionamenti: [{ nomeGruppo: 'boxetto' }],
            allineamenti: [
                { nomeGruppo: 'descr_All' },
                { nomeGruppo: 'ombre_alle_foto', fase: 'dopoFixFoto' }
            ],
            duplicazioni: [{ nomeGruppo: 'ombra_per_foto' }],
            ordiniZ: [{ nomeGruppo: 'ombre_dietro' }],
            segnalazioniConflitti: []
        },
        {
            nomiBox: [],
            ridimensionamenti: [],
            postRidimensionamenti: [],
            allineamenti: [{ nomeGruppo: 'default_All' }]
        }
    ];
}

test('una regola senza fase appartiene al momento standard', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(undefined), 'standard');
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(null), 'standard');
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento(''), 'standard');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ nomeGruppo: 'x' }, 'standard'));
});

test('una fase scritta male non fa sparire la regola: resta nel momento standard', () => {
    //Un refuso nel dato del cliente non deve tradursi in un allineamento che non avviene mai.
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('dopoFixfotoo'), 'standard');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ fase: 'dopoFixfotoo' }, 'standard'));
});

test('la fase e\' riconosciuta a prescindere da maiuscole e minuscole', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('DOPOFIXFOTO'), 'dopoFixFoto');
    assert.ok(cssSequenzaOperazioni.regolaNelMomento({ fase: 'dopofixfoto' }, 'dopoFixFoto'));
});

test('il momento standard porta con se\' tutte e sole le regole di sempre', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'standard');

    assert.deepStrictEqual(filtrato[0].ridimensionamenti.map(r => r.nomeGruppo), ['base']);
    assert.deepStrictEqual(filtrato[0].postRidimensionamenti.map(r => r.nomeGruppo), ['boxetto']);
    assert.deepStrictEqual(filtrato[0].allineamenti.map(r => r.nomeGruppo), ['descr_All']);
    assert.deepStrictEqual(filtrato[1].allineamenti.map(r => r.nomeGruppo), ['default_All']);
});

test('il momento dopoFixFoto porta solo le regole che lo hanno chiesto', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'dopoFixFoto');

    assert.deepStrictEqual(filtrato[0].ridimensionamenti.map(r => r.nomeGruppo), ['foto_tardive']);
    assert.deepStrictEqual(filtrato[0].postRidimensionamenti, []);
    assert.deepStrictEqual(filtrato[0].allineamenti.map(r => r.nomeGruppo), ['ombre_alle_foto']);
    assert.deepStrictEqual(filtrato[1].allineamenti, []);
});

test('duplicazioni e ordiniZ restano fuori dal filtro: il box si ricompone in ogni momento', () => {
    const filtrato = cssSequenzaOperazioni.filtraDBPerMomento(dbDiProva(), 'dopoFixFoto');

    assert.strictEqual(filtrato[0].duplicazioni.length, 1);
    assert.strictEqual(filtrato[0].ordiniZ.length, 1);
    //Quello che non c'entra con i momenti viene ricopiato tale e quale.
    assert.deepStrictEqual(filtrato[0].nomiBox, ['BOX41']);
    assert.deepStrictEqual(filtrato[0].segnalazioniConflitti, []);
});

test('il DB originale non viene toccato: e\' lo stesso oggetto per tutti i box', () => {
    const db = dbDiProva();
    cssSequenzaOperazioni.filtraDBPerMomento(db, 'dopoFixFoto');

    assert.strictEqual(db[0].allineamenti.length, 2);
    assert.strictEqual(db[0].ridimensionamenti.length, 2);
});

test('un DB assente resta assente e non fa saltare il filtro', () => {
    assert.strictEqual(cssSequenzaOperazioni.filtraDBPerMomento(null, 'standard'), null);
    assert.deepStrictEqual(cssSequenzaOperazioni.filtraDBPerMomento([], 'standard'), []);
});

test('si sa in anticipo se in un momento c\'e\' qualcosa da fare', () => {
    //Serve a non pagare un giro di operazioni a vuoto su ogni box quando nessuno usa il momento.
    assert.ok(cssSequenzaOperazioni.esistonoRegole(dbDiProva(), 'dopoFixFoto'));
    assert.ok(!cssSequenzaOperazioni.esistonoRegole(dbDiProva()[1] ? [dbDiProva()[1]] : [], 'dopoFixFoto'));
    assert.ok(!cssSequenzaOperazioni.esistonoRegole(null, 'dopoFixFoto'));
});

test('i momenti sono dichiarati in ordine di esecuzione', () => {
    assert.deepStrictEqual(cssSequenzaOperazioni.momenti, ['standard', 'dopoFixFoto']);
});

/* ---- I20-1240: la sequenza del fix foto nel CssFramework ---- */

function conFasiDichiarate(fasi, prova) {
    const prima = cssSequenzaOperazioni.fasiDichiarate;
    cssSequenzaOperazioni.fasiDichiarate = fasi;
    try {
        return prova();
    }
    finally {
        cssSequenzaOperazioni.fasiDichiarate = prima;
    }
}

test('I20-1240: le fasi delle sequenze si trovano ovunque nel file, varianti comprese, senza quelle fisse', () => {
    const file = {
        modificheCssPerKit: [{
            operazioniPerBox: [{
                nomiBox: [],
                fixFoto: {
                    sequenza: [
                        { tipo: 'fase', fase: 'primaDelFix' },
                        { tipo: 'simulazioni', varianti: [{ nome: 'a', passi: [] }, { nome: 'b', passi: [{ tipo: 'fase', fase: 'descrizioneInBasso' }] }] },
                        { tipo: 'fixFoto' },
                        { tipo: 'fase', fase: 'dopoFixFoto' }
                    ]
                }
            }]
        }],
        fixFoto: { perBox: [{ nomiBox: ['BOX7'], sequenza: [{ tipo: 'FASE', fase: 'PrimaDelFix' }, { tipo: 'fase', fase: 'gruppoBis' }] }] }
    };

    assert.deepStrictEqual(cssSequenzaOperazioni.fasiDelleSequenze(file), ['primaDelFix', 'descrizioneInBasso', 'gruppoBis']);
    assert.deepStrictEqual(cssSequenzaOperazioni.fasiDelleSequenze(null), []);
});

test('I20-1240: una regola con una fase dichiarata da una sequenza esce dal momento standard', () => {
    conFasiDichiarate(['descrizioneInBasso'], () => {
        const db = [{ nomiBox: [], allineamenti: [{ nomeGruppo: 'sempre' }, { nomeGruppo: 'giu', fase: 'DescrizioneInBasso' }] }];

        assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('descrizioneinbasso'), 'descrizioneInBasso');
        assert.deepStrictEqual(cssSequenzaOperazioni.filtraDBPerMomento(db, 'standard')[0].allineamenti.map(r => r.nomeGruppo), ['sempre']);
        assert.deepStrictEqual(cssSequenzaOperazioni.filtraDBPerMomento(db, 'descrizioneInBasso')[0].allineamenti.map(r => r.nomeGruppo), ['giu']);
        assert.ok(cssSequenzaOperazioni.esistonoRegole(db, 'descrizioneInBasso'));
        //una fase che nessuna sequenza dichiara resta un refuso: la regola vale nel momento standard
        assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('descrizioneInAlto'), 'standard');
    });
});

test('I20-1240: registraFasiDelFile ricorda le fasi del file appena arrivato', () => {
    conFasiDichiarate([], () => {
        cssSequenzaOperazioni.registraFasiDelFile({ fixFoto: { sequenza: [{ tipo: 'fase', fase: 'rifinitura' }] } });
        assert.deepStrictEqual(cssSequenzaOperazioni.fasiDichiarate, ['rifinitura']);
        assert.strictEqual(cssSequenzaOperazioni.normalizzaMomento('rifinitura'), 'rifinitura');
    });
});

test('I20-1240: senza sequenza, o senza passi validi, il fix foto resta quello di sempre', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaSequenza(null), null);
    assert.strictEqual(cssSequenzaOperazioni.normalizzaSequenza([]), null);
    assert.strictEqual(cssSequenzaOperazioni.normalizzaSequenza([{ tipo: 'bho' }, { tipo: 'fase' }]), null);
});

test('I20-1240: la sequenza tiene i passi validi nel loro ordine, fix foto anche piu\' volte', () => {
    const sequenza = cssSequenzaOperazioni.normalizzaSequenza([
        { tipo: 'FixFoto' },
        { tipo: 'fase', fase: ' rifinitura ' },
        { tipo: 'sconosciuto' },
        { tipo: 'fase', fase: 'DOPOFIXFOTO' },
        { tipo: 'fixFoto' }
    ]);

    assert.deepStrictEqual(sequenza, [
        { tipo: 'fixFoto' },
        { tipo: 'fase', fase: 'rifinitura' },
        { tipo: 'fase', fase: 'dopoFixFoto' },
        { tipo: 'fixFoto' }
    ]);
});

test('I20-1240: le simulazioni portano varianti con passi, condizioni e scarti normalizzati', () => {
    const sequenza = cssSequenzaOperazioni.normalizzaSequenza([{
        tipo: 'simulazioni',
        varianti: [
            { nome: 'testiALato' },
            {
                nome: 'testiInBasso',
                passi: [{ tipo: 'fase', fase: 'descrizioneInBasso' }, { tipo: 'simulazioni', varianti: [{}] }, { tipo: 'fixFoto' }],
                listSetCondizioni: [{ setCondizioni: [{ elementiDaNonTrovare: ['*LOGO_carneS*'] }] }],
                scartaSe: { overflow: ['descrizione'], sovrapposizioni: [{ elementi: ['descrizione'], con: ['foto_extra*'] }, { elementi: ['x'] }], rientroInGriglia: ['descrizione', '', null] }
            },
            null,
            {}
        ]
    }]);

    assert.strictEqual(sequenza.length, 1);
    const varianti = sequenza[0].varianti;
    assert.deepStrictEqual(varianti.map(v => v.nome), ['testiALato', 'testiInBasso', 'variante 3']);
    assert.deepStrictEqual(varianti[0].passi, []);
    assert.deepStrictEqual(varianti[0].scartaSe, { overflow: [], sovrapposizioni: [], fuoriBase: [], rientroInGriglia: [] });
    //dentro una variante non si annidano altre simulazioni
    assert.deepStrictEqual(varianti[1].passi, [{ tipo: 'fase', fase: 'descrizioneInBasso' }, { tipo: 'fixFoto' }]);
    assert.strictEqual(varianti[1].listSetCondizioni.length, 1);
    assert.deepStrictEqual(varianti[1].scartaSe, {
        overflow: ['descrizione'],
        sovrapposizioni: [{ elementi: ['descrizione'], con: ['foto_extra*'] }],
        fuoriBase: [],
        rientroInGriglia: ['descrizione']
    });
});

test('I20-1240: simulazioni senza varianti non sono un passo', () => {
    assert.strictEqual(cssSequenzaOperazioni.normalizzaSequenza([{ tipo: 'simulazioni', varianti: [] }]), null);
});

test('I20-1240: si puo\' chiedere se in un momento ci sono regole di un solo tipo', () => {
    //le fasi della sequenza saltano i ridimensionamenti quando non ne hanno: costano una lettura di tutto il box
    const db = [{ nomiBox: [], ridimensionamenti: [{ nomeGruppo: 'r' }], allineamenti: [{ nomeGruppo: 'a', fase: 'dopoFixFoto' }] }];
    assert.ok(cssSequenzaOperazioni.esistonoRegole(db, 'dopoFixFoto', ['allineamenti']));
    assert.ok(!cssSequenzaOperazioni.esistonoRegole(db, 'dopoFixFoto', ['ridimensionamenti', 'postRidimensionamenti']));
    assert.ok(cssSequenzaOperazioni.esistonoRegole(db, 'standard', ['ridimensionamenti']));
    //senza tipi, tutti come prima
    assert.ok(cssSequenzaOperazioni.esistonoRegole(db, 'dopoFixFoto'));
});
