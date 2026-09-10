class Promo {

    agenzia;
    addestramento;
    codaProcessi = {};
    intervalCheckStatoAttivita;
    lista_promo_scaricate;
    repordDbCache = [];
    intervalConteggio;

    constructor() {

        this.refresh();

        //Configurazione del contenuto di importazione tracciato
        this.agenzia = new Agenzia();
        this.addestramento = new Addestramento();

        //this.agenzia.getForm_importazioneTracciato(function (result) {

        //    $("#agenziaTracciatoForm").html(result);

        //});

        if (this.agenzia.isAutoRvisioneInImportazioneEnabled != null) {
            if (!this.agenzia.isAutoRvisioneInImportazioneEnabled()) {
                $("#containerOpzioneAutoRevisione").css("display", "none");
                $("#OpzioneAutoRevisione").prop("checked", false);                
            }
        }

        $('#modalImportazioneTracciato').on('show.bs.modal', function (event) {
            var button = $(event.relatedTarget); // bottone che ha aperto la finestra modale
            var parameterVal = button.data('idpromo'); // estrai il valore del parametro
            $('#idPromo').val(parameterVal); // imposta il valore del parametro nella finestra modale

            $('#cmbLabels').append("<option value=\"-1\">Attendere...</option>");

            console.log("labels get...");
            //Devo riempire la tendina delle importazioni in base alla promo indicata
            let rndVersion = Math.floor(Math.random() * 999999);
            $.getJSON('external_source/SourceLabels.json?v=1.' + rndVersion, function (data) {
                console.log(data);
                $('#cmbLabels').empty();
                $('#cmbLabels').append("<option value=\"\">Nessuna etichetta</option>");
                data.source.forEach(i => {
                    $('#cmbLabels').append("<option value=\"" + i.Codice + "\">" + i.Nome + "</option>");

                });
            });
            /*
            Call.do("Tracciati", "getImportazioni/" + parameterVal, "GET", null, null, function (result) {

                console.log(result);
                $('#cmbImportazione').empty();
                $('#cmbImportazione').append("<option value=\"-1\">Nuova</option>");
                result.forEach(i => {
                    $('#cmbImportazione').append("<option value=\""+i.id+"\">"+i.nomeFile+"</option>");

                });


            });
            */
        });

        /*
        setInterval(function (sender) {

            sender.checkStatoAttivita();

        }, 3000, this);*/
    }

    refresh() {
        let me = this;        
        let _container = $("#promoList");
        _container.html("");

        Call.do("Tracciati", "getPromoAperte", "GET", null, null, function (result) {
            
            let template = $("#promoItem");

            console.log(result);
            me.lista_promo_scaricate = result;

            for (let i = 0; i < result.length; i++) {
                let item = result[i];
                let _html = $(template.clone().html());
                console.log(item.nomePromo);

                let _b = _html.find(".accordion-button");

                _html.attr("id", "promo_" + item.id);
                //_b.html("<div style=\"margin-right:10px;\"><img src=\"images/download_json.svg\" style=\"width: 31px;\" onclick=\"promoCtrl.downloadForDataDump("+item.id+")\"></div>" + item.nomePromo + );               
                //_b.html(
                //   "<b>"+item.nomePromo+"</b>"
                //);

                _b.html(
                    "<img src='images/copyIcon.png' class='copyPromo' data-promo='" + item.nomePromo + "' style='cursor:pointer; width:16px; vertical-align:middle; margin-right:5px'>"+
                    "<b>" + item.nomePromo + "</b> "
                );

                _b.find(".copyPromo").on("click", function () {
                    const $img = $(this);
                    const promo = $img.data("promo");

                    navigator.clipboard.writeText(promo)
                        .then(() => {

                            const originalSrc = $img.attr("src");

                            // Cambia immagine
                            $img.attr("src", "images/done.png");

                            // Dopo 1 secondo torna normale
                            setTimeout(() => {
                                $img.attr("src", originalSrc);
                            }, 1000);

                        })
                        .catch(err => {
                            console.error("Errore copia:", err);
                        });
                });

                _b.attr("idpromo", item.id);
                _b.attr("data-bs-target", "#c_" + i);
                _b.attr("aria-controls", "c_" + i);

                _html.find(".accordion-header").attr("id", "h_" + i);
                _html.find(".accordion-collapse").attr("id", "c_" + i);
                _html.find(".accordion-collapse").attr("aria-labelledby", "h_" + i);


                let _body = _html.find(".accordion-body");

                _body.append(`<div class='row' style='display:flex;padding:10px;background:#c9cfc8;'><div class='col-10' id="actionButtons" style=\"display:flex;\"><img id="imgButtonRefresh_${item.id}" title="Aggiorna importazioni pending" src="images/refresh.svg" style="width: 31px; margin-right:10px;cursor:pointer;"><img title="Gestisci traccaiti da FidelityPromotion" id="imgButtonFP_${item.id}" guidid="${item.guidID}" src="images/fp.svg" style="width: 31px; margin-right:10px;cursor:pointer;"><img id="btnDownloadJson_${item.id}" title="Scarica dati per dump" src="images/download_json.svg" style="width: 31px; margin-right:10px;cursor:pointer;">`+
                    `<a id="b_revisione_${item.id}" href="Revisore?id_promo=${item.id}" class="link-primary mx-2" style="margin:auto;"><img src="images/revisore.png" style="width:30px;"></a></div><div class='col-2 text-end counterRev'></div></div>`);
                //Controllo se ci sono da fare rivisioni
                //_body.append("<div class=\"row\"><div class=\"col mb-2\"><button type=\"button\" class=\"btn btn-primary\" data-bs-toggle=\"modal\" data-bs-target=\"#modalImportazioneTracciato\" data-idpromo=\"" + item.id + "\">Importa nuovo tracciato</button></div><div class=\"col mb-2\"><input class=\"float-end\" id=\"b_revisione\" type=\"button\" value=\"Revisiona\" ></div></div>");
                _body.append("<div class=\"row\"><div class=\"col mb-2 p-2\" style=\"background-color:#e6f1f1;\"><div class=\"container\" id=\"importazioniPending\"></div></div></div>");
                _body.append("<div class=\"row\" style=\"display:none;mb-1\"><div class=\"col mb-2\"><button type=\"button\" class=\"btn btn-primary\" data-bs-toggle=\"modal\" data-bs-target=\"#modalImportazioneTracciato\" data-idpromo=\"" + item.id + "\">Importa nuovo tracciato</button></div><div class=\"col mb-2\"><div style='cursor:pointer;' class='fas fa-exclamation-triangle float-end' onclick='promoCtrl.impostaBadgeRevisioni($(this).closest(\".accordion-body\").find(\"#b_revisione\"))'></div><button class=\"float-end\" id=\"b_revisione\" type=\"button\">Revisiona</button>" + '<button class="float-end" promo="' + item.id +'" type="button" onclick="promoCtrl.apriRevisioniModal($(this).attr(\'promo\'))"><span class="fas fa-cog"></span></button></div></div>');
                let templateTracciato = $("#tracciatoItem").clone();
                _b.find("#b_revisione").attr("href", "Revisore?id_promo=" + item.id);
                _b.find("#b_revisione").addClass("link-primary mx-2");

                _body.find("#imgButtonFP_" + item.id).on("click", function (event) {
                    event.stopPropagation();
                    let _id = $(this).attr("guidid");
                    promoCtrl.prepareLinkToFP(_id);
                });

                _body.find("#imgButtonRefresh_" + item.id).on("click", function (event) {
                    console.log(event);
                    event.stopPropagation();
                    let _id = $(this).attr("id").replace("imgButtonRefresh_","");
                    promoCtrl.getImportazioniPendingByIdPromo(-1, _id);
                });

                _body.find("#btnDownloadJson_"+item.id).on("click", function (event) {
                    event.stopPropagation();
                    let _id = $(this).attr("id").replace("btnDownloadJson_", "");
                    promoCtrl.downloadForDataDump(_id);
                });

                if (me.agenzia.applicaSchemaDiOrdinamentoTracciati != null) {

                    item.promoTracciatis = me.agenzia.applicaSchemaDiOrdinamentoTracciati(item.promoTracciatis, "sigla");
                }

                for (let t = 0; t < item.promoTracciatis.length; t++) {
                    let trItem = item.promoTracciatis[t];
                    let metaTr = JSON.parse(trItem.meta);

                    console.log(trItem);

                    let recHtml = $(templateTracciato.html());
                    recHtml.attr("id_tracciato", trItem.id);

                    //recHtml.find("#labNomeArea").text(metaTr.Area);
                    let ctxDetail = "";
                    if (item.context != null && item.context != "")
                    {
                        try {
                            let ctxObj = JSON.parse(item.context);
                            if (ctxObj.length > 0) {
                                for (let cx = 0; cx < ctxObj.length; cx++) {
                                    let itemCtx = ctxObj[cx];
                                    ctxDetail += itemCtx.nome_field + ": " + itemCtx.user_value + " ";
                                }
                            }

                            if (ctxDetail != "")
                                ctxDetail = "<br><span style=\"font-size:11px; font-weight:bold; background-color:#b5cedf; padding:5px; border-radius:10px;\">" + ctxDetail+"</span>";
                        } catch (e) {
                            //console.error("Errore nel parsing del contesto della promo: " + e.message);
                        }

                    }
                    recHtml.find("#labNomeArea").html(trItem.canale + "/" + trItem.area + ctxDetail);
                    
                    recHtml.find("#labNomeEsportazione").text(metaTr.NomeEsportazione);
                    recHtml.find("#aRev").attr("href", "Revisore?id_promo=" + 0 + "&id_tracciati=" + trItem.id);
                    recHtml.find("#aMen").attr("href", "Menabo?id_tracciato=" + trItem.id);

                    recHtml.find("#btnEsportaCollapse").attr("data-bs-target", "#collapseExport_" + trItem.id);
                    recHtml.find(".collapse").attr("id", "collapseExport_"+trItem.id);
                    _body.append(recHtml);
                    //_body.append("<div class=\"row border bg-light mb-2 p-2\"><div class=\"container\"><div class=\"row\"><div class=\"col-8\">" + metaTr.Area + "</div><div class=\"col-2\"><input type=\"button\" class=\"btn btn-primary\" value=\"Esporta\"></div><div class=\"col\"><a href=\"Revisore?id_importazione=" + trItem .idImportazione + "\" class=\"link-primary\"><img src=\"images/revisore.png\" style=\"width:30px;\"></a></div><div class=\"col\"><a href=\"Menabo?id_tracciato=" + trItem.id +"\" class=\"link-primary\"><img src=\"images/menabo.png\" style=\"width:30px;\"></a></div></div><div class=\"col\"><p style=\"font-size:10px;\">" + metaTr.NomeEsportazione + "</p></div></div></div>");
                }

                _container.append(_html);

                //_html.find(".accordion-body").append();
                _b.find("#b_revisione").on("click", function (e) {
                    window.location = "Revisore?id_promo=" + item.id;

                });

                //Mi aggancio all'evento di apertura pannello per conteggiare lo stato delle revisioni
                $(".accordion").on('shown.bs.collapse', (e) => {
                   
                    console.log('Aperto!', $(e.target).parent().attr("id"));

                    let _idPromo = $(e.target).parent().attr("id").replace("promo_", "");

                    //Ripulisco l'area e metto spinner
                    let _badgeArea = $(e.target).find(".counterRev");
                    _badgeArea.empty();
                    _badgeArea.append(
                        `<div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Loading...</span>
                        </div>`
                    );

                    let me = promoCtrl;

                    if (me.intervalConteggio != null)
                        clearInterval(me.intervalConteggio);

                    me.intervalConteggio = setInterval(function () {
                        //Revisore/getConteggio
                        clearInterval(me.intervalConteggio);
                        Call.do("Revisore", "getConteggio", "POST", { idPromo: _idPromo }, null, function (result) {

                            //console.log(result);

                            let _globalCount = result.globalCount;
                            let _countTracciati = result.countTracciati;

                            if (_globalCount.length > 1) {
                                let _tot = _globalCount[0];
                                let _totSottogruppi = _globalCount[1];

                                _badgeArea.empty();
                                //Scrivo i risultati
                                _badgeArea.append(
                                    `<span class="badge bg-danger" style="border: 2px solid #392929;" title="Conteggio singoli/gruppi">${(_tot)}</span><span class="badge bg-warning text-dark ms-2" style="border: 2px solid #392929;" title="Conteggio sottogruppi">${_totSottogruppi}</span>`
                                );

                            }

                            console.log("riport count per ogni singolo");
                            $(e.target).find(".record_tracciato").each(function () {
                                let id_tracciato = $(this).attr("id_tracciato");
                                let countForTracciato = _countTracciati[id_tracciato];
                                console.log(id_tracciato + " -> " + countForTracciato);
                                $(this).find("#counter_tracciato").empty();
                                $(this).find("#counter_tracciato").append(
                                    `<span class="badge bg-danger" style="border: 2px solid #392929;" title="Conteggio singoli/gruppi">${(countForTracciato[0])}</span><span class="badge bg-warning text-dark ms-2" style="border: 2px solid #392929;" title="Conteggio sottogruppi">${countForTracciato[1]}</span>`
                                );
                            });



                            
                            
                        });
                    }, 300);
                });
            }
            //me.impostaBadgeRevisioni()

            document.querySelectorAll('.inner-btn').forEach(btn => {
                btn.addEventListener('click', function (event) {
                    event.stopPropagation(); // Impedisce la propagazione al bottone dell'accordion
                    console.log("Pulsante interno cliccato");
                    // Esegui l'azione desiderata qui
                });
            });

            me.getImportazioniPending(0);
        });
    }

    getImportazioniPending(indice) {
        if (indice >= this.lista_promo_scaricate.length)
            return;

        let promo = this.lista_promo_scaricate[indice];
        this.getImportazioniPendingByIdPromo(indice, promo.id);
        
    }

    getImportazioniPendingByIdPromo(indice, id) {


        let promoEl = $("#promo_" + id);
        let me = this;

        Call.do("Tracciati", "getImportazioniPending/" + id, "GET", null, null, function (result) {

            promoEl.find("#importazioniPending").empty();

            for (let r = 0; r < result.length; r++) {

                let rec = result[r];
                if (r > 0)
                    promoEl.find("#importazioniPending").append("<hr>");

                promoEl.find("#importazioniPending").append("<div class=\"row mb-2\" id=\"attivita_" + rec.id + "\"><div class=\"col-2\" style=\"width: 97px;\"><button class=\"btn btn-danger btnAttivitaImport\" id=\"btnAttivitaImport\" id_attivita=\"" + rec.id + "\" id_promo=\"" + rec.idPromo + "\">Importa</button></div><div class=\"col-2\"><select class=\"form-select tipo_azione\" id=\"tipo_azione\"><option value=\"1\">Salva</option><option selected value=\"2\">Solo report</option><option value=\"3\">Salva e fai report</option></select></div><div class=\"col-7\" id=\"file_attivita\" style=\"display:flex;\"><h6><span class=\"badge bg-secondary me-2\">"+rec.label+"</span></h6>" + rec.titolo + "</div><div class=\"col-1\" style=\"text-align:right;\"><img id=\"imgGarbage_"+rec.id+"\" src=\"images/garbage_ico.png\" style=\"width:30px;cursor:pointer;\"></div>");// </div></div><div class=\"col-12\"><div class=\"progress mt-2\" id=\"progress_"+rec.id+"\" style=\"display:none;\"><div class=\"progress-bar progress-bar-striped progress-bar-animated progressBar\" id_attivita=\""+ rec.id +"\" role=\"progressbar\" aria-valuenow=\"0\" aria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width:0%; height:20px;\"></div></div></div>");
                promoEl.find("#importazioniPending").append(
                    '<div class="row mt-4 progressBar" id_attivita="' + rec.id + '" id="progress_' + rec.id + '" style="display:none;">' +
                    '<div class= "container">' +
                    '<div class="row">' +
                    '<div class="col mb-2">' +
                    '<div class="progress">' +
                    '<div class="progress-bar progress-bar-striped progress-bar-animated progressBar" id="progressbar" role="progressbar" style="width:0%;"></div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="row">' +
                    '<div class="col text-center text-secondary">' +
                    '<p class="progressMsg" id="progressMsg"></p>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );

                promoEl.find(".btnAttivitaImport").on("click", function () {
                    promoCtrl.eseguiAttivitaPending($(this).attr("id_attivita"), $(this));
                });

                promoEl.find("#imgGarbage_" + rec.id).on("click", function()
                {
                    if(confirm('Sicuro di voler scartare?'))
                    {
                        let _id = $(this).attr("id").replace("imgGarbage_","");
                        promoCtrl.scartaAttivitaPending(_id);
                    }
                });

            }

            if (result.length <= 0) {
                promoEl.find("#importazioniPending").closest(".row").css("display", "none");
            }
            else {
                promoEl.find("#importazioniPending").closest(".row").css("display", "block");
                promoEl.find("#importazioniPending").closest(".row").css("display", "block");
                if (result.length > 1) {
                    //Import multiplo
                    let accBody = promoEl.find(".accordion-body");
                    let b = $(`<button class="btn btn-danger btn-sm ms-3">Importa tutti</button>`);
                    let _divMassivo = $("<div style=\"display:flex;margin-left:10px;background-color: #949d93;padding: 8px;border-radius: 12px;\"></div>");
                    _divMassivo.append($(`<select class="form-select tipo_azione" id="tipo_azione" style="width:180px;">
                    <option value="1">Salva</option>
                    <option selected value="2">Solo report</option>
                    <option value="3">Salva e fai report</option>
                    </select>`));

                    _divMassivo.append(b);
                    accBody.find("#actionButtons").append(_divMassivo);
                    b.on("click", function () {
                        if (confirm('ATTENZIONE, questa operazione importa il dato di tutti i tracciati in attesa di questa prmo ed è irreversibile.Sicuro di voler procedere?'))
                        {
                            

                            //Prenod il valore di .tipo_azione del primo record
                            let _valMassivo = accBody.find("#actionButtons").find(".tipo_azione").val();
                            promoEl.find("#importazioniPending").find(".tipo_azione").val(_valMassivo);
                            promoEl.find("#importazioniPending").find(".tipo_azione").attr("disabled", true);
                            accBody.find("#actionButtons").find(".tipo_azione").attr("disabled", true);

                            $(this).attr("disabled", true);
                            promoEl.find(".btnAttivitaImport").css("display", "none");

                            showLoading();

                            //Il pulsante di import singolo deve sparire definitivamente

                            let _persistenzaMassiva = "false"
                            let _reportMassivo = "false";
                            if (_valMassivo == 1) {
                                _persistenzaMassiva = "true";
                            }                            
                            else if (_valMassivo == 3) {
                                _persistenzaMassiva = "true";
                                _reportMassivo = "true";
                            }
                            else if (_valMassivo == 2) {
                                _reportMassivo = "true";
                            }

                            console.log("attivita/confermaAttivitaDellaPromoByUtente/" + id + "/" + _persistenzaMassiva + "/" + _reportMassivo);


                            Call.do("api", "attivita/confermaAttivitaDellaPromoByUtente/" + id + "/" + _persistenzaMassiva + "/" + _reportMassivo, "GET", null, this, function (result, sender) {
                                if (result.boolEsito) {
                                    let arrAtt = result.esito.split(",");
                                    for (let id_attivita of arrAtt) {
                                        $("#progress_" + id_attivita).css("display", "block");
                                        me.codaProcessi["act_" + id_attivita] = { id_attivita, persistent: true, askReport: true };
                                        taskManager.Add(id_attivita);
                                    }
                                }
                                else {
                                    console.error("Errore: " + result.error);
                                }

                                hideLoading();

                            });
                        }
                    });


                }
            }


            if (indice>=0)
                me.getImportazioniPending(indice + 1);

        });
    }

    crea()
    {
        let obj = { NomePromo: $("#PromoName").val(), ValiditaDal: $("#data_inizio_validita").val(), ValiditaAl: $("#data_fine_validita").val(), DataScadenza: $("#data_scadenza").val() };
        showLoading();
        Call.do("Tracciati", "creaPromo", "PUT", obj, this, function (result, senderOwn) {
            console.log(result);

            hideLoading();
            if (result.esito) {
                senderOwn.refresh();
            }

        });
    }


    async importaTracciato()
    {
        $("#modalImportazioneTracciato").find("input").each(function () {
            $(this).attr("disabled", true);
        });

        $("#modalImportazioneTracciato").find("select").each(function () {
            $(this).attr("disabled", true);
        });

        $("#row_progress").css("display", "block");

        var obj = {};
        obj.files = [];
        obj.filenames = [];

        let obj2 = null;

        var _input_files = $("#modalImportazioneTracciato").find("input[type=file]");
        for (let i_f = 0; i_f < _input_files.length; i_f++)
        {
            var files = document.querySelector('[name=FileTracciato]').files;


            for (let i_fItem = 0; i_fItem < files.length; i_fItem++)
            { 
                const base64 = await convertBase64(files[i_fItem]);
                //obj.files.push(base64);
                obj.files.push(files[i_fItem]);
                //obj.filenames.push(files[0].name);

            }

        }

        /*if (obj.files.length <= 0) {
            alert("Nessun file selezionato!");
            return;
        }*/

        //ATTENZIONE, il tipo tracciato è stato erroneamente messo tra gli optional custom agenzia
        //in realtà ai fini del progetto, questo dato è mandatario quanto l'addestramento
        //Andrà spostato di nuovo da agenzia.js alla pagina statica di Tracciato
        //obj.cmbTipoTracciato = $("#cmbTipoTracciato").val();
        obj.cmbAddestramento = $("#cmbAddestramenti").val();
        obj.idImportazione = $("#cmbImportazione").val();
        obj.idPromo = $("#idPromo").val();
        obj.fields = {};

        if (obj.cmbAddestramento == "0")
        {
            alert("Selezionare schema");
            return;
        }

        var _input_fields = $("#modalImportazioneTracciato").find("input:not([type=file]), select");

        let fd = new FormData();
        //fd.append("cmbTipoTracciato", obj.cmbTipoTracciato);
        //fd.append("cmbAddestramenti", obj.cmbAddestramento);

        let fields = "";
        for (let i_fd = 0; i_fd < _input_fields.length; i_fd++) {

            let _field = $(_input_fields[i_fd]);
            //console.log(_field[0].className);
            fields += _field.attr("id") + "=";

            if (_field[0].className != "form-check-input") {
                obj.fields[_field.attr("id")] = _field.val();
                fields += _field.val();
            }
            else {
                obj.fields[_field.attr("id")] = _field.is(":checked");
                fields += _field.is(":checked");
            }

            fields += "&";
        }

        console.log(fields);


        /*
        let fd2 = new FormData();
        fd2.append("content", obj.files[0]);
        fd2.append("Nome", "Ciao");
        fd2.append("Titolo", "Ciao2");
        fd2.append("fields", fields);



        Call.doWithUpload("Tracciati", "Upload2", "POST", fd2, this, function (result, sender) {

        });*/

        fd = new FormData();
        fd.append("file", obj.files[0]);
        fd.append("requestForms", fields);
        
        Call.doWithUpload("Tracciati", "Upload", "POST", fd, this, function (result, sender) {

            console.log(result);
            //Metto in coda ai processi di check stato l'attività creata
            if (result.attivita != null) {

                $("#row_progress").attr("id_attivita", result.attivita.id);
                taskManager.Add(result.attivita.id);

                $("#row_progress").css("display", "block");
                $("#statoMsg").text("Caricamento in corso");
                $("#progressbar").css("style", "0%");
            }
            //codaProcessi
        });
        
    }

    async eseguiAttivitaPending(id_attivita, senderButton)
    {

        //showLoading();

        let persistent = false;
        let askReport = false;
        let cmb = senderButton.closest(".row").find("#tipo_azione");
        if (cmb.val() == 1) {
            persistent= true;
        }
        if (cmb.val() == 2) {
            askReport = true;
        }
        if (cmb.val() == 3) {
            askReport = true;
            persistent = true;
        }


        Call.do("api", "attivita/confermaAttivitaByUtente/" + id_attivita + "/" + persistent + "/" + askReport, "GET", null, this, function (result, sender) {
            if (result.esito) {
                senderButton.attr("disabled", true);
                $("#progress_" + id_attivita).css("display", "block");
                sender.codaProcessi["act_" + id_attivita] = { id_attivita, persistent: persistent, askReport: askReport, idPromo: senderButton.attr("id_promo") };
                taskManager.Add(id_attivita);
            }
            else {
                console.error("Errore: " + result.error);
            }

            hideLoading();
          
        });
        //attivita / confermaAttivitaByUtente / { id }


    }

    async eseguiImportazioniPendingDellaPromo(id_promo)
    {

        Call.do("api", "attivita/confermaAttivitaByUtente/" + id_attivita + "/" + persistent + "/" + askReport, "GET", null, this, function (result, sender) {
            if (result.esito) {
                senderButton.attr("disabled", true);
                $("#progress_" + id_attivita).css("display", "block");
                sender.codaProcessi["act_" + id_attivita] = { id_attivita, persistent: persistent, askReport: askReport };
                taskManager.Add(id_attivita);
            }
            else {
                console.error("Errore: " + result.error);
            }

            hideLoading();

        });
    }

    async scartaAttivitaPending(id_attivita)
    {
        let rowParent = $("#attivita_" + id_attivita);
        showLoading();
        Call.do("api", "attivita/scartaAttivitaByUtente/" + id_attivita, "GET", null, this, function (result, sender) {
            if (result.esito) {
                $("#attivita_" + id_attivita).remove();
                $("#progress_" + id_attivita).remove();
                delete sender.codaProcessi["act_" + id_attivita];
            }
            else {
                console.error("Errore: " + result.error);
            }

            hideLoading();
        });
    }

    onAttivitaChageStatus(id_attivita, stato) {
        
        if (stato == 6 || stato == 7 || stato == 9) {
            //Refresh pagina

            //setTimeout(function () { window.location = "Tracciati"; }, 2000);
            let details = this.codaProcessi["act_" + id_attivita];
            let rowParent = $("#attivita_" + id_attivita);

            if (details!=null && details.askReport && stato != 7) {
                //Mostrare Vedi report al posto della tendina               
                rowParent.find("#btnReport").remove();
                rowParent.find("#file_attivita").prepend("<input id=\"btnReport\" type=\"button\" class=\"btn btn-primary me-2 btnReport\" id_attivita=\"" + id_attivita + "\" id_promo=\"" + details.idPromo+"\" value=\"Leggi report\">");

                rowParent.find("#btnReport").on("click", function () {
                    promoCtrl.consultaReport($(this).attr("id_attivita"), $(this).attr("id_promo"));
                });

            }

            if (stato == 7) {
                rowParent.find("#btnErrorReport").remove();
                rowParent.find("#file_attivita").prepend("<input id=\"btnErrorReport\" type=\"button\" class=\"btn btn-danger me-2 btnErrorReport\" value=\"Leggi errori\" id_attivita=\"" + id_attivita +"\">");

                rowParent.find("#btnErrorReport").on("click", function () {
                    promoCtrl.consultaErrorReport($(this).attr("id_attivita"));
                });

            }

            delete this.codaProcessi["act_" + id_attivita];

            if (details!=null && !details.persistent) {

                rowParent.find("#btnAttivitaImport").prop("disabled", false);
            }
            


            //Controllo se ci sono attività pending
            if (Object.keys(this.codaProcessi).length == 0) {

                let countBtnErrorInPag = $(".btnErrorReport").length;
                let countBtnReportInPag = $(".btnReport").length;

                //Posso fare refresh della pagina solo se non ci sono report o errori da leggere
                if (countBtnErrorInPag <= 0 && countBtnReportInPag <= 0) {
                    setTimeout(function () { window.location = "Tracciati"; }, 1000);
                }
            }
            else {
                if (details!=null && stato == 6 && !details.askReport) {
                    //Toglo la riga dell'attività in quanto l'importazione è terminata con successo e l'operatore non aveva chiesto il report
                    rowParent.parent().remove();
                }
            }

            

            rowParent.parent().find(".progressBar").each(function () {
                if ($(this).attr("id_attivita") == id_attivita)
                    $(this).css("display", "none");
            })
                

            hideLoading();

            //console.log("FINE");
        }
    }

    esporta(sender) {

        let container = sender.closest(".record_tracciato");
        

        //console.log(container);

        let obj = {
            CartellaDiEsportazione: container.find("#CartellaDiEsportazione").val(),
            ChEsportaDaArchivio: container.find("#ChEsportaDaArchivio").is(":checked"),
            ChEsportaFoto: container.find("#ChEsportaFoto").is(":checked"),
            ChEsportaDaMenabo: false,
            fields: {
                id_tracciato: container.attr("id_tracciato")
            }
        };

        Call.do("Tracciati", "esporta", "PUT", obj, this, function (result, me) {
            console.log(result);
            container.find(".progressBar").css("display", "block");
            container.find(".progressBar").attr("id_attivita", result.attivita.id);
            taskManager.Add(result.attivita.id);

        });
    }

    impostaBadgeRevisioni(sender) {
        console.log(sender);
        let me = this;
        sender.parent().find(".fa-exclamation-triangle").css("display", "none");
        var promoAperta = sender.closest(".accordion-item").find(".accordion-button");
        sender.html('Revisiona <span class=\"spinner-border spinner-border-sm\" role=\"status\" aria-hidden=\"true\"></span>');

        
        //promoAperte.each(function () {
            //let promo = $(this);
        let idPromo = promoAperta.attr("idpromo");
        Call.do("Revisore", "ControllaRevisioniPromo/" + idPromo, "Get", null, this, function (result, sender) {
            console.log(promoAperta.parent());
            console.log(promoAperta.parent().find("#b_revisione"));
            me.replaceSpinnerWithBadge(promoAperta.closest(".accordion-item").find("#b_revisione"), result);
        });
        //});
    }

    replaceSpinnerWithBadge(btn, numeroBadge) {
        btn.html('Revisiona <span class="badge bg-secondary">' + numeroBadge + '</span>');
    }

    apriRevisioniModal(idPromo) {

    }

    tracciatoCheckboxModificato(checkBox) {
        let checkBoxVal = checkBox.prop('checked');
        console.log(checkBoxVal);
        if (checkBoxVal) {
            var modalBody = $("#RevisioniModal").find(".modal-body");
            var checkboxes = modalBody.find('input[type="checkbox"]');
            let link = "Revisore?id_promo=" + 0 + "&id_tracciati=";
            checkboxes.filter(':checked').each(function () {
                link += $(this).attr("idTracciato") + ",";
            });
            link = link.replace(/,$/, "");
            $("#RevisioniModal").find("#aperturaTracciatiSelezionati").prop("disabled", false);
            $("#RevisioniModal").find("#aperturaTracciatiSelezionati").attr("href", link);
        }
        else {
            var modalBody = $("#RevisioniModal").find(".modal-body");
            var checkboxes = modalBody.find('input[type="checkbox"]');
            var countChecked = checkboxes.filter(':checked').length;
            if (countChecked == 0) {
                $("#RevisioniModal").find("#aperturaTracciatiSelezionati").prop("disabled", true);
                $("#RevisioniModal").find("#aperturaTracciatiSelezionati").attr("href", "");
            }
            else {
                let link = "Revisore?id_promo=" + 0 + "&id_tracciati=";
                checkboxes.filter(':checked').each(function () {
                    link += $(this).attr("idTracciato") + ",";
                });
                link = link.replace(/,$/, "");
                $("#RevisioniModal").find("#aperturaTracciatiSelezionati").attr("href", link);
            }
        }
    }

    downloadForDataDump(idPromo) {
        showLoading();
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "/" + getWebAppRootFolder() + 'Tracciati/downloadForDump/'+idPromo, true);
        xhr.responseType = 'blob';

        xhr.onload = function () {
            if (this.status === 200) {
                var blob = new Blob([this.response], { type: 'application/json' });
                var downloadUrl = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = downloadUrl;
                a.download = "data"+idPromo+".json";
                document.body.appendChild(a);
                a.click();
                a.remove();  // Dopo il click rimuove l'elemento <a> dal DOM

                hideLoading();
            }
        };

        xhr.send();
    }

    searchReportTable = function (stato) {
        let searchValue = $("#searchInput").val().toLowerCase();
        let rows = $("#reportTable tbody tr");

        rows.each(function () {
            let row = $(this);
            let myStato = row.attr("stato");
            let codice = row.find("td").eq(1).text().toLowerCase(); // colonna "Codice"

            if (stato != null) {
                // Filtraggio per stato (Inalterato, Cambiato, etc.)
                if (myStato == stato.toString()) {
                    row.show();
                } else {
                    row.hide();
                }
            } else {
                // Filtraggio per testo (codice)
                if (codice.includes(searchValue)) {
                    row.show();
                } else {
                    row.hide();
                }
            }
        });
    }

    consultaReport(id_attivita, id_promo) {
        showLoading();

        var colonneDinamiche = []

        if (this.agenzia.getParametriReport != null) {
            colonneDinamiche = this.agenzia.getParametriReport();
        } // es: ['area', 'descrizione_iniziativa', ...]
        //const colonneFisse = ['AC', 'Referenza.Codice', 'Alterazioni'];

        let me = this;

        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('imported_files/' + id_attivita + '/Report.json?v' + rndVersion, function (data) {
            console.log(data);

            me.repordDbCache = data;

            let ref_cambiate = 0;
            let ref_nuove = 0;
            let ref_uscite = 0;
            let ref_inalterate = data.length;

            let body = $("#ReportAttivita").find(".modal-body");
            body.empty();

            let tblRows = "";

            for (let i = 0; i < data.length; i++) {
                let item = data[i];
                let stato = 1;
                let bkgRow = "white";

                if (item.versione === 1) {
                    stato = 3;
                    bkgRow = "#ceebcb";
                    ref_nuove++;
                    ref_inalterate--;
                } else if (item.versione === -1) {
                    stato = 4;
                    bkgRow = "orange";
                    ref_uscite++;
                    ref_inalterate--;
                }

                let alterazione = item.Alterazioni;
                let alteredKeys = alterazione ? Object.keys(alterazione) : [];
                let isAltered = alteredKeys.length > 0;

                let riepilogo_alterazioni = "";
                if (isAltered) {
                    stato = 2;
                    bkgRow = "#ebcbcb";
                    ref_cambiate++;
                    ref_inalterate--;
                    alteredKeys.forEach(key => {
                        riepilogo_alterazioni += key + "<br>";
                    });
                }

                tblRows += `<tr style="background-color:${bkgRow};" stato="${stato}">`;

                // 🔒 Colonne Fisse
                tblRows += `<td><input type="checkbox" ${stato==3?"":"disabled"} class="chDirectAct"></td>`;
                tblRows += `<td>${item.AC ?? ""}</td>`;
                tblRows += `<td>${item["Referenza.Codice"] ?? ""}</td>`;
                tblRows += `<td>${riepilogo_alterazioni}</td>`;

                // ➕ Colonne Dinamiche
                colonneDinamiche.forEach(col => {
                    let valore = item[col] ?? "";
                    let cellStyle = "";
                    let cellTooltip = "";

                    if (alterazione && alterazione[col] != null) {
                        cellStyle = "background-color:yellow;";
                        cellTooltip = `title="Da: ${alterazione[col]} → A: ${valore}"`;
                    }

                    tblRows += `<td style="${cellStyle}" ${cellTooltip}>${valore}</td>`;
                });

                tblRows += `</tr>`;
            }

            // Costruzione dell’header
            let headerHTML = `
            <tr style="background:white;">
                <th></th>
                <th>Area/canale</th>
                <th>Codice</th>
                <th>Alterazioni</th>
                ${colonneDinamiche.map(col => `<th>${col}</th>`).join("")}
            </tr>
        `;

            let tableHTML = `
            <div class="table-responsive" style="overflow-x:auto;">
                <table class="table table-bordered table-hover" id="reportTable">
                    <thead>${headerHTML}</thead>
                    <tbody>${tblRows}</tbody>
                </table>
            </div>
        `;

            let searchBarHTML = `
            <div id="reportSearchBar" style="position:sticky; top:0; background:white; z-index:10; padding:10px;">
                <input type="text" class="form-control mb-2" id="searchInput" placeholder="Cerca..." onkeyup="promoCtrl.searchReportTable()">
                <div style="margin-bottom:10px;display:flex;">
                    <select id="cmbAzioneDirettaSuReport" class="form-select" style="width:200px;">
                        <option value="-3" selected>Seleziona azione...</option>
                        <option value="-2">Seleziona tutti...</option>
                        <option value="-1">Deseleziona tutti...</option>
                        <option value="1">Integra selezionati in tracciato</option>
                    </select>
                    <input type="button" filter="1" class="btn btn-primary me-2 btnFilter" value="Inalterati (${ref_inalterate})">
                    <input type="button" filter="2" class="btn btn-primary me-2 btnFilter" value="Cambiati (${ref_cambiate})">
                    <input type="button" filter="3" class="btn btn-primary me-2 btnFilter" value="Nuovi (${ref_nuove})">
                    <input type="button" filter="4" class="btn btn-primary me-2 btnFilter" value="Usciti (${ref_uscite})">
                </div>
            </div>
        `;
            

            body.append(searchBarHTML);
            body.append(tableHTML);

            body.find(".btnFilter").on("click", function () {
                promoCtrl.searchReportTable($(this).attr("filter"));
            });

            $("#cmbAzioneDirettaSuReport").on("change", function () {

                if ($(this).val() > 0) {
                    if (confirm("Attenzione, l'operazione che stai per confermare altera in maniera irreversibile il dato del tracciato. Sicuro di continuare?")) {

                        showLoading();
                        //Collezioo i records selezionati
                        let selectedRecords = [];
                        $("#reportTable tbody tr").each(function () {
                            let row = $(this);
                            let isChecked = row.find(".chDirectAct").is(":checked");
                            let isVisibile = row.css("display") != "none";

                            if (isChecked && isVisibile) {
                                let codiceRef = row.find("td").eq(2).text(); // colonna "Codice"
                                let areacanale = row.find("td").eq(1).text(); // colonna "Codice"
                                selectedRecords.push({ cr: codiceRef, ac: areacanale });
                            }
                        });

                        let refsToUpload = [];
                        //Ciclo i codici e li pesco dal db cache
                        for (let i = 0; i < selectedRecords.length; i++) {
                            let _obj = selectedRecords[i];
                            let objInDb = me.repordDbCache.find(f => f["Referenza.Codice"] == _obj.cr && f["AC"] == _obj.ac);
                            if (objInDb != null) {
                                refsToUpload.push({ codice: objInDb["Referenza.Codice"], ac: objInDb["AC"], result:"" });
                            }
                        }

                        let _req = { items: refsToUpload, idPromo: Number(id_promo), idAttivita: Number(id_attivita) };
                        console.log(JSON.stringify(_req));

                        $.ajax({
                            //dataType: 'json',
                            type: "PUT",
                            url: "/" + getWebAppRootFolder() + "Tracciati/integrazioneMirataInTracciato",
                            contentType: "application/json; charset=utf-8",
                            data: JSON.stringify(_req),
                            xhrFields: {
                                responseType: 'application/json'  // Assicura che la risposta sia gestita come Blob
                            },
                            success: function (data, textStatus, xhr) {
                                console.log(data);
                                if (data.esito) {
                                    for (let i = 0; i < data.output.length; i++) {
                                        let resItem = data.output[i];
                                        //Aggiorno la riga
                                        $("#reportTable tbody tr").each(function () {
                                            let row = $(this);
                                            let codiceRef = row.find("td").eq(2).text(); // colonna "Codice"
                                            let areacanale = row.find("td").eq(1).text(); // colonna "Codice"
                                            if (resItem.codice == codiceRef && resItem.ac == areacanale && resItem.result == "ok") {//Trovata la riga
                                                row.css("background-color", "#fdb6f1");
                                            }
                                            else {
                                                row.css("background-color", "rgb(142 95 143)");                                             
                                            }
                                        });
                                    }
                                }
                                else {
                                    alert(data.error);
                                }
                                hideLoading();
                            }
                        });

                        //Call.do("Tracciati", "integrazioneMirataInTracciato", "PUT", _req, this, function (result, sender) {
                        //    console.log(result);
                        //});

                    }
                }
                else if ($(this).val() == -2) {
                    //Seleziono tutti
                    $("#reportTable tbody tr").each(function () {
                        //Controllo se visibile
                        if ($(this).css("display")!="none")
                            $(this).find(".chDirectAct").prop("checked", true);
                    });
                }
                else if ($(this).val() == -1) {
                    //Deseleziono tutti
                    $("#reportTable tbody tr").each(function () {
                        //Controllo se visibile
                        if ($(this).css("display") != "none")
                            $(this).find(".chDirectAct").prop("checked", false);
                    });
                }

                $(this).val(-3);

            });

            $("#ReportAttivita").modal("show");
            hideLoading();
        });
    }



    consultaErrorReport(id_attivita) {
        showLoading();
        Call.do("api", "attivita/getLogErrorAttivita/" + id_attivita, "GET", null, this, function (result, sender) {

            let body = $("#ReportErrorsAttivita").find(".modal-body");
            body.empty();

            if (result.length > 0) {
                let str = "";
                for (let i = 0; i < result.length; i++)
                    str += "<b>"+(i+1) + ".</b> " + result[i] + "<br>";

                body.append(str);
            }
            else {
                body.append("Nessun errore riscontrato");
            }


            $("#ReportErrorsAttivita").modal("show");

            hideLoading();

        });

    }

    prepareLinkToFP(guidIdPromo) {
        showLoading();
        Call.do("FicoProcess", "getAuthUrlSchedaPromoLavorazioneToFP", "PUT", { guidIdPromo: guidIdPromo }, null, function (result, sender) {
            console.log("Risultato")
            console.log(result);

            if (result.esito) {
                //Crea link e aprilo in _blank
                let url = result.url;
                let a = document.createElement("a");
                a.href = url;
                a.target = "_blank";
                a.click();

            }
            else {
                let url ="Login";
                let a = document.createElement("a");
                a.href = url;
                a.target = "_self";
                a.click();
            }

            hideLoading();
        });
    }
}