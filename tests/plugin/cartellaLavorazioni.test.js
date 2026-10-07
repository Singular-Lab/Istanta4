/*
 * I20-1057: la quinta cartella di sistema, quella delle lavorazioni, e dove vive lavorazioni.json.
 *
 * Alle cartelle links, loghi, logs ed export se ne aggiunge una per le lavorazioni (oggi una sola,
 * domani piu' d'una). Si riconosce da sola se sotto la cartella del documento c'e' .lavorazioni,
 * lavorazioni o lavorazione, in quest'ordine; altrimenti la sceglie l'operatore come le altre.
 * lavorazioni.json si legge e si scrive li'; un file di prima nella cartella del documento resta in
 * uso finche' l'operatore non lo sposta.
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
    const membri = ["nomiCartellaLavorazioni(", "_senzaBarraFinale(", "cartellaLavorazioni(", "percorsoFileLavorazioni("].map(corpoMembro);
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

/* ---- dove sta lavorazioni.json ---- */

test("il file nella cartella delle lavorazioni vince", () => {
    const u = utilityCon({ "/doc": [".lavorazioni", "lavorazioni.json"], "/doc/.lavorazioni": ["lavorazioni.json"] });
    assert.strictEqual(u.percorsoFileLavorazioni("/doc"), "/doc/.lavorazioni/lavorazioni.json");
});

test("il file di prima nella cartella del documento resta in uso finche' non lo si sposta", () => {
    const u = utilityCon({ "/doc": [".lavorazioni", "lavorazioni.json"], "/doc/.lavorazioni": [] });
    assert.strictEqual(u.percorsoFileLavorazioni("/doc"), "/doc/lavorazioni.json");
});

test("se il file non c'e' ancora nasce nella cartella delle lavorazioni", () => {
    const u = utilityCon({ "/doc": ["lavorazione"], "/doc/lavorazione": [] });
    assert.strictEqual(u.percorsoFileLavorazioni("/doc"), "/doc/lavorazione/lavorazioni.json");
});

test("senza cartella delle lavorazioni tutto resta come prima", () => {
    assert.strictEqual(utilityCon({ "/doc": ["lavorazioni.json"] }).percorsoFileLavorazioni("/doc"), "/doc/lavorazioni.json");
    assert.strictEqual(utilityCon({ "/doc": [] }).percorsoFileLavorazioni("/doc"), "/doc/lavorazioni.json");
    //Il libro passava la cartella con la barra finale e il nome attaccato: il percorso e' lo stesso.
    assert.strictEqual(utilityCon({ "/libro": ["lavorazioni.json"] }).percorsoFileLavorazioni("/libro/"), "/libro/lavorazioni.json");
});

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

    //I punti che leggono o scrivono il file passano tutti dall'unico che sa dove sta.
    const usi = daControllare.filter(f => f.nome !== "custom.js").reduce((n, f) => n + (f.testo.match(/Utility\.percorsoFileLavorazioni\(/g) || []).length, 0);
    assert.ok(usi >= 14, "usi trovati: " + usi);
});

test("ficoProcess non perde il file nuovo e copia anche il percorso delle lavorazioni", () => {
    const fico = leggiFileDelPlugin("ficoProcess.js").replace(/\r/g, "");

    //Era "file== readFile(...)": un confronto, e subito dopo file.length andava in errore.
    assert.doesNotMatch(fico, /file\s*==\s*readFile\(/);
    assert.strictEqual((fico.match(/file = readFile\(filePath\) \|\| \[\];/g) || []).length, 2);

    assert.strictEqual((fico.match(/existingItems\.pathLavorazioni = pathLavorazioni;/g) || []).length, 2);
    assert.match(fico, /pathLavorazioni:pathLavorazioni ,details:/);
    assert.match(fico, /pathLavorazioni: pathLavorazioni, details:/);
});

test("checkPercorsi chiede anche la cartella delle lavorazioni e la riconosce per nome", () => {
    const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    const inizio = indice.indexOf("async function checkPercorsi(");
    const corpo = indice.substring(inizio, indice.indexOf("\n}\n", inizio));

    assert.match(corpo, /entrambi: \[[\s\S]*?\{ key: 'pathLavorazioni', value: percorsoLavorazioni \},[\s\S]*?\],/);
    assert.match(corpo, /Utility\.cartellaLavorazioni\(_pathLavorazione\)/);
    assert.match(corpo, /impostaPercorsiDiSistema\(4, cartellaLavorazioni\)/);
    assert.match(corpo, /percorsoEsportazione && percorsoLavorazioni\) \{/);

    const imposta = indice.substring(indice.indexOf("async function impostaPercorsiDiSistema("));
    assert.match(imposta, /else if \(tipo == 4\) \{[\s\S]*?file\.pathLavorazioni = percorsoLavorazioni;/);
});

test("la finestra ha una riga per ognuna delle cinque cartelle", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "index.html"), "utf8").replace(/\r/g, "");
    const inizio = html.indexOf('<div id="dialogPathDiSistema"');
    assert.notStrictEqual(inizio, -1);
    const finestra = html.substring(inizio, html.indexOf('<div id="dialogEsportaLibro"', inizio));

    const righe = [["pathFoto", 0], ["pathLoghi", 1], ["pathEsportazione", 3], ["pathLogs", 2], ["pathLavorazioni", 4]];
    assert.strictEqual((finestra.match(/class="rigaPercorso percorsoMancante"/g) || []).length, righe.length);
    for (const [id, tipo] of righe) {
        assert.match(finestra, new RegExp('<div id="' + id + '" class="valorePercorso"></div>\\s*<button class="sceltaPercorso" onclick="impostaPercorsiDiSistema\\(' + tipo + '\\)">'), id);
        //Un id solo per pagina: il vecchio template commentato li ripeteva.
        assert.strictEqual((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id);
    }
    assert.match(finestra, /id="confermaPercorsi"/);
});
