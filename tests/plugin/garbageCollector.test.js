/*
 * I20-1006: il garbage collector del Plugin, che rimuove gli elementi InDesign in differita.
 *
 * Il modulo non fa require e si carica anche sotto Node. InDesign non c'e': gli elementi sono
 * oggetti finti con isValid, parent e remove, e il timer e' un orologio finto che si fa
 * avanzare a mano. Si sostituiscono setInterval e clearInterval invece di usare i timer finti di
 * node:test perche' la loro interfaccia cambia fra la versione di Node locale e quella della CI.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const GarbageCollector = require('../../plugin/garbageCollector');

/* ---- un orologio finto per setInterval ---- */

function orologioFinto() {
    const timer = new Map();
    let prossimo = 1;
    const originali = { setInterval: global.setInterval, clearInterval: global.clearInterval };

    global.setInterval = (fn) => { const id = prossimo++; timer.set(id, fn); return id; };
    global.clearInterval = (id) => { timer.delete(id); };

    return {
        //Un tick di tutti i timer attivi, come se fossero passati 100 ms.
        tick(volte = 1) {
            for (let v = 0; v < volte; v++) {
                for (const fn of Array.from(timer.values())) {
                    fn();
                }
            }
        },
        attivi() { return timer.size; },
        ripristina() { global.setInterval = originali.setInterval; global.clearInterval = originali.clearInterval; }
    };
}

function elemento(nome, parent = null) {
    return {
        nome: nome,
        isValid: true,
        parent: parent,
        rimosso: false,
        constructorName: 'Image',
        remove() { this.rimosso = true; this.isValid = false; }
    };
}

function riquadro() {
    return { constructorName: 'Rectangle', isValid: true, contentType: 'GRAPHIC_TYPE' };
}

//Il ContentType che nel Plugin arriva da indexNew.js (vedi l'intestazione del modulo).
function conContentType(fn) {
    const prima = global.ContentType;
    global.ContentType = { UNASSIGNED: 'UNASSIGNED' };
    try { return fn(); } finally {
        if (prima === undefined) { delete global.ContentType; } else { global.ContentType = prima; }
    }
}

function conAvvisi(fn) {
    const originale = console.warn;
    const avvisi = [];
    console.warn = (m) => avvisi.push(String(m));
    try { fn(avvisi); } finally { console.warn = originale; }
    return avvisi;
}

/* ---- la rimozione differita ---- */

test('un elemento accodato sparisce al tick successivo, non subito', () => {
    const orologio = orologioFinto();
    try {
        const gc = new GarbageCollector();
        const e = elemento('a');

        gc.Add(e);
        assert.strictEqual(e.rimosso, false);

        orologio.tick();
        assert.strictEqual(e.rimosso, true);
    } finally { orologio.ripristina(); }
});

test('un elemento con una chiave in attesa resta finche\' la chiave non si attiva', () => {
    const orologio = orologioFinto();
    try {
        const gc = new GarbageCollector();
        const chiave = gc.generateKey();
        const e = elemento('trattenuto');

        gc.Add(e, chiave);
        orologio.tick(3);
        assert.strictEqual(e.rimosso, false);

        gc.activateKey(chiave);
        orologio.tick();
        assert.strictEqual(e.rimosso, true);
    } finally { orologio.ripristina(); }
});

test('con la coda vuota il timer si ferma, e Add lo fa ripartire', () => {
    const orologio = orologioFinto();
    try {
        const gc = new GarbageCollector();
        orologio.tick();
        assert.strictEqual(gc.interval, null);
        assert.strictEqual(orologio.attivi(), 0);

        const e = elemento('dopo');
        gc.Add(e);
        assert.notStrictEqual(gc.interval, null);
        orologio.tick();
        assert.strictEqual(e.rimosso, true);
    } finally { orologio.ripristina(); }
});

/* ---- il riquadro che resta vuoto ---- */

test('il riquadro che conteneva l\'immagine torna senza contenuto', () => {
    const orologio = orologioFinto();
    try {
        conContentType(() => {
            const gc = new GarbageCollector();
            const r = riquadro();
            gc.Add(elemento('immagine', r));
            orologio.tick();

            assert.strictEqual(r.contentType, 'UNASSIGNED');
        });
    } finally { orologio.ripristina(); }
});

test('il riquadro si trova anche attraverso i gruppi, ma non oltre lo spread', () => {
    const orologio = orologioFinto();
    try {
        conContentType(() => {
            const gc = new GarbageCollector();
            const r = riquadro();
            const gruppo = { constructorName: 'Group', isValid: true, parent: r };
            gc.Add(elemento('nel gruppo', gruppo));

            const spread = { constructorName: 'Spread', isValid: true };
            const gruppoInPagina = { constructorName: 'Group', isValid: true, parent: spread };
            const e2 = elemento('in pagina', gruppoInPagina);
            gc.Add(e2);

            orologio.tick();

            assert.strictEqual(r.contentType, 'UNASSIGNED');
            assert.strictEqual(e2.rimosso, true);
            assert.strictEqual(spread.contentType, undefined);
        });
    } finally { orologio.ripristina(); }
});

//Prima un errore qui finiva in un catch vuoto: se ContentType mancasse, nessuno lo saprebbe.
test('se il riquadro non si puo\' azzerare lo si dice, e l\'elemento sparisce lo stesso', () => {
    const orologio = orologioFinto();
    try {
        const prima = global.ContentType;
        delete global.ContentType;
        try {
            const avvisi = conAvvisi(() => {
                const gc = new GarbageCollector();
                const e = elemento('senza ContentType', riquadro());
                gc.Add(e);
                orologio.tick();
                assert.strictEqual(e.rimosso, true);
            });

            assert.strictEqual(avvisi.length, 1);
            assert.match(avvisi[0], /riquadro non azzerato/);
        } finally {
            if (prima !== undefined) { global.ContentType = prima; }
        }
    } finally { orologio.ripristina(); }
});

/* ---- Add con qualcosa che non si puo' rimuovere ---- */

//Era $.writeln: in UXP non esiste, e l'errore saltava fuori nel chiamante.
test('un elemento senza remove produce un avviso, non un errore', () => {
    const orologio = orologioFinto();
    try {
        const avvisi = conAvvisi(() => {
            const gc = new GarbageCollector();
            assert.doesNotThrow(() => gc.Add({ nome: 'non rimovibile' }));
            assert.doesNotThrow(() => gc.Add(null));
            assert.strictEqual(gc.elements.length, 0);
        });

        assert.strictEqual(avvisi.length, 2);
        assert.match(avvisi[0], /non ha un metodo remove/);
    } finally { orologio.ripristina(); }
});

/* ---- il callback di coda vuota ---- */

test('il callback di coda vuota vale anche dopo il riavvio fatto da Add', () => {
    const orologio = orologioFinto();
    try {
        const gc = new GarbageCollector();
        gc.stop();

        let chiamate = 0;
        gc.startInterval(() => chiamate++);
        orologio.tick();
        assert.strictEqual(chiamate, 1);

        //Add riavvia il timer senza passare il callback: prima andava perso.
        gc.Add(elemento('b'));
        orologio.tick(2);
        assert.strictEqual(chiamate, 2);
    } finally { orologio.ripristina(); }
});

/* ---- le chiavi ---- */

test('le chiavi sono di dieci caratteri e tutte diverse', () => {
    const orologio = orologioFinto();
    try {
        const gc = new GarbageCollector();
        const chiavi = new Set();
        for (let i = 0; i < 200; i++) {
            const k = gc.generateKey();
            assert.strictEqual(k.length, 10);
            chiavi.add(k);
        }
        assert.strictEqual(chiavi.size, 200);
    } finally { orologio.ripristina(); }
});

//Prima di I20-1006 una collisione allungava la chiave invece di rigenerarla.
test('una chiave che collide si rigenera da capo, non si allunga', () => {
    const orologio = orologioFinto();
    const random = Math.random;
    try {
        const gc = new GarbageCollector();
        //Dieci volte lo stesso carattere, poi dieci volte un altro.
        let n = 0;
        Math.random = () => (n++ < 10 ? 0 : 0.5);
        gc.waitingKeys.push('AAAAAAAAAA');

        const k = gc.generateKey();

        assert.strictEqual(k.length, 10);
        assert.notStrictEqual(k, 'AAAAAAAAAA');
    } finally {
        Math.random = random;
        orologio.ripristina();
    }
});
