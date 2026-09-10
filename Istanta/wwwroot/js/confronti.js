class Confronti {
    agenzia;
    multiPrimario = false;
    secondaria = true;
    multiSecondario = false;
    requireXmlFile = false;
    specialParam = "";

    constructor() {
        this.agenzia = new Agenzia();
    }


    onChangeModalitaMultiPrimario(isMultiPrimario, hasSecondario, requireXml) {
        if (isMultiPrimario) {
            $("#TendinaPromo1").val("0");

            $("#TendinaPromo2").val("0");
            $("#TendinaPromo2").find('option').each(function (index, option) {
                $(this).css('display', 'block');
            });
            $("#TendinaPromo2").parent().css("visibility", "hidden");
            $("#TendinaPromo2").parent().css("display", "none");

            $("#TendinaTracciato1").val("0");
            $("#TendinaTracciato1").parent().css("display", "none");

            $("#TendinaTracciatoSecondario").val("0");
            $("#TendinaTracciatoSecondario").css("display", "none");
            

            $("#containerTracciatoSecondario").empty();
            $("#ColonnaTracciatoSecondario").css("display", "none");
            $('#confrontaButton').prop('disabled', true);
            $("#ColonnaInputDirectory").css("display", "none");

            $("#ColonnaSelezioneTracciatiMultipli").css("display", "block");

        }
        else {
            $("#TendinaPromo1").val("0");

                $("#TendinaPromo2").val("0");
                $("#TendinaPromo2").find('option').each(function (index, option) {
                    $(this).css('display', 'block');
                });
            if (hasSecondario) {
                $("#TendinaPromo2").parent().css("visibility", "visible");
                $("#TendinaPromo2").parent().css("display", "block");
            }
            else {
                $("#TendinaPromo2").parent().css("visibility", "hidden");
                $("#TendinaPromo2").parent().css("display", "none");
            }

            if (requireXml) {
                $("#ColonnaFileXml").css("visibility", "visible");
            }
            else {
                $("#ColonnaFileXml").css("visibility", "hidden");
            }

            $('#confrontaButton').prop('disabled', true);
            $("#ColonnaInputDirectory").css("display", "none");
            $("#ColonnaSelezioneTracciatiMultipli").css("display", "none");
            $("#containerTracciatiPrimari").empty();
        }
    }

    onChangePromoMaster(tendina) {

        if (parseInt(tendina.val()) != 0 && parseInt($("#TendinaPromoSlave").val()) == 0) {
            //Solo se lo slave non è specificato allora ci vado automatico
            $("#TendinaPromoSlave").val(tendina.val());
        }

        this.checkCombinazioni();
    }

    onChangePromoSlave(tendina) {

        if (parseInt(tendina.val()) != 0 && parseInt($("#TendinaPromoMaster").val()) == 0) {
            //Solo se lo slave non è specificato allora ci vado automatico
            $("#TendinaPromoMaster").val(tendina.val());
        }

        $("#TendinaImportazionePromoSlave").empty();
        this.checkCombinazioni();

    }

    recuperaImportazioniPending(id) {

        $("#TendinaImportazionePromoSlave").empty();
        Call.do("Tracciati", "getImportazioniPending/" + id, "GET", null, null, function (result) {

            
            $("#TendinaImportazionePromoSlave").append("<option value='0'>Non specificato</option>");

            for (let r = 0; r < result.length; r++) {

                let rec = result[r];
                $("#TendinaImportazionePromoSlave").append("<option value='" + rec.id + "'>" + rec.titolo + "</option>");
            }
        });
    }


    checkCombinazioni()
    {
        
        let idPromoMaster = parseInt($("#TendinaPromoMaster").val());
        let idPromoSlave = parseInt($("#TendinaPromoSlave").val());

        //recupero delle importazioni in pending
        if (idPromoSlave > 0)
            this.recuperaImportazioniPending(idPromoSlave);
        else
            $("#TendinaImportazionePromoSlave").empty();

        if (idPromoMaster == idPromoSlave && idPromoMaster>0) {
            //Allora possiamo mostrare che il master rappresenta la -1 e slave attuale. Questa è solo una indicazione parlante
            $("#rowVersionSlave").css("display", "block");
            $("#rowVersionMaster").css("display", "block");

            $("#TendinaVersionePromoSlave").val(1);
            $("#TendinaVersionePromoMaster").val(2);

        }
        else {
            $("#rowVersionSlave").css("display", "none");
            $("#rowVersionMaster").css("display", "none");
        }


        if (idPromoMaster > 0) {
            showLoading();
            //Se almeno la primaria CHE é OBBLIGATORIA, è selezionata io posso vedere i CaC in comune
            Call.do("Confronti", "CheckCombinazioni/" + idPromoMaster + "/" + idPromoSlave, "GET", null, this, function (result, sender) {

                console.log("Risultato del check");
                console.log(result);

                $("#TendinaFiltroCombMaster").empty();
                $("#TendinaFiltroCombMaster").append("<option value='0' selected>Tutte le combinazioni</option>");

                $("#TendinaFiltroCombSlave").empty();
                $("#TendinaFiltroCombSlave").append("<option value='0' selected>Tutte le combinazioni</option>");

                for (let c = 0; c < result.combinazioni_master.length; c++) {
                    let comb = result.combinazioni_master[c];
                    $("#TendinaFiltroCombMaster").append("<option value='" + comb.id + "'>" + comb.titolo + "</option>");
                }

                for (let c = 0; c < result.combinazioni_slave.length; c++) {
                    let comb = result.combinazioni_slave[c];
                    $("#TendinaFiltroCombSlave").append("<option value='" + comb.id + "'>" + comb.titolo + "</option>");
                }

                $("#rowError").css("display", "none");
                $("#rowAction").css("display", "block");
                $("#pError").text("");
                $("#rowErrors").css("display", "none");

                if (result.combinazioni_master.lenght == 0) {
                    //Non si puo procedere con il confronto
                    $("#pError").text("Nessuna combiazione trovata nella promo selezionata come primaria");
                    $("#rowErrors").css("display", "block");
                    $("#rowAction").css("display", "none");
                }
                else if (result.combinazioni_slave.lenght == 0) {
                    //Non si puo procedere con il confronto
                    $("#pError").text("Nessuna combiazione trovata nella promo selezionata come secondaria");
                    $("#rowErrors").css("display", "block");
                    $("#rowAction").css("display", "none");
                }


                hideLoading();
            });
        }
        else {
            $("#pError").text("Selezionare una promo per entrambe le parti");
            $("#rowErrors").css("display", "block");
            $("#rowAction").css("display", "none");
        }

    }

    onchangeCombinazione(sender) {


        if (sender.val() == 0) {
            //Azzerare tutto
            $("#TendinaFiltroCombMaster").val(0);
            $("#TendinaFiltroCombSlave").val(0);
        }
        else {
            let valCombMaster = $("#TendinaFiltroCombMaster").val();
            let valCombSlave = $("#TendinaFiltroCombSlave").val();

            console.log([valCombMaster, valCombSlave]);

            if (valCombMaster <= 0 && valCombSlave != 0)
                $("#TendinaFiltroCombMaster").val(valCombSlave);
            else if (valCombSlave <= 0 && valCombMaster != 0)
                $("#TendinaFiltroCombSlave").val(valCombMaster);

            let endValCombMaster = $("#TendinaFiltroCombMaster").val();
            let endValCombSlave = $("#TendinaFiltroCombSlave").val();
            let idPromoMaster = parseInt($("#TendinaPromoMaster").val());
            let idPromoSlave = parseInt($("#TendinaPromoSlave").val());

            if (endValCombMaster != endValCombSlave || idPromoMaster != idPromoSlave) {

                //Inutile selezionare le versioni, saranno ignorate. Viene presa l'ultima versione del tracciato richiesto nel filtro per ciascuna
                //$("#TendinaVersionePromoSlave").prop("disabled", true);
                //$("#TendinaVersionePromoMaster").prop("disabled", true);

                $("#rowVersionSlave").css("display", "none");
                $("#rowVersionMaster").css("display", "none");

            }
            else {
                //La versione è necessaria
                //$("#TendinaVersionePromoSlave").prop("disabled", false);
                //$("#TendinaVersionePromoMaster").prop("disabled", false);

                $("#rowVersionSlave").css("display", "block");
                $("#TendinaVersionePromoSlave").val(1);
                $("#rowVersionMaster").css("display", "block");
                $("#TendinaVersionePromoMaster").val(2);
            }
        }

    }

    onchangeImportazionePending(sender)
    {
        //if (sender.val() != 0) {
        //    //Disabilito la versione.
        //    //La versione la decide l'escel stesso
        //    $("#TendinaVersionePromoSlave").prop("disabled", true);
        //}
        //else {
        //    $("#TendinaVersionePromoSlave").prop("disabled", false);
        //}

        let endValCombMaster = $("#TendinaFiltroCombMaster").val();
        let endValCombSlave = $("#TendinaFiltroCombSlave").val();
        let idPromoMaster = parseInt($("#TendinaPromoMaster").val());
        let idPromoSlave = parseInt($("#TendinaPromoSlave").val());

        if (endValCombMaster != endValCombSlave || idPromoMaster != idPromoSlave || sender.val()>0) {

            //Inutile selezionare le versioni, saranno ignorate. Viene presa l'ultima versione del tracciato richiesto nel filtro per ciascuna
            //$("#TendinaVersionePromoSlave").prop("disabled", true);
            //$("#TendinaVersionePromoMaster").prop("disabled", true);

            $("#rowVersionSlave").css("display", "none");
            $("#rowVersionMaster").css("display", "none");

        }
        else {
            //La versione è necessaria
            //$("#TendinaVersionePromoSlave").prop("disabled", false);
            //$("#TendinaVersionePromoMaster").prop("disabled", false);

            $("#rowVersionSlave").css("display", "block");
            $("#TendinaVersionePromoSlave").val(1);
            $("#rowVersionMaster").css("display", "block");
            $("#TendinaVersionePromoMaster").val(2);
        }
    
    }

    confrontaAction()
    {

        let fd = new FormData();
        fd.append("IdPromoMaster", parseInt($("#TendinaPromoMaster").val()));
        fd.append("filtroCombinazioneMaster", $("#TendinaFiltroCombMaster").val());
        fd.append("versioneMaster", parseInt($("#TendinaVersionePromoMaster").val()));
        fd.append("IdPromoSlave", parseInt($("#TendinaPromoSlave").val()));
        fd.append("filtroCombinazioneSlave", $("#TendinaFiltroCombSlave").val());
        fd.append("versioneSlave", parseInt($("#TendinaVersionePromoSlave").val()));
        fd.append("idImportazioneSlave", parseInt($("#TendinaImportazionePromoSlave").val()));
        
        let obj = {
            IdPromoMaster:parseInt($("#TendinaPromoMaster").val()),
            filtroCombinazioneMaster:$("#TendinaFiltroCombMaster").val(),
            versioneMaster:parseInt($("#TendinaVersionePromoMaster").val()),
            IdPromoSlave:parseInt($("#TendinaPromoSlave").val()),
            filtroCombinazioneSlave:$("#TendinaFiltroCombSlave").val(),
            versioneSlave:parseInt($("#TendinaVersionePromoSlave").val()),
            idImportazioneSlave:parseInt($("#TendinaImportazionePromoSlave").val())
        };

        showLoading();
        $("#containerTableScreen").empty();
        Call.do("Confronti", "ConfrontaListe2", "PUT", obj, this, function (result, me) {
            console.log("RISULTATO CONFRONTO");
            console.log(result);

            let tbl = '<table id="tableScreen" class="display">$head$body</table>';
            let tblHead = '<thead><tr>$bind</tr></thead>';
            let tblBody = '<tbody>$bind</tbody>';

            $("#btnCsvDownload").attr("guidid", result.csvGuidid);

            if (result.tipo == 1) {
                //Self

                //Mostra ca
                let mostraCA = true;
                let endValCombMaster = $("#TendinaFiltroCombMaster").val();
                let endValCombSlave = $("#TendinaFiltroCombSlave").val();
                if (endValCombMaster !=0 && endValCombMaster == endValCombSlave) {
                    mostraCA = false;
                }

                //head                
                let head = "";
                if (mostraCA) {
                    head += "<th>Canale/Area</th>";
                }

                head += "<th>Stato</th>";
                head += "<th>Codice Ref</th>";
                head += "<th>Codice Gruppo</th>";
                head += "<th>Descrizione</th>";
                for (let i = 0; i < result.campiDiControllo.length; i++) {
                    let c = result.campiDiControllo[i];
                    head += "<th colspan=\"2\">" + c + "</th>";
                }

                tblHead = tblHead.replace("$bind", head);

                //body
                //<tr><td>Row 1 Data 1</td><td>Row 1 Data 2</td></tr ><tr>
                let body = "";
                for (let r = 0; r < result.lista.length; r++) {
                    let rec = result.lista[r];

                    let styRow = "";
                    let stato = "";

                    if (rec.stato == 1) {
                        stato = "Inalterato";
                    }
                    else if (rec.stato == 2) {
                        stato = "Cambiato";
                    }
                    if (rec.stato == 3)//Entrante
                    {
                        styRow = " style='background-color:#9dd79d;'";
                        stato = "Entrante";
                    }
                    else if (rec.stato == 4)//Uscente
                    {
                        styRow = " style='background-color:#c99494;'";
                        stato = "Uscente";
                    }

                    body += "<tr" + styRow + ">";

                    if (mostraCA) {
                        body += "<th>" + rec.canale +"/"+ rec.area +"</th>";
                    }

                    let codGruppo = rec.data["Scatto.CodiceGruppo"];
                    if (codGruppo == null)
                        codGruppo = rec.data["Referenza.Codice"];

                    body += "<td>" + stato + "</td>";
                    body += "<td>" + rec.data["Referenza.Codice"] + "</td>";
                    body += "<td>" + codGruppo + "</td>";
                    body += "<td>" + rec.data["Descrizioni.Descrizione1"] + "</td>";


                    for (let i = 0; i < result.campiDiControllo.length; i++) {
                  
                        let nome_campo = result.campiDiControllo[i];
                        let diffFieldItem = rec.campiDifferenti.find(f => f.campo == nome_campo );
                        if (diffFieldItem != null) {
                            //Sicuramente alterato

                            body += "<td style=\"background-color:#e9ce9c;\">" + diffFieldItem.valoreMaster + "</td>";
                            body += "<td style=\"background-color: orange;\">" + diffFieldItem.valoreSlave + "</td>";

                        }
                        else if (rec.stato == 3 || rec.stato == 4)//Entrante o uscente
                        {
                            body += "<td>" + rec.data[nome_campo] +"</td><td></td>";                            
                        }
                        else
                        {
                            //Uguale
                            body += "<td style='background-color:gray;'>" + rec.data[nome_campo] + "</td><td></td>";
                        }
                        
                    }
                    
                    body += "</tr>";
                }

                tblBody = tblBody.replace("$bind", body);

                tbl = tbl.replace("$head", tblHead);  
                tbl = tbl.replace("$body", tblBody);

                $("#resultContainer").css("display", "block");


            }
            else {
                //Confronti tra AC differenti
                //head                
                let head = "";

                head += "<th>Presenza</th>";
                head += "<th>Stato</th>";
                head += "<th>Codice Ref</th>";
                head += "<th>Codice Gruppo</th>";
                head += "<th>Descrizione</th>";
                for (let i = 0; i < result.campiDiControllo.length; i++) {
                    let c = result.campiDiControllo[i];
                    head += "<th>" + c + " (" + result.acMaster +")</th>";
                    head += "<th>" + c + " (" + result.acSlave  +")</th>";
                }

                tblHead = tblHead.replace("$bind", head);

                //body
                //<tr><td>Row 1 Data 1</td><td>Row 1 Data 2</td></tr ><tr>
                let body = "";
                for (let r = 0; r < result.lista.length; r++) {
                    let rec = result.lista[r];

                    let stato = "";

                    if (rec.stato == 1) {
                        stato = "Inalterato";
                    }
                    else if (rec.stato == 2) {
                        stato = "Cambiato";
                    }
                    if (rec.stato == 3)//Entrante
                    {
                        stato = "Entrante";
                    }
                    else if (rec.stato == 4)//Uscente
                    {
                        stato = "Uscente";
                    }

                    body += "<tr>";

                    let statoContesto = rec.statoContesto;

                    body += "<td>" + (statoContesto == 1 ? "In Comune" : (statoContesto ==2?"Solo in primario":"Solo in secondario")) + "</td>";
                    body += "<td>" + stato + "</td>";
                    body += "<td>" + rec.data["Referenza.Codice"] + "</td>";
                    body += "<td>" + rec.data["Scatto.CodiceGruppo"] + "</td>";
                    body += "<td>" + rec.data["Descrizioni.Descrizione1"] + "</td>";


                    for (let i = 0; i < result.campiDiControllo.length; i++) {

                        let nome_campo = result.campiDiControllo[i];
                        if (statoContesto == 1) {
                            let diffFieldItem = rec.campiDifferenti.find(f => f.campo == nome_campo);
                            if (diffFieldItem != null) {
                                //Sicuramente alterato

                                body += "<td style=\"background-color:#e9ce9c;\">" + diffFieldItem.valoreMaster + "</td>";
                                body += "<td style=\"background-color: orange;\">" + diffFieldItem.valoreSlave + "</td>";

                            }
                            else {
                                //Uguale
                                body += "<td style='background-color:gray;'>" + rec.data[nome_campo] + "</td>";
                                body += "<td style='background-color:gray;'>" + rec.data[nome_campo] + "</td>";
                            }
                        }
                        else if (statoContesto == 2) {
                            body += "<td style='background-color:gray;'>" + rec.data[nome_campo] + "</td>";
                            body += "<td style='background-color:gray;'>-</td>";
                        }
                        else if (statoContesto == 3) {
                            body += "<td style='background-color:gray;'>-</td>";
                            body += "<td style='background-color:gray;'>" + rec.data[nome_campo] + "</td>";
                        }

                    }

                    body += "</tr>";
                }

                tblBody = tblBody.replace("$bind", body);

                tbl = tbl.replace("$head", tblHead);
                tbl = tbl.replace("$body", tblBody);

                $("#resultContainer").css("display", "block");
            }

            $("#containerTableScreen").html(tbl);
            tableScreen = $('#tableScreen').DataTable({
                scrollX: true,        // abilita lo scroll orizzontale
                autoWidth: false,     // evita che DataTables ridimensioni le colonne
                responsive: false,     // disattiva adattamento automatico
                fixedColumns: true
            });

            hideLoading();
        });

    }

    scaricaCsv(sender) {

        //Download del file
        let file = sender.attr("guidid") + ".csv";
        var a = document.createElement("a");
        a.href = "exported_files/" + file;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();  // Dopo il click rimuove l'elemento <a> dal DOM
    }

    scaricaExcel(sender) {

        //Lista dei codici da filtrare
        let _cods = [];

        //Prendiamo sempre e solo il codice per ora
        tableScreen.rows({ search: "applied" }).data().toArray().forEach(function (rowData) {
            _cods.push(rowData[2]);
        });

        let obj = {
            idImportazioneSlave: parseInt($("#TendinaImportazionePromoSlave").val()),
            Filtro: [
                { chiave:"Referenza.Codice", valori: _cods }
            ]
        };


        $.ajax({
            type: "PUT",
            url: "/" + getWebAppRootFolder() + "Confronti/esportaComeListaDiImportazione",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(obj),
            xhrFields: {
                responseType: 'blob'  // Assicura che la risposta sia gestita come Blob
            },
            success: function (data, textStatus, xhr) {

                let disposition = xhr.getResponseHeader('Content-Disposition');;
                let fileName = "lista.xlsx";//Nome generico

                if (disposition && disposition.indexOf('filename=') !== -1) {
                    var match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (match != null && match[1]) {
                        fileName = match[1].replace(/['"]/g, '');
                    }
                }

                var blob = new Blob([data], { type: 'application/vnd.ms-excel' });
                var downloadUrl = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = downloadUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                hideLoading();

            },
            error: function (xhr, textStatus, errorThrown) {

                console.log('Errore nella richiesta PUT: ' + errorThrown);
            },

        });

    }


    onChangePromoSecondaria(tendina) {
        let me = this;
        if (tendina.val() == "0") {
            $("#containerTracciatoSecondario").empty();
            $("#ColonnaTracciatoSecondario").css("display", "none");
            $("#TendinaTracciatoSecondario").val("0");
            $("#TendinaTracciatoSecondario").css("display", "none");
            //$("#TendinaTracciato2").parent().css("display", "none");
            //$("#TendinaTracciato2").val("0");
            $('#confrontaButton').prop('disabled', false);
            $("#ColonnaInputDirectory").css("display", "block");
        }
        else {

            var valoreTendina = tendina.val();
            var idPromo = parseInt(valoreTendina, 10)
            showLoading()
            Call.do("Tracciati", "GetTracciatiPromo/" + idPromo, "GET", null, this, function (result, sender) {
                console.log(result);
                if (typeof result !== 'string') {
                    $("#containerTracciatoSecondario").empty();
                    $("#TendinaTracciatoSecondario").empty();
                    $("#TendinaTracciatoSecondario").append('<option value="0">Scegli tracciato</option>');
                    result.forEach(function (item) {
                        if (!me.multiSecondario) {
                            $("#TendinaTracciatoSecondario").append("<option value=" + item.id + ">" + item.sigla + "</option>");
                        }
                        else {
                            $("#containerTracciatoSecondario").append(
                                '<div><label><input type="checkbox" onchange="confInstance.onChangeTracciatoSecondario()" value="' + item.id + '">' + item.sigla + '</label></div>'
                            );
                        }
                    });    
                   
                }
                else {
                    console.log(result);
                }
                hideLoading();
            });

            if (tendina.val() == $("#TendinaPromo1").val()) {
                $('#confrontaButton').prop('disabled', true);
                $("#ColonnaInputDirectory").css("display", "none");
            }
            else {
                $('#confrontaButton').prop('disabled', false);
                $("#ColonnaInputDirectory").css("display", "block");
            }

            if ($("#TendinaTracciato1").val() == "0") {
                return;
            }
            $('#confrontaButton').prop('disabled', true);
            $("#ColonnaInputDirectory").css("display", "none");
            $("#ColonnaTracciatoSecondario").css("display", "block");
            $("#TendinaTracciatoSecondario").css("display", "block");
        }
    }

    onChangeTracciatoPrimario(tendina) {
        var valoreTendinaPrimaria = tendina.val();

        // Se il valore della prima tendina è "0" o nessun checkbox è selezionato
        if (valoreTendinaPrimaria == "0" || $("#containerTracciatoSecondario input[type='checkbox']").filter(function () {
            return this.value === valoreTendinaPrimaria && this.checked;
        }).length > 0) {
            $("#ColonnaInputDirectory").css("display", "block");
            $("#ColonnaTracciatoSecondario").css("display", "none");
            $('#confrontaButton').prop('disabled', false);
            if (!this.multiSecondario) {
                $("#TendinaTracciatoSecondario").css("display", "none");
            }
            if ($("#TendinaPromo2").val() != 0) {
                $("#ColonnaTracciatoSecondario").css("display", "none");
            }
        } else {
            if (this.secondaria) {
                $("#ColonnaInputDirectory").css("display", "none");
                if (!this.multiSecondario) {
                    $("#TendinaTracciatoSecondario").css("display", "block");
                }
                if ($("#TendinaPromo2").val() != 0) {
                    $("#ColonnaTracciatoSecondario").css("display", "block");
                    $('#confrontaButton').prop('disabled', true);
                }
            }
            else {
                $('#confrontaButton').prop('disabled', false);
            }
        }
    }

    onChangeTracciatoSecondario() {
        var valoreTendinaPrimaria = $("#TendinaTracciato1").val();

        let valList = [];
        $("#containerTracciatoSecondario input[type='checkbox']:checked").each(function () {
            valList.push($(this).val());
        });
        if (!this.multiPrimario) {
            // Se nessun checkbox è selezionato o il valore del checkbox è uguale al valore della prima tendina
            if (this.multiSecondario) {
                if (valList.length === 0 || valList.find(f=> f == valoreTendinaPrimaria) != null) {
                    $('#confrontaButton').prop('disabled', true);
                    $("#ColonnaInputDirectory").css("display", "none");
                } else {
                    $('#confrontaButton').prop('disabled', false);
                    $("#ColonnaInputDirectory").css("display", "block");
                }
            }
            else {
                if ($("#TendinaTracciatoSecondario").val() === valoreTendinaPrimaria || $("#TendinaTracciatoSecondario").val() == 0) {
                    $('#confrontaButton').prop('disabled', true);
                    $("#ColonnaInputDirectory").css("display", "none");
                } else {
                    $('#confrontaButton').prop('disabled', false);
                    $("#ColonnaInputDirectory").css("display", "block");
                }
            }
        }
        else {
            if ($("#containerTracciatiPrimari input[type='checkbox']:checked").length <= 1) {
                $('#confrontaButton').prop('disabled', true);
                $("#ColonnaInputDirectory").css("display", "none");
            } else {
                $('#confrontaButton').prop('disabled', false);
                $("#ColonnaInputDirectory").css("display", "block");
            }
        }

    }

}