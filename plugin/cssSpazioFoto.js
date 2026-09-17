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
     * Ritorna { candidato, area, useXaxisForReference } oppure null se nessuno spazio
     * riesce a contenere il gruppo.
     */
    scegli(candidati, boundsGruppo, preferenza, larghezzaBase, altezzaBase) {
        if (candidati == null || candidati.length === 0) {
            return null;
        }

        const opzioni = cssSpazioFoto.normalizzaPreferenza(preferenza);

        const ammessi = [];
        let migliore = null;

        for (const candidato of candidati) {
            const valutazione = cssSpazioFoto.valutaCandidato(candidato, boundsGruppo);
            if (valutazione == null || !(valutazione.area > 0)) {
                continue;
            }

            const voce = {
                candidato: candidato,
                area: valutazione.area,
                useXaxisForReference: valutazione.useXaxisForReference
            };
            ammessi.push(voce);

            //A parita' d'area vince il primo, come faceva il confronto originale.
            if (migliore == null || voce.area > migliore.area) {
                migliore = voce;
            }
        }

        if (migliore == null || opzioni.modo !== cssSpazioFoto.centrato) {
            return migliore;
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
    }

}

module.exports = cssSpazioFoto;
