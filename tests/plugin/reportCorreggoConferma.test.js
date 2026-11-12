/*
 * I20-1221: Importa correzioni e Conferma correzioni del Report Correggo, nel Report Integrita'
 * vero (plugin/reportIntegrita/reportIntegrita.js), con InDesign, Istanta e la scheda ref finti.
 *
 * reportCorreggo.test.js prova le regole pure di sezioneCorreggo.js. Qui si prova il giro della
 * conferma: la domanda prima di eliminare, l'ordine delle operazioni su ogni box (prima il server:
 * foto, primarie e secondarie, loghi, descrizione; poi il box rifatto una volta sola), che cosa si
 * chiude in Correggo4 e che cosa resta aperto quando qualcosa non riesce.
 *
 * Le azioni sul box e le regole dei timbri sono quelle vere di Coop (SourceCustomPlugin.json), con
 * i nomi in camelCase come le serve Istanta.
 *
 * Esecuzione: node --test tests/plugin/reportCorreggoConferma.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const RADICE = path.join(__dirname, "..", "..");
const COOP = JSON.parse(fs.readFileSync(path.join(RADICE, "Istanta/wwwroot/external_source/Coopfi/SourceCustomPlugin.json"), "utf8"));

/// Come Istanta serve gli oggetti al Plugin: i nomi delle proprieta' con l'iniziale minuscola.
function inCamelCase(valore) {
    if (Array.isArray(valore)) {
        return valore.map(inCamelCase);
    }
    if (valore != null && typeof valore === "object") {
        const o = {};
        Object.keys(valore).forEach(k => { o[k.charAt(0).toLowerCase() + k.slice(1)] = inCamelCase(valore[k]); });
        return o;
    }
    return valore;
}

const AZIONI_COOP = inCamelCase(COOP.cambiStrutturali);
const REGOLE_COOP = COOP.correzioniCorreggo;

const app = { activeDocument: { name: "PROMO_PROVA.indd" } };

function carica() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return { app: app };
        }
        return originale.apply(this, arguments);
    };
    try {
        return {
            ReportIntegrita: require("../../plugin/reportIntegrita/reportIntegrita.js"),
            cambiStrutturali: require("../../plugin/cambiStrutturali.js"),
            correggo: require("../../plugin/reportIntegrita/sezioneCorreggo.js")
        };
    }
    finally {
        Module._load = originale;
    }
}

const { ReportIntegrita, cambiStrutturali, correggo } = carica();
const { SCELTA, TIPO } = correggo;

/// Le correzioni come le restituisce Correggo4 (Plugin/Correzioni): il box 8001 ne ha di ogni tipo,
/// l'8002 e' da eliminare, l'8003 va fuori volantino.
function correzioniDiProva() {
    const box = (basecode, pagina) => ({ basecode: basecode, labelBox: "BOX_STD_" + basecode, pagina: pagina, autore: "Carla Category", tipoAutore: "Category" });
    return [
        Object.assign({ id: "nota:12", tipo: "nota", testo: "sgruppare" }, box("8001", 3)),
        Object.assign({ id: "timbro:7", tipo: "timbro", simbolo: "_4_2_alkg", nomeTimbro: "Al kg" }, box("8001", 3)),
        Object.assign({ id: "timbro:8", tipo: "timbro", simbolo: "_2_2_star", nomeTimbro: "Star" }, box("8001", 3)),
        Object.assign({
            id: "edit:31:offerta", tipo: "edit", parte: "offerta",
            campi: { prezzo_promo: "3.90" },
            azioni: [{ id: 2, titolo: "Cambia sconto", campi: { txt_sconto: "30" } }]
        }, box("8001", 3)),
        Object.assign({
            id: "edit:31:descrizione", tipo: "edit", parte: "descrizione",
            descrizione: "<DESCRIZIONE_TITOLO>Mela golden</DESCRIZIONE_TITOLO>",
            foto: [{ codice: "8001b", guidId: "foto-8001b", nomeFile: "8001b.psd", stato: 1 },
                   { codice: "8001", guidId: "foto-8001-nuova", nomeFile: "8001_2.psd", stato: 2 }],
            loghi: [{ codice: "BIO", guidId: "logo-bio", nomeFile: "bio.png", md5: "md5-bio", stato: 4 },
                    { codice: "DOP", guidId: "logo-dop", nomeFile: "dop.png", stato: 5 }]
        }, box("8001", 3)),
        Object.assign({ id: "timbro:9", tipo: "timbro", simbolo: "_1_2_elimina", nomeTimbro: "Elimina" }, box("8002", 3)),
        Object.assign({ id: "timbro:10", tipo: "timbro", simbolo: "_1_1_fvol", nomeTimbro: "Fuori volantino" }, box("8003", 4))
    ];
}

/// La scheda di un gruppo: la 8001 e' primaria con la foto vecchia, la 8001b non selezionata.
function schedaDi(basecode) {
    if (basecode === "8001") {
        return [
            { recordInTracciato: { "Referenza.Codice": "8001", StatoSelezione: 1, "Foto.guidid": "foto-8001-vecchia" } },
            { recordInTracciato: { "Referenza.Codice": "8001b", StatoSelezione: 3, "Foto.guidid": "foto-8001b" } }
        ];
    }
    return [{ recordInTracciato: { "Referenza.Codice": basecode, StatoSelezione: 1, "Foto.guidid": "foto-" + basecode } }];
}

const ID_REC = { "8001": 501, "8002": 502, "8003": 503 };

/// Un Report Integrita' con tutto intorno finto. registro raccoglie, in ordine, ogni operazione
/// verso InDesign, Istanta e la scheda; messaggi quello che vede l'operatore.
function ambiente(opzioni = {}) {
    const registro = [];
    const messaggi = [];
    let correzioni = opzioni.correzioni || correzioniDiProva();

    cambiStrutturali.cambiStrutturaliDB = AZIONI_COOP;

    Object.assign(globalThis, {
        idKitLavorazione: 3232,
        pathLavorazione: "/percorso/di/prova",
        idMacchina: () => "macchina-di-prova",
        libroDelDocumentoInLavorazione: () => null,
        ruoloUtenteLoggato: opzioni.superAdmin === false ? 2 : 1,
        RuoloUtente: { superAdmin: 1 },
        showLoading: () => { },
        hideLoading: () => { },
        messaggioUtente: (testo, tipo) => { messaggi.push({ testo: testo, tipo: tipo }); },
        Modali: {
            confirm: async (domanda) => {
                registro.push({ op: "domanda", domanda: domanda });
                return opzioni.confermaEliminazione !== false;
            }
        },
        indesignEvents: { setBusy: () => { } },
        pluginMiddleware: { getCampo: (nome) => nome === "correzioniCorreggo" ? REGOLE_COOP : null },
        Utility: {
            parseLabel: (l) => l,
            getDnaOfBox: (box) => ({ idRec: String(box.idRec) }),
            voceLavorazione: () => opzioni.senzaVoceLavorazione ? null : { details: { guidId: "guid-lavorazione" } }
        },
        rimuoviRefImpaginata: async (lista, mantieniBusy, conferma) => {
            registro.push({ op: "elimina", lista: lista, mantieniBusy: mantieniBusy, conferma: conferma });
            return opzioni.eliminazioneRiesce !== false;
        },
        ReperimentoFoto: {
            assicuraFotoNeiLinks: async (nomeFile, guidid) => { registro.push({ op: "links", nomeFile: nomeFile, guidid: guidid }); }
        },
        schedaRef: {
            AZIONE_TESTO_DAL_BOX: { crea: "crea" },
            AZIONE_EXTRA: { escludi: 3 },
            AMBITO_DECISIONE: { tutto: 0 },
            campoDescrizioneCompilatoDelPrimario: () => ({ labelName: "descrizione", content: "<DESCRIZIONE_TITOLO>Mela</DESCRIZIONE_TITOLO>" }),
            salvaTestiDalBox: async (richiesta, destinazione) => {
                registro.push({ op: "descrizione", richiesta: richiesta, destinazione: destinazione });
                return opzioni.descrizioneRiesce !== false;
            },
            salvaExtraLavorazione: async (richiesta, destinazione) => {
                registro.push({ op: "escludiLogo", richiesta: richiesta, destinazione: destinazione });
                return true;
            },
            parametriAzioniDelBox: (records, azioni, valori, opzione) => ({ azioni: azioni, valori: valori, opzione: opzione }),
            cambioStrutturaleSulBox: async (params, dettaglio) => {
                registro.push({ op: "cambioStrutturale", azioni: params.azioni.map(a => a.titolo), valori: params.valori, opzione: params.opzione, dettaglio: dettaglio });
            },
            rifaiBox: async (records, box) => { registro.push({ op: "rifaiBox", basecode: box.basecode }); }
        }
    });

    const report = Object.create(ReportIntegrita);
    report._correggo = { voci: [], importate: false, volantino: "", inCorso: false };
    report._disegnaCorrezioniCorreggo = () => { };
    report._resolveBoxByCodiceGruppo = ({ codiceGruppo, numeroPagina }) => {
        if ((opzioni.boxMancanti || []).includes(codiceGruppo)) {
            return null;
        }
        return { basecode: codiceGruppo, idRec: ID_REC[codiceGruppo], parentPage: { name: String(numeroPagina) } };
    };
    report._leggiSchedaRefAggiornata = async (codiceGruppo) => schedaDi(codiceGruppo);
    report._chiamaIstantaPerCorreggo = async (url, corpo, metodo) => {
        const letto = corpo instanceof FormData ? Object.fromEntries(corpo) : corpo == null ? null : JSON.parse(corpo);
        registro.push({ op: "istanta", url: url, metodo: metodo, corpo: letto });
        if (url === "FicoProcess/correzioniCorreggo/3232") {
            return opzioni.importazione || { esito: true, dati: { volantino: "VOL 26", correzioni: correzioni } };
        }
        if (url === "FicoProcess/correzioniCorreggo/3232/chiudi") {
            const chiuse = opzioni.chiusura ? opzioni.chiusura(letto.approvate) : letto.approvate.map(id => ({ id: id, ok: true }));
            correzioni = correzioni.filter(c => !chiuse.some(x => x.ok && x.id === c.id));
            return { esito: true, dati: chiuse };
        }
        if (url === "SyncFoto/linkLogoBollo/") {
            return opzioni.rispostaLogo || { esito: true };
        }
        return { esito: true };
    };

    return { report, registro, messaggi };
}

function scegliTutte(report, idCorrezione, tipo, scelta = SCELTA.approva) {
    report._correggo.voci.filter(v => v.idCorrezione === idCorrezione && (tipo == null || v.tipo === tipo))
        .forEach(v => correggo.scegli(v, scelta, true));
}

/// Il caso tipico: importa, approva a mano nota, azione e descrizione; lo Star resta senza scelta.
async function importaEApprova(a) {
    await a.report.importaCorrezioniCorreggo();
    scegliTutte(a.report, "nota:12");
    scegliTutte(a.report, "edit:31:offerta", TIPO.azione);
    scegliTutte(a.report, "edit:31:descrizione", TIPO.descrizione);
}

const operazioni = (registro, op) => registro.filter(r => r.op === op);
const chiamate = (registro, url) => registro.filter(r => r.op === "istanta" && r.url === url);
const chiusura = (registro) => chiamate(registro, "FicoProcess/correzioniCorreggo/3232/chiudi");
const ricapitolo = (messaggi) => messaggi.find(m => m.testo.startsWith("Code RIC-05"));

/* ---- importazione ---- */

test("Importa chiede a Istanta le correzioni della lavorazione e le apre in voci", async () => {
    const a = ambiente();

    await a.report.importaCorrezioniCorreggo();

    const get = chiamate(a.registro, "FicoProcess/correzioniCorreggo/3232");
    assert.strictEqual(get.length, 1);
    assert.strictEqual(get[0].metodo, "GET");
    assert.strictEqual(a.report._correggo.importate, true);
    assert.strictEqual(a.report._correggo.volantino, "VOL 26");
    //nota, al kg, star, prezzi + azione, descrizione + foto + loghi, elimina, fvol
    assert.strictEqual(a.report._correggo.voci.length, 10);
    assert.ok(a.messaggi.some(m => m.testo === "Code RIC-02 Correzioni di Correggo importate: 10" && m.tipo === "success"));
});

test("un rifiuto di Correggo4 all'importazione arriva all'operatore con il suo motivo (RIC-01)", async () => {
    const a = ambiente({
        importazione: { esito: false, error: "Correggo4: La lavorazione 3232 non ha un volantino in Correggo4: va prima esportata per Correggo." }
    });

    await a.report.importaCorrezioniCorreggo();

    const errore = a.messaggi.find(m => m.tipo === "error");
    assert.ok(errore.testo.startsWith("Code RIC-01"));
    assert.ok(errore.testo.includes("va prima esportata per Correggo"));
    assert.strictEqual(a.report._correggo.importate, false);
    assert.strictEqual(a.report._correggo.inCorso, false);
});

/* ---- conferma: il giro intero ---- */

test("la conferma chiede dell'eliminazione prima di toccare qualunque box", async () => {
    const a = ambiente();
    await importaEApprova(a);
    const prima = a.registro.length;

    await a.report.confermaCorrezioniCorreggo();

    const dopo = a.registro.slice(prima);
    assert.deepStrictEqual(dopo[0], { op: "domanda", domanda: "Verra' eliminata 1 ref. Confermi?" });
});

test("sul box 8001 prima le modifiche sul server, poi un solo cambio strutturale con prezzi, timbro e azione", async () => {
    const a = ambiente();
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const sul8001 = a.registro.filter(r =>
        (r.op === "istanta" && r.corpo != null && (r.corpo.codice === "8001" || r.corpo.CodiceGruppo === "8001" || r.corpo.codiceReferenza === "8001")) ||
        r.op === "links" || r.op === "escludiLogo" || r.op === "descrizione" ||
        (r.op === "cambioStrutturale" && r.dettaglio.codiceGruppo === "8001"));
    assert.deepStrictEqual(sul8001.map(r => r.op === "istanta" ? r.url : r.op), [
        "FicoProcess/correggiFotoESelezioniFromCorreggo",
        "Menabo/modificaPrimarieSecondarie/0",
        "links", "links",
        "SyncFoto/linkLogoBollo/",
        "escludiLogo",
        "descrizione",
        "cambioStrutturale"
    ]);

    //In archivio cambia solo la foto con un file diverso; la 8001b ha gia' quello.
    const [foto, ps, , , logo, escludi, descrizione, cambio] = sul8001;
    assert.deepStrictEqual(foto.corpo, {
        guidIdLavorazione: "guid-lavorazione", codice: "8001", idRec: 501,
        foto: [{ guidid: "foto-8001-nuova", codice: "8001", nomeFile: "8001_2.psd", md5: "", stato: 2 }]
    });
    assert.strictEqual(foto.metodo, "PUT");
    assert.deepStrictEqual(JSON.parse(ps.corpo.ps), [{ codRef: "8001", stato: 2 }, { codRef: "8001b", stato: 1 }]);
    assert.strictEqual(ps.corpo.idLavorazione, "3232");
    assert.strictEqual(ps.corpo.idRec, "501");
    assert.deepStrictEqual(logo.corpo, { guidId: "logo-bio", nomeReale: "bio.png", fileHash: "md5-bio", codiceReferenza: "8001" });
    assert.deepStrictEqual(escludi.richiesta, { rimuovi: false, voce: { tipo: 2, sigla: "DOP", azione: 3, ambito: 0 } });
    assert.deepStrictEqual(escludi.destinazione, { codiceGruppo: "8001", idRec: 501 });
    assert.deepStrictEqual(descrizione.richiesta.voci, [{
        label: "descrizione", azione: "crea",
        contenuto: "<DESCRIZIONE_TITOLO>Mela golden</DESCRIZIONE_TITOLO>",
        contenutoServer: "<DESCRIZIONE_TITOLO>Mela</DESCRIZIONE_TITOLO>"
    }]);
    assert.deepStrictEqual(descrizione.destinazione, { codiceGruppo: "8001", idRec: 501 });
    assert.deepStrictEqual(cambio.azioni, ["Prezzi da Correggo", "Cambia prezzo info pack", "Cambia sconto"]);
    assert.deepStrictEqual(cambio.valori, { force_infopack: "al kg", txt_sconto: "30" });
    assert.strictEqual(cambio.opzione, "tutto");
    assert.strictEqual(cambio.dettaglio.idRec, 501);
    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").filter(c => c.dettaglio.codiceGruppo === "8001").length, 1);
});

test("Elimina toglie la referenza dall'impaginato e dal tracciato, senza altro sul box", async () => {
    const a = ambiente();
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const elimina = operazioni(a.registro, "elimina");
    assert.strictEqual(elimina.length, 1);
    assert.deepStrictEqual(elimina[0].lista, [{ codice: "8002", idRec: 502 }]);
    assert.strictEqual(elimina[0].mantieniBusy, true);
    assert.strictEqual(elimina[0].conferma.eliminaDaTracciato, true);
    assert.strictEqual(elimina[0].conferma.boxes[0].basecode, "8002");
    assert.ok(!operazioni(a.registro, "cambioStrutturale").some(c => c.dettaglio.codiceGruppo === "8002"));
});

test("FVOL manda il box fuori volantino con l'azione Metti fuori volantino di Coop", async () => {
    const a = ambiente();
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const fvol = operazioni(a.registro, "cambioStrutturale").filter(c => c.dettaglio.codiceGruppo === "8003");
    assert.strictEqual(fvol.length, 1);
    assert.deepStrictEqual(fvol[0].azioni, ["Metti fuori volantino"]);
    assert.strictEqual(fvol[0].dettaglio.pagRef.name, "4");
});

test("si chiudono in Correggo4 le correzioni applicate per intero; lo Star senza scelta resta aperto", async () => {
    const a = ambiente();
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const chiudi = chiusura(a.registro);
    assert.strictEqual(chiudi.length, 1);
    assert.strictEqual(chiudi[0].metodo, "PUT");
    assert.deepStrictEqual(chiudi[0].corpo.approvate.slice().sort(),
        ["edit:31:descrizione", "edit:31:offerta", "nota:12", "timbro:10", "timbro:7", "timbro:9"]);
    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "success");
    assert.strictEqual(r.testo, "Code RIC-05 Correzioni di Correggo: 9 applicate, 1 senza scelta, 6 chiuse in Correggo4.");
});

test("dopo la conferma la lista si reimporta: restano solo le correzioni aperte", async () => {
    const a = ambiente();
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const get = chiamate(a.registro, "FicoProcess/correzioniCorreggo/3232");
    assert.strictEqual(get.length, 2);
    assert.ok(a.registro.indexOf(get[1]) > a.registro.indexOf(chiusura(a.registro)[0]));
    assert.deepStrictEqual(a.report._correggo.voci.map(v => v.idCorrezione), ["timbro:8"]);
    assert.strictEqual(a.report._correggo.inCorso, false);
});

test("una correzione rifiutata non si applica e non si chiude", async () => {
    const a = ambiente();
    await importaEApprova(a);
    scegliTutte(a.report, "timbro:10", null, SCELTA.rifiuta);

    await a.report.confermaCorrezioniCorreggo();

    assert.ok(!operazioni(a.registro, "cambioStrutturale").some(c => c.dettaglio.codiceGruppo === "8003"));
    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("timbro:10"));
    assert.ok(ricapitolo(a.messaggi).testo.includes("1 rifiutate"));
});

/* ---- conferma: quando qualcosa non va ---- */

test("annullando la domanda dell'eliminazione non si applica niente e non si chiude niente", async () => {
    const a = ambiente({ confermaEliminazione: false });
    await importaEApprova(a);
    const prima = a.registro.length;

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(a.registro.slice(prima).map(r => r.op), ["domanda"]);
    assert.strictEqual(a.report._correggo.inCorso, false);
});

test("senza superAdmin Elimina arriva senza scelta, non si approva e non si chiede niente", async () => {
    const a = ambiente({ superAdmin: false });
    await importaEApprova(a);
    const elimina = a.report._correggo.voci.find(v => v.idCorrezione === "timbro:9");

    assert.strictEqual(elimina.scelta, SCELTA.nessuna);
    assert.strictEqual(correggo.scegli(elimina, SCELTA.approva, false), false);
    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "domanda").length, 0);
    assert.strictEqual(operazioni(a.registro, "elimina").length, 0);
    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("timbro:9"));
});

test("un'eliminazione non riuscita lascia aperta la correzione e lo dice", async () => {
    const a = ambiente({ eliminazioneRiesce: false });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("timbro:9"));
    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.ok(r.testo.includes("8002: eliminazione della referenza non riuscita"));
});

test("un box che non e' nel documento: le sue correzioni restano aperte, le altre si chiudono", async () => {
    const a = ambiente({ boxMancanti: ["8003"] });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const approvate = chiusura(a.registro)[0].corpo.approvate;
    assert.ok(!approvate.includes("timbro:10"));
    assert.ok(approvate.includes("timbro:7"));
    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.ok(r.testo.includes("1 non riuscite"));
    assert.ok(r.testo.includes("8003: box non trovato nel documento"));
});

test("una descrizione non registrata lascia aperta la sua correzione; il resto del box si applica", async () => {
    const a = ambiente({ descrizioneRiesce: false });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const approvate = chiusura(a.registro)[0].corpo.approvate;
    assert.ok(!approvate.includes("edit:31:descrizione"));
    assert.ok(approvate.includes("edit:31:offerta"));
    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").filter(c => c.dettaglio.codiceGruppo === "8001").length, 1);
    assert.ok(ricapitolo(a.messaggi).testo.includes("8001: meta della descrizione non registrato"));
});

test("un logo gia' collegato all'articolo va bene lo stesso", async () => {
    const a = ambiente({ rispostaLogo: { esito: false, error: "Immagine già associata al prodotto" } });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    assert.ok(chiusura(a.registro)[0].corpo.approvate.includes("edit:31:descrizione"));
    assert.strictEqual(ricapitolo(a.messaggi).tipo, "success");
});

test("un logo che Istanta rifiuta lascia aperta la correzione, con il motivo", async () => {
    const a = ambiente({ rispostaLogo: { esito: false, error: "file non trovato in archivio" } });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("edit:31:descrizione"));
    assert.ok(ricapitolo(a.messaggi).testo.includes("8001: loghi: logo BIO non collegato: file non trovato in archivio"));
});

test("senza la voce della lavorazione le foto non si cambiano e la correzione resta aperta", async () => {
    const a = ambiente({ senzaVoceLavorazione: true });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(chiamate(a.registro, "FicoProcess/correggiFotoESelezioniFromCorreggo").length, 0);
    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("edit:31:descrizione"));
    assert.ok(ricapitolo(a.messaggi).testo.includes("foto: lavorazione del documento non trovata in lavorazioni.json"));
});

test("un'azione dell'Edit avanzato che il cliente non ha resta aperta; i prezzi si applicano", async () => {
    const correzioni = correzioniDiProva();
    correzioni[3].azioni = [{ id: 1, titolo: "Azione che Coop non ha", campi: {} }];
    const a = ambiente({ correzioni: correzioni });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const cambio = operazioni(a.registro, "cambioStrutturale").find(c => c.dettaglio.codiceGruppo === "8001");
    assert.deepStrictEqual(cambio.azioni, ["Prezzi da Correggo", "Cambia prezzo info pack"]);
    assert.ok(!chiusura(a.registro)[0].corpo.approvate.includes("edit:31:offerta"));
    assert.ok(ricapitolo(a.messaggi).testo.includes("azione «Azione che Coop non ha» non trovata"));
});

test("con le sole modifiche sul server il box si rifa' dalla scheda riletta, senza cambio strutturale", async () => {
    const correzioni = correzioniDiProva().filter(c => c.id === "edit:31:descrizione");
    delete correzioni[0].descrizione;
    delete correzioni[0].foto;
    const a = ambiente({ correzioni: correzioni });
    await a.report.importaCorrezioniCorreggo();

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox"), [{ op: "rifaiBox", basecode: "8001" }]);
    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").length, 0);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["edit:31:descrizione"]);
});

test("Correggo4 che non chiude una correzione: si dice quale e perche'", async () => {
    const a = ambiente({
        chiusura: (approvate) => approvate.map(id => id === "nota:12"
            ? { id: id, ok: false, codice: "non_aperta", messaggio: "la correzione nota:12 non e' piu' aperta" }
            : { id: id, ok: true })
    });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.ok(r.testo.includes("5 chiuse in Correggo4"));
    assert.ok(r.testo.includes("chiusura di nota:12: la correzione nota:12 non e' piu' aperta"));
});

test("senza approvate la conferma non fa niente e lo dice (RIC-03)", async () => {
    const correzioni = correzioniDiProva().filter(c => c.tipo === "nota");
    const a = ambiente({ correzioni: correzioni });
    await a.report.importaCorrezioniCorreggo();
    const prima = a.registro.length;

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(a.registro.length, prima);
    assert.ok(a.messaggi.some(m => m.testo === "Code RIC-03 Nessuna correzione approvata da applicare" && m.tipo === "warning"));
});

test("un secondo clic su Conferma mentre la prima e' in corso non applica due volte", async () => {
    const correzioni = correzioniDiProva().filter(c => c.id === "timbro:7");
    const a = ambiente({ correzioni: correzioni });
    await a.report.importaCorrezioniCorreggo();

    await Promise.all([a.report.confermaCorrezioniCorreggo(), a.report.confermaCorrezioniCorreggo()]);

    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").length, 1);
    assert.strictEqual(chiusura(a.registro).length, 1);
});
