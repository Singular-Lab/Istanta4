/*
 * Momento di esecuzione delle regole del framework CSS.
 *
 * L'ordine delle operazioni su un box e' fisso: ridimensionamenti, post ridimensionamenti,
 * allineamenti e infine la sistemazione delle foto. Va bene quasi sempre, ma alcune regole
 * hanno senso solo dopo che le foto hanno preso la loro posizione definitiva: prima di allora
 * si allineano a qualcosa che sta ancora per spostarsi.
 *
 * Invece di rendere configurabile l'intera sequenza, ogni regola dichiara in quale momento
 * vuole essere eseguita. Il motore riceve un DB gia' filtrato per quel momento e non sa
 * nemmeno che i momenti esistono: e' il motivo per cui questo meccanismo resta piccolo.
 *
 * Una regola senza "fase" appartiene al momento standard, quindi a dati invariati l'ordine
 * e' esattamente quello di prima.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const cssSequenzaOperazioni = {

    standard: "standard",
    dopoFixFoto: "dopoFixFoto",

    //In ordine di esecuzione. Aggiungere un momento qui e' l'unico modo previsto per estenderli.
    momenti: ["standard", "dopoFixFoto"],

    //Regole che partecipano ai momenti. Duplicazioni e ordiniZ ne restano fuori di proposito:
    //la composizione del box viene rieseguita in ogni momento, perche' gli elementi derivati
    //devono inseguire i propri bersagli tutte le volte che questi si spostano.
    chiaviRegole: ["ridimensionamenti", "postRidimensionamenti", "allineamenti"],

    /*
     * Un valore assente, vuoto o sconosciuto vale come standard: un refuso nel dato non deve
     * far sparire una regola, al massimo la lascia dov'era.
     */
    normalizzaMomento(fase) {
        if (fase == null || fase === "") {
            return cssSequenzaOperazioni.standard;
        }

        for (let i = 0; i < cssSequenzaOperazioni.momenti.length; i++) {
            if (cssSequenzaOperazioni.momenti[i].toLowerCase() === String(fase).toLowerCase()) {
                return cssSequenzaOperazioni.momenti[i];
            }
        }

        console.warn("cssSequenzaOperazioni: fase sconosciuta '" + fase + "', la regola resta nel momento standard.");
        return cssSequenzaOperazioni.standard;
    },

    regolaNelMomento(regola, momento) {
        if (regola == null) {
            return false;
        }
        return cssSequenzaOperazioni.normalizzaMomento(regola.fase) === cssSequenzaOperazioni.normalizzaMomento(momento);
    },

    filtraRegole(regole, momento) {
        if (regole == null || regole.length === 0) {
            return regole == null ? regole : [];
        }
        return regole.filter(regola => cssSequenzaOperazioni.regolaNelMomento(regola, momento));
    },

    /*
     * Copia del DB con le sole regole del momento richiesto.
     *
     * Il DB originale non viene toccato: e' lo stesso oggetto per tutti i box della lavorazione
     * e una modifica in posto si porterebbe dietro il box successivo.
     *
     * Attenzione, limite noto: una regola di un livello piu' specifico sopprime quella omonima
     * del livello di default solo se le due si incontrano nello stesso momento. Una regola e la
     * sua sovrascrittura vanno quindi tenute sulla stessa fase.
     */
    filtraDBPerMomento(DB, momento) {
        if (DB == null) {
            return DB;
        }

        const momentoNormalizzato = cssSequenzaOperazioni.normalizzaMomento(momento);

        return DB.map(function (elementoBox) {
            if (elementoBox == null) {
                return elementoBox;
            }

            const copia = Object.assign({}, elementoBox);
            for (const chiave of cssSequenzaOperazioni.chiaviRegole) {
                copia[chiave] = cssSequenzaOperazioni.filtraRegole(elementoBox[chiave], momentoNormalizzato);
            }
            return copia;
        });
    },

    /*
     * C'e' qualcosa da fare in questo momento? Serve a non pagare un giro di operazioni
     * a vuoto su ogni box quando nessun cliente usa il momento.
     */
    esistonoRegole(DB, momento) {
        if (DB == null) {
            return false;
        }

        for (const elementoBox of DB) {
            if (elementoBox == null) {
                continue;
            }
            for (const chiave of cssSequenzaOperazioni.chiaviRegole) {
                const regole = elementoBox[chiave];
                if (regole == null) {
                    continue;
                }
                for (const regola of regole) {
                    if (cssSequenzaOperazioni.regolaNelMomento(regola, momento)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

}

module.exports = cssSequenzaOperazioni;
