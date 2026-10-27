/*
 * TASK-5d3fea89: lo schema delle descrizioni nella schermata di modifica della scheda ref.
 *
 * Caso dell'operatore: Edro21, BOX6, 6714445 (Salame Ungherese). Lo schema non si applicava, la
 * descrizione3 assente non si poteva aggiungere e la descrizione4, nascosta dall'esportazione, non si
 * vedeva. Tre difetti che c'erano gia':
 * - il campo offerta che l'export accoda alla descrizione dei boxetti (CPREZ_CampoOfferta_Descr2_boxetto,
 *   con l'euro in EURO piccolo_Descr2_boxetto) non sta in nessuno schema, e faceva fallire tutti;
 * - le regole degli schemi arrivano come blocchi { regole: [{ campo, operatore, value }] } e il codice
 *   cercava liste di { campo, operatore: "==", valore }: non le valutava, e vinceva sempre il primo;
 * - i tratti _$Hidden stavano in una riga invisibile, e il Salva li riscriveva nel box senza _$Hidden.
 *
 * schedaRef.js si carica sotto Node; pluginMiddleware.js no, e le sue funzioni di valutazione delle
 * regole si prendono dal sorgente, come in contestoPromoLibreria.test.js.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const schedaRef = require("../../plugin/schedaRef.js");

//Il plugin di agenzia di Edro21 come lo riceve il Plugin: Istanta lo serializza in camelCase.
function inCamelCase(valore) {
    if (Array.isArray(valore)) {
        return valore.map(inCamelCase);
    }
    if (valore != null && typeof valore === "object") {
        const risultato = {};
        Object.keys(valore).forEach(k => { risultato[k.charAt(0).toLowerCase() + k.substring(1)] = inCamelCase(valore[k]); });
        return risultato;
    }
    return valore;
}
const pluginEdro = inCamelCase(JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceCustomPlugin.json"), "utf8")));
const SCHEMI_EDRO = pluginEdro.schemiDescrizioni;

//valutaBloccoRegole e le funzioni che usa, come sono scritte in pluginMiddleware.js.
function middlewareVero() {
    const testo = leggiFileDelPlugin("pluginMiddleware.js");
    const membro = function (nome) {
        const inizio = testo.indexOf("\n    " + nome + "(");
        assert.notStrictEqual(inizio, -1, nome + " non trovata in pluginMiddleware.js: il test va aggiornato");
        let livello = 0;
        for (let i = inizio; i < testo.length; i++) {
            if (testo[i] === "{") { livello++; }
            else if (testo[i] === "}") { livello--; if (livello === 0) { return testo.substring(inizio, i + 1); } }
        }
        assert.fail(nome + " non delimitata");
    };
    return new Function("return ({" + ["valutaBlocchiRegole", "valutaBloccoRegole", "valutaRegolaCondizione", "getValueByPath", "normalize", "isIn"].map(membro).join(",") + "});")();
}
const middleware = middlewareVero();
//Come lo chiama la scheda: dal suo oggetto.
const valutaBlocco = (record, blocco) => middleware.valutaBloccoRegole(record, blocco);

//Gli stili della descrizione nel box di 6714445, come li legge TestoTag.stiliInOrdine.
const STILI_6714445 = ["A.DES_descr_nome", "A.DES_descr_marca", "CPREZ_CampoOfferta_Descr2_boxetto",
    "EURO piccolo_Descr2_boxetto", "CPREZ_CampoOfferta_Descr2_boxetto"];
const RECORD_6714445 = { nota_esempio: "", "Descrizioni.Descrizione3": "", "Descrizioni.Descrizione4": "al kg" };

/* ---- gli elementi dello schema ---- */

test("un elemento dello schema si legge con la sua regola e il nome senza gruppo", () => {
    assert.deepStrictEqual(schedaRef.elementoDelloSchema("START$A.DES_descr_nome"), { regola: "START", nome: "DES_descr_nome" });
    assert.deepStrictEqual(schedaRef.elementoDelloSchema("DES_descr_nome"), { regola: "", nome: "DES_descr_nome" });
    assert.deepStrictEqual(schedaRef.elementoDelloSchema("IN$DESCRIZIONE_TITOLO"), { regola: "IN", nome: "DESCRIZIONE_TITOLO" });

    assert.strictEqual(schedaRef.stileNelloSchema("A.DES_descr_nome", "START$A.DES_descr_nome"), true);
    assert.strictEqual(schedaRef.stileNelloSchema("DES_descr_nome_SC", "START$A.DES_descr_nome"), true);
    assert.strictEqual(schedaRef.stileNelloSchema("DES_descr_marca", "START$A.DES_descr_nome"), false);
    assert.strictEqual(schedaRef.stileNelloSchema("DES_descr_gr", "DES_descr_gr"), true);
    assert.strictEqual(schedaRef.stileNelloSchema("X_SC", "END$_SC"), true);
    assert.strictEqual(schedaRef.stileNelloSchema("CPREZ_CampoOfferta_Descr2_boxetto", "START$A.DES_descr_nome"), false);

    assert.strictEqual(schedaRef.postoNelloSchema("A.DES_descr_tipo", SCHEMI_EDRO[2].schema, 0), 2);
    assert.strictEqual(schedaRef.postoNelloSchema("A.DES_descr_nome", SCHEMI_EDRO[2].schema, 1), -1);
    assert.strictEqual(schedaRef.postoNelloSchema("CPREZ_CampoOfferta_Descr2_boxetto", SCHEMI_EDRO[2].schema, 0), -1);
});

/* ---- la scelta dello schema ---- */

test("6714445: il campo offerta nella descrizione non impedisce lo schema, e vale quello con la grammatura", () => {
    const schema = schedaRef.schemaDellaDescrizione(STILI_6714445, SCHEMI_EDRO, RECORD_6714445, valutaBlocco);
    assert.deepStrictEqual(schema, ["START$A.DES_descr_nome", "START$A.DES_descr_marca", "START$A.DES_descr_tipo", "START$A.DES_descr_gr"]);
});

test("le regole degli schemi di Edro21 si valutano: lo schema con l'esempio solo se nota_esempio lo dice", () => {
    const stili = ["A.DES_descr_nome", "A.DES_descr_marca"];
    //Con l'esempio, e non evidenziato: lo schema con DES_descr_es.
    assert.strictEqual(schedaRef.schemaDellaDescrizione(stili, SCHEMI_EDRO, { nota_esempio: "esempio" }, valutaBlocco).slice(-1)[0], "START$A.DES_descr_es");
    //Senza esempio, o evidenziato: quello con la grammatura.
    assert.strictEqual(schedaRef.schemaDellaDescrizione(stili, SCHEMI_EDRO, { nota_esempio: "" }, valutaBlocco).slice(-1)[0], "START$A.DES_descr_gr");
    assert.strictEqual(schedaRef.schemaDellaDescrizione(stili, SCHEMI_EDRO, { nota_esempio: "esempio evidenziato" }, valutaBlocco).slice(-1)[0], "START$A.DES_descr_gr");
    //Prima le regole non si valutavano: col primo schema che conteneva gli stili vinceva sempre l'esempio.
    assert.strictEqual(schedaRef.schemaDellaDescrizione(stili, SCHEMI_EDRO, { nota_esempio: "" }, () => true).slice(-1)[0], "START$A.DES_descr_es");
});

test("uno stile che uno schema conosce ma fuori posto fa ancora fallire quello schema", () => {
    //La marca prima del nome: nessuno schema li ha in quest'ordine.
    assert.strictEqual(schedaRef.schemaDellaDescrizione(["A.DES_descr_marca", "A.DES_descr_nome"], SCHEMI_EDRO, RECORD_6714445, valutaBlocco), null);
    assert.strictEqual(schedaRef.schemaDellaDescrizione(["A.DES_descr_nome"], [], RECORD_6714445, valutaBlocco), null);
    assert.strictEqual(schedaRef.schemaDellaDescrizione(["A.DES_descr_nome"], null, RECORD_6714445, valutaBlocco), null);
});

test("le regole nella forma vecchia, a liste, valgono ancora; senza regole lo schema vale", () => {
    const schemi = [
        { schema: ["START$X"], setRegole: [[{ campo: "reparto", operatore: "==", valore: "25" }]] },
        { schema: ["START$X"], setRegole: [] }
    ];
    assert.strictEqual(schedaRef.schemaDellaDescrizione(["X"], schemi, { reparto: "25" }, valutaBlocco), schemi[0].schema);
    assert.strictEqual(schedaRef.schemaDellaDescrizione(["X"], schemi, { reparto: "30" }, valutaBlocco), schemi[1].schema);
    assert.strictEqual(schedaRef.regoleVecchieDelloSchemaValide([{ campo: "assente", operatore: "==", valore: "x" }], {}), false);
    assert.strictEqual(schedaRef.regoleDelloSchemaValide(null, {}, valutaBlocco), true);
});

/* ---- il tratto nascosto ---- */

test("il tratto nascosto dall'esportazione si trova per l'elemento dello schema, una volta sola", () => {
    const nascosti = [{ stileServer: "DES_descr_gr_$Hidden", stile: "DES_descr_gr", contenuto: "al kg", mostrato: false }];
    const trovato = schedaRef.trattoNascostoDelloSchema(nascosti, "START$A.DES_descr_gr");
    assert.strictEqual(trovato, nascosti[0]);
    assert.strictEqual(schedaRef.trattoNascostoDelloSchema(nascosti, "START$A.DES_descr_tipo"), null);
    nascosti[0].mostrato = true;
    assert.strictEqual(schedaRef.trattoNascostoDelloSchema(nascosti, "START$A.DES_descr_gr"), null);
    assert.strictEqual(schedaRef.trattoNascostoDelloSchema(null, "START$A.DES_descr_gr"), null);
});

test("la casella del tratto nascosto si vede, in sola lettura, col suo testo, e resta un tratto nascosto", () => {
    //jQuery finto che tiene gli attributi, il testo e lo stile, quanto serve alla casella.
    const crea = function (html) {
        const el = { html: html, attributi: {}, css: {}, valore: null, figli: [] };
        el.attr = (k, v) => { if (v === undefined) { return el.attributi[k]; } el.attributi[k] = v; return el; };
        el.val = (v) => { el.valore = v; return el; };
        el.text = (t) => { el.testo = t; return el; };
        el.append = (f) => { el.figli.push(f); return el; };
        el.css = Object.assign((k, v) => { el.css[k] = v; return el; }, {});
        return el;
    };
    const salvato = global.$;
    global.$ = crea;
    try {
        const scheda = Object.create(schedaRef);
        scheda.noteSolaLetturaDaMostrare = [];
        const nascosto = { stileServer: "DES_descr_gr_$Hidden", stile: "DES_descr_gr", contenuto: "al kg", mostrato: false };
        const colonna = scheda.casellaDelTrattoNascosto(nascosto, null, { fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" });

        const textarea = colonna.figli.find(f => /^<textarea/.test(f.html));
        assert.ok(textarea, "manca la casella");
        assert.match(textarea.html, /readonly/);
        assert.match(textarea.html, /trattonascosto="1"/);
        assert.match(textarea.html, /labelCorrispondente="descrizione"/);
        assert.strictEqual(textarea.attributi.currentCharacterStyle, "DES_descr_gr");
        assert.strictEqual(textarea.valore, "al kg");
        assert.strictEqual(nascosto.mostrato, true);
        assert.deepStrictEqual(scheda.noteSolaLetturaDaMostrare, [{ fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" }]);
        //Ha una casella: sotto i campi la sua nota non si ripete.
        assert.deepStrictEqual(scheda.fondamentaliConCasellaInSolaLettura, ["descrizione4"]);
        //Il nome dello stile e, accanto, il perche' e' in sola lettura; sfondo e bordo delle disattivate.
        const etichetta = colonna.figli.find(f => /^<label/.test(f.html)).html;
        assert.match(etichetta, />DES_descr_gr <span class="indicazioneSolaLettura"[^>]*>&middot; nascosta da logiche agenzia<\/span><\/label>/);
        assert.strictEqual(textarea.css["background-color"], "#d9d9d9");
        assert.strictEqual(textarea.css.border, "1px dashed #7a7a7a");
        //Larga quanto la sua parte di riga, come le altre caselle: senza configurazione due per riga, alta 50.
        assert.match(colonna.html, /style="position: relative; flex: 0 0 auto; width: 50%; box-sizing: border-box; margin: 0 0 6px 0; padding: 0 10px 0 0;"/);
        assert.match(textarea.html, /style="height: 50px; width: 100%; margin: 0; background-color:white; color:black;"/);
    }
    finally {
        if (salvato === undefined) { delete global.$; } else { global.$ = salvato; }
    }
});

/* ---- la schermata ---- */

test("la schermata usa la scelta nuova, e le caselle vuote nascono solo prima di uno stile dello schema", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async attivaSchermateReferenza(");
    const schermata = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    assert.match(schermata, /schemaTrovato = me\.schemaDellaDescrizione\(listaStili, schemi, primario\.recordInTracciato, function \(record, blocco\) \{\s*return pluginMiddleware\.valutaBloccoRegole != null \? pluginMiddleware\.valutaBloccoRegole\(record, blocco\) : true;/);
    //La scelta in linea, con le regole mai valutate, non c'e' piu'.
    assert.doesNotMatch(schermata, /var regoleRispettate = true;/);
    assert.doesNotMatch(schermata, /\.insert\(0, ""\)/);

    assert.match(schermata, /var postoNelloSchema = schemaTrovato != null \? me\.postoNelloSchema\(characterName, schemaTrovato, lastStileSchemaInserito\) : -1;\s*if \(postoNelloSchema >= 0\) \{\s*for \(var \$k = lastStileSchemaInserito; \$k < postoNelloSchema; \$k\+\+\) \{/);
    assert.match(schermata, /lastStileSchemaInserito = postoNelloSchema \+ 1;/);

    //Il tratto nascosto prende il posto della casella vuota, in mezzo e in coda, e non si ripete nella riga nascosta.
    assert.strictEqual((schermata.match(/me\.casellaDelTrattoNascosto\(/g) || []).length, 2);
    assert.match(schermata, /if \(nascostiDellaDescrizione\.some\(n => n\.mostrato && n\.stileServer === stile\)\) \{\s*continue;/);
});

test("riscrivendo il box dopo il salvataggio, i tratti nascosti restano nascosti", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(sorgente, /let testo = campoDesc\.val\(\);\s*(\/\/[^\n]*\n\s*)*if \(campoDesc\.attr\("trattonascosto"\) == "1"\) \{\s*stile = stile \+ "_\$Hidden";\s*\}\s*(\/\/[^\n]*\n\s*)*descr \+= "<" \+ stile \+ ">" \+ testo \+ "<\/" \+ stile \+ ">";/);
    //E TestoTag, scrivendo il box, salta il testo degli stili $Hidden.
    assert.match(leggiFileDelPlugin("testoTag.js"), /if \(activeStyle && activeStyle\.includes\("\$Hidden"\)\) \{\s*continue;/);
});

/* ---- l'ordine delle caselle (secondo giro) ----
 * Le caselle degli elementi dello schema che il box non ha vanno prima dei blocchi in coda che nessuno
 * schema prevede: prima nel Salame (descrizione3 assente) il campo offerta veniva prima di DES_descr_tipo
 * e DES_descr_gr, nella Mortadella (descrizione3 nel box) dopo DES_descr_tipo.
 */

test("i blocchi in coda vengono dopo l'ultimo tratto che lo schema colloca, con o senza la descrizione3", () => {
    const schema = SCHEMI_EDRO[2].schema;
    //Salame: nome, marca, poi il campo offerta.
    assert.strictEqual(schedaRef.ultimoTrattoDelloSchema(["DES_descr_nome", "DES_descr_marca", "CPREZ_CampoOfferta_Descr2_boxetto"], schema), 1);
    //Mortadella: la descrizione3 c'e'.
    assert.strictEqual(schedaRef.ultimoTrattoDelloSchema(["DES_descr_nome", "DES_descr_marca", "DES_descr_tipo", "CPREZ_CampoOfferta_Descr2_boxetto"], schema), 2);
    //Un blocco sconosciuto in mezzo non e' in coda.
    assert.strictEqual(schedaRef.ultimoTrattoDelloSchema(["DES_descr_nome", "CPREZ_CampoOfferta_Descr2_boxetto", "DES_descr_marca"], schema), 2);
    assert.strictEqual(schedaRef.ultimoTrattoDelloSchema(["CPREZ_CampoOfferta_Descr2_boxetto"], schema), -1);
    assert.strictEqual(schedaRef.ultimoTrattoDelloSchema(null, schema), -1);
});

test("la schermata completa lo schema prima del primo blocco in coda, e a fine giro", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async attivaSchermateReferenza(");
    const schermata = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    assert.match(schermata, /var ultimoTrattoDelloSchema = schemaTrovato != null \? me\.ultimoTrattoDelloSchema\(trattiDelCampo\.map\(t => t\.nome\), schemaTrovato\) : -1;\s*var completaLoSchema = function \(\) \{/);
    //Davanti al blocco in coda, prima della scansione dello schema per il tratto.
    const davanti = schermata.indexOf("if (schemaTrovato != null && $j > ultimoTrattoDelloSchema) {");
    const scansione = schermata.indexOf("var postoNelloSchema = schemaTrovato != null ? me.postoNelloSchema(characterName, schemaTrovato, lastStileSchemaInserito) : -1;");
    assert.ok(davanti > 0 && scansione > davanti);
    assert.strictEqual((schermata.match(/completaLoSchema\(\);/g) || []).length, 2);
});

/* ---- etichette e caselle in sola lettura (secondo giro) ---- */

test("il nome dello stile si legge senza la cartella", () => {
    assert.strictEqual(schedaRef.nomeSenzaCartella("A.DES_descr_tipo"), "DES_descr_tipo");
    assert.strictEqual(schedaRef.nomeSenzaCartella("DES_descr_tipo"), "DES_descr_tipo");
    assert.strictEqual(schedaRef.nomeSenzaCartella(null), "");
});

test("l'etichetta sta su una riga larga quanto la colonna, col perche' della sola lettura accanto e il testo intero nel title", () => {
    const etichetta = schedaRef.etichettaDellaCasella("A.DES_descr_tipo", null, "alterato da logiche agenzia");
    assert.match(etichetta, /^<label title="DES_descr_tipo &middot; alterato da logiche agenzia" style="display: block; margin: 8px 0 4px 0; font-size: 11px; color:#e0e0e0; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">DES_descr_tipo <span class="indicazioneSolaLettura" style="font-size: 10px; color: #a8a8a8;">&middot; alterato da logiche agenzia<\/span><\/label>$/);
    //Senza indicazione il solo nome, anche nel title; il giallo di una differenza resta.
    assert.match(schedaRef.etichettaDellaCasella("DES_descr_nome", "gold", null), /^<label title="DES_descr_nome" [^>]*color:gold;[^>]*>DES_descr_nome<\/label>$/);
    //Il testo non diventa HTML, nemmeno nel title.
    const protetta = schedaRef.etichettaDellaCasella('A<b>"', null, "x&y");
    assert.match(protetta, />A&lt;b&gt;&quot; <span[^>]*>&middot; x&amp;y<\/span>/);
    assert.match(protetta, /^<label title="A&lt;b&gt;&quot; &middot; x&amp;y" /);
});

test("le misure delle caselle vengono dalla configurazione dell'agenzia, e senza si usano quelle di prima", () => {
    //Edro21: due per riga, alte 100, 10 di spazio. La larghezza in pixel non conta piu'.
    assert.deepStrictEqual(schedaRef.misureDelleCaselle(pluginEdro.grandezzeBox), { perRiga: 2, altezza: 100, spazio: 10 });
    assert.deepStrictEqual(schedaRef.misureDelleCaselle(null), { perRiga: 2, altezza: 50, spazio: 10 });
    assert.deepStrictEqual(schedaRef.misureDelleCaselle({ bigBoxPerRow: "auto", bigBoxHeight: "auto", marginBetweenBigBox: "auto" }), { perRiga: 2, altezza: 50, spazio: 10 });
    assert.deepStrictEqual(schedaRef.misureDelleCaselle({ bigBoxPerRow: 3, bigBoxHeight: 60, marginBetweenBigBox: 0 }), { perRiga: 3, altezza: 60, spazio: 0 });
    assert.deepStrictEqual(schedaRef.misureDelleCaselle({ bigBoxPerRow: 0, bigBoxHeight: -5 }), { perRiga: 2, altezza: 50, spazio: 10 });
});

test("la colonna di una casella e' larga la sua parte di riga, con lo spazio a destra e sotto", () => {
    assert.strictEqual(schedaRef.stileDellaColonna(pluginEdro.grandezzeBox),
        "position: relative; flex: 0 0 auto; width: 50%; box-sizing: border-box; margin: 0 0 6px 0; padding: 0 10px 0 0;");
    assert.match(schedaRef.stileDellaColonna({ bigBoxPerRow: 3, marginBetweenBigBox: 6 }), /width: 33\.33%;[^"]*padding: 0 6px 0 0;$/);
    assert.match(schedaRef.stileDellaColonna({ bigBoxPerRow: 1 }), /width: 100%;/);
});

test("la colonna e' posizionata: a riposo la casella al 100% resta larga quanto la colonna e la schermata non scorre in orizzontale", () => {
    //TASK-059dd745: CampiARiposo mette la casella a riposo in position absolute (_spegniCampo), e il suo 100% si
    //misura sul primo antenato posizionato. Senza la colonna posizionata era il pannello: in console 524 px invece
    //di 252, la seconda colonna sporgeva di mezzo pannello e la rotella faceva scorrere la schermata in orizzontale.
    const CampiARiposo = require("../../plugin/campiARiposo.js");
    const spento = { style: {}, setAttribute() {} };
    CampiARiposo._spegniCampo(spento);
    assert.strictEqual(spento.style.position, "absolute");

    for (const grandezze of [pluginEdro.grandezzeBox, null, { bigBoxPerRow: 3 }]) {
        assert.match(schedaRef.stileDellaColonna(grandezze), /^position: relative;/);
    }
    //Tutte le colonne delle caselle della descrizione nascono con quello stile, anche quella del tratto nascosto.
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.ok(!/class="column" style="margin-right:/.test(sorgente), "una colonna della descrizione senza stileDellaColonna");
    assert.match(sorgente, /var column = \$\('<div class="column" style="' \+ schedaRef\.stileDellaColonna\(grandezzeBox\) \+ '"><\/div>'\);/);
});

test("gli avvisi sotto le caselle hanno il bordo sinistro del loro colore", () => {
    assert.strictEqual(schedaRef.stileDellAvviso("gold", "#57523a"), "padding: 4px 8px; background-color: #57523a; border-left: 3px solid gold; border-radius: 2px;");
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(sorgente, /class="rigaGialloDescrizione" style="font-size: 11px; color: gold; margin-top: 4px; ' \+ schedaRef\.stileDellAvviso\("gold", "#57523a"\)/);
    //La nota vuota resta un elemento che non si vede: niente riquadro.
    assert.match(sorgente, /var conTesto = voce != null && voce\.nota !== "";\s*var nota = \$\('<div class="notaSolaLettura" style="font-size: 11px; color: #d0d0d0; margin-top: 4px;' \+ \(conTesto \? ' ' \+ schedaRef\.stileDellAvviso\("#8a8a8a", "#555555"\) : ''\)/);
});

test("il perche' della sola lettura: alterata dall'esportazione, regola dell'agenzia o stile non modificabile", () => {
    const alterate = [{ fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" }];
    assert.strictEqual(schedaRef.indicazioneSolaLettura({ fondamentale: "descrizione4", nota: "x" }, false, alterate), "alterato da logiche agenzia");
    assert.strictEqual(schedaRef.indicazioneSolaLettura({ fondamentale: "descrizione4", nota: "Grammatura della confezione" }, false, []), "sola lettura");
    //Uno stile non modificabile per l'agenzia (DES_descr_es).
    assert.strictEqual(schedaRef.indicazioneSolaLettura(null, false, alterate), "sola lettura");
    assert.strictEqual(schedaRef.indicazioneSolaLettura(null, true, alterate), null);
});

test("la casella disattivata prende sfondo, testo e bordo propri, e tiene il bordo giallo di una differenza", () => {
    const casella = function () {
        const stili = {};
        return { stili: stili, css: (k, v) => { stili[k] = v; } };
    };
    const disattivata = casella();
    assert.strictEqual(schedaRef.segnaCasellaDisattivata(disattivata), true);
    assert.deepStrictEqual(disattivata.stili, { "background-color": "#d9d9d9", color: "#4a4a4a", border: "1px dashed #7a7a7a" });

    const gialla = casella();
    schedaRef.segnaCasellaDisattivata(gialla, true);
    assert.strictEqual(gialla.stili.border, undefined);
    assert.strictEqual(schedaRef.segnaCasellaDisattivata(null), false);
});

test("le tre caselle della schermata usano l'etichetta nuova e si segnano disattivate quando sono in sola lettura", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async attivaSchermateReferenza(");
    const schermata = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    for (const nome of ["nome_schema", "elSchema\\[1\\]"]) {
        assert.match(schermata, new RegExp("label = me\\.etichettaDellaCasella\\(" + nome + ", null, me\\.indicazioneSolaLettura\\(notaSolaLettura, isEditable, descrizioniAlterate\\)\\);\\s*column\\.append\\(label\\)\\.append\\(textarea\\);\\s*me\\.segnaCasellaInSolaLettura\\(textarea, notaSolaLettura\\);\\s*if \\(!\\(isEditable && refEditabile\\)\\) \\{\\s*me\\.segnaCasellaDisattivata\\(textarea\\);"));
    }
    assert.match(schermata, /label = me\.etichettaDellaCasella\(currentCharacterStyle, stileInMismatch \? 'gold' : null, me\.indicazioneSolaLettura\(notaSolaLettura, isEditable, descrizioniAlterate\)\);/);
    assert.match(schermata, /me\.segnaCasellaDisattivata\(textarea, stileInMismatch\);/);
});

test("le caselle della schermata seguono il pannello: colonne in parti di riga, caselle al 100%, misure in un posto solo", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async attivaSchermateReferenza(");
    const schermata = sorgente.substring(inizio, sorgente.indexOf("\n    },\n", inizio));

    assert.match(schermata, /var misureCaselle = me\.misureDelleCaselle\(grandezzeBox\);/);
    assert.strictEqual((schermata.match(/\$\('<div class="column" style="' \+ me\.stileDellaColonna\(grandezzeBox\) \+ '"><\/div>'\)/g) || []).length, 3);
    assert.strictEqual((schermata.match(/style="height: ' \+ misureCaselle\.altezza \+ 'px; width: 100%; margin: 0; background-color:white; color:black;/g) || []).length, 3);
    assert.strictEqual((schermata.match(/row\.children\(\)\.length == misureCaselle\.perRiga/g) || []).length, 6);
    //Nessuna larghezza in pixel e nessuna misura ricalcolata a mano.
    assert.ok(!/bigBoxWidth|bigBoxPerRow|marginBetweenBigBox|bigBoxHeight/.test(schermata), "le misure si leggono solo da misureDelleCaselle");
});

test("la sezione Azioni sul box si separa dalla descrizione e i riquadri delle azioni hanno il bordo sottile", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(sorgente, /let divCampiOfferta = \$\('<div id="edit_campi_offerta" style="margin-top: 14px; padding-top: 2px; border-top: 1px solid #5f5f5f;"><\/div>'\);/);
    assert.match(sorgente, /let template_panelAzione = '<div id="az_\$id" class="panel" style="width: 90%;margin: 0px auto;border: 1px solid #6e6e6e;border-radius: 6px;/);
    assert.ok(!/#d6d0d0/.test(sorgente));
});

test("sotto i campi la nota di una descrizione alterata solo se non ha una casella; quelle dell'agenzia sempre", () => {
    const alterata = { fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" };
    const agenzia = { fondamentale: "descrizione3", nota: "Grammatura della confezione 32711vv2: si revisiona sulla singola referenza dal revisore" };
    const note = [alterata, agenzia];

    //6714445: la descrizione4 ha la sua casella, con "alterato da logiche agenzia" accanto al nome.
    assert.deepStrictEqual(schedaRef.noteSottoICampi(note, [alterata], ["descrizione4", "descrizione3"]), [agenzia]);
    //Tolta del tutto dall'esportazione, senza casella: la nota sotto i campi e' l'unico segno.
    assert.deepStrictEqual(schedaRef.noteSottoICampi(note, [alterata], ["descrizione3"]), [alterata, agenzia]);
    //La nota dell'agenzia resta anche con la casella.
    assert.deepStrictEqual(schedaRef.noteSottoICampi([agenzia], [], ["descrizione3"]), [agenzia]);
    assert.deepStrictEqual(schedaRef.noteSottoICampi(null, null, null), []);
});

test("si ricordano le descrizioni in sola lettura che hanno una casella, non quelle segnate senza", () => {
    const scheda = {};
    const textarea = { css() { return this; } };
    const voce = { fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" };
    schedaRef.segnaCasellaInSolaLettura.call(scheda, null, voce);
    assert.strictEqual(scheda.fondamentaliConCasellaInSolaLettura, undefined);
    schedaRef.segnaCasellaInSolaLettura.call(scheda, textarea, voce);
    schedaRef.segnaCasellaInSolaLettura.call(scheda, textarea, voce);
    assert.deepStrictEqual(scheda.fondamentaliConCasellaInSolaLettura, ["descrizione4"]);
    assert.strictEqual(scheda.noteSolaLetturaDaMostrare.length, 1);
});

test("la schermata azzera le caselle ricordate a ogni apertura e passa le alterate alla riga delle note", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(sorgente, /me\.noteSolaLetturaDaMostrare = \[\];\s*me\.fondamentaliConCasellaInSolaLettura = \[\];/);
    assert.match(sorgente, /me\.mostraNoteSolaLettura\(descrizioniAlterate\);/);
    assert.match(sorgente, /var note = schedaRef\.noteSottoICampi\(this\.noteSolaLetturaDaMostrare, alterate, this\.fondamentaliConCasellaInSolaLettura\);/);
});
