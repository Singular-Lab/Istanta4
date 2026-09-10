class DeclinazioneMeccaniche {

    sourceDeclMeccaniche
    sourceCombMeccaniche
    sourceMeccanicheAvanzate
    sourceRimozioneMeccanicheAvanzate
    sourceEtichette
    sourceDaAggiornare = false;

    constructor() {
        let me = this;
        let rndVersion = Math.floor(Math.random() * 999999);
        $.getJSON('external_source' + exPathCustom + '/SourceEtichetteRef.json?v1.' + rndVersion, function (data) {
            me.sourceEtichette = data.source;
        });

        Call.do("DeclinazioniMeccaniche", "scaricaDeclinazioniMeccaniche", "GET", null, this, function (result, sender) {
            sender.sourceDeclMeccaniche = result.source;
            sender.sourceCombMeccaniche = result.combinazioniMeccaniche;
            sender.sourceMeccanicheAvanzate = result.meccanicheAvanzate;
            sender.sourceRimozioneMeccanicheAvanzate = result.meccanicheInRimozione;
        });
        
    }

    openModal(idMeccanica) {
        let me = this;
        console.log(idMeccanica);
        $("#modalModificaRegole").attr('idMeccanica', idMeccanica);

        if (this.sourceDaAggiornare) {
            Call.do("DeclinazioniMeccaniche", "scaricaDeclinazioniMeccaniche", "GET", null, this, function (result, sender) {
                sender.sourceDaAggiornare = false;
                sender.sourceDeclMeccaniche = result.source;
                sender.sourceCombMeccaniche = result.combinazioniMeccaniche;
                sender.sourceMeccanicheAvanzate = result.meccanicheAvanzate;
                sender.sourceRimozioneMeccanicheAvanzate = result.meccanicheInRimozione;

                let meccanicaCorrispondente = me.sourceDeclMeccaniche.find(f => f.id == idMeccanica);
                $("#regoleContainer").empty();
                if (meccanicaCorrispondente.regole != null) {
                    meccanicaCorrispondente.regole.forEach(function (setRegole) {
                        let setEtichetteItem = $($("#setEtichette").clone().html());
                        setRegole.forEach(function (regola) {
                            let etichetta = $($("#etichetta").clone().html());

                            me.appendiEtichette(etichetta.find("#etichettaVal"));
                            etichetta.find("#etichettaVal").val(regola.nomeEtichetta);
                            etichetta.find("#presente").attr("checked", regola.presente);
                            setEtichetteItem.append(etichetta);
                        });
                        let addEtichetta = $($("#addEtichetta").clone().html());
                        setEtichetteItem.append(addEtichetta);
                        $("#regoleContainer").append(setEtichetteItem);
                    });
                }
                else {
                    //this.aggiungiNuovoSetRegole($("#regoleContainer"));
                }

                $("#modalModificaRegole").modal('show');
            });
        } else {
            let meccanicaCorrispondente = this.sourceDeclMeccaniche.find(f => f.id == idMeccanica);
            $("#regoleContainer").empty();
            if (meccanicaCorrispondente.regole != null) {
                meccanicaCorrispondente.regole.forEach(function (setRegole) {
                    let setEtichetteItem = $($("#setEtichette").clone().html());
                    setRegole.forEach(function (regola) {
                        let etichetta = $($("#etichetta").clone().html());

                        me.appendiEtichette(etichetta.find("#etichettaVal"));
                        etichetta.find("#etichettaVal").val(regola.nomeEtichetta);
                        etichetta.find("#presente").attr("checked", regola.presente);
                        setEtichetteItem.append(etichetta);
                    });
                    let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');
                    let addEtichetta = $($("#addEtichetta").clone().html());
                    divContainer.append(addEtichetta);
                    setEtichetteItem.append(divContainer);
                    $("#regoleContainer").append(setEtichetteItem);
                });
            }
            else {
                //this.aggiungiNuovoSetRegole($("#regoleContainer"));
            }

            $("#modalModificaRegole").modal('show');
        }
    }

    openModalMeccanicaAvanzata(idMeccanica) {
        let me = this;
        console.log(idMeccanica);
        $("#modalModificaRegoleMeccanicaAvanzata").attr('idMeccanica', idMeccanica);
        $("#salvaRimozioneRegoleAvanzate").css("display", "none");
        $("#salvaRegoleAvanzate").css("display", "");
        $("#addSetRegoleButton").attr("rimozione", false);

        if (this.sourceDaAggiornare) {
            Call.do("DeclinazioniMeccaniche", "scaricaDeclinazioniMeccaniche", "GET", null, this, function (result, sender) {
                sender.sourceDaAggiornare = false;
                sender.sourceDeclMeccaniche = result.source;
                sender.sourceCombMeccaniche = result.combinazioniMeccaniche;
                sender.sourceMeccanicheAvanzate = result.meccanicheAvanzate;
                sender.sourceRimozioneMeccanicheAvanzate = result.meccanicheInRimozione;

                let meccanicaCorrispondente = me.sourceMeccanicheAvanzate.find(f => f.id == idMeccanica);
                $("#regoleAvanzateContainer").empty();
                if (meccanicaCorrispondente.regole != null) {
                    meccanicaCorrispondente.regole.forEach(function (setRegole) {
                        let setMeccanicheItem = $($("#setMeccaniche").clone().html());

                        if (setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) {
                            setRegole.regoleEtichetta.forEach(function (etichettaSingola) {
                                let etichetta = $($("#etichetta").clone().html());

                                me.appendiEtichette(etichetta.find("#etichettaVal"));
                                etichetta.find("#etichettaVal").val(etichettaSingola.nomeEtichetta);
                                etichetta.find("#presente").attr("checked", etichettaSingola.presente);
                                setMeccanicheItem.append(etichetta);

                            })
                        }
                        if (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0) {
                            setRegole.regoleMeccanica.forEach(function (meccanicaSingola) {

                                let mecc = $($("#meccanica").clone().html());

                                me.appendiMeccanica(mecc.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")));                           
                                mecc.find("#meccanicaVal").val(meccanicaSingola.idMeccanica);
                                
                                if (meccanicaSingola.nomeMeccanica != null && meccanicaSingola.nomeMeccanica != "") {
                                    if (mecc.find("#meccanicaVal").val() == null) {
                                        var optionCorrispondente = mecc.find("#meccanicaVal option[nameMecc='" + meccanicaSingola.nomeMeccanica + "']");
                                        mecc.find("#meccanicaVal").val(optionCorrispondente.val());
                                    }
                                    mecc.find("#searchByName").prop("checked", true);
                                }
                                me.checkSelection(mecc.find("#meccanicaVal"));
                                mecc.find("#presente").attr("checked", meccanicaSingola.presente);
                                setMeccanicheItem.append(mecc);
                            });
                        }

                        if ((setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) || (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0)) {
                            setMeccanicheItem.find("#meccanicaEsclusiva").prop("checked", setRegole.esclusivitaMeccanicheCoinvolte)
                        }


                        let addEtichetta = $($("#addEtichetta").clone().html());
                        let addMeccanica = $($("#addMeccanica").clone().html());

                        let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');

                        divContainer.append(addEtichetta);
                        divContainer.append(addMeccanica);
                        setMeccanicheItem.append(divContainer);
                        $("#regoleAvanzateContainer").append(setMeccanicheItem);
                    });
                }
                else {
                    //this.aggiungiNuovoSetRegole($("#regoleContainer"));
                }

                $("#modalModificaRegoleMeccanicaAvanzata").modal('show');
            });
        } else {
            let meccanicaCorrispondente = me.sourceMeccanicheAvanzate.find(f => f.id == idMeccanica);
            $("#regoleAvanzateContainer").empty();
            if (meccanicaCorrispondente.regole != null) {
                meccanicaCorrispondente.regole.forEach(function (setRegole) {
                    let setMeccanicheItem = $($("#setMeccaniche").clone().html());

                    if (setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) {
                        setRegole.regoleEtichetta.forEach(function (etichettaSingola) {
                            let etichetta = $($("#etichetta").clone().html());

                            me.appendiEtichette(etichetta.find("#etichettaVal"));
                            etichetta.find("#etichettaVal").val(etichettaSingola.nomeEtichetta);
                            etichetta.find("#presente").attr("checked", etichettaSingola.presente);
                            setMeccanicheItem.append(etichetta);

                        })
                    }
                    if (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0) {
                        setRegole.regoleMeccanica.forEach(function (meccanicaSingola) {

                            let mecc = $($("#meccanica").clone().html());

                            me.appendiMeccanica(mecc.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")));

                            mecc.find("#meccanicaVal").val(meccanicaSingola.idMeccanica);
                            if (meccanicaSingola.nomeMeccanica != null && meccanicaSingola.nomeMeccanica != "") {
                                if (mecc.find("#meccanicaVal").val() == null) {
                                    var optionCorrispondente = mecc.find("#meccanicaVal option[nameMecc='" + meccanicaSingola.nomeMeccanica + "']");
                                    mecc.find("#meccanicaVal").val(optionCorrispondente.val());
                                }
                                mecc.find("#searchByName").prop("checked", true);
                            }
                            me.checkSelection(mecc.find("#meccanicaVal"));
                            mecc.find("#presente").attr("checked", meccanicaSingola.presente);
                            setMeccanicheItem.append(mecc);
                        });
                    }

                    if ((setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) || (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0)) {
                        setMeccanicheItem.find("#meccanicaEsclusiva").prop("checked", setRegole.esclusivitaMeccanicheCoinvolte)
                    }


                    let addEtichetta = $($("#addEtichetta").clone().html());
                    let addMeccanica = $($("#addMeccanica").clone().html());

                    let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');

                    divContainer.append(addEtichetta);
                    divContainer.append(addMeccanica);
                    setMeccanicheItem.append(divContainer);
                    $("#regoleAvanzateContainer").append(setMeccanicheItem);
                });
            }
            else {
                //this.aggiungiNuovoSetRegole($("#regoleContainer"));
            }

            $("#modalModificaRegoleMeccanicaAvanzata").modal('show');
        }
    }

    openModalRimozioneMeccanicaAvanzata(idMeccanica) {
        let me = this;
        console.log(idMeccanica);
        $("#modalModificaRegoleMeccanicaAvanzata").attr('idMeccanica', idMeccanica);
        $("#salvaRimozioneRegoleAvanzate").css("display", "");
        $("#salvaRegoleAvanzate").css("display", "none");
        $("#addSetRegoleButton").attr("rimozione", true);
        if (this.sourceDaAggiornare) {
            Call.do("DeclinazioniMeccaniche", "scaricaDeclinazioniMeccaniche", "GET", null, this, function (result, sender) {
                sender.sourceDaAggiornare = false;
                sender.sourceDeclMeccaniche = result.source;
                sender.sourceCombMeccaniche = result.combinazioniMeccaniche;
                sender.sourceMeccanicheAvanzate = result.meccanicheAvanzate;
                sender.sourceRimozioneMeccanicheAvanzate = result.meccanicheInRimozione;

                let meccanicaCorrispondente = me.sourceRimozioneMeccanicheAvanzate.find(f => f.id == idMeccanica);
                $("#regoleAvanzateContainer").empty();
                if (meccanicaCorrispondente.regole != null) {
                    meccanicaCorrispondente.regole.forEach(function (setRegole) {
                        let setMeccanicheItem = $($("#setMeccaniche").clone().html());

                        if (setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) {
                            setRegole.regoleEtichetta.forEach(function (etichettaSingola) {
                                let etichetta = $($("#etichetta").clone().html());

                                me.appendiEtichette(etichetta.find("#etichettaVal"));
                                etichetta.find("#etichettaVal").val(etichettaSingola.nomeEtichetta);
                                etichetta.find("#presente").attr("checked", etichettaSingola.presente);
                                setMeccanicheItem.append(etichetta);

                            })
                        }
                        if (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0) {
                            setRegole.regoleMeccanica.forEach(function (meccanicaSingola) {

                                let mecc = $($("#meccanica").clone().html());

                                me.appendiMeccanica(mecc.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")), true);
                                mecc.find("#meccanicaVal").val(meccanicaSingola.idMeccanica);

                                if (meccanicaSingola.nomeMeccanica != null && meccanicaSingola.nomeMeccanica != "") {
                                    if (mecc.find("#meccanicaVal").val() == null) {
                                        var optionCorrispondente = mecc.find("#meccanicaVal option[nameMecc='" + meccanicaSingola.nomeMeccanica + "']");
                                        mecc.find("#meccanicaVal").val(optionCorrispondente.val());
                                    }
                                    mecc.find("#searchByName").prop("checked", true);
                                }
                                me.checkSelection(mecc.find("#meccanicaVal"));
                                mecc.find("#presente").attr("checked", meccanicaSingola.presente);
                                setMeccanicheItem.append(mecc);
                            });
                        }

                        if ((setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) || (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0)) {
                            setMeccanicheItem.find("#meccanicaEsclusiva").prop("checked", setRegole.esclusivitaMeccanicheCoinvolte)
                        }


                        let addEtichetta = $($("#addEtichetta").clone().html());
                        let addMeccanica = $($("#addMeccanica").clone().html());
                        addMeccanica.find(".addButton").attr("rimozione", true);
                        let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');

                        divContainer.append(addEtichetta);
                        divContainer.append(addMeccanica);
                        setMeccanicheItem.append(divContainer);
                        $("#regoleAvanzateContainer").append(setMeccanicheItem);
                    });
                }
                else {
                    //this.aggiungiNuovoSetRegole($("#regoleContainer"));
                }

                $("#modalModificaRegoleMeccanicaAvanzata").modal('show');
            });
        } else {
            let meccanicaCorrispondente = me.sourceRimozioneMeccanicheAvanzate.find(f => f.id == idMeccanica);
            $("#regoleAvanzateContainer").empty();
            if (meccanicaCorrispondente.regole != null) {
                meccanicaCorrispondente.regole.forEach(function (setRegole) {
                    let setMeccanicheItem = $($("#setMeccaniche").clone().html());

                    if (setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) {
                        setRegole.regoleEtichetta.forEach(function (etichettaSingola) {
                            let etichetta = $($("#etichetta").clone().html());

                            me.appendiEtichette(etichetta.find("#etichettaVal"));
                            etichetta.find("#etichettaVal").val(etichettaSingola.nomeEtichetta);
                            etichetta.find("#presente").attr("checked", etichettaSingola.presente);
                            setMeccanicheItem.append(etichetta);

                        })
                    }
                    if (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0) {
                        setRegole.regoleMeccanica.forEach(function (meccanicaSingola) {

                            let mecc = $($("#meccanica").clone().html());

                            me.appendiMeccanica(mecc.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")), true);

                            mecc.find("#meccanicaVal").val(meccanicaSingola.idMeccanica);
                            if (meccanicaSingola.nomeMeccanica != null && meccanicaSingola.nomeMeccanica != "") {
                                if (mecc.find("#meccanicaVal").val() == null) {
                                    var optionCorrispondente = mecc.find("#meccanicaVal option[nameMecc='" + meccanicaSingola.nomeMeccanica + "']");
                                    mecc.find("#meccanicaVal").val(optionCorrispondente.val());
                                }
                                mecc.find("#searchByName").prop("checked", true);
                            }
                            me.checkSelection(mecc.find("#meccanicaVal"));
                            mecc.find("#presente").attr("checked", meccanicaSingola.presente);
                            setMeccanicheItem.append(mecc);
                        });
                    }

                    if ((setRegole.regoleEtichetta != null && setRegole.regoleEtichetta.length > 0) || (setRegole.regoleMeccanica != null && setRegole.regoleMeccanica.length > 0)) {
                        setMeccanicheItem.find("#meccanicaEsclusiva").prop("checked", setRegole.esclusivitaMeccanicheCoinvolte)
                    }


                    let addEtichetta = $($("#addEtichetta").clone().html());
                    let addMeccanica = $($("#addMeccanica").clone().html());
                    addMeccanica.find(".addButton").attr("rimozione", true);

                    let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');

                    divContainer.append(addEtichetta);
                    divContainer.append(addMeccanica);
                    setMeccanicheItem.append(divContainer);
                    $("#regoleAvanzateContainer").append(setMeccanicheItem);
                });
            }
            else {
                //this.aggiungiNuovoSetRegole($("#regoleContainer"));
            }

            $("#modalModificaRegoleMeccanicaAvanzata").modal('show');
        }
    }

    openModalCombinazioni() {
        let me = this;
        $("#modalCombinazioniMeccaniche").find("#combinazioniContainer").empty();
        me.sourceCombMeccaniche.forEach(comb => {
            let combinazione = $($("#rowMeccCombinazione").clone().html());
            combinazione.attr("idComb", comb.id);
            combinazione.find("#meccanicaComb").val(comb.nomeCombinazione);
            combinazione.find("#formatoComb").val(comb.formato);
            $("#modalCombinazioniMeccaniche").find("#combinazioniContainer").append(combinazione);
        });

        me.creaNuovaCombinazioneModal();
        $("#modalCombinazioniMeccaniche").modal('show');
    }

    creaNuovaCombinazioneModal() {
        let me = this;

        const  groupedByLevel = me.sourceDeclMeccaniche.reduce((acc, obj) => {
            const { livello, ...rest } = obj;
            if (!acc[livello]) {
                acc[livello] = []; // Se non esiste ancora un array per questo livello, crealo
            }
            acc[livello].push(rest); // Aggiungi l'oggetto all'array corrispondente al livello
            return acc;
        }, {});

        const groupedByLevelUse = Object.entries(groupedByLevel)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0])); 
/*        let livelliNumber = Object.keys(groupedByLevel).length*/
        let combinazione = $($("#rowCombinazione").clone().html());
        for (const inx in groupedByLevelUse) {
            let level = 1;
            groupedByLevelUse[inx].forEach(obj => {
                if (typeof (obj) === "string") {
                    level = obj;
                    combinazione.find(".rowComb").append('<div class="col-3">' +
                        '<label class="form-check-label" for="select_' + level + '">' +
                        'Livello ' + level + '' +
                        '</label>' +
                        '<select class="livelloMeccanica" id="select_' + level + '">' +
                        '<option value="">Nessuna meccanica</option>' +
                        '</select></div>');
                }
                else {
                    obj.forEach(obj2 => {
                        combinazione.find("#select_" + level).append('<option value="' + obj2.nome + '">' + obj2.nome + '</option>')
                    });
                }
                
            });   
        }
        $("#modalCombinazioniMeccaniche").find("#combinazioniContainer").append(combinazione);
    }

    appendiEtichette(tendina) {
        this.sourceEtichette.forEach(function (item) {
            tendina.append("<option  value=\"" + item.Etichetta + "\">" + item.Etichetta +"</option>");
        });
    }

    appendiMeccanica(tendina, idMeccanica, isRimozione = false) {

        var element = null;
        if (isRimozione) {
            element = this.sourceRimozioneMeccanicheAvanzate.find(f => f.id == idMeccanica);
        }
        else {
            element = this.sourceMeccanicheAvanzate.find(f => f.id == idMeccanica);
        }

        if (element == null) {
            console.error("elemento non trovato");
            return;
        }
        var level = element.livelloEsternoMeccanicaAvanzata;

        const livelli = this.sourceDeclMeccaniche.map(item => item.livello); // Estrae tutti i livelli
        const livelliAvanzate = this.sourceMeccanicheAvanzate.map(item => item.livelloMeccanica); // Estrae tutti i livelli
        const livelliTotaliUnici = [...new Set([...livelli, ...livelliAvanzate])].sort((a, b) => a - b);
        //console.log(livelliTotaliUnici);

        if (!isRimozione) {
            livelliTotaliUnici.forEach(function (item) {
                tendina.append("<option  value=\"" + (-item) + "\">empty_level_" + item + "</option>");
            })
        }
        this.sourceDeclMeccaniche.forEach(function (item) {
            tendina.append("<option nameMecc=\"" + item.nome + "\"  value=\"" + item.id + "\">" + item.nome + "</option>");
        });

        var filteredAndSorted = this.sourceMeccanicheAvanzate
            // Filtra gli elementi con LivelloEsternoMeccanicaAvanzata inferiore a 'level'
            .filter(item => item.livelloEsternoMeccanicaAvanzata < level);
        if (isRimozione) {
            var filteredAndSorted = this.sourceMeccanicheAvanzate
                // Filtra gli elementi con LivelloEsternoMeccanicaAvanzata inferiore a 'level'
                .filter(item => item.livelloEsternoMeccanicaAvanzata <= level);
        }
            // Ordina prima per LivelloEsternoMeccanicaAvanzata e poi per LivelloMeccanica
        filteredAndSorted = filteredAndSorted.sort((a, b) => {
            // Ordina per LivelloEsternoMeccanicaAvanzata
            if (a.livelloEsternoMeccanicaAvanzata !== b.livelloEsternoMeccanicaAvanzata) {
                return a.livelloEsternoMeccanicaAvanzata - b.livelloEsternoMeccanicaAvanzata;
            }
            // Se LivelloEsternoMeccanicaAvanzata è uguale, ordina per LivelloMeccanica
            return a.livelloMeccanica - b.livelloMeccanica;
        });


        filteredAndSorted.forEach(function (item) {
            tendina.append("<option  nameMecc=\"" + item.nome + "\" value=\"" + item.id + "\">" + item.nome + " (Liv.Est:" + item.livelloEsternoMeccanicaAvanzata +")</option>");
        });

        this.checkSelection(tendina);
    }

    aggiungiNuovoSetRegole(modalContainer) {
        let setEtichette = $($("#setEtichette").clone().html());
        let etichetta = $($("#etichetta").clone().html());
        let addEtichetta = $($("#addEtichetta").clone().html());
        this.appendiEtichette(etichetta.find("#etichettaVal"));                    
        let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');
        divContainer.append(addEtichetta);


        setEtichette.append(etichetta)
        setEtichette.append(divContainer);
        modalContainer.append(setEtichette);
    }

    aggiungiNuovoSet(modalContainer, rimozione) {
        let setMeccaniche = $($("#setMeccaniche").clone().html());
        let etichetta = $($("#etichetta").clone().html());
        let meccanica = $($("#meccanica").clone().html());
        let addEtichetta = $($("#addEtichetta").clone().html());
        let addMeccanica = $($("#addMeccanica").clone().html());
        addMeccanica.find(".addButton").attr("rimozione", rimozione);

        // Contenitore per mettere addEtichetta e addMeccanica
        let divContainer = $('<div class="container-riga" style="display:flex; justify-content:space-evenly;"></div>');

        this.appendiEtichette(etichetta.find("#etichettaVal"));
        this.appendiMeccanica(meccanica.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")), rimozione);

        // Aggiungi addEtichetta e addMeccanica nel divContainer
        divContainer.append(addEtichetta);
        divContainer.append(addMeccanica);

        // Aggiungi gli altri elementi a setEtichette
        setMeccaniche.append(etichetta);
        setMeccaniche.append(meccanica);
        setMeccaniche.append(divContainer); // Aggiungi il div contenitore con addEtichetta e addMeccanica

        // Inserisci setEtichette nel modalContainer
        modalContainer.append(setMeccaniche);
    }

    aggiungiRegola(addEtichettaItem, isMeccanica, rimozione) {
        if (isMeccanica) {
            let meccanica = $($("#meccanica").clone().html());
            this.appendiMeccanica(meccanica.find("#meccanicaVal"), parseInt($("#modalModificaRegoleMeccanicaAvanzata").attr("idMeccanica")), rimozione);
            meccanica.insertBefore(addEtichettaItem);
        } else {
            let etichetta = $($("#etichetta").clone().html());
            this.appendiEtichette(etichetta.find("#etichettaVal"));
            etichetta.insertBefore(addEtichettaItem);
        }
    }

    eliminaSetRegole(setDaEliminare) {
        if (confirm("Sicuro di voler eliminare? Sarà possibile recuperare il set eliminato uscendo senza salvare")) {
            setDaEliminare.remove();
        }
    }

    eliminaRegola(regola) {
        regola.remove();
    }

    /////
    salvaEModifica() {
        let me = this;
        let item = {
            Nome : "",
            Livello : 0,
            Regole: [],
            }
        let idMeccanica = $("#modalModificaRegole").attr('idMeccanica');
        $("#modalModificaRegole").find(".setEtichette").each(function () {
            let setEtichette = [];
            $(this).find(".etichetta").each(function () {
                let etichetta = {
                    nomeEtichetta: "",
                    presente: false,
                }

                etichetta.nomeEtichetta = $(this).find("#etichettaVal").val();
                etichetta.presente = $(this).find("#presente").prop("checked");
                setEtichette.push(etichetta);
            });
            if (setEtichette.length > 0) {
                item.Regole.push(setEtichette);
            }
        });
        console.log(item.Regole);
        if (item.Regole.length == 0) {
            return;
        }
        Call.do("DeclinazioniMeccaniche", "Update/" + parseInt(idMeccanica), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $("#modalModificaRegole").modal('hide');
                sender.sourceDaAggiornare = true;
            }
            else {
                me.showAlertModal("Errore, regola non aggiornata", "danger", $("#modalModificaRegole"))
            }
        });
    }

    salvaEModificaAvanzate() {
        let me = this;
        let item = {
            Nome: "",
            Livello: 0,
            Regole: [],
        }
        let idMeccanica = $("#modalModificaRegoleMeccanicaAvanzata").attr('idMeccanica');
        $("#modalModificaRegoleMeccanicaAvanzata").find(".setMeccaniche").each(function () {
            let setItem = {
                EsclusivitaMeccanicheCoinvolte: false,
                regoleEtichetta: [],
                regoleMeccanica: [],
            }

            $(this).find(".etichetta").each(function () {
                let etichetta = {
                    nomeEtichetta: "",
                    presente: false,
                }

                etichetta.nomeEtichetta = $(this).find("#etichettaVal").val();
                etichetta.presente = $(this).find("#presente").prop("checked");
                setItem.regoleEtichetta.push(etichetta);
            });

            $(this).find(".meccanica").each(function () {
                let meccanica = {
                    idMeccanica: 0,
                    presente: false,
                    nomeMeccanica: ""
                }

                meccanica.presente = $(this).find("#presente").prop("checked");
                meccanica.idMeccanica = parseInt($(this).find("#meccanicaVal").val());
                if ($(this).find("#searchByName").prop("checked")) {
                    meccanica.nomeMeccanica = $(this).find("#meccanicaVal option:selected").attr("nameMecc");
                }

                setItem.regoleMeccanica.push(meccanica);
            });

            if (setItem.regoleEtichetta.length > 0 || setItem.regoleMeccanica.length > 0) {
                setItem.EsclusivitaMeccanicheCoinvolte = $(this).find("#meccanicaEsclusiva").prop("checked");
                item.Regole.push(setItem);
            }
        });
        console.log(item.Regole);
        if (item.Regole.length == 0) {
            return;
        }
        Call.do("DeclinazioniMeccanicheAvanzate", "Update/" + parseInt(idMeccanica), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $("#modalModificaRegoleMeccanicaAvanzata").modal('hide');
                sender.sourceDaAggiornare = true;
            }
            else {
                me.showAlertModal("Errore, regola non aggiornata", "danger", $("#modalModificaRegoleMeccanicaAvanzata"))
            }
        });
    }

    salvaEModificaRimozioneAvanzate() {
        let me = this;
        let item = {
            Nome: "",
            Livello: 0,
            Regole: [],
        }
        let idMeccanica = $("#modalModificaRegoleMeccanicaAvanzata").attr('idMeccanica');
        $("#modalModificaRegoleMeccanicaAvanzata").find(".setMeccaniche").each(function () {
            let setItem = {
                EsclusivitaMeccanicheCoinvolte: false,
                regoleEtichetta: [],
                regoleMeccanica: [],
            }

            $(this).find(".etichetta").each(function () {
                let etichetta = {
                    nomeEtichetta: "",
                    presente: false,
                }

                etichetta.nomeEtichetta = $(this).find("#etichettaVal").val();
                etichetta.presente = $(this).find("#presente").prop("checked");
                setItem.regoleEtichetta.push(etichetta);
            });

            $(this).find(".meccanica").each(function () {
                let meccanica = {
                    idMeccanica: 0,
                    presente: false,
                    nomeMeccanica: ""
                }

                meccanica.presente = $(this).find("#presente").prop("checked");
                meccanica.idMeccanica = parseInt($(this).find("#meccanicaVal").val());
                if ($(this).find("#searchByName").prop("checked")) {
                    meccanica.nomeMeccanica = $(this).find("#meccanicaVal option:selected").attr("nameMecc");
                }

                setItem.regoleMeccanica.push(meccanica);
            });

            if (setItem.regoleEtichetta.length > 0 || setItem.regoleMeccanica.length > 0) {
                setItem.EsclusivitaMeccanicheCoinvolte = $(this).find("#meccanicaEsclusiva").prop("checked");
                item.Regole.push(setItem);
            }
        });
        console.log(item.Regole);
        if (item.Regole.length == 0) {
            return;
        }
        Call.do("RimozioneMeccanicheAvanzate", "Update/" + parseInt(idMeccanica), "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $("#modalModificaRegoleMeccanicaAvanzata").modal('hide');
                sender.sourceDaAggiornare = true;
            }
            else {
                me.showAlertModal("Errore, regola non aggiornata", "danger", $("#modalModificaRegoleMeccanicaAvanzata"))
            }
        });
    }

    AggiungiCombinazioneMeccanica(rowNuovaMeccanica) {
        let me = this;
        let nomeCombinazione = "";
        rowNuovaMeccanica.find(".livelloMeccanica").each(function () {
            if ($(this).val() != "") {
                nomeCombinazione += $(this).val() + "_";
            }
        });
        nomeCombinazione = nomeCombinazione.substring(0, nomeCombinazione.length - 1);
        let formato = rowNuovaMeccanica.find("#formatoComb").val();
        if (nomeCombinazione == "" || formato == "") {
            me.showAlertModal("Specificare una combinazione e un formato valido", "danger", $("#modalCombinazioniMeccaniche"));
            return;
        }
        Call.do("CombinazioneMeccanica", "AddCombinazione/" + nomeCombinazione + "/" + formato, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalCombinazioniMeccaniche").modal('hide');
                window.location.reload();
            }
            else {
                me.showAlertModal("Errore, impossibile aggiungere la combinazione richiesta", "danger", $("#modalCombinazioniMeccaniche"));
            }
        })
    }

    EliminaCombinazione(id) {
        Call.do("CombinazioneMeccanica", "Delete/" + id, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalCombinazioniMeccaniche").modal('hide');
                window.location.reload();
            }
            else {
                me.showAlertModal("Errore, impossibile aggiungere la combinazione richiesta", "danger", $("#modalCombinazioniMeccaniche"));
            }
        })
    }

    ModificaCombinazioneMeccanica(rowMeccanica) {
        let item = {
            NomeCombinazione: "",
            Formato: "",
        }
        let id = rowMeccanica.attr("idComb");
        item.Formato = rowMeccanica.find("#formatoComb").val();
        item.NomeCombinazione = rowMeccanica.find("#meccanicaComb").val();
        if (item.Formato == "") {
            me.showAlertModal("Specificare un formato", "danger", $("#modalCombinazioniMeccaniche"));
            return;
        }
        Call.do("CombinazioneMeccanica", "Update/" + id, "POST", item, this, function (result, sender) {
            console.log(result);
            if (result) {
                $("#modalCombinazioniMeccaniche").modal('hide');
                window.location.reload();
            }
            else {
                me.showAlertModal("Errore, impossibile aggiungere la combinazione richiesta", "danger", $("#modalCombinazioniMeccaniche"));
            }
        })
    }

    showAlertModal(message, esito, modal) {
        let width = modal.find("#liveAlertPlaceholder").offsetWidth;
        const appendAlert = (message, type) => {
            const wrapper = $('<div></div>').addClass(`alert alert-${type} alert-dismissible`).attr('role', 'alert')
            const content = $('<div></div>').text(message)
            const closeButton = $('<button></button>').addClass('btn-close').attr({
                'type': 'button',
                'data-bs-dismiss': 'alert',
                'aria-label': 'Close'
            })
            wrapper.append(content, closeButton)
            modal.find("#liveAlertPlaceholder").css("width", width + "px");
            modal.find('#liveAlertPlaceholder').append(wrapper)

            //// Chiude automaticamente l'alert dopo 1 secondo
            //setTimeout(function () {
            //    wrapper.alert('close')
            //    if (sender != null) { sender.prop("disabled", false); }
            //}, 2000);
        }
        
        appendAlert(message, esito);
    }

    update(id, nome, livello, formato, salvaButton) {
        console.log(id);
        console.log(nome);
        console.log(livello);
        console.log(formato);
        if (livello <= 0) {
            alert("livello: " + livello + ", non valido. Inserire un livello con valori positivi maggiori di 0.")
            return;
        }
        var item = {
            Nome: nome,
            Livello: livello,
            Formato: formato,
            }
        Call.do("DeclinazioniMeccaniche", "Update/" + id, "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(salvaButton).css('background-color', 'green');

                sender.changeButtonColor(salvaButton);
            }
            else {
                $(salvaButton).css('background-color', 'red');

                sender.changeButtonColor(salvaButton);
            }
        })
    }

    changeButtonColor(salvaButton) {
        // Ottieni il colore di background attuale del pulsante
        const initialColorStr = $(salvaButton).css('background-color');

        // Funzione per convertire il colore RGB da stringa a un oggetto {r, g, b}
        const rgbStringToObject = (rgbString) => {
            const rgbValues = rgbString.match(/\d+/g);
            return {
                r: parseInt(rgbValues[0], 10),
                g: parseInt(rgbValues[1], 10),
                b: parseInt(rgbValues[2], 10)
            };
        };

        const initialColor = rgbStringToObject(initialColorStr);
        const finalColor = { r: 255, g: 255, b: 255 }; // Bianco

        // Variabili per gestire il tempo e la transizione
        let step = 0;
        const totalSteps = 30; // Numero di passi per la transizione
        const intervalTime = 100; // Tempo per ogni passo (in millisecondi)

        // Funzione per interpolare il colore
        const interpolateColor = (start, end, step, totalSteps) => {
            return start + (end - start) * (step / totalSteps);
        };

        // Crea un intervallo per cambiare gradualmente il colore
        const interval = setInterval(() => {
            step++;
            const r = Math.round(interpolateColor(initialColor.r, finalColor.r, step, totalSteps));
            const g = Math.round(interpolateColor(initialColor.g, finalColor.g, step, totalSteps));
            const b = Math.round(interpolateColor(initialColor.b, finalColor.b, step, totalSteps));

            // Imposta il nuovo colore di background
            $(salvaButton).css('background-color', `rgb(${r}, ${g}, ${b})`);

            // Ferma l'animazione dopo aver raggiunto l'ultimo step
            if (step >= totalSteps) {
                clearInterval(interval);
            }
        }, intervalTime);
    }

    dissolveElement(element, callback) {
        // Ottieni il colore di background attuale del pulsante
        const initialOpacity = parseInt($(element).css('opacity'));
        const finalOpacity = 0; // Bianco

        // Variabili per gestire il tempo e la transizione
        let step = 0;
        const totalSteps = 15; // Numero di passi per la transizione
        const intervalTime = 100; // Tempo per ogni passo (in millisecondi)

        // Funzione per interpolare il colore
        const interpolateOpacity = (start, end, step, totalSteps) => {
            return start + (end - start) * (step / totalSteps);
        };

        // Crea un intervallo per cambiare gradualmente il colore
        const interval = setInterval(() => {
            step++;

            const opacity = interpolateOpacity(initialOpacity, finalOpacity, step, totalSteps);

            // Imposta il nuovo colore di background
            $(element).css('opacity', opacity);

            // Ferma l'animazione dopo aver raggiunto l'ultimo step
            if (step >= totalSteps) {
                clearInterval(interval);
                if (callback != null) {
                    callback();
                }
            }
        }, intervalTime);
    }

    setScheda(schedaNumber, testata) {
        let testate = $(".testata");
        testate.each(function () {
            $(this).removeClass("active");
        });
        testata.addClass("active");
        let allSchede = $(".scheda");
        allSchede.each(function () {
            $(this).removeClass("active");
        });
        if (schedaNumber == 1) {
            $("#schedaDeclMeccaniche").addClass("active");
        }
        else if (schedaNumber == 2) {
            $("#schedaMeccanicheAvanzate").addClass("active");
        }
    }

    addMeccanicaAvanzata(nome, livelloMeccanica, livelloEsterno, formato) {
        console.log(nome);
        console.log(livelloMeccanica);
        if (livelloMeccanica <= 0) {
            
            alert("livello: " + livello + ", non valido. Inserire un livello con valori positivi maggiori di 0.")
            return;
        }
        console.log(livelloEsterno);
        console.log(formato);
        if (formato == "") {
            formato = null;
        }
        Call.do("DeclinazioniMeccanicheAvanzate", "AddDeclinazioneAvanzata/" + nome + "/" + parseInt(livelloMeccanica) + "/" + parseInt(livelloEsterno) + "/" + formato, "GET", null, this, function (result, sender) {
            window.location.reload();
            localStorage.setItem('clickHeaderMeccanicheAvanzate', 'true');
        });
    }

    addRimozioneMeccanicaAvanzata(nome, livelloMeccanica, livelloEsterno, applyBeforeExecution) {
        console.log(nome);
        console.log(livelloMeccanica);
        if (livelloMeccanica <= 0) {

            alert("livello: " + livello + ", non valido. Inserire un livello con valori positivi maggiori di 0.")
            return;
        }
        console.log(livelloEsterno);
        var applyBeforeExecutionEnum = applyBeforeExecution ? 1 : 2;
        Call.do("RimozioneMeccanicheAvanzate", "AddRimozioneDeclinazioneAvanzata/" + nome + "/" + parseInt(livelloMeccanica) + "/" + parseInt(livelloEsterno) + "/" + applyBeforeExecutionEnum, "GET", null, this, function (result, sender) {
            window.location.reload();
            localStorage.setItem('clickHeaderMeccanicheAvanzate', 'true');
        });
    }

    updateMeccanicaAvanzata(id, nome, livelloMeccanica, livelloEsterno, formato, salvaButton) {
        console.log(id);
        console.log(nome);
        console.log(livelloMeccanica);
        if (livelloMeccanica <= 0) {
            alert("livello: " + livello + ", non valido. Inserire un livello con valori positivi maggiori di 0.")
            return;
        }
        console.log(livelloEsterno);
        console.log(formato);
        var item = {
            Nome: nome,
            LivelloMeccanica: livelloMeccanica,
            LivelloEsternoMeccanicaAvanzata: livelloEsterno,
            Formato: formato,
        }
        Call.do("DeclinazioniMeccanicheAvanzate", "Update/" + id, "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(salvaButton).css('background-color', 'green');

                sender.changeButtonColor(salvaButton);
            }
            else {
                $(salvaButton).css('background-color', 'red');

                sender.changeButtonColor(salvaButton);
            }
        });
    }

    updateRimozioneMeccanicaAvanzata(id, nome, livelloMeccanica, livelloEsterno, applicazionePrioritaria, salvaButton) {
        console.log(id);
        console.log(nome);
        console.log(livelloMeccanica);
        if (livelloMeccanica <= 0) {
            alert("livello: " + livello + ", non valido. Inserire un livello con valori positivi maggiori di 0.")
            return;
        }
        console.log(livelloEsterno);
        var item = {
            Nome: nome,
            LivelloMeccanica: livelloMeccanica,
            LivelloEsternoMeccanicaAvanzata: livelloEsterno,
            timeToApply: applicazionePrioritaria ? 1 : 2,
        }
        Call.do("RimozioneMeccanicheAvanzate", "Update/" + id, "POST", item, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(salvaButton).css('background-color', 'green');

                sender.changeButtonColor(salvaButton);
            }
            else {
                $(salvaButton).css('background-color', 'red');

                sender.changeButtonColor(salvaButton);
            }
        });
    }

    deleteDeclMeccanicaAvanzata(id, row, eliminaButton) {
        var res = confirm("Sicuro di voler eliminare?");
        if (!res) {
            return;
        }

        Call.do("DeclinazioniMeccanicheAvanzate", "Delete/" + id, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(eliminaButton).prop('disabled', true);

                var callback = function () {
                    $(row).closest('.rowTable').next('tr').remove();
                    row.remove(); // Elimina l'elemento 'row'
                }

                sender.dissolveElement(row, callback);
            }
        });
    }

    deleteDeclMeccanica(id, row, eliminaButton) {
        var res = confirm("Sicuro di voler eliminare?");
        if (!res) {
            return;
        }

        Call.do("DeclinazioniMeccaniche", "Delete/" + id, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(eliminaButton).prop('disabled', true);

                var callback = function () {
                    $(row).closest('.rowTable').next('tr').remove();
                    row.remove(); // Elimina l'elemento 'row'
                }

                sender.dissolveElement(row, callback);
                
            }
        });
    }

    deleteRimozioneDeclMeccanicaAvanzata(id, row, eliminaButton) {
        var res = confirm("Sicuro di voler eliminare?");
        if (!res) {
            return;
        }

        Call.do("RimozioneMeccanicheAvanzate", "Delete/" + id, "GET", null, this, function (result, sender) {
            console.log(result);
            if (result.esito) {
                $(eliminaButton).prop('disabled', true);

                var callback = function () {
                    $(row).closest('.rowTable').next('tr').remove();
                    row.remove(); // Elimina l'elemento 'row'
                }

                sender.dissolveElement(row, callback);

            }
        });
    }

    checkSelection(tendina) {
        console.log(tendina);
        console.log(tendina.val());
        if (parseInt(tendina.val()) < 0) {
            tendina.closest(".meccanica").find("#searchByName").parent().css("display", "none");
            tendina.closest(".meccanica").find("#searchByName").prop("checked", false);
        }
        else {
            tendina.closest(".meccanica").find("#searchByName").parent().css("display", "block");
        }
        return tendina;
    }

    checkTipoMeccanica(tendina) {
        if (parseInt(tendina.val()) == 1) {
            $("#applyBeforeExecution").parent().css("display", "none");
            $("#tdSalvaRimozioniAvanzate").css("display", "none");
            $("#tdSalvaAvanzate").css("display", "");
            $("#FormatoAv").parent().css("display", "");
            $("#formatoAvLabel").css("display", "");
        }
        else {
            $("#applyBeforeExecution").parent().css("display", "");
            $("#tdSalvaRimozioniAvanzate").css("display", "");
            $("#tdSalvaAvanzate").css("display", "none");
            $("#FormatoAv").parent().css("display", "none");
            $("#formatoAvLabel").css("display", "none");
        }
    }
}