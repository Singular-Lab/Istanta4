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
 * documento (perPagina, conta, coloreCss, testoRiepilogo, codiciAbbreviati, statoSegnalino) sono pure.
 *
 * I20-1116: oltre all'icona del menabo', il segnalino a segnalibro nella testata, in fondo alla riga
 * delle linguette e attaccato al bordo destro del pannello: stessi numeri e stesso colore,
 * aggiornato insieme all'icona, visibile da ogni sezione
 * del Plugin. Cliccandolo si apre la schermata di tutto il documento, come dal pulsante.
 *
 * I20-1116, lotto 2: la vista affiancata. Con il pannello largo almeno la soglia la schermata non
 * e' un popup ma una colonna fissa a destra, non modale: a sinistra il Plugin resta com'e', alla
 * larghezza minima, e si usa insieme alla colonna. Gli elementi fissi del Plugin che restano sempre
 * a schermo (testata, barre in fondo, messaggi) si confinano a sinistra; le finestre modali restano
 * a tutto pannello. adattaVista, chiamata da onresizeWindow, passa da popup a colonna e ritorno
 * quando il pannello cambia larghezza.
 *
 * I20-1121: soglia, misure, confinamento e guscio della colonna sono in vistaAffiancata.js, comuni
 * con il Report Integrita'; la soglia e' scesa a 924 px. Una colonna alla volta: con quella del
 * report aperta le segnalazioni si aprono come popup.
 *
 * I20-1126: le segnalazioni si possono disattivare per la lavorazione, dalla schermata ("Disattiva",
 * "Risolvi tutto e disattiva", "Annulla"), e riattivare da li'. Disattivate, l'impaginazione non
 * scrive bollini (finalizzaSegnalazioni di indexNew), la schermata non si apre da sola e il Report
 * Integrita' non avvisa; il segnalino e' grigio. La scelta sta nella voce della lavorazione, in
 * lavorazioni.json (Utility.voceLavorazione). Senza segnalazioni il segnalino e' verde.
 */

const Segnalazioni = require('./segnalazioni');
const etichettaSegnalazioni = require('./etichetta');
//I20-1056, lotto 2: le stesse regole del Report Integrita' per il dizionario del cliente e per la
//descrizione della referenza. Sono moduli puri: si caricano anche sotto Node.
const reportIntegritaAvvio = require('../reportIntegrita/avvio');
const reportConfrontoCsv = require('../reportIntegrita/csv');
//I20-1121: le regole della vista affiancata, comuni con il Report Integrita'.
const VistaAffiancata = require('../vistaAffiancata');
//I20-1123: riaprendo il popup dopo la scheda, il campo in cui si scriveva torna a riposo.
const CampiARiposo = require('../campiARiposo');

//I colori della schermata, gli stessi del bollino: rosso gli errori, arancione i warning.
const COLORE_CSS = { error: "#c62828", warning: "#ef6c00", notifica: "#1565c0" };

//I20-1126: il segnalino senza segnalazioni e con le segnalazioni disattivate.
const COLORE_NESSUNA = "#2e7d32";
const COLORE_DISATTIVATE = "#9e9e9e";

const SchermataSegnalazioni = {

    ID_ELENCO: "elencoSegnalazioniImpaginazione",

    /// I20-1056, lotto 2: oltre quanti caratteri la descrizione si abbrevia. Circa due righe nel
    /// pannello: UXP non sa tagliare per righe, e il testo appena disegnato non si misura bene.
    LUNGHEZZA_DESCRIZIONE: 120,

    /// I20-1056, lotto 2: ogni quanto, con la scheda aperta dalla schermata, si riafferma il blocco
    /// e si controlla se il box e' stato rifatto. Lo stesso del Report Integrita'.
    INTERVALLO_VIGILANZA_SCHEDA: 600,

    /// La scheda aperta da "Vai al box", finche' la si chiude: { box, elenco, popup, record, idRec, timer }.
    _schedaAperta: null,

    /// I20-1056, lotto 3: l'icona del pulsante Segnalazioni del menabo'.
    ID_ICONA: "iconaSegnalazioniImpaginazione",

    /// I20-1116: il segnalino della testata, in fondo alla riga delle linguette, e il suo testo.
    ID_SEGNALINO: "segnalinoSegnalazioni",
    ID_TESTO_SEGNALINO: "testoSegnalinoSegnalazioni",

    /// I20-1126: il campo della voce della lavorazione (lavorazioni.json) che dice se le segnalazioni
    /// sono disattivate.
    CAMPO_DISATTIVATE: "segnalazioniDisattivate",

    /// I20-1126: l'ultima lettura del campo, per documento: finalizzaSegnalazioni lo chiede a ogni box,
    /// e il file delle lavorazioni non si rilegge ogni volta. { documento, valore }.
    _disattivateInMemoria: null,

    /// I20-1116, lotto 2: la colonna della vista affiancata (regole in vistaAffiancata.js, I20-1121).
    ID_COLONNA: "colonnaSegnalazioni",
    TITOLO: "Segnalazioni di impaginazione",

    /// I20-1056, lotto 3: l'ultimo controllo dei bollini del documento, pagina per pagina:
    /// { chiave, pagine: { nome: { segnalazioni, errori, gravita } } }. Solo i numeri: i dati della
    /// schermata si rileggono sempre.
    _ultimoControllo: null,

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
    /// opzioni.lette (I20-1056, lotto 5): una lettura appena fatta da chi chiama, con le stesse
    /// pagine; la schermata la usa invece di rileggere, e non serve il caricamento. La usa il
    /// Report Integrita', che ha appena controllato il documento per decidere se avvisare.
    /// Restituisce true se la schermata si e' aperta.
    async apri(opzioni = {}) {
        const turno = ++SchermataSegnalazioni._turno;
        const pagine = Array.isArray(opzioni.pagine) ? opzioni.pagine : null;
        const giaLette = Array.isArray(opzioni.lette) ? opzioni.lette : null;
        const conCaricamento = !opzioni.aFineImpaginazione && giaLette == null;

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

            const lette = giaLette != null ? giaLette : SchermataSegnalazioni._leggi(pagine);
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
            //I20-1056, lotto 2: il conteggio sta accanto al titolo, cosi' non scorre via.
            const conteggio = $('<span></span>').css({ fontSize: '12px', fontWeight: 'normal', color: '#555' });
            elenco.data('conteggio', conteggio);
            SchermataSegnalazioni._disegna(elenco, lette, pagine);
            //I20-1116, lotto 2: a pannello largo una colonna a destra invece del popup.
            if (SchermataSegnalazioni.formaSchermata() === "colonna") {
                SchermataSegnalazioni._apriColonna(elenco);
                return true;
            }
            //Il popup aspetta finche' non lo si chiude: non si aspetta qui.
            Modali.popup(SchermataSegnalazioni.TITOLO, elenco, "xl", SchermataSegnalazioni.allaChiusura, null, conteggio);
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
        //I20-1116, lotto 2: o la colonna della vista affiancata.
        SchermataSegnalazioni.chiudiColonna(false);
    },

    /// I20-1116, lotto 2: popup o colonna. I20-1121: la soglia e' quella di vistaAffiancata.js, e con
    /// un'altra colonna aperta (il Report Integrita') le segnalazioni restano popup: una colonna alla volta.
    formaSchermata() {
        if (VistaAffiancata.altraColonnaAperta(SchermataSegnalazioni.ID_COLONNA)) {
            return "popup";
        }
        return VistaAffiancata.forma(VistaAffiancata.larghezzaPannello());
    },

    /// I20-1116, lotto 2: la schermata come colonna fissa a destra, non modale: titolo, conteggio,
    /// X e l'elenco che scorre. Sta sotto le finestre modali (popup 9000, conferme), che possono
    /// coprirla finche' sono aperte, e sopra il resto del pannello.
    _apriColonna(elenco) {
        //I20-1121: il guscio della colonna e il confinamento a sinistra sono in vistaAffiancata.js.
        const guscio = VistaAffiancata.creaColonna({
            id: SchermataSegnalazioni.ID_COLONNA,
            titolo: SchermataSegnalazioni.TITOLO,
            accantoAlTitolo: elenco.data('conteggio'),
            alChiudi: () => SchermataSegnalazioni.chiudiColonna(true)
        });
        guscio.corpo.append(elenco);
        SchermataSegnalazioni.allineaSegnalino();
    },

    /// I20-1116, lotto 2: chiude la colonna e rimette il Plugin a tutta larghezza. conAvviso: come
    /// la X del popup, i badge del tracciato si ricolorano.
    chiudiColonna(conAvviso = true) {
        const colonna = $("#" + SchermataSegnalazioni.ID_COLONNA);
        if (!(colonna.length > 0)) {
            return false;
        }
        //I20-1121: il Plugin torna a tutta larghezza solo se non resta un'altra colonna aperta.
        VistaAffiancata.togliColonna(SchermataSegnalazioni.ID_COLONNA);
        SchermataSegnalazioni.allineaSegnalino();
        if (conAvviso) {
            SchermataSegnalazioni.allaChiusura();
        }
        return true;
    },

    /// I20-1116, lotto 2: il pannello ha cambiato larghezza (onresizeWindow). Sotto la soglia la
    /// colonna torna popup; sopra, il popup aperto diventa colonna. L'elenco si sposta com'e', con
    /// le sue pagine e il suo conteggio. Con la scheda aperta da "Vai al box" in vista controllata
    /// il popup e' staccato dalla pagina, e non si tocca: si riattacca alla chiusura della scheda.
    adattaVista() {
        //Il segnalino segue il bordo del pannello, anche quando la forma non cambia.
        SchermataSegnalazioni.allineaSegnalino();
        try {
            const forma = SchermataSegnalazioni.formaSchermata();
            const colonna = $("#" + SchermataSegnalazioni.ID_COLONNA);
            if (colonna.length > 0) {
                if (forma === "colonna") {
                    return;
                }
                const elenco = colonna.find("#" + SchermataSegnalazioni.ID_ELENCO).detach();
                SchermataSegnalazioni.chiudiColonna(false);
                Modali.popup(SchermataSegnalazioni.TITOLO, elenco, "xl", SchermataSegnalazioni.allaChiusura, null, elenco.data('conteggio'));
                return;
            }
            if (forma !== "colonna" || SchermataSegnalazioni._schedaAperta != null) {
                return;
            }
            const elenco = $("#" + SchermataSegnalazioni.ID_ELENCO);
            const popup = elenco.closest("#popup");
            if (elenco.length === 0 || popup.length === 0) {
                return;
            }
            elenco.detach();
            popup.remove();
            SchermataSegnalazioni._apriColonna(elenco);
        }
        catch (e) {
            console.error("Code SGN-06 Vista delle segnalazioni non adattata al pannello:", e);
        }
    },

    /// I20-1116, lotto 2: la colonna si rilegge quando il documento e' stato ricontrollato da fuori
    /// (una risoluzione dalla scheda ref, un Reimpagina, un documento appena aperto).
    _rileggiColonna() {
        const elenco = $("#" + SchermataSegnalazioni.ID_COLONNA).find("#" + SchermataSegnalazioni.ID_ELENCO);
        if (elenco.length > 0) {
            SchermataSegnalazioni.riempi(elenco);
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
        //I20-1126: con le segnalazioni disattivate la schermata non si apre da sola.
        if (SchermataSegnalazioni.disattivate()) {
            return Promise.resolve(false);
        }
        const nomi = Array.isArray(pagine) ? pagine.filter(nome => nome != null && String(nome) !== "") : [];
        if (nomi.length === 0) {
            return Promise.resolve(false);
        }
        return SchermataSegnalazioni.apri({ pagine: nomi, soloSeCiSono: true, aFineImpaginazione: true });
    },

    /// Le letture dei bollini: delle sole pagine indicate, o di tutto il documento.
    /// I20-1056, lotto 3: ogni lettura e' un controllo, e aggiorna l'icona del menabo'.
    _leggi(pagine) {
        const lette = SchermataSegnalazioni.letturaControllata(pagine);
        return lette != null ? lette : [];
    },

    /// I20-1056, lotto 5: come _leggi, ma se la lettura non riesce torna null invece di una lista
    /// vuota. Il Report Integrita' deve poter distinguere "nessuna segnalazione" da "non ho letto":
    /// nel secondo caso non puo' dire all'operatore che il documento e' pulito.
    letturaControllata(pagine) {
        try {
            const documento = SchermataSegnalazioni._documento();
            const lette = Array.isArray(pagine) ? Segnalazioni.leggiPagine(documento, pagine) : Segnalazioni.leggiDocumento(documento);
            SchermataSegnalazioni.registraControllo(Segnalazioni._chiaveDocumento(documento), lette, pagine);
            SchermataSegnalazioni.aggiornaIcona();
            return lette;
        }
        catch (e) {
            console.error("Code SGN-01 Segnalazioni non lette dal documento:", e);
            return null;
        }
    },

    /// I20-1056, lotto 3: un controllo senza schermata, per la sola icona: le pagine indicate
    /// (dopo un Reimpagina, quella del box) o tutto il documento (alla sua apertura).
    controllaPagine(pagine) {
        if (!Array.isArray(pagine) || pagine.length === 0) {
            return;
        }
        SchermataSegnalazioni._leggi(pagine);
        SchermataSegnalazioni._rileggiColonna();
    },

    controllaDocumento() {
        SchermataSegnalazioni._leggi(null);
        SchermataSegnalazioni._rileggiColonna();
    },

    /// I20-1056, lotto 3: registra una lettura nell'ultimo controllo. Una lettura di tutto il
    /// documento (pagine null) sostituisce tutto; una di alcune pagine aggiorna solo quelle, anche a
    /// zero se li' non c'e' piu' niente. Un altro documento riparte da capo.
    registraControllo(chiaveDocumento, lette, pagine = null) {
        let controllo = SchermataSegnalazioni._ultimoControllo;
        if (controllo == null || controllo.chiave !== chiaveDocumento || !Array.isArray(pagine)) {
            controllo = { chiave: chiaveDocumento, pagine: {} };
        }
        if (Array.isArray(pagine)) {
            pagine.forEach(nome => { controllo.pagine[String(nome)] = { segnalazioni: 0, errori: 0, gravita: null }; });
        }
        (Array.isArray(lette) ? lette : []).forEach(lettura => {
            const nome = String(lettura.pagina);
            const pagina = controllo.pagine[nome] || (controllo.pagine[nome] = { segnalazioni: 0, errori: 0, gravita: null });
            const voci = Array.isArray(lettura.voci) ? lettura.voci : [];
            pagina.segnalazioni += voci.length;
            pagina.errori += voci.filter(voce => etichettaSegnalazioni.gravita(voce.g) === "error").length;
            pagina.gravita = etichettaSegnalazioni.gravitaPeggiore((pagina.gravita != null ? [{ g: pagina.gravita }] : []).concat(voci));
        });
        SchermataSegnalazioni._ultimoControllo = controllo;
        return controllo;
    },

    /// I20-1056, lotto 3: quante segnalazioni irrisolte all'ultimo controllo del documento, quanti
    /// errori e la gravita' peggiore. Zero se il controllo e' di un altro documento.
    riepilogoControllo(chiaveDocumento) {
        //I20-1126: controllato dice se i numeri vengono da un controllo di questo documento: senza,
        //lo zero non vuol dire "nessuna segnalazione", e il segnalino verde mentirebbe.
        const riepilogo = { segnalazioni: 0, errori: 0, gravita: null, controllato: false };
        const controllo = SchermataSegnalazioni._ultimoControllo;
        if (controllo == null || chiaveDocumento == null || controllo.chiave !== chiaveDocumento) {
            return riepilogo;
        }
        riepilogo.controllato = true;
        Object.keys(controllo.pagine).forEach(nome => {
            const pagina = controllo.pagine[nome];
            riepilogo.segnalazioni += pagina.segnalazioni;
            riepilogo.errori += pagina.errori;
            if (pagina.gravita != null) {
                riepilogo.gravita = etichettaSegnalazioni.gravitaPeggiore([{ g: pagina.gravita }].concat(riepilogo.gravita != null ? [{ g: riepilogo.gravita }] : []));
            }
        });
        return riepilogo;
    },

    /// Il suggerimento dell'icona: "3 segnalazioni irrisolte (1 errore) all'ultimo controllo".
    testoIcona(riepilogo) {
        if (riepilogo == null || !(riepilogo.segnalazioni > 0)) {
            return "";
        }
        let testo = riepilogo.segnalazioni + (riepilogo.segnalazioni === 1 ? " segnalazione irrisolta" : " segnalazioni irrisolte");
        if (riepilogo.errori > 0) {
            testo += " (" + riepilogo.errori + (riepilogo.errori === 1 ? " errore" : " errori") + ")";
        }
        return testo + " all'ultimo controllo";
    },

    /// I20-1116: come mostrare il segnalino della testata dal riepilogo dell'ultimo controllo:
    /// { visibile, testo, colore, suggerimento }. I20-1126: senza un controllo del documento (nessun
    /// documento, o un altro) non si vede; con le segnalazioni disattivate e' grigio; senza
    /// segnalazioni e' verde, "Nessuna segnalazione". Al clic apre comunque la schermata.
    statoSegnalino(riepilogo, disattivate = false) {
        if (riepilogo == null || riepilogo.controllato === false) {
            return { visibile: false, testo: "", colore: null, suggerimento: "" };
        }
        if (disattivate === true) {
            return {
                visibile: true,
                testo: "Segnalazioni disattivate",
                colore: COLORE_DISATTIVATE,
                suggerimento: "Segnalazioni disattivate per questa lavorazione: clicca per aprire la schermata e riattivarle"
            };
        }
        if (!(riepilogo.segnalazioni > 0)) {
            return {
                visibile: true,
                testo: "Nessuna segnalazione",
                colore: COLORE_NESSUNA,
                suggerimento: "Nessuna segnalazione all'ultimo controllo: clicca per aprire le segnalazioni"
            };
        }
        return {
            visibile: true,
            testo: riepilogo.segnalazioni + (riepilogo.segnalazioni === 1 ? " segnalazione" : " segnalazioni"),
            colore: SchermataSegnalazioni.coloreCss(riepilogo.gravita),
            suggerimento: SchermataSegnalazioni.testoIcona(riepilogo) + ": clicca per aprire le segnalazioni"
        };
    },

    /// L'icona numerata del pulsante Segnalazioni: rossa con almeno un errore, arancione con soli
    /// warning, nascosta senza segnalazioni. I20-1116: insieme a lei il segnalino della testata.
    /// Un documento diverso da quello controllato (o nessun documento) li nasconde entrambi.
    aggiornaIcona() {
        try {
            const riepilogo = SchermataSegnalazioni.riepilogoControllo(Segnalazioni._chiaveDocumento(SchermataSegnalazioni._documento()));
            SchermataSegnalazioni._aggiornaSegnalino(riepilogo);
            const icona = $("#" + SchermataSegnalazioni.ID_ICONA);
            if (icona.length === 0) {
                return;
            }
            if (riepilogo.segnalazioni === 0) {
                icona.text("").attr('title', "").css({ display: 'none' });
                return;
            }
            icona.text(String(riepilogo.segnalazioni))
                .attr('title', SchermataSegnalazioni.testoIcona(riepilogo))
                .css({ display: 'inline-block', backgroundColor: SchermataSegnalazioni.coloreCss(riepilogo.gravita) });
        }
        catch (e) {
            //l'icona non deve fermare niente
        }
    },

    /// I20-1116: il segnalino a segnalibro, una linguetta col testo colorata con la gravita'.
    _aggiornaSegnalino(riepilogo) {
        const segnalino = $("#" + SchermataSegnalazioni.ID_SEGNALINO);
        if (segnalino.length === 0) {
            return;
        }
        const stato = SchermataSegnalazioni.statoSegnalino(riepilogo, SchermataSegnalazioni.disattivate());
        if (!stato.visibile) {
            segnalino.attr('title', "").css({ display: 'none' });
            return;
        }
        $("#" + SchermataSegnalazioni.ID_TESTO_SEGNALINO).text(stato.testo).css({ backgroundColor: stato.colore });
        segnalino.attr('title', stato.suggerimento).css({ display: 'flex' });
        SchermataSegnalazioni.allineaSegnalino();
    },

    /// I20-1116: il segnalino esce dal bordo destro del pannello, come un segnalibro che lo avvolge.
    /// E' fisso con right 0 (index.html): al bordo lo aggancia il motore grafico, senza misure, perche'
    /// le misure orizzontali del layout in UXP non tornavano e il testo veniva tagliato. Qui si fissa
    /// solo l'altezza, quella della riga delle linguette, e nella vista affiancata il lato sinistro, cosi'
    /// che finisca contro la colonna. Senza misure resta agganciato al bordo del pannello.
    allineaSegnalino() {
        try {
            const appoggio = document.getElementById("appoggioSegnalino");
            const segnalino = document.getElementById(SchermataSegnalazioni.ID_SEGNALINO);
            if (appoggio == null || segnalino == null) {
                return;
            }
            const riga = appoggio.getBoundingClientRect();
            if (riga != null && riga.height > 0) {
                segnalino.style.top = Math.round(riga.top) + "px";
            }
            const larghezza = segnalino.offsetWidth || 0;
            //I20-1121: contro qualunque colonna aperta, delle segnalazioni o del Report Integrita'.
            if (VistaAffiancata.colonnaAperta() && larghezza > 0) {
                segnalino.style.right = "auto";
                segnalino.style.left = Math.round(VistaAffiancata.inizioColonna() - larghezza) + "px";
            }
            else {
                segnalino.style.left = "auto";
                segnalino.style.right = "0px";
            }
        }
        catch (e) {
            //resta dov'e'
        }
    },

    /// I20-1116: il clic sul segnalino apre la schermata di tutto il documento, come il pulsante
    /// del menabo'. Con una scheda in vista controllata (dal Report Integrita' o da qui) non fa
    /// niente: si esce da quella con la sua X, e un popup sopra la lascerebbe a meta'.
    apriDalSegnalino() {
        try {
            if (typeof indesignEvents !== "undefined" && indesignEvents != null
                && typeof indesignEvents.vistaControllataAperta === "function" && indesignEvents.vistaControllataAperta()) {
                return Promise.resolve(false);
            }
        }
        catch (e) {
            //senza eventi non c'e' vista controllata
        }
        return SchermataSegnalazioni.apri();
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

        //I20-1126: in cima, disattivare o riattivare le segnalazioni della lavorazione.
        elenco.append(SchermataSegnalazioni._barraDisattivazione(elenco));

        //I20-1056, lotto 2: il conteggio e' accanto al titolo del popup, e si aggiorna a ogni giro.
        //I20-1126: con le segnalazioni disattivate la schermata e' "pulita": solo la barra con
        //"Riattiva", niente conteggio e niente elenco. I bollini nel documento restano dove sono.
        const disattivate = SchermataSegnalazioni.disattivate();
        const conteggio = elenco.data('conteggio');
        if (conteggio != null) {
            conteggio.text(disattivate ? "" : SchermataSegnalazioni.testoConteggio(lette));
        }
        if (disattivate) {
            return;
        }

        const perPagina = SchermataSegnalazioni.perPagina(lette);
        if (perPagina.length === 0) {
            elenco.append($('<div></div>').text(Array.isArray(pagine) ? "Nessuna segnalazione nelle pagine impaginate." : "Nessuna segnalazione nel documento.").css({ padding: '8px' }));
            return;
        }

        const contesto = {
            traduzioni: SchermataSegnalazioni._traduzioni(),
            records: SchermataSegnalazioni._recordsDellaLavorazione()
        };

        perPagina.forEach((pagina, indice) => {
            //I20-1056, lotto 2: la testata di pagina come quella del Report Integrita', perche' si
            //veda dove finisce una pagina e comincia l'altra.
            elenco.append($('<div></div>').text("Pagina " + pagina.pagina).attr('data-pagina', String(pagina.pagina))
                .css({
                    fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.4px',
                    padding: '6px 8px', marginTop: indice === 0 ? '0' : '14px', marginBottom: '4px',
                    borderBottom: '2px solid #8ab661', backgroundColor: '#eef7e3'
                }));
            pagina.box.forEach(lettura => elenco.append(SchermataSegnalazioni._bloccoBox(lettura, elenco, contesto)));
        });
    },

    /// I20-1126: la barra in cima all'elenco: "Disattiva segnalazioni", o "Riattiva segnalazioni" se
    /// sono disattivate.
    _barraDisattivazione(elenco) {
        const barra = $('<div></div>').css({ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '4px 8px', marginBottom: '6px' });
        if (SchermataSegnalazioni.disattivate()) {
            barra.append($('<span></span>').text("Segnalazioni disattivate per questa lavorazione").css({ color: '#555', marginRight: '8px' }));
            barra.append($('<button type="button"></button>').text("Riattiva segnalazioni").on('click', () => {
                if (SchermataSegnalazioni.impostaDisattivate(false)) {
                    SchermataSegnalazioni.riempi(elenco);
                }
            }));
        }
        else {
            barra.append($('<button type="button"></button>').text("Disattiva segnalazioni").on('click', () => {
                SchermataSegnalazioni.chiediDisattivazione(elenco);
            }));
        }
        return barra;
    },

    /// I20-1126: le tre scelte: "Disattiva", "Risolvi tutto e disattiva" (prima toglie tutti i bollini
    /// del documento), "Annulla". La domanda sta sopra la schermata (Modali.LIVELLO_CONFERMA).
    /// Restituisce la scelta: "disattiva", "risolvi" o null.
    async chiediDisattivazione(elenco = null) {
        const risposta = await Modali.confirmCustom(
            "Disattivare le segnalazioni per questa lavorazione? Durante l'impaginazione non si scriveranno bollini nei box e questa finestra non si aprirà da sola. Si riattivano da qui.",
            "Disattiva", "disattiva", "Risolvi tutto e disattiva", "risolvi");
        if (risposta == null || !risposta.result) {
            return null;
        }
        if (risposta.hiddenVal === "risolvi") {
            SchermataSegnalazioni.risolviTuttoIlDocumento();
        }
        if (!SchermataSegnalazioni.impostaDisattivate(true)) {
            return null;
        }
        if (elenco != null) {
            SchermataSegnalazioni.riempi(elenco);
        }
        SchermataSegnalazioni.allaChiusura();
        return risposta.hiddenVal;
    },

    /// I20-1126: "Risolvi tutto": ogni box del documento resta senza bollino. Restituisce quanti box.
    risolviTuttoIlDocumento() {
        let risolti = 0;
        try {
            const lette = Segnalazioni.leggiDocumento(SchermataSegnalazioni._documento());
            (Array.isArray(lette) ? lette : []).forEach(lettura => {
                try {
                    Segnalazioni.risolviTutte(lettura.box);
                    risolti++;
                }
                catch (e) {
                    console.error("Code SGN-09 Bollino non tolto:", e);
                }
            });
        }
        catch (e) {
            console.error("Code SGN-10 Segnalazioni del documento non risolte:", e);
        }
        return risolti;
    },

    /// I20-1126: la voce della lavorazione del documento aperto, su questa macchina; null senza
    /// lavorazione. Usa le globali di indexNew (pathLavorazione, idMacchina,
    /// libroDelDocumentoInLavorazione).
    _voceDellaLavorazione() {
        try {
            const documento = SchermataSegnalazioni._documento();
            if (documento == null || typeof pathLavorazione === "undefined" || !pathLavorazione) {
                return null;
            }
            const nome = documento.name;
            const libro = typeof libroDelDocumentoInLavorazione === "function" ? libroDelDocumentoInLavorazione(nome) : null;
            return Utility.voceLavorazione(pathLavorazione, idMacchina(), nome, libro);
        }
        catch (e) {
            console.error("Code SGN-11 Voce della lavorazione non letta:", e);
            return null;
        }
    },

    /// I20-1126: se la voce dice che le segnalazioni sono disattivate.
    disattivateNellaVoce(voce) {
        return voce != null && voce[SchermataSegnalazioni.CAMPO_DISATTIVATE] === true;
    },

    /// I20-1126: se le segnalazioni sono disattivate per la lavorazione del documento aperto. La
    /// lettura si tiene per documento: la chiede ogni box impaginato.
    disattivate() {
        try {
            const documento = SchermataSegnalazioni._documento();
            const chiave = documento != null ? documento.name : null;
            if (chiave == null) {
                return false;
            }
            const inMemoria = SchermataSegnalazioni._disattivateInMemoria;
            if (inMemoria != null && inMemoria.documento === chiave) {
                return inMemoria.valore;
            }
            const valore = SchermataSegnalazioni.disattivateNellaVoce(SchermataSegnalazioni._voceDellaLavorazione());
            SchermataSegnalazioni._disattivateInMemoria = { documento: chiave, valore: valore };
            return valore;
        }
        catch (e) {
            return false;
        }
    },

    /// I20-1126: disattiva o riattiva le segnalazioni della lavorazione, nella sua voce. false se la
    /// lavorazione non c'e' o il file non si scrive: la scelta non e' stata salvata.
    impostaDisattivate(disattivate) {
        const voce = SchermataSegnalazioni._voceDellaLavorazione();
        if (voce == null) {
            messaggioUtente("Code SGN-12 Nessuna lavorazione per questo documento: le segnalazioni restano come sono", "warning", false, 6);
            return false;
        }
        try {
            if (disattivate === true) {
                voce[SchermataSegnalazioni.CAMPO_DISATTIVATE] = true;
            }
            else {
                //Si scrive false, non si toglie il campo: salvaVoceLavorazione unisce la voce a quella
                //del file (Object.assign), e un campo tolto li' resterebbe true.
                voce[SchermataSegnalazioni.CAMPO_DISATTIVATE] = false;
            }
            Utility.salvaVoceLavorazione(pathLavorazione, idMacchina(), voce);
        }
        catch (e) {
            console.error("Code SGN-13 Voce della lavorazione non salvata:", e);
            messaggioUtente("Code SGN-13 La scelta sulle segnalazioni non e' stata salvata", "error", false, 6);
            return false;
        }
        //I20-1126: i bollini gia' nel documento si nascondono disattivando, senza toglierli, e
        //ricompaiono riattivando. Dopo "Risolvi tutto" non ce n'e' piu' nessuno da nascondere.
        try {
            Segnalazioni.mostraBolliniDelDocumento(SchermataSegnalazioni._documento(), disattivate !== true);
        }
        catch (e) {
            console.error("Code SGN-15 Bollini del documento non " + (disattivate === true ? "nascosti" : "mostrati") + ":", e);
        }
        SchermataSegnalazioni._disattivateInMemoria = null;
        SchermataSegnalazioni.aggiornaIcona();
        return true;
    },

    /// I20-1056, lotto 2: il testo del conteggio accanto al titolo.
    testoConteggio(lette) {
        const totali = SchermataSegnalazioni.conta(lette);
        if (totali.segnalazioni === 0) {
            return "";
        }
        return totali.segnalazioni + (totali.segnalazioni === 1 ? " segnalazione" : " segnalazioni") + " in " + totali.box + " box";
    },

    /// I20-1056, lotto 5: l'avviso prima del Report Integrita', o "" se non c'e' niente da dire:
    /// "Nel documento ci sono 3 segnalazioni di impaginazione irrisolte in 2 box (1 errore)."
    testoAvvisoReport(lette) {
        const totali = SchermataSegnalazioni.conta(lette);
        if (totali.segnalazioni === 0) {
            return "";
        }
        const errori = (Array.isArray(lette) ? lette : []).reduce((totale, lettura) => totale
            + (Array.isArray(lettura.voci) ? lettura.voci.filter(voce => etichettaSegnalazioni.gravita(voce.g) === "error").length : 0), 0);
        let testo = (totali.segnalazioni === 1
            ? "Nel documento c'è 1 segnalazione di impaginazione irrisolta"
            : "Nel documento ci sono " + totali.segnalazioni + " segnalazioni di impaginazione irrisolte")
            + " in " + totali.box + " box";
        if (errori > 0) {
            testo += " (" + errori + (errori === 1 ? " errore" : " errori") + ")";
        }
        return testo + ".";
    },

    /// I20-1056, lotto 5: le voci di un box ridotte a quello che il report mostra accanto al record:
    /// quante, quanti errori, la gravita' peggiore e le voci per il suggerimento. null se non ce ne
    /// sono.
    riepilogoVoci(voci) {
        const elenco = Array.isArray(voci) ? voci.filter(voce => voce != null) : [];
        if (elenco.length === 0) {
            return null;
        }
        return {
            segnalazioni: elenco.length,
            errori: elenco.filter(voce => etichettaSegnalazioni.gravita(voce.g) === "error").length,
            gravita: etichettaSegnalazioni.gravitaPeggiore(elenco),
            voci: elenco.map(voce => ({ g: voce.g, c: voce.c, t: voce.t }))
        };
    },

    /// I20-1056, lotto 5: mette in record.segnalazioniImpaginazione il riepilogo dei bollini del suo
    /// box, dalla lettura del documento. Tocca solo i record ricevuti: un box con le sole
    /// segnalazioni, che nel report non c'e', non ci entra.
    /// Il box si riconosce dall'id (inddId, l'id del gruppo nella mappatura). Se l'id non torna,
    /// come in un report riaperto dopo che un bollino e' stato ridisegnato (il gruppo cambia), si
    /// prova con l'idRec del DNA (dnaDelBox, di norma Utility.getDnaOfBox), letto solo per quei box.
    /// Torna quanti record hanno segnalazioni.
    assegnaAiRecord(records, lette, dnaDelBox) {
        const leggiDna = typeof dnaDelBox === "function" ? dnaDelBox : (box) => Utility.getDnaOfBox(box);
        const elencoRecord = (Array.isArray(records) ? records : []).filter(record => record != null);
        elencoRecord.forEach(record => { delete record.segnalazioniImpaginazione; });

        const aggiungi = (mappa, chiave, record) => {
            if (chiave == null || chiave === "") {
                return;
            }
            if (!mappa.has(chiave)) {
                mappa.set(chiave, []);
            }
            mappa.get(chiave).push(record);
        };
        const perId = new Map();
        elencoRecord.forEach(record => {
            const id = record.inddId != null ? record.inddId : (record.elementoMappa != null ? record.elementoMappa.refId : null);
            aggiungi(perId, id != null ? String(id) : null, record);
        });

        const vociDelRecord = new Map();
        const accumula = (record, voci) => vociDelRecord.set(record, (vociDelRecord.get(record) || []).concat(voci));
        const senzaId = [];
        (Array.isArray(lette) ? lette : []).forEach(lettura => {
            const voci = Array.isArray(lettura.voci) ? lettura.voci : [];
            if (voci.length === 0) {
                return;
            }
            let id = null;
            try {
                id = lettura.box != null && lettura.box.id != null ? String(lettura.box.id) : null;
            }
            catch (e) {
                id = null;
            }
            const trovati = id != null ? perId.get(id) : null;
            if (trovati != null) {
                trovati.forEach(record => accumula(record, voci));
            }
            else {
                senzaId.push(lettura);
            }
        });

        if (senzaId.length > 0) {
            const perIdRec = new Map();
            elencoRecord.filter(record => !vociDelRecord.has(record)).forEach(record => {
                aggiungi(perIdRec, Segnalazioni.chiaveRecord(record.elementoMappa != null ? record.elementoMappa.idRec : null), record);
            });
            senzaId.forEach(lettura => {
                let dna = null;
                try {
                    dna = leggiDna(lettura.box);
                }
                catch (e) {
                    dna = null;
                }
                const trovati = perIdRec.get(Segnalazioni.chiaveRecord(dna != null ? dna.idRec : null));
                if (trovati != null) {
                    trovati.forEach(record => accumula(record, lettura.voci));
                }
            });
        }

        vociDelRecord.forEach((voci, record) => {
            record.segnalazioniImpaginazione = SchermataSegnalazioni.riepilogoVoci(etichettaSegnalazioni.senzaDoppioni(voci));
        });
        return vociDelRecord.size;
    },

    /// I20-1056, lotto 5: il suggerimento del numero accanto al record del report: quante e le
    /// voci, con il dizionario del cliente. Sulla stessa riga, separate da un pallino: il riquadro
    /// del suggerimento (tooltip.js) scrive il testo cosi' com'e', e non andrebbe a capo.
    testoSegnalazioniDelRecord(riepilogo, traduzioni) {
        if (riepilogo == null || !(riepilogo.segnalazioni > 0)) {
            return "";
        }
        const righe = [riepilogo.segnalazioni + (riepilogo.segnalazioni === 1
            ? " segnalazione di impaginazione irrisolta:"
            : " segnalazioni di impaginazione irrisolte:")];
        (Array.isArray(riepilogo.voci) ? riepilogo.voci : []).forEach(voce => {
            righe.push("• " + (voce.c ? voce.c + " " : "") + SchermataSegnalazioni.traduciTesto(voce.t || "", traduzioni));
        });
        return righe.join(" ");
    },

    /// I20-1056, lotto 2: il dizionario del cliente sulle etichette degli elementi citate nel testo
    /// di una segnalazione (CSF-008, CSF-009, CSF-013 nominano gli elementi del box), nella forma
    /// delle differenze rilevate: "ANZICHE' (campo_offerta)". Un'etichetta si riconosce intera,
    /// non dentro un'altra parola, e vince la piu' lunga: campo_offerta_KgL_sconto non diventa
    /// "ANZICHE' (campo_offerta)_KgL_sconto". Il passaggio e' uno solo, cosi' una traduzione non
    /// viene ritradotta. Il codice e il resto del testo restano com'erano.
    /// Solo a schermo: il bollino tiene il testo vero, che "Risolvi" usa per riconoscere la voce.
    traduciTesto(testo, traduzioni) {
        const originale = testo == null ? "" : String(testo);
        const elenco = (Array.isArray(traduzioni) ? traduzioni : [])
            .filter(t => t != null && t.label != null && String(t.label) !== "" && t.traduzione != null && String(t.traduzione).trim() !== "")
            .sort((a, b) => String(b.label).length - String(a.label).length);
        if (originale === "" || elenco.length === 0) {
            return originale;
        }
        const protetta = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const etichette = new RegExp("(^|[^A-Za-z0-9_$])(" + elenco.map(t => protetta(String(t.label))).join("|") + ")(?=$|[^A-Za-z0-9_$])", "g");
        return originale.replace(etichette, (intero, prima, etichetta) => prima + reportIntegritaAvvio.etichettaSegnalazione(etichetta, elenco));
    },

    /// I20-1056, lotto 2: la descrizione della referenza del box, come la mostra il tracciato: le
    /// descrizioni unite da " | ", o quella del gruppo se c'e'. Vuota se la referenza non e' nella
    /// lista della lavorazione.
    descrizioneDelRecord(records, idRec) {
        const chiave = Segnalazioni.chiaveRecord(idRec);
        if (chiave == null) {
            return "";
        }
        const trovato = (Array.isArray(records) ? records : []).find(r => r != null && r.recordInTracciato != null
            && Segnalazioni.chiaveRecord(r.recordInTracciato.idRec) === chiave);
        return trovato != null ? reportConfrontoCsv.descrizioneComposta(trovato.recordInTracciato) : "";
    },

    /// Un testo lungo, abbreviato con i puntini: il testo intero va nel suggerimento.
    abbrevia(testo, massimo = SchermataSegnalazioni.LUNGHEZZA_DESCRIZIONE) {
        const intero = testo == null ? "" : String(testo);
        if (intero.length <= massimo) {
            return intero;
        }
        return intero.substring(0, massimo).replace(/\s+$/, "") + "…";
    },

    /// I20-1056, lotto 2: copia negli appunti il codice gruppo intero. Una stringa, sempre: gli
    /// appunti di UXP rifiutano il resto.
    copiaCodice(codiceGruppo, appunti = null) {
        const testo = String(codiceGruppo == null ? "" : codiceGruppo);
        const destinazione = appunti != null ? appunti : (typeof navigator !== "undefined" ? navigator.clipboard : null);
        if (destinazione == null || typeof destinazione.writeText !== "function") {
            return Promise.reject(new Error("appunti non disponibili"));
        }
        return Promise.resolve(destinazione.writeText(testo));
    },

    _traduzioni() {
        try {
            if (typeof ReportIntegrita !== "undefined" && typeof ReportIntegrita.traduzioniLabelSegnalazioni === "function") {
                return ReportIntegrita.traduzioniLabelSegnalazioni();
            }
        }
        catch (e) {
            //senza dizionario le etichette restano quelle vere
        }
        return [];
    },

    _recordsDellaLavorazione() {
        try {
            if (typeof pluginMiddleware !== "undefined" && typeof pluginMiddleware.recordsDellaLavorazione === "function") {
                return pluginMiddleware.recordsDellaLavorazione();
            }
        }
        catch (e) {
            //senza lista non c'e' la descrizione
        }
        return [];
    },

    _pallino(gravita) {
        return $('<span></span>').css({
            display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', flexShrink: '0',
            backgroundColor: SchermataSegnalazioni.coloreCss(gravita)
        });
    },

    /// Il box sulla schermata: la meccanica (l'etichetta del box) e, se il DNA si legge, il codice
    /// gruppo e l'idRec della referenza.
    _datiBox(box) {
        const dati = { meccanica: "", codiceGruppo: "", idRec: null };
        try {
            dati.meccanica = box.label || "";
            const dna = Utility.getDnaOfBox(box);
            if (dna != null) {
                dati.codiceGruppo = dna.codice_gruppo || "";
                dati.idRec = dna.idRec;
            }
        }
        catch (e) {
            //resta quello che c'e'
        }
        return dati;
    },

    //I20-1044: un testo dentro una riga flex che si restringe col pannello. Senza minWidth 0 non
    //scende sotto la sua parola piu' lunga - i codici del gruppo uniti dalle virgole, le etichette
    //come foto_extra$logo_attributo_it$tipo_3 - e restringendo il pannello la riga restava larga,
    //con i pulsanti fuori dal bordo destro. Le parole troppo lunghe vanno a capo.
    _testoCheSiRestringe(elemento) {
        return elemento.css({ flex: '1 1 0', minWidth: '0', overflowWrap: 'anywhere', wordBreak: 'break-word' });
    },

    _bloccoBox(lettura, elenco, contesto = {}) {
        const blocco = $('<div></div>').css({ margin: '4px 0 8px 0', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' });
        const datiBox = SchermataSegnalazioni._datiBox(lettura.box);
        //I20-1056, lotto 2: per ritrovare il box tornando dalla scheda, anche se nel frattempo e' stato rifatto.
        const chiave = Segnalazioni.chiaveRecord(datiBox.idRec);
        if (chiave != null) {
            blocco.attr('data-idrec', chiave);
        }

        //I20-1044: se non c'e' spazio, i pulsanti vanno a capo sotto il nome invece di uscire a destra.
        const testata = $('<div></div>').css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' });
        testata.append(SchermataSegnalazioni._pallino(etichettaSegnalazioni.gravitaPeggiore(lettura.voci)));
        const nome = SchermataSegnalazioni._testoCheSiRestringe($('<span></span>')).css({ fontWeight: 'bold', flexBasis: '120px' });
        nome.append($('<span></span>').text("Box " + datiBox.meccanica));
        if (datiBox.codiceGruppo) {
            //I20-1056, lotto 2: il codice gruppo, abbreviato a schermo, si copia intero con un clic.
            const codice = $('<span></span>').text(SchermataSegnalazioni.codiciAbbreviati(datiBox.codiceGruppo))
                .attr('title', "Clicca per copiare: " + SchermataSegnalazioni.codiciAbbreviati(datiBox.codiceGruppo, Infinity))
                .css({ cursor: 'pointer', textDecoration: 'underline dotted', fontWeight: 'normal' })
                .on('click', () => {
                    SchermataSegnalazioni.copiaCodice(datiBox.codiceGruppo)
                        .then(() => {
                            //La conferma sta qui: un messaggio del Plugin finirebbe sotto il popup.
                            codice.css({ backgroundColor: '#c8e6c9' });
                            setTimeout(() => codice.css({ backgroundColor: '' }), 600);
                        })
                        .catch(e => console.error("Code SGN-04 Codice non copiato:", e));
                });
            nome.append($('<span></span>').text(" · gruppo "));
            nome.append(codice);
        }
        testata.append(nome);

        const vai = $('<button type="button"></button>').text("Vai al box").css({ flexShrink: '0' })
            .on('click', () => SchermataSegnalazioni.vaiAlBox(lettura.box, elenco));

        const ridisegna = () => SchermataSegnalazioni.riempi(elenco);
        testata.append(vai);
        testata.append(SchermataSegnalazioni._azioniTutte(lettura.box, ridisegna));
        blocco.append(testata);

        //I20-1056, lotto 2: la descrizione della referenza, in piccolo, abbreviata oltre due righe circa.
        const descrizione = SchermataSegnalazioni.descrizioneDelRecord(contesto.records, datiBox.idRec);
        if (descrizione !== "") {
            const breve = SchermataSegnalazioni.abbrevia(descrizione);
            const riga = $('<div></div>').text(breve)
                .css({ fontSize: '11px', color: '#666', marginTop: '2px', paddingLeft: '16px', maxHeight: '30px', overflow: 'hidden', overflowWrap: 'anywhere' });
            if (breve !== descrizione) {
                riga.attr('title', descrizione);
            }
            blocco.append(riga);
        }

        lettura.voci.forEach((voce, indice) => blocco.append(SchermataSegnalazioni._rigaVoce(lettura.box, voce, indice, contesto, ridisegna)));

        return blocco;
    },

    /// "Risolvi tutte" per un box, con la conferma dentro il popup: la conferma di Modali
    /// starebbe sotto. alCambio ridisegna chi la mostra (la schermata o la scheda ref).
    _azioniTutte(box, alCambio) {
        const azioniTutte = $('<span></span>').css({ flexShrink: '0' });
        const tutte = $('<button type="button"></button>').text("Risolvi tutte")
            .on('click', () => {
                azioniTutte.empty();
                azioniTutte.append($('<span></span>').text("Sicuro? ").css({ fontWeight: 'bold' }));
                azioniTutte.append($('<button type="button"></button>').text("Sì").on('click', () => {
                    Segnalazioni.risolviTutte(box);
                    alCambio();
                }));
                azioniTutte.append($('<button type="button"></button>').text("No").on('click', () => {
                    alCambio();
                }));
            });
        azioniTutte.append(tutte);
        return azioniTutte;
    },

    /// Una segnalazione del box, con "Risolvi". La stessa riga nella schermata e nella scheda ref
    /// (I20-1056, lotto 4): si risolve allo stesso modo da tutte e due.
    _rigaVoce(box, voce, indice, contesto, alCambio) {
        const riga = $('<div></div>').css({ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px', paddingLeft: '16px' });
        riga.append(SchermataSegnalazioni._pallino(voce.g).css({ marginTop: '3px' }));
        const testo = SchermataSegnalazioni._testoCheSiRestringe($('<span></span>'));
        if (voce.c) {
            testo.append($('<b></b>').text(voce.c + " "));
        }
        //I20-1056, lotto 2: le etichette degli elementi con il dizionario del cliente.
        testo.append($('<span></span>').text(SchermataSegnalazioni.traduciTesto(voce.t || "", contesto.traduzioni)));
        //Lotto 4: un bollino di prima del I20-1029 mostrava solo il codice o una frase breve, e
        //il messaggio intero non c'e'. Lo si dice, perche' il testo corto non sembri un errore.
        if (voce.vecchio) {
            testo.append($('<span></span>').text(" (bollino vecchio)").css({ color: '#777', fontStyle: 'italic' }));
        }
        riga.append(testo);
        riga.append($('<button type="button"></button>').text("Risolvi").css({ flexShrink: '0' }).on('click', () => {
            //I20-1138: la selezione si guarda prima, perche' risolvere puo' rifare il gruppo del box.
            const eraSelezionato = SchermataSegnalazioni.eSelezionato(box);
            const dopo = Segnalazioni.risolviVoce(box, indice);
            SchermataSegnalazioni.seguiBoxRigruppato(box, dopo, eraSelezionato);
            alCambio(dopo);
        }));
        return riga;
    },

    /// I20-1138: se il box e' la selezione corrente di InDesign (da solo).
    eSelezionato(box) {
        try {
            const selezione = typeof app !== "undefined" && app != null ? app.selection : null;
            return box != null && selezione != null && selezione.length === 1 && selezione[0] != null && selezione[0].id === box.id;
        }
        catch (e) {
            return false;
        }
    },

    /// I20-1138: "Risolvi" con altre segnalazioni nel box ridisegna il bollino, e il disegno rifa' il
    /// gruppo del box (Utility.addBollinoCustom): il gruppo nuovo ha un altro id. Se il box era
    /// selezionato, il ciclo degli eventi lo prendeva per una ref appena scelta e chiudeva tutte le
    /// finestre (EVENT_NEW_REF_SELECTED, Modali.closeAllModal), compresa questa. Qui il box nuovo si
    /// seleziona e il ciclo lo accetta come gia' visto, con la scheda ref che lo segue come in I20-1132
    /// (seguiBoxRicostruito). Un box non rifatto, non selezionato o non valido non tocca niente.
    seguiBoxRigruppato(prima, dopo, eraSelezionato) {
        try {
            if (!eraSelezionato || dopo == null || dopo === prima || !dopo.isValid) {
                return false;
            }
            if (typeof schedaRef !== "undefined" && schedaRef != null && typeof schedaRef.seguiBoxRicostruito === "function") {
                return schedaRef.seguiBoxRicostruito(dopo);
            }
            Utility.selezionaBox(dopo);
            if (typeof indesignEvents !== "undefined" && indesignEvents != null && typeof indesignEvents.accettaSelezione === "function") {
                indesignEvents.accettaSelezione([dopo.id]);
            }
            return true;
        }
        catch (e) {
            console.error("Code SGN-07 Box rifatto dopo Risolvi non seguito:", e);
            return false;
        }
    },

    /// I20-1056, lotto 4: le segnalazioni di un box per la scheda ref: "Risolvi tutte" e le righe,
    /// come nella schermata. alCambio rilegge e ridisegna dopo ogni risoluzione.
    elencoVociDelBox(box, voci, alCambio) {
        const contesto = { traduzioni: SchermataSegnalazioni._traduzioni() };
        const elenco = $('<div></div>');
        const azioni = $('<div></div>').css({ display: 'flex', justifyContent: 'flex-end' });
        azioni.append(SchermataSegnalazioni._azioniTutte(box, alCambio));
        elenco.append(azioni);
        (Array.isArray(voci) ? voci : []).forEach((voce, indice) => elenco.append(SchermataSegnalazioni._rigaVoce(box, voce, indice, contesto, alCambio)));
        return elenco;
    },

    /// I20-1116: centra la finestra di InDesign sulla selezione senza cambiare lo zoom: riassegnare
    /// lo zoom corrente la ricentra sugli oggetti selezionati. Se non riesce la selezione resta com'e'.
    /// La finestra e' quella del documento: con il pannello flottante sopra, il centro puo' cadere
    /// ancora sotto il Plugin; agganciato, la finestra e' lo spazio libero e il box si vede.
    centraSullaSelezione(finestra) {
        try {
            if (finestra == null) {
                return false;
            }
            const zoom = finestra.zoomPercentage;
            finestra.zoomPercentage = zoom;
            return true;
        }
        catch (e) {
            console.error("Code SGN-07 Vista non centrata sul box:", e);
            return false;
        }
    },

    /// Porta alla pagina del box e lo seleziona, come fa il Report Integrita'. false se non si puo'.
    _selezionaBox(box) {
        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
            //I20-1116: la vista si centra sul box, che altrimenti puo' restare fuori o dietro il pannello.
            SchermataSegnalazioni.centraSullaSelezione(app.activeWindow);
            return true;
        }
        catch (e) {
            console.error("Code SGN-02 Box non raggiungibile:", e);
            messaggioUtente("Code SGN-02 Il box non si raggiunge: potrebbe essere stato tolto o spostato. Riapri le segnalazioni.", "warning", false, 5);
            return false;
        }
    },

    /// I20-1056, lotto 2: "Vai al box" apre la scheda ref del box in vista controllata, come il
    /// "Trova" del Report Integrita': menu bloccati, eventi fermi, si esce solo con la X. La
    /// schermata non si distrugge: si stacca dalla pagina e si rimette alla chiusura della scheda,
    /// riletta e posizionata sullo stesso box. Staccarla serve anche perche' la scheda apre i suoi
    /// popup con lo stesso id #popup, e chiudendoli toglierebbe la schermata nascosta.
    /// Riusa i pezzi della scheda dal report (ReportIntegrita, schedaRef), senza cambiarli.
    /// Un box senza DNA leggibile (finito dentro un altro gruppo) si seleziona soltanto.
    vaiAlBox(box, elenco = null) {
        if (SchermataSegnalazioni._schedaAperta != null) {
            return false;
        }

        //I20-1116, lotto 2: dalla colonna della vista affiancata si seleziona soltanto il box: la
        //scheda ref si apre a sinistra come per ogni selezione, con tutti i menu, e la colonna resta.
        //Basta che la colonna sia aperta: la schermata e' una sola, quindi il pulsante e' suo.
        //elenco.closest sulla colonna, in UXP, non la riconosceva, e si finiva nella vista controllata.
        if (VistaAffiancata.colonnaAperta(SchermataSegnalazioni.ID_COLONNA)) {
            return SchermataSegnalazioni._selezionaBox(box);
        }

        let dna = null;
        try {
            dna = Utility.getDnaOfBox(box);
        }
        catch (e) {
            dna = null;
        }
        const schedaDisponibile = typeof schedaRef !== "undefined" && typeof ReportIntegrita !== "undefined";
        if (dna == null || elenco == null || !schedaDisponibile) {
            const selezionato = SchermataSegnalazioni._selezionaBox(box);
            if (selezionato && dna == null) {
                messaggioUtente("Code SGN-03 Il box non ha un dna leggibile: e' selezionato, ma la scheda non si puo' aprire", "warning", false, 5);
            }
            return false;
        }

        //Fermi prima di selezionare: altrimenti la selezione aprirebbe la scheda per conto suo.
        SchermataSegnalazioni._eventiFermi(true);
        if (!SchermataSegnalazioni._selezionaBox(box)) {
            SchermataSegnalazioni._eventiFermi(false);
            return false;
        }

        let pagina = null;
        try {
            pagina = box.parentPage != null ? box.parentPage.name : null;
        }
        catch (e) {
            pagina = null;
        }

        const popup = elenco.closest("#popup");
        SchermataSegnalazioni._schedaAperta = {
            box: box,
            elenco: elenco,
            popup: popup,
            idRec: dna.idRec,
            //Per ritrovare il box se la scheda lo rifa': la forma che il Report Integrita' sa leggere.
            record: { codiceGruppo: dna.codice_gruppo, elementoMappa: { idRec: dna.idRec, pagina: pagina } },
            timer: null,
            riaggancioInCorso: false
        };

        popup.detach();

        $("#refImage").show();
        SchermataSegnalazioni._creaChiusuraScheda();
        ReportIntegrita._applicaBloccoSchedaDalReport();

        showLoading("Caricamento scheda REF");
        schedaRef.apertaDalReport = true;
        schedaRef.setInvalidated(false);
        schedaRef.initSchedaRef(ReportIntegrita._refPerSchedaDalReport(box, dna));

        //initSchedaRef libera gli eventi uscendo: si riaffermano qui e a ogni giro del vigilante.
        ReportIntegrita._applicaBloccoSchedaDalReport();
        SchermataSegnalazioni._schedaAperta.timer = setInterval(
            () => SchermataSegnalazioni._vigilaScheda(), SchermataSegnalazioni.INTERVALLO_VIGILANZA_SCHEDA);
        return true;
    },

    _eventiFermi(fermi) {
        if (typeof indesignEvents !== "undefined" && indesignEvents != null && typeof indesignEvents.setBusy === "function") {
            indesignEvents.setBusy(fermi);
        }
    },

    /// La X della scheda aperta dalla schermata: l'unica via d'uscita, come dal Report Integrita'.
    _creaChiusuraScheda() {
        $("#chiudiSchedaDalleSegnalazioni").remove();

        const testata = $("#referenza");
        testata.css("display", "flex");
        testata.css("align-items", "center");
        testata.css("justify-content", "space-between");

        const bottone = $('<div id="chiudiSchedaDalleSegnalazioni">✕</div>');
        bottone.css("color", "white");
        bottone.css("cursor", "pointer");
        bottone.css("padding", "0px 10px");
        bottone.css("font-size", "14px");
        bottone.on("click", () => SchermataSegnalazioni.chiudiScheda());
        testata.append(bottone);

        const elemento = document.getElementById("chiudiSchedaDalleSegnalazioni");
        if (elemento != null && typeof Tooltip !== "undefined") {
            Tooltip.impostaTooltip(elemento, "Chiudi la scheda e torna alle segnalazioni");
        }
    },

    /// Reimpagina e cambi strutturali rifanno il box: la scheda si ripunta sul box nuovo, cercato
    /// per codice gruppo come fa il Report Integrita'. Se non c'e' piu', si torna alla schermata.
    _vigilaScheda() {
        const stato = SchermataSegnalazioni._schedaAperta;
        if (stato == null) {
            return;
        }

        ReportIntegrita._applicaBloccoSchedaDalReport();

        if (stato.riaggancioInCorso) {
            return;
        }

        if (!schedaRef.serveRiaggancioDalReport(stato.box)) {
            //I20-1074: deselezionare il box vale come la X: si torna alla schermata.
            if (ReportIntegrita._deselezionatoDaChiudere(stato)) {
                SchermataSegnalazioni.chiudiScheda();
            }
            return;
        }

        stato.riaggancioInCorso = true;
        const box = ReportIntegrita._resolveBoxByCodiceGruppo(stato.record);
        const dna = box != null ? Utility.getDnaOfBox(box) : null;
        if (box == null || dna == null) {
            messaggioUtente("Code SGN-05 Il box non e' piu' in pagina: la scheda si chiude e si torna alle segnalazioni", "warning", false, 6);
            stato.riaggancioInCorso = false;
            SchermataSegnalazioni.chiudiScheda();
            return;
        }

        try {
            app.selection = [box];
        }
        catch (e) {
            console.error("Errore selezione del box rifatto:", e);
        }
        schedaRef.setBusy(false);
        schedaRef.setInvalidated(false);
        stato.box = box;

        showLoading("Ricarico la scheda sul box rifatto");
        schedaRef.initSchedaRef(ReportIntegrita._refPerSchedaDalReport(box, dna));
        stato.riaggancioInCorso = false;
        ReportIntegrita._applicaBloccoSchedaDalReport();
    },

    /// La X: la scheda si chiude e torna la schermata, riletta - nella scheda il box puo' essere
    /// stato rifatto o risolto - e posizionata sullo stesso box.
    chiudiScheda() {
        const stato = SchermataSegnalazioni._schedaAperta;
        if (stato == null) {
            return;
        }
        //Una volta sola: la X si puo' premere due volte, e il vigilante puo' arrivarci insieme.
        SchermataSegnalazioni._schedaAperta = null;
        if (stato.timer != null) {
            clearInterval(stato.timer);
        }

        $("#chiudiSchedaDalleSegnalazioni").remove();
        ReportIntegrita._terminaSchedaDalReport();
        SchermataSegnalazioni._eventiFermi(false);

        $("body").append(stato.popup);
        CampiARiposo.tuttiARiposo();
        SchermataSegnalazioni.riempi(stato.elenco);
        setTimeout(() => SchermataSegnalazioni._evidenziaBox(stato.elenco, stato.idRec), 50);
    },

    /// Porta sotto gli occhi il blocco del box e lo evidenzia per un momento. Il ridisegno riparte
    /// dall'alto, e un box che non si vede sembra sparito.
    _evidenziaBox(elenco, idRec) {
        const chiave = Segnalazioni.chiaveRecord(idRec);
        if (chiave == null) {
            return;
        }
        try {
            const blocco = elenco.find('[data-idrec="' + chiave + '"]').first();
            const elemento = blocco.get(0);
            const contenitore = elenco.parent().get(0);
            if (elemento == null || contenitore == null) {
                return;
            }
            const scarto = elemento.getBoundingClientRect().top - contenitore.getBoundingClientRect().top;
            contenitore.scrollTop = Math.max(0, contenitore.scrollTop + scarto - 20);
            blocco.css({ outline: '2px solid #ef6c00' });
            setTimeout(() => blocco.css({ outline: '' }), 2500);
        }
        catch (e) {
            //non posizionata: la schermata c'e' comunque
        }
    }
};

module.exports = SchermataSegnalazioni;
