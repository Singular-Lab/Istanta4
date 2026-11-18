/*
 * Momento di esecuzione delle regole del framework CSS.
 *
 * L'ordine delle operazioni su un box e' fisso: ridimensionamenti, post ridimensionamenti,
 * allineamenti e infine la sistemazione delle foto. Va bene quasi sempre, ma alcune regole
 * hanno senso solo dopo che le foto hanno preso la loro posizione definitiva: prima di allora
 * si allineano a qualcosa che sta ancora per spostarsi.
 *
 * Invece di rendere configurabile l'intera sequenza, ogni regola dichiara in quale momento
 * vuole essere eseguita. Il motore riceve un DB gia' filtrato per quel momento e non sa
 * nemmeno che i momenti esistono: e' il motivo per cui questo meccanismo resta piccolo.
 *
 * Una regola senza "fase" appartiene al momento standard, quindi a dati invariati l'ordine
 * e' esattamente quello di prima.
 *
 * I20-1240: dopo il momento standard il cliente puo' dichiarare nel CssFramework la sequenza del
 * fix foto (fixFoto.sequenza): passi "fixFoto" (il fix foto, anche piu' volte), "fase" (le regole
 * con quella fase, un nome scelto dal cliente) e "simulazioni" (il box provato in piu' varianti,
 * tenendo la migliore). Qui si leggono e si validano la sequenza e i nomi delle fasi; li esegue
 * SistemazioneFoto.eseguiSequenza. Il momento dopoFixFoto resta dopo tutta la sequenza.
 *
 * Esecuzione dei test: node --test tests/plugin/*.test.js
 *
 * I20-1007: una delle parti pure del motore CSS, in cssFramework/. Fino ad allora era
 * cssSequenzaOperazioni.js in radice, e chi lo importa lo chiama ancora cssSequenzaOperazioni.
 */

const cssSequenzaOperazioni = {

    standard: "standard",
    dopoFixFoto: "dopoFixFoto",

    //In ordine di esecuzione. Aggiungere un momento qui e' l'unico modo previsto per estenderli.
    momenti: ["standard", "dopoFixFoto"],

    //Regole che partecipano ai momenti. Duplicazioni e ordiniZ ne restano fuori di proposito:
    //la composizione del box viene rieseguita in ogni momento, perche' gli elementi derivati
    //devono inseguire i propri bersagli tutte le volte che questi si spostano.
    chiaviRegole: ["ridimensionamenti", "postRidimensionamenti", "allineamenti"],

    /*
     * I20-1240: le fasi con un nome scelto dal cliente, quelle che le sequenze del fix foto
     * (fixFoto.sequenza nel CssFramework) eseguono nel punto che vogliono. Non sono momenti fissi:
     * una loro regola si esegue solo quando un passo della sequenza la chiama, mai nel momento
     * standard. Le registra registraFasiDelFile quando arrivano le regole del cliente.
     */
    fasiDichiarate: [],

    //I20-1240: i tipi di passo di una sequenza del fix foto.
    passoFixFoto: "fixFoto",
    passoFase: "fase",
    passoSimulazioni: "simulazioni",

    /*
     * Un valore assente, vuoto o sconosciuto vale come standard: un refuso nel dato non deve
     * far sparire una regola, al massimo la lascia dov'era.
     * I20-1240: una fase dichiarata da una sequenza del fix foto (fasiDichiarate) e' un momento suo.
     */
    normalizzaMomento(fase) {
        if (fase == null || fase === "") {
            return cssSequenzaOperazioni.standard;
        }

        for (let i = 0; i < cssSequenzaOperazioni.momenti.length; i++) {
            if (cssSequenzaOperazioni.momenti[i].toLowerCase() === String(fase).toLowerCase()) {
                return cssSequenzaOperazioni.momenti[i];
            }
        }

        const dichiarate = Array.isArray(cssSequenzaOperazioni.fasiDichiarate) ? cssSequenzaOperazioni.fasiDichiarate : [];
        for (let i = 0; i < dichiarate.length; i++) {
            if (dichiarate[i].toLowerCase() === String(fase).trim().toLowerCase()) {
                return dichiarate[i];
            }
        }

        console.warn("cssSequenzaOperazioni: fase sconosciuta '" + fase + "', la regola resta nel momento standard.");
        return cssSequenzaOperazioni.standard;
    },

    /*
     * I20-1240: il tipo di un passo della sequenza, scritto come vuole il cliente (maiuscole
     * comprese), o null se non e' uno dei tre.
     */
    tipoDelPasso(passo) {
        if (passo == null || typeof passo !== "object" || passo.tipo == null) {
            return null;
        }
        const tipo = String(passo.tipo).trim().toLowerCase();
        const tipi = [cssSequenzaOperazioni.passoFixFoto, cssSequenzaOperazioni.passoFase, cssSequenzaOperazioni.passoSimulazioni];
        for (let i = 0; i < tipi.length; i++) {
            if (tipi[i].toLowerCase() === tipo) {
                return tipi[i];
            }
        }
        return null;
    },

    /*
     * I20-1240: i passi validi di un elenco, nel loro ordine. conSimulazioni false: dentro una
     * variante, dove una simulazione annidata non ha senso. Un passo sconosciuto o una fase senza
     * nome si saltano con un avviso: un refuso non deve fermare l'impaginazione.
     */
    normalizzaPassi(passi, conSimulazioni) {
        const esito = [];
        (Array.isArray(passi) ? passi : []).forEach(function (passo) {
            const tipo = cssSequenzaOperazioni.tipoDelPasso(passo);
            if (tipo === cssSequenzaOperazioni.passoFixFoto) {
                esito.push({ tipo: tipo });
                return;
            }
            if (tipo === cssSequenzaOperazioni.passoFase) {
                const fase = passo.fase != null ? String(passo.fase).trim() : "";
                if (fase === "") {
                    console.warn("cssSequenzaOperazioni: passo fase senza nome, saltato.");
                    return;
                }
                //Una fase fissa (dopoFixFoto) si scrive come la scrive il motore; le altre come le
                //scrive il cliente: normalizzaMomento le riconosce senza le maiuscole.
                const fissa = cssSequenzaOperazioni.momenti.find(m => m.toLowerCase() === fase.toLowerCase());
                esito.push({ tipo: tipo, fase: fissa != null ? fissa : fase });
                return;
            }
            if (tipo === cssSequenzaOperazioni.passoSimulazioni && conSimulazioni) {
                const varianti = (Array.isArray(passo.varianti) ? passo.varianti : [])
                    .filter(v => v != null && typeof v === "object")
                    .map(function (v, i) {
                        return {
                            nome: v.nome != null && String(v.nome).trim() !== "" ? String(v.nome) : "variante " + (i + 1),
                            passi: cssSequenzaOperazioni.normalizzaPassi(v.passi, false),
                            listSetCondizioni: Array.isArray(v.listSetCondizioni) ? v.listSetCondizioni : [],
                            scartaSe: cssSequenzaOperazioni.normalizzaScartaSe(v.scartaSe)
                        };
                    });
                if (varianti.length === 0) {
                    console.warn("cssSequenzaOperazioni: simulazioni senza varianti, passo saltato.");
                    return;
                }
                esito.push({ tipo: tipo, varianti: varianti });
                return;
            }
            console.warn("cssSequenzaOperazioni: passo '" + (passo != null ? passo.tipo : passo) + "' non previsto qui, saltato.");
        });
        return esito;
    },

    /*
     * I20-1240: la sequenza del fix foto di un box (fixFoto.sequenza), con i soli passi validi.
     * Null quando il box non ne dichiara una, o nessun passo e' valido: allora il fix foto resta
     * quello di sempre.
     */
    normalizzaSequenza(sequenza) {
        if (!Array.isArray(sequenza) || sequenza.length === 0) {
            return null;
        }
        const passi = cssSequenzaOperazioni.normalizzaPassi(sequenza, true);
        return passi.length > 0 ? passi : null;
    },

    /*
     * I20-1240: quando scartare una variante delle simulazioni. overflow: testi che non devono
     * traboccare; sovrapposizioni: elementi che non devono toccarne altri; fuoriBase: elementi che
     * devono restare dentro la base del box; rientroInGriglia: elementi che il motore, durante la
     * variante, ha dovuto riportare dentro la griglia del box (lo spostamento che annota per la
     * CSF-008). Etichette anche con l'asterisco.
     */
    normalizzaScartaSe(scartaSe) {
        const elenco = v => (Array.isArray(v) ? v : []).filter(e => e != null && String(e).trim() !== "").map(e => String(e));
        const s = scartaSe != null && typeof scartaSe === "object" ? scartaSe : {};
        return {
            overflow: elenco(s.overflow),
            sovrapposizioni: (Array.isArray(s.sovrapposizioni) ? s.sovrapposizioni : [])
                .filter(r => r != null && typeof r === "object")
                .map(r => ({ elementi: elenco(r.elementi), con: elenco(r.con) }))
                .filter(r => r.elementi.length > 0 && r.con.length > 0),
            fuoriBase: elenco(s.fuoriBase),
            rientroInGriglia: elenco(s.rientroInGriglia)
        };
    },

    /*
     * I20-1240: i nomi delle fasi che le sequenze del fix foto di un file di regole eseguono,
     * ovunque si trovino (sezione generale, perBox, voci dei kit, condizionali, varianti). Le fasi
     * fisse (standard, dopoFixFoto) restano fuori.
     */
    fasiDelleSequenze(file) {
        const nomi = [];
        const aggiungi = function (fase) {
            if (fase == null) {
                return;
            }
            const nome = String(fase).trim();
            if (nome === "" || cssSequenzaOperazioni.momenti.some(m => m.toLowerCase() === nome.toLowerCase())
                || nomi.some(n => n.toLowerCase() === nome.toLowerCase())) {
                return;
            }
            nomi.push(nome);
        };
        const daiPassi = function (passi) {
            (Array.isArray(passi) ? passi : []).forEach(function (passo) {
                const tipo = cssSequenzaOperazioni.tipoDelPasso(passo);
                if (tipo === cssSequenzaOperazioni.passoFase) {
                    aggiungi(passo.fase);
                }
                else if (tipo === cssSequenzaOperazioni.passoSimulazioni) {
                    (Array.isArray(passo.varianti) ? passo.varianti : []).forEach(v => daiPassi(v != null ? v.passi : null));
                }
            });
        };
        const visita = function (nodo) {
            if (Array.isArray(nodo)) {
                nodo.forEach(visita);
                return;
            }
            if (nodo == null || typeof nodo !== "object") {
                return;
            }
            Object.keys(nodo).forEach(function (chiave) {
                if (chiave === "sequenza" && Array.isArray(nodo[chiave])) {
                    daiPassi(nodo[chiave]);
                }
                else {
                    visita(nodo[chiave]);
                }
            });
        };
        visita(file);
        return nomi;
    },

    /// I20-1240: ricorda le fasi delle sequenze del file di regole appena arrivato (fasiDelleSequenze).
    registraFasiDelFile(file) {
        cssSequenzaOperazioni.fasiDichiarate = cssSequenzaOperazioni.fasiDelleSequenze(file);
        return cssSequenzaOperazioni.fasiDichiarate;
    },

    /// Se una regola appartiene al momento dato. Il confronto passa da normalizzaMomento su
    /// entrambi i lati, cosi' una regola senza fase e una richiesta di "standard" si incontrano.
    regolaNelMomento(regola, momento) {
        if (regola == null) {
            return false;
        }
        return cssSequenzaOperazioni.normalizzaMomento(regola.fase) === cssSequenzaOperazioni.normalizzaMomento(momento);
    },

    /// Le sole regole del momento. Un elenco assente resta assente, un elenco vuoto resta vuoto:
    /// chi chiama distingue "non ci sono regole" da "non ce ne sono per adesso".
    filtraRegole(regole, momento) {
        if (regole == null || regole.length === 0) {
            return regole == null ? regole : [];
        }
        return regole.filter(regola => cssSequenzaOperazioni.regolaNelMomento(regola, momento));
    },

    /*
     * Copia del DB con le sole regole del momento richiesto.
     *
     * Il DB originale non viene toccato: e' lo stesso oggetto per tutti i box della lavorazione
     * e una modifica in posto si porterebbe dietro il box successivo.
     *
     * Attenzione, limite noto: una regola di un livello piu' specifico sopprime quella omonima
     * del livello di default solo se le due si incontrano nello stesso momento. Una regola e la
     * sua sovrascrittura vanno quindi tenute sulla stessa fase.
     */
    filtraDBPerMomento(DB, momento) {
        if (DB == null) {
            return DB;
        }

        const momentoNormalizzato = cssSequenzaOperazioni.normalizzaMomento(momento);

        return DB.map(function (elementoBox) {
            if (elementoBox == null) {
                return elementoBox;
            }

            const copia = Object.assign({}, elementoBox);
            for (const chiave of cssSequenzaOperazioni.chiaviRegole) {
                copia[chiave] = cssSequenzaOperazioni.filtraRegole(elementoBox[chiave], momentoNormalizzato);
            }
            return copia;
        });
    },

    /*
     * C'e' qualcosa da fare in questo momento? Serve a non pagare un giro di operazioni
     * a vuoto su ogni box quando nessun cliente usa il momento.
     * I20-1240: chiavi, se c'e', limita la domanda a quei tipi di regole (per esempio i soli
     * ridimensionamenti), fra quelli di chiaviRegole.
     */
    esistonoRegole(DB, momento, chiavi = null) {
        if (DB == null) {
            return false;
        }

        const daGuardare = Array.isArray(chiavi)
            ? cssSequenzaOperazioni.chiaviRegole.filter(c => chiavi.indexOf(c) >= 0)
            : cssSequenzaOperazioni.chiaviRegole;

        for (const elementoBox of DB) {
            if (elementoBox == null) {
                continue;
            }
            for (const chiave of daGuardare) {
                const regole = elementoBox[chiave];
                if (regole == null) {
                    continue;
                }
                for (const regola of regole) {
                    if (cssSequenzaOperazioni.regolaNelMomento(regola, momento)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

}

module.exports = cssSequenzaOperazioni;
