/*
 * I20-973: ordine con cui compaiono i tracciati di una promo.
 *
 * Il server restituisce i tracciati nell'ordine in cui sono stati inseriti, cioe' dal piu'
 * vecchio, e chi importa un tracciato se lo ritrovava in fondo all'elenco. Qui i tracciati
 * tornano dal piu' recente.
 *
 * L'ordinamento e' stabile e si applica dopo quello per sigla di agenzia.js: la data
 * comanda, e fra tracciati arrivati con la stessa importazione, che e' il caso normale
 * perche' un file ne genera molti insieme, resta l'ordine per canale e area.
 *
 * PromoTracciati non porta una data: quella dell'importazione sta su PromoImportazioni,
 * che la promo espone accanto ai tracciati, e si raggiunge per idImportazione. Un tracciato
 * di cui non si trova l'importazione ha data ignota e finisce in fondo, senza scompaginare
 * l'ordine per sigla degli altri: meglio un posto prevedibile che un confronto inventato.
 *
 * Il modulo non dipende dal browser. In Node si esporta per i test (tests/istanta-web).
 */

const ordinamentoTracciati = {

    /// L'identificativo dell'importazione da cui viene il tracciato.
    idImportazioneDi(tracciato) {
        if (tracciato == null) {
            return null;
        }
        const id = tracciato.idImportazione != null ? tracciato.idImportazione : tracciato.IdImportazione;
        return id == null ? null : id;
    },

    /// Quando il tracciato e' stato caricato, in millisecondi, oppure null se non si sa.
    istanteDiCaricamento(tracciato, importazioni) {
        const idImportazione = ordinamentoTracciati.idImportazioneDi(tracciato);
        if (idImportazione == null || !Array.isArray(importazioni)) {
            return null;
        }

        for (let i = 0; i < importazioni.length; i++) {
            const importazione = importazioni[i];
            if (importazione == null) {
                continue;
            }

            const id = importazione.id != null ? importazione.id : importazione.Id;
            if (id != idImportazione) {
                continue;
            }

            const data = importazione.dataCaricamento != null ? importazione.dataCaricamento : importazione.DataCaricamento;
            if (data == null || data === "") {
                return null;
            }

            const istante = new Date(data).getTime();
            return isNaN(istante) ? null : istante;
        }

        return null;
    },

    /// I tracciati dal piu' recente. L'elenco ricevuto non viene toccato.
    dalPiuRecente(tracciati, importazioni) {
        if (!Array.isArray(tracciati)) {
            return tracciati;
        }

        //L'istante si calcola una volta sola: il confronto viene richiamato molte volte e
        //rileggere le importazioni a ogni passaggio costerebbe senza dare nulla in piu'.
        const conIstante = tracciati.map(function (tracciato) {
            return { tracciato: tracciato, istante: ordinamentoTracciati.istanteDiCaricamento(tracciato, importazioni) };
        });

        conIstante.sort(function (a, b) {
            if (a.istante == null && b.istante == null) {
                return 0;
            }
            if (a.istante == null) {
                return 1;
            }
            if (b.istante == null) {
                return -1;
            }
            return b.istante - a.istante;
        });

        return conIstante.map(function (voce) { return voce.tracciato; });
    }

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ordinamentoTracciati;
}
