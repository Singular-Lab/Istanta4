/// I20-1063, lotto 3: la schermata Foto extra per piu' box selezionati insieme.
///
/// Come schedaFoto.js non e' un modulo a se': schedaRef.js lo mescola nel proprio oggetto con
/// Object.assign, e ogni this di questi membri e' schedaRef. Usa i membri della scheda di un box
/// (chiaveExtra, decisioneExtraDellaFoto, impaginaFotoExtra, salvaExtraLavorazione...) e i box della
/// selezione multipla (boxSelezioneMultipla: { dettaglio, records }).
///
/// Ogni extra si riconosce fra i box come nella scheda di un box: la chiave (sigla o, per le extra
/// caricate a mano, il nome del file) piu' il tipo. Le operazioni si fanno box per box, ciascuno
/// con il suo record e il suo idRec: un box che non riesce non ferma gli altri, alla fine il
/// riepilogo, e la selezione si rilegge restando sulla schermata Foto extra.
///
/// Le globali (XMLHttpRequestClient, idKitLavorazione, percorsoLoghi, pathLavorazione, ficoProcess,
/// getLoghiBolliData, selectFile, ReperimentoFoto, fs2, uxp, scaricamentoFoto, Modali, $) si leggono
/// al momento della chiamata, come in schedaFoto.js.

const FotoExtraPiuBox = {

    /// Vero quando, riletta la selezione dopo un'operazione, la scheda deve riaprire Foto extra.
    riapriFotoExtraPiuBox: false,

    STATO_EXTRA: { si: "si", no: "no", misto: "misto" },

    /* ---- le righe ---- */

    /// Le righe della schermata per piu' box. listePerBox ha, per ogni box nell'ordine della
    /// selezione, { elementi, decisioni }: le extra del primario (Foto.Extra o Foto.ExtraAuto) e le
    /// decisioni per la lavorazione. campoStato e' "attiva" per le extra e "escluso" per le extra
    /// automatiche. Una riga per chiave e tipo, con i box che la hanno; lo stato (si, no, misto)
    /// guarda solo i box senza una decisione per la lavorazione su quell'extra, che la governa lei.
    /// Prima le righe presenti in tutti i box, poi per numero di box; a parita' nell'ordine in cui
    /// compaiono.
    righeFotoExtraPiuBox(listePerBox, campoStato) {
        const me = this;
        const boxes = Array.isArray(listePerBox) ? listePerBox : [];
        const righe = [];

        boxes.forEach((b, indiceBox) => {
            const decisioni = Array.isArray(b && b.decisioni) ? b.decisioni : [];
            ((b && b.elementi) || []).forEach(elemento => {
                if (elemento == null) {
                    return;
                }
                const chiave = me.chiaveExtra(elemento);
                if (chiave === "") {
                    return;
                }
                const id = elemento.tipo + ":" + chiave;
                let riga = righe.find(r => r.id === id);
                if (riga == null) {
                    riga = { id: id, chiave: chiave, tipo: elemento.tipo, nome: elemento.nome || chiave, box: [], ordine: righe.length };
                    righe.push(riga);
                }
                if (riga.box.some(x => x.indice === indiceBox)) {
                    return;
                }
                riga.box.push({ indice: indiceBox, elemento: elemento, decisione: me.decisioneExtraDellaFoto(decisioni, chiave, elemento.tipo) });
            });
        });

        righe.forEach(r => {
            const libere = r.box.filter(x => x.decisione == null);
            const conStato = libere.filter(x => x.elemento[campoStato] === true).length;
            r.totaleBox = boxes.length;
            r.inTuttiIBox = r.box.length === boxes.length;
            r.conDecisione = r.box.length - libere.length;
            r.stato = libere.length === 0 ? null
                : conStato === libere.length ? me.STATO_EXTRA.si
                    : conStato === 0 ? me.STATO_EXTRA.no : me.STATO_EXTRA.misto;
        });

        return righe.sort((a, b) => (b.box.length - a.box.length) || (a.ordine - b.ordine));
    },

    /// I pulsanti di una riga: per le extra Attiva/Disattiva in tutti ed Elimina da tutti, per le
    /// extra automatiche Includi/Escludi in tutti. Una riga mista ha tutti e due i pulsanti; una
    /// riga governata solo da decisioni per la lavorazione non ne ha.
    pulsantiRigaFotoExtra(riga, auto) {
        const s = this.STATO_EXTRA;
        const pulsanti = [];
        if (riga == null || riga.stato == null) {
            return pulsanti;
        }
        if (auto) {
            //Per le automatiche lo stato e' "escluso".
            if (riga.stato !== s.no) {
                pulsanti.push({ azione: "includi", testo: "Includi in tutti" });
            }
            if (riga.stato !== s.si) {
                pulsanti.push({ azione: "escludi", testo: "Escludi in tutti" });
            }
            return pulsanti;
        }
        if (riga.stato !== s.si) {
            pulsanti.push({ azione: "attiva", testo: "Attiva in tutti" });
        }
        if (riga.stato !== s.no) {
            pulsanti.push({ azione: "disattiva", testo: "Disattiva in tutti" });
        }
        pulsanti.push({ azione: "elimina", testo: "Elimina da tutti" });
        return pulsanti;
    },

    /// L'elenco del Link per piu' box: le immagini dell'archivio di quel tipo che mancano almeno in
    /// un box, ciascuna con i box a cui manca. presentiPerBox ha, per ogni box, i nomi delle extra
    /// che il box ha gia' (nomiExtraDelBox).
    elencoLinkPiuBox(archivio, tipo, presentiPerBox) {
        const boxes = Array.isArray(presentiPerBox) ? presentiPerBox : [];
        return (Array.isArray(archivio) ? archivio : [])
            .filter(item => item != null && item.tipo == tipo)
            .map(item => {
                const mancaIn = [];
                boxes.forEach((nomi, indice) => {
                    if (!(nomi || []).includes(String(item.fileName))) {
                        mancaIn.push(indice);
                    }
                });
                return { item: item, mancaIn: mancaIn, giaIn: boxes.length - mancaIn.length, totaleBox: boxes.length };
            })
            .filter(voce => voce.mancaIn.length > 0);
    },

    /* ---- i dati dei box ---- */

    /// Le liste dei box per le righe: le extra del primario e le sue decisioni.
    listeFotoExtraPiuBox(campo) {
        return (this.boxSelezioneMultipla || []).map(b => {
            const primario = this.primarioDeiRecords(b.records);
            const rec = primario != null ? primario.recordInTracciato : {};
            return {
                elementi: Array.isArray(rec[campo]) ? rec[campo] : [],
                decisioni: Array.isArray(rec.extraLavorazione) ? rec.extraLavorazione : []
            };
        });
    },

    /// I nomi delle extra che un box ha gia': sigle e nomi del dato e, nel documento, le sigle
    /// delle label foto_extra e i file collegati.
    nomiExtraDelBox(b) {
        const nomi = [];
        const aggiungi = (v) => {
            if (v != null && String(v) !== "" && String(v) !== "null" && !nomi.includes(String(v))) {
                nomi.push(String(v));
            }
        };
        const primario = this.primarioDeiRecords(b.records);
        if (primario != null) {
            ["Foto.Extra", "Foto.ExtraAuto"].forEach(campo => (primario.recordInTracciato[campo] || []).forEach(e => {
                aggiungi(e && e.sigla);
                aggiungi(e && e.nome);
            }));
        }
        try {
            const box = b.dettaglio.item;
            for (let i = 0; i < box.allPageItems.length; i++) {
                const item = box.allPageItems[i];
                const label = String(item.label || "");
                if (label.indexOf("foto_extra$") !== 0) {
                    continue;
                }
                aggiungi(label.split("$")[1]);
                try {
                    aggiungi(String(item.graphics.item(0).itemLink.filePath).split("/").pop());
                }
                catch (e) {
                    //un riquadro senza immagine collegata ha solo la label
                }
            }
        }
        catch (e) {
            console.warn("Foto extra: elementi del box non leggibili", e);
        }
        return nomi;
    },

    /// Il box ha gia' nel documento l'extra di quella sigla e quel tipo.
    extraNelBox(box, sigla, tipo) {
        for (let i = 0; i < box.allPageItems.length; i++) {
            if (String(box.allPageItems[i].label || "").indexOf("foto_extra$" + sigla + "$tipo_" + tipo) === 0) {
                return true;
            }
        }
        return false;
    },

    /// Toglie dal box gli elementi dell'extra, come eliminaFotoNelBox ma senza ridisegnare.
    togliExtraDalBox(box, sigla, tipo) {
        for (let i = box.allPageItems.length - 1; i >= 0; i--) {
            if (box.allPageItems[i].label == "foto_extra$" + sigla + "$tipo_" + tipo) {
                box.allPageItems[i].remove();
            }
        }
    },

    /// Mette l'extra nel box con impaginaFotoExtra; il box rifatto prende il posto del vecchio nel
    /// dettaglio della selezione. Lancia se l'immagine non si impagina.
    impaginaExtraNelBox(b, nome, tipo, sigla) {
        const primario = this.primarioDeiRecords(b.records);
        const nuovo = this.impaginaFotoExtra(nome, parseInt(tipo), b.dettaglio.item, pathLavorazione, primario != null ? primario.recordInTracciato : null, sigla);
        if (!nuovo) {
            throw new Error("immagine non trovata nella cartella Loghi");
        }
        b.dettaglio.item = nuovo;
        return nuovo;
    },

    /// Il codice gruppo e l'idRec di un box della selezione, per le chiamate al server.
    destinazioneDelBox(b) {
        const conId = this.getCodiciConIdFromMultiSelection([b.dettaglio])[0] || {};
        return { codiceGruppo: b.records[0].recordInTracciato["Scatto.CodiceGruppo"], idRec: conId.idRec || 0 };
    },

    /// Una chiamata al server come promessa: risolve con la risposta, fallisce col motivo.
    /// esitoObbligatorio vuole esito true, come le chiamate della scheda che controllano !esito;
    /// senza, basta che esito non sia false.
    richiestaFotoExtra(url, dati, metodo, conFile = false, esitoObbligatorio = false) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequestClient();
            xhr.onload = (objResult, parsed) => {
                try {
                    if (!parsed && typeof objResult === "string") {
                        objResult = JSON.parse(objResult);
                    }
                }
                catch (e) {
                    reject(new Error("risposta non leggibile"));
                    return;
                }
                if (objResult == null || objResult.esito === false || (esitoObbligatorio && objResult.esito !== true)) {
                    reject(new Error(objResult != null && objResult.error ? objResult.error : "il server non ha registrato l'operazione"));
                    return;
                }
                resolve(objResult);
            };
            xhr.onerror = (motivo) => reject(new Error("richiesta non riuscita: " + XMLHttpRequestClient.testoErrore(motivo)));
            if (conFile) {
                xhr.sendFiles(url, dati);
            }
            else {
                xhr.send(url, dati, metodo);
            }
        });
    },

    /* ---- la schermata ---- */

    /// Disegna la schermata Foto extra della selezione multipla in #FotoExtra: un pannello per tipo
    /// con le extra dei box, Aggiungi e Link, e il pannello delle extra automatiche.
    async FotoExtraPanelPiuBox() {
        const me = this;
        me.resetFotoExtra();
        const quantiBox = (me.boxSelezioneMultipla || []).length;
        const righe = me.righeFotoExtraPiuBox(me.listeFotoExtraPiuBox("Foto.Extra"), "attiva");

        me.tipiFotoExtra.forEach(tipoPanel => {
            const panel = $('<div class="panel fotoExtraPanel"></div>');
            panel.attr("val", tipoPanel.val);
            panel.append($('<h3></h3>').text(tipoPanel.nome).css({ "color": "white" }));
            const delTipo = righe.filter(r => r.tipo == tipoPanel.val);
            if (delTipo.length === 0) {
                panel.append($('<div class="row align-items-center" style="margin-bottom:10px"></div>')
                    .append($('<span>Nessun elemento</span>').css({ "font-size": "12px", "color": "white" })));
            }
            delTipo.forEach(riga => panel.append(me.rigaFotoExtraPiuBox(riga, false)));

            const aggiungi = $('<button style="color:lightgreen"></button>').text("Aggiungi " + tipoPanel.nome + " a tutti i box");
            aggiungi.on('click', function () { me.aggiungiFotoExtraPiuBox(tipoPanel.val); });
            const link = $('<button style="color:lightgreen"></button>').text("Link " + tipoPanel.nome + " con immagine a sistema");
            link.on('click', function () { me.linkLogoBolloPiuBox(tipoPanel.val); });
            panel.append($('<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;"></div>').append(aggiungi).append(link));
            $("#FotoExtra").append(panel);
        });

        const righeAuto = me.righeFotoExtraPiuBox(me.listeFotoExtraPiuBox("Foto.ExtraAuto"), "escluso");
        const panelAuto = $('<div class="panel fotoExtraPanel" val="extraAuto"></div>');
        panelAuto.append($('<h3>Extra Auto</h3>').css({ "color": "white" }));
        if (righeAuto.length === 0) {
            panelAuto.append($('<div class="row align-items-center" style="margin-bottom:10px"></div>')
                .append($('<span>Nessun elemento</span>').css({ "font-size": "12px", "color": "white" })));
        }
        righeAuto.forEach(riga => panelAuto.append(me.rigaFotoExtraPiuBox(riga, true)));
        $("#FotoExtra").append(panelAuto);

        $("#FotoExtra").prepend($('<div style="font-size:12px; color:#bbbbbb; margin-bottom:8px;"></div>')
            .text("Foto extra di " + quantiBox + " box: prima quelle presenti in tutti, poi le altre."));
        onresizeWindow();
    },

    /// Una riga: nome, in quanti box c'e', lo stato e i pulsanti.
    rigaFotoExtraPiuBox(riga, auto) {
        const me = this;
        const s = me.STATO_EXTRA;
        const row = $('<div class="row align-items-center" style="margin-bottom:10px; display:flex; flex-wrap:wrap; align-items:center; gap:6px; min-width:0;"></div>');
        const nome = $('<span style="font-size:12px; color:white; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"></span>').text(riga.nome);
        nome.attr("title", riga.nome);
        row.append(nome);

        let testoStato = "";
        if (riga.stato === s.misto) {
            testoStato = "MISTO";
        }
        else if (riga.stato === s.si) {
            testoStato = auto ? "esclusa" : "attiva";
        }
        else if (riga.stato === s.no) {
            testoStato = auto ? "inclusa" : "disattivata";
        }
        if (testoStato !== "") {
            row.append($('<span style="font-size:10px; font-weight:600; border-radius:3px; padding:1px 4px;"></span>')
                .css({ "color": riga.stato === s.misto ? "#ffb347" : "#bbbbbb", "border": "1px solid " + (riga.stato === s.misto ? "#ffb347" : "#777") })
                .text(testoStato));
        }
        if (!riga.inTuttiIBox) {
            row.append($('<span style="font-size:11px; color:#bbbbbb;"></span>').text("(in " + riga.box.length + " box su " + riga.totaleBox + ")"));
        }
        if (riga.conDecisione > 0) {
            row.append($('<span style="font-size:11px; color:#8be28b; font-style:italic;"></span>')
                .text("decisa per la lavorazione in " + riga.conDecisione + " box"));
        }

        me.pulsantiRigaFotoExtra(riga, auto).forEach(p => {
            const bottone = $('<button style="font-size:11px;"></button>').text(p.testo);
            bottone.css("color", p.azione === "elimina" ? "#ff8080" : "lightgreen");
            bottone.on('click', function () { me.azioneRigaFotoExtraPiuBox(riga, p.azione); });
            row.append(bottone);
        });
        return row;
    },

    /* ---- le operazioni ---- */

    /// Fa l'operazione su ogni box, uno dopo l'altro: un box che non riesce non ferma gli altri.
    /// fai(b, indice) restituisce false per un box saltato. Alla fine il riepilogo e la selezione si
    /// rilegge, restando su Foto extra.
    async operazioneFotoExtraPiuBox(titolo, indici, fai, codice) {
        const me = this;
        const boxes = me.boxSelezioneMultipla || [];
        const esiti = [];
        try {
            for (let n = 0; n < indici.length; n++) {
                const b = boxes[indici[n]];
                const voce = me.voceDellaSelezioneMultipla(b.dettaglio, b.records);
                indesignEvents.setBusy(true);
                showLoading(titolo + ": box " + (n + 1) + " di " + indici.length);
                try {
                    if ((await fai(b, indici[n])) !== false) {
                        esiti.push({ voce: voce, ok: true });
                    }
                }
                catch (e) {
                    console.error(titolo + " " + voce.codice + ":", e);
                    esiti.push({ voce: voce, ok: false, motivo: e && e.message ? e.message : e });
                }
            }
        }
        finally {
            indesignEvents.setBusy(false);
            hideLoading();
        }

        if (esiti.length === 0) {
            messaggioUtente(codice + " " + titolo + ": nessun box da cambiare", "warning", false, 5);
        }
        else {
            const riepilogo = me.riepilogoSelezioneMultipla(titolo, esiti);
            messaggioUtente(codice + " " + riepilogo.testo, riepilogo.tipo, false, 8);
        }
        me.riapriFotoExtraPiuBox = true;
        me.selezionaBoxDellaSelezioneMultipla(boxes.map(b => b.dettaglio.item));
    },

    /// I pulsanti di una riga, sui box che hanno l'extra e non hanno una decisione per la lavorazione.
    async azioneRigaFotoExtraPiuBox(riga, azione) {
        const me = this;
        const libere = riga.box.filter(x => x.decisione == null);
        const perIndice = {};
        libere.forEach(x => { perIndice[x.indice] = x.elemento; });
        const indici = libere.map(x => x.indice);

        if (azione === "elimina") {
            const boxes = me.boxSelezioneMultipla || [];
            const voci = indici.map(i => me.voceDellaSelezioneMultipla(boxes[i].dettaglio, boxes[i].records));
            if (!(await Modali.confermaSuPiuBox("Eliminare " + riga.nome + " da questi " + indici.length + " box?", voci))) {
                return;
            }
            await me.operazioneFotoExtraPiuBox("Foto extra eliminata", indici, (b, i) => me.eliminaFotoExtraDelBox(b, perIndice[i]), "Code SRF-145");
            return;
        }
        if (azione === "attiva" || azione === "disattiva") {
            const attiva = azione === "attiva";
            const daCambiare = indici.filter(i => perIndice[i].attiva !== attiva);
            await me.operazioneFotoExtraPiuBox(attiva ? "Foto extra attivata" : "Foto extra disattivata", daCambiare,
                (b, i) => me.attivaFotoExtraDelBox(b, perIndice[i], attiva), "Code SRF-146");
            return;
        }
        if (azione === "includi" || azione === "escludi") {
            const escludi = azione === "escludi";
            const daCambiare = indici.filter(i => perIndice[i].escluso !== escludi);
            await me.operazioneFotoExtraPiuBox(escludi ? "Extra automatica esclusa" : "Extra automatica inclusa", daCambiare,
                (b, i) => me.escludiExtraAutoDelBox(b, perIndice[i], escludi), "Code SRF-147");
        }
    },

    /// Attiva o disattiva un'extra di un box, come attivaDisattivaFotoExtra.
    async attivaFotoExtraDelBox(b, elemento, attiva) {
        await this.richiestaFotoExtra("SyncFoto/attivaDisattivaFotoExtra/" + elemento.guidId + "/" + attiva, null, "GET", false, true);
        b.records.forEach(r => (r.recordInTracciato["Foto.Extra"] || []).forEach(e => {
            if (e.guidId == elemento.guidId) {
                e.attiva = attiva;
            }
        }));
        const sigla = this.chiaveExtra(elemento);
        if (attiva) {
            if (!this.extraNelBox(b.dettaglio.item, sigla, elemento.tipo)) {
                this.impaginaExtraNelBox(b, elemento.nome, elemento.tipo, sigla);
            }
        }
        else {
            this.togliExtraDalBox(b.dettaglio.item, sigla, elemento.tipo);
        }
    },

    /// Elimina un'extra dall'anagrafica e dal box, come eliminaFotoExtra.
    async eliminaFotoExtraDelBox(b, elemento) {
        const destinazione = this.destinazioneDelBox(b);
        const formData = new FormData();
        formData.append("nomeFile", elemento.nome);
        formData.append("codice", destinazione.codiceGruppo);
        formData.append("tipo", elemento.tipo);
        formData.append("idLavorazione", idKitLavorazione);
        formData.append("guidId", elemento.guidId);
        formData.append("idRec", destinazione.idRec);
        await this.richiestaFotoExtra("SyncFoto/RimuoviFoto/0", formData, "PUT", false, true);
        b.records.forEach(r => {
            const elenco = r.recordInTracciato["Foto.Extra"] || [];
            const indice = elenco.findIndex(e => e.guidId == elemento.guidId);
            if (indice >= 0) {
                elenco.splice(indice, 1);
            }
        });
        this.togliExtraDalBox(b.dettaglio.item, this.chiaveExtra(elemento), elemento.tipo);
    },

    /// Esclude o include un'extra automatica di un box, come escludiIncludiFotoExtraAuto: prima il
    /// box, poi il server.
    async escludiExtraAutoDelBox(b, elemento, escludi) {
        const sigla = elemento.sigla;
        if (escludi) {
            this.togliExtraDalBox(b.dettaglio.item, sigla, elemento.tipo);
        }
        else if (!this.extraNelBox(b.dettaglio.item, sigla, elemento.tipo)) {
            this.impaginaExtraNelBox(b, elemento.nome, elemento.tipo, sigla);
        }
        const formData = new FormData();
        formData.append("codiceGruppo", this.destinazioneDelBox(b).codiceGruppo);
        formData.append("nomeFoto", elemento.nome);
        await this.richiestaFotoExtra("SyncFoto/escludiIncludiFotoExtraAuto/" + escludi, formData, "PUT", false, true);
        const primario = this.primarioDeiRecords(b.records);
        const auto = primario != null ? (primario.recordInTracciato["Foto.ExtraAuto"] || []).find(e => e.sigla == sigla && e.tipo == elemento.tipo) : null;
        if (auto != null) {
            auto.escluso = escludi;
        }
    },

    /// Una decisione "solo per questa lavorazione" per un box: il server la registra, poi l'extra
    /// va nel box e nei record, come registraDecisioneExtraDallaScheda.
    async decisioneSoloQuiDelBox(b, nomeFile, tipo, ambito) {
        const richiesta = this.richiestaAggiungiSoloQui(nomeFile, tipo);
        richiesta.voce.ambito = ambito;
        if (!(await this.salvaExtraLavorazione(richiesta, this.destinazioneDelBox(b)))) {
            throw new Error("il server non ha registrato la decisione");
        }
        this.impaginaExtraNelBox(b, nomeFile, tipo, nomeFile);
        this.applicaExtraLavorazioneAiRecord(b.records, richiesta.voce);
    },

    /// Link con immagine a sistema per piu' box: l'elenco non propone quello che c'e' gia' in tutti i
    /// box, e un'immagine si aggiunge solo ai box a cui manca, per tutte le lavorazioni o solo per
    /// questa.
    async linkLogoBolloPiuBox(tipo) {
        const me = this;
        const ambitoAzione = await me.sceltaAmbitoAzioneExtra();
        if (ambitoAzione == null) {
            return;
        }
        const soloQui = ambitoAzione === me.AMBITO_AZIONE_EXTRA.lavorazione;
        showLoading("Scaricamento dati...");
        await Utility.sleep(10);

        getLoghiBolliData(async (archivio) => {
            hideLoading();
            const presenti = (me.boxSelezioneMultipla || []).map(b => me.nomiExtraDelBox(b));
            const elenco = me.elencoLinkPiuBox(archivio, tipo, presenti);

            Modali.apriModal('dialogLinkLogoBollo', 'Seleziona immagine', true, [], true);
            const $body = $('#bodyLinkLogoBollo');
            $body.empty();
            if (elenco.length === 0) {
                $body.html('<div>Nessuna immagine da aggiungere: quelle a sistema ci sono gia\' in tutti i box</div>');
                return;
            }

            elenco.forEach(voce => {
                const thumbUrl = olimpoIp + 'getThumbNailOnDemand?width=60&guidId=' + encodeURIComponent(voce.item.id);
                const cella = $('<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; min-width:0;"></div>');
                cella.append($('<img style="width:60px; height:auto; flex:0 0 auto;">').attr("src", thumbUrl));
                const testo = $('<div style="flex:1 1 auto; min-width:0; font-size:12px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"></div>')
                    .text(voce.item.fileName + (voce.giaIn > 0 ? " (gia' in " + voce.giaIn + " box su " + voce.totaleBox + ")" : ""));
                cella.append(testo);
                const bottone = $('<button type="button" style="flex:0 0 auto;"></button>').text("Aggiungi a " + voce.mancaIn.length + " box");
                bottone.on('click', function () { me.collegaLogoBolloPiuBox(voce, tipo, soloQui); });
                cella.append(bottone);
                $body.append(cella);
            });
        });
    },

    /// Collega un'immagine dell'archivio ai box a cui manca, dopo la conferma e il controllo del file
    /// nella cartella Loghi, come linkLogoBollo.
    async collegaLogoBolloPiuBox(voce, tipo, soloQui) {
        const me = this;
        const logoData = voce.item;
        if (!(await Modali.confirm("Confermi il collegamento di \"" + logoData.fileName + "\" a " + voce.mancaIn.length + " box?"))) {
            return;
        }
        try {
            const folder = await fs2.getEntryWithUrl("file://" + percorsoLoghi);
            const entries = await folder.getEntries();
            const fileEntry = entries.find(entry => entry.isFile && entry.name === logoData.fileName);
            if (fileEntry == null) {
                await Modali.popup("Logo non disponibile", "Il logo \"" + logoData.fileName + "\" non è stato scaricato. Effettua una syncFoto e riprova.");
                Modali.closeAllModal();
                return;
            }
            const data = await fileEntry.read({ format: uxp.storage.formats.binary });
            if (scaricamentoFoto.md5ArrayBuffer(new Uint8Array(data)) !== logoData.fileHash) {
                await Modali.popup("Logo non aggiornato", "Il logo \"" + logoData.fileName + "\" non è aggiornato. Effettua una syncFoto e riprova.");
                Modali.closeAllModal();
                return;
            }
        }
        catch (e) {
            console.error(e);
            await Modali.popup("Errore", "Si è verificato un errore durante il controllo del logo.");
            Modali.closeAllModal();
            return;
        }
        Modali.closeAllModal();

        let ambito = null;
        if (soloQui) {
            ambito = await me.chiediAmbitoDecisione();
            if (ambito == null) {
                return;
            }
        }

        await me.operazioneFotoExtraPiuBox("Immagine collegata", voce.mancaIn, async (b) => {
            if (soloQui) {
                await me.decisioneSoloQuiDelBox(b, logoData.fileName, tipo, ambito);
                return;
            }
            const primario = me.primarioDeiRecords(b.records);
            const formData = new FormData();
            formData.append("guidId", logoData.id);
            formData.append("nomeReale", logoData.fileName);
            formData.append("fileHash", logoData.fileHash);
            formData.append("codiceReferenza", primario.recordInTracciato["Referenza.Codice"]);
            const risposta = await me.richiestaFotoExtra("SyncFoto/linkLogoBollo/", formData, "PUT");
            const rebindData = { nome: risposta.nomeReale, tipo: risposta.tipo, guidId: risposta.guidId, attiva: true, puntatore: false, sigla: risposta.pathFoto };
            b.records.forEach(r => r.recordInTracciato["Foto.Extra"].push(Object.assign({}, rebindData)));
            me.impaginaExtraNelBox(b, risposta.nomeReale, risposta.tipo, risposta.pathFoto);
        }, "Code SRF-148");
    },

    /// Aggiungi da disco per piu' box: lo stesso file, per tutte le lavorazioni (caricato
    /// nell'anagrafica di ogni referenza) o solo per questa (decisione per la lavorazione). I box che
    /// hanno gia' quel file si saltano.
    async aggiungiFotoExtraPiuBox(tipo) {
        const me = this;
        const ambitoAzione = await me.sceltaAmbitoAzioneExtra();
        if (ambitoAzione == null) {
            return;
        }
        const soloQui = ambitoAzione === me.AMBITO_AZIONE_EXTRA.lavorazione;
        const fd = await selectFile();
        if (fd == null) {
            return;
        }

        const boxes = me.boxSelezioneMultipla || [];
        const indici = [];
        boxes.forEach((b, i) => {
            if (!me.extraNelBox(b.dettaglio.item, fd.nomeFile, tipo)) {
                indici.push(i);
            }
        });

        let ambito = null;
        if (soloQui) {
            try {
                await ReperimentoFoto.scriviFileInCartella(fd.file, percorsoLoghi, fd.nomeFile);
            }
            catch (e) {
                messaggioUtente("Code SRF-113 Foto extra: il file non si e' potuto copiare nella cartella Loghi: " + e, "error");
                return;
            }
            ambito = await me.chiediAmbitoDecisione();
            if (ambito == null) {
                return;
            }
        }

        const canale = ficoProcess.getCanaleLavorazioneCorrente();
        const area = ficoProcess.getAreaLavorazioneCorrente();
        await me.operazioneFotoExtraPiuBox("Immagine aggiunta", indici, async (b) => {
            if (soloQui) {
                await me.decisioneSoloQuiDelBox(b, fd.nomeFile, tipo, ambito);
                return;
            }
            const destinazione = me.destinazioneDelBox(b);
            const codice = destinazione.codiceGruppo;
            const formData = new FormData();
            formData.append("nomeFile", fd.nomeFile);
            formData.append("file", fd.file);
            formData.append("codice", codice);
            formData.append("tipo", tipo);
            formData.append("area", null);
            formData.append("canale", null);
            formData.append("tracciatoCanale", canale != null ? canale.sigla : "");
            formData.append("tracciatoArea", area != null ? area.sigla : "");
            formData.append("idLavorazione", idKitLavorazione);
            //0: non specificato, come per un gruppo nella scheda di un box.
            formData.append("uploadMethod", 0);
            formData.append("nomeFileOld", "");
            formData.append("idRec", String(codice).includes(",") ? 0 : destinazione.idRec);
            const risposta = await me.richiestaFotoExtra("SyncFoto/updateFotoFromIndd/0", formData, null, true);
            await ReperimentoFoto.scriviFileInCartella(fd.file, percorsoLoghi, risposta.nomeReale);
            const rebindData = { nome: risposta.nomeReale, tipo: risposta.tipo, guidId: risposta.guidId, attiva: true };
            b.records.forEach(r => r.recordInTracciato["Foto.Extra"].push(Object.assign({}, rebindData)));
            me.impaginaExtraNelBox(b, risposta.nomeReale, tipo, null);
        }, "Code SRF-149");
    }
};

module.exports = FotoExtraPiuBox;
