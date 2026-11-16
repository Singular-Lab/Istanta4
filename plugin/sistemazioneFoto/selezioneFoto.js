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

    /// I20-1236: se la label e' quella di una foto ambientata: un'extra automatica di tipo 4
    /// ("Ambientata" in Istanta), che FotoPlacer.piazzaFotoExtraAuto etichetta
    /// foto_extra$<sigla>$tipo_4. Loghi (tipo_3), bollini (tipo_2) e foto del prodotto no.
    eAmbientata(label) {
        if (typeof label !== "string" || label === "") {
            return false;
        }
        return /^(X_)?foto_extra\$[^$]*\$tipo_4(\$|$)/i.test(label);
    },

    /// I20-1236: le foto ambientate visibili fra gli elementi dati, nel loro ordine.
    ambientateDelBox(elementi) {
        const lista = [];
        if (elementi == null) {
            return lista;
        }
        for (let i = 0; i < elementi.length; i++) {
            const elemento = elementi[i];
            if (elemento == null || elemento.visible === false) {
                continue;
            }
            if (selezioneFoto.eAmbientata(elemento.label)) {
                lista.push(elemento);
            }
        }
        return lista;
    },

    /// I20-1236: i bounds [alto, sinistra, basso, destra] dello spazio che il fix foto ha scelto per le
    /// foto: il candidato ({ x, y, width, height }) e' relativo all'angolo della base del box. Null se
    /// le misure non ci sono.
    boundsSpazioFoto(boundsBase, candidato) {
        if (!Array.isArray(boundsBase) || boundsBase.length < 2 || candidato == null) {
            return null;
        }
        const numeri = [boundsBase[0], boundsBase[1], candidato.x, candidato.y, candidato.width, candidato.height];
        if (numeri.some(n => typeof n !== "number" || isNaN(n)) || !(candidato.width > 0) || !(candidato.height > 0)) {
            return null;
        }
        const alto = boundsBase[0] + candidato.y;
        const sinistra = boundsBase[1] + candidato.x;
        return [alto, sinistra, alto + candidato.height, sinistra + candidato.width];
    },

    /// I20-1236: le foto che il fix dispone quando nel box ci sono ambientate. Le ambientate entrano
    /// nella disposizione come prime foto della cascata, davanti alle foto del prodotto, se la
    /// configurazione di distanziamento ha una disposizione per il numero totale: con Edro21, per due
    /// foto la seconda va a destra e in alto, cioe' ambientata in basso a sinistra e confezione in alto
    /// a destra. Senza foto del prodotto, senza ambientate o senza quella disposizione restano le sole
    /// foto del prodotto (ambientateNelFix false), e l'ambientata si sistema a parte.
    fotoConAmbientate(fotoProdotto, ambientate, configurazioni) {
        const prodotto = Array.isArray(fotoProdotto) ? fotoProdotto : [];
        const extra = Array.isArray(ambientate) ? ambientate : [];
        const soloProdotto = { lista: prodotto, ambientateNelFix: false };
        if (prodotto.length === 0 || extra.length === 0 || !Array.isArray(configurazioni)) {
            return soloProdotto;
        }
        const totale = prodotto.length + extra.length;
        if (!configurazioni.some(voce => voce != null && voce.foto === totale)) {
            return soloProdotto;
        }
        return { lista: extra.concat(prodotto), ambientateNelFix: true };
    },

    /// I20-1236: dove va un'ambientata grande larghezza x altezza (gia' alla scala della foto primaria):
    /// l'angolo in basso a sinistra coincide con quello dello spazio scelto per le foto, e se cosi'
    /// uscisse dalla base si sposta quanto basta per restarci dentro, senza cambiarne la misura. Se e'
    /// piu' grande della base resta ancorata all'angolo in basso a sinistra della base. Null se le
    /// misure non ci sono.
    boundsAmbientata(boundsBase, candidato, larghezza, altezza) {
        const spazio = this.boundsSpazioFoto(boundsBase, candidato);
        if (spazio == null || boundsBase.length < 4 || [boundsBase[2], boundsBase[3], larghezza, altezza].some(n => typeof n !== "number" || isNaN(n))
            || !(larghezza > 0) || !(altezza > 0)) {
            return null;
        }
        let basso = spazio[2];
        let sinistra = spazio[1];
        //dentro la base, in verticale: prima non sopra il bordo alto, poi non sotto quello basso
        if (basso - altezza < boundsBase[0]) {
            basso = boundsBase[0] + altezza;
        }
        if (basso > boundsBase[2]) {
            basso = boundsBase[2];
        }
        //in orizzontale: prima non oltre il bordo destro, poi non prima di quello sinistro
        if (sinistra + larghezza > boundsBase[3]) {
            sinistra = boundsBase[3] - larghezza;
        }
        if (sinistra < boundsBase[1]) {
            sinistra = boundsBase[1];
        }
        return [basso - altezza, sinistra, basso, sinistra + larghezza];
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
