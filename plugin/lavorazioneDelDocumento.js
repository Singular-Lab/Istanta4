/*
 * I20-936: la ricerca della lavorazione del documento attivo dentro lavorazioni.json.
 *
 * Stava inline in ficoProcess.checklavorazioneSelezionata, mescolata alla lettura del file e
 * all'interfaccia. Quel file richiede 'indesign' e non si carica sotto Node, quindi la ricerca
 * non era verificabile: qui resta solo la decisione, senza InDesign e senza DOM.
 *
 * E' la ricerca che il pulsante di rilettura rifa': chi non ha i permessi per creare una
 * lavorazione se la fa mandare e la mette nella cartella a plugin gia' aperto, e prima l'unico
 * modo per vederla era chiudere e riaprire il pannello.
 *
 * Esecuzione dei test: node --test tests/plugin/lavorazioneDelDocumento.test.js
 */

/// Cerca nel contenuto di lavorazioni.json la voce del documento attivo, e restituisce null
/// quando non c'e'. Il file puo' mancare del tutto, ed e' letto come null; puo' essere vuoto;
/// puo' elencare altri documenti e non questo. Nessuno di questi casi e' un errore: sono tutti
/// "lavorazione non trovata", ed e' proprio la condizione che una rilettura piu' tardi risolve.
/// Con piu' voci per lo stesso documento si prende la prima, come faceva il codice di prima.
function trovaLavorazione(contenutoLavorazioni, nomeDocumento) {
    if (!Array.isArray(contenutoLavorazioni)) {
        return null;
    }

    if (nomeDocumento == null || nomeDocumento === '') {
        return null;
    }

    for (const voce of contenutoLavorazioni) {
        if (voce != null && voce.file == nomeDocumento) {
            return voce;
        }
    }

    return null;
}

module.exports = {
    trovaLavorazione
};
