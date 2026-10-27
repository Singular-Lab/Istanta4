/*
 * I20-1143: la descrizione nella scheda ref, fra spazi, a capo e alterazioni dell'esportazione.
 *
 * Tre cose, che prima andavano ognuna per conto suo:
 * - il giallo delle caselle e "Applica descrizione da server" nascono dallo stesso verdetto, la
 *   preanalisi, che confronta blocco per blocco senza spazi e a capo: prima il giallo aveva un
 *   confronto suo, che contava gli spazi e non vedeva i blocchi del server assenti dal box;
 * - Salva modifiche manda anche uno spazio o un a capo cambiato, nella scheda o a mano nel box:
 *   il confronto e' col testo che il server compone, perche' gli export aggiungono i loro
 *   separatori (Coop uno spazio davanti, Edro21 un a capo in coda) e con l'archivio ogni campo
 *   sembrerebbe cambiato;
 * - una descrizione fondamentale che l'esportazione ha alterato - testo cambiato, nascosto o
 *   tolto, non solo spazi - non si segnala, resta in sola lettura con "(Alterato da
 *   logiche agenzia)" (TASK-5d3fea89; prima "da esportazione") e parte non toccata.
 *
 * I casi vengono da schede vere (Coop, Edro21) e dall'allegato di I20-1143 (PROFITEROLES).
 *
 * Esecuzione: node --test tests/plugin/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const { leggiFileDelPlugin } = require("./fileDelPlugin");

const confronti = require("../../plugin/confronti.js");
const TestoTagVero = require("../../plugin/testoTag.js");
const InputEditController = require("../../plugin/InputEditController.js");
const schedaRef = require("../../plugin/schedaRef.js");

const NON_TOCCATO = "<untouched>";

//Gli stili universali di Coop e di Edro21: chi porta a quale descrizione fondamentale.
const FONDAMENTALI_COOP = {
    DESCRIZIONE_TITOLO: "descrizione1", DESCRIZIONE_BRAND: "descrizione2",
    DESCRIZIONE_TIPO: "descrizione3", DESCRIZIONE_GRAMMATURA: "descrizione4"
};
const fondamentaleCoop = stile => FONDAMENTALI_COOP[stile] || null;
const fondamentaleEdro = function (stile) {
    const regole = { descr_nome: "descrizione1", descr_marca: "descrizione2", descr_tipo: "descrizione3", descr_gr: "descrizione4" };
    const trovata = Object.keys(regole).find(r => String(stile).indexOf(r) >= 0);
    return trovata != null ? regole[trovata] : null;
};

//Utility.replaceAllSpecialCharacters per quello che serve qui: <br> e $br sono a capo.
const normalizza = t => String(t == null ? "" : t).replace(/\r\n/g, "\n").replace(/<br>|<BR>|\$br/g, "\n");

//Utility.replaceAllSpecialCharacters e replaceAll come sono scritte in utility.js, che sotto Node non
//si carica, legate a un oggetto come nel Plugin. La prima usa this: chiamata staccata dal suo
//oggetto lancia, ed e' quello che bloccava la scheda in InDesign (un finto senza this non lo vede).
function utilityVera() {
    const testo = leggiFileDelPlugin("utility.js");
    const membro = function (intestazione) {
        const inizio = testo.indexOf(intestazione);
        assert.notStrictEqual(inizio, -1, intestazione + " non trovata in utility.js: il test va aggiornato");
        let livello = 0;
        for (let i = inizio; i < testo.length; i++) {
            if (testo[i] === "{") { livello++; }
            else if (testo[i] === "}") { livello--; if (livello === 0) { return testo.substring(inizio, i + 1); } }
        }
        assert.fail(intestazione + " non delimitata");
    };
    return new Function("return ({\n" + membro("replaceAllSpecialCharacters(str){") + ",\n" + membro("replaceAll(str, strOrigin, newStr){") + "\n});")();
}

//Le globali del Plugin per la durata di una prova.
function conGlobali(globali, prova) {
    const salvate = {};
    Object.keys(globali).forEach(k => { salvate[k] = global[k]; global[k] = globali[k]; });
    try {
        return prova();
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
}

const universaleEdro = s => fondamentaleEdro(s) != null ? { nome: s, fondamentale: fondamentaleEdro(s) } : null;

//Un tratto del box come lo da' TestoTag.trattiDiStileDelCampo: InDesign tiene gli a capo come "\r".
const tratto = (nome, contenuto) => ({ nome: nome, nomeCompleto: nome, contenuto: contenuto });

//Coop, gruppo dei sofficini: la descrizione composta dal server e l'archivio del gruppo.
const SOFFICINI = "<DESCRIZIONE_TITOLO>sofficini\nfindus</DESCRIZIONE_TITOLO><DESCRIZIONE_GRAMMATURA>\n250 g -</DESCRIZIONE_GRAMMATURA><DESCRIZIONE_TIPO> vari tipi</DESCRIZIONE_TIPO>";
const SOFFICINI_GRUPPO = ["sofficini\nfindus", "", " vari tipi", "\n250 g -"];

//Edro21: l'export aggiunge un a capo in coda ai blocchi che non ce l'hanno.
const PARMIGIANO = "<DES_descr_nome>Parmigiano Reggiano \nDOP\n</DES_descr_nome><DES_descr_marca>Parmareggio\n</DES_descr_marca><DES_descr_tipo>stagionatura 30 mesi\n</DES_descr_tipo><DES_descr_gr>250 g</DES_descr_gr>";
const PARMIGIANO_ARCHIVIO = ["Parmigiano Reggiano \nDOP\n", "Parmareggio", "stagionatura 30 mesi", "250 g"];

//L'allegato di I20-1143.
const PROFITEROLES = "<DESCRIZIONE_TITOLO>PROFITEROLES \nCIOCCOLATO</DESCRIZIONE_TITOLO>";

/* ---- il confronto per blocchi ---- */

test("una descrizione uguale a meno di spazi e a capo non ha blocchi diversi", () => {
    const box = [
        tratto("DESCRIZIONE_TITOLO", "sofficini\rfindus"),
        tratto("DESCRIZIONE_GRAMMATURA", "\r250  g -"),
        tratto("DESCRIZIONE_TIPO", " vari tipi ")
    ];
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi(box, SOFFICINI),
        { diversi: [], mancanti: [], ordineDiverso: false });
});

test("un a capo messo a mano nel box non e' una differenza", () => {
    //E' il caso dell'allegato: sul server la descrizione e' su una riga, nel box su due.
    const box = [tratto("DESCRIZIONE_TITOLO", "PROFITEROLES\rCIOCCOLATO")];
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi(box, "<DESCRIZIONE_TITOLO>PROFITEROLES CIOCCOLATO</DESCRIZIONE_TITOLO>"),
        { diversi: [], mancanti: [], ordineDiverso: false });
});

test("un blocco con un altro testo e' fra i diversi, e solo lui", () => {
    const box = [
        tratto("DESCRIZIONE_TITOLO", "PEPERONI ARROSTITI"),
        tratto("DESCRIZIONE_BRAND", " FINDUS"),
        tratto("DESCRIZIONE_GRAMMATURA", "\r400 g")
    ];
    const server = "<DESCRIZIONE_TITOLO>PEPERONI ARROSTITI</DESCRIZIONE_TITOLO><DESCRIZIONE_BRAND> OROGEL</DESCRIZIONE_BRAND><DESCRIZIONE_GRAMMATURA>\n400 g</DESCRIZIONE_GRAMMATURA>";
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi(box, server),
        { diversi: ["DESCRIZIONE_BRAND"], mancanti: [], ordineDiverso: false });
});

test("un blocco del server che nel box manca e' fra i mancanti, uno stile solo del box fra i diversi", () => {
    //Il vecchio giallo scorreva solo i tratti del box: il brand tolto non accendeva niente.
    const box = [tratto("DESCRIZIONE_TITOLO", "sofficini\rfindus"), tratto("DESCRIZIONE_GRAMMATURA", "\r250 g -"), tratto("MAX_PEZZI", "MAX 4 PEZZI")];
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi(box, SOFFICINI),
        { diversi: ["MAX_PEZZI"], mancanti: ["DESCRIZIONE_TIPO"], ordineDiverso: false });
});

test("i tratti nascosti del server e i blocchi di soli spazi non contano", () => {
    const server = "<DES_descr_nome>Parmigiano</DES_descr_nome><DES_descr_gr_$Hidden>500 g</DES_descr_gr_$Hidden><DES_descr_es></DES_descr_es>";
    const box = [tratto("DES_descr_nome", "Parmigiano"), tratto("DES_descr_es", " \r")];
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi(box, server),
        { diversi: [], mancanti: [], ordineDiverso: false });
    assert.deepStrictEqual(confronti.blocchiDelContenuto(server).map(b => b.stile), ["DES_descr_nome", "DES_descr_es"]);
});

test("i blocchi dello stesso stile valgono insieme; un ordine diverso si dice a parte", () => {
    const server = "<A>uno</A><B>due</B><A>tre</A>";
    //Lo stesso testo per stile, nello stesso ordine: niente.
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi([tratto("A", "uno"), tratto("B", "due"), tratto("A", "tre")], server),
        { diversi: [], mancanti: [], ordineDiverso: false });
    //Il vecchio giallo guardava solo il primo blocco di ogni stile: il terzo cambiato non c'era.
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi([tratto("A", "uno"), tratto("B", "due"), tratto("A", "quattro")], server).diversi, ["A"]);
    //Gli stessi blocchi in un altro ordine.
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi([tratto("B", "x"), tratto("A", "y")], "<A>y</A><B>x</B>"),
        { diversi: [], mancanti: [], ordineDiverso: true });
});

test("il tag del server si confronta col nome dello stile che indica nel documento", () => {
    const server = "<A.DES_descr_nome>Mele</A.DES_descr_nome>";
    //Senza chi risolve il tag, il gruppo si toglie.
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi([tratto("DES_descr_nome", "Mele")], server).diversi, []);
    //Con la risoluzione della preanalisi: uno stile che il documento non ha resta col suo tag.
    const nonTrovato = tag => tag;
    assert.deepStrictEqual(confronti.blocchiDescrizioneDiversi([tratto("DES_descr_nome", "Mele")], server, nonTrovato),
        { diversi: ["DES_descr_nome"], mancanti: ["A.DES_descr_nome"], ordineDiverso: false });
});

/* ---- la preanalisi ---- */

//Un campo di testo di InDesign con i suoi tratti di stile, quanto basta alla preanalisi.
function campoDescrizione(tratti) {
    return {
        isValid: true,
        label: "descrizione$DNA$BOX1$1$1$1",
        constructorName: "TextFrame",
        contents: tratti.map(t => t[1]).join(""),
        textStyleRanges: {
            everyItem: () => ({
                getElements: () => tratti.map(t => ({ contents: t[1], appliedCharacterStyle: { name: t[0], parent: null } }))
            })
        }
    };
}

function preanalisi(tratti, contenuto) {
    const salvate = { TestoTag: global.TestoTag, pluginMiddleware: global.pluginMiddleware, Utility: global.Utility };
    //Il documento non c'e': parseStile non trova niente e i tag restano come sono.
    global.TestoTag = Object.assign({}, TestoTagVero, { parseStile: () => null });
    global.pluginMiddleware = { getCampo: () => null };
    global.Utility = { parseLabel: (l) => String(l == null ? "" : l).split("$")[0], eUnClone: () => false };
    const box = { label: "BOX1", allPageItems: [campoDescrizione(tratti)] };
    return confronti.confrontoBoxCompiledFieldPreAnalisi(box, [{ labelName: "descrizione", paragraphName: "", content: contenuto }],
        [], [], null, null, false, null, null)
        .finally(() => Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } }));
}

test("la preanalisi allega alla differenza della descrizione i blocchi che non tornano", async () => {
    const esito = await preanalisi([["DESCRIZIONE_TITOLO", "PEPERONI"], ["DESCRIZIONE_BRAND", " FINDUS"]],
        "<DESCRIZIONE_TITOLO>PEPERONI</DESCRIZIONE_TITOLO><DESCRIZIONE_BRAND> OROGEL</DESCRIZIONE_BRAND>");
    assert.deepStrictEqual(esito.errors, []);
    assert.strictEqual(esito.differenze.length, 1);
    assert.strictEqual(esito.differenze[0].difference, "contenuto");
    assert.deepStrictEqual(esito.differenze[0].blocchi, { diversi: ["DESCRIZIONE_BRAND"], mancanti: [], ordineDiverso: false });
});

test("per la preanalisi un a capo in piu' nel box non e' una differenza", async () => {
    const esito = await preanalisi([["DESCRIZIONE_TITOLO", "PROFITEROLES \rCIOCCOLATO"]],
        "<DESCRIZIONE_TITOLO>PROFITEROLES CIOCCOLATO</DESCRIZIONE_TITOLO>");
    assert.deepStrictEqual(esito.differenze, []);
});

/* ---- giallo e pulsante insieme ---- */

test("con una differenza della descrizione c'e' sempre qualcosa in giallo, senza nessuna niente", () => {
    const casi = [
        [{ label: "descrizione", difference: "contenuto", blocchi: { diversi: ["DESCRIZIONE_BRAND"], mancanti: [], ordineDiverso: false } }],
        [{ label: "descrizione", difference: "contenuto", blocchi: { diversi: [], mancanti: ["DESCRIZIONE_TIPO"], ordineDiverso: false } }],
        [{ label: "descrizione", difference: "contenuto", blocchi: { diversi: [], mancanti: [], ordineDiverso: true } }],
        //La stringa intera non torna ma i blocchi si': si dice lo stesso.
        [{ label: "descrizione", difference: "contenuto", blocchi: { diversi: [], mancanti: [], ordineDiverso: false } }],
        //Una differenza vecchia, o di cui non si e' potuto chiedere: senza blocchi.
        [{ label: "descrizione", difference: "contenuto" }],
        [{ label: "descrizione", difference: "paragrafo", valoreLocale: "DESCR", valoreServer: "DESCR_SC" }]
    ];
    casi.forEach(function (differenze) {
        const giallo = schedaRef.gialloDellaDescrizione(differenze);
        assert.ok(giallo.stili.length + giallo.righe.length > 0, JSON.stringify(differenze));
    });

    assert.deepStrictEqual(schedaRef.gialloDellaDescrizione(casi[0]), { stili: ["DESCRIZIONE_BRAND"], righe: [] });
    assert.deepStrictEqual(schedaRef.gialloDellaDescrizione(casi[1]), { stili: [], righe: ["Nel box manca DESCRIZIONE_TIPO"] });
    assert.match(schedaRef.gialloDellaDescrizione(casi[5]).righe[0], /Stile di paragrafo diverso dal server: nel box DESCR, sul server DESCR_SC/);
    assert.deepStrictEqual(schedaRef.gialloDellaDescrizione([]), { stili: [], righe: [] });
    assert.deepStrictEqual(schedaRef.gialloDellaDescrizione(null), { stili: [], righe: [] });
});

test("il pulsante si accende sulle stesse differenze da cui si legge il giallo", async () => {
    const differenze = [
        { label: "Descrizione", difference: "contenuto", blocchi: { diversi: ["DESCRIZIONE_BRAND"], mancanti: [], ordineDiverso: false } },
        { label: "descrizione", difference: "non presente" },
        { label: "prezzo_promo", difference: "contenuto" }
    ];
    assert.deepStrictEqual(schedaRef.differenzeDaAllineare(differenze, "descrizione"), [differenze[0]]);
    assert.strictEqual(schedaRef.differenzaDaAllineare(differenze, "descrizione"), true);
    assert.deepStrictEqual(schedaRef.differenzeDaAllineare([differenze[1], differenze[2]], "descrizione"), []);
    assert.deepStrictEqual(schedaRef.differenzeDaAllineare(differenze, ""), []);

    //Senza box niente; se la preanalisi non si puo' chiedere, una differenza generica: pulsante
    //e riga gialla insieme.
    const records = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: "descrizione", paragraphName: "", content: PROFITEROLES }] } }];
    assert.deepStrictEqual(await schedaRef.differenzeDescrizioneDelBox(records, null), []);
    const generica = await schedaRef.differenzeDescrizioneDelBox(records, { isValid: true });
    assert.deepStrictEqual(generica, [{ label: "descrizione", difference: "contenuto" }]);
    assert.deepStrictEqual(schedaRef.gialloDellaDescrizione(generica).righe, ["La descrizione del box e' diversa da quella del server"]);
});

test("la scheda colora le caselle dal verdetto della preanalisi, non da un confronto suo", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    const inizio = sorgente.indexOf("    async attivaSchermateReferenza(");
    const fine = sorgente.indexOf("\n    },\n", inizio);
    const schermata = sorgente.substring(inizio, fine);

    //Il confronto in linea, quello che contava gli spazi, non c'e' piu'.
    assert.doesNotMatch(schermata, /previousStileInMismatch|stringaPerStile|contentObjParsedStiles\.find\(f => f\.stile == nomeCompleto\)/);
    assert.match(schermata, /var stileInMismatch = gialloDescrizione\.stili\.indexOf\(characterName\) >= 0;/);

    //Un solo verdetto per pulsante e giallo, preso dopo aver riempito un campo vuoto.
    const riempi = schermata.indexOf("this.riempiDescrizioneVuota(box, campoDescrizioneDelPrimario);");
    const decisione = schermata.indexOf("const differenzeDescrizione = segnalazioniGiaInMemoria != null && campoDescrizioneDelPrimario != null");
    assert.ok(riempi > 0 && decisione > riempi, "il campo vuoto si riempie prima di decidere");
    assert.match(schermata, /const descrizioneDaAllineare = differenzeDescrizione\.length > 0;\s*\/\/[^\n]*\n\s*const gialloDescrizione = this\.gialloDellaDescrizione\(differenzeDescrizione\);/);
    assert.match(schermata, /me\.mostraGialloDescrizione\(gialloDescrizione\.righe\);/);
});

test("le righe gialle stanno sotto i campi, una per differenza, e niente se non ce ne sono", () => {
    const aggiunti = [];
    const elementoFinto = function () {
        const el = { figli: [], testo: null };
        el.append = function (figlio) { el.figli.push(figlio); return el; };
        el.text = function (t) { el.testo = t; return el; };
        el.remove = function () { return el; };
        return el;
    };
    const salvato = global.$;
    global.$ = function (selettore) {
        if (selettore === "#editReferenza") {
            return { append: (el) => { aggiunti.push(el); } };
        }
        return elementoFinto();
    };
    try {
        assert.strictEqual(schedaRef.mostraGialloDescrizione([]), false);
        assert.strictEqual(schedaRef.mostraGialloDescrizione(null), false);
        assert.strictEqual(aggiunti.length, 0);
        assert.strictEqual(schedaRef.mostraGialloDescrizione(["Nel box manca DESCRIZIONE_TIPO", ""]), true);
        assert.strictEqual(aggiunti.length, 1);
        assert.deepStrictEqual(aggiunti[0].figli.map(f => f.testo), ["Nel box manca DESCRIZIONE_TIPO"]);
    }
    finally {
        if (salvato === undefined) { delete global.$; } else { global.$ = salvato; }
    }
});

/* ---- le descrizioni alterate dall'esportazione ---- */

test("i separatori dell'export non rendono alterata una descrizione", () => {
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(SOFFICINI, SOFFICINI_GRUPPO, fondamentaleCoop, normalizza), []);
    //Coop mette uno spazio davanti a Descrizione2: in archivio "OROGEL", composto " OROGEL".
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DESCRIZIONE_TITOLO>PEPERONI</DESCRIZIONE_TITOLO><DESCRIZIONE_BRAND> OROGEL</DESCRIZIONE_BRAND>",
        ["PEPERONI", "OROGEL", "", ""], fondamentaleCoop, normalizza), []);
    //Edro21 aggiunge l'a capo in coda.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(PARMIGIANO, PARMIGIANO_ARCHIVIO, fondamentaleEdro, normalizza), []);
    //L'allegato: l'a capo e' gia' nell'archivio.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(PROFITEROLES, ["PROFITEROLES \nCIOCCOLATO", "", "", ""], fondamentaleCoop, normalizza), []);
    //Un <br> dell'archivio e' l'a capo del composto.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DESCRIZIONE_TITOLO>BICCHIERE\nCON ROSMARINO</DESCRIZIONE_TITOLO>", ["BICCHIERE<br>CON ROSMARINO", "", "", ""], fondamentaleCoop, normalizza), []);
});

test("un testo cambiato, nascosto o tolto dall'export e' un'alterazione", () => {
    //Edro21 nasconde la grammatura.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DES_descr_nome>Parmigiano</DES_descr_nome><DES_descr_gr_$Hidden>500 g</DES_descr_gr_$Hidden>",
        ["Parmigiano", "", "", "500 g"], fondamentaleEdro, normalizza), ["descrizione4"]);
    //Edro21 non la mette proprio.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DES_descr_nome>Parmigiano</DES_descr_nome>", ["Parmigiano", "", "", "500 g"], fondamentaleEdro, normalizza), ["descrizione4"]);
    //L'export accoda un testo a un blocco.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DES_descr_nome>Pizza</DES_descr_nome><DES_descr_tipo>margherita\n\ndisponibile anche Take Away</DES_descr_tipo>",
        ["Pizza", "", "margherita", ""], fondamentaleEdro, normalizza), ["descrizione3"]);
    //Un membro di gruppo Coop composto con la propria descrizione, con l'archivio del gruppo.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(
        "<DESCRIZIONE_TITOLO>Sofficini pomodoro piu' mozzarella</DESCRIZIONE_TITOLO><DESCRIZIONE_BRAND>\nFINDUS</DESCRIZIONE_BRAND>",
        SOFFICINI_GRUPPO, fondamentaleCoop, normalizza), ["descrizione1", "descrizione2", "descrizione3", "descrizione4"]);
});

test("senza contenuto o senza stili riconosciuti non si giudica", () => {
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(null, SOFFICINI_GRUPPO, fondamentaleCoop, normalizza), []);
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione("", SOFFICINI_GRUPPO, fondamentaleCoop, normalizza), []);
    //Stili che l'agenzia non dichiara: dirle alterate tutte bloccherebbe la scheda.
    assert.deepStrictEqual(confronti.fondamentaliAlterateDaEsportazione(SOFFICINI, SOFFICINI_GRUPPO, () => null, normalizza), []);
});

test("il testo composto per ciascuna fondamentale, con i suoi spazi e a capo", () => {
    assert.deepStrictEqual(confronti.testiDelleFondamentali(SOFFICINI, fondamentaleCoop, normalizza),
        { descrizione1: "sofficini\nfindus", descrizione4: "\n250 g -", descrizione3: " vari tipi" });
    assert.deepStrictEqual(confronti.testiDelleFondamentali(PARMIGIANO, fondamentaleEdro, normalizza).descrizione2, "Parmareggio\n");
    assert.deepStrictEqual(confronti.testiDelleFondamentali(null, fondamentaleCoop, normalizza), {});
});

test("nella scheda una descrizione alterata ha la sua nota, e col meta non si giudica, con le funzioni vere di Utility", () => {
    //schedaRef.js trova confronti fra le globali, come nel Plugin; Utility e' quella vera.
    conGlobali({ pluginMiddleware: { getNameStileUniversale: universaleEdro }, Utility: utilityVera(), confronti: confronti, messaggioUtente: () => {} }, () => {
        const records = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: "descrizione", paragraphName: "", content: "<DES_descr_nome>Parmigiano\nDOP</DES_descr_nome>" }] } }];
        const scheda = Object.create(schedaRef);
        scheda.statoMetaDescrizione = () => null;
        //Il <br> dell'archivio e' l'a capo del composto: alterata e' solo la grammatura tolta.
        assert.deepStrictEqual(scheda.descrizioniAlterateDaEsportazione(records, ["Parmigiano<br>DOP", "", "", "500 g"]),
            [{ fondamentale: "descrizione4", nota: "Descrizione4 (Alterato da logiche agenzia)" }]);

        scheda.statoMetaDescrizione = () => ({ label: "descrizione", allineato: false });
        assert.deepStrictEqual(scheda.descrizioniAlterateDaEsportazione(records, ["Parmigiano<br>DOP", "", "", "500 g"]), []);

        //Il testo composto che il salvataggio confronta.
        assert.deepStrictEqual(scheda.testiCompostiDelPrimario(records), { descrizione1: "Parmigiano\nDOP" });
    });
});

test("se il calcolo delle descrizioni alterate o dei testi composti non riesce, la scheda si apre come prima", () => {
    const avvisi = [];
    const guasto = () => { throw new Error("stile illeggibile"); };
    conGlobali({ pluginMiddleware: { getNameStileUniversale: guasto }, Utility: utilityVera(), confronti: confronti,
        messaggioUtente: (testo, tipo) => { avvisi.push(tipo + ": " + testo); } }, () => {
        const records = [{ recordInTracciato: { StatoSelezione: 1, compiledFields: [{ labelName: "descrizione", paragraphName: "", content: "<DES_descr_nome>Parmigiano</DES_descr_nome>" }] } }];
        const scheda = Object.create(schedaRef);
        scheda.statoMetaDescrizione = () => null;
        //Nessuna alterata e nessun testo composto: il salvataggio torna al confronto di prima.
        assert.deepStrictEqual(scheda.descrizioniAlterateDaEsportazione(records, ["Parmigiano", "", "", "500 g"]), []);
        assert.strictEqual(scheda.testiCompostiDelPrimario(records), null);
    });
    //E l'operatore lo sa, invece di restare davanti al caricamento.
    assert.strictEqual(avvisi.length, 2);
    avvisi.forEach(a => assert.match(a, /^warning: Code SRF-133 /));
});

test("l'archivio della scheda e' quello del gruppo per un membro di un gruppo", () => {
    const primario = { recordInTracciato: {
        "Descrizioni.Descrizione1": "Sofficini pomodoro", "Descrizioni.DescrizioneIndd": "<x>",
        descrizione_gruppo: { "Descrizioni.Descrizione1": "sofficini\nfindus", "Descrizioni.Descrizione4": "\n250 g -", "Descrizioni.DescrizioneIndd": "<g>" }
    } };
    assert.deepStrictEqual(schedaRef.archivioDescrizioneDelPrimario(primario, { codice: "1121207", codice_gruppo: "1121204,1121207" }),
        ["sofficini\nfindus", undefined, undefined, "\n250 g -", "<g>"]);
    assert.deepStrictEqual(schedaRef.archivioDescrizioneDelPrimario(primario, { codice: "1121207", codice_gruppo: "1121207" })[0], "Sofficini pomodoro");
    assert.deepStrictEqual(schedaRef.archivioDescrizioneDelPrimario(null, null), [null, null, null, null, null]);
});

test("le descrizioni alterate vanno in sola lettura come quelle dell'agenzia, con la nota anche senza casella", () => {
    const sorgente = leggiFileDelPlugin("schedaRef.js").replace(/\r/g, "");
    assert.match(sorgente, /var descrizioniAlterate = this\.descrizioniAlterateDaEsportazione\(this\.schedeRefDati, archivioDescrizione\)/);
    assert.match(sorgente, /descrizioniInSolaLettura = descrizioniInSolaLettura\.concat\(descrizioniAlterate\);\s*me\.noteSolaLetturaDaMostrare = \[\];/);
    assert.match(sorgente, /descrizioniAlterate\.forEach\(function \(alterata\) \{\s*me\.segnaCasellaInSolaLettura\(null, alterata\);/);
    //Il controller le riceve fra quelle da non toccare, e con loro i testi composti.
    assert.match(sorgente, /new InputEditController\(\$\("#editReferenza"\), convalidaFirmaRevisione, archivioDelController, compiledFields, descrizioniInSolaLettura\.map\(function \(d\) \{ return d\.fondamentale; \}\), me\.testiCompostiDelPrimario\(me\.schedeRefDati\)\);/);
});

/* ---- il salvataggio ---- */

function voce(fondamentale, valore) {
    return { stile: fondamentale, fondamentale: fondamentale, valore: valore, modificato: false, nascosto: false };
}

test("uno spazio o un a capo cambiato rispetto al testo composto parte col suo testo", () => {
    const archivio = ["PROFITEROLES CIOCCOLATO", "", "", ""];
    const composto = { descrizione1: "PROFITEROLES CIOCCOLATO" };
    const decise = InputEditController.decidiFondamentali([voce("descrizione1", "PROFITEROLES\nCIOCCOLATO")], archivio, { composto: composto });
    assert.strictEqual(decise.valori.descrizione1, "PROFITEROLES\nCIOCCOLATO");
    assert.deepStrictEqual(decise.cambiati, ["descrizione1"]);

    //Uguale al composto: non toccata.
    const uguale = InputEditController.decidiFondamentali([voce("descrizione1", "PROFITEROLES CIOCCOLATO")], archivio, { composto: composto });
    assert.strictEqual(uguale.valori.descrizione1, NON_TOCCATO);
    assert.deepStrictEqual(uguale.cambiati, []);
});

test("i separatori dell'export non sono una modifica, toglierli si'", () => {
    //Coop: "DIXAN" in archivio, " DIXAN" nel composto e nel box.
    const archivio = ["DETERSIVO", "DIXAN", "", ""];
    const composto = { descrizione1: "DETERSIVO", descrizione2: " DIXAN" };
    const intatta = InputEditController.decidiFondamentali([voce("descrizione1", "DETERSIVO"), voce("descrizione2", " DIXAN")], archivio, { composto: composto });
    assert.strictEqual(intatta.valori.descrizione2, NON_TOCCATO);
    assert.deepStrictEqual(intatta.cambiati, []);

    //Il brand mandato a capo dall'operatore.
    const aCapo = InputEditController.decidiFondamentali([voce("descrizione1", "DETERSIVO"), voce("descrizione2", "\nDIXAN")], archivio, { composto: composto });
    assert.strictEqual(aCapo.valori.descrizione2, "\nDIXAN");
    assert.deepStrictEqual(aCapo.cambiati, ["descrizione2"]);
});

test("gli a capo di InDesign e della textarea, e lo spazio unificatore, non sono una differenza", () => {
    assert.strictEqual(InputEditController.testoEsatto("a\r\nb\rc\u2028d"), "a\nb\nc\nd");
    assert.strictEqual(InputEditController.testoEsatto("a\u00a0b"), "a b");
    assert.strictEqual(InputEditController.testoEsatto(null), "");
    //Il box tiene l'a capo come "\r", il composto come "\n": e' lo stesso testo.
    const decise = InputEditController.decidiFondamentali([voce("descrizione4", "\r250 g -")], ["", "", "", "250 g -"], { composto: { descrizione4: "\n250 g -" } });
    assert.strictEqual(decise.valori.descrizione4, NON_TOCCATO);
});

test("un testo cambiato parte come prima, e le fondamentali da non toccare restano non toccate", () => {
    const archivio = ["PEPERONI", "OROGEL", "", "400 g"];
    const composto = { descrizione1: "PEPERONI", descrizione2: " OROGEL", descrizione4: "\n400 g" };
    const decise = InputEditController.decidiFondamentali(
        [voce("descrizione1", "PEPERONI\nARROSTITI"), voce("descrizione2", " FINDUS"), voce("descrizione4", "\n500 g")],
        archivio, { composto: composto, nonToccare: ["descrizione4"] });
    assert.strictEqual(decise.valori.descrizione1, "PEPERONI\nARROSTITI");
    assert.strictEqual(decise.valori.descrizione2, " FINDUS");
    assert.strictEqual(decise.valori.descrizione4, NON_TOCCATO);
});

test("il Salva si accende per un a capo cambiato rispetto al testo composto", () => {
    const salvate = { $: global.$, TestoTag: global.TestoTag, pluginMiddleware: global.pluginMiddleware };
    global.TestoTag = TestoTagVero;
    global.pluginMiddleware = { getNameStileUniversale: (s) => fondamentaleCoop(s) != null ? { nome: s, fondamentale: fondamentaleCoop(s) } : null };
    global.$ = function (el) {
        return { attr: (nome) => nome === "currentcharacterstyle" ? el.stile : undefined, hasClass: () => false, val: () => el.testo };
    };
    try {
        const controller = function (testo) {
            const c = Object.create(InputEditController.prototype);
            c.datasource = { descrizione: { modificato: false, lista: [{ stile: "DESCRIZIONE_TITOLO", testo: testo }] } };
            c.descrInArchivio = ["PROFITEROLES CIOCCOLATO", "", "", ""];
            c.fondamentaliInSolaLettura = [];
            c.testiComposti = { descrizione1: "PROFITEROLES CIOCCOLATO" };
            return c;
        };
        assert.strictEqual(controller("PROFITEROLES\nCIOCCOLATO").descrizioneDiversaDallArchivio(), true);
        assert.strictEqual(controller("PROFITEROLES CIOCCOLATO").descrizioneDiversaDallArchivio(), false);
    }
    finally {
        Object.keys(salvate).forEach(k => { if (salvate[k] === undefined) { delete global[k]; } else { global[k] = salvate[k]; } });
    }
});

test("il controller manda i testi composti al salvataggio, e il pannello del mismatch salta le fondamentali in sola lettura", () => {
    const sorgente = leggiFileDelPlugin("InputEditController.js").replace(/\r/g, "");
    assert.match(sorgente, /constructor\(container, convalidaFirma, descrInArchivio, compiledFields = null, fondamentaliInSolaLettura = \[\], testiComposti = null\)/);
    assert.match(sorgente, /decidiFondamentali\(voci, this\.descrInArchivio, \{ nonToccare: this\.fondamentaliInSolaLettura, composto: this\.testiComposti \}\)/);
    assert.match(sorgente, /nonToccare: this\.fondamentaliInSolaLettura, composto: this\.testiComposti \}\);\s*Object\.assign\(operazioni\.revisione, decise\.valori\);/);
    //Il pannello arancione: una fondamentale in sola lettura - per l'agenzia o alterata - non si confronta.
    for (let n = 1; n <= 4; n++) {
        assert.match(sorgente, new RegExp("if \\(siConfronta\\(" + n + "\\) && TestoTag\\.trimDescrizione\\(this\\.descrInArchivio\\[" + (n - 1) + "\\]\\) != TestoTag\\.trimDescrizione\\(descr" + n + "InPage\\)\\)"));
    }
    assert.match(sorgente, /const siConfronta = n => !this\.fondamentaliInSolaLettura\.includes\("descrizione" \+ n\);/);
});
