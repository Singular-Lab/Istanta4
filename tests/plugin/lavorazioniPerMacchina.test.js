/*
 * I20-1061: un file delle lavorazioni per ogni macchina.
 * I20-1065: il file ora e' lavorazioni.json in SingularData/<idMacchina>, con accanto i file di
 * lavoro del documento; quelli di prima (<idMacchina>_Lavorazioni.json, lavorazioni.json) si leggono
 * soltanto, e quando la voce viene da li' o da un'altra postazione arrivano anche i file di lavoro.
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
const ALTRA_ID = "pc-ufficio_Zx81QwErTy";
//I20-1065: ogni postazione ha la sua cartella in SingularData, con dentro lavorazioni.json.
const MIA = "/doc/SingularData/" + ID;
const MIO = MIA + "/lavorazioni.json";
const ALTRA = "/doc/SingularData/" + ALTRA_ID;
//I nomi dei file di prima di I20-1065, che si leggono soltanto.
const MIO_DI_PRIMA = ID + "_Lavorazioni.json";
const ALTRO_DI_PRIMA = ALTRA_ID + "_Lavorazioni.json";

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
        }
        //Niente mkdirSync: UXP non crea cartelle cosi' (I20-1061, prova sul campo dell'operatore).
        //Le crea preparaCartelleDiSistema (I20-1065), vedi cartelleDiSistema.test.js.
    };
    d.json = (p) => JSON.parse(d.file[p]);
    return d;
}

//La cartella del documento con SingularData e la cartella di questa postazione gia' create, come
//all'apertura; piu' quello che serve al caso.
function conDati(extra = {}) {
    const cartelle = { "/doc": ["SingularData"], "/doc/SingularData": [ID], [MIA]: [] };
    Object.keys(extra).forEach(k => {
        cartelle[k] = k === "/doc" || k === "/doc/SingularData" ? cartelle[k].concat(extra[k]) : extra[k];
    });
    return cartelle;
}

/* ---- le funzioni di utility.js ---- */

const utility = leggiFileDelPlugin("utility.js").replace(/\r/g, "");

function corpoMembro(intestazione) {
    const inizio = utility.indexOf("    " + intestazione);
    assert.notStrictEqual(inizio, -1, intestazione + " non trovata");
    const fine = utility.indexOf("\n    },\n", inizio);
    return utility.substring(inizio, fine + "\n    }".length);
}

//Le costanti delle cartelle, cosi' come sono nel sorgente.
function costanti() {
    const inizio = utility.indexOf("    CARTELLA_LOGS:");
    const fine = utility.indexOf("\n", utility.indexOf("    NOME_FILE_LAVORAZIONI:"));
    assert.ok(inizio > 0 && fine > inizio);
    return utility.substring(inizio, fine).replace(/,\s*$/, "");
}

function utilityCon(d) {
    const membri = ["eFileListaKit(", "nomiCartellaLavorazioni(", "_senzaBarraFinale(", "cartellaLavorazioni(", "nomeFileLavorazioniMacchina(",
        "_cartelleFileLavorazioni(", "_vociDellaCartella(", "cartellaDatiMacchina(", "percorsoFileLavorazioniMacchina(",
        "fileLavorazioniAltri(", "leggiFileLavorazioni(", "_voceNellElenco(", "nomeFileReportIntegrita(", "nomeFileWhitelistIntegrita(",
        "fileDiLavoro(", "copiaFileDiLavoro(",
        "voceLavorazione(", "salvaVoceLavorazione(", "libroDelDocumento("].map(corpoMembro);
    const fabbrica = new Function("require", "const Utility = ({\n" + costanti() + ",\n" + membri.join(",\n") + "\n});\nreturn Utility;");
    return fabbrica((nome) => {
        assert.strictEqual(nome, "fs");
        return d.fs;
    });
}

const kit = (id, titolo) => ({ guidId: "g-" + id, meta: JSON.stringify({ titolo: titolo }) });

/* ---- il file della postazione ---- */

test("il file di prima di una macchina portava il suo identificativo", () => {
    assert.strictEqual(utilityCon(disco({})).nomeFileLavorazioniMacchina(ID), MIO_DI_PRIMA);
});

test("il file della postazione e' lavorazioni.json nella sua cartella di SingularData", () => {
    const u = utilityCon(disco({}));
    assert.strictEqual(u.percorsoFileLavorazioniMacchina("/doc", ID), MIO);
    assert.strictEqual(u.percorsoFileLavorazioniMacchina("/doc/", ID), MIO);
    assert.strictEqual(u.cartellaDatiMacchina("/doc/", ID), MIA);
});

test("gli altri file: il mio di prima, le altre postazioni, poi i file di prima delle altre macchine", () => {
    const u = utilityCon(disco(conDati({
        "/doc": [".lavorazioni", "lavorazioni.json", "documento.indd"],
        "/doc/SingularData": [ALTRA_ID, "appunti.txt"],
        [ALTRA]: ["lavorazioni.json", "listaKit7.json"],
        "/doc/.lavorazioni": [MIO_DI_PRIMA, ALTRO_DI_PRIMA, "lavorazioni.json", "lavorazioni (copia in conflitto).json"]
    })));
    assert.deepStrictEqual(u.fileLavorazioniAltri("/doc", ID), [
        { percorso: "/doc/.lavorazioni/" + MIO_DI_PRIMA, cartella: "/doc", origine: "mia" },
        { percorso: ALTRA + "/lavorazioni.json", cartella: ALTRA, origine: "postazione" },
        { percorso: "/doc/.lavorazioni/" + ALTRO_DI_PRIMA, cartella: "/doc", origine: "vecchia" },
        { percorso: "/doc/.lavorazioni/lavorazioni.json", cartella: "/doc", origine: "vecchia" },
        { percorso: "/doc/lavorazioni.json", cartella: "/doc", origine: "vecchia" }
    ]);
});

/* ---- trovare la lavorazione ---- */

test("la voce nel file della postazione vince, e non si scrive nulla", () => {
    const d = disco(conDati({ "/doc/SingularData": [ALTRA_ID], [MIA]: ["lavorazioni.json"], [ALTRA]: ["lavorazioni.json"] }), {
        [MIO]: JSON.stringify([{ file: "A.indd", id: 1, details: kit(1, "mio") }]),
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([{ file: "A.indd", id: 2, details: kit(2, "altro") }])
    });

    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd").id, 1);
    assert.deepStrictEqual(d.scritture, []);
});

test("seconda postazione: la voce si copia senza i percorsi, con i file di lavoro del documento", () => {
    const voceAltra = { file: "A.indd", id: 7, details: kit(7, "Kit A"), pathLinks: "/Users/altro/Links/", pathLoghi: "/Users/altro/Loghi/", pathLogs: "/x/", pathEsportazione: "/y/" };
    const d = disco(conDati({
        "/doc/SingularData": [ALTRA_ID],
        [MIA]: ["allineamenti.json"],
        [ALTRA]: ["lavorazioni.json", "CN_TO_listaKit7.json", "listaKit8.json", "allineamenti.json", "listaRefConteggio.json",
            "listaRefEscluse.json", "Filtri.json", "reportIntegrita_7.json", "whitelistIntegrita_7.json", "listaImpaginata7.json"]
    }), {
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([voceAltra]),
        [ALTRA + "/CN_TO_listaKit7.json"]: "[\"kit\"]",
        [ALTRA + "/listaKit8.json"]: "[\"altro kit\"]",
        [ALTRA + "/allineamenti.json"]: "[\"dell'altra\"]",
        [MIA + "/allineamenti.json"]: "[\"mio\"]",
        [ALTRA + "/listaRefConteggio.json"]: "[1]",
        [ALTRA + "/listaRefEscluse.json"]: "[2]",
        [ALTRA + "/Filtri.json"]: "[3]",
        [ALTRA + "/reportIntegrita_7.json"]: "{}",
        [ALTRA + "/whitelistIntegrita_7.json"]: "{}",
        [ALTRA + "/listaImpaginata7.json"]: "[]"
    });
    const prima = Object.assign({}, d.file);

    const voce = utilityCon(d).voceLavorazione("/doc", ID, "A.indd");

    assert.deepStrictEqual(voce, { file: "A.indd", id: 7, details: kit(7, "Kit A") });
    assert.deepStrictEqual(d.json(MIO), [voce]);
    //La lista del kit e gli altri file di lavoro arrivano: si prosegue senza richiedere il kit.
    assert.strictEqual(d.file[MIA + "/CN_TO_listaKit7.json"], "[\"kit\"]");
    assert.strictEqual(d.file[MIA + "/listaRefConteggio.json"], "[1]");
    assert.strictEqual(d.file[MIA + "/listaRefEscluse.json"], "[2]");
    assert.strictEqual(d.file[MIA + "/Filtri.json"], "[3]");
    //Quello che la postazione ha gia' non si sovrascrive.
    assert.strictEqual(d.file[MIA + "/allineamenti.json"], "[\"mio\"]");
    //Da un'altra postazione non arrivano report, whitelist, lista impaginata, ne' file di altri kit.
    for (const nome of ["listaKit8.json", "reportIntegrita_7.json", "whitelistIntegrita_7.json", "listaImpaginata7.json"]) {
        assert.strictEqual(d.file[MIA + "/" + nome], undefined, nome);
    }
    //I file dell'altra postazione non si toccano.
    Object.keys(prima).forEach(p => assert.strictEqual(d.file[p], prima[p], p));
    assert.ok(d.scritture.every(p => p.startsWith(MIA + "/")), d.scritture.join(", "));
});

test("un documento lavorato prima di I20-1065 si copia con tutti i suoi file, e quelli di prima restano com'erano", () => {
    const d = disco(conDati({
        "/doc": [".lavorazioni", "listaKit3.json", "Filtri.json", "allineamenti.json", "reportIntegrita_3.json",
            "whitelistIntegrita_3.json", "listaImpaginata3.json", "Volantino.indb_register.json"],
        "/doc/.lavorazioni": [ALTRO_DI_PRIMA]
    }), {
        ["/doc/.lavorazioni/" + ALTRO_DI_PRIMA]: JSON.stringify([{ file: "B.indd", id: 3, details: kit(3, "Kit B"), pathLinks: "/vecchio/" }]),
        "/doc/listaKit3.json": "[\"kit\"]",
        "/doc/Filtri.json": "[\"filtri\"]",
        "/doc/allineamenti.json": "[\"regole\"]",
        "/doc/reportIntegrita_3.json": "{\"report\":1}",
        "/doc/whitelistIntegrita_3.json": "{\"wl\":1}",
        "/doc/listaImpaginata3.json": "[\"imp\"]",
        "/doc/Volantino.indb_register.json": "{\"stato\":1}"
    });
    const prima = Object.assign({}, d.file);

    const voce = utilityCon(d).voceLavorazione("/doc", ID, "B.indd", "Volantino.indb");

    assert.strictEqual(voce.id, 3);
    //I percorsi erano di un'altra macchina: non si portano.
    assert.strictEqual(voce.pathLinks, undefined);
    for (const nome of ["listaKit3.json", "Filtri.json", "allineamenti.json", "reportIntegrita_3.json",
        "whitelistIntegrita_3.json", "listaImpaginata3.json", "Volantino.indb_register.json"]) {
        assert.strictEqual(d.file[MIA + "/" + nome], prima["/doc/" + nome], nome);
    }
    Object.keys(prima).forEach(p => assert.strictEqual(d.file[p], prima[p], p));
});

test("dal file di prima di questa stessa postazione si tengono i percorsi di Links e Loghi", () => {
    const d = disco(conDati({ "/doc": [".lavorazioni"], "/doc/.lavorazioni": [MIO_DI_PRIMA] }), {
        ["/doc/.lavorazioni/" + MIO_DI_PRIMA]: JSON.stringify([{ file: "A.indd", id: 4, details: kit(4, "Kit"),
            pathLinks: "/mio/Links/", pathLoghi: "/mio/Links/Loghi/", pathLogs: "/mio/Logs/", pathLavorazioni: "/mio/.lavorazioni/" }])
    });

    const voce = utilityCon(d).voceLavorazione("/doc", ID, "A.indd");

    assert.deepStrictEqual(voce, { file: "A.indd", id: 4, details: kit(4, "Kit"), pathLinks: "/mio/Links/", pathLoghi: "/mio/Links/Loghi/" });
});

test("le altre postazioni si guardano prima dei file di prima delle altre macchine", () => {
    const d = disco(conDati({ "/doc": ["lavorazioni.json"], "/doc/SingularData": [ALTRA_ID], [ALTRA]: ["lavorazioni.json"] }), {
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([{ file: "A.indd", id: 20, details: kit(20, "nuova") }]),
        "/doc/lavorazioni.json": JSON.stringify([{ file: "A.indd", id: 10, details: kit(10, "vecchia") }])
    });
    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd").id, 20);
});

test("la seconda volta la voce si legge dal file della postazione, senza ricopiarla", () => {
    const d = disco(conDati({ "/doc/SingularData": [ALTRA_ID], [ALTRA]: ["lavorazioni.json"] }), {
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([{ file: "A.indd", id: 7, details: kit(7, "Kit A") }])
    });
    const u = utilityCon(d);

    u.voceLavorazione("/doc", ID, "A.indd");
    u.voceLavorazione("/doc", ID, "A.indd");

    assert.strictEqual(d.scritture.length, 1);
    assert.strictEqual(d.json(MIO).length, 1);
});

test("un documento che non c'e' in nessun file va alla ricerca kit, e non si scrive niente", () => {
    const d = disco(conDati({ "/doc": ["lavorazioni.json"], "/doc/SingularData": [ALTRA_ID], [ALTRA]: ["lavorazioni.json"] }), {
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([{ file: "A.indd", id: 7, details: kit(7, "Kit A") }]),
        "/doc/lavorazioni.json": "non e' json"
    });

    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "Z.indd"), null);
    assert.deepStrictEqual(d.scritture, []);
});

test("senza la cartella della postazione la voce si trova lo stesso, e la copia si ritenta la volta dopo", () => {
    const d = disco({ "/doc": ["lavorazioni.json"] }, {
        "/doc/lavorazioni.json": JSON.stringify([{ file: "A.indd", id: 5, details: kit(5, "Kit") }])
    });
    const errori = console.error;
    console.error = () => {};
    try {
        assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd").id, 5);
    }
    finally {
        console.error = errori;
    }
    assert.deepStrictEqual(d.scritture, []);
});

/* ---- i libri ---- */

test("in un libro vale prima la voce di quel libro, poi quella col solo nome del file", () => {
    const voci = [
        { file: "A.indd", id: 1, details: kit(1, "senza libro") },
        { file: "A.indd", id: 2, details: kit(2, "libro 1"), libro: "Volantino.indb" }
    ];
    const d = disco(conDati({ [MIA]: ["lavorazioni.json"] }), { [MIO]: JSON.stringify(voci) });
    const u = utilityCon(d);

    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd", "Volantino.indb").id, 2);
    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd", "Altro.indb").id, 1);
    assert.strictEqual(u.voceLavorazione("/doc", ID, "A.indd").id, 1);
});

test("copiando la voce di un file del libro, la copia porta il libro", () => {
    const d = disco(conDati({ "/doc": ["lavorazioni.json"] }), {
        "/doc/lavorazioni.json": JSON.stringify([{ file: "A.indd", id: 5, details: kit(5, "Kit") }])
    });
    assert.strictEqual(utilityCon(d).voceLavorazione("/doc", ID, "A.indd", "Volantino.indb").libro, "Volantino.indb");
    assert.strictEqual(d.json(MIO)[0].libro, "Volantino.indb");
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

test("si scrive solo nel file della postazione, aggiornando la voce che c'e' gia'", () => {
    const d = disco(conDati({ "/doc": ["lavorazioni.json"], "/doc/SingularData": [ALTRA_ID], [MIA]: ["lavorazioni.json"], [ALTRA]: ["lavorazioni.json"] }), {
        [MIO]: JSON.stringify([{ file: "A.indd", id: 1, details: kit(1, "vecchio"), pathLinks: "/mio/Links/" }]),
        [ALTRA + "/lavorazioni.json"]: JSON.stringify([]),
        "/doc/lavorazioni.json": JSON.stringify([])
    });
    const u = utilityCon(d);

    u.salvaVoceLavorazione("/doc", ID, { file: "A.indd", id: 9, details: kit(9, "nuovo") });
    u.salvaVoceLavorazione("/doc", ID, { file: "B.indd", id: 4, details: kit(4, "B"), libro: "Volantino.indb" });

    const mie = d.json(MIO);
    assert.strictEqual(mie.length, 2);
    assert.strictEqual(mie[0].id, 9);
    assert.strictEqual(mie[0].pathLinks, "/mio/Links/");
    assert.strictEqual(mie[1].libro, "Volantino.indb");
    assert.deepStrictEqual(d.scritture, [MIO, MIO]);
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
const nonAvvisare = () => { throw new Error("avviso inatteso"); };
const win = { platform: () => "win32", homedir: () => "C:\\Users\\sm2" };

test("la prima volta l'identificativo nasce e si conserva nella cartella comune e nel plugin", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [] });
    const s = storage();

    const id = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "Mac Mini di sm2.local", codice: () => "k3F9a2Lp0Q", avvisa: nonAvvisare });

    assert.strictEqual(id, "Mac-Mini-di-sm2-local_k3F9a2Lp0Q");
    //Direttamente in /Users/Shared, che c'e' sempre: nessuna cartella da creare.
    assert.deepStrictEqual(d.json("/Users/Shared/istanta-idMacchina.json"), { id: id });
    assert.strictEqual(s.dati["istanta.idMacchina"], id);
});

test("l'identificativo non cambia piu', neanche se cambia il nome della macchina", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [] });
    const s = storage();
    const primo = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac-mini", codice: () => "AAAAAAAAAA", avvisa: nonAvvisare });

    const dopo = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac-mini-2", codice: () => "BBBBBBBBBB", avvisa: nonAvvisare });

    assert.strictEqual(dopo, primo);
    assert.strictEqual(d.scritture.length, 1);
});

test("l'identificativo rimasto solo nel plugin si scrive su disco identico", () => {
    //E' il Mac dell'operatore dopo la prima versione: il file non era stato scritto.
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": [], "/Users/sm2": [] });
    const s = storage({ "istanta.idMacchina": "sm2_b8yQMMSqxt" });

    const id = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "altro", codice: () => "BBBBBBBBBB", avvisa: nonAvvisare });

    assert.strictEqual(id, "sm2_b8yQMMSqxt");
    assert.deepStrictEqual(d.json("/Users/Shared/istanta-idMacchina.json"), { id: "sm2_b8yQMMSqxt" });
});

test("il file vince sulla copia del plugin, che si riallinea", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": ["istanta-idMacchina.json"] }, {
        "/Users/Shared/istanta-idMacchina.json": JSON.stringify({ id: "mac-mini_AAAAAAAAAA" })
    });
    const s = storage({ "istanta.idMacchina": "vecchio_CCCCCCCCCC" });

    assert.strictEqual(idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "x", codice: () => "BBBBBBBBBB", avvisa: nonAvvisare }), "mac-mini_AAAAAAAAAA");
    assert.strictEqual(s.dati["istanta.idMacchina"], "mac-mini_AAAAAAAAAA");
    assert.deepStrictEqual(d.scritture, []);
});

test("un file nella posizione della prima versione vale, e si riscrive in quella nuova", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": ["Istanta"], "/Users/Shared/Istanta": ["idMacchina.json"] }, {
        "/Users/Shared/Istanta/idMacchina.json": JSON.stringify({ id: "mac-mini_AAAAAAAAAA" })
    });

    assert.strictEqual(idMacchina({ fs: d.fs, os: mac, storage: storage(), nome: () => "x", codice: () => "BBBBBBBBBB", avvisa: nonAvvisare }), "mac-mini_AAAAAAAAAA");
    assert.deepStrictEqual(d.json("/Users/Shared/istanta-idMacchina.json"), { id: "mac-mini_AAAAAAAAAA" });
});

test("se la cartella comune non e' scrivibile si usa la home", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/sm2": [] });

    const id = idMacchina({ fs: d.fs, os: mac, storage: storage(), nome: () => "mac", codice: () => "AAAAAAAAAA", avvisa: nonAvvisare });

    assert.deepStrictEqual(d.json("/Users/sm2/.istanta-idMacchina.json"), { id: id });
});

test("se non si riesce a scrivere da nessuna parte l'operatore lo vede, una volta sola", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({});
    const avvisi = [];
    const avvisa = (testo) => avvisi.push(testo);
    const s = storage();

    const id = idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac", codice: () => "AAAAAAAAAA", avvisa: avvisa });
    idMacchina({ fs: d.fs, os: mac, storage: s, nome: () => "mac", codice: () => "BBBBBBBBBB", avvisa: avvisa });

    assert.strictEqual(avvisi.length, 1);
    assert.match(avvisi[0], /^Code IDX-175 /);
    //Resta almeno nel plugin, e la seconda volta e' lo stesso.
    assert.strictEqual(s.dati["istanta.idMacchina"], id);
});

test("su Windows la cartella comune e' ProgramData", () => {
    const { percorsiFileIdMacchina } = funzioniIdMacchina();
    assert.deepStrictEqual(percorsiFileIdMacchina(win).scrittura, ["C:/ProgramData/istanta-idMacchina.json", "C:\\Users\\sm2/.istanta-idMacchina.json"]);
    assert.deepStrictEqual(percorsiFileIdMacchina(mac).scrittura, ["/Users/Shared/istanta-idMacchina.json", "/Users/sm2/.istanta-idMacchina.json"]);
    assert.deepStrictEqual(percorsiFileIdMacchina(mac).lettura.slice(2), ["/Users/Shared/Istanta/idMacchina.json", "/Users/sm2/.istanta/idMacchina.json"]);
});

test("un identificativo scritto male non vale e se ne fa uno nuovo", () => {
    const { idMacchina } = funzioniIdMacchina();
    const d = disco({ "/Users/Shared": ["istanta-idMacchina.json"] }, {
        "/Users/Shared/istanta-idMacchina.json": JSON.stringify({ id: "../nome strano" })
    });

    assert.strictEqual(idMacchina({ fs: d.fs, os: mac, storage: storage(), nome: () => "mac", codice: () => "AAAAAAAAAA", avvisa: nonAvvisare }), "mac_AAAAAAAAAA");
});

test("l'identificativo non prova piu' a creare cartelle", () => {
    const corpo = indice.substring(indice.indexOf("var idMacchinaCache = null;"), indice.indexOf("/// I20-1061: il libro del documento in lavorazione"));
    assert.doesNotMatch(corpo, /mkdirSync\(/);
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
