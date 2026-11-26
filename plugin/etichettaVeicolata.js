/// TASK-e758bd95: "Mostra etichetta veicolata".
///
/// Selezionando un campo di un box impaginato il Plugin mostra "Selezionato il campo <nome>". Per le
/// agenzie che lo abilitano (mostraEtichettaVeicolata nella configurazione, oggi Edro21) sotto c'e'
/// anche "Mostra etichetta veicolata": dice da quali campi del record del tracciato Istanta ha
/// composto quel campo, ognuno con il suo valore. La provenienza la dichiara la libreria
/// dell'agenzia nel campo compilato (veicolatoDa); un elenco vuoto vuol dire testo fisso del box.
///
/// Il campo resta selezionato: dal campo si risale al box, dal box al DNA, e la scheda si scarica a
/// parte (getSchedaRef), senza toccare la scheda aperta ne' la selezione di InDesign.
///
/// SI CARICA SOTTO NODE: le funzioni pure si provano chiamandole, mostra con le dipendenze finte.

const EtichettaVeicolata = {

    TESTO_PULSANTE: "Mostra etichetta veicolata",

    /// Se il pulsante va offerto: solo se la configurazione dell'agenzia lo abilita.
    abilitato(middleware) {
        try {
            return middleware != null && middleware.getCampo("mostraEtichettaVeicolata") === true;
        }
        catch (e) {
            return false;
        }
    },

    /// Il box di un campo: il primo antenato appoggiato sullo spread, come fa "Fix foto". null se il
    /// campo non sta in un box.
    boxDelCampo(elemento) {
        let corrente = elemento;
        for (let giri = 0; corrente != null && giri < 50; giri++) {
            const genitore = corrente.parent;
            if (genitore == null) {
                return null;
            }
            if (genitore.constructor != null && genitore.constructor.name === "Spread") {
                return corrente === elemento ? null : corrente;
            }
            corrente = genitore;
        }
        return null;
    },

    /// Il nome del campo senza la chiave ("prezzo_continuo$KgL" -> "prezzo_continuo") e senza il DNA.
    nomeSemplice(label) {
        return String(label == null ? "" : label).split("$")[0].trim().toLowerCase();
    },

    /// Il record primario della scheda: quello con StatoSelezione 1, o il primo.
    primario(records) {
        const elenco = Array.isArray(records) ? records : [];
        return elenco.find(r => r != null && r.recordInTracciato != null && r.recordInTracciato.StatoSelezione == 1) || elenco[0] || null;
    },

    /// Il campo compilato del primario che corrisponde al campo selezionato, o null.
    campoCompilato(records, labelCampo) {
        const primario = this.primario(records);
        const campi = primario != null && primario.recordInTracciato != null && Array.isArray(primario.recordInTracciato.compiledFields)
            ? primario.recordInTracciato.compiledFields : [];
        const nome = this.nomeSemplice(labelCampo);
        return campi.find(c => c != null && this.nomeSemplice(c.labelName) === nome) || null;
    },

    /// Un valore del record come lo legge l'operatore.
    valoreLeggibile(valore) {
        if (valore == null || String(valore).trim() === "") {
            return "(vuoto)";
        }
        if (typeof valore === "object") {
            try {
                return JSON.stringify(valore);
            }
            catch (e) {
                return String(valore);
            }
        }
        return String(valore);
    },

    /// Cosa mostrare per un campo della scheda:
    /// { esito: "assente" } se il campo non e' fra i compilati del box;
    /// { esito: "nonDichiarata", campo } se l'agenzia non ne dichiara la provenienza;
    /// { esito: "testoFisso", campo } se e' un testo fisso del box;
    /// { esito: "veicolata", campo, righe: [{ campo, valore }] } altrimenti, con i valori del primario.
    veicolatura(records, labelCampo) {
        const campo = this.campoCompilato(records, labelCampo);
        if (campo == null) {
            return { esito: "assente" };
        }
        if (!Array.isArray(campo.veicolatoDa)) {
            return { esito: "nonDichiarata", campo: campo };
        }
        if (campo.veicolatoDa.length === 0) {
            return { esito: "testoFisso", campo: campo };
        }
        const primario = this.primario(records);
        const record = primario != null && primario.recordInTracciato != null ? primario.recordInTracciato : {};
        return {
            esito: "veicolata",
            campo: campo,
            righe: campo.veicolatoDa.map(nome => ({ campo: String(nome), valore: this.valoreLeggibile(record[nome]) }))
        };
    },

    /// La scheda del box scaricata a parte, come Promise: i records, o null.
    scaricaScheda(schedaRef, dna) {
        return new Promise(function (resolve) {
            try {
                schedaRef.getSchedaRef(dna.codice_gruppo, function (errore, scheda) {
                    resolve(errore == null && scheda != null && Array.isArray(scheda.records) ? scheda.records : null);
                }, dna.idRec, true, dna.idLavRec);
            }
            catch (e) {
                console.error("Code ETV-03 Scheda del box non scaricata:", e);
                resolve(null);
            }
        });
    },

    /// Il pulsante: dal campo al box, dal box al DNA, la scheda, poi la finestra con la provenienza.
    /// La selezione non cambia. ambiente: { Utility, schedaRef, Modali, messaggioUtente, $ }.
    async mostra(elemento, ambiente) {
        const amb = ambiente || {};
        const avvisa = amb.messaggioUtente || function () { };
        const nomeCampo = this.nomeSemplice(elemento != null ? elemento.label : "");
        const box = this.boxDelCampo(elemento);
        const dna = box != null ? amb.Utility.getDnaOfBox(box) : null;
        if (dna == null || !dna.codice_gruppo) {
            avvisa("Code ETV-01 Il campo " + nomeCampo + " non sta in un box impaginato riconoscibile: niente da mostrare", "warning", false, 5);
            return null;
        }
        const records = await this.scaricaScheda(amb.schedaRef, dna);
        if (records == null) {
            avvisa("Code ETV-02 Scheda del box " + dna.codice_gruppo + " non scaricata: riprova", "error", false, 5);
            return null;
        }
        const esito = this.veicolatura(records, elemento.label);
        amb.Modali.popup("Etichetta veicolata: " + nomeCampo, this.contenuto(esito, nomeCampo, amb.$));
        return esito;
    },

    /// Il contenuto della finestra, come testo e non come HTML.
    contenuto(esito, nomeCampo, $) {
        const corpo = $('<div style="padding: 8px; font-size: 12px;"></div>');
        const riga = (testo) => $('<div style="margin-bottom: 6px;"></div>').text(testo);
        if (esito.esito === "assente") {
            return corpo.append(riga("Il campo " + nomeCampo + " non e' fra i campi che Istanta compone per questo box."));
        }
        if (esito.esito === "nonDichiarata") {
            return corpo.append(riga("Per il campo " + nomeCampo + " la provenienza non e' dichiarata."));
        }
        if (esito.esito === "testoFisso") {
            return corpo.append(riga("Il campo " + nomeCampo + " e' un testo fisso del box: non viene da campi del record."));
        }
        corpo.append(riga("Il campo " + nomeCampo + " e' composto da " + (esito.righe.length === 1 ? "questo campo" : "questi campi") + " del record:"));
        esito.righe.forEach(r => {
            const voce = $('<div style="display: flex; gap: 8px; margin: 2px 0;"></div>');
            voce.append($('<span style="font-weight: bold; min-width: 40%; word-break: break-word;"></span>').text(r.campo));
            voce.append($('<span style="word-break: break-word;"></span>').text(r.valore));
            corpo.append(voce);
        });
        return corpo;
    }
};

module.exports = EtichettaVeicolata;
