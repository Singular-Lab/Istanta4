

class Archivio {

    queue = [];

    constructor(){
        // Da creare una sola volta, magari all'avvio della pagina
        if ($("#image-hover-preview").length === 0) {
            $("body").append(`
        <div id="image-hover-preview">
            <img src="" />
        </div>
    `);

            $("#image-hover-preview").css({
                "display": "none",
                "position": "fixed",
                "top": "0",
                "left": "0",
                "width": "100vw",
                "height": "100vh",
                "background": "rgba(0, 0, 0, 0.65)",
                "z-index": "99999",
                "align-items": "center",
                "justify-content": "center",
                "pointer-events": "none"
            });

            $("#image-hover-preview img").css({
                "max-width": "80vw",
                "max-height": "80vh",
                "object-fit": "contain",
                "box-shadow": "0 0 20px rgba(0,0,0,0.8)",
                "background": "#fff"
            });
        }

    }

    salvaRevisione(sender, codice, canale, area, callback) {
        let objReg = {
            canale: canale != "" ? canale : null,
            area: area != "" ? area : null,
            custom: null
        }

        let content = sender.closest(".tab-pane");

        let descr1 = content.find("#Descrizione1").val();
        let descr4 = content.find("#Descrizione4").val();
        let descr3 = content.find("#Descrizione3").val();
        let descr2 = content.find("#Descrizione2").val();
        let descrIndd = content.find("#DescrizioneIndd").val();
        let Extra = {};
        let extraFields = content.find(".extraField");
        extraFields.each(function () {
            const chiave = $(this).attr("chiave");
            const tipoDato = $(this).attr("tipoDato");
            const valore = $(this).val();

            Extra[chiave] = {
                type: tipoDato,
                content: valore
            };
        });

        let peso = content.find("#Peso").val();
        let um = content.find("#Um").val();
        let firma_tracciato = "Da archivio";

        codice = codice == null ? $("#Codice").val() : codice;

        let obj = {
            Descrizione1: descr1,
            Descrizione2: descr2,
            Descrizione3: descr3,
            Descrizione4: descr4,
            DescrizioneIndd: descrIndd,
            Extra: Extra,
            Peso: rappresenteDecimaleInCulturaInglese(peso),
            Um: um,
            Codice: codice,
            FirmaTracciato: firma_tracciato,
            revRegionale: objReg,
        }

        console.log(obj);
        showLoading();

        let listAct = [];
        listAct.push(obj);
        this.salvaFunction(listAct, callback, sender);
    }

    salvaFunction(listAct, callback, senderButton) {
        let ME = this;
        let IdTracciato = 0;
        showLoading();
        console.log("Salva function")
        Call.do("Revisore", "salva/" + IdTracciato + "/0/0", "PUT", { coda: listAct }, ME, function (result, sender) {
            //I20-983: quando il server rifiuta, Call.do richiama questo stesso callback passando
            //un oggetto d'errore al posto della lista. Andando dritti su forEach l'eccezione
            //fermava tutto prima di hideLoading: la pagina restava a girare per sempre e il
            //motivo del rifiuto, che il server manda nel corpo della risposta, non lo vedeva
            //nessuno. La stessa guardia c'e' gia' nel revisore.
            if (result == null || !Array.isArray(result)) {
                hideLoading();
                var motivo = (result && (result.message || result.error)) || "Salvataggio non riuscito";
                console.error("Salvataggio fallito:", result);
                alert("Salvataggio non riuscito: " + motivo);
                return;
            }

            let areaEl = null;
            let canaleEL = null;
            if (result.length == 1) {
                areaEl = result[0].area;
                canaleEL = result[0].canale;
            }

            console.log("Salva function 1, ancora non è crashato");

            var tab = $(".tab-pane[area='" + areaEl + "'][canale='" + canaleEL + "']").first();
            result.forEach(function (item) {
                tab.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
            });

            hideLoading();


            if (callback != null && result.error == null) {
                console.warn("Callback");
                callback(result, senderButton);
            }
        });
    }

    /// I20-983: aggancia i gestori della scheda articolo.
    ///
    /// Scritti come attributo onclick nel markup il browser li rifiuta: la policy di sicurezza
    /// della pagina dichiara script-src con il nonce e senza unsafe-inline, e in quel caso i
    /// gestori inline non vengono eseguiti. Non e' una novita' dei pulsanti nuovi: erano inerti
    /// anche Seleziona, Elimina, Salva e Cronologia, cioe' tutta la pagina.
    ///
    /// Si aggancia sul documento e non sui singoli elementi perche' alcuni id sulla pagina sono
    /// ripetuti su piu' schede, e la delega li prende tutti senza doverli rincorrere.
    collegaGestoriSchedaArticolo() {
        let ME = this;
        var pagina = $(document);

        pagina.on("click", "[data-azione='selezionaPrimaria']", function () {
            ME.AggiornaPrimario($(this).attr("data-guidid"));
        });

        pagina.on("click", "[data-azione='eliminaFotoExtra']", function () {
            ME.EliminaFotoExtra($(this));
        });

        pagina.on("change", "[data-azione='attivaFotoExtra']", function () {
            ME.AttivaDisattivaFotoExtra($(this));
        });

        pagina.on("click", "[data-azione='aggiungiFotoExtra']", function () {
            ME.AggiungiFotoExtra($(this).attr("data-tipo"));
        });

        pagina.on("click", "[data-azione='collegaFotoExtra']", function () {
            ME.CollegaFotoExtra($(this).attr("data-tipo"), $(this).attr("data-nometipo"));
        });

        pagina.on("change", "[data-azione='fileFotoExtraScelto']", function () {
            ME.CaricaNuovaFotoExtra($(this));
        });

        pagina.on("click", "[data-azione='aggiungiFotoArticolo']", function () {
            ME.AggiungiFotoArticolo();
        });

        pagina.on("change", "[data-azione='fileFotoArticoloScelto']", function () {
            ME.AnteprimaFotoArticolo($(this));
        });

        pagina.on("click", "[data-azione='confermaFotoArticolo']", function () {
            ME.ConfermaFotoArticolo();
        });

        pagina.on("click", "[data-azione='annullaFotoArticolo']", function () {
            ME.AnnullaFotoArticolo();
        });

        //Canale e area stanno sul pulsante Salva della stessa riga, dove le metteva la vista.
        pagina.on("click", "[data-azione='cronologiaModifiche']", function () {
            var salva = $(this).closest(".row").find("#bottoneSalva");
            ME.checkLastModificaFromButton($(this), salva.attr("canale"), salva.attr("area"));
        });

        pagina.on("click", "[data-azione='salvaRevisione']", function () {
            ME.salvaRevisione($(this), null, $(this).attr("canale"), $(this).attr("area"));
        });
    }

    /// I20-985: il tipo con cui il browser sa disegnare questo file, oppure null.
    /// Un psd non lo sa disegnare, e resta il caso che capita piu' spesso.
    static tipoAnteprimaDi(nomeFile) {
        var nome = typeof nomeFile === "string" ? nomeFile.toLowerCase() : "";
        var mostrabili = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif"
        };

        for (var estensione in mostrabili) {
            if (Object.prototype.hasOwnProperty.call(mostrabili, estensione) && nome.endsWith(estensione)) {
                return mostrabili[estensione];
            }
        }

        return null;
    }

    /// Quello che si manda per archiviare una foto nuova del prodotto.
    ///
    /// tipo 1 e' la foto del prodotto. archiviaSenzaSelezionare dice al server di non metterla
    /// in uso: caricarla non vuol dire volerla, e senza quell'indicazione il server la
    /// selezionerebbe spegnendo la primaria di adesso.
    static datiNuovaFotoArticolo(codice, nomeFile) {
        return {
            codice: codice,
            tipo: 1,
            nomeFile: nomeFile,
            idLavorazione: 0,
            idRec: 0,
            uploadMethod: 0,
            archiviaSenzaSelezionare: true
        };
    }

    /// I20-983: le foto extra che l'articolo ha di questo tipo. Il raggruppamento e' per nome
    /// reale, perche' dello stesso file possono esistere piu' versioni e in elenco ne va una.
    static fotoExtraDelTipo(fotoArticolo, tipo) {
        var elenco = Array.isArray(fotoArticolo) ? fotoArticolo : [];
        var cercato = Number(tipo);
        var visti = {};
        var risultato = [];

        for (var i = 0; i < elenco.length; i++) {
            var foto = elenco[i];
            if (foto == null || Number(foto.Tipo) !== cercato || foto.NomeReale == null) {
                continue;
            }
            if (visti[foto.NomeReale]) {
                continue;
            }
            visti[foto.NomeReale] = true;
            risultato.push(foto);
        }

        return risultato;
    }

    /// Le immagini del catalogo che si possono collegare come questo tipo, senza quelle che
    /// l'articolo ha gia': ricollegare la stessa immagine il server lo rifiuta, e mostrarla
    /// vorrebbe dire far sbagliare l'operatore.
    static catalogoCollegabile(catalogo, tipo, fotoArticolo) {
        var elenco = Array.isArray(catalogo) ? catalogo : [];
        var gia = Array.isArray(fotoArticolo) ? fotoArticolo : [];
        var cercato = Number(tipo);

        return elenco.filter(function (immagine) {
            if (immagine == null || Number(immagine.tipo) !== cercato) {
                return false;
            }
            return !gia.some(function (foto) {
                return foto != null && foto.GuidId != null && foto.GuidId === immagine.guidId;
            });
        });
    }

    /// Quello che si manda per caricare una foto extra nuova.
    ///
    /// idLavorazione e idRec restano a zero: dalla scheda articolo non si sta lavorando a un
    /// volantino, e il server tocca la lavorazione solo quando quel numero non e' zero. Area e
    /// canale restano vuoti, come fa il Plugin per le extra, cosi' la foto vale per tutti.
    static datiNuovaFotoExtra(codice, tipo, nomeFile) {
        return {
            codice: codice,
            tipo: Number(tipo),
            nomeFile: nomeFile,
            idLavorazione: 0,
            idRec: 0,
            uploadMethod: 0
        };
    }

    /// I20-985: apre la scelta del file per una foto nuova del prodotto.
    AggiungiFotoArticolo() {
        var campo = $("#fileNuovaFotoArticolo");
        campo.val("");
        campo.trigger("click");
    }

    /// Mostra cosa si sta per archiviare. Fino alla conferma non si scrive niente.
    AnteprimaFotoArticolo(campo) {
        var file = campo[0] != null && campo[0].files != null ? campo[0].files[0] : null;
        if (file == null) {
            return;
        }

        this.fileNuovaFotoArticolo = file;
        $("#nomeNuovaFotoArticolo").text(file.name);

        var tipo = Archivio.tipoAnteprimaDi(file.name);

        if (this.urlAnteprimaFotoArticolo) {
            try { URL.revokeObjectURL(this.urlAnteprimaFotoArticolo); } catch (e) { }
            this.urlAnteprimaFotoArticolo = null;
        }

        if (tipo != null) {
            this.urlAnteprimaFotoArticolo = URL.createObjectURL(file);
            $("#imgNuovaFotoArticolo").attr("src", this.urlAnteprimaFotoArticolo).show();
            $("#txtAnteprimaNuovaFotoArticolo").hide().text("");
        }
        else {
            //Un riquadro vuoto sembrerebbe un guasto: si dice perche' l'immagine non c'e'.
            $("#imgNuovaFotoArticolo").attr("src", "").hide();
            $("#txtAnteprimaNuovaFotoArticolo").text("Anteprima non disponibile per questo formato").show();
        }

        $("#anteprimaNuovaFotoArticolo").show();
    }

    AnnullaFotoArticolo() {
        this.fileNuovaFotoArticolo = null;

        if (this.urlAnteprimaFotoArticolo) {
            try { URL.revokeObjectURL(this.urlAnteprimaFotoArticolo); } catch (e) { }
            this.urlAnteprimaFotoArticolo = null;
        }

        $("#fileNuovaFotoArticolo").val("");
        $("#imgNuovaFotoArticolo").attr("src", "").show();
        $("#txtAnteprimaNuovaFotoArticolo").hide().text("");
        $("#nomeNuovaFotoArticolo").text("");
        $("#anteprimaNuovaFotoArticolo").hide();
    }

    ConfermaFotoArticolo() {
        let ME = this;
        var file = this.fileNuovaFotoArticolo;

        if (file == null) {
            return;
        }

        var dati = Archivio.datiNuovaFotoArticolo($("#Codice").val(), file.name);

        var fd = new FormData();
        fd.append("file", file);
        for (var chiave in dati) {
            if (Object.prototype.hasOwnProperty.call(dati, chiave)) {
                fd.append(chiave, dati[chiave]);
            }
        }

        showLoading();
        Call.doWithUpload("SyncFoto", "updateFotoFromIndd/0", "PUT", fd, this, function (result, sender) {
            hideLoading();

            if (result != null && result.esito === false) {
                alert("Caricamento non riuscito: " + (result.error || "errore sconosciuto"));
                return;
            }

            ME.AnnullaFotoArticolo();
            location.reload();
        });
    }

    /// Apre la scelta del file per il tipo chiesto. Il tipo si tiene sull'elemento, cosi' il
    /// gestore del cambiamento sa per quale sezione si sta caricando.
    AggiungiFotoExtra(tipo) {
        var campo = $("#fileNuovaFotoExtra");
        campo.attr("tipo", tipo);
        campo.val("");
        campo.trigger("click");
    }

    CaricaNuovaFotoExtra(campo) {
        var file = campo[0] != null && campo[0].files != null ? campo[0].files[0] : null;
        if (file == null) {
            return;
        }

        var dati = Archivio.datiNuovaFotoExtra($("#Codice").val(), campo.attr("tipo"), file.name);

        var fd = new FormData();
        fd.append("file", file);
        for (var chiave in dati) {
            if (Object.prototype.hasOwnProperty.call(dati, chiave)) {
                fd.append(chiave, dati[chiave]);
            }
        }

        showLoading();
        Call.doWithUpload("SyncFoto", "updateFotoFromIndd/0", "PUT", fd, this, function (result, sender) {
            hideLoading();

            if (result != null && result.esito === false) {
                alert("Caricamento non riuscito: " + (result.error || "errore sconosciuto"));
                return;
            }

            location.reload();
        });
    }

    /// Mostra il catalogo delle immagini a sistema per quel tipo e collega quella scelta.
    CollegaFotoExtra(tipo, nomeTipo) {
        let ME = this;
        var corpo = $("#collegaFotoExtraBody");

        $("#collegaFotoExtraModalLabel").text("Collega " + (nomeTipo || "") + " a immagine a sistema");
        corpo.html("<div>Caricamento...</div>");
        new bootstrap.Modal(document.getElementById("collegaFotoExtraModal")).show();

        Call.do("FicoProcess", "getLoghiBolli", "GET", null, this, function (result, sender) {
            var catalogo = result != null && result.content != null ? result.content : [];
            var disponibili = Archivio.catalogoCollegabile(catalogo, tipo, ME.fotoExtraDellaPagina());

            if (disponibili.length === 0) {
                corpo.html("<div>Nessuna immagine disponibile per questo tipo.</div>");
                return;
            }

            corpo.empty();
            var griglia = $('<div class="d-flex flex-wrap gap-3"></div>');

            disponibili.forEach(function (immagine) {
                var miniatura = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?width=80&guidId=" + encodeURIComponent(immagine.guidId);
                var riquadro = $('<div class="text-center border rounded p-2" style="width:140px; cursor:pointer;"></div>');
                riquadro.append($('<img class="img-fluid rounded mb-1">').attr("src", miniatura).attr("alt", immagine.nome || ""));
                riquadro.append($('<div style="font-size:11px; word-break:break-all;"></div>').text(immagine.nome || immagine.sigla || ""));
                riquadro.on("click", function () {
                    ME.collegaImmagineScelta(immagine, tipo);
                });
                griglia.append(riquadro);
            });

            corpo.append(griglia);
        });
    }

    /// Le foto extra gia' sulla pagina, lette dai riquadri disegnati dalla vista.
    fotoExtraDellaPagina() {
        var elenco = [];
        $("#fotoExtra").each(function () {
            try {
                elenco.push(JSON.parse($(this).attr("data")));
            }
            catch (e) {
                console.log("Foto extra non leggibile dalla pagina: " + e);
            }
        });
        return elenco;
    }

    collegaImmagineScelta(immagine, tipo) {
        var dati = {
            guidId: immagine.guidId,
            nomeReale: immagine.nome,
            fileHash: immagine.hash || immagine.fileHash || "",
            codiceReferenza: $("#Codice").val(),
            tipo: Number(tipo)
        };

        showLoading();
        Call.do("SyncFoto", "linkLogoBollo", "PUT", dati, this, function (result, sender) {
            hideLoading();

            if (result != null && result.esito === false) {
                alert("Collegamento non riuscito: " + (result.error || "errore sconosciuto"));
                return;
            }

            location.reload();
        });
    }

    /// La casella Attiva: fino a oggi cambiava solo il segno di spunta sullo schermo.
    AttivaDisattivaFotoExtra(casella) {
        var guidId = casella.attr("guidid");
        var attiva = casella.is(":checked");

        showLoading();
        Call.do("SyncFoto", "attivaDisattivaFotoExtra/" + guidId + "/" + attiva, "GET", null, this, function (result, sender) {
            hideLoading();

            if (result != null && result.esito === false) {
                alert("Modifica non riuscita: " + (result.error || "errore sconosciuto"));
                //Si rimette la casella com'era: lasciarla girata direbbe una cosa falsa.
                casella.prop("checked", !attiva);
            }
        });
    }

    EliminaFotoExtra(button) {
        const el = button.closest(".col").find('#fotoExtra');
        const item = JSON.parse(el.attr("data"));

        let ME = this;
        let data = {
            nomeFile: item.NomeReale,
            codice: $("#Codice").val(),
            idLavorazione: 0,
            tipo: item.Tipo,
            guidId: item.GuidId
        }
        showLoading();
        console.log("Salva function")
        Call.do("SyncFoto", "RimuoviFoto/" + 0, "PUT", data, ME, function (result, sender) {
            console.log(result);
            hideLoading();
            location.reload();

        });
    }

    checkLastModificaFromButton(sender, canale = null, area = null) {
        let codice = $("#Codice").val();
        this.checkLastModifica(codice, canale, area);
    }

    checkLastModifica(codice, canale = null, area = null) {
        // L'oggetto da inviare è un'istanza di StringList con un array contenente il solo codice
        var data = {
            elementiRichiesti: [{
                codici: codice,
                canale: canale,
                area: area
            }]
        };

        showLoading();

        // Eseguiamo la chiamata al controller Revisore sul metodo "checkLastModifica" con POST
        Call.do("Revisore", "checkLastModifica", "POST", data, this, function (result, sender) {
            console.log(result);
            hideLoading();
            sender.mostraOperazioniModal(result);
        });
    }

    mostraOperazioniModal(data) {
        const operazioni = data.risultati[0].operazioniResult.operazioni;
        const codice = data.risultati[0].codice;
        const canale = operazioni[0]?.operazione?.canale || '—';
        const area = operazioni[0]?.operazione?.area || '—';

        $('#operazioniModalLabel').text(`${codice.length > 40 ? codice.slice(0, 40) + `...` : codice} | ${canale} | ${area}`);

        function render() {
            const giorni = $('#rangeDateSelect').val();
            const ora = new Date();

            const filtrate = operazioni.filter(op => {
                const dataOp = new Date(op.operazione.data_Esecuzione);
                if (giorni === 'all') return true;
                const diff = (ora - dataOp) / (1000 * 60 * 60 * 24); // giorni
                return diff <= parseInt(giorni);
            });

            filtrate.sort((a, b) => new Date(b.operazione.data_Esecuzione) - new Date(a.operazione.data_Esecuzione));

            const corpo = filtrate.map((op, idx) => {
                const o = op.operazione;
                const esecuzione = new Date(o.data_Esecuzione);
                const dataString = `${esecuzione.getDate().toString().padStart(2, '0')}/${(esecuzione.getMonth() + 1).toString().padStart(2, '0')}/${esecuzione.getFullYear()} ${esecuzione.getHours().toString().padStart(2, '0')}:${esecuzione.getMinutes().toString().padStart(2, '0')}:${esecuzione.getSeconds().toString().padStart(2, '0')}`;

                const utenteHtml = (o.autore === o.esecutore)
                    ? `<p><strong>Utente:</strong> ${op.nomeUtenteEsecutore}</p>`
                    : `<p><strong>Richiedente:</strong> ${op.nomeUtenteRichiedente}</p><p><strong>Approvato da:</strong> ${op.nomeUtenteEsecutore}</p>`;

                const formDataBtn = o.formData
                    ? `<button class="btn btn-outline-primary btn-sm" onclick='ArchivioItem.mostraFormData(${JSON.stringify(o.formData)})'>Form Data</button>`
                    : `<span class="text-muted">Nessun formData</span>`;

                return `<div class="border rounded p-3 mb-3 ${idx === 0 ? 'bg-light border-primary' : ''}">
        ${idx === 0 ? '<span class="badge bg-primary mb-2">Ultima operazione</span>' : ''}
        ${utenteHtml}
        <p><strong>Data esecuzione:</strong> ${dataString}</p>
        ${formDataBtn}
      </div>`;
            }).join('');

            $('#operazioniModalBody').html(corpo || '<p class="text-muted">Nessuna operazione trovata per il range selezionato.</p>');
        }

        $('#rangeDateSelect').off('change').on('change', render);
        render();

        $('#operazioniModal').modal('show');
    }

    mostraFormData(raw) {
        let dati;
        try {
            dati = JSON.parse(raw);
        } catch (e) {
            $('#formDataModalBody').html('<p class="text-danger">Errore nel parsing del formData.</p>');
            $('#formDataModal').modal('show');
            return;
        }

        const html = Object.entries(dati).map(([key, val]) => `
    <div class="mb-2">
      <label class="form-label"><strong>${key}</strong></label>
      <input type="text" class="form-control" value="${val || ''}" readonly>
    </div>
  `).join('');

        $('#formDataModalBody').html(html || '<p class="text-muted">FormData vuoto.</p>');
        $('#formDataModal').modal('show');
    }


    AggiornaPrimario(guidId) {
        let codice = $("#Codice").val();
        let data = {
            guidId: guidId,
            codice: codice
        }
        Call.do("SchedaArticolo", "AggiornaPrimario", "PUT", data, this, function (result, sender) {
            location.reload();
        });
    }


    salvaDaLista(sender, callback) {

        this.queue = null;

        showLoading();
        var rowItem = sender.closest('.record_articolo');

        var obj = { Id: rowItem.attr("id_articolo") };

        rowItem.find(".form-control").each(function () {
            console.log($(this).attr("id") + "=" + $(this).val());
            obj[$(this).attr("id")] = $(this).val();
        });

        this.salva(sender, obj, callback);

    }

    salvaDaListaInGruppo(sender) {
        var q= [];

        $("#lista").find(".record_articolo").each(function () {

            var ch = $(this).find("input:checkbox");
            if (ch.prop("checked")) {

                //console.log("Salvo..." + $(this).attr("id_articolo"));
                var obj = { Id: $(this).attr("id_articolo") };
                $(this).find(".form-control").each(function () {
                    //console.log($(this).attr("id") + "=" + $(this).val());
                    obj[$(this).attr("id")] = $(this).val();
                });

                q.push(obj);
            }
        });

        this.startQueue(q, sender);
    }

    salva(sender, obj, callback) {

        console.log("Salvo articolo");
        console.log(obj);

        Call.do("Archivio", "Update", "PUT", obj, this, function (result, sender2) {
            console.log(result);
            //console.log("item updated!!");
            if (sender2.queue==null) {
                //Non ci sono code di salvataggio
                hideLoading();
                var rowItem = sender.closest('.record_articolo');
                rowItem.find(".row").each(function () {
                    if ($(this).attr("id") === "lab_revisione") {
                        $(this).html("<span>Data ultima revisione " + getStringFromDate(new Date(result.ultimaRevisione)) + "</span>");
                    }
                });

                if (callback != null) {
                    callback(result, sender);
                }
            }
            else {
                sender2.processaSalvataggio(sender);
                if (sender2.queue.length==0 && callback != null) {
                    callback(result, sender);
                }
            }
        });
    }

    salvaDaSync(sender, callback)
    {
        showLoading();
        var rowItem = sender.closest('.record_articolo');

        var obj = { };

        rowItem.find(".form-control").each(function () {
            console.log($(this).attr("id") + "=" + $(this).val());
            obj[$(this).attr("id")] = $(this).val();
        });

        Call.do("Archivio", "salvaArticoloByCodice/" + rowItem.attr("codice"), "PUT", obj, this, function (result, sender2) {
            if (callback!=null)
                callback(result, sender);

            hideLoading();

        });
    }

    startQueue(q, sender) {
        showLoading();
        this.queue = q;

        this.processaSalvataggio(sender);
    }

    processaSalvataggio(sender) {

        console.log("Da processare " + this.queue.length);
        if (this.queue.length > 0) {
            var item = this.queue.shift();
            this.salva(sender, item);
        }
        else {

            //Fine del salvataggio
            hideLoading();
        }
    }

    delete(sender) {

        if (confirm("Sicuro di voler eliminare?"))
        { 
            showLoading();
            var rowItem = sender.closest('.record_articolo');
            var id = rowItem.attr("id_articolo");

            Call.do("Archivio", "Delete/" + id, "DELETE", null, null, function (result) {
                console.log(result);
                hideLoading();
                rowItem.remove();
                
            });
        }
    }

    changeFotoSelect(sender) {

        var input = document.getElementById("new_file_img");
        if (input.files.length > 0) {
            $("#b_salva_img").css("display", "inline");
        }
        else {
            $("#b_salva_img").css("display", "none");
        }

    }

    uploadFoto() {

        var input = document.getElementById("new_file_img");

        let fd = new FormData();
        fd.append("file", input.files[0]);
        fd.append("idArticolo", $("#idArticolo").val());

        Call.doWithUpload("SchedaArticolo", "UploadFoto", "POST", fd, this, function (result, sender) {

            console.log("reload!");
            location.reload(true);

        });
    }

    downloadFotoArticolo(id)
    {
        window.location = "Archivio/downloadFoto/" + id;
        /*Call.doWithUpload("Archivio", "downloadFoto/"+id, "GET", null, this, function (result, sender) {

        });*/
    }

    caricaFotoManuale(inputEl, file) {
        let wrapper = inputEl.closest(".foto-archivio");
        let codice = wrapper.attr("data-codice");
        let idArticolo = wrapper.attr("data-id-articolo");
        let area = wrapper.attr("data-area") || "";
        let canale = wrapper.attr("data-canale") || "";

        let fd = new FormData();
        fd.append("file", file);
        fd.append("codice", codice);
        fd.append("area", area);
        fd.append("canale", canale);

        wrapper.find(".foto-archivio-errore").hide().text("");
        showLoading();

        Call.doWithUpload("Archivio", "caricaFotoManuale", "POST", fd, this, function (result, sender) {
            hideLoading();
            inputEl.val("");

            if (!result.esito) {
                wrapper.find(".foto-archivio-errore").text(result.error || "errore sconosciuto durante il caricamento").show();
                return;
            }

            wrapper.find(".foto-archivio-thumb").attr("src", result.thumbnail).css("opacity", "1");
            wrapper.find(".foto-archivio-nome").text(result.nomeReale);
            // Ora questa tab ha una foto propria: tolgo l'eventuale etichetta "ereditata".
            wrapper.find(".foto-archivio-badge-ereditata").remove();

            // Aggiorno anche la miniatura e il contatore nella riga della lista.
            let riga = $(".riga.record_articolo[id_articolo='" + idArticolo + "']");
            let bigImg = result.thumbnail.replace("width=88", "width=800");
            riga.find("td:first img")
                .attr("src", result.thumbnail)
                .attr("data-bigimg", bigImg)
                .removeAttr("style")
                .addClass("img-preview-hover");
            riga.find("td.text-center .badge")
                .removeClass("bg-warning-subtle text-warning-emphasis")
                .addClass("bg-secondary-subtle text-secondary-emphasis")
                .text(result.nFoto);
        });
    }

    startDump() {
        showLoading();

        let file = $("#fileDumpUpload").prop("files")[0];

        let fd = new FormData();
        fd.append("file", file);

        let me = this;
        Call.doWithUpload("Archivio", "caricaDump", "POST", fd, this, function (result, me) {

            console.log("RISULTATO DUMP");
            console.log(result);

            if (result.esito) {

                alert("Dump terminato!");
            }

            hideLoading();

        });
    }
}

//I20-983: in Node si esporta per i test (tests/istanta-web). Nella pagina module non esiste
//e questa riga non fa nulla.
if (typeof module !== "undefined" && module.exports) {
    module.exports = Archivio;
}
