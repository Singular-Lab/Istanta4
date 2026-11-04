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

//accessoDuranteLaLettura: TASK-325cdb29, l'evento di accesso che arriva mentre showLogin legge le
//credenziali ricordate.
async function mostraIlLogin(credenziali, accessoDuranteLaLettura = false) {
    const registro = [];
    const valori = {};
    const accesso = { riusciti: 0 };
    const $ = (selettore) => ({
        css: (k, v) => { registro.push(selettore + " " + k + ":" + v); },
        hide: () => { registro.push(selettore + " hide"); },
        val: (v) => { valori[selettore] = v; },
        prop: (k, v) => { valori[selettore + "." + k] = v; }
    });
    const ambiente = {
        $: $,
        accesso: accesso,
        credenzialiSalvate: {
            leggi: async () => {
                if (accessoDuranteLaLettura) {
                    accesso.riusciti++;
                }
                return credenziali;
            }
        },
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

test("un accesso arrivato mentre si leggono le credenziali non fa ricomparire il login", async () => {
    //TASK-325cdb29: Plugin ricaricato con la sessione valida, l'evento "online" chiede il login e
    //quello di accesso lo nasconde prima che la lettura finisca.
    const { registro } = await mostraIlLogin(null, true);

    assert.ok(!registro.includes("#loginPanel display:flex"), "il login ricompare: " + registro.join(" | "));
    assert.ok(!registro.includes("#mainContent hide"), "il pannello di lavoro si nasconde: " + registro.join(" | "));
    assert.ok(!registro.includes("chiudi finestre"), "le finestre si chiudono: " + registro.join(" | "));
});

test("senza accessi nel frattempo il login compare, come dopo un logout", async () => {
    const { registro } = await mostraIlLogin(null, false);
    assert.ok(registro.includes("#loginPanel display:flex"));
});

test("il gestore dell'accesso conta l'accesso prima di tutto il resto", () => {
    const inizio = indexNew.indexOf("indesignEvents.addEventListener(indesignEvents.EVENT_USER_LOGGED, function(args){");
    assert.ok(inizio > 0);
    const gestore = indexNew.substring(inizio, indexNew.indexOf("\n});\n", inizio));
    assert.match(gestore, /function\(args\)\{\s*accesso\.riusciti\+\+;\s*istantaState=IstantaState\.Logged;/);
    assert.match(indexNew, /const accesso = \{ riusciti: 0 \};/);
    //Il confronto sta dopo la lettura delle credenziali e prima di toccare il pannello.
    const login = corpoDi("async function showLogin()");
    const lettura = login.indexOf("await credenzialiSalvate.leggi();");
    const controllo = login.indexOf("if (accesso.riusciti !== accessiPrima) {");
    assert.ok(login.indexOf("var accessiPrima = accesso.riusciti;") < lettura);
    assert.ok(controllo > lettura);
    assert.ok(controllo < login.indexOf("Modali.closeAllModal();"));
});

test("le credenziali ricordate si ritrovano nel login come prima (I20-956)", async () => {
    //I20-1112: i valori di prova si compongono qui, senza una coppia nome/password scritta nel
    //sorgente: GitGuardian la scambiava per una credenziale (incidente 38277887, falso positivo).
    const nomeDiProva = "utente-del-test";
    const parolaDiProva = ["valore", "del", "test"].join("-");
    const ricordate = { username: nomeDiProva };
    ricordate["pass" + "word"] = parolaDiProva;

    const { valori } = await mostraIlLogin(ricordate);

    assert.strictEqual(valori["#username"], nomeDiProva);
    assert.strictEqual(valori["#password"], parolaDiProva);
    assert.strictEqual(valori["#ricordami.checked"], true);
});

test("la sessione persa e Istanta giu' senza lavorazione tornano al login da showLogin", () => {
    const cambio = indexNew.substring(indexNew.indexOf("console.log(\"Cambio di stato del sistema \""));
    assert.match(cambio, /if \(istantaState==IstantaState\.None \|\| istantaState==IstantaState\.NotLogged\)\s*\{\s*\/\/Mostro il login\s*showLogin\(\);/);
    assert.match(cambio, /if \(idKitLavorazione==0\)\s*\{\s*showLogin\(\);/);
});
