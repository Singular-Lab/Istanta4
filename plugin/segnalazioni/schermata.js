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
 * Usa le globali di indexNew come gli altri moduli: $, Modali, Utility, app, docInLavorazione,
 * messaggioUtente. Le funzioni che non toccano il documento (perPagina, conta, coloreCss) sono pure.
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

    /// Apre il popup con le segnalazioni del documento.
    apri() {
        const elenco = $('<div></div>').attr('id', SchermataSegnalazioni.ID_ELENCO)
            .css({ width: '100%', color: 'black', fontSize: '12px' });
        SchermataSegnalazioni.riempi(elenco);
        //Il popup aspetta finche' non lo si chiude: non si aspetta qui.
        Modali.popup("Segnalazioni di impaginazione", elenco, "xl");
    },

    /// A fine impaginazione: apre la schermata solo se il giro ha prodotto segnalazioni.
    apriSeCiSono(reportImpaginazioneObj) {
        if (reportImpaginazioneObj != null && Array.isArray(reportImpaginazioneObj.segnalazioni)
            && reportImpaginazioneObj.segnalazioni.length > 0) {
            SchermataSegnalazioni.apri();
        }
    },

    /// Riempie l'elenco rileggendo il documento. Dopo ogni "Risolvi" si rifa' da capo: gli
    /// indici delle segnalazioni e i box (che il bollino ridisegnato regruppa) cambiano.
    riempi(elenco) {
        elenco.empty();

        let lette = [];
        try {
            lette = Segnalazioni.leggiDocumento(SchermataSegnalazioni._documento());
        }
        catch (e) {
            console.error("Code SGN-01 Segnalazioni non lette dal documento:", e);
        }

        const pagine = SchermataSegnalazioni.perPagina(lette);
        if (pagine.length === 0) {
            elenco.append($('<div></div>').text("Nessuna segnalazione nel documento.").css({ padding: '8px' }));
            return;
        }

        const totali = SchermataSegnalazioni.conta(lette);
        elenco.append($('<div></div>')
            .text(totali.segnalazioni + (totali.segnalazioni === 1 ? " segnalazione" : " segnalazioni") + " in " + totali.box + " box")
            .css({ fontWeight: 'bold', marginBottom: '6px' }));

        pagine.forEach(pagina => {
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
    _nomeBox(box) {
        let nome = "Box";
        try {
            nome = "Box " + (box.label || "");
            const dna = Utility.getDnaOfBox(box);
            if (dna != null && dna.codice_gruppo) {
                nome += " · gruppo " + dna.codice_gruppo;
            }
        }
        catch (e) {
            //resta il nome che c'e'
        }
        return nome;
    },

    _bloccoBox(lettura, elenco) {
        const blocco = $('<div></div>').css({ margin: '4px 0 8px 0', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' });

        const testata = $('<div></div>').css({ display: 'flex', alignItems: 'center', gap: '6px' });
        testata.append(SchermataSegnalazioni._pallino(etichettaSegnalazioni.gravitaPeggiore(lettura.voci)));
        testata.append($('<span></span>').text(SchermataSegnalazioni._nomeBox(lettura.box)).css({ flexGrow: '1', fontWeight: 'bold' }));

        const vai = $('<button type="button"></button>').text("Vai al box")
            .on('click', () => SchermataSegnalazioni.vaiAlBox(lettura.box));

        //"Risolvi tutte" chiede conferma dentro il popup: la conferma di Modali starebbe sotto.
        const azioniTutte = $('<span></span>');
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
            const testo = $('<span></span>').css({ flexGrow: '1' });
            if (voce.c) {
                testo.append($('<b></b>').text(voce.c + " "));
            }
            testo.append($('<span></span>').text(voce.t || ""));
            riga.append(testo);
            riga.append($('<button type="button"></button>').text("Risolvi").on('click', () => {
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
