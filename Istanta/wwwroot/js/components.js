function renderRecordRevisione(templateName, obj, agenzia, List, olimpoIp, mostraDescrizioneIndd = false, areaTracciato, group = null, modalitaSottogruppi = false, mostraFirma = false)
{
    let htmlItem = {};

    //console.log("render");
    //console.log(obj);
    //console.log("olimpoIp");
    //console.log(olimpoIp);

    if (obj instanceof Array) {
        console.log("Si tratta di un gruppo");
        if (obj.length > 0) {
            let codGruppo = obj[0].recordInTracciato[keyScattoCodiceGruppo];
            htmlItem = $("<ul class=\"list-group border border-primary border-4 mb-4\" codice_gruppo=\"" + codGruppo + "\"></ul>");
            for (let i = 0; i < obj.length; i++) {
                let item = obj[i];
                if (!item.isGruppo) {
                    let _item = $("<li class=\"list-group-item list-group-item-light\" aria-current=\"true\"></li>").append(renderRecordRevisione(templateName, item, agenzia, List, olimpoIp, mostraDescrizioneIndd, areaTracciato, obj, modalitaSottogruppi, mostraFirma));                    
                    htmlItem.append(_item);//"<li class=\"list-group-item list-group-item-light\" aria-current=\"true\">" + renderRecordRevisione(templateName, item, agenzia).html() + "</li>");
                }
                else {
                    let _item = $("<li class=\"list-group-item list-group-item-success\" aria-current=\"true\"></li>").append(renderRecordRevisione(templateName, item, agenzia, List, olimpoIp, mostraDescrizioneIndd, areaTracciato, obj, modalitaSottogruppi, mostraFirma));
                    htmlItem.prepend(_item);
                }
            }
        }
    }
    else
    {
        let primario = obj;
        if (obj.recordInTracciato != null) {
            let template = $("#" + templateName).clone();
            htmlItem = $(template.html());

            let inTrac = obj.recordInTracciato;
            let descr1Trac = inTrac[keyDescr1];
            let descr2Trac = inTrac[keyDescr2];
            let descr3Trac = inTrac[keyDescr3];
            let descr4Trac = inTrac[keyDescr4];
            let descrPeso = inTrac[keyDescrPeso];
            let descrUm = inTrac[keyDescrUm];
            let revisionato = obj.recordRevisionato;
            let revisionatoRegionale = obj.recordRevisionatiRegionali;
            let codGruppo = inTrac[(modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo)];
            let ref_cod = "";

            //normalizziamo le metaKeyInMismatch secondo le logiche di agenzia

            if (agenzia != null && agenzia.normalizzaKeyInMismatch != null && inTrac.metaKeyInMismatch != null) {
                agenzia.normalizzaKeyInMismatch(inTrac.metaKeyInMismatch);
            }

            const origine = htmlItem.find(".origine");   // jQuery object (potrebbero essere più nodi)
            var agenziaVuoleMismatch = agenzia.regoleDiVisualizzazioneCampiInMismatch != null ? agenzia.regoleDiVisualizzazioneCampiInMismatch(inTrac) : true;
            if (inTrac.metaKeyInMismatch != null && inTrac.metaKeyInMismatch.length > 0 && agenziaVuoleMismatch) {
                var dataAree = inTrac.metaKeyInMismatch[0].values.map(f => f.origins)
                dataAree.forEach(function (item) {
                    if (agenzia.applicaSchemaDiOrdinamentoTracciati != null) {
                        item = agenzia.applicaSchemaDiOrdinamentoTracciati(item, "");
                    }
                });
                var dataAreeTextOrdinato = dataAree[0].join(",");
                //if (agenzia.applicaSchemaDiOrdinamentoTracciati != null) {
                //    var valoriOrdinati = agenzia.applicaSchemaDiOrdinamentoTracciati(dataAree[0], "");
                //    dataAreeTextOrdinato = valoriOrdinati.join(",");
                //}
                origine.attr("Selezionato", dataAree[0] ?? "ERR");
                origine.text(dataAreeTextOrdinato ?? "ERR");
                // SALVATAGGIO CORRETTO con jQuery
                origine.data("aree", dataAree);

                origine.css("background-color", "orange");
            }
            else {
                let _colOr = origine.closest(".col");//.hide();
                _colOr.css("display", "none");
            }

            if (obj.isGruppo) {
                let elementoGruppo = List.find(f => !f.isGruppo && f.recordInTracciato[modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo] == inTrac[modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo]);
                primario = List.find(f => !f.isGruppo && f.recordInTracciato[modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo] == inTrac[modalitaSottogruppi ? keyScattoCodiceSottogruppo : keyScattoCodiceGruppo] && f.recordInTracciato["StatoSelezione"] == 1);

                if (primario == null) {
                    console.log("Non trovato il primario nel gruppo");
                }

                if (elementoGruppo == null && !modalitaSottogruppi) {
                    console.error("Nessun elemento trovato in lista facente parte del gruppo: " + codGruppo);
                    return;
                }
                else if (elementoGruppo != null){
                    descr1Trac = elementoGruppo.recordInTracciato[keyDescr1GruppoTracciato];
                    descr2Trac = elementoGruppo.recordInTracciato[keyDescr2GruppoTracciato];
                    descr3Trac = elementoGruppo.recordInTracciato[keyDescr3GruppoTracciato];
                    descr4Trac = elementoGruppo.recordInTracciato[keyDescr4GruppoTracciato];
                    descrPeso = elementoGruppo.recordInTracciato[keyDescrPesoGruppoTracciato];
                    descrUm = elementoGruppo.recordInTracciato[keyDescrUmGruppoTracciato];
                }


                if (obj.recordRevisionato == null) {
                    htmlItem.find("#riga_revisione").addClass("bg-danger");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                    htmlItem.find("#revisionato_flag").text("Da revisionare, nuovo elemento");
                }
                else if (obj.recordInTracciato["FirmaGarantita"] != null && obj.recordInTracciato["FirmaGarantita"] != "") {
                    htmlItem.find("#riga_revisione").addClass("bg-success");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                    htmlItem.find("#revisionato_flag").text("Revisionato con garante: " + obj.recordInTracciato["FirmaGarantita"]);
                }
                //else if (obj.recordRevisionato.firmaTracciato == null) {
                //    htmlItem.find("#riga_revisione").addClass("bg-danger");
                //    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                //    htmlItem.find("#revisionato_flag").text("Da revisionare, incongruenza firma");
                //}
                else if (obj.recordRevisionato.firmaTracciato == obj.recordInTracciato[keyTracciatoFirma]) {
                    htmlItem.find("#riga_revisione").addClass("bg-success");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                    htmlItem.find("#revisionato_flag").text("Revisionato");
                }
                //else if (obj.recordRevisionato.firmaTracciato == "MismatchFirma") {
                //    htmlItem.find("#revisionato_flag").text("Mismatch firme");
                //    htmlItem.find("#riga_revisione").addClass("bg-warning");
                //    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                //}
                else if (obj.recordRevisionato.firmaTracciato == "Da archivio") {
                    htmlItem.find("#revisionato_flag").text("Revisionato da archivio");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else if (obj.recordRevisionato.firmaTracciato == "suggerimento") {
                    htmlItem.find("#revisionato_flag").text("Suggerito");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else {
                    htmlItem.find("#revisionato_flag").text("Da confermare");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }


                htmlItem.find("#a_scheda_articolo").attr("href", "#");

                htmlItem.find("#img_principale").remove();
                htmlItem.find("#spazioSelezione").css("display", "none");
                //console.log("Spzaio selezione");
                //console.log(htmlItem.find("#spazioSelezione"));


                if (revInstance.gruppiVisualizzati == false) {
                    htmlItem.hide();
                }


                htmlItem.find("#CodPrimario").val(elementoGruppo.recordInTracciato.PrimarioGruppo);
                htmlItem.find("#CodSecondari").val(elementoGruppo.recordInTracciato.SecondariGruppo);

                //rowMismatchStatoSelezione
                if (primario) {
                    var keyMisatchStatoSelezione = primario.recordInTracciato.metaKeyInMismatch.find(f => f.key == "PrimarioGruppo");

                    if (keyMisatchStatoSelezione) {
                        var itemToModify = htmlItem.find("#CodPrimario");
                        addMismatchKeyVisual(keyMisatchStatoSelezione, itemToModify, null, false);
                    }

                    var keyMisatchStatoSelezioneSecondari = primario.recordInTracciato.metaKeyInMismatch.find(f => f.key == "SecondariGruppo");

                    if (keyMisatchStatoSelezioneSecondari) {
                        var itemToModify = htmlItem.find("#CodSecondari");
                        addMismatchKeyVisual(keyMisatchStatoSelezioneSecondari, itemToModify, null, false);
                    }

                    if (keyMisatchStatoSelezione || keyMisatchStatoSelezioneSecondari) {
                        var row = htmlItem.find("#rowMismatchStatoSelezione");
                        row.show();
                    }
                }

            }
            else {
                if (!modalitaSottogruppi) {
                    if (obj.recordInTracciato["StatoSelezione"] != null && obj.recordInTracciato["StatoSelezione"] == 1) {
                        htmlItem.find(".colImg").css("background-color", "lightblue");
                        htmlItem.find(".colImg").attr("selezione", 1);
                    }
                    else if (obj.recordInTracciato["StatoSelezione"] != null && obj.recordInTracciato["StatoSelezione"] == 2) {
                        htmlItem.find(".colImg").css("background-color", "lightyellow");
                        htmlItem.find(".colImg").attr("selezione", 2);
                    }

                    if (inTrac.metaKeyInMismatch) {

                        var keyMisatchStatoSelezione = inTrac.metaKeyInMismatch.find(f => f.key == "StatoSelezione");

                        if (keyMisatchStatoSelezione) {
                            var itemToModify = htmlItem.find(".colImg");
                            addMismatchKeyVisual(keyMisatchStatoSelezione, itemToModify, null, true, function (mismatchKey, itemToModify) {

                                itemToModify.attr("mismatch", "style");
                                for (var i = 0; i < mismatchKey.values.length; i++) {
                                    let elArea = mismatchKey.values[i];

                                    let style = ["background-color", ""];
                                    if (elArea) {
                                        let valore = elArea.value;
                                        if (valore == 1) {
                                            style = ["background-color", "lightblue"];
                                        }
                                        else if (valore == 2) {
                                            style = ["background-color", "lightyellow"];
                                        }
                                        else {
                                            style = ["background-color", ""];
                                        }
                                    }

                                    itemToModify.attr(elArea.origins.join("_") + "-style", style);
                                }
                            });
                        }

                    }
                }


                /*
                let areeText = "";
                obj.recordInTracciato.areeIn.forEach(function (item) {
                    areeText += item + ", ";
                });
                areeText = areeText.slice(0, -2);
                htmlItem.find(".inVolList").text("In vol: " + areeText);
                areeText = "";
                obj.recordInTracciato.areeOut.forEach(function (item) {
                    areeText += item + ", ";
                });
                areeText = areeText.slice(0, -2);
                htmlItem.find(".FuoriVolList").text("Fuori vol: " + areeText);
                */
                ref_cod = inTrac[keyRefCodice];//.Referenza.Codice;
            }
            //if (/*inTrac.Referenza != null*/ inTrac["Referenza.Codice"] == inTrac["Scatto.CodiceGruppo"]) {
            
            htmlItem.attr("referenzaCodice", ref_cod);
            htmlItem.attr("id_rec", obj.idRec);

            if (obj.scaduto) {
                htmlItem.css("opacity", 0.4);
                htmlItem.css("pointer-events", "none");
            }

            if (ref_cod != "") {

                if (obj.recordInTracciato["Foto.guidid"] != null && obj.recordInTracciato["Foto.guidid"] != "") {
                    if (obj.recordInTracciato["Foto.guidid"] != null && obj.recordInTracciato["Foto.guidid"] != "") {
                        const guidId = obj.recordInTracciato["Foto.guidid"];

                        const thumbUrl = olimpoIp + "/foto/getThumbNailOnDemand?width=40&guidId=" + guidId;
                        const bigUrl = olimpoIp + "/foto/getThumbNailOnDemand?width=600&guidId=" + guidId;

                        const img = htmlItem.find("#img_principale");

                        img.attr("src", thumbUrl);
                        img.css("width", "50px");

                        img.off("mouseenter.preview mouseleave.preview");

                        img.on("mouseenter.preview", function () {
                            $("#image-hover-preview img").attr("src", bigUrl);
                            $("#image-hover-preview").css("display", "flex");
                        });

                        img.on("mouseleave.preview", function () {
                            $("#image-hover-preview").hide();
                            $("#image-hover-preview img").attr("src", "");
                        });
                    }
                }
                else {
                    let uri = getWebAppRootFolder();
                    if (uri != "")
                        uri = "/" + uri;
                    htmlItem.find("#img_principale").attr("src", uri + "images/NoFoto.png");
                    htmlItem.find("#img_principale").css("height", "50px");
                }
                //htmlItem.find("#a_scheda_articolo").attr("href", "SchedaArticolo?id=" + ref_id);
                htmlItem.find("#a_scheda_articolo").attr("href", "SchedaArticolo?codice=" + ref_cod);
                htmlItem.find("#a_scheda_articolo").html("<b>" + ref_cod + "</b>");
                htmlItem.find("#xls_file").html(obj.recordInTracciato[keyTracciatoXlsx]);

                htmlItem.find("#lista_foto_secondarie").css("display", "none");
            }
            else {
                htmlItem.find("#a_scheda_articolo").html("<b>" + (codGruppo.length > 50 ? codGruppo.slice(0, 50) + "..." : codGruppo) + "</b>");
                htmlItem.find("#xls_file").html(obj.recordInTracciato[keyTracciatoXlsx]);
            }

            //}
            //else {
            //    htmlItem.find("#a_scheda_articolo").html("<b>" + (codGruppo.length > 20 ? codGruppo.slice(0, 20) + "..." : codGruppo) + "</b>");
            //}

            if (descr1Trac != null || descr2Trac != null || descr3Trac != null || descr4Trac != null) {

                htmlItem.find("#Descrizione1Tracciato").val(descr1Trac);
                htmlItem.find("#Descrizione2Tracciato").val(descr2Trac);
                htmlItem.find("#Descrizione3Tracciato").val(descr3Trac);
                htmlItem.find("#Descrizione4Tracciato").val(descr4Trac);
                if (descrPeso != null) {
                    htmlItem.find("#PesoTracciato").val(rappresenteDecimaleInCulturaItaliana(descrPeso));
                }
                if (descrUm != null) {
                    htmlItem.find("#UmTracciato").val(descrUm);
                }
            }
            if (mostraFirma)
            {
                if (revisionato != null && revisionato.firmaTracciato != null) {
                    htmlItem.find("#RevFirma").val(revisionato.firmaTracciato);
                }
                if (!obj.isGruppo) {
                    htmlItem.find("#rowRevFirma").css("display", "flex");
                }
            }
            if (agenzia != null && agenzia.SetPrezzi != null && areaTracciato != null) {
                agenzia.SetPrezzi(htmlItem, inTrac, areaTracciato, group);
            }
            if (agenzia != null && agenzia.modificaColPesoTracciato != null) {
                agenzia.modificaColPesoTracciato(htmlItem.find("#PesoTracciato").closest(".col"), htmlItem.find("#PesoTracciato").val(), inTrac, group);
            }

            htmlItem.attr("codice_gruppo", codGruppo);
            htmlItem.attr("is_gruppo", obj.isGruppo);

            if (!obj.isGruppo) {
                htmlItem.find("#firma_tracciato").val(inTrac[keyTracciatoFirma]);

                if (obj.recordRevisionato == null ) {
                    htmlItem.find("#revisionato_flag").text("Da revisionare, nuovo elemento");
                    htmlItem.find("#riga_revisione").addClass("bg-danger");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else if (obj.recordInTracciato["FirmaGarantita"] != null && obj.recordInTracciato["FirmaGarantita"] != "") {
                    htmlItem.find("#riga_revisione").addClass("bg-success");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                    htmlItem.find("#revisionato_flag").text("Revisionato con garante: " + obj.recordInTracciato["FirmaGarantita"]);
                }
                //else if (obj.recordRevisionato.firmaTracciato == "MismatchFirma") {
                //    htmlItem.find("#revisionato_flag").text("Mismatch firme");
                //    htmlItem.find("#riga_revisione").addClass("bg-warning");
                //    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                //}
                else if (obj.recordRevisionato.firmaTracciato == "Da archivio") {
                    htmlItem.find("#revisionato_flag").text("Revisionato da archivio");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else if (obj.recordRevisionato.firmaTracciato == "suggerimento") {
                    htmlItem.find("#revisionato_flag").text("Suggerito");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else if (obj.recordRevisionato != null && obj.recordInTracciato[keyTracciatoFirma] != obj.recordRevisionato.firmaTracciato) {
                    htmlItem.find("#revisionato_flag").text("Da confermare");
                    htmlItem.find("#riga_revisione").addClass("bg-warning");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }
                else {
                    htmlItem.find("#revisionato_flag").text("Revisionato");
                    htmlItem.find("#riga_revisione").addClass("bg-success");
                    htmlItem.find("#riga_revisione").addClass("bg-opacity-25");
                }

            }

            htmlItem.find("#bottoneSalva").attr("canale","");
            htmlItem.find("#bottoneSalva").attr("area","");

            if (revisionato != null) {
                //Check firma per vedere se coincide con questo tracciato
                //e per stabilire se mostrare alert di revisione o meno
                //console.log(revisionato.firmaTracciato + " == " + inTrac["Tracciato.Firma"]);
                if (inTrac[keyTracciatoFirma] != null && revisionato.firmaTracciato != inTrac[keyTracciatoFirma]) {
                    //Da revisionare
                    htmlItem.attr("stato_revisione", "2");
                }
                else {
                    //Già revisionato
                    htmlItem.attr("stato_revisione", "1");
                }

                console.warn("revisionato!!")
                console.log(revisionato);
                console.log(htmlItem.find("#Descrizione1"));

                htmlItem.find("#Descrizione1").val(revisionato.descrizione1);
                htmlItem.find("#Descrizione4").val(revisionato.descrizione4);
                htmlItem.find("#Descrizione3").val(revisionato.descrizione3);
                htmlItem.find("#Descrizione2").val(revisionato.descrizione2);
                htmlItem.find("#Peso").val(rappresenteDecimaleInCulturaItaliana(revisionato.peso));
                htmlItem.find("#Um").val(revisionato.um);

                if (agenzia.aggiungiCampiExtra != null) {
                    agenzia.aggiungiCampiExtra(htmlItem, revisionato.extra, obj.isGruppo);
                }

                if (mostraDescrizioneIndd) {
                    htmlItem.find("#DescrizioneIndd").val(revisionato.descrizioneIndd);
                    htmlItem.find(".indd").css("display", "block");
                }

                console.log("----> " + htmlItem.find("#Descrizione2").val());

                htmlItem.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(revisionato.dataUltimaRicezione)));
            }
            else {
                //console.warn("Revisione non trovata");
                //console.log(revisionato);
                //Mai stato revisionato
                htmlItem.attr("stato_revisione", "0");
                htmlItem.find("#lab_data_ultima_revisione").text("Ultima revisione: Mai revisionato");
            }

            var tabNazId = "tab-Naz" + (obj.isGruppo ? obj.recordInTracciato[keyScattoCodiceGruppo] : obj.recordInTracciato[keyRefCodice]);
            tabNazId = tabNazId.replace(/,/g, "_");
            htmlItem.find("#tab-Naz-tab").attr("data-bs-target", "#" + tabNazId);
            htmlItem.find("#tab-Naz-tab").attr("id", tabNazId + "-tab");
            htmlItem.find("#tab-Naz").attr("id", tabNazId);


            if (revisionatoRegionale != null && revisionatoRegionale.length > 0) {
                for (var i = 0; i < revisionatoRegionale.length; i++) {
                    var revRegionale = revisionatoRegionale[i];
                    var nome = (revRegionale.canale != null ? revRegionale.canale : "") + (revRegionale.area != null ? revRegionale.area : "");

                    // Crea ID unico per la tab
                    var tabId = "tab-" + nome + (revRegionale.codiceGruppo != null ? revRegionale.CodiceGruppo : revRegionale.idArticoloNavigation.codice);

                    // 1. Crea nuovo tab header
                    //var newTab = $('<li class="nav-item" role="presentation">')
                    //    .append($('<button>')
                    //        .addClass('nav-link')
                    //        .attr({
                    //            id: tabId + '-tab',
                    //            'data-bs-toggle': 'tab',
                    //            'data-bs-target': '#' + tabId,
                    //            type: 'button',
                    //            role: 'tab',
                    //            'aria-controls': tabId,
                    //            'aria-selected': 'false',
                    //            area: (revRegionale.area != null ? revRegionale.area : ""),
                    //            canale: (revRegionale.canale != null ? revRegionale.canale : ""),
                    //        })
                    //        .text(nome)
                    //);
                    let area = revRegionale.area || "";
                    let canale = revRegionale.canale || "";
                    var $button = $('<button>')
                        .addClass('nav-link d-flex justify-content-between align-items-center')
                        .css({ position: 'relative' })
                        .attr({
                            id: tabId + '-tab',
                            'data-bs-toggle': 'tab',
                            'data-bs-target': '#' + tabId,
                            type: 'button',
                            role: 'tab',
                            'aria-controls': tabId,
                            'aria-selected': 'false',
                            area: (revRegionale.area != null ? revRegionale.area : ""),
                            canale: (revRegionale.canale != null ? revRegionale.canale : "")
                        })
                        .append(
                            $('<span>').text(nome),
                            $('<span>')
                                .addClass('ms-2 text-danger')
                                .css({
                                    cursor: 'pointer',
                                    'font-weight': 'bold'
                                })
                                .html('&times;') // simbolo "×"
                                .on('click', function (e) {
                                    e.stopPropagation(); // Non attiva la tab
                                    revInstance.eliminaDescrRegionale($(this), area, canale);
                                })
                    );
                    var newTab = $('<li class="nav-item" role="presentation">').append($button);
                    htmlItem.find('#tabHeader').append(newTab);

                    // 2. Clona il contenuto del template
                    let temp = $("#contenutoDescrizioneArchivio").clone();
                    templateArch = $(temp.html());

                    //if (inTrac[keyTracciatoFirma] != null && revRegionale.firmaTracciato != inTrac[keyTracciatoFirma]) {
                    //    //Da revisionare
                    //    htmlItem.attr("stato_revisione", "2");
                    //}
                    //else {
                    //    //Già revisionato
                    //    htmlItem.attr("stato_revisione", "1");
                    //}

                    templateArch.find("#Descrizione1").val(revRegionale.descrizione1);
                    templateArch.find("#Descrizione4").val(revRegionale.descrizione4);
                    templateArch.find("#Descrizione3").val(revRegionale.descrizione3);
                    templateArch.find("#Descrizione2").val(revRegionale.descrizione2);
                    templateArch.find("#Peso").val(rappresenteDecimaleInCulturaItaliana(revRegionale.peso));
                    templateArch.find("#Um").val(revRegionale.um);
                    if (agenzia.aggiungiCampiExtra != null) {
                        agenzia.aggiungiCampiExtra(templateArch, revRegionale.extra, obj.isGruppo);
                    }

                    if (mostraDescrizioneIndd) {
                        templateArch.find("#DescrizioneIndd").val(revRegionale.descrizioneIndd);
                        templateArch.find(".indd").css("display", "block");
                    }

                    templateArch.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(revRegionale.dataUltimaRicezione)));



                    
                    //else if (revRegionale.firmaTracciato == null) {
                    //    templateArch.find("#revisionato_flag").text("Da revisionare, incongruenza firma");
                    //    templateArch.find("#riga_revisione").addClass("bg-danger");
                    //    templateArch.find("#riga_revisione").addClass("bg-opacity-25");
                    //}
                    if (revRegionale.firmaTracciato == "MismatchFirma") {
                        templateArch.find("#revisionato_flag").text("Mismatch firme");
                        templateArch.find("#riga_revisione").addClass("bg-warning");
                        templateArch.find("#riga_revisione").addClass("bg-opacity-25");
                    }
                    else if (revRegionale.firmaTracciato == "Da archivio") {
                        templateArch.find("#revisionato_flag").text("Revisionato da archivio");
                        templateArch.find("#riga_revisione").addClass("bg-warning");
                        templateArch.find("#riga_revisione").addClass("bg-opacity-25");
                    }
                    else if (obj.recordInTracciato[keyTracciatoFirma] != revRegionale.firmaTracciato) {
                        templateArch.find("#revisionato_flag").text("Da confermare");
                        templateArch.find("#riga_revisione").addClass("bg-warning");
                        templateArch.find("#riga_revisione").addClass("bg-opacity-25");
                    }
                    else {
                        templateArch.find("#revisionato_flag").text("Revisionato");
                        templateArch.find("#riga_revisione").addClass("bg-success");
                        templateArch.find("#riga_revisione").addClass("bg-opacity-25");
                    }

                    templateArch.find("#bottoneSalva").attr("canale", (revRegionale.canale != null ? revRegionale.canale : ""));
                    templateArch.find("#bottoneSalva").attr("area", (revRegionale.area != null ? revRegionale.area : ""));


                    // 3. Crea tab pane e inserisci il clone
                    var newPane = $('<div>')
                        .addClass('tab-pane fade content')
                        .attr({
                            id: tabId,
                            role: 'tabpanel',
                            'aria-labelledby': tabId + '-tab',
                            area: (revRegionale.area != null ? revRegionale.area : ""),
                            canale: (revRegionale.canale != null ? revRegionale.canale : "")
                        })
                        .append(templateArch);

                    htmlItem.find('#tabContent').append(newPane);
                }
            }


            if (agenzia != null) {
                agenzia.setRecord_revisioneArticolo(htmlItem);
            }
        }
        else
        {
            //Arriva un oggetto
            //{codice:cod, descrizione:{ArticoliDescrizioni} }

            let template = $("#" + templateName).clone();
            htmlItem = $(template.html());

            htmlItem.attr("codice", obj.codice);

            if (obj.descrizione != null) {
                htmlItem.find("#Descrizione1").val(obj.descrizione.descrizione1);
                htmlItem.find("#Descrizione4").val(obj.descrizione.descrizione4);
                htmlItem.find("#Descrizione3").val(obj.descrizione.descrizione3);
                htmlItem.find("#Descrizione2").val(obj.descrizione.descrizione2);

                if (mostraDescrizioneIndd) {
                    htmlItem.find("#DescrizioneIndd").val(obj.descrizione.descrizioneIndd);
                    htmlItem.find(".indd").css("display", "block");
                }

                htmlItem.find("#Peso").val(rappresenteDecimaleInCulturaItaliana(obj.descrizione.peso));
                htmlItem.find("#Um").val(obj[keyDescrUm]);

                htmlItem.find("#lab_data_ultima_revisione").text("Ultima revisione: " + getStringFromDate(new Date(obj.descrizione.dataUltimaRicezione)));
                //htmlItem.find("#a_scheda_articolo").attr("href", "/SchedaArticolo?id=" + obj.descrizione.idArticolo);
                htmlItem.find("#a_scheda_articolo").attr("href", "/SchedaArticolo?codice=" + obj.codice);

            }
            else {
                htmlItem.find("#lab_data_ultima_revisione").text("Mai revisionato");
            }
            
            // Le miniature passano da olimpo: System.Drawing (usato da /Thumb) non funziona su Linux.
            // Se il record porta il guid della foto uso getThumbNailOnDemand, altrimenti resta il segnaposto.
            {
                const guidFoto = obj.recordInTracciato != null ? obj.recordInTracciato["Foto.guidid"] : null;
                const imgPrinc = htmlItem.find("#img_principale");
                if (guidFoto != null && guidFoto !== "") {
                    imgPrinc.attr("src", olimpoIp + "/foto/getThumbNailOnDemand?width=40&guidId=" + guidFoto);
                } else {
                    let _uriFallback = getWebAppRootFolder();
                    if (_uriFallback != "") _uriFallback = "/" + _uriFallback;   // stessa condizione della riga 283
                    imgPrinc.attr("src", _uriFallback + "images/NoFoto.png");
                }
            }
            htmlItem.find("#a_scheda_articolo").html("<b>" + obj.codice + "</b>");
            htmlItem.find("#xls_file").html(obj.recordInTracciato[keyTracciatoXlsx]);


        }
        if (agenzia.nascondiCampiIndesideratiRevisore!=null)
            agenzia.nascondiCampiIndesideratiRevisore(htmlItem, obj.isGruppo);
        if (agenzia.modificaCampiRevisore!=null)
            agenzia.modificaCampiRevisore(htmlItem, obj.isGruppo);
        if (agenzia.modificaDescrizioni != null) {
            agenzia.modificaDescrizioni(obj, primario, htmlItem);
        }

        //Add event listener
        if (templateName == "template") {
            htmlItem.find("#ch_approva_gruppo").on("change", function () {
                revInstance.TogglePulsanteApprova($(this).prop('checked'));
            });
            htmlItem.find("#ch_salva_gruppo").on("change", function () {
                revInstance.TogglePulsanteSalvaInGruppo($(this).prop('checked'))
            });
            htmlItem.find(".fas").on("click", function () {
                revInstance.copyCodice($(this));
            });
            htmlItem.find(".arrow").on("click", function () {
                revInstance.cambiaVisualizzazioneDatoPerMismatch($(this));
            });
            htmlItem.find("#alberoSottogruppi").on("click", function () {
                revInstance.ApriAlberoSottogruppoDaSender($(this));
            });
            htmlItem.find("#sottogruppoButton").on("click", function () {
                revInstance.ApriFinestraSottogruppoDaSender($(this));
            });
            htmlItem.find("#testoSottogruppo").on("click", function () {
                revInstance.visualizzaSottogruppoDaSender($(this));
            });
            htmlItem.find("#btnToggleDescr").on("click", function () {
                $(this).closest('.container').find('#dettaglioArchivioCustomContainer').slideToggle();
                $(this).find('i').toggleClass('bi-chevron-left bi-chevron-right');
                return false;
            });
            htmlItem.find("#btnCopiaValoreGruppo").on("click", function () {
                revInstance.copiaValoriNelGruppo($(this).closest('.container'));
            });
            htmlItem.find("#addTabButton").on("click", function () {
                revInstance.apriModalDescrizioneReg($(this).closest('.record-revisione'));
            });
            htmlItem.find("#vediUltimeModifiche").on("click", function () {
                revInstance.checkLastModificaFromButton($(this),
                    $(this).closest('.row').find('#bottoneSalva').attr('canale'),
                    $(this).closest('.row').find('#bottoneSalva').attr('area'));
            });
            htmlItem.find("#bottoneSalva").on("click", function () {
                revInstance.salvaRevisione($(this), $(this).attr('canale'), $(this).attr('area'));
            });
            htmlItem.find("#labBtnSalvaGruppo").on("click", function () {
                $(this).closest('.col').find('#ch_salva_gruppo').prop('checked',
                    !$(this).closest('.col').find('#ch_salva_gruppo').prop('checked'));
                revInstance.TogglePulsanteSalvaInGruppo($(this).closest('.col').find('#ch_salva_gruppo').prop('checked'));
            });

            htmlItem.find(".inputDescrArchivio").on("input", function () { 
                revInstance.controlChangeText($(this));
            });
        }
        else if (templateName == "templateDettaglio") {
            htmlItem.find(".fas").on("click", function () {
                revInstance.copyCodice($(this));
            });
            htmlItem.find(".arrow").on("click", function () {
                revInstance.cambiaVisualizzazioneDatoPerMismatch($(this));
            });
            htmlItem.find("#btnSalvaRevisione").on("click", function () {
                revInstance.salvaRevisione($(this), '', '', menaboInstance.onSalvataRevisione);
            });
            
        }
    }
    return htmlItem;
}

function renderGruppiModalitaSottogruppo(templateName, listaGruppiNonCorrispondentiAlCodiceSottogruppo) {
    console.log(listaGruppiNonCorrispondentiAlCodiceSottogruppo);
    let htmlItem = {};
    listaGruppiNonCorrispondentiAlCodiceSottogruppo.forEach(function (item) {
        let template = $("#" + templateName).clone();
        htmlItem = $(template.html());
        htmlItem.find(".record-revisione").attr("codice_gruppo", item.gruppoItem.recordInTracciato[keyScattoCodiceGruppo]);
        let codiceGruppo = item.gruppoItem.recordInTracciato[keyScattoCodiceGruppo];
        let limitedText = codiceGruppo.length > 50 ? codiceGruppo.substring(0, 50) + "..." : codiceGruppo;

        htmlItem.find(".fas").on("click", function () {
            revInstance.copyCodice($(this));
        });

        htmlItem.find("#a_scheda_articolo").html("<b>" + limitedText + "</b>");
        //htmlItem.find("#xls_file").html(htmlItem.recordInTracciato[keyTracciatoXlsx])

        let gruppoDaAppendere = true;
        item.listCodiciSottogruppi.forEach(function (codSottogruppo) {
            let pagItem = $(".padreGruppo[codice_gruppo='" + codSottogruppo + "']");
            if (gruppoDaAppendere) {
                gruppoDaAppendere = false;
                pagItem.before(htmlItem);
            }
            htmlItem.append(pagItem);
        });

        let allElements = item.gruppoItem.recordInTracciato[keyScattoCodiceGruppo].split(",").length;
        let elementsArrived = 0;
        item.listCodiciSottogruppi.forEach(function (cod) {
            elementsArrived += cod.split(",").length;
        });
        elementsArrived += item.listSingoli.length;
        if (elementsArrived == allElements) {
            let htmlItemSingolo = {};
            //let templateGrp = $("#singoloDelSottogruppo").clone();
            //htmlItemGrp = $(templateGrp.html());
            //htmlItemGrp.find("#a_scheda_articolo").html("<b>" + item.gruppoItem.recordInTracciato[keyScattoCodiceGruppo] + "</b>")
            //htmlItem.append(htmlItemGrp);
            item.listSingoli.forEach(function (singolo) {
                let template = $("#singoloDelSottogruppo").clone();
                htmlItemSingolo = $(template.html());
                htmlItemSingolo.find("#a_scheda_articolo").html("<b>" + singolo.recordInTracciato[keyRefCodice] + "</b>")
                htmlItemSingolo.find("#xls_file").html(singolo.recordInTracciato[keyTracciatoXlsx])

                htmlItemSingolo.find(".fas").on("click", function () {
                    revInstance.copyCodice($(this));
                });


                htmlItem.append(htmlItemSingolo);
            });
        }
    });
}

function addMismatchKeyVisual(keyInMismatch, itemToModify, style, ignoraValue, functionToApply) {
    if (keyInMismatch != null) {
       


        const label = itemToModify.parent().find(`label[for='` + itemToModify.attr("id") + `']`);

        if (label) {
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="orange" aria-label="avviso">
  <path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2V10z"></path>
</svg>
`;

            // aggiunge l’SVG *prima del contenuto testuale* senza rimuoverlo
            label.prepend(svg + ' ');
        }


        if (functionToApply != null) {
            functionToApply(keyInMismatch, itemToModify);
        }
        else {

            if (ignoraValue && style != null) {
                itemToModify.attr("mismatch", "style");
            }
            else if (!ignoraValue && style == null) {
                itemToModify.attr("mismatch", "val");
            }
            else if (!ignoraValue && style != null) {
                itemToModify.attr("mismatch", "val-style");
            }
            else {
                console.error("Value non richiesto e style non trovato per il keyInMismatch");
                return;
            }

            for (var i = 0; i < keyInMismatch.values.length; i++) {
                let elArea = keyInMismatch.values[i];


                if (style != null) {
                    itemToModify.attr(elArea.origins.join("_") + "-style", style);
                }

                if (elArea && !ignoraValue) {
                    let valore = elArea.value || "";
                    itemToModify.attr(elArea.origins.join("_") + "-val", valore);
                }
            }
        }
    }
}