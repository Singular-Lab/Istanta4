/*
 * I20-1070: le foto extra decise dall'operatore per questa sola lavorazione.
 *
 * Dalla finestra delle differenze della scheda ref, senza toccare il box: su una foto extra con
 * l'immagine cambiata si tiene quella del box (o si ricollega quella del server, se identica),
 * su una in piu' la si tiene solo per questa lavorazione, su una mancante la si esclude per
 * questa lavorazione. La decisione va nel meta del record (Menabo/modificaExtraLavorazione) e si
 * riflette subito nei record in memoria, cosi' la preanalisi rifatta la vede.
 *
 * schedaRef.js, confronti.js e noRenderElementi.js si caricano sotto Node: le decisioni si provano
 * direttamente, la finestra e le chiamate sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");
const confronti = require("../../plugin/confronti.js");
const NoRenderElementi = require("../../plugin/noRenderElementi.js");

const LOGO = NoRenderElementi.TIPO.logo;
const FOTO_EXTRA = NoRenderElementi.TIPO.fotoExtra;

const CAMBIATA = { label: "Logo_BDP", difference: "...", tipo: "immagineExtraCambiata", famiglia: "extraAuto", sigla: "Logo_BDP", tipoElemento: LOGO, nomeNelBox: "Logo_BDP_2025.psd", nomeServer: "Logo_BDP_2026.psd" };
const IN_PIU = { label: "Logo_locale.psd", difference: "...", tipo: "extraInPiu", sigla: "Logo_locale", tipoElemento: LOGO, tipoFoto: 3, nome: "Logo_locale.psd" };
const MANCANTE = { label: "Logo_SDB.psd", difference: "...", tipo: "extraMancante", famiglia: "extraAuto", sigla: "Logo_SDB", tipoElemento: LOGO, nome: "Logo_SDB.psd" };

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- le azioni per differenza ---- */

test("ogni tipo di differenza sulle foto extra ha le sue azioni, le altre nessuna", () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(CAMBIATA), ["tieniBox", "usaServer"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(IN_PIU), ["tieniLavorazione"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(MANCANTE), ["escludiLavorazione"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza({ label: "campo_offerta", difference: "contenuto" }), []);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(null), []);
});

test("senza sigla non c'e' una chiave per il meta: niente azioni", () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(Object.assign({}, IN_PIU, { sigla: "" })), []);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(Object.assign({}, MANCANTE, { sigla: null })), []);
    assert.strictEqual(schedaRef.richiestaExtraLavorazione(Object.assign({}, IN_PIU, { sigla: "" }), "tieniLavorazione"), null);
});

/* ---- la richiesta per il server ---- */

test("tieni l'immagine del box: sovrascrivi, col nome del box e quello del server", () => {
    assert.deepStrictEqual(schedaRef.richiestaExtraLavorazione(CAMBIATA, "tieniBox"), {
        rimuovi: false,
        voce: { tipo: LOGO, sigla: "Logo_BDP", azione: 1, nome: "Logo_BDP_2025.psd", nomeServer: "Logo_BDP_2026.psd", tipoFoto: 0 }
    });
});

test("tieni solo per questa lavorazione: aggiungi, col tipo_N della label", () => {
    assert.deepStrictEqual(schedaRef.richiestaExtraLavorazione(IN_PIU, "tieniLavorazione"), {
        rimuovi: false,
        voce: { tipo: LOGO, sigla: "Logo_locale", azione: 2, nome: "Logo_locale.psd", nomeServer: null, tipoFoto: 3 }
    });
});

test("escludi per questa lavorazione: escludi, ricordando il nome del server", () => {
    assert.deepStrictEqual(schedaRef.richiestaExtraLavorazione(MANCANTE, "escludiLavorazione"), {
        rimuovi: false,
        voce: { tipo: LOGO, sigla: "Logo_SDB", azione: 3, nome: null, nomeServer: "Logo_SDB.psd", tipoFoto: 0 }
    });
});

test("usa l'immagine del server non e' una decisione da registrare, e togliere rimanda la stessa voce", () => {
    assert.strictEqual(schedaRef.richiestaExtraLavorazione(CAMBIATA, "usaServer"), null);
    const voce = { tipo: LOGO, sigla: "Logo_BDP", azione: 1, nome: "a.psd", nomeServer: "b.psd" };
    assert.deepStrictEqual(schedaRef.richiestaRimozioneExtraLavorazione(voce), { rimuovi: true, voce: Object.assign({}, voce, { tipoFoto: 0 }) });
});

/* ---- l'applicazione ai record in memoria ---- */

function records() {
    return [
        { recordInTracciato: { StatoSelezione: 1, "Foto.ExtraAuto": [{ sigla: "Logo_BDP", nome: "Logo_BDP_2026.psd", tipo: 3, escluso: false }], "Foto.Extra": [{ sigla: "payoff", nome: "payoff.psd", attiva: true }] } },
        { recordInTracciato: { StatoSelezione: 0, "Foto.ExtraAuto": [{ sigla: "Logo_BDP", nome: "Logo_BDP_2026.psd", tipo: 3, escluso: false }] } },
        { recordInTracciato: null },
        null
    ];
}

test("sovrascrivi cambia il nome in tutti i record del gruppo, automatiche e manuali", () => {
    const lista = records();
    schedaRef.applicaExtraLavorazioneAiRecord(lista, { tipo: LOGO, sigla: "Logo_BDP", azione: 1, nome: "Logo_BDP_2025.psd", nomeServer: "Logo_BDP_2026.psd" });
    schedaRef.applicaExtraLavorazioneAiRecord(lista, { tipo: FOTO_EXTRA, sigla: "payoff", azione: 1, nome: "payoff_box.psd" });

    assert.strictEqual(lista[0].recordInTracciato["Foto.ExtraAuto"][0].nome, "Logo_BDP_2025.psd");
    assert.strictEqual(lista[1].recordInTracciato["Foto.ExtraAuto"][0].nome, "Logo_BDP_2025.psd");
    assert.strictEqual(lista[0].recordInTracciato["Foto.Extra"][0].nome, "payoff_box.psd");
    assert.deepStrictEqual(lista[0].recordInTracciato.extraLavorazione.map(v => v.sigla), ["Logo_BDP", "payoff"]);
});

test("aggiungi mette la foto del box fra le automatiche, anche dove non ce n'erano, e non duplica", () => {
    const lista = records();
    delete lista[1].recordInTracciato["Foto.ExtraAuto"];
    const voce = { tipo: LOGO, sigla: "Logo_locale", azione: 2, nome: "Logo_locale.psd", tipoFoto: 3 };
    schedaRef.applicaExtraLavorazioneAiRecord(lista, voce);
    schedaRef.applicaExtraLavorazioneAiRecord(lista, voce);

    const aggiunta = lista[0].recordInTracciato["Foto.ExtraAuto"].filter(l => l.sigla === "Logo_locale");
    assert.strictEqual(aggiunta.length, 1);
    assert.deepStrictEqual(aggiunta[0], { id: "", nome: "Logo_locale.psd", guidId: "", sigla: "Logo_locale", dataModifica: "", tipo: 3, escluso: false });
    assert.strictEqual(lista[1].recordInTracciato["Foto.ExtraAuto"].length, 1);
    assert.strictEqual(lista[0].recordInTracciato.extraLavorazione.length, 1, "una decisione nuova sulla stessa foto sostituisce la precedente");
});

test("escludi segna esclusa l'automatica e non attiva la manuale", () => {
    const lista = records();
    schedaRef.applicaExtraLavorazioneAiRecord(lista, { tipo: LOGO, sigla: "Logo_BDP", azione: 3 });
    schedaRef.applicaExtraLavorazioneAiRecord(lista, { tipo: FOTO_EXTRA, sigla: "payoff", azione: 3 });

    assert.strictEqual(lista[0].recordInTracciato["Foto.ExtraAuto"][0].escluso, true);
    assert.strictEqual(lista[0].recordInTracciato["Foto.Extra"][0].attiva, false);
});

test("le decisioni in memoria si leggono dal primario e si descrivono", () => {
    const lista = records();
    schedaRef.schedeRefDati = lista;
    try {
        assert.deepStrictEqual(schedaRef.extraLavorazioneInMemoria(), []);
        schedaRef.applicaExtraLavorazioneAiRecord(lista, { tipo: LOGO, sigla: "Logo_BDP", azione: 1, nome: "a.psd", nomeServer: "b.psd" });
        assert.strictEqual(schedaRef.extraLavorazioneInMemoria().length, 1);
    }
    finally {
        schedaRef.schedeRefDati = null;
    }

    assert.strictEqual(schedaRef.descriviExtraLavorazione({ sigla: "Logo_BDP", azione: 1, nome: "a.psd", nomeServer: "b.psd" }), "Logo_BDP: tenuta l'immagine del box a.psd al posto di b.psd");
    assert.strictEqual(schedaRef.descriviExtraLavorazione({ sigla: "Logo_locale", azione: 2, nome: "Logo_locale.psd" }), "Logo_locale: Logo_locale.psd tenuta solo per questa lavorazione");
    assert.strictEqual(schedaRef.descriviExtraLavorazione({ sigla: "Logo_SDB", azione: 3 }), "Logo_SDB: esclusa per questa lavorazione");
    assert.strictEqual(schedaRef.descriviExtraLavorazione(null), "");
});

/* ---- cosa porta la preanalisi ---- */

test("la differenza dell'immagine cambiata porta sigla, tipo, famiglia e i due nomi", () => {
    const esito = confronti.fotoExtraConImmagineCambiata({ nome: "Logo_BDP_2026.psd", sigla: "Logo_BDP", tipo: 3 }, ["Logo_BDP_2025.psd"], [{ nome: "Logo_BDP_2025.psd", sigla: "Logo_BDP" }], "foto extraAuto");

    assert.strictEqual(esito.differenza.tipo, "immagineExtraCambiata");
    assert.strictEqual(esito.differenza.famiglia, "extraAuto");
    assert.strictEqual(esito.differenza.sigla, "Logo_BDP");
    assert.strictEqual(esito.differenza.tipoElemento, LOGO);
    assert.strictEqual(esito.differenza.nomeNelBox, "Logo_BDP_2025.psd");
    assert.strictEqual(esito.differenza.nomeServer, "Logo_BDP_2026.psd");
    assert.strictEqual(confronti.fotoExtraConImmagineCambiata({ nome: "p2.psd", sigla: "payoff", tipo: 1 }, ["p1.psd"], [{ nome: "p1.psd", sigla: "payoff" }], "foto extra").differenza.famiglia, "extra");
});

test("il tipo di elemento di una foto extra del dato: 3 e' un logo, il resto una foto extra", () => {
    assert.strictEqual(confronti.tipoElementoExtra({ tipo: 3 }), LOGO);
    assert.strictEqual(confronti.tipoElementoExtra({ tipo: 1 }), FOTO_EXTRA);
    assert.strictEqual(confronti.tipoElementoExtra(null), FOTO_EXTRA);
    assert.strictEqual(NoRenderElementi.tipoFotoDellaLabel("foto_extra$Logo_BDP$tipo_3"), 3);
    assert.strictEqual(NoRenderElementi.tipoFotoDellaLabel("sfondo$sfondo_bdp$tipo_5"), 5);
    assert.strictEqual(NoRenderElementi.tipoFotoDellaLabel("foto_extra"), 0);
});

test("le differenze mancante e in piu' portano sigla e tipo, dalla label del box per quelle in piu'", () => {
    const testo = sorgente("confronti.js");
    assert.match(testo, /difference: "foto extra mancante nel box: " \+ foto\.nome,\s*tipo: "extraMancante", famiglia: "extra", sigla: foto\.sigla, tipoElemento: tipoExtra, nome: foto\.nome \}/);
    assert.match(testo, /difference: "foto extraAuto mancante nel box: " \+ foto\.sigla,\s*tipo: "extraMancante", famiglia: "extraAuto", sigla: foto\.sigla, tipoElemento: confronti\.tipoElementoExtra\(foto\), nome: foto\.nome \}/);
    assert.match(testo, /difference: "foto extraAuto mancante nel box: " \+ foto\.nome,\s*tipo: "extraMancante", famiglia: "extraAuto", sigla: foto\.sigla, tipoElemento: confronti\.tipoElementoExtra\(foto\), nome: foto\.nome \}/);
    assert.match(testo, /let nelBox = extraNelBox\.find\(e => e\.nome == foto\);\s*differenze\.push\(\{ label: foto, difference: "foto extra in più nel box originale: " \+ foto,\s*tipo: "extraInPiu", sigla: nelBox != null \? nelBox\.sigla : ""/);
    assert.match(testo, /tipoFoto: NoRenderElementi\.tipoFotoDellaLabel\(campo\.label\)/);
});

/* ---- la finestra e il server ---- */

test("la finestra delle differenze offre le azioni, la sezione delle decisioni, e rifa' l'analisi dopo", () => {
    const testo = sorgente("schedaRef.js");

    assert.match(testo, /riempiElencoSegnalazioni\(contenitore, intestazione, differenze, vociBollino = \[\], dopoAzione = null\) \{/);
    assert.match(testo, /riga\.append\(campo\)\.append\(dettaglio\);\s*\/\/I20-1070[^\n]*\n\s*this\.aggiungiAzioniDifferenza\(riga, diff, dopoAzione\);/);
    assert.match(testo, /id="segnalazioniExtraLavorazione"/);
    assert.match(testo, /const rifaiAnalisi = async function \(\) \{[\s\S]*?me\.riempiSezioneExtraLavorazione\(sezioneExtra, rifaiAnalisi\);\s*\};/);
    assert.match(testo, /me\.lampeggiaContenuto\(contenuto\);\s*await rifaiAnalisi\(\);/);
    assert.match(testo, /xhr\.send\("Menabo\/modificaExtraLavorazione\/0", formData, "PUT"\);/);
    //Il ricollegamento cambia solo il file del link, non il riquadro.
    assert.match(testo, /link\.relink\(percorso\);\s*link\.update\(\);/);
    assert.doesNotMatch(testo.substring(testo.indexOf("async ricollegaAllImmagineDelServer("), testo.indexOf("aggiungiAzioniDifferenza(riga, diff, dopoAzione) {")), /\.fit\(|geometricBounds/);
});

test("getLinkHash calcola l'md5 con hashDelFile, che serve anche al confronto con la cartella Loghi", () => {
    const testo = sorgente("reperimentoFoto/reperimentoFoto.js");
    assert.match(testo, /async hashDelFile\(filePath\) \{/);
    assert.match(testo, /result\.hash = await ReperimentoFoto\.hashDelFile\(filePath\);/);
    assert.strictEqual((testo.match(/md5ArrayBuffer\(/g) || []).length, 1, "l'md5 si calcola in un posto solo");
});
