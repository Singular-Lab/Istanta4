/// I20-1089: i meta del box - quello che questa lavorazione ha cambiato rispetto al dato, per
/// l'impaginazione del box aperto - e l'interfaccia che li mostra. L'icona blu accanto al segnalino
/// della scheda ne dice il numero e apre la finestra: per ogni meta il campo, il valore originale e
/// quello modificato. Solo i meta dei testi (i campi compilati) si tolgono da qui; primarie e
/// secondarie, foto, foto extra decise per la lavorazione ed elementi in noRender si mostrano
/// soltanto, e si tolgono dalle loro schermate. Un meta da verificare (I20-1088) porta alle
/// segnalazioni. Da qui si applica anche un meta nuovo su un campo che non ne ha: rimozioni e meta
/// nuovi restano in sospeso fino a Salva, che li manda tutti con una richiesta sola e reimpagina
/// il box.
///
/// Non e' un modulo a se': schedaRef.js lo mescola nel proprio oggetto con Object.assign, come
/// reperimentoFoto/schedaFoto.js, e ogni this qui dentro e' schedaRef. La parte pura (l'elenco dei
/// meta, i campi per un meta nuovo, la richiesta) si prova sotto Node; il resto parla con InDesign.

const confronti = require('./confronti');

/// StatoSelezioneFoto del server, come lo legge l'operatore.
const STATI_SELEZIONE = { "0": "non selezionata", "1": "primaria", "2": "secondaria" };

/// TipoElementoBox del server, per gli elementi in noRender.
const TIPI_ELEMENTO = { "1": "campo", "2": "logo", "3": "foto extra", "4": "etichetta", "5": "foto" };

function senzaChiave(label) {
    const testo = String(label == null ? "" : label);
    return typeof Utility !== "undefined" && Utility != null && typeof Utility.parseLabel === "function"
        ? Utility.parseLabel(testo)
        : testo.split("$")[0];
}

const metaDelBox = {

    /// Il record del primario fra quelli della scheda, o null.
    primarioDeiRecord(records) {
        const primario = (records || []).find(r => r != null && r.recordInTracciato != null && r.recordInTracciato.StatoSelezione == 1);
        return primario != null ? primario.recordInTracciato : null;
    },

    /// Tutti i meta del box, nell'ordine in cui la finestra li mostra: i testi, le primarie/secondarie
    /// e le foto di ogni referenza del gruppo, le foto extra decise per la lavorazione, gli elementi in
    /// noRender. Ogni voce: tipo, etichetta, originale, modificato, rimovibile (solo i testi) e, per i
    /// testi, il campo intero e se e' da verificare; per le foto se il meta viene da una lavorazione
    /// passata (ereditata).
    vociMetaDelBox(records, ignoraVersione = confronti.ignoraVersioneMeta()) {
        const me = this;
        const rec = this.primarioDeiRecord(records);
        if (rec == null) {
            return [];
        }
        const voci = [];

        const daVerificare = new Set(confronti.differenzeDeiMeta(rec, ignoraVersione).map(d => d.campo));
        (Array.isArray(rec.testiDalBox) ? rec.testiDalBox : []).forEach(function (stato) {
            if (stato == null || stato.label == null || String(stato.label) === "" || stato.allineato === true) {
                return;
            }
            const campo = String(stato.label);
            voci.push({
                tipo: "testo",
                campo: campo,
                etichetta: senzaChiave(campo),
                originale: confronti.testoLeggibile(stato.contenutoServer),
                modificato: confronti.testoLeggibile(stato.contenuto),
                rimovibile: true,
                daVerificare: daVerificare.has(campo)
            });
        });

        (records || []).forEach(function (record) {
            const sostituzioni = record != null && record.recordInTracciato != null ? record.recordInTracciato.metaFoto : null;
            (Array.isArray(sostituzioni) ? sostituzioni : []).forEach(function (sostituzione) {
                if (sostituzione == null) {
                    return;
                }
                const selezione = sostituzione.tipo === "selezione";
                const leggi = function (valore) {
                    if (valore == null || String(valore) === "") {
                        return selezione ? "non selezionata" : "(nessuna)";
                    }
                    return selezione ? (STATI_SELEZIONE[String(valore)] || String(valore)) : String(valore);
                };
                voci.push({
                    tipo: selezione ? "selezione" : "foto",
                    etichetta: (selezione ? "Primaria/secondaria " : "Foto ") + (sostituzione.codRef || ""),
                    originale: leggi(sostituzione.originale),
                    modificato: leggi(sostituzione.modificato),
                    rimovibile: false,
                    ereditata: sostituzione.ereditata === true
                });
            });
        });

        (Array.isArray(rec.extraLavorazione) ? rec.extraLavorazione : []).forEach(function (voce) {
            if (voce == null) {
                return;
            }
            const descritta = typeof me.descriviExtraLavorazione === "function" ? me.descriviExtraLavorazione(voce) : String(voce.sigla || "");
            const sigla = voce.sigla == null ? "" : String(voce.sigla);
            voci.push({
                tipo: "extra",
                etichetta: "Foto extra " + sigla,
                originale: voce.nomeServer ? String(voce.nomeServer) : "come nel dato",
                modificato: descritta.startsWith(sigla + ": ") ? descritta.substring(sigla.length + 2) : descritta,
                rimovibile: false
            });
        });

        (Array.isArray(rec.noRenderElementi) ? rec.noRenderElementi : []).forEach(function (elemento) {
            if (elemento == null) {
                return;
            }
            const nome = elemento.nome || elemento.chiave || "";
            const tipo = TIPI_ELEMENTO[String(elemento.tipo)];
            voci.push({
                tipo: "noRender",
                etichetta: senzaChiave(nome) + (tipo ? " (" + tipo + ")" : ""),
                originale: "nel box",
                modificato: "in noRender",
                rimovibile: false
            });
        });

        return voci;
    },

    /// Quanti meta ha il box: il numero dell'icona blu.
    numeroMetaDelBox(records) {
        return this.vociMetaDelBox(records).length;
    },

    /// I campi compilati del primario su cui si puo' applicare un meta nuovo: con un testo, senza un
    /// meta. Uno per campo. I20-1090: anche la descrizione, come ogni altro campo.
    campiPerNuovoMeta(records) {
        const rec = this.primarioDeiRecord(records);
        if (rec == null || !Array.isArray(rec.compiledFields)) {
            return [];
        }
        const conMeta = new Set((Array.isArray(rec.testiDalBox) ? rec.testiDalBox : [])
            .filter(s => s != null && s.label != null)
            .map(s => String(s.label).toLowerCase()));
        const visti = new Set();
        return rec.compiledFields.filter(function (campo) {
            if (campo == null || campo.labelName == null || String(campo.labelName) === "" || typeof campo.content !== "string") {
                return false;
            }
            const chiave = String(campo.labelName).toLowerCase();
            if (conMeta.has(chiave) || visti.has(chiave)) {
                return false;
            }
            visti.add(chiave);
            return true;
        });
    },

    /// La richiesta unica per il server dalle modifiche in sospeso: i campi da cui togliere il meta e
    /// i meta nuovi ({ campo, contenuto, contenutoServer }). Null se non c'e' niente da mandare.
    richiestaModificheMeta(daRimuovere, daCreare) {
        const me = this;
        const voci = [];
        (daRimuovere || []).forEach(function (campo) {
            if (campo != null && String(campo) !== "") {
                voci.push({ label: String(campo), azione: me.AZIONE_TESTO_DAL_BOX.rimuovi });
            }
        });
        (daCreare || []).forEach(function (nuovo) {
            if (nuovo == null || nuovo.campo == null || String(nuovo.campo) === "") {
                return;
            }
            voci.push({
                label: String(nuovo.campo),
                azione: me.AZIONE_TESTO_DAL_BOX.crea,
                contenuto: nuovo.contenuto == null ? "" : String(nuovo.contenuto),
                contenutoServer: nuovo.contenutoServer == null ? "" : String(nuovo.contenutoServer)
            });
        });
        return voci.length > 0 ? { voci: voci } : null;
    },

    /* ---------- l'attesa delle azioni ---------- */

    /// I20-1089: fra il clic e l'effetto di un'azione che chiama il server c'e' un'attesa, e un
    /// secondo clic la rifarebbe. Il pulsante si segna "in corso" e si mostra il caricamento, che
    /// sta sopra le finestre e ferma anche gli altri clic. Falso se il pulsante era gia' in corso:
    /// quel clic non deve fare niente. Il segno si tiene in un attributo perche' in UXP un pulsante
    /// disattivato non e' detto che ignori il clic.
    inizioAttesa(pulsante, testo = "Applicazione in corso...") {
        if (pulsante != null && typeof pulsante.attr === "function") {
            if (pulsante.attr("data-incorso") === "1") {
                return false;
            }
            pulsante.attr("data-incorso", "1");
        }
        if (typeof showLoading === "function") {
            showLoading(testo);
        }
        return true;
    },

    /// La fine dell'attesa: via il caricamento e il segno, anche se l'azione e' fallita.
    fineAttesa(pulsante) {
        if (typeof hideLoading === "function") {
            hideLoading();
        }
        if (pulsante != null && typeof pulsante.attr === "function") {
            pulsante.attr("data-incorso", "0");
        }
    },

    /// Un'azione con la sua attesa. Falso se il pulsante era gia' in corso e l'azione non e' partita.
    async eseguiConAttesa(pulsante, testo, azione) {
        if (!this.inizioAttesa(pulsante, testo)) {
            return false;
        }
        try {
            await azione();
            return true;
        }
        finally {
            this.fineAttesa(pulsante);
        }
    },

    /* ---------- in InDesign ---------- */

    /// L'icona blu accanto al segnalino: quanti meta ha il box, e la finestra per vederli. C'e'
    /// sempre, anche senza meta, perche' da li' se ne applica uno nuovo. Stessa misura del segnalino:
    /// e' quella che la barra #referenza, alta 25px, tollera.
    aggiornaIconaMeta() {
        try {
            $("#metaBoxButton").remove();
            const me = this;
            const quanti = this.numeroMetaDelBox(this.schedeRefDati);

            const icona = $('<span id="metaBoxButton"></span>');
            icona.text(quanti > 0 ? String(quanti) : "");
            icona.css({
                "display": "inline-block",
                "height": "16px",
                "min-width": "16px",
                "line-height": "16px",
                "padding": "0 3px",
                "box-sizing": "border-box",
                "text-align": "center",
                "font-size": "10px",
                "font-weight": "700",
                "border-radius": "3px",
                "background-color": "#0d47a1",
                "color": "#fff",
                "margin-right": "8px",
                "cursor": "pointer",
                "flex": "0 0 auto"
            });
            Tooltip.impostaTooltip(icona[0], quanti > 0
                ? (quanti === 1 ? "1 meta di questa lavorazione sul box" : quanti + " meta di questa lavorazione sul box") + " - clicca per vederli"
                : "Nessun meta sul box - clicca per applicarne uno");
            icona.on("click", function () {
                me.mostraFinestraMeta();
            });

            $("#codiceRef").prepend(icona);
        }
        catch (e) {
            console.error("Code SRF-119 Icona dei meta non aggiornata: " + e);
        }
    },

    /// Il testo da cui parte un meta nuovo: quello del campo nel box, nella forma del campo compilato
    /// (con i tag degli stili); se il box non ha il campo, quello del dato.
    testoPerNuovoMeta(campoCompilato) {
        try {
            //I20-1090: la descrizione con i nomi completi degli stili, come il suo meta dalla scheda.
            if (campoCompilato != null && senzaChiave(campoCompilato.labelName).toLowerCase() === "descrizione") {
                const testo = this.testoDescrizioneDelBoxPerMeta();
                if (testo != null) {
                    return testo;
                }
            }
            const box = this.refSelected != null ? this.refSelected.item : null;
            const campo = box != null && box.isValid ? Utility.getFieldByLabel(Utility.parseLabel(campoCompilato.labelName), box) : null;
            if (campo != null) {
                return this.testoDalBoxPerIlServer(campoCompilato, campo.contents, TestoTag.componiStringTagFromInndTextFrame(campo));
            }
        }
        catch (e) {
            console.warn("Testo del box per il meta nuovo non letto: " + e);
        }
        return campoCompilato != null && campoCompilato.content != null ? String(campoCompilato.content) : "";
    },

    /// Salva le modifiche ai meta: una richiesta sola, poi la scheda si riscarica (i meta si
    /// applicano sul server) e il box si reimpagina come con Reimpagina. Vero se il server le ha
    /// registrate.
    async salvaModificheMeta(richiesta) {
        if (richiesta == null) {
            return false;
        }
        const registrata = await this.salvaTestiDalBox(richiesta);
        if (!registrata) {
            return false;
        }
        await this.riscaricaDopoIlMeta();
        this.applicaReimpaginazione();
        messaggioUtente("Meta del box salvati: il box si reimpagina", "success", false, 4);
        return true;
    },

    /// La finestra dei meta del box. Le modifiche restano in sospeso finche' non si salva: chiudere
    /// con la X non manda niente.
    mostraFinestraMeta() {
        try {
            const me = this;
            const daRimuovere = new Set();
            const daCreare = [];

            //Il contenitore e i suoi tre riquadri si creano uno per uno, con un tag solo ciascuno, e si
            //tengono in mano: scritti come un blocco di HTML, in UXP non diventavano elementi (jQuery
            //restituiva due nodi senza tag e nessun figlio, misurato in collaudo) e la finestra si
            //apriva vuota, senza errori. Non riportarli a un blocco di HTML.
            const contenuto = $('<div></div>').css({ "width": "100%", "display": "flex", "flex-direction": "column", "gap": "8px", "font-family": "Arial, sans-serif", "color": "#2c2c2c" });
            const elenco = $('<div></div>').css({ "width": "100%", "display": "flex", "flex-direction": "column", "gap": "6px" });
            const nuovo = $('<div></div>').css({ "width": "100%", "display": "none", "flex-direction": "column", "gap": "4px", "border-top": "1px solid #ddd", "padding-top": "8px" });
            const azioni = $('<div></div>').css({ "width": "100%", "display": "flex", "gap": "6px", "justify-content": "flex-end", "border-top": "1px solid #ddd", "padding-top": "8px" });
            contenuto.append(elenco).append(nuovo).append(azioni);

            const riga = function (voce) {
                const r = $('<div></div>');
                r.css({ "padding": "4px 0 4px 8px", "border-left": "3px solid " + (voce.daVerificare ? "#b21d1d" : "#0d47a1"), "font-size": "12px" });
                const titolo = $('<div></div>').text(voce.etichetta + (voce.ereditata ? " (da una lavorazione passata)" : ""));
                titolo.css({ "font-weight": "700" });
                r.append(titolo);
                [["Originale", voce.originale], ["Modificato", voce.modificato]].forEach(function (coppia) {
                    const v = $('<div></div>');
                    v.css({ "padding-left": "8px" });
                    v.append($('<span></span>').text(coppia[0] + ": ").css({ "font-weight": "700" }));
                    v.append($('<span></span>').text(coppia[1] === "" ? "(vuoto)" : coppia[1]));
                    r.append(v);
                });
                return r;
            };

            const ridisegna = function () {
                elenco.empty();
                const voci = me.vociMetaDelBox(me.schedeRefDati);
                if (voci.length === 0 && daCreare.length === 0) {
                    elenco.append($('<div></div>').text("Nessun meta sul box.").css({ "font-size": "12px", "color": "#767676" }));
                }
                voci.forEach(function (voce) {
                    const r = riga(voce);
                    const barra = $('<div></div>');
                    barra.css({ "display": "flex", "gap": "6px", "justify-content": "flex-end", "margin-top": "4px" });
                    if (voce.daVerificare) {
                        const avviso = $('<span></span>').text("Da verificare: il server e' cambiato da quando e' stato scelto");
                        avviso.css({ "font-size": "11px", "color": "#b21d1d", "margin-right": "auto" });
                        barra.append(avviso);
                        const vai = me.pulsanteFinestra("Vai a Segnalazioni", "Apre la finestra delle differenze del box, dove il meta si aggiorna o si lascia per il server");
                        vai.on("click", async function () {
                            $("#popupCloseButton").trigger("click");
                            await me.mostraModalSegnalazioni();
                        });
                        barra.append(vai);
                    }
                    if (voce.rimovibile) {
                        const segnato = daRimuovere.has(voce.campo);
                        if (segnato) {
                            r.css({ "opacity": "0.5", "text-decoration": "line-through" });
                        }
                        const rimuovi = me.pulsanteFinestra(segnato ? "Tieni" : "Rimuovi meta",
                            segnato ? "Il meta resta" : "Il meta si toglie quando salvi: il campo torna al testo del server");
                        rimuovi.on("click", function () {
                            if (daRimuovere.has(voce.campo)) {
                                daRimuovere.delete(voce.campo);
                            }
                            else {
                                daRimuovere.add(voce.campo);
                            }
                            ridisegna();
                        });
                        barra.append(rimuovi);
                    }
                    if (barra.children().length > 0) {
                        r.append(barra);
                    }
                    elenco.append(r);
                });
                daCreare.forEach(function (meta, indice) {
                    const r = riga({ etichetta: senzaChiave(meta.campo) + " (nuovo)", originale: confronti.testoLeggibile(meta.contenutoServer), modificato: confronti.testoLeggibile(meta.contenuto) });
                    const togli = me.pulsanteFinestra("Togli", "Il meta nuovo non si applica");
                    togli.on("click", function () {
                        daCreare.splice(indice, 1);
                        ridisegna();
                    });
                    r.append($('<div></div>').css({ "display": "flex", "justify-content": "flex-end", "margin-top": "4px" }).append(togli));
                    elenco.append(r);
                });
                salva.prop("disabled", daRimuovere.size === 0 && daCreare.length === 0);
            };

            //Applica nuovo meta: si sceglie il campo, il testo parte da quello del box e si modifica tutto.
            const apriNuovo = function () {
                nuovo.empty();
                const giaNuovi = new Set(daCreare.map(m => String(m.campo).toLowerCase()));
                const campi = me.campiPerNuovoMeta(me.schedeRefDati).filter(c => !giaNuovi.has(String(c.labelName).toLowerCase()));
                if (campi.length === 0) {
                    nuovo.append($('<div></div>').text("Tutti i campi hanno gia' un meta.").css({ "font-size": "12px", "color": "#767676" }));
                    nuovo.css("display", "flex");
                    return;
                }
                const scelta = $('<select style="width: 100%;"></select>');
                campi.forEach(function (campo, indice) {
                    scelta.append($('<option></option>').attr("value", String(indice)).text(senzaChiave(campo.labelName)));
                });
                const testo = $('<textarea style="width: 100%; height: 60px; box-sizing: border-box; background-color: white; color: black;"></textarea>');
                const riempi = function () {
                    const campo = campi[parseInt(scelta.val(), 10) || 0];
                    testo.val(me.testoPerNuovoMeta(campo));
                };
                scelta.on("change", riempi);
                riempi();
                const aggiungi = me.pulsanteFinestra("Aggiungi", "Il meta nuovo si applica quando salvi");
                aggiungi.on("click", function () {
                    const campo = campi[parseInt(scelta.val(), 10) || 0];
                    daCreare.push({ campo: campo.labelName, contenuto: String(testo.val() == null ? "" : testo.val()), contenutoServer: campo.content });
                    nuovo.empty().css("display", "none");
                    ridisegna();
                });
                nuovo.append($('<div></div>').text("Campo").css({ "font-size": "12px", "font-weight": "700" }));
                nuovo.append(scelta);
                nuovo.append($('<div></div>').text("Testo del meta").css({ "font-size": "12px", "font-weight": "700" }));
                nuovo.append(testo);
                nuovo.append($('<div></div>').css({ "display": "flex", "justify-content": "flex-end" }).append(aggiungi));
                nuovo.css("display", "flex");
            };

            const applicaNuovo = this.pulsanteFinestra("Applica nuovo meta", "Sceglie un campo senza meta e il testo che deve avere in questa lavorazione");
            applicaNuovo.on("click", apriNuovo);
            const salva = this.pulsanteFinestra("Salva", "Manda tutte le modifiche e reimpagina il box");
            salva.on("click", async function () {
                const richiesta = me.richiestaModificheMeta([...daRimuovere], daCreare);
                if (richiesta == null) {
                    return;
                }
                //Il caricamento resta fino alla reimpaginazione: un secondo Salva non riparte.
                await me.eseguiConAttesa(salva, "Salvataggio dei meta...", async function () {
                    $("#popupCloseButton").trigger("click");
                    await me.salvaModificheMeta(richiesta);
                });
            });
            azioni.append(applicaNuovo).append(salva);

            ridisegna();
            Modali.popup("Meta del box", contenuto, "lg");
        }
        catch (e) {
            console.error("Code SRF-120 Finestra dei meta non aperta: " + e);
            messaggioUtente("Code SRF-120 Finestra dei meta non aperta: " + e.message, "error", false, 5);
        }
    },

    /* ---------- I20-1090: la descrizione nei meta ---------- */

    /// Lo stato del meta della descrizione nel primario (come in testiDalBox), o null se non c'e'.
    statoMetaDescrizione(records) {
        const rec = this.primarioDeiRecord(records);
        const stati = rec != null && Array.isArray(rec.testiDalBox) ? rec.testiDalBox : [];
        return stati.find(s => s != null && s.label != null && s.allineato !== true && senzaChiave(s.label).toLowerCase() === "descrizione") || null;
    },

    /// La scelta per il box sulla riga della descrizione, da dove sta la differenza: le sole
    /// fondamentali si revisionano, i soli altri tratti vanno nel meta, tutti e due fanno le due
    /// cose. Se non si riconosce dove sta (la preanalisi l'ha vista, il confronto per tratti no), il
    /// meta: tiene la descrizione del box senza toccare il dato.
    sceltaDelBoxPerLaDescrizione(dove) {
        const fondamentali = dove != null && dove.fondamentali === true;
        const altri = dove != null && dove.altri === true;
        if (fondamentali && altri) {
            return "revisionaEMeta";
        }
        return fondamentali ? "descrizioneBox" : "impostaMetaDescrizione";
    },

    /// Dove sta la differenza fra la descrizione del box aperto e quella del server, o null se non
    /// si legge.
    dovePortaLaDescrizioneDelBox() {
        try {
            const campoCompilato = this.campoDescrizioneCompilatoDelPrimario(this.schedeRefDati);
            const box = this.refSelected != null ? this.refSelected.item : null;
            const campo = box != null && box.isValid ? Utility.getFieldByLabel("descrizione", box) : null;
            if (campoCompilato == null || campo == null) {
                return null;
            }
            return confronti.dovePortaLaDescrizione(TestoTag.trattiDiStileDelCampo(campo), TestoTag.parseContent(String(campoCompilato.content)),
                function (stile) {
                    const universale = pluginMiddleware.getNameStileUniversale(stile);
                    return universale != null ? universale.fondamentale : null;
                });
        }
        catch (e) {
            console.warn("Code SRF-121 Differenza della descrizione non classificata: " + e);
            return null;
        }
    },

    /// La descrizione del box aperto come testo con i tag, con il nome completo degli stili: il
    /// contenuto del suo meta. null se il box non ha la descrizione.
    testoDescrizioneDelBoxPerMeta() {
        const box = this.refSelected != null ? this.refSelected.item : null;
        const campo = box != null && box.isValid ? Utility.getFieldByLabel("descrizione", box) : null;
        return campo != null ? TestoTag.stringaConTagDeiTratti(TestoTag.trattiDiStileDelCampo(campo)) : null;
    },

    /// "Imposta come meta" e "Applica descrizione del box nel meta": la descrizione del box diventa il
    /// meta, con valore originale quella che il server compone ora. Il box non cambia; la scheda si
    /// riscarica. Vero se il server l'ha registrato.
    async impostaDescrizioneComeMeta() {
        const campo = this.campoDescrizioneCompilatoDelPrimario(this.schedeRefDati);
        const testo = this.testoDescrizioneDelBoxPerMeta();
        if (campo == null || testo == null) {
            messaggioUtente("Code SRF-122 Descrizione del box o del server non trovata: il meta non e' stato impostato", "error", false, 5);
            return false;
        }
        const registrata = await this.salvaTestiDalBox({ voci: [{ label: campo.labelName, azione: this.AZIONE_TESTO_DAL_BOX.crea, contenuto: testo, contenutoServer: String(campo.content) }] });
        if (!registrata) {
            return false;
        }
        await this.riscaricaDopoIlMeta();
        messaggioUtente("Descrizione del box impostata come meta", "success", false, 4);
        return true;
    },

    /// Dopo "Revisiona e imposta nei meta", a revisione salvata: la scheda si riscarica, cosi' il
    /// valore originale del meta e' la descrizione che il server compone dopo la revisione; se il
    /// server compone gia' il testo del box, il meta non serve.
    async metaDescrizioneDopoLaRevisione(testo) {
        if (testo == null) {
            return false;
        }
        if (!(await this.riscaricaDopoIlMeta())) {
            return false;
        }
        const campo = this.campoDescrizioneCompilatoDelPrimario(this.schedeRefDati);
        if (campo == null) {
            return false;
        }
        if (String(campo.content) === String(testo)) {
            return true;
        }
        return await this.salvaTestiDalBox({ voci: [{ label: campo.labelName, azione: this.AZIONE_TESTO_DAL_BOX.crea, contenuto: String(testo), contenutoServer: String(campo.content) }] });
    },

    /// "Aggiorna descrizione nel meta" e "Aggiorna il meta con il box": il meta prende il testo del
    /// box; il valore originale resta quello che il server compone ora.
    async aggiornaMetaDescrizioneColBox() {
        const stato = this.statoMetaDescrizione(this.schedeRefDati);
        const testo = this.testoDescrizioneDelBoxPerMeta();
        if (stato == null || testo == null) {
            return false;
        }
        const registrata = await this.salvaTestiDalBox({ voci: [{ label: String(stato.label), azione: this.AZIONE_TESTO_DAL_BOX.crea, contenuto: testo,
            contenutoServer: stato.contenutoServerAttuale == null ? "" : String(stato.contenutoServerAttuale) }] });
        if (!registrata) {
            return false;
        }
        await this.riscaricaDopoIlMeta();
        messaggioUtente("Meta della descrizione aggiornato al box", "success", false, 4);
        return true;
    },

    /// "Rimuovi descrizione nel meta": come Rimuovi dall'interfaccia dei meta, la scheda si riscarica
    /// e il box si reimpagina con la descrizione del server.
    async rimuoviMetaDescrizione() {
        const stato = this.statoMetaDescrizione(this.schedeRefDati);
        return stato != null ? await this.salvaModificheMeta(this.richiestaModificheMeta([String(stato.label)], [])) : false;
    },

    /// Nella schermata di modifica: con la descrizione nei meta i suoi campi sono in sola lettura, la
    /// revisione non parte (InputEditController.descrizioneNelMeta) e "Applica descrizione da server"
    /// non si offre, perche' scriverebbe il meta. Poi i pulsanti del meta.
    applicaStatoMetaDescrizione() {
        const me = this;
        const conMeta = this.statoMetaDescrizione(this.schedeRefDati) != null;
        const controller = this.editRefFieldController;
        if (controller != null) {
            controller.descrizioneNelMeta = conMeta;
            controller.dopoModifica = function () {
                me.aggiornaPulsantiMetaDescrizione();
            };
            controller.checkStato();
        }
        if (conMeta) {
            $('#editReferenza textarea[labelcorrispondente="descrizione"]').prop("readonly", true).css("opacity", "0.6");
            $("#applicaDescrizioneDaServer").hide();
        }
        this.aggiornaPulsantiMetaDescrizione();
    },

    /// I pulsanti del meta della descrizione, accanto ad "Applica descrizione da server". Senza meta:
    /// "Applica descrizione del box nel meta" se il box e' diverso dal server e i campi sono ancora
    /// quelli del box (sparisce appena se ne cambia uno). Con il meta: "Rimuovi descrizione nel meta"
    /// e, se il box e' diverso dal meta, "Aggiorna descrizione nel meta".
    aggiornaPulsantiMetaDescrizione() {
        try {
            const contenitore = $("#metaDescrizioneScheda");
            if (contenitore.length === 0) {
                return;
            }
            contenitore.empty();
            const me = this;
            const aggiungi = function (testo, azione, ridisegna) {
                const pulsante = $('<sp-action-button style="font-size: 12px; margin: 4px 6px 8px 0px;"></sp-action-button>').text(testo);
                pulsante.on("click", async function () {
                    //I20-1089: con il caricamento, e un clic solo per volta.
                    await me.eseguiConAttesa(pulsante, "Applicazione in corso...", async function () {
                        if (await azione() && ridisegna) {
                            me.dimenticaSegnalazioni();
                            await me.selectSchedaRef(1);
                        }
                    });
                });
                contenitore.append(pulsante);
            };

            const stato = this.statoMetaDescrizione(this.schedeRefDati);
            if (stato == null) {
                const controller = this.editRefFieldController;
                const modificata = controller != null && typeof controller.descrizioneModificata === "function" && controller.descrizioneModificata();
                if (this.descrizioneDaAllineareNellaScheda === true && !modificata) {
                    aggiungi("Applica descrizione del box nel meta", () => me.impostaDescrizioneComeMeta(), true);
                }
                return;
            }
            aggiungi("Rimuovi descrizione nel meta", () => me.rimuoviMetaDescrizione(), false);
            const testo = this.testoDescrizioneDelBoxPerMeta();
            if (testo != null && testo !== String(stato.contenuto == null ? "" : stato.contenuto)) {
                aggiungi("Aggiorna descrizione nel meta", () => me.aggiornaMetaDescrizioneColBox(), true);
            }
        }
        catch (e) {
            console.error("Code SRF-123 Pulsanti del meta della descrizione non aggiornati: " + e);
        }
    }
};

module.exports = metaDelBox;
