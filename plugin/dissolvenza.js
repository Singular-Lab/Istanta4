/*
 * I20-981 (Lotto 4a): i conti della dissolvenza delle righe del report.
 *
 * In UXP la proprieta' opacity viene accettata nello stile ma non ridisegnata: il tracciato
 * del collaudo ha mostrato dieci passi scritti e riletti dal motore, senza che a schermo
 * cambiasse niente. I colori invece si ridisegnano, e il plugin lo sa gia' (il lampo verde
 * della copia, il bordo arancione dei duplicati). La dissolvenza quindi porta a zero l'alfa
 * dei colori di testo e di sfondo, e le immagini, che colore non hanno, le spegne a meta'
 * strada. Qui stanno solo i conti: niente DOM, niente InDesign.
 *
 * Esecuzione dei test: node --test tests/plugin/dissolvenza.test.js
 */

//Breve, perche' l'operatore aspetta; ma a passi non troppo fitti, perche' UXP ridisegna quando
//il ciclo degli eventi glielo concede e un timer serrato non gli lascerebbe spazio.
const DURATA_MS = 300;
const PASSO_MS = 50;
//Il colore del testo quando il motore non lo dice: il report scrive in scuro su chiaro, e
//un testo che sfuma dal grigio scuro e' quello che l'occhio si aspetta.
const COLORE_TESTO_DI_BASE = { r: 17, g: 17, b: 17, a: 1 };
//Sotto questa alfa le immagini si spengono: non hanno un colore da attenuare.
const SOGLIA_IMMAGINI = 0.5;

function numeroDiPassi(durata = DURATA_MS, passo = PASSO_MS) {
    return Math.max(1, Math.round(durata / passo));
}

/// L'alfa da applicare al passo dato: da 1 (escluso) a 0 (compreso), in modo lineare.
function alfaAlPasso(passo, passi) {
    if (passi <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(1, 1 - (passo / passi)));
}

/// Legge un colore come lo restituisce il motore: "rgb(r, g, b)", "rgba(r, g, b, a)",
/// "#rgb", "#rrggbb" o "#rrggbbaa". Torna null per quello che non e' un colore pieno
/// (transparent, nomi, valori vuoti): li' non c'e' niente da attenuare.
function analizzaColore(testo) {
    if (testo == null) {
        return null;
    }

    const valore = String(testo).trim().toLowerCase();

    let match = valore.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (match) {
        const alfa = match[4] == null ? 1 : Number(match[4]);
        if (alfa === 0) {
            return null;
        }
        return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alfa };
    }

    match = valore.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (match) {
        let esa = match[1];
        if (esa.length === 3) {
            esa = esa.split("").map(c => c + c).join("");
        }

        const r = parseInt(esa.slice(0, 2), 16);
        const g = parseInt(esa.slice(2, 4), 16);
        const b = parseInt(esa.slice(4, 6), 16);
        const a = esa.length === 8 ? parseInt(esa.slice(6, 8), 16) / 255 : 1;

        if (a === 0) {
            return null;
        }
        return { r, g, b, a };
    }

    return null;
}

/// Il colore scritto con l'alfa ridotta al passo: l'alfa di partenza si moltiplica, cosi' un
/// colore gia' semitrasparente sfuma dal suo livello e non da uno pieno.
function coloreConAlfa(colore, alfa) {
    if (colore == null) {
        return null;
    }

    const a = Math.max(0, Math.min(1, colore.a * alfa));
    return "rgba(" + colore.r + ", " + colore.g + ", " + colore.b + ", " + a.toFixed(3) + ")";
}

/// Le immagini si spengono quando l'alfa scende sotto la soglia.
function immaginiSpente(alfa) {
    return alfa < SOGLIA_IMMAGINI;
}

module.exports = {
    DURATA_MS,
    PASSO_MS,
    SOGLIA_IMMAGINI,
    COLORE_TESTO_DI_BASE,
    numeroDiPassi,
    alfaAlPasso,
    analizzaColore,
    coloreConAlfa,
    immaginiSpente
};
