/*
 * I20-1252: "Struttura sottogruppo" e gruppo padre nella vista Sottogruppi del revisore.
 *
 * L'intestazione di un sottogruppo e' una riga costruita dal client, senza un record suo (idRec 0).
 * La finestra cercava il record per idRec e trovava sempre la prima intestazione della lista: dal
 * sottogruppo 3747688,6354030,6354044 mostrava 15862 e 539753, il primo sottogruppo della pagina.
 * Dall'intestazione ora il titolo e' il codice del sottogruppo e l'elenco ne ha tutti gli articoli.
 * E il codice del gruppo padre era un collegamento a SchedaArticolo?id= senza id: pagina d'errore.
 *
 * revisore.js si carica sotto Node; il resto si controlla sul sorgente.
 *
 * Esecuzione: node --test tests/istanta-web/*.test.js
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const Revisore = require("../../Istanta/wwwroot/js/revisore.js");

function sorgente(relativo) {
    return fs.readFileSync(path.join(__dirname, "..", "..", relativo), "utf8").replace(/\r/g, "");
}

function tratto(testo, inizio, fine) {
    const da = testo.indexOf(inizio);
    assert.ok(da >= 0, "manca " + inizio);
    const a = testo.indexOf(fine, da + inizio.length);
    assert.ok(a > da, "manca " + fine + " dopo " + inizio);
    return testo.substring(da, a);
}

const SG_PRIMO = "15862,539753";
const SG_SECONDO = "3747688,6354030,6354044";

function intestazione(sottogruppo, gruppo) {
    return {
        idRec: 0,
        isGruppo: true,
        recordInTracciato: {
            "Scatto.CodiceGruppo": sottogruppo,
            "Scatto.CodiceSottogruppo": sottogruppo,
            gruppoOriginaleAppartenenza: gruppo
        }
    };
}

function riga(ref, idRec, sottogruppo, gruppo, statoSelezione = 2) {
    return {
        idRec: idRec,
        isGruppo: false,
        recordInTracciato: {
            "Referenza.Codice": ref,
            "Scatto.CodiceGruppo": gruppo,
            "Scatto.CodiceSottogruppo": sottogruppo,
            "StatoSelezione": statoSelezione,
            idRec: idRec
        }
    };
}

/// La lista della vista Sottogruppi come la costruisce costruisciListaSottogruppi: per ogni
/// sottogruppo l'intestazione e poi i suoi articoli, nell'ordine dei gruppi d'origine.
function listaVistaSottogruppi() {
    return [
        intestazione(SG_PRIMO, "103902,15862,539753"),
        riga("15862", 11, SG_PRIMO, "103902,15862,539753"),
        riga("539753", 12, SG_PRIMO, "103902,15862,539753"),
        intestazione(SG_SECONDO, "1248990,3747688,6354030,6354044"),
        riga("3747688", 21, SG_SECONDO, "1248990,3747688,6354030,6354044"),
        riga("6354030", 22, SG_SECONDO, "1248990,3747688,6354030,6354044"),
        riga("6354044", 23, SG_SECONDO, "1248990,3747688,6354030,6354044")
    ];
}

/* ---- il record della finestra ---- */

test("l'intestazione del secondo sottogruppo apre la finestra su un suo articolo, non sul primo sottogruppo", () => {
    const lista = listaVistaSottogruppi();

    //La riga porta id_rec="0", is_gruppo="true" e il codice del sottogruppo, come nel DOM.
    const elemento = Revisore.elementoFinestraSottogruppo(lista, "0", true, SG_SECONDO, true);

    assert.ok(elemento != null);
    assert.strictEqual(elemento.isGruppo, false);
    assert.strictEqual(elemento.recordInTracciato["Scatto.CodiceSottogruppo"], SG_SECONDO);
    assert.strictEqual(elemento.recordInTracciato["Referenza.Codice"], "3747688");
    //Prima: la prima riga con idRec 0, cioe' l'intestazione del primo sottogruppo.
    assert.notStrictEqual(elemento, lista.find(f => f.idRec == "0"));
});

test("con un primario nel sottogruppo la finestra si apre su di lui", () => {
    const lista = listaVistaSottogruppi();
    lista[5].recordInTracciato.StatoSelezione = 1;

    const elemento = Revisore.elementoFinestraSottogruppo(lista, "0", true, SG_SECONDO, true);

    assert.strictEqual(elemento.recordInTracciato["Referenza.Codice"], "6354030");
});

test("una riga di referenza resta il record con il suo idRec, come prima", () => {
    const lista = listaVistaSottogruppi();

    assert.strictEqual(Revisore.elementoFinestraSottogruppo(lista, "22", false, SG_SECONDO, true), lista[5]);
    //Un gruppo con un record suo (vista normale) resta quel record.
    const gruppo = { idRec: 99, isGruppo: true, recordInTracciato: { "Scatto.CodiceGruppo": "1,2" } };
    assert.strictEqual(Revisore.elementoFinestraSottogruppo([gruppo], "99", true, "1,2", false), gruppo);
});

test("un gruppo costruito senza record nella vista normale usa un articolo del gruppo", () => {
    const lista = [riga("1", 31, null, "1,2"), riga("2", 32, null, "1,2", 1)];

    //Il gruppo costruito da costruisciGruppo non ha id_rec: attr restituisce undefined.
    const elemento = Revisore.elementoFinestraSottogruppo(lista, undefined, true, "1,2", false);

    assert.strictEqual(elemento.recordInTracciato["Referenza.Codice"], "2");
});

test("senza articoli del sottogruppo non c'e' nessun record, e niente errore", () => {
    assert.strictEqual(Revisore.elementoFinestraSottogruppo(listaVistaSottogruppi(), "0", true, "9,9", true), null);
    assert.strictEqual(Revisore.elementoFinestraSottogruppo(null, "0", true, SG_SECONDO, true), null);
    assert.strictEqual(Revisore.elementoFinestraSottogruppo(listaVistaSottogruppi(), "777", false, null, true), null);
});

/* ---- la finestra aperta dall'intestazione: tutti gli articoli ---- */

test("solo le righe di gruppo senza record sono intestazioni", () => {
    assert.strictEqual(Revisore.rigaSenzaRecord("0", true), true);
    assert.strictEqual(Revisore.rigaSenzaRecord(undefined, true), true);
    assert.strictEqual(Revisore.rigaSenzaRecord("", true), true);
    assert.strictEqual(Revisore.rigaSenzaRecord("99", true), false);
    assert.strictEqual(Revisore.rigaSenzaRecord("0", false), false);
});

test("ogni articolo del sottogruppo ha come pilota un altro articolo, mai se stesso", () => {
    const lista = listaVistaSottogruppi();
    const membri = lista.filter(f => !f.isGruppo && f.recordInTracciato["Scatto.CodiceSottogruppo"] === SG_SECONDO);
    const pilotaFinestra = Revisore.elementoFinestraSottogruppo(lista, "0", true, SG_SECONDO, true);

    //Anche il pilota della finestra e' nell'elenco, con un pilota suo: era lui che mancava.
    membri.forEach(item => {
        const pilota = Revisore.pilotaDellaRiga(membri, item, pilotaFinestra);
        assert.notStrictEqual(pilota, item);
        assert.strictEqual(pilota.recordInTracciato["Scatto.CodiceSottogruppo"], SG_SECONDO);
    });
    //Senza altri articoli resta il pilota della finestra.
    assert.strictEqual(Revisore.pilotaDellaRiga([membri[0]], membri[0], pilotaFinestra), pilotaFinestra);
});

/* ---- i punti del codice ---- */

test("il pulsante usa il record della riga cliccata, e dall'intestazione titolo ed elenco sono il sottogruppo intero", () => {
    const revisore = sorgente("Istanta/wwwroot/js/revisore.js");
    const daSender = tratto(revisore, "    ApriFinestraSottogruppoDaSender(sender) {", "    static rigaSenzaRecord(");
    const apri = tratto(revisore, "    ApriFinestraSottogruppo(idRec, element = null, intestazione = null) {", "    ModificaSottogruppoDaSender(sender) {");
    const modifica = tratto(revisore, "    ModificaSottogruppoDaSender(sender) {", "    ModificaSottogruppo(idRec, idRecPilota, add) {");

    assert.match(daSender, /Revisore\.elementoFinestraSottogruppo\(this\.List, riga\.attr\("id_rec"\), riga\.attr\("is_gruppo"\) == "true",\s*riga\.attr\("codice_gruppo"\), this\.modalitaSottogruppi\)/);
    assert.match(daSender, /let intestazione = Revisore\.rigaSenzaRecord\(riga\.attr\("id_rec"\), riga\.attr\("is_gruppo"\) == "true"\) \? riga\.attr\("codice_gruppo"\) : null;/);
    assert.match(daSender, /this\.ApriFinestraSottogruppo\(element\.idRec, element, intestazione\);/);
    //Il titolo si scrive sempre: con undefined .text() leggeva e restava quello di prima.
    assert.match(apri, /#costruisciSottogruppoTitle"\)\.text\(String\(\(intestazione != null \? intestazione : element\.recordInTracciato\[keyRefCodice\]\) \?\? ""\)\);/);
    //Dall'intestazione anche il pilota della finestra e' nell'elenco, con il suo pilota.
    assert.match(apri, /if \(item != element \|\| intestazione != null\) \{/);
    assert.match(apri, /htmlItem\.attr\("idRecPilota", Revisore\.pilotaDellaRiga\(groupElements, item, element\)\.idRec\);/);
    assert.match(modifica, /let idRecPilota = record\.attr\("idRecPilota"\) \|\| \$\('#costruisciSottogruppoModal'\)\.find\("#costruisciSottogruppoTitle"\)\.attr\("idRec"\);/);
});

test("il pulsante Struttura sottogruppo e' nascosto per ora, ma c'e' ancora e la finestra pure", () => {
    const vista = sorgente("Istanta/Views/Revisore/Index.cshtml");
    const intestazioneRazor = tratto(vista, "@{", "\n}");

    //L'interruttore, nel blocco in cima alla pagina: true lo rimette.
    assert.match(intestazioneRazor, /bool strutturaSottogruppoVisibile = false;/);
    assert.match(vista, /<input id="sottogruppoButton" type="submit" value="Struttura sottogruppo"[^>]* hidden="@\(!strutturaSottogruppoVisibile\)" \/>/);
    //Il gestore e la finestra restano, per quando il pulsante tornera'.
    assert.match(sorgente("Istanta/wwwroot/js/components.js"), /htmlItem\.find\("#sottogruppoButton"\)\.on\("click", function \(\) \{\s*revInstance\.ApriFinestraSottogruppoDaSender\(\$\(this\)\);/);
    assert.match(sorgente("Istanta/wwwroot/js/revisore.js"), /    ApriFinestraSottogruppo\(idRec, element = null, intestazione = null\) \{/);
});

test("il codice del gruppo padre non e' un collegamento", () => {
    const vista = sorgente("Istanta/Views/Revisore/Index.cshtml");
    const padre = tratto(vista, '<template id="gruppoDelSottogruppo">', "</template>");

    assert.doesNotMatch(padre, /<a id="a_scheda_articolo"/);
    assert.doesNotMatch(padre, /SchedaArticolo\?id=/);
    //Il JS ci scrive ancora il codice, e l'icona per copiarlo resta.
    assert.match(padre, /<span id="a_scheda_articolo"><b>COD REF<\/b><\/span>/);
    assert.match(padre, /<i class="fas fa-copy"><\/i>/);
});
