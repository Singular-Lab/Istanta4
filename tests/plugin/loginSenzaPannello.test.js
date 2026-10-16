/*
 * I20-1112: tornando al login, il pannello di lavoro non resta disegnato sopra.
 *
 * Il login (#loginPanel) e' un pannello sopra il resto, ma in UXP i campi di testo stanno sopra a
 * tutto: con la sessione persa e una scheda ref aperta, le descrizioni della scheda (in #mainContent)
 * restavano visibili sopra il modulo di accesso. Il logout manuale nascondeva gia' #mainContent e
 * chiudeva le finestre; la sessione persa e Istanta giu' passano da showLogin, che non lo faceva. Ora
 * lo fa showLogin, per tutti.
 *
 * indexNew.js fa require('indesign') e non si carica sotto Node: showLogin si prende dal sorgente e
 * si esegue con jQuery e moduli finti che registrano le chiamate.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");

function corpoDi(firma) {
    const inizio = indexNew.indexOf(firma);
    assert.ok(inizio >= 0, "manca " + firma);
    return indexNew.substring(inizio, indexNew.indexOf("\n}\n", inizio) + 2);
}

async function mostraIlLogin(credenziali) {
    const registro = [];
    const valori = {};
    const $ = (selettore) => ({
        css: (k, v) => { registro.push(selettore + " " + k + ":" + v); },
        hide: () => { registro.push(selettore + " hide"); },
        val: (v) => { valori[selettore] = v; },
        prop: (k, v) => { valori[selettore + "." + k] = v; }
    });
    const ambiente = {
        $: $,
        credenzialiSalvate: { leggi: async () => credenziali },
        hideLoading: () => registro.push("hideLoading"),
        Modali: { closeAllModal: () => registro.push("chiudi finestre") },
        console: { log: () => { } }
    };
    const nomi = Object.keys(ambiente);
    const showLogin = new Function(...nomi, corpoDi("async function showLogin()") + "\nreturn showLogin;")(...nomi.map(n => ambiente[n]));
    await showLogin();
    return { registro, valori };
}

test("mostrando il login si chiudono le finestre e si nasconde il pannello di lavoro, prima che compaia il login", async () => {
    const { registro } = await mostraIlLogin(null);

    const chiusura = registro.indexOf("chiudi finestre");
    const pannello = registro.indexOf("#mainContent hide");
    const login = registro.indexOf("#loginPanel display:flex");
    assert.ok(chiusura >= 0, "le finestre non si chiudono");
    assert.ok(pannello >= 0, "il pannello di lavoro non si nasconde");
    assert.ok(login > pannello && login > chiusura, "il login compare dopo: " + registro.join(" | "));
});

test("le credenziali ricordate si ritrovano nel login come prima (I20-956)", async () => {
    const { valori } = await mostraIlLogin({ username: "operatore", password: "segreta" });

    assert.strictEqual(valori["#username"], "operatore");
    assert.strictEqual(valori["#password"], "segreta");
    assert.strictEqual(valori["#ricordami.checked"], true);
});

test("la sessione persa e Istanta giu' senza lavorazione tornano al login da showLogin", () => {
    const cambio = indexNew.substring(indexNew.indexOf("console.log(\"Cambio di stato del sistema \""));
    assert.match(cambio, /if \(istantaState==IstantaState\.None \|\| istantaState==IstantaState\.NotLogged\)\s*\{\s*\/\/Mostro il login\s*showLogin\(\);/);
    assert.match(cambio, /if \(idKitLavorazione==0\)\s*\{\s*showLogin\(\);/);
});
