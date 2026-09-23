/*
 * I20-981 (Lotto 4a): la sezione Confronti del Report Integrita', nella modalita' che si apre
 * per prima, il confronto della lista con se stessa.
 *
 * Istanta, quando importa una nuova versione del tracciato, tiene da parte il valore che un
 * campo aveva prima: e' la chiave "Alterazioni" del record, nella forma campo -> valore
 * precedente. Qui si guardano solo i campi che l'agenzia dichiara di tenere d'occhio: non
 * cambiano l'aspetto del box, quindi l'analisi di integrita' non li considera, ma l'operatore
 * li usa per decidere a che pagina va la referenza, e se cambiano la pagina puo' cambiare.
 *
 * Il confronto evidenzia e basta: non propone correzioni.
 *
 * Esecuzione dei test: node --test tests/plugin/reportConfronti.test.js
 */

const CHIAVE_ALTERAZIONI = "Alterazioni";

/// Il valore di un campo come lo legge chi guarda il report: mai "null" o "undefined" scritti
/// per esteso, che a schermo confondono con un valore vero.
function valoreLeggibile(valore) {
    if (valore == null) {
        return "";
    }

    if (typeof valore === "object") {
        try {
            return JSON.stringify(valore);
        }
        catch (err) {
            return String(valore);
        }
    }

    return String(valore);
}

/// Due valori sono uguali se si leggono uguali: il tracciato porta numeri scritti a volte come
/// stringa e a volte come numero, e una differenza di tipo non e' una differenza per l'operatore.
function sonoUguali(primo, secondo) {
    return valoreLeggibile(primo).trim() === valoreLeggibile(secondo).trim();
}

/// Le differenze di un record fra il valore di adesso e quello che aveva prima.
/// Restituisce una voce per ogni campo osservato che risulta cambiato: campo, etichetta,
/// valore precedente e valore attuale.
function differenzeDelRecord(record, campiOsservati) {
    const dato = record || {};
    const alterazioni = dato[CHIAVE_ALTERAZIONI];

    if (alterazioni == null || typeof alterazioni !== "object") {
        return [];
    }

    const differenze = [];

    (campiOsservati || []).forEach(campo => {
        const chiave = campo && (campo.keyInRecordInTracciato || campo.campo || campo.chiave);
        if (chiave == null || chiave === "") {
            return;
        }

        //Un campo che non compare fra le alterazioni non e' cambiato: non c'e' niente da dire.
        if (!Object.prototype.hasOwnProperty.call(alterazioni, chiave)) {
            return;
        }

        const prima = alterazioni[chiave];
        const adesso = dato[chiave];

        //Puo' capitare che il valore risulti alterato ma si legga uguale (un numero diventato
        //stringa): per l'operatore non e' una differenza, e segnalarla sarebbe rumore.
        if (sonoUguali(prima, adesso)) {
            return;
        }

        differenze.push({
            campo: chiave,
            etichetta: (campo && campo.label) || chiave,
            prima: valoreLeggibile(prima),
            adesso: valoreLeggibile(adesso)
        });
    });

    return differenze;
}

/// Le referenze con almeno una differenza, nell'ordine in cui stanno nella lista.
/// Si guardano i soli primari: sono loro a stare in pagina, e il gruppo si impagina da li'.
function confrontoConSeStessa(recordsLista, campiOsservati) {
    const risultato = [];

    (recordsLista || []).forEach(voce => {
        const dato = voce && voce.recordInTracciato ? voce.recordInTracciato : voce;
        if (dato == null) {
            return;
        }

        if (Number(dato.StatoSelezione) !== 1) {
            return;
        }

        const differenze = differenzeDelRecord(dato, campiOsservati);
        if (differenze.length === 0) {
            return;
        }

        risultato.push({
            codiceGruppo: valoreLeggibile(dato["Scatto.CodiceGruppo"]),
            etichettaTracciato: valoreLeggibile(dato["Tracciato.Label"]),
            versioneTracciato: valoreLeggibile(dato["Tracciato.Versione"]),
            raw: dato,
            differenze: differenze
        });
    });

    return risultato;
}

module.exports = {
    CHIAVE_ALTERAZIONI,
    valoreLeggibile,
    sonoUguali,
    differenzeDelRecord,
    confrontoConSeStessa
};
