/*
 * I20-1069, gruppo 3: il revisore web dice perche' una chiamata a Istanta non e' andata bene.
 *
 * Call.do passava ai chiamanti le risposte 200 senza guardarne l'esito, e sugli errori HTTP metteva in
 * error il testo di stato di jQuery ("error") e il motivo del server in message. Il revisore non leggeva
 * nessuno dei due: la lista con un errore dava un TypeError su result.data e lo spinner restava acceso,
 * e il salvataggio fallito mostrava solo la parola "error".
 *
 * call.js e revisore.js si caricano sotto Node (module.exports); il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Call = require("../../Istanta/wwwroot/js/call.js");
const Revisore = require("../../Istanta/wwwroot/js/revisore.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

/* ---- il motivo di una risposta ---- */

test("su un errore HTTP il motivo e' quello del server, non il testo di stato di jQuery", () => {
    const dettagli = { info: { status: 500 }, error: "error", message: "Salvate 1 revisioni su 3, ferma su 6322946. salva, estrazione del garante: ..." };
    assert.strictEqual(Call.motivoDellErrore(dettagli), dettagli.message);
});

test("senza risposta del server il motivo e' quello della connessione che Call.do ha gia' scritto", () => {
    const dettagli = { info: { status: 0 }, error: "error", message: "Riscontrati problemi con la connessione, impossibile portare a termine l'operazione!" };
    assert.strictEqual(Call.motivoDellErrore(dettagli), dettagli.message);
    assert.strictEqual(Call.motivoDellErrore(null), "Istanta non ha risposto");
});

test("una risposta 200 con esito negativo da' il suo error, comunque si chiami l'esito", () => {
    assert.strictEqual(Call.motivoDellErrore({ Esito: false, error: "la promo 41 non esiste." }), "la promo 41 non esiste.");
    assert.strictEqual(Call.motivoDellErrore({ esito: false, error: "x" }), "x");
    assert.strictEqual(Call.motivoDellErrore({ esito: false, error: "" }), "operazione non riuscita, senza motivo");
});

test("la lista del revisore con error valorizzato e' un errore, senza error e' buona", () => {
    assert.strictEqual(Call.motivoDellErrore({ data: [], error: "getListaRevisione2, lettura della promo: la promo 41 non esiste." }),
        "getListaRevisione2, lettura della promo: la promo 41 non esiste.");
    assert.strictEqual(Call.motivoDellErrore({ data: [{ idRec: 1 }], error: null }), null);
    assert.strictEqual(Call.motivoDellErrore({ data: [], error: "" }), null);
});

test("le risposte buone non hanno motivo: liste, esiti positivi, testi", () => {
    assert.strictEqual(Call.motivoDellErrore([{ codice: "6322946" }]), null);
    assert.strictEqual(Call.motivoDellErrore({ esito: true, error: "" }), null);
    assert.strictEqual(Call.motivoDellErrore("ok"), null);
});

test("una risposta 200 con esito negativo finisce in console con il suo dettaglio, e la callback la riceve come prima", () => {
    const scritti = [];
    const salvato = console.error;
    console.error = (...argomenti) => scritti.push(argomenti.join(" "));
    try {
        Call.registraEsitoNegativo("Revisore/elimina", { esito: false, error: "x", dettaglio: "System.Exception: x\n   at ..." });
        Call.registraEsitoNegativo("Revisore/salva", [{ codice: "1" }]);
    }
    finally {
        console.error = salvato;
    }
    assert.strictEqual(scritti.length, 2);
    assert.match(scritti[0], /Revisore\/elimina.*x/);
    assert.match(scritti[1], /System\.Exception: x/);

    const call = sorgente("Istanta/wwwroot/js/call.js");
    assert.match(call, /success: function \(data\) \{[\s\S]*?Call\.registraEsitoNegativo\(address, data\);\s*callback\(data, sender\);/);
    assert.match(call, /if \(data && data\.responseJSON && data\.responseJSON\.dettaglio\) \{\s*console\.error\(/);
});

/* ---- il revisore ---- */

function conPagina(prova) {
    const salvati = { Call: global.Call, mostraMessaggio: global.mostraMessaggio, hideLoading: global.hideLoading };
    const pagina = { messaggi: [], spento: 0 };
    global.Call = Call;
    global.mostraMessaggio = (testo, tipo) => pagina.messaggi.push({ testo, tipo });
    global.hideLoading = () => { pagina.spento++; };
    const errore = console.error;
    console.error = () => {};
    try {
        prova(pagina);
    }
    finally {
        console.error = errore;
        Object.keys(salvati).forEach(k => { if (salvati[k] === undefined) { delete global[k]; } else { global[k] = salvati[k]; } });
    }
}

test("una risposta d'errore si dice all'operatore, spegne il caricamento e ferma il chiamante", () => {
    conPagina((pagina) => {
        const fermato = Revisore.mostraErroreDellaChiamata({ data: [], error: "getListaRevisione2, lettura della promo: la promo 41 non esiste." }, "Lista del revisore non caricata");
        assert.strictEqual(fermato, true);
        assert.deepStrictEqual(pagina.messaggi, [{ testo: "Lista del revisore non caricata: getListaRevisione2, lettura della promo: la promo 41 non esiste.", tipo: "danger" }]);
        assert.strictEqual(pagina.spento, 1);
    });
});

test("una risposta buona passa senza messaggi e senza spegnere niente", () => {
    conPagina((pagina) => {
        assert.strictEqual(Revisore.mostraErroreDellaChiamata({ data: [{ idRec: 1 }], error: null }, "Lista del revisore non caricata"), false);
        assert.deepStrictEqual(pagina.messaggi, []);
        assert.strictEqual(pagina.spento, 0);
    });
});

test("tutte le chiamate del revisore guardano la risposta prima di usarla", () => {
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js");
    const chiamate = [...revisore.matchAll(/^\s*Call\.do\("(\w+)", "([^"]+)"[^\n]*function \(result, sender\) \{\n/gm)];
    assert.strictEqual(chiamate.length, 10, "le chiamate del revisore sono cambiate: il test va aggiornato");

    for (const chiamata of chiamate) {
        //Il controllo sta nelle prime righe della callback, prima di usare result.
        const corpo = revisore.substring(chiamata.index + chiamata[0].length, chiamata.index + chiamata[0].length + 700);
        const usaIlMotivo = /Revisore\.mostraErroreDellaChiamata\(result, "[^"]+"\)\) return;/.test(corpo)
            || /let _msg = Call\.motivoDellErrore\(result\) \|\| "Salvataggio non riuscito";/.test(corpo);
        assert.ok(usaIlMotivo, chiamata[1] + "/" + chiamata[2] + " non guarda la risposta");
    }
});

test("la lista del revisore si ferma sull'errore prima di toccare result.data", () => {
    //Senza le righe di commento: quello di I20-1069 cita result.data per spiegare cosa succedeva prima.
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js").split("\n").filter(riga => !riga.trim().startsWith("//")).join("\n");
    const inizio = revisore.indexOf('Call.do("Revisore", "getListaRevisione2"');
    const controllo = revisore.indexOf('if (Revisore.mostraErroreDellaChiamata(result, "Lista del revisore non caricata")) return;', inizio);
    const primoUso = revisore.indexOf("result.data", inizio);
    assert.ok(controllo > inizio && primoUso > controllo);
});

test("il salvataggio mostra il motivo del server e non la parola error", () => {
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js");
    const salva = revisore.substring(revisore.indexOf('Call.do("Revisore", "salva/"'), revisore.indexOf("//creo il messaggio", revisore.indexOf('Call.do("Revisore", "salva/"')));
    assert.match(salva, /let _msg = Call\.motivoDellErrore\(result\) \|\| "Salvataggio non riuscito";/);
    assert.doesNotMatch(salva, /result\.error \? result\.error/);
});
