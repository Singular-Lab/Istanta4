/*
 * I20-1057: la quinta cartella di sistema, quella delle lavorazioni, e dove vive lavorazioni.json.
 *
 * Alle cartelle links, loghi, logs ed export se ne aggiunge una per le lavorazioni (oggi una sola,
 * domani piu' d'una). Si riconosce da sola se sotto la cartella del documento c'e' .lavorazioni,
 * lavorazioni o lavorazione, in quest'ordine; altrimenti la sceglie l'operatore come le altre.
 * lavorazioni.json si legge e si scrive li'; un file di prima nella cartella del documento resta in
 * uso finche' l'operatore non lo sposta.
 *
 * I20-1065: la cartella delle lavorazioni non si usa piu' (al suo posto SingularData, vedi
 * cartelleDiSistema.test.js): si cerca solo per ritrovare i file di prima, e i casi qui sotto valgono
 * ancora per quello. La finestra chiede soltanto Links e Loghi.
 *
 * utility.js fa require('indesign'): le funzioni si prendono dal sorgente con un fs finto, come in
 * nomeListaKit.test.js. Il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { fileDelPlugin, leggiFileDelPlugin } = require("./fileDelPlugin");

const sorgente = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = sorgente.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    return sorgente.substring(inizio, fine + "\n    }".length);
}

//Un disco finto: le chiavi sono le cartelle, i valori le voci che contengono. readdirSync riesce
//solo sulle cartelle, come quello vero.
function utilityCon(cartelle) {
    const membri = ["nomiCartellaLavorazioni(", "_senzaBarraFinale(", "cartellaLavorazioni("].map(corpoMembro);
    const fabbrica = new Function("require", "const Utility = ({\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    return fabbrica((nome) => {
        assert.strictEqual(nome, "fs");
        return {
            readdirSync: (percorso) => {
                if (!Object.prototype.hasOwnProperty.call(cartelle, percorso)) {
                    throw new Error("ENOTDIR " + percorso);
                }
                return cartelle[percorso];
            }
        };
    });
}

/* ---- la cartella delle lavorazioni ---- */

test("vale il primo nome che c'e', nell'ordine .lavorazioni, lavorazioni, lavorazione", () => {
    const tutte = utilityCon({ "/doc": [".lavorazioni", "lavorazioni", "lavorazione"], "/doc/.lavorazioni": [], "/doc/lavorazioni": [], "/doc/lavorazione": [] });
    assert.strictEqual(tutte.cartellaLavorazioni("/doc"), "/doc/.lavorazioni");

    const dueNomi = utilityCon({ "/doc": ["lavorazione", "lavorazioni"], "/doc/lavorazioni": [], "/doc/lavorazione": [] });
    assert.strictEqual(dueNomi.cartellaLavorazioni("/doc"), "/doc/lavorazioni");

    const unNome = utilityCon({ "/doc": ["Links", "lavorazione"], "/doc/lavorazione": [] });
    assert.strictEqual(unNome.cartellaLavorazioni("/doc"), "/doc/lavorazione");
});

test("il nome si riconosce senza distinguere maiuscole e minuscole, e si tiene come e' scritto", () => {
    const u = utilityCon({ "/doc": ["Lavorazioni"], "/doc/Lavorazioni": [] });
    assert.strictEqual(u.cartellaLavorazioni("/doc"), "/doc/Lavorazioni");
});

test("una voce con quel nome che non e' una cartella non conta", () => {
    const u = utilityCon({ "/doc": [".lavorazioni", "lavorazione"], "/doc/lavorazione": [] });
    assert.strictEqual(u.cartellaLavorazioni("/doc"), "/doc/lavorazione");
    assert.strictEqual(utilityCon({ "/doc": ["lavorazioni"] }).cartellaLavorazioni("/doc"), null);
});

test("senza nessuna delle tre, o con la cartella del documento illeggibile, non c'e'", () => {
    assert.strictEqual(utilityCon({ "/doc": ["Links", "Export", "lavorazioni.json"] }).cartellaLavorazioni("/doc"), null);
    assert.strictEqual(utilityCon({}).cartellaLavorazioni("/doc"), null);
});

test("la cartella del documento puo' arrivare con la barra finale, come quella del libro", () => {
    const u = utilityCon({ "/libro": [".lavorazioni"], "/libro/.lavorazioni": [] });
    assert.strictEqual(u.cartellaLavorazioni("/libro/"), "/libro/.lavorazioni");
    assert.strictEqual(u.cartellaLavorazioni("/libro\\"), "/libro/.lavorazioni");
});

/* ---- dove stanno i file delle lavorazioni ----
 * I20-1061: da qui in poi ogni macchina ha il suo file, e i lavorazioni.json di I20-1057 si leggono
 * soltanto: i casi sono in lavorazioniPerMacchina.test.js. */

/* ---- chi usa il file ---- */

test("nessuno costruisce piu' a mano il percorso di lavorazioni.json", () => {
    const daControllare = fileDelPlugin().filter(f => f !== "utility.js").map(f => ({ nome: f, testo: leggiFileDelPlugin(f) }));
    for (const cliente of ["Edro21", "Coopfi", "Famila"]) {
        const relativo = path.join("Agenzie", cliente, "custom.js");
        daControllare.push({ nome: relativo, testo: fs.readFileSync(path.join(__dirname, "..", "..", "plugin", relativo), "utf8") });
    }

    for (const file of daControllare) {
        assert.doesNotMatch(file.testo, /\+\s*"\/?lavorazioni\.json"/, file.nome);
    }

    //I20-1061: chi legge passa da voceLavorazione, chi scrive dal file di questa macchina. Il file
    //comune non lo legge piu' nessuno direttamente.
    const tutti = daControllare.filter(f => f.nome !== "custom.js");
    const conta = (re) => tutti.reduce((n, f) => n + (f.testo.match(re) || []).length, 0);
    assert.strictEqual(conta(/Utility\.percorsoFileLavorazioni\(/g), 0);
    //I20-1065: erano almeno 10; checkPercorsi rileggeva la voce una seconda volta dopo aver registrato i
    //percorsi, e quella rilettura non serve piu'. Ora il conto e' esatto: indexNew 3, ficoProcess 3, un
    //custom.js per cliente.
    assert.strictEqual(conta(/Utility\.voceLavorazione\(/g), 9);
    assert.strictEqual(conta(/Utility\.salvaVoceLavorazione\(/g), 4);
});

test("ficoProcess non perde il file nuovo e riprende solo i percorsi di Links e Loghi", () => {
    const fico = leggiFileDelPlugin("ficoProcess.js").replace(/\r/g, "");

    //Era "file== readFile(...)": un confronto, e subito dopo file.length andava in errore.
    assert.doesNotMatch(fico, /file\s*==\s*readFile\(/);
    //I20-1061: i percorsi da riprendere si leggono dal file di questa macchina, sempre un elenco.
    assert.strictEqual((fico.match(/let file = Utility\.leggiFileLavorazioni\(filePath\);/g) || []).length, 2);
    //I20-1065: logs, export e lavorazioni non si scrivono piu' nella voce: le crea il Plugin.
    assert.match(fico, /pathLinks:pathLinks, pathLoghi:pathLoghi, details:/);
    assert.match(fico, /pathLinks: pathLinks, pathLoghi: pathLoghi, details:/);
    assert.doesNotMatch(fico, /pathLogs|pathEsportazione|pathLavorazioni/);
});

test("checkPercorsi chiede soltanto Links e Loghi", () => {
    const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indice.indexOf("async function checkPercorsi(");
    const corpo = indice.substring(inizio, indice.indexOf("\n}\n", inizio));

    assert.match(corpo, /const missing = \[percorsoLinks, percorsoLoghi\]\.filter\(/);
    assert.match(corpo, /if \(percorsoLinks && percorsoLoghi\) \{/);
    assert.doesNotMatch(corpo, /pathLogs|pathEsportazione|pathLavorazioni|cartellaLavorazioni/);
    //Le cartelle previste si registrano prima di decidere se aprire la finestra.
    assert.match(corpo, /await impostaPercorsiDiSistema\(0, _pathLavorazione \+ defaultPercorsoLinks\);/);
    assert.match(corpo, /await impostaPercorsiDiSistema\(1, _pathLavorazione \+ defaultPercorsoLoghi\);/);

    const imposta = indice.substring(indice.indexOf("async function impostaPercorsiDiSistema("));
    const corpoImposta = imposta.substring(0, imposta.indexOf("\n}\n"));
    assert.doesNotMatch(corpoImposta, /tipo == [234]/);
    assert.match(corpoImposta, /\["pathFoto", "pathLoghi"\]\.every\(/);
});

test("la finestra ha una riga per Links e una per Loghi, e nient'altro", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "index.html"), "utf8").replace(/\r/g, "");
    const inizio = html.indexOf('<div id="dialogPathDiSistema"');
    assert.notStrictEqual(inizio, -1);
    const finestra = html.substring(inizio, html.indexOf('<div id="dialogEsportaLibro"', inizio));

    const righe = [["pathFoto", 0], ["pathLoghi", 1]];
    assert.strictEqual((finestra.match(/class="rigaPercorso percorsoMancante"/g) || []).length, righe.length);
    for (const [id, tipo] of righe) {
        assert.match(finestra, new RegExp('<div id="' + id + '" class="valorePercorso"></div>\\s*<button class="sceltaPercorso" onclick="impostaPercorsiDiSistema\\(' + tipo + '\\)">'), id);
        //Un id solo per pagina: il vecchio template commentato li ripeteva.
        assert.strictEqual((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id);
    }
    assert.match(finestra, /id="confermaPercorsi"/);
    for (const tolto of ["pathEsportazione", "pathLogs", "pathLavorazioni"]) {
        assert.strictEqual(html.indexOf('id="' + tolto + '"'), -1, tolto);
    }
});
