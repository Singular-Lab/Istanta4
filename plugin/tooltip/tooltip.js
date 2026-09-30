/// I20-1012: i suggerimenti al passaggio del mouse, usciti da utility.js.
///
/// Qui ci sono il ciclo e il disegno: il gestore delegato che ascolta l'hover, il ritardo, il
/// riquadro .jq-tooltip. Dove metterlo lo decide posizione.js, che era tooltipPosizione.js e che
/// non tocca il DOM.
///
/// Gli altri file lo chiamano Tooltip.X, come globale dichiarata da indexNew.js. Non fa
/// require('indesign'): si carica sotto Node, e i test lo chiamano.
const tooltipPosizione = require('./posizione');

const Tooltip = {
    //I20-981: i tooltip del plugin.
    //In UXP l'attributo title non mostra niente, e i title scritti in giro per il plugin, un
    //centinaio, erano muti. Invece di toccarli uno per uno, un solo gestore delegato ascolta
    //l'hover su qualunque elemento che abbia un title e disegna il riquadro .jq-tooltip
    //previsto in index.html: valgono anche i title creati dopo, che qui nascono in continuazione
    //insieme alle righe dei pannelli.
    _tooltipGlobaliAttivi: false,
    _riquadroTooltip: null,
    _timerTooltip: null,
    _ancoraTooltip: null,
    RITARDO_TOOLTIP: 350,
    ATTRIBUTO_TOOLTIP: "data-tooltip",
    //Larghezza che chiediamo per il riquadro: oltre questa il testo va a capo.
    LARGHEZZA_TOOLTIP: 260,

    /// Accende i tooltip su tutto il pannello. In UXP l'attributo title non basta su un
    /// elemento creato da codice, quindi il riquadro lo disegna il Plugin: qui c'e' il ciclo e
    /// il disegno, mentre dove metterlo lo decide posizione.js, che e' verificabile.
    abilitaTooltipGlobali() {
        if (this._tooltipGlobaliAttivi) {
            return;
        }

        this._tooltipGlobaliAttivi = true;
        const me = this;

        $(document).on("mouseenter", "[" + this.ATTRIBUTO_TOOLTIP + "], [title]", function (evento) {
            try {
                //Con elementi annidati che hanno entrambi un suggerimento vince il piu' interno,
                //quello che il mouse sta davvero toccando.
                const piuInterno = $(evento.target).closest("[" + me.ATTRIBUTO_TOOLTIP + "], [title]")[0];
                if (piuInterno != null && piuInterno !== this) {
                    return;
                }

                const testo = me._testoDelTooltip(this);
                if (testo == null) {
                    return;
                }

                me.nascondiTooltip();

                const elemento = this;
                me._timerTooltip = setTimeout(function () {
                    me._mostraTooltip(elemento, testo);
                }, me.RITARDO_TOOLTIP);
            }
            catch (err) {
                console.error("Errore durante l'apertura del tooltip:", err);
            }
        });

        $(document).on("mouseleave", "[" + this.ATTRIBUTO_TOOLTIP + "], [title]", function () {
            me.nascondiTooltip();
        });

        //Un clic sposta o cambia il pannello: il riquadro sparisce.
        //Niente aggancio allo scorrimento: scroll non risale fino a document e jQuery non
        //sa ascoltarlo in cattura, quindi sarebbe un gestore che non parte mai.
        $(document).on("click", function () {
            me.nascondiTooltip();
        });
    },

    /// Il testo da mostrare, e al primo passaggio del mouse il trasloco del vecchio title.
    /// InDesign un suggerimento suo per l'attributo title lo mostra, e sarebbe il doppione di
    /// questo: portando il testo su un attributo nostro resta un suggerimento solo.
    _testoDelTooltip(elemento) {
        const titolo = tooltipPosizione.testoTooltip(elemento.getAttribute("title"));
        if (titolo != null) {
            this.impostaTooltip(elemento, titolo);
            return titolo;
        }

        return tooltipPosizione.testoTooltip(elemento.getAttribute(this.ATTRIBUTO_TOOLTIP));
    },

    /// Il modo giusto di dare un suggerimento a un elemento creato da codice.
    /// In UXP scrivere elemento.title come proprieta' non crea l'attributo, e chi guarda
    /// l'attributo (il suggerimento di InDesign e questo gestore) non vede niente: e' per
    /// questo che i pulsanti del report erano muti. Qui si scrive l'attributo, sempre.
    impostaTooltip(elemento, testo) {
        if (elemento == null || elemento.setAttribute == null) {
            return;
        }

        const pulito = tooltipPosizione.testoTooltip(testo);

        if (pulito == null) {
            elemento.removeAttribute(this.ATTRIBUTO_TOOLTIP);
        }
        else {
            elemento.setAttribute(this.ATTRIBUTO_TOOLTIP, pulito);
        }

        if (elemento.removeAttribute != null) {
            elemento.removeAttribute("title");
        }
    },

    /// Nasconde il riquadro e annulla quello in attesa di comparire.
    nascondiTooltip() {
        if (this._timerTooltip != null) {
            clearTimeout(this._timerTooltip);
            this._timerTooltip = null;
        }

        this._ancoraTooltip = null;

        if (this._riquadroTooltip != null) {
            this._riquadroTooltip.style.display = "none";
            this._riquadroTooltip.style.visibility = "hidden";
        }
    },

    //I20-981: il riquadro si mette dove dice tooltipPosizione, che non lo misura.
    //Misurarlo era il difetto: passando da un elemento all'altro UXP restituiva le dimensioni
    //del testo precedente e il riquadro usciva spostato di quella differenza. Ora si usano il
    //rettangolo dell'elemento e i limiti massimi che imponiamo qui sotto in stile: il riquadro
    //puo' essere piu' piccolo del limite, mai piu' grande, e tanto basta a tenerlo dentro.
    _mostraTooltip(elemento, testo) {
        try {
            if (elemento == null || !document.body.contains(elemento)) {
                return;
            }

            const riquadro = this._creaRiquadroTooltip();
            const finestra = this._dimensioniPannello();

            let rettangolo = null;
            try {
                rettangolo = elemento.getBoundingClientRect();
            }
            catch (err) {
                rettangolo = null;
            }

            const ancoraggio = tooltipPosizione.ancoraggioTooltip(
                rettangolo || {}, finestra, this.LARGHEZZA_TOOLTIP);

            riquadro.textContent = testo;
            riquadro.style.maxWidth = ancoraggio.maxWidth + "px";
            riquadro.style.maxHeight = ancoraggio.maxHeight + "px";
            riquadro.style.left = ancoraggio.left + "px";

            //Uno dei due, mai tutti e due: l'altro va rimesso ad auto, altrimenti resta quello
            //del suggerimento precedente e il riquadro si stira.
            if (ancoraggio.top != null) {
                riquadro.style.top = ancoraggio.top + "px";
                riquadro.style.bottom = "auto";
            }
            else {
                riquadro.style.bottom = ancoraggio.bottom + "px";
                riquadro.style.top = "auto";
            }

            riquadro.style.visibility = "visible";
            riquadro.style.display = "block";
        }
        catch (err) {
            console.error("Errore durante la posa del tooltip:", err);
            this.nascondiTooltip();
        }
    },

    /// Il riquadro unico dei suggerimenti: si crea la prima volta, poi si riusa.
    _creaRiquadroTooltip() {
        if (this._riquadroTooltip != null && document.body.contains(this._riquadroTooltip)) {
            return this._riquadroTooltip;
        }

        const riquadro = document.createElement("div");
        riquadro.className = "jq-tooltip";
        riquadro.id = "tooltipGlobale";
        document.body.appendChild(riquadro);

        this._riquadroTooltip = riquadro;
        return riquadro;
    },

    /// Le misure del pannello del plugin, che e' cio' che i tooltip non devono mai superare.
    /// I20-981: prima si guardava window.innerWidth, che in UXP non e' la finestra del
    /// pannello: su quelle misure il riquadro finiva fuori dai bordi e il testo lungo non
    /// andava a capo dove doveva. #wrapper e' la stessa fonte che usa onresizeWindow.
    _dimensioniPannello() {
        const candidati = [
            document.getElementById("wrapper"),
            document.documentElement,
            document.body
        ];

        for (let i = 0; i < candidati.length; i++) {
            const elemento = candidati[i];
            if (elemento == null) {
                continue;
            }

            const larghezza = elemento.clientWidth;
            const altezza = elemento.clientHeight;

            if (larghezza > 0 && altezza > 0) {
                return { width: larghezza, height: altezza };
            }
        }

        if (typeof window !== "undefined" && window.innerWidth > 0 && window.innerHeight > 0) {
            return { width: window.innerWidth, height: window.innerHeight };
        }

        return { width: 800, height: 600 };
    },
};

module.exports = Tooltip;
