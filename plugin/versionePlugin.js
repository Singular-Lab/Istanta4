/// I20-987: la versione installata e quella pubblicata devono coincidere.
///
/// Lavorare con un Plugin che non e' quello pubblicato per il cliente vuol dire lavorare con
/// regole diverse da quelle del server: i difetti che ne nascono non si vedono subito e si
/// scoprono a impaginato fatto. Il confronto sta qui, separato dal Plugin, perche' e' una regola
/// e non un pezzo di interfaccia, e perche' cosi' si puo' provare da sola.

const VersionePlugin = {

    ESITO: {
        allineata: "allineata",
        disallineata: "disallineata",
        nonVerificabile: "nonVerificabile"
    },

    /// Confronta la versione installata con quella pubblicata.
    ///
    /// Quando una delle due non si sa, l'esito non e' "disallineata" ma "non verificabile", e
    /// sono due cose diverse: il controllo gira a ogni avvio, e se il server non risponde
    /// bloccare vorrebbe dire fermare il lavoro di tutti per un guasto che non e' loro. Si blocca
    /// solo su una differenza vera.
    confronta(installata, pubblicata) {
        const qui = VersionePlugin.ripulisci(installata);
        const la = VersionePlugin.ripulisci(pubblicata);

        if (qui === "" || la === "") {
            return VersionePlugin.ESITO.nonVerificabile;
        }

        return qui === la ? VersionePlugin.ESITO.allineata : VersionePlugin.ESITO.disallineata;
    },

    ripulisci(versione) {
        return typeof versione === "string" ? versione.trim() : "";
    },

    /// Se con questo esito si puo' continuare a lavorare.
    siPuoLavorare(esito) {
        return esito !== VersionePlugin.ESITO.disallineata;
    },

    /// Cosa mostrare quando le due versioni non coincidono. Dice tutte e due le versioni, perche'
    /// senza non si capisce se si deve aggiornare o se si e' andati avanti troppo, e dice cosa
    /// fare: il messaggio lo legge chi impagina, non chi ha scritto il codice.
    messaggioDisallineamento(installata, pubblicata) {
        return {
            titolo: "Versione del Plugin non aggiornata",
            dettaglio: "Hai installato la versione " + VersionePlugin.ripulisci(installata) +
                " mentre quella pubblicata per il tuo cliente e' la " + VersionePlugin.ripulisci(pubblicata) +
                ". Scarica il Plugin da Istanta e reinstallalo prima di continuare a lavorare."
        };
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = VersionePlugin;
}
