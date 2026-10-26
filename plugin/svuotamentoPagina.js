/// TASK-19c18841: la finestra che compare prima di svuotare delle pagine quando documento e
/// server non concordano. Una finestra sola per tutte le referenze, con due scelte:
/// «Sincronizza e svuota» e Annulla. Prima (I20-1040) erano fino a tre finestre in fila, ognuna
/// con due scelte piu' Annulla, e chi svuotava non sapeva quale prendere.
///
/// «Sincronizza e svuota» allinea il server al documento per le sole referenze della finestra,
/// poi svuota. Per ogni tipo di referenza vuol dire:
///   spostata          il server la ha in una pagina da svuotare, il documento in un'altra che
///                     resta: passa sul server a quella pagina, e resta.
///   non impaginata    il server la ha in una pagina da svuotare, il documento da nessuna parte:
///                     esce dal server con la pagina.
///   registrata altrove  il documento la ha in una pagina da svuotare, il server in un'altra:
///                     passa sul server a questa pagina, ed esce con lei.
///   non registrata    il documento la ha in una pagina da svuotare, il server no: esce con la
///                     pagina.
///
/// Ogni riga dice codice, descrizione (o che la referenza non e' nella lista scaricata), pagina
/// sul server e nel documento, chi l'ha impaginata e cosa succede svuotando; offre le info della
/// referenza e, se il box e' nel documento, Trova.
///
/// La parte pura (righe e testi) si prova sotto Node. La finestra, Info e Trova usano al momento
/// della chiamata le globali di indexNew ($, Modali, ReportIntegrita, schedaRef, indesignEvents,
/// docInLavorazione, Utility, pluginMiddleware, SchermataSegnalazioni, messaggioUtente,
/// showLoading, hideLoading), e InDesign lo chiedono solo li'.

const confronti = require('./confronti');
const reportConfrontoCsv = require('./reportIntegrita/csv');
const VersionePrecedente = require('./versionePrecedente');

function indesign() {
    return require('indesign');
}

const SvuotamentoPagina = {
    TESTO_SINCRONIZZA: "Sincronizza e svuota",
    AVVISO_FUORI_LISTA: "Referenza non presente in lista scaricata",
    LUNGHEZZA_DESCRIZIONE: 120,

    /// Le righe della finestra, dalla classificazione di ReportIntegrita.classificaPerSvuotamento.
    /// impaginati e' la lista di Menabo/getListaImpaginati (null se non si e' letta): da li'
    /// vengono la pagina sul server delle registrate altrove e l'autore. records e' la lista della
    /// lavorazione ({ recordInTracciato }), per descrizione e info. stessaReferenza e'
    /// ReportIntegrita._stessaReferenza, passata da chi chiama perche' qui non c'e'.
    ///
    /// Ogni riga: { tipo, codice, idRec, paginaServer, paginaDocumento, autore, record,
    /// descrizione, trovabile, dettagli, esito }. paginaServer o paginaDocumento sono null quando
    /// la referenza li' non c'e'.
    righe(daDecidere, impaginati, records, stessaReferenza) {
        const d = daDecidere || {};
        const elenco = (lista) => Array.isArray(lista) ? lista : [];
        const righe = [];
        elenco(d.spostate).forEach(r => righe.push({ tipo: "spostata", codice: r.codice, idRec: r.idRec, paginaServer: String(r.paginaServer), paginaDocumento: String(r.paginaDocumento) }));
        elenco(d.nonImpaginate).forEach(r => righe.push({ tipo: "nonImpaginata", codice: r.codice, idRec: r.idRec, paginaServer: String(r.paginaServer), paginaDocumento: null }));
        elenco(d.registrateAltrove).forEach(r => righe.push({ tipo: "registrataAltrove", codice: r.codice, idRec: r.idRec, paginaServer: null, paginaDocumento: String(r.pagina) }));
        elenco(d.nonRegistrate).forEach(r => righe.push({ tipo: "nonRegistrata", codice: r.codice, idRec: r.idRec, paginaServer: null, paginaDocumento: String(r.pagina) }));

        return righe.map(riga => {
            const sulServer = riga.tipo === "nonRegistrata" ? null : SvuotamentoPagina.impaginatoDi(impaginati, riga, stessaReferenza);
            if (riga.tipo === "registrataAltrove" && sulServer != null && sulServer.nomePagina != null && String(sulServer.nomePagina) !== "") {
                riga.paginaServer = String(sulServer.nomePagina);
            }
            riga.autore = SvuotamentoPagina.testoAutore(sulServer);
            riga.record = SvuotamentoPagina.recordDi(records, riga, stessaReferenza);
            riga.descrizione = riga.record != null ? reportConfrontoCsv.descrizioneComposta(riga.record) : "";
            riga.trovabile = riga.paginaDocumento != null;
            riga.dettagli = SvuotamentoPagina.testoDettagli(riga);
            riga.esito = SvuotamentoPagina.testoEsito(riga);
            return riga;
        });
    },

    /// La riga di Menabo/getListaImpaginati della referenza, o null.
    impaginatoDi(impaginati, riga, stessaReferenza) {
        if (!Array.isArray(impaginati)) {
            return null;
        }
        return impaginati.find(i => i != null
            && stessaReferenza({ codice: String(i.codiceGruppo), idRec: parseInt(i.idRec) || 0 }, riga)) || null;
    },

    /// Il record della referenza nella lista della lavorazione, o null se non c'e'. Con l'idRec
    /// conta quello; senza (la pre-analisi puo' dare 0) basta il codice gruppo.
    recordDi(records, riga, stessaReferenza) {
        if (!Array.isArray(records)) {
            return null;
        }
        const trovato = records.find(r => r != null && r.recordInTracciato != null
            && stessaReferenza({ codice: String(r.recordInTracciato["Scatto.CodiceGruppo"]), idRec: parseInt(r.recordInTracciato.idRec) || 0 }, riga));
        return trovato != null ? trovato.recordInTracciato : null;
    },

    /// Chi ha impaginato il box, o lo ha spostato per ultimo. Un box spostato dal Report
    /// Integrita' ha per autore il report, con l'utente che lo ha avviato.
    testoAutore(sulServer) {
        if (sulServer == null) {
            return "";
        }
        const nome = sulServer.nomeAutore != null ? String(sulServer.nomeAutore) : "";
        if (sulServer.autoreReport === true) {
            return nome !== "" ? "Report Integrità, avviato da " + nome : "Report Integrità";
        }
        return nome;
    },

    /// "Server: pag. 3 · Impaginato: pag. 5 · Autore: mrossi".
    testoDettagli(riga) {
        const server = riga.paginaServer != null ? "pag. " + riga.paginaServer
            : (riga.tipo === "nonRegistrata" ? "non registrato" : "altra pagina");
        const documento = riga.paginaDocumento != null ? "pag. " + riga.paginaDocumento : "nessuna pagina";
        const parti = ["Server: " + server, "Impaginato: " + documento];
        if (riga.autore) {
            parti.push("Autore: " + riga.autore);
        }
        return parti.join(" · ");
    },

    /// Cosa succede alla referenza con «Sincronizza e svuota».
    testoEsito(riga) {
        switch (riga.tipo) {
            case "spostata":
                return "Resta a pagina " + riga.paginaDocumento + ": il server viene aggiornato";
            case "nonImpaginata":
                return "Non è nel documento: esce dal server";
            case "registrataAltrove":
                return "Viene tolto con pagina " + riga.paginaDocumento;
            case "nonRegistrata":
                return "Non registrato sul server: viene tolto con pagina " + riga.paginaDocumento;
            default:
                return "";
        }
    },

    /// La frase in cima alla finestra.
    testoIntroduzione(pagine) {
        const elenco = (Array.isArray(pagine) ? pagine : []).map(p => String(p));
        const quali = elenco.length === 1 ? "pagina " + elenco[0] : "le pagine " + elenco.join(", ");
        return "Prima di svuotare " + quali + ": questi box non corrispondono fra impaginato e server.";
    },

    /// Il contenuto della finestra: un elemento, costruito un tag alla volta (in UXP un blocco
    /// di HTML annidato puo' non diventare un elemento), con i valori inseriti come testo.
    /// azioni: { info(riga), trova(riga) }.
    contenuto(righe, pagine, azioni) {
        //Il margine a destra tiene le icone lontane dalla barra di scorrimento del messaggio.
        const contenitore = $('<div></div>').css({ fontSize: '12px', color: 'black', paddingRight: '10px' });
        contenitore.append($('<div></div>').text(SvuotamentoPagina.testoIntroduzione(pagine)).css({ fontWeight: 'bold', marginBottom: '6px' }));

        righe.forEach((riga, indice) => {
            const blocco = $('<div></div>').css({ padding: '6px 0', borderTop: indice > 0 ? '1px solid #ddd' : 'none' });

            const testata = $('<div></div>').css({ display: 'flex', alignItems: 'center' });
            testata.append($('<div></div>').text(riga.codice).css({ fontWeight: 'bold', flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }));
            if (riga.record != null) {
                testata.append(SvuotamentoPagina._icona("Info", "images/info.png", () => azioni.info(riga)));
            }
            if (riga.trovabile) {
                testata.append(SvuotamentoPagina._icona("Trova", "images/leggiLog.png", () => azioni.trova(riga)));
            }
            blocco.append(testata);

            if (riga.record != null) {
                if (riga.descrizione !== "") {
                    const descrizione = $('<div></div>').text(SchermataSegnalazioni.abbrevia(riga.descrizione, SvuotamentoPagina.LUNGHEZZA_DESCRIZIONE)).css({ fontSize: '11px', color: '#666' });
                    //Il nostro suggerimento, non l'attributo title: InDesign ne mostrerebbe un secondo.
                    Tooltip.impostaTooltip(descrizione[0], riga.descrizione);
                    blocco.append(descrizione);
                }
            }
            else {
                blocco.append($('<div></div>').text(SvuotamentoPagina.AVVISO_FUORI_LISTA).css({ fontSize: '11px', color: 'darkorange' }));
            }

            blocco.append($('<div></div>').text(riga.dettagli).css({ fontSize: '11px', color: '#333' }));
            blocco.append($('<div></div>').text("→ " + riga.esito).css({ fontSize: '11px', color: '#0b5394' }));
            contenitore.append(blocco);
        });

        contenitore.append($('<div></div>').text("«" + SvuotamentoPagina.TESTO_SINCRONIZZA + "» allinea il server all'impaginato per questi box, poi svuota.").css({ marginTop: '8px' }));
        return contenitore;
    },

    /// Un'icona cliccabile della riga, fatta come quelle delle righe del Report Integrita'. Il
    /// gestore e' sull'elemento: il riquadro della conferma ferma la propagazione dei clic, e un
    /// gestore delegato su document non scatterebbe. Per lo stesso motivo il suggerimento non
    /// sparirebbe da solo al clic (Tooltip lo nasconde su un clic che arriva a document): lo
    /// nasconde l'icona.
    _icona(titolo, immagine, alClic) {
        const img = document.createElement("img");
        img.src = immagine;
        img.alt = titolo;
        Tooltip.impostaTooltip(img, titolo);
        img.style.height = "18px";
        img.style.marginLeft = "6px";
        img.style.cursor = "pointer";
        img.style.flex = "0 0 auto";
        img.addEventListener("click", () => {
            try {
                Tooltip.nascondiTooltip();
                alClic();
            }
            catch (e) {
                console.error("Code SVP-01 " + titolo + " non riuscito:", e);
            }
        });
        return $(img);
    },

    /// Le info della referenza, le stesse della scheda ref, nel riquadro del Report Integrita':
    /// sopra la finestra, che sta al livello delle conferme.
    apriInfo(riga) {
        if (riga == null || riga.record == null) {
            return false;
        }
        schedaRef.preparaInfoIspezioneDelDato(riga.record, riga.record);
        ReportIntegrita._apriOverlayInfoReport("Info dati referenza");
        $("#confrontoInfoOverlay").css("z-index", String(Modali.LIVELLO_CONFERMA + 1));
        return true;
    },

    /// Porta alla pagina del box e lo seleziona, senza aprire la scheda ref: mentre la finestra
    /// e' aperta gli eventi sono fermi, e la selezione si da' per gia' vista, cosi' alla
    /// ripartenza il ciclo non la prende per una ref appena scelta (che chiuderebbe le finestre).
    trova(riga) {
        const candidati = VersionePrecedente.gruppiConDnaSulLivello(docInLavorazione, "InPagina", Utility.getDnaOfBox, [String(riga.paginaDocumento)]);
        const trovato = candidati.find(c => ReportIntegrita._stessaReferenza({ codice: String(c.dna.codice_gruppo), idRec: parseInt(c.dna.idRec) || 0 }, riga));
        if (trovato == null) {
            messaggioUtente("Code SVP-02 Box " + riga.codice + " non trovato a pagina " + riga.paginaDocumento, "warning", false, 5);
            return false;
        }
        const { app } = indesign();
        const box = trovato.gruppo;
        app.activeWindow.activePage = box.parentPage;
        app.selection = [box];
        SchermataSegnalazioni.centraSullaSelezione(app.activeWindow);
        indesignEvents.accettaSelezione([box.id]);
        return true;
    },

    /// La selezione di adesso come gia' vista dal ciclo degli eventi: va fatto prima di farli
    /// ripartire, altrimenti un box trovato o scelto a mano con la finestra aperta aprirebbe la
    /// scheda ref al primo giro.
    _accettaSelezioneCorrente() {
        try {
            const { app } = indesign();
            const ids = [];
            for (let i = 0; i < app.selection.length; i++) {
                ids.push(app.selection[i].id);
            }
            indesignEvents.accettaSelezione(ids);
        }
        catch (e) {
            console.warn("Code SVP-03 Selezione non accettata:", e);
        }
    },

    /// Prima di svuotare, le referenze su cui documento e server non concordano: se ce ne sono,
    /// la finestra. Restituisce { spostate } - le referenze da portare sul server alla pagina
    /// dove stanno -, null se l'operatore annulla, false se ci si ferma per un errore gia' detto
    /// (un "annullato" dopo lo coprirebbe).
    ///
    /// Per riconoscere le spostate e le non impaginate serve la mappa di tutto il documento,
    /// letta solo se la pre-analisi ha referenze presenti solo sul server. Se non si legge ci si
    /// ferma: senza, ogni spostata passerebbe per non impaginata e il suo record si cancellerebbe.
    async decidi(preAnalisi, pagine) {
        const pagineDaSvuotare = pagine.map(p => p.toString());
        const ciSonoSoloSulServer = (preAnalisi.resultPaginas || []).some(p =>
            ReportIntegrita._codiciConId(p.codiciPresentiSoloSulServerConId, p.codiciPresentiSoloSulServer).length > 0);

        let listaDocumento = null;
        if (ciSonoSoloSulServer) {
            showLoading("Ricerca delle referenze spostate in altre pagine...");
            const mappaDocumento = await confronti.mappaturaImpaginato(null, false, true);
            if (mappaDocumento == null) {
                messaggioUtente("Code SVP-04 Il documento non si legge: svuotamento annullato", "error");
                return false;
            }
            listaDocumento = confronti.semplificazioneMappaImpaginato(mappaDocumento);
        }
        const daDecidere = ReportIntegrita.classificaPerSvuotamento(preAnalisi.resultPaginas, listaDocumento, pagineDaSvuotare);
        const quante = daDecidere.spostate.length + daDecidere.nonImpaginate.length + daDecidere.registrateAltrove.length + daDecidere.nonRegistrate.length;
        if (quante === 0) {
            return { spostate: [] };
        }

        const impaginati = await Utility.getListaCodiciImpaginati({ nullSeFallisce: true });
        const righe = SvuotamentoPagina.righe(daDecidere, impaginati, pluginMiddleware.recordsDellaLavorazione(), ReportIntegrita._stessaReferenza);
        const contenuto = SvuotamentoPagina.contenuto(righe, pagine, {
            info: (riga) => SvuotamentoPagina.apriInfo(riga),
            trova: (riga) => SvuotamentoPagina.trova(riga)
        });

        hideLoading();
        //Eventi fermi mentre la finestra e' aperta: un clic su un box in InDesign aprirebbe la
        //scheda ref e chiuderebbe la finestra (Modali.closeAllModal).
        indesignEvents.setBusy(true);
        let scelta = null;
        try {
            scelta = await Modali.confirmCustom(contenuto, SvuotamentoPagina.TESTO_SINCRONIZZA, "sincronizza");
        }
        finally {
            //Le icone spariscono con la finestra senza che il mouse ne esca: il loro suggerimento
            //resterebbe acceso.
            Tooltip.nascondiTooltip();
            $("#confrontoInfoOverlay").remove();
            SvuotamentoPagina._accettaSelezioneCorrente();
            indesignEvents.setBusy(false);
        }
        if (scelta == null || !scelta.result) {
            return null;
        }
        return { spostate: daDecidere.spostate };
    }
};

module.exports = SvuotamentoPagina;
