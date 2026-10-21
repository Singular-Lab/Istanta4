/*
 * La foto col collegamento rotto nel box, nella finestra Differenze rilevate della scheda ref.
 *
 * La scheda diceva "Foto mancante nella cartella di lavorazione" quando InDesign dava il link in
 * stato LINK_MISSING, anche con il file nei Links: la segnalazione nasceva dallo stato del link
 * (ReperimentoFoto.getLinkHash), non dalla cartella. E siccome senza file l'hash e' nullo, usciva
 * anche "Foto non corrispondente nel box": due segnalazioni per una causa sola, la prima sbagliata.
 * Ora i casi sono distinti: collegamento rotto con il file nei Links (una differenza, da
 * ricollegare dalla finestra), file davvero assente (mancante nella cartella), e in nessuno dei due
 * "non corrispondente".
 *
 * confronti.js e schedaRef.js si caricano sotto Node; InDesign e le globali del Plugin si fingono.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");
const schedaRef = require("../../plugin/schedaRef.js");

const FOTO = { nomeFoto: "680443_1_AD.psd", hash: "ABC" };
const NEI_LINKS = "/Volumes/lavorazioni/Istanta 2.0/P2622/Links/680443_1_AD.psd";
const ROTTO = { missing: true, mismatch: false, hash: null, percorsoLink: "/Users/altro/P2622/Links/680443_1_AD.psd" };

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
async function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return await prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

//Un box finto con i suoi riquadri: ogni riquadro ha l'immagine collegata a un percorso.
function boxCon(percorsi) {
    return {
        isValid: true,
        allPageItems: percorsi.map(p => {
            const link = { filePath: p, relinkati: [], aggiornato: 0,
                relink(nuovo) { this.relinkati.push(nuovo); }, update() { this.aggiornato++; } };
            const grafica = { itemLink: link };
            return { isValid: true, constructorName: "Rectangle", graphics: { length: 1, item: () => grafica } };
        })
    };
}

//Il box selezionato della scheda, per la durata di una prova.
async function conBoxSelezionato(box, prova) {
    const salvato = schedaRef.refSelected;
    schedaRef.refSelected = { item: box };
    try {
        return await prova();
    }
    finally {
        schedaRef.refSelected = salvato;
    }
}

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- le decisioni del confronto ---- */

test("collegamento rotto e file nei Links: una sola differenza, foto da ricollegare, con il percorso nei Links", () => {
    const differenze = confronti.segnalazioniFotoCollegata(FOTO, ROTTO, true, NEI_LINKS);
    assert.deepStrictEqual(differenze, [{
        label: "680443_1_AD.psd", difference: "foto da ricollegare: 680443_1_AD.psd", tipo: "linkRotto", nomeFoto: "680443_1_AD.psd",
        percorsoNeiLinks: NEI_LINKS
    }]);
});

test("collegamento rotto e file assente: solo mancante nella cartella, mai non corrispondente", () => {
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata(FOTO, ROTTO, false, NEI_LINKS),
        [{ label: "680443_1_AD.psd", difference: "foto mancante nella cartella di lavorazione: 680443_1_AD.psd" }]);
});

test("con il collegamento buono vale la regola di sempre", () => {
    const uguale = { missing: false, mismatch: false, hash: "abc" };
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata(FOTO, uguale, false, NEI_LINKS), []);

    const diversa = { missing: false, mismatch: false, hash: "DEF" };
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata(FOTO, diversa, false, NEI_LINKS),
        [{ label: "680443_1_AD.psd", difference: "foto non corrispondente nel box: 680443_1_AD.psd" }]);

    const nonAggiornata = { missing: false, mismatch: true, hash: "ABC" };
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata(FOTO, nonAggiornata, false, NEI_LINKS).map(d => d.difference),
        ["foto non corrispondente nel box: 680443_1_AD.psd"]);

    //Incorporata o inaccessibile: niente hash e niente missing, come prima e' non corrispondente.
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata(FOTO, { missing: false, mismatch: false, hash: null }, false, NEI_LINKS).map(d => d.difference),
        ["foto non corrispondente nel box: 680443_1_AD.psd"]);
    assert.deepStrictEqual(confronti.segnalazioniFotoCollegata({ nomeFoto: "x.psd" }, { missing: false, hash: null }, false, NEI_LINKS), []);
});

test("la pre analisi chiede la presenza nei Links solo con il collegamento rotto, e porta il percorso del link", () => {
    const motore = sorgente("confronti.js");
    const ramo = motore.substring(motore.indexOf("if (checkMD5) {"), motore.indexOf("if (checkMD5) {") + 900);
    assert.match(ramo, /var fileNeiLinks = fotoCorrispondente\.missing \? await ReperimentoFoto\.esisteFile\(percorsoNeiLinks\) : false;/);
    assert.match(ramo, /confronti\.segnalazioniFotoCollegata\(foto, fotoCorrispondente, fileNeiLinks, percorsoNeiLinks\)/);
    //Il ciclo attende: non puo' essere un forEach.
    assert.match(motore, /for \(const foto of listFoto\) \{/);
    assert.match(motore, /percorsoLink: res\.percorsoLink/);

    const foto = sorgente("reperimentoFoto/reperimentoFoto.js");
    const mancante = foto.substring(foto.indexOf('if (link.status.toString() == "LINK_MISSING") {'), foto.indexOf('if (link.status.toString() == "LINK_MISSING") {') + 500);
    assert.match(mancante, /result\.percorsoLink = link\.filePath;/);
    assert.match(foto, /async esisteFile\(filePath\) \{/);
});

/* ---- la finestra della scheda ---- */

test("il collegamento rotto offre il ricollegamento ai Links, e si legge senza ripetere il nome", () => {
    const diff = confronti.segnalazioniFotoCollegata(FOTO, ROTTO, true, NEI_LINKS)[0];
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(diff), ["ricollegaLinks"]);
    assert.strictEqual(schedaRef.testoDifferenza(diff), "Foto da ricollegare");
    //Niente percorsi nella riga: all'operatore basta sapere che va ricollegata.
    assert.strictEqual(confronti.valoriDifferenza(diff), null);

    //Il file davvero assente non ha azioni.
    const assente = confronti.segnalazioniFotoCollegata(FOTO, ROTTO, false, NEI_LINKS)[0];
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(assente), []);

    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /ricollegaLinks: \["Ricollega alla cartella Links"/);
    assert.match(scheda, /else if \(azione === "ricollegaLinks"\) \{\n\s+await me\.ricollegaAllaCartellaLinks\(diff, dopoAzione\);/);
    //relink vuole l'URL file://, anche per "Usa l'immagine del server": la stringa viene respinta.
    assert.strictEqual((scheda.match(/link\.relink\(this\.urlDiPercorso\(percorso\)\);/g) || []).length, 2);
    assert.doesNotMatch(scheda, /link\.relink\(percorso\);/);
});

test("il percorso a cui ricollegare: quello della differenza, altrimenti la cartella Links piu' il nome", async () => {
    assert.strictEqual(schedaRef.percorsoNeiLinksPerRicollegare({ nomeFoto: "a.psd", percorsoNeiLinks: NEI_LINKS }), NEI_LINKS);
    await conGlobali({ percorsoLinks: "/lav/Links/" }, () => {
        assert.strictEqual(schedaRef.percorsoNeiLinksPerRicollegare({ nomeFoto: "a.psd", percorsoNeiLinks: "" }), "/lav/Links/a.psd");
        assert.strictEqual(schedaRef.percorsoNeiLinksPerRicollegare({ label: "b.psd" }), "/lav/Links/b.psd");
    });
    assert.strictEqual(schedaRef.percorsoNeiLinksPerRicollegare({ label: "" }), null);
    assert.strictEqual(schedaRef.percorsoNeiLinksPerRicollegare(null), null);
});

test("il riquadro si trova dal nome del file del link, anche se il collegamento e' rotto", async () => {
    const box = boxCon(["/altro/Links/111.psd", "/Users/altro/P2622/Links/680443_1_AD.psd"]);
    await conBoxSelezionato(box, () => {
        assert.strictEqual(schedaRef.riquadroDellaFotoCollegata("680443_1_AD.psd"), box.allPageItems[1]);
        assert.strictEqual(schedaRef.riquadroDellaFotoCollegata("nessuna.psd"), null);
        assert.strictEqual(schedaRef.riquadroDellaFotoCollegata(""), null);
    });
    await conBoxSelezionato(null, () => {
        assert.strictEqual(schedaRef.riquadroDellaFotoCollegata("680443_1_AD.psd"), null);
    });
});

test("ricollegare cambia solo il file del riquadro, con l'URL file://, poi rifa' l'analisi", async () => {
    const box = boxCon(["/Users/altro/P2622/Links/680443_1_AD.psd"]);
    const link = box.allPageItems[0].graphics.item(0).itemLink;
    const messaggi = [];
    const eventi = [];
    const diff = confronti.segnalazioniFotoCollegata(FOTO, ROTTO, true, NEI_LINKS)[0];

    const esito = await conGlobali({ messaggioUtente: (testo) => messaggi.push(testo) }, () =>
        conBoxSelezionato(box, () => schedaRef.ricollegaAllaCartellaLinks(diff, async () => { eventi.push("analisi"); })));

    assert.strictEqual(esito, true);
    //L'URL file:// del percorso nei Links, con gli spazi cosi' come sono: e' la forma che InDesign accetta.
    assert.deepStrictEqual(link.relinkati, ["file://" + NEI_LINKS]);
    assert.strictEqual(link.aggiornato, 1);
    assert.deepStrictEqual(eventi, ["analisi"]);
    assert.match(messaggi[0], /ricollegata alla cartella Links/);
});

test("senza il riquadro nel box non si ricollega niente, e lo si dice", async () => {
    const messaggi = [];
    const eventi = [];
    const diff = confronti.segnalazioniFotoCollegata(FOTO, ROTTO, true, NEI_LINKS)[0];

    const esito = await conGlobali({ messaggioUtente: (testo) => messaggi.push(testo) }, () =>
        conBoxSelezionato(boxCon(["/lav/Links/altra.psd"]), () => schedaRef.ricollegaAllaCartellaLinks(diff, async () => { eventi.push("analisi"); })));

    assert.strictEqual(esito, false);
    assert.deepStrictEqual(eventi, []);
    assert.match(messaggi[0], /non si trova nel box: non ricollegato/);
});
