/*
 * Scelta dello spazio in cui finiscono le foto del box.
 *
 * Il criterio storico e' uno solo: fra gli spazi liberi vince quello che permette al gruppo
 * di foto di venire piu' grande. In box come il BOX41, pero', le foto stanno dentro un
 * disegno fisso (le parentesi) e una foto spostata di lato per guadagnare pochi millimetri
 * risulta vistosamente scentrata: meglio qualche millimetro in meno e restare al centro.
 *
 * "Quanto in meno" e' una taratura del cliente, non una decisione del codice: la regola dice
 * entro che scarto d'area si accetta lo spazio piu' centrato. Se una foto e' davvero molto
 * piu' grande di lato, lo scarto viene superato e vince di nuovo l'area.
 *
 * I candidati arrivano in coordinate relative alla base del box: x e y sono l'angolo in alto
 * a sinistra, il centro della base e' quindi (larghezzaBase / 2, altezzaBase / 2).
 *
 * I20-1009: parte del concetto sistemazioneFoto, insieme a sistemazioneFoto.js e
 * spazioLibero.js. Prima si chiamava sceltaSpazio.js e stava in plugin/: il prefisso "css"
 * diceva solo che la usava CssFramework, e dentro la cartella non serve piu'.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 */

const sceltaSpazio = {

    areaMassima: "areaMassima",
    centrato: "centrato",

    //Usata quando la regola non dice altro: lo scarto d'area accettato per centrarsi.
    tolleranzaPredefinita: 0.7,

    //I20-1240: lo spareggio fra due disposizioni del box a parita' di foto (sceltaSpazioFoto.spareggio).
    vuotoMinore: "vuotoMinore",

    //I20-1240: due disposizioni hanno foto pari quando le aree differiscono al piu' di questa quota
    //della piu' grande: sotto, la differenza e' rumore delle misure e non deve decidere.
    tolleranzaAreaPari: 0.02,

    //I20-1240: due vuoti piu' grandi che differiscono al piu' di questa quota della base valgono
    //uguali, e decide la meta' bassa. I 2 punti del documento della issue, da tarare sui volantini.
    scartoVuoto: 0.02,

    //I20-1240: sotto questa differenza la meta' bassa e' occupata uguale. Evita che una
    //reimpaginazione sposti la descrizione per pochi decimi.
    scartoMetaBassa: 0.01,

    /// La preferenza del cliente messa in sicurezza: modo sconosciuto vale areaMassima, e una
    /// tolleranza fuori scala torna nei limiti. Sopra 1 nessun candidato sarebbe ammesso e le
    /// foto non si muoverebbero piu': un refuso in configurazione fermerebbe il fixFoto in silenzio.
    normalizzaPreferenza(preferenza) {
        const opzioni = preferenza || {};
        const modo = String(opzioni.modo || sceltaSpazio.areaMassima).toLowerCase() === sceltaSpazio.centrato.toLowerCase()
            ? sceltaSpazio.centrato
            : sceltaSpazio.areaMassima;

        let tolleranza = opzioni.tolleranzaArea != null ? Number(opzioni.tolleranzaArea) : sceltaSpazio.tolleranzaPredefinita;
        if (!isFinite(tolleranza) || tolleranza <= 0) {
            tolleranza = sceltaSpazio.tolleranzaPredefinita;
        }
        if (tolleranza > 1) {
            //Oltre 1 nessun candidato sarebbe ammesso e le foto non si muoverebbero piu'.
            tolleranza = 1;
        }

        let asse = String(opzioni.asseCentratura || "xy").toLowerCase();
        if (asse !== "x" && asse !== "y") {
            asse = "xy";
        }

        //I20-1240: lo spareggio sul vuoto vale solo se il cliente lo chiede; altro testo non vale niente.
        const spareggio = String(opzioni.spareggio || "").toLowerCase() === sceltaSpazio.vuotoMinore.toLowerCase()
            ? sceltaSpazio.vuotoMinore
            : null;

        return { modo: modo, tolleranzaArea: tolleranza, asseCentratura: asse, spareggio: spareggio };
    },

    /*
     * Quanto verrebbe grande il gruppo dentro questo candidato, e su quale asse si misura.
     * Il gruppo si ridimensiona in proporzione: comanda il lato che si esaurisce per primo.
     * Ritorna null se il candidato non puo' contenerlo.
     */
    valutaCandidato(candidato, boundsGruppo) {
        if (candidato == null || boundsGruppo == null) {
            return null;
        }

        const altezzaGruppo = boundsGruppo[2] - boundsGruppo[0];
        const larghezzaGruppo = boundsGruppo[3] - boundsGruppo[1];

        if (altezzaGruppo <= 0 || larghezzaGruppo <= 0) {
            return null;
        }

        const ratioY = candidato.height / altezzaGruppo;
        const larghezzaRisultante = larghezzaGruppo * ratioY;
        if (larghezzaRisultante <= candidato.width) {
            return { area: larghezzaRisultante * candidato.height, useXaxisForReference: false };
        }

        const ratioX = candidato.width / larghezzaGruppo;
        const altezzaRisultante = altezzaGruppo * ratioX;
        if (altezzaRisultante <= candidato.height) {
            return { area: altezzaRisultante * candidato.width, useXaxisForReference: true };
        }

        return null;
    },

    /// Quanto e' scentrato un candidato rispetto alla base del box, sull'asse richiesto.
    /// Si misura dal centro del candidato, non dal suo angolo: due spazi di larghezza diversa
    /// attorno allo stesso centro devono risultare ugualmente centrati.
    distanzaDalCentro(candidato, larghezzaBase, altezzaBase, asse) {
        //Il gruppo viene centrato nel candidato, quindi il centro del candidato e' quello delle foto.
        const dx = (candidato.x + candidato.width / 2) - larghezzaBase / 2;
        const dy = (candidato.y + candidato.height / 2) - altezzaBase / 2;

        if (asse === "x") {
            return Math.abs(dx);
        }
        if (asse === "y") {
            return Math.abs(dy);
        }
        return Math.sqrt(dx * dx + dy * dy);
    },

    /*
     * Spazio da riservare attorno al gruppo foto, per lato, in millimetri.
     * Serve a cio' che sta attaccato alla foto e sporge oltre i suoi bordi, come un'ombra:
     * la foto viene un po' piu' piccola e la sporgenza non finisce sugli altri elementi.
     * Valori assenti o non numerici valgono zero; i negativi non hanno senso e valgono zero.
     */
    normalizzaEstensioni(estensioni) {
        const leggi = function (v) {
            const n = Number(v);
            return isFinite(n) && n > 0 ? n : 0;
        };
        const e = estensioni || {};
        return { alto: leggi(e.alto), sinistra: leggi(e.sinistra), basso: leggi(e.basso), destra: leggi(e.destra) };
    },

    /*
     * I candidati ristretti delle estensioni. Le estensioni non scalano con la foto, quindi
     * si tolgono dallo spazio prima di adattarvi il gruppo: centrare la foto nel candidato
     * ristretto equivale a centrare nel candidato intero la foto piu' le sue sporgenze.
     * Uno spazio che non regge le estensioni sparisce dalla scelta.
     */
    restringiCandidati(candidati, estensioni) {
        const e = sceltaSpazio.normalizzaEstensioni(estensioni);
        if (candidati == null) {
            return [];
        }
        if (e.alto === 0 && e.sinistra === 0 && e.basso === 0 && e.destra === 0) {
            return candidati;
        }

        const ristretti = [];
        for (const c of candidati) {
            if (c == null) {
                continue;
            }
            const width = c.width - e.sinistra - e.destra;
            const height = c.height - e.alto - e.basso;
            if (!(width > 0) || !(height > 0)) {
                continue;
            }
            ristretti.push({
                x: c.x + e.sinistra,
                y: c.y + e.alto,
                width: width,
                height: height,
                direction: c.direction,
                derivatoDa: c
            });
        }
        return ristretti;
    },

    /*
     * La parte di un candidato simmetrica rispetto al centro della base.
     *
     * Uno spazio libero che attraversa il centro e' spesso piu' largo da una parte che
     * dall'altra: le foto centrate in quello spazio non sono centrate nel box. Se dello
     * spazio si usa solo la parte simmetrica, il centro delle foto coincide con quello del
     * box. Ritorna null se il candidato non attraversa il centro sugli assi richiesti.
     */
    parteCentrata(candidato, larghezzaBase, altezzaBase, asse) {
        let x = candidato.x, y = candidato.y, width = candidato.width, height = candidato.height;

        if (asse === "x" || asse === "xy") {
            const centroX = larghezzaBase / 2;
            const meta = Math.min(centroX - x, (x + width) - centroX);
            if (!(meta > 0)) {
                return null;
            }
            x = centroX - meta;
            width = meta * 2;
        }

        if (asse === "y" || asse === "xy") {
            const centroY = altezzaBase / 2;
            const meta = Math.min(centroY - y, (y + height) - centroY);
            if (!(meta > 0)) {
                return null;
            }
            y = centroY - meta;
            height = meta * 2;
        }

        if (x === candidato.x && y === candidato.y && width === candidato.width && height === candidato.height) {
            //Gia' simmetrico: non serve una variante.
            return null;
        }

        return { x: x, y: y, width: width, height: height, direction: "centrato", derivatoDa: candidato };
    },

    /*
     * Ritorna { candidato, area, useXaxisForReference } oppure null se nessuno spazio
     * riesce a contenere il gruppo. Col criterio centrato il candidato puo' essere una
     * parte di uno spazio libero, ritagliata attorno al centro della base.
     */
    scegli(candidati, boundsGruppo, preferenza, larghezzaBase, altezzaBase) {
        if (candidati == null || candidati.length === 0) {
            return null;
        }

        const opzioni = sceltaSpazio.normalizzaPreferenza(preferenza);

        const ammessi = [];
        let migliore = null;

        const valuta = function (candidato) {
            const valutazione = sceltaSpazio.valutaCandidato(candidato, boundsGruppo);
            if (valutazione == null || !(valutazione.area > 0)) {
                return null;
            }
            return {
                candidato: candidato,
                area: valutazione.area,
                useXaxisForReference: valutazione.useXaxisForReference
            };
        };

        for (const candidato of candidati) {
            const voce = valuta(candidato);
            if (voce == null) {
                continue;
            }
            ammessi.push(voce);

            //A parita' d'area vince il primo, come faceva il confronto originale.
            if (migliore == null || voce.area > migliore.area) {
                migliore = voce;
            }
        }

        if (migliore == null || opzioni.modo !== sceltaSpazio.centrato) {
            return migliore;
        }

        //Le parti centrate degli spazi che attraversano il centro concorrono come gli altri:
        //valgono meno area, ma stanno esattamente al centro.
        for (const candidato of candidati) {
            const centrata = sceltaSpazio.parteCentrata(candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);
            if (centrata == null) {
                continue;
            }
            const voce = valuta(centrata);
            if (voce != null) {
                ammessi.push(voce);
            }
        }

        const sogliaArea = migliore.area * opzioni.tolleranzaArea;
        let scelto = migliore;
        let distanzaScelto = sceltaSpazio.distanzaDalCentro(migliore.candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);

        for (const voce of ammessi) {
            if (voce === migliore || voce.area < sogliaArea) {
                continue;
            }

            const distanza = sceltaSpazio.distanzaDalCentro(voce.candidato, larghezzaBase, altezzaBase, opzioni.asseCentratura);
            //Piu' centrato vince; a pari centratura resta l'area piu' grande.
            if (distanza < distanzaScelto || (distanza === distanzaScelto && voce.area > scelto.area)) {
                scelto = voce;
                distanzaScelto = distanza;
            }
        }

        return scelto;
    },

    //I20-1025: sotto questo scarto, in millimetri, due disposizioni valgono ugualmente centrate:
    //differenze piu' piccole sono rumore delle misure, e non devono spostare la descrizione.
    scartoCentratura: 0.5,

    /*
     * I20-1025: fra due disposizioni del box gia' provate, quale tenere: "prima" o "seconda".
     * prima e seconda sono { area, distanzaDalCentro } della prova di fixFoto, o null se in quella
     * disposizione le foto non trovano posto. Serve a chi prova il box in due modi - Edro21
     * sposta la descrizione - e prima decideva solo con l'area.
     *
     * Con l'area massima vince la seconda solo se e' piu' grande, come prima: a parita' resta la
     * prima, che non sposta niente. Col criterio centrato, fra le disposizioni la cui area sta
     * dentro la tolleranza rispetto alla piu' grande vince la piu' centrata; a pari centratura
     * (entro scartoCentratura) decide di nuovo l'area. Una disposizione senza posto per le foto
     * non vince mai, se l'altra ce l'ha.
     *
     * I20-1240: se la preferenza chiede lo spareggio vuotoMinore e le due prove portano il loro
     * vuoto (vuotoMaggiore), a parita' di foto - aree entro tolleranzaAreaPari e, col criterio
     * centrato, stessa centratura - decide il vuoto: vince la disposizione il cui vuoto piu'
     * grande e' piu' piccolo (spareggioSulVuoto). Quando le foto non sono pari, o lo spareggio
     * non decide, la scelta resta quella di sempre.
     */
    preferisciDisposizione(prima, seconda, preferenza) {
        const valida = function (prova) {
            return prova != null && isFinite(Number(prova.area)) && Number(prova.area) > 0;
        };
        if (!valida(seconda)) {
            return "prima";
        }
        if (!valida(prima)) {
            return "seconda";
        }

        const areaPrima = Math.floor(Number(prima.area));
        const areaSeconda = Math.floor(Number(seconda.area));
        const perArea = areaSeconda > areaPrima ? "seconda" : "prima";

        const opzioni = sceltaSpazio.normalizzaPreferenza(preferenza);
        //I20-1240: qui si arriva solo con le foto pari per centratura (o senza criterio centrato).
        const perAreaOVuoto = function () {
            if (opzioni.spareggio === sceltaSpazio.vuotoMinore && sceltaSpazio.areePari(prima.area, seconda.area)) {
                const perVuoto = sceltaSpazio.spareggioSulVuoto(prima.vuoto, seconda.vuoto);
                if (perVuoto != null) {
                    return perVuoto;
                }
            }
            return perArea;
        };

        if (opzioni.modo !== sceltaSpazio.centrato) {
            return perAreaOVuoto();
        }

        const soglia = Math.max(areaPrima, areaSeconda) * opzioni.tolleranzaArea;
        const primaAmmessa = areaPrima >= soglia;
        const secondaAmmessa = areaSeconda >= soglia;
        if (primaAmmessa && !secondaAmmessa) {
            return "prima";
        }
        if (secondaAmmessa && !primaAmmessa) {
            return "seconda";
        }

        const distanzaPrima = Number(prima.distanzaDalCentro);
        const distanzaSeconda = Number(seconda.distanzaDalCentro);
        if (!isFinite(distanzaPrima) || !isFinite(distanzaSeconda)) {
            return perAreaOVuoto();
        }
        if (distanzaSeconda < distanzaPrima - sceltaSpazio.scartoCentratura) {
            return "seconda";
        }
        if (distanzaPrima < distanzaSeconda - sceltaSpazio.scartoCentratura) {
            return "prima";
        }
        return perAreaOVuoto();
    },

    /*
     * I20-1240: se due rettangoli [alto, sinistra, basso, destra] si sovrappongono. Toccarsi solo
     * sul bordo non conta, nemmeno con il centesimo di millimetro degli arrotondamenti di InDesign:
     * un testo allineato al bordo di un altro non lo tocca. Un rettangolo non valido non tocca niente.
     */
    rettangoliSiToccano(a, b) {
        const valido = r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(v => isFinite(Number(v)));
        if (!valido(a) || !valido(b)) {
            return false;
        }
        const t = 0.01;
        return a[0] < b[2] - t && a[2] > b[0] + t && a[1] < b[3] - t && a[3] > b[1] + t;
    },

    /*
     * I20-1240: se il rettangolo interno [alto, sinistra, basso, destra] sta dentro il contenitore,
     * con un centesimo di millimetro di tolleranza per gli arrotondamenti di InDesign.
     */
    rettangoloDentro(interno, contenitore) {
        const valido = r => Array.isArray(r) && r.length >= 4 && r.slice(0, 4).every(v => isFinite(Number(v)));
        if (!valido(interno) || !valido(contenitore)) {
            return true;
        }
        const t = 0.01;
        return interno[0] >= contenitore[0] - t && interno[1] >= contenitore[1] - t
            && interno[2] <= contenitore[2] + t && interno[3] <= contenitore[3] + t;
    },

    /*
     * I20-1240: fra le prove delle varianti di una simulazione del fix foto (fixFoto.sequenza),
     * l'indice di quella da tenere, o -1 se nessuna ha posto per le foto. Una prova null e' una
     * variante non provata o scartata. Le varianti si confrontano in ordine con
     * preferisciDisposizione: la migliore finora resta finche' una successiva non la batte, quindi
     * a parita' vince quella che viene prima, come fra due disposizioni.
     */
    migliorDisposizione(prove, preferenza) {
        const valida = function (prova) {
            return prova != null && isFinite(Number(prova.area)) && Number(prova.area) > 0;
        };
        let migliore = -1;
        (Array.isArray(prove) ? prove : []).forEach(function (prova, i) {
            if (!valida(prova)) {
                return;
            }
            if (migliore < 0 || sceltaSpazio.preferisciDisposizione(prove[migliore], prova, preferenza) === "seconda") {
                migliore = i;
            }
        });
        return migliore;
    },

    /// I20-1240: se le aree delle foto di due disposizioni sono pari: differiscono al piu' di
    /// tolleranzaAreaPari della piu' grande.
    areePari(areaPrima, areaSeconda) {
        const a = Number(areaPrima);
        const b = Number(areaSeconda);
        if (!isFinite(a) || !isFinite(b)) {
            return false;
        }
        return Math.abs(a - b) <= Math.max(a, b) * sceltaSpazio.tolleranzaAreaPari;
    },

    /*
     * I20-1240: fra due disposizioni con le foto pari, quale tenere guardando il vuoto, o null se
     * il vuoto non decide. vuotoPrima e vuotoSeconda sono gli esiti di vuotoMaggiore.
     * Vince il vuoto piu' grande piu' piccolo: l'occhio vede il singolo vuoto, non la somma, e
     * un blocco vuoto grande si legge come un contenuto mancante. Entro scartoVuoto vince la meta'
     * bassa piu' occupata; entro scartoMetaBassa il vuoto non decide.
     */
    spareggioSulVuoto(vuotoPrima, vuotoSeconda) {
        const valido = function (v) {
            return v != null && isFinite(Number(v.quota)) && isFinite(Number(v.metaBassaOccupata));
        };
        if (!valido(vuotoPrima) || !valido(vuotoSeconda)) {
            return null;
        }

        const differenzaVuoto = Number(vuotoPrima.quota) - Number(vuotoSeconda.quota);
        if (Math.abs(differenzaVuoto) > sceltaSpazio.scartoVuoto) {
            return differenzaVuoto > 0 ? "seconda" : "prima";
        }

        const differenzaBassa = Number(vuotoSeconda.metaBassaOccupata) - Number(vuotoPrima.metaBassaOccupata);
        if (Math.abs(differenzaBassa) > sceltaSpazio.scartoMetaBassa) {
            return differenzaBassa > 0 ? "seconda" : "prima";
        }
        return null;
    },

    /*
     * I20-1240: il vuoto della base di un box con gli elementi dove sono.
     * rettangoli: gli ingombri occupati { x, y, width, height }, relativi alla base come i
     * candidati; quello che esce dalla base non conta. Restituisce, o null senza una base:
     *  - quota: il rettangolo vuoto piu' grande, in quota dell'area della base;
     *  - rettangolo: quel rettangolo { x, y, width, height };
     *  - metaBassaOccupata: la quota occupata della meta' inferiore della base.
     *
     * La base si divide in una griglia sui bordi degli ingombri (e sulla meta' altezza); le celle
     * coperte da un ingombro sono occupate, e il rettangolo vuoto piu' grande e' la piu' grande
     * unione rettangolare di celle libere. Le somme progressive delle celle occupate dicono in un
     * passo se un rettangolo di celle e' tutto libero.
     */
    vuotoMaggiore(larghezzaBase, altezzaBase, rettangoli) {
        const L = Number(larghezzaBase);
        const H = Number(altezzaBase);
        if (!isFinite(L) || !isFinite(H) || L <= 0 || H <= 0) {
            return null;
        }

        const occupati = [];
        (Array.isArray(rettangoli) ? rettangoli : []).forEach(function (r) {
            if (r == null) {
                return;
            }
            const x1 = Math.max(0, Number(r.x));
            const y1 = Math.max(0, Number(r.y));
            const x2 = Math.min(L, Number(r.x) + Number(r.width));
            const y2 = Math.min(H, Number(r.y) + Number(r.height));
            if ([x1, y1, x2, y2].every(isFinite) && x2 > x1 && y2 > y1) {
                occupati.push({ x1: x1, y1: y1, x2: x2, y2: y2 });
            }
        });

        const meta = H / 2;
        const ordinati = function (valori) {
            return valori.filter(function (v, i) { return valori.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
        };
        const xs = ordinati(occupati.reduce(function (acc, o) { return acc.concat([o.x1, o.x2]); }, [0, L]));
        const ys = ordinati(occupati.reduce(function (acc, o) { return acc.concat([o.y1, o.y2]); }, [0, H, meta]));
        const nx = xs.length - 1;
        const ny = ys.length - 1;

        //somme[j][i]: celle occupate nelle righe < j e colonne < i.
        const somme = [];
        for (let j = 0; j <= ny; j++) {
            somme.push(new Array(nx + 1).fill(0));
        }
        let liberoBasso = 0;
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const cx = (xs[i] + xs[i + 1]) / 2;
                const cy = (ys[j] + ys[j + 1]) / 2;
                const occupata = occupati.some(function (o) { return cx > o.x1 && cx < o.x2 && cy > o.y1 && cy < o.y2; });
                somme[j + 1][i + 1] = somme[j][i + 1] + somme[j + 1][i] - somme[j][i] + (occupata ? 1 : 0);
                if (!occupata && ys[j] >= meta) {
                    liberoBasso += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
                }
            }
        }
        const occupateFra = function (i1, j1, i2, j2) {
            return somme[j2 + 1][i2 + 1] - somme[j1][i2 + 1] - somme[j2 + 1][i1] + somme[j1][i1];
        };

        let migliore = null;
        let areaMigliore = 0;
        for (let j1 = 0; j1 < ny; j1++) {
            for (let i1 = 0; i1 < nx; i1++) {
                for (let i2 = i1; i2 < nx && occupateFra(i1, j1, i2, j1) === 0; i2++) {
                    for (let j2 = j1; j2 < ny && occupateFra(i1, j1, i2, j2) === 0; j2++) {
                        const area = (xs[i2 + 1] - xs[i1]) * (ys[j2 + 1] - ys[j1]);
                        if (area > areaMigliore) {
                            areaMigliore = area;
                            migliore = { x: xs[i1], y: ys[j1], width: xs[i2 + 1] - xs[i1], height: ys[j2 + 1] - ys[j1] };
                        }
                    }
                }
            }
        }

        return {
            quota: areaMigliore / (L * H),
            rettangolo: migliore,
            metaBassaOccupata: 1 - liberoBasso / (L * H / 2)
        };
    },

    /*
     * Una riga per il log: cosa c'era da scegliere e cosa si e' scelto.
     * Serve al collaudo, dove l'unica cosa che si vede e' dove e' finita la foto.
     */
    descriviScelta(candidati, scelta, preferenza, larghezzaBase, altezzaBase, estensioni) {
        const opzioni = sceltaSpazio.normalizzaPreferenza(preferenza);
        const e = sceltaSpazio.normalizzaEstensioni(estensioni);
        const arrotonda = function (n) { return Math.round(n * 10) / 10; };
        const rettangolo = function (c) {
            return (c.direction ? c.direction + " " : "") + "x" + arrotonda(c.x) + " y" + arrotonda(c.y) + " " + arrotonda(c.width) + "x" + arrotonda(c.height);
        };

        let testo = "modo " + opzioni.modo;
        if (opzioni.modo === sceltaSpazio.centrato) {
            testo += " (tolleranza " + opzioni.tolleranzaArea + ", asse " + opzioni.asseCentratura + ")";
        }
        testo += ", base " + arrotonda(larghezzaBase) + "x" + arrotonda(altezzaBase);
        if (e.alto || e.sinistra || e.basso || e.destra) {
            testo += ", estensioni alto " + arrotonda(e.alto) + " sinistra " + arrotonda(e.sinistra) + " basso " + arrotonda(e.basso) + " destra " + arrotonda(e.destra);
        }
        testo += ", candidati [" + (candidati || []).map(rettangolo).join("; ") + "]";
        testo += ", scelto " + (scelta == null ? "nessuno" : rettangolo(scelta.candidato) + " area " + arrotonda(scelta.area));
        return testo;
    },

    /// I20-978: quanto va ingrandita o rimpicciolita ogni foto perche' tutte tornino alla
    /// stessa scala.
    ///
    /// Il fix foto non decide la grandezza delle foto: prende quella che hanno e conserva le
    /// proporzioni fra loro. Basta pero' che giri una volta su un gruppo ridotto, perche'
    /// l'operatore ne ha nascosta una, e le foto rimaste vengono ingrandite mentre quella
    /// nascosta resta com'era: riattivandola, la proporzione fra le due non vuol dire piu'
    /// niente e la foto tornata visibile appare piu' piccola.
    ///
    /// Si riportano quindi tutte alla scala della prima, che e' la primaria. Dove le scale
    /// sono gia' uguali, e cioe' ovunque non sia successo nulla del genere, i fattori valgono
    /// uno e non cambia niente.
    ///
    /// Una foto senza immagine, o con scala illeggibile, non si tocca: non sappiamo a che
    /// scala sia, e inventarne una la deformerebbe.
    fattoriDiNormalizzazione(scale) {
        const elenco = scale || [];
        const utilizzabile = function (valore) {
            return typeof valore === "number" && isFinite(valore) && valore > 0;
        };

        let riferimento = null;
        for (const scala of elenco) {
            if (utilizzabile(scala)) {
                riferimento = scala;
                break;
            }
        }

        if (riferimento == null) {
            return elenco.map(function () { return 1; });
        }

        return elenco.map(function (scala) {
            return utilizzabile(scala) ? riferimento / scala : 1;
        });
    }

}

module.exports = sceltaSpazio;
