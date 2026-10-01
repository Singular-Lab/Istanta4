/*
 * I20-1030: in UXP la rotella del mouse fa scorrere un contenitore solo se il contenitore ha
 * un'altezza vera. Quando l'altezza la decide il flex, il contenitore cresce quanto il suo
 * contenuto e non ha niente da scorrere: la rotella va a lui, e non succede nulla.
 *
 * E' successo alla lista dei tracciati della Home: #Tab1Viewport si allungava quanto tutte le
 * righe (17263 px, misurati in console), e la barra che l'operatore trascinava era quella del
 * contenitore esterno, #contenitoreTab. UXP non passa la rotella da un contenitore all'altro.
 *
 * Qui si calcola lo spazio che resta libero fra l'inizio dell'elemento e il fondo del suo
 * contenitore, e lo si scrive come altezza in pixel. L'altezza segue lo spazio, non il numero
 * di righe: va ricalcolata ogni volta che lo spazio cambia, e chi la usa lo fa.
 *
 * Non tocca InDesign: si carica sotto Node e si prova con elementi finti.
 */

const AltezzaScorrimento = {

    MARGINE: 10,
    MINIMO: 120,

    /// Lo spazio, in pixel interi, dall'inizio di elemento al fondo di contenitore, meno il
    /// margine e mai sotto il minimo.
    ///
    /// Tiene conto di quanto il contenitore e' gia' scorso, senza spostarlo: chi e' sceso in
    /// fondo alla pagina non deve ritrovarsi in cima solo perche' si e' ricalcolata un'altezza.
    ///
    /// Restituisce null se uno dei due manca o non e' visibile, per esempio con la scheda
    /// nascosta: le misure sarebbero zero, e un'altezza ricavata da li' non vuol dire niente.
    altezzaDisponibile(contenitore, elemento, opzioni = {}) {
        if (contenitore == null || elemento == null) {
            return null;
        }

        const margine = opzioni.margine != null ? opzioni.margine : AltezzaScorrimento.MARGINE;
        const minimo = opzioni.minimo != null ? opzioni.minimo : AltezzaScorrimento.MINIMO;

        let rettContenitore;
        let rettElemento;
        try {
            rettContenitore = contenitore.getBoundingClientRect();
            rettElemento = elemento.getBoundingClientRect();
        }
        catch (e) {
            return null;
        }

        const altezzaContenitore = contenitore.clientHeight;
        if (rettContenitore == null || rettElemento == null || !(altezzaContenitore > 0) || !(rettElemento.width > 0)) {
            return null;
        }

        const scorso = contenitore.scrollTop || 0;
        const inizio = rettElemento.top - rettContenitore.top + scorso;
        const altezza = Math.floor(altezzaContenitore - inizio - margine);

        if (!isFinite(altezza)) {
            return null;
        }

        return Math.max(altezza, minimo);
    },

    /// Scrive su elemento l'altezza di altezzaDisponibile, in pixel. Se non c'e' un'altezza
    /// da scrivere non tocca niente. Restituisce l'altezza scritta, oppure null.
    fissaAltezza(contenitore, elemento, opzioni = {}) {
        const altezza = AltezzaScorrimento.altezzaDisponibile(contenitore, elemento, opzioni);
        if (altezza == null) {
            return null;
        }

        elemento.style.height = altezza + "px";
        return altezza;
    }
};

module.exports = AltezzaScorrimento;
