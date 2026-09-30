
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

    /// I20-1004: che cosa sta facendo questa richiesta, in parole per l'operatore. La usa
    /// abort() per dire cosa e' stato annullato: "<descrizione> annullato a causa di: <motivo>".
    /// Va detta al maschile. Chi non la imposta si ritrova l'URL.
    descrizione = null;
    url = null;

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

    /// I20-1004: chiamata da abort() quando ha davvero fermato una richiesta in volo, col
    /// motivo che le e' stato passato. Una richiesta annullata non chiama piu' ne' onload ne'
    /// onerror: chi la sta aspettando lo viene a sapere solo da qui.
    onabort(motivo)
    {
    }

    /// Ferma la richiesta in volo e avvisa l'operatore, col codice HRC-02, di cosa e' stato
    /// annullato e perche'. Da quel momento la richiesta tace: la risposta, se arriva, non
    /// raggiunge nessuno, e nemmeno lo stato 4 con status 0 che l'annullamento stesso produce.
    ///
    /// Una richiesta mai partita o gia' conclusa non ha niente da fermare: nessun messaggio,
    /// nessun onabort.
    ///
    /// I20-1004: fino ad allora agiva su un oggetto creato nel costruttore, mentre la
    /// richiesta partiva da un altro creato in send. Non fermava niente.
    abort(motivo = null)
    {
        let xhr = this.xhr;
        if (xhr == null || xhr.annullata || xhr.readyState == 0 || xhr.readyState == 4)
            return;

        //Prima il segno, poi l'abort: l'abort genera subito il suo cambio di stato, e deve
        //gia' trovare la richiesta muta.
        xhr.annullata = true;
        xhr.abort();

        let testo = "Code HRC-02: " + (this.descrizione != null ? this.descrizione : "Invio al server (" + this.url + ")") +
            " annullato" + (motivo != null && motivo !== "" ? " a causa di: " + motivo : "");
        console.warn(testo);
        messaggioUtente(testo, "warning", false, 10);

        this.onabort(motivo);
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
        //I20-1004: e' questa la richiesta che parte, ed e' questa che abort deve fermare.
        this.xhr = _xhr;
        this.url = url;
        _xhr.open(method, urlCompleto, true);
        _xhr.me = this;
        //console.log("Imposto timeout a " + this.timeout);
        _xhr.timeout=this.timeout;
        //Ogni gestore comincia guardando se la richiesta e' stata annullata: da li' in poi
        //non deve arrivare piu' niente a chi l'aveva lanciata.
        _xhr.onload = () => {
            if (_xhr.annullata)
                return;
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
            if (_xhr.annullata)
                return;
            me.readyState = _xhr.readyState;
            me.status = _xhr.status;
            me.onreadystatechange();
        };

        _xhr.onerror = () => {
            if (_xhr.annullata)
                return;
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
            if (_xhr.annullata)
                return;
            console.log("timeout");
            me.onerror("timeout");
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