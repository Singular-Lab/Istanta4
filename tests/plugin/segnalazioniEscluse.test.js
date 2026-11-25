/*
 * I20-1264: gli avvisi di impaginazione che il cliente non vuole nel bollino.
 *
 * Coopfi non vuole piu' vedere le segnalazioni sui loghi e sui bolli del box, per esempio
 * "Code CSF-008: Elemento foto_extra$Logo_FiorFiore$tipo_3 nel box BOX_STD spostato verso sinistra".
 * Il plugin di agenzia dichiara segnalazioniEscluse, con le stesse condizioni dei filtri della
 * schermata (codice e testo contenuto), e addSegnalazione non le mette fra le segnalazioni del box:
 * non arrivano al bollino, alla schermata, alla scheda ref ne' al report. Gli errori passano sempre.
 * Coopfi esclude CSF-008 e CSF-013 quando nominano foto_extra$ (loghi) o simbolo$ (bolli); la FEX-01
 * e la CSF-24 restano, per scelta dell'utente.
 *
 * pluginMiddleware.getSegnalazioniEscluse e addSegnalazione si prendono dal sorgente e si provano con
 * la configurazione vera di Coopfi e di Edro21.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");
const etichettaSegnalazioni = require("../../plugin/segnalazioni/etichetta");
const SchermataSegnalazioni = require("../../plugin/segnalazioni/schermata");

const RADICE = path.join(__dirname, "..", "..");
const customDi = (cliente) => JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json"), "utf8"));

/// Un metodo di pluginMiddleware com'e' nel sorgente, dalla sua firma alla chiusura.
function metodo(sorgente, firma) {
    const inizio = sorgente.indexOf("    " + firma + " {");
    assert.ok(inizio >= 0, firma + " non trovato in pluginMiddleware.js: il test va aggiornato");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return sorgente.substring(inizio, fine) + "\n    }";
}

/// Un middleware finto con il metodo vero e la configurazione data dal server.
function middleware(configurazione) {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const me = new Function("return {" + metodo(sorgente, "getSegnalazioniEscluse()") + "};")();
    me.callCustom = false;
    me.customPluginDB = configurazione;
    return me;
}

/// Una funzione di indexNew.js com'e' nel sorgente, dalla firma alla graffa di chiusura.
function funzioneDiIndexNew(sorgente, firma) {
    const inizio = sorgente.indexOf("function " + firma);
    assert.ok(inizio >= 0, firma + " non trovata in indexNew.js: il test va aggiornato");
    return sorgente.substring(inizio, sorgente.indexOf("\n}\n", inizio) + 2);
}

/// addSegnalazione vera, con le segnalazioni del box raccolte in una lista da leggere.
function impaginazioneDel(configurazione) {
    const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const crea = new Function("etichettaSegnalazioni", "SchermataSegnalazioni", "pluginMiddleware", "console",
        "let segnalazioniBoxImpaginato = [];\n" +
        funzioneDiIndexNew(sorgente, "addSegnalazione(") + "\n" +
        funzioneDiIndexNew(sorgente, "segnalazioneEsclusaDalCliente(") + "\n" +
        "return { addSegnalazione: addSegnalazione, delBox: () => segnalazioniBoxImpaginato };");
    const registro = [];
    const consoleFinta = { log: (m) => registro.push(m), error: (m) => registro.push(m), warn: () => {} };
    const impaginazione = crea(etichettaSegnalazioni, SchermataSegnalazioni, middleware(configurazione), consoleFinta);
    impaginazione.registro = registro;
    impaginazione.testi = () => impaginazione.delBox().map(s => s.msg);
    return impaginazione;
}

const LOGO_SPOSTATO = "Code CSF-008: Elemento foto_extra$Logo_FiorFiore$tipo_3 nel box BOX_STD spostato verso sinistra per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.";
const BOLLO_SPOSTATO = "Code CSF-008: Elemento simbolo$PREZZO_BLOCCATO$tipo_1 nel box BOX_STD spostato verso l'alto per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.";
const DESCRIZIONE_SU_LOGO = "Code CSF-013: Conflitto tra elementi nel box BOX_STD: descrizione non dovrebbe toccare foto_extra$Logo_FiorFiore$tipo_3.";
const LOGO_SU_BOLLO = "Code CSF-013: Conflitto tra elementi nel box BOX_STD: Foto_Extra$conad_piacersi$tipo_3 non dovrebbe toccare SIMBOLO$bollo_bio$tipo_2.";
const DESCRIZIONE_SPOSTATA = "Descrizione spostata poichè uscita dai limiti del box";
const DESCRIZIONE_CSF008 = "Code CSF-008: Elemento descrizione nel box BOX_STD spostato verso il basso per rientrare nei limiti della griglia. Verificare le dimensioni dell'elemento.";
const DESCRIZIONE_SU_QUANTITATIVI = "Code CSF-013: Conflitto tra elementi nel box BOX_STD: descrizione non dovrebbe toccare quantitativi.";
const FOTO_EXTRA_PARZIALE = "Code FEX-01: Logo foto_extra$BIO presente solo su 4/6 referenze del gruppo: non impaginato. Si risolve in Foto extra";
const SLOT_IN_ECCESSO = "Code CSF-24 Gruppo loghi: 4 elementi per 3 slot, foto_extra$Logo_SDB$tipo_3 in alto a destra nel box";

/* ---- la configurazione ---- */

test("Coopfi dichiara CSF-008 e CSF-013 su loghi (foto_extra$) e bolli (simbolo$)", () => {
    assert.deepStrictEqual(middleware(customDi("Coopfi")).getSegnalazioniEscluse(), [
        { codice: "CSF-008", testoContiene: "foto_extra$" },
        { codice: "CSF-008", testoContiene: "simbolo$" },
        { codice: "CSF-013", testoContiene: "foto_extra$" },
        { codice: "CSF-013", testoContiene: "simbolo$" }
    ]);
});

test("senza la chiave, o con una chiave fatta male, nessuna esclusione", () => {
    assert.deepStrictEqual(middleware(customDi("Edro21")).getSegnalazioniEscluse(), []);
    assert.deepStrictEqual(middleware({}).getSegnalazioniEscluse(), []);
    assert.deepStrictEqual(middleware(null).getSegnalazioniEscluse(), []);
    assert.deepStrictEqual(middleware({ segnalazioniEscluse: "CSF-008" }).getSegnalazioniEscluse(), []);
    //Una condizione senza codice non vale: escluderebbe qualunque segnalazione.
    assert.deepStrictEqual(middleware({ segnalazioniEscluse: [null, { testoContiene: "foto_extra$" }, { codice: " CSF-008 ", testoContiene: 3 }] }).getSegnalazioniEscluse(),
        [{ codice: "CSF-008", testoContiene: "" }]);
});

/* ---- Coopfi: cosa resta nel bollino ---- */

test("Coopfi: le CSF-008 e CSF-013 di loghi e bolli non entrano fra le segnalazioni del box", () => {
    const coopfi = impaginazioneDel(customDi("Coopfi"));
    [LOGO_SPOSTATO, BOLLO_SPOSTATO, DESCRIZIONE_SU_LOGO, LOGO_SU_BOLLO].forEach(msg => coopfi.addSegnalazione(msg, "warning", 2, true, ["CSF-008", "orange"]));

    assert.deepStrictEqual(coopfi.delBox(), []);
    //Nel registro resta che sono nate e sono state escluse.
    assert.strictEqual(coopfi.registro.filter(r => String(r).startsWith("Code IDX-207 ")).length, 4);
    assert.ok(coopfi.registro[0].includes("foto_extra$Logo_FiorFiore$tipo_3"), coopfi.registro[0]);
});

test("Coopfi: le altre segnalazioni dello stesso box restano, comprese FEX-01 e CSF-24", () => {
    const coopfi = impaginazioneDel(customDi("Coopfi"));
    coopfi.addSegnalazione(LOGO_SPOSTATO, "warning", 2, true);
    coopfi.addSegnalazione(DESCRIZIONE_SPOSTATA, "warning", 2, true, [DESCRIZIONE_SPOSTATA, "orange"], "descrizione_spostata");
    coopfi.addSegnalazione(DESCRIZIONE_CSF008, "warning", 2, true);
    coopfi.addSegnalazione(DESCRIZIONE_SU_QUANTITATIVI, "warning", 2, true);
    coopfi.addSegnalazione(FOTO_EXTRA_PARZIALE, "warning", 2, true, null, "FEX-01$guid");
    coopfi.addSegnalazione(SLOT_IN_ECCESSO, "warning", 2, true);

    assert.deepStrictEqual(coopfi.testi(), [DESCRIZIONE_SPOSTATA, DESCRIZIONE_CSF008, DESCRIZIONE_SU_QUANTITATIVI, FOTO_EXTRA_PARZIALE, SLOT_IN_ECCESSO]);
});

test("Coopfi: un errore che nomina un logo si vede sempre", () => {
    const coopfi = impaginazioneDel(customDi("Coopfi"));
    coopfi.addSegnalazione(LOGO_SPOSTATO, "error", 1, true);
    coopfi.addSegnalazione(DESCRIZIONE_SU_LOGO, "Error", 1, true);

    assert.deepStrictEqual(coopfi.testi(), [LOGO_SPOSTATO, DESCRIZIONE_SU_LOGO]);
    assert.strictEqual(etichettaSegnalazioni.daSegnalazione(coopfi.delBox()[0]).g, "error");
});

/* ---- gli altri clienti ---- */

test("Edro21, che non esclude niente, riceve tutto come prima", () => {
    const edro21 = impaginazioneDel(customDi("Edro21"));
    [LOGO_SPOSTATO, BOLLO_SPOSTATO, DESCRIZIONE_SU_LOGO].forEach(msg => edro21.addSegnalazione(msg, "warning", 2, true));

    assert.deepStrictEqual(edro21.testi(), [LOGO_SPOSTATO, BOLLO_SPOSTATO, DESCRIZIONE_SU_LOGO]);
    assert.deepStrictEqual(edro21.registro, []);
});

test("se le esclusioni non si leggono, la segnalazione entra", () => {
    const sorgente = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const crea = new Function("etichettaSegnalazioni", "SchermataSegnalazioni", "pluginMiddleware", "console",
        "let segnalazioniBoxImpaginato = [];\n" + funzioneDiIndexNew(sorgente, "addSegnalazione(") + "\n" +
        funzioneDiIndexNew(sorgente, "segnalazioneEsclusaDalCliente(") + "\n" +
        "return { addSegnalazione: addSegnalazione, delBox: () => segnalazioniBoxImpaginato };");
    const errori = [];
    const impaginazione = crea(etichettaSegnalazioni, SchermataSegnalazioni,
        { getSegnalazioniEscluse() { throw new Error("configurazione assente"); } },
        { log: () => {}, error: (m) => errori.push(m) });
    impaginazione.addSegnalazione(LOGO_SPOSTATO, "warning", 2, true);

    assert.deepStrictEqual(impaginazione.delBox().map(s => s.msg), [LOGO_SPOSTATO]);
    assert.match(errori[0], /^Code IDX-208 /);
});

/* ---- la regola, nella schermata ---- */

test("voceEsclusa: come i filtri, ma mai per gli errori e mai senza condizioni", () => {
    const condizioni = middleware(customDi("Coopfi")).getSegnalazioniEscluse();
    const voce = (msg, tipo) => etichettaSegnalazioni.daSegnalazione({ msg: msg, typeMessage: tipo });

    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(LOGO_SPOSTATO, "warning"), condizioni), true);
    //Le maiuscole non contano.
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(LOGO_SU_BOLLO, "warning"), condizioni), true);
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(LOGO_SPOSTATO, "error"), condizioni), false);
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(DESCRIZIONE_SPOSTATA, "warning"), condizioni), false);
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(LOGO_SPOSTATO, "warning"), []), false);
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(voce(LOGO_SPOSTATO, "warning"), undefined), false);
    assert.strictEqual(SchermataSegnalazioni.voceEsclusa(null, condizioni), false);
});
