/*
 * I20-1121: la vista affiancata del pannello del Plugin.
 *
 * Con il pannello largo almeno SOGLIA una schermata (le segnalazioni di impaginazione, il Report
 * Integrita') non copre piu' tutto il pannello: si apre come colonna fissa a destra, non modale, e a
 * sinistra il Plugin resta com'e', largo LARGHEZZA_SINISTRA, usabile insieme alla colonna. Gli
 * elementi fissi sempre a schermo (testata, barre in fondo, messaggi) si confinano a sinistra finche'
 * c'e' almeno una colonna aperta, e tornano come prima quando non ce n'e' piu' nessuna.
 *
 * Le regole erano nate in segnalazioni/schermata.js (I20-1116) per le segnalazioni; con il report
 * sono diventate della disposizione del pannello e stanno qui. Ogni schermata decide da se' che cosa
 * mettere nella colonna; qui ci sono soglia, misure, confinamento e guscio della colonna.
 *
 * Cose imparate in UXP: window.innerWidth non esiste (la larghezza e' quella del documento);
 * right: 0 aggancia al bordo del pannello, le misure orizzontali calcolate no; gap nei flex non
 * vale (si usano i margini); closest su un id appena creato non trovava la colonna (qui si guarda
 * se l'id c'e').
 *
 * Usa le globali $ e document come gli altri moduli. Non fa require('indesign'): si carica sotto
 * Node, e i test ne provano le parti pure.
 */

const VistaAffiancata = {

    /// La larghezza minima del pannello (manifest.json): quella con cui il Plugin resta a sinistra.
    LARGHEZZA_SINISTRA: 524,

    /// I20-1121: da qui in su si affianca. 924 px li ha misurati l'operatore: il Plugin a 524 e una
    /// colonna di circa 390 px. Prima (I20-1116) era il doppio della larghezza minima, 1048.
    SOGLIA: 924,

    /// Il margine del corpo della pagina: gli elementi fissi senza left partono da li'.
    MARGINE_CORPO: 8,

    /// Gli elementi fissi confinati a sinistra, con la larghezza di prima: { elemento, larghezza }.
    _confinati: null,

    /// Gli id delle colonne create, per sapere se ne resta aperta qualcuna.
    _colonne: [],

    /// La larghezza del pannello. Non quella di #wrapper, che nella vista affiancata resta ferma a
    /// sinistra. In UXP window.innerWidth e' undefined: vale quella del documento.
    larghezzaPannello() {
        try {
            const candidati = [
                typeof window !== "undefined" ? window.innerWidth : 0,
                typeof document !== "undefined" && document.documentElement != null ? document.documentElement.clientWidth : 0,
                typeof document !== "undefined" && document.body != null ? document.body.clientWidth : 0
            ];
            const trovata = candidati.find(l => l > 0);
            return trovata != null ? trovata : 0;
        }
        catch (e) {
            return 0;
        }
    },

    /// Popup (o finestra a tutto pannello) o colonna, dalla larghezza del pannello.
    forma(larghezzaPannello) {
        return larghezzaPannello >= VistaAffiancata.SOGLIA ? "colonna" : "popup";
    },

    /// Dove comincia la colonna: dopo il Plugin di sinistra e il margine del corpo.
    inizioColonna() {
        return VistaAffiancata.LARGHEZZA_SINISTRA + VistaAffiancata.MARGINE_CORPO;
    },

    /// Gli elementi fissi sempre a schermo e la larghezza che prendono nella vista affiancata.
    /// #footer ha 5px di riempimento per lato, che si aggiungono alla larghezza.
    confinamenti(larghezzaSinistra = VistaAffiancata.LARGHEZZA_SINISTRA) {
        return [
            { selettore: "#wrapper", larghezza: larghezzaSinistra },
            { selettore: "#header", larghezza: larghezzaSinistra },
            { selettore: "#footerRef", larghezza: larghezzaSinistra },
            { selettore: "#footer", larghezza: larghezzaSinistra - 10 },
            { selettore: "#messaggiUtente", larghezza: Math.round(larghezzaSinistra * 0.95) }
        ];
    },

    /// Confina a sinistra gli elementi fissi, o rimette la larghezza di prima. Si tocca solo la
    /// larghezza: il resto dello stile puo' cambiare intanto, e deve restare.
    _confina(confina) {
        if (confina) {
            if (VistaAffiancata._confinati != null) {
                return;
            }
            VistaAffiancata._confinati = [];
            VistaAffiancata.confinamenti().forEach(voce => {
                const elemento = document.querySelector(voce.selettore);
                if (elemento == null) {
                    return;
                }
                VistaAffiancata._confinati.push({ elemento: elemento, larghezza: elemento.style.width });
                elemento.style.width = voce.larghezza + "px";
            });
            return;
        }
        (VistaAffiancata._confinati || []).forEach(voce => { voce.elemento.style.width = voce.larghezza; });
        VistaAffiancata._confinati = null;
    },

    /// Se la colonna con quell'id e' aperta; senza id, se ce n'e' aperta una qualsiasi.
    colonnaAperta(id = null) {
        try {
            const ids = id != null ? [id] : VistaAffiancata._colonne;
            return ids.some(c => $("#" + c).length > 0);
        }
        catch (e) {
            return false;
        }
    },

    /// Se e' aperta una colonna diversa da quella con quell'id: una colonna alla volta.
    altraColonnaAperta(id) {
        return VistaAffiancata._colonne.some(c => c !== id && VistaAffiancata.colonnaAperta(c));
    },

    /// Il guscio di una colonna: fissa a destra, dall'inizio della colonna al bordo del pannello,
    /// con la testata (titolo, accanto al titolo, azioni, X) e il corpo. Sta sotto le finestre
    /// modali (popup 9000, conferme, caricamento), che possono coprirla finche' sono aperte, e
    /// sopra il resto del pannello. scorre: il corpo scorre da se'; false se lo fa il contenuto.
    /// Restituisce { colonna, testata, corpo } come elementi jQuery. Gli elementi fissi del
    /// pannello si confinano a sinistra.
    creaColonna(opzioni = {}) {
        const id = opzioni.id;
        const colonna = $('<div></div>').attr('id', id).css({
            position: 'fixed', top: '0px', bottom: '0px', right: '0px', left: VistaAffiancata.inizioColonna() + 'px',
            backgroundColor: 'white', borderLeft: '2px solid #333', boxSizing: 'border-box', zIndex: '900',
            display: 'flex', flexDirection: 'column'
        });
        const testata = $('<div></div>').css({
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: '0 0 auto',
            backgroundColor: '#f1f1f1', padding: '5px 8px', boxSizing: 'border-box'
        });
        const sinistra = $('<div></div>').css({ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', minWidth: '0' });
        //UXP non applica gap: lo spazio fra titolo e conteggio lo da' il margine.
        sinistra.append($('<span></span>').text(opzioni.titolo || "").css({ fontSize: '16px', fontWeight: 'bold', color: 'black', marginRight: '10px' }));
        if (opzioni.accantoAlTitolo != null) {
            sinistra.append(opzioni.accantoAlTitolo);
        }
        const destra = $('<div></div>').css({ display: 'flex', alignItems: 'center', flexShrink: '0' });
        (Array.isArray(opzioni.azioni) ? opzioni.azioni : []).forEach(azione => {
            destra.append($(azione).css({ marginRight: '8px' }));
        });
        const chiudi = $('<button type="button"></button>').html('&times;')
            .css({ backgroundColor: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' })
            .on('click', () => {
                if (typeof opzioni.alChiudi === "function") {
                    opzioni.alChiudi();
                }
            });
        destra.append(chiudi);
        testata.append(sinistra).append(destra);

        const corpo = $('<div></div>').css(opzioni.scorre === false
            ? { flex: '1 1 auto', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px', boxSizing: 'border-box' }
            : { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '8px', boxSizing: 'border-box' });
        colonna.append(testata).append(corpo);
        $("body").append(colonna);

        if (id != null && VistaAffiancata._colonne.indexOf(id) < 0) {
            VistaAffiancata._colonne.push(id);
        }
        VistaAffiancata._confina(true);
        return { colonna: colonna, testata: testata, corpo: corpo };
    },

    /// Toglie la colonna con quell'id. Il Plugin torna a tutta larghezza solo quando non resta
    /// nessuna colonna aperta. Restituisce true se c'era.
    togliColonna(id) {
        let cera = false;
        try {
            const colonna = $("#" + id);
            cera = colonna.length > 0;
            if (cera) {
                colonna.remove();
            }
        }
        catch (e) {
            cera = false;
        }
        if (!VistaAffiancata.colonnaAperta()) {
            VistaAffiancata._confina(false);
        }
        return cera;
    }
};

module.exports = VistaAffiancata;
