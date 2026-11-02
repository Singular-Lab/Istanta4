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
 *
 * I20-1007: una delle parti pure del motore CSS, in cssFramework/. Fino ad allora era
 * cssRegoleConflitti.js in radice, e chi lo importa lo chiama ancora cssRegoleConflitti.
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

    /// Un rettangolo in mm con due decimali, per i messaggi.
    function scriviRettangolo(r) {
        return "[" + r.map(function (v) { return Number(v).toFixed(2); }).join(", ") + "]";
    }

    /// I pezzi di un elemento con cui si cerca il contatto, come in elementsTouching: le righe
    /// del testo se ci sono, altrimenti il rettangolo intero.
    function pezziDelContatto(elemento) {
        var righe = (elemento && elemento.righe) || [];
        if (righe.length > 0) {
            return righe.map(function (riga, i) {
                var testo = elemento.testi && elemento.testi[i] != null ? String(elemento.testi[i]).trim() : "";
                return { rettangolo: riga, nome: "riga " + (i + 1) + (testo !== "" ? " «" + testo + "»" : "") };
            });
        }
        return [{ rettangolo: elemento ? elemento.rettangolo : null, nome: "riquadro" }];
    }

    /// I20-1178: le misure di un contatto, per il registro del Plugin. Una CSF-013 segnalata in
    /// produzione non si riproduceva in locale, e del contatto restavano solo i nomi dei due
    /// elementi. Dice quale parte del primo tocca quale parte del secondo - la riga del testo, con
    /// le sue parole, o il riquadro - con le misure in mm. Stessa geometria di elementsTouching:
    /// riga contro riga, riga contro riquadro, riquadro contro riquadro.
    /// a e b: { rettangolo, righe, testi }, con righe e testi vuoti per cio' che non e' testo.
    /// Torna "" se i due non si toccano.
    function descriviContatto(a, b) {
        var pezziA = pezziDelContatto(a);
        var pezziB = pezziDelContatto(b);
        for (var i = 0; i < pezziA.length; i++) {
            for (var j = 0; j < pezziB.length; j++) {
                if (rettangoliInContatto(pezziA[i].rettangolo, pezziB[j].rettangolo)) {
                    return "Misure in mm [alto, sinistra, basso, destra]: " +
                        pezziA[i].nome + " " + scriviRettangolo(pezziA[i].rettangolo) + " tocca " +
                        pezziB[j].nome + " " + scriviRettangolo(pezziB[j].rettangolo) + ".";
                }
            }
        }
        return "";
    }

    /// I20-1178: i dati con cui una CSF-013 si potra' rimisurare, salvati nella voce del bollino
    /// (campo v): le etichette dei due elementi e se la regola misura sul testo.
    function datiDiVerifica(etichettaA, etichettaB, useTextBounds) {
        return { a: String(etichettaA), b: String(etichettaB), tb: useTextBounds === true };
    }

    //Il testo della CSF-013, come lo scrive CssFramework.segnalaConflittoElementi.
    var TESTO_CONFLITTO = /^Code CSF-013: Conflitto tra elementi nel box .*?: (.+) non dovrebbe toccare (.+)\.$/;

    /// I20-1178: di quali elementi parla una CSF-013 del bollino, e come si misurava il contatto.
    /// Dal campo v se c'e'; altrimenti, per le voci scritte prima, le etichette si ricavano dal
    /// testo e il modo di misura resta da cercare nelle regole (useTextBounds null).
    /// Null per le altre segnalazioni e per i testi che non si leggono.
    function voceDiConflitto(voce) {
        if (voce == null || typeof voce !== "object") {
            return null;
        }
        var testo = voce.t != null ? String(voce.t) : "";
        if (voce.c !== "CSF-013" && testo.indexOf("CSF-013") < 0) {
            return null;
        }

        var v = voce.v;
        if (v != null && typeof v === "object" && typeof v.a === "string" && v.a !== "" && typeof v.b === "string" && v.b !== "") {
            return { a: v.a, b: v.b, useTextBounds: typeof v.tb === "boolean" ? v.tb : null };
        }

        var trovato = TESTO_CONFLITTO.exec(testo);
        if (trovato == null) {
            return null;
        }
        return { a: trovato[1], b: trovato[2], useTextBounds: null };
    }

    /// I20-1178: come le regole misurano il contatto fra due etichette: true sul testo, false sui
    /// riquadri, null se nessuna regola le riguarda. Una regola a due lati le riguarda se prende
    /// una delle due da un lato e l'altra dall'altro; una a un lato solo, se le prende tutte e due.
    /// Se piu' regole le riguardano e una misura sui riquadri vale il riquadro: e' il contatto piu'
    /// largo, e chi ricontrolla non toglie una segnalazione che quella regola darebbe ancora.
    /// corrisponde(motivo, etichetta): il confronto del CSS, CssFramework.makeRegexFromGroupName.
    function modoDiMisura(regole, etichettaA, etichettaB, corrisponde) {
        var modo = null;
        (regole || []).forEach(function (regola) {
            if (regola == null) {
                return;
            }
            var prende = function (lato, etichetta) {
                return (lato || []).some(function (motivo) { return corrisponde(motivo, etichetta); });
            };
            var latoB = regola.latoB || [];
            var riguarda = latoB.length === 0
                ? prende(regola.latoA, etichettaA) && prende(regola.latoA, etichettaB)
                : (prende(regola.latoA, etichettaA) && prende(latoB, etichettaB)) || (prende(regola.latoA, etichettaB) && prende(latoB, etichettaA));
            if (riguarda && modo !== false) {
                modo = regola.useTextBounds === true;
            }
        });
        return modo;
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
        descriviContatto: descriviContatto,
        scriviRettangolo: scriviRettangolo,
        datiDiVerifica: datiDiVerifica,
        voceDiConflitto: voceDiConflitto,
        modoDiMisura: modoDiMisura,
        chiaveRegola: chiaveRegola
    };
})();

module.exports = CssRegoleConflitti;
