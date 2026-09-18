/*
 * I20-974: regole di segnalazione conflitti del CSS framework.
 *
 * Qui vive solo la lettura delle regole, senza toccare InDesign, cosi' il comportamento e'
 * verificabile con il test runner di Node come per gli altri moduli css estratti.
 *
 * Una regola dice quali elementi non devono toccarsi. Ha due forme:
 *   - un solo lato: gli elementi che corrispondono non devono toccarsi fra loro;
 *   - due lati: nessun elemento del primo lato deve toccare un elemento del secondo.
 *
 * useTextBounds sceglie su cosa si misura il contatto: il riquadro dell'oggetto oppure il
 * testo che contiene davvero. Per un campo di testo i due valori sono molto diversi, ed e'
 * la ragione per cui nascevano segnalazioni che l'occhio non vedeva.
 */
var CssRegoleConflitti = (function () {

    /// Un lato di una regola: "descrizione, prezzo" diventa ["descrizione", "prezzo"].
    function splitSpec(spec) {
        if (spec == null || typeof spec !== "string") {
            return [];
        }

        return spec.split(",")
            .map(function (el) { return el.trim(); })
            .filter(function (el) { return el !== ""; });
    }

    function leggiUseTextBounds(regola) {
        if (regola == null || Array.isArray(regola)) {
            return false;
        }

        return regola.useTextBounds === true;
    }

    /// Porta una regola alla forma con cui il controllo lavora: i due lati e la scelta dei
    /// bounds. Torna null quando non c'e' nulla da controllare.
    function normalizzaRegola(regola) {
        if (regola == null) {
            return null;
        }

        var segnalazioni = null;
        if (Array.isArray(regola)) {
            segnalazioni = regola;
        }
        else if (regola.segnalazioni != null) {
            segnalazioni = Array.isArray(regola.segnalazioni) ? regola.segnalazioni : [regola.segnalazioni];
        }

        if (!segnalazioni || segnalazioni.length == 0) {
            return null;
        }

        var latoA = splitSpec(segnalazioni[0]);
        var latoB = splitSpec(segnalazioni.length > 1 ? segnalazioni[1] : "");

        //Un solo lato valorizzato vale come "questi elementi non si tocchino fra loro",
        //qualunque dei due sia stato scritto.
        if (latoA.length == 0 && latoB.length > 0) {
            latoA = latoB;
            latoB = [];
        }

        if (latoA.length == 0) {
            return null;
        }

        return {
            latoA: latoA,
            latoB: latoB,
            useTextBounds: leggiUseTextBounds(regola)
        };
    }

    /// Tutte le regole di un elemento della configurazione. Accetta sia l'elenco di regole
    /// sia la scorciatoia di una regola sola scritta come coppia di stringhe.
    function getListaRegole(segnalazioniConflitti) {
        if (segnalazioniConflitti == null) {
            return [];
        }

        var regoleInput = [];
        if (Array.isArray(segnalazioniConflitti)) {
            var isRegolaDiretta = segnalazioniConflitti.length <= 2 &&
                segnalazioniConflitti.every(function (el) { return typeof el === "string"; });
            regoleInput = isRegolaDiretta ? [segnalazioniConflitti] : segnalazioniConflitti;
        }
        else {
            regoleInput = [segnalazioniConflitti];
        }

        var regole = [];
        for (var i = 0; i < regoleInput.length; i++) {
            var regola = normalizzaRegola(regoleInput[i]);
            if (regola) {
                regole.push(regola);
            }
        }

        return regole;
    }

    /// Due rettangoli si toccano? Convenzione InDesign: [alto, sinistra, basso, destra].
    /// Il contatto e' sovrapposizione vera: due elementi che si sfiorano al bordo, con un
    /// lato che finisce dove l'altro comincia, non si toccano.
    function rettangoliInContatto(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length < 4 || b.length < 4) {
            return false;
        }

        if (a[0] >= b[2] || b[0] >= a[2]) {
            return false;
        }
        if (a[1] >= b[3] || b[1] >= a[3]) {
            return false;
        }

        return true;
    }

    /// Rettangolo occupato da una riga di testo. L'altezza va dalla cima dei caratteri alla
    /// coda di quelli che scendono sotto la linea di base: ascent e descent bastano, perche'
    /// l'ascent gia' misura quanto il carattere sale sopra la base. Sommarci anche il corpo
    /// del carattere allungherebbe la riga verso l'alto di circa un'interlinea, prendendosi
    /// lo spazio bianco sopra il testo e facendolo passare per testo.
    function rettangoloDiRiga(baseline, ascent, descent, sinistra, destra) {
        return [baseline - ascent, sinistra, baseline + descent, destra];
    }

    /// Contatto con un campo di testo: conta quello che il testo occupa davvero, riga per
    /// riga, non il rettangolo che le ingloba tutte. Una riga corta non deve ereditare la
    /// larghezza di una riga lunga che sta da un'altra parte del campo, e lo spazio fra le
    /// righe non e' testo. Senza righe non si puo' dire nulla di preciso: si risponde con
    /// il rettangolo ricevuto, cosi' il comportamento resta quello di prima.
    function contattoConLeRighe(rettangolo, righe, rettangoloIntero) {
        var elenco = righe || [];

        if (elenco.length === 0) {
            return rettangoliInContatto(rettangolo, rettangoloIntero);
        }

        for (var i = 0; i < elenco.length; i++) {
            if (rettangoliInContatto(rettangolo, elenco[i])) {
                return true;
            }
        }

        return false;
    }

    /// Chiave con cui si riconosce una regola gia' raccolta. Comprende la scelta dei bounds:
    /// la stessa coppia di lati misurata in due modi diversi e' un controllo diverso.
    function chiaveRegola(regola) {
        if (regola == null) {
            return "";
        }

        return regola.latoA.join(",") + "|" + regola.latoB.join(",") + "|" + (regola.useTextBounds ? "text" : "geom");
    }

    return {
        splitSpec: splitSpec,
        normalizzaRegola: normalizzaRegola,
        getListaRegole: getListaRegole,
        rettangoloDiRiga: rettangoloDiRiga,
        rettangoliInContatto: rettangoliInContatto,
        contattoConLeRighe: contattoConLeRighe,
        chiaveRegola: chiaveRegola
    };
})();

module.exports = CssRegoleConflitti;
