/*
 * I20-1123: i campi di testo a riposo.
 *
 * In UXP i campi di testo nativi (textarea, input, sp-textfield) stanno sopra a qualunque elemento
 * HTML del pannello, con qualunque z-index: lo dice Adobe fra i limiti noti di UXP, e contenteditable
 * non c'e'. Suggerimenti, popup, domande, finestre e menu finivano sotto le caselle. Fino a I20-1123
 * li si nascondeva a mano: ogni campo marcato .hideble, spento all'apertura di una finestra e
 * riacceso alla chiusura, e un campo senza la classe, o un "riaccendi" nel momento sbagliato,
 * tornava sopra.
 *
 * Qui il problema si risolve nei campi, una volta sola. Ogni campo di testo del Plugin, quando non ci
 * si sta scrivendo, ha accanto un riquadro HTML con le sue misure, i suoi colori e il suo testo, e il
 * campo vero resta nella pagina invisibile: tutto puo' passare sopra al riquadro. Il resto del Plugin
 * non se ne accorge: .val(), gli eventi input e change, il salvataggio lavorano sul campo vero.
 *
 * Il campo vero si mostra quando il mouse entra nel riquadro (o, se l'entrata non e' arrivata, quando
 * si preme il tasto), cosi' il clic dell'operatore cade su di lui. Non si attiva mai da codice: un
 * campo nativo di UXP attivato con focus() riceve focus e keydown ma non scrive e non mostra il
 * cursore; si attiva solo col clic vero del mouse (traccia in console, 21/10/2026). Non si rimette a
 * riposo all'uscita del mouse, perche' il campo nativo manda entrata e uscita a raffica anche col
 * mouse fermo sopra, e il movimento del mouse non arriva al codice. Torna a riposo quando l'operatore
 * ne esce dopo averci scritto (blur), clicca altrove, passa su un altro campo, o quando qualcosa gli
 * compare sopra: finestre, domande, popup, caricamento, calendario, menu e suggerimenti chiamano
 * tuttiARiposo(), e un campo in cui si sta scrivendo esce dalla modifica.
 *
 * Un giro ogni INTERVALLO_MS trova i campi nuovi (i ridisegni ne creano in continuazione), allinea i
 * riquadri al valore scritto da codice e allo stile del campo, e toglie quelli dei campi spariti.
 * Il campo a riposo si spegne con visibility e position, non con display: cosi' chi lo nasconde o lo
 * mostra con display (jQuery hide/show) non si scontra con noi, e il riquadro lo segue.
 *
 * Provato in console con l'operatore il 21/10/2026: il suggerimento delle segnalazioni copre i
 * riquadri. L'aspetto del testo nativo l'abbiamo misurato al pixel su coppie di screenshot (riquadro
 * e campo vero della stessa casella): 10px system-ui, 5px dal bordo sinistro, interlinea 13px, bordo
 * #747474. Il campo nativo disegna il bordo del suo stile (il giallo della descrizione in mismatch) e
 * dentro il suo bordo grigio: il riquadro e' a due livelli, fuori il bordo dello stile, dentro il
 * grigio con margine, interlinea e testo. Margine e interlinea si scrivono alla nascita del riquadro:
 * cambiarli dopo non si vede. Il campo nativo mostra tutti gli spazi, anche iniziali e ripetuti: il
 * riquadro li tiene (pre-wrap nelle caselle, pre nei campi di una riga), o il testo si sposta (I20-1139).
 *
 * Usa le globali document e setInterval. Non fa require('indesign'): si carica sotto Node, e i test
 * ne provano le regole e il giro con un documento finto.
 */

const CampiARiposo = {

    /// Ogni quanto il giro cerca i campi nuovi e allinea i riquadri.
    INTERVALLO_MS: 250,

    /// Un campo con questo attributo resta sempre nativo.
    ATTRIBUTO_SEMPRE_NATIVO: "data-sempre-nativo",

    /// I tipi di input che sono campi di testo. Gli altri (password, caselle, pulsanti, date...)
    /// restano come sono: la password, in un riquadro HTML, si leggerebbe in chiaro.
    TIPI_DI_TESTO: ["", "text", "number", "search", "email", "tel", "url"],

    /// L'aspetto del testo nativo di UXP, misurato al pixel sugli screenshot: corpo e carattere,
    /// margine (nessuno sopra, 5px ai lati: anche a destra, per andare a capo dove va a capo il campo)
    /// e interlinea.
    CORPO: "10px",
    CARATTERE: "system-ui",
    RIEMPIMENTO: "0px 5px",
    INTERLINEA: "13px",

    /// I colori del campo nativo quando lo stile non ne da' (sfondo misurato sulla casella Ordine
    /// del Menabo'). Il bordo grigio il campo nativo lo disegna sempre, dentro quello dello stile se
    /// c'e'.
    SFONDO_NATIVO: "#444444",
    BORDO_NATIVO: "1px solid #747474",
    SPESSORE_BORDO_NATIVO: 1,

    /// Il campo nativo di una riga ha sopra e sotto due righe, una chiara fuori e una piu' scura
    /// dentro, e ai lati il grigio; gli angoli sono arrotondati (misurato sulla casella Ordine).
    BORDO_RIGA_FUORI: "1px solid #bcbcbc",
    BORDO_RIGA_DENTRO: "1px solid #8e8e8e",
    ANGOLI_RIGA: "2px",
    TESTO_NATIVO: "#dddddd",
    TESTO_SPENTO: "#9a9a9a",

    CLASSE_RIQUADRO: "campoARiposo",

    /// Il segno sul campo spento da noi. Una schermata copiata (cloneElementWithEvents) copia anche
    /// lo stile del campo spento: col segno si sa che quello non e' lo stile suo.
    ATTRIBUTO_SPENTO: "data-a-riposo",

    _timer: null,

    /// I campi con il loro riquadro.
    _campi: [],

    /// I campi mostrati (nativi), quello in cui si scrive e quelli solo sfiorati dal mouse.
    _mostrati: [],

    /* ---- le regole ---- */

    /// Se l'elemento e' un campo di testo da mettere a riposo.
    eCampoDiTesto(elemento) {
        if (elemento == null || elemento.tagName == null) {
            return false;
        }
        if (typeof elemento.hasAttribute === "function" && elemento.hasAttribute(CampiARiposo.ATTRIBUTO_SEMPRE_NATIVO)) {
            return false;
        }
        const tag = String(elemento.tagName).toLowerCase();
        const tipo = String((typeof elemento.getAttribute === "function" ? elemento.getAttribute("type") : null) || "").toLowerCase();
        if (tag === "textarea") {
            return true;
        }
        if (tag === "sp-textfield") {
            return tipo !== "password";
        }
        if (tag === "input") {
            return CampiARiposo.TIPI_DI_TESTO.indexOf(tipo) >= 0;
        }
        return false;
    },

    /// Il testo che il riquadro mostra: il valore o, se e' vuoto, il testo d'esempio.
    testoDaMostrare(valore, segnaposto) {
        const scritto = valore == null ? "" : String(valore);
        if (scritto !== "") {
            return { testo: scritto, segnaposto: false };
        }
        return { testo: segnaposto == null ? "" : String(segnaposto), segnaposto: true };
    },

    /// Le righe di un testo, qualunque sia il suo a capo.
    righe(testo) {
        return String(testo == null ? "" : testo).split(/\r\n|\r|\n/);
    },

    /* ---- il giro ---- */

    /// Accende i campi a riposo su tutto il pannello. Una volta sola, all'avvio del Plugin.
    /// Il giro a intervalli c'e' sempre: allinea anche i valori scritti da codice, che nessun
    /// evento annuncia. Se UXP ha MutationObserver, un campo nuovo va a riposo subito, senza
    /// restare nativo sopra un popup fino al giro successivo.
    avvia() {
        if (CampiARiposo._timer != null) {
            return;
        }
        CampiARiposo.giro();
        CampiARiposo._timer = setInterval(() => CampiARiposo.giro(), CampiARiposo.INTERVALLO_MS);

        //Il clic altrove rimette a riposo i campi solo sfiorati.
        document.addEventListener("click", (evento) => CampiARiposo._clicNellaPagina(evento));

        try {
            if (typeof MutationObserver === "function" && document.body != null) {
                CampiARiposo._osservatore = new MutationObserver(() => CampiARiposo._giroPresto());
                CampiARiposo._osservatore.observe(document.body, { childList: true, subtree: true });
            }
        }
        catch (err) {
            //resta il giro a intervalli
            CampiARiposo._osservatore = null;
        }
    },

    _osservatore: null,
    _giroInAttesa: false,

    /// Un giro appena finito quello che ha cambiato la pagina; piu' cambi insieme, un giro solo.
    /// I riquadri messi dal giro cambiano la pagina a loro volta: il giro dopo non trova niente di
    /// nuovo e si ferma li'.
    _giroPresto() {
        if (CampiARiposo._giroInAttesa) {
            return;
        }
        CampiARiposo._giroInAttesa = true;
        setTimeout(() => {
            CampiARiposo._giroInAttesa = false;
            CampiARiposo.giro();
        }, 0);
    },

    /// Un giro: via i riquadri dei campi spariti e quelli copiati senza campo, a riposo i campi
    /// nuovi che si vedono, e i riquadri allineati ai loro campi.
    giro() {
        //Senza pagina (sotto Node, nei test di chi lo chiama) non c'e' niente da mettere a riposo.
        if (typeof document === "undefined" || document == null || document.body == null) {
            return;
        }
        try {
            CampiARiposo._campi = CampiARiposo._campi.filter(campo => {
                if (document.body.contains(campo)) {
                    return true;
                }
                CampiARiposo._smonta(campo);
                return false;
            });

            //Un riquadro senza il suo campo e' la copia di una schermata clonata: non serve.
            Array.from(document.querySelectorAll("." + CampiARiposo.CLASSE_RIQUADRO)).forEach(riquadro => {
                if (riquadro.__campo == null && riquadro.parentNode != null) {
                    riquadro.parentNode.removeChild(riquadro);
                }
            });

            Array.from(document.querySelectorAll("textarea, input, sp-textfield")).forEach(campo => {
                if (campo.__riposo == null && CampiARiposo.eCampoDiTesto(campo) && CampiARiposo._siVede(campo)) {
                    CampiARiposo._monta(campo);
                }
            });

            CampiARiposo._campi.forEach(campo => CampiARiposo._allinea(campo));
        }
        catch (err) {
            console.error("Code CAR-01 Campi a riposo non aggiornati:", err);
        }
    },

    /// Un campo si mette a riposo solo quando si vede: prima non ha misure da copiare.
    _siVede(campo) {
        return campo.offsetWidth > 0 && campo.offsetHeight > 0;
    },

    /// Mette il campo a riposo: il riquadro prima di lui, con le sue misure, e lui invisibile.
    _monta(campo) {
        const riquadro = document.createElement("div");
        riquadro.className = CampiARiposo.CLASSE_RIQUADRO;
        riquadro.__campo = campo;

        let calcolato = null;
        try {
            calcolato = typeof window !== "undefined" && typeof window.getComputedStyle === "function" ? window.getComputedStyle(campo) : null;
        }
        catch (err) {
            calcolato = null;
        }

        //Fuori: il posto del campo, il suo sfondo e il bordo del suo stile.
        const stile = riquadro.style;
        const unaRiga = CampiARiposo.unaRiga(campo);
        stile.display = "inline-block";
        stile.verticalAlign = "top";
        stile.boxSizing = "border-box";
        stile.overflow = "hidden";
        stile.cursor = "text";
        if (unaRiga) {
            stile.borderRadius = CampiARiposo.ANGOLI_RIGA;
        }
        ["marginTop", "marginRight", "marginBottom", "marginLeft"].forEach(margine => {
            stile[margine] = campo.style[margine] || (calcolato != null && calcolato[margine]) || "0px";
        });

        //Dentro: il bordo grigio del campo nativo, il margine, l'interlinea e il testo.
        const interno = document.createElement("div");
        const dentro = interno.style;
        dentro.boxSizing = "border-box";
        dentro.width = "100%";
        dentro.height = "100%";
        dentro.overflow = "hidden";
        dentro.border = CampiARiposo.BORDO_NATIVO;
        if (unaRiga) {
            dentro.borderTop = CampiARiposo.BORDO_RIGA_DENTRO;
            dentro.borderBottom = CampiARiposo.BORDO_RIGA_DENTRO;
        }
        dentro.padding = CampiARiposo.RIEMPIMENTO;
        dentro.lineHeight = CampiARiposo.interlinea(campo);
        //TASK-19c18841: il corpo dello stile del campo, se ne ha uno: il campo nativo lo rispetta
        //(i campi delle pagine di Svuota e Bolli, a 14 px), e a riposo il testo resta grande uguale.
        dentro.fontSize = CampiARiposo.corpo(campo);
        dentro.fontFamily = CampiARiposo.CARATTERE;
        //Sempre a sinistra: il campo nativo ignora text-align (la casella Ordine e' "center" nello
        //stile, e il numero nativo sta a sinistra).
        dentro.textAlign = "left";
        riquadro.appendChild(interno);

        const stato = {
            riquadro: riquadro,
            interno: interno,
            larghezzaMisurata: campo.offsetWidth + "px",
            altezzaMisurata: campo.offsetHeight + "px",
            visibilita: campo.hasAttribute(CampiARiposo.ATTRIBUTO_SPENTO) ? "" : campo.style.visibility,
            posizione: campo.hasAttribute(CampiARiposo.ATTRIBUTO_SPENTO) ? "" : campo.style.position,
            ultimo: null,
            inModifica: false,
            alPassaggio: () => CampiARiposo.mostra(campo),
            allUscita: () => CampiARiposo.aRiposo(campo)
        };
        campo.__riposo = stato;

        campo.parentNode.insertBefore(riquadro, campo);
        //Il mouse che entra mostra il campo vero; il tasto premuto, se l'entrata non e' arrivata.
        riquadro.addEventListener("mouseenter", stato.alPassaggio);
        riquadro.addEventListener("mousedown", stato.alPassaggio);
        campo.addEventListener("blur", stato.allUscita);

        CampiARiposo._spegniCampo(campo);
        CampiARiposo._campi.push(campo);
        CampiARiposo._allinea(campo);
    },

    /// Toglie il riquadro e rimette il campo com'era.
    _smonta(campo) {
        const stato = campo.__riposo;
        if (stato == null) {
            return;
        }
        try {
            stato.riquadro.removeEventListener("mouseenter", stato.alPassaggio);
            stato.riquadro.removeEventListener("mousedown", stato.alPassaggio);
            campo.removeEventListener("blur", stato.allUscita);
            if (stato.riquadro.parentNode != null) {
                stato.riquadro.parentNode.removeChild(stato.riquadro);
            }
            CampiARiposo._accendiCampo(campo);
        }
        catch (err) {
            //un campo gia' tolto non ha niente da rimettere
        }
        stato.riquadro.__campo = null;
        campo.__riposo = null;
        CampiARiposo._mostrati = CampiARiposo._mostrati.filter(c => c !== campo);
    },

    /// Il campo a riposo: invisibile e fuori dal flusso, al posto suo c'e' il riquadro.
    _spegniCampo(campo) {
        campo.setAttribute(CampiARiposo.ATTRIBUTO_SPENTO, "");
        campo.style.visibility = "hidden";
        campo.style.position = "absolute";
    },

    _accendiCampo(campo) {
        const stato = campo.__riposo;
        campo.removeAttribute(CampiARiposo.ATTRIBUTO_SPENTO);
        campo.style.visibility = stato.visibilita;
        campo.style.position = stato.posizione;
    },

    /// Il riquadro segue il campo: dove sta, se si vede, misure, colori e testo.
    _allinea(campo) {
        const stato = campo.__riposo;
        if (stato == null || stato.inModifica) {
            return;
        }
        const riquadro = stato.riquadro;
        const stile = riquadro.style;

        //Spostato da codice: il riquadro gli va dietro.
        if (campo.parentNode != null && campo.previousSibling !== riquadro) {
            campo.parentNode.insertBefore(riquadro, campo);
        }

        //Si scrive solo quello che cambia: il giro passa quattro volte al secondo.
        const imposta = (proprieta, valore) => {
            if (stile[proprieta] !== valore) {
                stile[proprieta] = valore;
            }
        };
        imposta("display", campo.style.display === "none" ? "none" : "inline-block");
        //Una larghezza in pixel nello stile non e' quella vera: il campo nativo di una riga occupa
        //qualche pixel in piu' (Ordine: 45 con uno stile da 40). Vale quella misurata alla nascita;
        //una percentuale si tiene, perche' segua il pannello.
        const larghezza = campo.style.width;
        imposta("width", larghezza && !/px$/.test(larghezza) ? larghezza : stato.larghezzaMisurata);
        imposta("height", campo.style.height || stato.altezzaMisurata);
        imposta("backgroundColor", campo.style.backgroundColor || CampiARiposo.SFONDO_NATIVO);
        //Il bordo dello stile; senza, quello chiaro di sopra e sotto dei campi di una riga.
        const bordoStile = campo.style.border;
        const unaRiga = CampiARiposo.unaRiga(campo);
        imposta("borderTop", bordoStile || (unaRiga ? CampiARiposo.BORDO_RIGA_FUORI : "none"));
        imposta("borderBottom", bordoStile || (unaRiga ? CampiARiposo.BORDO_RIGA_FUORI : "none"));
        imposta("borderLeft", bordoStile || "none");
        imposta("borderRight", bordoStile || "none");

        const disattivo = campo.disabled === true;
        const etichetta = CampiARiposo._etichetta(campo);
        const mostrato = CampiARiposo.testoDaMostrare(campo.value, campo.placeholder || campo.getAttribute("placeholder"));
        const chiave = [mostrato.testo, mostrato.segnaposto, disattivo, etichetta, campo.style.color].join("\u0001");
        if (chiave === stato.ultimo) {
            return;
        }
        stato.ultimo = chiave;

        const interno = stato.interno;
        stile.cursor = disattivo ? "default" : "text";
        interno.style.color = disattivo || mostrato.segnaposto ? CampiARiposo.TESTO_SPENTO : (campo.style.color || CampiARiposo.TESTO_NATIVO);
        //Gli spazi come nel campo nativo, anche iniziali e ripetuti: con "normal" e "nowrap" il riquadro
        //li perdeva, e il testo si spostava al passaggio del mouse (I20-1139: " OSELLA", 3px a destra).
        interno.style.whiteSpace = String(campo.tagName).toLowerCase() === "textarea" ? "pre-wrap" : "pre";

        while (interno.firstChild) {
            interno.removeChild(interno.firstChild);
        }
        if (etichetta != null) {
            const testa = document.createElement("div");
            testa.style.fontSize = "11px";
            testa.style.marginBottom = "2px";
            testa.textContent = etichetta;
            interno.appendChild(testa);
        }
        CampiARiposo.righe(mostrato.testo).forEach((riga, indice) => {
            if (indice > 0) {
                interno.appendChild(document.createElement("br"));
            }
            interno.appendChild(document.createTextNode(riga));
        });
    },

    /// L'etichetta di un sp-textfield, che il campo disegna sopra il valore.
    _etichetta(campo) {
        if (String(campo.tagName).toLowerCase() !== "sp-textfield" || typeof campo.querySelector !== "function") {
            return null;
        }
        const etichetta = campo.querySelector("sp-label");
        const testo = etichetta != null ? String(etichetta.textContent || "").trim() : "";
        return testo !== "" ? testo : null;
    },

    /// Se e' un campo di una riga: input, o sp-textfield senza etichetta.
    unaRiga(campo) {
        const tag = String(campo.tagName).toLowerCase();
        return tag !== "textarea" && CampiARiposo._etichetta(campo) == null;
    },

    /// TASK-19c18841: il corpo del testo del riquadro: quello dello stile del campo, o quello nativo.
    corpo(campo) {
        const scritto = campo != null && campo.style != null ? campo.style.fontSize : "";
        return scritto ? scritto : CampiARiposo.CORPO;
    },

    /// L'interlinea del riquadro. Il campo di una riga mette il testo a meta' altezza: la riga e' alta
    /// quanto il suo interno, senza i bordi di sopra e di sotto (quello dello stile o, senza, la riga
    /// chiara nativa; poi quella nativa dentro).
    interlinea(campo) {
        if (!CampiARiposo.unaRiga(campo)) {
            return CampiARiposo.INTERLINEA;
        }
        const fuori = campo.style.border ? CampiARiposo.spessoreBordo(campo.style.border) : CampiARiposo.SPESSORE_BORDO_NATIVO;
        const interno = (campo.offsetHeight || 0) - 2 * fuori - 2 * CampiARiposo.SPESSORE_BORDO_NATIVO;
        return interno > 0 ? interno + "px" : CampiARiposo.INTERLINEA;
    },

    /// Lo spessore del bordo scritto nello stile del campo ("2px solid gold" -> 2), 0 se non c'e'.
    spessoreBordo(bordo) {
        const trovato = /(\d+(?:\.\d+)?)px/.exec(String(bordo || ""));
        return trovato != null ? Number(trovato[1]) : 0;
    },

    /* ---- scrivere ---- */

    /// Il mouse sul riquadro: al suo posto il campo vero, che cosi' riceve il clic dell'operatore.
    /// Non gli si da' lo stato attivo da codice: non servirebbe a scriverci. Gli altri campi solo
    /// sfiorati tornano a riposo; quello in cui si sta scrivendo resta, e torna all'uscita.
    /// Un campo disattivato resta a riposo.
    mostra(campo) {
        const stato = campo != null ? campo.__riposo : null;
        if (stato == null || stato.inModifica || campo.disabled === true) {
            return false;
        }
        CampiARiposo._mostrati.slice().forEach(altro => {
            if (altro !== campo && !CampiARiposo._attivo(altro)) {
                CampiARiposo.aRiposo(altro);
            }
        });

        stato.inModifica = true;
        CampiARiposo._mostrati.push(campo);
        stato.riquadro.style.display = "none";
        CampiARiposo._accendiCampo(campo);
        return true;
    },

    /// Se l'operatore sta scrivendo nel campo.
    _attivo(campo) {
        try {
            return typeof document !== "undefined" && document.activeElement === campo;
        }
        catch (err) {
            return false;
        }
    },

    /// Un clic nella pagina: i campi solo sfiorati, fuori da quello che si e' cliccato, tornano a
    /// riposo. Il clic che apre il campo arriva dal suo riquadro o dal campo stesso: quello no.
    _clicNellaPagina(evento) {
        const bersaglio = evento != null ? evento.target : null;
        CampiARiposo._mostrati.slice().forEach(campo => {
            const stato = campo.__riposo;
            if (stato == null || bersaglio === campo || CampiARiposo._attivo(campo)) {
                return;
            }
            if (bersaglio != null && (bersaglio === stato.riquadro || stato.riquadro.contains(bersaglio))) {
                return;
            }
            if (bersaglio != null && typeof campo.contains === "function" && campo.contains(bersaglio)) {
                return;
            }
            CampiARiposo.aRiposo(campo);
        });
    },

    /// Torna il riquadro, con il testo che c'e' adesso: all'uscita dal campo, o quando lo chiede
    /// qualcuno.
    aRiposo(campo) {
        const stato = campo != null ? campo.__riposo : null;
        if (stato == null || !stato.inModifica) {
            return false;
        }
        stato.inModifica = false;
        CampiARiposo._mostrati = CampiARiposo._mostrati.filter(c => c !== campo);
        CampiARiposo._spegniCampo(campo);
        stato.ultimo = null;
        CampiARiposo._allinea(campo);
        return true;
    },

    /// Chi apre qualcosa sopra il pannello lo chiama: finestre, domande, popup, caricamento,
    /// calendario, menu, suggerimenti. Tutti i campi mostrati tornano a riposo, anche quello in cui
    /// si sta scrivendo, che esce dalla modifica: un campo nativo resterebbe sopra a quello che si apre.
    /// tranne: l'elemento da cui parte quello che si apre (il suggerimento di un campo col suo title),
    /// se e' un campo o ci sta dentro, resta com'e': altrimenti passandoci sopra comparirebbe e
    /// sparirebbe di continuo.
    tuttiARiposo(tranne = null) {
        const mostrati = CampiARiposo._mostrati.filter(campo => !(tranne != null
            && (campo === tranne || (typeof campo.contains === "function" && campo.contains(tranne)))));
        mostrati.forEach(campo => {
            if (CampiARiposo._attivo(campo)) {
                try {
                    campo.blur();
                }
                catch (err) {
                    //si mette a riposo comunque, qui sotto
                }
            }
            CampiARiposo.aRiposo(campo);
        });
        return mostrati.length > 0;
    }
};

module.exports = CampiARiposo;
