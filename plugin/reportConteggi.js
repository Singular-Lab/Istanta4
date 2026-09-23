/*
 * I20-981 (Lotto 3): i conteggi che finiscono sulle linguette del Report Integrita'.
 *
 * Il numero deve dire quanti record stai guardando adesso, non quanti ne esistono: quando il
 * report e' in vista whitelist le liste mostrate sono altre, e un conteggio che ignorasse la
 * vista mentirebbe. Per questo i conteggi si fanno sulle stesse liste che vengono disegnate.
 *
 * confronti.js non si carica sotto Node, quindi la regola sta qui.
 *
 * Esecuzione dei test: node --test tests/plugin/reportConteggi.test.js
 */

/// Quanti elementi ha una lista, senza inciampare su null.
function conteggio(elenco) {
    return Array.isArray(elenco) ? elenco.length : 0;
}

/// I tre conteggi delle linguette, dalle liste che i pannelli stanno mostrando.
function conteggiVisibili(cambiati, usciti, nuovi) {
    return {
        cambiati: conteggio(cambiati),
        eliminati: conteggio(usciti),
        nuovi: conteggio(nuovi)
    };
}

/// L'etichetta di una linguetta: "Cambiati (12)". Lo zero si scrive, perche' "nessuno" e'
/// un'informazione utile quanto le altre.
function etichettaLinguetta(nome, numero) {
    const testo = String(nome == null ? "" : nome);

    if (numero == null || isNaN(Number(numero))) {
        return testo;
    }

    return testo + " (" + Number(numero) + ")";
}

module.exports = {
    conteggio,
    conteggiVisibili,
    etichettaLinguetta
};
