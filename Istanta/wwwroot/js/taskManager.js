class TaskManager {


    codaProcessi = [];
    intervalCheckStatoAttivita;
    listeners=[];

    constructor() {       

        setInterval(function (sender) {

            sender.checkStatoAttivita();

        }, 3000, this);
    }

    takeActivitiesByTime(callBack) {
        let me = this;
        let minutiDaSottrarre = parseFloat($("#intervalloTempo").val());
        $("#operazioniInEsecuzione").empty()
        $("#operazioniEseguite").empty()
        let operazioniInCorsoCount = 0;
        let operazioniEseguiteCount = 0;
        Call.do("api", "attivita/getAttivitaByTimeRange/" + minutiDaSottrarre +"/"+true+"/"+true, "GET", null, this, function (result, sender) {
            console.log(result);
            result.forEach(function (item) {
                if ((item.stato == 5 || item.stato == 6 || item.stato == 7) && me.getStatoSubAttività(item)) {
                    me.impaginateTask(item, $("#operazioniEseguite"), 0);
                    operazioniEseguiteCount++
                } 
                else {
                    me.impaginateTask(item, $("#operazioniInEsecuzione"), 0);
                    operazioniInCorsoCount++;
                }
            });

            if (operazioniInCorsoCount == 0) {
                $("#operazioniInEsecuzione").text("Nessuna operazione trovata");
            }
            else {
                let itemHtml = $($("#intestazioneTabella").clone().html());
                $("#operazioniInEsecuzione").prepend(itemHtml);
            }
            if (operazioniEseguiteCount == 0) {
                $("#operazioniEseguite").text("Nessuna operazione trovata");
            }
            else {
                let itemHtml = $($("#intestazioneTabella").clone().html());
                $("#operazioniEseguite").prepend(itemHtml);
            }
        });
    }

    impaginateTask(task, htmlParent, paddingStartPX) {
        let me = this;
        let itemHtml = $($("#rigaTabella").clone().html());
        if (task.stato == 6) {
            itemHtml.addClass("bg-success bg-opacity-50");
            itemHtml.addClass("operazioneRiuscita");            
        }
        else if (task.stato == 4)
        {
            itemHtml.addClass("bg-success bg-opacity-25");
        }
        else if (task.stato == 7) {
            itemHtml.addClass("bg-danger bg-opacity-50");
            itemHtml.addClass("operazioneFallita");
        }
        else {
            itemHtml.addClass("bg-warning bg-opacity-25");
            if (task.stato == 5) {
                itemHtml.addClass("operazioneCancellata");
            }
        }
        itemHtml.css("padding-left", paddingStartPX);
        if (paddingStartPX == 0) {
            itemHtml.addClass("border-dark mt-1");
        }
        else {
            itemHtml.addClass("border-top border-1 border-dark");
        }
        itemHtml.find("#Title").text(task.titolo);
        itemHtml.find("#DataRegistazione").text(this.formattaData(task.dataInserimento));
        itemHtml.find("#DataInizio").text(this.formattaData(task.dataInizio));
        itemHtml.find("#DataFine").text(this.formattaData(task.dataFine));
        itemHtml.find("#Completamento").text(task.progress +"%");
        itemHtml.find("#Stato").text(task.statoMsg);
        itemHtml.find("#ErrorButton").attr("idAttivita", task.id);
        if (task.stato == 7) {
            itemHtml.find("#Errors").css("display", "block");
        }
        task.subAttivita.forEach(function (item) {
            me.impaginateTask(item, htmlParent, paddingStartPX+50)
        });
        htmlParent.prepend(itemHtml);
        this.setCheckboxVisibility();
    }

    formattaData(data) {
        // Crea un oggetto Data dalla stringa della data
        var dataObj = new Date(data);

        // Estrai le componenti della data
        var giorno = dataObj.getDate();
        var mese = dataObj.getMonth() + 1; // Gennaio è 0
        var anno = dataObj.getFullYear();
        var ore = dataObj.getHours();
        var minuti = dataObj.getMinutes();
        var secondi = dataObj.getSeconds();

        // Aggiungi zero davanti a giorni, mesi, ore, minuti, secondi se sono inferiori a 10
        giorno = giorno < 10 ? '0' + giorno : giorno;
        mese = mese < 10 ? '0' + mese : mese;
        ore = ore < 10 ? '0' + ore : ore;
        minuti = minuti < 10 ? '0' + minuti : minuti;
        secondi = secondi < 10 ? '0' + secondi : secondi;

        // Restituisci la data formattata nel formato desiderato
        return anno + '-' + mese + '-' + giorno + ' ' + ore + ':' + minuti;
    }

    getAll() {
        //Recupera tutti i tasks e li impagina
    }
    
    addListener(obj)
    {
        console.log("Aggiunto listeners " + obj);
        this.listeners.push(obj);
    }

    Add(id_attivita) {
        this.codaProcessi.push(id_attivita);
    }

    checkStatoAttivita() {
        //console.log(this.codaProcessi);

        for (let c = 0; c < this.codaProcessi.length; c++) {
            let procId = this.codaProcessi[c];
            Call.do("api", "attivita/getStato/" + procId, "GET", null, this, function (result, sender) {
                

                let ctrl = $(".progressBar[id_attivita='" + result.id + "']");

                console.log(ctrl);

                let attivita = result;

                if ((attivita.stato == 6 || attivita.stato == 7) && attivita.subAttivita.length > 0) {

                    //Ci sono sub attività
                    //Per adesso implemento la feature di monitorare la prima sub attività, come se il sistema se ne aspettasse solo una al massimo.
                    //Ma ci sonon casi in cui le sub attività possono essere molte (Ad esempio esportazione POP)
                    //Quel caso lo vedremo quando ci arriveremo
                    attivita = attivita.subAttivita[0];
                }

                console.log("Callback stato attività")
                console.log(attivita);

                if (attivita.stato == 6 || attivita.stato == 7 || attivita.stato == 9) {
                    //Elimino proc dalla lista di controllo
                    sender.codaProcessi.splice(sender.codaProcessi.findIndex(f => f == procId), 1);
                    ctrl.find(".progressMsg").text(attivita.statoMsg);

                    console.log("Listeners");
                    console.log(sender.listeners);

                    sender.listeners.forEach(f => {
                        console.log(f.onAttivitaChageStatus + " -> " + attivita.stato);
                        f.onAttivitaChageStatus(attivita.id, attivita.stato);
                    });

                }
                else {
                    if (attivita.stato == 1) {
                        ctrl.find(".progressMsg").text("In coda di attesa: N. " + attivita.coda);
                        if (attivita.coda == 0) {
                            ctrl.find(".progressMsg").text("Assegnazione della coda...");
                        }
                    }
                    else {
                        ctrl.find(".progressMsg").text(attivita.statoMsg);
                        if (attivita.statoMsg == null || attivita.statoMsg == "") {
                            if (attivita.stato == 0)
                                ctrl.find(".progressMsg").text("Attendere prego...");
                        }
                    }


                }

                if (attivita.stato != 1) {
                    ctrl.find(".progressBar").css("width", attivita.progress + "%");
                }
            });
        }
    }

    getErrori(idAttività) {
        Call.do("api", "attivita/getLogErrorAttivita/" + idAttività, "GET", null, this, function (result, sender) {
            console.log(result);
            var conteggi = {};
            result.forEach(function (errore) {
                if (conteggi[errore]) {
                    conteggi[errore]++;
                } else {
                    conteggi[errore] = 1;
                }
            });

            // Creazione di un array di oggetti con errori unici e rispettive ripetizioni
            var risultatoFinale = Object.keys(conteggi).map(function (errore) {
                return { error: errore, ripetizioni: conteggi[errore] };
            });

            console.log(risultatoFinale);
           
            $("#ModalShowErrors").find(".modal-title").text("Errori dell'attività: " + idAttività);
            $("#ModalShowErrors .modal-body").empty();

            // Intestazione
            var intestazione = $("<div class='row bg-primary bg-opacity-75 text-white'><div class='col-11'>Errore</div><div class='col-1'>Ripetizioni</div></div>");
            $("#ModalShowErrors .modal-body").append(intestazione);

            // Aggiungi ogni elemento di risultatoFinale al modal body
            risultatoFinale.forEach(function (elemento, indice) {
                var riga = $("<div class='row'></div>");
                var colonnaErrore = $("<div class='col-11' style='font-size: 12px; line-height: 2rem;'>" + elemento.error + "</div>");
                var colonnaRipetizioni = $("<div class='col-1'>" + elemento.ripetizioni + "</div>");

                // Applica la classe di sfondo alternato
                if (indice % 2 === 0) {
                    riga.addClass('bg-success bg-opacity-25');
                } else {
                    riga.addClass('bg-success bg-opacity-50');
                }

                riga.append(colonnaErrore);
                riga.append(colonnaRipetizioni);

                $("#ModalShowErrors .modal-body").append(riga);
            });

            // Apri il modal
            $("#ModalShowErrors").modal("show");
        });
    }

    setCheckboxVisibility() {
        if (!$("#opRiuscite").prop("checked")) {
            $("#operazioniEseguite").find(".operazioneRiuscita").css("display", "none");
        }
        else {
            $("#operazioniEseguite").find(".operazioneRiuscita").css("display", "flex");
        }

        if (!$("#opFallite").prop("checked")) {
            $("#operazioniEseguite").find(".operazioneFallita").css("display", "none");
        }
        else {
            $("#operazioniEseguite").find(".operazioneFallita").css("display", "flex");
        }

        if (!$("#opAnnullate").prop("checked")) {
            $("#operazioniEseguite").find(".operazioneCancellata").css("display", "none");
        }
        else {
            $("#operazioniEseguite").find(".operazioneCancellata").css("display", "flex");
        }
    }

    getStatoSubAttività(item) {
        if (item.subAttivita.length == 0) {
            if (item.stato == 5 || item.stato == 6 || item.stato == 7) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            let res = true;
            for (var i = 0; i < item.subAttivita.length; i++) {
                if (res) {
                    res = this.getStatoSubAttività(item.subAttivita[i])
                }
            }
            return res;
        }
    }
}