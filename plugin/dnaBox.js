/// TASK-22d7fad2: lo slot dell'idRec nel DNA di un box, e l'identita' di un box derivato.
///
/// Il DNA di un box sta nella label di un suo campo: $DNA$<box>$<codice>$<codiceGruppo>$<idRec>.
/// Un box derivato e' una seconda impaginazione dello stesso record, con una riga propria su
/// Istanta: ha lo stesso codice, lo stesso codice gruppo e lo stesso idRec dell'originale. Per
/// distinguerlo senza cambiare la forma del DNA, il suo slot dell'idRec diventa idRec*idLavRec,
/// dove idLavRec e' l'Id di quella riga. Per gli altri box lo slot resta il solo idRec.
///
/// Chi legge il DNA (Utility.getDnaOfBox) ne ricava idRec, pulito come prima, e idLavRec a parte
/// (0 se il box non e' un derivato): tutto cio' che usa l'idRec continua a funzionare, e chi deve
/// distinguere i due box guarda l'idLavRec. E' modulo puro: si carica anche sotto Node.

const SEPARATORE_DERIVATO = "*";

const DnaBox = {
    SEPARATORE_DERIVATO: SEPARATORE_DERIVATO,

    /// Un intero positivo letto da un valore qualunque; 0 se non lo e'.
    idValido(valore) {
        if (valore == null || valore === "") {
            return 0;
        }
        const testo = String(valore).trim();
        if (!/^\d+$/.test(testo)) {
            return 0;
        }
        const numero = parseInt(testo, 10);
        return numero > 0 ? numero : 0;
    },

    /// Lo slot dell'idRec scomposto: { idRec, idLavRec }. idRec resta il testo che c'era prima
    /// dell'asterisco (com'era lo slot intero per i box di prima), idLavRec e' 0 se manca o non
    /// e' un numero.
    leggiSlot(slot) {
        if (slot == null) {
            return { idRec: slot, idLavRec: 0 };
        }
        const testo = String(slot);
        const posizione = testo.indexOf(SEPARATORE_DERIVATO);
        if (posizione < 0) {
            return { idRec: slot, idLavRec: 0 };
        }
        return {
            idRec: testo.substring(0, posizione),
            idLavRec: this.idValido(testo.substring(posizione + 1))
        };
    },

    /// Lo slot da scrivere nel DNA: il solo idRec, oppure idRec*idLavRec per un derivato.
    scriviSlot(idRec, idLavRec) {
        const base = idRec == null ? "" : String(idRec);
        const derivato = this.idValido(idLavRec);
        return derivato > 0 ? base + SEPARATORE_DERIVATO + derivato : base;
    },

    /// L'idLavRec di un dna letto da getDnaOfBox, di un record o di un riferimento al box; 0 se
    /// non e' un derivato.
    idLavRecDi(oggetto) {
        return oggetto != null ? this.idValido(oggetto.idLavRec) : 0;
    },

    /// Vero se l'oggetto (dna, record, riferimento al box) e' di un box derivato.
    eDerivato(oggetto) {
        return this.idLavRecDi(oggetto) > 0;
    },

    /// La label del DNA con l'idRec sostituito, tenendo l'idLavRec che lo slot aveva: dopo un
    /// ricollegamento cambia il record, non la riga del derivato. Torna null se la label non ha
    /// lo slot (indiceSlot e' 5 nel formato $DNA$, 4 in quello vecchio base$).
    labelConIdRec(label, indiceSlot, idRec) {
        const parti = String(label == null ? "" : label).split("$");
        if (parti.length <= indiceSlot) {
            return null;
        }
        parti[indiceSlot] = this.scriviSlot(idRec, this.leggiSlot(parti[indiceSlot]).idLavRec);
        return parti.join("$");
    }
};

module.exports = DnaBox;
