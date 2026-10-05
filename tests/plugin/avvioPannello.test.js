/*
 * I20-1045: l'avvio del pannello quando InDesign non ha reso disponibile app.
 *
 * A volte require('indesign').app vale undefined all'avvio, e in quella sessione del pannello non
 * arriva piu'. Il Plugin restava su "Avvio del plugin in corso..." senza un log. Ricaricare il
 * pannello prima o poi sblocca (nel caso misurato al quinto tentativo): ora lo fa da solo, fino
 * a un massimo di tentativi, e poi lo dice all'operatore.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const AvvioPannello = require("../../plugin/avvioPannello.js");

/* ---- decidi ---- */

test("con app si parte, e il conteggio si azzera", () => {
    assert.deepStrictEqual(AvvioPannello.decidi(true, null, 1000), { azione: "avvia", tentativo: 0, stato: null });

    const dopoTreTentativi = { tentativi: 3, primo: 0, ultimo: 3000 };
    assert.deepStrictEqual(AvvioPannello.decidi(true, dopoTreTentativi, 4000), { azione: "avvia", tentativo: 3, stato: null });
});

test("senza app si ricarica, contando i tentativi", () => {
    const primo = AvvioPannello.decidi(false, null, 1000);
    assert.strictEqual(primo.azione, "ricarica");
    assert.strictEqual(primo.tentativo, 1);
    assert.deepStrictEqual(primo.stato, { tentativi: 1, primo: 1000, ultimo: 1000 });

    const secondo = AvvioPannello.decidi(false, primo.stato, 2500);
    assert.strictEqual(secondo.azione, "ricarica");
    assert.strictEqual(secondo.tentativo, 2);
    assert.deepStrictEqual(secondo.stato, { tentativi: 2, primo: 1000, ultimo: 2500 });
});

test("dopo l'ultimo tentativo ci si arrende, e il conteggio si azzera per il Riprova", () => {
    let stato = null;
    let ora = 0;
    for (let i = 1; i <= AvvioPannello.MASSIMO_TENTATIVI; i++) {
        const esito = AvvioPannello.decidi(false, stato, ora);
        assert.strictEqual(esito.azione, "ricarica", "tentativo " + i);
        stato = esito.stato;
        ora += 1500;
    }

    const finale = AvvioPannello.decidi(false, stato, ora);
    assert.deepStrictEqual(finale, { azione: "arrenditi", tentativo: AvvioPannello.MASSIMO_TENTATIVI, stato: null });
});

test("un tentativo vecchio appartiene a un altro avvio: il conteggio riparte", () => {
    const vecchio = { tentativi: 14, primo: 0, ultimo: 1000 };
    const esito = AvvioPannello.decidi(false, vecchio, 1000 + AvvioPannello.FINESTRA_MS);
    assert.strictEqual(esito.azione, "ricarica");
    assert.strictEqual(esito.tentativo, 1);
});

test("oltre la durata massima dal primo tentativo ci si arrende, anche con pochi tentativi", () => {
    const lento = { tentativi: 3, primo: 0, ultimo: AvvioPannello.DURATA_MASSIMA_MS - 1000 };
    const esito = AvvioPannello.decidi(false, lento, AvvioPannello.DURATA_MASSIMA_MS + 1);
    assert.strictEqual(esito.azione, "arrenditi");
});

/* ---- lo stato ---- */

function storageFinto(iniziale = {}) {
    const dati = Object.assign({}, iniziale);
    return {
        dati,
        getItem: (k) => (k in dati ? dati[k] : null),
        setItem: (k, v) => { dati[k] = String(v); },
        removeItem: (k) => { delete dati[k]; }
    };
}

test("lo stato si salva e si rilegge; uno stato illeggibile vale come nessuno", () => {
    const storage = storageFinto();
    AvvioPannello.scriviStato(storage, { tentativi: 2, primo: 1, ultimo: 2 });
    assert.deepStrictEqual(AvvioPannello.leggiStato(storage), { tentativi: 2, primo: 1, ultimo: 2 });

    AvvioPannello.scriviStato(storage, null);
    assert.strictEqual(AvvioPannello.leggiStato(storage), null);

    assert.strictEqual(AvvioPannello.leggiStato(storageFinto({ [AvvioPannello.CHIAVE]: "{rotto" })), null);
    assert.strictEqual(AvvioPannello.leggiStato(null), null);
});

test("uno storage che si rompe non blocca l'avvio", () => {
    const rotto = {
        getItem: () => { throw new Error("no"); },
        setItem: () => { throw new Error("no"); },
        removeItem: () => { throw new Error("no"); }
    };
    assert.strictEqual(AvvioPannello.controlla({ indesign: { app: {} }, storage: rotto }), true);
});

/* ---- controlla ---- */

function dipendenze(app, storage) {
    const registro = { ricariche: 0, attese: [], messaggi: [] };
    return {
        registro,
        d: {
            indesign: { app: app },
            storage: storage,
            ora: 5000,
            ricarica: () => { registro.ricariche++; },
            attendi: (funzione, ms) => { registro.attese.push(ms); funzione(); },
            mostra: (testo, conRiprova) => { registro.messaggi.push({ testo, conRiprova }); }
        }
    };
}

test("con app il Plugin parte, senza ricaricare e senza messaggi", () => {
    const storage = storageFinto({ [AvvioPannello.CHIAVE]: JSON.stringify({ tentativi: 4, primo: 0, ultimo: 4000 }) });
    const { d, registro } = dipendenze({}, storage);

    assert.strictEqual(AvvioPannello.controlla(d), true);
    assert.strictEqual(registro.ricariche, 0);
    assert.deepStrictEqual(registro.messaggi, []);
    assert.strictEqual(AvvioPannello.leggiStato(storage), null, "dopo l'avvio il conteggio si azzera");
});

test("senza app mostra l'attesa e ricarica dopo il ritardo", () => {
    const storage = storageFinto();
    const { d, registro } = dipendenze(undefined, storage);

    assert.strictEqual(AvvioPannello.controlla(d), false);
    assert.deepStrictEqual(registro.attese, [AvvioPannello.RITARDO_MS]);
    assert.strictEqual(registro.ricariche, 1);
    assert.deepStrictEqual(registro.messaggi, [{ testo: "In attesa di InDesign... tentativo 1 di " + AvvioPannello.MASSIMO_TENTATIVI, conRiprova: false }]);
    assert.strictEqual(AvvioPannello.leggiStato(storage).tentativi, 1);
});

test("finiti i tentativi non ricarica piu' e offre il Riprova", () => {
    const storage = storageFinto({ [AvvioPannello.CHIAVE]: JSON.stringify({ tentativi: AvvioPannello.MASSIMO_TENTATIVI, primo: 4000, ultimo: 4500 }) });
    const { d, registro } = dipendenze(undefined, storage);

    assert.strictEqual(AvvioPannello.controlla(d), false);
    assert.strictEqual(registro.ricariche, 0);
    assert.strictEqual(registro.messaggi.length, 1);
    assert.strictEqual(registro.messaggi[0].conRiprova, true);
    assert.strictEqual(AvvioPannello.leggiStato(storage), null);
});

/* ---- dove si chiama ---- */

test("indexNew controlla l'avvio prima di ogni altro require, e senza app si ferma", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const controllo = indexNew.indexOf("if (!AvvioPannello.controlla({");
    const primoRequire = indexNew.search(/^const [^\n]*= require\('(?!\.\/avvioPannello')/m);

    assert.ok(controllo > 0, "manca il controllo");
    assert.ok(primoRequire > controllo, "il controllo deve venire prima degli altri require");
    assert.match(indexNew.substring(controllo, primoRequire), /\}\)\) \{\s*throw new Error\("I20-1045:/);
    assert.match(indexNew.substring(controllo, primoRequire), /ricarica: function \(\) \{ location\.reload\(\); \}/);
});

test("il ciclo degli eventi senza app lo dice una volta sola", () => {
    const events = leggiFileDelPlugin("events.js").replace(/\r/g, "");
    assert.match(events, /if \(app == null\) \{\s*if \(!me\.avvisoAppMancante\) \{\s*me\.avvisoAppMancante = true;\s*console\.error\("I20-1045:/);
    assert.doesNotMatch(events, /me\.asleep \|\| app == null/);
});
