/*
 * I20-1029: le segnalazioni di impaginazione nel documento. Ogni box ne ha al piu' un bollino:
 * vuoto, colorato con la gravita' peggiore, con tutte le segnalazioni nell'etichetta (il formato
 * sta in etichetta.js, qui accanto).
 *
 * Il documento e' il registro: le segnalazioni sopravvivono alla chiusura del Plugin e di
 * InDesign, viaggiano con il file, e si rileggono da qualunque flusso le abbia prodotte.
 *
 * Non richiede InDesign: lavora sugli oggetti che riceve, e disegna il bollino con
 * Utility.addBollinoCustom, globale di indexNew come per gli altri moduli. Cosi' si carica sotto
 * Node e si prova con oggetti finti.
 */

const etichettaSegnalazioni = require('./etichetta');

//In alto a sinistra, dove il bollino stava gia' prima del I20-1029.
const POSIZIONE_BOLLINO = 0;

const Segnalazioni = {

    POSIZIONE_BOLLINO: POSIZIONE_BOLLINO,

    /// I bollini di segnalazioni dentro un box (di norma uno solo).
    bolliniDelBox(box) {
        if (box == null || box.allPageItems == null) {
            return [];
        }
        const trovati = [];
        for (let i = 0; i < box.allPageItems.length; i++) {
            const elemento = box.allPageItems[i];
            if (elemento != null && etichettaSegnalazioni.eDiSegnalazioni(elemento.label)) {
                trovati.push(elemento);
            }
        }
        return trovati;
    },

    /// Le segnalazioni scritte nel bollino di un box; una lista vuota se non ne ha.
    leggiDalBox(box) {
        const voci = [];
        Segnalazioni.bolliniDelBox(box).forEach(bollino => {
            (etichettaSegnalazioni.leggi(bollino.label) || []).forEach(voce => voci.push(voce));
        });
        return voci;
    },

    /// Toglie dal box il suo bollino di segnalazioni, se c'e'. Serve prima di rifare un box: le
    /// segnalazioni vecchie non valgono piu', e il bollino nuovo non deve sommarsi al vecchio.
    togliDalBox(box) {
        Segnalazioni.bolliniDelBox(box).forEach(bollino => {
            try {
                bollino.remove();
            }
            catch (e) {
                console.warn("Bollino di segnalazioni non rimosso:", e);
            }
        });
        return box;
    },

    /// Scrive le segnalazioni del box nel suo bollino: toglie quello che c'era e ne disegna uno
    /// vuoto, del colore della gravita' peggiore, con tutte le voci nell'etichetta. Senza voci non
    /// tocca niente: impaginaBox chiude le segnalazioni due volte, e la seconda arriva vuota.
    /// Restituisce il box, che addBollinoCustom regruppa: va usato quello restituito.
    applicaAlBox(box, voci) {
        if (box == null || !Array.isArray(voci) || voci.length === 0) {
            return box;
        }

        Segnalazioni.togliDalBox(box);

        const colore = etichettaSegnalazioni.colore(etichettaSegnalazioni.gravitaPeggiore(voci));
        const risultato = Utility.addBollinoCustom(box, "", colore, null, POSIZIONE_BOLLINO, null, false, etichettaSegnalazioni.scrivi(voci));
        return risultato != null ? risultato : box;
    },

    /// Tutte le segnalazioni del documento, una voce per bollino: la pagina, il box che lo
    /// contiene e le segnalazioni. Le usera' la schermata delle segnalazioni (lotto 2).
    leggiDocumento(documento) {
        const risultato = [];
        if (documento == null || documento.pages == null) {
            return risultato;
        }

        for (let p = 0; p < documento.pages.length; p++) {
            const pagina = typeof documento.pages.item === "function" ? documento.pages.item(p) : documento.pages[p];
            if (pagina == null || pagina.allPageItems == null) {
                continue;
            }
            for (let i = 0; i < pagina.allPageItems.length; i++) {
                const elemento = pagina.allPageItems[i];
                const voci = elemento != null ? etichettaSegnalazioni.leggi(elemento.label) : null;
                if (voci != null) {
                    risultato.push({ pagina: pagina.name, box: elemento.parent, voci: voci });
                }
            }
        }
        return risultato;
    }
};

module.exports = Segnalazioni;
