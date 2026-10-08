/*
 * I20-1064: il Plugin legge il cliente dalla sua cartella, senza copie in radice.
 *
 * Prima monta-cliente.sh copiava plugin/Agenzie/<Cliente>/custom.js in plugin/custom.js, fuori da
 * git, e una correzione fatta sulla copia si perdeva al montaggio successivo. Ora
 * plugin/clienteAttivo.json indica l'ipconfig del cliente, e l'ipconfig il custom.js d'archivio:
 * configurazioneCliente.js segue la catena e, se un anello manca, il Plugin non parte e dice quale.
 *
 * Qui: la catena con un require finto, il punto in cui indexNew.js la usa, il modello neutro
 * degli ipconfig, e monta-cliente.sh lanciato in una cartella temporanea.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const ConfigurazioneCliente = require("../../plugin/configurazioneCliente.js");

const RADICE = path.join(__dirname, "..", "..");
const CARTELLA_PLUGIN = path.join(RADICE, "plugin");

/* ---- la catena ---- */

const CUSTOM_EDRO = { callCustom: false, nome: "edro" };
const IPCONFIG_EDRO = { testMode: false, istantaIp: "http://istanta/", custom: "Agenzie/Edro21/custom.js" };

//Un require finto: i file sono le chiavi della mappa, i valori quello che il require restituisce.
//Una funzione come valore fa da file che si rompe al caricamento.
function richiedi(file) {
    const chiesti = [];
    const funzione = function (percorso) {
        chiesti.push(percorso);
        if (!(percorso in file)) {
            const e = new Error("Cannot find module './" + percorso + "'");
            e.code = "MODULE_NOT_FOUND";
            throw e;
        }
        const valore = file[percorso];
        return typeof valore === "function" ? valore() : valore;
    };
    funzione.chiesti = chiesti;
    return funzione;
}

function catenaEdro(modifiche = {}) {
    return Object.assign({
        "clienteAttivo.json": { ipconfig: "Agenzie/Edro21/ipconfig.json" },
        "Agenzie/Edro21/ipconfig.json": IPCONFIG_EDRO,
        "Agenzie/Edro21/custom.js": CUSTOM_EDRO
    }, modifiche);
}

test("con la catena completa arrivano l'ipconfig e il custom del cliente", () => {
    const r = richiedi(catenaEdro());
    const esito = ConfigurazioneCliente.carica(r);

    assert.strictEqual(esito.errore, undefined);
    assert.strictEqual(esito.ipconfig, IPCONFIG_EDRO);
    assert.strictEqual(esito.customAgenzia, CUSTOM_EDRO);
    assert.strictEqual(esito.percorsoCustom, "Agenzie/Edro21/custom.js");
    assert.deepStrictEqual(r.chiesti, ["clienteAttivo.json", "Agenzie/Edro21/ipconfig.json", "Agenzie/Edro21/custom.js"]);
});

test("i percorsi con ./ davanti o con le barre di Windows valgono lo stesso", () => {
    const esito = ConfigurazioneCliente.carica(richiedi(catenaEdro({
        "clienteAttivo.json": { ipconfig: "./Agenzie/Edro21/ipconfig.json" },
        "Agenzie/Edro21/ipconfig.json": Object.assign({}, IPCONFIG_EDRO, { custom: "Agenzie\\Edro21\\custom.js" })
    })));

    assert.strictEqual(esito.customAgenzia, CUSTOM_EDRO);
});

test("senza clienteAttivo.json il Plugin non parte e dice di montare il cliente", () => {
    const file = catenaEdro();
    delete file["clienteAttivo.json"];
    const esito = ConfigurazioneCliente.carica(richiedi(file));

    assert.match(esito.errore, /^Nessun cliente montato su questa postazione: manca plugin\/clienteAttivo\.json\./);
    assert.match(esito.errore, /\.\/monta-cliente\.sh <Cliente>/);
    assert.strictEqual(esito.customAgenzia, undefined);
});

test("un puntatore senza ipconfig, o che esce dal Plugin, non vale", () => {
    for (const puntatore of [{}, { ipconfig: "" }, { ipconfig: "../ipconfig.json" }, { ipconfig: "/etc/ipconfig.json" },
        { ipconfig: "C:\\ipconfig.json" }, { ipconfig: "Agenzie/../../fuori.json" }, null]) {
        const esito = ConfigurazioneCliente.carica(richiedi(catenaEdro({ "clienteAttivo.json": puntatore })));
        assert.match(esito.errore, /clienteAttivo\.json non indica un ipconfig valido/, JSON.stringify(puntatore));
    }
});

test("l'ipconfig indicato che non c'e' viene nominato, con il modello da cui crearlo", () => {
    const file = catenaEdro();
    delete file["Agenzie/Edro21/ipconfig.json"];
    const esito = ConfigurazioneCliente.carica(richiedi(file));

    assert.match(esito.errore, /^Non riesco a leggere plugin\/Agenzie\/Edro21\/ipconfig\.json \(Cannot find module/);
    assert.match(esito.errore, /plugin\/Agenzie\/ipconfig\.template\.json/);
});

test("un ipconfig senza custom lo dice", () => {
    const senza = Object.assign({}, IPCONFIG_EDRO);
    delete senza.custom;
    const esito = ConfigurazioneCliente.carica(richiedi(catenaEdro({ "Agenzie/Edro21/ipconfig.json": senza })));

    assert.match(esito.errore, /Agenzie\/Edro21\/ipconfig\.json non indica in "custom" il custom\.js del cliente/);
});

test("un custom che manca o si rompe al caricamento viene nominato, con il motivo", () => {
    const file = catenaEdro();
    delete file["Agenzie/Edro21/custom.js"];
    assert.match(ConfigurazioneCliente.carica(richiedi(file)).errore,
        /^Non riesco a caricare plugin\/Agenzie\/Edro21\/custom\.js \(Cannot find module/);

    const rotto = catenaEdro({ "Agenzie/Edro21/custom.js": () => { throw new SyntaxError("Unexpected token"); } });
    assert.strictEqual(ConfigurazioneCliente.carica(richiedi(rotto)).errore,
        "Non riesco a caricare plugin/Agenzie/Edro21/custom.js (Unexpected token).");
});

/* ---- dove la usa indexNew ---- */

test("indexNew carica il cliente dalla catena e si ferma se manca qualcosa", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

    assert.doesNotMatch(indexNew, /require\(['"]\.\/custom['"]\)/);
    assert.doesNotMatch(indexNew, /require\(['"]\.\/ipconfig\.json['"]\)/);
    assert.match(indexNew, /const configurazioneCliente = ConfigurazioneCliente\.carica\(function \(percorso\) \{ return require\('\.\/' \+ percorso\); \}\);/);
    assert.match(indexNew, /if \(configurazioneCliente\.errore != null\) \{[\s\S]*?mostraAvvioPannello\(configurazioneCliente\.errore, false\);\s*throw new Error\("I20-1064: "/);
    assert.match(indexNew, /const customAgenzia = configurazioneCliente\.customAgenzia;/);
    assert.match(indexNew, /const ipconfig = configurazioneCliente\.ipconfig;/);

    //Il custom si carica dove si caricava prima: dopo il controllo dell'avvio, prima degli altri moduli.
    const controlloAvvio = indexNew.indexOf("if (!AvvioPannello.controlla({");
    const carica = indexNew.indexOf("ConfigurazioneCliente.carica(");
    assert.ok(controlloAvvio > 0 && carica > controlloAvvio);
    assert.ok(carica < indexNew.indexOf("require('./XMLHttpRequestClient')"));
});

/* ---- il modello ---- */

const MODELLO = path.join(CARTELLA_PLUGIN, "Agenzie", "ipconfig.template.json");

test("il modello neutro ha le voci che il Plugin legge, senza indirizzi, e sta in git", () => {
    const modello = JSON.parse(fs.readFileSync(MODELLO, "utf8"));

    for (const voce of ["testMode", "olimpoIp", "olimpoIpTestMode", "istantaIp", "istantaIpTestMode", "custom"]) {
        assert.ok(voce in modello, voce);
    }
    assert.strictEqual(modello.testMode, false);
    for (const voce of ["olimpoIp", "olimpoIpTestMode", "istantaIp", "istantaIpTestMode"]) {
        assert.strictEqual(modello[voce], "", voce);
    }
    assert.strictEqual(modello.custom, "Agenzie/__CLIENTE__/custom.js");

    const gitignore = fs.readFileSync(path.join(RADICE, ".gitignore"), "utf8").replace(/\r/g, "").split("\n");
    assert.ok(gitignore.indexOf("!plugin/Agenzie/ipconfig.template.json") > gitignore.indexOf("**/ipconfig*.json"),
        "il modello deve essere un'eccezione alla regola degli ipconfig");
});

test("per ogni cliente del Plugin il modello porta a un custom.js che esiste", () => {
    const testo = fs.readFileSync(MODELLO, "utf8");
    const clienti = fs.readdirSync(path.join(CARTELLA_PLUGIN, "Agenzie"), { withFileTypes: true }).filter(v => v.isDirectory());
    assert.ok(clienti.length > 0);
    for (const cliente of clienti) {
        const custom = JSON.parse(testo.replace("__CLIENTE__", cliente.name)).custom;
        assert.ok(ConfigurazioneCliente.percorsoValido(custom), custom);
        assert.ok(fs.existsSync(path.join(CARTELLA_PLUGIN, custom)), custom);
    }
});

/* ---- monta-cliente.sh ---- */

const bashDisponibile = spawnSync("bash", ["--version"]).status === 0;

//Una radice finta con lo script, il modello e l'archivio di Edro21: il resto (Istanta, la dll)
//manca, e lo script lo segnala, ma la parte del Plugin si fa lo stesso.
function radiceFinta(prepara) {
    const cartella = fs.mkdtempSync(path.join(os.tmpdir(), "monta-cliente-"));
    fs.copyFileSync(path.join(RADICE, "monta-cliente.sh"), path.join(cartella, "monta-cliente.sh"));
    fs.mkdirSync(path.join(cartella, "plugin", "Agenzie", "Edro21"), { recursive: true });
    fs.copyFileSync(MODELLO, path.join(cartella, "plugin", "Agenzie", "ipconfig.template.json"));
    fs.writeFileSync(path.join(cartella, "plugin", "Agenzie", "Edro21", "custom.js"), "//EDRO21 archivio\n");
    if (prepara) {
        prepara(cartella);
    }
    const esito = spawnSync("bash", [path.join(cartella, "monta-cliente.sh"), "Edro21"], { encoding: "utf8" });
    return { cartella, uscita: esito.stdout + esito.stderr, leggi: (relativo) => fs.readFileSync(path.join(cartella, relativo), "utf8"),
        esiste: (relativo) => fs.existsSync(path.join(cartella, relativo)) };
}

test("monta-cliente scrive il puntatore e crea l'ipconfig dal modello, senza copiare il custom", { skip: !bashDisponibile }, () => {
    const r = radiceFinta();
    try {
        assert.deepStrictEqual(JSON.parse(r.leggi("plugin/clienteAttivo.json")), { ipconfig: "Agenzie/Edro21/ipconfig.json" });
        assert.strictEqual(JSON.parse(r.leggi("plugin/Agenzie/Edro21/ipconfig.json")).custom, "Agenzie/Edro21/custom.js");
        assert.ok(!r.esiste("plugin/custom.js"), "il custom non si copia piu' in radice");
        assert.match(r.uscita, /creato dal modello: SCRIVI GLI INDIRIZZI/);
    }
    finally {
        fs.rmSync(r.cartella, { recursive: true, force: true });
    }
});

test("monta-cliente non tocca un ipconfig che c'e' gia', ne' i vecchi file in radice", { skip: !bashDisponibile }, () => {
    const ipconfig = JSON.stringify({ testMode: false, istantaIp: "http://mio/", custom: "Agenzie/Edro21/custom.js" });
    const r = radiceFinta(cartella => {
        fs.writeFileSync(path.join(cartella, "plugin", "Agenzie", "Edro21", "ipconfig.json"), ipconfig);
        fs.writeFileSync(path.join(cartella, "plugin", "custom.js"), "//correzione mai riportata\n");
    });
    try {
        assert.strictEqual(r.leggi("plugin/Agenzie/Edro21/ipconfig.json"), ipconfig);
        assert.strictEqual(r.leggi("plugin/custom.js"), "//correzione mai riportata\n");
        assert.match(r.uscita, /ATTENZIONE: plugin\/custom\.js non e' piu' usato ed e' DIVERSO/);
        assert.ok(r.esiste("plugin/clienteAttivo.json"));
    }
    finally {
        fs.rmSync(r.cartella, { recursive: true, force: true });
    }
});

test("monta-cliente si ferma su un ipconfig senza custom, e non scrive il puntatore", { skip: !bashDisponibile }, () => {
    const r = radiceFinta(cartella => {
        fs.writeFileSync(path.join(cartella, "plugin", "Agenzie", "Edro21", "ipconfig.json"), JSON.stringify({ testMode: false }));
    });
    try {
        assert.match(r.uscita, /FERMO: plugin\/Agenzie\/Edro21\/ipconfig\.json non ha la voce "custom"/);
        assert.ok(!r.esiste("plugin/clienteAttivo.json"));
    }
    finally {
        fs.rmSync(r.cartella, { recursive: true, force: true });
    }
});
