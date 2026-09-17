/*
 * Scelta dello spazio in cui finiscono le foto del box.
 *
 * Il criterio storico e' uno solo: fra gli spazi liberi vince quello che permette al gruppo
 * di foto di venire piu' grande. In box come il BOX41, pero', le foto stanno dentro un
 * disegno fisso (le parentesi) e una foto spostata di lato per guadagnare pochi millimetri
 * risulta vistosamente scentrata: meglio qualche millimetro in meno e restare al centro.
 *
 * "Quanto in meno" e' una taratura del cliente, non una decisione del codice: la regola dice
 * entro che scarto d'area si accetta lo spazio piu' centrato. Se una foto e' davvero molto
 * piu' grande di lato, lo scarto viene superato e vince di nuovo l'area.
 *
 * I candidati arrivano in coordinate relative alla base del box: x e y sono l'angolo in alto
 * a sinistra, il centro della base e' quindi (larghezzaBase / 2, altezzaBase / 2).
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const cssSpazioFoto = {

    areaMassima: "areaMassima",
    centrato: "centrato",

    //Usata quando la regola non dice altro: lo scarto d'area accettato per centrarsi.
    tolleranzaPredefinita: 0.7,

    normalizzaPreferenza(preferenza) {
        const opzioni = preferenza || {};
        const modo = String(opzioni.modo || cssSpazioFoto.areaMassima).toLowerCase() === cssSpazioFoto.centrato.toLowerCase()
            ? cssSpazioFoto.centrato
            : cssSpazioFoto.areaMassima;

        let tolleranza = opzioni.tolleranzaArea != null ? Number(opzioni.tolleranzaArea) : cssSpazioFoto.tolleranzaPredefinita;
        if (!isFinite(tolleranza) || tolleranza <= 0) {
            tolleranza = cssSpazioFoto.tolleranzaPredefinita;
        }
        if (tolleranza > 1) {
            //Oltre 1 nessun candidato sarebbe ammesso e le foto non si muoverebbero piu'.
            tolleranza = 1;
        }

        let asse = String(opzioni.asseCentratura || "xy").toLowerCase();
        if (asse !== "x" && asse !== "y") {
            asse = "xy";
        }

        return { modo: modo, tolleranzaArea: tolleranza, asseCentratura: asse };
    },

    /*
     * Quanto verrebbe grande il gruppo dentro questo candidato, e su quale asse si misura.
     * Il gruppo si ridimensiona in proporzione: comanda il lato che si esaurisce per primo.
     * Ritorna null se il candidato non puo' contenerlo.
     */
    valutaCandidato(candidato, boundsGruppo) {
        if (candidato == null || boundsGruppo == null) {
            return null;
        }

        const altezzaGruppo = boundsGruppo[2] - boundsGruppo[0];
        const larghezzaGruppo = boundsGruppo[3] - boundsGruppo[1];

        if (altezzaGruppo <= 0 || larghezzaGruppo <= 0) {
            return null;
        }

        const ratioY = candidato.height / altezzaGruppo;
        const larghezzaRisultante = larghezzaGruppo * ratioY;
        if (larghezzaRisultante <= candidato.width) {
            return { area: larghezzaRisultante * candidato.height, useXaxisForReference: false };
        }

        const ratioX = candidato.width / larghezzaGruppo;
        const altezzaRisultante = altezzaGruppo * ratioX;
        if (altezzaRisultante <= candidato.height) {
            return { area: altezzaRisultante * candidato.width, useXaxisForReference: true };
        }

        return null;
    },

    distanzaDalCentro(candidato, larghezzaBase, altezzaBase, asse) {
        //Il gruppo viene centrato nel candidato, quindi il centro del candidato e' quello delle foto.
        const dx = (candidato.x + candidato.width / 2) - larghezzaBase / 2;
        const dy = (candidato.y + candidato.height / 2) - altezzaBase / 2;

        if (asse === "x") {
            return Math.abs(dx);
        }
        if (asse === "y") {
            return Math.abs(dy);
        }
        return Math.sqrt(dx * dx + dy * dy);
    },

    /*
     * Spazio da riservare attorno al gruppo foto, per lato, in millimetri.
     * Serve a cio' che sta attaccato alla foto e sporge oltre i suoi bordi, come un'ombra:
     * la foto viene un po' piu' piccola e la sporgenza non finisce sugli altri elementi.
     * Valori assenti o non numerici valgono zero; i negativi non hanno senso e valgono zero.
     */
    normalizzaEstensioni(estensioni) {
        const leggi = function (v) {
            const n = Number(v);
            return isFinite(n) && n > 0 ? n : 0;
        };
        const e = estensioni || {};
        return { alto: leggi(e.alto), sinistra: leggi(e.sinistra), basso: leggi(e.basso), destra: leggi(e.destra) };
    },

    /*
     * I candidati ristretti delle estensioni. Le estensioni non scalano con la foto, quindi
     * si tolgono dallo spazio prima di adattarvi il gruppo: centrare la foto nel candidato
     * ristretto equivale a centrare nel candidato intero la foto piu' le sue sporgenze.
     * Uno spazio che non regge le estensioni sparisce dalla scelta.
     */
    restringiCandidati(candidati, estensioni) {
        const e = cssSpazioFoto.normalizzaEstensioni(estensioni);
        if (candidati == null) {
            return [];
        }
        if (e.alto === 0 && e.sinistra === 0 && e.basso === 0 && e.destra === 0) {
            return candidati;
        }

        const ristretti = [];
        for (const c of candidati) {
            if (c == null) {
                continue;
            }
            const width = c.width - e.sinistra - e.destra;
            const height = c.height - e.alto - e.basso;
            if (!(width > 0) || !(height > 0)) {
                continue;
            }
            ristretti.push({
                x: c.x + e.sinistra,
                y: c.y + e.alto,
                width: width,
                height: height,
                direction: c.direction,
                derivatoDa: c
            });
        }
        return ristretti;
    },

    /*
     * La parte di un candidato simmetrica rispetto al centro della base.
     *
     * Uno spazio libero che attraversa il centro e' spesso piu' largo da una parte che
     * dall'altra: le foto centrate in quello spazio non sono centrate nel box. Se dello
     * spazio si usa solo la parte simmetrica, il centro delle foto coincide con quello del
     * box. Ritorna null se il candidato non attraversa il centro sugli assi richiesti.
     */
    parteCentrata(candidato, larghezzaBase, altezzaBase, asse) {
        let x = candidato.x, y = candidato.y, width = candidato.width, height = candidato.height;

        if (asse === "x" || asse === "xy") {
            const centroX = larghezzaBase / 2;
            const meta = Math.min(centroX - x, (x + width) - centroX);
            if (!(meta > 0)) {
                return null;
            }
            x = centroX - meta;
            width = meta * 2;
        }

        if (asse === "y" || asse === "xy") {
            const centroY = altezzaBase / 2;
            const meta = Math.min(centroY - y, (y + height) - centroY);
            if (!(meta > 0)) {
                return null;
            }
            y = centroY - meta;
            height = meta * 2;
        }

        if (x === candidato.x && y === candidato.y && width === candidato.width && height === candidato.height) {
            //Gia' simmetrico: non serve una variante.
            return null;
        }

        return { x: x, y: y, width: width, height: height, direction: "centrato", derivatoDa: candidato };
    },

    /*
     * Ritorna { candidato, area, useXaxisForReference } oppure null se nessuno spazio
     * riesce a contenere il gruppo. Col criterio centrato il candidato puo' essere una
     * parte di uno spazio libero, ritagliata attorno al centro della base.
     */
    scegli(candidati, boundsGruppo, preferenza, larghezzaBase, altezzaBase) {
        if (candidati == null || candidati.length === 0) {
            return null;
        }

        const opzioni = cssSpazioFoto.normalizzaPreferenza(preferenza);

        const ammessi = [];
        let migliore = null;

        const valuta = function (candidato) {
            const valutazione = cssSpazioFoto.valutaCandidato(candidato, boundsGruppo);
            if (valutazione == null || !(valutazione.area > 0)) {
                return null;
            }
            return {
                candidato: candidato,
                area: valutazione.area,
                useXaxisForReference: valutazione.useXaxisForReference
            };
        };

        for (const candidato of candidati) {
            const voce = valuta(candidato);
            if (voce == null) {
                continue;
            }
            ammessi.push(voce);

            //A parita' d'area vince il primo, come faceva il confronto originale.
            if (migliore == null || voce.area > migliore.area) {
                migliore = voce;
            }
        }

        if (migliore == null || opzioni.modo !== cssSpazioFoto.centrato) {
            return migliore;
        }

        //Le parti centrate degli spazi che attraversano il centro concorrono come gli altri:
        //valgono meno area, ma stanno esattamente al centro.
        for (const candidato of candidati) {
            const centrata = cssSpazioFoto.parteCentrata(candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);
            if (centrata == null) {
                continue;
            }
            const voce = valuta(centrata);
            if (voce != null) {
                ammessi.push(voce);
            }
        }

        const sogliaArea = migliore.area * opzioni.tolleranzaArea;
        let scelto = migliore;
        let distanzaScelto = cssSpazioFoto.distanzaDalCentro(migliore.candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);

        for (const voce of ammessi) {
            if (voce === migliore || voce.area < sogliaArea) {
                continue;
            }

            const distanza = cssSpazioFoto.distanzaDalCentro(voce.candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);
            //Piu' centrato vince; a pari centratura resta l'area piu' grande.
            if (distanza < distanzaScelto || (distanza === distanzaScelto && voce.area > scelto.area)) {
                scelto = voce;
                distanzaScelto = distanza;
            }
        }

        return scelto;
    },

    /*
     * Una riga per il log: cosa c'era da scegliere e cosa si e' scelto.
     * Serve al collaudo, dove l'unica cosa che si vede e' dove e' finita la foto.
     */
    descriviScelta(candidati, scelta, preferenza, larghezzaBase, altezzaBase, estensioni) {
        const opzioni = cssSpazioFoto.normalizzaPreferenza(preferenza);
        const e = cssSpazioFoto.normalizzaEstensioni(estensioni);
        const arrotonda = function (n) { return Math.round(n * 10) / 10; };
        const rettangolo = function (c) {
            return (c.direction ? c.direction + " " : "") + "x" + arrotonda(c.x) + " y" + arrotonda(c.y) + " " + arrotonda(c.width) + "x" + arrotonda(c.height);
        };

        let testo = "modo " + opzioni.modo;
        if (opzioni.modo === cssSpazioFoto.centrato) {
            testo += " (tolleranza " + opzioni.tolleranzaArea + ", asse " + opzioni.asseCentratura + ")";
        }
        testo += ", base " + arrotonda(larghezzaBase) + "x" + arrotonda(altezzaBase);
        if (e.alto || e.sinistra || e.basso || e.destra) {
            testo += ", estensioni alto " + arrotonda(e.alto) + " sinistra " + arrotonda(e.sinistra) + " basso " + arrotonda(e.basso) + " destra " + arrotonda(e.destra);
        }
        testo += ", candidati [" + (candidati || []).map(rettangolo).join("; ") + "]";
        testo += ", scelto " + (scelta == null ? "nessuno" : rettangolo(scelta.candidato) + " area " + arrotonda(scelta.area));
        return testo;
    }

}

module.exports = cssSpazioFoto;
