/*
 * I20-1065: le cartelle di sistema le crea il Plugin.
 *
 * La finestra delle cartelle chiede solo Links e Loghi. logs, export e SingularData il Plugin le crea
 * da solo sotto la cartella del documento (o del libro), senza chiedere: con fullAccess
 * getEntryWithUrl e createFolder funzionano, l'operatore l'ha provato in console. In SingularData
 * ogni postazione ha la sua cartella, col suo identificativo, e li' stanno il file delle lavorazioni
 * e i file di lavoro del documento: lista del kit, allineamenti, conteggio, filtri, report.
 *
 * utility.js e indexNew.js fanno require('indesign'): le funzioni si prendono dal sorgente e girano
 * su un file system UXP finto, come in lavorazioniPerMacchina.test.js. Il resto si controlla sul
 * sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const ID = "mac-mini-di-sm2_k3F9a2Lp0Q";

const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = utility.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = utility.indexOf("\n    },\n", inizio);
    return utility.substring(inizio, fine + "\n    }".length);
}

function costanti() {
    const inizio = utility.indexOf("    CARTELLA_LOGS:");
    const fine = utility.indexOf("\n", utility.indexOf("    NOME_FILE_LAVORAZIONI:"));
    assert.ok(inizio > 0 && fine > inizio);
    return utility.substring(inizio, fine).replace(/,\s*$/, "");
}

function utilityCartelle(globali = {}) {
    const membri = ["_senzaBarraFinale(", "cartellaDatiMacchina(", "cartellaDati(", "percorsoDati(",
        "async preparaCartelleDiSistema(", "async _cartellaFiglia("].map(corpoMembro);
    const fabbrica = new Function("SingularPath", "pathLavorazione", "idMacchina", "require",
        "const Utility = ({\n" + costanti() + ",\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    return fabbrica(globali.SingularPath || "", globali.pathLavorazione || "", () => ID, () => {
        throw new Error("il file system va passato dal test");
    });
}

//Un file system UXP finto: le cartelle che esistono, per percorso. Come su Mac, i nomi non
//distinguono maiuscole e minuscole. createFolder registra quello che crea.
function fileSystemUxp(esistenti, { soloLettura = false } = {}) {
    const cartelle = new Set(esistenti);
    const create = [];
    const trova = (p) => [...cartelle].find(c => c.toLowerCase() === p.toLowerCase());
    const cartella = (p) => ({
        nativePath: p,
        isFolder: true,
        getEntry: async (nome) => {
            const trovata = trova(p + "/" + nome);
            if (trovata == null) {
                throw new Error("non trovata: " + p + "/" + nome);
            }
            return cartella(trovata);
        },
        createFolder: async (nome) => {
            if (soloLettura) {
                throw new Error("permesso negato: " + p);
            }
            const nuova = p + "/" + nome;
            cartelle.add(nuova);
            create.push(nuova);
            return cartella(nuova);
        }
    });
    return {
        create,
        getEntryWithUrl: async (url) => {
            const p = String(url).replace(/^file:\/\//, "");
            const trovata = trova(p);
            if (trovata == null) {
                throw new Error("non trovata: " + p);
            }
            return cartella(trovata);
        }
    };
}

/* ---- creare le cartelle ---- */

test("un documento nuovo: logs, export, SingularData e la cartella della postazione nascono da sole", async () => {
    const lfs = fileSystemUxp(["/doc"]);

    const cartelle = await utilityCartelle().preparaCartelleDiSistema("/doc", ID, lfs);

    assert.deepStrictEqual(cartelle, { logPath: "/doc/logs/", exportPath: "/doc/export/", SingularPath: "/doc/SingularData/" + ID });
    assert.deepStrictEqual(lfs.create, ["/doc/logs", "/doc/export", "/doc/SingularData", "/doc/SingularData/" + ID]);
});

test("le cartelle che ci sono gia' si riusano, anche con le maiuscole diverse", async () => {
    const lfs = fileSystemUxp(["/doc", "/doc/Logs", "/doc/Export", "/doc/SingularData", "/doc/SingularData/pc-ufficio_Zx81QwErTy"]);

    const cartelle = await utilityCartelle().preparaCartelleDiSistema("/doc/", ID, lfs);

    assert.deepStrictEqual(cartelle, { logPath: "/doc/Logs/", exportPath: "/doc/Export/", SingularPath: "/doc/SingularData/" + ID });
    //Si crea solo la cartella di questa postazione, accanto a quella dell'altra.
    assert.deepStrictEqual(lfs.create, ["/doc/SingularData/" + ID]);
});

test("se la cartella del documento non si puo' scrivere, l'errore arriva a chi chiama", async () => {
    const lfs = fileSystemUxp(["/doc"], { soloLettura: true });
    await assert.rejects(() => utilityCartelle().preparaCartelleDiSistema("/doc", ID, lfs), /permesso negato/);
});

/* ---- i file di lavoro ---- */

test("i file di lavoro stanno nella cartella della postazione", () => {
    const u = utilityCartelle({ SingularPath: "/doc/SingularData/" + ID });
    assert.strictEqual(u.percorsoDati("Filtri.json"), "/doc/SingularData/" + ID + "/Filtri.json");
    //Prima che le cartelle siano preparate, la cartella e' quella che sara'.
    assert.strictEqual(utilityCartelle({ pathLavorazione: "/altro" }).percorsoDati("allineamenti.json"),
        "/altro/SingularData/" + ID + "/allineamenti.json");
});

/* ---- indexNew.js, sul sorgente ---- */

const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function corpoFunzione(intestazione) {
    const inizio = indice.indexOf(intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    return indice.substring(inizio, indice.indexOf("\n}\n", inizio) + 2);
}

test("all'apertura le cartelle si preparano solo se il documento ha gia' una lavorazione, prima di leggerla", () => {
    //I20-1133: un .indd qualunque, senza lavorazione, non deve trovarsi logs, export e SingularData. I
    //percorsi del documento aperto prima si azzerano comunque.
    const documento = corpoFunzione("async function initDocumentInLavorazione()");
    const azzera = documento.indexOf("azzeraCartelleDiSistema();");
    assert.ok(azzera > documento.indexOf("pathLavorazione = f.nativePath;"));
    assert.match(documento, /const nomeDocumento = docInLavorazione\.name;\n\s*if \(Utility\.esisteLavorazione\(pathLavorazione, idMacchina\(\), nomeDocumento, libroDelDocumentoInLavorazione\(nomeDocumento\)\)\) \{\n\s*await preparaCartelleDiSistema\(pathLavorazione\);\n\s*\}/);
    assert.strictEqual((documento.match(/preparaCartelleDiSistema\(/g) || []).length, 1);
    const prepara = documento.indexOf("await preparaCartelleDiSistema(pathLavorazione);");
    assert.ok(prepara > azzera);
    //Prima di checklavorazioneSelezionata, che puo' copiare la voce da un'altra postazione.
    assert.ok(prepara < documento.indexOf("ficoProcess.checklavorazioneSelezionata()"));
    assert.ok(prepara < documento.indexOf("leggiContenutoKit(idKitLavorazione);"));

    //Il libro: al primo file che ha una lavorazione, prima di leggerne (e copiarne) la voce.
    const libro = corpoFunzione("async function initLibroInLavorazione()");
    assert.ok(libro.indexOf("azzeraCartelleDiSistema();") > 0);
    assert.match(libro, /if \(!cartellePronte && Utility\.esisteLavorazione\(_pathDelLibro, idMacchina\(\), nomeFile, book\.name\)\) \{\n\s*await preparaCartelleDiSistema\(_pathDelLibro\);\n\s*cartellePronte = true;\n\s*\}\n\s*let voceFile = Utility\.voceLavorazione\(_pathDelLibro,/);
    assert.strictEqual((libro.match(/preparaCartelleDiSistema\(/g) || []).length, 1);
});

test("azzerare le cartelle svuota i tre percorsi senza creare niente, e preparare comincia da li'", () => {
    const azzera = corpoFunzione("function azzeraCartelleDiSistema()");
    assert.match(azzera, /\{\n\s*logPath = "";\n\s*exportPath = "";\n\s*SingularPath = "";\n\}/);
    assert.match(corpoFunzione("async function preparaCartelleDiSistema(base)"), /\{\n\s*azzeraCartelleDiSistema\(\);\n/);
});

/* ---- ficoProcess.js: iniziare o continuare un kit ---- */

const fico = leggiFileDelPlugin("ficoProcess.js").replace(/\r/g, "");

function corpoMetodo(intestazione) {
    const inizio = fico.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovato");
    return fico.substring(inizio, fico.indexOf("\n    },\n", inizio) + "\n    }".length);
}

test("iniziando o continuando un kit le cartelle si preparano prima di scrivere la voce", () => {
    //I20-1133: e' qui che nascono, per un documento che non le aveva.
    const lavoraKit = corpoMetodo("lavoraKit:async function(idKit, idLavorazioneLocale)");
    const passi = lavoraKit.match(/if \(!\(await preparaCartelleDiSistema\(pathLavorazione\)\)\) \{\n\s*return;\n\s*\}\n\s*Utility\.salvaVoceLavorazione\(pathLavorazione, idMacchina\(\), voce\);/g) || [];
    assert.strictEqual(passi.length, 2, "continua e inizia");
    assert.strictEqual((lavoraKit.match(/Utility\.salvaVoceLavorazione\(/g) || []).length, 2);
    //La risposta di iniziaLavorazione aspetta le cartelle.
    assert.match(lavoraKit, /xhr\.onload = async \(objResult, parsed\) =>/);

    //Il kit massivo: prima delle voci, le cartelle di tutti i file.
    const massivo = fico.substring(fico.indexOf("    lavoraKitMassivo:async function()"), fico.indexOf("    preparaCartelleKitMassivo:async function()"));
    const preparaMassivo = massivo.indexOf("await this.preparaCartelleKitMassivo();");
    assert.ok(preparaMassivo > 0);
    assert.ok(preparaMassivo < massivo.indexOf("let result = this.lavoraKitMassivo_Queue(0);"));
});

test("kit massivo: le cartelle una volta per cartella dei file, e una che non si crea si dice con FIP-18", async () => {
    const metodo = corpoMetodo("preparaCartelleKitMassivo:async function()");
    const corpo = metodo.substring(metodo.indexOf("{"));
    const preparate = [];
    const messaggi = [];
    const UtilityFinta = {
        getDirSeparator: () => "/",
        preparaCartelleDiSistema: async (cartella, id) => {
            if (cartella === "/rotta") {
                throw new Error("permesso negato");
            }
            preparate.push([cartella, id]);
        }
    };
    const prepara = new Function("Utility", "idMacchina", "messaggioUtente", "console", "return async function () " + corpo + ";")(
        UtilityFinta, () => ID, (m) => messaggi.push(m), { error: () => {} });

    const pronte = await prepara.call({
        cacheKitSearchResult: [{ fullName: "/a/uno.indd" }, { fullName: "/a/due.indd" }, { fullName: "/rotta/tre.indd" }, { fullName: "/b/quattro.indd" }, null]
    });

    assert.deepStrictEqual(preparate, [["/a", ID], ["/b", ID]]);
    assert.deepStrictEqual(pronte, ["/a", "/b"]);
    assert.strictEqual(messaggi.length, 1);
    assert.match(messaggi[0], /^Code FIP-18 .*\/rotta/);
});

test("preparate le cartelle se ne fissano i percorsi; se non si creano lo si dice con IDX-177", () => {
    assert.match(indice, /\nvar logPath = "";\nvar exportPath = "";\nvar SingularPath = "";\n/);

    const prepara = corpoFunzione("async function preparaCartelleDiSistema(base)");
    assert.match(prepara, /await Utility\.preparaCartelleDiSistema\(base, idMacchina\(\), fs2\);\s*logPath = cartelle\.logPath;\s*exportPath = cartelle\.exportPath;\s*SingularPath = cartelle\.SingularPath;/);
    assert.match(prepara, /messaggioUtente\("Code IDX-177 /);

    const usi = fileDelPlugin().reduce((n, f) => n + (leggiFileDelPlugin(f).match(/Code IDX-177 /g) || []).length, 0);
    assert.strictEqual(usi, 1);
});

test("nessun file di lavoro si scrive piu' nella cartella del documento", () => {
    const fileDiLavoro = /pathLavorazione\s*\+\s*"\/(listaKit|listaRefConteggio|listaRefEscluse|allineamenti|Filtri|reportIntegrita_|whitelistIntegrita_|listaImpaginata|lavorazioni)/;
    for (const file of fileDelPlugin()) {
        const codice = leggiFileDelPlugin(file).replace(/\r/g, "").split("\n").filter(r => !/^\s*\/\//.test(r)).join("\n");
        assert.doesNotMatch(codice, fileDiLavoro, file);
    }
    assert.match(leggiFileDelPlugin("filtri.js"), /return Utility\.percorsoDati\("Filtri" \+ nomeFileSenzaEstensione \+ "\.json"\);/);
    assert.match(leggiFileDelPlugin("reportIntegrita/reportIntegrita.js"), /return Utility\.percorsoDati\(Utility\.nomeFileReportIntegrita\(kit\)\);/);
    assert.match(leggiFileDelPlugin("reportIntegrita/reportIntegrita.js"), /return Utility\.percorsoDati\(Utility\.nomeFileWhitelistIntegrita\(kit\)\);/);
});

test("lo stato del libro si scrive nella cartella della postazione, e quello di prima si legge soltanto", () => {
    assert.match(corpoFunzione("function percorsoStatoLibro(cartellaLibro)"), /Utility\.cartellaDatiMacchina\(cartellaLibro, idMacchina\(\)\)/);
    assert.match(corpoFunzione("async function registraStatoLavorazioneLibro()"), /let filePath = percorsoStatoLibro\(_pathLavorazioneLibro\);/);
    const leggi = corpoFunzione("async function leggiStatoLavorazioneLibro()");
    assert.match(leggi, /let file = readFile\(percorsoStatoLibro\(_pathLavorazioneLibro\)\);\s*if \(file == null\) \{/);
});

test("si esporta in export sotto il documento, e il csv del report di conseguenza", () => {
    const fico = leggiFileDelPlugin("ficoProcess.js");
    assert.ok((fico.match(/exportPath \+ /g) || []).length >= 8);
    assert.match(leggiFileDelPlugin("reportIntegrita/reportIntegrita.js"), /typeof exportPath !== "undefined" \? String\(exportPath \|\| ""\) : ""/);
});
