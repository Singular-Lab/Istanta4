
/// I20-1002: il canale verso Istanta, ogni chiamata al server passa di qui.
/// Aggiunge all'XMLHttpRequest nudo il parsing JSON con ricaduta sul testo, il
/// riconoscimento della sessione scaduta (no_login -> noLoginCallback) e il messaggio
/// all'operatore col codice HRC-01.
/// Dipende dalle globali istantaIp, noLoginCallback e messaggioUtente.
class XMLHttpRequestClient 
{
    readyState;
    status;

    timeout=0;

    constructor() 
    {
        this.xhr = new XMLHttpRequest();
    }

    onload()
    {
    }

    onreadystatechange()
    {
    }

    // onErrorRete()
    // {
    //     console.log("onError");
    //     if (pingInProcess == false){
    //         pingForReconnection();
    //     }
    // }

    onNoConnection()
    {
    }

    /// NON ferma la richiesta in volo: aborta this.xhr, che send non usa. Vedi il commento
    /// in confronti.js:2463. Chi deve smettere di aspettare mette una scadenza propria.
    abort()
    {
        if (this.xhr!=null)
            this.xhr.abort();
    }

    /// La chiamata vera. URL su istantaIp salvo externalIp. Risposta: JSON se ci riesce,
    /// testo altrimenti; no_login e utente_non_trovato dirottano su noLoginCallback.
    /// Su stato diverso da 200 mostra da se' il messaggio HRC-01 all'operatore.
    send(url, parameter, method, type, externalIp = null) 
    {
        let me = this;
        console.log("Url: " + url);
        let urlCompleto=(externalIp != null ? externalIp + url : istantaIp + url);
        let _xhr = new XMLHttpRequest();
        _xhr.open(method, urlCompleto, true);
        _xhr.me = this;
        //console.log("Imposto timeout a " + this.timeout);
        _xhr.timeout=this.timeout;
        _xhr.onload = () => {
            //console.log(url + "  me.xhr.status: " + me.xhr.status);
            if (_xhr.status === 200) {
                //callback(null, this.xhr.responseText);
                try {
                    let objResult = JSON.parse(_xhr.responseText);
                    if ((objResult.error == "no_login" || objResult.error == "utente_non_trovato") && url.indexOf("getSession")<0) {
                        noLoginCallback();
                    }
                    else {
                        me.onload(objResult, true);
                    }
                }
                catch{
                    me.onload(_xhr.responseText, false);
                }
            } else {
                if(_xhr.response != null){
                    var response = null;
                    try{
                        response = JSON.parse(_xhr.response);
                    }
                    catch{
                    }
                }
                console.warn('Code HRC-01: Request failed.  Returned status of ' + _xhr.status + (response != null && response.error != null ? (" - " + response.error) : ""));
                messaggioUtente("Code HRC-01: Errore durante la comunicazione col server ("+url+"): " + _xhr.status + (response != null && response.error != null ? (" - " + response.error) : ""), "error");
                me.onerror((response != null && response.error != null ? response.error : _xhr.status));
            }
        }

        _xhr.onreadystatechange = () => {
            me.readyState = _xhr.readyState;
            me.status = _xhr.status;
            me.onreadystatechange();
        };

        _xhr.onerror = () => {
            //me.onErrorRete();
            if (_xhr.response != null) {
                var response = null;
                try {
                    response = JSON.parse(_xhr.response);
                }
                catch {
                }
            }
            me.onerror((response != null && response.error != null ? response.error : _xhr.status));

            if (me.onNoConnection != null){
                //tracciatoOnlineScaricato = false;
                me.onNoConnection((response != null && response.error != null ? response.error : _xhr.status));
            }
        };

        _xhr.ontimeout = (e) => {
        // XMLHttpRequest timed out. Do something here.
            console.log("timeout");
            me.onerror("timeout");
            me.xhr.abort();
        };

        if (parameter != null){
            if (type != "" && type != null){
                _xhr.setRequestHeader("Content-Type", type);
            }
            _xhr.send(parameter);
        }
        else{
            if (type != "" && type != null){
                _xhr.setRequestHeader("Content-Type", type);
            }

            _xhr.send();

        }
    }

    /// Invio di file, via $.ajax e non via XMLHttpRequest.
    /// A differenza di send non mostra nessun messaggio: in errore chiama solo onNoConnection.
    sendFiles(url, formData) 
    {
        let me = this;
        $.ajax({
            url: istantaIp + url,
            type: "POST",
            method: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function (data) {
                try {
                    let objResult = JSON.parse(data);
                    if (objResult.error == "no_login" || objResult.error == "utente_non_trovato") {
                        noLoginCallback();
                    }
                    else {
                        me.onload(objResult, true);
                    }
                }
                catch{
                    me.onload(data, false);
                }
            },
            error: function (data) {
                //me.onErrorRete();
                //me.onerror();
                if (me.onNoConnection != null)
                    me.onNoConnection();
            }
        });
    }
}

module.exports = XMLHttpRequestClient;