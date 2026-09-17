/*
 * Stato di revisione di una riga del revisore: una regola sola per il contatore, per la
 * ripartizione fra le schede e per la resa delle righe.
 *
 * Prima ogni punto aveva la sua: la resa distingueva la firma garantita vuota da quella
 * valorizzata, il contatore no, le schede ignoravano il garante. Il risultato era una riga
 * mostrata da revisionare e non contata, o una riga verde nella scheda sbagliata.
 *
 * Una riga e' revisionata quando esiste una revisione e:
 *  - la firma e' garantita da un tracciato (FirmaGarantita con una sigla, non vuota), oppure
 *  - la firma della revisione coincide con quella del record in tracciato.
 * FirmaGarantita vuota vuol dire "garante valutato, non garantisce": la riga e' da revisionare.
 *
 * Il modulo non dipende dal browser: la chiave della firma arriva dal chiamante o, se
 * assente, dalla costante globale keyTracciatoFirma di utility.js. In Node si esporta per
 * i test (tests/istanta-web).
 */

const statoRevisione = {

    chiaveFirmaGarantita: "FirmaGarantita",
    chiaveFirmaTracciatoPredefinita: "Tracciato.Firma",

    chiaveFirmaTracciato(chiave) {
        if (chiave != null) {
            return chiave;
        }
        return typeof keyTracciatoFirma !== "undefined" ? keyTracciatoFirma : statoRevisione.chiaveFirmaTracciatoPredefinita;
    },

    //Sigla presente: un altro tracciato garantisce la revisione. Vuota o assente: no.
    firmaGarantitaSpecificata(item) {
        if (item == null || item.recordInTracciato == null) {
            return false;
        }
        const valore = item.recordInTracciato[statoRevisione.chiaveFirmaGarantita];
        return valore != null && valore !== "";
    },

    firmaCoincide(item, chiave) {
        if (item == null || item.recordRevisionato == null || item.recordInTracciato == null) {
            return false;
        }
        const firmaRevisione = item.recordRevisionato.firmaTracciato;
        if (firmaRevisione == null) {
            return false;
        }
        return firmaRevisione == item.recordInTracciato[statoRevisione.chiaveFirmaTracciato(chiave)];
    },

    eRevisionato(item, chiave) {
        if (item == null || item.recordRevisionato == null) {
            return false;
        }
        return statoRevisione.firmaGarantitaSpecificata(item) || statoRevisione.firmaCoincide(item, chiave);
    }

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = statoRevisione;
}
