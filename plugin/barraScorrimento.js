/*
 * I20-981: i conti di una barra di scorrimento disegnata da noi.
 *
 * In UXP la tabella dei nuovi non scorre in orizzontale: ne' con overflow "auto", ne' con
 * "scroll", ne' dando alla tabella una larghezza vera in pixel. Invece di insistere, la
 * tabella viene spostata a mano e la barra la disegna il plugin.
 *
 * Qui stanno solo i conti, che sono la parte che si puo' sbagliare in silenzio: quanto e'
 * largo il cursore, dove va messo, dove porta un clic sulla traccia, e come si resta dentro i
 * limiti. Il disegno e gli eventi stanno in confronti.js.
 *
 * Esecuzione dei test: node --test tests/plugin/barraScorrimento.test.js
 */

//Sotto questa larghezza il cursore non si afferra piu'.
const CURSORE_MINIMO = 24;

function numero(valore, predefinito) {
    const n = Number(valore);
    return isNaN(n) ? predefinito : n;
}

/// Quanto si puo' scorrere in tutto: zero se il contenuto ci sta gia'.
function scorrimentoMassimo(larghezzaContenuto, larghezzaVisibile) {
    const contenuto = numero(larghezzaContenuto, 0);
    const visibile = numero(larghezzaVisibile, 0);

    return Math.max(0, Math.round(contenuto - visibile));
}

/// Vero se serve una barra: se il contenuto ci sta, la barra si nasconde invece di restare
/// li' a non fare nulla.
function serveLaBarra(larghezzaContenuto, larghezzaVisibile) {
    return scorrimentoMassimo(larghezzaContenuto, larghezzaVisibile) > 0;
}

/// Lo spostamento riportato dentro i limiti.
function limitaSpostamento(spostamento, larghezzaContenuto, larghezzaVisibile) {
    const massimo = scorrimentoMassimo(larghezzaContenuto, larghezzaVisibile);
    const valore = numero(spostamento, 0);

    if (valore < 0) {
        return 0;
    }

    return Math.round(Math.min(valore, massimo));
}

/// Il cursore: quanto e' largo e dove sta, in pixel dentro la traccia.
/// La larghezza segue la porzione visibile del contenuto, con un minimo per poterlo afferrare.
function geometriaCursore(spostamento, larghezzaContenuto, larghezzaVisibile, larghezzaTraccia) {
    const traccia = Math.max(0, numero(larghezzaTraccia, 0));
    const contenuto = Math.max(1, numero(larghezzaContenuto, 1));
    const visibile = Math.max(0, numero(larghezzaVisibile, 0));

    const proporzione = Math.min(1, visibile / contenuto);
    const larghezza = Math.max(CURSORE_MINIMO, Math.round(traccia * proporzione));
    const larghezzaUtile = Math.max(larghezza, Math.min(traccia, larghezza));

    const massimo = scorrimentoMassimo(contenuto, visibile);
    const spazioCursore = Math.max(0, traccia - larghezzaUtile);
    const avanzamento = massimo === 0 ? 0 : limitaSpostamento(spostamento, contenuto, visibile) / massimo;

    return {
        larghezza: Math.min(larghezzaUtile, traccia),
        sinistra: Math.round(spazioCursore * avanzamento)
    };
}

/// Dove porta un clic sulla traccia: il punto cliccato diventa il centro del cursore.
function spostamentoDaClic(posizioneNellaTraccia, larghezzaContenuto, larghezzaVisibile, larghezzaTraccia) {
    const traccia = Math.max(1, numero(larghezzaTraccia, 1));
    const contenuto = Math.max(1, numero(larghezzaContenuto, 1));
    const visibile = Math.max(0, numero(larghezzaVisibile, 0));

    const cursore = geometriaCursore(0, contenuto, visibile, traccia).larghezza;
    const spazioCursore = Math.max(1, traccia - cursore);

    const sinistraDesiderata = numero(posizioneNellaTraccia, 0) - (cursore / 2);
    const avanzamento = Math.min(1, Math.max(0, sinistraDesiderata / spazioCursore));

    return limitaSpostamento(avanzamento * scorrimentoMassimo(contenuto, visibile), contenuto, visibile);
}

/// Lo spostamento dopo aver trascinato il cursore di tanti pixel.
function spostamentoDaTrascinamento(spostamentoIniziale, pixelTrascinati, larghezzaContenuto, larghezzaVisibile, larghezzaTraccia) {
    const traccia = Math.max(1, numero(larghezzaTraccia, 1));
    const contenuto = Math.max(1, numero(larghezzaContenuto, 1));
    const visibile = Math.max(0, numero(larghezzaVisibile, 0));

    const cursore = geometriaCursore(0, contenuto, visibile, traccia).larghezza;
    const spazioCursore = Math.max(1, traccia - cursore);
    const massimo = scorrimentoMassimo(contenuto, visibile);

    const spostamento = numero(spostamentoIniziale, 0) + (numero(pixelTrascinati, 0) * massimo / spazioCursore);

    return limitaSpostamento(spostamento, contenuto, visibile);
}

module.exports = {
    CURSORE_MINIMO,
    scorrimentoMassimo,
    serveLaBarra,
    limitaSpostamento,
    geometriaCursore,
    spostamentoDaClic,
    spostamentoDaTrascinamento
};
