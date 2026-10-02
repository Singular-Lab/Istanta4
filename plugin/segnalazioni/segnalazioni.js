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

    /// Lotto 4: la voce di un bollino di prima del I20-1029, o null se l'ovale non lo e'. Il
    /// bollino vecchio e' un ovale senza etichetta con dentro un riquadro di testo; il colore
    /// dice la gravita'. Un ovale che non si legge non e' un bollino.
    _voceBollinoVecchio(ovale) {
        try {
            if (ovale == null || ovale.label || ovale.textFrames == null || !(ovale.textFrames.length > 0)) {
                return null;
            }
            const riquadro = ovale.textFrames.item(0);
            //La storia intera: il riquadro ne mostra solo la parte che ci sta.
            const testo = riquadro.parentStory != null ? riquadro.parentStory.contents : riquadro.contents;
            const colore = ovale.fillColor != null ? ovale.fillColor.name : null;
            return etichettaSegnalazioni.daBollinoVecchio(testo, colore);
        }
        catch (e) {
            return null;
        }
    },

    /// Lotto 4: i bollini vecchi di un box, con la loro voce. Solo gli ovali figli diretti del
    /// gruppo, dove addBollinoCustom li metteva: gli ovali della grafica stanno dentro il box.
    bolliniVecchiDelBox(box) {
        const trovati = [];
        elenco(box != null ? box.ovals : null).forEach(ovale => {
            const voce = Segnalazioni._voceBollinoVecchio(ovale);
            if (voce != null) {
                trovati.push({ ovale: ovale, voce: voce });
            }
        });
        return trovati;
    },

    /// Le segnalazioni di un box: quelle del bollino e, dal lotto 4, quelle dei bollini vecchi,
    /// senza doppioni. Una lista vuota se non ne ha.
    leggiDalBox(box) {
        const voci = [];
        Segnalazioni.bolliniDelBox(box).forEach(bollino => {
            (etichettaSegnalazioni.leggi(bollino.label) || []).forEach(voce => voci.push(voce));
        });
        Segnalazioni.bolliniVecchiDelBox(box).forEach(vecchio => voci.push(vecchio.voce));
        return etichettaSegnalazioni.senzaDoppioni(voci);
    },

    /// Toglie dal box il suo bollino di segnalazioni, se c'e', e dal lotto 4 anche i bollini
    /// vecchi. Serve prima di rifare un box: le segnalazioni vecchie non valgono piu', e il
    /// bollino nuovo non deve sommarsi al vecchio.
    togliDalBox(box) {
        Segnalazioni.bolliniDelBox(box).concat(Segnalazioni.bolliniVecchiDelBox(box).map(vecchio => vecchio.ovale)).forEach(bollino => {
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
    /// Un box con bollini vecchi passa cosi' al formato nuovo (lotto 4): applicaAlBox li toglie
    /// tutti e le voci rimaste, anche quelle vecchie, finiscono nell'unico bollino nuovo.
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
    /// Una voce per box: dal lotto 4 le segnalazioni del bollino e quelle dei bollini vecchi
    /// stanno insieme, senza doppioni.
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

    /// Lotto 3: le segnalazioni per referenza, per colorare il badge di pagina del tracciato.
    /// Dalle letture di leggiDocumento: { idRec: { gravita, segnalazioni, errori } }, con la
    /// gravita' peggiore e i conteggi di tutti i box della referenza (di norma uno). Il box si
    /// riconosce dal DNA (dnaDelBox, di norma Utility.getDnaOfBox); un box senza DNA leggibile,
    /// per esempio finito dentro un altro gruppo, non entra nella mappa.
    riepilogoPerRecord(lette, dnaDelBox) {
        const leggiDna = typeof dnaDelBox === "function" ? dnaDelBox : (box) => Utility.getDnaOfBox(box);
        const vociPerRecord = {};
        (Array.isArray(lette) ? lette : []).forEach(lettura => {
            let dna = null;
            try {
                dna = leggiDna(lettura.box);
            }
            catch (e) {
                dna = null;
            }
            const idRec = Segnalazioni.chiaveRecord(dna != null ? dna.idRec : null);
            if (idRec == null) {
                return;
            }
            vociPerRecord[idRec] = (vociPerRecord[idRec] || []).concat(Array.isArray(lettura.voci) ? lettura.voci : []);
        });

        const riepilogo = {};
        Object.keys(vociPerRecord).forEach(idRec => {
            const voci = vociPerRecord[idRec];
            if (voci.length === 0) {
                return;
            }
            riepilogo[idRec] = {
                gravita: etichettaSegnalazioni.gravitaPeggiore(voci),
                segnalazioni: voci.length,
                errori: voci.filter(voce => etichettaSegnalazioni.gravita(voce.g) === "error").length
            };
        });
        return riepilogo;
    },

    /// La chiave di una referenza nella mappa di riepilogoPerRecord: l'idRec come numero
    /// scritto in testo, perche' il DNA lo ha in testo e il tracciato in numero. null se non
    /// e' un idRec.
    chiaveRecord(idRec) {
        const numero = parseInt(idRec);
        return isNaN(numero) ? null : String(numero);
    },

    /// I bollini fra gli ovali di un gruppo e, per livelliSotto livelli, dei suoi gruppi.
    _bolliniNelGruppo(gruppo, nomePagina, livelliSotto, risultato) {
        if (gruppo == null) {
            return;
        }
        //Prima le voci del bollino, poi quelle dei bollini vecchi: lo stesso ordine di
        //leggiDalBox, perche' "Risolvi" toglie la voce per posizione.
        let haBollino = false;
        let nuove = [];
        const vecchie = [];
        elenco(gruppo.ovals).forEach(ovale => {
            const dalBollino = ovale != null ? etichettaSegnalazioni.leggi(ovale.label) : null;
            if (dalBollino != null) {
                haBollino = true;
                nuove = nuove.concat(dalBollino);
                return;
            }
            const vecchia = Segnalazioni._voceBollinoVecchio(ovale);
            if (vecchia != null) {
                haBollino = true;
                vecchie.push(vecchia);
            }
        });
        if (haBollino) {
            risultato.push({ pagina: nomePagina, box: gruppo, voci: etichettaSegnalazioni.senzaDoppioni(nuove.concat(vecchie)) });
        }
        if (livelliSotto > 0) {
            elenco(gruppo.groups).forEach(interno => Segnalazioni._bolliniNelGruppo(interno, nomePagina, livelliSotto - 1, risultato));
        }
    }
};

module.exports = Segnalazioni;
