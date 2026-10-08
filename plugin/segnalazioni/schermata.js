/*
 * I20-1029, lotto 2: la schermata delle segnalazioni di impaginazione del documento.
 *
 * Un popup che legge i bollini del documento (Segnalazioni.leggiDocumento) e li mostra per pagina e
 * per box: la gravita' peggiore del box, ogni segnalazione con il suo codice e il suo testo,
 * "Vai al box", "Risolvi" per una segnalazione e "Risolvi tutte" per il box. Si apre dal pulsante
 * "Segnalazioni" in Menabo' -> Filtri e da sola a fine impaginazione, se il giro ne ha prodotte.
 *
 * Mostra tutte le segnalazioni del documento, non solo quelle dell'ultimo giro: quelle non
 * risolte dei giri prima restano nei bollini, e devono restare visibili.
 *
 * I20-1056, lotto 1: aperta a fine impaginazione mostra solo le pagine impaginate, e si apre solo
 * se li' ci sono bollini; rifare un box non la apre (impaginazioneSingoloIndd, apriSegnalazioni).
 * Dal pulsante mostra tutto il documento con il caricamento. Ne resta aperta una sola: una
 * richiesta nuova annulla quella in corso.
 *
 * Usa le globali di indexNew come gli altri moduli: $, Modali, Utility, app, docInLavorazione,
 * messaggioUtente, aggiornaBadgeSegnalazioniTracciato (lotto 3). Le funzioni che non toccano il
 * documento (perPagina, conta, coloreCss, testoRiepilogo, codiciAbbreviati) sono pure.
 */

const Segnalazioni = require('./segnalazioni');
const etichettaSegnalazioni = require('./etichetta');

//I colori della schermata, gli stessi del bollino: rosso gli errori, arancione i warning.
const COLORE_CSS = { error: "#c62828", warning: "#ef6c00", notifica: "#1565c0" };

const SchermataSegnalazioni = {

    ID_ELENCO: "elencoSegnalazioniImpaginazione",

    /// Il colore di una gravita' sulla schermata.
    coloreCss(gravita) {
        return COLORE_CSS[gravita] || COLORE_CSS.notifica;
    },

    /// Le letture di Segnalazioni.leggiDocumento raggruppate per pagina, nell'ordine in cui
    /// arrivano: [{ pagina, box: [lettura, ...] }, ...].
    perPagina(lette) {
        const pagine = [];
        (Array.isArray(lette) ? lette : []).forEach(lettura => {
            let pagina = pagine.find(p => p.pagina === lettura.pagina);
            if (pagina == null) {
                pagina = { pagina: lettura.pagina, box: [] };
                pagine.push(pagina);
            }
            pagina.box.push(lettura);
        });
        return pagine;
    },

    /// Lotto 3: il suggerimento del badge di pagina del tracciato, da una voce di
    /// Segnalazioni.riepilogoPerRecord: "2 segnalazioni di impaginazione (1 errore)". Vuoto se
    /// la referenza non ha segnalazioni.
    testoRiepilogo(riepilogo) {
        if (riepilogo == null || !(riepilogo.segnalazioni > 0)) {
            return "";
        }
        let testo = riepilogo.segnalazioni + (riepilogo.segnalazioni === 1 ? " segnalazione" : " segnalazioni") + " di impaginazione";
        if (riepilogo.errori > 0) {
            testo += " (" + riepilogo.errori + (riepilogo.errori === 1 ? " errore" : " errori") + ")";
        }
        return testo;
    },

    /// I20-1044: i codici di un gruppo da mostrare: i primi due e poi i puntini, "6771109,
    /// 5062150, …". Un gruppo puo' avere decine di articoli, e la riga diventava lunghissima.
    codiciAbbreviati(codiceGruppo, quanti = 2) {
        const codici = String(codiceGruppo == null ? "" : codiceGruppo).split(",").map(c => c.trim()).filter(c => c !== "");
        if (codici.length <= quanti) {
            return codici.join(", ");
        }
        return codici.slice(0, quanti).join(", ") + ", …";
    },

    /// Quanti box e quante segnalazioni.
    conta(lette) {
        const elenco = Array.isArray(lette) ? lette : [];
        return {
            box: elenco.length,
            segnalazioni: elenco.reduce((totale, lettura) => totale + (Array.isArray(lettura.voci) ? lettura.voci.length : 0), 0)
        };
    },

    /// Il documento su cui si lavora: quello della lavorazione, o quello attivo.
    _documento() {
        try {
            if (typeof docInLavorazione !== "undefined" && docInLavorazione != null) {
                return docInLavorazione;
            }
            return app.activeDocument;
        }
        catch (e) {
            return null;
        }
    },

    /// I20-1056: il turno dell'ultima richiesta di apertura. Una richiesta che, finita la lettura,
    /// non e' piu' l'ultima, non apre niente: con i click ripetuti si aprivano popup uno sopra
    /// l'altro (dieci, nella prova dell'operatore).
    _turno: 0,

    /// Apre il popup con le segnalazioni.
    /// opzioni.pagine: solo quelle pagine (nomi), altrimenti tutto il documento.
    /// opzioni.soloSeCiSono: se non c'e' nessun bollino non si apre niente.
    /// opzioni.aFineImpaginazione: il caricamento lo mostra gia' l'impaginazione, e chi chiama lo
    /// chiude subito dopo: la lettura si fa qui e ora, senza attese. Dal pulsante invece si mostra
    /// il caricamento e lo si lascia disegnare prima di leggere.
    /// Restituisce true se la schermata si e' aperta.
    async apri(opzioni = {}) {
        const turno = ++SchermataSegnalazioni._turno;
        const pagine = Array.isArray(opzioni.pagine) ? opzioni.pagine : null;
        const conCaricamento = !opzioni.aFineImpaginazione;

        if (conCaricamento) {
            SchermataSegnalazioni._caricamento(true);
        }
        try {
            if (conCaricamento) {
                //UXP non ridisegna mentre si legge il documento: si lascia comparire il caricamento.
                await new Promise(fatto => setTimeout(fatto, 100));
                if (turno !== SchermataSegnalazioni._turno) {
                    return false;
                }
            }

            const lette = SchermataSegnalazioni._leggi(pagine);
            if (turno !== SchermataSegnalazioni._turno) {
                return false;
            }
            if (opzioni.soloSeCiSono && lette.length === 0) {
                return false;
            }

            SchermataSegnalazioni.chiudiAperta();
            const elenco = $('<div></div>').attr('id', SchermataSegnalazioni.ID_ELENCO)
                .css({ width: '100%', color: 'black', fontSize: '12px' });
            elenco.data('pagine', pagine);
            SchermataSegnalazioni._disegna(elenco, lette, pagine);
            //Il popup aspetta finche' non lo si chiude: non si aspetta qui.
            Modali.popup("Segnalazioni di impaginazione", elenco, "xl", SchermataSegnalazioni.allaChiusura);
            return true;
        }
        finally {
            if (conCaricamento && turno === SchermataSegnalazioni._turno) {
                SchermataSegnalazioni._caricamento(false);
            }
        }
    },

    /// I20-1056: toglie la schermata gia' aperta, se c'e'. Chiamata prima di aprirne un'altra.
    chiudiAperta() {
        try {
            $("#" + SchermataSegnalazioni.ID_ELENCO).closest("#popup").remove();
        }
        catch (e) {
            //niente da chiudere
        }
    },

    _caricamento(mostra) {
        try {
            if (mostra && typeof showLoading === "function") {
                showLoading("Lettura delle segnalazioni...");
            }
            else if (!mostra && typeof hideLoading === "function") {
                hideLoading();
            }
        }
        catch (e) {
            //il caricamento non deve fermare la schermata
        }
    },

    /// Lotto 3: chiusa la schermata, i badge di pagina del tracciato si ricolorano: dopo un
    /// "Risolvi" il colore di prima non e' piu' vero. aggiornaBadgeSegnalazioniTracciato e' di
    /// indexNew; sotto Node non c'e', e non succede niente.
    allaChiusura() {
        if (typeof aggiornaBadgeSegnalazioniTracciato === "function") {
            aggiornaBadgeSegnalazioniTracciato();
        }
    },

    /// I20-1056: le pagine impaginate da un giro, dal risultato del server: i nomi in testo, una
    /// volta sola, dall'indice da cui il giro e' ripartito (PoP).
    pagineDelRisultato(risultato, daIndice = 0) {
        const nomi = [];
        const elencoRisultati = risultato != null && Array.isArray(risultato.result) ? risultato.result : [];
        for (let i = Math.max(0, daIndice || 0); i < elencoRisultati.length; i++) {
            const voce = elencoRisultati[i];
            if (voce == null || voce.pag == null || String(voce.pag) === "") {
                continue;
            }
            const nome = String(voce.pag);
            if (nomi.indexOf(nome) < 0) {
                nomi.push(nome);
            }
        }
        return nomi;
    },

    /// A fine impaginazione: la schermata si apre solo se le pagine impaginate hanno bollini - quelli
    /// nati ora e quelli rimasti dai giri prima - e mostra solo quelle pagine, dalla prima in ordine
    /// di pagina. Senza pagine non si apre. Il report del giro resta il parametro di prima: le sue
    /// segnalazioni sono gia' nei bollini.
    apriSeCiSono(reportImpaginazioneObj, pagine = null) {
        const nomi = Array.isArray(pagine) ? pagine.filter(nome => nome != null && String(nome) !== "") : [];
        if (nomi.length === 0) {
            return Promise.resolve(false);
        }
        return SchermataSegnalazioni.apri({ pagine: nomi, soloSeCiSono: true, aFineImpaginazione: true });
    },

    /// Le letture dei bollini: delle sole pagine indicate, o di tutto il documento.
    _leggi(pagine) {
        try {
            const documento = SchermataSegnalazioni._documento();
            return Array.isArray(pagine) ? Segnalazioni.leggiPagine(documento, pagine) : Segnalazioni.leggiDocumento(documento);
        }
        catch (e) {
            console.error("Code SGN-01 Segnalazioni non lette dal documento:", e);
            return [];
        }
    },

    /// Riempie l'elenco rileggendo il documento, o le sole pagine con cui la schermata si e'
    /// aperta. Dopo ogni "Risolvi" si rifa' da capo: gli indici delle segnalazioni e i box (che il
    /// bollino ridisegnato regruppa) cambiano.
    riempi(elenco) {
        const pagine = elenco.data('pagine');
        SchermataSegnalazioni._disegna(elenco, SchermataSegnalazioni._leggi(Array.isArray(pagine) ? pagine : null), pagine);
    },

    _disegna(elenco, lette, pagine) {
        elenco.empty();

        const perPagina = SchermataSegnalazioni.perPagina(lette);
        if (perPagina.length === 0) {
            elenco.append($('<div></div>').text(Array.isArray(pagine) ? "Nessuna segnalazione nelle pagine impaginate." : "Nessuna segnalazione nel documento.").css({ padding: '8px' }));
            return;
        }

        const totali = SchermataSegnalazioni.conta(lette);
        elenco.append($('<div></div>')
            .text(totali.segnalazioni + (totali.segnalazioni === 1 ? " segnalazione" : " segnalazioni") + " in " + totali.box + " box")
            .css({ fontWeight: 'bold', marginBottom: '6px' }));

        perPagina.forEach(pagina => {
            elenco.append($('<div></div>').text("Pagina " + pagina.pagina)
                .css({ fontWeight: 'bold', fontSize: '13px', marginTop: '10px', borderBottom: '1px solid #999' }));
            pagina.box.forEach(lettura => elenco.append(SchermataSegnalazioni._bloccoBox(lettura, elenco)));
        });
    },

    _pallino(gravita) {
        return $('<span></span>').css({
            display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', flexShrink: '0',
            backgroundColor: SchermataSegnalazioni.coloreCss(gravita)
        });
    },

    /// Il nome del box sulla schermata: la meccanica e il codice gruppo, se il DNA si legge.
    /// I20-1044: breve con i soli primi codici del gruppo, completo per il suggerimento.
    _nomeBox(box) {
        let breve = "Box";
        let completo = "Box";
        try {
            breve = completo = "Box " + (box.label || "");
            const dna = Utility.getDnaOfBox(box);
            if (dna != null && dna.codice_gruppo) {
                breve += " · gruppo " + SchermataSegnalazioni.codiciAbbreviati(dna.codice_gruppo);
                completo += " · gruppo " + SchermataSegnalazioni.codiciAbbreviati(dna.codice_gruppo, Infinity);
            }
        }
        catch (e) {
            //resta il nome che c'e'
        }
        return { breve: breve, completo: completo };
    },

    //I20-1044: un testo dentro una riga flex che si restringe col pannello. Senza minWidth 0 non
    //scende sotto la sua parola piu' lunga - i codici del gruppo uniti dalle virgole, le etichette
    //come foto_extra$logo_attributo_it$tipo_3 - e restringendo il pannello la riga restava larga,
    //con i pulsanti fuori dal bordo destro. Le parole troppo lunghe vanno a capo.
    _testoCheSiRestringe(elemento) {
        return elemento.css({ flex: '1 1 0', minWidth: '0', overflowWrap: 'anywhere', wordBreak: 'break-word' });
    },

    _bloccoBox(lettura, elenco) {
        const blocco = $('<div></div>').css({ margin: '4px 0 8px 0', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' });

        //I20-1044: se non c'e' spazio, i pulsanti vanno a capo sotto il nome invece di uscire a destra.
        const testata = $('<div></div>').css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' });
        testata.append(SchermataSegnalazioni._pallino(etichettaSegnalazioni.gravitaPeggiore(lettura.voci)));
        const nomeBox = SchermataSegnalazioni._nomeBox(lettura.box);
        testata.append(SchermataSegnalazioni._testoCheSiRestringe($('<span></span>').text(nomeBox.breve).attr('title', nomeBox.completo))
            .css({ fontWeight: 'bold', flexBasis: '120px' }));

        const vai = $('<button type="button"></button>').text("Vai al box").css({ flexShrink: '0' })
            .on('click', () => SchermataSegnalazioni.vaiAlBox(lettura.box));

        //"Risolvi tutte" chiede conferma dentro il popup: la conferma di Modali starebbe sotto.
        const azioniTutte = $('<span></span>').css({ flexShrink: '0' });
        const tutte = $('<button type="button"></button>').text("Risolvi tutte")
            .on('click', () => {
                azioniTutte.empty();
                azioniTutte.append($('<span></span>').text("Sicuro? ").css({ fontWeight: 'bold' }));
                azioniTutte.append($('<button type="button"></button>').text("Sì").on('click', () => {
                    Segnalazioni.risolviTutte(lettura.box);
                    SchermataSegnalazioni.riempi(elenco);
                }));
                azioniTutte.append($('<button type="button"></button>').text("No").on('click', () => {
                    SchermataSegnalazioni.riempi(elenco);
                }));
            });
        azioniTutte.append(tutte);

        testata.append(vai);
        testata.append(azioniTutte);
        blocco.append(testata);

        lettura.voci.forEach((voce, indice) => {
            const riga = $('<div></div>').css({ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px', paddingLeft: '16px' });
            riga.append(SchermataSegnalazioni._pallino(voce.g).css({ marginTop: '3px' }));
            const testo = SchermataSegnalazioni._testoCheSiRestringe($('<span></span>'));
            if (voce.c) {
                testo.append($('<b></b>').text(voce.c + " "));
            }
            testo.append($('<span></span>').text(voce.t || ""));
            //Lotto 4: un bollino di prima del I20-1029 mostrava solo il codice o una frase breve, e
            //il messaggio intero non c'e'. Lo si dice, perche' il testo corto non sembri un errore.
            if (voce.vecchio) {
                testo.append($('<span></span>').text(" (bollino vecchio)").css({ color: '#777', fontStyle: 'italic' }));
            }
            riga.append(testo);
            riga.append($('<button type="button"></button>').text("Risolvi").css({ flexShrink: '0' }).on('click', () => {
                Segnalazioni.risolviVoce(lettura.box, indice);
                SchermataSegnalazioni.riempi(elenco);
            }));
            blocco.append(riga);
        });

        return blocco;
    },

    /// Porta alla pagina del box e lo seleziona, come fa il Report Integrita'.
    vaiAlBox(box) {
        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
        }
        catch (e) {
            console.error("Code SGN-02 Box non raggiungibile:", e);
            messaggioUtente("Code SGN-02 Il box non si raggiunge: potrebbe essere stato tolto o spostato. Riapri le segnalazioni.", "warning", false, 5);
        }
    }
};

module.exports = SchermataSegnalazioni;
