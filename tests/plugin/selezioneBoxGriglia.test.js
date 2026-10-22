/*
 * TASK-13f15b99: la schermata Griglia - Seleziona per ogni box e le righe a scheda.
 *
 * Seleziona porta un box della griglia nella selezione di InDesign: da solo se la selezione
 * corrente e' vuota o contiene qualcos'altro, insieme agli altri se e' fatta soltanto di box
 * della griglia (griglia.js, selezioneConBox). Perche' questo funzioni, il ciclo degli eventi
 * deve riconoscere una selezione di soli box della griglia (events.js, eBoxDiGriglia e
 * grigliaDeiBoxSelezionati) e non trattarla come selezione sconosciuta, che chiuderebbe la
 * schermata: indexNew la tiene aperta e evidenzia le righe.
 *
 * griglia.js ed events.js richiedono InDesign e sotto Node non si caricano: le funzioni pure si
 * estraggono dal sorgente, il resto si verifica sul sorgente come testo.
 *
 * Esecuzione: node --test tests/plugin/selezioneBoxGriglia.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/// Il testo di un membro "    nome(...) {...}" di un oggetto o di una classe, graffe bilanciate.
function membro(testo, nome, rientro = "    ") {
    const inizio = testo.indexOf("\n" + rientro + nome + "(");
    assert.notStrictEqual(inizio, -1, nome + " non trovato");
    const apertura = testo.indexOf("{", inizio);
    let livello = 0;
    for (let i = apertura; i < testo.length; i++) {
        if (testo[i] === "{") {
            livello++;
        }
        else if (testo[i] === "}") {
            livello--;
            if (livello === 0) {
                return testo.substring(inizio + 1 + rientro.length, i + 1);
            }
        }
    }
    assert.fail(nome + " senza graffa di chiusura");
}

function oggettoCon(testo, ...nomi) {
    return new Function("return {\n" + nomi.map(nome => membro(testo, nome)).join(",\n") + "\n};")();
}

//Le righe di codice, senza quelle commentate.
function senzaCommenti(testo) {
    return testo.split("\n").filter(riga => !/^\s*\/\//.test(riga)).join("\n");
}

/* ---- il documento finto: gruppi con etichetta e genitore, come li vede events.js ---- */

class Group {
    constructor(label, parent, id) {
        this.label = label;
        this.parent = parent;
        this.id = id;
    }
}

class Rectangle {
    constructor(label, parent, id) {
        this.label = label;
        this.parent = parent;
        this.id = id;
    }
}

const griglia = new Group("griglia_1", null, 1);
const box3 = new Group("box_3", griglia, 3);
const box5 = new Group("box_5", griglia, 5);
const box7Maiuscolo = new Group("Box_7", griglia, 7);
const riquadro = new Rectangle("sfondo", griglia, 8);
const boxFuoriGriglia = new Group("box_2", new Group("artwork", null, 9), 2);

const eventi = oggettoCon(sorgente("events.js"), "eBoxDiGriglia", "grigliaDeiBoxSelezionati");
const grigliaJs = oggettoCon(sorgente("griglia.js"), "selezioneConBox", "selezioneSenzaBox");

/* ---- cos'e' un box della griglia ---- */

test("un box della griglia e' un gruppo box_N dentro il gruppo della griglia, maiuscole comprese", () => {
    assert.strictEqual(eventi.eBoxDiGriglia(box3), true);
    assert.strictEqual(eventi.eBoxDiGriglia(box7Maiuscolo), true);
    //Un riquadro, un box fuori dalla griglia, la griglia stessa e niente non lo sono.
    assert.strictEqual(eventi.eBoxDiGriglia(riquadro), false);
    assert.strictEqual(eventi.eBoxDiGriglia(boxFuoriGriglia), false);
    assert.strictEqual(eventi.eBoxDiGriglia(griglia), false);
    assert.strictEqual(eventi.eBoxDiGriglia(null), false);
});

test("una selezione di soli box della griglia dice qual e' la griglia; vuota o mista no", () => {
    assert.strictEqual(eventi.grigliaDeiBoxSelezionati([box3, box5]), griglia);
    assert.strictEqual(eventi.grigliaDeiBoxSelezionati([box3]), griglia);
    assert.strictEqual(eventi.grigliaDeiBoxSelezionati([]), null);
    assert.strictEqual(eventi.grigliaDeiBoxSelezionati([box3, riquadro]), null);
    assert.strictEqual(eventi.grigliaDeiBoxSelezionati(null), null);
});

/* ---- la regola di Seleziona ---- */

const eBox = el => eventi.eBoxDiGriglia(el);

test("con la selezione vuota, o con dentro qualcosa che non e' un box della griglia, il box la sostituisce", () => {
    assert.deepStrictEqual(grigliaJs.selezioneConBox([], box5, eBox), [box5]);
    assert.deepStrictEqual(grigliaJs.selezioneConBox(null, box5, eBox), [box5]);
    assert.deepStrictEqual(grigliaJs.selezioneConBox([griglia], box5, eBox), [box5]);
    assert.deepStrictEqual(grigliaJs.selezioneConBox([box3, riquadro], box5, eBox), [box5]);
});

test("con soli box della griglia selezionati il box si aggiunge: una selezione multipla", () => {
    assert.deepStrictEqual(grigliaJs.selezioneConBox([box3], box5, eBox), [box3, box5]);
    assert.deepStrictEqual(grigliaJs.selezioneConBox([box3, box7Maiuscolo], box5, eBox), [box3, box7Maiuscolo, box5]);
});

test("un box gia' selezionato non si aggiunge due volte, nemmeno come proxy diverso con lo stesso id", () => {
    assert.deepStrictEqual(grigliaJs.selezioneConBox([box3, box5], box5, eBox), [box3, box5]);
    const stessoBox5 = new Group("box_5", griglia, 5);
    assert.deepStrictEqual(grigliaJs.selezioneConBox([box3, box5], stessoBox5, eBox), [box3, box5]);
});

test("Deseleziona toglie il box, anche come proxy con lo stesso id, e lascia gli altri", () => {
    assert.deepStrictEqual(grigliaJs.selezioneSenzaBox([box3, box5], box3), [box5]);
    assert.deepStrictEqual(grigliaJs.selezioneSenzaBox([box3, box5], new Group("box_5", griglia, 5)), [box3]);
    //L'ultimo: non resta niente, e chi chiama seleziona la griglia.
    assert.deepStrictEqual(grigliaJs.selezioneSenzaBox([box5], box5), []);
    //Un box che non c'era: la selezione resta com'e'.
    assert.deepStrictEqual(grigliaJs.selezioneSenzaBox([box3], box5), [box3]);
    assert.deepStrictEqual(grigliaJs.selezioneSenzaBox(null, box5), []);
});

/* ---- dove si aggancia nel ciclo degli eventi e nel pannello ---- */

test("il ciclo degli eventi riconosce i box della griglia prima dei gruppi, nella selezione singola e in quella multipla", () => {
    const eventsJs = sorgente("events.js");
    assert.match(eventsJs, /EVENT_NEW_BOX_GRIGLIA_SELECTED = "newBoxGrigliaSelected";/);
    const singola = eventsJs.indexOf("else if (me.eBoxDiGriglia(el)) {");
    const gruppo = eventsJs.indexOf('else if (el.constructor.name == "Group") {');
    assert.ok(singola > 0 && gruppo > singola, "il box della griglia va riconosciuto prima del gruppo generico");
    assert.match(eventsJs, /me\.fireEvent\(me\.EVENT_NEW_BOX_GRIGLIA_SELECTED, \[el\.parent, \[el\]\]\);/);
    const multipla = eventsJs.indexOf("let grigliaDeiBox = me.grigliaDeiBoxSelezionati(app.selection);");
    const multiRefs = eventsJs.indexOf("let isMultiRefs = true;");
    assert.ok(multipla > 0 && multiRefs > multipla, "la multiselezione di box va riconosciuta prima dell'analisi delle ref");
    assert.match(eventsJs, /me\.fireEvent\(me\.EVENT_NEW_BOX_GRIGLIA_SELECTED, \[grigliaDeiBox, Array\.from\(app\.selection\)\]\);/);
});

test("il gestore in indexNew tiene aperta la schermata Griglia e evidenzia le righe", () => {
    const indexNew = sorgente("indexNew.js");
    const inizio = indexNew.indexOf("indesignEvents.addEventListener(indesignEvents.EVENT_NEW_BOX_GRIGLIA_SELECTED,");
    assert.notStrictEqual(inizio, -1);
    const corpo = senzaCommenti(indexNew.substring(inizio, indexNew.indexOf("\n});\n", inizio)));
    assert.doesNotMatch(corpo, /#grigliaTab"\)\.hide\(\)/);
    assert.match(corpo, /apriSchermataGriglia\(griglia\);/);
    assert.match(corpo, /grigliaJs\.evidenziaBoxSelezionati\(boxSelezionati\);/);
    //La selezione della griglia stessa apre la schermata con la stessa funzione.
    const grigliaSelezionata = indexNew.indexOf("indesignEvents.addEventListener(indesignEvents.EVENT_NEW_GRIGLIA_SELECTED,");
    const corpoGriglia = indexNew.substring(grigliaSelezionata, indexNew.indexOf("\n});\n", grigliaSelezionata));
    assert.match(corpoGriglia, /apriSchermataGriglia\(args\[0\]\);/);
    assert.match(indexNew, /^function apriSchermataGriglia\(griglia\) \{/m);
});

test("ogni box dell'elenco ha Seleziona, pieno o vuoto, e le righe sono schede con il data-box-id", () => {
    const grigliaSorgente = sorgente("griglia.js");
    const compila = membro(grigliaSorgente, "async compilaGriglia");
    //L'icona e' quella leggera: search.png e' 2048x2048 e una copia per riga rallentava il pannello.
    const seleziona = compila.indexOf('me._iconaAzione("images/selezionaBox.png", "Seleziona in InDesign")');
    assert.doesNotMatch(grigliaSorgente, /search\.png/);
    assert.ok(require("node:fs").existsSync(require("node:path").join(__dirname, "..", "..", "plugin", "images", "selezionaBox.png")));
    const vuotoOPieno = compila.indexOf("if (!gruppo.infoPresenti) {");
    assert.ok(seleziona > 0 && vuotoOPieno > seleziona, "Seleziona va prima della scelta fra box vuoto e pieno");
    assert.match(compila, /me\.selezionaBoxInGriglia\(gruppo\.box\);/);
    assert.match(compila, /var row = me\._rigaBox\(i \+ 1, gruppo\);/);
    //La barra delle azioni per riferimento: find su una riga staccata, nel DOM di UXP, non trova niente.
    assert.match(compila, /var iconBar = me\._barraAzioni\(\);\s*row\.append\(iconBar\);/);
    assert.doesNotMatch(grigliaSorgente, /\.find\("\.grigliaAzioni"\)/);
    assert.doesNotMatch(compila, /<hr>/);
    assert.doesNotMatch(compila, /lightgreen/);
    const rigaBox = membro(grigliaSorgente, "_rigaBox");
    assert.match(rigaBox, /riga\.attr\("data-box-id"/);
    //Interruttore: sulla riga evidenziata il clic deseleziona; icona e suggerimento seguono lo stato.
    assert.match(compila, /if \(\$\(this\)\.closest\("\.grigliaRiga"\)\.hasClass\("selezionata"\)\) \{\s*me\.deselezionaBoxInGriglia\(gruppo\.box, griglia\);/);
    const evidenzia = membro(grigliaSorgente, "evidenziaBoxSelezionati");
    assert.match(evidenzia, /selezionata \? "images\/deselezionaBox\.png" : "images\/selezionaBox\.png"/);
    assert.match(evidenzia, /"Deseleziona in InDesign" : "Seleziona in InDesign"/);
    //Deselezionato l'ultimo box, la selezione passa alla griglia: vuota chiuderebbe la schermata.
    const deseleziona = membro(grigliaSorgente, "deselezionaBoxInGriglia");
    assert.match(deseleziona, /if \(rimasta\.length == 0\) \{\s*app\.selection = griglia != null && griglia\.isValid \? \[griglia\] : null;/);
    assert.ok(require("node:fs").existsSync(require("node:path").join(__dirname, "..", "..", "plugin", "images", "deselezionaBox.png")));
    //Seleziona passa dalla regola pura e scrive la selezione di InDesign.
    const selezionaBox = membro(grigliaSorgente, "selezionaBoxInGriglia");
    assert.match(selezionaBox, /this\.selezioneConBox\(corrente, box, el => indesignEvents\.eBoxDiGriglia\(el\)\)/);
    assert.match(selezionaBox, /app\.selection = nuova;/);
    //Le icone hanno il suggerimento come attributo: la proprieta' .title in UXP non lo crea.
    assert.doesNotMatch(senzaCommenti(grigliaSorgente), /\.title\s*=/);
    assert.match(membro(grigliaSorgente, "_impostaSuggerimento"), /Tooltip\.impostaTooltip\(elemento\.get\(0\), testo\)/);
});

test("il pannello ha gli stili delle righe e le due sezioni di opzioni", () => {
    //Senza i blocchi commentati: la vecchia schermata e' rimasta in un commento.
    const html = sorgente("index.html").replace(/<!--[\s\S]*?-->/g, "");
    for (const classe of [".grigliaRiga", ".grigliaRiga.selezionata", ".grigliaRiga.bloccata", ".grigliaRiga.vuota", ".grigliaAzioni img", ".grigliaSezione"]) {
        assert.ok(html.indexOf(classe + " {") > 0, classe + " manca negli stili");
    }
    assert.match(html, /<div class="grigliaElenco" id="GrigliaEdit">/);
    //Il valore lo mostra lo slider: niente doppione accanto.
    assert.doesNotMatch(html, /valoreTrasparenzaGriglia/);
    //Gli id dei comandi non sono piu' doppi.
    assert.strictEqual((html.match(/id="ricalcaGriglia"/g) || []).length, 1);
    assert.strictEqual((html.match(/id="comandiGriglia"/g) || []).length, 1);
});
