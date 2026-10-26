/*
 * I20-973: ordine con cui compaiono le promo e i loro tracciati nella pagina Tracciati.
 *
 * Il server non ordina nulla: promo e tracciati arrivano nell'ordine in cui sono stati
 * inseriti, cioe' dal piu' vecchio, e chi importava del materiale se lo ritrovava in fondo.
 * Qui gli elenchi tornano dal piu' recente.
 *
 * Le due date non sono la stessa cosa: una promo ha la sua data di registrazione, mentre un
 * tracciato non porta nessuna data e prende quella dell'importazione da cui viene.
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
 * I20-1119: qui c'e' anche come si chiama un tracciato nelle liste. Una promo puo' avere piu'
 * tracciati con lo stesso canale e area, distinti dal contesto del tracciato (per esempio il tema):
 * l'importazione ne crea uno nuovo quando il contesto non coincide. Con la sola sigla sembravano
 * doppioni, nel revisore e nella pagina Tracciati.
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

        conIstante.sort(ordinamentoTracciati.confrontaIstanti);

        return conIstante.map(function (voce) { return voce.tracciato; });
    },

    /// Quando la promo e' stata registrata, in millisecondi, oppure null se non si sa.
    istanteDiRegistrazione(promo) {
        if (promo == null) {
            return null;
        }

        const data = promo.dataRegistrazione != null ? promo.dataRegistrazione : promo.DataRegistrazione;
        if (data == null || data === "") {
            return null;
        }

        const istante = new Date(data).getTime();
        return isNaN(istante) ? null : istante;
    },

    /// Le promo dalla piu' recente. L'elenco ricevuto non viene toccato.
    /// Una promo senza data di registrazione finisce in fondo, come i tracciati senza data.
    promoDallaPiuRecente(promo) {
        if (!Array.isArray(promo)) {
            return promo;
        }

        const conIstante = promo.map(function (voce) {
            return { promo: voce, istante: ordinamentoTracciati.istanteDiRegistrazione(voce) };
        });

        conIstante.sort(ordinamentoTracciati.confrontaIstanti);

        return conIstante.map(function (voce) { return voce.promo; });
    },

    /// Dal piu' recente, con le date ignote in fondo. Chi non sa quando e' arrivato non
    /// puo' pretendere la cima, e due date uguali lasciano l'ordine come l'hanno trovato.
    confrontaIstanti(a, b) {
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
    },

    /// I20-1119: i campi di un contesto salvato ([{nome_field, user_value}], in JSON), come
    /// "tema: MC". I valori vuoti si saltano; un contesto che manca o non si legge non ne ha.
    campiDelContesto(contesto) {
        let campi = contesto;
        if (typeof contesto === "string") {
            if (contesto.trim() === "") {
                return [];
            }
            try {
                campi = JSON.parse(contesto);
            }
            catch (e) {
                return [];
            }
        }
        if (!Array.isArray(campi)) {
            return [];
        }

        const testi = [];
        campi.forEach(campo => {
            if (campo == null || campo.nome_field == null) {
                return;
            }
            const valore = campo.user_value == null ? "" : String(campo.user_value).trim();
            if (valore !== "") {
                testi.push(campo.nome_field + ": " + valore);
            }
        });
        return testi;
    },

    /// I20-1119: il nome del tracciato nelle liste: la sigla e il suo contesto, "SCTO · tema: MC".
    /// Senza contesto resta la sola sigla.
    etichetta(tracciato) {
        if (tracciato == null) {
            return "";
        }
        const sigla = tracciato.sigla != null ? tracciato.sigla : (tracciato.Sigla != null ? tracciato.Sigla : "");
        const contesto = tracciato.context != null ? tracciato.context : tracciato.Context;
        const campi = ordinamentoTracciati.campiDelContesto(contesto);
        return campi.length > 0 ? sigla + " · " + campi.join(", ") : String(sigla);
    }

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ordinamentoTracciati;
}
