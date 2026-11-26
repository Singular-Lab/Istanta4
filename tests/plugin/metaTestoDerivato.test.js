/*
 * TASK-f2c5e6a8: il testo del box come meta di un box derivato.
 *
 * Su un derivato, dalla finestra delle differenze, il prezzo (o un altro campo di testo) diverso dal
 * server offriva "Scegli quella del box", che e' il Salva modifiche della scheda: la revisione. Sul
 * derivato la revisione non si fa, e l'operazione si fermava con SRF-167 ("la revisione dei campi si
 * fa dal box originale"). Ora sul derivato la riga offre "Scegli quella del server" e "Imposta come
 * meta", che registra il testo del box come meta del derivato senza passare dal Salva. La
 * descrizione aveva gia' le sue due scelte, server e meta, e resta com'era.
 *
 * schedaRef.js si carica sotto Node: le decisioni e le chiamate si provano direttamente, con il box,
 * il server e la scheda finti; il resto sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

const CAMPI = [
    { labelName: "descrizione", paragraphName: "", content: "<DES>Arista</DES>" },
    { labelName: "prezzo_info_pack", paragraphName: "PREZ_info", content: "a conf." }
];

const PREZZO = { label: "prezzo_info_pack", difference: "contenuto" };
const DESCRIZIONE = { label: "descrizione", difference: "contenuto" };

//La scheda aperta su un box, derivato se idLavRec > 0, con il server e il Salva finti. Tutto quello
//che si cambia sul modulo e sui globali torna com'era alla fine.
async function conScheda(idLavRec, prova, { registra = true } = {}) {
    const fatto = { voci: null, salva: 0, riscaricata: 0, ridisegnata: 0, messaggi: [] };
    const campoNelBox = { contents: "cad.", characters: { length: 0, item: () => null } };
    const metodi = ["idLavRecDelBoxAperto", "salvaTestiDalBox", "riscaricaDopoIlMeta", "ridisegnaSchedaDopoIlMeta", "salvaModificheDellaScheda",
        "dovePortaLaDescrizioneDelBox", "statoMetaDescrizione"];
    const prima = { schedeRefDati: schedaRef.schedeRefDati, refSelected: schedaRef.refSelected, Utility: global.Utility, messaggioUtente: global.messaggioUtente, $: global.$ };
    metodi.forEach(m => { prima[m] = schedaRef[m]; });

    schedaRef.schedeRefDati = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: CAMPI } }];
    schedaRef.refSelected = { item: { isValid: true } };
    schedaRef.idLavRecDelBoxAperto = () => idLavRec;
    schedaRef.salvaTestiDalBox = async (richiesta) => { fatto.voci = richiesta.voci; return registra; };
    schedaRef.riscaricaDopoIlMeta = async () => { fatto.riscaricata++; return true; };
    schedaRef.ridisegnaSchedaDopoIlMeta = async () => { fatto.ridisegnata++; };
    schedaRef.salvaModificheDellaScheda = () => { fatto.salva++; };
    schedaRef.dovePortaLaDescrizioneDelBox = () => ({ fondamentali: true, altri: false });
    schedaRef.statoMetaDescrizione = () => null;
    global.Utility = Object.assign({}, global.Utility, {
        parseLabel: (l) => String(l == null ? "" : l).split("$")[0],
        getFieldByLabel: (label) => (label === "prezzo_info_pack" ? campoNelBox : null)
    });
    global.messaggioUtente = (testo, stile) => fatto.messaggi.push({ testo, stile });
    global.$ = () => ({ trigger: () => { } });
    try {
        await prova(fatto);
    }
    finally {
        schedaRef.schedeRefDati = prima.schedeRefDati;
        schedaRef.refSelected = prima.refSelected;
        metodi.forEach(m => { schedaRef[m] = prima[m]; });
        ["Utility", "messaggioUtente", "$"].forEach(nome => {
            if (prima[nome] === undefined) {
                delete global[nome];
            }
            else {
                global[nome] = prima[nome];
            }
        });
    }
}

const attendiPromesse = () => new Promise(r => setImmediate(r));

/* ---- le scelte della finestra ---- */

test("sul derivato il prezzo offre il server e il meta, non la scelta che salva", () => conScheda(42, () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(PREZZO), ["testoServer", "impostaMetaTesto"]);
}));

test("sul derivato la descrizione resta: server o meta, mai la revisione", () => conScheda(42, () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(DESCRIZIONE), ["descrizioneServer", "impostaMetaDescrizione"]);
}));

test("su un box non derivato non cambia niente", () => conScheda(0, () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(PREZZO), ["testoServer", "testoBox"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(DESCRIZIONE), ["descrizioneServer", "descrizioneBox"]);
}));

/* ---- Imposta come meta ---- */

test("Imposta come meta registra il testo del box come meta del campo, col valore del server, senza Salva", () => conScheda(42, async (fatto) => {
    const registrato = await schedaRef.impostaTestoComeMeta(PREZZO);

    assert.strictEqual(registrato, true);
    assert.deepStrictEqual(fatto.voci, [{ label: "prezzo_info_pack", azione: schedaRef.AZIONE_TESTO_DAL_BOX.crea, contenuto: "cad.", contenutoServer: "a conf." }]);
    assert.strictEqual(fatto.salva, 0);
    assert.strictEqual(fatto.riscaricata, 1);
    assert.ok(fatto.messaggi.some(m => m.stile === "success"));
    assert.ok(!fatto.messaggi.some(m => /SRF-167/.test(m.testo)));
}));

test("se il server non registra il meta non si riscarica niente", () => conScheda(42, async (fatto) => {
    assert.strictEqual(await schedaRef.impostaTestoComeMeta(PREZZO), false);
    assert.strictEqual(fatto.riscaricata, 0);
    assert.strictEqual(fatto.salva, 0);
}, { registra: false }));

test("senza il campo nel box il meta non si imposta, e lo si dice", () => conScheda(42, async (fatto) => {
    assert.strictEqual(await schedaRef.impostaTestoComeMeta({ label: "descrizione", difference: "contenuto" }), false);
    assert.strictEqual(fatto.voci, null);
    assert.ok(fatto.messaggi.some(m => /SRF-169/.test(m.testo)));
}));

test("Scegli quella del box chiamata su un derivato non passa dal Salva: imposta il meta", () => conScheda(42, async (fatto) => {
    assert.strictEqual(schedaRef.tieniTestoDelBox(PREZZO), true);
    await attendiPromesse();
    assert.strictEqual(fatto.salva, 0);
    assert.strictEqual(fatto.voci.length, 1);
    assert.strictEqual(fatto.ridisegnata, 1);
}));

test("Scegli quella del box su un box non derivato resta il Salva modifiche", () => conScheda(0, async (fatto) => {
    assert.strictEqual(schedaRef.tieniTestoDelBox(PREZZO), true);
    await attendiPromesse();
    assert.strictEqual(fatto.salva, 1);
    assert.strictEqual(fatto.voci, null);
}));

/* ---- la finestra, sul sorgente ---- */

test("la finestra ha il pulsante Imposta come meta per i testi, e dopo il meta ridisegna la scheda", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(scheda, /impostaMetaTesto: \["Imposta come meta", "[^"]+"\],/);
    assert.match(scheda, /else if \(azione === "impostaMetaTesto"\) \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if \(await me\.impostaTestoComeMeta\(diff\)\) \{\s*await me\.ridisegnaSchedaDopoIlMeta\(\);\s*\}\s*if \(typeof dopoAzione === "function"\) \{\s*await dopoAzione\(\);/);
});
