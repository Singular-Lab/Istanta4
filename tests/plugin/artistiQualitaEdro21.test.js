/*
 * I20-1046: Artisti della Qualita' nel custom di Edro21.
 *
 * Il server riconosce la ref dal campo art_qual (AgenziaLib, Edro21.cs) e le aggiunge i loghi
 * Logo_ADQnaz e Margherita_ADQnaz, ma il Plugin non dava alla base lo stile oggetto del formato.
 * Ora la base prende base_A_ADQnaz per SC e base_P_ADQnaz per gli altri canali, esclusi i box
 * focus, e vince su tutti gli altri stili della base.
 *
 * Il custom di Edro21 fa require('indesign'): la funzione che riconosce la ref si prende dal
 * sorgente, il resto si controlla sul sorgente come in parmigianoEdro21.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const custom = leggiFileDelPlugin("Agenzie/Edro21/custom.js").replace(/\r/g, "");

function artistiDellaQualita() {
    const inizio = custom.indexOf("    artistiDellaQualita(objItem) {");
    assert.notStrictEqual(inizio, -1, "artistiDellaQualita non trovata");
    const fine = custom.indexOf("\n    },\n", inizio);
    const corpo = custom.substring(custom.indexOf("{", inizio) + 1, fine);
    return new Function("objItem", corpo);
}

test("la ref e' Artisti della Qualita' quando art_qual e' un testo non vuoto, come sul server", () => {
    const riconosci = artistiDellaQualita();

    assert.strictEqual(riconosci({ art_qual: "S" }), true);
    assert.strictEqual(riconosci({ art_qual: "" }), false);
    assert.strictEqual(riconosci({ art_qual: null }), false);
    assert.strictEqual(riconosci({}), false);
    assert.strictEqual(riconosci(null), false);
    //Il server guarda solo i testi: un valore di altro tipo non vale.
    assert.strictEqual(riconosci({ art_qual: 1 }), false);
});

test("se la ref non ha il campo, si guarda il suo record del tracciato", () => {
    const riconosci = artistiDellaQualita();

    assert.strictEqual(riconosci({ recordInTracciato: { art_qual: "ADQ" } }), true);
    assert.strictEqual(riconosci({ recordInTracciato: { art_qual: "" } }), false);
    //Il campo della ref, se c'e', conta lui.
    assert.strictEqual(riconosci({ art_qual: "", recordInTracciato: { art_qual: "ADQ" } }), false);
});

test("la base prende base_A_ADQnaz per SC e base_P_ADQnaz per gli altri canali, esclusi i focus", () => {
    assert.match(custom, /var formatoArtistiQualita = meccanica\.indexOf\("focus"\) < 0 && this\.artistiDellaQualita\(objItem\);/);
    assert.match(custom, /if \(formatoArtistiQualita\) \{\s*var a_eff = \{ tipo: "effect", campo_indd: "base", name: canale == "SC" \? "base_A_ADQnaz" : "base_P_ADQnaz" \};\s*meta_meccanica\.azioni\.push\(a_eff\);/);
});

test("lo stile Artisti della Qualita' viene dopo tutti gli altri della base: vince lui, anche sul Parmigiano", () => {
    const adq = custom.indexOf('name: canale == "SC" ? "base_A_ADQnaz" : "base_P_ADQnaz"');
    const stiliDellaBase = ["base_A_Parmigiano", "base_P_VersoNatura", "base_A_VersoNatura", "base_P_B&F", "base_A_B&F",
        "base_P_SDB", "base_P_BDP", "base_A_Piacersi", "base_P_Piacersi", "base_A_SDB", "base_A_BDP"];

    for (const stile of stiliDellaBase) {
        const posizione = custom.indexOf('"' + stile + '"');
        assert.ok(posizione > 0 && posizione < adq, stile + " deve venire prima di ADQ");
    }
    //E prima che le azioni si applichino alla base.
    const applicazione = custom.indexOf("for (var a = 0; a < meta_meccanica.azioni.length; a++) {", adq);
    assert.ok(applicazione > adq);
});

/* ---- il Buono del Paese su una ref Artisti della Qualita' ---- */

function elementoBuonoDelPaese() {
    const inizio = custom.indexOf("    elementoBuonoDelPaese(etichetta) {");
    assert.notStrictEqual(inizio, -1, "elementoBuonoDelPaese non trovata");
    const fine = custom.indexOf("\n    },\n", inizio);
    return new Function("etichetta", custom.substring(custom.indexOf("{", inizio) + 1, fine));
}

test("il logo e lo sfondo del Buono del Paese si riconoscono dalle etichette che mette il core", () => {
    const eBdp = elementoBuonoDelPaese();

    assert.strictEqual(eBdp("foto_extra$Logo_BDP$tipo_3"), true);
    assert.strictEqual(eBdp("sfondo$sfondo_bdp$tipo_5"), true);
    assert.strictEqual(eBdp("X_sfondo$sfondo_bdp$tipo_5"), true);
    //Gli altri loghi e sfondi no, compresi quelli di ADQ e di Scelte di benessere.
    assert.strictEqual(eBdp("foto_extra$Logo_ADQnaz$tipo_3"), false);
    assert.strictEqual(eBdp("foto_extra$Logo_SDB$tipo_3"), false);
    assert.strictEqual(eBdp("sfondo$sfondo_sdb$tipo_5"), false);
    assert.strictEqual(eBdp("sfondo"), false);
    assert.strictEqual(eBdp(null), false);
});

test("su una ref Artisti della Qualita' il custom nasconde logo e sfondo del Buono del Paese", () => {
    assert.match(custom, /else if \(formatoArtistiQualita && this\.elementoBuonoDelPaese\(pItem\.label\)\) \{[\s\S]{0,400}?pItem\.visible = false;\s*\}\s*else if \(formatoParmigiano && nome_proprieta\.indexOf\("sfondo"\) == 0\)/);
});

/* ---- il cambio strutturale: il confronto tiene il box vecchio ---- */

const confrontiSorgente = leggiFileDelPlugin("confronti.js").replace(/\r/g, "");

function elementoDecisoDalleRegole() {
    const inizio = confrontiSorgente.indexOf("function elementoDecisoDalleRegole(etichetta) {");
    assert.notStrictEqual(inizio, -1, "elementoDecisoDalleRegole non trovata");
    const fine = confrontiSorgente.indexOf("\n}\n", inizio);
    return new Function("etichetta", confrontiSorgente.substring(confrontiSorgente.indexOf("{", inizio) + 1, fine));
}

test("base, loghi e sfondi automatici sono decisi dalle regole; testi e foto no", () => {
    const decisoDalleRegole = elementoDecisoDalleRegole();

    assert.strictEqual(decisoDalleRegole("base"), true);
    assert.strictEqual(decisoDalleRegole("base$DNA$BOX1$1$2$3"), true);
    assert.strictEqual(decisoDalleRegole("X_base"), true);
    assert.strictEqual(decisoDalleRegole("base_inostriori_territorio"), true);
    assert.strictEqual(decisoDalleRegole("foto_extra$Logo_BDP$tipo_3"), true);
    assert.strictEqual(decisoDalleRegole("sfondo$sfondo_bdp$tipo_5"), true);
    assert.strictEqual(decisoDalleRegole("descrizione"), false);
    assert.strictEqual(decisoDalleRegole("prezzo_offerta"), false);
    assert.strictEqual(decisoDalleRegole("immagine$1"), false);
    assert.strictEqual(decisoDalleRegole(null), false);
});

test("con la stessa meccanica il confronto riporta visibilita' e stile oggetto e li conta come differenze", () => {
    const blocco = confrontiSorgente.substring(confrontiSorgente.indexOf("if (elementoDecisoDalleRegole(campo.label)) {"));
    assert.ok(blocco.length > 0);
    const corpo = blocco.substring(0, 1200);

    assert.match(corpo, /if \(campo\.visible !== campoBox2\.visible\) \{\s*campo\.visible = campoBox2\.visible;/);
    assert.match(corpo, /campo\.appliedObjectStyle = campoBox2\.appliedObjectStyle;/);
    assert.match(corpo, /listCampiConDifferenze\.push\(Utility\.parseLabel\(campo\.label\)\);/);
    //Dentro il ramo della stessa meccanica, dove prima si guardavano solo testi e immagini.
    const ramo = confrontiSorgente.indexOf("if (box1Duplicate.label == box2.label && !forzaReimpaginazione) {");
    assert.ok(ramo > 0 && ramo < confrontiSorgente.indexOf("if (elementoDecisoDalleRegole(campo.label)) {"));
    //E confronti.js resta il motore: la funzione non e' un suo membro.
    assert.doesNotMatch(confrontiSorgente, /^ {4}elementoDecisoDalleRegole\(/m);
});

test("la scheda non scrive piu' uno stile CSS non valido per i cambi strutturali a valore fisso", () => {
    const scheda = leggiFileDelPlugin("schedaRef.js");
    assert.doesNotMatch(scheda, /<div style="100%">/);
    assert.match(scheda, /<div style="width:100%"><input type="text" class="fieldCambioStrutturale singular-inputTextfield"[^>]*readonly/);
});
