/*
 * I20-1102: il gruppo di allineamento a slot.
 *
 * Un gruppo a livelli impila gli elementi presenti a partire da un'ancora, in una sola
 * direzione: non sa riempire posizioni fisse in un ordine che non parte da un estremo. Il PoP di
 * Coop ne ha bisogno per i loghi: nel modello del box ci sono i riquadri slot_logo1, slot_logo2,
 * slot_logo3 (e slot_logoGrande), e i loghi presenti vanno uno per riquadro, nell'ordine dei
 * numeri. Il gruppo dichiara quindi i suoi slot:
 *
 *   "slot": { "cornici": ["slot_logo1", "slot_logo2", "slot_logo3"],
 *             "modalita": "posizioneEDimensione",
 *             "corniciDaRimuovere": ["slot_logo*"] }
 *
 * cornici sono le etichette dei riquadri nell'ordine di riempimento; modalita e' "posizione"
 * (centro su centro) o "posizioneEDimensione" (centro su centro e la misura del riquadro);
 * corniciDaRimuovere sono le etichette (anche con *) dei riquadri da togliere dal box anche se
 * restano vuoti: senza, si tolgono le cornici. Gli elementi e la loro priorita' sono quelli dei
 * livelli del gruppo, come per un gruppo a livelli; dopo il piazzamento vale il fit finale.
 *
 * Qui si calcola soltanto il piano: dove va ogni elemento e quali restano fuori. CssFramework lo
 * esegue sul documento (allineaASlot). I bounds seguono la convenzione InDesign: [y1, x1, y2, x2].
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const cssSlot = {

    MODALITA_POSIZIONE: "posizione",
    MODALITA_POSIZIONE_E_DIMENSIONE: "posizioneEDimensione",
    ALLINEAMENTO_DESTRA: "destra",
    ALLINEAMENTO_SINISTRA: "sinistra",

    /// Le etichette dei riquadri da togliere dal box: quelle dichiarate, o le cornici.
    corniciDaRimuovere(slot) {
        if (slot == null) {
            return [];
        }
        if (Array.isArray(slot.corniciDaRimuovere) && slot.corniciDaRimuovere.length > 0) {
            return slot.corniciDaRimuovere.slice();
        }
        return Array.isArray(slot.cornici) ? slot.cornici.slice() : [];
    },

    /// Gli elementi del gruppo nell'ordine di priorita' dei livelli: livello per livello, etichetta
    /// per etichetta, tutti gli elementi presenti che corrispondono, ognuno una volta sola.
    /// presenti: [{ chiave, ... }]; corrisponde(etichettaDelLivello, chiave) dice se combaciano.
    elementiInOrdine(livelli, presenti, corrisponde) {
        const ordinati = (Array.isArray(livelli) ? livelli.slice() : [])
            .filter(l => l != null)
            .sort((a, b) => (a.livello || 0) - (b.livello || 0));
        const risultato = [];
        const presi = new Set();
        ordinati.forEach(function (livello) {
            (Array.isArray(livello.elementi) ? livello.elementi : []).forEach(function (etichetta) {
                (presenti || []).forEach(function (elemento) {
                    if (elemento == null || presi.has(elemento.chiave)) {
                        return;
                    }
                    if (corrisponde(etichetta, elemento.chiave)) {
                        presi.add(elemento.chiave);
                        risultato.push(elemento);
                    }
                });
            });
        });
        return risultato;
    },

    centro(bounds) {
        return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
    },

    /// Dove va un elemento nello slot: con la sola posizione tiene la sua misura e mette il centro
    /// sul centro dello slot; con la dimensione prende proprio i bounds dello slot.
    /// allineamentoOrizzontale vale con la sola posizione: "destra" lascia il centro verticale e
    /// porta il bordo destro su quello dello slot, "sinistra" il bordo sinistro; altro, il centro.
    boundsNelloSlot(elemento, slot, modalita, allineamentoOrizzontale) {
        if (modalita === cssSlot.MODALITA_POSIZIONE_E_DIMENSIONE) {
            return slot.slice();
        }
        const alto = elemento[2] - elemento[0];
        const largo = elemento[3] - elemento[1];
        const centro = cssSlot.centro(slot);
        let sinistra = centro[1] - largo / 2;
        if (allineamentoOrizzontale === cssSlot.ALLINEAMENTO_DESTRA) {
            sinistra = slot[3] - largo;
        }
        else if (allineamentoOrizzontale === cssSlot.ALLINEAMENTO_SINISTRA) {
            sinistra = slot[1];
        }
        return [centro[0] - alto / 2, sinistra, centro[0] + alto / 2, sinistra + largo];
    },

    /// L'eccezione del gruppo che vale per un elemento: la prima che lo nomina (corrisponde, come
    /// per i livelli) e le cui condizioni sono vere (condizioniVere riceve la sua listSetCondizioni).
    /// null se nessuna. Un'eccezione dice la modalita' e l'allineamento orizzontale dell'elemento.
    eccezioneDi(eccezioni, chiave, corrisponde, condizioniVere) {
        const elenco = Array.isArray(eccezioni) ? eccezioni : [];
        for (const eccezione of elenco) {
            if (eccezione == null || !Array.isArray(eccezione.elementi)) {
                continue;
            }
            if (!eccezione.elementi.some(etichetta => corrisponde(etichetta, chiave))) {
                continue;
            }
            if (condizioniVere == null || condizioniVere(eccezione.listSetCondizioni)) {
                return eccezione;
            }
        }
        return null;
    },

    /// La modalita' con cui un elemento va nello slot: la sua, se un'eccezione gliel'ha data, o
    /// quella del gruppo.
    modalitaDi(elemento, modalita) {
        return elemento != null && elemento.modalita ? elemento.modalita : modalita;
    },

    /// Il piano del gruppo. cornici: i riquadri presenti nel box, nell'ordine di riempimento,
    /// [{ nome, bounds }]; elementi: in ordine di priorita', [{ chiave, bounds }]. Gli elementi in
    /// piu' degli slot vanno in alto a destra nel box, con la loro misura, uno sotto l'altro.
    /// { assegnati: [{ chiave, slot, bounds }], inEccesso: [{ chiave, bounds }] }
    pianifica(cornici, elementi, modalita, boxBounds) {
        const slot = (cornici || []).filter(c => c != null && Array.isArray(c.bounds));
        const lista = (elementi || []).filter(e => e != null && Array.isArray(e.bounds));
        const assegnati = [];
        const inEccesso = [];
        let dallAlto = boxBounds[0];
        lista.forEach(function (elemento, indice) {
            if (indice < slot.length) {
                assegnati.push({ chiave: elemento.chiave, slot: slot[indice].nome, bounds: cssSlot.boundsNelloSlot(elemento.bounds, slot[indice].bounds, cssSlot.modalitaDi(elemento, modalita), elemento.allineamentoOrizzontale) });
                return;
            }
            const alto = elemento.bounds[2] - elemento.bounds[0];
            const largo = elemento.bounds[3] - elemento.bounds[1];
            inEccesso.push({ chiave: elemento.chiave, bounds: [dallAlto, boxBounds[3] - largo, dallAlto + alto, boxBounds[3]] });
            dallAlto += alto;
        });
        return { assegnati: assegnati, inEccesso: inEccesso };
    },

    /// I bounds di un elemento relativi al box e tagliati ai suoi bordi, come li tiene la mappa
    /// del box (CssFramework.creaMappaturaBoxOriginale).
    boundsRelativi(bounds, boxBounds) {
        return [
            Math.max(bounds[0] - boxBounds[0], 0),
            Math.max(bounds[1] - boxBounds[1], 0),
            Math.min(bounds[2] - boxBounds[0], boxBounds[2] - boxBounds[0]),
            Math.min(bounds[3] - boxBounds[1], boxBounds[3] - boxBounds[1])
        ];
    }
};

module.exports = cssSlot;
