// I20-968: logica del modal noRender del Plugin.
// Il modulo non tocca InDesign, quindi gira sotto il test runner di Node come previsto
// dal workflow di verifica.
const test = require("node:test");
const assert = require("node:assert");

const fs = require("node:fs");
const path = require("node:path");

const NoRenderElementi = require("../../plugin/noRenderElementi.js");

const cartellaPlugin = path.join(__dirname, "..", "..", "plugin");

function sorgentePlugin(nomeFile) {
    return fs.readFileSync(path.join(cartellaPlugin, nomeFile), "utf8");
}

test("la label della foto primaria diventa tipo foto piu' codice referenza", () => {
    const classificato = NoRenderElementi.classificaLabel("immagine$3150596");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO_FOTO);
    assert.strictEqual(classificato.chiave, "3150596");
});

test("la label di un logo porta la sigla e il tipo logo", () => {
    const classificato = NoRenderElementi.classificaLabel("foto_extra$logo_bio$tipo_3");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO.logo);
    assert.strictEqual(classificato.chiave, "logo_bio");
});

test("una foto extra che non e' un logo resta foto extra", () => {
    const classificato = NoRenderElementi.classificaLabel("sfondo$sfondo_vn$tipo_5");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO.fotoExtra);
    assert.strictEqual(classificato.chiave, "sfondo_vn");
});

test("un campo del box senza prefisso noto e' un campo, con la sua label per chiave", () => {
    const classificato = NoRenderElementi.classificaLabel("PIEDE_Titolari");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO.campo);
    assert.strictEqual(classificato.chiave, "PIEDE_Titolari");
});

test("la label vuota non produce un elemento", () => {
    assert.strictEqual(NoRenderElementi.classificaLabel(""), null);
    assert.strictEqual(NoRenderElementi.classificaLabel(null), null);
});

test("il logo si mostra con nome e sigla", () => {
    const descrizione = NoRenderElementi.descriviElemento({
        tipo: NoRenderElementi.TIPO.logo,
        chiave: "logo_bio",
        nome: "Logo biologico"
    });

    assert.strictEqual(descrizione, "Logo biologico (logo_bio)");
});

test("l'immagine si mostra col nome della foto", () => {
    const descrizione = NoRenderElementi.descriviElemento({
        tipo: NoRenderElementi.TIPO_FOTO,
        chiave: "3150596",
        nome: "primaria.psd"
    });

    assert.strictEqual(descrizione, "primaria.psd");
});

test("un logo senza nome ripiega sulla sigla", () => {
    const descrizione = NoRenderElementi.descriviElemento({
        tipo: NoRenderElementi.TIPO.logo,
        chiave: "logo_bio",
        nome: ""
    });

    assert.strictEqual(descrizione, "logo_bio");
});

test("la lista unisce gli elementi vivi e quelli marcati spariti dal documento", () => {
    const vivi = [
        { tipo: NoRenderElementi.TIPO.campo, chiave: "PIEDE_Titolari", nome: "PIEDE_Titolari" },
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }
    ];
    const marcati = [
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" },
        { tipo: NoRenderElementi.TIPO.fotoExtra, chiave: "sfondo_vn", nome: "Sfondo" }
    ];

    const lista = NoRenderElementi.componiLista(vivi, marcati);

    assert.strictEqual(lista.length, 3);

    const campo = lista.find(e => e.chiave === "PIEDE_Titolari");
    assert.strictEqual(campo.presente, true);
    assert.strictEqual(campo.noRender, false);

    const logo = lista.find(e => e.chiave === "logo_bio");
    assert.strictEqual(logo.presente, true);
    assert.strictEqual(logo.noRender, true);

    // Cancellato dai livelli ma ancora marcato: resta in elenco, altrimenti non si potrebbe liberare.
    const sparito = lista.find(e => e.chiave === "sfondo_vn");
    assert.strictEqual(sparito.presente, false);
    assert.strictEqual(sparito.noRender, true);
});

test("il payload porta solo gli elementi marcati e non le foto", () => {
    const lista = [
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", noRender: true },
        { tipo: NoRenderElementi.TIPO.campo, chiave: "PIEDE_Titolari", nome: "PIEDE_Titolari", noRender: false },
        { tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", nome: "primaria.psd", noRender: true }
    ];

    const elementi = NoRenderElementi.elementiDaSalvare(lista);

    assert.strictEqual(elementi.length, 1);
    assert.strictEqual(elementi[0].chiave, "logo_bio");
    assert.strictEqual(elementi[0].noRender, undefined);
});

test("senza elementi marcati il payload e' vuoto", () => {
    const lista = [
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", noRender: false }
    ];

    assert.deepStrictEqual(NoRenderElementi.elementiDaSalvare(lista), []);
});

test("le foto viaggiano a parte, col loro stato di rendering", () => {
    const lista = [
        { tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", nome: "primaria.psd", noRender: true },
        { tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150599", nome: "secondaria.psd", noRender: false },
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", noRender: true }
    ];

    const foto = NoRenderElementi.fotoDaSalvare(lista);

    assert.deepStrictEqual(foto, [
        { codRef: "3150596", noRender: true },
        { codRef: "3150599", noRender: false }
    ]);
});

test("un elemento in norender cancellato dai livelli non e' segnalato come mancante", () => {
    const marcati = [{ tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }];

    const segnalazione = NoRenderElementi.segnalazioneElementoMancante(
        "foto extra mancante nel box: Logo biologico", marcati, NoRenderElementi.TIPO.logo, "logo_bio");

    assert.strictEqual(segnalazione, "in norender");
});

test("un elemento mancante e non marcato conserva la segnalazione originale", () => {
    const marcati = [{ tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }];

    const segnalazione = NoRenderElementi.segnalazioneElementoMancante(
        "foto extra mancante nel box: Logo conv", marcati, NoRenderElementi.TIPO.logo, "logo_conv");

    assert.strictEqual(segnalazione, "foto extra mancante nel box: Logo conv");
});

test("le foto in norender entrano nell'elenco delle segnalazioni col nome del file", () => {
    const membri = [
        { codRef: "3150596", nomeFoto: "primaria.psd", noRender: true },
        { codRef: "3150599", nomeFoto: "secondaria.psd", noRender: false }
    ];
    const elementi = [{ tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }];

    const elenco = NoRenderElementi.elencoPerSegnalazioni(elementi, membri);

    assert.strictEqual(elenco.length, 2);
    assert.strictEqual(
        NoRenderElementi.segnalazioneElementoMancante(
            "foto mancante nel box: primaria.psd", elenco, NoRenderElementi.TIPO_FOTO, "primaria.psd"),
        "in norender");
    assert.strictEqual(
        NoRenderElementi.segnalazioneElementoMancante(
            "foto mancante nel box: secondaria.psd", elenco, NoRenderElementi.TIPO_FOTO, "secondaria.psd"),
        "foto mancante nel box: secondaria.psd");
});

// Il modal restava vuoto perche' il modulo era caricato con un tag script, mentre il Plugin
// carica i suoi moduli con require: NoRenderElementi non esisteva nello scope di schedaRef.
// La CI non esegue UXP, quindi il cablaggio si verifica sui sorgenti.
test("i moduli che usano NoRenderElementi lo richiedono davvero", () => {
    for (const file of ["schedaRef.js", "confronti.js", "indexNew.js"]) {
        assert.ok(
            sorgentePlugin(file).includes("require('./noRenderElementi')"),
            `${file} deve richiedere il modulo noRenderElementi`);
    }
});

test("index.html non carica il modulo come script", () => {
    assert.ok(
        !sorgentePlugin("index.html").includes("noRenderElementi.js"),
        "noRenderElementi e' un modulo CommonJS, non uno script della pagina");
});

test("il modulo si esporta come gli altri moduli del Plugin", () => {
    assert.ok(sorgentePlugin("noRenderElementi.js").includes("module.exports = NoRenderElementi;"));
});

// La lista si disegna dopo l'apertura del modal: apriModal clona il dialog dentro bodyModal,
// quindi riempirlo prima significa scrivere nel template nascosto.
test("il modal si apre prima di essere riempito", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const apertura = sorgente.indexOf("Utility.apriModal('dialogNoRender'");
    const disegno = sorgente.indexOf("this.disegnaListaNoRender();");

    assert.ok(apertura > 0 && disegno > 0);
    assert.ok(apertura < disegno, "disegnaListaNoRender deve essere chiamata dopo apriModal");
});

test("un simbolo non viene scambiato per un campo", () => {
    const classificato = NoRenderElementi.classificaLabel("simbolo$logo_bio$tipo_3");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO.logo);
    assert.strictEqual(classificato.chiave, "logo_bio");
});

test("il campo con suffisso conserva la chiave prima del dollaro", () => {
    const classificato = NoRenderElementi.classificaLabel("PREZ_CampoOfferta$3150596");

    assert.strictEqual(classificato.tipo, NoRenderElementi.TIPO.campo);
    assert.strictEqual(classificato.chiave, "PREZ_CampoOfferta");
});

test("il guid arriva fino alla riga del modal, anche per gli elementi spariti", () => {
    const vivi = [{ tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", guidId: "guid-logo" }];
    const marcati = [{ tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", nome: "primaria.psd", guidId: "guid-foto" }];

    const lista = NoRenderElementi.componiLista(vivi, marcati);

    assert.strictEqual(lista.find(e => e.chiave === "logo_bio").guidId, "guid-logo");
    assert.strictEqual(lista.find(e => e.chiave === "3150596").guidId, "guid-foto");
});

test("immagini e loghi con guid hanno la miniatura", () => {
    const foto = NoRenderElementi.urlMiniatura(
        { tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", guidId: "guid-foto" }, "http://olimpo/");
    const logo = NoRenderElementi.urlMiniatura(
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", guidId: "guid-logo" }, "http://olimpo/");

    assert.strictEqual(foto, "http://olimpo/getThumbNailOnDemand?width=50&guidId=guid-foto");
    assert.strictEqual(logo, "http://olimpo/getThumbNailOnDemand?width=50&guidId=guid-logo");
});

test("campi ed etichette non hanno miniatura, e senza guid nemmeno le foto", () => {
    assert.strictEqual(
        NoRenderElementi.urlMiniatura({ tipo: NoRenderElementi.TIPO.campo, chiave: "PIEDE", guidId: "guid" }, "http://olimpo/"),
        "");
    assert.strictEqual(
        NoRenderElementi.urlMiniatura({ tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", guidId: "" }, "http://olimpo/"),
        "");
    assert.strictEqual(
        NoRenderElementi.urlMiniatura({ tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", guidId: "guid" }, ""),
        "");
});

// Il modal ha il fondo bianco (plugin/index.html, pannello interno di #overlayModal):
// scriverci in bianco rende le righe invisibili, che e' come il difetto si e' presentato.
// La CI non rende la UI, quindi questa guardia sui sorgenti e' l'unico presidio automatico.
test("le righe del modal non forzano il testo bianco", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const inizio = sorgente.indexOf("disegnaListaNoRender() {");
    const fine = sorgente.indexOf("salvaNoRender() {");

    assert.ok(inizio > 0 && fine > inizio, "le funzioni del modal noRender devono esistere");

    const blocco = sorgente.slice(inizio, fine);
    assert.ok(!blocco.includes("color:white"), "il testo del modal non deve essere bianco su fondo bianco");
    assert.ok(!blocco.includes("color: white"), "il testo del modal non deve essere bianco su fondo bianco");
});
