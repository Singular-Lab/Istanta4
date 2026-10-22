/// I20-1130: cosa prende "Seleziona tutte le foto".
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
};

module.exports = selezioneFoto;
