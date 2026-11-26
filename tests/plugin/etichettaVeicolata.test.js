/*
 * TASK-e758bd95: "Mostra etichetta veicolata".
 *
 * Selezionando un campo di un box impaginato il Plugin mostra "Selezionato il campo <nome>". Per le
 * agenzie che lo abilitano (oggi Edro21) sotto c'e' "Mostra etichetta veicolata": dal campo si
 * risale al box e al suo DNA, si scarica la scheda a parte e si mostra da quali campi del record e'
 * composto il campo (CompiledField.veicolatoDa), con i loro valori. Il campo resta selezionato.
 *
 * etichettaVeicolata.js si carica sotto Node: si prova con InDesign, server e finestra finti;
 * l'aggancio in indexNew.js si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const EtichettaVeicolata = require("../../plugin/etichettaVeicolata.js");

/* ---- un box finto: spread > gruppo del box > sottogruppo > campo ---- */

function Spread() { }
function Group() { }
function TextFrame() { }

function boxFinto() {
    const spread = new Spread();
    const box = Object.assign(new Group(), { parent: spread, label: "BOX1" });
    const sottogruppo = Object.assign(new Group(), { parent: box, label: "gruppo_prezzo" });
    const campo = Object.assign(new TextFrame(), { parent: sottogruppo, label: "prezzo_offerta" });
    const campoConChiave = Object.assign(new TextFrame(), { parent: box, label: "prezzo_continuo$KgL" });
    return { spread, box, sottogruppo, campo, campoConChiave };
}

const RECORDS = [
    { recordInTracciato: { StatoSelezione: 2, prezzo_offerta: "9,99", compiledFields: [] } },
    {
        recordInTracciato: {
            StatoSelezione: 1, prezzo_offerta: "1,99", N_MM: 3, "Descrizioni.Descrizione4": "",
            combinazioneAssegnata: "NM_MM",
            compiledFields: [
                { labelName: "prezzo_offerta", content: "1,99", veicolatoDa: ["prezzo_offerta"] },
                { labelName: "PezzConf_NM", content: "3 pezzi", veicolatoDa: ["combinazioneAssegnata", "N_MM", "Descrizioni.Descrizione4"] },
                { labelName: "campo_offerta", content: "campo_offerta", veicolatoDa: [] },
                { labelName: "prezzo_continuo$KgL", content: "al kg € 3,98" }
            ]
        }
    }
];

/// Un jQuery finto che basta al contenuto della finestra: raccoglie i testi.
function jqueryFinto() {
    const nodo = (html) => {
        const n = { html, testi: [], figli: [] };
        n.text = (t) => { n.testi.push(String(t)); return n; };
        n.append = (f) => { n.figli.push(f); return n; };
        n.tuttoIlTesto = () => n.testi.concat(...n.figli.map(f => f.tuttoIlTesto())).join(" | ");
        return n;
    };
    return nodo;
}

/* ---- l'abilitazione ---- */

test("il pulsante c'e' solo se la configurazione dell'agenzia lo accende", () => {
    assert.strictEqual(EtichettaVeicolata.abilitato({ getCampo: (c) => (c === "mostraEtichettaVeicolata" ? true : null) }), true);
    assert.strictEqual(EtichettaVeicolata.abilitato({ getCampo: () => null }), false);
    assert.strictEqual(EtichettaVeicolata.abilitato({ getCampo: () => "true" }), false);
    assert.strictEqual(EtichettaVeicolata.abilitato({ getCampo: () => { throw new Error("x"); } }), false);
    assert.strictEqual(EtichettaVeicolata.abilitato(null), false);
});

/* ---- dal campo al box ---- */

test("dal campo si risale al box appoggiato sullo spread, anche dentro un sottogruppo", () => {
    const { box, campo, campoConChiave } = boxFinto();
    assert.strictEqual(EtichettaVeicolata.boxDelCampo(campo), box);
    assert.strictEqual(EtichettaVeicolata.boxDelCampo(campoConChiave), box);
});

test("un elemento che e' gia' sullo spread, o staccato, non ha un box", () => {
    const { box } = boxFinto();
    assert.strictEqual(EtichettaVeicolata.boxDelCampo(box), null);
    assert.strictEqual(EtichettaVeicolata.boxDelCampo({ parent: null }), null);
    assert.strictEqual(EtichettaVeicolata.boxDelCampo(null), null);
});

/* ---- la veicolatura del campo ---- */

test("un campo veicolato mostra i campi del record con i valori del primario", () => {
    assert.deepStrictEqual(EtichettaVeicolata.veicolatura(RECORDS, "PezzConf_NM"), {
        esito: "veicolata",
        campo: RECORDS[1].recordInTracciato.compiledFields[1],
        righe: [
            { campo: "combinazioneAssegnata", valore: "NM_MM" },
            { campo: "N_MM", valore: "3" },
            { campo: "Descrizioni.Descrizione4", valore: "(vuoto)" }
        ]
    });
    //Il valore e' quello del primario, non del secondario.
    assert.deepStrictEqual(EtichettaVeicolata.veicolatura(RECORDS, "prezzo_offerta").righe, [{ campo: "prezzo_offerta", valore: "1,99" }]);
});

test("la label del box si confronta senza chiave, DNA e maiuscole", () => {
    assert.strictEqual(EtichettaVeicolata.veicolatura(RECORDS, "Prezzo_Offerta$DNA$BOX1$123$123$45").esito, "veicolata");
    assert.strictEqual(EtichettaVeicolata.veicolatura(RECORDS, "prezzo_continuo$KgL").esito, "nonDichiarata");
});

test("testo fisso, provenienza non dichiarata e campo assente si distinguono", () => {
    assert.strictEqual(EtichettaVeicolata.veicolatura(RECORDS, "campo_offerta").esito, "testoFisso");
    assert.strictEqual(EtichettaVeicolata.veicolatura(RECORDS, "prezzo_continuo").esito, "nonDichiarata");
    assert.deepStrictEqual(EtichettaVeicolata.veicolatura(RECORDS, "logo_bio"), { esito: "assente" });
    assert.deepStrictEqual(EtichettaVeicolata.veicolatura([], "prezzo_offerta"), { esito: "assente" });
});

test("i valori si leggono come testo", () => {
    assert.strictEqual(EtichettaVeicolata.valoreLeggibile(null), "(vuoto)");
    assert.strictEqual(EtichettaVeicolata.valoreLeggibile("  "), "(vuoto)");
    assert.strictEqual(EtichettaVeicolata.valoreLeggibile(0), "0");
    assert.strictEqual(EtichettaVeicolata.valoreLeggibile({ a: 1 }), "{\"a\":1}");
});

/* ---- il pulsante ---- */

function ambiente({ dna, records, errore = null } = {}) {
    const fatto = { richieste: [], finestre: [], messaggi: [] };
    const amb = {
        Utility: { getDnaOfBox: (box) => (box != null && box.label === "BOX1" ? dna : null) },
        schedaRef: {
            isInvalidated: true,
            getSchedaRef: (codice, callback, idRec, ignoraInvalidazione, idLavRec) => {
                fatto.richieste.push({ codice, idRec, ignoraInvalidazione, idLavRec });
                callback(errore, errore == null ? { records } : null);
            }
        },
        Modali: { popup: (titolo, contenuto) => fatto.finestre.push({ titolo, testo: contenuto.tuttoIlTesto() }) },
        messaggioUtente: (testo, stile) => fatto.messaggi.push({ testo, stile }),
        $: jqueryFinto()
    };
    return { amb, fatto };
}

const DNA = { codice_gruppo: "123,124", idRec: 77, idLavRec: 9 };

test("il pulsante scarica la scheda del box dal DNA, derivato compreso, e mostra la provenienza", async () => {
    const { campo } = boxFinto();
    const { amb, fatto } = ambiente({ dna: DNA, records: RECORDS });

    const esito = await EtichettaVeicolata.mostra(campo, amb);

    assert.strictEqual(esito.esito, "veicolata");
    //A parte: la scheda aperta e' "invalidata" ma la richiesta passa lo stesso.
    assert.deepStrictEqual(fatto.richieste, [{ codice: "123,124", idRec: 77, ignoraInvalidazione: true, idLavRec: 9 }]);
    assert.strictEqual(fatto.finestre.length, 1);
    assert.strictEqual(fatto.finestre[0].titolo, "Etichetta veicolata: prezzo_offerta");
    assert.match(fatto.finestre[0].testo, /prezzo_offerta \| 1,99/);
    assert.deepStrictEqual(fatto.messaggi, []);
});

test("un campo non in un box, o un box senza DNA, lo si dice senza chiamare il server", async () => {
    const { box } = boxFinto();
    const { amb, fatto } = ambiente({ dna: null, records: RECORDS });
    assert.strictEqual(await EtichettaVeicolata.mostra(box, amb), null);
    const { campo } = boxFinto();
    assert.strictEqual(await EtichettaVeicolata.mostra(campo, amb), null);
    assert.strictEqual(fatto.richieste.length, 0);
    assert.strictEqual(fatto.finestre.length, 0);
    assert.ok(fatto.messaggi.every(m => /ETV-01/.test(m.testo)));
});

test("se la scheda non si scarica lo si dice, senza finestra", async () => {
    const { campo } = boxFinto();
    const { amb, fatto } = ambiente({ dna: DNA, errore: new Error("rete") });
    assert.strictEqual(await EtichettaVeicolata.mostra(campo, amb), null);
    assert.strictEqual(fatto.finestre.length, 0);
    assert.ok(fatto.messaggi.some(m => /ETV-02/.test(m.testo)));
});

test("la finestra dice testo fisso, non dichiarata e assente con parole diverse", () => {
    const $ = jqueryFinto();
    assert.match(EtichettaVeicolata.contenuto({ esito: "testoFisso" }, "campo_offerta", $).tuttoIlTesto(), /testo fisso del box/);
    assert.match(EtichettaVeicolata.contenuto({ esito: "nonDichiarata" }, "x", $).tuttoIlTesto(), /provenienza non e' dichiarata/);
    assert.match(EtichettaVeicolata.contenuto({ esito: "assente" }, "x", $).tuttoIlTesto(), /non e' fra i campi/);
});

/* ---- l'aggancio in indexNew.js ---- */

test("Selezionato il campo aggiunge il pulsante ai suoi, con e senza i pulsanti delle foto", () => {
    const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indice, /setNarrow\("Selezionato il campo " \+ Utility\.parseLabel\(args\[0\]\.label\), conEtichettaVeicolata\(buttons, args\[0\]\)\);/);
    assert.match(indice, /setNarrow\("Selezionato il campo " \+ Utility\.parseLabel\(args\[0\]\.label\), conEtichettaVeicolata\(\[\], args\[0\]\)\);/);
    const funzione = indice.substring(indice.indexOf("function conEtichettaVeicolata(buttons, campo) {"));
    assert.match(funzione, /if \(!EtichettaVeicolata\.abilitato\(pluginMiddleware\)\) \{\s*return buttons;/);
    assert.match(funzione, /await EtichettaVeicolata\.mostra\(campo, \{ Utility: Utility, schedaRef: schedaRef, Modali: Modali, messaggioUtente: messaggioUtente, \$: \$ \}\);/);
    //Il pulsante non seleziona il box: nessun app.select ne' selection nella funzione.
    assert.doesNotMatch(funzione.substring(0, funzione.indexOf("\n}\n")), /\.select\(|selection\s*=/);
});
