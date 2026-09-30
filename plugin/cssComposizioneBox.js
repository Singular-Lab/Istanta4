/*
 * I20-970: duplicazione di elementi e ordine di sovrapposizione dentro un box.
 *
 * Il CssFramework sa spostare, ridimensionare e allineare quello che gia' esiste nel box,
 * ma non sa crearne di nuovi ne' decidere chi sta davanti a chi. Questo modulo aggiunge le
 * due decisioni, tenendole fuori da custom.js e fuori da InDesign: qui si calcola soltanto
 * il piano (cosa duplicare, con che etichetta, con che bounds, cosa mandare dietro a cosa),
 * mentre CssFramework lo esegue sul documento.
 *
 * I bounds seguono la convenzione InDesign: [y1, x1, y2, x2], con y1 in alto e y2 in basso.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const cssComposizioneBox = {

    //Suffisso che rende univoca l'etichetta di una copia: sy_ombra$3150596 per la foto immagine$3150596.
    separatoreSuffisso: "$",

    //I20-1022: il segno in fondo all'etichetta delle copie fatte con marcaClone. Serve a chi
    //deve riconoscerle senza conoscere la regola che le ha fatte, come le segnalazioni.
    marcatoreClone: "$clone",

    /// Se un'etichetta e' quella di un clone, cioe' di una copia fatta con marcaClone.
    eUnClone(etichetta) {
        return typeof etichetta === "string" &&
            etichetta.length > cssComposizioneBox.marcatoreClone.length &&
            etichetta.endsWith(cssComposizioneBox.marcatoreClone);
    },

    /// Il nome base delle copie di una regola: etichettaCopia se c'e', altrimenti la sorgente.
    /// Una sorgente con l'asterisco senza etichettaCopia perde l'asterisco, che in un'etichetta
    /// vera non ci puo' stare.
    etichettaBaseCopia(regola) {
        if (regola == null) {
            return "";
        }
        if (typeof regola.etichettaCopia === "string" && regola.etichettaCopia !== "") {
            return regola.etichettaCopia;
        }
        return String(regola.etichettaSorgente || "").replace(/\*/g, "");
    },

    /// Se l'etichetta e' di una copia fatta da questa regola. Con marcaClone conta anche il segno
    /// in fondo, ed e' cio' che impedisce di scambiare una foto_secondaria vera per una copia da
    /// togliere quando le copie si chiamano foto_secondaria$... anche loro.
    eCopiaDellaRegola(etichetta, regola) {
        if (etichetta == null) {
            return false;
        }
        const prefisso = cssComposizioneBox.etichettaBaseCopia(regola) + cssComposizioneBox.separatoreSuffisso;
        if (etichetta.indexOf(prefisso) !== 0 || etichetta.length <= prefisso.length) {
            return false;
        }
        return regola.marcaClone === true ? cssComposizioneBox.eUnClone(etichetta) : true;
    },

    /*
     * L'etichetta di una copia e' quella della sorgente piu' il suffisso del bersaglio.
     * Il suffisso e' cio' che nel bersaglio segue il primo $; senza suffisso si usa l'indice,
     * cosi' due copie non collidono mai.
     */
    etichettaCopia(etichettaSorgente, etichettaBersaglio, indice) {
        const posizione = etichettaBersaglio == null ? -1 : etichettaBersaglio.indexOf(cssComposizioneBox.separatoreSuffisso);
        const suffisso = posizione >= 0
            ? etichettaBersaglio.substring(posizione + 1)
            : String(indice + 1);

        return etichettaSorgente + cssComposizioneBox.separatoreSuffisso + suffisso;
    },

    /*
     * Bounds della copia a partire dal bersaglio.
     *
     * adatta:
     *  - larghezza / altezza: "bersaglio" per prendere la misura del bersaglio, altrimenti resta quella della sorgente
     *  - ancoraX: "centro" (default), "sinistra", "destra"
     *  - ancoraY: "centro" (default), "alto", "basso",
     *             "centroSuLatoBasso" -> il centro della copia cade sul lato basso del bersaglio
     *             "centroSuLatoAlto"  -> il centro della copia cade sul lato alto del bersaglio
     *  - offsetX / offsetY: scostamento finale in millimetri
     *  - fitContenuto: "riquadro" per far seguire il grafico al riquadro, "proporzionale" per
     *    adattarlo senza deformarlo; assente lascia il contenuto com'e'
     */
    boundsCopia(boundsSorgente, boundsBersaglio, adatta) {
        const opzioni = adatta || {};

        const altezzaSorgente = boundsSorgente[2] - boundsSorgente[0];
        const larghezzaSorgente = boundsSorgente[3] - boundsSorgente[1];
        const altezzaBersaglio = boundsBersaglio[2] - boundsBersaglio[0];
        const larghezzaBersaglio = boundsBersaglio[3] - boundsBersaglio[1];

        const larghezza = opzioni.larghezza === "bersaglio" ? larghezzaBersaglio : larghezzaSorgente;
        const altezza = opzioni.altezza === "bersaglio" ? altezzaBersaglio : altezzaSorgente;

        const offsetX = opzioni.offsetX != null ? opzioni.offsetX : 0;
        const offsetY = opzioni.offsetY != null ? opzioni.offsetY : 0;

        let x1;
        switch (opzioni.ancoraX) {
            case "sinistra":
                x1 = boundsBersaglio[1];
                break;
            case "destra":
                x1 = boundsBersaglio[3] - larghezza;
                break;
            default:
                x1 = boundsBersaglio[1] + (larghezzaBersaglio - larghezza) / 2;
                break;
        }

        let y1;
        switch (opzioni.ancoraY) {
            case "alto":
                y1 = boundsBersaglio[0];
                break;
            case "basso":
                y1 = boundsBersaglio[2] - altezza;
                break;
            case "centroSuLatoBasso":
                //Meta' della copia resta sotto il bersaglio, meta' finisce dietro di esso.
                y1 = boundsBersaglio[2] - altezza / 2;
                break;
            case "centroSuLatoAlto":
                y1 = boundsBersaglio[0] - altezza / 2;
                break;
            default:
                y1 = boundsBersaglio[0] + (altezzaBersaglio - altezza) / 2;
                break;
        }

        x1 = x1 + offsetX;
        y1 = y1 + offsetY;

        return [y1, x1, y1 + altezza, x1 + larghezza];
    },

    /*
     * Piano delle duplicazioni.
     *
     * elementi: [{ etichetta, bounds }] come si trovano nel box.
     * corrisponde(etichetta, spec): la stessa corrispondenza per etichetta usata dal resto del
     * framework, iniettata per non averne due versioni divergenti.
     *
     * Il piano e' rieseguibile: il box viene ricomposto piu' volte (gli allineamenti prima,
     * la sistemazione delle foto poi) e ogni passaggio deve poter ripartire da dove si era.
     * Percio' le copie gia' presenti vengono aggiornate invece che ricreate, la sorgente non
     * e' l'unico modello possibile (se e' stata rimossa si duplica da una copia) e spariscono
     * solo le copie il cui bersaglio non esiste piu'.
     *
     * I20-1022, per duplicare una foto e non solo un'ombra:
     *  - etichettaSorgente ammette l'asterisco ("immagine*"): la foto ha il codice nell'etichetta;
     *  - etichettaCopia da' alle copie un nome base diverso da quello della sorgente
     *    (la copia della primaria si chiama foto_secondaria$..., e il fix foto la conta);
     *  - marcaClone aggiunge $clone in fondo, cosi' il clone si riconosce anche fuori di qui;
     *  - aggiornaCopie false lascia la copia dov'e' ai passaggi successivi: la sistema il fix
     *    foto, e riallinearla al bersaglio disferebbe quello che ha fatto.
     *
     * Ritorna { copie, aggiornamenti, rimozioni }.
     */
    pianificaDuplicazioni(regole, elementi, corrisponde) {
        const piano = { copie: [], aggiornamenti: [], rimozioni: [] };

        if (regole == null || regole.length === 0 || elementi == null || elementi.length === 0) {
            return piano;
        }

        for (const regola of regole) {
            if (regola == null || regola.etichettaSorgente == null || regola.etichettaSorgente === "") {
                continue;
            }

            const eCopia = el => cssComposizioneBox.eCopiaDellaRegola(el.etichetta, regola);
            const sorgenteConAsterisco = regola.etichettaSorgente.indexOf("*") >= 0;
            const sorgente = sorgenteConAsterisco
                ? elementi.find(el => el.etichetta != null && !eCopia(el) && corrisponde(el.etichetta, regola.etichettaSorgente))
                : elementi.find(el => el.etichetta === regola.etichettaSorgente);
            const copieEsistenti = elementi.filter(el => el.etichetta != null && eCopia(el));
            const aggiornaCopie = regola.aggiornaCopie !== false;

            //Da cosa si duplica: la sorgente se c'e' ancora, altrimenti una copia gia' fatta.
            const modello = sorgente != null ? sorgente : (copieEsistenti.length > 0 ? copieEsistenti[0] : null);

            const bersagli = [];
            for (const spec of (regola.bersagli || [])) {
                for (const elemento of elementi) {
                    if (elemento.etichetta == null || elemento.etichetta === regola.etichettaSorgente) {
                        continue;
                    }
                    if (eCopia(elemento)) {
                        continue;
                    }
                    if (corrisponde(elemento.etichetta, spec) && bersagli.indexOf(elemento) < 0) {
                        bersagli.push(elemento);
                    }
                }
            }

            const fitContenuto = regola.adattaAlBersaglio != null ? (regola.adattaAlBersaglio.fitContenuto || null) : null;
            const etichetteAttese = [];

            for (let i = 0; i < bersagli.length; i++) {
                const bersaglio = bersagli[i];
                const etichetta = cssComposizioneBox.etichettaCopia(cssComposizioneBox.etichettaBaseCopia(regola), bersaglio.etichetta, i) +
                    (regola.marcaClone === true ? cssComposizioneBox.marcatoreClone : "");
                etichetteAttese.push(etichetta);

                const esistente = copieEsistenti.find(el => el.etichetta === etichetta);
                //Le misure della copia si calcolano sempre dal modello, mai dalla copia gia' adattata:
                //ripartire da quella accumulerebbe gli adattamenti a ogni passaggio.
                const riferimentoMisure = modello != null ? modello : esistente;

                if (riferimentoMisure == null) {
                    continue;
                }

                const bounds = cssComposizioneBox.boundsCopia(riferimentoMisure.bounds, bersaglio.bounds, regola.adattaAlBersaglio);

                if (esistente != null) {
                    if (!aggiornaCopie) {
                        continue;
                    }
                    piano.aggiornamenti.push({
                        etichetta: etichetta,
                        etichettaBersaglio: bersaglio.etichetta,
                        bounds: bounds,
                        fitContenuto: fitContenuto
                    });
                }
                else if (modello != null) {
                    piano.copie.push({
                        etichettaModello: modello.etichetta,
                        etichettaSorgente: regola.etichettaSorgente,
                        etichettaBersaglio: bersaglio.etichetta,
                        etichetta: etichetta,
                        bounds: bounds,
                        fitContenuto: fitContenuto
                    });
                }
            }

            //Spariscono solo le copie rimaste senza bersaglio.
            for (const copia of copieEsistenti) {
                if (etichetteAttese.indexOf(copia.etichetta) < 0) {
                    piano.rimozioni.push(copia.etichetta);
                }
            }

            //La sorgente se ne va quando le copie ci sono: resterebbe un elemento spaiato.
            const copieFinali = piano.copie.length + piano.aggiornamenti.length;
            if (sorgente != null && copieFinali > 0 && regola.mantieniSorgente !== true) {
                piano.rimozioni.push(sorgente.etichetta);
            }
        }

        return piano;
    },

    /*
     * Prefissi delle etichette che nascono da una duplicazione ("sy_ombra$").
     *
     * Servono a riconoscere una copia dalla sola etichetta. Altrove nel plugin l'etichetta
     * viene normalizzata tagliando quello che segue il $: per le copie quel taglio le
     * renderebbe tutte omonime, e due ombre diventerebbero un elemento solo.
     */
    prefissiDerivati(regole) {
        const prefissi = [];

        if (regole == null) {
            return prefissi;
        }

        for (const regola of regole) {
            if (regola == null || regola.etichettaSorgente == null || regola.etichettaSorgente === "") {
                continue;
            }
            const prefisso = cssComposizioneBox.etichettaBaseCopia(regola) + cssComposizioneBox.separatoreSuffisso;
            if (prefissi.indexOf(prefisso) < 0) {
                prefissi.push(prefisso);
            }
        }

        return prefissi;
    },

    /// Se un'etichetta e' quella di una copia. Il suffisso deve esserci davvero: "sy_ombra$" da
    /// solo non e' una copia, e' una sorgente col separatore appiccicato.
    etichettaDerivata(etichetta, prefissi) {
        if (etichetta == null || prefissi == null) {
            return false;
        }

        for (const prefisso of prefissi) {
            //Il suffisso deve esserci: "sy_ombra$" da solo non e' una copia.
            if (etichetta.indexOf(prefisso) === 0 && etichetta.length > prefisso.length) {
                return true;
            }
        }

        return false;
    },

    /*
     * Piano dell'ordine di sovrapposizione.
     *
     * Ogni regola sposta le etichette indicate dietro o davanti a un insieme di riferimento.
     * Le etichette senza riferimento vanno in fondo o in cima al box.
     */
    pianificaOrdineZ(regole, elementi, corrisponde) {
        const operazioni = [];

        if (regole == null || regole.length === 0 || elementi == null || elementi.length === 0) {
            return operazioni;
        }

        for (const regola of regole) {
            if (regola == null || regola.etichette == null || regola.etichette.length === 0) {
                continue;
            }

            const posizione = regola.posizione === "davanti" ? "davanti" : "dietro";

            const riferimenti = [];
            for (const spec of (regola.rispettoA || [])) {
                for (const elemento of elementi) {
                    if (elemento.etichetta != null && corrisponde(elemento.etichetta, spec) && riferimenti.indexOf(elemento.etichetta) < 0) {
                        riferimenti.push(elemento.etichetta);
                    }
                }
            }

            for (const spec of regola.etichette) {
                for (const elemento of elementi) {
                    if (elemento.etichetta == null || !corrisponde(elemento.etichetta, spec)) {
                        continue;
                    }
                    if (riferimenti.indexOf(elemento.etichetta) >= 0) {
                        //Un elemento non puo' essere spostato rispetto a se stesso.
                        continue;
                    }
                    if (operazioni.some(op => op.etichetta === elemento.etichetta)) {
                        continue;
                    }
                    operazioni.push({
                        etichetta: elemento.etichetta,
                        posizione: posizione,
                        riferimenti: riferimenti.slice()
                    });
                }
            }
        }

        return operazioni;
    }

}

module.exports = cssComposizioneBox;
