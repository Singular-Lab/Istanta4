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

    /// I20-1208: con useContornoImmagini un'immagine si misura sul contorno della sua parte non
    /// trasparente, non sulla cornice. Il margine trasparente di un logo (il 5% per lato di
    /// Logo_SDB) faceva toccare due loghi i cui disegni stavano accanto.
    function leggiUseContornoImmagini(regola) {
        if (regola == null || Array.isArray(regola)) {
            return false;
        }

        return regola.useContornoImmagini === true;
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
            useTextBounds: leggiUseTextBounds(regola),
            useContornoImmagini: leggiUseContornoImmagini(regola)
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
    /// del testo se ci sono, altrimenti il rettangolo intero. I20-1208: il rettangolo puo' avere
    /// un nome suo, "contorno" quando e' l'ingombro della parte non trasparente di un'immagine.
    function pezziDelContatto(elemento) {
        var righe = (elemento && elemento.righe) || [];
        if (righe.length > 0) {
            return righe.map(function (riga, i) {
                var testo = elemento.testi && elemento.testi[i] != null ? String(elemento.testi[i]).trim() : "";
                return { rettangolo: riga, nome: "riga " + (i + 1) + (testo !== "" ? " «" + testo + "»" : "") };
            });
        }
        return [{ rettangolo: elemento ? elemento.rettangolo : null, nome: elemento && elemento.nome ? elemento.nome : "riquadro" }];
    }

    /// I20-1208: il canale alfa della trasparenza fra quelli che InDesign elenca per un'immagine
    /// (alphaChannelPathNames). InDesign in italiano lo chiama "Trasparenza"; se nessun nome lo
    /// ricorda vale il primo canale. Null se l'immagine non ne ha.
    function canaleDellaTrasparenza(nomi) {
        var elenco = Array.isArray(nomi) ? nomi.filter(function (n) { return typeof n === "string" && n !== ""; }) : [];
        if (elenco.length === 0) {
            return null;
        }
        var trasparenza = elenco.find(function (n) { return /traspar|transpar/i.test(n); });
        return trasparenza != null ? trasparenza : elenco[0];
    }

    /// I20-1208: un punto [x, y] della forma di InDesign, o null.
    function punto(p) {
        return Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number" ? p : null;
    }

    /// I20-1208: i vertici di un tracciato di InDesign (entirePath, coordinate [x, y]). Un tracciato
    /// di soli segmenti elenca i punti; uno con curve elenca terne [maniglia sinistra, ancoraggio,
    /// maniglia destra], e ogni curva fra due ancoraggi diventa passi segmenti, cosi' la sua pancia
    /// non resta fuori dal contorno.
    function verticiDelTracciato(entirePath, passi) {
        var n = passi || 4;
        var nodi = [];
        (Array.isArray(entirePath) ? entirePath : []).forEach(function (e) {
            if (punto(e)) {
                nodi.push({ sinistra: e, ancoraggio: e, destra: e });
            }
            else if (Array.isArray(e) && e.length === 3 && punto(e[0]) && punto(e[1]) && punto(e[2])) {
                nodi.push({ sinistra: e[0], ancoraggio: e[1], destra: e[2] });
            }
        });

        var vertici = [];
        for (var i = 0; i < nodi.length; i++) {
            var a = nodi[i];
            var b = nodi[(i + 1) % nodi.length];
            vertici.push(a.ancoraggio);
            var retto = a.destra[0] === a.ancoraggio[0] && a.destra[1] === a.ancoraggio[1] &&
                b.sinistra[0] === b.ancoraggio[0] && b.sinistra[1] === b.ancoraggio[1];
            if (retto || nodi.length < 2) {
                continue;
            }
            for (var k = 1; k < n; k++) {
                var t = k / n, u = 1 - t;
                var c0 = u * u * u, c1 = 3 * u * u * t, c2 = 3 * u * t * t, c3 = t * t * t;
                vertici.push([
                    c0 * a.ancoraggio[0] + c1 * a.destra[0] + c2 * b.sinistra[0] + c3 * b.ancoraggio[0],
                    c0 * a.ancoraggio[1] + c1 * a.destra[1] + c2 * b.sinistra[1] + c3 * b.ancoraggio[1]
                ]);
            }
        }
        return vertici;
    }

    /// I20-1208: il poligono [x, y] ritagliato su un rettangolo [alto, sinistra, basso, destra]
    /// (Sutherland-Hodgman): di un'immagine conta solo quello che la cornice lascia vedere.
    function ritagliaPoligono(vertici, rettangolo) {
        var lati = [
            { dentro: function (p) { return p[0] >= rettangolo[1]; }, taglio: function (p, q) { return incrocio(p, q, 0, rettangolo[1]); } },
            { dentro: function (p) { return p[0] <= rettangolo[3]; }, taglio: function (p, q) { return incrocio(p, q, 0, rettangolo[3]); } },
            { dentro: function (p) { return p[1] >= rettangolo[0]; }, taglio: function (p, q) { return incrocio(p, q, 1, rettangolo[0]); } },
            { dentro: function (p) { return p[1] <= rettangolo[2]; }, taglio: function (p, q) { return incrocio(p, q, 1, rettangolo[2]); } }
        ];
        function incrocio(p, q, asse, valore) {
            var t = (valore - p[asse]) / (q[asse] - p[asse]);
            return asse === 0 ? [valore, p[1] + t * (q[1] - p[1])] : [p[0] + t * (q[0] - p[0]), valore];
        }

        var risultato = vertici.slice();
        lati.forEach(function (lato) {
            var entrata = risultato;
            risultato = [];
            for (var i = 0; i < entrata.length; i++) {
                var p = entrata[i];
                var q = entrata[(i + 1) % entrata.length];
                if (lato.dentro(p)) {
                    risultato.push(p);
                    if (!lato.dentro(q)) {
                        risultato.push(lato.taglio(p, q));
                    }
                }
                else if (lato.dentro(q)) {
                    risultato.push(lato.taglio(p, q));
                }
            }
        });
        return risultato;
    }

    /// I20-1208: i poligoni della parte visibile di un'immagine, dai tracciati del suo scontorno
    /// (un entirePath per tracciato) ritagliati sulla cornice. Lista vuota se non ne resta niente.
    function poligoniDelContorno(tracciati, cornice) {
        var poligoni = [];
        (Array.isArray(tracciati) ? tracciati : []).forEach(function (entirePath) {
            var vertici = verticiDelTracciato(entirePath);
            if (Array.isArray(cornice) && cornice.length >= 4) {
                vertici = ritagliaPoligono(vertici, cornice);
            }
            if (vertici.length >= 3) {
                poligoni.push(vertici);
            }
        });
        return poligoni;
    }

    /// I20-1208: un rettangolo [alto, sinistra, basso, destra] come poligono [x, y].
    function poligonoDelRettangolo(r) {
        return [[r[1], r[0]], [r[3], r[0]], [r[3], r[2]], [r[1], r[2]]];
    }

    /// I20-1208: il rettangolo [alto, sinistra, basso, destra] che contiene i poligoni, o null.
    function riquadroDeiPoligoni(poligoni) {
        var punti = [].concat.apply([], poligoni || []);
        if (punti.length === 0) {
            return null;
        }
        var xs = punti.map(function (p) { return p[0]; });
        var ys = punti.map(function (p) { return p[1]; });
        return [Math.min.apply(null, ys), Math.min.apply(null, xs), Math.max.apply(null, ys), Math.max.apply(null, xs)];
    }

    function orientamento(a, b, c) {
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    /// Due segmenti che si attraversano davvero: toccarsi in un estremo o correre affiancati
    /// non conta, come per i rettangoli che si sfiorano al bordo.
    function segmentiSiIncrociano(p1, p2, q1, q2) {
        var d1 = orientamento(q1, q2, p1), d2 = orientamento(q1, q2, p2);
        var d3 = orientamento(p1, p2, q1), d4 = orientamento(p1, p2, q2);
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    }

    function puntoNelPoligono(p, poligono) {
        var dentro = false;
        for (var i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
            var a = poligono[i], b = poligono[j];
            if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) {
                dentro = !dentro;
            }
        }
        return dentro;
    }

    /// I20-1208: due forme fatte di poligoni [x, y] si toccano se un lato dell'una attraversa un
    /// lato dell'altra o se una sta dentro l'altra. Prima si scartano le coppie i cui rettangoli
    /// non si sovrappongono, con la regola di rettangoliInContatto.
    function poligoniInContatto(poligoniA, poligoniB) {
        var a = poligoniA || [], b = poligoniB || [];
        for (var i = 0; i < a.length; i++) {
            var ra = riquadroDeiPoligoni([a[i]]);
            for (var j = 0; j < b.length; j++) {
                if (!rettangoliInContatto(ra, riquadroDeiPoligoni([b[j]]))) {
                    continue;
                }
                var pa = a[i], pb = b[j];
                for (var x = 0; x < pa.length; x++) {
                    for (var y = 0; y < pb.length; y++) {
                        if (segmentiSiIncrociano(pa[x], pa[(x + 1) % pa.length], pb[y], pb[(y + 1) % pb.length])) {
                            return true;
                        }
                    }
                }
                if (pa.some(function (p) { return puntoNelPoligono(p, pb); }) || pb.some(function (p) { return puntoNelPoligono(p, pa); })) {
                    return true;
                }
            }
        }
        return false;
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
    /// (campo v): le etichette dei due elementi e se la regola misura sul testo. I20-1208: e, solo
    /// se e' cosi', che misura le immagini sul contorno (ci).
    function datiDiVerifica(etichettaA, etichettaB, useTextBounds, useContornoImmagini) {
        var dati = { a: String(etichettaA), b: String(etichettaB), tb: useTextBounds === true };
        if (useContornoImmagini === true) {
            dati.ci = true;
        }
        return dati;
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
        //I20-1208: useContornoImmagini c'e' solo se la regola di allora misurava le immagini sul contorno.
        if (v != null && typeof v === "object" && typeof v.a === "string" && v.a !== "" && typeof v.b === "string" && v.b !== "") {
            var dati = { a: v.a, b: v.b, useTextBounds: typeof v.tb === "boolean" ? v.tb : null };
            if (v.ci === true) {
                dati.useContornoImmagini = true;
            }
            return dati;
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

        return regola.latoA.join(",") + "|" + regola.latoB.join(",") + "|" + (regola.useTextBounds ? "text" : "geom") +
            (regola.useContornoImmagini ? "|contorno" : "");
    }

    return {
        splitSpec: splitSpec,
        normalizzaRegola: normalizzaRegola,
        getListaRegole: getListaRegole,
        rettangoloDiRiga: rettangoloDiRiga,
        rettangoliInContatto: rettangoliInContatto,
        contattoConLeRighe: contattoConLeRighe,
        canaleDellaTrasparenza: canaleDellaTrasparenza,
        verticiDelTracciato: verticiDelTracciato,
        ritagliaPoligono: ritagliaPoligono,
        poligoniDelContorno: poligoniDelContorno,
        poligonoDelRettangolo: poligonoDelRettangolo,
        riquadroDeiPoligoni: riquadroDeiPoligoni,
        poligoniInContatto: poligoniInContatto,
        descriviContatto: descriviContatto,
        scriviRettangolo: scriviRettangolo,
        datiDiVerifica: datiDiVerifica,
        voceDiConflitto: voceDiConflitto,
        modoDiMisura: modoDiMisura,
        chiaveRegola: chiaveRegola
    };
})();

module.exports = CssRegoleConflitti;
