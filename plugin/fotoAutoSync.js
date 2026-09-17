/*
 * I20-967: al cambio foto, se la foto non e' nei Links, deve essere scaricata e impaginata
 * da sola, senza che l'operatore prema prima "scarica" e poi "impagina".
 *
 * Qui vive solo la decisione: c'e' gia'? serve chiederla al server? il file e' arrivato davvero?
 * Le operazioni concrete (filesystem UXP, chiamata a Istanta, download da Olimpo) arrivano
 * dall'esterno, cosi' questo modulo resta privo di dipendenze da InDesign e verificabile.
 */

const fotoAutoSync = {

    //Esiti possibili, esposti per non doverli scrivere a mano nei chiamanti e nei test.
    esiti: {
        nomeMancante: "nomeMancante",
        giaPresente: "giaPresente",
        guidMancante: "guidMancante",
        infoNonRecuperata: "infoNonRecuperata",
        downloadFallito: "downloadFallito",
        fotoAncoraAssente: "fotoAncoraAssente",
        scaricata: "scaricata"
    },

    /*
     * operazioni:
     *  - fotoPresente(nomeFoto)  -> true se il file e' gia' nella cartella Links
     *  - infoFoto(guidId)        -> record foto del server (id, fileName, size, fileHash) oppure null
     *  - scarica(recordFoto)     -> scarica il file nella cartella Links
     *
     * Ritorna { presente, scaricata, motivo }. Il chiamante impagina comunque: se presente e'
     * false si ricade sul comportamento precedente, con la riga di errore e i pulsanti manuali.
     */
    async assicuraFotoNeiLinks(nomeFoto, guidId, operazioni) {
        const esito = { presente: false, scaricata: false, motivo: null };

        if (nomeFoto == null || nomeFoto === "") {
            esito.motivo = fotoAutoSync.esiti.nomeMancante;
            return esito;
        }

        if (operazioni == null || operazioni.fotoPresente == null) {
            esito.motivo = fotoAutoSync.esiti.infoNonRecuperata;
            return esito;
        }

        if (await operazioni.fotoPresente(nomeFoto)) {
            esito.presente = true;
            esito.motivo = fotoAutoSync.esiti.giaPresente;
            return esito;
        }

        if (guidId == null || guidId === "") {
            esito.motivo = fotoAutoSync.esiti.guidMancante;
            return esito;
        }

        let recordFoto = null;
        try {
            recordFoto = await operazioni.infoFoto(guidId);
        }
        catch (e) {
            console.log("fotoAutoSync: info foto non recuperata: " + e);
            esito.motivo = fotoAutoSync.esiti.infoNonRecuperata;
            return esito;
        }

        if (recordFoto == null || recordFoto.fileName == null || recordFoto.fileName === "") {
            esito.motivo = fotoAutoSync.esiti.infoNonRecuperata;
            return esito;
        }

        try {
            await operazioni.scarica(recordFoto);
        }
        catch (e) {
            console.log("fotoAutoSync: scaricamento fallito: " + e);
            esito.motivo = fotoAutoSync.esiti.downloadFallito;
            return esito;
        }

        //Il download puo' concludersi senza eccezioni e lasciare comunque la cartella senza il file.
        esito.presente = await operazioni.fotoPresente(nomeFoto);
        esito.scaricata = esito.presente;
        esito.motivo = esito.presente ? fotoAutoSync.esiti.scaricata : fotoAutoSync.esiti.fotoAncoraAssente;
        return esito;
    },

    /*
     * Impagina ritentando una volta sola.
     *
     * Un file appena scritto nella cartella Links puo' non essere ancora visibile a
     * InDesign quando place() parte subito dopo: il place fallisce e al suo posto
     * finisce il segnaposto di foto non trovata. Prima questo non si vedeva perche'
     * fra lo scaricamento e l'impaginazione c'era il tempo di premere un pulsante.
     *
     * operazioni:
     *  - impagina() -> risultato di FotoPlacer.updateFoto, con warning valorizzato se non ce l'ha fatta
     *  - attendi()  -> pausa fra il primo tentativo e il secondo
     */
    async impaginaConRitentativo(operazioni) {
        let esito = await operazioni.impagina();

        if (esito == null || esito.warning == null || esito.warning === "") {
            return esito;
        }

        await operazioni.attendi();
        const secondo = await operazioni.impagina();

        if (secondo != null) {
            secondo.ritentata = true;
        }
        return secondo;
    }

}

module.exports = fotoAutoSync;
