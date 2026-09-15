// Please see documentation at https://docs.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

//PLUGIN
(function ($) {
    $.fn.hasScrollBar = function () {
        return this.get(0).scrollHeight > this.get(0).clientHeight;// this.height();
    }
})(jQuery);


// Write your JavaScript code.
    $(function() {
      // Handler for .ready() called.
      if ($("#error_panel").length>0)
      {
          setTimeout(function()
          {
              $("#error_panel").animate(
                  {
                        opacity: 0,
                  },1000,null
              );
          }, 5000);

        }

        if ($("#any_changed").length > 0) {
            $("#any_changed").parent().find(".form-control").keyup(function () {
                //console.log("old value..." + $("#any_changed").val());
                $("#any_changed").val("1");
            });
        }


        //Funzione dichiarata in Utility
        try {
            if (checkRedirect != null) {
                checkRedirect()
            }
        } catch (err) { }
        

        if (typeof IAgenzia !== 'function') {
            alert("Non è stata implementata l'interfaccia di IAgenzia, aggiornare i file");
        }
        else if (typeof documentReady !== "undefined") {
            hideLoading();
            documentReady();
        }

    });

function showLoading(msg) {
    //$("#loading").html("");
    if ($("#loading").children().length <= 0) {

        $("#loading").append("<img src=\"/" + getWebAppRootFolder() + "images/loading.gif\" style=\"margin: 0px auto;\" /><div style=\"margin: 0px auto;margin-top:-152px;font-size:31px;\" id=\"loading_message\"></div>");
    }

    $("#loading").css("display", "block");
    if (msg != null && msg != "") {
        $("#loading_message").text(msg);
    }
    else {
        $("#loading_message").text("");
    }
}

function hideLoading() {
    $("#loading").html("");
    $("#loading").css("display", "none");
}

function mostraMessaggio(msg,tipo) {
    $("#msg_container").html("<div class=\"alert alert-"+tipo+" alert-dismissible\" role=\"alert\"><span>"+msg+"</span><button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"alert\" aria-label=\"Close\"></button><div>");
    $("#msg_container").css("display", "block");
}

// Toglie il messaggio mostrato da mostraMessaggio. Serve perche' l'avviso resta
// finche' qualcuno non lo chiude: senza questa, dopo un errore corretto dall'utente
// la fascia rossa resterebbe li' anche a operazione riuscita.
function nascondiMessaggio() {
    $("#msg_container").empty();
    $("#msg_container").css("display", "none");
}

function getStringFromDate(date) {


    var giorno = date.getDate();
    if (giorno < 10)
        giorno = "0" + giorno;

    var mese = date.getMonth()+1;
    if (mese < 10)
        mese = "0" + mese;

    var ora = date.getHours();
    if (ora < 10)
        ora = "0" + ora;

    var min = date.getMinutes();
    if (min < 10)
        min = "0" + min;

    var result = giorno + "/" + mese + "/" + (1900+date.getYear()) + " " + ora + ":" + min;

    return result;
}


function scaricaUltimaVersioneDelPlugin(sender)
{
    showLoading();
    Call.do("LoginController", "getDownloadLinkOfPlugin", "GET", null, this, function (result) {
        if (result.esito) {
            //Faccio partire donwload
            const a = document.createElement("a");
            a.href = result.esito;
            a.download = "IST_plugin.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();

        }
        else {
            alert(result.error);
        }
        hideLoading();
    });
}

$("#link_download_plugin").click(function() {
    scaricaUltimaVersioneDelPlugin($(this));
});
