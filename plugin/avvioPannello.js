/*
 * I20-1045: l'avvio del pannello quando InDesign non ha ancora reso disponibile app.
 *
 * Ogni tanto, all'avvio o al riavvio del Plugin, require('indesign').app vale undefined: il
 * modulo c'e' (666 voci, misurate in console), app no, e in quella sessione del pannello non
 * arriva piu', nemmeno aspettando. Il Plugin non se ne accorgeva: il ciclo di events.js usciva in
 * silenzio a ogni giro, e il pannello restava su "Avvio del plugin in corso..." e "Offline".
 * Ricaricare il pannello prima o poi sblocca: nel caso misurato, al quinto reload.
 *
 * Qui si decide cosa fare all'avvio: se app c'e' si parte, altrimenti si ricarica il pannello,
 * fino a un massimo di tentativi. Il conteggio sta in localStorage, perche' deve sopravvivere alla
 * ricarica. indexNew.js chiama controlla() prima di ogni altro require e, se non si deve partire,
 * si ferma subito.
 *
 * Non richiede InDesign: tutto quello che serve arriva come parametro, cosi' si carica sotto Node
 * e si prova con oggetti finti.
 */

const AvvioPannello = {

    MASSIMO_TENTATIVI: 15,
    RITARDO_MS: 1000,
    //Un tentativo piu' vecchio di cosi' appartiene a un altro avvio, e il conteggio riparte.
    FINESTRA_MS: 120000,
    //Oltre questa durata dal primo tentativo ci si arrende comunque: se il conteggio non si
    //salvasse, il limite dei tentativi da solo non fermerebbe mai la ricarica.
    DURATA_MASSIMA_MS: 60000,
    CHIAVE: "istanta.avvioPannello",

    /// Cosa fare: { azione: "avvia" | "ricarica" | "arrenditi", tentativo, stato }. stato e' quello
    /// da salvare per il giro dopo: null quando il conteggio va azzerato.
    decidi(appPresente, stato, ora) {
        if (appPresente) {
            const tentativiFatti = stato != null && stato.tentativi > 0 ? stato.tentativi : 0;
            return { azione: "avvia", tentativo: tentativiFatti, stato: null };
        }

        const stessoAvvio = stato != null && stato.tentativi > 0 &&
            ora - stato.ultimo >= 0 && ora - stato.ultimo < AvvioPannello.FINESTRA_MS;
        const tentativo = stessoAvvio ? stato.tentativi + 1 : 1;
        const primo = stessoAvvio && stato.primo != null ? stato.primo : ora;

        if (tentativo > AvvioPannello.MASSIMO_TENTATIVI || ora - primo > AvvioPannello.DURATA_MASSIMA_MS) {
            return { azione: "arrenditi", tentativo: tentativo - 1, stato: null };
        }
        return { azione: "ricarica", tentativo: tentativo, stato: { tentativi: tentativo, primo: primo, ultimo: ora } };
    },

    /// Lo stato salvato, o null se non c'e' o non si legge.
    leggiStato(storage) {
        try {
            const testo = storage != null ? storage.getItem(AvvioPannello.CHIAVE) : null;
            return testo ? JSON.parse(testo) : null;
        }
        catch (e) {
            return null;
        }
    },

    scriviStato(storage, stato) {
        try {
            if (storage == null) {
                return;
            }
            if (stato == null) {
                storage.removeItem(AvvioPannello.CHIAVE);
            }
            else {
                storage.setItem(AvvioPannello.CHIAVE, JSON.stringify(stato));
            }
        }
        catch (e) {
            //Senza storage il conteggio non sopravvive alla ricarica e ogni giro e' il primo: lo
            //si vede dalla console, dove il tentativo resta sempre 1.
            console.warn("I20-1045: stato dell'avvio non salvato:", e);
        }
    },

    /// Il controllo dell'avvio. Restituisce true se il Plugin puo' partire. Altrimenti mostra il
    /// motivo e, se ci sono ancora tentativi, programma la ricarica del pannello.
    ///
    /// dipendenze: indesign (il modulo), storage (localStorage), ricarica (location.reload),
    /// mostra(testo, conRiprova) per il messaggio all'operatore, ora e attendi (setTimeout) per i test.
    controlla(dipendenze) {
        const d = dipendenze || {};
        const ora = d.ora != null ? d.ora : Date.now();
        const attendi = d.attendi || setTimeout;
        const mostra = d.mostra || function () {};

        let appPresente = false;
        try {
            appPresente = d.indesign != null && d.indesign.app != null;
        }
        catch (e) {
            appPresente = false;
        }

        const esito = AvvioPannello.decidi(appPresente, AvvioPannello.leggiStato(d.storage), ora);
        AvvioPannello.scriviStato(d.storage, esito.stato);

        if (esito.azione === "avvia") {
            if (esito.tentativo > 0) {
                console.log("I20-1045: InDesign ha reso disponibile app; Plugin avviato dopo " + esito.tentativo + " ricaricamenti.");
            }
            return true;
        }

        if (esito.azione === "ricarica") {
            console.warn("I20-1045: InDesign non ha reso disponibile app; ricarico il pannello (tentativo " + esito.tentativo + " di " + AvvioPannello.MASSIMO_TENTATIVI + ").");
            mostra("In attesa di InDesign... tentativo " + esito.tentativo + " di " + AvvioPannello.MASSIMO_TENTATIVI, false);
            attendi(function () {
                if (typeof d.ricarica === "function") {
                    d.ricarica();
                }
            }, AvvioPannello.RITARDO_MS);
            return false;
        }

        console.error("I20-1045: InDesign non ha reso disponibile app dopo " + esito.tentativo + " ricaricamenti; il Plugin non parte.");
        mostra("InDesign non ha reso disponibile il documento. Chiudi e riapri il pannello.", true);
        return false;
    }
};

module.exports = AvvioPannello;
