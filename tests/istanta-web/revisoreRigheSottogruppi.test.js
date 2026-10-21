/*
 * I20-1120: la vista Sottogruppi del revisore mostra tutti i sottogruppi dei record caricati.
 *
 * La riga del revisore e' una per referenza e gruppo e porta il sottogruppo di un solo record. Ma
 * la stessa referenza, nello stesso gruppo, puo' stare in sottogruppi diversi a seconda del
 * tracciato e dell'etichetta (voluto): sulla promo 3059 l'articolo 6745551 ne ha 5 e la vista ne
 * mostrava uno, e i sottogruppi da revisionare contati dalla pagina Tracciati non comparivano.
 * Il server ora manda con ogni riga altriSottogruppi; la vista ne fa una copia per sottogruppo.
 *
 * revisore.js e statoRevisione.js si caricano sotto Node; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");
const statoRevisione = require("../../Istanta/wwwroot/js/statoRevisione.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

const GRUPPO = "6745481,6745532,6745547,6745551";

function riga(ref, sottogruppo, altri = null, idRec = 100) {
    return {
        idRec: idRec,
        isGruppo: false,
        label: "PROMO",
        recordInTracciato: {
            "Referenza.Codice": ref,
            "Scatto.CodiceGruppo": GRUPPO,
            "Scatto.CodiceSottogruppo": sottogruppo,
            "Tracciato.Firma": "F-" + ref,
            idRec: idRec,
            label: "PROMO"
        },
        recordRevisionato: { firmaTracciato: "F-" + ref, custom: null },
        recordRevisionatiRegionali: [],
        altriSottogruppi: altri
    };
}

test("una riga con due altri sottogruppi da' tre righe, e la riga non cambia", () => {
    const originale = riga("6745551", "6745547,6745551", [
        { codiceSottogruppo: "6745532,6745551", idRec: 201, idTracciato: 4, label: "RICORRENZE" },
        { codiceSottogruppo: "6745481,6745551", idRec: 202, idTracciato: 7, label: "NOVELLO" }
    ]);
    const prima = JSON.stringify(originale);

    const righe = Revisore.righeDeiSottogruppi([originale]);

    assert.strictEqual(righe.length, 3);
    assert.strictEqual(righe[0], originale);
    assert.deepStrictEqual(righe.map(r => r.recordInTracciato["Scatto.CodiceSottogruppo"]),
        ["6745547,6745551", "6745532,6745551", "6745481,6745551"]);
    //La copia porta il record vero del suo sottogruppo: le azioni lavorano su quello.
    assert.strictEqual(righe[1].idRec, 201);
    assert.strictEqual(righe[1].recordInTracciato.idTracciato, 4);
    assert.strictEqual(righe[1].label, "RICORRENZE");
    assert.strictEqual(righe[1].copiaSottogruppo, true);
    assert.strictEqual(righe[1].altriSottogruppi, null);
    //La riga di partenza resta com'era.
    assert.strictEqual(JSON.stringify(originale), prima);
});

test("le copie hanno la stessa revisione e lo stesso stato della riga", () => {
    const originale = riga("6745551", "6745547,6745551", [
        { codiceSottogruppo: "6745532,6745551", idRec: 201, idTracciato: 4, label: "PROMO" }
    ]);
    const [prima, copia] = Revisore.righeDeiSottogruppi([originale]);

    assert.strictEqual(copia.recordRevisionato, prima.recordRevisionato);
    assert.strictEqual(copia.recordRevisionatiRegionali, prima.recordRevisionatiRegionali);
    assert.strictEqual(statoRevisione.eRevisionato(copia), statoRevisione.eRevisionato(prima));
});

test("una riga senza sottogruppo proprio porta solo le copie; le righe di gruppo restano fuori", () => {
    const senza = riga("6745551", null, [{ codiceSottogruppo: "6745532,6745551", idRec: 201, idTracciato: 4, label: "PROMO" }]);
    const gruppo = { isGruppo: true, recordInTracciato: { "Scatto.CodiceSottogruppo": GRUPPO }, altriSottogruppi: null };

    const righe = Revisore.righeDeiSottogruppi([senza, gruppo]);

    assert.strictEqual(righe.length, 1);
    assert.strictEqual(righe[0].recordInTracciato["Scatto.CodiceSottogruppo"], "6745532,6745551");
});

test("ogni sottogruppo della risposta ha la sua intestazione con tutti i membri, anche quelli solo nelle copie", () => {
    //6745532 porta di suo "6745532,6745551"; 6745551 lo porta solo in un altro record (copia).
    const lista = [
        riga("6745532", "6745532,6745551", null, 300),
        riga("6745551", "6745547,6745551", [{ codiceSottogruppo: "6745532,6745551", idRec: 201, idTracciato: 4, label: "PROMO" }], 100),
        riga("6745547", "6745547,6745551", null, 400)
    ];
    const righe = Revisore.righeDeiSottogruppi(lista);
    const risposta = [
        { codiceSottogruppo: "6745532,6745551", descrizioni: [], firmaTracciatoSottogruppo: "X" },
        { codiceSottogruppo: "6745547,6745551", descrizioni: [], firmaTracciatoSottogruppo: "Y" }
    ];

    const costruita = Revisore.costruisciListaSottogruppi(righe, risposta);

    const membri = (sg) => {
        const inizio = costruita.findIndex(i => i.isGruppo && i.recordInTracciato["Scatto.CodiceSottogruppo"] === sg);
        const fine = costruita.findIndex((i, n) => n > inizio && i.isGruppo);
        return costruita.slice(inizio + 1, fine < 0 ? undefined : fine).map(i => i.recordInTracciato["Referenza.Codice"]);
    };
    assert.deepStrictEqual(membri("6745532,6745551").sort(), ["6745532", "6745551"]);
    assert.deepStrictEqual(membri("6745547,6745551").sort(), ["6745547", "6745551"]);
    const intestazione = costruita.find(i => i.isGruppo && i.recordInTracciato["Scatto.CodiceSottogruppo"] === "6745532,6745551");
    assert.strictEqual(intestazione.recordInTracciato["Tracciato.Firma"], "X");
    assert.strictEqual(intestazione.recordInTracciato.gruppoOriginaleAppartenenza, GRUPPO);
});

test("un membro compare una volta sola anche se due righe lo portano nello stesso sottogruppo", () => {
    const righe = [riga("6745551", "6745547,6745551", null, 100), riga("6745551", "6745547,6745551", null, 101)];
    const costruita = Revisore.costruisciListaSottogruppi(righe, [{ codiceSottogruppo: "6745547,6745551", descrizioni: [] }]);

    assert.strictEqual(costruita.filter(i => !i.isGruppo).length, 1);
});

test("un sottogruppo della risposta senza righe non rompe la costruzione", () => {
    const costruita = Revisore.costruisciListaSottogruppi([], [{ codiceSottogruppo: "1,2", descrizioni: [] }]);

    assert.strictEqual(costruita.length, 1);
    assert.strictEqual(costruita[0].isGruppo, true);
});

test("fra le revisioni nazionali del sottogruppo vince la Custom, come nel conteggio", () => {
    const standard = { area: null, canale: null, custom: null, firmaTracciato: "S" };
    const custom = { area: null, canale: null, custom: "x", firmaTracciato: "C" };
    const regionale = { area: "TO", canale: "SC", custom: null };

    assert.strictEqual(Revisore.descrizioneNazionaleSottogruppo([standard, regionale, custom]), custom);
    assert.strictEqual(Revisore.descrizioneNazionaleSottogruppo([regionale, standard]), standard);
    assert.strictEqual(Revisore.descrizioneNazionaleSottogruppo([regionale]), null);
});

test("dopo un salvataggio o un cambio di sottogruppo si aggiornano le due liste", () => {
    const visibile = riga("1", "1,2", null, 10);
    const daParte = riga("1", "1,3", null, 11);
    const revisore = { List: [visibile], ListSottogruppi: [daParte, visibile] };

    assert.deepStrictEqual(Revisore.righeDelleDueListe(revisore), [visibile, daParte]);
    assert.deepStrictEqual(Revisore.righeConIdRec(revisore, 11), [daParte]);
    assert.deepStrictEqual(Revisore.righeConIdRec(revisore, 99), []);
});

test("il revisore usa le copie solo nella vista Sottogruppi e aggiorna le due liste", () => {
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js");
    const inizio = revisore.indexOf("    attivaModalitàVisualizzazioneSottogruppi(senderVal) {");
    const attiva = revisore.substring(inizio, revisore.indexOf("\n    }\n", inizio));

    assert.match(attiva, /const righe = Revisore\.righeDeiSottogruppi\(this\.List\);/);
    assert.match(attiva, /me\.ListSottogruppi = Revisore\.costruisciListaSottogruppi\(righe, result\);/);
    //Niente piu' ricerche in me.List che saltano quando un sottogruppo c'e' solo nelle copie.
    assert.doesNotMatch(attiva, /me\.List\.find\(/);

    //altriSottogruppi lo leggono solo le funzioni della vista Sottogruppi.
    const usi = revisore.split("\n").filter(r => r.includes(".altriSottogruppi") && !r.trim().startsWith("//"));
    assert.ok(usi.length > 0);
    usi.forEach(r => assert.match(r, /copia\.altriSottogruppi = null|item\.altriSottogruppi/));
    const fuori = revisore.substring(0, revisore.indexOf("    static copiaPerSottogruppo(")) + revisore.substring(revisore.indexOf("    static descrizioneNazionaleSottogruppo("));
    assert.doesNotMatch(fuori, /\.altriSottogruppi/);

    //Salvataggio e aggiungi/togli dal sottogruppo guardano le due liste, senza TypeError se manca.
    assert.strictEqual((revisore.match(/obj = Revisore\.righeDelleDueListe\(sender\)\.filter\(/g) || []).length, 2);
    const modifica = revisore.substring(revisore.indexOf("    ModificaSottogruppo(idRec, idRecPilota, add) {"), revisore.indexOf("    visualizzaSottogruppoDaSender(sender) {"));
    assert.doesNotMatch(modifica, /ME\.List\.find\(f => f\.idRec == /);
    assert.match(modifica, /Revisore\.righeConIdRec\(ME, item\)/);
});

test("le firme dei sottogruppi si calcolano sui record attivi, come il conteggio", () => {
    const controller = sorgente("Istanta/Controllers/RevisoreController.cs");
    const metodo = controller.substring(controller.indexOf("public async Task<IActionResult> getArticoliDescrizioniSottogruppi("));
    assert.match(metodo.substring(0, 2000), /r\.Stato == \(byte\)StatoRecord\.Attivo &&/);
    //E la lista del revisore allega gli altri sottogruppi alle righe dei singoli.
    assert.match(controller, /itemDaAggiungere\.altriSottogruppi = RevisioneSottogruppi\.AltriSottogruppi\(/);
});
