/*
 * I20-1130: "Seleziona tutte le foto" prende anche gli elementi connessi alle foto.
 *
 * Edro21 ha chiesto che con le foto del BOX41 venga selezionata anche l'ombra sy_ombra. La
 * decisione sta in plugin/sistemazioneFoto/selezioneFoto.js, pura: le foto sono le etichette che
 * cominciano con il nome di agenzia della primaria e della secondaria, gli elementi connessi
 * quelli che l'agenzia dichiara in elementiConnessiAlleFoto del SourceCustomPlugin, con
 * l'asterisco come jolly. Sotto Node si verifica la decisione; indexNew.js, sistemazioneFoto.js e
 * pluginMiddleware.js non si caricano, e di loro si legge il sorgente.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const selezioneFoto = require("../../plugin/sistemazioneFoto/selezioneFoto.js");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

//Un BOX41 di Edro21: due foto, le loro ombre, le parentesi e il resto.
const foto = { label: "immagine$3150596" };
const fotoSecondaria = { label: "foto_secondaria$3150599" };
const ombraPrimaria = { label: "sy_ombra$3150596" };
const ombraSecondaria = { label: "sy_ombra$3150599" };
const parentesi = { label: "parentesi_BeF" };
const descrizione = { label: "descrizione$3150596" };
const senzaLabel = { label: "" };
const box41 = [parentesi, descrizione, foto, ombraPrimaria, senzaLabel, fotoSecondaria, ombraSecondaria];

const edro21 = { nomeFotoPrimaria: "immagine", nomeFotoSecondaria: "foto_secondaria", elementiConnessi: ["sy_ombra*"] };

/* ---- la decisione ---- */

test("nel BOX41 di Edro21 si selezionano le due foto e le due ombre, nient'altro", () => {
    const scelta = selezioneFoto.daSelezionare(box41, edro21);

    assert.deepStrictEqual(scelta.foto, [foto, fotoSecondaria]);
    assert.deepStrictEqual(scelta.connessi, [ombraPrimaria, ombraSecondaria]);
});

test("un'agenzia senza elementi connessi ottiene le sole foto, come prima", () => {
    for (const elementiConnessi of [[], null, undefined]) {
        const scelta = selezioneFoto.daSelezionare(box41, { elementiConnessi });

        assert.deepStrictEqual(scelta.foto, [foto, fotoSecondaria]);
        assert.deepStrictEqual(scelta.connessi, []);
    }
});

test("senza foto nel box non si propone niente, nemmeno le ombre da sole", () => {
    const scelta = selezioneFoto.daSelezionare([parentesi, ombraPrimaria, descrizione], edro21);

    assert.deepStrictEqual(scelta.foto, []);
    //I connessi vengono comunque riconosciuti: e' chi chiama a non selezionarli senza foto.
    assert.deepStrictEqual(scelta.connessi, [ombraPrimaria]);
});

test("i nomi delle foto vengono dall'agenzia, e senza valgono immagine e foto_secondaria", () => {
    const fotoAgenzia = { label: "fotoPrincipale$1" };
    const secondariaAgenzia = { label: "fotoBis$1" };

    const conNomi = selezioneFoto.daSelezionare([foto, fotoAgenzia, secondariaAgenzia], { nomeFotoPrimaria: "fotoPrincipale", nomeFotoSecondaria: "fotoBis" });
    assert.deepStrictEqual(conNomi.foto, [fotoAgenzia, secondariaAgenzia]);

    const senzaNomi = selezioneFoto.daSelezionare([foto, fotoAgenzia, fotoSecondaria], { nomeFotoPrimaria: null, nomeFotoSecondaria: "" });
    assert.deepStrictEqual(senzaNomi.foto, [foto, fotoSecondaria]);
});

test("l'asterisco e' un jolly e un nome senza asterisco vale per la parte prima del $", () => {
    assert.ok(selezioneFoto.eConnessa("sy_ombra$3150596", ["sy_ombra*"]));
    assert.ok(selezioneFoto.eConnessa("sy_ombra$3150596", ["sy_ombra"]), "come ignoreElementsFixFoto");
    assert.ok(selezioneFoto.eConnessa("parentesi_BeF", ["*_BeF"]));
    assert.ok(!selezioneFoto.eConnessa("sy_ombra_grande$1", ["sy_ombra"]));
    assert.ok(!selezioneFoto.eConnessa("descrizione$1", ["sy_ombra*"]));
    //I caratteri speciali del nome non sono espressioni regolari.
    assert.ok(!selezioneFoto.eConnessa("sy_ombra", ["sy.ombra"]));
});

test("una foto non finisce anche fra i connessi, e una lista malformata non seleziona niente", () => {
    const scelta = selezioneFoto.daSelezionare(box41, { elementiConnessi: ["immagine*", "sy_ombra*"] });
    assert.deepStrictEqual(scelta.foto, [foto, fotoSecondaria]);
    assert.deepStrictEqual(scelta.connessi, [ombraPrimaria, ombraSecondaria]);

    for (const elementiConnessi of ["sy_ombra*", [null, 3, ""], {}]) {
        assert.deepStrictEqual(selezioneFoto.daSelezionare(box41, { elementiConnessi }).connessi, []);
    }
    assert.deepStrictEqual(selezioneFoto.daSelezionare(null, edro21), { foto: [], connessi: [] });
    assert.deepStrictEqual(selezioneFoto.daSelezionare(box41, null).foto, [foto, fotoSecondaria]);
});

/* ---- chi la usa ---- */

test("il pulsante del pannello passa da sistemazioneFoto, che risale al box e seleziona foto e connessi", () => {
    const indexNew = leggiFileDelPlugin("indexNew.js").replace(/\r/g, "");
    assert.match(indexNew, /buttonText: "Seleziona tutte le foto",[\s\S]{0,400}?buttonCallback: function \(\) \{\s*SistemazioneFoto\.selezionaTutteLeFoto\(args\[0\]\);\s*\}/);
    assert.ok(!/allImageBoxes/.test(indexNew), "la selezione inline di indexNew deve essere sparita");

    const sistemazione = leggiFileDelPlugin("sistemazioneFoto/sistemazioneFoto.js").replace(/\r/g, "");
    assert.match(sistemazione, /const selezioneFoto = require\('\.\/selezioneFoto'\);/);
    assert.match(sistemazione, /selezionaTutteLeFoto\(elemento\) \{[\s\S]*?var scelta = selezioneFoto\.daSelezionare\(box\.allPageItems, \{\s*nomeFotoPrimaria: pluginMiddleware\.getCampo\("nomeFotoPrimaria"\),\s*nomeFotoSecondaria: pluginMiddleware\.getCampo\("nomeFotoSecondaria"\),\s*elementiConnessi: pluginMiddleware\.getElementiConnessiAlleFoto\(\)\s*\}\);/);
    assert.match(sistemazione, /if \(scelta\.foto\.length === 0\) \{\s*console\.error\("Non sono riuscito a trovare immagini nel box"\);\s*return false;\s*\}\s*app\.selection = scelta\.foto\.concat\(scelta\.connessi\);/);
});

test("il getter del middleware legge elementiConnessiAlleFoto dalla configurazione del cliente e normalizza a lista di nomi", () => {
    const middleware = leggiFileDelPlugin("pluginMiddleware.js").replace(/\r/g, "");
    const corpo = middleware.match(/getElementiConnessiAlleFoto\(\) \{[\s\S]*?\n    \}/);
    assert.ok(corpo, "getElementiConnessiAlleFoto non trovata in pluginMiddleware.js");
    assert.match(corpo[0], /customAgenzia\.elementiConnessiAlleFoto/);
    assert.match(corpo[0], /me\.customPluginDB\?\.elementiConnessiAlleFoto/);

    //Il corpo eseguito con il middleware finto: il valore del server, con i nomi vuoti tolti.
    const getter = new Function("me", corpo[0].replace(/^getElementiConnessiAlleFoto\(\) \{\s*let me = this;/, "") .replace(/\n    \}$/, ""));
    assert.deepStrictEqual(getter({ callCustom: false, customPluginDB: { elementiConnessiAlleFoto: [" sy_ombra* ", "", 4, "parentesi_BeF"] } }), ["sy_ombra*", "parentesi_BeF"]);
    assert.deepStrictEqual(getter({ callCustom: false, customPluginDB: { elementiConnessiAlleFoto: "sy_ombra*" } }), []);
    assert.deepStrictEqual(getter({ callCustom: false, customPluginDB: {} }), []);
});

test("il SourceCustomPlugin di Edro21 dichiara le ombre connesse alle foto", () => {
    const percorso = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Edro21", "SourceCustomPlugin.json");
    const sorgente = JSON.parse(fs.readFileSync(percorso, "utf8"));

    assert.deepStrictEqual(sorgente.elementiConnessiAlleFoto, ["sy_ombra*"]);
    const scelta = selezioneFoto.daSelezionare(box41, {
        nomeFotoPrimaria: sorgente.nomeFotoPrimaria,
        nomeFotoSecondaria: sorgente.nomeFotoSecondaria,
        elementiConnessi: sorgente.elementiConnessiAlleFoto
    });
    assert.deepStrictEqual(scelta.foto.concat(scelta.connessi).map(e => e.label), ["immagine$3150596", "foto_secondaria$3150599", "sy_ombra$3150596", "sy_ombra$3150599"]);
});
