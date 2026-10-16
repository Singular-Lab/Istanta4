/*
 * Foto extra caricate a mano negli slot dei loghi del PoP Coop.
 *
 * Il Plugin etichetta allo stesso modo le foto extra manuali e i loghi automatici:
 * foto_extra$<sigla o nome file>$tipo_<n>. Nel gruppo a slot Loghi di Coop due livelli generici in
 * coda, *foto_extra$*$tipo_3* e poi *foto_extra$*$tipo_2*, prendono quelle che nessun livello
 * riconosce per nome. Qui si prova con lo smistamento vero (cssFramework/slot.js), la regex vera
 * (CssFramework.makeRegexFromGroupName) e i livelli veri della configurazione di Coop. La condizione
 * sugli slot si prova con CssFramework.checkCondition: senza slot i livelli generici non valgono,
 * perche' li' i livelli non escludono gli elementi gia' presi.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const cssSlot = require("../../plugin/cssFramework/slot.js");

const caricaOriginale = Module._load;
Module._load = function (richiesta) {
    if (richiesta === "indesign") {
        return {};
    }
    return caricaOriginale.apply(this, arguments);
};
let CssFramework;
try {
    CssFramework = require("../../plugin/CssFramework.js");
}
finally {
    Module._load = caricaOriginale;
}

const FILE_CSS = path.join(__dirname, "..", "..", "Istanta", "wwwroot", "external_source", "Coopfi", "SourceFrameworkCss.json");

function gruppoLoghiDelPoP(box) {
    const kit = JSON.parse(fs.readFileSync(FILE_CSS, "utf8")).dbRidimensionamentiAllineamenti.modificheCssPerKit;
    const pop = kit.find(k => k.kit.kitTipoLavorazioniValide.length == 1 && k.kit.kitTipoLavorazioniValide[0] == 2);
    const operazione = pop.operazioniPerBox.find(o => box == null ? o.nomiBox.length == 0 : o.nomiBox.length == 1 && o.nomiBox[0] == box);
    return operazione.allineamenti.find(a => a.nomeGruppo == "Loghi");
}

const corrisponde = (etichetta, chiave) => CssFramework.makeRegexFromGroupName(etichetta).test(chiave);

function smista(gruppo, chiavi) {
    const livelli = gruppo.ordinamentoLivelli.slice();
    return cssSlot.elementiInOrdine(livelli, chiavi.map(chiave => ({ chiave: chiave })), corrisponde).map(e => e.chiave);
}

for (const box of [null, "BOX_doppio_SCONTO"]) {
    const nome = box == null ? "generico" : box;

    test("PoP " + nome + ": i loghi noti per primi, poi il logo manuale, poi il bollino; l'ambientata resta fuori", () => {
        const gruppo = gruppoLoghiDelPoP(box);
        const presenti = [
            "foto_extra$bollino_qualita.psd$tipo_2",
            "foto_extra$logo_dop$tipo_3",
            "foto_extra$ambientata.jpg$tipo_4",
            "foto_extra$logo_cliente.ai$tipo_3",
            "foto_extra$Logo_FiorFiore$tipo_3"
        ];

        const ordine = smista(gruppo, presenti);

        //logo_dop e FiorFiore nell'ordine dei loro livelli, poi i generici: prima i loghi, poi i bollini.
        assert.deepStrictEqual(ordine, [
            "foto_extra$logo_dop$tipo_3",
            "foto_extra$Logo_FiorFiore$tipo_3",
            "foto_extra$logo_cliente.ai$tipo_3",
            "foto_extra$bollino_qualita.psd$tipo_2"
        ]);
    });

    test("PoP " + nome + ": un logo automatico non elencato lo prendono i generici, e nessuno compare due volte", () => {
        const gruppo = gruppoLoghiDelPoP(box);
        const presenti = ["foto_extra$Logo_FiorFiore$tipo_3", "foto_extra$LOGO_MAI_VISTO$tipo_3", "foto_extra$secondo.ai$tipo_3"];

        const ordine = smista(gruppo, presenti);

        assert.deepStrictEqual(ordine, ["foto_extra$Logo_FiorFiore$tipo_3", "foto_extra$LOGO_MAI_VISTO$tipo_3", "foto_extra$secondo.ai$tipo_3"]);
        assert.strictEqual(new Set(ordine).size, ordine.length);
    });

    test("PoP " + nome + ": i livelli generici valgono solo se il box ha i riquadri degli slot", () => {
        const gruppo = gruppoLoghiDelPoP(box);
        const generici = gruppo.ordinamentoLivelli.filter(l => l.elementi.some(e => e.startsWith("*foto_extra$")));
        assert.strictEqual(generici.length, 2);

        const voce = { item: {}, eliminato: false };
        const conSlot = { "slot_logo1": voce, "foto_extra$logo_cliente.ai$tipo_3": voce };
        const senzaSlot = { "foto_extra$logo_cliente.ai$tipo_3": voce };
        for (const livello of generici) {
            const condizione = livello.listSetCondizioni[0].setCondizioni[0];
            assert.strictEqual(CssFramework.checkCondition(conSlot, null, condizione, null), true);
            assert.strictEqual(CssFramework.checkCondition(senzaSlot, null, condizione, null), false);
        }
    });
}
