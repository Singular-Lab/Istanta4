/*
 * I20-1027: quando lo scaricamento del pacchetto foto e' finito davvero, e cosa dirlo.
 *
 * La finestra "Scaricamento pacchetto foto" esegue fino a due fasi: il sync completo scarica le
 * foto (modo 0) e poi, da solo, loghi e bolli (modo 1). Prima di questo modulo la fine delle foto
 * scriveva gia' "Operazione completata" e la finestra ripartiva coi loghi: l'operatore non aveva
 * modo di sapere quando il processo fosse finito davvero, e la fine vera si riconosceva solo dalla
 * piccola croce ricomparsa in testata.
 *
 * Qui vive solo la decisione: questa fase chiude il processo? che messaggio va mostrato? va
 * mostrato il pulsante Fine? Le operazioni sulla finestra stanno in reperimentoFoto.js, cosi' la
 * regola resta priva di dipendenze da InDesign e verificabile sotto Node.
 */

const fineScaricamento = {

    //I modi di avviaSyncPacchettoFoto.
    modi: {
        pacchettoFoto: 0,
        loghiBolli: 1,
        listaCodici: 2
    },

    //Come e' finita una fase. L'annullamento non c'e': chiude la finestra da se', senza Fine.
    esiti: {
        completato: "completato",
        nonRiuscito: "nonRiuscito"
    },

    messaggi: {
        completata: "Operazione completata",
        fotoScaricate: "Foto scaricate. Avvio dello scaricamento di loghi e bolli...",
        nonRiuscito: "Scaricamento non riuscito",
        terminata: "Operazione terminata"
    },

    /// Cosa mostrare quando una fase dello scaricamento termina.
    /// Ritorna { concluso, messaggio, mostraFine }.
    ///
    /// Le foto completate non sono la fine: dopo di loro partono loghi e bolli, e il messaggio lo
    /// dice invece di dire "completata". Un errore e' sempre la fine, in ogni modo: il processo si
    /// ferma, e la finestra non deve restare senza un modo per chiuderla. Per lo stesso motivo un
    /// modo sconosciuto mostra Fine, con un messaggio che non promette niente.
    statoAlTermine(modo, esito) {
        if (esito === fineScaricamento.esiti.nonRiuscito) {
            return { concluso: true, messaggio: fineScaricamento.messaggi.nonRiuscito, mostraFine: true };
        }

        if (modo === fineScaricamento.modi.pacchettoFoto) {
            return { concluso: false, messaggio: fineScaricamento.messaggi.fotoScaricate, mostraFine: false };
        }

        if (modo === fineScaricamento.modi.loghiBolli || modo === fineScaricamento.modi.listaCodici) {
            return { concluso: true, messaggio: fineScaricamento.messaggi.completata, mostraFine: true };
        }

        return { concluso: true, messaggio: fineScaricamento.messaggi.terminata, mostraFine: true };
    }
};

module.exports = fineScaricamento;
