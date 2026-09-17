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

test("la stessa miniatura si chiede piccola per la riga e grande per l'ingrandimento", () => {
    const elemento = { tipo: NoRenderElementi.TIPO.fotoExtra, chiave: "sfondo_vn", guidId: "guid-sfondo" };

    assert.strictEqual(
        NoRenderElementi.urlMiniatura(elemento, "http://olimpo/", 50),
        "http://olimpo/getThumbNailOnDemand?width=50&guidId=guid-sfondo");
    assert.strictEqual(
        NoRenderElementi.urlMiniatura(elemento, "http://olimpo/", 300),
        "http://olimpo/getThumbNailOnDemand?width=300&guidId=guid-sfondo");
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

// Gli extra del box stanno in due collezioni del record: cercarne una sola lasciava quelli
// automatici senza nome, senza sigla e senza guid, quindi senza miniatura.
test("un extra automatico porta comunque nome, sigla e guid", () => {
    const fotoExtra = [{ nome: "Logo biologico", sigla: "logo_bio", guidId: "guid-bio" }];
    const fotoExtraAuto = [{ nome: "Sfondo volantino", sigla: "sfondo_vn", guidId: "guid-sfondo" }];

    const automatico = NoRenderElementi.datiExtraDiSigla("sfondo_vn", fotoExtra, fotoExtraAuto);

    assert.strictEqual(automatico.nome, "Sfondo volantino");
    assert.strictEqual(automatico.sigla, "sfondo_vn");
    assert.strictEqual(automatico.guidId, "guid-sfondo");
});

test("l'extra dell'operatore continua a essere trovato", () => {
    const dati = NoRenderElementi.datiExtraDiSigla(
        "logo_bio",
        [{ nome: "Logo biologico", sigla: "logo_bio", guidId: "guid-bio" }],
        [{ nome: "Sfondo volantino", sigla: "sfondo_vn", guidId: "guid-sfondo" }]);

    assert.strictEqual(dati.guidId, "guid-bio");
});

test("una sigla presente in entrambe le collezioni da' un solo risultato, quello dell'operatore", () => {
    const dati = NoRenderElementi.datiExtraDiSigla(
        "logo_bio",
        [{ nome: "Logo operatore", sigla: "logo_bio", guidId: "guid-operatore" }],
        [{ nome: "Logo automatico", sigla: "logo_bio", guidId: "guid-auto" }]);

    assert.strictEqual(dati.nome, "Logo operatore");
    assert.strictEqual(dati.guidId, "guid-operatore");
});

test("una sigla sconosciuta non inventa dati", () => {
    assert.strictEqual(NoRenderElementi.datiExtraDiSigla("logo_mai_visto", [], []), null);
    assert.strictEqual(NoRenderElementi.datiExtraDiSigla("", [{ sigla: "" }], []), null);
});

test("la sigla di un extra si vede anche quando manca il nome", () => {
    assert.strictEqual(
        NoRenderElementi.descriviElemento({ tipo: NoRenderElementi.TIPO.fotoExtra, chiave: "sfondo_vn", nome: "" }),
        "sfondo_vn");
    assert.strictEqual(
        NoRenderElementi.descriviElemento({ tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico" }),
        "Logo biologico (logo_bio)");
});

// L'ingrandimento e' interazione: la CI non la puo' provare, ma almeno si controlla
// che le miniature del modal restino agganciate all'anteprima.
test("le miniature del modal reagiscono al passaggio del mouse", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const inizio = sorgente.indexOf("disegnaListaNoRender() {");
    const fine = sorgente.indexOf("salvaNoRender() {");
    const blocco = sorgente.slice(inizio, fine);

    assert.ok(blocco.includes("norender-anteprima"), "il modal deve avere il riquadro dell'ingrandimento");
    assert.ok(blocco.includes("mouseenter"), "la miniatura deve mostrare l'ingrandimento");
    assert.ok(blocco.includes("mouseleave"), "la miniatura deve nasconderlo quando il mouse esce");
});

// L'ingrandimento mostrava sempre l'ultima immagine della lista: l'indirizzo era in una
// variabile del ciclo, condivisa da tutti i gestori. Ogni riga deve portarsi i propri.
test("ogni riga porta gli indirizzi della propria immagine", () => {
    const elementi = [
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", guidId: "guid-bio" },
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_conv", nome: "Logo convenzionale", guidId: "guid-conv" },
        { tipo: NoRenderElementi.TIPO_FOTO, chiave: "3150596", nome: "primaria.psd", guidId: "guid-foto" }
    ];

    const righe = elementi.map(e => NoRenderElementi.datiRiga(e, "http://olimpo/"));

    assert.strictEqual(righe[0].urlIngrandita, "http://olimpo/getThumbNailOnDemand?width=300&guidId=guid-bio");
    assert.strictEqual(righe[1].urlIngrandita, "http://olimpo/getThumbNailOnDemand?width=300&guidId=guid-conv");
    assert.strictEqual(righe[2].urlIngrandita, "http://olimpo/getThumbNailOnDemand?width=300&guidId=guid-foto");

    // La piccola e la grande sono la stessa immagine a due misure, mai quella di un'altra riga.
    assert.strictEqual(righe[0].urlMiniatura, "http://olimpo/getThumbNailOnDemand?width=50&guidId=guid-bio");
    assert.strictEqual(new Set(righe.map(r => r.urlIngrandita)).size, 3);
});

test("una riga senza immagine non produce indirizzi", () => {
    const riga = NoRenderElementi.datiRiga(
        { tipo: NoRenderElementi.TIPO.campo, chiave: "PIEDE_Titolari", nome: "PIEDE_Titolari" }, "http://olimpo/");

    assert.strictEqual(riga.urlMiniatura, "");
    assert.strictEqual(riga.urlIngrandita, "");
    assert.strictEqual(riga.descrizione, "PIEDE_Titolari");
});

test("l'ingrandimento legge l'indirizzo dalla miniatura puntata", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const inizio = sorgente.indexOf("disegnaListaNoRender() {");
    const fine = sorgente.indexOf("salvaNoRender() {");
    const blocco = sorgente.slice(inizio, fine);

    assert.ok(
        blocco.includes('$(this).attr("urlIngrandita")'),
        "il gestore deve leggere l'indirizzo dall'elemento, non da una variabile del ciclo");
});

// Reimpaginare parte dai record in memoria: se il salvataggio non li aggiorna, un elemento
// appena messo in noRender torna visibile alla prima reimpaginazione.
test("il salvataggio riporta lo stato sui record in memoria", () => {
    const sorgente = sorgentePlugin("schedaRef.js");

    assert.ok(sorgente.includes("aggiornaNoRenderNeiRecord(elementi, foto)"),
        "salvaNoRender deve aggiornare i record in memoria");
    assert.ok(sorgente.includes("record.noRenderElementi = elementi;"),
        "l'elenco degli elementi va riportato sul record");
});

test("impaginando dal sottogruppo la chiave viene portata avanti", () => {
    const sorgente = sorgentePlugin("indexNew.js");

    assert.ok(
        sorgente.includes("tracciatoPrimario.noRenderElementi = primario.recordInTracciato.noRenderElementi;"),
        "il sottogruppo non porta noRenderElementi: va copiata dal record");
});

// Aprendo il modal si deve capire cosa e' gia' nascosto senza andare a guardare il box.
test("una riga nascosta si dichiara tale", () => {
    const riga = NoRenderElementi.datiRiga(
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", guidId: "g", noRender: true },
        "http://olimpo/");

    assert.strictEqual(riga.noRender, true);
    assert.strictEqual(riga.barrato, true);
    assert.strictEqual(riga.etichettaStato, "NON RENDERIZZATO");
    assert.strictEqual(riga.testoBottone, "Ripristina");
});

test("una riga visibile non porta segni di stato e il bottone propone di nasconderla", () => {
    const riga = NoRenderElementi.datiRiga(
        { tipo: NoRenderElementi.TIPO.logo, chiave: "logo_bio", nome: "Logo biologico", guidId: "g", noRender: false },
        "http://olimpo/");

    assert.strictEqual(riga.barrato, false);
    assert.strictEqual(riga.etichettaStato, "");
    assert.strictEqual(riga.testoBottone, "Nascondi");
});

test("un elemento nascosto e sparito dal documento resta annullabile", () => {
    const riga = NoRenderElementi.datiRiga(
        { tipo: NoRenderElementi.TIPO.fotoExtra, chiave: "sfondo_vn", nome: "Sfondo", noRender: true, presente: false },
        "http://olimpo/");

    assert.strictEqual(riga.presente, false);
    assert.strictEqual(riga.testoBottone, "Ripristina");
    assert.strictEqual(riga.etichettaStato, "NON RENDERIZZATO");
});

test("il riepilogo conta gli elementi nascosti", () => {
    const lista = [
        { tipo: NoRenderElementi.TIPO.logo, chiave: "a", noRender: true },
        { tipo: NoRenderElementi.TIPO.logo, chiave: "b", noRender: false },
        { tipo: NoRenderElementi.TIPO.campo, chiave: "c", noRender: true }
    ];

    assert.strictEqual(NoRenderElementi.riepilogo(lista), "2 elementi su 3 non renderizzati.");
});

test("il riepilogo distingue il singolare e l'elenco senza nascosti", () => {
    assert.strictEqual(
        NoRenderElementi.riepilogo([{ chiave: "a", noRender: true }, { chiave: "b", noRender: false }]),
        "1 elemento su 2 non renderizzato.");
    assert.strictEqual(
        NoRenderElementi.riepilogo([{ chiave: "a", noRender: false }]),
        "Nessun elemento nascosto: 1 elemento nel box.");
});

// Il noRender si perdeva reimpaginando perche' veniva applicato a meta' composizione del box.
test("il noRender si applica a box composto e dopo le operazioni che lo rifanno", () => {
    const sorgente = sorgentePlugin("indexNew.js");

    assert.ok(
        sorgente.includes("applicaNoRenderAgliElementiDelBox(boxImpaginato, itemRef.noRenderElementi);\r\n\r\n        boxImpaginato = finalizzaSegnalazioni") ||
        sorgente.includes("applicaNoRenderAgliElementiDelBox(boxImpaginato, itemRef.noRenderElementi);\n\n        boxImpaginato = finalizzaSegnalazioni"),
        "l'applicazione deve stare in coda a impaginaBox, non dentro il ramo della foto");

    assert.ok(
        sorgente.includes("applicaNoRenderAgliElementiDelBox(box.boxAggiunto, tracciatoPrimario.noRenderElementi);"),
        "va riapplicato dopo ricollegamento, confronto e rimozione dei simboli");
});

test("l'applicazione riporta quanti elementi ha reso invisibili", () => {
    const sorgente = sorgentePlugin("indexNew.js");

    assert.ok(
        sorgente.includes("elementi resi invisibili su"),
        "serve a distinguere l'elenco che non arriva dalle label che non corrispondono");
});

// Le due chiamate scrivono sulla stessa riga di meta: partendo insieme leggono lo stesso
// stato iniziale e l'ultima cancella il lavoro dell'altra. Devono andare in sequenza.
test("il salvataggio delle foto parte dopo la risposta di quello degli elementi", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const inizio = sorgente.indexOf("salvaNoRender() {");
    const fine = sorgente.indexOf("salvaNoRenderDelleFoto(codice_gruppo, idRec, foto) {");
    const blocco = sorgente.slice(inizio, fine);

    const chiamataFoto = blocco.indexOf("me.salvaNoRenderDelleFoto(codice_gruppo, idRec, foto);");
    const invioElementi = blocco.indexOf('xhr.send("Menabo/modificaNoRender"');

    assert.ok(chiamataFoto > 0, "il salvataggio delle foto deve avvenire dentro la risposta");
    assert.ok(invioElementi > 0);
    assert.ok(
        chiamataFoto < invioElementi,
        "la chiamata sulle foto deve stare nel gestore onload, quindi prima dell'invio nel sorgente");
});

test("un fallimento nel salvataggio delle foto viene segnalato", () => {
    const sorgente = sorgentePlugin("schedaRef.js");
    const inizio = sorgente.indexOf("salvaNoRenderDelleFoto(codice_gruppo, idRec, foto) {");
    const blocco = sorgente.slice(inizio, inizio + 2000);

    assert.ok(blocco.includes("xhr.onload"), "la risposta va letta, non ignorata");
    assert.ok(blocco.includes("SRF-56"), "un rifiuto del server deve arrivare all'operatore");
});
