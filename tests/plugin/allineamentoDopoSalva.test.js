/*
 * I20-1140: il box allineato dopo il Salva modifiche della scheda ref.
 *
 * Dopo il salvataggio di primarie e secondarie il Plugin riscarica la scheda e la confronta col box:
 * tipo di box cambiato, reimpagina; dati non piu' allineati, chiede "Aggiorno il box?". Il Salva della
 * descrizione no: scriveva la descrizione nel box e ricaricava la scheda, e un logo che la descrizione
 * nuova fa entrare o uscire (il logo attributo italiano di Edro21, per esempio) restava solo fra le
 * differenze. Ora dopo il Salva registrato da Istanta c'e' lo stesso controllo.
 *
 * allineaBoxDopoSalvataggioScheda e' un membro di plugin/schedaRef.js: qui gira con la scheda, le
 * finestre e il caricamento finti. Il flusso del Salva si controlla sul sorgente, come in
 * metaDescrizione.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

const DOMANDA = "I dati del box non sono piu' allineati alla scheda. Aggiorno il box?";

function record(codiceBox) {
    return { recordInTracciato: { "Referenza.Codice": "32711", StatoSelezione: 1, codiceBox: codiceBox } };
}

//Il logo attributo italiano che la descrizione nuova chiede e che nel box non c'e', come lo segnala confronti.js.
const LOGO_MANCANTE = {
    label: "attributo_italiano", difference: "foto extraAuto mancante nel box: attributo_italiano",
    tipo: "extraMancante", famiglia: "extraAuto", sigla: "attributo_italiano"
};

/// La scheda finta: prima del Salva il dato ha codicePrima, riscaricata ha codiceDopo e il confronto
/// col box da' differenze. ricarica: true, false (non riscaricata) o "errore" (eccezione).
async function conScheda(opzioni, prova) {
    const { codicePrima = "BOX41", codiceDopo = "BOX41", differenze = [], ricarica = true, risposta = false } = opzioni;
    const chiamate = { ricariche: [], confronti: 0, domande: [], reimpaginazioni: 0, caricamento: [], messaggi: [] };

    const scheda = Object.create(schedaRef);
    scheda.schedeRefDati = [record(codicePrima)];
    scheda.ricaricaDatiScheda = async (codiceGruppo, idRec) => {
        chiamate.ricariche.push([codiceGruppo, idRec]);
        if (ricarica === "errore") {
            throw new Error("rete giu'");
        }
        if (ricarica) {
            scheda.schedeRefDati = [record(codiceDopo)];
        }
        return ricarica;
    };
    scheda.differenzeDatiNelBox = async () => {
        chiamate.confronti++;
        return differenze;
    };
    scheda.applicaReimpaginazione = async () => {
        chiamate.reimpaginazioni++;
    };

    const salvate = { showLoading: global.showLoading, hideLoading: global.hideLoading, messaggioUtente: global.messaggioUtente, Modali: global.Modali };
    global.showLoading = (testo) => chiamate.caricamento.push("mostra: " + testo);
    global.hideLoading = () => chiamate.caricamento.push("nascondi");
    global.messaggioUtente = (testo) => chiamate.messaggi.push(testo);
    global.Modali = { confirm: async (testo) => { chiamate.domande.push(testo); return risposta; } };
    const errori = [];
    const erroreOriginale = console.error;
    console.error = (...parti) => errori.push(parti.join(" "));
    try {
        const rifatto = await scheda.allineaBoxDopoSalvataggioScheda({ id: 7 }, codicePrima, "32711,32712", 4410);
        await prova(rifatto, chiamate, errori);
    }
    finally {
        console.error = erroreOriginale;
        Object.entries(salvate).forEach(([nome, valore]) => {
            if (valore === undefined) {
                delete global[nome];
            }
            else {
                global[nome] = valore;
            }
        });
    }
}

/* ---- il controllo dopo il Salva ---- */

test("la descrizione fa entrare un logo: si chiede, e accettando il box si reimpagina", async () => {
    await conScheda({ differenze: [LOGO_MANCANTE], risposta: true }, (rifatto, chiamate) => {
        assert.deepStrictEqual(chiamate.ricariche, [["32711,32712", 4410]], "si riscarica la scheda del gruppo, per il record del box");
        assert.deepStrictEqual(chiamate.caricamento, ["mostra: Aggiornamento della scheda in corso...", "nascondi"]);
        assert.strictEqual(chiamate.confronti, 1);
        assert.deepStrictEqual(chiamate.domande, [DOMANDA]);
        assert.strictEqual(chiamate.reimpaginazioni, 1);
        assert.strictEqual(rifatto, true, "il box e' stato rifatto: il Salva non ricarica la scheda");
    });
});

test("rispondendo no il box non si tocca e la scheda si ricarica come prima", async () => {
    await conScheda({ differenze: [LOGO_MANCANTE], risposta: false }, (rifatto, chiamate) => {
        assert.deepStrictEqual(chiamate.domande, [DOMANDA]);
        assert.strictEqual(chiamate.reimpaginazioni, 0);
        assert.strictEqual(rifatto, false);
    });
});

test("dati ancora allineati: nessuna domanda", async () => {
    await conScheda({ differenze: [] }, (rifatto, chiamate) => {
        assert.strictEqual(chiamate.confronti, 1);
        assert.deepStrictEqual(chiamate.domande, []);
        assert.strictEqual(chiamate.reimpaginazioni, 0);
        assert.strictEqual(rifatto, false);
    });
});

test("tipo di box cambiato: si reimpagina senza chiedere e senza confrontare", async () => {
    await conScheda({ codicePrima: "BOX41", codiceDopo: "BOX42", differenze: [LOGO_MANCANTE] }, (rifatto, chiamate) => {
        assert.strictEqual(chiamate.confronti, 0);
        assert.deepStrictEqual(chiamate.domande, []);
        assert.strictEqual(chiamate.reimpaginazioni, 1);
        assert.ok(chiamate.messaggi.some(m => m.includes("BOX41 -> BOX42")), chiamate.messaggi.join(" | "));
        assert.strictEqual(rifatto, true);
    });
});

test("se la scheda non si riscarica non si confronta e non si chiede niente", async () => {
    await conScheda({ ricarica: false, differenze: [LOGO_MANCANTE] }, (rifatto, chiamate) => {
        assert.strictEqual(chiamate.confronti, 0);
        assert.deepStrictEqual(chiamate.domande, []);
        assert.strictEqual(chiamate.reimpaginazioni, 0);
        assert.deepStrictEqual(chiamate.caricamento, ["mostra: Aggiornamento della scheda in corso...", "nascondi"]);
        assert.strictEqual(rifatto, false);
    });
});

test("un errore resta in console con SRF-132, il caricamento si chiude e il Salva prosegue", async () => {
    await conScheda({ ricarica: "errore" }, (rifatto, chiamate, errori) => {
        assert.strictEqual(rifatto, false);
        assert.deepStrictEqual(chiamate.caricamento, ["mostra: Aggiornamento della scheda in corso...", "nascondi"]);
        assert.strictEqual(errori.filter(e => e.startsWith("Code SRF-132")).length, 1, errori.join(" | "));
        assert.strictEqual(chiamate.reimpaginazioni, 0);
    });
});

/* ---- il Salva modifiche, sul sorgente ---- */

function salvaModifiche() {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    salvaModifiche(schedaRef, codice, box, meccanica, page) {");
    const fine = sorgente.indexOf("    preparaCambioStrutturale() {", inizio);
    assert.ok(inizio > 0 && fine > inizio, "salvaModifiche non trovata in schedaRef.js");
    return sorgente.substring(inizio, fine);
}

test("il codice del box si legge sul dato di prima, prima di mandare il salvataggio", () => {
    const salva = salvaModifiche();
    const lettura = salva.indexOf("const codiceBoxPrecedente = this.codiceBoxDellaScheda(this.schedeRefDati);");
    assert.ok(lettura > 0);
    assert.ok(lettura < salva.indexOf('xhrSalva.send("Revisore/salvaRefFromIndd"'));
    assert.ok(lettura < salva.indexOf("let applicaCambiStrutturali = function () {"));
});

test("il controllo parte solo dopo un salvataggio registrato da Istanta", () => {
    const salva = salvaModifiche();
    assert.strictEqual(salva.split("salvatoSuIstanta = true;").length - 1, 1, "un solo punto lo accende");
    assert.match(salva, /let salvatoSuIstanta = false;/);
    assert.match(salva, /if \(objResult\.esito\) \{\s*salvatoSuIstanta = true;/);
    //Senza Istanta (scheda non editabile) si applica e basta: il dato non e' cambiato.
    assert.match(salva, /else \{\s*applicaCambiStrutturali\(\);\s*\}/);
});

test("dopo la descrizione nel box, prima di ricaricare la scheda; non nel cambio strutturale, che reimpagina gia'", () => {
    const salva = salvaModifiche();
    const strutturale = salva.indexOf("me.preparaCambioStrutturale();");
    const descrizione = salva.indexOf("TestoTag.applicaTagStringToInndTextFrame(field, descr, box.geometricBounds);");
    const controllo = salva.indexOf("me.allineaBoxDopoSalvataggioScheda(box, codiceBoxPrecedente, dna.codice_gruppo, req.idRec)");
    const ricarica = salva.lastIndexOf("me.initSchedaRef(me.refSelected);");

    assert.ok(strutturale > 0 && descrizione > strutturale && controllo > descrizione && ricarica > controllo,
        "ordine: cambio strutturale (ramo a parte), descrizione nel box, controllo, ricarica della scheda");
    assert.strictEqual(salva.split("allineaBoxDopoSalvataggioScheda(").length - 1, 1);
    //Box rifatto: la scheda segue il box nuovo e si ricarica su quello; altrimenti si ricarica come prima.
    assert.match(salva, /if \(salvatoSuIstanta\) \{\s*me\.allineaBoxDopoSalvataggioScheda\([^)]*\)\.then\(rifatto => \{\s*if \(rifatto && me\.boxReimpaginato != null && me\.boxReimpaginato\.isValid && typeof me\.seguiBoxRicostruito === "function"\) \{\s*me\.seguiBoxRicostruito\(me\.boxReimpaginato\);\s*\}\s*me\.initSchedaRef\(me\.refSelected\);\s*\}\);\s*return;\s*\}/);
});

test("appena Istanta conferma, le caselle non sono piu' modificate: prima del controllo del box", () => {
    const salva = salvaModifiche();
    const conferma = salva.indexOf("salvatoSuIstanta = true;");
    const salvati = salva.indexOf("this.editRefFieldController.segnaComeSalvati();");
    const applica = salva.indexOf("applicaCambiStrutturali();", conferma);
    assert.ok(conferma > 0 && salvati > conferma && applica > salvati, "ordine: conferma, caselle salvate, controllo");
});

test("la reimpaginazione ricorda il box nuovo che seleziona, e lo azzera all'inizio", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async applicaReimpaginazione(){");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
    assert.match(corpo, /^    async applicaReimpaginazione\(\)\{\s*(\/\/[^\n]*\n\s*)*this\.boxReimpaginato = null;/);
    assert.match(corpo, /Utility\.selezionaBox\(esito != null \? \(esito\.boxFinale \|\| esito\.boxAggiunto\) : null\);\s*this\.boxReimpaginato = esito != null \? \(esito\.boxFinale \|\| esito\.boxAggiunto \|\| null\) : null;/);
});

/* ---- le caselle salvate ---- */

const InputEditController = require("../../plugin/InputEditController.js");

/// Un campo come lo usa il controller tramite jQuery: valore, attributi, stile e classi.
function casella(valore, iniziale) {
    return { valore, attributi: { defaultvalue: iniziale }, stile: { "background-color": "red" }, classi: new Set(["textModified"]) };
}

function jQueryFinto(campo) {
    return {
        val: () => campo.valore,
        attr(nome, valore) { if (valore === undefined) { return campo.attributi[nome]; } campo.attributi[nome] = valore; return this; },
        css(nome, valore) { campo.stile[nome] = valore; return this; },
        removeClass(nome) { campo.classi.delete(nome); return this; }
    };
}

test("segnaComeSalvati: valore attuale come partenza, caselle bianche, niente piu' modificato", () => {
    const salvato = global.$;
    global.$ = jQueryFinto;
    try {
        const nome = casella("Origine Italiana", "Prodotto Italiano");
        const tipo = casella("Filiera Controllata", "Filiera Controllata");
        const controller = Object.create(InputEditController.prototype);
        controller.datasource = { descrizione: { lista: [nome, tipo], modificato: true }, campo_offerta: { lista: [], modificato: true }, vuota: null };

        controller.segnaComeSalvati();

        for (const c of [nome, tipo]) {
            assert.strictEqual(c.attributi.defaultvalue, c.valore);
            assert.strictEqual(c.stile["background-color"], "white");
            assert.strictEqual(c.classi.has("textModified"), false);
        }
        assert.strictEqual(controller.datasource.descrizione.modificato, false);
        assert.strictEqual(controller.datasource.campo_offerta.modificato, false);

        //Senza caselle non succede niente.
        const vuoto = Object.create(InputEditController.prototype);
        vuoto.datasource = {};
        vuoto.segnaComeSalvati();
    }
    finally {
        if (salvato === undefined) {
            delete global.$;
        }
        else {
            global.$ = salvato;
        }
    }
});
