class LoghiBolli {

    agenzia;
    filesToSync = [];

    constructor() {
        this.agenzia = new Agenzia();
    }

    get() {

        Call.do("LoghiBolli", "get", "GET", null, this, function (result, me) {

            console.log(result);

            let tblBody = $("#tblResult > tbody");
            tblBody.empty();

            let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=";

            if (result.error == null) {
                let template = $("#template").clone();

                for (let i = 0; i < result.length; i++) {
                    let item = result[i];
                    let itemHtml = $(template.html());

                    itemHtml.find("#nomeFile").text(item.nome);
                    itemHtml.find("#sigla").val(item.sigla);
                    itemHtml.find("#cmbTipo").val(item.tipo);

                    itemHtml.attr("id", item.id);

                    itemHtml.find("#preview").attr("src", olUri + item.guidId + "&width=30&height=0");

                    //td><button class="btn btn-primary" onclick="loghiBolliInstance.salvaLogoBollo($(this))">Salva</button></td>
                    itemHtml.find("#btnSalvaLogo").on("click", function () { loghiBolliInstance.salvaLogoBollo($(this)); });
                    itemHtml.find("#btnEliminaLogo").on("click", function () {
                        if (confirm("Sei sicuro di voler eliminare questo elemento?"))
                            loghiBolliInstance.delDo($(this).closest("tr").attr("id"));
                    });

                    itemHtml.find("#preview").on("click", function () { loghiBolliInstance.sostituisciFile($(this)); });

                    tblBody.append(itemHtml);
                }

                let templateNew = $("#templateNew").clone();
                let itemHtmlNew = $(templateNew.html());
                itemHtmlNew.find("#btnAggiungiLogo").on("click", function () {
                    loghiBolliInstance.salvaNuovoLogoBollo($(this));
                });

                itemHtmlNew.find("#previewNew").on("click", function () {
                    loghiBolliInstance.nuovoFile($(this))
                });
      
                tblBody.append(itemHtmlNew);

                $(".fileUpload").on("change", function () {
                    loghiBolliInstance.fileDaSostituireSelezionato($(this));

                });


                $("#fileNew").on("change", function () {
                    loghiBolliInstance.fileNuovoSelezionato($(this));
                });


            }
            else {
                mostraMessaggio(result.error, "danger");
            }

            hideLoading();
        });
    }

    sostituisciFile(sender) {
        sender.parent().find(".fileUpload").click();
    }
    fileDaSostituireSelezionato(sender) {

        let file = sender.prop("files")[0];
        sender.closest("tr").find("#nomeFile").text(file.name);
        sender.closest("tr").find("button").removeClass("btn-primary");
        sender.closest("tr").find("button").addClass("btn-danger");
        sender.closest("tr").find("#nomeFile").css("color", "red");

    }

    nuovoFile(sender) {
        sender.parent().find("#fileNew").click();
    }

    fileNuovoSelezionato(sender) {
        let file = sender.prop("files")[0];
        sender.closest("tr").find("#nomeNew").text(file.name);

    }

    salvaLogoBollo(sender)
    {
       
        let id_logobollo = sender.closest("tr").attr("id");
        let file = sender.closest("tr").find(".fileUpload").prop("files")[0];

        

        let fd = new FormData();
        fd.append("id", id_logobollo);
        fd.append("sigla", sender.closest("tr").find("#sigla").val());
        fd.append("tipo", sender.closest("tr").find("#cmbTipo").val());
        fd.append("file", file);

        this.salvaDo(fd, id_logobollo);

       
    }

    salvaNuovoLogoBollo(sender) {
        
        let file = sender.closest("tr").find("#fileNew").prop("files")[0];

        let fd = new FormData();
        fd.append("id", "");
        fd.append("sigla", sender.closest("tr").find("#siglaNew").val());
        fd.append("tipo", sender.closest("tr").find("#cmbTipoNew").val());
        fd.append("file", file);

        this.salvaDo(fd, "");
    }

    salvaDo(obj, id)
    {

        showLoading();

        let me = this;
        Call.doWithUpload("LoghiBolli", "salva", "POST", obj, this, function (result, me) {

            console.log("RISULTATO SALVATAGGIO");
            console.log(result);

            if (result.esito) {

                console.log(id);

                if (id == "") {
                    me.get();
                }
                else {
                    let olUri = $("#ipOlympus").val() + "/foto/getThumbNailOnDemand?guidId=";
                    let itemHtml = $("#" + id);
                    itemHtml.find("#btnSalvaLogo").addClass("btn-primary");
                    itemHtml.find("#btnSalvaLogo").removeClass("btn-danger");

                    itemHtml.find("#nomeFile").css("color", "black");
                    itemHtml.find("#preview").attr("src", olUri + result.item.guidId + "&width=30&height=0");

                    hideLoading();
                }
            }
        });
    }

    delDo(id) {

        showLoading();

        let me = this;
        Call.doWithUpload("LoghiBolli", "elimina/"+id, "GET", null, this, function (result, me) {

            console.log("RISULTATO ELIMINAZIONE");
            console.log(result);

            if (result.esito) {

                console.log(id);

                me.get();

            }
            else {

                alert(result.error);
                hideLoading();
            }

        });
    }
}