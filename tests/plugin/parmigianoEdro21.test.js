/*
 * I20-1026: il formato Parmigiano Reggiano di Edro21, nella parte che decide il Plugin.
 *
 * Il server assegna a una ref Parmigiano tutti i loghi del formato. Qui si prova che le regole
 * del framework CSS di Edro21 (Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json)
 * fanno vedere quelli giusti per la forma del box, li mettono dove chiede il cliente, e
 * riconoscono le sigle che il server scrive davvero. Poi il custom di Edro21, per lo stile della
 * base, e il fix foto, per la descrizione che non deve finire sui loghi.
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RADICE = path.join(__dirname, "..", "..");
const sovrastrutture = require("../../plugin/cssFramework/sovrastrutture.js");

function leggi(relativo) {
    return fs.readFileSync(path.join(RADICE, relativo), "utf8").replace(/\r/g, "");
}

const regole = JSON.parse(leggi("Istanta/wwwroot/external_source/Edro21/SourceFrameworkCss.json"));
const kit = regole.dbRidimensionamentiAllineamenti.modificheCssPerKit;
const kitVolantino = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(1));

//Le sigle come le scrive il server (FormatoParmigianoEdro21 in AgenziaLib/Edro21.cs).
const edro21 = leggi("AgenziaLib/Edro21.cs");
function costante(nome) {
    const trovata = edro21.match(new RegExp("public const string " + nome + " = \"([^\"]+)\";"));
    assert.ok(trovata, nome + " non trovata in Edro21.cs");
    return trovata[1];
}
const SIGLA = {
    payoff: costante("SiglaPayoff"),
    caratteristiche: costante("SiglaCaratteristiche"),
    verticale: costante("SiglaTestoVerticale"),
    orizzontale: costante("SiglaTestoOrizzontale")
};

//Le label con cui il Plugin piazza i loghi: foto_extra$<sigla>$tipo_<tipo>, tipo 3 = Logo.
const label = sigla => "foto_extra$" + sigla + "$tipo_3";

//makeRegexFromGroupName di CssFramework: l'asterisco vale qualunque cosa, il resto e' letterale.
function regex(gruppo) {
    const pulito = gruppo.replace(/\[itemLink\]|\[exist\]/gi, "");
    return new RegExp("^" + pulito.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
}

function sovrastrutturaParmigiano(k) {
    const trovate = (k.sovrastrutture || []).filter(s => s.nome === "Parmigiano Reggiano");
    assert.strictEqual(trovate.length, 1, "una sola sovrastruttura Parmigiano per kit");
    return trovate[0];
}

/* ---- dove sta ---- */

test("la sovrastruttura Parmigiano c'e' nei due kit volantino, e non nel PoP", () => {
    assert.strictEqual(kitVolantino.length, 2);
    kitVolantino.forEach(sovrastrutturaParmigiano);

    const pop = kit.filter(k => (k.kit.kitTipoLavorazioniValide || []).includes(2));
    assert.ok(pop.length > 0);
    pop.forEach(k => assert.ok(!(k.sovrastrutture || []).some(s => s.nome === "Parmigiano Reggiano")));
});

test("si attiva sulla descrizione1 che dice Parmigiano Reggiano, come il server", () => {
    for (const k of kitVolantino) {
        const condizioni = sovrastrutturaParmigiano(k).listSetCondizioni;
        const vera = descrizione => condizioni.some(set => set.setCondizioni.every(c =>
            sovrastrutture.refConditionVera({ "Descrizioni.Descrizione1": descrizione }, c.refCondition)));

        assert.strictEqual(vera("PARMIGIANO REGGIANO DOP CONAD"), true);
        assert.strictEqual(vera("Parmigiano<br>Reggiano"), true);
        assert.strictEqual(vera("Grana Padano DOP"), false);
    }
});

/* ---- cosa si vede ---- */

//I loghi che la regola disattiva tiene fuori, per un box di quelle misure.
function disattivatiPerForma(k, larghezza, altezza) {
    const bounds = [0, 0, altezza, larghezza];
    const nascosti = [];
    for (const regola of sovrastrutturaParmigiano(k).operazioni.disattiva) {
        const vera = regola.listSetCondizioni.some(set => set.setCondizioni.every(c =>
            sovrastrutture.formaBoxConditionVera(bounds, c.formaBoxCondition)));
        if (!vera) continue;
        for (const [nome, sigla] of Object.entries(SIGLA)) {
            if (regola.elementi.some(e => regex(e).test(label(sigla)))) {
                nascosti.push(nome);
            }
        }
    }
    return nascosti.sort();
}

test("box standard: solo il payoff", () => {
    for (const k of kitVolantino) {
        assert.deepStrictEqual(disattivatiPerForma(k, 100, 100), ["caratteristiche", "orizzontale", "verticale"]);
    }
});

test("box alto: caratteristiche, testo verticale e payoff", () => {
    for (const k of kitVolantino) {
        assert.deepStrictEqual(disattivatiPerForma(k, 100, 160), ["orizzontale"]);
    }
});

test("box largo: caratteristiche, testo orizzontale e payoff", () => {
    for (const k of kitVolantino) {
        assert.deepStrictEqual(disattivatiPerForma(k, 160, 100), ["verticale"]);
    }
});

test("il payoff non e' mai disattivato", () => {
    for (const k of kitVolantino) {
        for (const regola of sovrastrutturaParmigiano(k).operazioni.disattiva) {
            assert.ok(!regola.elementi.some(e => regex(e).test(label(SIGLA.payoff))), regola.nomeGruppo);
        }
    }
});

/* ---- dove si mette ---- */

function allineamento(k, nome) {
    const trovato = sovrastrutturaParmigiano(k).operazioni.allineamenti.find(a => a.nomeGruppo === nome);
    assert.ok(trovato, nome);
    return trovato;
}

test("payoff e testi in basso a sinistra, fuori dalla traccia, il payoff sopra il testo", () => {
    for (const k of kitVolantino) {
        const gruppo = allineamento(k, "Parmigiano_SX_BOTTOM");
        const ancora = gruppo.staticAnchor[0];

        //x: lato sinistro del box; y: lato basso del box.
        assert.strictEqual(ancora.xAnchor.allineaAlLato, 0);
        assert.strictEqual(ancora.yAnchor.allineaAlLato, 1);
        //Ogni livello va al bordo sinistro per conto suo, come in Loghi_SX: senza, il gruppo si
        //sposta del minimo fra i livelli, quello del testo gia' vicino al bordo, e il payoff resta fermo.
        //In verticale si muovono insieme, cosi' restano impilati.
        assert.strictEqual(ancora.xAnchor.applyToSingleLevels, true);
        assert.strictEqual(ancora.yAnchor.applyToSingleLevels, false);
        assert.strictEqual(gruppo.evitaTracciaAllineamento.evitaTracciaBase, true);
        //Righe dal basso verso l'alto: il livello 1 (i testi) sta sotto il livello 2 (il payoff).
        assert.strictEqual(gruppo.letturaLivelli, 3);
        const livelloDi = sigla => gruppo.ordinamentoLivelli.find(l => l.elementi.some(e => regex(e).test(label(sigla)))).livello;
        assert.ok(livelloDi(SIGLA.verticale) < livelloDi(SIGLA.payoff));
        assert.ok(livelloDi(SIGLA.orizzontale) < livelloDi(SIGLA.payoff));
    }
});

test("il bollo dei mesi segue la foto dopo il fix foto, a un quarto dell'altezza, a filo del bordo destro", () => {
    for (const k of kitVolantino) {
        const gruppo = allineamento(k, "Parmigiano_BolloMesi");
        assert.strictEqual(gruppo.fase, "dopoFixFoto");

        const ancora = gruppo.followAnchor[0];
        assert.deepStrictEqual(ancora.nomiGruppiSeguiti, ["immagine*"]);
        assert.strictEqual(ancora.yAnchor.distancePercentuale, 25);
        assert.strictEqual(ancora.yAnchor.allineaAlLato, 0);
        assert.strictEqual(ancora.yAnchor.allineaLato, 0);
        assert.strictEqual(ancora.xAnchor.allineaAlLato, 1);
        assert.strictEqual(ancora.xAnchor.allineaLato, 1);
    }
});

test("il gruppo del bollo prende ogni bollo dei mesi e nessun altro logo", () => {
    const gruppo = allineamento(kitVolantino[0], "Parmigiano_BolloMesi");
    const prende = l => gruppo.gruppoEtichette.some(e => regex(e).test(l));

    for (const mesi of [12, 24, 48, 100]) {
        assert.ok(prende(label("Parmigiano_" + mesi + "M")), mesi);
    }
    for (const sigla of Object.values(SIGLA)) {
        assert.ok(!prende(label(sigla)), sigla);
    }
});

test("i loghi non hanno un post ridimensionamento: restano alla misura di impaginazione", () => {
    for (const k of kitVolantino) {
        assert.deepStrictEqual(sovrastrutturaParmigiano(k).operazioni.postRidimensionamenti, []);
    }
});

test("payoff e testi seguono il fondo del box al ridimensionamento, senza cambiare misura", () => {
    //Senza, restavano alla distanza dall'alto del box di partenza: restringendo un box alto il payoff
    //finiva sotto il fondo nuovo, gli allineamenti in basso si appoggiavano li' e i campi si
    //ammassavano; da alto a largo usciva dal tavolo di montaggio e followStaticAnchor si fermava.
    const SPOSTAMENTO_LINEARE = 2;
    for (const k of kitVolantino) {
        const ridimensionamenti = sovrastrutturaParmigiano(k).operazioni.ridimensionamenti;
        assert.strictEqual(ridimensionamenti.length, 1);
        const fondo = ridimensionamenti[0];
        assert.strictEqual(fondo.ridimensionamento.y, SPOSTAMENTO_LINEARE);
        assert.strictEqual(fondo.ridimensionamento.x, null);
        const prende = l => fondo.gruppoEtichette.some(e => regex(e).test(l));
        for (const sigla of [SIGLA.payoff, SIGLA.verticale, SIGLA.orizzontale]) {
            assert.ok(prende(label(sigla)), sigla);
        }
        //Le caratteristiche stanno in alto, con Loghi_DX, e il bollo segue la foto.
        assert.ok(!prende(label(SIGLA.caratteristiche)));
        assert.ok(!prende(label("Parmigiano_24M")));
    }
});

test("le caratteristiche sono il livello 6 di ogni Loghi_DX dei kit volantino, sotto DOP e IGP", () => {
    let trovati = 0;
    for (const k of kitVolantino) {
        for (const voce of k.operazioniPerBox) {
            for (const gruppo of (voce.allineamenti || []).filter(a => a.nomeGruppo === "Loghi_DX")) {
                const livelli = gruppo.ordinamentoLivelli.map(l => l.livello);
                const caratteristiche = gruppo.ordinamentoLivelli.find(l => l.elementi.some(e => regex(e).test(label(SIGLA.caratteristiche))));
                assert.ok(caratteristiche, "Loghi_DX di " + JSON.stringify(voce.nomiBox));
                assert.strictEqual(caratteristiche.livello, 6);
                assert.strictEqual(Math.max(...livelli), 6);
                assert.ok(gruppo.gruppoEtichette.some(e => regex(e).test(label(SIGLA.caratteristiche))));
                trovati++;
            }
        }
    }
    //Due varianti (con e senza Conad) nelle regole generali, in BOX7 e in BOX12, per due kit.
    assert.strictEqual(trovati, 12);
});

/* ---- il custom di Edro21 e il fix foto ---- */

test("il custom di Edro21 applica base_A_Parmigiano per SC e base_P_Parmigiano per gli altri", () => {
    const custom = leggi("plugin/Agenzie/Edro21/custom.js");
    assert.match(custom, /const sovrastrutture = require\('\.\/cssFramework\/sovrastrutture'\);/);
    assert.match(custom, /sovrastrutture\.refConditionVera\(objItem, \[\{ campo: "Descrizioni\.Descrizione1", contiene: "parmigiano reggiano" \}\]\)/);
    assert.match(custom, /name: canale == "SC" \? "base_A_Parmigiano" : "base_P_Parmigiano"/);
    //Dopo gli altri stili della base: su una ref Parmigiano vince lui.
    assert.ok(custom.indexOf("base_P_Parmigiano") > custom.indexOf("base_P_VersoNatura"));
});

test("payoff e testi fanno da ostacolo al fix foto di Edro21", () => {
    const custom = leggi("plugin/Agenzie/Edro21/custom.js");
    const eccezioni = custom.substring(custom.indexOf("exceptionElementsToIgnoreFixFoto:"), custom.indexOf("calcoloDistanziamentoFoto"));
    for (const sigla of [SIGLA.payoff, SIGLA.verticale, SIGLA.orizzontale]) {
        assert.ok([...eccezioni.matchAll(/"([^"]+)"/g)].some(m => regex(m[1]).test(label(sigla))), sigla);
    }
});

/* ---- il collaudo: la descrizione e i loghi ---- */

//Il fix foto di Edro21 spostava la descrizione in basso a sinistra, addosso al payoff.
function descrizioneTraLoghi() {
    const custom = leggi("plugin/Agenzie/Edro21/custom.js");
    const inizio = custom.indexOf("    descrizioneTraLoghi(box, descrizione) {");
    assert.ok(inizio > 0);
    let livello = 0;
    let fine = custom.indexOf("{", inizio);
    for (; fine < custom.length; fine++) {
        if (custom[fine] === "{") livello++;
        else if (custom[fine] === "}" && --livello === 0) break;
    }
    const CssFrameworkFinto = {
        getRealBounds: item => item.testo || item.geometricBounds,
        makeRegexFromGroupName: regex
    };
    const UtilityFinta = { parseLabel: l => (l.indexOf("foto_extra") === 0 ? l : l.split("$")[0]) };
    const oggetto = new Function("CssFramework", "Utility",
        "return { exceptionElementsToIgnoreFixFoto: [\"*Parmigiano_payoff*\", \"*parmigiano_testo_2mod_*\", \"*Logo_SDB*\"],\n"
        + custom.substring(inizio + 4, fine + 1) + "};")(CssFrameworkFinto, UtilityFinta);
    return oggetto;
}

function boxCon(descrizione, altri) {
    return { allPageItems: [descrizione].concat(altri) };
}

test("la descrizione che tocca il payoff con il testo e' in conflitto", () => {
    const custom = descrizioneTraLoghi();
    const descrizione = { label: "descrizione", visible: true, geometricBounds: [50, 0, 90, 60], testo: [70, 0, 90, 40] };
    const payoff = { label: label(SIGLA.payoff), visible: true, geometricBounds: [80, 10, 95, 50] };

    assert.strictEqual(custom.descrizioneTraLoghi(boxCon(descrizione, [payoff]), descrizione), true);
});

test("conta il testo, non il riquadro; e un logo nascosto o che non fa da ostacolo non conta", () => {
    const custom = descrizioneTraLoghi();
    //Il riquadro tocca il payoff, il testo no.
    const descrizione = { label: "descrizione", visible: true, geometricBounds: [50, 0, 95, 60], testo: [50, 0, 70, 40] };
    const payoff = { label: label(SIGLA.payoff), visible: true, geometricBounds: [80, 10, 95, 50] };
    assert.strictEqual(custom.descrizioneTraLoghi(boxCon(descrizione, [payoff]), descrizione), false);

    const sopra = { label: "descrizione", visible: true, geometricBounds: [80, 10, 95, 50], testo: [80, 10, 95, 50] };
    const nascosto = { label: label(SIGLA.verticale), visible: false, geometricBounds: [80, 10, 95, 50] };
    const nonOstacolo = { label: label("Parmigiano_24M"), visible: true, geometricBounds: [80, 10, 95, 50] };
    assert.strictEqual(custom.descrizioneTraLoghi(boxCon(sopra, [nascosto, nonOstacolo]), sopra), false);
});

test("il fix foto di Edro21 rimette la descrizione dov'era se tocca un logo", () => {
    const custom = leggi("plugin/Agenzie/Edro21/custom.js");
    assert.match(custom, /if \(this\.descrizioneTraLoghi\(box, descrizione\)\) \{\s*if \(descrizioneFuoriBox && descrizioneDaRidurre != null\) \{\s*descrizioneDaRidurre\.geometricBounds = oldBoundsOverflow;\s*\}\s*descrizione\.geometricBounds = oldBounds;\s*CssFramework\.fixFoto\(box, res1\.candidate, res1\.obstacles\);\s*return box;/);
});
