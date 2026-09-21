/*
 * I20-981 (Lotto 1): la memoria degli hash md5 delle foto collegate.
 *
 * Utility.getLinkHash legge da disco l'intero file dell'immagine e ne calcola l'md5 in
 * JavaScript. Il Report Integrita' lo fa per ogni foto di ogni box in pagina, e su un
 * volantino sono centinaia di file da qualche MB: e' il costo dominante del report, e si
 * ripaga solo la prima volta, perche' al secondo report della stessa sessione i file sono
 * gli stessi.
 *
 * Qui si tiene l'hash per la coppia percorso + impronta del file (dimensione e data di
 * modifica). Se il file cambia, cambia la chiave e l'hash viene ricalcolato: la cache non
 * puo' mentire su una foto sostituita. Lo stato del link (mancante, non aggiornato) non
 * viene mai messo in cache, si rilegge sempre da InDesign.
 *
 * La memoria dura quanto il codice del plugin: un reload di UXP la azzera.
 *
 * Esecuzione dei test: node --test tests/plugin/cacheHashFoto.test.js
 */

const cacheHashFoto = {
    voci: {},
    //Contatori per capire dai log se la cache sta servendo davvero.
    richieste: 0,
    risposte: 0,

    /// La chiave di una foto: percorso piu' impronta del file. Senza un'impronta valida
    /// (metadati non leggibili) restituisce null, e chi chiama calcola l'hash senza cache.
    chiave(percorso, metadata) {
        if (percorso == null || percorso === "") {
            return null;
        }

        if (metadata == null) {
            return null;
        }

        const dimensione = metadata.size;
        if (dimensione == null || isNaN(Number(dimensione))) {
            return null;
        }

        const modifica = metadata.dateModified != null
            ? metadata.dateModified
            : metadata.dateCreated;

        if (modifica == null) {
            return null;
        }

        const istante = modifica instanceof Date ? modifica.getTime() : Number(modifica);
        if (isNaN(istante)) {
            return null;
        }

        return String(percorso) + "|" + Number(dimensione) + "|" + istante;
    },

    /// L'hash memorizzato per quella chiave, oppure null se non c'e'.
    ottieni(chiave) {
        if (chiave == null) {
            return null;
        }

        this.richieste++;

        const hash = this.voci[chiave];
        if (hash == null) {
            return null;
        }

        this.risposte++;
        return hash;
    },

    memorizza(chiave, hash) {
        if (chiave == null || hash == null || hash === "") {
            return;
        }

        this.voci[chiave] = hash;
    },

    svuota() {
        this.voci = {};
        this.richieste = 0;
        this.risposte = 0;
    },

    statistiche() {
        return {
            voci: Object.keys(this.voci).length,
            richieste: this.richieste,
            risposte: this.risposte
        };
    }
};

module.exports = cacheHashFoto;
