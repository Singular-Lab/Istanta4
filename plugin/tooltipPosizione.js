/*
 * I20-981: dove ancorare il riquadro di un tooltip.
 *
 * In UXP l'attributo title non basta a mostrare un suggerimento su un elemento creato da
 * codice, quindi il riquadro lo disegna il plugin (Utility.abilitaTooltipGlobali, che usa la
 * classe .jq-tooltip di index.html). Qui sta il calcolo di dove metterlo.
 *
 * La regola non guarda mai quanto e' grande il riquadro: in UXP quella misura non e'
 * attendibile, e passando da un elemento all'altro restituiva le dimensioni del testo
 * precedente, spostando il riquadro di quella differenza. Si usano solo il rettangolo
 * dell'elemento, che e' impaginato da tempo, e i limiti massimi che imponiamo noi al riquadro:
 * il riquadro puo' essere piu' piccolo del limite, mai piu' grande, e questo basta a tenerlo
 * dentro il pannello.
 *
 * Esecuzione dei test: node --test tests/plugin/tooltipPosizione.test.js
 */

//Distanza fra l'elemento e il suo riquadro, e margine minimo dai bordi del pannello.
const DISTANZA = 6;
const BORDO = 4;
//Sotto questa altezza un riquadro non si legge: meglio metterlo dall'altra parte.
const ALTEZZA_MINIMA = 40;

/// Il testo di un title, o null se non c'e' niente da mostrare.
function testoTooltip(valore) {
    if (valore == null) {
        return null;
    }

    const testo = String(valore).trim();
    return testo === "" ? null : testo;
}

/// La larghezza massima che il riquadro puo' prendere senza uscire dal pannello.
function larghezzaMassima(finestra) {
    const larghezza = numero((finestra || {}).width, 800) - (BORDO * 2);
    return larghezza > 80 ? Math.round(larghezza) : 80;
}

/// E l'altezza massima. Il pannello del plugin puo' essere basso, e un testo lungo che va a
/// capo diventa alto in fretta.
function altezzaMassima(finestra) {
    const altezza = numero((finestra || {}).height, 600) - (BORDO * 2);
    return altezza > ALTEZZA_MINIMA ? Math.round(altezza) : ALTEZZA_MINIMA;
}

/// Dove attaccare il riquadro, e quanto spazio concedergli.
///  - left: sempre presente, ancorato al bordo sinistro dell'elemento e arretrato quanto
///    serve perche' left piu' la larghezza concessa non superi il bordo del pannello;
///  - top oppure bottom: si sceglie il lato dove c'e' piu' spazio. Ancorando il bordo
///    inferiore del riquadro (bottom) il riquadro cresce verso l'alto, e quanto sia alto non
///    serve saperlo;
///  - maxWidth e maxHeight: i limiti da mettere in stile, che rendono vera la premessa del
///    calcolo. Senza quelli il riquadro potrebbe essere piu' grande dello spazio previsto.
function ancoraggioTooltip(elemento, finestra, larghezzaDesiderata) {
    const el = elemento || {};
    const larghezzaFinestra = numero((finestra || {}).width, 800);
    const altezzaFinestra = numero((finestra || {}).height, 600);

    const banda = larghezzaMassima({ width: larghezzaFinestra });
    const desiderata = numero(larghezzaDesiderata, banda);
    const maxWidth = Math.max(80, Math.min(banda, desiderata));

    const sinistraElemento = numero(el.left, 0);
    const sopraElemento = numero(el.top, 0);
    const sottoElemento = numero(el.bottom, sopraElemento + numero(el.height, 0));

    let left = sinistraElemento;

    if (left + maxWidth > larghezzaFinestra - BORDO) {
        left = larghezzaFinestra - BORDO - maxWidth;
    }

    if (left < BORDO) {
        left = BORDO;
    }

    const spazioSotto = (altezzaFinestra - BORDO) - (sottoElemento + DISTANZA);
    const spazioSopra = (sopraElemento - DISTANZA) - BORDO;

    if (spazioSotto >= ALTEZZA_MINIMA || spazioSotto >= spazioSopra) {
        return {
            left: Math.round(left),
            top: Math.round(sottoElemento + DISTANZA),
            maxWidth: Math.round(maxWidth),
            maxHeight: Math.max(ALTEZZA_MINIMA, Math.round(spazioSotto))
        };
    }

    return {
        left: Math.round(left),
        bottom: Math.round(altezzaFinestra - (sopraElemento - DISTANZA)),
        maxWidth: Math.round(maxWidth),
        maxHeight: Math.max(ALTEZZA_MINIMA, Math.round(spazioSopra))
    };
}

function numero(valore, predefinito) {
    const n = Number(valore);
    return isNaN(n) ? predefinito : n;
}

module.exports = {
    DISTANZA,
    BORDO,
    ALTEZZA_MINIMA,
    testoTooltip,
    larghezzaMassima,
    altezzaMassima,
    ancoraggioTooltip
};
