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

//Gli elementi di una collezione di InDesign (length e item(i)) o di un array, come array.
function elenco(collezione) {
    if (collezione == null) {
        return [];
    }
    if (Array.isArray(collezione)) {
        return collezione;
    }
    const elementi = [];
    const quanti = collezione.length || 0;
    for (let i = 0; i < quanti; i++) {
        elementi.push(typeof collezione.item === "function" ? collezione.item(i) : collezione[i]);
    }
    return elementi;
}

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

    /// Lotto 2, "Risolvi": toglie dal box la segnalazione in posizione indice, nell'ordine in cui
    /// leggiDalBox le restituisce. Se ne restano, il bollino si ridisegna con quelle e con il
    /// colore della gravita' che resta; se non ne resta nessuna, il bollino sparisce.
    /// Restituisce il box: ridisegnare il bollino lo regruppa.
    risolviVoce(box, indice) {
        const voci = Segnalazioni.leggiDalBox(box);
        if (!(indice >= 0 && indice < voci.length)) {
            return box;
        }

        const restanti = etichettaSegnalazioni.senzaVoce(voci, indice);
        if (restanti.length === 0) {
            return Segnalazioni.togliDalBox(box);
        }
        return Segnalazioni.applicaAlBox(box, restanti);
    },

    /// Lotto 2, "Risolvi tutte": il box resta senza segnalazioni e senza bollino.
    risolviTutte(box) {
        return Segnalazioni.togliDalBox(box);
    },

    /// Tutte le segnalazioni del documento, una voce per bollino: la pagina, il box che lo
    /// contiene e le segnalazioni. La usa la schermata delle segnalazioni (schermata.js).
    ///
    /// Lettura mirata: il bollino e' sempre un ovale figlio diretto del gruppo del box
    /// (addBollinoCustom lo raggruppa cosi'), quindi si guardano solo gli ovali dei gruppi delle
    /// pagine, e un livello sotto per i box finiti dentro un altro gruppo. Scorrere tutti gli
    /// elementi del documento e leggere l'etichetta di ognuno costava 6339 ms su un volantino,
    /// contro 90 ms cosi', con gli stessi bollini (misurato in console durante il lotto 2).
    leggiDocumento(documento) {
        const risultato = [];
        if (documento == null || documento.pages == null) {
            return risultato;
        }

        elenco(documento.pages).forEach(pagina => {
            if (pagina == null) {
                return;
            }
            elenco(pagina.groups).forEach(gruppo => Segnalazioni._bolliniNelGruppo(gruppo, pagina.name, 1, risultato));
        });
        return risultato;
    },

    /// I bollini fra gli ovali di un gruppo e, per livelliSotto livelli, dei suoi gruppi.
    _bolliniNelGruppo(gruppo, nomePagina, livelliSotto, risultato) {
        if (gruppo == null) {
            return;
        }
        elenco(gruppo.ovals).forEach(ovale => {
            const voci = ovale != null ? etichettaSegnalazioni.leggi(ovale.label) : null;
            if (voci != null) {
                risultato.push({ pagina: nomePagina, box: gruppo, voci: voci });
            }
        });
        if (livelliSotto > 0) {
            elenco(gruppo.groups).forEach(interno => Segnalazioni._bolliniNelGruppo(interno, nomePagina, livelliSotto - 1, risultato));
        }
    }
};

module.exports = Segnalazioni;
