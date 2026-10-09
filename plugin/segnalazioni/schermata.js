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
//I20-1056, lotto 2: le stesse regole del Report Integrita' per il dizionario del cliente e per la
//descrizione della referenza. Sono moduli puri: si caricano anche sotto Node.
const reportIntegritaAvvio = require('../reportIntegrita/avvio');
const reportConfrontoCsv = require('../reportIntegrita/csv');

//I colori della schermata, gli stessi del bollino: rosso gli errori, arancione i warning.
const COLORE_CSS = { error: "#c62828", warning: "#ef6c00", notifica: "#1565c0" };

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
            //Il popup aspetta finche' non lo si chiude: non si aspetta qui.
            Modali.popup("Segnalazioni di impaginazione", elenco, "xl", SchermataSegnalazioni.allaChiusura, null, conteggio);
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
    },

    controllaDocumento() {
        SchermataSegnalazioni._leggi(null);
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
        const riepilogo = { segnalazioni: 0, errori: 0, gravita: null };
        const controllo = SchermataSegnalazioni._ultimoControllo;
        if (controllo == null || controllo.chiave !== chiaveDocumento) {
            return riepilogo;
        }
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

    /// L'icona numerata del pulsante Segnalazioni: rossa con almeno un errore, arancione con soli
    /// warning, nascosta senza segnalazioni.
    aggiornaIcona() {
        try {
            const icona = $("#" + SchermataSegnalazioni.ID_ICONA);
            if (icona.length === 0) {
                return;
            }
            const riepilogo = SchermataSegnalazioni.riepilogoControllo(Segnalazioni._chiaveDocumento(SchermataSegnalazioni._documento()));
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

    /// Riempie l'elenco rileggendo il documento, o le sole pagine con cui la schermata si e'
    /// aperta. Dopo ogni "Risolvi" si rifa' da capo: gli indici delle segnalazioni e i box (che il
    /// bollino ridisegnato regruppa) cambiano.
    riempi(elenco) {
        const pagine = elenco.data('pagine');
        SchermataSegnalazioni._disegna(elenco, SchermataSegnalazioni._leggi(Array.isArray(pagine) ? pagine : null), pagine);
    },

    _disegna(elenco, lette, pagine) {
        elenco.empty();

        //I20-1056, lotto 2: il conteggio e' accanto al titolo del popup, e si aggiorna a ogni giro.
        const conteggio = elenco.data('conteggio');
        if (conteggio != null) {
            conteggio.text(SchermataSegnalazioni.testoConteggio(lette));
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
            Segnalazioni.risolviVoce(box, indice);
            alCambio();
        }));
        return riga;
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

    /// Porta alla pagina del box e lo seleziona, come fa il Report Integrita'. false se non si puo'.
    _selezionaBox(box) {
        try {
            if (box.parentPage) {
                app.activeWindow.activePage = box.parentPage;
            }
            app.selection = [box];
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
        Modali.mostraHidebleElements();

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
        Modali.nascondiHidebleElements();
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
