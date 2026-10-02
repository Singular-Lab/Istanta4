/*
 * I20-1029: le segnalazioni di impaginazione di un box, scritte nell'etichetta del suo bollino.
 *
 * Prima il bollino portava come testo una sola segnalazione, quella scelta per prima, e le altre si
 * perdevano: restavano solo nel file .txt del report, e nessuno le rileggeva. Ora il bollino e'
 * vuoto, colorato con la gravita' peggiore, e la sua etichetta le contiene tutte:
 *
 *     segnalazioni$[{"g":"error","c":"CSF-009","t":"Code CSF-009: L'elemento ..."}, ...]
 *
 * g e' la gravita' (error, warning, notifica), c il codice quando il testo ne ha uno, t il testo.
 * Il JSON e non dei separatori a mano: i testi contengono gia' $, apici e due punti.
 *
 * Qui vive solo la parte pura - il formato, la gravita', il colore -, senza InDesign: si carica
 * sotto Node e si prova. Le operazioni sul documento stanno in segnalazioni.js, qui accanto.
 *
 * Sono le segnalazioni dell'impaginazione (CSS, sistemazione foto, errori di impaginazione), non
 * le differenze della scheda ref ne' quelle del Report Integrita', che restano separate.
 */

const PREFISSO = "segnalazioni$";

//Piu' piccolo, piu' grave.
const ORDINE_GRAVITA = { error: 1, warning: 2, notifica: 3 };

//I colori che Utility.addBollinoCustom sa disegnare. Uniformati in I20-1029: prima ogni
//segnalazione portava il suo, e CSF-013 era giallo.
const COLORE_GRAVITA = { error: "red", warning: "orange", notifica: "blue" };

const etichettaSegnalazioni = {

    PREFISSO: PREFISSO,
    ORDINE_GRAVITA: ORDINE_GRAVITA,
    COLORE_GRAVITA: COLORE_GRAVITA,

    /// La gravita' di una segnalazione dal typeMessage di addSegnalazione: "error", "warning" o
    /// "notifica". Quello che non e' ne' errore ne' warning e' una notifica.
    gravita(typeMessage) {
        const tipo = String(typeMessage == null ? "" : typeMessage).trim().toLowerCase();
        if (tipo === "error" || tipo === "errore") {
            return "error";
        }
        if (tipo === "warning") {
            return "warning";
        }
        return "notifica";
    },

    /// Il codice della segnalazione, se il testo ne ha uno ("Code CSF-009: ..." o "IDX-57.5 ...").
    codice(testo) {
        const trovato = /\b([A-Z]{2,4}-\d+(?:\.\d+)?)\b/.exec(String(testo == null ? "" : testo));
        return trovato != null ? trovato[1] : null;
    },

    /// La voce da scrivere nell'etichetta, da una segnalazione di addSegnalazione.
    daSegnalazione(segnalazione) {
        const testo = segnalazione != null && segnalazione.msg != null ? String(segnalazione.msg) : "";
        return {
            g: etichettaSegnalazioni.gravita(segnalazione != null ? segnalazione.typeMessage : null),
            c: etichettaSegnalazioni.codice(testo),
            t: testo
        };
    },

    /// Se una segnalazione e' gia' fra quelle raccolte per il box: stessa chiave, se ce l'ha, o
    /// stesso testo. Il motore CSS ripassa piu' volte sugli stessi controlli, e la stessa
    /// segnalazione non deve entrare due volte.
    giaPresente(raccolte, segnalazione) {
        if (!Array.isArray(raccolte) || segnalazione == null) {
            return false;
        }
        return raccolte.some(r => r != null && (
            (segnalazione.key != null && r.key === segnalazione.key) ||
            (r.msg === segnalazione.msg)));
    },

    /// Le voci dalla piu' grave alla meno grave; a parita', nell'ordine in cui sono arrivate.
    ordina(voci) {
        return (Array.isArray(voci) ? voci : [])
            .map((voce, indice) => ({ voce: voce, indice: indice }))
            .sort((a, b) => (ORDINE_GRAVITA[a.voce.g] || 9) - (ORDINE_GRAVITA[b.voce.g] || 9) || a.indice - b.indice)
            .map(x => x.voce);
    },

    /// L'etichetta del bollino per queste voci.
    scrivi(voci) {
        return PREFISSO + JSON.stringify(etichettaSegnalazioni.ordina(voci));
    },

    /// Se un'etichetta e' quella di un bollino di segnalazioni.
    eDiSegnalazioni(etichetta) {
        return typeof etichetta === "string" && etichetta.indexOf(PREFISSO) === 0;
    },

    /// Le voci scritte in un'etichetta. Null se l'etichetta non e' di un bollino di segnalazioni;
    /// una lista vuota se lo e' ma non si legge, per non perdere il bollino come se non ci fosse.
    leggi(etichetta) {
        if (!etichettaSegnalazioni.eDiSegnalazioni(etichetta)) {
            return null;
        }
        try {
            const voci = JSON.parse(etichetta.substring(PREFISSO.length));
            return Array.isArray(voci) ? voci.filter(v => v != null && typeof v === "object") : [];
        }
        catch (e) {
            return [];
        }
    },

    /// La gravita' peggiore fra le voci, o null se non ce ne sono.
    gravitaPeggiore(voci) {
        const ordinate = etichettaSegnalazioni.ordina(voci);
        return ordinate.length > 0 ? ordinate[0].g : null;
    },

    /// Il colore del bollino per una gravita'.
    colore(gravita) {
        return COLORE_GRAVITA[gravita] || COLORE_GRAVITA.notifica;
    }
};

module.exports = etichettaSegnalazioni;
