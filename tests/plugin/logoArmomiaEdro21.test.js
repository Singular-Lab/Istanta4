/*
 * I20-1209: il logo CONAD della linea Armomia di Edro21 (conad_ArmoMia.psd, sigla conad_armomia),
 * nella parte che decide il framework CSS (Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json).
 *
 * Nel volantino il logo e' un *conad* come gli altri loghi CONAD di linea: Loghi_DX lo mette al primo
 * livello, in alto a destra a 1 mm dal bordo alto e da quello destro, con la sua misura. Nel PoP la
 * posizione e' quella dei loghi CONAD del PoP, ma la misura deve restare 21,421 x 5,334 mm: la regola
 * generica logoConad porterebbe ogni conad_* a 26,186 x 14,5, deformandolo.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RADICE = path.join(__dirname, "..", "..");
const regole = JSON.parse(fs.readFileSync(
    path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json"), "utf8").replace(/^﻿/, ""));
const kit = regole.dbRidimensionamentiAllineamenti.modificheCssPerKit;
const LOGO = "foto_extra$conad_armomia$tipo_3";

//makeRegexFromGroupName di CssFramework: l'asterisco vale qualunque cosa, il resto e' letterale.
function regex(gruppo) {
    const pulito = gruppo.replace(/\[itemLink\]|\[exist\]/gi, "");
    return new RegExp("^" + pulito.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

function voceDiDefault(k) {
    const voce = k.operazioniPerBox.find(op => Array.isArray(op.nomiBox) && op.nomiBox.length === 0);
    assert.ok(voce, "la voce di default (nomiBox vuoto) c'e'");
    return voce;
}

test("I20-1209: nel volantino Loghi_DX mette Armomia al primo livello, in alto a destra a 1 mm", () => {
    const kitVolantino = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));
    assert.strictEqual(kitVolantino.length, 2);

    for (const k of kitVolantino) {
        const loghi = voceDiDefault(k).allineamenti.find(a => a.nomeGruppo === "Loghi_DX");
        assert.ok(loghi.gruppoEtichette.some(e => regex(e).test(LOGO)));
        const livello = loghi.ordinamentoLivelli.find(l => l.elementi.some(e => regex(e).test(LOGO)));
        assert.strictEqual(livello.livello, 1, "la posizione del logo CONAD ha la priorita'");

        const ancora = loghi.staticAnchor[0];
        assert.deepStrictEqual([ancora.xAnchor.distance, ancora.xAnchor.allineaAlLato, ancora.xAnchor.allineaLato], ["1", 1, 1], "a destra, a 1 mm");
        assert.deepStrictEqual([ancora.yAnchor.distance, ancora.yAnchor.allineaAlLato, ancora.yAnchor.allineaLato], ["1", 0, 0], "in alto, a 1 mm");
    }
});

test("I20-1209: nel PoP Armomia esce 21,421 x 5,334 mm, dopo la regola generica dei loghi CONAD", () => {
    const kitPop = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(2));
    assert.strictEqual(kitPop.length, 1);

    const post = voceDiDefault(kitPop[0]).postRidimensionamenti;
    const delLogo = post.filter(p => p.gruppoEtichette.some(e => regex(e).test(LOGO)));
    assert.deepStrictEqual(delLogo.map(p => p.nomeGruppo), ["logoConad", "logoArmomia"],
        "la regola di Armomia viene dopo quella generica, che altrimenti lo deformerebbe");

    const armomia = delLogo[1];
    assert.strictEqual(armomia.ridimensionamenti.length, 1);
    assert.strictEqual(armomia.ridimensionamenti[0].setWidth, "21.421");
    assert.strictEqual(armomia.ridimensionamenti[0].setHeight, "5.334");
    assert.deepStrictEqual(armomia.ridimensionamenti[0].listSetCondizioni, []);
    //Gli altri loghi CONAD non la prendono.
    assert.ok(!armomia.gruppoEtichette.some(e => regex(e).test("foto_extra$conad_piacersi$tipo_3")));
    assert.ok(!armomia.gruppoEtichette.some(e => regex(e).test("foto_extra$conad_logo$tipo_3")));
});
