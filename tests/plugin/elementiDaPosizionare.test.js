/*
 * I20-1204: elementi del box da posizionare a mano.
 *
 * Il logo attributo italiano di Edro21 esce in una posizione standard che il cliente corregge ogni
 * volta. Il CssFramework puo' ora dichiarare, per un box o per tutti i box del kit, gli elementi da
 * posizionare a mano (elementiDaPosizionare): a fine composizione il Plugin li porta al 40% di
 * opacita' e scrive nel bollino un warning CSF-30. Risolvendolo l'elemento torna al 100%; se
 * l'operatore cambia l'opacita' a mano fuori da 40-50, la scheda ref e la lettura delle segnalazioni
 * tolgono la voce; se lo rimette fra 40 e 50, all'apertura della scheda ref la voce torna.
 *
 * CssFramework.js si carica sotto Node come in cssRegoleConflitti.test.js, con InDesign finto e un
 * box di oggetti finti; il collegamento a impaginazione, Risolvi e lettura si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const radice = path.join(__dirname, '..', '..');
const etichettaBollino = require('../../plugin/segnalazioni/etichetta');
const Segnalazioni = require('../../plugin/segnalazioni/segnalazioni');

const LOGO = 'foto_extra$logo_attributo_it$tipo_3';

function sorgente(percorso) {
    return fs.readFileSync(path.join(radice, percorso), 'utf8').replace(/\r/g, '');
}

function caricaCssFramework() {
    const Module = require('node:module');
    const originale = Module._load;
    Module._load = function (richiesta) {
        return richiesta === 'indesign' ? {} : originale.apply(this, arguments);
    };
    try {
        return require('../../plugin/CssFramework.js');
    }
    finally {
        Module._load = originale;
    }
}

//Un box con il logo, la descrizione e, se ci sono voci, il bollino. remove toglie davvero, e
//addBollinoCustom (finto) ridisegna il bollino nello stesso box.
function boxCon(opacitaLogo, voci, logoVisibile = true) {
    const box = { label: 'BOX6', isValid: true, id: 1, allPageItems: [], ovals: null };
    let id = 10;
    const elemento = (label, opacita, visibile = true) => {
        const el = {
            id: id++, label: label, constructorName: 'Group', isValid: true, visible: visibile, parent: null,
            geometricBounds: [0, 0, 10, 10],
            transparencySettings: { blendingSettings: { opacity: opacita } }
        };
        el.remove = function () { box.allPageItems = box.allPageItems.filter(e => e !== el); };
        box.allPageItems.push(el);
        return el;
    };
    const logo = elemento(LOGO, opacitaLogo, logoVisibile);
    const descrizione = elemento('descrizione', 100);
    if (Array.isArray(voci) && voci.length > 0) {
        elemento(etichettaBollino.scrivi(voci), 100);
    }
    return { box, logo, descrizione };
}

function conAmbienteFinto(fn) {
    const nomi = ['Utility', 'messaggioUtente', 'addSegnalazione', 'readFile', 'CssFramework', 'SchermataSegnalazioni'];
    const salvati = {};
    nomi.forEach(n => { salvati[n] = global[n]; });
    const messaggi = [];
    const segnalazioni = [];
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
    global.addSegnalazione = (msg, typeMessage, priority, applicaBollino, impostazioni, key, verifica) =>
        segnalazioni.push({ msg, typeMessage, key, verifica });
    global.readFile = () => null;
    const CssFramework = caricaCssFramework();
    global.CssFramework = CssFramework;
    try {
        fn(CssFramework, messaggi, segnalazioni);
    }
    finally {
        nomi.forEach(n => { if (salvati[n] === undefined) { delete global[n]; } else { global[n] = salvati[n]; } });
    }
}

//La voce che l'impaginazione scrive nel bollino per il logo.
const VOCE_LOGO = etichettaBollino.daSegnalazione({
    msg: 'Code CSF-30: ' + LOGO + ' in posizione da verificare: spostalo se serve e risolvi la segnalazione',
    typeMessage: 'warning',
    verifica: { posizione: LOGO }
});
const ALTRA_VOCE = { g: 'warning', c: 'CSF-26', t: 'Code CSF-26: Foto senza tracciato' };

/* ---- la configurazione ---- */

test("le etichette da posizionare vengono dalla voce del box e da quelle di default, una volta ciascuna", () => {
    conAmbienteFinto(CssFramework => {
        const { box } = boxCon(100);
        CssFramework.contestoCss = {
            etichettaBox: 'BOX6',
            DBallineamenti: [
                { nomiBox: [], elementiDaPosizionare: ['*logo_attributo_it*', ' ', 7] },
                { nomiBox: ['BOX6'], elementiDaPosizionare: ['prezzo', '*logo_attributo_it*'] }
            ],
            DBDefault: [{ nomiBox: [], elementiDaPosizionare: ['*bollo*'] }]
        };
        assert.deepStrictEqual(CssFramework.getElementiDaPosizionare(box), ['prezzo', '*logo_attributo_it*', '*bollo*']);

        //Il contesto di un altro box non vale.
        CssFramework.contestoCss.etichettaBox = 'BOX4';
        assert.deepStrictEqual(CssFramework.getElementiDaPosizionare(box), []);
    });
});

test("Edro21 dichiara il logo attributo italiano nei due kit del volantino, non nel PoP", () => {
    const configurazione = JSON.parse(sorgente('Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json'));
    const kit = configurazione.dbRidimensionamentiAllineamenti.modificheCssPerKit;
    const volantino = kit.filter(k => k.kit.kitTipoLavorazioniValide.includes(1));
    assert.strictEqual(volantino.length, 2);
    volantino.forEach(k => {
        const predefinita = k.operazioniPerBox.find(v => v.nomiBox.length === 0);
        assert.deepStrictEqual(predefinita.elementiDaPosizionare, ['*logo_attributo_it*']);
    });
    kit.filter(k => k.kit.kitTipoLavorazioniValide.includes(2))
        .forEach(k => k.operazioniPerBox.forEach(v => assert.ok(v.elementiDaPosizionare == null, JSON.stringify(v.nomiBox))));
});

/* ---- l'impaginazione ---- */

test("impaginando, l'elemento dichiarato esce al 40% con il warning CSF-30; gli altri non cambiano", () => {
    conAmbienteFinto((CssFramework, messaggi, segnalazioni) => {
        const { box, logo, descrizione } = boxCon(100);
        CssFramework.contestoCss = { etichettaBox: 'BOX6', DBallineamenti: [{ nomiBox: [], elementiDaPosizionare: ['*logo_attributo_it*'] }], DBDefault: null };

        assert.strictEqual(CssFramework.applicaElementiDaPosizionare(box), box);

        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 40);
        assert.strictEqual(descrizione.transparencySettings.blendingSettings.opacity, 100);
        assert.strictEqual(segnalazioni.length, 1);
        assert.strictEqual(segnalazioni[0].typeMessage, 'warning');
        assert.match(segnalazioni[0].msg, /^Code CSF-30: foto_extra\$logo_attributo_it\$tipo_3 in posizione da verificare/);
        assert.deepStrictEqual(segnalazioni[0].verifica, { posizione: LOGO });
        //La voce del bollino porta l'elemento, per Risolvi e per il ricontrollo.
        assert.deepStrictEqual(etichettaBollino.daSegnalazione(segnalazioni[0]).v, { posizione: LOGO });
    });
});

test("il bollino, che nell'etichetta ha il nome del logo, non e' un elemento da posizionare", () => {
    conAmbienteFinto((CssFramework, messaggi, segnalazioni) => {
        const { box, logo } = boxCon(100, [VOCE_LOGO]);
        const bollino = box.allPageItems.find(e => etichettaBollino.eDiSegnalazioni(e.label));
        CssFramework.contestoCss = { etichettaBox: 'BOX6', DBallineamenti: [{ nomiBox: [], elementiDaPosizionare: ['*logo_attributo_it*'] }], DBDefault: null };

        CssFramework.applicaElementiDaPosizionare(box);

        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 40);
        assert.strictEqual(bollino.transparencySettings.blendingSettings.opacity, 100);
        assert.strictEqual(segnalazioni.length, 1);
    });
});

test("senza elementi dichiarati, o con l'elemento nascosto, l'impaginazione non tocca niente", () => {
    conAmbienteFinto((CssFramework, messaggi, segnalazioni) => {
        const senzaRegole = boxCon(100);
        CssFramework.contestoCss = { etichettaBox: 'BOX6', DBallineamenti: [{ nomiBox: [] }], DBDefault: null };
        CssFramework.applicaElementiDaPosizionare(senzaRegole.box);
        assert.strictEqual(senzaRegole.logo.transparencySettings.blendingSettings.opacity, 100);

        const nascosto = boxCon(100, [], false);
        CssFramework.contestoCss = { etichettaBox: 'BOX6', DBallineamenti: [{ nomiBox: [], elementiDaPosizionare: ['*logo_attributo_it*'] }], DBDefault: null };
        CssFramework.applicaElementiDaPosizionare(nascosto.box);
        assert.strictEqual(nascosto.logo.transparencySettings.blendingSettings.opacity, 100);

        assert.strictEqual(segnalazioni.length, 0);
    });
});

/* ---- Risolvi ---- */

test("Risolvi sulla CSF-30 riporta l'elemento al 100% e toglie la voce", () => {
    conAmbienteFinto(() => {
        const { box, logo } = boxCon(40, [VOCE_LOGO, ALTRA_VOCE]);
        const indice = Segnalazioni.leggiDalBox(box).findIndex(v => v.c === 'CSF-30');

        Segnalazioni.risolviVoce(box, indice);

        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 100);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ['CSF-26']);
    });
});

test("Risolvere un'altra voce non tocca l'elemento; Risolvi tutte lo riporta al 100%", () => {
    conAmbienteFinto(() => {
        const { box, logo } = boxCon(40, [VOCE_LOGO, ALTRA_VOCE]);
        Segnalazioni.risolviVoce(box, Segnalazioni.leggiDalBox(box).findIndex(v => v.c === 'CSF-26'));
        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 40);

        Segnalazioni.risolviTutte(box);
        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 100);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box), []);
    });
});

test("Risolvi non cambia un'opacita' che l'operatore ha gia' portato fuori da 40-50", () => {
    conAmbienteFinto(() => {
        const { box, logo } = boxCon(90, [VOCE_LOGO]);
        Segnalazioni.risolviTutte(box);
        assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 90);
    });
});

test("senza CssFramework (sotto Node) Risolvi funziona come prima", () => {
    const { box, logo } = boxCon(40, [VOCE_LOGO]);
    global.Utility = { parseLabel: l => l };
    try {
        Segnalazioni.risolviTutte(box);
    }
    finally {
        delete global.Utility;
    }
    assert.strictEqual(logo.transparencySettings.blendingSettings.opacity, 40);
    assert.deepStrictEqual(Segnalazioni.leggiDalBox(box), []);
});

/* ---- il ricontrollo ---- */

test("con l'opacita' rimessa a mano al 100% la CSF-30 si toglie, e il registro lo dice", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        const { box } = boxCon(100, [VOCE_LOGO, ALTRA_VOCE]);

        CssFramework.ricontrollaElementiDaPosizionare(box);

        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ['CSF-26']);
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /^Code CSF-31: Segnalazione CSF-30 tolta dal box BOX6: foto_extra\$logo_attributo_it\$tipo_3/);
    });
});

test("fra 40 e 50 la CSF-30 resta; fuori, nascosto o tolto dal box si toglie", () => {
    conAmbienteFinto(CssFramework => {
        [40, 45, 50].forEach(opacita => {
            const { box } = boxCon(opacita, [VOCE_LOGO]);
            CssFramework.ricontrollaElementiDaPosizionare(box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ['CSF-30'], 'opacita ' + opacita);
        });

        [39, 60].forEach(opacita => {
            const fuori = boxCon(opacita, [VOCE_LOGO]);
            CssFramework.ricontrollaElementiDaPosizionare(fuori.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(fuori.box), [], 'opacita ' + opacita);
        });

        const nascosto = boxCon(40, [VOCE_LOGO], false);
        CssFramework.ricontrollaElementiDaPosizionare(nascosto.box);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(nascosto.box), []);

        const tolto = boxCon(40, [VOCE_LOGO]);
        tolto.logo.remove();
        CssFramework.ricontrollaElementiDaPosizionare(tolto.box);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(tolto.box), []);
    });
});

test("all'apertura della scheda ref il ricontrollo delle CSF-013 toglie anche le CSF-30 gia' sistemate", () => {
    conAmbienteFinto(CssFramework => {
        const { box } = boxCon(100, [VOCE_LOGO, ALTRA_VOCE]);
        CssFramework.ricontrollaConflittiDelBox(box);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(box).map(v => v.c), ['CSF-26']);
    });
});

/* ---- la segnalazione che torna ---- */

//La copia delle regole scaricate (allineamenti.json) con il kit della lavorazione: la voce di default
//dichiara le etichette date. Il kit si sceglie con area e canale della lavorazione: qui e' finto.
function conCopiaDelleRegole(CssFramework, etichette, fn) {
    const kit = { fileModifiche: { operazioniPerBox: [{ nomiBox: [], elementiDaPosizionare: etichette }, { nomiBox: ['BOX6'] }] }, fileModificheDef: null };
    const sceltaDelKit = CssFramework.kitDelleRegole;
    global.readFile = percorso => (percorso === '/dati/allineamenti.json' ? { modificheCssPerKit: [kit] } : null);
    CssFramework.kitDelleRegole = () => kit;
    try {
        fn();
    }
    finally {
        CssFramework.kitDelleRegole = sceltaDelKit;
    }
}

test("rimesso a mano fra 40 e 50, all'apertura della scheda ref la CSF-30 torna, e il registro lo dice", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        conCopiaDelleRegole(CssFramework, ['*logo_attributo_it*'], () => {
            [40, 45, 50].forEach(opacita => {
                const { box } = boxCon(opacita, [ALTRA_VOCE]);
                CssFramework.ricontrollaConflittiDelBox(box);

                const voci = Segnalazioni.leggiDalBox(box);
                assert.deepStrictEqual(voci.map(v => v.c).sort(), ['CSF-26', 'CSF-30'], 'opacita ' + opacita);
                assert.deepStrictEqual(voci.find(v => v.c === 'CSF-30'), VOCE_LOGO);
            });
            assert.match(messaggi[0].testo, /^Code CSF-31: Segnalazione CSF-30 aggiunta al box BOX6: foto_extra\$logo_attributo_it\$tipo_3/);

            //Anche in un box rimasto senza bollino.
            const senzaBollino = boxCon(40, []);
            CssFramework.ricontrollaConflittiDelBox(senzaBollino.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(senzaBollino.box), [VOCE_LOGO]);
        });
    });
});

test("la CSF-30 non torna al 100%, se c'e' gia', se l'elemento non e' dichiarato o e' nascosto", () => {
    conAmbienteFinto((CssFramework, messaggi) => {
        conCopiaDelleRegole(CssFramework, ['*logo_attributo_it*'], () => {
            const pieno = boxCon(100, [ALTRA_VOCE]);
            CssFramework.ricontrollaConflittiDelBox(pieno.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(pieno.box).map(v => v.c), ['CSF-26']);

            const giaSegnalato = boxCon(40, [VOCE_LOGO]);
            CssFramework.ricontrollaConflittiDelBox(giaSegnalato.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(giaSegnalato.box), [VOCE_LOGO]);

            const nascosto = boxCon(40, [], false);
            CssFramework.ricontrollaConflittiDelBox(nascosto.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(nascosto.box), []);
        });
        conCopiaDelleRegole(CssFramework, ['*bollo*'], () => {
            const nonDichiarato = boxCon(40, []);
            CssFramework.ricontrollaConflittiDelBox(nonDichiarato.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(nonDichiarato.box), []);
        });
        //Senza la copia delle regole non si sa cosa e' dichiarato: niente.
        const senzaCopia = boxCon(40, []);
        CssFramework.ricontrollaConflittiDelBox(senzaCopia.box);
        assert.deepStrictEqual(Segnalazioni.leggiDalBox(senzaCopia.box), []);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("con le segnalazioni disattivate, o dalla lettura delle segnalazioni, la CSF-30 non torna", () => {
    conAmbienteFinto(CssFramework => {
        conCopiaDelleRegole(CssFramework, ['*logo_attributo_it*'], () => {
            const letto = boxCon(40, [ALTRA_VOCE]);
            CssFramework.ricontrollaElementiDaPosizionare(letto.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(letto.box).map(v => v.c), ['CSF-26']);

            global.SchermataSegnalazioni = { disattivate: () => true };
            const disattivate = boxCon(40, [ALTRA_VOCE]);
            CssFramework.ricontrollaConflittiDelBox(disattivate.box);
            assert.deepStrictEqual(Segnalazioni.leggiDalBox(disattivate.box).map(v => v.c), ['CSF-26']);
        });
    });
});

/* ---- dove gira ---- */

test("nell'impaginazione del box l'opacita' si applica dopo evitaElementiTesto e prima dei conflitti", () => {
    const index = sorgente('plugin/indexNew.js');
    const inizio = index.indexOf('async function callAllOperationFixBox(');
    const funzione = index.substring(inizio, index.indexOf('\n}\n', inizio));

    const stacca = funzione.indexOf('boxImpaginato = CssFramework.applicaEvitaElementiTesto(boxImpaginato);');
    const posiziona = funzione.indexOf('boxImpaginato = CssFramework.applicaElementiDaPosizionare(boxImpaginato);');
    const conflitti = funzione.indexOf('CssFramework.controllaSegnalazioniConflittiPendenti(boxImpaginato);');
    assert.ok(stacca > 0 && posiziona > stacca && conflitti > posiziona, 'ordine: evitaElementiTesto, elementi da posizionare, conflitti');
});

test("la lettura delle segnalazioni ricontrolla le CSF-30 e rilegge prima di contare", () => {
    const schermata = sorgente('plugin/segnalazioni/schermata.js');
    const corpo = schermata.substring(schermata.indexOf('    letturaControllata(pagine) {'));
    const funzione = corpo.substring(0, corpo.indexOf('\n    },\n'));
    assert.match(funzione, /if \(SchermataSegnalazioni\.ricontrollaElementiDaPosizionare\(lette\)\) \{\s*lette\.splice\(0, lette\.length, \.\.\.\(Array\.isArray\(pagine\) \? Segnalazioni\.leggiPagine\(documento, pagine\) : Segnalazioni\.leggiDocumento\(documento\)\)\);\s*\}\s*SchermataSegnalazioni\.registraControllo/);
});
