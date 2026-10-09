/*
 * I20-1073: gli elementi assenti dal box, risolti con noRender.
 *
 * Nella finestra delle differenze della scheda ref un campo, un'etichetta o una foto del gruppo che
 * nel box non c'e' si puo' mettere in noRender con un pulsante. Da li' l'assenza non e' piu' una
 * differenza da risolvere: la preanalisi la restituisce a parte (risolteNoRender), la finestra la
 * mostra fra i "Risolti con noRender" con Annulla, e il segnalino verde la conta insieme alle foto
 * extra decise per questa lavorazione. Le foto extra e le extra auto restano come prima.
 * La schermata noRender cambia lo stesso dato, e dopo il suo Salva le differenze si ricalcolano.
 *
 * noRenderElementi.js e schedaRef.js si caricano sotto Node: le decisioni si provano direttamente,
 * la preanalisi e la finestra sul sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const NoRenderElementi = require("../../plugin/noRenderElementi.js");
const schedaRef = require("../../plugin/schedaRef.js");

const TIPO = NoRenderElementi.TIPO;

//Le assenze come le scrive la preanalisi.
const CAMPO = { label: "descrizione2", difference: "non presente", tipo: "mancante", tipoElemento: TIPO.campo, chiave: "descrizione2" };
const ETICHETTA = { label: "etichetta_bio", difference: "non presente", tipo: "mancante", tipoElemento: TIPO.etichetta, chiave: "bio" };
const FOTO = { label: "6311123_1_T1.jpg", difference: "foto mancante nel box: 6311123_1_T1.jpg", tipo: "mancante", tipoElemento: TIPO.foto, chiave: "6311123_1_T1.jpg" };
const MEMBRI = [{ codRef: 6311123, nomeFoto: "6311123_1_T1.jpg" }, { codRef: 6311124, nomeFoto: "6311124_1_T1.jpg" }];
const EXTRA_MANCANTE = { label: "Logo_SDB.psd", difference: "foto extra mancante nel box: Logo_SDB.psd", tipo: "extraMancante", sigla: "Logo_SDB", tipoElemento: TIPO.logo, nome: "Logo_SDB.psd" };

function sorgente(file) {
    return leggiFileDelPlugin(file).replace(/\r/g, "");
}

/* ---- l'elemento noRender di un'assenza ---- */

test("campi ed etichette assenti diventano l'elemento noRender con la loro chiave", () => {
    assert.deepStrictEqual(NoRenderElementi.elementoDaAssenza(CAMPO, MEMBRI), { tipo: TIPO.campo, chiave: "descrizione2", nome: "descrizione2" });
    assert.deepStrictEqual(NoRenderElementi.elementoDaAssenza(ETICHETTA, []), { tipo: TIPO.etichetta, chiave: "bio", nome: "etichetta_bio" });
});

test("la foto assente si mette in noRender col codice della referenza, trovato fra i membri del gruppo", () => {
    assert.deepStrictEqual(NoRenderElementi.elementoDaAssenza(FOTO, MEMBRI), { tipo: TIPO.foto, chiave: "6311123", nome: "6311123_1_T1.jpg" });
    //Una foto di nessun membro non si sa come salvarla: niente elemento, niente pulsante.
    assert.strictEqual(NoRenderElementi.elementoDaAssenza(FOTO, []), null);
    assert.strictEqual(NoRenderElementi.elementoDaAssenza(FOTO, null), null);
});

test("le foto extra e le differenze che non sono assenze non hanno un elemento noRender", () => {
    assert.strictEqual(NoRenderElementi.elementoDaAssenza(EXTRA_MANCANTE, MEMBRI), null);
    assert.strictEqual(NoRenderElementi.elementoDaAssenza({ label: "prezzo", difference: "contenuto" }, MEMBRI), null);
    assert.strictEqual(NoRenderElementi.elementoDaAssenza(Object.assign({}, CAMPO, { tipoElemento: TIPO.logo }), MEMBRI), null);
    assert.strictEqual(NoRenderElementi.elementoDaAssenza(null, MEMBRI), null);
});

/* ---- la lista noRender da salvare ---- */

test("mettere un elemento lo aggiunge alla lista che c'e', una volta sola", () => {
    const marcati = [{ tipo: TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", presente: false }];
    const elemento = { tipo: TIPO.campo, chiave: "descrizione2", nome: "descrizione2" };

    const una = NoRenderElementi.conElemento(marcati, elemento);
    assert.deepStrictEqual(una, [{ tipo: TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }, elemento]);
    assert.deepStrictEqual(NoRenderElementi.conElemento(una, elemento), una);
    assert.deepStrictEqual(NoRenderElementi.conElemento(null, elemento), [elemento]);
});

test("togliere un elemento lascia gli altri come sono", () => {
    const marcati = [{ tipo: TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }, { tipo: TIPO.foto, chiave: "6311123", nome: "6311123_1_T1.jpg" }];

    assert.deepStrictEqual(NoRenderElementi.senzaElemento(marcati, { tipo: TIPO.foto, chiave: 6311123 }), [marcati[0]]);
    //Lo stesso nome con un altro tipo non e' lo stesso elemento.
    assert.deepStrictEqual(NoRenderElementi.senzaElemento(marcati, { tipo: TIPO.campo, chiave: "logo_bio" }), marcati);
    assert.deepStrictEqual(NoRenderElementi.senzaElemento(null, { tipo: TIPO.campo, chiave: "x" }), []);
});

/* ---- la preanalisi ---- */

test("la preanalisi mette a parte le assenze gia' in noRender e marca le altre per l'azione", () => {
    const confronti = sorgente("confronti.js");
    const corpo = confronti.substring(confronti.indexOf("async confrontoBoxCompiledFieldPreAnalisi("), confronti.indexOf("async mappaturaImpaginato("));

    assert.match(corpo, /var assenzaCampo = \{ label: labelCampo, difference: "non presente", tipo: "mancante",\s*tipoElemento: classificatoCampo\.tipo, chiave: classificatoCampo\.chiave \};\s*if \(NoRenderElementi\.daSegnalareComeMancante\(elementiNoRender, classificatoCampo\.tipo, classificatoCampo\.chiave\)\) \{\s*differenze\.push\(assenzaCampo\);\s*\}\s*else \{\s*risolteNoRender\.push\(assenzaCampo\);\s*\}/);
    assert.match(corpo, /var assenzaFoto = \{ label: foto\.nomeFoto, difference: "foto mancante nel box: " \+ foto\.nomeFoto, tipo: "mancante",\s*tipoElemento: NoRenderElementi\.TIPO_FOTO, chiave: foto\.nomeFoto \};\s*if \(NoRenderElementi\.daSegnalareComeMancante\(elementiNoRender, NoRenderElementi\.TIPO_FOTO, foto\.nomeFoto\)\) \{\s*differenze\.push\(assenzaFoto\);\s*\}\s*else \{\s*risolteNoRender\.push\(assenzaFoto\);\s*\}/);
    assert.match(corpo, /return \{\s*differenze: differenze,\s*errors: errors,\s*risolteNoRender: risolteNoRender\s*\};/);
    //Le foto extra non cambiano: niente "mancante" per loro.
    assert.strictEqual((corpo.match(/tipo: "mancante"/g) || []).length, 2);
});

/* ---- la scheda ---- */

function conScheda(record, prova) {
    const salva = { schedeRefDati: schedaRef.schedeRefDati, inviaNoRender: schedaRef.inviaNoRender, messaggioUtente: global.messaggioUtente };
    schedaRef.schedeRefDati = [{ recordInTracciato: Object.assign({ StatoSelezione: 1 }, record) }];
    return Promise.resolve(prova(schedaRef.schedeRefDati[0].recordInTracciato)).finally(() => {
        schedaRef.schedeRefDati = salva.schedeRefDati;
        schedaRef.inviaNoRender = salva.inviaNoRender;
        if (salva.messaggioUtente === undefined) {
            delete global.messaggioUtente;
        }
        else {
            global.messaggioUtente = salva.messaggioUtente;
        }
    });
}

test("il pulsante Metti in noRender c'e' sulle assenze che si riconoscono", () => conScheda({ membriGruppoFoto: MEMBRI }, () => {
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(CAMPO), ["noRender"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(ETICHETTA), ["noRender"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(FOTO), ["noRender"]);
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(Object.assign({}, FOTO, { chiave: "di_nessuno.jpg" })), []);
    //Le foto extra restano con le loro azioni.
    assert.deepStrictEqual(schedaRef.azioniPerDifferenza(EXTRA_MANCANTE), ["escludiLavorazione"]);
}));

test("mettere in noRender manda la lista con l'elemento in piu', allinea i record e rifa' la finestra", () => conScheda({
    membriGruppoFoto: MEMBRI,
    noRenderElementi: [{ tipo: TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }]
}, async (record) => {
    const inviati = [];
    let rifatta = 0;
    schedaRef.inviaNoRender = async (elementi) => { inviati.push(elementi); return true; };
    global.messaggioUtente = () => {};

    assert.strictEqual(await schedaRef.cambiaNoRenderDellAssenza(FOTO, true, async () => { rifatta++; }), true);

    const attesa = [{ tipo: TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }, { tipo: TIPO.foto, chiave: "6311123", nome: "6311123_1_T1.jpg" }];
    assert.deepStrictEqual(inviati, [attesa]);
    assert.deepStrictEqual(record.noRenderElementi, attesa);
    //La foto del membro risulta in noRender, come dalla schermata noRender.
    assert.strictEqual(record.membriGruppoFoto[0].noRender, true);
    assert.strictEqual(rifatta, 1);

    //Annulla: la stessa lista senza l'elemento.
    assert.strictEqual(await schedaRef.cambiaNoRenderDellAssenza(FOTO, false, async () => { rifatta++; }), true);
    assert.deepStrictEqual(record.noRenderElementi, [attesa[0]]);
    assert.strictEqual(record.membriGruppoFoto[0].noRender, false);
    assert.strictEqual(rifatta, 2);
}));

test("se il server non registra, i record non cambiano e la finestra non si rifa'", () => conScheda({ noRenderElementi: [] }, async (record) => {
    let rifatta = 0;
    schedaRef.inviaNoRender = async () => false;
    global.messaggioUtente = () => {};

    assert.strictEqual(await schedaRef.cambiaNoRenderDellAssenza(CAMPO, true, async () => { rifatta++; }), false);
    assert.deepStrictEqual(record.noRenderElementi, []);
    assert.strictEqual(rifatta, 0);
}));

test("i risolti con noRender si descrivono e contano nel segnalino verde, con le foto extra decise", () => {
    assert.strictEqual(schedaRef.descriviRisoltaNoRender(Object.assign({}, CAMPO, { label: "x" })).endsWith(": non presente nel box, in noRender"), true);
    assert.strictEqual(schedaRef.descriviRisoltaNoRender(FOTO).endsWith(": foto non presente nel box, in noRender"), true);

    assert.deepStrictEqual(schedaRef.segnalinoScheda([], [], [], [CAMPO]), {
        testo: "1", colore: "#1b7f3b", suggerimento: "1 elemento assente messo in noRender - clicca per rivederlo"
    });
    assert.deepStrictEqual(schedaRef.segnalinoScheda([], [], [{ sigla: "Logo_BDP" }], [CAMPO, FOTO]), {
        testo: "3", colore: "#1b7f3b",
        suggerimento: "1 foto extra decisa per questa lavorazione, 2 elementi assenti messi in noRender - clicca per rivederli"
    });
    //Con qualcosa da risolvere non contano, come le decisioni.
    assert.deepStrictEqual(schedaRef.segnalinoScheda([CAMPO], [], [], [FOTO]), schedaRef.segnalinoScheda([CAMPO], []));
});

test("la finestra ha la sezione dei risolti, e il salvataggio della schermata noRender ricalcola le differenze", () => {
    const scheda = sorgente("schedaRef.js");
    assert.match(scheda, /id="segnalazioniNoRender"/);
    assert.match(scheda, /const rifaiAnalisi = async function \(\) \{[\s\S]*?me\.riempiSezioneNoRender\(sezioneNoRender, rifaiAnalisi\);\s*\};/);
    assert.match(scheda, /this\.riempiSezioneNoRender\(sezioneNoRender, rifaiAnalisi\);/);
    assert.match(scheda, /this\.risolteNoRenderDelBox = preAnalisi != null && Array\.isArray\(preAnalisi\.risolteNoRender\) \? preAnalisi\.risolteNoRender : \[\];/);

    const salva = scheda.substring(scheda.indexOf("    salvaNoRender() {"), scheda.indexOf("    inviaNoRender(elementi) {"));
    assert.match(salva, /this\.inviaNoRender\(elementi\)\.then\(/);
    assert.match(salva, /this\.ricalcolaSegnalazioniDellaScheda\(\);/);
    //Un solo punto manda la lista al server.
    assert.strictEqual((scheda.match(/Menabo\/modificaNoRender/g) || []).length, 1);
});

test("nella finestra delle differenze scorre solo la finestra: le sezioni non hanno una barra loro", () => {
    const scheda = sorgente("schedaRef.js");
    const finestra = scheda.substring(scheda.indexOf("async mostraModalSegnalazioni() {"), scheda.indexOf("const intestazione = contenuto.find(\"#segnalazioniIntestazione\");"));
    for (const id of ["segnalazioniElenco", "segnalazioniExtraLavorazione", "segnalazioniNoRender", "segnalazioniBollinoScheda"]) {
        const riga = finestra.substring(finestra.indexOf('id="' + id + '"'), finestra.indexOf("</div>", finestra.indexOf('id="' + id + '"')));
        assert.ok(riga.length > 0, id);
        assert.doesNotMatch(riga, /max-height|overflow/, id);
    }
});
