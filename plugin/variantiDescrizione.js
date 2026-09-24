/*
 * I20-993: quale variante di descrizione si mostra, quale si puo' modificare, e su quale si
 * scende chiudendo una schermata.
 *
 * L'elenco delle varianti arriva dal server nella chiave varianti_descrizione, gia' ordinato
 * dalla meno alla piu' specifica: nazionale, canale, area, area con canale. Quale si applichi
 * pero' dipende dall'area e dal canale della lavorazione aperta, che il server non conosce e
 * il Plugin si'. La decisione sta qui, fuori da schedaRef.js, che richiede InDesign e non si
 * carica sotto Node.
 *
 * Esecuzione dei test: node --test tests/plugin/variantiDescrizione.test.js
 */

/// Quanto e' specifica una variante: 0 nazionale, 1 canale, 2 area, 3 area con canale.
/// Stessa scala del server (Istanta/Utility/SpecificitaDescrizione.cs), ricalcolata invece di
/// fidarsi del campo ricevuto: una variante costruita a mano dal Plugin non ce l'ha.
function specificita(variante) {
    if (variante == null) {
        return -1;
    }

    const haArea = !vuoto(variante.area);
    const haCanale = !vuoto(variante.canale);

    if (haArea && haCanale) return 3;
    if (haArea) return 2;
    if (haCanale) return 1;
    return 0;
}

function vuoto(valore) {
    return valore == null || String(valore).trim() === '';
}

function uguali(uno, altro) {
    if (vuoto(uno) && vuoto(altro)) {
        return true;
    }
    return String(uno) === String(altro);
}

/// Una variante vale per questa lavorazione se non contraddice la sua area e il suo canale.
/// La nazionale vale sempre: non dice niente, quindi non puo' contraddire nulla. E' la stessa
/// regola del server per le foto (IsCompatibleWithCurrentBranch).
function siApplica(variante, area, canale) {
    if (variante == null) {
        return false;
    }

    const areaOk = vuoto(variante.area) || uguali(variante.area, area);
    const canaleOk = vuoto(variante.canale) || uguali(variante.canale, canale);

    return areaOk && canaleOk;
}

/// Le varianti che valgono per questa lavorazione, dalla meno alla piu' specifica.
function variantiApplicabili(varianti, area, canale) {
    if (!Array.isArray(varianti)) {
        return [];
    }

    return varianti
        .filter(v => siApplica(v, area, canale))
        .slice()
        .sort((a, b) => specificita(a) - specificita(b));
}

/// La variante che comanda: la piu' specifica fra quelle che valgono. E' l'unica modificabile,
/// tutte le altre si mostrano in sola lettura.
function varianteApplicabile(varianti, area, canale) {
    const applicabili = variantiApplicabili(varianti, area, canale);

    return applicabili.length > 0 ? applicabili[applicabili.length - 1] : null;
}

/// Se una variante e' quella modificabile. Si confronta per area e canale, non per identita':
/// l'oggetto che arriva dal server e quello mostrato non sono per forza lo stesso.
function eModificabile(variante, varianti, area, canale) {
    const applicabile = varianteApplicabile(varianti, area, canale);

    if (variante == null || applicabile == null) {
        return false;
    }

    return uguali(variante.area, applicabile.area) && uguali(variante.canale, applicabile.canale);
}

/// Chiudendo una schermata si scende di un gradino: la piu' specifica fra quelle che valgono e
/// sono meno specifiche di quella chiusa. Sotto la nazionale non si scende, e chiudendo la
/// nazionale non resta niente: chi chiama decide se e' un caso da impedire.
function varianteDopoChiusura(varianti, chiusa, area, canale) {
    const applicabili = variantiApplicabili(varianti, area, canale);
    const rangoChiusa = specificita(chiusa);

    const sotto = applicabili.filter(v => specificita(v) < rangoChiusa);

    return sotto.length > 0 ? sotto[sotto.length - 1] : null;
}

/// Se una variante si puo' chiudere, cioe' cancellare, dal Plugin. La nazionale no, mai:
/// e' il fondo della scala, e senza di lei il gruppo resterebbe senza niente su cui ricadere.
/// Stessa regola del server (SpecificitaDescrizione.SiPuoChiudere), che la fa comunque
/// rispettare anche se da qui ci si distraesse.
function siPuoChiudere(variante) {
    return specificita(variante) > 0;
}

/// L'etichetta con cui si nomina una variante nell'interfaccia.
function etichetta(variante) {
    if (variante == null) {
        return '';
    }

    const parti = [];
    if (!vuoto(variante.canale)) parti.push(String(variante.canale));
    if (!vuoto(variante.area)) parti.push(String(variante.area));

    return parti.length > 0 ? parti.join(' ') : 'Nazionale';
}

module.exports = {
    specificita,
    siApplica,
    variantiApplicabili,
    varianteApplicabile,
    eModificabile,
    varianteDopoChiusura,
    siPuoChiudere,
    etichetta
};
