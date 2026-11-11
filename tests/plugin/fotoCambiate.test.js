/*
 * I20-1217: le foto cambiate dal sync del pacchetto foto, nella schermata delle segnalazioni.
 *
 * Dopo un sync di qualche decina di foto l'operatore Coop doveva aprire Foto P/S box per box e cercare
 * il messaggio giallo. I casi sono due: la ref ha una foto con un nome nuovo che nel box non c'e' ("la
 * foto non risulta impaginata"), o il file in Links e' stato sostituito con lo stesso nome e il
 * collegamento InDesign non e' aggiornato, LINK_OUT_OF_DATE ("la foto impaginata e' da ricollegare").
 * Ora, per il cliente che lo dichiara (segnalaFotoCambiate), la schermata delle segnalazioni ha in
 * cima la sezione "Foto cambiate", letta dal documento, dalla lista della lavorazione e da Links, con
 * "Vai al box" e "Aggiorna"; a fine pacchetto completo il Plugin riscarica il tracciato e dice quante sono.
 *
 * schermata.js si carica sotto Node: il documento, i collegamenti e i box sono finti. pluginMiddleware
 * non si carica: il getter si prende dal sorgente. reperimentoFoto.js si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const SchermataSegnalazioni = require("../../plugin/segnalazioni/schermata");

const RADICE = path.join(__dirname, "..", "..");
const customDi = (cliente) => JSON.parse(fs.readFileSync(
    path.join(RADICE, "Istanta/wwwroot/external_source/" + cliente + "/SourceCustomPlugin.json"), "utf8").replace(/^﻿/, ""));

/// Un box finto su una pagina, con il suo DNA.
function boxFinto(id, pagina, codiceGruppo, idRec) {
    return { id: id, label: "BOX12", parentPage: { name: pagina }, dna: { codice_gruppo: codiceGruppo, idRec: idRec }, allPageItems: [] };
}

/// Un collegamento finto: il file, il suo stato e il riquadro (con l'etichetta) dentro il box.
function collegamento(nome, stato, etichetta, box) {
    const rettangolo = { label: etichetta, box: box };
    box.allPageItems.push(rettangolo);
    return { name: nome, status: { toString: () => stato }, parent: { parent: rettangolo } };
}

function documentoCon(collegamenti) {
    return { links: { length: collegamenti.length, item: (i) => collegamenti[i] } };
}

/// Le globali che schermata.js usa: Utility per il box e il DNA, pluginMiddleware per le etichette
/// delle foto e per la chiave del cliente.
function conGlobali(opzioni, fn) {
    const prima = { Utility: global.Utility, pluginMiddleware: global.pluginMiddleware, messaggioUtente: global.messaggioUtente, docInLavorazione: global.docInLavorazione };
    const messaggi = [];
    global.Utility = {
        getBoxFromElementOfBox: (rettangolo) => rettangolo.box,
        getDnaOfBox: (box) => box.dna,
        eUnClone: (etichetta) => etichetta.includes("_clone")
    };
    global.pluginMiddleware = {
        getCampo: (nome) => ({ nomeFotoPrimaria: "immagine", nomeFotoSecondaria: "foto_secondaria" })[nome] ?? null,
        getSegnalaFotoCambiate: () => opzioni.attiva === true
    };
    global.messaggioUtente = (testo, tipo) => messaggi.push({ testo, tipo });
    global.docInLavorazione = opzioni.documento ?? null;
    try {
        return fn(messaggi);
    }
    finally {
        Object.keys(prima).forEach(k => { if (prima[k] === undefined) { delete global[k]; } else { global[k] = prima[k]; } });
    }
}

const BOX_4 = boxFinto(101, "4", "2437584", "55");
const BOX_2 = boxFinto(102, "2", "6771109,5062150", "66");

/// I record di un gruppo nella lista della lavorazione, uno per ref: [idRec, codice, foto, stato].
/// Lo stato e' StatoSelezione: 1 primaria, 2 secondaria, 3 non selezionata.
function recordsDelGruppo(gruppo, refs) {
    return refs.map(([idRec, codice, foto, stato]) => ({
        recordInTracciato: { idRec: idRec, "Scatto.CodiceGruppo": gruppo, "Referenza.Codice": codice, "Foto.Nome": foto, StatoSelezione: stato }
    }));
}

/// Il record di un box di una ref sola, o di un gruppo con la primaria e le secondarie [codice, foto].
function recordDelBox(idRec, codicePrimaria, fotoPrimaria, secondarie = []) {
    const gruppo = [codicePrimaria].concat(secondarie.map(s => s[0])).join(",");
    return recordsDelGruppo(gruppo, [[idRec, codicePrimaria, fotoPrimaria, 1]]
        .concat(secondarie.map((s, i) => [String(Number(idRec) * 100 + i + 1), s[0], s[1], 2])));
}

test("una foto primaria o secondaria con il collegamento non aggiornato e' una foto cambiata", () => {
    const documento = documentoCon([
        collegamento("2437584_1_AD.psd", "LINK_OUT_OF_DATE", "immagine$2437584", BOX_4),
        collegamento("5062150_1_AD.psd", "LINK_OUT_OF_DATE", "foto_secondaria$5062150", BOX_2)
    ]);
    conGlobali({ attiva: true }, () => {
        const righe = SchermataSegnalazioni.fotoCambiateDelDocumento(documento);
        assert.deepStrictEqual(righe.map(r => [r.tipo, r.foto, r.pagina, r.codiceGruppo, r.idRec, r.codice]), [
            ["stessoNome", "5062150_1_AD.psd", "2", "6771109,5062150", "66", "5062150"],
            ["stessoNome", "2437584_1_AD.psd", "4", "2437584", "55", "2437584"]
        ]);
        //Per "Vai al box" e "Aggiorna" servono il box e il riquadro veri.
        assert.strictEqual(righe[1].box, BOX_4);
        assert.strictEqual(righe[1].rettangolo.label, "immagine$2437584");
    });
});

test("foto aggiornate, collegamenti rotti, foto extra e cloni non sono foto cambiate", () => {
    BOX_4.allPageItems = [];
    const documento = documentoCon([
        collegamento("2437584_1_AD.psd", "LINK_NORMAL", "immagine$2437584", BOX_4),
        collegamento("2437584_2_AD.psd", "LINK_MISSING", "foto_secondaria$2437584", BOX_4),
        collegamento("logo_coop.psd", "LINK_OUT_OF_DATE", "foto_extra$logo_coop$tipo_3", BOX_4),
        collegamento("2437584_1_AD.psd", "LINK_OUT_OF_DATE", "immagine_clone$2437584", BOX_4),
        collegamento("sfondo.psd", "LINK_OUT_OF_DATE", "", BOX_4)
    ]);
    conGlobali({ attiva: true }, () => {
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento), []);
    });
});

test("un collegamento che non si legge non ferma gli altri", () => {
    const rotto = { get status() { throw new Error("oggetto non valido"); } };
    const documento = documentoCon([rotto, collegamento("2437584_1_AD.psd", "LINK_OUT_OF_DATE", "immagine$2437584", BOX_4)]);
    const errore = console.error;
    console.error = () => {};
    try {
        conGlobali({ attiva: true }, () => {
            assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento).map(r => r.foto), ["2437584_1_AD.psd"]);
        });
    }
    finally {
        console.error = errore;
    }
});

test("la foto del dato con un nome nuovo, gia' in Links, e' una foto cambiata: come 'la foto non risulta impaginata'", () => {
    const box = boxFinto(201, "7", "2437584,2437590", "88");
    const documento = documentoCon([
        collegamento("2437584_1_AD.psd", "LINK_NORMAL", "immagine$2437584", box),
        collegamento("2437590_1_AD.psd", "LINK_NORMAL", "foto_secondaria$2437590", box)
    ]);
    const records = recordDelBox("88", "2437584", "2437584_2_AD.psd", [["2437590", "2437590_1_AD.psd"]]);
    conGlobali({ attiva: true }, () => {
        const righe = SchermataSegnalazioni.fotoCambiateDelDocumento(documento, records, new Set(["2437584_2_AD.psd", "2437590_1_AD.psd"]));
        assert.deepStrictEqual(righe.map(r => [r.tipo, r.foto, r.fotoNelBox, r.codice, r.pagina, r.codiceGruppo]), [
            ["nomeNuovo", "2437584_2_AD.psd", "2437584_1_AD.psd", "2437584", "7", "2437584,2437590"]
        ]);
        //"Aggiorna" lascia scegliere il riquadro a FotoPlacer, dal codice della ref.
        assert.strictEqual(righe[0].rettangolo, null);
        assert.strictEqual(righe[0].box, box);
    });
});

test("il nome nuovo non si segnala se il file non e' in Links, se il box ha gia' la foto, o senza lista", () => {
    const box = boxFinto(202, "7", "2437584", "89");
    const documento = documentoCon([collegamento("2437584_1_AD.psd", "LINK_NORMAL", "immagine$2437584", box)]);
    conGlobali({ attiva: true }, () => {
        const nuova = recordDelBox("89", "2437584", "2437584_2_AD.psd");
        //Il file non e' ancora scaricato: c'e' gia' il pulsante di download in Foto P/S.
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, nuova, new Set(["altro.psd"])), []);
        //La cartella Links non si e' letta, o la lista non c'e'.
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, nuova, null), []);
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, [], new Set(["2437584_2_AD.psd"])), []);
        //Il box ha gia' la foto del dato.
        const uguale = recordDelBox("89", "2437584", "2437584_1_AD.psd");
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, uguale, new Set(["2437584_1_AD.psd"])), []);
        //Il box non ha un record nella lista.
        const altroBox = recordDelBox("90", "2437584", "2437584_2_AD.psd");
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, altroBox, new Set(["2437584_2_AD.psd"])), []);
    });
});

test("un box con la nofoto e una foto nel dato ha la riga, con la nofoto come foto nel box", () => {
    const box = boxFinto(203, "3", "2437584", "91");
    const documento = documentoCon([collegamento("nofoto.png", "LINK_NORMAL", "immagine$2437584", box)]);
    conGlobali({ attiva: true }, () => {
        const righe = SchermataSegnalazioni.fotoCambiateDelDocumento(documento, recordDelBox("91", "2437584", "2437584_1_AD.psd"), new Set(["2437584_1_AD.psd"]));
        assert.deepStrictEqual(righe.map(r => [r.foto, r.fotoNelBox]), [["2437584_1_AD.psd", "nofoto.png"]]);
    });
});

test("le foto previste dal dato sono quelle delle ref selezionate del gruppo, come in Foto P/S", () => {
    const records = recordDelBox("55", "2437584", "2437584_1_AD.psd", [["2437590", "2437590_1_AD.psd"], ["2437591", ""]]);
    assert.deepStrictEqual(SchermataSegnalazioni.fotoPrevisteDelBox(records, "55"), [
        { nomeFoto: "2437584_1_AD.psd", codice: "2437584" },
        { nomeFoto: "2437590_1_AD.psd", codice: "2437590" }
    ]);
    assert.deepStrictEqual(SchermataSegnalazioni.fotoPrevisteDelBox(records, "56"), []);
    assert.deepStrictEqual(SchermataSegnalazioni.fotoPrevisteDelBox(records, null), []);
    assert.deepStrictEqual(SchermataSegnalazioni.fotoPrevisteDelBox(null, "55"), []);
});

test("box linea: il DNA punta a una ref non selezionata, e le ref non selezionate non danno righe", () => {
    //Il caso della prova dell'operatore: il BOX_LINEA di pagina 17 ha nel DNA il record del 7714852,
    //che nel gruppo ha stato 3. La sua foto non va nel box, e Foto P/S non la segnala.
    const gruppo = "7714851,7714852,7714856,7714858,7714862";
    const records = recordsDelGruppo(gruppo, [
        ["89986", "7714852", "8008731005631.jpg", 3],
        ["89987", "7714856", "8008731005686.jpg", 2],
        ["89989", "7714858", "8008731005594.jpg", 1],
        ["89991", "7714862", "8008731005716.jpg", 2],
        ["89992", "7714851", "8008731005648.jpg", 3]
    ]);
    assert.deepStrictEqual(SchermataSegnalazioni.fotoPrevisteDelBox(records, "89986").map(p => p.codice), ["7714856", "7714858", "7714862"]);

    const box = boxFinto(204, "17", gruppo, "89986");
    const documento = documentoCon([
        collegamento("8008731005686.jpg", "LINK_NORMAL", "foto_secondaria$7714856", box),
        collegamento("8008731005594.jpg", "LINK_NORMAL", "immagine$7714858", box),
        collegamento("8008731005716.jpg", "LINK_NORMAL", "foto_secondaria$7714862", box)
    ]);
    const tutti = new Set(["8008731005631.jpg", "8008731005686.jpg", "8008731005594.jpg", "8008731005716.jpg", "8008731005648.jpg"]);
    conGlobali({ attiva: true }, () => {
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, records, tutti), []);
        //Se cambia la foto della primaria, la riga c'e', con la foto che il box ha ancora.
        records[2].recordInTracciato["Foto.Nome"] = "8008731005594_v2.jpg";
        tutti.add("8008731005594_v2.jpg");
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, records, tutti).map(r => [r.foto, r.fotoNelBox, r.codice]),
            [["8008731005594_v2.jpg", "8008731005594.jpg", "7714858"]]);
    });
});

test("il testo della riga dice cosa e' cambiato", () => {
    assert.strictEqual(SchermataSegnalazioni.testoCambio({ tipo: "nomeNuovo", foto: "b.psd", fotoNelBox: "a.psd" }), "nel box c'e' a.psd, il dato vuole b.psd");
    assert.strictEqual(SchermataSegnalazioni.testoCambio({ tipo: "nomeNuovo", foto: "b.psd", fotoNelBox: null }), "il dato vuole b.psd, che nel box non c'e'");
    assert.match(SchermataSegnalazioni.testoCambio({ tipo: "stessoNome", foto: "a.psd" }), /^file sostituito/);
});

test("lo stesso box trovato da piu' collegamenti si legge una volta: id una volta per collegamento, DNA una volta per box", () => {
    //Prima ogni collegamento confrontava il suo id con quello di ogni box gia' trovato: migliaia di
    //chiamate a InDesign e circa 3 secondi a ogni cambio di linguetta.
    let letture = { id: 0, dna: 0 };
    const boxContati = [];
    for (let n = 0; n < 20; n++) {
        const box = { label: "BOX12", parentPage: { name: String(n + 1) }, dna: { codice_gruppo: String(1000 + n), idRec: String(n) }, allPageItems: [] };
        Object.defineProperty(box, "id", { get() { letture.id++; return 500 + n; } });
        boxContati.push(box);
    }
    const collegamenti = [];
    boxContati.forEach((box, n) => {
        collegamenti.push(collegamento(n + "_1.psd", "LINK_OUT_OF_DATE", "immagine$" + (1000 + n), box));
        collegamenti.push(collegamento(n + "_2.psd", "LINK_OUT_OF_DATE", "foto_secondaria$" + (2000 + n), box));
        collegamenti.push(collegamento(n + "_3.psd", "LINK_NORMAL", "foto_secondaria$" + (3000 + n), box));
    });
    conGlobali({ attiva: true }, () => {
        const getDna = global.Utility.getDnaOfBox;
        global.Utility.getDnaOfBox = (box) => { letture.dna++; return getDna(box); };
        const righe = SchermataSegnalazioni.fotoCambiateDelDocumento(documentoCon(collegamenti), [], null);
        assert.strictEqual(righe.length, 40);
        assert.strictEqual(letture.id, collegamenti.length, "l'id del box si legge una volta per collegamento");
        assert.strictEqual(letture.dna, boxContati.length, "il DNA si legge una volta per box");
        assert.strictEqual(SchermataSegnalazioni.testoFotoCambiate(righe), "40 foto cambiate in 20 box");
    });
});

test("cambiare linguetta ridisegna dall'ultima lettura, senza rileggere il documento", () => {
    const sorgente = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
    const corpoDi = (firma) => {
        const inizio = sorgente.indexOf("    " + firma + " {");
        assert.ok(inizio >= 0, firma + " non trovato");
        return sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
    };
    //I pulsanti della scelta (Tutte, filtri del cliente, Foto cambiate) chiamano ridisegna, non riempi.
    const scelta = corpoDi("_sceltaFiltro(elenco, filtri, fotoCambiate = 0)");
    assert.ok(scelta.includes("SchermataSegnalazioni.ridisegna(elenco);"));
    assert.ok(!scelta.includes("SchermataSegnalazioni.riempi(elenco);"));
    //_disegna tiene la lettura e la riusa se gliela si passa.
    const disegna = corpoDi("_disegna(elenco, lette, pagine, fotoCambiate = null)");
    assert.ok(disegna.includes("elenco.data('lette',") && disegna.includes("elenco.data('fotoCambiate', fotoCambiate);"));
    assert.ok(disegna.includes("if (!Array.isArray(fotoCambiate)) {"));
});

test("ridisegna usa la lettura tenuta, e senza lettura rilegge come riempi", () => {
    const chiamate = [];
    const dati = new Map();
    const elenco = { data(chiave, valore) { if (arguments.length > 1) { dati.set(chiave, valore); return this; } return dati.get(chiave); } };
    const prima = { _disegna: SchermataSegnalazioni._disegna, riempi: SchermataSegnalazioni.riempi };
    SchermataSegnalazioni._disegna = (...argomenti) => chiamate.push(["disegna", argomenti[1], argomenti[3]]);
    SchermataSegnalazioni.riempi = () => chiamate.push(["riempi"]);
    try {
        SchermataSegnalazioni.ridisegna(elenco);
        const lette = [{ box: {}, voci: [] }];
        const foto = [{ foto: "a.psd" }];
        elenco.data('lette', lette);
        elenco.data('fotoCambiate', foto);
        SchermataSegnalazioni.ridisegna(elenco);
        assert.deepStrictEqual(chiamate, [["riempi"], ["disegna", lette, foto]]);
    }
    finally {
        SchermataSegnalazioni._disegna = prima._disegna;
        SchermataSegnalazioni.riempi = prima.riempi;
    }
});

test("senza documento o senza collegamenti nessuna foto cambiata", () => {
    conGlobali({ attiva: true }, () => {
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(null), []);
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento({}), []);
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documentoCon([])), []);
    });
});

test("le righe sono in ordine di pagina, poi di nome; le pagine senza numero in fondo", () => {
    const righe = SchermataSegnalazioni.ordinaFotoCambiate([
        { foto: "b.psd", pagina: "10" }, { foto: "z.psd", pagina: "A" }, { foto: "c.psd", pagina: "2" }, { foto: "a.psd", pagina: "10" }
    ]);
    assert.deepStrictEqual(righe.map(r => r.foto), ["c.psd", "a.psd", "b.psd", "z.psd"]);
});

test("il testo conta le foto e i box: piu' foto dello stesso box sono un box", () => {
    assert.strictEqual(SchermataSegnalazioni.testoFotoCambiate([{ idRec: "55" }]), "1 foto cambiata in 1 box");
    assert.strictEqual(SchermataSegnalazioni.testoFotoCambiate([{ idRec: "55" }, { idRec: "55" }, { idRec: "66" }]), "3 foto cambiate in 2 box");
    //Un box senza DNA si conta per il suo id InDesign.
    assert.strictEqual(SchermataSegnalazioni.testoFotoCambiate([{ idRec: null, box: { id: 7 } }, { idRec: null, box: { id: 7 } }]), "2 foto cambiate in 1 box");
});

test("la sezione e l'avviso valgono solo per il cliente che lo dichiara", () => {
    const documento = documentoCon([collegamento("2437584_1_AD.psd", "LINK_OUT_OF_DATE", "immagine$2437584", BOX_4)]);

    conGlobali({ attiva: false, documento }, (messaggi) => {
        assert.deepStrictEqual(SchermataSegnalazioni._fotoCambiate(), []);
        assert.strictEqual(SchermataSegnalazioni.avvisaFotoCambiate(), 0);
        assert.strictEqual(messaggi.length, 0);
    });

    conGlobali({ attiva: true, documento }, (messaggi) => {
        assert.strictEqual(SchermataSegnalazioni._fotoCambiate().length, 1);
        assert.strictEqual(SchermataSegnalazioni.avvisaFotoCambiate(), 1);
        assert.strictEqual(messaggi.length, 1);
        assert.match(messaggi[0].testo, /^Code FTC-01 1 foto cambiata in 1 box: /);
        assert.strictEqual(messaggi[0].tipo, "warning");
    });
});

test("senza foto cambiate l'avviso non dice niente", () => {
    conGlobali({ attiva: true, documento: documentoCon([]) }, (messaggi) => {
        assert.strictEqual(SchermataSegnalazioni.avvisaFotoCambiate(), 0);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("Aggiorna fa quello che fa il pulsante giallo di Foto P/S: ripiazza il file nello stesso riquadro", () => {
    const riga = { tipo: "stessoNome", foto: "2437584_1_AD.psd", box: BOX_4, rettangolo: { label: "immagine$2437584" }, codice: "2437584" };
    const chiamate = [];
    const placer = { updateFoto: (...argomenti) => { chiamate.push(argomenti); return { box: BOX_4, fotoRectangle: riga.rettangolo, warning: "" }; } };
    conGlobali({ attiva: true }, (messaggi) => {
        assert.strictEqual(SchermataSegnalazioni.aggiornaFotoCambiata(riga, placer), true);
        assert.deepStrictEqual(chiamate, [["2437584_1_AD.psd", BOX_4, riga.rettangolo, "2437584"]]);
        assert.strictEqual(messaggi.length, 0);
    });
});

test("Aggiorna con un nome nuovo passa il codice della ref senza riquadro e mette la foto dietro la primaria", () => {
    const box = boxFinto(301, "7", "2437584,2437590", "88");
    const primaria = { id: 1, label: "immagine$2437584" };
    const secondaria = { id: 2, label: "foto_secondaria$2437590", dietro: null, sendToBack(altro) { this.dietro = altro; } };
    box.allPageItems = [primaria, secondaria];
    const riga = { tipo: "nomeNuovo", foto: "2437590_2_AD.psd", box: box, rettangolo: null, codice: "2437590" };
    const chiamate = [];
    const placer = { updateFoto: (...argomenti) => { chiamate.push(argomenti); return { box: box, fotoRectangle: secondaria, warning: "" }; } };
    conGlobali({ attiva: true }, () => {
        assert.strictEqual(SchermataSegnalazioni.aggiornaFotoCambiata(riga, placer), true);
    });
    assert.deepStrictEqual(chiamate, [["2437590_2_AD.psd", box, null, "2437590"]]);
    assert.strictEqual(secondaria.dietro, primaria);
});

test("Aggiorna con un nome nuovo della primaria non la manda dietro se stessa", () => {
    const box = boxFinto(302, "7", "2437584", "88");
    const primaria = { id: 1, label: "immagine$2437584", sendToBack() { throw new Error("non doveva"); } };
    box.allPageItems = [primaria];
    const placer = { updateFoto: () => ({ box: box, fotoRectangle: primaria, warning: "" }) };
    conGlobali({ attiva: true }, () => {
        assert.strictEqual(SchermataSegnalazioni.aggiornaFotoCambiata({ tipo: "nomeNuovo", foto: "n.psd", box: box, codice: "2437584" }, placer), true);
    });
});

test("Aggiorna non riuscito lo dice all'operatore", () => {
    const riga = { foto: "2437584_1_AD.psd", box: BOX_4, rettangolo: {}, codice: "2437584" };
    const errore = console.error;
    console.error = () => {};
    try {
        conGlobali({ attiva: true }, (messaggi) => {
            const conAvviso = { updateFoto: () => ({ warning: "Foto non trovata, è stata inserita fotoNoFound.png" }) };
            assert.strictEqual(SchermataSegnalazioni.aggiornaFotoCambiata(riga, conAvviso), false);
            const conErrore = { updateFoto: () => { throw new Error("riquadro rimosso"); } };
            assert.strictEqual(SchermataSegnalazioni.aggiornaFotoCambiata(riga, conErrore), false);
            assert.deepStrictEqual(messaggi.map(m => m.testo.substring(0, 12)), ["Code SGN-18 ", "Code SGN-18 "]);
        });
    }
    finally {
        console.error = errore;
    }
});

test("le foto cambiate sono una linguetta accanto a Tutte, che sostituisce l'elenco delle segnalazioni", () => {
    const sorgente = leggiFileDelPlugin("segnalazioni/schermata.js").replace(/\r/g, "");
    const corpoDi = (firma) => {
        const inizio = sorgente.indexOf("    " + firma + " {");
        assert.ok(inizio >= 0, firma + " non trovato");
        return sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));
    };

    const disegna = corpoDi("_disegna(elenco, lette, pagine, fotoCambiate = null)");
    const lettura = disegna.indexOf("SchermataSegnalazioni._fotoCambiate()");
    const ritorno = disegna.indexOf('elenco.data(\'filtro\', "");');
    const barra = disegna.indexOf("_barraDisattivazione(elenco)");
    const vista = disegna.indexOf("_sezioneFotoCambiate(elenco, fotoCambiate)");
    const disattivate = disegna.indexOf("if (disattivate) {");
    //Lette una volta, senza righe si torna a Tutte, poi la barra con la linguetta.
    assert.ok(lettura >= 0 && ritorno > lettura && barra > ritorno, "lettura, ritorno a Tutte, barra");
    //Scelta la linguetta, solo le foto cambiate: prima del ritorno per le segnalazioni disattivate,
    //e senza disegnare le segnalazioni.
    assert.ok(vista > barra && disattivate > vista, "la vista delle foto cambiate prima delle segnalazioni");
    assert.ok(disegna.substring(vista, disattivate).includes("return;"), "la vista delle foto cambiate non disegna le segnalazioni");
    assert.ok(disegna.includes("conteggioFoto.text(SchermataSegnalazioni.testoFotoCambiate(fotoCambiate))"));

    //La linguetta c'e' solo con foto cambiate, anche senza filtri e con le segnalazioni disattivate.
    const barraCorpo = corpoDi("_barraDisattivazione(elenco)");
    assert.ok(barraCorpo.includes("elenco.data('fotoCambiate')"), "la barra prende le foto cambiate dall'elenco");
    assert.ok(barraCorpo.includes("if (filtri.length > 0 || quanteFoto > 0)"));
    assert.ok(barraCorpo.includes("SchermataSegnalazioni._sceltaFiltro(elenco, [], quanteFoto)"));
    const scelta = corpoDi("_sceltaFiltro(elenco, filtri, fotoCambiate = 0)");
    assert.ok(scelta.includes("if (fotoCambiate > 0)"));
    assert.ok(scelta.includes('"Foto cambiate (" + fotoCambiate + ")", SchermataSegnalazioni.VISTA_FOTO_CAMBIATE'));

    //Nessun filtro del cliente puo' chiamarsi come la linguetta.
    assert.ok(SchermataSegnalazioni.VISTA_FOTO_CAMBIATE.startsWith("\u0000"));

    const disegnoSezione = corpoDi("_sezioneFotoCambiate(elenco, righe)");
    assert.ok(disegnoSezione.includes('text("Vai al box")') && disegnoSezione.includes("SchermataSegnalazioni.vaiAlBox(riga.box, elenco)"));
    assert.ok(disegnoSezione.includes('text("Aggiorna")') && disegnoSezione.includes("SchermataSegnalazioni.aggiornaFotoCambiata(riga)"));
});

test("l'avviso parte alla fine vera del pacchetto completo chiesto dall'operatore, non dai loghi da soli ne' dalla lista di codici", () => {
    const sorgente = leggiFileDelPlugin("reperimentoFoto/reperimentoFoto.js").replace(/\r/g, "");
    assert.ok(sorgente.includes("async avviaSyncPacchettoFoto(mode, callback, codici = [], opzioni = {}){"));
    //Il modo 0 passa al modo 1 dicendogli che e' la seconda fase del pacchetto; non quando lo chiede
    //l'impaginazione massiva, che passa la callback e impagina subito dopo.
    assert.ok(sorgente.includes("ReperimentoFoto.avviaSyncPacchettoFoto(1, callback, [], { dopoPacchettoFoto: callback == null });"));
    //Il modo 1 avvisa solo in quel caso, dopo la fine vera e non con l'annullamento.
    const fine = sorgente.indexOf("ReperimentoFoto.mostraFineScaricamento(1, fineScaricamento.esiti.completato, codiceSyncFotoMode1);");
    const blocco = sorgente.substring(sorgente.lastIndexOf("if (!annullata) {", fine), sorgente.indexOf("\n                        }\n", fine));
    assert.ok(blocco.includes("opzioni.dopoPacchettoFoto === true") && blocco.includes("ReperimentoFoto.avvisaFotoCambiate()"));
    //Prima dell'avviso, solo per il cliente che lo dichiara, si riscarica il tracciato.
    const avviso = sorgente.substring(sorgente.indexOf("    async avvisaFotoCambiate() {"), sorgente.indexOf("    /// Le immagini di un pacchetto divise per cartella."));
    const attive = avviso.indexOf("SchermataSegnalazioni.fotoCambiateAttive()");
    const tracciato = avviso.indexOf("await scaricaContenutoKitAsync(idKitLavorazione, true);");
    const conta = avviso.indexOf("return SchermataSegnalazioni.avvisaFotoCambiate();");
    assert.ok(attive >= 0 && tracciato > attive && conta > tracciato, "prima la chiave, poi il tracciato, poi l'avviso");
    //Le altre chiamate al modo 1 non lo chiedono.
    const chiamate = sorgente.match(/avviaSyncPacchettoFoto\(1,[^\n]*/g);
    assert.deepStrictEqual(chiamate.filter(c => c.includes("dopoPacchettoFoto")).length, 1);
});

/// Il getter di pluginMiddleware com'e' nel sorgente, su un middleware finto.
function middleware(configurazione, callCustom = false) {
    const sorgente = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    getSegnalaFotoCambiate() {");
    assert.ok(inizio >= 0, "getSegnalaFotoCambiate non trovato in pluginMiddleware.js");
    const corpo = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio)) + "\n    }";
    const me = new Function("return {" + corpo + "};")();
    me.callCustom = callCustom;
    me.customPluginDB = configurazione;
    return me;
}

test("Coop dichiara le foto cambiate, Edro21 no", () => {
    assert.strictEqual(middleware(customDi("Coopfi")).getSegnalaFotoCambiate(), true);
    assert.strictEqual(middleware(customDi("Edro21")).getSegnalaFotoCambiate(), false);
});

test("senza la chiave, o con un valore che non e' un booleano, le foto cambiate sono spente", () => {
    assert.strictEqual(middleware({}).getSegnalaFotoCambiate(), false);
    assert.strictEqual(middleware(null).getSegnalaFotoCambiate(), false);
    assert.strictEqual(middleware({ segnalaFotoCambiate: "true" }).getSegnalaFotoCambiate(), false);
    //Con il custom locale vale lo stesso, senza ripieghi.
    const prima = global.customAgenzia;
    global.customAgenzia = { segnalaFotoCambiate: true };
    try {
        assert.strictEqual(middleware({}, true).getSegnalaFotoCambiate(), true);
        global.customAgenzia = {};
        assert.strictEqual(middleware({}, true).getSegnalaFotoCambiate(), false);
    }
    finally {
        if (prima === undefined) { delete global.customAgenzia; } else { global.customAgenzia = prima; }
    }
});

/// I20-1222: uno spread finto con i suoi elementi di primo livello.
function spreadCon(elementi) {
    return { pageItems: { length: elementi.length, item: (i) => elementi[i] } };
}

/// I20-1222: un riquadro foto vuoto, senza file e quindi senza collegamento.
function riquadroVuoto(etichetta) {
    return { label: etichetta, graphics: { length: 0, item: () => null } };
}

test("I20-1222: il box con il riquadro foto vuoto, senza collegamenti, da' la riga come Foto P/S", () => {
    //Il caso della traccia: BOX_STD del gruppo 2699490 a pagina 14, l'unico riquadro immagine$2699490
    //vuoto, il dato vuole 2699490.png e il file e' in Links. Gli altri box hanno le foto collegate.
    const conFoto = boxFinto(301, "3", "2437584", "55");
    const vuoto = Object.assign(boxFinto(24597946, "14", "2699490", "89959"), { label: "BOX_STD" });
    vuoto.allPageItems = [riquadroVuoto("immagine$2699490")];
    const documento = documentoCon([collegamento("2437584_1_AD.psd", "LINK_NORMAL", "immagine$2437584", conFoto)]);
    //Il box gia' trovato dai collegamenti non si scorre di nuovo.
    Object.defineProperty(conFoto, "allPageItems", { get: () => { throw new Error("box gia' trovato riletto"); } });
    documento.spreads = { length: 2, item: (i) => [spreadCon([conFoto]), spreadCon([vuoto, { id: 999, label: "testata", allPageItems: [] }])][i] };
    const records = recordDelBox("55", "2437584", "2437584_1_AD.psd").concat(recordDelBox("89959", "2699490", "2699490.png"));
    conGlobali({ attiva: true }, () => {
        const righe = SchermataSegnalazioni.fotoCambiateDelDocumento(documento, records, new Set(["2437584_1_AD.psd", "2699490.png"]));
        assert.deepStrictEqual(righe.map(r => [r.tipo, r.foto, r.fotoNelBox, r.pagina, r.codiceGruppo, r.idRec, r.codice, r.meccanica]), [
            ["nomeNuovo", "2699490.png", null, "14", "2699490", "89959", "2699490", "BOX_STD"]
        ]);
        assert.strictEqual(righe[0].box, vuoto);
        assert.strictEqual(SchermataSegnalazioni.testoCambio(righe[0]), "il dato vuole 2699490.png, che nel box non c'e'");
        assert.strictEqual(SchermataSegnalazioni.testoFotoCambiate(righe), "1 foto cambiata in 1 box");
    });
});

test("I20-1222: riquadro vuoto con la foto non ancora in Links, elementi senza foto e documento senza spread non danno righe", () => {
    const vuoto = boxFinto(401, "5", "2699490", "89959");
    vuoto.allPageItems = [riquadroVuoto("immagine$2699490"), { label: "testo$2699490" }];
    const records = recordDelBox("89959", "2699490", "2699490.png");
    const conSpread = Object.assign(documentoCon([]), { spreads: { length: 1, item: () => spreadCon([vuoto, { id: 402, label: "", allPageItems: [{ label: "prezzo" }] }]) } });
    conGlobali({ attiva: true }, () => {
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(conSpread, records, new Set(["altra.png"])), []);
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documentoCon([]), records, new Set(["2699490.png"])), []);
    });
});

test("I20-1222: un riquadro con il file collegato, in un box non trovato dai collegamenti, conta con il suo nome", () => {
    const box = boxFinto(501, "6", "2699490", "89959");
    const pieno = { label: "immagine$2699490", graphics: { length: 1, item: () => ({ itemLink: { name: "2699490.png" } }) } };
    box.allPageItems = [pieno];
    const documento = Object.assign(documentoCon([]), { spreads: { length: 1, item: () => spreadCon([box]) } });
    conGlobali({ attiva: true }, () => {
        assert.deepStrictEqual(SchermataSegnalazioni.fotoCambiateDelDocumento(documento, recordDelBox("89959", "2699490", "2699490.png"), new Set(["2699490.png"])), []);
    });
});
