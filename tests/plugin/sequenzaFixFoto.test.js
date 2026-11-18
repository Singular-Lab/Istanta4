/*
 * I20-1240: la sequenza del fix foto dichiarata nel CssFramework.
 *
 * Il fix foto di Edro21 stava nel custom.js dell'agenzia: provava il box con la descrizione dov'era
 * e spostata in basso, e teneva la disposizione migliore. Ora il concetto e' del Plugin e lo
 * configura il CssFramework, per qualsiasi cliente: nella sezione fixFoto una "sequenza" di passi,
 * "fixFoto" (anche piu' volte), "fase" (le regole con quella fase) e "simulazioni" (le varianti del
 * box provate e rimesse a posto, si tiene la migliore).
 *
 * L'esecuzione sta in plugin/sistemazioneFoto/sistemazioneFoto.js, che parla con InDesign: qui la si
 * prova su un box finto, con il fix foto e le fasi sostituiti da registratori.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const Module = require("node:module");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

function caricaConStub() {
    const originale = Module._load;
    Module._load = function (richiesta) {
        if (richiesta === "indesign") {
            return {};
        }
        return originale.apply(this, arguments);
    };
    try {
        return {
            CssFramework: require("../../plugin/CssFramework.js"),
            SistemazioneFoto: require("../../plugin/sistemazioneFoto/sistemazioneFoto.js")
        };
    }
    finally {
        Module._load = originale;
    }
}

/// Sostituisce per la durata della prova i metodi indicati e li rimette a posto.
function conSostituti(oggetto, sostituti, prova) {
    const veri = {};
    Object.keys(sostituti).forEach(k => { veri[k] = oggetto[k]; oggetto[k] = sostituti[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(veri).forEach(k => { oggetto[k] = veri[k]; });
    }
}

/// Un elemento finto del box: etichetta, misure e, per un testo, se trabocca.
function elemento(id, label, bounds, opzioni = {}) {
    return Object.assign({ id: id, label: label, isValid: true, visible: true, constructorName: "Rectangle", geometricBounds: bounds.slice() }, opzioni);
}

function boxFinto(elementi) {
    return { id: 1, label: "BOX1", isValid: true, allPageItems: elementi };
}

const globaliPrima = { Utility: global.Utility };
test.before(() => {
    global.Utility = global.Utility || { parseLabel: l => (l == null ? l : String(l).split("$")[0]) };
});
test.after(() => {
    global.Utility = globaliPrima.Utility;
});

/* ---- la sequenza ---- */

test("I20-1240: i passi si eseguono nel loro ordine, il fix foto anche due volte, e i conflitti si controllano alla fine", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const registro = [];
    const box = boxFinto([]);

    conSostituti(SistemazioneFoto, {
        getSpazioImpaginazione: () => ({ candidate: [], obstacles: [] }),
        fixFoto: () => { registro.push("fixFoto"); }
    }, () => conSostituti(CssFramework, {
        applicaFase: (b, fase) => { registro.push("fase " + fase); return b; },
        controllaSegnalazioniConflittiPendenti: () => { registro.push("conflitti, sospeso " + CssFramework.sospendiControlloSegnalazioniConflitti); },
        sospendiControlloSegnalazioniConflitti: false
    }, () => {
        SistemazioneFoto.eseguiSequenza(box, [{ tipo: "fixFoto" }, { tipo: "fase", fase: "rifinitura" }, { tipo: "fixFoto" }]);
        assert.strictEqual(CssFramework.sospendiControlloSegnalazioniConflitti, false);
    }));

    assert.deepStrictEqual(registro, ["fixFoto", "fase rifinitura", "fixFoto", "conflitti, sospeso false"]);
});

test("I20-1240: all'impaginazione, dove i conflitti si controllano dopo, la sequenza non li controlla", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const registro = [];

    conSostituti(SistemazioneFoto, {
        getSpazioImpaginazione: () => ({ candidate: [], obstacles: [] }),
        fixFoto: () => { registro.push("fixFoto"); }
    }, () => conSostituti(CssFramework, {
        controllaSegnalazioniConflittiPendenti: () => { registro.push("conflitti"); },
        sospendiControlloSegnalazioniConflitti: true
    }, () => {
        SistemazioneFoto.eseguiSequenza(boxFinto([]), [{ tipo: "fixFoto" }]);
        assert.strictEqual(CssFramework.sospendiControlloSegnalazioniConflitti, true);
    }));

    assert.deepStrictEqual(registro, ["fixFoto"]);
});

/* ---- le simulazioni ---- */

/// Un box come quello della pancetta: la descrizione sta a lato del prezzo; la fase "descrizioneInBasso"
/// la porta in basso. La prova del fix foto dice un'area che dipende da dove sta la descrizione.
function scenaPancetta(CssFramework, SistemazioneFoto, opzioni = {}) {
    const descrizione = elemento(10, "descrizione", [10, 60, 30, 95], { constructorName: "TextFrame", overflows: false });
    const logo = elemento(11, "foto_extra$logo$tipo_3", [80, 0, 95, 20]);
    const box = boxFinto([descrizione, logo]);
    const registro = [];
    const conta = { spazi: 0 };

    const sostitutiFoto = {
        getSpazioImpaginazione: () => { conta.spazi++; return { candidate: [{}], obstacles: [] }; },
        proiezioneFixFoto: () => {
            const inBasso = descrizione.geometricBounds[0] >= 70;
            registro.push("prova " + (inBasso ? "in basso" : "a lato"));
            return inBasso ? opzioni.provaInBasso : opzioni.provaALato;
        },
        fixFoto: () => { registro.push("fixFoto"); }
    };
    const sostitutiCss = {
        applicaFase: (b, fase) => {
            registro.push("fase " + fase);
            if (fase === "descrizioneInBasso") {
                descrizione.geometricBounds = opzioni.boundsInBasso || [70, 30, 90, 65];
                if (opzioni.traboccaInBasso) {
                    descrizione.overflows = true;
                }
            }
            return b;
        },
        getSceltaSpazioFoto: () => opzioni.preferenza || null,
        condizioniVere: (b, condizioni) => !(Array.isArray(condizioni) && condizioni.length > 0 && opzioni.condizioniFalse),
        getRealBounds: item => item.geometricBounds,
        controllaSegnalazioniConflittiPendenti: () => {},
        sospendiControlloSegnalazioniConflitti: true
    };
    return { descrizione, box, registro, conta, sostitutiFoto, sostitutiCss };
}

function varianti(scartaSe = {}, listSetCondizioni = []) {
    const cssSequenzaOperazioni = require("../../plugin/cssFramework/sequenzaOperazioni");
    return cssSequenzaOperazioni.normalizzaSequenza([{
        tipo: "simulazioni",
        varianti: [
            { nome: "testiALato", passi: [] },
            { nome: "testiInBasso", passi: [{ tipo: "fase", fase: "descrizioneInBasso" }], scartaSe: scartaSe, listSetCondizioni: listSetCondizioni }
        ]
    }, { tipo: "fixFoto" }]);
}

test("I20-1240: vince la variante migliore, che resta sul box senza rifarne i passi, e il fix foto usa lo spazio della sua prova", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 } });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti());
    }));

    //la fase si esegue una volta sola: la vincente era l'ultima provata, e resta com'e'
    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "prova in basso", "fixFoto"]);
    assert.deepStrictEqual(scena.descrizione.geometricBounds, [70, 30, 90, 65]);
    //due calcoli dello spazio, uno per prova: il fix foto riusa quello della vincente
    assert.strictEqual(scena.conta.spazi, 2);
});

test("I20-1240: se vince una variante che non e' l'ultima, il box torna alle posizioni della sua prova senza rifarla", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 500 }, provaInBasso: { area: 1000 } });
    const altro = elemento(12, "prezzo_offerta", [40, 60, 60, 95]);
    scena.box.allPageItems.push(altro);
    //la terza variante sposta il prezzo, e la foto le viene piu' piccola
    const faseVera = scena.sostitutiCss.applicaFase;
    scena.sostitutiCss.applicaFase = (b, fase) => {
        if (fase === "prezzoInAlto") {
            scena.registro.push("fase prezzoInAlto");
            altro.geometricBounds = [5, 60, 25, 95];
            return b;
        }
        return faseVera(b, fase);
    };
    const proiezioneVera = scena.sostitutiFoto.proiezioneFixFoto;
    scena.sostitutiFoto.proiezioneFixFoto = () => altro.geometricBounds[0] < 10 ? (scena.registro.push("prova prezzo in alto"), { area: 700 }) : proiezioneVera();
    const cssSequenzaOperazioni = require("../../plugin/cssFramework/sequenzaOperazioni");
    const sequenza = cssSequenzaOperazioni.normalizzaSequenza([{
        tipo: "simulazioni",
        varianti: [
            { nome: "testiALato", passi: [] },
            { nome: "testiInBasso", passi: [{ tipo: "fase", fase: "descrizioneInBasso" }] },
            { nome: "prezzoInAlto", passi: [{ tipo: "fase", fase: "prezzoInAlto" }] }
        ]
    }, { tipo: "fixFoto" }]);

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, sequenza);
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "prova in basso", "fase prezzoInAlto", "prova prezzo in alto", "fixFoto"]);
    //vince "in basso": la descrizione e' dove l'aveva messa la sua prova, il prezzo dove stava
    assert.deepStrictEqual(scena.descrizione.geometricBounds, [70, 30, 90, 65]);
    assert.deepStrictEqual(altro.geometricBounds, [40, 60, 60, 95]);
    assert.strictEqual(scena.conta.spazi, 3);
});

test("I20-1240: tornando al box di prima si riscrivono solo gli elementi che si sono mossi", () => {
    const { SistemazioneFoto } = caricaConStub();
    const scritture = [];
    const fermo = { id: 1, isValid: true, constructorName: "TextFrame" };
    const mosso = { id: 2, isValid: true, constructorName: "TextFrame" };
    let boundsFermo = [0, 0, 10, 10];
    let boundsMosso = [20, 0, 30, 10];
    Object.defineProperty(fermo, "geometricBounds", { get: () => boundsFermo.slice(), set: v => { scritture.push("fermo"); boundsFermo = v; } });
    Object.defineProperty(mosso, "geometricBounds", { get: () => boundsMosso.slice(), set: v => { scritture.push("mosso"); boundsMosso = v; } });
    const box = boxFinto([fermo, mosso]);

    const posizioni = SistemazioneFoto.salvaPosizioni(box);
    boundsMosso = [50, 0, 60, 10];
    SistemazioneFoto.ripristinaPosizioni(posizioni);

    assert.deepStrictEqual(scritture, ["mosso"]);
    assert.deepStrictEqual(boundsMosso, [20, 0, 30, 10]);
});

test("I20-1240: se vince la prima variante il box resta com'era prima delle prove", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 1000 }, provaInBasso: { area: 600 } });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti());
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "prova in basso", "fixFoto"]);
    assert.deepStrictEqual(scena.descrizione.geometricBounds, [10, 60, 30, 95]);
});

test("I20-1240: una variante il cui testo trabocca si scarta senza misurarla", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 }, traboccaInBasso: true });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti({ overflow: ["descrizione"] }));
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "fixFoto"]);
    assert.deepStrictEqual(scena.descrizione.geometricBounds, [10, 60, 30, 95]);
});

test("I20-1240: una variante che porta un testo su un logo si scarta", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    //in basso a sinistra la descrizione finisce sul logo
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 }, boundsInBasso: [75, 5, 92, 40] });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti({ sovrapposizioni: [{ elementi: ["descrizione"], con: ["foto_extra*"] }] }));
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "fixFoto"]);
});

test("I20-1240: una variante che esce dalla base si scarta", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 }, boundsInBasso: [80, -5, 100, 30] });
    scena.box.allPageItems.push(elemento(12, "base", [0, 0, 100, 100]));

    conSostituti(SistemazioneFoto, Object.assign({}, scena.sostitutiFoto, { trovaBase: () => scena.box.allPageItems[2] }), () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti({ fuoriBase: ["descrizione"] }));
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "fixFoto"]);
});

test("I20-1240: una variante in cui il motore deve riportare la descrizione dentro il box si scarta", () => {
    //Il motore annota da sempre gli elementi che rispinge nella griglia (CSF-008): la variante lo legge.
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 } });
    const faseVera = scena.sostitutiCss.applicaFase;
    scena.sostitutiCss.applicaFase = (b, fase) => {
        const esito = faseVera(b, fase);
        CssFramework.spostamentiGrigliaPendenti.spostamenti.push({ itemKey: "10", label: "descrizione", direzione: "verso destra", bounds: [70, 35, 90, 70] });
        return esito;
    };
    const pendentiPrima = CssFramework.spostamentiGrigliaPendenti;
    //un rientro della descrizione gia' annotato prima della variante non conta
    CssFramework.spostamentiGrigliaPendenti = { boxKey: "k", boxLabel: "BOX1", spostamenti: [{ itemKey: "10", label: "descrizione", direzione: "verso il basso", bounds: [10, 60, 30, 95] }] };
    try {
        conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
            SistemazioneFoto.eseguiSequenza(scena.box, varianti({ rientroInGriglia: ["descrizione"] }));
        }));
        assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "fixFoto"]);
        assert.deepStrictEqual(scena.descrizione.geometricBounds, [10, 60, 30, 95]);
        //e le annotazioni tornano quelle di prima della prova
        assert.deepStrictEqual(CssFramework.spostamentiGrigliaPendenti.spostamenti.map(s => s.direzione), ["verso il basso"]);
    }
    finally {
        CssFramework.spostamentiGrigliaPendenti = pendentiPrima;
    }
});

test("I20-1240: senza rientri nuovi la variante resta valida, anche con un rientro di un altro elemento", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 } });
    const faseVera = scena.sostitutiCss.applicaFase;
    scena.sostitutiCss.applicaFase = (b, fase) => {
        const esito = faseVera(b, fase);
        CssFramework.spostamentiGrigliaPendenti.spostamenti.push({ itemKey: "20", label: "prezzo_offerta", direzione: "verso sinistra", bounds: [0, 0, 1, 1] });
        return esito;
    };
    const pendentiPrima = CssFramework.spostamentiGrigliaPendenti;
    CssFramework.spostamentiGrigliaPendenti = { boxKey: "k", boxLabel: "BOX1", spostamenti: [] };
    try {
        conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
            SistemazioneFoto.eseguiSequenza(scena.box, varianti({ rientroInGriglia: ["descrizione"] }));
        }));
        assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "prova in basso", "fixFoto"]);
    }
    finally {
        CssFramework.spostamentiGrigliaPendenti = pendentiPrima;
    }
});

test("I20-1240: una variante con le condizioni false non si prova", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 800 }, provaInBasso: { area: 1000 }, condizioniFalse: true });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti({}, [{ setCondizioni: [{ elementiDaNonTrovare: ["*LOGO_carneS_USOdiANTIBIOTICI*"] }] }]));
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fixFoto"]);
});

test("I20-1240: senza nessuna variante con posto per le foto il box resta com'e'", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: null, provaInBasso: null });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti());
    }));

    assert.deepStrictEqual(scena.registro, ["prova a lato", "fase descrizioneInBasso", "prova in basso", "fixFoto"]);
    assert.deepStrictEqual(scena.descrizione.geometricBounds, [10, 60, 30, 95]);
});

test("I20-1240: a parita' di foto decide lo spareggio sul vuoto del box, come fra due disposizioni", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, {
        preferenza: { modo: "centrato", tolleranzaArea: 0.7, asseCentratura: "xy", spareggio: "vuotoMinore" },
        provaALato: { area: 1000, distanzaDalCentro: 3, vuoto: { quota: 0.312, metaBassaOccupata: 0.476 } },
        provaInBasso: { area: 1000, distanzaDalCentro: 3, vuoto: { quota: 0.192, metaBassaOccupata: 0.613 } }
    });

    conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
        SistemazioneFoto.eseguiSequenza(scena.box, varianti());
    }));

    assert.deepStrictEqual(scena.descrizione.geometricBounds, [70, 30, 90, 65]);
});

test("I20-1240: una variante scartata non lascia spostamenti in griglia in sospeso", () => {
    const { CssFramework, SistemazioneFoto } = caricaConStub();
    const scena = scenaPancetta(CssFramework, SistemazioneFoto, { provaALato: { area: 1000 }, provaInBasso: { area: 600 } });
    const faseVera = scena.sostitutiCss.applicaFase;
    scena.sostitutiCss.applicaFase = (b, fase) => {
        CssFramework.spostamentiGrigliaPendenti = { boxKey: "k", boxLabel: "BOX1", spostamenti: [{ itemKey: "descrizione" }] };
        CssFramework.etichetteSegnalate.push("descrizione");
        return faseVera(b, fase);
    };
    const pendentiPrima = CssFramework.spostamentiGrigliaPendenti;
    const segnalatePrima = CssFramework.etichetteSegnalate;
    CssFramework.spostamentiGrigliaPendenti = null;
    CssFramework.etichetteSegnalate = [];
    try {
        conSostituti(SistemazioneFoto, scena.sostitutiFoto, () => conSostituti(CssFramework, scena.sostitutiCss, () => {
            SistemazioneFoto.eseguiSequenza(scena.box, varianti());
        }));
        assert.strictEqual(CssFramework.spostamentiGrigliaPendenti, null);
        assert.deepStrictEqual(CssFramework.etichetteSegnalate, []);
    }
    finally {
        CssFramework.spostamentiGrigliaPendenti = pendentiPrima;
        CssFramework.etichetteSegnalate = segnalatePrima;
    }
});

/* ---- quando la sequenza vale ---- */

test("I20-1240: nel modo automatico vale la sequenza, se il box ne ha una; nel semplice e senza, il fix del Plugin", () => {
    const { SistemazioneFoto } = caricaConStub();
    const registro = [];
    const configurazione = { lavorazioni: [1], modo: "automatico", sequenza: [{ tipo: "fixFoto" }] };

    conSostituti(SistemazioneFoto, {
        configurazione: () => configurazione,
        eseguiSequenza: (box, sequenza) => { registro.push("sequenza " + sequenza.length); return box; },
        getSpazioImpaginazione: () => ({ candidate: [], obstacles: [] }),
        fixFoto: () => { registro.push("fix del Plugin"); }
    }, () => {
        SistemazioneFoto.sistemaFotoAllImpaginazione(boxFinto([]), null, 1);
        configurazione.modo = "semplice";
        SistemazioneFoto.sistemaFotoAllImpaginazione(boxFinto([]), null, 1);
        configurazione.modo = "automatico";
        configurazione.sequenza = null;
        SistemazioneFoto.sistemaFotoAllImpaginazione(boxFinto([]), null, 1);
    });

    assert.deepStrictEqual(registro, ["sequenza 1", "fix del Plugin", "fix del Plugin"]);
});

test("I20-1240: la sequenza si legge dalla voce piu' forte che la dichiara, gia' normalizzata", () => {
    const { SistemazioneFoto } = caricaConStub();

    const delBox = SistemazioneFoto.risolviConfigurazione([
        { fixFoto: { sequenza: [{ tipo: "fixFoto" }, { tipo: "fase", fase: "rifinitura" }] } },
        { fixFoto: { sequenza: [{ tipo: "fixFoto" }] } }
    ]);
    assert.deepStrictEqual(delBox.sequenza, [{ tipo: "fixFoto" }, { tipo: "fase", fase: "rifinitura" }]);

    assert.strictEqual(SistemazioneFoto.risolviConfigurazione([{ fixFoto: { modo: "automatico" } }]).sequenza, null);
    assert.strictEqual(SistemazioneFoto.risolviConfigurazione([]).sequenza, null);
});

/* ---- il CssFramework ---- */

test("I20-1240: le fasi della sequenza si registrano ovunque arrivino le regole del cliente", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");

    //lo scaricamento, la copia su disco e le quattro letture delle due applicazioni del CSS
    assert.ok(sorgente.includes("me.regoleScaricate = allineamentiDB;\n                        cssSequenzaOperazioni.registraFasiDelFile(allineamentiDB);"));
    assert.ok(sorgente.includes("this.regoleScaricate = file;\n            cssSequenzaOperazioni.registraFasiDelFile(file);"));
    assert.strictEqual(sorgente.split("cssSequenzaOperazioni.registraFasiDelFile(file);\n").length - 1, 5);
});

test("I20-1240: una fase usa il contesto CSS del box, e il momento dopoFixFoto resta com'era", () => {
    const { CssFramework } = caricaConStub();
    const registro = [];
    const contesto = { idBox: 1, boundsBoxImpaginato: [0, 0, 100, 100], DBallineamenti: [{ nomiBox: [], allineamenti: [{ nomeGruppo: "sempre" }, { nomeGruppo: "giu", fase: "descrizioneInBasso" }] }], DBDefault: null, mappaBoxOriginale: {}, prefissiDerivati: [] };
    const cssSequenzaOperazioni = require("../../plugin/cssFramework/sequenzaOperazioni");
    const fasiPrima = cssSequenzaOperazioni.fasiDichiarate;
    cssSequenzaOperazioni.fasiDichiarate = ["descrizioneInBasso"];
    try {
        conSostituti(CssFramework, {
            contestoCss: contesto,
            aggiungiNuoviElementiAllaMappa: (b, m) => m,
            updateMap: m => m,
            applicaRidimensionamento: () => { registro.push("ridimensionamenti"); },
            applicaPostRidimensionamento: () => { registro.push("post"); },
            allineamenti: (b, bounds, mappa, ref, DB) => { registro.push("allineamenti " + DB[0].allineamenti.map(r => r.nomeGruppo).join(",")); return b; }
        }, () => {
            const box = boxFinto([]);
            CssFramework.applicaFase(box, "descrizioneInBasso", null);
            //una fase che il file non dichiara non tocca niente: non riesegue le regole di sempre
            CssFramework.applicaFase(box, "rifinitura", null);
            //nemmeno il momento standard si puo' chiamare come fase
            CssFramework.applicaFase(box, "standard", null);
        });
    }
    finally {
        cssSequenzaOperazioni.fasiDichiarate = fasiPrima;
    }

    //la fase ha solo un allineamento: ridimensionamenti e post ridimensionamenti, che leggono tutto il box, si saltano
    assert.deepStrictEqual(registro, ["allineamenti giu"]);

    //il momento dopoFixFoto passa sempre da tutti e tre, come prima
    registro.length = 0;
    const contestoDopo = Object.assign({}, contesto, { DBallineamenti: [{ nomiBox: [], allineamenti: [{ nomeGruppo: "ombre", fase: "dopoFixFoto" }] }] });
    conSostituti(CssFramework, {
        aggiungiNuoviElementiAllaMappa: (b, m) => m,
        updateMap: m => m,
        applicaRidimensionamento: () => { registro.push("ridimensionamenti"); },
        applicaPostRidimensionamento: () => { registro.push("post"); },
        allineamenti: (b) => { registro.push("allineamenti"); return b; }
    }, () => {
        CssFramework.eseguiRegoleDelMomento(boxFinto([]), contestoDopo, "dopoFixFoto", [0, 0, 100, 100]);
    });
    assert.deepStrictEqual(registro, ["ridimensionamenti", "post", "allineamenti"]);

    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");
    assert.ok(sorgente.includes("box = this.eseguiRegoleDelMomento(box, contesto, cssSequenzaOperazioni.dopoFixFoto,"));
});

test("I20-1240: il contesto di un altro box con la stessa etichetta non vale per le fasi", () => {
    const { CssFramework } = caricaConStub();

    conSostituti(CssFramework, {
        contestoCss: { idBox: 99, etichettaBox: "BOX1" },
        regoleDallaCopia: () => null
    }, () => {
        assert.strictEqual(CssFramework.contestoDelBox(boxFinto([]), null), null);
    });
    conSostituti(CssFramework, { contestoCss: { idBox: 1, etichettaBox: "BOX1" } }, () => {
        assert.strictEqual(CssFramework.contestoDelBox(boxFinto([]), null).idBox, 1);
    });
});

test("I20-1240: nell'aggancio a un gruppo la misura del testo di ogni elemento si fa una volta sola", () => {
    const sorgente = leggiFileDelPlugin("CssFramework.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    followGroup(gruppoSeguito, gruppoAllineamento, anchor,");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    const corpo = sorgente.substring(inizio, fine);
    //l'unica chiamata a getRealBounds e' quella dentro misuraTesto, che ricorda le misure per id
    assert.strictEqual(corpo.split("getRealBounds(").length - 1, 2);
    assert.ok(corpo.includes("misureTesto[chiave] = me.getRealBounds(item);"));
    assert.ok(!/(me|this)\.getRealBounds\(target\)/.test(corpo));
});
