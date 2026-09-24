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
            idRec: idRecDelRecord(dato),
            etichettaTracciato: valoreLeggibile(dato["Tracciato.Label"]),
            versioneTracciato: valoreLeggibile(dato["Tracciato.Versione"]),
            raw: dato,
            differenze: differenze
        });
    });

    return risultato;
}

/// L'idRec di un record, come lo legge il resto del plugin: lo stesso codice gruppo puo'
/// comparire piu' volte con idRec diversi, e sono presenze diverse.
function idRecDelRecord(record) {
    const dato = record || {};
    const valore = dato.idRec != null ? dato.idRec : dato.IdRec;

    if (valore == null || valore === "") {
        return null;
    }

    const numero = parseInt(valore, 10);
    return isNaN(numero) ? null : numero;
}

/// La chiave con cui si aggancia una referenza della lista al suo box in pagina.
function chiavePresenza(codiceGruppo, idRec) {
    const codice = valoreLeggibile(codiceGruppo);
    const numero = idRec == null || idRec === "" || isNaN(Number(idRec)) ? "" : String(Number(idRec));

    return codice + "|" + numero;
}

/// Le differenze indicizzate per presenza, cosi' che ogni riga del report possa cercare le
/// proprie senza riscorrere tutta la lista.
/// Una referenza senza idRec si trova anche cercandola col solo codice gruppo: e' il caso
/// normale, un gruppo che in pagina compare una volta sola.
function indicizzaPerPresenza(voci) {
    const indice = {};

    (voci || []).forEach(voce => {
        indice[chiavePresenza(voce.codiceGruppo, voce.idRec)] = voce;

        const soloCodice = chiavePresenza(voce.codiceGruppo, null);
        if (indice[soloCodice] == null) {
            indice[soloCodice] = voce;
        }
    });

    return indice;
}

/// Le differenze di una presenza, cercate prima per codice gruppo e idRec e poi, se non si
/// trova, col solo codice gruppo.
function differenzePerPresenza(indice, codiceGruppo, idRec) {
    if (indice == null) {
        return null;
    }

    const esatta = indice[chiavePresenza(codiceGruppo, idRec)];
    if (esatta != null) {
        return esatta;
    }

    return indice[chiavePresenza(codiceGruppo, null)] || null;
}

/// Le differenze in una riga sola, per il csv e per le tabelle: "Tema: Bio -> Base | Ruolo: ...".
function testoDifferenze(differenze, separatore = " | ") {
    return (differenze || [])
        .map(d => (d.etichetta || d.campo || "") + ": " + (d.prima || "(vuoto)") + " \u2192 " + (d.adesso || "(vuoto)"))
        .join(separatore);
}

//I20-981 (Lotto 4b): il confronto fra la lista corrente e un'altra lista della stessa promo.
//Le due liste vengono da lavorazioni diverse, e fra lavorazioni l'idRec cambia: ci si accoppia
//per codice gruppo, sui soli primari. Le differenze viaggiano su due canali, i campi osservati
//dall'agenzia e i campi compilati, cosi' l'operatore puo' spegnere un canale intero o tenere
//un campo solo, alla maniera di un foglio di calcolo.
const CANALE = Object.freeze({ osservato: "osservato", compilato: "compilato" });
const PRESENZA = Object.freeze({ entrambe: "entrambe", soloCorrente: "soloCorrente", soloAltra: "soloAltra" });
const FILTRO_PRESENZA = Object.freeze({ tutte: "tutte", comuni: "comuni", soloUna: "soloUna" });

/// I primari di una lista, per codice gruppo. Se un codice compare due volte come primario
/// vince il primo: la lista dice l'ordine, e non e' questo il posto per discuterlo.
function primariPerCodiceGruppo(records) {
    const indice = new Map();

    (records || []).forEach(voce => {
        const dato = voce && voce.recordInTracciato ? voce.recordInTracciato : voce;
        if (dato == null || Number(dato.StatoSelezione) !== 1) {
            return;
        }

        const codice = valoreLeggibile(dato["Scatto.CodiceGruppo"]);
        if (codice === "" || indice.has(codice)) {
            return;
        }

        indice.set(codice, dato);
    });

    return indice;
}

/// Le differenze sui campi osservati fra il dato della lista corrente e quello dell'altra.
function differenzeOsservate(datoCorrente, datoAltra, campiOsservati) {
    const differenze = [];

    (campiOsservati || []).forEach(campo => {
        const chiave = campo && (campo.keyInRecordInTracciato || campo.campo || campo.chiave);
        if (chiave == null || chiave === "") {
            return;
        }

        const corrente = (datoCorrente || {})[chiave];
        const altra = (datoAltra || {})[chiave];

        if (sonoUguali(corrente, altra)) {
            return;
        }

        differenze.push({
            canale: CANALE.osservato,
            campo: chiave,
            etichetta: (campo && campo.label) || chiave,
            corrente: valoreLeggibile(corrente),
            altra: valoreLeggibile(altra)
        });
    });

    return differenze;
}

/// I campi compilati per nome, come li porta il record: labelName e content.
function compilatiPerNome(dato) {
    const indice = new Map();
    const campi = dato && Array.isArray(dato.compiledFields) ? dato.compiledFields : [];

    campi.forEach(campo => {
        const nome = campo && campo.labelName != null ? String(campo.labelName) : "";
        if (nome === "" || indice.has(nome)) {
            return;
        }
        indice.set(nome, campo.content == null ? "" : String(campo.content));
    });

    return indice;
}

/// Le differenze sui campi compilati: si guarda l'unione dei nomi delle due parti, e un campo
/// che una lista ha e l'altra no e' una differenza come le altre, con il lato mancante vuoto.
/// Il contenuto si confronta com'e', tag di stile compresi: due descrizioni uguali nel testo ma
/// diverse nello stile finiscono in pagina diverse, e all'operatore serve saperlo.
function differenzeCompilate(datoCorrente, datoAltra) {
    const corrente = compilatiPerNome(datoCorrente);
    const altra = compilatiPerNome(datoAltra);
    const nomi = [];

    corrente.forEach((valore, nome) => nomi.push(nome));
    altra.forEach((valore, nome) => {
        if (!corrente.has(nome)) {
            nomi.push(nome);
        }
    });

    const differenze = [];

    nomi.forEach(nome => {
        const valoreCorrente = corrente.has(nome) ? corrente.get(nome) : "";
        const valoreAltra = altra.has(nome) ? altra.get(nome) : "";

        if (sonoUguali(valoreCorrente, valoreAltra)) {
            return;
        }

        differenze.push({
            canale: CANALE.compilato,
            campo: nome,
            etichetta: nome,
            corrente: valoreCorrente,
            altra: valoreAltra
        });
    });

    return differenze;
}

/// Il confronto fra le due liste. Torna una voce per ogni codice gruppo presente in almeno una
/// delle due, nell'ordine della lista corrente e poi di quella altra: prima le referenze in
/// comune con le loro differenze (anche nessuna: e' il filtro a decidere se mostrarle), poi
/// quelle che stanno da un lato solo.
function confrontoConAltraLista(recordsCorrente, recordsAltra, campiOsservati) {
    const corrente = primariPerCodiceGruppo(recordsCorrente);
    const altra = primariPerCodiceGruppo(recordsAltra);
    const voci = [];

    corrente.forEach((datoCorrente, codice) => {
        if (!altra.has(codice)) {
            voci.push({ codiceGruppo: codice, presenza: PRESENZA.soloCorrente, rawCorrente: datoCorrente, rawAltra: null, differenze: [] });
            return;
        }

        const datoAltra = altra.get(codice);
        voci.push({
            codiceGruppo: codice,
            presenza: PRESENZA.entrambe,
            rawCorrente: datoCorrente,
            rawAltra: datoAltra,
            differenze: differenzeOsservate(datoCorrente, datoAltra, campiOsservati)
                .concat(differenzeCompilate(datoCorrente, datoAltra))
        });
    });

    altra.forEach((datoAltra, codice) => {
        if (!corrente.has(codice)) {
            voci.push({ codiceGruppo: codice, presenza: PRESENZA.soloAltra, rawCorrente: null, rawAltra: datoAltra, differenze: [] });
        }
    });

    return voci;
}

/// I campi che compaiono almeno una volta fra le differenze, per canale: e' l'elenco con cui
/// si costruisce il filtro, e non si offre un campo che non ha niente da mostrare.
function campiDisponibili(voci) {
    const visti = new Set();
    const campi = [];

    [CANALE.osservato, CANALE.compilato].forEach(canale => {
        (voci || []).forEach(voce => {
            (voce.differenze || []).forEach(d => {
                if (d.canale !== canale) {
                    return;
                }
                const chiave = canale + "|" + d.campo;
                if (visti.has(chiave)) {
                    return;
                }
                visti.add(chiave);
                campi.push({ canale: canale, campo: d.campo, etichetta: d.etichetta || d.campo });
            });
        });
    });

    return campi;
}

/// Il filtro come lo vuole l'operatore: quali presenze, quali canali, quali campi. Un campo
/// spento non si vede, e una referenza in comune a cui non resta nessuna differenza da mostrare
/// esce dall'elenco. Le referenze da un lato solo restano: la loro notizia e' la presenza.
function filtraVociConfronto(voci, filtro) {
    const scelte = filtro || {};
    const presenza = scelte.presenza || FILTRO_PRESENZA.tutte;
    const canali = Object.assign({ osservato: true, compilato: true }, scelte.canali || {});
    const campi = Array.isArray(scelte.campi) ? new Set(scelte.campi.map(c => String(c))) : null;

    const risultato = [];

    (voci || []).forEach(voce => {
        const inComune = voce.presenza === PRESENZA.entrambe;

        if (presenza === FILTRO_PRESENZA.comuni && !inComune) {
            return;
        }
        if (presenza === FILTRO_PRESENZA.soloUna && inComune) {
            return;
        }

        const differenze = (voce.differenze || []).filter(d =>
            canali[d.canale] !== false && (campi == null || campi.has(String(d.campo))));

        if (inComune && differenze.length === 0) {
            return;
        }

        risultato.push(Object.assign({}, voce, { differenze: differenze }));
    });

    return risultato;
}

/// L'identita' di una lista come si legge dai suoi record: etichetta e versione del tracciato
/// del primo primario. Serve in testa al csv e sopra l'elenco, per dire cosa si sta confrontando.
function identitaTracciato(records) {
    const primari = primariPerCodiceGruppo(records);
    let dato = null;
    primari.forEach(valore => {
        if (dato == null) {
            dato = valore;
        }
    });

    return {
        etichettaTracciato: dato != null ? valoreLeggibile(dato["Tracciato.Label"]) : "",
        versioneTracciato: dato != null ? valoreLeggibile(dato["Tracciato.Versione"]) : "",
        primari: primari.size
    };
}

/// Il nome dello stato per l'operatore e per il csv.
function descriviPresenza(presenza) {
    if (presenza === PRESENZA.soloCorrente) {
        return "Solo lista corrente";
    }
    if (presenza === PRESENZA.soloAltra) {
        return "Solo altra lista";
    }
    return "Diversa";
}

function descriviCanale(canale) {
    return canale === CANALE.compilato ? "Campo compilato" : "Campo osservato";
}

/// I record di una lista come la restituisce il server o come sta nel json locale: o l'array
/// nudo, o l'oggetto con la chiave records. Qualunque altra cosa non e' una lista.
function recordsDellaLista(lista) {
    if (Array.isArray(lista)) {
        return lista;
    }
    if (lista != null && Array.isArray(lista.records)) {
        return lista.records;
    }
    return null;
}

/// Il filtro raccontato in una riga, per la testa del csv e per l'operatore.
function descriviFiltro(filtro, campiDisponibili) {
    const scelte = filtro || {};
    const parti = [];

    const presenza = scelte.presenza || FILTRO_PRESENZA.tutte;
    parti.push("presenze: " + (presenza === FILTRO_PRESENZA.comuni ? "solo in comune"
        : presenza === FILTRO_PRESENZA.soloUna ? "solo in una lista" : "tutte"));

    const canali = Object.assign({ osservato: true, compilato: true }, scelte.canali || {});
    const canaliAttivi = [];
    if (canali.osservato !== false) canaliAttivi.push("osservati");
    if (canali.compilato !== false) canaliAttivi.push("compilati");
    parti.push("canali: " + (canaliAttivi.length > 0 ? canaliAttivi.join(", ") : "nessuno"));

    if (Array.isArray(scelte.campi)) {
        const etichette = scelte.campi.map(campo => {
            const trovato = (campiDisponibili || []).find(c => String(c.campo) === String(campo));
            return trovato != null ? (trovato.etichetta || trovato.campo) : String(campo);
        });
        parti.push("campi: " + (etichette.length > 0 ? etichette.join(", ") : "nessuno"));
    }
    else {
        parti.push("campi: tutti");
    }

    return parti.join("; ");
}

module.exports = {
    CHIAVE_ALTERAZIONI,
    valoreLeggibile,
    sonoUguali,
    differenzeDelRecord,
    confrontoConSeStessa,
    idRecDelRecord,
    chiavePresenza,
    indicizzaPerPresenza,
    differenzePerPresenza,
    CANALE,
    PRESENZA,
    FILTRO_PRESENZA,
    primariPerCodiceGruppo,
    differenzeOsservate,
    differenzeCompilate,
    confrontoConAltraLista,
    campiDisponibili,
    filtraVociConfronto,
    identitaTracciato,
    descriviPresenza,
    descriviCanale,
    recordsDellaLista,
    descriviFiltro,
    testoDifferenze
};
