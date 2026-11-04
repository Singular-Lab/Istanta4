/*
 * I20-1195: la disposizione del box "sconto linea" di Edro21 (meccanica % MM ALL o % FID ALL, senza
 * prezzo offerta ne' prezzo barrato), nella parte che decide il framework CSS
 * (Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json).
 *
 * Campi_DX impila a destra, dal basso, sconto, SOLO TITOLARI e in cima la descrizione: senza prezzi
 * la colonna si accorcia e la descrizione restava in alto a destra. Per lo sconto linea due gruppi in
 * piu', dopo Campi_DX: la colonna senza la descrizione, e la descrizione in basso a sinistra della
 * colonna, come descr_All di BOX41. Campi_DX resta com'era per tutti gli altri box.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RADICE = path.join(__dirname, "..", "..");
const sovrastrutture = require("../../plugin/cssFramework/sovrastrutture.js");

const regole = JSON.parse(fs.readFileSync(
    path.join(RADICE, "Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json"), "utf8"));
const kit = regole.dbRidimensionamentiAllineamenti.modificheCssPerKit;
const kitVolantino = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));

function allineamentiDiDefault(k) {
    const voce = k.operazioniPerBox.find(op => Array.isArray(op.nomiBox) && op.nomiBox.length === 0);
    assert.ok(voce, "la voce di default (nomiBox vuoto) c'e'");
    return voce.allineamenti;
}

//makeRegexFromGroupName di CssFramework: l'asterisco vale qualunque cosa, il resto e' letterale.
function regex(gruppo) {
    const pulito = gruppo.replace(/\[itemLink\]|\[exist\]/gi, "");
    return new RegExp("^" + pulito.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

//checkAllConditions di CssFramework, per le condizioni che usano queste regole: elementi da non
//trovare, box e ref. Basta un set vero; dentro un set tutte le condizioni.
function condizioniVere(listSetCondizioni, elementi, box, ref) {
    return listSetCondizioni.some(set => set.setCondizioni.every(c => {
        if ((c.elementiDaTrovare || []).some(e => !elementi.some(el => regex(e).test(el)))) return false;
        if ((c.elementiDaNonTrovare || []).some(e => elementi.some(el => regex(e).test(el)))) return false;
        if ((c.boxCondition || []).length > 0 && !c.boxCondition.some(b =>
            (!(b.boxValidi || []).length || b.boxValidi.includes(box)) &&
            !(b.boxInvalidi || []).includes(box))) return false;
        return sovrastrutture.refConditionVera(ref, c.refCondition);
    }));
}

const SCONTO_LINEA = ["descrizione", "gruppo_sconto", "LBL_Titolari", "sconto_effettivo_grande"];
const CON_PREZZI = SCONTO_LINEA.concat(["prezzo_offerta_gruppo", "campo_offerta"]);

test("nei due kit volantino Campi_DX resta com'era, con la descrizione in cima e senza condizioni", () => {
    assert.strictEqual(kitVolantino.length, 2);
    for (const k of kitVolantino) {
        const campi = allineamentiDiDefault(k).filter(a => a.nomeGruppo === "Campi_DX");
        assert.strictEqual(campi.length, 1);
        assert.ok(campi[0].gruppoEtichette.includes("descrizione"));
        const livelli = campi[0].ordinamentoLivelli;
        assert.deepStrictEqual(livelli[livelli.length - 1].elementi, ["descrizione"]);
        assert.ok(!campi[0].listSetCondizioni || campi[0].listSetCondizioni.length === 0);
    }
});

test("subito dopo Campi_DX la colonna dello sconto linea, senza descrizione, e poi la descrizione", () => {
    for (const k of kitVolantino) {
        const nomi = allineamentiDiDefault(k).map(a => a.nomeGruppo);
        const i = nomi.indexOf("Campi_DX");
        assert.deepStrictEqual(nomi.slice(i, i + 3), ["Campi_DX", "Campi_DX_sconto_linea", "descr_sconto_linea"]);

        const al = allineamentiDiDefault(k);
        const campi = al[i], colonna = al[i + 1], descr = al[i + 2];
        assert.ok(!colonna.gruppoEtichette.includes("descrizione"));
        assert.ok(!colonna.ordinamentoLivelli.some(l => l.elementi.includes("descrizione")));
        //la stessa colonna di Campi_DX, meno la descrizione: stesse ancore, stessa lettura
        assert.deepStrictEqual(colonna.ordinamentoLivelli,
            campi.ordinamentoLivelli.filter(l => !l.elementi.includes("descrizione")));
        assert.deepStrictEqual(colonna.staticAnchor, campi.staticAnchor);
        assert.strictEqual(colonna.letturaLivelli, campi.letturaLivelli);
        //tutte con lo stesso ordine: il motore le tiene nell'ordine scritto
        assert.strictEqual(colonna.ordine, campi.ordine);
        assert.strictEqual(descr.ordine, campi.ordine);

        assert.deepStrictEqual(descr.gruppoEtichette, ["descrizione"]);
    }
});

test("la descrizione va in basso, col lato destro sul lato sinistro della colonna, come in BOX41", () => {
    for (const k of kitVolantino) {
        const descr = allineamentiDiDefault(k).find(a => a.nomeGruppo === "descr_sconto_linea");
        assert.strictEqual(descr.staticAnchor.length, 1);
        assert.strictEqual(descr.staticAnchor[0].xAnchor, null);
        assert.deepStrictEqual(descr.staticAnchor[0].yAnchor,
            { distance: "0%", applyToSingleLevels: false, allineaAlLato: 1, allineaLato: 1 });

        assert.strictEqual(descr.followAnchor.length, 1);
        const segue = descr.followAnchor[0];
        assert.deepStrictEqual(segue.nomiGruppiSeguiti, ["Campi_DX_sconto_linea"]);
        assert.strictEqual(segue.xAnchor.allineaAlLato, 0);
        assert.strictEqual(segue.xAnchor.allineaLato, 1);
        assert.strictEqual(segue.yAnchor, null);

        //lo schema da cui viene: descr_All di BOX41, quello agganciato a Campi_DX
        const box41 = k.operazioniPerBox.find(op => (op.nomiBox || []).includes("BOX41"));
        const modello = box41.allineamenti.find(a => a.nomeGruppo === "descr_All" &&
            (a.followAnchor || []).some(f => f.nomiGruppiSeguiti.includes("Campi_DX")));
        assert.deepStrictEqual(descr.staticAnchor, modello.staticAnchor);
        assert.deepStrictEqual({ ...segue, nomiGruppiSeguiti: [] }, { ...modello.followAnchor[0], nomiGruppiSeguiti: [] });
    }
});

test("le due regole valgono solo per lo sconto linea: meccanica ALL, niente prezzi, BOX1", () => {
    for (const k of kitVolantino) {
        for (const nome of ["Campi_DX_sconto_linea", "descr_sconto_linea"]) {
            const condizioni = allineamentiDiDefault(k).find(a => a.nomeGruppo === nome).listSetCondizioni;
            const vale = (elementi, box, meccanica) =>
                condizioniVere(condizioni, elementi, box, { meccanica_tradotta: meccanica });

            //il caso della issue, e la cura persona che esce sconto linea da sola
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", "PERCENTO_FID_ALL"), true, nome);
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", "PERCENTO_MM_ALL"), true, nome);
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", "PERCENTO_MM_ALL_KgL"), true, nome);
            //con i prezzi, anche uno solo: il box di sempre
            assert.strictEqual(vale(CON_PREZZI, "BOX1", "PERCENTO_FID_ALL"), false, nome);
            assert.strictEqual(vale(SCONTO_LINEA.concat(["campo_offerta"]), "BOX1", "PERCENTO_FID_ALL"), false, nome);
            assert.strictEqual(vale(SCONTO_LINEA.concat(["prezzo_offerta_gruppo"]), "BOX1", "PERCENTO_MM_ALL"), false, nome);
            //senza prezzi ma non ALL: lo sconto in percentuale di % MM e % FID resta com'e'
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", "PERCENTO_MM"), false, nome);
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", "PERCENTO_FID"), false, nome);
            assert.strictEqual(vale(SCONTO_LINEA, "BOX1", ""), false, nome);
            //i box con una disposizione propria non si toccano
            assert.strictEqual(vale(SCONTO_LINEA, "BOX12", "PERCENTO_MM_ALL"), false, nome);
            assert.strictEqual(vale(SCONTO_LINEA, "BOX6", "PERCENTO_FID_ALL"), false, nome);
        }
    }
});

/* ---- la foto: la sovrastruttura "Sconto linea" ---- */

const sceltaSpazio = require("../../plugin/sistemazioneFoto/sceltaSpazio.js");

function sovrastrutturaScontoLinea(k) {
    const trovate = (k.sovrastrutture || []).filter(s => s.nome === "Sconto linea");
    assert.strictEqual(trovate.length, 1, "una sola sovrastruttura Sconto linea per kit");
    return trovate[0];
}

//Gli spazi liberi misurati sul box del guanciale (traccia di fixFoto, 04/11/2026): base 65x65 mm,
//il logo CONAD in alto a destra, la descrizione in basso a sinistra, la colonna dello sconto a destra.
const BASE = { larghezza: 65.25, altezza: 65 };
const SPAZI = [
    { x: 0, y: 5.49, width: 65.25, height: 22, direction: "sotto" },           //in alto, tutta larghezza
    { x: 39.83, y: 5.49, width: 25.42, height: 37.49, direction: "sotto" },    //a destra, stretto e alto
    { x: 0, y: 0, width: 42.87, height: 27.5, direction: "sinistra" }          //in alto a sinistra
];
const NOFOTO = [0, 0, 32.65, 32.65];
const FOTO_LARGA = [0, 0, 20, 40];

function scelto(gruppo, preferenza) {
    const esito = sceltaSpazio.scegli(SPAZI, gruppo, preferenza, BASE.larghezza, BASE.altezza);
    assert.ok(esito, "uno spazio si trova");
    return SPAZI.indexOf(esito.candidato.derivatoDa || esito.candidato);
}

test("la sovrastruttura Sconto linea c'e' nei due kit volantino, con le condizioni delle regole della descrizione", () => {
    for (const k of kitVolantino) {
        const s = sovrastrutturaScontoLinea(k);
        const descr = allineamentiDiDefault(k).find(a => a.nomeGruppo === "descr_sconto_linea");
        assert.deepStrictEqual(s.listSetCondizioni, descr.listSetCondizioni);
        //cambia solo la scelta dello spazio delle foto
        assert.deepStrictEqual(s.operazioni.sceltaSpazioFoto, { modo: "centrato", tolleranzaArea: 0.7, asseCentratura: "x" });
        for (const chiave of ["ridimensionamenti", "postRidimensionamenti", "allineamenti", "segnalazioniConflitti",
            "duplicazioni", "ordiniZ", "disattiva"]) {
            assert.deepStrictEqual(s.operazioni[chiave], [], chiave);
        }
        assert.strictEqual(s.operazioni.estensioniFoto, null);
    }
    const pop = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(2));
    pop.forEach(k => assert.ok(!(k.sovrastrutture || []).some(s => s.nome === "Sconto linea")));
});

test("con la regola di sempre il nofoto finiva nello spazio stretto a destra, per 0,3 mm di centratura", () => {
    const diSempre = kitVolantino[0].operazioniPerBox.find(op => op.nomiBox.length === 0).sceltaSpazioFoto;
    assert.deepStrictEqual(diSempre, { modo: "centrato", tolleranzaArea: 0.7, asseCentratura: "xy" });
    assert.strictEqual(scelto(NOFOTO, diSempre), 1);
});

test("con la sovrastruttura il nofoto va in alto a sinistra, e la foto larga in alto a tutta larghezza", () => {
    for (const k of kitVolantino) {
        const preferenza = sovrastrutturaScontoLinea(k).operazioni.sceltaSpazioFoto;
        assert.strictEqual(scelto(NOFOTO, preferenza), 2, "il nofoto, quadrato: lo spazio dove viene piu' grande");
        assert.strictEqual(scelto(FOTO_LARGA, preferenza), 0, "il guanciale, largo: in alto, centrato");
    }
});

test("il PoP non cambia", () => {
    const pop = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(2));
    assert.ok(pop.length > 0);
    for (const k of pop) {
        for (const op of k.operazioniPerBox) {
            assert.ok(!op.allineamenti.some(a => /_sconto_linea$/.test(a.nomeGruppo)));
        }
    }
});
