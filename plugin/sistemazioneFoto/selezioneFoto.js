/// I20-1130: cosa prende "Seleziona tutte le foto". I20-1205: e quali foto dispone il fix foto, con
/// l'avviso quando sono piu' di quante la configurazione del cliente ne sa disporre.
///
/// Dal pannello, con una foto del box selezionata, l'operatore puo' portare nella selezione di
/// InDesign tutte le foto del box per spostarle insieme. Edro21 ha chiesto che con le foto
/// vengano anche le ombre (sy_ombra*): il plugin di agenzia dichiara in elementiConnessiAlleFoto
/// le etichette degli elementi connessi alle foto, e qui si decide cosa entra nella selezione.
///
/// Lavora su elementi con una label e non tocca InDesign: si carica sotto Node ed e' verificato
/// da tests/plugin/selezioneFoto.test.js. E' sistemazioneFoto a risalire al box e a impostare
/// la selezione.
///
/// Esecuzione dei test: node --test tests/plugin/*.test.js

const selezioneFoto = {

    /// L'espressione di un nome dichiarato dall'agenzia: "sy_ombra*" diventa /^sy_ombra.*$/,
    /// come makeRegexFromGroupName del CssFramework. I caratteri speciali sono protetti, tranne
    /// l'asterisco.
    espressione(nome) {
        const protetto = String(nome).replace(/[-\/\\^$+?.()|[\]{}]/g, "\\$&");
        return new RegExp("^" + protetto.replace(/\*/g, ".*") + "$");
    },

    /// Se la label e' quella di una foto primaria o secondaria: comincia con il nome che il
    /// plugin di agenzia da' alle foto, o con immagine / foto_secondaria se non ne da' uno.
    eUnaFoto(label, nomeFotoPrimaria, nomeFotoSecondaria) {
        if (typeof label !== "string" || label === "") {
            return false;
        }
        const primaria = typeof nomeFotoPrimaria === "string" && nomeFotoPrimaria !== "" ? nomeFotoPrimaria : "immagine";
        const secondaria = typeof nomeFotoSecondaria === "string" && nomeFotoSecondaria !== "" ? nomeFotoSecondaria : "foto_secondaria";
        return label.startsWith(primaria) || label.startsWith(secondaria);
    },

    /// Se la label e' di un elemento connesso alle foto. Un nome corrisponde alla label intera
    /// oppure alla parte prima del primo $, cosi' "sy_ombra" vale per sy_ombra$3150596 come in
    /// ignoreElementsFixFoto del fix foto, e "sy_ombra*" vale comunque.
    eConnessa(label, elementiConnessi) {
        if (typeof label !== "string" || label === "" || !Array.isArray(elementiConnessi)) {
            return false;
        }
        const base = label.split("$")[0];
        return elementiConnessi.some(nome => {
            if (typeof nome !== "string" || nome === "") {
                return false;
            }
            const espressione = selezioneFoto.espressione(nome);
            return espressione.test(label) || espressione.test(base);
        });
    },

    /// Gli elementi da selezionare, nell'ordine del box: { foto, connessi }. Una foto non finisce
    /// anche fra i connessi. Gli elementi senza label si saltano. Chi chiama seleziona i connessi
    /// solo insieme alle foto: senza foto nel box, niente.
    daSelezionare(elementi, configurazione) {
        const scelta = { foto: [], connessi: [] };
        if (elementi == null) {
            return scelta;
        }
        const conf = configurazione || {};
        for (let i = 0; i < elementi.length; i++) {
            const elemento = elementi[i];
            if (elemento == null || typeof elemento.label !== "string" || elemento.label === "") {
                continue;
            }
            if (selezioneFoto.eUnaFoto(elemento.label, conf.nomeFotoPrimaria, conf.nomeFotoSecondaria)) {
                scelta.foto.push(elemento);
            }
            else if (selezioneFoto.eConnessa(elemento.label, conf.elementiConnessi)) {
                scelta.connessi.push(elemento);
            }
        }
        return scelta;
    },

    /// I20-1205: le foto che il fix foto dispone, nell'ordine in cui le prende: le primarie in testa,
    /// le secondarie dopo. configurazione.etichetta, se c'e', ricava l'etichetta dalla label (il fix
    /// usa Utility.parseLabel). I20-978: una foto in noRender e' impaginata ma invisibile (visible
    /// false) e non partecipa: contandola il fix sceglieva la disposizione per una foto in piu'.
    fotoDelFix(elementi, configurazione) {
        const lista = [];
        if (elementi == null) {
            return lista;
        }
        const conf = configurazione || {};
        const etichetta = typeof conf.etichetta === "function" ? conf.etichetta : (label) => label;
        const primaria = typeof conf.nomeFotoPrimaria === "string" && conf.nomeFotoPrimaria !== "" ? conf.nomeFotoPrimaria : "immagine";
        for (let i = 0; i < elementi.length; i++) {
            const elemento = elementi[i];
            if (elemento == null || elemento.visible === false) {
                continue;
            }
            const label = etichetta(elemento.label);
            if (!selezioneFoto.eUnaFoto(label, conf.nomeFotoPrimaria, conf.nomeFotoSecondaria)) {
                continue;
            }
            if (label.startsWith(primaria)) {
                lista.unshift(elemento);
            }
            else {
                lista.push(elemento);
            }
        }
        return lista;
    },

    /// I20-1205: il numero piu' alto di foto per cui la configurazione di distanziamento del cliente
    /// (calcoloDistanziamentoFoto) ha una disposizione. 0 senza configurazione.
    fotoMassimeDelFix(configurazioni) {
        if (!Array.isArray(configurazioni)) {
            return 0;
        }
        return configurazioni.reduce((massimo, voce) =>
            voce != null && typeof voce.foto === "number" && voce.foto > massimo ? voce.foto : massimo, 0);
    },

    /// I20-1205: il testo della finestra quando le foto del box vanno sistemate a mano, perche' la
    /// configurazione non ha una disposizione per quel numero di foto, o null se il fix le sistema.
    /// Senza foto non c'e' niente da dire. Prima il Plugin proponeva comunque il Fix Foto, che usciva
    /// senza fare niente lasciando CSF-12 nella riga dei messaggi.
    avvisoFotoAMano(numero, configurazioni) {
        if (typeof numero !== "number" || numero <= 0) {
            return null;
        }
        const voci = Array.isArray(configurazioni) ? configurazioni : [];
        if (voci.some(voce => voce != null && voce.foto === numero)) {
            return null;
        }
        const massimo = selezioneFoto.fotoMassimeDelFix(voci);
        return "Il box ha " + numero + " foto: il Fix Foto automatico ne sistema fino a " + massimo + ". Sistema le foto a mano.";
    },
};

module.exports = selezioneFoto;
