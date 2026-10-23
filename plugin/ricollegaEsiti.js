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

    /// I20-1124: l'esito di una risposta intera di Menabo/ricollegaBox, per chi la attende dal
    /// Report Integrita' e non apre la scheda: "ricollegato" (gia' impaginato, auto impaginato o
    /// cambio di forma non fermano il report), "clonazione" (il server chiede di clonare: lo si
    /// dice e si lascia fare dalla scheda), "errore" con il messaggio da mostrare.
    esitoDellaRisposta(risposta) {
        if (risposta == null) {
            return { esito: "errore", messaggio: "Code SRF-13 Ricollegamento fallito: nessuna risposta", messaggi: [] };
        }
        const messaggi = [];
        const codici = Array.isArray(risposta.codici) ? risposta.codici : [];
        codici.forEach(elemento => {
            const avviso = RicollegaEsiti.messaggioPerElemento(elemento);
            if (avviso != null) {
                messaggi.push(avviso);
            }
        });
        if (risposta.error != null && risposta.error !== "") {
            return { esito: "errore", messaggio: "Code SRF-13 Ricollegamento fallito: " + risposta.error, messaggi };
        }
        if (codici.length === 0) {
            return { esito: "errore", messaggio: "Code SRF-13 Ricollegamento fallito: il server non ha risposto per nessun codice", messaggi };
        }
        const primo = codici[0];
        if (primo.error != null && primo.error !== "") {
            return { esito: "errore", messaggio: "Code SRF-16 Ricollegamento non riuscito: " + primo.error, messaggi };
        }
        if (primo.stato === RicollegaEsiti.STATO.richiestaClonazione) {
            return { esito: "clonazione", messaggio: "Il server chiede di clonare la referenza: aprire la scheda del box e ricollegare da li'", messaggi };
        }
        if (primo.stato === RicollegaEsiti.STATO.giaImpaginato ||
            primo.stato === RicollegaEsiti.STATO.autoImpaginato ||
            primo.stato === RicollegaEsiti.STATO.cambioDiForma) {
            return { esito: "ricollegato", messaggio: null, messaggi, idRecSelezionato: risposta.idRecSelezionato != null ? risposta.idRecSelezionato : null };
        }
        return { esito: "errore", messaggio: "Code SRF-11 Referenza inesistente nello storico, ricollegamento non possibile", messaggi };
    },

    /// Cosa rappresenta un rettangolo del box, leggendone l'etichetta: la foto primaria, una
    /// secondaria, oppure niente. Restituisce anche il codice della referenza a cui la foto e'
    /// associata, che serve a ritrovarla in tracciato.
    ///
    /// Stava scritta due volte dentro alla mappatura dell'impaginato, una per quando si mappa
    /// tutto il documento e una per quando si mappano pagine scelte, e le due copie erano
    /// divergenti: la seconda il codice non lo registrava. Chi mappa una pagina sola avrebbe
    /// quindi ottenuto foto senza codice, la referenza non si sarebbe trovata e la foto sarebbe
    /// passata per una secondaria non piu' esistente, che in modalita' avanzata vuol dire
    /// metterla in coda per la rimozione (I20-986).
    fotoDallaLabel(etichetta, nomePrimaria, nomeSecondaria) {
        if (typeof etichetta !== "string" || etichetta === "") {
            return null;
        }

        const primaria = RicollegaEsiti.nomeCampo(nomePrimaria, "immagine");
        const secondaria = RicollegaEsiti.nomeCampo(nomeSecondaria, "foto_secondaria");

        let statoSelezione = 0;
        if (etichetta.startsWith(primaria)) {
            statoSelezione = 1;
        }
        else if (etichetta.startsWith(secondaria)) {
            statoSelezione = 2;
        }
        else {
            return null;
        }

        const parti = etichetta.split("$");
        return { statoSelezione: statoSelezione, codiceFoto: parti.length > 1 ? parti[1] : "" };
    },

    /// Il nome del campo configurato, o quello di sempre se non e' configurato. Il controllo era
    /// fatto solo contro il valore nullo: un campo non definito passava per configurato e si
    /// finiva a cercare etichette che cominciano per indefinito.
    nomeCampo(nome, predefinito) {
        return typeof nome === "string" && nome !== "" ? nome : predefinito;
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
    },

    /// I20-1134: le secondarie che il ricollegamento avanzato puo' rimettere nel box, cioe' quelle che
    /// il server ha messo fra le foto del gruppo del primario (membriGruppoFoto, statoSelezione 2).
    /// Nelle meccaniche BIS e 1+1 di Edro21 il server ne tiene una sola, e le altre selezionate nella
    /// lista non vanno ricreate. Il gruppo si legge dove lo legge l'impaginazione: il sottogruppo, se
    /// porta la lista, altrimenti il record. Senza la lista (dati scaricati prima) valgono tutte.
    secondariDaRicollegare(secondari, primario) {
        const elenco = Array.isArray(secondari) ? secondari : [];
        if (primario == null) {
            return elenco;
        }
        const sottogruppo = primario.sottogruppo;
        const tracciato = sottogruppo != null && Array.isArray(sottogruppo.membriGruppoFoto) ? sottogruppo : primario.recordInTracciato;
        const membri = tracciato != null && Array.isArray(tracciato.membriGruppoFoto) ? tracciato.membriGruppoFoto : null;
        if (membri == null) {
            return elenco;
        }
        const codici = membri
            .filter(m => m != null && m.statoSelezione == 2)
            .map(m => String(m.codRef));
        return elenco.filter(s => s != null && s.recordInTracciato != null
            && codici.indexOf(String(s.recordInTracciato["Referenza.Codice"])) >= 0);
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = RicollegaEsiti;
}
