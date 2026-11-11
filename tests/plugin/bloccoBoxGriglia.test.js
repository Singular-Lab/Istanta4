/*
 * I20-1228: bloccare e sbloccare un box dalla schermata Griglia.
 *
 * Sbloccando un box bloccato (o bloccando un box vuoto) il box nella griglia cambiava, ma la riga
 * del pannello restava com'era: cambiava solo l'icona del lucchetto, e un box sbloccato restava
 * "Bloccato" con il bordo rosso. Ora griglia.js cambiaBloccoSenzaScorrere aggiorna il segno di
 * blocco nella griglia e ridisegna l'elenco con compilaGriglia, che rifa' la riga dallo stato del
 * box (_rigaBox).
 *
 * griglia.js richiede InDesign e sotto Node non si carica: i metodi si estraggono dal sorgente.
 *
 * Esecuzione: node --test tests/plugin/bloccoBoxGriglia.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const testo = leggiFileDelPlugin("griglia.js").replace(/\r/g, "");

/// Il testo di un membro "    nome(...) {...}" dell'oggetto griglia, graffe bilanciate.
function membro(nome) {
    const inizio = testo.indexOf("\n    " + nome + "(");
    assert.notStrictEqual(inizio, -1, nome + " non trovato");
    const apertura = testo.indexOf("{", inizio);
    let livello = 0;
    for (let i = apertura; i < testo.length; i++) {
        if (testo[i] === "{") {
            livello++;
        }
        else if (testo[i] === "}") {
            livello--;
            if (livello === 0) {
                return testo.substring(inizio + 5, i + 1);
            }
        }
    }
    assert.fail(nome + " senza graffa di chiusura");
}

/// La griglia con i metodi veri e, attorno, un documento finto: il riquadro "no" del box (il
/// segno di blocco) e un compilaGriglia che ridisegna le righe con il vero _rigaBox.
function grigliaFinta(gruppi) {
    const metodi = new Function("return {\n" + ["cambiaBloccoSenzaScorrere", "_rigaBox"].map(membro).join(",\n") + "\n};")();
    const segni = new Map(gruppi.map(g => [g.box, { visible: g.bloccato }]));
    const disegni = [];
    return Object.assign(metodi, {
        segni,
        disegni,
        getChildBoxByLabel(box, label) {
            assert.strictEqual(label, "no");
            return segni.get(box);
        },
        compilaGriglia(griglia, mappaGriglia) {
            disegni.push({ griglia, mappaGriglia, righe: mappaGriglia.map((g, i) => this._rigaBox(i + 1, g)) });
            return Promise.resolve();
        },
        //La riga: si registra cio' che _rigaBox le passa, senza jQuery.
        _rigaElenco(numero, classi, titolo, sottotitolo, etichettaStato) {
            return { numero, classi, titolo, etichettaStato, attr() { return this; } };
        }
    });
}

function gruppo(numero, bloccato, infoPresenti = false) {
    return { box: { id: numero, label: "box_" + numero }, nomeBox: "box_" + numero, bloccato, infoPresenti, info: infoPresenti ? "Caffe' Crema" : null, codiceAssociato: "" };
}

test("sbloccando un box bloccato la riga torna Vuoto e il segno di blocco si spegne", async () => {
    const mappa = [gruppo(1, true), gruppo(2, false, true), gruppo(3, true)];
    const g = grigliaFinta(mappa);
    const laGriglia = { name: "griglia" };

    await g.cambiaBloccoSenzaScorrere(mappa[2], laGriglia, mappa);

    assert.strictEqual(mappa[2].bloccato, false);
    assert.strictEqual(g.segni.get(mappa[2].box).visible, false);
    assert.strictEqual(g.disegni.length, 1, "l'elenco si ridisegna");
    assert.strictEqual(g.disegni[0].griglia, laGriglia);
    assert.strictEqual(g.disegni[0].mappaGriglia, mappa, "con la stessa mappa, senza rileggere la griglia");
    const riga3 = g.disegni[0].righe[2];
    assert.strictEqual(riga3.etichettaStato, "Vuoto");
    assert.match(riga3.classi, /\bvuota\b/);
    assert.doesNotMatch(riga3.classi, /\bbloccata\b/);
    //Gli altri box restano com'erano.
    assert.strictEqual(g.disegni[0].righe[0].etichettaStato, "Bloccato");
    assert.match(g.disegni[0].righe[1].classi, /\bpiena\b/);
});

test("bloccando un box vuoto la riga diventa Bloccato e il segno di blocco si accende", async () => {
    const mappa = [gruppo(7, false)];
    const g = grigliaFinta(mappa);

    await g.cambiaBloccoSenzaScorrere(mappa[0], {}, mappa);

    assert.strictEqual(mappa[0].bloccato, true);
    assert.strictEqual(g.segni.get(mappa[0].box).visible, true);
    assert.strictEqual(g.disegni.length, 1);
    assert.strictEqual(g.disegni[0].righe[0].etichettaStato, "Bloccato");
    assert.match(g.disegni[0].righe[0].classi, /\bbloccata\b/);
});

test("il pulsante Blocca box, su un box vuoto o bloccato, passa da cambiaBloccoSenzaScorrere", () => {
    const ramo = testo.match(/if \(!gruppo\.infoPresenti \|\| gruppo\.bloccato\) \{([\s\S]*?)\n\s*\}\n\s*else \{/);
    assert.ok(ramo, "ramo del box vuoto o bloccato non trovato");
    const codice = ramo[1].split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
    assert.match(codice, /me\.cambiaBloccoSenzaScorrere\(gruppo, griglia, mappaGriglia\)/);
    //Non torna a cambiare solo l'icona.
    assert.doesNotMatch(codice, /\$\(this\)\.attr\("src"/);
});
