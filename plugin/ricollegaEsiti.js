/// I20-986: le regole del ricollegamento che non toccano InDesign.
///
/// Stanno qui, e non dentro alle funzioni che le usavano, per due motivi. Il primo e' che cosi'
/// si possono provare da sole: sono la parte che decide cosa dire all'operatore e dove mettere
/// una foto nuova, ed e' esattamente la parte dove si nascondevano i difetti. Il secondo e' che
/// le due funzioni chiamate ricollega, quella del box e quella massiva delle foto, stanno in
/// file diversi e ripetevano le stesse decisioni in modi leggermente diversi.

const RicollegaEsiti = {

    /// Gli stati che il server manda indietro per ogni elemento del ricollegamento.
    STATO: {
        giaImpaginato: 1,
        autoImpaginato: 2,
        cambioDiForma: 3,
        inesistenteNellaPromo: 4,
        inesistente: 5,
        clonato: 6,
        richiestaClonazione: 7
    },

    /// Cosa dire all'operatore per un elemento tornato dal ricollegamento del box, oppure niente
    /// se non c'e' niente da dire.
    ///
    /// Il caso che contava: il server scrive l'errore dentro al singolo elemento, e chi chiamava
    /// guardava solo l'errore generale. Un ricollegamento fallito passava quindi per riuscito,
    /// con la scheda che si aggiornava come se fosse andata bene.
    messaggioPerElemento(elemento) {
        if (elemento == null) {
            return null;
        }

        if (elemento.error != null && elemento.error !== "") {
            return { testo: "Code SRF-16 Ricollegamento non riuscito: " + elemento.error, tipo: "error" };
        }

        if (elemento.stato === RicollegaEsiti.STATO.giaImpaginato) {
            return { testo: "Code SRF-12 Referenza già impaginata", tipo: "warning" };
        }

        if (elemento.stato === RicollegaEsiti.STATO.cambioDiForma) {
            return { testo: "Code SRF-17 " + RicollegaEsiti.descrizioneCambioDiForma(elemento), tipo: "warning" };
        }

        if (elemento.stato === RicollegaEsiti.STATO.inesistente ||
            elemento.stato === RicollegaEsiti.STATO.inesistenteNellaPromo) {
            return { testo: "Code SRF-11 Referenza inesistente nello storico, ricollegamento non possibile", tipo: "error" };
        }

        return null;
    },

    /// Il cambio di forma va spiegato, non nascosto: il box resta non impaginato, e senza una
    /// spiegazione sembra che il ricollegamento sia riuscito e che poi si sia perso qualcosa.
    descrizioneCambioDiForma(elemento) {
        const presenti = RicollegaEsiti.elencoCodici(elemento != null ? elemento.codiciPresenti : null);
        const mancanti = RicollegaEsiti.elencoCodici(elemento != null ? elemento.codiciNonEsistenti : null);

        let testo = "Il codice è già in lavorazione in un'altra forma";
        if (presenti !== "") {
            testo += ": " + presenti;
        }
        testo += ". Ricollegamento non effettuato";
        if (mancanti !== "") {
            testo += ". Non presenti in lavorazione: " + mancanti;
        }

        return testo + ".";
    },

    elencoCodici(codici) {
        return Array.isArray(codici) ? codici.filter(c => c != null && c !== "").join(", ") : "";
    },

    /// Dove mettere una foto che va creata: sopra a quella che c'e' gia', se c'e', altrimenti
    /// sopra al gruppo, spostata di poco per non finire esattamente sotto l'altra.
    ///
    /// Era il punto in cui il codice leggeva l'elemento prima di dichiararlo, e chi non aveva
    /// gia' una foto nel box si prendeva un errore invece della foto nuova.
    boundsNuovaFoto(boundsEsistente, boundsGruppo) {
        const partenza = RicollegaEsiti.boundsValidi(boundsEsistente)
            ? boundsEsistente
            : (RicollegaEsiti.boundsValidi(boundsGruppo) ? boundsGruppo : null);

        if (partenza == null) {
            return null;
        }

        return [partenza[0] + 5, partenza[1] + 5, partenza[2] + 5, partenza[3] + 5];
    },

    boundsValidi(bounds) {
        return Array.isArray(bounds) && bounds.length >= 4 && bounds.every(v => typeof v === "number" && !isNaN(v));
    },

    /// Il nome del file di esito. Porta sempre l'istante, anche quando l'operazione fallisce:
    /// senza, due tentativi andati male si sovrascrivevano e restava solo l'ultimo, cioe' proprio
    /// il caso in cui il rapporto serve.
    nomeFileEsito(nomeDocumento, istante) {
        const documento = (nomeDocumento || "documento").replace(".indd", "");
        const quando = (istante instanceof Date ? istante : new Date())
            .toISOString().replace("T", "_").replace(/:/g, "-").split(".")[0];

        return "EsitoRicollegamentoFoto_" + documento + "_" + quando + ".json";
    },

    /// Il codice della foto come lo scrive la mappatura dell'impaginato. I messaggi leggevano un
    /// campo che non esiste, e all'operatore arrivava la parola indefinito al posto del codice.
    codiceDellaFoto(foto) {
        if (foto == null) {
            return "";
        }

        return foto.codiceFoto != null && foto.codiceFoto !== "" ? foto.codiceFoto : "";
    },

    messaggioDatoManomesso(codiceGruppo, foto) {
        const codice = RicollegaEsiti.codiceDellaFoto(foto);

        return "Code IDX-156 Dato manomesso per il codice gruppo " + codiceGruppo +
            " - Foto.Nome del codice: " + (codice !== "" ? codice : "non indicato") +
            " non è stato trovato, ma la foto è presente. Ricollegamento foto non possibile.";
    },

    /// Una secondaria il cui codice non e' piu' in tracciato veniva saltata senza dire niente:
    /// l'impaginato restava con una foto che non corrisponde a nessuna referenza, e nel rapporto
    /// non ne restava traccia.
    messaggioSecondariaSparita(codiceGruppo, foto) {
        const codice = RicollegaEsiti.codiceDellaFoto(foto);

        return "Code IDX-163 La foto secondaria del codice " + (codice !== "" ? codice : "non indicato") +
            " nel gruppo " + codiceGruppo + " non corrisponde piu' a nessuna referenza in tracciato: " +
            "va tolta o aggiornata a mano, oppure si usi la modalità avanzata.";
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = RicollegaEsiti;
}
