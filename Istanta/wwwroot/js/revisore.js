class Revisore {
    List = [];
    ListSottogruppi = [];
    labelSource = [];
    pagCapacity = 20;
    agenzia;
    currentPage = 0;
    tot_pages = 0;
    currentList = [];
    listCustomSearchAgenzia = [];
    normalPageCapacity = 50;
    pageList = [];
    listTracciati = [];
    listIdTracciatiPartenza = [];
    listIdTracciatiRichiesti = [];
    primoCaricamento = true;
    modalitaSottogruppi = false;
    gruppiVisualizzati = true;
    olimpoIp = "";
    areePromo = [];
    canaliPromo = [];
    pingInterval;
    scrollToTop = false;

    constructor() {
        showLoading();
        this.agenzia = new Agenzia();

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

        if (this.agenzia.impostaFiltriCustom != null) {
            this.agenzia.impostaFiltriCustom();
        }
        try {
            if (this.pingInterval != null) {
                clearInterval(this.pingInterval);
            }

            this.pingInterval = setInterval(function () {

                fetch(getWebAppRootUrl() + "ping");

            }, 10000);
        }
        catch {

        }

    }

    loadLabel() {
        let me = this;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source' + exPathCustom + '/SourceLabels.json?v=1.' + rndVersion, function (data) {
            console.log(data);
            me.labelSource = data.source;
            //fa partire la ricerca del tracciato 
            
            me.cerca(0);
        });
    }

    compilaTracciati() {
        let ME = this;
        let idTracciati = this.listIdTracciatiPartenza;
        let idPromo = parseInt($("#Promo").val());
        if (idPromo != 0) {
            Call.do("Tracciati", "GetTracciatiPromo/" + idPromo, "GET", null, ME, function (result, sender) {
                console.log("Risultato di GetTracciatiPromo");
                console.log(result);
                if (typeof result !== 'string') {
                    ME.listTracciati = ME.listTracciati.concat(result);

                    var selectElement = $("#CmbTracciato");

                    // Aggiungi opzioni dinamicamente
                    ME.listTracciati.forEach(function (item) {
                        var optionElement = $("<option>")
                            .val(item.id)
                            .text(item.sigla);
                        selectElement.append(optionElement);
                    });

                    //if (sender.agenzia.ordinaListaSelezioneTracciato != null) {
                    //    sender.agenzia.ordinaListaSelezioneTracciato();
                    //}

                    if (sender.agenzia.applicaSchemaDiOrdinamentoTracciati != null) {
                        const $select = $("#CmbTracciato");
                        const $options = $select.find("option");
                        const $firstOption = $options.filter('[value="0"]');

                        let _list = [];
                        $("#CmbTracciato").find("option").each(function () {
                            let _lab = $(this)[0].label;
                            if (_lab != "Tutti i tracciati") {
                                _list.push(_lab);
                            }
                        });

                        _list = sender.agenzia.applicaSchemaDiOrdinamentoTracciati(_list, "");


                        let _optionsOrdered = [];
                        for (let i = 0; i < _list.length; i++) {
                            _optionsOrdered.push($("#CmbTracciato").find("option").filter(function () { return $(this).text() == _list[i]; }));
                        }

                        // Svuota e reinserisce le option
                        $select.empty();
                        if ($firstOption.length>0) $select.append($firstOption);
                        $select.append(_optionsOrdered);

                    }

                }
                else {
                    console.log(result);
                }
            });
        }
        else {
            if (idTracciati.length >= 1) {
                Call.do("Tracciati", "GetTracciatiPromoByIdTracc/" + idTracciati[0], "GET", null, ME, function (result, sender) {
                    if (typeof result !== 'string') {
                        ME.listTracciati = ME.listTracciati.concat(result);

                        var selectElement = $("#CmbTracciato");

                        // Aggiungi opzioni dinamicamente
                        ME.listTracciati.forEach(function (item) {
                            var optionElement = $("<option>")
                                .val(item.id)
                                .text(item.sigla);
                            selectElement.append(optionElement);
                        });
                        selectElement.val(idTracciati);

                    }
                    else {
                        console.log(result);
                    }
                });
            }
        }
    }

    socketOnMessage(message) {
        console.log("onmessage content: " + message);
        if (message.comando == "revisioneArticolo") {
            let codice_gruppo = message.codiceGruppo;
            let codice = message.codice;
    
            //Cerco nella pagina per disabilitarlo subito
            if (codice_gruppo != null && codice_gruppo != codice) {

                //Intanto nel dato flaggo il gruppo come scaduto
                let itemsGruppo = revInstance.List.filter(f => f.isGruppo && f.recordInTracciato["Scatto.CodiceGruppo"] == codice_gruppo);
                itemsGruppo.forEach(function (item) {
                    item.scaduto = true;
                    item.utenteCheHaRevisionato = message.utenteCheHaRevisionato;
                });

                //La revisione coinvolge un gruppo
                $("#_list_container").find(".padreGruppo").each(function () {
                    //Ciclo i gruppo
                    let cod_gruppo_el = $(this).attr("codice_gruppo");
                    if (codice_gruppo == cod_gruppo_el) {
                        //La revisione si concentra su questo gruppo
                        $(this).find("li").each(function () {
                            let codice_elG = $(this).find("div").attr("codice_gruppo");
                            let codice_elS = $(this).find("div").attr("referenzacodice");
                            if (codice_elG != null && codice_elG != "" && codice_elG == codice_gruppo && (codice_elS == null || codice_elS.length<=0)) {
                                //Trovato il record del gruppo da offuscare
                                //$(this).css("opacity", 0.4);
                                //$(this).css("pointer-events", "none");
                                revInstance.applicaStatoScadutoAlRecord($(this), message);
                            }
                        });
                        
                    }
                });
            }
            else
            {
                //Intanto nel dato flaggo il singolo come scaduto
                let itemsSingolo = revInstance.List.filter(f => !f.isGruppo && f.recordInTracciato["Referenza.Codice"] == codice);
                itemsSingolo.forEach(function (item) {
                    item.scaduto = true;
                    item.utenteCheHaRevisionato = message.utenteCheHaRevisionato;
                });

                $("#_list_container").find(".record-revisione").each(function () {
                    //Ciclo i singoli
                    let codice_el = $(this).attr("referenzacodice");
                    if (codice_el == codice) {
                        //Trovato record del singolo da offuscare
                        //$(this).css("opacity", 0.4);
                        //$(this).css("pointer-events", "none");
                        revInstance.applicaStatoScadutoAlRecord($(this), message);
                    }
                });
            }

        }
    }

    applicaStatoScadutoAlRecord(el, details) {

        let containerDiRiferimento = el;
        let containerDovePosizionareLoStatoDiScaduto = el;
        let _class = el[0].localName;
        if (_class == "div") {
            //Si tratta di un componente singolo indipendente
            let _header = el.find("#riga_revisione");
            _class = el.parent()[0].className;
            if (_class != "list-group-item list-group-item-light") {
                containerDovePosizionareLoStatoDiScaduto = _header;            
            }
        }
        else if (_class == "li") {
            //Si tratta di un componente dentro cornice gruppo
            //Si lascia com'è
        }

        if (el.parent().find(".bannerStatoScaduto").length === 0)
        {
            el.css("opacity", 0.4);
            el.css("pointer-events", "none");

            if (_class == "li" || _class=="list-group-item list-group-item-light") {
                containerDovePosizionareLoStatoDiScaduto.append("<div style=\"width:98%;height:100px;background: #ed143d57;position: absolute;top: 0px;margin: 0px auto;display:flex;padding-top:16px;\"><div style=\"width:50%;text-align:right;\"><img src=\"images/revScaduta.svg\" style=\"width:60px;\"></div><div style=\"margin-top:16px;margin-left:20px;font-size:18px;color:black;font-weight:bold;\">" + details.utenteCheHaRevisionato + "</div></div>");
            }
            else {
                let hHeader = containerDovePosizionareLoStatoDiScaduto.height();
                containerDovePosizionareLoStatoDiScaduto.append("<div style=\"width:98%;height:100px;background: #ed143d57;position: relative;display:flex;padding-top:16px;margin-top:-" + hHeader +"px\"><div style=\"width:50%;text-align:right;\"><img src=\"images/revScaduta.svg\" style=\"width:60px;\"></div><div style=\"margin-top:16px;margin-left:20px;font-size:18px;color:black;font-weight:bold;\">" + details.utenteCheHaRevisionato + "</div></div>");
            }
        }



    }

    cerca(indice) {
        this.modalitaSottogruppi = false;
        this.ListSottogruppi = [];
        $("#chkCercaSottogruppi").prop("checked", false);
        //var str_cod="";
        let me = this;
        let rep = $("#CmbReparto").val()
        //if (rep === "0") {
        //    //Ripulisco lista
        //    return;
        //}

        console.log("CERCA > " + this.primoCaricamento);

        if (!this.primoCaricamento) {
            this.listIdTracciatiRichiesti = $("#CmbTracciato").val().map(function (valore) {
                return parseInt(valore, 10);
            });

            console.log(this.listIdTracciatiRichiesti);

            if (this.listIdTracciatiRichiesti.length == 0) {
                this.listIdTracciatiRichiesti = [0];
                var selectElement = $("#CmbTracciato");
                selectElement.val(0);
            }
            else if (this.listIdTracciatiRichiesti.length > 1 && this.listIdTracciatiRichiesti.includes(0)) {
                var selectElement = $("#CmbTracciato");
                this.listIdTracciatiRichiesti = this.listIdTracciatiRichiesti.filter(function (elemento) {
                    return elemento !== 0;
                });
                selectElement.val(this.listIdTracciatiRichiesti);
            }
        }
        else {
            console.log("No primo caricamento");
            this.primoCaricamento = false;
        }

        let obj = {
            IdTracciatiPartenza: this.listIdTracciatiPartenza,
            IdPromo: parseInt($("#Promo").val()),
            IdTracciatiRichiesti: this.listIdTracciatiRichiesti,
            metaPerSuggerimento: this.agenzia.getCampiToCheckMismatch != null ? this.agenzia.getCampiToCheckMismatch() : [],
        };
        obj.IdTracciatiRichiesti = obj.IdTracciatiRichiesti.map(function (valore) {
            return parseInt(valore, 10);
        });


        showLoading();
        //Preparazione richiesta
        console.log("....getListaRevisione");
        Call.do("Revisore", "getListaRevisione2", "POST", obj, this, function (result, sender) {
            console.log("....getListaRevisione -> RESULT");
            console.log(result);

            if (sender.agenzia.applyFilterToList != null) {
                result.data = sender.agenzia.applyFilterToList(result.data);
            }

            sender.List = result.data;
            console.warn(sender.List.filter(f => f.recordInTracciato[keyRefCodice] == "6568087"));
            console.warn(sender.List.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == "6568087,6568424,6568496,6568689,6568706"));
            console.warn(sender.List.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == "5484897,7064674,7064689,7064693"));
            
            sender.List.forEach(function (singleItem) {
                if (singleItem.label != null && $("#serach_label").find('option[value="' + singleItem.label + '"]').length === 0) {
                    try {

                        $("#serach_label").append("<option value=\"" + singleItem.label + "\">" + me.labelSource.find(f => f.Codice == singleItem.label).Nome + "</option>");
                    }
                    catch {
                    }
                }

                //calcoliamo l'intersezione delle eventuali keyinmismatch
                if (singleItem.recordInTracciato[keyScattoCodiceGruppo] == "4075348,5030249,5030287,5030342") {
                    console.log("");
                }
                if (singleItem.recordInTracciato.metaKeyInMismatch == null) {
                    singleItem.recordInTracciato.metaKeyInMismatch = [];
                }
                singleItem.recordInTracciato.metaKeyInMismatch = sender.normalizeMetaByOriginGroups(singleItem.recordInTracciato.metaKeyInMismatch);
                if (singleItem.recordInTracciato[keyScattoCodiceGruppo] == "4075348,5030249,5030287,5030342") {
                    console.log("");
                }
            });
            /*sender.agenzia.vuoiAggiungereFiltri(sender.List);*/

            sender.tot_pages = parseInt(sender.List.length / sender.pagCapacity) + (sender.List.length % sender.pagCapacity == 0 ? 0 : 1);
            //console.log(sender.List.length + " -> " + tot_pages);
            console.log(indice);
            if (sender.tot_pages > 0) {
                sender.agenzia.vuoiAggiungereFiltri(sender.List);

                //ordInstance.ordinaRecordsTracciato(sender.List, sender.agenzia, function (orderedList) {
                //    console.log("lista ordinata");
                //    console.log(orderedList);
                //    console.warn(sender.List.filter(f => f.recordInTracciato[keyRefCodice] == "6568087"));
                //    console.warn(sender.List.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == "6568087,6568424,6568496,6568689,6568706"));
                //    sender.List = orderedList;
                //    sender.List = sender.agenzia.filterRecordsTracciatiOnMenabo(orderedList);
                //    console.warn(sender.List.filter(f => f.recordInTracciato[keyRefCodice] == "6568087"));
                //    console.warn(sender.List.filter(f => f.recordInTracciato[keyScattoCodiceGruppo] == "6568087,6568424,6568496,6568689,6568706"));
                //    console.log("Fine ordinamento 2");

                //    sender.preparaListaDaCaricare(0);
                //});
                sender.preparaListaDaCaricare(0);


                //if (sender.agenzia.ordinaRecordsTracciatoInMenabo != null) {
                //    //Eseguo un ordinamento
                //    console.log("Inizio ordinamento");
                //    sender.agenzia.ordinaRecordsTracciatoInMenabo(result.data, function (orderedList) {
                //        //console.log(orderedList);
                //        console.log(orderedList);
                //        sender.List = orderedList;
                //        console.log("Fine ordinamento");

                //        //sender.impostaRevisioniMode();
                //        sender.preparaListaDaCaricare(0);

                //    });
                //}
                //else {

                //    //sender.impostaRevisioniMode();
                //    sender.preparaListaDaCaricare(0);
                //}
                //sender.caricaPagina(indice, revisioniList);

            }
            else {
                sender.preparaListaDaCaricare(0);
                hideLoading();
            }

            //sender.preparaListaDaCaricare();
        });
    }

    caricaPagina(indice, list) {
        let me = this;
        this.calcolaPagine(list);
        this.tot_pages = this.pageList.length;
        $(".totPage").val(this.tot_pages);
        this.currentList = list;
        $("#_list_container").html("");
        this.setCurrentPage(indice);
        $(".currentPage").val(this.currentPage);
        let skipTo = 0;
        let recordDaCaricare = this.pageList[0];
        for (let i = 0; i < indice; i++) {
            skipTo += this.pageList[i];
            recordDaCaricare = this.pageList[i+1];
        }
        let cod_gruppo_current = "";

        showLoading();

        console.log("LISTA FILTRATA");
        console.log(list);
        //da correggere
        for (let i = skipTo; i < skipTo + recordDaCaricare; i++) {
            if (i >= list.length) {
                (revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)
                //Ho raggiunto il record finale
                break;
            }


            let dataItem = list[i];
            if (dataItem.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == "6271157,6271180")
                "sasas".toString();

            let inTrac = dataItem.recordInTracciato;
            //let revisionato = dataItem.recordRevisionato;

            let codGruppo = inTrac[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];

            //let test = { nome: "Ciao" };
            //console.log(test.nome);
            //console.log(test["nome"]);
            var mode = $("#filtraPerGruppiOSingoli").val();

            if (cod_gruppo_current != codGruppo && mode != "singoli") {
                //<li  class="list-group-item list-group-item-action
                //Il gruppo è cambiato, tutto il gruppo corrente per cui dovrebbe essere già piazzato nella lista
                //E' il momento di controllare se posso costruire un nuovo gruppo
                if (cod_gruppo_current != "")
                    this.costruisciGruppo(cod_gruppo_current);

                cod_gruppo_current = inTrac[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];
            }


            //Funzione dichiarata in components.js
            let mostraFirma = false;
            if (this.agenzia.mostraFirmaTracciato != null) {
                mostraFirma = this.agenzia.mostraFirmaTracciato();
            }
            let htmlItem = renderRecordRevisione("template", dataItem, this.agenzia, me.List, this.olimpoIp, false, null, null, revInstance.modalitaSottogruppi, mostraFirma);
            if (this.agenzia.compilaBoxConInformazioniCustom != null) {
                this.agenzia.compilaBoxConInformazioniCustom(htmlItem, dataItem);
            }

            $("#_list_container").append(htmlItem);


        }


        if (cod_gruppo_current != "")
            this.costruisciGruppo(cod_gruppo_current);



        if (this.modalitaSottogruppi) {
            let codiciGruppoUnici = [];
            $('.padreGruppo').each(function () {
                var primoFiglioConIdRef = $(this).find('[referenzaCodice]').first();
                var codiceGruppoFiglio = primoFiglioConIdRef.attr('codice_gruppo');

                if (!codiciGruppoUnici.includes(codiceGruppoFiglio)) {
                    // Se il codice gruppo del figlio non è presente nella lista, lo aggiungiamo
                    codiciGruppoUnici.push(codiceGruppoFiglio);
                }
            });
            console.log('Lista di codici sottoGruppo unici:', codiciGruppoUnici);
            let listItemInPagina = this.List.filter(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceSottogruppo] != null && codiciGruppoUnici.includes(f.recordInTracciato[keyScattoCodiceSottogruppo]));
            console.log('Lista di elementi singoli in pagina:', listItemInPagina);
            let listaGruppiNonCorrispondentiAlCodiceSottogruppo = [];

            listItemInPagina.forEach(function (item) {
                if (item.recordInTracciato[keyScattoCodiceGruppo] != item.recordInTracciato[keyScattoCodiceSottogruppo]) {
                    let groupAlreadyInList = listaGruppiNonCorrispondentiAlCodiceSottogruppo.find(f => f.gruppoItem.recordInTracciato[keyScattoCodiceGruppo] == item.recordInTracciato[keyScattoCodiceGruppo]);
                    if (groupAlreadyInList == null) {
                        let GruppoNonCorrispondentiAlCodiceSottogruppo = {
                            gruppoItem: null,
                            listCodiciSottogruppi: [],
                            listSingoli: []
                        };

                        GruppoNonCorrispondentiAlCodiceSottogruppo.gruppoItem = me.ListSottogruppi.find(f => f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == item.recordInTracciato[keyScattoCodiceGruppo]);
                        GruppoNonCorrispondentiAlCodiceSottogruppo.listCodiciSottogruppi.push(item.recordInTracciato[keyScattoCodiceSottogruppo]);
                        listaGruppiNonCorrispondentiAlCodiceSottogruppo.push(GruppoNonCorrispondentiAlCodiceSottogruppo);
                    }
                    else if (!groupAlreadyInList.listCodiciSottogruppi.includes(item.recordInTracciato[keyScattoCodiceSottogruppo])) {
                        groupAlreadyInList.listCodiciSottogruppi.push(item.recordInTracciato[keyScattoCodiceSottogruppo]);
                    }
                }
            });
            console.log('Lista di gruppi differenti dal loro codice sottogruppo:', listaGruppiNonCorrispondentiAlCodiceSottogruppo);
            listaGruppiNonCorrispondentiAlCodiceSottogruppo.forEach(function (item) {
                let codGruppo = item.gruppoItem.recordInTracciato[keyScattoCodiceGruppo];
                item.listSingoli = item.listSingoli.concat(me.ListSottogruppi.filter(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceGruppo] == codGruppo && f.recordInTracciato[keyScattoCodiceSottogruppo] == null));
            });
            console.log('Lista di gruppi differenti dal loro codice sottogruppo:', listaGruppiNonCorrispondentiAlCodiceSottogruppo);
            renderGruppiModalitaSottogruppo("gruppoDelSottogruppo", listaGruppiNonCorrispondentiAlCodiceSottogruppo);
        }



        this.sostituisciSottogruppoButton();
        this.riempiBoxFirmeTracciato();
        this.sostituisciColonnaSinistraGruppo();
        if (this.agenzia.AggiungiDettagliElementiInRevisore != null) {
            this.agenzia.AggiungiDettagliElementiInRevisore();
        }
        hideLoading();
    }

    calcolaPagine(list) {
        this.pageList = [];
        let currentGroup = "";
        let macroCurrentGroupPerSottogruppi = "";
        let ME = this;
        let pageElementsNumber = 0;
        list.forEach(function (item) {
            if (!item.isGruppo && item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[keyRefCodice]) {
                if (pageElementsNumber <= ME.normalPageCapacity) {
                    pageElementsNumber++;
                }
                else {
                    ME.pageList.push(pageElementsNumber);
                    pageElementsNumber = 1;
                }
                currentGroup = "";
                macroCurrentGroupPerSottogruppi = "";
            }
            if (item.isGruppo || (item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] != item.recordInTracciato[keyRefCodice])) {
                if (!item.isGruppo && item.recordInTracciato[keyRefCodice] == "4981667") {
                    console.log();
                }
                if (currentGroup == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]) {
                    pageElementsNumber++;
                }
                else if (currentGroup != item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] && pageElementsNumber <= ME.normalPageCapacity) {
                    pageElementsNumber++;
                }
                else {
                    if (macroCurrentGroupPerSottogruppi == item.recordInTracciato[keyScattoCodiceGruppo]) {
                        pageElementsNumber++;
                    }
                    else if (macroCurrentGroupPerSottogruppi != item.recordInTracciato[keyScattoCodiceGruppo] && pageElementsNumber <= ME.normalPageCapacity) {
                        pageElementsNumber++;
                    }
                    else {
                        ME.pageList.push(pageElementsNumber);
                        pageElementsNumber = 1;
                    }


                    //ME.pageList.push(pageElementsNumber);
                    //pageElementsNumber = 1;
                }
                currentGroup = item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];
                macroCurrentGroupPerSottogruppi = item.recordInTracciato[keyScattoCodiceGruppo];

            }
        });
        ME.pageList.push(pageElementsNumber);
    }



    costruisciGruppo(codGruppo) {

        if (codGruppo == "4974822,4974823,4974824,4974826,4974829")
            "sasas".toString();

        let gruppoHtml = $("#_list_container").find("ul[codice_gruppo='" + codGruppo + "']");
        if (gruppoHtml.length <= 0) {

            let childs = $("#_list_container").find(".record-revisione[codice_gruppo='" + codGruppo + "']");

            if (childs.length > 1) {
                //E' un vero gruppo per cui lo creo
                //Posso costruirlo
                gruppoHtml = $("<ul class=\"padreGruppo list-group border border-primary border-4 mb-4\" codice_gruppo=\"" + codGruppo + "\"></ul>");
                $("#_list_container").append(gruppoHtml);

                let gruppo_found = false;

                childs.toArray()
                    .sort((a, b) => {
                        const getSel = el => {
                            const attr = $(el).find(".colImg").attr("selezione");
                            return attr ? parseInt(attr) : 99; // assegna 99 a chi non ha selezione
                        };
                        return getSel(a) - getSel(b);
                    })
                    .forEach(function (el) {
                        const $el = $(el);
                        if ($el.attr("is_gruppo") == "true") {
                            gruppoHtml.prepend("<li class=\"list-group-item list-group-item-success\" aria-current=\"true\"></li>");
                            gruppoHtml.find("li").first().append($el);
                            gruppo_found = true;
                        } else {
                            gruppoHtml.append("<li class=\"list-group-item list-group-item-light\" aria-current=\"true\"></li>");
                            gruppoHtml.find("li").last().append($el);
                        }
                    });

                //childs.each(function () {

                //    if ($(this).attr("is_gruppo") == "true") {
                //        gruppoHtml.prepend("<li class=\"list-group-item list-group-item-success\" aria-current=\"true\"></li>");
                //        gruppoHtml.find("li").first().append($(this));
                //        gruppo_found = true;
                //    }
                //    else {
                //        gruppoHtml.append("<li class=\"list-group-item list-group-item-light\" aria-current=\"true\"></li>");
                //        gruppoHtml.find("li").last().append($(this));
                //    }

                //})

                if (!gruppo_found) {
                    //Il gruppo deve essere creato esplicitamente perchè non è stato dichiarato in lista.
                    //Per cui il sistema lo genera partendo dai 2 o più figli
                    gruppoHtml.prepend("<li class=\"list-group-item list-group-item-success\" aria-current=\"true\"></li>");

                    let template = $("#template").clone();
                    let htmlItem = $(template.html());
                    htmlItem.find("#a_scheda_articolo").html("<b>" + (codGruppo.length > 50 ? codGruppo.slice(0, 50) + "..." : codGruppo) + "</b>");
                    htmlItem.find("#lab_data_ultima_revisione").text("Ultima revisione: Mai revisionato");
                    htmlItem.find("#img_principale").remove();
                    htmlItem.find("#lista_foto_secondarie").remove();

                    htmlItem.attr("codice_gruppo", codGruppo);
                    htmlItem.attr("is_gruppo", "true");
                    this.agenzia.setRecord_revisioneArticolo(htmlItem);

                    gruppoHtml.find("li").first().append(htmlItem);
                }
            }
        }
    }

    salvaRevisione(sender, canale, area, callback) {
        console.log("salvo");


        let objReg = {
            canale: canale != "" ? canale : null,
            area: area != "" ? area : null,
            custom: null
        }

        let recItem = sender.closest(".record-revisione");
        let is_gruppo = recItem.attr("is_gruppo");

        let content = sender.closest(".content");
        //let descr1 = recItem.find("#Descrizione1").val();
        //let descr4 = recItem.find("#Descrizione4").val();
        //let descr3 = recItem.find("#Descrizione3").val();
        //let descr2 = recItem.find("#Descrizione2").val();
        //let descrIndd = recItem.find("#DescrizioneIndd").val();

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

        //let peso = recItem.find("#Peso").val();
        //let um = recItem.find("#Um").val();

        let peso = content.find("#Peso").val();
        let um = content.find("#Um").val();
        let firma_tracciato = recItem.find("#firma_tracciato").val();

        if (is_gruppo == "false") {


            let codice = recItem.attr("referenzaCodice");
            let id_rec = recItem.attr("id_rec");

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
                IdRecord: id_rec,
            }

            /*let pkg = { coda: [obj], prova:"Ciao" };
            console.log(pkg);*/

            console.log(obj);
            showLoading();

            let listAct = [];
            listAct.push(obj);
            this.salvaFunction(listAct, callback, sender);

            //hideLoading();

        }
        else {
            let codGruppo = recItem.attr("codice_gruppo");
            let obj = {
                Descrizione1: descr1,
                Descrizione2: descr2,
                Descrizione3: descr3,
                Descrizione4: descr4,
                DescrizioneIndd: descrIndd,
                Extra: Extra,
                Peso: rappresenteDecimaleInCulturaInglese(peso),
                Um: um,
                CodiceGruppo: codGruppo,
                FirmaTracciato: firma_tracciato,
                revRegionale: objReg,
                IsSottogruppo: revInstance.modalitaSottogruppi,

            }

            console.log(obj);
            showLoading();
            let listAct = [];
            listAct.push(obj);
            this.salvaFunction(listAct, callback, sender);

            //hideLoading();
        }


    }

    salvaTuttoRevisioni(callback) {
        let list = [];
        let listAct = [];
        let obj;
        let codice;
        let codGruppo;
        $("#_list_container").find(".checkbox-salva-gruppo").each(function () {

            if ($(this).is(':checked')) {
                list.push($(this).closest(".content")); 
            }
        }); 

        if (list.length > 0) {
            showLoading();
        }

        list.forEach(function (recItem) {


            let canale = recItem.attr("canale");
            let area = recItem.attr("area");


            let objReg = {
                canale: canale != "" ? canale : null,
                area: area != "" ? area : null,
                custom: null
            }


            let recRevisione = recItem.closest(".record-revisione");
            let is_gruppo = recRevisione.attr("is_gruppo");

            let descr1 = recItem.find("#Descrizione1").val();
            let descr4 = recItem.find("#Descrizione4").val();
            let descr3 = recItem.find("#Descrizione3").val();
            let descr2 = recItem.find("#Descrizione2").val();
            let peso = recItem.find("#Peso").val();
            let um = recItem.find("#Um").val();
            let firma_tracciato = recRevisione.find("#firma_tracciato").val();

            let Extra = {};
            let extraFields = recItem.find(".extraField");
            extraFields.each(function () {
                const chiave = $(this).attr("chiave");
                const tipoDato = $(this).attr("tipoDato");
                const valore = $(this).val();

                Extra[chiave] = {
                    type: tipoDato,
                    content: valore
                };
            });

            if (is_gruppo == "false") {


                codice = recRevisione.attr("referenzaCodice");

                obj = {
                    Descrizione1: descr1,
                    Descrizione2: descr2,
                    Descrizione3: descr3,
                    Descrizione4: descr4,
                    Extra: Extra,
                    Peso: rappresenteDecimaleInCulturaInglese(peso),
                    Um: um,
                    Codice: codice,
                    FirmaTracciato: firma_tracciato,
                    revRegionale: objReg,
                }

                /*let pkg = { coda: [obj], prova:"Ciao" };
                console.log(pkg);*/
                listAct.push(obj);
                console.log(obj);


                //Call.do("Revisore", "salvaTutto", "PUT", obj, ME, function (result, sender) {
                //    console.log(result);
                //    //Cerco il record nella lista master
                //    let obj = sender.List.find(r => r.recordInTracciato.Referenza.Id == id_ref);
                //    if (obj != null) {
                //        //Aggiorno il record nella lista master
                //        result.forEach(function (Item) {
                //            obj.recordRevisionato = Item;
                //        });
                //        //obj.recordRevisionato = result;
                //        let recHtml = $("#_list_container").find(".record-revisione[id_ref='" + id_ref + "']");
                //        recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(result.dataUltimaRicezione)));
                //    }

                //    if (callback != null && result.error == null) {
                //        console.warn("Callback");
                //        callback(result);
                //    }


                //});

            }
            else {
                codGruppo = recRevisione.attr("codice_gruppo");
                obj = {
                    Descrizione1: descr1,
                    Descrizione2: descr2,
                    Descrizione3: descr3,
                    Descrizione4: descr4,
                    Extra: Extra,
                    Peso: rappresenteDecimaleInCulturaInglese(peso),
                    Um: um,
                    CodiceGruppo: codGruppo,
                    FirmaTracciato: firma_tracciato,
                    revRegionale: objReg,
                    IsSottogruppo: revInstance.modalitaSottogruppi,
                }

                listAct.push(obj);
                console.log(obj);
                //Call.do("Revisore", "salva", "PUT", obj, ME, function (result, sender) {
                //    console.log(result);
                //    //Cerco il record nella lista master
                //    let obj = sender.List.find(r => r.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == codGruppo);
                //    if (obj != null) {
                //        //Aggiorno il record nella lista master
                //        obj.recordRevisionato = result;

                //        //Recupero il record e ne aggiorno i dati
                //        let recHtml = $("#_list_container").find(".record-revisione[codice_gruppo='" + codGruppo + "'][is_gruppo='true']");
                //        recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(result.dataUltimaRicezione)));
                //    }

                //    if (callback != null && result.error == null) {
                //        console.warn("Callback");
                //        callback(result);
                //    }

                //});
            }
        });
        console.log(listAct);
        this.scrollToTop = true;
        this.salvaFunction(listAct, callback, null);
        if (list.length > 0) {
            hideLoading();
        }
        console.log(list);
    }

    salvaFunction(listAct, callback, senderButton) {
        let ME = this;
        let IdTracciato = parseInt($("#CmbTracciato").val());
        showLoading();
        console.log("Salva function")
        let idPromo = parseInt($("#Promo").val());
        Call.do("Revisore", "salva/" + IdTracciato + "/0/0", "PUT", { coda: listAct, idPromo: idPromo }, ME, function (result, sender) {
            console.log("Risultato")
            console.log(result);
            // Se il server ha fallito, adesso lo dice: prima tornava 200 con [] e non si capiva niente.
            if (result == null || !Array.isArray(result)) {
                let _msg = (result && result.error) ? result.error : "Salvataggio non riuscito";
                console.error("Salvataggio fallito:", result);
                if (typeof mostraMessaggio === "function") mostraMessaggio(_msg, "danger");
                else alert("Salvataggio non riuscito: " + _msg);
                hideLoading();
                return;
            }
            //creo il messaggio

            //Cerco il record nella lista master

            //Aggiorno il record nella lista master
            let areaEl = null;
            let canaleEL = null;
            let codEl = null;
            if (result.length == 1) {
                areaEl = result[0].area;
                canaleEL = result[0].canale;
                codEl = (result[0].idArticoloNavigation != null ? result[0].idArticoloNavigation.codice : result[0].codiceGruppo);
            }

            console.log("Salva function 1, ancora non è crashato");

            let i = 0;
            result.forEach(function (item) {

                i++;
                console.log("Salva function inizio foreach, ancora non è crashato. Ripetizione: "+i);
                let cod = (item.idArticoloNavigation != null ? item.idArticoloNavigation.codice : item.codiceGruppo);
                if (socket!=null)
                    socket.sendMsg({ comando: "revisioneArticolo", codice: (item.idArticoloNavigation != null ? item.idArticoloNavigation.codice : ""), codiceGruppo: cod, utenteCheHaRevisionato: $("#btnUser").text() });

                let obj = null;
                if (cod.includes(",")) {
                    obj = sender.List.filter(r => r.isGruppo && r.recordInTracciato != null && r.recordInTracciato[keyScattoCodiceGruppo] == cod);
                }
                else {
                    obj = sender.List.filter(r => !r.isGruppo && r.recordInTracciato != null && r.recordInTracciato[keyRefCodice] == cod);
                }
                console.log(obj);
                console.log("item");
                console.log(item);
                let daMenabo = false;
                //if (obj == null || obj.length == 0) {
                //    try {
                //        obj = menaboInstance.tracciatoSource.filter(r => r.recordInTracciato.Referenza != null && item.idArticolo != null && r.recordInTracciato.Referenza.Id == item.idArticolo);
                //        daMenabo = true;
                //    }
                //    catch {
                //        obj = null;
                //    }
                //}

                console.log("Salva function step 1 foreach, ancora non è crashato. Ripetizione: " + i);


                if (obj != null && obj.length > 0) {
                    if (item.area != null || item.canale != null) {
                        obj.forEach(f => {
                            let index = f.recordRevisionatiRegionali.findIndex(f => f.area == item.area && f.canale == item.canale);
                            if (index === -1) {
                                f.recordRevisionatiRegionali.push(item);
                            } else {
                                f.recordRevisionatiRegionali[index] = item;

                                if (senderButton != null) {
                                    if (cod.includes(",")) {
                                        senderButton.closest(".content").find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                                    }
                                    else {
                                        senderButton.closest(".content").find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                                    }
                                }
                            }
                        });
                        
                    }
                    else {
                        if (daMenabo) {
                            let recHtml = $(".record-revisione[referenzaCodice='" + item.idArticoloNavigation.codice + "']");
                            recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                        }
                        else if (cod.includes(",")) {
                            let recHtml = $("#_list_container").find(".record-revisione[codiceGruppo='" + cod + "']");
                            recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                        }
                        else {
                            let recHtml = $("#_list_container").find(".record-revisione[referenzaCodice='" + cod + "']");
                            recHtml.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(item.dataUltimaRicezione)));
                        }
                        obj.forEach(f => {
                            f.recordRevisionato = item;

                            // stringa vuota deve passare, solo null / undefined non lo fa
                            if (f.recordInTracciato["FirmaGarantita"] != null) {
                                let siglaGarante = "";

                                try {
                                    if (f.recordRevisionato != null && f.recordRevisionato.meta != null && f.recordRevisionato.meta !== "") {
                                        const meta = JSON.parse(f.recordRevisionato.meta);

                                        if (meta != null && meta.siglaTracciato != null) {
                                            siglaGarante = meta.siglaTracciato;
                                        }
                                    }
                                } catch (e) {
                                    siglaGarante = "";
                                }

                                f.recordInTracciato["FirmaGarantita"] = siglaGarante;
                            }
                        });

                    }
                }

                console.log("Salva function step 2 foreach, ancora non è crashato. Ripetizione: " + i);

                //else {

                //    obj = sender.List.find(r => r.isGruppo && r.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.codiceGruppo);
                //    if (obj != null)
                //        obj.recordRevisionato = item;
                //}



                console.log("Salva function fine foreach, ancora non è crashato. Ripetizione: " + i);

            });

            hideLoading();
            $("#floatingSalvaGruppo").css("display", "none");


            //obj.recordRevisionato = result;

            //spedisco il messaggio

    
            if (callback != null && result.error == null) {
                console.warn("Callback");
                callback(result, senderButton);
            }
            else {
                sender.preparaListaDaCaricare(sender.currentPage - 1);
                let nome = (canaleEL != null ? canaleEL : "") + (areaEl != null ? areaEl : "");
                nome = nome != "" ? nome : "Naz"
                nome = nome + codEl;
                if (codEl != null) {
                    if (codEl.includes(",")) {
                        let recHtml = $("#_list_container").find(".record-revisione[codiceGruppo='" + codEl + "']");
                        recHtml.find("#tab-" + nome + "-tab").click();
                        console.warn(recHtml);
                        console.warn(recHtml.find("#tab-" + nome + "-tab"));
                    }
                    else {
                        let recHtml = $("#_list_container").find(".record-revisione[referenzaCodice='" + codEl + "']");
                        recHtml.find("#tab-" + nome + "-tab").click()
                        console.warn(recHtml);
                        console.warn(recHtml.find("#tab-" + nome + "-tab"));
                        console.warn("#tab-" + nome + "-tab");
                    }
                }
            }
            //sender.impostaRevisioniMode();
            //sender.checkPageRequest(this.currentPage);

            console.log("Salva function fine, non è crashato");

            if (revInstance.scrollToTop) {
                revInstance.scrollToTop = false;
                $("#_list")[0].scrollIntoView({ behavior: "smooth", block: "start" });
            }

        });

    }

    controlChangeText(box) {

        console.log("changed text");
        let codice = box.closest(".record-revisione").attr("referenzaCodice");
        let descrizione1 = box.closest("#tabContent").find("#Descrizione1");
        let descrizione2 = box.closest("#tabContent").find("#Descrizione2");
        let descrizione3 = box.closest("#tabContent").find("#Descrizione3");
        let descrizione4 = box.closest("#tabContent").find("#Descrizione4");
        let peso = box.closest("#tabContent").find("#Peso");
        let um = box.closest("#tabContent").find("#Um");

        let container = box.closest(".container");

        let ref;
        try {
            ref = this.List.find(f => f.recordInTracciato["Referenza.Codice"] == codice);
        }
        catch { }

        let cod_gruppo = box.closest(".record-revisione").attr("codice_gruppo");
        //console.log(cod_gruppo);
        let isGruppo;
        try {
            isGruppo = this.List.find(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == cod_gruppo && f.isGruppo);
        }
        catch { }
        console.log("Elemento trovato");
        //console.log("ref");
        //console.log(ref);

        let changes = false;

        //console.log("gruppo" + isGruppo);
        if (codice != "" && ref != null) {
            console.log("Codice trovato");
            if (ref.recordRevisionato != null && ref.recordRevisionato != 0) {
                console.log("Record Revisionato trovato");

                if (descrizione1.attr('id') === 'Descrizione1') {
                    if (ref.recordRevisionato.descrizione1 != descrizione1.val()) {
                        this.changeBorderAndSave(descrizione1);
                        changes = true;
                    }
                    else {
                        console.log("ripristino bordo");
                        this.undoBorder(descrizione1);
                    }
                }
                if (descrizione2.attr('id') === 'Descrizione2') {
                    if (ref.recordRevisionato.descrizione2 != descrizione2.val()) {
                        this.changeBorderAndSave(descrizione2);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione2);
                    }
                }
                if (descrizione3.attr('id') === 'Descrizione3') {
                    if (ref.recordRevisionato.descrizione3 != descrizione3.val()) {
                        this.changeBorderAndSave(descrizione3);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione3);
                    }
                }
                if (descrizione4.attr('id') === 'Descrizione4') {
                    if (ref.recordRevisionato.descrizione4 != descrizione4.val()) {
                        this.changeBorderAndSave(descrizione4);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione4);
                    }
                }
                if (peso.attr('id') === 'Peso') {
                    if (rappresenteDecimaleInCulturaItaliana(ref.recordRevisionato.peso) != peso.val()) {
                        if (ref.recordRevisionato.peso != null || (ref.recordRevisionato.peso == null && peso.val() != "")) {
                            this.changeBorderAndSave(peso);
                            changes = true;
                        }
                        else {
                            this.undoBorder(peso);
                        }
                    }
                    else {
                        this.undoBorder(peso);
                    }
                }
                if (um.attr('id') === 'Um') {
                    if (ref.recordRevisionato.um != um.val()) {
                        if (ref.recordRevisionato.um != null || (ref.recordRevisionato.um == null && um.val() != "")) {
                            this.changeBorderAndSave(um);
                            changes = true;
                        }
                        else {
                            this.undoBorder(um);
                        }
                    }
                    else {
                        this.undoBorder(um);
                    }
                }
            }
            else {
                console.log("Record Revisionato NON trovato");

                if (descrizione1.attr('id') === 'Descrizione1') {
                    if (ref.recordInTracciato[keyDescr1] != descrizione1.val()) {
                        //console.log(ref.recordInTracciato.descrizione1 + " confronto con" + box.val());
                        if (ref.recordInTracciato[keyDescr1] != null || (ref.recordRevisionato.descrizione1 == null && descrizione1.val() != "")) {
                            this.changeBorderAndSave(descrizione1);
                            changes = true;
                        }
                        else {
                            this.undoBorder(descrizione1);
                        }
                    }
                    else {
                        this.undoBorder(descrizione1);
                    }
                }
                if (descrizione2.attr('id') === 'Descrizione2') {
                    if (ref.recordInTracciato[keyDescr2] != descrizione2.val()) {
                        if (ref.recordInTracciato[keyDescr2] != null || (ref.recordRevisionato.descrizione2 == null && descrizione2.val() != "")) {
                            this.changeBorderAndSave(descrizione2);
                            changes = true;
                        }
                        else {
                            this.undoBorder(descrizione2);
                        }
                    }
                    else {
                        this.undoBorder(descrizione2);
                    }
                }
                if (descrizione3.attr('id') === 'Descrizione3') {
                    if (ref.recordInTracciato[keyDescr3] != descrizione3.val()) {
                        if (ref.recordInTracciato[keyDescr3] != null || (ref.recordRevisionato.descrizione3 == null && descrizione3.val() != "")) {
                            console.log("cambiobordo");
                            this.changeBorderAndSave(descrizione3);
                            changes = true;
                        }
                        else {
                            this.undoBorder(descrizione3);
                        }
                    }
                    else {
                        this.undoBorder(descrizione3);
                    }
                }
                if (descrizione4.attr('id') === 'Descrizione4') {
                    if (ref.recordInTracciato[keyDescr4] != descrizione4.val()) {
                        if (ref.recordInTracciato[keyDescr4] != null || (ref.recordRevisionato.descrizione4 == null && descrizione4.val() != "")) {
                            this.changeBorderAndSave(descrizione4);
                            changes = true;
                        }
                        else {
                            this.undoBorder(descrizione4);
                        }
                    }
                    else {
                        this.undoBorder(descrizione4);
                    }
                }
                if (peso.attr('id') === 'Peso') {
                    if ("" != box.val()) {
                        this.changeBorderAndSave(peso);
                        changes = true;
                    }
                    else {
                        this.undoBorder(peso);
                    }
                }
                if (um.attr('id') === 'Um') {
                    if ("" != um.val()) {
                        this.changeBorderAndSave(um);
                        changes = true;
                    }
                    else {
                        this.undoBorder(um);
                    }
                }
            }
        }
        else if (cod_gruppo != null && isGruppo != null) {
            console.log("Codice gruppo trovato");

            if (isGruppo.recordRevisionato != null) {
                console.log("Record Revisionato trovato");

                if (descrizione1.attr('id') === 'Descrizione1') {
                    if (isGruppo.recordRevisionato.descrizione1 != descrizione1.val()) {
                        //console.log(isGruppo.recordRevisionato.descrizione1 + " confronto con" + box.val());
                        this.changeBorderAndSave(descrizione1);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione1);
                    }
                }
                if (descrizione2.attr('id') === 'Descrizione2') {
                    if (isGruppo.recordRevisionato.descrizione2 != descrizione2.val()) {
                        this.changeBorderAndSave(descrizione2);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione2);
                    }
                }
                if (descrizione3.attr('id') === 'Descrizione3') {
                    if (isGruppo.recordRevisionato.descrizione3 != descrizione3.val()) {
                        this.changeBorderAndSave(descrizione3);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione3);
                    }
                }
                if (descrizione4.attr('id') === 'Descrizione4') {
                    if (isGruppo.recordRevisionato.descrizione4 != descrizione4.val()) {
                        this.changeBorderAndSave(descrizione4);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione4);
                    }
                }
                if (peso.attr('id') === 'Peso') {
                    if (rappresenteDecimaleInCulturaItaliana(isGruppo.recordRevisionato.peso) != peso.val()) {
                        if (isGruppo.recordRevisionato.peso != null || (isGruppo.recordRevisionato.peso == null && peso.val() != "")) {
                            this.changeBorderAndSave(peso);
                            changes = true;
                        }
                        else {
                            this.undoBorder(peso);
                        }
                    }
                    else {
                        this.undoBorder(peso);
                    }
                }
                if (um.attr('id') === 'Um') {
                    if (isGruppo.recordRevisionato.um != um.val()) {
                        if (isGruppo.recordRevisionato.um != null || (isGruppo.recordRevisionato.um == null && um.val() != "")) {
                            this.changeBorderAndSave(um);
                            changes = true;
                        }
                        else {
                            this.undoBorder(um);
                        }
                    }
                    else {
                        this.undoBorder(um);
                    }
                }
            }
            else {
                console.log("Record Revisionato NON trovato");

                if (descrizione1.attr('id') === 'Descrizione1') {
                    if ("" != descrizione1.val()) {
                        //console.log(isGruppo.recordInTracciato.descrizione1 + " confronto con" + box.val());
                        this.changeBorderAndSave(descrizione1);
                        changes = true;
                    }
                    else {
                        console.log("ripristinobordo");
                        this.undoBorder(descrizione1);
                    }
                }
                if (descrizione2.attr('id') === 'Descrizione2') {
                    if ("" != descrizione2.val()) {
                        this.changeBorderAndSave(descrizione2);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione2);
                    }
                }
                if (descrizione3.attr('id') === 'Descrizione3') {
                    if ("" != box.val()) {
                        this.changeBorderAndSave(descrizione3);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione3);
                    }
                }
                if (descrizione4.attr('id') === 'Descrizione4') {
                    if ("" != box.val()) {
                        this.changeBorderAndSave(descrizione4);
                        changes = true;
                    }
                    else {
                        this.undoBorder(descrizione4);
                    }
                }
                if (peso.attr('id') === 'Peso') {
                    if ("" != peso.val()) {
                        this.changeBorderAndSave(peso);
                        changes = true;
                    }
                    else {
                        this.undoBorder(peso);
                    }
                }
                if (um.attr('id') === 'Um') {
                    if ("" != box.val()) {
                        this.changeBorderAndSave(um);
                        changes = true;
                    }
                    else {
                        this.undoBorder(um);
                    }
                }
            }
        }

        var resCustom = this.agenzia.controlChangeTextCustom(container, ref);

        if (!resCustom && !changes) {
            this.disattivaPulsanteSalvaInGruppo(container);
        }
    }

    changeBorderAndSave(box) {
        let container = box.closest(".container");
        container.find(".checkbox-salva-gruppo").prop('checked', true);
        this.TogglePulsanteSalvaInGruppo(true);
        console.log("Attivo bordo");

        box.addClass("border-3");
        box.addClass("border-danger");
    }

    undoBorder(box) {
        console.log("Rimuovo bordo");

        box.removeClass("border-3");
        box.removeClass("border-danger");
    }

    disattivaPulsanteSalvaInGruppo(container) {       
        container.find(".checkbox-salva-gruppo").prop('checked', false);
        this.TogglePulsanteSalvaInGruppo(false);
    }

    TogglePulsanteSalvaInGruppo(checkbox) {
        if (checkbox == true) {
            console.log("Attivo salva in gruppo");
            $("#floatingSalvaGruppo").css("display", "flex");
        }
        else {
            var checkboxSelezionati = $('.checkbox-salva-gruppo:checked');
            var numeroCheckboxSelezionati = checkboxSelezionati.length;
            if (numeroCheckboxSelezionati == 0) {
                console.log("Disattivo salva in gruppo");
                $("#floatingSalvaGruppo").css("display", "none");
            }
        }
    }

    getCurrentPage() {
        return this.currentPage;
    }

    setCurrentPage(value) {
        this.currentPage = value + 1;
    }

    getTotPage() {
        return this.tot_pages;
    }

    checkPageRequest(index) {
        index -= 1;
        if (index < 0) {
            index = 0;
        }
        else if (this.tot_pages <= index) {
            index = this.tot_pages - 1;
        }
        console.log(index);
        console.log(this.tot_pages)
        if (Number.isNaN(index) || this.tot_pages <= index || index < 0) {
            console.log(this.tot_pages + " " + index);
            console.log("pagina non valida");
            return
        }
        else {
            $("#floatingSalvaGruppo").css("display", "none");
            this.caricaPagina(index, this.currentList)
        }
    }

    cercaProdotto(label, codice, nome, brand, tipo_gusto, grammatura, segmento) {

        let me = this;
        if (label == null) { label = $("#serach_label").val() }
        if (codice == null) { codice = $("#search_codice").val() }
        if (nome == null) { nome = $("#search_nome").val() }
        if (brand == null) { brand = $("#search_brand").val() }
        if (tipo_gusto == null) { tipo_gusto = $("#search_tipogusto").val() }
        if (grammatura == null) { grammatura = $("#search_gramm").val() }
        if (segmento == null) { segmento = $("#search_segmento").val() }

        let codiceGruppo = false;

        if (codice.includes(",")) {
            codiceGruppo = true;
        }
        var mode = $("#filtraPerGruppiOSingoli").val();

        console.log(label + " " + codice + " " + nome + " " + brand + " " + tipo_gusto + " " + grammatura + " " + segmento);
        let ListRicerca = [];
        console.log("funzione filter");
        let list = this.currentList;
        console.log("cerco prodotto");
        console.log(this.currentList);
        console.log("5030 1.5");
        console.log(this.currentList.filter(f => f.recordInTracciato[keyScattoCodiceGruppo].includes('5030')));

        if (!$('#chCercaInArchivio').is(':checked')) {
            list.forEach(function (item) {
                if (item.isGruppo) {
                    let childsElement = me.List.filter(f => !f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                    let gruppoValido = false;
                    childsElement.forEach(function (item2) {
                        if ((item2.label != null && !item2.label.toLowerCase().includes(label.toLowerCase()) || item2.label == null) && label != "") {
                            console.log("escludo");
                        }
                        else if ((!codiceGruppo && item2.recordInTracciato[keyRefCodice] != null &&
                            !item2.recordInTracciato[keyRefCodice].toLowerCase().includes(codice.toLowerCase())
                            || item2.recordInTracciato[keyRefCodice] == null) || (codiceGruppo && 
                            (item2.recordInTracciato[keyScattoCodiceGruppo] != null &&
                            !item2.recordInTracciato[keyScattoCodiceGruppo].toLowerCase().includes(codice.toLowerCase())
                            || item2.recordInTracciato[keyScattoCodiceGruppo] == null))
                            && codice != "") {
                        }
                        else if ((item2.recordInTracciato[keyDescr1] != null && !item2.recordInTracciato[keyDescr1].toLowerCase().includes(nome.toLowerCase()) || item2.recordInTracciato[keyDescr1] == null) && nome != "") {
                        }
                        else if ((item2.recordInTracciato[keyDescr2] != null && !item2.recordInTracciato[keyDescr2].toLowerCase().includes(brand.toLowerCase()) || item2.recordInTracciato[keyDescr2] == null) && brand != "") {
                        }
                        else if ((item2.recordInTracciato[keyDescr3] != null && !item2.recordInTracciato[keyDescr3].toLowerCase().includes(tipo_gusto.toLowerCase()) || item2.recordInTracciato[keyDescr3] == null) && tipo_gusto != "") {
                        }
                        else if ((item2.recordInTracciato[keyDescr4] != null && !item2.recordInTracciato[keyDescr4].toLowerCase().includes(grammatura.toLowerCase()) || item2.recordInTracciato[keyDescr4] == null) && grammatura != "") {
                        }
                        else if ((item2.recordInTracciato.Segmento != null && !item2.recordInTracciato.Referenza.Segmento.toLowerCase().includes(segmento.toLowerCase()) || item2.recordInTracciato.Referenza == null || item2.recordInTracciato.Referenza.Segmento == null) && segmento != "") {
                        }
                        else if (item2.recordInTracciato[keyRefCodice] != null || (codice == "" && nome == "" && brand == "" && tipo_gusto == "" && grammatura == "" && segmento == "")) {
                            gruppoValido = true;
                        }
                    })
                    if (gruppoValido) {
                        ListRicerca.push(item);
                    }
                    else {
                        if ((item.label != null && !item.label.toLowerCase().includes(label.toLowerCase()) || item.label == null) && label != "") {
                            console.log("escludo");
                        }
                        else if ((!codiceGruppo && item.recordInTracciato[keyRefCodice] != null &&
                            !item.recordInTracciato[keyRefCodice].toLowerCase().includes(codice.toLowerCase())
                            || item.recordInTracciato[keyRefCodice] == null) || (codiceGruppo &&
                                (item.recordInTracciato[keyScattoCodiceGruppo] != null &&
                                    !item.recordInTracciato[keyScattoCodiceGruppo].toLowerCase().includes(codice.toLowerCase())
                                    || item.recordInTracciato[keyScattoCodiceGruppo] == null))
                            && codice != "") {
                        }
                        else if ((item.recordInTracciato[keyDescr1] != null && !item.recordInTracciato[keyDescr1].toLowerCase().includes(nome.toLowerCase()) || item.recordInTracciato[keyDescr1] == null) && nome != "") {
                        }
                        else if ((item.recordInTracciato[keyDescr2] != null && !item.recordInTracciato[keyDescr2].toLowerCase().includes(brand.toLowerCase()) || item.recordInTracciato[keyDescr2] == null) && brand != "") {
                        }
                        else if ((item.recordInTracciato[keyDescr3] != null && !item.recordInTracciato[keyDescr3].toLowerCase().includes(tipo_gusto.toLowerCase()) || item.recordInTracciato[keyDescr3] == null) && tipo_gusto != "") {
                        }
                        else if ((item.recordInTracciato[keyDescr4] != null && !item.recordInTracciato[keyDescr4].toLowerCase().includes(grammatura.toLowerCase()) || item.recordInTracciato[keyDescr4] == null) && grammatura != "") {
                        }
                        else if ((item.recordInTracciato.Segmento != null && !item.recordInTracciato.Referenza.Segmento.toLowerCase().includes(segmento.toLowerCase()) || item.recordInTracciato.Referenza == null || item.recordInTracciato.Referenza.Segmento == null) && segmento != "") {
                        }
                        else if (item.recordInTracciato[keyRefCodice] != null || (codice == "" && nome == "" && brand == "" && tipo_gusto == "" && grammatura == "" && segmento == "")) {
                            ListRicerca.push(item);
                        }
                    }
                }
                else {
                    if ((item.label != null && !item.label.toLowerCase().includes(label.toLowerCase()) || item.label == null) && label != "") {
                        console.log("escludo");
                    }
                    else if ((!codiceGruppo && item.recordInTracciato[keyRefCodice] != null &&
                        !item.recordInTracciato[keyRefCodice].toLowerCase().includes(codice.toLowerCase())
                        || item.recordInTracciato[keyRefCodice] == null) || (codiceGruppo &&
                            (item.recordInTracciato[keyScattoCodiceGruppo] != null &&
                                !item.recordInTracciato[keyScattoCodiceGruppo].toLowerCase().includes(codice.toLowerCase())
                                || item.recordInTracciato[keyScattoCodiceGruppo] == null))
                        && codice != "") {
                    }
                    else if ((item.recordInTracciato[keyDescr1] != null && !item.recordInTracciato[keyDescr1].toLowerCase().includes(nome.toLowerCase()) || item.recordInTracciato[keyDescr1] == null) && nome != "") {
                    }
                    else if ((item.recordInTracciato[keyDescr2] != null && !item.recordInTracciato[keyDescr2].toLowerCase().includes(brand.toLowerCase()) || item.recordInTracciato[keyDescr2] == null) && brand != "") {
                    }
                    else if ((item.recordInTracciato[keyDescr3] != null && !item.recordInTracciato[keyDescr3].toLowerCase().includes(tipo_gusto.toLowerCase()) || item.recordInTracciato[keyDescr3] == null) && tipo_gusto != "") {
                    }
                    else if ((item.recordInTracciato[keyDescr4] != null && !item.recordInTracciato[keyDescr4].toLowerCase().includes(grammatura.toLowerCase()) || item.recordInTracciato[keyDescr4] == null) && grammatura != "") {
                    }
                    else if ((item.recordInTracciato.Segmento != null && !item.recordInTracciato.Referenza.Segmento.toLowerCase().includes(segmento.toLowerCase()) || item.recordInTracciato.Referenza == null || item.recordInTracciato.Referenza.Segmento == null) && segmento != "") {
                    }
                    else if (item.recordInTracciato[keyRefCodice] != null || (codice == "" && nome == "" && brand == "" && tipo_gusto == "" && grammatura == "" && segmento == "")) {
                        ListRicerca.push(item);
                    }
                }
            });
            console.log(ListRicerca);
        }
        else {
            let recordIgnorato = false;
            list.forEach(function (item) {
                recordIgnorato = false;
                if ((item.label != null && !item.label.toLowerCase().includes(label.toLowerCase()) || item.label == null) && label != "") {
                    recordIgnorato = true;
                }
                else {
                    console.log("tengo per ora");
                }

                if ((!codiceGruppo && item.recordInTracciato[keyRefCodice] != null &&
                    !item.recordInTracciato[keyRefCodice].toLowerCase().includes(codice.toLowerCase())
                    || item.recordInTracciato[keyRefCodice] == null) || (codiceGruppo &&
                        (item.recordInTracciato[keyScattoCodiceGruppo] != null &&
                            !item.recordInTracciato[keyScattoCodiceGruppo].toLowerCase().includes(codice.toLowerCase())
                            || item.recordInTracciato[keyScattoCodiceGruppo] == null))
                    && codice != "") {
                    recordIgnorato = true;
                }
                else {
                    console.log("tengo per ora");
                }
                if (item.recordRevisionato == null) {
                    recordIgnorato = true;
                }
                if (item.isGruppo && !recordIgnorato) {
                    let childsElement = me.List.filter(f => !f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                    let gruppoValido = false;
                    childsElement.forEach(function (item2) {
                        let childIgnorato = false;
                        if (!gruppoValido) {
                            if (item2.recordRevisionato != null) {
                                if (!childIgnorato && nome != "") {
                                    if (item2.recordRevisionato.descrizione1 != null) {
                                        if (!item2.recordRevisionato.descrizione1.toLowerCase().includes(nome.toLowerCase())) {
                                            childIgnorato = true;
                                        }
                                    }
                                    else {
                                        childIgnorato = true;
                                    }
                                }

                                if (!childIgnorato && brand != "") {
                                    if (item.recordRevisionato.descrizione2 != null) {
                                        if (!item.recordRevisionato.descrizione2.toLowerCase().includes(brand.toLowerCase())) {
                                            childIgnorato = true;
                                        }
                                    }
                                    else {
                                        childIgnorato = true;
                                    }
                                }

                                if (!childIgnorato && tipo_gusto != "") {
                                    if (item.recordRevisionato.descrizione3 != null) {
                                        if (!item.recordRevisionato.descrizione3.toLowerCase().includes(tipo_gusto.toLowerCase())) {
                                            childIgnorato = true;
                                        }
                                    }
                                    else {
                                        childIgnorato = true;
                                    }
                                }

                                if (!childIgnorato && grammatura != "") {
                                    if (item.recordRevisionato.descrizione4 != null) {
                                        if (!item.recordRevisionato.descrizione4.toLowerCase().includes(grammatura.toLowerCase())) {
                                            childIgnorato = true;
                                        }
                                    }
                                    else {
                                        childIgnorato = true;
                                    }
                                }

                                if (!childIgnorato && segmento != "") {
                                    if (item.recordRevisionato.idArticoloNavigation != null && item.recordRevisionato.idArticoloNavigation.segmento != null) {
                                        if (!item.recordRevisionato.idArticoloNavigation.segmento.toLowerCase().includes(segmento.toLowerCase())) {
                                            childIgnorato = true;
                                        }
                                    }
                                    else {
                                        childIgnorato = true;
                                    }
                                }
                            }
                            else {
                                childIgnorato = true;
                            }

                            if (!childIgnorato) {
                                gruppoValido = true;
                            }
                        }

                    });
                    if (gruppoValido) {
                        ListRicerca.push(item);
                    }
                    else {
                        if (item.recordRevisionato != null) {
                            if (!recordIgnorato && nome != "") {
                                if (item.recordRevisionato.descrizione1 != null) {
                                    if (!item.recordRevisionato.descrizione1.toLowerCase().includes(nome.toLowerCase())) {
                                        recordIgnorato = true;
                                    }
                                }
                                else {
                                    recordIgnorato = true;
                                }
                            }

                            if (!recordIgnorato && brand != "") {
                                if (item.recordRevisionato.descrizione2 != null) {
                                    if (!item.recordRevisionato.descrizione2.toLowerCase().includes(brand.toLowerCase())) {
                                        recordIgnorato = true;
                                    }
                                }
                                else {
                                    recordIgnorato = true;
                                }
                            }

                            if (!recordIgnorato && tipo_gusto != "") {
                                if (item.recordRevisionato.descrizione3 != null) {
                                    if (!item.recordRevisionato.descrizione3.toLowerCase().includes(tipo_gusto.toLowerCase())) {
                                        recordIgnorato = true;
                                    }
                                }
                                else {
                                    recordIgnorato = true;
                                }
                            }

                            if (!recordIgnorato && grammatura != "") {
                                if (item.recordRevisionato.descrizione4 != null) {
                                    if (!item.recordRevisionato.descrizione4.toLowerCase().includes(grammatura.toLowerCase())) {
                                        recordIgnorato = true;
                                    }
                                }
                                else {
                                    recordIgnorato = true;
                                }
                            }

                            if (!recordIgnorato && segmento != "") {
                                if (item.recordRevisionato.idArticoloNavigation != null && item.recordRevisionato.idArticoloNavigation.segmento != null) {
                                    if (!item.recordRevisionato.idArticoloNavigation.segmento.toLowerCase().includes(segmento.toLowerCase())) {
                                        recordIgnorato = true;
                                    }
                                }
                                else {
                                    recordIgnorato = true;
                                }
                            }
                        }

                        if (!recordIgnorato) {
                            ListRicerca.push(item);
                        }
                    }
                }
                else {
                    if (item.recordRevisionato != null) {
                        if (!recordIgnorato && nome != "") {
                            if (item.recordRevisionato.descrizione1 != null) {
                                if (!item.recordRevisionato.descrizione1.toLowerCase().includes(nome.toLowerCase())) {
                                    recordIgnorato = true;
                                }
                            }
                            else {
                                recordIgnorato = true;
                            }
                        }

                        if (!recordIgnorato && brand != "") {
                            if (item.recordRevisionato.descrizione2 != null) {
                                if (!item.recordRevisionato.descrizione2.toLowerCase().includes(brand.toLowerCase())) {
                                    recordIgnorato = true;
                                }
                            }
                            else {
                                recordIgnorato = true;
                            }
                        }

                        if (!recordIgnorato && tipo_gusto != "") {
                            if (item.recordRevisionato.descrizione3 != null) {
                                if (!item.recordRevisionato.descrizione3.toLowerCase().includes(tipo_gusto.toLowerCase())) {
                                    recordIgnorato = true;
                                }
                            }
                            else {
                                recordIgnorato = true;
                            }
                        }

                        if (!recordIgnorato && grammatura != "") {
                            if (item.recordRevisionato.descrizione4 != null) {
                                if (!item.recordRevisionato.descrizione4.toLowerCase().includes(grammatura.toLowerCase())) {
                                    recordIgnorato = true;
                                }
                            }
                            else {
                                recordIgnorato = true;
                            }
                        }

                        if (!recordIgnorato && segmento != "") {
                            if (item.recordRevisionato.idArticoloNavigation != null && item.recordRevisionato.idArticoloNavigation.segmento != null) {
                                if (!item.recordRevisionato.idArticoloNavigation.segmento.toLowerCase().includes(segmento.toLowerCase())) {
                                    recordIgnorato = true;
                                }
                            }
                            else {
                                recordIgnorato = true;
                            }
                        }
                    }

                    if (!recordIgnorato) {
                        ListRicerca.push(item);
                    }
                }
            });
            console.log(ListRicerca);
        }

        let ME = this;

        if ($('#chCercaInteroGruppo').is(':checked') && mode != "singoli") {

            let tmpList = [];
            let ultimoGruppoPreso = "";
            ListRicerca.forEach(function (item) {
                let codiceGruppoConfronto = item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];
                if (codiceGruppoConfronto != ultimoGruppoPreso) {
                    ultimoGruppoPreso = codiceGruppoConfronto;

                    for (let i = 0; i < ME.List.length; i++) {
                        if (codiceGruppoConfronto == ME.List[i].recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]) {
                            tmpList.push(ME.List[i])
                        }
                    }
                }

            });
            ListRicerca = tmpList;
        }
        console.log("5030 2")
        console.log(ListRicerca.filter(f => f.recordInTracciato[keyScattoCodiceGruppo].includes('5030')));

        return ListRicerca;
    }

    setCustomSearch(element) {
        console.log("customSearchParameter");
        console.log($(element).attr("customSearchParameterPath"));
        // console.log(.indexOf($(element).attr("customSearchParameterPath")));
        this.listCustomSearchAgenzia = this.listCustomSearchAgenzia.filter(f => f.Path != $(element).attr("customSearchParameterPath"));

        if ($(element).val() == "Reset" || $(element).val() == "") {
            console.log("Reset");
            this.preparaListaDaCaricare(0);
            return;
        }

        if (this.listCustomSearchAgenzia.indexOf($(element).attr("customSearchParameterPath")) < 0) {

            let objCustom = {};
            objCustom.Path = $(element).attr("customSearchParameterPath");
            objCustom.Value = $(element).val();
            console.log(objCustom);
            this.listCustomSearchAgenzia.push(objCustom);
        } else {
            console.log(this.listCustomSearchAgenzia.indexOf($(element).attr("customSearchParameterPath")));
            this.listCustomSearchAgenzia.slice([this.listCustomSearchAgenzia.indexOf($(element).attr("customSearchParameterPath"))], 1);
            let objCustom = {};
            objCustom.Path = $(element).attr("customSearchParameterPath");
            objCustom.Value = $(element).val();
            console.log(objCustom);
            this.listCustomSearchAgenzia.push(objCustom);
        }
        this.preparaListaDaCaricare(0);
    }

    filterListCustomSearch(list) {
        console.log("listacustom");
        console.log(this.listCustomSearchAgenzia);
        console.log("lista da filtrare");
        console.log(list);
        let me = this;
        if (this.listCustomSearchAgenzia.length == 0) {
            console.log("Nessun parametro custom per il filtro, torno lista invariata");
            return list;
        }
        let tmpList = [];
        list.forEach(function (item) {
            for (let i = 0; i < me.listCustomSearchAgenzia.length; i++) {
                console.log(me.listCustomSearchAgenzia[i].Value);
                console.log(item.recordInTracciato[me.listCustomSearchAgenzia[i].Path]);
                if (item.recordInTracciato[me.listCustomSearchAgenzia[i].Path] == me.listCustomSearchAgenzia[i].Value) {
                    console.log("aggiungo a tmplist");
                    tmpList.push(item);
                }
            }

        });
        console.log(tmpList);
        return tmpList;
    }

    filtraPerGruppoOSingolo() {
        var mode = $("#filtraPerGruppiOSingoli").val();
        if (mode == "gruppi") {
            if (this.agenzia.filtroModePerSingoliOGruppi != null) {
                return this.agenzia.filtroModePerSingoliOGruppi(mode, this.currentList);
            }
            return this.currentList.filter(f => f.isGruppo || f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] != f.recordInTracciato[keyRefCodice]);
        }
        else if (mode == "singoli") {
            if (this.agenzia.filtroModePerSingoliOGruppi != null) {
                return this.agenzia.filtroModePerSingoliOGruppi(mode, this.currentList);
            }
            return this.currentList.filter(f => !f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == f.recordInTracciato[keyRefCodice]);
        }
        else return this.currentList;
    }

    controllaRevisioni(list) {
        let tmpList = [];

        var mode = $("#filtraPerGruppiOSingoli").val();
        //revisionato
        if ($("#ch_articoli_revisionati").prop('checked')) {
            list.forEach(function (item) {
                let itemValido = true;

                //Revisionato anche quando la firma e' garantita da un altro tracciato, non solo
                //quando coincide: e' la regola della resa delle righe, ora unica (statoRevisione).
                if (statoRevisione.eRevisionato(item)) {
                    var listGroupAnalized = [];
                    var listGroupAdded = [];
                    if (listGroupAnalized.includes(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)])) {
                        if (!listGroupAdded.includes(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)])) {
                            itemValido = false;
                        }
                    }
                    else {
                        listGroupAnalized.push(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                        if (mode == "singoli") {
                            itemValido = true;
                        }
                        else {
                            let itemOfGroup = list.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                            itemOfGroup.forEach(function (item2) {
                                if (statoRevisione.eRevisionato(item2)) {
                                }
                                else {
                                    itemValido = false;
                                }
                            })
                            if (itemValido) {
                                listGroupAdded.push(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                            }
                        }
                    }
                    if (itemValido) {
                        tmpList.push(item);
                    }
                }
            });
        }
        else {
            var listGroupAnalized = [];
            var listGroupAdded = [];
            list.forEach(function (item) {
                if (item.recordInTracciato[keyScattoCodiceGruppo].includes('5030')) {
                    console.log("c");
                }
                let itemValido = false;
                if (listGroupAnalized.includes(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)])) {
                    if (listGroupAdded.includes(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)])) {
                        itemValido = true;
                    }
                }
                else {
                    if (mode == "singoli") {
                        if (!statoRevisione.eRevisionato(item)) {
                            itemValido = true;
                        }
                    }
                    else {
                        listGroupAnalized.push(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                        let itemOfGroup = list.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                        itemOfGroup.forEach(function (item2) {
                            if (!statoRevisione.eRevisionato(item2)) {
                                itemValido = true;
                                return;
                            }
                        })
                        if (itemValido) {
                            listGroupAdded.push(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                        }
                    }
                }
                if (itemValido) {
                    tmpList.push(item);
                }
                


                

                //if ((item.recordRevisionato == null || (item.recordRevisionato != null && item.recordRevisionato.firmaTracciato == null) || (item.recordRevisionato != null && item.recordRevisionato.firmaTracciato != null && item.recordInTracciato != null && item.recordRevisionato.firmaTracciato != item.recordInTracciato[keyTracciatoFirma]))) {
                //    tmpList.push(item);

                //}
            });
        }

        console.log("gruppo 5030");
        console.log(tmpList.filter(f => f.recordInTracciato[keyScattoCodiceGruppo].includes('5030')));

        return tmpList;
    }

    impostaRevisioniMode() {
        this.currentList = this.controllaRevisioni(this.List);
        let revisioniList = [];
        let lastCodiceGruppo = "";
        let List = this.List;
        let checkedGroups = [];
        var mode = $("#filtraPerGruppiOSingoli").val();
        this.currentList.forEach(function (item) {
            if (mode == "singoli") {
                revisioniList.push(item);
                return;
            }
            if (item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] != item.recordInTracciato[keyRefCodice]) {
                if (!checkedGroups.includes(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)])) {
                    checkedGroups.push(item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
                    console.log("gruppo trovato: " + lastCodiceGruppo);
                    revisioniList = revisioniList.concat(List.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]));
                }
                else {
                    /* console.log("gruppo già inserito");*/
                }

            }
            else {
                revisioniList.push(item);
            }

        });
        console.log(revisioniList);
        this.currentList = revisioniList;

    }

    preparaListaDaCaricare(index) {
        let me = this;
        this.impostaRevisioniMode();
        console.log("dopo imposta revisioni");
        console.log(this.currentList);
        console.log(this.currentList.filter(f => f.recordInTracciato[keyScattoCodiceGruppo].includes('5030')));

        this.currentList = this.filterListCustomSearch(this.currentList);
        console.log(this.currentList.filter(f => f.recordInTracciato[keyScattoCodiceGruppo].includes('5030')));

        console.log("dopo imposta filterListCustom");
        console.log(this.currentList);
        this.currentList = this.cercaProdotto();
        console.log("dopo imposta cercaProdotto");
        console.log(this.currentList);
        this.currentList = this.filtraPerGruppoOSingolo();
        this.caricaPagina(index, this.currentList);
        this.creaEAggiornaRevisioniCounter(this.currentList);
    }



    creaEAggiornaRevisioniCounter(currentList) {
        let value = 0;
        let listaCodiciProcessati = [];
        currentList.forEach(function (item) {
            var codice = item.isGruppo ? item.recordInTracciato[keyScattoCodiceGruppo] : item.recordInTracciato[keyRefCodice];
            if (listaCodiciProcessati.includes(codice)) {
                return;
            }
            else {
                listaCodiciProcessati.push(codice);
            }
            //Una regola sola con le schede e con la resa (statoRevisione): prima qui si guardava
            //FirmaGarantita == null, che salta anche la firma garantita vuota, cioe' "garante
            //valutato, non garantisce", e quella riga restava visibile ma non contata.
            if (!statoRevisione.eRevisionato(item)) {
                value++;
            }
        });
        // Rimuovi eventuali segnaposti già presenti
        if ($(".counter-placeholder").length > 0) {
            $(".counter-placeholder").remove();
        }


        // Crea il nuovo segnaposto
        let counterElement = $('<div class="counter-placeholder"><i class="fas fa-flag"></i><span class="counter-text">' + value + '</span></div>');

        /*
            <div class="counter-placeholder" style="
            position: absolute;
            right: 10px; 
            background-color:rgba(255, 0, 0, 0.5); 
            padding: 5px; 
            border-radius: 5px;
            align-items: center; 
            justify-content: center; 
            width: 100px;></div> 
        */
        // Imposta le classi CSS e lo sfondo rosso con trasparenza al 50%
        counterElement.css({
            'position': 'absolute',            
            'right': '10px',
            'top': '110px',
            'background-color': 'rgba(255, 0, 0, 0.5)', // Rosso con trasparenza al 50%
            'padding': '5px',
            'border-radius': '5px',
            'align-items': 'center',
            'justify-content': 'center',
            'width':'100px'
        });

        // Aggiungi il segnaposto al body
        $('#revMainContainer').append(counterElement);
    };

    //aggiungiGruppiCurrentList() {
    //    let tmpList = [];
    //    let me = this;
    //    this.currentList.forEach(function (item) {
    //        if (!item.isGruppo && item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] != item.recordInTracciato[keyRefCodice]) {
    //            if (me.currentList.find(f => f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]) == null && tmpList.find(f => f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]) == null) {
    //                let gruppo = me.List.find(f => f.isGruppo && f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);
    //                if (gruppo == null) {
    //                    console.error("Gruppo non trovato, errore");
    //                }
    //                else {
    //                    tmpList.push(gruppo);
    //                }
    //            }
    //        }
    //    });
    //    return(me.currentList.concat(tmpList));
    //}

    syncAnalisiDaIndd() {
        var files = document.querySelector('[name=FileEsportazione]').files;
        if (files.length > 0) {
            showLoading();
            let fd = new FormData();
            fd = new FormData();
            fd.append("file", files[0]);
            fd.append("IdPromo", $("#promoToSync").val());
            fd.append("IdTracciato", $("#tracciatoToSync").val());


            Call.doWithUpload("Revisore", "syncAnalisiFromIndd", "POST", fd, this, function (result, sender) {

                console.log(result);

            });
        }
    }


    searchTracciatoByTitle(title) {
        let fd = new FormData();
        fd.append("title", title);

        Call.doWithUpload("Revisore", "searchTracciatoByTitle", "PUT", fd, this, function (result) {

            console.log(result);
            if (result.length > 0) {
                $("#promoToSync").empty();
                $("#tracciatoToSync").empty();


                var item = result[0];
                $("#promoToSync").append("<option value=\"" + item.idPromoNavigation.id + "\">" + item.idPromoNavigation.nomePromo + "</option>");
                $("#promoToSync").val(item.idPromoNavigation.id);


                $("#tracciatoToSync").append("<option value=\"" + item.id + "\">" + item.sigla + "</option>");
                $("#tracciatoToSync").val(item.id);

            }

        });
    }


    searchTracciatoByPromo(id_promo) {

        Call.doWithUpload("Revisore", "searchTracciatoByPromo/" + id_promo, "GET", null, this, function (result) {

            $("#tracciatoToSync").empty();
            //console.log(result);
            if (result.length > 0) {
                //$("#promoToSync").empty();



                for (var $i = 0; $i < result.length; $i++) {
                    var item = result[$i];
                    $("#tracciatoToSync").append("<option value=\"" + item.id + "\">" + item.sigla + "</option>");
                    $("#tracciatoToSync").val(item.id);
                }



            }

        });
    }

    changeCollapseGruppoSync(sender, codice_gruppo) {

        let uri = getWebAppRootFolder();
        if (uri != "")
            uri = "/" + uri;

        let _classCheck = $("#tblResult").find(".row[codice_gruppo='" + codice_gruppo + "']").first().attr("class");
        if (_classCheck.indexOf("collapsedRef") < 0) {
            $("#tblResult").find(".row[codice_gruppo='" + codice_gruppo + "']").addClass("collapsedRef");
            sender.attr("src", uri + "images/expand.png");
            sender.closest(".recordSync").addClass("mb-3");
        }
        else {
            $("#tblResult").find(".row[codice_gruppo='" + codice_gruppo + "']").removeClass("collapsedRef");
            sender.attr("src", uri + "images/collapse.png");
            sender.closest(".recordSync").removeClass("mb-3");
        }

    }

    sostituisciSottogruppoButton() {
        let list = [];
        let me = this;
        $("#_list_container").find(".ch_approva_gruppo").each(function () {
            list.push($(this).closest(".record-revisione"));
        });
        list.forEach(function (item) {
            let is_gruppo = item.attr("is_gruppo");
            if (is_gruppo == "true" || $("#CmbTracciato").val() == "0") {
                //item.find("#alberoSottogruppi").css("display", "block");
                item.find("#sottogruppoButton").css("display", "none");
                item.find("#testoSottogruppo").css("display", "none");
            }
            else {
                if (item.attr("codice_gruppo").indexOf(",") == -1) {
                    item.find("#sottogruppoButton").css("display", "none");
                    item.find("#testoSottogruppo").css("display", "none");
                }
                else {
                    let element = me.List.find(f => f.idRec == parseInt(item.attr("id_rec")));

                    if (element.recordInTracciato[keyScattoCodiceSottogruppo] != null) {
                        item.find("#testoSottogruppo").text("Visualizza sottogruppo");
                        item.find("#testoSottogruppo").css("pointer-events", "all");
                    }
                    else {
                        item.find("#testoSottogruppo").text("Nessun sottogruppo");
                        item.find("#testoSottogruppo").css("pointer-events", "none"); // non funziona
                    }

                }
            }
        });
    }

    ApriFinestraSottogruppoDaSender(sender) {
        let idSender = sender.closest(".record-revisione").attr("id_rec");
        console.log(idSender);
        this.ApriFinestraSottogruppo(idSender);
    }

    ApriFinestraSottogruppo(idRec) {
        let element = this.List.find(f => f.idRec == idRec);
        let codiceGruppo = element.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];
        let groupElements = [];
        groupElements = this.List.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == codiceGruppo && f.isGruppo == false);
        console.log(groupElements);
        $('#costruisciSottogruppoModal').modal('show');
        $('#costruisciSottogruppoModal').find(".modal-body").empty();

        $('#costruisciSottogruppoModal').find("#costruisciSottogruppoTitle").text(element.recordInTracciato[keyRefCodice]);
        $('#costruisciSottogruppoModal').find("#costruisciSottogruppoTitle").attr("idRec", element.idRec);
        $('#costruisciSottogruppoModal').find("#costruisciSottogruppoTitle").attr("codiceRef", element.recordInTracciato[keyRefCodice]);
        $('#costruisciSottogruppoModal').find("#costruisciSottogruppoTitle").attr("codiceGruppo", element.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);

        groupElements.forEach(function (item) {
            let template = $("#recordModalTemplate").clone();
            let htmlItem = $(template.html());
            if (item != element) {
                htmlItem.find("#singolaRefSottoGruppo").text(item.recordInTracciato[keyRefCodice]);
                htmlItem.attr("idRec", item.idRec);
                htmlItem.attr("codiceRef", item.recordInTracciato[keyRefCodice]);
                htmlItem.attr("codiceGruppo", item.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)]);

                if (item.recordInTracciato[keyScattoCodiceSottogruppo] != null) {
                    if (element.recordInTracciato[keyScattoCodiceSottogruppo] != null && item.recordInTracciato[keyScattoCodiceSottogruppo] == element.recordInTracciato[keyScattoCodiceSottogruppo]) {
                        htmlItem.find("#checkboxSottogruppo").prop("checked", true);
                    }
                    else if (item.recordInTracciato[keyScattoCodiceSottogruppo] != null) {
                        htmlItem.find("#checkboxSottogruppo").prop("disabled", true);
                        htmlItem.find(".col").addClass("bg-danger");
                        htmlItem.find(".col").addClass("bg-opacity-25");
                    }
                }

                htmlItem.find("#checkboxSottogruppo").on("change", function () {
                    revInstance.ModificaSottogruppoDaSender($(this));
                });

                $('#costruisciSottogruppoModal').find(".modal-body").append(htmlItem);
            }
        });
    }

    ModificaSottogruppoDaSender(sender) {
        let record = sender.closest(".recordModal");
        let idRec = record.attr("idRec");
        let idRecPilota = $('#costruisciSottogruppoModal').find("#costruisciSottogruppoTitle").attr("idRec");
        let add = sender.prop("checked");
        this.ModificaSottogruppo(idRec, idRecPilota, add)
    }

    ModificaSottogruppo(idRec, idRecPilota, add) {
        showLoading();
        let ME = this;
        let IdTracciato = parseInt($("#CmbTracciato").val());
        let propaga = $("#propagaSottogruppi").prop("checked");
        if (add) {
            Call.do("Revisore", "AggiungiASottogruppo/" + idRec + "/" + idRecPilota + "/" + IdTracciato + "/" + propaga, "GET", null, ME, function (result, sender) {
                console.log(result);
                if (result.error == null || result.error == "") {
                    result.idRecDaModificare.forEach(function (item) {
                        ME.List.find(f => f.idRec == item).recordInTracciato[keyScattoCodiceSottogruppo] = result.codiceSottogruppo;
                    });
                    ME.sostituisciSottogruppoButton();

                    if (result.tracciatiNonModificati.length > 0) {
                        const appendAlert = (message, type) => {
                            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
                            const content = $('<div></div>').text(message)
                            const closeButton = $('<button></button>').addClass('btn-close').attr({
                                'type': 'button',
                                'data-bs-dismiss': 'alert',
                                'aria-label': 'Close'
                            });
                            wrapper.append(content, closeButton)
                            $('#liveAlertPlaceholder').append(wrapper)

                            // Chiude automaticamente l'alert dopo 1 secondo
                            setTimeout(function () {
                                wrapper.alert('close')
                            }, 2000);
                        }

                        let message;
                        message = "Il sottogruppo non è stato propagato su:";
                        result.tracciatiNonModificati.forEach(function (item) {
                            message += " " + item + ",";
                        });
                        message = message.substring(0, message.length - 1);

                        appendAlert(message, 'warning');

                    }
                }
                hideLoading();
            });
        }
        else {
            Call.do("Revisore", "RimuoviDaSottogruppo/" + idRec + "/" + idRecPilota + "/" + IdTracciato + "/" + propaga, "GET", null, ME, function (result, sender) {
                console.log(result);
                if (result.error == null || result.error == "") {

                    delete ME.List.find(f => f.idRec == idRec).recordInTracciato[keyScattoCodiceSottogruppo];
                    result.idRecDaModificare.forEach(function (item) {
                        if (result.codiceSottogruppo != "") {
                            ME.List.find(f => f.idRec == item).recordInTracciato[keyScattoCodiceSottogruppo] = result.codiceSottogruppo;
                        }
                        else {
                            delete ME.List.find(f => f.idRec == item).recordInTracciato[keyScattoCodiceSottogruppo];
                        }
                    });
                    ME.sostituisciSottogruppoButton();
                    if (result.tracciatiNonModificati.length > 0) {

                        const appendAlert = (message, type) => {
                            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
                            const content = $('<div></div>').text(message)
                            const closeButton = $('<button></button>').addClass('btn-close').attr({
                                'type': 'button',
                                'data-bs-dismiss': 'alert',
                                'aria-label': 'Close'
                            });
                            wrapper.append(content, closeButton)
                            $('#liveAlertPlaceholder').append(wrapper)

                            // Chiude automaticamente l'alert dopo 1 secondo
                            setTimeout(function () {
                                wrapper.alert('close')
                            }, 2000);
                        }
                        let message;
                        message = "Il sottogruppo non è stato propagato su:";
                        result.tracciatiNonModificati.forEach(function (item) {
                            message += " " + item + ",";
                        });
                        message = message.substring(0, message.length - 1);

                        appendAlert(message, 'warning');

                    }
                }
                hideLoading();
            });
        }
    }

    visualizzaSottogruppoDaSender(sender) {
        let idRec = sender.closest(".record-revisione").attr("id_rec");
        this.visualizzaSottogruppo(idRec);
    }

    visualizzaSottogruppo(idRec) {

        let element = this.List.find(f => f.idRec == idRec);
        $("#visualizzaSottogruppoTitle").text("Sottogruppo: " + element.recordInTracciato[keyScattoCodiceSottogruppo]);
        $('#visualizzaSottogruppoModal').modal('show');
        $('#visualizzaSottogruppoModal').find(".modal-body").empty();
        let template = $("#templateDettaglioSottogruppo").clone();
        let htmlItem = $(template.html());

        let me = this;
        let obj;

        $(htmlItem).find("#codici_sottogruppo").text(element.recordInTracciato[keyScattoCodiceSottogruppo]);
        obj = this.List.filter(f => f.recordInTracciato[keyScattoCodiceSottogruppo] != null && f.recordInTracciato[keyScattoCodiceSottogruppo] == element.recordInTracciato[keyScattoCodiceSottogruppo]).sort((a, b) => a.recordInTracciato["StatoSelezione"] - b.recordInTracciato["StatoSelezione"]);

        obj.forEach(function (objItem) {
            let htmlOggetto = $($("#oggetto_sottogruppo").clone().html());
            console.log(objItem);

            $(htmlOggetto).addClass("bg-success");
            $(htmlOggetto).addClass("bg-opacity-75");


            $(htmlOggetto).find(".codiceReferenzaSottogruppo").text(objItem.recordInTracciato[keyRefCodice]);
            if (objItem.recordRevisionato != null) {
                $(htmlOggetto).find("#Descrizione1Sottogruppo").text(objItem.recordRevisionato.descrizione1);
                if ($(htmlOggetto).find("#Descrizione1Sottogruppo").text() == "") { $(htmlOggetto).find("#Descrizione1Sottogruppo").closest(".row").css("display", "none"); }

                $(htmlOggetto).find("#Descrizione2Sottogruppo").text(objItem.recordRevisionato.descrizione2);
                if ($(htmlOggetto).find("#Descrizione2Sottogruppo").text() == "") { $(htmlOggetto).find("#Descrizione2Sottogruppo").closest(".row").css("display", "none"); }

                $(htmlOggetto).find("#Descrizione3Sottogruppo").text(objItem.recordRevisionato.descrizione3);
                if ($(htmlOggetto).find("#Descrizione3Sottogruppo").text() == "") { $(htmlOggetto).find("#Descrizione3Sottogruppo").closest(".row").css("display", "none"); }

                $(htmlOggetto).find("#Descrizione4Sottogruppo").text(objItem.recordRevisionato.descrizione4);
                if ($(htmlOggetto).find("#Descrizione4Sottogruppo").text() == "") { $(htmlOggetto).find("#Descrizione4Sottogruppo").closest(".row").css("display", "none"); }

                $(htmlOggetto).find("#DescrizioneInddSottogruppo").text(objItem.recordRevisionato.descrizioneIndd);
                if ($(htmlOggetto).find("#DescrizioneInddSottogruppo").text() == "") { $(htmlOggetto).find("#DescrizioneInddSottogruppo").closest(".row").css("display", "none"); }
            }

            $(htmlItem).find(".dettagliOggettiSottogruppo").append(htmlOggetto);
        });

        $(htmlItem).attr("codice_gruppo", element.recordInTracciato[keyScattoCodiceSottogruppo]);
        let tmpText = $(htmlItem).find("#codici_sottogruppo").text();
        if (tmpText.length > 60) {
            tmpText = tmpText.substring(0, 60);
            $(htmlItem).find("#codici_multiplex").text(tmpText);
        }


        let fd = new FormData();
        fd.append("codice", element.recordInTracciato[keyScattoCodiceSottogruppo]);

        Call.doWithUpload("Archivio", "GetDescrizioneByCodice", "PUT", fd, this, function (result, sender) {
            console.log(result);
            if (result != null) {
                $(htmlItem).find("#Descrizione1").text(result.descrizione1);
                $(htmlItem).find("#Descrizione2").text(result.descrizione2);
                $(htmlItem).find("#Descrizione3").text(result.descrizione3);
                $(htmlItem).find("#Descrizione4").text(result.descrizione4);
                $(htmlItem).find("#DescrizioneIndd").text(result.descrizioneIndd);
            }
        });

        htmlItem.find("#cmbStatoSelezione").on("change", function () {
            enaboInstance.cambioSelezione($(this));
        });

        htmlItem.find(".arrow").on("click", function () {
            revInstance.cambiaVisualizzazioneDatoPerMismatch($(this));
        });

        htmlItem.find("#bottoneSalva").on("click", function () {
            revInstance.salvaRevisione($(this), $(this).attr('canale'), $(this).attr('area'));
        });

        $('#visualizzaSottogruppoModal').find(".modal-body").append(htmlItem);

        obj.forEach(function (item) {
            if (item.idRec != null) {
                console.log("singola");
                //Accede alla efunzione definita in components.js
                let htmlTmp = renderRecordRevisione("templateDettaglio", item, me.agenzia, me.List, this.olimpoIp, true, null, null, false, false);
                console.log(htmlTmp);
                $('#visualizzaSottogruppoModal').find(".modal-body").append(htmlTmp);
            }
        });
    }

    apriDettaglioRevisione(sender, modal) {
        let me = this;
        //Chiamata di recupero del codice
        let recItem = sender.closest(".recordSync");
        let cod = recItem.attr("codice");
        let fd = new FormData();
        fd.append("codice", cod);

        showLoading();

        $("#" + modal).find("#content").html("");


        Call.doWithUpload("Archivio", "GetDescrizioneByCodice", "PUT", fd, this, function (result, sender) {
            let htmlItem = renderRecordRevisione("templateDettaglio", { codice: cod, descrizione: result }, sender.agenzia, me.List, this.olimpoIp, true, null, null, false, agenzia.mostraFirmaTracciato());
            $("#" + modal).find("#content").append(htmlItem);
            hideLoading();
        });
    }

    onSalvatoInArchivio(result, sender) {

        let codUpdated = sender.closest(".record_articolo").attr("codice");
        let recMatched = $("#tblResult").find(".recordSync[codice='" + codUpdated + "']");
        if (recMatched.length > 0) {
            recMatched.find("#stato_revisione").removeClass("bg-danger");
            recMatched.find("#stato_revisione").removeClass("bg-warning");
            recMatched.find("#stato_revisione").removeClass("bg-sinfo");
            recMatched.find("#stato_revisione").addClass("bg-success");
            recMatched.find("#stato_revisione").text("Revisionato");

            let descrText = recMatched.find("#lab_descrizione");
            if (result.descrizioneIndd != null && result.descrizioneIndd != "")
                descrText.html(result.descrizioneIndd);
            else
                descrText.html(result.descrizione1);


        }
        $("#modalDtl").modal('hide');

    }

    riempiBoxFirmeTracciato() {
        let elements = $(".record-revisione");
        let me = this;
        elements.each(function () {
            if ($(this).attr("is_gruppo") == "true") {
                $(this).find("#Firmaprec").parent().css("display", "none")
            }
            else {
                let idRec = $(this).attr("id_rec");
                let el = me.List.find(f => !f.isGruppo && f.idRec == idRec);
                if (el == null) {
                    console.error("Singolo non trovato in lista");
                    return;
                }
                if (el.recordInTracciato != null && el.recordInTracciato[keyTracciatoFirma] != null) {
                    let firmaTrac = el.recordInTracciato[keyTracciatoFirma];
                    $(this).find("#Firmatrac").val(firmaTrac);
                }
                else {
                    $(this).find("#Firmatrac").parent().css("display", "none")
                }
            }
        });
    }

    /// I20-982: i campi di un record come vanno mostrati nella colonna di sinistra: vale il
    /// valore revisionato quando c'e', altrimenti quello del tracciato, altrimenti la stringa
    /// vuota.
    ///
    /// La regola era ripetuta sei volte dentro il codice che costruisce l'HTML, una per campo:
    /// qui sta scritta una volta e si puo' verificare senza browser. Le chiavi del tracciato
    /// arrivano da fuori perche' sono variabili globali della pagina.
    static campiPerLaColonna(record, chiavi) {
        var nomi = chiavi || {};
        var revisionato = record != null ? record.recordRevisionato : null;
        var tracciato = record != null && record.recordInTracciato != null ? record.recordInTracciato : {};

        var valore = function (daRevisione, chiaveTracciato) {
            if (revisionato != null && revisionato[daRevisione] != null) {
                return revisionato[daRevisione];
            }
            var dalTracciato = chiaveTracciato != null ? tracciato[chiaveTracciato] : null;
            return dalTracciato != null ? dalTracciato : "";
        };

        return {
            descrizione1: valore("descrizione1", nomi.descrizione1),
            descrizione2: valore("descrizione2", nomi.descrizione2),
            descrizione3: valore("descrizione3", nomi.descrizione3),
            descrizione4: valore("descrizione4", nomi.descrizione4),
            um: valore("um", nomi.um),
            peso: valore("peso", nomi.peso)
        };
    }

    /// Le chiavi del tracciato usate dalla colonna, prese dalle variabili globali della pagina.
    static chiaviDellaColonna() {
        return {
            descrizione1: typeof keyDescr1 !== "undefined" ? keyDescr1 : null,
            descrizione2: typeof keyDescr2 !== "undefined" ? keyDescr2 : null,
            descrizione3: typeof keyDescr3 !== "undefined" ? keyDescr3 : null,
            descrizione4: typeof keyDescr4 !== "undefined" ? keyDescr4 : null,
            um: typeof keyDescrUm !== "undefined" ? keyDescrUm : null,
            peso: typeof keyDescrPeso !== "undefined" ? keyDescrPeso : null
        };
    }

    /// I20-982: quanto alto fare un campo perche' il testo ci stia, senza passare il massimo
    /// di righe concesso. Oltre quel tetto il campo scorre invece di crescere, altrimenti una
    /// descrizione lunga spingerebbe fuori vista tutto il resto della colonna.
    ///
    /// Torna null quando le misure non si leggono: in quel caso il campo resta com'e', che e'
    /// meglio di un'altezza inventata.
    static altezzaCampoDescrizione(altezzaContenuto, altezzaRiga, massimoRighe, spazioInterno) {
        var contenuto = Number(altezzaContenuto);
        var riga = Number(altezzaRiga);
        var righe = Number(massimoRighe);
        var spazio = Number(spazioInterno);

        if (!isFinite(contenuto) || contenuto <= 0 || !isFinite(riga) || riga <= 0 ||
            !isFinite(righe) || righe <= 0) {
            return null;
        }

        if (!isFinite(spazio) || spazio < 0) {
            spazio = 0;
        }

        return Math.min(contenuto, Math.ceil(riga * righe) + spazio);
    }

    /// Adatta al testo il campo Descrizione1 della scheda. Va chiamato dopo che la scheda e'
    /// nella pagina: prima l'altezza del contenuto non e' misurabile.
    static adattaDescrizioneAlTesto(htmlItem, massimoRighe = 3) {
        try {
            var campo = htmlItem.find("#Descrizione1Tracciato")[0];
            if (campo == null) {
                return;
            }

            var stile = window.getComputedStyle(campo);
            var riga = parseFloat(stile.lineHeight);
            if (!isFinite(riga) || riga <= 0) {
                //line-height normal non si legge in pixel: si stima dal corpo del carattere.
                riga = parseFloat(stile.fontSize) * 1.2;
            }
            var spazio = (parseFloat(stile.paddingTop) || 0) + (parseFloat(stile.paddingBottom) || 0);

            //Si azzera prima di misurare, altrimenti si legge l'altezza imposta e non quella
            //che il testo chiede.
            campo.style.height = "auto";
            var altezza = Revisore.altezzaCampoDescrizione(campo.scrollHeight, riga, massimoRighe, spazio);

            if (altezza == null) {
                campo.style.height = "";
                return;
            }

            campo.style.height = altezza + "px";
            campo.style.overflowY = "auto";
        }
        catch (e) {
            console.log("Altezza della descrizione non adattata: " + e);
        }
    }

    /// Riempie una scheda della colonna con i campi di un record.
    static riempiSchedaColonna(htmlItem, record, codice) {
        var campi = Revisore.campiPerLaColonna(record, Revisore.chiaviDellaColonna());

        //I20-982: il codice del gruppo padre e' l'elenco delle referenze separate da virgola e
        //trabocca dal riquadro. Si lascia troncare al browser, che sa quanto spazio c'e' e mette
        //i puntini al punto giusto; contare i caratteri qui taglierebbe a caso, perche' la
        //larghezza dipende dal carattere. Il valore intero resta nel title: ci si passa sopra e
        //si legge tutto.
        var testoCodice = "Cod: " + codice;
        htmlItem.find(".codice")
            .attr("title", testoCodice)
            .empty()
            .append($("<span></span>")
                .css({
                    "display": "block",
                    "max-width": "100%",
                    "overflow": "hidden",
                    "text-overflow": "ellipsis",
                    "white-space": "nowrap"
                })
                .text(testoCodice));
        htmlItem.find("#Descrizione1Tracciato").val(campi.descrizione1);
        htmlItem.find("#Descrizione2Tracciato").val(campi.descrizione2);
        htmlItem.find("#Descrizione3Tracciato").val(campi.descrizione3);
        htmlItem.find("#Descrizione4Tracciato").val(campi.descrizione4);
        htmlItem.find("#UmTracciato").val(campi.um);
        htmlItem.find("#PesoTracciato").val(rappresenteDecimaleInCulturaItaliana(campi.peso));

        htmlItem.find("#btnDuplica").on("click", function () {
            revInstance.copiaValoriNelGruppo($(this).closest('.container'));
        });

        return htmlItem;
    }

    sostituisciColonnaSinistraGruppo() {
        let me = this;
        let gruppiElements = $("#_list").find(".record-revisione[is_gruppo='true']");
        gruppiElements.each(function () {
            var tracciatoCompilato = false;
            if ($(this).find("#Descrizione1Tracciato").val() != "" ||
                $(this).find("#Descrizione2Tracciato").val() != "" ||
                $(this).find("#Descrizione3Tracciato").val() != "" ||
                $(this).find("#Descrizione4Tracciato").val() != "") {
                tracciatoCompilato = true;
            }
            let codiceGruppo = $(this).attr("codice_gruppo");
            if (!tracciatoCompilato || revInstance.modalitaSottogruppi) {
                let groupElement = $(this);
                groupElement.find(".colonnaTracciato").css("display", "none");
                groupElement.find(".dettaglioGruppo").css("display", "block");
                let elementsOfGroup = me.List.filter(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == codiceGruppo && !f.isGruppo);
                if (me.agenzia.addCustomDettagli != null) {
                    me.agenzia.addCustomDettagli(groupElement.find(".dettaglioGruppo"), elementsOfGroup);
                }
                if (revInstance.modalitaSottogruppi) {
                    //I20-982: in modalita' sottogruppi la colonna porta i campi revisionati del
                    //solo gruppo padre. Le schede dei singoli, che prima venivano accodate qui,
                    //ripetevano un dato che l'operatore ha gia' sotto gli occhi nelle righe del
                    //sottogruppo, e allungavano la colonna fino a nascondere quello che conta.
                    if (elementsOfGroup.length > 0) {
                        let gruppoPadre = me.ListSottogruppi.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == elementsOfGroup[0].recordInTracciato[keyScattoCodiceGruppo] && f.isGruppo);

                        if (gruppoPadre != null) {
                            groupElement.find(".dettaglioGruppo").append(
                                $('<div class="fw-bold text-primary border-bottom border-primary mb-2 pb-1" style="font-size:12px;">Campi revisionati gruppo padre</div>'));

                            let template = $("#recapElementGruppo").clone();
                            let htmlItem = $(template.html());
                            //La scheda del padre si distingue da quelle gialle di riepilogo: qui e'
                            //l'unica cosa in colonna, e il colore d'avviso non ha piu' senso.
                            htmlItem.removeClass("bg-warning bg-opacity-50").addClass("bg-light border rounded p-2");

                            Revisore.riempiSchedaColonna(htmlItem, gruppoPadre, gruppoPadre.recordInTracciato[keyScattoCodiceGruppo]);

                            groupElement.find(".dettaglioGruppo").append(htmlItem);
                            Revisore.adattaDescrizioneAlTesto(htmlItem);
                        }
                    }
                }
                else {
                    elementsOfGroup.forEach(function (item) {
                        let template = $("#recapElementGruppo").clone();
                        let htmlItem = $(template.html());

                        Revisore.riempiSchedaColonna(htmlItem, item, item.recordInTracciato[keyRefCodice]);

                        groupElement.find(".dettaglioGruppo").append(htmlItem);
                        Revisore.adattaDescrizioneAlTesto(htmlItem);
                    });
                }
            }
            //else {
            //    if (me.agenzia.compilaBoxConInformazioniCustom != null) {
            //        let item = me.List.find(f => f.recordInTracciato[(revInstance.modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)] == codiceGruppo && f.isGruppo);
            //        if (item != null) {
            //            me.agenzia.compilaBoxConInformazioniCustom($(this), item);                    
            //        }
            //    }
            //}
        });
    }

    copiaValoriNelGruppo(boxElementoDaCopiare) {
        console.log(boxElementoDaCopiare);
        let record = boxElementoDaCopiare.closest(".record-revisione");
        record = record.find(".content.active");
        let boxDescrizione1 = record.find("#Descrizione1");
        let boxDescrizione2 = record.find("#Descrizione2");
        let boxDescrizione3 = record.find("#Descrizione3");
        let boxDescrizione4 = record.find("#Descrizione4");
        let boxUm = record.find("#Um");
        let boxPeso = record.find("#Peso");
        if (boxDescrizione1.val() != "" || boxDescrizione2.val() != "" || boxDescrizione3.val() != "" || boxDescrizione4.val() != "" || boxUm.val() != "" || boxPeso.val() != "") {
            if (!confirm("Il gruppo contiene già dei valori, se procedi verranno sovrascritti, continuare?")) {
                return;
            }
        }
        if (boxElementoDaCopiare.find("#Descrizione1Tracciato").val() != boxDescrizione1.val())
            this.changeBorderAndSave(boxDescrizione1);
        boxDescrizione1.val(boxElementoDaCopiare.find("#Descrizione1Tracciato").val());

        if (boxElementoDaCopiare.find("#Descrizione2Tracciato").val() != boxDescrizione2.val())
            this.changeBorderAndSave(boxDescrizione2);
        boxDescrizione2.val(boxElementoDaCopiare.find("#Descrizione2Tracciato").val());

        if (boxElementoDaCopiare.find("#Descrizione3Tracciato").val() != boxDescrizione3.val())
            this.changeBorderAndSave(boxDescrizione3);
        boxDescrizione3.val(boxElementoDaCopiare.find("#Descrizione3Tracciato").val());

        if (boxElementoDaCopiare.find("#Descrizione4Tracciato").val() != boxDescrizione4.val())
            this.changeBorderAndSave(boxDescrizione4);
        boxDescrizione4.val(boxElementoDaCopiare.find("#Descrizione4Tracciato").val());

        if (boxElementoDaCopiare.find("#UmTracciato").val() != boxUm.val())
            this.changeBorderAndSave(boxUm);
        boxUm.val(boxElementoDaCopiare.find("#UmTracciato").val());

        if (boxElementoDaCopiare.find("#PesoTracciato").val() != boxPeso.val())
            this.changeBorderAndSave(boxPeso);
        boxPeso.val(boxElementoDaCopiare.find("#PesoTracciato").val());

    }

    copyCodice(sender) {
        let text = "";
        let isGruppo = sender.closest(".record-revisione").attr("is_gruppo") == "true";
        if (!isGruppo) {
            text = sender.closest(".row").find("#a_scheda_articolo").text();
        }
        else {
            text = sender.closest(".record-revisione").attr("codice_gruppo");
        }
        this.copyToClipboard(text);
        sender.removeClass("fa-copy").addClass("fa-check");

        // Ripristina l'icona a fa-copy dopo 2 secondi
        setTimeout(function () {
            sender.removeClass("fa-check").addClass("fa-copy");
        }, 1000);
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .then(function () {
                console.log('Testo copiato negli appunti con successo.');
            })
            .catch(function (err) {
                console.error('Errore durante la copia negli appunti:', err);
            });

    }

    gruppidebug = []

    controllaModalita() {
        var mode = $("#filtraPerGruppiOSingoli").val();
        if (mode == "sottogruppi") {
            if (!this.modalitaSottogruppi) {
                this.attivaModalitàVisualizzazioneSottogruppi(true);
            }
            else {
                this.preparaListaDaCaricare(0);
            }
        }
        else {
            if (this.modalitaSottogruppi) {
                this.attivaModalitàVisualizzazioneSottogruppi(false);
            }
            else {
                this.preparaListaDaCaricare(0);
            }
        }
    }

    nascondiGruppi(senderVal) {
        this.gruppiVisualizzati = !senderVal;
        this.preparaListaDaCaricare(this.currentPage-1);
    }

    attivaModalitàVisualizzazioneSottogruppi(senderVal) {
        let me = this;
        this.modalitaSottogruppi = senderVal;
        if (senderVal) {
            if (this.ListSottogruppi.length == 0) {
                let listaSottogruppi = [];
                this.List.forEach(function (item) {
                    if (!item.isGruppo && item.recordInTracciato[keyScattoCodiceSottogruppo] != null && !listaSottogruppi.includes(item.recordInTracciato[keyScattoCodiceSottogruppo])) {
                        listaSottogruppi.push(item.recordInTracciato[keyScattoCodiceSottogruppo]);
                    }
                });
                console.log(listaSottogruppi);
                let codiciList = {
                    stringhe: listaSottogruppi,
                }
                let idPromo = parseInt($("#Promo").val());

                Call.do("Revisore", "getArticoliDescrizioniSottogruppi/" + idPromo, "PUT", codiciList, this, function (result, sender) {
                    console.log(result);
                    result.sort(function (a, b) {
                        var codiceGruppoA = me.List.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceSottogruppo] != null && f.recordInTracciato[keyScattoCodiceSottogruppo] == a.codiceSottogruppo).recordInTracciato[keyScattoCodiceGruppo];
                        var codiceGruppoB = me.List.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceSottogruppo] != null && f.recordInTracciato[keyScattoCodiceSottogruppo] == b.codiceSottogruppo).recordInTracciato[keyScattoCodiceGruppo];

                        // Utilizza localeCompare per ordinare le stringhe
                        return codiceGruppoA.localeCompare(codiceGruppoB);
                    });
                    let thisGruppoOriginaleAppartenenza = "";

                    for (let i = 0; i < result.length; i++) {
                        let codiceSottGruppo = result[i].codiceSottogruppo;
                        let naz = result[i].descrizioni.find(f => f.area == null && f.canale == null);
                        let regionali = result[i].descrizioni.filter(f => !(f.area == null && f.canale == null));
                        let sottogruppoItem = {
                            hasFoto: 0,
                            idRec: 0,
                            inxOrd: 999999,
                            isGruppo: true,
                            isObsoleto: false,
                            label: null,
                            recordImpaginato: null,
                            recordInTracciato: {},
                            recordRevisionato: naz,
                            recordRevisionatiRegionali: regionali,
                            statoSelezione: 0
                        };

                        //sottogruppoItem.recordRevisionato = item;
                        sottogruppoItem.recordInTracciato[keyScattoCodiceGruppo] = codiceSottGruppo;
                        sottogruppoItem.recordInTracciato[keyScattoCodiceSottogruppo] = codiceSottGruppo;
                        sottogruppoItem.recordInTracciato[keyTracciatoFirma] = result[i].firmaTracciatoSottogruppo;
                        sottogruppoItem.recordInTracciato.metaKeyInMismatch = [];

                        // Trova il gruppo originale di appartenenza
                        sottogruppoItem.recordInTracciato.gruppoOriginaleAppartenenza = me.List.find(f => !f.isGruppo && f.recordInTracciato[keyScattoCodiceSottogruppo] != null && f.recordInTracciato[keyScattoCodiceSottogruppo] == codiceSottGruppo).recordInTracciato[keyScattoCodiceGruppo];

                        let groupItems = me.List.filter(f => f.recordInTracciato[keyScattoCodiceSottogruppo] != null && f.recordInTracciato[keyScattoCodiceSottogruppo] == codiceSottGruppo && !f.isGruppo);

                        me.ListSottogruppi = me.ListSottogruppi.concat(groupItems);
                        me.ListSottogruppi.push(sottogruppoItem);
                    }


                    let listaOrdinata = [];

                    let gruppi = me.ListSottogruppi.filter(item => item.isGruppo);
                    me.gruppidebug = gruppi;
                    var debugQuantitaRegistrata = 0;
                    gruppi.forEach(gruppo => {
                        listaOrdinata.push(gruppo);

                        let figli = me.ListSottogruppi
                            .filter(item =>
                                !item.isGruppo &&
                                item.recordInTracciato[keyScattoCodiceGruppo] === gruppo.recordInTracciato.gruppoOriginaleAppartenenza &&
                                item.recordInTracciato[keyScattoCodiceSottogruppo] === gruppo.recordInTracciato[keyScattoCodiceGruppo]
                            )
                            .sort((a, b) => {
                                let codiceA = a.recordInTracciato[keyScattoCodiceSottogruppo] || '';
                                let codiceB = b.recordInTracciato[keyScattoCodiceSottogruppo] || '';
                                return codiceA.localeCompare(codiceB);
                            });

                        listaOrdinata = listaOrdinata.concat(figli);
                        console.log(listaOrdinata.filter(f => f.isGruppo == false && f.recordInTracciato[keyRefCodice] == 1572263))

                        if (listaOrdinata.filter(f => f.isGruppo == false && f.recordInTracciato[keyRefCodice] == 3088643).length > debugQuantitaRegistrata) {
                            debugQuantitaRegistrata++;
                        }
                    });

                    me.ListSottogruppi = listaOrdinata;

                    let tmpList = [];
                    tmpList = tmpList.concat(me.List);
                    me.List = [];
                    me.List = me.List.concat(me.ListSottogruppi);
                    me.ListSottogruppi = [];
                    me.ListSottogruppi = me.ListSottogruppi.concat(tmpList);
                    if (me.agenzia.applyFilterToListAttivazioneSottogruppi != null) {

                        me.List = me.agenzia.applyFilterToListAttivazioneSottogruppi(me.List);
                    }
                    me.preparaListaDaCaricare(0);
                });
            }
            else {
                let tmpList = [];
                tmpList = tmpList.concat(me.List);
                me.List = [];
                me.List = me.List.concat(me.ListSottogruppi);
                me.ListSottogruppi = [];
                me.ListSottogruppi = me.ListSottogruppi.concat(tmpList);
                if (me.agenzia.applyFilterToListAttivazioneSottogruppi != null) {

                    me.List = me.agenzia.applyFilterToListAttivazioneSottogruppi(me.List);
                }
                me.preparaListaDaCaricare(0);
            }
        }
        else {
            let tmpList = [];
            tmpList = tmpList.concat(me.List);
            me.List = [];
            me.List = me.List.concat(me.ListSottogruppi);
            me.ListSottogruppi = [];
            me.ListSottogruppi = me.ListSottogruppi.concat(tmpList);

            if (me.agenzia.applyFilterToListAttivazioneSottogruppi != null) {
                me.List = me.agenzia.applyFilterToListAttivazioneSottogruppi(me.List);

            }

            me.preparaListaDaCaricare(0);
        }
    }


    checkLastModificaFromButton(sender, canale = null, area = null) {

        let recItem = sender.closest(".record-revisione");
        let is_gruppo = recItem.attr("is_gruppo");

        if (is_gruppo == "false") {
            let codice = recItem.attr("referenzaCodice");
            this.checkLastModifica(codice, canale, area);
        }
        else {
            let codGruppo = recItem.attr("codice_gruppo");
            this.checkLastModifica(codGruppo, canale, area);
        }
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

    apriModalDescrizioneReg(sender) {
        const areePromo = this.areePromo;
        const canaliPromo = this.canaliPromo;

        const $modal = $("#modalAddDescrReg");

        // Pulisci e popola le select
        const $selectArea = $modal.find("#selectArea").empty().append('<option value="">Non specificato</option>');
        const $selectCanale = $modal.find("#selectCanale").empty().append('<option value="">Non specificato</option>');

        areePromo.forEach(area => {
            $("<option>", { value: area, text: area }).appendTo($selectArea);
        });

        canaliPromo.forEach(canale => {
            $("<option>", { value: canale, text: canale }).appendTo($selectCanale);
        });

        // Calcola le combinazioni area+canale dai .content dentro sender
        const combinazioni = [];
        $(sender).find(".content").each(function () {
            const area = $(this).attr("area") || "";
            const canale = $(this).attr("canale") || "";
            if (area || canale) {
                combinazioni.push(canale + area);
            }
        });

        // Salva le combinazioni nel campo nascosto
        $modal.find("#combinazioniEsistenti").val(JSON.stringify(combinazioni));

        // Mostra il modal in modo corretto
        $modal.data("sender", $(sender));
        $modal.modal('show');
    }

    aggiungiCombinazione(modal) {
        const area = $('#selectArea').val();
        const canale = $('#selectCanale').val();
        const combinazione = canale + area;
        const htmlItem = modal.data("sender");

        let codice = htmlItem.attr("referenzacodice");
        let codiceGruppo = htmlItem.attr("codice_gruppo");

        if (!area && !canale) {
            alert("Non è possibile creare una nuova revisione nazionale");
            return;
        }

        // Leggi combinazioni esistenti dal campo hidden
        const combinazioniEsistenti = JSON.parse($('#combinazioniEsistenti').val() || '[]');

        if (combinazioniEsistenti.includes(combinazione)) {
            alert(canale + area + " già esistente");
            return;
        }

        // Altrimenti: combinazione nuova!
        console.log("Nuova combinazione valida:", combinazione);


        var nome = canale + area;

        // Crea ID unico per la tab
        var tabId = "tab-" + nome + (codice != null && codice != "" ? codice : codiceGruppo);
        tabId = tabId.replace(/,/g, "_");

        // 1. Crea nuovo tab header
        var newTab = $('<li class="nav-item" role="presentation">')
            .append($('<button>')
                .addClass('nav-link')
                .attr({
                    id: tabId + '-tab',
                    'data-bs-toggle': 'tab',
                    'data-bs-target': '#' + tabId,
                    type: 'button',
                    role: 'tab',
                    'aria-controls': tabId,
                    'aria-selected': 'false'
                })
                .text(nome)
            );
        htmlItem.find('#tabHeader').append(newTab);

        // 2. Clona il contenuto del template
        let temp = $("#contenutoDescrizioneArchivio").clone();
        let templateArch = $(temp.html());

        if (false) {
            templateArch.find("#DescrizioneIndd").val(revRegionale.descrizioneIndd);
            templateArch.find(".indd").css("display", "block");
        }

        templateArch.find("#lab_data_ultima_revisione").text("Ultima revisione: mai revisionato");



        templateArch.find("#riga_revisione").addClass("bg-danger");
        templateArch.find("#riga_revisione").addClass("bg-opacity-25");
        templateArch.find("#revisionato_flag").text("Da revisionare, nuovo elemento");

        templateArch.find("#bottoneSalva").attr("canale", canale);
        templateArch.find("#bottoneSalva").attr("area", area);

        templateArch.find("#ch_salva_gruppo").on("change", function () {
            revInstance.TogglePulsanteSalvaInGruppo($(this).prop('checked'));
        });

        templateArch.find("#vediUltimeModifiche").on("click", function () { 
            revInstance.checkLastModificaFromButton($(this),
                $(this).closest('.row').find('#bottoneSalva').attr('canale'),
                $(this).closest('.row').find('#bottoneSalva').attr('area'));
        });
        templateArch.find("#bottoneSalva").on("click", function () {
            revInstance.salvaRevisione($(this), $(this).attr('canale'), $(this).attr('area'));
        });
        templateArch.find("#lblBtnSalvaGruppo").on("click", function () {
            $(this).closest('.col').find('#ch_salva_gruppo').prop('checked',
                !$(this).closest('.col').find('#ch_salva_gruppo').prop('checked'));
            revInstance.TogglePulsanteSalvaInGruppo($(this).closest('.col').find('#ch_salva_gruppo').prop('checked'));
        });

        templateArch.find(".inputDescrArchivio").on("click", function () {
            revInstance.controlChangeText($(this));
        });

        // 3. Crea tab pane e inserisci il clone
        var newPane = $('<div>')
            .addClass('tab-pane fade content')
            .attr({
                id: tabId,
                role: 'tabpanel',
                'aria-labelledby': tabId + '-tab',
                area: area,
                canale: canale
            })
            .append(templateArch);

        htmlItem.find('#tabContent').append(newPane);




        $('#modalAddDescrReg').modal('hide');
    }

    eliminaDescrRegionale(sender, area, canale) {
        console.log(area);
        console.log(canale);

        console.log("salvo");
        area = area == "" ? null : area;
        canale = canale == "" ? null : canale;

        let objReg = {
            canale: canale,
            area: area,
            custom: null
        }

        let recItem = sender.closest(".record-revisione");
        let is_gruppo = recItem.attr("is_gruppo");

        if (is_gruppo == "false") {


            let codice = recItem.attr("referenzaCodice");

            let obj = {
                Codice: codice,
                revRegionale: objReg,
            }
            showLoading();
            this.eliminaFunction(obj, null, recItem);

            hideLoading();

        }
        else {
            let codGruppo = recItem.attr("codice_gruppo");
            let obj = {
                CodiceGruppo: codGruppo,
                revRegionale: objReg,
            }

            showLoading();
            this.eliminaFunction(obj, null, recItem);

            hideLoading();
        }
    }

    eliminaFunction(obj, callback, senderButton) {
        console.log(obj);
        console.log(senderButton);
        var esito = confirm("Eliminare la revisione regionale di: " + obj.revRegionale.canale + obj.revRegionale.area);
        if (esito) {
            let ME = this;
            let IdTracciato = parseInt($("#CmbTracciato").val());
            showLoading();
            Call.do("Revisore", "elimina/" + IdTracciato + "/0/0", "PUT", { coda: [obj] }, ME, function (result, sender) {
                console.log(result);
                //creo il messaggio
                if (!result.esito) {
                    console.log(result.error);
                    alert("Errore durante l'eliminazione: " + result.error);
                    return;
                }


                //Cerco il record nella lista master

                var el = null;
                if (obj.CodiceGruppo != null) {
                    el = ME.List.find(f => f.recordInTracciato[keyScattoCodiceGruppo] == obj.CodiceGruppo && f.isGruppo);
                }
                else {
                    el = ME.List.find(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == obj.Codice);
                }

                const index = el.recordRevisionatiRegionali.findIndex(f =>
                    f.canale === obj.revRegionale.canale && f.area === obj.revRegionale.area
                );

                if (index !== -1) {
                    el.recordRevisionatiRegionali.splice(index, 1);
                }

                if (el == null) {
                    alert("Errore, elemento non trovano nel tracciato locale")
                }



                if (callback != null && result.error == null) {
                    console.warn("Callback");
                    callback(result, senderButton);
                }
                else {
                    sender.preparaListaDaCaricare(sender.currentPage - 1);
                }

            });
        }
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
                    ? `<button class="btn btn-outline-primary btn-sm btn-formdata" data-formdata='${o.formData}'>Form Data</button>`
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

        // Delega eventi: click sul bottone Form Data
        $('#operazioniModalBody')
            .off('click', '.btn-formdata')
            .on('click', '.btn-formdata', function () {
                const raw = $(this).attr('data-formdata');
                revInstance.mostraFormData(raw);
            });

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
      <textarea type="text" class="form-control" value="${val || ''}" readonly>` + val +`</textarea>
    </div>
  `).join('');

        $('#formDataModalBody').html(html || '<p class="text-muted">FormData vuoto.</p>');
        $('#formDataModal').modal('show');
    }

    salvaCampoInDatoTracciatoFromSender(key, value, sender) {

        let recItem = sender.closest(".record-revisione")
        let is_gruppo = recItem.attr("is_gruppo");
        if (is_gruppo == "false") {
            let codice = recItem.attr("referenzaCodice");
            this.salvaCampoInDatoTracciato(key, value, codice);
        }
        else {
            let codGruppo = recItem.attr("codice_gruppo");
            this.salvaCampoInDatoTracciato(key, value, codGruppo);
        }
    }

    salvaCampoInDatoTracciato(key, value, codice) {
        var valori = [codice, key, value]
        let IdTracciato = parseInt($("#CmbTracciato").val());

        if (IdTracciato != 0) {
            if (!confirm("Le modifiche saranno applicate a tutti i tracciati procedere lo stesso?")) {
                return;
            }
        }
        showLoading();

        let idPromo = parseInt($("#Promo").val());
        let isGruppo = codice.includes(",");
        Call.do("Revisore", "salvaCampoInDatoTracciato/" + IdTracciato + "/" + idPromo, "PUT", { stringhe : valori }, this, function (result, sender) {
            console.log(result);
            var records = sender.List.filter(f => !f.isGruppo && (isGruppo ? f.recordInTracciato[keyScattoCodiceGruppo] == codice : f.recordInTracciato[keyRefCodice] == codice));

            records.forEach(item => {
                item.recordInTracciato[key] = value;
            });
            hideLoading();
        });
    }


    cambiaVisualizzazioneDatoPerMismatch($btn) {
        let me = this;
        const $switch = $btn.closest('.origini-switch');
        const $orig = $switch.find('.origine');
        let box = $btn.closest(".container");
        // Leggo la lista dalle data (impostata con .data('aree', [...]))
        const aree = $orig.data('aree') || [];
        if (!Array.isArray(aree) || aree.length === 0) {
            // Niente da ciclare
            return;
        }

        // Valore selezionato attuale: prima provo l'attributo "Selezionato", altrimenti il testo dell'elemento
        let selected = $orig.attr('Selezionato');
        if (selected == null || selected === '') {
            selected = ($orig.text() || '').trim();
        }

        // Normalizzo per confronto (trim)
        const norm = v => (v == null ? '' : String(v).trim());
        const selectedNorm = norm(selected);

        // Trova l'indice dell'elemento corrente nella lista
        let idx = aree.findIndex(v => norm(v) === selectedNorm);

        // Direzione: destra = +1, sinistra = -1
        const dir = $btn.hasClass('right') ? 1 : -1;

        // Se non trovato, parti prima/dopo in modo da scattare al primo/ultimo al click
        if (idx === -1) idx = (dir === 1) ? -1 : 0;

        // Avanza/indietreggia con wrapping
        idx = (idx + dir + aree.length) % aree.length;

        const next = aree[idx];

        me.setModificaMismatchArea(next, $orig)

        this.applicaModificheDiAreaPerChiaviMismatch(next, box);

        if (box.attr("is_gruppo") == "true") {
            //è un gruppo quindi dobbiamo sincronizzare tutti i suoi singoli
            var gruppo = box.closest(".padreGruppo");
            var singoli = gruppo.find('.container[is_gruppo="false"]');
            singoli.each(function () {
                var origin = $(this).find('.origine')
                me.setModificaMismatchArea(next, origin);
                me.applicaModificheDiAreaPerChiaviMismatch(next, $(this), origin);
            });
        }
    }

    setModificaMismatchArea(valueToSet, origin) {
        origin.attr('Selezionato', valueToSet);
        if (this.agenzia.applicaSchemaDiOrdinamentoTracciati != null) {
            var valoriOrdinati = this.agenzia.applicaSchemaDiOrdinamentoTracciati(valueToSet, "");
            valueToSet = valoriOrdinati.join(",");
        }
        // Aggiorna UI e attributo
        origin.text(valueToSet);
    }

    applicaModificheDiAreaPerChiaviMismatch(area, box, origin) {
        const valAttr = `${area.join("_")}-val`;
        const styleAttr = `${area.join("_")}-style`;
        console.log(box.find('[mismatch]'))
        console.log(box);
        box.find('[mismatch]').each(function () {
            console.log("entrato");
            const $el = $(this);
            const mismatch = String($el.attr('mismatch') || '').toLowerCase();

            const doVal = mismatch.includes('val');
            const doStyle = mismatch.includes('style');

            // 1) VALORE
            if (doVal) {
                const newVal = $el.attr(valAttr);
                if (newVal != null) {
                    if ($el.is('input, textarea, select')) {
                        $el.val(newVal);
                    } else {
                        // Per elementi non form-control
                        $el.text(newVal);
                    }
                }
                else if (origin != null) {
                    origin.text("Area non trovata");
                    origin.attr('Selezionato', "");
                }
            }

            // 2) STYLE (lista "key,value,key,value,...")
            if (doStyle) {
                const styleRaw = $el.attr(styleAttr);
                if (styleRaw != null) {
                    const parts = styleRaw.split(','); // gestisce anche valori vuoti
                    for (let i = 0; i < parts.length; i += 2) {
                        const key = (parts[i] || '').trim();
                        // parts[i+1] può mancare o essere vuoto
                        const value = (i + 1 < parts.length) ? parts[i + 1].trim() : '';

                        if (!key) continue; // salta voci senza chiave

                        if (value === '') {
                            // Azzera la proprietà inline (equivale a rimuoverla)
                            $el.css(key, '');
                        } else {
                            $el.css(key, value);
                        }
                    }
                }
                else if (origin != null) {
                    origin.text("Area non trovata");
                    origin.attr('Selezionato', "");
                }
            }
        });
    }





    // --- util ---
    toSet = (arr) => new Set(arr || []);
    unionSets = (sets) => {
        const out = new Set();
        for (const s of sets) for (const x of s) out.add(x);
        return out;
    };
    diffSets = (a, b) => {
        const out = new Set();
        for (const x of a) if (!b.has(x)) out.add(x);
        return out;
    };
    intersectSets = (a, b) => {
        const out = new Set();
        const [small, large] = a.size < b.size ? [a, b] : [b, a];
        for (const x of small) if (large.has(x)) out.add(x);
        return out;
    };
    isSubset = (sub, sup) => {
        for (const x of sub) if (!sup.has(x)) return false;
        return true;
    };


    computeMinimalOriginGroups(meta) {
        // insieme universale di tutte le origini viste
        if (meta == null) {
            return;
        }
        const allOrigins = this.unionSets(
            meta.flatMap(m => m.values.map(v => this.toSet(v.origins)))
        );
        if (allOrigins.size === 0) return [];

        // partiamo dall’unico gruppo: tutto l’universo
        let groups = [new Set(allOrigins)];

        for (const { values } of meta) {
            const parts = values.map(v => this.toSet(v.origins));
            const covered = this.unionSets(parts);
            const outside = this.diffSets(allOrigins, covered); // origini non coperte da questa chiave (se ce ne sono)

            const next = [];
            for (const g of groups) {
                // intersezioni con tutte le parti della chiave
                for (const p of parts) {
                    const inter = this.intersectSets(g, p);
                    if (inter.size > 0) next.push(inter);
                }
                // salva anche l'eventuale parte del gruppo che non è coperta da questa chiave
                const leftover = this.intersectSets(g, outside);
                if (leftover.size > 0) next.push(leftover);
            }
            groups = next;
        }

        // deduplica (può capitare in certe configurazioni) e ordina internamente
        const seen = new Set();
        const unique = [];
        for (const g of groups) {
            const arr = Array.from(g).sort();
            const key = arr.join("|");
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(new Set(arr));
            }
        }
        return unique;
    }

    splitMetaByOriginGroups(meta, groups) {
        return meta.map(({ key, values }) => {
            const newValues = [];

            for (const { value, origins } of values) {
                const originSet = this.toSet(origins);

                for (const g of groups) {
                    // se il gruppo g è interamente contenuto in origins, allora produciamo una voce
                    if (this.isSubset(g, originSet)) {
                        newValues.push({
                            value,
                            origins: Array.from(g).sort()
                        });
                    }
                }
            }

            return { key, values: newValues };
        });
    }


    normalizeMetaByOriginGroups(meta) {
        if (meta == null)
            return;
        const groups = this.computeMinimalOriginGroups(meta);
        return this.splitMetaByOriginGroups(meta, groups);
    }

    getInfoDatoRefSingola(codice, chiave) {
        var singoli = revInstance.List.filter(f => !f.isGruppo && f.recordInTracciato[keyRefCodice] == codice);
        if (singoli == null || singoli.length == 0) {
            console.error("Nessun elemento trovato con il codice richiesto");
            return "error";
        }
        var chiave = singoli.map(f => f.recordInTracciato[chiave]);
        const tuttiUguali = chiave.every(val => val === chiave[0]);
        if (tuttiUguali) {
            return chiave[0];
        }
        else {
            return "Dati misti";
        }
    }

}

//I20-982: in Node si esporta per i test (tests/istanta-web). Nella pagina module non esiste
//e questa riga non fa nulla.
if (typeof module !== "undefined" && module.exports) {
    module.exports = Revisore;
}
