/*
 * I20-1221: Importa correzioni e Conferma correzioni del Report Correggo, nel Report Integrita'
 * vero (plugin/reportIntegrita/reportIntegrita.js), con InDesign, Istanta e la scheda ref finti.
 *
 * reportCorreggo.test.js prova le regole pure di sezioneCorreggo.js. Qui si prova il giro della
 * conferma: la domanda prima di eliminare, l'ordine delle operazioni su ogni box (prima il server:
 * foto, primarie e secondarie, loghi; poi il box rifatto una volta sola, come Reimpagina box), che
 * cosa si chiude in Correggo4 e che cosa resta aperto quando qualcosa non riesce. I20-1233: la
 * descrizione approvata non si scrive nella referenza, ma si chiude.
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

const ID_REC = { "8001": 501, "8002": 502, "8003": 503, "8005": 505 };

/// I20-1233: dove stanno i box in pagina, [y1, x1, y2, x2] come geometricBounds di InDesign.
const POSIZIONI = { "8001": [10, 10, 60, 60], "8002": [10, 70, 60, 120], "8003": [70, 10, 120, 60], "8005": [70, 70, 160, 160] };

/// Un Report Integrita' con tutto intorno finto. registro raccoglie, in ordine, ogni operazione
/// verso InDesign, Istanta e la scheda; messaggi quello che vede l'operatore.
function ambiente(opzioni = {}) {
    const registro = [];
    const messaggi = [];
    let correzioni = opzioni.correzioni || correzioniDiProva();
    //I20-1233, opzione riferimentiUxp: come in UXP, il riferimento a un box segue il suo posto
    //nell'elenco dei gruppi della pagina. Dopo un box rifatto i riferimenti presi prima puntano al
    //box appena rifatto.
    let rifacimenti = 0;
    let ultimoRifatto = null;

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
            //Come quella vera: la referenza uscita dal volantino non si rifa'; le altre si rifanno con
            //rifai, se c'e', e senza box rifatto il cambio fallisce.
            cambioStrutturaleSulBox: async (params, dettaglio, rifai) => {
                const titoli = params.azioni.map(a => a.titolo);
                registro.push({ op: "cambioStrutturale", azioni: titoli, valori: params.valori, opzione: params.opzione, dettaglio: dettaglio, conRifai: typeof rifai === "function" });
                if (titoli.includes("Metti fuori volantino") || typeof rifai !== "function") {
                    return { box: null };
                }
                const box = await rifai();
                if (box == null) {
                    throw new Error("il box non e' stato reimpaginato");
                }
                return { box: box };
            },
            rifaiBox: async (records, box, boundsDestinazione) => {
                registro.push({ op: "rifaiBox", basecode: box.basecode, records: records,
                    bounds: boundsDestinazione != null ? boundsDestinazione.slice() : null });
                if (opzioni.rifaiNonRiesce || (opzioni.rifaiNonRiesceSu || []).includes(box.basecode)) {
                    return null;
                }
                //Il box nuovo esce dove gli si dice: il box in pagina con quel codice ora sta li'.
                if (boundsDestinazione != null) {
                    box.geometricBounds = boundsDestinazione.slice();
                }
                ultimoRifatto = [...boxInPagina.values()].find(b => b.basecode === box.basecode) || null;
                rifacimenti++;
                return { boxAggiunto: { basecode: box.basecode, nuovo: true } };
            },
            //I20-1233: il Raggruppa di Istanta, come lo chiama il Report Correggo.
            raggruppaBox: async (lista, pagina, bounds, boxDaTogliere) => {
                registro.push({ op: "raggruppaBox", lista: lista, bounds: bounds != null ? bounds.slice() : null,
                    togliere: boxDaTogliere.map(b => b.basecode) });
                return opzioni.raggruppaNonRiesce
                    ? { esito: false, codice: "Code RSF-96", errore: "Errore durante il salvataggio delle modifiche: gruppo rifiutato" }
                    : { esito: true };
            }
        }
    });

    const boxInPagina = new Map();
    const report = Object.create(ReportIntegrita);
    report._correggo = { voci: [], importate: false, volantino: "", inCorso: false };
    report._disegnaCorrezioniCorreggo = () => { };
    report._resolveBoxByCodiceGruppo = ({ codiceGruppo, numeroPagina }) => {
        if ((opzioni.boxMancanti || []).includes(codiceGruppo)) {
            return null;
        }
        //Un box con piu' codici (un gruppo gia' unito) c'e' solo se la prova lo mette nel documento.
        if (String(codiceGruppo).includes(",") && !(opzioni.posizioniNelDocumento || {})[codiceGruppo]) {
            return null;
        }
        //Un box per codice per tutta la prova: rifaiBox lo sposta, come InDesign.
        const k = codiceGruppo + "|" + numeroPagina;
        if (!boxInPagina.has(k)) {
            //posizioniNelDocumento: dove stanno adesso i box, se non come nell'export (un giro gia' applicato)
            const qui = (opzioni.posizioniNelDocumento || {})[codiceGruppo] || POSIZIONI[codiceGruppo] || [0, 0, 10, 10];
            boxInPagina.set(k, { basecode: codiceGruppo, idRec: ID_REC[codiceGruppo],
                parentPage: { name: String(numeroPagina), bounds: opzioni.paginaDestra ? [0, 210, 297, 420] : [0, 0, 297, 210] },
                geometricBounds: qui.slice() });
        }
        const vero = boxInPagina.get(k);
        if (!opzioni.riferimentiUxp) {
            return vero;
        }
        const preso = rifacimenti;
        const bersaglio = () => rifacimenti === preso || ultimoRifatto == null ? vero : ultimoRifatto;
        return {
            get basecode() { return bersaglio().basecode; },
            get idRec() { return bersaglio().idRec; },
            get parentPage() { return bersaglio().parentPage; },
            get geometricBounds() { return bersaglio().geometricBounds; },
            set geometricBounds(b) { bersaglio().geometricBounds = b; }
        };
    };
    report._leggiSchedaRefAggiornata = async (codiceGruppo) => {
        registro.push({ op: "leggiScheda", basecode: codiceGruppo });
        return schedaDi(codiceGruppo);
    };
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
        (r.op === "cambioStrutturale" && r.dettaglio.codiceGruppo === "8001") ||
        (r.op === "rifaiBox" && r.basecode === "8001"));
    assert.deepStrictEqual(sul8001.map(r => r.op === "istanta" ? r.url : r.op), [
        "FicoProcess/correggiFotoESelezioniFromCorreggo",
        "Menabo/modificaPrimarieSecondarie/0",
        "links", "links",
        "SyncFoto/linkLogoBollo/",
        "escludiLogo",
        "cambioStrutturale",
        "rifaiBox"
    ]);

    //In archivio cambia solo la foto con un file diverso; la 8001b ha gia' quello.
    const [foto, ps, , , logo, escludi, cambio, rifatto] = sul8001;
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
    assert.deepStrictEqual(cambio.azioni, ["Prezzi da Correggo", "Cambia prezzo info pack", "Cambia sconto"]);
    assert.deepStrictEqual(cambio.valori, { force_infopack: "al kg", txt_sconto: "30" });
    assert.strictEqual(cambio.opzione, "tutto");
    assert.strictEqual(cambio.dettaglio.idRec, 501);
    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").filter(c => c.dettaglio.codiceGruppo === "8001").length, 1);
    //I20-1233: il box si rifa' come Reimpagina box, dalla scheda riletta dopo il cambio sul server.
    assert.strictEqual(cambio.conRifai, true);
    assert.strictEqual(operazioni(a.registro, "rifaiBox").filter(r => r.basecode === "8001").length, 1);
    assert.deepStrictEqual(rifatto.records, schedaDi("8001"));
    const ultimaLettura = a.registro.map((r, i) => r.op === "leggiScheda" && r.basecode === "8001" ? i : -1).filter(i => i >= 0).pop();
    assert.ok(ultimaLettura > a.registro.indexOf(cambio) && ultimaLettura < a.registro.indexOf(rifatto));
    //I20-1233: la descrizione approvata non si scrive nella referenza.
    assert.strictEqual(operazioni(a.registro, "descrizione").length, 0);
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
    //La referenza esce dal volantino: il box non si rifa'.
    assert.ok(!operazioni(a.registro, "rifaiBox").some(r => r.basecode === "8003"));
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

test("I20-1233: una descrizione sola, approvata, non tocca ne' la referenza ne' il box e si chiude", async () => {
    const correzioni = correzioniDiProva().filter(c => c.id === "edit:31:descrizione");
    delete correzioni[0].foto;
    delete correzioni[0].loghi;
    const a = ambiente({ correzioni: correzioni });
    await a.report.importaCorrezioniCorreggo();
    scegliTutte(a.report, "edit:31:descrizione", TIPO.descrizione);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "descrizione").length, 0);
    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 0);
    assert.strictEqual(operazioni(a.registro, "cambioStrutturale").length, 0);
    assert.strictEqual(operazioni(a.registro, "leggiScheda").length, 0);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["edit:31:descrizione"]);
    assert.strictEqual(ricapitolo(a.messaggi).tipo, "success");
});

test("I20-1233: un box che non si rifa' dopo il cambio lascia aperte le sue correzioni, con il motivo", async () => {
    const a = ambiente({ rifaiNonRiesce: true });
    await importaEApprova(a);

    await a.report.confermaCorrezioniCorreggo();

    const approvate = chiusura(a.registro)[0].corpo.approvate;
    assert.ok(!approvate.includes("edit:31:offerta"));
    assert.ok(!approvate.includes("timbro:7"));
    assert.ok(approvate.includes("timbro:9"));
    assert.strictEqual(ricapitolo(a.messaggi).tipo, "warning");
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

    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => r.basecode), ["8001"]);
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

/* ---- I20-1233: gli scambi del menabo' avanzato ---- */

/// Il Marketing nel menabo' avanzato ha scambiato 8001 e 8005 in pagina 3; la 8002 l'ha messa in una
/// casella che nell'impaginato era vuota. boundsDestinazione e' il rettangolo della casella di
/// destinazione nell'export: qui, dove stava il box che c'era (POSIZIONI).
function scambiDiProva() {
    return [
        scambio(41, "8001", "8005"),
        scambio(45, "8005", "8001"),
        scambio(42, "8002", "", "casella 6 di pagina 3, che nell'impaginato non aveva un box: da sistemare a mano")
    ];
}

function scambio(idVoce, basecode, destinazione, aMano) {
    return {
        id: "timone:" + idVoce, tipo: "timone", basecode: basecode, labelBox: "BOX_STD_" + basecode, pagina: 3,
        autore: "Mario Marketing", tipoAutore: "Marketing", codice: basecode,
        basecodeDestinazione: destinazione, labelBoxDestinazione: destinazione ? "BOX_STD_" + destinazione : "",
        daSistemareAMano: aMano || null,
        boundsDestinazione: aMano ? null : POSIZIONI[destinazione].slice()
    };
}

function approvaScambi(report) {
    report._correggo.voci.filter(v => v.tipo === TIPO.scambio).forEach(v => correggo.scegli(v, SCELTA.approva, true));
}

test("I20-1233: gli scambi arrivano senza scelta; quello da sistemare a mano non si approva", async () => {
    const a = ambiente({ correzioni: scambiDiProva() });
    await a.report.importaCorrezioniCorreggo();

    const scambi = a.report._correggo.voci.filter(v => v.tipo === TIPO.scambio);
    assert.deepStrictEqual(scambi.map(v => v.testo), [
        "Menabò avanzato: 8001 va al posto di 8005",
        "Menabò avanzato: 8005 va al posto di 8001",
        "Menabò avanzato: 8002 spostata, casella 6 di pagina 3, che nell'impaginato non aveva un box: da sistemare a mano"
    ]);
    assert.ok(scambi.every(v => v.scelta === SCELTA.nessuna));
    approvaScambi(a.report);
    assert.deepStrictEqual(scambi.map(v => v.scelta), [SCELTA.approva, SCELTA.approva, SCELTA.nessuna]);
    assert.strictEqual(scambi[2].approvabile, false);
});

test("I20-1233: ogni box va nel rettangolo che la sua casella aveva nell'export", async () => {
    const a = ambiente({ correzioni: scambiDiProva() });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const rifatti = operazioni(a.registro, "rifaiBox");
    assert.deepStrictEqual(rifatti.map(r => [r.basecode, r.bounds]), [
        ["8001", POSIZIONI["8005"]],
        ["8005", POSIZIONI["8001"]]
    ]);
    assert.deepStrictEqual(rifatti[0].records, schedaDi("8001"));
    //I due scambi applicati si mandano a Correggo4, quello a mano no.
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate.slice().sort(), ["timone:41", "timone:45"]);
    assert.strictEqual(ricapitolo(a.messaggi).tipo, "success");
});

test("I20-1233: due giri sullo stesso export, la referenza rimessa a casa torna al suo posto", async () => {
    //Prova del 13/11. Primo giro gia' applicato nel documento: 8001 e 8003 scambiate. Nel secondo il
    //Marketing ha rimesso la 8001 nella sua casella e ha scambiato 8003 e 8002.
    const a = ambiente({
        correzioni: [scambio(61, "8001", "8001"), scambio(62, "8003", "8002"), scambio(63, "8002", "8003")],
        posizioniNelDocumento: { "8001": POSIZIONI["8003"], "8003": POSIZIONI["8001"] },
        riferimentiUxp: true
    });
    await a.report.importaCorrezioniCorreggo();
    assert.strictEqual(a.report._correggo.voci.find(v => v.idCorrezione === "timone:61").testo, "Menabò avanzato: 8001 torna al suo posto");
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => [r.basecode, r.bounds]), [
        ["8001", POSIZIONI["8001"]],
        ["8003", POSIZIONI["8002"]],
        ["8002", POSIZIONI["8003"]]
    ]);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate.slice().sort(), ["timone:61", "timone:62", "timone:63"]);
});

test("I20-1233: un box gia' al suo posto non si rifa' e conta come applicato", async () => {
    //Il giro di prima e' gia' nel documento: 8001 e 8005 stanno gia' dove le vuole il menabo'.
    const a = ambiente({
        correzioni: scambiDiProva().slice(0, 2),
        //la 8001 a meno di un punto dal rettangolo della 8005: l'export arrotonda
        posizioniNelDocumento: { "8001": [70.4, 69.6, 160, 160], "8005": POSIZIONI["8001"] }
    });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 0);
    assert.strictEqual(operazioni(a.registro, "leggiScheda").length, 0);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate.slice().sort(), ["timone:41", "timone:45"]);
});

test("I20-1233: sulla pagina destra al rettangolo dell'export si rimette la larghezza della pagina", async () => {
    const a = ambiente({ correzioni: scambiDiProva().slice(0, 1), paginaDestra: true });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const p = POSIZIONI["8005"];
    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => r.bounds), [[p[0], p[1] + 210, p[2], p[3] + 210]]);
});

test("I20-1233: ogni box dello scambio si cerca subito prima di rifarlo, non con un riferimento preso prima", async () => {
    //Prova del 13/11: KitKat e Kinder scambiati. Rifatto il primo, il riferimento al secondo preso
    //all'inizio puntava al box appena rifatto, e la scheda si chiedeva con il suo idRec.
    const a = ambiente({ correzioni: scambiDiProva().slice(0, 2), riferimentiUxp: true });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const rifatti = operazioni(a.registro, "rifaiBox");
    assert.deepStrictEqual(rifatti.map(r => [r.basecode, r.bounds]), [
        ["8001", POSIZIONI["8005"]],
        ["8005", POSIZIONI["8001"]]
    ]);
    assert.deepStrictEqual(rifatti[1].records, schedaDi("8005"));
    assert.deepStrictEqual(operazioni(a.registro, "leggiScheda").map(r => r.basecode), ["8001", "8005"]);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate.slice().sort(), ["timone:41", "timone:45"]);
});

test("I20-1233: gli scambi si fanno dopo le altre correzioni dei box", async () => {
    const correzioni = correzioniDiProva().filter(c => c.id === "edit:31:offerta").concat(scambiDiProva().slice(0, 2));
    const a = ambiente({ correzioni: correzioni });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const ordine = a.registro.filter(r => r.op === "cambioStrutturale" || r.op === "rifaiBox")
        .map(r => r.op + " " + (r.dettaglio ? r.dettaglio.codiceGruppo : r.basecode) + (r.bounds ? " scambio" : ""));
    assert.deepStrictEqual(ordine, ["cambioStrutturale 8001", "rifaiBox 8001", "rifaiBox 8001 scambio", "rifaiBox 8005 scambio"]);
});

test("I20-1233: un box che manca nel documento fa fallire solo il suo scambio", async () => {
    const a = ambiente({ correzioni: scambiDiProva(), boxMancanti: ["8005"] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    //La 8001 va nel rettangolo della casella della 8005 anche se il box della 8005 non c'e'.
    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => [r.basecode, r.bounds]), [["8001", POSIZIONI["8005"]]]);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["timone:41"]);
    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.ok(r.testo.includes("8005 al posto di 8001: box non trovato nel documento"));
});

test("I20-1233: un box che non si rifa' lascia aperto il suo scambio, l'altro si fa", async () => {
    const a = ambiente({ correzioni: scambiDiProva(), rifaiNonRiesceSu: ["8005"] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["timone:41"]);
    assert.ok(ricapitolo(a.messaggi).testo.includes("8005 al posto di 8001: il box non e' stato reimpaginato"));
});

test("I20-1233: senza il FATTO del menabò avanzato il motivo si dice una volta sola", async () => {
    const motivo = "Il menabò avanzato si chiude con il FATTO quando tutti i suoi scambi e raggruppamenti sono applicati: ne mancano 1.";
    const a = ambiente({
        correzioni: scambiDiProva(),
        chiusura: (approvate) => approvate.map(id => ({ id: id, ok: false, codice: "timone_non_fatto", messaggio: motivo }))
    });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.strictEqual(r.testo.split("menabò avanzato non FATTO").length - 1, 1);
    assert.ok(r.testo.includes(motivo));
});

test("I20-1233: il box dello scambio non e' mai quello messo da parte su cloneVecchioImpaginato", () => {
    const a = ambiente();
    const clone = { isValid: true, itemLayer: { name: "cloneVecchioImpaginato" }, dna: { codice_gruppo: "8001" } };
    const vivo = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "8001" } };
    const altro = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "8005" } };
    a.report._resolveBoxByCodiceGruppo = () => clone;
    a.report._getDocumentPageByName = () => ({ groups: [clone, altro, vivo] });
    globalThis.Utility.getDnaOfBox = (box) => box.dna;

    assert.strictEqual(a.report._boxDelloScambio("8001", 3), vivo);

    //Se il primo trovato e' gia' quello vivo, si usa quello.
    a.report._resolveBoxByCodiceGruppo = () => vivo;
    assert.strictEqual(a.report._boxDelloScambio("8001", 3), vivo);
});

test("I20-1233: la linea che ha cambiato referenze dopo l'export si trova lo stesso, se e' una sola", () => {
    //Prova del 13/11: il Formaggio era 4031872 nell'export e 4031872,4031873,6382378 nel documento.
    const a = ambiente();
    const linea = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "4031872,4031873,6382378" } };
    const cloneLinea = { isValid: true, itemLayer: { name: "cloneVecchioImpaginato" }, dna: { codice_gruppo: "4031872,4031873,6382378" } };
    const altra = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "4433910,5159040" } };
    a.report._resolveBoxByCodiceGruppo = () => null;
    a.report._getDocumentPageByName = () => ({ groups: [altra, cloneLinea, linea] });
    globalThis.Utility.getDnaOfBox = (box) => box.dna;

    assert.strictEqual(a.report._boxDelloScambio("4031872", 13), linea);

    //Due box vivi con la stessa referenza: non si sceglie a caso.
    const doppione = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "4031872,9999999" } };
    a.report._getDocumentPageByName = () => ({ groups: [linea, doppione] });
    assert.strictEqual(a.report._boxDelloScambio("4031872", 13), null);

    //Il codice esatto vince sulla linea che lo contiene.
    const esatto = { isValid: true, itemLayer: { name: "InPagina" }, dna: { codice_gruppo: "4031872" } };
    a.report._getDocumentPageByName = () => ({ groups: [linea, esatto] });
    assert.strictEqual(a.report._boxDelloScambio("4031872", 13), esatto);
});

test("I20-1233: la scheda dello scambio si chiede con il codice che il box ha adesso", async () => {
    const a = ambiente({ correzioni: scambiDiProva().slice(0, 1) });
    globalThis.Utility.getDnaOfBox = (box) => ({ idRec: String(box.idRec), codice_gruppo: box.basecode === "8001" ? "8001,8009" : box.basecode });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);
    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(operazioni(a.registro, "leggiScheda").map(r => r.basecode), ["8001,8009"]);
    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => r.basecode), ["8001"]);
});

test("I20-1233: all'importazione uno scambio gia' al suo posto non chiede niente e alla conferma conta", async () => {
    //Il giro di prima e' gia' nel documento ma il FATTO non c'e': il piano torna intero.
    const a = ambiente({
        correzioni: scambiDiProva().slice(0, 2),
        posizioniNelDocumento: { "8001": POSIZIONI["8005"] }
    });
    await a.report.importaCorrezioniCorreggo();

    const [primo, secondo] = a.report._correggo.voci.filter(v => v.tipo === TIPO.scambio);
    assert.strictEqual(primo.giaAlSuoPosto, true);
    assert.strictEqual(primo.scelta, SCELTA.approva);
    assert.strictEqual(secondo.giaAlSuoPosto, undefined);
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => r.basecode), ["8005"]);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate.slice().sort(), ["timone:41", "timone:45"]);
});

test("I20-1233: una referenza allargata dallo stesso angolo si rifa', non e' gia' al suo posto", async () => {
    //8001 resta nella casella 1 ma diventa larga due: l'angolo e' lo stesso, la misura no.
    const larga = Object.assign(scambio(71, "8001", "8001"), { boundsDestinazione: [10, 10, 60, 120], colonne: 2, righe: 1 });
    const a = ambiente({ correzioni: [larga] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.deepStrictEqual(operazioni(a.registro, "rifaiBox").map(r => [r.basecode, r.bounds]), [["8001", [10, 10, 60, 120]]]);
});

test("I20-1233: gli scambi gia' al loro posto non si contano nella linguetta", async () => {
    const a = ambiente({
        correzioni: scambiDiProva().slice(0, 2),
        posizioniNelDocumento: { "8001": POSIZIONI["8005"] }
    });
    await a.report.importaCorrezioniCorreggo();

    assert.strictEqual(a.report._correggo.voci.length, 2);
    assert.ok(a.report._etichettaLinguettaCorreggo().includes("1"));
    assert.ok(!a.report._etichettaLinguettaCorreggo().includes("2"));
});

/* ---- I20-1233: i raggruppamenti del menabo' avanzato ---- */

/// Il Marketing ha unito nel menabo' avanzato i box di altri al box di capo, nella casella di capo.
function raggruppamento(idVoce, capo, altri) {
    return Object.assign(scambio(idVoce, capo, capo), {
        casella: 1,
        unisci: altri.map(b => ({ basecode: b, labelBox: "BOX_STD_" + b, pagina: 3 })),
        codici: [capo].concat(altri)
    });
}

test("I20-1233: un raggruppamento approvato unisce i box con il Raggruppa, il capogruppo per primo", async () => {
    const a = ambiente({ correzioni: [raggruppamento(61, "8001", ["8002"])] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const r = operazioni(a.registro, "raggruppaBox");
    assert.strictEqual(r.length, 1);
    assert.deepStrictEqual(r[0].lista, [{ codice: "8001", idRec: 501 }, { codice: "8002", idRec: 502 }]);
    assert.deepStrictEqual(r[0].bounds, POSIZIONI["8001"]);
    assert.deepStrictEqual(r[0].togliere, ["8001", "8002"]);
    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 0);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["timone:61"]);
});

test("I20-1233: sulla stessa pagina gli scambi si fanno prima dei raggruppamenti", async () => {
    const a = ambiente({ correzioni: [raggruppamento(61, "8001", ["8002"]), scambio(63, "8003", "8005"), scambio(65, "8005", "8003")] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    const ordine = a.registro.filter(x => x.op === "rifaiBox" || x.op === "raggruppaBox").map(x => x.op);
    assert.deepStrictEqual(ordine, ["rifaiBox", "rifaiBox", "raggruppaBox"]);
});

test("I20-1233: un gruppo gia' unito nella sua casella non si raggruppa di nuovo", async () => {
    const a = ambiente({
        correzioni: [raggruppamento(61, "8001", ["8002"])],
        posizioniNelDocumento: { "8001,8002": POSIZIONI["8001"] }
    });
    await a.report.importaCorrezioniCorreggo();
    const v = a.report._correggo.voci.find(x => x.tipo === TIPO.scambio);
    assert.strictEqual(v.giaAlSuoPosto, true);
    assert.strictEqual(v.testo, "Menabò avanzato: il gruppo di 8001 e 8002 è già unito al suo posto");

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "raggruppaBox").length, 0);
    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 0);
    assert.deepStrictEqual(chiusura(a.registro)[0].corpo.approvate, ["timone:61"]);
});

test("I20-1233: un Raggruppa rifiutato da Istanta non registra il FATTO e dice perche'", async () => {
    const a = ambiente({ correzioni: [raggruppamento(61, "8001", ["8002"])], raggruppaNonRiesce: true });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(chiusura(a.registro).length, 0);
    const r = ricapitolo(a.messaggi);
    assert.strictEqual(r.tipo, "warning");
    assert.ok(r.testo.includes("gruppo di 8001 e 8002: Errore durante il salvataggio delle modifiche: gruppo rifiutato"), r.testo);
});

test("I20-1233: manca un box del gruppo: niente Raggruppa", async () => {
    const a = ambiente({ correzioni: [raggruppamento(61, "8001", ["8002"])], boxMancanti: ["8002"] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "raggruppaBox").length, 0);
    assert.ok(ricapitolo(a.messaggi).testo.includes("gruppo di 8001 e 8002: box 8002 non trovato nel documento"));
});

/* ---- I20-1233: lo sgruppa dal menabo' avanzato si fa a mano ---- */

/// Un documento dove 8001 e 8002, unite in Correggo da un giro precedente, sono un box solo nella casella
/// di 8001; la ricerca per codice esatto di 8001 e 8002 non trova niente, la pagina ha solo quel box.
function conGruppoUnito(opzioni) {
    const a = ambiente(Object.assign({ boxMancanti: ["8001", "8002"] }, opzioni));
    const unito = { isValid: true, itemLayer: { name: "InPagina" }, basecode: "8001,8002", idRec: 512,
        geometricBounds: POSIZIONI["8001"].slice(), parentPage: { name: "3", bounds: [0, 0, 297, 210] } };
    a.report._getDocumentPageByName = () => ({ name: "3", bounds: [0, 0, 297, 210], groups: [unito] });
    globalThis.Utility.getDnaOfBox = (box) => ({ idRec: String(box.idRec), codice_gruppo: box.basecode });
    return a;
}

const SUL_MENABO = ["8001", "8002", "8003", "8005"];



test("I20-1233: una referenza staccata nel menabò da un gruppo formato in Correggo arriva a mano e non tocca il box", async () => {
    const staccata = Object.assign(scambio(71, "8002", "8003"), { codici: ["8002"], codiciDelBox: ["8002"], codiciTimone: SUL_MENABO });
    const a = conGruppoUnito({ correzioni: [staccata] });
    await a.report.importaCorrezioniCorreggo();
    const v = a.report._correggo.voci.find(x => x.tipo === TIPO.scambio);
    assert.strictEqual(v.approvabile, false);
    assert.strictEqual(v.testo, "Menabò avanzato: 8002, staccata nel menabò dal gruppo 8001,8002: lo sgruppa va fatto a mano");
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 0);
    assert.strictEqual(operazioni(a.registro, "raggruppaBox").length, 0);
    assert.strictEqual(chiusura(a.registro).length, 0);
});

test("I20-1233: anche il capogruppo rimasto nella sua casella non risulta già al suo posto: lo sgruppa è a mano", async () => {
    const capo = Object.assign(scambio(73, "8001", "8001"), { codici: ["8001"], codiciDelBox: ["8001"], codiciTimone: SUL_MENABO });
    const a = conGruppoUnito({ correzioni: [capo] });
    await a.report.importaCorrezioniCorreggo();

    const v = a.report._correggo.voci.find(x => x.tipo === TIPO.scambio);
    assert.notStrictEqual(v.giaAlSuoPosto, true);
    assert.strictEqual(v.approvabile, false);
});

test("I20-1233: referenze in più che non vengono dal menabò (listato cambiato) non fermano lo scambio: il box si sposta intero", async () => {
    const formaggio = Object.assign(scambio(75, "8002", "8003"), { codici: ["8002"], codiciDelBox: ["8002"], codiciTimone: ["8002", "8003"] });
    const a = conGruppoUnito({ correzioni: [formaggio] });
    await a.report.importaCorrezioniCorreggo();
    //La riga si guarda prima della conferma: dopo, il report reimporta e le correzioni chiuse spariscono.
    const v = a.report._correggo.voci.find(x => x.tipo === TIPO.scambio);
    assert.notStrictEqual(v.approvabile, false);
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "rifaiBox").length, 1);
});


test("I20-1233: un raggruppamento che prende un box già unito ad altre referenze del menabò è a mano", async () => {
    const gruppo = Object.assign(raggruppamento(77, "8003", ["8002"]), { codiciDelBox: ["8003"], codiciTimone: SUL_MENABO });
    gruppo.unisci[0].codici = ["8002"];
    const a = conGruppoUnito({ correzioni: [gruppo], boxMancanti: ["8002"] });
    await a.report.importaCorrezioniCorreggo();
    approvaScambi(a.report);

    await a.report.confermaCorrezioniCorreggo();

    assert.strictEqual(operazioni(a.registro, "raggruppaBox").length, 0);
    assert.ok(ricapitolo(a.messaggi).testo.includes("il box 8002 nel documento è già unito ad altre referenze del menabò: da sistemare a mano"));
});

test("I20-1233: il Raggruppa toglie i box di partenza per id, anche quando i riferimenti scorrono come in UXP", async () => {
    //Prova del 13/11, pagina 12: con il box nuovo in pagina i riferimenti presi prima puntavano ad altri
    //box, e sparivano la Pizza Margherita al posto dei Pisellini.
    const schedaVera = require("../../plugin/schedaRef.js");
    const XHR = require("../../plugin/XMLHttpRequestClient");
    const gruppi = [{ id: 11, nome: "minestrone" }, { id: 12, nome: "pisellini" }, { id: 13, nome: "margherita" }];
    const tolti = [];
    const togli = (i) => { tolti.push(gruppi[i].nome); gruppi.splice(i, 1); };
    //Il riferimento di UXP: il gruppo che sta in quel posto dell'elenco quando lo si usa.
    const riferimento = (i) => ({ get id() { return gruppi[i].id; }, get isValid() { return i < gruppi.length; }, remove() { togli(i); } });
    const conservati = {};
    ["app", "CssFramework", "showLoading", "pathLavorazione", "idKitLavorazione", "impaginaBox", "XMLHttpRequest"].forEach(k => { conservati[k] = globalThis[k]; });
    Object.assign(globalThis, {
        //XMLHttpRequestClient lo crea nel costruttore; qui la richiesta non parte.
        XMLHttpRequest: class { },
        app: { activeDocument: { pageItems: { itemByID: (id) => {
            const i = gruppi.findIndex(g => g.id === id);
            return i < 0 ? { isValid: false } : { isValid: true, remove() { togli(gruppi.findIndex(g => g.id === id)); } };
        } } } },
        CssFramework: { richiediDiScaricareFramework() { } },
        showLoading() { },
        pathLavorazione: "/percorso/di/prova",
        idKitLavorazione: 3232,
        //Il box nuovo entra in testa all'elenco dei gruppi della pagina.
        impaginaBox: async () => { gruppi.unshift({ id: 99, nome: "nuovo" }); return { trovato: true, listElementiNonImpaginati: [] }; }
    });
    const inviaOriginale = XHR.prototype.send;
    XHR.prototype.send = function () {
        setImmediate(() => this.onload({ esito: true, gruppo: { codiceBox: "BOX_STD", combinazioneAssegnata: "" } }, true));
    };
    try {
        const esito = await schedaVera.raggruppaBox([{ codice: "4595458", idRec: 94103 }, { codice: "4951152", idRec: 94066 }],
            { name: "12" }, [26.5, 8.5, 108.31, 71], [riferimento(0), riferimento(1)]);

        assert.strictEqual(esito.esito, true);
        assert.deepStrictEqual(tolti.sort(), ["minestrone", "pisellini"]);
        assert.deepStrictEqual(gruppi.map(g => g.nome).sort(), ["margherita", "nuovo"]);
    }
    finally {
        XHR.prototype.send = inviaOriginale;
        Object.assign(globalThis, conservati);
    }
});

test("I20-1233: alla fine della conferma il livello delle versioni precedenti è spento", async () => {
    const livello = { isValid: true, visible: true };
    //reportIntegrita.js prende app da require('indesign'): il livello va sul documento finto del caricamento.
    const conservato = app.activeDocument.layers;
    app.activeDocument.layers = { itemByName: (nome) => nome === "cloneVecchioImpaginato" ? livello : { isValid: false } };
    try {
        const a = ambiente({ correzioni: scambiDiProva().slice(0, 2) });
        await a.report.importaCorrezioniCorreggo();
        approvaScambi(a.report);

        await a.report.confermaCorrezioniCorreggo();

        assert.strictEqual(livello.visible, false);
    }
    finally {
        app.activeDocument.layers = conservato;
    }
});

test("I20-1233: una correzione rifiutata torna rifiutata all'importazione successiva", async () => {
    const a = ambiente({ correzioni: scambiDiProva().slice(0, 2) });
    let ricordate = [];
    a.report._leggiRifiutateCorreggo = () => ricordate.slice();
    a.report._salvaRifiutateCorreggo = (lista) => { ricordate = lista.slice(); };
    await a.report.importaCorrezioniCorreggo();
    const v = a.report._correggo.voci.find(x => x.idCorrezione === "timone:41");
    correggo.scegli(v, SCELTA.rifiuta, true);
    a.report.registraSceltaCorreggo(v);

    await a.report.importaCorrezioniCorreggo();

    assert.strictEqual(ricordate.length, 1);
    assert.strictEqual(a.report._correggo.voci.find(x => x.idCorrezione === "timone:41").scelta, SCELTA.rifiuta);
    assert.notStrictEqual(a.report._correggo.voci.find(x => x.idCorrezione === "timone:45").scelta, SCELTA.rifiuta);
});
