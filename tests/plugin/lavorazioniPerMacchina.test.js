/*
 * I20-1061: un file delle lavorazioni per ogni macchina.
 *
 * Con un solo lavorazioni.json nella cartella Dropbox, due postazioni sullo stesso documento lo
 * riscrivevano a turno e Dropbox ne faceva copie di conflitto. Ora ogni macchina scrive solo il suo
 * <idMacchina>_Lavorazioni.json. Per trovare la lavorazione di un documento si guarda il file della
 * macchina, poi quelli delle altre e i lavorazioni.json di prima; se c'e' solo altrove se ne copiano
 * qui i riferimenti, e la lavorazione si carica senza la ricerca kit. Nei libri si preferisce la voce
 * di quel libro, poi quella col solo nome del file.
 *
 * L'identificativo della macchina si genera una volta e poi si rilegge e basta: deve restare lo
 * stesso per sempre.
 *
 * utility.js e indexNew.js fanno require('indesign'): le funzioni si prendono dal sorgente e girano
 * su un disco finto, come in cartellaLavorazioni.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const ID = "mac-mini-di-sm2_k3F9a2Lp0Q";
const MIO = ID + "_Lavorazioni.json";
const ALTRO = "pc-ufficio_Zx81QwErTy_Lavorazioni.json";

/* ---- il disco finto ---- */

//cartelle: { "/doc": ["voce", ...] }, file: { "/doc/x.json": "contenuto" }. Le scritture aggiornano
//anche l'elenco della cartella, come fa il disco vero.
function disco(cartelle, file = {}) {
    const d = { cartelle: JSON.parse(JSON.stringify(cartelle)), file: Object.assign({}, file), scritture: [] };
    d.fs = {
        readdirSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(d.cartelle, p)) {
                throw new Error("ENOTDIR " + p);
            }
            return d.cartelle[p];
        },
        readFileSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(d.file, p)) {
                throw new Error("ENOENT " + p);
            }
            return d.file[p];
        },
        writeFileSync: (p, contenuto) => {
            const cartella = p.substring(0, p.lastIndexOf("/"));
            if (!Object.prototype.hasOwnProperty.call(d.cartelle, cartella)) {
                throw new Error("ENOENT " + cartella);
            }
            const nome = p.substring(p.lastIndexOf("/") + 1);
            if (d.cartelle[cartella].indexOf(nome) < 0) {
                d.cartelle[cartella].push(nome);
            }
            d.file[p] = String(contenuto);
            d.scritture.push(p);
        },
        mkdirSync: (p) => {
            if (!Object.prototype.hasOwnProperty.call(d.cartelle, p)) {
                d.cartelle[p] = [];
            }
        }
    };
    d.json = (p) => JSON.parse(d.file[p]);
    return d;
}

/* ---- le funzioni di utility.js ---- */

const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = utility.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = utility.indexOf("\n    },\n", inizio);
    return utility.substring(inizio, fine + "\n    }".length);
}

function utilityCon(d) {
    const membri = ["nomiCartellaLavorazioni(", "_senzaBarraFinale(", "cartellaLavorazioni(", "nomeFileLavorazioniMacchina(",
        "_cartelleFileLavorazioni(", "_vociDellaCartella(", "percorsoFileLavorazioniMacchina(", "fileLavorazioniAltri(",
        "leggiFileLavorazioni(", "_voceNellElenco(", "voceLavorazione(", "salvaVoceLavorazione(", "libroDelDocumento("].map(corpoMembro);
    const fabbrica = new Function("require", "const Utility = ({\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    return fabbrica((nome) => {
        assert.strictEqual(nome, "fs");
        return d.fs;
    });
}

const kit = (id, titolo) => ({ guidId: "g-" + id, meta: JSON.stringify({ titolo: titolo }) });

/* ---- il file della macchina ---- */

test("il file di una macchina porta il suo identificativo", () => {
    assert.strictEqual(utilityCon(disco({})).nomeFileLavorazioniMacchina(ID), MIO);
});

test("il file della macchina nasce nella cartella delle lavorazioni, o in quella del documento se manca", () => {
    const conCartella = utilityCon(disco({ "/doc": [".lavorazioni"], "/doc/.lavorazioni": [] }));
    assert.strictEqual(conCartella.percorsoFileLavorazioniMacchina("/doc", ID), "/doc/.lavorazioni/" + MIO);

    const senza = utilityCon(disco({ "/doc": [] }));
    assert.strictEqual(senza.percorsoFileLavorazioniMacchina("/doc/", ID), "/doc/" + MIO);

    //Scritto quando la cartella non c'era, resta in uso dov'e'.
    const giaFuori = utilityCon(disco({ "/doc": [".lavorazioni", MIO], "/doc/.lavorazioni": [] }));
    assert.strictEqual(giaFuori.percorsoFileLavorazioniMacchina("/doc", ID), "/doc/" + MIO);
});

test("gli altri file sono quelli delle altre macchine, poi i lavorazioni.json di prima", () => {
    const u = utilityCon(disco({
        "/doc": [".lavorazioni", "lavorazioni.json", "documento.indd"],
        "/doc/.lavorazioni": [MIO, ALTRO, "lavorazioni.json", "lavorazioni (copia in conflitto).json"]
    }));
    assert.deepStrictEqual(u.fileLavorazioniAltri("/doc", ID), [
        "/doc/.lavorazioni/" + ALTRO,
        "/doc/.lavorazioni/lavorazioni.json",
        "/doc/lavorazioni.json"
    ]);
});

/* ---- trovare la lavorazione ---- */

test("la voce nel file della macchina vince, e non si scrive nulla", () => {
    const d = disco({ "/doc": [".lavorazioni"], "/doc/.lavorazioni": [MIO, ALTRO] }, {
        ["/doc/.lavorazioni/" + MIO]: JSON.stringify([{ file: "A.indd", id: 1, details: kit(1, "mio") }]),
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([{ file: "A.indd", id: 2, details: kit(2, "altro") }])
    });

    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd").id, 1);
    assert.deepStrictEqual(d.scritture, []);
});

test("seconda postazione: la lavorazione di un'altra macchina si copia senza i percorsi", () => {
    const voceAltra = { file: "A.indd", id: 7, details: kit(7, "Kit A"), pathLinks: "/Users/altro/Links/", pathLoghi: "/Users/altro/Loghi/", pathLogs: "/x/", pathEsportazione: "/y/", pathLavorazioni: "/z/" };
    const d = disco({ "/doc": [".lavorazioni"], "/doc/.lavorazioni": [ALTRO] }, {
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([voceAltra])
    });
    const prima = d.file["/doc/.lavorazioni/" + ALTRO];

    const voce = utilityCon(d).voceLavorazione("/doc", ID, "A.indd");

    assert.deepStrictEqual(voce, { file: "A.indd", id: 7, details: kit(7, "Kit A") });
    assert.deepStrictEqual(d.json("/doc/.lavorazioni/" + MIO), [voce]);
    //Il file dell'altra macchina non si tocca.
    assert.strictEqual(d.file["/doc/.lavorazioni/" + ALTRO], prima);
    assert.deepStrictEqual(d.scritture, ["/doc/.lavorazioni/" + MIO]);
});

test("un documento del lavorazioni.json di prima si ritrova e si copia, e il vecchio file resta com'e'", () => {
    const d = disco({ "/doc": ["lavorazioni.json"] }, {
        "/doc/lavorazioni.json": JSON.stringify([{ file: "B.indd", id: 3, details: kit(3, "Kit B"), pathLinks: "/vecchio/" }])
    });

    const voce = utilityCon(d).voceLavorazione("/doc", ID, "B.indd");

    assert.strictEqual(voce.id, 3);
    assert.strictEqual(voce.pathLinks, undefined);
    assert.deepStrictEqual(d.scritture, ["/doc/" + MIO]);
    assert.deepStrictEqual(d.json("/doc/lavorazioni.json")[0].pathLinks, "/vecchio/");
});

test("le altre macchine si guardano prima dei file di prima", () => {
    const d = disco({ "/doc": [".lavorazioni", "lavorazioni.json"], "/doc/.lavorazioni": [ALTRO] }, {
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([{ file: "A.indd", id: 20, details: kit(20, "nuova") }]),
        "/doc/lavorazioni.json": JSON.stringify([{ file: "A.indd", id: 10, details: kit(10, "vecchia") }])
    });
    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd").id, 20);
});

test("la seconda volta la voce si legge dal file della macchina, senza ricopiarla", () => {
    const d = disco({ "/doc": [".lavorazioni"], "/doc/.lavorazioni": [ALTRO] }, {
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([{ file: "A.indd", id: 7, details: kit(7, "Kit A") }])
    });
    const u = utilityCon(d);

    u.voceLavorazione("/doc", ID, "A.indd");
    u.voceLavorazione("/doc", ID, "A.indd");

    assert.strictEqual(d.scritture.length, 1);
    assert.strictEqual(d.json("/doc/.lavorazioni/" + MIO).length, 1);
});

test("un documento che non c'e' in nessun file va alla ricerca kit, e non si scrive niente", () => {
    const d = disco({ "/doc": [".lavorazioni", "lavorazioni.json"], "/doc/.lavorazioni": [ALTRO] }, {
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([{ file: "A.indd", id: 7, details: kit(7, "Kit A") }]),
        "/doc/lavorazioni.json": "non e' json"
    });

    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "Z.indd"), null);
    assert.deepStrictEqual(d.scritture, []);
});

/* ---- i libri ---- */

test("in un libro vale prima la voce di quel libro, poi quella col solo nome del file", () => {
    const voci = [
        { file: "A.indd", id: 1, details: kit(1, "senza libro") },
        { file: "A.indd", id: 2, details: kit(2, "libro 1"), libro: "Volantino.indb" }
    ];
    const d = disco({ "/doc": [MIO] }, { ["/doc/" + MIO]: JSON.stringify(voci) });
    const u = utilityCon(d);

    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd", "Volantino.indb").id, 2);
    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd", "Altro.indb").id, 1);
    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd").id, 1);
});

test("copiando la voce di un file del libro, la copia porta il libro", () => {
    const d = disco({ "/doc": ["lavorazioni.json"] }, {
        "/doc/lavorazioni.json": JSON.stringify([{ file: "A.indd", id: 5, details: kit(5, "Kit") }])
    });
    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd", "Volantino.indb").libro, "Volantino.indb");
    assert.strictEqual(d.json("/doc/" + MIO)[0].libro, "Volantino.indb");
});

test("il libro del documento e' il .indb nella sua cartella", () => {
    const u = utilityCon(disco({
        "/uno": ["A.indd", "Volantino.indb"],
        "/due": ["A.indd", "Nord.indb", "Sud.indb"],
        "/nessuno": ["A.indd"]
    }));

    assert.strictEqual(u.libroDelDocumento("/nessuno", "A.indd", []), null);
    assert.strictEqual(u.libroDelDocumento("/uno/", "A.indd", []), "Volantino.indb");
    //Con piu' libri vale quello aperto che contiene il documento.
    assert.strictEqual(u.libroDelDocumento("/due", "A.indd", [{ nome: "Sud.indb", files: ["A.indd"] }]), "Sud.indb");
    //Un libro aperto che non e' in quella cartella non conta; senza un libro aperto che lo contenga
    //non si sceglie: si cerca per il solo nome del file.
    assert.strictEqual(u.libroDelDocumento("/due", "A.indd", [{ nome: "Altro.indb", files: ["A.indd"] }]), null);
    assert.strictEqual(u.libroDelDocumento("/due", "A.indd", [{ nome: "Nord.indb", files: ["B.indd"] }]), null);
});

/* ---- scrivere ---- */

test("si scrive solo nel file della macchina, aggiornando la voce che c'e' gia'", () => {
    const d = disco({ "/doc": [".lavorazioni", "lavorazioni.json"], "/doc/.lavorazioni": [MIO, ALTRO] }, {
        ["/doc/.lavorazioni/" + MIO]: JSON.stringify([{ file: "A.indd", id: 1, details: kit(1, "vecchio"), pathLinks: "/mio/Links/" }]),
        ["/doc/.lavorazioni/" + ALTRO]: JSON.stringify([]),
        "/doc/lavorazioni.json": JSON.stringify([])
    });
    const u = utilityCon(d);

    u.salvaVoceLavorazione("/doc", ID, { file: "A.indd", id: 9, details: kit(9, "nuovo") });
    u.salvaVoceLavorazione("/doc", ID, { file: "B.indd", id: 4, details: kit(4, "B"), libro: "Volantino.indb" });

    const mie = d.json("/doc/.lavorazioni/" + MIO);
    assert.strictEqual(mie.length, 2);
    assert.strictEqual(mie[0].id, 9);
    assert.strictEqual(mie[0].pathLinks, "/mio/Links/");
    assert.strictEqual(mie[1].libro, "Volantino.indb");
    assert.deepStrictEqual(d.scritture, ["/doc/.lavorazioni/" + MIO, "/doc/.lavorazioni/" + MIO]);
});

/* ---- l'identificativo della macchina (indexNew.js) ---- */

const indice = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function funzioniIdMacchina() {
    const inizio = indice.indexOf("var idMacchinaCache = null;");
    const fine = indice.indexOf("/// I20-1061: il libro del documento in lavorazione");
    assert.ok(inizio > 0 && fine > inizio);
    return new Function(indice.substring(inizio, fine) + "\nreturn { idMacchina: idMacchina, percorsiFileIdMacchina: percorsiFileIdMacchina };")();
}

function storage(iniziale = {}) {
    const dati = Object.assign({}, iniziale);
    return { getItem: (k) => (k in dati ? dati[k] : null), setItem: (k, v) => { dati[k] = String(v); }, dati: dati };
}

const mac = { platform: () => "darwin", homedir: () => "/Users/sm2" };
const win = { platform: () => "win32", homedir: () => "C:\\Users\\sm2" };

test("la prima volta l'identificativo nasce e si conserva nella cartella comune e nel plugin", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [] });
    const s = storage();

    const id = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "Mac Mini di sm2.local", codice: () => "k3F9a2Lp0Q" });

    assert.strictEqual(id, "Mac-Mini-di-sm2-local_k3F9a2Lp0Q");
    assert.deepStrictEqual(d.json("/Users/Shared/Istanta/idMacchina.json"), { id: id });
    assert.strictEqual(s.dati["istanta.idMacchina"], id);
});

test("l'identificativo non cambia piu', neanche se cambia il nome della macchina", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [] });
    const s = storage();
    const primo = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac-mini", codice: () => "AAAAAAAAAA" });

    const dopo = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac-mini-2", codice: () => "BBBBBBBBBB" });

    assert.strictEqual(dopo, primo);
    assert.strictEqual(d.scritture.length, 1);
});

test("se il file sparisce si ricrea con lo stesso identificativo conservato nel plugin", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [] });
    const s = storage({ "istanta.idMacchina": "mac-mini_AAAAAAAAAA" });

    const id = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "altro", codice: () => "BBBBBBBBBB" });

    assert.strictEqual(id, "mac-mini_AAAAAAAAAA");
    assert.deepStrictEqual(d.json("/Users/Shared/Istanta/idMacchina.json"), { id: "mac-mini_AAAAAAAAAA" });
});

test("il file vince sulla copia del plugin, che si riallinea", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": ["Istanta"], "/Users/Shared/Istanta": ["idMacchina.json"] }, {
        "/Users/Shared/Istanta/idMacchina.json": JSON.stringify({ id: "mac-mini_AAAAAAAAAA" })
    });
    const s = storage({ "istanta.idMacchina": "vecchio_CCCCCCCCCC" });

    assert.strictEqual(idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "x", codice: () => "BBBBBBBBBB" }), "mac-mini_AAAAAAAAAA");
    assert.strictEqual(s.dati["istanta.idMacchina"], "mac-mini_AAAAAAAAAA");
    assert.deepStrictEqual(d.scritture, []);
});

test("se la cartella comune non e' scrivibile si usa la home", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/sm2": [] });
    d.fs.mkdirSync = (p) => {
        if (p.indexOf("/Users/Shared") === 0) {
            throw new Error("EACCES " + p);
        }
        d.cartelle[p] = d.cartelle[p] || [];
    };

    const id = idMacchina({ fs: d.fs, os: mac, storage: storage(), nome: () => "mac", codice: () => "AAAAAAAAAA" });

    assert.deepStrictEqual(d.json("/Users/sm2/.istanta/idMacchina.json"), { id: id });
});

test("su Windows la cartella comune e' ProgramData", () => {
    const { percorsiFileIdMacchina } = funzioniIdMacchina();
    assert.deepStrictEqual(percorsiFileIdMacchina(win).map(p => p.file), ["C:/ProgramData/Istanta/idMacchina.json", "C:\\Users\\sm2/.istanta/idMacchina.json"]);
    assert.deepStrictEqual(percorsiFileIdMacchina(mac).map(p => p.file), ["/Users/Shared/Istanta/idMacchina.json", "/Users/sm2/.istanta/idMacchina.json"]);
});

test("un identificativo scritto male non vale e se ne fa uno nuovo", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": ["Istanta"], "/Users/Shared/Istanta": ["idMacchina.json"] }, {
        "/Users/Shared/Istanta/idMacchina.json": JSON.stringify({ id: "../nome strano" })
    });

    assert.strictEqual(idMacchina({ fs: d.fs, os: mac, storage: storage(), nome: () => "mac", codice: () => "AAAAAAAAAA" }), "mac_AAAAAAAAAA");
});

/* ---- chi usa cosa ---- */

test("la lavorazione si trova senza aspettare: idKitLavorazione arriva prima di ogni await", () => {
    const fico = leggiFileDelPlugin("ficoProcess.js").replace(/\r/g, "");
    const inizio = fico.indexOf("checklavorazioneSelezionata:async function()");
    const primoAwait = fico.indexOf("await ", inizio);
    const voce = fico.indexOf("Utility.voceLavorazione(pathLavorazione, idMacchina(), app.activeDocument.name", inizio);
    const assegnazione = fico.indexOf("idKitLavorazione = refFileLavorazione[0].id;", inizio);

    assert.ok(inizio > 0 && voce > inizio && assegnazione > voce && primoAwait > assegnazione);
});

test("i custom dei clienti leggono la voce di questa macchina", () => {
    for (const cliente of ["Edro21", "Coopfi", "Famila"]) {
        const testo = fs.readFileSync(path.join(__dirname, "..", "..", "plugin", "Agenzie", cliente, "custom.js"), "utf8");
        assert.match(testo, /Utility\.voceLavorazione\(pathLavorazione, idMacchina\(\), /, cliente);
        assert.doesNotMatch(testo, /readFile\(filePath\)/, cliente);
    }
});

test("i percorsi di sistema si scrivono nel file di questa macchina", () => {
    const imposta = indice.substring(indice.indexOf("async function impostaPercorsiDiSistema("));
    assert.match(imposta, /var filePath = Utility\.percorsoFileLavorazioniMacchina\(_pathLavorazione, idMacchina\(\)\);\s*let lavorazioni = Utility\.leggiFileLavorazioni\(filePath\);/);
});
