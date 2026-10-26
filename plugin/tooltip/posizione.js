/*
 * I20-981: dove ancorare il riquadro di un tooltip.
 *
 * In UXP l'attributo title non basta a mostrare un suggerimento su un elemento creato da
 * codice, quindi il riquadro lo disegna il plugin (Tooltip.abilitaTooltipGlobali, che usa la
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
///  - left oppure right: di norma left, il bordo sinistro dell'elemento. Se cosi' il riquadro
///    potrebbe uscire a destra, right: il bordo destro del riquadro si attacca a quello
///    dell'elemento e il riquadro cresce verso sinistra, e quanto sia largo non serve saperlo.
///    TASK-19c18841: prima si arretrava left di tutta la larghezza concessa (260 px), e un
///    testo corto come "Trova" compariva lontano dalla sua icona;
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
    const destraElemento = numero(el.right, sinistraElemento + numero(el.width, 0));

    //Il lato orizzontale: { left } o { right }, uno solo, e lo spazio che ne viene.
    let orizzontale = { left: Math.round(Math.max(BORDO, sinistraElemento)) };
    let larghezzaConcessa = maxWidth;

    if (sinistraElemento + maxWidth > larghezzaFinestra - BORDO) {
        const destra = Math.min(destraElemento, larghezzaFinestra - BORDO);
        const spazioVersoSinistra = destra - BORDO;
        if (spazioVersoSinistra >= 80) {
            orizzontale = { right: Math.round(larghezzaFinestra - destra) };
            larghezzaConcessa = Math.min(maxWidth, spazioVersoSinistra);
        }
        else {
            //Elemento quasi sul bordo sinistro di un pannello stretto: si arretra come prima.
            orizzontale = { left: Math.round(Math.max(BORDO, larghezzaFinestra - BORDO - maxWidth)) };
        }
    }

    const spazioSotto = (altezzaFinestra - BORDO) - (sottoElemento + DISTANZA);
    const spazioSopra = (sopraElemento - DISTANZA) - BORDO;

    if (spazioSotto >= ALTEZZA_MINIMA || spazioSotto >= spazioSopra) {
        return Object.assign({}, orizzontale, {
            top: Math.round(sottoElemento + DISTANZA),
            maxWidth: Math.round(larghezzaConcessa),
            maxHeight: Math.max(ALTEZZA_MINIMA, Math.round(spazioSotto))
        });
    }

    return Object.assign({}, orizzontale, {
        bottom: Math.round(altezzaFinestra - (sopraElemento - DISTANZA)),
        maxWidth: Math.round(larghezzaConcessa),
        maxHeight: Math.max(ALTEZZA_MINIMA, Math.round(spazioSopra))
    });
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
