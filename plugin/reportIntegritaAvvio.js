/*
 * I20-981 (Lotto 1): le regole con cui il Report Integrita' decide come partire e quando
 * smettere di valere.
 *
 * Stavano dentro il gestore del bottone "Avvia" in indexNew.js e dentro
 * richiediAzioneReportIntegritaEsistente in confronti.js, mescolate all'interfaccia.
 * Nessuno dei due file si carica sotto Node (require('indesign')), quindi le soglie non
 * erano verificabili: qui restano solo le decisioni, senza InDesign e senza DOM.
 *
 * Esecuzione dei test: node --test tests/plugin/reportIntegritaAvvio.test.js
 */

//La lista scaricata da meno di un'ora si puo' riusare senza riscaricarla.
const MINUTI_LISTA_RECENTE = 60;
//Oltre le quattro ore un report esistente e' troppo vecchio: si rifa' senza chiedere.
const ORE_REPORT_DA_CHIEDERE = 4;
//Oltre le due ore si chiede ancora, ma la data va mostrata in evidenza.
const ORE_REPORT_VECCHIO = 2;

/// Legge "21/09/2026, 09:20:33" come lo scrive toLocaleString('it-IT'), tollerando la
/// virgola, lo spazio o qualunque altro separatore fra data e ora.
/// Restituisce null se il testo non e' una data italiana completa con anno a quattro cifre:
/// chi chiama tratta il null come "non recente", cioe' riscarica. Meglio un download in piu'
/// che un confronto fatto su una lista di cui non sappiamo l'eta'.
function leggiDataItaliana(testo) {
    if (testo == null) {
        return null;
    }

    const numeri = String(testo).match(/\d+/g);
    if (numeri == null || numeri.length < 3) {
        return null;
    }

    if (numeri[2].length !== 4) {
        return null;
    }

    const giorno = parseInt(numeri[0], 10);
    const mese = parseInt(numeri[1], 10);
    const anno = parseInt(numeri[2], 10);
    const ore = numeri.length > 3 ? parseInt(numeri[3], 10) : 0;
    const minuti = numeri.length > 4 ? parseInt(numeri[4], 10) : 0;
    const secondi = numeri.length > 5 ? parseInt(numeri[5], 10) : 0;

    const data = new Date(anno, mese - 1, giorno, ore, minuti, secondi);
    if (isNaN(data.getTime())) {
        return null;
    }

    //Date fa scorrere il 31/02 al primo marzo: se i pezzi non tornano il testo non era una data.
    if (data.getDate() !== giorno || data.getMonth() !== mese - 1 || data.getFullYear() !== anno) {
        return null;
    }

    return data;
}

/// Vero se la lista del kit e' stata scaricata da meno di `minuti`, e quindi si puo' proporre
/// all'operatore di riusarla. Una data nel futuro (orologio spostato) non e' considerata
/// recente: si riscarica, che e' il lato sicuro.
function listaERecente(dataScaricamento, adesso = new Date(), minuti = MINUTI_LISTA_RECENTE) {
    const data = leggiDataItaliana(dataScaricamento);
    if (data == null) {
        return false;
    }

    const differenzaMinuti = (adesso.getTime() - data.getTime()) / (1000 * 60);
    if (differenzaMinuti < 0) {
        return false;
    }

    return differenzaMinuti < minuti;
}

/// Decide cosa fare quando esiste gia' un report integrita' salvato in locale.
///  - chiedi: mostrare la scelta fra Riapri, Nuovo report e Annulla;
///  - vecchio: la data va scritta in evidenza perche' il report ha piu' di due ore;
///  - data: la data di creazione interpretata, null se illeggibile.
/// Se la data e' illeggibile o il report ha piu' di quattro ore non si chiede nulla e si fa
/// un report nuovo: quello vecchio non descrive piu' il documento che l'operatore ha davanti.
function decidiReportEsistente(createdAt, adesso = new Date()) {
    if (createdAt == null || createdAt === "") {
        return { chiedi: false, vecchio: false, data: null };
    }

    const data = new Date(createdAt);
    if (isNaN(data.getTime())) {
        return { chiedi: false, vecchio: false, data: null };
    }

    const ore = (adesso.getTime() - data.getTime()) / (1000 * 60 * 60);
    if (ore > ORE_REPORT_DA_CHIEDERE) {
        return { chiedi: false, vecchio: true, data: data };
    }

    return { chiedi: true, vecchio: ore > ORE_REPORT_VECCHIO, data: data };
}

/// Il range di pagine da mappare, nel formato che vuole mappaturaImpaginato ("1,2,3").
/// Le pagine con nome non numerico (copertine, pagine di servizio) restano fuori, come prima.
function componiRangePagine(nomiPagine) {
    const pagine = [];

    (nomiPagine || []).forEach(nome => {
        const numero = parseInt(nome, 10);
        if (!isNaN(numero)) {
            pagine.push(numero);
        }
    });

    return pagine.join(",");
}

/// Vero se il report aperto non parla piu' del documento che si ha davanti, e quindi va
/// chiuso. Vale anche quando non resta aperto nessun documento: un report senza il suo
/// impaginato sotto e' un elenco di segnalazioni che non si possono piu' verificare.
/// Se non sappiamo su quale documento il report e' nato non si chiude niente.
function deveChiudereReport(documentoDelReport, documentoAttuale) {
    if (documentoDelReport == null || documentoDelReport === "") {
        return false;
    }

    const attuale = documentoAttuale == null ? "" : String(documentoAttuale);
    return attuale !== String(documentoDelReport);
}

//I20-981 (Lotto 4a): la scheda referenza si puo' aprire dal report, e quando si chiude quella
//referenza va ricontrollata da sola, perche' l'operatore puo' aver risolto le sue segnalazioni
//standoci dentro. Queste sono le regole di dove va a finire il record.

/// La categoria del record dopo il ricontrollo: la stessa classificazione con cui il report
/// nasce, cosi' un record ricontrollato e uno appena analizzato finiscono nello stesso posto a
/// parita' di esito.
function categoriaRecordRicontrollato(preAnalisi, haDuplicato) {
    if (haDuplicato) {
        return "recordCambiati";
    }

    if (preAnalisi == null) {
        return null;
    }

    if ((preAnalisi.errors || []).length > 0) {
        return "recordConErrori";
    }

    if ((preAnalisi.differenze || []).length > 0) {
        return "recordCambiati";
    }

    return "recordGiusti";
}

/// Il dato riletto ha qualcosa da confrontare? Se non porta ne' campi compilati ne' foto, il
/// confronto non guarda niente e torna zero differenze: uno zero che non vuol dire "a posto",
/// vuol dire "non ho guardato".
function ciSonoDatiDaConfrontare(dati) {
    if (dati == null) {
        return false;
    }

    const quanti = (elenco) => (Array.isArray(elenco) ? elenco.length : 0);

    return (quanti(dati.compiledFields) +
        quanti(dati.listaFoto) +
        quanti(dati.fotoExtra) +
        quanti(dati.fotoExtraAuto)) > 0;
}

/// Che fare del record alla chiusura della scheda.
/// La regola che tiene tutto insieme: il report si cambia solo quando il ricontrollo ha
/// davvero potuto confrontare. In tutti gli altri casi si resta com'era, perche' una
/// segnalazione tolta per sbaglio e' lavoro che l'operatore non sa piu' di dover fare.
function esitoChiusuraScheda(situazione) {
    const dati = situazione || {};

    //Il box non c'e' piu': la referenza esce dal report e ricompare fra le Nuove, che si
    //calcolano per differenza da chi nel report c'e' gia'.
    if (!dati.boxPresente) {
        return { azione: "rimuovi", categoria: null };
    }

    //Senza preanalisi non sappiamo niente di nuovo: meglio lasciare il report com'era che
    //dichiarare risolto quello che non abbiamo controllato.
    if (dati.preAnalisi == null) {
        return { azione: "invariato", categoria: null };
    }

    //L'analisi e' finita in errore. Non rilancia: mette il messaggio negli errori e torna le
    //differenze raccolte fino a li', che possono essere zero. Quello zero non e' una prova che
    //le segnalazioni siano risolte, e un record classificato per errore finirebbe fra quelli
    //con errori, che il report non mostra in nessuna scheda: sparirebbe dalla vista.
    if ((dati.preAnalisi.errors || []).length > 0) {
        return { azione: "invariato", categoria: null, motivo: "errori" };
    }

    //Niente da confrontare non vuol dire tutto a posto.
    if (dati.nienteDaConfrontare === true) {
        return { azione: "invariato", categoria: null, motivo: "nienteDaConfrontare" };
    }

    return {
        azione: "sposta",
        categoria: categoriaRecordRicontrollato(dati.preAnalisi, dati.haDuplicato === true)
    };
}

/// Le differenze di confronto non vengono dal box: il ricontrollo del box non le puo' vedere,
/// e quindi si riportano come stavano.
function differenzeDiConfronto(record) {
    const differenze = (record && record.preAnalisi && record.preAnalisi.differenze) || [];
    return differenze.filter(d => d != null && d.origine === "confronto");
}

/// Le differenze del record dopo il ricontrollo, nell'ordine in cui le mette la costruzione
/// del report: prima l'integrita', poi il confronto, il duplicato in fondo.
function differenzeDopoRicontrollo(differenzeIntegrita, differenzeConfronto, duplicateInfo) {
    const risultato = (differenzeIntegrita || []).filter(d => d != null && d.origine !== "confronto");

    (differenzeConfronto || []).forEach(d => risultato.push(d));

    if (duplicateInfo != null) {
        risultato.push({
            label: "Duplicato",
            difference: "box duplicato: istanza " + duplicateInfo.index + " di " + duplicateInfo.total
        });
    }

    return risultato;
}

//I20-981 (Lotto 4a): il dato riletto dal server alla chiusura della scheda prende il posto di
//quello nella lista del kit. Serve perche' l'operatore, sistemando una segnalazione, allinea
//il box al server: se la lista restasse indietro, il report continuerebbe a giudicare il box
//con un dato che non e' piu' quello vero.

/// L'identita' di un record di lista: l'idRec quando c'e' da tutte e due le parti, altrimenti
/// il codice della referenza.
function idRecDiLista(record) {
    const diretto = record != null ? record.idRec : null;
    const dentro = record != null && record.recordInTracciato != null ? record.recordInTracciato.idRec : null;
    const valore = diretto != null && diretto !== "" ? diretto : dentro;

    if (valore == null || valore === "") {
        return null;
    }

    const numero = Number(valore);
    return isNaN(numero) ? String(valore) : numero;
}

function codiceDiLista(record) {
    const tracciato = record != null ? record.recordInTracciato : null;
    const codice = tracciato != null ? tracciato["Referenza.Codice"] : null;
    return codice == null ? "" : String(codice);
}

function stessoRecordDiLista(uno, altro) {
    if (uno == null || altro == null) {
        return false;
    }

    const idUno = idRecDiLista(uno);
    const idAltro = idRecDiLista(altro);

    if (idUno != null && idAltro != null) {
        return idUno === idAltro;
    }

    const codiceUno = codiceDiLista(uno);
    return codiceUno !== "" && codiceUno === codiceDiLista(altro);
}

/// Sostituisce nella lista i record riletti dal server. La scheda non restituisce tutte le
/// chiavi che la lista ha (label, forzaSoloUscitaSottogruppo sono della lista), quindi si
/// sovrascrive quello che arriva e si conserva il resto. Un record che nella lista non c'e'
/// non si aggiunge: la lista dice quali referenze sono nel kit, e non e' questo il posto per
/// cambiarlo.
function sostituisciRecordNellaLista(recordsLista, recordsFreschi) {
    const lista = Array.isArray(recordsLista) ? recordsLista.slice() : [];
    let sostituiti = 0;

    (recordsFreschi || []).forEach(fresco => {
        if (fresco == null) {
            return;
        }

        const indice = lista.findIndex(item => stessoRecordDiLista(item, fresco));
        if (indice < 0) {
            return;
        }

        lista[indice] = Object.assign({}, lista[indice], fresco);
        sostituiti++;
    });

    return { records: lista, sostituiti };
}

module.exports = {
    MINUTI_LISTA_RECENTE,
    ORE_REPORT_DA_CHIEDERE,
    ORE_REPORT_VECCHIO,
    leggiDataItaliana,
    listaERecente,
    decidiReportEsistente,
    componiRangePagine,
    deveChiudereReport,
    categoriaRecordRicontrollato,
    esitoChiusuraScheda,
    ciSonoDatiDaConfrontare,
    differenzeDiConfronto,
    differenzeDopoRicontrollo,
    sostituisciRecordNellaLista
};
