/*
 * I20-1083: le azioni sul box dalla scheda aperta in vista controllata.
 *
 * La scheda ref aperta dal Report Integrita' (o da "Vai al box" della schermata delle segnalazioni)
 * non offriva le azioni sul box. Ora le offre, ma l'azione scelta cambia il dato come sempre e poi
 * non impagina il box nuovo: la scheda si ricarica, le segnalazioni si ricalcolano sul box com'e',
 * e la selezione di InDesign resta sul box, cosi' la vigilanza non chiude la scheda.
 *
 * E con la finestra delle differenze aperta, chiudere la scheda (anche cliccando fuori dal box)
 * chiude anche la finestra: prima restava sopra il report che tornava.
 *
 * schedaRef.js si carica sotto Node: le regole si provano davvero, InDesign si finge, il resto
 * si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

//Le globali che il Plugin trova in InDesign, finte per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

//Metodi e stato della scheda sostituiti per la durata di una prova.
function conScheda(sostituti, prova) {
    const salvati = {};
    Object.keys(sostituti).forEach(k => { salvati[k] = schedaRef[k]; schedaRef[k] = sostituti[k]; });
    try {
        return prova();
    }
    finally {
        Object.assign(schedaRef, salvati);
    }
}

/* ---- le azioni ci sono ---- */

test("la scheda in vista controllata offre le azioni sul box, come la scheda normale", () => {
    conScheda({ apertaDalReport: true }, () => {
        assert.strictEqual(schedaRef.inVistaControllata(), true);
        assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), true);
    });
    conScheda({ apertaDalReport: false }, () => {
        assert.strictEqual(schedaRef.inVistaControllata(), false);
        assert.strictEqual(schedaRef.mostraAzioniStrutturaliInEdit(), true);
    });
});

/* ---- dopo l'azione ---- */

function inDesignFinto(eventi) {
    const app = {};
    let selezione = [];
    Object.defineProperty(app, "selection", {
        get: () => selezione,
        set: (valore) => { selezione = valore; eventi.push("seleziona " + (valore[0] && valore[0].nome)); }
    });
    return {
        app: app,
        hideLoading: () => eventi.push("fine attesa"),
        indesignEvents: { setBusy: (v) => eventi.push("busy " + v) },
        messaggioUtente: (testo) => eventi.push("messaggio: " + testo)
    };
}

test("in vista controllata, dopo l'azione: niente box nuovo, scheda ricaricata e box riselezionato", () => {
    const eventi = [];
    const box = { nome: "box 123", isValid: true };
    const ref = { item: box };
    conGlobali(inDesignFinto(eventi), () => conScheda({
        refSelected: ref,
        dimenticaSegnalazioni: () => eventi.push("dimentica segnalazioni"),
        initSchedaRef: (r) => eventi.push("ricarica scheda " + (r === ref))
    }, () => {
        schedaRef.aggiornaDopoAzioneInVistaControllata();
    }));

    assert.deepStrictEqual(eventi, [
        "fine attesa",
        "busy false",
        "seleziona box 123",
        "messaggio: Azione registrata: il box non e' stato reimpaginato, le segnalazioni sono state ricalcolate",
        //La preanalisi della scheda si rifa' solo se le segnalazioni in memoria sono dimenticate.
        "dimentica segnalazioni",
        "ricarica scheda true",
        "seleziona box 123"
    ]);
});

test("un box non piu' valido non si riseleziona, e non si rompe niente", () => {
    const eventi = [];
    conGlobali(inDesignFinto(eventi), () => {
        assert.strictEqual(schedaRef.riselezionaBox({ nome: "vecchio", isValid: false }), false);
        assert.strictEqual(schedaRef.riselezionaBox(null), false);
        assert.strictEqual(schedaRef.riselezionaBox({ nome: "buono", isValid: true }), true);
    });
    assert.deepStrictEqual(eventi, ["seleziona buono"]);
});

test("il salvataggio dell'azione in vista controllata si ferma prima di impaginare, anche se la ref esce", () => {
    const scheda = sorgente("schedaRef.js");
    const inizio = scheda.indexOf("    salvaCambioStrutturaleDo(params) {");
    assert.notStrictEqual(inizio, -1);
    const salva = scheda.substring(inizio, scheda.indexOf("\n    leggiCampoAddestramentoDellaRef(", inizio));

    const esito = salva.indexOf("if (objResult.esito) {");
    const ramo = salva.indexOf("if (me.inVistaControllata()) {");
    const impagina = salva.indexOf("await impaginaBox(");
    const rimuovi = salva.indexOf("box.remove();");
    assert.ok(esito > 0 && ramo > esito && impagina > ramo && rimuovi > ramo);
    assert.match(salva, /if \(me\.inVistaControllata\(\)\) \{\s*me\.aggiornaDopoAzioneInVistaControllata\(\);\s*return;\s*\}/);
    //Un errore del server resta un errore: il ramo sta dentro l'esito positivo.
    assert.match(salva, /else \{\s*messaggioUtente\("Code SRF-64 Errore durante il salvataggio delle modifiche: "/);
});

/* ---- la finestra delle differenze ---- */

function jQueryFinto(popupAperto, eventi) {
    return (selettore) => ({
        length: selettore === "#popup" ? (popupAperto ? 1 : 0) : 1,
        trigger: (evento) => eventi.push(selettore + " " + evento)
    });
}

test("chiudere la scheda chiude anche la finestra delle differenze aperta, con la sua X", () => {
    const eventi = [];
    conGlobali({ $: jQueryFinto(true, eventi) }, () => {
        assert.strictEqual(schedaRef.chiudiFinestraDifferenze(), true);
    });
    assert.deepStrictEqual(eventi, ["#popupCloseButton click"]);
});

test("senza finestra aperta non si preme niente", () => {
    const eventi = [];
    conGlobali({ $: jQueryFinto(false, eventi) }, () => {
        assert.strictEqual(schedaRef.chiudiFinestraDifferenze(), false);
    });
    assert.deepStrictEqual(eventi, []);
});

test("la scheda dal report (e dalle segnalazioni) chiude la finestra per prima cosa, prima di svuotarsi", () => {
    const report = sorgente("reportIntegrita/reportIntegrita.js");
    const inizio = report.indexOf("    _terminaSchedaDalReport() {");
    assert.notStrictEqual(inizio, -1);
    const termina = report.substring(inizio, report.indexOf("\n    },\n", inizio));
    const chiudi = termina.indexOf("schedaRef.chiudiFinestraDifferenze();");
    assert.ok(chiudi > 0 && chiudi < termina.indexOf("schedaRef.svuotaRef();"));

    //La schermata delle segnalazioni passa dalla stessa chiusura, e si riattacca dopo: la sua finestra
    //non e' nel documento quando si chiude quella delle differenze.
    const schermata = sorgente("segnalazioni/schermata.js");
    const chiudiScheda = schermata.substring(schermata.indexOf("    chiudiScheda() {"), schermata.indexOf("    _evidenziaBox("));
    assert.ok(chiudiScheda.indexOf("ReportIntegrita._terminaSchedaDalReport();") < chiudiScheda.indexOf('$("body").append(stato.popup);'));
});
