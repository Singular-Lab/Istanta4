/*
 * I20-981: dove va messo il riquadro di un tooltip.
 *
 * In UXP l'attributo title non produce nessun suggerimento: i title scritti in giro per il
 * plugin, un centinaio, non si vedono. Il riquadro lo disegniamo noi (Utility.abilitaTooltipGlobali,
 * che usa la classe .jq-tooltip gia' presente in index.html); qui sta il calcolo di dove
 * metterlo, che e' l'unica parte che si puo' verificare senza un DOM.
 *
 * Esecuzione dei test: node --test tests/plugin/tooltipPosizione.test.js
 */

//Distanza fra l'elemento e il suo riquadro, e margine minimo dai bordi del pannello.
const DISTANZA = 6;
const BORDO = 4;

/// Il testo di un title, o null se non c'e' niente da mostrare.
function testoTooltip(valore) {
    if (valore == null) {
        return null;
    }

    const testo = String(valore).trim();
    return testo === "" ? null : testo;
}

/// La posizione del riquadro: sotto l'elemento e allineato a sinistra, se c'e' spazio.
/// Se sotto non ci sta va sopra; se sborda a destra scorre a sinistra quanto basta. Non esce
/// mai dal pannello, che nel plugin e' spesso largo poche centinaia di pixel.
function posizioneTooltip(elemento, riquadro, finestra) {
    const el = elemento || {};
    const riq = riquadro || {};
    const fin = finestra || {};

    const larghezzaFinestra = numero(fin.width, 800);
    const altezzaFinestra = numero(fin.height, 600);

    const larghezza = numero(riq.width, 0);
    const altezza = numero(riq.height, 0);

    const sinistraElemento = numero(el.left, 0);
    const sopraElemento = numero(el.top, 0);
    const sottoElemento = numero(el.bottom, sopraElemento + numero(el.height, 0));

    //Sotto, se ci sta; altrimenti sopra; altrimenti attaccato al bordo alto.
    let top = sottoElemento + DISTANZA;

    if (top + altezza > altezzaFinestra - BORDO) {
        const sopra = sopraElemento - DISTANZA - altezza;
        top = sopra >= BORDO ? sopra : BORDO;
    }

    let left = sinistraElemento;

    if (left + larghezza > larghezzaFinestra - BORDO) {
        left = larghezzaFinestra - BORDO - larghezza;
    }

    if (left < BORDO) {
        left = BORDO;
    }

    return { left: Math.round(left), top: Math.round(top) };
}

/// La larghezza massima che il riquadro puo' prendere senza uscire dal pannello.
function larghezzaMassima(finestra) {
    const larghezza = numero((finestra || {}).width, 800) - (BORDO * 2);
    return larghezza > 80 ? Math.round(larghezza) : 80;
}

function numero(valore, predefinito) {
    const n = Number(valore);
    return isNaN(n) ? predefinito : n;
}

module.exports = {
    DISTANZA,
    BORDO,
    testoTooltip,
    posizioneTooltip,
    larghezzaMassima
};
